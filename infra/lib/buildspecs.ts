/**
 * The buildspecs, as YAML TEXT rather than as objects.
 *
 * 🛑 THE TEXT FORM IS THE POINT AND IT IS NOT A STYLE CHOICE.
 * `BuildSpec.fromObject()` renders JSON and `fromObjectToYaml()` renders YAML
 * from a JavaScript object — and NEITHER can carry a comment, because an object
 * has nowhere to put one. The one thing that has to survive from this file into
 * the DEPLOYED pipeline is the sentence `.github/workflows/check.yml` carries —
 * *"DO NOT ADD A STEP HERE"* — because the buildspec, in the console, is
 * exactly where the next person will be tempted to add one. A rule that lives
 * only in the file that GENERATES the artefact is a rule the person editing the
 * artefact never reads.
 *
 * ⚠️ SO THIS FILE USES AN ESCAPE HATCH AND SAYS SO. `aws-cdk-lib` 2.270.0 has
 * no `BuildSpec.fromString()`; `attachBuildSpecYaml()` writes the text straight
 * onto the L1's `Source.BuildSpec`, which is the field CloudFormation takes
 * verbatim. It is one property override, in one function, rather than copied
 * into each stack.
 *
 * Everything here is inline, so `cdk synth` writes no asset and touches no
 * network: G108's condition on anything joining `npm run check`.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { CfnProject, IProject } from 'aws-cdk-lib/aws-codebuild'

import { CI_IMAGE_DOCKERFILE, DOCKER_PLATFORM } from './config.ts'

/**
 * THE GATE. G257: *"the gate stage is `npm run check` and NOTHING ELSE"*, and
 * G108 is not amended by any of it.
 *
 * ⚠️ ONE COLLISION WITH `docs/tech-stack.md` §9.4 IS NAMED HERE RATHER THAN
 * RESOLVED SILENTLY. §9.4 says the CI image carries PostgreSQL 17 *"started by
 * the buildspec on `127.0.0.1`"*. A `pg_ctl start` line in THIS file is a third
 * command in the gate, which is the thing G108 forbids and the thing this
 * slice was told not to do. The responsibility therefore sits in the IMAGE —
 * `infra/ci-image/Dockerfile`, which is another slice's file — and this comment
 * is the record that the two halves have to agree before the first green
 * pipeline run. If the image does not start PostgreSQL, the gate goes RED under
 * `CI=1` rather than skipping, which is `tests/reachability.ts` working exactly
 * as designed and is the correct failure.
 */
/**
 * 🛑 THE TWO BUILDSPECS WITH A COMMITTED FILE ARE READ FROM IT, NOT RESTATED
 * HERE — AND THIS REPLACED A SECOND SPELLING THAT WAS ALREADY DRIFTING.
 *
 * Two slices wrote a gate buildspec on the same day. This file held
 * `npm ci` + `npm run check` and nothing else; `infra/ci-image/buildspec-gate.yml`
 * held the same two commands PLUS `CI: "true"`, PLUS `reconcile-pg-start`, PLUS
 * a refusal to run at all on an image that is not the one `infra/ci-image`
 * builds. **They were not the same buildspec, and the shorter one was the
 * dangerous one:** without `CI=true` the reachability guards in
 * `tests/reachability.ts` SKIP rather than fail, which is precisely the hole
 * PR #257 merged a red trunk through — a CI run reported `success` with seven
 * test databases unreachable and no chromium.
 *
 * So the FILE is the authority and this module reads it. One spelling, and the
 * spelling that survives is the one a person can open in the repository and in
 * the CodeBuild console and see the same bytes.
 *
 * ⚠️ `readFileSync` AT SYNTH TIME IS DELIBERATE AND MEETS G108. It touches the
 * local tree, never the network, and it is deterministic: the same commit
 * synthesises the same template. A file that has gone missing fails synth
 * loudly, which is the correct failure — a pipeline whose gate buildspec
 * vanished should not deploy.
 */
const HERE = dirname(fileURLToPath(import.meta.url))
const CI_IMAGE_DIR = join(HERE, '..', 'ci-image')

const readBuildSpec = (name: string): string => {
  const text = readFileSync(join(CI_IMAGE_DIR, name), 'utf8')
  // ⚠️ ONE SPELLING, ENFORCED AT SYNTH RATHER THAN HOPED FOR. `config.ts` names
  // the Dockerfile path and the buildspec names it again in a `docker build`
  // line; two spellings of one path is the drift this module was just rewritten
  // to end, so the second one is CHECKED against the first instead of trusted.
  // A synth that cannot find the path in the spec it just read is a synth whose
  // two halves disagree, and it should stop rather than deploy.
  if (name === 'buildspec-ci-image.yml' && !text.includes(CI_IMAGE_DOCKERFILE)) {
    throw new Error(
      `${name} does not name ${CI_IMAGE_DOCKERFILE}, which config.ts declares as ` +
        'the CI image Dockerfile. One of the two moved without the other.',
    )
  }
  return text
}

/**
 * THE GATE. G257: *"the gate stage is `npm run check` and NOTHING ELSE"*, and
 * G108 is not amended by any of it. The `pre_build` phase starts PostgreSQL and
 * proves the image — that is ENVIRONMENT SETUP, not a check, and the file says
 * so in its own comments, which is why the file is the thing that ships.
 */
export const GATE_BUILDSPEC_YAML = readBuildSpec('buildspec-gate.yml')


/**
 * THE BUILD STAGE — separate from the gate, and it runs only after one.
 *
 * G252: `--platform=${DOCKER_PLATFORM}` on an `ARM_CONTAINER` host, so the
 * platform flag is a statement rather than a cross-build.
 * G262: the stage FAILS on any `CRITICAL` or `HIGH` finding from the scan ECR
 * runs on push, and the image is referenced onward by DIGEST rather than by the
 * tag that was pushed.
 *
 * 🛑 AND IT FAILS ON `npm audit` TOO, BECAUSE THE ECR SCAN CANNOT SEE
 * `node_modules` AND A CVSS 7.5 RODE INTO A DEPLOYED IMAGE THROUGH THE GAP.
 *
 * The registry is on BASIC scanning. That is not a misconfiguration and the
 * scan is not broken — measured on the running image, 19 Sep 2026:
 *
 *     imageScanStatus COMPLETE · findingSeverityCounts {} · 0 findings
 *
 * BASIC read the image and found nothing, correctly: the hardened multi-stage
 * `Dockerfile` carries `apk --no-cache upgrade` and its OS layer IS clean.
 * **BASIC'S SCOPE IS OPERATING-SYSTEM PACKAGES.** It does not open
 * `node_modules`, so every npm dependency in the image was outside the only
 * vulnerability gate this pipeline had — and `fast-uri` sat there at 3.1.5 and
 * 4.1.2 across four advisories, all CVSS 7.5, two of them SSRF, reachable
 * through the ajv instance that validates every request body this product
 * serves.
 *
 * ⚠️ IT WAS NOT SILENT — IT WAS UNREAD, WHICH IS WORSE. `npm ci` prints its own
 * audit summary, and `2 vulnerabilities (1 moderate, 1 high)` was sitting in the
 * build log of a green pipeline. Nothing asserted on it, so nothing failed.
 *
 * The gate below is deliberately the WHOLE tree rather than `--omit=dev`. A
 * compromised build tool produces a compromised image, so "it does not ship" is
 * not the same as "it cannot reach production".
 *
 * ⚠️ AND IT IS HERE RATHER THAN IN `npm run check`, WHICH IS A G108 DECISION AND
 * NOT AN OVERSIGHT. G108 requires a gate stage to be DETERMINISTIC and FAST.
 * `npm audit` is neither: it reaches the network, and its answer changes when an
 * advisory is published rather than when the tree changes — so a commit that was
 * green yesterday goes red today with no edit. That belongs beside the ECR scan,
 * which has exactly the same property, and not in the one gate a contributor
 * runs offline.
 */
export const PLANE_BUILD_BUILDSPEC_YAML = `version: 0.2

# THE BUILD STAGE. Reached only after a green gate; never a step inside one.
#
# Two artefacts come out of one commit, which is the whole of G257's
# "merge to a branch and both frontend and backend are deployed":
#   1. the planes' runtime image, linux/arm64, pushed to ECR and named onward
#      by DIGEST;
#   2. the frontend bundle, from the same 'build:frontend' the gate already
#      ran, so a frontend that does not build is a red gate rather than a red
#      deploy.
#
# THE SCAN GATE IS G262 AND IT MUST STAY FAIL-CLOSED. A missing findings
# document, a scan that never completes, or an unparseable response all exit
# non-zero below. A vulnerability check that passes when it could not read the
# findings is docs/HANDOFF.md 5.6 wearing a hard hat.
#
# THERE ARE TWO OF THEM AND THEY DO NOT OVERLAP. ECR's BASIC scan reads
# OPERATING-SYSTEM PACKAGES; it does not open node_modules. npm audit reads
# node_modules and knows nothing about the base image. Neither is a subset of
# the other, and dropping either leaves a whole layer of the image ungated.
# 🛑 IMAGE_TAG IS NOT EXPORTED — IT IS $CODEBUILD_RESOLVED_SOURCE_VERSION
#    SPELLED AT EVERY SITE, AND THE FIRST REAL PIPELINE RUN IS WHY.
#
#    This used to do export IMAGE_TAG="$CODEBUILD_RESOLVED_SOURCE_VERSION" in
#    pre_build and refer to $IMAGE_TAG in all three phases. CODEBUILD RUNS
#    EACH PHASE IN A SEPARATE SHELL, so the export reached build and did NOT
#    reach post_build. The image tagged and pushed correctly — one tag, the
#    commit sha — and then the scan asked the registry for imageTag= empty:
#
#        ImageNotFoundException: The image with imageId
#        {imageDigest:'null', imageTag:''} does not exist
#
#    The vulnerability gate then failed on unreadable findings rather than on
#    findings, which is the honest direction but for the wrong reason. Spelling
#    the variable CodeBuild itself provides removes the shell boundary from the
#    problem entirely.
#
#    ⚠️ AND THE GUARDS BELOW ARE WHY THIS FAILED LATE RATHER THAN EARLY. The CI
#    image buildspec asserts its inputs with test -n and failed in PRE_BUILD
#    in one second with the variable named. This file asserted nothing and
#    failed four minutes in, after a docker build and a push, with an AWS error
#    about a missing image. tests/infra/pipeline.test.mjs reads these guards
#    and requires the project to set what they name, so the guards are also
#    what keeps the two halves of the interface joined.
# G3272 — THE BUILD STAGE RUNS THE GATE'S NODE MAJOR, AND SAYS SO IN INSTALL.
#    On 2 Oct 2026 this stage ran Node 18 (the curated image's default) while
#    the gate ran Node 22, and npm run build:frontend threw ERR_INVALID_ARG_TYPE
#    on import.meta.dirname — a Node >= 20.11 API the gate could not see fail.
#    The two stages had two definitions of "node" and the gate proved the wrong
#    one. The pin below and the guard after it close that: the guard reads the
#    major out of package.json engines.node and refuses ANY other major, so a
#    drift fails in INSTALL in seconds with the cause named, not mid-build.
phases:
  install:
    runtime-versions:
      nodejs: 22
    commands:
      - |
        node -e "const r=require('./package.json').engines.node;const m=/^>=(\\d+)\\./.exec(r);if(!m){console.error('engines.node is '+r+'; the Build stage reads one form, >=x.y.z (G3272).');process.exit(1)}const have=process.versions.node.split('.')[0];if(have!==m[1]){console.error('G3272: the Build stage runs node '+process.versions.node+' and engines.node is '+r+'. The gate runs that major; this stage must too.');process.exit(1)}console.log('node '+process.versions.node+' matches engines.node major '+m[1])"
  pre_build:
    commands:
      - |
        test -n "$ECR_REGISTRY"
        test -n "$PLANE_REPOSITORY_NAME"
        test -n "$CODEBUILD_RESOLVED_SOURCE_VERSION"
      - aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"
  build:
    commands:
      - docker build --platform ${DOCKER_PLATFORM} -t "$ECR_REGISTRY/$PLANE_REPOSITORY_NAME:$CODEBUILD_RESOLVED_SOURCE_VERSION" -f Dockerfile .
      # 🛑 THE PUSH IS IDEMPOTENT, AND AN IMMUTABLE TAG IS WHY IT HAD TO BE.
      #    Pushing a tag that already exists to an IMMUTABLE repository fails
      #    with a bare exit status 1 AFTER the layers report Pushed, which
      #    reads like a network fault. That made the single most common recovery
      #    action impossible: RE-RUNNING THE PIPELINE ON AN UNCHANGED COMMIT.
      #    Retry after any downstream failure and Build dies before reaching it.
      #
      #    ⚠️ IMMUTABILITY IS NOT THE BUG AND IS NOT WEAKENED HERE. G262 wants
      #    the running image identified by something that cannot move, and this
      #    keeps that: a tag that already exists carrying the SAME digest is the
      #    build we would have made, so it is success; a tag carrying a
      #    DIFFERENT digest is immutability catching a real problem and still
      #    fails, loudly, with both digests named.
      - |
        set -eu
        REF="$ECR_REGISTRY/$PLANE_REPOSITORY_NAME:$CODEBUILD_RESOLVED_SOURCE_VERSION"
        LOCAL="$(docker image inspect "$REF" --format '{{index .RepoDigests 0}}' 2>/dev/null | sed 's/.*@//' || true)"
        REMOTE="$(aws ecr describe-images --region "$AWS_REGION" \
          --repository-name "$PLANE_REPOSITORY_NAME" \
          --image-ids imageTag="$CODEBUILD_RESOLVED_SOURCE_VERSION" \
          --query 'imageDetails[0].imageDigest' --output text 2>/dev/null || true)"
        if [ -z "$REMOTE" ] || [ "$REMOTE" = "None" ]; then
          docker push "$REF"
        else
          echo "tag $CODEBUILD_RESOLVED_SOURCE_VERSION already in the registry at $REMOTE"
          docker push "$REF" 2>push.log || true
          AFTER="$(aws ecr describe-images --region "$AWS_REGION" \
            --repository-name "$PLANE_REPOSITORY_NAME" \
            --image-ids imageTag="$CODEBUILD_RESOLVED_SOURCE_VERSION" \
            --query 'imageDetails[0].imageDigest' --output text)"
          if [ -n "$LOCAL" ] && [ "$LOCAL" != "$AFTER" ]; then
            echo "FATAL: tag $CODEBUILD_RESOLVED_SOURCE_VERSION already exists at $AFTER" >&2
            echo "       and this build produced $LOCAL. The repository is IMMUTABLE and" >&2
            echo "       it is right to refuse: one commit has produced two different" >&2
            echo "       images. Find out why before retrying." >&2
            exit 1
          fi
          echo "same digest; nothing to push. This is a re-run, not a conflict."
        fi
      - npm ci
      # npm audit exits non-zero on a finding AND on an error, but its exit code
      # alone cannot tell "clean" from "could not ask". The counts are read the
      # same way the ECR findings are, so an absent or unparseable document
      # fails rather than reads as zero.
      - npm audit --json > npm-audit.json || true
      - |
        node -e "const a=require('./npm-audit.json');const c=(a.metadata||{}).vulnerabilities;if(!c||typeof c.high!=='number'||typeof c.critical!=='number'){console.error('npm audit produced no readable severity counts. A dependency check that passes when it could not read the advisories is docs/HANDOFF.md 5.6.');process.exit(1)}console.log('npm audit counts',JSON.stringify(c));const bad=c.critical+c.high;if(bad>0){console.error('G262: '+bad+' CRITICAL/HIGH npm advisories. ECR BASIC scanning reads OS packages and does NOT open node_modules, so this is the only gate that can see them.');process.exit(1)}"
      - npm run build:frontend
  post_build:
    commands:
      # The digest, resolved from the registry rather than from the local
      # daemon: what the pipeline deploys must be what the registry holds.
      - aws ecr wait image-scan-complete --region "$AWS_REGION" --repository-name "$PLANE_REPOSITORY_NAME" --image-id imageTag="$CODEBUILD_RESOLVED_SOURCE_VERSION"
      - aws ecr describe-image-scan-findings --region "$AWS_REGION" --repository-name "$PLANE_REPOSITORY_NAME" --image-id imageTag="$CODEBUILD_RESOLVED_SOURCE_VERSION" --output json > scan.json
      # 🛑 A BLOCK SCALAR, NOT A BARE LINE, AND THE REASON IS A REAL DEFECT
      #    THIS FILE SHIPPED. Written bare, this was a PLAIN YAML scalar
      #    containing a double quote that opens a new node — malformed YAML.
      #    yaml@2.9.0 rejects it with "Unexpected scalar at node end", and
      #    CodeBuild would have rejected the buildspec AT RUN TIME. It survived
      #    review because the hand-rolled line scanner in tests/infra/ could not
      #    parse YAML and so could not tell malformed from valid. That scanner
      #    is gone, for exactly this reason — G109.
      #    (No backticks in this comment: it lives inside a template literal.)
      - |
        node -e "const f=require('./scan.json').imageScanFindings||{};const c=f.findingSeverityCounts||{};const bad=(c.CRITICAL||0)+(c.HIGH||0);console.log('scan counts',JSON.stringify(c));if(bad>0){console.error('G262: '+bad+' CRITICAL/HIGH findings; the build stage fails on them');process.exit(1)}"
      - aws ecr describe-images --region "$AWS_REGION" --repository-name "$PLANE_REPOSITORY_NAME" --image-ids imageTag="$CODEBUILD_RESOLVED_SOURCE_VERSION" --query 'imageDetails[0].imageDigest' --output text > image-digest.txt
      - test -s image-digest.txt
      # 🛑 THE TAG TRAVELS IN THE ARTEFACT BECAUSE THE DEPLOY STAGE CANNOT READ
      #    IT ANY OTHER WAY — G2044. THIS IS NOT A WEAKENING OF G262.
      #
      #    $CODEBUILD_RESOLVED_SOURCE_VERSION is a COMMIT SHA in THIS stage,
      #    whose input is the Source action's clone. The Migrate and Deploy
      #    stages take the BUILD ARTEFACT as their input, not a clone, so the
      #    same variable there names an artefact version and not a commit — and
      #    MIGRATE_BUILDSPEC_YAML says in its own words that it never reads it.
      #    A stage that needs the commit tag must therefore be HANDED it.
      #
      #    ⚠️ IT DOES NOT REPLACE image-digest.txt AND NEITHER FILE IS
      #    TRUSTED ALONE. The Migrate stage still uses the DIGEST and nothing
      #    else. The Deploy stage reads BOTH and refuses unless the registry
      #    agrees that this tag resolves to this digest — so the two files
      #    validate each other at the moment of use, which is strictly more
      #    than either an immutable-tag assumption or a digest on its own.
      - echo "$CODEBUILD_RESOLVED_SOURCE_VERSION" > image-tag.txt
      - test -s image-tag.txt
      - echo "planes image digest $(cat image-digest.txt) tag $(cat image-tag.txt)"
artifacts:
  base-directory: .
  files:
    - image-digest.txt
    - image-tag.txt
    - frontend/dist/**/*
`

