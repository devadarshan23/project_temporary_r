/**
 * ReconcileAI — metering, rating, billing and cost governance.
 *
 * Platform layer. See docs/policy-and-billing.md.
 *
 * The separation that keeps this honest:
 *
 *   METERING    what happened          immutable facts, never priced
 *   RATING      what it costs          facts × rate card, recomputable
 *   BILLING     what is owed           periods, invoices, commitments
 *   GOVERNANCE  what is permitted      budgets, quotas, enforcement
 *
 * Collapsing metering into billing is the common mistake. It makes a pricing
 * change rewrite history, makes disputes unresolvable, and makes showback for a
 * customer's internal chargeback impossible. Meters record quantities. Money is
 * always derived.
 */

import type {
  AuthorizationGrantId,
  CommissionBasis,
  DataPlaneId,
  DomainKey,
  PackKey,
  PartnerBillingArrangement,
  PartnerId,
  RunId,
  TenantId,
  Timestamp,
  UserId,
} from './domain'
import type { MoneyAmount } from './policy'

/**
 * `UsageRecord.actorKind` — G387, 19 Sep 2026. **The KIND, never the actor.**
 *
 * Imported from `./governance` rather than restated so that a sixth
 * `AuditActor` variant widens this record and `AUTHORIZATION_MAY_BE_ABSENT`
 * in the same compile, which is the polarity that constant already takes:
 * *"a sixth actor variant is a COMPILE ERROR until somebody decides"*.
 *
 * ⚠️ NOTHING ELSE OF `AuditActor` REACHES THIS MODULE, and the import is
 * type-only and indexed at one field for that reason — the arms carry
 * `userId`, `partnerId`, `supportGrantId` and an agent's `onBehalfOf`, every
 * one of which is a principal identifier and none of which may sit on the one
 * record class that ships to the control plane. See `actorKind`'s own note.
 */
import type { AuditActor } from './governance'

/**
 * The two attestation ids, 7 Aug (G35). FROM `./kernel` DIRECTLY, not through
 * `./domain` — the ids above reach this module by re-export for historical
 * reasons (nothing was re-pointed when they moved), and a NEW id has no such
 * history to preserve. It is declared in the module with no imports of its own
 * and imported from there. Re-exported below so an id sits beside its interface.
 */
import type { CommissionAttestationId, UsageAttestationId } from './kernel'

/* SLICE 6 — the reference sweep's targets. Imported from `./kernel` directly
 * rather than through `./domain`: a NEW id has no re-export history to
 * preserve, and routing it through the largest module in the system is the
 * indirection slice 3 was written to end. Re-exported for the same reason the
 * older ids are — a consumer that already reads this module keeps reading it. */
import type {
  BillingPeriodId,
  BudgetId,
  PartnerAccessGrantId,
  PlanId,
  RateCardId,
  SolutionPackId,
} from './kernel'
export type {
  BillingPeriodId,
  BudgetId,
  PartnerAccessGrantId,
  PlanId,
  RateCardId,
  SolutionPackId,
} from './kernel'

/** @dropped-for-v1 7 Aug 2026 — aliases of dropped types — partner commission and BYOA attestation. Declared, not built. */
export type { CommissionAttestationId, UsageAttestationId } from './kernel'

/* ------------------------------------------------------------------ *
 * Metering — immutable facts
 * ------------------------------------------------------------------ */

/**
 * What the platform counts. Deliberately few: every meter is something a
 * customer can verify independently, and something we would defend in a dispute.
 */
export const METERS = {
  inputTokens: 'input_tokens',
  outputTokens: 'output_tokens',
  documentsProcessed: 'documents_processed',
  pagesExtracted: 'pages_extracted',
  reconciliationsRun: 'reconciliations_run',
  exceptionsRaised: 'exceptions_raised',
  storageGbMonth: 'storage_gb_month',
  apiCalls: 'api_calls',
} as const
export type Meter = (typeof METERS)[keyof typeof METERS]

/**
 * How a meter's samples combine over a period.
 *
 * `storage_gb_month` is a STOCK — a level sampled repeatedly. Summing daily
 * samples over-bills 30x; hourly, 720x. Every other meter here is a FLOW and
 * sums correctly. Nothing recorded the distinction, so the same SUM() served
 * both.
 */
export type MeterAggregation =
  /** Events accumulate. quantity is additive across the period. */
  | 'sum'
  /** A level. The period value is the mean of samples. */
  | 'average'
  /** A level. The period value is the highest sample. */
  | 'peak'

export const METER_AGGREGATION: Record<Meter, MeterAggregation> = {
  input_tokens: 'sum',
  output_tokens: 'sum',
  documents_processed: 'sum',
  pages_extracted: 'sum',
  reconciliations_run: 'sum',
  exceptions_raised: 'sum',
  /** The one stock meter. */
  storage_gb_month: 'average',
  api_calls: 'sum',
}

/**
 * One metered fact. Append-only; never updated, never priced.
 *
 * `costCenter` is what makes enterprise chargeback work: a customer allocates
 * consumption to its own departments without the platform knowing anything
 * about its org chart.
 */
export interface UsageRecord {
  id: string
  tenantId: TenantId
  /**
   * Which plane emitted it. `sequence` below is monotonic PER DATA PLANE, on a
   * record that did not name its plane — so the gap check could not be run, and
   * in hosted the sum of tenant quantities could never be joined to the plane
   * attestation that supposedly covers them. Free now; a fleet-wide backfill
   * later.
   */
  dataPlaneId: DataPlaneId
  /**
   * Deduplication key, taken from the provider's own request id where one
   * exists. At-least-once delivery otherwise double-counts tokens into an
   * append-only table that has no compensating instrument.
   */
  idempotencyKey: string
  /** When the metered event happened. */
  at: Timestamp
  /**
   * When the PLANE recorded it. NOT the billing period key.
   *
   * This said "period assignment uses this" until 5 Aug, when a slice review
   * noticed that on a customer-owned plane `recordedAt` is the CUSTOMER'S
   * clock — so a plane three days slow shifted revenue across a period
   * boundary, into an append-only table with no compensating instrument. The
   * control-plane contract already said `receivedAt` was authoritative; the two
   * documents disagreed about which timestamp produces an invoice.
   */
  recordedAt: Timestamp

