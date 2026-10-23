/**
 * RUN ADMISSION — WHETHER PRESSING RUN STARTS A RUN, AND WHAT IT IS THE SAME
 * RUN AS. G691–G694, 19 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE CONTRACT'S OWN SENTENCE, BECAUSE THIS MODULE IS ITS EXECUTABLE FORM.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     "THE CLIENT DOES NOT SUPPLY AN IDEMPOTENCY KEY, AND THAT IS THE POINT.
 *      The key is computed by the server from the period, the definition and
 *      the slot-fill state — the fingerprint of exactly which documents are
 *      sitting in which slots right now. A client-supplied key would let a
 *      client mint a duplicate run by varying it, which is the race this rule
 *      exists to close."
 *
 * And `model/domain.ts` states the same rule at `RUN_TRIGGER_KINDS`, which is
 * where it was first written down: *"Enabling two does create a race (an
 * operator presses Run while a document lands), so run admission must be
 * idempotent on (period, definition, slot-fill state); the trigger is then
 * ATTRIBUTION, and never identity."*
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT THIS MODULE DOES NOT DO, FIRST, BECAUSE TWO OF THE THREE ARE THE
 *    REASON IT IS A MODULE AND NOT A HANDLER.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   · **IT DOES NOT HASH.** `slotFillBasis()` returns the RFC 8785 canonical
 *     form of the slot-fill state and stops there. The digest lives with the
 *     writer, outside `model/`, exactly as `db/migrations/0012`'s §6 records
 *     for `subject_ref`: *"the hasher lives with the writer outside `model/`
 *     exactly as `0004_subject_ledger.sql` records for `subject_digest`."*
 *     `server/data-plane/run-admission.ts` is the one place that hashes.
 *   · **IT DOES NOT READ A ROW.** Every fact it decides on arrives in
 *     `RunAdmissionSubstrate`, the same shape `resolveSubject()` takes its
 *     parameter object in and for the same reason: a resolver that could reach
 *     a table could reach a different one than the gate did.
 *   · **IT DOES NOT MINT A RUN ID, A TIMESTAMP OR A TRIGGER.** An admitted
 *     verdict says *this may start* and carries the basis it was computed
 *     from; the id, the clock and `{ kind: 'manual', byUserId }` are the
 *     handler's, because all three come from outside the model.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE ORDER OF THE THREE CHECKS IS LOAD-BEARING AND IS ARGUED RATHER THAN
 *    CONVENIENT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   1 · THE DEFINITION. A slot declaration belongs to a definition, so a slot
 *       test against an absent definition is a test over an empty list that
 *       PASSES — scope failing open, and the failure would read as an
 *       admission rather than as a missing definition.
 *   2 · THE PERIOD. Before the slots, deliberately: a closed period is a
 *       refusal about whether this run may happen AT ALL, and telling an
 *       operator *"slot `bank_statement` is empty"* for a period they may not
 *       run against sends them to fill a slot that will change nothing. The
 *       remedy the contract names is *"Reopen the period first"*, and a
 *       refusal must point at the remedy it has.
 *   3 · THE SLOT FILL. Last, because it is the only one an operator fixes by
 *       doing the product's ordinary work.
 *
 * ⚠️ THE ORDER IS NOT MERELY COSMETIC IN ONE DIRECTION: **it never widens.**
 * Every arm refuses, so no reordering could admit a run that another ordering
 * refuses. What the order decides is WHICH TRUE REFUSAL a caller is told
 * about, which is a usability decision with a correctness floor rather than a
 * correctness decision.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ WHAT IS DECLARED AND HAS NO PRODUCER TODAY, NAMED RATHER THAN DISCOVERED.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   · ✅ **THE FILL HAS A PRODUCER SINCE 20 Sep 2026 — G961–G964,
 *     `db/migrations/0150_document_slot_binding.sql` and `readSlotFill()` in
 *     `server/data-plane/run-admission.ts`. ⚠️ THE ORIGINAL IS QUOTED RATHER
 *     THAN DELETED**, because it is the sentence three files carried and the
 *     one a reader would have quoted onward before concluding that a required
 *     slot could never be satisfied:
 *
 *         "**NOTHING BINDS A `SourceDocument` TO A SLOT ANYWHERE IN THIS
 *          REPOSITORY.** `db/migrations/0012`'s `source_document` carries an
 *          arrival and a document type and no slot. So
 *          `RunAdmissionSubstrate.fill` arrives EMPTY on every served request,
 *          every `exactly_one` and `at_least_one` slot is unfilled, and a
 *          definition declaring one is a refusal forever."
 *
 *     **Its first clause is now false and everything after it is still exactly
 *     right about an UNBOUND slot.** `0012`'s `source_document` still carries
 *     no slot — the binding is its own table — and a definition whose required
 *     slot has nothing bound to it is still a refusal, on the contract's own
 *     words: *"Running anyway would raise exceptions for absent documents and
 *     call them breaks."* **That is the correct answer, not a stub.** What
 *     must not be done is unchanged and is the half this module owns: an empty
 *     `fill` is read as *no document occupies any slot*, never as *all slots
 *     satisfied*, which is a different sentence and the true one.
 *   · **`trigger_not_enabled` IS NOT AN ARM OF THIS UNION AND CANNOT BE
 *     REACHED FROM `admitRun`.** The contract declares that 422 —
 *     *"`manual` is not in the definition's `enabledTriggers`"* — and
 *     `RUN_TRIGGER_KINDS` says in its own voice that `manual` and `rerun` are
 *     *"deliberately ABSENT from this list … neither is a configuration
 *     choice"*. A manual trigger therefore cannot fail a test against a set it
 *     is not a member of. **The arm belongs to whoever writes the `scheduled`
 *     or `ingest` admitter**, which needs `enabledTriggers` and a trigger
 *     parameter this function does not take; it is named here so that author
 *     meets it rather than rediscovers it. `db/migrations/0069` declines the
 *     column on the same ground.
 *   · **NOTHING DECLARES WHETHER A DEFINITION IS PERIOD-BOUND.** The contract
 *     says omitting `periodId` on a period-bound definition *"is refused
 *     rather than defaulted"*, and `ReconciliationDefinition` has no field
 *     from which period-boundness could be derived — derive it,
 *     `grep -n 'period' model/domain.ts | grep -i definition` returns nothing
 *     about the definition. **A `periodBound` column would be a declaration
 *     this model does not make**, so a null `periodId` is admitted here and
 *     the gap is reported rather than invented. That is `0004_subject_ledger.sql`'s
 *     rule pointed at a model field instead of at a column.
 */

