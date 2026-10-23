/**
 * E2 — THE ONE CONVERSION SEAM, WITNESSED BY FIXTURES THAT CONSTRUCT VALUES.
 * G1451–G1459, 21 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHY THIS FILE EXISTS AT ALL, AND IT IS `CLAUDE.md`'s OWN RULE:
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     "A total `Record` only bites where something CONSTRUCTS one, and in a
 *      types-only model nothing does. … Compile-time assertions hold the SHAPE;
 *      only a fixture witnesses the CONTENT. If you add a field or a key and
 *      `tsc` stays green without you changing anything else, the compiler told
 *      you nothing."
 *
 * `model/extraction.ts` is the first module in `model/` whose total `Record`
 * has a real construction site AND a real caller, so the guarantee is live
 * rather than notional. **It was witnessed by mutation before this file was
 * written**, and the compiler answered TWICE for one edit — adding a sixth
 * `DataType` to `DATA_TYPES`:
 *
 *     model/extraction.ts(198,14): error TS2741: Property 'currency' is missing
 *       in type '{ string: "text"; number: "number"; date: "date";
 *       money: "money"; identifier: "identifier"; }' but required in type
 *       'Record<DataType, "number" | "money" | "text" | "date" | "identifier"
 *       | "absent">'.
 *     model/extraction.ts(572,13): error TS2322: Type '"currency"' is not
 *       assignable to type 'never'.
 *
 * **The first is the record and the second is the switch**, and the pair is the
 * point: a sixth type cannot be added without both naming the scalar arm it
 * produces and writing the branch that produces it. ⚠️ **`payload-store.ts` did
 * NOT error, and that is the design rather than a gap** — since G1453 it derives
 * its member set from `DATA_TYPES` instead of restating it, so there is no
 * second list to fail on, and the one real question fails in one place.
 *
 * ⚠️ AND THE SNIFF THIS MODULE REFUSES WAS MEASURED BEFORE ANY CODE WAS
 *    WRITTEN, against E1's own fixture rows — **four of four DISAGREED** with
 *    the operator's declaration under a `typeof`-dispatching converter:
 *
 *     invoice.total    declared=money       stored=1000          sniffed=number
 *     invoice.nric     declared=identifier  stored="S1234567D"   sniffed=text
 *     lines[0].ref     declared=identifier  stored="0012"        sniffed=text
 *     invoice.issued   declared=date        stored="2026-09-21"  sniffed=text
 *
 * §7 is that measurement kept RUNNABLE rather than narrated.
 */

import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  addressableToExtracted,
  extractionIsBuiltFor,
  jsonShapeOf,
  EXTRACTED_KIND_FOR_DATA_TYPE,
  JSON_SHAPES,
} from '../../model/extraction.ts'
import type { AddressablePosition, ExtractionOutcome } from '../../model/extraction.ts'
import { DATA_TYPES, ACQUISITION_FIDELITY } from '../../model/domain.ts'
import type { AcquisitionFidelity, DataType, ExtractedScalar } from '../../model/domain.ts'
import { FIDELITY_CROSSES_MANAGED_SERVICE } from '../../model/ingestion.ts'
import { fieldPathKey, parseFieldPath } from '../../model/field-path.ts'
import type { FieldPath, FieldPathKey, Json } from '../../model/kernel.ts'
import type { AssertNoTextDeep } from '../../model/reconciliation.ts'
import type { ExtractionRefusal } from '../../model/extraction.ts'

/* -------------------------------------------------------------------- *
 * Fixtures — a real `FieldPathKey` through the one seam, never a cast.
 * -------------------------------------------------------------------- */

function pathOf(...tokens: readonly (string | number)[]): FieldPath {
  const parsed = parseFieldPath(tokens)
  assert.ok(parsed.ok, 'the fixture path must parse through the one seam')
  return parsed.path
}

const TOTAL_KEY: FieldPathKey = fieldPathKey(pathOf('invoice', 'total'))

function position(dataType: DataType, value: Json): AddressablePosition {
  return { pathKey: TOTAL_KEY, dataType, value }
}

/** Every fixture runs on a fidelity that does NOT cross a managed service. */
const BUILT: AcquisitionFidelity = ACQUISITION_FIDELITY.structured

