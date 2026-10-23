/**
 * THE ENGINE'S READ SURFACE, ON THE WIRE — the six reads W-2…W-7b specify,
 * asserted against `model/reconciliation.ts` rather than against the YAML they
 * check.
 *
 * ┌─ THE GAP THIS FILE MEASURES ───────────────────────────────────────────────┐
 * │ `grep -rniE 'admission_refusal|residue|control_total|postcondition'         │
 * │   docs/contracts/` → 3 lines, 16 Aug 2026, and NOT ONE IS A SCHEMA:         │
 * │   two are `capability.openapi.yaml`'s own comment saying of itself that     │
 * │   the engine's channels reach no tier, and the third is a control-plane     │
 * │   telemetry rollup enum on the plane that under invariant 3 never reads     │
 * │   tenant data. Restricted to the tenant-facing tiers and excluding          │
 * │   comments the count is 0.                                                  │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE EXPECTATION IS DERIVED FROM THE MODEL, NEVER FROM THE YAML UNDER TEST,
 * and it is derived with `tools/check-wire-mirror.mjs`'s OWN extractors — the
 * same code path `npm run check:wire` runs, so the two cannot disagree about
 * what the model says. A test that read the enum out of the file it is checking
 * would pass against any value that file happened to hold, which is how the G75
 * drift survived a wire mirror, a citation checker and a count checker
 * (`tests/contracts/g75-wire.test.ts`).
 *
 * ┌─ 🛑 THE COPY NO PAIR CAN REACH, AND WHY THIS FILE HAS TO GUARD IT ─────────┐
 * │ `tools/check-wire-mirror.mjs` addresses a wire vocabulary BY SCHEMA NAME    │
 * │ and reads ONE list at ONE path. A discriminated `oneOf` states its          │
 * │ vocabulary TWICE — once in the pinned `<X>Kind` enum, and once more as the  │
 * │ single-member `enum` on each arm's `kind` — and no pair can reach the       │
 * │ second. That is the same class as the `run_status` strings restated inline  │
 * │ at the `/runs` `status` query parameter, which the checker names in its own │
 * │ header and which `tests/contracts/run-status-wire.test.mjs` is the only     │
 * │ thing that guards.                                                         │
 * │                                                                            │
 * │ THE COPY IS DELIBERATE AND IT IS STATED RATHER THAN HIDDEN. W-2's           │
 * │ acceptance asks for `grep -c duplicate_item_address` → 1, which a           │
 * │ discriminated `oneOf` cannot satisfy: an arm that does not constrain its    │
 * │ own `kind` is an arm a caller cannot discriminate on, and dropping the      │
 * │ `oneOf` for one flat object with every arm's fields optional makes eight    │
 * │ invalid states legal (§5.5). So the copy exists, and assertion group C is   │
 * │ what makes it checked instead of promised: the arm set must EQUAL the       │
 * │ pinned enum, member for member, in order.                                  │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ THIS FILE PARSES YAML WITH `yaml@2.9.0` RATHER THAN SCANNING LINES.
 * `server/contract/document.ts` already took that dependency under G109 — "do
 * not hand-roll one" — and every structural assertion here (required vs
 * nullable, `additionalProperties`, a recursive `$ref` scan for a tenant-bearing
 * parameter) is exactly the class a line scanner gets subtly wrong. The
 * MEMBER-LIST assertions still go through the checker's extractors, because the
 * point of those is to agree with the tool that gates the build.
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

/* G1 reads the roster and the mask from the model rather than from a literal —
 * the annotation it checks is only a gate if the name is a real member. */
import { CAPABILITIES, PARTNER_CAPABILITY_MASK } from '../../model/access.ts'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CONTRACTS = path.join(REPO_ROOT, 'docs', 'contracts')
const CAPABILITY = path.join(CONTRACTS, 'capability.openapi.yaml')

const engineText = readFileSync(path.join(REPO_ROOT, 'model', 'reconciliation.ts'), 'utf8')
/* ⚠️ A SECOND MODEL FILE SINCE 19 Sep 2026 — G286/G111. `MoneyRefusal` was
 * declared in `model/reconciliation.ts` until the money section collapsed into
 * the codec module G111 has called for since 8 Aug 2026. Every other union this
 * file reads is still in the engine, so the source is a LOOKUP with a default
 * rather than a second parameter threaded through five loops — and the lookup
 * is keyed on the UNION NAME, which every loop already has in hand.
 *
 * 🛑 THIS FILE WENT RED ON THE MOVE IN TWO PLACES AND BOTH REDS WERE CORRECT.
 * `unionKinds(engineText, 'MoneyRefusal')` threw *"no `export type MoneyRefusal
 * =` found"*, and A1's `pair.model.file` assertion — which pins every pinned
 * pair to `model/reconciliation.ts` — disagreed with the registry. A file-scoped
 * assertion failing when a declaration changes file is the assertion working. */
const moneyText = readFileSync(path.join(REPO_ROOT, 'model', 'money.ts'), 'utf8')

/** Union name -> the model file that declares it. Absent means the engine. */
const MODEL_FILE_OF = new Map([['MoneyRefusal', 'model/money.ts']])

function modelFileOf(modelName) {
  return MODEL_FILE_OF.get(modelName) ?? 'model/reconciliation.ts'
}

function modelTextOf(modelName) {
  return modelFileOf(modelName) === 'model/money.ts' ? moneyText : engineText
}
const capabilityText = readFileSync(CAPABILITY, 'utf8')
const doc = parse(capabilityText)

const schemas = doc?.components?.schemas ?? {}
const paths = doc?.paths ?? {}

/**
 * §5.6 guard on the parse itself. Every assertion below reads out of `schemas`
 * and `paths`; a parse that silently produced empty objects would make the whole
 * file pass against nothing.
 */
test('the capability document parses and carries the surfaces this file reads', () => {
  assert.ok(
    Object.keys(schemas).length > 50,
    `capability.openapi.yaml parsed to ${Object.keys(schemas).length} schema(s). ` +
      'Every assertion in this file reads that object; a bad parse would pass them all.',
  )
  assert.ok(
    Object.keys(paths).length > 30,
    `capability.openapi.yaml parsed to ${Object.keys(paths).length} path(s).`,
  )
})

/* ==================================================================== *
 * A · THE PINNED VOCABULARIES — one pair each, checked by the tool that
 *     gates the build, and derived from the model at runtime.
 * ==================================================================== */

/**
 * The engine unions this slice puts on the wire, with the wire schema that
 * pins each one and the extractor the pair must be registered with.
 *
 * ⚠️ EVERY ONE OF THESE READERS WAS MEASURED AGAINST THE DECLARATION BEFORE IT
 * WAS REGISTERED, and one union in this module is DELIBERATELY ABSENT for
 * exactly that reason — see group D. A pair registered with a reader that
 * returns the wrong member list reports `DRIFT (0)` against nothing, which is
 * §5.6 inside the tool written to catch §5.6.
 */
const PINNED = [
  // [pair, model union, pinned wire enum, member count, wire envelope]
  ['population_defect_kinds', 'PopulationDefect', 'PopulationDefectKind', 8, 'PopulationDefect'],
  // ⚠️ THE ONE PLACE THE WIRE NAME DIFFERS FROM THE MODEL'S, AND THE REASON IS A
  // COLLISION RATHER THAN A PREFERENCE. `AdmissionRefusal` was already taken in
  // capability.openapi.yaml by C9's MESSAGE admission — `injection_suspected`,
  // `sender_unverified` — an unrelated vocabulary about correspondence. The
  // engine's row admission is therefore `PopulationAdmissionRefusal`. Two
  // unrelated things called "admission" in one contract is a hazard, and
  // renaming the older one is a breaking change that is not this slice's.
  // ⚠️ SEVEN UNTIL OQ-1 WAS FIXED, EIGHT SINCE — `amount_not_exact_money`.
  // `admitOne` checked the amount's scalar KIND and its declared UNIT and never
  // called `guardMoney`, so a row whose minor units were `1.5`, `NaN`, `Infinity`
  // or past the exact integer range was ADMITTED and then left the ledger
  // entirely. The eighth arm carries the `MoneyRefusal` `guardMinor` already
  // named, so `MoneyRefusalKind` below is unmoved: the new member is a new PLACE
  // to report an old reason, not a new reason.
  [
    'admission_refusal_kinds',
    'AdmissionRefusal',
    'PopulationAdmissionRefusalKind',
    8,
    'PopulationAdmissionRefusal',
  ],
  ['extraction_refusal_kinds', 'ExtractionRefusal', 'ExtractionRefusalKind', 4, 'ExtractionRefusal'],
  ['money_refusal_kinds', 'MoneyRefusal', 'MoneyRefusalKind', 7, null],
  ['normalisation_defect_kinds', 'NormalisationDefect', 'NormalisationDefectKind', 5, 'NormalisationDefect'],
  ['reader_refusal_kinds', 'ReaderRefusal', 'ReaderRefusalKind', 8, null],
  ['postcondition_failure_kinds', 'PostconditionFailure', 'PostconditionFailureKind', 7, 'PostconditionFailure'],
  ['completeness_finding_kinds', 'CompletenessFinding', 'CompletenessFindingKind', 2, 'CompletenessFinding'],
  // ⚠️ ELEVEN UNTIL G227, TWELVE UNTIL G291, THIRTEEN SINCE — the thirteenth is
  // `amount_tolerance_declined`, a bucket the identifier join FOUND and whose
  // totals missed the declared tolerance. It is a new REASON and not a new place
  // to report an old one, which is what separates it from the eighth
  // `AdmissionRefusal` arm noted above: `no_strategy_paired` was being made to
  // carry the opposite claim — *nothing matched it* over a bucket that matched
  // exactly — and the two have different fixes. The count is stated here as well
  // as in the tool so that a cause added to the model and NOT to the wire fails
  // in the suite as well as in the checker.
  ['residue_cause_kinds', 'ResidueCause', 'ResidueCauseKind', 13, 'ResidueCause'],
  ['item_settlement_kinds', 'ItemSettlement', 'ItemSettlementKind', 3, 'ItemSettlement'],
  // ⚠️ ADDED IN THE COMMIT THAT CLOSED W-1 (#186), AND IT IS THE POINT OF THAT
  // COMMIT RATHER THAN A CONSEQUENCE. `RunRefusalKind` was the ONE engine
  // vocabulary on this contract that no pair reached, excused in
  // UNPINNED_WITH_REASON because `unionKinds()` read 17 members for a 15-arm
  // union. Registering the pair without listing it here would have left it
  // out of A2's drift comparison and out of C's envelope check — pinned in the
  // tool and unasserted in the suite, which is §5.6 in the file that names §5.6.
  ['run_refusal_kinds', 'SetReconciliationRefusal', 'RunRefusalKind', 15, 'RunRefusal'],
]

