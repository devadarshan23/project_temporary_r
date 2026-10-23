/**
 * G261's ALARMS — the tenth stack, and the one of the ten that had never been
 * written.
 *
 * 🛑 EVERY ASSERTION HERE IS WRITTEN SO THAT DELETING THE CONSTRUCT IT NAMES
 * TURNS IT RED. That is the bar `docs/HANDOFF.md` §5.6 sets — *a control which
 * cannot be witnessed failing is a control that asserts nothing* — and two of
 * them were witnessed red by hand before this file was trusted:
 *
 *   · deleting the `DataAlbFiveXxRate` alarm →
 *       "the data ALB has no 5xx alarm at all ... expected 8 alarms, found 7"
 *   · deleting `cloudwatchLogsExports` from `lib/data-stack.ts` →
 *       "no Aurora cluster exports its postgresql log ... 0 of 2"
 *
 * ⚠️ EVERY EXPECTED STRING AND EVERY EXPECTED NUMBER IS TYPED INTO THIS FILE,
 * none imported from `infra/lib/`. Comparing a stack to the constant the stack
 * read proves only that a variable equals itself — the warning
 * `tests/infra/data.test.mjs`, `tests/infra/storage.test.mjs` and
 * `tests/infra/tag-aspect.test.mjs` all carry.
 *
 * 🛑 SECTION 7 IS THE ONE TO READ IF YOU ARE SHORT OF TIME. It is not about
 * alarms at all: it asserts that this stack added NO OUTPUT to the `Planes`
 * template, because `Planes`' stack and the running fleet disagree about which
 * image runs and the image CloudFormation owns has been expired out of ECR
 * (G1012, G1013) — so a change that forces a `Planes` deploy rolls the fleet
 * back against a forward-only schema. **That constraint is the reason this
 * stack joins by NAME and by an already-exported ARN, and section 7 is what
 * stops the next reader "tidying" it into `loadBalancerFullName`.**
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import ts from 'typescript'

import { ensureDeps, synthesisedTemplates, resourcesOfType, REPO_ROOT } from './support.mjs'

await ensureDeps()

const STACK = 'reconcile-observability-staging'
const PLANES = 'reconcile-planes-staging'
const DATA = 'reconcile-data-staging'
const NETWORK = 'reconcile-network-staging'

const ALARM = 'AWS::CloudWatch::Alarm'
const TOPIC = 'AWS::SNS::Topic'
const SUBSCRIPTION = 'AWS::SNS::Subscription'
const RULE = 'AWS::Events::Rule'
const FLOW_LOG = 'AWS::EC2::FlowLog'
const LOG_GROUP = 'AWS::Logs::LogGroup'

let cache
const templates = () => {
  cache ??= synthesisedTemplates()
  return cache
}

const stack = (name) => {
  const template = templates()[name]
  assert.ok(template, `${name} is not in the synthesised app at all`)
  return template
}

const alarms = () => resourcesOfType(stack(STACK), ALARM)

const alarmNamed = (alarmName) => {
  const found = alarms().find(([, r]) => r.Properties?.AlarmName === alarmName)
  assert.ok(
    found,
    `no alarm named '${alarmName}'. The alarms that exist are: ` +
      JSON.stringify(alarms().map(([, r]) => r.Properties?.AlarmName)),
  )
  return found[1].Properties
}

const ruleNamed = (ruleName) => {
  const found = resourcesOfType(stack(STACK), RULE).find(
    ([, r]) => r.Properties?.Name === ruleName,
  )
  assert.ok(
    found,
    `no event rule named '${ruleName}'. The rules that exist are: ` +
      JSON.stringify(resourcesOfType(stack(STACK), RULE).map(([, r]) => r.Properties?.Name)),
  )
  return found[1].Properties
}

/** Every JSON string anywhere inside a value, so a token can be searched. */
const stringsIn = (value) => {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(stringsIn)
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(stringsIn)
  return []
}

// ------------------------------------------- 1. the stack exists at all

test('test_the_tenth_stack_is_in_the_synthesised_app', () => {
  /* The absence this slice ends. `ls infra/lib/*-stack.ts | wc -l` said 9
   * until 20 Sep 2026 and `grep -rln 'Alarm' infra/lib/` returned nothing —
   * while docs/tech-stack.md section 10, CLAUDE.md's infra/ entry,
   * lib/tagging.ts and lib/data-stack.ts all named a stack that did not
   * exist. */
  assert.ok(stack(STACK).Resources, `${STACK} synthesised no resources`)

  /*
   * ⚠️ **THIS ASSERTED `10` UNTIL LATER ON 20 Sep 2026 AND IS CORRECTED RATHER
   * THAN DELETED, BECAUSE IT WENT RED EXACTLY AS DESIGNED.** R-B's `RunQueue`
   * is the ELEVENTH stack, and this test is what told its author that a count
   * lived here — which is the whole reason a count control is worth having.
   *
   * 🛑 THE TEST NAME IS NOT RENAMED, DELIBERATELY. It is `test_the_tenth_...`
   * because `Observability` IS the tenth and that is the fact it was written
   * to pin; renaming it to `_the_eleventh_` would make it a test about
   * whichever stack landed most recently, which is a rule keyed on a landmark
   * instead of on the property — §5.1, in a test name.
   *
   * ⚠️ AND THE LIST IS ENUMERATED RATHER THAN COUNTED FROM HERE ON. A number
   * says only that somebody added one; the names say WHICH, so the next slice
   * has to argue for a stack by name rather than by incrementing an integer.
   *
   * ✅ **AND THAT IS EXACTLY WHAT HAPPENED A SECOND TIME, ON 22 Sep 2026.**
   * S5's `Amplify` — the TWELFTH stack, the owner's ruling putting the public
   * marketing plane at the apex `reconcileai.app` — went RED here, and the
   * enumerated form did the job the counted one could not: the failure named
   * `reconcile-amplify-staging` rather than reporting `11 !== 12`, so the
   * slice's author had to argue for the stack BY NAME in this file. **The
   * message below says TWELVE and the test name still says `_the_tenth_`**,
   * for the reason the paragraph above gives: `Observability` IS the tenth,
   * and renaming this on every arrival would make it a test about whichever
   * stack landed most recently.
   */
  const names = Object.keys(templates()).sort()
  assert.deepEqual(
    names,
    [
      /* S5, 22 Sep 2026 — the PUBLIC MARKETING PLANE, on Amplify, at the apex.
       * It declares no alarm, which is what the next test requires of it, and
       * that is a GAP rather than a property: a public endpoint answering 502
       * on every request because a secret is empty is exactly what an alarm is
       * for, and the construct belongs here. G1976 names it. */
      'reconcile-amplify-staging',
      'reconcile-ci-image',
      'reconcile-data-staging',
      'reconcile-edge-certificate-staging',
      'reconcile-edge-staging',
      'reconcile-identity-staging',
      'reconcile-network-staging',
      'reconcile-observability-staging',
      'reconcile-pipeline-staging',
      'reconcile-planes-staging',
      'reconcile-run-queue-staging',
      'reconcile-storage-staging',
    ],
    `the synthesised app is not the twelve stacks this file names: ${JSON.stringify(names)}`,
  )
})

test('test_no_other_stack_in_the_app_declares_an_alarm', () => {
  /* G261: alarms are declared in the Observability stack. A second home for
   * them is docs/HANDOFF.md §5.3 — two implementations of one order, and the
   * one that drifts is always the copy. */
  const elsewhere = Object.entries(templates())
    .filter(([name]) => name !== STACK)
    .flatMap(([name, template]) =>
      resourcesOfType(template, ALARM).map(([logicalId]) => `${name}/${logicalId}`),
    )
  assert.deepEqual(elsewhere, [], 'an alarm outside the Observability stack; G261 puts them here')
})

