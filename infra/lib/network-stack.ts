/**
 * `Network` — ONE VPC per environment, and G193's plane boundary expressed in
 * the one vocabulary AWS enforces on every packet: security groups.
 *
 * 🛑 WHAT THIS STACK IS ACTUALLY FOR, AND IT IS NOT THE VPC.
 *
 * `compose.yaml` states at its head that what enforces invariant 3 locally is
 * the NETWORKS — *"`control-plane` is attached to `control-net` ONLY. It is not
 * on `data-net`, so the hostname `data-plane-db` DOES NOT RESOLVE inside it —
 * not 'is refused', not 'is unauthorised': does not resolve."* G253 carries that
 * into AWS as **two security-group pairs**, and `docs/tech-stack.md` §7 states
 * the mapping as a row: *"`data-net` / `control-net` → Two security-group pairs;
 * **no rule** admits control-plane tasks to the data cluster."*
 *
 * ⚠️ THE AWS TRANSLATION IS WEAKER THAN THE COMPOSE ONE AND THE DIFFERENCE IS
 * NAMED HERE RATHER THAN SMUGGLED. On one VPC the data cluster's DNS name
 * RESOLVES from a control-plane task — one VPC is one DNS namespace — so the
 * property drops from *"does not resolve"* to *"resolves, and the packet is
 * dropped by a security group that names no control-plane source."* That is a
 * real weakening. It is taken knowingly for the reason G253 gives — one cluster,
 * one VPC, per environment — and it is bought back by TWO things rather than by
 * a review convention:
 *
 *   1 · `dataPlaneDbSg` accepts 5432 from `dataPlaneSg` and from NOTHING else.
 *       An ingress rule is a positive enumeration: there is no "allow all
 *       private subnets" rule here, so admitting the control plane would require
 *       somebody to WRITE the rule rather than to forget one.
 *   2 · `tests/infra/network.test.mjs` walks the synthesised template and fails
 *       if any ingress rule on either database group names the other plane's
 *       group. It is witnessed RED — `infra/test-fixtures/cross-plane-sg.ts`
 *       adds exactly that rule and the suite requires the assertion to catch it.
 *
 * 🛑 AND THE THIRD CONTROL IS A TAG QUERY, WHICH IS G260's WHOLE POINT.
 * Every group below carries `Plane=data` or `Plane=control`, so *"a
 * `Plane=control` resource with a route to a `Plane=data` cluster is a finding
 * somebody can run"* is true of this stack's output and not merely of its
 * prose.
 *
 * ⚠️ WHAT THIS STACK DOES NOT DO. It creates no VPC endpoints, no flow logs and
 * no NACLs. Flow logs belong to `Observability` (G261, not applied); endpoints
 * are a cost/latency decision nobody has taken and the NAT below makes them
 * unnecessary for correctness, only for money. Named so they read as absent
 * rather than as forgotten.
 */

import { CfnOutput, Stack, Tags } from 'aws-cdk-lib'
import type { StackProps } from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs'

import { AWS_REGION, CONTROL_PLANE_PORT, networkExportName } from './config.ts'
import type { Environment } from './config.ts'
import { applyRequiredTags } from './tagging.ts'

export interface NetworkStackProps extends StackProps {
  readonly environment: Environment
}

/**
 * The port. PostgreSQL's, and the only port either database group admits.
 *
 * It is a constant rather than `cluster.connections.defaultPort` because this
 * stack must not depend on the `Data` stack — the dependency runs the other way,
 * and a security group that learns its port from the thing it protects is a
 * group that cannot be written before the thing exists.
 */
export const POSTGRES_PORT = 5432

