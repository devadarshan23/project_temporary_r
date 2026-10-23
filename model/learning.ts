/**
 * ReconcileAI — corrections, the nomination gate, and the learning store.
 *
 * GREEN-TEAM PROPOSAL, 6 Aug 2026. Nothing here is built. It typechecks under
 * `model/tsconfig.json` and has zero call sites, which is this codebase's
 * recurring defect (`docs/access-and-agency.md` §12.3 names four instances) —
 * so read the recommendation before the types: the correct disposition is
 * SPECIFY, and build only §1 and §2 in the first release.
 *
 * ------------------------------------------------------------------------
 * THE ABSENCE THIS FILE ADDRESSES
 * ------------------------------------------------------------------------
 *
 * Verified 6 Aug 2026 by grep across `model/*.ts` and `docs/contracts/*.yaml`:
 * there is NO memory, NO knowledge graph, NO learning loop and NO nomination
 * machinery anywhere. The only hits for "nominat" are
 * `AccessResourceGrant.nominatedSubjectIds` (`model/governance.ts:618`) and
 * `REQUIRES_ENUMERATION` (`:354`) — a human naming tenant data instance by
 * instance rather than by class. That shape is borrowed here deliberately.
 *
 * ------------------------------------------------------------------------
 * THE FOUR STRUCTURAL DECISIONS, EACH ATTACKABLE
 * ------------------------------------------------------------------------
 *
 * 1. A CORRECTION IS DERIVED, NOT STORED. `ExceptionResolution`
 *    (`domain.ts:2098`), `ExceptionReversal` (`:2167`), `ApprovalDecision`
 *    (`:2586`), `ResolutionProposal` (`:2561`) and `ProcedureStepExecution`
 *    (`:2451`) already hold every fact a correction is made of.
 *    `classifyCorrection()` below is a pure function over rows that exist. A
 *    `corrections` table would be `HANDOFF` §5.3 — two vocabularies for one
 *    concept — on day one.
 *
 * 2. A LEARNING HAS NO FREE-TEXT FIELD. This is the load-bearing choice.
 *    Invariant 6 says ingested content is data, never instruction. A learning
 *    distilled from an admitted counterparty reply and stored as prose, then
 *    interpolated into a later prompt, IS content becoming instruction — and no
 *    reviewer, human or model, reliably detects it. If the record has nowhere to
 *    put a sentence, an injected sentence cannot be stored. The human-readable
 *    line is RENDERED from the structured record at assembly time, which is
 *    exactly the `PolicyReasonCode` fix (`HANDOFF` §6, `policy.ts:436`) applied
 *    before the mistake rather than after it.
 *
 * 3. NOMINATION AND PROMOTION ARE TWO ACTS. D5(ii). A nomination asserts a
 *    claim; a promotion changes what the tenant's agents do unattended, which
 *    `agents.ts:441` already classifies as an authority act requiring four
 *    eyes. One pair of eyes on a fleet-wide behaviour change is the widening
 *    that `HANDOFF` §3 pass A forbids.
 *
 * 4. THE GRAPH IS AN INDEX OVER IDS THAT ALREADY EXIST. Nodes are references to
 *    existing entities; edges carry a closed kind and nothing else. A graph with
 *    free-form node properties is a second content store with its own
 *    classification, its own retention and its own erasure gap. This one has
 *    none of those, because it holds no values.
 *
 * ------------------------------------------------------------------------
 * WHAT THIS FILE DELIBERATELY DOES NOT DO
 * ------------------------------------------------------------------------
 *
 * No vector embeddings, no retrieval scoring, no similarity. Out of scope by
 * instruction, and the design does not smuggle them back in: retrieval here is
 * an exact-match lookup on enumerated ids, which is a SELECT.
 */

import type {
  AuthorizationGrantId,
  CounterpartyId,
  DataClass,
  DefinitionId,
  DispositionFamily,
  DocumentTypeId,
  ExceptionId,
  Id,
  Money,
  ProposalId,
  ReconciliationArchetype,
  RetentionClass,
  SolutionId,
  TenantScoped,
  Timestamp,
  UserId,
} from './domain'
import type { Capability, CapabilityRequirement, OrgClass } from './access'
/**
 * A VALUE import, 9 Aug 2026 (G128), and it carries the `.ts` extension because
 * Node's ESM resolver does not add one — the defect that stopped three modules
 * loading at all on 8 Aug while `tsc` stayed green.
 *
 * It exists so `PROMOTE_LEARNING_CAPABILITY` can be the MEMBER rather than a
 * string that spells the member. `access.ts` has no value import of its own and
 * imports nothing from here, so this opens no cycle.
 */
import { CAPABILITIES } from './access.ts'
import type { AcquisitionFidelity, ReversalReason } from './domain'

/**
 * The two learning-record ids, 7 Aug (G35). From `./kernel` directly; see the
 * note in `billing.ts`. `LearningNominationId` and `LearningEntryId` are still
 * declared in this module, which is the unfinished consolidation the slice-3
 * commit records — these two do NOT add to that, they are declared in kernel.
 */
import type { LearningRetractionId, NominationReviewId } from './kernel'
export type { LearningRetractionId, NominationReviewId } from './kernel'

export type LearningNominationId = Id<'LearningNomination'>
export type LearningEntryId = Id<'LearningEntry'>

/* ================================================================== *
 * 1. What a correction IS — five kinds, three destinations
 *
 * A single undifferentiated "correction" is precisely the shape
 * `reversalIndictsAutonomy()` (`domain.ts:2163`) exists to warn against: a
 * call site that counts all reversals alike "will drive autonomy to `none`
 * across the fleet and look like evidence while doing it".
 *
 * The kinds differ in WHAT THEY ASSERT, and that decides where they may land.
 * ================================================================== */

export const CORRECTION_KINDS = {
  /**
   * A human resolved with a different disposition than the agent proposed.
   * The strongest signal in the set: it asserts both a negative and a positive,
   * and both are drawn from the pack's closed disposition list.
   *
   * Requires `ResolutionProposal.proposedBy.kind === 'agent'`. If a human
   * proposed, nothing was corrected — the system offered no judgement to be
   * wrong about, and treating it as a correction inflates every rate computed
   * from this set.
   */
  divergentDisposition: 'divergent_disposition',
  /**
   * Same disposition, different `adjustment: Money`. A calibration fault, not a
   * judgement fault. Distinct because the remedies differ entirely: a tolerance
   * or a rounding rule, never a change to which disposition is chosen.
   */
  divergentAdjustment: 'divergent_adjustment',
  /**
   * `ApprovalDecision.decision === 'rejected'` against an agent proposal.
   *
   * WEAK BY CONSTRUCTION AND THAT IS THE POINT: it asserts "not this" and names
   * no alternative. It can become an eval case (an expected absence) and it can
   * NEVER become a memory entry, because there is nothing to retrieve.
   */
  rejectedProposal: 'rejected_proposal',
  /**
   * An `ExceptionReversal` where `reversalIndictsAutonomy(reason)` holds —
   * `wrong_disposition` or `insufficient_evidence` only.
   *
   * The other three reasons are not corrections of the system. `data_corrected`
   * and `downstream_rejected` correct the WORLD; `rule_wrong` corrects the
   * RULE and routes to `author_rule`, not to a learning. Folding those in is
   * the loop strangling itself on its own data corrections, which is the exact
   * failure the function was written to prevent.
   */
  indictingReversal: 'indicting_reversal',
  /**
   * The human kept the disposition and rewrote the explanation.
   * `HumanFeedback.verdict === 'amended'` (`evaluation.ts:280`). Targets
   * `ScoreTarget` explanation quality. Eval-only, permanently: an explanation
   * correction retrieved into a later prompt teaches style, and style carried
   * from a real exception carries that exception's values.
   */
  amendedExplanation: 'amended_explanation',
  /**
   * A human overrode an admission decision — admitted what `mayAdmit()` refused
   * or refused what it permitted.
   *
   * NOT A LEARNING AT ALL, AND ROUTING IT HERE IS A REFUSABLE NOMINATION. It is
   * a SAFETY signal and its destination already exists:
   * `InjectionProbe.reconstructedFromRefusal` (`evaluation.ts:434`), which the
   * corpus uses to "learn from production without production content entering
   * the control plane". A safety regression is not quality drift
   * (`evaluation.ts:491`); it is equally not a preference to be remembered.
   */
  admissionOverride: 'admission_override',
} as const
export type CorrectionKind =
  (typeof CORRECTION_KINDS)[keyof typeof CORRECTION_KINDS]

/**
 * Where a correction of this kind may EVER go. Total over `CorrectionKind`, so
 * a seventh kind is a compile error until somebody decides — the discipline
 * `CAPABILITY_RESOURCE_CLASS` (`access.ts:426`) and
 * `AUTHORIZATION_MAY_BE_ABSENT` (`governance.ts:1013`) both use.
 */
export type LearningDestination =
  /** Retrieved at inference time and rendered into context. */
  | 'memory'
  /** An `ObservedExample` (`evaluation.ts:257`) — measured against, never read. */
  | 'eval'
  /** A proposed `HarnessDocument` edit under four eyes (`agents.ts:514`). */
  | 'harness'
  /** A proposed `author_rule` / `configure_tolerance` change. Not a learning. */
  | 'configuration'
  /** `InjectionProbe.reconstructedFromRefusal`. Safety, never behaviour. */
  | 'injection_corpus'
  /** Contentless statistic only. The default, and the only one needing no act. */
  | 'statistic_only'

export const PERMITTED_DESTINATIONS: Record<
  CorrectionKind,
  readonly LearningDestination[]
> = {
  divergent_disposition: ['memory', 'eval', 'harness', 'statistic_only'],
  divergent_adjustment: ['configuration', 'eval', 'statistic_only'],
  /** No target to retrieve. Eval or nothing. */
  rejected_proposal: ['eval', 'statistic_only'],
  indicting_reversal: ['memory', 'eval', 'harness', 'statistic_only'],
  /** Style, and style carries values. Never retrieved. */
  amended_explanation: ['eval', 'statistic_only'],
  /** Safety. Never behaviour, at any nomination. */
  admission_override: ['injection_corpus', 'statistic_only'],
}

/**
 * THE ANTI-CONTAMINATION RULE, stated as a constant so removing it is a diff.
 *
 * One correction may not feed BOTH `memory` and `eval`. If it does, the memory
 * steers the agent to produce what the eval expects, both sides having come
 * from the same human act, and the gate reports a pass it did not earn. This is
 * ordinary train/test contamination, and it is invisible in a dashboard: the
 * score rises, the denominator is honest, and the measurement is worthless.
 *
 * Enforced by `LearningNomination.destination` being ONE value, not a set.
 */
export const EVAL_AND_MEMORY_ARE_EXCLUSIVE = true

/**
 * A correction, DERIVED. There is no table behind this type.
 *
 * Every field is a reference into a row that already exists, which is what
 * makes the claim "nothing new is stored for a correction" checkable rather
 * than asserted.
 */
export interface Correction {
  kind: CorrectionKind
  exceptionId: ExceptionId
  /** Null only for `admission_override`, which precedes any proposal. */
  proposalId: ProposalId | null
  /** The human whose act constitutes the correction. Always present. */
  correctedBy: UserId
  at: Timestamp
  /** What the agent said. Null where the agent named nothing (a rejection). */
  agentDispositionKey: string | null
  /** What the human said. Null where the human named nothing (a rejection). */
  humanDispositionKey: string | null
  /** Set only on `divergent_adjustment`. */
  adjustmentDelta: Money | null
  /** Set only on `indicting_reversal`. */
  reversalReason: ReversalReason | null
}

/**
 * The derivation, written out so "nothing new is stored" is testable.
 *
 * TAKES ROWS, RETURNS A VIEW, TOUCHES NO STORE. Returns null where the facts
 * describe no correction at all — which is most of the time, and is the case
 * that matters: an approved agent proposal, or a human proposing and resolving
 * their own judgement, corrects nothing. Counting either inflates every rate
 * downstream, including `AutonomyDials.reversalRate`.
 *
 * Deliberately NOT a method on anything and NOT a service call. If it ever
 * needs a query, a fact is missing from the rows above and the fix is to find
 * which one, not to add a table.
 */
export function classifyCorrection(input: {
  exceptionId: ExceptionId
  /** Null when no proposal exists — an admission override, or a manual raise. */
  proposal: {
    id: ProposalId
    proposedByKind: 'user' | 'agent'
    dispositionKey: string
    adjustment: Money | null
  } | null
  /** The terminal act. Exactly one of these three, or none yet. */
  outcome:
    | { kind: 'resolved'; dispositionKey: string; adjustment: Money | null; by: UserId; at: Timestamp }
    | { kind: 'rejected'; by: UserId; at: Timestamp }
    | { kind: 'reversed'; reason: ReversalReason; by: UserId; at: Timestamp }
    | { kind: 'explanation_amended'; by: UserId; at: Timestamp }
    | { kind: 'admission_overridden'; by: UserId; at: Timestamp }
  /** `reversalIndictsAutonomy(reason)`, imported by the caller, not reimplemented. */
  reversalIndicts: boolean
}): Correction | null {
  const { proposal, outcome } = input

  if (outcome.kind === 'admission_overridden') {
    return {
      kind: 'admission_override',
      exceptionId: input.exceptionId,
      proposalId: null,
      correctedBy: outcome.by,
      at: outcome.at,
      agentDispositionKey: null,
      humanDispositionKey: null,
      adjustmentDelta: null,
      reversalReason: null,
    }
  }

  /** THE GATE THAT MATTERS. No agent judgement, nothing corrected. */
  if (proposal === null || proposal.proposedByKind !== 'agent') return null

  const base = {
    exceptionId: input.exceptionId,
    proposalId: proposal.id,
    correctedBy: outcome.by,
    at: outcome.at,
    agentDispositionKey: proposal.dispositionKey,
  }

  if (outcome.kind === 'rejected') {
    return {
      ...base,
      kind: 'rejected_proposal',
      humanDispositionKey: null,
      adjustmentDelta: null,
      reversalReason: null,
    }
  }
  if (outcome.kind === 'explanation_amended') {
    return {
      ...base,
      kind: 'amended_explanation',
      humanDispositionKey: proposal.dispositionKey,
      adjustmentDelta: null,
      reversalReason: null,
    }
  }
  if (outcome.kind === 'reversed') {
    /** The whole of `reversalIndictsAutonomy()`'s argument, honoured here. */
    if (!input.reversalIndicts) return null
    return {
      ...base,
      kind: 'indicting_reversal',
      humanDispositionKey: null,
      adjustmentDelta: null,
      reversalReason: outcome.reason,
    }
  }

  /* resolved */
  if (outcome.dispositionKey !== proposal.dispositionKey) {
    return {
      ...base,
      kind: 'divergent_disposition',
      humanDispositionKey: outcome.dispositionKey,
      adjustmentDelta: null,
      reversalReason: null,
    }
  }
  if (adjustmentsDiffer(proposal.adjustment, outcome.adjustment)) {
    return {
      ...base,
      kind: 'divergent_adjustment',
      humanDispositionKey: outcome.dispositionKey,
      adjustmentDelta: outcome.adjustment,
      reversalReason: null,
    }
  }
  /** The human agreed. Not a correction, and the commonest outcome. */
  return null
}

