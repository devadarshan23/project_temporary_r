/**
 * G2041 — THE PIPELINE WRITES THE STACK VALUE, AND THIS IS WHAT HOLDS IT.
 *
 * ┌─ 🛑 THE DEFECT, MEASURED AGAINST AWS AND REPRODUCIBLE READ-ONLY ───────────┐
 * │ The Deploy stage registered a task definition and called `UpdateService`,  │
 * │ and **never wrote anything back to CloudFormation** — so after EVERY       │
 * │ deploy the SERVICE moved and the STACK did not. 23 Sep 2026:              │
 * │                                                                            │
 * │   reconcile-staging-data-plane                                             │
 * │     running        …DataPlaneTaskB4F25A67:43  cc58f357…  09-23T10:51       │
 * │     CloudFormation …DataPlaneTaskB4F25A67:40  56d9d053…  09-20T07:54       │
 * │     *** DRIFT ***                                                          │
 * │                                                                            │
 * │ `56d9d053…` was running NOWHERE. A bare                                    │
 * │ `cdk deploy reconcile-planes-staging` would have rolled both planes back   │
 * │ two days, silently, against a forward-only schema (G88) — which is         │
 * │ G1012's and G1013's whole subject.                                         │
 * │                                                                            │
 * │   AWS_PROFILE=crm-frontend node tests/e2e/probe-deployed-image.mjs         │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 🛑 WHY THIS IS ITS OWN FILE AND NOT A SECTION OF `pipeline.test.mjs` ─────┐
 * │ That suite is nineteen hundred lines and its subject is the pipeline's     │
 * │ SHAPE — its stages, its gate, its fences, its arithmetic. This one has a   │
 * │ single subject, ONE question, and it needs machinery none of the rest      │
 * │ wants: it synthesises `Planes` at two DIFFERENT image tags and runs the    │
 * │ Deploy stage's own embedded scripts over the result.                       │
 * │                                                                            │
 * │ ⚠️ **FIVE ASSERTIONS IN THAT FILE WERE CHANGED BY THIS SLICE RATHER THAN   │
 * │ MOVED HERE, EACH WITH ITS CAPTURED RED QUOTED AT ITS OWN SITE** — G2046.   │
 * │ A control that is deleted when it fires is not a control, so none of them  │
 * │ was dropped: the by-digest arm for `deploy` became the tag-against-digest  │
 * │ check below, the zero-desired ordering was re-keyed off a waiter that no   │
 * │ longer exists and onto the ACT, and the timeout arithmetic was             │
 * │ re-derived (110 → 90 minutes).                                             │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ **NOTHING HERE REACHES AWS.** The probe that measures the live fleet is
 * `tests/e2e/probe-deployed-image.mjs`, and G108's determinism condition keeps
 * it out of the gate for ever. What IS assertable at `npm run check` is the
 * MECHANISM: that the stage writes the tag, that the write is narrow, and that
 * the thing it writes is byte-for-byte what CDK would have synthesised.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'

import { ensureDeps, resourcesOfType, synthesisedTemplates } from './support.mjs'

await ensureDeps()

const templates = synthesisedTemplates()

/** Every CodeBuild project in the app, as [logicalId, resource] pairs. */
function projects() {
  const out = []
  for (const template of Object.values(templates)) {
    for (const pair of resourcesOfType(template, 'AWS::CodeBuild::Project')) out.push(pair)
  }
  return out
}

function projectNamed(fragment) {
  const found = projects().find(([, r]) =>
    new RegExp(fragment).test(JSON.stringify(r.Properties?.Name ?? '')),
  )
  assert.ok(found !== undefined, `no CodeBuild project matching ${fragment}`)
  return found[1]
}

/** The Deploy stage's buildspec, as CodeBuild will receive it. */
const deploySpec = () => projectNamed('reconcile-deploy-').Properties.Source.BuildSpec

/**
 * ┌─ 🛑 TWO DIFFERENT THINGS IN THIS STACK GENERATE A LOGICAL ID BEGINNING ────┐
 * │ `DeployRoleDefaultPolicy`, AND THE FIRST DRAFT OF THIS FILE COULD NOT TELL │
 * │ THEM APART — G2049. IT IS §5.1, FOUND BY RUNNING THE TEST.                 │
 * │                                                                            │
 * │   DeployRoleDefaultPolicy9A3389B6  ← the CodeBuild project `Deploy`'s own  │
 * │                                      service-role policy. THE NARROW ONE:  │
 * │                                      five verbs on ONE named stack.        │
 * │   DeployRoleDefaultPolicyDC930F96  ← the standalone `DeployRole`, G263's   │
 * │                                      general CloudFormation fence, which   │
 * │                                      NO pipeline action assumes and which  │
 * │                                      carries CreateStack and DeleteStack.  │
 * │                                                                            │
 * │ A project called `Deploy` and a role called `DeployRole` produce ids a     │
 * │ prefix cannot separate. The captured red, from the exemption keyed on the  │
 * │ NAME:                                                                      │
 * │                                                                            │
 * │   ✖ test_the_pipeline_may_update_one_named_stack_and_may_not_create_or_    │
 * │     delete_any                                                             │
 * │     AssertionError: no CloudFormation statement was read at all; this      │
 * │     assertion checked nothing                                              │
 * │                                                                            │
 * │ **The exemption had swallowed the very statement it exists to check**, and │
 * │ only the anti-vacuity guard turned that into a failure instead of a pass.  │
 * │                                                                            │
 * │ ⚠️ SO THE DISCRIMINATOR IS A PROPERTY AND NOT A NAME: the standalone fence │
 * │ is the one role in this stack created with an explicit `RoleName`, because │
 * │ it is meant to be assumed by something one day. A generated service role   │
 * │ has none.                                                                  │
 * └────────────────────────────────────────────────────────────────────────────┘
 */
