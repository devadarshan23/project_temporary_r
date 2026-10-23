/**
 * EXTRACTION — THE ONE CONVERSION SEAM BETWEEN A STORED POSITION AND AN
 * `ExtractedValue`. G1451–G1459, 21 Sep 2026. E2 of the completion plan's W1.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 INVARIANT 4 IS WHY THIS MODULE EXISTS AND WHY IT DISPATCHES ON WHAT IT
 *    DISPATCHES ON. Copy it, never paraphrase it:
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     "Classification is declared once, on `FieldSpec`, and everything derives
 *      from it."
 *
 * A converter that turns a stored position into an `ExtractedScalar` must
 * decide a KIND, and there are exactly two places that decision can come from:
 * the DECLARATION — `FieldSpec.dataType`, which `db/migrations/0170` stores and
 * `server/data-plane/payload-store.ts` publishes since E1 — or the ARTEFACT,
 * by looking at the value.
 *
 * **THE SECOND IS CLASSIFICATION DECLARED BY THE COUNTERPARTY**, which is what
 * G106 refused on the class axis, and it fails SILENTLY rather than refusing.
 * It is not a hypothetical: measured against E1's own fixture rows before this
 * module was written, a converter dispatching on `typeof value` disagreed with
 * the operator's declaration on **FOUR of FOUR** positions —
 *
 *     invoice.total    declared=money       stored=1000          sniffed=number
 *     invoice.nric     declared=identifier  stored="S1234567D"   sniffed=text
 *     lines[0].ref     declared=identifier  stored="0012"        sniffed=text
 *     invoice.issued   declared=date        stored="2026-09-21"  sniffed=text
 *
 * — and every one of those four is a live reconciliation hazard rather than a
 * tidiness complaint. `1000` sniffed as a number never reaches
 * `model/money.ts` for a figure that IS money. `"0012"` sniffed as text is
 * the same identifier as `"12"` to anything that later normalises it. **This
 * module reads `dataType` and never looks at `value` to decide what `value`
 * is.** It looks at the value only to decide whether the value can BE what the
 * declaration says it is, which is the opposite direction and is a refusal.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE RULING THIS APPLIES — R12, THE OWNER'S, 21 Sep 2026.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     "Build extraction for `structured` and `tabular` ONLY.
 *      G7 and G8 are NOT taken."
 *
 * `structured` and `tabular` are parsed deterministically and cross **no
 * managed-service boundary**, so converting one is a TASK. `digital_text` puts
 * a model on layout and `scanned` adds OCR; both leave the account, and
 * **invariant 7 governs that path** — *"Residency survives inference"*. G7 (the
 * `managed_service_use` policy kind) and G8 (the AWS AI-services opt-out
 * verdict) are both `not applied`, so **invariant 7 has nothing to enforce
 * against there.** Building the OCR path before those rulings would put a
 * residency-governed act on a path with no governing instrument.
 *
 * 🛑 THE FENCE IS KEYED ON THE PROPERTY AND NEVER ON A LIST OF FIDELITY NAMES,
 *    AND THE PROPERTY ALREADY HAD A HOME. `FIDELITY_CROSSES_MANAGED_SERVICE` is
 *    `model/ingestion.ts`'s total `Record<AcquisitionFidelity, boolean>`, minted
 *    there on 24 Aug 2026 for the classification cascade, and this module
 *    **imports it rather than restating it**. A second copy would be §5.3 — two
 *    implementations of one order, and the one that drifts is always the copy —
 *    and the drift would be silent in the worst possible direction: a fidelity
 *    marked crossing in one table and not the other admits an OCR path here
 *    while the cascade refuses it there.
 *
 * ⚠️ **THE FENCE IS NOT THE RULING AND MUST NOT BE READ AS ONE.** R12 does not
 *    say the OCR path is forbidden; it says it is NOT TAKEN, pending G7 and G8.
 *    This module refuses those two fidelities at a compile-checked seam so that
 *    the gap is a REFUSAL somebody meets rather than a hole somebody falls
 *    through. **The slice that takes G7 and G8 deletes
 *    `fidelity_crosses_managed_service` and answers for both fidelities; it does
 *    not weaken this predicate.**
 *
 * ⚠️ AND READ WHAT KEYING ON THE PROPERTY COSTS, SAID PLAINLY: a FIFTH fidelity
 *    that does NOT cross a managed-service boundary is admitted here with no
 *    ruling, because the predicate asks about the boundary and not about the
 *    name. That is the intended direction — a deterministic parse is a
 *    deterministic parse — and a fifth fidelity that DOES cross is refused
 *    automatically. Either way the author of the fifth must answer
 *    `FIDELITY_CROSSES_MANAGED_SERVICE`, which is a `TS2739` in
 *    `model/ingestion.ts` until they do.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT THIS MODULE DOES NOT DO, FIRST, BECAUSE THE SILENCES ARE LOAD-BEARING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   · **IT DOES NOT READ A ROW, OPEN A SCOPE OR TOUCH A CLOCK.** Every fact it
 *     decides on arrives in its two parameters. It is pure and total and never
 *     throws, which is `model/money.ts`'s governing rule and the reason a
 *     converter belongs in `model/` rather than beside the reader.
 *   · **IT DOES NOT CONVERT MONEY.** `model/money.ts` does, and nothing else
 *     may — G111, and the record said `bigint` for forty-two days while the
 *     tree said `number`, which is what correctness living at call sites costs.
 *     This module's whole money arm is a SHAPE check and a call to
 *     `parseMoneyWire()`.
 *   · **IT DOES NOT VALIDATE A CALENDAR.** `parseCalendarDate()` in
 *     `model/reconciliation.ts` is the one seam that decides whether a date
 *     string is a date, and `admitOne` already refuses a non-ISO one BY NAME
 *     (`date_not_iso_calendar`). A second calendar check here would be two
 *     spellings of one rule. **This module decides only that the declared date
 *     position holds a STRING**; whether that string is 30 February is
 *     admission's, unchanged and already tested.
 *   · **IT DOES NOT DECIDE WHETHER A `dataType` IS READABLE.** A stored
 *     `data_type` the model cannot name never reaches here: E1's
 *     `readDeclarations()` refuses the read by column, which is what
 *     `db/migrations/0170`'s declined `CHECK` is paid for with. The parameter
 *     is typed `DataType`, so an unreadable one is unrepresentable rather than
 *     re-refused.
 *   · **IT MOUNTS NOTHING AND HAS NO CALLER OUTSIDE `tests/`.** Document
 *     assembly (E4) and the executor (E5) are separate slices and are not
 *     started here. This is `server/data-plane/token-verify.ts`'s shape and
 *     `0007`'s precedent: a surface proven without a route.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ THE TWO OBJECTIONS THIS SLICE WAS EXPECTED TO FOUNDER ON, AND WHY NEITHER
 *    REQUIRES INVENTING ANYTHING.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   · *"You would have to invent a fidelity."* **Fidelity is not per-value at
 *     all.** It is `DocumentType.expectedFidelity` — *"fixed at publication and
 *     identical for every document of that type"* (`model/ingestion.ts`) — so it
 *     is READ and passed in. ⚠️ It has no table today; a concurrent E3 slice
 *     gives `DocumentType` one. **The seam is this function's second parameter**
 *     and it does not care where the value came from.
 *   · *"You would have to invent a confidence."* **A `null` confidence is a
 *     DECLARED state**, not a gap. `Provenance.confidence` is `number | null`,
 *     and `heldReadsFor()` in `model/reconciliation.ts` is already fail-closed
 *     over it and already tested: *"A floor was declared and the extractor
 *     reported no confidence, so nothing can be compared against it — held,
 *     never passed."* A deterministic parse of a JSON position reports no
 *     confidence because there is none to report, and saying `1.0` would be a
 *     manufactured certainty — which is exactly what `PRODUCT.md` forbids.
 *
 * 🛑 AND THE FAIL-CLOSED HOLD THAT ANSWER LEANS ON IS **CURRENTLY INERT**, SAID
 *    HERE RATHER THAN LEFT FOR A READER TO ASSUME THE NULLS ARE PROTECTED.
 *    `heldReadsFor()` holds a read only where a FLOOR WAS DECLARED —
 *    `if (floor === undefined) continue` — and **G139 records that no authoring
 *    surface for floors exists**. `db/migrations/0160` gives `confidence_floor`
 *    a column per tenant, per document type, per field path, and **nothing
 *    writes it**: `tenant.document_field_spec` takes `GRANT SELECT` alone, so
 *    the only writer is the migrator standing in for G110's unbuilt publication
 *    seam. So every position this module produces today carries
 *    `confidence: null`, and **not one of them is held**, because the map of
 *    floors is empty. **The mechanism is correct, wired and unreachable.** That
 *    is not this slice's to close — a floor is FDE-set pack configuration and
 *    G139 is the ruling — and it is named so that nobody reads the null as
 *    defended.
 */