/**
 * Cross-currency comparison is REFUSED, not approximated — `HANDOFF` §5.7.
 * BHD carries three decimal places and USD two, so equal `amountMinor` differ
 * by roughly 3.8x. Differing currencies are treated as differing amounts,
 * which is the conservative direction: it produces a correction to review
 * rather than silently deciding two unlike numbers are equal.
 */
function adjustmentsDiffer(a: Money | null, b: Money | null): boolean {
  if (a === null && b === null) return false
  if (a === null || b === null) return true
  if (a.currency !== b.currency) return true
  return a.amountMinor !== b.amountMinor || a.exponent !== b.exponent
}

/* ================================================================== *
 * 2. The nomination act — D5, and its two named failure modes
 * ================================================================== */

/**
 * WHY THE HUMAN'S SCOPE HAS NO `all` VARIANT, unlike `AssignmentScope`.
 *
 * `ScopeDimension<T>` (`access.ts:512`) is `{ all } | { these }` because an
 * authority scope NARROWS a permission, so `all` is the honest way to write
 * "unnarrowed" and the polarity bug it fixed was `null` failing OPEN.
 *
 * A learning scope runs the other way: it WIDENS behaviour. `{ kind: 'all' }`
 * on a learning is "always, everywhere, for every counterparty" — a fleet-wide
 * behaviour change asserted by one operator resolving one exception. So the
 * variant does not exist here, and every enumeration is non-empty or absent.
 *
 * This choice pays for itself twice; see §7. Erasing a subject from a `these`
 * list is a NARROWING and happens automatically. Erasing one from an `all`
 * would have been unrepresentable, and the entry would have had to be widened
 * or destroyed — an erasure that widens behaviour is the worst outcome
 * available and the polarity is the only thing preventing it.
 */
export type LearningDimension<T> =
  | { kind: 'unconstrained' }
  | { kind: 'these'; values: readonly T[] }

/**
 * Module-private brand for the one thing here that is a VALUE and not a row.
 *
 * `declare const … : unique symbol` is unique PER DECLARATION, which is why
 * `model/kernel.ts:17` warns against a SECOND `Id` symbol. This is not one: it
 * is a separate brand family for a separate kind of thing, and the precedent is
 * `presentation.ts:849`'s `viewerScoped`, which brands a value for the same
 * reason — the type is the control, and a bare `string` is not.
 */
declare const normalisedDescription: unique symbol

/**
 * A NORMALISED DESCRIPTION — THE VALUE THE ENGINE PRODUCED, BRANDED. G131.
 *
 * 🛑 CORRECTED 9 Aug 2026. This was declared
 * `export type NormalisedDescriptionId = Id<'NormalisedDescription'>` and there
 * has never been a `NormalisedDescription` interface anywhere in this tree. A
 * brand is a phantom type, so `tsc` was green from the hour it landed;
 * `tools/planner/extract.mjs` reported it as the model's ONE dangling edge, and
 * that is the only thing in this repository that could have.
 *
 * ⚠️ THE DEFECT WAS SEMANTIC, NOT CLERICAL, AND THIS DOCBLOCK IS WHERE IT LIVED.
 * It previously read "A NORMALISED DESCRIPTION, AS A REFERENCE AND NEVER AS THE
 * TEXT … the dimension enumerates IDs of normalised descriptions the engine
 * already produced … the text lives where it always lived, on the record the id
 * points at." `ObservedScopeValue` below says the opposite, twenty lines on: "A
 * normalised description is not an entity; it is a VALUE observed on a row,
 * WITH NO REGISTRY TO CHECK IT AGAINST, so provenance is the only thing that
 * makes it real." Both readings were in the module at once. The second is the
 * one the code implements, and `observedOn` is the proof — provenance exists
 * PRECISELY BECAUSE there is no row to point at. Were there a
 * `NormalisedDescription` table, an id would carry its own provenance and
 * G131's whole mechanism would be redundant.
 *
 * WHY NOT MINT THE ENTITY AND SATISFY THE BRAND. Because that invents a table
 * for a derived, untimed, recomputable string. G35's rule — a machine-produced
 * TIMED record gets its own identity — does not reach it: a normalised
 * description has no timestamp and is a pure function of its input under a
 * declared `IdentifierNormalisation`. Minting a row to make a tool quiet is the
 * defect shape `CLAUDE.md` names, a rule keyed on a convenient landmark instead
 * of the property it protects.
 *
 * WHY IT IS BRANDED AT ALL, given that it is a string. So that a raw
 * counterparty description cannot be passed where a normalised one is expected.
 * The brand symbol is module-private, so the only way to obtain one is a
 * deliberate cast at a seam — and the seam is where a reviewer looks.
 *
 * ⚠️ WHAT THE ORIGINAL DOCBLOCK GOT RIGHT AND WHAT IT DID NOT, because the
 * invariant-6 argument was real and must not be lost with the wrong sentence
 * that carried it. This module still has NO FREE-TEXT FIELD: there is no
 * `note`, no `reason: string`, no `description`. But a normalised description
 * IS derived from ingested text, and calling it "a reference, never the text"
 * claimed a separation the type never provided. The protections that actually
 * hold are narrower and are stated rather than assumed:
 *   — the value is compared with `===` and nothing else. No pattern is compiled
 *     and no expression is interpreted (G124/G130, §2 below).
 *   — it is never rendered into a prompt by anything in this module.
 *   — `ObservedScopeValue` requires provenance, so a value a human invented
 *     from memory is refused rather than stored.
 * Anything that DOES render one into a prompt owes invariant 6 its own argument
 * and does not inherit one from here.
 *
 * ⚠️ THE FIELD THAT HOLDS THESE IS NAMED `normalisedDescriptions`, WHICH IS NOT
 * ID-SHAPED, so `tools/planner/extract.mjs` cannot count it. THAT IS NOW
 * CORRECT rather than a gap: the extractor indexes REFERENCES, and this is not
 * one. The old note here asked for `normalisedDescriptionIds` as "the name that
 * would be countable" — that name would have been a lie about what the field
 * holds, and it is withdrawn.
 */
export type NormalisedDescriptionValue = string & {
  readonly [normalisedDescription]: 'NormalisedDescription'
}

/**
 * AN ENUMERATED VALUE AND THE ROW IT WAS SEEN ON. G131, 9 Aug 2026.
 *
 * `MAX_ENUMERATED_PER_DIMENSION` caps HOW MANY values a human may name and
 * checks that NOT ONE of them was ever seen. G125's claim is that a promoted
 * rule matches what the human WAS SHOWN; before this type that claim was
 * asserted by the design and enforced by nothing, and a human who saw one
 * description could type three plausible ones and pass every check in
 * `validateNomination()`.
 *
 * `observedOn` IS REQUIRED-AND-NULLABLE, NEVER OPTIONAL, and the polarity is
 * the whole design. Optional would let a payload omit the key silently.
 * Non-nullable would put the entire control in the COMPILER — and a nomination
 * arrives as JSON over a wire the compiler does not run on, so `undefined` and
 * `""` would both sail through while `tsc` stayed green. `HANDOFF` §5.10 is the
 * standing form of that mistake in this codebase. The type makes the field
 * impossible to FORGET; `validateNomination()` is what makes an absent value a
 * refusal, and `tests/model/learning-promotion.test.ts` casts both wire shapes
 * in deliberately to prove the runtime check and not the type.
 *
 * THE PROVENANCE IS AN `ExceptionId` because that is the row a human is SHOWN.
 * A residue row (`ResidueEntry`, `model/reconciliation.ts:2062`) has no id of
 * its own — it is addressed by an `ItemRef` — and it reaches a person as an
 * exception in a queue. `CounterExample` already names the same currency for
 * the same reason, so the two halves of a nomination cite one kind of thing.
 */
export interface ObservedScopeValue<T> {
  readonly value: T
  /**
   * The residue row this value was observed on, as the exception a human saw.
   * Null is REPRESENTABLE and REFUSED — see the type's own note.
   */
  readonly observedOn: ExceptionId | null
}

/**
 * A dimension whose enumerated values each carry provenance.
 *
 * Structurally assignable to `LearningDimension<unknown>`, deliberately: the
 * emptiness and cardinality loops in `validateNomination()` iterate the five
 * original dimensions and this one together, so the sixth cannot drift out of
 * those checks by being a different shape.
 *
 * ⚠️ WHY THE OTHER FIVE DIMENSIONS DID NOT GET THIS, AND IT IS NOT AN OVERSIGHT.
 * They enumerate ids of entities that EXIST INDEPENDENTLY — a `CounterpartyId`
 * names a row with its own history, and `countContradictingInScope()` bounds a
 * claim about it against that history whether the human saw it or not. A
 * normalised description is not an entity; it is a VALUE observed on a row,
 * with no registry to check it against, so provenance is the only thing that
 * makes it real. If that argument is ever judged too fine, the fix is to widen
 * `LearningDimension` rather than to bolt a second check onto one field.
 */
export type ObservedLearningDimension<T> =
  | { kind: 'unconstrained' }
  | { kind: 'these'; values: readonly ObservedScopeValue<T>[] }

/**
 * How far the human claims this generalises. CONJOINED, never disjoined — the
 * same rule `AssignmentScope` states, and for the same reason: a scope that
 * widens by adding a clause is a scope nobody can read.
 *
 * `unconstrained` is legal on a dimension but not on ALL of them —
 * `validateNomination()` refuses `scope_unbounded`. The human must say what
 * makes this case a class rather than an instance, on at least one axis.
 *
 * NOTE THE ABSENCES. No free text. No predicate. No pattern. `id LIKE 'ctp_%'`
 * is not a SELECT and the reverse question — *which learnings touch this
 * counterparty* — is the one an auditor and an erasure plan both ask
 * (`access.ts:553` makes the identical argument for `solutionIds`).
 */
export interface LearningScope {
  counterpartyIds: LearningDimension<CounterpartyId>
  documentTypeIds: LearningDimension<DocumentTypeId>
  definitionIds: LearningDimension<DefinitionId>
  solutionIds: LearningDimension<SolutionId>
  /**
   * Platform vocabulary, keyed to the archetype rather than the domain
   * (`domain.ts:1390`). The one dimension that is safe to state as a class
   * rather than an enumeration, because the class is ours and closed.
   */
  dispositionFamilies: LearningDimension<DispositionFamily>
  /**
   * THE SIXTH DIMENSION, AND IT IS IDENTIFYING. G131, 9 Aug 2026.
   *
   * WHY IT HAD TO EXIST: `validateNomination()` refused the product owner's own
   * worked example. The residue population is BY DEFINITION the one nothing
   * could be attributed to — `ResidueCause` carries a dedicated
   * `counterparty_unattributed` arm (`model/reconciliation.ts:2048`) — so for
   * the rows a human most wants to generalise about, `counterpartyIds` cannot
   * be enumerated, and neither can the other three original identifying
   * dimensions. Every such nomination hit `scope_lacks_identifying_dimension`.
   * A gate that refuses the one population the product exists to work on is not
   * a strict gate, it is a broken one.
   *
   * WHY IT SITS ON THE IDENTIFYING SIDE. `IDENTIFYING_SCOPE_DIMENSIONS` demands
   * a sixth dimension be placed deliberately, and its test is whether the
   * dimension ENUMERATES CONCRETE VALUES DRAWN FROM REAL RECORDS or CLASSIFIES
   * over a vocabulary. `dispositionFamilies` classifies: every exception in the
   * tenant falls into some family, so binding it excludes nothing. A normalised
   * description is the opposite — each value is one string the engine actually
   * produced from one row, it excludes every row that does not carry it, and
   * `observedOn` makes that provenance checkable rather than asserted.
   *
   * ⚠️ AND IT IS THE MOST DANGEROUS DIMENSION HERE, which is why it is the only
   * one carrying provenance. The other five name entities; this one names
   * values, and values are what a human can invent from memory. See
   * `ObservedScopeValue`.
   */
  normalisedDescriptions: ObservedLearningDimension<NormalisedDescriptionValue>
}

/**
 * WHY THE HUMAN GIVES A REASON, AND WHY IT IS A CODE.
 *
 * `HANDOFF` §6: `PolicyEvaluation.reason` was specified as a closed vocabulary,
 * shipped as a bare `string` documented as human-readable, and was then cited
 * as PII-free by construction in two later documents while carrying tenant
 * content. There is no free-text reason field anywhere in this module for that
 * reason and no other. A `note: string` here would be an operator typing
 * "vendor Acme always ships short, see the email from Raj" into a field that
 * crosses no boundary today and crosses one in six months.
 *
 * The code also does work a sentence cannot: it is checked against the
 * correction kind, so `explanation_misleading` on a `divergent_adjustment` is a
 * refusal rather than a puzzle for the approver.
 */
