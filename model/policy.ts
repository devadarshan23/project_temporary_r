/**
 * ReconcileAI — policy and guardrails.
 *
 * Platform layer. Solution packs declare what they need; they never implement
 * policy. See docs/policy-and-billing.md.
 *
 * Design stance: policy is DATA, evaluated centrally, and every decision is
 * recorded. In a regulated industry the question is never "what did the agent
 * do" but "why was it allowed to". A policy engine that cannot answer the
 * second is not a policy engine.
 */

import type {
  Capability,
  CapabilityRequirement,
  OrgClass,
  ScopeDimension,
} from './access'
import type { CorrespondenceChannel } from './correspondence'
import type {
  DefinitionId,
  Disposition,
  Money,
  Reversibility,
  AgentAction,
  DataClass,
  DomainKey,
  ExceptionId,
  PartnerId,
  RegionKey,
  RunId,
  Severity,
  TenantId,
  Timestamp,
  UserId,
} from './domain'

import type { AutonomyProposalId, PolicyId } from './kernel'

/* SLICE 6 — the reference sweep's targets. Imported from `./kernel` directly
 * rather than through `./domain`: a NEW id has no re-export history to
 * preserve, and routing it through the largest module in the system is the
 * indirection slice 3 was written to end. Re-exported for the same reason the
 * older ids are — a consumer that already reads this module keeps reading it. */
import type {
  BudgetId,
} from './kernel'
export type {
  BudgetId,
} from './kernel'

export type { PolicyId } from './kernel'

/* ------------------------------------------------------------------ *
 * Policy kinds
 * ------------------------------------------------------------------ */

/**
 * ⚠️ V1 SCOPE, 7 Aug 2026. **Seven kinds declared, FIVE live in v1** — `spend`
 * and `contentGuardrail` are marked below. The count is stated here because it
 * was very nearly four: `modelUse` was proposed for the drop on the argument
 * that it re-encodes `FieldSpec.modelProcessingAllowed`, and that argument is
 * false. `agents.ts` states the distinction at the declaration of
 * `HarnessDocument.maxDataClassInPrompt` — one governs a single extracted
 * value, the other governs the ASSEMBLED context — and, decisively,
 * `grep -rn allowedRegions model/` returns `ModelUseConfig` as the ONLY
 * tenant-scoped source `resolveModel()` has. `resolveModel()` is invariant 7's
 * sole executable enforcement. Dropping `modelUse` would leave it with no
 * input. **RESTORED DELIBERATELY. Do not re-cut it without reading this.**
 *
 * ⚠️ **AMENDED 8 Aug 2026 — G79. The counts in the paragraph above are now
 * EIGHT declared and SIX live**, because `managedServiceUse` landed. The
 * paragraph is left as written rather than rewritten, per this record's
 * convention of marking a count stale in place; the two `@dropped-for-v1` notes
 * below still say *"POLICY_KINDS ships five live kinds"* and are stale for the
 * same reason and in the same way. **The drops themselves are unchanged** —
 * `spend` and `contentGuardrail` are still declared and not built, and G79 did
 * not touch them.
 */
export const POLICY_KINDS = {
  /** What the agent may do without a human. The critical agentic guardrail. */
  autonomy: 'autonomy',
  /** Who must approve, and when. */
  approval: 'approval',
  /** Which models may run, where, and on what data. */
  modelUse: 'model_use',
  /**
   * Which MANAGED AI SERVICES may be called, where, and on what data — the
   * services that are not models and therefore never reach `resolveModel()`.
   * LIVE in v1: G53 binds document extraction to AWS Textract. See
   * `ManagedServiceUseConfig`.
   */
  managedServiceUse: 'managed_service_use',
  /** What may leave the tenant boundary. */
  dataEgress: 'data_egress',
  /** Spend ceilings. Enforced through the billing layer. */
  /** @dropped-for-v1 7 Aug 2026 — v1 prices nothing, so there is no billing layer to enforce a ceiling through. Declared, not built. */
  spend: 'spend',
  /** Content filtering on model input and output. */
  /** @dropped-for-v1 7 Aug 2026 — no provider guardrail is provisioned in v1; the injection gate and `mayAdmit()` carry the admission side. Declared, not built. */
  contentGuardrail: 'content_guardrail',
  /** What may be said to a third party, what may be believed from one. */
  correspondence: 'correspondence',
} as const
export type PolicyKind = (typeof POLICY_KINDS)[keyof typeof POLICY_KINDS]

/* ------------------------------------------------------------------ *
 * Per-kind configuration
 *
 * POLARITY. Four fields on this page were deny lists — `neverAutonomousIn`,
 * `neverExport`, `blockInOutput`, and `allowedModels` documented as
 * "Empty = platform default set" with no platform default set anywhere. All
 * four failed OPEN: `neverExport: []` denies nothing and is PERMISSIVE, so a
 * freshly constructed config, a failed lookup and a defensive `catch` each
 * produced a maximally permissive policy. Inverted 5 Aug 2026 (§8.6) — an
 * empty `{ kind: 'these', values: [] }` now allows nothing and `all` has to be
 * written down.
 *
 * They reuse `ScopeDimension<T>` from access.ts rather than declaring a second
 * shape, because this repo already made exactly this fix once: `AssignmentScope`
 * went from `T[] | null` (null meaning unrestricted) to `{kind:'all'} |
 * {kind:'these'}` and the policy config never got the same treatment. Two shapes
 * for one idea drift, and the half that drifts is always the one nobody was
 * looking at.
 *
 * `ContentGuardrailConfig.redactInInput` is deliberately UNAFFECTED. Redaction
 * transforms; it does not prohibit, so an empty list means "redact nothing",
 * which is what it has always meant and is not a failure to deny.
 * ------------------------------------------------------------------ */

/**
 * The most consequential policy in an agentic product.
 *
 * "The agent may auto-resolve low-severity quantity variances under SGD 5,000
 * in finance, must propose-only above that, and is autonomous nowhere else."
 * That sentence is one row of this type.
 */
export interface AutonomyConfig {
  /** Agent may act without human review at or below this severity. */
  maxAutoResolveSeverity: Severity | 'none'
  /**
   * Domains where autonomous resolution is permitted AT ALL.
   *
   * Was `neverAutonomousIn: DomainKey[]`, which meant a config nobody had
   * filled in authorised autonomy in KYC, credit underwriting and medical
   * records — the three domains `DEFAULT_AUTONOMY_BY_DOMAIN` sets to `'none'`
   * precisely because they are the ones you cannot defend afterwards.
   *
   * `{ kind: 'these', values: [] }` is the safe empty value and the one a
   * failed resolution must return. `{ kind: 'all' }` is legitimate and now has
   * to be typed by someone.
   */
  autonomousIn: ScopeDimension<DomainKey>
  /** Monetary ceiling for autonomous action. Null = no monetary gate. */
  autoResolveValueCeiling: MoneyAmount | null
  /** Actions the agent may take unattended. */
  permittedActions: AgentAction[]
  /** If true, the agent may still propose; only execution is gated. */
  mayProposeBeyondLimits: boolean
}

/** Moved to domain.ts — a procedure step references it. Re-exported here
 *  because policy is where autonomy limits are expressed. */
export type { AgentAction }

export interface MoneyAmount {
  currency: string
  /**
   * Exact minor units. Never a float — this is money.
   *
   * 🛑 `bigint` SINCE 19 Sep 2026 — G286, WHICH NAMES `Money.amountMinor` AND IS
   * APPLIED HERE TOO, DELIBERATELY. G65's own wording is *"all 16 money fields
   * are minor units … every one is `number`"*, and this is one of them. Leaving
   * it `number` would have been the exact `number`/`bigint` mixing G111's codec
   * exists to prevent: `Exception.valueAtRisk` is a `Money` and
   * `AutonomyConfig.autoResolveValueCeiling` is a `MoneyAmount`, and the note at
   * the autonomy gate below says the two are compared by `amountMinor` directly
   * once the exponent is known. Two representations either side of that
   * comparison is a defect waiting for a caller.
   *
   * ⚠️ WHAT DID NOT MOVE, said plainly so a reader does not infer a sweep that
   * did not happen: the bare minor-unit PRICE and RATE fields — `unitPriceMinor`,
   * `costMinor`, `revenueMinor`, `inputPerMillionMinor`, `blastRadiusMinor`,
   * `modelSpendMinor` — are still `number`. They are not `Money` and G286 names
   * `Money.amountMinor`. Widening to every minor-unit field in the model is a
   * second ruling nobody has taken.
   */
  amountMinor: bigint
}

export interface ApprovalConfig {
  /**
   * What an approver must HOLD. Empty = approval impossible, i.e. hard stop —
   * unchanged, and still the intended reading of an empty list.
   *
   * Was `approverRoles: RoleKey[]`, and `RoleKey` includes `partner_admin`.
   * A policy naming `'partner_admin'` — or a pack-shipped role that happens to
   * be keyed `'approver'`, since role identity is (packId, key) and a bare
   * string comparison ignores the first half — made a partner the approving
   * authority for a customer's disposition. That is the one thing the partner
   * model says a partner may never be.
   *
   * `CapabilityRequirement` also expresses what the old field could not: "may
   * approve, on this domain, above this amount". A pack shipping "KYC Reviewer"
   * under a customer's own label still satisfies it.
   *
   * `quorum` below and `CapabilityRequirement.distinctHolders` are NOT the same
   * count and must not be collapsed: `distinctHolders` binds within one
   * requirement, `quorum` is the floor on distinct people across all of them.
   */
  approvers: CapabilityRequirement[]
  /** How many distinct approvers. >1 gives four-eyes for high-value items. */
  quorum: number
  /** Severity at or above which approval is mandatory regardless of value. */
  mandatoryAtOrAbove: Severity
  /**
   * Value at or above which approval is mandatory regardless of severity.
   *
   * Added 5 Aug after a slice review found there was NO monetary gate on the
   * human path at all. AutonomyConfig.autoResolveValueCeiling binds agents
   * only. (`ProcedureStep.secondApproverAbove` was deleted 5 Aug — it was exactly
   * `distinctHolders: 2` plus `appliesAtOrAboveValue` on `CapabilityRequirement`,
   * and two encodings of one rule have no tiebreak.) A procedure routes
   * through a human step. So a person could execute a disposition of unbounded
   * value on a low-severity exception with no procedure attached and no
   * approval whatsoever — and severity is deliberately decoupled from value
   * elsewhere in this model, so "high value implies high severity" was never
   * available as a defence.
   *
   * Evaluated against the greater of Exception.valueAtRisk and the proposal's
   * adjustment, on EVERY execution path including manual.
   */
  mandatoryAtOrAboveValue: MoneyAmount | null
  /**
   * Approver may not be the proposer. Should be true in regulated domains.
   *
   * ⚠️ VACUOUS WHEN THE PROPOSER IS AN AGENT, and that is worse than absent.
   * `ProposalActor` is a union; `approver !== proposer` is trivially true
   * against `{ kind: 'agent' }`, so the flag reads as satisfied while asserting
   * nothing at all. A control that always passes is a false assurance, and a
   * false assurance is the one thing worse than a missing control.
   *
   * Not fixed here because both plausible fixes are decisions rather than
   * edits: bind separation to the DELEGATING user (the human who pressed Run),
   * or to the author of the autonomy policy that authorised the agent. The
   * first is right for `manual` triggers and meaningless for `ingest`; the
   * second is right for autonomous runs and distant from the decision. Recorded
   * so nobody reads a green flag as a satisfied control.
   */
  segregationOfDuties: boolean
  /**
   * Hours before an unactioned approval escalates. Null = no escalation.
   *
   * ⚠️ UNENFORCEABLE FROM THE MODEL AS IT STANDS, and the gap is one field wide.
   * `ApprovalDecision` (domain.ts) carries `decidedAt` and nothing recording
   * when the approval was REQUESTED, so there is no `t0` to measure these hours
   * from — and an approval that was never notified has no row at all. A missing
   * notification therefore stalls an approval permanently, with no clock and
   * nothing to escalate, which is the silent-failure shape rather than the
   * loud one.
   *
   * The fix is `ApprovalDecision.requestedAt: Timestamp`, set when the approval
   * is raised rather than when it is answered. That type is domain.ts's, not
   * this file's — recorded here because this is the field that reads as a
   * working control and is not one.
   */
  escalateAfterHours: number | null
}

