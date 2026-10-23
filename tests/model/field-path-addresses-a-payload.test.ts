/**
 * I-4 / #237 — `FieldPath = string` ADDRESSES NOTHING.
 *
 * G106 rules two things about a schema-agnostic JSONB payload: `FieldSpec`
 * gains a real JSONB path, and a key with no `FieldSpec` is UNREADABLE —
 * stored, but unaddressable by any agent, prompt, export or dashboard.
 * Fail-closed, matching `DENY_ALL`.
 *
 * THE REFUSAL HALF IS EXECUTABLE AND IS NOT THE GAP. `AdmissionRefusal` carries
 * `{ kind: 'field_not_classified' }` and `admitOne()` refuses on it at four call
 * sites whenever a declared path is absent from `fieldClassification`.
 *
 * THE ADDRESSING HALF DID NOT EXIST. `export type FieldPath = string` is a
 * naked alias with nothing tying it to a payload key, so invariant 4 —
 * "classification is declared once, on `FieldSpec`, and everything derives from
 * it" — addressed whatever the operator typed into a string.
 *
 * ─── THE RULING THIS FILE IS WRITTEN AGAINST: G214, 22 Aug 2026 ───
 *
 * `FieldPath` becomes a STRUCTURED TOKEN LIST — a branded array of segments,
 * parsed at ONE SEAM. Not a string with a grammar.
 *
 * The deciding fact is that the keys are counterparty-controlled. A dotted path
 * breaks on any key containing a dot, which is legal JSON and therefore will
 * happen, and its failure mode is the bad one: it silently addresses the WRONG
 * key rather than refusing — scope failing OPEN, which `docs/HANDOFF.md` §5.5
 * records this codebase already fixing once. §3 below is the executable form of
 * that sentence.
 *
 * JSON Pointer (RFC 6901) was the respectable alternative and is preserved as
 * REJECTED: its correctness lives in a parse-and-unescape step at every
 * boundary, and correctness that lives at call sites is correctness that drifts
 * — the same sentence G111 uses about the money codec and G67 about
 * `parseFxRate()`.
 *
 * ─── WHY THE SEAM IS REACHED THROUGH A COMPUTED SPECIFIER ───
 *
 * 🛑 THIS FILE WAS COMMITTED RED AND THE BYTES DID NOT CHANGE WHEN IT WENT
 * GREEN. That is the whole reason for the shim in §0.
 *
 * `model/field-path.ts` did not exist when this file was written. A STATIC
 * import of a module that does not exist is a `TS2307`, and `npm test` runs
 * `typecheck:tests` before it executes a single assertion — so the whole file
 * would have failed to compile and the runner would have reported one error
 * rather than `tests N · pass k · fail N-k`. #237 §2 names that trap: "a file
 * that imports one fails identically everywhere; carry assertions that pass at
 * base". The computed specifier defers resolution to run time, so the cases
 * that do not touch the seam still run, still pass, and still say what did not
 * regress while the rest were red.
 *
 * The cast at the module boundary is the ONE cast in this file and it is typed
 * against the REAL `FieldPath` from `model/kernel.ts`, not against a local
 * stand-in — so every case below is checked by `tsc` against whatever
 * `FieldPath` actually is, in both the red tree and the green one.
 *
 * ⚠️ THE FIXTURE'S COLLECTION TYPES ARE READ OFF THE ENGINE'S OWN SIGNATURE
 * (`SetReconciliationInput['fieldClassification']`, `ExtractedLine['fields']`)
 * rather than spelled out. Spelling them out would have pinned this file to the
 * representation it exists to change; reading them off the engine means the
 * fixture follows the retype instead of blocking it.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { runSetReconciliation } from '../../model/reconciliation.ts'
import type {
  PopulationBinding,
  SetReconciliationInput,
  SetReconciliationResult,
} from '../../model/reconciliation.ts'
import type {
  ControlTotal,
  DataClass,
  ExtractedLine,
  ExtractedScalar,
  ExtractedValue,
  PairingStrategy,
  SourceDocument,
} from '../../model/domain.ts'
import type {
  DocumentTypeId,
  FieldPath,
  RunId,
  SourceDocumentId,
  TenantId,
} from '../../model/kernel.ts'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (relative: string): string => readFileSync(join(REPO_ROOT, relative), 'utf8')

/* ==================================================================== *
 * §0  THE SHIM — the seam, reached without a static import
 * ==================================================================== */