import { DATA_TYPES } from './domain.ts'
import type {
  AcquisitionFidelity,
  DataType,
  ExtractedScalar,
  ExtractedValue,
  Provenance,
} from './domain'
import { FIDELITY_CROSSES_MANAGED_SERVICE } from './ingestion.ts'
import type { FieldPathKey, Json } from './kernel'
import { parseMoneyWire } from './money.ts'
import type { MoneyRefusal, MoneyWire } from './money'
import type { AssertNoTextDeep } from './reconciliation'

/* ==================================================================== *
 * §1  THE TWO CLOSED VOCABULARIES THIS MODULE DISPATCHES ON
 * ==================================================================== */

/**
 * WHICH `ExtractedScalar` ARM EACH DECLARED `DataType` PRODUCES — G1451, and it
 * is a total `Record` so that a SIXTH `DataType` is a compile error here rather
 * than a runtime surprise.
 *
 * 🛑 AND THE COMPILE ERROR IS REAL HERE IN A WAY `CLAUDE.md` WARNS IT USUALLY IS
 *    NOT. *"A total `Record` only bites where something CONSTRUCTS one, and in a
 *    types-only model nothing does"* — five total records landed on 7 Aug 2026
 *    with **no construction site anywhere**, so `tsc` could not have failed on a
 *    single field chosen. **This one has a construction site: the object literal
 *    below, and `addressableToExtracted()` indexing it.** A sixth `DataType`
 *    minted in `model/domain.ts` is a `TS2739` at this literal, and the author
 *    cannot satisfy it without stating which `ExtractedScalar` arm the new type
 *    produces — which is the whole decision. Proven by mutation rather than
 *    asserted: `tests/model/extraction.test.ts` §1 witnesses the arity and the
 *    image, and the slice's own captured red adds a sixth member and reads the
 *    compiler's answer.
 *
 * ⚠️ `absent` IS NOT IN THE IMAGE AND CANNOT BE, WHICH IS A STATEMENT RATHER
 *    THAN AN OMISSION. `ExtractedScalar` has six arms and this record's image
 *    has five: **absence is a property of the VALUE, never of the
 *    DECLARATION.** No operator declares a position to be missing. A stored
 *    JSON `null` short-circuits to `{ kind: 'absent' }` before this record is
 *    ever consulted, and `admitOne` then refuses it as `field_absent` — which is
 *    the vocabulary that already exists for it.
 *
 * ⚠️ `string` MAPS TO `text` AND THE TWO WORDS ARE NOT A DRIFT. `DataType` is
 *    the DECLARATION's vocabulary and `ExtractedScalar['kind']` is the VALUE's;
 *    they were written a month apart and disagree on exactly this one word.
 *    **This record is the one place that disagreement is resolved** — which is
 *    the argument for the record over four call sites each remembering it.
 */