  /* --- shipping to the control plane --- */

  /**
   * Monotonic per data plane. Metering is the spine: every billable event is
   * registered centrally at EVENT granularity, not only as a period aggregate,
   * so a gap in this sequence is detectable rather than merely absent.
   *
   * This is safe precisely because UsageRecord is PII-free BY CONSTRUCTION —
   * tenant, meter, quantity, model, cost centre, and no content field at all.
   * Business records (runs, exceptions, documents) do NOT ship; what crosses is
   * that they happened, never what they contain. See docs/day-2-operations.md.
   */
  sequence: number
  /**
   * When the control plane received it. Null while still buffered in a data
   * plane that is offline; replay preserves `sequence` and `recordedAt`.
   *
   * The control plane's copy is the BILLING record. The data plane's is the
   * buffer.
   *
   * AUTHORITATIVE FOR PERIOD ASSIGNMENT. Their clock, our period.
   *
   * ⚠️ Buffered replay is the normal case, so a plane offline across a period
   * boundary lands a backlog in the next period, where it consumes one period's
   * includedQuantity and can tip a PriceTier. OUR DOWNTIME MUST NOT BILL THE
   * CUSTOMER: rating allocates against the period the sequence belongs to,
   * bounded by a replay horizon, and selects the rate card by event time.
   */
  shippedAt: Timestamp | null
  meter: Meter
  /** Integer where the meter is countable; decimals only for storage. */
  quantity: number

  /**
   * THE ACTOR KIND, AND NOTHING ELSE OF THE ACTOR — **G387, 19 Sep 2026,
   * amending G317.** Read this with `authorizationId` below; the two are one
   * rule and neither means what it says alone.
   *
   * 🛑 WHY IT EXISTS. G317 rules that `AUTHORIZATION_MAY_BE_ABSENT` is
   * *"ENFORCED AT THE COLUMN, NOT IN REVIEW"* on all three of invariant 10's
   * streams, because *"a nullable column with a review convention behind it is
   * §5.6 wearing a schema"*. `AuditEvent` and `DataAccessEvent` each carry an
   * `AuditActor`, so `authorizationIsWellFormed()` — which reads `actor.kind`
   * and nothing else — becomes `CHECK (authorization_id IS NOT NULL OR
   * actor_kind = 'system')`. **This record carried no actor at all**, so on
   * one of the three there was nothing for the constraint to key on. G376
   * recorded that as an unclosed gap and refused to invent a repair; G387 is
   * the owner's answer, and it is *"one rule, three tables, no special case"*,
   * taken because **a constraint that holds on two of three records is a
   * constraint a reader will believe holds on three.**
   *
   * ⚠️ IT IS THE KIND AND IT IS NOT AN `AuditActor`, AND THE NARROWNESS IS THE
   * WHOLE RULING RATHER THAN A SIMPLIFICATION. Read
   * `db/migrations/0017_usage_record_actor.sql`'s header before widening this
   * to anything: **an actor KIND is a member of a five-member closed
   * vocabulary and is not a person; an actor ID would be tenant data on a
   * control-plane wire, and that is a different decision the ruling
   * explicitly does not take.** The declaration below already argues the same
   * boundary for the same record — *"an `AuthorizationGrantId` is an opaque
   * scalar that identifies nobody"* and a `UserId` *"would cross the plane
   * boundary on every metered event and break invariant 3"* — and this field
   * is on the opaque side of that line, not an exception to it.
   *
   * ⚠️ TYPED AS `AuditActor['kind']` RATHER THAN RESTATED, deliberately: a
   * sixth actor variant widens this field and `AUTHORIZATION_MAY_BE_ABSENT`
   * together, and a second literal union here would be a second place to
   * drift on the one constant invariant 10 is enforced from.
   *
   * ⚠️ IT IS NOT NULLABLE, and that is not a claim that every row has a human
   * behind it. `system` is the kind for *"genuine machinery — a retention
   * sweep, a scheduler tick"*, which is most of what meters this record
   * today; a nullable kind would reintroduce exactly the discriminant-free
   * column the constraint cannot key on.
   *
   * ⚠️ AND IT IS NOT A ROUTE TO A PRICE. Invariant 5 is unmoved: this record
   * is *"immutable and unpriced"* and `metering` is its own resource class
   * because *"a raw usage record is volume in the clear"*. A kind is not a
   * rate, a total or anything a partner may read, and
   * `tests/db/event-streams.test.ts` §1d still fails on any column whose name
   * looks like money.
   */
  actorKind: AuditActor['kind']

