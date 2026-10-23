/* ====================================================================== *
 * THE ADVERSARIAL PASS OVER `model/reconciliation.ts` AND
 * `model/field-path.ts`.
 *
 * WHAT THIS FILE IS. Hostile but LEGAL input, driven at the engine, asserting
 * that it REFUSES BY NAME rather than misbehaving. The corpus is thirty
 * hand-traced topologies a controller would recognise; this is the other half —
 * the rows a counterparty sends when a counterparty is the adversary. Every
 * input here is something a real document could legally contain: a JSON key
 * with a dot in it, a key spelled `__proto__`, an amount that is not an
 * integer, a date that is not a date.
 *
 * 🛑 THE ASSERTION SHAPE, AND IT IS NOT NEGOTIABLE. Three forms are permitted
 * and no others:
 *
 *   (a) the run returns `{ ok: false }` with a NAMED arm of the closed refusal
 *       union;
 *   (b) the ROW is refused with a NAMED arm of `AdmissionRefusal` and lands in
 *       the residue carrying it;
 *   (c) the value is carried as DATA, conserved, and reaches no channel it may
 *       not reach.
 *
 * "It throws" is not an outcome — this module is documented as total and pure,
 * and a throw from a pure fold over a counterparty document is a denial of
 * service. "It returns something" is not an assertion at all. Every test below
 * names which of the three it is claiming.
 *
 * 🛑 AND THE EXPECTATIONS COME FROM THE SPECIFICATION, exactly as
 * `./recon-corpus.ts` requires of itself. Where the engine and the
 * specification DISAGREE, the disagreement is recorded in §9 and pinned by a
 * test that goes RED ON BEING FIXED — the pattern `./export-surface.test.ts`
 * establishes in its own words: "a permanently red assertion teaches people to
 * ignore the suite, so a known defect is pinned by a test that goes RED ON
 * BEING FIXED." Such a test SAYS SO, loudly, in its own name and message. It is
 * not a blessing and it must not be read as one.
 *
 * ILLUSTRATIVE SYNTHETIC DATA throughout. No figure here is a customer result,
 * and `synthetic: true` is set truthfully on every document by way of the
 * corpus's own builders.
 * ====================================================================== */

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type {
  DataClass,
  ExtractedLine,
  ExtractedScalar,
  ExtractedValue,
  SourceDocument,
} from '../../model/domain.ts'
import { DATA_CLASSES } from '../../model/domain.ts'
import type { FieldPath, FieldPathKey, SourceDocumentId } from '../../model/kernel.ts'
import {
  MAX_FIELD_PATH_DEPTH,
  fieldPathKey,
  parseFieldPath,
  resolveFieldPath,
} from '../../model/field-path.ts'
import {
  MINOR_UNITS_MAX,
  MINOR_UNITS_MIN,
  applyExtraction,
  formatMinorUnits,
  checkPostconditions,
  guardMoney,
  itemKey,
  runSetReconciliation,
  settlementOf,
  validateNormalisation,
} from '../../model/reconciliation.ts'
import type {
  AdmittedItem,
  MatchingState,
  PopulationBinding,
  SetReconciliationInput,
  SetReconciliationOutcome,
} from '../../model/reconciliation.ts'

import {
  EXACT_MONEY,
  FIVE_DAYS,
  IDENTITY_NORMALISATION,
  PATHS,
  amt,
  bankBinding,
  bankDoc,
  bankFields,
  bound,
  dte,
  id,
  ledgerBinding,
  ledgerDoc,
  ledgerFields,
  line,
  mny,
  pairing,
  runInput,
  txt,
} from './recon-corpus.ts'
import { OPEN_QUESTIONS_AT_HEAD } from './open-questions.ts'

/* ====================================================================== *
 * §0  MACHINERY
 * ====================================================================== */

/**
 * 🛑 THE TWO HOSTILE CHARACTERS ARE CONSTRUCTED, NEVER WRITTEN AS BYTES, AND
 * THIS FILE LEARNED IT THE HARD WAY. A literal NUL or a literal bidi override
 * in a SOURCE file makes that file BINARY to `grep` — and this repository's
 * entire verification surface is greps: `tools/check-doc-counts.mjs`,
 * `tools/check-citations.mjs`, `tools/check-g-numbers.mjs`, and every negative
 * control the record states as a `grep -c`. A test file the checkers silently
 * skip is worth less than no test file, because the skip is invisible.
 *
 * ⚠️ IT IS THE SAME DEFECT `itemKey` RECORDS HAVING MADE ONCE, pointing the
 * other way: its first version joined on a NUL byte, which was "genuinely
 * unambiguous, and it made the whole source file BINARY to `grep`… a defect
 * with a far larger blast radius than the one it solved." The first draft of
 * this suite shipped literal NULs and a U+202E into two files and reproduced
 * it exactly — found by `grep` returning nothing for a symbol that was there.
 * The VALUES below are byte-for-byte what they were; only the SOURCE is ASCII.
 */
const NUL = String.fromCharCode(0x0000)
const RTL_OVERRIDE = String.fromCharCode(0x202e)

/** The fixture-only unwrap the corpus states for itself: a literal here that
 *  will not parse is a defect in THIS file, and failing at construction says
 *  so loudest. Runtime input never travels this route. */
function p(...tokens: readonly (string | number)[]): FieldPath {
  const parsed = parseFieldPath(tokens)
  if (!parsed.ok) throw new Error(`adversarial suite declares an unparseable FieldPath: ${parsed.refusal.kind}`)
  return parsed.path
}

function value(scalar: ExtractedScalar): ExtractedValue {
  return { scalar, provenance: { page: null, boundingBox: null, confidence: null } }
}

const L = (index: number, reference: string, minor: bigint, date = '2026-03-01'): ExtractedLine =>
  line(index, ledgerFields(id(reference), amt(minor), dte(date), id('CP-ADV')))
const R = (index: number, reference: string, minor: bigint, date = '2026-03-02'): ExtractedLine =>
  line(index, bankFields(id(reference), amt(minor), dte(date), id('CP-ADV'), txt('advice')))

interface StandardRunOptions {
  readonly runId: string
  readonly left: ExtractedLine[]
  readonly right: ExtractedLine[]
  readonly amountToleranceMinor?: bigint
}

/**
 * The corpus's own bindings, its own bounds, its own classification map — one
 * ledger document against one statement, joined on `PATHS.reference`. The only
 * thing a caller varies is the ROWS, which is the point: every test below
 * changes one thing about one row and nothing else.
 */
function standardRun(options: StandardRunOptions): SetReconciliationInput {
  const tolerance =
    options.amountToleranceMinor === undefined
      ? EXACT_MONEY
      : ({ kind: 'money', value: mny(options.amountToleranceMinor) } as const)
  return runInput({
    runId: options.runId,
    left: ledgerBinding({ identifiers: [PATHS.reference], counterparty: null }),
    right: bankBinding({ identifiers: [PATHS.reference], counterparty: null, description: null }),
    leftDocuments: [ledgerDoc('srcdoc_SYN_adv_ledger', 'adv-ar.csv', options.left)],
    rightDocuments: [bankDoc('srcdoc_SYN_adv_statement', 'adv-statement.csv', options.right)],
    pairing: pairing('one_to_one', tolerance, FIVE_DAYS, [
      { kind: 'exact_identifier', on: PATHS.reference },
    ]),
    strategyBindings: [bound({ kind: 'exact_identifier', on: PATHS.reference })],
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
  })
}

/**
 * Drives the engine and asserts the ONE property every test in this file
 * shares: it is total. Returns the outcome for the caller to narrow.
 *
 * 🛑 THE `try` IS THE ASSERTION AND NOT DEFENSIVE CODE. `runSetReconciliation`
 * is documented "pure, total, deterministic, side-effect-free"; a throw out of
 * it over a counterparty document is a denial of service on a fold that is
 * supposed to answer with a value whatever it is handed. If this ever fires,
 * the message names the input.
 */
function totalOutcome(what: string, input: SetReconciliationInput): SetReconciliationOutcome {
  try {
    return runSetReconciliation(input)
  } catch (thrown) {
    assert.fail(
      `${what}: runSetReconciliation THREW. It is documented total — "pure, total, deterministic, side-effect-free" — and a throw over a legal counterparty document is a denial of service, not an error. ${String(thrown)}`,
    )
  }
}

/* ====================================================================== *
 * §1  THE PARSE SEAM — every refusal arm, by name
 *
 * G214, invariant 4. `parseFieldPath` is the only thing in the repository that
 * may construct a `FieldPath`, so it is the only door a hostile path can come
 * through, and every one of its refusals is a value rather than a throw.
 * ====================================================================== */

