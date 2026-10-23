/**
 * ReconcileAI — identity proofs.
 *
 * THE LEAF. This module imports everything and is imported by nothing. It holds
 * no types anyone uses; it holds ASSERTIONS that fail the build when the identity
 * discipline slips. `model/kernel.ts` is the opposite pole — it imports nothing.
 *
 * WHY THIS IS A MODULE AND NOT A TEST FILE
 *
 * There is no test framework in this repository and adding one would presuppose a
 * runtime that `docs/domain-model.md` records as undecided by design. It does not
 * matter: the identity sweep (G21) is entirely type-level, so `tsc` is a complete
 * test runner for it. `type _X = Assert<…>` either compiles or it does not, and
 * `tsc -p model/tsconfig.json` is already the only automated verification here.
 *
 * The idiom is not new. `model/learning.ts:1312` does the same thing with
 * `AssertContentless`, for the same reason: to make a rule mechanical rather than
 * cultural.
 *
 * EVERY ASSERTION BELOW IS A TEST THAT WAS RED BEFORE THE CHANGE IT GUARDS.
 * If you add one, write it red first and watch it fail. An assertion that has
 * never failed is a comment with extra steps — which is `docs/HANDOFF.md` §5.6,
 * a control that passes while asserting nothing.
 */

import type {
  DefinitionId,
  EndpointReadingId,
  ExceptionId,
  InstalledPack,
  OperatorProposalDecisionId,
  OperatorProposalId,
  ProposalId,
  RuleId,
  RunId,
  TenantId,
} from './domain'
import type { AssertNoTextDeep } from './reconciliation'
/* SLICE 9 — the session line. #222 [A-2] and #223 [A-5], 22 Aug 2026. */
import type { Invitation, InvitationRedemption, Session, SignInAttempt } from './domain'
import type { SessionHandleDigest } from './domain'
import type { InvitationId, SessionId, SignInAttemptId } from './kernel'
import type { FieldPathRefusal, FieldPathResolutionRefusal } from './field-path'
import type { RoleId } from './access'
import type { ScorerId } from './evaluation'
import type { AutonomyProposalId, PolicyId } from './policy'
import type { Id, InstalledPackId } from './kernel'

/**
 * SLICE 3 imports the SAME name down TWO paths — from `./kernel`, where the
 * declaration now lives, and from the module that used to declare it and now
 * re-exports it. Aliased on the kernel side only; the domain-side names above
 * are reused, so one import serves both proofs.
 */
import type {
  HarnessDocumentId as HarnessDocumentIdViaKernel,
  ModelCatalogEntryId as ModelCatalogEntryIdViaKernel,
  TenantId as TenantIdViaKernel,
  ExceptionId as ExceptionIdViaKernel,
  TenantScoped as TenantScopedViaKernel,
  Timestamp as TimestampViaKernel,
} from './kernel'
import type {
  TenantScoped as TenantScopedViaDomain,
  Timestamp as TimestampViaDomain,
} from './domain'
import type { HarnessDocumentId as HarnessDocumentIdViaAgents } from './agents'
import type { ModelCatalogEntryId as ModelCatalogEntryIdViaCatalog } from './catalog'

/**
 * SLICE 5 — the fourteen entities that G35 classified and that carried branded
 * references without an identity of their own. `docs/identity-classification.md`
 * is the adjudicated list; `InstalledPack` was slice 1, so fourteen remain.
 *
 * This is also the first slice in which this module lives up to its own header.
 * "Imports everything" was aspirational: `billing`, `deployment`, `governance`,
 * `learning` and `observability` were not reached from here at all until now.
 */
import type { ApprovalDecision, Membership } from './domain'
import type { CarriedReading, CarriedTurn } from './domain'
import type { CommissionAttestation, UsageAttestation } from './billing'
import type { DataPlaneHealth, DataPlaneHeartbeat } from './deployment'
import type { GateResult, PackQualityReport } from './evaluation'
import type { ChainAnchor, ErasurePlan } from './governance'
import type { LearningRetraction, NominationReview } from './learning'
import type { PartnerTelemetryAccess, TraceRef } from './observability'
import type {
  ApprovalDecisionId,
  ChainAnchorId,
  CommissionAttestationId,
  DataPlaneHealthId,
  DataPlaneHeartbeatId,
  ErasurePlanId,
  GateResultId,
  LearningRetractionId,
  MembershipId,
  NominationReviewId,
  PackQualityReportId,
  PartnerTelemetryAccessId,
  TraceRefId,
  UsageAttestationId,
} from './kernel'

/**
 * SLICE 6 — the eighteen targets whose OWN `id` was branded in the same edit as
 * the reference that names them. A brand pointing at a bare-string target checks
 * nothing: `Solution.endpointIds: EndpointId[]` is only a constraint because
 * `Endpoint.id` is `EndpointId` too.
 */
import type {
  BillingPeriodId,
  BudgetId,
  DataSubjectRequestId,
  EndpointId,
  EvaluationGateId,
  IdentityConnectionId,
  InjectionProbeId,
  LegalHoldId,
  ModelFallbackChainId,
  PartnerAccessGrantId,
  PlanId,
  ProcedureStepExecutionId,
  RateCardId,
  ReconciliationPeriodId,
  RoleAssignmentId,
  ScoreResultId,
  SolutionPackId,
  TenantAccessGrantId,
} from './kernel'

/* ------------------------------------------------------------------ *
 * The assertion primitives
 * ------------------------------------------------------------------ */

/**
 * Fails unless `T` has an `id` field of exactly type `TId`.
 *
 * ⚠️ THE CONSTRAINT IS THE ASSERTION. An earlier draft of this was written as a
 * conditional returning `never` on mismatch — and `type _X = never` COMPILES.
 * It caught a missing `id` (the interface failed `{ id: unknown }`) and silently
 * passed a WRONG BRAND, which is the case it mattered most for. It went red in
 * testing only because an import went unused, which is luck, not a control.
 *
 * That is `docs/HANDOFF.md` §5.6 — a control that passes while asserting nothing —
 * caught by the discipline of checking that a new proof actually fails when the
 * thing it guards is broken. Write every assertion here red first, then break it
 * deliberately in both directions before trusting it.
 *
 * The shape below is `AssertContentless`'s (`model/learning.ts:1312`): the
 * constraint does the work, so a mismatch is a constraint violation rather than a
 * value nobody reads.
 */
export type AssertIdentity<T extends { id: TId }, TId> = T

/* ------------------------------------------------------------------ *
 * SLICE 1 — the minting record has an identity
 * ------------------------------------------------------------------ */

/**
 * RED BEFORE THIS SLICE. `InstalledPack` carried no `id` field at all, so this
 * line failed on the constraint — the interface did not satisfy `{ id: unknown }`.
 *
 * That absence is the defect the product owner found by asking why the entity
 * diagram showed no thread between `Solution` and `SolutionPack`. The chain is
 * `SolutionPack` (catalogue) → `InstalledPack` (minting record) → `Solution`
 * (what runs). It was typed in one direction only: `InstalledPack.mintedSolutionId`
 * is a proper `SolutionId`, while `Solution.installedPackId` was `string | null`
 * and referred to nothing addressable, because the record it named had no address.
 *
 * G29 then made `Solution` point at an install TWICE — origin and current — so the
 * target needing an identity stopped being arguable.
 */
export type _InstalledPackHasIdentity = AssertIdentity<InstalledPack, InstalledPackId>

/* ------------------------------------------------------------------ *
 * SLICE 2 — a brand argument names its own entity
 * ------------------------------------------------------------------ */

/**
 * For a map keyed by entity name, the id at each key must be branded with THAT
 * KEY. `{ ReconciliationDefinition: Id<'Definition'> }` fails; only
 * `Id<'ReconciliationDefinition'>` satisfies it.
 */
type BrandedByKey<M> = { [K in keyof M & string]: Id<K> }

/**
 * THE CONSTRAINT IS THE ASSERTION, again — `M extends BrandedByKey<M>`, the
 * self-referential shape `AssertContentless` uses. A conditional returning `never`
 * would compile and prove nothing.
 */
export type AssertBrandsMatchNames<M extends BrandedByKey<M>> = M

/**
 * RED BEFORE THIS SLICE, on four entries.
 *
 * `tsc` never resolves a brand — it is a phantom type — so four ids named a string
 * that matches no exported interface and the build stayed green for months:
 *
 *     DefinitionId = Id<'Definition'>   the interface is ReconciliationDefinition
 *     RunId        = Id<'Run'>          the interface is ReconciliationRun
 *     RuleId       = Id<'Rule'>         the interface is MatchRule
 *     ProposalId   = Id<'Proposal'>     the interface is ResolutionProposal
 *
 * Harmless to the compiler and fatal to anything that walks `Id<'X'>` back to a
 * type: a schema generator, an ORM mapping, an entity diagram. Between them they
 * broke **18 of 172 typed edges**, which is how they were found — an extraction
 * that resolved brands to interfaces could not place them.
 *
 * The three keys below that were already correct are controls, not decoration. A
 * proof with no passing case does not distinguish "the rule holds" from "the rule
 * is unsatisfiable".
 *
 * ⚠️ SLICE 5 ADDED FOURTEEN ENTRIES TO THIS MAP RATHER THAN OPENING A SECOND ONE.
 * Two maps over one rule is the two-vocabularies shape again at the smallest
 * possible scale: the moment there are two, an id gets added to neither. The
 * fourteen were red here as TS2305 — the aliases did not exist — before they were
 * red anywhere else.
 */
