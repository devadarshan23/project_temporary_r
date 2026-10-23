/**
 * ReconcileAI — observability, scoped per tenant and per partner.
 *
 * Platform layer.
 *
 * WHY THIS MODULE EXISTS SEPARATELY
 *
 * Observability is where tenant-isolation designs usually die. Telemetry gets
 * built later, by a different team, under incident pressure, and nobody
 * classifies span attributes. By the time anyone checks, document content is
 * sitting in a trace store that half the company can query.
 *
 * Two independent reviews found the hole on the same day:
 *   - policy.ts has `maxDataClassInPrompt`, which redacts what reaches a model.
 *     NOTHING governed the *trace of* that prompt. Adopting OpenTelemetry
 *     without this ships a redaction bypass.
 *   - Commercial aggregates already invert: given a wholesale rate card (which
 *     the partner necessarily holds, being the party billed), per-tenant money
 *     divides back into document counts, reconciliation counts and — worst —
 *     exception counts. A partner learns a customer's transaction volumes and
 *     failure rates without any PartnerAccessGrant.
 *
 * So the rule here is stronger than "scope it by tenant": each observability
 * plane has its own content AND cardinality rules, because counts leak too.
 *
 * ⚠️ QUALIFIED 5 Aug 2026 — THE SECOND FINDING IS NOT UNIVERSAL. Its whole
 * weight sits on the parenthesis "which the partner necessarily holds, being
 * the party billed", and that is true of a RESELLER only. Under
 * `invoice_end_customer` 1CloudHub invoices the customer directly and the
 * partner is not the billed party; it does not hold the wholesale card by
 * necessity. So stripping counts is:
 *
 *   THEATRE against a reseller       — they can already invert, and volume
 *                                      visibility is inherent to reselling
 *   LOAD-BEARING against a commission partner — they cannot, and disclosing
 *                                      wholesale is exactly what would unlock it
 *
 * This module and billing.ts were never simply unreconciled: each was right
 * about a different arrangement. What follows is the floor that still protects
 * the case where there is something left to protect. See
 * docs/access-and-agency.md §8.8 and PartnerCommercialVisibility in billing.ts.
 */

import { AGGREGATE_COHORT_FLOOR } from './billing.ts'
import type { OrgClass } from './access'
import type {
  DataClass,
  PartnerId,
  RegionKey,
  RunId,
  TenantId,
  TenantScoped,
  Timestamp,
} from './domain'

/**
 * The two telemetry-record ids, 7 Aug (G35). From `./kernel` directly; see the
 * note in `billing.ts` — the ids above arrive by re-export for historical
 * reasons, and a new id has no history to preserve.
 */
import type { PartnerTelemetryAccessId, TraceRefId } from './kernel'

/* SLICE 6 — the reference sweep's targets. Imported from `./kernel` directly
 * rather than through `./domain`: a NEW id has no re-export history to
 * preserve, and routing it through the largest module in the system is the
 * indirection slice 3 was written to end. Re-exported for the same reason the
 * older ids are — a consumer that already reads this module keeps reading it. */
import type {
  PartnerAccessGrantId,
  TenantAccessGrantId,
  UserId,
} from './kernel'
export type {
  PartnerAccessGrantId,
  TenantAccessGrantId,
  UserId,
} from './kernel'

export type { PartnerTelemetryAccessId, TraceRefId } from './kernel'

/* ------------------------------------------------------------------ *
 * Planes
 * ------------------------------------------------------------------ */

/**
 * Who is looking. Each plane answers a different question and is permitted a
 * different amount of truth.
 *
 *   customer — about its own tenant. Full detail; it is their data.
 *   partner  — about the tenants it resold. Operational health only.
 *   platform — 1CloudHub operating the platform. Content-redacted by default.
 *
 * AN ALIAS, NOT A SECOND UNION. This was declared here as
 * `tenant | partner | platform` beside access.ts's `customer | partner |
 * platform`: the same three parties, one word apart, which is where the next
 * RoleKey-style divergence begins — the moment two closed sets over the same
 * domain exist, one of them gains a member.
 *
 * The word that differed was `tenant`, and it named the wrong thing anyway. A
 * plane is the class of the org DOING THE LOOKING, and the org looking at a
 * tenant is a customer. A tenant is not a party; it is what a customer holds.
 *
 * ⚠️ V1 SCOPE, 7 Aug 2026, and it is worth stating because a reader will
 * otherwise count three planes here and expect three surfaces. `TelemetryPlane`
 * is a BARE ALIAS of `OrgClass`, and in v1 two of the three org classes have no
 * surface at all: the partner views below are `@dropped-for-v1` and the platform
 * views with them. So `SpanAttributePolicy.visibleTo` is, in practice, a
 * ONE-VALUED array — `['customer']`. The type is unchanged and the alias is
 * still correct; what is missing is any consumer of the other two values.
 */
