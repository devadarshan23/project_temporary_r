/**
 * G293's EDGE, **AMENDED BY G297** — TWO distributions, TWO certificates, TWO
 * host grammars, and the data plane as a second origin behind the tenant one.
 *
 * ⚠️ **THIS HEADER READ *"one distribution, a wildcard certificate"* UNTIL
 * 19 Sep 2026 AND EVERY EXPECTED STRING BELOW SAID `*.reconcileai.app`.** It is
 * corrected rather than deleted: G293's flat decision was taken deliberately and
 * this is an AMENDMENT. What changed is the grammar tenants are served at, and
 * the assertions that carry it are §1 and §5.
 *
 * ⚠️ EVERY EXPECTED STRING IS TYPED INTO THIS FILE, none imported from
 * `infra/lib/`. Comparing a stack to the constant the stack read proves only
 * that a variable equals itself — the warning `tests/infra/storage.test.mjs`,
 * `tests/infra/data.test.mjs` and `tests/infra/tag-aspect.test.mjs` all carry.
 *
 * 🛑 THE ASSERTIONS THAT ARE NOT HYGIENE, SO A LATER READER KNOWS WHICH ONES TO
 * ARGUE WITH BEFORE CHANGING THEM — ⚠️ **THIS SAID FOUR UNTIL G297 ADDED THREE
 * AND SEVEN UNTIL G1011 ADDED TWO; COUNT THEM RATHER THAN READING THIS LINE**:
 *
 *   §1 the TENANT alias carries the REGION LABEL — a flat alias is valid in
 *      every region, so a misrouted tenant FAILS OPEN (G179, G297).
 *   §1 the two distributions reference TWO DIFFERENT certificates — one
 *      certificate covering both grammars is valid for a flat tenant host, and
 *      the wrong one type-checks.
 *   §1 no CONSOLE host carries a region label — it would assert a residency
 *      invariant 3 says the control plane does not have (G297).
 *   §2 `CachingDisabled` on the plane behaviour — a cache key without `Host` is
 *      a CROSS-TENANT READ performed by a CDN, under G179's one-host-one-tenant.
 *   §2 `AllViewer` on the plane behaviour — without it CloudFront replaces the
 *      viewer `Host` with the origin's, and G179/G180's whole host mechanism
 *      resolves nothing.
 *   §3 the ALB is admitted from a SECURITY GROUP and never from a CIDR —
 *      `deploy-handoff.md` §2's *"a fence nobody removes"*.
 *   §2 NO BEHAVIOUR PUBLISHES `/health`, `/status` OR `/metrics` — those are
 *      `data-plane-local.openapi.yaml`'s, they sit at the ROOT of the same
 *      process the tenant surface sits in, and `checkLocalHealth` is mounted
 *      (G1011). The assertion is over every plane pattern rather than over a
 *      list of spellings, so `/*`, `/h*` and `/*ealth` are all caught by it.
 *   §2 THE PLANE IS REACHED BY FOUR EXPLICIT PREFIXES (⚠️ **this said THREE
 *      until 20 Sep 2026, G1092, while the assertion twenty lines into §2 named
 *      all four and the deployed distribution carried all four — a FOURTH place
 *      saying three, after the three the red report found**) — `/v1/*` is one tier's
 *      base path, not the served surface, and `POST /context/resolve` answered
 *      403 from CloudFront for the whole life of this stack (G1011).
 *   §5 no per-tenant SAN and no per-tenant DNS record — CT logs are
 *      world-readable and an NXDOMAIN is an oracle.
 *   §1 the CONSOLE distribution reaches the plane on EXACTLY `/session/realm`
 *      — G1949, 22 Sep 2026. `/v1/*` and `/context/*` are tenant-scoped and a
 *      console host carries no tenant label, so routing them there does not
 *      404: G180 REVOKES the session on a host mismatch. A second pattern is
 *      a decision about what this product publishes to the internet.
 *   §1 ONE `AWS::CloudFront::VpcOrigin` for both distributions (G1950) —
 *      which is also why §3 still needs ONE ingress rule and not two.
 *
 * 🛑 **AND BOTH DISTRIBUTION SELECTORS WERE RE-KEYED ON 22 Sep 2026 — G1951.**
 * They picked the tenant one out as *"the one with a `VpcOriginConfig`"*,
 * which was a LANDMARK standing in for the HOST GRAMMAR and went red the
 * moment a second distribution gained a plane origin. The reds are captured
 * verbatim at the helpers below. **Read that before adding a selector here.**
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { REPO_ROOT, ensureDeps, runInfraScript, synthesisedTemplates, resourcesOfType } from './support.mjs'

await ensureDeps()

const EDGE = 'reconcile-edge-staging'
const CERT = 'reconcile-edge-certificate-staging'

/** The two managed policy ids CloudFront publishes. Typed, never imported. */
const MANAGED_CACHING_DISABLED = '4135ea2d-6df8-44a3-9df3-4b5a84be39ad'
const MANAGED_ALL_VIEWER = '216adef6-5c7f-47e4-b989-5492eafa07d3'

const templates = synthesisedTemplates()

const edge = () => {
  const t = templates[EDGE]
  assert.ok(t, `${EDGE} is not in the synthesised app at all`)
  return t
}

/**
 * ┌─ 🛑 BOTH SELECTORS WERE RE-KEYED ON 22 Sep 2026 — G1951 — AND THE OLD ─────┐
 * │ ONES ARE QUOTED RATHER THAN DELETED, BECAUSE THEY ARE §5.1 ARRIVING IN    │
 * │ THE SUITE THAT GUARDS WHAT THIS PRODUCT PUBLISHES TO THE INTERNET.        │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * They read:
 *
 *     the TENANT one:   "the one with a VpcOriginConfig"
 *                       ⚠️ IT IS FOUND BY THE PROPERTY THAT MAKES IT THE
 *                       TENANT ONE, not by a logical id and not by an alias …
 *                       **The data plane reaches exactly one distribution, so
 *                       "the one with a VpcOriginConfig" is the tenant one by
 *                       construction.**
 *     the CONSOLE one:  "the one where every origin has none"
 *
 * **That premise stopped being true when the console distribution gained a
 * data-plane origin (G1949), and BOTH selectors went red in the same commit.**
 * Captured verbatim, because a selector failing is how this was found rather
 * than an assertion failing:
 *
 *     exactly one distribution reaches a plane, and it is the tenant one
 *     2 !== 1
 *
 *     exactly one distribution reaches no plane at all
 *     0 !== 1
 *
 * 🛑 **THE OLD SELECTOR WAS A LANDMARK STANDING IN FOR A PROPERTY, WHICH IS
 * THE DEFECT THIS RECORD CATALOGUES MOST OFTEN.** *Reaches a plane* was never
 * what makes a distribution the tenant one — **the HOST GRAMMAR is**, and it
 * is the whole of G297: a tenant host carries the region label and a console
 * host does not. So the selector is now that, and it is the ONE fact about
 * these two resources that cannot change without the ruling changing.
 *
 * ⚠️ **AND IT DOES NOT COLLIDE WITH §1, WHICH IS THE OBJECTION THE OLD
 * COMMENT RAISED AGAINST USING AN ALIAS.** §1 asserts the tenant alias is
 * EXACTLY `['*.us-west-2.reconcileai.app']` and that the console's are exactly
 * the two named hosts; the selectors below ask only whether EVERY alias ends
 * in the region suffix. A distribution whose aliases were mixed satisfies
 * neither selector and fails loudly HERE rather than being silently sorted.
 */