export type _BrandArgumentsNameTheirEntities = AssertBrandsMatchNames<{
  ReconciliationDefinition: DefinitionId
  ReconciliationRun: RunId
  MatchRule: RuleId
  ResolutionProposal: ProposalId
  Tenant: TenantId
  Exception: ExceptionId
  InstalledPack: InstalledPackId

  /* --- 7 Aug 2026: the operator-initiated path (G42/G43/G44) ---
   *
   * ⚠️ `OperatorProposal` IS HERE FOR A REASON THE OTHER ENTRIES ARE NOT.
   * Everywhere else this map catches a brand that names no interface. Here it
   * also pins the SEPARATION: `ProposalId = Id<'ResolutionProposal'>` and
   * `OperatorProposalId = Id<'OperatorProposal'>` are the enforcement of G44 at
   * the id level, and re-pointing either brand at the other's interface — the
   * exact edit somebody makes while "unifying the proposal types" — is red
   * HERE and in `_EntitiesCarryTheirOwnIdentity`, before it is red anywhere a
   * reviewer would think to look. */
  OperatorProposal: OperatorProposalId
  OperatorProposalDecision: OperatorProposalDecisionId
  EndpointReading: EndpointReadingId

  /* --- 24 Aug 2026: #235 [A-14], under G229. Registered on ARRIVAL, which is
   * what the `_EntitiesCarryTheirOwnIdentity` header calls "the whole lesson of
   * the fourteen below". The brand argument is load-bearing here beyond the
   * usual reason: the inviter's `AuthorizationGrant` names this row as its
   * `resource.resourceId`, so a brand pointing at some other interface would
   * make that binding address a different kind of thing while `tsc` stayed
   * green. */
  Invitation: InvitationId

  /* --- slice 5: the fourteen G35 entities --- */
  ApprovalDecision: ApprovalDecisionId
  ChainAnchor: ChainAnchorId
  CommissionAttestation: CommissionAttestationId
  DataPlaneHealth: DataPlaneHealthId
  DataPlaneHeartbeat: DataPlaneHeartbeatId
  ErasurePlan: ErasurePlanId
  GateResult: GateResultId
  LearningRetraction: LearningRetractionId
  Membership: MembershipId
  NominationReview: NominationReviewId
  PackQualityReport: PackQualityReportId
  PartnerTelemetryAccess: PartnerTelemetryAccessId
  TraceRef: TraceRefId
  UsageAttestation: UsageAttestationId

  /* --- slice 6: the eighteen targets of the reference sweep --- */
  BillingPeriod: BillingPeriodId
  Budget: BudgetId
  DataSubjectRequest: DataSubjectRequestId
  Endpoint: EndpointId
  EvaluationGate: EvaluationGateId
  IdentityConnection: IdentityConnectionId
  InjectionProbe: InjectionProbeId
  LegalHold: LegalHoldId
  ModelFallbackChain: ModelFallbackChainId
  PartnerAccessGrant: PartnerAccessGrantId
  Plan: PlanId
  ProcedureStepExecution: ProcedureStepExecutionId
  RateCard: RateCardId
  ReconciliationPeriod: ReconciliationPeriodId
  RoleAssignment: RoleAssignmentId
  ScoreResult: ScoreResultId
  SolutionPack: SolutionPackId
  TenantAccessGrant: TenantAccessGrantId
}>

/* ------------------------------------------------------------------ *
 * SLICE 4 — an id alias is never a naked string
 * ------------------------------------------------------------------ */

/**
 * `string extends T` is true only when `T` IS `string`. A brand narrows it, so
 * `string extends Id<'Role'>` is false and the entry passes.
 *
 * ⚠️ THE CONDITIONAL MUST SIT INSIDE A MAPPED TYPE, not directly in the constraint.
 * `AssertBranded<T extends NotBareString<T>>` is TS2313, a circular constraint —
 * which is why `AssertContentless` (`model/learning.ts:1312`) is shaped over
 * `keyof T` rather than over `T`. Same reason, same shape.
 */
type AllBranded<M> = { [K in keyof M]: string extends M[K] ? never : M[K] }

/** Constraint-shaped, for the reason recorded on `AssertIdentity`. */
export type AssertBranded<M extends AllBranded<M>> = M

export type _NoNakedStringAliases = AssertBranded<{
  RoleId: RoleId
  PolicyId: PolicyId
  ScorerId: ScorerId
  AutonomyProposalId: AutonomyProposalId
  /** A control: already branded, and must keep passing. */
  InstalledPackId: InstalledPackId
}>

/* ------------------------------------------------------------------ *
 * SLICE 3 — one home for every brand
 * ------------------------------------------------------------------ */

/**
 * ⚠️ THE PRIMARY PROPERTY OF THIS SLICE IS NOT TYPE-LEVEL, AND PRETENDING
 * OTHERWISE WOULD BE THE EXACT DEFECT THIS FILE EXISTS TO PREVENT.
 *
 * `model/kernel.ts` has ZERO import statements, and that is what makes the
 * module graph acyclic by inspection. It is a grep, not a type:
 *
 *     grep -c '^import' model/kernel.ts        # must print 0
 *
 * No assertion below proves it. TypeScript has no predicate over a module's
 * import list, and a conditional type that appeared to check one would be a
 * control that passes while asserting nothing — `docs/HANDOFF.md` §5.6. So it is
 * recorded here as a documented obligation and verified by that grep, and the
 * property it buys — one brand family, one home — is what the assertion below
 * actually tests.
 *
 * The reason kernel can hold `TenantScoped` and still import nothing is that
 * `TenantScoped` needs only `TenantId`, which is now also in kernel.
 */

/**
 * Both sides must be MUTUALLY assignable, not merely one-way. A single
 * `extends` would pass a widening — `Timestamp` (string) accepts a brand in one
 * direction — and pass exactly the case this slice risks.
 *
 * ⚠️ THE CONDITIONAL SITS INSIDE A MAPPED TYPE. Written directly in the
 * constraint it is TS2313, a circular constraint; see `AssertBranded` above and
 * `AssertContentless` (`model/learning.ts:1312`). Same reason, same shape:
 * the constraint is the assertion, and a mismatch is a constraint violation
 * rather than a `never` nobody reads.
 */
type MutuallyAssignable<M> = {
  [K in keyof M]: M[K] extends { viaKernel: infer A; viaOwner: infer B }
    ? [A] extends [B]
      ? [B] extends [A]
        ? M[K]
        : never
      : never
    : never
}

/** Constraint-shaped, for the reason recorded on `AssertIdentity`. */
export type AssertSameType<M extends MutuallyAssignable<M>> = M

/**
 * RED BEFORE THIS SLICE, on all six entries — every one failed with TS2305,
 * `Module './kernel' has no exported member`, because the declarations were
 * still spread across three modules.
 *
 * Twenty-one branded aliases lived in `domain.ts`, one in `agents.ts` and one in
 * `catalog.ts`, so brands had three homes. That is the two-vocabularies shape
 * this codebase records as its most repeated defect, and the specific hazard is
 * named on `AgentDefinitionId` in `domain.ts`: two declarations of one brand is
 * a rename in one file silently not reaching the other.
 *
 * After the move each source module imports from `./kernel` and RE-EXPORTS the
 * same name, so the thirteen modules that import from `./domain` are untouched.
 * That re-export is load-bearing and invisible — deleting one is a one-line
 * change that looks like tidying. THE FAILURE MODES THIS CATCHES:
 *
 *   a dropped re-export      → TS2724 at the import, before the assertion runs
 *   a re-declaration instead → the local brand and kernel's are different types
 *                              and the mutual-extends pair goes red
 *   a SECOND brand symbol    → `Id<'Tenant'>` from two modules is mutually
 *                              unassignable while printing identically, which is
 *                              the bewildering error `kernel.ts` warns about.
 *                              Caught here as a plain constraint violation.
 *
 * BOTH GUARDS WERE RUN, and the observed errors are recorded because an assertion
 * nobody has watched fail is a comment with extra steps:
 *
 *   1. `TenantId` deleted from the re-export block in `domain.ts` → TS2724 in
 *      NINE modules, `'"./domain"' has no exported member named 'TenantId'.
 *      Did you mean 'Tenant'?` — including this file, line 33.
 *   2. `domain.ts` made to RE-DECLARE `export type TenantId = Id<'User'>` rather
 *      than re-export → TS2344 here, `Type '{ viaKernel: TenantId; viaOwner:
 *      TenantId; }' is not assignable to type 'never'`. Note that BOTH SIDES
 *      PRINT AS `TenantId`. That is the whole reason this assertion exists in
 *      this shape: the report is unreadable at the point of failure, so it has to
 *      fail HERE, next to the explanation, rather than at some call site 1,500
 *      lines into `access.ts` — where it also fired, as TS2367 *"this comparison
 *      appears to be unintentional… have no overlap"*, which names neither cause
 *      nor cure.
 *
 * ⚠️ Guard 1 is the weaker of the two and only looks decisive. It reddens because
 * the name VANISHES, which a compiler catches anywhere. Guard 2 is the one that
 * matters: every name still resolves, every import succeeds, and the model is
 * wrong. Only a mutual-assignability check sees it.
 *
 * Six entries, covering all three source modules and both kinds of moved
 * declaration — branded ids, the bare primitive `Timestamp`, and the
 * `TenantScoped` interface.
 */
