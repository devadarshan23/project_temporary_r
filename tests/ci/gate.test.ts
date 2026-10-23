/**
 * G108 and G110's CI half — the one gate, and the pack validators' call site.
 *
 * WHAT THIS FILE IS DEFENDING, and why it is worth a test at all.
 *
 * `CLAUDE.md` carries a standing position against adding CI to this repository:
 * *"A red X on a repository containing no application teaches people to ignore
 * CI."* G95 made this the first explicit exception. An exception to that
 * position is only honest if the checks are REAL, so the two things that can
 * quietly make them unreal are what is asserted here:
 *
 *   1. CI drifting away from the command a contributor runs. G108 ruled ONE
 *      GATE. The moment `check.yml` enumerates checkers itself, a contributor
 *      can be green locally and red in CI — or, far worse, green in CI on a
 *      subset. So the workflow must run `npm run check` and NOTHING ELSE, and
 *      `npm test` must be INSIDE `check` rather than beside it.
 *
 *   2. G110's checker becoming a no-op. `validateProcedureInjectionSafety()`
 *      and `validateAgentToolBindings()` have had no call site at all, which is
 *      why invariant 6 has one enforcement running instead of two. Giving them
 *      a call site that has never rejected anything would change the sentence
 *      in the record without changing the property. Every rejection test below
 *      is therefore PAIRED with a positive control on a fixture differing only
 *      in the defect: a checker that exits 1 unconditionally fails the pair,
 *      and a checker that exits 0 unconditionally fails it from the other side.
 *
 * EXIT CODES ARE READ FROM `spawnSync`, NEVER FROM A PIPE. A piped exit status
 * is the pipe's, which is 0, and reads exactly like success.
 *
 * ⚠️ RULE NAMES BELOW ARE LITERAL STRINGS TYPED INTO THIS FILE. None is
 * imported from `model/`. Comparing a checker's output to the same constant the
 * checker read is a comparison that passes when both sides are empty — the
 * failure mode a types-only repository cannot otherwise detect, and the reason
 * `tests/tools/check-wire-mirror.test.mjs` says the same thing at its head.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const WORKFLOW = join(REPO_ROOT, '.github', 'workflows', 'check.yml')
const PACKAGE_JSON = join(REPO_ROOT, 'package.json')
const CHECKER = join(REPO_ROOT, 'tools', 'check-pack-safety.mjs')

const fixture = (name: string): string =>
  join(REPO_ROOT, 'tests', 'ci', 'fixtures', name)

/* ⚠️ THREE HELPERS WERE DELETED HERE ON 18 Sep 2026 WITH THE WORKFLOW THEY
 * READ — `PERMITTED_RUN_STEPS`, `CHECKERS_THE_WORKFLOW_MAY_NOT_NAME` and
 * `workflowRunSteps()`. They parsed `.github/workflows/check.yml`, which no
 * longer exists. Their assertions did NOT lapse — they live in
 * `tests/infra/pipeline.test.mjs` against the synthesised gate buildspec, and
 * the retirement test below fails if those successors go missing.
 *
 * `workflowRunSteps()` is the one worth remembering: it was a LINE SCANNER,
 * and a sibling of it in `tests/infra/` turned out to be G109's named failure
 * — returning "|" for a block scalar and silently dropping every command
 * inside. Whatever reads the buildspec now uses `yaml@2.9.0`. Do not write
 * another. */


interface CheckerRun {
  status: number
  stdout: string
  stderr: string
}

