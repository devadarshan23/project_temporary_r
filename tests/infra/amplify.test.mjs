/**
 * `Amplify` — THE TWELFTH STACK, READ OUT OF THE SYNTHESISED TEMPLATE.
 * **S5, 22 Sep 2026, the owner's ruling: the public marketing plane lives on
 * AWS Amplify at the apex `reconcileai.app`.**
 *
 * ⚠️ NO CONSTANT BELOW IS IMPORTED FROM `infra/`. Every expected value is typed
 * into this file, for the reason `tests/infra/run-queue.test.mjs` and
 * `tests/infra/data.test.mjs` both carry: comparing a stack to the constant the
 * stack read proves only that a variable equals itself.
 *
 * ┌─ WHAT IS ASSERTED, AND WHICH CONTROL EACH ONE IS ──────────────────────────┐
 * │ 1  🛑 THE APEX IS ON NEITHER EDGE CERTIFICATE, NEITHER DISTRIBUTION AND   │
 * │    NO `Edge` ROUTE 53 RECORD — asserted against the **`Edge` and          │
 * │    `EdgeCertificate`** templates, because `EDGE_APEX_IS_SERVED_ELSEWHERE` │
 * │    is a claim about THOSE stacks and a claim checked in its own stack is  │
 * │    checked nowhere.                                                       │
 * │ 2  MANUAL DEPLOY: no repository, no access token, no OAuth token, no      │
 * │    build on push. Amplify authorises a repository with a PERSONAL ACCESS  │
 * │    TOKEN and G263 forbids one.                                            │
 * │ 3  🛑 THE REWRITES, AND THE `/session/realm` ONE IS NARROWER THAN THE     │
 * │    `/session/*` THIS SLICE WAS ASKED FOR. A 200 rewrite is invisible to   │
 * │    the browser, so a session minted through it binds to the APEX and G180 │
 * │    revokes it at the real host.                                           │
 * │ 4  The guard REFUSES the widening, witnessed RED against a fixture.       │
 * │ 5  The intake holds ONE secret verb on ONE secret, and no CRM endpoint or │
 * │    credential appears anywhere in the template.                           │
 * │ 6  🛑 `Planes`, `Network` AND `Edge` ARE UNTOUCHED BY THIS STACK          │
 * │    EXISTING. An export on `Planes` is a `Planes` DEPLOY (G1012).          │
 * │ 7  The apex A record is ABSENT and the stack SAYS so, because             │
 * │    `AWS::Amplify::Domain` publishes no alias target.                      │
 * │ 8  G260's required tags reach the app and the branch, and no tenant tag.  │
 * └────────────────────────────────────────────────────────────────────────────┘
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ensureDeps, runInfraScript, synthesisedTemplates, resourcesOfType } from './support.mjs'

await ensureDeps()

const STACK = 'reconcile-amplify-staging'
const EDGE = 'reconcile-edge-staging'
const EDGE_CERTIFICATE = 'reconcile-edge-certificate-staging'

const APP = 'AWS::Amplify::App'
const BRANCH = 'AWS::Amplify::Branch'
const DOMAIN = 'AWS::Amplify::Domain'

/** The apex, typed here and not imported. */
const APEX = 'reconcileai.app'
/** The console host this stack proxies to, by NAME. `Edge` owns the alias. */
const CONSOLE = 'console.reconcileai.app'

const templates = synthesisedTemplates()

const stack = (name = STACK) => {
  const template = templates[name]
  assert.ok(template, `${name} is not in the synthesised app at all`)
  return template
}

const only = (type, name = STACK) => {
  const found = resourcesOfType(stack(name), type)
  assert.equal(found.length, 1, `expected exactly one ${type} in ${name}, found ${found.length}`)
  return found[0][1]
}

// ------------------------------------------- 1. the apex belongs to nobody else

/**
 * 🛑 THIS SECTION READS THE `Edge` TEMPLATES AND NOT THIS ONE, AND THAT IS THE
 * POINT. `EDGE_APEX_IS_SERVED_ELSEWHERE` says *"a later reader does not add the
 * apex as a SAN 'for completeness' and point the product's own marketing site
 * at a distribution that serves an application shell."* **That is a claim about
 * the `Edge` stack**, and asserting it here, over there, is what makes it a
 * control rather than a comment in a file the offending commit would not touch.
 */
test('test_the_apex_is_on_neither_edge_certificate_and_neither_distribution', () => {
  const certificates = resourcesOfType(stack(EDGE_CERTIFICATE), 'AWS::CertificateManager::Certificate')
  assert.ok(certificates.length >= 2, 'expected two viewer certificates; G297 requires two')
  for (const [id, certificate] of certificates) {
    const names = [
      certificate.Properties?.DomainName,
      ...(certificate.Properties?.SubjectAlternativeNames ?? []),
    ]
    assert.equal(
      names.includes(APEX),
      false,
      `${id} carries ${APEX} as a name. A wildcard matches exactly ONE label, so ` +
        '*.reconcileai.app never covered the apex - and adding it here would make an edge ' +
        'certificate valid for the marketing site, which is what EDGE_APEX_IS_SERVED_ELSEWHERE ' +
        'exists to forbid. The apex is Amplify`s, with a third certificate of its own.',
    )
  }

  for (const [id, distribution] of resourcesOfType(stack(EDGE), 'AWS::CloudFront::Distribution')) {
    const aliases = distribution.Properties?.DistributionConfig?.Aliases ?? []
    assert.equal(
      aliases.includes(APEX),
      false,
      `${id} claims ${APEX} as an alias. The apex is served by Amplify (deploy-handoff.md 5.4) ` +
        'and two stacks claiming one host is a binding G180 makes permanent.',
    )
  }
})

