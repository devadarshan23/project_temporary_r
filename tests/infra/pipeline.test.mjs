/**
 * The two properties of the pipeline that a reviewer cannot hold in their head:
 * that G252's ARM64 is true of EVERY CodeBuild project rather than of the ones
 * somebody remembered, and that G108's gate is still exactly two commands.
 *
 * 🛑 THE GATE ASSERTION IS THE ONE THAT MATTERS. `tests/ci/gate.test.ts` pins
 * `.github/workflows/check.yml` to `npm ci` then `npm run check` and fails if
 * that file ever grows a third `run:` step. G257 moves the gate to CodeBuild
 * and says in its own row that **G108 is not amended** — so the same pin has to
 * exist on the same side of the move, or the property survives the ruling and
 * not the migration. This file is that pin.
 *
 * ⚠️ THE COMMANDS ARE LITERAL STRINGS TYPED HERE, NOT IMPORTED. Reading the
 * expected commands out of `infra/lib/buildspecs.ts` and comparing them to the
 * buildspec generated from `infra/lib/buildspecs.ts` is a comparison that
 * cannot fail.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'

import { readFileSync } from 'node:fs'

import {
  REPO_ROOT,
  ensureDeps,
  resourcesOfType,
  runInfraScript,
  synthesisedTemplates,
} from './support.mjs'

await ensureDeps()

/**
 * ┌─ 🛑 TWO SYNTHS SINCE G1094, 20 Sep 2026, AND WHICH ONE AN ASSERTION ───────┐
 * │ READS IS ITSELF A DECISION.                                               │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * The pull-request gate is opt-in — `-c pullRequestGate=on` — because its
 * webhook cannot be created until a GitHub App permission exists, and one
 * resource that cannot be created rolled the whole pipeline stack back on
 * 20 Sep 2026, taking the Deploy stage's working frontend sync with it.
 *
 *   · `templates` turns the flag **ON**, and every assertion about how a gate
 *     is SHAPED reads it. A property of the pull-request gate is unassertable
 *     against a tree that does not contain one, and an opt-in resource nobody
 *     tests is an opt-in resource that will not work the day somebody opts in.
 *   · `defaultTemplates` is the tree a `cdk deploy` gets when nobody says
 *     anything, and §1a below is the only place that reads it — because the
 *     claim there is an ABSENCE, and an absence asserted against the tree that
 *     was configured to contain the thing would prove nothing.
 *
 * ⚠️ **NEITHER IS "the" TREE AND THE SUITE MUST NOT COLLAPSE THEM.** Reading
 * only the ON tree would let the off state ship a dormant project reporting
 * nothing to a merge button; reading only the OFF tree would let the gate itself
 * rot, unasserted, until the day it is switched on.
 */
const templates = synthesisedTemplates({ pullRequestGate: 'on' })
const defaultTemplates = synthesisedTemplates()

/** The two commands the gate stage is permitted to run, in order. */
const PERMITTED_GATE_COMMANDS = ['npm ci', 'npm run check']

/**
 * The commands in a buildspec's YAML, as a flat list in file order.
 *
 * A line scan rather than a YAML parse, for the same reason
 * `tests/ci/gate.test.ts` scans `run:` lines and `tools/check-wire-mirror.mjs`
 * scans the contracts: a YAML parser in `tests/` is a decision nobody has
 * taken. The scan is honest only if the buildspec stays in the narrow subset it
 * reads — `- <command>` entries under `commands:` — and the last assertion in
 * this file is what holds that.
 */
/**
 * 🛑 THIS WAS A HAND-ROLLED LINE SCANNER AND IT WAS G109's NAMED FAILURE,
 * CAUGHT BY A RED WITNESS RATHER THAN BY REVIEW. DO NOT PUT IT BACK.
 *
 * G109: *"do not hand-roll [a YAML parser] … a hand-parser that is subtly wrong
 * produces A CHECKER THAT PASSES WHILE ASSERTING NOTHING."*
 *
 * The scanner that stood here returned `"|"` for a block scalar and then
 * DROPPED EVERY COMMAND INSIDE IT — against the real gate buildspec it returned
 * five items and `reconcile-pg-start` was not among them, nor was the assertion
 * that refuses to run on the wrong image. A smuggled `npm run check` in
 * `pre_build` was therefore INVISIBLE to it, which is how the allow-list test
 * below passed against a deliberately poisoned buildspec on its first run.
 *
 * `yaml@2.9.0` is already a pinned runtime dependency (G191) and
 * `server/contract/document.ts` already parses all five contract tiers with it.
 * There was never a reason to scan lines here.
 */
function buildspecCommands(yaml) {
  const doc = parseYaml(yaml)
  const phases = doc?.phases ?? {}
  const out = []
  for (const phase of Object.values(phases)) {
    for (const command of phase?.commands ?? []) {
      out.push(String(command).trim())
    }
  }
  return out
}

/** The commands of ONE named phase, in order. */
function phaseCommands(yaml, phase) {
  return (parseYaml(yaml)?.phases?.[phase]?.commands ?? []).map((c) => String(c).trim())
}

function allCodeBuildProjects(from = templates) {
  const projects = []
  for (const [stackName, template] of Object.entries(from)) {
    for (const [logicalId, resource] of resourcesOfType(template, 'AWS::CodeBuild::Project')) {
      projects.push({ stackName, logicalId, resource })
    }
  }
  return projects
}

// ------------------------------------------------- 1a. G1094: OFF is TOTAL

/**
 * 🛑 THE OFF STATE IS AN ABSENCE AND AN ABSENCE IS WHAT A REVIEW MISSES, SO IT
 *    IS ASSERTED BY RESOURCE TYPE OVER EVERY STACK RATHER THAN BY NAME.
 *
 * **The failure this repository has already suffered is a check that reports
 * success while standing its suites down** — PR #257, whose own body records
 * `npm run check` EXIT 1 against a CI check reported SUCCESS. A pull-request
 * gate that EXISTS and never fires is that failure wearing a different hat:
 * from the merge button, a project that reported nothing and a project that
 * passed look identical. So `off` may not mean a disabled project, a project
 * with `webhook: false`, or a log group waiting for one — it means there is no
 * such resource anywhere in the app.
 */
test('test_with_the_flag_off_there_is_no_pull_request_gate_project_anywhere_at_all', () => {
  const found = allCodeBuildProjects(defaultTemplates).filter(({ logicalId, resource }) => {
    const name = String(resource.Properties?.Name ?? '')
    return logicalId.includes('GatePullRequest') || /reconcile-gate-pr-/.test(name)
  })
  assert.deepEqual(
    found.map(({ stackName, logicalId }) => `${stackName}/${logicalId}`),
    [],
    'the default synth carries a pull-request gate. G1094: with -c pullRequestGate ' +
      'absent there must be NO such project — not a disabled one and not one with ' +
      'webhook: false — because a gate that exists and never fires reads from the merge ' +
      'button exactly like a gate that passed, which is PR #257 in a new place.',
  )
})

test('test_with_the_flag_off_no_project_in_any_stack_is_webhook_triggered', () => {
  /* The property rather than the name (§5.1): a second webhook-triggered
   * project under any name at all would carry the same CreateWebhook call that
   * rolled the stack back, and would be invisible to the assertion above. */
  for (const { stackName, logicalId, resource } of allCodeBuildProjects(defaultTemplates)) {
    assert.notEqual(
      resource.Properties?.Triggers?.Webhook,
      true,
      `${stackName}/${logicalId} asks CodeBuild to create a webhook with the flag off. ` +
        'That call is what failed CREATE on 20 Sep 2026 — "Access denied to connection" ' +
        '— and rolled the whole pipeline stack back, taking the Deploy stage with it.',
    )
  }
})

test('test_with_the_flag_off_no_log_group_is_left_behind_waiting_for_the_project', () => {
  /* A log group with no project is the "off but not absent" shape one layer
   * down, and it is what an implementation that evaluated the props object
   * before choosing would have produced. */
  for (const [stackName, template] of Object.entries(defaultTemplates)) {
    for (const [logicalId] of resourcesOfType(template, 'AWS::Logs::LogGroup')) {
      assert.ok(
        !logicalId.includes('GatePullRequest'),
        `${stackName}/${logicalId} is the pull-request gate's log group and there is no ` +
          'pull-request gate. Construct nothing when the flag is off.',
      )
    }
  }
})

test('test_the_stack_announces_the_pull_request_gate_state_in_both_directions', () => {
  /**
   * 🛑 LOUD, NOT ONLY TOTAL. An absence nobody is told about has to be
   * DISCOVERED, and the person who would discover it is the person merging.
   * The output puts the state, the flag and the human blocker on the deploy's
   * own output and on the console's Outputs tab.
   *
   * ⚠️ IT IS ASSERTED IN BOTH STATES so the announcement cannot drift from the
   * resource: an ON stack claiming OFF is as bad as a silent one.
   */
  const outputOf = (from) => {
    const [, stack] = Object.entries(from).find(([name]) => name.includes('pipeline')) ?? []
    assert.ok(stack, 'no pipeline stack in the synthesised app')
    const output = stack.Outputs?.PullRequestGate
    assert.ok(output, `the pipeline stack publishes no PullRequestGate output: ${
      JSON.stringify(Object.keys(stack.Outputs ?? {}))
    }`)
    return String(output.Value)
  }

  const off = outputOf(defaultTemplates)
  assert.match(off, /^OFF/, `the default stack announces ${JSON.stringify(off)}`)
  assert.match(
    off,
    /pullRequestGate=on/,
    'the OFF announcement must name the flag that turns it on, or it is a status ' +
      'without a remedy',
  )
  assert.match(
    off,
    /webhook/i,
    'the OFF announcement must name the GitHub App permission the ON state needs, or ' +
      'the next operator rediscovers the rollback rather than reading about it',
  )

  const on = outputOf(templates)
  assert.match(on, /^ON/, `the flagged-on stack announces ${JSON.stringify(on)}`)
})

test('test_a_misspelt_flag_value_fails_synth_rather_than_quietly_selecting_off', () => {
  /**
   * 🛑 THE FLAG'S OWN §5.6. Two of the three states this flag can be in are
   * *off*, and one of them is *"I thought I turned it on"*. `-c
   * pullRequestGate=ture` selecting the safe-LOOKING state is a flag nobody can
   * trust they have set, on a control whose whole subject is a check that
   * reports one thing while doing another.
   *
   * Witnessed at synth rather than against the exported predicate, because a
   * `cdk deploy` is where somebody types it.
   */
  const run = runInfraScript('test-fixtures/templates.ts', {
    CDK_CONTEXT_JSON: JSON.stringify({
      planeImageTag: 'synth-only-not-a-deployable-tag',
      pullRequestGate: 'ture',
    }),
  })
  assert.notEqual(
    run.status,
    0,
    `'ture' synthesised successfully, which means it was read as OFF: ${run.stdout.slice(0, 200)}`,
  )
  const message = `${run.stdout}${run.stderr}`
  assert.ok(
    message.includes('pullRequestGate'),
    `the refusal must name the flag: ${message.slice(0, 400)}`,
  )
  for (const spelling of ["'on'", "'off'"]) {
    assert.ok(
      message.includes(spelling),
      `the refusal must name ${spelling}, or a reader learns the value is wrong and not ` +
        `what the right ones are: ${message.slice(0, 400)}`,
    )
  }
})

// --------------------------------------------------------------- 1. G252

test('test_every_codebuild_project_in_every_stack_is_an_arm_container', () => {
  const projects = allCodeBuildProjects()
  assert.ok(
    projects.length >= 3,
    `expected the gate, the build and the CI image project; found ${projects.length}`,
  )
  for (const { stackName, logicalId, resource } of projects) {
    assert.equal(
      resource.Properties?.Environment?.Type,
      'ARM_CONTAINER',
      `${stackName}/${logicalId} is not ARM_CONTAINER; G252 pins ARM64 everywhere`,
    )
  }
})

test('test_every_docker_build_command_in_every_buildspec_declares_the_linux_arm64_platform', () => {
  for (const { stackName, logicalId, resource } of allCodeBuildProjects()) {
    const yaml = resource.Properties?.Source?.BuildSpec
    if (typeof yaml !== 'string') continue
    for (const command of buildspecCommands(yaml)) {
      if (!/^docker build\b/.test(command)) continue
      assert.match(
        command,
        /--platform linux\/arm64/,
        `${stackName}/${logicalId} runs a docker build with no --platform; ` +
          'G252 says a bare FROM resolves to the BUILDER architecture',
      )
    }
  }
})

// --------------------------------------------------------------- 2. G108

/**
 * 🛑 THIS ASSERTION WENT RED WHEN THE TWO BUILDSPEC SPELLINGS WERE RECONCILED,
 * AND IT IS STRONGER AFTERWARDS RATHER THAN WEAKER. READ THE ARGUMENT BEFORE
 * LOOSENING IT FURTHER.
 *
 * It used to flatten EVERY phase's commands and demand the list equal exactly
 * `npm ci` + `npm run check`. That passed against a gate buildspec which also
 * did not set `CI`, and a gate that does not set `CI` is the hole PR #257
 * merged a red trunk through: `tests/reachability.ts`'s guards SKIP instead of
 * failing, and the run reports `success` over seven unreachable databases and
 * no chromium. The buildspec that sets `CI` also boots the image's PostgreSQL,
 * which the flat reading counted as a third gate command.
 *
 * THE DISTINCTION THE RULINGS ACTUALLY DRAW, and it is not the phase names:
 *
 *   · G108 governs what constitutes GREEN. `npm run check` is the gate, whole,
 *     and a contributor runs the same command. Nothing may CHECK anything
 *     outside it.
 *   · `docs/runner-image-provisioning.md` governs what the MACHINE carries, and
 *     refuses `services: postgres` and `npx playwright install` as substitutes
 *     for a provisioned image — *"the fix is the image, not the workflow"*.
 *
 * Starting a server the image already carries is neither. A container cannot
 * have a daemon running before it starts, so SOMETHING must start it, and the
 * thing that starts it is the image's own tool. What must not happen is a CHECK
 * smuggled into a setup phase where nobody reads it as part of the gate.
 *
 * So: the BUILD phase is exactly the two commands, and every setup command is
 * drawn from a CLOSED allow-list. A fourth setup command fails this test, and
 * anything resembling a check fails it twice.
 */
