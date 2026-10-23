/**
 * THE CONSOLE REGISTRY AND THE ONE ENTRY POINT — G726, 19 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS SUITE IS FOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The owner ruled on 19 Sep 2026 that **the data plane serves the console
 * hosts, with tenant-less sessions**, and named the cost in the same breath:
 * *"G179's host→tenant resolution and G180's revoke-on-mismatch both assume a
 * tenant, and a tenant-less session is a new shape in the one place those
 * invariants are enforced."*
 *
 * This file is about the FIRST of those two. It asserts that a console host
 * resolves the way a tenant host resolves — **by being in a registry somebody
 * wrote down** — and that the two registries cannot quietly become one.
 * `tests/model/console-principal.test.ts` is about the second.
 *
 * 🛑 THE MUTATION THIS SUITE EXISTS TO SURVIVE IS `host.startsWith('console.')`,
 * AND §1b IS THE ONLY ASSERTION THAT CATCHES IT. Implemented that way every
 * deployment of ours resolves correctly and exactly one case fails: a BYOA
 * customer (G36) whose own domain begins with that label, served the staff
 * console's surface on their own hostname. That is G179's silent break —
 * *"every pooled tenant goes on working"* — arriving on the other registry,
 * so the BYOA row sits beside the real one here for the same reason
 * `tests/model/serving-host.test.ts` keeps a pooled case beside its BYOA case.
 *
 * ⚠️ MUTATIONS RUN ARE RECORDED AT THE FOOT OF THE FILE. An assertion nobody
 * has watched fail is a comment with extra steps.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CONSOLE_HOST_REGISTRATION_REFUSALS,
  CONSOLE_KINDS,
  SERVED_HOST_REFUSALS,
  SERVED_SURFACE_KINDS,
  SERVING_HOST_REFUSALS,
  checkConsoleHostRegistration,
  resolveConsoleHost,
  resolveServedHost,
} from '../../model/serving-host.ts'
import type { ConsoleHost, ServingHost } from '../../model/serving-host.ts'
import type { TenantId } from '../../model/kernel.ts'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SERVING_HOST_TEXT = readFileSync(
  join(REPO_ROOT, 'model', 'serving-host.ts'),
  'utf8',
)
const ACCESS_TEXT = readFileSync(join(REPO_ROOT, 'model', 'access.ts'), 'utf8')

const ACME = 'ten_acme' as TenantId
const NORTHWIND = 'ten_northwind' as TenantId

const staffConsole: ConsoleHost = {
  host: 'console.reconcile.invalid',
  console: CONSOLE_KINDS.staff,
  status: 'active',
}

const partnerConsole: ConsoleHost = {
  host: 'partners.reconcile.invalid',
  console: CONSOLE_KINDS.partner,
  status: 'active',
}

/**
 * 🛑 THE BYOA TRAP, AND IT IS THE WHOLE OF §1b. A customer serving from its
 * own domain whose LEFTMOST LABEL IS `console` is a TENANT host and must stay
 * one. A prefix test resolves it to the staff console and serves that
 * customer's own users a platform surface on their own hostname.
 */
const northwindDelegated: ServingHost = {
  kind: 'delegated',
  host: 'console.northwind.example',
  tenantId: NORTHWIND,
  region: 'ap-southeast-1',
  status: 'active',
}

const acmePooled: ServingHost = {
  kind: 'pooled',
  host: 'acme.ap-southeast-1.reconcile.invalid',
  tenantId: ACME,
  region: 'ap-southeast-1',
  status: 'active',
}

const consoles: readonly ConsoleHost[] = [staffConsole, partnerConsole]
const tenants: readonly ServingHost[] = [acmePooled, northwindDelegated]

/* ------------------------------------------------------------------ *
 * 1. Resolution is a lookup on this side too
 * ------------------------------------------------------------------ */

test('test_a_console_host_resolves_by_registry_lookup_and_never_by_prefix', () => {
  const out = resolveConsoleHost(consoles, 'console.reconcile.invalid')
  assert.equal(out.ok, true)
  if (!out.ok) return
  assert.equal(out.console, CONSOLE_KINDS.staff)
})