/**
 * ⚠️ KEPT IN V1 DELIBERATELY, 7 Aug 2026, against a proposed drop. This is the
 * only tenant-scoped source of `allowedModels`, `allowedRegions` and
 * `requireZeroRetention`, which are `resolveModel()`'s three inputs and
 * therefore invariant 7's entire executable surface. Four fields. See the
 * banner on `POLICY_KINDS`.
 */
export interface ModelUseConfig {
  /**
   * Model identifiers permitted in this tenant.
   *
   * NOT one of §8.6's three, and it had the same bug with a worse blast radius.
   * It read `allowedModels: string[]` documented "Empty = platform default set",
   * and THERE IS NO PLATFORM DEFAULT SET — no constant, no resolver, nothing.
   * `resolveModel()` implements the documentation faithfully
   * (`allowedModels.length > 0 && !allowedModels.includes(modelId)`), so an
   * empty list permits every entry in the catalogue, on the control that
   * carries invariant 7. Residency survives inference only because
   * `resolveModel` rejects `global.*` routing unconditionally on a separate
   * line; the allow-list itself was contributing nothing.
   *
   * ⚠️ `resolveModel()` in catalog.ts still takes `allowedModels: string[]` and
   * still applies the empty-permits-all rule. Changing the field type here does
   * not change that function — catalog.ts is not this file's to edit, and the
   * two must be landed together or the fix is cosmetic.
   */
  allowedModels: ScopeDimension<string>
  /** Inference must occur in one of these regions. */
  allowedRegions: RegionKey[]
  /**
   * Highest classification permitted in a prompt. Fields above this are
   * redacted before the call, not merely discouraged.
   */
  maxDataClassInPrompt: DataClass
  /** Reject prompts whose provider retains data for training. */
  requireZeroRetention: boolean
}

/**
 * ⚠️ G79, 8 Aug 2026. **LOAD-BEARING RATHER THAN TIDY, and the reason is
 * narrow enough to state exactly.**
 *
 * v1's document-extraction engine is **AWS Textract** (G53). Textract **cannot
 * be a `ModelCatalogEntry`**: that type requires `ModelCapabilities` —
 * `contextWindowTokens`, `maxOutputTokens`, `toolUse`, `structuredOutput` — for
 * which Textract has no analogue, and G54 closes `ModelCatalogEntry.provider`
 * to Bedrock and SageMaker, which Textract is neither. So Textract never
 * reaches `resolveModel()`, and `resolveModel()` is **the only executable
 * enforcement of invariant 7** — residency survives inference, `global.*`
 * routing rejected outright.
 *
 * **Therefore `allowedRegions` on THIS type is the only residency constraint
 * that reaches extraction at all.** `ModelUseConfig.allowedRegions` governs
 * inference and does not govern Textract; the two fields are namesakes and not
 * substitutes. Red team RD-1 corrected the record on exactly this point after
 * G69 had claimed residency now covered extraction — it did not, and this type
 * is what makes the claim true rather than aspirational.
 *
 * **G8 travels with this type and is an ONBOARDING DEPENDENCY, not a runtime
 * one.** The AWS AI-services opt-out is contractual **and** attested, with a
 * four-arm verdict in which both negatives are refusals — so the plane's role
 * needs `organizations:DescribeEffectivePolicy`, which **every customer must
 * grant at onboarding**. A tenant that has not granted it cannot be attested,
 * and `not_determinable` is a refusal, not a shrug. Note also that G8's posture
 * splits within one pipeline: the opt-out applies to Textract and **not** to a
 * self-hosted SageMaker endpoint.
 *
 * 🛑 **THERE IS DELIBERATELY NO `requireImprovementOptOut: boolean` HERE, AND
 * ONE MUST NOT BE ADDED.** A boolean on this config that switches the opt-out
 * check on or off is §5.2 exactly — *a caller-supplied parameter that switches
 * a check off* — and it is the argument the callee could compute itself: the
 * opt-out verdict is derived from `organizations:DescribeEffectivePolicy`
 * against the tenant's own account, not asserted by whoever is authoring the
 * policy. The caller with the strongest motive to pass `false` is the caller
 * whose account has no opt-out in force. Derived, with nothing to omit.
 *
 * Four fields, matching G7's shape as recorded and not widened since.
 */
export interface ManagedServiceUseConfig {
  /**
   * The service features permitted in this tenant — Textract's `AnalyzeDocument`
   * and `DetectDocumentText` are the v1 population.
   *
   * ⚠️ **`string[]` AND NOT `ScopeDimension<string>`, unlike `allowedModels`
   * beside it, and the asymmetry is not an oversight to be tidied away.** The
   * §8.6 inversion applies to a list whose EMPTY state was documented as
   * "platform default set" and therefore failed open. This list has no such
   * documentation and no platform default set: empty means no feature is
   * permitted, which is the safe reading and the only one available. If a
   * resolver is ever written that reads empty as "all", invert this field the
   * day it lands — the bug in `allowedModels` was the resolver, not the type.
   */
  allowedFeatures: string[]
  /**
   * The service call must occur in one of these regions.
   *
   * ⚠️ **THE ONLY RESIDENCY CONSTRAINT ON EXTRACTION IN THE WHOLE MODEL.** Read
   * the banner above before narrowing, widening, or defaulting this field.
   * Nothing downstream of it re-checks; there is no `resolveModel()` on this
   * path to catch a mistake.
   */
  allowedRegions: RegionKey[]
  /**
   * Highest classification permitted to LEAVE for the managed service.
   *
   * The extraction-side sibling of `ModelUseConfig.maxDataClassInPrompt` and of
   * `TelemetryPolicy.maxDataClassInSpanAttributes` — one ceiling per boundary
   * crossed, deliberately, because a single ceiling would force one of the
   * three to be wrong. This one governs a document image or page handed to a
   * third-party service, which is the crossing with the least downstream
   * recourse: once the page is sent, redaction after the fact is not available.
   */
  maxDataClassToService: DataClass
  /**
   * The longest provider-side retention this tenant will tolerate, in days.
   *
   * A NUMBER RATHER THAN A BOOLEAN, unlike `ModelUseConfig.requireZeroRetention`
   * — because a managed service's retention is a published window and not a
   * yes/no, and collapsing it to a flag loses the only fact a compliance
   * reviewer asks for. `0` is the strictest statement and is expressible; there
   * is no sentinel and no null, so "we never decided" is not representable
   * here, which is the point.
   */
  maxProviderRetentionDays: number
}

export interface DataEgressConfig {
  allowExport: boolean
  /**
   * Classifications that MAY be exported. Everything else may not, whatever
   * the role.
   *
   * Was `neverExport: DataClass[]`. The `allowExport: boolean` beside it is the
   * gate people remember to set; this is the one they leave empty, and empty
   * used to mean `sensitive_personal` walks out of the tenant in a CSV.
   */
  exportable: ScopeDimension<DataClass>
  /** Export requires an approval decision. */
  requireApprovalToExport: boolean
  /** Outbound connections permitted from this tenant. */
  allowedDestinations: string[]
}

/** @dropped-for-v1 7 Aug 2026 — no budget enforcement surface in v1; POLICY_KINDS ships five live kinds. Declared, not built. */
export interface SpendConfig {
  /** Evaluated against the billing layer's budgets. */
  budgetId: BudgetId
  onBreach: 'alert' | 'throttle' | 'block'
}

/**
 * Content-level filtering. Maps onto Bedrock Guardrails where available; the
 * config is kept provider-neutral so the platform is not welded to one.
 */
/** @dropped-for-v1 7 Aug 2026 — no provider guardrail is provisioned in v1; POLICY_KINDS ships five live kinds. Declared, not built. */
export interface ContentGuardrailConfig {
  /**
   * Redact these classes from model input.
   *
   * UNAFFECTED by the §8.6 inversion, deliberately. Redaction TRANSFORMS; it
   * does not prohibit. An empty list means "redact nothing", which is a
   * complete statement rather than a missing denial — and inverting it would
   * produce a config whose safe default redacts `public`, which is noise
   * dressed as caution.
   */
  redactInInput: DataClass[]
  /**
   * Classifications that may appear in persisted model output. Output carrying
   * anything else is refused.
   *
   * Was `blockInOutput: DataClass[]`. Same inversion, same reason: a guardrail
   * config that has never been edited must refuse, not wave through.
   */
  permitInOutput: ScopeDimension<DataClass>
  /** Detect and refuse instruction-injection attempts in ingested documents. */
  promptInjectionDetection: boolean
  /**
   * Provider-side guardrail identifier, when one is configured.
   *
   * ⚠️ STAYS BARE (R1). Bedrock mints it. The config above is deliberately
   * provider-neutral; this identifier is not, and branding it would claim
   * ownership of a namespace the whole surrounding type exists to avoid being
   * welded to. Listed in `BareByRule` in `model/identity.ts`.
   */
  providerGuardrailId: string | null
}

export type PolicyConfig =
  | { kind: 'correspondence'; config: CorrespondenceConfig }
  | { kind: 'autonomy'; config: AutonomyConfig }
  | { kind: 'approval'; config: ApprovalConfig }
  | { kind: 'model_use'; config: ModelUseConfig }
  | { kind: 'managed_service_use'; config: ManagedServiceUseConfig }
  | { kind: 'data_egress'; config: DataEgressConfig }
  | { kind: 'spend'; config: SpendConfig }
  | { kind: 'content_guardrail'; config: ContentGuardrailConfig }