const PERMITTED_SETUP_COMMANDS = [
  'node --version',
  'npm --version',
  'reconcile-pg-start',
]

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * 🛑 G996, 20 Sep 2026 — EVERY ASSERTION BELOW USED TO READ **ONE** PROJECT,
 *    FOUND WITH `.find()`, AND `.find()` RETURNS THE FIRST.
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * That was correct while there was exactly one project running `npm run check`
 * and it stopped being correct the moment G995 added a second — a pull-request
 * gate. **A second project carrying a DIFFERENT buildspec would have been
 * invisible to every one of these tests**: the first match would have satisfied
 * them and the pull request would have been answering a different question from
 * the trunk, which is precisely the *"two definitions of green"* G108 exists to
 * forbid and which `tests/ci/gate.test.ts` gives as the reason the GitHub
 * Actions workflow was retired rather than run beside the pipeline.
 *
 * **Witnessed RED before this was written**, not reasoned: with the assertions
 * still keyed on `.find()` and the pull-request project given
 * `PLANE_BUILD_BUILDSPEC_YAML` instead of `GATE_BUILDSPEC_YAML`, all six gate
 * assertions stayed GREEN while the deployed pull-request gate ran `docker
 * build`, `npm audit` and a push to ECR.
 *
 * 🛑 AND THE SET IS DERIVED FROM THE PROPERTY, NOT FROM THE NAME. A third
 * project called something else that runs `npm run check` is a third gate
 * whatever it is called — `docs/HANDOFF.md` §5.1 is *"a rule keyed on a
 * convenient landmark instead of the property it protects"*, and a
 * `/reconcile-gate-/` regex is exactly that landmark. So a gate project here is
 * one whose buildspec RUNS THE GATE COMMAND, and the two names are asserted
 * separately, as a FLOOR, so that the derivation cannot quietly return an empty
 * set and pass everything.
 */
function gateProjects() {
  const found = allCodeBuildProjects().filter(({ resource }) => {
    const yaml = resource.Properties?.Source?.BuildSpec
    if (typeof yaml !== 'string') return false
    return phaseCommands(yaml, 'build').includes('npm run check')
  })
  assert.ok(
    found.length >= 2,
    `only ${found.length} project(s) run \`npm run check\`. Since G995 there are ` +
      'TWO — the post-merge pipeline gate and the pull-request gate — and a ' +
      'derivation that finds fewer is reading the wrong property, not describing ' +
      'a smaller tree. ⚠️ SINCE G1094 THIS READS THE FLAGGED-ON SYNTH: the ' +
      'pull-request gate is opt-in and the DEFAULT tree holds one gate, which §1a ' +
      'above asserts separately. If this line goes red, the second gate is broken ' +
      'rather than absent.',
  )
  return found
}

test('test_both_gate_projects_are_found_by_name_as_well_so_the_derivation_above_cannot_go_vacuous', () => {
  const names = gateProjects().map(({ resource }) => String(resource.Properties?.Name ?? ''))
  for (const expected of ['reconcile-gate-staging', 'reconcile-gate-pr-staging']) {
    assert.ok(
      names.includes(expected),
      `${expected} does not run \`npm run check\`. Found: ${JSON.stringify(names)}. ` +
        'The name list is a FLOOR and not the definition — a fourth gate is ' +
        'covered by the property above whatever it is called — but a named floor ' +
        'is what stops the property returning a set these assertions pass over ' +
        'trivially.',
    )
  }
})

test('test_the_two_gates_carry_the_byte_identical_buildspec_so_a_pull_request_and_a_merge_ask_one_question', () => {
  /**
   * 🛑 THE ASSERTION G995 TURNS ON. Everything else in this section checks that
   * each gate is INDIVIDUALLY well formed; this checks that they are THE SAME
   * GATE. Two projects that each run two permitted commands could still run
   * two different buildspecs — a different image assertion, a database not
   * started, a `CI` set in one `env:` block and not the other — and every other
   * assertion here would pass.
   *
   * `infra/lib/pipeline-stack.ts` attaches `GATE_BUILDSPEC_YAML` to both, from
   * ONE variable read from ONE committed file. This is that sharing observed on
   * the synthesised templates rather than trusted from the generator.
   */
  const specs = gateProjects().map(({ stackName, logicalId, resource }) => ({
    where: `${stackName}/${logicalId}`,
    yaml: resource.Properties.Source.BuildSpec,
  }))
  const first = specs[0]
  for (const other of specs.slice(1)) {
    assert.equal(
      other.yaml,
      first.yaml,
      `${other.where} and ${first.where} both run \`npm run check\` and carry ` +
        'DIFFERENT buildspecs. G108 rules ONE gate: a pull request and a merge ' +
        'must answer the same question, or a contributor is green on one and red ' +
        'on the other with nothing in the tree to explain it. Both are attached ' +
        'from GATE_BUILDSPEC_YAML in infra/lib/buildspecs.ts; if a second ' +
        'spelling is genuinely wanted, that is a ruling and not a test edit.',
    )
  }
})

test('test_the_gate_build_phase_is_exactly_npm_ci_then_npm_run_check', () => {
  for (const gate of gateProjects()) {
    const yaml = gate.resource.Properties?.Source?.BuildSpec
    assert.equal(typeof yaml, 'string', 'the gate buildspec must be inline text')

    const commands = phaseCommands(yaml, 'build')

    assert.deepEqual(
      commands,
      PERMITTED_GATE_COMMANDS,
      `${gate.stackName}/${gate.logicalId}: G108 — the gate stage is ` +
        '`npm run check` and nothing else. Build, migrate and deploy are ' +
        'SEPARATE STAGES, never steps inside the gate.',
    )
  }
})

test('test_no_gate_setup_command_checks_anything_it_only_boots_the_image', () => {
  for (const gate of gateProjects()) {
    const yaml = gate.resource.Properties.Source.BuildSpec

    // Every command outside the build phase, in order.
    const all = buildspecCommands(yaml)
    const setup = all.slice(0, all.indexOf('npm ci'))

    for (const command of setup) {
      // A multi-line shell block is the one shape that could hide anything, so
      // it is judged by what it CONTAINS rather than by its first token.
      assert.doesNotMatch(
        command,
        /npm run|npm test|node --test|\bcheck\b(?!ing)/,
        `${gate.stackName}/${gate.logicalId}: a setup phase command runs ` +
          `something check-shaped: ${JSON.stringify(command.slice(0, 80))}. ` +
          'G108 — the gate is `npm run check`, and nothing may check anything ' +
          'beside it. If this is genuinely image boot rather than a check, add ' +
          'it to PERMITTED_SETUP_COMMANDS and say why in this file.',
      )
      const isBlock = command.includes('\n') || command === '|'
      const permitted =
        PERMITTED_SETUP_COMMANDS.includes(command) ||
        isBlock ||
        /^ls -d /.test(command) ||
        /^if ! command -v/.test(command)
      assert.ok(
        permitted,
        `${gate.stackName}/${gate.logicalId}: unrecognised gate setup command ` +
          `${JSON.stringify(command.slice(0, 80))}. The allow-list is closed on ` +
          'purpose: it is what stops a check being added to pre_build where ' +
          'nobody reads it as part of the gate.',
      )
    }
  }
})

test('test_the_gate_buildspec_carries_the_do_not_add_a_step_here_sentence_into_the_deployed_artefact', () => {
  for (const gate of gateProjects()) {
    assert.match(
      gate.resource.Properties.Source.BuildSpec,
      /DO NOT ADD A STEP HERE/,
      `${gate.stackName}/${gate.logicalId}: the rule must reach the person ` +
        'editing the buildspec in the console, not only the person editing the ' +
        'generator',
    )
  }
})

test('test_the_gate_project_is_not_privileged_because_a_gate_that_holds_the_docker_daemon_could_push_an_image', () => {
  for (const gate of gateProjects()) {
    assert.notEqual(
      gate.resource.Properties?.Environment?.PrivilegedMode,
      true,
      `${gate.stackName}/${gate.logicalId} holds the Docker daemon. A gate that ` +
        'can build an image can push one.',
    )
  }
})

test('test_the_gate_project_sets_ci_so_the_reachability_guards_cost_an_exit_code_rather_than_a_skip', () => {
  /**
   * ⚠️ AND IT IS ASSERTED ON **EVERY** GATE PROJECT SINCE G995, WHICH IS THE
   * ASSERTION THE PULL-REQUEST GATE NEEDED MOST. A PR gate without `CI` is the
   * 17 Aug 2026 hole rebuilt in a new place: a green check standing eleven
   * database-dependent suites and nine browser-dependent ones down in silence,
   * on the surface a reviewer trusts BEFORE the merge rather than after it.
   *
   * ⚠️ THE TWO SPELLINGS ARE BOTH LIVE AND NEITHER IS WRONG, WHICH IS WHY THIS
   * ASSERTS PRESENCE RATHER THAN A LITERAL. The projects set `CI = "1"`;
   * `infra/ci-image/buildspec-gate.yml`'s own `env: variables:` block sets
   * `CI: "true"` and, at run time, a buildspec variable wins over a project
   * one. `tests/reachability.ts` reads `process.env['CI'] === undefined`, so
   * both arm the guards — and an assertion demanding one literal here would go
   * red against a working gate.
   */
  for (const gate of gateProjects()) {
    const vars = gate.resource.Properties?.Environment?.EnvironmentVariables ?? []
    const ci = vars.find((v) => v.Name === 'CI')
    assert.ok(
      ci !== undefined,
      `${gate.stackName}/${gate.logicalId} does not set CI. CodeBuild does not ` +
        'set it of its own accord. Without it databaseRequiredUnderCi() and ' +
        'browserRequiredUnderCi() SKIP, which is how PR #257 merged a red trunk.',
    )
    assert.notEqual(String(ci.Value), '')
  }
})

/**
 * 🛑 G995's OTHER HALF: THE PULL-REQUEST GATE MUST BE A GATE AND NOTHING MORE.
 *
 * The pipeline's Build, Migrate and Deploy stages push an image to ECR and
 * update a live ECS service. A pull request is code somebody else wrote, so the
 * ONE thing that must never be true of a webhook-triggered project is that it
 * can do any of that. Three properties, each asserted rather than reasoned:
 * it is triggered by pull-request events ONLY (a `PUSH` filter would run a
 * second, competing gate on every merge to `main`); its buildspec contains no
 * deployment verb; and its role — which is a CodeBuild project role and
 * therefore a real principal — holds no `ecs:`, no `s3:` and no `cloudfront:`
 * statement at all.
 */
test('test_the_pull_request_gate_is_triggered_by_pull_requests_only_and_never_by_a_push', () => {
  const pr = allCodeBuildProjects().find(({ resource }) =>
    /reconcile-gate-pr-/.test(JSON.stringify(resource.Properties?.Name ?? '')),
  )
  assert.ok(pr !== undefined, 'no pull-request gate project found in any synthesised stack')

  const triggers = pr.resource.Properties?.Triggers
  assert.equal(triggers?.Webhook, true, 'the pull-request gate has no webhook, so nothing runs it')

  const patterns = (triggers?.FilterGroups ?? [])
    .flat()
    .filter((f) => f?.Type === 'EVENT')
    .map((f) => String(f.Pattern))
  assert.ok(patterns.length > 0, 'the webhook has no EVENT filter, so it fires on everything')
  for (const pattern of patterns) {
    for (const event of pattern.split(',').map((e) => e.trim())) {
      assert.match(
        event,
        /^PULL_REQUEST_/,
        `the pull-request gate fires on ${event}. A PUSH filter would run a ` +
          'second gate on every merge to `main`, beside the pipeline\'s own — ' +
          'two runs and two verdicts for one commit, which is the shape G108 ' +
          'forbids. Prod promotion and deployment are the PIPELINE\'s stages.',
      )
    }
  }
})

test('test_the_pull_request_gate_role_can_deploy_nothing_because_it_runs_a_strangers_branch', () => {
  const pr = allCodeBuildProjects().find(({ resource }) =>
    /reconcile-gate-pr-/.test(JSON.stringify(resource.Properties?.Name ?? '')),
  )
  assert.ok(pr !== undefined)

  /* The project's role, found through the template rather than through the
   * construct: a policy attached by any means at all is what matters here. */
  const template = templates[pr.stackName]
  const roleRef = pr.resource.Properties?.ServiceRole
  const roleLogicalId = roleRef?.['Fn::GetAtt']?.[0]
  assert.ok(
    typeof roleLogicalId === 'string',
    `the pull-request gate's ServiceRole is ${JSON.stringify(roleRef)}, which this ` +
      'assertion cannot resolve — so it would read no policies and pass vacuously',
  )

  /**
   * ⚠️ `ecr:` IS NOT BANNED WHOLESALE AND THE DISTINCTION IS THE WHOLE POINT OF
   * THIS LIST. The gate RUNS IN G258's image, so its role legitimately holds
   * the pull verbs `LinuxArmBuildImage.fromEcrRepository()` grants — a ban on
   * `ecr:` would be red against a correct project, and a test that is red
   * against the design is one somebody deletes. What must never appear is a
   * verb that CHANGES something outside this build: a push, a service update,
   * a bucket write, a cache invalidation.
   */
  const FORBIDDEN = [
    /^ecs:/,
    /^cloudfront:/,
    /^ecr:(PutImage|InitiateLayerUpload|UploadLayerPart|CompleteLayerUpload|BatchDeleteImage|PutImageTagMutability|DeleteRepository)/,
    /^s3:(PutObject|DeleteObject|PutBucket|DeleteBucket)/,
    /^iam:PassRole/,
    /^cloudformation:/,
  ]

  let inspected = 0
  for (const [logicalId, resource] of resourcesOfType(template, 'AWS::IAM::Policy')) {
    const roles = (resource.Properties?.Roles ?? []).map((r) => JSON.stringify(r))
    if (!roles.some((r) => r.includes(roleLogicalId))) continue
    inspected += 1
    for (const statement of resource.Properties?.PolicyDocument?.Statement ?? []) {
      for (const action of [statement.Action ?? []].flat()) {
        if (typeof action !== 'string') continue
        for (const forbidden of FORBIDDEN) {
          assert.doesNotMatch(
            action,
            forbidden,
            `${logicalId} grants ${action} to the PULL-REQUEST gate. That project ` +
              'runs code from a branch nobody has reviewed; the gate needs a ' +
              'clone, a machine, an image to run in and a log group, and nothing ' +
              'that CHANGES a registry, a bucket, a distribution, a service or a ' +
              'stack. If a gate genuinely needs one of these, it is a ruling.',
          )
        }
      }
    }
  }
  assert.ok(
    inspected > 0,
    'no policy was found for the pull-request gate role at all; CodeBuild always ' +
      'attaches at least a logs policy, so this assertion read nothing',
  )
})

