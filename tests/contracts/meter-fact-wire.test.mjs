/**
 * W-10 (#202) — WHAT A RUN SPENT, ON THE WIRE, AS FOUR METERS AND NO PRICE.
 *
 * ┌─ THE RULING THIS FILE IS THE CONTROL FOR ─────────────────────────────────┐
 * │ G237, 22 Aug 2026. THE FOUR METERS FOLD ONTO THE RUN ACCOUNT. No new       │
 * │ operation, no new capability, and NO PRICE. `getRunAccount` is already     │
 * │ that run's own account and is already gated `x-capability: admit_source`;  │
 * │ a sixth channel on it mints nothing — no seventy-third operation, no       │
 * │ fortieth capability, no second thing to authorise.                         │
 * │                                                                            │
 * │ THE REJECTED ALTERNATIVE IS PRESERVED, because it is the one the issue     │
 * │ was written expecting: a separate meters read gated `view_metering`. It    │
 * │ was refused because folding onto an already-gated run account achieves the │
 * │ same containment without the extra operation. Do not implement it, and do  │
 * │ not read the absence of a `/runs/{runId}/meters` path as an oversight.     │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 NO PRICE IS INVARIANT 5, NOT A DESIGN CHOICE. *Money is always derived.*
 * `UsageRecord` is immutable and unpriced, which is why `metering` is its own
 * resource class with no write mode and cannot live in `commercial`, whose
 * defining rule is that a partner may read it. Anything that divides, multiplies
 * or totals a meter is a derivation and belongs where derivations live. C below
 * is the behavioural assertion for that, and it is behavioural precisely because
 * a helpfully-added `unitCost` field passes every other assertion in this file.
 *
 * 🛑 THE EXPECTATION IS DERIVED FROM THE MODEL, NEVER FROM THE YAML UNDER TEST.
 * The four meters come from `model/reconciliation.ts` through
 * `tools/check-wire-mirror.mjs`'s OWN extractor — the same code path
 * `npm run check:wire` runs, so the gate and this file cannot disagree about
 * what the model says — and the billing vocabulary comes from `model/billing.ts`
 * at runtime. A test that read either list out of the file it is checking would
 * pass against any value that file happened to hold.
 *
 * ⚠️ THE SUBSET RELATION IS ASSERTED AS A SUBSET AND NEVER AS AN EQUALITY.
 * `EngineMeter` is four of the eight declared `METERS`; the other four have
 * other producers. A control that demanded equality would go red on the day one
 * of those producers shipped — a control keyed on a convenient landmark instead
 * of the property it protects (§5.1).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse } from 'yaml'

import {
  PAIRS,
  checkPairs,
  unionKinds,
  unionLiterals,
  discoverWireFiles,
  DRIFT,
} from '../../tools/check-wire-mirror.mjs'

/* The billing vocabulary read from the model at runtime, so B compares two
 * derived lists rather than one derived list and one typed-in copy. */
import { METERS } from '../../model/billing.ts'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CAPABILITY = path.join(REPO_ROOT, 'docs', 'contracts', 'capability.openapi.yaml')

const engineText = readFileSync(path.join(REPO_ROOT, 'model', 'reconciliation.ts'), 'utf8')
const doc = parse(readFileSync(CAPABILITY, 'utf8'))

const schemas = doc?.components?.schemas ?? {}

/* ==================================================================== *
 * A · THE PAIR, AND THE READER IT IS REGISTERED WITH
 * ==================================================================== */