function unassumedDeployFenceRoleIds() {
  const template = templates['reconcile-pipeline-staging']
  const ids = new Set()
  for (const [logicalId, resource] of resourcesOfType(template, 'AWS::IAM::Role')) {
    const name = resource.Properties?.RoleName
    if (typeof name === 'string' && /^reconcile-deploy-/.test(name)) ids.add(logicalId)
  }
  assert.equal(
    ids.size,
    1,
    'expected exactly one explicitly-named reconcile-deploy-* role — G263 fence. ' +
      `Found ${ids.size}. If a second one is legitimate, name it here.`,
  )
  return ids
}

/** Is this policy attached to the unassumed CloudFormation fence role? */
function attachedToUnassumedFence(resource, fenceIds) {
  return (resource.Properties?.Roles ?? []).some((r) => fenceIds.has(r?.Ref))
}

/** Every command line of a buildspec, parsed as YAML rather than scanned. */
function commandLines(yaml) {
  const phases = parseYaml(yaml)?.phases ?? {}
  const out = []
  for (const phase of Object.values(phases)) {
    for (const command of phase?.commands ?? []) out.push(...String(command).split('\n'))
  }
  return out
}

/**
 * One embedded `node -e` script, extracted from the SYNTHESISED buildspec.
 *
 * ⚠️ IT READS THE TEMPLATE AND NEVER THE MODULE. Importing the constant out of
 * `infra/lib/buildspecs.ts` would prove a variable equals itself; what has to
 * hold is that the script CodeBuild will actually run does the thing.
 */
function embeddedScript(yaml, marker) {
  const line = commandLines(yaml).find((l) => l.includes(marker) && l.includes('node -e'))
  assert.ok(line !== undefined, `no command line carries ${marker} and a node -e script`)
  const open = line.indexOf("node -e '")
  const close = line.lastIndexOf("'")
  assert.ok(open !== -1 && close > open, `could not extract the script beside ${marker}`)
  return line.slice(open + "node -e '".length, close)
}

// ──────────────────────────────────────────────────────────── §1 · the retag

/**
 * 🛑 §1 — THE RETAG PRODUCES BYTE-FOR-BYTE WHAT CDK WOULD HAVE SYNTHESISED,
 *    AND THIS IS THE ASSERTION THE WHOLE SLICE RESTS ON.
 *
 * The Deploy stage does not run `cdk`. It takes the template CLOUDFORMATION
 * ALREADY HAS and rewrites the image tag in it — which is what makes the update
 * narrow BY CONSTRUCTION rather than by review, because a `planes-stack.ts`
 * change somebody merged cannot ride along in a template CDK never produced.
 *
 * **What makes that safe is that the result is nevertheless exactly CDK's own
 * output for the new tag**, so the invariant *the deployed template is what
 * `cdk synth -c planeImageTag=<the tag it owns>` produces* SURVIVES the write
 * rather than being spent by it. That invariant is live and was measured
 * against the real stack on 23 Sep 2026: 32 resources, zero differing.
 *
 * ⚠️ **BOTH TAGS ARE TYPED INTO THIS FILE AND NEITHER IS READ FROM A STACK.**
 * Comparing a stack to the constant it was built from proves only that a
 * variable equals itself.
 */
const TAG_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const TAG_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const PLANE_REPOSITORY = 'reconcile/planes-staging'

/** `Planes`, synthesised at one typed-in tag, out of the real app. */
const planesAt = (tag) => synthesisedTemplates({ planeImageTag: tag })['reconcile-planes-staging']

/** Run the extracted retag script over a template, in a throwaway directory. */
async function retag(template, { tag, repository }) {
  const dir = await mkdtemp(join(tmpdir(), 'reconcile-retag-'))
  await writeFile(join(dir, 'template-current.json'), JSON.stringify(template))
  const run = spawnSync(process.execPath, ['-e', embeddedScript(deploySpec(), 'REPOSITORY=')], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, TAG: tag, REPOSITORY: repository },
  })
  return { ...run, dir }
}

