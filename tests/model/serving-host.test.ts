/**
 * `resolveServingHost()` and the mint-time host rules — #229 [A-11], applying
 * G179 and citing G182, G183 and G207 rather than relitigating any of them.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE EXISTS FOR — THE CIRCULARITY
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `docs/contracts/capability.openapi.yaml:64` says `dataPlaneHost` is *"Per-
 * tenant. Resolved at sign-in, never guessed."* and **nothing anywhere said
 * HOW**: you need the host to sign in, and the host is resolved at sign-in.
 * G179's own words for it — *"The hole it closes is circular and the repo
 * already knew about it."* Verified absent before this slice:
 *
 *     grep -rniE '\b(servingHost|tenantHost|hostname|publicSuffix)\b' \
 *       model/*.ts                                              → nothing
 *
 * 🛑 RESOLUTION IS A CONFIGURATION LOOKUP, NEVER A PATTERN. `tenant =
 * subdomain(host)` breaks the moment a customer serves from its own domain
 * under BYOA (G36), where there is no tenant label to parse — **and it breaks
 * silently**, because every pooled tenant keeps working.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE MUTATION THAT IS THE BEHAVIOURAL CORE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Implement `resolveServingHost()` as `host.split('.')[0]` and watch exactly
 * one case fail — the delegated customer domain — while **every pooled case
 * still passes.** That shape is precisely what a review misses, so it is
 * `test_a_host_resolves_by_registry_lookup_and_never_by_parsing` and it is
 * named for the thing it forbids.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  HOST_LABEL_REFUSALS,
  REGION_HOST_LABEL,
  RESERVED_HOST_LABELS,
  RESIDENCY_REFUSALS,
  SERVING_HOST_KINDS,
  SERVING_HOST_REFUSALS,
  SERVING_HOST_REGISTRATION_REFUSALS,
  checkServingHostRegistration,
  checkServingHostResidency,
  checkTenantHostLabel,
  resolveServingHost,
} from '../../model/serving-host.ts'
import type { ServingHost } from '../../model/serving-host.ts'
import type { RegionKey } from '../../model/domain.ts'
import type { TenantId } from '../../model/kernel.ts'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SERVING_HOST_TEXT = readFileSync(
  join(REPO_ROOT, 'model', 'serving-host.ts'),
  'utf8',
)

const ACME = 'ten_acme' as TenantId
const GLOBEX = 'ten_globex' as TenantId
const NORTHWIND = 'ten_northwind' as TenantId

/** The pooled shape G179 rules: `{tenant}.{region}.{domain}`. */
const acmePooled: ServingHost = {
  kind: 'pooled',
  host: 'acme.ap-southeast-1.reconcile.invalid',
  tenantId: ACME,
  region: 'ap-southeast-1',
  status: 'active',
}

const globexPooled: ServingHost = {
  kind: 'pooled',
  host: 'globex.eu-west-1.reconcile.invalid',
  tenantId: GLOBEX,
  region: 'eu-west-1',
  status: 'active',
}

/**
 * 🛑 THE BYOA CASE, AND IT IS THE WHOLE POINT. A customer serving from its own
 * domain has NO TENANT LABEL TO PARSE — `finance` is a department, not a
 * tenant slug, and `northwind.example` is not our domain. A subdomain parser
 * returns `finance` and finds no tenant; a registry returns `ten_northwind`.
 */
const northwindDelegated: ServingHost = {
  kind: 'delegated',
  host: 'finance.northwind.example',
  tenantId: NORTHWIND,
  region: 'ap-southeast-1',
  status: 'active',
}

const registry: readonly ServingHost[] = [
  acmePooled,
  globexPooled,
  northwindDelegated,
]

/* ------------------------------------------------------------------ *
 * 1. Resolution is a lookup
 * ------------------------------------------------------------------ */