import type { Cardinality, ReconciliationDefinition, ReconciliationPeriod } from './domain'
import type {
  DefinitionId,
  ReconciliationPeriodId,
  SlotName,
  SourceDocumentId,
} from './kernel'
import type { AssertNoTextDeep } from './reconciliation'
import { canonicalise } from './canonical.ts'

/* ------------------------------------------------------------------ *
 * §1  THE THREE TOTAL RECORDS
 *
 * 🛑 EVERY ONE OF THEM IS A TOTAL `Record` OVER A CLOSED UNION, AND THE
 *    POLARITY IS THE SAME IN ALL THREE: THE ADMITTING SET IS WRITTEN OUT AND
 *    EVERYTHING ELSE REFUSES.
 *
 * `CLAUDE.md` — *"Prefer a total `Record<K, V>` over a lookup function when the
 * key set is closed. An unhandled member then becomes a compile error rather
 * than a runtime surprise."* And `model/ingestion.ts` states the sharper half
 * at `CHANNEL_DRAWS_THROUGH_AN_ENDPOINT`: a total record exists *"so a fifth
 * channel member cannot slip through as a silently-permissive default"*.
 *
 * ⚠️ AND A TOTAL RECORD IS ONLY HALF THE FENCE HERE, WHICH IS WORTH SAYING
 * BECAUSE THIS MODULE'S INPUTS COME FROM `text` COLUMNS. The compile-time half
 * catches a member the MODEL adds; the runtime half is that each lookup below
 * is written `RECORD[value as K] ?? undefined` against a `string`, so a value
 * the database holds and the union does not names an `*_unreadable` refusal
 * instead of reading as `false` — which would be indistinguishable from an
 * honest refusal — or as `true`, which would be an admission nobody decided.
 * `db/migrations/0069` declines a SQL `CHECK` on all three columns on exactly
 * this ground.
 * ------------------------------------------------------------------ */