test('test_the_retag_produces_exactly_what_cdk_would_have_synthesised_for_the_new_tag', async () => {
  const atA = planesAt(TAG_A)
  const atB = planesAt(TAG_B)

  /* Anti-vacuity, and it is not a formality: without it this test passes
   * against a retag script that does nothing at all. */
  assert.notDeepStrictEqual(
    atA,
    atB,
    'the Planes template is identical at two different image tags, so the ' +
      'comparison below would be satisfied by a script that is a no-op',
  )

  const run = await retag(atA, { tag: TAG_B, repository: PLANE_REPOSITORY })
  assert.equal(run.status, 0, `the retag refused a template it must accept:\n${run.stderr}`)

  const produced = JSON.parse(readFileSync(join(run.dir, 'template-next.json'), 'utf8'))
  assert.equal(
    JSON.stringify(produced),
    JSON.stringify(atB),
    'the retagged template is NOT what `cdk synth -c planeImageTag=<new tag>` ' +
      'produces. The whole slice rests on this: a pipeline that writes a template ' +
      'CDK would not have written makes every later `cdk diff` dirty for ever, ' +
      'and a reader can then no longer tell an infrastructure change from the ' +
      'image moving — which is the control §11.4 of the deploy handoff asks a ' +
      'human to apply before every deploy.',
  )

  /* And it reports what it did, because a silent rewrite of four containers is
   * a rewrite nobody can check in a build log. */
  assert.match(run.stdout, /retagged 4 container image\(s\)/, 'the retag does not report its work')
})

/**
 * 🛑 §2 — AN IMAGE THAT IS NOT OURS IS FATAL, NEVER SKIPPED.
 *
 * A sidecar — a log router, an agent — would carry a different image, and a
 * rule that quietly left it alone would be correct today and wrong the day
 * somebody adds one. **Refusing names the container and stops.** Skipping would
 * deploy a stack whose sidecar is pinned to whatever it was pinned to when
 * nobody was looking.
 */
test('test_the_retag_refuses_an_image_that_is_not_in_this_products_repository', async () => {
  const withSidecar = JSON.parse(JSON.stringify(planesAt(TAG_A)))
  const taskDefinitions = Object.values(withSidecar.Resources).filter(
    (r) => r.Type === 'AWS::ECS::TaskDefinition',
  )
  assert.ok(taskDefinitions.length > 0, 'no task definition to plant a sidecar in')
  taskDefinitions[0].Properties.ContainerDefinitions.push({
    Name: 'a-log-router-somebody-added',
    Image: 'public.ecr.aws/aws-observability/aws-for-fluent-bit:2.31.0',
  })

  const run = await retag(withSidecar, { tag: TAG_B, repository: PLANE_REPOSITORY })
  assert.equal(run.status, 1, 'the retag accepted a container image from another repository')
  assert.match(run.stderr, /a-log-router-somebody-added/, 'the refusal does not name the container')
})

/**
 * 🛑 §2a — AND THE NARROWNESS IS CHECKED RATHER THAN CLAIMED.
 *
 * Before the result is written, both templates are re-serialised with every
 * task-definition container image blanked out and compared. If those two
 * strings differ, the mutation touched something other than an image and the
 * stage stops. **This asserts the positive direction — everything that is not
 * an image survives the rewrite untouched** — over the whole template rather
 * than over a field somebody remembered.
 */
test('test_the_retag_changes_the_image_and_nothing_else_in_the_whole_template', async () => {
  const atA = planesAt(TAG_A)
  const run = await retag(atA, { tag: TAG_B, repository: PLANE_REPOSITORY })
  assert.equal(run.status, 0, run.stderr)
  const produced = JSON.parse(readFileSync(join(run.dir, 'template-next.json'), 'utf8'))

  const blank = (t) => {
    const c = JSON.parse(JSON.stringify(t))
    for (const r of Object.values(c.Resources ?? {})) {
      if (r.Type !== 'AWS::ECS::TaskDefinition') continue
      for (const d of r.Properties?.ContainerDefinitions ?? []) d.Image = '<image>'
    }
    return JSON.stringify(c)
  }
  assert.equal(
    blank(produced),
    blank(atA),
    'the retag changed something that is not a task-definition container image. ' +
      'It is supposed to be narrow BY CONSTRUCTION — the template comes from ' +
      'CloudFormation and only the tag is touched — so this is a defect in the ' +
      'script rather than in the template.',
  )

  /* Anti-vacuity on the blanking itself: if `blank` erased everything, the
   * comparison above would hold for any two templates. */
  assert.notEqual(
    blank(atA),
    blank({ Resources: {} }),
    'the blanking function erases the whole template, so the comparison above ' +
      'is trivially true',
  )
})

// ───────────────────────────────────────────── §3 · G262, paid differently