export const EXTRACTED_KIND_FOR_DATA_TYPE: Record<DataType, ExtractedScalar['kind']> = {
  string: 'text',
  number: 'number',
  date: 'date',
  money: 'money',
  identifier: 'identifier',
}

/**
 * WHAT SHAPE A STORED VALUE ACTUALLY HAS — the six shapes JSON can hold, as a
 * closed vocabulary, so that a refusal can say what it found **without carrying
 * what it found**.
 *
 * 🛑 THIS IS THE CONTAINMENT DECISION OF THE WHOLE MODULE AND IT IS WHY THE
 *    REFUSAL UNION PASSES `AssertNoTextDeep`. A refusal is the most natural
 *    place in the world to put the offending value — it is precisely what the
 *    person repairing the row wants to see — and invariant 6 is why it must not
 *    be there: *"Ingested content is data, never instruction"*, and a refusal
 *    travels into logs, verdicts and screens that no classification governs.
 *    **The SHAPE is ours; the VALUE is the counterparty's.** `RefusedItem` and
 *    `HeldRead` make the same trade for the same reason.
 */
export const JSON_SHAPES = {
  null: 'null',
  boolean: 'boolean',
  number: 'number',
  string: 'string',
  array: 'array',
  object: 'object',
} as const
export type JsonShape = (typeof JSON_SHAPES)[keyof typeof JSON_SHAPES]