/* ------------------------------------------------------------------ *
 * Prohibition, narrowing, and liveness — the claim that replaces
 * "deny is not representable"
 *
 * §8.6 inverted three deny lists (four, with `allowedModels`) and DOCUMENTED
 * the rest, on the argument that what remains is not prohibition at all. That
 * argument is only worth anything if the remainder is enumerated, so here it
 * is, and the enumeration is what surfaces the two dead fields below.
 *
 * THE CLAIM, which is checkable where the old one was not:
 *
 *   Every prohibition is either a NARROWING or the REMOVAL OF AN AUTHORITY.
 *   There are no rules that subtract from a live grant.
 *
 * (The old claim — "deny is not representable" — was true of one function and
 * false of the system, and its looseness is exactly why `User.status` went
 * years unread: a reader told there is nothing to check does not check.)
 *
 * THE NINE AN ACCESS DECISION CONSULTS. Not the whole model — roughly twenty
 * liveness predicates exist across it once leases, entitlements, packs,
 * definitions, connections and policy effectivity windows are counted. "Nine"
 * is the ACCESS-DECISION SUBSET, and quoting the number without that qualifier
 * is how it will be got wrong.
 *
 *   access.ts
 *     1. RoleAssignment.revokedAt      read by decide()
 *     2. Role.status                   read by decide()
 *     3. RoleAssignment.expiresAt      read by decide()   ← was dead
 *   domain.ts
 *     4. User.status                   read by decide()   ← was dead
 *   governance.ts
 *     5. TenantAccessGrant.revokedAt
 *     6. TenantAccessGrant.expiresAt
 *     9. SupportAuthorisation.withdrawnAt   new under §8.5
 *   domain.ts
 *     7. PartnerAccessGrant.revokedAt
 *     8. PartnerAccessGrant.expiresAt
 *
 * TWO OF THESE WERE DEAD UNTIL 5 AUG, and they were the two that bind the
 * HUMAN rather than the grant. `assignmentGrants()` took a `Role` and a
 * `RoleAssignment` and no `User`, so a disabled user's assignments evaluated
 * as granted and `canGrant()` accepted a disabled granter; and
 * `RoleAssignment.expiresAt`
 * nothing compares it to a clock. A time-boxed assignment that never expires
 * is worse than an indefinite one, because someone believed it was bounded.
 *
 * Neither is fixed here: both belong to access.ts. Recorded so the claim above
 * is read as a target with two known gaps rather than a description.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * The policy record
 * ------------------------------------------------------------------ */

/**
 * Policies are per-tenant and customisable. A platform default exists for every
 * kind; a tenant policy overrides it. Partners may publish templates, but a
 * template is only ever a starting point a customer adopts — a partner cannot
 * impose policy on a customer it resells to.
 */
export interface Policy {
  id: PolicyId
  tenantId: TenantId
  name: string
  /**
   * Incremented on every change; a policy is never edited in place.
   *
   * PolicyEvaluation records policyId, and Policy was mutable — so an auditor
   * following the pointer read TODAY's spec, not the one that decided. That
   * defeats the engine's stated purpose: the question is never what the agent
   * did, but why it was allowed to. Explanation already solved this by being
   * stored rather than derived; the lesson had not been transferred.
   */
  version: number
  spec: PolicyConfig
  enabled: boolean
  /**
   * Higher wins where two policies of the same kind apply. Keeps override
   * behaviour explicit rather than depending on insertion order.
   */
  priority: number
  /** Set when this policy was adopted from a partner or platform template. */
  derivedFromTemplate: string | null
  effectiveFrom: Timestamp
  effectiveUntil: Timestamp | null
  createdBy: UserId
}

/** Platform- or partner-authored starting point. Not binding until adopted. */
export interface PolicyTemplate {
  id: string
  name: string
  description: string
  /** Null for platform templates; set when a partner authored it. */
  authoredBy: PartnerId | null
  spec: PolicyConfig
  recommendedFor: DomainKey[]
}

/* ------------------------------------------------------------------ *
 * The policy bundle — what the control plane publishes downward
 *
 * ADDED 7 Aug 2026, closing HANDOFF §8 item 0 — the oldest open item on that
 * list and a live bug rather than a modelling nicety.
 *
 * `SignedPolicyBundle` in `docs/contracts/control-plane.openapi.yaml` declared
 * `defaults` as `{ type: object, additionalProperties: true }` and `templates`
 * as an array of the same, while `PolicyConfig` right here is a discriminated
 * union. So the ONE document in this system that crosses an AWS account
 * boundary, is signed, is verified offline, and is then EVALUATED BY F3 INSIDE
 * THE CUSTOMER'S PLANE was the one document with no schema at all. Signing an
 * unschematised body proves it arrived unaltered; it proves nothing about what
 * it says. A malformed `AutonomyConfig` in a validly signed bundle is a
 * correctly authenticated instruction to widen an autonomy envelope, and the
 * plane has no network to ask us about it.
 *
 * WHY IT WAS CHEAPER TO DO NOW THAN WHEN IT WAS RAISED: five live arms instead
 * of seven, after the v1 trim.
 *
 * SCOPE OF WHAT IS MODELLED HERE, AND WHAT IS DELIBERATELY NOT.
 *
 * The CONTENT is modelled. The ENVELOPE — `signature`, `signingKeyId` — is not,
 * and its absence is a decision rather than an oversight:
 *
 *   · The bug was the content. `signature` and `signingKeyId` were always
 *     `type: string` on the wire and were never the untyped part.
 *   · A signature is a property of surviving an untrusted CHANNEL, not of the
 *     domain object. The contract already places it at the wire layer on
 *     `SignedArtifact` and `SignedAccessGrant`, and this follows them.
 *   · Concretely: a `signingKeyId` here would point at a `SigningKey` row that
 *     does not exist in `model/`. Branding it would mint this repository's
 *     first DANGLING reference edge — currently zero — and leaving it bare
 *     would add a `reference_without_type`, both to model a KMS-minted
 *     identifier that R1 in `model/identity.ts` exempts anyway. Modelling the
 *     key registry is its own decision and is not this one.
 *
 * INVARIANT 3 HOLDS AND IS VISIBLE IN THE SHAPE. Nothing on `PolicyBundle`
 * carries a `TenantId`, a `Policy`, or any tenant-authored value. The control
 * plane publishes downward and never reads tenant data, and a bundle that
 * cannot name a tenant cannot be a read.
 * ------------------------------------------------------------------ */

/**
 * The kinds a v1 bundle may carry.
 *
 * `spend` and `contentGuardrail` are `@dropped-for-v1` on `POLICY_KINDS` —
 * declared, not built. A bundle carrying a default or a template for either
 * would be shipping a rule the plane has no evaluator for, which is worse than
 * shipping nothing: the plane would verify it, load it, and silently fail to
 * apply it.
 *
 * DERIVED BY `Exclude` RATHER THAN RE-LISTED, so restoring a kind on
 * `POLICY_KINDS` is one edit and not two. `Exclude<PolicyKind, 'spend'>`
 * already appears on `EffectivePolicySet.provenance` for a related reason, so
 * this is the established idiom here rather than a new one.
 */
export type LivePolicyKind = Exclude<PolicyKind, 'spend' | 'content_guardrail'>

/** A `PolicyConfig` narrowed to the arms a v1 bundle may carry. */
export type LivePolicyConfig = Extract<PolicyConfig, { kind: LivePolicyKind }>

/**
 * The platform default for every live kind.
 *
 * A TOTAL MAPPED TYPE, NOT A LOOKUP, and that is the whole value of typing this
 * at all. `Policy`'s own doc comment states the rule — *"A platform default
 * exists for every kind; a tenant policy overrides it"* — and a `Partial` or an
 * index signature would let a bundle omit `autonomy` and leave the most
 * consequential guardrail in an agentic product resolving to `undefined` inside
 * a customer's account. Total means a missing kind is a compile error here and
 * a `required` violation on the wire, and a SIXTH kind is a compile error too:
 * restoring `spend` forces someone to state its default rather than ship a
 * bundle that silently has none.
 *
 * Each value is the config for its own kind, projected out of `PolicyConfig`,
 * so the discriminated union stays the single source of the shapes.
 */
export type PolicyDefaults = {
  [K in LivePolicyKind]: Extract<PolicyConfig, { kind: K }>['config']
}

/**
 * A template as it travels in a bundle.
 *
 * `PolicyTemplate` with its `spec` NARROWED — an intersection rather than a
 * second interface, deliberately. Two declarations of one idea drift, and the
 * half that drifts is always the one nobody was looking at; this repo has made
 * that argument twice already (`ProcedureStep.secondApproverAbove`,
 * `ScopeDimension` versus `AssignmentScope`). A field added to `PolicyTemplate`
 * appears here with no edit, and if `LivePolicyKind` ever widens back to all
 * seven the narrowing becomes a no-op on its own.
 */
export type BundledPolicyTemplate = PolicyTemplate & { spec: LivePolicyConfig }

/**
 * Platform-authored material a tenant policy resolves against.
 *
 * NOT A TENANT'S POLICY, and the operation description in the contract is
 * emphatic about why: `Policy` above is tenant-scoped, versioned, and adopted
 * or authored by a tenant admin. It is not ours to distribute and it is not in
 * here. Calling this "policy distribution" is the loose usage in
 * `docs/data-architecture.md` §6 and `docs/byoa-topology.md` §3; the operation
 * is named for the bundle precisely so nobody reads it as us setting a
 * customer's autonomy ceiling remotely.
 */
export interface PolicyBundle {
  /**
   * Monotonic. Appears in every attestation as `policyVersionInForce`, which is
   * how a dispute becomes scopeable to a version.
   *
   * ALSO THE MIGRATION LEVER FOR THIS TYPE. Adding a sixth required key to
   * `PolicyDefaults` is a breaking change to a document already loaded by
   * planes we cannot redeploy — so it is a bundle FORMAT change, announced by
   * this number and refused by the existing `policy_bundle_version_unsupported`
   * error when a plane's schema version predates it. The mechanism exists; this
   * note records that `PolicyDefaults` totality is what will use it.
   */
  bundleVersion: number
  issuedAt: Timestamp
  defaults: PolicyDefaults
  /**
   * Starting points, NOT BINDING UNTIL ADOPTED by a tenant admin.
   *
   * A partner may publish a template; a partner may not impose policy on a
   * customer it resells to, and shipping templates down this channel must never
   * become a way around that. `PolicyTemplate.authoredBy` is what distinguishes
   * the two, and adoption is a tenant act that produces a `Policy` with
   * `derivedFromTemplate` set.
   */
  templates: readonly BundledPolicyTemplate[]
}