export type LearningReasonCode =
  /** The counterparty's documents systematically differ in a knowable way. */
  | 'counterparty_pattern'
  /** This document type is habitually mis-extracted in one identifiable field. */
  | 'document_type_pattern'
  /** The tolerance is wrong for this definition, not the judgement. */
  | 'tolerance_miscalibrated'
  /** The agent chose a defensible disposition in the wrong family. */
  | 'wrong_family_selected'
  /** The evidence was present and the agent did not cite it. */
  | 'evidence_available_not_used'
  /** The correct answer depends on a fact outside every document in the group. */
  | 'external_fact_required'
  /** A seasonal or period-bound effect the pack does not model. */
  | 'period_effect'
  /** The explanation was accurate and would mislead a reader. Eval-only. */
  | 'explanation_misleading'

/** Which reasons are coherent with which corrections. Total over both axes. */
export const REASON_APPLIES_TO: Record<
  LearningReasonCode,
  readonly CorrectionKind[]
> = {
  counterparty_pattern: ['divergent_disposition', 'indicting_reversal'],
  document_type_pattern: ['divergent_disposition', 'indicting_reversal'],
  tolerance_miscalibrated: ['divergent_adjustment'],
  wrong_family_selected: ['divergent_disposition', 'rejected_proposal'],
  evidence_available_not_used: [
    'divergent_disposition',
    'rejected_proposal',
    'indicting_reversal',
  ],
  external_fact_required: ['divergent_disposition', 'indicting_reversal'],
  period_effect: ['divergent_disposition', 'indicting_reversal'],
  explanation_misleading: ['amended_explanation'],
}

/**
 * THE THIRD THING THE HUMAN SUPPLIES, AND THE ONE THAT DEFEATS THE STAMP.
 *
 * D5(i): "a control that passes while asserting nothing is a false assurance,
 * which is worse than a missing one" (`HANDOFF` §5.6). A scope and a reason
 * code are both single-screen acts — a competent stamper picks plausible values
 * in four seconds, and `MIN_DECISION_SECONDS = 20` (`policy.ts:837`) exists
 * because this repository already measures exactly that failure.
 *
 * A counter-example cannot be produced without leaving the screen. The human
 * must name a DIFFERENT exception, inside the scope they just claimed, where
 * the behaviour they are correcting was RIGHT. That is a search, a read and a
 * judgement, and it is mechanically checkable afterwards: the validator
 * confirms the named exception is in scope and resolved the other way.
 *
 * `none_exists` is available and is NOT an escape hatch, because it is a
 * falsifiable assertion. The validator searches the nominated scope for a
 * resolved exception contradicting the claim; if it finds one the nomination is
 * refused with `contradicted_by_prior_resolution`, and the human is shown the
 * row they said did not exist. This is the same move as
 * `AccessResourceGrant.nominatedSubjectIds`: the human names instances, and the
 * naming is the auditable act.
 */
export type CounterExample =
  | {
      kind: 'named'
      /** In scope, and resolved differently. Both checked, not trusted. */
      exceptionId: ExceptionId
    }
  | {
      kind: 'none_exists'
      /**
       * The window the human asserts they searched. Bounds the validator's own
       * search, so "none exists" means something checkable rather than
       * "I did not look".
       */
      searchedFrom: Timestamp
      searchedTo: Timestamp
    }

/** Why a nomination was refused. Closed, because a refusal must be reportable. */
export type NominationRefusal =
  /** Every dimension `unconstrained`. The "always" nomination. */
  | 'scope_unbounded'
  /**
   * Only `dispositionFamilies` was bound. ADDED 6 Aug, and it is the defect the
   * original `scope_unbounded` was written to catch and did not.
   *
   * `constrained === 0` treated all five dimensions as interchangeable. They are
   * not. Four of them ENUMERATE INSTANCES — counterparties, document types,
   * definitions, solutions — and each one narrows to a countable set of real
   * rows. `dispositionFamilies` CLASSIFIES, over a platform vocabulary that is
   * ours and closed (`:402-406` says so approvingly, and that is exactly why it
   * cannot carry the bound alone): every exception in the tenant falls into some
   * family, so binding it excludes nothing.
   *
   * The nomination
   *
   *   { counterpartyIds: unconstrained, documentTypeIds: unconstrained,
   *     definitionIds:   unconstrained, solutionIds:     unconstrained,
   *     dispositionFamilies: these['timing_difference'] }
   *
   * returned `{ valid: true }` and means "always, for timing differences" — the
   * "always" nomination this union's first member exists to refuse, wearing one
   * classifier. At least one IDENTIFYING dimension must be enumerated.
   */
  | 'scope_lacks_identifying_dimension'
  /** An enumeration at or above the cardinality ceiling is `all` in disguise. */
  | 'scope_cardinality_exceeded'
  /** `searchedTo` is at or before `searchedFrom`. An empty window finds nothing. */
  | 'search_window_invalid'
  /**
   * The asserted search window is too narrow, or too stale, to make
   * `none_exists` mean anything. ADDED 6 Aug: `searchedFrom` and `searchedTo`
   * were collected and never read, so a human could assert they had searched a
   * one-second window and the claim passed unfalsified.
   */
  | 'search_window_inadequate'
  /** An empty `these` list. Grants nothing; asserts nothing. */
  | 'scope_dimension_empty'
  /** The reason code does not apply to this correction kind. */
  | 'reason_not_applicable_to_kind'
  /** The named counter-example is outside the claimed scope, so it bounds nothing. */
  | 'counter_example_outside_scope'
  /** The named counter-example resolved the SAME way. It is an example, not a bound. */
  | 'counter_example_does_not_contradict'
  /** `none_exists` was asserted and the validator found one. */
  | 'contradicted_by_prior_resolution'
  /** No agent proposal. Nothing was corrected. */
  | 'no_agent_proposal'
  /** A reversal that `reversalIndictsAutonomy()` rejects. */
  | 'reversal_does_not_indict'
  /** An `admission_override` nominated as anything but `injection_corpus`. */
  | 'safety_signal_misrouted'
  /** The destination is not in `PERMITTED_DESTINATIONS` for this kind. */
  | 'destination_not_permitted_for_kind'
  /** A live entry already covers this scope with this disposition. */
  | 'duplicate_of_live_entry'
  /** Approver is the nominator, or the person who made the correction. */
  | 'self_approval'
  /** Approver is not a customer-org principal. */
  | 'approver_not_customer_org'
  /**
   * The approver does not hold `promote_learning`. ADDED 9 Aug 2026 (G128).
   *
   * `mayPromoteLearning()` checked WHICH PERSON and never WHETHER THEY MAY —
   * while the `@dropped-for-v1` `mayRetractLearning()` beside it already took
   * `holdsPromoteLearning`. The stricter act was the unchecked one: promotion
   * WIDENS what the tenant does unattended and retraction narrows it.
   */
  | 'promoter_lacks_capability'
  /**
   * An enumerated scope value names no record it was observed on. ADDED 9 Aug
   * 2026 (G131).
   *
   * `MAX_ENUMERATED_PER_DIMENSION` caps how many values may be named and checks
   * that NONE of them was ever seen. G125 says a promoted rule matches what the
   * human WAS SHOWN; without a provenance reference that is a claim nothing
   * enforces, and a human who saw one description could type three.
   */
  | 'scope_value_lacks_provenance'

/**
 * A ceiling turns an enumeration into a claim. Above it, "these two hundred
 * counterparties" is `all` with extra steps, and the approver cannot read it.
 *
 * A STARTING POSITION, NOT A SETTLED NUMBER — recorded as a constant for the
 * reason `MIN_SAMPLE_TO_WIDEN` is (`policy.ts:833`): changing it should be a
 * visible act rather than an edit inside a function.
 */
export const MAX_ENUMERATED_PER_DIMENSION = 25

/**
 * WHO MAY PROMOTE A NOMINATION — AND WHY THE OBVIOUS REUSE DOES NOT SURVIVE.
 *
 * THE FIRST DRAFT OF THIS FILE COPIED `HARNESS_APPROVAL_REQUIREMENT`
 * (`agents.ts:514`) AND ITS ARGUMENT: `CAPABILITIES` is closed, adding a member
 * is a platform release, and `author_procedure` is the nearest true verb
 * already outside every `PARTNER_CAPABILITY_MASK`. That reasoning is sound and
 * the reuse is still WRONG, for a mechanical reason that did not exist when
 * `agents.ts` was written:
 *
 *   `CAPABILITY_RESOURCE_CLASS.author_procedure = 'configuration'`
 *                                              (`access.ts:453`)
 *   `authorize()` refuses outright when the capability's class differs from the
 *   resource's — `authorization_resource_class_mismatch` (`access.ts:1478`).
 *
 * A `LearningEntry` is not `configuration`. `configuration` is reachable by a
 * DELIVERY GRANT on the strength of the purpose alone (`PERMITTED_RESOURCES`),
 * and an FDE who can mint learnings changes what a customer's agents do
 * unattended with no tenant decision anywhere — which is verbatim the §8.7 hole
 * that moved `set_autonomy` and `configure_telemetry` into `authority`.
 *
 * SO ONE CAPABILITY IS ADDED, AND THE PRICE IS STATED: `promote_learning`,
 * classed `authority`. It is a platform release, it must be added to
 * `CAPABILITIES`, to `CAPABILITY_RESOURCE_CLASS` (a compile error until it is),
 * and to no `PARTNER_CAPABILITY_MASK` ever.
 *
 * ✅ DONE 9 Aug 2026 — G128. It is `CAPABILITIES.promoteLearning`, CAPABILITY
 * 37, classed `authority` (`access.ts`). This paragraph said "capability 35"
 * while the set already held thirty-six, which is why the number is no longer
 * written here: `awk '/^export const CAPABILITIES = \{/,/^\} as const/'
 * model/access.ts | grep -cE '^  [a-zA-Z]+:'` is the only trustworthy form.
 *
 * ⚠️ AND THE MINTING FORCED A THIRD MAP NOBODY HAD LISTED. Two total records
 * over `Capability` were expected — `CAPABILITY_RESOURCE_CLASS` and this
 * module's reasoning about it. `CAPABILITY_DELEGABLE` (`agents.ts:393`) is a
 * `satisfies Record<Capability, boolean>` and went red too, so the release also
 * had to decide whether an agent may promote a learning. It may not.
 *
 * ⚠️ THIS ALSO IMPLICATES `agents.ts:514`, WHICH IS EXISTING CODE. A
 * `HarnessDocument` changes unattended behaviour by the module's own argument,
 * so if it is an `authority` resource then `HARNESS_APPROVAL_REQUIREMENT` has
 * the identical mismatch and `authorize()` will refuse every harness approval.
 * That is a finding about code already written, not about this proposal, and it
 * is recorded rather than fixed here.
 *
 * NOMINATING NEEDS NO NEW CAPABILITY. `propose_resolution` is classed
 * `tenant_data` and a `LearningNomination` is a `tenant_data` resource — it
 * names an exception and a list of the customer's counterparties and changes
 * nothing. The classes agree, so `authorize()` mints, and invariant 10 holds
 * without inventing a verb.
 */
/**
 * THE MEMBER, NOT A STRING THAT SPELLS IT. Retyped 9 Aug 2026 under G128.
 *
 * This was `= 'promote_learning'` — a bare literal in a module that could not
 * widen `Capability`, sitting beside a comment explaining that the member ought
 * to exist. Reading it from `CAPABILITIES` means removing the member from
 * `access.ts` is a compile error HERE, which is the property a duplicated
 * literal never had.
 */
export const PROMOTE_LEARNING_CAPABILITY: Capability = CAPABILITIES.promoteLearning

/**
 * ✅ RETYPED 9 Aug 2026 (G128). This carried
 * `Omit<CapabilityRequirement, 'capability'> & { capability: typeof
 * PROMOTE_LEARNING_CAPABILITY }` with a note reading *"retype this to
 * `CapabilityRequirement` in the same commit that adds the member — the cast is
 * the reminder"*. The member is added, so the cast is gone and the reminder has
 * been honoured rather than deleted.
 */
export const LEARNING_PROMOTION_REQUIREMENT: CapabilityRequirement = {
  capability: PROMOTE_LEARNING_CAPABILITY,
  distinctHolders: 2,
  appliesAtOrAboveValue: null,
}

/**
 * A LEARNING IS A SCOPE'S WORTH OF TENANT DATA WRAPPED IN AN AUTHORITY ACT, and
 * that is two classes in one object — the `Solution` problem (§11.8) in a new
 * place, answered the same way.
 *
 * READING one discloses an enumerated list of the customer's counterparties and
 * definitions: `tenant_data`, under the reader's own `AssignmentScope`, exactly
 * as `resolveCard()` makes a dashboard binding a viewer-scoped read
 * (`presentation.ts:1062`). WRITING one changes unattended behaviour:
 * `authority`.
 *
 * So the container is never granted. You may narrow TO a learning's scope; you
 * may not be handed the learning, because being handed it would confer a
 * `tenant_data` read and an `authority` write in one act that neither class
 * permits on its own.
 */
export const LEARNING_IS_GRANTABLE = false

