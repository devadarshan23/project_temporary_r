/**
 * `EdgeCertificate` — G293's wildcard, **amended by G297 into TWO wildcards**,
 * and the only stack in this app that is not in `us-west-2`.
 *
 * 🛑 IT IS A SEPARATE STACK BECAUSE CLOUDFRONT READS ITS VIEWER CERTIFICATE
 * FROM `us-east-1` AND FROM NOWHERE ELSE. That is not a preference and not a
 * CDK artefact: a certificate issued in `us-west-2` is refused by
 * `AWS::CloudFront::Distribution` at deploy, minutes in, with a message about
 * the ARN rather than about the region. `ACM_CERTIFICATE_REGION` in
 * `lib/config.ts` carries the argument for why this does not reopen G256's
 * refusal of that region — a certificate is not a tenant placement.
 *
 * ⚠️ **SINCE 22 Sep 2026 (D6-4, G1871) IT ALSO HOLDS A THIRD RESOURCE, FOR
 * THE SAME REGION REASON: `wafv2.CfnWebACL` WITH `Scope: CLOUDFRONT` MUST BE
 * CREATED IN `us-east-1` TOO.** `rateLimitWebAcl` is a rate-based rule
 * closing (part of) the pool-exhaustion finding in
 * `docs/build/d6-threat-model.md` §4.5 — see its own header below for what
 * it closes and what it deliberately does not.
 *
 * ┌─ 🛑 THE HEADER BELOW READ *"ONE NAME ON IT: `*.reconcileai.app`"* UNTIL ────┐
 * │ 19 Sep 2026. THERE ARE TWO CERTIFICATES AND TWO NAMES, AND THE OLD         │
 * │ SENTENCE IS CORRECTED RATHER THAN DELETED BECAUSE G293's FLAT DECISION WAS │
 * │ TAKEN DELIBERATELY: THIS IS AN AMENDMENT, NOT A MISTAKE ERASED.            │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * **G297** restores G179 and G183, both of which predate G293 and both of which
 * G293 contradicted without anybody noticing until it was deployed:
 *
 *   · **`*.us-west-2.reconcileai.app` — THE TENANT CERTIFICATE.** G179 rules
 *     `{tenant}.{region}.{domain}`; G183 rules one wildcard PER REGION. The
 *     region is derived from `AWS_REGION` and never typed twice.
 *   · **`*.reconcileai.app` — THE CONSOLE CERTIFICATE.** `console.` and
 *     `partners.` are one label each. **The consoles stay FLAT, and the absence
 *     of a region label on them is an assertion**: a console has no tenant, so
 *     a region label would claim a residency invariant 3 says the control plane
 *     does not have. `EDGE_CONSOLE_HOSTS` in `lib/config.ts` argues it.
 *
 * 🛑 **WHY THE TENANT NAME IS NOT SIMPLY A SAN ON THE EXISTING CERTIFICATE, AND
 * IT IS THE ONE THING MOST LIKELY TO BE "SIMPLIFIED" LATER.** A single ACM
 * certificate can hold both names. **What it cannot do is hold both names
 * without being valid for a flat TENANT host.** `ten-acme.reconcileai.app` is
 * covered by `*.reconcileai.app`, so a combined certificate on the distribution
 * that serves tenants makes the misrouted-tenant handshake SUCCEED — which is
 * precisely the fail-open G179 spends a paragraph on and G297 exists to end.
 * Two names, two certificates, two distributions, because **CloudFront reads
 * exactly one viewer certificate per distribution.** G297: *"Cost accepted: two
 * certificates."*
 *
 * ⚠️ **THE CONSTRUCT ID `Wildcard` IS PRESERVED AND IS NOW A MISNOMER. DO NOT
 * RENAME IT.** Its logical id is derived from the construct path, and the
 * certificate it names is **ISSUED AND DEPLOYED** — `f147f331-2c3a-4c0e-81e9-
 * 1adf7a74d517`, validated 19 Sep 2026. A rename is a REPLACEMENT: a new
 * certificate, a new DNS validation wait, and a window in which the console
 * hosts have no certificate at all. The clarity of a better id is not worth a
 * re-issue; the comment carries the meaning instead.
 *
 * 🛑 **NEITHER CERTIFICATE CARRIES A PER-TENANT SAN, AND THAT IS UNCHANGED BY
 * G297.** Certificate Transparency logs are public, append-only and indexed. A
 * SAN per tenant would publish the customer list to the entire internet,
 * permanently, at a URL needing no credential — which is exactly the disclosure
 * G260 refuses for a `TenantId` TAG (*"a per-tenant tag is a tenant enumeration
 * in the clear"*) and `tenantKeyAliasName()` refuses for a KMS ALIAS. A tag
 * needs `tag:GetResources`; an alias needs `kms:ListAliases`; **a CT log needs
 * nothing at all.**
 *
 * ⚠️ **BUT CT IS NOT THE JUSTIFICATION FOR THE WILDCARD AND G297 CORRECTS THE
 * G293 PASS FOR SAYING IT WAS.** G183: *"CERTIFICATE TRANSPARENCY IS NOT THE
 * JUSTIFICATION, AND ANY DOCUMENT SAYING SO IS WRONG."* Tenant existence stays
 * enumerable one guess at a time. The wildcard removes the BULK disclosure only.
 * `EDGE_CERTIFICATE_TRANSPARENCY` in `lib/config.ts` carries the full argument
 * and now carries G297's correction of its own emphasis.
 *
 * ⚠️ THE VALIDATION IS DNS AND IT IS ASYNCHRONOUS. `AWS::CertificateManager::
 * Certificate` with `DomainValidationOptions` writes the `_xxx.reconcileai.app`
 * CNAME into `Z04053259WLMQJTR30EU` itself and then **CloudFormation blocks
 * until ACM has seen it.** A `cdk deploy` of this stack sits in
 * `CREATE_IN_PROGRESS` for minutes and that is the system working, not a hang.
 * The zone is reached by its literal id — never by a lookup, which would reach
 * AWS at synth and break G108's determinism condition on anything in the gate.
 *
 * ⚠️ **AND THE VALIDATION RECORD FOR THE SECOND CERTIFICATE LANDS IN THE SAME
 * ZONE, NOT IN A `us-west-2` SUBZONE.** `*.us-west-2.reconcileai.app` is
 * validated by a CNAME under `reconcileai.app`; there is no delegated zone for
 * the region label and none is needed. **Do not create one** — a second hosted
 * zone is a second set of NS records to keep correct, and the only thing it
 * would buy is tidiness.
 *
 * ⚠️ NO EMAIL VALIDATION, EVER. It mails five fixed addresses at the domain,
 * needs a human every renewal, and a certificate whose renewal depends on
 * somebody reading a mailbox is an outage with a date on it. G183 makes the
 * same argument one level up about customer domains: *"the only pattern that
 * survives 90-day and the coming 47-day certificate lifetimes without recurring
 * customer action."*
 *
 * 🛑 **A CERTIFICATE THAT SYNTHESISES IS NOT A CERTIFICATE THAT ISSUED**, which
 * is trap 10 of `docs/build/deploy-handoff.md` §3 arriving at a third service:
 * G287's key policy passed `tsc`, `cdk synth`, the gate and a clean deploy and
 * was then refused by KMS the first time it was really used. ACM validates the
 * domain, Route 53 validates the record and CloudFront validates the ARN's
 * region — **none of those runs at synth.** The witness for this stack is
 * `openssl s_client` against a live host, and it is written into the report
 * rather than assumed.
 */