/**
 * COMPILE-TIME PROOF THAT THE NARROWING BITES, rather than a comment claiming
 * it does.
 *
 * Verified RED on 7 Aug 2026 before being committed green. Temporarily
 * redefining `LivePolicyKind` as `PolicyKind` produced, verbatim:
 *
 *   model/policy.ts(601,60): error TS2344:
 *     Type 'false' does not satisfy the constraint 'true'.
 *
 * A type assertion nobody has seen fail is an assertion nobody has tested.
 *
 * WHAT IT DOES NOT COVER, because a control that oversells itself is worse than
 * none: the same widening ALSO gave `PolicyDefaults` a `spend` key and a
 * `content_guardrail` key, and that produced NO error — nothing in `model/`
 * constructs a `PolicyDefaults`, so its totality is asserted by the mapped type
 * and witnessed by nothing. The first bundle fixture is what would witness it.
 *
 * Exported for the reason `learning.ts`'s contentlessness assertions are:
 * `noUnusedLocals` is on, and an unexported assertion is deleted by the next
 * person who runs a cleanup pass.
 */
export type _BundleExcludesDroppedKinds =
  [Extract<BundledPolicyTemplate['spec'], { kind: 'spend' | 'content_guardrail' }>] extends [never]
    ? true
    : false

/**
 * Constraint-shaped, for the reason `AssertIdentity` in `model/identity.ts` is:
 * a type alias that merely EVALUATES to `never` compiles perfectly happily and
 * asserts nothing. A generic whose parameter is constrained `extends true` is
 * the only form that actually stops the build.
 */
type AssertTrue<T extends true> = T

/** Fails to compile the moment a dropped kind becomes representable here. */
export type _AssertBundleExcludesDroppedKinds = AssertTrue<_BundleExcludesDroppedKinds>

/* ------------------------------------------------------------------ *
 * Evaluation — the audit surface
 * ------------------------------------------------------------------ */

export type PolicyOutcome = 'allowed' | 'denied' | 'requires_approval' | 'redacted'

/**
 * One recorded policy decision.
 *
 * Written on EVERY evaluation, not only denials. An allow that nobody can
 * evidence is indistinguishable from an absent control during an audit.
 */
/**
 * Why a policy decided as it did.
 *
 * CLOSED, and this was a real bug until 5 Aug. The field was `reason: string`,
 * documented as "human-readable, and shown to the user when something is
 * blocked" — while persistence-design.md §11.2 simultaneously classified
 * PolicyEvaluation as an OPERATIONAL EVENT, PII-free by construction, which is
 * what makes it movable to another store and what makes the record-kind
 * taxonomy hold at all.
 *
 * Both could not be true. A free-text reason shown to a user will contain
 * "invoice INV-4471 from Acme exceeds…" within a week of shipping, and the
 * table stops being PII-free the first time it does.
 *
 * The human-readable sentence is RENDERED from this code at the surface, not
 * stored beside it. That keeps the row PII-free by construction rather than by
 * good intentions, and it survives a restrictive SpanAttributePolicy where free
 * text does not.
 *
 * ⚠️ SECOND VOCABULARY, KNOWN AND UNRECONCILED. `docs/contracts/errors.yaml`
 * carries an `ErrorCode` enum that already spells several of these identically
 * — `admission_role_insufficient`, `admission_class_above_agent_ceiling`,
 * `admitting_step_carries_tools`, `model_residency_violation`, and now
 * `admission_second_person_required`. The overlap is real and is growing by
 * coincidence rather than by decision. Either this type derives from that enum
 * or the two are formally distinct (a policy reason is why a control decided;
 * an error code is what an API returned, and not every reason surfaces as an
 * error). Nobody has chosen. Do not close the gap by quietly renaming one side.
 */
export type PolicyReasonCode =
  | 'permitted'
  | 'platform_default_applied'
  /**
   * The principal's authority was not live at the moment of the decision — a
   * revoked or expired assignment, an archived role, a disabled user, a
   * withdrawn support authorisation. One code for all nine predicates
   * enumerated above, because the surface must not tell an attacker WHICH one
   * failed, and the audit trail records the grant it evaluated anyway.
   */
  | 'principal_not_live'
  /* autonomy */
  | 'autonomy_severity_exceeded'
  /** Was `autonomy_domain_forbidden`. Renamed with `neverAutonomousIn`. */
  | 'autonomy_domain_not_permitted'
  /**
   * ⚠️ DECLARED AND NEVER PRODUCED, and saying so is the point. `mayAutoResolve()`
   * cannot compare `MoneyAmount` against `Money` today — see the money arm there —
   * so no code path in `model/` reaches this member. It is kept because it is the
   * code the arm will produce the day G66 lands, and because deleting it would
   * desynchronise this vocabulary from `errors.yaml`, which is the failure the
   * banner above describes. Do not read its existence as evidence of a working
   * monetary gate.
   */
  | 'autonomy_value_ceiling_exceeded'
  /**
   * The ceiling and the value at risk are in different currencies.
   *
   * Decidable today and actionable by the operator — set the ceiling in the
   * currency the exception is raised in — which is why it is separate from
   * `autonomy_value_ceiling_unevaluable` rather than folded into it. It survives
   * G66 unchanged: collapsing `MoneyAmount` into `Money` does not make a
   * cross-currency comparison possible, it needs an `FxConversion` and both
   * `FxConversion` and `FxPolicy` are `@dropped-for-v1`.
   */
  | 'autonomy_value_currency_mismatch'
  /**
   * A monetary ceiling is stated and the platform cannot evaluate it.
   *
   * §5.3, live: `autoResolveValueCeiling` is `MoneyAmount` (currency +
   * amountMinor) and `Exception.valueAtRisk` is `Money` (currency + amountMinor
   * + exponent). No converting function exists anywhere in `model/`, G66 and
   * G112 have ruled the collapse and NOT applied it, and `reconciliation.ts`'s
   * `sameUnit()` refuses across a differing exponent even when the currencies
   * match — so a currency code does not license a unit assumption here either.
   *
   * REJECTED ALTERNATIVE, recorded rather than dropped: derive the exponent from
   * the currency (2 for SGD, 0 for JPY) and compare `amountMinor` directly. It is
   * arithmetically right for well-formed data and it is still refused, because
   * there is no ISO 4217 table anywhere in this repository to derive it from, so
   * the derivation would be a constant invented at the one call site that spends
   * money. That is §5.7.
   */
  | 'autonomy_value_ceiling_unevaluable'
  /** No amount of good behaviour makes an unrecoverable action safe — G129. */
  | 'autonomy_disposition_irreversible'
  | 'action_not_permitted'
  /* approval */
  | 'approval_required_by_threshold'
  | 'approval_required_by_policy'
  /* classification ceilings — now four, not three */
  | 'class_above_prompt_ceiling'
  | 'class_above_telemetry_ceiling'
  | 'class_above_outbound_ceiling'
  /**
   * §8.4: a digest is a read, pushed to a mailbox nobody here controls. It is
   * the fourth sink with a classification ceiling and had no reason code.
   */
  | 'class_above_notification_ceiling'
  /* egress and models */
  | 'egress_destination_not_permitted'
  /** The inversion of `neverExport`: the class is not on `exportable`. */
  | 'export_class_not_permitted'
  | 'model_not_permitted'
  | 'model_residency_violation'
  /* spend */
  | 'spend_ceiling_exceeded'
  | 'budget_blocked'
  /* content and correspondence */
  | 'content_guardrail_triggered'
  /** The inversion of `blockInOutput`: the class is not on `permitInOutput`. */
  | 'output_class_not_permitted'
  /**
   * ⚠️ NO LONGER PRODUCED. `mayAdmit()` stopped gating on a role ladder on
   * 5 Aug and now returns `capability_not_held` or
   * `admission_org_class_not_permitted`. Retained only because it appears
   * verbatim in errors.yaml; deleting it here would desynchronise the two
   * vocabularies silently, which is the failure the warning above describes.
   */
  | 'admission_role_insufficient'
  | 'admission_class_above_agent_ceiling'
  | 'admitting_step_carries_tools'
  /** Agents may not admit in this tenant at all. */
  | 'admission_agent_not_permitted'
  /** Already in errors.yaml under the same spelling. */
  | 'admission_second_person_required'
  /** The org may not admit, whatever the principal holds. See mayAdmit(). */
  | 'admission_org_class_not_permitted'
  | 'endpoint_unverified'
  /**
   * The principal does not hold the capability the control asked for. Generic
   * on purpose: one code, whatever the capability, so the closed set does not
   * grow by one member per verb.
   */
  | 'capability_not_held'
  /* autonomy proposals — see AutonomyProposal */
  | 'proposal_already_decided'
  | 'proposal_lapsed'
  | 'proposal_decider_not_customer_org'

export interface PolicyEvaluation {
  id: string
  tenantId: TenantId
  at: Timestamp
  /** The policy that decided. Null when a platform default applied. */
  policyId: PolicyId | null
  /** Pins the spec as it stood. Null only when a platform default applied. */
  policyVersion: number | null
  kind: PolicyKind
  outcome: PolicyOutcome
  /**
   * Closed vocabulary. The sentence shown to a user is rendered from this,
   * never stored here — see PolicyReasonCode.
   */
  reason: PolicyReasonCode
  /** What was being attempted. */
  subject: PolicySubject
  /** Set when the decision was made about an autonomous agent action. */
  agentAction: AgentAction | null
}

export type PolicySubject =
  | { type: 'run'; runId: RunId }
  | { type: 'exception'; exceptionId: ExceptionId }
  | { type: 'export'; description: string }
  | { type: 'model_call'; model: string }

/**
 * Resolved policy set for a tenant at a point in time. Computed, not stored —
 * the admin surface shows this so an operator can see what is actually in force
 * rather than reading six overlapping rows.
 */
export interface EffectivePolicySet {
  tenantId: TenantId
  at: Timestamp
  autonomy: AutonomyConfig
  approval: ApprovalConfig
  modelUse: ModelUseConfig
  dataEgress: DataEgressConfig
  contentGuardrail: ContentGuardrailConfig
  /**
   * Which policy supplied each resolved value. Keyed by the kinds actually
   * resolved here — `spend` is delegated to the billing layer and has no
   * resolved config on this type, so it is excluded rather than left as a key
   * nothing can populate.
   */
  provenance: Record<
    Exclude<PolicyKind, 'spend'>,
    { policyId: PolicyId; version: number } | 'platform_default'
  >
}

/* ------------------------------------------------------------------ *
 * Autonomy defaults, per domain
 * ------------------------------------------------------------------ */

