/**
 * ReconcileAI — the fleet: deployments, liveness, versions.
 *
 * Control-plane layer. See docs/data-architecture.md and
 * docs/day-2-operations.md.
 *
 * WHY THIS MODULE EXISTS
 *
 * The rest of the model describes what a tenant's data means. This describes
 * the thing that runs it, which under BYOA is software in an AWS account we do
 * not control. Three properties have to hold there and nowhere else in the
 * model:
 *
 *   1. Every channel is OUTBOUND, data-plane-initiated. A regulated customer's
 *      security team will not open an inbound path, and asking is a bad opening
 *      move. The only exception is the audited TenantAccessGrant role
 *      assumption, which lands in their CloudTrail.
 *
 *   2. LIVENESS AND ACTIVITY ARE DIFFERENT FACTS. A customer who reconciles
 *      monthly is silent for twenty-nine days. If "no work" and "no signal"
 *      share a field, that customer looks broken every month, the alert gets
 *      muted, and a genuinely dead plane is muted with it.
 *
 *   3. The plane's clock is theirs. Everything ordered or billed uses OUR
 *      receipt time. This mirrors UsageRecord.recordedAt, which exists for the
 *      same reason.
 *
 * Nothing here carries tenant business data. A deployment's patch level is our
 * operational fact about our own software; it does not become the customer's
 * business data by living in their account. PlatformHealthWindow in
 * observability.ts holds the other side of that line and stays aggregate-only.
 *
 * ⚠️ ─────────────────────────────────────────────────────────────────────────
 * THIS WHOLE MODULE IS `@dropped-for-v1`, 7 AUG 2026, UNDER G36 — **BYOA slips
 * to v1+1; 1CloudHub-hosted only.** Every export below carries the note.
 * **Dropped means DECLARED AND NOT BUILT** — no table, no endpoint, no code.
 * Nothing here is deleted.
 *
 * G36 REVERSES A PASS-F DECISION KNOWINGLY. Pass F made BYOA a v1 target because
 * the first non-demo customer is a regulated enterprise sold direct, and that
 * reasoning still stands; what changed is that ASAP was not a constraint when it
 * was taken. Two things go with this module — `EntitlementLease` and
 * `UsageAttestation` in billing.ts — and two administration operations,
 * `registerDataPlane` and `issueEntitlementLease`, are never written.
 *
 * ONE GENUINE RELIEF, and it is the reason to record the drop here rather than
 * only in the ledger: pass C's *"adopt expand/contract migrations here or never"*
 * was irreversible only because BYOA planes sit in AWS accounts we cannot reach.
 * On a hosted fleet a bad migration is recoverable. It also defers staffing the
 * named fleet-operations function pass C required before the first BYOA customer.
 *
 * WHAT COMES BACK FIRST when BYOA returns: `DataPlane` itself, because
 * `sendHeartbeat` derives `dataPlaneId` from the SigV4 principal and therefore
 * presupposes a row carrying `attestationPublicKey` that nothing else creates.
 * ───────────────────────────────────────────────────────────────────────────
 */

import type {
  DataPlaneId,
  DeploymentMode,
  PackKey,
  RegionKey,
  TenantId,
  Timestamp,
  UserId,
} from './domain'

/**
 * The two fleet-record ids, 7 Aug (G35). From `./kernel` directly; see the same
 * note in `billing.ts` — the ids above arrive by re-export for historical
 * reasons, and a new id has no history to preserve.
 */
import type {
  DataPlaneHealthId,
  DataPlaneHeartbeatId,
  DataPlanePlacementId,
} from './kernel'
/** @dropped-for-v1 7 Aug 2026 — G36 — BYOA slips to v1+1; this whole module goes with it. Declared, not built. */
export type { DataPlaneHealthId, DataPlaneHeartbeatId } from './kernel'
/** Minted 18 Sep 2026 with `DataPlanePlacement`. Not dropped: see that declaration. */
export type { DataPlanePlacementId } from './kernel'

/* ------------------------------------------------------------------ *
 * Liveness — a statement about the channel, never about the workload
 * ------------------------------------------------------------------ */

