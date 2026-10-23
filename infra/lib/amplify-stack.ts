/**
 * `Amplify` — THE TWELFTH STACK. **S5, 22 Sep 2026, THE OWNER'S RULING:** the
 * public marketing plane lives on **AWS Amplify at the apex `reconcileai.app`**,
 * honouring `docs/build/deploy-handoff.md` §5.4 — *"public marketing plane:
 * Amplify hosting — **a different tool for a different job**."*
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE SENTENCE THIS STACK ANSWERS, AND IT HAS BEEN TRUE AND UNIMPLEMENTED
 *    SINCE 19 Sep 2026.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `EDGE_APEX_IS_SERVED_ELSEWHERE` in `lib/config.ts`:
 *
 *   > *"`reconcileai.app` — no label — is the public marketing plane … A
 *   >  wildcard does not cover the apex, so the absence is already true of both
 *   >  certificates; it is stated so a later reader does not add the apex as a
 *   >  SAN 'for completeness' and point the product's own marketing site at a
 *   >  distribution that serves an application shell."*
 *
 * **That constant does not change and does not become `false`.** What it
 * asserts is *not the `Edge` stack's*, and that is still exactly right; G298
 * confirmed the narrow reading of G297's *"flat apex"* on the same ground.
 * This stack is the *elsewhere*.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE APEX DOES NOT COLLIDE WITH THE `*.reconcileai.app` SINKHOLE, AND THE
 *    REASON IS THE ONE FACT G297's WHOLE ARGUMENT RESTS ON.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **A wildcard matches exactly one label.** `*.reconcileai.app` covers
 * `console.reconcileai.app` and `ten-acme.reconcileai.app`; it covers
 * `reconcileai.app` **not at all** — not in DNS, not in TLS. So:
 *
 *   · `lib/edge-stack.ts` §6's `FlatSinkholeA`/`FlatSinkholeAaaa` never answer
 *     for the apex, and an apex record takes nothing from them. The sinkhole's
 *     job — *"resolves so DNS is not an oracle, fails at TLS so a flat tenant
 *     host cannot be served"* — is untouched.
 *   · The flat CONSOLE certificate is not valid for the apex either, so
 *     **Amplify issues and renews a THIRD certificate** for this one name,
 *     in a region Amplify chooses, and neither `EdgeCertificate` stack knows
 *     about it. That is a real new thing to know and it is not a wildcard: a
 *     certificate for `reconcileai.app` is valid for `reconcileai.app` and
 *     nothing else, so it cannot fail open onto a tenant host.
 *
 * `tests/infra/amplify.test.mjs` §1 asserts BOTH halves against the **`Edge`**
 * template rather than against prose.
 *
 * ⚠️ **AND `www.reconcileai.app` IS NOT SERVED, WHICH IS A CONSEQUENCE WORTH
 * READING RATHER THAN A GAP.** `www` is a `RESERVED_HOST_LABELS` entry claimed
 * by *"G179 names it. The apex convention"*, and today it falls into the
 * sinkhole — so `https://www.reconcileai.app` RESOLVES and is then **refused at
 * the TLS handshake**, which for a marketing site is the worst of the three
 * possible answers. Adding it is one `subDomainSettings` entry and one decision
 * that is not this slice's: **which name is canonical is marketing's**, and
 * under G180 a host binding is permanent and additive.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 L1 CONSTRUCTS ONLY, AND IT IS NOT A CHOICE. `aws-cdk-lib` 2.270.0 SHIPS
 *    NO L2 FOR AMPLIFY HOSTING.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `CfnApp`, `CfnBranch`, `CfnDomain`. There is an `@aws-cdk/aws-amplify-alpha`
 * package and it is **refused**: an alpha module is not pinnable to a stable
 * API under G191's *every dependency pinned exact*, and adding it to
 * `infra/package.json` puts a package with breaking changes between minors in
 * front of the one surface the whole internet reaches. The L1s are the
 * CloudFormation resource, verbatim, and this file says so rather than leaving
 * a reader to wonder why the code reads lower-level than its neighbours.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 NO REPOSITORY, NO TOKEN, NO WEBHOOK — AND THIS IS THE ONE PLACE THE SLICE
 *    DEPARTS FROM THE `ci-image-stack.ts` PRECEDENT IT WAS TOLD TO FOLLOW.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `MARKETING_IS_MANUAL_DEPLOY` in `lib/config.ts` carries the whole argument
 * and the derivation. Its two halves, short:
 *
 *   1 · **`AWS::Amplify::App` HAS NO CODECONNECTIONS PROPERTY.** Measured
 *       against the pinned library's own generated types, not remembered.
 *       Amplify's repository connection is authorised by a **personal access
 *       token at create time** — AWS's own words on the property: *"The
 *       personal access token … The token is not stored."* — which is the shape
 *       `lib/connections.ts` records G263 as forbidding. A connection ARN in
 *       `accessToken` is not a token and fails at CREATE.
 *   2 · **THERE IS NO REPOSITORY TO CONNECT.** The marketing site does not
 *       exist; `1CloudHub/Reconcile` builds the APPLICATION SHELL, and pointing
 *       the apex at that is the exact thing `EDGE_APEX_IS_SERVED_ELSEWHERE`
 *       forbids. A repository connection would be a connection to the WRONG
 *       repository — `0004`'s *"a privilege ahead of its writer"* arriving as a
 *       source.
 *
 * **What the precedent's SHAPE still buys, and it is kept:** the thing a human
 * must establish out of band is named, has no default, and a deploy that has
 * not been given it stops rather than proceeding silently. Here that thing is
 * the CRM secret's VALUE, and the stack creates the secret with an EMPTY
 * endpoint so the intake answers `crm_not_configured` loudly until somebody
 * fills it — `Observability`'s `AlarmsPageNobodyUntil` shape (G1062).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE APEX A RECORD IS NOT IN THIS TEMPLATE AND **CANNOT BE**, AND THAT IS
 *    A MEASUREMENT RATHER THAN A PREFERENCE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `lib/config.ts` records the starting state: *"`dig +short reconcileai.app A`
 * returns nothing"*, and the zone `Z04053259WLMQJTR30EU` carries NS and SOA.
 * The apex must become an **ALIAS**, because a CNAME at a zone apex is
 * forbidden by DNS and Route 53 offers ALIAS in its place — and an ALIAS needs
 * a target DNS name **and** a target hosted-zone id.
 *
 * **`AWS::Amplify::Domain` publishes neither.** Its attributes, from the pinned
 * library:
 *
 *     Arn · AutoSubDomainCreationPatterns · AutoSubDomainIamRole · Certificate
 *     CertificateRecord · DomainName · DomainStatus · EnableAutoSubDomain
 *     StatusReason · UpdateStatus
 *
 * **There is no distribution domain and no hosted-zone id anywhere in that
 * list**, and `CfnApp`'s `attrDefaultDomain` is `<appId>.amplifyapp.com`, which
 * is a name in Amplify's zone rather than an alias target. So a
 * `route53.ARecord` here has nothing to point at — at any price.
 *
 * ✅ **WHAT WRITES IT: AMPLIFY ITSELF.** `reconcileai.app` is registered in
 * this account and its hosted zone is in this account, and Amplify updates
 * Route 53 automatically for a domain it can reach. **That is also why writing
 * one here would be actively wrong rather than merely impossible:** two owners
 * of one record name is the G297 Route 53 race this product has already paid
 * for once — *"both reported success. The A record was GONE afterwards; the
 * AAAA survived"* — and nothing in `npm run check` can see that class.
 *
 * ⚠️ **SO THE DOMAIN'S STATE IS PUBLISHED AS TWO OUTPUTS RATHER THAN ASSUMED.**
 * `CertificateRecord` is the validation record a human must create **if** the
 * automatic path did not happen, and `DomainStatus` is where a failure says so.
 * `docs/build/deploy-handoff.md` §14 carries the command that reads them.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE REWRITES ARE THE LOAD-BEARING PART, AND ONE OF THEM IS NARROWER THAN
 *    THIS SLICE WAS ASKED FOR.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * An Amplify `CustomRule` with `status: '200'` is a **reverse proxy**: one
 * origin to the browser, the fetch made server-side. That is G226's
 * no-preflight property reached with a different tool, and G293's negative
 * argument is what makes it necessary rather than convenient — *"THE CONTRACT
 * DECLARES NO `OPTIONS`, so answering a CORS preflight would be mounting an
 * operation the wire does not declare."*
 *
 *   `/session/realm`  ->  `https://console.reconcileai.app/session/realm`
 *   `/demo/intake`    ->  the intake function's own URL
 *
 * **The first is `/session/realm` and NOT `/session/*`.** `MARKETING_PROXIED_
 * PLANE_PATHS` in `lib/config.ts` carries the argument at length; its core is
 * that a 200 rewrite is invisible to the browser, so **every cookie on that
 * exchange belongs to the APEX** — and `/session/federated` MINTS a session,
 * which would bind `__Host-reconcile_session` to `reconcileai.app` and then be
 * REVOKED by G180's `checkHostBinding()` at the real host on the very next
 * request. `resolveHomeRealm` is the one session-tier operation that mints
 * nothing, sets no cookie, reads no cookie and *"is never GIVEN a user to look
 * up"*. `assertProxiesNoSessionBearingPath()` refuses the rest at synth and
 * `infra/test-fixtures/amplify-session-bearing-path.ts` witnesses it.
 *
 * ⚠️ **AND THE TARGET REACHES NO PLANE TODAY — THREE BLOCKERS, NOT ONE, AND
 * THE PARAGRAPH THAT STOOD HERE NAMED THE WRONG OBSERVABLE BEHAVIOUR (G2011).**
 * IT READ: *"`lib/edge-stack.ts` measures the console distribution in its own
 * header — `CacheBehaviors.Quantity: 0`, one origin, the bundle — so this
 * rewrite completes a handshake and is answered with `index.html`."* It is
 * corrected rather than deleted, because it is the sentence four files carried
 * and the one whoever first loads `/lookup` would have checked their symptom
 * against.
 *
 *   1. **NO PLANE ORIGIN.** The measurement is right: one origin, the bundle.
 *   2. **THE METHOD IS NOT ALLOWED.** `resolveHomeRealm` is a **POST**, and the
 *      console distribution's only behaviour is `ALLOW_GET_HEAD`. **CloudFront
 *      refuses a method a behaviour does not allow with its own 403 body** —
 *      the request never reaches an origin at all, so `index.html` is not what
 *      comes back and a reader debugging this would be looking for the wrong
 *      thing. Closing blocker 1 alone leaves this one standing.
 *   3. ⚠️ **AND A THIRD THAT IS TRUE OF THIS BRANCH AND FALSE AFTER THE MERGE:
 *      `resolveHomeRealm` was mounted in NO PROCESS when this stack was
 *      written.** The sibling slice mounts it (G1941), so on the merged tree
 *      this one is CLOSED and the first two are unchanged. Derive it rather
 *      than reading it:
 *      `grep -rn 'resolveHomeRealm' server/data-plane/start.ts`.
 *
 * **It is correct and INERT until the sibling slice gives that distribution a
 * data-plane origin AND a behaviour that allows POST.** Said here rather than
 * discovered by whoever first loads `/lookup`.
 *
 * ⚠️ **AND THE CONSOLE HOST IS REACHED BY NAME, NEVER BY CONSTRUCT REFERENCE.**
 * `CONSOLE_HOST` is a string in `lib/config.ts` that `Edge` and this stack both
 * read; there is no `Fn::ImportValue` between them and there must not be. G1012
 * is the reason in the general case and it binds harder here: `Edge` is
 * `reconcile-edge-staging`, a sibling slice is editing it, and an export minted
 * from this side would put a deploy-order edge between two stacks that share
 * nothing else.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE DEMO INTAKE. NO CRM CREDENTIAL REACHES A BROWSER AND REFERRAL-CODE
 *    VALIDITY IS NOT EVALUATED AT ALL.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The browser POSTs to `https://reconcileai.app/demo/intake`. Amplify proxies
 * that to a Lambda Function URL; ⚠️ **SINCE G3681 (3 Oct 2026, THE OWNER'S:
 * *"Queue it: the intake enqueues and returns immediately; a worker delivers to
 * the CRM. Constant-time answer."*) THAT FUNCTION VALIDATES, SENDS ONE SQS
 * MESSAGE AND ANSWERS** — and a SECOND function, on an SQS event source and
 * reached by no URL, reads ONE Secrets Manager secret holding the CRM's
 * endpoint and auth header and forwards the lead. This paragraph read *"the
 * function reads ONE Secrets Manager secret … and forwards the lead"* until
 * then; it is corrected rather than deleted. **The credential never leaves AWS,
 * never appears in a page, a bundle or a response, and is no longer held by
 * the public function at all.**
 *
 * 🛑 **VALIDITY CANNOT LEAK BECAUSE IT IS NEVER DECIDED HERE.**
 * `infra/lambda/demo-intake/guards.mjs` carries the argument: `referralCode` is
 * length-capped and forwarded as an opaque string, and whether it matches a
 * deal registration is the STAFF CONSOLE's question — which is where the pack
 * puts it (*"Match a deal registration … plane: control, surface: staff
 * console"*) and whose failure branch resolves by *"1CloudHub sales, by
 * judgement"*. **A function that validated and then hid the answer would be one
 * timing measurement and one error-message edit from an oracle**; a property
 * held by construction beats a property held by a careful response, which is
 * `resolveHomeRealm`'s own posture one plane over.
 *
 * The enforcement is a SIGNATURE rather than a sentence: `ACCEPTED` is a frozen
 * constant taking no argument, so there is no parameter a code could reach.
 *
 * ⚠️ **THE FUNCTION URL'S AUTH TYPE IS `NONE`, AND THAT IS A COST NAMED RATHER
 * THAN HIDDEN.** Amplify's rewrite proxy signs nothing, so `AWS_IAM` would
 * refuse every proxied request; the URL is therefore a SECOND, unbranded public
 * door to the same handler. Nothing about being behind the apex may be assumed
 * by that code, and nothing in it is.
 *
 * ⚠️ **AND THERE IS NO WAF AND NO RATE LIMIT.** `lib/edge-stack.ts` refuses a
 * response-headers policy on *"None is ruled"* and the same holds here; an
 * unauthenticated public POST that writes into a CRM wants one, the fences it
 * has instead are a closed field set, a per-field length cap and an 8 KiB body
 * cap, and **that is weaker than a rate limit and is not a substitute for one.**
 * Owed, and named in `docs/build/deploy-handoff.md` §14.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ IT TOUCHES `Planes`, `Network` AND `Edge` IN NO WAY AT ALL.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * No construct reference, no import, no export. CDK mints a cross-stack export
 * per attribute READ, and an export on `Planes` is a `Planes` DEPLOY — which
 * G1012 and G1013 measure as rolling both planes back to an image ECR has
 * EXPIRED. `RunQueue` and `Observability` both record the same constraint and
 * both pay it with a by-name join; this stack does not even need one, because
 * the only thing it reaches is a HOSTNAME. `tests/infra/amplify.test.mjs` §6
 * asserts the three templates name neither this stack nor its resources, and
 * the three synthesised templates were additionally diffed BYTE-FOR-BYTE
 * against the app without it.
 *
 * ⚠️ IT IS INSTANTIATED LAST AND NOTHING DEPENDS ON IT, so it can be deployed
 * at any time and deploying it moves nothing else.
 */

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import * as amplify from 'aws-cdk-lib/aws-amplify'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import type { Construct } from 'constructs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  APEX_HOST,
  CONSOLE_HOST,
  CRM_DELIVERY_FAILED_TOKEN,
  DEMO_INTAKE_DELIVERY_FAILED_METRIC,
  DEMO_INTAKE_MAX_BODY_BYTES,
  DEMO_INTAKE_METRIC_NAMESPACE,
  DEMO_INTAKE_DEAD_LETTER_RETENTION_DAYS,
  DEMO_INTAKE_PATH,
  DEMO_INTAKE_QUEUE_MAX_RECEIVE_COUNT,
  DEMO_INTAKE_QUEUE_RETENTION_DAYS,
  DEMO_INTAKE_QUEUE_VISIBILITY_SECONDS,
  DEMO_INTAKE_CRM_LEAD_DEFAULT_ENV,
  DEMO_INTAKE_CRM_LEAD_DEFAULTS,
  DEMO_INTAKE_WORKER_CONCURRENCY,
  DEMO_INTAKE_WORKER_TIMEOUT_SECONDS,
  MARKETING_BRANCH,
  MARKETING_PROXIED_PLANE_PATHS,
  amplifyAppName,
  assertProxiesNoSessionBearingPath,
  crmLeadIntakeSecretName,
  demoIntakeFunctionName,
  demoIntakeLogGroupName,
  demoIntakeDeadLetterQueueName,
  demoIntakeQueueName,
  demoIntakeRoleName,
  demoIntakeWorkerFunctionName,
  demoIntakeWorkerLogGroupName,
  demoIntakeWorkerRoleName,
} from './config.ts'
import type { DemoIntakeCrmLeadDefault, Environment } from './config.ts'
import { applyRequiredTags } from './tagging.ts'