import { CfnOutput, Stack } from 'aws-cdk-lib'
import type { StackProps } from 'aws-cdk-lib'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as wafv2 from 'aws-cdk-lib/aws-wafv2'
import type { Construct } from 'constructs'

import {
  EDGE_FLAT_WILDCARD_DOMAIN,
  EDGE_CONSOLE_PLANE_PATH_PATTERNS,
  EDGE_PLANE_PATH_PATTERNS,
  EDGE_TENANT_WILDCARD_DOMAIN,
  edgeRateLimitWebAclName,
  HOSTED_ZONE_ID,
  ROOT_DOMAIN,
} from './config.ts'
import type { Environment } from './config.ts'
import { applyRequiredTags } from './tagging.ts'

/**
 * 🛑 D6-4's SCOPE, TYPED AS A GUARD OVER THE REAL LIST RATHER THAN AS A COPY
 * OF IT — the same shape `assertPublishesNoLocalOperation()` in
 * `edge-stack.ts` uses one file over.
 *
 * `EDGE_PLANE_PATH_PATTERNS` is a CloudFront glob grammar (`*` matches any
 * sequence); a WAF `ByteMatchStatement` wants a literal `STARTS_WITH`
 * prefix, and the two are not the same list without a translator neither
 * file has any other reason to own. THREE prefixes cover FOUR patterns
 * because `/session` and `/session/*` share one: `STARTS_WITH '/session'`
 * matches both, exactly as CloudFront's own `/session` behaviour and
 * `/session/*` behaviour both do.
 *
 * ⚠️ **WHY THIS MATTERS AND IS NOT COSMETIC.** `docs/build/d6-threat-model.md`
 * §1.3 measures that `completeFederatedSignIn` and `resolveHomeRealm` are
 * not the only pool-exhaustion surface: `server/data-plane/session.ts`'s
 * `databaseReader()` opens `withSessionScope()` — one pooled connection — for
 * ANY request carrying a well-formed-looking (but invalid) session handle on
 * ANY of the four plane path patterns, before the row is found to be absent.
 * A rate rule scoped to `/session/*` alone would leave `/v1/*` and
 * `/context/*` exposed to the identical mechanic with a forged cookie value
 * and no credential at all. So the scope here is EVERY plane pattern, not
 * the two public sign-in operations D6 enumerates.
 */