/**
 * What the heartbeat channel says. Deliberately excludes any notion of busy or
 * idle: see `DataPlane.lastWorkAt` for that, and keep them apart.
 *
 * `dark` is a commercial state, not an engineering one. A plane nobody has
 * heard from for three days is a conversation with the customer, and an
 * entitlement renewal that does not proceed blind.
 */
/** @dropped-for-v1 7 Aug 2026 — G36 — BYOA slips to v1+1; this whole module goes with it. Declared, not built. */
export const DATA_PLANE_LIVENESS = {
  /** Beats current. */
  healthy: 'healthy',
  /** Three intervals missed. Usually transient network; watch, do not page. */
  stale: 'stale',
  /** An hour. Page fleet operations and notify the customer's named contact. */
  unreachable: 'unreachable',
  /** Seventy-two hours. Commercial process. */
  dark: 'dark',
} as const
/** @dropped-for-v1 7 Aug 2026 — G36 — BYOA slips to v1+1; this whole module goes with it. Declared, not built. */
export type DataPlaneLiveness =
  (typeof DATA_PLANE_LIVENESS)[keyof typeof DATA_PLANE_LIVENESS]

/**
 * How far behind the deployment is. Deliberately NOT a liveness state: a plane
 * can be perfectly healthy and two versions behind, and treating that as an
 * outage trains everyone to ignore the signal.
 */
/** @dropped-for-v1 7 Aug 2026 — G36 — BYOA slips to v1+1; this whole module goes with it. Declared, not built. */
export const VERSION_POSTURES = {
  current: 'current',
  /** Within the supported window. An upgrade conversation, not an incident. */
  behind: 'behind',
  /** Outside the window. No SLA until upgraded. */
  unsupported: 'unsupported',
} as const
/** @dropped-for-v1 7 Aug 2026 — G36 — BYOA slips to v1+1; this whole module goes with it. Declared, not built. */
export type VersionPosture =
  (typeof VERSION_POSTURES)[keyof typeof VERSION_POSTURES]

/**
 * The window the control plane commits to supporting.
 *
 * Expressed in SCHEMA versions rather than engine versions, because schema
 * version is a monotonic integer and mechanically comparable, where an engine
 * version string is not. Engine version is recorded everywhere and gates
 * nothing.
 *
 * This only works because migrations are forward-only and expand/contract:
 * engine N runs against schema N and N-1. You cannot roll back a schema change
 * in an account you cannot reach, whose backups you do not hold, and whose PITR
 * window is the customer's decision. See docs/day-2-operations.md §3.2.
 */
/** @dropped-for-v1 7 Aug 2026 — G36 — BYOA slips to v1+1; this whole module goes with it. Declared, not built. */
export interface SupportedVersionWindow {
  currentSchemaVersion: number
  /** Oldest still under SLA. Typically current - 2. */
  minimumSupportedSchemaVersion: number
  /**
   * Contractual window for a critical security patch, pre-authorised at
   * signing. Distinct from feature rollout, which the customer consents to per
   * release. Without this clause a fleet-wide vulnerability becomes N separate
   * negotiations conducted under disclosure pressure.
   */
  securityPatchHours: number
}

/**
 * Decided 4 Aug 2026. Tight enough to be meaningful against a known CVE in
 * accounts we cannot reach; long enough that a regulated customer's change
 * board can accept it at signing.
 */
/** @dropped-for-v1 7 Aug 2026 — G36 — BYOA slips to v1+1; this whole module goes with it. Declared, not built. */
export const SECURITY_PATCH_HOURS_DEFAULT = 72

/* ------------------------------------------------------------------ *
 * The deployment
 * ------------------------------------------------------------------ */

/**
/* ------------------------------------------------------------------ *
 * Placement — the DECISION to run a plane, which precedes the plane
 * ------------------------------------------------------------------ */