/**
 * Which `ReconciliationDefinition.status` admits a run.
 *
 * ONE of three. `draft` is a definition nobody has published and `archived` is
 * one somebody withdrew; running either would produce exceptions against rules
 * that are not in force.
 */
export const DEFINITION_ADMITS_A_RUN: Record<ReconciliationDefinition['status'], boolean> = {
  draft: false,
  active: true,
  archived: false,
}

/**
 * Which `ReconciliationPeriod.status` admits a run.
 *
 * 🛑 TWO OF FOUR, AND `reopened` IS THE ONE TO READ. The contract's remedy for
 * `period_closed` is *"Reopen the period first; that is a deliberate, audited
 * act."* A `reopened` period that still refused would make the prescribed
 * remedy inert — which is G60's shape, a rule that makes the act it names
 * structurally impossible.
 *
 * ⚠️ `closing` REFUSES AND IT IS THE CLOSE CALL. A period mid-close is one
 * whose numbers are being signed. Admitting against it is the same harm as
 * admitting against a closed one, arriving a minute earlier.
 */
export const PERIOD_ADMITS_A_RUN: Record<ReconciliationPeriod['status'], boolean> = {
  open: true,
  closing: false,
  closed: false,
  reopened: true,
}

/**
 * Which `Cardinality` REQUIRES a document in its slot.
 *
 * The contract's 422: *"`slot_fill_incomplete` — a slot with cardinality
 * `exactly_one` or `at_least_one` has nothing in it."*
 *
 * ⚠️ `exactly_one` IS TESTED FOR EMPTINESS AND NOT FOR EXACTNESS HERE, AND THE
 * DIFFERENCE IS DELIBERATE. Two documents in an `exactly_one` slot is a real
 * defect and it is not `slot_fill_incomplete` — nothing is incomplete about it
 * — and `errors.yaml`'s closed enum carries no member for it. Inventing one is
 * a contract change. **It is unreachable today** because nothing fills a slot
 * at all, and it is named so the commit that builds slot binding meets it.
 *
 * 🛑 **THAT COMMIT IS G961–G964, 20 Sep 2026, AND IT MET THIS NOTE RATHER THAN
 * CLOSING IT: THE CASE IS NOW REACHABLE AND STILL UNJUDGED.** Two DISTINCT
 * documents bound to one `exactly_one` slot is writable —
 * `db/migrations/0150`'s two partial unique indexes forbid the SAME document
 * twice and say nothing about two different ones, because the cardinality
 * lives on another table and a constraint cannot read it. Such a definition
 * therefore ADMITS, and the run pins both documents in `run.inputs`.
 *
 * ⚠️ **THREE REPAIRS AND EVERY ONE OF THEM IS A RULING**, which is why this is
 * reported rather than taken: (a) a new member of `errors.yaml`'s closed enum
 * — a contract change; (b) folding it into `slot_fill_incomplete` — *"nothing
 * is incomplete about it"*, and a refusal that names the wrong cause sends an
 * operator to bind a document they have already bound; (c) a `BEFORE INSERT`
 * trigger on the binding that reads `definition_slot.cardinality`, which is
 * the shape `db/migrations/0059` took for `tenant.exception` — and a trigger
 * is a ruling in this schema rather than a patch, because `0005` says there
 * must never be one and `0019` is the only exception anybody has argued.
 * **The exposure is bounded today because nothing executes a run**, which is
 * the same reason `0017` gives for taking a decision before a shipper exists,
 * and it is not a licence to widen.
 */