export type _BrandsReachableFromBothPaths = AssertSameType<{
  TenantId: { viaKernel: TenantIdViaKernel; viaOwner: TenantId }
  ExceptionId: { viaKernel: ExceptionIdViaKernel; viaOwner: ExceptionId }
  Timestamp: { viaKernel: TimestampViaKernel; viaOwner: TimestampViaDomain }
  TenantScoped: { viaKernel: TenantScopedViaKernel; viaOwner: TenantScopedViaDomain }
  HarnessDocumentId: {
    viaKernel: HarnessDocumentIdViaKernel
    viaOwner: HarnessDocumentIdViaAgents
  }
  ModelCatalogEntryId: {
    viaKernel: ModelCatalogEntryIdViaKernel
    viaOwner: ModelCatalogEntryIdViaCatalog
  }
}>

/* ------------------------------------------------------------------ *
 * SLICE 5 — the remaining entities get identities
 * ------------------------------------------------------------------ */

/**
 * For a map keyed by entity name, the value at each key must be an interface
 * carrying `id: Id<K>` — the key's own brand.
 *
 * This is `AssertIdentity` and `AssertBrandsMatchNames` fused into one check, and
 * fusing them is the point: `AssertIdentity<TraceRef, TraceRefId>` proves the
 * field exists and matches an alias, and proves NOTHING about whether that alias
 * names the right interface. `Id<K>` here is minted from the key, so a `TraceRef`
 * whose id is `Id<'Trace'>` fails at the same line that a `TraceRef` with no id
 * at all fails.
 *
 * WHY ONE TOTAL MAP AND NOT FOURTEEN ASSERTIONS. A per-entity assertion proves
 * only what someone remembered to write. Adding a fifteenth entity to the model
 * with no `id` is then SILENTLY ABSENT from the proof — the build stays green
 * because nothing was asserted about it. Written as a map, the omission is at
 * least visible in one place a reviewer reads, next to the rule.
 *
 * ⚠️ IT IS STILL NOT TOTAL OVER THE MODEL, and saying so is the honest version.
 * TypeScript has no predicate over "every exported interface in these sixteen
 * modules", so nothing forces a new entity INTO this map. Pretending otherwise
 * would be `docs/HANDOFF.md` §5.6 — a control that passes while asserting
 * nothing. What is total over the model is the extractor:
 * `node tools/planner/extract.mjs` reports `entity_without_identity`, which fell
 * from 54 to 40 on this slice, and that count is the real completeness check.
 *
 * ⚠️ THE CONDITIONAL-FREE SHAPE IS DELIBERATE. `BrandedByKey` above is the same
 * mapped-type-over-`keyof M` idiom for the same reason: written directly in the
 * constraint it is TS2313, a circular constraint. See `AssertBranded`.
 */
type IdentifiedByOwnName<M> = { [K in keyof M & string]: { id: Id<K> } }

/** Constraint-shaped, for the reason recorded on `AssertIdentity`. */
export type AssertEntityIdentities<M extends IdentifiedByOwnName<M>> = M

/**
 * RED BEFORE THIS SLICE, ON ALL FOURTEEN. Every entry failed the constraint
 * because the interface had no `id` field of any kind:
 *
 *     Type '{ ApprovalDecision: ApprovalDecision; ChainAnchor: ChainAnchor; … }'
 *     does not satisfy the constraint 'IdentifiedByOwnName<…>'.
 *       Types of property 'ApprovalDecision' are incompatible.
 *         Property 'id' is missing in type 'ApprovalDecision' but required in
 *         type '{ id: Id<"ApprovalDecision">; }'.
 *
 * ⚠️ THIS ASSERTION IS THE ONLY THING IN THE REPOSITORY THAT COULD HAVE GONE RED.
 * All fourteen interfaces are ORPHANS — `grep -n '\bTraceRef\b' model/*.ts` finds
 * exactly its own declaration, and the same holds for the other thirteen. Nothing
 * holds one as a field, nothing takes one as a parameter, nothing returns one. So
 * adding a required field to any of them breaks no call site, because there are no
 * call sites, and `tsc` would have stayed green through the entire slice. That is
 * the brief's warning about weak evidence in its sharpest form: here a green build
 * is not weak evidence, it is NO evidence, and the two checks that carry this
 * slice are this constraint and the extractor's `entity_without_identity` count.
 *
 * THREE GUARDS WERE RUN — the errors are quoted in the commit message:
 *
 *   1. `id` deleted from `ChainAnchor` → TS2344 here, `Property 'id' is missing
 *      in type 'ChainAnchor'`. The missing-field case, which is what all fourteen
 *      were before this change.
 *   2. `ChainAnchorId` re-declared as `Id<'RecordChain'>` in `kernel.ts` → TWO
 *      failures, and this is the one that matters. The brands map above goes red
 *      AND this map goes red, `Type '"RecordChain"' is not assignable to type
 *      '"ChainAnchor"'`, because the FIELD is now branded for a different
 *      interface. Guard 2 is the case the first draft of `AssertIdentity` passed
 *      silently. It is also the case that breaks a schema generator or an entity
 *      diagram while `tsc` reports nothing — which is how slice 2's eighteen
 *      broken edges survived for months.
 *   3. The registry KEY changed to `TraceReference` → red, `Type '"TraceRef"' is
 *      not assignable to type '"TraceReference"'`. The key is load-bearing: it
 *      is where `Id<K>` comes from, so a registry entry cannot be filed under a
 *      name the interface does not have.
 *
 * ⚠️ GUARD 1 WAS CONTAMINATED ON ITS FIRST RUN AND HAD TO BE RE-RUN. Deleting the
 * `id` field left `ChainAnchorId` imported and unused in `governance.ts`, so tsc
 * reported TS6196 *as well as* the assertion failure — and `noUnusedLocals` would
 * have produced that error whether or not this assertion existed. That is exactly
 * how the first draft of `AssertIdentity` appeared to work: it "went red in
 * testing only because an import went unused". The guard was re-run with the
 * import removed too, leaving the constraint violation as the ONLY error, which
 * is the form that proves anything. Break a control the lazy way and it will tell
 * you what you hoped to hear.
 *
 * `InstalledPack` is a passing control, carried over from slice 1: a proof with no
 * passing case does not distinguish "the rule holds" from "the rule is
 * unsatisfiable".
 */
export type _EntitiesCarryTheirOwnIdentity = AssertEntityIdentities<{
  /* --- 7 Aug 2026: the operator-initiated path (G42/G43/G44). Registered on
   * arrival rather than in a later sweep, which is the whole lesson of the
   * fourteen below: every one of them existed for days as an interface holding
   * branded references with no identity of its own, and `tsc` was green
   * throughout because nothing held one. `EndpointReading` is the same shape —
   * G35 says a machine-produced timed record gets an id by default — and it is
   * asserted the day it lands instead of being found by a classification pass
   * a month later. */
  EndpointReading: EndpointReading
  OperatorProposal: OperatorProposal
  OperatorProposalDecision: OperatorProposalDecision

  ApprovalDecision: ApprovalDecision
  ChainAnchor: ChainAnchor
  CommissionAttestation: CommissionAttestation
  DataPlaneHealth: DataPlaneHealth
  DataPlaneHeartbeat: DataPlaneHeartbeat
  ErasurePlan: ErasurePlan
  GateResult: GateResult
  Invitation: Invitation
  LearningRetraction: LearningRetraction
  Membership: Membership
  NominationReview: NominationReview
  PackQualityReport: PackQualityReport
  PartnerTelemetryAccess: PartnerTelemetryAccess
  TraceRef: TraceRef
  UsageAttestation: UsageAttestation

  /**
   * --- slice 6: the eighteen targets of the reference sweep ---
   *
   * These were not missing an `id`, which is what the fourteen above were
   * missing. They had `id: string` — WORSE, for the reason `kernel.ts` records
   * about naked aliases: a field that reads as an identity in an access review
   * and accepts every string in the program. The extractor cannot see it either:
   * `entity_without_identity` fires on the ABSENCE of an id, so `id: string`
   * reads to it as satisfied, and all eighteen have been counted as identified
   * since the first graph was generated.
   *
   * They are here rather than in a second map for the reason slice 5 gave: two
   * maps over one rule is the two-vocabularies shape at the smallest possible
   * scale, and the moment there are two, an id gets added to neither.
   *
   * ⚠️ TWENTY-FOUR MORE INTERFACES STILL DECLARE `id: string` AND ARE NOT HERE.
   * `UsageRecord`, `EntitlementLease`, `AgentToolBinding`, `SubjectIndexEntry`,
   * `TelemetryExport`, `PolicyTemplate`, `TenantContact`, `SubProcessor`,
   * `BreachRecord` and the rest. They are absent because nothing references
   * them, so branding buys a name and no check — not because they were judged
   * correct. `grep -n '^  id: string$' model/*.ts` is the whole of the
   * detection available for them today, and it is the largest single piece of
   * identity debt left in the model.
   */
  BillingPeriod: BillingPeriod
  Budget: Budget
  DataSubjectRequest: DataSubjectRequest
  Endpoint: Endpoint
  EvaluationGate: EvaluationGate
  IdentityConnection: IdentityConnection
  InjectionProbe: InjectionProbe
  LegalHold: LegalHold
  ModelFallbackChain: ModelFallbackChain
  PartnerAccessGrant: PartnerAccessGrant
  Plan: Plan
  ProcedureStepExecution: ProcedureStepExecution
  RateCard: RateCard
  ReconciliationPeriod: ReconciliationPeriod
  RoleAssignment: RoleAssignment
  ScoreResult: ScoreResult
  SolutionPack: SolutionPack
  TenantAccessGrant: TenantAccessGrant

  /** The control. Slice 1's entity, and it must keep passing. */
  InstalledPack: InstalledPack
}>