  /* --- attribution, all optional --- */
  /**
   * THE SPINE, AND THE STREAM IT WAS MOST OBVIOUSLY MISSING FROM. Added
   * 5 Aug 2026.
   *
   * This record named a tenant, a plane, a run, a pack, a cost centre and a
   * model, AND NO PRINCIPAL AT ALL. So metering could answer *what did this
   * tenant spend* and *which department should be charged*, and could not
   * answer *who incurred it*. Chargeback worked; accountability did not — and
   * the two are not the same thing. "Cost centre CC-1100 spent SGD 40,000 on
   * inference last month" is an invoice line. "Who authorised the run that
   * spent it, and were they allowed to" was unanswerable from stored rows.
   *
   * A JOIN KEY AND NOT A `UserId`, and this is the decisive constraint rather
   * than a style preference. `UsageRecord` is the one record class that SHIPS TO
   * THE CONTROL PLANE, and it is safe to ship precisely because it is "PII-free
   * BY CONSTRUCTION — tenant, meter, quantity, model, cost centre, and no
   * content field at all". A `UserId` is a principal identifier: putting one
   * here would cross the plane boundary on every metered event and break
   * invariant 3, the control plane never reads tenant data. An
   * `AuthorizationGrantId` is an opaque scalar that identifies nobody — the
   * same argument `ChainAnchor` makes for shipping a head hash and nothing else.
   *
   * The authorisation row stays in the DATA plane, where the principal is, and
   * the control plane holds a key it cannot resolve. Attribution therefore works
   * where it is legitimate (inside the tenant, for the tenant's own chargeback
   * and for an audit) and does not work where it would be a leak.
   *
   * NULL IS LEGITIMATE FOR MACHINE-ORIGINATED CONSUMPTION — a retention sweep's
   * storage sample, a scheduled re-index — matching
   * `AUTHORIZATION_MAY_BE_ABSENT.system` in governance.ts. `storage_gb_month` is
   * the standing example: it is a STOCK sampled on a timer, and no principal
   * incurred any particular sample.
   *
   * ⚠️ NOT BACKFILLABLE. Every record written before this field existed carries
   * null and is indistinguishable from a legitimate machine sample. The cut-over
   * date is the only thing separating them, and it is not on the row.
   */
  authorizationId: AuthorizationGrantId | null
  runId: RunId | null
  domain: DomainKey | null
  packId: SolutionPackId | null
  /**
   * Customer-defined allocation tag. Opaque to the platform.
   *
   * Immutable once its billing period closes — re-tagging after close would
   * silently rewrite a customer's chargeback history. Enforced against
   * BillingPeriod.status, not by convention.
   */
  costCenter: string | null
  /** Set at close. Non-null means the attribution is frozen. */
  tagsLockedAt: Timestamp | null
  /** Which model incurred token usage, for model-level cost analysis. */
  model: string | null
}

/* ------------------------------------------------------------------ *
 * Rating — facts become money
 * ------------------------------------------------------------------ */

/** @dropped-for-v1 7 Aug 2026 — PRODUCT.md forbids fabricating pricing; a populated rate card in v1 could only be fabricated. Declared, not built. */
export interface MeterPrice {
  meter: Meter
  /** Price per unit in minor units. */
  unitPriceMinor: number
  /** Units included before charging begins. */
  includedQuantity: number
  /** Optional volume tiers, applied in order. */
  tiers: PriceTier[]
}

/** @dropped-for-v1 7 Aug 2026 — PRODUCT.md forbids fabricating pricing; a populated rate card in v1 could only be fabricated. Declared, not built. */
export interface PriceTier {
  upToQuantity: number | null
  unitPriceMinor: number
}

/**
 * A rate card converts usage into money.
 *
 * Two rate cards exist on a partner-sold tenant: the WHOLESALE card 1CloudHub
 * charges the partner, and the RETAIL card the partner charges its customer.
 * The difference is the partner's margin, and the partner sets its own retail
 * card. This is the core reseller economic, and it is why rating is separate
 * from metering — the same facts are priced twice.
 */
/** @dropped-for-v1 7 Aug 2026 — PRODUCT.md forbids fabricating pricing; a populated rate card in v1 could only be fabricated. Declared, not built. */
export interface RateCard {
  /** BRANDED 7 Aug, slice 6, with `Plan.rateCardId` and `RatedTotal.rateCardId`. */
  id: RateCardId
  name: string
  currency: string
  prices: MeterPrice[]
  /** Null for platform/wholesale cards; set for a partner's retail card. */
  ownedBy: PartnerId | null
  kind: 'wholesale' | 'retail'
  effectiveFrom: Timestamp
  effectiveUntil: Timestamp | null
}

/* ------------------------------------------------------------------ *
 * Billing
 * ------------------------------------------------------------------ */

export interface Plan {
  /** BRANDED 7 Aug, slice 6, with `Subscription.planId`. */
  id: PlanId
  name: string
  /** Entitlements gate features; rate cards price consumption. */
  entitlements: Entitlement[]
  rateCardId: RateCardId
}

/**
 * What a tenant is allowed to have, as distinct from what it is charged for.
 * A pack the tenant is not entitled to cannot be installed at any price.
 */
export interface Entitlement {
  key: EntitlementKey
  /** Null = unlimited. */
  limit: number | null
}

export const ENTITLEMENT_KEYS = {
  packsInstalled: 'packs_installed',
  seats: 'seats',
  definitions: 'definitions',
  connections: 'connections',
  retentionDaysMax: 'retention_days_max',
  partnerAccess: 'partner_access',
  customPolicies: 'custom_policies',
} as const
export type EntitlementKey =
  (typeof ENTITLEMENT_KEYS)[keyof typeof ENTITLEMENT_KEYS]

export interface Subscription {
  id: string
  tenantId: TenantId
  planId: PlanId
  /** Overrides the plan's card where a deal was negotiated. */
  rateCardIdOverride: RateCardId | null
  startedAt: Timestamp
  endsAt: Timestamp | null
  /** Minimum spend per period, if committed. Enterprise deals usually have one. */
  commitmentMinor: number | null
  billingPeriod: 'monthly' | 'quarterly' | 'annual'
}

/** @dropped-for-v1 7 Aug 2026 — no invoicing in v1 — there is nothing to close a period against. Declared, not built. */
export interface BillingPeriod {
  /**
   * BRANDED 7 Aug, slice 6, with the six `periodId` fields that name it.
   *
   * ⚠️ NOT `ReconciliationPeriodId`. Both were `periodId: string` and nothing
   * distinguished them: this is what WE invoice against; the other is the
   * CUSTOMER's accounting close. Different parties set them, different
   * calendars close them, and until this slice either could be written where
   * the other was meant.
   */
  id: BillingPeriodId
  tenantId: TenantId
  from: Timestamp
  to: Timestamp
  status: 'open' | 'pending_review' | 'finalised'
  /** Set only once finalised. Recomputable from UsageRecords until then. */
  totals: RatedTotal[] | null
  finalisedAt: Timestamp | null
}

/** @dropped-for-v1 7 Aug 2026 — no invoicing in v1 — money is derived from a rate card that does not exist. Declared, not built. */
export interface RatedTotal {
  meter: Meter
  /**
   * How the quantity was formed. METER_AGGREGATION had ZERO call sites —
   * defined, documented, referenced by nothing — while existing solely to stop
   * `storage_gb_month` being summed, which over-bills 720x on hourly samples.
   * An aggregation the invoice cannot state is one nobody can dispute.
   */
  aggregation: MeterAggregation
  quantity: number
  amount: MoneyAmount
  /** Which card produced this figure, so an invoice can be explained. */
  rateCardId: RateCardId
}