export const CARDINALITY_REQUIRES_A_DOCUMENT: Record<Cardinality, boolean> = {
  exactly_one: true,
  at_least_one: true,
  optional: false,
}

/* ------------------------------------------------------------------ *
 * §2  THE SUBSTRATE — every fact, supplied, never read
 * ------------------------------------------------------------------ */

/**
 * A definition, projected to what admission decides on.
 *
 * ⚠️ `status` IS A BARE `string` AND NOT `ReconciliationDefinition['status']`,
 * WHICH LOOKS LIKE A WEAKENING AND IS THE OPPOSITE. The value comes out of a
 * `text` column, so typing the field as the union would be a CAST asserting a
 * fact nobody checked — and the check would then live at the caller, which is
 * where correctness drifts (G111's argument, one layer down). Typing it
 * `string` forces the narrowing to happen HERE, once, against the total record
 * above, with an `*_unreadable` refusal for a value that is neither.
 */
export interface DefinitionRecord {
  readonly id: DefinitionId
  /** `ReconciliationDefinition.version`. Pins the definition as it stood. */
  readonly version: number
  /** `ReconciliationDefinition['status']`, unnarrowed. See above. */
  readonly status: string
}

/** One declared slot, projected to the one fact admission decides on. */
export interface SlotDeclaration {
  readonly slot: SlotName
  /** `Cardinality`, unnarrowed, for `DefinitionRecord.status`'s reason. */
  readonly cardinality: string
}

/** A period, projected to the one fact admission decides on. */
export interface PeriodRecord {
  readonly id: ReconciliationPeriodId
  /** `ReconciliationPeriod['status']`, unnarrowed, for the same reason. */
  readonly status: string
}

/**
 * Which documents occupy which slot, right now.
 *
 * 🛑 THIS IS THE IDEMPOTENCY BASIS. ⚠️ **IT READ *"AND IT IS EMPTY IN THIS
 * REPOSITORY"* UNTIL 20 Sep 2026 AND IS CORRECTED RATHER THAN DELETED** — see
 * the header. `db/migrations/0150_document_slot_binding.sql` is the table and
 * `readSlotFill()` is the one reader. An empty list still means NO DOCUMENT
 * OCCUPIES ANY SLOT, which is a fact and not a placeholder, and it is still
 * what a definition with no bindings produces.
 */
export interface SlotFill {
  readonly slot: SlotName
  readonly documentIds: readonly SourceDocumentId[]
}

/** Everything `admitRun()` decides on. Supplied by the caller, never read. */
export interface RunAdmissionSubstrate {
  /** `null` when no definition with that id is visible to this session. */
  readonly definition: DefinitionRecord | null
  /** Every slot the definition declares. Empty is a legal definition. */
  readonly slots: readonly SlotDeclaration[]
  /** `null` when the request named no period, OR when the named one is unknown. */
  readonly period: PeriodRecord | null
  /** The slot-fill state. See `SlotFill`. */
  readonly fill: readonly SlotFill[]
}

/** What the caller asked for. Both fields come from the validated body. */
export interface RunAdmissionFacts {
  readonly definitionId: DefinitionId
  readonly periodId: ReconciliationPeriodId | null
}

/* ------------------------------------------------------------------ *
 * §3  THE REFUSALS
 * ------------------------------------------------------------------ */