test('test_a_host_resolves_by_registry_lookup_and_never_by_parsing', () => {
  const out = resolveServingHost(registry, 'finance.northwind.example')
  assert.equal(out.ok, true)
  if (!out.ok) return
  assert.equal(
    out.tenantId,
    NORTHWIND,
    'G179: "`tenant = subdomain(host)` breaks the moment a customer serves from ' +
      'their own domain under BYOA, where there is no tenant label to parse — and ' +
      'it breaks silently."',
  )
  assert.equal(out.region, 'ap-southeast-1')
  assert.notEqual(
    out.tenantId as string,
    'finance',
    'a subdomain parser returns the leftmost label, which here is a department',
  )
})

test('every pooled host resolves too — the parser mutation leaves these green', () => {
  const acme = resolveServingHost(registry, 'acme.ap-southeast-1.reconcile.invalid')
  assert.equal(acme.ok === true ? acme.tenantId : null, ACME)
  const globex = resolveServingHost(registry, 'globex.eu-west-1.reconcile.invalid')
  assert.equal(globex.ok === true ? globex.tenantId : null, GLOBEX)
})

test('lookup folds case and trims, through the one host normaliser', () => {
  const out = resolveServingHost(registry, '  ACME.AP-Southeast-1.Reconcile.Invalid ')
  assert.equal(out.ok === true ? out.tenantId : null, ACME)
})

test('an unregistered host resolves to nothing rather than to a guess', () => {
  const out = resolveServingHost(registry, 'acme.reconcile.invalid')
  assert.equal(out.ok, false)
  assert.equal(out.ok === false ? out.refusal : null, 'host_not_registered')
})

test('an absent host is refused before anything is looked up', () => {
  const out = resolveServingHost(registry, '   ')
  assert.equal(out.ok, false)
  assert.equal(out.ok === false ? out.refusal : null, 'host_not_presented')
})

/**
 * ⚠️ AMBIGUITY IS COUNTED OVER EVERY ROW, AND THE ASYMMETRY WITH
 * `routeToConnection()` IS DELIBERATE. That function counts ambiguity over
 * VERIFIED claims only, because an unverified claim counting would let anyone
 * take a tenant's sign-in down by claiming its domain — *"a denial of service
 * is not an improvement on a takeover."* **There is no such adversary here.**
 * This registry is control-plane authored and published downward under C2, so
 * a duplicate row is OUR configuration error, and picking either row picks a
 * TENANT, which is the derivation invariant 1 rests on.
 */
test('test_a_host_registered_twice_refuses_rather_than_picking_a_tenant', () => {
  const duplicated: readonly ServingHost[] = [
    acmePooled,
    { ...acmePooled, tenantId: GLOBEX },
  ]
  const out = resolveServingHost(duplicated, acmePooled.host)
  assert.equal(out.ok, false)
  assert.equal(
    out.ok === false ? out.refusal : null,
    'host_registered_more_than_once',
  )
})

/**
 * 🛑 THE SHARP CASE, AND IT IS THE ONE THAT SEPARATES THIS PRECEDENCE FROM
 * `routeToConnection()`'s. One active row and one retired row for the same
 * host: an implementation that counts ambiguity over ACTIVE rows only finds
 * exactly one, resolves, and hands the request to whichever tenant happened
 * not to be retired. The duplicate is a configuration error whatever the
 * statuses are, and a stale row must not get to decide a tenant.
 */
test('test_a_duplicate_refuses_even_when_only_one_of_the_two_rows_is_active', () => {
  const duplicated: readonly ServingHost[] = [
    acmePooled,
    { ...acmePooled, tenantId: GLOBEX, status: 'retired' },
  ]
  const out = resolveServingHost(duplicated, acmePooled.host)
  assert.equal(out.ok, false)
  assert.equal(
    out.ok === false ? out.refusal : null,
    'host_registered_more_than_once',
  )
})

test('a retired host does not route, and says so specifically', () => {
  const retired: readonly ServingHost[] = [{ ...acmePooled, status: 'retired' }]
  const out = resolveServingHost(retired, acmePooled.host)
  assert.equal(out.ok, false)
  assert.equal(out.ok === false ? out.refusal : null, 'host_retired')
})