/**
 * A placement is a DECISION; a `DataPlane` is an INSTALLATION. They are two
 * objects with two lifetimes and this module held only the second.
 *
 * 🛑 WHY THIS TYPE EXISTS, AND IT IS A DEFECT FOUND BY DESIGNING AGAINST THE
 * MODULE RATHER THAN READING IT.
 *
 * `docs/fleet-deployment.md` set out to make onboarding a customer "a config
 * change in the control plane" — the product owner's own words — and wrote that
 * down as an INSERT of a `DataPlane` row. **`DataPlane` refuses that insert.**
 * Six of its required, non-nullable fields cannot be known before the plane
 * exists: `attestationPublicKey`, `engineVersion`, `schemaVersion`,
 * `installedPackVersions`, `infrastructureTags` and `installedAt`.
 * `attestationPublicKey` says why in its own docblock — the key pair is
 * "generated IN THE CUSTOMER'S ACCOUNT at install" — and `infrastructureTags`
 * says the same of the tags, which are "an onboarding input" from the customer.
 *
 * So the onboarding sequence was circular: the insert needed the public key,
 * the key needed the install, the install needed the bootstrap, and the
 * bootstrap's registration step existed to deliver the key the insert had
 * already required.
 *
 * ⚠️ AND THIS MODULE HAD ALREADY FOUND IT. Its own header records what comes
 * back first when BYOA returns — `DataPlane`, "because `sendHeartbeat` derives
 * `dataPlaneId` from the SigV4 principal and therefore PRESUPPOSES A ROW
 * CARRYING `attestationPublicKey` THAT NOTHING ELSE CREATES". That sentence is
 * this type. It was written a month before anybody needed it and nothing acted
 * on it, which is the argument for splitting now rather than after the first
 * install — a fleet-wide migration in accounts we cannot reach.
 *
 * WHAT A PLACEMENT IS: everything decided BEFORE anything runs. Every field
 * here is knowable at the moment a human says "this customer gets a plane".
 * Nothing here is reported BY a plane, which is the test for whether a field
 * belongs on this type or the other one.
 *
 * ⚠️ HOSTED PLACEMENTS ARE NOT PER-TENANT, AND G281 IS THE REASON THIS IS
 * STATED RATHER THAN ASSUMED. A hosted plane is multi-tenant — `tenantId` is
 * null on `DataPlane` for exactly that reason, and hosted tenants point AT a
 * plane. So onboarding a HOSTED customer mints no placement at all: it is a
 * `Tenant` row pointing at a plane that already runs. A placement is minted for
 * a BYOA customer, and for a new hosted plane when one is added to the estate.
 */
export interface DataPlanePlacement {
  id: DataPlanePlacementId
  /**
   * The tenant this placement is for. Null when placing a new HOSTED plane,
   * which serves many tenants and is placed for the estate rather than for a
   * customer — the same nullability, for the same reason, as `DataPlane`.
   */
  tenantId: TenantId | null
  mode: DeploymentMode
  /**
   * ⚠️ STAYS BARE (R1) — AWS mints it, and under BYOA it is minted in the
   * CUSTOMER's account. Null for hosted.
   *
   * 🛑 THIS FIELD IS SUPPLIED BY THE CUSTOMER AND IS THE THING REGISTRATION
   * MUST BE CHECKED AGAINST. A registration presenting a token minted for this
   * placement, from an account that is not this one, is a redemption by the
   * wrong party. Nothing here enforces that; the seam that redeems must.
   */
  awsAccountId: string | null
  region: RegionKey
  /**
   * ⚠️ STAYS BARE (R1). The STS `ExternalId` — the confused-deputy control.
   * Minted HERE, at placement, because the customer needs it to write their
   * trust policy before anything of ours runs in their account.
   */
  externalId: string | null
  /**
   * The schema version this placement is to run. The control plane's decision,
   * compared against `SupportedVersionWindow`.
   *
   * ⚠️ THIS IS THE DESIRED VERSION AND `DataPlane.schemaVersion` IS THE ACTUAL
   * ONE. Keeping them on two types is the whole point of the split: a
   * reconciler compares them, and a design that stored one number could not
   * express "should be on 7, is on 5", which is the only interesting state.
   */
  targetSchemaVersion: number
  placedAt: Timestamp
  /** Who decided. Null is not permitted: a placement is an act (invariant 10). */
  placedByUserId: UserId
  /**
   * Set when registration mints the `DataPlane`. Null until then, and a
   * placement that has been null for a long time is the onboarding that stalled
   * — which `docs/handoff-pack`'s H2 journey asks for and nothing answers.
   */
  installedDataPlaneId: DataPlaneId | null
  /**
   * Withdrawn before it was ever installed. Distinct from
   * `DataPlane.decommissionedAt`, which retires something that ran.
   */
  withdrawnAt: Timestamp | null
  withdrawnReason: string | null
}