/**
 * Why a run was not admitted. NINE arms, and every one of them carries a
 * BRANDED ID AND NOTHING ELSE.
 *
 * 🛑 THE CONTAINMENT PROOF IS ON THIS UNION AND ON NOTHING ELSE IN THIS
 *    MODULE, WHICH IS `model/reconciliation.ts`'s OWN DISCIPLINE APPLIED
 *    RATHER THAN A CHOICE MADE HERE: *"The union carrying the REASON holds the
 *    proof; the record carrying the declared path does not."*
 *
 * `SlotName` is `= string` in `model/kernel.ts` — bare, not branded — so an
 * arm carrying the unfilled slot's name would make
 * `AssertNoTextDeep<RunAdmissionRefusal>` a `TS2344`, exactly as
 * `AssertNoTextDeep<HeldRead>` is. **The name is therefore not on the
 * refusal**: it travels on `RunAdmissionVerdict.unfilledSlots`, which carries
 * no proof and says so at its own declaration.
 *
 * ⚠️ AND NOTHING HERE REACHES A CALLER ANYWAY. `errors.yaml` forbids `detail`
 * from carrying *"field values, record contents or customer-authored
 * strings"*, and every refusal this plane sends carries a CONSTANT detail. The
 * arm names what an operator reading the process log can act on; the caller
 * gets the status code and the closed error code.
 *
 * 🛑 THE THREE `*_unreadable` ARMS ARE NOT A DEFENSIVE HABIT. Each is reached
 * when a `text` column holds a value the model's closed union does not define,
 * and each is `server/data-plane/runs.ts`'s `unpublishable` shape one layer
 * up — a 500 with a log naming the column, because a stored value the domain
 * model cannot read is an operator's problem and not a caller's. Reading such
 * a value as `false` would be indistinguishable from an honest refusal, and
 * reading it as `true` would admit a run nobody decided to admit.
 */
export type RunAdmissionRefusal =
  /** No definition with that id is visible to this session. */
  | { readonly kind: 'definition_absent'; readonly definitionId: DefinitionId }
  /** `draft` or `archived`. */
  | { readonly kind: 'definition_not_active'; readonly definitionId: DefinitionId }
  /** The stored `status` is not a member of the union. */
  | { readonly kind: 'definition_status_unreadable'; readonly definitionId: DefinitionId }
  /** A period was named and no row for it is visible. Fail-closed; see below. */
  | { readonly kind: 'period_absent'; readonly periodId: ReconciliationPeriodId }
  /** `closing` or `closed`. */
  | { readonly kind: 'period_not_open'; readonly periodId: ReconciliationPeriodId }
  /** The stored `status` is not a member of the union. */
  | { readonly kind: 'period_status_unreadable'; readonly periodId: ReconciliationPeriodId }
  /** At least one slot that requires a document has none. */
  | { readonly kind: 'slot_fill_incomplete'; readonly definitionId: DefinitionId }
  /** A stored `cardinality` is not a member of the union. */
  | { readonly kind: 'slot_cardinality_unreadable'; readonly definitionId: DefinitionId }
  /**
   * The slot-fill state could not be canonicalised, so no basis exists.
   *
   * ⚠️ UNREACHABLE TODAY AND NOT FOLDED INTO ANY OTHER ARM. Folding it into
   * `slot_cardinality_unreadable` — the nearest neighbour, and the shape a
   * first draft of this union took — would have put a canonicaliser failure
   * under a name about a column, and the operator reading the log would have
   * gone looking at `definition_slot`. A refusal that names the wrong subject
   * is worse than a ninth arm.
   */
  | { readonly kind: 'slot_fill_unrepresentable'; readonly definitionId: DefinitionId }

export type _RunAdmissionRefusalHoldsNoText = AssertNoTextDeep<RunAdmissionRefusal>

/* ------------------------------------------------------------------ *
 * §4  THE VERDICT
 * ------------------------------------------------------------------ */

/**
 * What the key was computed from, in the contract's own three parts.
 *
 * `RunAdmission.idempotencyBasis` is `required` on the wire and the contract
 * says why: *"The three things the key was computed from, returned so a
 * puzzled operator can see WHY their press of Run joined an existing run
 * instead of starting one."*
 *
 * 🛑 `slotFillBasis` IS THE CANONICAL FORM AND NOT THE FINGERPRINT. The wire
 * field is `slotFillFingerprint` and it is a HASH of this string, computed by
 * the writer. See the header for why the hasher is not in `model/`.
 */