/**
 * THE CI IMAGE BUILD — G258.
 *
 * ⚠️ IT DOES NOT JOIN A PIPELINE AND THAT IS THE RULING, NOT AN OMISSION.
 * G258's acceptance condition is that `tests/ci/reachability-guards.test.ts` is
 * observed FAILING inside this image with chromium removed and PASSING with it
 * present, **before any pipeline is pointed at it** — *"a machine added to the
 * gate without a demonstrated red is §5.6 wearing a different hat."* So this
 * project is started by hand, its output is witnessed, and only then is the
 * `Pipeline` stack deployed against the tag it pushed.
 */
/** The CI image's own build. Read from the committed file, for the reason above. */
export const CI_IMAGE_BUILDSPEC_YAML = readBuildSpec('buildspec-ci-image.yml')


// ------------------------------- stage 4 · Migrate, and stage 5 · Deploy

/**
 * 🛑 WHY BOTH NEW STAGES ARE CODEBUILD ACTIONS RUNNING THE AWS CLI, AND NOT A
 * LAMBDA AND NOT CODEPIPELINE'S NATIVE ECS DEPLOY ACTION. THE ARGUMENT IS
 * WRITTEN HERE BECAUSE BOTH ALTERNATIVES ARE REASONABLE AND ONE OF THEM IS THE
 * FIRST THING A REVIEWER WILL SUGGEST.
 *
 * CodePipeline has no native *"run an ECS task and wait for it"* action at all,
 * so stage 4 is a choice between a CodeBuild action and a Lambda invoke action.
 * **CodeBuild, for four reasons, in order of weight:**
 *
 *   1 · **A Lambda stops at fifteen minutes and a migration does not.**
 *       `db/migrate.ts` is forward-only over a growing set of files against
 *       Aurora; the day one migration takes sixteen minutes, the Lambda's
 *       failure is a TIMEOUT — indistinguishable, in the pipeline, from a
 *       migration that failed — while the migration itself carries on running
 *       against the database the next stage is about to deploy over. That is
 *       the worst failure this stage can have, and it is designed out rather
 *       than monitored.
 *   2 · **One runtime, not two.** Every other stage here is CodeBuild on ARM.
 *       A Lambda adds a deployment package, a second log surface, a second set
 *       of IAM, and — under the posture G212 set on the root manifest — either
 *       an inline handler nobody type-checks or an AWS SDK dependency this
 *       repository has deliberately refused.
 *   3 · **The exit code is the product.** `ecs wait tasks-stopped` plus
 *       `describe-tasks` gives a container exit code, and a shell that reads it
 *       and exits with it is the shortest path from *"the migration failed"* to
 *       *"the pipeline is red"*. A Lambda has to translate that into a job
 *       result, which is one more place to get the polarity wrong.
 *   4 · The CodeBuild log IS the migration's log, in the same console, beside
 *       the gate and the build.
 *
 * Stage 5 is a choice between a CodeBuild action and `actions.EcsDeployAction`.
 * **CodeBuild, for one reason that is sufficient on its own:** the native
 * action consumes an `imagedefinitions.json` artefact, and the Build stage does
 * not write one — it writes `image-digest.txt`, under G262, because a digest is
 * the thing that names bytes. Teaching Build to emit a second, tag-shaped
 * artefact so that a native action could be used would put a NAME back in the
 * path that ruling exists to remove. `EcsDeployAction` additionally wants an
 * `ecs.IBaseService` OBJECT, which this stack cannot have without taking a code
 * dependency on a stack written in parallel.
 */

/**
 * Rewrite ONE container's image in a task definition and re-register it.
 *
 * ⚠️ **SINCE G2041 THE MIGRATE STAGE IS THE ONLY CALLER, AND THE SENTENCE BELOW
 * IS CORRECTED RATHER THAN DELETED** because its argument is unchanged and is
 * the reason this script exists at all. IT READ: *"…AND IT IS WHY THE MIGRATE
 * STAGE NEEDS THE DIGEST TOO RATHER THAN ONLY THE DEPLOY STAGE."* **The Deploy
 * stage no longer registers a task definition at any point** — CloudFormation
 * does, from the tag written into the `Planes` template — so there is no
 * "too" left: this is the migrate path's, alone. **The Migrate stage still
 * uses the DIGEST and nothing else**, which is G262 untouched.
 *
 * 🛑 THIS IS THE ONLY WAY TO CHANGE THE IMAGE AN ECS TASK RUNS. The
 * image lives in the TASK DEFINITION, and `ecs run-task --overrides` may
 * override a command, an environment, a cpu and a memory — and NOT an image. So
 * a Migrate stage that simply ran the existing migrate task definition would run
 * the migrations of whatever image was deployed LAST, against the schema the
 * code being deployed NEXT expects. It would be green every time and it would
 * migrate the wrong thing.
 *
 * The fields deleted below are the ones `describe-task-definition` returns and
 * `register-task-definition` rejects. A missing container name is FATAL rather
 * than a no-op: a silent no-op here re-registers the OLD image and deploys it.
 */
const RETAG_TASK_DEFINITION_JS =
  'const fs=require("fs");' +
  'const td=JSON.parse(fs.readFileSync("td-current.json","utf8")).taskDefinition;' +
  'const want=process.env.CONTAINER;' +
  'const c=(td.containerDefinitions||[]).find(d=>d.name===want);' +
  'if(!c){console.error("FATAL: task definition family "+td.family+" has no container named "+want+". The Planes stack and infra/lib/config.ts disagree about the container name.");process.exit(1)}' +
  'c.image=process.env.IMAGE;' +
  'for(const k of ["taskDefinitionArn","revision","status","requiresAttributes","compatibilities","registeredAt","registeredBy","deregisteredAt"])delete td[k];' +
  'fs.writeFileSync("td-next.json",JSON.stringify(td));' +
  'console.log("re-registering "+td.family+" container "+want+" with "+process.env.IMAGE)'

/**
 * 🛑 `aws ecs run-task` EXITS 0 WHEN IT STARTS NOTHING. Read this before
 * simplifying the stage.
 *
 * The API returns `{tasks: [], failures: [{reason: "..."}]}` — a 200, and a zero
 * exit status from the CLI — when the cluster has no capacity, the subnets
 * cannot reach ECR, or the task definition is inactive. A stage that read only
 * the exit status of `run-task` would report a green migration that never ran,
 * and the Deploy stage behind it would then deploy code over an unmigrated
 * database. That is `docs/HANDOFF.md` §5.6 with a database attached.
 */
const RUN_TASK_STARTED_JS =
  'const fs=require("fs");' +
  'const r=JSON.parse(fs.readFileSync("run.json","utf8"));' +
  'const f=r.failures||[];' +
  'if(f.length>0){console.error("FATAL: ecs run-task reported failures: "+JSON.stringify(f));process.exit(1)}' +
  'const t=(r.tasks||[])[0];' +
  'if(!t||!t.taskArn){console.error("FATAL: ecs run-task started no task AND reported no failure. It exits 0 in that case; treating that as success would let Deploy run over an unmigrated database.");process.exit(1)}' +
  'fs.writeFileSync("task-arn.txt",t.taskArn);' +
  'console.log("started "+t.taskArn)'

/**
 * 🛑 A MISSING EXIT CODE IS NOT A ZERO EXIT CODE.
 *
 * `containers[0].exitCode` is `null` whenever the container never ran — an image
 * pull failure, a missing secret, an ENI that could not be provisioned, a task
 * stopped by the scheduler. `--query … --output text` prints that as the word
 * `None`, and any shell comparison that treats a non-numeric value as anything
 * but a failure fails OPEN. So the value is read as JSON and its TYPE is checked
 * before its value.
 */
const MIGRATION_EXIT_CODE_JS =
  'const fs=require("fs");' +
  'const t=(JSON.parse(fs.readFileSync("stopped.json","utf8")).tasks||[])[0];' +
  'if(!t){console.error("FATAL: describe-tasks returned no task");process.exit(1)}' +
  'console.log("stopCode="+t.stopCode+" stoppedReason="+t.stoppedReason);' +
  'const c=(t.containers||[]).find(x=>x.name===process.env.CONTAINER);' +
  'if(!c){console.error("FATAL: no container named "+process.env.CONTAINER+" in the stopped task");process.exit(1)}' +
  'if(typeof c.exitCode!=="number"){console.error("FATAL: the migration container has NO numeric exit code (reason: "+c.reason+"). It never ran, or it was killed. A missing exit code is not a zero exit code.");process.exit(1)}' +
  'if(c.exitCode!==0){console.error("FATAL: the migration exited "+c.exitCode+". The pipeline stops here and the Deploy stage does not run.");process.exit(1)}' +
  'console.log("migration exited 0")'

/**
 * G261: *"a deploy that trips an alarm inside its bake window rolls back (ECS
 * deployment circuit breaker with the alarm attached)"*.
 *
 * 🛑 THE CIRCUIT BREAKER IS A PROPERTY OF THE SERVICE, AND THE SERVICE IS NOT
 * THIS STACK'S. It is `deploymentConfiguration.deploymentCircuitBreaker` on the
 * ECS service in the `Planes` stack, and nothing this pipeline declares can turn
 * it on. What this stage CAN do — and does — is REFUSE TO DEPLOY a service that
 * does not have it, which turns an assumption about another stack into a checked
 * precondition with a loud failure. That is the half of G261 that is decidable
 * from here; the ALARMS themselves belong to the `Observability` stack and are
 * named as not built in `infra/lib/pipeline-stack.ts`'s header.
 *
 * 🛑 AND IT REFUSES A SERVICE SCALED TO ZERO, WHICH IS NOT A SECOND CHECK BOLTED
 * ON — IT IS THE SAME ONE. THE FIRST REAL DEPLOY FOUND THIS.
 *
 * `ControlPlaneEveningDown` and `DataPlaneEveningDown` — `cron(0 13 ? * MON-FRI *)`,
 * the cost schedule — set both scalable targets to min 0 / max 0 nine hours
 * before the pipeline reached this stage. `desiredCount` was 0, and EVERY
 * CONTROL BELOW THIS POINT WENT VACUOUS AT ONCE:
 *
 *   · `aws ecs wait services-stable` returns IMMEDIATELY, because running 0
 *     equals desired 0 and a service with no tasks is perfectly stable;
 *   · the CIRCUIT BREAKER cannot trip, because nothing starts for it to watch —
 *     so the precondition checked four lines up is satisfied and MEANS NOTHING;
 *   · the ALB health check never runs, because there is no target to check.
 *
 * ⚠️ THE STAGE DID FAIL, AND IT FAILED FOR THE WRONG REASON: `rolloutState` was
 * still `IN_PROGRESS` at the instant a waiter that had waited for nothing
 * returned. That is luck. A second of scheduling jitter the other way and this
 * pipeline would have reported a GREEN DEPLOY OF AN IMAGE RUNNING ON NO TASKS,
 * which is `docs/HANDOFF.md` §5.6 — a checker that passes while asserting
 * nothing — arriving three controls deep.
 *
 * The fix is not a retry loop around `rolloutState`. A retry would paper over
 * the one signal that caught this. THE PRECONDITION IS THAT THERE IS SOMETHING
 * TO DEPLOY ONTO: a deploy to zero tasks is not a deploy, and this stage says so
 * and stops.
 */
const CIRCUIT_BREAKER_REQUIRED_JS =
  'const fs=require("fs");' +
  'const s=(JSON.parse(fs.readFileSync("service.json","utf8")).services||[])[0];' +
  'if(!s){console.error("FATAL: describe-services returned no service");process.exit(1)}' +
  'const b=(s.deploymentConfiguration||{}).deploymentCircuitBreaker||{};' +
  'if(b.enable!==true||b.rollback!==true){console.error("FATAL: G261 requires the ECS deployment circuit breaker WITH rollback on every service this pipeline deploys. "+s.serviceName+" has enable="+b.enable+" rollback="+b.rollback+". The circuit breaker belongs to the Planes stack; this stage refuses rather than deploying without it.");process.exit(1)}' +
  'if(s.desiredCount===0){console.error("FATAL: "+s.serviceName+" has desiredCount 0, so there is nothing to deploy onto. ecs wait services-stable returns immediately at zero, the circuit breaker cannot trip because no task starts, and the ALB health check never runs - every control after this point would pass while asserting nothing. The cost schedule (ControlPlaneEveningDown / DataPlaneEveningDown, cron(0 13 ? * MON-FRI *)) scales these services to 0, and since G2301 the WakeFleet action at runOrder 1 raises them - so reaching here at 0 means the fleet was scaled down again between the two actions.");process.exit(1)}' +
  'console.log(s.serviceName+": circuit breaker enabled with rollback, desiredCount="+s.desiredCount)'

