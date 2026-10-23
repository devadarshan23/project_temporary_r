#!/usr/bin/env node
/**
 * THE IMAGE-DRIFT PROBE — G1013's read-only half, and the other half of G1012.
 *
 * ┌─ 🛑 IT ANSWERS ONE QUESTION AND IT IS THE ONE `npm run check` CANNOT ──────┐
 * │ **Does the task definition CLOUDFORMATION owns run the same image as the   │
 * │ task definition the SERVICE is running?**                                  │
 * │                                                                            │
 * │ ⚠️ **THE PARAGRAPH BELOW DESCRIBED THE DEFECT AS PERMANENT AND IS         │
 * │ CORRECTED RATHER THAN DELETED — G2051, 23 Sep 2026 — because it is the     │
 * │ sentence four files carried and the one a reader would have quoted onward. │
 * │ IT READ:**                                                                 │
 * │                                                                            │
 * │   *"The pipeline's Deploy stage is not a `cdk deploy` — it calls           │
 * │   `RegisterTaskDefinition` and `UpdateService`, so every pipeline run      │
 * │   moves the SERVICE and leaves the STACK where it was."*                   │
 * │                                                                            │
 * │ **It is still not a `cdk deploy`, and it no longer leaves the stack        │
 * │ behind.** G2041, the owner's ruling of 22 Sep 2026 — *"make the pipeline   │
 * │ write the stack value"* — replaced those two ECS calls with ONE narrow,    │
 * │ scoped `UpdateStack` on the `Planes` stack, using CloudFormation's own     │
 * │ current template mutated at nothing but the image tag. So a pipeline run   │
 * │ now leaves this probe answering AGREE.                                     │
 * │                                                                            │
 * │ 🛑 **THE QUESTION AND THE VERDICT RULE ARE UNCHANGED BY ANY OF THAT, AND   │
 * │ THAT IS DELIBERATE.** This probe is the acceptance instrument for G2041;   │
 * │ weakening it to make the change look green would be the one move that      │
 * │ cannot be undone later. What changed is what the answer is EXPECTED to be. │
 * │                                                                            │
 * │ **The rest of the original is exactly true and is why the repair was       │
 * │ taken:** `Edge` takes the data ALB by construct reference, so a            │
 * │ `cdk deploy` of `Planes` is a PRECONDITION of touching the edge at all —   │
 * │ and that deploy re-applies the stack's own task definition. **Measured on  │
 * │ 20 Sep 2026: CloudFormation owned revision 1 and the service ran revision  │
 * │ 38, whose image was pushed two days later; and again on 23 Sep 2026, at    │
 * │ revisions 40 and 43 against 50 and 54. The rollback is silent and it lands │
 * │ on a forward-only schema (G88).**                                          │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 🛑 IT IS NOT A CHECKER AND MUST NEVER JOIN `npm run check` ───────────────┐
 * │ G108 attaches a condition to every checker in the gate — **deterministic   │
 * │ and fast** — and this is neither: it reaches a live AWS account, so the    │
 * │ gate would go red when a deploy is in flight, when a credential has        │
 * │ expired, or when somebody runs it from a laptop with no profile. It is     │
 * │ therefore NOT under `tools/` and NOT named `*.test.mjs`, exactly as        │
 * │ `probe-staging.mjs` beside it is not, and for the same stated reason.      │
 * │                                                                            │
 * │   AWS_PROFILE=crm-frontend node tests/e2e/probe-deployed-image.mjs         │
 * │                                                                            │
 * │ ⚠️ **READ-ONLY. It calls four `describe-*` verbs and nothing else.**        │
 * │ It PRINTS the `cdk deploy` a human should run; it does not run one.        │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 🛑 THREE VERDICTS, THREE EXIT CODES — W0-c, 21 Sep 2026 ──────────────────┐
 * │ **0 AGREE**   every service on the image CloudFormation owns.              │
 * │ **1 DRIFT**   every service on the SAME image, and it is not the stack's.  │
 * │               One fact about one fleet — the shape a pipeline run leaves.  │
 * │ **3 SPLIT**   the services on DIFFERENT images FROM EACH OTHER.            │
 * │ **2**         the probe could not answer. Unchanged, and never a verdict.  │
 * │                                                                            │
 * │ ⚠️ **UNTIL 21 Sep 2026 THIS PROBE COMPARED EACH SERVICE TO THE STACK AND   │
 * │ THE TWO SERVICES TO EACH OTHER NEVER**, so a split fleet and a healthy     │
 * │ post-pipeline one were the same two DRIFT lines and the same exit 1.       │
 * │ The Deploy stage deploys the CONTROL plane first, so an abort between the  │
 * │ two leaves the DATA plane on the previous image — and the data plane is    │
 * │ the one that publishes to the run queue and reads the control roster.      │
 * │ **The rule now lives in `fleet-image-verdict.mjs` and is witnessed by a    │
 * │ suite in the gate; no AWS call was added to reach it.**                    │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ IT SHELLS OUT TO THE `aws` CLI RATHER THAN IMPORTING AN SDK, AND THAT IS
 * G212's fence rather than a preference: `grep -c 'aws-sdk' package.json` → 0,
 * and the root manifest must stay that way. `infra/` has its own manifest and
 * carries no SDK either.
 *
 * ⚠️ EXIT CODES COME FROM `spawnSync`, NEVER FROM A PIPE — trap 8 of
 * `docs/build/deploy-handoff.md` §3, which that page records itself falling for
 * on the one command that mattered.
 */