/**
 * One running data plane. The unit fleet operations acts on.
 *
 * Keyed independently of Tenant because the two differ under BYOA: a hosted
 * plane serves many tenants, a customer-owned plane serves exactly one, and the
 * operational facts below belong to the deployment either way.
 */
/** @dropped-for-v1 7 Aug 2026 — G36 — BYOA slips to v1+1; nothing registers a plane, so nothing reads this. Declared, not built. */
export interface DataPlane {
  id: DataPlaneId
  /**
   * The placement this plane was installed from. Minted 18 Sep 2026 with the
   * split — see `DataPlanePlacement`. A plane with no placement is a plane
   * nobody decided to run.
   */
  placementId: DataPlanePlacementId
  /**
   * The tenant this plane serves. Null for a hosted plane, which is
   * multi-tenant — hosted tenants point AT a plane, not the reverse.
   */
  tenantId: TenantId | null
  mode: DeploymentMode
  /** Null for hosted. Those run in a 1CloudHub account. */
  /**
   * ⚠️ STAYS BARE (R1). AWS mints it, in the CUSTOMER's own account under BYOA.
   * Note that the extractor guesses this field names our `Account` entity. It
   * does not — the name collides and the namespaces do not. Listed in
   * `BareByRule` in `model/identity.ts`.
   */
  awsAccountId: string | null
  region: RegionKey

  /* --- how we reach it, when permitted --- */

  /**
   * Cross-account role assumed under a TenantAccessGrant, with an external id.
   * Never a static credential. Null for hosted, where support has no account
   * boundary to cross.
   */
  supportRoleArn: string | null
  /**
   * ⚠️ STAYS BARE (R1). An AWS STS `ExternalId` — the confused-deputy control,
   * minted and meaningful only inside the customer's trust policy. Listed in
   * `BareByRule` in `model/identity.ts`.
   */
  externalId: string | null
  /**
   * Public half of a key pair generated IN THE CUSTOMER'S ACCOUNT at install.
   * The private half never leaves their KMS and the application never holds key
   * material. Verifies both heartbeats and attestations.
   *
   * No field in this model may hold key material; a public key is not key
   * material, and this one is useless without the private half.
   */
  attestationPublicKey: string

  /* --- three version axes, deliberately separate --- */

  /** Informational. Recorded everywhere, gates nothing. */
  engineVersion: string
  /** The gate. Monotonic, compared against SupportedVersionWindow. */
  schemaVersion: number
  /** Content, not code. Pack releases and engine releases are different trains. */
  installedPackVersions: Record<string, number>

  /* --- liveness --- */

  liveness: DataPlaneLiveness
  lastHeartbeatAt: Timestamp | null
  /** Our sequence high-water mark. A gap here is a lost beat, not an absence. */
  lastHeartbeatSequence: number | null
  lastAttestationAt: Timestamp | null
  lastAttestationSequence: number | null

  /* --- activity, which is NOT liveness --- */

  /**
   * Last billable work. Null means never.
   *
   * SEPARATE FIELD ON PURPOSE. An idle plane is healthy. Deriving liveness from
   * this is the bug this field exists to prevent.
   */
  lastWorkAt: Timestamp | null

  versionPosture: VersionPosture

  /* --- cost reporting, which is a feature and not a margin instrument --- */

  /**
   * The customer's own negotiated provider rates, minor units, keyed by model
   * id. Null until they supply them.
   *
   * We can see a BYOA customer's token COUNTS and never their unit price —
   * their Bedrock bill may carry provisioned-throughput commitments, private
   * pricing or enterprise discounts we have no visibility into. So cost
   * reporting here is a customer-facing feature computed from counts, and
   * ProviderCostRecord stays unpopulated in this mode.
   *
   * Decided 4 Aug 2026: ask for their rates, fall back to public list pricing,
   * and label every derived figure an ESTIMATE. Public list will overstate the
   * bill of any customer with a commitment, which in this segment is most of
   * them — so presenting it as fact would be a fabrication.
   */
  providerRatesMinor: Record<string, number> | null
  providerRatesSuppliedAt: Timestamp | null

