/**
 * check-pack-safety.mjs — THE WITNESS ARM.
 *
 * Gate stage index 4 runs `checkCorpora(['model/examples.ts'])` over 4 packs,
 * 0 procedures and 0 agents and exits 0. It is `docs/HANDOFF.md` §5.6 — a
 * control that passes while asserting nothing — and G110 records its CI half as
 * LANDED, so invariant 6's second enforcement is recorded as running while
 * validating nothing.
 *
 * 🛑 WHAT THIS SUITE IS FOR, STATED AS THE MUTATION IT REFUSES. Deleting three
 * of the four arms of `validateAgentToolBindings()` — including the agent-level
 * `admitting_agent_carries_tools` — leaves `npm run check` green on all seven
 * stages. The witness arm turns that mutation into a stage-4 failure.
 *
 * ⚠️ EVERY RULE NAME BELOW IS A LITERAL TYPED INTO THIS FILE. None is imported
 * from `model/`. Comparing a checker's output to the same constant the checker
 * read is a comparison that passes when both sides are empty — the standard
 * `tests/ci/gate.test.ts:30-34` states and the reason this repository's
 * types-only modules cannot be trusted to a green `tsc`.
 *
 * Importing the module does not run it: the CLI is guarded behind
 * `path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)`, and under
 * `node --test` argv[1] is the test file.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  PROBES,
  ruleInventory,
  witnessValidators,
  checkCorpora,
} from '../../tools/check-pack-safety.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CHECKER = path.join(REPO_ROOT, 'tools', 'check-pack-safety.mjs')

const runCli = (args) =>
  spawnSync(process.execPath, [CHECKER, ...args], { cwd: REPO_ROOT, encoding: 'utf8' })

// ------------------------------------------------------- 1. the inventory

test('test_the_rule_inventory_is_derived_from_the_two_validators_and_names_every_arm_each_one_can_raise', () => {
  const inv = ruleInventory()

  // LITERALS. Two arms on the procedure side, four on the agent side. If the
  // scanner silently returned [] both `deepEqual`s fail — which is the whole
  // point, because an inventory that derives to empty makes the coverage
  // assertion below vacuous in exactly the way this slice exists to end.
  assert.deepEqual(inv.procedure, [
    'admitting_agent_carries_tools',
    'untrusted_to_outbound_without_human',
  ])
  assert.deepEqual(inv.agent, [
    'admitting_agent_carries_tools',
    'endpoint_on_local_tool',
    'reads_untrusted_and_egresses',
    'tool_missing_endpoint',
  ])
})

test('test_an_inventory_scan_that_finds_no_rule_for_either_validator_throws_rather_than_reporting_an_empty_set', () => {
  // SH-6 pointed at the scanner itself. A source scan is a landmark match, and
  // a landmark match that stops matching returns [] rather than failing — which
  // would make `gaps` empty for the best possible reason and the worst.
  assert.throws(
    () => ruleInventory({ agentsSource: '// nothing here', domainSource: '// nor here' }),
    /derived no rules/,
    'a scan that finds nothing must refuse, not report a clean empty inventory',
  )
})

test('test_the_agent_side_of_the_inventory_is_cross_checked_against_the_runtime_AGENT_VIOLATIONS_object', () => {
  // The scan reads `AGENT_VIOLATIONS.<name>` and resolves each through the real
  // exported object, so a renamed member is a throw rather than a silent drop.
  assert.throws(
    () => ruleInventory({ agentsSource: 'AGENT_VIOLATIONS.noSuchMember' }),
    /noSuchMember/,
    'a constant name the runtime object does not carry must be named in the error',
  )
})

// --------------------------------------------------------- 2. the probes

test('test_every_probe_produces_exactly_its_pinned_rule_set_over_the_real_validators', async () => {
  const w = await witnessValidators()

  for (const probe of w.probes) {
    assert.deepEqual(
      probe.actual,
      probe.expected,
      `probe ${probe.corpus} produced ${JSON.stringify(probe.actual)}, pinned ${JSON.stringify(probe.expected)}`,
    )
  }
  // RED-10. Zero disagreements over zero probes is not a pass.
  assert.equal(w.probes.length, PROBES.length)
  assert.ok(w.probes.length >= 5, 'the witness must run every pinned probe')
})

test('test_the_probes_between_them_cover_every_rule_in_the_inventory_so_no_validator_arm_is_unexercised', async () => {
  const w = await witnessValidators()

  assert.deepEqual(
    w.gaps,
    [],
    'a validator arm no probe exercises is an arm that can be deleted with the gate green — ' +
      'which is true of three of the four agent arms at the commit before this slice',
  )
  /* RED-10 again, and the count is EXACT because it is fixed by the VALIDATORS
   * rather than by a growing tree: 2 procedure arms + 4 agent arms + 8
   * classification arms.
   *
   * ⚠️ CHANGED TO THE NEW TRUTH ON 24 Aug 2026 (#176/#177, G206), NOT RELAXED
   * TO PASS — the same discipline the merge note at the bottom of this file
   * states about itself. It read 6, and it went red at 14 when
   * `validatePackClassificationRules()` joined the checker with a probe
   * exercising every member of `CLASSIFICATION_RULE_VIOLATIONS`. It is still an
   * exact equality, so a ninth classification arm added without a vector goes
   * red the same way; it was not softened to a `>=`.
   *
   * 🛑 AND THE CLASSIFICATION HALF READS ITS INVENTORY OFF THE VIOLATION CONST
   * RATHER THAN OFF THE VALIDATOR BODY, which the other two do not. The
   * difference is the case worth catching: a member added to the vocabulary and
   * never pushed is a DEAD ARM, and a body scan cannot see one because the body
   * never mentions it.
   *
   * ⚠️ AND CHANGED AGAIN ON 4 Oct 2026 (G4202), TO THE NEW TRUTH AND NOT TO
   * PASS: 14 → 20, when `validateDocumentTypeTemplates()` (`model/publication.ts`,
   * the publication seam's document-type validator) joined the checker with a
   * probe exercising all six members of `DOCUMENT_TYPE_DECLARATION_VIOLATIONS`.
   * It went red at 20 first; it is still an exact equality. */
  assert.equal(w.covered.length, 20)
  assert.notEqual(w.covered.length, 0)
})

