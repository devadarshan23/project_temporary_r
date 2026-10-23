/**
 * DOCUMENT ASSEMBLY — THE FIRST THING IN THIS REPOSITORY THAT PRODUCES AN
 * `ExtractedValue`. G1501–G1508, 21 Sep 2026. E4 of the completion plan's W1.
 *
 * ┌─ WHAT THIS CLOSES, MEASURED BEFORE IT WAS WRITTEN ─────────────────────────┐
 * │   grep -rn 'ExtractedValue|ExtractedLine' server/ | grep -v '^\S*: *\*'    │
 * │     → 0                                                                    │
 * │                                                                            │
 * │ `definition-store.ts` §0 says so in its own voice and calls the two        │
 * │ document arrays *"CANNOT BE REPRESENTED"*; `run-worker.ts`'s header says   │
 * │ the worker *"DELIBERATELY RECONCILES NOTHING"*. **This module is the       │
 * │ commit that changes the first sentence.** Both files are corrected on      │
 * │ their own faces rather than rewritten.                                     │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * §0  INVARIANT 4 IS THE WHOLE DESIGN, AND THIS MODULE ADDS NO SECOND
 *     CLASSIFICATION DECISION. Copy it, never paraphrase it:
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     "Classification is declared once, on `FieldSpec`, and everything derives
 *      from it."
 *
 * There are exactly two classification facts on this path and **this module
 * decides NEITHER of them**:
 *
 *   · the SCALAR KIND is `FieldSpec.dataType`, stored by `db/migrations/0170`
 *     (E1), published by `readAddressablePayload()`, and dispatched on by
 *     `model/extraction.ts` (E2) — which never looks at the value to decide
 *     what the value is.
 *   · the FIDELITY is `DocumentType.expectedFidelity`, stored by
 *     `db/migrations/0180` (E3) and READ here. It is a property of the TYPE and
 *     never of the artefact, so a supplier who starts sending scans is visible
 *     as a type change rather than as model-tuning drift.
 *
 * **This module reads both and infers neither.** If a future reader finds
 * itself asking *"what kind of thing does this look like"*, that is the defect
 * G106 refused, arriving on a third axis.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * §0a  WHAT IT DOES NOT DO, SO NOBODY READS IT AS MORE THAN IT IS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   · **It mounts nothing and declares nothing.** No contract operation on any
 *     of the seven tiers assembles a document set. Derive the served set,
 *     never read it:
 *       node tools/served-set.mjs          # 30 of 136, by tier
 *     ⚠️ A RECURSIVE GREP FOR THE HANDLER KEY STOOD HERE AND THIS HEADER WAS
 *     ONE OF THE LINES IT COUNTED — G2081, 23 Sep 2026. It also answered once
 *     per TIER MOUNT rather than once per operation, so it could not reach the
 *     number it was quoted for at all. The two paths used to be spelled out
 *     here to dodge a block comment's terminator; the tool removes the dodge
 *     and the miscount together.
 *   · **It writes nothing.** Every table it touches grants `SELECT` alone —
 *     `0012` §5, `0150` §3 and `0180` — and the arguments are on those
 *     migrations' faces. The sharpest is `0150`'s: **a caller who chooses the
 *     operands chooses the answer.**
 *   · **It reaches no model**, which is invariant 6 held by there being no such
 *     call rather than by a rule about one. The documents it assembles are
 *     COUNTERPARTY-CONTROLLED and none of their content reaches a prompt from
 *     here. ⚠️ **DERIVE IT WITH THE `grep -v`, BECAUSE THE BARE FORM COUNTS
 *     ITS OWN ARGUMENT — G978, and this file is the FOURTH prose line it
 *     counts:**
 *
 *       grep -rn 'resolveModel(' server/ | grep -v ': *\*' | wc -l        # 0
 *
 *     The bare command answers 4 and ALL FOUR ARE COMMENTS SAYING THE CALL DOES
 *     NOT HAPPEN — `correspondence.ts` and `correspondence-store.ts` among
 *     them. **So its answer is dominated by prose and is not a measurement of
 *     the property at all**: it is non-zero on a tree with no model call
 *     anywhere, which is precisely why a reader must not take a number from it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * §0b  `lines` IS ALWAYS `[]`, AND THAT IS A REFUSAL RATHER THAN A DEFAULT —
 *      G1504, AND IT IS THE FINDING OF THIS SLICE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `readAddressablePayload()` is HEADER-GRAIN. It loops
 * `tenant.document_field_spec` — one row per DECLARED POSITION — and returns
 * one flat `Record<FieldPathKey, AddressableValue>`. **There is no line-grain
 * read anywhere in this repository**, so `ExtractedLine[]` has no producer and
 * none can be manufactured here.
 *
 * 🛑 AN EMPTY `lines` IS NOT INERT. `presentedRows()` in
 *    `model/reconciliation.ts` returns **exactly one row** when
 *    `lines.length === 0`. So a ledger whose declarations address
 *    `lines[0].ref`, `lines[1].ref`, `lines[2].ref` comes back as ONE
 *    transaction carrying three keys — `presented: 1`, `admitted: 1` — and
 *    **C18 raises nothing when the format declares no trailer.** That is a run
 *    that reconciles one row of three and reports success, which is the exact
 *    failure `db/tenant-scope.ts`'s deny-on-NULL paragraph warns about,
 *    arriving through extraction instead of through RLS.
 *
 * **So an indexed declaration is REFUSED**, `line_grain_not_representable`.
 * The predicate is *does any declared path this document actually carries
 * address an ARRAY POSITION* — the PROPERTY — and never *"is this document
 * type called a ledger"*, which is the landmark (§5.1).
 *
 * ⚠️ THE CHECK RUNS OVER POSITIONS THE PAYLOAD CARRIES AND NOT OVER
 *    `declaredButAbsent`, WHOSE PATHS THE READER DOES NOT PUBLISH — and that
 *    is the right domain rather than a gap: an absent position contributes no
 *    value, so it cannot participate in the under-count this refusal exists to
 *    prevent. Reading the keys instead would also mean inspecting a
 *    `FieldPathKey`, which `model/kernel.ts` declares ONE-WAY.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * §0c  THE SIDES ARE JOINED BY DOCUMENT TYPE, WHICH IS DECLARED — G1505
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `PopulationBinding.spec.documentTypeId` is what says which population a
 * document belongs to, and it is the only join available: `tenant.definition_slot`
 * carries a slot NAME and a cardinality and nothing about a side.
 *
 * **A bound document whose type is neither side's is REFUSED** rather than
 * dropped — dropping it would silently shrink a population, and a population
 * that is quietly one document short still balances against itself.
 * **Two sides declaring ONE document type is refused ONCE, at the definition**,
 * because then every document matches both and there is no answer to give.
 */