/* ------------------------------------------------------------------ *
 * SLICE 6 — the reference-field sweep
 * ------------------------------------------------------------------ *
 *
 * The volume slice. Fifty-five id-shaped REFERENCE fields were typed `string`,
 * `string[]` or `string | null`; forty-two are now branded and thirteen stay
 * bare under a stated rule. The thirteen are enumerated in `BareByRule` below,
 * one comment per entry, so a FOURTEENTH exception is a deliberate edit to a
 * list somebody reviews rather than a silent omission. That is the difference
 * between an exception and a hole.
 *
 * These imports bring in EVERY interface the extractor records as carrying an
 * id-shaped field — 114 of them, generated from `docs/model-graph.json` rather
 * than typed by hand, because a hand-typed list of 114 is a list with an
 * omission in it.
 */
import type {
  AssignmentScope,
  AuthorizationGrant,
  DecisionVia,
  PartnerAuthorizationGrant,
  PartnerGrantTerms,
  PlatformAuthorizationGrant,
  PrincipalContext,
  ResourceRef,
  Role,
  RoleAssignment,
} from './access'
import type {
  AgentDefinition,
  AgentEvalBinding,
  AgentModelBinding,
  AgentToolBinding,
  AgentViolation,
  DerivedAgentGrant,
  HarnessDocument,
  PlatformAgentEvalFloor,
} from './agents'
import type {
  BillingPeriod,
  Budget,
  BudgetAlert,
  CostAttribution,
  CostReconciliation,
  EntitlementLease,
  PartnerBillingSummary,
  PartnerTenantFacts,
  PartnerTenantLineBase,
  Plan,
  PlatformMarginLine,
  ProviderCostRecord,
  RateCard,
  RatedTotal,
  Subscription,
  UsageRecord,
} from './billing'
import type {
  ModelCatalogEntry,
  ModelFallbackChain,
} from './catalog'
import type {
  CorrespondenceMessage,
  CorrespondenceThread,
  DisclosureRecord,
} from './correspondence'
import type {
  DataPlane,
} from './deployment'
import type {
  Account,
  Endpoint,
  EndpointReading,
  OperatorProposal,
  OperatorProposalDecision,
  IdentityConnection,
  AuditEvent,
  BreachRecord,
  DataSubjectRequest,
  EvaluationTerms,
  Exception,
  ExceptionReversal,
  MatchGroup,
  ObservedValue,
  PartnerAccessGrant,
  PopulationSpec,
  Procedure,
  ProcedureStepExecution,
  ReconciliationDefinition,
  ReconciliationPeriod,
  ReconciliationRun,
  ResolutionProposal,
  Solution,
  SolutionPack,
  SourceDocument,
  SourceSlot,
  Tenant,
  User,
} from './domain'
import type {
  EvaluationGate,
  HumanFeedback,
  InjectionProbe,
  InjectionProbeResult,
  ObservedExample,
  QualityWindow,
  ScoreResult,
  Scorer,
  SeededExample,
} from './evaluation'
import type {
  AccessExtension,
  AccessResourceGrant,
  AccessSession,
  BreakGlassPreservation,
  DataAccessEvent,
  LegalHold,
  SupportAuthorisation,
  TenantAccessGrant,
} from './governance'
import type {
  Correction,
  KnowledgeEdge,
  LearningEntry,
  LearningNomination,
  LearningNominationOutcome,
  LearningScope,
  NominationEvidence,
} from './learning'
import type {
  PartnerHealthView,
  PlatformTenantInspection,
} from './observability'
import type {
  AutonomyDecision,
  AutonomyProposal,
  AutonomyProposalOutcome,
  AutonomyRecommendation,
  ContentGuardrailConfig,
  EffectivePolicySet,
  Policy,
  PolicyEvaluation,
  PolicyTemplate,
  SpendConfig,
} from './policy'
import type {
  CardFilter,
  Dashboard,
  ResolvedCard,
} from './presentation'

/**
 * SLICE 7's proof, and the ONLY import here that is a MECHANISM rather than a
 * subject. Everything else this leaf imports is a type it asserts ABOUT;
 * `AssertNoTextDeep` is the assertion itself, declared in
 * `model/reconciliation.ts` because that is where G146 inverted it and where its
 * fifteen other sites live.
 *
 * TYPE-ONLY, AND THAT IS THE CHOICE #240 ASKS TO BE STATED. A type-only import
 * is erased by `verbatimModuleSyntax` before the loader sees it, so this module
 * stays fully erasable and needs no `.ts` extension — the extension rule binds
 * VALUE imports, which are the ones Node's resolver has to answer. Lifting the
 * allow-list into `model/kernel.ts` so both modules could reach it was the
 * alternative and was not taken: it would move a declaration that fifteen live
 * sites cite, to buy an import this module does not pay for.
 */


/**
 * The scalar a field actually CARRIES, with `| null`, `| undefined` and
 * array-ness stripped. `EndpointId[]` carries `EndpointId`; `SolutionPackId |
 * null` carries `SolutionPackId`; `string[]` carries `string`.
 *
 * Without this the check is trivially satisfied by cardinality: `string extends
 * string[]` is false, so a bare `string[]` would pass a naive test while being
 * exactly the shape `InstalledPack.mintedRoleIds` was.
 *
 * ⚠️ THE `[…] extends [never]` GUARD IS NOT DEFENSIVE PADDING. IT IS A BUG FIX,
 * AND THE BUG WAS IN THE FIRST DRAFT OF THIS FILE'S OWN CONTROL.
 *
 * Written without it, `Carried<null>` resolves to **`unknown`**, not `never`:
 * `NonNullable<null>` is `never`, `never extends readonly (infer E)[]` is
 * vacuously TRUE, and `E` has no inference site so it falls back to `unknown`.
 * `string extends unknown` is then true, and `ObservedExample.packId: null` —
 * a field DELIBERATELY typed `null`, because "an observed label belongs to a
 * tenant, never to a pack" — was reported as an unbranded string.
 *
 * It failed in the safe direction (a false positive, caught because a correct
 * field went red) and it would have been invisible in the other. `unknown` in
 * the checked position of `string extends …` always reddens; had the polarity
 * been reversed it would have passed silently. This is `AssertIdentity`'s
 * lesson recurring one slice later: a type-level control has failure modes that
 * look like nothing, and the only way to find them is to watch it react to
 * cases you did not design it for. `_NullIsNotABareString` below is that case,
 * kept as a standing control.
 */
type Carried<V> = [NonNullable<V>] extends [never]
  ? never
  : NonNullable<V> extends readonly (infer E)[]
    ? E
    : NonNullable<V>

/**
 * An id-shaped field NAME, matching the extractor's convention (`ID_SHAPED` in
 * `tools/planner/extract.mjs`): `fooId`, `fooIds`.
 *
 * ⚠️ PLAIN `id` IS DELIBERATELY NOT IN THIS UNION, AND THE OMISSION IS THE
 * HONEST PART OF THIS CONTROL. An interface's OWN identity being `id: string`
 * is a different and larger defect: **forty-two exported interfaces** declare
 * one, including most of the authorisation spine, and the extractor cannot see
 * it either — `entity_without_identity` fires only when there is NO id, so
 * `id: string` reads as satisfied. Eighteen of the forty-two are branded in
 * this slice, but only because a reference now points at them and a brand
 * pointing at a bare-string target checks nothing. The other twenty-four are
 * untouched and unasserted.
 *
 * Naming this control "no id-shaped field is a bare string" while it silently
 * skipped `id` would be `docs/HANDOFF.md` §5.6 — a control that passes while
 * asserting less than its name. It covers REFERENCES. Own ids are guarded, for
 * the eighteen, by `_EntitiesCarryTheirOwnIdentity` below; for the other
 * twenty-four, by nothing. `grep -n '^  id: string$' model/*.ts` is the whole
 * of the detection available today.
 */
type IdShapedKey = `${string}Id` | `${string}Ids`