test('test_a_probe_whose_validator_arm_has_been_deleted_is_reported_as_a_disagreement_naming_the_rule_that_stopped_firing', async () => {
  // The lazy repair this refuses: a probe table that only checks `findings.length > 0`.
  // That passes while two of an unsafe fixture's three rules quietly stop firing.
  const w = await witnessValidators([
    {
      corpus: 'tests/ci/fixtures/safe-agent-corpus.ts',
      expected: ['agent:reads_untrusted_and_egresses'],
    },
  ])

  assert.equal(w.ok, false)
  assert.deepEqual(w.probes[0].actual, [])
  assert.deepEqual(w.probes[0].missing, ['agent:reads_untrusted_and_egresses'])
})

// ------------------------------------------- 3. the corpus arm, unchanged

test('test_the_default_corpus_arm_still_reports_its_vacuity_at_exit_zero_because_an_empty_corpus_is_a_gap_not_a_regression', async () => {
  const corpus = await checkCorpora(['model/examples.ts'])

  assert.deepEqual(corpus.findings, [])
  assert.equal(corpus.proceduresValidated, 0)
  assert.equal(corpus.agentsValidated, 0)
  assert.deepEqual([...corpus.vacuous].sort(), ['agent', 'procedure'])

  /* 🛑 THIS ASSERTION IS THE HONEST ONE AND IT IS DELIBERATELY NOT REPAIRED.
   *
   * The shipped corpus contributes nothing, and this slice does not pretend
   * otherwise: it does not plant a procedure in `model/examples.ts`, and it
   * does not roll the probes' counts into the corpus's so the total reads
   * non-zero. `tests/ci/gate.test.ts:306` already committed the judgement that
   * "an empty corpus is a gap, not a regression"; turning this into exit 1
   * would contradict a committed judgement AND make trunk red for having
   * authored no packs yet, which is precisely what G95 warned CI must not do.
   * What this slice changes is that the STAGE no longer exits 0 having
   * asserted nothing — the witness arm asserts, and it can fail. */
})

// ------------------------------------------------------------ 4. the CLI

test('test_the_cli_refuses_a_run_in_which_a_validator_arm_was_never_exercised', () => {
  // The call site. SH-3 — a control with no call site — found repeatedly in
  // this repository INSIDE the tools written to catch it, so the wiring is
  // asserted through the real process rather than by calling the function.
  const clean = runCli(['--json'])
  assert.equal(clean.status, 0, `trunk must be green; stderr=${clean.stderr}`)
  const report = JSON.parse(clean.stdout)
  assert.deepEqual(report.witness.gaps, [])
  assert.equal(report.witness.covered.length, 20)
  assert.equal(report.corpus.proceduresValidated, 0)
})

test('test_the_witness_arm_runs_even_when_the_caller_names_its_own_corpus_so_no_argument_switches_it_off', () => {
  // SH-2 — a caller-supplied parameter that switches a check off. `--corpus`
  // redirects the CORPUS arm and must not reach the witness arm, or the gate's
  // own `check:packs` script could be edited to disable it.
  const run = runCli(['--corpus', 'tests/ci/fixtures/empty-corpus.ts', '--json'])
  assert.equal(run.status, 0)
  const report = JSON.parse(run.stdout)
  assert.equal(report.witness.covered.length, 20, 'the witness arm must run regardless of --corpus')
  // ⚠️ CHANGED TO THE NEW TRUTH IN A MERGE, 16 Aug 2026, NOT RELAXED TO PASS.
  //    This read `['agent', 'procedure']` and went red at `['agent',
  //    'connector', 'procedure']`. The checker gained a THIRD corpus arm —
  //    `validateConnectorParameters` over `model/connectors.ts` — so an EMPTY
  //    corpus is now vacuous in three kinds rather than two. The assertion is
  //    still an exact `deepEqual` over a sorted list, so a fourth arm added
  //    without updating it goes red the same way; it was not softened to a
  //    length check or an `includes`.
  //
  //    ⚠️ AND A FOURTH ARM DID ARRIVE, ON 24 Aug 2026 — G206's classification
  //    validator — so this went red exactly as the note above predicts it
  //    should. It is changed to the new truth, still as an exact `deepEqual`
  //    over a sorted list.
  //
  //    ⚠️ AND A FIFTH, ON 4 Oct 2026 — G4202's document-type validator, the
  //    publication seam's — red first, then the new truth, still exact.
  assert.deepEqual(
    report.corpus.vacuous.sort(),
    ['agent', 'classification', 'connector', 'document_type', 'procedure'],
  )
})