/**
 * 🛑 §3 — G262 IS PAID FOR DIFFERENTLY AND MORE EXPENSIVELY, NOT SPENT.
 *
 * The Deploy stage writes a TAG now, because a stack's idea of the image can
 * only live in its template and a DIGEST there would make every later
 * `cdk diff` permanently dirty. *"A commit sha names a commit, not bytes"* is
 * therefore answered by asking the REGISTRY, at the moment of use, whether this
 * sha names the bytes the Build stage produced — and refusing if it does not.
 *
 * ⚠️ **THAT IS STRICTLY STRONGER THAN THE ECR-IMMUTABILITY ASSUMPTION IT
 * REPLACES**, which `planes-stack.ts` has relied on since it was written:
 * immutability refuses to MOVE a tag and does not refuse to delete one and push
 * it again, and this repository's own lifecycle rule deletes images by design
 * (it keeps the fifty most recent — the probe has already met an expired one).
 */
test('test_the_deploy_stage_refuses_to_write_a_tag_the_registry_does_not_resolve_to_its_digest', () => {
  const yaml = deploySpec()

  assert.match(
    yaml,
    /image-digest\.txt/,
    'the deploy stage no longer reads the digest the Build stage resolved from ' +
      'the registry, so it has nothing to check the tag against',
  )
  assert.match(
    yaml,
    /image-tag\.txt/,
    'the deploy stage does not read the tag out of the Build artefact. ' +
      '$CODEBUILD_RESOLVED_SOURCE_VERSION is an ARTEFACT version in this stage ' +
      'and not a commit sha — the Migrate buildspec says so in its own voice — ' +
      'so a stage that needs the tag must be HANDED it.',
  )
  assert.match(
    yaml,
    /aws ecr describe-images .*imageTag="\$TAG"/,
    'nothing asks the registry what this tag resolves to, so the tag written ' +
      'into CloudFormation is believed rather than checked',
  )
  assert.match(
    yaml,
    /if \[ "\$TAGGED_DIGEST" != "\$DIGEST" \]/,
    'the registry is asked and its answer is not compared against the digest. ' +
      'A check whose result is discarded is docs/HANDOFF.md 5.6.',
  )
  assert.match(
    yaml,
    /image-tag\.txt does not hold a 40-hex commit sha/,
    'the tag shape is not refused, so `latest` could reach the template through ' +
      'this path even though `-c planeImageTag=latest` is refused at synth',
  )
})

/**
 * 🛑 §3a — THE BUILD STAGE MUST PUT THE TAG IN THE ARTEFACT, OR §3's READ FINDS
 *    NOTHING.
 *
 * Asserted on the PRODUCING side as well as the consuming one, because a
 * `test -s` on a file nobody writes fails four minutes into a pipeline run
 * rather than here — which is the lesson `PLANE_BUILD_BUILDSPEC_YAML` already
 * records having learned once.
 */
test('test_the_build_stage_carries_the_commit_tag_forward_in_its_artefact', () => {
  const yaml = projectNamed('reconcile-build-').Properties.Source.BuildSpec
  assert.match(
    yaml,
    /echo "\$CODEBUILD_RESOLVED_SOURCE_VERSION" > image-tag\.txt/,
    'the Build stage does not write image-tag.txt, so the Deploy stage has no ' +
      'commit sha to write into the Planes template',
  )
  const artefacts = parseYaml(yaml)?.artifacts?.files ?? []
  assert.ok(
    artefacts.includes('image-tag.txt'),
    'image-tag.txt is written and NOT declared as an artefact, so it never ' +
      `reaches the Deploy stage. Declared: ${JSON.stringify(artefacts)}`,
  )
  assert.ok(
    artefacts.includes('image-digest.txt'),
    'the digest must still travel in the artefact; §3 checks the tag against it, ' +
      'and the Migrate stage uses it and nothing else',
  )
})

// ─────────────────────────────────────────────────── §4 · the fence and its target

/**
 * 🛑 §4 — THE THREE NAMES FOR ONE STACK AGREE, DERIVED FROM THE CLOUD ASSEMBLY
 *    AND NOT FROM THE CONSTANT THEY WERE BUILT FROM.
 *
 * `infra/lib/config.ts` carries `STACK_PLANES_STAGING` as a literal and
 * `planesStackName()` as a function; the Deploy stage is fenced to the second
 * while CloudFormation gets the first. **If they drifted, the pipeline would be
 * fenced to a stack that does not exist and every deploy would fail at
 * `UpdateStack`** — loudly, which is the right direction, and still a failure
 * nobody chose. This is `0008`'s rule for what keeps a copy a MIRROR rather
 * than a third place to drift: assert it in both directions, against the
 * artefact rather than against the source.
 */