const RATE_LIMITED_URI_PREFIXES = ['/v1/', '/context/', '/session'] as const

/**
 * 🛑 THE GUARD ITSELF, WITNESSED AT SYNTH RATHER THAN TRUSTED.
 *
 * If `EDGE_PLANE_PATH_PATTERNS` ever grows a pattern this list does not
 * cover, that pattern reaches a pooled database connection with no rate
 * limit on it at all — silently, because nothing else in this file reads
 * that constant. Throwing at synth makes the two lists a compile-time pair
 * rather than two places that can drift, which is `docs/HANDOFF.md` §5.3's
 * argument (*"two implementations of one rule, and the one that drifts is
 * always the copy"*) applied to a security control instead of a schema.
 */
function assertRateLimitCoversEveryPlanePattern(): void {
  /* G2770: the console distribution's plane patterns reach the same pool. */
  for (const pattern of [...EDGE_PLANE_PATH_PATTERNS, ...EDGE_CONSOLE_PLANE_PATH_PATTERNS]) {
    const bare = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern
    const covered = RATE_LIMITED_URI_PREFIXES.some((prefix) => bare.startsWith(prefix))
    if (!covered) {
      throw new Error(
        `EdgeCertificate: '${pattern}' reaches the plane (EDGE_PLANE_PATH_PATTERNS) and is ` +
          "not covered by D6-4's rate-based rule (RATE_LIMITED_URI_PREFIXES). A pattern that " +
          'reaches a pooled database connection with no rate limit on it is the exposure this ' +
          'rule exists to close - extend the prefix list in the same commit that extends the ' +
          'pattern list.',
      )
    }
  }
}

export interface EdgeCertificateStackProps extends StackProps {
  readonly environment: Environment
}