/**
 * THE STORE, AS A PORT THE VALIDATOR HOLDS — NOT AS FOUR ANSWERS IT IS HANDED.
 *
 * ADDED 6 Aug. The previous signature took `counterExampleInScope`,
 * `counterExampleContradicts`, `contradictingCountInScope` and
 * `duplicateOfLiveEntry` as plain arguments, with a comment arguing that only
 * one of them was exploitable and that a second computation shown to the
 * approver covered it.
 *
 * That defence does not survive `HANDOFF` §5.2, which is not a rule about
 * exploitability: *"an argument that the callee could compute itself. If it
 * could, it must."* `assignmentGrants()` was rewritten for exactly this — it
 * answered the capability half of a question and handed the scope half back to
 * the caller, in a module where every other single-point-of-truth check is a
 * function precisely because a call site reasoning independently is the
 * vulnerability. Four booleans and a count are five call sites reasoning
 * independently.
 *
 * The port does not make a lying implementation impossible; nothing can. It
 * makes the lie a substituted COMPONENT rather than a mistyped ARGUMENT — the
 * same trade `resolveModel()` makes with its `catalogue` map, and the same one
 * F13 Tool Broker exists to make ("a component must not enforce its own
 * limits").
 *
 * Every method is scoped by the caller's own session. None takes a tenant id;
 * invariant 1 says tenant scope is derived from the session and never read from
 * a request, and a port that accepted one would be a request.
 */
export interface NominationEvidence {
  /** Does the named counter-example fall inside the claimed scope? */
  counterExampleInScope(scope: LearningScope, exceptionId: ExceptionId): boolean
  /** Did it resolve to a DIFFERENT disposition than the one being generalised? */
  counterExampleContradicts(
    exceptionId: ExceptionId,
    preferredDispositionKey: string | null,
  ): boolean
  /**
   * Resolved in-scope exceptions contradicting the claim, WITHIN THE WINDOW the
   * human asserts they searched. The window is a parameter so that the count and
   * the assertion cannot be about different periods — which is what made
   * `searchedFrom` / `searchedTo` decorative.
   */
  countContradictingInScope(
    scope: LearningScope,
    from: Timestamp,
    to: Timestamp,
  ): number
  /**
   * Is the asserted window wide enough, and recent enough, for `none_exists` to
   * assert anything? The store answers because the answer depends on the
   * tenant's own history — how far back exceptions exist at all, and whether the
   * window ends before the correction being generalised. A constant here would
   * be a number pretending to be a judgement.
   */
  searchWindowIsAdequate(from: Timestamp, to: Timestamp): boolean
  /** Does a live entry already cover this scope with this disposition? */
  hasLiveEntryCovering(
    scope: LearningScope,
    preferredDispositionKey: string | null,
  ): boolean
}

/**
 * THE FIVE DIMENSIONS THAT IDENTIFY, AS OPPOSED TO THE ONE THAT CLASSIFIES.
 *
 * Named as a constant rather than written inline, because the distinction is the
 * whole of `scope_lacks_identifying_dimension` and a future sixth dimension has
 * to be placed deliberately on one side or the other. A classifier added here by
 * reflex would re-open the hole this closes.
 *
 * ✅ THE SIXTH DIMENSION ARRIVED 9 Aug 2026 (G131) AND WAS PLACED HERE, against
 * this docblock's own test: `normalisedDescriptions` identifies because each
 * enumerated value is one string the engine produced from one real row, and
 * `ObservedScopeValue.observedOn` names that row. It excludes every record not
 * carrying the value, which is exactly what `dispositionFamilies` cannot do and
 * why the classifier stayed out. This block said FOUR; it says five, and the
 * count is derivable — `IDENTIFYING_SCOPE_DIMENSIONS.length` — rather than
 * restated anywhere else.
 */
export const IDENTIFYING_SCOPE_DIMENSIONS = [
  'counterpartyIds',
  'documentTypeIds',
  'definitionIds',
  'solutionIds',
  'normalisedDescriptions',
] as const satisfies readonly (keyof LearningScope)[]

/**
 * THE CONTROL, MADE TO ASSERT SOMETHING. `HANDOFF` §5.6.
 *
 * Every refusal below is mechanical: it compares declared values against each
 * other, or against an answer the validator obtained ITSELF through
 * `NominationEvidence`. Nothing here is a judgement call, nothing passes because
 * a box was ticked, and — since 6 Aug — nothing passes because the caller said
 * so.
 */
export function validateNomination(input: {
  correctionKind: CorrectionKind
  hasAgentProposal: boolean
  reversalIndicts: boolean
  scope: LearningScope
  reason: LearningReasonCode
  destination: LearningDestination
  counterExample: CounterExample
  /** The disposition being generalised. Null where the destination names none. */
  preferredDispositionKey: string | null
  /** The store, held. Not four answers, handed. */
  evidence: NominationEvidence
}): { valid: true } | { valid: false; refusal: NominationRefusal } {
  const refuse = (refusal: NominationRefusal) => ({ valid: false as const, refusal })

  /* --- safety first, before anything about scope --- */
  if (
    input.correctionKind === 'admission_override' &&
    input.destination !== 'injection_corpus' &&
    input.destination !== 'statistic_only'
  ) {
    return refuse('safety_signal_misrouted')
  }
  if (!PERMITTED_DESTINATIONS[input.correctionKind].includes(input.destination)) {
    return refuse('destination_not_permitted_for_kind')
  }

  /* --- was anything actually corrected --- */
  if (input.correctionKind !== 'admission_override' && !input.hasAgentProposal) {
    return refuse('no_agent_proposal')
  }
  if (input.correctionKind === 'indicting_reversal' && !input.reversalIndicts) {
    return refuse('reversal_does_not_indict')
  }

  /* --- the reason must be coherent with the kind --- */
  if (!REASON_APPLIES_TO[input.reason].includes(input.correctionKind)) {
    return refuse('reason_not_applicable_to_kind')
  }

  /* --- the scope must be a claim, not a wish --- */
  /**
   * `ObservedLearningDimension<T>` is assignable to `LearningDimension<unknown>`
   * by construction, so the sixth dimension is counted, bounded and checked for
   * emptiness by the SAME loop as the other five. A separate loop for it would
   * be a second encoding of one rule, which is the shape that deleted
   * `ProcedureStep.secondApproverAbove`.
   */
  const dims: readonly LearningDimension<unknown>[] = [
    input.scope.counterpartyIds,
    input.scope.documentTypeIds,
    input.scope.definitionIds,
    input.scope.solutionIds,
    input.scope.dispositionFamilies,
    input.scope.normalisedDescriptions,
  ]
  let constrained = 0
  for (const d of dims) {
    if (d.kind === 'unconstrained') continue
    if (d.values.length === 0) return refuse('scope_dimension_empty')
    if (d.values.length > MAX_ENUMERATED_PER_DIMENSION) {
      return refuse('scope_cardinality_exceeded')
    }
    constrained += 1
  }
  if (constrained === 0) return refuse('scope_unbounded')

  /**
   * AND EVERY ENUMERATED DESCRIPTION MUST NAME THE ROW IT WAS SEEN ON. G131.
   *
   * EVERY value, not the first: a loop that returned after inspecting
   * `values[0]` would pass a nomination whose second description was typed from
   * memory, and typing plausible values is precisely the act this refusal
   * exists to catch.
   *
   * THE CHECK IS WIDENED PAST THE DECLARED TYPE ON PURPOSE. `observedOn` is
   * declared `ExceptionId | null`, so `undefined` is not in the type — but a
   * JSON body that omits the key produces exactly that, and this function is
   * the boundary between a wire payload and the model. An empty string is the
   * third shape: a branded id that points at no row. All three are the same
   * refusal, because all three mean the human named a value nobody can show was
   * ever displayed to them.
   */
  const descriptions = input.scope.normalisedDescriptions
  if (descriptions.kind === 'these') {
    for (const v of descriptions.values) {
      const observedOn: ExceptionId | null | undefined = v.observedOn
      if (observedOn === null || observedOn === undefined || observedOn === '') {
        return refuse('scope_value_lacks_provenance')
      }
    }
  }

  /**
   * AND AT LEAST ONE OF THEM MUST NAME INSTANCES. Binding only
   * `dispositionFamilies` excludes no exception in the tenant, so the count
   * above is satisfied by a scope that is unbounded in every sense a reader
   * cares about.
   */
  const identifyingBound = IDENTIFYING_SCOPE_DIMENSIONS.some(
    (k) => input.scope[k].kind === 'these',
  )
  if (!identifyingBound) return refuse('scope_lacks_identifying_dimension')

  /* --- the bound --- */
  if (input.counterExample.kind === 'named') {
    if (!input.evidence.counterExampleInScope(input.scope, input.counterExample.exceptionId)) {
      return refuse('counter_example_outside_scope')
    }
    if (
      !input.evidence.counterExampleContradicts(
        input.counterExample.exceptionId,
        input.preferredDispositionKey,
      )
    ) {
      return refuse('counter_example_does_not_contradict')
    }
  } else {
    /**
     * `none_exists` is falsifiable ONLY against a window worth searching. Both
     * checks were absent until 6 Aug: the two timestamps were collected, stored
     * on the nomination, shown to the approver, and read by nothing.
     */
    const { searchedFrom, searchedTo } = input.counterExample
    if (!(searchedFrom < searchedTo)) return refuse('search_window_invalid')
    if (!input.evidence.searchWindowIsAdequate(searchedFrom, searchedTo)) {
      return refuse('search_window_inadequate')
    }
    const contradicting = input.evidence.countContradictingInScope(
      input.scope,
      searchedFrom,
      searchedTo,
    )
    if (contradicting > 0) return refuse('contradicted_by_prior_resolution')
  }

  if (input.evidence.hasLiveEntryCovering(input.scope, input.preferredDispositionKey)) {
    return refuse('duplicate_of_live_entry')
  }

  return { valid: true }
}

/**
 * `distinctHolders: 2` is not enough, and this is why the check is a function.
 *
 * `ApprovalConfig.segregationOfDuties` is already vacuous against an agent
 * proposer — `approver !== proposer` is trivially true against
 * `ProposalActor.agent` (`HANDOFF` §4.1, §5.6) — so the existing SoD machinery
 * cannot be assumed to help. Here the risk runs the other way: the nominator
 * and the person who made the correction are USUALLY THE SAME PERSON, and
 * `distinctHolders: 2` compares the approver against one of them only.
 *
 * The approver must differ from BOTH, and must be a customer-org principal for
 * the reason `mayDecideAutonomyProposal()` gives (`policy.ts:1057`): this
 * changes what the tenant's system does unattended, and risk appetite belongs
 * to the party that answers for it. An FDE under a delivery grant and a partner
 * under a `PartnerAccessGrant` are both excluded, permanently.
 *
 * ⚠️ AND UNTIL 9 Aug 2026 IT NEVER ASKED WHETHER THE APPROVER MAY. G128 adds
 * `holdsPromoteLearning`, REQUIRED rather than optional-defaulting-true, so
 * every call site has to answer. The gap was visible in the file: the
 * `@dropped-for-v1` `mayRetractLearning()` twenty lines below already took the
 * same argument, so the act that WIDENS unattended behaviour was the one with
 * no capability check while the act that NARROWS it had one.
 *
 * THE CAPABILITY IS ASKED FIRST, and the order is deliberate rather than
 * incidental. Org class and self-approval both answer *which person*; the
 * capability answers *whether this is an act they may perform at all*, which is
 * the question `authorize()` needs settled before it can mint anything. A
 * refusal here is also the least informative one to return to a caller, which
 * is the right property for the outermost gate.
 *
 * WHAT THIS BOOLEAN IS NOT. It is not a substitute for `decide()` or
 * `authorize()` — those still run, and `CAPABILITY_RESOURCE_CLASS
 * .promote_learning = 'authority'` is what stops a delivery grant reaching the
 * act. This is the four-eyes gate refusing to consider an approver the access
 * evaluator has not cleared; `LEARNING_PROMOTION_REQUIREMENT.distinctHolders`
 * is the other half and applies to the pair, not to one call.
 */
export function mayPromoteLearning(input: {
  approver: UserId
  approverOrgClass: OrgClass
  nominatedBy: UserId
  correctedBy: UserId
  /**
   * Does this approver hold `promote_learning`? Required, and a boolean the
   * caller obtains from `decide()` rather than asserts — the argument
   * `mayRetractLearning()` already made with the identical field name.
   */
  holdsPromoteLearning: boolean
}): { permitted: true } | { permitted: false; refusal: NominationRefusal } {
  if (!input.holdsPromoteLearning) {
    return { permitted: false, refusal: 'promoter_lacks_capability' }
  }
  if (input.approverOrgClass !== 'customer') {
    return { permitted: false, refusal: 'approver_not_customer_org' }
  }
  if (input.approver === input.nominatedBy || input.approver === input.correctedBy) {
    return { permitted: false, refusal: 'self_approval' }
  }
  return { permitted: true }
}

/* ------------------------------------------------------------------ *
 * Undoing a learning
 * ------------------------------------------------------------------ */

/**
 * ADDED 6 Aug. Until then a promoted `LearningEntry` had a `status` field with
 * four values and NO VERB TO MOVE IT — a state machine with no transitions,
 * which is `HANDOFF` §5.5 (an invalid state the type makes legal) inverted: a
 * valid state the type makes unreachable.
 *
 * WHY UNDOING TAKES ONE PERSON WHERE PROMOTING TAKES TWO.
 *
 * Not an oversight and not a convenience. Promotion WIDENS what the system does
 * unattended; retraction NARROWS it. The rule this codebase already holds twice
 * — `recommendAutonomyCeiling()` and `purgeVerdict()` — is that narrowing is
 * automatic and widening is an act. Requiring a second approver to STOP a
 * learning would invert it, and would do so at the worst moment: the hour
 * somebody notices the system is behaving on a claim that is wrong.
 *
 * `mayPromoteLearning()` is therefore NOT reused here, and the asymmetry is the
 * point rather than a gap.
 */
/** @dropped-for-v1 7 Aug 2026 — retraction is unbuilt in v1; a wrong promotion is undone by hand. Declared, not built. */
export type LearningRetractionReason =
  /** The generalisation was wrong. The ordinary case. */
  | 'claim_falsified'
  /** True once, no longer — the counterparty changed, the pack changed. */
  | 'no_longer_holds'
  /** The originating exception or its counter-example was erased. */
  | 'evidence_erased'
  /** Superseded by a later entry covering the same scope. */
  | 'superseded'
  /** Withdrawn during review, before it had done anything. */
  | 'withdrawn_by_tenant'
  /**
   * Raised by the platform, not the tenant: the entry is implicated in a
   * contamination finding. See `widenIsBlockedByContamination()`.
   */
  | 'contamination_suspected'