// --------------------------------------------------- 3. the stage boundary

/** The one pipeline, as CloudFormation renders it. */
function thePipeline() {
  const pipelines = []
  for (const template of Object.values(templates)) {
    pipelines.push(...resourcesOfType(template, 'AWS::CodePipeline::Pipeline'))
  }
  assert.equal(pipelines.length, 1, 'this pass builds the staging pipeline and only that one')
  return pipelines[0][1]
}

const stageNames = () => thePipeline().Properties.Stages.map((s) => s.Name)

/**
 * 🛑 THIS ASSERTION WAS `['Source', 'Gate', 'Build']` AND IT WENT RED WHEN THE
 * MIGRATE AND DEPLOY STAGES LANDED, WHICH IS WHAT IT WAS FOR. Its own message
 * said *"if they have landed, this assertion is updated deliberately rather than
 * relaxed"*, and this is that update — the list is longer and it is still a
 * `deepEqual` on the WHOLE list in ORDER, so a sixth stage, a reorder, or a
 * Migrate that slid behind Deploy each fail here.
 */
test('test_the_pipeline_stages_are_source_gate_build_migrate_deploy_in_exactly_that_order', () => {
  assert.deepEqual(
    stageNames(),
    ['Source', 'Gate', 'Build', 'Migrate', 'Deploy'],
    'docs/tech-stack.md 9.1. A new stage is added to this list deliberately, ' +
      'never by relaxing the comparison.',
  )

  const gateStage = thePipeline().Properties.Stages.find((s) => s.Name === 'Gate')
  assert.equal(
    gateStage.Actions.length,
    1,
    'a second action in the Gate stage is the thing G108 forbids; add a STAGE instead',
  )
})

/**
 * 🛑 THE ORDER IS THE SAFETY PROPERTY, SO IT IS ASSERTED ON ITS OWN AS WELL AS
 * INSIDE THE LIST ABOVE.
 *
 * A Deploy that ran before Migrate would start the new code against the old
 * schema, and it would do so GREEN — both stages would succeed. CodePipeline
 * runs stages strictly in array order and does not enter a stage behind a failed
 * one, so position in this array IS the guarantee; nothing else expresses it.
 */
test('test_migrate_precedes_deploy_so_new_code_never_starts_against_an_old_schema', () => {
  const names = stageNames()
  const migrate = names.indexOf('Migrate')
  const deploy = names.indexOf('Deploy')
  assert.notEqual(migrate, -1, 'there is no Migrate stage')
  assert.notEqual(deploy, -1, 'there is no Deploy stage')
  assert.ok(
    migrate < deploy,
    `Migrate is at ${migrate} and Deploy at ${deploy}. docs/tech-stack.md 9.1 ` +
      'puts the run-tasks BEFORE the services deploy, and a deploy in front of a ' +
      'migration is green while being wrong.',
  )
  assert.ok(
    names.indexOf('Build') < migrate,
    'Migrate consumes the Build stage artefact; it cannot precede it',
  )
})

/**
 * G257 — *"`main` → staging on merge"*, ruled with no approval step. An approval
 * action is a decision nobody took, and it is the single easiest thing to add to
 * a pipeline "just for safety". Prod promotion is a SECOND pipeline that does
 * not exist.
 */
test('test_no_manual_approval_action_stands_between_a_green_gate_and_a_staging_deploy', () => {
  for (const stage of thePipeline().Properties.Stages) {
    for (const action of stage.Actions) {
      assert.notEqual(
        action.ActionTypeId?.Category,
        'Approval',
        `${stage.Name}/${action.Name} is an approval action. G257 auto-deploys ` +
          'staging; if this is wanted, it is a ruling, not a test edit.',
      )
    }
  }
})

/**
 * 🛑 G108, FROM THE OTHER DIRECTION. The gate test above proves the Gate stage
 * runs two commands; this proves that the four things G257 lists as SEPARATE
 * STAGES really are separate — that nobody satisfied "add a migrate step" by
 * putting `aws ecs run-task` into the gate's buildspec.
 */
test('test_the_gate_buildspec_contains_no_deployment_command_of_any_kind', () => {
  const gate = allCodeBuildProjects().find(({ resource }) =>
    /reconcile-gate-/.test(JSON.stringify(resource.Properties?.Name ?? '')),
  )
  assert.ok(gate !== undefined)
  const yaml = executableLines(gate.resource.Properties.Source.BuildSpec)
  for (const forbidden of ['ecs run-task', 'ecs update-service', 'register-task-definition']) {
    assert.ok(
      !yaml.includes(forbidden),
      `the gate buildspec contains ${JSON.stringify(forbidden)}. G108 is not ` +
        'amended by G257: migrate and deploy are SEPARATE STAGES, never steps ' +
        'inside the gate.',
    )
  }
})

// ------------------------------------------ 3a. Migrate and Deploy (G253, G262)

/**
 * A buildspec's EXECUTABLE text: every line whose first non-space character is
 * `#` removed, YAML comment and shell comment alike.
 *
 * 🛑 THIS EXISTS BECAUSE THE ABSENCE ASSERTION BELOW WENT RED ON A COMMENT
 * SAYING THE RIGHT THING. `MIGRATE_BUILDSPEC_YAML`'s header states, correctly,
 * that `CODEBUILD_RESOLVED_SOURCE_VERSION is never read` — and a plain
 * `includes()` over the whole document read that sentence as the defect it
 * forbids. `tests/infra/manifest.test.mjs` records the identical lesson about
 * its own lookup scan — *"over source with comments stripped, because the first
 * version of that scan fired on its own prose"*.
 *
 * ⚠️ IT IS ONLY EVER USED FOR **ABSENCE** ASSERTIONS, and that asymmetry is
 * deliberate: a comment cannot execute, so stripping comments can only make an
 * absence claim STRONGER. Every PRESENCE assertion in this file still reads the
 * whole document, where a command hidden in a comment would be a missing
 * command rather than a passing test.
 */
function executableLines(yaml) {
  return yaml
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n')
}

function projectNamed(fragment) {
  const found = allCodeBuildProjects().find(({ resource }) =>
    new RegExp(fragment).test(JSON.stringify(resource.Properties?.Name ?? '')),
  )
  assert.ok(found !== undefined, `no CodeBuild project matching ${fragment}`)
  return found
}

/**
 * 🛑 G262: BY DIGEST, NOT BY TAG — ASSERTED IN BOTH DIRECTIONS, BECAUSE ONLY ONE
 * OF THEM IS THE PROPERTY.
 *
 * That the buildspec mentions `image-digest.txt` proves it reads something; it
 * does not prove it stopped reading a tag. So the second half asserts the
 * ABSENCE of the tag spellings — `$CODEBUILD_RESOLVED_SOURCE_VERSION`, which is
 * how the Build stage tags the push, and any `:latest` — and the presence of the
 * `@` digest form in the image reference the stage composes.
 *
 * ┌─ 🛑 THIS LOOP COVERED **BOTH** STAGES UNTIL 23 Sep 2026 AND NOW COVERS THE ─┐
 * │ MIGRATE STAGE ALONE — G2046. THE DEPLOY ARM IS NOT DELETED, IT IS MOVED     │
 * │ AND STRENGTHENED AT §8c BELOW, AND THE RED IT PRODUCED IS QUOTED HERE       │
 * │ RATHER THAN NARRATED:                                                       │
 * │                                                                             │
 * │   ✖ test_the_deploy_stage_names_the_image_by_digest_and_never_by_a_tag     │
 * │     AssertionError: the deploy stage must compose repository@sha256:… —    │
 * │     the @ IS the ruling                                                     │
 * │                                                                             │
 * │ **The Deploy stage now writes a TAG, into CloudFormation's own template**   │
 * │ (G2041, the owner's ruling that the pipeline writes the stack value), for   │
 * │ the reason `buildspecs.ts` argues at length: a stack's idea of the image    │
 * │ can only live in its template, and a DIGEST there makes every later         │
 * │ `cdk diff` permanently dirty — which spends G1012's other half.             │
 * │                                                                             │
 * │ ⚠️ **G262 IS NOT WEAKENED AND §8c IS WHY.** *"A commit sha names a commit,  │
 * │ not bytes"* is answered by making the REGISTRY say, at the moment of use,   │
 * │ that this sha names these bytes — `ecr describe-images --image-ids          │
 * │ imageTag=$TAG` compared against `image-digest.txt`, FATAL on a mismatch.    │
 * │ That is strictly stronger than the ECR-immutability assumption this stage   │
 * │ previously relied on, and the MIGRATE stage's arm below is untouched.       │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */
for (const [label, fragment] of [['migrate', 'reconcile-migrate-']]) {
  test(`test_the_${label}_stage_names_the_image_by_digest_and_never_by_a_tag`, () => {
    const yaml = projectNamed(fragment).resource.Properties.Source.BuildSpec
    assert.match(
      yaml,
      /image-digest\.txt/,
      `the ${label} stage must consume the digest the Build stage resolved from the registry`,
    )
    assert.match(
      yaml,
      /PLANE_REPOSITORY_NAME@\$DIGEST/,
      `the ${label} stage must compose repository@sha256:… — the @ IS the ruling`,
    )
    const executable = executableLines(yaml)
    assert.ok(
      !executable.includes('CODEBUILD_RESOLVED_SOURCE_VERSION'),
      `the ${label} stage reads the commit sha. That is the TAG the Build stage ` +
        'pushed, and G262 says the image is referenced onward by DIGEST. A commit ' +
        'sha names a commit, not bytes.',
    )
    assert.ok(!executable.includes(':latest'), `the ${label} stage names a moving tag`)
    assert.match(
      yaml,
      /case "\$DIGEST" in\s*\n\s*sha256:\*\)/,
      `the ${label} stage must refuse an image-digest.txt that is not a sha256 digest`,
    )
  })
}

/**
 * 🛑 THE THREE WAYS A MIGRATION FAILS WITHOUT FAILING, EACH ASSERTED SEPARATELY.
 * Only the first is obvious, and a stage that handles only the first is green
 * over an unmigrated database — which the Deploy stage behind it then deploys
 * code against.
 */
test('test_a_failed_migration_stops_the_pipeline_in_all_three_of_the_ways_it_can_fail', () => {
  const yaml = projectNamed('reconcile-migrate-').resource.Properties.Source.BuildSpec

  // 1 · the container ran and exited non-zero.
  assert.match(
    yaml,
    /c\.exitCode!==0/,
    'nothing reads the container exit code, so a failed migration is a green stage',
  )
  // 2 · the container never ran: exitCode is null, and `--output text` prints
  //     that as the word `None`.
  assert.match(
    yaml,
    /typeof c\.exitCode!=="number"/,
    'a null exit code must fail. A missing exit code is not a zero exit code.',
  )
  // 3 · `ecs run-task` returned `{tasks: [], failures: [...]}` and exited 0.
  assert.match(
    yaml,
    /r\.failures/,
    'ecs run-task exits 0 when it starts nothing; the failures array must be read',
  )
  assert.match(yaml, /if\(!t\|\|!t\.taskArn\)/, 'an empty tasks array must fail the stage')

  // And the stage must actually WAIT, rather than starting tasks and returning.
  assert.match(yaml, /ecs wait tasks-stopped/, 'the stage does not wait for the tasks to stop')

  // Both planes, control first (invariant 3: the control plane publishes down).
  const control = yaml.indexOf('migrate_plane control')
  const data = yaml.indexOf('migrate_plane data')
  assert.ok(control > 0 && data > 0, 'both planes must be migrated')
  assert.ok(control < data, 'control migrates first; it is the plane that publishes downward')
})

/**
 * G261's circuit-breaker half, as far as this stack can carry it. The breaker is
 * a property of the ECS service and belongs to the `Planes` stack — what is
 * assertable here is that the Deploy stage REFUSES a service without one, and
 * that it does not mistake a rolled-back deployment for a successful one.
 */
test('test_the_deploy_stage_refuses_a_service_with_no_circuit_breaker_and_refuses_a_rollback', () => {
  const yaml = projectNamed('reconcile-deploy-').resource.Properties.Source.BuildSpec
  assert.match(
    yaml,
    /deploymentCircuitBreaker/,
    'G261 wants the circuit breaker with rollback. This stage cannot SET it — it ' +
      'is the service’s, in the Planes stack — so it must refuse to deploy without it.',
  )
  assert.match(yaml, /b\.enable!==true\|\|b\.rollback!==true/, 'both halves must be demanded')
  assert.match(yaml, /ecs wait services-stable/, 'the stage must wait for the service to settle')
  assert.match(
    yaml,
    /s\.taskDefinition!==want/,
    'ecs wait services-stable SUCCEEDS after a circuit-breaker rollback, because a ' +
      'rolled-back service is stable. Without this comparison a rollback is a green deploy.',
  )
  assert.match(
    yaml,
    /rolloutState==="COMPLETED"/,
    'the primary rollout must be COMPLETED before this stage calls the deploy done',
  )
})