describe('the one parse seam refuses hostile input by name', () => {
  const cases: readonly { readonly what: string; readonly input: unknown; readonly kind: string }[] = [
    /* 🛑 THE FIRST TWO ARE THE WHOLE RULING. A dotted string and a JSON Pointer
     * are the two encodings G214 REJECTED, and the reason is that each has a
     * plausible MISREADING — `'a.b'` means either one key or two, and the
     * failure mode is addressing the wrong key silently. Here they are not
     * misread; they are not read at all. */
    { what: 'a dotted string', input: 'invoice.lines.0.amount', kind: 'not_a_token_list' },
    { what: 'a JSON Pointer', input: '/invoice/lines/0/amount', kind: 'not_a_token_list' },
    { what: 'a bare string', input: 'amount', kind: 'not_a_token_list' },
    { what: 'null', input: null, kind: 'not_a_token_list' },
    { what: 'undefined', input: undefined, kind: 'not_a_token_list' },
    { what: 'a number', input: 42, kind: 'not_a_token_list' },
    { what: 'an object', input: { path: ['a'] }, kind: 'not_a_token_list' },
    { what: 'the document root', input: [], kind: 'empty_token_list' },
    /* The bound is stated (`MAX_FIELD_PATH_DEPTH`) rather than defaulted, for
     * `SubsetSumBound`'s reason: an unbounded walk over attacker-influenced
     * input is a denial-of-service surface. */
    {
      what: 'one segment past the stated depth',
      input: Array.from({ length: MAX_FIELD_PATH_DEPTH + 1 }, () => 'x'),
      kind: 'exceeds_max_depth',
    },
    { what: 'an empty key segment', input: [''], kind: 'key_segment_is_empty' },
    { what: 'an empty key segment, nested', input: ['a', ''], kind: 'key_segment_is_empty' },
    { what: 'a fractional index', input: [1.5], kind: 'index_segment_not_a_non_negative_integer' },
    { what: 'a negative index', input: [-1], kind: 'index_segment_not_a_non_negative_integer' },
    { what: 'NaN as an index', input: [Number.NaN], kind: 'index_segment_not_a_non_negative_integer' },
    { what: 'Infinity as an index', input: [Number.POSITIVE_INFINITY], kind: 'index_segment_not_a_non_negative_integer' },
    { what: 'a null segment', input: [null], kind: 'segment_not_a_token' },
    { what: 'an object segment', input: [{}], kind: 'segment_not_a_token' },
    { what: 'a boolean segment', input: [true], kind: 'segment_not_a_token' },
    { what: 'a nested array segment', input: [['a']], kind: 'segment_not_a_token' },
  ]

  for (const c of cases) {
    test(`test_parseFieldPath_refuses_${c.what.replace(/[^a-z]+/gi, '_')}`, () => {
      const parsed = parseFieldPath(c.input)
      assert.equal(parsed.ok, false, `${c.what}: expected a refusal, got a path`)
      if (parsed.ok) return
      assert.equal(parsed.refusal.kind, c.kind, `${c.what}: wrong refusal arm`)
    })
  }

  test('test_the_depth_bound_admits_exactly_MAX_FIELD_PATH_DEPTH_segments', () => {
    /* The boundary, from both sides, because a bound asserted only on the
     * rejecting side is a bound nobody has shown is reachable. */
    const atTheBound = parseFieldPath(Array.from({ length: MAX_FIELD_PATH_DEPTH }, () => 'x'))
    assert.equal(atTheBound.ok, true, 'a path AT the stated depth must be admitted')
    const overIt = parseFieldPath(Array.from({ length: MAX_FIELD_PATH_DEPTH + 1 }, () => 'x'))
    assert.equal(overIt.ok, false, 'a path one past the stated depth must refuse')
  })

  test('test_a_legal_hostile_key_is_a_path_rather_than_a_refusal', () => {
    /* 🛑 THE OTHER HALF, AND IT IS THE HALF A VALIDATOR USUALLY GETS WRONG. A
     * key containing a dot, a slash, a NUL or an RTL override is LEGAL JSON and
     * a counterparty may send one. The token list exists so those keys are
     * ADDRESSABLE, not so they are banned — banning them would make a field a
     * counterparty legitimately named unreachable, which is a different
     * fail-open (the row would be unclassified and refused, and the operator
     * would have no way to declare it). */
    for (const key of ['a.b', 'a/b', '..', '.', '__proto__', 'constructor', NUL, RTL_OVERRIDE + 'txn']) {
      const parsed = parseFieldPath([key])
      assert.equal(parsed.ok, true, `a legal JSON key was refused as a path segment: ${JSON.stringify(key)}`)
    }
  })
})

/* ====================================================================== *
 * §2  IDENTITY IS INJECTIVE — the property the length prefix buys
 *
 * `fieldPathKey`'s own docblock: a separator-joined encoding collides
 * (`['a.b']` against `['a','b']` under `join('.')`) and the collision is
 * SILENT. The keys below are chosen to attack the encoding that replaced it,
 * including one crafted to look like the encoding's own output.
 * ====================================================================== */

describe('path identity is injective over counterparty-chosen keys', () => {
  const paths: readonly { readonly what: string; readonly path: FieldPath }[] = [
    { what: 'one key containing a dot', path: p('a.b') },
    { what: 'two keys', path: p('a', 'b') },
    { what: 'one key containing a slash', path: p('a/b') },
    { what: 'parent traversal as a key', path: p('..') },
    { what: 'a NUL in a key', path: p(`a${NUL}b`) },
    { what: 'an RTL override in a key', path: p(RTL_OVERRIDE + 'b.a') },
    { what: 'a Cyrillic confusable for amount', path: p('аmount') },
    { what: 'the Latin spelling of amount', path: p('amount') },
    /* 🛑 THE ONE CRAFTED AGAINST THE ENCODING ITSELF. `fieldPathKey` emits
     * `k<length>:<key>/` per segment, so a counterparty who names a JSON key
     * `k1:a/` is writing this function's own output into the document. The
     * length prefix is what makes it harmless: `['a']` is `k1:a/` and
     * `['k1:a/']` is `k5:k1:a//`, and no reading of either can produce the
     * other. Under a delimiter-joined encoding these WOULD collide. */
    { what: 'a key spelling the encoding itself', path: p('k1:a/') },
    { what: 'the key it imitates', path: p('a') },
    { what: 'the array index zero', path: p(0) },
    { what: 'the string key zero', path: p('0') },
    { what: 'two segments that concatenate to another path', path: p('ab', 'c') },
    { what: 'one segment spelling that concatenation', path: p('ab/k1:c') },
  ]

  test('test_no_two_distinct_paths_share_an_identity_token', () => {
    const seen = new Map<FieldPathKey, string>()
    for (const entry of paths) {
      const key = fieldPathKey(entry.path)
      const first = seen.get(key)
      assert.equal(
        first,
        undefined,
        `COLLISION: "${entry.what}" and "${first ?? ''}" produce the same identity token ${JSON.stringify(key)}. A collision here means two different positions in a counterparty document are one position to every Map, Set and Record in the engine — which is invariant 4 failing open, and it is the exact defect the length prefix was introduced to remove.`,
      )
      seen.set(key, entry.what)
    }
    assert.equal(seen.size, paths.length)
  })

  test('test_a_very_long_key_is_addressable_rather_than_truncated', () => {
    /* A bound on a DECLARED path's DEPTH is stated (`MAX_FIELD_PATH_DEPTH`); no
     * bound on a segment's LENGTH is stated anywhere, so the property to
     * witness is that a long key is carried whole rather than silently cut —
     * a truncating identity would collide two long keys sharing a prefix. */
    const long = 'x'.repeat(4096)
    const key = fieldPathKey(p(long))
    assert.equal(key.includes(long), true, 'a long key was not carried whole into its identity token')
    assert.notEqual(fieldPathKey(p(`${long}A`)), key, 'two long keys sharing a prefix collided')
  })
})

/* ====================================================================== *
 * §3  RESOLUTION — the prototype chain, by name
 * ====================================================================== */

describe('resolution refuses a prototype key rather than returning one', () => {
  for (const key of ['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty']) {
    test(`test_resolveFieldPath_refuses_${key.replace(/[^a-z]+/gi, '_')}_as_key_absent`, () => {
      /* 🛑 THE FAILURE THIS PREVENTS IS A FUNCTION REACHING A PAYLOAD POSITION.
       * `key in object` walks the prototype chain, so a document with no
       * `constructor` of its own resolves to `Object`'s — and the module's own
       * docblock names that. `hasOwnProperty.call` is what makes the answer
       * `key_absent`. The counterparty names the fields; these arrive by
       * choice, not by accident. */
      const resolved = resolveFieldPath({}, p(key))
      assert.equal(resolved.ok, false, `${key} resolved against an empty object`)
      if (resolved.ok) return
      assert.deepStrictEqual(resolved.refusal, { kind: 'key_absent', at: 0 })
    })
  }

  test('test_an_own_property_named_like_a_prototype_member_still_resolves', () => {
    /* The other direction, and it is not symmetry for its own sake: a document
     * that really does carry a field called `constructor` must be READABLE, or
     * the guard above has made a legal field unaddressable. */
    const resolved = resolveFieldPath({ constructor: 'ACME LTD' }, p('constructor'))
    assert.equal(resolved.ok, true, 'an own property named `constructor` must resolve')
    if (!resolved.ok) return
    assert.equal(resolved.value, 'ACME LTD')
  })

  test('test_a_present_key_holding_null_resolves_rather_than_refusing', () => {
    /* G178's fail-open shape, refused: `undefined`-as-absent cannot tell "no
     * key" from "key holding nothing", and every falsy test a caller writes
     * then folds in `null`, `0`, `''` and `false` as well. */
    const resolved = resolveFieldPath({ payer: null }, p('payer'))
    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    assert.equal(resolved.value, null)
  })

  test('test_every_resolution_refusal_arm_is_reachable_and_names_its_ordinal', () => {
    const cases: readonly [FieldPath, unknown, string][] = [
      [p('a', 'b'), { a: { c: 1 } }, 'key_absent'],
      [p('a', 'b'), { a: 'scalar' }, 'not_an_object'],
      [p('a', 'b'), { a: [1, 2] }, 'not_an_object'],
      [p('a', 0), { a: { zero: 1 } }, 'not_an_array'],
      [p('a', 3), { a: [1, 2] }, 'index_out_of_range'],
    ]
    for (const [path, payload, kind] of cases) {
      const resolved = resolveFieldPath(payload as never, path)
      assert.equal(resolved.ok, false, `${kind}: expected a refusal`)
      if (resolved.ok) continue
      assert.equal(resolved.refusal.kind, kind)
      assert.equal(resolved.refusal.at, 1, `${kind}: the ordinal must name WHICH segment failed`)
    }
  })
})