test('test_1b_a_BYOA_tenant_whose_leftmost_label_is_console_is_a_TENANT_host', () => {
  /**
   * 🛑 THE ASSERTION THE PREFIX MUTATION DIES ON. Both halves matter and
   * neither alone is enough: the console registry must NOT claim this name,
   * and `resolveServedHost()` must answer with the TENANT surface and the
   * customer's own tenant.
   */
  const asConsole = resolveConsoleHost(consoles, 'console.northwind.example')
  assert.equal(asConsole.ok, false)
  if (asConsole.ok) return
  assert.equal(
    asConsole.refusal,
    SERVING_HOST_REFUSALS.hostNotRegistered,
    'G179: "`tenant = subdomain(host)` breaks the moment a customer serves from their ' +
      'own domain under BYOA … and it breaks silently." A prefix test on the console ' +
      'registry breaks in exactly the same direction and for exactly the same customer.',
  )

  const served = resolveServedHost(tenants, consoles, 'console.northwind.example')
  assert.equal(served.ok, true)
  if (!served.ok) return
  assert.equal(served.surface.kind, SERVED_SURFACE_KINDS.tenant)
  if (served.surface.kind !== SERVED_SURFACE_KINDS.tenant) return
  assert.equal(served.surface.tenantId, NORTHWIND)
})

test('the console lookup folds case and trims, through the one host normaliser', () => {
  const out = resolveConsoleHost(consoles, '  CONSOLE.Reconcile.Invalid ')
  assert.equal(out.ok, true)
})

test('an unregistered console name resolves to nothing rather than to a guess', () => {
  const out = resolveConsoleHost(consoles, 'admin.reconcile.invalid')
  assert.equal(out.ok, false)
  if (out.ok) return
  assert.equal(out.refusal, SERVING_HOST_REFUSALS.hostNotRegistered)
})

test('an absent host is refused before the console registry is read', () => {
  const out = resolveConsoleHost(consoles, '   ')
  assert.equal(out.ok, false)
  if (out.ok) return
  assert.equal(out.refusal, SERVING_HOST_REFUSALS.hostNotPresented)
})

test('a console registered twice refuses rather than picking a surface', () => {
  const out = resolveConsoleHost([staffConsole, { ...staffConsole, console: 'partner' }], staffConsole.host)
  assert.equal(out.ok, false)
  if (out.ok) return
  assert.equal(out.refusal, SERVING_HOST_REFUSALS.hostRegisteredMoreThanOnce)
})

test('a retired console does not answer, and says so specifically', () => {
  const out = resolveConsoleHost([{ ...staffConsole, status: 'retired' }], staffConsole.host)
  assert.equal(out.ok, false)
  if (out.ok) return
  assert.equal(
    out.refusal,
    SERVING_HOST_REFUSALS.hostRetired,
    'A withdrawn console must not read as an unregistered one — `ServingHost.status`, ' +
      'and the argument is unchanged on this side.',
  )
})

/* ------------------------------------------------------------------ *
 * 2. Registration — G297's flat grammar, checked once, off the path
 * ------------------------------------------------------------------ */

test('test_a_console_host_carrying_a_region_label_is_refused_at_registration', () => {
  const out = checkConsoleHostRegistration({
    host: 'console.us-west-2.reconcile.invalid',
    console: CONSOLE_KINDS.staff,
    status: 'active',
  })
  assert.equal(out.ok, false)
  if (out.ok) return
  assert.equal(
    out.refusal,
    CONSOLE_HOST_REGISTRATION_REFUSALS.consoleHostCarriesARegionLabel,
    'G297: "THE CONSOLES STAY FLAT because a console has no tenant and a region label ' +
      'on one would assert a residency invariant 3 says the control plane does not ' +
      'have." The failure direction is the dangerous one — nothing breaks, and the ' +
      'deployment now claims a residency posture for a surface that has none.',
  )
})