test('test_the_stack_the_deploy_stage_names_is_the_stack_the_app_actually_synthesises', () => {
  const deploy = projectNamed('reconcile-deploy-')
  const named = (deploy.Properties?.Environment?.EnvironmentVariables ?? []).find(
    (v) => v.Name === 'PLANES_STACK_NAME',
  )
  assert.ok(named !== undefined, 'the Deploy project does not name the Planes stack at all')

  const synthesised = Object.keys(templates).filter((k) => /^reconcile-planes-/.test(k))
  assert.equal(
    synthesised.length,
    1,
    `expected exactly one Planes stack in the app, found ${JSON.stringify(synthesised)}`,
  )
  assert.equal(
    named.Value,
    synthesised[0],
    'the Deploy stage names a Planes stack the app does not synthesise',
  )

  const statements = []
  for (const [, resource] of resourcesOfType(
    templates['reconcile-pipeline-staging'],
    'AWS::IAM::Policy',
  )) {
    statements.push(...(resource.Properties?.PolicyDocument?.Statement ?? []))
  }
  const update = statements.find((s) =>
    [s.Action ?? []].flat().includes('cloudformation:UpdateStack'),
  )
  assert.ok(update !== undefined, 'nothing grants cloudformation:UpdateStack, so nothing deploys')
  assert.ok(
    JSON.stringify(update.Resource ?? '').includes(`stack/${synthesised[0]}/`),
    `the UpdateStack grant is not scoped to ${synthesised[0]}: ` +
      JSON.stringify(update.Resource ?? ''),
  )
})

/**
 * 🛑 §5 — THE CLOUDFORMATION GRANT IS ONE NAMED STACK, AND `CreateStack` AND
 *    `DeleteStack` ARE ABSENT.
 *
 * G263: *"the pipeline role may … deploy stacks tagged `Project=reconcile` —
 * and nothing else in a SHARED account."* A pipeline that could CREATE a stack
 * could mint infrastructure on a merge; one that could DELETE this one could
 * take both planes and their load balancers out in a single green build.
 *
 * ⚠️ `DeployRole` IS EXEMPTED BY NAME AND NOT BY PATTERN. It is a general
 * CloudFormation fence for a `cdk deploy` nobody has written, deliberately
 * assumed by no pipeline action — `pipeline-stack.ts` argues that at length —
 * and it is allowed to be general precisely because nothing uses it.
 */
test('test_the_pipeline_may_update_one_named_stack_and_may_not_create_or_delete_any', () => {
  const forbidden = ['cloudformation:CreateStack', 'cloudformation:DeleteStack']
  const fence = unassumedDeployFenceRoleIds()
  let seen = 0
  for (const [stackName, template] of Object.entries(templates)) {
    for (const [logicalId, resource] of resourcesOfType(template, 'AWS::IAM::Policy')) {
      if (attachedToUnassumedFence(resource, fence)) continue
      for (const statement of resource.Properties?.PolicyDocument?.Statement ?? []) {
        const cfn = [statement.Action ?? []]
          .flat()
          .filter((a) => typeof a === 'string' && a.startsWith('cloudformation:'))
        if (cfn.length === 0) continue
        seen += 1
        for (const action of cfn) {
          assert.ok(
            !forbidden.includes(action),
            `${stackName}/${logicalId} grants ${action} to a CodeBuild project. ` +
              'The Deploy stage updates a stack that already exists; it has no ' +
              'business creating or destroying one.',
          )
        }
        assert.ok(
          ![statement.Resource ?? []].flat().includes('*'),
          `${stackName}/${logicalId} grants ${cfn.join(', ')} on Resource "*"`,
        )
      }
    }
  }
  assert.ok(seen > 0, 'no CloudFormation statement was read at all; this assertion checked nothing')
})

/**
 * 🛑 §6 — THE DEPLOY PROJECT NO LONGER HOLDS THE ECS WRITE VERBS, AND THE
 *    MIGRATE PROJECT STILL DOES.
 *
 * CloudFormation registers the revision and moves the services now, as the role
 * already associated with the `Planes` stack — so `RegisterTaskDefinition`,
 * `iam:PassRole` and `UpdateService` on this project would each be a privilege
 * that OUTLIVED the absence of its writer, which is `0004`'s rule in the
 * direction G510 used it to take `DELETE ON tenant.session` away.
 *
 * 🟢 **IT IS THE HALF OF THIS SLICE THAT MAKES THE ACCOUNT SAFER RATHER THAN
 * WIDER**: `iam:PassRole` on `reconcile-*` was the broadest grant this pipeline
 * held, and the one stage that runs on every merge to `main` and touches live
 * services no longer holds it.
 *
 * ⚠️ **THE SECOND HALF IS THE ANTI-VACUITY ARM**: without it this test passes
 * against a template in which BOTH projects lost their ECS grants, which is a
 * broken Migrate stage rather than a narrowed Deploy one.
 */