/**
 * 🛑 AND NO `Edge` ROUTE 53 RECORD NAMES THE APEX, WHICH IS A DIFFERENT CLAIM
 * FROM THE ONE ABOVE AND IS THE ONE THAT COSTS A DNS RECORD IF IT BREAKS.
 *
 * `Edge` writes a `*.reconcileai.app` SINKHOLE. A wildcard matches exactly one
 * label, so it never answers for the apex — but a NAMED apex record added there
 * later would collide with the records **Amplify writes into the same zone**,
 * and `lib/edge-stack.ts` §6 carries what that costs in this product's own
 * history: *"Both reported success. The A record was GONE afterwards; the AAAA
 * survived."* Nothing in `npm run check` can see that class except this.
 */
test('test_no_edge_route53_record_names_the_apex_so_amplify_is_the_only_writer', () => {
  const offenders = resourcesOfType(stack(EDGE), 'AWS::Route53::RecordSet')
    .filter(([, record]) => {
      const name = record.Properties?.Name
      return typeof name === 'string' && (name === APEX || name === `${APEX}.`)
    })
    .map(([id]) => id)
  assert.deepEqual(
    offenders,
    [],
    `these Edge records name the apex: ${offenders.join(', ')}. Amplify writes the apex records ` +
      'into Z04053259WLMQJTR30EU itself - AWS::Amplify::Domain publishes no distribution domain ' +
      'and no hosted-zone id, so no ALIAS in this app can point at it - and a second writer of ' +
      'one record name is the G297 race this product has already paid for once.',
  )
})

// --------------------------------------------- 2. manual deploy, no credential

test('test_the_app_has_no_repository_and_no_token_because_amplify_authorises_with_a_pat', () => {
  const app = only(APP)
  for (const forbidden of ['Repository', 'AccessToken', 'OauthToken']) {
    assert.equal(
      app.Properties?.[forbidden],
      undefined,
      `the Amplify app sets ${forbidden}. AWS::Amplify::App has NO CodeConnections property - ` +
        'AWS documents AccessToken as "the PERSONAL ACCESS TOKEN for a GitHub repository", ' +
        'which is the shape lib/connections.ts records G263 as forbidding. And there is no ' +
        'marketing repository yet: 1CloudHub/Reconcile builds the APPLICATION SHELL, and ' +
        'pointing the apex at that is what EDGE_APEX_IS_SERVED_ELSEWHERE exists to forbid.',
    )
  }
  assert.equal(app.Properties?.Platform, 'WEB', 'WEB_COMPUTE would make the apex run application code')

  const branch = only(BRANCH)
  assert.equal(
    branch.Properties?.EnableAutoBuild,
    false,
    'auto-build is on for a branch with no repository behind it: a job that fails on every ' +
      'trigger it never receives. FALSE and not merely unset.',
  )
  assert.equal(branch.Properties?.EnablePullRequestPreview, false)
})

/**
 * ⚠️ AND NO CREDENTIAL OF ANY KIND IS IN THE TEMPLATE. A `NoEcho` parameter
 * would hide a value from the console and would still put it in a shell
 * history and a change set; the design here is that there is nothing to hide.
 */
test('test_the_template_declares_no_parameter_and_therefore_carries_no_token', () => {
  assert.deepEqual(
    Object.keys(stack().Parameters ?? {}).filter((k) => !k.startsWith('BootstrapVersion')),
    [],
    'this stack takes a CloudFormation parameter. ci-image-stack.ts uses one for a ' +
      'CodeConnections ARN because CDK cannot mint one; here there is nothing a human must ' +
      'hand the DEPLOY. What a human must hand the RUNNING system is the CRM secret`s value, ' +
      'and that goes in by put-secret-value, never through a template.',
  )
})

// --------------------------------------------------------- 3. the rewrites

test('test_exactly_two_rewrites_and_the_session_one_is_resolveHomeRealm_alone', () => {
  const rules = only(APP).Properties?.CustomRules ?? []
  assert.equal(rules.length, 2, `expected two custom rules, found ${rules.length}`)

  const sources = rules.map((r) => r.Source).sort()
  assert.deepEqual(
    sources,
    ['/demo/intake', '/session/realm'],
    'the rewrite sources are not the two this stack is for. **`/session/realm` and NOT ' +
      '`/session/*`**: a 200 rewrite is invisible to the browser, so every cookie on the ' +
      'exchange is the APEX`s - and completeFederatedSignIn at /session/federated MINTS a ' +
      'session, which would bind __Host-reconcile_session to reconcileai.app and then be ' +
      'REVOKED by G180`s checkHostBinding() at the real host on the very next request. ' +
      'resolveHomeRealm mints nothing, sets no cookie, reads no cookie and "is never GIVEN a ' +
      `user to look up". Found: ${JSON.stringify(sources)}`,
  )

  for (const rule of rules) {
    assert.equal(rule.Status, '200', 'a rule is not a 200 rewrite. A 301/302 would send the ' +
      'browser to the other host, which is a cross-origin request and therefore a preflight - ' +
      'and the contract declares no OPTIONS on any tier.')
  }

  const realm = rules.find((r) => r.Source === '/session/realm')
  assert.equal(
    realm.Target,
    `https://${CONSOLE}/session/realm`,
    'the session rewrite does not target the console host. It is reached BY NAME and never by ' +
      'construct reference: an Fn::ImportValue here would put a deploy-order edge between this ' +
      'stack and reconcile-edge-staging, which shares nothing else with it.',
  )

  const intake = rules.find((r) => r.Source === '/demo/intake')
  assert.deepEqual(
    Object.keys(intake.Target ?? {}),
    ['Fn::GetAtt'],
    'the intake rewrite does not target this stack`s own function URL by GetAtt. A literal ' +
      'URL would be a lambda-url host somebody typed, and it changes when the function is ' +
      'replaced.',
  )
})