  /**
   * Tags applied to every AWS resource in this deployment — environment,
   * deployment mode, region, owner, data classification.
   *
   * In BYOA the CUSTOMER'S mandatory tag policy applies and is an onboarding
   * input, not a detail: their Config rules or service control policies will
   * reject an untagged resource, and the stack simply will not deploy. Ours is
   * a minimum set, not the whole set.
   */
  infrastructureTags: Record<string, string>

  installedAt: Timestamp
  decommissionedAt: Timestamp | null
}

/* ------------------------------------------------------------------ *
 * Heartbeat — cheap, frequent, unsigned
 * ------------------------------------------------------------------ */

/**
 * Liveness and fleet state. Roughly every five minutes, including when the
 * plane did nothing.
 *
 * Separate from UsageAttestation on purpose. They answer different questions,
 * tolerate very different failure modes, and are authenticated differently:
 *
 *   HEARTBEAT     is it alive and current?   SigV4 only. Gaps tolerable.
 *   ATTESTATION   what do we bill?           SigV4 AND a content signature.
 *                                            Gaps NOT tolerable.
 *
 * SigV4 authenticates the channel — who is calling. Content signing answers a
 * different question: can they later deny it. Billing needs the second;
 * liveness does not. Using one mechanism for both is the classic error.
 */
/** @dropped-for-v1 7 Aug 2026 — G36 — BYOA slips to v1+1; a hosted fleet does not heartbeat to itself. Declared, not built. */
export interface DataPlaneHeartbeat {
  /**
   * ADDED 7 Aug (G35), AND THIS IS THE ONE THE CLASSIFICATION FLAGS AS COSTLY.
   *
   * A beat arrives roughly every five minutes per plane, including when the
   * plane did nothing, so this is the highest-cardinality record in the model
   * and NOTHING POINTS AT AN INDIVIDUAL BEAT. `(dataPlaneId, sequence)` is
   * already unique, already carried, and already how a buffered replay is
   * de-duplicated. A surrogate here is a column on the largest table that no
   * foreign key will reference.
   *
   * Taken because G35 is the decision and an identity rule that exempts whatever
   * looks expensive is a preference, not a rule. But recorded HERE so that
   * `docs/identity-classification.md`'s "the one worth arguing with later" has a
   * home in the code: THE SCHEMA PASS SHOULD REVISIT THIS SINGLE FIELD — against
   * a measured row count, not in advance — rather than reopen G35. Dropping it
   * later costs one field and one map entry in `model/identity.ts`.
   */
  id: DataPlaneHeartbeatId
  dataPlaneId: DataPlaneId
  /** Monotonic per plane. Buffered beats replay with their original number. */
  sequence: number
  /** The plane's clock. Informational only — never used for ordering. */
  emittedAt: Timestamp
  /** Ours. Everything ordered uses this. */
  receivedAt: Timestamp

  engineVersion: string
  schemaVersion: number
  /** True while a migration is applied but not complete. A half-migrated plane
   *  must be visible rather than merely slow. */
  schemaMigrationPending: boolean
  /**
   * G224, 22 Aug 2026 — the closed vocabulary, same reasoning as
   * `UsageAttestation.packVersionsInForce`: an absent key means the pack is
   * not installed, so this is `Partial` rather than total.
   */
  packVersionsInForce: Partial<Record<PackKey, number>>

  /**
   * Errors since the previous beat, keyed by error class.
   *
   * Keys MUST come from the closed error vocabulary — free text is never the
   * diagnostic channel, because under a restrictive SpanAttributePolicy the
   * class is the only thing that survives redaction. The vocabulary is not
   * written yet and must be exhaustive before launch: adding a code later means
   * shipping an engine release into a customer account before you can diagnose
   * what you just learned about. See docs/day-2-operations.md §1.3.
   */
  errorCounts: Record<string, number>
  queueDepth: number
  /** The plane's own assessment. We record it; we need not believe it. */
  selfReported: 'ok' | 'degraded'