/**
 * The enums on this contract that NO pair reaches, each with the reason it is
 * not reached. This list is the only hand-written half of A1 and it is the half
 * that has to be hand-written: an exclusion needs an argument, and an argument
 * cannot be derived.
 *
 * 🛑 THE ELEVEN PRE-EXISTING ENTRIES ARE A GAP THIS SLICE DID NOT CREATE AND
 * DOES NOT CLOSE, and they are listed rather than scoped away so that the gap is
 * SPEAKABLE. A1's first revision asserted only over a hand-written list of the
 * vocabularies this slice happened to remember, so a pre-existing unpinned enum
 * was not merely unfixed — it was invisible, and so was `PopulationSide`, which
 * this slice minted, `$ref`d from fourteen positions, and failed to register.
 */
const UNPINNED_WITH_REASON = new Map([
  // ⚠️ `RunRefusalKind` WAS EXCUSED HERE AND THE EXCUSE IS DELETED IN THE COMMIT
  //    THAT PINNED IT, which is what the loop below demands: "`${name}` is BOTH
  //    pinned and excused. Delete the excuse in the commit that pinned it." The
  //    text that stood here read — "W-1 (#186) is OPEN: `unionKinds()` reads
  //    `SetReconciliationRefusal` as 17 members for a 15-arm union, so a pair
  //    would report DRIFT against a correct wire. Measured in D1." #186 landed;
  //    the reader now returns 15; `run_refusal_kinds` is registered.
  // The eleven that predate this slice. Pinning them is real work on another
  // track — each needs its model declaration located and its reader measured,
  // which is the sequence D1 exists to demonstrate — and doing it here would
  // fold an unrelated sweep into a feature commit.
  ...['DomainKey', 'Severity', 'AutonomyCeiling', 'DataClass', 'ExceptionStatus',
    'ReconciliationArchetype', 'DocumentStatus', 'ReversalReason', 'CorrespondenceChannel',
    'ThreadStatus', 'AdmissionRefusal'].map((name) => [
    name,
    'PRE-EXISTING AND UNPINNED. It predates this slice and no pair has ever reached it; ' +
      'listing it here is what makes that gap speakable rather than invisible.',
  ]),
  // 🛑 `ErrorCode` IS NOT A GAP OF THE ELEVEN'S KIND AND MUST NOT BE READ AS
  //    ONE — IT IS PINNED, ON A DIFFERENT AXIS, BY A DIFFERENT CONTROL.
  //
  //    It arrived on this contract on 21 Sep 2026 under G1681, the owner's
  //    ruling: *"Stop `$ref`-ing `errors.yaml` from success bodies. A success
  //    body carries its own closed enum rather than pointing at the error
  //    taxonomy."* Seven MOUNTED operations reached NO response serialiser
  //    because their success bodies `$ref`d `./errors.yaml` and
  //    `server/contract/bundle.ts` refuses an external pointer — so this enum
  //    is a LOCAL MIRROR that a repair installed, not a vocabulary somebody
  //    forgot to pin.
  //
  //    🛑 IT CANNOT BE A PAIR IN THIS REGISTRY, AND THAT IS STRUCTURAL RATHER
  //    THAN UNFINISHED. Every pair here — and every pair in
  //    `tools/check-wire-mirror.mjs` — is MODEL -> WIRE, and that tool's stated
  //    axis is *"the model is the authority, the wire mirrors it"*.
  //    **`ErrorCode` HAS NO DECLARATION IN `model/` AT ALL**;
  //    `server/http/problem.ts` reads its closed set out of `errors.yaml` at
  //    import time, so the authority is a CONTRACT DOCUMENT. The eleven above
  //    each need *"its model declaration located and its reader measured"* —
  //    for this one there is nothing to locate, and inventing a `model/` home
  //    to satisfy a registry would be the landmark driving the property.
  //
  //    ✅ WHAT PINS IT INSTEAD, and it is stronger than a pair on the axis that
  //    matters here: `tests/contracts/success-body-error-codes.test.ts` §1
  //    asserts SET EQUALITY against `errors.yaml` IN BOTH DIRECTIONS **and in
  //    ORDER** — the same order comparison this registry makes, for the same
  //    stated reason — across all three documents carrying a copy, with §1c
  //    deriving that set from the tree so a fourth copy cannot appear
  //    unmirrored. Its three reds are witnessed on every run.
  ['ErrorCode',
    'PINNED ELSEWHERE, NOT UNPINNED — G1681, 21 Sep 2026. Its authority is ' +
      '`docs/contracts/errors.yaml` and not `model/`, so a MODEL -> WIRE pair cannot ' +
      'reach it by this registry`s own axis. `tests/contracts/success-body-error-codes' +
      '.test.ts` §1 holds every local copy identical to that authority in both ' +
      'directions and in order. Read the comment above before moving this row.'],
])

test('A1 — EVERY enum on this contract is a registered pair or a NAMED exclusion', () => {
  // 🛑 THE SUBJECT IS DERIVED FROM THE CONTRACT, NOT LISTED HERE, AND THE
  // DIFFERENCE IS THE WHOLE ASSERTION. This test's first revision was titled
  // "every engine vocabulary this slice publishes is a REGISTERED pair" and
  // iterated `PINNED`, a hand-written array in this file — so a vocabulary
  // absent from the array was absent from the check, and the title was strictly
  // stronger than the mechanism. `PopulationSide` was exactly that: minted here,
  // `$ref`d from fourteen positions, registered nowhere, and invisible to the
  // assertion written to catch it. That is §5.1 — a rule keyed on a convenient
  // landmark (a list somebody maintains) instead of the property it protects
  // (every enum this document publishes) — reproduced inside the control. The
  // subject is now `components.schemas`, so a twenty-sixth enum fails this test
  // the day it lands unless it is pinned or argued for above.
  const published = Object.keys(schemas)
    .filter((name) => Array.isArray(schemas[name].enum))
    .sort()
  assert.ok(
    published.length >= 25,
    `only ${published.length} enum-bearing schema(s) found; the parse or the filter is wrong ` +
      'and this assertion would pass against almost nothing.',
  )

  const pinnedSchemas = new Set(PAIRS.map((p) => p.wire.schema))
  const unaccounted = published.filter(
    (name) => !pinnedSchemas.has(name) && !UNPINNED_WITH_REASON.has(name),
  )
  assert.deepEqual(
    unaccounted,
    [],
    'AN ENUM REACHES THE WIRE UNPINNED AND UNARGUED. `tools/check-wire-mirror.mjs` compares ' +
      'only the pairs registered in PAIRS, and this repository\'s own sequencing rule is that ' +
      '"a vocabulary registered after the enum it governs has shipped is registered after the ' +
      'drift it exists to catch." Register a pair — measuring the reader against the ' +
      'declaration FIRST, the way group D does — or add it to UNPINNED_WITH_REASON with the ' +
      `argument. Unaccounted: [${unaccounted.join(', ')}]`,
  )

  // The exclusion list may not rot into a place to hide a pinned enum, and it
  // may not name a schema that does not exist.
  for (const name of UNPINNED_WITH_REASON.keys()) {
    assert.ok(
      schemas[name] !== undefined,
      `\`${name}\` is excused in UNPINNED_WITH_REASON and is not a schema on this contract.`,
    )
    assert.equal(
      pinnedSchemas.has(name),
      false,
      `\`${name}\` is BOTH pinned and excused. Delete the excuse in the commit that pinned it.`,
    )
  }

  // `PopulationSide` specifically: the defect that produced this rewrite, held
  // as its own assertion so a regression names itself.
  assert.ok(
    pinnedSchemas.has('PopulationSide'),
    '`PopulationSide` is published as an enum and `$ref`d from fourteen positions in this ' +
      'block. It reached the wire unregistered once already.',
  )

  const registered = new Map(PAIRS.map((p) => [p.name, p]))
  const missing = PINNED.filter(([name]) => !registered.has(name)).map(([name]) => name)
  assert.deepEqual(missing, [], `a pair named in PINNED is not registered: [${missing.join(', ')}]`)

  // The reader each pair is registered with is part of the assertion: a
  // `literal_union` pair over a discriminated union reads 0 members and compares
  // an empty list against an empty list.
  for (const [name, modelName] of PINNED) {
    const pair = registered.get(name)
    assert.equal(pair.model.source, 'union', `${name} must read \`${modelName}\` with the \`union\` extractor`)
    assert.equal(pair.model.name, modelName)
    assert.equal(pair.model.file, modelFileOf(modelName))
  }

  // The two BARE literal unions take the other reader, and the reason is
  // MEASURED here rather than asserted: `unionKinds()` returns 0 members for a
  // union with no `kind:` discriminator, so a `union` pair over either would
  // report `DRIFT (0)` against an empty model list — §5.6 inside the tool
  // written to catch §5.6.
  for (const [pairName, modelName] of [
    ['engine_disposition', 'EngineAssignableDisposition'],
    ['population_side', 'PopulationSide'],
  ]) {
    const pair = registered.get(pairName)
    assert.ok(
      pair !== undefined,
      `\`${modelName}\` is a BARE string-literal union with no discriminator; it needs the ` +
        '`literal_union` reader and its own pair.',
    )
    assert.equal(
      pair.model.source,
      'literal_union',
      `THE WRONG READER for \`${modelName}\`. It has no \`kind:\` discriminator.`,
    )
    assert.equal(
      unionKinds(modelTextOf(modelName), modelName).length,
      0,
      `\`unionKinds(${modelName})\` no longer returns 0. The measurement that justifies the ` +
        '`literal_union` reader has moved; re-measure before trusting either pair.',
    )
    assert.ok(
      unionLiterals(modelTextOf(modelName), modelName).length > 0,
      `\`unionLiterals(${modelName})\` returns nothing — the pair compares an empty list ` +
        'against an empty list and asserts precisely nothing.',
    )
  }
})

