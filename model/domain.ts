/**
 * ReconcileAI — canonical domain model.
 *
 * Reference encoding of docs/domain-model.md. Stack-neutral by intent: these
 * types describe entities, not persistence or transport.
 *
 * This is the canonical model, and since the 6 Aug 2026 trunk cut it is the only
 * code on the trunk. The application it replaces is at `archive/sap-line:src/`
 * — `git show archive/sap-line:src/types/reconcileLanding.types.ts`. Every
 * `src/…` path in this repository refers there.
 *
 * Project constraints honoured here (model/tsconfig.json):
 *   - erasableSyntaxOnly: no enums, no namespaces, no parameter properties.
 *     Closed sets are const objects + derived union types.
 *   - verbatimModuleSyntax: type-only imports must use `import type`.
 */

/**
 * Type-only, and therefore erased — no runtime cycle, even though access.ts and
 * governance.ts both import from here. Stated because the cycle looks alarming
 * in a dependency graph and is not: `import type` emits nothing.
 *
 * Three imports, three decisions:
 *   - `Capability` / `CapabilityRequirement` — a procedure step names what it
 *     NEEDS, never who holds it. See ProcedureStep below.
 *   - `AuditActor` — an audit row must reach the acting organisation without
 *     traversing a mutable table. See AuditEvent below.
 */
import type { AuthorizationGrant, Capability, CapabilityRequirement } from './access'
/**
 * ⚠️ THIS EDGE POINTS THE OTHER WAY FROM EVERY OTHER IMPORT IN THIS FILE, AND
 * IT IS TYPE-ONLY FOR THAT REASON. `model/reconciliation.ts` imports from this
 * module, so a VALUE import back would be a real runtime cycle; an `import
 * type` is erased before any loader sees it, which is the same distinction
 * `TOOL_KEYS` (`model/domain.ts:591`) draws for itself further down.
 *
 * WHY THE TYPE IS NOT MOVED HERE INSTEAD. It belongs beside `Normaliser`
 * (below), which it terminates in and which `model/reconciliation.ts` already
 * imports from this file — but redefining it here while the original stands
 * would be two copies of one closed security vocabulary, drifting. The move is
 * a follow-up in `model/reconciliation.ts`, which this build does not own.
 * Type-only cycles are already the established shape here: `domain`, `access`
 * and `governance` are mutually type-importing today.
 */
import type { IdentifierNormalisation } from './reconciliation'
/**
 * ⚠️ THE SAME EDGE AGAIN, AND TYPE-ONLY FOR THE SAME REASON. `model/ingestion.ts`
 * imports `DocumentTypeTemplate`, `ExtractionFn` and `AcquisitionFidelity` from
 * this module, so a VALUE import back would be a real runtime cycle; an
 * `import type` is erased before any loader sees it. `model/ingestion.ts` has no
 * value imports at all, which is what makes the cycle a cycle on paper only.
 *
 * WHY THE TYPE IS NOT MOVED HERE INSTEAD. `ClassificationSignal`'s
 * `intake_channel_is` arm reads `IntakeChannelKind`, and G184 rules the intake
 * vocabulary to exactly one member set. Declaring the rule beside `SolutionPack`
 * would put the classification vocabulary on one side of the model and the
 * channel vocabulary it reads on the other, with `SourceDocument` — the thing an
 * admitted arrival becomes — between them.
 */
import type { PackClassificationRule } from './ingestion'
import type {
  AuditActor,
  RecordChain,
} from './governance'

/* ------------------------------------------------------------------ *
 * Identifiers
 * ------------------------------------------------------------------ */

/**
 * ALL MOVED TO `model/kernel.ts` on 7 Aug — the brand symbol, `Id<T>`, every
 * branded alias below, the four primitives and `TenantScoped`. They now live in a
 * module with NO IMPORT STATEMENTS, so every brand has one home and the module
 * graph is acyclic by one grep (`grep -c '^import' model/kernel.ts` → 0).
 *
 * Before that they had three homes — 21 here, one in `agents.ts`, one in
 * `catalog.ts` — which is the two-vocabularies shape this codebase records as its
 * most repeated defect.
 *
 * RE-EXPORTED HERE, NOT RE-DECLARED, and the distinction is the whole point.
 * Thirteen modules import these names from `./domain`; re-pointing all thirteen
 * is churn buying no property, while a second DECLARATION would be exactly the
 * duplication the move removes.
 *
 * The symbol MOVED rather than being copied for the same reason: `unique symbol`
 * is unique per declaration, so a second one would make `Id<'Tenant'>` from
 * kernel and `Id<'Tenant'>` from domain mutually unassignable while printing
 * identically.
 *
 * ⚠️ This re-export is load-bearing and invisible — deleting a name from it is a
 * one-line change that looks like tidying. `model/identity.ts`
 * (`_BrandsReachableFromBothPaths`) asserts that these names are still reachable
 * from BOTH `./kernel` and `./domain` and resolve to the SAME type, so a dropped
 * re-export and a re-declaration are both compile errors.
 */
export type {
  Id,
  AccountId,
  AgentDefinitionId,
  /* 7 Aug 2026 — the operator-initiated path (G42/G43/G44). Re-exported like
   * every other domain id, so a consumer importing from `./domain` reaches
   * them without a second import path. */
  OperatorProposalId,
  OperatorProposalDecisionId,
  EndpointReadingId,
  ApprovalDecisionId,
  AuthorizationGrantId,
  CounterpartyId,
  DashboardId,
  DataPlaneId,
  DefinitionId,
  DocumentTypeId,
  ExceptionId,
  FieldPath,
  FieldPathKey,
  FieldSegment,
  InstalledPackId,
  Json,
  MatchGroupId,
  MembershipId,
  MessageId,
  PartnerId,
  ProcedureId,
  ProposalId,
  RuleId,
  RunId,
  SlotName,
  SolutionId,
  SourceDocumentId,
  TenantId,
  TenantScoped,
  ThreadId,
  Timestamp,
  UserId,
  DataSubjectRequestId,
  EndpointId,
  EvaluationGateId,
  IdentityConnectionId,
  PartnerAccessGrantId,
  ProcedureStepExecutionId,
  ProcedureStepId,
  ReconciliationPeriodId,
  RoleId,
  /* #222 [A-2] and #223 [A-5], 22 Aug 2026. Re-exported like every other
   * domain id, so a consumer importing from `./domain` reaches them without a
   * second import path. */
  SessionId,
  SignInAttemptId,
  /* #235 [A-14], 24 Aug 2026, under G229. */
  InvitationId,
  SolutionPackId,
} from './kernel'

import type {
  AskSessionId,
  AskTurnId,
  AccountId,
  AgentDefinitionId,
  ApprovalDecisionId,
  AuthorizationGrantId,
  CounterpartyId,
  DashboardId,
  DataPlaneId,
  DefinitionId,
  DocumentTypeId,
  ExceptionId,
  FieldPath,
  FieldPathKey,
  InstalledPackId,
  Json,
  MatchGroupId,
  MembershipId,
  /* 7 Aug 2026, the trim's four model-identity brandings. Invariant 7's ⚠️ note
   * named three bare model-identity fields and the inventory was nine; two of
   * the nine are correct as bare strings under `BareByRule` R1 in identity.ts
   * (AWS mints them), and four of the rest are branded to the CATALOGUE ROW
   * here and in governance.ts. The row is ours; the model identifier is not. */
  ModelCatalogEntryId,
  PartnerId,
  ProcedureId,
  ProposalId,
  /* 7 Aug 2026 — the operator-initiated path (G42/G43/G44). */
  OperatorProposalId,
  OperatorProposalDecisionId,
  EndpointReadingId,
  RuleId,
  RunId,
  SlotName,
  SolutionId,
  SourceDocumentId,
  TenantId,
  TenantScoped,
  Timestamp,
  UserId,
  DataSubjectRequestId,
  EndpointId,
  EvaluationGateId,
  IdentityConnectionId,
  PartnerAccessGrantId,
  ProcedureStepExecutionId,
  ProcedureStepId,
  ReconciliationPeriodId,
  RoleId,
  SessionId,
  SignInAttemptId,
  InvitationId,
  SolutionPackId,
} from './kernel'

/* ------------------------------------------------------------------ *
 * Closed sets
 * ------------------------------------------------------------------ */

export const DOMAIN_KEYS = {
  finance: 'finance',
  kyc: 'kyc',
  creditUnderwriting: 'credit_underwriting',
  medicalRecords: 'medical_records',
} as const
export type DomainKey = (typeof DOMAIN_KEYS)[keyof typeof DOMAIN_KEYS]

/* ================================================================== *
 * `ROLE_KEYS` / `RoleKey` — DELETED 7 Aug 2026
 * ================================================================== */

/**
 * SUPERSEDED 5 Aug 2026 by model/access.ts, DELETED 7 Aug 2026. The reasoning
 * is kept in full because the enum's absence is a decision, and a deleted
 * declaration with no tombstone is how a superseded shape gets reintroduced by
 * someone who never saw the argument against it.
 *
 * WHAT IT WAS:
 *
 *     export const ROLE_KEYS = {
 *       viewer: 'viewer', operator: 'operator', approver: 'approver',
 *       tenantAdmin: 'tenant_admin', partnerAdmin: 'partner_admin',
 *     } as const
 *     export type RoleKey = (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS]
 *
 * WHY IT WENT. These five were doing two jobs at once — a stakeholder's
 * relationship to the work, and a capability in the system — so a KYC reviewer
 * and an AP approver were both `approver` and a pack could not say what it
 * needed. The stakeholders every deployment actually has (a sponsor who must be
 * kept in the loop, a security officer who must see the audit trail, an
 * infrastructure team that owns the account) fitted none of them, because none
 * is an operating role. §8 later found a THIRD job hiding in `partner_admin`:
 * an organisation baked into a role name, which is why the two partner-clamp
 * functions in governance.ts could only be removed and never migrated.
 *
 * THE RISK IT CARRIED, which is the reason the deletion was worth its cost: a
 * bare key such as `'approver'`, satisfied by ANY pack's role keyed `approver`,
 * is a KYC reviewer approving an AP write-off, one string comparison away.
 * `Role.key` is namespaced by pack — role identity is `(packId, key)` —
 * precisely because that comparison is unsafe. `RoleKey` never was, and every
 * month it survived, something new referenced it. This codebase has already
 * been bitten by exactly this divergence once, with `ErrorCode`.
 *
 * WHAT REPLACED IT, per site, so a restorer can see there is nowhere left to
 * put it back:
 *
 *   - the five keys themselves → five `Role` rows of origin `platform`, each
 *     composing capabilities from the closed set in access.ts
 *   - `ProcedureStep.human.role` → `requires: CapabilityRequirement` (5 Aug)
 *   - `Procedure.defaultEscalationRole` → `defaultEscalationCapability` (5 Aug)
 *   - `ApprovalConfig.approverRoles` → `approvers: CapabilityRequirement[]`
 *   - `CorrespondenceConfig.minimumRoleToAdmit` and `mayAdmit()`'s role ladder
 *     → `capabilityToAdmit: Capability` + `orgClassesThatMayAdmit: OrgClass[]`
 *   - `roleCeilingForScope()` / `effectivePartnerRole()` → REMOVED, not
 *     migrated, and replaced by `PARTNER_CAPABILITY_MASK` /
 *     `effectivePartnerCapabilities()` — see governance.ts §2, which records
 *     the two live defects that made removal the only honest option
 *   - `Membership.role` → `Membership.roleId: RoleId`, below
 *
 * WHAT IS STILL OWED. `Membership` itself gives way to `RoleAssignment` in
 * access.ts, which carries a pinned `roleVersion` and an `AssignmentScope` that
 * a membership row cannot express. `roleId` is a pointer for the migration to
 * land against, NOT a second grant — see the note at the field.
 */

/* (nothing is declared here; see the tombstone above) */

export const SEVERITIES = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
} as const
export type Severity = (typeof SEVERITIES)[keyof typeof SEVERITIES]

/**
 * An arithmetic expression over extracted values.
 *
 * Replaces a flat `operands: Operand[]` list, which carried no operator, sign
 * or grouping: `invoice.total − credit_note.amount = payment.amount` encoded as
 * three field references and the word `sum_equals`, and the two plausible
 * readings gave opposite answers. It also blocked tax, retention, returns and
 * `qty × unit_price = line_total` outright.
 */
export type Expr =
  | { kind: 'field'; slot: SlotName; path: FieldPath }
  | { kind: 'constant'; value: ExtractedScalar }
  | { kind: 'sum'; of: Expr[] }
  | { kind: 'difference'; left: Expr; right: Expr }
  | { kind: 'product'; left: Expr; right: Expr }
  /**
   * Reduces MANY documents in one slot to a single value.
   *
   * Without this, partial goods receipt — the most common three-way-match
   * exception there is — cannot be written. SourceSlot.cardinality already
   * permits 'at_least_one' and MatchGroup.members already holds a document
   * array, so N receipts were always representable; `field` just resolved one
   * of them and the rule silently compared against an arbitrary receipt.
   *
   *   sum(goods_receipt.lines[].qty_received) <= purchase_order.lines[].qty
   */
  | { kind: 'aggregate'; slot: SlotName; path: FieldPath; fn: AggregateFn }

export type AggregateFn = 'sum' | 'count' | 'min' | 'max'

/**
 * What a rule asserts. A discriminated union, so each shape carries exactly the
 * operands it needs — no positional convention to misread, and one-sided
 * assertions (`not_exceeds`) are expressible without inventing a second operand.
 */
export type RulePredicate =
  | { kind: 'equals'; left: Expr; right: Expr; tolerance: Tolerance | null }
  | { kind: 'not_exceeds'; left: Expr; right: Expr; tolerance: Tolerance | null }
  | { kind: 'not_below'; left: Expr; right: Expr; tolerance: Tolerance | null }
  /** `from` names the reference point explicitly; `now` was invisible before. */
  | { kind: 'within_days'; subject: Expr; days: number; from: 'run_date' | 'period_end' }
  | { kind: 'present'; subject: Expr }
  | { kind: 'absent'; subject: Expr }
  /**
   * G130, 9 Aug 2026 — THE REPLACEMENT FOR THE PATTERN ARM, AND IT IS A
   * REMOVAL RATHER THAN A WIDENING.
   *
   * What stood here was `{ kind: 'matches_pattern'; subject: Expr; pattern:
   * string }`, declared with NO EVALUATOR ANYWHERE IN THE TREE — the whole
   * repository held the declaration and one row of a documentation table. That
   * is not a dormant feature, it is an instruction to the next engineer, and
   * the instruction it gives is `new RegExp(predicate.pattern)`. This union is
   * what `MatchRule.predicate` carries (`model/domain.ts:1922`), `MatchRule` is
   * where G123 puts LEARNED disposition rules, and a learned rule's operands
   * derive from counterparty-controlled text. So the pattern would have been
   * composed by a counterparty and compiled by us: invariant 6 inverted, plus
   * ReDoS with no timeout and no linear-time engine in the dependency set. G124
   * ruled that shape out at the reconciliation seam; it was still reachable
   * here, through a door nobody opened deliberately.
   *
   * WHAT THIS ARM IS. A declared `IdentifierNormalisation` — the closed,
   * parameterised op list that already exists (`model/reconciliation.ts:336`)
   * and terminates in `Normaliser` above — plus the enumerated values its
   * OUTPUT is compared against. Nothing is compiled. Every op is total, has no
   * quantifier and allocates no backtracking state, so catastrophic
   * backtracking is not a bound to be chosen but a property that cannot arise.
   *
   * AND THE REASON THAT MATTERS MORE THAN THE ReDoS. A reviewer approving
   * `split on '-', take segment 1, casefold` is approving something they can
   * evaluate. A reviewer approving a regex for safety is performing §5.6 — a
   * control that passes while asserting nothing. G124's deciding argument is
   * that an approval nobody can read is not an approval.
   *
   * WHAT IT COSTS, STATED. This arm is strictly LESS EXPRESSIVE than a regex.
   * The draft's own `(?<=BR\d{3}-)TXN\d+(?=-SG)` is expressible — `split_take`
   * on `'-'`, index 1 — and arbitrary lookaround is not. Some real formats will
   * never be assertable here, and the honest answer for those is residue, not a
   * pattern smuggled back in.
   *
   * ⚠️ THE VALUES ARE COMPARED AGAINST THE EXTRACTION, NEVER THE RAW SUBJECT,
   * and `extractionInSetHolds()` below is the only reading of that. A value
   * that is not already in the extraction's canonical form can therefore never
   * hold — declaring `'ABC'` under `then: 'casefold'` is a predicate that is
   * silently false forever. NOTHING VALIDATES THAT, AND THIS BUILD DID NOT ADD
   * IT — the check is one line (`extract(value) === value` for every declared
   * value) and it needs the injected extractor, so it belongs beside
   * `validateNormalisation()` (`model/reconciliation.ts:374`) rather than here.
   * It is reported as an open item rather than left unsaid, because a predicate
   * that can never hold is §5.6 in the data instead of in the code.
   */
  | {
      kind: 'extraction_in_set'
      subject: Expr
      /** Approved op list. NOT a pattern, and nothing compiles it. */
      extraction: IdentifierNormalisation
      /** The permitted extraction results, enumerated. Empty holds nothing. */
      values: readonly string[]
    }
  | { kind: 'fuzzy_name'; left: Expr; right: Expr; minSimilarity: number }
  | { kind: 'in_set'; subject: Expr; values: string[] }
  /**
   * `tenant_lifetime` is what duplicate-invoice detection actually needs: the
   * same invoice number from the same vendor, resubmitted months later, is not
   * detectable within a group or a run.
   */
  | { kind: 'unique_within'; subject: Expr; scope: 'group' | 'run' | 'period' | 'tenant_lifetime' }

/* 🛑 THERE IS DELIBERATELY NO TYPE-LEVEL TWIN OF THE REMOVAL, AND THE REASON IS
 * WORTH THE PARAGRAPH. The obvious guard is
 * `Assert<'…' extends RulePredicate['kind'] ? false : true>`. It was written,
 * and `tests/model/rule-predicate.test.ts` went RED on it — because the guard
 * is itself a CODE line naming the banned token, and the control the tests
 * enforce is that no code line under `model/` names it at all. Given the two,
 * the source control is strictly stronger: it covers every module rather than
 * one union, and it catches a READ as well as a declaration — which is the half
 * that matters, since the defect was never the arm, it was the
 * `new RegExp(predicate.pattern)` the arm invited. A compile-time check over a
 * type in a module that constructs almost nothing is §5.10 anyway. The control
 * runs in the gate: `npm run check` ends in `npm test`.
 */

/**
 * How the declared op list is run. Supplied by the caller; never imported here.
 *
 * `applyExtraction()` (`model/reconciliation.ts:445`) satisfies this
 * structurally and is the only implementation. It is INJECTED rather than
 * imported because `model/reconciliation.ts` already imports this module, and
 * a VALUE import back would make that cycle real rather than type-only — the
 * distinction this file already draws for `TOOL_KEYS` at `model/domain.ts:591`.
 * The `IdentifierNormalisation` type import above is type-only and therefore
 * erased before any loader sees it.
 */
export type ExtractionFn = (
  input: string,
  normalisation: IdentifierNormalisation,
) => { readonly ok: true; readonly key: string } | { readonly ok: false }

/**
 * Whether an `extraction_in_set` predicate holds, and when it does not, why.
 *
 * `extraction_refused` is a distinct arm from `not_in_set` on purpose. The op
 * list refuses precisely on the inputs somebody chose to be hostile — over the
 * character cap, segment index out of range — and collapsing that into "no
 * match" would make a refusal indistinguishable from an ordinary miss at every
 * call site that reports one.
 */
export type ExtractionInSetOutcome =
  | { held: true }
  | { held: false; reason: 'not_in_set' | 'extraction_refused' }

/**
 * Evaluates the arm. Total; never throws; never constructs a `RegExp`.
 *
 * 🛑 A REFUSED EXTRACTION DOES NOT FALL BACK TO THE RAW SUBJECT. Falling back
 * would compare the attacker's own bytes exactly when the op list has declined
 * to canonicalise them, which is scope failing OPEN — the shape
 * `docs/HANDOFF.md` §5.5 records this codebase already fixing once.
 */
export function extractionInSetHolds(
  predicate: Extract<RulePredicate, { kind: 'extraction_in_set' }>,
  raw: string,
  extract: ExtractionFn,
): ExtractionInSetOutcome {
  const extracted = extract(raw, predicate.extraction)
  if (!extracted.ok) return { held: false, reason: 'extraction_refused' }
  for (const value of predicate.values) {
    if (value === extracted.key) return { held: true }
  }
  return { held: false, reason: 'not_in_set' }
}

/**
 * Data classification. Drives masking, retention, export controls and what may
 * be sent to a model provider.
 *
 * Deliberately coarse — a classification nobody can apply consistently is worse
 * than none. `sensitive_personal` is the PDPA-adjacent tier covering identity
 * documents, national identifiers and health data.
 */
export const DATA_CLASSES = {
  public: 'public',
  internal: 'internal',
  personal: 'personal',
  sensitivePersonal: 'sensitive_personal',
} as const
export type DataClass = (typeof DATA_CLASSES)[keyof typeof DATA_CLASSES]

/**
 * Deployment region. Modelled from day one even though only one is live, so a
 * second region is configuration rather than migration.
 *
 * ap-southeast-1 is the default: Singapore-resident data avoids PDPA's Transfer
 * Limitation Obligation entirely. See docs/data-governance.md §3.
 *
 * ⚠️ **`ap-southeast-2` ADDED 8 Aug 2026, AND IT IS NOT A ROUTINE WIDENING.**
 * G82 puts the bought BI layer in Sydney because `ap-southeast-1` carries only
 * the QuickSight subset, not full Quick Suite (`docs/HANDOFF.md` §3c). So the
 * second region is live, it holds tenant data, and the sentence above — that
 * Singapore residency avoids the Transfer Limitation Obligation entirely —
 * **is no longer true of the BI layer.** It remains true of the data plane.
 * ⚖️ **L7 is the counsel question and G82 is not a commitment until it is
 * answered.**
 *
 * ⚠️ **THIS TYPE COULD NOT NAME THE REGION ITS OWN CONSUMER NEEDED, FOR AN
 * HOUR, AND `tsc` STAYED GREEN.** The `bi_dataset` variant of `SubjectLocation`
 * (G80a, `governance.ts`) carries `region: RegionKey` with a comment saying it
 * exists because the BI layer is in Sydney — while `RegionKey` admitted four
 * regions and Sydney was not one. **Nothing in `model/` constructs a
 * `SubjectLocation`, so the compiler had nothing to check it against** — §5.10
 * exactly, on a type added the same day the fixtures pass was written to catch
 * this class. It was found by an adversarial review probing the type with a
 * throwaway value, not by the build. The probe: assign `'ap-southeast-2'` and
 * read the `TS2820`.
 */
export type RegionKey =
  | 'ap-southeast-1'
  | 'ap-southeast-2'
  | 'us-west-2'
  | 'ap-south-1'
  | 'eu-west-1'

/**
 * Three postures, not two.
 *
 * `sandbox` accepts synthetic data only, enforced rather than advisory. That
 * decision stands and is untouched — it is what lets a demo proceed ahead of a
 * full compliance posture, and "was real data ever in the sandbox?" stays a
 * query rather than an investigation.
 *
 * `evaluation` exists because the sandbox rule blocked the first thing any
 * finance team wants to do: upload last month's actual invoice. Added 5 Aug
 * 2026, and deliberately NOT a loosened sandbox — an evaluation tenant behaves
 * as production for every invariant (real classification, real retention, real
 * erasure, real policy) and adds three things production does not have: a
 * mandatory expiry, a purge obligation, and no entitlement lease.
 *
 * The distinction earns its keep in support tiering, billing and the purge
 * obligation. A production tenant with an end date would carry all three
 * differences in somebody's memory.
 *
 * See docs/data-governance.md §2.
 */
export type TenantEnvironment = 'sandbox' | 'evaluation' | 'production'

/**
 * Where a tenant's data plane physically runs.
 *
 * Two values, not three. Sandbox is TenantEnvironment above — an ordinary
 * tenant that rejects non-synthetic ingest — and never a deployment topology.
 * Conflating the two triples the apparent fleet-operations cost of BYOA.
 * See docs/data-architecture.md §3.
 */
export const DEPLOYMENT_MODES = {
  /** 1CloudHub account, multi-tenant, isolated by row-level security. */
  hosted: 'hosted',
  /** Customer's own AWS account. The account is the isolation boundary. */
  byoa: 'byoa',
} as const
export type DeploymentMode =
  (typeof DEPLOYMENT_MODES)[keyof typeof DEPLOYMENT_MODES]

/**
 * ISO-4217 money. Integer minor units — never a float, never a bare number.
 *
 * `currency` appeared exactly once in the whole model before this: a USD
 * invoice against an SGD purchase order reported a 35% critical variance on a
 * correct invoice, and AutonomyConfig.autoResolveValueCeiling — policy.ts's own
 * motivating example — was unenforceable because deltas carried no currency.
 */
export interface Money {
  /** ISO 4217, e.g. 'SGD'. */
  currency: string
  /**
   * Exact minor units.
   *
   * 🛑 `bigint` SINCE 19 Sep 2026 — G286 APPLYING G65, AND IT WAS `number` FOR
   * THE THIRTEEN DAYS THE RECORD SAID OTHERWISE. `CLAUDE.md` stated under G111
   * from 8 Aug 2026 that *"`Money.amountMinor` is `bigint` in the model and a
   * decimal STRING on the wire"*; this declaration said `number` and
   * `model/reconciliation.ts` §3 said so in its own voice. **G286 rules that the
   * RECORD WAS RIGHT AND THIS LINE WAS WRONG** — the cheap direction, correcting
   * the record to say `number`, was offered and refused because it *"ratifies a
   * ceiling nobody chose by writing down what drifted."*
   *
   * The ceiling is the point. `Number.isSafeInteger` capped exact money at 2^53
   * minor units — ample for one close, not ample for a cumulative total, a
   * multi-year ledger or a minor unit finer than two decimals.
   *
   * 🛑 NOTHING OUTSIDE `model/money.ts` MAY CONVERT THIS FIELD. That module is
   * G111's codec: a decimal STRING on the wire, `bigint` here, and exactly one
   * pair of functions between them. `JSON.stringify` on a `Money` now THROWS,
   * which G71 names as a feature — it forces the boundary decision at the
   * boundary rather than letting it drift to call sites.
   */
  amountMinor: bigint
  /** Minor units per major unit as a power of ten. 2 for SGD, 0 for JPY. */
  exponent: number
}

/** A rate applied to cross-currency comparison, with the date it came from. */
/** @dropped-for-v1 7 Aug 2026 — every figure on every v1 screen is in one currency. Declared, not built. */
export interface FxConversion {
  from: string
  to: string
  rate: number
  asAt: Timestamp
  /** Named so a disputed conversion is traceable to a source. */
  source: string
}

/** How a definition resolves currency differences. Null = refuse to compare. */
/** @dropped-for-v1 7 Aug 2026 — every figure on every v1 screen is in one currency. Declared, not built. */
export interface FxPolicy {
  baseCurrency: string
  rateSource: string
  rateDate: 'document_date' | 'run_date' | 'period_end'
}

export type Cardinality = 'exactly_one' | 'at_least_one' | 'optional'

/**
 * Whether a slot is the authority a reconciliation is measured *against*, or a
 * document measured against it.
 *
 * Inherited from the existing system, not invented here: the live no-SAP app's
 * job config already separated `document_id: number[]` from a distinct
 * `reference_document_id`, and the concept is load-bearing across its upload
 * flow, SOP stepper and session detail. Modelling every slot as a peer would
 * have been a regression.
 *
 * A definition has at most one `reference` slot. Where none is designated, the
 * reconciliation is symmetric (every source is equally authoritative).
 */
export type SlotRole = 'reference' | 'comparand'
export type Normaliser = 'exact' | 'casefold' | 'digits_only' | 'name_normalise'

/**
 * Whether a rule is evaluated once per matched group, or once per matched line.
 *
 * Undefined grain was the defect both teams found: matchKeys joined on
 * header.po_number (document grain) while rules compared lines[].unit_price
 * (line grain), and nothing paired invoice line 3 with PO line 3. The engine
 * could zip by position — five wrong exceptions when a vendor sorts differently
 * — or aggregate, masking an overcharge offset by an undercharge.
 */
/**
 * What an agent may do. Lives here rather than in policy.ts because a procedure
 * step references it and policy.ts already imports from this module — putting
 * it there would make the cycle real rather than type-only.
 */
export const TOOL_KEYS = {
  /* --- reading tenant data --- */
  readDocument: 'read_document',
  readExtraction: 'read_extraction',
  readException: 'read_exception',
  readMatchGroup: 'read_match_group',
  /** The admitted thread only. Admission is a separate act — see `admit`. */
  readCorrespondenceThread: 'read_correspondence_thread',
  /** How did we settle this last time. The single most useful read we have. */
  searchPriorExceptions: 'search_prior_exceptions',
  readProcedure: 'read_procedure',

  /* --- computing over what is already in context --- */
  computeTolerance: 'compute_tolerance',
  computeFxConversion: 'compute_fx_conversion',

  /* --- writing tenant data --- */
  writeExplanation: 'write_explanation',
  writeProposal: 'write_proposal',
  assignException: 'assign_exception',
  executeDisposition: 'execute_disposition',
  closeException: 'close_exception',

  /* --- reaching a foreign system through an Endpoint, on a credential --- */
  endpointRead: 'endpoint_read',
  /** Posting into the customer's ledger. A cliff, not a slope. */
  endpointWriteback: 'endpoint_writeback',

  /* --- content leaves the tenant --- */
  sendCorrespondence: 'send_correspondence',
  notifyContact: 'notify_contact',
} as const
export type ToolKey = (typeof TOOL_KEYS)[keyof typeof TOOL_KEYS]

export type AgentAction =
  | 'classify'
  | 'extract'
  | 'explain'
  /**
   * Admit an inbound message as evidence.
   *
   * Added 5 Aug after a red-team pass found that the single most
   * security-critical act an agent can take could not be NAMED — policy could
   * not evaluate it, autonomy could not permit or forbid it, and
   * AutonomyConfig.permittedActions could not list it. An unnameable action is
   * an ungoverned one.
   */
  | 'admit'
  | 'propose_resolution'
  | 'execute_resolution'
  | 'notify'
  | 'close_exception'

export type RuleScope = 'group' | 'line'

/**
 * WHAT KIND OF THING A DECLARED POSITION HOLDS — invariant 4's second axis,
 * beside `DATA_CLASSES`. `FieldSpec.dataType`, stored by `db/migrations/0170`.
 *
 * ⚠️ A CONST SINCE 21 Sep 2026 — G1453 — AND IT WAS A BARE UNION UNTIL THEN,
 * WHICH IS RECORDED BECAUSE THE ABSENCE HAD A COST A READER CAN STILL SEE.
 * `server/data-plane/payload-store.ts` needs the MEMBER SET at runtime to
 * refuse a stored `data_type` the model cannot name, and with nothing to
 * iterate it hand-wrote one — its own note says so: *"`DataType` is a bare
 * union with no const beside it, so there is nothing to iterate. Minting a
 * `DATA_TYPES` const in the model is `model/extraction.ts`'s to take, and both
 * readers should derive from it when it exists."* **This is that const, and
 * both readers now derive from it** rather than keeping a second copy that
 * agrees until somebody mints a sixth member (§5.3).
 *
 * 🛑 THE TYPE IS DERIVED FROM THE CONST AND NOT DECLARED BESIDE IT, WHICH IS
 * `DATA_CLASSES`' SHAPE AND IS THE WHOLE POINT. A const plus an independently
 * written union is exactly the two-vocabularies-with-nothing-checking-them
 * shape `db/migrations/0002_run.sql` refuses; deriving makes the const the only
 * source, so there is nothing for a sixth member to drift out of. **The member
 * set is unchanged to the character** — `string | number | date | money |
 * identifier`, in that order — so every existing consumer of `DataType` sees
 * precisely what it saw before.
 */
export const DATA_TYPES = {
  string: 'string',
  number: 'number',
  date: 'date',
  money: 'money',
  identifier: 'identifier',
} as const
export type DataType = (typeof DATA_TYPES)[keyof typeof DATA_TYPES]
export type EntityStatus = 'active' | 'suspended'

export type ExceptionStatus =
  | 'open'
  | 'investigating'
  | 'resolution_proposed'
  | 'pending_approval'
  | 'resolved'
  | 'rejected'
  | 'dismissed'

/* ------------------------------------------------------------------ *
 * FINDING STANDING — G74's register vocabulary, DERIVED and never stored
 *
 * 🛑 WHERE THESE DECLARATIONS LIVE IS A DECISION, AND #236 §6 requires it
 * stated rather than taken silently. They live in `model/domain.ts`, which
 * carries whole-model blast radius, because the derivation's ARGUMENT is
 * assembled out of three types declared in this same file and nothing else:
 * `MatchGroup` (`model/domain.ts:2955`), `SourceDocument` (`:1961`) and
 * `Exception` (`:3121`) — plus `ExceptionStatus` directly above. G162's
 * precedent is a separate module with its own engine and its own invariants;
 * this is five terms and one pure function over local types, and a module
 * holding it would import three types from here and be imported by nothing.
 * Derive the three citations rather than copying them — every one of G74's own
 * three had drifted while still resolving (#236 §5):
 *   grep -n 'export interface \(MatchGroup\|SourceDocument\|Exception\) ' model/domain.ts
 *
 * 🛑 §5.10 — WHICH OF THESE GUARANTEES IS THE COMPILER AND WHICH IS A FIXTURE.
 * The distinction is not decoration; a green `tsc` implies neither on its own.
 *   • ✅ THE COMPILER, and each was MEASURED by planting the mutation and
 *     reading the exit code, on 16 Aug 2026 against `model/tsconfig.json`.
 *     `FINDING_STANDINGS`, `MATCH_GROUP_OUTCOME_STANDING` and
 *     `EXCEPTION_STATUS_STANDING` each carry `satisfies`, which is checked AT
 *     THE DECLARATION — the declaration IS the construction site, exactly as
 *     `model/access.ts:1807` states, so these bite with no caller anywhere:
 *       sixth `FINDING_STANDINGS` key ............ EXIT 2, TS2322
 *       sixth `FindingStanding` union member ..... EXIT 2, TS2344
 *       fourth `MatchGroupOutcome` ............... EXIT 2, TS1360 + TS7053
 *       eighth `ExceptionStatus` ................. EXIT 2, TS1360 + TS7053
 *       fourth `FindingBasis` arm ................ EXIT 2, TS2366
 *   • 🛑 A FIXTURE, AND NOT THE COMPILER. The compiler holds the SHAPE and
 *     holds none of the CONTENT. Mis-mapping `exception → closed` inside
 *     `MATCH_GROUP_OUTCOME_STANDING` — one wrong word in the register's State
 *     column — leaves `tsc` at **EXIT 0**, measured the same day.
 *     `standingFor()` also has NO caller in `model/`, `server/`, `db/` or
 *     `tools/`; reproduce with `grep -rn 'standingFor' --include='*.ts' .` and
 *     read the file column — every hit outside this declaration is a test.
 *     Which arm resolves to which word is witnessed by
 *     `tests/model/finding-standing.test.ts` and by nothing else. Do not report
 *     a green `tsc` as evidence that the arms are right.
 *
 * 🛑 NO STANDING DEPENDS ON HUE. Every one of the five terms is a WORD on the
 * wire and on the screen; nothing here emits a colour, and
 * `tests/model/finding-standing.test.ts` asserts the five surface terms
 * resolve by name.
 * ------------------------------------------------------------------ */

/**
 * The register's reader vocabulary, derived over heterogeneous rows and never
 * stored on `Exception` or on any other row. G74 keeps five terms: an open
 * investigation is a person-owned next move (`needs_authority`), while the
 * stronger no-recourse reading remains limited to unmatched groups until
 * exhaustion is recorded.
 *
 * ⚠️ THE UNION IS DECLARED, NOT DERIVED FROM THE OBJECT, AND THAT IS THE POINT.
 * When `FindingStanding` was `(typeof FINDING_STANDINGS)[keyof typeof …]` a
 * sixth member COMPILED — the union simply widened to admit it, and only a
 * runtime `deepEqual` on `Object.values` caught it. #236 acceptance item 1 asks
 * for "a sixth member does not compile", so the union is the authority and the
 * object `satisfies` it. A sixth key with a new value now fails at the object;
 * a sixth union member with no key fails at `_EveryFindingStandingHasAKey`.
 */