test('the serving-host refusal set is closed', () => {
  assert.deepEqual(Object.values(SERVING_HOST_REFUSALS).sort(), [
    'host_not_presented',
    'host_not_registered',
    'host_registered_more_than_once',
    'host_retired',
  ])
})

/* ------------------------------------------------------------------ *
 * 2. The reserved-label list, as a mint-time rule
 * ------------------------------------------------------------------ */

/**
 * G179 names the list and where it belongs: a reserved-label list *"that
 * becomes a mint-time rule on the tenant slug — the same place G97 puts
 * id-format rules, for the same reason."* G97: *"the database enforces no
 * format… preventing that is a mint-time rule in `model/`, not a column
 * constraint."*
 */
test('test_a_reserved_label_cannot_be_minted_as_a_tenant_slug', () => {
  for (const label of ['www', 'api', 'app', 'admin', 'status', 'control']) {
    const out = checkTenantHostLabel(label)
    assert.equal(out.ok, false, `${label} must be reserved`)
    assert.equal(out.ok === false ? out.refusal : null, 'host_label_reserved')
  }
})

test('the reserved list is exactly the six G179 names', () => {
  assert.deepEqual([...RESERVED_HOST_LABELS].sort(), [
    'admin',
    'api',
    'app',
    'control',
    'status',
    'www',
  ])
})

/**
 * ⚠️ A SLUG THAT IS A REGION LABEL MAKES `{tenant}.{region}.{domain}`
 * AMBIGUOUS, and that ambiguity is a residency question rather than a naming
 * one. It is refused separately from the reserved list so the refusal says
 * which rule was broken.
 */
test('test_a_slug_that_collides_with_a_region_label_is_refused', () => {
  const out = checkTenantHostLabel('eu-west-1')
  assert.equal(out.ok, false)
  assert.equal(out.ok === false ? out.refusal : null, 'host_label_is_a_region')
})

test('a malformed label is refused, and an empty one is its own case', () => {
  const empty = checkTenantHostLabel('')
  assert.equal(empty.ok, false)
  assert.equal(empty.ok === false ? empty.refusal : null, 'host_label_empty')
  for (const bad of ['-acme', 'acme-', 'ACME', 'ac me', 'acme_corp', 'a'.repeat(64)]) {
    const out = checkTenantHostLabel(bad)
    assert.equal(out.ok, false, `${bad} must be refused`)
    assert.equal(out.ok === false ? out.refusal : null, 'host_label_malformed')
  }
})

test('a well-formed slug is admitted', () => {
  for (const good of ['acme', 'acme-corp', 'a', 'globex2', 'a'.repeat(63)]) {
    assert.equal(checkTenantHostLabel(good).ok, true, `${good} must be admitted`)
  }
})

test('the host-label refusal set is closed', () => {
  assert.deepEqual(Object.values(HOST_LABEL_REFUSALS).sort(), [
    'host_label_empty',
    'host_label_is_a_region',
    'host_label_malformed',
    'host_label_reserved',
  ])
})

/* ------------------------------------------------------------------ *
 * 3. Registration — where the parse-shaped check is allowed to live
 * ------------------------------------------------------------------ */

/**
 * 🛑 THE ONLY PLACE A HOSTNAME IS EVER TAKEN APART, AND IT IS NOT ON THE
 * SIGN-IN PATH. G179 forbids resolution by pattern; it does not forbid
 * checking, once, at registration, that a pooled host was named the way the
 * ruling says pooled hosts are named. This is G231's own shape one row over —
 * *"DNS IS READ EXACTLY ONCE, AND NOT HERE: at verification, which is an
 * operator-initiated act off the sign-in path."*
 */
test('a well-formed pooled registration is admitted', () => {
  assert.equal(checkServingHostRegistration(acmePooled).ok, true)
  assert.equal(checkServingHostRegistration(globexPooled).ok, true)
})

test('test_a_pooled_host_whose_region_label_disagrees_with_its_row_is_refused', () => {
  const misnamed: ServingHost = { ...acmePooled, region: 'eu-west-1' }
  const out = checkServingHostRegistration(misnamed)
  assert.equal(out.ok, false)
  assert.equal(
    out.ok === false ? out.refusal : null,
    'region_label_disagrees_with_region',
  )
})