/**
 * What autonomous resolution defaults to when a pack is installed.
 *
 * Decided 4 Aug 2026, and deliberately NOT uniform. Auto-resolving a rounding
 * difference on an invoice is the product working; auto-resolving an identity
 * mismatch is a regulatory problem. Defaults differ because the domains differ,
 * and shipping a KYC pack with autonomy enabled on personal-identity findings
 * is the wrong default to have to defend.
 *
 * A tenant may raise these through Policy. It is a default, not a ceiling —
 * the ceiling is AutonomyConfig.autonomousIn, which after §8.6 must NAME the
 * domains rather than name the exceptions.
 *
 * This table is also what governs while an `AutonomyProposal` sits undecided.
 * An undecided proposal changes nothing, so at onboarding these values are the
 * live policy, not a placeholder for one.
 */
export const DEFAULT_AUTONOMY_BY_DOMAIN: Record<DomainKey, Severity | 'none'> = {
  finance: 'low',
  kyc: 'none',
  credit_underwriting: 'none',
  medical_records: 'none',
}

/* ------------------------------------------------------------------ *
 * The third redaction ceiling
 * ------------------------------------------------------------------ */

/**
 * What may leave the tenant in a message to a counterparty.
 *
 * ModelUseConfig.maxDataClassInPrompt governs what reaches a model.
 * TelemetryPolicy.maxDataClassInSpanAttributes governs what reaches a trace.
 * NOTHING governed what reaches a vendor — and that recipient is outside the
 * tenant entirely, which makes this the most consequential of the three and the
 * one PDPA treats as a distinct act.
 *
 * The chase itself needs detail to be useful: "invoice INV-4471 line 3, we
 * received 90 and you billed 100" is the whole point. So this is a ceiling and
 * an approval gate, never a blanket prohibition.
 */
/**
 * Governs BOTH directions, because they are the same trust boundary seen from
 * two sides: outbound is disclosure to a third party, inbound is instruction
 * arriving from one.
 */
export interface CorrespondenceConfig {
  /** Highest classification that may appear in an outbound message. */
  maxDataClassInOutbound: DataClass
  /** Above this class, a named human must approve before it sends. Null = never. */
  requiresApprovalAboveClass: DataClass | null
  permittedChannels: CorrespondenceChannel[]
  /** Whether an agent may send without a human in the loop at all. */
  agentMaySendUnattended: boolean
  /** Refuse to send to an endpoint that has never been verified. */
  requireVerifiedEndpoint: boolean

  /* --- inbound: the admission gate --- */

  /**
   * What a principal must HOLD to admit an inbound message as evidence.
   *
   * Was `minimumRoleToAdmit: RoleKey`, defaulting to `'operator'` — the person
   * already working the exception, which is still the right intent. Routing
   * admission to an approver makes a security decision into a queue, and queues
   * get cleared in bulk without reading, which is exactly the failure the
   * checkpoint exists to prevent.
   *
   * THE LADDER LEAKED, TWO WAYS.
   *
   * A partner clears it. `mayAdmit` excluded `'partner_admin'` from the ordered
   * ladder on the stated ground that a partner "is never the party that decides
   * what to believe" — but `PARTNER_CAPABILITY_MASK.exceptions_operate` clamps
   * a partner to operating capabilities, and the role a partner operates under
   * IS `operator`, which is the ladder's default minimum. The exclusion
   * excluded a string nobody was going to be carrying.
   *
   * And a total order denies everything else. `roleOrder.indexOf()` returns -1
   * for every pack-origin and tenant-origin role, so once roles are composed
   * rather than enumerated, admission is unreachable for any role that is not
   * one of the five platform seeds — a security checkpoint that fails closed on
   * the whole customer estate is not a working checkpoint either.
   *
   * `'admit_correspondence'` exists as its own capability precisely so this
   * gate has something to ask for that survives a pack inventing role names.
   */
  capabilityToAdmit: Capability
  /**
   * Which organisations may admit at all, whatever capability they hold.
   *
   * Gated SEPARATELY from the capability and conjoined with it, because the
   * partner hole is an org-class problem wearing a role costume: a partner
   * operating a customer's queue legitimately needs `propose_resolution` and
   * must never decide what the customer believes about an inbound message.
   *
   * A plain allow-list rather than `ScopeDimension<OrgClass>` — deliberately.
   * `{ kind: 'all' }` would admit `'platform'`, and there is no arrangement
   * under which 1CloudHub staff decide what a customer treats as evidence.
   * An empty list denies everyone, which is the correct empty value.
   * `['customer']` is the default.
   */
  orgClassesThatMayAdmit: OrgClass[]
  /**
   * Whether an agent may admit at all, and up to what classification.
   *
   * A routine "yes, we shorted you ten units" is a different risk from a reply
   * carrying an identity document. Gating on class rather than on job title
   * alone mirrors maxDataClassInPrompt and maxDataClassInSpanAttributes — the
   * same pattern, applied to the one direction that had none.
   */
  agentMayAdmitInbound: boolean
  agentMayAdmitUpToClass: DataClass
  /** Above this class, admission needs a second person. Null = never. */
  secondPersonToAdmitAboveClass: DataClass | null
  /**
   * Whether an agent that admits may also carry tools.
   *
   * FALSE is the safe value and the default. If the reasoning that reads a
   * message is the reasoning that decides whether to trust it, injected text can
   * induce its own admission and the checkpoint has a hole in the middle. With
   * this false, an agent may admit only from a procedure step whose toolScope is
   * empty — the agent that admits is never the agent that acts.
   */
  admittingAgentMayCarryTools: boolean
}

/**
 * May this actor admit this message?
 *
 * A function rather than a comment, for the same reason isAdmissible() is:
 * admission is the single act separating reading a vendor email from obeying
 * one, and a call site that reasons about it independently is the vulnerability.
 *
 * Returns a PolicyReasonCode on refusal so the closed vocabulary can be set
 * from it rather than invented at the call site. It returned `reason: string`
 * while its own comment said it existed to feed a closed vocabulary — the
 * comment described the intended contract and the signature described free
 * text, which is how a "closed" vocabulary acquires members nobody reviewed.
 */
export function mayAdmit(
  cfg: CorrespondenceConfig,
  actor:
    | {
        kind: 'user'
        /** Derived from the identity-provider connection's owner, never stored. */
        orgClass: OrgClass
        /** What the principal actually holds, after scope resolution. */
        capabilities: readonly Capability[]
        /**
         * The nine liveness predicates, already evaluated.
         *
         * Passed rather than recomputed: they live in access.ts, governance.ts
         * and domain.ts, and a policy module that reimplemented them would be
         * the second evaluator this layer exists to avoid. The caller resolves
         * them; this function refuses to proceed without an answer.
         */
        live: boolean
      }
    | { kind: 'agent'; toolScopeSize: number },
  messageClass: DataClass,
  /** True when a second person has already countersigned. */
  secondPersonPresent: boolean,
): { allowed: boolean; reason: PolicyReasonCode } {
  const order: DataClass[] = ['public', 'internal', 'personal', 'sensitive_personal']
  const rank = (c: DataClass): number => order.indexOf(c)

  if (
    cfg.secondPersonToAdmitAboveClass !== null &&
    rank(messageClass) > rank(cfg.secondPersonToAdmitAboveClass) &&
    !secondPersonPresent
  ) {
    return { allowed: false, reason: 'admission_second_person_required' }
  }

  if (actor.kind === 'agent') {
    if (!cfg.agentMayAdmitInbound) {
      return { allowed: false, reason: 'admission_agent_not_permitted' }
    }
    if (rank(messageClass) > rank(cfg.agentMayAdmitUpToClass)) {
      return { allowed: false, reason: 'admission_class_above_agent_ceiling' }
    }
    if (!cfg.admittingAgentMayCarryTools && actor.toolScopeSize > 0) {
      return { allowed: false, reason: 'admitting_step_carries_tools' }
    }
    return { allowed: true, reason: 'permitted' }
  }

  /* Liveness first: an expired authority is not a weaker authority. */
  if (!actor.live) {
    return { allowed: false, reason: 'principal_not_live' }
  }
  /* Org and capability CONJOIN. Either alone was the hole. */
  if (!cfg.orgClassesThatMayAdmit.includes(actor.orgClass)) {
    return { allowed: false, reason: 'admission_org_class_not_permitted' }
  }
  if (!actor.capabilities.includes(cfg.capabilityToAdmit)) {
    return { allowed: false, reason: 'capability_not_held' }
  }
  return { allowed: true, reason: 'permitted' }
}

/* ------------------------------------------------------------------ *
 * Autonomy, measured rather than guessed
 *
 * AutonomyConfig asks a human to pick a severity ceiling and a money limit.
 * Someone picks them at onboarding, and they are never right again — the
 * conditions they were picked under move, and nothing notices.
 *
 * Four dials decide where autonomy should sit. THEY ARE NOT THE SAME KIND OF
 * THING, which is the whole reason this is a loop and not a form:
 *
 *   REVERSIBILITY   declared on the Disposition. Unmeasurable, by nature.
 *   BLAST RADIUS    observed. Value at risk across the window.
 *   FREQUENCY       observed. Exception count across the window.
 *   VERIFIABILITY   inferred from outcomes — reversal rate, evidence rate, and
 *                   how long humans actually took.
 *
 * The output is a RECOMMENDATION, never an applied change. A system that
 * silently widens its own autonomy is the failure this whole layer exists to
 * prevent, and it would be that failure wearing a measurement as a disguise.
 * ------------------------------------------------------------------ */

/** @dropped-for-v1 7 Aug 2026 — recommendAutonomyCeiling() cannot recommend at onboarding — sample size is zero. Declared, not built. */
export interface AutonomyDials {
  /** Declared. The one dial no observation yields. */
  reversibility: Reversibility
  /** Observed: total value at risk across the window, minor units. */
  blastRadiusMinor: number
  /** Observed: exceptions raised for this definition in the window. */
  frequency: number
  /**
   * Inferred: share of auto-resolved outcomes later reversed, 0..1.
   *
   * The honest measure of verifiability. A disposition humans reverse a third
   * of the time was not verifiable, whatever anyone believed when the pack was
   * authored.
   *
   * Counts ONLY reversals where reversalIndictsAutonomy() holds — a resolution
   * undone because the source data was later corrected was the right judgement
   * on what was known, and counting it here would have the loop strangle itself
   * on its own data corrections.
   */
  reversalRate: number
  /**
   * Inferred: median seconds a human took to decide.
   *
   * FAST IS A WARNING, NOT A REASSURANCE. A median of four seconds across a
   * queue means nobody opened the evidence — the green-checkmark failure, made
   * measurable.
   */
  medianDecisionSeconds: number
  /** Share of proposals that carried citable evidence, 0..1. */
  evidenceRate: number
}