export type FindingStanding =
  | 'closed'
  | 'needs_authority'
  | 'no_recourse'
  | 'below_floor'
  | 'waiting'

export const FINDING_STANDINGS = {
  closed: 'closed',
  needsAuthority: 'needs_authority',
  noRecourse: 'no_recourse',
  belowFloor: 'below_floor',
  waiting: 'waiting',
} as const satisfies Record<string, FindingStanding>

/**
 * Constraint-shaped, and NOT the `? true : never` idiom, for the reason
 * `model/policy.ts:709-712` states in full: *"a type alias that merely
 * EVALUATES to `never` compiles perfectly happily and asserts nothing. A
 * generic whose parameter is constrained `extends true` is the only form that
 * actually stops the build."*
 *
 * ⚠️ MEASURED, NOT ASSUMED. This assertion was first written in the
 * `_EveryPopulationDefectKindIsListed` shape (`model/reconciliation.ts:1764`)
 * and a planted sixth union member with no object key left `tsc` at **EXIT 0**.
 * The constraint form below fails that same mutation at TS2344. The note is
 * kept rather than deleted because the inert shape is the one a reader copies.
 */
type AssertTrue<T extends true> = T

/**
 * `satisfies` above proves every VALUE listed is a real standing. It does not
 * prove the list is COMPLETE — this is what fails to compile when a sixth term
 * is added to the union and forgotten in the object.
 */
export type _EveryFindingStandingHasAKey = AssertTrue<
  [FindingStanding] extends [(typeof FINDING_STANDINGS)[keyof typeof FINDING_STANDINGS]]
    ? true
    : false
>

/** The named form of MatchGroup's previously inline outcome union. */
export type MatchGroupOutcome = 'matched' | 'exception' | 'unmatched'

/**
 * Facts assembled by the tenant-scoped reader; this pure derivation takes no
 * tenant and mints no grant — invariant 1 and invariant 10, #236 §7.
 *
 * A fourth arm is a compile error at `standingFor()` (TS2366: the function
 * stops returning on every path), which is the bite this union exists for.
 */
export type FindingBasis =
  | { kind: 'match_group'; outcome: MatchGroupOutcome }
  | {
      kind: 'exception'
      status: ExceptionStatus
      resolvedDispositionIsTerminal: boolean | null
      awaitingCounterpartyReply: boolean
    }
  | { kind: 'extraction'; fieldsBelowFloor: number }

/**
 * 🛑 A TOTAL `Record`, NOT A FALL-THROUGH, AND THE DIFFERENCE WAS MEASURED.
 * The first cut of this arm read `matched → closed`, `unmatched → no_recourse`,
 * `else → needs_authority`, so the `exception` outcome was reached by what was
 * LEFT OVER rather than by name — §5.1, a rule keyed on a convenient landmark
 * instead of the property it protects. A fourth outcome (`partially_matched`
 * was the planted mutation) then read as "a person owes a move" on the
 * register's own discriminator with `tsc` at EXIT 0 and every test green.
 * `MatchGroup.outcome` is the register's discriminator; a silent default on it
 * is a wrong word in the State column, not a missing one.
 */
export const MATCH_GROUP_OUTCOME_STANDING = {
  matched: 'closed',
  exception: 'needs_authority',
  unmatched: 'no_recourse',
} as const satisfies Record<MatchGroupOutcome, FindingStanding>

/**
 * How an `Exception` row's standing is reached. Three statuses are decided by
 * the status alone; four need a second fact, and each names WHICH fact rather
 * than falling into one.
 */
type ExceptionStandingRule =
  | { readonly from: 'status_alone'; readonly term: FindingStanding }
  | { readonly from: 'counterparty_reply' }
  | { readonly from: 'terminal_disposition' }

/**
 * 🛑 TOTAL OVER `ExceptionStatus` — AN EIGHTH STATUS IS A COMPILE ERROR HERE.
 * The first cut closed this arm with `return basis.awaitingCounterpartyReply
 * ? waiting : needs_authority`, keyed on what was left over rather than on
 * `open` and `investigating` by name. An eighth member (`escalated_to_regulator`
 * was the planted mutation) acquired `needs_authority` silently, `tsc` at
 * EXIT 0. `ExceptionStatus` is a seven-member union declared directly above;
 * this `satisfies` is what makes the eighth speak.
 */
export const EXCEPTION_STATUS_STANDING = {
  open: { from: 'counterparty_reply' },
  investigating: { from: 'counterparty_reply' },
  resolution_proposed: { from: 'status_alone', term: FINDING_STANDINGS.needsAuthority },
  pending_approval: { from: 'status_alone', term: FINDING_STANDINGS.needsAuthority },
  resolved: { from: 'terminal_disposition' },
  rejected: { from: 'status_alone', term: FINDING_STANDINGS.closed },
  dismissed: { from: 'status_alone', term: FINDING_STANDINGS.closed },
} as const satisfies Record<ExceptionStatus, ExceptionStandingRule>

/**
 * 🛑 THE FAILURE DIRECTION FOR AN UNWITNESSED COUNT IS A DECISION, AND IT IS
 * FAIL-CLOSED. The extraction arm's first cut was `fieldsBelowFloor > 0
 * ? below_floor : closed`, so `NaN` read as `closed` and `-1` read as `closed`
 * — both measured. That is the confidence-floor arm, the one that exists to say
 * a document is NOT trustworthy, resolving a garbage count into the most
 * reassuring word on the register. Readable-by-default-with-a-high-bar is scope
 * failing OPEN, which G106 and `docs/HANDOFF.md` §5.5 record this codebase
 * fixing once already, and which `AdmissionRefusal`'s `field_not_classified`
 * exists to prevent.
 *
 * A count is witnessed only if it is a non-negative integer. Anything else
 * derives `needs_authority`: nobody can tell whether the document cleared the
 * floor, so a PERSON owes the next move. It is deliberately not `below_floor`,
 * which would assert a fact this basis does not carry, and deliberately not a
 * thrown error, which would turn a register read into a 500.
 *
 * ⚠️ THE ALTERNATIVE IS NOT FORECLOSED AND IS NOT THIS SLICE'S TO TAKE. Giving
 * `FindingBasis` the refusal shape the reconciliation engine already uses —
 * `standingFor()` returning a verdict-or-refusal union — is the stronger
 * repair, and it changes the return type every caller and the wire enum would
 * mirror. G74 rules the vocabulary and the prohibition; it does not rule that.
 */
function isWitnessedFieldCount(count: number): boolean {
  return Number.isInteger(count) && count >= 0
}

/** Narrowed to `never` when every `ExceptionStandingRule` arm is handled. */
function unreachableStandingRule(rule: never): never {
  throw new Error(`unreachable exception standing rule: ${JSON.stringify(rule)}`)
}