test('a pooled host whose leftmost label is reserved is refused at registration', () => {
  const reserved: ServingHost = {
    ...acmePooled,
    host: 'admin.ap-southeast-1.reconcile.invalid',
  }
  const out = checkServingHostRegistration(reserved)
  assert.equal(out.ok, false)
  assert.equal(out.ok === false ? out.refusal : null, 'tenant_label_refused')
})

test('a pooled host with too few labels to carry a region is refused', () => {
  const flat: ServingHost = { ...acmePooled, host: 'acme.reconcile.invalid' }
  assert.equal(checkServingHostRegistration(flat).ok, false)
})

/**
 * 🛑 THE DELEGATED HOST IS EXEMPT FROM EVERY LABEL RULE, AND THAT IS WHY THE
 * REGION LIVES ON THE ROW. Under BYOA the customer names the host; we do not
 * get a label and we may not invent one. The residency check below still binds,
 * because `region` is STATED on the registry row rather than read off the name
 * — which is the same reason resolution is a lookup.
 */
test('test_a_delegated_customer_domain_is_registerable_with_no_labels_of_ours_in_it', () => {
  assert.equal(checkServingHostRegistration(northwindDelegated).ok, true)
  assert.equal(
    checkServingHostRegistration({
      ...northwindDelegated,
      host: 'admin.northwind.example',
    }).ok,
    true,
    'their domain, their labels — `admin` is reserved in OUR namespace only',
  )
})

test('a host that is not already normalised is refused at registration', () => {
  const shouty: ServingHost = { ...acmePooled, host: 'ACME.ap-southeast-1.reconcile.invalid' }
  const out = checkServingHostRegistration(shouty)
  assert.equal(out.ok, false)
  assert.equal(out.ok === false ? out.refusal : null, 'host_not_normalised')
})

test('the registration refusal set is closed', () => {
  assert.deepEqual(Object.values(SERVING_HOST_REGISTRATION_REFUSALS).sort(), [
    'host_not_normalised',
    'host_too_short_to_carry_a_region_label',
    'region_label_disagrees_with_region',
    'tenant_label_refused',
  ])
})

/* ------------------------------------------------------------------ *
 * 4. Residency — invariant 7, checked by a total function
 * ------------------------------------------------------------------ */

/**
 * 🛑 A FLAT WILDCARD IS CRYPTOGRAPHICALLY VALID IN EVERY REGION, so an EU
 * tenant misrouted to a US plane **FAILS OPEN AND IS INVISIBLE**. The region
 * label makes that misroute fail closed at TLS; this function makes it fail
 * closed in the model as well, before any TLS exists to fail at.
 *
 * ⚠️ IT IS A SECOND EXECUTABLE RESIDENCY CHECK AND IT DOES NOT SUBSTITUTE FOR
 * `resolveModel()`. Invariant 7 is about inference routing; this is about
 * request routing. Two live fields still reach a model without passing
 * `resolveModel()`, and nothing here narrows that.
 */
test('test_a_region_label_disagreeing_with_residency_fails_closed', () => {
  const euTenantOnAnApPlane = checkServingHostResidency(acmePooled, {
    id: ACME,
    residency: 'eu-west-1',
  })
  assert.equal(euTenantOnAnApPlane.ok, false)
  assert.equal(
    euTenantOnAnApPlane.ok === false ? euTenantOnAnApPlane.refusal : null,
    'region_does_not_match_residency',
  )
})

test('an agreeing pair is admitted', () => {
  assert.equal(
    checkServingHostResidency(acmePooled, { id: ACME, residency: 'ap-southeast-1' }).ok,
    true,
  )
})

/**
 * The row and the tenant must be the same tenant before their regions are
 * compared at all — otherwise the function compares one tenant's residency
 * against another tenant's plane and reports agreement.
 */