/**
 * 🛑 `aws ecs wait services-stable` RETURNS SUCCESS AFTER A ROLLBACK, AND THAT IS
 * THE SINGLE MOST MISLEADING THING IN THIS FILE.
 *
 * When the circuit breaker trips, ECS rolls the service back to the previous
 * task definition and the service then becomes STABLE — on the OLD code. The
 * waiter is satisfied. A stage that stopped there would report a green deploy of
 * an image that is not running anywhere.
 *
 * So the deploy is verified against the thing it asked for: the service's
 * settled `taskDefinition` must be the revision this stage registered, and the
 * primary deployment's `rolloutState` must be `COMPLETED`. A rollback then fails
 * the pipeline, which is what *"rolls back"* has to mean if anybody is to find
 * out that it did.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🛑 W0-b, G1301 — THIS WAS SAMPLED ONCE AND IT ABORTED A DEPLOY THAT HAD
 * SUCCEEDED. Pipeline execution `235be2b3`.
 *
 * `aws ecs wait services-stable` succeeds on `length(deployments)==1 &&
 * runningCount==desiredCount` and **NEVER READS `rolloutState`**, which AWS
 * documents as reaching `COMPLETED` *after* the service reaches steady state.
 * So the waiter returning and the rollout being COMPLETED are TWO EVENTS, and
 * a single `describe-services` between them reads `IN_PROGRESS` and called it
 * fatal. The RED, captured against the previous form of this script with a
 * service that had settled on exactly the revision this stage registered:
 *
 *     rolloutState=IN_PROGRESS  -> exit 1
 *       FATAL: the primary deployment rolloutState is IN_PROGRESS, not COMPLETED
 *     rolloutState=COMPLETED    -> exit 0
 *       deployed …/reconcile-data-staging:40
 *
 * Same successful deploy, one sample apart in time, opposite verdicts. That is
 * a race decided by a stopwatch, which is the shape `compose.yaml`'s own header
 * already records once.
 *
 * WHAT REPLACES IT IS A THREE-VALUED VERDICT, POLLED BY THE SHELL:
 *
 *     exit 0   done      — settled on what we asked for AND the rollout COMPLETED
 *     exit 1   fatal     — stop the pipeline, and the message says why
 *     exit 75  retry     — nothing is decided yet; ask again
 *
 * 75 is `EX_TEMPFAIL`. It is a NUMBER RATHER THAN A STRING ON STDOUT because
 * the shell reads exit codes and a pipe reports the pipe's status —
 * `tests/infra/support.mjs` states the same rule at its head.
 *
 * 🛑 AN ABSENT `rolloutState` IS NEVER TERMINAL, SO IT IS FATAL IMMEDIATELY AND
 * IS NOT POLLED (G1302). AWS returns that field only for services using the
 * rolling-update (ECS) deployment controller that are NOT behind a Classic Load
 * Balancer. Its absence is therefore a fact about how the SERVICE is
 * configured, and no amount of waiting changes a configuration. A naive
 * poll-until-terminal burns the whole budget and then reports a TIMEOUT for
 * something that was never going to arrive — a true statement pointing at the
 * wrong repair, which is worse than the defect it replaced.
 *
 * 🛑 AND THE `taskDefinition` COMPARISONS COME FIRST, AHEAD OF EVERY ROLLOUT
 * ARM (G1303). A rollback observed MID-FLIGHT is still a rollback; if the
 * rollout arms ran first it would answer 75 and be polled at, patiently, until
 * the budget ran out — reported as a timeout instead of as the circuit breaker
 * doing exactly what G261 asks it to.
 *
 * ⚠️ THERE ARE **TWO** SUCH COMPARISONS AND THAT IS NOT DUPLICATION — IT IS THE
 * ONE UNWITNESSED PREMISE IN THIS FILE, HEDGED (G1304). READ THIS BEFORE
 * DELETING EITHER.
 *
 * The premise: **that ECS resets `service.taskDefinition` on a circuit-breaker
 * rollback.** It is taken from the paragraph above, which is a comment, and
 * **nobody in this repository has ever witnessed it.** If it is FALSE then the
 * service-level comparison has been VACUOUS since it was written, and the shape
 * of the failure is exact: on a rollback ECS fails the deployment that tripped
 * the breaker and makes a NEW deployment of the previous revision PRIMARY, and
 * that rollback deployment reaches `COMPLETED` normally. So at settle time a
 * service-level check that never fires meets a PRIMARY that is COMPLETED, and
 * the verdict is **exit 0 on a rollback**.
 *
 * ⚠️ AND THE `FAILED` ARM IS NOT A BACKSTOP FOR IT, WHICH IS THE PART THAT IS
 * EASY TO GET WRONG: `FAILED` is carried by the deployment that TRIPPED, and by
 * the time the waiter returns that deployment is no longer PRIMARY. The `FAILED`
 * arm narrows the window; it does not close it.
 *
 * So a SECOND comparison is made against `deployments[].taskDefinition` — the
 * PRIMARY deployment's own field — which is the old revision on a rollback
 * whether or not the service-level field was reset. **That arm rests on no
 * unwitnessed premise.** The two are each SUFFICIENT and neither is necessary,
 * which is `server/data-plane/role-grants.ts`'s shape: `canGrant()` and the
 * restrictive policy, defence in depth rather than §5.3.
 *
 * 🛑 THE PREMISE IS **NOT SETTLED BY ANY OF THIS AND MUST NOT BE READ AS
 * SETTLED.** The fixtures in `tests/infra/pipeline.test.mjs` are written by us
 * and would encode whatever we believed; a fixture cannot witness AWS. Settling
 * it needs a DELIBERATE ROLLBACK against a scratch service — an image that
 * fails its health check, the breaker allowed to trip, and
 * `describe-services` read back — and this repository is code-and-synth only.
 * **UNMEASURED, stated as unmeasured.**
 *
 * ⚠️ AN UNKNOWN `rolloutState` IS FATAL AND NOT A RETRY, for the same reason the
 * absent one is: ECS documents exactly three values, and polling at a value we
 * cannot interpret spends the budget to report a timeout. The message NAMES what
 * it saw. This is not `0007`/`0069`'s polarity inverted — there the unknown value
 * must reach the MODEL as a refusal rather than be rejected at write time, and a
 * loud refusal naming the value is exactly what that asks for.
 *
 * 🛑 **G2304 — AND A `COMPLETED` ROLLOUT IS ONLY A DEPLOY IF TASKS RUN IT.**
 * Since G2301 the fleet may be woken minutes before this verdict runs, and a
 * scheduled `…EveningDown` can fire mid-deploy. Until this arm the verdict
 * never asked how many tasks run the revision, so a `COMPLETED` at desired 0
 * printed `deployed` over ZERO tasks (whether ECS reports `COMPLETED` there is
 * UNMEASURED, and the arm does not rest on it either way) — which
 * is exactly the green-onto-nothing `CIRCUIT_BREAKER_REQUIRED_JS` refuses up
 * front, arriving at the far end instead. The arm is FATAL on a desired count
 * below one, RETRIES while running ≠ desired, and treats an ABSENT count as
 * fatal rather than as zero. `tests/infra/pipeline.test.mjs` witnesses it.
 */
const ROLLOUT_VERDICT_JS =
  'const fs=require("fs");' +
  'const RETRY=75;' +
  'const s=(JSON.parse(fs.readFileSync("service-after.json","utf8")).services||[])[0];' +
  'if(!s){console.error("FATAL: describe-services returned no service");process.exit(1)}' +
  'const want=process.env.WANT_TASK_DEFINITION;' +
  'if(!want){console.error("FATAL: WANT_TASK_DEFINITION is unset, so this verdict would compare the deployed revision against nothing and pass. A comparison against an empty string is not a comparison.");process.exit(1)}' +
  'const d=(s.deployments||[]).find(x=>x.status==="PRIMARY");' +
  'if(!d){console.error("FATAL: "+s.serviceName+" has no PRIMARY deployment. A service that has reached a steady state always has one, so there is nothing here to call finished.");process.exit(1)}' +
  'console.log(s.serviceName+": rolloutState="+d.rolloutState+" service.taskDefinition="+s.taskDefinition+" primary.taskDefinition="+d.taskDefinition);' +
  'if(typeof d.taskDefinition!=="string"){console.log("NOTE: the PRIMARY deployment carries no taskDefinition, so the rollback arm that rests on no unwitnessed premise did not run. The service-level arm below is the only one left.")}' +
  'else if(d.taskDefinition!==want){console.error("FATAL: the PRIMARY deployment is running "+d.taskDefinition+" rather than "+want+". The deployment circuit breaker ROLLED BACK: ECS fails the deployment that tripped it, makes a NEW deployment of the previous revision primary, and that rollback deployment reaches COMPLETED normally. This arm reads the deployment itself, so it does not depend on ECS resetting service.taskDefinition.");process.exit(1)}' +
  'if(s.taskDefinition!==want){console.error("FATAL: the service settled on "+s.taskDefinition+" rather than on "+want+". The deployment circuit breaker ROLLED BACK. ecs wait services-stable succeeds after a rollback, because a rolled-back service is stable — this check, not the waiter, is what makes a rollback a red pipeline.");process.exit(1)}' +
  'if(typeof d.rolloutState!=="string"){console.error("FATAL: the PRIMARY deployment of "+s.serviceName+" carries NO rolloutState. AWS returns that field only for services using the rolling update (ECS) deployment controller that are NOT behind a Classic Load Balancer, so its absence is a fact about how this service is configured and never a moment in time. Polling for it would spend the whole budget and then report a timeout for something that was never going to arrive.");process.exit(1)}' +
  'if(d.rolloutState==="COMPLETED"){' +
  'if(typeof s.desiredCount!=="number"||typeof d.runningCount!=="number"||typeof d.desiredCount!=="number"){console.error("FATAL: "+s.serviceName+" carries no numeric desiredCount/runningCount. A COMPLETED rollout is only a deploy if tasks run it, and an absent count is not a count.");process.exit(1)}' +
  'if(s.desiredCount<1||d.desiredCount<1){console.error("FATAL: the rollout COMPLETED onto desiredCount "+s.desiredCount+". That is a deploy onto ZERO tasks - the scheduled scale-down fired mid-deploy, or a person scaled the service - and G2304 refuses to call it green.");process.exit(1)}' +
  'if(d.runningCount!==d.desiredCount){console.log("rollout COMPLETED but "+d.runningCount+" of "+d.desiredCount+" tasks run it; asking again");process.exit(RETRY)}' +
  'console.log("deployed "+want+" on "+d.runningCount+" running task(s)");process.exit(0)}' +
  'if(d.rolloutState==="FAILED"){console.error("FATAL: the primary deployment rolloutState is FAILED (reason: "+d.rolloutStateReason+"). The deployment circuit breaker tripped.");process.exit(1)}' +
  'if(d.rolloutState==="IN_PROGRESS"){console.log("rollout still IN_PROGRESS (reason: "+d.rolloutStateReason+"). ecs wait services-stable does not read this field, so returning from it is not the same event as the rollout completing.");process.exit(RETRY)}' +
  'console.error("FATAL: unknown rolloutState "+d.rolloutState+". ECS documents COMPLETED, FAILED and IN_PROGRESS and this is none of them. Treating a value we cannot read as a retry would spend the budget and report a timeout, so this stage names what it saw and stops.");process.exit(1)'

/**
 * STAGE 4 — MIGRATE. `docs/tech-stack.md` §9.1: *"ECS run-task ×2 (control,
 * data) · waits for exit 0"*, BEFORE the services deploy.
 *
 * CONTROL FIRST, THEN DATA, AND THE ORDER IS INVARIANT 3 RATHER THAN TASTE: the
 * control plane publishes downward, so its catalogue schema is the one a data
 * plane may read against. Either failing stops the stage; the second never
 * starts if the first did not exit 0.
 *
 * ⚠️ THIS STAGE DOES NOT KILL A MIGRATION IT GAVE UP WAITING FOR, and that is
 * deliberate. `db/migrate.ts` is forward-only and records each file as it
 * applies it; stopping the task mid-file is how a half-applied schema is made.
 * When the waiter budget is exhausted the stage FAILS and prints the task ARN
 * for a person to look at, which is the honest thing a script can do.
 */
export const MIGRATE_BUILDSPEC_YAML = `version: 0.2

# STAGE 4 OF 5. Reached only after a green gate and a green build; NEVER a step
# inside the gate. G108 is not amended by this stage's existence — the whole of
# G257's "G108 is not amended" is that build, migrate and deploy are SEPARATE
# STAGES. DO NOT MOVE ANY OF THIS INTO THE GATE.
#
# THE INPUT IS THE BUILD STAGE'S ARTEFACT, AND THE ONLY THING READ OUT OF IT IS
# image-digest.txt. G262: by digest, never by tag. There is no tag anywhere in
# this file and CODEBUILD_RESOLVED_SOURCE_VERSION is never read.
#
# ⚠️ THE GUARDS BELOW ARE NOT DECORATION. tests/infra/pipeline.test.mjs reads
#    every  test -n  guard out of this file and requires the project that runs
#    it to set that variable. A real pipeline run failed four minutes in, after
#    a docker build and a push, with an obscure AWS error, because a buildspec
#    asserted nothing; the one that asserted failed in one second with the
#    variable named.
phases:
  pre_build:
    commands:
      - |
        set -eu
        test -n "$ECR_REGISTRY"
        test -n "$PLANE_REPOSITORY_NAME"
        test -n "$ECS_CLUSTER_NAME"
        test -n "$CONTROL_MIGRATE_TASK_FAMILY"
        test -n "$DATA_MIGRATE_TASK_FAMILY"
        test -n "$CONTROL_CONTAINER_NAME"
        test -n "$DATA_CONTAINER_NAME"
        test -n "$PRIVATE_SUBNET_IDS"
        test -n "$CONTROL_SECURITY_GROUP_ID"
        test -n "$DATA_SECURITY_GROUP_ID"
        test -n "$MIGRATE_WAIT_ROUNDS"
      - |
        set -eu
        # The digest the Build stage resolved FROM THE REGISTRY, not from its
        # local daemon. A tag is never read here.
        test -s "$CODEBUILD_SRC_DIR/image-digest.txt"
        DIGEST="$(tr -d " \\n" < "$CODEBUILD_SRC_DIR/image-digest.txt")"
        case "$DIGEST" in
          sha256:*) ;;
          *) echo "FATAL: image-digest.txt does not hold a sha256 digest: $DIGEST" >&2; exit 1 ;;
        esac
        echo "$DIGEST" > digest.txt
        # Fail here, in one second, rather than inside ECS four minutes later
        # with a task that cannot pull. Same lesson as the guards above.
        aws ecr describe-images --region "$AWS_REGION" --repository-name "$PLANE_REPOSITORY_NAME" --image-ids imageDigest="$DIGEST" --output text > /dev/null
        echo "migrate: the image under test is $DIGEST"
  build:
    commands:
      - |
        set -eu
        DIGEST="$(cat digest.txt)"
        IMAGE="$ECR_REGISTRY/$PLANE_REPOSITORY_NAME@$DIGEST"

        migrate_plane() {
          LABEL="$1"
          FAMILY="$2"
          CONTAINER="$3"
          SG="$4"
          echo "=== migrate $LABEL ($FAMILY) ==="

          aws ecs describe-task-definition --region "$AWS_REGION" --task-definition "$FAMILY" --output json > td-current.json
          CONTAINER="$CONTAINER" IMAGE="$IMAGE" node -e '${RETAG_TASK_DEFINITION_JS}'
          TD_ARN="$(aws ecs register-task-definition --region "$AWS_REGION" --cli-input-json file://td-next.json --query 'taskDefinition.taskDefinitionArn' --output text)"
          test -n "$TD_ARN"

          aws ecs run-task --region "$AWS_REGION" --cluster "$ECS_CLUSTER_NAME" --task-definition "$TD_ARN" --launch-type FARGATE --count 1 --started-by "reconcile-pipeline-migrate" --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_IDS],securityGroups=[$SG],assignPublicIp=DISABLED}" --output json > run.json
          node -e '${RUN_TASK_STARTED_JS}'
          TASK_ARN="$(cat task-arn.txt)"

          # The waiter's own ceiling is 100 attempts at 6s — ten minutes — and a
          # migration may outlive it. Exceeding the ceiling is NOT a failure of
          # the migration, so the waiter is re-entered rather than believed, up
          # to a declared budget. Nothing here stops the task: see the note on
          # MIGRATE_BUILDSPEC_YAML.
          ROUND=0
          while :; do
            ROUND=$((ROUND + 1))
            if aws ecs wait tasks-stopped --region "$AWS_REGION" --cluster "$ECS_CLUSTER_NAME" --tasks "$TASK_ARN"; then
              break
            fi
            if [ "$ROUND" -ge "$MIGRATE_WAIT_ROUNDS" ]; then
              echo "FATAL: the $LABEL migration $TASK_ARN is STILL RUNNING after $ROUND waiter rounds." >&2
              echo "       It has NOT been stopped: killing a forward-only migration mid-file is how a half-applied schema is made. Look at the task." >&2
              exit 1
            fi
            echo "migrate $LABEL: still running after round $ROUND; waiting again"
          done

          aws ecs describe-tasks --region "$AWS_REGION" --cluster "$ECS_CLUSTER_NAME" --tasks "$TASK_ARN" --output json > stopped.json
          CONTAINER="$CONTAINER" node -e '${MIGRATION_EXIT_CODE_JS}'
          echo "=== migrate $LABEL: exit 0 ==="
        }

        # Control first. Invariant 3: the control plane publishes downward.
        migrate_plane control "$CONTROL_MIGRATE_TASK_FAMILY" "$CONTROL_CONTAINER_NAME" "$CONTROL_SECURITY_GROUP_ID"
        migrate_plane data "$DATA_MIGRATE_TASK_FAMILY" "$DATA_CONTAINER_NAME" "$DATA_SECURITY_GROUP_ID"
        echo "both migrations exited 0; the Deploy stage may run"
`

/**
 * 🛑 G993 — A SYNC OF AN EMPTY DIRECTORY WITH `--delete` IS AN OUTAGE, NOT A
 * NO-OP, AND IT IS THE ONE FAILURE THIS WHOLE HALF HAD TO BE DESIGNED AROUND.
 *
 * `aws s3 sync <local> s3://<bucket>/ --delete` makes the bucket look like the
 * local directory. If the Build stage's artefact reached this stage WITHOUT
 * `frontend/dist` — an artefact declaration edited, a build that emitted
 * nothing, a path that moved — the local directory is empty or absent and the
 * sync DELETES EVERY OBJECT THE SITE IS SERVED FROM. `aws s3 sync` exits 0
 * doing it, and CloudFront then serves 403s from an empty origin until
 * somebody re-runs a pipeline.
 *
 * ⚠️ `test -d` IS NOT ENOUGH AND THAT IS WHY THIS IS A NODE SCRIPT RATHER THAN
 * ONE MORE SHELL GUARD. A directory that exists and holds nothing passes it, as
 * does one holding a stray `.vite/manifest.json` and no page. The three things
 * asserted are the three the deployed site cannot be served without: the
 * directory, `index.html` with bytes in it, and **at least one hashed asset** —
 * because `index.html` alone is a page that loads nothing.
 *
 * ⚠️ IT DOES NOT VALIDATE THE HTML AND MUST NOT START. That is
 * `npm run build:frontend`'s business and the gate already ran it; a second,
 * weaker opinion about what a good bundle is would be `docs/HANDOFF.md` §5.3.
 */
const BUNDLE_IS_PRESENT_JS =
  'const fs=require("fs");const path=require("path");' +
  'const dir=process.env.BUNDLE_DIR;' +
  'if(!fs.existsSync(dir)||!fs.statSync(dir).isDirectory()){console.error("FATAL: "+dir+" is not a directory. The Build stage artefact did not carry frontend/dist. Syncing an absent directory with --delete would EMPTY the bucket the site is served from, and exit 0 doing it.");process.exit(1)}' +
  'const index=path.join(dir,"index.html");' +
  'if(!fs.existsSync(index)||fs.statSync(index).size===0){console.error("FATAL: "+index+" is missing or empty. That is the page; refusing to sync.");process.exit(1)}' +
  'const walk=(d)=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);' +
  'const files=walk(dir);' +
  'const assets=files.filter(f=>/\\.(js|css)$/.test(f));' +
  'if(assets.length===0){console.error("FATAL: the bundle carries no .js and no .css at all, only "+files.length+" file(s). An index.html with no assets is a blank page, and --delete would remove the assets already serving the site.");process.exit(1)}' +
  'console.log("bundle: "+files.length+" file(s), "+assets.length+" asset(s), index.html "+fs.statSync(index).size+" bytes")'