export class EdgeCertificateStack extends Stack {
  /**
   * **THE TENANT CERTIFICATE — `*.{region}.{domain}`, G297.** The `Edge`
   * stack's TENANT distribution puts this one on. It is valid for no flat host
   * in any region, which is the fail-closed property in one sentence.
   */
  readonly tenantCertificate: acm.ICertificate

  /**
   * **THE CONSOLE CERTIFICATE — the flat `*.{domain}`.** Issued under G293 and
   * KEPT, byte for byte, by G297: *"the consoles stay flat."* It is valid for
   * `ten-acme.reconcileai.app` too, which is why it must never reach the tenant
   * distribution.
   *
   * ⚠️ **THIS FIELD WAS CALLED `certificate` UNTIL 19 Sep 2026**, when there was
   * one. The rename is deliberate: a field called `certificate` on a stack
   * holding two is a field whose wrong value type-checks.
   */
  readonly consoleCertificate: acm.ICertificate

  /**
   * 🛑 D6-4, 22 Sep 2026 — THE RATE-LIMITING WEB ACL. `Edge`'s TENANT
   * distribution associates its `attrArn` (`webAclId` on `Distribution`
   * takes an ARN despite the name, per AWS's own CloudFront documentation).
   *
   * It lives HERE and not in `EdgeStack` for the same reason the two
   * certificates do: `AWS::WAFv2::WebACL` with `Scope: CLOUDFRONT` MUST be
   * created in `us-east-1`, and this is the one stack in this app already in
   * that region, already joined to `us-west-2` by `crossRegionReferences`
   * (`lib/app.ts`'s own header argues that mechanism at length for the
   * certificates; a WebACL ARN crosses the same SSM-parameter bridge).
   *
   * ⚠️ **IT IS ASSOCIATED WITH THE TENANT DISTRIBUTION ONLY, AND THAT IS
   * ARGUED RATHER THAN ASSUMED.** The finding this closes —
   * `docs/build/d6-threat-model.md` §1.3/§4.5 — is that an unauthenticated
   * request can hold a pooled DATABASE connection open for the life of a
   * transaction, and the CONSOLE distribution has NO plane origin at all
   * (`edge-stack.ts`'s own header: *"NO `/v1` behaviour, and the control
   * plane is still not an origin"*) — it serves the S3 bundle and nothing
   * else, so it cannot touch the database pool at any price. Attaching a
   * rate limit there would be a DIFFERENT, unstated control (generic L7
   * abuse protection on a static site) wearing this ruling's name.
   */
  readonly rateLimitWebAcl: wafv2.CfnWebACL