/**
 * A closed refusal. The `kind` is all a caller may read, and the absence of any
 * other member is the point: #237 §2 requires that an absent key returns a
 * closed refusal and NEVER `undefined`. `undefined`-is-falsy is the fail-open
 * shape G178 names elsewhere in the model and it must not be reintroduced here.
 */
interface Refusal {
  readonly kind: string
}

type ParseResult = { readonly ok: true; readonly path: FieldPath } | { readonly ok: false; readonly refusal: Refusal }

type Resolution = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly refusal: Refusal }

interface FieldPathSeam {
  parseFieldPath(input: unknown): ParseResult
  fieldPathKey(path: FieldPath): string
  resolveFieldPath(payload: unknown, path: FieldPath): Resolution
  addressableKeys(declared: readonly FieldPath[]): ReadonlySet<string>
  isAddressable(addressable: ReadonlySet<string>, path: FieldPath): boolean
}

const SEAM_SPECIFIER = '../../model/field-path.ts'

const loadedSeam: FieldPathSeam | null = await (async (): Promise<FieldPathSeam | null> => {
  try {
    const loaded: unknown = await import(SEAM_SPECIFIER)
    return loaded as FieldPathSeam
  } catch {
    return null
  }
})()

function seam(): FieldPathSeam {
  assert.ok(
    loadedSeam !== null,
    'THE ADDRESSING HALF OF G106 IS UNBUILT. `model/field-path.ts` — the one seam G214 rules ' +
      'must parse a `FieldPath`, and the only thing permitted to touch its representation — ' +
      'does not exist, so nothing binds a `FieldSpec` to a position in a JSONB document.',
  )
  return loadedSeam
}

/** Parse or fail the case. A refusal here is a defect in the fixture, not a result. */
function pathOf(...tokens: readonly (string | number)[]): FieldPath {
  const parsed = seam().parseFieldPath(tokens)
  assert.ok(parsed.ok, `the seam refused a fixture path: ${parsed.ok ? '' : parsed.refusal.kind}`)
  return parsed.path
}

/* ==================================================================== *
 * §1  THE FIXTURE — one tenant, line-grain documents, one strategy
 *
 * Built here rather than imported from `tests/scenarios/recon-corpus.ts`, so
 * the four refusal sites have a SECOND independent construction site
 * (`docs/HANDOFF.md` §5.10 — a control witnessed by one builder is witnessed by
 * that builder).
 * ==================================================================== */

const TENANT = 'tenant-field-path-fixture' as TenantId
const DOC_TYPE = 'doctype-field-path-fixture' as DocumentTypeId

type ClassificationMap = SetReconciliationInput['fieldClassification']
type PromptEligibleSet = SetReconciliationInput['modelPromptEligible']
type FieldsRecord = ExtractedLine['fields']
/** G227. The floor map's own type, taken off the input rather than re-spelled. */
type ConfidenceFloorMap = SetReconciliationInput['confidenceFloors']
/** No field on this run declares a floor, so no read is held. */
const NO_CONFIDENCE_FLOORS: ConfidenceFloorMap = new Map()

/**
 * The four paths the four refusal sites read, one per site: amount, date, an
 * identifier, and the counterparty partition key.
 *
 * ⚠️ `counterparty` IS A TWO-SEGMENT PATH AND THE FIRST SEGMENT CARRIES A DOT.
 * `payer.ref` is a legal JSON key and a counterparty document may supply one.
 * Under a dotted grammar this path and the path `['payer', 'ref', 'code']`
 * produce the same string and address different keys — the silent-wrong-key
 * failure G214 names as the deciding fact. Under a token list there is nothing
 * to escape, so the two are simply different values.
 */
const P = {
  amount: (): FieldPath => pathOf('amount'),
  date: (): FieldPath => pathOf('date'),
  reference: (): FieldPath => pathOf('reference'),
  counterparty: (): FieldPath => pathOf('payer.ref', 'code'),
}