test('A2 — the pinned enums mirror the model, in model order, with zero drift', () => {
  const names = new Set([...PINNED.map(([n]) => n), 'engine_disposition', 'population_side'])
  const pairs = PAIRS.filter((p) => names.has(p.name))
  assert.equal(pairs.length, names.size, 'a registered pair went missing between A1 and A2')

  const result = checkPairs({ pairs, wireFiles: discoverWireFiles(REPO_ROOT), root: REPO_ROOT })
  const drift = result.findings.filter((f) => f.kind === DRIFT)
  assert.deepEqual(
    drift.map((f) => f.message),
    [],
    'THE WIRE HAS DRIFTED FROM THE MODEL. The model is the authority and the wire ' +
      'mirrors it, in order — "a discriminated union\'s arms and a discriminator mapping ' +
      'are read by people side by side, and a reordering is the shape that hides the next ' +
      'insertion."',
  )
  assert.ok(
    result.pairsCompared >= names.size,
    `only ${result.pairsCompared} comparison(s) ran for ${names.size} pair(s) — a pair whose ` +
      'wire schema is UNMIRRORED is reported and does not fail the checker, so it would be ' +
      'silently uncompared here too.',
  )
})

test('A3 — each pinned enum has the member count the model declares', () => {
  for (const [, modelName, wireName, count] of PINNED) {
    const model = unionKinds(modelTextOf(modelName), modelName)
    assert.equal(
      model.length,
      count,
      `\`${modelName}\` declares ${model.length} arm(s); this file expected ${count}. ` +
        'Either the model gained an arm and this list was not swept, or the extractor is ' +
        'reading something that is not an arm — see group D.',
    )
    const wire = schemas[wireName]
    assert.ok(wire !== undefined, `\`${wireName}\` is not a schema in capability.openapi.yaml`)
    assert.deepEqual(
      wire.enum,
      model,
      `\`${wireName}\` does not mirror \`${modelName}\` element-for-element, in order.`,
    )
  }
})

/* ==================================================================== *
 * B · THE ENVELOPES — one vocabulary, one declaration.
 * ==================================================================== */

/** Every arm of a discriminated `oneOf`, keyed by its single-member `kind` enum. */
function armsOf(schemaName) {
  const schema = schemas[schemaName]
  assert.ok(schema !== undefined, `\`${schemaName}\` is not a schema in capability.openapi.yaml`)
  assert.ok(
    Array.isArray(schema.oneOf),
    `\`${schemaName}\` is not a \`oneOf\`. A flat object carrying every arm's fields as ` +
      'optional properties makes every invalid combination legal — §5.5, do not make the ' +
      'invalid state representable.',
  )
  assert.equal(
    schema.discriminator?.propertyName,
    'kind',
    `\`${schemaName}\` must discriminate on \`kind\`, as the model does.`,
  )
  const out = new Map()
  for (const arm of schema.oneOf) {
    const values = arm?.properties?.kind?.enum
    assert.ok(
      Array.isArray(values) && values.length === 1,
      `an arm of \`${schemaName}\` does not constrain its own \`kind\` to exactly one value. ` +
        'An arm a caller cannot discriminate on is an arm the discriminator does not resolve.',
    )
    assert.equal(
      arm.additionalProperties,
      false,
      `an arm of \`${schemaName}\` is not \`additionalProperties: false\`.`,
    )
    out.set(values[0], arm)
  }
  return out
}

test('C1 — THE COPY NO PAIR CAN REACH: every envelope\'s arm set equals its pinned enum', () => {
  for (const [, modelName, wireName, , envelope] of PINNED) {
    // `MoneyRefusal` and `ReaderRefusalKind` have no discriminated envelope on
    // the wire: every arm is field-free, so the enum IS the whole vocabulary and
    // there is no second copy to guard. Stated rather than skipped silently.
    if (envelope === null) continue
    const model = unionKinds(modelTextOf(modelName), modelName)
    const arms = [...armsOf(envelope).keys()]
    assert.deepEqual(
      arms,
      model,
      `\`${modelName}\`'s ARMS on the wire disagree with the model. This is the second copy ` +
        `of the vocabulary — \`${wireName}\` is the first and the only one a wire-mirror pair ` +
        'can reach. `tools/check-wire-mirror.mjs` reads ONE list at ONE path and says so in ' +
        'its own header; nothing but this assertion compares the arms.',
    )
  }
})

test('C2 — one vocabulary, one declaration: an envelope RE-WRAPS PopulationDefect, never restates it', () => {
  // `population_integrity_reported` on `postconditions` and
  // `source_self_report_unmet` on `completeness` are two envelopes over ONE
  // vocabulary — "both were built deliberately as envelopes rather than as
  // copies, so the vocabulary has exactly one declaration."
  for (const [envelope, arm] of [
    ['PostconditionFailure', 'population_integrity_reported'],
    ['CompletenessFinding', 'source_self_report_unmet'],
  ]) {
    const found = armsOf(envelope).get(arm)
    assert.ok(found !== undefined, `\`${envelope}\` has no \`${arm}\` arm`)
    assert.equal(
      found.properties?.defect?.$ref,
      '#/components/schemas/PopulationDefect',
      `\`${envelope}.${arm}\` must carry the \`PopulationDefect\` VERBATIM via \`$ref\` and ` +
        'restate none of its fields. "Declaring `declaredCount`/`documentRowCount` again here ' +
        'would be two spellings of one finding inside one module, drifting the first time an ' +
        'arm gained a field" (§5.3).',
    )
  }

  // And the eight defect arms are declared once, in one place.
  const occurrences = (capabilityText.match(/declared_line_count_disagrees/g) ?? []).length
  assert.equal(
    occurrences,
    2,
    'THE POPULATION-DEFECT VOCABULARY IS STATED MORE THAN TWICE. Exactly two are correct and ' +
      'both are named: once in the pinned `PopulationDefectKind` enum, and once as the arm\'s ' +
      'own single-member `kind`. A third occurrence is a third place to drift and no pair ' +
      `reaches it. Found ${occurrences}.`,
  )
})

/* ==================================================================== *
 * D · THE UNION THAT WAS DELIBERATELY NOT PINNED, AND THE MEASUREMENT
 *     THAT SAID WHY. W-1 (#186) IS CLOSED, AND THIS GROUP IS INVERTED.
 *
 * ⚠️ THIS HEADING READ "THE UNION THAT IS DELIBERATELY NOT PINNED … W-1
 *    (#186) IS OPEN", AND D1 BELOW ASSERTED THE READER'S DEFECT AS A FACT:
 *    that `unionKinds(SetReconciliationRefusal)` returned 17 for a 15-arm
 *    union, and that no pair might therefore be registered on it. It is
 *    corrected rather than deleted, because it is what a reader would have
 *    trusted. The old assertion did its job exactly as designed — it went RED
 *    the moment the reader was fixed, and its own failure message gave this
 *    commit its instructions: "If #186 landed, register the `run_refusal` pair
 *    in that commit and invert this assertion openly." Both were done here.
 *    The assertion is INVERTED, not deleted: it still measures the reader
 *    against the declaration, and it still fails if the answer moves — it now
 *    fails on 17, where it used to fail on 15.
 * ==================================================================== */