/**
 * 🛑 AN INVALIDATION IS NOT DONE WHEN `create-invalidation` RETURNS, AND A
 * STAGE THAT STOPPED THERE WOULD BE GREEN OVER A SITE STILL SERVING THE OLD
 * `index.html`.
 *
 * `create-invalidation` returns an `Invalidation` in state `InProgress`. The
 * id is read out of the response and waited on; a response with no id at all
 * fails rather than being treated as nothing to wait for, which is the same
 * fail-closed reading `RUN_TASK_STARTED_JS` gives `ecs run-task`'s empty
 * `tasks` array one stage over.
 */
const INVALIDATION_STARTED_JS =
  'const fs=require("fs");' +
  'const r=JSON.parse(fs.readFileSync("invalidation.json","utf8"));' +
  'const id=((r||{}).Invalidation||{}).Id;' +
  'if(typeof id!=="string"||id===""){console.error("FATAL: create-invalidation returned no invalidation id: "+JSON.stringify(r)+". Treating that as nothing to wait for would report a green deploy over a distribution still serving the previous index.html.");process.exit(1)}' +
  'fs.writeFileSync("invalidation-id.txt",id);' +
  'console.log("invalidation "+id+" started")'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 G2041 — THE PIPELINE WRITES THE STACK VALUE. **THE OWNER'S RULING, 22 Sep
 *    2026: *"Fix it properly — make the pipeline write the stack value."***
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **THE DEFECT, MEASURED 23 Sep 2026 and reproducible read-only with
 * `AWS_PROFILE=crm-frontend node tests/e2e/probe-deployed-image.mjs`:**
 *
 *     reconcile-staging-data-plane
 *       running        …DataPlaneTaskB4F25A67:43  cc58f357…  pushed 09-23T10:51
 *       CloudFormation …DataPlaneTaskB4F25A67:40  56d9d053…  pushed 09-20T07:54
 *       *** DRIFT ***
 *
 * The Deploy stage registered a task definition and called `UpdateService`, and
 * **never wrote anything back to CloudFormation** — so the SERVICE moved and the
 * STACK did not, after every single deploy. `56d9d053…` was running nowhere.
 * A bare `cdk deploy reconcile-planes-staging` then rolls both planes BACKWARDS,
 * silently, against a forward-only schema (G88); G1012 and G1013 measure that.
 *
 * 🛑 **THE ALTERNATIVES, AND WHY EACH IS REFUSED. Read these before replacing
 * the shape below — three of the four are more obvious than the one taken.**
 *
 *   (a) **Reinstate `PlaneImageTag` as a `CfnParameter` and have the pipeline
 *       write it.** REFUSED, and it is the one to refuse hardest. `cdk deploy`
 *       sends `UsePreviousValue: true` for every parameter it is not given, so
 *       the channel is silent by construction — **that is the whole of G1012**,
 *       and a pipeline that wrote the parameter would fix the drift while
 *       leaving the silence for the first deploy the pipeline did not perform.
 *       A control that works only while nothing goes wrong is not a control.
 *
 *   (b) **Have `Planes` read the tag from SSM at deploy time** (a
 *       `{{resolve:ssm:…}}` dynamic reference the pipeline writes). REFUSED on
 *       a MEASUREMENT rather than on taste: the probe compares the image on the
 *       task definition **CloudFormation owns** against the one the service
 *       runs, and a dynamic reference is resolved INTO that resource at deploy
 *       time — so the stack would still own whatever it resolved at the last
 *       deploy and **the probe would still report DRIFT**. It also costs
 *       G1012's other half, because `cdk diff` cannot see through the
 *       indirection and would stop showing the image moving. CDK spells it as
 *       a `CfnParameter` besides, which is (a) wearing a different hat.
 *
 *   (c) **`cdk deploy reconcile-planes-<env>` from this stage.** REFUSED on
 *       BLAST RADIUS, which `DEPLOY_BUILDSPEC_YAML` already states in its own
 *       voice: it *"would put this role in a position to change networking,
 *       security groups and databases on every merge to `main`"*. It needs the
 *       CDK toolchain, the SOURCE tree this stage does not receive, and the
 *       bootstrap deploy role — which can deploy any stack in the account.
 *       **And it changes what a deploy MEANS**: every merged edit to
 *       `planes-stack.ts` would ship to staging unreviewed, which is a ruling
 *       nobody has taken.
 *
 *   (d) **Keep the ECS deploy and ADD a stack write afterwards.** REFUSED as
 *       INCOHERENT rather than as costly. CloudFormation would register its own
 *       revision and update the service a SECOND time, so every pipeline run
 *       would roll the fleet twice — and the bytes finally running would be the
 *       ones CloudFormation's TAG resolved, which means the digest the first
 *       half paid for was discarded by the second. It also doubles the waiter
 *       budget W0-d derived.
 *
 * ✅ **WHAT IS TAKEN: A NARROW, SCOPED `UpdateStack` ON ONE NAMED STACK, USING
 * CLOUDFORMATION'S OWN CURRENT TEMPLATE, MUTATED AT NOTHING BUT THE IMAGE TAG.**
 * CloudFormation LEARNS nothing — there is no parameter, no SSM reference and
 * no export. It is simply told, by the same run that built the image, in the
 * only place a stack's idea of the image can actually live: the template.
 *
 * 🛑 **THE PROPERTY THAT MAKES IT SAFE IS MEASURED AND IT IS LIVE TODAY: the
 * deployed `Planes` template is BYTE-IDENTICAL to
 * `cdk synth reconcile-planes-staging -c planeImageTag=<the tag it owns>`.**
 * Verified 23 Sep 2026 against the real stack — 32 resources, zero differing.
 * So taking that template and changing only the tag yields **exactly what CDK
 * would have synthesised for the new tag**, and the invariant survives the
 * write rather than being spent by it. `tests/infra/pipeline.test.mjs` asserts
 * precisely that, against two tags typed into the test: retag(synth(A), B)
 * must equal synth(B), byte for byte.
 *
 * ⚠️ **AND `cdk diff` BECOMES A STRONGER CONTROL RATHER THAN A WEAKER ONE.**
 * After a pipeline run, `cdk diff -c planeImageTag=<the tag the pipeline
 * wrote>` reports NO differences at all — so any difference a human sees is
 * something else that changed, which is what §11.4 has been asking readers to
 * check by eye. A digest written into the template would have made that diff
 * permanently dirty; a tag keeps it clean, and that is why the tag is written
 * and not the digest.
 *
 * ⚠️ **G262 IS NOT SPENT, IT IS PAID FOR DIFFERENTLY AND MORE EXPENSIVELY.**
 * The stage refuses to write any tag it has not just watched the REGISTRY
 * resolve to the digest the Build stage produced. *"A commit sha names a
 * commit, not bytes"* — so this stage makes the registry say, at the moment of
 * use, that this sha names these bytes. That is strictly stronger than the
 * immutability assumption `planes-stack.ts` has relied on since it was written,
 * and strictly weaker than a literal digest only in the window between that
 * check and the ECS pull.
 *
 * ⚠️ **ONE PREMISE IS UNWITNESSED AND IS NAMED RATHER THAN ASSUMED — G2048,
 * and G1304's precedent for exactly this.** `UpdateStack` called with no
 * `--role-arn` reuses the role already associated with the stack, which here is
 * `cdk-reconcile-cfn-exec-role-…` (read from the live stack, 23 Sep 2026). AWS
 * documents that reuse; **nobody in this repository has witnessed whether the
 * CALLER additionally needs `iam:PassRole` for it.** No grant is made for it,
 * deliberately — a privilege ahead of its writer is `0004`'s refusal, and if
 * the premise is wrong the first run fails LOUDLY with an IAM message naming
 * the role, which is the discoverable direction. `docs/build/deploy-handoff.md`
 * §17 tells the next deployer to watch that run for exactly this.
 */

/**
 * CloudFormation's ceiling on an INLINE `TemplateBody`, in bytes.
 *
 * 🛑 IT IS AWS'S NUMBER AND IT IS A REAL CLIFF, SO IT IS NAMED ONCE AND
 * ASSERTED TWICE — G2047. `UpdateStack` refuses a body over this with a
 * `ValidationError`, and the repair is a `TemplateURL` in S3, which needs a
 * bucket and a grant this stage deliberately does not have.
 *
 * ⚠️ **MEASURED, NOT ASSUMED: the live `Planes` template is 35,843 bytes
 * minified against this 51,200** (23 Sep 2026), so there is room — and the
 * headroom is exactly the kind of fact that stops being true quietly.
 * `RETAG_PLANES_TEMPLATE_JS` refuses at run time and
 * `tests/infra/pipeline.test.mjs` refuses at `npm run check`, so the day the
 * stack outgrows it is a red GATE rather than a red PIPELINE.
 *
 * ⚠️ IT IS THE MINIFIED SIZE THAT COUNTS. `aws cloudformation get-template`
 * prints the template pretty — 92,822 bytes for the same 35,843 — and a check
 * written against what the CLI printed would fire years early.
 */
export const CLOUDFORMATION_INLINE_TEMPLATE_BYTES = 51_200

/**
 * Rewrite the plane image tag in CloudFormation's OWN template, and PROVE that
 * nothing else moved.
 *
 * 🛑 THE NARROWNESS IS NOT A CLAIM, IT IS CHECKED, AND THAT CHECK IS THE WHOLE
 * REASON THIS IS SAFE TO RUN UNATTENDED ON EVERY MERGE. The input is the
 * template CloudFormation already has, so nothing a contributor merged into
 * `planes-stack.ts` can ride along; and before the result is written, both
 * templates are re-serialised with every task-definition container image
 * blanked out and compared. **If those two strings differ, this mutation
 * touched something other than an image and the stage stops.**
 *
 * ⚠️ AN IMAGE THAT IS NOT IN OUR REPOSITORY IS FATAL, NEVER SKIPPED. A sidecar
 * — a log router, an agent — would carry a different image, and a rule that
 * quietly left it alone would be fine today and wrong the day somebody adds
 * one with a tag of its own. Refusing names the container and stops.
 */
const RETAG_PLANES_TEMPLATE_JS =
  'const fs=require("fs");' +
  'const tag=process.env.TAG;const repository=process.env.REPOSITORY;' +
  'if(!/^[0-9a-f]{40}$/.test(tag||"")){console.error("FATAL: TAG is not a 40-hex commit sha: "+tag+". The only tag this pipeline may write is the one the Build stage pushed.");process.exit(1)}' +
  'if(!repository){console.error("FATAL: REPOSITORY is unset, so every image would look like a foreign one and this script would refuse them all - or, worse, retag them.");process.exit(1)}' +
  'const original=JSON.parse(fs.readFileSync("template-current.json","utf8"));' +
  'const next=JSON.parse(JSON.stringify(original));' +
  'const suffix="/"+repository;' +
  'let rewritten=0;let already=0;' +
  'const retag=(text,where)=>{' +
  'const colon=text.lastIndexOf(":");' +
  'if(colon<0){console.error("FATAL: "+where+" image ["+text+"] carries no tag at all.");process.exit(1)}' +
  'const path=text.slice(0,colon);const current=text.slice(colon+1);' +
  'if(!path.endsWith(suffix)){console.error("FATAL: "+where+" runs ["+text+"], which is not in "+repository+". This stage retags THIS product image and refuses to touch any other - a sidecar with an image of its own must be left alone deliberately, not silently.");process.exit(1)}' +
  'if(current===tag){already+=1;return text}' +
  'rewritten+=1;return path+":"+tag};' +
  'for(const [logicalId,r] of Object.entries(next.Resources||{})){' +
  'if(r.Type!=="AWS::ECS::TaskDefinition")continue;' +
  'const containers=((r.Properties||{}).ContainerDefinitions)||[];' +
  'if(containers.length===0){console.error("FATAL: task definition "+logicalId+" declares no containers.");process.exit(1)}' +
  'for(const c of containers){' +
  'const where=logicalId+"/"+c.Name;' +
  'if(typeof c.Image==="string"){c.Image=retag(c.Image,where);continue}' +
  'const join=c.Image&&c.Image["Fn::Join"];' +
  'if(!Array.isArray(join)||join.length!==2||!Array.isArray(join[1])||join[1].length===0){console.error("FATAL: "+where+" has an Image this script cannot read: "+JSON.stringify(c.Image)+". It expects a plain string or an Fn::Join whose last element carries the tag. Refusing to guess.");process.exit(1)}' +
  'const parts=join[1];const last=parts[parts.length-1];' +
  'if(typeof last!=="string"){console.error("FATAL: "+where+" has an Fn::Join whose last element is not a string: "+JSON.stringify(last)+". The tag is not where this script expects it and a blind rewrite would corrupt the image.");process.exit(1)}' +
  'parts[parts.length-1]=retag(last,where)}}' +
  'if(rewritten+already===0){console.error("FATAL: this template declares no task-definition container image at all. Writing it back would be a stack update that asserts nothing.");process.exit(1)}' +
  'const blank=(t)=>{const c=JSON.parse(JSON.stringify(t));for(const r of Object.values(c.Resources||{})){if(r.Type!=="AWS::ECS::TaskDefinition")continue;for(const d of ((r.Properties||{}).ContainerDefinitions)||[])d.Image="<image>"}return JSON.stringify(c)};' +
  'if(blank(original)!==blank(next)){console.error("FATAL: this mutation changed something other than a task-definition container image. It is supposed to be narrow BY CONSTRUCTION - the template came from CloudFormation and only the tag was touched - so this is a defect in the script, not in the template. Nothing is written.");process.exit(1)}' +
  'const body=JSON.stringify(next);' +
  'const LIMIT=' +
  String(CLOUDFORMATION_INLINE_TEMPLATE_BYTES) +
  ';' +
  'if(Buffer.byteLength(body,"utf8")>LIMIT){console.error("FATAL: this stack template is "+Buffer.byteLength(body,"utf8")+" bytes minified and CloudFormation accepts at most "+LIMIT+" inline. UpdateStack would refuse this with a ValidationError. The repair is a TemplateURL in S3, which needs a bucket and a grant this stage does not have - so it stops here rather than half-deploying. tests/infra/pipeline.test.mjs asserts this ceiling against the synthesised template, so this should have been a red gate before it was ever a red pipeline.");process.exit(1)}' +
  'fs.writeFileSync("template-next.json",body);' +
  'console.log("retagged "+rewritten+" container image(s) to "+tag+"; "+already+" already there; "+Buffer.byteLength(body,"utf8")+" bytes of "+LIMIT)'

/**
 * Is this stack in a state `UpdateStack` can be called on, and what parameters
 * does it already carry?
 *
 * 🛑 THE PARAMETERS ARE REUSED AND THE IMAGE TAG IS NOT ONE OF THEM — READ THAT
 * SENTENCE TWICE, BECAUSE REUSING A PARAMETER IS THE DEFECT G1012 REMOVED.
 * `Planes` carries exactly one parameter, `BootstrapVersion`, and it is CDK's
 * own: an `AWS::SSM::Parameter::Value<String>` whose value is the SSM PATH
 * `/cdk-bootstrap/reconcile/version`, re-resolved by CloudFormation at every
 * deploy. Reusing a path is not reusing a version, and it cannot go stale the
 * way an image tag can. **The image tag is not a parameter and must never
 * become one again; it is written into the TEMPLATE, where `cdk diff` can see
 * it.**
 *
 * ⚠️ THE PARAMETER LIST IS READ FROM THE STACK RATHER THAN SPELLED HERE. The
 * template being written IS the stack's own, so its parameter set is the
 * stack's by construction — a hard-coded `BootstrapVersion` would be a second
 * spelling of a CDK internal, and it would break silently the day the
 * bootstrap template gains a second one.
 */
const STACK_READY_TO_UPDATE_JS =
  'const fs=require("fs");' +
  'const UPDATABLE=["CREATE_COMPLETE","UPDATE_COMPLETE","UPDATE_ROLLBACK_COMPLETE","IMPORT_COMPLETE","IMPORT_ROLLBACK_COMPLETE"];' +
  'const s=(JSON.parse(fs.readFileSync("stack-describe.json","utf8")).Stacks||[])[0];' +
  'if(!s){console.error("FATAL: describe-stacks returned no stack");process.exit(1)}' +
  'if(!UPDATABLE.includes(s.StackStatus)){console.error("FATAL: "+s.StackName+" is "+s.StackStatus+", which UpdateStack cannot be called on. The pipeline will not force it: a stack mid-update is somebody else deploying, and a stack in a failed state is one for a person to look at. The FLEET is untouched by this refusal - nothing has been deployed.");process.exit(1)}' +
  'const parameters=(s.Parameters||[]).map((p)=>({ParameterKey:p.ParameterKey,UsePreviousValue:true}));' +
  'fs.writeFileSync("parameters.json",JSON.stringify(parameters));' +
  'console.log(s.StackName+" is "+s.StackStatus+"; reusing "+parameters.length+" parameter(s): "+(parameters.map((p)=>p.ParameterKey).join(", ")||"none")+". The image tag is NOT among them - it is written into the template (G1012).")'