/**
 * Why a ceiling was recommended. A closed vocabulary, so the reason survives a
 * restrictive SpanAttributePolicy and can be reported on across the fleet.
 */
/** @dropped-for-v1 7 Aug 2026 — recommendAutonomyCeiling() cannot recommend at onboarding — sample size is zero. Declared, not built. */
export type RecommendationBasis =
  | 'irreversible_disposition'
  | 'high_reversal_rate'
  | 'low_evidence_rate'
  | 'decisions_too_fast'
  | 'high_value_at_risk'
  | 'insufficient_sample'
  | 'stable_and_low_risk'

/**
 * Starting positions, not settled numbers. Recorded as constants so that
 * changing them is a visible act rather than an edit inside a function.
 */
/** @dropped-for-v1 7 Aug 2026 — a widening threshold for a measurement v1 never takes. Declared, not built. */
export const MIN_SAMPLE_TO_WIDEN = 200
/** @dropped-for-v1 7 Aug 2026 — a widening threshold for a measurement v1 never takes. Declared, not built. */
export const MAX_REVERSAL_RATE_TO_WIDEN = 0.02
/** @dropped-for-v1 7 Aug 2026 — a widening threshold for a measurement v1 never takes. Declared, not built. */
export const MIN_EVIDENCE_RATE_TO_WIDEN = 0.9
/** A median faster than this reads as rubber-stamping, not efficiency. */
/** @dropped-for-v1 7 Aug 2026 — a widening threshold for a measurement v1 never takes. Declared, not built. */
export const MIN_DECISION_SECONDS = 20
/** @dropped-for-v1 7 Aug 2026 — a narrowing threshold for a measurement v1 never takes. Declared, not built. */
export const REVERSAL_RATE_TO_NARROW = 0.1

/** none → low → medium → high → critical. Widening moves right. */
const CEILING_LADDER: (Severity | 'none')[] = [
  'none',
  'low',
  'medium',
  'high',
  'critical',
]

/** @dropped-for-v1 7 Aug 2026 — the measured-autonomy loop is unbuilt in v1; the propose-and-approve path stays. Declared, not built. */
export interface AutonomyDecision {
  /** Accepting is as much a decision as overriding, and is recorded the same. */
  outcome: 'accepted' | 'overridden'
  /**
   * A TENANT user. Risk appetite belongs to the party that answers for an
   * auto-resolved exception — a controller, never a delivery engineer. An FDE
   * may propose the initial setting during onboarding; only a tenant role may
   * own it thereafter — and the vehicle for that proposal is `AutonomyProposal`
   * below, which did not exist when this sentence was written.
   */
  decidedBy: UserId
  decidedAt: Timestamp
  /** Required when overriding. Accepting may say nothing. */
  reason: string | null
  /** What was actually set, which may be neither configured nor recommended. */
  ceilingSet: Severity | 'none'
}

/** @dropped-for-v1 7 Aug 2026 — the measured-autonomy loop is unbuilt in v1; the propose-and-approve path stays. Declared, not built. */
export interface AutonomyRecommendation {
  id: string
  tenantId: TenantId
  definitionId: DefinitionId
  /** Null when the recommendation covers the definition as a whole. */
  dispositionKey: string | null
  windowFrom: Timestamp
  windowTo: Timestamp
  /** A recommendation over nine exceptions is not a measurement. */
  sampleSize: number
  dials: AutonomyDials
  configuredCeiling: Severity | 'none'
  recommendedCeiling: Severity | 'none'
  direction: 'widen' | 'narrow' | 'unchanged'
  basis: RecommendationBasis[]
  producedAt: Timestamp
  /** Null until a human has responded. An unanswered recommendation is noise. */
  decision: AutonomyDecision | null
}

/**
 * The recommender.
 *
 * One property matters more than the thresholds: **narrowing is easier than
 * widening.** Evidence of harm narrows on a thin sample; evidence of safety
 * widens only on a thick one. A symmetric rule would let a quiet fortnight
 * argue for more autonomy, which is exactly backwards — absence of observed
 * harm is not evidence of safety when the sample is small.
 */
/** @dropped-for-v1 7 Aug 2026 — structurally cannot recommend at onboarding, where every v1 tenant sits. Declared, not built. */
export function recommendAutonomyCeiling(
  dials: AutonomyDials,
  sampleSize: number,
  configured: Severity | 'none',
): { ceiling: Severity | 'none'; basis: RecommendationBasis[] } {
  const basis: RecommendationBasis[] = []

  /** No amount of good behaviour makes an unrecoverable action safe. */
  if (dials.reversibility === 'irreversible') {
    return { ceiling: 'none', basis: ['irreversible_disposition'] }
  }

  const index = CEILING_LADDER.indexOf(configured)
  const current = index === -1 ? 0 : index

  /* --- narrowing: acts on weak evidence, deliberately --- */
  if (dials.reversalRate >= REVERSAL_RATE_TO_NARROW) basis.push('high_reversal_rate')
  if (dials.evidenceRate < MIN_EVIDENCE_RATE_TO_WIDEN) basis.push('low_evidence_rate')
  if (dials.medianDecisionSeconds < MIN_DECISION_SECONDS) basis.push('decisions_too_fast')

  if (basis.length > 0) {
    const narrowed = CEILING_LADDER[Math.max(0, current - 1)] ?? 'none'
    return { ceiling: narrowed, basis }
  }

  /* --- widening: requires a thick sample and clean signals --- */
  if (sampleSize < MIN_SAMPLE_TO_WIDEN) {
    return { ceiling: configured, basis: ['insufficient_sample'] }
  }
  if (dials.reversalRate > MAX_REVERSAL_RATE_TO_WIDEN) {
    return { ceiling: configured, basis: ['high_reversal_rate'] }
  }
  if (dials.reversibility === 'reversible_with_cost') {
    /* Undoing costs something visible, so hold rather than widen. */
    return { ceiling: configured, basis: ['stable_and_low_risk'] }
  }

  const widened =
    CEILING_LADDER[Math.min(CEILING_LADDER.length - 1, current + 1)] ?? configured
  return { ceiling: widened, basis: ['stable_and_low_risk'] }
}

/* ------------------------------------------------------------------ *
 * The path to a first autonomy setting
 *
 * §10.3 decided that a policy's author is PROVENANCE, not a live authority:
 * once a tenant accepts an autonomy setting it is the tenant's policy, and the
 * author records who wrote it and nothing more. Organisations outlive
 * employees, and requiring a live author would halt a business every time a
 * controller resigned.
 *
 * That decision is only safe if the FDE is NEVER the author. Otherwise: an FDE
 * writes an AutonomyConfig under a 90-day delivery grant, the grant expires on
 * day 91, and scheduled runs keep auto-executing indefinitely under an author
 * with no authority in that tenant. Four of five RunTrigger kinds have no human
 * at the moment of action, so accountability terminates in `Policy.createdBy` —
 * which was a bare UserId, never checked at authoring and never re-checked at
 * execution.
 *
 * SO THIS BECAME BLOCKING, NOT OPTIONAL. §14.7 says an FDE may propose the
 * initial setting and only a tenant role may own it, and there was no vehicle
 * for a proposal at all. The only existing route to a non-default ceiling was
 * `recommendAutonomyCeiling()`, which is a MEASUREMENT OVER OBSERVED OUTCOMES:
 * at onboarding `sampleSize` is 0, it returns `['insufficient_sample']`, and the
 * ceiling stays at `configured`. The one path to a considered autonomy setting
 * ran through a recommender that structurally cannot recommend before there is
 * data — so in practice the setting was made by whoever typed the first config,
 * which is the FDE, which is exactly what §10.3 forbids.
 *
 * FOUR PROPERTIES, and each is a line of type rather than a line of prose:
 *
 *   1. The proposer may be platform staff UNDER A GRANT, or a customer user.
 *      Staff proposing is the point; staff proposing without a live grant is
 *      the delivery-grant hole reopened, so the grant is on the variant.
 *   2. The decider MUST be a customer-org principal. Checked by
 *      mayDecideAutonomyProposal(), not asserted in a comment.
 *   3. An undecided proposal CHANGES NOTHING. Deliberately there is no
 *      resolution function that reads a proposal: until acceptance mints a
 *      Policy, DEFAULT_AUTONOMY_BY_DOMAIN governs, and after it
 *      EffectivePolicySet does. A proposal is never consulted at evaluation
 *      time, which is a stronger guarantee than any check could be.
 *   4. An unanswered proposal LAPSES. An offer that stands forever is a
 *      standing authority nobody granted, and the pending-upgrade problem in
 *      §10.4 already shows what indefinite pending looks like in practice.
 * ------------------------------------------------------------------ */

export type { AutonomyProposalId } from './kernel'

/**
 * Who put the proposal forward. A union rather than a UserId plus a flag,
 * because the grant is only meaningful on one branch and an optional grant
 * field is a field somebody leaves null.
 */
export type AutonomyProposer =
  | {
      kind: 'platform_staff'
      userId: UserId
      /**
       * The live TenantAccessGrant the proposal was made under.
       *
       * Recorded, not merely required: proposing is an act inside the tenant,
       * and an audit asking "under what authority did an FDE touch this" must
       * reach the answer from this row. Expiry of the grant does NOT invalidate
       * an already-accepted proposal — that is §10.3 working as decided; it
       * invalidates further proposing.
       */
      grantId: string
    }
  | { kind: 'customer_user'; userId: UserId }

export interface AutonomyProposalOutcome {
  outcome: 'accepted' | 'rejected'
  /**
   * A CUSTOMER-ORG principal, always. This is the field that makes §10.3 safe.
   */
  decidedBy: UserId
  decidedAt: Timestamp
  /** Required on rejection. Acceptance may say nothing. */
  reason: string | null
  /**
   * The Policy minted on acceptance, whose `createdBy` is `decidedBy` and
   * never the proposer. Null on rejection.
   */
  mintedPolicyId: PolicyId | null
}

export interface AutonomyProposal {
  id: AutonomyProposalId
  tenantId: TenantId
  /** Null when the proposal covers the tenant's autonomy posture as a whole. */
  definitionId: DefinitionId | null
  proposedBy: AutonomyProposer
  proposedAt: Timestamp
  /**
   * The COMPLETE config, so acceptance is a mint rather than an
   * interpretation. A proposal carrying a diff would need a base to apply
   * against, and the base moves.
   */
  proposed: AutonomyConfig
  /**
   * Why. Read by a human before they accept, and the one field here that is
   * legitimately free text — it is written by the proposer, shown to the
   * decider, and never lands in telemetry.
   */
  rationale: string
  /**
   * Required. An unanswered proposal lapses rather than standing as an open
   * offer that a later signature could still convert into live authority.
   */
  lapsesAt: Timestamp
  /** Null until answered. */
  decision: AutonomyProposalOutcome | null
}