test('a serving host for a different tenant is refused before residency is compared', () => {
  const out = checkServingHostResidency(acmePooled, {
    id: GLOBEX,
    residency: 'ap-southeast-1',
  })
  assert.equal(out.ok, false)
  assert.equal(out.ok === false ? out.refusal : null, 'host_is_not_this_tenants')
})

test('the delegated case is checked identically — the region is on the row', () => {
  assert.equal(
    checkServingHostResidency(northwindDelegated, {
      id: NORTHWIND,
      residency: 'eu-west-1',
    }).ok,
    false,
    'BYOA has no label, and residency is still checkable, which is the argument ' +
      'for the region living on the registry row',
  )
})

test('the residency refusal set is closed', () => {
  assert.deepEqual(Object.values(RESIDENCY_REFUSALS).sort(), [
    'host_is_not_this_tenants',
    'region_does_not_match_residency',
  ])
})

/* ------------------------------------------------------------------ *
 * 5. The vocabularies
 * ------------------------------------------------------------------ */

/**
 * ⚠️ TOTAL OVER `RegionKey`, AND IT BITES BECAUSE THIS MODULE CONSTRUCTS IT —
 * §5.10's condition, met. A sixth deployment region added to `RegionKey` with
 * no hostname label is a compile error here rather than a tenant that cannot
 * be named.
 *
 * 🛑 NAMING A REGION ASSERTS NOTHING ABOUT WHETHER A PLANE RUNS IN IT. G101
 * puts phase one on a disposable local Postgres with no AWS resource of any
 * kind, and `RegionKey` already declares five regions of which the record
 * calls two live. This map is a naming vocabulary, not a deployment claim.
 */
test('every declared region has a hostname label, and there are no extras', () => {
  const declared: readonly RegionKey[] = [
    'ap-southeast-1',
    'ap-southeast-2',
    'us-west-2',
    'ap-south-1',
    'eu-west-1',
  ]
  assert.deepEqual(Object.keys(REGION_HOST_LABEL).sort(), [...declared].sort())
  for (const region of declared) {
    assert.equal(typeof REGION_HOST_LABEL[region], 'string')
    assert.notEqual(REGION_HOST_LABEL[region], '')
  }
})

test('the two serving-host kinds are exactly G183`s two certificate shapes', () => {
  assert.deepEqual(Object.values(SERVING_HOST_KINDS).sort(), ['delegated', 'pooled'])
})

/* ------------------------------------------------------------------ *
 * 6. What this module may not read, and what it must cite
 * ------------------------------------------------------------------ */

/**
 * 🛑 G179 IS EXPLICIT: *"DO NOT OVERLOAD `IdentityConnection.domains`… Which
 * identity provider to try and which tenant is being served are two different
 * questions, and one field answering both is one field that can disagree with
 * itself."*
 */
test('test_identity_connection_domains_is_read_by_nothing_added_here', () => {
  const code = SERVING_HOST_TEXT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  for (const forbidden of [
    'IdentityConnection',
    'DomainClaim',
    'mayRouteToConnection',
    'routeToConnection',
    'normaliseClaimedDomain',
  ]) {
    assert.equal(
      code.includes(forbidden),
      false,
      `G179 forbids this module reaching ${forbidden}`,
    )
  }
})

test('the prohibition is cited on the declaration, not only in this suite', () => {
  assert.match(SERVING_HOST_TEXT, /G179/)
  assert.match(SERVING_HOST_TEXT, /one field answering both/)
})

/**
 * ⚠️ G182 AND G183 ARE RULED, UNBUILT, AND CONSTRAIN THE HOSTNAME BEFORE THE
 * FIRST ONE IS PUBLISHED — G182's timing is one-way. Neither is this slice's
 * to relitigate, so the slug and label rules cite them rather than choosing.
 */
test('G182 and G183 are cited rather than decided', () => {
  assert.match(SERVING_HOST_TEXT, /G182/)
  assert.match(SERVING_HOST_TEXT, /G183/)
  assert.match(SERVING_HOST_TEXT, /Public Suffix List/)
})