/**
 * The task definition CloudFormation OWNS for one family.
 *
 * 🛑 MATCHED ON THE FAMILY, NEVER ON A LOGICAL ID, AND THE PROBE MAKES THE SAME
 * CHOICE FOR THE SAME REASON: a logical id is a construct path, so a rule keyed
 * on one is a test of a NAME rather than of the property (§5.1). The family is
 * what the service's own revision carries.
 *
 * ⚠️ IT IS FED TO `ROLLOUT_VERDICT_JS` AS `WANT_TASK_DEFINITION`, WHICH IS THE
 * WHOLE OF THIS SLICE'S POST-CONDITION. That script is UNCHANGED — its two
 * comparisons used to ask *did the circuit breaker roll us back*, and given
 * this value they ask that AND *does the stack now agree with the fleet*, which
 * is the exact question `probe-deployed-image.mjs` asks from outside. One
 * script, one more meaning, no second opinion about what deployed means.
 */
const STACK_OWNED_TASK_DEFINITION_JS =
  'const fs=require("fs");' +
  'const family=process.env.FAMILY;' +
  'if(!family){console.error("FATAL: FAMILY is unset, so this would match every task definition in the stack or none.");process.exit(1)}' +
  'const all=(JSON.parse(fs.readFileSync("stack-resources.json","utf8")).StackResources||[]).filter((r)=>r.ResourceType==="AWS::ECS::TaskDefinition");' +
  'const owned=all.filter((r)=>typeof r.PhysicalResourceId==="string"&&r.PhysicalResourceId.includes("/"+family+":"));' +
  'if(owned.length!==1){console.error("FATAL: "+owned.length+" task definitions in this stack carry the family "+family+", and exactly one must. The stack and the service disagree about what this plane is called.");process.exit(1)}' +
  'fs.writeFileSync("owned-task-definition.txt",owned[0].PhysicalResourceId);' +
  'console.log("CloudFormation owns "+owned[0].PhysicalResourceId+" for "+family)'

/**
 * STAGE 5 — DEPLOY, FIRST ACTION. `docs/tech-stack.md` §9.1 stage 5.
 *
 * ⛔ **THIS LINE READ *"§9.1 stage 5, **including** the frontend half since
 * 20 Sep 2026 (G993)"* UNTIL 28 Sep 2026 AND IS CORRECTED RATHER THAN DELETED,
 * because it is the sentence four files point at when they say where the
 * bundle is published.** The frontend half is now
 * `PUBLISH_SITE_BUILDSPEC_YAML`, a SECOND ACTION in the SAME STAGE at
 * `runOrder: 2`. **The stage still does both things and still does them in that
 * order** — what changed is that the order is CodePipeline's rather than a
 * shell's, and that the two halves no longer share one IAM role.
 *
 * 🛑 **IT MOVED BECAUSE THIS BUILDSPEC OUTGREW A CEILING NOTHING HERE COULD
 * SEE — G2221.** G2041 took it from 14,661 characters to **28,180** against
 * CodeBuild's inline limit of **25,600**; `cdk synth` rendered it, `cdk diff`
 * showed it, `npm run check` was EXIT 0, and `UpdateProject` refused it and
 * rolled the stack back. `CODEBUILD_INLINE_BUILDSPEC_BYTES` below carries the
 * measurement, the refused alternatives, and why **no comment was deleted to
 * make room**.
 *
 * ⛔ **THE PARAGRAPH BELOW IS SUPERSEDED BY G2041 AND IS QUOTED RATHER THAN
 * DELETED, because it is the sentence `pipeline-stack.ts`, the probe and
 * `docs/build/deploy-handoff.md` all rest on, and because its reasoning is what
 * the replacement had to pay for rather than discard:**
 *
 *   *"🛑 BY DIGEST, NOT BY TAG (G262). The image reference this stage writes
 *   into both task definitions is `<registry>/<repository>@sha256:…`, read out
 *   of the Build stage's `image-digest.txt`. There is no tag anywhere in this
 *   file and `$CODEBUILD_RESOLVED_SOURCE_VERSION` is not read: a commit sha
 *   names a commit, not bytes, and the Build stage already resolved the digest
 *   FROM THE REGISTRY rather than from its local daemon."*
 *
 * **WHAT IS TRUE NOW.** This stage writes a COMMIT TAG, into CloudFormation's
 * own template, because the stack's idea of the image can only live in the
 * template and a digest there would make `cdk diff` permanently dirty. **The
 * digest did not go away — it became the thing the tag is CHECKED AGAINST.**
 * Before any tag is written, this stage asks the REGISTRY whether that tag
 * resolves to the digest the Build stage produced, and refuses if it does not.
 * *"A commit sha names a commit, not bytes"* is answered by making the registry
 * say so at the moment of use, rather than by assuming ECR immutability holds.
 * Read `RETAG_PLANES_TEMPLATE_JS`'s block above for the four shapes considered
 * and the three refused.
 *
 * ✅ **THE FRONTEND HALF IS BUILT — G993, 20 Sep 2026 — AND THE PARAGRAPH THAT
 * STOOD HERE IS QUOTED RATHER THAN DELETED**, because it is the sentence
 * `infra/lib/pipeline-stack.ts`'s header, `infra/lib/edge-stack.ts` and
 * `docs/build/deploy-handoff.md` §5.4 all rest on, and because its reasoning is
 * the reason this landed now and not earlier:
 *
 *   *"🛑 WHAT THIS STAGE DOES NOT DO, NAMED SO IT IS A KNOWN GAP. §9.1 stage 5
 *   is also "S3 sync + CloudFront invalidation" for the frontend bundle the
 *   Build stage produces. The bucket and the distribution are the `Edge` stack
 *   (G255 as amended by G277), which nobody is building today and which G277
 *   leaves genuinely undecided — "the consoles have no host at all". Syncing to
 *   an invented bucket name would be a stage that deploys and serves nothing.
 *   The bundle is still BUILT and still carried in the Build stage's artefact,
 *   so the day `Edge` lands this stage gains two commands and no new input."*
 *
 * **`Edge` landed on 19 Sep 2026 (G293, G297) and the blocker it names is
 * gone**: the bucket is not invented, it is `frontendBucketName()`, spelled
 * once in `config.ts` and read by the stack that creates it and by the stage
 * that fills it. **The prediction was right about the input and wrong about the
 * count** — no new input, and it is not two commands: the two that matter are
 * wrapped in a refusal that an empty artefact does not empty the live bucket,
 * and a wait that an invalidation actually completed.
 *
 * 🛑 THE FRONTEND GOES LAST, AFTER BOTH PLANES ARE STABLE, AND THE ORDER IS THE
 * SAME ARGUMENT `Migrate` MAKES IN FRONT OF `Deploy`. The bundle calls the API
 * it was built against; publishing it first would put a new client in front of
 * the old server for the length of two ECS rollouts. If a plane fails to
 * settle, the stage has already failed and the bundle is never published —
 * which is the direction that leaves the site working.
 *
 * ✅ **AND SINCE 28 Sep 2026 THAT ARGUMENT IS FOLLOWED ONE STEP FURTHER
 * (G2221): the frontend is a SEPARATE ACTION, exactly as `Migrate` is a
 * separate STAGE for the same reason.** The paragraph above is kept whole
 * because it is still the whole of WHY — and the mechanism named in its last
 * sentence is now CodePipeline's `runOrder` rather than `set -eu`, which
 * cannot be rearranged by an edit to a command list. The two paragraphs below
 * describe `PUBLISH_SITE_BUILDSPEC_YAML` and are kept HERE, where the argument
 * for them was made, rather than split from it.
 *
 * ⚠️ AND ONE THING IT STILL DOES NOT DO, SO IT IS A GAP AND NOT AN OVERSIGHT:
 * **there is no rollback of the bundle.** `--delete` makes the bucket match the
 * artefact, so the previous bundle is gone rather than superseded. Re-running
 * the pipeline on the previous commit restores it; a versioned bucket or a
 * prefix-per-commit is a ruling nobody has taken, and inventing one here would
 * be a retention decision made by a buildspec.
 *
 * ⚠️ AND IT IS NOT `cdk deploy`, WHICH IS WHAT §9.1 SAYS. The divergence is
 * deliberate and is the NARROWER of the two: a `cdk deploy` of the `Planes`
 * stack from inside the pipeline would put this role in a position to change
 * networking, security groups and databases on every merge to `main`, which is
 * the opposite of G263's *"the pipeline role may … run its own task definitions
 * and … nothing else"*. `update-service` touches exactly the thing the Build
 * stage produced. The `DeployRole` CloudFormation fence is deliberately left
 * unassumed for the day an `Edge` action needs a real `cdk deploy`.
 */
export const DEPLOY_BUILDSPEC_YAML = `version: 0.2

# STAGE 5 OF 5. Reached only after stage 4's two migrations have each exited 0.
#
# G257: staging auto-deploys. THERE IS NO MANUAL APPROVAL ACTION BEFORE THIS
# STAGE AND ITS ABSENCE IS THE RULING, NOT AN OVERSIGHT — the owner ruled it
# explicitly. Prod promotion is a SECOND pipeline that does not exist; see
# PROD_PROMOTION_PIPELINE_TODO in infra/lib/pipeline-stack.ts.
#
# G108 IS NOT AMENDED BY THIS STAGE EITHER. DO NOT ADD A STEP TO THE GATE.
#
# ⚠️ The  test -n  guards are read by tests/infra/pipeline.test.mjs and the
#    project that runs this file must set every name they mention.
phases:
  pre_build:
    commands:
      - |
        set -eu
        test -n "$PLANE_REPOSITORY_NAME"
        test -n "$ECS_CLUSTER_NAME"
        test -n "$CONTROL_SERVICE_NAME"
        test -n "$DATA_SERVICE_NAME"
        test -n "$CONTROL_SERVICE_TASK_FAMILY"
        test -n "$DATA_SERVICE_TASK_FAMILY"
        test -n "$PLANES_STACK_NAME"
        test -n "$STACK_UPDATE_WAIT_ROUNDS"
        test -n "$ROLLOUT_POLL_ROUNDS"
      - |
        set -eu
        test -s "$CODEBUILD_SRC_DIR/image-digest.txt"
        DIGEST="$(tr -d " \\n" < "$CODEBUILD_SRC_DIR/image-digest.txt")"
        case "$DIGEST" in
          sha256:*) ;;
          *) echo "FATAL: image-digest.txt does not hold a sha256 digest: $DIGEST" >&2; exit 1 ;;
        esac
        echo "$DIGEST" > digest.txt

        # ── G2041 · THE TAG, AND THE ONE CHECK THAT LETS THIS STAGE WRITE ONE ─
        #
        # G262's sentence is "a commit sha names a commit, not bytes". This
        # stage must write a TAG into CloudFormation's template — a digest there
        # would make every later cdk diff dirty for ever — so it does not
        # ASSUME the sha names the bytes, it makes the REGISTRY say so, here,
        # one second in, before anything has been touched.
        #
        # ⚠️ NOT AN IMMUTABILITY ARGUMENT. ECR immutability refuses to MOVE a
        # tag; it does not refuse to delete one and push it again, and the
        # lifecycle rule on this repository deletes images by design (it keeps
        # the fifty most recent). So the mapping is re-established rather than
        # inherited.
        test -s "$CODEBUILD_SRC_DIR/image-tag.txt"
        TAG="$(tr -d " \\n" < "$CODEBUILD_SRC_DIR/image-tag.txt")"
        case "$TAG" in
          [0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]) ;;
          *) echo "FATAL: image-tag.txt does not hold a 40-hex commit sha: $TAG" >&2; exit 1 ;;
        esac
        TAGGED_DIGEST="$(aws ecr describe-images --region "$AWS_REGION" --repository-name "$PLANE_REPOSITORY_NAME" --image-ids imageTag="$TAG" --query 'imageDetails[0].imageDigest' --output text)"
        if [ "$TAGGED_DIGEST" != "$DIGEST" ]; then
          echo "FATAL: the registry says tag $TAG is $TAGGED_DIGEST and the Build stage produced $DIGEST." >&2
          echo "       This stage writes the TAG into CloudFormation's template, so it refuses to write" >&2
          echo "       one the registry does not resolve to the bytes that were just built and migrated." >&2
          exit 1
        fi
        echo "$TAG" > tag.txt
        echo "deploy: tag $TAG resolves to $DIGEST in $PLANE_REPOSITORY_NAME"
  build:
    commands:
      # ── 1 · REFUSE A FLEET THERE IS NOTHING TO DEPLOY ONTO ─────────────────
      #
      # BEFORE CLOUDFORMATION IS TOUCHED, AND FOR BOTH PLANES. A service scaled
      # to zero by the cost schedule makes every control after this point
      # vacuous - services-stable returns immediately, the circuit breaker
      # cannot trip because nothing starts, and the ALB health check never runs.
      # Read CIRCUIT_BREAKER_REQUIRED_JS's block; the first real deploy found
      # this and only luck made it fail.
      - |
        set -eu
        precheck_plane() {
          LABEL="$1"
          SERVICE="$2"
          echo "=== precheck $LABEL ($SERVICE) ==="
          aws ecs describe-services --region "$AWS_REGION" --cluster "$ECS_CLUSTER_NAME" --services "$SERVICE" --output json > service.json
          node -e '${CIRCUIT_BREAKER_REQUIRED_JS}'
        }

        precheck_plane control "$CONTROL_SERVICE_NAME"
        precheck_plane data "$DATA_SERVICE_NAME"

      # ── 2 · WRITE THE STACK VALUE (G2041, THE OWNER'S RULING) ──────────────
      #
      # 🛑 THIS IS THE DEPLOY. There is no ecs update-service anywhere in this
      #    file any more, and that is the point rather than a simplification:
      #    registering a task definition out of band is what left the STACK two
      #    days behind the FLEET after every run, and a stack that disagrees
      #    with its fleet rolls both planes backwards the next time anybody
      #    deploys it. CloudFormation registers the revision and moves the
      #    services, so the two cannot come apart.
      #
      # 🛑 NARROW BY CONSTRUCTION, NOT BY CARE. The template written back is
      #    CLOUDFORMATION'S OWN, fetched one command earlier and mutated at
      #    nothing but the image tag - so a planes-stack.ts change somebody
      #    merged does NOT ship here, and this stage cannot change networking,
      #    a security group or a database however badly it is edited. The
      #    mutation PROVES that: it re-serialises both templates with every
      #    container image blanked and refuses if they differ anywhere else.
      #
      # ⚠️ IT DOES NOT CANCEL AN UPDATE IT GAVE UP WAITING FOR, for the reason
      #    the Migrate stage does not kill a migration: a cancel-update-stack
      #    starts a rollback nobody watched begin. The stage fails and prints
      #    the stack name.
      - |
        set -eu
        TAG="$(cat tag.txt)"

        aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$PLANES_STACK_NAME" --output json > stack-describe.json
        node -e '${STACK_READY_TO_UPDATE_JS}'

        aws cloudformation get-template --region "$AWS_REGION" --stack-name "$PLANES_STACK_NAME" --template-stage Original --query TemplateBody --output json > template-current.json
        test -s template-current.json
        TAG="$TAG" REPOSITORY="$PLANE_REPOSITORY_NAME" node -e '${RETAG_PLANES_TEMPLATE_JS}'
        test -s template-next.json

        # A re-run on an unchanged commit is SUCCESS, not a conflict - the same
        # reading the Build stage gives a tag already in an immutable registry.
        # CloudFormation says so with an error, so the error is read rather than
        # the exit status: every OTHER failure here must still stop the stage.
        set +e
        aws cloudformation update-stack --region "$AWS_REGION" --stack-name "$PLANES_STACK_NAME" --template-body file://template-next.json --parameters file://parameters.json --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND > update.out 2> update.err
        UPDATE_STATUS=$?
        set -e
        NEEDS_WAIT=yes
        if [ "$UPDATE_STATUS" -ne 0 ]; then
          if grep -q "No updates are to be performed" update.err; then
            echo "the stack already carries $TAG; CloudFormation has nothing to update. This is a re-run, not a conflict."
            NEEDS_WAIT=no
          else
            cat update.err >&2
            echo "FATAL: update-stack on $PLANES_STACK_NAME exited $UPDATE_STATUS. NOTHING HAS BEEN DEPLOYED - the fleet is still running whatever it was running before this stage began." >&2
            echo "       If the message names iam:PassRole, read G2048: this stage passes NO --role-arn and relies on CloudFormation reusing the role already associated with the stack, which is the one premise here nobody has witnessed." >&2
            exit 1
          fi
        else
          cat update.out
        fi

        # The CLI's own waiter is 30s x 120 attempts - sixty minutes - and it
        # FAILS on UPDATE_ROLLBACK_COMPLETE, UPDATE_FAILED and
        # UPDATE_ROLLBACK_FAILED. So a circuit-breaker trip inside the update
        # reaches this stage as a red stage rather than as a green deploy of
        # rolled-back code, which is what ecs wait services-stable could
        # never do (it succeeds AFTER a rollback; read ROLLOUT_VERDICT_JS).
        if [ "$NEEDS_WAIT" = "yes" ]; then
          ROUND=0
          while :; do
            ROUND=$((ROUND + 1))
            if aws cloudformation wait stack-update-complete --region "$AWS_REGION" --stack-name "$PLANES_STACK_NAME"; then
              break
            fi
            STATUS="$(aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$PLANES_STACK_NAME" --query 'Stacks[0].StackStatus' --output text)"
            case "$STATUS" in
              UPDATE_IN_PROGRESS|UPDATE_COMPLETE_CLEANUP_IN_PROGRESS) ;;
              *)
                echo "FATAL: $PLANES_STACK_NAME is $STATUS. The update did not succeed." >&2
                echo "       A rollback here is the deployment circuit breaker doing what G261 asks of it; read the stack events." >&2
                # JMESPath compares against a RAW STRING LITERAL in single
                # quotes here, never a JSON literal in backticks: a backtick
                # inside this template literal ENDS IT, which is a property of
                # this file rather than a style rule, and
                # tests/infra/manifest.test.mjs fails the gate on one.
                aws cloudformation describe-stack-events --region "$AWS_REGION" --stack-name "$PLANES_STACK_NAME" --max-items 25 --query "StackEvents[?ResourceStatus=='UPDATE_FAILED'].[LogicalResourceId,ResourceStatusReason]" --output text >&2 || true
                exit 1 ;;
            esac
            if [ "$ROUND" -ge "$STACK_UPDATE_WAIT_ROUNDS" ]; then
              echo "FATAL: $PLANES_STACK_NAME is still $STATUS after $ROUND waiter rounds." >&2
              echo "       It has NOT been cancelled: cancel-update-stack starts a rollback nobody watched begin. Look at the stack." >&2
              exit 1
            fi
            echo "stack update: still $STATUS after round $ROUND; waiting again"
          done
        fi
        echo "=== $PLANES_STACK_NAME now carries $TAG ==="

      # ── 3 · SETTLE, AND ASSERT THE THING THIS SLICE EXISTS TO CREATE ───────
      #
      # 🛑 ROLLOUT_VERDICT_JS IS UNCHANGED AND ITS WANT_TASK_DEFINITION NOW
      #    COMES FROM THE STACK. Its two comparisons used to ask only *did the
      #    circuit breaker roll us back*; given the revision CLOUDFORMATION
      #    OWNS they ask that AND *does the stack agree with the fleet* - which
      #    is the exact question tests/e2e/probe-deployed-image.mjs asks from
      #    outside, arriving inside the stage that has to make it true. One
      #    script, one more meaning, and no second opinion about what deployed
      #    means. G1304's two-comparison hedge survives untouched.
      - |
        set -eu
        aws cloudformation describe-stack-resources --region "$AWS_REGION" --stack-name "$PLANES_STACK_NAME" --output json > stack-resources.json

        settle_plane() {
          LABEL="$1"
          FAMILY="$2"
          SERVICE="$3"
          echo "=== settle $LABEL ($SERVICE) ==="

          FAMILY="$FAMILY" node -e '${STACK_OWNED_TASK_DEFINITION_JS}'
          TD_ARN="$(cat owned-task-definition.txt)"
          test -n "$TD_ARN"

          # W0-b - THE ROLLOUT IS POLLED, NOT SAMPLED. AWS documents
          # rolloutState as reaching COMPLETED AFTER steady state, so one
          # describe-services at the wrong instant reads IN_PROGRESS and aborts
          # a deploy that worked. That happened: execution 235be2b3. The
          # verdict is three-valued - 0 done, 1 fatal, 75 retry - and ONLY 75
          # is polled at. Every other non-zero code leaves this stage at once
          # with the verdict's own message.
          ROLLOUT_POLL_SLEEP_SECONDS=15
          ROLLOUT_POLL=0
          while :; do
            ROLLOUT_POLL=$((ROLLOUT_POLL + 1))
            aws ecs describe-services --region "$AWS_REGION" --cluster "$ECS_CLUSTER_NAME" --services "$SERVICE" --output json > service-after.json
            VERDICT=0
            WANT_TASK_DEFINITION="$TD_ARN" node -e '${ROLLOUT_VERDICT_JS}' || VERDICT=$?
            if [ "$VERDICT" -eq 0 ]; then
              break
            fi
            if [ "$VERDICT" -ne 75 ]; then
              exit "$VERDICT"
            fi
            if [ "$ROLLOUT_POLL" -ge "$ROLLOUT_POLL_ROUNDS" ]; then
              echo "FATAL: $SERVICE reached a steady state but its primary deployment was still IN_PROGRESS after $ROLLOUT_POLL polls at $ROLLOUT_POLL_SLEEP_SECONDS seconds. rolloutState is not going to arrive; look at the service." >&2
              exit 1
            fi
            echo "settle $LABEL: rollout not settled after poll $ROLLOUT_POLL; asking again"
            sleep "$ROLLOUT_POLL_SLEEP_SECONDS"
          done

          echo "=== settle $LABEL: on the revision CloudFormation owns ==="
        }

        settle_plane control "$CONTROL_SERVICE_TASK_FAMILY" "$CONTROL_SERVICE_NAME"
        settle_plane data "$DATA_SERVICE_TASK_FAMILY" "$DATA_SERVICE_NAME"
        echo "both planes are running the image the stack owns; probe-deployed-image.mjs will say AGREE"
`