  /**
   * Last billable work as the plane sees it. Carried here so that zero activity
   * is something the plane SAYS rather than something we infer from silence.
   */
  lastWorkAt: Timestamp | null

  /** Which lease is in force, so drift between issue and use is visible. */
  leaseSequence: number
  leaseExpiresAt: Timestamp
}

/* ------------------------------------------------------------------ *
 * Fleet operations view
 * ------------------------------------------------------------------ */

/**
 * What an operator sees across the fleet.
 *
 * Defined by what it excludes, in the manner of PartnerHealthView. Every field
 * here is a fact about OUR software's state. None is a fact about the
 * customer's business.
 *
 * EXCLUDED ON PURPOSE — do not add these:
 *   - run, document or exception counts (invert to transaction volumes)
 *   - token counts (a proxy for volume)
 *   - definition, pack or cost-centre NAMES (customer-authored, revealing)
 *   - anything that would make this a per-tenant business breakdown, which is
 *     precisely what PlatformHealthWindow refuses to be
 */
/** @dropped-for-v1 7 Aug 2026 — G36 — BYOA slips to v1+1; with no remote planes there is no fleet to roll up. Declared, not built. */
export interface DataPlaneHealth {
  /**
   * ADDED 7 Aug (G35). A computed view over a window, and the id addresses THE
   * COMPUTATION rather than the plane: an operator escalation, a support item or
   * a lease-grace commercial trigger cites the assessment it acted on, and
   * `dataPlaneId` alone names the plane as it is now, not as it was when someone
   * decided something about it.
   */
  id: DataPlaneHealthId
  dataPlaneId: DataPlaneId
  mode: DeploymentMode
  region: RegionKey

  liveness: DataPlaneLiveness
  /** Null when no beat has ever arrived. */
  secondsSinceHeartbeat: number | null
  /** Missing sequence numbers in the attestation series. Non-zero is a billing
   *  problem before it is an engineering one. */
  attestationGaps: number

  versionPosture: VersionPosture
  engineVersion: string
  schemaVersion: number
  schemaMigrationPending: boolean

  /** A BAND, not a count. Bands do not invert to volumes. */
  errorBand: 'none' | 'low' | 'elevated' | 'high'

  leaseExpiresAt: Timestamp
  /** True inside the grace window. Operational, and a commercial trigger. */
  leaseInGrace: boolean
}

/* ------------------------------------------------------------------ *
 * Derivations
 * ------------------------------------------------------------------ */

/**
 * Liveness from elapsed time. Pure, and takes elapsed seconds rather than a
 * clock so it stays testable and free of Date.
 *
 * Note what this function does NOT take: anything about workload. That is the
 * invariant it exists to hold.
 */
/** @dropped-for-v1 7 Aug 2026 — G36 — BYOA slips to v1+1; reads heartbeats nothing emits. Declared, not built. */
export function livenessFor(
  secondsSinceLastBeat: number | null,
  expectedIntervalSeconds: number,
): DataPlaneLiveness {
  if (secondsSinceLastBeat === null) return DATA_PLANE_LIVENESS.unreachable
  if (secondsSinceLastBeat >= 72 * 3600) return DATA_PLANE_LIVENESS.dark
  if (secondsSinceLastBeat >= 3600) return DATA_PLANE_LIVENESS.unreachable
  if (secondsSinceLastBeat >= 3 * expectedIntervalSeconds) {
    return DATA_PLANE_LIVENESS.stale
  }
  return DATA_PLANE_LIVENESS.healthy
}

/** Version posture against the supported window. Schema version is the gate. */
/** @dropped-for-v1 7 Aug 2026 — G36 — BYOA slips to v1+1; reads a version window nothing sets. Declared, not built. */
export function versionPostureFor(
  schemaVersion: number,
  window: SupportedVersionWindow,
): VersionPosture {
  if (schemaVersion >= window.currentSchemaVersion) {
    return VERSION_POSTURES.current
  }
  if (schemaVersion >= window.minimumSupportedSchemaVersion) {
    return VERSION_POSTURES.behind
  }
  return VERSION_POSTURES.unsupported
}