/* ------------------------------------------------------------------ *
 * Cost governance — what enterprises actually ask for
 * ------------------------------------------------------------------ */

/**
 * A spend ceiling with an enforcement stance.
 *
 * `enforcement` is the field that matters. Enterprises ask for hard caps and
 * then discover a hard cap means the platform stops mid-close. Offering the
 * three modes explicitly forces that conversation at configuration time rather
 * than at incident time.
 */
export interface Budget {
  /** BRANDED 7 Aug, slice 6, with `BudgetAlert.budgetId` and `SpendConfig.budgetId`. */
  id: BudgetId
  tenantId: TenantId
  name: string
  scope: BudgetScope
  limit: MoneyAmount
  period: 'daily' | 'monthly' | 'quarterly' | 'annual'
  /**
   * alert    — notify only; work continues
   * throttle — reduce concurrency and defer non-urgent work
   * block    — refuse new work. Requires an explicit accepted-risk ack.
   */
  enforcement: 'alert' | 'throttle' | 'block'
  /** Fractions of the limit at which to notify, e.g. [0.5, 0.8, 1.0]. */
  alertThresholds: number[]
  notifyUserIds: UserId[]
}

export type BudgetScope =
  | { type: 'tenant' }
  | { type: 'cost_center'; costCenter: string }
  | { type: 'domain'; domain: DomainKey }
  | { type: 'meter'; meter: Meter }

/** Raised when a threshold is crossed. Retained as the record of a decision. */
export interface BudgetAlert {
  id: string
  tenantId: TenantId
  budgetId: BudgetId
  at: Timestamp
  thresholdCrossed: number
  spendAtAlert: MoneyAmount
  actionTaken: 'notified' | 'throttled' | 'blocked'
  acknowledgedBy: UserId | null
  acknowledgedAt: Timestamp | null
}

/**
 * Cost attributed to a slice of consumption. Derived, cached for reporting.
 *
 * The enterprise question is never "what is our bill" — it is "which department,
 * which process, which document type is driving it". Attribution answers that
 * without exposing another tenant's data or the platform's own margins.
 */
/** @dropped-for-v1 7 Aug 2026 — the cost-centre rollup has no screen and no operation in v1. Declared, not built. */
export interface CostAttribution {
  tenantId: TenantId
  periodId: BillingPeriodId
  dimension: 'cost_center' | 'domain' | 'pack' | 'model' | 'definition'
  key: string
  quantity: Record<Meter, number>
  amount: MoneyAmount
}

/**
 * What a partner sees across the tenants it resells to.
 *
 * Deliberately aggregate: commercial metadata only, no reconciliation content.
 * A partner sees what a customer costs and what it owes, never what the customer
 * is reconciling — unless a PartnerAccessGrant exists. See
 * docs/data-governance.md §5.
 *
 * ⚠️ AGGREGATION IS NOT A CONTROL BELOW A COHORT SIZE. `tenantCount` has always
 * sat in this type beside a partner-level `wholesale`, and at `tenantCount: 1`
 * the aggregate IS the per-tenant line — the summary hands over exactly what
 * shaping `perTenant` was written to withhold, and at 2 it is one subtraction
 * away. The field to test was already here. See AGGREGATE_COHORT_FLOOR.
 */
/** @dropped-for-v1 7 Aug 2026 — no partner portal in v1, and P4 (who invoices end customers) is undecided. Declared, not built. */
export interface PartnerBillingSummary {
  partnerId: PartnerId
  periodId: BillingPeriodId
  tenantCount: number
  /**
   * The verdict this summary was shaped under.
   *
   * Carried, not left to the reader to recompute: a summary that does not state
   * its own verdict cannot be checked against the lines it contains.
   */
  visibility: PartnerCommercialVisibility
  /**
   * What 1CloudHub charges the partner.
   *
   * Null in two different cases. Below AGGREGATE_COHORT_FLOOR it is SUPPRESSED.
   * Under every commission verdict it DOES NOT EXIST — 1CloudHub invoices the
   * customer, the partner is not the billed party, and this figure would be the
   * customer's own spend wearing the partner's label.
   */
  wholesale: MoneyAmount | null
  /**
   * What the partner charges its customers, where it uses our retail cards.
   * Null under a commission arrangement: there is no partner retail card.
   */
  retail: MoneyAmount | null
  /**
   * retail − wholesale. Null when the partner bills outside the platform, and
   * null whenever `wholesale` is — a margin beside a retail card is a wholesale
   * figure by subtraction, and suppressing one half of a pair suppresses
   * nothing.
   */
  margin: MoneyAmount | null
  /** What the partner is owed under a commission arrangement. Null for a reseller. */
  commission: MoneyAmount | null
  perTenant: PartnerTenantLine[]
}

/**
 * What a unit of consumption actually cost 1CloudHub.
 *
 * Nothing in the model recorded this. PartnerBillingSummary.margin is the
 * PARTNER's margin, shown to the partner; wholesale minus provider cost
 * appeared nowhere. Combined with self-reported metering never reconciled
 * against the provider bill, and commitmentMinor locking a rate for a year,
 * the failure mode is a healthy dashboard with negative contribution per token.
 *
 * Not reconstructable later: UsageRecord is recoverable, a provider bill never
 * captured against a period is not.
 */
/** @dropped-for-v1 7 Aug 2026 — platform margin has no surface in v1. Declared, not built. */
export interface ProviderCostRecord {
  id: string
  periodId: BillingPeriodId
  provider: 'bedrock' | 'aws_other' | 'third_party'
  /** Model or service identifier as the provider bills it. */
  resource: string
  region: string
  /** As invoiced by the provider. */
  quantity: number
  meter: Meter | null
  costMinor: number
  currency: string
}