/**
 * ⚠️ `JSON.stringify` ON AN OUTCOME CARRYING A `Money` **THROWS**, AND G71
 * NAMES THAT AS A FEATURE — *"it forces the boundary decision at the boundary
 * rather than letting it drift to call sites."* The first draft of these two
 * helpers built their failure message eagerly and took the whole money suite
 * down with `TypeError: Do not know how to serialize a BigInt` **on the test
 * that passed**. Kept as a bigint-safe `show()` rather than by removing the
 * message, because a refusal you cannot read is a test you cannot debug.
 */
function show(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v))
}

function admitted(outcome: ExtractionOutcome): ExtractedScalar {
  assert.ok(outcome.ok, `expected an admitted value, got ${show(outcome)}`)
  return outcome.extracted.scalar
}

function refused(outcome: ExtractionOutcome): ExtractionRefusal {
  assert.ok(!outcome.ok, `expected a refusal, got ${show(outcome)}`)
  return outcome.refusal
}

/* ====================================================================== *
 * §1  THE TOTAL RECORD — arity, image, and the fact that it is CONSULTED
 * ====================================================================== */

describe('§1 the DataType → ExtractedScalar map', () => {
  it('is total over DATA_TYPES and over nothing else', () => {
    assert.deepEqual(
      Object.keys(EXTRACTED_KIND_FOR_DATA_TYPE).sort(),
      Object.values(DATA_TYPES).sort(),
      'the record keys must be exactly the declared DataType members',
    )
  })

  it('excludes `absent` from its image, because absence is not declarable', () => {
    const image = new Set(Object.values(EXTRACTED_KIND_FOR_DATA_TYPE))
    assert.ok(!image.has('absent'), 'no DataType may produce the `absent` arm')
    assert.equal(image.size, 5, 'five declared types, five distinct scalar arms')
  })

  it('AGREES WITH THE FUNCTION on every member — the record is not decoration', () => {
    /* 🛑 THIS IS THE ASSERTION THAT MAKES THE RECORD LOAD-BEARING. The switch
     * in `addressableToExtracted()` restates each arm as a literal, because
     * `ExtractedScalar` is a discriminated union whose `value` type differs per
     * arm and an indexed kind cannot construct one. A record nothing joins to
     * the code is a comment. */
    const sample: Record<DataType, Json> = {
      string: 'a note',
      number: 42,
      date: '2026-09-21',
      identifier: 'S1234567D',
      money: { currency: 'SGD', amountMinor: '1000', exponent: 2 },
    }
    for (const declared of Object.values(DATA_TYPES)) {
      const scalar = admitted(addressableToExtracted(position(declared, sample[declared]), BUILT))
      assert.equal(
        scalar.kind,
        EXTRACTED_KIND_FOR_DATA_TYPE[declared],
        `${declared} must produce the arm the record names`,
      )
    }
  })
})

/* ====================================================================== *
 * §2  THE R12 FENCE — keyed on the property, not on a list of names
 * ====================================================================== */

describe('§2 the R12 fidelity fence', () => {
  it('refuses EXACTLY the fidelities that cross a managed-service boundary', () => {
    /* 🛑 DERIVED FROM `model/ingestion.ts`'s RECORD, NEVER FROM A LIST HERE. A
     * test naming `digital_text` and `scanned` would pass against a fence that
     * had silently stopped agreeing with the cascade — §5.1, in the control. */
    for (const fidelity of Object.values(ACQUISITION_FIDELITY)) {
      const crosses = FIDELITY_CROSSES_MANAGED_SERVICE[fidelity]
      assert.equal(
        extractionIsBuiltFor(fidelity),
        !crosses,
        `${fidelity}: built exactly when it crosses no managed service`,
      )
    }
  })

  it('refuses every position of an OCR document, including a well-formed one', () => {
    for (const fidelity of Object.values(ACQUISITION_FIDELITY)) {
      if (!FIDELITY_CROSSES_MANAGED_SERVICE[fidelity]) continue
      const refusal = refused(addressableToExtracted(position(DATA_TYPES.string, 'fine'), fidelity))
      assert.equal(refusal.kind, 'fidelity_crosses_managed_service')
      assert.equal(refusal.pathKey, TOTAL_KEY)
      assert.ok('fidelity' in refusal && refusal.fidelity === fidelity)
    }
  })

  it('refuses BEFORE absence, because R12 is about the PATH and not the value', () => {
    const refusal = refused(addressableToExtracted(position(DATA_TYPES.string, null), 'scanned'))
    assert.equal(
      refusal.kind,
      'fidelity_crosses_managed_service',
      'a null on a scanned document is still a document we have no ruling to extract',
    )
  })

  it('admits both built fidelities identically', () => {
    for (const fidelity of Object.values(ACQUISITION_FIDELITY)) {
      if (FIDELITY_CROSSES_MANAGED_SERVICE[fidelity]) continue
      const scalar = admitted(addressableToExtracted(position(DATA_TYPES.string, 'ok'), fidelity))
      assert.deepEqual(scalar, { kind: 'text', value: 'ok' })
    }
  })
})