test('test_the_deploy_project_cannot_write_ecs_and_the_migrate_project_still_can', () => {
  /* ⚠️ THE FENCE ROLE IS EXCLUDED BY PROPERTY, NOT BY NAME — see
   * `unassumedDeployFenceRoleIds()`. A `^Deploy` prefix reads the UNION of the
   * Deploy project's policy and the standalone G263 fence, so this set would
   * silently acquire whatever that role holds. */
  const fence = unassumedDeployFenceRoleIds()
  const actionsOf = (rolePrefix) => {
    const out = new Set()
    for (const [logicalId, resource] of resourcesOfType(
      templates['reconcile-pipeline-staging'],
      'AWS::IAM::Policy',
    )) {
      if (!new RegExp(rolePrefix).test(logicalId)) continue
      if (attachedToUnassumedFence(resource, fence)) continue
      for (const statement of resource.Properties?.PolicyDocument?.Statement ?? []) {
        for (const a of [statement.Action ?? []].flat()) out.add(a)
      }
    }
    return out
  }

  const deploy = actionsOf('^Deploy')
  const migrate = actionsOf('^Migrate')

  assert.ok(deploy.size > 0, 'no policy was found for the Deploy project at all')
  assert.ok(migrate.size > 0, 'no policy was found for the Migrate project at all')

  for (const verb of ['ecs:UpdateService', 'ecs:RegisterTaskDefinition', 'iam:PassRole']) {
    assert.ok(
      !deploy.has(verb),
      `the Deploy project still holds ${verb}. Nothing in its buildspec has used ` +
        'it since G2041, and a stage that could still call UpdateService could ' +
        'put the fleet back out of step with the stack by hand — which is the ' +
        'entire defect this slice ends, left reachable by a privilege nothing uses.',
    )
  }
  assert.ok(
    deploy.has('ecs:DescribeServices'),
    'the Deploy project cannot read its own services, so the circuit-breaker and ' +
      'zero-desired preconditions cannot run at all',
  )

  for (const verb of ['ecs:RegisterTaskDefinition', 'iam:PassRole']) {
    assert.ok(
      migrate.has(verb),
      `the Migrate project lost ${verb}. It DOES re-register a task definition — ` +
        '`ecs run-task --overrides` cannot override an image — so this assertion ' +
        'passing without it would mean the migrations run the wrong image.',
    )
  }
})

// ───────────────────────────────────────────────── §7 · the update, and its edges

/**
 * 🛑 §7 — A RE-RUN ON AN UNCHANGED COMMIT IS SUCCESS, AND EVERY OTHER FAILURE
 *    IS NOT.
 *
 * `update-stack` fails with `No updates are to be performed.` when the template
 * is unchanged — which is exactly what a retry after a downstream failure
 * produces. The Build stage already learned this against an immutable ECR tag:
 * reading the exit status alone makes the single most common recovery action —
 * RE-RUNNING THE PIPELINE ON AN UNCHANGED COMMIT — impossible.
 *
 * ⚠️ SO THE ERROR IS READ RATHER THAN THE STATUS SWALLOWED.
 */