/**
 * 🛑 AND NO RULE SOURCE CARRIES A PLACEHOLDER AT ALL, WHICH IS STRICTER THAN
 * THE GUARD AND IS THE ARM THAT SURVIVES A FUTURE PATH NOBODY HAS THOUGHT OF.
 *
 * `assertProxiesNoSessionBearingPath()` refuses the paths we can NAME today.
 * This refuses the SHAPE that can grow to cover a path minted tomorrow — a
 * `/session/<*>` rule would proxy an operation added to the session tier next
 * month without anybody editing `infra/` at all.
 */
test('test_no_rewrite_source_is_a_wildcard_so_a_future_operation_cannot_be_published_by_accident', () => {
  const wild = (only(APP).Properties?.CustomRules ?? [])
    .map((r) => r.Source)
    .filter((s) => typeof s === 'string' && s.includes('<'))
  assert.deepEqual(
    wild,
    [],
    `these rewrite sources carry an Amplify placeholder: ${wild.join(', ')}. Every proxied ` +
      'path on the apex is written down one at a time, because a placeholder publishes ' +
      'whatever the session tier gains next without anybody editing infra/.',
  )
})

// ----------------------------------------------- 4. the guard, witnessed RED

test('test_synth_refuses_the_session_star_widening_this_slice_was_asked_for', () => {
  const run = runInfraScript('test-fixtures/amplify-session-bearing-path.ts')
  assert.notEqual(
    run.status,
    0,
    `/session/<*> synthesised successfully: ${run.stdout}${run.stderr}`,
  )
  const message = `${run.stdout}${run.stderr}`
  assert.ok(
    message.includes('/session/federated'),
    `the refusal must name /session/federated, or a reader learns that the widening is ` +
      `refused and not why: ${message}`,
  )
  assert.ok(
    message.includes('G180'),
    'the refusal must name G180, which is the ruling that turns a proxied mint into a ' +
      'revocation at the real host',
  )
  assert.ok(
    message.includes('MARKETING_PROXIED_PLANE_PATHS'),
    'the refusal must name the constant that is the repair',
  )
})

// ---------------- 5. the intake holds one verb on one QUEUE, the worker the secret

/**
 * 🛑 G3681, 3 Oct 2026 — THE OWNER'S RULING, CLOSING G2007: *"Queue it: the
 * intake enqueues and returns immediately; a worker delivers to the CRM.
 * Constant-time answer."*
 *
 * ⚠️ THIS SECTION ASSERTED *"the intake may read ONE secret"* UNTIL THAT DAY.
 * The secret verb MOVED to the worker's role and the intake's is now
 * `sqs:SendMessage` alone — and **that absence is the fence that keeps the CRM
 * off the request path**: the intake's zip contains `worker.mjs`, so the only
 * thing stopping the public function calling the CRM is that it cannot read
 * the credential. Witnessed RED: putting `this.crmSecret.grantRead(role)` back
 * on the intake's role fails the first assertion below.
 */
const policyOf = (roleLogicalIdPrefix) => {
  const found = resourcesOfType(stack(), 'AWS::IAM::Policy')
    .map(([, r]) => r)
    .filter((r) => (r.Properties?.Roles ?? []).some((ref) => String(ref?.Ref ?? '').startsWith(roleLogicalIdPrefix)))
  assert.equal(found.length, 1, `expected exactly one IAM policy on ${roleLogicalIdPrefix}, found ${found.length}`)
  return found[0]
}
const actionsOf = (policy) =>
  (policy.Properties?.PolicyDocument?.Statement ?? [])
    .flatMap((s) => (Array.isArray(s.Action) ? s.Action : [s.Action]))
    .sort()

const functionNamed = (name) => {
  const found = resourcesOfType(stack(), 'AWS::Lambda::Function')
    .map(([, r]) => r)
    .filter((r) => r.Properties?.FunctionName === name)
  assert.equal(found.length, 1, `expected exactly one function named ${name}, found ${found.length}`)
  return found[0]
}
const INTAKE_FUNCTION = 'reconcile-staging-demo-intake'
const WORKER_FUNCTION = 'reconcile-staging-demo-intake-worker'

test('test_the_stack_deploys_exactly_two_functions_the_intake_and_its_worker', () => {
  assert.deepEqual(
    resourcesOfType(stack(), 'AWS::Lambda::Function').map(([, r]) => r.Properties?.FunctionName).sort(),
    [INTAKE_FUNCTION, WORKER_FUNCTION],
  )
  assert.equal(resourcesOfType(stack(), 'AWS::IAM::Policy').length, 2, 'one policy per role, and two roles')
})

test('test_the_intake_may_send_to_one_queue_and_write_one_log_group_and_holds_no_secret_verb', () => {
  const actions = actionsOf(policyOf('DemoIntakeRole'))
  assert.deepEqual(
    actions,
    ['logs:CreateLogStream', 'logs:PutLogEvents', 'sqs:SendMessage'],
    'the public intake role holds a verb other than sending to its queue and writing its own ' +
      'log. G3681: the CRM is off the request path BECAUSE the intake cannot read the CRM ' +
      'secret - its zip contains worker.mjs, so this absence is the fence. And no ' +
      'GetQueueAttributes either: queue depth is not the public function`s business. ' +
      `Found: ${JSON.stringify(actions)}`,
  )
  for (const statement of policyOf('DemoIntakeRole').Properties.PolicyDocument.Statement) {
    const resources = Array.isArray(statement.Resource) ? statement.Resource : [statement.Resource]
    for (const resource of resources) assert.notEqual(resource, '*', 'a statement grants on *')
    if ([statement.Action].flat().includes('sqs:SendMessage')) {
      assert.match(JSON.stringify(statement.Resource), /DemoIntakeQueue/, 'SendMessage is not on the intake queue')
      assert.doesNotMatch(JSON.stringify(statement.Resource), /Dlq/, 'the intake may write the dead-letter queue')
    }
  }
})