/** @dropped-for-v1 7 Aug 2026 — retraction is unbuilt in v1; a wrong promotion is undone by hand. Declared, not built. */
export type RetractionRefusal =
  /** Already `expired` or `purged`. Nothing to stop. */
  | 'entry_not_live'
  /** Neither a customer-org principal nor platform staff raising contamination. */
  | 'actor_may_not_retract'
  /** `contamination_suspected` raised by a tenant principal. Not their call. */
  | 'reason_reserved_to_platform'

/**
 * SUSPEND IS REVERSIBLE AND TERMINAL RETRACTION IS NOT, and both stop the entry
 * being read. The split exists because "stop this now, decide later" is the act
 * somebody actually needs at three in the morning, and a single terminal verb
 * makes the cautious choice the expensive one.
 */
/** @dropped-for-v1 7 Aug 2026 — retraction is unbuilt in v1; a wrong promotion is undone by hand. Declared, not built. */
export type RetractionMode = 'suspend' | 'retract'

/**
 * THE HONEST LIMIT, STATED RATHER THAN IMPLIED.
 *
 * Retraction stops FUTURE reads of the entry. It does not reach what the entry
 * already caused. A learning promoted to `eval` was COPIED into a labelled case;
 * one promoted to `injection_corpus` was copied into the corpus. Those copies
 * are independent rows with their own provenance, and pulling them is a separate
 * act with a separate record.
 *
 * This is `EntitlementLease`'s limit in a second place — withdrawal stops future
 * draws, not live ones — and pass D recorded it as a limit rather than papering
 * it, which is the treatment it gets here. A `retractLearning()` that silently
 * left an eval case in place while reporting success would be worse than no verb
 * at all.
 */
/** @dropped-for-v1 7 Aug 2026 — retraction is unbuilt in v1; a wrong promotion is undone by hand. Declared, not built. */
export const RETRACTION_UNMAKES_DOWNSTREAM = false

/**
 * A retraction is a RECORD, not a mutation. The entry keeps its row and its
 * provenance; this names who stopped it, when, and why. An entry that reverted
 * by having its status overwritten would lose the one thing an auditor asks
 * after a bad learning: who caught it, and how long it ran.
 */
/** @dropped-for-v1 7 Aug 2026 — retraction is unbuilt in v1; a wrong promotion is undone by hand. Declared, not built. */
export interface LearningRetraction extends TenantScoped {
  /**
   * ADDED 7 Aug (G35). It records an act, and the act is deliberately REPEATABLE
   * against one entry — `suspend` then `retract` is the whole reason
   * `RetractionMode` exists, so `entryId` was never a key. It is also the row an
   * auditor reads after a bad learning ("who caught it, and how long it ran"),
   * and `RETRACTION_UNMAKES_DOWNSTREAM = false` means the separate act of pulling
   * an eval case has to be able to cite the retraction that prompted it.
   */
  id: LearningRetractionId
  entryId: LearningEntryId
  mode: RetractionMode
  reason: LearningRetractionReason
  retractedBy: UserId
  retractedAt: Timestamp
  /** Set only where a later entry replaced this one. */
  supersededBy: LearningEntryId | null
  /**
   * Carries the grant minted by `authorize()`, like every other act that
   * changes behaviour. Invariant 10: an act with no authorisation is
   * unrecordable. Never null — there is no `system` path to a retraction,
   * because `contamination_suspected` is still raised by a named person.
   */
  authorizationId: AuthorizationGrantId
}

/**
 * One actor, and the capability is `promote_learning` — the same verb, because
 * the resource is the same and `CAPABILITY_RESOURCE_CLASS` is keyed by
 * capability rather than by direction. A separate `retract_learning` member was
 * considered and refused: adding a capability is a platform release, and
 * "stopping feels like it should be separate" is the argument
 * `SOLUTION_CONTAINER_CAPABILITY` already rejected for install/upgrade/disable
 * (§11.11). If an access review ever needs to distinguish them, `RetractionMode`
 * is on the record.
 */
/** @dropped-for-v1 7 Aug 2026 — retraction is unbuilt in v1; a wrong promotion is undone by hand. Declared, not built. */
export function mayRetractLearning(input: {
  actor: UserId
  actorOrgClass: OrgClass
  holdsPromoteLearning: boolean
  entryStatus: LearningEntry['status']
  reason: LearningRetractionReason
}): { permitted: true } | { permitted: false; refusal: RetractionRefusal } {
  if (input.entryStatus === 'expired' || input.entryStatus === 'purged') {
    return { permitted: false, refusal: 'entry_not_live' }
  }
  if (input.reason === 'contamination_suspected') {
    /**
     * The one reason a platform principal may raise, and the one a tenant may
     * not. A tenant asserting contamination about its own eval history would be
     * asserting something it cannot observe; a platform principal asserting any
     * OTHER reason would be deciding what the tenant's system should believe,
     * which `mayPromoteLearning()` excludes them from permanently.
     */
    if (input.actorOrgClass !== 'platform') {
      return { permitted: false, refusal: 'reason_reserved_to_platform' }
    }
    return { permitted: true }
  }
  if (input.actorOrgClass !== 'customer' || !input.holdsPromoteLearning) {
    return { permitted: false, refusal: 'actor_may_not_retract' }
  }
  return { permitted: true }
}

/**
 * The nomination. ONE ROW, TWO ACTS — the shape `AutonomyProposal` and
 * `AutonomyRecommendation.decision` already use (`policy.ts:867,1022`) rather
 * than a second `ApprovalDecision`-style table keyed to it.
 *
 * AN UNPROMOTED NOMINATION CHANGES NOTHING, and the guarantee is structural
 * rather than checked: no retrieval function reads a nomination. It reads
 * `LearningEntry`, and only promotion mints one. That is the property
 * `AutonomyProposal` states as its third — "a proposal is never consulted at
 * evaluation time, which is a stronger guarantee than any check could be".
 */
export interface LearningNomination extends TenantScoped {
  id: LearningNominationId
  /* --- what is being generalised. All references; no copies. --- */
  exceptionId: ExceptionId
  proposalId: ProposalId | null
  correctionKind: CorrectionKind
  /** The human whose act was the correction. May equal `nominatedBy`. */
  correctedBy: UserId

  /* --- what the human supplied beyond assent --- */
  scope: LearningScope
  reason: LearningReasonCode
  counterExample: CounterExample
  /** Exactly one. See `EVAL_AND_MEMORY_ARE_EXCLUSIVE`. */
  destination: LearningDestination

  nominatedBy: UserId
  nominatedAt: Timestamp

  /* --- the second act --- */
  /** Null while pending. An unanswered nomination lapses; see `lapsesAt`. */
  outcome: LearningNominationOutcome | null
  /**
   * "An offer that stands forever is a standing authority nobody granted"
   * (`policy.ts`, on `AutonomyProposal`). Required, never null.
   */
  lapsesAt: Timestamp
}

export interface LearningNominationOutcome {
  decision: 'promoted' | 'refused' | 'lapsed'
  decidedBy: UserId | null
  decidedAt: Timestamp
  /** Required on `refused`, and drawn from the closed set. Never prose. */
  refusal: NominationRefusal | null
  /** Set on `promoted`. The artefact this act minted. */
  mintedEntryId: LearningEntryId | null
}

/**
 * WHAT THE APPROVER SEES, and it is the reason the second pair of eyes is worth
 * having rather than a second stamp.
 *
 * The nominator supplies a claim. The SYSTEM supplies the evidence against it —
 * every resolved exception inside the nominated scope whose disposition
 * contradicts the claim, counted, with a bounded sample of ids. Without this
 * the approver reads the nominator's assertion and agrees with it, which is
 * `HANDOFF` §5.6 with two names on it instead of one.
 *
 * COUNTS AND IDS ONLY. Rendering this view is a `tenant_data` read under the
 * approver's own scope, so it produces a `DataAccessEvent` like any other; it
 * is not a privileged summary.
 */
export interface NominationReview {
  /**
   * ADDED 7 Aug (G35). `computedAt` is what makes it an entity rather than a
   * view: this is EVIDENCE AS OF A MOMENT, and it moves — the contradicting
   * count changes as exceptions resolve. The approver approved against one
   * computation, and if the promotion is later questioned the question is what
   * they were shown, not what the query returns today. Rendering it is a
   * `tenant_data` read that already emits a `DataAccessEvent`; that event should
   * be able to name the review it produced.
   */
  id: NominationReviewId
  nominationId: LearningNominationId
  /** In-scope resolved exceptions agreeing with the claim. */
  supportingCount: number
  /** In-scope resolved exceptions contradicting it. THE NUMBER THAT MATTERS. */
  contradictingCount: number
  /** Bounded sample, for the approver to open. Ids, never values. */
  contradictingSample: readonly ExceptionId[]
  /** Live entries whose scope overlaps. Duplicate detection, shown not inferred. */
  overlappingEntryIds: readonly LearningEntryId[]
  /** Highest classification among the exceptions this learning derives from. */
  derivedFromMaxClass: DataClass
  computedAt: Timestamp
}

/* ================================================================== *
 * 3. The entry — what is genuinely new, and nothing else
 * ================================================================== */

/**
 * The durable learning. NOTE WHAT IS ABSENT — there is no `text`, no
 * `instruction`, no `note`, no `summary`. See decision 2 in the file header.
 *
 * What it holds that nothing else in the model holds: a human's assertion that
 * a scope of cases should be dispositioned a particular way, bounded by a
 * counter-example, promoted by a second person, and expiring.
 *
 * `gateIds` IS ALSO ABSENT, DELIBERATELY. `SolutionPack.gateIds` let a pack
 * name its own examiner, which is why `PlatformAgentEvalFloor` is a floor the
 * pack cannot see (`agents.ts:925`). A tenant learning must likewise not be
 * able to name what measures it.
 */
export interface LearningEntry extends TenantScoped {
  id: LearningEntryId
  /** The act that minted it. The chain terminates in two named humans. */
  nominationId: LearningNominationId
  destination: LearningDestination
  scope: LearningScope
  reason: LearningReasonCode
  /**
   * From the pack's closed disposition list, inside a family the archetype
   * allows — the same constraint `ResolutionProposal.dispositionKey` carries.
   * Null on a `configuration` or `eval` destination, which names no preference.
   */
  preferredDispositionKey: string | null
  /** The bound. An entry whose counter-example is erased is purged; see §7. */
  counterExample: CounterExample

  /**
   * Derived, never declared. `classifyLearning()` is the only writer.
   * Invariant 4: classification is declared once on `FieldSpec` and everything
   * derives from it — including this.
   */
  dataClass: DataClass

  status: 'active' | 'suspended' | 'expired' | 'purged'
  /**
   * REQUIRED, NEVER NULL. A learning that never expires is a standing widening
   * nobody re-approved — `PartnerAccessGrant`'s rule ("an open-ended grant is
   * not a grant") applied to behaviour rather than to access.
   *
   * MUST BE AT OR BEFORE the originating exception's retention horizon. A
   * learning you cannot audit back to its evidence is a learning you cannot
   * defend, and `purgeVerdict()` will remove the evidence on schedule whether
   * or not this row remembers.
   */
  effectiveUntil: Timestamp
  promotedAt: Timestamp
}

/* ------------------------------------------------------------------ *
 * The graph — an index, not a store
 * ------------------------------------------------------------------ */

/**
 * A node is a REFERENCE to something that already exists. There is no node
 * table, no node payload and no node property bag.
 *
 * This is the whole answer to "knowledge graph". A property graph with
 * free-form node attributes would be a second content store: its own
 * classification problem, its own retention rule, its own erasure gap, and —
 * because attributes are strings — its own path for an injected instruction to
 * reach a prompt. Every node here is a branded id whose classification,
 * retention and erasure are already decided by the entity it names.
 */
/** @dropped-for-v1 7 Aug 2026 — the knowledge graph has zero call sites and no screen in v1. Declared, not built. */
export type GraphNodeRef =
  | { kind: 'counterparty'; id: CounterpartyId }
  | { kind: 'document_type'; id: DocumentTypeId }
  | { kind: 'definition'; id: DefinitionId }
  | { kind: 'solution'; id: SolutionId }
  | { kind: 'disposition_family'; family: DispositionFamily }
  | { kind: 'exception'; id: ExceptionId }
  | { kind: 'learning'; id: LearningEntryId }

/** Closed. A pack may not add one, exactly as it may not add a step kind. */
/** @dropped-for-v1 7 Aug 2026 — the knowledge graph has zero call sites and no screen in v1. Declared, not built. */
export type EdgeKind =
  /** This learning applies to this node. Written from `LearningScope`. */
  | 'applies_to'
  /** This exception is the counter-example bounding this learning. */
  | 'bounded_by'
  /** This learning derives from this exception. Erasure follows this edge. */
  | 'derived_from'
  /** Two learnings whose scopes overlap and whose dispositions differ. */
  | 'contradicts'
  /** This learning replaced that one on re-nomination. */
  | 'supersedes'