/**
 * `string extends Carried<T[K]>` is true only when the carried scalar IS
 * `string`. A brand narrows it, so `string extends EndpointId` is false.
 *
 * ⚠️ THE CONDITIONAL SITS INSIDE A MAPPED TYPE over `keyof T`, for the third
 * time in this file. Written directly in a constraint it is TS2313, a circular
 * constraint. See `AssertBranded` and `AssertContentless`
 * (`model/learning.ts:1312`).
 */
type NoBareIdReferences<T> = {
  [K in keyof T]: K extends IdShapedKey
    ? string extends Carried<T[K]>
      ? never
      : T[K]
    : T[K]
}

/**
 * THE THIRTEEN. Keyed by the exported interface, valued by the field names
 * permitted to stay `string`, with the rule that decided each one.
 *
 * This is an ALLOW-LIST, not a suppression: the key must name the interface and
 * the value must name the field exactly, or the exemption does not apply and the
 * field goes red. A typo grants nothing.
 *
 * The rules are `docs/identity-classification.md` and the G21 brief:
 *
 *   R1  WHO MINTS THE STRING? A namespace we do not own. Branding a foreign
 *       namespace claims an authority we do not have.
 *   R2  IS IT A POINTER OR A KEY? A key namespaces; a pointer dereferences.
 *   R3  DOES THE TARGET HAVE AN ADDRESSABLE IDENTITY?
 *   R4  IS THE HETEROGENEITY DELIBERATE?
 */
/*
 * ⚠️ A `type`, NOT AN `interface`, AND THE DIFFERENCE IS NOT STYLE. Declared as
 * an interface this table becomes an EXPORTED INTERFACE IN A MODULE NO CONTRACT
 * REACHES, which trips the extractor's `types_without_operations` heuristic and
 * manufactures a gap that nothing could ever close — the same false positive
 * `kernel.ts` picked up in slice 3 for `TenantScoped`. It is a type-level lookup
 * table, not a thing anyone stores, and declaring it as one says so.
 */
export type BareByRule = {
  /** R1 — AWS mints the model identifier. `ModelCatalogEntryId` is the catalogue ROW, which is ours; this is the model, which is not. One letter apart, opposite answers. */
  ModelCatalogEntry: 'modelId'
  /** R1 — the same AWS-minted strings, in order. */
  ModelFallbackChain: 'modelIds'
  /** R1 — an AWS account number and an AWS STS `ExternalId`. Both are minted in the customer's own AWS account under BYOA; neither is ours to brand. Note the extractor guesses `awsAccountId` points at our `Account` entity. It does not. */
  DataPlane: 'awsAccountId' | 'externalId'
  /** R1 — a Bedrock Guardrails identifier, minted provider-side. The config is deliberately provider-neutral; the identifier is not. */
  ContentGuardrailConfig: 'providerGuardrailId'
  /** R1 — OpenTelemetry mints both. `TraceRef.id` (added slice 5) is OUR address for the pointer row and IS branded; these two are the foreign correlation ids inside it. The row outlives the trace. */
  TraceRef: 'traceId' | 'rootSpanId'
  /** R1 — OTel again. Null where telemetry was too restricted to correlate. */
  InjectionProbeResult: 'traceId'
  /** R1 — OTel again. */
  PlatformTenantInspection: 'traceId'
  /** R4 — the deliberate heterogeneity named in the brief. `(resourceType, resourceId)` IS the identifier and `resourceClass` closes instead; the field is null wherever the act is not instance-bound, which is what makes `scope` load-bearing. */
  ResourceRef: 'resourceId'
  /** R4 — the same `(subjectType, subjectId)` shape, on the append-only write stream. An audit row names a row of ANY type; a brand would have to pick one. */
  AuditEvent: 'subjectId'
  /** R4 — the same pair on the read stream, and deliberately identical to `AuditEvent`'s: the two streams answer one question together and a divergence in this pair is what would break the join. */
  DataAccessEvent: 'subjectId'
  /** R4 — the field's own doc comment states the heterogeneity as the REASON for the widening: it "was `nominatedDocumentIds: SourceDocumentId[]`", narrowed to documents, and was widened to bare ids because "a delivery enumeration may legitimately name a document, an exception or a run". Re-branding it to any one type would reinstate the defect that widening fixed. */
  AccessResourceGrant: 'nominatedSubjectIds'
}

/** The fields exempt for interface `K`, or `never` where the interface has none. */
type ExemptOf<K> = K extends keyof BareByRule ? BareByRule[K] : never

/**
 * Every id-shaped reference on every listed interface, minus that interface's
 * exemptions. `Omit<T, never>` is `T`, so an interface absent from `BareByRule`
 * is checked whole.
 */
type EveryReferenceBranded<M> = {
  [K in keyof M]: NoBareIdReferences<Omit<M[K], ExemptOf<K>>>
}

/** Constraint-shaped, for the reason recorded on `AssertIdentity`. */
export type AssertNoBareIdReferences<M extends EveryReferenceBranded<M>> = M

/**
 * RED BEFORE THIS SLICE, ON FORTY-TWO FIELDS.
 *
 * ⚠️ A CONSTRAINT FAILURE NAMES ONLY THE FIRST BAD PROPERTY, so this map going
 * red proves ONE field was wrong and says nothing about the other forty-one.
 * Forty-two single-entry throwaway assertions were added beside it for one run
 * and deleted before anything changed, producing forty-two separate errors —
 * one per field. That run is the RED evidence in the commit message; this map
 * is what keeps them red forever.
 *
 * WHAT THIS DOES NOT PROVE, stated because a control that oversells itself is
 * worse than none:
 *
 *   NOT TOTAL OVER THE MODEL. TypeScript has no predicate over "every exported
 *   interface in these sixteen modules". These 114 were generated from the
 *   extractor's edge list; an interface added tomorrow is not in it and is
 *   silently unasserted. `node tools/planner/extract.mjs` and its
 *   `reference_without_type` count is the total check, and it is the number
 *   this slice is measured by.
 *
 *   NOT A TENANT CHECK. `EndpointId[]` stops an `ExceptionId` being written to
 *   `Solution.endpointIds`. It does NOT check the endpoints belong to the same
 *   tenant as the Solution — the tenant is a runtime value and TypeScript
 *   cannot express it. That is a SCHEMA OBLIGATION: a composite
 *   `(tenantId, id)` foreign key. Invariant 11 rests on that field, so the
 *   limit is written down rather than implied.
 *
 *   NOT A WRONG-BRAND CHECK, AND GUARD 2 BELOW PROVES IT RATHER THAN ASSERTING
 *   IT. A field branded for the WRONG interface is still branded, so this map
 *   stays green through it. That case is caught one layer up, by
 *   `_BrandArgumentsNameTheirEntities` and `_EntitiesCarryTheirOwnIdentity`.
 *   Three maps, three different failures; none of them subsumes another, and
 *   believing this one covered wrong brands would be the most expensive
 *   misreading available here — it is the exact failure that left 18 of 172
 *   edges pointing at nothing while `tsc` was green for months.
 *
 * FOUR GUARDS WERE RUN. Each was run in ISOLATION and the run was accepted only
 * when the ONLY error was the control's — a TS6133 or TS6196 alongside means
 * `noUnusedLocals` produced the red, not the assertion, and that is the trap
 * slice 5 fell into on its first attempt.
 *
 *   1. AN UNBRANDED FIELD. `InstalledPack.mintedRoleIds` reverted to `string[]`
 *      (and its now-orphan import removed, so the experiment stayed clean) →
 *      one error, `The types of 'InstalledPack.mintedRoleIds' are incompatible…
 *      Type 'string[]' is not assignable to type 'never'`. That is the field
 *      pass D moved from recorded to BLOCKING for §10.5.
 *   2. A WRONG BRAND. `EndpointId` re-declared as `Id<'Counterparty'>` — a real
 *      neighbouring interface, not a nonsense string → TWO errors, and NEITHER
 *      of them here: `Type '"Counterparty"' is not assignable to type
 *      '"Endpoint"'` at the brand map and again at the identity map. THIS MAP
 *      STAYED GREEN, which is the layering working as designed and the reason
 *      the note above is written down.
 *   3. A WRONG KEY. `BareByRule`'s `TraceRef` key renamed `TraceReference` → the
 *      exemption stopped applying and `TraceRef.traceId` went red. The key is
 *      load-bearing: an exemption cannot be filed under a name the interface
 *      does not have.
 *   4. A TYPO'D FIELD NAME. `ResourceRef: 'resourceId'` changed to `'resourceID'`
 *      → red on `ResourceRef.resourceId`. This is the one that makes the
 *      allow-list an allow-list rather than a comment: a typo grants nothing,
 *      and that claim is tested rather than asserted.
 */
/**
 * THE CONTROL FOR THE `Carried<null>` BUG DESCRIBED ABOVE, kept standing.
 *
 * `ObservedExample.packId` is declared `null` — not `string | null`, but the
 * literal type `null`, because "an observed label belongs to a tenant, never to
 * a pack". It is the one field in the model that exercises the `never` branch of
 * `Carried`, and the first draft of that helper reported it as an unbranded
 * string. It is asserted HERE, separately and by name, rather than left to be
 * covered incidentally by the big map: a case that once broke the control should
 * not be able to stop being tested by someone reordering a registry.
 *
 * A proof with no passing case cannot distinguish "the rule holds" from "the
 * rule is unsatisfiable" — and this one additionally distinguishes "the rule
 * holds" from "the helper returns `unknown` and reddens everything".
 */