/**
 * STAGE 5's SECOND ACTION — PUBLISH THE SITE. G993's frontend half, moved out
 * of `DEPLOY_BUILDSPEC_YAML` into its own project on 28 Sep 2026 under G2221.
 *
 * ⚠️ **THE MOVE IS NOT A REORGANISATION AND THE SENTENCES BELOW ARE THE ONES
 * THAT CHANGED MEANING, SO THEY ARE CORRECTED IN PLACE RATHER THAN CARRIED
 * OVER UNREAD.** G993 put this beside the planes deploy and argued the ORDER in
 * a comment: *"A plane that fails to settle has already failed this stage and
 * the bundle is never published."* That was true of a shell that ran top to
 * bottom under `set -eu`. It is now true of CODEPIPELINE, which is strictly
 * stronger: this is a SEPARATE ACTION at `runOrder: 2` in the same Deploy
 * stage, so the ordering is a property of the pipeline rather than of a
 * sequence somebody could reorder, and a failed `UpdateServices` means this
 * action is never started at all.
 *
 * 🛑 **WHY IT MOVED, AND IT IS NOT TIDINESS: CODEBUILD REFUSES AN INLINE
 * BUILDSPEC OVER `CODEBUILD_INLINE_BUILDSPEC_BYTES`, AND G2041 TOOK THE DEPLOY
 * STAGE PAST IT.** The stage synthesised **28,180** characters against a
 * ceiling of **25,600**, `cdk synth` rendered it happily, `npm run check` was
 * EXIT 0, and the first thing that noticed was `UpdateProject` — which said so
 * by rolling `reconcile-pipeline-staging` back. Read the ceiling's own block
 * below for the measurement and for the three shapes that were refused.
 *
 * ✅ **AND THE SEAM IS THE ONE THIS FILE ALREADY DREW.** G993 wrote *"THE
 * FRONTEND GOES LAST, AFTER BOTH PLANES ARE STABLE, AND THE ORDER IS THE SAME
 * ARGUMENT `Migrate` MAKES IN FRONT OF `Deploy`"* — and `Migrate` is a separate
 * STAGE for exactly that reason. This is that argument followed one step
 * further, not a new one invented to fit a byte count.
 *
 * 🛑 **THE IAM IS THE REAL DIVIDEND (G2223).** G263: *"the pipeline role may
 * push to its own ECR repositories, run its own task definitions and deploy
 * stacks tagged `Project=reconcile` — and nothing else in a SHARED account."*
 * One project doing both halves needed `cloudformation:UpdateStack` on the
 * `Planes` stack **and** `s3:DeleteObject` on the site bucket **and**
 * `cloudfront:CreateInvalidation`, in one role, for the whole ninety minutes.
 * They are now two roles that cannot reach each other's verbs: the thing that
 * can empty the site bucket cannot touch CloudFormation, and the thing that
 * writes the stack value holds no S3 write at all.
 *
 * ⚠️ **ITS INPUT IS THE BUILD ARTEFACT, THE SAME ONE — not the source tree.**
 * `frontend/dist/**` travels in it already; the artefact declaration is
 * untouched by this split and `tests/infra/pipeline.test.mjs` §6 still reads it
 * out of the Build stage's buildspec.
 */
export const PUBLISH_SITE_BUILDSPEC_YAML = `version: 0.2

# STAGE 5 OF 5, SECOND ACTION. Reached only after UpdateServices has settled
# BOTH planes on the revision CloudFormation owns.
#
# G108 IS NOT AMENDED BY THIS PROJECT EITHER. DO NOT ADD A STEP TO THE GATE.
#
# ⚠️ The  test -n  guards are read by tests/infra/pipeline.test.mjs and the
#    project that runs this file must set every name they mention.
phases:
  pre_build:
    commands:
      - |
        set -eu
        test -n "$FRONTEND_BUCKET_NAME"
        test -n "$TENANT_DISTRIBUTION_ID"
        test -n "$CONSOLE_DISTRIBUTION_ID"
  build:
    commands:
      # ── THE FRONTEND HALF (G993) ───────────────────────────────────────────
      #
      # LAST, AND DELIBERATELY. The bundle calls the API it was built against,
      # so publishing it before the planes have settled puts a new client in
      # front of an old server.
      #
      # ⚠️ THIS READ "A plane that fails to settle has already failed this stage
      #    and the bundle is never published, which is the direction that leaves
      #    the site working" WHEN THIS BLOCK LIVED IN THE DEPLOY BUILDSPEC, AND
      #    IT IS CORRECTED RATHER THAN DELETED BECAUSE THE PROPERTY SURVIVED THE
      #    MOVE AND GOT STRONGER (G2221). It was a claim about  set -eu  in one
      #    shell; it is now a claim about CODEPIPELINE. This is a separate
      #    ACTION at runOrder 2, so a plane that fails to settle fails the
      #    UpdateServices action and CodePipeline NEVER STARTS this one - the
      #    same direction, held by the pipeline rather than by a command order
      #    somebody could rearrange.
      #
      # 🛑 EVERY VARIABLE IS SPELLED IN THE SAME BLOCK IT IS USED IN. CODEBUILD
      #    RUNS EACH PHASE IN A SEPARATE SHELL (deploy-handoff section 3, trap
      #    4) - an export in pre_build does not reach here, and the Build
      #    stage's IMAGE_TAG bug is what that trap is made of. Nothing below is
      #    exported and nothing below is piped: a pipeline reports the LAST
      #    command's status, which is trap 8 and cost this repository the one
      #    command that mattered.
      #
      # ⚠️ AND THAT TRAP IS WHY THE GUARDS ABOVE ARE REPEATED HERE RATHER THAN
      #    INHERITED: this is a DIFFERENT CONTAINER from the one that deployed
      #    the planes, so nothing the Deploy action computed is on this disk.
      - |
        set -eu
        BUNDLE="$CODEBUILD_SRC_DIR/frontend/dist"

        # 1 - REFUSE AN ARTEFACT THAT CANNOT BE THE SITE, BEFORE --delete RUNS.
        #     An empty or absent directory synced with --delete removes every
        #     object the site is served from, and exits 0 doing it.
        BUNDLE_DIR="$BUNDLE" node -e '${BUNDLE_IS_PRESENT_JS}'

        # 2 - PUBLISH. --delete is what makes the bucket the bundle rather than
        #     the union of every bundle ever deployed: a stale hashed asset
        #     served beside a new index.html is the failure it prevents.
        aws s3 sync "$BUNDLE" "s3://$FRONTEND_BUCKET_NAME/" --delete --no-progress

        # 3 - INVALIDATE BOTH DISTRIBUTIONS. G297 split the edge in two and BOTH
        #     serve THIS bucket. Invalidating only the tenant one leaves
        #     console. and partners. on the previous index.html, which names
        #     hashed assets step 2 has just deleted.
        invalidate() {
          LABEL="$1"
          DISTRIBUTION="$2"
          echo "=== invalidate $LABEL ($DISTRIBUTION) ==="
          aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" --paths "/*" --output json > invalidation.json
          node -e '${INVALIDATION_STARTED_JS}'
          INVALIDATION_ID="$(cat invalidation-id.txt)"
          # The CLI's own waiter. An invalidation that is still InProgress when
          # this stage ends is a green deploy of a site still serving the old
          # page, which is the same shape as ecs wait succeeding after a
          # rollback one function up.
          aws cloudfront wait invalidation-completed --distribution-id "$DISTRIBUTION" --id "$INVALIDATION_ID"
          echo "=== invalidate $LABEL: $INVALIDATION_ID completed ==="
        }

        invalidate tenant "$TENANT_DISTRIBUTION_ID"
        invalidate console "$CONSOLE_DISTRIBUTION_ID"
        echo "the bundle is published to $FRONTEND_BUCKET_NAME and both distributions are invalidated"
`

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 G2301 — SCALE UP IN DEPLOY. **THE OWNER'S RULING, 1 Oct 2026: *"Scale up
 *    in Deploy — the Deploy stage raises desiredCount to the 'up' value before
 *    rolling out, and the next scheduled scale-down returns it to 0."***
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **THE DEFECT, MEASURED 30 Sep – 1 Oct 2026** (`docs/build/deploy-handoff.md`
 * §19): `ControlPlaneEveningDown` / `DataPlaneEveningDown` take both services to
 * min 0 / max 0 at 21:00 +08, so **a merge to `main` between 21:00 and 09:00
 * builds, migrates, and then FAILS at Deploy** — correctly, on
 * `CIRCUIT_BREAKER_REQUIRED_JS`'s zero refusal. The pipeline was unusable for
 * twelve hours a day and said so only in a FATAL line.
 *
 * 🛑 **THE PROPERTY THIS MUST NOT SPEND IS THE ONE THAT REFUSAL HOLDS: A DEPLOY
 * NEVER REPORTS GREEN ONTO ZERO TASKS.** `ecs wait services-stable` returns
 * immediately against a service at zero, so a wake that waited on it would be
 * the vacuous green that refusal exists to prevent, moved one action earlier.
 * **This action therefore never calls `services-stable` at all**: it polls
 * `runningCount` itself and refuses to finish until the RUNNING tasks equal the
 * desired count and the desired count is at least one. And the refusal it would
 * otherwise replace is KEPT, unchanged, in `UpdateServices` — the two are each
 * sufficient and neither is necessary, which is G1304's shape (G2302).
 *
 * ⚠️ **IT IS ITS OWN ACTION, AT `runOrder: 1`, AND NOT A BLOCK IN
 * `DEPLOY_BUILDSPEC_YAML`, FOR TWO REASONS AND THE SECOND IS THE ONE THAT
 * MATTERS (G2303).** (1) The Deploy buildspec sits at ~92% of
 * `CODEBUILD_INLINE_BUILDSPEC_BYTES` and this block alone would break it.
 * (2) **The verb it needs is `ecs:UpdateService`, and G2046 took exactly that
 * verb AWAY from the Deploy role** — *"a stage that could still call
 * `UpdateService` could put the fleet back out of step with the stack by
 * hand."* A separate role is how this ruling is honoured WITHOUT reinstating
 * that: the wake role may set a DESIRED COUNT on two named services and holds
 * no CloudFormation verb at all, and the Deploy role still holds no ECS write.
 * `tests/infra/pipeline.test.mjs` asserts both directions.
 *
 * 🛑 **THE MECHANISM IS TWO WRITES, IN THIS ORDER, AND THE ORDER IS THE
 * CLAMP.** First `register-scalable-target` with min = max = the up value —
 * exactly what `…MorningUp` writes every weekday at 09:00 +08, which is the one
 * path in this account MEASURED to bring the fleet back. Then `update-service
 * --desired-count` to the same value. The first moves the BOUNDS the scheduled
 * scale-down set to 0/0, so the second cannot land outside them; the second
 * exists because **whether Application Auto Scaling raises the desired count
 * on its own when only `RegisterScalableTarget` is called is UNMEASURED** — the
 * documentation says scheduled actions do, and nobody here has watched the API
 * call do it. An explicit desired count inside the bounds asks nothing of it.
 * ⚠️ **AND IT IS NOT A NEW DRIFT**: daytime state is already min = max = up
 * (that is what MorningUp writes, against a template saying min 0 / max up),
 * so this writes the state the schedule itself writes and the next
 * `…EveningDown` puts back.
 *
 * 🛑 **THE UP VALUE IS `SERVING_TASKS_WHEN_UP`, AND IT IS CROSS-CHECKED AT RUN
 * TIME AGAINST THE DEPLOYED SCHEDULE RATHER THAN TRUSTED (G2305).**
 * ⚠️ **AND IT IS PER PLANE — G2461, the integration of G2301 with R-POOL.**
 * R-POOL made `SERVING_TASKS_WHEN_UP[env]` a `{ data, control }` record
 * (staging `{ data: 2, control: 1 }`) on a concurrent branch, so this project
 * carries TWO values, `WAKE_DESIRED_COUNT_DATA` and `…_CONTROL`, and the plan
 * script is handed the one for the plane it is judging. **One shared number
 * would have refused the data plane's `…MorningUp` (2) or the control plane's
 * (1) on every run** — and as first merged, `String()` of the record put
 * `[object Object]` in the variable. **Read the rest of this paragraph as
 * applying per service.** Measured
 * from the synthesised `Planes` template: the stack OWNS `DesiredCount` on both
 * services (`DesiredCount` 2 data · 1 control in staging since R-POOL), and G2041's `UpdateStack` updates those
 * services — so **CloudFormation sends the template's `DesiredCount` whenever
 * it updates one.** If this action raised to a value the deployed `Planes`
 * stack does not carry, `UpdateServices` would silently reset it.
 * `planes-stack.ts` builds the MorningUp action's MinCapacity from the same
 * number it puts in `DesiredCount`, so the plan script reads the DEPLOYED
 * MorningUp action and **refuses if it disagrees with this project's up
 * value** — the signature of the pipeline and Planes stacks having been
 * deployed from different trees, which is a person's problem rather than a
 * guess.
 *
 * ⚠️ **WHAT IT COSTS, NAMED: a deploy at night leaves the fleet UP until the
 * next `…EveningDown`.** That is up to a day on a weekday — and from a FRIDAY
 * night merge until MONDAY 21:00 +08, because the schedule is `MON-FRI`. The
 * ruling accepts exactly that sentence: *"the next scheduled scale-down
 * returns it to 0."* Nothing here scales the fleet back down.
 *
 * ⚠️ **AND ONE RACE IS NARROWED RATHER THAN CLOSED, ON PURPOSE.** A wake at
 * 20:59 +08 can be followed by `…EveningDown` at 21:00 while `UpdateServices`
 * is mid-flight. No ordering here can stop a scheduled action. What stops it
 * reporting GREEN is `ROLLOUT_VERDICT_JS`'s running-task arm (G2304): a rollout
 * that COMPLETES onto a desired count of zero is FATAL, so the race ends red.
 */