/**
 * DERIVABLE, AND THAT IS THE POINT. Every edge is computable from
 * `LearningEntry.scope`, `.counterExample` and `.nominationId`. The table is an
 * index for the reverse query — *which learnings touch this counterparty* —
 * which erasure and audit both need and which a scan of JSON scopes answers
 * badly.
 *
 * Because it is derivable it carries NO independent retention and NO
 * independent classification: rebuild it and it is correct. A derived index
 * with its own lifecycle is a second copy that can disagree with the fact,
 * which is the argument `User.isStaff` was deleted on (`domain.ts:~888`).
 *
 * ⚠️ NO `id`, DELIBERATELY, AND THE CLASSIFICATION'S STATED REASON IS THE WRONG
 * ONE. `docs/identity-classification.md` files this as a value object because it
 * "carries no timestamp", and then flags itself: a learned edge that cannot be
 * aged, audited or retracted by date looks like a gap rather than a value object.
 *
 * The slice-5 finding, recorded here rather than acted on. THE TIMESTAMP IS NOT
 * THE ARGUMENT EITHER WAY. This is the one interface among the fifty-five whose
 * defining property is that it is DERIVED — every field is computable from
 * `LearningEntry.scope`, `.counterExample` and `.nominationId`, `entryId` is
 * stated as the thing whose deletion deletes the edge, and the retention table at
 * `learning.ts:~1479` already says "NO RETENTION OF ITS OWN. Derived;
 * rebuildable". Ageing follows the entry. Retraction follows the entry
 * (`LearningRetraction` now has an id of its own, and it is keyed to `entryId`).
 * Audit follows the entry. None of the three questions the classification worries
 * about is answered by giving the INDEX an address; they are answered by the row
 * the index is built from, which has one.
 *
 * So: correct verdict, wrong reason, and a wrong reason is worth fixing because
 * the next reader applies it. What WOULD change the verdict is a decision to stop
 * rebuilding this table on demand — a materialised graph that survives its source
 * is no longer derived, and at that point it needs `derivedAt`, its own retention,
 * and an id, in that order. G35 was not asked that question and this slice did not
 * answer it. Adding an id here silently would have reversed an adjudicated
 * classification by stealth, which is why it did not happen.
 */
/** @dropped-for-v1 7 Aug 2026 — the knowledge graph has zero call sites and no screen in v1. Declared, not built. */
export interface KnowledgeEdge extends TenantScoped {
  from: GraphNodeRef
  to: GraphNodeRef
  kind: EdgeKind
  /** The entry that justifies this edge. Deleting it deletes the edge. */
  entryId: LearningEntryId
}

/* ================================================================== *
 * 4. Distillation — who, and why it is not an agent
 * ================================================================== */

/**
 * NO AGENT PRODUCES A DURABLE LEARNING. Stated as a constant so that changing
 * it is a diff somebody reviews, in the manner of `AGENTS_HOLD_ROLES` and
 * `SOLUTION_IS_GRANTABLE` (`access.ts:1930,1971`).
 *
 * THE ARGUMENT, AND WHY THE EXISTING RULE IS NOT ENOUGH.
 *
 * `HANDOFF` §3 pass A: "an admitting agent carries no tools", because the agent
 * that admits must not be induced by injected text into admitting itself. The
 * analogous property for a distiller is STRICTLY STRONGER and removing tools
 * does not supply it: A DISTILLER'S OUTPUT IS ITSELF THE INSTRUMENT. Its input
 * includes admitted counterparty prose (residual R1: the admitted message
 * reaches the resolution agent verbatim); its output is read by a later model
 * holding that tenant's connection credentials. Stripping its tools leaves the
 * trifecta intact, because the third leg was never a tool call — it was the
 * text it wrote.
 *
 * D5 PUTS A HUMAN IN THE PATH. IS THAT SUFFICIENT? NO, and the distinction
 * matters: a human who nominates asserts A CLAIM ("this generalises to these
 * counterparties, for this reason, except here"). A human who reads an agent's
 * generated paragraph and clicks approve asserts nothing — that is the rubber
 * stamp D5(i) names, wearing an LLM. Nomination is sufficient for the CLAIM and
 * insufficient for the TEXT.
 *
 * SO THERE IS NO TEXT. Distillation is deterministic and total: nomination
 * fields map to entry fields, one for one, in `distil()` below. The prose a
 * model eventually reads is rendered from the entry at assembly time, from a
 * template the tenant does not author.
 *
 * WHAT AN AGENT MAY DO, if anyone builds it, and it is NOT in v1: SUGGEST which
 * ids to enumerate, from the closed set of ids the exception itself references,
 * under an `OutputContract` of `structured_fields` and never `narrative`
 * (`agents.ts:542`). It proposes a subset of a set the human can see. Rejected
 * suggestions are not stored. It still may not write the reason code, because a
 * reason is a claim.
 */
/** @dropped-for-v1 7 Aug 2026 — distillation is unbuilt in v1, so the refusal has nothing to refuse yet. Declared, not built. */
export const AGENT_MAY_DISTIL = false

/**
 * Deterministic distillation. Total, pure, and boring on purpose.
 *
 * It is a function rather than a service because there is nothing to decide:
 * every field of the entry is either copied from the nomination or computed by
 * `classifyLearning()`. If this ever needs a model, the design has drifted.
 */
/** @dropped-for-v1 7 Aug 2026 — distillation is unbuilt in v1. Declared, not built. */
export function distil(input: {
  nomination: LearningNomination
  entryId: LearningEntryId
  promotedAt: Timestamp
  effectiveUntil: Timestamp
  /** From the correction. Null where the correction named no disposition. */
  preferredDispositionKey: string | null
  /** Classes of the exceptions this derives from. See `classifyLearning()`. */
  derivedFromClasses: readonly DataClass[]
}): LearningEntry {
  const { nomination } = input
  return {
    tenantId: nomination.tenantId,
    id: input.entryId,
    nominationId: nomination.id,
    destination: nomination.destination,
    scope: nomination.scope,
    reason: nomination.reason,
    preferredDispositionKey: input.preferredDispositionKey,
    counterExample: nomination.counterExample,
    dataClass: classifyLearning(input.derivedFromClasses),
    status: 'active',
    effectiveUntil: input.effectiveUntil,
    promotedAt: input.promotedAt,
  }
}

/* ================================================================== *
 * 5. What may cross the tenant boundary — D4's closed vocabulary
 * ================================================================== */

/**
 * D4, in the user's own words: "Needs a closed vocabulary for what may cross,
 * or it degrades into content within weeks." This is that vocabulary, as a
 * type. The degradation it prevents has already happened once in this
 * repository — `HANDOFF` §6, `PolicyEvaluation.reason`.
 *
 * THE MECHANISM IS ABSENCE OF A PLACE TO PUT CONTENT. A field typed to a closed
 * union cannot hold a counterparty name. `AssertContentless` below makes that
 * mechanical rather than cultural: adding `note: string`, or any branded id, is
 * a COMPILE ERROR — `string` does not extend a literal union, and neither does
 * `Id<'Exception'>`.
 */
/** @dropped-for-v1 7 Aug 2026 — nothing crosses the tenant boundary in v1 — the platform learns nothing. Declared, not built. */
export type CrossBoundaryScalar =
  | number
  | null
  | ReconciliationArchetype
  | DispositionFamily
  | CorrectionKind
  | LearningReasonCode
  | LearningDestination
  | NominationRefusal
  | AcquisitionFidelity
  | 'not_nominated'
  | 'nominated'
  | 'promoted'
  | 'refused'
  | 'lapsed'

type Contentless<T> = {
  readonly [K in keyof T]: T[K] extends CrossBoundaryScalar ? T[K] : never
}
/** A compile-time assertion. `type _ = AssertContentless<X>` fails if X is not. */
/** @dropped-for-v1 7 Aug 2026 — guards a cross-boundary path v1 does not open. Declared, not built. */
export type AssertContentless<T extends Contentless<T>> = T

/**
 * The key. Every member is a PLATFORM vocabulary.
 *
 * `dispositionFamily` is safe because families belong to the ARCHETYPE
 * (`domain.ts:1390`) and are defined by us. `dispositionKey` is NOT and is
 * absent: pack-authored keys may come from a partner-authored pack
 * (`SolutionPack.authoredBy: PartnerId | null`), so a key can be somebody's
 * customer-facing vocabulary.
 *
 * ALSO ABSENT AND EACH FOR A STATED REASON: no `tenantId` (it is the boundary),
 * no `definitionId` (tenant-authored, and its NAME is customer configuration),
 * no `counterpartyId`, no `Money` (spend and rate invert to volume —
 * `governance.ts` on the `metering` class), no `FieldPath`, no timestamp
 * finer than the window, no id of any kind.
 */
/** @dropped-for-v1 7 Aug 2026 — nothing crosses the tenant boundary in v1. Declared, not built. */
export interface SignalKey {
  readonly archetype: ReconciliationArchetype
  readonly dispositionFamily: DispositionFamily
  readonly correctionKind: CorrectionKind
  readonly acquisitionFidelity: AcquisitionFidelity
  readonly nominationOutcome:
    | 'not_nominated'
    | 'nominated'
    | 'promoted'
    | 'refused'
    | 'lapsed'
  readonly reason: LearningReasonCode | null
  readonly refusal: NominationRefusal | null
  readonly destination: LearningDestination | null
}

/** The measure. Counts and durations. Nothing that inverts to an identity. */
/** @dropped-for-v1 7 Aug 2026 — nothing crosses the tenant boundary in v1. Declared, not built. */
export interface SignalMeasure {
  readonly occurrences: number
  readonly distinctTenants: number
  readonly medianSecondsToCorrect: number | null
  readonly medianSecondsToPromote: number | null
}

/** @dropped-for-v1 7 Aug 2026 — the compile-time proof of a dropped type. Declared, not built. */
export type _SignalKeyIsContentless = AssertContentless<SignalKey>
/** @dropped-for-v1 7 Aug 2026 — the compile-time proof of a dropped type. Declared, not built. */
export type _SignalMeasureIsContentless = AssertContentless<SignalMeasure>

/**
 * What actually crosses. The window is separate and argued separately: two
 * timestamps are not content, and the weekly floor below bounds their
 * resolution, but they are `string` and would defeat the guard — so they sit
 * outside it rather than weakening it.
 */
/** @dropped-for-v1 7 Aug 2026 — nothing crosses the tenant boundary in v1. Declared, not built. */
export interface CrossBoundarySignal {
  readonly windowFrom: Timestamp
  readonly windowTo: Timestamp
  readonly key: SignalKey
  readonly measure: SignalMeasure
}

/**
 * THE BACK DOOR D4 ASKS ABOUT, CLOSED THREE WAYS.
 *
 * "What stops the statistics becoming a back door around the nomination gate?"
 *
 *   1. NOWHERE TO PUT CONTENT. `AssertContentless` above, checked by the
 *      compiler on every build.
 *   2. A COHORT FLOOR, REUSED NOT REINVENTED. `AGGREGATE_COHORT_FLOOR = 5` and
 *      `aggregateIsDisclosable()` already exist in `billing.ts:745,754` for the
 *      identical problem — a cross-tenant aggregate over too few tenants is a
 *      single tenant's data with a mean sign in front of it. Plus the weekly
 *      window floor (`docs/access-and-agency.md` §10.8).
 *   3. NO RETURN PATH. The aggregate goes UP to the control plane, and
 *      invariant 3 says the control plane publishes downward and never reads
 *      tenant data. Nothing derived from it is retrievable at inference time in
 *      any tenant, so it cannot steer behaviour anywhere — which is exactly
 *      what "the platform learns only from contentless statistics" has to mean
 *      if it is to mean anything.
 *
 * The third is the one an attacker would probe, so it is a constant.
 */
/** @dropped-for-v1 7 Aug 2026 — asserts a property of a cross-boundary path v1 does not open. Declared, not built. */
export const AGGREGATE_INFORMS_INFERENCE = false

/**
 * NON-NOMINATED CORRECTIONS DO CONTRIBUTE, AND ONLY HERE.
 *
 * D4 permits it; D5 requires that it teach nothing about behaviour. Both hold:
 * an un-nominated correction increments `occurrences` against a `SignalKey`
 * with `nominationOutcome: 'not_nominated'`, and there is no path from that
 * counter to a `LearningEntry`, to a prompt, or back into the tenant.
 *
 * It is worth having because the ratio is the product signal: a disposition
 * family corrected constantly and nominated never is a PACK defect, and it is
 * invisible from inside any single tenant.
 */
/** @dropped-for-v1 7 Aug 2026 — asserts a property of a cross-boundary path v1 does not open. Declared, not built. */
export const NON_NOMINATED_CORRECTIONS_CONTRIBUTE_STATISTICS = true

/* ================================================================== *
 * 6. Classification — invariant 4, at the place it leaks
 * ================================================================== */

/**
 * There is no `DataClass` ordering anywhere in `model/` — verified by grep,
 * 6 Aug 2026. Four modules compare classes against ceilings
 * (`maxDataClassInPrompt`, `maxDataClassInSpanAttributes`, the outbound
 * ceiling, the notification ceiling) and each does it locally. That is
 * `HANDOFF` §5.3 waiting to happen; the rank belongs in one place.
 */
/** @dropped-for-v1 7 Aug 2026 — the learning-path derivation of invariant 4; R5’s compensating control is owed. Declared, not built. */
export const DATA_CLASS_RANK: Record<DataClass, number> = {
  public: 0,
  internal: 1,
  personal: 2,
  sensitive_personal: 3,
}

/**
 * A LEARNING IS NEVER CLASSIFIED BELOW ANY INPUT IT DERIVES FROM.
 *
 * The honest version of "the maximum of its inputs", with the part that is
 * usually left out. Derivation is where classification leaks precisely because
 * the derived thing LOOKS harmless: this entry holds ids and enum members and
 * not one extracted value, and the tempting rule is to classify it `internal`
 * on that basis. That rule is wrong, because the entry POINTS AT the records it
 * came from and a pointer to a person is data about that person.
 *
 * WHAT THIS DOES NOT SOLVE, stated rather than papered over. Max-of-inputs is
 * not sufficient against the mosaic: many entries each classified `internal`,
 * read together, can identify. `MAX_ENUMERATED_PER_DIMENSION` and the
 * counter-example requirement bound the shape but do not close it. Recorded as
 * an open residual, in the manner of R4 in
 * `docs/prompt-injection-posture.md` §6 — accepted and named, not solved.
 */