/**
 * Metered versus billed, per model per period. The gap is the answer to
 * "is our metering honest?" — system-prompt overhead, retries, cache writes and
 * scorer spend all go unmetered by default.
 */
/** @dropped-for-v1 7 Aug 2026 — platform margin has no surface in v1. Declared, not built. */
export interface CostReconciliation {
  periodId: BillingPeriodId
  resource: string
  meteredQuantity: number
  providerQuantity: number
  /** providerQuantity - meteredQuantity. Positive means we under-metered. */
  variance: number
  varianceRatio: number
  investigatedBy: UserId | null
  note: string | null
}

/** Revenue minus cost of goods, which is the only margin that is ours. */
/** @dropped-for-v1 7 Aug 2026 — platform margin has no surface in v1. Declared, not built. */
export interface PlatformMarginLine {
  periodId: BillingPeriodId
  tenantId: TenantId
  revenueMinor: number
  providerCostMinor: number
  /** revenue - providerCost. Negative is the condition worth alerting on. */
  contributionMinor: number
  currency: string
}

/* ------------------------------------------------------------------ *
 * Customer-owned data planes — entitlement and attestation
 *
 * Metering in an account we do not control. The problem the two types below
 * solve together is not duplication (idempotencyKey handles that) but TRUST:
 * a plane could under-report, and more likely agents fail, clocks skew and
 * records are lost.
 *
 * The floor-versus-hot-path conflict: a control-plane-observed floor only
 * bounds usage if the control plane is called in PROPORTION to billable
 * volume — but no synchronous control-plane call is permitted on the
 * reconciliation hot path (latency, an availability dependency the customer
 * did not buy, and request metadata we claimed not to hold). If policy is
 * fetched daily and cached, the floor tells you nothing.
 *
 * EntitlementLease resolves it. A signed, time-boxed quota drawn down locally
 * gives a hard upper bound with no hot-path call, and is simultaneously the
 * non-payment lever and the degradation ladder. UsageAttestation reports
 * against it. Neither figure is trustworthy alone; each constrains the other
 * from the opposite direction.
 *
 * See docs/day-2-operations.md §4.
 * ------------------------------------------------------------------ */

/**
 * A signed grant of capacity, verified offline by the data plane.
 *
 * ⚠️ DISCLOSURE IS LOAD-BEARING. This is a licence lease and it functions as a
 * kill switch. Disclosed in the contract, in the documentation and in the
 * product — with expiry warnings well ahead of the date — it is unremarkable
 * commercial machinery. Discovered rather than disclosed, it is the story that
 * ends the partnership.
 */
/** @dropped-for-v1 7 Aug 2026 — G36 — BYOA slips to v1+1; 1CloudHub-hosted only, so there is no lease to issue. Declared, not built. */
export interface EntitlementLease {
  id: string
  dataPlaneId: DataPlaneId
  tenantId: TenantId
  /** Monotonic per data plane. The plane refuses a lease older than its current. */
  sequence: number

  issuedAt: Timestamp
  notBefore: Timestamp
  expiresAt: Timestamp

  /**
   * The COMMERCIAL limit — what the customer contracted for.
   *
   * Exceeding this warns and bills overage. It never stops work.
   */
  tierCeilings: Record<Meter, number>

  /**
   * The RUNAWAY GUARD — a multiple of tierCeilings. Exceeding it means
   * something is wrong, and the plane stops accepting new work.
   *
   * TWO NUMBERS ON PURPOSE, decided 4 Aug 2026. Setting them equal would block
   * a regulated customer's month-end close over a billing threshold, and would
   * contradict the rule that in-flight work always completes. Keeping them
   * apart preserves the hard bound that makes metering defensible while leaving
   * the commercial limit soft, which is where softness belongs.
   *
   * Meters that are `reported` rather than `priced` in this deployment mode
   * still carry a guard — an unbounded token count in a customer's account is
   * their cost exposure, and a runaway is worth stopping even when we do not
   * bill for it.
   */
  ceilings: Record<Meter, number>

  /** The multiple used to derive `ceilings`, recorded so it is auditable. */
  ceilingMultiple: number

  /**
   * Hours after expiry during which in-flight work completes and new work
   * warns. Expiry is a grace period, never a stop: halting mid-run wastes
   * spend already incurred and entitlement already drawn.
   */
  graceHours: number

  /** Control-plane signature. The data plane verifies this with no network. */
  signature: string
  /** Null for an automated renewal. */
  issuedBy: UserId | null

  /**
   * Revocation is best-effort by construction.
   *
   * An offline-verifiable lease cannot learn it was revoked while offline. This
   * takes effect at the plane's next successful control-plane contact, or at
   * expiry, whichever comes first. Stated rather than glossed: the guarantee is
   * "no more than the ceiling, and not past expiry", not "stops on command".
   */
  revokedAt: Timestamp | null
  revocationReason: string | null
}

/**
 * A signed claim from a data plane about what it did.
 *
 * Aggregate counts only — no content, no identifiers, no per-run detail. The
 * chain is what makes the series checkable: totals with a signature prove only
 * that we received what they sent, whereas a chained series makes a missing
 * period DETECTABLE rather than merely absent, breaks under back-dating, and
 * exposes a plane that resets its counters.
 *
 * Cannot be retrofitted. A series already signed without a chain cannot acquire
 * one retroactively.
 */
/** @dropped-for-v1 7 Aug 2026 — G36 — BYOA slips to v1+1; a hosted plane does not attest to itself. Declared, not built. */
export interface UsageAttestation {
  /**
   * ADDED 7 Aug (G35). `(dataPlaneId, sequence)` identifies it and always did —
   * this is a surrogate, and it earns its place on the dispute path: a failed
   * attestation is RETAINED as evidence (see `verificationFailure` below), and
   * evidence that cannot be cited by a stable reference is evidence in name
   * only. A resubmitted period must not reuse the address of the one it
   * replaced.
   */
  id: UsageAttestationId
  dataPlaneId: DataPlaneId
  /** Monotonic per plane, from 1. A gap is a missing period, not an absence. */
  sequence: number
  /** Hash of the previous attestation's body. Null only at sequence 1. */
  previousAttestationHash: string | null
  /** Hash of this attestation's canonical body; the next one chains to it. */
  bodyHash: string