function classificationWithout(omitted: FieldPath | null): ClassificationMap {
  const { fieldPathKey } = seam()
  const omittedKey = omitted === null ? null : fieldPathKey(omitted)
  const entries: [string, DataClass][] = []
  for (const path of [P.amount(), P.date(), P.reference(), P.counterparty()]) {
    const key = fieldPathKey(path)
    if (key === omittedKey) continue
    entries.push([key, 'internal'])
  }
  /* THE SHIM, second and last use. The engine's key type is whatever the engine
   * says it is; this fixture must not restate it. */
  return new Map(entries) as unknown as ClassificationMap
}

const NOTHING_PROMPT_ELIGIBLE = new Set<string>() as unknown as PromptEligibleSet

function value(scalar: ExtractedScalar): ExtractedValue {
  return { scalar, provenance: { page: null, boundingBox: null, confidence: null } }
}

function money(minor: bigint): ExtractedScalar {
  return { kind: 'money', value: { currency: 'SGD', amountMinor: minor, exponent: 2 } }
}

function row(index: number, reference: string, minor: bigint): ExtractedLine {
  const { fieldPathKey } = seam()
  const fields: Record<string, ExtractedValue> = {
    [fieldPathKey(P.amount())]: value(money(minor)),
    [fieldPathKey(P.date())]: value({ kind: 'date', value: '2026-03-03' }),
    [fieldPathKey(P.reference())]: value({ kind: 'identifier', value: reference }),
    [fieldPathKey(P.counterparty())]: value({ kind: 'identifier', value: 'CUST-1' }),
  }
  return { index, fields: fields as unknown as FieldsRecord }
}

const NO_TRAILER: ControlTotal = { kind: 'not_declared_by_format' }

function documentOf(docId: string, lines: readonly ExtractedLine[]): SourceDocument {
  return {
    tenantId: TENANT,
    id: docId as SourceDocumentId,
    documentTypeId: DOC_TYPE,
    filename: `${docId}.csv`,
    storageRef: `fixture://${docId}`,
    extracted: {} as unknown as FieldsRecord,
    lines: [...lines],
    controlTotal: NO_TRAILER,
    ingestedAt: '2026-04-01T09:00:00.000Z',
    /* Truthful — pass F ruled the sandbox is synthetic-only and enforced. */
    synthetic: true,
    purgeAfter: '2033-04-01T09:00:00.000Z',
    purgedAt: null,
  }
}

function population(): PopulationBinding {
  return {
    spec: {
      documentTypeId: DOC_TYPE,
      amount: P.amount(),
      date: P.date(),
      identifiers: [P.reference()],
    },
    carriesControlTotal: 'never',
    emptyExpectation: 'refuses',
    declaredUnit: { currency: 'SGD', exponent: 2 },
    normalisation: { ops: [], then: 'exact', maxInputChars: 64 },
    /* The fourth refusal site. Null here would leave it unreachable. */
    counterparty: P.counterparty(),
    description: null,
  }
}

function inputOf(classification: ClassificationMap): SetReconciliationInput {
  const strategy: PairingStrategy = { kind: 'exact_identifier', on: P.reference() }
  return {
    runId: 'run-field-path-fixture' as RunId,
    tenantId: TENANT,
    left: population(),
    right: population(),
    leftDocuments: [documentOf('doc-ledger', [row(0, 'INV-9001', 100_00n)])],
    rightDocuments: [documentOf('doc-bank', [row(0, 'INV-9001', 100_00n)])],
    pairing: {
      cardinality: 'one_to_one',
      amountTolerance: { kind: 'rounding', minorUnits: 0 },
      dateTolerance: { kind: 'days', value: 0 },
      strategies: [strategy],
    },
    strategyBindings: [{ strategy, amountTolerance: null, amountAnchor: 'exact' }],
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
    fieldClassification: classification,
    modelPromptEligible: NOTHING_PROMPT_ELIGIBLE,
    /* G227. No floor stated: this suite is about ADDRESSING a path, not about
     * how confidently one was read. */
    confidenceFloors: NO_CONFIDENCE_FLOORS,
    subsetSumBound: { maxMembers: 8, stepBudget: 5000, maxBucketSize: 50 },
    readerCandidateCap: 5,
    similarityMaxChars: 128,
    similarityMetric: 'levenshtein_ratio',
    /* Every row is refused in four of the five runs below, so the rate arm must
     * not close the run before the refusal it exists to witness is observable. */
    admissionRefusalCeilingBasisPoints: 9_999,
  }
}