const REGION_SUFFIX = '.us-west-2.reconcileai.app'

const distributionConfigs = () => {
  const found = resourcesOfType(edge(), 'AWS::CloudFront::Distribution')
  assert.equal(
    found.length,
    2,
    'G297: the TENANT distribution and the CONSOLE distribution. ' +
      'A third one is a ruling, not a slice - and G293s refusal of one distribution ' +
      'PER TENANT is untouched: creating a tenant still deploys nothing.',
  )
  return found.map(([, r]) => r.Properties.DistributionConfig)
}

/** The TENANT distribution — every alias carries the region label. G297. */
const distribution = () => {
  const tenant = distributionConfigs().filter(
    (c) => (c.Aliases ?? []).length > 0 && c.Aliases.every((a) => a.endsWith(REGION_SUFFIX)),
  )
  assert.equal(
    tenant.length,
    1,
    'exactly one distribution serves the REGION-LABELLED grammar, and it is the tenant one. ' +
      'G179: a flat wildcard is cryptographically valid in every region, so the label is ' +
      'what makes a misroute fail closed at TLS - which is why it is the selector.',
  )
  return tenant[0]
}

/** The CONSOLE distribution — flat hosts, no region label anywhere. G297. */
const consoleDistribution = () => {
  const flat = distributionConfigs().filter(
    (c) => (c.Aliases ?? []).length > 0 && c.Aliases.every((a) => !a.endsWith(REGION_SUFFIX)),
  )
  assert.equal(
    flat.length,
    1,
    'exactly one distribution serves the FLAT grammar, and it is the console one. ' +
      'A console has no tenant, so a region label on it would assert a residency ' +
      'invariant 3 says the control plane does not have.',
  )
  return flat[0]
}

const planeBehaviour = () => {
  const behaviours = distribution().CacheBehaviors ?? []
  const match = behaviours.find((b) => b.PathPattern === '/v1/*')
  assert.ok(match, `no behaviour matches the contract's own prefix; got ${JSON.stringify(behaviours.map((b) => b.PathPattern))}`)
  return match
}

/**
 * EVERY behaviour that reaches the plane, not the first one.
 *
 * 🛑 G1011 MADE THE DIFFERENCE MATTER. There was one plane behaviour until
 * 20 Sep 2026 and there are three, so a §2 assertion written against
 * `planeBehaviour()` alone would now prove `/v1/*` correct and say nothing
 * about the two beside it — which is exactly how a fourth pattern pasted from
 * the BUNDLE behaviour, carrying `CACHING_OPTIMIZED`, would arrive green.
 */
const planeBehaviours = () => {
  const origin = planeBehaviour().TargetOriginId
  const found = (distribution().CacheBehaviors ?? []).filter((b) => b.TargetOriginId === origin)
  assert.ok(found.length >= 1, 'no behaviour reaches the plane at all')
  return found
}

/**
 * EVERY plane behaviour on EITHER distribution — G1951, 22 Sep 2026, and it is
 * the same argument as `planeBehaviours()`'s one distribution out.
 *
 * 🛑 THE CONSOLE DISTRIBUTION GAINED A PLANE ORIGIN ON 22 Sep 2026 (G1949),
 * and every §2 assertion written against `planeBehaviours()` alone would have
 * gone on proving the tenant one correct while saying **nothing** about a
 * behaviour on a second resource — which is `planeBehaviour()`-versus-
 * `planeBehaviours()` happening a second time, one layer up. The two controls
 * that must hold on every one of them are the two that are TENANT-ISOLATION
 * settings and the one that is a published-surface claim, so those three read
 * this and not the narrower helper.
 */
const everyPlaneBehaviour = () =>
  distributionConfigs().flatMap((c) => {
    const vpcOriginIds = new Set(
      (c.Origins ?? []).filter((o) => o.VpcOriginConfig !== undefined).map((o) => o.Id),
    )
    return (c.CacheBehaviors ?? []).filter((b) => vpcOriginIds.has(b.TargetOriginId))
  })

/**
 * CloudFront's own pattern grammar, written HERE rather than imported.
 *
 * ⚠️ `lib/config.ts` exports a matcher and this file must not use it: asking
 * the guard's own matcher whether the guard holds is a variable equalling
 * itself, which is the warning at the head of this file. `*` is any sequence,
 * `?` is exactly one, nothing else is special.
 *
 * ┌─ 🛑 THIS COPY CARRIED THE SAME DEFECT AS THE GUARD AND THAT IS WHY THE ────┐
 * │ SUITE WOULD HAVE KEPT PASSING ON THE OLD SEMANTICS — G1091, 20 Sep 2026.  │
 * │ It anchored the pattern AS SPELLED, so the §2 assertion below proved      │
 * │ nothing about `health`, `he*`, `h*` or `hea?th`: the independent          │
 * │ re-derivation and the thing it was checking were wrong in the same place, │
 * │ which is the whole argument for an independent re-derivation failing.     │
 * │                                                                           │
 * │ **The missing sentence, from the CloudFront Developer Guide, "Cache       │
 * │ behavior settings" → "Path pattern", read 20 Sep 2026:** *"You can        │
 * │ optionally include a slash (/) at the beginning of the path pattern …     │
 * │ CloudFront behavior is the same with or without the leading /. If you     │
 * │ don't specify the / at the beginning of the path, this character is       │
 * │ automatically implied … CloudFront treats `/*product.jpg` the same as     │
 * │ `*product.jpg`"*                                                          │
 * │                                                                           │
 * │ **THE INDEPENDENCE ARGUMENT IS KEPT AND IS NOW STATED RATHER THAN         │
 * │ IMPLIED:** this stays a re-derivation because the guard's matcher also    │
 * │ normalises the REQUEST PATH (RFC 3986) and refuses two spellings          │
 * │ fail-closed that CloudFront may not treat as equivalent at all. Those are │
 * │ decisions a test must be able to disagree with. What it must NOT differ   │
 * │ on is the documented grammar, so the sentence above is transcribed here.  │
 * └───────────────────────────────────────────────────────────────────────────┘
 */
const patternMatches = (pattern, path) =>
  new RegExp(
    `^${(pattern.startsWith('/') ? pattern : `/${pattern}`)
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')}$`,
  ).test(path)

// ------------------------------- 1. the shape G293 rules, as G297 amends it

test('test_the_tenant_distribution_carries_one_per_region_wildcard_and_no_per_tenant_name', () => {
  const config = distribution()
  assert.deepEqual(
    config.Aliases,
    ['*.us-west-2.reconcileai.app'],
    'G297 restores G179 and G183: one wildcard PER REGION. It is still ONE alias and ' +
      'still a wildcard, so onboarding is still a row insert and no customer is in the ' +
      'public record - what changed is which hosts it is valid for. ' +
      'A per-tenant alias is readable through cloudfront:ListDistributions and needs a ' +
      'certificate SAN readable by the entire internet.',
  )
})

test('test_no_tenant_alias_is_flat_because_a_flat_wildcard_is_valid_in_every_region', () => {
  /* 🛑 THE ASSERTION THAT IS THE RULING. Written as a PROPERTY of every alias
   * rather than as an equality with one string, so it keeps biting when a
   * second alias is added by somebody who has not read G179. */
  for (const alias of distribution().Aliases) {
    assert.ok(
      alias.endsWith('.us-west-2.reconcileai.app'),
      `'${alias}' is a tenant alias with no region label. G179: "A flat wildcard is ` +
        'cryptographically valid in EVERY region, so an EU tenant misrouted to a US plane ' +
        'FAILS OPEN AND IS INVISIBLE; a region label makes that misroute fail closed at TLS." ' +
        'That is invariant 7 held at the transport layer instead of by an application check.',
    )
  }
})

