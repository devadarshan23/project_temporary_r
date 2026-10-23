/**
 * `Observability` — THE TENTH STACK, AND THE ONE OF THE TEN THAT HAD NEVER BEEN
 * WRITTEN. G261, 20 Sep 2026.
 *
 * ⚠️ **THIS FILE SHIPPED EIGHT ALARMS AND NOW SHIPS NINE — G1283, 20 Sep 2026.**
 * The ninth is §4a, on the run queue's DEAD-LETTER QUEUE, and it is the one
 * construct `lib/run-queue-stack.ts` names in its own header rather than taking:
 * *"a dead-letter queue with a growing depth and nothing watching it is a
 * control that reports success by being unread."* Derive the count, never read
 * it: `grep -c "^    alarm('" infra/lib/observability-stack.ts` plus the two
 * the `for` loop builds per plane.
 *
 * Derive the absence this file ends rather than reading it here:
 *
 *   ls infra/lib/*-stack.ts | wc -l     # said 9 until this commit, now 10
 *   grep -rln 'Alarm' infra/lib/        # returned NOTHING until this commit
 *
 * `CLAUDE.md`'s `infra/` entry said in its own voice "🛑 `Observability` IS
 * still NOT WRITTEN", `docs/tech-stack.md` section 10 has listed it since
 * 18 Sep 2026, `lib/tagging.ts` says its Config rule "belongs to the
 * Observability stack and is NOT in this pass", and `lib/data-stack.ts` refuses
 * `cloudwatchLogsExports` on the ground that "G261 owns observability and is
 * not applied". Four files pointed at a file that did not exist.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * 🛑 WHY THIS IS FIRST AMONG THE DEPLOYMENT STEPS, AND IT IS NOT A PREFERENCE.
 *
 * A staging environment people can sign in to and that pages NOBODY is the
 * shape of failure this repository has already produced once: PR #257 merged a
 * trunk whose own body records `npm run check` EXIT 1, because the CI check
 * reported SUCCESS while seven test databases were unreachable and chromium was
 * absent. **A green signal that is green by unavailability.** Every design
 * decision below is aimed at that one failure mode:
 *
 *   · an alarm is attached to a metric that is EMITTED, and where the emission
 *     depends on something another stack switches on, a test asserts the switch
 *     across the stack boundary (Container Insights);
 *   · where CloudWatch has no metric at all, the row is built as an EVENT RULE
 *     and is CALLED one, rather than being dressed as an alarm (G1064);
 *   · where a threshold would be a number nobody argued, the derivation is
 *     written beside the constant in `lib/config.ts` (G1063);
 *   · and — UNTIL 22 Sep 2026 — the topic had NO SUBSCRIPTION, which was
 *     stated here, output by the stack, and pinned by a test — because half a
 *     control presented as a whole one is how this record's own §5.6 gets
 *     written again (G1062). **G1811, THE OWNER'S RULING, ends that: a
 *     PLACEHOLDER address is subscribed, and the section-1 comment below
 *     argues why a placeholder rather than a silent gap.**
 *

 * ───────────────────────────────────────────────────────────────────────────
 * 🛑 THE JOIN TO `Planes` IS THE LOAD-BEARING DESIGN DECISION IN THIS FILE, AND
 * IT IS A CONSTRAINT RATHER THAN A STYLE — G1061.
 *
 * `Planes`' stack and the running fleet disagree about which image runs, and
 * the image CloudFormation owns has been EXPIRED OUT OF ECR by the fifty-image
 * lifecycle rule (G1012, G1013). **Any change that forces a `cdk deploy` of
 * `Planes` inherits that**, so this stack must add NO OUTPUT to that template.
 *
 * CDK creates a cross-stack export per ATTRIBUTE READ, so the rule is: read
 * only attributes that are ALREADY exported, and get everything else by NAME.
 *
 *   · ECS cluster and service names — `Fn.importValue(planesExportName(...))`,
 *     the NAMED exports `PLANES_EXPORT_KEYS` already declares and the pipeline
 *     already consumes. No construct reference at all; `Storage`'s precedent.
 *   · the VPC id — `props.network.vpc`, whose `Ref` export `Data` already
 *     forces. Reading it adds nothing to `Network`.
 *   · the data ALB — `props.dataLoadBalancerArn`, the `Ref` export `Edge`
 *     already forces. 🛑 `loadBalancerFullName` IS A DIFFERENT ATTRIBUTE AND
 *     MUST NOT BE READ: it is `Fn::GetAtt … LoadBalancerFullName`, CDK would
 *     mint a SECOND export for it, and that is a `Planes` deploy. The
 *     CloudWatch dimension is derived from the ARN with template functions
 *     instead — `Fn::Select[1, Fn::Split['loadbalancer/', arn]]` turns
 *     `arn:…:loadbalancer/app/NAME/HEX` into `app/NAME/HEX`, which is exactly
 *     what `LoadBalancerFullName` would have returned.
 *
 * `tests/infra/observability.test.mjs` section 7 asserts both halves: no
 * `LoadBalancerFullName` anywhere in the `Planes` template, and the frozen set
 * of that template's seventeen outputs.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * 🛑 THE CONTROL PLANE'S ALB GETS NO ALARM, AND THAT IS CORRECT RATHER THAN
 * CONVENIENT — G1066.
 *
 * Two reasons, and the second is the stronger. (1) `controlLoadBalancer` is
 * exported by nothing today, so alarming on it WOULD force a `Planes` deploy.
 * (2) More importantly: that ALB's security group has an ingress list of `[]`,
 * measured from AWS on 19 Sep 2026 and recorded in `docs/build/deploy-handoff.md`
 * section 2a — **the control plane is reachable by nothing.** An ALB that
 * receives no request emits no `RequestCount`, no `TargetResponseTime` and no
 * `HTTPCode_*`, so a 5xx-rate alarm there would sit in `INSUFFICIENT_DATA`
 * forever and a latency alarm would read OK forever. **That is the exact
 * failure this stack exists to prevent, and building it anyway would be that
 * failure wearing a control's name.** The control plane's SERVICE is alarmed
 * (task counts are emitted whether or not anybody calls it); its front door is
 * not, and the commit that opens that ingress owes the alarm.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ⚠️ AWS CONFIG'S `required-tags` RULE — G260's SECOND ENFORCEMENT — IS
 * REFUSED HERE AND NAMED RATHER THAN BUILT (G1068).
 *
 * `lib/tagging.ts` says the rule "belongs to the `Observability` stack". It
 * does, and it cannot be built in this one: an AWS Config rule evaluates
 * nothing without an account-wide CONFIGURATION RECORDER and delivery channel,
 * and there is none in `000000000000`. A Config rule declared without one is a
 * resource that costs money, reports `NOT_APPLICABLE` for every resource and
 * **reads in the console as though tagging were enforced** — §5.6 with a bill.
 * Creating an account-wide recorder in a SHARED account (G256) is an owner's
 * decision with blast radius outside this product. **Named, refused, and owed
 * to the owner.** Until then `RequiredTagsAspect` is the only half, exactly as
 * `lib/tagging.ts` already says.
 *
 * ⛔ AND IT IS OWED TO NOBODY NOW — R15, 1 Oct 2026, THE OWNER'S
 * (`docs/HANDOFF.md` G2441): "No account-wide AWS Config recorder." The
 * paragraph above is kept as it stood. NO AWS Config rule exists in this app BY
 * DECISION, and none belongs in this stack; `RequiredTagsAspect` plus its tests
 * is the whole of tag enforcement, not a half awaiting the other.
 */