function runOrFail(classification: ClassificationMap): SetReconciliationResult {
  const outcome = runSetReconciliation(inputOf(classification))
  assert.ok(outcome.ok, `the engine refused the fixture: ${outcome.ok ? '' : outcome.refusal.kind}`)
  return outcome.result
}

/* ==================================================================== *
 * §2  CARRY — what already worked and must not regress
 *
 * These three pass at base. #237 §2: "carry assertions that pass at base — that
 * `FieldSpec.path` exists, that `field_not_classified` already refuses at four
 * sites — and report `tests N · pass N-k · fail k`."
 * ==================================================================== */

test('CARRY — `FieldSpec` still declares a `path`, and it is still the only site', () => {
  const domain = read('model/domain.ts')
  const at = domain.indexOf('export interface FieldSpec')
  assert.notEqual(at, -1, '`FieldSpec` is gone from `model/domain.ts`')
  const body = domain.slice(at, domain.indexOf('\n}', at))
  assert.match(
    body,
    /\n {2}path: FieldPath\n/,
    '`FieldSpec.path` is no longer declared `FieldPath`. Invariant 4 says classification is ' +
      'declared ONCE, on `FieldSpec` — this slice retypes what `FieldPath` IS and must not ' +
      'move where it is declared.',
  )
})

test('CARRY — `field_not_classified` is declared once and refused at four sites', () => {
  const engine = read('model/reconciliation.ts')
  const mentions = engine.split('field_not_classified').length - 1
  assert.equal(
    mentions,
    5,
    'One declaration plus four refusals. `grep -c field_not_classified model/reconciliation.ts` ' +
      'is the derivation #237 §4 makes an acceptance criterion, and it must still return 5 ' +
      'after the retype.',
  )
})

test('CARRY — the admission refusal union still carries no text', () => {
  const engine = read('model/reconciliation.ts')
  assert.match(
    engine,
    /export type _AdmissionRefusalHoldsNoText = AssertNoTextDeep<AdmissionRefusal>/,
    'Invariant 6. The compile-time containment sentinel over `AdmissionRefusal` is gone, so ' +
      'nothing stops a counterparty-controlled key from riding out on a refusal.',
  )
})

/* ==================================================================== *
 * §3  THE TYPE — `FieldPath` stops being a naked string alias
 * ==================================================================== */

test('`FieldPath` is no longer `= string`, and the grammar is stated on the declaration', () => {
  const kernel = read('model/kernel.ts')

  assert.equal(
    kernel.split('export type FieldPath = string').length - 1,
    0,
    '#237 §4, first acceptance criterion: `grep -c "export type FieldPath = string" ' +
      'model/kernel.ts` must return 0. A naked alias READS AS CHECKED IN A REVIEW AND IS NOT ' +
      '— any string in the program satisfies it.',
  )

  const at = kernel.indexOf('export type FieldPath')
  assert.notEqual(at, -1, '`FieldPath` is not declared in `model/kernel.ts` at all')
  const declaration = kernel.slice(at, at + 400)
  assert.match(
    declaration,
    /FieldSegment/,
    'The declaration does not name a segment type, so it is not a token list. G214: a branded ' +
      'ARRAY OF SEGMENTS, not a string with a grammar.',
  )

  /* The grammar is stated ONCE, on the declaration — #237 §6, "whichever is
   * chosen: it is stated once, on the declaration, with the array-index rule
   * explicit". A grammar chosen at a call site is a second grammar. */
  const preamble = kernel.slice(Math.max(0, at - 3000), at)
  assert.match(
    preamble,
    /index/i,
    'The array-index rule is not stated on the declaration. #237 §6 requires it explicitly, ' +
      'because an index is the one segment kind a reader will otherwise invent a spelling for.',
  )
})