test('test_the_console_distribution_serves_the_two_flat_hosts_the_owner_named_and_nothing_else', () => {
  assert.deepEqual(
    consoleDistribution().Aliases.slice().sort(),
    ['console.reconcileai.app', 'partners.reconcileai.app'],
    'G297: the consoles stay FLAT. They are NAMED rather than wildcarded, and that is ' +
      'the load-bearing half: an alias of *.reconcileai.app on a distribution holding the ' +
      'flat certificate would answer ten-acme.reconcileai.app with a VALID handshake and ' +
      'hand the fail-open straight back at a second resource.',
  )
})

test('test_no_console_host_carries_a_region_label_because_a_console_has_no_tenant', () => {
  /* 🛑 THE OTHER DIRECTION, AND IT IS AN ASSERTION RATHER THAN AN OMISSION.
   * G297: "A region label on a control-plane host would ASSERT A RESIDENCY THE
   * CONTROL PLANE DOES NOT HAVE" - invariant 3 says it holds no tenant data, so
   * the label would be decorative in the one place decoration is most likely to
   * be read as meaning something. */
  for (const alias of consoleDistribution().Aliases) {
    assert.equal(
      alias.split('.').length,
      3,
      `'${alias}' carries a region label. A console has no tenant to place, and ` +
        'invariant 3 says the control plane holds no tenant data.',
    )
  }
})

test('test_the_two_distributions_do_not_share_a_certificate', () => {
  /* 🛑 ONE CERTIFICATE COVERING BOTH GRAMMARS TYPE-CHECKS, SYNTHESISES, DEPLOYS
   * CLEAN - AND IS VALID FOR ten-acme.reconcileai.app, which is the whole
   * fail-open. Nothing but this assertion and a live openssl handshake can see
   * it, because the two props are the same TypeScript type. */
  const tenant = JSON.stringify(distribution().ViewerCertificate.AcmCertificateArn)
  const flat = JSON.stringify(consoleDistribution().ViewerCertificate.AcmCertificateArn)
  assert.notEqual(
    tenant,
    flat,
    'G297 rules TWO certificates and CloudFront reads ONE viewer certificate per ' +
      'distribution. Pointing the tenant distribution at the flat console certificate ' +
      'restores the G293 grammar silently: every tenant is servable at a flat host again.',
  )
})

/**
 * ⛔ **THIS TEST WAS `test_the_console_distribution_reaches_no_plane_at_all`
 * UNTIL 22 Sep 2026 AND IT IS REPLACED RATHER THAN DELETED — G1951.** It
 * required `CacheBehaviors.length === 0` and `Origins.length === 1`, on the
 * reasoning that *"an origin pointed at the control plane would route the
 * public internet to a process that 404s 59 declared operations."*
 *
 * 🛑 **THAT REASONING IS UNTOUCHED AND IS ASSERTED BELOW, BECAUSE IT WAS ABOUT
 * THE CONTROL PLANE AND THIS ORIGIN IS THE DATA PLANE'S.** What the old
 * assertion actually forbade was ANY behaviour, which is a much wider claim
 * than its own message made — the landmark again. The replacement is the
 * narrow property the owner's S7 ruling permits and nothing wider: **exactly
 * the one pattern `/lookup` needs, and no tenant-scoped prefix.**
 *
 * ⚠️ **A DELETED ASSERTION IS NOT A CONTROL, SO THIS ONE IS STRICTLY
 * STRONGER THAN WHAT IT REPLACES ON THE AXIS THAT MATTERS**: the old form
 * would have passed a console distribution routing `/v1/*` the day somebody
 * flipped the zero to a four; this one names the pattern.
 */
/* ✅ G2770 — THE OWNER'S RULING, 2 Oct 2026: *"route the full sign-in paths
 * (/session/*, /signin/callback, and the consoles' served /v1 operations) on
 * console.reconcileai.app and partners.reconcileai.app to the data plane, under
 * the existing WAF rate rule."* THIS TEST WAS
 * `test_the_console_distribution_reaches_the_plane_on_one_pattern_and_no_tenant_prefix`
 * AND PINNED `['/session/realm']`; its old message is KEPT below as the history
 * it is. `/signin/callback` is the SPA's route and is NOT a plane pattern: the
 * bundle must keep answering it, which is what this list's absence of it asserts. */
test('test_the_console_distribution_reaches_the_plane_on_the_four_served_patterns_and_never_signin_callback', () => {
  const config = consoleDistribution()
  const behaviours = config.CacheBehaviors ?? []
  assert.deepEqual(
    behaviours.map((b) => b.PathPattern).sort(),
    ['/context/*', '/session', '/session/*', '/v1/*'],
    'G2770 SUPERSEDES THE FOLLOWING. G1949: the console distribution reaches the data plane on the ONE path `/lookup` ' +
      'proxies to and nothing else. `/v1/*` and `/context/*` are tenant-scoped, a console ' +
      'host carries no tenant label, and resolveServingHost() is a LOOKUP that would ' +
      'resolve nothing. (G1991: this message used to end "and G180 REVOKES the session on ' +
      'a host mismatch, so routing them here would sign people out rather than 404." That ' +
      'reason is WRONG - the __Host- cookie is host-only, so no tenant cookie ever reaches ' +
      'a console host: the answer is 401 with no cookie, then 403 tenant_context_missing. ' +
      'The DECISIVE argument is the SPA rewrite: `realm` has no dot, so without a ' +
      'behaviour the BUNDLE answers POST /session/realm with 200 HTML.) `/session/*` is ' +
      'refused too: it carries completeFederatedSignIn, whose host binding G315 rules is ' +
      'the TENANT host and nowhere else. A second pattern is a decision about what this ' +
      'product publishes.',
  )
  assert.equal(
    config.Origins.length,
    2,
    'the bundle and the DATA plane. A THIRD origin here is the control plane, and that ' +
      'is the one that must never be added: mountTier() is never called for the ' +
      'administration tier, so it would route the public internet to a process that 404s ' +
      '59 declared operations. Invariant 3 is where G293 left it.',
  )
  const vpc = config.Origins.filter((o) => o.VpcOriginConfig !== undefined)
  assert.equal(vpc.length, 1, 'exactly one plane origin on the console distribution')
})

/**
 * 🛑 ONE `AWS::CloudFront::VpcOrigin` FOR BOTH DISTRIBUTIONS — G1950.
 *
 * Two would be two sets of ENIs in the VPC and a second thing to keep in step,
 * for no property gained: one ALB, one VPC origin. It also matters for §3
 * below — CloudFront's `CloudFront-VPCOrigins-Service-SG` is per VPC, so ONE
 * ingress rule still covers both distributions, and a second VPC origin would
 * invite somebody to add a second rule that is not needed.
 */
test('test_the_two_distributions_share_one_vpc_origin_rather_than_minting_a_second', () => {
  const vpcOrigins = resourcesOfType(edge(), 'AWS::CloudFront::VpcOrigin')
  assert.equal(
    vpcOrigins.length,
    1,
    'one ALB, one VPC origin, two distributions referencing it. A second would add a ' +
      'second set of ENIs and a second name to keep unique, and would buy nothing: ' +
      `got ${vpcOrigins.length}`,
  )
  const ids = new Set(
    distributionConfigs().flatMap((c) =>
      (c.Origins ?? [])
        .filter((o) => o.VpcOriginConfig !== undefined)
        .map((o) => JSON.stringify(o.VpcOriginConfig.VpcOriginId)),
    ),
  )
  assert.equal(ids.size, 1, `both distributions must name the SAME VpcOriginId: ${[...ids]}`)
})