// ------------------------- 2. the topic, and the placeholder that subscribes it
//
// 🛑 THIS SECTION USED TO PIN ZERO SUBSCRIPTIONS AND SAY THE SUBSCRIBING COMMIT
// MUST DELETE THAT ASSERTION — G1062. THIS IS THAT COMMIT.
//
// **G1811, THE OWNER'S RULING, 22 Sep 2026: "Use a placeholder email address
// that must be replaced before production."** The old tripwire
// (`test_the_topic_has_ZERO_subscriptions_and_therefore_pages_nobody`) is
// DELETED here, deliberately, exactly as its own comment demanded — witnessed
// RED first, against the new `AlarmTopicPlaceholderSubscription`:
//
//   AssertionError: a subscription exists, so this stack now pages a person.
//   + [ 'reconcile-observability-staging/AlarmTopicPlaceholderSubscriptionABBAA65C' ]
//   - []
//
// What replaces it does not loosen the count back to "any subscription is
// fine" — it asserts there is EXACTLY ONE, that its protocol is EMAIL, and
// that its endpoint carries an unmistakable PLACEHOLDER marker (G1812), so a
// production deploy that forgets to replace it is a red gate rather than a
// silent gap, and a real address landing beside the marker by accident is
// caught the same way.

test('test_there_is_exactly_one_alarm_topic_and_it_is_named_for_the_environment', () => {
  const topics = resourcesOfType(stack(STACK), TOPIC)
  assert.equal(topics.length, 1, 'G261: ONE SNS topic per environment')
  assert.equal(topics[0][1].Properties?.TopicName, 'reconcile-staging-alarms')
})

test('test_the_topic_has_exactly_one_subscription_and_it_is_an_email_placeholder', () => {
  /* 🛑 G1812. Deleting the PLACEHOLDER marker without supplying a real
   * address is a red gate — that is the whole point of asserting on the
   * marker string rather than merely on subscription count. This also fails
   * if a second delivery path (a Lambda, a webhook, a second topic) is ever
   * added: G1811 asked for one email subscription, nothing else. */
  const subs = Object.entries(templates()).flatMap(([name, template]) =>
    resourcesOfType(template, SUBSCRIPTION).map(([logicalId, resource]) => ({
      key: `${name}/${logicalId}`,
      resource,
    })),
  )
  assert.equal(
    subs.length,
    1,
    `expected exactly ONE SNS subscription in the whole app; found ${JSON.stringify(
      subs.map((s) => s.key),
    )}`,
  )

  const [{ resource }] = subs
  assert.equal(
    resource.Properties?.Protocol,
    'email',
    'the one subscription must be EMAIL protocol — no Lambda, no webhook, no second path',
  )
  assert.match(
    String(resource.Properties?.Endpoint ?? ''),
    /PLACEHOLDER-REPLACE-BEFORE-PRODUCTION/,
    'the subscribed endpoint must carry the PLACEHOLDER marker — deleting the marker without ' +
      'a real address, or a real address landing without deleting it, must both go red',
  )

  /* The subscription must belong to THIS stack's topic, not some other one. */
  const [topicLogicalId] = resourcesOfType(stack(STACK), TOPIC)[0]
  assert.ok(
    stringsIn(resource.Properties?.TopicArn).some((s) => s.includes(topicLogicalId)),
    'the placeholder subscription must point at THIS stack`s alarm topic',
  )
})

test('test_a_real_looking_address_without_the_marker_would_be_refused', () => {
  /* Anti-vacuity: prove the marker regex actually excludes something, rather
   * than matching every string. A plausible real address must NOT satisfy
   * the pattern the test above checks. */
  assert.doesNotMatch('oncall@reconcileai.app', /PLACEHOLDER-REPLACE-BEFORE-PRODUCTION/)
})

test('test_the_stack_says_out_loud_that_the_pager_is_still_a_placeholder', () => {
  /* The comment in the source is not enough: a person reading the deployed
   * stack in the console sees outputs, not comments. `AlarmsPageNobodyUntil`
   * is RENAMED to `AlarmsPageAPlaceholderUntil` rather than deleted — G1813 —
   * because the old name would now be a FALSE claim (the topic is no longer
   * unsubscribed) and a false output reads as confirmation, which is worse
   * than no output at all. */
  const outputs = stack(STACK).Outputs ?? {}
  assert.ok(
    !Object.hasOwn(outputs, 'AlarmsPageNobodyUntil'),
    'the old output name is a false claim now that a subscription exists — it must be renamed',
  )
  assert.ok(
    Object.hasOwn(outputs, 'AlarmsPageAPlaceholderUntil'),
    'the stack must OUTPUT that its one subscriber is a placeholder, not only comment it',
  )
  const out = outputs.AlarmsPageAPlaceholderUntil
  assert.match(String(out.Value), /PLACEHOLDER/)
  assert.match(String(out.Description), /PendingConfirmation|confirm/i)
  assert.match(String(out.Description), /PLACEHOLDER-REPLACE-BEFORE-PRODUCTION/)
})

test('test_every_alarm_and_every_rule_publishes_to_that_one_topic', () => {
  const [topicLogicalId] = resourcesOfType(stack(STACK), TOPIC)[0]

  for (const [logicalId, alarm] of alarms()) {
    const actions = alarm.Properties?.AlarmActions ?? []
    assert.equal(
      actions.length,
      1,
      `${logicalId} has ${actions.length} alarm actions; an alarm with none is a metric ` +
        'with a threshold and no consequence',
    )
    assert.deepEqual(actions[0], { Ref: topicLogicalId }, `${logicalId} points somewhere else`)
  }

  for (const [logicalId, rule] of resourcesOfType(stack(STACK), RULE)) {
    const targets = rule.Properties?.Targets ?? []
    assert.equal(targets.length, 1, `${logicalId} has ${targets.length} targets`)
    assert.ok(
      stringsIn(targets[0].Arn).some((s) => s.includes('reconcile-staging-alarms')) ||
        JSON.stringify(targets[0].Arn).includes(topicLogicalId),
      `${logicalId} does not target the alarm topic: ${JSON.stringify(targets[0].Arn)}`,
    )
  }
})

// ------------------------------------------------ 3. the ten alarms by name

/**
 * ⚠️ **THIS TEST WAS NAMED `test_the_eight_alarms_…` AND EXPECTED EIGHT UNTIL
 * 20 Sep 2026 — G1283.** The ninth is
 * `reconcile-staging-run-queue-dead-letter-not-empty`, and **the count
 * assertion below is what caught it**: the alarm landed, this list did not
 * move, and the suite failed with `9 !== 8` naming the new alarm in its own
 * message. That is the control working, not a test that needed relaxing — the
 * list is extended here and the alarm has its own assertions below.
 *
 * 🛑 **AND IT HAPPENED AGAIN ON 22 Sep 2026 — G2006 — WHICH IS THE SECOND
 * TIME THIS ONE ASSERTION HAS CAUGHT AN ALARM ARRIVING WITH NO TEST, AND THE
 * FIRST TIME IT CAUGHT ONE ON THE SAME DAY IT WAS WRITTEN.** The tenth is
 * `reconcile-staging-demo-intake-crm-delivery-failed`. ⚠️ **AND ITS ROUTE
 * HERE IS WORTH ONE LINE, because a SECOND control fired first**: the S5
 * remediation put that alarm in `amplify-stack.ts`, and
 * `test_no_other_stack_in_the_app_declares_an_alarm` refused it — *"alarms
 * are declared in the Observability stack. A second home for them is
 * `docs/HANDOFF.md` §5.3."* **The alarm moved rather than the assertion**,
 * and then this list caught it landing untested. Neither was relaxed.
 */