// ------------------------------ 3b. W0-b · the rollout is POLLED, not SAMPLED

/**
 * 🛑 THE RED THIS SECTION EXISTS FOR, CAPTURED AGAINST THE PREVIOUS FORM OF
 * `ROLLOUT_VERDICT_JS` AND QUOTED SO IT CANNOT BE LOST.
 *
 * Same service, same successful deploy, settled on exactly the task definition
 * the stage registered — read once at two instants:
 *
 *     --- rolloutState=IN_PROGRESS — the instant `ecs wait services-stable` returns ---
 *     exit 1
 *     reconcile-data-staging: rolloutState=IN_PROGRESS taskDefinition=…:40
 *     FATAL: the primary deployment rolloutState is IN_PROGRESS, not COMPLETED
 *
 *     --- rolloutState=COMPLETED — a moment later ---
 *     exit 0
 *     reconcile-data-staging: rolloutState=COMPLETED taskDefinition=…:40
 *     deployed …:40
 *
 * The waiter succeeds on `length(deployments)==1 && runningCount==desiredCount`
 * and never reads `rolloutState`, which AWS documents as reaching COMPLETED
 * *after* steady state — so those are two events and a single sample between
 * them aborts a deploy that worked. Pipeline execution `235be2b3`.
 *
 * ⚠️ THE FIXTURES BELOW ARE OURS AND CANNOT WITNESS AWS. They pin what the
 * verdict DOES with a shape; whether ECS produces the rollback shape at all is
 * the unwitnessed premise G1304 names, and §3b-v is written so that reading it
 * as settled is difficult.
 */
const WANTED_TD = 'arn:aws:ecs:us-west-2:111122223333:task-definition/reconcile-data-staging:40'
const PREVIOUS_TD = 'arn:aws:ecs:us-west-2:111122223333:task-definition/reconcile-data-staging:39'

/** The verdict script, lifted out of the buildspec exactly as the shell runs it. */
function rolloutVerdictSource() {
  const yaml = projectNamed('reconcile-deploy-').resource.Properties.Source.BuildSpec
  const line = buildspecCommands(yaml)
    .join('\n')
    .split('\n')
    .find((l) => l.includes('WANT_TASK_DEFINITION=') && l.includes('node -e'))
  assert.ok(line !== undefined, 'the rollout verdict is not on any command line')
  return line.slice(line.indexOf("'") + 1, line.lastIndexOf("'"))
}

/** Run it against one `describe-services` answer and return the exit code. */
async function verdictFor(service, { want = WANTED_TD } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'rollout-verdict-'))
  await writeFile(join(dir, 'service-after.json'), JSON.stringify({ services: [service] }))
  const run = spawnSync(process.execPath, ['-e', rolloutVerdictSource()], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, WANT_TASK_DEFINITION: want },
  })
  return { status: run.status, output: `${run.stdout}${run.stderr}` }
}

/* ⚠️ THE FOUR COUNTS WERE ABSENT FROM THIS FIXTURE UNTIL 1 Oct 2026 — G2304.
 * The verdict never read them, so the fixture never carried them; it reads them
 * now, and real `describe-services` output always carries all four. An absent
 * count is FATAL rather than zero (§3b-vi), so leaving them out here would have
 * turned every COMPLETED arm below into a refusal for the wrong reason. */
const settledOn = (taskDefinition, rolloutState, primaryTaskDefinition = taskDefinition) => ({
  serviceName: 'reconcile-data-staging',
  taskDefinition,
  desiredCount: 1,
  runningCount: 1,
  deployments: [
    {
      status: 'PRIMARY',
      desiredCount: 1,
      runningCount: 1,
      ...(primaryTaskDefinition === null ? {} : { taskDefinition: primaryTaskDefinition }),
      ...(rolloutState === null ? {} : { rolloutState }),
      rolloutStateReason: 'a reason',
    },
  ],
})

test('test_the_rollout_verdict_is_three_valued_and_only_IN_PROGRESS_is_retryable', async () => {
  /* §3b-i · THE WHOLE POINT: the deploy that execution 235be2b3 aborted is now
   * a RETRY rather than a failure, and the same deploy a moment later is a
   * pass. Exit 75 is EX_TEMPFAIL and is the only code the shell polls at. */
  const inProgress = await verdictFor(settledOn(WANTED_TD, 'IN_PROGRESS'))
  assert.equal(
    inProgress.status,
    75,
    'a service that has settled on the revision this stage registered, whose ' +
      'rollout has not yet flipped to COMPLETED, must be RETRYABLE. Exit ' +
      `${inProgress.status} aborts a deploy that worked — that is execution ` +
      `235be2b3.\n${inProgress.output}`,
  )

  const completed = await verdictFor(settledOn(WANTED_TD, 'COMPLETED'))
  assert.equal(completed.status, 0, `a completed rollout must pass\n${completed.output}`)
})

test('test_an_absent_rolloutState_is_FATAL_IMMEDIATELY_and_is_never_polled', async () => {
  /* §3b-ii · THE TRAP, AND IT IS THE REASON THIS IS NOT A PLAIN
   * poll-until-terminal. AWS returns `rolloutState` only for rolling-update
   * services that are not behind a Classic Load Balancer, so its absence is a
   * CONFIGURATION fact and no amount of waiting changes one. Polled, it would
   * spend the entire budget and then report a TIMEOUT — a true sentence
   * pointing at the wrong repair. */
  const absent = await verdictFor(settledOn(WANTED_TD, null))
  assert.equal(
    absent.status,
    1,
    'an ABSENT rolloutState must be fatal at the FIRST poll. Exit 75 here burns ' +
      `the whole budget to report a timeout for a configuration problem.\n${absent.output}`,
  )
  assert.match(
    absent.output,
    /Classic Load Balancer/,
    'the refusal must carry the documented CAUSE. "rolloutState is missing" sends ' +
      'the next reader to the waiter; naming the deployment controller and the ' +
      'load balancer sends them to the service.',
  )
})

test('test_a_rollback_is_FATAL_AHEAD_OF_EVERY_ROLLOUT_ARM_even_mid_flight', async () => {
  /* §3b-iii · ORDER, ASSERTED TWICE — as behaviour and as position.
   *
   * A rollback observed MID-FLIGHT is still a rollback. If the rollout arms ran
   * first, this shape would answer 75 and be politely polled at until the
   * budget ran out, and the pipeline would report a TIMEOUT for the circuit
   * breaker doing exactly what G261 asks of it. */
  const rolledBackMidFlight = await verdictFor(settledOn(PREVIOUS_TD, 'IN_PROGRESS'))
  assert.equal(
    rolledBackMidFlight.status,
    1,
    'a service sitting on the PREVIOUS revision is a rollback whatever its ' +
      `rolloutState says. Exit ${rolledBackMidFlight.status} would poll at it.\n` +
      rolledBackMidFlight.output,
  )

  /* And a rollback that has SETTLED reads COMPLETED, because ECS makes a new
   * deployment of the old revision primary and that deployment completes
   * normally. Without a taskDefinition comparison this is a green deploy. */
  const rolledBackSettled = await verdictFor(settledOn(PREVIOUS_TD, 'COMPLETED'))
  assert.equal(
    rolledBackSettled.status,
    1,
    `a settled rollback reads COMPLETED and must still fail\n${rolledBackSettled.output}`,
  )

  const js = rolloutVerdictSource()
  assert.ok(
    js.indexOf('taskDefinition!==want') < js.indexOf('rolloutState==="COMPLETED"'),
    'the taskDefinition comparison sits AFTER the rollout arms. The behaviour ' +
      'above would still pass today and would stop passing the moment somebody ' +
      'reorders the script, so the POSITION is asserted as well as the outcome.',
  )
})

test('test_a_FAILED_rollout_and_an_unknown_rolloutState_are_both_fatal_and_named', async () => {
  /* §3b-iv · The other two terminal answers. An UNKNOWN value is fatal for the
   * same reason the absent one is — polling at a value we cannot read spends
   * the budget to report a timeout — and the message must NAME what it saw. */
  const failed = await verdictFor(settledOn(WANTED_TD, 'FAILED'))
  assert.equal(failed.status, 1, `FAILED must be fatal\n${failed.output}`)

  const unknown = await verdictFor(settledOn(WANTED_TD, 'ROLLING_BACK_PROBABLY'))
  assert.equal(
    unknown.status,
    1,
    `an unreadable rolloutState must be fatal rather than polled\n${unknown.output}`,
  )
  assert.match(
    unknown.output,
    /ROLLING_BACK_PROBABLY/,
    'the refusal must print the value it could not read, or the next reader has ' +
      'to reproduce the deploy to find out what it was',
  )

  /* And two shapes that are not deploys at all. */
  const noService = await verdictFor(undefined)
  assert.equal(noService.status, 1, `describe-services returning nothing is fatal`)

  const noPrimary = await verdictFor({
    serviceName: 'reconcile-data-staging',
    taskDefinition: WANTED_TD,
    deployments: [{ status: 'ACTIVE', rolloutState: 'COMPLETED', taskDefinition: WANTED_TD }],
  })
  assert.equal(noPrimary.status, 1, `a service with no PRIMARY deployment is fatal`)
})

test('test_the_rollback_detector_does_not_rest_on_the_unwitnessed_premise_alone', async () => {
  /* §3b-v · G1304 — THE ONE UNMEASURED PREMISE IN THIS PIPELINE, HEDGED.
   *
   * 🛑 NOBODY HAS WITNESSED THAT ECS RESETS `service.taskDefinition` ON A
   * CIRCUIT-BREAKER ROLLBACK. It is taken from a comment in `buildspecs.ts`.
   * **If it is false, the service-level comparison has been VACUOUS since the
   * day it was written** — and the `FAILED` arm is NOT a backstop for it,
   * because `FAILED` is carried by the deployment that TRIPPED and that
   * deployment is no longer PRIMARY by the time the waiter returns.
   *
   * So this asserts the arm that rests on NO premise: the PRIMARY deployment's
   * own `taskDefinition`, which is the old revision on a rollback whether or
   * not the service-level field was reset.
   *
   * ⚠️ THIS TEST DOES NOT SETTLE THE PREMISE AND MUST NOT BE READ AS SETTLING
   * IT. The fixture below is written by us; a fixture encodes what its author
   * believed and cannot witness AWS. Settling it needs a DELIBERATE ROLLBACK
   * against a scratch service — an image that fails its health check, the
   * breaker allowed to trip, `describe-services` read back — and nothing in
   * this repository may touch AWS. **UNMEASURED.** */
  const premiseFalse = await verdictFor(
    settledOn(WANTED_TD /* service field NOT reset */, 'COMPLETED', PREVIOUS_TD),
  )
  assert.equal(
    premiseFalse.status,
    1,
    'if ECS does NOT reset service.taskDefinition on a rollback, the service-level ' +
      'comparison never fires, the PRIMARY is the rollback deployment and it is ' +
      'COMPLETED — so the verdict is a GREEN DEPLOY OF CODE THAT IS NOT RUNNING. ' +
      `Exit ${premiseFalse.status} is that hole.\n${premiseFalse.output}`,
  )

  /* And the other direction, which is what keeps the arm from being a blanket
   * refusal: a normal forward deploy has the SAME revision in both places. */
  const forward = await verdictFor(settledOn(WANTED_TD, 'COMPLETED', WANTED_TD))
  assert.equal(forward.status, 0, `a forward deploy must still pass\n${forward.output}`)
})

test('test_the_shell_polls_only_on_75_and_stops_at_a_bounded_budget', () => {
  /* §3b-vi · The verdict is only worth its three values if the SHELL reads all
   * three. A loop that retried on any non-zero code would turn a rollback into
   * a timeout; one with no bound would hang until CodeBuild killed the stage,
   * which is W0-d's failure arriving through W0-b's door. */
  const yaml = projectNamed('reconcile-deploy-').resource.Properties.Source.BuildSpec

  assert.match(
    yaml,
    /if \[ "\$VERDICT" -ne 75 \]; then\s*\n\s*exit "\$VERDICT"/,
    'any verdict that is neither 0 nor 75 must leave the stage immediately. ' +
      'Retrying on a fatal code polls at a rollback until the budget runs out ' +
      'and then calls it a timeout.',
  )
  assert.match(
    yaml,
    /ROLLOUT_POLL" -ge "\$ROLLOUT_POLL_ROUNDS/,
    'the poll must be BOUNDED. An unbounded one is killed by CodeBuild, which ' +
      'reports an infrastructure error for a rollout that never settled.',
  )
  assert.match(
    yaml,
    /ROLLOUT_POLL_SLEEP_SECONDS=\d+/,
    'the poll interval must be spelled beside the loop, because the timeout ' +
      'arithmetic below multiplies by it',
  )
})

/**
 * G263 — *"the pipeline role may … run its own task definitions and update only
 * its own services"*. A `Resource: '*'` on either action would satisfy every
 * other assertion in this file and give the pipeline the whole account's ECS.
 *
 * ⚠️ Two actions ARE granted on `*` and are exempted BY NAME rather than by a
 * pattern: `ecs:RegisterTaskDefinition` and `ecs:DescribeTaskDefinition` take no
 * resource in IAM, by AWS's design. Exempting them by name is what keeps this
 * assertion from being widened silently later.
 */