import { CfnOutput, Duration, Fn, RemovalPolicy, Stack } from 'aws-cdk-lib'
import type { StackProps } from 'aws-cdk-lib'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as events from 'aws-cdk-lib/aws-events'
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as sns from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'

import {
  ALARM_SUBSCRIBER_EMAIL_PLACEHOLDER,
  ALB_5XX_RATE_PERCENT,
  ALB_P99_LATENCY_SECONDS,
  DEMO_INTAKE_DEAD_LETTER_MESSAGE_THRESHOLD,
  DEMO_INTAKE_DELIVERY_FAILED_METRIC,
  DEMO_INTAKE_METRIC_NAMESPACE,
  DEMO_INTAKE_QUEUE_OLDEST_MESSAGE_ALARM_SECONDS,
  FLOW_LOG_RETENTION_DAYS,
  RUN_QUEUE_DEAD_LETTER_MESSAGE_THRESHOLD,
  RUN_QUEUE_MAX_RECEIVE_COUNT,
  RUN_QUEUE_OLDEST_MESSAGE_ALARM_SECONDS,
  ROLE_SECRET_HOLDER_SERVICES,
  ROTATION_FAILURE_ALARM_SUFFIX,
  alarmTopicName,
  auroraAcuCeilingThreshold,
  auroraClusterIdentifier,
  auroraConnectionAlarmThreshold,
  planesExportName,
  demoIntakeDeadLetterQueueName,
  demoIntakeQueueName,
  masterRotationFunctionName,
  roleRotationFunctionName,
  runQueueDeadLetterName,
  runQueueName,
  runWorkerTaskFamily,
} from './config.ts'
import type { Environment, Plane } from './config.ts'
import type { NetworkStack } from './network-stack.ts'
import { applyRequiredTags } from './tagging.ts'

export interface ObservabilityStackProps extends StackProps {
  readonly environment: Environment
  /**
   * The `Network` stack, for the VPC the flow log is attached to. Passed by
   * construct reference so `tsc` checks the join — and only `vpc.vpcId` is
   * ever read from it, which `Data` already exports.
   */
  readonly network: NetworkStack
  /**
   * The DATA plane's ALB ARN — `planes.loadBalancer.loadBalancerArn`.
   *
   * 🛑 AN ARN AND NOT A CONSTRUCT, AND NOT `loadBalancerFullName`. Read the
   * header: this is the one attribute of that load balancer which `Edge`
   * already forces `Planes` to export, so consuming it here costs no new
   * output and therefore no `Planes` deploy.
   */
  readonly dataLoadBalancerArn: string
}

/** The name of the pipeline whose stage failures page. `lib/pipeline-stack.ts`. */
const pipelineName = (environment: Environment): string => `reconcile-${environment}`