test('a flat console host is admitted, two labels and all', () => {
  assert.equal(checkConsoleHostRegistration(staffConsole).ok, true)
  assert.equal(checkConsoleHostRegistration(partnerConsole).ok, true)
})

test('an unnormalised console host is refused at registration', () => {
  const out = checkConsoleHostRegistration({ ...staffConsole, host: 'Console.Reconcile.Invalid' })
  assert.equal(out.ok, false)
  if (out.ok) return
  assert.equal(out.refusal, CONSOLE_HOST_REGISTRATION_REFUSALS.hostNotNormalised)
})

test('the console registration refusal set is closed', () => {
  assert.deepEqual(Object.values(CONSOLE_HOST_REGISTRATION_REFUSALS).sort(), [
    'console_host_carries_a_region_label',
    'host_not_normalised',
  ])
})

/* ------------------------------------------------------------------ *
 * 3. The collision — one name, two registries
 * ------------------------------------------------------------------ */

test('test_a_host_in_BOTH_registries_serves_neither_surface', () => {
  const collided: ServingHost = {
    kind: 'delegated',
    host: staffConsole.host,
    tenantId: ACME,
    region: 'ap-southeast-1',
    status: 'active',
  }
  const out = resolveServedHost([...tenants, collided], consoles, staffConsole.host)
  assert.equal(out.ok, false)
  if (out.ok) return
  assert.equal(
    out.refusal,
    SERVED_HOST_REFUSALS.hostServesATenantAndAConsole,
    '`hostRegisteredMoreThanOnce` across the registry boundary: "picking either one ' +
      'picks a TENANT and that is the derivation invariant 1 rests on." Here picking ' +
      'either one picks whether a session may exist without a tenant at all.',
  )
})

test('test_3b_the_collision_refuses_even_when_one_of_the_two_rows_is_RETIRED', () => {
  /**
   * 🛑 THE ARM THAT MAKES THE COLLISION CHECK MORE THAN A DUPLICATE OF THE
   * TWO PER-REGISTRY ONES. A collision resolved by retiring one row would
   * make the refusal depend on the order somebody withdrew things — so status
   * is deliberately not consulted for this arm, and this is the witness.
   */
  const retiredTenant: ServingHost = {
    kind: 'delegated',
    host: staffConsole.host,
    tenantId: ACME,
    region: 'ap-southeast-1',
    status: 'retired',
  }
  const out = resolveServedHost([retiredTenant], consoles, staffConsole.host)
  assert.equal(out.ok, false)
  if (out.ok) return
  assert.equal(out.refusal, SERVED_HOST_REFUSALS.hostServesATenantAndAConsole)
})

test('the one entry point answers the console surface for a console host', () => {
  const out = resolveServedHost(tenants, consoles, partnerConsole.host)
  assert.equal(out.ok, true)
  if (!out.ok) return
  assert.equal(out.surface.kind, SERVED_SURFACE_KINDS.console)
  if (out.surface.kind !== SERVED_SURFACE_KINDS.console) return
  assert.equal(out.surface.console, CONSOLE_KINDS.partner)
})

test('the one entry point answers the tenant surface unchanged, region and all', () => {
  const out = resolveServedHost(tenants, consoles, acmePooled.host)
  assert.equal(out.ok, true)
  if (!out.ok) return
  assert.equal(out.surface.kind, SERVED_SURFACE_KINDS.tenant)
  if (out.surface.kind !== SERVED_SURFACE_KINDS.tenant) return
  assert.equal(out.surface.tenantId, ACME)
  assert.equal(out.surface.region, 'ap-southeast-1')
})

test('a host in neither registry is host_not_registered and not a default surface', () => {
  const out = resolveServedHost(tenants, consoles, 'nobody.example')
  assert.equal(out.ok, false)
  if (out.ok) return
  assert.equal(
    out.refusal,
    SERVED_HOST_REFUSALS.hostNotRegistered,
    'The model invents no default surface. The one caller that needs one — the ' +
      'authenticator — argues for it at its own call site, and argues that the TENANT ' +
      'surface is the stricter of the two.',
  )
})