/* ====================================================================== *
 * §3  MONEY GOES THROUGH `model/money.ts` AND NOTHING ELSE — G111
 * ====================================================================== */

describe('§3 money', () => {
  it('parses a wire-form money position into a bigint-carrying Money', () => {
    const scalar = admitted(
      addressableToExtracted(
        position(DATA_TYPES.money, { currency: 'SGD', amountMinor: '1000', exponent: 2 }),
        BUILT,
      ),
    )
    assert.equal(scalar.kind, 'money')
    assert.ok(scalar.kind === 'money')
    assert.equal(scalar.value.amountMinor, 1000n)
    assert.equal(typeof scalar.value.amountMinor, 'bigint', 'G286: the model holds a bigint')
    assert.equal(scalar.value.currency, 'SGD')
    assert.equal(scalar.value.exponent, 2)
  })

  it('REFUSES the JSON number E1 stores at a money position — no invented currency', () => {
    /* 🛑 THE SHARPEST ASSERTION IN THIS FILE. `tests/db/payload-and-subject-
     * index.test.ts` declares `invoice.total` as `money` and stores the JSON
     * NUMBER `1000`. A number carries no currency and no exponent, and the only
     * two ways to make a `Money` out of one are to refuse or to supply a
     * denomination nobody declared. `PRODUCT.md`: "Do not invent one." */
    const refusal = refused(addressableToExtracted(position(DATA_TYPES.money, 1000), BUILT))
    assert.equal(refusal.kind, 'money_not_in_wire_form')
    assert.ok('found' in refusal && refusal.found === JSON_SHAPES.number)
    assert.ok('field' in refusal && refusal.field === null, 'not an object at all')
  })

  it('names the FIRST wire field that refused, rather than answering "malformed"', () => {
    const cases: readonly { readonly wire: Json; readonly field: string }[] = [
      { wire: { amountMinor: '1000', exponent: 2 }, field: 'currency' },
      { wire: { currency: 'SGD', exponent: 2 }, field: 'amountMinor' },
      { wire: { currency: 'SGD', amountMinor: '1000' }, field: 'exponent' },
      /* A JSON NUMBER amount is the interesting one: it is the exact shape
       * G111 exists to refuse — a money amount as an IEEE double. */
      { wire: { currency: 'SGD', amountMinor: 1000, exponent: 2 }, field: 'amountMinor' },
    ]
    for (const c of cases) {
      const refusal = refused(addressableToExtracted(position(DATA_TYPES.money, c.wire), BUILT))
      assert.equal(refusal.kind, 'money_not_in_wire_form')
      assert.ok('field' in refusal && refusal.field === c.field, `expected field ${c.field}`)
      assert.ok('found' in refusal && refusal.found === JSON_SHAPES.object)
    }
  })

  it('carries the codec\'s own refusal whole, rather than re-spelling one', () => {
    /* C16: a declared unit whose currency is the empty string. The arm is
     * `model/money.ts`'s and is already proven text-free. */
    const empty = refused(
      addressableToExtracted(
        position(DATA_TYPES.money, { currency: '', amountMinor: '1000', exponent: 2 }),
        BUILT,
      ),
    )
    assert.equal(empty.kind, 'money_refused')
    assert.ok('refusal' in empty && empty.refusal.kind === 'currency_not_stated')

    /* A wire amount that is not `^-?[0-9]+$`. `BigInt('')` is `0n`, which is
     * why the codec anchors its pattern — an absent amount becoming zero. */
    const fractional = refused(
      addressableToExtracted(
        position(DATA_TYPES.money, { currency: 'SGD', amountMinor: '10.50', exponent: 2 }),
        BUILT,
      ),
    )
    assert.equal(fractional.kind, 'money_refused')
    assert.ok('refusal' in fractional && fractional.refusal.kind === 'not_integer_minor_units')
  })

  it('does NOT reach for minorUnitsFromCount — the module names no currency', () => {
    /* 🛑 THIS CONTROL IS KEYED ON THE CODE AND NOT ON THE FILE, AND THE FIRST
     * DRAFT WAS KEYED ON THE FILE AND WENT RED AGAINST ITS OWN SUBJECT. It
     * asserted `!source.includes('minorUnitsFromCount(')` and FAILED, because
     * the module's header explains at length why that function is deliberately
     * not called — so the control was defeated by prose ABOUT the property it
     * protects. That is §5.1 in the control written to hold a §5.1-shaped rule,
     * and it is the identical defect `server/data-plane/payload-store.ts`
     * records about its own header: *"the first draft of this header carried
     * the command verbatim — and the command then matched its own sentence."*
     * **The property is whether the codec's counting function is CALLED**, so
     * the comments come out first. */
    const code = codeOf(readModuleText())
    assert.ok(
      !code.includes('minorUnitsFromCount'),
      'a money position with no declared unit must refuse, never be counted into one',
    )
    assert.ok(
      code.includes('parseMoneyWire('),
      'the one permitted conversion must be the one that is called',
    )
  })
})