test('A — the `engine_meter` pair reads `EngineMeter` with the measured reader and reports DRIFT (0) over four members', () => {
  // §5.6 guard on the parse. Every assertion below reads out of `schemas`; a
  // parse that silently produced an empty object would pass most of them.
  assert.ok(
    Object.keys(schemas).length > 50,
    `capability.openapi.yaml parsed to ${Object.keys(schemas).length} schema(s). ` +
      'Every assertion in this file reads that object.',
  )

  const pair = PAIRS.find((p) => p.name === 'engine_meter')
  assert.ok(
    pair !== undefined,
    'NO `engine_meter` PAIR IS REGISTERED. `EngineMeter` reaching the wire unpinned is the ' +
      'shape `population_side` already produced once: minted, `$ref`d, and mirrored by nothing.',
  )
  assert.equal(pair.model.file, 'model/reconciliation.ts')
  assert.equal(pair.model.name, 'EngineMeter')
  assert.equal(pair.wire.schema, 'EngineMeter')

  // 🛑 BEHAVIOURAL. The WRONG READER is the failure this assertion exists for
  // and it is invisible to every other one: `unionKinds()` returns 0 members for
  // a union with no `kind:` discriminator, so a pair registered `union` would
  // compare an empty list against an empty list and report `DRIFT (0)` against
  // nothing — §5.6 inside the tool written to catch §5.6.
  assert.equal(
    pair.model.source,
    'literal_union',
    'THE WRONG READER for `EngineMeter`. It is a bare union of string literals with no ' +
      '`kind:` discriminator.',
  )
  assert.equal(
    unionKinds(engineText, 'EngineMeter').length,
    0,
    '`unionKinds(EngineMeter)` no longer returns 0. The measurement that justifies the ' +
      '`literal_union` reader has moved; re-measure before trusting the pair.',
  )

  // ⚠️ AND THIS IS NOT THE `meters` PAIR. That one is `METERS` against schema
  // `Meter` — the BILLING vocabulary, on other tiers. Reusing it would pin the
  // engine's four against the billing eight and report drift forever.
  const billingPair = PAIRS.find((p) => p.name === 'meters')
  assert.ok(billingPair !== undefined, 'the pre-existing `meters` pair went missing')
  assert.notEqual(pair.wire.schema, billingPair.wire.schema)
  assert.notEqual(pair.model.name, billingPair.model.name)

  const members = unionLiterals(engineText, 'EngineMeter')
  assert.equal(
    members.length,
    4,
    `\`EngineMeter\` declares ${members.length} member(s), not four. The engine's meter ` +
      'vocabulary changed; the contract and this file both need re-deriving.',
  )

  const result = checkPairs({
    pairs: [pair],
    wireFiles: discoverWireFiles(REPO_ROOT),
    root: REPO_ROOT,
  })
  assert.equal(
    result.pairsCompared,
    1,
    'the pair compared NOTHING. `EngineMeter` is not a schema under `components.schemas` on ' +
      'any tracked contract, so the pair is `unmirrored` — reported, exit 0, and asserting ' +
      'precisely nothing.',
  )
  assert.deepEqual(
    result.findings.filter((f) => f.kind === DRIFT),
    [],
    'the wire enum disagrees with `EngineMeter`. The model is the authority.',
  )
  assert.deepEqual(
    schemas.EngineMeter?.enum,
    members,
    'the wire enum must mirror the model in DECLARATION ORDER — this checker compares ' +
      'sequences because "a reordering is the shape that hides the next insertion".',
  )
})

/* ==================================================================== *
 * B · THE SUBSET RELATION — never an equality
 * ==================================================================== */