test('the served-host refusal set is the serving-host set plus exactly one', () => {
  assert.deepEqual(
    Object.values(SERVED_HOST_REFUSALS).sort(),
    [...Object.values(SERVING_HOST_REFUSALS), 'host_serves_a_tenant_and_a_console'].sort(),
    'The set is SPREAD from `SERVING_HOST_REFUSALS` rather than transcribed, so this ' +
      'assertion is about the one member that is minted here — not about four that are ' +
      'reused. A twin of the four would be a second place for them to drift.',
  )
})

/* ------------------------------------------------------------------ *
 * 4. The source sweeps — the two prohibitions, executable
 * ------------------------------------------------------------------ */

test('test_4a_the_console_lookup_takes_no_hostname_apart', () => {
  /**
   * 🛑 G179's PROHIBITION, AS A SWEEP RATHER THAN AS A HABIT. The only place
   * this module may parse is registration, which is an operator-initiated act
   * off the sign-in path; a `split`, an `indexOf` or a `startsWith` inside
   * `resolveConsoleHost()` would be the pattern the ruling refuses.
   */
  const fn = declarationBody(SERVING_HOST_TEXT, 'export function resolveConsoleHost(')
  for (const forbidden of ['split', 'indexOf', 'startsWith', 'endsWith', 'slice', 'substring']) {
    assert.equal(
      fn.includes(forbidden),
      false,
      `resolveConsoleHost() contains \`${forbidden}\`. G179: "RESOLUTION IS A ` +
        'CONFIGURATION LOOKUP, NEVER A PATTERN." The one place this module takes a ' +
        'hostname apart is registration.',
    )
  }
})

test('test_4b_the_same_sweep_over_the_one_entry_point', () => {
  const fn = declarationBody(SERVING_HOST_TEXT, 'export function resolveServedHost(')
  for (const forbidden of ['split', 'indexOf', 'startsWith', 'endsWith', 'substring']) {
    assert.equal(fn.includes(forbidden), false, `resolveServedHost() contains \`${forbidden}\``)
  }
})

test('test_4c_G180_GETS_NO_EXCEPTION_the_binding_check_knows_nothing_about_consoles', () => {
  /**
   * 🛑 THE OWNER NAMED THIS AS THE COST AND IT IS THE ASSERTION THAT SAYS THE
   * COST WAS NOT PAID: *"G180's revoke-on-mismatch … assume[s] a tenant, and a
   * tenant-less session is a new shape in the one place those invariants are
   * enforced."* `checkHostBinding()` compares two strings and knows nothing
   * about tenants OR consoles, so the console surface costs it nothing —
   * **verified rather than assumed**, because G315 chose its whole shape so
   * that G180 would keep having no exceptions and an exception added here
   * would be the first.
   */
  const fn = declarationBody(SERVING_HOST_TEXT, 'export function checkHostBinding(')
  for (const forbidden of ['console', 'Console', 'surface', 'Surface', 'tenant', 'Tenant']) {
    assert.equal(
      fn.includes(forbidden),
      false,
      `checkHostBinding() names \`${forbidden}\`. G180 has no exceptions and must keep ` +
        'having none: it reads `Session.issuedHost` and one request header, and a ' +
        'console session is issued on a console host and used there.',
    )
  }
})