test('test_the_worker_may_consume_one_queue_read_one_secret_and_write_one_log_group_and_nothing_else', () => {
  const policy = policyOf('DemoIntakeWorkerRole')
  const actions = actionsOf(policy)
  assert.deepEqual(
    actions,
    [
      'logs:CreateLogStream',
      'logs:PutLogEvents',
      'secretsmanager:DescribeSecret',
      'secretsmanager:GetSecretValue',
      'sqs:ChangeMessageVisibility',
      'sqs:DeleteMessage',
      'sqs:GetQueueAttributes',
      'sqs:GetQueueUrl',
      'sqs:ReceiveMessage',
    ],
    'the worker role holds a verb it should not. **No `secretsmanager:ListSecrets`**, which ' +
      'takes no resource and would enumerate every secret in a SHARED account - including the ' +
      'four database credentials data-stack.ts creates. And no sqs:SendMessage: the worker ' +
      `consumes, it does not produce. Found: ${JSON.stringify(actions)}`,
  )
  for (const statement of policy.Properties.PolicyDocument.Statement) {
    const resources = Array.isArray(statement.Resource) ? statement.Resource : [statement.Resource]
    for (const resource of resources) assert.notEqual(resource, '*', 'a statement grants on *')
    const verbs = [statement.Action].flat()
    if (verbs.some((v) => v.startsWith('sqs:'))) {
      assert.match(JSON.stringify(statement.Resource), /DemoIntakeQueue/, 'the worker consumes a queue that is not the intake queue')
    }
    if (verbs.some((v) => v.startsWith('secretsmanager:'))) {
      assert.match(JSON.stringify(statement.Resource), /CrmLeadIntake/, 'the worker reads a secret that is not the CRM secret')
    }
  }
  assert.equal(
    JSON.stringify(stack()).includes('AWSLambdaBasicExecutionRole'),
    false,
    'the managed policy grants logs:CreateLogGroup on * and stream writes across every ' +
      '/aws/lambda/* group in a shared account. storage-stack.ts refuses it for the same reason.',
  )
})

test('test_the_intake_is_arm64_bounded_and_carries_only_its_queue_url', () => {
  const fn = functionNamed(INTAKE_FUNCTION)
  assert.equal(fn.Properties?.Architectures?.[0], 'arm64', 'G252 - ARM64 everywhere')
  assert.equal(fn.Properties?.Runtime, 'nodejs22.x')
  assert.equal(fn.Properties?.Handler, 'index.handler')
  assert.ok(
    typeof fn.Properties?.ReservedConcurrentExecutions === 'number',
    'the intake has no reserved concurrency. It is an UNAUTHENTICATED PUBLIC POST and there ' +
      'is no WAF and no rate limit on the apex, so this is the only bound IAM cannot express.',
  )

  const environment = fn.Properties?.Environment?.Variables ?? {}
  assert.deepEqual(
    Object.keys(environment).sort(),
    ['RECONCILE_DEMO_INTAKE_QUEUE_URL'],
    'the intake carries an environment variable that is not its queue URL. Since G3681 it ' +
      'has no business knowing even the CRM secret`s NAME. ' +
      `Found: ${JSON.stringify(Object.keys(environment))}`,
  )

  const rendered = JSON.stringify(stack())
  assert.equal(
    /"endpoint":"[^"]+"/.test(rendered),
    false,
    'a non-empty CRM endpoint is in the template. The secret is created with endpoint EMPTY ' +
      'so the worker fails every lead LOUDLY until a person runs put-secret-value - ' +
      'Observability`s AlarmsPageNobodyUntil shape (G1062).',
  )
})

test('test_the_worker_is_arm64_bounded_reads_the_secret_by_name_and_has_no_url', () => {
  const fn = functionNamed(WORKER_FUNCTION)
  assert.equal(fn.Properties?.Architectures?.[0], 'arm64', 'G252 - ARM64 everywhere')
  assert.equal(fn.Properties?.Runtime, 'nodejs22.x')
  assert.equal(fn.Properties?.Handler, 'worker.handler')
  assert.equal(
    fn.Properties?.ReservedConcurrentExecutions,
    2,
    'the worker`s concurrency is what bounds the CRM write rate now (G2015 axis 1)',
  )
  /* 🛑 G3733: the owner's PipelinePulse lead defaults, typed HERE and not
   * imported — a template that rendered the wrong id, or `config.ts` with an
   * id edited, is a red gate rather than a lead filed under the wrong motion.
   * The secret's NAME rides beside them and the secret's VALUE never does. */
  const workerEnvironment = { ...(fn.Properties?.Environment?.Variables ?? {}) }
  assert.ok(workerEnvironment.RECONCILE_CRM_SECRET_NAME, 'the worker does not know the CRM secret`s name')
  delete workerEnvironment.RECONCILE_CRM_SECRET_NAME
  assert.deepEqual(workerEnvironment, {
    RECONCILE_CRM_GTM_MOTION_ID: '69b719bd-b86a-41f0-a3a4-5256cef59ca8',
    RECONCILE_CRM_BUSINESS_UNIT_ID: 'c39a4e1c-5127-484c-b8a9-bff0becaa8ff',
    RECONCILE_CRM_BUSINESS_REGION_ID: 'a02f4c75-dd7b-4789-8f9d-3d500a1a83e8',
    RECONCILE_CRM_LEAD_STATUS: 'MQL',
    RECONCILE_CRM_LEAD_SOURCE: 'reconcileai.app demo',
  })

  /* It is reached by the queue and by nothing else. */
  const urls = resourcesOfType(stack(), 'AWS::Lambda::Url').map(([, r]) => JSON.stringify(r.Properties?.TargetFunctionArn))
  assert.equal(urls.length, 1, 'a second function URL exists')
  assert.doesNotMatch(urls[0], /Worker/, 'the WORKER has a function URL, which puts the CRM one request away again')
  for (const [, permission] of resourcesOfType(stack(), 'AWS::Lambda::Permission')) {
    assert.doesNotMatch(
      JSON.stringify(permission.Properties?.FunctionName),
      /Worker/,
      'a Lambda permission names the worker, so something other than the queue can invoke it',
    )
  }
})