test('test_no_ecs_statement_that_changes_anything_is_granted_on_a_wildcard_resource', () => {
  const RESOURCELESS_BY_AWS_DESIGN = new Set([
    'ecs:RegisterTaskDefinition',
    'ecs:DescribeTaskDefinition',
  ])
  let seen = 0
  for (const [stackName, template] of Object.entries(templates)) {
    for (const [logicalId, resource] of resourcesOfType(template, 'AWS::IAM::Policy')) {
      for (const statement of resource.Properties?.PolicyDocument?.Statement ?? []) {
        const listed = [statement.Action ?? []].flat()
        const ecsActions = listed.filter((a) => typeof a === 'string' && a.startsWith('ecs:'))
        if (ecsActions.length === 0) continue
        seen += 1
        const wildcard = [statement.Resource ?? []].flat().includes('*')
        if (!wildcard) continue
        for (const action of ecsActions) {
          assert.ok(
            RESOURCELESS_BY_AWS_DESIGN.has(action),
            `${stackName}/${logicalId}: ${action} is granted on Resource "*". G263 ` +
              'fences the pipeline role to its OWN task definitions and services. ' +
              'If AWS genuinely takes no resource for this action, add it to ' +
              'RESOURCELESS_BY_AWS_DESIGN and say so.',
          )
        }
      }
    }
  }
  assert.ok(seen > 0, 'no ECS statement was read at all; this assertion checked nothing')
})

test('test_the_migrate_and_deploy_projects_are_not_privileged_and_hold_no_docker_daemon', () => {
  for (const fragment of ['reconcile-migrate-', 'reconcile-deploy-']) {
    assert.notEqual(
      projectNamed(fragment).resource.Properties?.Environment?.PrivilegedMode,
      true,
      `${fragment} needs the AWS CLI and nothing else; a daemon here could push an image`,
    )
  }
})

// --------------------------------------------------------------- 4. G262

test('test_every_ecr_repository_this_app_creates_scans_on_push_and_refuses_a_moving_tag', () => {
  let found = 0
  for (const [stackName, template] of Object.entries(templates)) {
    for (const [logicalId, resource] of resourcesOfType(template, 'AWS::ECR::Repository')) {
      found += 1
      assert.equal(
        resource.Properties?.ImageScanningConfiguration?.ScanOnPush,
        true,
        `${stackName}/${logicalId}: G262 requires scan on push`,
      )
      assert.equal(
        resource.Properties?.ImageTagMutability,
        'IMMUTABLE',
        `${stackName}/${logicalId}: a mutable tag does not name bytes`,
      )
    }
  }
  assert.ok(found >= 2, `expected the CI image and the plane repositories; found ${found}`)
})

test('test_the_build_stage_fails_the_pipeline_on_a_critical_or_high_finding', () => {
  const build = allCodeBuildProjects().find(({ resource }) =>
    /reconcile-build-/.test(JSON.stringify(resource.Properties?.Name ?? '')),
  )
  assert.ok(build !== undefined, 'no build project found')
  const yaml = build.resource.Properties.Source.BuildSpec
  assert.match(yaml, /describe-image-scan-findings/)
  assert.match(
    yaml,
    /CRITICAL/,
    'G262: the Build stage fails on CRITICAL or HIGH. A scan nobody reads is not a gate.',
  )
  assert.match(yaml, /HIGH/)
})

// ------------------------------------------- 5. the scan above is not vacuous

/**
 * 🛑 EVERY SYNTHESISED BUILDSPEC MUST BE VALID YAML, AND THIS CAUGHT ONE THAT
 * WAS NOT — a buildspec CodeBuild would have REJECTED AT RUN TIME.
 *
 * The plane-build spec carried `- node -e "…"` as a bare line. That is a plain
 * YAML scalar containing a double quote that opens a new node, which is
 * malformed, and it reached a synthesised template because the scanner that
 * used to read these buildspecs matched lines with a regular expression and
 * therefore could not tell malformed YAML from valid YAML.
 *
 * A pipeline is deployed long before anybody runs it. Without this assertion
 * the failure surfaces as a red build minutes into the first pipeline run,
 * against a stack that deployed cleanly — which is the most expensive place to
 * find a syntax error.
 */
/**
 * 🛑 EVERY VARIABLE A BUILDSPEC ASSERTS MUST BE SET BY THE PROJECT THAT RUNS IT,
 * AND THIS CAUGHT A REAL FAILURE ONE MINUTE INTO THE FIRST REAL BUILD.
 *
 * Two slices wrote the two halves of one interface on the same day. The CDK set
 * `ECR_REGISTRY` and `CI_IMAGE_REPOSITORY_NAME`; the buildspec asserted
 * `AWS_ACCOUNT_ID`, `IMAGE_REPO_NAME` and `IMAGE_TAG`. Nothing compared them,
 * `cdk synth` was green, the gate was green, and the build failed at PRE_BUILD
 * on `test -n "$AWS_ACCOUNT_ID"` — sixty seconds of CodeBuild rather than a
 * red test, which is the cheap end of that mistake only because the buildspec
 * bothered to assert instead of assume.
 *
 * The scan reads the `test -n "$VAR"` guards out of the buildspec itself, so a
 * variable added to a guard and not to the project fails here rather than in
 * the cloud. Variables CodeBuild supplies itself are exempted by name.
 */
const CODEBUILD_PROVIDED = new Set([
  'AWS_DEFAULT_REGION',
  'AWS_REGION',
  'CODEBUILD_RESOLVED_SOURCE_VERSION',
  'CODEBUILD_BUILD_ARN',
  'CODEBUILD_BUILD_ID',
  'CODEBUILD_SRC_DIR',
])

test('test_every_variable_a_buildspec_asserts_is_set_by_the_project_that_runs_it', () => {
  let checkedAny = false
  for (const { stackName, logicalId, resource } of allCodeBuildProjects()) {
    const yaml = resource.Properties?.Source?.BuildSpec
    if (typeof yaml !== 'string') continue

    // ⚠️ A GUARD CAN ALSO COVER A VARIABLE THE BUILDSPEC COMPUTES ITSELF, and
    // the first version of this test did not know that — it demanded the
    // project set `DIGEST`, which `docker inspect` produces halfway through the
    // build. A name ASSIGNED anywhere in the same buildspec is local, and the
    // guard on it is the script checking its own work rather than its inputs.
    const assignedLocally = new Set(
      [...yaml.matchAll(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)=/gm)].map((m) => m[1]),
    )
    const asserted = new Set()
    for (const m of yaml.matchAll(/test -n "\$\{?([A-Z_][A-Z0-9_]*)\}?"/g)) {
      const name = m[1]
      if (name === undefined) continue
      if (CODEBUILD_PROVIDED.has(name)) continue
      if (assignedLocally.has(name)) continue
      asserted.add(name)
    }
    if (asserted.size === 0) continue
    checkedAny = true

    const set = new Set(
      (resource.Properties?.Environment?.EnvironmentVariables ?? []).map((v) => v.Name),
    )
    for (const name of asserted) {
      assert.ok(
        set.has(name),
        `${stackName}/${logicalId}: its buildspec asserts ${name} in a ` +
          '`test -n` guard and the project does not set it. The build will ' +
          'fail at PRE_BUILD. Set it in the stack, or drop the guard — but ' +
          'the buildspec is the authority on the name.',
      )
    }
  }
  assert.ok(checkedAny, 'no buildspec asserted any variable; this test read nothing')
})

/**
 * 🛑 THE MIGRATE STAGE MUST BE GIVEN THE MIGRATE TASK'S CONTAINER NAMES, AND
 * THE FIRST REAL MIGRATE RUN FAILED BECAUSE IT WAS GIVEN THE SERVICES'.
 *
 * A migrate task's container is `*-plane-migrate`; a service's is `*-plane`.
 * The names are deliberately distinct — `planes.test.mjs` tells the two apart
 * BY NAME to check which credentials each holds, and the migrate task is the
 * only principal granted the migrator secret (G253). Collapsing them to one
 * name per plane, which this stage would have found convenient, made that test
 * red at once.
 *
 * So the stage has to ask for the right one, and this asserts it does. The
 * failure it prevents is four minutes into a pipeline run:
 *
 *     FATAL: task definition family ...ControlPlaneMigrateTask... has no
 *     container named control-plane. The Planes stack and infra/lib/config.ts
 *     disagree about the container name.
 *
 * ⚠️ That the buildspec's own guard printed exactly that is the guard WORKING.
 * This test moves the same finding from four minutes into the cloud to one
 * second in `npm run check`.
 */
/**
 * 🛑 EXECUTIONS ARE SERIALISED, AND THE FIRST MERGE TO `main` IS WHY.
 *
 * That merge started two executions six seconds apart on the SAME commit. Both
 * built the same image and both pushed the SAME tag to an IMMUTABLE ECR
 * repository. One won; the other died at `docker push` with a bare
 * `exit status 1` after its own layers reported `Pushed` — an error that reads
 * like a network fault and is a race.
 *
 * `SUPERSEDED`, the default, does not help: it replaces a run still waiting to
 * ENTER a stage, and two runs that are both already inside Build are past that.
 * `QUEUED` makes the second wait.
 */
test('test_pipeline_executions_are_queued_so_two_runs_cannot_race_on_one_immutable_tag', () => {
  let checked = 0
  for (const tpl of Object.values(synthesisedTemplates())) {
    for (const [logicalId, resource] of Object.entries(tpl.Resources ?? {})) {
      if (resource.Type !== 'AWS::CodePipeline::Pipeline') continue
      checked += 1
      assert.equal(
        resource.Properties?.ExecutionMode,
        'QUEUED',
        `${logicalId} does not serialise executions. Two runs of the same commit ` +
          'will both build and both push the same tag to an IMMUTABLE repository, ' +
          'and one will fail at `docker push` with an error that looks like a ' +
          'network fault. SUPERSEDED does not prevent this: it only replaces runs ' +
          'that have not yet entered a stage.',
      )
    }
  }
  assert.ok(checked > 0, 'no pipeline was checked; this assertion read nothing')
})

test('test_the_migrate_stage_is_given_the_migrate_containers_and_not_the_services', () => {
  const migrate = allCodeBuildProjects().find(({ resource }) =>
    /reconcile-migrate-/.test(JSON.stringify(resource.Properties?.Name ?? '')),
  )
  assert.ok(migrate !== undefined, 'no migrate project found in any synthesised stack')

  const vars = migrate.resource.Properties?.Environment?.EnvironmentVariables ?? []
  for (const name of ['CONTROL_CONTAINER_NAME', 'DATA_CONTAINER_NAME']) {
    const v = vars.find((x) => x.Name === name)
    assert.ok(v !== undefined, `the migrate project does not set ${name}`)
    const spelled = JSON.stringify(v.Value)
    assert.match(
      spelled,
      /MigrateContainerName/,
      `${name} on the MIGRATE project resolves ${spelled}, which is not a ` +
        'MigrateContainerName export. A migrate task definition has no container ' +
        'named after the service, so `ecs register-task-definition` fails four ' +
        'minutes into the run. Import ControlMigrateContainerName / ' +
        'DataMigrateContainerName instead.',
    )
  }
})

test('test_every_synthesised_buildspec_is_valid_yaml_because_codebuild_will_reject_one_that_is_not', () => {
  let checked = 0
  for (const { stackName, logicalId, resource } of allCodeBuildProjects()) {
    const yaml = resource.Properties?.Source?.BuildSpec
    if (typeof yaml !== 'string') continue
    assert.doesNotThrow(
      () => parseYaml(yaml),
      `${stackName}/${logicalId} has a buildspec that is not valid YAML. ` +
        'CodeBuild parses this at run time and will refuse the build.',
    )
    checked += 1
  }
  assert.ok(checked > 0, 'no inline buildspec was checked; this assertion read nothing')
})

test('test_the_buildspec_line_scan_actually_reads_commands_rather_than_returning_an_empty_list', () => {
  /* Every assertion in this file that scans a buildspec passes trivially if
   * `buildspecCommands` returns []. This is the control on the control — the
   * same shape `tests/ci/gate.test.ts` uses when it asserts no workflow step is
   * a YAML block scalar the line scan cannot read. */
  for (const { stackName, logicalId, resource } of allCodeBuildProjects()) {
    const yaml = resource.Properties?.Source?.BuildSpec
    assert.equal(
      typeof yaml,
      'string',
      `${stackName}/${logicalId} has no inline buildspec; the scans above would read nothing`,
    )
    const commands = buildspecCommands(yaml)
    assert.ok(
      commands.length > 0,
      `${stackName}/${logicalId}: the scan found no commands, so every buildspec ` +
        'assertion in this file passed vacuously',
    )
    for (const command of commands) {
      assert.notEqual(command, '', `${stackName}/${logicalId} yielded an empty command`)
    }
  }
})