test('D1 — `RunRefusal` IS registered as a pair, because the reader is measurably right', () => {
  const registered = PAIRS.some((p) => p.model?.name === 'SetReconciliationRefusal')
  assert.equal(
    registered,
    true,
    'THE READER IS FIXED AND THE PAIR IS NOT REGISTERED, WHICH IS THE WORST OF BOTH. ' +
      '`RunRefusalKind` was hand-maintained only because `unionKinds()` could not be ' +
      'trusted against `SetReconciliationRefusal` (W-1, #186). With the reader reading arm ' +
      'depth, nothing justifies a hand-maintained tenant-facing enum: register the ' +
      '`run_refusal_kinds` pair in `tools/check-wire-mirror.mjs`.',
  )

  // The measurement, still run rather than described — inverted, not removed.
  // It stated a FACT about the tool before #186 and it states one after: the
  // reader returns the declaration's arms and NOTHING ELSE. It goes red again
  // the day that stops being true, in either direction.
  const harvested = unionKinds(engineText, 'SetReconciliationRefusal')
  assert.equal(
    harvested.length,
    15,
    'THE READER\'S ANSWER HAS MOVED. This file records `unionKinds(SetReconciliationRefusal)` ' +
      `returning 15 for a 15-arm union from 16 Aug 2026; it now returns ${harvested.length}. ` +
      'If it has gone back to 17, the arm-depth restriction in `unionKinds()` has been lost ' +
      'and the phantoms are back — DO NOT sweep the wire to match. ' +
      `Harvested: [${harvested.join(', ')}]`,
  )
  for (const phantom of ['pairing', 'strategy_binding']) {
    assert.ok(
      !harvested.includes(phantom),
      `THE PHANTOM \`${phantom}\` IS HARVESTED AGAIN. It is a member of the nested union ` +
        'INSIDE `tolerance_unit_disagrees`, not an arm of `SetReconciliationRefusal`. With ' +
        'the `run_refusal_kinds` pair now registered, a reader that harvests it will report ' +
        'DRIFT against a CORRECT wire — and the tempting repair puts two phantom arms on a ' +
        'tenant-facing contract.',
    )
  }
})

test('D2 — the wire carries the FIFTEEN real refusals, and neither phantom, asserted BY NAME', () => {
  const kinds = schemas.RunRefusalKind?.enum
  assert.ok(Array.isArray(kinds), '`RunRefusalKind` is not an enum schema in capability.openapi.yaml')

  // The 15, written out rather than derived. ⚠️ THE REASON GIVEN HERE HAS
  // CHANGED AND THE OLD ONE IS KEPT SO THE CHANGE IS VISIBLE: it read "because
  // the only extractor that could derive them is the one D1 measures as wrong …
  // this list is hand-maintained until #186 lands, and it is the ONLY vocabulary
  // in this slice that is." #186 HAS LANDED and the `run_refusal_kinds` pair is
  // registered, so the list is no longer the wire's only guard. It is kept
  // anyway, and it is now a DIFFERENT control: the pair proves the wire and the
  // model agree, and this list proves they agree on the RIGHT fifteen. A pair
  // alone cannot catch a rename applied to both sides in one commit.
  const EXPECTED = [
    'cross_tenant_documents',
    'strategy_binding_count_mismatch',
    'strategy_binding_kind_mismatch',
    'normalisation_invalid',
    'reader_candidate_cap_not_stated',
    'similarity_max_chars_not_stated',
    'subset_sum_bound_not_stated',
    'admission_refusal_ceiling_not_stated',
    'declared_unit_invalid',
    'declared_units_disagree',
    'tolerance_unit_disagrees',
    'population_integrity_refused',
    'admitted_item_key_collision',
    'control_total_expected_but_absent',
    'population_empty_and_not_expected',
  ]
  assert.deepEqual(kinds, EXPECTED, '`RunRefusalKind` does not mirror `SetReconciliationRefusal`')

  for (const phantom of ['pairing', 'strategy_binding']) {
    assert.ok(
      !kinds.includes(phantom),
      `\`${phantom}\` IS ON A TENANT-FACING CONTRACT AND IT IS NOT AN ARM OF THE MODEL'S ` +
        'UNION. It is a member of the nested union inside `tolerance_unit_disagrees`, ' +
        'harvested by the wire-mirror\'s reader (#186). An implementation that dutifully ' +
        'copied the checker\'s output produces exactly this, which is why it is asserted by ' +
        'name and not only by count.',
    )
  }

  // Every listed arm must also exist in the model text, so this hand-maintained
  // list cannot drift into naming something the model never had.
  for (const kind of EXPECTED) {
    assert.ok(
      engineText.includes(`kind: '${kind}'`),
      `\`${kind}\` is on the wire and appears in no \`kind: '…'\` position in ` +
        'model/reconciliation.ts.',
    )
  }
  assert.deepEqual([...armsOf('RunRefusal').keys()], EXPECTED, '`RunRefusal`\'s arms disagree')
})

/* ==================================================================== *
 * E · THE SIX READS, ARM BY ARM. The behavioural assertions live here:
 *     each one fails against a plausible implementation that passes the
 *     structural ones.
 * ==================================================================== */

test('E1 — ADMISSION EVIDENCE: three independent counts, and NOTHING DIVIDED', () => {
  const rate = schemas.AdmissionRate
  assert.ok(rate !== undefined, '`AdmissionRate` is not on the wire')
  assert.equal(rate.additionalProperties, false)
  assert.deepEqual(
    [...(rate.required ?? [])].sort(),
    ['admitted', 'presented', 'refused', 'side'],
    '`AdmissionRate` must carry `side`, `presented`, `admitted` and `refused`, ALL required.',
  )

  // 🛑 THE BEHAVIOURAL RED. A naive implementation "helpfully" adds a percentage
  // and passes every other assertion in this test.
  const computed = Object.keys(rate.properties ?? {}).filter((k) =>
    /rate|percent|ratio|basis[Pp]oints|fraction/.test(k),
  )
  assert.deepEqual(
    computed,
    [],
    'A DIVIDED QUANTITY IS ON `AdmissionRate`. The module never divides — C13 compares ' +
      '`refused × 10000 > ceiling × sideRowCount`, exact integer arithmetic, "cross-' +
      'multiplied, never divided" — and a wire that divided would reintroduce exactly the ' +
      'rounding that comparison was written to avoid. `presented` is folded from the ' +
      'DOCUMENTS by a source independent of the admission fold, which is what makes ' +
      '`presented === admitted + refused` a property a caller can CHECK rather than a ' +
      `tautology it is handed. Found: [${computed.join(', ')}]`,
  )
  assert.ok(
    !/presented\s*[-=]\s*admitted/.test(JSON.stringify(rate)),
    'the schema DERIVES `presented` from `admitted + refused`. The two counts have ' +
      'independent sources and their disagreement is the finding.',
  )

  const refused = schemas.RefusedItem
  assert.ok(refused !== undefined, '`RefusedItem` is not on the wire')
  assert.deepEqual(
    [...(refused.required ?? [])].sort(),
    ['path', 'ref', 'refusal', 'side'],
    '`RefusedItem` carries the side, the `ItemRef`, the `FieldPath` and the reason admission ' +
      'gave — and nothing else.',
  )
  // Invariant 4's executable half, reachable by an operator for the first time.
  assert.ok(
    (armsOf('PopulationAdmissionRefusal')).has('field_not_classified'),
    'G106\'s fail-closed refusal does not reach the wire. `field_not_classified` fires at ' +
      'four call sites in `admitPopulation()` and is the only executable form invariant 4 ' +
      'has; a surface that cannot show it makes "the remediation is READ THE RATE" an ' +
      'instruction to read a number no operator can see.',
  )
})

test('E2 — THE SHORTFALL CHANNEL: `Run.completeness` is REQUIRED AND NULLABLE, never optional', () => {
  const run = schemas.Run
  assert.ok(run !== undefined, '`Run` is not a schema')
  assert.ok(
    (run.required ?? []).includes('completeness'),
    'G153\'S CARVE-OUT ⓐ IS UNDISCHARGED. `Run` is `additionalProperties: false` with no ' +
      'findings channel, so a wire consumer learns THAT a run is `incomplete` and never ' +
      'WHAT is missing — "one word, which is the shape the declaration argues against". ' +
      '`CompletenessFinding` refused a bare `complete: false` on the ground that an operator ' +
      'cannot tell a mapper that dropped one row in three from a shredder that truncated a ' +
      'file.',
  )
  const completeness = run.properties?.completeness
  assert.ok(completeness !== undefined, '`Run.completeness` is required and not declared')

  // 🛑 THE BEHAVIOURAL RED, AND IT IS THE ONE A PLAUSIBLE IMPLEMENTATION FAILS.
  // `[]` means "the engine observed no shortfall". `null` means "no engine
  // account is stored for this run". Collapsing them publishes a clean close for
  // every run in a database that has never run the engine.
  assert.deepEqual(
    completeness.type,
    ['array', 'null'],
    'THE UNKNOWN AND THE EMPTY WERE COLLAPSED. `completeness: []` is the engine saying it ' +
      'observed no shortfall; `completeness: null` is this plane saying it holds no engine ' +
      'account for this run at all. A non-nullable array forces the second to be spelled as ' +
      'the first, which reports a clean close for a run nobody reconciled — the same shape ' +
      'as the fabricated zero `ResidueEntry.settlement` was written to make impossible. ' +
      `Got: ${JSON.stringify(completeness.type)}`,
  )
  assert.equal(completeness.items?.$ref, '#/components/schemas/CompletenessFinding')

  // The arrivals boundary, stated in the schema rather than left in the model.
  const text = String(completeness.description ?? '')
  assert.match(
    text,
    /arriv/i,
    'THE ARRIVALS BOUNDARY IS NOT STATED. "The engine knows what the documents it was HANDED ' +
      'presented, and what a file said about ITSELF. Nothing in this repository knows what ' +
      'ARRIVED." Ten files despatched and three landed is invisible to both arms and would ' +
      'stay invisible if all three were internally perfect. A consumer reading ' +
      '`completeness: []` as *nothing is missing* is reading it wrongly and the schema must ' +
      'say so.',
  )
  assert.match(text, /manifest|receipt|register/i, 'the boundary sentence names no missing denominator')

  // And nothing invented one.
  const invented = ['arrivalCount', 'expectedFiles', 'filesExpected']
  for (const name of invented) {
    assert.ok(
      !capabilityText.includes(name),
      `\`${name}\` was invented. "A count invented to make this state tidy would be a number ` +
        'with no source." (MG11)',
    )
  }
})