/**
 * G207 rules that `Endpoint.region` is `ForeignRegion` and explicitly NOT
 * `RegionKey`, so a residency crossing is visible in the type. It does not
 * apply here and the reason is recorded on the declaration: a serving host is
 * OURS by construction, and its region must compare EQUAL to
 * `Tenant.residency`, which is `RegionKey`. Typing it `ForeignRegion` would
 * make the one comparison this module exists for uncomparable.
 */
test('G207 is answered rather than ignored', () => {
  assert.match(SERVING_HOST_TEXT, /G207/)
  assert.equal(/ForeignRegion/.test(SERVING_HOST_TEXT.replace(/\/\*[\s\S]*?\*\//g, '')), false)
})

/* ==================================================================== *
 * MUTATIONS RUN, AND WHAT EACH CAUGHT
 * --------------------------------------------------------------------
 * `tsc` was GREEN under every one of these.
 *
 *   M1  🛑 THE BEHAVIOURAL CORE. `tenant = subdomain(host)` — resolution by
 *       parsing the leftmost label and matching it against the tenant id
 *       (`registry.filter(e => e.tenantId === `ten_${key.split('.')[0]}`)`).
 *       → 4 red, and the ONE that matters is
 *          `test_a_host_resolves_by_registry_lookup_and_never_by_parsing`.
 *          **`every pooled host resolves too` stays GREEN** — both pooled
 *          fixtures still resolve to the right tenant under the mutant, which
 *          is exactly the silent break G179 names and the reason that second
 *          test is in the file at all.
 *
 *          ⚠️ A FIRST ATTEMPT AT THIS MUTATION WAS TOO WEAK AND IS RECORDED
 *          RATHER THAN QUIETLY REPLACED. Comparing `key.split('.')[0]` against
 *          `entry.host.split('.')[0]` reddened only `an unregistered host
 *          resolves to nothing rather than to a guess` — because both sides
 *          were parsed the same way, so the BYOA row still matched itself. A
 *          mutation that does not reproduce the defect proves nothing about the
 *          test; the defect is parsing a TENANT out of a host, not parsing a
 *          host.
 *
 *   M2  Count ambiguity over ACTIVE rows only, mirroring `routeToConnection()`
 *       without re-reading its argument.
 *       → 1 red: `test_a_duplicate_refuses_even_when_only_one_of_the_two_rows_
 *          is_active`. `test_a_host_registered_twice_...` stays GREEN, because
 *          both of its rows are active — which is why the sharper fixture had
 *          to be built. Copying a sibling's precedence without its threat model
 *          is §5.1's landmark substitution, and here it hands a request to
 *          whichever tenant happened not to be retired.
 *
 *   M3  Drop the `host_is_not_this_tenants` arm from
 *       `checkServingHostResidency()`.
 *       → 1 red: `a serving host for a different tenant is refused before
 *          residency is compared`. Under the mutant the function compares one
 *          tenant's residency against another tenant's plane and reports
 *          agreement — a residency check passing for the wrong reason.
 *
 *   M4  Apply the pooled label rules to `delegated` rows as well.
 *       → 1 red: `test_a_delegated_customer_domain_is_registerable_with_no_
 *          labels_of_ours_in_it`. This is the mutation that makes BYOA
 *          unregisterable, which is how the circularity arose in the first
 *          place.
 *
 *   M5  Delete `host_label_is_a_region` and fold region collisions into the
 *       reserved list.
 *       → 1 red: `test_a_slug_that_collides_with_a_region_label_is_refused`.
 *          The refusal stops saying which rule was broken, and a
 *          `{tenant}.{region}` ambiguity stops being a residency finding.
 *
 *   M6  Add a sixth region — `'eu-central-1'` — to `RegionKey` in
 *       `model/domain.ts` and leave `REGION_HOST_LABEL` alone.
 *       → `tsc` RED, **TS2741**; 0 tests red. The compiler catches this and the
 *          runner cannot, which is the whole reason the map is a total `Record`
 *          and the whole content of §5.10's condition being MET here.
 * ==================================================================== */