/**
 * The shape of a stored value, total over `unknown` and carrying nothing out of
 * it. `typeof null === 'object'` and an array is an object, so both are tested
 * before the object arm.
 *
 * ⚠️ `undefined`, a function and a `bigint` are not JSON and cannot arrive from
 *    `JSON.parse`, but `Json` is `unknown` and a caller can hand one over. They
 *    answer `'object'`'s neighbour rather than throwing: the fallthrough is
 *    `'object'` only for real objects, and everything else lands in one of the
 *    five arms above it. A shape nobody can name would need a seventh member,
 *    and the five refusals that consume this all read *"not what was declared"*
 *    either way.
 */
export function jsonShapeOf(value: Json): JsonShape {
  if (value === null || value === undefined) return JSON_SHAPES.null
  if (Array.isArray(value)) return JSON_SHAPES.array
  const found = typeof value
  if (found === 'boolean') return JSON_SHAPES.boolean
  if (found === 'number' || found === 'bigint') return JSON_SHAPES.number
  if (found === 'string') return JSON_SHAPES.string
  return JSON_SHAPES.object
}

/* ==================================================================== *
 * §2  WHAT A REFUSAL MAY SAY — and the proof that it says no more
 * ==================================================================== */

/**
 * Which field of a `MoneyWire` a malformed money position failed on.
 *
 * ⚠️ DERIVED FROM THE INTERFACE WITH `keyof`, NOT RESTATED AS A CONST, AND THE
 *    DIFFERENCE IS THAT IT CANNOT DRIFT. A hand-written
 *    `'currency' | 'amountMinor' | 'exponent'` is a second spelling of
 *    `MoneyWire`'s key set that agrees until somebody adds a fourth field.
 *    These are OUR key names and not counterparty text, so naming one in a
 *    refusal is safe — and it is the difference between *"this money is
 *    malformed"* and *"this money has no currency"*, which are different
 *    operator errors with different fixes (§5.2).
 */
export type MoneyWireField = keyof MoneyWire

/**
 * Every way a declared position can fail to become an `ExtractedValue`.
 *
 * 🛑 THE `pathKey` IS ON EVERY ARM AND IS A `FieldPathKey`, WHICH IS BRANDED AND
 *    ONE-WAY. `model/kernel.ts`: *"no function in this repository takes a
 *    `FieldPathKey` and returns a `FieldPath`."* A refusal must say WHICH
 *    position failed or a caller assembling a document cannot act on it, and the
 *    key says that without carrying the path — **which it could not carry
 *    anyway**, see the proof below.
 */