test('test_the_distribution_has_exactly_two_origins_and_the_control_plane_is_not_one_of_them', () => {
  const origins = distribution().Origins
  assert.equal(
    origins.length,
    2,
    'G293: the bundle and the data plane. The control plane is deliberately not ' +
      'an origin - the two console tiers (administration.openapi.yaml and, ' +
      'since the split of 19 Sep 2026, platform-console.openapi.yaml) declare ' +
      '59 operations between them and mountTier() is never called for either, ' +
      'so an origin pointed at it ' +
      `would route the public internet to a process that 404s everything: ${JSON.stringify(origins)}`,
  )
  const vpcOrigins = origins.filter((o) => o.VpcOriginConfig !== undefined)
  assert.equal(vpcOrigins.length, 1, 'exactly one VPC origin, and it is the data plane')
  const s3Origins = origins.filter((o) => o.S3OriginConfig !== undefined)
  assert.equal(s3Origins.length, 1)
  assert.ok(
    s3Origins[0].OriginAccessControlId,
    'G263: no static keys. The bundle bucket is reached by OAC, not by a public ' +
      'read policy and not by an origin access identity.',
  )
})

test('test_the_plane_origin_is_a_vpc_origin_on_the_planes_own_port_and_never_a_public_hostname', () => {
  const [, vpcOrigin] = resourcesOfType(edge(), 'AWS::CloudFront::VpcOrigin')[0]
  const config = vpcOrigin.Properties.VpcOriginEndpointConfig
  assert.equal(
    config.HTTPPort,
    9080,
    'planes-stack.ts: "THE PORT IS NOT A PREFIX". The data listener has a default ' +
      'action and no rules, so this port IS the routing.',
  )
  assert.equal(config.OriginProtocolPolicy, 'http-only')
  assert.ok(
    JSON.stringify(config.Arn).includes('Fn::ImportValue'),
    'the ALB arrives by construct reference so CloudFormation orders Planes before Edge',
  )
})

// ----------------------------- 2. the behaviour settings that are controls

test('test_the_plane_is_reached_by_four_explicit_patterns_and_context_resolve_is_one_of_them', () => {
  /* 🛑 G1011, AND THE MEASUREMENT IS WHY THIS ASSERTION EXISTS AT ALL. On
   * 20 Sep 2026 the deployed distribution carried ONE behaviour, `/v1/*`, and
   *   POST https://ten-acme.us-west-2.reconcileai.app/context/resolve -> 403 text/html
   *   POST https://ten-acme.us-west-2.reconcileai.app/v1/runs         -> 401 application/problem+json
   * D1 - the operation that binds a session to a tenant - was unreachable from
   * the internet for the whole life of the stack. `basePathOf()` reads a tier's
   * FIRST servers[].url, so capability.openapi.yaml serves under /v1 while
   * foundation and session serve at the ROOT. Typed here, never imported. */
  const patterns = planeBehaviours().map((b) => b.PathPattern).sort()
  assert.deepEqual(
    patterns,
    ['/context/*', '/session', '/session/*', '/v1/*'],
    'the plane is reached by exactly these four patterns - and `/session` is a SEPARATE one ' +
      'because CloudFront`s /session/* does not match it, exactly as /v1/* does not match /v1. ' +
      'A fifth is a decision ' +
      'about what this product publishes to the internet and belongs in ' +
      'EDGE_PLANE_PATH_PATTERNS with its argument, not in a behaviour map.',
  )
})

test('test_no_behaviour_publishes_the_plane_processs_own_health_status_or_metrics', () => {
  /* 🛑 THE ASSERTION THIS SLICE EXISTS FOR, AND IT IS NOT ABOUT THE THREE
   * STRINGS ABOVE - it is about every pattern that will ever be added.
   * data-plane-local.openapi.yaml declares its server as http://localhost:9090,
   * so its three operations sit at the ROOT of the same process, and
   * checkLocalHealth is MOUNTED. A catch-all publishes an operational surface
   * with no session on it, no capability gate and no invariant 10 record.
   *
   * ⚠️ WITNESSED RED: with `/*` added to EDGE_PLANE_PATH_PATTERNS and the
   * synth guard removed, this test fails naming /health, /status and /metrics.
   * With the guard in place the fixture below cannot even synth.
   *
   * 🛑 IT READS `everyPlaneBehaviour()` SINCE 22 Sep 2026 — G1951 — SO IT
   * COVERS THE CONSOLE DISTRIBUTION TOO. Those three operations sit at the
   * ROOT of the SAME PROCESS, so a widening of
   * EDGE_CONSOLE_PLANE_PATH_PATTERNS publishes them exactly as a widening of
   * the tenant list would, and this assertion pointed at one of two lists
   * would be a control a reader believes covers both. */
  for (const behaviour of everyPlaneBehaviour()) {
    for (const local of ['/health', '/status', '/metrics']) {
      assert.equal(
        patternMatches(behaviour.PathPattern, local),
        false,
        `the pattern ${behaviour.PathPattern} publishes ${local} to the internet. That is a ` +
          'data-plane-local.openapi.yaml operation - the plane process own health, status and ' +
          'metrics - and it is served to a load balancer inside the VPC, ungated and unrecorded.',
      )
    }
  }
})

test('test_a_catch_all_fails_synth_and_the_error_names_the_operations_it_would_publish', () => {
  const run = runInfraScript('test-fixtures/edge-catch-all.ts')
  assert.notEqual(
    run.status,
    0,
    `a catch-all path pattern synthesised successfully: ${run.stdout}${run.stderr}`,
  )
  const message = `${run.stdout}${run.stderr}`
  for (const local of ['/health', '/status', '/metrics']) {
    assert.ok(
      message.includes(local),
      `the refusal must name ${local}, or a reader learns that /* is refused and not why: ${message}`,
    )
  }
  assert.ok(
    message.includes('EDGE_PLANE_PATH_PATTERNS'),
    'the refusal must name the constant that is the repair',
  )
})

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * 🛑 G1091, 20 Sep 2026 — THE GUARD PUBLISHED A TOTALITY CLAIM IT DID NOT HAVE,
 *    AND THE THREE TESTS BELOW DRIVE THE SEMANTICS RATHER THAN A LIST OF
 *    SPELLINGS SOMEBODY REMEMBERED.
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * The guard's own docblock said: *"a catch-all is refused BECAUSE `/*` matches
 * `/health`, never because it is spelled `/*` … **and the sixth spelling nobody
 * predicted is refused by the same one**."* **That sentence was false**, and the
 * measurement is the argument — the guard's verdicts on the same six spellings
 * before and after this slice, captured rather than described:
 *
 *     pattern        BEFORE     AFTER
 *     "health"       ACCEPTED   REFUSED     CloudFront routes /health
 *     "status"       ACCEPTED   REFUSED     CloudFront routes /status
 *     "metrics"      ACCEPTED   REFUSED     CloudFront routes /metrics
 *     "he*"          ACCEPTED   REFUSED     CloudFront routes /health
 *     "h*"           ACCEPTED   REFUSED     CloudFront routes /health
 *     "hea?th"       ACCEPTED   REFUSED     CloudFront routes /health
 *     "/h*"          REFUSED    REFUSED     the same behaviour, one char longer
 *     "/v1/*"        ACCEPTED   ACCEPTED    the four live patterns do not move
 *     "/context/*"   ACCEPTED   ACCEPTED
 *     "/session"     ACCEPTED   ACCEPTED
 *     "/session/*"   ACCEPTED   ACCEPTED
 *
 * ⚠️ **THE GUARD IS IMPORTED HERE AND THAT DOES NOT BREAK THIS FILE'S RULE.**
 * The rule at the head is that an EXPECTED VALUE must not come from
 * `infra/lib/`; `assertPublishesNoLocalOperation()` is the SUBJECT, not an
 * expectation. Every expectation below comes from the independently written
 * `patternMatches()` above or from a string typed into this file.
 */