/**
 * May this principal decide this proposal?
 *
 * A function for the same reason mayAdmit() is one: a call site reasoning
 * independently about who may set a tenant's risk appetite is the vulnerability,
 * and "only a tenant role may own it" has been a comment since §14.7 was written.
 */
export function mayDecideAutonomyProposal(
  proposal: AutonomyProposal,
  decider: {
    userId: UserId
    /** Derived from the identity-provider connection's owner. */
    orgClass: OrgClass
    capabilities: readonly Capability[]
    /** The nine liveness predicates, already evaluated. See mayAdmit(). */
    live: boolean
  },
  now: Timestamp,
): { allowed: boolean; reason: PolicyReasonCode } {
  if (proposal.decision !== null) {
    return { allowed: false, reason: 'proposal_already_decided' }
  }
  /** ISO-8601 UTC, so lexicographic comparison is chronological. */
  if (now >= proposal.lapsesAt) {
    return { allowed: false, reason: 'proposal_lapsed' }
  }
  if (!decider.live) {
    return { allowed: false, reason: 'principal_not_live' }
  }
  /*
   * Org class before capability, and this order is load-bearing. A partner or
   * an FDE could hold `set_autonomy` through a role composed in the tenant; the
   * org check is what makes that insufficient. It is also why the proposer's
   * own identity is not compared here — an FDE is refused for being platform,
   * not for being the proposer, so a second FDE gains nothing.
   */
  if (decider.orgClass !== 'customer') {
    return { allowed: false, reason: 'proposal_decider_not_customer_org' }
  }
  if (!decider.capabilities.includes('set_autonomy')) {
    return { allowed: false, reason: 'capability_not_held' }
  }
  return { allowed: true, reason: 'permitted' }
}

/**
 * What acceptance mints.
 *
 * The mechanical half of §10.3. `Policy.createdBy` is taken from the DECIDER
 * and the proposer is not reachable from this function's return value at all —
 * so "acceptance mints a Policy whose createdBy is the tenant user" stops being
 * a rule enforced by a comment and becomes a rule enforced by the only
 * construction path.
 *
 * Returns null for an undecided or rejected proposal, because those mint
 * nothing. The remaining Policy fields — id, version, priority, effectivity —
 * belong to whoever writes the row; they are not derivable from a proposal and
 * are deliberately not guessed at here.
 */
export function policyFromAcceptedProposal(
  proposal: AutonomyProposal,
): { tenantId: TenantId; spec: PolicyConfig; createdBy: UserId } | null {
  const decision = proposal.decision
  if (decision === null || decision.outcome !== 'accepted') return null
  return {
    tenantId: proposal.tenantId,
    spec: { kind: 'autonomy', config: proposal.proposed },
    createdBy: decision.decidedBy,
  }
}

/* ------------------------------------------------------------------ *
 * G129 — THE AUTONOMY GATE
 *
 * Until 9 Aug 2026 this layer had an autonomy MODEL and no autonomy GATE.
 * `Disposition.reversibility` carried the sentence *"An irreversible
 * disposition is never a candidate for autonomous execution however well it has
 * behaved"*, and `grep -rn 'reversibility' model/*.ts` returned the
 * declaration, four fixture literals, and NO READER. `AutonomyConfig`'s four
 * dials — `maxAutoResolveSeverity`, `autonomousIn`, `autoResolveValueCeiling`,
 * `permittedActions` — were equally unread. Every one of them was enforced by a
 * comment over zero call sites, which `model/reconciliation.ts` names by its own
 * precedent: *"MAX_GRANT_HOURS's failure again"*.
 *
 * 🛑 THE GATE NOW EXISTS AND HAS NO PRODUCTION CALL SITE. Its only caller today
 * is `tests/model/autonomy-gate.test.ts`. G129 requires that it PASS before any
 * learned rule executes, and the seam that would call it lives in
 * `model/learning.ts` and `model/reconciliation.ts` — neither is changed here.
 * Until that wiring lands the ruling's own fallback governs: **a learned rule
 * may only PROPOSE.** Do not record G129 as applied on the strength of this
 * function existing; that is the exact substitution the ruling was taken against.
 *
 * ORDERING IS THE RULING, NOT AN IMPLEMENTATION DETAIL. Reversibility is read
 * FIRST and refuses UNCONDITIONALLY, before a single dial is consulted, so no
 * combination of dials can buy its way past it. Written as an early return
 * rather than a conjunction for exactly that reason — a conjunction has no
 * order a reader can see and no order a test can pin.
 * ------------------------------------------------------------------ */

/**
 * May this disposition be executed autonomously, with no human in the loop?
 *
 * A function rather than a comment, for the reason `mayAdmit()` and
 * `mayDecideAutonomyProposal()` are functions: a call site that reasons
 * independently about autonomy is the vulnerability, and this is the most
 * consequential of the three.
 *
 * Returns `{ allowed, reason }` and never a bare boolean. A caller handed
 * `false` has half an answer — it cannot tell an operator which dial to move,
 * and it cannot write a `PolicyEvaluation` row without inventing a reason at the
 * call site, which is how a closed vocabulary acquires members nobody reviewed
 * (§5.2, and the reason `mayAdmit()` stopped returning `reason: string`).
 *
 * WHAT THIS FUNCTION IS NOT. It does not decide whether the agent may PROPOSE —
 * that is `AutonomyConfig.mayProposeBeyondLimits`, deliberately not read here,
 * because proposing is not acting and collapsing the two questions into one
 * answer would make a refusal to execute read as a refusal to speak. A caller
 * that gets `allowed: false` and holds `mayProposeBeyondLimits` proposes; the
 * gate has no opinion on that and says so rather than implying one.
 *
 * It also does not evaluate approval, capability, liveness or residency. Those
 * are separate controls with separate reason codes, and a gate that
 * reimplemented them would be the second evaluator this layer exists to avoid.
 */
export function mayAutoResolve(
  cfg: AutonomyConfig,
  /**
   * The whole `Disposition`, not a `Reversibility`. Passing the declared field
   * out of its own record is where a caller starts choosing which reversibility
   * to claim, and `reversibility` is the one dial nothing can observe or
   * cross-check — it is DECLARED by the pack author. The record travels intact
   * so the value the gate reads is the value the pack shipped.
   */
  disposition: Disposition,
  candidate: {
    severity: Severity
    domain: DomainKey
    action: AgentAction
    /** `Exception.valueAtRisk`. Null when nothing monetary is at risk. */
    valueAtRisk: Money | null
  },
): { allowed: boolean; reason: PolicyReasonCode } {
  /*
   * 1. REVERSIBILITY — unconditional, and first.
   *
   * Keyed on `'irreversible'` alone. `'reversible_with_cost'` falls through to
   * the dials deliberately: undoing it costs something visible, which is a
   * reason to set a low ceiling, not a reason to forbid autonomy outright —
   * the same distinction `recommendAutonomyCeiling()` already draws when it
   * holds rather than widens on that value.
   */
  if (disposition.reversibility === 'irreversible') {
    return { allowed: false, reason: 'autonomy_disposition_irreversible' }
  }

  /*
   * 2. SEVERITY. At or below the ceiling, so a ceiling of `'low'` permits
   * `'low'`. `'none'` sits at index 0 and no `Severity` does, so `'none'`
   * refuses everything without needing a case of its own.
   *
   * The `-1` arms are not defensive noise. `Array.indexOf` returning -1 for an
   * unrecognised member is the precise bug the `mayAdmit()` comment records
   * having found in a role ladder, where it silently made the check PERMISSIVE.
   * Here both -1s refuse.
   */
  const ceilingRank = CEILING_LADDER.indexOf(cfg.maxAutoResolveSeverity)
  const askedRank = CEILING_LADDER.indexOf(candidate.severity)
  if (ceilingRank === -1 || askedRank === -1 || askedRank > ceilingRank) {
    return { allowed: false, reason: 'autonomy_severity_exceeded' }
  }

  /*
   * 3. DOMAIN. `{ kind: 'these', values: [] }` authorises autonomy NOWHERE —
   * §8.6's inversion, and the whole point of it. `{ kind: 'all' }` has to have
   * been typed by someone.
   */
  if (
    cfg.autonomousIn.kind === 'these' &&
    !cfg.autonomousIn.values.includes(candidate.domain)
  ) {
    return { allowed: false, reason: 'autonomy_domain_not_permitted' }
  }

  /* 4. ACTION. An empty list permits nothing, which is the correct empty. */
  if (!cfg.permittedActions.includes(candidate.action)) {
    return { allowed: false, reason: 'action_not_permitted' }
  }

  /*
   * 5. VALUE — AND THIS ARM REFUSES RATHER THAN COMPARES. See
   * `autonomy_value_ceiling_unevaluable` above for the full argument and the
   * rejected alternative.
   *
   * A null ceiling is *"no monetary gate"*, which is the field's own documented
   * meaning, so it passes through untouched. A STATED ceiling refuses, because
   * a ceiling nobody can evaluate must not read as a ceiling that was satisfied.
   * The operator sees a named reason and can remove the ceiling deliberately;
   * what they cannot do is get autonomy under a limit the platform only
   * pretended to check.
   *
   * ⚠️ CONSEQUENCE, STATED PLAINLY: setting `autoResolveValueCeiling` today
   * stops autonomy entirely. That is surprising and it is loud, which is the
   * pair of properties fail-closed is supposed to have.
   */
  const valueCeiling = cfg.autoResolveValueCeiling
  if (valueCeiling !== null) {
    if (
      candidate.valueAtRisk !== null &&
      candidate.valueAtRisk.currency !== valueCeiling.currency
    ) {
      return { allowed: false, reason: 'autonomy_value_currency_mismatch' }
    }
    return { allowed: false, reason: 'autonomy_value_ceiling_unevaluable' }
  }

  return { allowed: true, reason: 'permitted' }
}