import type { ScopedClient } from '../../db/tenant-scope.ts'
import type {
  AcquisitionFidelity,
  DefinitionId,
  ExtractedValue,
  FieldPathKey,
  SourceDocumentId,
  TenantId,
} from '../../model/domain.ts'
import type {
  AssertNoTextDeep,
  PopulationBinding,
  ReconciliationDocument,
} from '../../model/reconciliation.ts'
import type { ExtractionRefusal } from '../../model/extraction.ts'
import { addressableToExtracted, extractionIsBuiltFor } from '../../model/extraction.ts'
import { readAddressablePayload } from './payload-store.ts'
import { readDocumentControlTotal, readDocumentType } from './document-type-store.ts'
import { readSlotFill } from './run-admission.ts'

/* ==================================================================== *
 * §1  WHAT CAN GO WRONG
 * ==================================================================== */

/**
 * WHERE A STORED ROW REFUSED THE READ, BY TABLE AND COLUMN AND NEVER BY VALUE.
 *
 * 🛑 IT TRAVELS BESIDE THE REFUSAL AND NOT INSIDE IT, WHICH IS
 *    `model/run-admission.ts`'s ARRANGEMENT AND NOT A STYLE CHOICE. That module
 *    puts its unfilled slot names *"on a separate field outside the proof,
 *    because `SlotName` is `= string` and bare"*. `table` and `column` are ours
 *    rather than counterparty text, but they are bare `string`s all the same,
 *    and `AssertNoTextDeep` bans the TYPE at a property position rather than
 *    judging provenance. Putting them on the union would defeat the proof for
 *    every arm at once.
 */