test('test_the_queue_dead_letters_after_five_receives_and_both_queues_are_encrypted_and_tls_only', () => {
  const queues = Object.fromEntries(
    resourcesOfType(stack(), 'AWS::SQS::Queue').map(([id, r]) => [r.Properties?.QueueName, { id, ...r.Properties }]),
  )
  assert.deepEqual(Object.keys(queues).sort(), ['reconcile-staging-demo-intake', 'reconcile-staging-demo-intake-dlq'])
  const main = queues['reconcile-staging-demo-intake']
  const dlq = queues['reconcile-staging-demo-intake-dlq']
  assert.equal(main.RedrivePolicy?.maxReceiveCount, 5)
  assert.deepEqual(main.RedrivePolicy?.deadLetterTargetArn, { 'Fn::GetAtt': [dlq.id, 'Arn'] })
  assert.equal(dlq.MessageRetentionPeriod, 14 * 24 * 3600, 'the DLQ keeps an undelivered lead for SQS`s maximum')
  /* Visibility at least six times the worker's timeout, AWS's own guidance. */
  assert.ok(main.VisibilityTimeout >= 6 * functionNamed(WORKER_FUNCTION).Properties.Timeout)
  for (const queue of [main, dlq]) {
    assert.equal(queue.SqsManagedSseEnabled, true, `${queue.QueueName} is not encrypted at rest`)
    assert.equal(queue.FifoQueue, undefined, 'FIFO deduplication would swallow an honest second submission')
  }
  const tlsOnly = resourcesOfType(stack(), 'AWS::SQS::QueuePolicy').filter(([, p]) =>
    JSON.stringify(p.Properties).includes('"aws:SecureTransport":"false"'),
  )
  assert.equal(tlsOnly.length, 2, 'enforceSSL is missing on one of the two queues')
})

test('test_the_event_source_reports_partial_batch_failures_one_lead_at_a_time', () => {
  const mapping = only('AWS::Lambda::EventSourceMapping')
  assert.deepEqual(
    mapping.Properties?.FunctionResponseTypes,
    ['ReportBatchItemFailures'],
    'without ReportBatchItemFailures the worker`s batchItemFailures answer is IGNORED and every ' +
      'record is deleted - a failed delivery becomes a dropped lead rather than a retried one.',
  )
  assert.equal(mapping.Properties?.BatchSize, 1)
  assert.equal(mapping.Properties?.ScalingConfig?.MaximumConcurrency, 2)
  assert.match(JSON.stringify(mapping.Properties?.FunctionName), /DemoIntakeWorker/)
  assert.match(JSON.stringify(mapping.Properties?.EventSourceArn), /DemoIntakeQueue/)
})

/**
 * ⚠️ TWO LAMBDA PERMISSIONS IS CDK's PAIR FOR A PUBLIC FUNCTION URL, NOT A
 * SECOND DOOR SOMEBODY ADDED. `InvokeFunctionUrl` plus `InvokeFunction` with
 * `InvokedViaFunctionUrl: true` — the second is scoped to arrivals through the
 * URL and grants nothing to a direct `lambda:Invoke`. Asserted so the count is
 * not read as a leak, and so a THIRD permission has to be argued.
 */
test('test_the_function_url_is_public_and_that_is_the_only_way_it_can_be', () => {
  const url = only('AWS::Lambda::Url')
  assert.doesNotMatch(JSON.stringify(url.Properties?.TargetFunctionArn), /Worker/)
  assert.equal(
    url.Properties?.AuthType,
    'NONE',
    'AWS_IAM would refuse every request that arrived through the apex, because Amplify`s ' +
      '200-rewrite proxy makes a plain HTTPS request and signs nothing - which is every ' +
      'request this endpoint is FOR.',
  )
  assert.equal(
    url.Properties?.Cors,
    undefined,
    'a Function URL CORS block publishes this endpoint to cross-origin JavaScript. The whole ' +
      'point of the rewrite is that the only caller is same-origin with the apex and therefore ' +
      'makes no preflight at all; adding CORS re-opens by configuration what G293 closes by ' +
      'topology.',
  )

  const permissions = resourcesOfType(stack(), 'AWS::Lambda::Permission').map(([, r]) => r)
  assert.equal(permissions.length, 2, `expected CDK's two function-url permissions, found ${permissions.length}`)
  for (const permission of permissions) {
    assert.ok(
      permission.Properties?.FunctionUrlAuthType === 'NONE' ||
        permission.Properties?.InvokedViaFunctionUrl === true,
      'a Lambda permission on this function is not scoped to the function URL. A bare ' +
        'lambda:InvokeFunction to a wide principal is a second door with different rules.',
    )
  }
})

// ------------------------- 6. nothing else moved, and that is the constraint