export type _NullIsNotABareString = AssertNoBareIdReferences<{
  ObservedExample: ObservedExample
}>

export type _NoIdShapedReferenceIsABareString = AssertNoBareIdReferences<{
  /* access.ts */
  AssignmentScope: AssignmentScope
  AuthorizationGrant: AuthorizationGrant
  DecisionVia: DecisionVia
  PartnerGrantTerms: PartnerGrantTerms
  /* G730 — invariant 10's second home. Same fields, same brands, no tenant. */
  PlatformAuthorizationGrant: PlatformAuthorizationGrant
  /* G2621 — invariant 10's third home. Same fields, same brands, no tenant. */
  PartnerAuthorizationGrant: PartnerAuthorizationGrant
  PrincipalContext: PrincipalContext
  ResourceRef: ResourceRef
  Role: Role
  RoleAssignment: RoleAssignment
  /* agents.ts */
  AgentDefinition: AgentDefinition
  AgentEvalBinding: AgentEvalBinding
  AgentModelBinding: AgentModelBinding
  AgentToolBinding: AgentToolBinding
  AgentViolation: AgentViolation
  DerivedAgentGrant: DerivedAgentGrant
  HarnessDocument: HarnessDocument
  PlatformAgentEvalFloor: PlatformAgentEvalFloor
  /* billing.ts */
  BillingPeriod: BillingPeriod
  Budget: Budget
  BudgetAlert: BudgetAlert
  CommissionAttestation: CommissionAttestation
  CostAttribution: CostAttribution
  CostReconciliation: CostReconciliation
  EntitlementLease: EntitlementLease
  PartnerBillingSummary: PartnerBillingSummary
  PartnerTenantFacts: PartnerTenantFacts
  PartnerTenantLineBase: PartnerTenantLineBase
  Plan: Plan
  PlatformMarginLine: PlatformMarginLine
  ProviderCostRecord: ProviderCostRecord
  RateCard: RateCard
  RatedTotal: RatedTotal
  Subscription: Subscription
  UsageAttestation: UsageAttestation
  UsageRecord: UsageRecord
  /* catalog.ts */
  ModelCatalogEntry: ModelCatalogEntry
  ModelFallbackChain: ModelFallbackChain
  /* correspondence.ts */
  CorrespondenceMessage: CorrespondenceMessage
  CorrespondenceThread: CorrespondenceThread
  DisclosureRecord: DisclosureRecord
  /* deployment.ts */
  DataPlane: DataPlane
  DataPlaneHealth: DataPlaneHealth
  DataPlaneHeartbeat: DataPlaneHeartbeat
  /* domain.ts */
  Account: Account
  ApprovalDecision: ApprovalDecision
  AuditEvent: AuditEvent
  /* 7 Aug 2026 — the operator-initiated path. Three id-shaped fields on this
   * path carry an authorisation or a principal (`authorizationId` twice,
   * `askedByUserId`, `decidedByUserId`), and invariant 10 is only as good as
   * the reference: a bare-string `authorizationId` records that SOMETHING
   * authorised the ERP write without being joinable to the grant that did. */
  EndpointReading: EndpointReading
  OperatorProposal: OperatorProposal
  OperatorProposalDecision: OperatorProposalDecision
  BreachRecord: BreachRecord
  DataSubjectRequest: DataSubjectRequest
  EvaluationTerms: EvaluationTerms
  Exception: Exception
  ExceptionReversal: ExceptionReversal
  InstalledPack: InstalledPack
  Invitation: Invitation
  MatchGroup: MatchGroup
  Membership: Membership
  ObservedValue: ObservedValue
  PartnerAccessGrant: PartnerAccessGrant
  PopulationSpec: PopulationSpec
  Procedure: Procedure
  ProcedureStepExecution: ProcedureStepExecution
  ReconciliationDefinition: ReconciliationDefinition
  ReconciliationPeriod: ReconciliationPeriod
  ReconciliationRun: ReconciliationRun
  ResolutionProposal: ResolutionProposal
  Solution: Solution
  SolutionPack: SolutionPack
  SourceDocument: SourceDocument
  SourceSlot: SourceSlot
  Tenant: Tenant
  User: User
  /* evaluation.ts */
  EvaluationGate: EvaluationGate
  GateResult: GateResult
  HumanFeedback: HumanFeedback
  InjectionProbeResult: InjectionProbeResult
  ObservedExample: ObservedExample
  PackQualityReport: PackQualityReport
  QualityWindow: QualityWindow
  ScoreResult: ScoreResult
  Scorer: Scorer
  SeededExample: SeededExample
  /* governance.ts */
  AccessExtension: AccessExtension
  AccessResourceGrant: AccessResourceGrant
  AccessSession: AccessSession
  BreakGlassPreservation: BreakGlassPreservation
  ChainAnchor: ChainAnchor
  DataAccessEvent: DataAccessEvent
  ErasurePlan: ErasurePlan
  LegalHold: LegalHold
  SupportAuthorisation: SupportAuthorisation
  TenantAccessGrant: TenantAccessGrant
  /* learning.ts */
  Correction: Correction
  KnowledgeEdge: KnowledgeEdge
  LearningEntry: LearningEntry
  LearningNomination: LearningNomination
  LearningNominationOutcome: LearningNominationOutcome
  LearningRetraction: LearningRetraction
  LearningScope: LearningScope
  NominationEvidence: NominationEvidence
  NominationReview: NominationReview
  /* observability.ts */
  PartnerHealthView: PartnerHealthView
  PartnerTelemetryAccess: PartnerTelemetryAccess
  PlatformTenantInspection: PlatformTenantInspection
  TraceRef: TraceRef
  /* policy.ts */
  AutonomyDecision: AutonomyDecision
  AutonomyProposal: AutonomyProposal
  AutonomyProposalOutcome: AutonomyProposalOutcome
  AutonomyRecommendation: AutonomyRecommendation
  ContentGuardrailConfig: ContentGuardrailConfig
  EffectivePolicySet: EffectivePolicySet
  Policy: Policy
  PolicyEvaluation: PolicyEvaluation
  PolicyTemplate: PolicyTemplate
  SpendConfig: SpendConfig
  /* presentation.ts */
  CardFilter: CardFilter
  Dashboard: Dashboard
  ResolvedCard: ResolvedCard

}>


/* ------------------------------------------------------------------ *
 * SLICE 7 — nothing textual crosses a turn boundary (R6, G47)
 * ------------------------------------------------------------------ */

/**
 * Fails if any field of `T` is a plain `string`.
 *
 * `string extends T[K]` is true ONLY when the field is `string` itself. A branded
 * id narrows it — `string extends Id<'AskTurn'>` is false — so ids pass and prose
 * does not. That asymmetry is the whole point: the carried context is made of
 * references and numbers, and a reference is not a sentence.
 *
 * The conditional sits INSIDE a mapped type because a conditional directly in a
 * constraint is TS2313, a circular constraint. Same shape as `AssertContentless`
 * (`model/learning.ts`) and `AssertBranded` above, and for the same reason.
 *
 * 🛑 SUPERSEDED AS A CONTAINMENT PROOF, 22 Aug 2026, #240 — AND THE PARAGRAPH
 * ABOVE IS LEFT AS WRITTEN BECAUSE EVERY SENTENCE IN IT IS TRUE AND THE
 * CONCLUSION A READER DREW FROM IT WAS NOT. It bans the TYPE `string` at a
 * property position, ONE LEVEL DEEP. It does not ban a string-BEARING value, and
 * it admits by default everything nobody enumerated: `ReadonlySet<string>`,
 * `ReadonlyMap<number, string>`, `{ describe(): string }`, `() => string`,
 * `Uint8Array`, `ArrayBuffer`, `Date`, bare `object`, a constructor signature,
 * and a class whose only field is private. All ten were re-derived against this
 * tree and all ten compiled GREEN against this form. **A set of strings is
 * text.** The two proofs below now use `AssertNoTextDeep`, which refuses all
 * ten.
 *
 * ⚠️ THIS DECLARATION HAS NO CALL SITE IN `model/` AS OF THIS COMMIT, AND THAT
 * IS SAID PLAINLY RATHER THAN LEFT TO BE DISCOVERED. #240 rules it stays where
 * it is — removing it is a separate decision, and nothing else is asserted with
 * it. What keeps it from being `MAX_GRANT_HOURS`'s failure, a declaration
 * nothing exercises, is that it IS exercised: `tests/model/carried-turn-
 * containment.test.ts` §4 holds ten live uses of it, with no `@ts-expect-error`
 * on any of them, pinning exactly what it admits. It is under test as the form
 * NOT to reach for.
 */
type NoPlainText<T> = { [K in keyof T]: string extends T[K] ? never : T[K] }

/** Constraint-shaped, for the reason recorded on `AssertIdentity`. */
export type AssertNoPlainText<T extends NoPlainText<T>> = T