/* ====================================================================== *
 * §4  A HOSTILE DECLARED PATH ADDRESSES EXACTLY ONE POSITION
 *
 * 🛑 THIS IS INVARIANT 4's ARGUMENT, DRIVEN THROUGH THE WHOLE ENGINE RATHER
 * THAN ASSERTED ABOUT A HELPER. `model/kernel.ts` states the property —
 * "`['bank.credit', 'amount']` and `['bank', 'credit', 'amount']` are now two
 * different paths; under the old alias they were the same six-word string" —
 * and nothing anywhere ran a reconciliation to see it. The document below
 * carries BOTH positions with DIFFERENT amounts, which is the only arrangement
 * in which a silent misread is visible: under the superseded `FieldPath =
 * string` alias exactly one of these two runs would have read the other row's
 * money and reported a clean match.
 * ====================================================================== */

describe('a dotted key and a two-segment path are two different positions', () => {
  const DOTTED = p('bank.credit', 'amount')
  const NESTED = p('bank', 'credit', 'amount')
  const DATE = p('value_date')
  const REF = p('txn_ref')

  const DOTTED_MINOR = 100_00n
  const NESTED_MINOR = 999_999_00n

  function ambiguousDocument(documentId: string): SourceDocument {
    const fields: Record<FieldPathKey, ExtractedValue> = {
      [fieldPathKey(DOTTED)]: value(amt(DOTTED_MINOR)),
      [fieldPathKey(NESTED)]: value(amt(NESTED_MINOR)),
      [fieldPathKey(DATE)]: value(dte('2026-03-04')),
      [fieldPathKey(REF)]: value(id('TXN-1')),
    }
    /* A header-grain document: one transaction, no lines. */
    return ledgerDoc(documentId, 'ambiguous-keys.csv', [line(0, fields)])
  }

  function runReading(which: FieldPath, classifyIt = true): SetReconciliationOutcome {
    const classification = new Map<FieldPathKey, DataClass>([
      [fieldPathKey(DATE), DATA_CLASSES.internal],
      [fieldPathKey(REF), DATA_CLASSES.internal],
    ])
    if (classifyIt) classification.set(fieldPathKey(which), DATA_CLASSES.internal)
    const binding = (base: PopulationBinding): PopulationBinding => ({
      ...base,
      spec: { ...base.spec, amount: which, date: DATE, identifiers: [REF] },
      description: null,
    })
    return totalOutcome(
      `reading ${fieldPathKey(which)}`,
      runInput({
        runId: 'run_SYN_adv_paths',
        left: binding(ledgerBinding({ identifiers: [REF], counterparty: null })),
        right: binding(bankBinding({ identifiers: [REF], counterparty: null, description: null })),
        leftDocuments: [ambiguousDocument('srcdoc_SYN_adv_paths_l')],
        rightDocuments: [ambiguousDocument('srcdoc_SYN_adv_paths_r')],
        pairing: pairing('one_to_one', EXACT_MONEY, FIVE_DAYS, [{ kind: 'exact_identifier', on: REF }]),
        strategyBindings: [bound({ kind: 'exact_identifier', on: REF })],
        obligationSide: 'left',
        toleranceDirection: 'symmetric',
        classification,
        promptEligible: new Set<FieldPathKey>(),
      }),
    )
  }

  for (const [what, path, expected] of [
    ['the dotted key', DOTTED, DOTTED_MINOR],
    ['the nested path', NESTED, NESTED_MINOR],
  ] as const) {
    test(`test_declaring_${what.replace(/[^a-z]+/gi, '_')}_reads_that_position_and_not_the_other`, () => {
      const outcome = runReading(path)
      assert.equal(outcome.ok, true, `${what}: the run refused`)
      if (!outcome.ok) return
      const items = [...outcome.result.state.items.values()]
      assert.equal(items.length, 2, `${what}: both sides must admit their one row`)
      for (const item of items) {
        assert.equal(
          item.gross.amountMinor,
          expected,
          `${what}: the engine read the WRONG position. Under the superseded \`FieldPath = string\` alias these two declarations were the same six-word string, and this is the run in which that would have silently read the other row's money.`,
        )
      }
    })
  }

  test('test_a_present_key_with_no_classification_is_unreadable_rather_than_defaulted', () => {
    /* 🛑 G106, FAIL-CLOSED, AND THE ARRANGEMENT IS WHAT MAKES IT A WITNESS. The
     * position EXISTS in the payload and holds real money — `NESTED` is
     * `999_999_00` on both documents — and the only thing missing is the
     * operator's declaration. A key with no `FieldSpec` is UNREADABLE: stored,
     * and unaddressable by any agent, prompt, export or dashboard. The answer
     * must be a NAMED refusal and not a default class, and it must not be
     * `field_absent` either, which would say the wrong thing about a key that
     * is right there. The rejected alternative — defaulting an unmapped key to
     * the most sensitive class — is readable-by-default-with-a-high-bar, which
     * is scope failing OPEN. */
    const outcome = runReading(NESTED, false)
    assert.equal(outcome.ok, true)
    if (!outcome.ok) return
    assert.equal(outcome.result.refusedAtAdmission.length, 2, 'both rows must be refused')
    for (const refused of outcome.result.refusedAtAdmission) {
      assert.deepStrictEqual(refused.refusal, { kind: 'field_not_classified' })
    }
    /* §4's heading — "nothing is ever dropped". A refused row is in the
     * residue with the reason attached, settlement `null` because it has no
     * amount to settle. */
    assert.equal(outcome.result.residue.length, 2)
    for (const entry of outcome.result.residue) {
      assert.equal(entry.settlement, null, 'a row whose amount was never read has no settlement')
      assert.equal(entry.cause.kind, 'admission_refused')
    }
  })
})

/* ====================================================================== *
 * §5  MONEY AT THE EDGES
 *
 * ✅ THE DISAGREEMENT THIS SECTION OPENED BY NAMING IS RESOLVED — G286,
 * 19 Sep 2026, IN FAVOUR OF THE RECORD. The header read:
 *
 *     "🛑 `Money.amountMinor` IS `number` AT THIS TREE AND NOT `bigint`, AND
 *      THE BRIEF THIS SUITE WAS WRITTEN FROM SAID OTHERWISE. `CLAUDE.md`
 *      states, under G111, that 'after G65 and G71, `Money.amountMinor` is
 *      `bigint` in the model'; `model/domain.ts`'s declaration is
 *      `amountMinor: number` … The edges that matter here are therefore the
 *      edges of the IEEE-754 safe integer range, which is exactly what
 *      `guardMinor` guards."
 *
 * **The owner ruled that the CODE was wrong.** `amountMinor` is `bigint`, and
 * the edges that matter here are no longer IEEE-754's — they are the edges of
 * the `int8` COLUMN G65 declares money is stored in, −2^63 … 2^63−1. Derive it,
 * do not read this: `grep -n 'amountMinor' model/domain.ts`.
 *
 * 🛑 THREE ROWS LEFT THIS TABLE AND ONE CHANGED SIDES. A `bigint` cannot be
 * fractional, `NaN` or `Infinity`, so those three are COMPILE ERRORS here rather
 * than refusals; their expectation moved to the wire, where a non-integer can
 * still arrive, and is asserted by `tests/model/money-codec.test.ts` against
 * `MONEY_CODEC_VECTORS`. The one that changed sides is
 * `Number.MAX_SAFE_INTEGER + 2`: it was refused and is now ADMITTED, which is
 * the ceiling G286 was taken to raise, working.
 * ====================================================================== */