export type TelemetryPlane = OrgClass

/* ------------------------------------------------------------------ *
 * Trace references
 * ------------------------------------------------------------------ */

/**
 * A pointer to a trace, held on the work it describes.
 *
 * Deliberately a reference, not embedded spans. Traces live in a telemetry
 * backend with its own retention; the model keeps only the correlation ids so
 * that purging a tenant's data does not require rewriting a trace store.
 */
export interface TraceRef extends TenantScoped {
  /**
   * ADDED 7 Aug (G35). OUR address for the pointer, which is exactly not
   * `traceId`: that string is minted by OpenTelemetry and stays bare for the
   * reason recorded on it — branding a foreign namespace claims an authority we
   * do not have. This row is ours, it outlives the trace it points at (the
   * backend has its own retention), and `region` makes it a residency-bearing
   * record that a purge has to be able to name.
   */
  id: TraceRefId
  /**
   * ⚠️ BOTH STAY BARE (R1). OpenTelemetry mints them, and the distinction is
   * already argued on `id` above: the POINTER ROW is ours and has an address
   * that outlives the trace; these two correlation ids are not ours to brand.
   * Listed in `BareByRule` in `model/identity.ts`.
   */
  traceId: string
  rootSpanId: string
  runId: RunId | null
  startedAt: Timestamp
  /** Where the trace physically lives. Must equal the tenant's residency. */
  region: RegionKey
}

/* ------------------------------------------------------------------ *
 * Policy — what may appear in telemetry
 * ------------------------------------------------------------------ */

/**
 * The control that closes the redaction bypass.
 *
 * `ModelUseConfig.maxDataClassInPrompt` governs what reaches the model.
 * This governs what reaches the trace *of* that call. They must be set
 * together, and this must never be more permissive than that.
 */
export interface TelemetryPolicy extends TenantScoped {
  /**
   * Highest classification permitted in a span attribute. Anything above is
   * replaced with a stable hash so cardinality still works for debugging
   * without the value being present.
   */
  maxDataClassInSpanAttributes: DataClass
  /**
   * Classifications that may not appear even as a hash. Use for identifiers
   * where the hash itself is a correlatable pseudonym across tenants.
   */
  neverInTelemetry: DataClass[]
  /** Sampling for successful runs. Errors are always sampled at 1. */
  successSampleRate: number
  /**
   * Whether exception explanations may be attached to spans. Default false:
   * Explanation.observed carries verbatim extracted values.
   */
  includeExplanations: boolean
  /** Retention in the telemetry backend. Independent of RetentionPolicy. */
  retentionDays: number
}

/**
 * A tenant's own OpenTelemetry destination.
 *
 * Enterprises want traces in their Datadog/Splunk/Grafana, and honouring that
 * is a sales answer as much as an engineering one. It is also a cross-border
 * transfer: exporting to a customer-controlled endpoint moves data out of the
 * residency region, so `acknowledgedTransfer` is required rather than implied.
 */
export interface TelemetryExport extends TenantScoped {
  id: string
  protocol: 'otlp_http' | 'otlp_grpc'
  endpoint: string
  /** Reference only. No field in this model may hold a secret. */
  credentialRef: string
  enabled: boolean
  /**
   * Set when the customer accepted that export leaves the residency region.
   * Null blocks export. See docs/data-governance.md §3.
   */
  acknowledgedTransfer: Timestamp | null
  acknowledgedBy: string | null
}

/* ------------------------------------------------------------------ *
 * The partner plane — deliberately impoverished
 * ------------------------------------------------------------------ */

/**
 * Permitted window lengths, in days.
 *
 * A CLOSED SET, so that a finer window is UNREPRESENTABLE rather than merely
 * rejected somewhere. The floor is the smallest member; there is no runtime
 * check to forget, and no code path that can request an hour.
 *
 * Decided 5 Aug 2026, docs/access-and-agency.md §10.8.
 */