/** Where the intake's source lives. A directory asset: no bundler, no network. */
const INTAKE_ASSET_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'lambda', 'demo-intake')

export interface AmplifyStackProps extends StackProps {
  readonly environment: Environment

  /**
   * Paths this stack should proxy to the console distribution in addition to
   * `MARKETING_PROXIED_PLANE_PATHS`.
   *
   * 🛑 IT IS EMPTY AND IT EXISTS FOR THE REASON `EdgeStackProps.
   * extraPlanePathPatterns` DOES: `assertProxiesNoSessionBearingPath()` is a
   * guard, and a guard that cannot be WITNESSED FAILING asserts nothing
   * (`docs/HANDOFF.md` §5.6). `infra/test-fixtures/amplify-session-bearing-path.ts`
   * passes `/session/<*>` through it — the exact widening this slice was asked
   * for and refused — and `tests/infra/amplify.test.mjs` §4 requires synth to
   * refuse, naming `/session/federated` in the message.
   *
   * ⚠️ IT IS SERVED AS WELL AS VALIDATED, for `extraPlanePathPatterns`' reason:
   * a prop that validated and did not serve would put the guard on a value
   * nothing uses, which is a control pointed away from the thing it protects.
   */
  readonly extraProxiedPlanePaths?: readonly string[]
}