  constructor(scope: Construct, id: string, props: EdgeCertificateStackProps) {
    super(scope, id, props)

    assertRateLimitCoversEveryPlanePattern()

    /**
     * ⚠️ `fromHostedZoneAttributes`, NEVER `fromLookup`. Both produce an
     * `IHostedZone`; only one of them reaches the network while a contributor
     * is running `npm run check`. The id and the name are literals in
     * `lib/config.ts` beside the two commands that derive them.
     */
    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: HOSTED_ZONE_ID,
      zoneName: ROOT_DOMAIN,
    })

    /* 🛑 CONSTRUCT ID `Wildcard`, NOT `Console`. See the header: this
     * certificate is DEPLOYED and a rename replaces it. The id is history; the
     * field name and this comment are the meaning. */
    this.consoleCertificate = new acm.Certificate(this, 'Wildcard', {
      domainName: EDGE_FLAT_WILDCARD_DOMAIN,
      /* 🛑 NO `subjectAlternativeNames`. THE ABSENCE IS THE RULING.
       *
       * Every SAN added here is written to a public CT log within minutes and
       * cannot be withdrawn — CT logs are append-only by design, which is the
       * property that makes them useful and the property that makes a mistake
       * here permanent. The apex is absent too, deliberately: it is the
       * marketing plane's and lives on a different tool
       * (`deploy-handoff.md` §5.4), and `EDGE_APEX_IS_SERVED_ELSEWHERE` in
       * `lib/config.ts` records which reading of G297's *"the flat apex"* was
       * taken and which is owed. */
      validation: acm.CertificateValidation.fromDns(zone),
    })

    /**
     * 🛑 **THE SECOND CERTIFICATE, AND IT IS THE WHOLE OF G297 IN ONE
     * RESOURCE.** `*.us-west-2.reconcileai.app`.
     *
     * A wildcard matches exactly one label, so this certificate is valid for
     * `ten-acme.us-west-2.reconcileai.app` and for **nothing** at
     * `ten-acme.reconcileai.app` and **nothing** at
     * `ten-acme.eu-west-1.reconcileai.app`. **An EU tenant misrouted to this
     * plane cannot complete a handshake.** G179 stated that cost in its own
     * voice a month before G293 was taken; G297 restores it.
     *
     * ⚠️ THE REGION LABEL IS DERIVED FROM `AWS_REGION` AND NOT TYPED. A second
     * literal would be a copy that can disagree with the region the stacks
     * actually deploy into, and the disagreement issues, synthesises and
     * deploys green while covering nothing the planes serve.
     */
    this.tenantCertificate = new acm.Certificate(this, 'TenantRegional', {
      domainName: EDGE_TENANT_WILDCARD_DOMAIN,
      validation: acm.CertificateValidation.fromDns(zone),
    })

    /**
     * ┌─ 🛑 D6-4 — THE OWNER'S RULING OF 22 Sep 2026 (G1871). A CLOUDFRONT ────┐
     * │ RATE-BASED RULE, CLOSING THE POOL-EXHAUSTION FINDING — PARTIALLY.     │
     * └────────────────────────────────────────────────────────────────────────┘
     *
     * `docs/build/d6-threat-model.md` §1.3, §4.5, D6-4: ten concurrent
     * anonymous requests to any of `EDGE_PLANE_PATH_PATTERNS` each open a
     * pooled transaction before refusing, and `createAppPool(max = 10)` with
     * `SERVING_TASKS_WHEN_UP.staging = 1` means ten is the whole pool. No
     * `server/` edit, no dependency, no `Planes` deploy — D6's own "cheapest
     * real control in this document".
     *
     * 🛑 **READ THIS BEFORE TRUSTING THE THRESHOLD: A RATE-BASED RULE COUNTS
     * REQUESTS OVER A TRAILING WINDOW. IT DOES NOT LIMIT CONCURRENCY, AND NO
     * THRESHOLD CLOSES THE EXACT ARITHMETIC D6 MEASURED.** `evaluationWindowSec`
     * accepts only 60, 120, 300 or 600 (verified against the pinned
     * `aws-cdk-lib@2.270.0` CloudFormation type, not assumed); AWS WAF
     * re-checks the count roughly every 10 seconds but the WINDOW is never
     * shorter than 60. A single burst of ten (or of `limit`) concurrent
     * requests from one IP — or of one request each from TEN DIFFERENT
     * IPs — passes in full before any rate-based rule can act, because a
     * rate-based rule only BLOCKS once the trailing count is EXCEEDED. **This
     * rule closes the SUSTAINED / REPEATED variant of the exposure (a script
     * retrying the exhaustion every few seconds) and does NOT close the
     * single-shot ten-concurrent-request variant D6 measured.** D6-4's own
     * table names the companion that does: raising `RECONCILE_DB_POOL_MAX`
     * and `SERVING_TASKS_WHEN_UP.staging` moves the number an attacker must
     * reach, and D6's plan calls for "both, in that order". **That companion
     * is NOT taken in this commit** — it is a separate ruling over
     * `infra/lib/config.ts`'s serving capacity — and is named here so this
     * rule is not read as having closed more than it does.
     * ✅ **THE COMPANION IS TAKEN AND BUILT SINCE 1 Oct 2026 — R-POOL,
     * G2261–G2268 — AND IS NOT DEPLOYED.** The sentence above is kept because
     * it is true of THIS commit. `RECONCILE_DB_POOL_MAX` is 47 on the data
     * task and `SERVING_TASKS_WHEN_UP.staging.data` is 2, so the number moves
     * from 10 to 94 once a person deploys `Planes` (`docs/build/
     * deploy-handoff.md` §20). Still not a control — D6's own words.
     *
     * 🛑 **THE LIMIT IS 300 REQUESTS PER 60-SECOND WINDOW, PER SOURCE IP,
     * SCOPED TO THE PLANE PATHS ONLY.** Reasoning, not a guess:
     *   · The window is the SHORTEST AWS allows (60s), so a sustained attack
     *     is throttled as fast as the mechanism can react.
     *   · 300/60s (5 req/s sustained) comfortably covers one legitimate
     *     browser tab's session check plus API calls, AND a shared corporate
     *     NAT egress with several concurrent staff members each making
     *     ordinary requests — the false-positive risk D6-4 names
     *     ("too tight blocks legitimate concurrent tabs/retries").
     *   · It is far below what a script retrying the ten-concurrent burst
     *     every second (600+ req/60s) would need to sustain to keep the
     *     pool starved continuously — that IP is blocked within roughly one
     *     evaluation cycle once it exceeds 300 in the trailing minute.
     *
     * ⚠️ **AGGREGATED BY IP, NOT SCOPED TO AN UNAUTHENTICATED CALLER, AND
     * THAT IS DELIBERATE.** WAF rate-based rules key on network attributes,
     * never on cookie CONTENT — a `ByteMatchStatement` could detect the
     * PRESENCE of the session cookie, but `server/data-plane/session.ts`'s
     * `databaseReader()` opens the same pooled `withSessionScope()` read for
     * ANY well-formed-looking cookie value, valid or forged, before the row
     * is found absent. **A caller holding a cookie is not a caller who has
     * been authenticated by the time the pool is touched**, so exempting
     * "authenticated-looking" traffic from this rule would hand an attacker
     * a bypass for the price of one arbitrary header value. Blanket, by IP,
     * across all four `EDGE_PLANE_PATH_PATTERNS`.
     *
     * ⚠️ **PRICING, STATED FOR THE OWNER RATHER THAN AS A BLOCKER.** This is
     * a NEW chargeable AWS resource in a shared account: AWS WAF charges
     * (at the time of writing, subject to AWS's own pricing page, not
     * re-verified here) roughly $5/month per web ACL, ~$1/month per rule,
     * and ~$0.60 per million requests inspected. One WebACL, one rule, on
     * one distribution — the smallest shape this control can take.
     */
    this.rateLimitWebAcl = new wafv2.CfnWebACL(this, 'PlaneRateLimit', {
      name: edgeRateLimitWebAclName(props.environment),
      /**
       * ⚠️ `CLOUDFRONT` SCOPE, WHICH IS THE OTHER REASON THIS RESOURCE MUST
       * SIT IN `us-east-1` — the AWS-documented constraint the property's own
       * generated doc comment restates: *"For CLOUDFRONT, you must create
       * your WAFv2 resources in the US East (N. Virginia) Region."*
       */
      scope: 'CLOUDFRONT',
      /* ALLOW by default: this WebACL exists to add ONE rule, not to become
       * a second authorisation layer. Everything not caught by the
       * rate-based rule below passes exactly as it does today. */
      defaultAction: { allow: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: `${edgeRateLimitWebAclName(props.environment)}-webacl`,
      },
      rules: [
        {
          name: 'PlanePoolExhaustionRateLimit',
          priority: 0,
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: `${edgeRateLimitWebAclName(props.environment)}-rule`,
          },
          statement: {
            rateBasedStatement: {
              aggregateKeyType: 'IP',
              limit: 300,
              evaluationWindowSec: 60,
              /**
               * 🛑 THE SCOPE-DOWN, AND WHY IT EXISTS: WITHOUT IT THIS RULE
               * RATE-LIMITS THE STATIC BUNDLE TOO. The tenant distribution's
               * `defaultBehavior` serves `frontend/dist` from S3
               * (`edge-stack.ts`), which never touches the database pool —
               * throttling it would be a different, unnamed control riding
               * on this ruling. Matching on the URI path, never on the
               * `Host` header, keeps the rule keyed on WHICH ORIGIN a
               * request reaches rather than on WHICH TENANT sent it, so it
               * cannot become a second tenant-isolation surface by accident.
               */
              scopeDownStatement: {
                orStatement: {
                  statements: RATE_LIMITED_URI_PREFIXES.map((prefix) => ({
                    byteMatchStatement: {
                      fieldToMatch: { uriPath: {} },
                      positionalConstraint: 'STARTS_WITH',
                      searchString: prefix,
                      textTransformations: [{ priority: 0, type: 'NONE' }],
                    },
                  })),
                },
              },
            },
          },
        },
      ],
    })

    applyRequiredTags(this, props.environment, 'edge')

    new CfnOutput(this, 'RateLimitWebAclArn', {
      value: this.rateLimitWebAcl.attrArn,
      description:
        'D6-4, G1871. Associated with the TENANT distribution only - the console ' +
        'distribution has no plane origin and cannot touch the database pool.',
    })
    new CfnOutput(this, 'RateLimitClosesConcurrencyExposure', {
      value: 'NO',
      description:
        'A rate-based rule counts requests over a >=60s window; it cannot block the first ' +
        'N concurrent requests from one or many IPs. This closes SUSTAINED abuse only. The ' +
        "companion (RECONCILE_DB_POOL_MAX / task count) is NOT taken here - D6-4's own " +
        '"both, in that order".',
    })

    new CfnOutput(this, 'CertificateArn', {
      value: this.consoleCertificate.certificateArn,
      description: 'The FLAT console certificate. G293, kept by G297.',
    })

    new CfnOutput(this, 'TenantCertificateArn', {
      value: this.tenantCertificate.certificateArn,
      description: 'The per-region TENANT certificate. G297, G179, G183.',
    })

    /* ⚠️ A NOTE FOR WHOEVER READS THIS IN THE CONSOLE RATHER THAN IN THE TREE.
     * THIS COMMENT SAID "This stack holds two certificates and nothing else"
     * UNTIL 22 Sep 2026 AND IS CORRECTED RATHER THAN DELETED, because it is
     * the sentence a later reader would have trusted. It now holds two
     * certificates AND a rate-limiting WebACL (D6-4, G1871) — all three for
     * the SAME reason, the region: `Edge` cannot hold any of them, because
     * CloudFront reads a viewer certificate and a CLOUDFRONT-scope WebACL
     * from `us-east-1` and from nowhere else. Joining them to `Edge` across
     * regions is what `crossRegionReferences` in `lib/app.ts` is for. */
    new CfnOutput(this, 'WhyThisStackIsAlone', {
      value: `${EDGE_TENANT_WILDCARD_DOMAIN} and ${EDGE_FLAT_WILDCARD_DOMAIN} in us-east-1: CloudFront reads viewer certificates from no other region`,
      description: 'G293, amended by G297.',
    })

    /* 🛑 THE SENTENCE A LATER READER NEEDS MOST, PUT WHERE THE CONSOLE SHOWS
     * IT: the two certificates are not interchangeable and the wrong one
     * type-checks. Swapping them serves every tenant at a flat host again. */
    new CfnOutput(this, 'WhyTwoCertificates', {
      value:
        'tenants are per-region and fail closed at TLS; consoles are flat and have no tenant to place. ' +
        'CloudFront reads ONE viewer certificate per distribution, so two grammars mean two distributions. G297.',
      description: 'G297.',
    })
  }
}