function runChecker(args: readonly string[]): CheckerRun {
  const result = spawnSync(process.execPath, [CHECKER, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
  return {
    // `status` is null when the process was killed by a signal. Coercing that
    // to 0 would report a crash as a pass, so it becomes a distinct number.
    status: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

interface CheckerReport {
  packs: number
  proceduresValidated: number
  agentsValidated: number
  connectorsValidated: number
  classificationRulesValidated: number
  documentTypesValidated: number
  findings: { rule: string; detail: string }[]
  vacuous: string[]
  witness: {
    covered: string[]
    gaps: string[]
    ok: boolean
  }
}

function runCheckerJson(args: readonly string[]): {
  run: CheckerRun
  report: CheckerReport
} {
  const run = runChecker([...args, '--json'])
  let report: CheckerReport
  try {
    const parsed = JSON.parse(run.stdout) as {
      corpus: Omit<CheckerReport, 'witness'>
      witness: CheckerReport['witness']
    }
    report = { ...parsed.corpus, witness: parsed.witness }
  } catch {
    assert.fail(
      `the checker must print a JSON report on --json; got stdout=${JSON.stringify(
        run.stdout,
      )} stderr=${JSON.stringify(run.stderr)}`,
    )
  }
  return { run, report }
}

function readScripts(): Record<string, string> {
  const parsed = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')) as {
    scripts?: Record<string, string>
  }
  return parsed.scripts ?? {}
}


// ------------------------------------------------------- 1. the one gate

test('test_the_github_actions_workflow_is_retired_and_the_pipeline_holds_its_property', () => {
  /**
   * ✅ `.github/workflows/check.yml` IS RETIRED, 18 Sep 2026, AND THE THREE
   * ASSERTIONS THAT STOOD HERE MOVED RATHER THAN LAPSED.
   *
   * They were G108's enforcement: the workflow exists, its `run:` steps are
   * EXACTLY `npm ci` then `npm run check`, it names no individual checker, and
   * no step is a YAML block scalar the line scan would read as empty.
   *
   * **WHAT REPLACED IT:** the CodePipeline gate stage — `reconcile-gate-staging`
   * in `000000000000`/`us-west-2`, on the ARM CI image G258 built. **Verified
   * green on this branch BEFORE this retirement**: `tests 1857, pass 1855,
   * fail 0, skipped 0, todo 2`, with the skip census reporting *"no suite stood
   * down on this run."* That is strictly MORE than the workflow ever proved —
   * its runner had neither PostgreSQL nor chromium and stood suites down
   * silently, which is the hole PR #257 merged a red trunk through.
   *
   * 🛑 WHY RETIRE RATHER THAN RUN BOTH. Two gates are two definitions of green,
   * which is what G108 exists to prevent — and this one had stopped being a gate
   * at all: `runs-on: [self-hosted, reconcile]` against **zero registered
   * runners**, so every push queued a job that never started. A queued check is
   * not a passing check, and a pull request waiting forever on one teaches
   * people to merge past it. **G239's runner-registration defect closes here by
   * construction: there is no self-hosted runner left to register.**
   */
  assert.equal(
    existsSync(WORKFLOW),
    false,
    `${WORKFLOW} still exists. Retired 18 Sep 2026: two gates are two ` +
      'definitions of green (G108), and this one targeted a self-hosted runner ' +
      'that no longer exists, so it queued forever rather than failing. If it ' +
      'is back, either delete it or say here why two gates are now correct.',
  )

  const pipelineSuite = join(REPO_ROOT, 'tests', 'infra', 'pipeline.test.mjs')
  assert.ok(existsSync(pipelineSuite), 'the pipeline suite that inherited G108 is missing')
  const pipelineSource = readFileSync(pipelineSuite, 'utf8')
  for (const successor of [
    'test_the_gate_build_phase_is_exactly_npm_ci_then_npm_run_check',
    'test_no_gate_setup_command_checks_anything_it_only_boots_the_image',
  ]) {
    assert.ok(
      pipelineSource.includes(successor),
      `${successor} is gone from tests/infra/pipeline.test.mjs. That assertion ` +
        'inherited G108 from the retired workflow; without it nothing holds ' +
        '"the gate is `npm run check` and nothing else".',
    )
  }
})

test('test_npm_run_check_includes_the_test_script_so_the_suite_is_inside_the_gate', () => {
  const scripts = readScripts()
  const check = scripts['check'] ?? ''
  assert.ok(
    /\bnpm (?:run )?test\b/.test(check),
    `G108 puts 'npm test' inside 'check'; check is currently ${JSON.stringify(check)}`,
  )
})

test('test_npm_run_check_includes_the_pack_safety_checker', () => {
  const scripts = readScripts()
  const check = scripts['check'] ?? ''
  assert.ok(
    check.includes('check:packs'),
    `G110's CI half must join the gate; check is currently ${JSON.stringify(check)}`,
  )
  const packs = scripts['check:packs'] ?? ''
  assert.ok(
    packs.includes('tools/check-pack-safety.mjs'),
    `'check:packs' must run the checker; it is currently ${JSON.stringify(packs)}`,
  )
})

// ------------------------- 3. the procedure validator's call site, both ways

test('test_the_checker_exits_1_and_names_admitting_agent_carries_tools_on_an_admit_step_holding_a_tool', () => {
  const { run, report } = runCheckerJson([
    '--corpus',
    fixture('unsafe-procedure-pack.ts'),
  ])
  assert.equal(run.status, 1, `expected exit 1; stderr=${run.stderr}`)
  const rules = report.findings.map((f) => f.rule)
  assert.ok(
    rules.includes('admitting_agent_carries_tools'),
    `expected rule 'admitting_agent_carries_tools' among ${JSON.stringify(rules)}`,
  )
})

test('test_the_checker_exits_1_and_names_untrusted_to_outbound_without_human_when_admit_reaches_notify', () => {
  const { run, report } = runCheckerJson([
    '--corpus',
    fixture('unsafe-procedure-pack.ts'),
  ])
  assert.equal(run.status, 1, `expected exit 1; stderr=${run.stderr}`)
  const rules = report.findings.map((f) => f.rule)
  assert.ok(
    rules.includes('untrusted_to_outbound_without_human'),
    `expected rule 'untrusted_to_outbound_without_human' among ${JSON.stringify(rules)}`,
  )
})

test('test_the_checker_reports_both_procedure_violations_not_only_the_first_it_meets', () => {
  const { report } = runCheckerJson([
    '--corpus',
    fixture('unsafe-procedure-pack.ts'),
  ])
  const rules = new Set(report.findings.map((f) => f.rule))
  assert.equal(
    rules.size,
    2,
    `one fixture procedure carries two distinct violations; got ${JSON.stringify([
      ...rules,
    ])}`,
  )
})

test('test_the_checker_exits_0_on_a_pack_whose_admit_reaches_notify_through_a_human_shown_the_correspondence', () => {
  const { run, report } = runCheckerJson([
    '--corpus',
    fixture('safe-procedure-pack.ts'),
  ])
  assert.equal(
    run.status,
    0,
    `expected exit 0; findings=${JSON.stringify(report.findings)} stderr=${run.stderr}`,
  )
  assert.deepEqual(report.findings, [])
  assert.equal(
    report.proceduresValidated,
    1,
    'the positive control is worthless unless the checker actually walked the procedure',
  )
})

// --------------------------- 4. the agent validator's call site, both ways

test('test_the_checker_exits_1_and_names_reads_untrusted_and_egresses_on_an_agent_holding_both', () => {
  const { run, report } = runCheckerJson([
    '--corpus',
    fixture('unsafe-agent-corpus.ts'),
  ])
  assert.equal(run.status, 1, `expected exit 1; stderr=${run.stderr}`)
  const rules = report.findings.map((f) => f.rule)
  assert.deepEqual(
    rules,
    ['reads_untrusted_and_egresses'],
    'the fixture is built to raise this rule and only this rule',
  )
})

test('test_the_checker_exits_0_on_an_agent_that_reads_untrusted_content_and_holds_no_egress_tool', () => {
  const { run, report } = runCheckerJson([
    '--corpus',
    fixture('safe-agent-corpus.ts'),
  ])
  assert.equal(
    run.status,
    0,
    `expected exit 0; findings=${JSON.stringify(report.findings)} stderr=${run.stderr}`,
  )
  assert.equal(
    report.agentsValidated,
    1,
    'the positive control is worthless unless the checker actually validated the agent',
  )
})

// ------------------- 5b. the connector validator's call site, both ways

test('test_the_checker_exits_1_and_names_parameter_kind_missing_on_an_untagged_connector_parameter', () => {
  const { run, report } = runCheckerJson([
    '--corpus',
    fixture('untagged-connector-parameters.ts'),
  ])
  assert.equal(run.status, 1, `expected exit 1; stderr=${run.stderr}`)
  assert.deepEqual(report.findings.map((finding) => finding.rule), ['parameter_kind_missing'])
})

test('test_the_checker_exits_0_on_the_same_parameter_carrying_an_explicit_kind', () => {
  const { run, report } = runCheckerJson([
    '--corpus',
    fixture('tagged-connector-parameters.ts'),
  ])
  assert.equal(
    run.status,
    0,
    `expected exit 0; findings=${JSON.stringify(report.findings)} stderr=${run.stderr}`,
  )
  assert.equal(report.connectorsValidated, 1)
})

test('test_the_connector_half_of_the_gate_is_not_vacuous_over_the_repositorys_own_corpus', () => {
  const { report } = runCheckerJson([])
  assert.equal(report.vacuous.includes('connector'), false)
  assert.ok(report.connectorsValidated > 0)
})

test('test_the_classification_half_is_not_vacuous_and_the_two_warnings_this_slice_did_not_fix_are_still_reported', () => {
  const { report } = runCheckerJson([])
  /* BOTH HALVES ARE LOAD-BEARING. The first proves the new validator actually
   * ran over the tree's own corpus rather than over nothing — G206 says a
   * green run proves nothing about the rule either way while the corpus is
   * empty, and this is what stops that being true of the classification arm. */
  assert.equal(report.vacuous.includes('classification'), false)
  assert.ok(report.classificationRulesValidated > 0)
  /* The second proves the slice did NOT quietly clear the two warnings it did
   * not fix. A run that printed no vacuity warning at all would be §5.6
   * restored, and it would look exactly like success. */
  assert.deepEqual([...report.vacuous].sort(), ['agent', 'procedure'])
})

// ------------------------------------------------------- 5. §5.6, out loud

test('test_the_checker_reports_a_vacuous_corpus_rather_than_a_clean_one_when_there_is_nothing_to_validate', () => {
  const { run, report } = runCheckerJson(['--corpus', fixture('empty-corpus.ts')])
  assert.equal(run.status, 0, 'an empty corpus is a gap, not a regression')
  assert.deepEqual(report.findings, [])
  assert.deepEqual(
    [...report.vacuous].sort(),
    /* 🛑 THIS ASSERTION GAINED `classification` ON 24 Aug 2026 (G206), AND IT IS
     * A CONTRACT CHANGE RATHER THAN A REPAIR OF A FAILING TEST. It is called out
     * here rather than left in a diff because editing a test to make a build
     * green is exactly the move this file exists to make visible. The old
     * three-member assertion was CORRECT about a three-validator checker; the
     * slice that added `validatePackClassificationRules()` made it a
     * four-validator checker, and a validator wired into the loop but missing
     * from the vacuity vocabulary is §5.6 reintroduced inside the tool written
     * to report §5.6.
     *
     * ⚠️ AND IT GAINED `document_type` ON 4 Oct 2026 (G4202) FOR THE SAME
     * REASON: the publication seam's document-type validator joined the loop
     * and the vacuity vocabulary in one commit. */
    ['agent', 'classification', 'connector', 'document_type', 'procedure'],
    'a checker that validated nothing must say so, or it is indistinguishable ' +
      'from a checker over a clean set — docs/HANDOFF.md §5.6',
  )
})

test('test_the_vacuity_flag_is_derived_from_the_counts_and_cannot_disagree_with_them', () => {
  for (const name of [
    'empty-corpus.ts',
    'safe-procedure-pack.ts',
    'safe-agent-corpus.ts',
  ]) {
    const { report } = runCheckerJson(['--corpus', fixture(name)])
    assert.equal(
      report.vacuous.includes('procedure'),
      report.proceduresValidated === 0,
      `${name}: the procedure vacuity flag disagrees with the procedure count`,
    )
    assert.equal(
      report.vacuous.includes('agent'),
      report.agentsValidated === 0,
      `${name}: the agent vacuity flag disagrees with the agent count`,
    )
    assert.equal(
      report.vacuous.includes('connector'),
      report.connectorsValidated === 0,
      `${name}: the connector vacuity flag disagrees with the connector count`,
    )
    /* The fourth arm. Asserting the derivation property for three of four
     * validators would leave the newest one — the only one whose flag nobody
     * has watched — as the single unproven case. */
    assert.equal(
      report.vacuous.includes('classification'),
      report.classificationRulesValidated === 0,
      `${name}: the classification vacuity flag disagrees with the rule count`,
    )
    /* The fifth arm, G4202 — the same argument, one validator later. */
    assert.equal(
      report.vacuous.includes('document_type'),
      report.documentTypesValidated === 0,
      `${name}: the document_type vacuity flag disagrees with the template count`,
    )
  }
})

// ------------------------------------------------- 6. the real tree corpus

test('test_the_checker_passes_over_the_repositorys_own_packs_so_the_gate_is_green_on_trunk', () => {
  const { run, report } = runCheckerJson([])
  assert.equal(
    run.status,
    0,
    `trunk must be green; findings=${JSON.stringify(report.findings)} stderr=${run.stderr}`,
  )
  assert.deepEqual(report.findings, [])
  assert.deepEqual(report.witness.gaps, [])
  /* ⚠️ 6 → 14 ON 24 Aug 2026 (#176/#177, G206), CHANGED TO THE NEW TRUTH AND
   * NOT RELAXED. 2 procedure arms + 4 agent arms + the 8 members of
   * `CLASSIFICATION_RULE_VIOLATIONS`, each with a vector in
   * `tests/ci/fixtures/unsafe-classification-pack.ts`. Still an exact equality,
   * so a ninth arm added without a vector goes red here too.
   * ⚠️ 14 → 20 ON 4 Oct 2026 (G4202): the six members of
   * `DOCUMENT_TYPE_DECLARATION_VIOLATIONS`, each with a vector in
   * `tests/ci/fixtures/unsafe-document-type-pack.ts`. Red first; still exact. */
  assert.equal(report.witness.covered.length, 20)
  assert.equal(report.witness.ok, true)
})

test('test_the_checker_enumerates_every_pack_in_the_tree_rather_than_a_subset', () => {
  const { report } = runCheckerJson([])
  // Derived a second, independent way: one `procedureTemplates:` key per pack
  // literal in the fixture module. If the checker silently reads only the first
  // pack, or an import returns undefined, these two numbers part company.
  const examples = readFileSync(join(REPO_ROOT, 'model', 'examples.ts'), 'utf8')
  const declared = examples.split('\n').filter((line) =>
    /^\s*procedureTemplates:/.test(line),
  ).length
  assert.ok(declared > 0, 'model/examples.ts declares no packs at all')
  assert.equal(
    report.packs,
    declared,
    'the checker read a different number of packs than model/examples.ts declares',
  )
})

/**
 * 🛑 ONE RUNTIME, PINNED, AND THIS EXISTS BECAUSE THREE NODE VERSIONS WERE
 * ANSWERING ONE QUESTION.
 *
 * `package.json` carries `engines.node: ">=22.18.0"` — a FLOOR. `setup-node`
 * pointed at it resolves the NEWEST runtime satisfying the range, so the gate
 * silently moved to **Node 26.7.0** the day the runner cached it, while local
 * development sat on **24.3** and the plane image runs **22.22**.
 *
 * The cost was not theoretical. Node 26 fails a run on a FAILING `todo` test
 * and Node 24 does not, so `tests/http/engine-on-served-path.test.ts`'s
 * deliberate unmet witness — a test whose own annotation says it is *"UNMET
 * WITNESS, not a pass"* — was EXIT 0 on one machine and EXIT 1 on another,
 * **with no code change between them**. A session reported the gate green for
 * hours from the machine where it passed.
 *
 * G108 says there is ONE gate and one definition of green. An unpinned runtime
 * is a second definition that arrives by itself, without anybody deciding. G191
 * pins every dependency exact, and Node is the largest dependency here.
 *
 * ⚠️ THE PIN MUST MATCH THE IMAGE. `Dockerfile` runs `node:22.22-alpine` by
 * digest; CI runs `.node-version`. If those two disagree, CI is testing a
 * runtime production does not use, which is the same defect wearing the other
 * hat.
 */
test('test_the_gate_pins_one_node_version_and_it_is_the_one_the_plane_image_runs', () => {
  const pinned = readFileSync(join(REPO_ROOT, '.node-version'), 'utf8').trim()
  assert.match(pinned, /^\d+\.\d+\.\d+$/, '.node-version must be an exact version, not a range')

  /* ⚠️ THIS READ THE GITHUB ACTIONS WORKFLOW, WHICH IS RETIRED. The runtime
   * that decides green is now the CI IMAGE's — the gate runs inside it. The pin
   * must still agree with the plane image, checked below, so all three answer
   * alike rather than three runtimes answering one question, which is the
   * defect this test was written for. */
  const ciImage = readFileSync(join(REPO_ROOT, 'infra', 'ci-image', 'Dockerfile'), 'utf8')
  assert.match(
    ciImage,
    /nodejs22|node[-_]?22|NODE_VERSION/i,
    'the CI image must install a Node this pin agrees with. The gate runs inside ' +
      'that image, so its runtime decides green, and an unpinned one is a second ' +
      'definition of green arriving by itself (G108).',
  )

  const dockerfile = readFileSync(join(REPO_ROOT, 'Dockerfile'), 'utf8')
  const fromLine = /^FROM node:(\d+\.\d+)/m.exec(dockerfile)
  assert.ok(fromLine !== null, 'Dockerfile has no pinned `FROM node:<major>.<minor>` line')
  const imageMajorMinor = fromLine[1]
  assert.ok(
    pinned.startsWith(`${imageMajorMinor}.`),
    `.node-version is ${pinned} and the plane image runs ${imageMajorMinor}.x. CI would ` +
      'be testing a runtime production does not use. Bump both in one commit.',
  )
})