test('B — the four engine meters are a STRICT SUBSET of the declared billing meters, both derived from the model', () => {
  const engine = unionLiterals(engineText, 'EngineMeter')
  const declared = Object.values(METERS)

  assert.ok(
    declared.length > 4,
    `\`METERS\` declares ${declared.length} value(s). This assertion compares two DERIVED ` +
      'lists; a collapsed vocabulary would make the subset trivial.',
  )

  const missing = engine.filter((m) => !declared.includes(m))
  assert.deepEqual(
    missing,
    [],
    'AN ENGINE METER IS NOT A DECLARED METER. `_EngineMetersAreDeclaredMeters` asserts this ' +
      `at compile time in the model; the wire must not restate a fifth vocabulary. Stray: [${missing.join(', ')}]`,
  )

  // 🛑 SUBSET, NEVER EQUALITY. The other declared meters have other producers,
  // and a control that demanded equality would go red the day one of them
  // shipped rather than the day a real drift arrived.
  assert.ok(
    engine.length < declared.length,
    'THE TWO VOCABULARIES ARE NOW THE SAME SIZE. Either the engine grew a producer for every ' +
      'declared meter — in which case say so deliberately — or somebody widened `EngineMeter` ' +
      'to `METERS`, which is the drift the `engine_meter` fixture is deliberately shaped like.',
  )
  const unproduced = declared.filter((m) => !engine.includes(m))
  assert.ok(
    unproduced.length > 0,
    'no declared meter is left without an engine producer; see above.',
  )

  // 🛑 AND THE SAME RELATION HELD OVER WHAT SHIPS, WHICH IS THE HALF THAT
  // MATTERS TO A CONSUMER. The three lines above are a property of `model/`
  // alone, and `_EngineMetersAreDeclaredMeters` already proves that one at
  // compile time. This is the property this slice adds: the WIRE never
  // publishes a meter the billing vocabulary does not declare. It is asserted
  // against `METERS` rather than against the wire's own `Meter` schema on
  // purpose — that schema lives on other tiers, and comparing one wire copy to
  // another is comparing two copies rather than either to the authority.
  const wire = schemas.EngineMeter?.enum
  assert.ok(
    Array.isArray(wire),
    '`EngineMeter` is not an enum-bearing schema on the capability tier, so the subset ' +
      'relation this test names holds over nothing that ships.',
  )
  const undeclared = wire.filter((m) => !declared.includes(m))
  assert.deepEqual(
    undeclared,
    [],
    'THE WIRE PUBLISHES A METER `METERS` DOES NOT DECLARE. A meter nobody declared is volume ' +
      `with no vocabulary behind it. Stray: [${undeclared.join(', ')}]`,
  )
  assert.ok(
    wire.length < declared.length,
    'the shipped vocabulary is no longer a STRICT subset of the declared one.',
  )
})

/* ==================================================================== *
 * C · NO PRICE — the behavioural one
 * ==================================================================== */

test('C — no price, rate, cost, amount or currency reaches the minted meter surface', () => {
  // The subject is every piece of YAML this slice mints, not a hand-listed
  // field set: a `unitCost` added beside `quantity`, a `currency` on the channel
  // description, or a rate card `$ref` are all the same defect and a field-name
  // allow-list would catch only the first.
  const produced = (schemas.RunEngineAccount?.oneOf ?? []).find(
    (arm) => arm?.properties?.outcome?.enum?.[0] === 'produced',
  )
  assert.ok(produced !== undefined, 'the `produced` arm of `RunEngineAccount` is not on the wire')

  const minted = {
    EngineMeter: schemas.EngineMeter,
    MeterFact: schemas.MeterFact,
    meterFactsChannel: produced.properties?.meterFacts,
  }
  for (const [name, subject] of Object.entries(minted)) {
    assert.ok(subject !== undefined, `\`${name}\` is not on the wire; C would scan nothing.`)
  }

  const forbidden = /price|rate|cost|amount|currency/gi
  const text = JSON.stringify(minted)

  // §5.6 guard on the scan itself: prove the haystack is real before trusting
  // that the needle is absent from it.
  assert.ok(
    /input_tokens/.test(text) && /idempotencyKey/.test(text),
    'the scanned text does not contain the meter surface it claims to scan.',
  )

  const hits = [...text.matchAll(forbidden)].map((m) => m[0])
  assert.deepEqual(
    hits,
    [],
    'A PRICE REACHED THE WIRE. Invariant 5: money is always derived. `UsageRecord` is ' +
      'immutable and unpriced, which is why `metering` is its own resource class with no ' +
      'write mode and cannot live in `commercial`, where a partner may read it. Four meters ' +
      `and no price — anything that divides, multiplies or totals them is a derivation and ` +
      `belongs where derivations live. Found: [${[...new Set(hits)].join(', ')}]`,
  )

  // The same refusal stated structurally, because a rating layer could arrive
  // by `$ref` under a name none of those five words appear in.
  const priced = ['MeterPrice', 'PriceTier', 'RateCard', 'RatedTotal', 'UsageRecord']
  for (const name of priced) {
    assert.ok(
      !text.includes(name),
      `\`${name}\` is reachable from the meter surface. The model's own header controls ` +
        'record that none of these is imported by the engine; the wire must not import one ' +
        'either.',
    )
  }
})