/* ====================================================================== *
 * §4  THE DECLARED TYPE DECIDES, AND A DISAGREEMENT IS A REFUSAL
 * ====================================================================== */

describe('§4 declaration against artefact', () => {
  it('admits each declared type over a value that can be it', () => {
    assert.deepEqual(admitted(addressableToExtracted(position(DATA_TYPES.string, 'x'), BUILT)), {
      kind: 'text',
      value: 'x',
    })
    assert.deepEqual(admitted(addressableToExtracted(position(DATA_TYPES.identifier, '0012'), BUILT)), {
      kind: 'identifier',
      value: '0012',
    })
    assert.deepEqual(
      admitted(addressableToExtracted(position(DATA_TYPES.date, '2026-09-21'), BUILT)),
      { kind: 'date', value: '2026-09-21' },
    )
    assert.deepEqual(admitted(addressableToExtracted(position(DATA_TYPES.number, -7), BUILT)), {
      kind: 'number',
      value: -7,
    })
  })

  it('REFUSES a JSON number at an identifier position — "0012" is not "12"', () => {
    /* 🛑 THE COERCION THIS REFUSES IS THE TEMPTING ONE. `String(12)` is total
     * and deterministic and would reconcile an identifier stored `0012` in the
     * source against one delivered as the JSON number `12`. */
    const refusal = refused(addressableToExtracted(position(DATA_TYPES.identifier, 12), BUILT))
    assert.equal(refusal.kind, 'value_shape_disagrees_with_declared_type')
    assert.ok('declared' in refusal && refusal.declared === DATA_TYPES.identifier)
    assert.ok('found' in refusal && refusal.found === JSON_SHAPES.number)
  })

  it('refuses every cross pairing of a declared type and a wrong shape', () => {
    const wrong: readonly { readonly declared: DataType; readonly value: Json }[] = [
      { declared: DATA_TYPES.string, value: 5 },
      { declared: DATA_TYPES.string, value: true },
      { declared: DATA_TYPES.string, value: ['a'] },
      { declared: DATA_TYPES.date, value: 20260921 },
      { declared: DATA_TYPES.date, value: { iso: '2026-09-21' } },
      { declared: DATA_TYPES.number, value: '42' },
      { declared: DATA_TYPES.identifier, value: { id: 'x' } },
    ]
    for (const c of wrong) {
      const refusal = refused(addressableToExtracted(position(c.declared, c.value), BUILT))
      assert.equal(
        refusal.kind,
        'value_shape_disagrees_with_declared_type',
        `${c.declared} over ${JSON.stringify(c.value)} must refuse`,
      )
      assert.ok('declared' in refusal && refusal.declared === c.declared)
      assert.ok('found' in refusal && refusal.found === jsonShapeOf(c.value))
    }
  })

  it('refuses NaN and infinities at a number position, on their OWN arm', () => {
    /* The shape AGREES — `NaN` is a number — so folding this into the shape
     * disagreement would name the wrong defect. `model/reconciliation.ts`'s
     * OQ-1 is the precedent: admission had no such guard and a `NaN` amount
     * became a ledger item with no address anywhere in the result. */
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const refusal = refused(addressableToExtracted(position(DATA_TYPES.number, value), BUILT))
      assert.equal(refusal.kind, 'number_not_finite')
      assert.equal(refusal.pathKey, TOTAL_KEY)
    }
  })

  it('treats a stored null as ABSENT on every declared type', () => {
    for (const declared of Object.values(DATA_TYPES)) {
      const scalar = admitted(addressableToExtracted(position(declared, null), BUILT))
      assert.deepEqual(scalar, { kind: 'absent' }, `${declared}: a null position is absent`)
    }
  })

  it('does not validate a calendar — that is admitOne\'s one seam', () => {
    /* `2026-02-30` is not a date and this module says so about nothing:
     * `parseCalendarDate()` refuses it at admission by name. A second check
     * here would be two spellings of one rule (§5.3). */
    const scalar = admitted(addressableToExtracted(position(DATA_TYPES.date, '2026-02-30'), BUILT))
    assert.deepEqual(scalar, { kind: 'date', value: '2026-02-30' })
    /* Keyed on the CODE, for the reason §3's own control records: the header
     * names `parseCalendarDate()` in order to say it is not called here, so a
     * file-level check is defeated by the sentence that states the property. */
    assert.ok(
      !codeOf(readModuleText()).includes('parseCalendarDate'),
      'the calendar rule lives in model/reconciliation.ts and must not be copied here',
    )
  })
})