test('test_the_ten_alarms_this_stack_owes_all_exist', () => {
  /* Named individually rather than counted, so a failure says WHICH row of
   * docs/tech-stack.md section 12 went missing. The count assertion below is
   * the other direction: it catches an alarm arriving with no test. */
  const expected = [
    'reconcile-staging-data-alb-5xx-rate',
    'reconcile-staging-data-alb-p99-latency',
    'reconcile-staging-data-plane-running-below-desired',
    'reconcile-staging-control-plane-running-below-desired',
    'reconcile-staging-data-aurora-acu-at-ceiling',
    'reconcile-staging-control-aurora-acu-at-ceiling',
    'reconcile-staging-data-aurora-connections',
    'reconcile-staging-control-aurora-connections',
    'reconcile-staging-run-queue-dead-letter-not-empty',
    /* G2006. The FIRST alarm in this stack on a metric THIS PRODUCT mints —
     * every other one is on a metric AWS publishes — and it exists because
     * none of those can see the failure it watches: the demo intake's
     * `handler()` CATCHES, so a dropped lead is a SUCCESSFUL invocation and
     * `AWS/Lambda Errors` reads 0. The metric filter that mints it is in
     * `amplify-stack.ts`, with the log group it reads. */
    'reconcile-staging-demo-intake-crm-delivery-failed',
    /* G3761/G3762, 4 Oct 2026 — G3686's two residuals, closed. The ELEVENTH
     * watches the demo intake's DEAD-LETTER depth: the delivery-failed alarm
     * above returns to OK five minutes after the last failed ATTEMPT while
     * the lead it failed sits in the DLQ for up to fourteen days, so this one
     * stays in ALARM for exactly as long as a lead is waiting to be redriven.
     * The TWELFTH watches the SOURCE queue's oldest message, because SQS
     * deletes an expired message WITHOUT dead-lettering it — a lead the worker
     * never receives reaches neither of the other two. Both are §3b below. */
    'reconcile-staging-demo-intake-dead-letter-not-empty',
    'reconcile-staging-demo-intake-queue-oldest-message-age',
    /* G3924, 4 Oct 2026 — the THIRTEENTH: a SUM of `AWS/Lambda Errors` over
     * every rotation function in `Data` (five role secrets, G3921, and the two
     * hosted master rotations, G263). Its shape — the seven function names
     * DERIVED from the Data template, the threshold, the topic — is asserted
     * in `tests/infra/role-secret-rotation.test.mjs`. This row is the census.
     * Witnessed RED here first: the suite failed with the alarm unnamed. */
    'reconcile-staging-secret-rotation-failed',
    /* G4401, 5 Oct 2026 — the FOURTEENTH, under the owner's ruling *"every
     * admitted run reaches a terminal status or an alarm"* (the G211
     * amendment). The DLQ alarm above catches a run whose message was
     * declined five times; it fires after 5 x 1800s = 2.5 HOURS. This one
     * catches the same stuck run at TWICE the longest a run may execute, and
     * it also catches the queue nobody is draining at all. Witnessed RED here
     * first: the census failed naming it as gone. §3c below. */
    'reconcile-staging-run-queue-oldest-message-age',
  ]
  const actual = alarms()
    .map(([, r]) => r.Properties?.AlarmName)
    .sort()
  for (const name of expected) {
    assert.ok(actual.includes(name), `the alarm '${name}' is gone: ${JSON.stringify(actual)}`)
  }
  assert.equal(
    actual.length,
    expected.length,
    'an alarm exists that this suite does not name. Every alarm owes an assertion, or the ' +
      `next one arrives untested: ${JSON.stringify(actual)}`,
  )
})

// --------------- 3b. the demo intake's two queue alarms — G3761–G3764
//
// G3686 named two exposures the intake queue (G3681) opened and that slice
// kept out so this template stayed byte-identical: nothing alarmed on the
// DLQ's DEPTH, and a lead the worker never RECEIVES expired silently at four
// days. Every expected value below is TYPED here — the queue names, the
// threshold, the retention — and the derivation test joins the threshold to
// the AMPLIFY template's own synthesised queue rather than to a constant in
// `infra/lib/`, so a change to the retry count or the visibility timeout that
// does not move the threshold is a red gate rather than a stale number.

const AMPLIFY = 'reconcile-amplify-staging'

const metricOf = (props) => ({
  namespace: props.Namespace,
  name: props.MetricName,
  dimensions: props.Dimensions,
  statistic: props.Statistic,
  period: props.Period,
})

const amplifyQueue = (queueName) => {
  const found = resourcesOfType(stack(AMPLIFY), 'AWS::SQS::Queue').find(
    ([, r]) => r.Properties?.QueueName === queueName,
  )
  assert.ok(found, `the Amplify stack declares no queue named ${queueName}`)
  return found[1].Properties
}

test('test_the_demo_intake_dead_letter_queue_has_a_depth_alarm_keyed_on_its_name', () => {
  const props = alarmNamed('reconcile-staging-demo-intake-dead-letter-not-empty')
  assert.deepEqual(metricOf(props), {
    namespace: 'AWS/SQS',
    name: 'ApproximateNumberOfMessagesVisible',
    dimensions: [{ Name: 'QueueName', Value: 'reconcile-staging-demo-intake-dlq' }],
    statistic: 'Maximum',
    period: 300,
  })
  /* Zero, strictly greater: the five receives have already been spent before a
   * lead lands here, so one lead in the DLQ is one person nobody reached. */
  assert.equal(props.Threshold, 0)
  assert.equal(props.ComparisonOperator, 'GreaterThanThreshold')
  assert.equal(props.EvaluationPeriods, 1)
  assert.equal(props.DatapointsToAlarm, 1)
  assert.equal(props.TreatMissingData, 'notBreaching')
})

test('test_the_demo_intake_source_queue_has_an_oldest_message_age_alarm', () => {
  const props = alarmNamed('reconcile-staging-demo-intake-queue-oldest-message-age')
  assert.deepEqual(metricOf(props), {
    namespace: 'AWS/SQS',
    name: 'ApproximateAgeOfOldestMessage',
    dimensions: [{ Name: 'QueueName', Value: 'reconcile-staging-demo-intake' }],
    statistic: 'Maximum',
    period: 300,
  })
  /* 5 receives x 90 s visibility = 450 s. Typed, not imported. */
  assert.equal(props.Threshold, 450)
  assert.equal(props.ComparisonOperator, 'GreaterThanThreshold')
  assert.equal(props.EvaluationPeriods, 1)
  assert.equal(props.DatapointsToAlarm, 1)
  assert.equal(props.TreatMissingData, 'notBreaching')
})

test('test_the_age_threshold_is_the_retry_budget_of_the_queue_the_amplify_stack_synthesises', () => {
  /* G1063: no threshold here is an SLO. A healthy lead is received within
   * seconds; one that FAILS is received at most maxReceiveCount times, each
   * time hidden for VisibilityTimeout, and then it LEAVES this queue for the
   * DLQ. So a message older than maxReceiveCount x VisibilityTimeout is not
   * being retried — it is not being RECEIVED: a backlog that outruns the
   * worker, or a consumer that is off. Read from the OTHER stack's template,
   * so the two cannot drift apart silently. */
  const source = amplifyQueue('reconcile-staging-demo-intake')
  const budget = source.RedrivePolicy.maxReceiveCount * source.VisibilityTimeout
  const props = alarmNamed('reconcile-staging-demo-intake-queue-oldest-message-age')
  assert.equal(
    props.Threshold,
    budget,
    `the age threshold is ${props.Threshold}s and the source queue's retry budget is ${budget}s ` +
      '(maxReceiveCount x VisibilityTimeout). Move them together.',
  )
  /* And the alarm must fire with the lead still alive: the threshold is a tiny
   * fraction of the retention a person has to act in. */
  assert.ok(props.Threshold < source.MessageRetentionPeriod / 100)
})