/** @dropped-for-v1 7 Aug 2026 — the learning-path derivation of invariant 4; R5’s compensating control is owed. Declared, not built. */
export function classifyLearning(inputs: readonly DataClass[]): DataClass {
  let rank = DATA_CLASS_RANK.internal
  let cls: DataClass = 'internal'
  for (const input of inputs) {
    const r = DATA_CLASS_RANK[input]
    if (r > rank) {
      rank = r
      cls = input
    }
  }
  return cls
}

/**
 * There is no downgrade path, and its absence is the control.
 *
 * A function that lowered a learning's class on the argument that "aggregation
 * anonymises" would be the single most useful function to an attacker in this
 * module. It is not omitted by oversight.
 */
/** @dropped-for-v1 7 Aug 2026 — asserts a property of a derivation v1 does not run. Declared, not built. */
export const LEARNING_CLASS_MAY_BE_LOWERED = false

/* ================================================================== *
 * 7. Retention and erasure
 * ================================================================== */

/**
 * RECORD KIND, NOT STORAGE TIER (`HANDOFF` §3 pass F). Two kinds here, and NO
 * new `RetentionPolicy` field — which is the point, because both already exist.
 *
 *   `LearningNomination`  AUDIT KIND. It records a human authority act: who
 *                         claimed a behaviour should generalise and who agreed.
 *                         `RetentionClass` `'audit_event'`. Deleting it deletes
 *                         the evidence of who widened the system.
 *   `LearningEntry`       EXCEPTION KIND. It is a derived business record of the
 *                         same class as an `Explanation`.
 *                         `RetentionClass` `'exception'`, further bounded by
 *                         `effectiveUntil`.
 *   `KnowledgeEdge`       NO RETENTION OF ITS OWN. Derived; rebuildable.
 *
 * `effectiveUntil` binding first is deliberate: the entry must not outlive the
 * exception it derives from, or the audit question "on what evidence" has no
 * answer while the behaviour it caused is still live.
 *
 * ⚠️ RE-POINTED 7 Aug 2026 AND STILL TRUE. This named the FIELDS
 * `RetentionPolicy.auditDays` and `.exceptionDays`, which stopped existing when
 * `RetentionPolicy` was re-keyed on `RetentionClass`. It now names the two
 * classes instead — the claim is unchanged, and the point of the section is
 * unchanged: learning needs NO new retention window, because both windows
 * already exist. The re-key strengthens that, since `RetentionClass` is the
 * extensible set the argument was implicitly assuming.
 */
/** @dropped-for-v1 7 Aug 2026 — learning retention and erasure are unbuilt in v1. Declared, not built. */
export type LearningRecordKind = 'nomination' | 'entry'

/**
 * @dropped-for-v1 7 Aug 2026 — learning retention and erasure are unbuilt in v1. Declared, not built.
 *
 * Typed as `RetentionClass` rather than as a local string union, so that a
 * future rename of a class reaches this table instead of leaving it pointing at
 * a member that no longer exists — which is exactly what the field-named
 * version did.
 */
export const RETENTION_CLASS_FOR: Record<LearningRecordKind, RetentionClass> = {
  nomination: 'audit_event',
  entry: 'exception',
}

/**
 * THE MODEL DELTA THIS SECTION REQUIRES, and without it erasure silently misses
 * a copy.
 *
 * `SubjectLocation` (`governance.ts:1365`) is a closed union of "every place a
 * subject's personal data can come to rest", "written at CREATION time, not
 * discovered by scanning". It has ten variants and NONE of them is a learning.
 * The `blob` and `notification` variants were both added for exactly this
 * failure — a copy in a channel nobody was indexing — and the same wording
 * applies here.
 *
 * Merge this into the union in `governance.ts`; it is defined here only so the
 * proposal is self-contained.
 */
/** @dropped-for-v1 7 Aug 2026 — learning retention and erasure are unbuilt in v1. Declared, not built. */
export type LearningSubjectLocation =
  | {
      kind: 'learning_scope_node'
      learningEntryId: LearningEntryId
      /** Which dimension named the subject. Erasure edits that list. */
      dimension: 'counterparty' | 'definition' | 'solution' | 'document_type'
    }
  | { kind: 'learning_counter_example'; learningEntryId: LearningEntryId }

/**
 * WHAT HAPPENS TO A LEARNING WHEN ITS SUBJECT IS ERASED.
 *
 * NEITHER "erased" NOR "never personal data" IS THE ANSWER. It depends on HOW
 * the subject appears, and there are exactly two ways.
 *
 * SCOPE MEMBER → REMOVE THE MEMBER. Deleting one id from a `these` list makes
 * the learning apply to FEWER cases. That is a NARROWING, and narrowing is
 * automatic (`HANDOFF` §3 pass A). If the dimension empties, the learning binds
 * on nothing and is purged. THIS IS WHY `LearningDimension` HAS NO `all`: under
 * `all` there is no member to remove, and erasure would have to either leave
 * the subject's influence in place or destroy an unrelated learning. Polarity
 * chosen in §2 pays here, and would have been unfixable later.
 *
 * COUNTER-EXAMPLE → PURGE THE WHOLE ENTRY. The counter-example is a BOUND.
 * Removing it WIDENS the learning, and an erasure request that widens what the
 * system does unattended is the worst outcome available. Suspending pending
 * re-nomination is rejected too: it leaves a widening one click away, held by
 * whoever notices the suspended row. Purge, and let the tenant re-nominate with
 * a bound that does not name an erased person.
 *
 * NOTE WHAT IS NOT CLAIMED. The rendered sentence a model saw in a past
 * inference is gone with its context window, but any TRACE that captured it is
 * `out_of_reach` in the honest sense `ErasurePlanItem` already means
 * (`governance.ts:1508`).
 */
/** @dropped-for-v1 7 Aug 2026 — learning retention and erasure are unbuilt in v1. Declared, not built. */
export function erasureDispositionFor(
  location: LearningSubjectLocation,
): 'narrow_scope' | 'purge_entry' {
  return location.kind === 'learning_counter_example' ? 'purge_entry' : 'narrow_scope'
}

/* ================================================================== *
 * 8. Metering — two meters, and one of them is a stock
 * ================================================================== */

/**
 * DELTA TO `METERS` AND `METER_AGGREGATION` (`billing.ts:41,69`). Both are
 * total records, so adding a member is a compile error until the aggregation is
 * decided — which is the correct shape and the reason `METER_AGGREGATION`
 * exists at all.
 *
 *   `learning_entries_stored`   A STOCK. The number of live entries, sampled.
 *                               `average`. Summed daily it over-reports 30x and
 *                               hourly 720x — the exact failure `storage_gb_month`
 *                               is annotated with as "the one stock meter".
 *                               It is about to be the second.
 *   `learning_retrievals`       A FLOW. `sum`.
 *
 * ⚠️ `learning_retrievals` MUST NOT BE PRICED IN V1, and the reason is
 * arithmetic rather than commercial. A retrieval places a rendered learning
 * into a prompt, and those tokens are ALREADY counted by `input_tokens`.
 * Pricing both bills the same consumption twice. It is worth METERING because
 * `UsageRecord` is unpriced by construction (invariant 5) — a meter is a fact,
 * money is derived — and "how often is memory actually used" is the question
 * that decides whether this feature earns its governance cost.
 *
 * NOMINATION IS NOT METERED. Billing a customer for operating a control is how
 * you get a customer who stops operating it.
 *
 * `UsageRecord.authorizationId` is non-null on a retrieval: it happens inside a
 * `ProcedureStepExecution` under a `DerivedAgentGrant`, so invariant 10 holds
 * without special handling.
 */
/** @dropped-for-v1 7 Aug 2026 — proposed, never priced — and v1 prices nothing. Declared, not built. */
export const PROPOSED_METERS = {
  learningEntriesStored: 'learning_entries_stored',
  learningRetrievals: 'learning_retrievals',
} as const
/** @dropped-for-v1 7 Aug 2026 — proposed, never priced — and v1 prices nothing. Declared, not built. */
export type ProposedMeter =
  (typeof PROPOSED_METERS)[keyof typeof PROPOSED_METERS]

/** @dropped-for-v1 7 Aug 2026 — proposed, never priced — and v1 prices nothing. Declared, not built. */
export const PROPOSED_METER_AGGREGATION: Record<
  ProposedMeter,
  'sum' | 'average' | 'peak'
> = {
  learning_entries_stored: 'average',
  learning_retrievals: 'sum',
}

/** Facts, not money. Recorded so the double-count argument survives review. */
/** @dropped-for-v1 7 Aug 2026 — proposed, never priced — and v1 prices nothing. Declared, not built. */
export const PROPOSED_METER_PRICED_IN_V1: Record<ProposedMeter, boolean> = {
  learning_entries_stored: false,
  learning_retrievals: false,
}

/* ================================================================== *
 * 9. The self-confirming loop — the finding, and the delta that closes it
 * ================================================================== */

/**
 * MEMORY MANUFACTURES THE EVIDENCE THAT WIDENS ITS OWN AUTONOMY. This is the
 * sharpest thing in the proposal and it is a live defect in
 * `recommendAutonomyCeiling()` the moment memory exists.
 *
 * THE MECHANISM, step by step, all in existing code:
 *
 *   1. `AutonomyDials.reversalRate` is "the honest measure of verifiability"
 *      (`policy.ts:800`) and counts only reversals where
 *      `reversalIndictsAutonomy()` holds.
 *   2. A memory entry steers the agent toward the disposition a human already
 *      chose in similar cases.
 *   3. Humans therefore reverse it less. `reversalRate` falls below
 *      `MAX_REVERSAL_RATE_TO_WIDEN = 0.02` (`policy.ts:834`).
 *   4. `recommendAutonomyCeiling()` widens the ceiling one rung, with basis
 *      `stable_and_low_risk`.
 *
 * Nothing in that chain is a bug. Every step is the code working. And the
 * conclusion is false: the agent did not become more verifiable, it became more
 * CONFORMANT to prior human choices — including the wrong ones, which are now
 * invisible because the system reproduces them and nobody reverses what they
 * already decided. The measurement lost its independence and the type system
 * cannot see it.
 *
 * CONTRAST WITH EVALS, which is why the destination distinction is not
 * cosmetic. A correction feeding an `ObservedExample` is measured AGAINST
 * independent human ground truth: performance is scored on cases the agent did
 * not author. A correction feeding memory is measured against an outcome it
 * caused. Self-correcting versus self-confirming, and the difference is
 * whether the denominator is independent of the treatment.
 *
 * THE FIX, and it is small:
 *
 *   a. `ResolutionProposal` gains `influencedBy: LearningEntryId[]` — the right
 *      home, because a learning influences the PROPOSAL, not the resolution,
 *      and it is known at proposal time. It also gives provenance: *which
 *      learning steered this*, which nothing else can answer.
 *   b. `AutonomyDials` gains `learningInfluencedShare: number` (0..1).
 *   c. `RecommendationBasis` gains `'sample_not_independent'`.
 *   d. `recommendAutonomyCeiling()` refuses to WIDEN when that share exceeds
 *      `MAX_LEARNING_INFLUENCE_TO_WIDEN`. It still NARROWS freely — narrowing
 *      is automatic, and a contaminated sample showing harm is still showing
 *      harm.
 *
 * The asymmetry in (d) is the same one the function already has and is the
 * reason it is safe to bolt on: evidence of harm acts on a thin sample,
 * evidence of safety needs a thick and now an INDEPENDENT one.
 */
/** @dropped-for-v1 7 Aug 2026 — reads a learning influence figure v1 does not compute. Declared, not built. */
export const MAX_LEARNING_INFLUENCE_TO_WIDEN = 0.1

/**
 * The proposed guard, written out so the delta is reviewable rather than
 * described. Intended to run immediately before the widening branch of
 * `recommendAutonomyCeiling()` (`policy.ts:896`), after the narrowing branch.
 */
/** @dropped-for-v1 7 Aug 2026 — reads MAX_LEARNING_INFLUENCE_TO_WIDEN, which v1 does not compute. Declared, not built. */
export function widenIsBlockedByContamination(
  learningInfluencedShare: number,
): boolean {
  return learningInfluencedShare > MAX_LEARNING_INFLUENCE_TO_WIDEN
}