/* ====================================================================== *
 * §5  CONTAINMENT — and the interesting result is the one that FAILS
 *
 * ⚠️ Every `@ts-expect-error` MUST error, or it is `TS2578` and
 * `typecheck:tests` runs before a single assertion here executes. The SAFE
 * case carries no directive, so a proof that over-rejects fails just as loudly.
 * ====================================================================== */

/** The union as declared holds no text, so the proof is not vacuous. */
export type _TheRefusalUnionHoldsNoText = AssertNoTextDeep<ExtractionRefusal>

/**
 * 🛑 `AssertNoTextDeep` OVER A REFUSAL CARRYING A `FieldPath` IS A COMPILE
 * ERROR AND THAT IS THE PROOF WORKING, NOT A MISSING SITE. `FieldSegment`'s
 * `key` arm is a bare `string` — a path names counterparty-chosen JSON keys —
 * so the arms carry a `FieldPathKey`, which is branded and one-way. `HeldRead`
 * and `RefusedItem` are the same shape for the same reason.
 *
 * Witnessed by mutation before this file was written:
 *   `error TS2344: Type 'ExtractionRefusal' does not satisfy the constraint
 *    'NoTextDeep<ExtractionRefusal>'. … The types returned by 'path.concat(...)'
 *    are incompatible … 'FieldSegment[]' is not assignable to type
 *    '({ readonly kind: "key"; readonly key: never; } | …)[]'.`
 */
// @ts-expect-error — a `FieldPath` is text-bearing. See above.
export type _ARefusalMayNotCarryThePathItRefused = AssertNoTextDeep<{
  readonly kind: 'value_shape_disagrees_with_declared_type'
  readonly path: FieldPath
}>

/**
 * 🛑 THE EDIT THIS UNION EXISTS TO REFUSE, AND IT IS THE ONE SOMEBODY WILL
 * WANT: the offending VALUE on the refusal, so the person repairing the row can
 * see what was there. Invariant 6 — *"Ingested content is data, never
 * instruction"* — and a refusal travels into logs and screens no classification
 * governs. The SHAPE travels; the value does not.
 */