/**
 * Decide, for one plane, whether there is anything to raise — and refuse the
 * one disagreement that would make raising it pointless.
 *
 * Exit 0 with `plan.txt` = `raise` or `awake`, and `has-target.txt` = `yes` or
 * `no`; exit 1 on anything it cannot read. **A service with no scalable target
 * is still raised**, by `update-service` alone: nothing schedules it, so there
 * are no bounds to move, and a fleet a PERSON scaled to zero is still a fleet
 * there is nothing to deploy onto. ⚠️ **It never REGISTERS a target that does
 * not exist** — that would mint a resource CloudFormation does not own.
 */
const WAKE_PLAN_JS =
  'const fs=require("fs");' +
  'const want=Number(process.env.WAKE_DESIRED_COUNT);' +
  'if(!Number.isInteger(want)||want<1){console.error("FATAL: WAKE_DESIRED_COUNT is "+process.env.WAKE_DESIRED_COUNT+". Waking a fleet to fewer than one task is waking it to nothing, which is the deploy-onto-zero this action exists to prevent.");process.exit(1)}' +
  'const s=(JSON.parse(fs.readFileSync("service.json","utf8")).services||[])[0];' +
  'if(!s){console.error("FATAL: describe-services returned no service");process.exit(1)}' +
  'if(typeof s.desiredCount!=="number"){console.error("FATAL: "+s.serviceName+" carries no numeric desiredCount");process.exit(1)}' +
  'const targets=JSON.parse(fs.readFileSync("targets.json","utf8")).ScalableTargets||[];' +
  'if(targets.length>1){console.error("FATAL: "+targets.length+" scalable targets for "+s.serviceName+"; at most one can exist for one dimension.");process.exit(1)}' +
  'const ups=(JSON.parse(fs.readFileSync("actions.json","utf8")).ScheduledActions||[]).filter(a=>((a.ScalableTargetAction||{}).MinCapacity||0)>0);' +
  'for(const a of ups){if(a.ScalableTargetAction.MinCapacity!==want){console.error("FATAL: "+s.serviceName+" is scheduled UP to "+a.ScalableTargetAction.MinCapacity+" by "+a.ScheduledActionName+" and this pipeline would raise it to "+want+". The deployed Planes stack builds both its DesiredCount and that action from one number, and UpdateStack sends DesiredCount when it updates the service, so the action after this one would silently undo this raise. The pipeline and Planes stacks were deployed from different trees; deploy them from one.");process.exit(1)}}' +
  'fs.writeFileSync("has-target.txt",targets.length===1?"yes":"no");' +
  'const plan=s.desiredCount>=want?"awake":"raise";' +
  'fs.writeFileSync("plan.txt",plan);' +
  'console.log(s.serviceName+": desiredCount="+s.desiredCount+" runningCount="+s.runningCount+" up="+want+" scalableTarget="+(targets.length===1?"yes":"no")+" scheduledUp="+ups.length+" -> "+plan)'

/**
 * Is there SOMETHING RUNNING to deploy onto yet? Three-valued, exactly as
 * `ROLLOUT_VERDICT_JS` is, and polled by the shell on 75 alone.
 *
 * 🛑 **IT READS `runningCount` AND NEVER TRUSTS A WAITER**, because the waiter
 * is what goes vacuous at zero. Zero desired is FATAL rather than a retry: it
 * means something scaled the fleet back down AFTER this action raised it — the
 * scheduled `…EveningDown`, or a person — and polling at it would report a
 * timeout for a fact.
 */
const FLEET_AWAKE_VERDICT_JS =
  'const fs=require("fs");' +
  'const s=(JSON.parse(fs.readFileSync("service-awake.json","utf8")).services||[])[0];' +
  'if(!s){console.error("FATAL: describe-services returned no service");process.exit(1)}' +
  'for(const k of ["desiredCount","runningCount","pendingCount"])if(typeof s[k]!=="number"){console.error("FATAL: "+s.serviceName+" carries no numeric "+k+". A count that is absent is not a count of zero, and a verdict about running tasks cannot be made without it.");process.exit(1)}' +
  'console.log(s.serviceName+": desired="+s.desiredCount+" running="+s.runningCount+" pending="+s.pendingCount);' +
  'if(s.desiredCount<1){console.error("FATAL: "+s.serviceName+" is at desiredCount "+s.desiredCount+" AFTER this action raised it. The scheduled scale-down fired, or a person scaled it, while the fleet was waking. There is nothing to deploy onto and this stage will not pretend otherwise.");process.exit(1)}' +
  'if(s.runningCount===s.desiredCount&&s.pendingCount===0){console.log(s.serviceName+": "+s.runningCount+" task(s) RUNNING");process.exit(0)}' +
  'process.exit(75)'

/**
 * STAGE 5, FIRST ACTION — WAKE THE FLEET. G2301, the owner's ruling. Read the
 * block above `WAKE_PLAN_JS` before changing anything here.
 */
export const WAKE_FLEET_BUILDSPEC_YAML = `version: 0.2

# STAGE 5 OF 5, FIRST ACTION. G2301, THE OWNER'S RULING (1 Oct 2026):
# "Scale up in Deploy - the Deploy stage raises desiredCount to the up value
#  before rolling out, and the next scheduled scale-down returns it to 0."
#
# 🛑 THIS ACTION NEVER CALLS  ecs wait services-stable  AND MUST NOT START. That
#    waiter returns IMMEDIATELY against a service at zero, which is the vacuous
#    green UpdateServices' zero refusal exists to prevent. It polls runningCount
#    instead, and refuses to finish until tasks are RUNNING.
#
# ⚠️ IT DOES NOT SCALE ANYTHING BACK DOWN. A night deploy leaves the fleet up
#    until the next EveningDown - Monday, from a Friday-night merge. Accepted by
#    the ruling, in its own words.
#
# G108 IS NOT AMENDED BY THIS PROJECT EITHER. DO NOT ADD A STEP TO THE GATE.
#
# ⚠️ The  test -n  guards are read by tests/infra/pipeline.test.mjs and the
#    project that runs this file must set every name they mention.
phases:
  pre_build:
    commands:
      - |
        set -eu
        test -n "$ECS_CLUSTER_NAME"
        test -n "$CONTROL_SERVICE_NAME"
        test -n "$DATA_SERVICE_NAME"
        test -n "$WAKE_DESIRED_COUNT_CONTROL"
        test -n "$WAKE_DESIRED_COUNT_DATA"
        test -n "$WAKE_POLL_ROUNDS"
  build:
    commands:
      # Each phase is a separate shell (deploy-handoff section 3, trap 4), so
      # everything below is spelled in this one block and nothing is exported.
      - |
        set -eu
        # 1 - RAISE BOTH, THEN WAIT FOR BOTH. Bounds first, then the count:
        #     the bounds are what the EveningDown set to 0/0, and a desired
        #     count written outside them is one Application Auto Scaling may
        #     clamp. Raising both before waiting on either halves the cold
        #     start a sleeping fleet costs.
        wake_plane() {
          LABEL="$1"
          SERVICE="$2"
          WANT="$3"
          RESOURCE_ID="service/$ECS_CLUSTER_NAME/$SERVICE"
          echo "=== wake $LABEL ($SERVICE) ==="
          aws ecs describe-services --region "$AWS_REGION" --cluster "$ECS_CLUSTER_NAME" --services "$SERVICE" --output json > service.json
          aws application-autoscaling describe-scalable-targets --region "$AWS_REGION" --service-namespace ecs --resource-ids "$RESOURCE_ID" --output json > targets.json
          aws application-autoscaling describe-scheduled-actions --region "$AWS_REGION" --service-namespace ecs --resource-id "$RESOURCE_ID" --output json > actions.json
          WAKE_DESIRED_COUNT="$WANT" node -e '${WAKE_PLAN_JS}'
          if [ "$(cat plan.txt)" = "raise" ]; then
            if [ "$(cat has-target.txt)" = "yes" ]; then
              aws application-autoscaling register-scalable-target --region "$AWS_REGION" --service-namespace ecs --scalable-dimension ecs:service:DesiredCount --resource-id "$RESOURCE_ID" --min-capacity "$WANT" --max-capacity "$WANT"
            fi
            aws ecs update-service --region "$AWS_REGION" --cluster "$ECS_CLUSTER_NAME" --service "$SERVICE" --desired-count "$WANT" --output json > /dev/null
            echo "wake $LABEL: raised to $WANT; the next EveningDown returns it to 0"
          fi
        }

        # 2 - WAIT FOR RUNNING TASKS. 0 done, 1 fatal, 75 retry - and only 75
        #     is polled at, ROLLOUT_VERDICT_JS's contract one action over.
        await_plane() {
          LABEL="$1"
          SERVICE="$2"
          WAKE_POLL_SLEEP_SECONDS=15
          POLL=0
          while :; do
            POLL=$((POLL + 1))
            aws ecs describe-services --region "$AWS_REGION" --cluster "$ECS_CLUSTER_NAME" --services "$SERVICE" --output json > service-awake.json
            VERDICT=0
            node -e '${FLEET_AWAKE_VERDICT_JS}' || VERDICT=$?
            if [ "$VERDICT" -eq 0 ]; then
              break
            fi
            if [ "$VERDICT" -ne 75 ]; then
              exit "$VERDICT"
            fi
            if [ "$POLL" -ge "$WAKE_POLL_ROUNDS" ]; then
              echo "FATAL: $SERVICE has no settled RUNNING tasks after $POLL polls at $WAKE_POLL_SLEEP_SECONDS seconds. Nothing has been deployed; look at the service events." >&2
              exit 1
            fi
            sleep "$WAKE_POLL_SLEEP_SECONDS"
          done
          echo "=== wake $LABEL: running ==="
        }

        # Each plane is raised to ITS OWN up value (R-POOL made it per plane,
        # G2461): one shared number would refuse the data plane's MorningUp.
        wake_plane control "$CONTROL_SERVICE_NAME" "$WAKE_DESIRED_COUNT_CONTROL"
        wake_plane data "$DATA_SERVICE_NAME" "$WAKE_DESIRED_COUNT_DATA"
        await_plane control "$CONTROL_SERVICE_NAME"
        await_plane data "$DATA_SERVICE_NAME"
        echo "both planes have RUNNING tasks; UpdateServices may deploy onto them"
`

/**
 * Does this stack carry a CloudFormation SERVICE ROLE? — G2964.
 *
 * 🛑 **THE RETAG PASSES NO `--role-arn` AND HOLDS NO `iam:PassRole`, AND THAT
 * IS ONLY SAFE WHEN THE STACK ALREADY HAS A ROLE OF ITS OWN.** AWS documents
 * the reuse in as many words: once a stack has a service role, *"CloudFormation
 * always uses that role for all operations … Other users that have permissions
 * to perform operations on this stack will be able to use this role, even if
 * they don't have permission to pass it."* A stack WITHOUT one would run the
 * update as THIS project's own credentials, which hold no IAM, no ECS and no
 * Events write — so it would fail half-applied rather than cleanly. Refusing
 * up front costs one read and keeps the failure on the side where nothing has
 * moved. Every stack `cdk deploy` creates under this app's bootstrap carries
 * `cdk-reconcile-cfn-exec-role-…`, so this refusal names a stack somebody
 * deployed by some other route.
 */
const STACK_HAS_SERVICE_ROLE_JS =
  'const fs=require("fs");' +
  'const s=(JSON.parse(fs.readFileSync("stack-describe.json","utf8")).Stacks||[])[0];' +
  'if(!s||typeof s.RoleARN!=="string"||s.RoleARN.length===0){console.error("FATAL: "+(s&&s.StackName)+" carries no CloudFormation service role. This stage passes no --role-arn and holds no iam:PassRole, so the update would run as the CodeBuild role itself - which can write no IAM, ECS or Events resource - and fail half-applied. Deploy the stack once with cdk deploy (which associates the bootstrap exec role) and re-run.");process.exit(1)}' +
  'console.log(s.StackName+" updates as its own service role "+s.RoleARN+" (G2964)")'

/**
 * The worker's REGISTERED task definition runs the tag, and its SCHEDULE fires
 * that revision — G2965. The two facts the 2 Oct 2026 audit found false.
 *
 * 🛑 **IT READS THE REVISION ECS HOLDS, NOT THE TEMPLATE THIS STAGE WROTE.**
 * Asserting the template would prove a file equals itself. The audit's finding
 * was about the REGISTERED revision (`cc58f357` nine days behind the planes),
 * so that is what is asked: every container of the revision CloudFormation now
 * owns is `<this repository>:<TAG>`, and the rule's one ECS target names
 * exactly that revision — because a scheduled task that keeps firing the old
 * ARN is the same defect with a newer row beside it.
 */
const RUN_WORKER_SETTLED_JS =
  'const fs=require("fs");' +
  'const tag=process.env.TAG;const repository=process.env.REPOSITORY;' +
  'if(!/^[0-9a-f]{40}$/.test(tag||"")||!repository){console.error("FATAL: TAG or REPOSITORY is unset or malformed; there is nothing to compare against.");process.exit(1)}' +
  'const owned=fs.readFileSync("owned-task-definition.txt","utf8").trim();' +
  'const td=(JSON.parse(fs.readFileSync("task-definition.json","utf8")).taskDefinition)||{};' +
  'if(td.taskDefinitionArn!==owned){console.error("FATAL: asked ECS for "+owned+" and it described "+td.taskDefinitionArn+".");process.exit(1)}' +
  'const containers=td.containerDefinitions||[];' +
  'if(containers.length===0){console.error("FATAL: "+owned+" declares no containers, so it runs no image at all.");process.exit(1)}' +
  'const want="/"+repository+":"+tag;' +
  'for(const c of containers){if(typeof c.image!=="string"||!c.image.endsWith(want)){console.error("FATAL: "+owned+" container "+c.name+" runs ["+c.image+"] and this stage just wrote "+tag+". The stack update reported success and the registered revision disagrees; that is the 2 Oct 2026 finding (G2961) and this stage will not report green over it.");process.exit(1)}}' +
  'const targets=(JSON.parse(fs.readFileSync("targets.json","utf8")).Targets)||[];' +
  'const ecs=targets.filter((t)=>t.EcsParameters);' +
  'if(ecs.length!==1){console.error("FATAL: the worker schedule carries "+ecs.length+" ECS targets and exactly one must.");process.exit(1)}' +
  'if(ecs[0].EcsParameters.TaskDefinitionArn!==owned){console.error("FATAL: the worker schedule fires "+ecs[0].EcsParameters.TaskDefinitionArn+" and CloudFormation owns "+owned+". The next tick would run the OLD image.");process.exit(1)}' +
  'console.log("run worker: "+owned+" runs "+tag+" and its schedule fires it")'

/**
 * STAGE 5's RUN-WORKER ACTION — G2961. The same narrow retag G2041 applies to
 * `Planes`, applied to `RunQueue`'s ONE task definition.
 *
 * 🛑 **THE FINDING, DERIVED FROM A LIVE AUDIT ON 2 Oct 2026: THE RUN WORKER WAS
 * NINE DAYS BEHIND THE PLANES, BY CONSTRUCTION.** `RunQueue` bakes the plane
 * image tag into its template (`assertDeployablePlaneImageTag()`, read from
 * the same `planeImageTag` context `Planes` reads) — and G2041's Deploy stage
 * retagged `Planes` alone. So every merge moved both planes and left the
 * worker on whatever tag the last HAND `cdk deploy reconcile-run-queue-*`
 * carried: `cc58f357`, while the planes ran nine days of newer code. It is
 * G2041's own defect — *the STACK and the FLEET came apart* — one stack over,
 * where nothing was looking.
 *
 * ✅ **THE SHAPE IS G2041's AND NOTHING IN IT IS NEW.** CloudFormation's OWN
 * current template, mutated at nothing but the task-definition container
 * images in THIS product's repository, by `RETAG_PLANES_TEMPLATE_JS` — the
 * SAME script, so the same refusals: a tag that is not 40-hex, an image
 * outside the repository, an image the script cannot read, a template with no
 * image at all, a template over the inline byte ceiling, and **any difference
 * other than an image**, which it proves by re-serialising both with every
 * image blanked. Plus the ones this stage asks before it: the registry must
 * resolve the tag to the Build stage's digest, the stack must be updatable
 * (`STACK_READY_TO_UPDATE_JS`, also shared) and it must carry a service role
 * (G2964).
 *
 * 🛑 **WHY A THIRD PROJECT AND NOT A BLOCK IN `DEPLOY_BUILDSPEC_YAML`.** That
 * buildspec was 24,547 characters against CodeBuild's 25,600 (trap 12, G2221)
 * — this action does not fit in the 1,053 that were left, and trap 12's own
 * repair (`CODEBUILD_INLINE_BUILDSPEC_BYTES`) says *split, never cull*. The
 * split narrows IAM rather than widening it: the role that may write `Planes`
 * still cannot name `RunQueue`, and this one cannot name `Planes`.
 *
 * 🛑 **THE ORDER — AFTER `UpdateServices`, AND WHY (G2963).** The planes are
 * the only half of this deploy that a HEALTH CHECK and a CIRCUIT BREAKER
 * judge: an image that cannot start or serve is rolled back there, inside the
 * stack update, and `UpdateServices` fails. The worker has neither — it is a
 * one-shot scheduled task, and a broken image there fails once a minute with
 * `Observability`'s failed-task rule as its only witness. So the worker takes
 * an image ONLY after the planes have proved it, and a failed `UpdateServices`
 * means this action is never STARTED and the worker stays on the image the
 * planes stay on. The cost is named: for the length of one action the worker
 * runs the previous image while the planes run the new one — the window every
 * merge already had, measured now in minutes rather than days, and in the
 * direction G88 already makes safe (an older reader against a schema migrated
 * forward-compatibly).
 */