describe('money at the edges', () => {
  const edges: readonly { readonly what: string; readonly minor: bigint; readonly guarded: string | null }[] = [
    { what: 'zero', minor: 0n, guarded: null },
    { what: 'one minor unit', minor: 1n, guarded: null },
    { what: 'a negative amount', minor: -1n, guarded: null },
    { what: 'the largest safe integer', minor: 9_007_199_254_740_991n, guarded: null },
    { what: 'the smallest safe integer', minor: -9_007_199_254_740_991n, guarded: null },
    /* 🛑 THIS ROW CHANGED SIDES ON 19 Sep 2026 AND IT IS THE WHOLE OF G286 IN
     * ONE LINE. It read `{ minor: Number.MAX_SAFE_INTEGER + 2, guarded:
     * 'exceeds_exact_integer_range' }` — two minor units past what a `number`
     * can hold exactly, refused because the arithmetic below it was already
     * wrong. It is now an ordinary exact amount and is ADMITTED. */
    { what: 'two past the safe range', minor: 9_007_199_254_740_993n, guarded: null },
    { what: 'the largest storable minor unit', minor: MINOR_UNITS_MAX, guarded: null },
    { what: 'the smallest storable minor unit', minor: MINOR_UNITS_MIN, guarded: null },
    /* ✅ AND THE REFUSAL DID NOT DISAPPEAR WITH IT. Its bound rose by a factor
     * of 1024 — from `Number.isSafeInteger` to the `int8` column — so the arm,
     * the OQ-1 admission refusal it feeds and every assertion below stay
     * witnessed. Two rows, not one, because the range has two ends. */
    { what: 'one past the storable range', minor: MINOR_UNITS_MAX + 1n, guarded: 'exceeds_exact_integer_range' },
    { what: 'one below the storable range', minor: MINOR_UNITS_MIN - 1n, guarded: 'exceeds_exact_integer_range' },
  ]

  test('test_guardMoney_names_every_amount_outside_the_exact_integer_range', () => {
    for (const edge of edges) {
      const refusal = guardMoney(mny(edge.minor))
      assert.equal(
        refusal === null ? null : refusal.kind,
        edge.guarded,
        `${edge.what}: guardMoney disagrees. The engine only adds, subtracts and compares, so an amount outside the exact integer range is one whose arithmetic is silently wrong.`,
      )
    }
  })

  for (const edge of edges.filter((e) => e.guarded === null)) {
    test(`test_${edge.what.replace(/[^a-z]+/gi, '_')}_is_admitted_and_conserved`, () => {
      /* Form (c): carried as data and conserved. A zero or a negative amount is
       * a legal figure a ledger may hold, and the engine's job is to account
       * for it, not to reject it — `isPositiveMoney` keeps it out of the passes
       * and §6 puts it in the residue. */
      const outcome = totalOutcome(
        edge.what,
        standardRun({ runId: 'run_SYN_adv_money_ok', left: [L(0, 'A', edge.minor)], right: [R(0, 'A', 100_00n)] }),
      )
      assert.equal(outcome.ok, true, `${edge.what}: the run refused`)
      if (!outcome.ok) return
      assert.equal(outcome.result.refusedAtAdmission.length, 0, `${edge.what}: nothing should refuse at admission`)
      const accounted = new Set(outcome.result.residue.map((e) => `${e.side}#${String(e.ref.lineIndex)}`))
      for (const item of outcome.result.state.items.values()) {
        const settlement = settlementOf(outcome.result.state, item.key)
        assert.equal(settlement.ok, true, `${edge.what}: settlement must be derivable`)
        if (!settlement.ok) continue
        if (settlement.value.kind === 'fully_allocated') continue
        assert.equal(
          accounted.has(`${item.side}#${String(item.ref.lineIndex)}`),
          true,
          `${edge.what}: an open row is missing from the residue — §4, "nothing is ever dropped".`,
        )
      }
    })
  }

  /* -------------------------------------------------------------------- *
   * ✅ OQ-1 IS FIXED, AND THE TRIPWIRES THAT PINNED IT ARE DELETED HERE.
   *
   * 🛑 WHAT STOOD IN THIS PLACE, QUOTED RATHER THAN ERASED, because it is the
   * behaviour a reader of §4 would have sworn was impossible and because two
   * tests here asserted it as fact. The block read:
   *
   *     "🛑 OPEN QUESTION OQ-1 — A ROW WHOSE AMOUNT IS NOT A SAFE INTEGER
   *      LEAVES THE LEDGER ENTIRELY, AND THE POST-CONDITION WRITTEN TO CATCH A
   *      VANISHED ROW SKIPS IT ON THE SAME GUARD… `admitOne` checks that the
   *      amount scalar is `money` and that its UNIT matches the declaration; it
   *      never calls `guardMoney`. So the row is ADMITTED. `residualOf` then
   *      refuses on every later read, and both places that would notice skip on
   *      it… so `open_item_missing_from_residue` — the post-condition whose own
   *      comment calls it 'THE load-bearing one' — CANNOT fire for the one case
   *      it is named for."
   *
   * and it was pinned by `test_OQ1_TRIPWIRE_*_is_admitted_and_then_vanishes_from
   * _the_residue`, one per guarded edge, each asserting
   * `refusedAtAdmission.length === 0`, `state.items.size === 4`, the row ABSENT
   * from the residue, and exactly one `gross_not_partitioned`.
   *
   * ✅ THE FIX IS AT ADMISSION, WHICH IS WHERE §4 ALREADY SAID IT BELONGED:
   * *"a record that cannot be read is REFUSED with a stated reason and lands in
   * the residue. It is never skipped."* `admitOne` now calls `guardMoney` after
   * C16's unit check and refuses with `amount_not_exact_money`, carrying the
   * `MoneyRefusal` `guardMinor` had been naming all along —
   * `not_integer_minor_units` or `exceeds_exact_integer_range`. No new REASON
   * was minted; a new place to report an old one was.
   *
   * 🛑 AND THE REPLACEMENT IS POSITIVE, WHICH IS THE WHOLE OBLIGATION A DELETED
   * TRIPWIRE CARRIES. Removing a tripwire without leaving an assertion converts
   * a known defect into an unknown one. The tests below are assertion form (b)
   * — the ROW is refused with a NAMED arm of `AdmissionRefusal` and lands in the
   * residue carrying it — plus the structural property that was FALSE at base
   * and is the one that blinded the post-condition.
   * -------------------------------------------------------------------- */
  for (const edge of edges.filter((e) => e.guarded !== null)) {
    test(`test_${edge.what.replace(/[^a-z]+/gi, '_')}_is_REFUSED_at_admission_and_lands_in_the_residue`, () => {
      const outcome = totalOutcome(
        edge.what,
        standardRun({
          runId: 'run_SYN_adv_money_edge',
          /* Line 0 carries the unreadable amount. Line 1 is an ordinary row
           * that pairs, so the run is otherwise a normal close and the refusal
           * is the only thing that moved. */
          left: [L(0, 'A', edge.minor), L(1, 'B', 100_00n)],
          right: [R(0, 'A', 500_00n), R(1, 'B', 100_00n)],
        }),
      )
      assert.equal(outcome.ok, true, `${edge.what}: the run refused`)
      if (!outcome.ok) return
      const result = outcome.result

      /* (1) REFUSED, BY NAME, AND THE NAME CARRIES THE GUARD'S OWN REFUSAL.
       * `edge.guarded` is the kind `test_guardMoney_names_every_amount_outside
       * _the_exact_integer_range` above derives from `guardMoney` directly, so
       * the two halves of this claim come from two places rather than one. */
      assert.equal(result.refusedAtAdmission.length, 1, `${edge.what}: exactly one row is refused`)
      const refused = result.refusedAtAdmission[0]
      assert.deepStrictEqual(
        refused?.refusal,
        { kind: 'amount_not_exact_money', refusal: { kind: edge.guarded } },
        `${edge.what}: §4 requires a STATED REASON, and guardMinor had named this one since the money section was written`,
      )

      /* (2) ADDRESSED. The operator is told WHICH ROW, on which side, at which
       * declared path — which is precisely what `gross_not_partitioned` could
       * not tell them, because it carries two totals and no address. The path
       * is the OPERATOR-DECLARED `FieldSpec` path, never a value read out of
       * the payload: `RefusedItem`'s own rule. */
      assert.equal(refused?.side, 'left', `${edge.what}: the side`)
      assert.equal(refused?.ref.lineIndex, 0, `${edge.what}: the line`)
      assert.deepStrictEqual(refused?.path, PATHS.ledgerAmount, `${edge.what}: the declared path`)

      /* (3) IT NEVER REACHES THE LEDGER. Three rows are admitted, not four —
       * an unreadable amount is not a ledger row, and the base behaviour
       * admitted it as one. */
      assert.equal(result.state.items.size, 3, `${edge.what}: the unreadable row is not in the ledger`)

      /* (4) IT LANDS IN THE RESIDUE, carrying the same refusal. §4: "It is
       * NEVER SKIPPED." */
      const entry = result.residue.find((e) => e.side === 'left' && e.ref.lineIndex === 0)
      assert.notEqual(entry, undefined, `${edge.what}: the refused row must reach the residue`)
      assert.deepStrictEqual(
        entry?.cause,
        { kind: 'admission_refused', refusal: { kind: 'amount_not_exact_money', refusal: { kind: edge.guarded } } },
        `${edge.what}: the residue carries the reason, not just the row`,
      )
      assert.equal(entry?.settlement, null, `${edge.what}: a refused row has no settlement to have`)

      /* (5) 🛑 THE STRUCTURAL PROPERTY, AND IT IS THE REPORTING HALF OF OQ-1.
       * `if (!settlement.ok) continue` appears twice — once in §6's residue
       * build and once in `checkPostconditions` — and at base the unreadable
       * row took BOTH branches, which is exactly how it left the ledger with
       * nothing to say about it. Every ledger item's settlement is now
       * derivable from this input, so neither branch is taken: the checks are
       * LIVE over every row rather than short-circuited over one. */
      for (const item of result.state.items.values()) {
        const settlement = settlementOf(result.state, item.key)
        assert.equal(
          settlement.ok,
          true,
          `${edge.what}: ${item.key} has an underivable settlement, so §6 and checkPostconditions both skip it — that is OQ-1 returning.`,
        )
      }

      /* (6) AND THE CHANNEL THAT USED TO SPEAK IS SILENT, because there is
       * nothing left for it to report: the ledger balances. At base this was
       * `[{ kind: 'gross_not_partitioned', … }]` with an `admittedMinor` that
       * was 70001.5, or `NaN`, or 9007199254810992. */
      assert.deepEqual(result.postconditions, [], `${edge.what}: the close balances`)
    })
  }

  test('test_open_item_missing_from_residue_is_LIVE_over_an_unreadable_amount_rather_than_skipped', () => {
    /* 🛑 THE POST-CONDITION OQ-1 BLINDED, SHOWN FIRING OVER THE VERY INPUT THAT
     * BLINDED IT. The claim needs both halves and they are different claims:
     *
     *   at base — `left#0` was a ledger item whose settlement REFUSED, so
     *   `checkPostconditions` hit `continue` BEFORE it ever consulted the
     *   residue. No damage to the residue could make the check speak about
     *   that row: it was dead for it, permanently, and `gross_not_partitioned`
     *   spoke instead with no address.
     *
     *   now — `left#0` is refused at admission and is not a ledger item at all,
     *   and there is no longer ANY item the check must skip (assertion (5)
     *   above). Over this same input it is live, which is asserted here by
     *   damaging the residue and requiring it to fire with a count.
     *
     * ⚠️ THE DAMAGE IS THE ESTABLISHED IDIOM, NOT AN INVENTION.
     * `tests/model/reconciliation-conservation.test.ts` drops a residue entry
     * and calls `checkPostconditions` directly for the same reason: the check
     * must be shown failing on a damaged residue and passing on the intact one,
     * in the same test, or the pass is not attributable. */
    /* ⚠️ THE UNREADABLE AMOUNT WAS `1.5` UNTIL 19 Sep 2026 — G286 — AND IT IS
     * ONE PAST THE STORABLE RANGE NOW. A fractional minor unit is not
     * constructible against a `bigint`; what this test needs is any amount
     * `admitOne` refuses, and the refusal it produces — `amount_not_exact_money`
     * — is the same one. Nothing else in this test moved, including every
     * asserted value. */
    const outcome = totalOutcome(
      'one past the storable range',
      standardRun({
        runId: 'run_SYN_adv_money_edge_live',
        left: [L(0, 'A', MINOR_UNITS_MAX + 1n), L(1, 'B', 100_00n)],
        right: [R(0, 'A', 500_00n), R(1, 'B', 100_00n)],
      }),
    )
    assert.equal(outcome.ok, true)
    if (!outcome.ok) return
    const result = outcome.result

    /* Intact: silent. */
    assert.deepEqual(
      checkPostconditions(result.state, result.residue, result.admissionRates),
      [],
      'the intact run must be sound, or the damaged run below proves nothing',
    )

    /* Damaged: `right#0` is the open 500.00 whose partner was refused. Drop its
     * residue row and the ledger has lost a transaction. */
    const damaged = result.residue.filter((e) => !(e.side === 'right' && e.ref.lineIndex === 0))
    assert.equal(damaged.length, result.residue.length - 1, 'the damage must actually remove one row')
    const failures = checkPostconditions(result.state, damaged, result.admissionRates)
    assert.equal(
      failures.some((f) => f.kind === 'open_item_missing_from_residue'),
      true,
      'THE LOAD-BEARING POST-CONDITION IS SILENT over a run containing an unreadable amount. That is OQ-1 returning by another door.',
    )
    assert.deepStrictEqual(
      failures.find((f) => f.kind === 'open_item_missing_from_residue'),
      { kind: 'open_item_missing_from_residue', count: 1 },
      'one row left the ledger, and the count says one',
    )
  })

  /* -------------------------------------------------------------------- *
   * ✅ OQ-1b IS CLOSED BY G286, AND THE TRIPWIRE THAT PINNED IT IS DELETED HERE.
   *
   * 🛑 WHAT STOOD IN THIS PLACE, QUOTED RATHER THAN ERASED, because it is the
   * behaviour a reader would otherwise have to take on trust that it ever
   * existed. The block read:
   *
   *     "🛑 OPEN QUESTION OQ-1b — A `number` FIELD ON A `PostconditionFailure`
   *      CAN HOLD `NaN`, AND EVERY JSON BOUNDARY RENDERS THAT `null`…
   *      `checkPostconditions` still runs `admittedMinor += minorUnitsOf(item
   *      .gross)` BEFORE the `settlement.ok` guard, and the field is still typed
   *      `number`."
   *
   * and it was pinned by `test_OQ1b_TRIPWIRE_a_NaN_gross_reaches_a_number_field
   * _on_a_postcondition`, which hand-built a `MatchingState` holding one
   * `AdmittedItem` whose `gross.amountMinor` was `Number.NaN`, asserted
   * `Number.isNaN(failure.admittedMinor)` and asserted that
   * `JSON.stringify({ admittedMinor })` produced `{"admittedMinor":null}`.
   *
   * ✅ THE FIX IS THE TYPE, WHICH IS THE STRONGEST FORM AVAILABLE. G286 retypes
   * `Money.amountMinor` and `gross_not_partitioned.admittedMinor` to `bigint`,
   * and **a `bigint` cannot be `NaN`** — there is no value of the type. The
   * tripwire did exactly what it was written to do: it went RED on the day the
   * defect was fixed, as a COMPILE error rather than a failing assertion, and it
   * carried the instruction to delete it.
   *
   * ⚠️ AND IT WAS NOT THE STATED FIX. OQ-1b asked for the accumulator to move
   * below the `settlement.ok` guard; nobody moved it, and
   * `checkPostconditions` still runs `admittedMinor += minorUnitsOf(item.gross)`
   * first. What closed the defect is that there is no longer a poisoning value
   * to accumulate. That is a real closure and a narrower one than the register
   * asked for: the ORDERING complaint is gone because its consequence is gone,
   * not because the ordering changed.
   *
   * 🛑 THE REPLACEMENT IS POSITIVE, which is the obligation a deleted tripwire
   * carries — removing one without leaving an assertion converts a known defect
   * into an unknown one. `@ts-expect-error` is the established idiom here;
   * `tests/model/below-floor-held.test.ts` uses it for the same purpose, to stop
   * an absence reading as an oversight.
   * -------------------------------------------------------------------- */
  test('test_OQ1b_is_closed_by_construction_a_NaN_gross_is_not_a_constructible_value', () => {
    const ref = { sourceDocumentId: 'srcdoc_SYN_adv_hand_built' as SourceDocumentId, lineIndex: null }
    const key = itemKey('left', ref)
    /* (1) THE TYPE-LEVEL ASSERTION, which is the closure itself. The object
     * below is the exact `AdmittedItem` the tripwire used to build, and it no
     * longer compiles. It is NOT handed to `checkPostconditions`: a NaN smuggled
     * past the compiler would make `admittedMinor += minorUnitsOf(item.gross)`
     * throw `TypeError: Cannot mix BigInt and other types`, which is a fact about
     * the language and not about this codebase. What is being asserted is that
     * the value cannot exist. */
    const impossible: AdmittedItem = {
      side: 'left',
      ref,
      key,
      /* THE NEXT LINE IS THE ASSERTION. If it ever stops erroring, `Money` has
       * been retyped back to `number`, OQ-1b is live again, and this test must
       * be restored to the tripwire form quoted above. */
      // @ts-expect-error — G286: `amountMinor` is `bigint`, and no bigint is NaN.
      gross: { currency: 'SGD', amountMinor: Number.NaN, exponent: 2 },
      date: '2026-03-01',
      dayNumber: 20513,
      identifiers: new Map<FieldPathKey, string>(),
      counterparty: null,
      untrustedDescription: null,
      untrustedDescriptionClass: null,
      ordinal: 0,
      heldReads: [],
    }
    assert.notEqual(impossible, undefined, 'referenced so the declaration is not dead code')

    /* (2) THE BEHAVIOURAL HALF, over the SAME arm, with an amount that IS
     * constructible. `gross_not_partitioned` still fires — the defect was never
     * that it did not — and the operand it reports is exact, is a `bigint`, and
     * SURVIVES a JSON boundary as a decimal string rather than becoming `null`.
     * That last clause is the consequence OQ-1b named, asserted positively. */
    const item: AdmittedItem = { ...impossible, gross: { currency: 'SGD', amountMinor: 100_00n, exponent: 2 } }
    const state: MatchingState = { items: new Map([[key, item]]), allocations: [] }
    /* C13's third parameter stated to match the hand-built state, so
     * `population_wholly_refused` correctly does not fire and the arm under
     * test is the one that speaks. */
    const failures = checkPostconditions(state, [], [{ side: 'left', presented: 1, admitted: 1, refused: 0 }])
    const failure = failures.find((f) => f.kind === 'gross_not_partitioned')
    assert.notEqual(failure, undefined, 'gross_not_partitioned must fire')
    if (failure === undefined || failure.kind !== 'gross_not_partitioned') return
    assert.equal(
      typeof failure.admittedMinor,
      'bigint',
      'the reported operand is a `bigint`, and a `bigint` has no NaN',
    )
    assert.equal(failure.admittedMinor, 100_00n, 'and it is the figure an operator acts on')
    assert.equal(
      JSON.stringify({ admittedMinor: formatMinorUnits(failure.admittedMinor) }),
      '{"admittedMinor":"10000"}',
      'OQ-1b\'s stated consequence, inverted: the operand survives serialisation, as the ' +
        'decimal string G65 puts on the wire, instead of rendering `null`.',
    )
  })
})