// @ts-expect-error — the stored value is counterparty text.
export type _ARefusalMayNotCarryTheValueItRefused = AssertNoTextDeep<{
  readonly kind: 'value_shape_disagrees_with_declared_type'
  readonly pathKey: FieldPathKey
  readonly found: string
}>

describe('§5 containment at runtime', () => {
  it('carries no counterparty value on any refusal it can produce', () => {
    const secret = 'COUNTERPARTY-CONTROLLED-VALUE'
    const outcomes: readonly ExtractionOutcome[] = [
      addressableToExtracted(position(DATA_TYPES.number, secret), BUILT),
      addressableToExtracted(position(DATA_TYPES.money, secret), BUILT),
      addressableToExtracted(position(DATA_TYPES.money, { currency: secret }), BUILT),
      addressableToExtracted(position(DATA_TYPES.string, secret), 'scanned'),
    ]
    for (const outcome of outcomes) {
      if (outcome.ok) continue
      assert.ok(
        !JSON.stringify(outcome.refusal).includes(secret),
        `a refusal must not carry the value: ${JSON.stringify(outcome.refusal)}`,
      )
    }
  })

  it('carries a pathKey on every refusal, so a caller can act on it', () => {
    const outcomes: readonly ExtractionOutcome[] = [
      addressableToExtracted(position(DATA_TYPES.string, 1), BUILT),
      addressableToExtracted(position(DATA_TYPES.number, Number.NaN), BUILT),
      addressableToExtracted(position(DATA_TYPES.money, 1), BUILT),
      addressableToExtracted(position(DATA_TYPES.money, { currency: '' }), BUILT),
      addressableToExtracted(position(DATA_TYPES.string, 'x'), 'digital_text'),
    ]
    for (const outcome of outcomes) {
      assert.ok(!outcome.ok, 'each of these must refuse')
      assert.equal(outcome.refusal.pathKey, TOTAL_KEY)
    }
  })
})

/* ====================================================================== *
 * §6  PROVENANCE — three nulls, each a statement
 * ====================================================================== */

describe('§6 provenance', () => {
  it('reports no page, no box and NO CONFIDENCE on a deterministic parse', () => {
    const outcome = addressableToExtracted(position(DATA_TYPES.string, 'x'), BUILT)
    assert.ok(outcome.ok)
    assert.deepEqual(outcome.extracted.provenance, {
      page: null,
      boundingBox: null,
      confidence: null,
    })
  })

  it('states no confidence NUMBER anywhere in the module', () => {
    /* ⚠️ THE FAIL-CLOSED HOLD THIS LEANS ON IS CURRENTLY INERT AND THE MODULE
     * SAYS SO. `heldReadsFor()` holds only where a FLOOR was declared —
     * `if (floor === undefined) continue` — and G139 records that no authoring
     * surface for floors exists: `db/migrations/0160` gives `confidence_floor`
     * a column and `0012` grants the app role `SELECT` alone, so nothing
     * writes one. Every position this module produces today carries
     * `confidence: null` and NOT ONE OF THEM IS HELD. Manufacturing a `1.0`
     * here would silently clear every floor that is ever declared. */
    const source = readModuleText()
    assert.ok(
      !/confidence:\s*[0-9]/.test(codeOf(source)),
      'model/extraction.ts must state no confidence VALUE, only the declared null',
    )
    /* This one reads the WHOLE file on purpose: it is a claim about the prose. */
    assert.ok(
      source.includes('INERT'),
      'the module must name the inert hold rather than letting a reader assume the nulls are defended',
    )
  })
})

/* ====================================================================== *
 * §7  THE SNIFF, KEPT RUNNABLE — E1's fixture rows, four of four
 * ====================================================================== */