/* ==================================================================== *
 * D · THE FACT, AND WHERE IT ATTACHES
 * ==================================================================== */

test('D — `MeterFact` mirrors the model, `idempotencyKey` is never bare, and G30 is NAMED as open', () => {
  const fact = schemas.MeterFact
  assert.ok(fact !== undefined, '`MeterFact` is not on the wire')
  assert.equal(
    fact.additionalProperties,
    false,
    'an open object lets a server add the price this slice exists to refuse.',
  )
  assert.deepEqual(
    [...(fact.required ?? [])].sort(),
    ['idempotencyKey', 'meter', 'modelEntryId', 'quantity'],
    'ALL FOUR FIELDS ARE UNCONDITIONAL. The model declares `MeterFact` with four readonly ' +
      'members and no optional one; `modelEntryId` is NULLABLE and not OPTIONAL, because ' +
      '"null for non-inference meters" is a value and an absent key is a different claim.',
  )
  assert.deepEqual(
    [...Object.keys(fact.properties ?? {})].sort(),
    ['idempotencyKey', 'meter', 'modelEntryId', 'quantity'],
    'the wire declares a field the model does not.',
  )

  assert.equal(
    fact.properties.meter?.$ref,
    '#/components/schemas/EngineMeter',
    'THE VOCABULARY IS INLINED RATHER THAN `$ref`d. One vocabulary, one declaration (§5.3) — ' +
      'and an inline copy is a copy no pair can reach.',
  )
  assert.equal(fact.properties.quantity?.type, 'integer', '`quantity` is an integer count')

  // 🛑 THE DEDUP KEY IS WHAT MAKES THE FACT REPLAYABLE, so the wire states its
  // shape rather than leaving a bare string a server may mint any way it likes.
  const key = String(fact.properties.idempotencyKey?.description ?? '')
  assert.equal(fact.properties.idempotencyKey?.type, 'string')
  assert.match(
    key,
    /\$\{runId\}#\$\{meter\}/,
    'the `runId` form of the dedup key is not stated. `runMeterFact()` mints exactly this.',
  )
  assert.match(
    key,
    /\$\{providerRequestId\}#\$\{meter\}/,
    'the `providerRequestId` form of the dedup key is not stated. `tokenMeterFacts()` mints ' +
      'exactly this.',
  )
  assert.match(
    key,
    /never bare/i,
    'the model says "Never bare." verbatim; a bare key is one a replay cannot deduplicate.',
  )

  // 🛑 G30 IS OPEN AND THIS SLICE DOES NOT SETTLE IT. The wire NAMES the
  // uniqueness grain as undecided rather than implying one by silence —
  // `db/migrations/0001_tenancy_and_rls.sql` omits the outbox columns for
  // exactly this reason, and folding a grain in here would settle a live
  // question under schedule pressure.
  assert.match(
    key,
    /G30/,
    'G30 IS NOT NAMED. Whether the outbox uniqueness grain is `(idempotencyKey)` or ' +
      '`(idempotencyKey, meter)` is OPEN, and a wire that states the key without stating ' +
      'that the grain is undecided reads as though it were decided.',
  )
  assert.match(
    key,
    /\(idempotencyKey, meter\)/,
    'the open question must name BOTH candidate grains; naming one is stating an answer.',
  )

  // WHERE IT ATTACHES — G237. A sixth channel on the produced arm, unconditional
  // like the other five, and ABSENT from the refused arm because a refused run
  // produced nothing.
  const byOutcome = new Map(
    (schemas.RunEngineAccount?.oneOf ?? []).map((arm) => [arm?.properties?.outcome?.enum?.[0], arm]),
  )
  const produced = byOutcome.get('produced')
  const refused = byOutcome.get('refused')
  assert.ok(produced !== undefined && refused !== undefined, 'the account envelope is not two-armed')

  assert.ok(
    (produced.required ?? []).includes('meterFacts'),
    'THE SIXTH CHANNEL IS OPTIONAL. The other five are unconditional on a produced run so ' +
      'that a permissive ceiling suppresses the refusal and never the evidence; an optional ' +
      'meter channel lets a server omit what a run spent under exactly that condition.',
  )
  assert.equal(
    produced.properties?.meterFacts?.items?.$ref,
    '#/components/schemas/MeterFact',
    'the item schema is inlined rather than `$ref`d (§5.3).',
  )
  assert.equal(produced.properties?.meterFacts?.type, 'array')

  // 🛑 BEHAVIOURAL, and it mirrors the model rather than tidying it. A refused
  // run produced nothing and the refusal IS the output; declaring a meter
  // channel on that arm "just in case" makes an invalid state legal (§5.5).
  assert.ok(
    !Object.keys(refused.properties ?? {}).includes('meterFacts'),
    'THE REFUSED ARM CARRIES METERS. `SetReconciliationOutcome`\'s `ok: false` arm carries no ' +
      'ledger at all.',
  )

  // No seventy-third operation — G237's whole point.
  const meterPaths = Object.keys(doc?.paths ?? {}).filter((p) => /meter/i.test(p))
  assert.deepEqual(
    meterPaths,
    [],
    'A METERS OPERATION WAS MINTED. G237 folds the four onto `getRunAccount` — already that ' +
      'run\'s own account, already gated `x-capability: admit_source` — precisely so that no ' +
      `path, operation or capability is minted. Found: [${meterPaths.join(', ')}]`,
  )
})