test('E3 — COMPLETENESS: `rows_presented_not_admitted` carries ALL FOUR counts', () => {
  const arms = armsOf('CompletenessFinding')
  const shortfall = arms.get('rows_presented_not_admitted')
  assert.ok(shortfall !== undefined, 'the run\'s OWN observation arm is missing')

  // 🛑 BEHAVIOURAL. An implementation that shipped a two-field finding
  // (`presented`, `admitted`) passes every structural assertion here.
  assert.deepEqual(
    [...(shortfall.required ?? [])].sort(),
    ['admitted', 'kind', 'presented', 'refused', 'side'],
    'A COUNT IS MISSING FROM THE SHORTFALL ARM. The pair `presented !== admitted + refused` ' +
      'is "a caller-checkable disagreement between two independent counts" — `presented` is ' +
      'folded from the DOCUMENTS and `admitted`/`refused` from the admission fold. Drop ' +
      '`refused` and the check cannot be performed by anybody downstream. The engine keys on ' +
      '`presented > admitted`, NOT `refused > 0`, so that a fold which LOST a row without ' +
      'refusing it is still visible.',
  )
})

test('E4 — POST-CONDITIONS ship with the declaration that says which arms are about soundness', () => {
  const property = schemas.PostconditionProperty
  assert.ok(
    property !== undefined,
    'THE DECLARATION IS MISSING AND SHIPPING THE LIST WITHOUT IT PUTS THE O-16 DEFECT ON THE ' +
      'WIRE ON PURPOSE. A consumer doing `postconditions.length > 0` discards sound partial ' +
      'closes; a consumer doing nothing persists unsound ledgers.',
  )
  assert.equal(property.additionalProperties, false)

  // Key by key, by name, against the model's own total `Record`. The checker has
  // no source kind that reads a const object's KEYS — `constValues()` returns its
  // VALUES — so the refuse/report split is covered by THIS ASSERTION AND BY
  // NOTHING ELSE.
  const model = new Map()
  const block = engineText.slice(engineText.indexOf('export const POSTCONDITION_PROPERTY = {'))
  for (const m of block.slice(0, block.indexOf('} as const')).matchAll(
    /^ {2}([a-z_]+): '(soundness|completeness)'/gm,
  )) {
    model.set(m[1], m[2])
  }
  assert.equal(model.size, 7, `read ${model.size} assignment(s) out of POSTCONDITION_PROPERTY, expected 7`)

  for (const [kind, expected] of model) {
    assert.equal(
      property.properties?.[kind]?.enum?.length,
      1,
      `\`PostconditionProperty.${kind}\` is not pinned to one value`,
    )
    assert.equal(
      property.properties[kind].enum[0],
      expected,
      `\`${kind}\` is \`${expected}\` in the model and something else on the wire.`,
    )
  }
  assert.deepEqual(
    [...(property.required ?? [])].sort(),
    [...model.keys()].sort(),
    'the published declaration does not cover every arm',
  )

  // 🛑 THE BEHAVIOURAL RED: the single assignment most likely to be got
  // backwards, because the word *refused* reads like a failure.
  assert.equal(
    property.properties?.population_wholly_refused?.enum?.[0],
    'completeness',
    '`population_wholly_refused` IS COMPLETENESS, NOT SOUNDNESS. "A side where every ' +
      'presented row refused is the EXTREME of incomplete, not a case of unsoundness: the ' +
      'ledger is sound over NOTHING." An implementation that classified by intuition gets ' +
      'this one wrong and every other one right.',
  )
})

test('E5 — THE RESIDUE: addressed by `ItemRef` at line grain, settlement required-and-nullable', () => {
  const ref = schemas.ItemRef
  assert.ok(ref !== undefined, '`ItemRef` is not on the wire')
  assert.deepEqual([...(ref.required ?? [])].sort(), ['lineIndex', 'sourceDocumentId'])
  assert.deepEqual(
    ref.properties?.lineIndex?.type,
    ['integer', 'null'],
    '`lineIndex` is null for a header-grain transaction and the line index for a statement ' +
      'line. "A bank statement is one `SourceDocument` with four hundred `ExtractedLine`s, ' +
      'so a set reconciliation is LINE-grain even though `PopulationSpec.documentTypeId` is ' +
      'document-grain."',
  )

  const entry = schemas.ResidueEntry
  assert.ok(entry !== undefined, '`ResidueEntry` is not on the wire')
  assert.deepEqual(
    [...(entry.required ?? [])].sort(),
    ['cause', 'disposition', 'ref', 'settlement', 'side'],
    '`settlement` must be in `required`.',
  )

  // 🛑 BEHAVIOURAL. Optional-and-absent is the shape a plausible implementation
  // reaches for, and it is the one the model's own declaration forbids by name.
  assert.deepEqual(
    entry.properties?.settlement?.oneOf?.length ?? null,
    null,
    'settlement must be expressed as a nullable `$ref`, not an inline oneOf',
  )
  assert.deepEqual(
    entry.properties?.settlement?.anyOf,
    [{ $ref: '#/components/schemas/ItemSettlement' }, { type: 'null' }],
    'REQUIRED AND NULLABLE, NEVER OPTIONAL. "An item whose amount could not be read HAS no ' +
      'settlement — it has no amount. The first version of this field was non-null and the ' +
      'refused case carried `{ currency: \'\', amountMinor: 0, exponent: 0 }`, which is a ' +
      'FABRICATED zero in a fabricated currency, sitting on the one row a finance user reads ' +
      'to find out what went wrong."',
  )

  // 🛑 BEHAVIOURAL. §5.5 — do not make the invalid state legal.
  assert.ok(
    !armsOf('ItemSettlement').has('over_allocated'),
    'THERE IS DELIBERATELY NO `over_allocated` MEMBER. Over-allocation is a REFUSAL from ' +
      '`applyAllocation()` carrying both numbers, not a state something can be left in.',
  )

  // 🛑 BEHAVIOURAL. A wire offering six would let a client read an engine verdict
  // as a finance judgement.
  const disposition = schemas.EngineAssignableDisposition
  assert.deepEqual(
    disposition?.enum,
    unionLiterals(engineText, 'EngineAssignableDisposition'),
    '`EngineAssignableDisposition` does not mirror the model',
  )
  for (const forbidden of ['timing_difference', 'in_transit', 'write_off']) {
    assert.ok(
      !disposition.enum.includes(forbidden),
      `\`${forbidden}\` IS A FINANCE JUDGEMENT AND THE ENGINE MAY NOT ASSIGN IT. ` +
        '"THE ENGINE MAY ONLY EVER ASSIGN THREE OF THE SIX" — the other three "are for ' +
        '`residueRules` and for a human."',
    )
  }
  assert.equal(entry.properties?.disposition?.$ref, '#/components/schemas/EngineAssignableDisposition')

  // No counterparty prose on a residue row. `AdmittedItem.untrustedDescription`
  // is the one such field in the module and it is named here so nobody adds it.
  for (const banned of ['description', 'label', 'note', 'untrustedDescription', 'filename']) {
    assert.ok(
      !Object.keys(entry.properties ?? {}).includes(banned),
      `\`ResidueEntry.${banned}\` carries counterparty-controlled prose onto a row that is ` +
        'rendered on an operator surface. Invariant 6.',
    )
  }
})