test('test_planes_network_and_edge_are_untouched_by_this_stack_existing', () => {
  /*
   * 🛑 THE PROPERTY IS *THIS STACK MINTS NO CROSS-STACK EXPORT ON ANY OF THE
   * THREE*, and it is asserted directly rather than through a substring —
   * `tests/infra/run-queue.test.mjs` §5 records why its own first arm was
   * §5.1 for keying on one. A byte-for-byte diff against an app synthesised
   * WITHOUT this stack was run by hand at the commit that added this file and
   * reported IDENTICAL for **all eleven** pre-existing staging stacks; this
   * keeps the property checkable on every gate run.
   */
  const HINTS = ['Amplify', 'amplify', 'MarketingApp', 'DemoIntake']

  for (const name of [EDGE, 'reconcile-planes-staging', 'reconcile-network-staging']) {
    const template = stack(name)
    const imports = []
    const walk = (node) => {
      if (Array.isArray(node)) return node.forEach(walk)
      if (node === null || typeof node !== 'object') return
      for (const [key, value] of Object.entries(node)) {
        if (key === 'Fn::ImportValue') imports.push(JSON.stringify(value))
        walk(value)
      }
    }
    walk(template)
    const offending = imports.filter((i) => HINTS.some((h) => i.includes(h)))
    assert.deepEqual(
      offending,
      [],
      `${name} imports a cross-stack export from the Amplify stack: ${offending.join(', ')}. ` +
        'CDK mints an export per attribute READ, and an export on Planes is a Planes DEPLOY - ' +
        'G1012 measures that as rolling both planes back to an image ECR has expired.',
    )

    assert.equal(
      JSON.stringify(template).includes('MarketingApp'),
      false,
      `${name} names this stack`,
    )
  }
})

// ------------------- 7. the apex A record is absent, and the stack says so

/**
 * 🛑 THIS ASSERTS AN ABSENCE AND THEN ASSERTS THAT THE ABSENCE IS ANNOUNCED,
 * WHICH IS THE PAIR `Observability`'s `AlarmsPageNobodyUntil` ESTABLISHED. An
 * absent record with no output reads exactly like a record somebody forgot.
 *
 * The reason it is absent is a measurement: `AWS::Amplify::Domain`'s attribute
 * list is `Arn · AutoSubDomainCreationPatterns · AutoSubDomainIamRole ·
 * Certificate · CertificateRecord · DomainName · DomainStatus ·
 * EnableAutoSubDomain · StatusReason · UpdateStatus` — **no distribution
 * domain and no hosted-zone id** — and an apex must be an ALIAS because a CNAME
 * at a zone apex is forbidden. There is nothing to point at.
 */
test('test_this_stack_writes_no_route53_record_and_publishes_the_domain_state_instead', () => {
  assert.deepEqual(
    resourcesOfType(stack(), 'AWS::Route53::RecordSet').map(([id]) => id),
    [],
    'this stack writes a Route 53 record. AWS::Amplify::Domain publishes no alias target, so ' +
      'nothing here could point at the right place - and Amplify writes the apex records into ' +
      'the zone itself, so a second writer of one name is the G297 race, measured.',
  )

  const domain = only(DOMAIN)
  assert.equal(domain.Properties?.DomainName, APEX)
  assert.deepEqual(domain.Properties?.SubDomainSettings, [{ BranchName: 'main', Prefix: '' }])
  assert.equal(
    domain.Properties?.EnableAutoSubDomain,
    false,
    'auto sub-domains create hosts from BRANCH NAMES, which puts a label nobody reviewed into ' +
      'the flat namespace RESERVED_HOST_LABELS and the Edge sinkhole both govern.',
  )

  const outputs = stack().Outputs ?? {}
  const values = Object.values(outputs)
  assert.ok(
    values.some((o) => typeof o.Description === 'string' && o.Description.includes('AVAILABLE')),
    'the stack does not OUTPUT the domain status. An AWS::Amplify::Domain can sit in ' +
      'CREATE_IN_PROGRESS while ACM validates and then roll the whole stack back; this is ' +
      'where a human reads what happened instead of guessing.',
  )
  assert.ok(
    values.some((o) => typeof o.Value === 'string' && o.Value.includes('put-secret-value')),
    'the stack does not SAY that the CRM secret is empty. Observability sets the precedent ' +
      'with AlarmsPageNobodyUntil: a half-built control presented as a whole one is how this ' +
      'record`s own 5.6 gets written again.',
  )
  assert.ok(
    values.some((o) => typeof o.Value === 'string' && o.Value.includes('www.reconcileai.app')),
    'the stack does not SAY that www falls into the Edge sinkhole and fails at the TLS ' +
      'handshake. For a marketing site that is the worst of the three possible answers, and ' +
      'which name is canonical is marketing`s decision rather than this slice`s.',
  )
})

// ---------------------------------------------------------- 8. G260's tags

test('test_g260_required_tags_reach_the_app_and_the_branch_and_no_tenant_tag_does', () => {
  for (const type of [APP, BRANCH]) {
    const tags = Object.fromEntries((only(type).Properties?.Tags ?? []).map((t) => [t.Key, t.Value]))
    assert.equal(tags.Project, 'reconcile', `${type} carries no Project tag`)
    assert.equal(tags.Environment, 'staging')
    assert.equal(
      tags.Plane,
      'public',
      'the marketing plane is tagged as something else. `edge` would say it belongs to the ' +
        'Edge stack`s CloudFront fleet, which is the one thing EDGE_APEX_IS_SERVED_ELSEWHERE ' +
        'denies, and `shared` would say it serves both planes, which it serves neither of. ' +
        'G260: the Plane tag is the one field invariant 3 is audited from.',
    )
    assert.equal(tags.ManagedBy, 'cdk')
    assert.equal(
      Object.hasOwn(tags, 'TenantId'),
      false,
      'G260 forbids a tenant identifier in a tag: an Amplify app listing is read by anybody ' +
        'in a shared account.',
    )
  }
})