  periodFrom: Timestamp
  periodTo: Timestamp

  /** Zero totals are a legitimate, meaningful value: the plane was idle. */
  totals: Record<Meter, number>
  /**
   * Per-meter drawdown high-water mark against the current lease.
   *
   * THE LEASE WAS AN HONOUR SYSTEM WITHOUT THIS. The signature proves the
   * ceiling NUMBER is authentic and proves nothing about the COUNTER, which
   * lives in an account the customer holds root over — and was never reported
   * upward at all, since the heartbeat carried lease identity and never lease
   * consumption. The two figures meant to constrain each other from opposite
   * directions were the same figure.
   *
   * Cross-checked against the shipped event sum. It is the only quantity an
   * operator with root cannot understate without perjuring a KMS key.
   */
  drawdownHighWater: Record<Meter, number>

  /** What was in force, so a dispute is scopeable to a version. */
  policyVersionInForce: number
  /**
   * G224, 22 Aug 2026 — KEYED ON THE CLOSED VOCABULARY, not on `string`.
   *
   * `Partial` and not a total `Record`, and the difference is the point: a
   * plane reports the packs it actually runs, and an absent key is "not
   * installed" rather than "installed at version zero". That is the opposite
   * of `totals` two fields up, which IS total because a zero total is a
   * meaningful fact the plane is asserting — it was idle and said so.
   */
  packVersionsInForce: Partial<Record<PackKey, number>>
  engineVersion: string

  /** Signature over bodyHash, by the key in DataPlane.attestationPublicKey. */
  signature: string

  /**
   * OUR receipt time. Period assignment uses this, never periodTo — the plane's
   * clock is theirs, and a buffered replay arrives late by design. Mirrors
   * UsageRecord.recordedAt, which exists for the same reason.
   */
  receivedAt: Timestamp
  verifiedAt: Timestamp | null
  /**
   * Set when verification failed. A failed attestation is RETAINED, never
   * discarded — it is evidence, and discarding it would erase the only trace of
   * the thing most worth investigating.
   */
  verificationFailure: string | null
}

/**
 * A signed commission figure, WITHOUT the base it was computed from.
 *
 * UsageAttestation pointed the other way: a plane we do not control signs what
 * it did, and we check it. Here 1CloudHub signs "your commission for period P
 * is X" and the PARTNER checks it. Same machinery — signature, monotonic
 * sequence, hash chain — aimed in the opposite direction, and it is what makes
 * a commission scalar auditable without opening the customer's spend. A dispute
 * opens the base under a PartnerAccessGrant: once, scoped, audited.
 * VERIFY WITHOUT SEEING.
 *
 * ⚠️ The PATTERN transfers; the TYPE does not. UsageAttestation.totals is a
 * `Record<Meter, number>` — volume in the clear, which is precisely the
 * quantity this type exists to withhold. Do not reach for it as a base, and do
 * not add a totals field here on the grounds that the other attestation has
 * one.
 *
 * Like its counterpart, the chain cannot be retrofitted: a commission series
 * already signed without one cannot acquire it retroactively.
 */
/** @dropped-for-v1 7 Aug 2026 — no partner commission in v1; P4 is undecided. Declared, not built. */
export interface CommissionAttestation {
  /**
   * ADDED 7 Aug (G35). The dispute path is the argument, as on its counterpart:
   * *"a dispute opens the base under a PartnerAccessGrant: once, scoped,
   * audited"*, and the grant has to name WHAT is disputed. A partner-period pair
   * does not survive a reissue; an address does.
   */
  id: CommissionAttestationId
  partnerId: PartnerId
  /** Monotonic per partner, from 1. A gap is a missing period, not an absence. */
  sequence: number
  /** Hash of the previous attestation's body. Null only at sequence 1. */
  previousAttestationHash: string | null
  /** Hash of this attestation's canonical body; the next one chains to it. */
  bodyHash: string

  periodId: BillingPeriodId
  periodFrom: Timestamp
  periodTo: Timestamp

  /**
   * How the figure was computed, so the partner can check the arithmetic it is
   * entitled to check — and so a reader can tell which fields below are the
   * whole of that arithmetic and which are absent by design.
   */
  basis: CommissionBasis
  /**
   * THE ONLY MONEY FIGURE HERE, and under `per_tenant_fixed` or `banded` it
   * appears without any base at all.
   */
  commission: MoneyAmount
  /**
   * The partner's own book for the period. Not a customer disclosure — the
   * partner sold these tenants — and under `per_tenant_fixed` it is the entire
   * computation alongside the fee.
   */
  tenantCount: number
  activeTenantCount: number
  /** The band, under `banded`. Null under every other basis. */
  band: CommissionBand | null

  issuedAt: Timestamp
  /** Control-plane signature over bodyHash. The partner verifies it offline. */
  signature: string
  /**
   * Set when a dispute opened the base under a grant.
   *
   * Worth recording rather than merely permitting: a basis that is disputed
   * often is a basis that should not have been chosen, and this field is the
   * only place that would show it.
   */
  baseDisclosedUnderGrantId: PartnerAccessGrantId | null
}

/* ------------------------------------------------------------------ *
 * Lease defaults, and the partner visibility derivation
 * ------------------------------------------------------------------ */

/** Decided 4 Aug 2026. Renewal aligns to the billing period. */
/** @dropped-for-v1 7 Aug 2026 — G36 — BYOA slips to v1+1; no lease exists to window. Declared, not built. */
export const LEASE_WINDOW_DAYS = 30
/** Survives a long weekend plus a slow accounts-payable department. */
/** @dropped-for-v1 7 Aug 2026 — G36 — BYOA slips to v1+1; no lease exists to grace. Declared, not built. */
export const LEASE_GRACE_DAYS = 7
/**
 * Default only — the multiple was NOT decided, just its existence. Three is a
 * starting position, per-deployment overridable, and still on the open list.
 */