/* ==================================================================== *
 * E · INVARIANT 7 — the catalogue id, and where the residency check lives
 * ==================================================================== */

test('E — `modelEntryId` is the catalogue id, null for non-inference meters, and names `resolveModel()`', () => {
  const entry = schemas.MeterFact?.properties?.modelEntryId
  assert.ok(entry !== undefined, '`MeterFact.modelEntryId` is not on the wire')

  assert.deepEqual(
    entry.type,
    ['string', 'null'],
    'NULLABLE, NOT OPTIONAL. The model types it `ModelCatalogEntryId | null` — "null for ' +
      'non-inference meters" — and `reconciliations_run` and `exceptions_raised` incur no ' +
      'model call at all.',
  )

  const described = String(entry.description ?? '')

  // ⚠️ INVARIANT 7 IS THE POINT OF THIS ASSERTION. `resolveModel()` is the ONLY
  // executable residency check in the codebase, and this operation does not
  // perform one. The wire must say where the check lives rather than letting a
  // reader infer that carrying a catalogue id implies one was made.
  assert.match(
    described,
    /resolveModel\(\)/,
    'THE WIRE DOES NOT NAME WHERE THE RESIDENCY CHECK LIVES. Invariant 7: residency survives ' +
      'inference. `resolveModel()` is the only executable enforcement it has, and this read ' +
      'is not it.',
  )

  // Rule R1 keeps a string bare only when AWS mints it. The catalogue mints
  // this one, so it is branded in the model and stays the catalogue's id here.
  assert.match(
    described,
    /catalogue/i,
    'the field must say which id this is. Rule R1 keeps a string bare only when AWS mints ' +
      'it; `ModelCatalogEntryId` is minted by the catalogue, not by a foreign namespace.',
  )
  assert.match(
    described,
    /null/i,
    'the null case must be stated: non-inference meters incur no model call.',
  )
})