test('test_a_rerun_on_an_unchanged_commit_is_success_and_every_other_update_failure_is_not', () => {
  const yaml = deploySpec()
  assert.match(
    yaml,
    /grep -q "No updates are to be performed" update\.err/,
    'the stage does not recognise an unchanged template, so re-running the ' +
      'pipeline on the same commit fails at the stack update',
  )
  assert.match(
    yaml,
    /FATAL: update-stack on \$PLANES_STACK_NAME exited \$UPDATE_STATUS/,
    'every other update-stack failure must stop the stage with its own message',
  )
  assert.match(
    yaml,
    /NOTHING HAS BEEN DEPLOYED/,
    'a failed update must say the fleet is untouched. A deployer who cannot tell ' +
      'a refused deploy from a half-finished one goes looking in the wrong place.',
  )
  assert.match(
    yaml,
    /aws cloudformation wait stack-update-complete/,
    '`update-stack` returns immediately. A stage that stopped there would be green ' +
      'before CloudFormation had registered anything — the same shape as ' +
      '`create-invalidation` returning InProgress one function down.',
  )
  /* And it does not cancel an update it gave up waiting for, for the reason the
   * Migrate stage does not kill a migration.
   *
   * ⚠️ KEYED ON THE CALL AND NOT ON THE WORD — G2050, AND IT TOOK TWO GOES,
   * WHICH IS WORTH RECORDING BECAUSE BOTH WRONG FORMS LOOKED RIGHT.
   *
   *   1. `!yaml.includes('cancel-update-stack')` — FAILED against a buildspec
   *      that never calls it, because the phrase is in a YAML comment
   *      explaining why it is not called.
   *   2. the same over comment-stripped command lines — FAILED AGAIN, because
   *      the phrase is also in the `echo` of the FATAL message, and an `echo`
   *      is executable.
   *
   * **An absence keyed on a word measures every mention of the word**, and the
   * two places this repository most wants the word are the comment that argues
   * the refusal and the message that explains it. G978's finding, arriving
   * twice in one assertion written against G978's shape. The property is *is
   * there a CALL*, and a call is `aws cloudformation cancel-update-stack`. */
  const executable = commandLines(yaml)
    .filter((l) => !/^\s*#/.test(l))
    .join('\n')
  assert.ok(
    !/aws cloudformation cancel-update-stack/.test(executable),
    'the stage cancels an update it gave up waiting for, which starts a rollback ' +
      'nobody watched begin — the Migrate stage refuses to kill a migration for ' +
      'the same reason',
  )
  assert.match(
    yaml,
    /cancel-update-stack/,
    'the buildspec no longer says WHY it does not cancel. The absence above is ' +
      'then a fact nobody can read, and the next author re-adds the call.',
  )
})

/**
 * 🛑 §8 — THE PLANES TEMPLATE STILL FITS IN AN INLINE `TemplateBody`, AND THE
 *    DAY IT DOES NOT IS A RED GATE RATHER THAN A RED PIPELINE.
 *
 * CloudFormation accepts at most 51,200 bytes inline; over that `UpdateStack`
 * refuses with a `ValidationError`, and the repair is a `TemplateURL` in S3 —
 * a bucket, a grant and a ruling this stage deliberately does not have.
 * **Measured 23 Sep 2026: 35,843 bytes minified**, so the headroom is real and
 * it is exactly the kind of fact that stops being true quietly.
 *
 * ⚠️ IT IS THE MINIFIED SIZE THAT COUNTS. `aws cloudformation get-template`
 * prints the template pretty — 92,822 bytes for the same 35,843 — and a check
 * written against what the CLI printed would fire years early.
 */
test('test_the_planes_template_still_fits_in_an_inline_cloudformation_template_body', () => {
  const LIMIT = 51_200
  const size = Buffer.byteLength(JSON.stringify(templates['reconcile-planes-staging']), 'utf8')
  assert.ok(
    size <= LIMIT,
    `the Planes template is ${size} bytes minified against CloudFormation's ` +
      `${LIMIT}-byte inline ceiling. The Deploy stage writes it with ` +
      '--template-body and UpdateStack will refuse it, so EVERY deploy fails. ' +
      'The repair is a TemplateURL in S3.',
  )
  assert.match(
    deploySpec(),
    new RegExp(`const LIMIT=${LIMIT};`),
    'the retag script does not carry the same inline ceiling this test asserts, ' +
      'so the run-time refusal and this gate disagree about when to stop',
  )
})

/**
 * 🛑 §9 — THE SETTLE STEP COMPARES THE FLEET AGAINST THE REVISION CLOUDFORMATION
 *    OWNS, WHICH IS THE QUESTION THE PROBE ASKS FROM OUTSIDE.
 *
 * `ROLLOUT_VERDICT_JS` is UNCHANGED by this slice — G1301–G1304's three-valued
 * verdict and its two-comparison hedge survive to the character. What changed
 * is its `WANT_TASK_DEFINITION`: it used to be the revision this stage had just
 * registered, and it is now the revision read back out of the STACK. **Its two
 * comparisons therefore now ask *did the circuit breaker roll us back* AND
 * *does the stack agree with the fleet*** — one script, one more meaning, and
 * no second opinion about what deployed means.
 */
test('test_the_settle_step_wants_the_task_definition_cloudformation_owns', () => {
  const yaml = deploySpec()
  assert.match(
    yaml,
    /aws cloudformation describe-stack-resources/,
    'nothing reads the revision the stack owns, so the verdict compares the fleet ' +
      'against something this stage chose rather than against the stack',
  )
  const owned = yaml.indexOf('owned-task-definition.txt')
  const want = yaml.indexOf('WANT_TASK_DEFINITION="$TD_ARN"')
  assert.ok(want !== -1, 'the rollout verdict is not given a wanted revision at all')
  assert.ok(owned !== -1 && owned < want, "the wanted revision is not the stack's")

  /* Matched on the FAMILY, never on a logical id — a construct path is a name,
   * and `probe-deployed-image.mjs` makes the same choice for the same reason. */
  assert.match(
    yaml,
    /PhysicalResourceId\.includes\("\/"\+family\+":"\)/,
    "the stack's task definition is matched on something other than the family",
  )
})

/**
 * 🛑 §10 — THE OWNED-TASK-DEFINITION READER REFUSES AN AMBIGUOUS ANSWER, AND
 *    THE ENGINE IS WITNESSED RATHER THAN ASSUMED.
 */
test('test_the_owned_task_definition_reader_refuses_zero_and_refuses_two', async () => {
  const js = embeddedScript(deploySpec(), 'FAMILY=')
  const family = 'reconcileplanesstagingDataPlaneTaskB4F25A67'
  const row = (n) => ({
    ResourceType: 'AWS::ECS::TaskDefinition',
    PhysicalResourceId: `arn:aws:ecs:us-west-2:111122223333:task-definition/${family}:${n}`,
  })

  const run = async (resources) => {
    const dir = await mkdtemp(join(tmpdir(), 'reconcile-owned-'))
    await writeFile(
      join(dir, 'stack-resources.json'),
      JSON.stringify({ StackResources: resources }),
    )
    return spawnSync(process.execPath, ['-e', js], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, FAMILY: family },
    })
  }

  const one = await run([row(40)])
  assert.equal(one.status, 0, `the reader refused a single unambiguous answer:\n${one.stderr}`)
  assert.match(one.stdout, /CloudFormation owns/)

  const none = await run([])
  assert.equal(none.status, 1, 'a stack carrying no task definition for the family must fail')

  const two = await run([row(40), row(41)])
  assert.equal(two.status, 1, 'two task definitions for one family is ambiguous and must fail')
})