/** @dropped-for-v1 7 Aug 2026 — no partner portal in v1 — zero partner screens are drawn. Declared, not built. */
export const PARTNER_HEALTH_WINDOW_DAYS = {
  week: 7,
  fourWeeks: 28,
  quarter: 91,
} as const
/** @dropped-for-v1 7 Aug 2026 — no partner portal in v1 — zero partner screens are drawn. Declared, not built. */
export type PartnerHealthWindowDays =
  (typeof PARTNER_HEALTH_WINDOW_DAYS)[keyof typeof PARTNER_HEALTH_WINDOW_DAYS]

/** The floor, named. It is `PARTNER_HEALTH_WINDOW_DAYS.week` by construction. */
/** @dropped-for-v1 7 Aug 2026 — no partner portal in v1 — zero partner screens are drawn. Declared, not built. */
export const PARTNER_HEALTH_MIN_WINDOW_DAYS: PartnerHealthWindowDays =
  PARTNER_HEALTH_WINDOW_DAYS.week

/**
 * Whether the tenant is transacting, as a band over the WHOLE window.
 *
 * Replaced `active: boolean` on 5 Aug 2026. The old comment insisted it was "a
 * boolean, never a number", and that held for any single sample — but A BOOLEAN
 * SAMPLED HOURLY FOR A MONTH IS A 720-BIT VOLUME PROXY, carrying close cadence,
 * weekend idleness, month-end spike and outage correlation. Every carefully
 * excluded count walks back in through time resolution; excluding counts while
 * leaving granularity free excluded nothing.
 *
 * A band does not accumulate. It is computed once over the window and says
 * nothing about WHEN inside it, so successive windows at the 7-day floor give
 * roughly four points a month — enough to see an account go quiet, which is
 * what an account manager legitimately needs, and not enough to reconstruct a
 * run schedule.
 */
/** @dropped-for-v1 7 Aug 2026 — no partner portal in v1 — zero partner screens are drawn. Declared, not built. */
export type TenantActivityBand =
  /** No work at all in the window. */
  | 'none'
  /** Work in the window, not across it. */
  | 'intermittent'
  /** Work sustained across the window. */
  | 'sustained'

/**
 * Open support items as a BAND.
 *
 * Was `openSupportItems: number` — a raw count inside a type whose own comment
 * says counts are excluded on purpose. Its justification, "the partner is often
 * the actor", holds when the PARTNER raised the ticket and fails when 1CloudHub
 * or the customer did; and support volume correlates with usage volume, so the
 * count is a weak meter by another name.
 *
 * The partner loses nothing it is entitled to: its OWN tickets are its own
 * record and it sees them in full through the support system, which is where
 * they live. This field is about tickets it did not raise.
 */
/** @dropped-for-v1 7 Aug 2026 — no partner portal in v1 — zero partner screens are drawn. Declared, not built. */
export type SupportLoadBand = 'none' | 'low' | 'elevated' | 'high'

/**
 * What a partner may see about a tenant it resold, WITHOUT a
 * PartnerAccessGrant.
 *
 * This type is defined by what it excludes. A partner supporting customers
 * needs to know whether the platform is working. It does not need to know how
 * much work the customer is doing, and volume is business intelligence about
 * someone else's operation.
 *
 * Against a reseller this is a courtesy, not a control — see the qualification
 * at the top of this module. Against a commission partner it is the control.
 *
 * EXCLUDED ON PURPOSE — do not add these:
 *   - document, run or exception COUNTS (invert to transaction volumes)
 *   - exception RATES as absolute numbers (invert to failure rates)
 *   - definition, pack or cost-centre names (customer-authored, revealing)
 *   - any field value, explanation, or document reference
 *   - token counts (a proxy for volume)
 *   - ANY count at all, support items included: the exception proved the rule
 *   - a window finer than the floor, which turns every band back into a count
 */