export interface AssemblyDefect {
  readonly table: string
  readonly column: string
  readonly sourceDocumentId: string
}

/**
 * Every way a bound document can fail to become an engine operand.
 *
 * 🛑 EVERY ARM CARRIES BRANDED IDS AND CLOSED VOCABULARIES ONLY, so
 *    `AssertNoTextDeep` holds — see the proof below. **No payload value, no
 *    path and no filename may ever be added to this union**: the documents
 *    this module reads are counterparty-controlled, and a refusal is the one
 *    thing that travels furthest from where it was raised.
 */
export type DocumentAssemblyRefusal =
  /**
   * The two populations name the same `DocumentType`, so every bound document
   * belongs to both and none can be routed. Refused ONCE, about the
   * DEFINITION, before a single document is read.
   */
  | { readonly kind: 'sides_share_a_document_type' }
  /**
   * A binding points at a document this scope cannot see. Under G100 that is
   * also what a scope that failed to bind looks like, which is the deny-on-NULL
   * posture working rather than a case to special-case.
   */
  | { readonly kind: 'document_not_found'; readonly sourceDocumentId: SourceDocumentId }
  /** A stored row carried something the model cannot name. `defect` says where. */
  | { readonly kind: 'document_unreadable'; readonly sourceDocumentId: SourceDocumentId }
  /**
   * R12. This document's declared fidelity crosses a managed-service boundary,
   * so extraction for it is NOT BUILT — not forbidden, and not silently
   * skipped. **Refused once at the DOCUMENT and never once per position**,
   * which is `model/extraction.ts`'s own instruction: ten thousand identical
   * position-level refusals is the same fact, spelled expensively.
   */
  | {
      readonly kind: 'fidelity_crosses_managed_service'
      readonly sourceDocumentId: SourceDocumentId
      readonly fidelity: AcquisitionFidelity
    }
  /** §0b. A declared position addresses an array element. */
  | {
      readonly kind: 'line_grain_not_representable'
      readonly sourceDocumentId: SourceDocumentId
      readonly pathKey: FieldPathKey
    }
  /**
   * The conversion seam refused a position. **The whole `ExtractionRefusal` is
   * carried**, because its arms are the operator's diagnosis — *"this money is
   * malformed"* against *"this money has no currency"* — and it is itself under
   * a containment proof one module over.
   */
  | {
      readonly kind: 'position_not_extractable'
      readonly sourceDocumentId: SourceDocumentId
      readonly refusal: ExtractionRefusal
    }
  /** §0c. A bound document belongs to neither population. */
  | { readonly kind: 'document_matches_no_side'; readonly sourceDocumentId: SourceDocumentId }

/**
 * 🛑 THE PROOF, AND IT BITES. `AssertNoTextDeep` bans the TYPE `string` at a
 *    property position, so adding a `filename`, a payload value or a
 *    `FieldPath` to any arm above is a `TS2344` HERE rather than a review
 *    somebody has to remember to do. `tests/db/document-assembly.test.ts` §6 is
 *    the runtime half.
 */
export type _DocumentAssemblyRefusalHoldsNoText = AssertNoTextDeep<DocumentAssemblyRefusal>

export type DocumentAssemblyOutcome =
  | {
      readonly ok: true
      readonly left: readonly ReconciliationDocument[]
      readonly right: readonly ReconciliationDocument[]
      /**
       * G3744 — the slot each assembled document was BOUND to (`0150`), keyed
       * by source document id. `ObservedValue.slot` is required on a raised
       * exception and this binding is the only place a document's slot is
       * recorded; reading it again in the raiser would be a second spelling of
       * `readSlotFill()` (§5.3), so it is carried out of the one read.
       */
      readonly slotOf: ReadonlyMap<string, string>
    }
  | {
      readonly ok: false
      readonly refusal: DocumentAssemblyRefusal
      /** Non-null only on `document_unreadable`. See `AssemblyDefect`. */
      readonly defect: AssemblyDefect | null
    }