test('E6 — CONTROL TOTALS: the truncated-load report reaches the wire with its operands', () => {
  const arms = armsOf('PopulationDefect')

  // The six C18 arms name the file to re-cut; the C13 rate arm names NO document,
  // because `defectDocument()` returns null for it — "a rate is a property of the
  // side, and naming a file would be a claim about which one caused it."
  for (const kind of [
    'control_total_declared_nothing',
    'declared_line_count_disagrees',
    'control_total_unverifiable_rows_refused',
    'control_total_not_evaluable',
    'declared_control_total_disagrees',
    'control_total_arm_disagrees_with_document_type',
  ]) {
    const arm = arms.get(kind)
    assert.ok(arm !== undefined, `\`${kind}\` is not on the wire`)
    assert.ok(
      (arm.required ?? []).includes('sourceDocumentId'),
      `\`${kind}\` must name the document — "which file do I re-cut".`,
    )
  }

  const truncated = arms.get('declared_line_count_disagrees')
  assert.deepEqual(
    [...(truncated.required ?? [])].sort(),
    ['declaredCount', 'documentRowCount', 'kind', 'sourceDocumentId'],
    'THE TRUNCATED-SHRED DETECTOR MUST CARRY BOTH OPERANDS. "Compared against rows ' +
      'PRESENTED, never rows admitted — a truncated file and an unreadable row are different ' +
      'defects and keying one check on both is §5.1."',
  )

  // 🛑 BEHAVIOURAL. The one control whose entire subject is a hundredfold error.
  const disagrees = arms.get('declared_control_total_disagrees')
  assert.deepEqual(
    [...(disagrees.required ?? [])].sort(),
    [
      'admittedExponent',
      'admittedMinor',
      'declaredExponent',
      'declaredMinor',
      'kind',
      'sourceDocumentId',
    ],
    'THE EXPONENT IS NOT CARRIED. This arm is emitted PER DOCUMENT into a multi-document ' +
      'array, where "one run is one unit by construction" does NOT hold — so a minor-unit ' +
      'comparison with no exponent is a hundredfold error reported as a rounding one.',
  )
  assert.ok(
    !JSON.stringify(disagrees).includes('#/components/schemas/Money'),
    'MINOR UNITS AND NEVER A `Money`. "`Money.currency` is a `string`, so the containment ' +
      'proof forbids it — the same reason `MoneyRefusal` carries no currency."',
  )
})

test('E7 — THE CONFORMANCE FLOOR: the ceiling that WAS USED travels; no way to SET one', () => {
  const arm = armsOf('PopulationDefect').get('admission_refusal_rate_above_ceiling')
  assert.ok(arm !== undefined, 'C13\'s configurable half does not reach the wire')
  assert.deepEqual(
    [...(arm.required ?? [])].sort(),
    ['ceilingBasisPoints', 'kind', 'refusedCount', 'sideRowCount'],
    'THE REFUSAL MUST BE THE EVIDENCE. "Refusing discards the result, and with it ' +
      '`admissionRates` — so the refusal has to be the evidence an operator reads. A refusal ' +
      'saying only *too many rows refused* would leave \'read the rate\' with nothing to read."',
  )
  assert.ok(
    !(arm.required ?? []).includes('sourceDocumentId') &&
      !Object.keys(arm.properties ?? {}).includes('sourceDocumentId'),
    'THE RATE ARM NAMES A DOCUMENT. `defectDocument()` returns `null` for it deliberately: ' +
      '"a rate is a property of the SIDE — the rows came from every document on it, and ' +
      'naming one of them would be a claim about which file caused a rate."',
  )

  // 🛑 BEHAVIOURAL, AND IT IS THE STATED NON-GOAL. G139 makes every C13 floor
  // FDE-set pack configuration refusing on absence, and there is no surface on
  // which any of them is set. A settable ceiling on a tenant-facing operation
  // would be the off-switch G79 already refused once.
  //
  // ⚠️ THIS SCAN READS PROPERTY NAMES, NOT DESCRIPTIONS, AND THE FIRST DRAFT
  // READ DESCRIPTIONS. It failed against `POST /autonomy/recommendations/
  // {recommendationId}/decision`, whose request body DISCUSSES the autonomy
  // ceiling in prose and sets nothing — a rule keyed on the character stream
  // instead of on the property it protects (§5.1), inside the assertion written
  // to protect it. What is forbidden is a settable FIELD.
  const settable = []
  const walkNames = (node, out) => {
    if (Array.isArray(node)) return void node.forEach((n) => walkNames(n, out))
    if (typeof node !== 'object' || node === null) return
    for (const [key, child] of Object.entries(node)) {
      if (key === 'properties' && typeof child === 'object' && child !== null) {
        out.push(...Object.keys(child))
      }
      walkNames(child, out)
    }
  }
  //
  // 🛑 AND THE SCAN IS SCOPED TO THIS TRACK'S OPERATIONS, WHICH IS A NARROWING
  // FOUND BY RUNNING IT RATHER THAN A CHOICE MADE UP FRONT. Over the whole
  // document it fails on a REAL settable field: `POST /autonomy/recommendations/
  // {recommendationId}/decision` takes `ceilingSet: AutonomyCeiling`, required.
  // That is a DIFFERENT ceiling — how much an agent may do unattended, changed
  // by a human who must give a reason to override a recommendation — and it is
  // deliberate, pre-existing and none of this slice's business. Two unrelated
  // things called a "ceiling" on one tier is worth knowing about; widening this
  // assertion to cover it would relitigate C13's neighbour, and narrowing it
  // silently would hide that the collision exists.
  const scoped = ['/runs/{runId}/account', '/runs/{runId}/residue', '/runs', '/runs/{runId}']
  for (const name of scoped) {
    for (const [method, op] of Object.entries(paths[name] ?? {})) {
      if (typeof op !== 'object' || op === null || op.requestBody === undefined) continue
      const names = []
      walkNames(op.requestBody, names)
      for (const field of names) {
        if (/ceiling|floor|basis[Pp]oints/i.test(field)) {
          settable.push(`${method.toUpperCase()} ${name} → ${field}`)
        }
      }
    }
  }
  assert.deepEqual(
    settable,
    [],
    'A RUN OPERATION ACCEPTS A CEILING OR A FLOOR AS A REQUEST FIELD. This track exposes the ' +
      'ceiling that WAS USED and offers NO WAY TO SET ONE — a settable conformance bound on a ' +
      `tenant-facing operation is an off-switch on the control. Found: [${settable.join(', ')}]`,
  )
  // The autonomy field is asserted to still be there, so that this narrowing
  // cannot quietly become vacuous if somebody removes it.
  assert.ok(
    JSON.stringify(paths['/autonomy/recommendations/{recommendationId}/decision'] ?? {}).includes(
      'ceilingSet',
    ),
    'the pre-existing autonomy `ceilingSet` field is gone, so the narrowing above is now ' +
      'excluding nothing and should be widened back in the commit that removed it.',
  )
})

/* ==================================================================== *
 * F · THE OPERATIONS
 * ==================================================================== */

/** Every `$ref` reachable from `node`, resolved recursively inside this document. */
function refClosure(node, seen = new Set()) {
  const out = []
  const walk = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item)
      return
    }
    if (typeof value !== 'object' || value === null) return
    for (const [key, child] of Object.entries(value)) {
      if (key === '$ref' && typeof child === 'string') {
        if (seen.has(child)) continue
        seen.add(child)
        const m = /^#\/components\/(schemas|parameters|responses)\/(.+)$/.exec(child)
        if (m === null) continue
        walk(doc.components?.[m[1]]?.[m[2]])
        continue
      }
      out.push(key)
      walk(child)
    }
  }
  walk(node)
  return out
}

test('F1 — the two reads are declared on the CAPABILITY tier, under C5, on the DATA plane', () => {
  const account = paths['/runs/{runId}/account']?.get
  const residue = paths['/runs/{runId}/residue']?.get
  assert.ok(account !== undefined, '`GET /runs/{runId}/account` is not declared')
  assert.ok(residue !== undefined, '`GET /runs/{runId}/residue` is not declared')
  assert.equal(account.operationId, 'getRunAccount')
  assert.equal(residue.operationId, 'listRunResidue')
  assert.deepEqual(account.tags, ['C5 Run Admission'])
  assert.deepEqual(residue.tags, ['C5 Run Admission'])

  // Invariant 3 — "the control plane publishes downward and never reads tenant
  // data." These are data-plane reads; declaring one on the other tier is a
  // violation, not a convenience.
  const controlPlane = readFileSync(path.join(CONTRACTS, 'control-plane.openapi.yaml'), 'utf8')
  for (const id of ['getRunAccount', 'listRunResidue']) {
    assert.ok(
      !controlPlane.includes(id),
      `\`${id}\` appears in control-plane.openapi.yaml. That document is the control plane's ` +
        'router, so a tenant-data path in it is a route across the account boundary.',
    )
  }
})

test('F2 — NO REQUEST SURFACE NAMES A TENANT — proved by a RECURSIVE `$ref` scan', () => {
  // 🛑 A FLAT GREP IS NOT SUFFICIENT AND THIS REPOSITORY KNOWS IT: a recursive
  // `$ref` scan is what found invariant 1's two existing wire deviations, and
  // `tools/check-wire-mirror.mjs` "does not resolve `$ref` targets" by its own
  // admission. Invariant 1 — tenant scope is derived from the session, never
  // read from a request.
  for (const template of ['/runs/{runId}/account', '/runs/{runId}/residue']) {
    const operation = paths[template].get
    const keys = refClosure({
      parameters: operation.parameters ?? [],
      requestBody: operation.requestBody ?? null,
    })
    const offending = keys.filter((k) => /tenant/i.test(k))
    assert.deepEqual(
      offending,
      [],
      `\`GET ${template}\` has a tenant-bearing key on its REQUEST side: ` +
        `[${offending.join(', ')}]. "A request that could STATE its tenant is a request ` +
        'that could state the wrong one — invariant 1, expressed as an absence rather than ' +
        'a comment."',
    )
    // And no `name: tenantId` style parameter, which is a VALUE not a key.
    for (const parameter of operation.parameters ?? []) {
      const resolved = parameter.$ref
        ? doc.components.parameters[parameter.$ref.split('/').pop()]
        : parameter
      assert.ok(
        !/tenant/i.test(String(resolved.name)),
        `\`GET ${template}\` declares a parameter named \`${resolved.name}\`.`,
      )
    }
  }
})