const { assertPublishesNoLocalOperation } = await import(
  new URL('../../infra/lib/config.ts', import.meta.url)
)

/** Does the guard refuse this pattern? The subject, reduced to a boolean. */
const guardRefuses = (pattern) => {
  try {
    assertPublishesNoLocalOperation(pattern)
    return false
  } catch {
    return true
  }
}

/**
 * A corpus wide enough that no member of it is the rule.
 *
 * Every shape the grammar admits, at every position, spelled BOTH ways — with
 * a leading slash and without — because that equivalence is the property
 * G1091 found missing.
 */
const SPELLINGS = [
  '*',
  '**',
  'health',
  'status',
  'metrics',
  'h*',
  'he*',
  'hea?th',
  '*ealth',
  'health*',
  '?ealth',
  '*al*',
  '*t*',
  's*',
  'm*',
  '*health',
  '??????',
  '???????',
  'v1/*',
  'context/*',
  'session',
  'session/*',
  'assets/*',
  'index.html',
  'Health*',
  'HEALTH',
]

test('test_the_guard_gives_the_same_verdict_with_and_without_the_leading_slash', () => {
  /**
   * 🛑 THE PROPERTY, NOT THE SIX STRINGS. AWS: *"CloudFront behavior is the
   * same with or without the leading /."* So a guard that answers differently
   * for `X` and `/X` is wrong about at least one of them, whichever way round
   * — and a repair that fixed the six spellings red happened to try, while
   * leaving the equivalence unstated, would pass a list and fail this.
   */
  for (const spelling of SPELLINGS) {
    const bare = spelling.replace(/^\//, '')
    assert.equal(
      guardRefuses(bare),
      guardRefuses(`/${bare}`),
      `the guard answers differently for '${bare}' and '/${bare}'. CloudFront does not: ` +
        '"You can optionally include a slash (/) at the beginning of the path pattern ... ' +
        'CloudFront behavior is the same with or without the leading /." Until 20 Sep 2026 ' +
        'this file could not see that, because the matcher above carried the same defect.',
    )
  }
})

test('test_the_guard_refuses_exactly_the_spellings_that_reach_a_local_operation', () => {
  /**
   * 🛑 THE DIFFERENTIAL, AND IT IS THE TEST THE OLD SUITE COULD NOT HAVE
   * WRITTEN. `patternMatches()` above is this file's own transcription of
   * CloudFront's documented grammar; the guard is `infra/lib/config.ts`'s. This
   * asserts they agree on every spelling in the corpus.
   *
   * ⚠️ **THE GUARD IS PERMITTED TO BE STRICTER IN TWO NAMED PLACES AND NOWHERE
   * ELSE**, and both widenings are argued at the guard rather than here: the
   * percent-decoded spelling of a PATTERN, and the trailing-slash form of a
   * local path. Neither can arise from the corpus above — no member carries a
   * `%` or ends in `/` — so on this corpus the two must agree EXACTLY, and a
   * third widening somebody adds quietly shows up as a disagreement rather
   * than as a guard that refuses more than it can explain.
   */
  for (const spelling of SPELLINGS) {
    const reaches = ['/health', '/status', '/metrics'].filter((local) =>
      patternMatches(spelling, local),
    )
    assert.equal(
      guardRefuses(spelling),
      reaches.length > 0,
      reaches.length > 0
        ? `CloudFront routes ${reaches.join(', ')} through '${spelling}' and the guard ` +
            'accepts it. Those are data-plane-local.openapi.yaml operations: no session, ' +
            'no capability gate, no invariant 10 record, served to the internet.'
        : `the guard refuses '${spelling}', which reaches no local operation. A false ` +
            'refusal is cheap and a false acceptance is not, but an UNARGUED one is ' +
            'neither — say why at the guard if a third widening is wanted.',
    )
  }
})

test('test_the_four_live_patterns_are_accepted_and_this_slice_moved_none_of_them', () => {
  /* The deployed tenant distribution carries exactly these four — read
   * read-only from AWS on 20 Sep 2026 with
   *   aws cloudfront get-distribution-config --id E37L34MTF5K0VB \
   *     --query 'DistributionConfig.CacheBehaviors.Items[].PathPattern'
   * A repair to the guard that also changed what it publishes would be a
   * deployment change wearing a bug fix's clothes. Typed, not imported. */
  for (const live of ['/v1/*', '/context/*', '/session', '/session/*']) {
    assert.equal(
      guardRefuses(live),
      false,
      `the guard now refuses '${live}', which the deployed distribution serves. ` +
        'Tightening the matcher must not narrow the published surface.',
    )
  }
})

test('test_a_pattern_with_no_leading_slash_fails_synth_at_the_real_call_site', () => {
  /**
   * 🛑 THE UNIT TESTS ABOVE CALL THE GUARD; THIS ONE WITNESSES THE CALL SITE.
   *
   * `EdgeStackProps.extraPlanePathPatterns` is *"SERVED AS WELL AS
   * VALIDATED"*, so the consequence of the escape was not a weak function — it
   * was a synthesised CloudFront behaviour publishing `/health`. The catch-all
   * fixture above witnesses `/*`; this one witnesses the spelling that ACTUALLY
   * got through, and the two are different fixtures because a guard can be
   * repaired for one and not the other.
   */
  const run = runInfraScript('test-fixtures/edge-unslashed-local.ts')
  assert.notEqual(
    run.status,
    0,
    `the pattern 'health' synthesised successfully, so a CloudFront behaviour publishing ` +
      `the plane's own /health reached a template: ${run.stdout}${run.stderr}`,
  )
  const message = `${run.stdout}${run.stderr}`
  assert.ok(
    message.includes('/health'),
    `the refusal must name /health, or a reader learns that 'health' is refused and not ` +
      `why: ${message}`,
  )
  assert.ok(
    message.includes('EDGE_PLANE_PATH_PATTERNS'),
    'the refusal must name the constant that is the repair',
  )
})

test('test_every_plane_behaviour_carries_the_same_four_settings_and_not_just_the_first', () => {
  /* §5.3: three copies of a TENANT-ISOLATION setting is three places to drift,
   * and the copy is always the one that drifts. The stack states them once and
   * spreads them; this asserts the result across all of them rather than
   * across `/v1/*` alone.
   *
   * 🛑 AND ACROSS BOTH DISTRIBUTIONS SINCE 22 Sep 2026 — G1951. The console
   * behaviour spreads the SAME object, and `everyPlaneBehaviour()` is what
   * makes that a measured fact rather than a promise: a second behaviour map
   * is out of sight of an assertion that reads only the first resource, which
   * is the longer-fuse version of the pasted-CACHING_OPTIMIZED defect this
   * test already exists for. */
  for (const behaviour of everyPlaneBehaviour()) {
    assert.equal(behaviour.CachePolicyId, MANAGED_CACHING_DISABLED, behaviour.PathPattern)
    assert.equal(behaviour.OriginRequestPolicyId, MANAGED_ALL_VIEWER, behaviour.PathPattern)
    assert.equal(behaviour.FunctionAssociations, undefined, behaviour.PathPattern)
    for (const method of ['GET', 'HEAD', 'OPTIONS', 'PUT', 'PATCH', 'POST', 'DELETE']) {
      assert.ok(behaviour.AllowedMethods.includes(method), `${method} on ${behaviour.PathPattern}`)
    }
  }
})


test('test_caching_is_disabled_on_the_plane_behaviour_because_a_cache_key_without_host_is_a_cross_tenant_read', () => {
  assert.equal(
    planeBehaviour().CachePolicyId,
    MANAGED_CACHING_DISABLED,
    'Under G179 one host serves one tenant and every tenant reaches THIS ' +
      'distribution. A CloudFront cache key does not include Host unless a policy ' +
      'says so, so a cached /v1 response would be served to another tenant - a ' +
      'cross-tenant read performed by a CDN, invisible to every control in db/ and ' +
      'model/ because no query ever runs. A slice that wants caching here must put ' +
      'Host in the cache key and must say so out loud.',
  )
})

test('test_the_viewer_host_header_is_forwarded_to_the_plane_or_g179_resolves_nothing', () => {
  assert.equal(
    planeBehaviour().OriginRequestPolicyId,
    MANAGED_ALL_VIEWER,
    'By default CloudFront replaces Host with the ORIGIN domain name, so the plane ' +
      'would see the ALB and resolveServingHost() would resolve nothing. G293: ' +
      '"tenant identity comes from the Host header ... the distribution forwards ' +
      'it; it does not interpret it."',
  )
})

test('test_every_method_the_capability_tier_declares_is_allowed_on_the_plane_behaviour', () => {
  for (const method of ['GET', 'HEAD', 'OPTIONS', 'PUT', 'PATCH', 'POST', 'DELETE']) {
    assert.ok(
      planeBehaviour().AllowedMethods.includes(method),
      `${method} is not allowed; a mounted write would be refused BY CLOUDFRONT with a status ` +
        'no contract declares. ⚠️ THIS MESSAGE SAID 405 UNTIL 22 Sep 2026 AND THE NUMBER WAS ' +
        'NEVER MEASURED (G2025): CloudFront answers 403 MethodNotAllowed for a method outside ' +
        'AllowedMethods, at the edge, before the origin is asked — which is the same 403 this ' +
        "file's own header records for POST /context/resolve under G1011. The assertion is " +
        'unchanged; only the number in the message was wrong.',
    )
  }
})

test('test_the_spa_rewrite_is_attached_to_the_bundle_behaviour_and_never_to_the_plane_behaviour', () => {
  /* 🛑 THE ONE THAT WOULD BE EASIEST TO GET WRONG AND HARDEST TO NOTICE. A
   * DISTRIBUTION-WIDE errorResponses rewrite would turn every unmounted
   * operation's 404 into 200 HTML - G191's "a declared operation with no
   * handler 404s" falsified by an edge setting, in the direction that hides it.
   * 132 of the 136 declared operations are unmounted; derive it rather than
   * reading it, which is why no number is asserted below. */
  const config = distribution()
  assert.equal(
    config.CustomErrorResponses,
    undefined,
    'custom error responses are DISTRIBUTION-WIDE and would rewrite the plane 404s too',
  )
  assert.equal(
    (config.DefaultCacheBehavior.FunctionAssociations ?? []).length,
    1,
    'the deep-link rewrite belongs on the bundle behaviour',
  )
  assert.equal(
    planeBehaviour().FunctionAssociations,
    undefined,
    'nothing may sit between the browser and the plane',
  )
})

test('test_the_cloudfront_function_name_is_set_explicitly_and_fits', () => {
  /* Trap 6 of deploy-handoff.md section 3 at a second service: a name derived
   * from a construct path came out at 76 characters against a limit of 64. */
  const [, fn] = resourcesOfType(edge(), 'AWS::CloudFront::Function')[0]
  assert.equal(fn.Properties.Name, 'reconcile-staging-spa-rewrite')
  assert.ok(fn.Properties.Name.length <= 64)
})

// ------------------------------------ 3. the planes stay internal

test('test_the_alb_is_admitted_from_a_security_group_and_never_from_a_cidr', () => {
  const rules = resourcesOfType(edge(), 'AWS::EC2::SecurityGroupIngress')
  assert.equal(rules.length, 1, 'exactly one ingress rule is added by this stack')
  const props = rules[0][1].Properties
  assert.equal(props.CidrIp, undefined, 'deploy-handoff.md section 2: an ALB admitting a CIDR is a fence nobody removes')
  assert.equal(props.CidrIpv6, undefined)
  assert.ok(
    props.SourceSecurityGroupId,
    'the source must be the security group CloudFront itself creates for the VPC origin',
  )
  assert.equal(props.FromPort, 9080)
  assert.equal(props.ToPort, 9080)
})

test('test_no_load_balancer_anywhere_in_the_app_became_internet_facing', () => {
  /* The property the VPC origin exists to preserve, asserted over the WHOLE app
   * rather than over this stack - a second internet-facing ALB elsewhere would
   * defeat it just as completely. */
  const public_ = Object.entries(templates).flatMap(([name, template]) =>
    resourcesOfType(template, 'AWS::ElasticLoadBalancingV2::LoadBalancer')
      .filter(
        ([, r]) =>
          (r.Properties?.Scheme ?? 'internet-facing') !== 'internal',
      )
      .map(([logicalId]) => `${name}/${logicalId}`),
  )
  assert.deepEqual(public_, [], 'both planes stay internal; only a CloudFront VPC origin reaches them')
})

// ------------------------- 4. the reserved labels, witnessed RED

test('test_a_reserved_label_fails_synth_and_the_error_names_the_ruling', () => {
  const run = runInfraScript('test-fixtures/edge-reserved-label.ts')
  assert.notEqual(
    run.status,
    0,
    'G179 reserves labels a tenant may not be slugged. A guard that cannot be ' +
      'witnessed failing asserts nothing (docs/HANDOFF.md 5.6).',
  )
  assert.match(run.stderr, /RESERVED host label/)
  assert.match(run.stderr, /G180/)
})

test('test_a_flat_tenant_host_fails_synth_and_the_error_names_the_ruling', () => {
  /* 🛑 G297's RED WITNESS. assertCarriesRegionLabel() runs over the real alias
   * list, so the day somebody puts the flat grammar back the gate is red before
   * a deploy exists - but the real app passes only the per-region wildcard, so
   * a green synth witnesses nothing about the refusal. docs/HANDOFF.md 5.6.
   *
   * The host in the fixture is the exact one staging served on 19 Sep 2026. */
  const run = runInfraScript('test-fixtures/edge-flat-tenant-host.ts')
  assert.notEqual(run.status, 0, 'a tenant host with no region label must fail synth')
  assert.match(run.stderr, /no region label/)
  assert.match(run.stderr, /FAILS OPEN/)
  assert.match(run.stderr, /ten-acme\.reconcileai\.app/)
})

test('test_the_reserved_list_claims_the_two_hosts_the_owner_named', () => {
  /* The list is in infra/lib/config.ts as a total Record, so a label without a
   * claim is TS2741. This is the other direction: the two hosts the owner named
   * on 19 Sep 2026 must BE on it, or a tenant could be slugged into one. */
  const run = runInfraScript('test-fixtures/edge-reserved-label.ts')
  for (const label of ['console', 'partners', 'www', 'api', 'admin', 'mail']) {
    assert.match(
      run.stderr,
      new RegExp(`\\b${label}\\b`),
      `'${label}' must be reserved; the guard prints the whole list on refusal`,
    )
  }
})

// ------------------- 5. what the world can read, and what it cannot

test('test_there_are_two_certificates_and_neither_carries_a_subject_alternative_name', () => {
  const t = templates[CERT]
  assert.ok(t, `${CERT} is not in the synthesised app`)
  const certs = resourcesOfType(t, 'AWS::CertificateManager::Certificate')
  assert.equal(
    certs.length,
    2,
    'G297: two certificates, and it is FORCED rather than chosen - CloudFront reads ' +
      'exactly one viewer certificate per distribution, so two host grammars cannot ' +
      'share one. "Cost accepted: two certificates, the flat apex and the per-region ' +
      'wildcard."',
  )
  const names = certs.map(([, c]) => c.Properties.DomainName).sort()
  assert.deepEqual(
    names,
    ['*.reconcileai.app', '*.us-west-2.reconcileai.app'],
    'the flat one is the CONSOLES and the marketing plane; the per-region one is the ' +
      'TENANTS. A wildcard matches exactly one label, so the tenant certificate is valid ' +
      'for no flat host in any region - which IS the fail-closed property.',
  )
  for (const [, cert] of certs) {
    const props = cert.Properties
    assert.equal(
      props.SubjectAlternativeNames,
      undefined,
      'Certificate Transparency logs are public, append-only and indexed. A SAN per ' +
        'tenant publishes the customer list to the entire internet, permanently, at a ' +
        'URL needing no credential - the disclosure G260 refuses for a tag and ' +
        'tenantKeyAliasName() refuses for a KMS alias, arriving at the only one of ' +
        'the three that needs no permission at all.',
    )
    assert.equal(props.ValidationMethod, 'DNS', 'email validation needs a human every renewal')
  }
})

test('test_dns_is_wildcards_and_two_named_console_hosts_so_nxdomain_is_not_an_oracle', () => {
  const records = resourcesOfType(edge(), 'AWS::Route53::RecordSet')
  const names = records.map(([, r]) => `${r.Properties.Type} ${r.Properties.Name}`).sort()
  assert.deepEqual(
    names,
    [
      'A *.reconcileai.app.',
      'A *.us-west-2.reconcileai.app.',
      'A console.reconcileai.app.',
      'A partners.reconcileai.app.',
      'AAAA *.reconcileai.app.',
      'AAAA *.us-west-2.reconcileai.app.',
      'AAAA console.reconcileai.app.',
      'AAAA partners.reconcileai.app.',
    ],
    'NO PER-TENANT RECORD, on either grammar. Per-tenant A records restore the ' +
      'enumeration oracle the wildcard certificate removed: NXDOMAIN versus an answer is ' +
      'a clean yes/no about whether a company is a customer. The two NAMED records are ' +
      'the consoles, which are ours and are already declared servers in ' +
      'administration.openapi.yaml.',
  )
})

test('test_the_flat_wildcard_record_is_kept_and_points_at_the_tenant_distribution', () => {
  /* 🛑 THE SINKHOLE, AND IT LOOKS LIKE DEAD WEIGHT. *.reconcileai.app still
   * resolves - so DNS answers nothing about who is a customer - and it points
   * at the distribution whose certificate does NOT cover a flat host, so
   * ten-acme.reconcileai.app fails at the TLS HANDSHAKE rather than at NXDOMAIN
   * and rather than at the application. Both are refusals; only one of them is
   * the refusal G179 describes, and only one can be demonstrated without also
   * proving the host does not exist. */
  const records = resourcesOfType(edge(), 'AWS::Route53::RecordSet')
  const flat = records.filter(([, r]) => r.Properties.Name === '*.reconcileai.app.')
  assert.equal(flat.length, 2, 'the sinkhole answers on both address families')
  const tenantTargets = new Set(
    records
      .filter(([, r]) => r.Properties.Name === '*.us-west-2.reconcileai.app.')
      .map(([, r]) => JSON.stringify(r.Properties.AliasTarget.DNSName)),
  )
  for (const [logicalId, record] of flat) {
    assert.ok(
      tenantTargets.has(JSON.stringify(record.Properties.AliasTarget.DNSName)),
      `${logicalId} must point at the TENANT distribution. Pointed at the console one ` +
        'it would answer every flat tenant host with a valid certificate, which is the ' +
        'fail-open G297 exists to end.',
    )
  }
})

test('test_no_resource_in_either_edge_stack_carries_a_tenant_tag', () => {
  for (const name of [EDGE, CERT]) {
    for (const [logicalId, resource] of Object.entries(templates[name].Resources)) {
      for (const forbidden of ['TenantId', 'Tenant', 'TenantRef']) {
        assert.equal(
          (resource.Properties?.Tags ?? []).some?.((t) => t.Key === forbidden) ?? false,
          false,
          `G260: a per-tenant tag is a tenant enumeration in the clear; ${name}/${logicalId} carries ${forbidden}`,
        )
      }
    }
  }
})

test('test_both_edge_stacks_are_tagged_plane_edge', () => {
  for (const name of [EDGE, CERT]) {
    const tagged = Object.values(templates[name].Resources).filter((r) =>
      (r.Properties?.Tags ?? []).some?.((t) => t.Key === 'Plane'),
    )
    assert.ok(tagged.length > 0, `${name} has no tagged resource at all; this read nothing`)
    for (const resource of tagged) {
      assert.equal(
        resource.Properties.Tags.find((t) => t.Key === 'Plane').Value,
        'edge',
        'G260: Plane is the field invariant 3 is audited from, and a wrong value ' +
          'returns clean from the audit query - worse than no tag',
      )
    }
  }
})

// -------------------------------- 6. the bundle bucket is not the object bucket

test('test_the_frontend_bucket_blocks_all_public_access_and_is_not_the_tenant_object_bucket', () => {
  const buckets = resourcesOfType(edge(), 'AWS::S3::Bucket')
  assert.equal(buckets.length, 1)
  const props = buckets[0][1].Properties
  assert.deepEqual(props.PublicAccessBlockConfiguration, {
    BlockPublicAcls: true,
    BlockPublicPolicy: true,
    IgnorePublicAcls: true,
    RestrictPublicBuckets: true,
  })
  assert.equal(
    props.BucketName,
    'reconcile-000000000000-us-west-2-staging-frontend',
    'the account and region are in the name because an S3 bucket name is global',
  )
  assert.notEqual(
    props.BucketName,
    'reconcile-000000000000-us-west-2-staging-data-objects',
    'G287 bucket holds tenant payloads and is reachable by one IAM role. This one ' +
      'holds the bundle and is read by the whole internet through a distribution.',
  )
  assert.equal(
    (props.Tags ?? []).find((t) => t.Key === 'Plane')?.Value,
    'edge',
    'a bundle bucket tagged Plane=data would make the G287 one-bucket-per-data-plane ' +
      'assertion in storage.test.mjs fail, and would be a false statement besides',
  )
})

// ------------------------ 7. D6-4's rate-based rule, G1871

/**
 * `docs/build/d6-threat-model.md` §1.3/§4.5: ten concurrent anonymous
 * requests each hold a pooled database connection for the life of a
 * transaction, and the pool is ten. This section asserts the SHAPE of the
 * rule this repository chose to close (part of) that, not merely that a
 * WebACL resource exists — a resource with the wrong scope, the wrong
 * aggregation or no scope-down would pass "there is a WebACL" while leaving
 * the finding open or throttling the wrong thing.
 */

const rateLimitWebAcl = () => {
  const t = templates[CERT]
  assert.ok(t, `${CERT} is not in the synthesised app`)
  const found = resourcesOfType(t, 'AWS::WAFv2::WebACL')
  assert.equal(
    found.length,
    1,
    'exactly one WebACL - it lives in EdgeCertificate because AWS::WAFv2::WebACL with ' +
      'Scope: CLOUDFRONT must be created in us-east-1, the one region this app already ' +
      'has a stack in',
  )
  return found[0][1].Properties
}

test('test_the_rate_limit_web_acl_is_cloudfront_scoped_and_allows_by_default', () => {
  const props = rateLimitWebAcl()
  assert.equal(
    props.Scope,
    'CLOUDFRONT',
    'a REGIONAL-scope WebACL cannot be associated with a CloudFront distribution at all',
  )
  assert.deepEqual(
    props.DefaultAction,
    { Allow: {} },
    'this WebACL exists to add ONE rate-based rule, not to become a second ' +
      'authorisation layer - everything the rule does not match must pass exactly as ' +
      'it does today',
  )
})

test('test_the_rate_based_rule_aggregates_by_ip_over_the_shortest_window_aws_allows', () => {
  const props = rateLimitWebAcl()
  assert.equal(props.Rules.length, 1)
  const rule = props.Rules[0]
  const statement = rule.Statement.RateBasedStatement
  assert.ok(statement, 'the one rule must be a RateBasedStatement, not a different kind')
  assert.equal(
    statement.AggregateKeyType,
    'IP',
    'no auth-state signal is available at this layer: server/data-plane/session.ts\'s ' +
      "databaseReader() opens a pooled read for ANY well-formed-looking cookie value, " +
      'valid or forged, before the row is found absent - so a caller holding a cookie ' +
      'is not a caller who has been authenticated by the time the pool is touched',
  )
  assert.equal(
    statement.EvaluationWindowSec,
    60,
    'AWS WAF accepts only 60, 120, 300 or 600 for this field (verified against the ' +
      'pinned aws-cdk-lib CloudFormation type) - 60 is the shortest window available, ' +
      'so a sustained attack is throttled as fast as the mechanism can react',
  )
  assert.equal(
    statement.Limit,
    300,
    'chosen to pass ordinary browsing and a shared corporate NAT egress comfortably ' +
      '(300 req/60s = 5 req/s sustained) while blocking a script that repeats the ' +
      'ten-concurrent-request burst every second (600+ req/60s) within roughly one ' +
      'evaluation cycle. It does NOT and cannot block the first burst itself - a ' +
      'rate-based rule blocks only once the trailing count is EXCEEDED',
  )
  assert.equal(
    rule.Action?.Block !== undefined,
    true,
    'the rule must BLOCK on match, not merely count - a Count-only rule closes nothing',
  )
})

test('test_the_rate_limit_scope_down_covers_every_plane_pattern_and_never_the_bundle', () => {
  const props = rateLimitWebAcl()
  const orStatements = props.Rules[0].Statement.RateBasedStatement.ScopeDownStatement.OrStatement
  assert.ok(orStatements, 'without a scope-down this rule would also throttle the S3 bundle')
  const prefixes = orStatements.Statements.map((s) => s.ByteMatchStatement.SearchString).sort()
  assert.deepEqual(
    prefixes,
    ['/context/', '/session', '/v1/'],
    'THREE prefixes cover the FOUR entries of EDGE_PLANE_PATH_PATTERNS - STARTS_WITH ' +
      "'/session' matches both '/session' and '/session/*', exactly as CloudFront's " +
      'own two behaviours do. Every one of these is checked against the URI PATH, ' +
      'never the Host header, so this cannot become a second tenant-isolation surface',
  )
  for (const s of orStatements.Statements) {
    assert.equal(s.ByteMatchStatement.PositionalConstraint, 'STARTS_WITH')
    assert.equal(s.ByteMatchStatement.FieldToMatch?.UriPath !== undefined, true)
  }
})

test('test_every_public_session_operation_the_contract_declares_is_rate_limited_and_reaches_the_tenant_plane', () => {
  /* G2541 (1 Oct 2026): the owner's ruling puts `beginFederatedSignIn` under
   * "same D6 posture: WAF rate rule". The rule is keyed on URI PREFIXES, so a
   * new path is covered only if a prefix happens to match it — which is a
   * property nobody re-reads when they add a path. The paths are therefore
   * DERIVED from `docs/contracts/session.openapi.yaml` (every one of them is
   * public: `security: []` at document level) rather than typed here, so the
   * NEXT session operation is checked by this test without anybody editing
   * it. Witnessed RED: with '/session' replaced by the two exact paths that
   * existed before G2541, this fails on '/session/signin' by name. */
  const doc = readFileSync(join(REPO_ROOT, 'docs', 'contracts', 'session.openapi.yaml'), 'utf8')
  const paths = [...doc.matchAll(/^  (\/[^:\s]+):\s*$/gm)].map((m) => m[1])
  assert.ok(paths.includes('/session/signin'), 'the begin operation is not on the session tier')
  assert.ok(paths.length >= 4, `parsed only ${paths.length} session paths - the derivation is broken`)
  const props = rateLimitWebAcl()
  const prefixes = props.Rules[0].Statement.RateBasedStatement.ScopeDownStatement.OrStatement.Statements.map(
    (s) => s.ByteMatchStatement.SearchString,
  )
  const patterns = (distribution().CacheBehaviors ?? []).map((b) => b.PathPattern)
  for (const p of paths) {
    assert.ok(
      prefixes.some((prefix) => p.startsWith(prefix)),
      `${p} is a public session operation and D6-4's rate rule does not cover it`,
    )
    assert.ok(
      patterns.some((pattern) => (pattern.endsWith('*') ? p.startsWith(pattern.slice(0, -1)) : p === pattern)),
      `${p} does not reach the plane on the TENANT distribution - the bundle would answer it`,
    )
  }
})

/* ✅ G2770 — THIS WAS `test_only_the_tenant_distribution_carries_the_web_acl`.
 * Its premise — "the console distribution has NO plane origin" — went false
 * when G1949 gave it one path and is now four; the owner's ruling puts them
 * "under the existing WAF rate rule". The old message is kept below. */
test('test_both_distributions_carry_the_one_rate_limit_web_acl', () => {
  const tenant = distribution()
  const console_ = consoleDistribution()
  assert.deepEqual(console_.WebACLId, tenant.WebACLId, 'G2770: one rule, both distributions')
  assert.ok(
    tenant.WebACLId !== undefined,
    'the tenant distribution reaches the plane origin and is the whole of the ' +
      'pool-exhaustion exposure this rule closes',
  )
  assert.notEqual(
    console_.WebACLId,
    undefined,
    'SUPERSEDED BY G2770 — it read: the console distribution has NO plane origin at all (edge-stack.ts: "the control ' +
      'plane is still not an origin") and cannot touch the database pool through any ' +
      'request shape - a rate limit there would defend a threat D6 never measured',
  )
})