describe('§7 the sniff this module refuses', () => {
  it('disagrees with the declaration on every one of E1\'s fixture rows', () => {
    /* A converter with no declared type has one honest option (refuse
     * everything) and one obvious one (look at the value). These are the rows
     * `tests/db/payload-and-subject-index.test.ts` really stores. */
    const sniff = (v: Json): ExtractedScalar['kind'] =>
      v === null ? 'absent' : typeof v === 'number' ? 'number' : 'text'

    const rows: readonly { readonly declared: DataType; readonly stored: Json }[] = [
      { declared: DATA_TYPES.money, stored: 1000 },
      { declared: DATA_TYPES.identifier, stored: 'S1234567D' },
      { declared: DATA_TYPES.identifier, stored: '0012' },
      { declared: DATA_TYPES.date, stored: '2026-09-21' },
    ]
    let disagreements = 0
    for (const row of rows) {
      if (sniff(row.stored) !== EXTRACTED_KIND_FOR_DATA_TYPE[row.declared]) disagreements += 1
    }
    assert.equal(disagreements, 4, 'four of four fixture rows are sniffed WRONG')
  })

  it('never reads the value to decide the kind — every admitted kind is the declared one', () => {
    /* The property, stated over values chosen to mislead a sniffer. */
    const misleading: readonly { readonly declared: DataType; readonly stored: Json }[] = [
      { declared: DATA_TYPES.identifier, stored: '1234' },
      { declared: DATA_TYPES.string, stored: '2026-09-21' },
      { declared: DATA_TYPES.date, stored: '2026-09-21T00:00:00Z' },
      { declared: DATA_TYPES.string, stored: '1000' },
    ]
    for (const row of misleading) {
      const scalar = admitted(addressableToExtracted(position(row.declared, row.stored), BUILT))
      assert.equal(scalar.kind, EXTRACTED_KIND_FOR_DATA_TYPE[row.declared])
    }
  })
})

/* ====================================================================== *
 * §8  `jsonShapeOf` — total, and carrying nothing out
 * ====================================================================== */

describe('§8 the shape reporter', () => {
  it('answers a member of its own closed vocabulary for every input', () => {
    const inputs: readonly Json[] = [
      null,
      undefined,
      true,
      0,
      -1.5,
      10n,
      '',
      'text',
      [],
      [1, 2],
      {},
      { a: 1 },
      new Date(0),
    ]
    const members = new Set<string>(Object.values(JSON_SHAPES))
    for (const input of inputs) {
      assert.ok(members.has(jsonShapeOf(input)), `unnamed shape for ${String(input)}`)
    }
  })

  it('distinguishes the three that `typeof` conflates', () => {
    assert.equal(jsonShapeOf(null), JSON_SHAPES.null)
    assert.equal(jsonShapeOf([]), JSON_SHAPES.array)
    assert.equal(jsonShapeOf({}), JSON_SHAPES.object)
  })
})

/* -------------------------------------------------------------------- *
 * The module's own bytes, for the three source-level controls above.
 * -------------------------------------------------------------------- */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

function readModuleText(): string {
  return readFileSync(join(REPO_ROOT, 'model', 'extraction.ts'), 'utf8')
}

/**
 * The module with its comments removed — what it DOES, rather than what it
 * says about what it does.
 *
 * 🛑 THIS HELPER EXISTS BECAUSE TWO CONTROLS IN THIS FILE WENT RED AGAINST THE
 *    MODULE'S OWN PROSE ON THEIR FIRST RUN, AND THAT RED IS RECORDED RATHER
 *    THAN QUIETLY REPAIRED. A rule keyed on a NAME appearing in a file is
 *    keyed on a landmark; the property is whether the name is CALLED. A module
 *    that argues carefully about what it refuses to call will always defeat the
 *    first form — and the more carefully it argues, the more certainly it does.
 *    `model/reconciliation.ts` and `model/ingestion.ts` both carry headers
 *    stating a `grep` answer of 0 that their own sentences make non-zero.
 *
 * ⚠️ IT IS DELIBERATELY CRUDE AND THAT IS SAFE HERE: it cannot tell a comment
 *    from a `//` inside a string literal, and this module contains no string
 *    literal holding either sequence. A control that over-strips would only
 *    ever make these two assertions weaker in the direction of passing, so the
 *    positive assertion beside each one (`parseMoneyWire(` IS present) is what
 *    stops that failing silently.
 */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}