export function standingFor(basis: FindingBasis): FindingStanding {
  switch (basis.kind) {
    case 'match_group':
      return MATCH_GROUP_OUTCOME_STANDING[basis.outcome]
    case 'extraction':
      if (!isWitnessedFieldCount(basis.fieldsBelowFloor)) return FINDING_STANDINGS.needsAuthority
      return basis.fieldsBelowFloor > 0 ? FINDING_STANDINGS.belowFloor : FINDING_STANDINGS.closed
    case 'exception': {
      const rule = EXCEPTION_STATUS_STANDING[basis.status]
      switch (rule.from) {
        case 'status_alone':
          return rule.term
        case 'terminal_disposition':
          return basis.resolvedDispositionIsTerminal === true
            ? FINDING_STANDINGS.closed
            : FINDING_STANDINGS.waiting
        case 'counterparty_reply':
          return basis.awaitingCounterpartyReply
            ? FINDING_STANDINGS.waiting
            : FINDING_STANDINGS.needsAuthority
        default:
          return unreachableStandingRule(rule)
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * Tenancy
 *
 * Flat tenants; partner is an attribute. A null partner_id means the tenant is
 * 1CloudHub-direct. Partner-sold and direct customers are structurally
 * identical — see docs/domain-model.md §2.
 * ------------------------------------------------------------------ */

/**
 * Who 1CloudHub invoices on a partner-sold tenant.
 *
 * Configurable per partner by decision of 4 Aug 2026, taken against the
 * recommendation of a single arrangement. The cost is real and is recorded
 * rather than hidden: two billing paths, retail rate cards become ours to
 * operate for `invoice_end_customer` partners, and every commercial query has
 * to respect this switch.
 *
 * What it must NOT become is a second, independent knob for visibility.
 * See partnerCommercialVisibility() in billing.ts — what a partner may see is
 * DERIVED from this, never configured beside it, because two settings
 * expressing one arrangement will drift.
 */
export const PARTNER_BILLING_ARRANGEMENTS = {
  /** We invoice the partner; the partner sets and keeps its own retail price. */
  invoicePartner: 'invoice_partner',
  /** We invoice the end customer; the partner takes commission. */
  invoiceEndCustomer: 'invoice_end_customer',
} as const
export type PartnerBillingArrangement =
  (typeof PARTNER_BILLING_ARRANGEMENTS)[keyof typeof PARTNER_BILLING_ARRANGEMENTS]

/**
 * On what basis a commission partner is paid.
 *
 * COMMERCIAL, NOT TECHNICAL — and the lever that settles the whole disclosure
 * question. A fixed per-tenant fee needs tenant count and active status and NO
 * SPEND AT ALL. A banded fee needs the band. Only a revenue share needs the
 * base, and therefore the volume.
 *
 * CHOOSING THE BASIS BEFORE TERMS HARDEN REMOVES THE PROBLEM RATHER THAN
 * MITIGATING IT. Afterwards it is not a design choice any more — it is a
 * renegotiation, and the model is left engineering around a disclosure that a
 * different fee structure would never have required.
 */
export const COMMISSION_BASES = {
  /** A flat fee per tenant sold. Needs a roster, and nothing else. */
  perTenantFixed: 'per_tenant_fixed',
  /** A fee that steps with the customer's spend. Needs which step, not where in it. */
  banded: 'banded',
  /** A percentage of the customer's spend. Needs the base. */
  revenueShare: 'revenue_share',
} as const
export type CommissionBasis =
  (typeof COMMISSION_BASES)[keyof typeof COMMISSION_BASES]

/* ------------------------------------------------------------------ *
 * Endpoints — where the platform reaches, in either direction
 *
 * ONE REGISTRY REPLACING FOUR LISTS. `DataEgressConfig.allowedDestinations`,
 * `CounterpartyEndpoint`, `TenantContact.address` and
 * `TelemetryExport.endpoint` each named an outside address, so the same
 * verification rule was enforced twice and not enforced at all twice; Slack and
 * Teams installs were modelled nowhere at all.
 *
 * WHY DIRECTION IS A FLAG AND NOT A CLASS. A mailbox you send to and a mailbox
 * you poll are the same mailbox. Direction is a property of the binding, not of
 * the object, so a taxonomy that splits "destination" from "connector" splits
 * one thing in two and then needs them to share a registry anyway — which is
 * the duplication that produced RoleKey vs Capability and PolicyReasonCode vs
 * ErrorCode.
 *
 * What genuinely differs is the GATE, and it keys off the flag:
 *
 *   inbound   a TRUST BOUNDARY. Ingested content is data, never instruction,
 *             so traffic needs admission. Note this is a live gap rather than
 *             a solved one: the trifecta rule is scoped to counterparty
 *             replies, and a connector-pulled document reaches extraction with
 *             no admission act at all.
 *
 *   outbound  a DISCLOSURE SURFACE. Needs a classification ceiling, a
 *             residency check, and a verified address.
 *
 * Adding `inbound` to an outbound endpoint is a WIDENING, and widening is an
 * act — the existing law, not a new rule for this type.
 * ------------------------------------------------------------------ */

export const ENDPOINT_DIRECTIONS = {
  /** We pull from it, or it pushes to us. Traffic requires admission. */
  inbound: 'inbound',
  /** We send to it. Traffic is bounded by a classification ceiling. */
  outbound: 'outbound',
  /** Both, and therefore both gates. Reaching this state is an act. */
  bidirectional: 'bidirectional',
} as const
export type EndpointDirection =
  (typeof ENDPOINT_DIRECTIONS)[keyof typeof ENDPOINT_DIRECTIONS]

export interface Endpoint extends TenantScoped {
  /**
   * BRANDED 7 Aug, slice 6, together with `Solution.endpointIds` and
   * `AgentToolBinding.endpointId` — the two fields that name it. Branding a
   * reference at a bare-string target checks nothing, so the pair had to move
   * in one edit.
   *
   * ⚠️ WHAT IT DOES NOT BUY IS ON `EndpointId` IN `kernel.ts` AND MATTERS HERE:
   * an `EndpointId[]` cannot check that the endpoints are the SAME TENANT's.
   * That is a composite `(tenantId, id)` foreign key in the schema, and this
   * row reaches a `credentialRef`.
   */
  id: EndpointId
  label: string
  direction: EndpointDirection
  /**
   * The address. Opaque here — a URL, a mailbox, a queue ARN, a workspace
   * install id. Never parsed for authorisation, and never pattern-matched.
   */
  address: string
  /**
   * The credential this endpoint resolves, if any. A REFERENCE — no field in
   * this model may hold key material, which is what makes the reference the
   * resource and `secret` its own class with no read mode.
   *
   * Binding or rotating it is `bind_secret`, never `configure_endpoint`.
   */
  credentialRef: string | null
  /**
   * Verification is the control, not hygiene. An unverified address is how an
   * outbound gate becomes decorative, and it is the same takeover vector DNS
   * verification closes for an IdentityConnection's domains.
   */
  verifiedAt: Timestamp | null
  verificationExpiresAt: Timestamp | null
  /**
   * Write-back into a foreign system, where the direction admits it. Separate
   * from `direction` deliberately: reading from SAP and posting to SAP are a
   * cliff, not a slope, and this flag is `enable_endpoint_writeback` —
   * `authority`, never reachable by a delivery grant.
   */
  writebackEnabled: boolean
  /**
   * Never later than the expiry of the authority that created it. An endpoint
   * keeps pulling after the grant that declared it lapses, which is the
   * property that distinguishes it from inert configuration.
   */
  boundUntil: Timestamp | null
  disabledAt: Timestamp | null
}

export interface Partner {
  id: PartnerId
  name: string
  status: EntityStatus
  createdAt: Timestamp
  /** Determines both who is invoiced and what this partner may see. */
  billingArrangement: PartnerBillingArrangement
  /**
   * How the commission is computed, and therefore what may be disclosed.
   *
   * Null under `invoice_partner` — a reseller has no commission, and
   * `PartnerCommercialTerms` is shaped so that combination is unrepresentable.
   * Non-null under `invoice_end_customer`, because the basis IS the disclosure
   * control: a fixed per-tenant fee needs tenant count and active status and NO
   * SPEND AT ALL; a banded fee needs the band; only a revenue share needs the
   * base, and therefore the volume.
   *
   * This is a commercial lever rather than a technical mitigation. Choosing it
   * before terms harden removes the problem; afterwards it is not a design
   * choice any more (§8.8).
   */
  commissionBasis: CommissionBasis | null
}

/**
 * Commercial entity. Holds the contract and the partner relationship, and
 * groups tenants for invoicing.
 *
 * Grants NO data access. Isolation remains flat — no tenant nests inside
 * another. A customer running finance and KYC gets two tenants under one
 * account: separate data, separate users, separate policy, one invoice.
 */
export interface Account {
  id: AccountId
  name: string
  /** null = 1CloudHub direct. Moved here from Tenant — a partner sells to a
   *  customer, not to an individual use case. */
  partnerId: PartnerId | null
  status: EntityStatus
  billingContactUserId: UserId | null
  createdAt: Timestamp
}

export interface Tenant {
  id: TenantId
  name: string
  /** Commercial parent. Partner affiliation derives from here. */
  accountId: AccountId
  enabledDomains: DomainKey[]
  status: EntityStatus
  createdAt: Timestamp

  /* --- governance --- */

  /** Sandbox tenants reject non-synthetic uploads. */
  environment: TenantEnvironment
  /**
   * Required when `environment` is 'evaluation'. Null otherwise.
   *
   * Its presence is what makes accepting real data defensible, so it is
   * enforced rather than assumed — see evaluationAcceptsIngest().
   */
  evaluation: EvaluationTerms | null
  /**
   * Whose account the data plane runs in. Orthogonal to `environment`:
   * a sandbox tenant is always `hosted`, but a hosted tenant need not be
   * a sandbox.
   */
  deploymentMode: DeploymentMode
  /**
   * The deployment serving this tenant. See model/deployment.ts.
   *
   * Null only between tenant creation and data-plane provisioning. A `byoa`
   * tenant with a null plane cannot transact — there is nowhere for it to run.
   */
  dataPlaneId: DataPlaneId | null
  /** Where this tenant's data is stored and processed. */
  residency: RegionKey
  /** PDPA Retention Limitation: cease retention once the purpose is served. */
  retention: RetentionPolicy
  /** Free-text purpose the tenant's data is processed for. PDPA notification. */
  processingPurpose: string
  /**
   * How 1CloudHub staff may reach this tenant's data.
   *
   * DEFAULTS TO 'granted_only' as of 5 Aug 2026 — a grant still needs two staff,
   * a stated justification and a notification, but not a customer approval step.
   * Blocking troubleshooting or delivery on a customer's internal process is not
   * acceptable, and it was the main reason delivery had no workable path.
   *
   * The stricter values remain because a regulated buyer may contract for them,
   * and 'never' is still honoured absolutely — support then works from telemetry
   * alone. Note that under BYOA this is only half ours: the cross-account role
   * trust policy lives in the customer's account.
   */
  supportAccessMode: 'granted_only' | 'granted_with_customer_approval' | 'never'
}

/* ------------------------------------------------------------------ *
 * Contacts — reach, not authority
 *
 * Three mechanisms assumed a reachable counterpart and no type held one: the
 * liveness state machine says "notify the customer's named contact", a support
 * grant may need the customer's approval, and four onboarding steps execute
 * inside the customer's own account. Fleet operations cannot escalate to a
 * person who does not exist in the record.
 *
 * THE SPLIT THAT MAKES THIS SMALL: only one of the three is an authenticated
 * act. Approving a support grant is a decision and stays a Membership with a
 * role, exactly as AutonomyDecision.decidedBy is a UserId. Everything else is
 * REACH — a way to contact a human who will mostly never log in, and forcing an
 * engineer who performs one key exchange into a Membership is friction at the
 * worst possible moment.
 *
 * So a TenantContact is an address with a duty attached. It authorises nothing.
 * ------------------------------------------------------------------ */

export const CONTACT_DUTIES = {
  /** Woken when a data plane goes unreachable or dark. */
  operations: 'operations',
  /** Told about support access, grants, breaches and disclosures. */
  security: 'security',
  /** Performs the onboarding steps inside the customer's own account. */
  technical: 'technical',
  /** Invoices, entitlement renewal, lease expiry. */
  billing: 'billing',
  /** The commercial escalation when operations has gone quiet for days. */
  commercial: 'commercial',
} as const
export type ContactDuty = (typeof CONTACT_DUTIES)[keyof typeof CONTACT_DUTIES]

/**
 * A duty, an address, and optionally who currently holds it.
 *
 * NAMED AS A DUTY RATHER THAN A PERSON, because people leave and a named
 * individual who has left makes escalation fail silently at three in the
 * morning — the failure mode that matters most and shows up least. The current
 * holder is recorded when known, so there is someone to hold to a response
 * time, but the duty survives them.
 *
 * Deliberately the same shape as CounterpartyEndpoint: a classified, verified
 * way to reach a human outside the request path. Not the same type — a
 * counterparty is party to a reconciliation, a contact is party to the
 * operation of the service — but the mechanics are identical and the parallel
 * is worth keeping visible.
 */
export interface TenantContact extends TenantScoped {
  id: string
  duty: ContactDuty
  /**
   * Escalation order within a duty, ascending. A plane that has been dark for
   * three days needs somewhere to go after the primary.
   */
  order: number
  address: string
  channel: 'email' | 'phone' | 'webhook'
  /** A contact address is usually personal data. Treat it as such. */
  dataClass: DataClass
  /** Null when the duty is held by a distribution list rather than a person. */
  holderName: string | null

  /**
   * Null blocks OUTBOUND notification to this address and nothing else.
   *
   * An unverified address is a phishing vector the moment we send to it — the
   * same reasoning as CounterpartyEndpoint.verifiedAt. Everything else warns
   * rather than blocks: a lapsed verification must never stop us reaching a
   * customer during an incident, which is the moment they most want us to.
   */
  verifiedAt: Timestamp | null
  /** Re-verification is due after this. Staleness is visible, never silent. */
  verificationExpiresAt: Timestamp | null
}

/**
 * Whether we may send to this contact right now.
 *
 * A function because every notification path must agree, and because the rule
 * is easy to state and easy to forget: verified, unexpired, or we do not send.
 */
export function mayNotifyContact(
  contact: TenantContact,
  now: Timestamp,
): boolean {
  if (contact.verifiedAt === null) return false
  if (contact.verificationExpiresAt === null) return true
  return contact.verificationExpiresAt > now
}

/**
 * The three things an evaluation tenant carries that production does not.
 *
 * Processing a prospect's real invoice makes us a processor of their personal
 * data, and invoices routinely name people. That needs an agreement in place
 * BEFORE the first upload, not after the deal — which is precisely the friction
 * the synthetic-only sandbox was built to avoid, and it does not disappear by
 * moving tenants around. So the agreement becomes a field.
 */
/** @dropped-for-v1 7 Aug 2026 — the evaluation environment posture ships no operation in v1. Declared, not built. */
export interface EvaluationTerms {
  /**
   * Reference to the executed data processing agreement.
   *
   * NULL BLOCKS NON-SYNTHETIC INGEST. The same enforcement point as the
   * synthetic flag, asking a different question — which turns a legal
   * precondition from a promise into something checkable before the first
   * document lands.
   */
  processingAgreementRef: string | null
  agreementExecutedAt: Timestamp | null
  /**
   * Agreed at the start, not negotiated at the end. Everything ingested is
   * purged on this date unless the tenant converts — and the purge obligation
   * is what makes accepting real data defensible in the first place.
   */
  purgeAt: Timestamp
  /** Set when the purge ran. A missing value after purgeAt is an incident. */
  purgedAt: Timestamp | null
  /**
   * Set when the evaluation became a paying tenant. Conversion is deliberate
   * and never automatic: data collected under an evaluation agreement
   * continuing under no agreement is the one outcome counsel objects to.
   */
  convertedAt: Timestamp | null
  /** Who at 1CloudHub owns getting this to a decision. */
  ownedByStaffUserId: UserId
}

/**
 * May this tenant accept a document with real personal data in it?
 *
 * One function for all three postures, because the three answers are easy to
 * state and easy to get wrong independently at three different call sites.
 */
/** @dropped-for-v1 7 Aug 2026 — reads EvaluationTerms, which nothing creates in v1. Declared, not built. */
export function acceptsNonSyntheticIngest(tenant: Tenant): boolean {
  if (tenant.environment === 'sandbox') return false
  if (tenant.environment === 'production') return true
  return (
    tenant.evaluation !== null &&
    tenant.evaluation.processingAgreementRef !== null &&
    tenant.evaluation.purgedAt === null
  )
}

/* ------------------------------------------------------------------ *
 * Retention — keyed by RECORD KIND, never by storage tier
 *
 * RE-KEYED 7 Aug 2026 (`docs/data-architecture.md` §8 deltas 2 and 3). This was
 * three entity-named fields — `sourceDocumentDays`, `exceptionDays`,
 * `auditDays` — and the standing request was to add five more. Adding five more
 * fields repeats the mistake: nothing forces a NEW retained kind to have an
 * answer, so the eight it eventually named would have been the eight somebody
 * remembered. `docs/model-change-ledger.md` P1-4 measured the cost of that —
 * `PolicyEvaluation` alone is ~1.41M rows per month per tenant, larger than the
 * metering table, and it was one of the at-least-five classes with no window.
 *
 * ⚠️ BREAKING, DELIBERATELY, AND HERE RATHER THAN LATER. `Tenant.retention`
 * changes shape. It is done before the schema is written because after that it
 * is a column rewrite plus a backfill over every tenant, and `SourceDocument
 * .purgeAfter` is computed AT INGEST from this policy — so every row already
 * written carries a date derived from the old shape and no migration can
 * recompute what the policy said at the time.
 *
 * `Record<RetentionClass, number>` is the whole point: the compiler demands a
 * value for every class, so a fourteenth class is a compile error at every
 * construction site rather than a silently unretained table.
 *
 * NOT CONFIGURED BESIDE S3, GENERATED FROM IT. `docs/data-architecture.md` §10.2
 * records that S3 lifecycle rules and this policy drift when maintained
 * separately; the object store's rules are an OUTPUT of this record.
 * ------------------------------------------------------------------ */

/**
 * Every class of record that has a retention answer.
 *
 * The list is `docs/data-architecture.md` §8, transcribed. It is keyed on what
 * a record IS, not on where it is stored — `AuditEvent` has operational volume
 * and is a business record, and getting that backwards is how an erasure
 * obligation quietly becomes unmeetable.
 */
export const RETENTION_CLASSES = {
  sourceDocument: 'source_document',
  /** A generated CSV or extract. Reachable by erasure only via SubjectLocation's `blob`. */
  export: 'export',
  /** A rasterised page. Same reasoning as `export`. */
  pageRender: 'page_render',
  exception: 'exception',
  matchGroup: 'match_group',
  approval: 'approval',
  auditEvent: 'audit_event',
  policyEvaluation: 'policy_evaluation',
  usageRecord: 'usage_record',
  dataAccessEvent: 'data_access_event',
  scoreResult: 'score_result',
  observedLabel: 'observed_label',
  trace: 'trace',
  /**
   * THE FOURTEENTH, G233, 23 Aug 2026 — and the one class here whose lifetime
   * is a CONDITION rather than a duration.
   *
   * Held work is work a person started and has not finished: #238's lapsed-session
   * draft and #239's unresolved uniqueness conflict. It exists until somebody
   * resolves it or abandons it, and it is neither an operational record nor an
   * audit record. **Two issues reached this question independently**, which is
   * the signal G233 read as structural rather than as two preferences, and the
   * ruling answers it ONCE: one class, used by both, minted by whichever half
   * lands first.
   *
   * 🛑 REUSE WAS REFUSED FOR A REASON, NOT ON TASTE. Reusing one of the
   * thirteen requires naming which one fits, and **if none does the reuse
   * encodes a wrong lifetime into data that then EXPIRES on it.** A retention
   * class is a deletion schedule, not a label.
   *
   * 🛑 THE ABANDONMENT RULE, WHICH G233 DEMANDS BY NAME: *"a class whose clock
   * never starts is a class that never expires."* Held work whose holder never
   * returns is the COMMON case, so the clock cannot wait on a resolve-or-abandon
   * event that nobody will ever send. G156 supplies the mechanism and
   * `model/held-work.ts` makes it executable:
   *
   *     purgeAfter = least(heldAt + maxOpenDraftAge, lastHeldAt + days.held_work)
   *
   * The window on this line is the SECOND operand — the idle one, measured from
   * the last touch. The first operand is an absolute cap fixed at creation that
   * no touch can move, and **it is what guarantees the clock starts at all**:
   * silence expires the row on the idle term, and continuous activity expires it
   * on the cap term. There is no third case.
   *
   * ⚠️ NAMED `held_work`, NOT `held_edit`, AND THE DIVERGENCE IS RECORDED RATHER
   * THAN SILENT. G156's ruled formula says `days.held_edit` and the 10 Aug design
   * records (`docs/build/stateless-green-user-artifacts.md`) carry `heldEdit`
   * throughout. **They are the same window.** G233 is the later ruling and it
   * mints the class for BOTH issues, and #239's ledger row is held work that
   * nobody is editing — so `held_edit` would have named half of what the class
   * holds, which is `docs/HANDOFF.md` §5.1 landmark substitution performed at the
   * moment of minting. The narrower name was rejected for that reason; anywhere
   * `days.held_edit` is written, read `days.held_work`.
   */
  heldWork: 'held_work',
} as const
export type RetentionClass =
  (typeof RETENTION_CLASSES)[keyof typeof RETENTION_CLASSES]

/**
 * The five record kinds of `docs/data-architecture.md` §8.
 *
 * `derived` is declared and currently names NO retention class, which is
 * correct rather than an omission: derived records (`QualityWindow`,
 * `CostAttribution`, `PartnerBillingSummary`) are recomputed from their inputs
 * and expire when those inputs do, so a window of their own would be a second
 * answer to a question already answered. It is declared so that a future
 * derived class with a genuine independent window has somewhere truthful to go,
 * rather than being filed under `operational` because that was the nearest fit.
 */
export const RETENTION_RECORD_KINDS = {
  business: 'business',
  operational: 'operational',
  derived: 'derived',
  content: 'content',
  telemetry: 'telemetry',
} as const
export type RetentionRecordKind =
  (typeof RETENTION_RECORD_KINDS)[keyof typeof RETENTION_RECORD_KINDS]

/**
 * Which kind each class is. TOTAL, so a fourteenth class must declare one.
 *
 * `score_result` and `observed_label` are `business` because §8's business row
 * lists *evaluation* among its members. That is the conservative direction: a
 * business classification pulls them under the audit floor below, and a
 * misclassification there lengthens a window rather than shortening one.
 */
export const RETENTION_RECORD_KIND: Record<RetentionClass, RetentionRecordKind> = {
  source_document: 'content',
  export: 'content',
  page_render: 'content',
  exception: 'business',
  match_group: 'business',
  approval: 'business',
  audit_event: 'business',
  policy_evaluation: 'operational',
  usage_record: 'operational',
  data_access_event: 'operational',
  score_result: 'business',
  observed_label: 'business',
  trace: 'telemetry',
  /**
   * `content`, and the choice is the conservative one for the same reason
   * `score_result` is `business`: a held draft holds whatever a person typed
   * into it — a counterparty's name, a mobile number, an unsubmitted rejection
   * reason — so it is payload, not a record ABOUT payload. `content` pulls it
   * under `AUDIT_MUST_OUTLIVE`, which is the direction that lengthens the audit
   * window rather than shortening a retention one.
   */
  held_work: 'content',
}

/**
 * Which kinds the audit window must outlive. TOTAL over the kinds.
 *
 * `docs/data-governance.md`: *"`auditDays` may never be shorter than
 * `exceptionDays` or `sourceDocumentDays`, or the record of a deletion outlives
 * nothing."* Those two were one business class and one content class, which is
 * exactly this pair generalised — the audit trail is the evidence that a
 * deletion happened, and evidence that expires before the thing it describes is
 * not evidence.
 *
 * Operational rows are PII-free by construction (`PolicyReasonCode`, not prose)
 * and telemetry lives in a backend with its own retention that we do not set,
 * so neither constrains the audit window.
 */
export const AUDIT_MUST_OUTLIVE: Record<RetentionRecordKind, boolean> = {
  business: true,
  content: true,
  operational: false,
  derived: false,
  telemetry: false,
}

/** PDPA Retention Limitation, expressed as one answer per retained class. */
export interface RetentionPolicy {
  /**
   * Days from the class's own triggering event — a run completing, an exception
   * being raised, an event being written. Not from a single tenant-wide clock.
   */
  days: Record<RetentionClass, number>
}

/**
 * Compile-time proof that both retention tables answer for EVERY class.
 *
 * ⚠️ THIS EXISTS BECAUSE NOTHING IN `model/` CONSTRUCTS A `RetentionPolicy`.
 * `Record<K, V>` totality is enforced at a CONSTRUCTION SITE, and there is none
 * — so relaxing `days` to `Partial<Record<RetentionClass, number>>`, or
 * narrowing it back to the three windows it replaced, would typecheck in
 * silence and the re-key would have bought exactly nothing. The same weakness
 * `FieldSpec.confidenceFloor` still carries (`docs/v1-scope-ledger.md` §4).
 *
 * The house pattern from `AssertContentless` (`learning.ts`) and
 * `AssertIdentity` (`identity.ts`): a constraint that either compiles or does
 * not, needing no test runner. Retire it the day a fixture or a migration
 * constructs a real policy — that is a stronger witness, not a redundant one.
 */
export type AssertAnswersEveryRetentionClass<
  T extends Record<RetentionClass, unknown>,
> = T

export type _RetentionPolicyAnswersEveryClass =
  AssertAnswersEveryRetentionClass<RetentionPolicy['days']>

export type _RetentionKindTableAnswersEveryClass =
  AssertAnswersEveryRetentionClass<typeof RETENTION_RECORD_KIND>

/** Why a proposed retention policy is not admissible. */
export type RetentionWindowViolation =
  /**
   * The audit trail would expire before the record whose deletion it evidences.
   */
  | {
      reason: 'audit_shorter_than_class'
      retentionClass: RetentionClass
      auditDays: number
      classDays: number
    }
  /**
   * A plan downgrade silently undercutting a floor is the failure
   * `docs/model-change-ledger.md` P1-12 exists for: the billing layer can
   * execute a compliance breach and never know it did.
   */
  | {
      reason: 'below_regulatory_minimum'
      retentionClass: RetentionClass
      days: number
      minimumDays: number
    }
  /** `Entitlement.retentionDaysMax`. A ceiling the plan bought, not a floor. */
  | {
      reason: 'exceeds_entitled_maximum'
      retentionClass: RetentionClass
      days: number
      maximumDays: number
    }
  | { reason: 'negative_window'; retentionClass: RetentionClass; days: number }

export type RetentionWindowVerdict =
  | { valid: true }
  | { valid: false; violations: RetentionWindowViolation[] }

/**
 * May this retention policy be saved?
 *
 * BOUNDS ARE PARAMETERS, NOT CONSTANTS, for the same reason `purgeVerdict()`
 * takes `regulatoryMinimumUntil`: a statutory minimum is per jurisdiction and
 * per pack — AML/CFT recordkeeping is not the same number as a tax record — and
 * a model constant would be wrong for the second customer and stale for the
 * first. The caller supplies what applies to this tenant.
 *
 * EVERY VIOLATION IS RETURNED, not the first. An admin who fixes one number,
 * resubmits, and is told about the next one takes four attempts to save a
 * policy — and the fourth rejection is where people start choosing whichever
 * numbers pass rather than the ones they meant.
 *
 * ⚠️ THIS VALIDATES A POLICY. It does not enforce one. Enforcement is
 * `purgeVerdict()` at sweep time and `SourceDocument.purgeAfter` at ingest, and
 * a policy that never passes through here is not caught by either.
 */
export function retentionWindowValid(
  policy: RetentionPolicy,
  bounds: {
    /** From `Entitlement.retentionDaysMax`. Null = unlimited. */
    entitledMaximumDays: number | null
    /** Per class. An absent class has no statutory floor we know of. */
    regulatoryMinimumDays: Partial<Record<RetentionClass, number>>
  },
): RetentionWindowVerdict {
  const violations: RetentionWindowViolation[] = []
  const auditDays = policy.days.audit_event

  for (const retentionClass of Object.values(RETENTION_CLASSES)) {
    const days = policy.days[retentionClass]

    if (days < 0) {
      violations.push({ reason: 'negative_window', retentionClass, days })
      continue
    }

    const minimumDays = bounds.regulatoryMinimumDays[retentionClass]
    if (minimumDays !== undefined && days < minimumDays) {
      violations.push({ reason: 'below_regulatory_minimum', retentionClass, days, minimumDays })
    }

    if (bounds.entitledMaximumDays !== null && days > bounds.entitledMaximumDays) {
      violations.push({
        reason: 'exceeds_entitled_maximum',
        retentionClass,
        days,
        maximumDays: bounds.entitledMaximumDays,
      })
    }

    if (
      retentionClass !== 'audit_event' &&
      AUDIT_MUST_OUTLIVE[RETENTION_RECORD_KIND[retentionClass]] &&
      days > auditDays
    ) {
      violations.push({
        reason: 'audit_shorter_than_class',
        retentionClass,
        auditDays,
        classDays: days,
      })
    }
  }

  return violations.length === 0 ? { valid: true } : { valid: false, violations }
}

/* ------------------------------------------------------------------ *
 * Federation — the org axis has to hang off something
 *
 * `IdentityProvider = 'cognito' | 'entra_1cloudhub'` named a KIND of provider,
 * and §8.3 asked it to derive which organisation a principal belongs to. A kind
 * cannot do that, because every customer shares `cognito`: partner staff and
 * customer users came out identical, and the derivation collapsed the two org
 * classes it exists to separate. An instance can, because an instance has an
 * owner. So the type shifts from kind to connection.
 *
 * THIS IS NOT OPENING A CLOSED SET. `protocol` stays closed. `owner` stays
 * closed at three variants. Only the list of instances is open — and instances
 * are data rather than vocabulary, the same relationship `Tenant` has to
 * `TenantEnvironment`. Nothing here lets a caller invent an org class.
 *
 * It also beats the `UserAffiliation` record §8.3 declined, on the ground §8.3
 * itself argued from: it is self-maintaining. Leave the company, lose the
 * directory, lose the org — no row for anyone to remember to update. And it
 * makes org a property of HOW YOU AUTHENTICATED rather than of who you are,
 * which is what the axis already claimed to be: computed from (principal,
 * tenant) at session establishment.
 *
 * Named consequence, accepted: the directory becomes load-bearing for an
 * authorisation decision, so an IdP misconfiguration is an authorisation bug.
 * ------------------------------------------------------------------ */

export const IDENTITY_PROTOCOLS = {
  saml: 'saml',
  oidc: 'oidc',
  /**
   * The managed fallback pool — PER ACCOUNT, never shared. A customer with no
   * directory of its own still has an OWNED connection, so org derivation stays
   * total and no exception is carved into it.
   */
  cognitoPool: 'cognito_pool',
} as const
export type IdentityProtocol =
  (typeof IDENTITY_PROTOCOLS)[keyof typeof IDENTITY_PROTOCOLS]

/* ------------------------------------------------------------------ *
 * G304 / G305 — THE BROKER HANDLE. Derived, 19 Sep 2026, applying G302.
 *
 * G302 rules that **Cognito is a BROKER for external IdPs** and that *"each
 * connection becomes an `identity_connection` row"*. A broker sits between the
 * customer's directory and this product, and it names each directory it
 * fronts: in Cognito's vocabulary that name is the user pool's identity
 * PROVIDER NAME. `docs/build/deploy-handoff.md` §5a states the gap this closes
 * in one sentence: *"`tenant.identity_connection` has no column that can hold a
 * Cognito provider name. Seven columns, none a broker handle."*
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 🛑 G304 — THE HANDLE IS A **PAIR**, AND THE PAIR IS THE WHOLE RULING. A
 *    PROVIDER NAME ALONE IS NOT AN IDENTITY.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * A Cognito provider name is unique **within one user pool** and nowhere else.
 * Two pools — staging and production, two regions, or a BYOA estate under
 * G276 — may each carry a provider named `acme-entra`, naming two different
 * directories owned by two different organisations. Storing the name alone
 * makes the broker handle a key that CAN COLLIDE ACROSS POOLS, and a collided
 * broker handle resolves to the wrong connection, which resolves to the wrong
 * `owner`, which resolves to the wrong `orgClass`. **G289 has already priced
 * that outcome at five deleted controls**, and it must not be reachable by a
 * second route.
 *
 * So the handle is `(brokerIssuer, brokerRef)`. The issuer is the pool's own
 * issuer URL — `https://cognito-idp.<region>.amazonaws.com/<poolId>` — and it
 * NAMESPACES the reference. This is `Role.key` needing `(packId, key)` one
 * table over, and `db/migrations/0011_federated_connection.sql` carries the
 * uniqueness as a partial index for the same reason 0009 does.
 *
 * ⚠️ BOTH ARE BARE `string` UNDER R1, NOT BRANDED, AND THAT IS THE STANDING
 * RULE RATHER THAN A SHORTCUT. `CLAUDE.md`: *"the string AWS mints stays a
 * string, because branding a foreign namespace claims an authority we do not
 * have."* The issuer URL is minted by Cognito; the provider name lives in
 * Cognito's namespace and is constrained by Cognito. Neither is ours to brand,
 * exactly as `ModelCatalogEntry.modelId` is not.
 *
 * ⚠️ AND THERE IS NO `audience`, NO `jwksUri` AND NO CLAIM MAP HERE — G306.
 * Those are read by TOKEN VERIFICATION and by nothing else, nothing in this
 * repository verifies a token, and `0004_subject_ledger.sql` refused a field
 * ahead of its reader at length. **They land in the commit that verifies a
 * token**, which is also the commit that can witness them being wrong.
 * ------------------------------------------------------------------ */

/**
 * WHERE THE BROKER KEEPS THIS DOOR. Non-null exactly when the protocol is a
 * brokered one — see `PROTOCOL_IS_BROKERED`.
 *
 * 🛑 THIS IS NOT A SECOND SOURCE OF `orgClass` AND MAY NEVER BECOME ONE. The
 * org axis derives from `owner` and from nothing else — invariant 2's whole
 * derivation rests on it. A broker handle says WHICH DOOR a token came
 * through; `owner` says WHOSE DOOR IT IS, and the second question is not
 * answerable from the first. A partner and a customer can be fronted by the
 * same broker; they are two rows with two owners.
 */
export interface BrokeredConnection {
  /**
   * The broker's own issuer. Namespaces `brokerRef`, because a provider name is
   * unique only within one pool. Stored verbatim; never parsed for a region, an
   * account or a pool id — that would be G179's *"a LOOKUP, never a parse"*
   * broken one table over.
   */
  readonly brokerIssuer: string
  /** The name the broker gives this directory. Cognito's `ProviderName`. */
  readonly brokerRef: string
}

/**
 * WHETHER A PROTOCOL'S DOOR IS REACHED THROUGH A BROKER — G305, derived from
 * G302 rather than invented here.
 *
 * 🛑 A TOTAL `Record`, SO A FOURTH PROTOCOL IS A COMPILE ERROR RATHER THAN A
 * SILENT `false`. That is the point of writing it this way and not as a
 * predicate over a list: the next protocol added to `IDENTITY_PROTOCOLS` has to
 * ANSWER this question, at this line, before it can exist.
 *
 * `saml` and `oidc` are **true** because G302 rules Cognito the broker for
 * external IdPs: *"COGNITO AS A BROKER FOR EXTERNAL IdPs, with ZERO identity
 * providers, so NOBODY CAN SIGN IN"*. There is no direct, unbrokered SAML or
 * OIDC path in this architecture and no code that could serve one.
 *
 * `cognito_pool` is **false** because that connection IS the pool — the managed
 * fallback directory, not a directory the pool fronts. A pool brokering itself
 * is not a relationship, and a broker handle on such a row would name nothing.
 *
 * ⚠️ THE ASSUMPTION THIS ENCODES IS NAMED RATHER THAN BURIED: it says every
 * external directory in this product is reached through our broker. **If a
 * direct OIDC connection is ever wanted, this is the line that has to change**,
 * and changing it is a visible edit to a total `Record` with a test on it —
 * which is the whole reason it is not a nullable column with no rule.
 */
export const PROTOCOL_IS_BROKERED: Record<IdentityProtocol, boolean> = {
  saml: true,
  oidc: true,
  cognito_pool: false,
}

/* ------------------------------------------------------------------ *
 * G231 — A DOMAIN CLAIM IS STORED STATE, AND THE ROUTE DECISION READS
 * NOTHING ELSE (owner ruling, 22 Aug 2026, rules #221)
 *
 * `domains` was `string[]`: no token, no timestamp, no verified flag. The
 * field's own comment called DNS TXT verification THE CONTROL while the type
 * had nowhere to put a verification result, so the control was prose and the
 * house pattern — `verifiedAt: Timestamp | null` on `Endpoint`, on
 * `TenantContact`, in `billing.ts` and in `correspondence.ts` — was on four
 * siblings and not on the one `Endpoint`'s docblock borrowed the argument from.
 *
 * 🛑 THE DECIDING FACT IS THAT THE ALTERNATIVE PUTS A THIRD PARTY ON THE
 * AUTHENTICATION HOT PATH. Re-querying DNS at every routing decision is always
 * current and has no staleness window — and it makes a DNS outage a SIGN-IN
 * outage, and a slow resolver a slow login, for every tenant at once. A control
 * that fails when someone else's infrastructure fails is not a control you may
 * put in front of the door. The digest is forced rather than preferred.
 *
 * DNS IS READ EXACTLY ONCE, AND NOT HERE: at verification, which is an
 * operator-initiated act off the sign-in path. Nothing below performs or admits
 * a lookup, and `mayRouteToConnection()` takes no clock either — see its own
 * note for why that is a property rather than an omission.
 *
 * 🛑 THIS DOES NOT OVERLOAD `domains`, per G179. A claim answers WHICH
 * DIRECTORY TO TRY. Which tenant is being served is a different question and a
 * different declaration; one field answering both is one field that can
 * disagree with itself.
 * ------------------------------------------------------------------ */

export const DOMAIN_CHALLENGE_ALGORITHMS = {
  hmacSha256: 'hmac_sha256',
} as const
export type DomainChallengeAlgorithm =
  (typeof DOMAIN_CHALLENGE_ALGORITHMS)[keyof typeof DOMAIN_CHALLENGE_ALGORITHMS]

/**
 * THE PROOF, NEVER THE PREIMAGE.
 *
 * WHAT IS HASHED: a token the platform mints and the operator publishes as a
 * DNS TXT record on the claimed domain. We hold it for as long as it takes to
 * hand it over and never again.
 *
 * WITH WHAT SALT: a key referenced by `keyRef` and scoped PER CONNECTION — the
 * same reasoning `SubjectKeyScheme` gives for a per-tenant HMAC key. A global
 * salt would make the digest itself a correlation surface across connections
 * and would let one precomputation serve every claim in the estate.
 *
 * `keyRef` IS A REFERENCE AND CARRIES NO KEY MATERIAL, which is the standing
 * rule `Endpoint.credentialRef` and `SubjectKeyScheme.keyRef` already hold. It
 * is deliberately NOT id-shaped and therefore invisible to the model graph:
 * branding it would claim it names something in this model, and it names a key
 * in a key manager that this model may not reach.
 *
 * Verification compares a freshly-read TXT value, HMAC'd under this key,
 * against `digest`. Equality is the whole of the check; the stored value proves
 * nothing on its own and is useless to anyone who takes it, which is the point.
 */
export interface DomainChallenge {
  algorithm: DomainChallengeAlgorithm
  /** A reference to the per-connection salt. Never the salt. */
  keyRef: string
  /** Lowercase hex of the HMAC. The token it was computed from is not stored. */
  digest: string
}

/**
 * One domain, one claim, one proof.
 *
 * RE-VERIFICATION SUPERSEDES RATHER THAN ACCUMULATES — `supersedeDomainClaim()`
 * below is the executable form, and the reason it is a function is that
 * `[...claims, fresh]` is what a person writes without thinking about it. An
 * accumulated list is a list of proofs EACH OF WHICH STILL VERIFIES: the oldest
 * challenge never stops being sufficient, so the set of parties holding a
 * usable proof only ever grows, and a re-verification prompted by suspicion
 * would leave the suspected proof in place.
 *
 * 🛑 `verificationExpiresAt` IS RECORDED AND NOTHING ROUTES ON IT, AND THAT IS
 * G231 DECLINING A DECISION RATHER THAN THIS DECLARATION FORGETTING ONE.
 * Blocking on lapse is the OPPOSITE POLARITY to `TenantContact`, which warns:
 * a lapsed contact verification must not stop us reaching a customer during an
 * incident, whereas a lapsed domain verification arguably must stop routing,
 * because the failure mode is a TAKEOVER rather than a missed message. It is
 * also the polarity that can lock a tenant out of its own directory on a
 * clerical failure. G231 says that reversal "needs its own argument rather than
 * arriving as a side effect of this row" and leaves it open on purpose.
 * `tests/model/domain-claim.test.ts` pins the current polarity by name so the
 * argument has to move a test rather than change behaviour quietly.
 */
export interface DomainClaim {
  /** Compared case- and space-folded. See `normaliseClaimedDomain()`. */
  domain: string
  challenge: DomainChallenge
  /**
   * Null is the whole control. PRESENCE IS NOT VERIFICATION: a claim carrying a
   * challenge digest is a claim on which verification was STARTED, which is
   * exactly the state a `claims.length > 0` guard reads as done.
   */
  verifiedAt: Timestamp | null
  /** Re-verification is due after this. Staleness is visible, never silent. */
  verificationExpiresAt: Timestamp | null
}

/**
 * DNS is case-insensitive and this comparison decides an ORG CLASS, so folding
 * is load-bearing rather than tidy: a case-sensitive compare lets `ACME.EXAMPLE`
 * be claimed a second time by somebody else with the ambiguity check below none
 * the wiser.
 */
export function normaliseClaimedDomain(domain: string): string {
  return domain.trim().toLowerCase()
}

/**
 * Whether this claim may route right now.
 *
 * A function for `mayNotifyContact()`'s reason — every routing path must agree,
 * and the rule is easy to state and easy to forget.
 *
 * ⚠️ IT DIVERGES FROM `mayNotifyContact()` IN ITS SIGNATURE AND THE DIVERGENCE
 * IS THE ARGUMENT. `mayNotifyContact(contact, now)` takes a clock because it
 * reads one. This takes none, because under G231 nothing here reads one — and a
 * function accepting a parameter it does not read is a lie about what decides.
 * The consequence is the point: deciding the open expiry question REQUIRES
 * changing this signature, which is a visible act with a test standing on it,
 * rather than a condition somebody slips into a body.
 *
 * Total over stored state: no clock, no lookup, no I/O, one line.
 */
export function mayRouteToConnection(claim: DomainClaim): boolean {
  return claim.verifiedAt !== null
}

/**
 * A re-verification REPLACES the claim on that domain. It never appends a
 * second one. A domain not yet held is appended, which is the only case in
 * which the list grows.
 */
export function supersedeDomainClaim(
  claims: readonly DomainClaim[],
  fresh: DomainClaim,
): readonly DomainClaim[] {
  const key = normaliseClaimedDomain(fresh.domain)
  const held = claims.some((claim) => normaliseClaimedDomain(claim.domain) === key)
  if (!held) return [...claims, fresh]
  return claims.map((claim) =>
    normaliseClaimedDomain(claim.domain) === key ? fresh : claim,
  )
}

/**
 * A registered directory. No password field anywhere near it, by design —
 * credentials live in the directory. The system being replaced returned other
 * users' passwords from list_users and cookied the whole object.
 */
export interface IdentityConnection {
  /** BRANDED 7 Aug, slice 6, with `User.connectionId` — the org axis derives from it. */
  id: IdentityConnectionId
  protocol: IdentityProtocol
  /**
   * THE OPERATOR'S OWN WORDS FOR THE DOOR. G232, 22 Aug 2026.
   *
   * 🛑 THE LABEL IS DATA, NEVER A DERIVATION, and no function anywhere may
   * compute one from `protocol`. `IDENTITY_PROTOCOLS` collapses Microsoft 365
   * and Google Workspace into `oidc`, so a screen deriving *Microsoft* from
   * `oidc` WILL PRINT IT OVER A GOOGLE CONNECTION. Deriving it is the landmark
   * substitution the record catalogues, keyed on the convenient field instead
   * of the property being protected.
   *
   * REQUIRED, NOT NULLABLE. A nullable label only moves the nothing-to-print
   * problem to render time, where the fallback has to be invented by whoever
   * writes the component — and it will be invented differently in each one, and
   * at least one of them will reach for `protocol`.
   *
   * 🛑 OPERATOR-WRITTEN, AND THAT HALF IS A SECURITY DECISION RATHER THAN A UX
   * ONE. A customer-authored label is COUNTERPARTY TEXT, and this string is
   * rendered on a platform support console — a staff surface. Invariant 6 says
   * ingested content is data, never instruction; this repository has ruled that
   * class for payloads and for bucket keys and NEVER for a configuration field
   * a staff console renders. Rather than open that class for a label, the label
   * is written by whoever configures the connection — platform or FDE. THE COST
   * IS STATED: the customer sees a name they did not choose. If that proves
   * unacceptable the answer is a SEPARATE customer-facing display field with the
   * counterparty-text question ruled explicitly, not a quiet widening of this
   * one.
   *
   * ⚠️ It is a bare `string` at a property position, so any containment
   * assertion pointed at a type reaching `IdentityConnection` will now fail.
   * That is correct and expected — a label IS text a person typed.
   */
  label: string
  /**
   * WHO THIS DIRECTORY BELONGS TO. The org axis derives from here.
   *
   * Server-set and immutable after creation: whoever could edit this could mint
   * principals of any organisation at will. One owner per connection is what
   * makes the derivation sound; many connections per one owner is fine, because
   * a group with subsidiaries or a post-acquisition estate legitimately runs
   * two directories. Two orgs may never share one connection.
   */
  owner:
    | { kind: 'platform' }
    | { kind: 'partner'; partnerId: PartnerId }
    | { kind: 'customer'; accountId: AccountId }
  /**
   * Verified by DNS TXT, and used for home-realm routing.
   *
   * VERIFICATION IS THE CONTROL, NOT A NICETY. Unverified claiming is a
   * takeover vector: a partner that registers a customer's domain captures
   * those logins AND the organisation those users resolve to. A realm-URL
   * override may select which connection TRIES — dual affiliation is real — but
   * it never widens: arriving at the platform realm cannot make anyone
   * `platform`, only the platform connection authenticating them can. Routing
   * chooses the door; the door decides.
   *
   * ⚠️ THIS WAS `string[]` UNTIL 22 Aug 2026 AND THE PARAGRAPH ABOVE IS LEFT
   * EXACTLY AS IT WAS WRITTEN, because it is the sentence that was true and
   * unimplementable at the same time: it called verification the control while
   * the type had nowhere to put a verification result. G231 gives it one.
   * `readonly` because supersession replaces a claim rather than editing one —
   * see `supersedeDomainClaim()`.
   */
  domains: readonly DomainClaim[]
  /**
   * WHERE THE BROKER KEEPS THIS DOOR — G304/G305, 19 Sep 2026, applying G302.
   *
   * 🛑 NON-NULL **EXACTLY WHEN** `PROTOCOL_IS_BROKERED[protocol]`, AND THE
   * "EXACTLY" IS BOTH DIRECTIONS. A brokered protocol with no handle is a door
   * nobody can walk through — the broker has no name for it, so no token it
   * issues can ever be resolved to this row. A `cognito_pool` row WITH a handle
   * claims the pool fronts itself. Both are refused by the reader, by name,
   * rather than tolerated: `server/data-plane/identity.ts`'s
   * `broker_unresolvable`.
   *
   * ⚠️ THE TYPE SYSTEM CANNOT STATE THE PAIRING AND THAT IS WHY THE REFUSAL
   * EXISTS. Making it a discriminated union over `protocol` would put the
   * protocol inside the union and give `IdentityConnection` two places to carry
   * one field — §5.3, where the copy is what drifts. The coherence is a RULE,
   * it is checked at the one seam that builds one of these from a row, and
   * `tests/db/identity-substrate.test.ts` §6 exercises every way it can fail.
   *
   * ⚠️ NOT A SOURCE OF ORGANISATION. See `BrokeredConnection`. The org axis
   * derives from `owner`; a broker handle names a door, never its owner.
   */
  federation: BrokeredConnection | null
  status: 'active' | 'disabled'
}

export const DOMAIN_ROUTING_REFUSALS = {
  domainNotClaimed: 'domain_not_claimed',
  domainNotVerified: 'domain_not_verified',
  connectionDisabled: 'connection_disabled',
  domainClaimedByMoreThanOneConnection: 'domain_claimed_by_more_than_one_connection',
} as const
export type DomainRoutingRefusal =
  (typeof DOMAIN_ROUTING_REFUSALS)[keyof typeof DOMAIN_ROUTING_REFUSALS]

/**
 * Routing chooses the door; the door decides. This returns an id, never a
 * connection, and never an org.
 */
export type DomainRouting =
  | { ok: true; connectionId: IdentityConnectionId }
  | { ok: false; refusal: DomainRoutingRefusal }

/**
 * Home-realm routing over stored state. Total, and fail-closed at every branch.
 *
 * THE PRECEDENCE IS THE DESIGN:
 *
 * 1. Nobody claims it → `domain_not_claimed`.
 * 2. Somebody claims it and nobody has proved it → `domain_not_verified`. This
 *    is the refusal #221's red test names, and it is why a `claims.length > 0`
 *    guard is the mutation to defend against.
 * 3. AMBIGUITY IS COUNTED OVER VERIFIED CLAIMS ONLY, and that asymmetry is
 *    deliberate. Two connections with a verified claim on one domain IS the
 *    takeover state — picking either picks an `orgClass` for the user, which is
 *    the reach invariant 2 exists to close, so it refuses. But if an UNVERIFIED
 *    claim counted towards ambiguity, anyone could take a tenant's sign-in down
 *    by claiming its domain and never proving it. A denial of service is not an
 *    improvement on a takeover.
 * 4. A disabled connection does not route even with a verified claim.
 *
 * A realm-URL override may still select which connection TRIES — dual
 * affiliation is real — but it never widens what this returns.
 */
export function routeToConnection(
  connections: readonly IdentityConnection[],
  domain: string,
): DomainRouting {
  const key = normaliseClaimedDomain(domain)

  const claimants = connections.filter((connection) =>
    connection.domains.some(
      (claim) => normaliseClaimedDomain(claim.domain) === key,
    ),
  )
  if (claimants.length === 0) {
    return { ok: false, refusal: DOMAIN_ROUTING_REFUSALS.domainNotClaimed }
  }

  const proved = claimants.filter((connection) =>
    connection.domains.some(
      (claim) =>
        normaliseClaimedDomain(claim.domain) === key &&
        mayRouteToConnection(claim),
    ),
  )
  if (proved.length === 0) {
    return { ok: false, refusal: DOMAIN_ROUTING_REFUSALS.domainNotVerified }
  }

  const live = proved.filter((connection) => connection.status === 'active')
  if (live.length === 0) {
    return { ok: false, refusal: DOMAIN_ROUTING_REFUSALS.connectionDisabled }
  }
  if (live.length > 1) {
    return {
      ok: false,
      refusal: DOMAIN_ROUTING_REFUSALS.domainClaimedByMoreThanOneConnection,
    }
  }

  const only = live[0]
  if (only === undefined) {
    return { ok: false, refusal: DOMAIN_ROUTING_REFUSALS.domainNotClaimed }
  }
  return { ok: true, connectionId: only.id }
}


/* ================================================================== *
 * THE SESSION LINE — #222 [A-2] and #223 [A-5], 22 Aug 2026
 *
 * MG1: "There is no session type at all. All four entry routes establish, hold
 * or end one; nothing in eighteen modules declares one." All three contract
 * tiers require `X-Session` and no path issues one. These two rows are what
 * every other slice in the identity track rests on.
 *
 * 🛑 WHY HERE AND NOT IN `model/session.ts`. That module declares SESSION
 * BOUNDS and it IMPORTS NOTHING — zero module specifiers, which is what makes
 * `MAX_AUTHORIZATION_SECONDS` in `access.ts` structurally unreachable from it
 * rather than merely discouraged. Its own header says so, and says what it is
 * deliberately not: "NO STORAGE SHAPE … That is a decision about a table and a
 * row, and this module declares neither." A `Session` there would need five
 * kernel imports and would end that property to buy a filing preference.
 * G225 permits a new module and does not require one.
 * ================================================================== */

/**
 * ⚠️ `declare const … : unique symbol` IS UNIQUE PER DECLARATION, which is why
 * this one is declared once and never copied. A second symbol would make two
 * `SessionHandleDigest` types mutually unassignable while printing identically
 * — the bewildering error `model/kernel.ts` warns about at length.
 *
 * MODULE-PRIVATE, deliberately. It is not exported, so the ONLY way to obtain a
 * `SessionHandleDigest` is a deliberate cast at the digest seam — and the seam
 * is where a reviewer looks. `model/learning.ts` makes the same argument for
 * `NormalisedDescription`.
 */
declare const sessionHandle: unique symbol

/**
 * THE SHADOW OF A CREDENTIAL, NEVER THE CREDENTIAL.
 *
 * A branded VALUE, not an `Id<>`: there is no `SessionHandle` entity, and
 * minting a table for a derived string is the defect `model/learning.ts`
 * records under `NormalisedDescription` ("inventing a table for a derived
 * string").
 *
 * 🛑 WHY THE PREIMAGE IS NEVER STORED. `IdentityConnection` above states the
 * rule and names the defect it comes from: "No password field anywhere near it,
 * by design — credentials live in the directory. The system being replaced
 * returned other users' passwords from list_users and cookied the whole
 * object." A session handle IS a credential in transit — possession lets you
 * make the next call, even though possession confers no authority — so a
 * database dump containing handles would be a session-hijack kit. It contains
 * digests.
 *
 * WHY A PLATFORM-WIDE KEY IS ACCEPTABLE HERE AND IS NOT FOR
 * `SubjectIndexEntry.subjectRef` in `model/governance.ts`, which is a
 * PER-TENANT HMAC because "a global key would turn the privacy index itself
 * into a cross-tenant correlation surface": that field's preimage is a
 * SUBJECT'S natural identifier, so one key correlates people across tenants. A
 * session handle's preimage is a value WE minted, for one session, that
 * identifies no person and recurs nowhere. There is nothing to correlate. The
 * key is also unavoidable at this point in the chain — the tenant is not yet
 * known, so a per-tenant key could not be selected.
 *
 * ⚠️ G160 KEYS THE ROW'S RLS PREDICATE ON THIS VALUE IN A GUC, NOT ON A ROW ID
 * VIA `SECURITY DEFINER` — the rejected alternative "becomes the most
 * security-relevant object in the schema", a standing widening. The cost G160
 * accepts is that the digest must be computed and carried on every request.
 * That is a fact about the migration and the request plane, neither of which is
 * this slice; it is recorded on the type because the type is what they will
 * both key on.
 */
export type SessionHandleDigest = string & {
  readonly [sessionHandle]: 'SessionHandleDigest'
}

/**
 * A SESSION — EVERYTHING A NODE NEEDS TO SERVE THE NEXT REQUEST WITH NO MEMORY
 * OF THE LAST ONE, AND NOTHING ELSE.
 *
 * INVARIANT 1, COPIED, NOT PARAPHRASED: "Tenant scope is derived from the
 * session, never read from a request." This row is what makes that sentence
 * mechanical. `tenantId` below is written by exactly one path and read by every
 * other; no request body anywhere may name a tenant.
 *
 * 🛑 NOT `TenantScoped`, DELIBERATELY, AND IT IS THE ONE STRUCTURAL FACT THE
 * WHOLE SURFACE TURNS ON. `tenantId` is null between authentication and
 * selection, so this row CANNOT be protected by the predicate every other
 * scoped table uses: `tenant_id = nullif(current_setting('app.tenant_id',
 * true), '')` in `db/migrations/0001_tenancy_and_rls.sql` evaluates to NULL
 * against a NULL column, and G100's polarity then denies UNCONDITIONALLY — the
 * row would be invisible to the very connection that just wrote it. The session
 * table gets its OWN policy, keyed on the digest under G160, with the SAME
 * deny-on-NULL polarity. `model/identity.ts` asserts the negative
 * (`_SessionIsNotTenantScoped`) so that `extends TenantScoped` is a compile
 * error rather than a code review.
 *
 * 🛑 NO CONTAINMENT ASSERTION IS POINTED AT THIS TYPE, AND THE REASON IS
 * MECHANICAL RATHER THAN AN OVERSIGHT. `Timestamp = string`
 * (`model/kernel.ts`), so `AssertNoPlainText` and `AssertNoTextDeep` both map
 * every one of the five timestamps below to `never` and FAIL rather than pass.
 * `Session` is the first timestamped type either guard has met. Do not reach
 * for one; `tests/model/session-containment.test.ts` holds the
 * `@ts-expect-error` witnesses that prove the failure, so the absence is
 * evidenced rather than assumed. What may be claimed instead is narrower and
 * true: the row carries no counterparty text — `issuedHost` is the only
 * non-timestamp `string` on it and it is platform configuration, argued on the
 * field.
 *
 * ELEVEN KEYS, AND THE NUMBER HAS MOVED TWICE.
 * `docs/build/stateless-green-session.md` settled the row at NINE with a
 * bidirectional key-set assertion; G180 added `issuedHost` (ten); G220
 * reversed that document's §6.4 and put `lastUsedAt` back (eleven).
 * `docs/HANDOFF.md` §3 outranks `docs/build/`. #222's body says ten and
 * predates G220.
 *
 * DELIBERATE ABSENCES, each load-bearing and each asserted in
 * `tests/model/session-shape.test.ts` rather than left to a reviewer: no
 * `orgClass` (below), no role, capability, `AssignmentScope` or
 * `TenantAccessGrantId` — all are derived per request and a stamp of a derived
 * fact is a second door — no IP, no user-agent, no email, no display name, no
 * `sessionToken`, and no `csrfToken`, which is derived from `handleDigest`
 * rather than stored beside it.
 *
 * 🛑 `orgClass` STAYS OFF THE ROW, AND THE ARGUMENT IS MECHANICAL, NOT
 * STYLISTIC. `redeemAuthorization()` (`model/access.ts`) denies on
 * `grant.orgClass !== principal.orgClass`, and THAT COMPARISON HAS MEANING ONLY
 * BECAUSE ONE SIDE IS A STAMP AND THE OTHER IS FRESHLY DERIVED. Store it here
 * and it compares a stamp against a copy of itself and passes forever — the
 * §5.6 shape produced by changing what an input MEANS rather than by deleting a
 * check. `User.connectionId`'s own comment already rules that org class is
 * derived "at session establishment and is never stored on the user"; storing
 * it one row over would be the same mistake with a different address.
 */
export interface Session {
  id: SessionId
  /**
   * THE LOOKUP KEY, AND THE RLS PREDICATE UNDER G160. Unique. The presented
   * `X-Session` value is digested by the caller and compared here.
   *
   * Two keys, deliberately and not redundantly: `id` is what an `AuditEvent` or
   * a `SignInAttempt` cites and may appear in a log; `handleDigest` is the
   * credential's shadow and appears in neither.
   */
  handleDigest: SessionHandleDigest
  userId: UserId
  /**
   * THE DOOR THAT AUTHENTICATED THIS SESSION.
   *
   * IT IS ON THE SESSION AND NOT ONLY ON THE USER because org is a property of
   * HOW YOU AUTHENTICATED, not of who you are: a dual-affiliated consultant is
   * partner on Monday and customer on Tuesday, and each session has to record
   * which. `User.connectionId` records the person's directory; this records the
   * door they came through. `OrgClass` derives from this connection's `owner`
   * on every resolve and is never stored — see the `orgClass` paragraph above.
   */
  connectionId: IdentityConnectionId
  /**
   * SERVER-SET, BY ONE PATH, AFTER AUTHENTICATION. Null until then, which is
   * why this interface is not `TenantScoped`.
   *
   * REQUIRED-AND-NULLABLE, NEVER OPTIONAL. Optional would let a wire payload
   * omit the key silently while `tsc` stayed green, which is
   * `model/learning.ts`'s argument applied to the one field whose absence is a
   * bypass.
   *
   * 🛑 THE PATH THAT WRITES IT IS A CHECK, NOT A CHOOSER — G210.
   * `selectTenantForSession()` validates that the principal may be scoped to
   * the tenant THE HOST HAS ALREADY BOUND; it does not offer a choice, and
   * `GET /session/tenants` and `POST /session/tenant` are DROPPED rather than
   * deferred, "because a deferred selection operation is a selector with a
   * later date on it." A login surface with a tenant selector defeats invariant
   * 1 by RELOCATION. Nothing in this slice mints one.
   *
   * A session with null here can reach nothing tenant-scoped: no
   * `set_config('app.tenant_id', …)` is ever issued, so RLS denies on NULL and
   * the failure is an EMPTY RESULT SET even if a handler forgets to check.
   */
  tenantId: TenantId | null
  /**
   * THE HOST THIS SESSION WAS ISSUED ON — G180, and the binding is PERMANENT.
   *
   * "The session record stores the host it was issued on, and any request whose
   * Host differs is refused and the session revoked." This is the control that
   * survives a hostile sibling: cookie tossing and subdomain takeover both work
   * by getting a browser to send the right cookie to the wrong place, and
   * neither survives a server-side host-equality check.
   *
   * ⚠️ OPAQUE SESSIONS DO NOT HELP HERE AND NO DOCUMENT MAY IMPLY THEY DO.
   * `model/access.ts` refuses the JWT shape deliberately — "A REFERENCE, NOT A
   * BEARER TOKEN" — which kills forgery and makes revocation instant. It does
   * NOTHING against fixation or tossing, because the attacker does not want the
   * victim's session; the attacker wants the victim on THEIRS. For a
   * reconciliation product the harm is exact: the victim uploads their own bank
   * statements into the attacker's tenant.
   *
   * 🛑 THE FIELD IS DECLARED HERE AND THE CHECK IS NOT WRITTEN HERE, and that
   * is deliberate rather than half-done. The check reads a request Host header,
   * which is the request plane's. What this slice fixes is that a session table
   * minted WITHOUT this field needs a migration to add it, under G88's
   * forward-only rule, on the one field G180 calls permanent.
   *
   * ⚠️ WHOEVER WRITES THAT CHECK: A HOST COMPARISON IS CASE-INSENSITIVE, and a
   * bare `!==` refuses a legitimate request on a capitalised Host.
   * `normaliseClaimedDomain()` above exists for the same reason one row over
   * and is the shape to copy. The failure is closed rather than open, which is
   * why it would be found by a customer and not by a test.
   *
   * A BARE `string`, and it is not counterparty text: it is the host the
   * PLATFORM issued the session on, written from validated configuration at
   * mint time, never echoed from the request that asked. It is also why no
   * contentless assertion can be pointed at this type without also tripping on
   * the timestamps — see the paragraph on the interface.
   */
  issuedHost: string
  authenticatedAt: Timestamp
  /**
   * @dropped-for-v1 22 Aug 2026 — federation owns the second factor. Declared, not built.
   *
   * G223: "The v1 answer to a second factor is that it is not ours to enforce."
   * Customers and partners bring their own identity provider, and the second
   * factor belongs to the directory that authenticates the person; shipping our
   * own beside it is a second authenticator competing with the customer's
   * policy.
   *
   * 🛑 WHAT IS BEING AVOIDED IS A FIELD WITH NO PRODUCER, which is the defect
   * #234 correctly filed. Written by nothing, this would read as "no second
   * factor was performed" forever — indistinguishable from "this system does
   * not do second factors", which is the true statement. IT IS DROPPED, NOT
   * DELETED, under the standing v1 discipline, and NOTHING MAY GIVE IT A
   * PRODUCER: `tests/model/session-shape.test.ts` sweeps every `model/*.ts` for
   * one and fails on the first.
   *
   * The rejected alternative is preserved with the obstacle that has to be
   * cleared first: platform-enforced TOTP plus a lockout was refused, and it is
   * not merely more work — `SignInAttempt` below deliberately carries no
   * `userId`, so a per-user attempt counter cannot live on it without
   * re-creating the user-existence oracle the realm lookup was designed to
   * avoid. Anyone reopening this must solve that first. A lockout is a separate
   * question and is NOT ruled by G223.
   */
  secondFactorAt: Timestamp | null
  /**
   * WHEN THIS SESSION WAS LAST USED — G220, and it is what makes
   * `SessionBounds.maxIdleSeconds` enforceable at all.
   *
   * ⚠️ THIS FIELD WAS RULED OFF THE ROW AND THEN BACK ONTO IT, AND BOTH SIDES
   * ARE RECORDED BECAUSE THE COST IS REAL.
   * `docs/build/stateless-green-session.md` §6.4 refused it: copying
   * `TenantAccessGrant.lastUsedAt` turns EVERY READ REQUEST INTO A WRITE and
   * holds a row lock for the request's duration — a grant is drawn a handful of
   * times per engagement, a session once per HTTP request. G220 reverses that
   * refusal, because "without it there is nothing to compare the clock against,
   * and `maxIdleSeconds` becomes a number the system holds and cannot act on."
   *
   * ⚠️ THE COST IS NOT WAVED AWAY BY THE REVERSAL.
   * `docs/build/stateless-application.md` S-4 records the answer the write cost
   * needs: write it AT MOST ONCE PER CONFIGURED INTERVAL, not per request, and
   * idle revocation is then accurate only to that interval — which must be
   * written on the field when the interval is ruled. No interval exists yet and
   * this slice does not invent one; `PRODUCT.md` forbids it.
   *
   * REQUIRED, NEVER NULL. A session that has never been used has been used
   * once — establishing it — so there is no state this field cannot represent,
   * and a nullable one would make the idle comparison branch on a case that
   * cannot occur.
   */
  lastUsedAt: Timestamp
  /**
   * Required, never null. "An open-ended grant is not a grant" is
   * `PartnerAccessGrant`'s rule, restated on `AuthorizationGrant.expiresAt`,
   * and a session is the longest-lived reference in the system so it is the
   * last place to relax it.
   *
   * ⚠️ THE NUMBER IS NOT HERE AND MAY NOT BE INVENTED, and it is no longer
   * missing either: G220 supplies it. `validateSessionBounds()` in
   * `model/session.ts` REFUSES ON ABSENCE and caps at
   * `PLATFORM_SESSION_CEILING` — 43200 seconds of life, 1800 of idle. This
   * field is the result of applying those to `authenticatedAt`; the arithmetic
   * needs the timestamp codec G111's shape calls for, and that codec is not
   * started.
   */
  expiresAt: Timestamp
  /**
   * Self-service sign-out, and nothing else. Revoking a person's ACCESS is
   * `User.status = 'disabled'` or the assignment — the digest-keyed policy
   * means nothing in the request plane can enumerate another principal's
   * sessions, which is a property rather than a limitation.
   *
   * G180's host check also writes here: a request whose Host differs is refused
   * AND the session revoked, which is why the field is on the row rather than
   * derived from an absence.
   */
  revokedAt: Timestamp | null
}

/**
 * MID-FLIGHT AUTHENTICATION STATE, DURABLE — the other half of the stateless
 * ruling, and the row #223 exists to mint.
 *
 * A federated sign-in has state BETWEEN the redirect and the callback: the
 * relay state, the nonce, the PKCE verifier, and which connection was chosen.
 * In a stateful server all of that lives in a process map or a signed cookie.
 * Without a durable row an OIDC callback that lands on a different node than
 * the redirect cannot be validated, which is precisely the node dependence the
 * stateless ruling exists to remove.
 *
 * 🛑 THIS IS GENUINELY NEW AND IT IS NOT A DUPLICATE NOUN, because the three
 * that already exist express none of it:
 *   — `Session` above begins the instant authentication SUCCEEDS. This row
 *     exists only before that instant and is destroyed at it.
 *   — `AccessSession` (`model/governance.ts`) is one period of actual use drawn
 *     against a `TenantAccessGrant`. It presupposes a grant, a tenant and a
 *     staff principal — three things that do not exist here.
 *   — `AskSession` (below) is a DOCUMENT of turns a human reads.
 *
 * SINGLE USE, AND THE ROW IS THE ENFORCEMENT. `consumedAt` is set in the SAME
 * transaction that mints the `Session`, under the row's own uniqueness — so a
 * replayed callback finds a consumed row and is refused. A process map could
 * not make that atomic across two nodes; a row can.
 *
 * 🛑 NO `userId`, AND THAT IS DELIBERATE RATHER THAN AN OMISSION. Before the
 * door answers there is no principal, and a `userId` written at redirect would
 * be a USER-EXISTENCE ORACLE on an UNAUTHENTICATED surface — the realm
 * operation is already required to return "no user-existence signal", and
 * `routeToConnection()` above holds that line by naming a domain and a
 * connection in every refusal and never a person. G223 names this same field as
 * the obstacle anyone reopening the second-factor question has to clear first:
 * a per-user attempt counter cannot live here without re-creating it.
 * `model/identity.ts` asserts the absence (`_SignInAttemptCarriesNoUserId`) so
 * that adding it is a compile error rather than a code review.
 *
 * NO CHALLENGE VALUE AND NO RELAY PARAMETER IS STORED IN THE CLEAR, only
 * digests — the same rule and the same reason as `Session.handleDigest`.
 */
export interface SignInAttempt {
  id: SignInAttemptId
  /** The lookup key. The relay/state parameter's DIGEST, never the parameter. */
  handleDigest: SessionHandleDigest
  /**
   * WHICH DOOR WAS CHOSEN, PINNED AT REDIRECT.
   *
   * A realm-URL override "selects which connection TRIES. It never widens" —
   * `IdentityConnection.domains` above says the same thing: routing chooses the
   * door; the door decides. Pinned rather than re-chosen at callback, because
   * re-choosing at callback lets a caller name a different connection than the
   * one it was sent to, and org class derives from a connection's owner. That
   * is the ORG AXIS READ FROM A REQUEST — invariant 1's shape, one axis over.
   */
  connectionId: IdentityConnectionId
  /**
   * The IdP's own nonce or PKCE verifier, digested. COMPARED, NEVER RE-DERIVED
   * — re-deriving it from anything the callback supplied would compare the
   * caller's value against itself.
   */
  challengeDigest: SessionHandleDigest
  startedAt: Timestamp
  /**
   * Required. Short. Same refuse-on-absent-configuration rule as
   * `Session.expiresAt`, and see `consumeSignInAttempt()` below for why nothing
   * in this module compares it yet.
   */
  expiresAt: Timestamp
  /** Set in the transaction that mints the `Session`. A replay finds it non-null. */
  consumedAt: Timestamp | null
}

/**
 * What a federated callback presents. Three digested or branded values and
 * nothing else — no tenant, no org, no user, no realm.
 *
 * ⚠️ IT CARRIES A `connectionId` PRECISELY SO THAT THE DISAGREEMENT IS
 * REPRESENTABLE. Dropping the field would make the mismatch inexpressible and
 * therefore impossible to refuse; ignoring it would be safe and INVISIBLE.
 * `consumeSignInAttempt()` refuses on it, so an attempt to name a different
 * door becomes a refusal somebody can count rather than a value quietly
 * discarded.
 */
export interface FederatedCallback {
  readonly handleDigest: SessionHandleDigest
  readonly connectionId: IdentityConnectionId
  readonly challengeDigest: SessionHandleDigest
}

/**
 * CLOSED. When `POST /session/federated` lands, these names mirror onto the
 * wire BY EXACT NAME — the same discipline `SESSION_BOUND_REFUSAL_REASONS`
 * states in `model/session.ts` — so renaming one here is a wire change.
 *
 * ⚠️ THERE IS NO `sign_in_attempt_expired` ARM AND ITS ABSENCE IS ARGUED ON
 * `consumeSignInAttempt()` below. An arm nothing can return is the shape G223
 * calls out one type over: a declaration with no producer.
 */
export const SIGN_IN_ATTEMPT_REFUSALS = {
  /** The callback was presented against a row it does not address. */
  signInAttemptHandleMismatch: 'sign_in_attempt_handle_mismatch',
  /** Already consumed. THE SLICE'S POINT: a replayed callback mints nothing. */
  signInAttemptReplayed: 'sign_in_attempt_replayed',
  /** The callback named a door other than the one the redirect pinned. */
  signInAttemptConnectionMismatch: 'sign_in_attempt_connection_mismatch',
  /** The IdP's challenge does not match the one stored at redirect. */
  signInAttemptChallengeMismatch: 'sign_in_attempt_challenge_mismatch',
} as const
export type SignInAttemptRefusal =
  (typeof SIGN_IN_ATTEMPT_REFUSALS)[keyof typeof SIGN_IN_ATTEMPT_REFUSALS]

/**
 * ⚠️ THE SUCCESS ARM RETURNS THE ATTEMPT'S CONNECTION, NOT THE CALLBACK'S, and
 * the redundancy is the point: the caller that supplied a `connectionId` gets
 * back the one the redirect pinned, so a handler wiring this up cannot
 * accidentally carry the supplied value forward.
 *
 * It returns NO `userId` and no tenant. Neither exists yet — that is what the
 * door is for.
 */
export type SignInAttemptConsumption =
  | { ok: true; connectionId: IdentityConnectionId }
  | { ok: false; refusal: SignInAttemptRefusal }

/**
 * Consume a sign-in attempt. Total, fail-closed at every branch, no I/O.
 *
 * 🛑 IT READS NO CLOCK, AND THE ABSENCE IS DELIBERATE. `mayRouteToConnection()`
 * above makes the identical argument for the identical reason: "a function
 * accepting a parameter it does not read is a lie about what decides." Here the
 * reason it does not read one is sharper — `Timestamp = string`, so any expiry
 * comparison in the model is a LEXICAL string comparison, right for ISO-8601 in
 * UTC with a fixed number of fractional digits and silently wrong for anything
 * else. G220's row says the timestamp codec is its own work under G111's
 * one-codec-module discipline and is not started; `model/session.ts` says in
 * its own header, "Do not add a comparison to this file; add the codec."
 * THE CONSEQUENCE IS THE POINT: adding expiry REQUIRES changing this signature,
 * which is a visible act with a test standing on it, rather than a comparison
 * somebody slips into a body. `SignInAttempt.expiresAt` is therefore a field
 * this slice DECLARES and does not yet read, which is stated here rather than
 * left to be discovered.
 *
 * ✅ AND THE ATTEMPT EXPIRES ANYWAY, SINCE 1 Oct 2026 — D6-6, THE OWNER'S
 * RULING, G2201. **NOTHING ABOVE IS FALSE AND THIS FUNCTION IS UNCHANGED**:
 * it still reads no clock and there is still no `sign_in_attempt_expired`
 * arm. The expiry is the DATABASE's — `db/migrations/0240_sign_in_attempt_expiry.sql`
 * puts a RESTRICTIVE policy on `tenant.sign_in_attempt` comparing `now()`
 * against `expires_at` and `started_at + SIGN_IN_ATTEMPT_TTL_MINUTES`, as
 * `timestamptz` — so an expired attempt never reaches this function, and the
 * caller answers `sign_in_attempt_absent`. ⚠️ The model-only alternative was
 * refused on `0035`'s precedent: a row valid in the database protects nothing
 * that does not go through the model. So `expiresAt` is still not read HERE,
 * and is now read where the type is honest.
 *
 * THE ORDER IS THE DESIGN, and each branch answers a different question:
 *
 * 1. Does this callback even address this row? The handle digest is the lookup
 *    key; a mismatch means the pair was assembled wrong, or probed.
 * 2. HAS IT ALREADY BEEN USED? Checked before the pinned facts, deliberately,
 *    so that a replayed callback carrying a tampered connection reports the
 *    replay — the fact about the row — rather than the tampering, which is a
 *    fact about the caller. Both refuse; only one names what the system knows.
 * 3. Is it the door the redirect pinned? REFUSED rather than ignored: ignoring
 *    the supplied value would be equally safe and would leave no evidence the
 *    attempt was made.
 * 4. Is it the challenge stored at redirect?
 */
export function consumeSignInAttempt(
  attempt: SignInAttempt,
  callback: FederatedCallback,
): SignInAttemptConsumption {
  if (callback.handleDigest !== attempt.handleDigest) {
    return { ok: false, refusal: SIGN_IN_ATTEMPT_REFUSALS.signInAttemptHandleMismatch }
  }
  if (attempt.consumedAt !== null) {
    return { ok: false, refusal: SIGN_IN_ATTEMPT_REFUSALS.signInAttemptReplayed }
  }
  if (callback.connectionId !== attempt.connectionId) {
    return { ok: false, refusal: SIGN_IN_ATTEMPT_REFUSALS.signInAttemptConnectionMismatch }
  }
  if (callback.challengeDigest !== attempt.challengeDigest) {
    return { ok: false, refusal: SIGN_IN_ATTEMPT_REFUSALS.signInAttemptChallengeMismatch }
  }
  return { ok: true, connectionId: attempt.connectionId }
}



/**
 * `isStaff: boolean` was deleted 5 Aug. It is
 * `connection.owner.kind === 'platform'` — derived, and a stored copy of a
 * derived fact is a copy that can disagree with the fact. Being staff still
 * grants NOTHING by itself: reaching a customer tenant requires a
 * TenantAccessGrant, and deriving the flag rather than storing it does not
 * soften that rule, it removes the field someone could have set by hand.
 */
export interface User {
  id: UserId
  email: string
  displayName: string
  /**
   * LOAD-BEARING as of 5 Aug, and it was not before.
   *
   * Nothing consulted it — `assignmentGrants()` took no `User` at all — so a
   * disabled user's assignments evaluated as granted. Federation narrows that
   * and does not close it: a directory stops a departed person AUTHENTICATING
   * and does nothing to the rows that say what they may do, which is why §9.4
   * pairs SCIM push with a manual disable path for the connections that have
   * no SCIM.
   */
  status: 'active' | 'disabled'
  /**
   * The directory that authenticated them. Replaces `identityProvider`.
   *
   * Org class is DERIVED from this connection's owner at session establishment
   * and is never stored on the user — a stored org is a second door that
   * outlives the directory membership it was copied from.
   */
  connectionId: IdentityConnectionId
}

/**
 * The authorization primitive. Roles are per-tenant, never global.
 *
 * `partnerScope: PartnerId | null` and `viaGrantId: string | null` were deleted
 * 5 Aug, together with the clamp they fed.
 *
 * The clamp — `effectivePartnerRole()` in governance.ts — opened on the null
 * case: `if (partnerScope === null) return membershipRole`. So a partner-staff
 * membership that simply omitted the field was returned UNCLAMPED, and the
 * check meant to close the second door was satisfied by not mentioning it. That
 * is authority read from a FIELD rather than derived from the session — the
 * same class of error as reading `tenantId` out of a request payload, which
 * this model refuses everywhere else and had made an exception for here.
 *
 * Partner scope now derives from the session's `IdentityConnection.owner` and
 * is checked against a live `PartnerAccessGrant`. There is nothing left to
 * omit. It also fixes the case §9.5 names: a person who moved from the partner
 * to the customer no longer keeps grant-derived assignments evaluated under the
 * old org, because no row records the old org.
 */
export interface Membership {
  /**
   * ADDED 7 Aug (G35). A membership is REVOKED AND RETAINED rather than deleted,
   * so `(userId, tenantId)` was never a key: the same pair recurs every time a
   * person is re-granted, and the comment on `revokedAt` says so — a transfer
   * between partners is meant to leave both rows. Without an address the second
   * grant and the first were indistinguishable to anything citing one.
   */
  id: MembershipId
  userId: UserId
  tenantId: TenantId
  /**
   * MIGRATED 7 Aug 2026. Was `role: RoleKey` — a bare `'approver'` that any
   * pack's role keyed `approver` satisfied under a string comparison. `RoleId`
   * is `Id<'Role'>` and addresses ONE row, whose identity is `(packId, key)`,
   * so the collision is not expressible: there is no string to compare.
   *
   * RENAMED as well as retyped, to `roleId`. The house convention is that an
   * id-shaped name carries a branded id (`RoleAssignment.roleId` is the same
   * field in its successor), and it is the rename rather than the retype that
   * makes the reference visible to `tools/planner/extract.mjs` — a field named
   * `role` carrying a branded id is an edge no tool in this repository can see.
   *
   * ⚠️ A POINTER, NOT A SECOND GRANT, and the distinction is load-bearing.
   * `RoleAssignment` in access.ts is the authority record: it pins
   * `roleVersion`, so a pack upgrade that adds `approve_resolution` to a role
   * cannot retroactively promote a live holder, and it carries an
   * `AssignmentScope`, which is what narrows a capability to a cost centre or a
   * legal entity. This field pins no version and carries no scope. Anything
   * that resolves authority MUST resolve it from `RoleAssignment`; if a
   * resolver ever reads this field instead, the version pin and the scope are
   * both silently discarded and the membership row becomes a second door — the
   * exact shape of the `partnerScope` defect recorded above.
   *
   * It survives the enum's deletion only because `Membership` has not yet given
   * way to `RoleAssignment`, and that migration is its own decision, not a side
   * effect of this one.
   */
  roleId: RoleId
  grantedBy: UserId
  grantedAt: Timestamp
  /** Partner-scoped memberships must expire. Null only for direct staff. */
  expiresAt: Timestamp | null
  /** Retained rather than deleted, so a transfer between partners is auditable. */
  revokedAt: Timestamp | null
}

/* ------------------------------------------------------------------ *
 * The invitation — #235 [A-14], 24 Aug 2026, under G229
 * ------------------------------------------------------------------ */

/**
 * A STANDING OFFER OF THE `Membership` ABOVE, ADDRESSED TO AN EMAIL.
 *
 * MG7, `docs/model-gaps.md`: *"No invitation type. No invite row, no expiry, no
 * accept-or-decline transition. `/invite` draws a flow whose state has nowhere
 * to live."* `/invite` is one of the four entry routes and was the only one the
 * identity track otherwise left with nothing to point at, which is why the
 * passkey-enrolment question could record that it had *"no surface, and no
 * invitation type to enrol against."*
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 G229 — AN INVITATION IS REDEEMED, NOT MINTED
 * ══════════════════════════════════════════════════════════════════════════
 *
 * *"The inviter's act carries the `AuthorizationGrant`; acceptance redeems
 * it."* Someone holding `manage_users` invites; `authorize()` mints the grant
 * THEN, by THEM; `grantId` below carries its address; and acceptance redeems a
 * grant that already exists.
 *
 * THE ALTERNATIVE WOULD HAVE REQUIRED AMENDING ONE OF THE ELEVEN, which is why
 * this was a ruling rather than a filing decision. Invariant 10: *an act with
 * no authorisation is unrecordable.* `AUTHORIZATION_MAY_BE_ABSENT` permits
 * exactly one actor kind — `system` — and an invitee is not `system`. So
 * *acceptance mints the `Membership`* would have made a person's act the
 * authorising act, and the only way to record it would be to widen that
 * constant to a second actor kind. It is one of invariant 10's enforcement
 * points; widening it to make a flow convenient is the shape §5 catches.
 *
 * ⚠️ AND IT MAKES THE AUDIT READ CORRECTLY, WHICH MATTERS MORE THAN THE
 * MECHANISM. `Membership.grantedBy` above ends up naming the person who
 * CONFERRED the authority. Under the rejected shape it would name the
 * RECIPIENT as the actor who granted themselves access — a true-looking
 * sentence about the wrong person.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE CONSEQUENCE G229 SAYS TO DESIGN DELIBERATELY RATHER THAN DISCOVER
 * ══════════════════════════════════════════════════════════════════════════
 *
 * *"A grant minted at invitation time is live before anyone accepts, so it
 * needs an expiry and a revocation path, and an unredeemed grant must be
 * visible as such."* All three land here and none of them lands on the grant:
 *
 *   EXPIRY       `expiresAt` below. Required, never null, and refused on
 *                absence rather than defaulted — see `acceptInvitation()`.
 *   REVOCATION   `revokedAt` below. It cannot live on the grant, because
 *                `AuthorizationGrant` is IMMUTABLE ONCE WRITTEN — that is what
 *                lets three record streams reference it instead of copying the
 *                principal out of it. An append-only table has no revoke.
 *   VISIBILITY   `invitationStanding()` below, which distinguishes an
 *                unredeemed grant from a redeemed one and from an expired one.
 *                Without it the grant ledger reads as conferred access nobody
 *                holds.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT IS DELIBERATELY NOT HERE, AND THE FIRST ONE IS THE LANDMARK TRAP
 * ══════════════════════════════════════════════════════════════════════════
 *
 * NO CLOCK TAKEN FROM `MAX_AUTHORIZATION_SECONDS`. `manage_users` is
 * `authority`, whose ceiling is 300 seconds, so the grant an inviter mints
 * expires five minutes later. THAT IS NOT THE INVITATION'S CLOCK AND MUST NOT
 * BE READ AS ONE. `MAX_AUTHORIZATION_SECONDS`'s own docblock says it bounds *"a
 * single authorised act, and the right unit is the time one act plausibly
 * takes"*; `model/session.ts` devotes a capitalised section to the identical
 * substitution one row over, calling it *"§5.1's landmark substitution exactly
 * — a rule keyed on a convenient nearby constant instead of the property it
 * protects."* An invitation's window is not an act. It is the period during
 * which a person who does not yet have an account may come and get one, and
 * that number belongs to a deployment, not to this file. `PRODUCT.md` forbids
 * inventing it and nothing here does.
 *
 * ⚠️ THE COST OF THAT IS STATED RATHER THAN HIDDEN, AND IT IS THE ONE OPEN
 * QUESTION THIS SLICE HANDS BACK. Because the invitation is not bounded by the
 * grant's expiry, `acceptInvitation()` has NO `invitation_authorisation_lapsed`
 * arm — an invitation accepted on day three redeems a grant that expired on day
 * one. The reading taken is that THE CONFERRAL WAS THE INVITER'S ACT AND IT
 * COMPLETED WHEN THEY PERFORMED IT: the grant records an act that happened, and
 * `redeemAuthorization()` — which does refuse an expired grant — is a different
 * function for a different question, and could not be used here anyway because
 * it binds the PRINCIPAL to the grant's subject, who is the inviter. If the
 * owner rules the other way, the change is one added arm and one added
 * comparison; nothing else in this block moves.
 *
 * NO EMAIL COMPARISON AT ACCEPTANCE. The handle in the link is the credential —
 * `handleDigest` is its shadow, exactly as `Session.handleDigest` is — and
 * possession of the link is what acceptance tests. Comparing the accepting
 * session's email against `email` below would add a second, weaker credential
 * AND make the operation answer whether a given address holds an invitation,
 * which is a user-existence signal on a surface reached before a session
 * exists. G251 accepted a DOMAIN-existence signal on the realm lookup for a
 * stated reason — *"domains are public and users are not"* — and that reason
 * runs the other way here.
 *
 * 🛑 THE RESIDUE THAT TRAVELS WITH THAT AND IS NOT INVENTED AWAY: whoever
 * obtains the link can accept the invitation. G251's row already records *"the
 * undecided handle-delivery channel travels with it"*, and this is the same
 * undecided channel reached from the other end. It is the threat model's under
 * G165, not this slice's.
 *
 * NO WIRE. Two operations would sit on the session tier and ONE OF THEM IS
 * UNAUTHENTICATED — accepting an invitation happens before a session exists —
 * which puts it squarely inside G165's gate: *"the D6 threat-model gate lands
 * before the first unauthenticated endpoint."* G165 is `not applied`. The model
 * lands; the wire waits, and it waits for a reason rather than for a turn.
 */
export interface Invitation extends TenantScoped {
  id: InvitationId
  /**
   * THE LOOKUP KEY, AND THE CREDENTIAL'S SHADOW. The value in the invitation
   * link is digested by the caller and compared here; the link itself is stored
   * nowhere. Same rule and same reason as `Session.handleDigest` and
   * `SignInAttempt.handleDigest`.
   *
   * Two keys, deliberately: `id` is what the inviter's `AuthorizationGrant`
   * names as its resource and what an `AuditEvent` may cite; this is the
   * credential and appears in neither.
   */
  handleDigest: SessionHandleDigest
  /**
   * WHO IT WAS SENT TO — the delivery address, and NOT a check.
   * `acceptInvitation()` never reads it, for the reason argued on the interface
   * above. It is here because the row has to record who was invited for the
   * roster to be reviewable, and because a revoked invitation nobody can name
   * is a revocation nobody can perform.
   *
   * A BARE `string`, matching `User.email` one interface over rather than
   * inventing a second representation for the same thing.
   */
  email: string
  /**
   * WHAT THEY ARE BEING INVITED TO. Copied verbatim onto the `Membership` at
   * acceptance — `Membership.roleId`'s own comment carries the rest, including
   * why a `RoleId` rather than the deleted `RoleKey`: `RoleId` addresses ONE
   * row, whose identity is `(packId, key)`, so a pack whose role is also keyed
   * `approver` is not a collision anybody can express.
   */
  roleId: RoleId
  /**
   * 🛑 THE `AuthorizationGrant` THE INVITER MINTED, AND THE WHOLE OF G229 IN
   * ONE FIELD. The authorising act is theirs and it is recorded before the
   * invitee has done anything at all.
   *
   * `acceptInvitation()` requires the grant PRESENTED to be the one named here,
   * in this tenant, for `manage_users`, ON THIS INVITATION. The last of those
   * is `redeemAuthorization()`'s resource binding — *"one grant, one thing"* —
   * and without it a single `manage_users` grant redeems every invitation in
   * the tenant, which is the tenant's whole membership roster reached through
   * one authorisation for one act.
   */
  grantId: AuthorizationGrantId
  invitedAt: Timestamp
  /**
   * WHEN THE OFFER STOPS STANDING. Required, never null.
   *
   * *"An open-ended grant is not a grant"* is `PartnerAccessGrant`'s rule,
   * restated on `AuthorizationGrant.expiresAt` and again on `Session.expiresAt`.
   * An invitation is an offer of authority made to somebody who does not exist
   * to the system yet, so it is the last place to relax it.
   *
   * ⚠️ THE NUMBER IS NOT HERE AND MAY NOT BE ADDED HERE. G139's posture:
   * *"a bound with no number is not a bound … It is never silently unbounded,
   * which is the outcome a default would produce."* `acceptInvitation()`
   * REFUSES on an unparseable or absent value rather than treating it as
   * far-future, and the refusal it returns carries no number of its own.
   */
  expiresAt: Timestamp
  /**
   * WHAT `Membership.expiresAt` WILL BE. Copied through verbatim, decided by
   * the inviter, never decided here.
   *
   * 🛑 AND THE REASON IT IS NOT VALIDATED HERE IS WORTH THE PARAGRAPH.
   * `Membership.expiresAt` rules that *"partner-scoped memberships must expire.
   * Null only for direct staff."* Whether the resulting membership is
   * partner-scoped depends on the INVITEE's org class, which derives from the
   * connection that authenticates THEM — and acceptance does not have it, by
   * design: `Session.connectionId`'s comment rules that org *"is a property of
   * HOW YOU AUTHENTICATED"* and is derived per request, never stamped. Deriving
   * it from the INVITER's grant instead would be authority read off the wrong
   * side of the transaction, which is the `partnerScope` defect `Membership`
   * above already records being deleted for.
   *
   * So the check has no home in this function and is left undone rather than
   * done wrongly. It is named in the PR as an open item.
   */
  membershipExpiresAt: Timestamp | null
  /**
   * SINGLE USE, AND THE ROW IS THE ENFORCEMENT — `SignInAttempt.consumedAt`'s
   * discipline exactly. Set in the same transaction that mints the
   * `Membership`, under the row's own uniqueness, so a replayed acceptance
   * finds a consumed row.
   *
   * ⚠️ IT IS NOT THE EXPIRY CHECK AND MUST NOT BE MISTAKEN FOR ONE. #235 names
   * that mutation as the likeliest defect in the whole slice: *"check
   * `acceptedAt === null` and stop. The type already implies single use, so the
   * check is decorative and the test passes while an indefinitely-old
   * invitation still mints authority."* Every invitation that was never
   * accepted satisfies this field, including the ones that expired years ago.
   * `tests/model/invitation.test.ts` carries a named test that fails on that
   * alone.
   */
  acceptedAt: Timestamp | null
  /**
   * THE REVOCATION PATH G229'S CONSEQUENCE REQUIRES, and it lives here because
   * it cannot live on the grant: `AuthorizationGrant` is *"IMMUTABLE ONCE
   * WRITTEN, which is what makes it safe for the three streams to reference it
   * rather than duplicate the principal."* An append-only table cannot be
   * revoked; the offer drawn against it can.
   *
   * RETAINED RATHER THAN DELETED, matching `Membership.revokedAt` — a withdrawn
   * invitation is a thing that happened and the roster review should show it.
   */
  revokedAt: Timestamp | null
}

/**
 * THE CAPABILITY AN INVITER MUST HOLD.
 *
 * Declared as a `Capability` rather than a bare string SO THAT A TYPO IS A
 * COMPILE ERROR. It is not imported from `CAPABILITIES` in `model/access.ts`
 * because that is a VALUE, and this module's header rules that a value import
 * from `./access` would be a real runtime cycle where the existing `import
 * type` emits nothing.
 */
export const INVITATION_CAPABILITY: Capability = 'manage_users'

/**
 * CLOSED. When the two `/invite` operations land — behind G165 — these names
 * mirror onto the wire BY EXACT NAME, the same discipline
 * `SIGN_IN_ATTEMPT_REFUSALS` above and `SESSION_BOUND_REFUSAL_REASONS` in
 * `model/session.ts` both state. Renaming one here is a wire change.
 *
 * ⚠️ THERE IS NO `invitation_authorisation_lapsed` ARM, AND THE ABSENCE IS
 * ARGUED ON THE INTERFACE ABOVE RATHER THAN LEFT TO BE NOTICED. It is the arm a
 * reader expects from the word "redeems"; it is absent because the grant's
 * ceiling bounds an ACT and not an offer, and adding it would import
 * `MAX_AUTHORIZATION_SECONDS` as the invitation's clock through the back door.
 *
 * 🛑 EVERY ARM BELOW IS REACHABLE AND A TEST HOLDS THAT LINE. *"An arm nothing
 * can return is the shape G223 calls out one type over: a declaration with no
 * producer."*
 */
export const INVITATION_REFUSALS = {
  /** Presented against a row it does not address. The lookup key disagreed. */
  invitationHandleMismatch: 'invitation_handle_mismatch',
  /** Already redeemed. THE SLICE'S SECOND POINT: a replay mints nothing. */
  invitationAlreadyAccepted: 'invitation_already_accepted',
  /** Withdrawn by the tenant before anybody came for it. */
  invitationRevoked: 'invitation_revoked',
  /** The grant presented is not the one this invitation names. */
  invitationAuthorisationMismatch: 'invitation_authorisation_mismatch',
  /** The grant was minted in another tenant. Invariant 1, at the last moment. */
  invitationAuthorisationTenantMismatch: 'invitation_authorisation_tenant_mismatch',
  /** The grant carries some other verb. One grant, one capability. */
  invitationAuthorisationCapabilityMismatch: 'invitation_authorisation_capability_mismatch',
  /** The grant authorises a DIFFERENT invitation. One grant, one thing. */
  invitationAuthorisationResourceMismatch: 'invitation_authorisation_resource_mismatch',
  /** The caller supplied no readable clock. G139: refuse, never assume. */
  invitationClockNotStated: 'invitation_clock_not_stated',
  /** The row carries no readable expiry. G139: a bound with no number is not a bound. */
  invitationExpiryNotStated: 'invitation_expiry_not_stated',
  /** THE SLICE'S FIRST POINT. Past its expiry, however recently it was made. */
  invitationExpired: 'invitation_expired',
} as const
export type InvitationRefusal = (typeof INVITATION_REFUSALS)[keyof typeof INVITATION_REFUSALS]

/**
 * WHAT AN ACCEPTING CALLER PRESENTS.
 *
 * 🛑 NO `tenantId`, AND THAT IS INVARIANT 1 RATHER THAN TIDINESS. #235:
 * *"Acceptance happens before a session exists, so nothing in that flow may
 * take a tenant from the request body except the invitation's own row, which
 * the server issued."* The tenant is read off `Invitation` above and there is
 * no field here through which a caller could offer a different one.
 *
 * 🛑 NO `grantedBy`, AND THAT IS G229'S AUDIT PROPERTY HELD STRUCTURALLY. The
 * conferring actor is read off the GRANT — a caller that can name the conferrer
 * can name the wrong one, and the wrong one the rejected shape would have named
 * is the invitee themselves.
 *
 * `userId` is the person who just authenticated through their directory, taken
 * from the established session and never from a payload; `membershipId` is
 * supplied for the reason `AuthorizationRequest.id` is — *"this module is
 * stack-neutral and holds no id source; inventing one here would be the first
 * piece of runtime this model owns, and it would be the wrong piece."*
 */
export interface InvitationRedemption {
  readonly handleDigest: SessionHandleDigest
  readonly userId: UserId
  readonly membershipId: MembershipId
  readonly at: Timestamp
}

/**
 * A REASONED UNION, NEVER A BOOLEAN — #235 says so in those words, and
 * `Authorization` in `model/access.ts` follows the same *"scope travels with
 * the answer"* discipline for the same reason: a caller that reads one field
 * cannot act on a refusal.
 */
export type InvitationAcceptance =
  | { ok: true; membership: Membership }
  | { ok: false; refusal: InvitationRefusal }

/**
 * REDEEM AN INVITATION. Total, fail-closed at every branch, no I/O.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 IT READS A CLOCK, AND `consumeSignInAttempt()` ABOVE DOES NOT — THE
 * DIFFERENCE IS DELIBERATE AND IS THE ONE THING TO UNDERSTAND BEFORE EDITING
 * ══════════════════════════════════════════════════════════════════════════
 *
 * That function refuses a clock because *"`Timestamp = string`, so any expiry
 * comparison in the model is a LEXICAL string comparison, right for ISO-8601 in
 * UTC with a fixed number of fractional digits and silently wrong for anything
 * else"*, and `model/session.ts` ends the same argument with **"Do not add a
 * comparison to this file; add the codec."** That reasoning is correct and it
 * is about the LEXICAL form.
 *
 * THIS FUNCTION DOES NOT COMPARE LEXICALLY. It parses both sides to
 * milliseconds and compares numbers, which is what `authorize()` in
 * `model/access.ts` already does — *"an expiry of `NaN` compares false against
 * every clock, so a token built on one would never expire"* — and refuses on
 * `NaN` at each side rather than letting one through. Parsing handles offsets,
 * variable fractional digits and the `Z`/`+00:00` split, all three of which a
 * lexical `<=` gets silently wrong. `Date.parse` is not the codec G111 calls
 * for and this does not pretend to be one; it is the same interim shape
 * `authorize()` uses, at the same strength, and when the codec lands both call
 * sites move together.
 *
 * THE CLOCK IS A PARAMETER AND NOT A READ. `redemption.at`, exactly as
 * `PrincipalContext.now` is a parameter *"so a decision is reproducible in an
 * audit"*. Nothing here calls `Date.now()`.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE ORDER IS THE DESIGN, and each group answers a different question
 * ══════════════════════════════════════════════════════════════════════════
 *
 *   1. DOES THIS EVEN ADDRESS THE ROW? The handle digest is the lookup key; a
 *      mismatch means the pair was assembled wrong, or probed.
 *
 *   2. WHAT IS TRUE OF THE ROW — accepted, revoked. Checked before anything
 *      about the caller, deliberately, so that a replayed acceptance carrying a
 *      tampered grant reports the REPLAY — the fact about the row — rather than
 *      the tampering, which is a fact about the caller. `consumeSignInAttempt()`
 *      above makes the identical choice for the identical reason. Both refuse;
 *      only one names what the system knows.
 *
 *   3. IS THE AUTHORISATION THE ONE THIS INVITATION NAMES? Four bindings, and
 *      they are `redeemAuthorization()`'s four MINUS the principal binding —
 *      see the paragraph below, because that omission is the ruling itself and
 *      is the single most likely thing for a later reader to "fix".
 *
 *   4. IS THE OFFER STILL STANDING? Both clocks refuse on absence before either
 *      is compared, so an unreadable timestamp can never read as far-future.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 THE PRINCIPAL BINDING IS ABSENT ON PURPOSE. DO NOT ADD IT.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `redeemAuthorization()` binds PRINCIPAL because *"possession is not
 * authority"* — without it a grant id is a bearer token in everything but name.
 * That is right there and would be catastrophic here, because THE GRANT'S
 * SUBJECT IS THE INVITER. Comparing it against the accepting user would refuse
 * every acceptance that ever occurs, and it would look like hardening while
 * doing it. G229 is precisely the ruling that these two principals differ:
 * *"the inviter holds the capability"*, the invitee holds the link.
 *
 * What replaces it is the RESOURCE binding — the grant must name THIS
 * invitation — plus the handle digest, which is the invitee's credential.
 * `tests/model/invitation.test.ts` pins the absence with an accepting user who
 * is deliberately not the grant's subject.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT THE SUCCESS ARM MINTS, AND WHAT IT CANNOT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * A `Membership` and nothing else. `grantedBy` is `grant.subjectUserId` — read
 * off the authorisation, never supplied — which is G229's audit property made
 * mechanical. Invariant 8 holds by construction rather than by check: staff
 * reach is a `TenantAccessGrant` and this function has no arm that returns one,
 * so an invitation cannot become a second route to it.
 *
 * ⚠️ IT MINTS NO `AuthorizationGrant`, AND THAT IS INVARIANT 10 RATHER THAN AN
 * OMISSION. `authorize()` is the only thing that mints one; a second minting
 * path would break the invariant outright. The grant this redeems was minted
 * there, by the inviter, before this function was ever reachable.
 */
export function acceptInvitation(
  invitation: Invitation,
  grant: AuthorizationGrant,
  redemption: InvitationRedemption,
): InvitationAcceptance {
  const refuse = (refusal: InvitationRefusal): InvitationAcceptance => ({ ok: false, refusal })

  if (redemption.handleDigest !== invitation.handleDigest) {
    return refuse(INVITATION_REFUSALS.invitationHandleMismatch)
  }

  if (invitation.acceptedAt !== null) {
    return refuse(INVITATION_REFUSALS.invitationAlreadyAccepted)
  }
  if (invitation.revokedAt !== null) {
    return refuse(INVITATION_REFUSALS.invitationRevoked)
  }

  if (grant.id !== invitation.grantId) {
    return refuse(INVITATION_REFUSALS.invitationAuthorisationMismatch)
  }
  if (grant.tenantId !== invitation.tenantId) {
    return refuse(INVITATION_REFUSALS.invitationAuthorisationTenantMismatch)
  }
  if (grant.capability !== INVITATION_CAPABILITY) {
    return refuse(INVITATION_REFUSALS.invitationAuthorisationCapabilityMismatch)
  }
  if (grant.resource.resourceId !== invitation.id) {
    return refuse(INVITATION_REFUSALS.invitationAuthorisationResourceMismatch)
  }

  const atMs = Date.parse(redemption.at)
  if (Number.isNaN(atMs)) {
    return refuse(INVITATION_REFUSALS.invitationClockNotStated)
  }
  const expiresMs = Date.parse(invitation.expiresAt)
  if (Number.isNaN(expiresMs)) {
    return refuse(INVITATION_REFUSALS.invitationExpiryNotStated)
  }
  /*
   * `<=` rather than `<`, matching every other expiry comparison in the model
   * (`grant.expiresAt <= now` in `decide()`, in `effectivePartnerCapabilities()`
   * and in `redeemAuthorization()`). An invitation expiring exactly now is
   * expired.
   */
  if (expiresMs <= atMs) {
    return refuse(INVITATION_REFUSALS.invitationExpired)
  }

  return {
    ok: true,
    membership: {
      id: redemption.membershipId,
      userId: redemption.userId,
      tenantId: invitation.tenantId,
      roleId: invitation.roleId,
      /* G229. THE INVITER, off the grant. Never `redemption.userId`. */
      grantedBy: grant.subjectUserId,
      grantedAt: redemption.at,
      expiresAt: invitation.membershipExpiresAt,
      revokedAt: null,
    },
  }
}

/**
 * WHAT AN UNREDEEMED GRANT LOOKS LIKE FROM THE LEDGER — G229's third
 * consequence, and the one with no field of its own.
 *
 * *"An unredeemed grant must be visible as such"*, because otherwise the grant
 * ledger reads as conferred access nobody holds: every invitation ever sent
 * shows an `AuthorizationGrant` for `manage_users` and nothing distinguishes
 * the ones that were taken up from the ones that lapsed unopened.
 *
 * 🛑 DERIVED AND NEVER STORED. `User.connectionId` rules the general case one
 * interface family over — *"a stored copy of a derived fact is a copy that can
 * disagree with the fact"* — and a status column on the row would need a writer
 * for the expiry transition, which has no event to hang on.
 */
export const INVITATION_STANDINGS = {
  /** Live and unredeemed. The grant is conferred access nobody holds YET. */
  pending: 'pending',
  /** Redeemed. A `Membership` exists and the grant did its work. */
  accepted: 'accepted',
  /** Withdrawn before anybody came for it. */
  revoked: 'revoked',
  /** The offer lapsed. The grant is conferred access nobody will ever hold. */
  expired: 'expired',
  /**
   * 🛑 THE ARM THAT KEEPS G139 HONEST HERE. An unreadable or absent expiry is
   * NOT `pending`: reading it that way would render an unbounded invitation as
   * a normally awaited one, which is exactly the *"silently unbounded"* outcome
   * a default produces. The ledger says it cannot tell, and somebody fixes the
   * row.
   */
  unstated: 'unstated',
} as const
export type InvitationStanding = (typeof INVITATION_STANDINGS)[keyof typeof INVITATION_STANDINGS]

/**
 * Total, pure, and ordered the same way `acceptInvitation()` is: what happened
 * to the row outranks what the clock says, because an accepted invitation that
 * has since passed its expiry is ACCEPTED, not expired — the membership it
 * minted does not evaporate.
 */
export function invitationStanding(invitation: Invitation, at: Timestamp): InvitationStanding {
  if (invitation.acceptedAt !== null) return INVITATION_STANDINGS.accepted
  if (invitation.revokedAt !== null) return INVITATION_STANDINGS.revoked
  const atMs = Date.parse(at)
  const expiresMs = Date.parse(invitation.expiresAt)
  if (Number.isNaN(atMs) || Number.isNaN(expiresMs)) return INVITATION_STANDINGS.unstated
  return expiresMs <= atMs ? INVITATION_STANDINGS.expired : INVITATION_STANDINGS.pending
}

/**
 * Everything below is tenant-scoped. tenantId is derived server-side from an
 * authenticated session and is never read from a request payload.
 */
/**
 * A pack-time validation failure. Checked when a pack is signed rather than at
 * runtime — the same discipline as the archetype constraints, and for the same
 * reason: a rule that only fires in production is a rule that ships broken.
 */
export interface ProcedureViolation {
  stepId: ProcedureStepId
  rule: 'untrusted_to_outbound_without_human' | 'admitting_agent_carries_tools'
  detail: string
}

/**
 * The trifecta rule.
 *
 * Private data + untrusted content + external communication in one actor is the
 * combination that lets an injected instruction exfiltrate. Our admitting agent
 * carries no tools, which breaks the combination at admission — but it
 * REASSEMBLES one step later, when the resolution agent reads the now-admitted
 * reply, holds the exception, and sits in a procedure that can reach a notify
 * step.
 *
 * So: from any step where free-form untrusted text enters, every path to an
 * outbound notification must pass through a human step. A human step launders
 * the path because a person read it and chose to send.
 *
 * Scoped deliberately to `counterparty_reply`. Extracted document values also
 * originate outside the tenant, but they are constrained by FieldSpec and typed
 * as scalars, whereas a counterparty reply is unbounded prose written by
 * someone who may want something. Widening this to all extracted data would
 * make it unsatisfiable, and an unsatisfiable rule gets switched off.
 */
export function validateProcedureInjectionSafety(
  procedure: Procedure,
): ProcedureViolation[] {
  const byId = new Map(procedure.steps.map((step) => [step.id, step]))
  const out: ProcedureViolation[] = []

  /**
   * DERIVED FROM THE GRAPH, never supplied by the caller.
   *
   * This took a list of admitting step ids as a parameter until 5 Aug, which
   * meant the check could be switched off by passing an empty array — and the
   * caller with the strongest motive to pass one is the caller authoring a
   * procedure whose admitting agent carries tools. Half the rule was derived
   * and half was declared; the declared half was decorative.
   *
   * An admitting step is now simply an agent step whose action is `admit`.
   * There is nothing to omit.
   */
  for (const step of procedure.steps) {
    if (
      step.kind === 'agent' &&
      step.action === 'admit' &&
      step.toolScope.length > 0
    ) {
      out.push({
        stepId: step.id,
        rule: 'admitting_agent_carries_tools',
        detail: 'An agent that admits inbound content must carry no tools.',
      })
    }
  }

  /**
   * Every node where untrusted text ENTERS — not where the graph waits.
   *
   * This filtered on `await` alone until a vertical-slice review on 5 Aug.
   * Admission does not require an await step: a procedure of
   * agent(admit) -> agent(propose_resolution) -> notify produced zero entries,
   * walked no edges and passed the gate clean, while doing exactly the thing
   * the gate exists to stop.
   *
   * That is the same defect as the admittingStepIds parameter removed hours
   * earlier, one node over — the rule was keyed on a convenient landmark
   * instead of on the property it cares about. The property is "untrusted
   * content is now in scope", and admission is what puts it there.
   */
  const entries = procedure.steps.filter(
    (step) =>
      (step.kind === 'await' && step.waitingFor.kind === 'counterparty_reply') ||
      (step.kind === 'agent' && step.action === 'admit'),
  )

  for (const entry of entries) {
    const seen = new Set<ProcedureStepId>([entry.id])
    const queue: ProcedureStepId[] = [entry.id]
    while (queue.length > 0) {
      const current = queue.shift()
      if (current === undefined) break
      for (const edge of procedure.edges) {
        if (edge.from !== current || seen.has(edge.to)) continue
        const next = byId.get(edge.to)
        if (next === undefined) continue
        /**
         * A human launders the path only if they were SHOWN the content.
         *
         * Kind alone is not enough: a human step with an empty requiredEvidence
         * never renders the untrusted text, so treating it as a laundering node
         * makes the control satisfiable by inserting a rubber stamp.
         */
        if (next.kind === 'human' && next.requiredEvidence.includes('correspondence')) {
          continue
        }
        if (next.kind === 'notify') {
          out.push({
            stepId: next.id,
            rule: 'untrusted_to_outbound_without_human',
            detail:
              `Outbound step '${next.id}' is reachable from untrusted content ` +
              `at '${entry.id}' with no intervening human step.`,
          })
          continue
        }
        seen.add(edge.to)
        queue.push(edge.to)
      }
    }
  }

  return out
}

/* ------------------------------------------------------------------ *
 * Tagging — governance and chargeback
 *
 * CostAttribution can already report by cost centre and Budget can already be
 * scoped to one. What was missing is where a cost centre COMES FROM.
 * UsageRecord.costCenter was described as "customer-defined, opaque to the
 * platform" with nothing saying who sets it, from what vocabulary, or at which
 * point in a run — which is the difference between chargeback that reconciles
 * and chargeback that is argued about.
 *
 * Free-form tags do not roll up. A declared schema is the whole mechanism.
 * ------------------------------------------------------------------ */

export const TAG_PURPOSES = {
  /** Rolls up in CostAttribution and may scope a Budget. */
  chargeback: 'chargeback',
  /** Filtering, reporting and access review. Never priced. */
  governance: 'governance',
} as const
export type TagPurpose = (typeof TAG_PURPOSES)[keyof typeof TAG_PURPOSES]

/** Where a tag value may be set. Order in TagKeySpec.settableAt is precedence. */
export type TagOrigin =
  | 'tenant'
  | 'definition'
  | 'document_type'
  /** Set as the document arrives — the channel or the sender implies it. */
  | 'intake'
  | 'run'

export interface TagKeySpec {
  key: string
  purpose: TagPurpose
  required: boolean
  /**
   * Closed vocabulary. An empty array means free text, which does NOT roll up
   * usefully and should be rare — a typo becomes a new cost centre.
   */
  allowedValues: string[]
  /** Permitted origins, most specific first. The first that supplies a value wins. */
  settableAt: TagOrigin[]
}

/**
 * The tenant's declared tag schema.
 *
 * Deliberately per-tenant: a customer's cost centres are their org chart, and
 * the platform must not know anything about it beyond the key names.
 */
export interface TagPolicy extends TenantScoped {
  keys: TagKeySpec[]
  /**
   * Which key resolves to UsageRecord.costCenter — and, since 7 Aug 2026, to
   * `Exception.costCentre`.
   *
   * Exactly one, or chargeback is ambiguous. Null means this tenant does not do
   * chargeback, which is a legitimate answer and better than a guessed key.
   */
  chargebackKey: string | null
  /**
   * Which key resolves to `Exception.legalEntity`. ADDED 7 Aug 2026.
   *
   * THIS IS THE PREREQUISITE, NOT AN EXTRA (`docs/access-and-agency.md` §11.10).
   * `AssignmentScope.legalEntities` has existed as an authorising dimension with
   * *nothing anywhere in the model to match against* — no entity carried a legal
   * entity and this policy named only `chargebackKey`, so the dimension was
   * unenforceable by construction rather than merely unwired.
   *
   * SEPARATE FROM `chargebackKey` DELIBERATELY, and the temptation to reuse it
   * is the error worth naming. They answer different questions — *who pays for
   * this* and *whose books this belongs to* — and they diverge in exactly the
   * cases that matter: one legal entity routinely charges several cost centres,
   * and a shared-services cost centre routinely spans several legal entities.
   * Collapsing them makes a statutory boundary follow an internal accounting
   * convention that finance may re-cut at any time, without anyone reviewing it
   * as an access change.
   *
   * A key named here SHOULD carry `purpose: 'governance'` rather than
   * `'chargeback'`, since it scopes access and is never priced. Not enforced in
   * the type — the two fields would have to become a discriminated pair to make
   * that structural, which is a larger change than this gap warrants.
   *
   * Null means this tenant does not partition by legal entity, which is the
   * common single-entity case. ⚠️ Null here plus a `legalEntities` narrowing on
   * a live assignment is a MISCONFIGURATION, not a permission: every exception's
   * `legalEntity` is null, so the narrowing matches nothing and the holder sees
   * an empty queue. Failing closed is the right direction and a silent empty
   * queue is still a support call; admin should refuse the narrowing at the
   * point it is set.
   */
  legalEntityKey: string | null
}

/** Resolved tag values. Validated against TagPolicy at the point they are set. */
export type Tags = Record<string, string>

/* `TenantScoped` MOVED TO `model/kernel.ts` 7 Aug, and is re-exported at the top
 * of this file. It needs only `TenantId`, so it can sit beside the ids without
 * kernel acquiring an import — which is the one property kernel must never lose. */

/* ------------------------------------------------------------------ *
 * Documents
 * ------------------------------------------------------------------ */

export interface FieldSpec {
  /**
   * 🛑 THE FIELD INVARIANT 4 RESTS ON, AND UNTIL 22 Aug 2026 IT ADDRESSED
   * NOTHING. `FieldPath` was a naked `= string` alias, so "classification
   * is declared once, on `FieldSpec`, and everything derives from it" derived
   * from whatever the operator typed into a string. G106 rules that `FieldSpec`
   * gains a REAL JSONB path and that a key with no `FieldSpec` is UNREADABLE;
   * the refusal half has been executable since the engine landed
   * (`field_not_classified`, four sites in `model/reconciliation.ts`) and this
   * is the addressing half.
   *
   * G214: a structured token list, parsed at one seam — `parseFieldPath()` in
   * `model/field-path.ts`, which is the only thing that may construct one. The
   * grammar, including the array-index rule, is stated on the declaration in
   * `model/kernel.ts` and nowhere else.
   */
  path: FieldPath
  label: string
  dataType: DataType
  required: boolean
  /**
   * Classification travels with the field definition, so masking and export
   * rules are derived from the pack rather than reimplemented per screen.
   */
  dataClass: DataClass
  /**
   * Whether this field's value may be sent to a model provider. Identity
   * numbers generally must not be; a name on an invoice generally may.
   */
  modelProcessingAllowed: boolean
  /**
   * The extraction confidence below which a person is asked instead of guessed
   * at. Null means the pack's archetype default applies.
   *
   * ADDED 7 Aug 2026 per G38, which resolves a contradiction between two live
   * decisions rather than reopening either. G22 put the floor with a 1CloudHub
   * FDE and off the customer surface; G25 recorded that **no mechanism for
   * customer-invisible configuration exists or is being added** — resource
   * class carries no visibility term and the contracts carry none either, so a
   * generated client exposes any field it can reach. Those two could not both
   * ship. The floor therefore travels in a pack TEMPLATE and is RENDERED
   * READ-ONLY, which satisfies G22's substance — an FDE sets it, a customer
   * cannot change it — and needs none of G25's missing mechanism, because
   * **read-only is not invisible.**
   *
   * IT LIVES HERE, ON `FieldSpec`, AND NOT ON `DocumentType`, because the floor
   * is per-field: a total on an invoice and a free-text description do not
   * deserve the same threshold, and a single per-document number is the shape
   * that forces one of them to be wrong. `dataClass` and
   * `modelProcessingAllowed` already sit at this grain for the same reason —
   * invariant 4 says classification is declared once, on `FieldSpec`, and
   * everything derives from it.
   *
   * READ-ONLY IS A RENDERING CONCERN AND IS DELIBERATELY NOT MODELLED HERE.
   * There is no `editableByTenant` flag, and adding one would BE the mechanism
   * G25 says does not exist — a visibility/mutability term smuggled onto a
   * field instead of decided as a platform property. The enforcement is that no
   * v1 write operation accepts this field.
   *
   * Unblocks `Close.dc.html` band D — unreadable dockets sit in the same list
   * as everything else, so capture never becomes a second inbox.
   */
  confidenceFloor: number | null
}

/**
 * How much structure a document arrives with — which decides whether it is
 * PARSED or INFERRED.
 *
 * The cheapest document to extract is the one you never extract. A purchase
 * order pulled from the source system as data, or an invoice arriving as
 * structured e-invoicing, needs no OCR, no model call and no confidence score:
 * it is parsed, deterministically, and it is exactly right. A scan is the
 * opposite on every axis — most expensive, least reliable, and the only one
 * where an extraction error is even possible.
 *
 * Distinct from SourceDocument.origin, which records the CHANNEL. A connector
 * can deliver a scan and an upload can be structured XML; fidelity describes
 * the artefact, not the route it took.
 */
export const ACQUISITION_FIDELITY = {
  /** Peppol, EDI, or a source-system API. Parsed. No model in the path. */
  structured: 'structured',
  /** CSV or spreadsheet against a known column mapping. Parsed. */
  tabular: 'tabular',
  /** A PDF with a real text layer. No OCR; a model still reads layout. */
  digitalText: 'digital_text',
  /** An image. OCR and a model. The expensive, fallible path. */
  scanned: 'scanned',
} as const
export type AcquisitionFidelity =
  (typeof ACQUISITION_FIDELITY)[keyof typeof ACQUISITION_FIDELITY]

export interface DocumentType extends TenantScoped {
  id: DocumentTypeId
  key: string
  label: string
  domain: DomainKey
  fields: FieldSpec[]
  /**
   * What this type is expected to arrive as. Selects the extraction path, and
   * makes a downgrade visible: invoices that were structured last quarter and
   * scanned this one are a supplier problem, not a model-tuning problem, and
   * the two need entirely different responses.
   */
  expectedFidelity: AcquisitionFidelity
  /**
   * C18. Whether this format carries a control total, declared on the TYPE and
   * not decided by the parser that produces the rows.
   *
   * 🛑 THE PARSER MAY NOT BE THE ONLY VOICE HERE. `ControlTotal` records what the
   * parser FOUND; this records what the format is SUPPOSED to carry. A parser
   * reporting `not_declared_by_format` for a type declared `always` is itself a
   * defect — which is the whole difference between a control and a control the
   * checked component can turn off. Without it, a refactored shredder that stops
   * reading trailers makes C18 inert for every production file with the gate
   * green.
   *
   * It lives beside `expectedFidelity` for the same reason that field does:
   * invariant 4 already puts *what this class of document is declared to be* on
   * the type rather than on the artefact.
   */
  carriesControlTotal: 'always' | 'never'
}

/** Where an extracted value came from. Renders as a highlight over the source. */
export interface Provenance {
  page: number | null
  boundingBox: { x: number; y: number; width: number; height: number } | null
  confidence: number | null
}

/**
 * A typed extracted value. Replaces `string | number | null`, which could not
 * carry a currency and could not hold a line-item array.
 */
export type ExtractedScalar =
  | { kind: 'text'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'date'; value: string }
  | { kind: 'money'; value: Money }
  | { kind: 'identifier'; value: string }
  | { kind: 'absent' }

export interface ExtractedValue {
  scalar: ExtractedScalar
  provenance: Provenance
}

/** One line item. Lines are addressed by index and matched by LineMatchKey. */
export interface ExtractedLine {
  index: number
  /**
   * ⚠️ KEYED BY `FieldPathKey`, NOT BY `FieldPath` — G214. This read
   * `Record<FieldPath, ExtractedValue>` while `FieldPath` was `= string`, and
   * the retype makes a path an ARRAY, which no `Record` may key. The key is
   * `fieldPathKey(path)` from `model/field-path.ts` and nothing else mints one.
   *
   * The alternative — a `Map<FieldPath, …>` — would key by array REFERENCE, so
   * two structurally identical paths would be two different entries and the
   * classification lookup invariant 4 rests on would silently miss.
   */
  fields: Record<FieldPathKey, ExtractedValue>
}

/**
 * WHAT A FILE SAID ABOUT ITSELF — its own trailer, admitted as a first-class fact
 * rather than shredded as a transaction.
 *
 * 🛑 C18, AND THE THREE ARMS EXIST BECAUSE A NULLABLE FIELD CANNOT SAY THIS. The
 * obvious shape is `expectedLineCount: number | null` plus
 * `declaredControlTotal: Money | null`, and its null is AMBIGUOUS in the one way
 * that matters: it cannot distinguish *"this format has no trailer"* from *"the
 * trailer should have been there and was not"*. The second is a truncated or
 * tampered file, and a null that reads as "unchecked" is scope failing OPEN —
 * `docs/access-and-agency.md` §8.6's `neverExport → exportable` inversion is this
 * record's own precedent, and `docs/HANDOFF.md` §5.5 records this codebase
 * already fixing the shape once.
 *
 * AND IT IS WHAT CATCHES THE TRAILER SHREDDED AS A TRANSACTION. If the trailer
 * row is spent as a phantom receipt, the presented row count is one greater than
 * `lineCount` AND the summed amount is double the declared total — so the two
 * comparisons detect it INDEPENDENTLY, which is why the count is not redundant
 * with the total.
 *
 * 🛑 THE TRAILER IS CONSUMED HERE AND NOWHERE ELSE. It is a FIELD on the
 * document, never a member of `lines` and never a key of `extracted`, so no
 * admission path can present it as a transaction. A parser that puts it in
 * `lines` instead is the F8 defect, and both comparisons below fire on it.
 */
export type ControlTotal =
  /**
   * The parser found a trailer. `lineCount` and `total` may each be null — inside
   * THIS arm a null means *"the trailer declared this one and not that one"*,
   * which cannot be read as "unchecked" because the arm itself is the assertion
   * that a trailer was found. A trailer declaring NEITHER is a defect, not a
   * silent pass.
   */
  | { kind: 'declared'; lineCount: number | null; total: Money | null }
  /** This format carries no trailer at all. An API payload, a bare CSV. */
  | { kind: 'not_declared_by_format' }
  /**
   * The parser EXPECTED a trailer for this format and did not find one. A
   * truncated file presents exactly like this, so it REFUSES — never a document
   * admitted with an unchecked total.
   */
  | { kind: 'expected_but_absent' }

export interface SourceDocument extends TenantScoped {
  id: SourceDocumentId
  documentTypeId: DocumentTypeId
  filename: string
  /**
   * Where the blob actually lives. purgeAfter/purgedAt describe a retention
   * lifecycle for an object the model previously could not address.
   */
  storageRef: string
  /** Header-grain fields, keyed by `fieldPathKey(path)` — see `ExtractedLine`. */
  extracted: Record<FieldPathKey, ExtractedValue>
  /** Line-grain fields. Empty for documents with no line structure. */
  lines: ExtractedLine[]
  /**
   * C18. What the file said about itself. Required and NON-OPTIONAL: the `TS2741`
   * at every construction site is the only evidence the field landed (§5.10, and
   * the same argument `ResidueEntry.settlement` makes about itself).
   */
  controlTotal: ControlTotal
  ingestedAt: Timestamp
  /**
   * Set at ingest. Sandbox tenants accept only `true`. Carried on the row so
   * an audit can answer "was any real data ever in the sandbox?" directly.
   */
  synthetic: boolean
  /** Derived from the tenant's retention policy at ingest, not at read time. */
  purgeAfter: Timestamp
  /** Present once purged; the row survives as a tombstone for audit. */
  purgedAt: Timestamp | null
}

/* ------------------------------------------------------------------ *
 * The generic core
 *
 * Arity is data. Two-way, three-way and n-way are the same code path.
 * ------------------------------------------------------------------ */

export interface SourceSlot {
  slot: SlotName
  documentTypeId: DocumentTypeId
  /** 'optional' is what lets a 2-source reconciliation reuse the N-source path. */
  cardinality: Cardinality
  /**
   * At most one slot per definition may be 'reference'. When a rule fails, the
   * reference slot's value is what `Explanation.expected` is drawn from — which
   * is why a KYC finding reads "the passport disagrees with the registry"
   * rather than the reverse.
   */
  role: SlotRole
}

export interface MatchKey {
  slotPaths: Record<SlotName, FieldPath>
  normaliser: Normaliser
}

/**
 * How lines pair across slots once a group is formed. Without this, line
 * pairing is positional — wrong the moment a vendor sorts differently.
 */
export interface LineMatchKey {
  slotPaths: Record<SlotName, FieldPath>
  normaliser: Normaliser
}

export type Tolerance =
  | { kind: 'absolute'; value: number }
  | { kind: 'percentage'; value: number }
  | { kind: 'days'; value: number }
  | { kind: 'similarity'; value: number }
  /** Currency-aware absolute tolerance. Use instead of 'absolute' for money. */
  | { kind: 'money'; value: Money }
  /** Permitted rounding drift, in minor units. */
  | { kind: 'rounding'; minorUnits: number }

export interface MatchRule {
  id: RuleId
  /**
   * Rules are versioned for the same reason Explanation is stored rather than
   * derived: an exception raised under v1 must remain explicable when the rule
   * moves on. Exception.ruleVersion pins it.
   */
  version: number
  /** Group-grain or line-grain. Must be stated; there is no safe default. */
  scope: RuleScope
  /** Human-readable; becomes the `expected` clause of the explanation. */
  label: string
  predicate: RulePredicate
  /**
   * Guard. The rule is evaluated only when this holds.
   *
   * Solves "tolerance is 2% for domestic vendors, 5% for international", which
   * had no encoding — and whose two-rule workaround false-criticalled every
   * international invoice.
   */
  when: RulePredicate | null
  severity: Severity
}

/**
 * A domain is a row of this type. Finance and KYC differ only as instances —
 * see docs/domain-model.md §7.
 */
/* ------------------------------------------------------------------ *
 * Archetype — the second axis
 *
 * DomainKey was doing two jobs. A financial controller's month is not one
 * reconciliation: three-way match, bank reconciliation, intercompany, GL
 * account rec and accrual completeness are structurally different problems
 * wearing the same label, and scoping a SolutionPack to the label made the
 * pack granularity wrong too.
 *
 * So: DOMAIN is context — vocabulary, classification defaults, regulator,
 * naming. ARCHETYPE is structure — how sources relate and what a break
 * physically IS. They vary independently. Bank rec and three-way match share a
 * domain and differ in archetype; KYC identity and healthcare eligibility
 * differ in domain and share an archetype.
 *
 * This is also the guard against over-generalisation. The archetype is a CLOSED
 * SET and it determines which config shape is legal, which predicates apply and
 * which disposition families exist. A pack parameterises within it and can
 * never extend it; adding an archetype is a platform release, not a
 * configuration change.
 * ------------------------------------------------------------------ */

export const RECONCILIATION_ARCHETYPES = {
  /** 2..N documents about one subject, keyed and field-compared. */
  nWayDocumentMatch: 'n_way_document_match',
  /** One subject, N corroborating sources, attributes must agree. */
  attributeVerification: 'attribute_verification',
  /** Two transaction populations, many-to-many pairing, residue is the output. */
  setReconciliation: 'set_reconciliation',
  /** Every X needs a Y within a window. ABSENCE is the exception. */
  existenceCompleteness: 'existence_completeness',
  /** Opening + movements = closing, period over period. Not in v1. */
  balanceRollforward: 'balance_rollforward',
} as const
export type ReconciliationArchetype =
  (typeof RECONCILIATION_ARCHETYPES)[keyof typeof RECONCILIATION_ARCHETYPES]

/** Decided 4 Aug 2026. `balance_rollforward` is modelled and not built. */
export const V1_ARCHETYPES: readonly ReconciliationArchetype[] = [
  'n_way_document_match',
  'attribute_verification',
  'set_reconciliation',
  'existence_completeness',
]

/**
 * Disposition FAMILIES belong to the archetype, never the domain.
 *
 * Set reconciliation always yields timing differences and in-transit items;
 * N-way match always yields quantity and price variance. The names are
 * domain-flavoured, the families are structural. Put families on the domain and
 * every new vertical reinvents them — which is the rebuild-per-deal pattern
 * reappearing one level up.
 */
export const DISPOSITION_FAMILIES = {
  n_way_document_match: [
    'quantity_variance', 'price_variance', 'missing_document',
    'duplicate', 'charge_variance', 'timing',
  ],
  attribute_verification: [
    'value_mismatch', 'missing_source', 'stale_source', 'identity_ambiguous',
  ],
  set_reconciliation: [
    'timing_difference', 'in_transit', 'error_left', 'error_right',
    'unidentified', 'write_off',
  ],
  existence_completeness: [
    'awaiting_counterpart', 'accrue', 'never_expected', 'superseded',
  ],
  balance_rollforward: [
    'unexplained_movement', 'classification_error', 'timing_difference', 'rounding',
  ],
} as const

export type DispositionFamily =
  (typeof DISPOSITION_FAMILIES)[ReconciliationArchetype][number]

/**
 * How hard it is to undo a disposition once it has been executed.
 *
 * DECLARED by the pack author, never inferred. Whether posting a credit note
 * can be undone is a fact about the customer's finance process and the world,
 * not about anything we can observe — and it is the only one of the four
 * autonomy dials that cannot be measured. Which is precisely why it has to be
 * stated rather than left implicit in a disposition's name.
 */
export const REVERSIBILITY = {
  /** An operator undoes it the same day, with no external party involved. */
  reversible: 'reversible',
  /** Undone, but it costs something visible — a credit note, a corrected
   *  filing, a conversation with the counterparty. */
  reversibleWithCost: 'reversible_with_cost',
  /** Cannot be undone by us. A payment released, a return filed, data erased. */
  irreversible: 'irreversible',
} as const
export type Reversibility =
  (typeof REVERSIBILITY)[keyof typeof REVERSIBILITY]

/**
 * A concrete disposition, named by a pack inside a family its archetype allows.
 *
 * Replaces ResolutionProposal.action, which was a free-text string — so the
 * judgement the product exists to automate could not be scored, reported on,
 * learned from, or varied per domain. Breadth-as-packaging is impossible
 * without this type.
 */
export interface Disposition {
  key: string
  label: string
  family: DispositionFamily
  /**
   * The declared dial. An irreversible disposition is never a candidate for
   * autonomous execution however well it has behaved — good behaviour does not
   * make an unrecoverable action safe.
   */
  reversibility: Reversibility
  /** False routes to another procedure rather than closing the exception. */
  terminal: boolean
  /** Whether a money adjustment must be stated to choose it. */
  requiresAdjustment: boolean
}

/* ------------------------------------------------------------------ *
 * Set reconciliation — a different algorithm, not a different rule
 * ------------------------------------------------------------------ */

/** One side of a set reconciliation. Transactions, not documents. */
export interface PopulationSpec {
  documentTypeId: DocumentTypeId
  /** The amount being reconciled. */
  amount: FieldPath
  date: FieldPath
  /** Fields a pairing strategy may key on. */
  identifiers: FieldPath[]
}

export type PairingCardinality =
  | 'one_to_one'
  /** One deposit clearing five invoices. */
  | 'one_to_many'
  | 'many_to_one'
  | 'many_to_many'

/**
 * Ordered strategies. The FIRST that pairs wins, which is what makes a pairing
 * explicable — "matched on reference" is an explanation; a similarity score is
 * not.
 */
export type PairingStrategy =
  | { kind: 'exact_identifier'; on: FieldPath }
  | { kind: 'amount_and_date' }
  /** Subset-sum. maxMembers bounds it; without a bound this does not terminate. */
  | { kind: 'amount_sum'; maxMembers: number }
  | { kind: 'fuzzy_reference'; minSimilarity: number }

export interface PairingSpec {
  cardinality: PairingCardinality
  amountTolerance: Tolerance
  dateTolerance: Tolerance
  strategies: PairingStrategy[]
}

/* ------------------------------------------------------------------ *
 * Archetype configuration
 *
 * The structural parts of a definition differ per archetype, so they live in a
 * discriminated union rather than as fields that mean different things
 * depending on a sibling. `archetype` and `config.kind` must agree — a
 * validator, not a type-level guarantee, because the pair is also stored.
 * ------------------------------------------------------------------ */

export type ArchetypeConfig =
  | {
      kind: 'n_way_document_match'
      sources: SourceSlot[]
      matchKeys: MatchKey[]
      /** Required when any rule has scope 'line'. */
      lineMatchKeys: LineMatchKey[] | null
      rules: MatchRule[]
    }
  | {
      kind: 'attribute_verification'
      /** The claim under verification. */
      subject: SourceSlot
      corroborators: SourceSlot[]
      matchKeys: MatchKey[]
      rules: MatchRule[]
    }
  | {
      kind: 'set_reconciliation'
      left: PopulationSpec
      right: PopulationSpec
      pairing: PairingSpec
      /** Rules over what did NOT pair. The residue is the product here. */
      residueRules: MatchRule[]
    }
  | {
      kind: 'existence_completeness'
      expected: SourceSlot
      counterpart: SourceSlot
      withinDays: number
      from: 'run_date' | 'period_end'
      /** Absence raises the exception; these qualify severity and disposition. */
      rules: MatchRule[]
    }

export interface ReconciliationDefinition extends TenantScoped {
  id: DefinitionId
  name: string
  /** Context. Labelling, vocabulary and classification defaults only. */
  domain: DomainKey
  /** Structure. Determines the legal config shape and the disposition families. */
  archetype: ReconciliationArchetype
  config: ArchetypeConfig
  /** How to compare across currencies. Null = refuse rather than guess. */
  fx: FxPolicy | null
  /** Which triggers are wired. Usually one or two. */
  enabledTriggers: RunTriggerKind[]
  /** Governance and chargeback tags, validated against the tenant's TagPolicy. */
  tags: Tags
  version: number
  status: 'draft' | 'active' | 'archived'
  /** The procedure that handles this definition's exceptions. */
  procedureId: ProcedureId | null
}


/* ------------------------------------------------------------------ *
 * Pack lifecycle, posture and rollout
 *
 * Adopted from the AIVolveX Blueprint concept — see
 * docs/aivolvex-concept-assessment.md §2.1.
 *
 * The gap this closes: a SolutionPack was a bundle that could exist. It had no
 * account of being CHANGED across a fleet. When finance pack v2 ships to forty
 * tenants across six partners, nothing said which go first, what must pass
 * before it proceeds, or what happens when it degrades on tenant nine.
 * ------------------------------------------------------------------ */

/**
 * Eight states, every transition gated. Replaces a three-value status that
 * could not express "passed evals but not yet approved" or "rolling out".
 */
/**
 * ⚠️ V1 SCOPE, 7 Aug 2026. The TYPE stays whole — six of its eight members are
 * out of scope, not removed, because narrowing a union that `SolutionPack`
 * already carries would be a shape change and this pass changes no shapes. The
 * two v1 states are `active` (the pack a tenant runs) and `deprecated`. Each
 * out-of-scope member is marked below; see `docs/v1-scope-ledger.md`.
 */
export type PackLifecycleState =
  /** @dropped-for-v1 7 Aug 2026 — packs are authored in this repository and published signed; there is no draft state a tenant can observe. Declared, not built. */
  | 'draft'
  /** @dropped-for-v1 7 Aug 2026 — component evals need scorers and a corpus, neither of which v1 builds. Declared, not built. */
  | 'validated'   // component evals pass
  /** @dropped-for-v1 7 Aug 2026 — composition evals need scorers and a corpus, neither of which v1 builds. Declared, not built. */
  | 'tested'      // composition evals pass
  /** @dropped-for-v1 7 Aug 2026 — no staged rollout in v1. Declared, not built. */
  | 'staged'      // deployed to sandbox, observability attached
  /** @dropped-for-v1 7 Aug 2026 — no rollout approval chain in v1; publication is the approval. Declared, not built. */
  | 'approved'    // signed off by named approvers
  /** @dropped-for-v1 7 Aug 2026 — no partial rollout or canary in v1. Declared, not built. */
  | 'promoted'    // partial rollout under way
  | 'active'      // full rollout complete
  | 'deprecated'  // superseded; ticking down to retirement

/**
 * What the pack commits to in production. These are the numbers a rollout is
 * measured against, and the ones a rollback trigger fires on.
 */
/** @dropped-for-v1 7 Aug 2026 — no rollout or canary in v1. Declared, not built. */
export interface PackPosture {
  /** End-to-end p95 for a reconciliation run. Null = no commitment. */
  maxLatencyP95Ms: number | null
  /** Cost ceiling per run. Null = governed only by tenant Budget. */
  costCeilingPerRun: Money | null
  /**
   * The business KPI, 0..1 — e.g. match rate ≥ 0.87. This is the OUTCOME
   * measure, and the only class of signal permitted to trigger rollback.
   */
  targetOutcomeScore: number | null
  /** Declared regimes, e.g. ['PDPA']. Informational; policy enforces. */
  complianceScope: string[]
}

/**
 * How a new pack version reaches tenants. Order matters: a pack that lands
 * everywhere at once has no rollback worth the name.
 */
/** @dropped-for-v1 7 Aug 2026 — no rollout or canary in v1. Declared, not built. */
export type RolloutStrategy
  = { kind: 'canary'; percentages: number[] }
  /** Named tenants in declared order — the fleet equivalent of branch-wise. */
  | { kind: 'tenant_wise'; order: TenantId[]; batchSize: number; pauseHours: number }
  /** Sandbox tenants first is the default worth reaching for. */
  | { kind: 'segment'; segment: 'sandbox_first' | 'smallest_first' | 'single_partner_first' }
  /** Essential where residency differs per tenant. */
  | { kind: 'regional'; order: RegionKey[] }
  | { kind: 'blue_green' }
  | { kind: 'time_based'; rampDays: number }

/**
 * What reverts a rollout automatically.
 *
 * `outcome_breach` is deliberately the only quality-derived trigger. Component
 * drift notifies the pack owner and never rolls back — otherwise every minor
 * regression pages everyone and signal-to-noise collapses. Enforced in
 * evaluation.ts by canTriggerRollback().
 */
/** @dropped-for-v1 7 Aug 2026 — no automated rollback exists in v1 — see AUTOMATED_ROLLBACK_EXISTS. Declared, not built. */
export type RollbackTrigger =
  | { kind: 'outcome_breach'; belowScore: number }
  | { kind: 'cost_overrun'; aboveMinorPerRun: number }
  | { kind: 'compliance_violation' }
  | { kind: 'anomaly'; sigma: number }

/** @dropped-for-v1 7 Aug 2026 — no rollout or canary in v1. Declared, not built. */
export interface PackRollout {
  strategy: RolloutStrategy
  triggers: RollbackTrigger[]
  /** False means a human decides. True arms automatic reversion. */
  autoRollback: boolean
  /** Reverting to this version. Null on a first release. */
  revertsTo: number | null
}

/**
 * FALSE IN V1, AND IT IS INVARIANT 9'S COMPENSATING RECORD.
 *
 * Invariant 9 says only outcome-level scorers may trigger a rollback, with one
 * deliberate exception for a failed injection probe. Every mechanism that would
 * enforce that is `@dropped-for-v1` — `Scorer`, `canTriggerRollback()`,
 * `EvaluationGate`, `PackRollout`, `RollbackTrigger`,
 * `rollbackTriggerForFailedProbe()`. The rule therefore stays DECLARED and
 * becomes UNEXERCISED. It is not broken, because nothing in v1 can revert a
 * fleet at all.
 *
 * Stated as a constant so the first engineer to build a rollout deletes a line
 * in a diff that somebody reviews, rather than quietly shipping a fleet revert
 * that a quality scorer can fire. When this becomes `true`, the rule in
 * `docs/access-and-agency.md` §10.5 binds with it: **a rollback reverts
 * behaviour, never authority** — role capabilities stay at the narrower of the
 * two versions, or a failed probe widens live authority at 04:00 unattended.
 */
export const AUTOMATED_ROLLBACK_EXISTS = false

/**
 * Per-environment binding of one pack version.
 *
 * The artefact is bound per environment rather than the tenant carrying a mode.
 * This is what stops a demo surface drifting from a production one — the same
 * declaration, different bindings, no re-authoring.
 */
export interface PackBinding {
  environment: TenantEnvironment
  /**
   * Cheaper model in sandbox is legitimate; a different pack is not.
   *
   * BRANDED 7 Aug 2026. Was `modelOverride: string | null`, and CLAUDE.md's
   * invariant 7 named it explicitly as one of the bare strings that skip
   * `resolveModel()`. Sandbox is not a residency exemption — a sandbox tenant
   * still holds data under the same region policy — so the override must name a
   * catalogue row that can be resolved, exactly as `AgentModelBinding`
   * .sandboxEntryId already does.
   */
  modelOverride: ModelCatalogEntryId | null
  /** Sandbox runs with autonomy disabled regardless of tenant policy. */
  autonomyEnabled: boolean
  /** Sandbox may waive gates; production may not. */
  requiresApproval: boolean
}

/**
 * THE PACK-KEY VOCABULARY — G224, 22 Aug 2026. Closed, and closed on purpose.
 *
 * THE PLATFORM PRE-REGISTERS EVERY PACK KEY. A partner cannot mint one. This
 * is what lets `packVersionsInForce` — the map on the attestation body and on
 * the heartbeat — close its key space with `propertyNames` instead of
 * accepting whatever a plane chooses to send, which is the shape `totals`
 * already has against `Meter` and the shape the second map did not.
 *
 * ⚠️ THIS IS HONEST TODAY RATHER THAN ASPIRATIONAL, AND THAT IS THE ONLY
 * REASON IT COULD BE RULED. Partner pack authorship is NOT in v1: every pack
 * in `model/examples.ts` carries `authoredBy: null` and `signature: null`, so
 * closing the vocabulary takes nothing from anybody today. G224 records that
 * as the CONDITION, not as a happy accident — if partner authorship arrives,
 * this set is amended in the open rather than quietly widened, and the
 * amendment is the decision point at which `propertyNames` stops being
 * defensible.
 *
 * PARTNER-MINTS-PLATFORM-COUNTERSIGNS IS THE RIGHT LONG-RUN ANSWER and was
 * refused ONLY on sequencing. It needs the signing seam G110's publication
 * half was to provide; that half is unbuilt and blocked on an
 * `administration.openapi.yaml` that does not exist (#241). The rejected
 * alternative is preserved here rather than dropped, because a reader who
 * meets a closed set with no argument beside it assumes it was never argued.
 *
 * ⚠️ THE VALUES ARE `SolutionPack.key`, NOT `SolutionPack.id`. The four here
 * are exactly the `key` fields the four packs in `model/examples.ts` carry —
 * `finance_ap`, `kyc_identity`, `credit_underwriting`, `medical_records`. The
 * ids beside them (`pack_finance_ap`, `pack_kyc_identity`, `pack_credit`,
 * `pack_medical`) are a DIFFERENT vocabulary and are not this one; G19 keeps
 * the pack LINE and the pack VERSION apart, and this set keys the line.
 *
 * ⚠️ `SolutionPack.key` ITSELF IS DELIBERATELY LEFT `string`. Narrowing it
 * would be a shape change to a declaration whose own docblock records that it
 * stays bare under R2, and it would force test fixtures that mint throwaway
 * keys to either edit the platform vocabulary or stop compiling. The mint-time
 * rule this set states is enforced where a key crosses the wire, which is
 * where the closure was missing.
 *
 * ⚠️ AND `pack_catalogue.pack_key` STAYS BARE `text` (G97). Every branded id
 * is `text` and the format rule is a mint-time rule in `model/`, never a
 * column constraint — a CHECK here would put the vocabulary in a migration,
 * which G88 makes forward-only and therefore un-amendable.
 */
export const PACK_KEYS = {
  financeAp: 'finance_ap',
  kycIdentity: 'kyc_identity',
  creditUnderwriting: 'credit_underwriting',
  medicalRecords: 'medical_records',
} as const
export type PackKey = (typeof PACK_KEYS)[keyof typeof PACK_KEYS]

/**
 * A seedable bundle of everything a domain needs: document types, definitions
 * and SOPs. Adopted from AiVolvex's "COTS Agentic Solutions" concept — see
 * docs/platform-adoption.md §5.
 *
 * Finance and KYC ship as packs; credit underwriting and medical records are
 * named as available capability without being built. A partner onboards a
 * customer by installing a pack rather than configuring from scratch.
 */
export interface SolutionPack {
  /**
   * BRANDED 7 Aug, slice 6. THE PACK LINE, NOT THE PACK VERSION (G19) —
   * `version` below stays a separate number, and every `packId` in the model is
   * paired with a `packVersion` beside it rather than merged into one id.
   */
  id: SolutionPackId
  /**
   * ⚠️ A KEY, NOT A POINTER, AND IT STAYS BARE (R2). It namespaces `Role.key`;
   * nothing loads a row by it. Re-confirmed 7 Aug during the reference sweep,
   * one line under an `id` that was branded in the same edit — which is exactly
   * why the reason is recorded here rather than assumed.
   */
  key: string
  label: string
  domain: DomainKey
  version: number
  /** Null for 1CloudHub-authored packs; set when a partner authors its own. */
  authoredBy: PartnerId | null
  /** Whether this pack is built and demonstrable, or named only. */
  availability: 'available' | 'announced'

  /* --- Blueprint concepts --- */

  lifecycle: PackLifecycleState
  posture: PackPosture
  /** Null until a release is planned. */
  rollout: PackRollout | null
  /** Evaluation gates that must pass before promotion. See evaluation.ts. */
  gateIds: EvaluationGateId[]
  /** Per-environment bindings. One declaration, many deployments. */
  bindings: PackBinding[]
  /**
   * Detached signature over the pack contents, so a tenant can verify a pack is
   * authentic and unmodified. Required before partners author packs.
   */
  signature: string | null
  /** Set when superseded; the deprecation window runs from here. */
  supersededBy: string | null
  /**
   * TEMPLATES, not instances. A pack is a control-plane asset and may not point
   * at tenant-scoped rows — our own proof file had the platform Finance pack
   * referencing Acme's definition. Installing a pack MINTS tenant-scoped copies
   * and records them on InstalledPack.
   */
  documentTypeTemplates: DocumentTypeTemplate[]
  /**
   * G206, 24 Aug 2026 — HOW THIS PACK RECOGNISES ITS OWN DOCUMENTS IN AN
   * ARRIVING ARTEFACT. It turns `documentTypeTemplates` from an inert
   * declaration into a decision about what gets admitted, on input a
   * counterparty controls, which is why the vocabulary is closed and why
   * `validatePackClassificationRules()` (`model/ingestion.ts`) refuses a rule
   * naming a type this pack does not ship.
   *
   * 🛑 NOTHING HERE IS COMPILED. A rule declares an `IdentifierNormalisation`
   * over the closed op list plus the enumerated values its output is compared
   * against — G130's own replacement, reused rather than reinvented. A regex
   * would be a pattern from counterparty-adjacent content, which G130 removed
   * from `RulePredicate` one layer up for exactly this reason.
   *
   * ⚠️ THE TYPE LIVES IN `model/ingestion.ts` AND IS IMPORTED TYPE-ONLY, so
   * there is no runtime edge. It lives there rather than here because
   * `intake_channel_is` reads `IntakeChannelKind` — G184's ONE intake
   * vocabulary — and a signal arm restating its four members here would be the
   * second vocabulary G184 exists to forbid.
   *
   * ⚠️ DECLARED AND NOT EVALUATED. The publication-time validator runs; nothing
   * decides whether a live arrival MATCHES a rule, because that needs a reader
   * over a real artefact and none exists. G118: *"a typed seam plus a
   * compile-time proof reads to a newcomer as a shipped feature."*
   */
  classificationRules: PackClassificationRule[]
  definitionTemplates: DefinitionTemplate[]
  procedureTemplates: ProcedureTemplate[]
  /**
   * The dispositions this pack offers. Each must sit in a family its
   * definitions' archetypes allow — a pack parameterises, it never extends.
   */
  dispositions: Disposition[]
  /**
   * RESERVED BY G90, 8 Aug 2026. The authoring vocabulary a pack declares for a
   * customer administrator (G2, G13, G18). The KEY is reserved, the SHAPE is
   * not — widening this to `PackPalette | null` in v2 leaves every v1 signed
   * body byte-identical, which is the whole reason it is being reserved while
   * every pack still carries `signature: null`.
   *
   * @dropped-for-v1 8 Aug 2026 — NO READER IN V1. Nothing reads this field; v1
   * authoring is the closed four-archetype set (`V1_ARCHETYPES`,
   * model/domain.ts:1976) per pass D's "customers author values, never
   * expressions". Declared, not built.
   */
  palette: null
}

/** Pack-shipped shapes. Identical to their tenant counterparts minus tenantId. */
/**
 * The binding that applies to a tenant, with the fallback that adding a third
 * environment made necessary.
 *
 * `evaluation` falls back to the `production` binding, because an evaluation
 * tenant behaves as production in every respect that a binding controls — the
 * real model, autonomy as configured, approval required. Falling back to
 * `sandbox` would silently run a prospect's real data through a cheaper model
 * with autonomy disabled, which is both the wrong behaviour and the wrong
 * impression.
 *
 * Without this, adding a third TenantEnvironment value left every existing pack
 * with no binding for it — a hole that typechecks perfectly and misbehaves at
 * runtime.
 */
export function bindingFor(
  pack: SolutionPack,
  environment: TenantEnvironment,
): PackBinding | null {
  const exact = pack.bindings.find((b) => b.environment === environment)
  if (exact !== undefined) return exact
  if (environment === 'evaluation') {
    return pack.bindings.find((b) => b.environment === 'production') ?? null
  }
  return null
}

export type DocumentTypeTemplate = Omit<DocumentType, 'id' | 'tenantId'>
export type DefinitionTemplate = Omit<ReconciliationDefinition, 'id' | 'tenantId' | 'procedureId'>
export type ProcedureTemplate = Omit<Procedure, 'id' | 'tenantId' | 'derivedFrom'>

/** A pack installed into a tenant. Installation is the onboarding primitive. */
export interface InstalledPack extends TenantScoped {
  /**
   * ADDED 7 Aug. This interface carried no identity at all, which is why
   * `Solution.installedPackId` was a `string | null` pointing at nothing
   * addressable while `InstalledPack.mintedSolutionId` was a proper `SolutionId`
   * — the assembly chain was typed in one direction and dangled in the other.
   *
   * Found by asking why an entity diagram drew no thread between `Solution` and
   * `SolutionPack`. The thread was there in intent and invisible to the type
   * system, which is the whole of the identity debt in one instance.
   */
  id: InstalledPackId
  packId: SolutionPackId
  packVersion: number
  /** Which binding this tenant runs. */
  environment: TenantEnvironment
  /** Where this tenant sits in the current rollout. */
  rolloutState: 'pending' | 'rolling_out' | 'active' | 'rolled_back'
  /** Set when this tenant was reverted, with the trigger that did it. */
  rolledBackBy: RollbackTrigger | null
  /** The tenant-scoped rows this installation minted. */
  mintedDefinitionIds: DefinitionId[]
  mintedDocumentTypeIds: DocumentTypeId[]
  mintedProcedureIds: ProcedureId[]
  /**
   * Roles this installation minted — and the reason this list is kept apart
   * from the three above rather than folded in with them.
   *
   * §10.5: A ROLLBACK REVERTS BEHAVIOUR, NEVER AUTHORITY.
   *
   *   behaviour — definitions, procedures, prompts | reverts immediately; that
   *               is what the safety trigger is for
   *   authority — role capabilities                | stays at min(v_n, v_n+1),
   *               and never widens on an automated path
   *
   * The collision this resolves, in which neither side is wrong.
   * `canTriggerRollback` confines scorers to outcome level — the single most
   * important discipline in the eval design — and
   * `rollbackTriggerForFailedProbe()` is DELIBERATELY routed around it, on the
   * argument that a safety regression is not quality drift. Put together, a
   * failed prompt-injection probe auto-reverts a pack, and if the version it
   * reverts to carried a WIDER role then live authority widens at 04:00 with no
   * human in the path. Narrowing automatic, widening an act — exactly inverted
   * by the safety machinery.
   *
   * `Role.version` is already independent of `packVersion`, so the floor is
   * expressible. This is the field that makes it computable: until 5 Aug an
   * installation could not record a minted role at all, so a rollback had
   * nothing to un-mint and nothing to hold a floor against.
   */
  mintedRoleIds: RoleId[]
  /**
   * The pack version this tenant ran before this installation. Null on a first
   * install.
   *
   * Without it there is no v_n to take the min against, and the §10.5 floor is
   * a rule with one operand. The accepted cost is a role composition that
   * matches NO pack version; both numbers sit on the row so that divergence is
   * visible rather than merely tolerated.
   */
  previousPackVersion: number | null
  /**
   * The operating assembly this installation produced. Null on an installation
   * that minted templates without standing anything up.
   *
   * THE ROLLBACK COMPLETENESS ARGUMENT, CONTINUED. The four `minted*` lists
   * above record definitions, document types, procedures and roles — and NOT
   * endpoints, secrets, agents or dashboards. A rollback cannot un-mint what it
   * cannot record, so on 5 Aug that was four blind spots.
   *
   * Two of them are not blind spots and must never be filled:
   *
   *   ENDPOINTS AND SECRETS ARE NOT MINTED BY AN INSTALL. An `Endpoint` is the
   *   customer's own connection to their own system and its `credentialRef` is
   *   `bind_secret` — the one capability mapped to a resource class in NEITHER
   *   `PERMITTED_RESOURCES` list. Recording them here would invite an automated
   *   reversion to un-bind them, and §10.5's trigger fires at 04:00 with no
   *   human in the path. Reverting BEHAVIOUR must not sever a connection.
   *
   * The other two are, and this single reference closes both. Agents and
   * dashboards hang off the `Solution`, so naming the solution reaches them
   * transitively — without this module declaring list types for entities owned
   * by `agents.ts` and `presentation.ts`, which would be two more places for the
   * same rollback to be half-recorded.
   */
  mintedSolutionId: SolutionId | null
  installedAt: Timestamp
  installedBy: UserId
}

/* ------------------------------------------------------------------ *
 * Solution — the third level, and the one that was missing
 * ------------------------------------------------------------------ */

/**
 * THE TENANT-SIDE OPERATING ASSEMBLY. Added 5 Aug 2026.
 *
 * Three levels existed conceptually and only two were modelled:
 *
 *   `SolutionPack`   catalogue. Authored, versioned, signed, portable, and a
 *                    CONTROL-PLANE asset that may not point at a tenant row
 *   `InstalledPack`  the minting record. What an install created, and when
 *   `Solution`       ← this. What is actually running
 *
 * The gap was not cosmetic. Everything an operator thinks of as "the AP
 * reconciliation" — the connector it pulls from, the mailbox it answers on, the
 * agents that read, the procedure that routes, the dashboards the controller
 * opens — had no object. Each part was individually modelled and the ASSEMBLY
 * was not, so there was nothing to disable, nothing to hand to a partner,
 * nothing to scope an assignment to, and nothing for a rollback to name.
 *
 * REFERENCES, NEVER EMBEDS. Every field below is an id. An assembly that
 * embedded its parts would be a second copy of them — and the copy would be the
 * one a rollback reverted, a grant evaluated against, and an auditor read, while
 * the live rows drifted away underneath. It also lets `agents.ts` and
 * `presentation.ts` land independently: see `AgentId` / `DashboardId` above.
 *
 * A SOLUTION IS A SCOPE, NEVER A GRANT. You may narrow *to* one; you may not be
 * granted one. The argument is in `SOLUTION_IS_GRANTABLE` in access.ts, and it
 * is decisive rather than stylistic: the assembly reaches a `credentialRef`.
 *
 * ⚠️ THE REASON WAS RESTATED ON 8 Aug 2026 (G75) BECAUSE ITS PREMISE WENT FALSE.
 * This comment read: *"`secret` appears in neither `PERMITTED_RESOURCES` list, so
 * conferring 'the solution' atomically would confer something no grant in this
 * model may confer."* **`secret` is now IN `PERMITTED_RESOURCES.delivery`**, so
 * that sentence is untrue and the conclusion needed a better argument rather than
 * a quieter one.
 *
 * IT HAS ONE, AND IT IS SHARPER. A delivery grant may now reach `secret` — but
 * only by NAMING it, on a grant that is purpose-scoped, time-boxed, audited and
 * refusable. Granting "the solution" would confer the same credential **without
 * naming it**, as a side effect of granting a container. The objection was never
 * that the credential is unreachable; it is that a container grant confers its
 * contents INVISIBLY, and invisibly is the one way this model refuses to confer
 * anything. `AssignmentScope.solutionIds` intersects and can only take authority
 * away, which is why narrowing to a solution stays legitimate.
 */
/** @dropped-for-v1 7 Aug 2026 — no operating-assembly surface in v1; AssignmentScope.solutionIds keeps all six dimensions. Declared, not built. */
export interface Solution extends TenantScoped {
  id: SolutionId
  /** What the customer calls it: "AP three-way match", "Onboarding KYC". */
  label: string
  domain: DomainKey
  /**
   * Provenance. Null on an assembly composed by hand rather than installed —
   * which is legitimate and must stay representable, because the first customer
   * of any new domain has no pack to install.
   */
  installedPackId: InstalledPackId | null
  /**
   * THE INSTALL RUNNING TODAY, as distinct from the one above (G29).
   *
   * `installedPackId` is PROVENANCE and never moves — it is the install that
   * produced this assembly, and rewriting it on upgrade would erase the only
   * record of where the solution came from. This one is CURRENT and moves on
   * every upgrade and every rollback.
   *
   * One field could not be both, and being one field is how it read as both: a
   * rollback asking "what is running" and an auditor asking "where did this come
   * from" followed the same pointer to different answers depending on when they
   * asked. Null on a hand-composed assembly, for the same reason as the origin.
   */
  currentInstalledPackId: InstalledPackId | null
  packId: SolutionPackId | null
  /**
   * Pinned, for the reason `RoleAssignment.roleVersion` is pinned: a bare
   * pointer resolves to today's definition, and an auditor asking what was
   * running in March needs March's.
   */
  packVersion: number | null

  /* --- the assembly --- */

  /**
   * ONE LIST, NOT AN INBOUND LIST AND AN OUTBOUND LIST.
   *
   * Direction is already a property of the `Endpoint` — "a mailbox you send to
   * and a mailbox you poll are the same mailbox", and splitting the taxonomy in
   * two is the duplication that produced `RoleKey` vs `Capability`. Two arrays
   * here would be a SECOND statement of direction sitting beside
   * `Endpoint.direction` with nothing keeping them agreed, and a
   * `bidirectional` endpoint would have to appear twice or arbitrarily once.
   *
   * ⚠️ BRANDED 7 Aug, slice 6. This comment previously read *"`string` rather
   * than a branded id because `Endpoint.id` is `string` today; branding it is a
   * separate change with its own call-site audit."* That audit was slice 6:
   * `Endpoint.id` is now `EndpointId` and so is this field. The deferral is
   * recorded rather than deleted because it was a correct deferral, and a
   * comment describing a deferral that has already happened is worse than none.
   *
   * ⚠️ WHAT THE BRAND DOES NOT DO, AND INVARIANT 11 RESTS ON THIS FIELD.
   * `EndpointId[]` stops an `ExceptionId` or a `SolutionId` being written here.
   * It does NOT check that these endpoints belong to the SAME TENANT as this
   * `Solution`. TypeScript cannot express that — the tenant is a runtime value,
   * and a phantom type reads no values. It is a SCHEMA OBLIGATION: a composite
   * `(tenantId, id)` foreign key, not a `(id)` one.
   *
   * The obligation is written down because the assembly reaches a
   * `credentialRef` through these rows, `bind_secret` is the one capability
   * mapped to a resource class in neither `PERMITTED_RESOURCES` list, and
   * `SOLUTION_IS_GRANTABLE = false` is argued on exactly that reach. A
   * cross-tenant endpoint landing in this array is the failure that argument
   * exists to prevent, and it is the failure this brand cannot see.
   */
  endpointIds: EndpointId[]
  /**
   * Owned by `agents.ts`. Referenced by id — see `AgentDefinitionId`.
   *
   * The DEFINITION, never a derived per-step grant. An agent definition is
   * durable, versioned and tenant-scoped, which is the only thing an assembly
   * can hold; the grant an agent actually runs under is minted per step
   * execution and dies with it, and a solution naming one would be naming
   * something that no longer exists by the time anyone reads the row.
   */
  agentIds: AgentDefinitionId[]
  /** The procedure that routes this solution's exceptions. */
  procedureId: ProcedureId | null
  /** Owned by `presentation.ts`. Referenced by id — see `DashboardId`. */
  dashboardIds: DashboardId[]

  /* --- the customer data it touches --- */

  /**
   * Declared rather than inferred. "Which of my solutions touches this
   * document type" must stay a relational query — the same standing constraint
   * that keeps `AssignmentScope` a finite enumeration and refuses patterns.
   */
  definitionIds: DefinitionId[]
  documentTypeIds: DocumentTypeId[]

  /**
   * `disabled` stops the assembly acting without unbinding anything; `retired`
   * is the end state. Both are CONTAINER ACTS and are separate from acts within
   * the solution — see `SOLUTION_CONTAINER_ACTS` in access.ts.
   */
  status: 'draft' | 'active' | 'disabled' | 'retired'
  createdAt: Timestamp
  createdBy: UserId
  disabledAt: Timestamp | null
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  /**
   * BRANDED 7 Aug 2026. Was `model: string`.
   *
   * Invariant 7 says residency survives inference, and `resolveModel()` in
   * catalog.ts is its only executable enforcement. A bare string is how a model
   * identity reaches a record without ever having passed through that function.
   * This names the CATALOGUE ROW — which carries routing, region and retention
   * posture — rather than the provider's own identifier, which is the string
   * AWS mints and is correctly bare on `ModelCatalogEntry.modelId` (R1 in
   * identity.ts). One letter apart, opposite answers.
   *
   * ⚠️ This does NOT close E5. Six bare model-identity fields were inventoried;
   * four are branded in this pass and two are correct as they stand. No
   * document may claim the trim closed it.
   */
  model: ModelCatalogEntryId
}

/**
 * A closing period. Reconciliation is period-bound in every finance context,
 * and nothing expressed it — goods received 31 Mar and invoiced 2 Apr had no
 * defined home.
 */
export interface ReconciliationPeriod extends TenantScoped {
  /** BRANDED 7 Aug, slice 6, with `ReconciliationRun.periodId`. Not `BillingPeriodId`. */
  id: ReconciliationPeriodId
  label: string
  from: Timestamp
  to: Timestamp
  /** Documents after this date fall to the next period, not this one. */
  cutOffAt: Timestamp
  status: 'open' | 'closing' | 'closed' | 'reopened'
  closedAt: Timestamp | null
  closedBy: UserId | null
}

/**
 * The states a run passes through. NAMED 11 Aug 2026; ⚠️ **the sentence below
 * saying it "adds no state and takes none away" was true of THAT commit and is
 * false of this declaration** — O-16 adds a fifth, 16 Aug 2026, and the earlier
 * sentence is kept rather than deleted because it is the one a reader would
 * have trusted.
 *
 * It was written inline on `ReconciliationRun.status` and that made it
 * unpinnable: `tools/check-wire-mirror.mjs` addresses a model vocabulary BY
 * NAME, so the four strings restated as an enum in
 * `docs/contracts/capability.openapi.yaml` were mirrored by nothing. An inline
 * union cannot be a pair. Naming it is the entire change — this declaration
 * adds no state and takes none away.
 *
 * 🛑 O-16 / G153 — `incomplete` MEANS SOUND OVER LESS THAN EVERYTHING, AND IT IS
 * NEITHER `completed` NOR `failed`.
 *
 * Every post-condition the engine computes is an internal-consistency check over
 * the ADMITTED set, and none of them compares that set against the outside
 * world — so the engine could say *"what I was given balances"* and never
 * *"I was given everything"*. A file that lost a third of its rows to a bad
 * mapping, or that arrived truncated under its own trailer, closed GREEN.
 *
 * *Inconsistent* — `SetReconciliationResult.postconditions` carrying a
 * SOUNDNESS arm — means the ledger must not be persisted. *Incomplete* means
 * the ledger is sound and persistable over a population that is not the
 * population. **Collapsing the two would either DISCARD a sound partial result
 * or PERSIST an unsound one, and they are different acts for different people:**
 * one is an engineer's defect, the other is an operator's decision about
 * whether a close may be signed over what actually loaded.
 *
 * 🛑 WHAT `incomplete` DOES NOT CLAIM, AND THE BOUNDARY IS DELIBERATE. The
 * engine knows what the documents it was handed PRESENTED
 * (`presentedRowCount`), and it knows what a file said about ITSELF (C18's
 * `ControlTotal`). **Nothing anywhere in this repository knows what was SENT.**
 * There is no arrivals denominator — no transfer manifest, no delivery receipt,
 * no expected-file register — so a run that received nothing at all where ten
 * files were despatched is `completed` over an empty gate refusal, never
 * `incomplete`. That gap is real and is O-16's stated boundary rather than
 * O-16's failure; inventing a count to make the state tidy would be a number
 * with no source, which `PRODUCT.md` forbids and §5.2 catalogues.
 *
 * ⚠️ THE ENGINE DOES NOT SET THIS. `SetReconciliationResult` and
 * `ReconciliationRun` are different objects and only a caller joins them —
 * the engine has no clock and no identity. `terminalRunStatus()`
 * (`model/reconciliation.ts`) is the total derivation a caller applies; a claim
 * that the engine assigns a status would be a claim of enforcement over zero
 * call sites.
 *
 * ⚠️ THE REJECTED ALTERNATIVE IS RECORDED. A boolean (`complete: false`) beside
 * `completed` was refused: it reproduces the defect one remove out, because a
 * consumer switching on `status` still sees a clean close and the fact that
 * something is missing sits on a field nothing obliges them to read. G153 puts
 * it on the OUTCOME for that reason, and the row says so — *"the contracts'
 * run-status enum changes."*
 *
 * 🛑 G4033, THE OWNER'S, 4 Oct 2026 — `refused` IS A SIXTH STATE, AND THE
 * SENTENCE ABOVE THAT O-16 "adds a fifth" IS KEPT AS THE HISTORY IT IS. An
 * engine REFUSAL (`SetReconciliationRefusal`) produced NO ledger: it is not
 * `failed`, which is an unsound ledger the engine DID produce, and it is not
 * `queued`, which says nothing ran. Before the ruling a refused run sat
 * `queued` on the register while `getRunAccount` published the refusal (G4031
 * left it there on purpose). The reason is still `getRunAccount`'s to publish;
 * this word only stops the run row claiming nothing happened.
 * ⚠️ `terminalRunStatus()` DOES NOT RETURN IT — it takes a RESULT, and a refusal
 * has none — so `TerminalRunStatus` is unchanged and the executor writes
 * `refused` on its refusal arm alone.
 */
export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'incomplete' | 'refused'

export interface ReconciliationRun extends TenantScoped {
  id: RunId
  definitionId: DefinitionId
  /** Pins the definition as it stood, so a re-run is distinguishable. */
  definitionVersion: number
  /**
   * Null for continuous reconciliation with no period concept.
   *
   * ⚠️ `ReconciliationPeriodId`, NOT `BillingPeriodId`. Both were `periodId:
   * string` until 7 Aug and nothing distinguished them: this is the CUSTOMER's
   * accounting close, and the seven `periodId` fields in `billing.ts` are what
   * we invoice against. Different parties set them and they close on different
   * calendars.
   */
  periodId: ReconciliationPeriodId | null
  /** Why this ran. A rerun must be distinguishable from a first run. */
  trigger: RunTrigger
  status: RunStatus
  inputs: Record<SlotName, SourceDocumentId[]>
  startedAt: Timestamp
  finishedAt: Timestamp | null
  tokenUsage: TokenUsage | null
}

/**
 * What MAY start a run, declared per definition.
 *
 * A catalogue of options, not four live paths. A given definition enables one
 * or two — almost always manual plus one automatic — and the rest are simply
 * not wired. Enabling two does create a race (an operator presses Run while a
 * document lands), so run admission must be idempotent on
 * (period, definition, slot-fill state); the trigger is then ATTRIBUTION, and
 * never identity.
 *
 * `manual` and `rerun` are deliberately ABSENT from this list. Both are always
 * available to an operator and neither is a configuration choice — you need
 * manual to re-run after a rule change and to show anyone anything, and a
 * definition that has disabled it is a definition nobody can demonstrate.
 *
 * `manual` was in this set until 5 Aug, carrying the comment "needed everywhere,
 * including demos" while sitting in the list of things you could switch off. A
 * contract review caught the contradiction: the comment was right and the
 * placement was wrong.
 */
export const RUN_TRIGGER_KINDS = {
  /** Nightly or at period close, over whatever arrived. */
  scheduled: 'scheduled',
  /** A document landed and its slots are now satisfied. */
  ingest: 'ingest',
  /** The source system says a batch is ready. Cleanest semantics, least common. */
  sourceSignal: 'source_signal',
} as const
export type RunTriggerKind =
  (typeof RUN_TRIGGER_KINDS)[keyof typeof RUN_TRIGGER_KINDS]

/** What DID start a run. Recorded on the run; never a configuration. */
export type RunTrigger =
  | { kind: 'manual'; byUserId: UserId }
  | { kind: 'scheduled' }
  | { kind: 'ingest' }
  /** `sourceRef` is opaque until model/connections.ts exists. */
  | { kind: 'source_signal'; sourceRef: string }
  /** Carries what changed, so superseded exceptions are explicable. */
  | { kind: 'rerun'; ofRunId: RunId; reason: 'definition_changed' | 'rule_changed' | 'data_corrected' }

export interface MatchGroup extends TenantScoped {
  id: MatchGroupId
  runId: RunId
  keyValues: Record<string, string>
  /** A missing slot is an empty array, never an error. */
  members: Record<SlotName, SourceDocumentId[]>
  /** 'unmatched' is where an orphan belongs — never an Exception with a null
   *  explanation, which both review teams defended. */
  outcome: MatchGroupOutcome
  /** keyValues may hold identifiers (a national id, in the KYC pack), so it
   *  carries a purge date like any other personal-data-bearing row. */
  purgeAfter: Timestamp
  purgedAt: Timestamp | null
}

/* ------------------------------------------------------------------ *
 * Exceptions
 *
 * PRODUCT.md Principle 1: an exception without its explanation has lost the
 * product's point. `explanation` is therefore non-optional — the type system
 * enforces the product thesis.
 * ------------------------------------------------------------------ */

export interface ObservedValue {
  slot: SlotName
  path: FieldPath
  scalar: ExtractedScalar
  /** Set for line-scoped findings. */
  lineIndex: number | null
  sourceDocumentId: SourceDocumentId
  provenance: Provenance
  /**
   * Classification of this captured value.
   *
   * Explanation outlives the document it was drawn from — `days.exception` is
   * deliberately longer than `days.source_document` — so purging the source does
   * not remove this copy. Carrying the class here is what makes the subject
   * index in governance.ts able to find and erase it.
   *
   * (Named `exceptionDays` and `sourceDocumentDays` until 7 Aug 2026, when
   * `RetentionPolicy` was re-keyed on `RetentionClass`. Same two windows.)
   */
  dataClass: DataClass
}

/**
 * WHICH SIDE A MONEY DELTA FAVOURS — G3803, 4 Oct 2026, applying THE OWNER'S
 * RULING ON C3-02/C3-09: *"Store a signed delta: the engine records direction
 * (over/under); the column shows sign, totals net correctly, 'In variance' is
 * defined as the open residual."*
 *
 * `over` is the LEFT side exceeding the RIGHT and `under` the reverse — the
 * sign convention `ToleranceDirection` declares once (`signedVarianceMinor` is
 * `leftTotal − rightTotal`) and nothing re-derives. `absolute` stays a
 * MAGNITUDE; the direction is its own fact, so a stored magnitude never changes
 * meaning (`db/migrations/0510`).
 */
export type VarianceDirection = 'over' | 'under'

export type Delta =
  | { kind: 'numeric'; absolute: number; percentage: number | null }
  /**
   * Money deltas carry their currency, so a value ceiling is enforceable.
   * `direction` is `null` when the magnitude is zero (zero has no sign) or the
   * row predates `0510` (not recorded) — never a guessed `over`.
   */
  | {
      kind: 'money'
      absolute: Money
      direction: VarianceDirection | null
      percentage: number | null
      fx: FxConversion | null
    }
  | { kind: 'temporal'; days: number }
  | { kind: 'textual'; similarity: number }

/** Structured, not prose — so provenance links render and deltas aggregate. */
export interface Explanation {
  /**
   * ⚠️ `| null` SINCE G3748 (4 Oct 2026) — R-D, THE OWNER'S: *"Store typed
   * facts only … the sentence is composed where it is displayed."* An
   * exception the ENGINE raises carries no sentence (`db/migrations/0500` §2);
   * `null` means nobody authored one, never an empty one. The structure below
   * — `observed`, `expected`, `delta` — is what a display composes from.
   */
  summary: string | null
  observed: ObservedValue[]
  expected: string
  delta: Delta | null
  confidence: number | null
}

/* ------------------------------------------------------------------ *
 * Resolution and reversal
 *
 * Two things were missing and they turn out to be the same thing.
 *
 * ACCOUNTABILITY. An exception resolved autonomously has no ApprovalDecision,
 * so nothing carried a human name and the chain terminated at the agent — the
 * authorless output that makes abdication easy. Recording the POLICY that
 * authorised it moves the chain to the person who authored that policy, which
 * is where it always belonged.
 *
 * MEASUREMENT. AutonomyDials.reversalRate is the honest measure of whether a
 * disposition was ever verifiable, and it needs to know that an auto-resolved
 * exception was later undone. Without this the recommendation loop is inert.
 * ------------------------------------------------------------------ */

/**
 * A discriminated union, not a flat record with hopeful comments.
 *
 * It was a flat record until 5 Aug, with `authorisedByPolicyId` and `decidedBy`
 * independently nullable and doc-comments saying which mode set which. That
 * made { mode: 'autonomous', authorisedByPolicyId: null, decidedBy: null } a
 * VALID value — the precise state this type was created to make impossible,
 * legal in the type that was supposed to prevent it.
 *
 * `manual` was worse: it named nobody at all. `decidedBy` documented the
 * APPROVER, so a manual execution requiring no approval recorded the proposer
 * (reachable via the proposal) and never the person who actually acted.
 */
export type ExceptionResolution =
  | {
      mode: 'autonomous'
      dispositionKey: string
      proposalId: ProposalId
      /** References Policy.id. The chain terminates in whoever authored it. */
      authorisedByPolicyId: string
      authorisedByPolicyVersion: number
      /**
       * The evaluation that decided, not merely the policy that could have.
       * Without it an auditor holding this row can reach a spec but never the
       * decision, and `Policy.createdBy` is a human at an unrelated moment.
       */
      policyEvaluationId: string
      at: Timestamp
    }
  | {
      mode: 'approved'
      dispositionKey: string
      proposalId: ProposalId
      /** EVERY approver, not one. Quorum may exceed 1 and four-eyes means two names. */
      approvedBy: UserId[]
      executedBy: UserId
      at: Timestamp
    }
  | {
      mode: 'manual'
      dispositionKey: string
      proposalId: ProposalId
      /** The person who acted. A different fact from proposer and from approver. */
      executedBy: UserId
      at: Timestamp
    }

/**
 * Why a resolution was undone.
 *
 * A closed vocabulary, and the distinction inside it is load-bearing: **not
 * every reversal indicts the autonomy.** A disposition reversed because the
 * underlying data was corrected, or because the rule should not have fired, was
 * the right judgement on what was known at the time. Counting those against the
 * reversal rate would narrow autonomy for reasons that have nothing to do with
 * the agent's judgement, and the loop would slowly strangle itself on its own
 * data corrections.
 */
export type ReversalReason =
  /** The judgement was wrong on the facts available. Indicts autonomy. */
  | 'wrong_disposition'
  /** It should not have been resolved yet. Indicts autonomy. */
  | 'insufficient_evidence'
  /** The underlying data changed afterwards. Does not indict. */
  | 'data_corrected'
  /** The rule should not have fired at all. A rule problem, not a judgement one. */
  | 'rule_wrong'
  /** Finance or the ERP rejected it downstream. Does not indict. */
  | 'downstream_rejected'
  /**
   * The person who acted undid their own act — a mis-click retracted inside the
   * reversal window. Does not indict. G3811, 4 Oct 2026, THE OWNER'S RULING ON
   * C3-12, quoted: *"New 'undone' reason: add an 'undone_by_actor' reversal
   * reason that does not count against the disposition's reversal rate."* Before
   * it, the register's Undo reversed with `wrong_disposition` and every
   * retracted mis-click inflated the disposition's reversal rate.
   */
  | 'undone_by_actor'

/**
 * Whether a reversal counts against the autonomy that produced it.
 *
 * A function rather than a comment, because every call site that computes a
 * reversal rate must agree — and one that quietly counts all reversals will
 * drive autonomy to `none` across the fleet and look like evidence while doing
 * it.
 */
export function reversalIndictsAutonomy(reason: ReversalReason): boolean {
  return reason === 'wrong_disposition' || reason === 'insufficient_evidence'
}

/**
 * How long a resolution stays reversible. THE OWNER'S RULING, 22 Sep 2026 —
 * G1831. Matching `docs/handoff-pack/C1 Close.dc.html`'s own posted-entry
 * copy verbatim: *"reversible for 24 hours from the post … After that a
 * correction is a new entry with its own approval, which is the point: an
 * unlimited undo is not an audit trail."*
 *
 * 🛑 THE FINDING THIS CLOSES: `docs/build/pack-tree-join.md` (G1733) measured
 * that `reverseResolution` is SERVED and MOUNTED and the 24-hour window it is
 * drawn inside existed in NO constant, NO column, NO check and NO contract
 * field anywhere in this repository —
 * `grep -rn 'reversalWindow\|reversal_window\|REVERSAL_WINDOW' model/ server/
 * db/ docs/contracts/` returned nothing before this commit. A reversal was
 * UNBOUNDED IN TIME on a served, mounted operation.
 *
 * ⚠️ ONE NUMBER, TWO ENFORCEMENT SITES, DELIBERATELY. `reversal-store.ts`
 * checks it against the DATABASE's own clock before the write is attempted,
 * so a caller past the window gets the contract's declared refusal rather
 * than a raw policy violation; `db/migrations/0210_reversal_window.sql`
 * checks it again, independently, at the row — see that file's header for
 * why the second check reads the row's OWN pinned columns rather than
 * subquerying another table.
 */
export const REVERSAL_WINDOW_HOURS = 24

export interface ExceptionReversal {
  at: Timestamp
  /** Always a human. A reversal is a correction, and corrections are signed. */
  reversedBy: UserId
  reason: ReversalReason
  note: string | null
  /** Where the exception went. Usually back to `open`. */
  newStatus: ExceptionStatus
  /** Set when the reverser chose a different disposition rather than reopening. */
  correctedDispositionKey: string | null
}

export interface Exception extends TenantScoped {
  id: ExceptionId
  matchGroupId: MatchGroupId
  ruleId: RuleId
  /** Pins the rule as it was when this fired. See MatchRule.version. */
  ruleVersion: number
  /** Pins the definition version, so a re-run is distinguishable. */
  definitionVersion: number
  /** Set for line-scoped rules; identifies which matched line failed. */
  lineKey: string | null
  /**
   * Cross-run identity. MatchGroup is minted per run, so without this March's
   * exception stays open forever after April's run resolves it, and
   * resolved-then-recurred is indistinguishable from never-resolved. Also stops
   * the billable exceptions_raised meter inflating on every re-run.
   */
  carriedForwardFrom: ExceptionId | null
  /**
   * THE RUN THAT RAISED THIS EXCEPTION — G3621, THE OWNER'S RULING OF
   * 3 Oct 2026: *"Add run id: exceptions record the run that raised them; the
   * register, counts and 'Needs you' can scope to the selected run."*
   *
   * ⚠️ NULLABLE, AND NULL MEANS *NOT RECORDED*, NEVER *NO RUN*. Every row
   * stored before `db/migrations/0480_exception_run_id.sql` carries no run, and
   * nothing joins one to a run without guessing (`match_group_id` is minted per
   * run and has no table), so the migration records none rather than inventing
   * one. A run-scoped read therefore never sees such a row — it is outside the
   * question, as a null `valueAtRisk` is outside a money threshold.
   *
   * Distinct from `carriedForwardFrom`: a carried-forward exception is raised
   * AGAIN by the later run, so `runId` is the run that raised THIS row and
   * `carriedForwardFrom` the row it continues.
   */
  runId: RunId | null
  severity: Severity
  /** Required. Non-nullable. This is the product thesis, in the type system. */
  explanation: Explanation
  /* --- denormalised for the queue. Derived, never authoritative. ---
   * The reviewer's list view is the primary read surface; reaching `domain`
   * was three joins, and rule labels lived inside a JSON array. Severity is
   * given an ordinal because ORDER BY on the string union sorts
   * critical, high, low, medium. */
  domain: DomainKey
  definitionId: DefinitionId
  ruleLabel: string
  severityRank: number
  /** Value at risk, where the finding is monetary. Sortable without parsing. */
  valueAtRisk: Money | null

  /* --- the two AUTHORISING projections. Added 7 Aug 2026 (E2). ---
   *
   * These are not queue convenience like the four above. Until they landed,
   * TWO OF THE SIX `AssignmentScope` dimensions bound on nothing: `costCentres`
   * and `legalEntities` narrowed an assignment, typechecked, rendered in an
   * admin UI, read correctly in an access review — and matched every row,
   * because no exception carried either attribute. A control that looks present
   * and is absent is worse than an absent one, and it is the same failure class
   * as `ApprovalConfig.segregationOfDuties` being vacuous against an agent
   * proposer (`docs/access-and-agency.md` §5) and `MAX_GRANT_HOURS` having zero
   * call sites while its comment claimed enforcement (§8.5).
   *
   * It reaches past the queue: `presentation.ts` intersects BOTH dimensions on
   * every card binding, and its own header uses two users with different cost
   * centres as the worked example of why a dashboard does not confer its
   * contents. The mechanism was correct end to end and the attribute did not
   * exist on the row.
   *
   * DONE NOW BECAUSE IT IS CHEAPEST NOW. After the queue exists this is a
   * backfill over every open exception whose values must be reconstructed from a
   * `TagPolicy` that may have changed in the interim — and a reconstructed
   * authorisation attribute is a guess about who was allowed to see what.
   *
   * RESOLVED AT RAISE TIME FROM THE TENANT'S `TagPolicy`, from
   * `chargebackKey` and `legalEntityKey` respectively, through
   * `TagKeySpec.settableAt` precedence — the same at-write discipline as
   * `SourceDocument.purgeAfter`. Read-time resolution would let a policy edit
   * silently re-scope who could already see an open exception.
   *
   * BARE `string`, DELIBERATELY, and not to be "fixed" into a branded id. Both
   * dimensions are `ScopeDimension<string>` documented as opaque customer text
   * (`kernel.ts`, at `SolutionId`): a cost centre is the customer's org chart
   * and the platform must not know anything about it beyond the key name.
   *
   * ⚠️ NULL MUST NEVER SATISFY A `these` NARROWING. An untagged exception is
   * outside every cost-centre-scoped assignment, not inside all of them — the
   * hole `valueCeiling` names for two null operands. SQL gives this for free
   * (`NULL IN ('CC-1100')` is NULL, so `WHERE` drops the row) and that accident
   * is the enforcement, which is exactly why it is written down here: a
   * hand-built matcher in application code that treats null as "unscoped" would
   * reverse it, and would look reasonable while doing so.
   *
   * ⚠️ SPELLING DIVERGENCE, PRE-EXISTING, NOT INTRODUCED HERE.
   * `UsageRecord.costCenter` (billing.ts) is American; `AssignmentScope
   * .costCentres`, `CardFilter.costCentres` and this field are British. This
   * field takes the spelling of the dimension it must bind against, because
   * that join is an authorisation decision and the billing one is not. One
   * spelling should win eventually; picking it is a rename across two modules
   * and two contract files and belongs in its own commit.
   */
  costCentre: string | null
  legalEntity: string | null
  status: ExceptionStatus
  assignedTo: UserId | null
  raisedAt: Timestamp

  /* --- resolution and its undoing --- */

  /** The current resolution. Null while unresolved, and cleared on reversal. */
  resolution: ExceptionResolution | null
  /**
   * Every reversal, in order. An array rather than a flag because an exception
   * can be resolved, reversed, re-resolved and reversed again — and a
   * disposition that needs two goes is a signal in itself.
   */
  reversals: ExceptionReversal[]
}

/* ------------------------------------------------------------------ *
 * Resolution
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * The harness — a procedure is a graph, not a numbered list
 *
 * SopStep was { order, instruction: string, requiresEvidence: boolean } —
 * prose with a number. It could not express a condition, a role, a threshold, a
 * timeout, a branch or an escalation, which meant the approval chain, the
 * autonomy envelope and the agent-builder workflow were three mechanisms that
 * should have been one.
 *
 * This is that one mechanism. Note that `branch` reuses RulePredicate: the same
 * expression language governs matching and procedure flow, so the DSL does not
 * bifurcate into two half-languages.
 *
 * Declarative by decision of 4 Aug 2026 — steps come from this fixed catalogue
 * and a pack may not add a kind. Everything authored stays data, stays
 * evaluable by the same scorers, and cannot introduce a capability policy has
 * not already seen.
 * ------------------------------------------------------------------ */

/* `ProcedureStepId` WAS `= string` HERE AND IS NOW `Id<'ProcedureStep'>` IN
 * `model/kernel.ts`, re-exported at the top of this file. Fixed 7 Aug, slice 6.
 *
 * The finding stood in this spot through slices 3 and 5, recorded rather than
 * fixed each time because a move slice and an entity slice each needed "no
 * field's declared type changed" as their evidence. It was a sixth naked id
 * alias that slice 4's `_NoNakedStringAliases` listed five of and did not reach
 * — `docs/HANDOFF.md` §5.6, a control that passes while the thing it names is
 * still true one file over. Slice 6's `_NoIdShapedReferenceIsABareString`
 * reaches it, because it checks FIELD TYPES rather than alias declarations, and
 * an alias that is `string` makes every field carrying it a bare string.
 *
 * It failed none of the four questions and still does not: WE mint it (not R1);
 * it is dereferenced, not a namespace — `ProcedureStepExecution.stepId` and the
 * `seen`/`queue` walk above both use it to FIND a step (not R2); each arm of
 * `ProcedureStep` carries an addressable `id` (not R3); and the heterogeneity
 * exception is spent on `ResourceRef.resourceId` (not R4).
 *
 * ⚠️ ONE COST, PAID KNOWINGLY. `ProcedureStep` is an exported discriminated
 * UNION, not an exported interface, so `tools/planner/extract.mjs` — which
 * indexes `export interface` — now reports one `brand_without_interface` gap
 * for this name, taking that count from 0 to 1. The gap is a tool limit rather
 * than a modelling error, and it is left standing rather than avoided by
 * leaving the alias naked. See the note at the declaration in `kernel.ts`.
 */

/** What may be offered as proof at a human step or attached to a proposal. */
export type EvidenceKind =
  | 'document'
  | 'correspondence'
  | 'system_record'
  | 'attestation'
  | 'free_text'

export type AwaitTarget =
  | { kind: 'document'; documentTypeId: DocumentTypeId }
  /** The vendor reply. The resolution loop usually turns on this. */
  | { kind: 'counterparty_reply' }
  /** @dropped-for-v1 7 Aug 2026 — every v1 advance is caused by an act; nothing advances because time passed. Declared, not built. */
  | { kind: 'timer' }

export type ProcedureStep =
  | {
      kind: 'agent'
      id: ProcedureStepId
      label: string
      action: AgentAction
      /** Tool names this step may call. Bounded by the pack, gated by policy. */
      /**
       * Tool names this step may call. Bounded by the pack, gated by policy.
       *
       * WAS `string[]`, and the comment above was false in both halves: nothing
       * bounded it and nothing gated it. A free-string tool scope is a
       * tenant-authored agent naming its own tools against no vocabulary —
       * the same shape as a pack inventing a capability, which this model
       * refuses everywhere else.
       *
       * `TOOL_EFFECT` in agents.ts is total over this set, so every tool
       * declares whether it reads tenant data, writes it, reaches an endpoint,
       * or egresses — which is what makes the lethal-trifecta check something a
       * type can see rather than something a reviewer must notice.
       */
      toolScope: ToolKey[]
    }
  | {
      kind: 'human'
      id: ProcedureStepId
      label: string
      /**
       * WHAT THIS STEP NEEDS, never who holds it.
       *
       * Was `role: RoleKey`, which asked for "an approver". What it meant is
       * "someone who may approve, on this domain, at or above this value" — and
       * a bare key satisfied by any pack's role keyed `approver` is a KYC
       * reviewer approving an AP write-off, one string comparison away.
       * `Role.key` is namespaced by pack precisely because that comparison is
       * unsafe; `RoleKey` never was. A pack whose role is named differently per
       * customer still satisfies the step when the step names the capability.
       *
       * `secondApproverAbove: Money | null` was folded in here and deleted. It
       * said "two people above this amount", which is exactly
       * `distinctHolders: 2` plus `appliesAtOrAboveValue` — and two encodings of
       * one rule are two encodings that can disagree, with no tiebreak written
       * anywhere. NOTE FOR policy.ts: its comment at ApprovalConfig
       * .mandatoryAtOrAboveValue still cites `ProcedureStep.secondApproverAbove`
       * by name and now refers to a field that does not exist.
       */
      requires: CapabilityRequirement
      requiredEvidence: EvidenceKind[]
    }
  | { kind: 'branch'; id: ProcedureStepId; label: string; predicate: RulePredicate }
  | {
      kind: 'await'
      id: ProcedureStepId
      label: string
      waitingFor: AwaitTarget
      /** @dropped-for-v1 7 Aug 2026 — a per-execution durable timer with resume-after-crash semantics is out of v1; no work-level escalation clock is drawn anywhere in the pack. Declared, not built. */
      timeoutHours: number
    }
  | {
      kind: 'notify'
      id: ProcedureStepId
      label: string
      templateKey: string
      /**
       * WHERE THIS GOES. Added 5 Aug 2026, and its absence was the sharpest
       * hole a red team found on the resource axis.
       *
       * This step carried a template key and nothing else — no recipient, no
       * channel, no address. And `validateProcedureInjectionSafety()` treats
       * `next.kind === 'notify'` as THE OUTBOUND TERMINATOR of the lethal
       * trifecta: it is what raises `untrusted_to_outbound_without_human`. So
       * the one control the entire prompt-injection posture rests on was
       * anchored to a step whose destination was unmodelled.
       *
       * Two consequences followed, both now closed by naming the destination.
       * `CorrespondenceConfig.requireVerifiedEndpoint` and
       * `CounterpartyEndpoint.verifiedAt` could not bind — there was no
       * endpoint on the step to check. And `mayNotifyContact()`, the model's
       * one working sink gate, was unreachable from here.
       *
       * A `contact` destination routes through `mayNotifyContact()`; a
       * `counterparty` destination routes through the correspondence path and
       * its outbound classification ceiling. There is no third option and no
       * free-string address, deliberately — an unverifiable destination is how
       * the terminator became decorative.
       */
      destination:
        | { kind: 'contact'; duty: ContactDuty }
        | { kind: 'counterparty'; counterpartyId: CounterpartyId }
    }
  /** Terminal. Names a disposition from the pack's list. */
  | { kind: 'terminate'; id: ProcedureStepId; label: string; dispositionKey: string }

export interface ProcedureEdge {
  from: ProcedureStepId
  to: ProcedureStepId
  /**
   * Null is unconditional. A `branch` step must have exactly one 'true' and one
   * 'false' edge; an `await` step should have a 'timeout' edge or it relies on
   * defaultEscalationCapability.
   */
  /** @dropped-for-v1 7 Aug 2026 — the `'timeout'` member only: no procedure clock fires in v1, so no edge is ever taken on one. Declared, not built. */
  when: 'true' | 'false' | 'timeout' | null
}

/**
 * Replaces Sop. The human-readable SOP is RENDERED from this, so the document
 * and the behaviour cannot drift — which is the failure mode written SOPs
 * already have in the field.
 */
export interface Procedure extends TenantScoped {
  id: ProcedureId
  name: string
  version: number
  status: 'draft' | 'active' | 'archived'
  /** Partner template -> customer instantiation. Salvaged clone-to-scope. */
  derivedFrom: ProcedureId | null
  /** Which archetype's exceptions this procedure may handle. */
  archetype: ReconciliationArchetype
  entryStepId: ProcedureStepId
  steps: ProcedureStep[]
  edges: ProcedureEdge[]
  /**
   * Where a timed-out step goes when no 'timeout' edge is declared — expressed
   * as the capability the escalation target must hold.
   *
   * Was `defaultEscalationRole: RoleKey | null`. A bare `Capability` rather
   * than a `CapabilityRequirement` because an escalation is a destination, not
   * a gate: there is no value threshold to clear and no distinct-holder count
   * to satisfy — the step that timed out already cleared its own. Asking for a
   * requirement here would invite a second, quieter threshold on the path
   * nobody watches.
   */
  /** @dropped-for-v1 7 Aug 2026 — names a destination no v1 clock ever reaches; an escalation router that re-enters the graph is out of scope. Declared, not built. */
  defaultEscalationCapability: Capability | null
}

/* ------------------------------------------------------------------ *
 * Procedure runtime state
 *
 * `Procedure` is the graph. This is the walk. Until 5 Aug only the graph
 * existed, and nothing anywhere recorded that a step had RUN.
 *
 * Two independent reviews found the hole from opposite ends — the
 * exception-slice review ("nothing holds where an exception is inside a
 * procedure") and the agency review ("nothing records that a procedure step
 * ran"). Convergence of that kind has, in this model, been the reliable signal.
 *
 * What was unimplementable without it:
 *   - `step_not_current` (409). Two operators open the same exception, one
 *     advances; the second's request must be refused rather than silently
 *     advancing whatever node happens to be current now. Optimistic concurrency
 *     on a workflow is not optional when the workflow disburses money.
 *   - every timeout. `await.timeoutHours` is a duration with nothing to measure
 *     from, and `defaultEscalationCapability` names a destination no clock ever
 *     reaches.
 *   - `awaitingReply` / `step_awaiting_reply` (409) — a parked node resumes on
 *     admission or timeout and cannot be pushed.
 *   - the entire agent delegation chain. `AuditActor.agent` already carries
 *     `stepExecutionId: string`, referring to a type that did not exist; the
 *     derived agent grant is NAMED by (tenantId, runId, procedureId@version,
 *     stepId, stepExecutionId, modelId) and half that tuple had no home.
 *
 * The only other place the answer might have lived is `TraceRef` — which points
 * into a store `TelemetryPolicy` is explicitly designed to strip. Authorisation
 * state cannot live somewhere retention is allowed to delete.
 * ------------------------------------------------------------------ */

export const STEP_EXECUTION_OUTCOMES = {
  /** Left along an edge, normally. */
  advanced: 'advanced',
  /** `await` expired. The clock, not a person. */
  /** @dropped-for-v1 7 Aug 2026 — no procedure clock in v1, so no walk can reach this outcome. Declared, not built. */
  timedOut: 'timed_out',
  /** Routed to defaultEscalationCapability because no 'timeout' edge existed. */
  /** @dropped-for-v1 7 Aug 2026 — no procedure clock in v1, so no walk can reach this outcome. Declared, not built. */
  escalated: 'escalated',
  /** Reached a `terminate` step. The walk is over. */
  terminated: 'terminated',
  /**
   * Abandoned because the walk was restarted — a procedure upgrade, a rerun, a
   * reversal reopening a resolved exception. Distinct from `advanced` because
   * nothing chose an edge, and distinct from `failed` because nothing broke.
   */
  superseded: 'superseded',
  /** The step could not complete. An agent error, a tool refusal, a crash. */
  failed: 'failed',
} as const
export type StepExecutionOutcome =
  (typeof STEP_EXECUTION_OUTCOMES)[keyof typeof STEP_EXECUTION_OUTCOMES]

export interface ProcedureStepExecution extends TenantScoped {
  /** BRANDED 7 Aug, slice 6, with `DerivedAgentGrant.stepExecutionId`. */
  id: ProcedureStepExecutionId
  /**
   * THE INSTANCE KEY. A procedure is walked per exception, so currency is
   * per-exception: at most one row per (tenantId, exceptionId) may have
   * `endedAt === null`. That uniqueness IS the concurrency control — enforce it
   * in the store, not in the caller, or `step_not_current` becomes a race
   * against itself.
   */
  exceptionId: ExceptionId
  /**
   * Denormalised from the exception's match group rather than joined, because
   * the derived agent grant is named by a tuple that includes it, and a row
   * that must traverse two mutable tables to reach its own authority is a row
   * that can lose it. Same discipline as `AuditActor.partner_staff` carrying
   * `partnerId` inline.
   */
  runId: RunId
  procedureId: ProcedureId
  /**
   * Pinned. A procedure edited or upgraded mid-walk must not retroactively
   * change what ran — the same reason `Exception` pins `ruleVersion`.
   */
  procedureVersion: number
  stepId: ProcedureStepId
  /**
   * Monotonic within (tenantId, exceptionId), so history has an order that
   * survives equal timestamps. NOT a progress indicator: a procedure is a
   * graph, a branch and an escalation both make "step 3 of 7" meaningless, and
   * a progress bar computed from this would be a lie the UI tells confidently.
   */
  sequence: number
  /** Which edge admitted this step. Null at the entry step. */
  enteredVia: 'true' | 'false' | 'timeout' | null
  startedAt: Timestamp
  /**
   * NULL MEANS CURRENT. "Is this step current" is `endedAt === null`, answered
   * from this row alone without loading the graph — which is what makes the
   * `stepId` check on an advance cheap enough to do on every request rather
   * than once at entry.
   */
  endedAt: Timestamp | null
  /** Null exactly while `endedAt` is null. Set together, always. */
  outcome: StepExecutionOutcome | null
  /**
   * Materialised from `await.timeoutHours` at the moment the step started,
   * because a duration is not a deadline and nothing can sweep a duration. Null
   * for every step kind that does not wait.
   */
  /** @dropped-for-v1 7 Aug 2026 — materialises `await.timeoutHours`, which v1 does not set, and nothing sweeps it. Declared, not built. */
  timesOutAt: Timestamp | null
  /**
   * What a parked `await` is waiting for, copied onto the row so
   * `step_awaiting_reply` is answerable without walking the procedure. Null
   * when the current step is not an await.
   */
  awaiting: AwaitTarget | null
  /**
   * Who ended it, and under whose authority. Null while running.
   *
   * `AuditActor` rather than `UserId` because four of the five things that end
   * a step are not people — an agent under a delegation, a scheduler, a
   * retention sweep, the timeout clock. A `UserId` column would have forced
   * every one of them to borrow a human's identity, which is the attribution
   * failure `AuditEvent.actor` exists to stop.
   */
  endedBy: AuditActor | null
}

/* `ProposalId` MOVED TO `model/kernel.ts` 7 Aug and is re-exported at the top of
 * this file. It was declared HERE, 2,500 lines from the other twenty, which is
 * the strongest single argument the move had. */

/**
 * Who proposed. An agent could not, because `proposedBy` was a UserId — while
 * AgentAction listed 'propose_resolution' and AutonomyConfig carried
 * mayProposeBeyondLimits. policy.ts and this module contradicted each other on
 * the core act of an agentic product.
 */
export type ProposalActor =
  | { kind: 'user'; userId: UserId }
  | {
      kind: 'agent'
      stepId: ProcedureStepId
      /**
       * BRANDED 7 Aug 2026. Was `modelId: string`, named in CLAUDE.md's
       * invariant 7 as one of the fields that skip `resolveModel()`. A proposal
       * record that names a model by an unresolvable string cannot be audited
       * against the residency policy in force when it was made.
       */
      modelId: ModelCatalogEntryId
      /**
       * WHO SET THIS AGENT RUNNING. Added 5 Aug after a red-team pass found the
       * agent variant carried no principal at all.
       *
       * Agent authority is toolScope ∩ AutonomyConfig ∩ the initiating
       * principal's scope, and the third term was not merely unenforced — it was
       * UNCOMPUTABLE, because nothing on the record joined "who triggered the
       * run" to "what the agent then did". A user scoped to one legal entity at
       * SGD 5,000 could trigger a run whose agent auto-resolved a different
       * entity's exception at SGD 400,000, and no stored row showed the link.
       *
       * Note the precedent this follows: AuditActor.partner_staff carries a
       * grantId and platform_staff carries a supportGrantId. The agent variant
       * was the one that carried nothing.
       */
      onBehalfOf:
        | { kind: 'user'; userId: UserId; assignmentId: string }
        | { kind: 'scheduled'; policyId: string }
    }

/** Evidence for THIS DISPOSITION, as distinct from evidence that it broke. */
export interface ProposalEvidence {
  kind: EvidenceKind
  /** Opaque reference — a document id, a thread id, a prior exception id. */
  ref: string
  note: string | null
}

export interface ResolutionProposal extends TenantScoped {
  id: ProposalId
  exceptionId: ExceptionId
  proposedBy: ProposalActor
  /** From the pack's disposition list, inside a family the archetype allows. */
  dispositionKey: string
  rationale: string
  /**
   * Explanation.observed[] is why it broke. This is why THIS disposition —
   * the delivery note, the vendor reply, the prior case that settled the same
   * way. SopStep.requiresEvidence was a boolean with nowhere to put any.
   */
  evidence: ProposalEvidence[]
  /** Required when the chosen disposition has requiresAdjustment. */
  adjustment: Money | null
  proposedAt: Timestamp
}

/**
 * Keyed to the PROPOSAL, not the exception.
 *
 * ApprovalConfig.quorum and segregationOfDuties were unimplementable against
 * an exception key: you cannot count distinct approvers of a thing, nor assert
 * approver !== proposer, without knowing which proposal is being decided.
 */
export interface ApprovalDecision extends TenantScoped {
  /**
   * ADDED 7 Aug (G35). It records an act — an actor and a time — and quorum is
   * the reason it needs an address of its own: `ApprovalConfig.quorum` counts
   * DISTINCT approvers of one proposal, so there are deliberately several of
   * these rows per `proposalId`, and `(proposalId, decidedBy)` is not a key
   * either once a decision can be superseded.
   */
  id: ApprovalDecisionId
  proposalId: ProposalId
  exceptionId: ExceptionId
  decidedBy: UserId
  decision: 'approved' | 'rejected'
  /** Rejection always requires a reason. Carried over from existing behaviour. */
  reason: string | null
  /**
   * When approval was ASKED FOR. Added 5 Aug 2026, and it is the missing t0.
   *
   * This record carried `decidedAt` and nothing else, so there was no way to
   * compute how long a decision had been outstanding — and
   * `ApprovalConfig.escalateAfterHours` is read by nothing, so a missing
   * notification stalled an approval PERMANENTLY WITH NO CLOCK. Neither a sweep
   * nor a dashboard could find it; the only trigger was someone thinking to open
   * a list view.
   *
   * `livenessFor()` in deployment.ts is the one place in the model where elapsed
   * time already drives a state transition. The pattern was available and had
   * not been applied to approvals.
   */
  requestedAt: Timestamp
  decidedAt: Timestamp
}

/* ------------------------------------------------------------------ *
 * The operator-initiated proposal — G42, G43, G44. Added 7 Aug 2026.
 *
 * WHAT IT IS. An operator asks the assistant whether it is safe to post a
 * production order. The agent reads the ERP LIVE, over the same connection
 * that would write back, and proposes a transaction. If there is not enough
 * stock it proposes something different — a partial production order, and
 * SEPARATELY a procurement order for the raw material. Nothing about this is a
 * reconciliation exception. Nothing broke; nobody is disputing a number.
 *
 * WHY THE MODEL COULD NOT EXPRESS IT. `ResolutionProposal.exceptionId` is
 * required and non-nullable, so every proposal in the model hangs off a
 * reconciliation exception — and an operator's question mints none. The
 * TRIGGER already existed: `RunTrigger` has carried `{ kind: 'manual',
 * byUserId }` since the beginning. It was the OUTCOME shape that did not.
 *
 * WHY IT IS A SECOND TYPE AND NOT A NULLABLE FIELD — G44, and this is the
 * whole of it. Making `exceptionId` nullable on `ResolutionProposal` would put
 * the boundary in a convention: every reader would have to remember which
 * shape it was holding, every writer could set the field on either, and the
 * distinction would erode in the direction it always erodes — towards the
 * older type, because that is the one the queue, the approval config and the
 * disposition vocabulary already understand. So the boundary is STRUCTURAL:
 *
 *   `OperatorProposal` CARRIES NO `exceptionId` FIELD AT ALL. Not nullable.
 *   ABSENT.
 *
 * Then which type you are holding is answered by the type system rather than
 * by a comment, attaching an operator proposal to an exception is a compile
 * error rather than an erosion, and the brands differ too
 * (`Id<'OperatorProposal'>` vs `Id<'ResolutionProposal'>`) so the two cannot
 * be interchanged even by id. `_OperatorProposalIsNotExceptionAnchored` below
 * turns the absence into an assertion, so ADDING the field later is a compile
 * error and not a quiet widening.
 *
 * THE STATED RULE FOR WHICH TYPE APPLIES — G42 owes one, or this becomes
 * HANDOFF §5.3, two vocabularies for one concept, for the fifth time:
 *
 *   Does an `Exception` exist to anchor it?
 *     yes -> `ResolutionProposal`. It disposes of something that broke, from
 *            the pack's disposition list, inside a family the archetype allows.
 *     no  -> `OperatorProposal`. It proposes a write into a foreign system in
 *            answer to a question a person asked.
 *
 * That is a fact about the world at the moment of proposing, not a judgement
 * about intent, which is why it survives contact with a queue.
 * ------------------------------------------------------------------ */

/**
 * One live read of a foreign system, recorded because a proposal that cannot
 * show what it read is an opinion.
 *
 * ⚠️ THE PRODUCT CLAIM LIVES IN TWO FIELDS. `readAt` plus `endpointId` are what
 * carry *"read live, over the connection that will post"* — and nothing else in
 * this model evaluates a foreign-system read as a gate on a decision. G40
 * proposed a typed `PostingPrecondition` to hold this; G42 SUPERSEDED it,
 * because the screen's own binding is generic (`{{ k.label }} {{ k.value }}`,
 * captioned *"read from SAP · 4s ago"*) and the panel's contents are sample
 * data — inventory today, shipment status next time. A typed precondition
 * would have fixed a vocabulary the product does not have. **There is no
 * `PostingPrecondition` type. Do not create one.**
 *
 * ⚠️ INVARIANT 6 — INGESTED CONTENT IS DATA, NEVER INSTRUCTION — AND HERE IT IS
 * UNENFORCED. `label` and `value` are text a foreign system returned. They are
 * evidence and they are never a directive, and the model says so and cannot
 * check it. Three specific reasons, each verifiable rather than atmospheric:
 *
 *   1. R5 IS OPEN BY RECORD, not by oversight. `docs/prompt-injection-posture.md`
 *      §6 lists *"connector payloads are untrusted too; the trifecta rule is
 *      scoped to counterparty replies only"* as an outstanding residual risk.
 *      This type is a connector payload landing in the model.
 *   2. `TOOL_ADMITS_UNTRUSTED_TEXT` DOES NOT EXIST. G9 decided the
 *      injection-safety rewrite lands as ONE change at three sites; it is not
 *      applied. So the predicate that would classify `endpoint_read` as a
 *      source of untrusted text is absent, and this comment is asserting an
 *      absence rather than relying on a check.
 *   3. CONCRETELY, THE TRIFECTA RULE DOES NOT FIRE ON THIS PATH.
 *      `validateAgentToolBindings()` (`agents.ts`) tests
 *      `b.tool === TOOL_KEYS.readCorrespondenceThread` to decide whether an
 *      agent reads untrusted text, then refuses an `egress` effect alongside
 *      it. An agent bound to `endpoint_read` + `send_correspondence` passes
 *      that check today. That is HANDOFF §5.1 exactly — a rule keyed on a
 *      convenient landmark instead of the property it cares about — and it is
 *      the landmark G9 exists to replace.
 */
export interface EndpointReading extends TenantScoped {
  id: EndpointReadingId
  /**
   * ⚠️ THE SAME ENDPOINT THE WRITE WOULD GO TO, and that is the point of the
   * feature rather than an incidental fact. The model cannot enforce the
   * identity — `ProposedTransaction.endpointId` is a separate field and
   * nothing here compares them — so a reading from a stale replica supporting
   * a write to the live ledger is representable. Recorded, not solved: the
   * check belongs where the write is executed, and there is no execution path
   * yet.
   */
  endpointId: EndpointId
  /**
   * ALWAYS `endpoint_read`, and typed as the literal rather than as `ToolKey`
   * so that a second read path is a COMPILE ERROR rather than a convention.
   *
   * `endpoint_read` already exists in the closed tool vocabulary with
   * `TOOL_EFFECT.endpoint_read = 'reach_endpoint'` and
   * `TOOL_CAPABILITY.endpoint_read = 'view_document'`. Reusing it is deliberate:
   * inventing a second reaching-a-foreign-system tool would fork
   * `validateAgentToolBindings()`, `derivedGrantFor()` and the trifecta rule,
   * each of which is total over `ToolKey` and would then be total over the
   * wrong set.
   */
  tool: typeof TOOL_KEYS.endpointRead
  /** What was read, in the source system's words. Rendered, never parsed. */
  label: string
  /**
   * The value, as a string, because the model does not know the foreign
   * system's types and must not pretend to. A quantity, a status, a date, a
   * document number. Compare `Delta`, which is structured precisely because
   * OUR engine produced it; this did not.
   */
  value: string
  /** When the foreign system answered. Freshness is the claim; this is it. */
  readAt: Timestamp
  /**
   * INVARIANT 10 — an act with no authorisation is unrecordable. The READ half.
   *
   * Non-nullable, unlike `AuditEvent.authorizationId`, and the difference is
   * argued rather than accidental: that field admits null for exactly three
   * shapes, of which the only actor kind in `AUTHORIZATION_MAY_BE_ABSENT` is
   * `system`. Reaching a customer's ERP on a credential is never a system act
   * with nobody behind it — a person asked, an agent went, and
   * `authorize()` is the only thing that mints one of these.
   */
  authorizationId: AuthorizationGrantId
}

/**
 * ONE write into a foreign system. Exactly one — G43.
 *
 * ⚠️ SINGLE-ACTION IS THE DECISION, AND IT IS TAKEN AGAINST THE
 * RECOMMENDATION. A plan is *n* proposals, never one proposal carrying *n*
 * actions. There is no `actions: []` here and there must not be: a composite
 * would make "approve" mean "approve all of it", and the case that motivated
 * the whole shape — a PARTIAL production order plus a SEPARATE procurement
 * order — is precisely the case where an approver may want one and not the
 * other.
 *
 * TWO CONSEQUENCES, BOTH OPEN BY DECISION, both recorded at the field they
 * bite: the structuring bypass on `value`, and partial acceptance on
 * `OperatorProposalDecision`.
 */
export interface ProposedTransaction {
  /**
   * Where the write would go. Must have `writebackEnabled` — which is
   * `enable_endpoint_writeback`, an `authority` capability a delivery grant
   * cannot reach, so turning an ERP from readable into writable stays an act
   * somebody took deliberately.
   */
  endpointId: EndpointId
  /**
   * WHAT KIND OF WRITE, from a vocabulary the pack declares — the same shape
   * and the same reason as `ResolutionProposal.dispositionKey`. A bare string
   * here rather than a union because "production order" and "procurement
   * order" are manufacturing vocabulary and the engine is domain-neutral;
   * putting them in the type would be the ERP-vocabulary-in-a-shared-surface
   * mistake the positioning rule names.
   *
   * ⚠️ THE DECLARATION SITE DOES NOT EXIST. `dispositionKey` is validated
   * against `Disposition[]` on the pack, inside a `DispositionFamily` the
   * archetype allows. There is no equivalent list for operator actions, so
   * this key is validated against nothing today, and `Disposition
   * .reversibility` — the one autonomy dial that CANNOT be measured and must
   * be declared — has no counterpart here. That is why
   * `OPERATOR_PROPOSAL_IS_AUTONOMOUSLY_EXECUTABLE` is literal `false` below
   * rather than a policy lookup.
   */
  actionKey: string
  /**
   * What the write does, in the words a human approver will read, and what an
   * auditor will read afterwards. Never parsed, never matched on.
   */
  summary: string
  /**
   * The economic size of the write, where it has one.
   *
   * ⚠️ THE STRUCTURING BYPASS, RECORDED AT THE TYPE BECAUSE THIS IS THE FIELD
   * THAT CANNOT SEE IT (G43). A post above a ceiling splits into two below it
   * and BOTH PASS. Both ceilings in the model are a single amount compared
   * against a single proposal — `AutonomyConfig.autoResolveValueCeiling`
   * (`policy.ts:137`) and `AssignmentScope.valueCeiling` (`access.ts:673`,
   * intersected by `narrowestScope()` and checked by `scopeContains()`) — and
   * both were written when a proposal carried ONE adjustment against ONE
   * exception. Neither has an operand for a total, and there is no object in
   * the model that represents "the *n* proposals emitted from one ask", so
   * there is nothing for a total to be computed OVER.
   *
   * A shared correlation id across proposals from one ask is the RECOMMENDED
   * mitigation and IS NOT TAKEN. It would make the split VISIBLE to an
   * approver and an auditor without blocking it — the argument invariant 10
   * makes for itself, that detectable beats impossible. Not added here because
   * it was not asked for; left as the first thing to reach for when this is
   * revisited.
   *
   * ⚠️ AND THE TWO CEILINGS DO NOT SHARE A TYPE. This is `Money`
   * (`currency`, `amountMinor`, `exponent`) because `AssignmentScope
   * .valueCeiling` is `Money`, and that comparison is an AUTHORISATION
   * decision. `AutonomyConfig.autoResolveValueCeiling` is `MoneyAmount`
   * (`policy.ts:148`), a different interface. Any check that wants both must
   * convert, and no function in the model does. Pre-existing; surfaced here
   * because this is the first field that must be compared against both.
   */
  value: Money | null
}

/**
 * A proposed transaction, produced from an operator's question. NOT anchored
 * to an exception, and structurally incapable of being anchored to one.
 *
 * READ THE SECTION HEADER ABOVE FOR G44. The short version is that this
 * interface has no `exceptionId` field, that the absence is asserted below,
 * and that its id brand differs from `ProposalId`.
 *
 * ⚠️ WHAT DOES NOT WORK ON THIS TYPE, and none of it is an oversight:
 *
 *   `ApprovalDecision` — keyed to `(proposalId: ProposalId, exceptionId:
 *   ExceptionId)`. It cannot decide one of these without a shape change, and a
 *   shape change is exactly what G44 refuses. `OperatorProposalDecision` below
 *   is the counterpart.
 *
 *   `ExceptionStatus` — there is no row to move through it. An operator
 *   proposal that is rejected leaves nothing open; the question was answered
 *   "no" and that is a complete outcome.
 *
 *   `Disposition` and `DispositionFamily` — a disposition disposes of
 *   something that broke. Nothing broke here.
 */
export interface OperatorProposal extends TenantScoped {
  id: OperatorProposalId

  /* --- the ask --- */

  /**
   * WHO ASKED. Named `askedByUserId` rather than `askedBy` deliberately: an
   * id-shaped field name is what makes a reference visible to the extractor,
   * and a field called `askedBy` carrying a branded id is an edge no tool in
   * this repository can see. The same reasoning renamed `Membership.role` to
   * `roleId` on 7 Aug.
   *
   * This is the human operand `ProposalActor.agent.onBehalfOf` exists for, and
   * it is the SAME PRINCIPAL `RunTrigger.manual.byUserId` records — the
   * trigger shape was already right, which is G42's observation.
   */
  askedByUserId: UserId
  /**
   * The operator's question, in their words.
   *
   * ⚠️ THIS IS TENANT-AUTHORED FREE TEXT AND IT REACHES A PROMPT. It is not
   * untrusted in the invariant-6 sense — a person with a session asked it, and
   * their authority is bounded by their own scope, which is the third term in
   * `toolScope ∩ AutonomyConfig ∩ initiating principal's scope`. It IS
   * untrusted in the ordinary sense that R2 names: prompt-assembly framing —
   * delimiting, provenance marking — is in comments and not enforced by a
   * type, here as everywhere else.
   *
   * `model/learning.ts` shows the alternative and why it is not available
   * here: a learning record has NO free-text field at all, so an injected
   * sentence has nowhere to be stored. A question the operator asked cannot be
   * structured away — the question IS the content.
   */
  question: string
  askedAt: Timestamp

  /* --- what grounded it --- */

  /**
   * The live reads that produced the answer, in the order they were taken.
   *
   * By reference rather than inline because each carries its own
   * `authorizationId` and its own timestamp: a reading is an ACT, and an act
   * folded into the record it justifies cannot be joined to the audit stream
   * that also recorded it. Empty is legal and is a real shape — a proposal
   * grounded on nothing but tenant data we already hold — and it is exactly
   * the shape a reviewer should look at hardest, because the caption on the
   * screen says the number came from the source system.
   */
  readingIds: EndpointReadingId[]
  /** Who proposed. The same union `ResolutionProposal` uses — user or agent. */
  proposedBy: ProposalActor
  /**
   * WHY THIS TRANSACTION. The counterpart of `ResolutionProposal.rationale`,
   * and the product's whole thesis applied to a path with no exception: an
   * answer without its reasoning has lost the point.
   */
  rationale: string
  /** Exactly one write. G43. See `ProposedTransaction`. */
  action: ProposedTransaction
  proposedAt: Timestamp

  /* --- the two AUTHORISING projections, for the reason E2 taught --- */

  /**
   * ⚠️ HERE FROM DAY ONE, RATHER THAN AS A BACKFILL LATER. `Exception` gained
   * these two columns on 7 Aug (E2) after they had been missing since the
   * model began, and the finding was that `AssignmentScope.costCentres` and
   * `.legalEntities` narrowed an assignment, typechecked, rendered in an admin
   * UI, read correctly in an access review — and matched every row, because no
   * exception carried either attribute. This type is a NEW anchor for the same
   * six-dimension scope. Omitting them would recreate that defect on a type
   * whose whole purpose is to authorise a write into the customer's ledger.
   *
   * Every rule from `Exception.costCentre` applies unchanged and is not
   * repeated here: bare `string` because the dimension is opaque customer
   * text; resolved at write time from the tenant's `TagPolicy` through
   * `TagKeySpec.settableAt` precedence; British spelling because the join is
   * an authorisation decision; and ⚠️ NULL MUST NEVER SATISFY A `these`
   * NARROWING — an untagged proposal is OUTSIDE every narrowed assignment, not
   * inside all of them.
   *
   * ⚠️ AND THE SAME LIMIT HOLDS: representable, not enforced. The at-write
   * resolver from `TagPolicy` does not exist for `Exception` and does not
   * exist here either.
   */
  costCentre: string | null
  legalEntity: string | null
}

/**
 * Accepting or refusing ONE operator proposal.
 *
 * A separate type from `ApprovalDecision` for the reason G44 gives: that one
 * carries a required `exceptionId`, so reusing it would put an exception back
 * into this path through the decision record, having kept it out of the
 * proposal. The boundary has to hold on both halves or it holds on neither.
 *
 * ⚠️ PARTIAL ACCEPTANCE IS REPRESENTABLE AND IS NOT PREVENTED — G43's second
 * open consequence, recorded here because this is the row that makes it
 * happen. The partial production order is accepted; the procurement order for
 * the raw material is not; and the business is left in a state NOBODY CHOSE —
 * committed to build with no material inbound. Neither half is wrong on its
 * own, which is why no per-proposal check can catch it.
 *
 * It is not prevented because preventing it means one of two things the
 * decisions rule out: a composite proposal (refused by G43), or a dependency
 * edge between proposals, which is a plan object and a second execution order
 * beside the procedure graph. What would make it VISIBLE without blocking it
 * is a shared correlation id from one ask — recommended, and not taken.
 */
export interface OperatorProposalDecision extends TenantScoped {
  id: OperatorProposalDecisionId
  proposalId: OperatorProposalId
  /** Id-shaped for the reason `askedByUserId` is. */
  decidedByUserId: UserId
  /**
   * `accepted` means the write is authorised, NOT that it happened. There is
   * no execution record on this path — see the note on
   * `OPERATOR_PROPOSAL_IS_AUTONOMOUSLY_EXECUTABLE`.
   */
  decision: 'accepted' | 'rejected'
  /** Refusal always states a reason. Carried over from `ApprovalDecision`. */
  reason: string | null
  /**
   * INVARIANT 10 — the WRITE half. Non-nullable for the same reason the
   * reading's is: authorising a post into the customer's ledger is never a
   * `system` act, and `AUTHORIZATION_MAY_BE_ABSENT` admits no other kind.
   */
  authorizationId: AuthorizationGrantId
  /**
   * When the decision was ASKED FOR. Present for the reason
   * `ApprovalDecision.requestedAt` was added on 5 Aug: without a t0 there is no
   * way to compute how long a decision has been outstanding, and a stalled
   * approval with no clock is findable only by someone thinking to open a list
   * view.
   */
  requestedAt: Timestamp
  decidedAt: Timestamp
}

/**
 * ⚠️ AN EXPIRING SAFETY ARGUMENT, IN THE STYLE OF `AGENTS_HOLD_ROLES` AND
 * `SOLUTION_IS_GRANTABLE`. Literal `false`, so changing it is a reviewed diff
 * rather than a silent drift in behaviour.
 *
 * An operator proposal can never execute without a human decision TODAY, and
 * the reason is not caution — it is that the operands do not exist.
 * `AutonomyConfig` gates autonomous execution on four dials, and the one that
 * cannot be measured is `Disposition.reversibility`, DECLARED by a pack author
 * because whether posting a production order can be undone is a fact about the
 * customer's process and the world. `ProposedTransaction.actionKey` has no
 * pack-side declaration, so there is no declared reversibility, so there is
 * nothing for `maxAutoResolveSeverity` or `autoResolveValueCeiling` to be
 * applied to.
 *
 * Flipping this to `true` requires, at minimum: a pack-declared operator-action
 * vocabulary carrying `reversibility`, an execution record, and an answer to
 * the structuring bypass on `ProposedTransaction.value` — because the first
 * autonomous act on this path is the first act where nobody sees the split.
 */
export const OPERATOR_PROPOSAL_IS_AUTONOMOUSLY_EXECUTABLE = false

/**
 * G44, TURNED FROM AN ABSENCE INTO AN ASSERTION.
 *
 * A missing field enforces nothing by itself — someone adds it later, in good
 * faith, because a queue wanted one join. This makes that a compile error.
 *
 * ⚠️ MAPPED, NOT CONDITIONAL, AND THE FIRST DRAFT WAS THE CONDITIONAL. Written
 * the obvious way — `'exceptionId' extends keyof T ? never : T` — this is
 * `error TS2313: Type parameter 'T' has a circular constraint`, because the
 * check needs `T` before `T` is bound. `model/identity.ts` records the same
 * trap on `AssertBranded`, and its answer is the one used here: a MAPPED type
 * over `keyof M` is deferred, so the constraint resolves. `exceptionId` maps
 * to `never`, and a field of any type is not assignable to `never`.
 *
 * Constraint-shaped rather than a conditional return type for the second
 * reason recorded on `AssertIdentity`: written as a return type it would
 * resolve to `never` and report NOTHING, because `never` is assignable to
 * everything.
 *
 * ⚠️ VERIFIED RED TWICE, BOTH REVERTED, and the errors are quoted rather than
 * described. Each run was accepted only because the assertion's error was the
 * ONLY error — a TS6133 or TS6196 alongside would mean `noUnusedLocals`
 * produced the red, which is the trap identity.ts records slice 5 falling into.
 *
 *   1. SUBSTITUTING THE OTHER PROPOSAL TYPE — `AssertNotExceptionAnchored<
 *      ResolutionProposal>`:
 *
 *          error TS2344: Type 'ResolutionProposal' does not satisfy the
 *          constraint 'CarriesNoExceptionAnchor<ResolutionProposal>'.
 *            Types of property 'exceptionId' are incompatible.
 *              Type 'ExceptionId' is not assignable to type 'never'.
 *
 *   2. ADDING THE FIELD TO THIS TYPE — `exceptionId: ExceptionId` on
 *      `OperatorProposal`, which is the case this assertion actually exists to
 *      catch, since nobody will retype the assertion but somebody will add the
 *      field:
 *
 *          error TS2344: Type 'OperatorProposal' does not satisfy the
 *          constraint 'CarriesNoExceptionAnchor<OperatorProposal>'.
 *            Types of property 'exceptionId' are incompatible.
 *              Type 'ExceptionId' is not assignable to type 'never'.
 *
 * A THIRD GUARD covers the id half rather than the field half — the brands are
 * genuinely distinct, so the two proposal kinds cannot be interchanged even by
 * id. `const x: ProposalId = 'op_1' as OperatorProposalId` gives
 * `TS2322 … Type '"OperatorProposal"' is not assignable to type
 * '"ResolutionProposal"'`.
 *
 * `OperatorProposal` is the passing case, which this needs — a proof with no
 * passing case does not distinguish "the rule holds" from "the rule is
 * unsatisfiable".
 */
type CarriesNoExceptionAnchor<M> = {
  [K in keyof M]: K extends 'exceptionId' ? never : M[K]
}
export type AssertNotExceptionAnchored<M extends CarriesNoExceptionAnchor<M>> = M
export type _OperatorProposalIsNotExceptionAnchored =
  AssertNotExceptionAnchored<OperatorProposal>

/* ------------------------------------------------------------------ *
 * Audit — new. The current Admin UI advertises "Audit Logs" and no such
 * route, surface or API exists.
 * ------------------------------------------------------------------ */

export interface AuditEvent extends TenantScoped {
  id: string
  /**
   * Tamper evidence. Added 5 Aug, and its absence was an asymmetry rather than
   * an oversight: metering was sequenced, hash-chained and signed because a
   * customer-owned plane could under-report, while the record of WHO TOUCHED A
   * DATA SUBJECT'S DATA sat in the same database under the same root with
   * nothing at all. See `RecordChain` in governance.ts.
   */
  chain: RecordChain
  /**
   * PROMOTED FROM TIDY TO LOAD-BEARING by §8.3, which derives organisation from
   * the identity connection.
   *
   * A directory knows who someone is NOW; an audit needs who they were THEN.
   * Left as `actorUserId: UserId`, deriving org retrospectively would
   * re-attribute every historic write to the actor's current employer — wrong
   * in exactly the cases that matter, and silently. Stamping the org onto the
   * event at write time is what keeps March's approval attributed to who she
   * was in March.
   *
   * It also closes an asymmetry nobody had noticed: reads were ALREADY
   * org-attributable, because `DataAccessEvent.actor` is an `AuditActor`.
   * Writes were not. The system could say which organisation looked at a
   * document and could not say which organisation changed one.
   *
   * No new entity is needed, because `AuditActor` already carries `partnerId`
   * and `supportGrantId` INLINE — a row must reach its authority without
   * traversing a mutable table.
   */
  actor: AuditActor
  /**
   * THE SPINE. The authorisation this write ran under — the same id carried by
   * `DataAccessEvent` and `UsageRecord`, so who / what / cost is ONE query.
   *
   * `actor` says who; `via` on the authorisation says under what standing; the
   * meter says what it cost. Before 5 Aug those were three streams with no
   * shared key, and the middle one was not stored at all — `Decision` was
   * computed and discarded.
   *
   * NULL IS LEGITIMATE AND NARROW. It means no capability was evaluated,
   * which is true of exactly three shapes: a `{ kind: 'system' }` actor doing
   * machine work nobody authorised (a retention sweep, a scheduler tick), an
   * authentication event (the act that PRODUCES a principal cannot run under
   * one), and a self-service act on one's own account. A null on any other
   * actor kind is a defect in the writer, not a permitted shape — that rule is
   * executable as `authorizationIsWellFormed()` in governance.ts rather than
   * left as this paragraph.
   */
  authorizationId: AuthorizationGrantId | null
  action: string
  subjectType: string
  /**
   * ⚠️ STAYS BARE (R4), AND `subjectType` IS WHY. The pair IS the identifier: an
   * audit row names a row of ANY type, so no single brand is correct here and
   * picking one would be worse than none. Identical in shape and reason to
   * `ResourceRef.(resourceType, resourceId)` and to `DataAccessEvent`'s own
   * pair — and the last of those is deliberate, because the two streams answer
   * one question together and a divergence in this pair is what would break the
   * join. Listed in `BareByRule` in `model/identity.ts`.
   */
  subjectId: string
  before: Json | null
  after: Json | null
  at: Timestamp
}

/* ------------------------------------------------------------------ *
 * Data governance
 *
 * See docs/data-governance.md. Designed against Singapore PDPA as the primary
 * regime, structured so a second regime is an addition rather than a rewrite.
 * ------------------------------------------------------------------ */

/**
 * Per-customer opt-in for partner access to reconciliation data.
 *
 * The decision that makes a partner a sub-processor rather than a reseller.
 * Default is no access: absence of a grant means partners see commercial
 * metadata only. A grant is explicit, time-bounded, revocable, and every use of
 * it is audited.
 */
export interface PartnerAccessGrant extends TenantScoped {
  /**
   * BRANDED 7 Aug, slice 6, with the two fields that name it:
   * `PartnerTelemetryAccess.grantId` and
   * `CommissionAttestation.baseDisclosedUnderGrantId`. This is the row on the
   * ONLY cross-tenant read path (invariant 2), so a reference to it resolving
   * to the wrong grant is the highest-consequence mistype in the model.
   */
  id: PartnerAccessGrantId
  partnerId: PartnerId
  /** Granted by the CUSTOMER, never by the partner or by 1CloudHub. */
  grantedBy: UserId
  grantedAt: Timestamp
  /** Required. An open-ended grant is not a grant. */
  expiresAt: Timestamp
  scope: PartnerAccessScope
  revokedAt: Timestamp | null
  revokedBy: UserId | null
}

/**
 * What a granted partner may see. `commercial_only` needs no grant — it is the
 * default posture and is listed here so the escalation is explicit.
 */
export type PartnerAccessScope =
  | 'commercial_only'
  | 'exceptions_read'
  | 'exceptions_operate'

/**
 * A rights request from a data subject.
 *
 * Under PDPA the obligations are Access and Correction; erasure is modelled
 * because the Retention Limitation Obligation and customer contracts both drive
 * deletion, and because a second regime would require it.
 *
 * The subject is usually NOT a user of the system: in KYC the person whose
 * document was verified has no account. Requests therefore arrive through the
 * tenant and are keyed by a subject reference, not by UserId.
 */
export interface DataSubjectRequest extends TenantScoped {
  /** BRANDED 7 Aug, slice 6, with `ErasurePlan.requestId` — one request, many plans. */
  id: DataSubjectRequestId
  kind: 'access' | 'correction' | 'erasure'
  /**
   * How the subject is identified in this tenant's data — e.g. a national id
   * hash or a document reference. Never a UserId.
   */
  subjectRef: string
  receivedAt: Timestamp
  /** Set from the tenant's regime at creation, so the clock is explicit. */
  dueBy: Timestamp
  status: 'received' | 'in_progress' | 'completed' | 'rejected'
  /** Required when rejected. PDPA permits refusal only on stated grounds. */
  rejectionReason: string | null
  completedAt: Timestamp | null
  handledBy: UserId | null
}

/**
 * A third party that processes tenant data on our behalf. Maintained as a
 * register because PDPA accountability and customer DPAs both require
 * disclosure of who touches the data.
 */
export interface SubProcessor {
  id: string
  name: string
  purpose: string
  /** Where this processor handles the data. Drives transfer assessments. */
  region: RegionKey
  /** Model providers are called out: they see document content. */
  processesContent: boolean
}

/**
 * A detected or suspected personal-data breach.
 *
 * PDPA requires notification to the PDPC within 3 calendar days of assessing a
 * breach as notifiable. `assessedAt` starts that clock, which is why it is
 * distinct from `detectedAt`.
 */
/** @dropped-for-v1 7 Aug 2026 — breach notification is a runbook in v1, not a stored record. Declared, not built. */
export interface BreachRecord {
  id: string
  detectedAt: Timestamp
  assessedAt: Timestamp | null
  notifiable: boolean | null
  affectedTenants: TenantId[]
  regulatorNotifiedAt: Timestamp | null
  subjectsNotifiedAt: Timestamp | null
  summary: string
}

/* ------------------------------------------------------------------ *
 * Typed projections
 *
 * The "typed" half of generic-core-plus-typed-projections. These exist for UI
 * ergonomics at the edge ONLY. Nothing in the engine may import them, or the
 * generic core has been defeated.
 * ------------------------------------------------------------------ */

/** @dropped-for-v1 7 Aug 2026 — a positioning property, not a v1 function; examples.ts keeps both worked domains. Declared, not built. */
export interface FinanceThreeWayView {
  invoice: SourceDocument | null
  purchaseOrder: SourceDocument | null
  goodsReceipts: SourceDocument[]
}

/** @dropped-for-v1 7 Aug 2026 — a positioning property, not a v1 function; examples.ts keeps both worked domains. Declared, not built. */
export interface KycIdentityView {
  identityDocument: SourceDocument | null
  registryRecord: SourceDocument | null
  addressProof: SourceDocument | null
}

/** Generic projector. Domain views are derived, never stored. */
/** @dropped-for-v1 7 Aug 2026 — a positioning property, not a v1 function; examples.ts keeps both worked domains. Declared, not built. */
export function project(
  group: MatchGroup,
  documents: ReadonlyMap<SourceDocumentId, SourceDocument>,
  slot: SlotName,
): SourceDocument[] {
  const ids = group.members[slot] ?? []
  const out: SourceDocument[] = []
  for (const id of ids) {
    const doc = documents.get(id)
    if (doc) out.push(doc)
  }
  return out
}

/** @dropped-for-v1 7 Aug 2026 — a positioning property, not a v1 function; examples.ts keeps both worked domains. Declared, not built. */
export function asFinanceThreeWay(
  group: MatchGroup,
  documents: ReadonlyMap<SourceDocumentId, SourceDocument>,
): FinanceThreeWayView {
  return {
    invoice: project(group, documents, 'invoice')[0] ?? null,
    purchaseOrder: project(group, documents, 'purchase_order')[0] ?? null,
    goodsReceipts: project(group, documents, 'goods_receipt'),
  }
}

/** @dropped-for-v1 7 Aug 2026 — a positioning property, not a v1 function; examples.ts keeps both worked domains. Declared, not built. */
export function asKycIdentity(
  group: MatchGroup,
  documents: ReadonlyMap<SourceDocumentId, SourceDocument>,
): KycIdentityView {
  return {
    identityDocument: project(group, documents, 'identity_document')[0] ?? null,
    registryRecord: project(group, documents, 'registry_record')[0] ?? null,
    addressProof: project(group, documents, 'address_proof')[0] ?? null,
  }
}

/* ------------------------------------------------------------------ *
 * The Ask session — and the two things it must never conflate
 * ------------------------------------------------------------------ */

/**
 * HOW MANY PRIOR TURNS RE-ENTER THE MODEL'S CONTEXT. G46, 7 Aug 2026.
 *
 * ⚠️ **THIS IS CONTEXT TRUNCATION. IT IS NOT THE CONTEXT-MINIMIZATION PATTERN, AND
 * NO DOCUMENT MAY SAY OTHERWISE.** Residual R6 in
 * `docs/prompt-injection-posture.md` STAYS OPEN.
 *
 * The pattern (Beurer-Kellner et al., arXiv:2506.08837, pattern 6) removes untrusted
 * content from context once it has been translated into actions. A window does not
 * do that. It bounds HOW LONG a landed injection stays resident and does nothing
 * about whether it lands: inside the window the agent sees raw ERP text on every
 * turn, so an instruction sitting in an `EndpointReading` gets N attempts instead of
 * one.
 *
 * Recorded as the product owner's decision, taken with that assessment in front of
 * them. It is a defensible v1 stopgap. It is not the control it resembles, and the
 * distance between those two is why this comment is long.
 *
 * A NAMED CONSTANT RATHER THAN A NUMBER INSIDE AN IMPLEMENTATION, so widening it is
 * a reviewed diff. Raising it raises the attempt count linearly.
 */
export const CONTEXT_WINDOW_TURNS = 3

/**
 * ONE TURN OF AN ASK SESSION. THE TRANSCRIPT — NOT THE CONTEXT.
 *
 * ⚠️ **THE DISTINCTION THIS TYPE EXISTS TO HOLD.** Every agent framework replays the
 * transcript as context by default, and that default is the failure mode. Two
 * different things wear the same shape:
 *
 *   THE TRANSCRIPT  what a human reads later, attaches to a finding, and audits.
 *                   Persists in full. This type.
 *   THE CONTEXT     what re-enters the model's prompt on the next question.
 *                   Bounded by `CONTEXT_WINDOW_TURNS`, and NOT this type.
 *
 * A reader who takes `AskSession.turns` and hands it to a model has replayed every
 * untrusted string the session ever saw. That is not a hypothetical mistake — it is
 * the path of least resistance in every SDK.
 */
export interface AskTurn {
  id: AskTurnId
  /**
   * The operator's own words.
   *
   * ⚠️ **NOT TRUSTED, AND THIS IS THE ONE MOST PEOPLE GET WRONG.** The pattern
   * removes the USER prompt after translating it to actions, precisely because a
   * human is a courier: someone pastes an email, a remittance note or an ERP
   * long-text field into the box, and indirect injection arrives with a legitimate
   * principal attached to it.
   */
  question: string
  /**
   * What the agent answered. Our words — but DERIVED from untrusted content, so one
   * model-hop of laundering away from an attacker rather than trusted text.
   */
  answer: string
  /** Readings taken to ground this turn. Referenced, never inlined. */
  readingIds: EndpointReadingId[]
  /**
   * Anything proposed from this turn. `OperatorProposal` carries no `exceptionId`
   * by G44, so the session is the only thing tying a proposal to the question that
   * produced it.
   */
  proposalIds: OperatorProposalId[]
  askedAt: Timestamp
}

/**
 * THE SESSION. `Mockups/rec/Ask.dc.html` commits to it being durable: *"The session
 * is a document: the working sits inline where it was produced, so it can be
 * attached to a finding and read by someone who was not there."*
 */
export interface AskSession extends TenantScoped {
  id: AskSessionId
  askedByUserId: UserId
  startedAt: Timestamp
  turns: AskTurn[]
  /**
   * Set when the session is attached to a finding. The screen states the rule:
   * *"Sessions are deleted after 90 days unless attached to a finding."* Attaching
   * converts a scratch conversation into evidence, so the retention flips.
   */
  attachedToExceptionId: ExceptionId | null
  /**
   * Null once attached — the row is then evidence and follows the exception's
   * retention rather than its own. Non-null otherwise.
   */
  purgeAfter: Timestamp | null
}

/* ------------------------------------------------------------------ *
 * What actually re-enters the prompt — Context-Minimization, R6
 * ------------------------------------------------------------------ */

/**
 * ONE PRIOR TURN, AS THE MODEL SEES IT ON A LATER QUESTION.
 *
 * This is the Context-Minimization pattern (Beurer-Kellner et al.,
 * arXiv:2506.08837, pattern 6): untrusted content is removed from context ONCE IT
 * HAS BEEN TRANSLATED INTO ACTIONS. What survives the translation is the actions.
 *
 * ⚠️ **THERE IS NO `string` FIELD HERE AND THERE MUST NEVER BE ONE.** That absence
 * is the whole control, and it is the same mechanism `CrossBoundaryScalar`
 * (`model/learning.ts`) uses for the tenant boundary: a field typed to a closed set
 * cannot hold a sentence, so adding `question: string` is a compile error rather
 * than a code-review conversation. `_CarriedTurnHoldsNoText` in `model/identity.ts`
 * asserts it, and it was red before this type existed.
 *
 * WHAT IS DELIBERATELY ABSENT, AND WHY EACH ONE IS TEMPTING:
 *
 *   the question   `AskTurn.question` is the operator's words and is NOT TRUSTED —
 *                  a human is a courier for anything pasted into the box. The
 *                  pattern removes the user prompt specifically, and this is the
 *                  half most implementations skip because the user seems safe.
 *   the answer     ours, but DERIVED from untrusted content. One model-hop of
 *                  laundering from an attacker is not the same as trusted.
 *   reading text   `EndpointReading.label` and `.value` are what a foreign system
 *                  returned. They reach the HUMAN on the card, and never the model
 *                  on a later turn.
 *
 * REFINES G46 RATHER THAN REVERSING IT. `CONTEXT_WINDOW_TURNS` still bounds how
 * many of these carry; this bounds what each one may contain. A window without this
 * is truncation — three attempts at an injection instead of one. This without a
 * window would still accumulate typed rows unboundedly. Both.
 */
export interface CarriedTurn {
  turnId: AskTurnId
  /** The actions the question became. This IS the translation the pattern names. */
  proposalIds: OperatorProposalId[]
  /** Readings by reference and scalar. The label and the value string do not cross. */
  readings: CarriedReading[]
  /**
   * ⚠️ NO `askedAt`, AND THE REASON IS A FINDING RATHER THAN A PREFERENCE.
   *
   * It was written, and `_CarriedTurnHoldsNoText` rejected it — because
   * `Timestamp = string` in `model/kernel.ts` is a NAKED ALIAS, the same defect
   * class slice 4 fixed for `RoleId`, `PolicyId`, `ScorerId` and
   * `AutonomyProposalId`. It cannot be excepted by type: `Timestamp` IS `string`,
   * so the compiler cannot tell a machine-generated instant from a pasted
   * paragraph, and neither can this assertion.
   *
   * Dropping the field is the honest resolution and costs nothing — turn order is
   * positional in `CarriedTurn[]`, and anything needing the instant resolves
   * `turnId` against the transcript. Branding `Timestamp` is a separate sweep with
   * its own call-site audit; until it lands, no assertion of this shape can admit
   * a timestamp without also admitting prose.
   */
}

/**
 * A prior reading, as the model sees it later.
 *
 * The id lets the agent say *"grounded in the reading from 09:31"* and lets the UI
 * resolve the full text for the human. `numericValue` is present because the ERP
 * answers that matter are quantities, and a number carries no instruction.
 *
 * ⚠️ A reading whose value was not numeric carries `null` and nothing else. That is
 * the honest outcome, not a gap: if the agent needs the text of a free-form field on
 * a later turn, it RE-READS. The re-read is also fresher, which is the same argument
 * `EndpointReading` already makes about staleness against the write-back.
 */
export interface CarriedReading {
  readingId: EndpointReadingId
  numericValue: number | null
}