test('F3 — the residue read is cursor-paged with the SHARED parameters, not a second spelling', () => {
  const residue = paths['/runs/{runId}/residue'].get
  const refs = (residue.parameters ?? []).map((p) => p.$ref).filter(Boolean)
  for (const shared of [
    '#/components/parameters/RunId',
    '#/components/parameters/Cursor',
    '#/components/parameters/Limit',
  ]) {
    assert.ok(
      refs.includes(shared),
      `\`listRunResidue\` does not \`$ref\` \`${shared}\`. A second pagination spelling is a ` +
        'second thing to get wrong, and `Cursor`\'s opacity argument — "a cursor a client can ' +
        'construct is a cursor a client can point at another tenant\'s ordering key" — has to ' +
        'be inherited rather than restated.',
    )
  }

  // 🛑 BEHAVIOURAL: an implementation that INLINED the entry schema passes every
  // other assertion in this file.
  const page = residue.responses?.['200']?.content?.['application/json']?.schema
  assert.equal(
    page?.properties?.items?.items?.$ref,
    '#/components/schemas/ResidueEntry',
    'THE ITEM SCHEMA IS INLINED RATHER THAN `$ref`d. One vocabulary, one declaration (§5.3).',
  )
  assert.deepEqual([...(page.required ?? [])].sort(), ['items', 'nextCursor'])
})

test('F4 — the account envelope mirrors `SetReconciliationOutcome`: a refused run carries NO ledger', () => {
  const schema = schemas.RunEngineAccount
  assert.ok(schema !== undefined, '`RunEngineAccount` is not on the wire')
  assert.ok(Array.isArray(schema.oneOf) && schema.oneOf.length === 2, 'the envelope is not two-armed')
  assert.equal(schema.discriminator?.propertyName, 'outcome')

  const byOutcome = new Map(schema.oneOf.map((arm) => [arm.properties?.outcome?.enum?.[0], arm]))
  assert.deepEqual([...byOutcome.keys()], ['produced', 'refused'])

  const refused = byOutcome.get('refused')
  assert.equal(refused.additionalProperties, false)
  assert.deepEqual([...(refused.required ?? [])].sort(), ['outcome', 'refusal'])

  // 🛑 BEHAVIOURAL. `SetReconciliationOutcome`'s `ok: false` arm "carries no
  // residue, no `refusedAtAdmission`, no ambiguities — a refused run produced
  // nothing, and the refusal IS the output." Making the invalid state legal is
  // §5.5.
  // ⚠️ `meterFacts` JOINED THIS LIST ON 22 Aug 2026 (W-10 #202, G237). It is the
  // sixth channel and it is absent from the refused arm for the same reason as
  // the five: a refused run produced nothing, and a meter channel there would
  // make an invalid state legal.
  // ⚠️ `ambiguities` AND `searchBoundary` JOINED THIS LIST ON 24 Aug 2026 (W-9
  // #201, G217). They are absent from the refused arm for the same reason as the
  // rest: a refused run never ran a pass, so it named no ambiguity and hit no
  // bound.
  for (const forbidden of ['residue', 'admissionRates', 'postconditions', 'completeness', 'terminalStatus', 'meterFacts', 'ambiguities', 'searchBoundary', 'settlementTallies', 'openResidual']) {
    assert.ok(
      !Object.keys(refused.properties ?? {}).includes(forbidden),
      `THE REFUSED ARM CAN CARRY A LEDGER. \`${forbidden}\` is declared on it, and a refused ` +
        'run produced none of those. Mirror the model\'s own shape rather than making the ' +
        'invalid state legal.',
    )
  }

  const produced = byOutcome.get('produced')
  // ⚠️ THIS LIST HELD FIVE CHANNELS UNTIL 22 Aug 2026 AND THE ASSERTION MESSAGE
  // SAID "ALL FIVE". W-10 (#202) folded `meterFacts` on as the sixth under G237,
  // and this control went RED on the day it landed — which is what a hard-coded
  // required-list is for. It is swept rather than loosened: replacing the
  // `deepEqual` with a `includes` check would let the seventh channel arrive
  // unremarked, and the whole value here is that a channel cannot be added or
  // made optional without somebody saying so in this file.
  //
  // 🛑 AND THE SEVENTH ARRIVED ON 23 Aug 2026: `documentAccounts`, G236 (#198).
  // It went RED here on the day it landed, exactly as `meterFacts` did — the
  // second time this control has been the thing that noticed. It is REQUIRED for
  // the same reason `admissionRates` is, one grain down: G236's whole subject is
  // that a check which only speaks when it fails cannot tell an operator "this
  // file vouched for itself and was right" from "this file said nothing", and an
  // optional wire field would hand that silence straight back.
  //
  // 🛑 AND THE EIGHTH AND NINTH ARRIVED TOGETHER ON 24 Aug 2026: `ambiguities`
  // and `searchBoundary`, G217 (#201). This control went RED on the day they
  // landed — the THIRD time it has been the thing that noticed, which is the
  // argument for a hard-coded list over a subset check. Both are REQUIRED for
  // the reason G114 states and G217 inherits: A BOUND THAT WAS HIT IS RECORDED,
  // NEVER SILENTLY ABSORBED. `searchBoundary` is the channel that separates
  // *the engine looked and found nothing* from *the engine stopped looking*,
  // and an optional field would let a server drop exactly the second one.
  assert.deepEqual(
    [...(produced.required ?? [])].sort(),
    [
      'admissionRates',
      'ambiguities',
      'completeness',
      'documentAccounts',
      'meterFacts',
      // G3804, 4 Oct 2026 — the eleventh, "In variance" as the owner defined
      // it (the net open residual). It went RED here on the day it landed.
      'openResidual',
      'outcome',
      'postconditions',
      'refusedAtAdmission',
      'searchBoundary',
      // G3541, 3 Oct 2026 — the tenth, and it went RED here on the day it
      // landed, as `meterFacts` did. Derived from `admissionRates` and the
      // residue, so it is unconditional for `admissionRates`' reason.
      'settlementTallies',
      'terminalStatus',
    ],
    'ALL ELEVEN CHANNELS ARE UNCONDITIONAL ON A PRODUCED RUN. `admissionRates` in particular ' +
      'is recorded UNCONDITIONALLY by the model "so a permissive ceiling suppresses the ' +
      'REFUSAL and never the EVIDENCE" — an optional wire field would let a server omit it ' +
      'under exactly the condition it exists to survive; `meterFacts` inherits that ' +
      'reasoning, because a server omitting what a run spent is a server omitting evidence; ' +
      'and `documentAccounts` is G236, which exists precisely because a met trailer that ' +
      'produces no row is indistinguishable from a file that declared nothing.',
  )
  assert.deepEqual(
    produced.properties.admissionRates.minItems,
    2,
    'one `AdmissionRate` per side, `left` then `right`, on every successful run',
  )
  assert.equal(produced.properties.admissionRates.maxItems, 2)
  assert.deepEqual(
    produced.properties.terminalStatus.enum,
    ['completed', 'failed', 'incomplete'],
    '`terminalStatus` mirrors `TerminalRunStatus`, the three states a FINISHED run may be in.',
  )
  assert.match(
    String(produced.properties.terminalStatus.description ?? ''),
    /soundness outranks completeness/i,
    'the join must be stated VERBATIM: soundness outranks completeness, `failed` means ' +
      'do-not-persist, `incomplete` means persist-and-tell-somebody.',
  )
})

/* ==================================================================== *
 * G · GATING — stated loudly, because the whole tier is ungated and this
 *     slice must not pretend otherwise.
 * ==================================================================== */

/**
 * ⚠️ THIS TEST WAS INVERTED ON 16 Aug 2026, AND ITS OLD NAME IS PRESERVED HERE
 * BECAUSE IT IS THE CLAIM A READER WOULD HAVE TRUSTED. It read:
 *
 *     'G1 — these operations are UNGATED, like every other operation in this repository'
 *
 * and it asserted, across all four tiers, that ZERO capability names appeared in
 * any contract file. That assertion was correct every day it ran and it is now
 * false BY RULING, not by drift: the owner's 16 Aug ruling is *"gate everything
 * before serving anything more"*, taken as a single deliberate pass over every
 * declared operation.
 *
 * ITS ARGUMENT SURVIVES INTACT AND IS THE REASON THE INVERSION IS SAFE. The old
 * message said: *"The roster is closed at 37 and W-11 (#192) — 'Reading a run's
 * engine account has no verb, so every operation this track mints would be gated
 * by a capability that does not exist' — is OPEN… It is the owner's ruling, not
 * this slice's. Inventing a verb to look rigorous is the §5.6 shape with extra
 * steps."*
 *
 * W-11 IS CLOSED BY AN OWNER RULING AND NOT BY THIS SLICE. `admit_source` is
 * G173's pending thirty-eighth — *"the reader act gets its own capability,
 * classed `tenant_data`"* — APPLIED, with the owner's instruction being to
 * reconcile the roster with it *"rather than minting beside it"*. So the verb
 * these two operations redeem was ruled before it was written, which is exactly
 * what the old test demanded. The assertion below is what proves that rather
 * than this sentence: it requires the annotation to name a MEMBER OF
 * `CAPABILITIES`, so a verb invented here would fail on the roster, not on
 * taste.
 */