/** @dropped-for-v1 7 Aug 2026 — no partner portal in v1 — zero partner screens are drawn. Declared, not built. */
export interface PartnerHealthView {
  partnerId: PartnerId
  tenantId: TenantId
  tenantName: string
  /**
   * Start of the window. The END IS DERIVED from `windowDays` and is not a
   * field: two free timestamps let a caller ask for one hour and label it a
   * week, which is the hole this closes. See partnerHealthWindowEnd().
   */
  windowFrom: Timestamp
  windowDays: PartnerHealthWindowDays
  /** Availability of the platform for this tenant. Ours, not theirs. */
  availability: number
  /** Error rate as a BAND, not a count. Bands do not invert to volumes. */
  errorBand: 'none' | 'low' | 'elevated' | 'high'
  /** Latency percentile, in ms. A performance fact about our service. */
  p95LatencyMs: number
  /** Transacting or not, over the whole window. Never sampled finer. */
  activityBand: TenantActivityBand
  /** Open support items, banded. Operational, and the partner is often the actor. */
  supportLoad: SupportLoadBand
}

/**
 * The end of a health window, derived rather than supplied.
 *
 * Exists so that no caller has to hold two timestamps that could disagree with
 * each other, and so the floor cannot be evaded by narrowing the pair.
 */
/** @dropped-for-v1 7 Aug 2026 — no partner portal in v1 — zero partner screens are drawn. Declared, not built. */
export function partnerHealthWindowEnd(
  windowFrom: Timestamp,
  windowDays: PartnerHealthWindowDays,
): Timestamp {
  return new Date(
    Date.parse(windowFrom) + windowDays * 24 * 60 * 60 * 1000,
  ).toISOString()
}

/**
 * Everything richer than PartnerHealthView requires a grant, and every read
 * under it is audited. Mirrors PartnerAccessScope in domain.ts.
 */
/** @dropped-for-v1 7 Aug 2026 — no partner portal in v1 — zero partner screens are drawn. Declared, not built. */
export interface PartnerTelemetryAccess {
  /**
   * ADDED 7 Aug (G35). This is a row on the ONLY cross-tenant read path
   * (invariant 2), it expires, and it is re-issued — so `(partnerId, tenantId)`
   * recurs by design and an access review asking "under which grant was this
   * trace read?" had nothing to point at. `grantId` names the authorising grant,
   * not this record.
   */
  id: PartnerTelemetryAccessId
  partnerId: PartnerId
  tenantId: TenantId
  /** The grant that authorises anything beyond PartnerHealthView. */
  grantId: PartnerAccessGrantId
  scope: 'health_only' | 'operational_detail' | 'full_traces'
  expiresAt: Timestamp
}

/* ------------------------------------------------------------------ *
 * The platform plane
 * ------------------------------------------------------------------ */

/**
 * 1CloudHub's operational view. Cross-tenant BY CONSTRUCTION, which makes it
 * the most privileged surface in the system and the one most in need of a
 * stated rule.
 *
 * THE RULE: aggregate freely, identify never. Platform operators see system
 * health across all tenants; seeing a specific tenant's content requires a
 * TenantAccessGrant (see docs/tenancy-topology.md §3) exactly as it does
 * anywhere else. Being staff is not access.
 *
 * ⚠️ THE THIRD COHORT SITE. §10.8 named PartnerHealthView and
 * PartnerBillingSummary; this type has the identical defect and was not named.
 * `tenantCount` sits beside figures whose comment reads "Aggregate only. Never
 * a per-tenant breakdown on this surface" — and at `tenantCount: 1` that
 * sentence is false, because the aggregate IS the breakdown. A small region on
 * its first customer turns the most privileged surface in the system into an
 * ungranted per-tenant view.
 */
/** @dropped-for-v1 7 Aug 2026 — at one to three tenants the k-anonymity floor of 5 nulls every figure anyway. Declared, not built. */
export interface PlatformHealthWindow {
  from: Timestamp
  to: Timestamp
  region: RegionKey
  tenantCount: number
  /**
   * Aggregate only. Never a per-tenant breakdown on this surface — which is a
   * claim about the COHORT, not about the field, so all four figures below are
   * NULL when `platformWindowAggregateIsDisclosable(tenantCount)` is false.
   *
   * The cost is real and is the right cost: in a region with fewer than
   * AGGREGATE_COHORT_FLOOR tenants, platform operators get no window at all and
   * must go through a TenantAccessGrant — per tenant, audited, attributable.
   * That is the path the invariant already required; the aggregate was a way
   * around it that happened to look like a dashboard.
   */
  runsTotal: number | null
  errorRate: number | null
  p95LatencyMs: number | null
  /** Model spend in aggregate, for platform margin work. */
  modelSpendMinor: number | null
}