test('test_the_source_queue_now_keeps_an_unreceived_lead_for_the_sqs_maximum', () => {
  /* G3686 (1): SQS deletes an expired message WITHOUT dead-lettering it. At
   * four days a lead nobody received vanished with no record anywhere; at
   * fourteen — SQS's maximum — the age alarm above has fourteen days of
   * headroom behind it rather than four. */
  assert.equal(amplifyQueue('reconcile-staging-demo-intake').MessageRetentionPeriod, 14 * 24 * 3600)
})

test('test_the_two_queue_alarms_join_amplify_by_name_and_reference_no_construct_in_it', () => {
  /* No Fn::ImportValue, no Ref, no GetAtt inside either metric — the queue is
   * reached by its NAME, a constant, so neither stack gains an export and
   * there is no deploy-order edge between them (G1061's rule, G2006's join). */
  for (const name of [
    'reconcile-staging-demo-intake-dead-letter-not-empty',
    'reconcile-staging-demo-intake-queue-oldest-message-age',
  ]) {
    const rendered = JSON.stringify(alarmNamed(name).Dimensions)
    assert.doesNotMatch(rendered, /Fn::ImportValue|"Ref"|Fn::GetAtt/, `${name} references a construct`)
  }
  assert.deepEqual(
    Object.entries(stack(AMPLIFY).Outputs ?? {}).filter(([, o]) => o.Export).map(([n]) => n),
    [],
    'the Amplify stack exports something, which is a deploy-order edge',
  )
})

test('test_the_two_queue_alarms_are_tagged_public', () => {
  for (const name of [
    'reconcile-staging-demo-intake-dead-letter-not-empty',
    'reconcile-staging-demo-intake-queue-oldest-message-age',
  ]) {
    const found = alarms().find(([, r]) => r.Properties?.AlarmName === name)
    assert.ok(found, `no alarm named ${name}`)
    assert.equal((found[1].Properties.Tags ?? []).find((t) => t.Key === 'Plane')?.Value, 'public')
  }
})

// ---------- 3c. every admitted run reaches a terminal status or an alarm
//
// G4401–G4405, 5 Oct 2026 — the owner's ruling, part of the G211 amendment.
// Three signals, and every expected value is TYPED here rather than imported:
// the queue names, the 3000-second threshold (2 x RUN_MAX_EXECUTION_SECONDS =
// 2 x 1500), the task family and the two rule names. A run that is admitted
// and never finishes must surface as ONE of: the run queue's oldest message
// growing old, the run queue's DLQ holding a message, or the run worker task
// failing (non-zero exit, or never starting at all).

test('test_the_run_queue_has_an_oldest_message_age_alarm_at_twice_the_execution_ceiling', () => {
  const props = alarmNamed('reconcile-staging-run-queue-oldest-message-age')
  assert.deepEqual(metricOf(props), {
    namespace: 'AWS/SQS',
    name: 'ApproximateAgeOfOldestMessage',
    dimensions: [{ Name: 'QueueName', Value: 'reconcile-staging-run-admitted' }],
    statistic: 'Maximum',
    period: 300,
  })
  /* 2 x 1500. Typed, not imported: comparing to the constant the stack read
   * proves only that a variable equals itself. */
  assert.equal(props.Threshold, 3000)
  assert.equal(props.ComparisonOperator, 'GreaterThanThreshold')
  assert.equal(props.EvaluationPeriods, 1)
  assert.equal(props.DatapointsToAlarm, 1)
  assert.equal(props.TreatMissingData, 'notBreaching')
})

test('test_the_age_threshold_fires_before_the_redrive_would_dead_letter_the_run', () => {
  /* The point of the age alarm is that it is EARLIER than the DLQ. Derived
   * from the RunQueue template's own synthesised redrive and visibility, not
   * from a constant: maxReceiveCount x VisibilityTimeout must exceed 3000, or
   * this alarm adds nothing the DLQ alarm does not already say. */
  const queues = resourcesOfType(stack('reconcile-run-queue-staging'), 'AWS::SQS::Queue')
  const source = queues.find(([, r]) => r.Properties?.QueueName === 'reconcile-staging-run-admitted')
  assert.ok(source, 'the RunQueue stack declares no queue named reconcile-staging-run-admitted')
  const { VisibilityTimeout, RedrivePolicy } = source[1].Properties
  const deadLetteredAfter = RedrivePolicy.maxReceiveCount * VisibilityTimeout
  assert.ok(
    deadLetteredAfter > 3000,
    `the DLQ would receive a stuck run after ${deadLetteredAfter}s, no later than the age ` +
      'alarm at 3000s; the age alarm is then redundant and the threshold needs re-deriving',
  )
  /* And a run executing for the WHOLE ceiling (1500s) plus one poll tick must
   * stay under the threshold, or a healthy long run pages. */
  assert.ok(1500 + 60 < 3000)
})

test('test_the_run_queue_dead_letter_alarm_fires_on_any_message', () => {
  const props = alarmNamed('reconcile-staging-run-queue-dead-letter-not-empty')
  assert.deepEqual(metricOf(props), {
    namespace: 'AWS/SQS',
    name: 'ApproximateNumberOfMessagesVisible',
    dimensions: [{ Name: 'QueueName', Value: 'reconcile-staging-run-admitted-dlq' }],
    statistic: 'Maximum',
    period: 300,
  })
  /* depth > 0, spelled as >= 1: the five receives are already spent. */
  assert.equal(props.Threshold, 1)
  assert.equal(props.ComparisonOperator, 'GreaterThanOrEqualToThreshold')
  assert.equal(props.TreatMissingData, 'notBreaching')
})

test('test_a_run_worker_task_that_exits_non_zero_or_never_starts_is_caught', () => {
  const exitCodeRule = ruleNamed('reconcile-staging-run-worker-task-failed')
  assert.deepEqual(exitCodeRule.EventPattern.detail.containers, {
    exitCode: [{ 'anything-but': 0 }],
  })
  const didNotRun = ruleNamed('reconcile-staging-run-worker-task-did-not-run')
  assert.deepEqual(didNotRun.EventPattern.detail.stopCode, [
    { 'anything-but': ['EssentialContainerExited'] },
  ])
  assert.equal(
    didNotRun.EventPattern.detail.containers,
    undefined,
    'a task that failed to start carries no exit code; requiring one is the hole this rule closes',
  )
  for (const rule of [exitCodeRule, didNotRun]) {
    assert.deepEqual(rule.EventPattern.source, ['aws.ecs'])
    assert.deepEqual(rule.EventPattern['detail-type'], ['ECS Task State Change'])
    assert.deepEqual(rule.EventPattern.detail.lastStatus, ['STOPPED'])
    assert.ok(rule.EventPattern.detail.clusterArn, 'a rule with no cluster term matches every cluster')
    /* Joined by NAME: the family is a literal, never an import from RunQueue. */
    assert.deepEqual(rule.EventPattern.detail.group, ['family:reconcile-staging-run-worker'])
  }
})