export type ExtractionRefusal =
  /**
   * R12. The document's declared fidelity crosses a managed-service boundary,
   * so extraction for it is NOT BUILT — not forbidden, and not silently
   * skipped. Carries the fidelity because the caller's next act is to refuse
   * the whole document and an operator needs to know which rung it arrived on.
   */
  | {
      readonly kind: 'fidelity_crosses_managed_service'
      readonly pathKey: FieldPathKey
      readonly fidelity: AcquisitionFidelity
    }
  /**
   * The operator declared one thing and the artefact holds another — an
   * identifier position holding a JSON number, a date position holding an
   * object. **Both vocabularies travel and neither is counterparty text.**
   *
   * 🛑 THIS IS THE ARM THAT MAKES THE MODULE FAIL CLOSED, AND THE COERCION IT
   *    REFUSES IS THE TEMPTING ONE. A JSON number `12` at an `identifier`
   *    position could be stringified — total, deterministic, and it looks like
   *    a kindness. It is not: an identifier stored as `0012` in the source and
   *    delivered as the JSON number `12` would arrive here as `"12"`, and two
   *    identifiers that are not the same identifier would reconcile. **A
   *    declaration and an artefact that disagree are a mapping defect, and a
   *    mapping defect that is quietly absorbed is a mapping defect nobody
   *    fixes.**
   */
  | {
      readonly kind: 'value_shape_disagrees_with_declared_type'
      readonly pathKey: FieldPathKey
      readonly declared: DataType
      readonly found: JsonShape
    }
  /**
   * A `number` position holding `NaN` or an infinity. Not reachable from
   * `JSON.parse`, and reachable from `Json = unknown`.
   *
   * ⚠️ ITS OWN ARM RATHER THAN A SHAPE DISAGREEMENT, BECAUSE THE SHAPE AGREES:
   *    `NaN` IS a number. `model/reconciliation.ts`'s OQ-1 is the precedent and
   *    the warning — admission had no such guard and a row whose `amountMinor`
   *    was `NaN` was admitted, became a ledger item, and was then skipped by
   *    every later read *"leaving the ledger with no address anywhere in the
   *    result."*
   */
  | { readonly kind: 'number_not_finite'; readonly pathKey: FieldPathKey }
  /**
   * A `money` position whose stored value is not in `MoneyWire` form. `field`
   * names the first key that is missing or mistyped, or is `null` when the
   * value is not an object at all.
   *
   * 🛑 A JSON NUMBER AT A `money` POSITION LANDS HERE, AND THAT IS THE SHARPEST
   *    DECISION IN THIS FILE. E1's own fixture stores the JSON number `1000` at
   *    a position declared `money`. It is refused. **A number carries no
   *    currency and no exponent**, and there are exactly two ways to turn one
   *    into a `Money`: refuse, or supply a denomination nobody declared.
   *    `minorUnitsFromCount()` exists and is deliberately NOT called here — it
   *    converts a CONFIGURED number, where the operator supplied the unit
   *    separately; there is no unit here to supply. **The declaration says this
   *    position is money. It does not say WHICH money, and this module does not
   *    guess** — `PRODUCT.md`'s *"do not invent one"* reaching the one field in
   *    the product where inventing is arithmetic rather than prose.
   */
  | {
      readonly kind: 'money_not_in_wire_form'
      readonly pathKey: FieldPathKey
      readonly found: JsonShape
      readonly field: MoneyWireField | null
    }
  /**
   * The value WAS in wire form and `model/money.ts` refused it — C16's unit
   * guards, or an amount that is not `^-?[0-9]+$`, or one outside the `int8`
   * range G65 declares money is stored in.
   *
   * ⚠️ THE REFUSAL IS CARRIED WHOLE AND NOT RE-SPELLED. `MoneyRefusal` is the
   *    codec's own vocabulary, it is already proven text-free
   *    (`_MoneyRefusalHoldsNoText`), and `tools/check-wire-mirror.mjs` pins it
   *    against the contract AS A SEQUENCE. Restating an arm of it here would be
   *    a second money vocabulary, which is the thing G111 exists to prevent.
   */
  | {
      readonly kind: 'money_refused'
      readonly pathKey: FieldPathKey
      readonly refusal: MoneyRefusal
    }

/**
 * 🛑 THE CONTAINMENT PROOF, AND IT IS NOT DECORATIVE — IT IS WHY THE ARMS ABOVE
 *    CARRY A `pathKey` AND NOT A `FieldPath`.
 *
 * `AssertNoTextDeep` bans the TYPE `string` at a property position.
 * `FieldPath` is `readonly FieldSegment[]`, and `FieldSegment`'s `key` arm is a
 * bare `string` — **a path names counterparty-chosen JSON keys**. So a refusal
 * carrying the path it refused is a `TS2344`, exactly as `AssertNoTextDeep
 * <HeldRead>` is, and that is **the proof biting rather than a site somebody
 * forgot**. `tests/model/extraction.test.ts` §5 asserts the error with a
 * `@ts-expect-error` so the absence cannot be read as an oversight and nobody
 * "fixes" it by weakening the proof.
 */
export type _ExtractionRefusalHoldsNoText = AssertNoTextDeep<ExtractionRefusal>

/* ==================================================================== *
 * §3  WHAT GOES IN, AND WHAT COMES OUT
 * ==================================================================== */