/**
 * Whether a PlatformHealthWindow may carry its aggregate figures.
 *
 * Same floor as a partner summary and deliberately the SAME CONSTANT: a second
 * five declared here is the divergence, not the reuse. The subject differs — a
 * region's tenant cohort rather than a partner's book — but the argument for
 * the number does not, and two floors over one argument end up different.
 */
/** @dropped-for-v1 7 Aug 2026 — at one to three tenants the k-anonymity floor of 5 nulls every figure anyway. Declared, not built. */
export function platformWindowAggregateIsDisclosable(
  tenantCount: number,
): boolean {
  return tenantCount >= AGGREGATE_COHORT_FLOOR
}

/**
 * An operator viewing one tenant's telemetry in detail.
 *
 * Modelled as an event rather than a view, because the important thing is that
 * it happened and is attributable. Content remains redacted per the tenant's
 * TelemetryPolicy even under a support grant — a grant permits looking, not
 * un-redacting.
 */
/** @dropped-for-v1 7 Aug 2026 — no platform inspection surface in v1; support access runs by grant and runbook. Declared, not built. */
export interface PlatformTenantInspection {
  id: string
  tenantId: TenantId
  /**
   * `UserId`, not `string`. It was bare while `AccessSession.staffUserId` two
   * modules over was already `UserId` — the same concept typed two ways, which
   * is the two-vocabularies shape at field scale.
   */
  staffUserId: UserId
  supportGrantId: TenantAccessGrantId
  at: Timestamp
  /** What was looked at, for the customer-facing access report. */
  scope: 'health' | 'traces' | 'trace_detail'
  /** ⚠️ STAYS BARE (R1) — OTel mints it. Listed in `BareByRule` in `model/identity.ts`. */
  traceId: string | null
}

/* ------------------------------------------------------------------ *
 * Cardinality guard
 * ------------------------------------------------------------------ */

/**
 * Attributes permitted on a span, and how each is treated.
 *
 * Exists because the leak is rarely a field called `passport_number`. It is
 * `definition.name`, `cost_center`, `vendor`, or a document filename — all
 * customer-authored, all mundane, all revealing when a partner or a platform
 * operator reads them across tenants.
 *
 * An allow-list, never a deny-list. Anything not named here is dropped.
 */
export interface SpanAttributePolicy {
  attribute: string
  treatment: 'verbatim' | 'hashed' | 'bucketed' | 'dropped'
  /** Planes that may see it at all. */
  visibleTo: TelemetryPlane[]
  /** Classification of the underlying value, driving the default treatment. */
  dataClass: DataClass
}

/* ------------------------------------------------------------------ *
 * Remote Telemetry Collection (Data Plane Pull)
 * ------------------------------------------------------------------ */

/**
 * A pull-based telemetry collection job created by 1CloudHub support staff.
 * 
 * Since the Control Plane cannot push commands to the BYOA Data Plane 
 * (Invariant 1), this row is created centrally. The Data Plane polls for 
 * pending jobs, executes them, applies its local SpanAttributePolicy, and 
 * pushes the redacted bundle back.
 * 
 * NEVER executes without a valid TenantAccessGrant.
 */
export interface DiagnosticJob {
  id: string
  /**
   * The authorization that legally permits this collection. 
   * The Data Plane must verify this grant is still active before executing.
   */
  supportGrantId: TenantAccessGrantId
  /**
   * The run or scope to collect telemetry for.
   */
  targetRunId: string
  
  timeWindowStart: Timestamp
  timeWindowEnd: Timestamp
  
  status: 'pending' | 'executing' | 'complete' | 'failed'
  
  createdAt: Timestamp
  updatedAt: Timestamp
}

/**
 * A reference to the redacted telemetry bundle uploaded by the Data Plane.
 * 
 * The actual payload lives in an S3 bucket (or similar object store) 
 * accessible only to the authorized support staff. This row points to it.
 */
export interface DiagnosticBundleRef {
  id: string
  diagnosticJobId: string
  /** The S3 object key or storage URI containing the bundle. */
  storageUri: string
  
  /** Metadata about what was included in the bundle after redaction. */
  includedClasses: DataClass[]
  
  uploadedAt: Timestamp
}