/** @dropped-for-v1 7 Aug 2026 — G36 — BYOA slips to v1+1; no lease ceiling exists. Declared, not built. */
export const LEASE_CEILING_MULTIPLE_DEFAULT = 3

/**
 * Aggregates stop being a control below this many tenants.
 *
 * Decided 5 Aug 2026, docs/access-and-agency.md §10.8. At `tenantCount: 1` a
 * partner-level total IS the per-tenant line; at 2 it is one subtraction away.
 *
 * ⚠️ THE COST, stated here rather than discovered later: a partner's first four
 * customers show NO partner-level aggregate at all. That lands hardest on new
 * partners, exactly when they most want to show their book growing — so expect
 * pressure to lower it, and expect it from sales rather than from the partner.
 *
 * ONE NUMBER, NAMED ONCE. observability.ts imports this for
 * PlatformHealthWindow rather than declaring a second five; a second five is
 * how the two surfaces end up with different floors and nobody notices which.
 */
/** @dropped-for-v1 7 Aug 2026 — the partner and platform aggregate views it protects are both dropped. Declared, not built. */
export const AGGREGATE_COHORT_FLOOR = 5

/**
 * Whether an aggregate over a cohort may be populated at all.
 *
 * The caller passes the count it already holds. Returning false means the
 * fields are NULL, not rounded or fuzzed — a suppressed figure and an
 * approximate one are different claims, and only one of them is honest.
 */
/** @dropped-for-v1 7 Aug 2026 — the partner and platform aggregate views it protects are both dropped. Declared, not built. */
export function aggregateIsDisclosable(tenantCount: number): boolean {
  return tenantCount >= AGGREGATE_COHORT_FLOOR
}


/**
 * Which bases require disclosing the customer's volume.
 *
 * Total on purpose. Adding a basis without deciding this entry is exactly how
 * the question gets skipped — a new fee structure ships, the shaping code takes
 * the permissive branch, and nobody records that a choice was made.
 *
 * Spend is a lossy encoding of volume that becomes lossless in the hands of
 * anyone holding the rate card, so only the basis that needs the base is
 * marked.
 */
/** @dropped-for-v1 7 Aug 2026 — no partner commission in v1; P4 is undecided. Declared, not built. */
export const COMMISSION_BASIS_DISCLOSES_VOLUME: Record<CommissionBasis, boolean> =
  {
    per_tenant_fixed: false,
    /**
     * A band is a coarsening, and a coarsening bounds rather than reveals: the
     * partner learns which step, never where inside it, and a step cannot be
     * divided by a rate card to recover a count.
     */
    banded: false,
    revenue_share: true,
  }

/**
 * Which contractual band a commission fell into.
 *
 * An ordinal and a label, never a money figure. The schedule of band boundaries
 * lives in the partner's contract; putting it here would put the base back into
 * the type the base was removed from — bounds plus a band is a spend range, and
 * a narrow enough range is a spend.
 */
/** @dropped-for-v1 7 Aug 2026 — no partner commission in v1; P4 is undecided. Declared, not built. */
export interface CommissionBand {
  /** 1-based position in the partner's contractual band schedule. */
  ordinal: number
  /** The band's name as the contract writes it. Opaque to the platform. */
  label: string
}

/**
 * What a partner may see commercially.
 *
 * Deliberately a derivation and not a field: visibility follows who is
 * invoiced. Two settings expressing one arrangement drift, and the direction
 * that drifts — a partner seeing an end customer's rate on a tenant we invoice
 * directly — is the one nobody notices until the customer does.
 *
 * THE RULE, sharper than "may a partner see wholesale":
 *
 *     spend  =  Σ_meters  price(volume_m)
 *
 * Three quantities; any two give the third. A rate alone is a price list — our
 * commercial posture, saying nothing about the customer. Spend alone is a
 * scalar, nearly inert. VOLUME is the customer's actual exposure: invoice
 * counts, close cadence, exception rates, how bad their data is. So:
 *
 *     DISCLOSE AT MOST ONE OF {spend, rate} AT ANY GIVEN GRANULARITY.
 *
 * `commission_only` used to be the second member here, documented as "commission
 * only, never the customer's rate". Both halves failed: the comment stopped
 * being true when the blanket restriction was dropped, and the name no longer
 * named what distinguished the case — with wholesale visible, "commission only"
 * describes nothing. What distinguishes it is the COMMISSION BASIS, so the
 * verdict splits three ways below. See docs/access-and-agency.md §8.8.
 */
/** @dropped-for-v1 7 Aug 2026 — no partner portal in v1 — the capability mask stays, the surface does not. Declared, not built. */
export type PartnerCommercialVisibility =
  /**
   * Reseller (`invoice_partner`). It sees wholesale — that is its own invoice —
   * and its own retail card, which it authored.
   *
   * Volume visibility is INHERENT to reselling. It is not something this model
   * withholds, because it cannot: the partner holds both halves of the pair by
   * necessity. It belongs in the CUSTOMER's contract as a disclosure, not here
   * as a control we would be pretending to enforce.
   */
  | 'wholesale_and_own_retail'
  /**
   * Commission on a fixed per-tenant fee. The roster only: which tenants, and
   * whether each transacted. No spend, no rate, no band.
   */
  | 'commission_roster_only'
  /** Commission on a banded fee. The band, and nothing inside it. */
  | 'commission_and_band'
  /**
   * Commission on a revenue share. The base spend — the partner cannot check
   * its own commission without it — and therefore NOT the rate. One of the
   * pair, never both.
   */
  | 'commission_and_base_spend'

/**
 * The arrangement, in the shape the derivation needs.
 *
 * A discriminated union rather than two loose arguments: a reseller HAS no
 * commission basis, and an argument that must be passed to be ignored is how a
 * defaulted basis ends up silently deciding a reseller's disclosure.
 *
 * `Extract` rather than bare literals so the tie to domain.ts holds: rename an
 * arrangement there and this resolves to `never` and the build stops, instead
 * of quietly matching nothing at runtime.
 */