test('G1 — these operations are GATED, on a verb the owner ruled before this slice wrote it', () => {
  // Derived, not asserted, in both directions.
  //
  // 🛑 THE COMMENT-STRIPPING HELPER THAT STOOD HERE IS DELETED, AND THE FINDING
  // IT CARRIED IS KEPT, BECAUSE THE FINDING OUTLIVES THE CODE. The old polarity
  // counted CAPABILITY NAMES IN THE CHARACTER STREAM of each contract file and
  // required zero; an earlier revision of this very comment quoted the pattern
  // literally, so the count found the reproduction command in
  // capability.openapi.yaml's own prose and returned TWO — the file counting
  // itself, §5.1, a rule keyed on a convenient landmark instead of the property
  // it protects. The inversion below removes the need for the strip entirely:
  // every assertion now reads the PARSED STRUCTURE — `op['x-capability']` on an
  // operation — which is what a capability annotation actually is. A dead
  // twenty-line parser kept alive by a `void` statement in a control file reads
  // as machinery someone will later assume is running, which is the same class
  // of defect one layer up.
  //
  // 🛑 THE ROSTER IS THE GATE ON THE ANNOTATION. `admit_source` must be a member
  // of CAPABILITIES and not a string somebody typed into YAML — which is the old
  // test's requirement, unchanged, checked against the model rather than against
  // a count of zero.
  const annotated = {}
  for (const template of ['/runs/{runId}/account', '/runs/{runId}/residue']) {
    const v = paths[template].get['x-capability']
    annotated[template] = v
    assert.ok(
      Object.values(CAPABILITIES).includes(v),
      `\`${template}\` is annotated \`${String(v)}\`, which is not a member of CAPABILITIES. ` +
        'The roster is closed and a pack may never introduce one; an annotation outside it ' +
        'gates nothing, because `authorize()` would be handed a value ' +
        '`CAPABILITY_RESOURCE_CLASS` has no entry for. Inventing a verb to look rigorous is ' +
        'the §5.6 shape with extra steps.',
    )
  }
  assert.deepEqual(
    annotated,
    { '/runs/{runId}/account': 'view_run', '/runs/{runId}/residue': 'view_run' },
    '🛑 `view_run` SINCE 4 Oct 2026 — G3881, THE OWNER\'S RULING ON G3802: "Keep partners ' +
      'out: run reads open to customer roles holding view_exception, but are excluded from ' +
      'the partner capability mask; partners still see exceptions, not run residue." ' +
      'BEFORE IT, G3801\'s `view_exception`, THE OWNER\'S RULING ON C3-06: "Open run ' +
      'reads to view_exception: anyone who can see the register can see its runs; ' +
      'admit_source stays the gate for starting runs." THE REASONING BELOW IS WHAT IT ' +
      'OVERTURNS, kept as history: ' +
      'Both operations redeemed `admit_source` — G173 applied, classed `tenant_data` because ' +
      'that is what they read. NOT `trigger_run`, which is classed `configuration` and would ' +
      'REFUSE AT RUNTIME on `authorize()`\'s class-mismatch branch; not `view_summary`, which ' +
      'the owner refused for the engine account; and not a run verb, which the owner refused ' +
      'in the same breath.',
  )

  // AND THE OTHER DIRECTION, MEASURED RATHER THAN CLAIMED: `admit_source` must
  // be out of every partner scope. G173 requires that absence be asserted BY
  // NAME and never by a length, and `listRunResidue` is precisely why — the
  // residue is source material at `(sourceDocumentId, lineIndex)` grain.
  // 🛑 AND THAT ABSENCE WAS SPENT BY G3801 (G3802) AND IS BOUGHT BACK BY THE
  // OWNER'S G3802 RULING (G3881): the two operations name `view_run`, which is
  // in NO partner scope, while `view_exception` — the register — stays in both.
  // The G3802 assertion that stood here (`view_exception` IS in a scope, so a
  // partner reads these two) is REPLACED by the property it was standing in for.
  for (const scope of Object.keys(PARTNER_CAPABILITY_MASK)) {
    assert.equal(PARTNER_CAPABILITY_MASK[scope].includes('view_run'), false, `view_run is in ${scope} (G3881)`)
  }
  // `admit_source` itself is still out of every scope — it still gates intake.
  for (const scope of Object.keys(PARTNER_CAPABILITY_MASK)) {
    assert.equal(PARTNER_CAPABILITY_MASK[scope].includes('admit_source'), false, scope)
  }

  // AND THAT NOTHING WAS QUIETLY LEFT UNGATED BESIDE THEM. Structure, never a
  // character-stream count — the comment above says why that distinction is
  // §5.1, and it holds now that the polarity is inverted.
  const ungated = Object.entries(paths)
    .flatMap(([template, item]) =>
      Object.entries(item)
        .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
        .map(([method, op]) => [`${method} ${template}`, op]),
    )
    .filter(([, op]) => op['x-capability'] === undefined)
    .map(([label]) => label)
  assert.deepEqual(
    ungated.sort(),
    [],
    `${ungated.length} operation(s) on the capability tier carry no \`x-capability\` at all. ` +
      'The 16 Aug ruling is that the gate is designed ONCE, as a single pass over every ' +
      'declared operation, rather than accreted per slice — so an operation added beside ' +
      `these two without one is the accretion the ruling forbids.\n\n${ungated.join(', ')}`,
  )

  // Both new operations inherit the DOCUMENT-level `security`, exactly as
  // `getRun` and `listRuns` do — no per-operation override in either direction.
  // ⚠️ `^\s+security:` WAS WRONG AND MATCHED THE DOCUMENT-LEVEL KEY. `\s`
  // includes the newline, so with the `m` flag it consumed the blank line above
  // a top-level `security:` and reported a per-operation override that does not
  // exist. Literal spaces, never `\s`, when the assertion is about indentation.
  assert.equal((capabilityText.match(/^security:/gm) ?? []).length, 1)
  assert.equal((capabilityText.match(/^ +security:/gm) ?? []).length, 0)
  for (const template of ['/runs/{runId}/account', '/runs/{runId}/residue']) {
    assert.equal(
      paths[template].get.security,
      undefined,
      `\`${template}\` overrides the document security. An empty array would make it PUBLIC ` +
        'and a non-empty one would be a per-operation gate that exists nowhere else — a gate ' +
        'in one handler and nowhere else is worse than none, because it reads as a system ' +
        'property and is not.',
    )
  }

  // The refusals both operations declare are their neighbours', unchanged.
  for (const template of ['/runs/{runId}/account', '/runs/{runId}/residue']) {
    const responses = paths[template].get.responses
    assert.equal(responses['403']?.$ref, '#/components/responses/Denied')
    assert.equal(responses['404']?.$ref, '#/components/responses/NotFound')
  }
})

test('G2 — the carve-out comment is REMOVED BECAUSE IT IS DISCHARGED, and the replacement names the operation', () => {
  // Same treatment as the superseded sentence below: the carve-out's own words
  // survive as a QUOTATION inside the note that records it discharged, and
  // nowhere else. `stale <= 1` plus the banner is what distinguishes a narrated
  // correction from the claim simply still standing.
  const carveOut = (capabilityText.match(/Minting those schemas is its own commit/g) ?? []).length
  assert.ok(
    carveOut <= 1,
    `G153's carve-out ⓐ sentence appears ${carveOut} times; at most one narrated quotation ` +
      'is correct.',
  )
  assert.ok(
    capabilityText.includes('getRunAccount') && capabilityText.includes('listRunResidue'),
    'the replacement sentence must NAME the operations that discharge the carve-out.',
  )
  // ⚠️ THE SUPERSEDED SENTENCE MAY STILL APPEAR, AND ONLY AS A QUOTATION.
  // "Corrections are narrated, never swept": the claim a reader would have
  // trusted — "`SetReconciliationResult.completeness` … reaches NO contract
  // tier" — is preserved inside the discharge note rather than deleted. What
  // must not survive is the claim standing UNMARKED, so this asserts the
  // discharge banner is present and that the old sentence occurs at most once.
  const stale = (capabilityText.match(/reaches NO contract tier/g) ?? []).length
  assert.ok(
    stale <= 1,
    `the superseded "reaches NO contract tier" claim appears ${stale} times. One is the ` +
      'narrated quotation inside the discharge note; a second is the claim standing again.',
  )
  if (stale === 1) {
    assert.match(
      capabilityText,
      /G153's CARVE-OUT ⓐ IS DISCHARGED HERE/,
      'THE SUPERSEDED SENTENCE STANDS UNMARKED. It may appear only as a quotation inside the ' +
        'note that records it going false — otherwise the contract is still telling a reader ' +
        'that the engine\'s channels reach no tier while the schemas are in the same file.',
    )
  }
})