test('test_the_deploy_stage_refuses_a_service_scaled_to_zero_because_every_control_below_goes_vacuous', async () => {
  const deploy = allCodeBuildProjects().find(({ resource }) =>
    /reconcile-deploy-/.test(JSON.stringify(resource.Properties?.Name ?? '')),
  )
  assert.ok(deploy !== undefined, 'no deploy project found in any synthesised stack')

  const yaml = deploy.resource.Properties?.Source?.BuildSpec
  assert.equal(typeof yaml, 'string', 'the deploy project has no inline buildspec')

  // §1 · THE GUARD IS THERE AT ALL.
  assert.match(
    yaml,
    /desiredCount===0/,
    'the deploy stage does not refuse a service with desiredCount 0. The first ' +
      'real deploy ran against both planes scaled to 0 by the cost schedule: ' +
      '`ecs wait services-stable` returned immediately because running 0 equals ' +
      'desired 0, the circuit breaker could not trip because no task started, ' +
      'and the ALB health check never ran. It failed only because rolloutState ' +
      'happened to still read IN_PROGRESS — luck, not a control.',
  )

  // §2 · AND IT RUNS BEFORE THE DEPLOY, WHICH IS THE WHOLE POINT. A guard that
  // fires after the fleet has already been moved proves nothing.
  //
  // ┌─ 🛑 THIS KEYED ON `services-stable` UNTIL 23 Sep 2026 AND THE RED IS ────┐
  // │ QUOTED RATHER THAN NARRATED — G2046:                                     │
  // │                                                                           │
  // │   AssertionError: the zero-desired guard sits AFTER                      │
  // │   `ecs wait services-stable`. The waiter is exactly what goes vacuous    │
  // │   at zero, so a guard behind it is a guard that never gets to speak.     │
  // │                                                                           │
  // │ **The guard did not move; the waiter did.** G2041 replaced this stage's  │
  // │ `register-task-definition` + `update-service` + `ecs wait` with ONE       │
  // │ scoped `cloudformation update-stack`, so `indexOf('services-stable')`     │
  // │ returned -1 and every index comparison against it was meaningless.        │
  // │                                                                           │
  // │ ⚠️ **AND THE OLD FORM WAS §5.1 ALL ALONG, WHICH IS WHY THIS IS A REPAIR   │
  // │ RATHER THAN A RE-POINT.** The property is *does the guard run before      │
  // │ anything moves the fleet*; `services-stable` was a LANDMARK that happened │
  // │ to be the first such thing. Keyed on the landmark, deleting the waiter    │
  // │ silently deletes the control. It is keyed on the ACT now, and the act is  │
  // │ asserted to exist — so a stage that stops deploying altogether is red     │
  // │ here rather than vacuously green.                                         │
  // └───────────────────────────────────────────────────────────────────────────┘
  const guard = yaml.indexOf('desiredCount===0')
  const theAct = yaml.indexOf('cloudformation update-stack')
  assert.ok(
    theAct !== -1,
    'the deploy stage no longer updates the Planes stack at all, so it deploys nothing',
  )
  assert.ok(
    guard < theAct,
    'the zero-desired guard sits AFTER `cloudformation update-stack`. The whole ' +
      'point is that a deploy onto zero tasks makes every control below it ' +
      'vacuous, so a guard behind the deploy is a guard that never gets to speak.',
  )

  // §3 · THE ENGINE IS WITNESSED, NOT ASSUMED — the extracted refusal is run
  // against a service that is scaled to zero and against one that is not.
  const precondition = buildspecCommands(yaml)
    .join('\n')
    .split('\n')
    .find((line) => line.includes('desiredCount===0'))
  assert.ok(precondition !== undefined, 'the guard is not on any command line')

  const js = precondition.slice(precondition.indexOf("'") + 1, precondition.lastIndexOf("'"))
  for (const [desiredCount, mustExit] of [
    [0, true],
    [1, false],
  ]) {
    const service = {
      services: [
        {
          serviceName: 'probe',
          desiredCount,
          deploymentConfiguration: { deploymentCircuitBreaker: { enable: true, rollback: true } },
        },
      ],
    }
    const dir = await mkdtemp(join(tmpdir(), 'deploy-guard-'))
    await writeFile(join(dir, 'service.json'), JSON.stringify(service))
    const run = spawnSync(process.execPath, ['-e', js], { cwd: dir, encoding: 'utf8' })
    assert.equal(
      run.status !== 0,
      mustExit,
      `with desiredCount ${desiredCount} the precondition exited ${run.status}. ` +
        `Expected ${mustExit ? 'a refusal' : 'a pass'}.\n${run.stderr}${run.stdout}`,
    )
  }
})

// ------------------------------- 6. G993 · the frontend half of the deploy

/**
 * 🛑 THE BUILD STAGE HAS PRODUCED THE BUNDLE SINCE THE PIPELINE EXISTED AND THE
 * DEPLOY STAGE NEVER SHIPPED IT.
 *
 * `docs/build/deploy-handoff.md` §5.4: *"**Nothing uploads the bundle.** The
 * `Edge` stack creates the bucket empty … the pipeline's **Deploy** stage is
 * where it belongs."* Until G993 the artefact carried `frontend/dist/**` to a
 * stage that read `image-digest.txt` out of it and nothing else — a build
 * output with no consumer, which is the shape that looks finished from either
 * end and is finished at neither.
 */
/**
 * ⚠️ **THESE THREE ASSERTIONS READ `reconcile-publish-` SINCE 28 Sep 2026 AND
 * READ `reconcile-deploy-` BEFORE IT — G2221.** The property did not change and
 * not one of them was weakened; the frontend half moved into its own CodeBuild
 * project because the Deploy buildspec outgrew CodeBuild's 25,600-character
 * inline ceiling (§8). **The STAGE is still `Deploy` and still does both things
 * in the same order** — the bundle is now its second ACTION, at `runOrder: 2`.
 * An assertion that stayed pointed at the old project would have gone green the
 * day somebody deleted the publish half, because `reconcile-deploy-` would
 * still exist and still match.
 */
test('test_the_deploy_stage_publishes_the_bundle_and_invalidates_BOTH_distributions', () => {
  const yaml = projectNamed('reconcile-publish-').resource.Properties.Source.BuildSpec

  assert.match(
    yaml,
    /aws s3 sync "\$BUNDLE" "s3:\/\/\$FRONTEND_BUCKET_NAME\/" --delete/,
    'the Deploy stage does not sync the bundle. The Build stage has been carrying ' +
      '`frontend/dist/**` in its artefact since the pipeline existed and nothing ' +
      'consumed it; the Edge bucket is created empty.',
  )

  /* 🛑 BOTH, AND THE SECOND ONE IS THE EASY OMISSION. G297 split the edge into a
   * TENANT distribution and a CONSOLE one and BOTH serve this one bucket, so
   * invalidating only the tenant leaves console. and partners. on the previous
   * index.html — which names hashed assets `--delete` has just removed. */
  for (const label of ['tenant', 'console']) {
    assert.match(
      yaml,
      new RegExp(`invalidate ${label} `),
      `the Deploy stage does not invalidate the ${label} distribution. G297 put ` +
        'TWO distributions in front of ONE bucket; invalidating one of them leaves ' +
        'the other serving an index.html whose assets no longer exist.',
    )
  }
  assert.match(
    yaml,
    /aws cloudfront wait invalidation-completed/,
    'the stage starts invalidations and does not wait for them. `create-invalidation` ' +
      'returns `InProgress`; a stage that stopped there would be green over a site ' +
      'still serving the old page — the same shape as `ecs wait services-stable` ' +
      'succeeding after a rollback.',
  )

  /* THE ORDER. The bundle calls the API it was built against, so publishing it
   * before the planes have settled puts a new client in front of an old server
   * — the same argument that puts Migrate in front of Deploy one stage up. */
  /* ⚠️ THIS READ `deploy_plane data` UNTIL 23 Sep 2026 — G2046. The red:
   *   AssertionError: both halves must be present
   * The function was renamed when G2041 split the stage into a per-plane
   * PRECHECK, one scoped stack update, and a per-plane SETTLE. `settle_plane`
   * is the right half to compare against: it is the last thing that has to
   * hold before the bundle may be published, exactly as `deploy_plane` was.
   *
   * 🛑 AND IT COMPARED TWO OFFSETS IN ONE BUILDSPEC UNTIL 28 Sep 2026 — G2221
   * — WHICH IT CANNOT DO ANY MORE, BECAUSE THERE ARE TWO BUILDSPECS. THE SAME
   * RED FIRED AGAIN, WORD FOR WORD:
   *
   *     AssertionError: both halves must be present
   *
   * **The property did not move; the mechanism holding it did, and got
   * stronger.** It was `set -eu` running a command list top to bottom — an
   * ordering any edit to that list could rearrange. It is now CodePipeline's
   * `runOrder` inside the Deploy stage, so the assertion is re-homed onto the
   * PIPELINE rather than rewritten to compare two strings across two files,
   * which is what a lazy repair would have done and which would have asserted
   * the ordering of nothing. */
  const pipelines = resourcesOfType(
    templates[projectNamed('reconcile-publish-').stackName],
    'AWS::CodePipeline::Pipeline',
  )
  assert.equal(pipelines.length, 1, `expected exactly one pipeline; found ${pipelines.length}`)
  const deployStage = (pipelines[0][1].Properties?.Stages ?? []).find((s) => s.Name === 'Deploy')
  assert.ok(deployStage !== undefined, 'the pipeline has no Deploy stage')

  const runOrderOf = (actionName) => {
    const action = (deployStage.Actions ?? []).find((a) => a.Name === actionName)
    assert.ok(action !== undefined, `the Deploy stage has no ${actionName} action`)
    assert.ok(
      Number.isFinite(action.RunOrder),
      `${actionName} carries no RunOrder, so CodePipeline runs it in PARALLEL with ` +
        'the other actions in this stage — which is the one arrangement this ' +
        'assertion exists to forbid.',
    )
    return action.RunOrder
  }

  assert.ok(
    runOrderOf('UpdateServices') < runOrderOf('PublishSite'),
    'the bundle is published BEFORE the planes are deployed. It calls the API it ' +
      'was built against; publishing first puts a new client in front of an old ' +
      'server for the length of two ECS rollouts. A plane that fails to settle ' +
      'fails the UpdateServices action, and CodePipeline then never STARTS the ' +
      'publish — which is the direction that leaves the site working.',
  )
})

test('test_the_deploy_stage_refuses_to_sync_an_empty_artefact_because_delete_would_empty_the_live_bucket', async () => {
  /**
   * 🛑 THE FAILURE THIS WHOLE HALF HAD TO BE DESIGNED AROUND, AND `aws s3 sync`
   * EXITS 0 DOING IT. `--delete` makes the bucket look like the local directory;
   * if the artefact reached this stage without `frontend/dist`, the sync removes
   * every object the site is served from and reports success. CloudFront then
   * serves 403s from an empty origin until somebody re-runs a pipeline.
   *
   * ⚠️ THE ENGINE IS WITNESSED RATHER THAN ASSUMED — the refusal is extracted
   * from the SYNTHESISED buildspec and run against four real directories, which
   * is the shape `test_the_deploy_stage_refuses_a_service_scaled_to_zero` and
   * the npm-audit test already use. A guard nobody has watched refuse is a guard
   * that proves nothing about the case it was written for.
   */
  const yaml = projectNamed('reconcile-publish-').resource.Properties.Source.BuildSpec

  const line = buildspecCommands(yaml)
    .join('\n')
    .split('\n')
    .find((l) => l.includes('BUNDLE_DIR') && l.includes('node -e'))
  assert.ok(line !== undefined, 'the bundle guard is not on any command line')

  // §1 · IT RUNS BEFORE THE SYNC. A guard behind `--delete` has nothing left to
  //      protect.
  const guard = yaml.indexOf('BUNDLE_DIR=')
  const sync = yaml.indexOf('aws s3 sync')
  assert.ok(guard > 0 && guard < sync, 'the bundle guard sits AFTER the sync it exists to prevent')

  const js = line.slice(line.indexOf("'") + 1, line.lastIndexOf("'"))

  const { mkdtemp: mk, writeFile: write, mkdir } = await import('node:fs/promises')
  const cases = [
    /* [what the directory holds, must it refuse] */
    [null, true], //                              absent entirely
    [[], true], //                                present and empty
    [[['index.html', '']], true], //              an empty page
    [[['other.txt', 'x']], true], //              no page at all
    [[['index.html', '<!doctype html>']], true], // a page and NO assets
    [
      [
        ['index.html', '<!doctype html>'],
        ['assets/index-abc.js', 'console.log(1)'],
      ],
      false,
    ], //                                          a real bundle
  ]

  for (const [files, mustRefuse] of cases) {
    const root = await mk(join(tmpdir(), 'bundle-guard-'))
    const dir = join(root, 'dist')
    if (files !== null) {
      await mkdir(dir, { recursive: true })
      for (const [name, body] of files) {
        const full = join(dir, name)
        await mkdir(join(full, '..'), { recursive: true })
        await write(full, body)
      }
    }
    const run = spawnSync(process.execPath, ['-e', js], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, BUNDLE_DIR: dir },
    })
    assert.equal(
      run.status !== 0,
      mustRefuse,
      `a bundle directory holding ${JSON.stringify(files)} exited ${run.status}; ` +
        `expected ${mustRefuse ? 'a refusal' : 'a pass'}. An artefact that cannot be ` +
        `the site must never reach \`--delete\`.\n${run.stderr}${run.stdout}`,
    )
  }
})

/**
 * G263 — *"the pipeline role may … deploy stacks tagged `Project=reconcile`, and
 * nothing else in a SHARED account."* Publishing a bundle is a fifth verb that
 * ruling did not anticipate, so it is fenced the way the other four are: by
 * RESOURCE, never by service. This is the assertion that keeps it that way.
 */
test('test_the_deploy_role_publishes_to_one_bucket_and_invalidates_two_distributions_and_nothing_wider', () => {
  const deploy = projectNamed('reconcile-publish-')
  const template = templates[deploy.stackName]
  const roleLogicalId = deploy.resource.Properties?.ServiceRole?.['Fn::GetAtt']?.[0]
  assert.ok(typeof roleLogicalId === 'string', 'the publish project`s role cannot be resolved')

  /* Widenings that would each satisfy every other assertion in this file and
   * hand the stage something it has no business holding. */
  const FORBIDDEN = [
    's3:GetObject', //           sync local->remote never reads an object back
    's3:PutBucketPolicy', //     could make the bundle world-readable
    's3:PutBucketAcl',
    's3:*',
    'cloudfront:UpdateDistribution', //   moves the product's front door
    'cloudfront:CreateDistribution',
    'cloudfront:ListDistributions', //    takes no resource: only grantable on *
    'cloudfront:*',
  ]

  let sawS3 = 0
  let sawCloudFront = 0
  for (const [logicalId, resource] of resourcesOfType(template, 'AWS::IAM::Policy')) {
    const roles = (resource.Properties?.Roles ?? []).map((r) => JSON.stringify(r))
    if (!roles.some((r) => r.includes(roleLogicalId))) continue
    for (const statement of resource.Properties?.PolicyDocument?.Statement ?? []) {
      const actions = [statement.Action ?? []].flat().filter((a) => typeof a === 'string')
      const resources = [statement.Resource ?? []].flat()
      for (const action of actions) {
        assert.ok(
          !FORBIDDEN.includes(action),
          `${logicalId} grants ${action} to the Deploy stage. Each of these is a ` +
            'widening that would pass every other assertion here: a read of the ' +
            'bucket, a rewrite of its policy, or a change to where the front door ' +
            'points. `infra/lib/pipeline-stack.ts` argues each refusal by name.',
        )
        if (action.startsWith('s3:')) {
          sawS3 += 1
          for (const r of resources) {
            assert.notEqual(r, '*', `${logicalId}: ${action} on Resource "*"`)
          }
        }
        if (action.startsWith('cloudfront:')) {
          sawCloudFront += 1
          for (const r of resources) {
            assert.notEqual(r, '*', `${logicalId}: ${action} on Resource "*"`)
          }
        }
      }
    }
  }
  /* §5.6 — without these the loop above passes over a role holding nothing. */
  assert.ok(sawS3 >= 2, `expected the ListBucket and the object statements; saw ${sawS3} s3 action(s)`)
  assert.ok(
    sawCloudFront >= 2,
    `expected CreateInvalidation and GetInvalidation; saw ${sawCloudFront} cloudfront action(s)`,
  )
})