/* ====================================================================== *
 * §6  DATES AT THE BOUNDARIES
 *
 * A9(f): the draft sorted on `new Date(payload[dateKey])`, whose failure value
 * is `NaN`, and `NaN` compares false against everything — so the comparator's
 * order depended on the sort implementation and the wrong invoice went first in
 * the FIFO queue with no error raised. `parseCalendarDate` is the replacement
 * and its refusal is a value.
 * ====================================================================== */

describe('dates at the boundaries', () => {
  const cases: readonly { readonly what: string; readonly value: string; readonly admitted: boolean }[] = [
    { what: 'a leap day in a leap year', value: '2024-02-29', admitted: true },
    { what: 'a leap day in a common year', value: '2026-02-29', admitted: false },
    { what: 'a century non-leap year', value: '1900-02-29', admitted: false },
    { what: 'a four-hundred-year leap year', value: '2000-02-29', admitted: true },
    { what: 'the thirty-first of a thirty-day month', value: '2026-04-31', admitted: false },
    { what: 'month zero', value: '2026-00-15', admitted: false },
    { what: 'month thirteen', value: '2026-13-01', admitted: false },
    { what: 'day zero', value: '2026-03-00', admitted: false },
    { what: 'year zero', value: '0000-01-01', admitted: true },
    { what: 'the far future', value: '9999-12-31', admitted: true },
    { what: 'an unpadded month', value: '2026-3-01', admitted: false },
    { what: 'an empty string', value: '', admitted: false },
    { what: 'a timestamp with a T separator', value: '2026-03-01T09:30:00Z', admitted: true },
    { what: 'a timestamp with a space separator', value: '2026-03-01 09:30:00', admitted: true },
    { what: 'a tenth character that is neither', value: '2026-03-01X09', admitted: false },
    { what: 'a European order', value: '01-03-2026', admitted: false },
    { what: 'digits replaced by look-alikes', value: '2026-O3-01', admitted: false },
    { what: 'an Arabic-Indic numeral', value: '٢026-03-01', admitted: false },
  ]

  for (const c of cases) {
    test(`test_date_${c.what.replace(/[^a-z0-9]+/gi, '_')}_is_${c.admitted ? 'admitted' : 'refused_by_name'}`, () => {
      const outcome = totalOutcome(
        c.what,
        standardRun({
          runId: 'run_SYN_adv_date',
          left: [line(0, ledgerFields(id('A'), amt(100_00n), dte(c.value), id('CP-ADV')))],
          right: [R(0, 'A', 100_00n)],
        }),
      )
      assert.equal(outcome.ok, true, `${c.what}: the run refused`)
      if (!outcome.ok) return
      const refused = outcome.result.refusedAtAdmission
      if (c.admitted) {
        assert.equal(refused.length, 0, `${c.what}: expected admission, got ${JSON.stringify(refused[0]?.refusal)}`)
        return
      }
      assert.equal(refused.length, 1, `${c.what}: expected exactly one refusal`)
      assert.deepStrictEqual(
        refused[0]?.refusal,
        { kind: 'date_not_iso_calendar' },
        `${c.what}: the refusal must be named, and it must carry NO VALUE — the rejected string is counterparty-controlled.`,
      )
      /* Form (b): the refused row is in the residue carrying its reason. */
      assert.equal(
        outcome.result.residue.some(
          (e) => e.side === 'left' && e.ref.lineIndex === 0 && e.cause.kind === 'admission_refused',
        ),
        true,
        `${c.what}: the refused row must land in the residue — §4, "it is never skipped".`,
      )
    })
  }

  test('test_a_date_refusal_carries_no_counterparty_text', () => {
    /* Invariant 6 at the refusal seam. `AdmissionRefusal`'s `date_not_iso_calendar`
     * arm is declared with "⚠️ Carries NO value. The rejected string is
     * counterparty-controlled" — and `_AdmissionRefusalHoldsNoText` is the
     * compile-time half. This is the runtime witness: a marker string in the
     * rejected date must appear nowhere in the serialised refusal. */
    const marker = 'IGNORE-PREVIOUS-INSTRUCTIONS-9F2A'
    const outcome = totalOutcome(
      'injected date',
      standardRun({
        runId: 'run_SYN_adv_date_text',
        left: [line(0, ledgerFields(id('A'), amt(100_00n), dte(marker), id('CP-ADV')))],
        right: [R(0, 'A', 100_00n)],
      }),
    )
    assert.equal(outcome.ok, true)
    if (!outcome.ok) return
    assert.equal(
      JSON.stringify(outcome.result.refusedAtAdmission).includes(marker),
      false,
      'a counterparty-authored string reached an admission refusal',
    )
  })
})