test('test_the_run_worker_family_these_rules_watch_is_the_one_run_queue_synthesises', () => {
  const families = resourcesOfType(stack('reconcile-run-queue-staging'), 'AWS::ECS::TaskDefinition').map(
    ([, r]) => r.Properties?.Family,
  )
  assert.ok(
    families.includes('reconcile-staging-run-worker'),
    `the rules watch family:reconcile-staging-run-worker and RunQueue declares ${JSON.stringify(families)}`,
  )
})

test('test_the_alb_5xx_alarm_is_a_RATE_over_both_5xx_families_and_not_a_count', () => {
  const props = alarmNamed('reconcile-staging-data-alb-5xx-rate')
  const metrics = props.Metrics ?? []
  const expression = metrics.find((m) => typeof m.Expression === 'string')
  assert.ok(expression, 'the 5xx alarm is not metric math, so it is a COUNT and not a RATE')
  assert.match(expression.Expression, /\/\s*requests/, 'the expression does not divide by requests')

  const metricNames = metrics
    .filter((m) => m.MetricStat)
    .map((m) => m.MetricStat.Metric.MetricName)
    .sort()
  assert.deepEqual(
    metricNames,
    ['HTTPCode_ELB_5XX_Count', 'HTTPCode_Target_5XX_Count', 'RequestCount'],
    'both 5xx families must be in the numerator: the TARGET one is the plane answering 500 and ' +
      'the ELB one is the load balancer answering when the plane did not. Watching one misses ' +
      'the whole of the other failure mode',
  )
  assert.equal(props.Threshold, 1, 'the rate threshold moved; the derivation is in lib/config.ts')
  assert.equal(props.EvaluationPeriods, 3)
  assert.equal(props.DatapointsToAlarm, 2)
  assert.equal(
    props.TreatMissingData,
    'notBreaching',
    'an idle ALB emits no RequestCount, and "nobody called" is not "the product is broken"',
  )
})

test('test_the_latency_alarm_is_p99_at_half_the_declared_health_check_timeout', () => {
  const props = alarmNamed('reconcile-staging-data-alb-p99-latency')
  assert.equal(props.ExtendedStatistic ?? props.Statistic, 'p99', 'p99, not average')
  assert.equal(props.MetricName, 'TargetResponseTime')
  /* 2.5 is HALF of the 5-second timeout `lib/planes-stack.ts` gives the data
   * target group. At the full timeout the ALB is already failing the liveness
   * probe, so an alarm there fires when the availability alarm does and adds
   * nothing. The 5 is asserted against the planes template below so the two
   * cannot drift apart silently. */
  assert.equal(props.Threshold, 2.5)

  const healthCheckTimeouts = resourcesOfType(stack(PLANES), 'AWS::ElasticLoadBalancingV2::TargetGroup')
    .map(([, r]) => r.Properties?.HealthCheckTimeoutSeconds)
    .filter((v) => v !== undefined)
  assert.ok(
    healthCheckTimeouts.includes(5),
    'no target group declares a 5-second health-check timeout any more, so the latency ' +
      `threshold's derivation is dead: ${JSON.stringify(healthCheckTimeouts)}`,
  )
})

test('test_the_service_shortfall_alarms_are_metric_math_and_never_a_static_count', () => {
  /* 🛑 THE LOAD-BEARING ASSERTION IN THIS SECTION. `ECS_SCALE_DOWN_CRON` takes
   * both services to desiredCount 0 every weekday evening, so a static
   * `RunningTaskCount < 1` would page nightly for a condition somebody
   * scheduled — and a pager that fires nightly for a non-event is muted before
   * it catches anything. The difference must be against DesiredTaskCount. */
  for (const plane of ['data', 'control']) {
    const props = alarmNamed(`reconcile-staging-${plane}-plane-running-below-desired`)
    const metrics = props.Metrics ?? []
    const expression = metrics.find((m) => typeof m.Expression === 'string')
    assert.ok(
      expression,
      `the ${plane} shortfall alarm is a plain metric, so it is a STATIC count and it will ` +
        'page every weekday evening when the schedule takes desired to zero',
    )
    assert.match(expression.Expression, /desired\s*-\s*running/)

    const used = metrics
      .filter((m) => m.MetricStat)
      .map((m) => `${m.MetricStat.Metric.Namespace}/${m.MetricStat.Metric.MetricName}`)
      .sort()
    assert.deepEqual(used, [
      'ECS/ContainerInsights/DesiredTaskCount',
      'ECS/ContainerInsights/RunningTaskCount',
    ])

    /* Ten consecutive minutes, because minHealthyPercent is 50 on a one-task
     * service — see the next test, which measures that rather than trusting
     * this comment. */
    assert.equal(props.EvaluationPeriods, 10)
    assert.equal(props.DatapointsToAlarm, 10)
  }
})

test('test_the_shortfall_window_is_wider_than_a_legitimate_deployment_can_be', () => {
  /* 🛑 THIS IS THE ASSERTION `cdk synth` WROTE. The first draft of the alarm
   * asked for THREE consecutive minutes; the synth printed "minHealthyPercent
   * has not been configured so the default value of 50% is used" against both
   * services, and floor(0.5 x 1) is ZERO — so an ordinary deployment is
   * ENTITLED to take a one-task service to zero running while desired stays
   * one, and a three-minute alarm would have paged on every pipeline run.
   *
   * If somebody sets minHealthyPercent to 100 in `Planes`, this test goes red
   * and the window can be tightened. That is the correct order. */
  const services = resourcesOfType(stack(PLANES), 'AWS::ECS::Service')
  assert.ok(services.length > 0, 'no ECS service in the planes template; this read nothing')
  for (const [logicalId, service] of services) {
    const config = service.Properties?.DeploymentConfiguration ?? {}
    assert.equal(
      config.MinimumHealthyPercent,
      50,
      `${logicalId} no longer permits a deployment to reach zero running tasks. The shortfall ` +
        'alarm may now be tightened below ten minutes — and this assertion re-argued',
    )
    /* ⚠️ THIS WAS `DesiredCount, 1` FOR BOTH SERVICES UNTIL R-POOL (G2264).
     * The data service is two tasks on staging now, and the shortfall window
     * is deliberately NOT tightened — the control service is still one task,
     * and a two-task deploy still runs one short while a task is replaced. */
    const expected = service.Properties?.ServiceName === 'reconcile-staging-data-plane' ? 2 : 1
    assert.equal(service.Properties?.DesiredCount, expected, `${logicalId}'s DesiredCount`)
  }
})

test('test_the_aurora_alarms_are_keyed_on_the_cluster_identifiers_data_stack_declares', () => {
  const declared = resourcesOfType(stack(DATA), 'AWS::RDS::DBCluster')
    .map(([, r]) => r.Properties?.DBClusterIdentifier)
    .sort()
  assert.deepEqual(declared, ['reconcile-staging-control', 'reconcile-staging-data'])

  for (const plane of ['data', 'control']) {
    const acu = alarmNamed(`reconcile-staging-${plane}-aurora-acu-at-ceiling`)
    assert.equal(acu.MetricName, 'ServerlessDatabaseCapacity')
    assert.deepEqual(acu.Dimensions, [
      { Name: 'DBClusterIdentifier', Value: `reconcile-staging-${plane}` },
    ])
    /* One 0.5 ACU scaling step below the declared maximum of 2. A cluster
     * inside the last step cannot scale out of the condition. */
    assert.equal(acu.Threshold, 1.5)

    const conns = alarmNamed(`reconcile-staging-${plane}-aurora-connections`)
    assert.equal(conns.MetricName, 'DatabaseConnections')
    assert.equal(conns.Statistic, 'Maximum', 'a leak present for part of a period is present')
    /* ⚠️ THIS WAS 40 FOR BOTH CLUSTERS UNTIL R-POOL (G2265) — *"(1 serving
     * task + 1 migrate) x pool of 10 x 2 for a rolling deploy"* — and is now
     * PER CLUSTER, typed here rather than read from `lib/config.ts`, because
     * comparing a stack to the constant the stack read proves only that a
     * variable equals itself.
     *   data     225 — the design ceiling, half the 450 engine estimate; the
     *            budget was sized so nothing legitimate reaches it (210).
     *   control   76 — 2 x (1 x 10 control pool + 2 x 4 control-read pools)
     *            + 2 migrate = 38 legitimate, x2. */
    assert.equal(conns.Threshold, plane === 'data' ? 225 : 76)
  }
})