/**
 * 🛑 G2223 — THE SPLIT'S DIVIDEND IS AN IAM PROPERTY, SO IT IS ASSERTED RATHER
 * THAN CLAIMED. THIS IS THE ONLY THING THAT MAKES THE SEPARATION WORTH A
 * RESOURCE.
 *
 * Until 28 Sep 2026 ONE role held `cloudformation:UpdateStack` on the `Planes`
 * stack **and** `s3:DeleteObject` on the bucket the whole product is served
 * from **and** `cloudfront:CreateInvalidation`, for the length of a ninety
 * minute build. Splitting the project buys nothing unless the verbs went with
 * it — a split that left both grants on both roles would look identical in a
 * diff and be exactly as wide as before.
 *
 * ⚠️ **IT IS ASSERTED IN BOTH DIRECTIONS, DELIBERATELY.** Checking only that
 * Publish lost CloudFormation would pass against a Deploy project that had
 * quietly kept the S3 write, which is the half a reviewer skims.
 */
test('test_the_two_deploy_stage_roles_cannot_reach_each_others_verbs', () => {
  const actionsOnRoleOf = (namePrefix) => {
    const project = projectNamed(namePrefix)
    const template = templates[project.stackName]
    const roleLogicalId = project.resource.Properties?.ServiceRole?.['Fn::GetAtt']?.[0]
    assert.ok(typeof roleLogicalId === 'string', `${namePrefix} role cannot be resolved`)
    const found = []
    for (const [, resource] of resourcesOfType(template, 'AWS::IAM::Policy')) {
      const roles = (resource.Properties?.Roles ?? []).map((r) => JSON.stringify(r))
      if (!roles.some((r) => r.includes(roleLogicalId))) continue
      for (const statement of resource.Properties?.PolicyDocument?.Statement ?? []) {
        for (const action of [statement.Action ?? []].flat()) {
          if (typeof action === 'string') found.push(action)
        }
      }
    }
    return found
  }

  const deployActions = actionsOnRoleOf('reconcile-deploy-')
  const publishActions = actionsOnRoleOf('reconcile-publish-')

  /* §5.6 — an empty list satisfies every `every()` below. */
  assert.ok(deployActions.length > 0, 'the Deploy role carries no actions at all')
  assert.ok(publishActions.length > 0, 'the Publish role carries no actions at all')

  /* The Deploy half writes the stack value; it publishes nothing. */
  for (const action of deployActions) {
    assert.ok(
      !/^s3:(Put|Delete)/.test(action) && !action.startsWith('cloudfront:'),
      `the Deploy role holds ${action}. Since G2221 the bundle is published by ` +
        'reconcile-publish-, and the point of that split is that the role which ' +
        'calls cloudformation:UpdateStack on the Planes stack cannot also empty ' +
        'the bucket the site is served from. Move the grant, do not copy it.',
    )
  }

  /* The Publish half publishes; it cannot move the fleet or the stack. */
  for (const action of publishActions) {
    assert.ok(
      !action.startsWith('cloudformation:') && !action.startsWith('ecs:'),
      `the Publish role holds ${action}. It syncs a directory to a bucket and ` +
        'invalidates two caches; a CloudFormation or ECS verb here would hand the ' +
        'half that runs LAST, after every check has passed, the ability to move ' +
        'the fleet behind the Deploy action`s back.',
    )
  }

  /* And the dividend is only real if the verbs actually landed somewhere. */
  assert.ok(
    publishActions.some((a) => a.startsWith('s3:')) &&
      publishActions.some((a) => a.startsWith('cloudfront:')),
    'the Publish role holds neither an s3: nor a cloudfront: action, so the ' +
      'assertions above are satisfied by a role that can do nothing at all',
  )
  assert.ok(
    deployActions.some((a) => a.startsWith('cloudformation:')),
    'the Deploy role holds no cloudformation: action, so the assertion above is ' +
      'satisfied by a role that cannot perform G2041`s stack write',
  )
})

test('test_a_cloudfront_distribution_arn_carries_no_region_because_an_arn_with_one_matches_nothing', () => {
  /* Trap 2's shape one service over: a value CloudFormation accepts, synth
   * accepts and IAM silently never matches. `arn:aws:cloudfront::<account>:…`
   * has an EMPTY region segment; writing the stack's region there produces a
   * policy that fails at the invalidation rather than at synth. */
  const deploy = projectNamed('reconcile-deploy-')
  const template = templates[deploy.stackName]
  let checked = 0
  for (const [logicalId, resource] of resourcesOfType(template, 'AWS::IAM::Policy')) {
    for (const statement of resource.Properties?.PolicyDocument?.Statement ?? []) {
      const actions = [statement.Action ?? []].flat()
      if (!actions.some((a) => typeof a === 'string' && a.startsWith('cloudfront:'))) continue
      for (const arn of [statement.Resource ?? []].flat()) {
        const spelled = JSON.stringify(arn)
        checked += 1
        assert.match(
          spelled,
          /cloudfront::/,
          `${logicalId}: ${spelled} is not a region-less CloudFront ARN. The region ` +
            'segment is EMPTY for CloudFront; an ARN carrying one matches nothing and ' +
            'fails at the invalidation, not at synth.',
        )
      }
    }
  }
  assert.ok(checked > 0, 'no CloudFront ARN was read; this assertion checked nothing')
})

test('test_the_build_stage_fails_on_an_npm_advisory_because_the_ecr_scan_cannot_see_node_modules', async () => {
  const build = allCodeBuildProjects().find(({ resource }) =>
    /reconcile-build-/.test(JSON.stringify(resource.Properties?.Name ?? '')),
  )
  assert.ok(build !== undefined, 'no build project found in any synthesised stack')

  const yaml = build.resource.Properties?.Source?.BuildSpec
  assert.equal(typeof yaml, 'string', 'the build project has no inline buildspec')

  // §1 · THE GATE IS THERE. ECR BASIC scanning reads OS packages and does not
  // open node_modules — measured on the running image: COMPLETE, 0 findings,
  // while `fast-uri` sat in the tree across four CVSS 7.5 advisories.
  assert.match(
    yaml,
    /npm audit --json/,
    'the build stage does not audit npm dependencies. The ECR scan is on BASIC, ' +
      'whose scope is OPERATING-SYSTEM PACKAGES — it does not open node_modules, ' +
      'so without this every npm dependency in the image is ungated.',
  )

  // §2 · AND IT RUNS BEFORE THE IMAGE IS USED ONWARD. A dependency gate that
  // fires after the digest is written is a gate on nothing.
  const audit = yaml.indexOf('npm audit --json')
  const digest = yaml.indexOf('image-digest.txt')
  assert.ok(digest !== -1, 'the build stage no longer writes image-digest.txt')
  assert.ok(audit < digest, 'the npm audit gate runs after the digest is handed onward')

  // §3 · THE ENGINE IS WITNESSED. The refusal is extracted from the synthesised
  // buildspec and run against a clean report, a report with a HIGH, and a
  // report with no counts at all — the last being the fail-closed case.
  const line = buildspecCommands(yaml)
    .join('\n')
    .split('\n')
    .find((l) => l.includes('npm audit counts'))
  assert.ok(line !== undefined, 'the audit refusal is not on any command line')
  const js = line.slice(line.indexOf('"') + 1, line.lastIndexOf('"'))

  const cases = [
    [{ metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 3, low: 9 } } }, false],
    [{ metadata: { vulnerabilities: { critical: 0, high: 1, moderate: 0, low: 0 } } }, true],
    [{ metadata: { vulnerabilities: { critical: 2, high: 0, moderate: 0, low: 0 } } }, true],
    [{ metadata: {} }, true],
    [{}, true],
  ]
  for (const [report, mustExit] of cases) {
    const dir = await mkdtemp(join(tmpdir(), 'npm-audit-gate-'))
    await writeFile(join(dir, 'npm-audit.json'), JSON.stringify(report))
    const run = spawnSync(process.execPath, ['-e', js], { cwd: dir, encoding: 'utf8' })
    assert.equal(
      run.status !== 0,
      mustExit,
      `${JSON.stringify(report)} exited ${run.status}; expected ` +
        `${mustExit ? 'a refusal' : 'a pass'}.\n${run.stderr}${run.stdout}`,
    )
  }
})

// ------------- 7. W0-d · the waiter budget must fit inside the stage timeout

/**
 * 🛑 A WAITER BUDGET LARGER THAN THE STAGE TIMEOUT IS A SPLIT FLEET, AND IT IS A
 * SECOND PATH THAT W0-b DOES NOT CLOSE.
 *
 * Both `migrate_plane` and `deploy_plane` are called TWICE — control, then
 * data — and each call carries the full `*_WAIT_ROUNDS` budget. CodeBuild's
 * timeout kills the BUILD, so when it fires between the two calls the control
 * plane has been updated and the data plane has not: two images, one fleet, and
 * a stage failure whose message says "timeout". W0-b makes a slow-but-good
 * deploy pass; it cannot make a killed stage finish.
 *
 * ⚠️ THE THREE WAITER CEILINGS ARE AWS'S AND ARE NOT DERIVABLE FROM THIS TREE.
 * They are botocore's own waiter definitions, named here with their provenance
 * rather than pretended to be measured. All three happen to be ten minutes:
 *
 *     ECS   ServicesStable             delay 15s × 40 attempts
 *     ECS   TasksStopped               delay  6s × 100 attempts
 *     CloudFront InvalidationCompleted delay 20s × 30 attempts
 *
 * An over-estimate is the safe direction for a CEILING, which is why a waiter
 * whose real ceiling moved down would not make this assertion wrong.
 *
 * Everything else is read from the synthesised template and from the buildspec.
 */
const AWS_WAITER_CEILING_MINUTES = 10

/** Minutes of headroom a stage needs for the work it does while NOT waiting. */
const HEADROOM_MINUTES = 15

function deployProjectEnv(name) {
  const project = projectNamed('reconcile-deploy-').resource
  const found = (project.Properties?.Environment?.EnvironmentVariables ?? []).find(
    (v) => v.Name === name,
  )
  assert.ok(found !== undefined, `the Deploy project sets no ${name}`)
  return Number(found.Value)
}

function timeoutMinutes(fragment) {
  const minutes = projectNamed(fragment).resource.Properties?.TimeoutInMinutes
  assert.equal(typeof minutes, 'number', `${fragment} has no TimeoutInMinutes`)
  return minutes
}

/** How many times a buildspec calls one of its own plane functions. */
function planeCalls(yaml, fn) {
  const calls = buildspecCommands(yaml)
    .join('\n')
    .split('\n')
    .filter((l) => new RegExp(`^\\s*${fn} (control|data) `).test(l))
  assert.equal(
    calls.length,
    2,
    `${fn} is called ${calls.length} times, not twice. The arithmetic below ` +
      'multiplies by the number of calls, so a third plane changes the answer.',
  )
  return calls.length
}

/**
 * ⚠️ **THE DEPLOY ARITHMETIC IS RE-DERIVED UNDER G2041/G2047 AND THE BUDGET WENT
 * DOWN, 110 → 90 — WHICH IS WORTH A LINE BECAUSE IT IS THE OPPOSITE OF WHAT A
 * BIGGER DEPLOY STAGE LOOKS LIKE.** The red this replaces is quoted rather than
 * narrated:
 *
 *   ✖ test_the_deploy_stage_timeout_exceeds_its_own_worst_case_waiter_budget
 *     AssertionError: deploy_plane is called 0 times, not twice.
 *   ✖ test_the_arithmetic_above_reads_real_numbers_rather_than_passing_vacuously
 *     AssertionError: the Deploy project sets no DEPLOY_WAIT_ROUNDS
 *
 * **`DEPLOY_WAIT_ROUNDS 4 × 10 min × 2 planes = 80` was the ECS waiter loop this
 * stage no longer runs.** One CloudFormation update replaces two per-plane ECS
 * rollouts, and its waiter is botocore's `StackUpdateComplete` — 30s × 120
 * attempts — which is named below exactly as the other three ceilings are.
 */
const CLOUDFORMATION_WAITER_CEILING_MINUTES = 60