/**
 * 🛑 §11 — THE STACK-READINESS CHECK REFUSES A STACK `UpdateStack` CANNOT BE
 *    CALLED ON, AND REUSES THE PARAMETERS IT FINDS.
 *
 * ⚠️ **READ THE PARAMETER HALF TWICE, BECAUSE REUSING A PARAMETER IS THE DEFECT
 * G1012 REMOVED.** `Planes` carries exactly one — `BootstrapVersion`, CDK's own
 * `AWS::SSM::Parameter::Value<String>` whose value is the SSM *path*
 * `/cdk-bootstrap/reconcile/version`, re-resolved by CloudFormation at every
 * deploy. **Reusing a path is not reusing a version, and it cannot go stale the
 * way an image tag can.** The image tag is not a parameter and must never
 * become one again; it is written into the TEMPLATE, where `cdk diff` sees it.
 *
 * ⚠️ AND THE LIST IS READ FROM THE STACK RATHER THAN SPELLED: the template
 * being written IS the stack's own, so its parameter set is the stack's by
 * construction, and a hard-coded `BootstrapVersion` would break silently the
 * day the bootstrap template gained a second one.
 */
test('test_the_stack_readiness_check_refuses_an_unupdatable_stack_and_reuses_its_parameters', async () => {
  /* Keyed on a string the SCRIPT contains, not on the TypeScript constant's
   * name — the name does not survive into the synthesised buildspec, and a
   * marker that is never present makes this test fail rather than pass, which
   * is the right direction but for the wrong reason. */
  const js = embeddedScript(deploySpec(), 'stack-describe.json')

  const run = async (stack) => {
    const dir = await mkdtemp(join(tmpdir(), 'reconcile-ready-'))
    await writeFile(join(dir, 'stack-describe.json'), JSON.stringify({ Stacks: [stack] }))
    const r = spawnSync(process.execPath, ['-e', js], { cwd: dir, encoding: 'utf8' })
    return { ...r, dir }
  }

  const ok = await run({
    StackName: 'reconcile-planes-staging',
    StackStatus: 'UPDATE_COMPLETE',
    Parameters: [{ ParameterKey: 'BootstrapVersion', ParameterValue: '/cdk-bootstrap/x' }],
  })
  assert.equal(ok.status, 0, `an UPDATE_COMPLETE stack was refused:\n${ok.stderr}`)
  assert.deepEqual(
    JSON.parse(readFileSync(join(ok.dir, 'parameters.json'), 'utf8')),
    [{ ParameterKey: 'BootstrapVersion', UsePreviousValue: true }],
    'the stack parameters are not carried forward, so UpdateStack would be asked ' +
      'to supply a value for a parameter this stage knows nothing about',
  )

  for (const status of ['UPDATE_IN_PROGRESS', 'ROLLBACK_COMPLETE', 'CREATE_IN_PROGRESS']) {
    const bad = await run({ StackName: 'x', StackStatus: status, Parameters: [] })
    assert.equal(bad.status, 1, `a ${status} stack must not be updated`)
    assert.match(bad.stderr, new RegExp(status), 'the refusal does not name the status it saw')
  }

  /* UPDATE_ROLLBACK_COMPLETE *is* updatable, and that matters: a stack left
   * there by one failed deploy must not block every later one. */
  const recovered = await run({
    StackName: 'x',
    StackStatus: 'UPDATE_ROLLBACK_COMPLETE',
    Parameters: [],
  })
  assert.equal(
    recovered.status,
    0,
    'a stack in UPDATE_ROLLBACK_COMPLETE was refused. That is an ordinary state ' +
      'to update from, and refusing it makes one failed deploy block every later one.',
  )
})

/**
 * 🛑 §12 — AND THE STAGE DOES NOT MOVE THE FLEET BEHIND CLOUDFORMATION'S BACK.
 *
 * This is the property the whole slice exists to create, stated as an ABSENCE
 * over the buildspec: **there is no `ecs update-service` and no
 * `register-task-definition` in the Deploy stage any more.** An absence is what
 * a review misses, so it is asserted rather than left to be noticed — and the
 * positive arm beside it keeps the assertion from passing against a stage that
 * deploys nothing at all.
 */
test('test_the_deploy_stage_moves_the_fleet_only_through_cloudformation', () => {
  const executable = commandLines(deploySpec())
    .filter((l) => !/^\s*#/.test(l))
    .join('\n')

  assert.ok(
    !executable.includes('ecs update-service'),
    'the Deploy stage still calls `ecs update-service`. That is what left the ' +
      'STACK two days behind the FLEET after every run, and a stack that ' +
      'disagrees with its fleet rolls both planes backwards the next time ' +
      'anybody deploys it.',
  )
  assert.ok(
    !executable.includes('ecs register-task-definition'),
    'the Deploy stage still registers a task definition out of band, so ' +
      'CloudFormation does not own the revision the services run',
  )
  assert.match(
    executable,
    /aws cloudformation update-stack/,
    'the Deploy stage deploys nothing at all',
  )
})