test('test_the_declared_aurora_maximum_is_still_the_two_this_threshold_was_derived_from', () => {
  /* The ACU threshold is "one scaling step below the ceiling". If the ceiling
   * moves and the threshold does not, the alarm silently stops meaning that. */
  const maxima = resourcesOfType(stack(DATA), 'AWS::RDS::DBCluster')
    .map(([, r]) => r.Properties?.ServerlessV2ScalingConfiguration?.MaxCapacity)
    .filter((v) => v !== undefined)
  assert.ok(maxima.length > 0, 'no serverless scaling configuration found; this read nothing')
  for (const max of maxima) {
    assert.equal(
      max,
      2,
      'the Aurora ACU ceiling moved and the alarm threshold did not. The threshold is ' +
        'ceiling minus one 0.5 step; re-derive it in lib/config.ts',
    )
  }
})

// -------------------------- 4. the metric only exists because of another stack

test('test_container_insights_is_still_enabled_or_two_alarms_read_a_metric_nobody_publishes', () => {
  /* 🛑 THE CROSS-STACK ASSERTION, AND IT IS THIS SUITE'S OWN THESIS APPLIED TO
   * ITSELF. `AWS/ECS` carries CPU and memory and NO task counts;
   * `RunningTaskCount` and `DesiredTaskCount` come from Container Insights,
   * which `lib/planes-stack.ts` switches on. Turn that off and the two
   * shortfall alarms above sit forever on a metric that is never published —
   * an alarm that CANNOT fire, reading green. */
  const clusters = resourcesOfType(stack(PLANES), 'AWS::ECS::Cluster')
  assert.equal(clusters.length, 1, 'expected exactly one ECS cluster')
  const settings = clusters[0][1].Properties?.ClusterSettings ?? []
  const insights = settings.find((s) => s.Name === 'containerInsights')
  assert.ok(
    insights,
    'the cluster declares no containerInsights setting, so ECS/ContainerInsights metrics are ' +
      'not published and the two shortfall alarms can never fire',
  )
  assert.notEqual(
    String(insights.Value).toLowerCase(),
    'disabled',
    'Container Insights is DISABLED. The two running-below-desired alarms now read a metric ' +
      'nobody publishes, which is green by unavailability — the exact failure this stack exists ' +
      'to prevent',
  )
})

// ------------------------------------- 5. what CloudWatch has no metric for

test('test_the_six_event_rules_exist_and_are_rules_rather_than_alarms', () => {
  /* G1064: a task restart and a migration's exit code are NOT CloudWatch
   * metrics — there is no restart counter and no exit-code metric anywhere —
   * so these rows are delivered as EventBridge rules and are called rules. */
  const names = resourcesOfType(stack(STACK), RULE)
    .map(([, r]) => r.Properties?.Name)
    .sort()
  assert.deepEqual(names, [
    'reconcile-staging-migrate-task-did-not-run',
    'reconcile-staging-migrate-task-failed',
    'reconcile-staging-pipeline-stage-failed',
    /* G4403/G4404, 5 Oct 2026 — the run worker's two, on the migrate pair's shape. */
    'reconcile-staging-run-worker-task-did-not-run',
    'reconcile-staging-run-worker-task-failed',
    'reconcile-staging-serving-task-crashed',
  ])
})

test('test_a_migrate_task_that_never_started_is_caught_by_its_own_rule', () => {
  /* 🛑 THE RULE THAT IS EASY TO OMIT AND IS THE WHOLE POINT OF HAVING TWO.
   *
   * An image the fleet cannot pull, a subnet with no route, a secret the task
   * role cannot read: every one stops the task with stopCode TaskFailedToStart
   * and NO containers[].exitCode at all. The exit-code rule matches NOTHING,
   * and a forward-only migration fails in silence — green by unavailability,
   * arriving inside the control built to prevent it. */
  const exitCodeRule = ruleNamed('reconcile-staging-migrate-task-failed')
  assert.deepEqual(exitCodeRule.EventPattern.detail.containers, {
    exitCode: [{ 'anything-but': 0 }],
  })

  const didNotRun = ruleNamed('reconcile-staging-migrate-task-did-not-run')
  assert.deepEqual(
    didNotRun.EventPattern.detail.stopCode,
    [{ 'anything-but': ['EssentialContainerExited'] }],
    'the second migrate rule must be the COMPLEMENT of the one success shape, not a second ' +
      'exit-code test: a task that never ran has no exit code',
  )
  assert.equal(
    didNotRun.EventPattern.detail.containers,
    undefined,
    'this rule must NOT require a container exit code; requiring one is exactly the hole it ' +
      'exists to close',
  )

  for (const rule of [exitCodeRule, didNotRun]) {
    assert.deepEqual(rule.EventPattern.source, ['aws.ecs'])
    assert.deepEqual(rule.EventPattern['detail-type'], ['ECS Task State Change'])
    assert.deepEqual(rule.EventPattern.detail.lastStatus, ['STOPPED'])
    assert.ok(
      rule.EventPattern.detail.clusterArn,
      'a rule with no cluster term matches task events from every cluster in the account',
    )
    const groups = JSON.stringify(rule.EventPattern.detail.group)
    assert.ok(groups.includes('family:'), `the migrate rules key on a run-task group: ${groups}`)
  }
})

test('test_the_serving_crash_rule_excludes_the_scheduled_scale_down', () => {
  /* Both terms, and neither is optional. EssentialContainerExited means the
   * container stopped ON ITS OWN, which excludes ServiceSchedulerInitiated —
   * and a nightly page for the scheduled scale-down is how a pager gets muted. */
  const rule = ruleNamed('reconcile-staging-serving-task-crashed')
  assert.deepEqual(
    rule.EventPattern.detail.stopCode,
    ['EssentialContainerExited'],
    'without this term the rule fires on every scheduled scale-down and every deployment',
  )
  assert.deepEqual(rule.EventPattern.detail.containers, { exitCode: [{ 'anything-but': 0 }] })
  assert.ok(JSON.stringify(rule.EventPattern.detail.group).includes('service:'))
})

test('test_the_pipeline_rule_watches_the_STAGE_and_not_the_execution', () => {
  /* The stage, deliberately: Source, Gate, Build, Migrate and Deploy failing
   * are five different incidents, and a pipeline-level event names none of
   * them. */
  const rule = ruleNamed('reconcile-staging-pipeline-stage-failed')
  assert.deepEqual(rule.EventPattern.source, ['aws.codepipeline'])
  assert.deepEqual(rule.EventPattern['detail-type'], ['CodePipeline Stage Execution State Change'])
  assert.deepEqual(rule.EventPattern.detail.state, ['FAILED'])
  assert.deepEqual(rule.EventPattern.detail.pipeline, ['reconcile-staging'])

  const declared = resourcesOfType(stack('reconcile-pipeline-staging'), 'AWS::CodePipeline::Pipeline')
  assert.equal(declared.length, 1)
  assert.equal(
    declared[0][1].Properties?.Name,
    'reconcile-staging',
    'the rule names a pipeline that no longer exists under that name, so it matches nothing',
  )
})