/**
 * THE CONTEXT-MINIMIZATION PROOF.
 *
 * `CarriedTurn` is what the model sees of a prior turn. If a text-bearing field ever
 * appears on it, untrusted content has a route back into the prompt and the pattern
 * is defeated — silently, because nothing else would fail.
 *
 * VERIFIED RED BEFORE IT WAS GREEN, in both directions: adding `question: string`
 * to `CarriedTurn` fails here, and so does adding `label: string` to
 * `CarriedReading`. The tempting edits are exactly those two — someone will want the
 * question back for a nicer follow-up, and the label back for a prettier citation —
 * which is why the assertion names them in its own comment rather than trusting a
 * reviewer to remember.
 *
 * `AskTurn` is deliberately NOT asserted. It is the TRANSCRIPT and it holds the
 * question and the answer in full, because a human reads it. Asserting it would be
 * asserting the wrong thing about the wrong type, and the distinction between those
 * two objects is the entire design.
 *
 * ⚠️ MIGRATED FROM `AssertNoPlainText` TO `AssertNoTextDeep`, 22 Aug 2026, #240 —
 * AND THE MIGRATION IS THE PROOF GETTING STRONGER, NOT THE TYPE CHANGING. Not one
 * field of `CarriedTurn` or `CarriedReading` moves in that commit. What changes is
 * what the guard REFUSES: `AssertNoPlainText` admitted ten shapes that carry text,
 * and `AssertNoTextDeep` — G146's inverted allow-list of value-free leaves —
 * refuses all ten. Both halves are in
 * `tests/model/carried-turn-containment.test.ts`: the ten refusals as
 * `@ts-expect-error` directives that must fire, and the same ten admitted by the
 * old form with no directive at all. The refusals were committed FIRST, alone,
 * because `Assert<never>` compiles and a vacuous proof reads exactly like a real
 * one.
 *
 * 🛑 WHETHER THIS AMENDS G47 IS THE OWNER'S CALL AND IS NOT ANSWERED HERE. G47 is
 * ✅ applied — *"Context-Minimization implemented — `CarriedTurn` holds no text"* —
 * and its ✅ rested on the weaker of the two forms. The argument for ORTHOGONAL is
 * that the type is unchanged, so what G47 asserted is still true and only the
 * evidence improved; the argument against is that this is precisely the separation
 * that let a weak proof read as a strong claim for as long as it did. No `G` row is
 * edited by this commit. See #240 §6.
 *
 * ⚠️ WHAT MAY NOW BE CLAIMED, AND IT IS STILL NOT UNLIMITED. These two types are
 * proven to hold no value-carrying leaf that TypeScript cannot see through — no
 * bare `string`, no container, no callable, no opaque object. That is the claim.
 * It is a claim about the TYPE and not about a runtime value: nothing here stops a
 * `JSON.parse` result being asserted into one of these shapes at a boundary.
 */
export type _CarriedTurnHoldsNoText = AssertNoTextDeep<CarriedTurn>
export type _CarriedReadingHoldsNoText = AssertNoTextDeep<CarriedReading>


/* ------------------------------------------------------------------ *
 * SLICE 8 — the field-path seam carries no counterparty key text
 * (invariant 6, G146's inverted allow-list, G214)
 * ------------------------------------------------------------------ */

/**
 * THE CONTAINMENT PROOF OVER `model/field-path.ts`.
 *
 * A payload KEY is counterparty-controlled text — invariant 6, ingested content
 * is data, never instruction. The seam's two refusal unions are the values most
 * likely to reach a log line or a span attribute, and neither may carry a key.
 * Every arm carries at most a segment ORDINAL, which is a number naming a
 * position in the OPERATOR's own declared path.
 *
 * ⚠️ IT IS ASSERTED WITH `AssertNoTextDeep` AND NOT WITH `AssertNoPlainText`
 * ABOVE, DELIBERATELY. `AssertNoPlainText` is shallow — it rejects a `string` at
 * a top-level property and walks into nothing, so a key nested one level inside
 * a refusal arm would pass it. #237 §7 requires the INVERTED allow-list form
 * G146 ruled, which is `NoTextField` and is what `AssertNoTextDeep` is built
 * from: a leaf is admissible only if it is PROVABLY value-free.
 *
 * 🛑 IT LIVES HERE AND NOT IN `model/field-path.ts` FOR A STRUCTURAL REASON.
 * `AssertNoTextDeep` is declared in `model/reconciliation.ts`, and the engine
 * imports the seam — so asserting it at the seam would close an import cycle
 * between the two. This module is the leaf: it imports everything and is
 * imported by nothing, which is exactly what it is for.
 *
 * VERIFIED RED BEFORE IT WAS GREEN: adding `readonly key: string` to
 * `key_absent` fails here, and nothing else in the repository notices.
 *
 * `FieldPathResolution`'s SUCCESS arm is deliberately NOT asserted. It carries
 * the resolved `Json` value, which is the entire purpose of resolving one —
 * asserting it would be asserting the wrong thing about the wrong type, the same
 * distinction `AskTurn` draws immediately above.
 */
export type _FieldPathRefusalHoldsNoTextDeep = AssertNoTextDeep<FieldPathRefusal>
export type _FieldPathResolutionRefusalHoldsNoTextDeep =
  AssertNoTextDeep<FieldPathResolutionRefusal>


/* ------------------------------------------------------------------ *
 * SLICE 9 — the session row's key set is CLOSED, and the row is not
 * tenant-scoped (#222 [A-2], #223 [A-5]; G180, G220, G223)
 * ------------------------------------------------------------------ */

/**
 * A key set, pinned in BOTH directions.
 *
 * ⚠️ A SINGLE `extends` WOULD PASS A WIDENING AND IS NOT A SUBSTITUTE. The
 * argument is `AssertSameType`'s, forty lines up, applied to `keyof T` rather
 * than to a brand: one-way assignability accepts exactly the case a closed key
 * set exists to refuse.
 *
 * ⚠️ IT IS A SIBLING OF `AssertSameType` AND NOT A REUSE OF IT, and the reason
 * is the PAIR NAMES rather than the mechanism. `AssertSameType`'s entries are
 * `{ viaKernel, viaOwner }` — a claim about one name reachable down two import
 * paths — and writing `{ viaKernel: keyof Session; viaOwner: SessionKey }`
 * would make the constraint pass while the label lied about what was being
 * compared. The mechanism is copied verbatim, including the mapped type, which
 * is there because a conditional written directly in a constraint is TS2313.
 *
 * 🛑 THE ENUMERATION MUST LIVE IN A DIFFERENT MODULE FROM THE INTERFACE OR THE
 * ASSERTION IS VACUOUS. If both sides were derived from `Session`, the
 * constraint would compare a thing with itself and pass forever. The unions
 * below are hand-written HERE, in the leaf module, against interfaces declared
 * in `domain.ts`, so adding a field in one place reddens the other.
 */
type SameKeySet<M> = {
  [K in keyof M]: M[K] extends { declared: infer A; enumerated: infer B }
    ? [A] extends [B]
      ? [B] extends [A]
        ? M[K]
        : never
      : never
    : never
}

/** Constraint-shaped, for the reason recorded on `AssertIdentity`. */
export type AssertKeySetIsExactly<M extends SameKeySet<M>> = M

/**
 * ELEVEN, AND THE NUMBER HAS MOVED TWICE — do not "correct" it back.
 *
 * `docs/build/stateless-green-session.md` settled the row at NINE with a
 * bidirectional key-set assertion, "including every deliberate absence", and
 * listed "No `lastUsedAt` (§6.4)" among them. **G180** then ruled that the
 * session binds to its issuing host and that the binding is PERMANENT, which
 * makes `issuedHost` the tenth. **G220**, two days later, ruled that
 * `lastUsedAt` STAYS ON THE ROW — "without it there is nothing to compare the
 * clock against, and `maxIdleSeconds` becomes a number the system holds and
 * cannot act on" — which reverses §6.4 and makes eleven.
 * `docs/HANDOFF.md` §3 outranks `docs/build/`, and G220 outranks G180 by date
 * on the one field they disagree about. **#222's body says ten and predates
 * G220.**
 *
 * `secondFactorAt` IS IN THE SET AND IS DROPPED FOR v1 UNDER G223. Dropped is
 * not deleted: the declaration stays, carries the dated drop note, and nothing
 * may give it a producer. A key set that omitted it would make re-adding the
 * FIELD a silent act.
 *
 * ⚠️ THE DROP MARKER ITSELF IS NOT REPRODUCED IN THIS PARAGRAPH, AND THE
 * OMISSION IS DELIBERATE RATHER THAN COY — the same device `model/kernel.ts`
 * uses for `FieldPath`'s old declaration, for the same reason: "a comment that
 * reproduces the line it is narrating away turns that control into one that
 * can never go green." `tools/check-doc-counts.mjs` derives the governed marker
 * total by counting raw occurrences of the marker across `model/*.ts`, so it
 * counts prose ABOUT another declaration's drop as a drop — the false-positive
 * class `CLAUDE.md` records striking through its own `awk`, and the one that
 * once rendered seven live exports as dropped on the C4 page.
 *
 * 🛑 THIS IS RECORDED BECAUSE IT HAPPENED HERE, TWICE, IN ONE COMMIT. The first
 * draft of this paragraph spelled the marker out and moved the tree's count by
 * one while dropping nothing; the correction that explained why then quoted the
 * marker inside the `grep` it was describing and did it AGAIN. The count is a
 * governed total, so both drafts turned `check-doc-counts` red on a line in
 * `CLAUDE.md` that was correct. If you are writing about a marker, cite it by
 * anchor and not by copy.
 */