/* ================================================================== *
 * 8. THE RULE EVALUATOR — does a promoted entry apply to THIS row?
 *
 * G124, G125, G130 and G131 made executable. Everything above this section
 * decides whether a claim may become a rule; this section is the only place
 * that decides WHICH ROWS the rule touches, and it is where the two rulings
 * that are easiest to state and hardest to keep either hold or do not.
 *
 * ------------------------------------------------------------------------
 * G125 — A RULE MATCHES WHAT THE HUMAN WAS SHOWN. THE WHOLE SEMANTICS IS AN
 * EXACT MEMBERSHIP TEST AGAINST THE ENUMERATED VALUES.
 * ------------------------------------------------------------------------
 *
 * There is no prefix match here, no suffix match, no case folding, no edit
 * distance, no similarity, no fuzzy threshold and no compiled pattern. A value
 * ONE CHARACTER different from an enumerated one does not match, and
 * `tests/model/learned-rule-eval.test.ts` asserts exactly that in both
 * directions — because one character is precisely the generalisation the ruling
 * forbids, and precisely the one that gets added on the afternoon a bank
 * changes a separator and forty rows stop firing.
 *
 * WHY THE TEMPTATION IS REAL AND MUST BE REFUSED ANYWAY. Widening by a prefix
 * would let one promoted entry cover a whole family of descriptions, which is
 * what the operator wanted when they nominated it. It would also mean the rule
 * matches rows NOBODY WAS EVER SHOWN, and the second person who approved the
 * promotion approved a bounded list of values they could read. A rule that
 * grows past that list is a rule the approver did not approve. If the family
 * genuinely needs covering, the answer is `IdentifierNormalisation` running
 * EARLIER — G123, normalisation shifts left — so the engine emits one
 * normalised value for the family and the human is shown that one value.
 *
 * ------------------------------------------------------------------------
 * G124/G130 — NO PATTERN IS EVER COMPILED, AND THE CLAIM IS NARROW ON PURPOSE
 * ------------------------------------------------------------------------
 *
 * This module constructs no pattern object and interprets no expression. It
 * compares strings with `===` and nothing else. `model/reconciliation.ts` §2
 * declines to claim "nothing generated is ever executed" because
 * `applyExtraction()` IS a small interpreter; this section can make the
 * stronger claim only because it does no transformation at all — the value it
 * compares was normalised upstream, by the engine, under a normalisation a
 * human approved.
 *
 * ⚠️ WHAT THAT COSTS, STATED. Two rows whose descriptions differ only in
 * whitespace reach this function as two different `NormalisedDescriptionValue`s if
 * the definition's normalisation did not fold them, and this evaluator will not
 * fold them either. That is a real miss, and the fix is upstream in the
 * normalisation, never here.
 *
 * ------------------------------------------------------------------------
 * WHY THIS MODULE IMPORTS NOTHING FROM `model/reconciliation.ts`
 * ------------------------------------------------------------------------
 *
 * A first reading of the brief suggests this evaluator must normalise a
 * description before comparing, which would need `IdentifierNormalisation` and
 * `applyExtraction()` from `model/reconciliation.ts`. IT DOES NOT, AND THE
 * REASON IS G131's OWN DESIGN: the sixth dimension enumerates
 * `NormalisedDescriptionValue` — values the engine ALREADY produced, branded at
 * the seam that produced them. Normalisation therefore happens once, in the
 * engine, before a human is ever shown a value; this function receives the
 * result on both sides and compares them. Doing it again here would be a
 * second encoding of one rule, and the two encodings would drift.
 *
 * ⚠️ THIS PARAGRAPH SAID "REFERENCES … never the strings themselves" UNTIL
 * 9 Aug 2026. The conclusion was always right and the reason was wrong: the
 * evaluator declines to normalise because normalisation is upstream and
 * single-encoded, NOT because it holds references. It holds values, and always
 * did — see the note on `NormalisedDescriptionValue`.
 *
 * (The direction WOULD have been legal: `model/reconciliation.ts` imports only
 * `./domain`, `./billing` and `./kernel`, all `import type`, and imports nothing
 * from here — so a `learning.ts → reconciliation.ts` edge opens no cycle and
 * inverts nothing. It is declined because it is unnecessary, not because it is
 * forbidden.)
 * ================================================================== */

/**
 * The facts about ONE residue row that a learning scope can be evaluated
 * against. One field per scope dimension, and NOT ONE FIELD MORE.
 *
 * REQUIRED-AND-NULLABLE THROUGHOUT, never optional. The residue population is
 * by definition the one nothing could be attributed to — `ResidueCause` carries
 * a dedicated `counterparty_unattributed` arm — so a null counterparty is the
 * COMMON case here, not the exotic one. Optional fields would let a caller omit
 * a key and have the evaluator read `undefined` as "not applicable" rather than
 * as "absent", which is the §5.5 polarity in its usual disguise.
 *
 * ⚠️ NO `tenantId`, AND ITS ABSENCE IS INVARIANT 1. Tenant scope is derived
 * from the session; a row handed to this function has already been read under
 * that scope, and giving the evaluator a tenant field to compare would invite a
 * caller to SELECT one. The entry and the row are both already inside one
 * tenant or the caller has a much larger problem than rule matching.
 *
 * ⚠️ NO **RAW** DESCRIPTION TEXT, AND THE WORD RAW IS LOAD-BEARING.
 * `normalisedDescriptionValue` carries the ENGINE'S OUTPUT for this row — the
 * same branded value `LearningScope.normalisedDescriptions` enumerates, G131.
 * A `description: string` here would put ingested counterparty text one field
 * away from a rule-matching decision, unnormalised and unbranded, which is what
 * this field's brand refuses.
 *
 * ⚠️ THIS SAID "`normalisedDescriptionId` is a reference … holds references"
 * UNTIL 9 Aug 2026, and the field was named `normalisedDescriptionId`. It never
 * held a reference; see `NormalisedDescriptionValue`. Invariant 6's protection
 * here is that the value is compared with `===` and interpreted by nothing —
 * not that it is an address rather than a string.
 */
export interface ResidueRowFacts {
  readonly counterpartyId: CounterpartyId | null
  readonly documentTypeId: DocumentTypeId | null
  readonly definitionId: DefinitionId | null
  readonly solutionId: SolutionId | null
  readonly dispositionFamily: DispositionFamily | null
  readonly normalisedDescriptionValue: NormalisedDescriptionValue | null
}

/**
 * The six dimensions, in the order they are evaluated and reported.
 *
 * THE ORDER IS PART OF THE CONTRACT, not an implementation detail: the first
 * dimension that fails is the one named in the refusal, so a stable order is
 * what makes a refusal reproducible for a person asking why a rule did not
 * fire. It is `LearningScope`'s own declaration order.
 */
export const SCOPE_DIMENSION_ORDER = [
  'counterpartyIds',
  'documentTypeIds',
  'definitionIds',
  'solutionIds',
  'dispositionFamilies',
  'normalisedDescriptions',
] as const satisfies readonly (keyof LearningScope)[]

export type ScopeDimension = (typeof SCOPE_DIMENSION_ORDER)[number]

/**
 * `satisfies` above proves every LISTED member is a real dimension. It does not
 * prove the list is COMPLETE, and a seventh dimension added to `LearningScope`
 * and forgotten here would be silently unevaluated — a scope clause that
 * narrows nothing, which is the widening direction. This alias fails to compile
 * in that case.
 */
export type _EveryScopeDimensionIsEvaluated = [keyof LearningScope] extends [ScopeDimension]
  ? true
  : never

/**
 * Which fact on the row answers which dimension.
 *
 * A TOTAL `Record`, AND — unlike the five records `HANDOFF` §5.10 records
 * landing with no construction site — THIS ONE IS CONSTRUCTED RIGHT HERE. A
 * seventh dimension is a compile error at this literal, today, with no fixture
 * required. What the compiler still cannot check is that each value names a
 * field that exists on a row; `tests/model/learned-rule-eval.test.ts` does that.
 */
export const ROW_FACT_FOR_DIMENSION: Record<ScopeDimension, keyof ResidueRowFacts> = {
  counterpartyIds: 'counterpartyId',
  documentTypeIds: 'documentTypeId',
  definitionIds: 'definitionId',
  solutionIds: 'solutionId',
  dispositionFamilies: 'dispositionFamily',
  normalisedDescriptions: 'normalisedDescriptionValue',
}

/**
 * Why an entry did not apply. CLOSED, because a miss must be reportable — the
 * same discipline `NominationRefusal` and `ResidueCause` carry, and the reason
 * this returns a reasoned result rather than a boolean (`HANDOFF` §5.2).
 *
 * A bare `false` here would reach a controller's screen as "the rule did not
 * fire" with no way to tell a rule that MISSED from a rule that is BROKEN —
 * `dimension_enumerates_nothing` and `value_lacks_provenance` are defects in
 * the stored entry, and `row_lacks_dimension` and `value_not_enumerated` are
 * the rule working correctly.
 */
export const SCOPE_MISS_CODES = {
  /** Suspended, expired or purged. Not a match question at all. */
  entryNotActive: 'entry_not_active',
  /** Every dimension `unconstrained`. A conjunction over zero clauses. */
  scopeBindsNothing: 'scope_binds_nothing',
  /** A `these` list with no members. Asserts nothing; matches nothing. */
  dimensionEnumeratesNothing: 'dimension_enumerates_nothing',
  /** The scope names a dimension this row has no value for. */
  rowLacksDimension: 'row_lacks_dimension',
  /** The row has a value and it is not one of the enumerated ones. */
  valueNotEnumerated: 'value_not_enumerated',
  /** An enumerated value names no row it was observed on. G131. */
  valueLacksProvenance: 'value_lacks_provenance',
} as const

export type ScopeMissCode = (typeof SCOPE_MISS_CODES)[keyof typeof SCOPE_MISS_CODES]

/**
 * The answer, in both directions.
 *
 * The true arm names WHICH dimensions carried it, so "this rule applied" is
 * auditable rather than asserted — an operator asking why a learning touched a
 * row gets the clauses back, and an approver reviewing a live entry can see
 * that the clause they cared about is the one doing the work.
 */
export type ScopeMatch =
  | { readonly applies: true; readonly boundDimensions: readonly ScopeDimension[] }
  | {
      readonly applies: false
      readonly code: ScopeMissCode
      /** Null where no single dimension is at fault. Never a stand-in. */
      readonly dimension: ScopeDimension | null
    }

type DimensionVerdict =
  | { readonly kind: 'unconstrained' }
  | { readonly kind: 'enumerated'; readonly values: readonly string[] }
  | { readonly kind: 'refused'; readonly code: ScopeMissCode }

/**
 * Reduces one declared dimension to the values it permits, or to the defect
 * that makes it unusable.
 *
 * THE PROVENANCE CHECK IS KEYED ON THE DIMENSION, NOT ON THE SHAPE OF THE
 * VALUE. Branching on `typeof v === 'string'` would work today and would be a
 * rule keyed on a convenient landmark instead of the property it protects —
 * `CLAUDE.md` names that as the most common defect in this codebase. The
 * property is "this dimension enumerates VALUES rather than entities, so each
 * one needs provenance"; `normalisedDescriptions` is the dimension that has it.
 */
function dimensionVerdict(scope: LearningScope, dimension: ScopeDimension): DimensionVerdict {
  if (dimension === 'normalisedDescriptions') {
    const declared = scope.normalisedDescriptions
    if (declared.kind === 'unconstrained') return { kind: 'unconstrained' }
    if (declared.values.length === 0) {
      return { kind: 'refused', code: SCOPE_MISS_CODES.dimensionEnumeratesNothing }
    }
    const values: string[] = []
    for (const v of declared.values) {
      /**
       * WIDENED PAST THE DECLARED TYPE, for the reason `validateNomination()`
       * states: `observedOn` is `ExceptionId | null`, so `undefined` is outside
       * the type — but a promoted entry reaches this function as a row out of a
       * database, and a JSON column that omitted the key produces exactly that.
       * An empty string is the third shape, a branded id naming no row.
       */
      const observedOn: ExceptionId | null | undefined = v.observedOn
      if (observedOn === null || observedOn === undefined || observedOn === '') {
        /**
         * ONE BAD VALUE REFUSES THE WHOLE DIMENSION rather than dropping out of
         * the set. A scope carrying a value nobody can show a human was shown
         * is not a scope whose remaining values can be trusted — and refusing
         * NARROWS behaviour, which this module's own note on `LearningDimension`
         * calls the only safe direction for a learning to move in.
         */
        return { kind: 'refused', code: SCOPE_MISS_CODES.valueLacksProvenance }
      }
      values.push(v.value)
    }
    return { kind: 'enumerated', values }
  }

  /* The other five enumerate ids of entities that exist independently, so they
   * carry no provenance reference — `ObservedLearningDimension`'s own note
   * argues why, and this branch is that argument in executable form. */
  const declared: LearningDimension<string> = scope[dimension]
  if (declared.kind === 'unconstrained') return { kind: 'unconstrained' }
  if (declared.values.length === 0) {
    return { kind: 'refused', code: SCOPE_MISS_CODES.dimensionEnumeratesNothing }
  }
  return { kind: 'enumerated', values: declared.values }
}

/**
 * DOES THIS PROMOTED ENTRY APPLY TO THIS RESIDUE ROW?
 *
 * Pure, total, synchronous. It reads no store, makes no model call, mints
 * nothing and decides nothing about disposition — G123 puts disposition to the
 * right of the engine, over the residue, and G129 puts `mayAutoResolve()`
 * before any rule executes. This function answers the narrower question those
 * rulings sit on top of, and answering it is ALL it does.
 *
 * THE SCOPE IS CONJOINED, NEVER DISJOINED — the rule `LearningScope` states for
 * itself. Every bound dimension must hold. The first that does not is returned,
 * in `SCOPE_DIMENSION_ORDER`.
 *
 * AND BOTH EMPTINESS POLARITIES FAIL CLOSED, because both are §5.5 and both are
 * one keystroke away from applying a learning to every row in the tenant:
 * an empty `these` list matches NOTHING (not everything), and a scope
 * `unconstrained` on all six binds NOTHING (not everything). `[].every(...)` is
 * `true`, which is exactly how the second one would ship green.
 */
export function entryAppliesToRow(entry: LearningEntry, row: ResidueRowFacts): ScopeMatch {
  const miss = (code: ScopeMissCode, dimension: ScopeDimension | null): ScopeMatch => ({
    applies: false,
    code,
    dimension,
  })

  /* A suspended entry is a retraction that has taken effect. Asking whether its
   * scope matches is the wrong question, so the answer is not a dimension. */
  if (entry.status !== 'active') return miss(SCOPE_MISS_CODES.entryNotActive, null)

  const bound: ScopeDimension[] = []
  for (const dimension of SCOPE_DIMENSION_ORDER) {
    const declared = dimensionVerdict(entry.scope, dimension)
    if (declared.kind === 'unconstrained') continue
    if (declared.kind === 'refused') return miss(declared.code, dimension)

    const fact = row[ROW_FACT_FOR_DIMENSION[dimension]]
    /* The scope names this dimension and the row has no value for it. Distinct
     * from `value_not_enumerated`, and collapsing the two would misreport an
     * unattributed residue row as a rule that merely did not match. */
    if (fact === null) return miss(SCOPE_MISS_CODES.rowLacksDimension, dimension)

    /* G125, and this loop is the entire semantics. Identity, not similarity. */
    let matched = false
    for (const candidate of declared.values) {
      if (candidate === fact) {
        matched = true
        break
      }
    }
    if (!matched) return miss(SCOPE_MISS_CODES.valueNotEnumerated, dimension)
    bound.push(dimension)
  }

  if (bound.length === 0) return miss(SCOPE_MISS_CODES.scopeBindsNothing, null)
  return { applies: true, boundDimensions: bound }
}