export class NetworkStack extends Stack {
  /**
   * ⚠️ TYPED `IVpc`, NOT `Vpc`, AND THE ONE ASSERTION BELOW IS WHY — IT IS THE
   * ONLY TYPE ASSERTION IN THIS FILE AND IT IS NOT A SHRUG.
   *
   * This repository compiles with `exactOptionalPropertyTypes`, and
   * `aws-cdk-lib` does not: `Vpc` declares `vpnGatewayId: string | undefined`
   * while the `IVpc` interface declares `vpnGatewayId?: string`. Under that
   * option those are DIFFERENT types — present-and-undefined is not the same as
   * absent — so `Vpc` is not assignable to `IVpc` and every CDK prop that asks
   * for an `IVpc` rejects the concrete class. Six call sites failed on it.
   *
   * The assertion is made ONCE, here, on a value this file constructed itself
   * and whose runtime shape is not in doubt, rather than at each consumer.
   * Widening the compiler options to accommodate a library would be the other
   * fix and is refused: `tests/infra/manifest.test.mjs` asserts all five
   * TypeScript projects carry the same seven options, in both directions.
   */
  readonly vpc: ec2.IVpc

  /** The data plane's ECS tasks — the service AND its migrate run-task. */
  readonly dataPlaneSg: ec2.SecurityGroup
  /** The data plane's Aurora cluster. Accepts 5432 from two same-plane groups. */
  readonly dataPlaneDbSg: ec2.SecurityGroup
  /** The data plane's Secrets Manager rotation Lambda (G263). */
  readonly dataPlaneRotationSg: ec2.SecurityGroup

  /** The control plane's ECS tasks — the service AND its migrate run-task. */
  readonly controlPlaneSg: ec2.SecurityGroup
  /** The control plane's Aurora cluster. Accepts 5432 from two same-plane groups. */
  readonly controlPlaneDbSg: ec2.SecurityGroup
  /** The control plane's Secrets Manager rotation Lambda (G263). */
  readonly controlPlaneRotationSg: ec2.SecurityGroup

  /**
   * The internal ALB in front of both planes.
   *
   * 🛑 SHARED BY BOTH PLANES, AND THAT IS NOT A HOLE IN G193's FENCE. The
   * boundary G193 and G253 enforce is which task may reach which DATABASE —
   * `dataPlaneDbSg` admits 5432 from `dataPlaneSg` only, and the control pair
   * likewise, with no rule between them. A load balancer that can forward to
   * both planes on two different listeners reaches neither database and carries
   * no credential; it is a router, and routing to two places is what it is for.
   *
   * ⚠️ IT IS `internetFacing: false` AND MUST STAY SO. `compose.yaml` binds
   * every published port to `127.0.0.1` and its commit says why — *"the
   * documented runbook was the front door."* The frontend reaches the planes as
   * a SECOND CLOUDFRONT ORIGIN (G255), not by this being public.
   */
  readonly dataPlaneAlbSg: ec2.SecurityGroup
  readonly controlPlaneAlbSg: ec2.SecurityGroup