test('test_the_deploy_stage_timeout_exceeds_its_own_worst_case_waiter_budget', () => {
  const yaml = projectNamed('reconcile-deploy-').resource.Properties.Source.BuildSpec

  const planes = planeCalls(yaml, 'settle_plane')
  const stackRounds = deployProjectEnv('STACK_UPDATE_WAIT_ROUNDS')
  const pollRounds = deployProjectEnv('ROLLOUT_POLL_ROUNDS')

  const sleep = yaml.match(/ROLLOUT_POLL_SLEEP_SECONDS=(\d+)/)
  assert.ok(sleep !== null, 'the rollout poll interval is not spelled in the buildspec')
  const pollSleepSeconds = Number(sleep[1])

  /* ⚠️ **THE TWO INVALIDATION WAITERS LEFT THIS SUM ON 28 Sep 2026 — G2221 —
   * AND THE TERMS ARE NOT DELETED, THEY ARE RE-DERIVED IN THE TEST BELOW
   * AGAINST THE PROJECT THAT NOW WAITS ON THEM.** A budget that simply lost
   * twenty minutes would be a smaller number nobody checked; the point of this
   * section is that every waiter in the pipeline is inside SOME timeout.
   *
   * 🛑 AND THIS IS THE ASSERTION THAT MAKES THAT TRUE: the Deploy buildspec
   * must no longer wait on an invalidation at all. If the frontend half were
   * half-moved — the commands left here and the grants moved away — this goes
   * red rather than the stage failing at run time with an AccessDenied. */
  assert.equal(
    (yaml.match(/aws cloudfront wait invalidation-completed/g) ?? []).length,
    0,
    'the Deploy buildspec still waits on a CloudFront invalidation. Since G2221 ' +
      'that is reconcile-publish-`s work and its ten-minute waiters are inside ' +
      'THAT project`s timeout, not this one`s.',
  )

  /* ONE stack update covers BOTH planes — CloudFormation moves the two
   * services inside one changeset — so this term is NOT multiplied by `planes`.
   * The rollout polls still are. */
  const stackUpdate = stackRounds * CLOUDFORMATION_WAITER_CEILING_MINUTES
  const rolloutPolls = (planes * pollRounds * pollSleepSeconds) / 60
  const budget = stackUpdate + rolloutPolls
  const floor = budget + HEADROOM_MINUTES
  const timeout = timeoutMinutes('reconcile-deploy-')

  assert.ok(
    timeout >= floor,
    `the Deploy stage may wait for ${budget} minutes and its timeout is ${timeout}. ` +
      `CodeBuild kills the STAGE and not the CloudFormation update, so the stack ` +
      `goes on applying with nothing left watching it and no stage to report it.\n` +
      `    stack update      ${stackRounds} rounds × ${CLOUDFORMATION_WAITER_CEILING_MINUTES} min                  = ${stackUpdate}\n` +
      `    rollout polls     ${planes} planes × ${pollRounds} × ${pollSleepSeconds}s          = ${rolloutPolls}\n` +
      `    headroom                                        = ${HEADROOM_MINUTES}\n` +
      `                                                      ------\n` +
      `    floor                                             ${floor}\n` +
      `Raise the timeout, or argue the budget down — and if you shrink a waiter ` +
      `budget instead, say why a genuinely slow rollout should start failing.`,
  )
})

/**
 * 🛑 G2224 — THE OTHER HALF OF THE SAME ARITHMETIC, AND IT EXISTS BECAUSE A
 * SPLIT PROJECT IS EXACTLY WHERE A WAITER GOES UNCOUNTED.
 *
 * The twenty minutes of CloudFront waiting used to be inside the Deploy
 * project's 150-minute ceiling. Moving the commands without moving the
 * derivation would have left two invalidation waiters inside whatever timeout
 * a new `PipelineProject` happens to default to — and CodeBuild's default is
 * SIXTY minutes, which would have covered it by luck rather than by argument.
 * *"Killed between the two distributions"* is the failure: the tenant edge
 * invalidated, the consoles still serving an `index.html` that names hashed
 * assets the sync has already deleted.
 */
test('test_the_publish_stage_timeout_exceeds_its_own_worst_case_waiter_budget', () => {
  const yaml = projectNamed('reconcile-publish-').resource.Properties.Source.BuildSpec

  const invalidations = (yaml.match(/aws cloudfront wait invalidation-completed/g) ?? []).length
  const distributions = (yaml.match(/^\s*invalidate (tenant|console) /gm) ?? []).length
  assert.ok(invalidations > 0, 'the publish stage no longer waits for an invalidation at all')
  assert.equal(
    distributions,
    2,
    'G297 put TWO distributions in front of one bucket; each carries its own ' +
      'ten-minute waiter and both are inside this timeout',
  )

  const budget = distributions * AWS_WAITER_CEILING_MINUTES
  const floor = budget + HEADROOM_MINUTES
  const timeout = timeoutMinutes('reconcile-publish-')

  assert.ok(
    timeout >= floor,
    `the Publish stage may wait for ${budget} minutes and its timeout is ${timeout}. ` +
      `CodeBuild would kill it BETWEEN the two distributions, leaving the tenant ` +
      `edge invalidated and the consoles on an index.html naming hashed assets ` +
      `the sync has already deleted.\n` +
      `    invalidations     ${distributions} × ${AWS_WAITER_CEILING_MINUTES} min                    = ${budget}\n` +
      `    headroom                                        = ${HEADROOM_MINUTES}\n` +
      `                                                      ------\n` +
      `    floor                                             ${floor}\n`,
  )
})

test('test_the_migrate_stage_timeout_exceeds_its_own_worst_case_waiter_budget', () => {
  /* 🛑 THE SAME DEFECT LIVED HERE AND WAS WORSE, AND IT WAS FOUND BY DOING THE
   * DERIVATION RATHER THAN BY READING THE COMMENT. That project's timeout
   * carried the words "Longer than the waiter budget, deliberately" beside a
   * budget of 120 minutes and a timeout of 90 — because the sentence reasons
   * about ONE `migrate_plane` call and the stage makes TWO. §5.1 in a comment.
   *
   * ⚠️ AND THE CONSEQUENCE IS THE ONE THAT COMMENT EXISTS TO PREVENT, arriving
   * between the two calls instead of inside one: CodeBuild's timeout kills the
   * BUILD and not the ECS task, so a forward-only migration goes on applying
   * with nothing watching it and no stage left to report what it did. */
  const yaml = projectNamed('reconcile-migrate-').resource.Properties.Source.BuildSpec

  const planes = planeCalls(yaml, 'migrate_plane')
  const project = projectNamed('reconcile-migrate-').resource
  const rounds = Number(
    (project.Properties?.Environment?.EnvironmentVariables ?? []).find(
      (v) => v.Name === 'MIGRATE_WAIT_ROUNDS',
    )?.Value,
  )
  assert.ok(Number.isFinite(rounds), 'the Migrate project sets no MIGRATE_WAIT_ROUNDS')

  const budget = planes * rounds * AWS_WAITER_CEILING_MINUTES
  const floor = budget + HEADROOM_MINUTES
  const timeout = timeoutMinutes('reconcile-migrate-')

  assert.ok(
    timeout >= floor,
    `the Migrate stage may wait for ${budget} minutes (${planes} planes × ` +
      `${rounds} rounds × ${AWS_WAITER_CEILING_MINUTES} min) plus ${HEADROOM_MINUTES} ` +
      `of headroom, and its timeout is ${timeout}. Killed at ${timeout}, the ` +
      `control database is migrated and the data one is half-way through a ` +
      `forward-only migration nothing is watching.`,
  )
})

test('test_the_arithmetic_above_reads_real_numbers_rather_than_passing_vacuously', () => {
  /* The control on the control. Every assertion in §7 passes trivially if the
   * template yields 0 rounds and 0 planes, or if `projectNamed` ever starts
   * returning a project with no environment at all — the same shape §5 states
   * for the buildspec scans. */
  assert.ok(deployProjectEnv('STACK_UPDATE_WAIT_ROUNDS') > 0, 'STACK_UPDATE_WAIT_ROUNDS read as 0')
  assert.ok(deployProjectEnv('ROLLOUT_POLL_ROUNDS') > 0, 'ROLLOUT_POLL_ROUNDS read as 0')
  assert.ok(timeoutMinutes('reconcile-deploy-') > 0, 'the Deploy timeout read as 0')
  assert.ok(timeoutMinutes('reconcile-publish-') > 0, 'the Publish timeout read as 0')
  assert.ok(timeoutMinutes('reconcile-migrate-') > 0, 'the Migrate timeout read as 0')
  assert.ok(
    AWS_WAITER_CEILING_MINUTES > 0 &&
      CLOUDFORMATION_WAITER_CEILING_MINUTES > 0 &&
      HEADROOM_MINUTES > 0,
    'a zero ceiling or a zero headroom makes every comparison above trivially true',
  )
})

// ----------- 8. G2221 · the INLINE buildspec ceiling, which AWS does not publish

/**
 * 🛑 CODEBUILD REFUSES AN INLINE BUILDSPEC LONGER THAN 25,600 CHARACTERS, AND
 * NOTHING IN THIS REPOSITORY COULD SEE THAT UNTIL THIS ASSERTION EXISTED.
 *
 * `cdk synth` renders an oversized buildspec perfectly happily, `cdk diff`
 * shows it, `npm run check` goes green over it, and every other suite in
 * `tests/infra/` reads it without complaint. **The ceiling exists only at the
 * `CreateProject` / `UpdateProject` API**, so the first thing that knows about
 * it is a deploy, and the way it says so is a stack rollback. The captured
 * RED, `reconcile-pipeline-staging`, 28 Sep 2026:
 *
 *     UPDATE_FAILED | AWS::CodeBuild::Project | Deploy
 *     Resource handler returned message: "Failed to call UpdateProject, reason:
 *     Max buildspec length is 25600 (Service: AWSCodeBuild; Status Code: 400;
 *     Error Code: InvalidInputException)"
 *
 * ⚠️ **AND THE NUMBER IS NOT IN AWS'S PUBLISHED QUOTAS, WHICH IS WHY IT IS
 * TYPED HERE RATHER THAN DERIVED FROM ANYTHING.** Measured 28 Sep 2026:
 * `aws service-quotas list-service-quotas --service-code codebuild` returns
 * concurrency limits and nothing else, and the *Quotas for AWS CodeBuild* page
 * documents a project's NAME length (2–150) and its DESCRIPTION length (255)
 * and **says nothing whatever about a buildspec**. The only place 25,600 is
 * written down is the error above, so that is where this constant comes from
 * and that is why the error is quoted beside it.
 *
 * 🛑 **IT IS TYPED, NOT IMPORTED — the rule this whole file states at its
 * head.** Reading `CODEBUILD_INLINE_BUILDSPEC_BYTES` out of
 * `infra/lib/buildspecs.ts` and comparing it to a buildspec generated from
 * `infra/lib/buildspecs.ts` is a comparison that cannot fail. The two are
 * joined instead by the drift check below, which asserts the module declares
 * the same number — so moving one without the other is a red gate.
 *
 * ⚠️ **EVERY PROJECT, NOT THE ONE THAT BROKE.** Keying this on
 * `reconcile-deploy-` would be §5.1 exactly: a rule pointed at the landmark
 * that failed rather than at the property, which is that NO inline buildspec
 * may exceed the ceiling. The Gate, the pull-request Gate, the Build, the
 * Migrate, the Deploy, the Publish and the CI image project are all held to
 * it, in every stack the app synthesises.
 */
const CODEBUILD_INLINE_BUILDSPEC_LIMIT = 25600

test('test_no_synthesised_buildspec_exceeds_codebuilds_inline_ceiling', () => {
  const measured = []
  for (const { stackName, logicalId, resource } of allCodeBuildProjects()) {
    const yaml = resource.Properties?.Source?.BuildSpec
    if (typeof yaml !== 'string') continue
    measured.push({ stackName, logicalId, length: yaml.length })
  }

  /* The control on the control — §5 of this file, one section over. Every
   * assertion below passes trivially against an empty list, and an empty list
   * is exactly what a renamed property or a changed synth shape produces. */
  assert.ok(
    measured.length >= 5,
    'expected at least the gate, the PR gate, the build, the migrate and the ' +
      `deploy buildspecs; found ${measured.length}. An empty scan makes the ` +
      'ceiling below vacuous, which is the failure it exists to prevent.',
  )

  const table = measured
    .map((m) => `    ${String(m.length).padStart(6)}  ${m.stackName}/${m.logicalId}`)
    .join('\n')

  for (const { stackName, logicalId, length } of measured) {
    assert.ok(
      length <= CODEBUILD_INLINE_BUILDSPEC_LIMIT,
      `${stackName}/${logicalId} synthesises an inline buildspec of ${length} ` +
        `characters and CodeBuild accepts at most ${CODEBUILD_INLINE_BUILDSPEC_LIMIT}. ` +
        `cdk synth and cdk diff will BOTH show it happily; the refusal comes from ` +
        `UpdateProject, so the first thing that would notice is a deploy, and it ` +
        `notices by rolling the stack back.\n` +
        `  every synthesised buildspec:\n${table}\n` +
        `  The repair is not to delete comments — they are the artefact this ` +
        `buildspec exists to carry into the console. It is to SPLIT the project, ` +
        `as G2221 split Deploy into Deploy and Publish.`,
    )
  }
})

test('test_the_buildspec_module_declares_the_same_inline_ceiling_this_test_asserts', () => {
  /* The join between the number typed above and the number the synth-time
   * refusal in `attachBuildSpecYaml` uses. Neither is read from the other —
   * this asserts they AGREE, which is the only comparison of the two that can
   * fail. `tests/infra/pipeline-stack-value.test.mjs` §8 makes exactly this
   * join for CloudFormation's 51,200-byte inline template ceiling. */
  const source = readFileSync(join(REPO_ROOT, 'infra', 'lib', 'buildspecs.ts'), 'utf8')
  assert.match(
    source,
    /CODEBUILD_INLINE_BUILDSPEC_BYTES = 25_600/,
    'infra/lib/buildspecs.ts no longer declares CODEBUILD_INLINE_BUILDSPEC_BYTES ' +
      `as 25_600, and this test asserts ${CODEBUILD_INLINE_BUILDSPEC_LIMIT}. One ` +
      'moved without the other, so the synth-time refusal and the gate now ' +
      'disagree about what CodeBuild accepts.',
  )
})