// ------------- 9. EVERY rule in the template, not only the proxied ones (S3)

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 NO RULE THIS TEMPLATE SHIPS PROXIES A PATH THE PLANE SERVES, UNLESS IT IS
 *    ON THE ALLOW-LIST. G2009 AND G2010, 22 Sep 2026.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * TWO DEFECTS MEET HERE AND EITHER ALONE WOULD HAVE LEFT A HOLE.
 *
 * **G2010 — the guard was handed `proxiedPaths` and not the rules.** So the
 * INTAKE rule, which is FIRST and highest-priority, was never validated at all:
 * `DEMO_INTAKE_PATH = '/session'` would have cleared this guard by never being
 * given to it, and cleared §3's wildcard assertion too, because it carries no
 * placeholder. *Which rules get validated* was itself a landmark.
 *
 * **G2009 — the forbidden set was two `/session` spellings.** Measured against
 * the first draft: `/context/resolve` PASSED — and that is **D1**, which reads
 * `__Host-reconcile_session` and DURABLY BINDS the session's tenant, so a
 * proxied D1 is the identical G180 revocation the `/session/federated`
 * paragraph describes at length. `/v1/<*>` passed too.
 *
 * **This assertion is over the SYNTHESISED TEMPLATE**, so it survives the loop
 * in `amplify-stack.ts` being deleted, and it survives a rule added below the
 * two that exist today.
 *
 * ⚠️ THE MATCHER AND THE FORBIDDEN SET ARE TYPED IN HERE AND NOT IMPORTED, for
 * this file's own stated reason: comparing a stack to the constant the stack
 * read proves only that a variable equals itself.
 */

/** Amplify's rewrite-source language: `<*>` is the rest, `<name>` one segment. */
const amplifyRuleMatches = (source, path) => {
  const escaped = source.replace(/[.+^${}()|[\]\\*?]/g, '\\$&')
  const expression = escaped.replace(/<\\\*>/g, '.*').replace(/<[A-Za-z0-9_-]+>/g, '[^/]+')
  return new RegExp(`^${expression}$`).test(path)
}

/**
 * Concrete paths the data plane serves at the edge, minus the one the apex is
 * allowed to proxy, plus the plane's local-only paths. Each carries the reason.
 */
const FORBIDDEN_ON_THE_APEX = [
  ['/session', 'getSession and signOut READ and DESTROY a session'],
  ['/session/federated', 'completeFederatedSignIn MINTS one'],
  ['/context', 'the foundation tier base path'],
  ['/context/resolve', 'D1 - it reads the session cookie and BINDS the session`s tenant'],
  ['/v1', 'the capability tier`s base path'],
  ['/v1/runs', 'every capability operation authorises off the session'],
  ['/v1/exceptions', 'every capability operation authorises off the session'],
  ['/health', 'EDGE_LOCAL_ONLY_PATHS: no session, no gate, no invariant 10 record'],
  ['/status', 'EDGE_LOCAL_ONLY_PATHS'],
  ['/metrics', 'EDGE_LOCAL_ONLY_PATHS'],
]

test('test_no_rule_in_the_shipped_template_proxies_a_session_bearing_or_local_only_path', () => {
  const sources = (only(APP).Properties?.CustomRules ?? []).map((r) => r.Source)
  assert.ok(sources.length > 0, 'no custom rules were found; this assertion read nothing')

  const published = []
  for (const source of sources) {
    for (const [path, why] of FORBIDDEN_ON_THE_APEX) {
      if ([path, `${path}/`].some((request) => amplifyRuleMatches(source, request))) {
        published.push(`'${source}' proxies ${path} (${why})`)
      }
    }
  }
  assert.deepEqual(
    published,
    [],
    'the apex is the one host in this product that must never hold a session, and a 200 ' +
      'rewrite is invisible to the browser - so every cookie on the exchange is the APEX`s, ' +
      'and G180`s checkHostBinding() REVOKES at the real host on the next request. Found: ' +
      published.join(' | '),
  )

  /* And the ALLOW-LIST really is reachable, or this passes by forbidding
   * everything. `/session/realm` is the one path that may be proxied. */
  assert.ok(
    sources.some((s) => s === '/session/realm'),
    'the one permitted plane path is not proxied, so the assertion above holds vacuously',
  )
})

/**
 * 🛑 AND THE GUARD REFUSES `/context/<*>` AT SYNTH, WITNESSED RED — G2009.
 *
 * §4 witnesses `/session/<*>`, the widening this slice was ASKED for. This
 * witnesses the one the first draft's forbidden list did not name, and which
 * is the sharper of the two: D1 is a durable write.
 */
test('test_synth_refuses_a_context_rewrite_because_d1_binds_the_session_to_the_apex', () => {
  const run = runInfraScript('test-fixtures/amplify-context-path.ts')
  assert.notEqual(
    run.status,
    0,
    `/context/<*> synthesised successfully, so the apex would proxy D1: ${run.stdout}${run.stderr}`,
  )
  const message = `${run.stdout}${run.stderr}`
  assert.ok(
    message.includes('/context/resolve'),
    `the refusal must name /context/resolve, or a reader learns the widening is refused and ` +
      `not why: ${message}`,
  )
  assert.ok(
    message.includes('G180'),
    'the refusal must name G180, which is the ruling that turns a proxied bind into a ' +
      'revocation at the real host',
  )
})

// ------- 10. the metric a dropped lead mints, and the alarm that is NOT here

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 `handler()` CATCHES, SO A DROPPED LEAD IS A **SUCCESSFUL INVOCATION** AND
 *    `AWS/Lambda Errors` READS 0. G2006, 22 Sep 2026 — G1976 named this and
 *    did not build it.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * No built-in Lambda metric can see this failure: the invocation succeeds, the
 * duration is normal, nothing throttles. And G2001 makes it quieter still,
 * because the visitor is now told `received` either way. **The silent wire is
 * paid for by this metric filter and by nothing else.**
 */