// ------------------------------------------------ 6. flow logs and the log

test('test_the_vpc_has_a_flow_log_with_retention_set_in_cdk', () => {
  /* Derived before it was written: `grep -n 'FlowLog' infra/lib/network-stack.ts`
   * returned nothing, so the VPC carried none from the day it was created. */
  const flows = resourcesOfType(stack(STACK), FLOW_LOG)
  assert.equal(flows.length, 1, 'exactly one VPC flow log')
  const props = flows[0][1].Properties
  assert.equal(props.ResourceType, 'VPC')
  assert.equal(
    props.TrafficType,
    'ALL',
    'REJECT-only would answer "who was turned away". The question this product will be asked ' +
      'is the plane-boundary one, and a cross-plane flow that WORKED is an ACCEPT',
  )

  const groups = resourcesOfType(stack(STACK), LOG_GROUP)
  assert.equal(groups.length, 1)
  assert.equal(groups[0][1].Properties?.LogGroupName, '/reconcile/staging/vpc-flow-logs')
  assert.equal(
    groups[0][1].Properties?.RetentionInDays,
    14,
    'G261 sets retention in CDK; a log group with no retention keeps bytes for ever',
  )
})

test('test_no_other_stack_declares_a_flow_log_so_there_is_one_home_for_it', () => {
  const elsewhere = Object.entries(templates())
    .filter(([name]) => name !== STACK)
    .flatMap(([name, template]) =>
      resourcesOfType(template, FLOW_LOG).map(([logicalId]) => `${name}/${logicalId}`),
    )
  assert.deepEqual(elsewhere, [])
  assert.ok(stack(NETWORK).Resources, 'the network template must still synthesise')
})

test('test_both_aurora_clusters_export_the_postgresql_log', () => {
  const clusters = resourcesOfType(stack(DATA), 'AWS::RDS::DBCluster')
  assert.equal(clusters.length, 2)
  const exporting = clusters.filter(([, r]) =>
    (r.Properties?.EnableCloudwatchLogsExports ?? []).includes('postgresql'),
  )
  assert.equal(
    exporting.length,
    2,
    `no Aurora cluster exports its postgresql log: ${exporting.length} of 2. An alarm on 5xx ` +
      'with no database log to explain one is a pager without a diagnosis',
  )
})

test('test_the_log_export_ships_with_the_four_parameters_that_keep_a_payload_out_of_it', () => {
  /* 🛑 THE FENCE AND THE WRITER ARE ONE COMMIT OR NEITHER — G511's rule
   * applied to a log, and G1065.
   *
   * G261 section 12.1: "A log line carries identifiers, codes, counts and
   * durations. It never carries a payload field value, counterparty text, a
   * document body, a header value or a query string." A PostgreSQL log can
   * carry every one of those, and whether it does is decided by four
   * parameters. The load-bearing one is log_parameter_max_length_on_error:
   * every query in server/ binds its values, so the statement text carries $1
   * and NOT the value — unless that parameter is non-zero, at which point the
   * bound values are written beside the statement on every error. Invariant 4
   * and invariant 6, both, decided by a default nobody in this repository
   * owned. */
  const groups = resourcesOfType(stack(DATA), 'AWS::RDS::DBClusterParameterGroup')
  assert.ok(
    groups.length > 0,
    'the postgresql log is exported to CloudWatch and NO parameter group pins what may appear ' +
      'in it. That makes invariant 4 and invariant 6 a property of the console',
  )
  for (const [logicalId, group] of groups) {
    const params = group.Properties?.Parameters ?? {}
    assert.equal(params.log_statement, 'none', `${logicalId}: every statement would be logged`)
    assert.equal(
      params.log_parameter_max_length_on_error,
      '0',
      `${logicalId}: THE LOAD-BEARING ONE. Non-zero writes every bound parameter value beside ` +
        'the statement on every error — counterparty amounts, references and names in a log ' +
        'nothing classified',
    )
    assert.equal(params.log_parameter_max_length, '0', `${logicalId}: the same for slow queries`)
    assert.equal(params.log_min_error_statement, 'error', `${logicalId}: pinned at the default`)
  }

  const attached = resourcesOfType(stack(DATA), 'AWS::RDS::DBCluster').filter(
    ([, r]) => r.Properties?.DBClusterParameterGroupName !== undefined,
  )
  assert.equal(
    attached.length,
    2,
    'a parameter group that no cluster references pins nothing at all',
  )
})

// ------------------- 7. the constraint: this stack forces no `Planes` deploy

test('test_this_stack_reads_no_attribute_that_would_mint_a_new_planes_export', () => {
  /* 🛑 READ THIS BEFORE "TIDYING" THE ALB JOIN.
   *
   * `Planes`' stack and the running fleet disagree about which image runs, and
   * the image CloudFormation owns has been EXPIRED OUT OF ECR by the
   * fifty-image lifecycle rule (G1012, G1013). Any change that forces a
   * `cdk deploy` of `Planes` rolls both planes back against a forward-only
   * schema and reports success.
   *
   * CDK mints a cross-stack export PER ATTRIBUTE READ. `loadBalancerFullName`
   * is the obvious way to get the CloudWatch dimension and is exactly that
   * change; the ARN is already exported for `Edge`, so the dimension is
   * derived from it with Fn::Select over Fn::Split instead. */
  const planesJson = JSON.stringify(stack(PLANES))
  assert.equal(
    planesJson.includes('LoadBalancerFullName'),
    false,
    'the Planes template now exports LoadBalancerFullName, which means a Planes DEPLOY. Derive ' +
      'the dimension from the already-exported ARN instead: Fn::Select[1, Fn::Split[loadbalancer/, arn]]',
  )

  const outputs = Object.keys(stack(PLANES).Outputs ?? {}).sort()
  assert.equal(
    outputs.length,
    17,
    'the Planes template gained or lost an output. A NEW one is a Planes deploy, which rolls ' +
      `the fleet back to an image ECR has expired: ${JSON.stringify(outputs)}`,
  )
})