type SessionKey =
  | 'id'
  | 'handleDigest'
  | 'userId'
  | 'connectionId'
  | 'tenantId'
  | 'issuedHost'
  | 'authenticatedAt'
  | 'secondFactorAt'
  | 'lastUsedAt'
  | 'expiresAt'
  | 'revokedAt'

/**
 * SEVEN, and the seventh absence is the interesting one.
 *
 * `SignInAttempt` carries NO `userId`: before the door answers there is no
 * principal, and a `userId` written at redirect is a user-existence oracle on
 * an unauthenticated surface. `_SignInAttemptCarriesNoUserId` below states that
 * one absence by name as well, because this union states it only by silence —
 * and a reader adding a field reads a union of seven names as a list to extend.
 */
type SignInAttemptKey =
  | 'id'
  | 'handleDigest'
  | 'connectionId'
  | 'challengeDigest'
  | 'startedAt'
  | 'expiresAt'
  | 'consumedAt'

/**
 * RED BEFORE THIS SLICE: at base both entries failed with TS2305, `Module
 * './domain' has no exported member 'Session'`, because MG1's finding was
 * exactly that nothing in the tree declared one.
 *
 * BOTH GUARDS WERE RUN AFTER THE ROWS LANDED, and the observed errors are
 * recorded because an assertion nobody has watched fail is a comment with extra
 * steps:
 *
 *   1. `email: string` added to `Session` → TS2344 here, `Type '{ Session: {
 *      declared: keyof Session; enumerated: SessionKey; }; … }' does not
 *      satisfy the constraint`. The added key is in `declared` and not in
 *      `enumerated`, so the first `extends` fails.
 *   2. `revokedAt` REMOVED from `Session` → the same TS2344 from the other
 *      direction, because `enumerated` then names a key the interface no longer
 *      declares. This is the direction a single `extends` would have missed.
 *
 * 🛑 GUARD 2 IS THE ONE THAT MATTERS, AND IT WAS MEASURED RATHER THAN ARGUED.
 * `SameKeySet` above was temporarily weakened to a single `[A] extends [B]` and
 * `revokedAt` deleted from `Session` in the same tree: `tsc -p
 * model/tsconfig.json` reported NO error at either key-set assertion. A widening
 * passes one-way assignability, so a proof written with a single `extends`
 * compiles green through a deleted field — which is the failure a closed key set
 * exists to catch. Do not simplify the mapped type.
 */
export type _SessionCarriesExactlyTheseKeys = AssertKeySetIsExactly<{
  Session: { declared: keyof Session; enumerated: SessionKey }
}>

/**
 * RED BEFORE THIS SLICE, for the same reason and with the same error. Witnessed
 * again after: `userId: UserId` added to `SignInAttempt` fails here with TS2344
 * — which is the eighth-key case #223 names, and it is the specific eighth key
 * the record expects somebody to reach for.
 */
export type _SignInAttemptCarriesExactlyTheseKeys = AssertKeySetIsExactly<{
  SignInAttempt: { declared: keyof SignInAttempt; enumerated: SignInAttemptKey }
}>

/**
 * `T extends false` is a constraint, so a `true` here is a constraint violation
 * at THIS line rather than a `never` nobody reads — the shape every assertion
 * in this file uses, for the reason recorded on `AssertIdentity`.
 */
type AssertFalse<T extends false> = T

/**
 * 🛑 THE ONE STRUCTURAL FACT THE WHOLE SESSION SURFACE TURNS ON.
 *
 * `Session.tenantId` is `TenantId | null` — null between authentication and
 * selection — while `TenantScoped` requires a non-null `TenantId`. Writing
 * `interface Session extends TenantScoped` would compile perfectly and produce
 * a table whose rows are INVISIBLE TO THE CONNECTION THAT JUST WROTE THEM:
 * `db/migrations/0001_tenancy_and_rls.sql`'s predicate over a NULL column
 * evaluates to NULL, and G100's polarity then denies unconditionally.
 *
 * VERIFIED RED: `export interface Session extends TenantScoped` makes the
 * conditional below `true` and fails this line with TS2344, `Type 'true' does
 * not satisfy the constraint 'false'`. Nothing else in the repository notices —
 * the interface still compiles, every field still resolves, and the defect
 * surfaces as an empty result set in production.
 *
 * ⚠️ IT IS WRITTEN AGAINST `TenantScopedViaKernel` DELIBERATELY. `domain.ts`
 * RE-EXPORTS the name rather than declaring it, and `_BrandsReachableFromBothPaths`
 * above proves the two resolve to the same type — so this asserts against the
 * declaration rather than against a re-export that could be dropped.
 */
export type _SessionIsNotTenantScoped = AssertFalse<
  Session extends TenantScopedViaKernel ? true : false
>

/**
 * THE DELIBERATE ABSENCE, STATED BY NAME.
 *
 * `_SignInAttemptCarriesExactlyTheseKeys` already refuses an eighth key, so
 * this is redundant as a MECHANISM and is not redundant as a RECORD: a key-set
 * assertion fails with "the sets differ" and names no field, and the field this
 * one names is the one G223 says anybody reopening the second-factor question
 * must clear first. A per-user attempt counter cannot live on this row without
 * re-creating the user-existence oracle the realm lookup was designed to avoid.
 *
 * VERIFIED RED: adding `userId: UserId` to `SignInAttempt` fails HERE as well
 * as at the key set, and this is the failure that says why.
 */
export type _SignInAttemptCarriesNoUserId = AssertFalse<
  'userId' extends keyof SignInAttempt ? true : false
>

/**
 * INVARIANT 1, STATED BY NAME ON THE ONE INPUT THAT COULD DEFEAT IT BY
 * RELOCATION — #235 [A-14].
 *
 * `InvitationRedemption` is what an ACCEPTING caller presents, and acceptance
 * happens before a session exists. #235: *"nothing in that flow may take a
 * tenant from the request body except the invitation's own row, which the
 * server issued."* `acceptInvitation()` reads `invitation.tenantId`, and a
 * `tenantId` on this input would give a caller a second, competing source that
 * a handler could pass through in one line.
 *
 * ⚠️ IT IS THE RELOCATION CASE RATHER THAN THE DELETION CASE, which is why an
 * absence assertion is worth more here than a review comment. Nobody deletes
 * the tenant derivation; somebody ADDS a convenient parameter, and the
 * derivation stays where it was and stops being the only source.
 *
 * VERIFIED RED: adding `readonly tenantId: TenantId` to `InvitationRedemption`
 * fails here with TS2344, `Type 'true' does not satisfy the constraint
 * 'false'`.
 */
export type _InvitationRedemptionCarriesNoTenantId = AssertFalse<
  'tenantId' extends keyof InvitationRedemption ? true : false
>

/**
 * G229'S AUDIT PROPERTY, HELD AT THE TYPE LEVEL.
 *
 * The ruling's own words: *"the person who CONFERRED authority is the person
 * recorded as conferring it. Under the rejected shape the record would name the
 * RECIPIENT as the actor who granted themselves access."* `acceptInvitation()`
 * reads `grant.subjectUserId` — the inviter — and writes it to
 * `Membership.grantedBy`.
 *
 * 🛑 A `grantedBy` ON THIS INPUT WOULD MAKE THE AUDIT LINE CALLER-SUPPLIED, and
 * a caller that can name the conferrer can name the wrong one. The wrong one is
 * not hypothetical: it is exactly the invitee, which is the shape G229 refused.
 * The runtime witness is in `tests/model/invitation.test.ts`, where the
 * accepting user is deliberately NOT the grant's subject; this is the
 * compile-time half beside it.
 *
 * VERIFIED RED: adding `readonly grantedBy: UserId` to `InvitationRedemption`
 * fails here with TS2344.
 */
export type _InvitationRedemptionCarriesNoGrantedBy = AssertFalse<
  'grantedBy' extends keyof InvitationRedemption ? true : false
>

/**
 * The session line's three new string types are branded, so none of them is a
 * naked alias that reads as checked and is not.
 *
 * `SessionHandleDigest` is the one to watch: it is a branded VALUE rather than
 * an `Id<>`, because there is no `SessionHandle` entity and minting a table for
 * a derived string is the defect `model/learning.ts` records. Its symbol is
 * module-private in `domain.ts`, so the only way to obtain one is a deliberate
 * cast at the digest seam — and the seam is where a reviewer looks.
 *
 * VERIFIED RED: declaring `export type SessionHandleDigest = string` fails here
 * with TS2344, which is exactly the naked-alias defect slice 4 exists for.
 */
export type _SessionIdsAreBranded = AssertBranded<{
  SessionId: SessionId
  SignInAttemptId: SignInAttemptId
  SessionHandleDigest: SessionHandleDigest
}>