/**
 * One position, as `server/data-plane/payload-store.ts` publishes it.
 *
 * 🛑 IT IS A NARROWED PROJECTION AND NOT AN IMPORT, BECAUSE `model/` MAY NOT
 *    REACH INTO `server/`. `AddressableValue` is declared beside the reader and
 *    carries two fields this conversion has no business seeing — `dataClass`
 *    and `modelProcessingAllowed` are invariant 4's OTHER axis, and they govern
 *    who may read the value rather than what the value is. **An
 *    `AddressableValue` satisfies this structurally**, which is
 *    `ExtractionFn`'s own arrangement one module over: *"`extract` is INJECTED
 *    rather than imported"*.
 *
 * ⚠️ AND THE NARROWING IS A CONTROL RATHER THAN TIDINESS. A converter that
 *    could see `dataClass` could branch on it, and a converter that branches on
 *    a classification is a second, undeclared place where classification
 *    decides something — which is the sentence invariant 4 exists to make
 *    false. It sees a key, a declared type, and a value.
 */
export interface AddressablePosition {
  readonly pathKey: FieldPathKey
  readonly dataType: DataType
  readonly value: Json
}

export type ExtractionOutcome =
  | { readonly ok: true; readonly extracted: ExtractedValue }
  | { readonly ok: false; readonly refusal: ExtractionRefusal }

/**
 * What a deterministically parsed position knows about where it came from.
 *
 * 🛑 THREE NULLS, AND EACH IS A DIFFERENT STATEMENT RATHER THAN A PLACEHOLDER.
 *    `page` and `boundingBox` are `Provenance`'s reason for existing — *"Renders
 *    as a highlight over the source"* — and a position inside a JSON payload
 *    has no page to highlight and no box to draw. **`confidence` is the
 *    declared absence of a confidence**, not an unknown one: a parse either
 *    found the key or it did not, and there is no probability in between.
 *    Reporting `1.0` would manufacture a certainty and would silently clear
 *    every floor ever declared.
 */
const DETERMINISTIC_PROVENANCE: Provenance = {
  page: null,
  boundingBox: null,
  confidence: null,
}

/* ==================================================================== *
 * §4  THE FENCE — R12, at the one predicate
 * ==================================================================== */

/**
 * Whether extraction is BUILT for this acquisition rung — R12, G1452.
 *
 * Derived from `model/ingestion.ts`'s total record and stated in exactly one
 * place, so `addressableToExtracted()` and any future caller wanting to refuse
 * a whole document once rather than per position ask the same question of the
 * same table. **Two entry points, one implementation.**
 *
 * ⚠️ A CALLER SHOULD ASK THIS BEFORE IT LOOPS. The converter refuses every
 *    position of a `scanned` document identically, and a document-level refusal
 *    reported once is what an operator can act on; ten thousand identical
 *    position-level refusals is the same fact, spelled expensively.
 */
export function extractionIsBuiltFor(fidelity: AcquisitionFidelity): boolean {
  return !FIDELITY_CROSSES_MANAGED_SERVICE[fidelity]
}

/* ==================================================================== *
 * §5  THE CONVERSION
 * ==================================================================== */

function refuse(refusal: ExtractionRefusal): ExtractionOutcome {
  return { ok: false, refusal }
}

function admit(scalar: ExtractedScalar): ExtractionOutcome {
  return { ok: true, extracted: { scalar, provenance: DETERMINISTIC_PROVENANCE } }
}

/**
 * Read `MoneyWire` out of a stored value, or say which field refused it.
 *
 * 🛑 IT CONSTRUCTS A `MoneyWire` RATHER THAN CASTING TO ONE, AND THAT IS THE
 *    COMPILE-CHECKED HALF. A cast after three `typeof` checks is sound only
 *    while `MoneyWire` has three fields; the literal below is a `TS2741` the
 *    day it gains a fourth, which is the same guarantee
 *    `EXTRACTED_KIND_FOR_DATA_TYPE` gives on the other vocabulary.
 */
function moneyWireFrom(
  value: Json,
): { ok: true; wire: MoneyWire } | { ok: false; field: MoneyWireField } {
  const record = value as Record<string, unknown>
  if (typeof record['currency'] !== 'string') return { ok: false, field: 'currency' }
  if (typeof record['amountMinor'] !== 'string') return { ok: false, field: 'amountMinor' }
  if (typeof record['exponent'] !== 'number') return { ok: false, field: 'exponent' }
  return {
    ok: true,
    wire: {
      currency: record['currency'],
      amountMinor: record['amountMinor'],
      exponent: record['exponent'],
    },
  }
}