export interface AssemblyInput {
  /**
   * ⚠️ **THE SCOPE'S TENANT, NEVER A COLUMN'S.** Invariant 1: *"Tenant scope is
   * derived from the session, never read from a request."* `tenant.source_document`
   * HAS a `tenant_id` column, and it is there because the POLICY keys on it —
   * reading it back as the answer would compare a value against itself, which
   * is `definition-store.ts`'s `RunOperands.tenantId` argument one file over.
   */
  readonly tenantId: TenantId
  readonly definitionId: DefinitionId
  /**
   * ⚠️ A NULL PERIOD IS THE UNPERIODISED FILL AND NOT A WILDCARD — `0150` §2,
   * and `readSlotFill()` is where `IS NOT DISTINCT FROM` makes that true.
   */
  readonly periodId: string | null
  readonly left: PopulationBinding
  readonly right: PopulationBinding
}

/* ==================================================================== *
 * §2  ONE DOCUMENT
 * ==================================================================== */

type OneDocument =
  | { readonly ok: true; readonly documentTypeId: string; readonly document: ReconciliationDocument }
  | {
      readonly ok: false
      readonly refusal: DocumentAssemblyRefusal
      readonly defect: AssemblyDefect | null
    }

async function assembleOne(
  tx: ScopedClient,
  tenantId: TenantId,
  sourceDocumentId: SourceDocumentId,
): Promise<OneDocument> {
  const bad = (
    refusal: DocumentAssemblyRefusal,
    defect: AssemblyDefect | null = null,
  ): OneDocument => ({ ok: false, refusal, defect })

  /* ---- the payload, and the type it is addressed by ---- */
  const payload = await readAddressablePayload(tx, sourceDocumentId)
  if (payload.kind === 'no_document') {
    return bad({ kind: 'document_not_found', sourceDocumentId })
  }
  if (payload.kind === 'unpublishable') {
    return bad(
      { kind: 'document_unreadable', sourceDocumentId },
      { ...payload.defect, sourceDocumentId },
    )
  }

  /* ---- the DECLARATION that says what rung this arrived on ----
   *
   * 🛑 `expectedFidelity` COMES FROM THE TYPE AND NOT FROM THE DEFINITION'S
   *    COPY OF ANYTHING. R11's own note names this obligation on E4 by name:
   *    `0160`'s `definition_population.carries_control_total` is a SECOND
   *    spelling of a `DocumentType` declaration, kept only because G88 is
   *    forward-only, and **this module reads the TYPE**. */
  const documentType = await readDocumentType(tx, payload.documentTypeId)
  if (documentType.kind === 'no_document_type') {
    return bad(
      { kind: 'document_unreadable', sourceDocumentId },
      { table: 'document_type', column: 'id', sourceDocumentId },
    )
  }
  if (documentType.kind === 'unreadable') {
    return bad(
      { kind: 'document_unreadable', sourceDocumentId },
      { ...documentType.defect, sourceDocumentId },
    )
  }
  const fidelity = documentType.documentType.expectedFidelity

  /* ---- R12, FIRST AND OUTERMOST, at the DOCUMENT ----
   *
   * `model/extraction.ts` refuses every position of such a document
   * identically; asking once here is that module's own instruction, and it is
   * what makes the answer something an operator can act on. */
  if (!extractionIsBuiltFor(fidelity)) {
    return bad({ kind: 'fidelity_crosses_managed_service', sourceDocumentId, fidelity })
  }

  /* ---- the trailer, in three arms and never a default ---- */
  const control = await readDocumentControlTotal(tx, sourceDocumentId)
  if (control.kind === 'unreadable') {
    return bad(
      { kind: 'document_unreadable', sourceDocumentId },
      { ...control.defect, sourceDocumentId },
    )
  }

  /* ---- every declared position this document carries ---- */
  const extracted: Record<FieldPathKey, ExtractedValue> = {}
  for (const [pathKey, position] of Object.entries(payload.addressable)) {
    const key = pathKey as FieldPathKey

    /* §0b — the line-grain refusal, BEFORE the conversion, because a payload
     * this reader cannot represent must not be half-converted first. */
    if (position.path.some((segment) => typeof segment === 'number')) {
      return bad({ kind: 'line_grain_not_representable', sourceDocumentId, pathKey: key })
    }

    /* 🛑 THE NARROWED PROJECTION IS THE CONTROL. `AddressablePosition` carries
     * a key, a declared TYPE and a value — and deliberately not `dataClass` or
     * `modelProcessingAllowed`, which govern WHO MAY READ rather than WHAT IT
     * IS. An `AddressableValue` satisfies it structurally, so the narrowing
     * costs nothing and a converter that could branch on a classification is
     * unrepresentable. */
    const outcome = addressableToExtracted(
      { pathKey: key, dataType: position.dataType, value: position.value },
      fidelity,
    )
    if (!outcome.ok) {
      return bad({ kind: 'position_not_extractable', sourceDocumentId, refusal: outcome.refusal })
    }
    extracted[key] = outcome.extracted
  }

  return {
    ok: true,
    documentTypeId: payload.documentTypeId,
    document: {
      /* Invariant 1 — the SCOPE's. */
      tenantId,
      id: sourceDocumentId,
      extracted,
      /* §0b. Not a placeholder: an indexed declaration never reaches here. */
      lines: [],
      controlTotal: control.controlTotal,
    },
  }
}