/** @dropped-for-v1 7 Aug 2026 — no partner portal in v1 — the capability mask stays, the surface does not. Declared, not built. */
export type PartnerCommercialTerms =
  | { arrangement: Extract<PartnerBillingArrangement, 'invoice_partner'> }
  | {
      arrangement: Extract<PartnerBillingArrangement, 'invoice_end_customer'>
      commissionBasis: CommissionBasis
    }

/** @dropped-for-v1 7 Aug 2026 — no partner portal in v1 — the capability mask stays, the surface does not. Declared, not built. */
export function partnerCommercialVisibility(
  terms: PartnerCommercialTerms,
): PartnerCommercialVisibility {
  if (terms.arrangement === 'invoice_partner') {
    return 'wholesale_and_own_retail'
  }
  switch (terms.commissionBasis) {
    case 'per_tenant_fixed':
      return 'commission_roster_only'
    case 'banded':
      return 'commission_and_band'
    case 'revenue_share':
      return 'commission_and_base_spend'
  }
}

/**
 * One tenant's line in a partner summary, shaped by the verdict.
 *
 * A UNION AND NOT A RECORD OF NULLABLES. The previous shape declared
 * `wholesale: MoneyAmount` non-nullable, so a summary built under the
 * commission verdict could only be populated by writing the one number the
 * verdict forbids into the one field that had to be filled: the type FORCED
 * the leak it existed to prevent. A verdict the model cannot express is a
 * verdict the model does not hold.
 */
/** @dropped-for-v1 7 Aug 2026 — no partner portal in v1; P4 is undecided. Declared, not built. */
export type PartnerTenantLine =
  | PartnerTenantResaleLine
  | PartnerTenantRosterLine
  | PartnerTenantBandedLine
  | PartnerTenantBaseSpendLine

/** Identity and activity. Present under every verdict; nothing here is a volume. */
/** @dropped-for-v1 7 Aug 2026 — no partner portal in v1; P4 is undecided. Declared, not built. */
export interface PartnerTenantLineBase {
  tenantId: TenantId
  tenantName: string
  /**
   * Whether the tenant transacted in the period. A flag, never a count — and
   * see PartnerHealthView in observability.ts for why a flag sampled finely
   * enough stops being one.
   */
  active: boolean
}

/** @dropped-for-v1 7 Aug 2026 — no partner portal in v1; P4 is undecided. Declared, not built. */
export interface PartnerTenantResaleLine extends PartnerTenantLineBase {
  visibility: 'wholesale_and_own_retail'
  /** What 1CloudHub charges the partner for this tenant. Their own invoice line. */
  wholesale: MoneyAmount
  /** Present when the partner's own retail card is configured. */
  retail: MoneyAmount | null
}

/** Deliberately carries no money at all. The fee is per tenant; this is a tenant. */
/** @dropped-for-v1 7 Aug 2026 — no partner portal in v1; P4 is undecided. Declared, not built. */
export interface PartnerTenantRosterLine extends PartnerTenantLineBase {
  visibility: 'commission_roster_only'
}

/** @dropped-for-v1 7 Aug 2026 — no partner portal in v1; P4 is undecided. Declared, not built. */
export interface PartnerTenantBandedLine extends PartnerTenantLineBase {
  visibility: 'commission_and_band'
  band: CommissionBand
}

/** @dropped-for-v1 7 Aug 2026 — no partner portal in v1; P4 is undecided. Declared, not built. */
export interface PartnerTenantBaseSpendLine extends PartnerTenantLineBase {
  visibility: 'commission_and_base_spend'
  /**
   * The customer's spend, which is the base a revenue share is computed on.
   * Disclosed here, so the rate must not be — anywhere, at any granularity.
   */
  baseSpend: MoneyAmount
}

/**
 * The unredacted row, platform side.
 *
 * NEVER returned to a partner: it holds both halves of the pair at once, which
 * is the only place in the model where that is permitted. Exists so the shaping
 * below has something to shape FROM — a projection needs a source, and without
 * a named source every caller invents one.
 */
/** @dropped-for-v1 7 Aug 2026 — no partner portal in v1; P4 is undecided. Declared, not built. */
export interface PartnerTenantFacts {
  tenantId: TenantId
  tenantName: string
  active: boolean
  /** What 1CloudHub charges the partner. Null under a commission arrangement. */
  wholesale: MoneyAmount | null
  /** What the end customer is billed. Null under a resale arrangement. */
  customerSpend: MoneyAmount | null
  /** The partner's own retail figure, where it uses our cards. */
  retail: MoneyAmount | null
  /** Which contractual band `customerSpend` fell into. Null unless banded. */
  band: CommissionBand | null
}

/**
 * Project the facts down to what the verdict permits.
 *
 * THE VERDICT IS AN ARGUMENT. It is not left to each caller to have remembered
 * to apply it, for the same reason a scope is not checked by its callers: a
 * rule enforced at every call site is enforced at none of them, and the one
 * query that forgets is the one nobody reviews.
 *
 * Returns null where the facts cannot satisfy the verdict — a banded line with
 * no band, a revenue share with no base. Emitting a partial line instead would
 * make "not disclosable" indistinguishable from "not computed", and only one of
 * those is a bug.
 */
/** @dropped-for-v1 7 Aug 2026 — no partner portal in v1; P4 is undecided. Declared, not built. */
export function shapePartnerTenantLine(
  visibility: PartnerCommercialVisibility,
  facts: PartnerTenantFacts,
): PartnerTenantLine | null {
  const base: PartnerTenantLineBase = {
    tenantId: facts.tenantId,
    tenantName: facts.tenantName,
    active: facts.active,
  }
  switch (visibility) {
    case 'wholesale_and_own_retail':
      return facts.wholesale === null
        ? null
        : { ...base, visibility, wholesale: facts.wholesale, retail: facts.retail }
    case 'commission_roster_only':
      return { ...base, visibility }
    case 'commission_and_band':
      return facts.band === null ? null : { ...base, visibility, band: facts.band }
    case 'commission_and_base_spend':
      return facts.customerSpend === null
        ? null
        : { ...base, visibility, baseSpend: facts.customerSpend }
  }
}