export interface IdempotencyBasis {
  readonly definitionId: DefinitionId
  readonly periodId: ReconciliationPeriodId | null
  /** RFC 8785 canonical JSON of the slot-fill state. Hash this; do not publish it. */
  readonly slotFillBasis: string
}

/**
 * Admitted, or refused.
 *
 * ⚠️ `unfilledSlots` CARRIES TEXT AND IS DELIBERATELY OUTSIDE THE CONTAINMENT
 * PROOF. It is non-empty only on the `slot_fill_incomplete` arm, it exists so
 * an operator reading the process log learns WHICH slot, and **it must not
 * reach a caller**: `errors.yaml` forbids a request-derived `detail`, and
 * `server/data-plane/run-admission.ts` logs it and sends a constant.
 */
export type RunAdmissionVerdict =
  | {
      readonly kind: 'admitted'
      /** `Run.definitionVersion`, from the definition row and from nowhere else. */
      readonly definitionVersion: number
      readonly basis: IdempotencyBasis
      /** `Run.inputs` — document ids per slot, pinned at admission. */
      readonly inputs: Readonly<Record<SlotName, readonly SourceDocumentId[]>>
    }
  | {
      readonly kind: 'refused'
      readonly refusal: RunAdmissionRefusal
      readonly unfilledSlots: readonly SlotName[]
    }

/* ------------------------------------------------------------------ *
 * §5  THE BASIS
 * ------------------------------------------------------------------ */

/**
 * The slot-fill state, in RFC 8785 canonical form.
 *
 * 🛑 THE SORT IS THE WHOLE FUNCTION AND IT IS DONE TWICE, ON PURPOSE.
 * `canonicalise()` sorts OBJECT KEYS and leaves ARRAY ORDER alone — RFC 8785
 * §3.2.3 — so two callers holding the same documents in a different order
 * would canonicalise to two different strings and press Run twice. Both the
 * slot list and each slot's document list are therefore sorted here, by the
 * same UTF-16 code-unit comparison `model/canonical.ts` uses and warns about:
 * *"`localeCompare` does NOT, and neither does any `Intl.Collator`."*
 *
 * ⚠️ A DUPLICATE SLOT NAME IS NOT POSSIBLE TO GET WRONG HERE because the
 * object below is keyed by it — a repeated slot collapses, last write wins —
 * and `db/migrations/0069`'s `PRIMARY KEY (tenant_id, definition_id, slot)`
 * makes the repeat unrepresentable upstream anyway.
 *
 * 🛑 IT RETURNS A RESULT AND NOT A STRING. `canonicalise()` can refuse, and a
 * `!` or a `?? ''` here would turn a refusal into an EMPTY BASIS — which every
 * other request would then collide with, deduplicating unrelated runs into
 * one. The values are ids and cannot refuse today; the arm is kept because the
 * cost of being wrong about that is silent and shared.
 */
export function slotFillBasis(
  fill: readonly SlotFill[],
): { readonly ok: true; readonly basis: string } | { readonly ok: false; readonly why: string } {
  const bySlot: Record<string, string[]> = {}
  for (const entry of fill) {
    bySlot[entry.slot] = [...entry.documentIds].sort()
  }
  const result = canonicalise(bySlot)
  if (!result.ok) return { ok: false, why: result.refusal.kind }
  return { ok: true, basis: result.json }
}

/* ------------------------------------------------------------------ *
 * §6  THE CASCADE
 * ------------------------------------------------------------------ */

/**
 * May this press of Run start a run?
 *
 * 🛑 READ THE HEADER'S ORDERING ARGUMENT BEFORE MOVING A BRANCH.
 *
 * ⚠️ AND READ WHAT THIS FUNCTION IS NOT: it does not answer *"is there already
 * a run"*. Deduplication is a UNIQUE INDEX and an `ON CONFLICT`, in
 * `db/migrations/0069` §4 and `server/data-plane/run-admission.ts` — a
 * function that looked for an existing run and then inserted would lose the
 * exact race the contract names. **What this returns on the admitted arm is
 * the BASIS the database then arbitrates on.**
 */