test('test_a_metric_filter_on_the_intake_log_mints_a_metric_for_every_dropped_lead', () => {
  const filter = only('AWS::Logs::MetricFilter')
  assert.equal(
    filter.Properties?.FilterPattern,
    '"RECONCILE_CRM_DELIVERY_FAILED"',
    'the metric filter does not key on the token index.mjs logs. A filter whose pattern ' +
      'matches nothing is indistinguishable from a healthy endpoint for ever, which is the ' +
      'failure mode metric filters fail with.',
  )
  const transformation = filter.Properties?.MetricTransformations?.[0]
  assert.equal(transformation?.MetricName, 'CrmDeliveryFailed')
  assert.equal(transformation?.MetricNamespace, 'Reconcile/DemoIntake')

  /* It must read THIS function's log group and not some other. */
  assert.ok(
    JSON.stringify(filter.Properties?.LogGroupName ?? '').includes('DemoIntakeWorkerLogs'),
    'the metric filter is not attached to the WORKER`s log group. Since G3681 the token is ' +
      'written where the CRM is called, and the intake no longer calls it - a filter on the ' +
      'intake`s group matches nothing for ever.',
  )
})

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 AND THE ALARM IS **NOT** IN THIS STACK — G261, AND A CONTROL CAUGHT THE
 *    FIRST DRAFT PUTTING IT HERE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * That draft reached the topic by a SPELLED ARN so no export was minted, and
 * `tests/infra/observability.test.mjs`'s
 * `test_no_other_stack_in_the_app_declares_an_alarm` went **RED**: *"alarms
 * are declared in the Observability stack. A second home for them is
 * `docs/HANDOFF.md` §5.3 — two implementations of one order, and the one that
 * drifts is always the copy."* **The control was right and the draft was
 * wrong, so the ALARM moved rather than the ASSERTION.**
 *
 * ⚠️ THE TWO HALVES SIT WITH THE THING THEY CANNOT BE SEPARATED FROM: the
 * FILTER with the LOG GROUP it reads (a filter built in the other stack could
 * be created by CloudFormation before the group exists), the ALARM with the
 * other eight. And the split costs no coupling at all — an alarm needs a
 * namespace and a metric NAME, both constants.
 */
test('test_this_stack_declares_no_alarm_and_the_one_that_watches_it_is_observabilitys', () => {
  assert.deepEqual(
    resourcesOfType(stack(), 'AWS::CloudWatch::Alarm').map(([id]) => id),
    [],
    'an alarm is declared in the Amplify stack. G261 puts every alarm in Observability, and ' +
      'a second home is §5.3 — two implementations of one order, and the one that drifts is ' +
      'always the copy.',
  )

  /* 🛑 AND THE ALARM REALLY EXISTS OVER THERE, or this passes by the metric
   * being watched by nothing at all — which is the state G1976 recorded and
   * G2006 is supposed to have ended. */
  const watching = resourcesOfType(stack('reconcile-observability-staging'), 'AWS::CloudWatch::Alarm')
    .map(([, a]) => a.Properties)
    .filter((props) => props?.Namespace === 'Reconcile/DemoIntake')
  assert.equal(
    watching.length,
    1,
    'no alarm anywhere watches Reconcile/DemoIntake. handler() catches, so AWS/Lambda Errors ' +
      'reads 0 on every dropped lead and this metric is the only signal there is.',
  )
  assert.equal(watching[0].MetricName, 'CrmDeliveryFailed')
  assert.equal(watching[0].Threshold, 0)
  assert.equal(watching[0].ComparisonOperator, 'GreaterThanThreshold')
  assert.equal(
    watching[0].TreatMissingData,
    'notBreaching',
    'an idle marketing form publishes no datapoint for hours, so `missing` would make an ' +
      'idle endpoint indistinguishable from a broken one - which is the opposite of the ' +
      'running-below-desired alarm`s choice, and opposite for a reason.',
  )
})

/**
 * 🛑 AND THIS STACK STILL JOINS NOTHING, WHICH IS WHAT MADE THE SPLIT
 * AVAILABLE RATHER THAN A TRADE.
 *
 * G1974's claim is that the only thing `Amplify` reaches outside itself is a
 * HOSTNAME. `Observability` alarms on a metric by NAMESPACE and NAME — both
 * constants — so neither stack references a construct in the other, neither
 * mints an export, and there is no deploy-order edge in either direction.
 */
test('test_this_stack_adds_no_cross_stack_import_and_no_export_in_either_direction', () => {
  assert.equal(
    JSON.stringify(stack()).includes('Fn::ImportValue'),
    false,
    'this stack now imports a cross-stack export, which gives it a deploy-order edge it did ' +
      'not have. G1974: the only thing it reaches outside itself is a hostname string.',
  )
  const exported = Object.entries(stack().Outputs ?? {}).filter(([, o]) => o.Export)
  assert.deepEqual(exported.map(([name]) => name), [], 'this stack now publishes an export')

  /* And the other direction: Observability gained no export by watching it. */
  const observability = stack('reconcile-observability-staging')
  assert.deepEqual(
    Object.entries(observability.Outputs ?? {}).filter(([, o]) => o.Export).map(([n]) => n),
    [],
    'Observability now publishes a cross-stack export, which would mean the join is a ' +
      'reference rather than a spelled constant. G1012: a new export is a DEPLOY.',
  )
})

/**
 * 🛑 G3736: THE CRM SECRET RESOURCE IS DELIBERATELY UNCHANGED BY THE
 * PipelinePulse SLICE, AND THIS PINS IT. The worker now reads
 * `{endpoint, token}` and the generated placeholder still carries the old
 * keys with `endpoint` EMPTY — which is harmless, because a person REPLACES
 * the whole value. Editing `GenerateSecretString` on a deployed secret
 * regenerates its value, so a "tidy" template change landing after a person
 * had put the service token would silently wipe it. Unchanged means the
 * deploy and the `put-secret-value` commute.
 */
test('test_the_crm_secret_placeholder_is_unchanged_so_a_redeploy_cannot_wipe_a_token', () => {
  const secrets = resourcesOfType(stack(), 'AWS::SecretsManager::Secret')
  assert.equal(secrets.length, 1)
  const generate = secrets[0][1].Properties?.GenerateSecretString
  assert.deepEqual(generate, {
    GenerateStringKey: 'authHeaderValue',
    PasswordLength: 40,
    SecretStringTemplate: '{"endpoint":"","authHeaderName":""}',
  })
})