test('test_the_alb_dimension_is_derived_from_the_arn_export_that_already_exists', () => {
  const props = alarmNamed('reconcile-staging-data-alb-5xx-rate')
  const dimension = props.Metrics.find((m) => m.MetricStat).MetricStat.Metric.Dimensions[0]
  assert.equal(dimension.Name, 'LoadBalancer')
  const rendered = JSON.stringify(dimension.Value)
  assert.match(rendered, /"Fn::Split":\s*\[\s*"loadbalancer\/"/)
  assert.match(rendered, /"Fn::ImportValue"/)
  assert.ok(
    rendered.includes('reconcile-planes-staging'),
    `the dimension does not import from the planes stack: ${rendered}`,
  )
})

test('test_the_ecs_alarms_join_by_NAMED_export_rather_than_by_construct_reference', () => {
  /* The named exports PLANES_EXPORT_KEYS already declares and the pipeline
   * already consumes. `Storage`'s precedent: joined by NAME in both
   * directions, so there is no CloudFormation dependency to force a deploy. */
  const props = alarmNamed('reconcile-staging-data-plane-running-below-desired')
  const rendered = JSON.stringify(props.Metrics)
  assert.ok(
    rendered.includes('reconcile-planes-staging-ClusterName'),
    'the cluster dimension must import the NAMED export, not a generated one',
  )
  assert.ok(rendered.includes('reconcile-planes-staging-DataServiceName'))
})

// ------------------------------------------------------- 8. tags, and G260

test('test_every_taggable_resource_in_the_stack_carries_the_six_tags', () => {
  /* The Aspect throws at synth, so a green synth already proves this. The
   * value here is the PLANE assignment below, which the Aspect cannot check. */
  const required = ['Project', 'Environment', 'Plane', 'ManagedBy', 'Owner', 'CostCentre']
  let seen = 0
  for (const [logicalId, resource] of Object.entries(stack(STACK).Resources)) {
    const tags = resource.Properties?.Tags
    if (!Array.isArray(tags)) continue
    seen += 1
    const keys = tags.map((t) => t.Key)
    for (const key of required) {
      assert.ok(keys.includes(key), `${logicalId} is missing the ${key} tag`)
    }
    assert.equal(
      keys.includes('TenantId'),
      false,
      `${logicalId} carries a TenantId tag; G260 forbids one anywhere`,
    )
  }
  assert.ok(seen > 0, 'no tagged resource was read; this assertion read nothing')
})

test('test_an_alarm_about_one_plane_is_tagged_with_that_plane', () => {
  /* G260: "a Plane=control resource with a route to a Plane=data cluster is a
   * finding" — the tag is what makes invariant 3 auditable from a tag query,
   * so an alarm about the control plane must not claim to be about the data
   * one. */
  const planeOf = (alarmName) => {
    const found = alarms().find(([, r]) => r.Properties?.AlarmName === alarmName)
    assert.ok(found, `no alarm named ${alarmName}`)
    return (found[1].Properties.Tags ?? []).find((t) => t.Key === 'Plane')?.Value
  }
  assert.equal(planeOf('reconcile-staging-data-aurora-connections'), 'data')
  assert.equal(planeOf('reconcile-staging-control-aurora-connections'), 'control')
  assert.equal(planeOf('reconcile-staging-data-alb-5xx-rate'), 'data')
})

test('test_no_aws_config_rule_is_declared_because_the_account_has_no_recorder', () => {
  /* ⚠️ G1068, AND IT IS AN ABSENCE ARGUED RATHER THAN A GAP.
   *
   * `lib/tagging.ts` says G260's `required-tags` Config rule "belongs to the
   * Observability stack". It does, and it cannot be built here: a Config rule
   * evaluates NOTHING without an account-wide configuration recorder and
   * delivery channel, and there is none in this account. Declared without one
   * it costs money, reports NOT_APPLICABLE for everything, and reads in the
   * console as though tagging were enforced — §5.6 with a bill. Creating a
   * recorder in a SHARED account is an owner decision with blast radius
   * outside this product.
   *
   * The commit that creates the recorder deletes this assertion.
   *
   * ⛔ R15, 1 Oct 2026, THE OWNER'S (`docs/HANDOFF.md` G2441): "No account-wide
   * AWS Config recorder." The sentence above is kept as it stood; no such
   * commit is owed. This assertion now RECORDS THE DECISION: a Config rule
   * arriving here meets a ruling, not a tripwire awaiting a recorder. */
  const rules = Object.entries(templates()).flatMap(([name, template]) =>
    resourcesOfType(template, 'AWS::Config::ConfigRule').map(([id]) => `${name}/${id}`),
  )
  assert.deepEqual(
    rules,
    [],
    'an AWS Config rule exists. It evaluates nothing without an account-wide configuration ' +
      'recorder, and it LOOKS like enforcement. If a recorder now exists, say so and delete this',
  )
})

// ------------------------- 9. the logger, which G1391 DID do — G1067 discharged

test('test_the_5xx_alarms_have_a_structured_log_and_it_prints_from_an_allow_list', () => {
  /* ⛔ THIS ASSERTION REPLACES A TRIPWIRE THAT PASSED AGAINST THE DEFECT IT
   * GUARDED, AND THE ORIGINAL IS QUOTED RATHER THAN DELETED because it is the
   * sentence four documents pointed at and because its FAILURE MODE is the
   * finding.
   *
   * IT WAS: `assert.match(source, /logger:\s*false/)`, with the note *"THE
   * COMMIT THAT TURNS THE LOGGER ON DELETES THIS TEST, and owes the serializer
   * plus the test G261 names."*
   *
   * 🛑 **IT DID NOT HAVE TO BE DELETED.** Run against the commit that turned the
   * logger on, BEFORE this assertion was touched:
   *
   *     ✔ test_the_planes_still_run_with_the_logger_OFF_which_is_owed_not_done (3.008625ms)
   *     ℹ pass 1   ℹ fail 0
   *
   * `server/http/app.ts` then contained `logger: false` exactly twice, both in
   * PROSE narrating the history, while the live setting read `logger,`. It was
   * run a second time against a deliberately BAD implementation — `logger: true`
   * with a `req` serializer keeping `headers` — and passed there too
   * (`✔ … (0.786ms)`), while `tests/http/log-allow-list.test.ts` failed seven
   * assertions on the same tree.
   *
   * **The old form SPECIFIED THE TRIGGER; this one asks about the CONTRACT, and
   * it reads the AST so that a sentence about `logger: false` cannot satisfy it
   * — comments are not nodes.** `docs/HANDOFF.md` §5.1, inside the control
   * written to keep this slice honest.
   *
   * ⚠️ AND THIS IS THE CHEAP HALF. The property §12.1 states is about BYTES, and
   * it is asserted where bytes exist: `tests/http/log-allow-list.test.ts` drives
   * real requests through a real plane and reads the emitted lines. What this
   * assertion buys is that the `infra/` suite — which owns the ALARMS — goes red
   * if the thing that explains one is switched off from the other side of the
   * tree. */
  const appPath = join(REPO_ROOT, 'server', 'http', 'app.ts')
  const parsed = ts.createSourceFile(
    appPath,
    readFileSync(appPath, 'utf8'),
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS,
  )

  let loggerValues = []
  let importsAllowList = false
  let callsLoggerOptions = false

  const visit = (node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text.endsWith('log-allow-list.ts')
    ) {
      importsAllowList = true
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'loggerOptions'
    ) {
      callsLoggerOptions = true
    }
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'logger'
    ) {
      loggerValues.push(node.initializer.getText(parsed))
    }
    if (ts.isShorthandPropertyAssignment(node) && node.name.text === 'logger') {
      loggerValues.push('<shorthand>')
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(parsed, visit)

  assert.ok(
    loggerValues.length > 0,
    'no `logger` option is passed to Fastify at all. G1067: an alarm on 5xx with no ' +
      'structured log to explain one is a pager without a diagnosis.',
  )
  for (const value of loggerValues) {
    assert.notEqual(
      value,
      'false',
      'the logger is OFF again. G1067 was discharged on 21 Sep 2026 and the eight alarms ' +
        'in this stack have nothing to explain them while it is off.',
    )
    assert.notEqual(
      value,
      'true',
      'the logger is `true`, which is Fastify\'s DEFAULT serializers: `req.url` (the QUERY ' +
        'STRING, forbidden by G261 section 12.1 by name), `req.host` (tenant-identifying ' +
        'under G179/G180) and `err.message`/`err.stack` (a pg error\'s DETAIL is a row ' +
        'value). It must be `loggerOptions()` from server/http/log-allow-list.ts.',
    )
  }
  assert.ok(
    importsAllowList,
    'server/http/app.ts no longer imports server/http/log-allow-list.ts, so whatever it ' +
      'logs is governed by nothing. Section 12.1 is a CONTAINMENT rule enforced by an ' +
      'allow-list serializer, not by review.',
  )
  assert.ok(
    callsLoggerOptions,
    'server/http/app.ts imports the allow-list module and never calls `loggerOptions()`. ' +
      'An import that nothing uses is not a control.',
  )
})