/* ------------------------------------------------------------------ *
 * THE MANAGED-SERVICE GATE — invariant 7 on the path that never reaches
 * `resolveModel()`
 *
 * Until 9 Aug 2026 `ManagedServiceUseConfig` had ZERO READERS.
 * `grep -rn 'allowedFeatures\|maxDataClassToService\|maxProviderRetentionDays'
 * model/` returned the four declarations above and three fixture literals in
 * `model/examples.ts`, and nothing else — so the most expensive path in the
 * product, extraction via a managed AI service, had no executable residency
 * check of any kind, on a field whose own banner says *"THE ONLY RESIDENCY
 * CONSTRAINT ON EXTRACTION IN THE WHOLE MODEL … Nothing downstream of it
 * re-checks; there is no `resolveModel()` on this path to catch a mistake."*
 *
 * That banner understates it, and the understatement is structural rather than
 * careless. G69/RD-1 establishes that Textract CANNOT be a `ModelCatalogEntry`
 * — it has no analogue for `ModelCapabilities` — and G54/G80b close `provider`
 * to `'bedrock' | 'sagemaker'`, which Textract is neither. **v1's IDP engine
 * therefore never passes `resolveModel()` at all**, so this config is not a
 * second line of defence behind that function; it is the only line there has
 * ever been.
 *
 * 🛑 IT NOW EXISTS AND HAS NO PRODUCTION CALL SITE. Its only caller today is
 * `tests/model/managed-service.test.ts`, because no extraction code exists to
 * call it. **Do not record this as closing the hole** — that is the exact
 * substitution G129's row had to be corrected for, and a second control over
 * zero call sites is not an improvement on the first. The seam that must call
 * it is whatever eventually issues the service request; nothing here reaches it.
 *
 * WHY IT LIVES IN `policy.ts` AND NOT IN `catalog.ts`, which is a real question
 * and was decided rather than defaulted:
 *   · `resolveModel()` is in `catalog.ts` because it RESOLVES AGAINST A
 *     CATALOGUE — its first act is `catalogue.get(modelId)` and its success
 *     value is the entry it found. There is no managed-service catalogue, no
 *     entry to return, and nothing to look up.
 *   · Every input this function reads is a field of `ManagedServiceUseConfig`,
 *     which is declared here. Hosting it in `catalog.ts` would mint a
 *     `catalog → policy` import that exists today in neither direction, purely
 *     to move a function away from its only data.
 *   · `mayAdmit()`, `mayAutoResolve()` and `mayDecideAutonomyProposal()` are
 *     already here on the same principle: the config and the rule that reads it
 *     stay together, so a config change and its evaluator are in one diff.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not evaluate G8's improvement
 * opt-out. That verdict is derived from `organizations:DescribeEffectivePolicy`
 * against the tenant's own account and is an ONBOARDING obligation, not a
 * runtime input — and the banner on `ManagedServiceUseConfig` forbids a
 * `requireImprovementOptOut` flag for exactly the §5.2 reason. Adding a
 * parameter here for it would smuggle in the field that was refused there.
 * ------------------------------------------------------------------ */

/**
 * The `DataClass` ladder, ascending.
 *
 * ⚠️ THIS IS THE THIRD COPY IN `model/` AND SAYING SO IS THE POINT.
 * `learning.ts:1721` holds `DATA_CLASS_RANK`, which is `@dropped-for-v1` and
 * therefore not importable into live code without dragging a dropped export
 * into v1; `mayAdmit()` above holds a fourth as a function-local `order`. That
 * is `docs/HANDOFF.md` §5.3 exactly, and `learning.ts`'s own comment predicted
 * it: *"the rank belongs in one place."* It is NOT unified here, deliberately —
 * `mayAdmit()` has no test file, and rewiring a proven-by-nothing function
 * inside a commit that exists to add a control is how a cleanup rides in on
 * feature work. Unifying the four is owed, as its own commit, with `mayAdmit()`
 * under test first.
 */
const DATA_CLASS_LADDER: DataClass[] = [
  'public',
  'internal',
  'personal',
  'sensitive_personal',
]

/**
 * Why a call to a managed AI service was refused.
 *
 * A REASONED union and never a boolean, for the reason `mayAutoResolve()` and
 * `mayAdmit()` return reason codes (§5.2): a caller handed `false` cannot tell
 * an operator which field to move, and cannot record the refusal without
 * inventing a reason at the call site — which is how a closed vocabulary
 * acquires members nobody reviewed.
 *
 * Each arm carries the value it was measured against, so the refusal is
 * actionable without the caller re-reading the config and re-deriving the
 * comparison — a second evaluator at the call site being the thing this layer
 * exists to prevent.
 */
export type ManagedServiceRejection =
  | { reason: 'feature_not_permitted'; permitted: readonly string[] }
  | { reason: 'region_not_permitted'; permitted: readonly RegionKey[] }
  | { reason: 'class_above_service_ceiling'; ceiling: DataClass }
  | {
      reason: 'provider_retention_exceeds_tolerance'
      /** `maxProviderRetentionDays`, in days. */
      tolerated: number
      /** The provider's published window, in days. */
      offered: number
    }
  /**
   * The retention comparison could not be MADE — either side null, non-finite
   * or negative.
   *
   * A distinct arm rather than folding into the one above, because the two say
   * different things to an operator: one means the provider keeps the page too
   * long, the other means nobody knows how long the provider keeps the page.
   * Collapsing them would report a verified breach where there is an
   * unverified window, and `docs/HANDOFF.md` §5.5 records this codebase already
   * fixing scope that failed OPEN once.
   */
  | { reason: 'provider_retention_unevaluable' }

/**
 * ⚠️ NO ENTRY IS RETURNED ON SUCCESS, unlike `ModelResolution`, and the
 * asymmetry is the honest one: `resolveModel()` returns the catalogue entry it
 * FOUND, and there is nothing to find here. `{ ok: true }` is the whole of the
 * affirmative answer — the call was checked against the tenant's policy and
 * cleared, and any further fact about the service is the caller's.
 */
export type ManagedServiceResolution =
  | { ok: true }
  | { ok: false; rejection: ManagedServiceRejection }

/**
 * May this managed-service call be made, in this region, with this data?
 *
 * FAIL-CLOSED ON EVERY AXIS, and the empty list is the load-bearing case:
 * `allowedFeatures: []` permits NOTHING. That polarity is not a preference —
 * `resolveModel()`'s own comment records `allowedModels` shipping the opposite
 * reading, where an empty list permitted the entire catalogue on the control
 * carrying invariant 7, and residency survived only because `global.*` routing
 * was rejected on a separate line. There is no separate line on this path.
 * `ManagedServiceUseConfig.allowedFeatures` says the same in its own words:
 * *"If a resolver is ever written that reads empty as 'all', invert this field
 * the day it lands."* This is that resolver, and it does not.
 *
 * ORDER OF THE ARMS. Feature, then region, then class, then retention — read as
 * *may this be called at all · may it be called HERE · may THIS leave · may the
 * provider KEEP it*. Unlike G129's ordering, this order is not itself a ruling:
 * the arms are independent, exactly one fires, and no arm can be bought past by
 * another. It is pinned by test so it cannot drift silently, not because a
 * different order would be unsafe.
 */
export function resolveManagedService(
  cfg: ManagedServiceUseConfig,
  call: {
    /** The service feature being invoked, e.g. a document-analysis operation. */
    feature: string
    /** Where the call will actually be made — invariant 7's whole surface here. */
    region: RegionKey
    /** The highest classification present in what is being handed over. */
    dataClass: DataClass
    /**
     * The provider's published retention window, in days. `null` when no window
     * has been established for this service.
     *
     * ⚠️ **THIS IS A STATED FACT, NOT A SWITCH, AND THE DIFFERENCE IS §5.2.**
     * The banner on `ManagedServiceUseConfig` refuses a
     * `requireImprovementOptOut: boolean` because a caller-supplied parameter
     * that switches a check off is the defect shape this codebase catalogues.
     * A window is different in kind — the callee cannot derive AWS's published
     * retention for a service, so somebody must state it — but it is only
     * different if omitting it is impossible and lying about it is visible.
     * Hence: NOT optional, `null` is representable and REFUSES, and a
     * nonsensical number refuses rather than comparing. A caller who wants this
     * gate open must write a number down.
     */
    providerRetentionDays: number | null
  },
): ManagedServiceResolution {
  /*
   * 1. FEATURE. An empty list permits nothing, which is the correct empty and
   * the only one available: the field is a plain `string[]` with no platform
   * default set anywhere.
   */
  if (!cfg.allowedFeatures.includes(call.feature)) {
    return {
      ok: false,
      rejection: { reason: 'feature_not_permitted', permitted: cfg.allowedFeatures },
    }
  }

  /*
   * 2. REGION. The only residency constraint that reaches extraction at all.
   * An empty list permits no region, for the same reason as above and with more
   * riding on it.
   */
  if (!cfg.allowedRegions.includes(call.region)) {
    return {
      ok: false,
      rejection: { reason: 'region_not_permitted', permitted: cfg.allowedRegions },
    }
  }

  /*
   * 3. CLASS. At or below the ceiling, so a ceiling of `personal` permits
   * `personal`.
   *
   * `askedRank === -1` is load-bearing. `Array.indexOf` returning -1 for an
   * unrecognised member is the precise bug `mayAdmit()`'s comment records
   * having found in a role ladder, where it silently made the check PERMISSIVE;
   * without this arm an unrankable class RESOLVES, on the crossing with the
   * least downstream recourse — once the page is sent, redaction after the fact
   * is not available.
   *
   * ⚠️ `ceilingRank === -1` IS NOT, AND SAYING SO IS BETTER THAN IMPLYING IT
   * IS. It is provably unobservable: `ceilingRank === -1` implies
   * `ceilingRank < 0 <= askedRank` for every ranked class, so the third
   * disjunct already refuses, and an unranked class is caught by the second.
   * Deleting it changes no answer for any input, and the test suite does not go
   * red — verified by mutation, recorded as M5b in
   * `tests/model/managed-service.test.ts`. It is KEPT for parity with
   * `mayAutoResolve()` above, whose identical guard is unobservable for exactly
   * the same reason; two sibling gates in one file disagreeing about the shape
   * would cost more than one redundant disjunct. **Do not cite either as
   * evidence that a corrupt ceiling is separately checked.**
   */
  const ceilingRank = DATA_CLASS_LADDER.indexOf(cfg.maxDataClassToService)
  const askedRank = DATA_CLASS_LADDER.indexOf(call.dataClass)
  if (ceilingRank === -1 || askedRank === -1 || askedRank > ceilingRank) {
    return {
      ok: false,
      rejection: {
        reason: 'class_above_service_ceiling',
        ceiling: cfg.maxDataClassToService,
      },
    }
  }

  /*
   * 4. RETENTION — and the unevaluable case is checked BEFORE the comparison,
   * not after it.
   *
   * `NaN > 7` is `false`. A comparison written without this guard reports
   * PERMITTED for a window nobody could evaluate — the residency control
   * failing open on the arm nobody looks at, which is the shape §5.5 records
   * this codebase already fixing once. A negative window is corrupt rather than
   * extra-safe and is refused on the same footing.
   */
  const tolerated = cfg.maxProviderRetentionDays
  const offered = call.providerRetentionDays
  if (
    offered === null ||
    !Number.isFinite(offered) ||
    offered < 0 ||
    !Number.isFinite(tolerated) ||
    tolerated < 0
  ) {
    return { ok: false, rejection: { reason: 'provider_retention_unevaluable' } }
  }
  if (offered > tolerated) {
    return {
      ok: false,
      rejection: { reason: 'provider_retention_exceeds_tolerance', tolerated, offered },
    }
  }

  return { ok: true }
}