test('test_4d_model_access_reaches_the_host_layer_for_ONE_name_and_no_registry', () => {
  /**
   * ⚠️ `model/access.ts` MAY KNOW WHICH SURFACE IT IS ON AND MUST NOT KNOW HOW
   * THAT WAS DECIDED. A resolution is the caller's act; `resolveSubject()`
   * takes its answer. An import of either registry or either resolver here
   * would put the lookup inside the evaluator, which is the two-halves split
   * `decide()`'s own header refuses.
   */
  const code = codeOnly(ACCESS_TEXT)
  for (const forbidden of [
    'ServingHost',
    'ConsoleHost',
    'resolveServingHost',
    'resolveConsoleHost',
    'resolveServedHost',
  ]) {
    assert.equal(
      code.includes(forbidden),
      false,
      `model/access.ts names \`${forbidden}\`. It may take a SURFACE KIND — the answer — ` +
        'and may not reach the registries that produce one.',
    )
  }
  assert.ok(
    code.includes('SERVED_SURFACE_KINDS'),
    'the surface term is gone from `model/access.ts` entirely, which would mean ' +
      '`resolveSubject()` had gone back to deriving it from `session.tenantId` — the ' +
      'derivation that deletes `tenant_not_selected` for everybody.',
  )
})

/* ------------------------------------------------------------------ *
 * Helpers — comment-stripping, so a sweep cannot fail on prose
 * ------------------------------------------------------------------ */

/** Strip `//` and block comments so a sweep reads code and not narration. */
function codeOnly(text: string): string {
  let out = ''
  let i = 0
  while (i < text.length) {
    const two = text.slice(i, i + 2)
    if (two === '//') {
      const end = text.indexOf('\n', i)
      i = end === -1 ? text.length : end
      continue
    }
    if (two === '/*') {
      const end = text.indexOf('*/', i + 2)
      i = end === -1 ? text.length : end + 2
      continue
    }
    out += text[i]
    i += 1
  }
  return out
}

/** The body of one declaration, comments stripped, up to its closing brace. */
function declarationBody(text: string, opening: string): string {
  const code = codeOnly(text)
  const at = code.indexOf(opening)
  assert.notEqual(at, -1, `no declaration opening with \`${opening}\` was found`)
  let depth = 0
  let i = code.indexOf('{', at)
  const start = i
  while (i < code.length) {
    if (code[i] === '{') depth += 1
    else if (code[i] === '}') {
      depth -= 1
      if (depth === 0) return code.slice(start, i + 1)
    }
    i += 1
  }
  assert.fail(`the declaration opening with \`${opening}\` never closed`)
}

/* ==================================================================== *
 * MUTATIONS RUN, AND WHAT EACH CAUGHT
 * --------------------------------------------------------------------
 * Recorded because an assertion nobody has watched fail is a comment with
 * extra steps. `tsc -p model/tsconfig.json` was GREEN under M1, M2 and M3.
 *
 *   M1  🛑 THE ONE THE SUITE EXISTS FOR. `resolveConsoleHost()` implemented as
 *       `registry.find((e) => host.startsWith('console.'))`-style prefix
 *       matching instead of a registry lookup.
 *       → 2 red: `test_1b_a_BYOA_tenant_whose_leftmost_label_is_console_is_a_
 *          TENANT_host` and `test_4a_the_console_lookup_takes_no_hostname_
 *          apart`. Every other assertion in §1 passes unharmed, because every
 *          other fixture is a host we named — which is the asymmetry G179
 *          describes and the reason the BYOA row is here.
 *
 *   M2  Delete the collision arm from `resolveServedHost()` and let the tenant
 *       registry answer first.
 *       → 2 red: §3's two. The rest of §3 stays green, which is worth knowing:
 *          a suite that only checked the happy surfaces would have reported a
 *          host serving BOTH as a tenant host, silently.
 *
 *   M3  Consult `status` in the collision arm — `claimedByATenant` computed
 *       over active rows only.
 *       → 1 red, and ONLY one: `test_3b_the_collision_refuses_even_when_one_of_
 *          the_two_rows_is_RETIRED`. That mutation is the plausible one — it
 *          reads as tidier — and it makes the refusal depend on the order
 *          somebody withdrew things.
 *
 *   M4  Drop the region-label rule from `checkConsoleHostRegistration()`.
 *       → 1 red: `test_a_console_host_carrying_a_region_label_is_refused_at_
 *          registration`. Recorded because the mutation is INVISIBLE at
 *          runtime — every such host goes on resolving — and G297's claim is
 *          about what a deployment ASSERTS rather than about what it serves.
 * ==================================================================== */