export function admitRun(
  facts: RunAdmissionFacts,
  substrate: RunAdmissionSubstrate,
): RunAdmissionVerdict {
  const refuse = (refusal: RunAdmissionRefusal): RunAdmissionVerdict => ({
    kind: 'refused',
    refusal,
    unfilledSlots: [],
  })

  /* 1 · THE DEFINITION. */
  const definition = substrate.definition
  if (definition === null) {
    return refuse({ kind: 'definition_absent', definitionId: facts.definitionId })
  }
  const definitionAdmits: boolean | undefined =
    DEFINITION_ADMITS_A_RUN[definition.status as ReconciliationDefinition['status']]
  if (definitionAdmits === undefined) {
    return refuse({ kind: 'definition_status_unreadable', definitionId: definition.id })
  }
  if (!definitionAdmits) {
    return refuse({ kind: 'definition_not_active', definitionId: definition.id })
  }

  /* 2 · THE PERIOD, and only when one was named. */
  if (facts.periodId !== null) {
    const period = substrate.period
    if (period === null) {
      /*
       * 🛑 FAIL-CLOSED ON AN UNKNOWN PERIOD — G693, argued at length in
       * `db/migrations/0069` §3. A period this plane has no record of cannot
       * be shown to be OPEN, and admitting against it attributes a
       * reconciliation to an accounting period nobody opened.
       */
      return refuse({ kind: 'period_absent', periodId: facts.periodId })
    }
    const periodAdmits: boolean | undefined =
      PERIOD_ADMITS_A_RUN[period.status as ReconciliationPeriod['status']]
    if (periodAdmits === undefined) {
      return refuse({ kind: 'period_status_unreadable', periodId: period.id })
    }
    if (!periodAdmits) {
      return refuse({ kind: 'period_not_open', periodId: period.id })
    }
  }

  /* 3 · THE SLOT FILL. */
  const filled = new Map<SlotName, readonly SourceDocumentId[]>()
  for (const entry of substrate.fill) filled.set(entry.slot, entry.documentIds)

  const unfilled: SlotName[] = []
  for (const declaration of substrate.slots) {
    const requires: boolean | undefined =
      CARDINALITY_REQUIRES_A_DOCUMENT[declaration.cardinality as Cardinality]
    if (requires === undefined) {
      return refuse({ kind: 'slot_cardinality_unreadable', definitionId: definition.id })
    }
    if (!requires) continue
    const documents = filled.get(declaration.slot)
    if (documents === undefined || documents.length === 0) unfilled.push(declaration.slot)
  }
  if (unfilled.length > 0) {
    /*
     * ⚠️ EVERY unfilled slot, not the first. An operator told about one
     * missing document at a time fills it, presses Run, and is told about the
     * next — which is the shape `DocumentTrailerVerdict`'s "met rows are the
     * point" note refuses one axis over.
     */
    return {
      kind: 'refused',
      refusal: { kind: 'slot_fill_incomplete', definitionId: definition.id },
      unfilledSlots: unfilled,
    }
  }

  /* ADMITTED. */
  const basis = slotFillBasis(substrate.fill)
  if (!basis.ok) {
    /*
     * 🛑 UNREACHABLE TODAY AND REFUSED RATHER THAN DEFAULTED. See
     * `slotFillBasis()`: an empty basis would collide with every other empty
     * basis and deduplicate unrelated runs into one. There is no wire code for
     * "the basis could not be computed", so the handler answers 500 — which is
     * the honest answer to a fact about our own storage.
     */
    return refuse({ kind: 'slot_fill_unrepresentable', definitionId: definition.id })
  }

  const inputs: Record<SlotName, readonly SourceDocumentId[]> = {}
  for (const entry of substrate.fill) inputs[entry.slot] = [...entry.documentIds].sort()

  return {
    kind: 'admitted',
    definitionVersion: definition.version,
    basis: {
      definitionId: definition.id,
      periodId: facts.periodId,
      slotFillBasis: basis.basis,
    },
    inputs,
  }
}