export class AmplifyStack extends Stack {
  /** The Amplify app serving the apex. */
  readonly app: amplify.CfnApp

  /** The one branch the apex is served from. */
  readonly branch: amplify.CfnBranch

  /** The apex custom-domain association. */
  readonly domain: amplify.CfnDomain

  /** The demo intake: validates, enqueues, answers. It never reaches the CRM (G3681). */
  readonly intake: lambda.Function

  /** The queue between the intake and the worker. G3681. */
  readonly intakeQueue: sqs.Queue

  /** Where a lead the CRM never accepted waits for a person. G3681. */
  readonly intakeDeadLetterQueue: sqs.Queue

  /** The ONLY code in this account that reaches the CRM, reached by no URL. G3681. */
  readonly worker: lambda.Function

  /** The CRM's endpoint and auth header. Created EMPTY. */
  readonly crmSecret: secretsmanager.Secret

  /**
   * The metric a dropped lead mints. **G2006 — and THE ALARM ON IT IS NOT
   * HERE**, it is in `observability-stack.ts`, which is where G261 says every
   * alarm lives. See the block that builds this.
   */
  readonly deliveryFailures: logs.MetricFilter

  constructor(scope: Construct, id: string, props: AmplifyStackProps) {
    super(scope, id, props)

    const { environment } = props

    // ------------------------------------------- 1. the demo intake function

    /**
     * 🛑 THE SECRET IS CREATED AND ITS VALUE IS NOT, AND THE EMPTY `endpoint`
     * IS THE MECHANISM RATHER THAN A PLACEHOLDER SOMEBODY FORGOT.
     *
     * `readCrmConfig()` refuses an empty endpoint with `crm_not_configured`,
     * so a freshly deployed stack answers 502 on every intake and logs why.
     * **A form that thanks a visitor and reaches nobody is the failure the pack
     * already names as `V2`'s bad exit** — *"or a form submission that reaches
     * nobody"* — so it is made loud rather than allowed to happen quietly.
     *
     * ⚠️ THE GENERATED FIELD IS `authHeaderValue` AND IT IS UNUSABLE ON
     * PURPOSE. Secrets Manager requires a template plus one generated key; a
     * random 40 characters in the auth header means the first real call fails
     * at the CRM rather than succeeding against something. `endpoint` and
     * `authHeaderName` are empty strings, and the guard refuses on the endpoint
     * first, so the observable failure is the honest one.
     *
     * ⚠️ NO ROTATION, AND IT IS THE SAME GAP `lib/data-stack.ts` NAMES for its
     * role passwords: rotating means re-agreeing a credential with a third
     * party and restarting every holder, and nothing here does the second half.
     */
    this.crmSecret = new secretsmanager.Secret(this, 'CrmLeadIntake', {
      secretName: crmLeadIntakeSecretName(environment),
      description:
        'The CRM lead-intake endpoint and auth header. Created EMPTY: put-secret-value is a ' +
        'person step, and until it runs the demo intake answers crm_not_configured.',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ endpoint: '', authHeaderName: '' }),
        generateStringKey: 'authHeaderValue',
        passwordLength: 40,
      },
    })

    const logGroup = new logs.LogGroup(this, 'DemoIntakeLogs', {
      logGroupName: demoIntakeLogGroupName(environment),
      retention: logs.RetentionDays.ONE_MONTH,
      /* ⚠️ `DESTROY` AND NOT `RETAIN`, WHICH IS THE OPPOSITE OF THE KEY
       * MINTER'S CHOICE AND IS OPPOSITE FOR A REASON. That log is the only
       * record a key was minted. This one holds refusal codes and transport
       * errors and DELIBERATELY holds no lead — `index.mjs` never writes the
       * intake — so there is nothing here worth blocking a redeploy by name
       * for (trap 5). */
      removalPolicy: RemovalPolicy.DESTROY,
    })

    /**
     * ┌─ 🛑 THE INTAKE QUEUE — G3681, 3 Oct 2026, THE OWNER'S RULING, CLOSING ─┐
     * │    G2007: *"Queue it: the intake enqueues and returns immediately; a    │
     * │    worker delivers to the CRM. Constant-time answer."*                  │
     * │                                                                         │
     * │ G2001 closed the STATUS oracle and named the TIMING one it left open:   │
     * │ `deliver()` awaited the CRM on the request path, so the time to the     │
     * │ answer contained the CRM's time to its own — and a CRM that refuses an  │
     * │ unknown referral code faster than it writes a lead row published that  │
     * │ verdict as latency. **The request path now ends at `SendMessage`.**     │
     * │                                                                         │
     * │ ⚠️ `lib/config.ts`'s block argues STANDARD-not-FIFO and SSE-SQS-not-KMS. │
     * │ ⚠️ `DESTROY`, NOT `RETAIN`, AND IT IS A CHOICE ABOUT PERSONAL DATA: a   │
     * │ retained queue outlives the stack holding leads nothing reads, and a    │
     * │ retained NAME blocks the next create (trap 5). A person deleting this   │
     * │ stack is deleting the marketing plane; the leads go with it.            │
     * └─────────────────────────────────────────────────────────────────────────┘
     */
    this.intakeDeadLetterQueue = new sqs.Queue(this, 'DemoIntakeDlq', {
      queueName: demoIntakeDeadLetterQueueName(environment),
      retentionPeriod: Duration.days(DEMO_INTAKE_DEAD_LETTER_RETENTION_DAYS),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    this.intakeQueue = new sqs.Queue(this, 'DemoIntakeQueue', {
      queueName: demoIntakeQueueName(environment),
      retentionPeriod: Duration.days(DEMO_INTAKE_QUEUE_RETENTION_DAYS),
      visibilityTimeout: Duration.seconds(DEMO_INTAKE_QUEUE_VISIBILITY_SECONDS),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      deadLetterQueue: {
        queue: this.intakeDeadLetterQueue,
        maxReceiveCount: DEMO_INTAKE_QUEUE_MAX_RECEIVE_COUNT,
      },
    })

    const role = new iam.Role(this, 'DemoIntakeRole', {
      roleName: demoIntakeRoleName(environment),
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      /* ⚠️ ASCII ONLY. Trap 2: IAM rejects anything outside \t\n\r, 0x20-0x7E,
       * 0xA1-0xFF, so an em-dash here fails in CloudFormation, minutes in. */
      description:
        'S5/G3681 - the public demo intake. It may send to ONE queue and write ONE log ' +
        'group, and it holds no other verb in this account - no secret, no CRM.',
      /* 🛑 NO MANAGED POLICY, for the reason `lib/storage-stack.ts` gives:
       * `AWSLambdaBasicExecutionRole` grants logs:CreateLogGroup on `*` and
       * stream writes across every /aws/lambda/* group in a SHARED account. */
    })

    role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'WriteOwnLogStreamAndNoOther',
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [logGroup.logGroupArn, `${logGroup.logGroupArn}:*`],
      }),
    )

    /**
     * 🛑 ONE QUEUE, ONE VERB — AND NO SECRET AT ALL SINCE G3681.
     *
     * ⚠️ THIS ROLE HELD `this.crmSecret.grantRead(role)` UNTIL 3 Oct 2026 —
     * *"ONE SECRET, ONE VERB"* — and that grant MOVED to the worker's role
     * rather than being copied: the public function holding a CRM credential
     * it never reads is a credential one dynamic `import()` away from the
     * request path. **The fence that keeps the CRM off the request path is
     * this absence**, and `tests/infra/amplify.test.mjs` §5 asserts it.
     *
     * ⚠️ AND IT IS `sqs:SendMessage` ALONE, NOT `grantSendMessages()`, which
     * also renders `GetQueueAttributes` and `GetQueueUrl` — two reads of
     * queue metadata (depth included) the intake has no use for. SSE-SQS
     * needs no KMS verb, which is part of why it was chosen.
     */
    role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'SendToTheIntakeQueueAndNoOther',
        actions: ['sqs:SendMessage'],
        resources: [this.intakeQueue.queueArn],
      }),
    )

    this.intake = new lambda.Function(this, 'DemoIntake', {
      /* Trap 6: set explicitly, never derived from the construct path. */
      functionName: demoIntakeFunctionName(environment),
      role,
      logGroup,
      runtime: lambda.Runtime.NODEJS_22_X,
      /* G252 - ARM64 everywhere. */
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(INTAKE_ASSET_DIR),
      timeout: Duration.seconds(10),
      memorySize: 256,
      /**
       * 🛑 A BOUND, AND IT IS THE ONLY ONE AN UNAUTHENTICATED PUBLIC POST HAS.
       * There is no WAF and no rate limit on the apex, so reserved concurrency
       * is what stops a scripted flood becoming an unbounded Lambda bill and an
       * unbounded write rate into somebody else's CRM. `lib/storage-stack.ts`
       * sets it to 1 for a different reason and records the same sentence:
       * *"reserved concurrency is the only bound IAM cannot express."*
       *
       * ⚠️ FIVE AND NOT ONE. Demo submissions happen at human rate, and one
       * would serialise two visitors behind a five-second CRM timeout.
       */
      reservedConcurrentExecutions: 5,
      /* ⚠️ AT MOST 256 CHARACTERS AND NO NEWLINE. Trap: Lambda's documented
       * pattern is `.*`, which does not match a newline (manifest.test.mjs). */
      description:
        'S5/G3681 - the public demo intake. It validates and enqueues a lead and answers at ' +
        'once; it never reaches the CRM, so no CRM verdict or latency reaches a browser.',
      environment: {
        RECONCILE_DEMO_INTAKE_QUEUE_URL: this.intakeQueue.queueUrl,
      },
    })

    /**
     * 🛑 `authType: NONE`, AND THE ALTERNATIVE IS NOT AVAILABLE RATHER THAN
     * WORSE. Amplify's 200-rewrite proxy makes a plain HTTPS request and signs
     * nothing, so `AWS_IAM` would refuse every request that arrived through the
     * apex — which is every request this endpoint is FOR. The consequence is
     * stated at the head of this file and in `index.mjs`: the URL is a second,
     * unbranded public door, and nothing in the handler assumes otherwise.
     *
     * ┌─ 🛑 NO CORS BLOCK — AND THE PARAGRAPH THAT STOOD HERE STATED A FALSE ┐
     * │    SECURITY PROPERTY. G2002, 22 Sep 2026.                             │
     * │                                                                        │
     * │ IT READ: *"A Function URL's CORS configuration would publish this      │
     * │ endpoint to cross-origin JavaScript; the whole point of the rewrite is │
     * │ that the only caller is same-origin with the apex and therefore makes  │
     * │ no preflight at all. Adding CORS here would re-open by configuration   │
     * │ exactly what G293's argument closes by topology."* It is corrected     │
     * │ rather than deleted, because it is the sentence a reader would have    │
     * │ quoted before deciding this endpoint was closed.                       │
     * │                                                                        │
     * │ **ITS FIRST CLAUSE IS RIGHT AND ITS CONCLUSION IS WRONG, because CORS  │
     * │ is a RESPONSE-READING control and not a request-sending one.** The     │
     * │ absent configuration blocks a cross-origin caller from READING the     │
     * │ reply and blocks nothing about sending. A `POST` whose `Content-Type`  │
     * │ is `text/plain` is a CORS *simple request*: no preflight at all, and   │
     * │ **a write-only endpoint does not want the reply**. So both doors —     │
     * │ `https://reconcileai.app/demo/intake` and this `authType: NONE`        │
     * │ function URL — accepted `fetch(url, {method:'POST', mode:'no-cors',    │
     * │ body:'…'})` from any page in the world, and the handler inspected no   │
     * │ inbound header but the method. Every visitor to an attacker's page was │
     * │ a lead-injection bot.                                                  │
     * │                                                                        │
     * │ **WHAT CLOSES IT IS IN THE HANDLER AND NOT HERE:** `readContentType()` │
     * │ requires `application/json`, which is NOT a safelisted `Content-Type`  │
     * │ value, so every cross-origin attempt becomes a PREFLIGHTED request —   │
     * │ and the absence of a CORS block, which used to protect nothing, is     │
     * │ what then fails the preflight. **The absence is load-bearing now       │
     * │ rather than decorative**, which is the opposite of what it was, so:    │
     * │ still no CORS block, for a reason that is now true.                    │
     * │                                                                        │
     * │ ⚠️ IT IS A BROWSER CONTROL, NOT AN AUTHENTICATION. `curl` sets what it │
     * │ likes; what is closed is the AMBIENT case. The scripted flood is       │
     * │ G1975's and is bounded by reserved concurrency alone.                  │
     * └────────────────────────────────────────────────────────────────────────┘
     */
    const intakeUrl = this.intake.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    })

    /**
     * ┌─ 🛑 THE WORKER — G3681. THE ONLY CODE THAT REACHES THE CRM, AND NO URL ┐
     * │    REACHES IT.                                                         │
     * │                                                                        │
     * │ Same asset directory as the intake, different `handler` and different  │
     * │ ROLE: the intake's zip contains `worker.mjs` and cannot use it, because │
     * │ the secret verb is on THIS role alone. Its trigger is the queue; it has │
     * │ no function URL and no `lambda:InvokeFunction` permission to anybody.   │
     * │                                                                        │
     * │ ⚠️ `reportBatchItemFailures` IS LOAD-BEARING: without it `work()`'s     │
     * │ `batchItemFailures` answer is IGNORED and every record is deleted,     │
     * │ which turns *"retried and then dead-lettered"* into *"dropped"*.        │
     * │ ⚠️ ONE LEAD PER INVOCATION, so a batch cannot outlive the timeout       │
     * │ behind a slow CRM. ⚠️ CONCURRENCY TWO BOUNDS THE CRM WRITE RATE —       │
     * │ G2015's axis ① now bounded by the worker rather than by the intake.    │
     * └────────────────────────────────────────────────────────────────────────┘
     */
    const workerLogGroup = new logs.LogGroup(this, 'DemoIntakeWorkerLogs', {
      logGroupName: demoIntakeWorkerLogGroupName(environment),
      retention: logs.RetentionDays.ONE_MONTH,
      /* The intake's argument: refusal codes and transport errors, no lead. */
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const workerRole = new iam.Role(this, 'DemoIntakeWorkerRole', {
      roleName: demoIntakeWorkerRoleName(environment),
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      /* ASCII ONLY - trap 2. */
      description:
        'G3681 - the demo intake worker. It may consume ONE queue, read ONE secret and write ' +
        'ONE log group, and it holds no other verb in this account.',
    })

    workerRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'WriteOwnLogStreamAndNoOther',
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [workerLogGroup.logGroupArn, `${workerLogGroup.logGroupArn}:*`],
      }),
    )

    /**
     * 🛑 ONE SECRET, ONE VERB — MOVED HERE FROM THE INTAKE'S ROLE (G3681).
     * `grantRead()` renders `secretsmanager:GetSecretValue` and
     * `DescribeSecret` on THIS secret's ARN and nothing wider — **no
     * `ListSecrets`**, which takes no resource and would let this function
     * enumerate every secret in a shared account, including the four database
     * credentials `lib/data-stack.ts` creates.
     */
    this.crmSecret.grantRead(workerRole)

    this.worker = new lambda.Function(this, 'DemoIntakeWorker', {
      functionName: demoIntakeWorkerFunctionName(environment),
      role: workerRole,
      logGroup: workerLogGroup,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'worker.handler',
      code: lambda.Code.fromAsset(INTAKE_ASSET_DIR),
      timeout: Duration.seconds(DEMO_INTAKE_WORKER_TIMEOUT_SECONDS),
      memorySize: 256,
      reservedConcurrentExecutions: DEMO_INTAKE_WORKER_CONCURRENCY,
      description:
        'G3681 - delivers queued demo intakes to the CRM. Reached by no URL; failures are ' +
        'logged with a metric token, retried, then dead-lettered.',
      /* G3733: the owner's lead defaults, rendered from `lib/config.ts` so a
       * CRM-side id change is a config edit and a deploy of this stack. */
      environment: {
        RECONCILE_CRM_SECRET_NAME: this.crmSecret.secretName,
        ...Object.fromEntries(
          (Object.keys(DEMO_INTAKE_CRM_LEAD_DEFAULTS) as DemoIntakeCrmLeadDefault[]).map((key) => [
            DEMO_INTAKE_CRM_LEAD_DEFAULT_ENV[key],
            DEMO_INTAKE_CRM_LEAD_DEFAULTS[key],
          ]),
        ),
      },
    })

    /* ⚠️ `SqsEventSource` grants the worker role `grantConsumeMessages()` —
     * ReceiveMessage, DeleteMessage, ChangeMessageVisibility, GetQueueAttributes
     * and GetQueueUrl — on THIS queue only. The poller needs them; the suite
     * pins the exact set. */
    this.worker.addEventSource(
      new lambdaEventSources.SqsEventSource(this.intakeQueue, {
        batchSize: 1,
        maxConcurrency: DEMO_INTAKE_WORKER_CONCURRENCY,
        reportBatchItemFailures: true,
      }),
    )

    /**
     * ┌─ 🛑 THE METRIC A DROPPED LEAD MINTS — AND THE ALARM ON IT IS NOT HERE ┐
     * │    G2006, 22 Sep 2026.                                                │
     * │                                                                        │
     * │ `index.mjs`'s `handler()` CATCHES, so a dropped lead is a **successful │
     * │ invocation** as far as Lambda is concerned: `AWS/Lambda Errors` reads  │
     * │ `0`, `Throttles` reads `0`, the duration is normal. **An alarm on any  │
     * │ built-in function metric would sit green while every lead on earth was │
     * │ being discarded** — and G2001 makes that quieter still, because the    │
     * │ visitor is now told `received` as well. **The silent wire is paid for  │
     * │ by this metric and by nothing else.**                                  │
     * │                                                                        │
     * │ 🛑 **THE FILTER IS HERE AND THE ALARM IS IN `observability-stack.ts`,  │
     * │ AND THAT SPLIT IS G261 RATHER THAN AN OVERSIGHT.** A first draft put   │
     * │ the alarm here, reaching the topic by a SPELLED ARN so that no export  │
     * │ was minted — and `tests/infra/observability.test.mjs`'s                │
     * │ `test_no_other_stack_in_the_app_declares_an_alarm` **went RED**, which │
     * │ is the control working: *"alarms are declared in the Observability     │
     * │ stack. A second home for them is `docs/HANDOFF.md` §5.3 — two          │
     * │ implementations of one order, and the one that drifts is always the    │
     * │ copy."* **The control was right and the draft was wrong**, so the      │
     * │ ALARM moved rather than the ASSERTION.                                 │
     * │                                                                        │
     * │ ⚠️ **AND THE SPLIT COSTS NO COUPLING, WHICH IS WHY IT IS AVAILABLE AT  │
     * │ ALL**: a CloudWatch alarm needs a NAMESPACE and a metric NAME, both    │
     * │ constants in `lib/config.ts`, so `Observability` references no         │
     * │ construct here, imports nothing, and mints no export in either         │
     * │ direction. **The FILTER, by contrast, must live where the LOG GROUP    │
     * │ is**: `fromLogGroupName()` in the other stack would create a filter    │
     * │ CloudFormation may build before the group exists, across two stacks    │
     * │ deployed independently with no ordering between them. So each half     │
     * │ sits with the thing it cannot be separated from — and `Observability`  │
     * │ alarming on a metric another stack produces is exactly what it already │
     * │ does for every ECS and ALB metric it watches.                          │
     * │                                                                        │
     * │ ⚠️ A METRIC FILTER IS KEYED ON A LOG-LINE SPELLING, WHICH IS §5.1's    │
     * │ SHAPE, AND THE ANSWER IS THE ONE `INTAKE_FIELDS` ALREADY USES: the     │
     * │ token is written twice — `CRM_DELIVERY_FAILED_TOKEN` here and in       │
     * │ `guards.mjs` — and `tests/infra/demo-intake.test.mjs` joins the two    │
     * │ copies in BOTH directions. A token edited on one side is a red gate    │
     * │ rather than a filter that matches nothing for ever, which is the       │
     * │ failure mode a metric filter fails with and the reason they are        │
     * │ usually worthless.                                                     │
     * └────────────────────────────────────────────────────────────────────────┘
     */
    /* ⚠️ ON THE WORKER'S LOG GROUP SINCE G3681 — the token is written where
     * the CRM is called, and the intake no longer calls it. The namespace and
     * the metric name are unchanged, so `Observability`'s alarm (G2006) is
     * byte-identical and needed no edit. */
    this.deliveryFailures = new logs.MetricFilter(this, 'CrmDeliveryFailed', {
      logGroup: workerLogGroup,
      metricNamespace: DEMO_INTAKE_METRIC_NAMESPACE,
      metricName: DEMO_INTAKE_DELIVERY_FAILED_METRIC,
      /* The token and nothing else. The line also carries a reason and the
       * CRM's status; neither is matched on, because a filter that parsed the
       * line would break on the day the line gained a field. */
      filterPattern: logs.FilterPattern.literal(`"${CRM_DELIVERY_FAILED_TOKEN}"`),
      metricValue: '1',
    })

    // ------------------------------------------------- 2. the rewrite rules

    const proxiedPaths = [...MARKETING_PROXIED_PLANE_PATHS, ...(props.extraProxiedPlanePaths ?? [])]

    /**
     * 🛑 THE INTAKE RULE IS FIRST AND THE ORDER IS NOT COSMETIC. Amplify
     * evaluates custom rules TOP DOWN and takes the first match, so a broader
     * rule above a narrower one silently swallows it. Nothing here is broad
     * today — every source is an exact path — and the ordering is written down
     * because the first person to add a `/<*>` SPA fallback will put it at the
     * end or break both of these.
     *
     * ⚠️ AND THERE IS NO SPA FALLBACK AND NO 404 RULE. The marketing site does
     * not exist and its shape is a CMS's; a `404-200` rewrite to `/index.html`
     * is a decision about a site nobody has drawn. `lib/edge-stack.ts` ships a
     * CloudFront function for the application shell because that shell exists.
     */
    const customRules: amplify.CfnApp.CustomRuleProperty[] = [
      {
        source: DEMO_INTAKE_PATH,
        target: intakeUrl.url,
        status: '200',
      },
      ...proxiedPaths.map((path) => ({
        source: path,
        /* ⚠️ THE CONSOLE HOST BY NAME. See the header: no construct reference,
         * no Fn::ImportValue, no deploy-order edge to a stack a sibling slice
         * is editing. */
        target: `https://${CONSOLE_HOST}${path}`,
        status: '200',
      })),
    ]

    /**
     * 🛑 **EVERY RULE, AND NOT ONLY THE PROXIED ONES — G2010, 22 Sep 2026.**
     * The first draft ran the guard over `proxiedPaths` alone, so the INTAKE
     * rule — which is first, highest-priority, and the one rule whose source
     * is a constant somebody may edit — was never validated at all.
     * `DEMO_INTAKE_PATH = '/session'` would have cleared this guard by never
     * being handed to it, and cleared the wildcard test too, because it
     * carries no placeholder. **A guard that is not invoked is not a guard**,
     * and which rules get handed to it was itself a landmark (`docs/HANDOFF.md`
     * §5.1) rather than the property *does any rule this template ships proxy
     * a forbidden path*.
     *
     * ⚠️ THE ASSERTION IS OVER THE BUILT LIST AND NOT OVER ITS INPUTS, so a
     * rule added below — a SPA fallback, a `/blog/<*>` — meets it without
     * anybody remembering to. `tests/infra/amplify.test.mjs` §3 runs the same
     * guard over the SYNTHESISED template's own sources, which is the arm that
     * survives this loop being deleted.
     */
    for (const rule of customRules) assertProxiesNoSessionBearingPath(rule.source)

    // ---------------------------------------------------- 3. the Amplify app

    this.app = new amplify.CfnApp(this, 'MarketingApp', {
      name: amplifyAppName(environment),
      /* ⚠️ ASCII, and short. An Amplify app description is prose in a console
       * listing; `tests/infra/manifest.test.mjs` checks this type's charset
       * because this stack is the commit that introduces it. */
      description:
        'S5 - the public marketing plane at the apex. MANUAL DEPLOY: no repository and no ' +
        'access token, because Amplify authorises a repository with a personal access token ' +
        '(G263 forbids one) and the marketing site is in no repository yet.',
      /* A static site. `WEB_COMPUTE` is Amplify's SSR platform and would make
       * the apex run application code; the one piece of code this stack
       * deploys is a Lambda with its own role, behind a rewrite. */
      platform: 'WEB',
      customRules,
      /* No repository, so there is nothing for a deleted branch to follow. */
      enableBranchAutoDeletion: false,
      /* 🛑 NO `environmentVariables` AND NO `buildSpec`. Both are BUILD-time
       * inputs for a repository-connected app, and there is no repository and
       * no build. An `environmentVariables` entry here would also be the one
       * place in this stack a value could reach the published bundle, which is
       * the opposite of what the intake function exists to prevent. */
    })

    this.branch = new amplify.CfnBranch(this, 'MarketingBranch', {
      appId: this.app.attrAppId,
      branchName: MARKETING_BRANCH,
      description:
        'S5 - the branch the apex is served from. Deployed by aws amplify start-deployment ' +
        'against a zip; there is no build on push, because there is no repository.',
      /* ⚠️ FALSE AND NOT MERELY UNSET. There is nothing to build from, so an
       * auto-build is a job that fails on every trigger it never receives. */
      enableAutoBuild: false,
      enablePullRequestPreview: false,
      stage: 'PRODUCTION',
      framework: 'Web',
    })

    // ----------------------------------------------------- 4. the apex domain

    /**
     * 🛑 THE APEX IS A SUB-DOMAIN SETTING WITH AN EMPTY PREFIX, WHICH IS HOW
     * AMPLIFY SPELLS "THE DOMAIN ITSELF".
     *
     * ⚠️ AND THE DNS IT NEEDS IS WRITTEN BY AMPLIFY, NOT BY THIS TEMPLATE. The
     * header carries the measurement: `AWS::Amplify::Domain` publishes no
     * distribution domain and no hosted-zone id, so an ALIAS record here has
     * nothing to point at. Amplify updates a Route 53 zone it can reach — this
     * one, in this account — and a second writer of the same record name is the
     * G297 race this product has already paid for once.
     *
     * ⚠️ **THIS RESOURCE CAN HANG AND THEN ROLL THE STACK BACK, AND IT IS THE
     * ONE DEPLOY RISK IN THE FILE.** A domain association stays
     * `CREATE_IN_PROGRESS` while ACM validates and Amplify propagates; if
     * validation never completes, CloudFormation times out and rolls back
     * everything above. The two outputs below are what a human reads instead of
     * guessing, and `docs/build/deploy-handoff.md` §14 carries the commands.
     *
     * ⚠️ `enableAutoSubDomain` IS FALSE. It creates sub-domains from BRANCH
     * NAMES, which would put a branch's name into the flat namespace
     * `RESERVED_HOST_LABELS` and the `Edge` sinkhole both govern — a label
     * claimed by a git branch is a label nobody reviewed.
     */
    this.domain = new amplify.CfnDomain(this, 'ApexDomain', {
      appId: this.app.attrAppId,
      domainName: APEX_HOST,
      subDomainSettings: [{ branchName: this.branch.branchName, prefix: '' }],
      enableAutoSubDomain: false,
    })
    this.domain.addDependency(this.branch)

    applyRequiredTags(this, environment, 'public')

    // --------------------------------------------------------- 5. the outputs

    new CfnOutput(this, 'ApexHost', {
      value: APEX_HOST,
      description:
        'The public marketing plane. On NEITHER edge certificate and NEITHER distribution, ' +
        'which is what EDGE_APEX_IS_SERVED_ELSEWHERE has asserted since 19 Sep 2026.',
    })

    new CfnOutput(this, 'AmplifyDefaultDomain', {
      value: this.app.attrDefaultDomain,
      description:
        'The Amplify-managed host. Useful before the apex resolves, and it is NOT an alias ' +
        'target: no Route 53 ALIAS can point at it and none in this app tries.',
    })

    new CfnOutput(this, 'ApexDomainStatus', {
      value: this.domain.attrDomainStatus,
      description:
        'AVAILABLE means Amplify wrote the DNS and the certificate is issued. Any other value ' +
        'is where a stuck or failed domain association says so; read StatusReason next.',
    })

    new CfnOutput(this, 'ApexCertificateRecord', {
      value: this.domain.attrCertificateRecord,
      description:
        'The ACM validation record. Amplify writes it into Z04053259WLMQJTR30EU itself; it is ' +
        'published so a human can create it by hand if the automatic path did not happen.',
    })

    new CfnOutput(this, 'DemoIntakeUrl', {
      value: intakeUrl.url,
      description:
        'The intake function URL. authType NONE, because Amplify`s rewrite proxy signs ' +
        'nothing, so this is a SECOND public door to the same handler and its guards are the fence.',
    })

    new CfnOutput(this, 'DemoIntakeReachesNobodyUntil', {
      value: `put-secret-value on ${crmLeadIntakeSecretName(environment)} sets endpoint and token`,
      description:
        'The secret is created EMPTY, so the worker fails every lead into the dead-letter ' +
        'queue with a metric token until then; the intake answers 202 regardless (G3681).',
    })

    new CfnOutput(this, 'DemoIntakeDeadLetterQueueUrl', {
      value: this.intakeDeadLetterQueue.queueUrl,
      description:
        'Leads the CRM never accepted, kept 14 days. Redrive after fixing the secret with ' +
        'aws sqs start-message-move-task on this queue ARN - deploy-handoff section 27.',
    })

    new CfnOutput(this, 'MarketingIsManualDeploy', {
      value: 'aws amplify start-deployment - no repository, no access token, no build on push',
      description:
        'AWS::Amplify::App has NO CodeConnections property: a repository is authorised by a ' +
        'PERSONAL ACCESS TOKEN, which G263 forbids - and there is no marketing repository yet.',
    })

    new CfnOutput(this, 'ApexHasNoWwwUntil', {
      value: 'www.reconcileai.app falls into the Edge flat sinkhole and fails at the TLS handshake',
      description:
        'Serving www is one subDomainSettings entry and one decision that is marketing`s: ' +
        'which name is canonical. G180 makes a host binding permanent and additive.',
    })

    new CfnOutput(this, 'DemoIntakeBodyCap', {
      value: String(DEMO_INTAKE_MAX_BODY_BYTES),
      description:
        'Bytes. There is no WAF and no rate limit on the apex - the closed field set, the ' +
        'per-field length caps and this cap are the only fences the intake has.',
    })
  }
}