import { spawnSync } from 'node:child_process'

import { FLEET_VERDICT, fleetVerdict } from './fleet-image-verdict.mjs'

const REGION = 'us-west-2'
const STACK = 'reconcile-planes-staging'
const CLUSTER = 'reconcile-staging'
const SERVICES = ['reconcile-staging-data-plane', 'reconcile-staging-control-plane']

function aws(args, { tolerate } = {}) {
  const run = spawnSync('aws', [...args, '--region', REGION, '--output', 'json'], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  if (run.status !== 0) {
    if (tolerate && (run.stderr ?? '').includes(tolerate)) return null
    process.stderr.write(`aws ${args.join(' ')} exited ${run.status}\n${run.stderr}\n`)
    process.exit(2)
  }
  return JSON.parse(run.stdout)
}

/** The image URI one task definition's containers run. One, or this is a finding. */
function imageOf(taskDefinitionArn) {
  const described = aws(['ecs', 'describe-task-definition', '--task-definition', taskDefinitionArn])
  const images = new Set(described.taskDefinition.containerDefinitions.map((c) => c.image))
  if (images.size !== 1) {
    process.stderr.write(`${taskDefinitionArn} runs ${images.size} distinct images: ${[...images]}\n`)
    process.exit(2)
  }
  return [...images][0]
}

/**
 * ⚠️ A RUNNING IMAGE IS A DIGEST AND A STACK'S IS A TAG, SO THEY ARE NOT
 * COMPARABLE AS STRINGS — the pipeline registers by digest and the stack names
 * a tag. This resolves both to the SET OF TAGS ECR holds for those bytes, which
 * is the only form in which the question has an answer.
 */
function tagsFor(imageUri) {
  const digested = imageUri.includes('@')
  const repositoryPath = digested ? imageUri.split('@')[0] : imageUri.slice(0, imageUri.lastIndexOf(':'))
  const reference = digested
    ? `imageDigest=${imageUri.split('@')[1]}`
    : `imageTag=${imageUri.slice(imageUri.lastIndexOf(':') + 1)}`
  const repositoryName = repositoryPath.slice(repositoryPath.indexOf('/') + 1)
  const described = aws(
    ['ecr', 'describe-images', '--repository-name', repositoryName, '--image-ids', reference],
    /* 🛑 AN IMAGE THAT IS GONE IS A FINDING, NOT AN ERROR — AND IT IS THE
     * SHARPEST ONE THIS PROBE FOUND. `reconcile/planes-staging` carries a
     * lifecycle rule keeping the FIFTY most recent images, and on 20 Sep 2026
     * the image the stack's own parameter named had already been expired: the
     * tag resolved at 09:0x and was gone by 09:2x, when the rule last ran.
     * **So a `cdk deploy` of a sufficiently stale stack fails at the image pull
     * rather than rolling the fleet back — which is LOUD, and is luck rather
     * than design: inside the fifty it is still silent.** Exiting 2 here would
     * report the loudest possible drift as a broken probe. */
    { tolerate: 'ImageNotFoundException' },
  )
  const detail = described?.imageDetails?.[0]
  /* ⚠️ `uri` TRAVELS WITH THE TAGS AND IS NOT ADDED BY THE CALLER. It is half of
   * every comparison in `fleet-image-verdict.mjs` — an expired image has no tags
   * at all, so the URI is the only thing left to compare it by — and a fact
   * assembled field by field at four call sites is a field somebody forgets.
   * **Measured, not feared: the first draft of this slice did forget it, every
   * comparison became `undefined === undefined`, and the probe answered AGREE
   * for a fleet it had been handed as split.** `fleetVerdict()` now throws on a
   * fact with no URI rather than agreeing with it. */
  if (!detail) return { uri: imageUri, tags: [], pushedAt: 'EXPIRED - no longer in ECR', gone: true }
  return { uri: imageUri, tags: detail.imageTags ?? [], pushedAt: detail.imagePushedAt ?? 'unknown', gone: false }
}

// --------------------------------------------------------------- the probe

const stackTaskDefinitions = aws([
  'cloudformation',
  'describe-stack-resources',
  '--stack-name',
  STACK,
]).StackResources.filter((r) => r.ResourceType === 'AWS::ECS::TaskDefinition')

const services = aws(['ecs', 'describe-services', '--cluster', CLUSTER, '--services', ...SERVICES])

/** The 40-hex commit tag on an image, if it carries one. The only tag `cdk deploy` can take. */
const commitTagOf = (image) => image.tags.find((t) => /^[0-9a-f]{40}$/.test(t))

/** How an image is named to a reader: its commit tag, else every tag, else that it has none. */
const labelOf = (image) => commitTagOf(image) ?? (image.tags.join(', ') || '<untagged>')

/** ⚠️ ONE PASS TO GATHER, THEN ONE VERDICT, THEN ONE PASS TO PRINT — because a
 * question about the FLEET cannot be answered inside a loop over one service.
 * That is the whole of the defect W0-c repairs, and the shape is the repair. */
const facts = []

for (const service of services.services) {
  /* The stack's task definition for this service, matched on the FAMILY the
   * service's own revision carries — never on a logical id, which is a
   * construct path and would make this a test of a name. */
  const runningArn = service.taskDefinition
  const family = runningArn.split('/').pop().split(':')[0]
  const owned = stackTaskDefinitions.find((r) => r.PhysicalResourceId.includes(`/${family}:`))
  if (!owned) {
    process.stderr.write(`no task definition in ${STACK} carries the family ${family}\n`)
    process.exit(2)
  }

  facts.push({
    name: service.serviceName,
    runningArn,
    ownedArn: owned.PhysicalResourceId,
    running: tagsFor(imageOf(runningArn)),
    owned: tagsFor(imageOf(owned.PhysicalResourceId)),
  })
}

// ------------------------------------------------------------- the verdict

const fleet = fleetVerdict(facts)

for (const fact of facts) {
  const agrees = fleet.perService.find((s) => s.name === fact.name).agreesWithStack

  process.stdout.write(
    `${fact.name}\n` +
      `  running        ${fact.runningArn.split('/').pop()}  ${fact.running.tags.join(', ') || '<untagged>'}  pushed ${fact.running.pushedAt}\n` +
      `  CloudFormation ${fact.ownedArn.split('/').pop()}  ${fact.owned.tags.join(', ') || '<untagged>'}  pushed ${fact.owned.pushedAt}\n` +
      `  ${agrees ? 'AGREE' : '*** DRIFT ***'}\n`,
  )

  /* ⚠️ THE STATUS LINE ABOVE IS A FACT AND PRINTS ALWAYS; THE REMEDIATION BELOW
   * IS ADVICE AND IS SUPPRESSED IN A SPLIT. It says *pin the stack to the tag
   * the service is actually running*, and in a split there are two such tags —
   * so it would print two conflicting `cdk deploy` commands and let whoever
   * read first choose which plane wins. The split block below says so instead. */
  if (agrees || fleet.verdict === FLEET_VERDICT.split) continue

  const tag = commitTagOf(fact.running) ?? '<no commit-sha tag on the running digest>'
  process.stdout.write(
    fact.owned.gone
      ? '\n  🛑 THE IMAGE CLOUDFORMATION OWNS IS NO LONGER IN ECR - the lifecycle rule keeps\n' +
          '     the fifty most recent and has expired it. A `cdk deploy` of this stack now FAILS\n' +
          '     at the image pull, which is the loud end of the same defect. Deploy it with the\n' +
          '     tag the service is actually running:\n\n' +
          `       cdk deploy ${STACK} -c planeImageTag=${tag}\n\n`
      : '\n  🛑 A `cdk deploy` of this stack would move the service BACKWARDS to the image\n' +
          '     CloudFormation owns, silently, against a forward-only schema (G88). Deploy it\n' +
          '     with the tag the service is actually running:\n\n' +
          `       cdk deploy ${STACK} -c planeImageTag=${tag}\n\n`,
  )
}

/* 🛑 THE SPLIT ARM IS PRINTED BEFORE THE DRIFT SUMMARY AND OUTRANKS IT, because
 * a split fleet is ALSO drifted and the drift paragraph below tells a reader to
 * pin the stack to "the tag the service is actually running" — advice with no
 * referent when the two services are running different ones, and advice that
 * would silently choose a winner if it had one. */
if (fleet.verdict === FLEET_VERDICT.split) {
  process.stdout.write(
    '\n*** SPLIT FLEET ***\n' +
      'The two services are NOT running the same bytes as each other.\n\n',
  )

  for (const { left, right } of fleet.split.pairs) {
    process.stdout.write(
      `  ${left.name}\n` +
        `    ${labelOf(left.running)}  pushed ${left.running.pushedAt}\n` +
        `  ${right.name}\n` +
        `    ${labelOf(right.running)}  pushed ${right.running.pushedAt}\n\n`,
    )
  }

  process.stdout.write(
    '  🛑 THE DEPLOY STAGE DEPLOYS THE CONTROL PLANE FIRST, so an abort between the two\n' +
      '     leaves the DATA plane on the previous image - and the data plane is the one that\n' +
      '     publishes to the run queue and reads the control roster. The planes can disagree\n' +
      '     about the wire between them while every stack-level check reports them healthy.\n\n' +
      '  🛑 THIS OUTPUT CARRIES NO `cdk deploy` AT ALL, AND THE ABSENCE IS THE POINT:\n' +
      '     pinning the stack to one of two images chooses which plane is right, and that is\n' +
      '     a decision about the product rather than about the stack. Re-run the pipeline so\n' +
      '     both planes land on ONE image, then run this probe again - it will report ordinary\n' +
      '     drift, and THAT answer comes with a command.\n',
  )
  process.exit(fleet.exitCode)
}

if (fleet.verdict === FLEET_VERDICT.drift) {
  process.stdout.write(
    'DRIFT. The stack and the fleet disagree about which bytes run - and the two services\n' +
      'agree with EACH OTHER, so this is one fact about one fleet.\n' +
      '\n' +
      'SINCE G2041 THIS IS A FINDING RATHER THAN THE EXPECTED STATE. The Deploy stage now\n' +
      'writes the image tag into the Planes stack’s own template, so a pipeline run leaves\n' +
      'the stack and the fleet agreeing. Drift after a pipeline run means one of:\n' +
      '  - the fleet was last moved by something other than the pipeline (a by-hand\n' +
      '    update-service, or a cdk deploy carrying a different -c planeImageTag);\n' +
      '  - the Deploy stage failed at its stack update, which is a RED pipeline - look at\n' +
      '    the execution before you pin anything;\n' +
      '  - or the image predates 23 Sep 2026 and no pipeline has run since.\n',
  )
  process.exit(fleet.exitCode)
}

process.stdout.write('AGREE. A cdk deploy of Planes would not move either service, and the two\n')
process.stdout.write('services run the same bytes as each other.\n')