export const RETAG_RUN_WORKER_BUILDSPEC_YAML = `version: 0.2

# STAGE 5 OF 5, RUN-WORKER ACTION (G2961). Reached only after UpdateServices
# has settled BOTH planes on the revision CloudFormation owns - so the worker
# only ever receives an image the planes have already proved starts and serves.
#
# G108 IS NOT AMENDED BY THIS PROJECT EITHER. DO NOT ADD A STEP TO THE GATE.
#
# ⚠️ The  test -n  guards are read by tests/infra/pipeline.test.mjs and the
#    project that runs this file must set every name they mention.
phases:
  pre_build:
    commands:
      - |
        set -eu
        test -n "$PLANE_REPOSITORY_NAME"
        test -n "$RUN_QUEUE_STACK_NAME"
        test -n "$RUN_WORKER_TASK_FAMILY"
        test -n "$RUN_WORKER_RULE_NAME"
        test -n "$STACK_UPDATE_WAIT_ROUNDS"
      - |
        set -eu
        # ── THE TAG, AND THE CHECK THAT LETS THIS STAGE WRITE ONE (G2041) ─────
        # Re-established here rather than inherited from UpdateServices: this
        # is a separate build on a separate disk, and the registry's lifecycle
        # rule deletes images by design, so the mapping is asked for at the
        # moment of use. A tag the registry does not resolve to the bytes the
        # Build stage produced is never written into a template.
        test -s "$CODEBUILD_SRC_DIR/image-digest.txt"
        DIGEST="$(tr -d " \\n" < "$CODEBUILD_SRC_DIR/image-digest.txt")"
        case "$DIGEST" in
          sha256:*) ;;
          *) echo "FATAL: image-digest.txt does not hold a sha256 digest: $DIGEST" >&2; exit 1 ;;
        esac
        test -s "$CODEBUILD_SRC_DIR/image-tag.txt"
        TAG="$(tr -d " \\n" < "$CODEBUILD_SRC_DIR/image-tag.txt")"
        case "$TAG" in
          [0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]) ;;
          *) echo "FATAL: image-tag.txt does not hold a 40-hex commit sha: $TAG" >&2; exit 1 ;;
        esac
        TAGGED_DIGEST="$(aws ecr describe-images --region "$AWS_REGION" --repository-name "$PLANE_REPOSITORY_NAME" --image-ids imageTag="$TAG" --query 'imageDetails[0].imageDigest' --output text)"
        if [ "$TAGGED_DIGEST" != "$DIGEST" ]; then
          echo "FATAL: the registry says tag $TAG is $TAGGED_DIGEST and the Build stage produced $DIGEST." >&2
          echo "       This stage refuses to write a tag the registry does not resolve to the bytes that were just built." >&2
          exit 1
        fi
        echo "$TAG" > tag.txt
        echo "run worker: tag $TAG resolves to $DIGEST in $PLANE_REPOSITORY_NAME"
  build:
    commands:
      # ── 1 · WRITE THE STACK VALUE INTO RunQueue (G2961, G2041's SHAPE) ─────
      #
      # 🛑 NARROW BY CONSTRUCTION, NOT BY CARE. The template written back is
      #    CLOUDFORMATION'S OWN, mutated at nothing but the task-definition
      #    container images - so a run-queue-stack.ts change somebody merged
      #    does NOT ship here, and the queue, its dead-letter queue, its
      #    policies and its roles cannot move however badly this is edited.
      #    The retag PROVES that by re-serialising both templates with every
      #    image blanked and refusing if they differ anywhere else.
      #
      # ⚠️ IT DOES NOT CANCEL AN UPDATE IT GAVE UP WAITING FOR: a
      #    cancel-update-stack starts a rollback nobody watched begin.
      - |
        set -eu
        TAG="$(cat tag.txt)"

        aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$RUN_QUEUE_STACK_NAME" --output json > stack-describe.json
        node -e '${STACK_READY_TO_UPDATE_JS}'
        node -e '${STACK_HAS_SERVICE_ROLE_JS}'

        aws cloudformation get-template --region "$AWS_REGION" --stack-name "$RUN_QUEUE_STACK_NAME" --template-stage Original --query TemplateBody --output json > template-current.json
        test -s template-current.json
        TAG="$TAG" REPOSITORY="$PLANE_REPOSITORY_NAME" node -e '${RETAG_PLANES_TEMPLATE_JS}'
        test -s template-next.json

        # A re-run on an unchanged commit is SUCCESS, not a conflict; every
        # OTHER failure must still stop the stage, so the error is read.
        set +e
        aws cloudformation update-stack --region "$AWS_REGION" --stack-name "$RUN_QUEUE_STACK_NAME" --template-body file://template-next.json --parameters file://parameters.json --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND > update.out 2> update.err
        UPDATE_STATUS=$?
        set -e
        NEEDS_WAIT=yes
        if [ "$UPDATE_STATUS" -ne 0 ]; then
          if grep -q "No updates are to be performed" update.err; then
            echo "the stack already carries $TAG; CloudFormation has nothing to update. This is a re-run, not a conflict."
            NEEDS_WAIT=no
          else
            cat update.err >&2
            echo "FATAL: update-stack on $RUN_QUEUE_STACK_NAME exited $UPDATE_STATUS. NOTHING HAS BEEN DEPLOYED to the worker. The planes were already moved by UpdateServices and are NOT rolled back by this failure." >&2
            exit 1
          fi
        else
          cat update.out
        fi

        if [ "$NEEDS_WAIT" = "yes" ]; then
          ROUND=0
          while :; do
            ROUND=$((ROUND + 1))
            if aws cloudformation wait stack-update-complete --region "$AWS_REGION" --stack-name "$RUN_QUEUE_STACK_NAME"; then
              break
            fi
            STATUS="$(aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$RUN_QUEUE_STACK_NAME" --query 'Stacks[0].StackStatus' --output text)"
            case "$STATUS" in
              UPDATE_IN_PROGRESS|UPDATE_COMPLETE_CLEANUP_IN_PROGRESS) ;;
              *)
                echo "FATAL: $RUN_QUEUE_STACK_NAME is $STATUS. The update did not succeed." >&2
                # RAW STRING LITERAL in single quotes, never a backtick: a
                # backtick ENDS this template literal (manifest.test.mjs).
                aws cloudformation describe-stack-events --region "$AWS_REGION" --stack-name "$RUN_QUEUE_STACK_NAME" --max-items 25 --query "StackEvents[?ResourceStatus=='UPDATE_FAILED'].[LogicalResourceId,ResourceStatusReason]" --output text >&2 || true
                exit 1 ;;
            esac
            if [ "$ROUND" -ge "$STACK_UPDATE_WAIT_ROUNDS" ]; then
              echo "FATAL: $RUN_QUEUE_STACK_NAME is still $STATUS after $ROUND waiter rounds. It has NOT been cancelled; look at the stack." >&2
              exit 1
            fi
            echo "stack update: still $STATUS after round $ROUND; waiting again"
          done
        fi
        echo "=== $RUN_QUEUE_STACK_NAME now carries $TAG ==="

      # ── 2 · ASSERT THE TWO FACTS THE 2 Oct 2026 AUDIT FOUND FALSE (G2965) ──
      #
      # The REGISTERED revision runs the tag, and the SCHEDULE fires that
      # revision. Read from ECS and EventBridge, never from the template this
      # stage just wrote - asserting that would prove a file equals itself.
      - |
        set -eu
        TAG="$(cat tag.txt)"
        aws cloudformation describe-stack-resources --region "$AWS_REGION" --stack-name "$RUN_QUEUE_STACK_NAME" --output json > stack-resources.json
        FAMILY="$RUN_WORKER_TASK_FAMILY" node -e '${STACK_OWNED_TASK_DEFINITION_JS}'
        TD_ARN="$(cat owned-task-definition.txt)"
        test -n "$TD_ARN"
        aws ecs describe-task-definition --region "$AWS_REGION" --task-definition "$TD_ARN" --output json > task-definition.json
        aws events list-targets-by-rule --region "$AWS_REGION" --rule "$RUN_WORKER_RULE_NAME" --output json > targets.json
        TAG="$TAG" REPOSITORY="$PLANE_REPOSITORY_NAME" node -e '${RUN_WORKER_SETTLED_JS}'
        echo "the run worker runs the image the planes run"
`

/**
 * CodeBuild's ceiling on an INLINE buildspec, in characters.
 *
 * 🛑 **IT IS A REAL CLIFF, IT IS UNDOCUMENTED, AND NOTHING IN `npm run check`
 * COULD SEE IT UNTIL 28 Sep 2026 — G2221.** `CreateProject` and `UpdateProject`
 * refuse a longer one with an `InvalidInputException`. **`cdk synth` does not**:
 * it renders the oversized buildspec into the template perfectly happily, and
 * so does `cdk diff`, and so did every suite in `tests/infra/`. The first thing
 * that knows is a DEPLOY, and the way it says so is a stack rollback. The
 * captured RED, `reconcile-pipeline-staging`, 28 Sep 2026:
 *
 *     UPDATE_FAILED | AWS::CodeBuild::Project | Deploy
 *     Resource handler returned message: "Failed to call UpdateProject, reason:
 *     Max buildspec length is 25600 (Service: AWSCodeBuild; Status Code: 400;
 *     Error Code: InvalidInputException)"
 *
 * ⚠️ **THE NUMBER IS NOT IN AWS'S PUBLISHED QUOTAS AND THAT IS WHY IT IS
 * WORTH A PARAGRAPH — MEASURED, NOT ASSUMED, 28 Sep 2026.**
 * `aws service-quotas list-service-quotas --service-code codebuild` returns
 * concurrency limits and nothing else, and the *Quotas for AWS CodeBuild* page
 * documents a project's NAME length (2–150) and its DESCRIPTION length (255)
 * and **says nothing whatever about a buildspec**. `docs/build/deploy-handoff.md`
 * — which exists to carry exactly this class of fact and already carries ten
 * traps — had no mention of it either. **The only place 25,600 is written down
 * is the error**, so the error is quoted above the constant it produced.
 *
 * 🛑 **AND THE REPAIR WAS A SPLIT, NOT A CULL. READ THIS BEFORE SHORTENING
 * ANYTHING HERE TO FIT.** This file is mostly comments and the header says why:
 * they are the one thing that survives into the CodeBuild console, where the
 * next person is tempted to add a step to the gate. **Deleting them to buy
 * characters trades a documented trap for room** — trap 4 (each phase is a
 * separate shell), trap 8 (a pipeline reports the LAST command's status), the
 * `--delete` guard, G2041's own argument — **and this repository has paid for
 * every one of those traps once already.** Measured at the break: 28,180
 * characters, of which **11,857 were minified `node -e` payloads** and 7,607
 * were `#` comment lines. The payloads are the only part carrying no
 * reasoning — their arguments are the TypeScript docblocks above them, which
 * have never reached the console — so they were the obvious thing to move, and
 * they were NOT moved. Three shapes were refused:
 *
 *   (a) **A buildspec read from the source artefact** (`BuildSpec` as a path
 *       rather than inline). It removes the ceiling outright. REFUSED because
 *       it removes the DEPLOY GATE with it: this buildspec is in the pipeline
 *       stack's template, so it changes only when a person runs
 *       `cdk deploy reconcile-pipeline-staging`. A buildspec in an artefact is
 *       one **a merge to `main` rewrites**, and this one calls
 *       `cloudformation:UpdateStack` on the `Planes` stack with
 *       `CAPABILITY_NAMED_IAM`. That is precisely the blast radius G2041's
 *       option (c) was refused for, arriving by the back door. ⚠️ It is not
 *       even reachable today besides: the Deploy action's input is
 *       `buildOutput`, and that artefact carries `image-digest.txt`,
 *       `image-tag.txt` and `frontend/dist/**` — **no source tree at all**.
 *       The same objection kills moving the `node -e` payloads to script
 *       files, which would have to ride in that same artefact.
 *
 *   (b) **The payloads as CodeBuild project `environmentVariables`**, read back
 *       as `node -e "$RETAG_PLANES_TEMPLATE_JS"`. They live in the same
 *       template, so the deploy gate survives, and they do not count against
 *       this ceiling. **REFUSED ON THE MEASUREMENT ABOVE:** AWS publishes no
 *       limit on them either, and Service Quotas exposes none — so the repair
 *       for an unmeasured cliff would rest on a second unmeasured cliff, which
 *       is the defect wearing a different hat. **UNMEASURED, stated as
 *       unmeasured**, exactly as G1304 and G2048 state theirs.
 *
 *   (c) **The buildspec in S3** (`Source.BuildSpec` accepts a bucket ARN), or
 *       a CDK asset. REFUSED on this repository's own recorded position, one
 *       ceiling over: `RETAG_PLANES_TEMPLATE_JS` says the S3 repair for
 *       CloudFormation's 51,200-byte template ceiling *"needs a bucket and a
 *       grant this stage does not have"*, and `docs/build/deploy-handoff.md`
 *       §17.4 calls it *"a bucket, a grant and a ruling"*. It also spends the
 *       one property this whole file exists for: an S3 ARN in the console is
 *       not a comment a person reads in the console.
 *
 * ✅ **WHAT WAS TAKEN: the Deploy project became two — `Deploy` and
 * `PublishSite` — along the seam G993 had already drawn in prose.** Nothing was
 * shortened, nothing was moved out of the template, and the deploy gate is
 * untouched.
 *
 * ⚠️ **THE HEADROOM IS THIN AND IS NAMED RATHER THAN LEFT TO BE FOUND.** The
 * Deploy half lands at about 92% of this ceiling, where the analogous
 * `CLOUDFORMATION_INLINE_TEMPLATE_BYTES` sits at 70% and says so. **A ruling
 * the size of G2041 would break it again** — and the difference is that it now
 * breaks at `npm run check` rather than at a rollback. The next seam, if one is
 * needed, is `[precheck + UpdateStack]` and `[settle]`; it is NOT taken here,
 * because it would put the post-condition in a different project from the act
 * it asserts, and `ROLLOUT_VERDICT_JS`'s block argues for keeping them together.
 */
export const CODEBUILD_INLINE_BUILDSPEC_BYTES = 25_600

/**
 * Write a YAML buildspec, comments and all, onto a project's `Source.BuildSpec`.
 *
 * Read the header of this file before replacing this with `BuildSpec.fromObject`:
 * the comments are the artefact, not decoration on the way to one.
 *
 * 🛑 **AND IT REFUSES ONE CODEBUILD WOULD REFUSE — G2222, AT SYNTH.** This is
 * the second of two controls and it is the one that fires EARLIEST: a `cdk
 * synth` that cannot produce a deployable project stops here, which means
 * `npm run check` stops (`synth:infra` is in the gate) and so does any `cdk
 * diff` or `cdk deploy` a person runs by hand. The FIRST control is
 * `tests/infra/pipeline.test.mjs` §8, which reads the ceiling out of the
 * SYNTHESISED template against a number typed into the test — because a check
 * that compared this constant to a buildspec measured with this constant would
 * prove only that a variable equals itself.
 */
export function attachBuildSpecYaml(project: IProject, yaml: string): void {
  if (yaml.length > CODEBUILD_INLINE_BUILDSPEC_BYTES) {
    throw new Error(
      `${project.node.path} has an inline buildspec of ${yaml.length} characters and ` +
        `CodeBuild accepts at most ${CODEBUILD_INLINE_BUILDSPEC_BYTES}. UpdateProject ` +
        'refuses a longer one with an InvalidInputException and CloudFormation then rolls ' +
        'the whole stack back, so this synth stops rather than producing a template that ' +
        'cannot be deployed. DO NOT DELETE COMMENTS TO FIT: they are the artefact this ' +
        'file exists to carry into the console. Split the project instead — see ' +
        'CODEBUILD_INLINE_BUILDSPEC_BYTES for the three shapes that were refused.',
    )
  }
  const cfn = project.node.defaultChild as CfnProject
  cfn.addPropertyOverride('Source.BuildSpec', yaml)
}