export class ObservabilityStack extends Stack {
  /** G261: ONE topic per environment. Every alarm and every rule points here. */
  readonly alarmTopic: sns.Topic

  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props)

    const { environment, network, dataLoadBalancerArn } = props

    /**
     * ───────────────────────────────────────────────────────────── 1. the topic
     *
     * ⚠️ **THIS SECTION READ *"IT HAS NO SUBSCRIPTION AND AN UNSUBSCRIBED TOPIC
     * PAGES NOBODY … WHO IS PAGED AND AT WHAT ADDRESS IS AN OWNER'S RULING and
     * it is not this slice's to take"* UNTIL 22 Sep 2026 AND IS CORRECTED
     * RATHER THAN DELETED, because it is the sentence
     * `tests/infra/observability.test.mjs` section 2 was armed on and the one
     * a reader would have quoted onward.**
     *
     * **G1811, THE OWNER'S RULING, 22 Sep 2026: *"Use a placeholder email
     * address that must be replaced before production."*** Writing a REAL
     * mailbox into this file would put a person's address in a public
     * repository; writing NOTHING left the control half-built. The ruling
     * takes neither — the topic is subscribed to a PLACEHOLDER address that
     * cannot be mistaken for a real one, carried by
     * `ALARM_SUBSCRIBER_EMAIL_PLACEHOLDER` in `lib/config.ts`.
     *
     * 🛑 **THE PLACEHOLDER MUST BE LOUD RATHER THAN MERELY ABSENT.** A
     * plausible-looking address is one nobody notices is fake — `0` restated
     * for a pager instead of a tag (`TAG_OWNER_PLACEHOLDER`'s own argument).
     * So the address carries the literal marker
     * `PLACEHOLDER-REPLACE-BEFORE-PRODUCTION`, and
     * `tests/infra/observability.test.mjs` asserts the SUBSCRIBED ENDPOINT
     * contains it — not merely that a subscription exists — so deleting the
     * marker without supplying a real address is a red gate, and a real
     * address landing beside the marker by accident is caught the same way.
     *
     * 🛑 **AN UNCONFIRMED EMAIL SUBSCRIPTION DELIVERS NOTHING, PLACEHOLDER OR
     * NOT.** CDK cannot auto-confirm an SNS email subscription — AWS sends a
     * confirmation email to the endpoint and the subscription stays
     * `PendingConfirmation` until somebody clicks the link in it. This
     * placeholder address is not a real inbox, so **this alarm set pages
     * nobody today, exactly as it did with zero subscriptions** — the
     * difference this commit buys is that the NEXT commit to point this at a
     * real mailbox needs one click to go from record to pager, rather than
     * needing code.
     *
     * ⚠️ THE PREVIOUS COMMIT'S ASSERTION OF ZERO SUBSCRIPTIONS IS DELETED IN
     * THE SAME COMMIT AS THIS ONE, DELIBERATELY — `tests/infra/
     * observability.test.mjs` said the subscribing commit must delete it and
     * argue for it, which is this record's own idiom for an absence that
     * turns into a decision rather than an oversight.
     *
     * ⚠️ NO `masterKey`. An SNS topic encrypted with a customer-managed KMS key
     * is the better posture and it is a SECOND decision with a cost: CloudWatch
     * and EventBridge both need `kms:GenerateDataKey*` on that key, and G287
     * and G290's key work is the part of this app that has failed in
     * CloudFormation most often (traps 9 and 10). Alarm payloads carry a metric
     * name, a threshold and a state — no tenant data of any kind — so this is a
     * named deferral rather than a silent one.
     */
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: alarmTopicName(environment),
      displayName: `reconcile ${environment} alarms`,
    })
    applyRequiredTags(this.alarmTopic, environment, 'shared')

    /**
     * ONE subscription, email protocol, to the placeholder address above.
     * No Lambda, no webhook, no second delivery path — G1811 asked for a
     * placeholder subscriber, not a notification pipeline.
     */
    new sns.Subscription(this, 'AlarmTopicPlaceholderSubscription', {
      topic: this.alarmTopic,
      protocol: sns.SubscriptionProtocol.EMAIL,
      endpoint: ALARM_SUBSCRIBER_EMAIL_PLACEHOLDER,
    })

    const paging = new cloudwatchActions.SnsAction(this.alarmTopic)

    /**
     * Build an alarm, point it at the topic, and tag it with the plane it is
     * about. One helper so that "every alarm reaches the one topic" is a
     * property of this file rather than of eleven call sites that each
     * remembered.
     */
    const alarm = (
      logicalId: string,
      plane: Plane,
      options: {
        readonly alarmName: string
        readonly alarmDescription: string
        readonly metric: cloudwatch.IMetric
        readonly threshold: number
        readonly evaluationPeriods: number
        readonly datapointsToAlarm: number
        readonly treatMissingData: cloudwatch.TreatMissingData
        readonly comparisonOperator?: cloudwatch.ComparisonOperator
      },
    ): cloudwatch.Alarm => {
      const built = new cloudwatch.Alarm(this, logicalId, {
        alarmName: options.alarmName,
        alarmDescription: options.alarmDescription,
        metric: options.metric,
        threshold: options.threshold,
        evaluationPeriods: options.evaluationPeriods,
        datapointsToAlarm: options.datapointsToAlarm,
        treatMissingData: options.treatMissingData,
        comparisonOperator:
          options.comparisonOperator ??
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      })
      built.addAlarmAction(paging)
      applyRequiredTags(built, environment, plane)
      return built
    }

    /**
     * ────────────────────────────────────────────── 2. the data plane's ALB
     *
     * The CloudWatch dimension `LoadBalancer` is the ALB's FULL NAME —
     * `app/<name>/<hex>` — and the hex suffix is generated by AWS, so it cannot
     * be spelled here at any price. It is DERIVED from the ARN with two
     * template functions rather than read from the `LoadBalancerFullName`
     * attribute, because reading that attribute is a new export on `Planes` and
     * therefore a `Planes` deploy. See the header.
     */
    const dataAlbFullName = Fn.select(1, Fn.split('loadbalancer/', dataLoadBalancerArn))

    const albMetric = (metricName: string, statistic: string): cloudwatch.Metric =>
      new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName,
        dimensionsMap: { LoadBalancer: dataAlbFullName },
        statistic,
        period: Duration.minutes(5),
      })

    /**
     * 🛑 A RATE, NOT A COUNT, AND BOTH 5xx FAMILIES IN THE NUMERATOR.
     *
     * `HTTPCode_Target_5XX_Count` is the PLANE answering 500 —
     * `server/http/app.ts`'s one `upstream_unavailable` arm.
     * `HTTPCode_ELB_5XX_Count` is the LOAD BALANCER answering when the plane
     * did not: no healthy target, a connection timeout, a target that closed.
     * **A dashboard that watches one of the two misses the whole of the other
     * failure mode**, and the second is the one a deploy produces.
     *
     * The threshold's derivation is on `ALB_5XX_RATE_PERCENT` in
     * `lib/config.ts`: the expected rate is ZERO, and 1 percent across two of
     * three five-minute windows is what separates a fault from a draining
     * target during a rolling deploy.
     *
     * ⚠️ `NOT_BREACHING` ON MISSING DATA IS A DELIBERATE CHOICE AND IT IS NOT
     * THE SAME CHOICE AS ON THE SERVICE ALARMS BELOW. An idle staging ALB
     * emits no `RequestCount`, so the expression yields no datapoint — and
     * "nobody made a request" is not "the product is broken". The alarm that
     * covers the case where the fleet has genuinely gone is the running-count
     * one, which reads a metric the SERVICE emits whether or not anybody calls
     * it.
     */
    alarm('DataAlbFiveXxRate', 'data', {
      alarmName: `reconcile-${environment}-data-alb-5xx-rate`,
      alarmDescription:
        'The data ALB is answering 5xx for at least ' +
        `${ALB_5XX_RATE_PERCENT}% of requests. Expected rate is zero: a refusal is 401, 403 or 409, ` +
        'and 5xx is reserved for one unhandled-failure arm in server/http/app.ts.',
      metric: new cloudwatch.MathExpression({
        expression: '100 * (elb5xx + target5xx) / requests',
        usingMetrics: {
          elb5xx: albMetric('HTTPCode_ELB_5XX_Count', 'Sum'),
          target5xx: albMetric('HTTPCode_Target_5XX_Count', 'Sum'),
          requests: albMetric('RequestCount', 'Sum'),
        },
        label: 'data ALB 5xx percent of requests',
        period: Duration.minutes(5),
      }),
      threshold: ALB_5XX_RATE_PERCENT,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    })

    /**
     * p99 latency, thresholded at HALF the target group's own health-check
     * timeout — the derivation is on `ALB_P99_LATENCY_SECONDS`.
     *
     * At the FULL timeout the ALB is already failing the liveness probe and is
     * about to remove the task, so an alarm set there would fire at the same
     * moment the availability alarm does. Half of it is the last point at which
     * the fleet is up and the number is still about latency.
     */
    alarm('DataAlbP99Latency', 'data', {
      alarmName: `reconcile-${environment}-data-alb-p99-latency`,
      alarmDescription:
        `p99 TargetResponseTime is at or above ${ALB_P99_LATENCY_SECONDS}s, which is half the ` +
        'health-check timeout the target group applies. Past the full timeout the ALB starts ' +
        'removing tasks and this stops being a latency signal.',
      metric: albMetric('TargetResponseTime', 'p99'),
      threshold: ALB_P99_LATENCY_SECONDS,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    })

    /**
     * ────────────────────────────────── 3. the two services, by NAMED export
     *
     * 🛑 THESE METRICS EXIST ONLY BECAUSE CONTAINER INSIGHTS IS ON, AND THAT
     * SWITCH IS IN ANOTHER STACK. `AWS/ECS` carries CPU and memory and NO task
     * counts; `RunningTaskCount` and `DesiredTaskCount` are
     * `ECS/ContainerInsights`, which `lib/planes-stack.ts` enables with
     * `containerInsightsV2: ecs.ContainerInsights.ENABLED`. **Somebody turning
     * that off would leave these two alarms reading a metric that is never
     * published — an alarm that can never fire, which is precisely this
     * stack's own thesis turned against it.**
     * `tests/infra/observability.test.mjs` section 4 asserts the setting across
     * the stack boundary, so the switch and the alarm cannot drift apart
     * silently.
     */
    const clusterName = Fn.importValue(planesExportName(environment, 'ClusterName'))

    const serviceMetric = (
      metricName: string,
      serviceName: string,
      statistic: string,
    ): cloudwatch.Metric =>
      new cloudwatch.Metric({
        namespace: 'ECS/ContainerInsights',
        metricName,
        dimensionsMap: { ClusterName: clusterName, ServiceName: serviceName },
        statistic,
        period: Duration.minutes(1),
      })

    /**
     * 🛑 THE SHORTFALL IS METRIC MATH AND MUST NOT BE A STATIC THRESHOLD, AND
     * THE REASON IS THE SHUTDOWN SCHEDULE.
     *
     * `ECS_SCALE_DOWN_CRON` takes both services to `desiredCount: 0` every
     * weekday evening. A static `RunningTaskCount < 1` would therefore page
     * every night at 19:55 SGT, for a condition somebody scheduled — and a
     * pager that fires nightly for a non-event is a pager that is muted before
     * it ever catches a real one. `DesiredTaskCount - RunningTaskCount` is 0
     * across the whole shutdown window and is only positive when the fleet is
     * short of what somebody asked for.
     *
     * The statistics are chosen for the WORST case within the minute —
     * `Maximum` desired against `Minimum` running — so a shortfall inside a
     * period cannot be averaged away.
     *
     * 🛑 TEN CONSECUTIVE MINUTES, AND THE NUMBER IS A MEASUREMENT RATHER THAN
     * A GUESS — IT IS THE ONE THRESHOLD IN THIS FILE `cdk synth` ITSELF
     * CORRECTED. The first draft asked for THREE consecutive minutes; the
     * synth that built it printed *"minHealthyPercent has not been configured
     * so the default value of 50% is used"* against BOTH services, and the
     * synthesised `Planes` template confirms it:
     * `DesiredCount: 1, MinimumHealthyPercent: 50`. **`floor(0.5 x 1)` is
     * ZERO, so a perfectly ordinary deployment is entitled to take this
     * service to zero running tasks while desired stays one** — and a
     * three-minute alarm would have paged on every pipeline run, which is how
     * a pager gets muted before it ever catches anything.
     *
     * The declared cost of one legitimate replacement is
     * `healthyThresholdCount x interval` = **60 s** of passing checks plus a
     * 30 s `deregistrationDelay` — the only parts of it this repository writes
     * down; image pull and process boot are declared nowhere. Ten minutes is
     * more than six times the declared budget, so a shortfall that survives it
     * is not a deployment in progress. **It can be tightened the day somebody
     * measures a real replacement**, and it must not be tightened before then.
     *
     * ⚠️ SETTING `minHealthyPercent: 100` WOULD BE THE BETTER FIX AND IS
     * REFUSED HERE: it is a `Planes` change, and a `Planes` deploy is the one
     * act this slice may not force (G1012). Reported, not done.
     *
     * ⚠️ R-POOL (G2266, 1 Oct 2026) MOVED THE DATA SERVICE TO TWO TASKS AND
     * THE WINDOW IS DELIBERATELY NOT TIGHTENED. At two, `floor(0.5 x 2)` is
     * ONE, so a data-plane deploy no longer reaches zero — but it still runs
     * one short of desired while a task is replaced, which is exactly the
     * shape this alarm counts; and the CONTROL service is still one task, so
     * the reasoning above holds unchanged there. The ten-minute window still
     * exceeds the declared replacement budget for both. Nothing measured a real
     * replacement, so nothing licenses a tighter one.
     *
     * ⚠️ `treatMissingData: MISSING` — the CloudWatch default, which RETAINS
     * the previous state — AND THIS IS THE ONE CHOICE IN THE FILE THAT IS NOT
     * FULLY MEASURED. Whether Container Insights publishes
     * `RunningTaskCount: 0` for a service scaled to zero, or publishes nothing
     * at all, is not knowable from a template and has not been observed on this
     * account. If it publishes nothing, `NOT_BREACHING` would be a nightly lie
     * and `BREACHING` would be a nightly page; `MISSING` is the only one of the
     * three that is wrong in neither direction. **`insufficientDataActions` is
     * therefore deliberately NOT attached**, and attaching it is owed to
     * whoever first watches a real shutdown window — named here rather than
     * left for them to discover.
     */
    const shortfallAlarm = (logicalId: string, plane: 'data' | 'control'): void => {
      const serviceName = Fn.importValue(
        planesExportName(environment, plane === 'data' ? 'DataServiceName' : 'ControlServiceName'),
      )
      alarm(logicalId, plane, {
        alarmName: `reconcile-${environment}-${plane}-plane-running-below-desired`,
        alarmDescription:
          `The ${plane} plane service has run below its own desired count for ten consecutive ` +
          'minutes. The comparison is desired minus running, never a fixed number, because the ' +
          'working-hours schedule takes desired to zero every weekday evening; and ten minutes ' +
          'because minHealthyPercent is 50, so a deployment may legitimately run below desired while ' +
          'tasks are replaced - to zero on a one-task service.',
        metric: new cloudwatch.MathExpression({
          expression: 'desired - running',
          usingMetrics: {
            desired: serviceMetric('DesiredTaskCount', serviceName, 'Maximum'),
            running: serviceMetric('RunningTaskCount', serviceName, 'Minimum'),
          },
          label: `${plane} plane tasks short of desired`,
          period: Duration.minutes(1),
        }),
        threshold: 1,
        evaluationPeriods: 10,
        datapointsToAlarm: 10,
        treatMissingData: cloudwatch.TreatMissingData.MISSING,
      })
    }

    shortfallAlarm('DataServiceRunningBelowDesired', 'data')
    shortfallAlarm('ControlServiceRunningBelowDesired', 'control')

    /**
     * ────────────────────────────────────────────────── 4. the two clusters
     *
     * Joined by IDENTIFIER, not by construct reference: `lib/data-stack.ts`
     * spells `reconcile-<environment>-<plane>` from the environment name alone,
     * so `auroraClusterIdentifier()` reproduces it with no cross-stack
     * dependency of any kind. `Data` is not forced to deploy by anything here.
     */
    const rdsMetric = (
      metricName: string,
      plane: 'data' | 'control',
      statistic: string,
    ): cloudwatch.Metric =>
      new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName,
        dimensionsMap: { DBClusterIdentifier: auroraClusterIdentifier(environment, plane) },
        statistic,
        period: Duration.minutes(5),
      })

    for (const plane of ['data', 'control'] as const) {
      const titled = plane === 'data' ? 'Data' : 'Control'

      /**
       * ACU at the ceiling, expressed as "less than one SCALING STEP of
       * headroom left" rather than as a percentage — the derivation is on
       * `auroraAcuCeilingThreshold()`. A cluster inside the last 0.5 ACU cannot
       * scale out of the condition, which is a fact about the engine.
       *
       * `NOT_BREACHING`: the cluster is STOPPED overnight by
       * `AURORA_STOP_CRON` and publishes no capacity while stopped. A stopped
       * cluster is not a saturated one.
       */
      alarm(`${titled}AuroraAcuAtCeiling`, plane, {
        alarmName: `reconcile-${environment}-${plane}-aurora-acu-at-ceiling`,
        alarmDescription:
          `The ${plane} cluster has averaged within one 0.5 ACU scaling step of its declared ` +
          'maximum for ten minutes, so it cannot scale out of the condition.',
        metric: rdsMetric('ServerlessDatabaseCapacity', plane, 'Average'),
        threshold: auroraAcuCeilingThreshold(),
        evaluationPeriods: 2,
        datapointsToAlarm: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      })

      /**
       * 🛑 A LEAK DETECTOR, NOT A CEILING DETECTOR — the derivation is on
       * `auroraConnectionAlarmThreshold()` and the gap between the threshold
       * and the engine's ceiling is the whole point. This fleet cannot
       * legitimately open a count in that band, so one is a connection leak,
       * visible here long before it is visible at `max_connections` where the
       * first symptom is every request failing at once.
       *
       * `Maximum` rather than `Average`: a leak that is present for part of a
       * period is present.
       */
      alarm(`${titled}AuroraConnections`, plane, {
        alarmName: `reconcile-${environment}-${plane}-aurora-connections`,
        alarmDescription:
          `The ${plane} cluster is holding more connections than this fleet can legitimately ` +
          'open. The threshold is derived per cluster in lib/config.ts (auroraConnectionAlarmThreshold) ' +
          'from the connection budget R-POOL sized, and is half the engine estimate or less, so it ' +
          'reads as a leak or an unbudgeted client rather than as load.',
        metric: rdsMetric('DatabaseConnections', plane, 'Maximum'),
        threshold: auroraConnectionAlarmThreshold(environment, plane),
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      })
    }

    /**
     * ──────────────────────────────── 4a. the run queue's dead-letter queue
     *
     * **G1283, 20 Sep 2026.** `lib/run-queue-stack.ts` names this construct in
     * its own header and deliberately does not take it: *"a dead-letter queue
     * with a growing depth and nothing watching it is a control that reports
     * success by being unread, which is this record's own §5.6. **The alarm
     * belongs in `Observability`**."* This is that construct, and it is the
     * NINTH alarm in a file whose header says eight.
     *
     * 🛑 JOINED BY QUEUE **NAME**, SO IT READS NOTHING FROM `RunQueue` AT ALL —
     * the same shape as the two Aurora blocks above, and for a sharper reason
     * than theirs. The `RunQueue` stack's own header refuses a construct
     * reference into `Planes` because *"an export on `Planes` is a `Planes`
     * deploy"*; taking a construct reference the other way here would put an
     * export on `RunQueue` and add a deploy-order edge to a stack that
     * currently has none in either direction. `runQueueDeadLetterName()` in
     * `lib/config.ts` spells the name from the environment alone, and the SQS
     * metric dimension IS the queue name — no ARN, no generated suffix, nothing
     * to derive with template functions the way the ALB's full name needs.
     *
     * 🛑 THE THRESHOLD IS ONE MESSAGE AND THE DERIVATION IS ON
     * `RUN_QUEUE_DEAD_LETTER_MESSAGE_THRESHOLD` — in short: the tolerance every
     * other alarm here needs has already been spent upstream, because a message
     * only arrives after `RUN_QUEUE_MAX_RECEIVE_COUNT` failed deliveries.
     * Waiting for a second would be waiting for ten more.
     *
     * ⚠️ `ApproximateNumberOfMessagesVisible` WITH `Maximum`, NOT `Average`. A
     * message that was present for part of a period was present — the same
     * argument the Aurora connection alarm makes one block up. And
     * `NumberOfMessagesSent` was considered and refused: it counts ARRIVALS, so
     * it reports zero forever once a message is sitting there, which is the
     * failure mode this stack exists to refuse.
     *
     * ⚠️ `treatMissingData: NOT_BREACHING`. SQS publishes this metric only
     * while a queue has had activity; a queue that has never been written to
     * emits nothing, and "nobody has ever admitted a run" is not "runs are
     * failing".
     *
     * 🛑 **AND IT CANNOT FIRE TODAY, WHICH IS STATED RATHER THAN LEFT TO BE
     * DISCOVERED: NOTHING HOLDS `sqs:ReceiveMessage` IN THIS ACCOUNT.** A
     * message reaches a dead-letter queue by being received and declined
     * `RUN_QUEUE_MAX_RECEIVE_COUNT` times, and `lib/run-queue-stack.ts` §3
     * withholds that permission by name because no worker is deployed. So this
     * alarm's depth is structurally zero until R-B's consume half runs
     * somewhere — **an alarm that cannot fire is exactly this stack's own
     * thesis turned against it**, and it is built anyway for the reason the
     * unsubscribed topic is: the signal must exist before a subscriber or a
     * consumer can be named, and a commit that deploys a worker should find
     * this waiting rather than have to remember it.
     *
     * ✅ **THAT PARAGRAPH WENT FALSE WITH R-W (G1541) AND IS CORRECTED RATHER
     * THAN DELETED — G4402, 5 Oct 2026.** `lib/run-queue-stack.ts` grants
     * `sqs:ReceiveMessage` to the scheduled worker's own role, so this alarm
     * CAN fire, and under the owner's ruling *"every admitted run reaches a
     * terminal status or an alarm"* it is the LATE half of that guarantee;
     * §4b below is the early half.
     */
    alarm('RunQueueDeadLetterNotEmpty', 'data', {
      alarmName: `reconcile-${environment}-run-queue-dead-letter-not-empty`,
      alarmDescription:
        'A run-admitted message could not be read after ' +
        `${RUN_QUEUE_MAX_RECEIVE_COUNT} deliveries and is now in the dead-letter queue. Runs are ` +
        'being ADMITTED and never PROCESSED: the operator saw 201 and the work has not started. ' +
        'The threshold is one message because the retries have already happened.',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/SQS',
        metricName: 'ApproximateNumberOfMessagesVisible',
        dimensionsMap: { QueueName: runQueueDeadLetterName(environment) },
        statistic: 'Maximum',
        period: Duration.minutes(5),
      }),
      threshold: RUN_QUEUE_DEAD_LETTER_MESSAGE_THRESHOLD,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    })

    /**
     * ──────────────────────────── 4b. the run queue's oldest message — G4401
     *
     * 🛑 **THE OWNER'S RULING OF 5 Oct 2026: *"every admitted run reaches a
     * terminal status or an alarm"* (the G211 amendment).** §4a above catches
     * a run whose message was declined `RUN_QUEUE_MAX_RECEIVE_COUNT` times —
     * which, at a 1800-second visibility window, is two and a half HOURS
     * after the operator saw 201. This catches the same stuck run at
     * `2 x RUN_MAX_EXECUTION_SECONDS`, and it catches the case §4a never can:
     * a queue NOBODY is draining (the schedule disabled, the worker image
     * unresolvable), where nothing is ever received and so nothing is ever
     * dead-lettered.
     *
     * ⚠️ JOINED BY QUEUE **NAME**, §4a's shape and for §4a's reason: no
     * construct reference into `RunQueue`, no export on it, no deploy-order
     * edge in either direction.
     *
     * ⚠️ `GreaterThanThreshold` at 3000 with `Maximum` over five minutes, one
     * datapoint: an in-flight message counts toward this metric, so a run
     * executing for its whole ceiling (1500s) plus one poll tick is ~1560s
     * old when it is deleted and never pages. `NOT_BREACHING`, because an idle
     * queue publishes nothing and *nobody admitted a run* is not a fault.
     */
    alarm('RunQueueOldestMessageAge', 'data', {
      alarmName: `reconcile-${environment}-run-queue-oldest-message-age`,
      alarmDescription:
        'An admitted run has waited in the run queue longer than ' +
        `${RUN_QUEUE_OLDEST_MESSAGE_ALARM_SECONDS}s (2 x RUN_MAX_EXECUTION_SECONDS). Either no ` +
        'worker is draining the queue or a run keeps being redelivered without finishing. ' +
        'The operator saw 201 and no terminal status has been written.',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/SQS',
        metricName: 'ApproximateAgeOfOldestMessage',
        dimensionsMap: { QueueName: runQueueName(environment) },
        statistic: 'Maximum',
        period: Duration.minutes(5),
      }),
      threshold: RUN_QUEUE_OLDEST_MESSAGE_ALARM_SECONDS,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    })

    /**
     * ───────────────────────── 5. the things CloudWatch has no metric for
     *
     * 🛑 A TASK RESTART AND A MIGRATION'S EXIT CODE ARE NOT METRICS, SO THESE
     * ARE EVENT RULES AND ARE CALLED EVENT RULES — G1064.
     *
     * `ECS/ContainerInsights` publishes `RunningTaskCount`, `PendingTaskCount`,
     * `DesiredTaskCount`, CPU and memory. **There is no restart counter and no
     * exit-code metric anywhere in CloudWatch**, so there is nothing to
     * threshold. Dressing an EventBridge rule as an "alarm" in the narration
     * would be the same class of claim this stack exists to refuse; the rows
     * `docs/tech-stack.md` section 12 asks for are DELIVERED here, and the
     * mechanism is named accurately.
     *
     * What the rules buy that an alarm would not: they carry the stopped task's
     * reason and container detail into the notification, which is the first
     * thing a responder needs and which no threshold could have supplied.
     */
    const clusterArn = `arn:aws:ecs:${this.region}:${this.account}:cluster/${clusterName}`
    const topicTarget = new eventsTargets.SnsTopic(this.alarmTopic)

    const migrateGroups = [
      Fn.join('', ['family:', Fn.importValue(planesExportName(environment, 'DataMigrateTaskFamily'))]),
      Fn.join('', [
        'family:',
        Fn.importValue(planesExportName(environment, 'ControlMigrateTaskFamily')),
      ]),
    ]

    /**
     * The migrate task exiting non-zero. `db/migrate.ts` runs forward-only
     * under G88, so a failed migration is the one class of failure where the
     * next deploy makes things worse rather than better.
     */
    const migrateFailed = new events.Rule(this, 'MigrateTaskNonZeroExit', {
      ruleName: `reconcile-${environment}-migrate-task-failed`,
      description:
        'A one-shot migrate task stopped with a non-zero container exit code. Migrations are ' +
        'forward-only (G88), so the next deploy does not repair this.',
      eventPattern: {
        source: ['aws.ecs'],
        detailType: ['ECS Task State Change'],
        detail: {
          clusterArn: [clusterArn],
          lastStatus: ['STOPPED'],
          group: migrateGroups,
          containers: { exitCode: [{ 'anything-but': 0 }] },
        },
      },
      targets: [topicTarget],
    })
    applyRequiredTags(migrateFailed, environment, 'shared')

    /**
     * 🛑 THE SECOND MIGRATE RULE IS THE ONE THAT MATTERS AND IT IS EASY TO
     * OMIT: A TASK THAT NEVER RAN HAS NO EXIT CODE.
     *
     * An image the fleet cannot pull, a subnet with no route, a secret the task
     * role cannot read — every one of those stops the task with
     * `stopCode: TaskFailedToStart` and NO `containers[].exitCode` at all, so
     * the rule above matches NOTHING and the migration's failure is silent.
     * That is `green by unavailability` arriving inside the control built to
     * prevent it.
     *
     * The predicate is therefore the complement of the one success shape: a
     * one-shot task that finished cleanly stops with
     * `stopCode: EssentialContainerExited`. **Anything else — failed to start,
     * killed by a person, reclaimed — is a fault for a migration**, and a
     * `UserInitiated` stop of a half-applied forward-only migration is the
     * worst of the three.
     */
    const migrateDidNotRun = new events.Rule(this, 'MigrateTaskStoppedWithoutRunning', {
      ruleName: `reconcile-${environment}-migrate-task-did-not-run`,
      description:
        'A one-shot migrate task stopped for a reason other than its container finishing. A task ' +
        'that failed to start carries no exit code, so the exit-code rule cannot see it.',
      eventPattern: {
        source: ['aws.ecs'],
        detailType: ['ECS Task State Change'],
        detail: {
          clusterArn: [clusterArn],
          lastStatus: ['STOPPED'],
          group: migrateGroups,
          stopCode: [{ 'anything-but': ['EssentialContainerExited'] }],
        },
      },
      targets: [topicTarget],
    })
    applyRequiredTags(migrateDidNotRun, environment, 'shared')

    /**
     * The RUN WORKER's two rules — G4403/G4404, 5 Oct 2026, under the same
     * ruling as §4b. The migrate pair's shape exactly, and for the migrate
     * pair's reason: the exit-code rule cannot see a task that never started,
     * so the second rule is the complement of the one success shape.
     *
     * ⚠️ THE GROUP IS `family:` + `runWorkerTaskFamily()` — a LITERAL spelled
     * from the environment, not an import from `RunQueue`. EventBridge's
     * `RunTask` launches a standalone task, whose group is its family. The
     * cluster term is the data cluster this stack already imports by name.
     *
     * ⚠️ A worker that finds the queue EMPTY exits 0 and matches neither rule;
     * the schedule fires every minute, so a rule that paged on a clean exit
     * would page sixty times an hour.
     */
    const runWorkerGroups = [`family:${runWorkerTaskFamily(environment)}`]

    const runWorkerFailed = new events.Rule(this, 'RunWorkerTaskNonZeroExit', {
      ruleName: `reconcile-${environment}-run-worker-task-failed`,
      description:
        'A run-worker task stopped with a non-zero container exit code. A run it claimed may be ' +
        'left with no terminal status until the message is redelivered.',
      eventPattern: {
        source: ['aws.ecs'],
        detailType: ['ECS Task State Change'],
        detail: {
          clusterArn: [clusterArn],
          lastStatus: ['STOPPED'],
          group: runWorkerGroups,
          containers: { exitCode: [{ 'anything-but': 0 }] },
        },
      },
      targets: [topicTarget],
    })
    applyRequiredTags(runWorkerFailed, environment, 'data')

    const runWorkerDidNotRun = new events.Rule(this, 'RunWorkerTaskStoppedWithoutRunning', {
      ruleName: `reconcile-${environment}-run-worker-task-did-not-run`,
      description:
        'A run-worker task stopped for a reason other than its container finishing, for example ' +
        'it failed to start. Such a task carries no exit code, so the exit-code rule cannot see it.',
      eventPattern: {
        source: ['aws.ecs'],
        detailType: ['ECS Task State Change'],
        detail: {
          clusterArn: [clusterArn],
          lastStatus: ['STOPPED'],
          group: runWorkerGroups,
          stopCode: [{ 'anything-but': ['EssentialContainerExited'] }],
        },
      },
      targets: [topicTarget],
    })
    applyRequiredTags(runWorkerDidNotRun, environment, 'data')

    /**
     * A SERVING task that crashed — this is the "ECS task restarts" row.
     *
     * ⚠️ IT MATCHES ON BOTH TERMS AND NEITHER IS OPTIONAL. `stopCode:
     * EssentialContainerExited` means the container stopped ON ITS OWN, which
     * excludes the scheduled scale-down (`ServiceSchedulerInitiated`) and a
     * deployment replacing a task — and a nightly page for the scale-down is
     * exactly how a pager gets muted. `exitCode` non-zero excludes a clean
     * exit. Together they are "the plane fell over", and nothing else.
     *
     * The running-below-desired alarm above is the OTHER half of this row: a
     * crash LOOP shows there as a sustained shortfall. Neither alone is the
     * row, and both are named rather than one being presented as the whole.
     */
    const servingCrashed = new events.Rule(this, 'ServingTaskCrashed', {
      ruleName: `reconcile-${environment}-serving-task-crashed`,
      description:
        'A serving task stopped because its own container exited non-zero. Scheduled scale-downs ' +
        'and deployment replacements carry a different stop code and are excluded.',
      eventPattern: {
        source: ['aws.ecs'],
        detailType: ['ECS Task State Change'],
        detail: {
          clusterArn: [clusterArn],
          lastStatus: ['STOPPED'],
          group: [
            Fn.join('', [
              'service:',
              Fn.importValue(planesExportName(environment, 'DataServiceName')),
            ]),
            Fn.join('', [
              'service:',
              Fn.importValue(planesExportName(environment, 'ControlServiceName')),
            ]),
          ],
          stopCode: ['EssentialContainerExited'],
          containers: { exitCode: [{ 'anything-but': 0 }] },
        },
      },
      targets: [topicTarget],
    })
    applyRequiredTags(servingCrashed, environment, 'shared')

    /**
     * A pipeline STAGE failing.
     *
     * ⚠️ THE STAGE AND NOT THE EXECUTION, DELIBERATELY. A pipeline-level
     * failure event says the pipeline failed; a stage-level one says WHICH of
     * Source, Gate, Build, Migrate and Deploy failed, and those five have five
     * entirely different responses. G108's Gate failing is a red commit; the
     * Migrate stage failing is a forward-only schema half-applied.
     */
    const pipelineStageFailed = new events.Rule(this, 'PipelineStageFailed', {
      ruleName: `reconcile-${environment}-pipeline-stage-failed`,
      description:
        'A stage of the staging pipeline failed. The stage is named in the event because Source, ' +
        'Gate, Build, Migrate and Deploy failing are five different incidents.',
      eventPattern: {
        source: ['aws.codepipeline'],
        detailType: ['CodePipeline Stage Execution State Change'],
        detail: {
          pipeline: [pipelineName(environment)],
          state: ['FAILED'],
        },
      },
      targets: [topicTarget],
    })
    applyRequiredTags(pipelineStageFailed, environment, 'shared')

    /**
     * ┌─ 🛑 THE DEMO INTAKE's DROPPED LEADS — THE NINTH ALARM, AND THE FIRST ─┐
     * │    ON A METRIC THIS PRODUCT MINTS RATHER THAN ONE AWS PUBLISHES.      │
     * │    G2006, 22 Sep 2026.                                                │
     * │                                                                        │
     * │ **`infra/lambda/demo-intake/index.mjs`'s `handler()` CATCHES**, so a   │
     * │ lead this product failed to deliver to the CRM is a **SUCCESSFUL       │
     * │ INVOCATION** as far as Lambda is concerned: `AWS/Lambda Errors` reads  │
     * │ `0`, `Throttles` reads `0`, the duration is normal. **Every alarm      │
     * │ above this one is on a metric AWS publishes, and not one of them can   │
     * │ see this failure** — so a generic function alarm would sit green while │
     * │ every lead on earth was being discarded.                               │
     * │                                                                        │
     * │ 🛑 **AND G2001 MAKES IT QUIETER, WHICH IS WHY THIS IS NOT OPTIONAL.**  │
     * │ The intake no longer lets the CRM's verdict decide its own answer —    │
     * │ it could not, without publishing referral-code validity to a stranger  │
     * │ — so the VISITOR is told `received` whether the lead landed or not.    │
     * │ **The wire is deliberately silent and this is the entire compensating  │
     * │ control.** Delete it and nothing anywhere knows.                       │
     * │                                                                        │
     * │ ⚠️ **THE METRIC IS PRODUCED BY THE `Amplify` STACK AND THIS REFERENCES │
     * │ NO CONSTRUCT IN IT.** A `cloudwatch.Metric` needs a namespace and a    │
     * │ name, both constants in `lib/config.ts` — so there is no import, no    │
     * │ export and no deploy-order edge in either direction, which is the same │
     * │ arrangement §2 and §3 already use for the ALB and the two services.    │
     * │ **The METRIC FILTER that mints it lives with the LOG GROUP it reads,   │
     * │ in `amplify-stack.ts`**, because a filter built here could be created  │
     * │ by CloudFormation before that group exists.                            │
     * │                                                                        │
     * │ ⚠️ **`NOT_BREACHING` AND NOT `MISSING`, WHICH IS THE OPPOSITE OF THE   │
     * │ RUNNING-BELOW-DESIRED ALARM ABOVE AND IS OPPOSITE FOR A REASON.** A    │
     * │ metric filter that has matched nothing publishes NO DATAPOINT AT ALL,  │
     * │ and on a marketing form that is the NORMAL state for hours at a time;  │
     * │ `MISSING` would make an idle endpoint indistinguishable from a broken  │
     * │ one. It also means this alarm reads OK before `Amplify` is deployed at │
     * │ all, which is honest: there is no endpoint to drop a lead yet.         │
     * │                                                                        │
     * │ ⚠️ **THE THRESHOLD IS ZERO AND IT IS NOT A TUNING KNOB.** One dropped  │
     * │ lead is one person who filled in a form and reached nobody. There is   │
     * │ no volume at which that becomes acceptable, and the endpoint's own     │
     * │ ceiling is five concurrent requests (G1975).                            │
     * │                                                                        │
     * │ ⚠️ **AND IT PAGES NOBODY, LIKE THE OTHER EIGHT** — G1062. The topic    │
     * │ has zero subscriptions; this is a RECORD and not yet a PAGER.          │
     * └────────────────────────────────────────────────────────────────────────┘
     *
     * ⚠️ THE PLANE TAG IS `public` — G1973's sixth member. The demo intake is
     * the marketing plane's, and `data`, `control`, `edge` and `shared` would
     * each be a false statement in the one field G260 says invariant 3 is
     * audited from.
     */
    alarm('DemoIntakeCrmDeliveryFailed', 'public', {
      alarmName: `reconcile-${environment}-demo-intake-crm-delivery-failed`,
      alarmDescription:
        'The demo intake could not deliver a lead to the CRM. The visitor was told "received" ' +
        'either way (G2001) and handler() catches, so AWS/Lambda Errors reads 0 - this metric ' +
        'is the only signal that leads are being dropped. Day one, the likely cause is that ' +
        'the CRM secret has never had put-secret-value run against it (G1971).',
      metric: new cloudwatch.Metric({
        namespace: DEMO_INTAKE_METRIC_NAMESPACE,
        metricName: DEMO_INTAKE_DELIVERY_FAILED_METRIC,
        statistic: 'Sum',
        period: Duration.minutes(5),
      }),
      threshold: 0,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    })

    /**
     * ┌─ 🛑 THE DEMO INTAKE's TWO QUEUE ALARMS — G3761/G3762, 4 Oct 2026,    ─┐
     * │    CLOSING THE TWO RESIDUALS G3686 NAMED.                             │
     * │                                                                        │
     * │ G3681 put the lead on a queue and G3686 named what that opened:        │
     * │ (1) a lead the worker never RECEIVES expired silently at four days —   │
     * │ SQS deletes an expired message WITHOUT dead-lettering it — and (2)     │
     * │ nothing alarmed on the DLQ's DEPTH. That slice kept both out so this   │
     * │ template stayed byte-identical; this is the `Observability` edit it    │
     * │ deferred.                                                              │
     * │                                                                        │
     * │ ⚠️ **JOINED BY QUEUE NAME, LIKE §4a's RUN-QUEUE ALARM**: both names    │
     * │ are spelled from the environment by `lib/config.ts`, so this stack     │
     * │ references no construct in `Amplify`, mints no export and adds no      │
     * │ deploy-order edge. Measured: of the twelve templates only this one and │
     * │ `Amplify` (the retention, G3762) moved.                                │
     * │                                                                        │
     * │ ⚠️ **`NOT_BREACHING`, FOR §4a's AND G2006's REASON**: an idle queue    │
     * │ publishes zeroes or nothing, and nothing is not a fault. A queue that  │
     * │ HOLDS a message counts as active to SQS and keeps publishing, so a     │
     * │ lead sitting in either queue is never hidden behind missing data.      │
     * │                                                                        │
     * │ ⚠️ **AND BOTH PAGE THE PLACEHOLDER (G1811/R14)** — the `alarm()`       │
     * │ helper is the only way an alarm is built here and it points at the    │
     * │ one topic; `tests/infra/observability.test.mjs` §2 asserts it.         │
     * └────────────────────────────────────────────────────────────────────────┘
     *
     * The threshold arguments live beside the two constants in `lib/config.ts`.
     */
    alarm('DemoIntakeDeadLetterNotEmpty', 'public', {
      alarmName: `reconcile-${environment}-demo-intake-dead-letter-not-empty`,
      alarmDescription:
        'A demo-intake lead failed every delivery attempt and is waiting in the dead-letter ' +
        'queue. It stays in alarm until the DLQ is redriven (deploy-handoff.md section 27); a ' +
        'dead-lettered lead expires 14 days after the visitor submitted it.',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/SQS',
        metricName: 'ApproximateNumberOfMessagesVisible',
        dimensionsMap: { QueueName: demoIntakeDeadLetterQueueName(environment) },
        statistic: 'Maximum',
        period: Duration.minutes(5),
      }),
      threshold: DEMO_INTAKE_DEAD_LETTER_MESSAGE_THRESHOLD,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    })

    alarm('DemoIntakeQueueOldestMessageAge', 'public', {
      alarmName: `reconcile-${environment}-demo-intake-queue-oldest-message-age`,
      alarmDescription:
        'A demo-intake lead has waited longer than the queue\'s whole retry budget ' +
        `(${DEMO_INTAKE_QUEUE_OLDEST_MESSAGE_ALARM_SECONDS}s = max receives x visibility timeout) ` +
        'without leaving the queue, so the worker is not RECEIVING it: a backlog or a stopped ' +
        'consumer. SQS deletes an expired message without dead-lettering it.',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/SQS',
        metricName: 'ApproximateAgeOfOldestMessage',
        dimensionsMap: { QueueName: demoIntakeQueueName(environment) },
        statistic: 'Maximum',
        period: Duration.minutes(5),
      }),
      threshold: DEMO_INTAKE_QUEUE_OLDEST_MESSAGE_ALARM_SECONDS,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    })

    /**
     * ┌─ 🛑 SECRET ROTATION FAILED — G3924, 4 Oct 2026, AND G261 PUTS IT HERE ─┐
     * │                                                                        │
     * │ Every rotation function in `Data` — the FOUR role-secret rotations     │
     * │ (G3921; five until G4320, and this said five until G4471 — G4464) and  │
     * │ the two HOSTED master rotations (G263) — reports a failed step by      │
     * │ THROWING, so `AWS/Lambda Errors` is the signal. One alarm, a SUM over  │
     * │ all SIX by FUNCTION NAME (the list below is derived): the names are    │
     * │ spelled by                                                             │
     * │ `lib/config.ts`, so this stack references no construct in `Data`,      │
     * │ mints no export and adds no deploy-order edge.                         │
     * │                                                                        │
     * │ 🛑 **A REFUSAL IS A FAILURE ON PURPOSE.** The role rotation refuses    │
     * │ while a service holding its secret is running (`holder_service_running`)│
     * │ rather than strand that service on a dead password. AWSCURRENT is      │
     * │ untouched; the credential simply did not rotate this week, and that    │
     * │ is exactly what a person must be told — a rotation that silently       │
     * │ skips is a record saying rotation is on while it is not.               │
     * │                                                                        │
     * │ ⚠️ `NOT_BREACHING`: a function runs one hour a week and publishes      │
     * │ nothing otherwise; nothing is not a fault. Threshold ZERO — one failed │
     * │ step is one credential the record claims rotates and that did not.    │
     * │ ⚠️ AND IT PAGES THE PLACEHOLDER (G1811/R14), like every alarm here.    │
     * └────────────────────────────────────────────────────────────────────────┘
     */
    const rotationFunctions = [
      ...Object.keys(ROLE_SECRET_HOLDER_SERVICES).map((id) =>
        roleRotationFunctionName(environment, id),
      ),
      masterRotationFunctionName(environment, 'data'),
      masterRotationFunctionName(environment, 'control'),
    ]
    alarm('SecretRotationFailed', 'shared', {
      alarmName: `reconcile-${environment}-${ROTATION_FAILURE_ALARM_SUFFIX}`,
      alarmDescription:
        'A Secrets Manager rotation step threw for a database secret. For a ROLE secret the ' +
        'commonest cause is holder_service_running: a serving service was up in the dark hour, ' +
        'so the rotation refused rather than strand it - AWSCURRENT is unchanged. Read the ' +
        'function log, then deploy-handoff.md section 31.',
      metric: new cloudwatch.MathExpression({
        expression: rotationFunctions.map((_, i) => `FILL(e${i}, 0)`).join(' + '),
        usingMetrics: Object.fromEntries(
          rotationFunctions.map((functionName, i) => [
            `e${i}`,
            new cloudwatch.Metric({
              namespace: 'AWS/Lambda',
              metricName: 'Errors',
              dimensionsMap: { FunctionName: functionName },
              statistic: 'Sum',
              period: Duration.minutes(5),
            }),
          ]),
        ),
        label: 'rotation function errors',
        period: Duration.minutes(5),
      }),
      threshold: 0,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    })

    /**
     * ─────────────────────────────────────────────────── 6. VPC flow logs
     *
     * Derived before it was written: `grep -n 'FlowLog' infra/lib/network-stack.ts`
     * returned nothing, so the VPC has carried no flow log since it was
     * created on 18 Sep 2026.
     *
     * 🛑 IT IS DECLARED HERE RATHER THAN IN `Network`, AND THAT IS BOTH G261's
     * PLACEMENT AND THE CHEAPER ONE: `ec2.FlowLog` reads only `vpc.vpcId`,
     * whose `Ref` export `Data` already forces, so `Network`'s template gains
     * nothing and needs no deploy for this stack's sake.
     *
     * ⚠️ `trafficType: ALL` RATHER THAN `REJECT`. A reject-only log is cheaper
     * and answers "who was turned away"; the question this product will
     * actually be asked is the plane-boundary one — *did anything ever talk
     * from the control-plane security group to the data cluster* — and that is
     * an ACCEPTED flow. G253 holds that boundary by security group and
     * `tests/infra/network.test.mjs` asserts the absence of a rule; **this is
     * the first thing in the app that could ever falsify it from observed
     * traffic rather than from a template.**
     *
     * ⚠️ NO ALARM ON ITS CONTENT, and that is a real gap named rather than
     * hidden. A metric filter over flow logs for cross-plane traffic would be
     * the control that closes the paragraph above; it needs a filter pattern
     * keyed on two security-group interface ids that are `Fn::ImportValue`
     * tokens, and a wrong pattern is a filter that matches nothing and reads as
     * a clean bill of health. That is a slice with its own red to witness.
     */
    const flowLogGroup = new logs.LogGroup(this, 'VpcFlowLogs', {
      logGroupName: `/reconcile/${environment}/vpc-flow-logs`,
      retention: FLOW_LOG_RETENTION_DAYS as logs.RetentionDays,
      removalPolicy: RemovalPolicy.DESTROY,
    })
    applyRequiredTags(flowLogGroup, environment, 'shared')

    const flowLog = new ec2.FlowLog(this, 'VpcFlowLog', {
      flowLogName: `reconcile-${environment}-vpc`,
      resourceType: ec2.FlowLogResourceType.fromVpc(network.vpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(flowLogGroup),
      trafficType: ec2.FlowLogTrafficType.ALL,
    })
    applyRequiredTags(flowLog, environment, 'shared')

    /**
     * ─────────────────────────────────────────────────────── 7. the outputs
     *
     * The topic ARN, so a human can subscribe a real address to it by hand —
     * and the sentence that says the ONLY subscriber today is a placeholder,
     * shipped as a CloudFormation output so it is visible in the console
     * rather than only in this file.
     *
     * ⚠️ **`AlarmsPageNobodyUntil` IS RENAMED TO `AlarmsPageAPlaceholderUntil`
     * RATHER THAN DELETED, AND THAT IS AN ARGUED CHOICE — G1811/G1813.**
     * Deleting the output would delete the SIGNAL along with the sentence it
     * was true of; the honest replacement names what changed rather than
     * going silent. The topic is no longer unsubscribed, so the old name
     * would now be a FALSE claim if left in place — worse than no output at
     * all, because a false output reads as confirmation. The new name and
     * value say plainly that the one subscriber is a placeholder, that it is
     * unconfirmed, and that this must be replaced before production.
     */
    new CfnOutput(this, 'AlarmTopicArn', {
      value: this.alarmTopic.topicArn,
      description: 'Every alarm and every event rule in this stack publishes here.',
    })

    new CfnOutput(this, 'AlarmsPageAPlaceholderUntil', {
      value:
        'the sole subscriber is a PLACEHOLDER address and its subscription is UNCONFIRMED — ' +
        'replace it with a real address before production',
      description:
        'This stack subscribes exactly ONE placeholder email address ' +
        `(${ALARM_SUBSCRIBER_EMAIL_PLACEHOLDER}) to the alarm topic. SNS cannot ` +
        'auto-confirm an email subscription, so it stays PendingConfirmation and pages ' +
        'nobody until an inbox at that address (there is none) clicks the confirmation link. ' +
        'A real production deploy that forgets to replace the PLACEHOLDER marker is caught by ' +
        'tests/infra/observability.test.mjs (G1811/G1812).',
    })

    applyRequiredTags(this, environment, 'shared')
  }
}