/**
 * THE ONE CONVERSION SEAM — a stored position and its document's declared
 * fidelity in, an `ExtractedValue` or a named refusal out. G1451–G1459.
 *
 * PURE, TOTAL, NEVER THROWS. It dispatches on `position.dataType` — the
 * OPERATOR's declaration — and consults `position.value` only to decide whether
 * the value can be what the declaration says. **The order of the three gates is
 * the design:**
 *
 *   1. **FIDELITY**, first and outermost, because R12 is about the PATH and not
 *      about any particular value. A `scanned` document's `null` position is
 *      still part of a document this repository has no ruling to extract.
 *   2. **ABSENCE**, second, because a stored `null` is a declared position
 *      holding nothing — `{ kind: 'absent' }` — and no `DataType` produces that
 *      arm. `admitOne` turns it into `field_absent`, which already exists.
 *   3. **THE DECLARED TYPE**, last, over a value that is present.
 */
export function addressableToExtracted(
  position: AddressablePosition,
  expectedFidelity: AcquisitionFidelity,
): ExtractionOutcome {
  const pathKey = position.pathKey

  /* --- 1. the R12 fence --- */
  if (!extractionIsBuiltFor(expectedFidelity)) {
    return refuse({
      kind: 'fidelity_crosses_managed_service',
      pathKey,
      fidelity: expectedFidelity,
    })
  }

  /* --- 2. absence, before the declaration is consulted --- */
  const value = position.value
  if (value === null || value === undefined) return admit({ kind: 'absent' })

  const found = jsonShapeOf(value)
  const declared = position.dataType
  const disagrees = (): ExtractionOutcome =>
    refuse({ kind: 'value_shape_disagrees_with_declared_type', pathKey, declared, found })

  /* --- 3. the declared type, and nothing else --- *
   *
   * 🛑 THE SWITCH IS OVER `DATA_TYPES`' MEMBERS AND IS EXHAUSTIVE, WHICH THE
   *    `never` ARM BELOW MAKES A COMPILE ERROR RATHER THAN A FALLTHROUGH. The
   *    image of each arm is `EXTRACTED_KIND_FOR_DATA_TYPE`'s — restated as
   *    literals here because `ExtractedScalar` is a DISCRIMINATED UNION and its
   *    `value` type differs per arm, so an indexed kind cannot construct one.
   *    §6 of the test suite joins the two and requires them to agree, so the
   *    record is not decoration. */
  switch (declared) {
    case DATA_TYPES.string:
      return typeof value === 'string' ? admit({ kind: 'text', value }) : disagrees()

    case DATA_TYPES.identifier:
      return typeof value === 'string' ? admit({ kind: 'identifier', value }) : disagrees()

    case DATA_TYPES.date:
      /* The STRING is this module's question; the CALENDAR is `admitOne`'s,
       * through `parseCalendarDate()`, which already refuses by name. */
      return typeof value === 'string' ? admit({ kind: 'date', value }) : disagrees()

    case DATA_TYPES.number:
      if (typeof value !== 'number') return disagrees()
      if (!Number.isFinite(value)) return refuse({ kind: 'number_not_finite', pathKey })
      return admit({ kind: 'number', value })

    case DATA_TYPES.money: {
      if (found !== JSON_SHAPES.object) {
        return refuse({ kind: 'money_not_in_wire_form', pathKey, found, field: null })
      }
      const wire = moneyWireFrom(value)
      if (!wire.ok) {
        return refuse({ kind: 'money_not_in_wire_form', pathKey, found, field: wire.field })
      }
      /* 🛑 G111. THE ONLY CONVERSION, AND IT IS NOT PERFORMED HERE. */
      const money = parseMoneyWire(wire.wire)
      if (!money.ok) return refuse({ kind: 'money_refused', pathKey, refusal: money.refusal })
      return admit({ kind: 'money', value: money.value })
    }

    default: {
      const exhaustive: never = declared
      return exhaustive
    }
  }
}