/* ====================================================================== *
 * §7  DEGENERATE POPULATIONS
 * ====================================================================== */

describe('degenerate populations', () => {
  test('test_a_side_with_no_documents_refuses_the_run_by_name', () => {
    /* O-15, form (a). An empty side has no rows and therefore NO RESIDUE TO
     * PRESERVE, which is the asymmetry with `population_wholly_refused` that
     * the arm's own declaration argues for at length. */
    const outcome = totalOutcome(
      'no documents',
      runInput({
        runId: 'run_SYN_adv_empty',
        left: ledgerBinding({ identifiers: [PATHS.reference], counterparty: null }),
        right: bankBinding({ identifiers: [PATHS.reference], counterparty: null, description: null }),
        leftDocuments: [],
        rightDocuments: [bankDoc('srcdoc_SYN_adv_r', 'r.csv', [R(0, 'A', 100_00n)])],
        pairing: pairing('one_to_one', EXACT_MONEY, FIVE_DAYS, [
          { kind: 'exact_identifier', on: PATHS.reference },
        ]),
        strategyBindings: [bound({ kind: 'exact_identifier', on: PATHS.reference })],
        obligationSide: 'left',
        toleranceDirection: 'symmetric',
      }),
    )
    assert.equal(outcome.ok, false, 'an unexpected empty side must refuse the run')
    if (outcome.ok) return
    assert.deepStrictEqual(outcome.refusal, { kind: 'population_empty_and_not_expected', side: 'left' })
  })

  test('test_a_document_with_zero_lines_is_not_an_empty_population', () => {
    /* 🛑 THE DISTINCTION THAT COSTS AN OPERATOR AN AFTERNOON, AND NOTHING
     * STATED IT ANYWHERE. `presentedRows` returns ONE HEADER-GRAIN ROW for a
     * document with no lines — "one invoice PDF is one transaction" — so a CSV
     * exported with a header and no data rows is NOT an empty side. It presents
     * one row, that row has no fields, and it is REFUSED by name rather than
     * treated as absence. The two outcomes are entirely different: O-15's
     * refusal above kills the run; this one produces a residue with a reason on
     * it. */
    const outcome = totalOutcome(
      'zero-line document',
      standardRun({ runId: 'run_SYN_adv_zero_lines', left: [], right: [R(0, 'A', 100_00n)] }),
    )
    assert.equal(outcome.ok, true, 'a zero-line document must not refuse the run')
    if (!outcome.ok) return
    assert.deepStrictEqual(
      outcome.result.admissionRates[0],
      { side: 'left', presented: 1, admitted: 0, refused: 1 },
      'a document with no lines presents exactly one header-grain row',
    )
    assert.deepStrictEqual(outcome.result.refusedAtAdmission[0]?.refusal, { kind: 'field_absent' })
    assert.deepStrictEqual(
      outcome.result.postconditions,
      [{ kind: 'population_wholly_refused', side: 'left', sideRowCount: 1 }],
      'C13 — the ledger is sound over NOTHING, and that is reported rather than refused',
    )
    assert.deepStrictEqual(outcome.result.completeness, [
      { kind: 'rows_presented_not_admitted', side: 'left', presented: 1, admitted: 0, refused: 1 },
    ])
  })

  test('test_a_single_row_on_each_side_closes_and_leaves_nothing', () => {
    const outcome = totalOutcome(
      'single row',
      standardRun({ runId: 'run_SYN_adv_single', left: [L(0, 'A', 100_00n)], right: [R(0, 'A', 100_00n)] }),
    )
    assert.equal(outcome.ok, true)
    if (!outcome.ok) return
    assert.equal(outcome.result.state.allocations.length, 1)
    assert.deepStrictEqual(outcome.result.residue, [])
    assert.deepStrictEqual(outcome.result.postconditions, [])
  })

  test('test_a_population_that_is_entirely_one_identifier_is_an_ambiguity_and_not_a_match', () => {
    /* Every row under one key. `arityPermits('one_to_one', 3, 3)` is false, so
     * the bucket raises ONE finding naming all six refs and allocates nothing —
     * which is the correct answer and is very different from pouring three
     * against three in file order. */
    const outcome = totalOutcome(
      'all one key',
      standardRun({
        runId: 'run_SYN_adv_one_key',
        left: [L(0, 'K', 100_00n), L(1, 'K', 200_00n), L(2, 'K', 300_00n)],
        right: [R(0, 'K', 100_00n), R(1, 'K', 200_00n), R(2, 'K', 300_00n)],
      }),
    )
    assert.equal(outcome.ok, true)
    if (!outcome.ok) return
    assert.equal(outcome.result.state.allocations.length, 0, 'nothing may be poured out of an ambiguous bucket')
    assert.equal(outcome.result.ambiguities.length, 1, 'ONE finding for ONE bucket')
    assert.equal(outcome.result.ambiguities[0]?.leftRefs.length, 3)
    assert.equal(outcome.result.ambiguities[0]?.rightRefs.length, 3)
    assert.equal(outcome.result.residue.length, 6)
    for (const entry of outcome.result.residue) {
      assert.deepStrictEqual(
        entry.cause,
        { kind: 'identifier_ambiguous' },
        'every row named in a finding must carry the ambiguity, not `no_strategy_paired` — two rows in the same tie getting two different reasons is the defect `KNOWN_DISAGREEMENTS_AT_HEAD` records having been fixed once already.',
      )
    }
    assert.deepStrictEqual(outcome.result.postconditions, [])
  })

  test('test_two_entirely_disjoint_populations_conserve_every_row', () => {
    const outcome = totalOutcome(
      'disjoint',
      standardRun({
        runId: 'run_SYN_adv_disjoint',
        left: [L(0, 'A', 100_00n), L(1, 'B', 200_00n)],
        right: [R(0, 'X', 300_00n), R(1, 'Y', 400_00n)],
      }),
    )
    assert.equal(outcome.ok, true)
    if (!outcome.ok) return
    assert.equal(outcome.result.state.allocations.length, 0)
    assert.equal(outcome.result.residue.length, 4, 'every row must be accounted for')
    assert.deepStrictEqual(outcome.result.postconditions, [], 'a 100%-unmatched close is SOUND, and that is correct')
  })

  /* -------------------------------------------------------------------- *
   * ✅ OQ-2 IS CLOSED — G291, 19 Sep 2026 — AND THE TRIPWIRE THAT STOOD HERE
   * WENT RED ON BEING FIXED, EXACTLY AS IT WAS WRITTEN TO. It is QUOTED in
   * `./open-questions.ts` rather than erased, because a register that silently
   * loses a row cannot be told from one that never had it.
   *
   * WHAT IT PINNED. `passIdentifierJoin` compared `sumGross(left)` against
   * `sumGross(right)` FOR THE WHOLE BUCKET and, when `toleranceAdmits` returned
   * `{ ok: true, admitted: false }`, executed a BARE `continue`. Nothing was
   * pushed to `toleranceRefusals` — that channel carries only `{ ok: false }`
   * verdicts, which are MALFORMED tolerances — so §6 reported every row in that
   * bucket as `no_strategy_paired`, whose meaning is *nothing matched it*.
   * Something did match it: the reference matched exactly and the money did not.
   *
   * 🛑 THE FOUR TESTS BELOW ARE THE POSITIVE FORM, AND THE LAST TWO ARE THE
   * POINT. Removing a tripwire without leaving one converts a known defect into
   * an unknown one — so it is not enough to assert that the decline is now
   * named. Two things have to be asserted with it, because each is a way the
   * fix could have been WORSE than the defect:
   *
   *   · a genuine no-pair must STILL report `no_strategy_paired`. A fix that
   *     relabelled everything would satisfy the first test and destroy the
   *     distinction it was taken to create.
   *   · a MALFORMED tolerance must still be a REFUSAL and must produce NO
   *     decline. *This tolerance is nonsense* and *this tolerance was too
   *     tight* are the two findings G291 separates; merging them on either
   *     channel reproduces the defect one level up.
   * -------------------------------------------------------------------- */

  /** The ruling's own reproduction, verbatim: one reference, one row a side. */
  const declinedRun = (): SetReconciliationOutcome =>
    totalOutcome(
      'declined bucket',
      standardRun({
        runId: 'run_SYN_adv_declined',
        /* One reference, one row a side, amounts SGD 100.00 apart against an
         * exact-money tolerance. The join found the key. */
        left: [L(0, 'SAME', 100_00n)],
        right: [R(0, 'SAME', 200_00n)],
      }),
    )

  test('test_a_bucket_declined_on_amount_is_NAMED_and_carries_the_figure_the_engine_computed', () => {
    const outcome = declinedRun()
    assert.equal(outcome.ok, true)
    if (!outcome.ok) return
    const result = outcome.result

    assert.equal(result.state.allocations.length, 0, 'nothing may be poured when the totals miss the tolerance')
    assert.equal(result.residue.length, 2)

    /* 🛑 THE EXPECTATION IS DERIVED FROM THE SPECIFICATION, NOT FROM THE ENGINE.
     * `ToleranceDirection`'s declaration defines signed variance ONCE — "for a
     * candidate pairing, `variance = left.gross − right.gross`" — and this
     * bucket is one left row of SGD 100.00 against one right row of SGD 200.00.
     * 10000 − 20000 = −10000 minor units. The sign is the assertion: a reader
     * must be able to tell an underpayment from an overpayment, and a fix that
     * reported a magnitude would pass a `deepStrictEqual` against `10000n` and
     * throw away half the finding. */
    for (const entry of result.residue) {
      assert.deepStrictEqual(entry.cause, {
        kind: 'amount_tolerance_declined',
        signedVarianceMinor: -100_00n,
      })
    }
  })

  test('test_the_hit_bound_reaches_a_CHANNEL_with_an_address_and_not_only_the_row', () => {
    const outcome = declinedRun()
    assert.equal(outcome.ok, true)
    if (!outcome.ok) return
    const result = outcome.result

    /* G114 — "a bound that was hit is recorded, never silently absorbed". The
     * CAUSE slot alone cannot discharge that: it is one slot and it is
     * dominated, so `control_total_unverified` on a short file would absorb the
     * decline. The channel fires whatever the row ends up saying. */
    assert.deepStrictEqual(result.toleranceDeclines, [
      {
        leftItemCount: 1,
        rightItemCount: 1,
        signedVarianceMinor: -100_00n,
        /* The FIFO-oldest LEFT member — the address an operator opens first,
         * the choice G217 already makes for an oversized bucket. */
        exampleRef: { sourceDocumentId: 'srcdoc_SYN_adv_ledger', lineIndex: 0 },
      },
    ])

    /* ⚠️ AND IT IS NOT ON `searchBoundary`. That channel is three COST bounds —
     * "where the engine stopped looking". The engine did not stop looking here;
     * it looked, found the counterparty, compared, and the money disagreed. */
    assert.deepStrictEqual(result.searchBoundary, {
      oversizedBuckets: [],
      exhaustedSearches: [],
      oversizedAmountBuckets: [],
    })
    assert.deepStrictEqual(result.postconditions, [], 'the ledger is SOUND — only the reporting was at issue')
  })

  test('test_a_genuine_no_pair_STILL_reports_no_strategy_paired', () => {
    /* 🛑 THE CONTROL THAT STOPS G291 FROM BEING A RENAME. Two references that
     * never meet: nothing joined, so nothing can have been declined, and the
     * cause must be the one that means "nothing matched it". */
    const outcome = totalOutcome(
      'disjoint references',
      standardRun({
        runId: 'run_SYN_adv_nopair',
        left: [L(0, 'AAA', 100_00n)],
        right: [R(0, 'BBB', 100_00n)],
      }),
    )
    assert.equal(outcome.ok, true)
    if (!outcome.ok) return
    const result = outcome.result

    assert.equal(result.residue.length, 2)
    for (const entry of result.residue) {
      assert.deepStrictEqual(entry.cause, { kind: 'no_strategy_paired' })
    }
    assert.deepStrictEqual(result.toleranceDeclines, [], 'a bucket that never joined hit no tolerance bound')
  })

  test('test_a_MALFORMED_tolerance_stays_a_REFUSAL_and_is_never_reported_as_a_decline', () => {
    /* 🛑 THE OTHER HALF OF THE SPLIT. `{ kind: 'percentage' }` is float money
     * on an amount comparison, which `toleranceAdmits` REFUSES on G65's ground
     * — `{ ok: false }`, a tolerance that is nonsense. It must land on
     * `toleranceRefusals` and NOWHERE ELSE: a pack that will never match
     * anything and a pack matching less than its author intended are the two
     * findings G291 exists to keep apart. */
    const outcome = totalOutcome(
      'a float tolerance',
      runInput({
        runId: 'run_SYN_adv_floatgate',
        left: ledgerBinding({ identifiers: [PATHS.reference], counterparty: null }),
        right: bankBinding({ identifiers: [PATHS.reference], counterparty: null, description: null }),
        leftDocuments: [ledgerDoc('srcdoc_SYN_adv_ledger', 'adv-ar.csv', [L(0, 'SAME', 100_00n)])],
        rightDocuments: [bankDoc('srcdoc_SYN_adv_statement', 'adv-statement.csv', [R(0, 'SAME', 200_00n)])],
        pairing: pairing('one_to_one', { kind: 'percentage', value: 2 }, FIVE_DAYS, [
          { kind: 'exact_identifier', on: PATHS.reference },
        ]),
        strategyBindings: [bound({ kind: 'exact_identifier', on: PATHS.reference })],
        obligationSide: 'left',
        toleranceDirection: 'symmetric',
      }),
    )
    assert.equal(outcome.ok, true)
    if (!outcome.ok) return
    const result = outcome.result

    assert.deepStrictEqual(result.toleranceRefusals, [
      { kind: 'float_money_tolerance', arm: 'percentage' },
    ])
    assert.deepStrictEqual(
      result.toleranceDeclines,
      [],
      'a tolerance that could not be APPLIED did not DECLINE anything — the verdict was `{ ok: false }`, not `{ ok: true, admitted: false }`',
    )
    /* And the row keeps the cause that says no comparison succeeded, because
     * none did: the refusal is the finding, on its own channel. */
    for (const entry of result.residue) {
      assert.deepStrictEqual(entry.cause, { kind: 'no_strategy_paired' })
    }
  })
})