  /**
   * 🛑 THE OVERRIDE THAT KEEPS `cdk synth` OFFLINE, AND IT HAD TO BE HERE
   * RATHER THAN IN THE VPC's PROPS.
   *
   * `Stack.availabilityZones` is a CDK CONTEXT LOOKUP whenever the region is
   * concrete, and `infra/lib/config.ts` states that no construct in this app
   * performs one — `npm run synth:infra` passes `--no-lookups`, and
   * `tests/infra/manifest.test.mjs` asserts both the flag and the absence of
   * any `fromLookup()` call. The gate failed with exactly this:
   *
   *     Context lookups have been disabled … Missing context keys:
   *     'availability-zones:account=000000000000:region=us-west-2'
   *
   * ⚠️ AND PASSING `availabilityZones` TO THE VPC DOES NOT FIX IT, WHICH IS
   * THE NON-OBVIOUS HALF. `ec2.Vpc` VALIDATES the zones you give it against
   * `stack.availabilityZones` — so supplying them explicitly triggers the same
   * lookup it was meant to avoid. The getter is the only place the question is
   * actually asked, so it is the only place it can be answered.
   *
   * ⚠️ AN AZ NAME IS ACCOUNT-RELATIVE — `us-west-2a` is not the same physical
   * zone in two accounts. That costs nothing while G281 keeps hosted to ONE
   * account. The alternative AWS suggests, `cdk synth` on a credentialled
   * machine plus a committed `cdk.context.json`, is refused for the reason
   * `bin/app.ts` gives about build steps: it puts an artefact nobody reviews
   * between the source that is read and the template that is deployed.
   */
  override get availabilityZones(): string[] {
    return [`${AWS_REGION}a`, `${AWS_REGION}b`]
  }

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props)

    /**
     * 🛑 ONE NAT GATEWAY, NOT ONE PER AZ, AND THE COST DIFFERENCE IS THE WHOLE
     * REASON.
     *
     * CDK's default is one NAT gateway per availability zone. At two AZs in
     * `us-west-2` that is two gateways at roughly $0.045/hour each — about $33
     * a month EACH, before a byte of data processing, on a staging environment
     * that serves nobody and which §5's scheduled-shutdown block is trying to
     * switch OFF at night. A second gateway would cost more per month than the
     * Aurora cluster it sits beside is expected to.
     *
     * ⚠️ WHAT IT COSTS, STATED PLAINLY: the single gateway is in ONE AZ, so an
     * AZ failure takes outbound internet away from private subnets in the OTHER
     * AZ too. Tasks there keep reaching the database (that traffic never leaves
     * the VPC) and stop reaching ECR, Secrets Manager and CloudWatch — which is
     * enough to prevent a task from STARTING. For `staging` that is an accepted
     * outage. **For `prod` it is not, and this is the line to change**: it is
     * `natGateways: props.environment === 'prod' ? 2 : 1`, one word, and it is
     * deliberately NOT written that way today because `prod` is not
     * instantiated and a branch nobody synthesises is a branch nobody checks.
     */
    const vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `reconcile-${props.environment}`,
      ipAddresses: ec2.IpAddresses.cidr('10.40.0.0/16'),
      // TWO ZONES. They come from the `availabilityZones` override above, which
      // is also what keeps this synth offline — read that block before changing
      // this line.
      maxAzs: 2,
      natGateways: 1,
      /**
       * TWO TIERS. Public exists to hold the NAT gateway and, later, the
       * internal ALB's peers; private-with-egress holds everything of ours —
       * the two ECS services, the two migrate run-tasks, both Aurora clusters
       * and the two secret-rotation Lambdas.
       *
       * ⚠️ A THIRD, ISOLATED TIER FOR THE DATABASES WAS CONSIDERED AND IS NOT
       * HERE. A database initiates nothing, so an isolated subnet would be the
       * tighter shape — but Secrets Manager rotation (G263) puts a Lambda in
       * the VPC that must reach the Secrets Manager API, and in an isolated
       * subnet that needs an interface VPC endpoint (~$7/month/AZ) that nothing
       * else in this stack needs. The database's OWN containment is
       * `dataPlaneDbSg` accepting one port from one group, which an isolated
       * subnet would not improve. Recorded as a decision, not an omission.
       */
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 20 },
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true,
      // No `availabilityZones` and no `fromLookup()`: `infra/lib/config.ts`
      // requires synth to be deterministic and offline, and `maxAzs: 2` over a
      // concrete account+region resolves without reaching AWS.
    })
    // The one assertion. See the field's docblock above for why.
    this.vpc = vpc as ec2.IVpc

    // ------------------------------------------------------------ data plane

    const data = new Construct(this, 'DataPlane')

    this.dataPlaneSg = new ec2.SecurityGroup(data, 'TasksSg', {
      vpc: this.vpc,
      securityGroupName: `reconcile-${props.environment}-data-tasks`,
      description:
        'Data-plane ECS tasks (service and migrate run-task). G253. Egress open: ' +
        'ECR, Secrets Manager, CloudWatch and the control plane HTTPS catalogue pull.',
      allowAllOutbound: true,
    })

    /**
     * 🛑 `allowAllOutbound: false` ON A DATABASE GROUP IS NOT TIDINESS.
     *
     * An Aurora cluster initiates nothing. Leaving egress open would mean that
     * a compromised database instance — or, far likelier, a future engineer
     * attaching this group to something that is not a database because it was
     * conveniently to hand — has unrestricted outbound reach. CDK compensates
     * for CloudFormation's "no egress rules means allow all" default by writing
     * one deliberately-unroutable rule to `255.255.255.255/32`; that artefact is
     * expected and is what an empty egress list looks like in a template.
     */
    this.dataPlaneDbSg = new ec2.SecurityGroup(data, 'DbSg', {
      vpc: this.vpc,
      securityGroupName: `reconcile-${props.environment}-data-db`,
      description:
        'Data-plane Aurora cluster. Accepts 5432 from the data-plane task group ' +
        'and from nothing else. NO CONTROL-PLANE SOURCE MAY EVER BE ADDED HERE ' +
        '(G193, G253, invariant 3).',
      allowAllOutbound: false,
    })

    this.dataPlaneDbSg.addIngressRule(
      this.dataPlaneSg,
      ec2.Port.tcp(POSTGRES_PORT),
      'Data-plane tasks reach the data-plane database.',
    )

    this.dataPlaneRotationSg = new ec2.SecurityGroup(data, 'RotationSg', {
      vpc: this.vpc,
      securityGroupName: `reconcile-${props.environment}-data-rotation`,
      description:
        "G263s Secrets Manager rotation function for the data-plane cluster. " +
        'Outbound open: it must reach the Secrets Manager API over the NAT.',
      allowAllOutbound: true,
    })

    this.dataPlaneDbSg.addIngressRule(
      this.dataPlaneRotationSg,
      ec2.Port.tcp(POSTGRES_PORT),
      'The rotation function reaches the data-plane database to ALTER ROLE.',
    )

    /* G260's `Plane` tag, at a HIGHER PRIORITY than the stack-wide default
     * applied at the foot of this constructor. `Tags.of()` is a mutating Aspect
     * and `TagManager` keeps the highest-priority value, so 200 beats the
     * default 100 deterministically rather than relying on the order two
     * equal-priority aspects happen to visit a node in. The inspector runs at
     * READONLY (1000) and therefore reads the settled value. */
    Tags.of(data).add('Plane', 'data', { priority: 200 })

    // --------------------------------------------------------- control plane

    const control = new Construct(this, 'ControlPlane')

    this.controlPlaneSg = new ec2.SecurityGroup(control, 'TasksSg', {
      vpc: this.vpc,
      securityGroupName: `reconcile-${props.environment}-control-tasks`,
      description:
        'Control-plane ECS tasks (service and migrate run-task). G253. This group ' +
        'appears in NO ingress rule on the data-plane database group.',
      allowAllOutbound: true,
    })

    /**
     * ⚠️ **THE `description` BELOW SAYS "and from nothing else" AND THAT WENT
     * FALSE ON 20 Sep 2026 (G1284). IT IS DELIBERATELY NOT CORRECTED, AND THE
     * REASON IS CLOUDFORMATION RATHER THAN CARELESSNESS.**
     *
     * `AWS::EC2::SecurityGroup.GroupDescription` is **Update requires:
     * Replacement**. Editing this string would not amend a sentence — it would
     * DELETE AND RECREATE the security group that the control Aurora cluster is
     * attached to, on a `Network` deploy, which is `docs/build/deploy-handoff.md`
     * §3's trap class arriving through a doc fix. In the good case that is an
     * Aurora cluster detached and reattached to a new group; in the likely case
     * CloudFormation cannot delete a group that is in use and the stack rolls
     * back with a dependency violation, having already created the replacement.
     * **A one-word documentation improvement is the most expensive change
     * available in this file.**
     *
     * So the accurate statement lives HERE, where it costs nothing and where
     * anybody reading the group is already reading it:
     *
     *   **This group accepts 5432 from THREE sources and no fourth** — the
     *   control-plane task group, the control-plane rotation function, and
     *   (G1161, G1284) the DATA-plane task group, read-only, as
     *   `reconcile_control_reader`. The rule block further down argues the
     *   direction at length.
     *
     * `tests/infra/network.test.mjs` asserts that set EXACTLY, so the next
     * source added is a red gate rather than a sentence nobody re-read — which
     * is the control this comment would otherwise be pretending to be.
     */
    this.controlPlaneDbSg = new ec2.SecurityGroup(control, 'DbSg', {
      vpc: this.vpc,
      securityGroupName: `reconcile-${props.environment}-control-db`,
      description:
        'Control-plane Aurora cluster. Accepts 5432 from the control-plane task ' +
        'group and from nothing else.',
      allowAllOutbound: false,
    })

    this.controlPlaneDbSg.addIngressRule(
      this.controlPlaneSg,
      ec2.Port.tcp(POSTGRES_PORT),
      'Control-plane tasks reach the control-plane database.',
    )

    this.controlPlaneRotationSg = new ec2.SecurityGroup(control, 'RotationSg', {
      vpc: this.vpc,
      securityGroupName: `reconcile-${props.environment}-control-rotation`,
      description:
        "G263s Secrets Manager rotation function for the control-plane cluster. " +
        'Outbound open: it must reach the Secrets Manager API over the NAT.',
      allowAllOutbound: true,
    })

    this.controlPlaneDbSg.addIngressRule(
      this.controlPlaneRotationSg,
      ec2.Port.tcp(POSTGRES_PORT),
      'The rotation function reaches the control-plane database to ALTER ROLE.',
    )

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * 🛑 THE ONLY CROSS-PLANE INGRESS RULE IN THIS APP — G1284, 20 Sep 2026,
     *    APPLYING G1161. READ THE DIRECTION BEFORE THE RULE.
     * ═══════════════════════════════════════════════════════════════════════
     *
     * Invariant 3, copied and never paraphrased:
     *
     *     "3. **The control plane publishes downward and never reads tenant
     *      data.**"
     *
     * **The rule below is a DATA-plane task group reaching the CONTROL
     * database.** That is a read DOWNWARD of a control-owned fact — which
     * tenants exist — by a process that publishes nothing back up. The
     * forbidden direction is the other one, and it is untouched.
     *
     * `db/control-read-scope.ts` is the whole argument and G1161 is the
     * owner's ruling behind it: *"The data plane gains a READ-ONLY
     * control-database pool. A second connection, `SELECT` only, on its own
     * credential."* Three controls sit on this connection and this rule is
     * none of them — it only makes them reachable:
     *
     *   · the ROLE is `reconcile_control_reader`, granted `SELECT` on one
     *     table in `db/migrations-control/0020_console_read_role.sql`, and
     *     deliberately NOT `reconcile_control_app`;
     *   · the TRANSACTION is `BEGIN READ ONLY`, enforced per statement by the
     *     server over every relation at once;
     *   · the CENSUS is `tests/db/control-plane-census.test.ts`, which is what
     *     G1161 spends G193's *by construction* property to buy, and which
     *     that file refuses to describe as a wash.
     *
     * ═══════════════════════════════════════════════════════════════════════
     * 🛑 THE MIRROR-IMAGE EDIT IS REFUSED, HERE, BY NAME, AND FOREVER.
     * ═══════════════════════════════════════════════════════════════════════
     *
     * **Nobody may add `this.dataPlaneDbSg.addIngressRule(this.controlPlaneSg,
     * ...)`.** That group's own description says it in capitals — *"NO
     * CONTROL-PLANE SOURCE MAY EVER BE ADDED HERE (G193, G253, invariant
     * 3)"* — and it is the rule `infra/test-fixtures/cross-plane-sg.ts` exists
     * to witness RED.
     *
     * ⚠️ **AND THE SYMMETRY IS THE TRAP, WHICH IS WHY IT IS WRITTEN DOWN
     * RATHER THAN LEFT TO JUDGEMENT.** Having read the rule below, the next
     * engineer who needs the control plane to reach a tenant fact has a
     * precedent that looks like permission: *the planes already talk, so one
     * more rule is a detail.* **It is not a detail, it is the invariant.** A
     * data plane reading the roster learns which tenants exist — a fact the
     * control plane authored. A control plane reading the data cluster learns
     * a customer's exceptions, their money and their people, and there is no
     * `SELECT`-only role, no read-only transaction and no census that makes
     * that anything other than the thing invariant 3 forbids.
     *
     * `tests/infra/network.test.mjs` is DIRECTIONAL for exactly this reason:
     * its boundary assertion permits this one (source, target) pair by name
     * and refuses every other cross-plane rule, and it separately refuses ANY
     * `Plane=control` source on a data database group — a clause no entry in
     * the permitted list can reach, so widening the list cannot open the
     * forbidden direction by accident.
     *
     * ⚠️ WHAT THIS RULE DOES NOT DO: it does not let the data plane reach the
     * control plane's HTTP listener, which is a different group
     * (`controlPlaneAlbSg`) and has no rule admitting anything. There is no
     * outbound HTTP call between planes at all — derive it, never read it:
     * `grep -rn 'fetch(' server/` returns nothing.
     */
    /* ⛔ G1161's RULE — data-plane tasks → control database on 5432 — IS RETIRED,
     * G4320, 5 Oct 2026, THE OWNER'S "Full restore" RULING. The data plane holds
     * no control-database credential; the control database admits same-plane
     * sources only again, and the data plane reaches the control plane's
     * internal tier over its ALB (G4310). */

    Tags.of(control).add('Plane', 'control', { priority: 200 })

    /* --------------------------------------------- the two internal ALBs */

    /**
     * 🛑 TWO LOAD BALANCER GROUPS, ONE PER PLANE, AND THE FIRST DRAFT HAD ONE
     * SHARED ONE UNTIL A TEST REFUSED IT.
     *
     * A single ALB reaching both planes is defensible on the narrow reading —
     * it routes HTTP, holds no credential, and can reach no database, so it
     * cannot carry tenant data upward. It was still WRONG, and the test that
     * caught it is the argument: G260 makes invariant 3 auditable from a TAG
     * QUERY, and a `Plane=shared` group admitted to a `Plane=data` group is
     * exactly the shape that query exists to find. A property that has to be
     * explained is not one you can check.
     *
     * Two groups, each inside its own plane's tag scope, and the fence holds
     * trivially: every security group in this product names one plane, and no
     * rule crosses. G193's shape is two of everything; this completes it.
     *
     * ⚠️ NEITHER HAS AN INGRESS RULE. Only a CloudFront VPC origin (G255's
     * second origin) should reach them, and that stack is not written. An ALB
     * that admitted the VPC CIDR "for now" is a fence nobody removes.
     */
    this.dataPlaneAlbSg = new ec2.SecurityGroup(data, 'AlbSg', {
      vpc: this.vpc,
      securityGroupName: `reconcile-${props.environment}-data-alb`,
      description:
        'The internal ALB in front of the data plane. No ingress rule yet: only ' +
        'a CloudFront VPC origin should reach it.',
      allowAllOutbound: true,
    })

    this.controlPlaneAlbSg = new ec2.SecurityGroup(control, 'AlbSg', {
      vpc: this.vpc,
      securityGroupName: `reconcile-${props.environment}-control-alb`,
      description:
        'The internal ALB in front of the control plane. No ingress rule yet: ' +
        'only a CloudFront VPC origin should reach it.',
      allowAllOutbound: true,
    })

    /**
     * 🛑 THE CONTROL PLANE'S FIRST INGRESS — G4310, 5 Oct 2026, THE OWNER'S
     * "Full restore" RULING: *"…put onboarding writes and roster reads behind
     * signed control-plane endpoints…"* The data-plane TASK group may reach the
     * control ALB on the control plane's port, and nothing else may: no
     * CloudFront origin, no prefix list, no CIDR. The SG's own description
     * still says *"No ingress rule yet"* and is NOT edited, because an EC2
     * security group's description is immutable and changing it REPLACES the
     * group — a replacement under a live ALB. This rule is the record.
     *
     * ⚠️ THE DIRECTION IS DATA → CONTROL OVER HTTP, AND INVARIANT 3 IS
     * UNTOUCHED: the control plane still cannot reach the data plane's
     * database (`dataPlaneDbSg` admits same-plane sources only), and the
     * control service makes no request to the data plane at all.
     * `tests/infra/network.test.mjs` asserts the rule exists, names this
     * source alone, and that the DATA ALB gained nothing.
     */
    this.controlPlaneAlbSg.addIngressRule(
      this.dataPlaneSg,
      ec2.Port.tcp(CONTROL_PLANE_PORT),
      'G4310: data-plane tasks call the control plane internal tier (SigV4 via STS).',
    )

    /**
     * 🛑 THE RULES THAT ARE NOT WRITTEN ABOVE ARE THE POINT OF THIS FILE.
     *
     *   dataPlaneDbSg    <- controlPlaneSg     ABSENT — invariant 3
     *   dataPlaneDbSg    <- controlPlaneRotationSg  ABSENT — same, and easier
     *                                          to add by accident, because one
     *                                          rotation function looks like
     *                                          another
     *   controlPlaneDbSg <- dataPlaneSg        ABSENT — the data plane has no
     *                                          business in the catalogue's
     *                                          database; it PULLS over signed
     *                                          HTTPS (G185(c)), which needs no
     *                                          rule here at all
     *   either db group  <- any CIDR           ABSENT — a CIDR rule would admit
     *                                          whatever lands in that range next
     *   either db group  <- either db group    ABSENT — no cluster talks to the
     *                                          other
     *
     * An absence is exactly the class `CLAUDE.md` records `check-doc-counts` as
     * blind to — *"an omission has no number in it"* — which is why
     * `tests/infra/network.test.mjs` asserts each of them as a POSITIVE
     * statement about the template rather than leaving them to this comment.
     *
     * 🛑 AND WHY THE ROTATION GROUPS ARE IN **THIS** STACK RATHER THAN BESIDE
     * THE CLUSTERS THEY SERVE. IT IS NOT TIDINESS; THE OBVIOUS ARRANGEMENT DOES
     * NOT SYNTHESISE.
     *
     * `DatabaseCluster.addRotationSingleUser()` calls
     * `connections.allowDefaultPortFrom(...)` for you, and a CDK cluster's
     * `defaultPort` is `Port.tcp(clusterEndpoint.port)` — the DEPLOY-TIME
     * `Endpoint.Port` attribute, not the number 5432. With the database group
     * in this stack and the cluster in `Data`, that rule makes `Network` depend
     * on `Data` while `Data` already depends on `Network` for its subnets.
     * `cdk synth` refuses it outright:
     *
     *     «DependencyCycle» 'reconcile-data-staging' depends on
     *     'reconcile-network-staging' … Adding this dependency
     *     (reconcile-network-staging -> …/Cluster/Resource.Endpoint.Port)
     *     would create a cyclic reference.
     *
     * So the rotation group is created HERE and pre-authorised HERE with the
     * LITERAL port, and `Data` hands it to a Secrets Manager **hosted**
     * rotation, which binds to the secret and never touches the cluster's
     * connections. **The property that falls out is worth more than the
     * workaround it started as: every security-group rule in this product is in
     * this file**, so `tests/infra/network.test.mjs` can read one template and
     * say something complete about the plane boundary rather than something
     * true of the part it happened to look at.
     */

    /**
     * ⚠️ `shared` IS THE STACK-WIDE `Plane` AND IT IS A HONEST VALUE, NOT A
     * HOLE. A VPC, its subnets, its route tables, its internet gateway and its
     * one NAT gateway are used by BOTH planes — that is what "one VPC per
     * environment" means — so tagging them `data` or `control` would put a
     * false statement in the one field G260 says invariant 3 is audited from.
     * The four SECURITY GROUPS, which are the resources the audit query is
     * actually about, each carry their own plane above.
     */
    applyRequiredTags(this, props.environment, 'shared')

    // ------------------------------------------------------------- consumers

    /* The `Data` and `Planes` stacks consume the fields above by construct
     * reference — same app, same environment, so CDK writes the exports and the
     * `Fn::ImportValue`s itself and the compiler checks the join. These outputs
     * are for PEOPLE: a console session, an incident, an `aws ec2
     * describe-security-groups` that needs an id. */
    /**
     * The NAMED exports the `Pipeline` stack imports by `Fn::ImportValue`.
     *
     * These are distinct from the `CfnOutput`s below, which are for PEOPLE. An
     * export is a contract between two stacks and its NAME is the contract, so
     * it is spelled from `NETWORK_EXPORT_KEYS` rather than typed here — the
     * importing side reads the same constant, and a rename that touches only
     * one side is a compile error rather than a deploy-time
     * "No export named ... found", which is how this was found.
     *
     * ⚠️ IDS, NEVER ARNS, AND NAMES, NEVER REVISIONS. An exported value that
     * embeds a revision goes stale silently on the next deploy of the stack
     * that owns it.
     */
    new CfnOutput(this, 'ExportPrivateSubnetIds', {
      exportName: networkExportName(props.environment, 'PrivateSubnetIds'),
      value: this.vpc.privateSubnets.map((s) => s.subnetId).join(','),
    })
    new CfnOutput(this, 'ExportDataPlaneSecurityGroupId', {
      exportName: networkExportName(props.environment, 'DataPlaneSecurityGroupId'),
      value: this.dataPlaneSg.securityGroupId,
    })
    new CfnOutput(this, 'ExportControlPlaneSecurityGroupId', {
      exportName: networkExportName(props.environment, 'ControlPlaneSecurityGroupId'),
      value: this.controlPlaneSg.securityGroupId,
    })

    new CfnOutput(this, 'VpcId', { value: this.vpc.vpcId })
    new CfnOutput(this, 'DataPlaneTasksSecurityGroupId', {
      value: this.dataPlaneSg.securityGroupId,
      description: 'Attach the data-plane ECS service AND its migrate run-task to this.',
    })
    new CfnOutput(this, 'DataPlaneDbSecurityGroupId', {
      value: this.dataPlaneDbSg.securityGroupId,
      description: 'The data Aurora cluster. Two ingress rules, both same-plane.',
    })
    new CfnOutput(this, 'ControlPlaneTasksSecurityGroupId', {
      value: this.controlPlaneSg.securityGroupId,
      description: 'Attach the control-plane ECS service AND its migrate run-task to this.',
    })
    new CfnOutput(this, 'ControlPlaneDbSecurityGroupId', {
      value: this.controlPlaneDbSg.securityGroupId,
      description: 'The control Aurora cluster. Two ingress rules, both same-plane.',
    })
    new CfnOutput(this, 'DataPlaneRotationSecurityGroupId', {
      value: this.dataPlaneRotationSg.securityGroupId,
      description: "G263's rotation function for the data-plane secret.",
    })
    new CfnOutput(this, 'ControlPlaneRotationSecurityGroupId', {
      value: this.controlPlaneRotationSg.securityGroupId,
      description: "G263's rotation function for the control-plane secret.",
    })
  }
}