/* ==================================================================== *
 * §4  ONE SEAM — the lazy repair, named and refused
 *
 * 🛑 THE LAZY REPAIR IS WHAT THE TREE ALREADY INVITES: leave `FieldPath =
 * string` and `split('.')` at the call site. It typechecks, it works on the
 * happy path, and it is precisely the correctness-lives-at-call-sites shape
 * G111 exists to refuse for money.
 * ==================================================================== */

function modelSources(): readonly { readonly file: string; readonly text: string }[] {
  return readdirSync(join(REPO_ROOT, 'model'))
    .filter((f) => f.endsWith('.ts'))
    .map((f) => ({ file: `model/${f}`, text: read(`model/${f}`) }))
}

test('exactly one module parses a `FieldPath`, and nothing else constructs one', () => {
  const sources = modelSources()

  const parsers = sources.filter((s) => /export function parseFieldPath\b/.test(s.text))
  assert.deepEqual(
    parsers.map((s) => s.file),
    ['model/field-path.ts'],
    'THE PARSE MUST HAVE EXACTLY ONE HOME. G111 for the money codec, G67 for `parseFxRate()`, ' +
      'G214 for this: "one seam parses; nothing else touches the representation."',
  )

  /* Nothing outside the seam may mint a `FieldPath` by assertion. A cast is a
   * second constructor with no validation in it. */
  const minters = sources.filter(
    (s) => s.file !== 'model/field-path.ts' && /as unknown as FieldPath\b|\bas FieldPath\b/.test(s.text),
  )
  assert.deepEqual(
    minters.map((s) => s.file),
    [],
    'A module outside the seam casts to `FieldPath`. That is a second construction site with ' +
      'no parse in it — exactly what G214 forbids.',
  )

  /* And nobody re-invents a string grammar beside the token list.
   *
   * 🛑 THIS RULE WAS KEYED ON A SPELLING AND NOT ON THE PROPERTY IT PROTECTS,
   * AND IT CAUGHT SOMETHING THAT IS NOT THE DEFECT — §5.1's landmark
   * substitution, arriving inside a control written to enforce a seam.
   * `model/serving-host.ts` (23 Aug 2026, G179) splits a HOSTNAME into DNS
   * labels at registration time. Dots separating DNS labels are not the
   * grammar G214 is about: a `FieldPath` addresses a key in a counterparty
   * payload, and the whole argument for the token list is that a counterparty
   * key may CONTAIN a dot. A DNS label may not — RFC 1035 — so there is no
   * ambiguity for a second grammar to resolve differently.
   *
   * ⚠️ THE EXEMPTION IS CONDITIONED RATHER THAN GRANTED, and both conditions
   * are asserted below. An exempt module that so much as mentions `FieldPath`
   * is back under the rule, and an exemption that stops being needed FAILS
   * rather than lingering — a stale allow-list entry is how a rule quietly
   * stops applying to the thing it was written for. */
  const HOSTNAME_GRAMMAR_EXEMPT = ['model/serving-host.ts'] as const

  const splitters = sources.filter(
    (s) =>
      /\bsplit\(['"][./]['"]\)/.test(s.text) &&
      !(HOSTNAME_GRAMMAR_EXEMPT as readonly string[]).includes(s.file),
  )
  assert.deepEqual(
    splitters.map((s) => s.file),
    [],
    'A module splits a string on `.` or `/`. A grammar chosen at a call site is a second ' +
      'grammar, and the first one to disagree wins silently.',
  )

  for (const file of HOSTNAME_GRAMMAR_EXEMPT) {
    const exempt = sources.find((s) => s.file === file)
    assert.notEqual(exempt, undefined, `the exemption names ${file}, which is not in model/`)
    if (exempt === undefined) continue
    assert.equal(
      /\bsplit\(['"][./]['"]\)/.test(exempt.text),
      true,
      `${file} no longer splits on a dot. Remove the exemption rather than leaving a ` +
        'dead allow-list entry that silently widens this rule.',
    )
    assert.equal(
      /FieldPath/.test(exempt.text),
      false,
      `${file} is exempt from the grammar rule ONLY because it has nothing to do with ` +
        '`FieldPath`. It now names one, so the exemption is void and the split must go ' +
        'through the seam.',
    )
  }
})

/* ==================================================================== *
 * §5  RESOLUTION — exactly one key, or a closed refusal
 * ==================================================================== */

test('a path resolves to exactly one JSONB key, and a dot in a key does not move it', () => {
  const { resolveFieldPath } = seam()

  /* Two payloads that a DOTTED grammar cannot tell apart. Both are legal JSON
   * and a counterparty supplies the keys. */
  const dottedKey = { 'payer.ref': { code: 'RIGHT' }, payer: { ref: { code: 'WRONG' } } }

  const viaDottedKey = resolveFieldPath(dottedKey, pathOf('payer.ref', 'code'))
  assert.ok(viaDottedKey.ok, 'the resolver could not reach a key containing a dot')
  assert.equal(
    viaDottedKey.value,
    'RIGHT',
    'THE DECIDING FACT OF G214, AS AN ASSERTION. A dotted grammar addresses `payer → ref → ' +
      'code` here and returns WRONG — silently, with no refusal, which is scope failing OPEN.',
  )

  const viaNesting = resolveFieldPath(dottedKey, pathOf('payer', 'ref', 'code'))
  assert.ok(viaNesting.ok, 'the resolver could not reach the nested key')
  assert.equal(viaNesting.value, 'WRONG', 'the two paths must address two different keys')

  /* Array indices — the rule the declaration states explicitly. */
  const indexed = { invoice: { lines: [{ amount: 1 }, { amount: 2 }] } }
  const second = resolveFieldPath(indexed, pathOf('invoice', 'lines', 1, 'amount'))
  assert.ok(second.ok, 'the resolver could not reach an array element')
  assert.equal(second.value, 2)
})

test('an absent key returns a CLOSED REFUSAL, never `undefined`', () => {
  const { resolveFieldPath } = seam()

  const absent = resolveFieldPath({ present: 1 }, pathOf('missing'))
  assert.equal(absent.ok, false, 'an absent key resolved instead of refusing')
  assert.ok(
    !absent.ok && typeof absent.refusal.kind === 'string' && absent.refusal.kind.length > 0,
    'the refusal is not a closed union member. G178 names the `undefined`-is-falsy shape and ' +
      'it must not be reintroduced: a caller that reads a falsy answer as "no such field" ' +
      'cannot tell it from "the field is there and holds null".',
  )

  /* THE OTHER HALF OF G178, AND IT IS THE HALF PEOPLE GET WRONG. A key that IS
   * present and holds `null` must RESOLVE — the value is null, the field is
   * there. `payload[key] === undefined` cannot tell these two apart. */
  const nullValued = resolveFieldPath({ present: null }, pathOf('present'))
  assert.ok(
    nullValued.ok,
    'a key present in the payload and holding `null` was refused as absent. That is the ' +
      'falsy-lookup defect wearing the other hat.',
  )
  assert.equal(nullValued.value, null)

  /* A key inherited from the prototype is NOT a key of the payload. The keys
   * are counterparty-controlled, so `toString` and `constructor` arrive by
   * choice, not by accident. */
  const inherited = resolveFieldPath({ present: 1 }, pathOf('constructor'))
  assert.equal(
    inherited.ok,
    false,
    'a prototype member resolved as a payload key. A counterparty who names a field ' +
      '`constructor` must not reach `Object.prototype`.',
  )

  /* Descending through a scalar is a refusal, not a crash and not a silence. */
  const throughScalar = resolveFieldPath({ present: 1 }, pathOf('present', 'deeper'))
  assert.equal(throughScalar.ok, false, 'descending through a scalar did not refuse')
})

test('the resolver carries no counterparty key text into a refusal', () => {
  const { resolveFieldPath } = seam()
  const secret = 'passport_number_of_the_data_subject'
  const refused = resolveFieldPath({ other: 1 }, pathOf(secret))
  assert.equal(refused.ok, false)
  assert.ok(
    !refused.ok && !JSON.stringify(refused.refusal).includes(secret),
    'Invariant 6 — ingested content is data, never instruction, and a key is content. A ' +
      'refusal is the value most likely to reach a log or a span attribute; the cheapest way ' +
      'to make that harmless is for the type not to admit the text.',
  )
})

/* ==================================================================== *
 * §6  UNREADABLE BY DEFAULT — the fail-closed half
 * ==================================================================== */

test('a payload key with no `FieldSpec` is absent from the addressable set', () => {
  const { addressableKeys, isAddressable, fieldPathKey } = seam()

  const declared = [P.amount(), P.date()]
  const addressable = addressableKeys(declared)

  assert.equal(addressable.size, 2, 'the addressable set is not exactly the declared paths')
  for (const path of declared) {
    assert.ok(isAddressable(addressable, path), 'a declared path is not addressable')
  }

  /* The unmapped key. Present in the payload, classified by nothing. */
  const unmapped = pathOf('reference')
  assert.equal(
    isAddressable(addressable, unmapped),
    false,
    'G106, fail-closed: a key with no `FieldSpec` is UNREADABLE — stored, but unaddressable ' +
      'by any agent, prompt, export or dashboard. Not "present with a default class"; ABSENT.',
  )
  assert.equal(
    addressable.has(fieldPathKey(unmapped)),
    false,
    'the unmapped key is in the addressable set under its own key',
  )
})

test('the rejected alternative stays rejected — no default class anywhere', () => {
  /* G106 refused defaulting unmapped keys to the most sensitive class, on the
   * ground that readable-by-default-with-a-high-bar is scope failing OPEN.
   * `docs/HANDOFF.md` §5.5 records this codebase already fixing that once. */
  const seamSource = read('model/field-path.ts')
  assert.doesNotMatch(
    seamSource,
    /\b(defaultClass|DEFAULT_DATA_CLASS|dataClass\s*=\s*['"])/,
    'The seam assigns a default `DataClass`. G106 refused exactly this: an unmapped key gets ' +
      'no class, not a conservative one, because a class makes it readable.',
  )
  assert.doesNotMatch(
    seamSource,
    /\bDataClass\b/,
    'The seam names `DataClass` at all. Addressing and classification are two questions and ' +
      'the seam answers only the first — a resolver that knows about classes is a resolver ' +
      'that can invent one.',
  )
})

/* ==================================================================== *
 * §7  THE FOUR REFUSAL SITES — still refusing, over token-list paths
 *
 * The retype must not weaken the half of G106 that already worked. Each run
 * withholds exactly one path from `fieldClassification`; each must produce a
 * `field_not_classified` refusal at the site that reads it.
 * ==================================================================== */

test('all four `field_not_classified` sites still refuse after the retype', () => {
  const { fieldPathKey } = seam()

  const sites: readonly { readonly label: string; readonly path: FieldPath }[] = [
    { label: 'amount', path: P.amount() },
    { label: 'date', path: P.date() },
    { label: 'identifier', path: P.reference() },
    { label: 'counterparty', path: P.counterparty() },
  ]

  for (const site of sites) {
    const result = runOrFail(classificationWithout(site.path))
    const refusals = result.refusedAtAdmission.filter(
      (r) => r.refusal.kind === 'field_not_classified',
    )
    assert.ok(
      refusals.length > 0,
      `withholding the ${site.label} classification did not refuse the row. G106 is ` +
        'fail-closed: an absent path refuses rather than defaulting.',
    )
    assert.ok(
      refusals.every((r) => fieldPathKey(r.path) === fieldPathKey(site.path)),
      `the ${site.label} site refused, but named a different path`,
    )
  }

  /* THE CONTROL. The only difference is that nothing is withheld. Without this
   * the four assertions above are satisfied by an engine that refuses
   * everything. */
  const whole = runOrFail(classificationWithout(null))
  assert.equal(
    whole.refusedAtAdmission.filter((r) => r.refusal.kind === 'field_not_classified').length,
    0,
    'the fully classified run still refused a row as unclassified',
  )
})