/* ==================================================================== *
 * §3  THE RUN'S TWO POPULATIONS
 * ==================================================================== */

/**
 * Every document bound to this definition's slots, converted and routed.
 *
 * ⚠️ **AN EMPTY SIDE IS NOT AN ERROR HERE AND MUST NOT BECOME ONE.**
 * `PopulationBinding.emptyExpectation` is the engine's declaration — `refuses`
 * or `permitted` — and answering it in two places is §5.3, with the copy being
 * the one that drifts. This module reports what was bound; `runSetReconciliation()`
 * judges whether that is allowed.
 */
export async function assembleRunDocuments(
  tx: ScopedClient,
  input: AssemblyInput,
): Promise<DocumentAssemblyOutcome> {
  const leftType = input.left.spec.documentTypeId as string
  const rightType = input.right.spec.documentTypeId as string

  /* §0c — refused ONCE, about the definition, before any document is read. */
  if (leftType === rightType) {
    return { ok: false, refusal: { kind: 'sides_share_a_document_type' }, defect: null }
  }

  /* 🛑 ONE READER, TWO CALLERS. `readSlotFill()` is `run-admission.ts`'s and is
   * EXPORTED rather than copied: a second query here would be two spellings of
   * *"what is bound to this definition for this period"*, and `0150`'s
   * `IS NOT DISTINCT FROM` is exactly the half a copy gets wrong — `= $2`
   * returns no rows for every unperiodised run, silently. */
  const fill = await readSlotFill(tx, input.definitionId, input.periodId)

  const left: ReconciliationDocument[] = []
  const right: ReconciliationDocument[] = []
  const slotOf = new Map<string, string>()

  for (const slot of fill) {
    for (const sourceDocumentId of slot.documentIds) {
      slotOf.set(sourceDocumentId as string, slot.slot)
      const one = await assembleOne(tx, input.tenantId, sourceDocumentId)
      if (!one.ok) return { ok: false, refusal: one.refusal, defect: one.defect }

      if (one.documentTypeId === leftType) left.push(one.document)
      else if (one.documentTypeId === rightType) right.push(one.document)
      else {
        /* Refused rather than dropped: a population quietly one document short
         * still balances against itself, and nothing downstream could tell. */
        return {
          ok: false,
          refusal: { kind: 'document_matches_no_side', sourceDocumentId },
          defect: null,
        }
      }
    }
  }

  return { ok: true, left, right, slotOf }
}