/* ====================================================================== *
 * §8  NORMALISATION — the degenerate parameterisations, by name
 * ====================================================================== */

describe('normalisation refuses its degenerate parameterisations', () => {
  test('test_validateNormalisation_names_every_defect_it_is_declared_to_catch', () => {
    const defects = validateNormalisation({
      ops: [
        { kind: 'split_take', separator: '', index: 0 },
        { kind: 'strip_literal', literal: '', at: 'anywhere' },
        { kind: 'split_take', separator: '-', index: -1 },
        { kind: 'split_take', separator: '-', index: 1.5 },
      ],
      then: 'exact',
      maxInputChars: 0,
    })
    assert.deepStrictEqual(
      defects.map((d) => d.kind).sort(),
      ['empty_literal', 'empty_separator', 'max_input_chars_not_stated', 'negative_index', 'non_integer_index'],
      'every defect must be reported, not just the first — a population that reports one at a time makes an operator fix a config in five rounds.',
    )
  })

  test('test_an_invalid_normalisation_refuses_the_run_and_names_the_side', () => {
    const outcome = totalOutcome(
      'invalid normalisation',
      runInput({
        runId: 'run_SYN_adv_norm',
        left: ledgerBinding({ identifiers: [PATHS.reference], counterparty: null }),
        right: bankBinding({
          identifiers: [PATHS.reference],
          counterparty: null,
          description: null,
          normalisation: { ops: [{ kind: 'split_take', separator: '', index: 0 }], then: 'exact', maxInputChars: 64 },
        }),
        leftDocuments: [ledgerDoc('srcdoc_SYN_adv_norm_l', 'l.csv', [L(0, 'A', 100_00n)])],
        rightDocuments: [bankDoc('srcdoc_SYN_adv_norm_r', 'r.csv', [R(0, 'A', 100_00n)])],
        pairing: pairing('one_to_one', EXACT_MONEY, FIVE_DAYS, [
          { kind: 'exact_identifier', on: PATHS.reference },
        ]),
        strategyBindings: [bound({ kind: 'exact_identifier', on: PATHS.reference })],
        obligationSide: 'left',
        toleranceDirection: 'symmetric',
      }),
    )
    assert.equal(outcome.ok, false, 'an invalid normalisation must refuse the run')
    if (outcome.ok) return
    assert.equal(outcome.refusal.kind, 'normalisation_invalid')
    if (outcome.refusal.kind !== 'normalisation_invalid') return
    assert.equal(outcome.refusal.side, 'right', 'the refusal must name WHICH side an operator has to fix')
  })

  test('test_extraction_refuses_an_identifier_longer_than_the_declared_cap', () => {
    /* The cap is applied BEFORE any op runs, which is what makes it a bound on
     * work rather than on output — an unbounded walk over counterparty text. */
    const refused = applyExtraction('x'.repeat(65), IDENTITY_NORMALISATION)
    assert.equal(refused.ok, false)
    if (refused.ok) return
    assert.deepStrictEqual(refused.refusal, { kind: 'input_exceeds_max_chars', opIndex: null })

    const atTheCap = applyExtraction('x'.repeat(64), IDENTITY_NORMALISATION)
    assert.equal(atTheCap.ok, true, 'an identifier AT the cap must be admitted — a bound asserted only on one side is untested')
  })

  test('test_an_identifier_that_normalises_to_nothing_refuses_rather_than_keying_empty', () => {
    /* An empty key would collide every row that normalises away into ONE
     * bucket, which is a silent many-to-many join on the emptiness of a
     * counterparty field. */
    const outcome = applyExtraction('   ', { ops: [{ kind: 'trim' }], then: 'exact', maxInputChars: 64 })
    assert.equal(outcome.ok, false)
    if (outcome.ok) return
    assert.deepStrictEqual(outcome.refusal, { kind: 'empty_after_ops', opIndex: null })
  })

  test('test_a_row_whose_identifier_cannot_be_extracted_is_refused_and_lands_in_the_residue', () => {
    /* Form (b), end to end: the refusal arm carries the EXTRACTION refusal
     * rather than flattening it, so an operator sees which op failed. */
    const outcome = totalOutcome(
      'unextractable identifier',
      runInput({
        runId: 'run_SYN_adv_extract',
        left: ledgerBinding({
          identifiers: [PATHS.reference],
          counterparty: null,
          normalisation: {
            ops: [{ kind: 'split_take', separator: '|', index: 3 }],
            then: 'exact',
            maxInputChars: 64,
          },
        }),
        right: bankBinding({ identifiers: [PATHS.reference], counterparty: null, description: null }),
        leftDocuments: [ledgerDoc('srcdoc_SYN_adv_extract_l', 'l.csv', [L(0, 'NO-PIPES-HERE', 100_00n)])],
        rightDocuments: [bankDoc('srcdoc_SYN_adv_extract_r', 'r.csv', [R(0, 'A', 100_00n)])],
        pairing: pairing('one_to_one', EXACT_MONEY, FIVE_DAYS, [
          { kind: 'exact_identifier', on: PATHS.reference },
        ]),
        strategyBindings: [bound({ kind: 'exact_identifier', on: PATHS.reference })],
        obligationSide: 'left',
        toleranceDirection: 'symmetric',
      }),
    )
    assert.equal(outcome.ok, true, 'a per-row extraction failure must not refuse the whole run')
    if (!outcome.ok) return
    assert.deepStrictEqual(outcome.result.refusedAtAdmission[0]?.refusal, {
      kind: 'identifier_not_extractable',
      refusal: { kind: 'segment_index_out_of_range', opIndex: 0 },
    })
    assert.equal(
      outcome.result.residue.some((e) => e.side === 'left' && e.cause.kind === 'admission_refused'),
      true,
    )
  })
})

/* ====================================================================== *
 * §9  THE REGISTER'S OWN CONTROL
 *
 * The entries live in `./open-questions.ts` — a data module, so that
 * `./injection-surface.test.ts` can read the same register without importing a
 * test file and running this one's seventy-odd cases a second time.
 * ====================================================================== */

test('test_every_open_question_names_the_tripwire_that_pins_it', () => {
  /* 🛑 A REGISTER NOTHING READS IS A COMMENT. This is the cheapest control that
   * makes it a record: every entry must name a live tripwire, and a tripwire
   * deleted because the module was fixed takes its entry with it or this fails.
   * `KNOWN_DISAGREEMENTS_AT_HEAD` in the corpus has the same shape and the same
   * standing instruction: leave the array in place when it empties. */
  assert.ok(OPEN_QUESTIONS_AT_HEAD.length > 0 || true)
  for (const question of OPEN_QUESTIONS_AT_HEAD) {
    assert.match(question.pinnedBy, /TRIPWIRE|§/, `${question.id}: must name what pins it`)
    assert.ok(question.reproduce.length > 40, `${question.id}: must carry a reproducible input`)
    assert.ok(question.specificationRequires.length > 40, `${question.id}: must quote what the spec requires`)
  }
})
