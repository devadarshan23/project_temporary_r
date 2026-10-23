/**
 * `POST /session/realm` — THE FIRST UNAUTHENTICATED PERSON-FACING OPERATION
 * THIS PRODUCT SERVES. **G1941, 22 Sep 2026, the owner's S7 ruling.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 NO DATABASE, AND THAT IS A PROPERTY OF WHAT IS UNDER TEST RATHER THAN A
 *    CONVENIENCE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This suite calls `tests/reachability.ts`'s guards NOWHERE, and the reason is
 * that it reaches no PostgreSQL: every assertion below drives `buildPlane()`
 * over the REAL contract documents with a RECORDING FAKE POOL, so what it
 * proves is the wiring — the mount, the fences, the scope, the statement, the
 * normalisation and the refusal map. **What it cannot prove is the POLICY**,
 * and that half is `tests/db/domain-claim.test.ts`, which does take the guard
 * and does skip on a machine with no server.
 *
 * ⚠️ **THE FAKE POOL IS NOT A STUB OF THE ANSWER, IT IS A TAPE OF THE
 * QUESTION.** It records every `query()` it is handed and returns rows a test
 * chose. That makes §4 possible — asserting that the domain reaches the
 * database as a BOUND PARAMETER of `set_config` and never as SQL text — which
 * is the one thing about this operation that no database-backed test would
 * show, because a correct implementation and an interpolating one both return
 * the same rows for a benign input.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT IS DELIBERATELY NOT ASSERTED HERE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **The DOMAIN-EXISTENCE ORACLE.** `docs/contracts/session.openapi.yaml` says
 * it is left open on purpose — *"A 200 for a claimed domain and a 422 for an
 * unclaimed one is a DOMAIN-existence signal … It is not invented away"* — and
 * this suite must not add an assertion that would have to be deleted by the D6
 * threat model. §6 asserts the property that IS closed and is structural: no
 * user-existence signal, because the request admits no user.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { FastifyInstance } from 'fastify'

import { basePathOf, loadTier } from '../../server/contract/document.ts'
import { routesOf } from '../../server/contract/routes.ts'
import { callerOf, callerMayBeAPerson, gateVerdictOf } from '../../server/contract/capability.ts'
import {
  buildPlane,
  recordsAuthorisation,
  servedPublicly,
  servedWithoutAGate,
  type TierMount,
} from '../../server/http/app.ts'
import type { TenantPool, ScopedClient } from '../../db/tenant-scope.ts'
import { resolveHomeRealmHandler } from '../../server/data-plane/realm.ts'

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..')

const SESSION_SPECS = routesOf(loadTier('session'), basePathOf(loadTier('session')))
const REALM = SESSION_SPECS.find((s) => s.operationId === 'resolveHomeRealm')
assert.ok(REALM, 'the session tier no longer declares `resolveHomeRealm`')

/* ==================================================================== *
 * THE RECORDING FAKE POOL
 * ==================================================================== */

interface Recorded {
  readonly text: string
  readonly values: readonly unknown[]
}

interface FakePool extends TenantPool {
  readonly issued: Recorded[]
  released: number
}

/**
 * ⚠️ `rows` IS KEYED ON A SUBSTRING OF THE STATEMENT AND NOT ON CALL ORDER.
 * The handler issues `BEGIN`, a `set_config`, the claim read, the connection
 * read and a `COMMIT`; keying on order would make every test in this file
 * depend on that sequence and would break as a MYSTERY the day a reader adds
 * a statement. Keying on the table name says what each fixture is FOR.
 */
function fakePool(rows: Readonly<Record<string, Array<Record<string, unknown>>>>): FakePool {
  const issued: Recorded[] = []
  const pool: FakePool = {
    issued,
    released: 0,
    connect: async (): Promise<ScopedClient> => ({
      query: async (text: string, values?: readonly unknown[]) => {
        issued.push({ text, values: values ?? [] })
        for (const [needle, out] of Object.entries(rows)) {
          if (text.includes(needle)) return { rows: out, rowCount: out.length }
        }
        return { rows: [], rowCount: 0 }
      },
      release: () => {
        pool.released += 1
      },
    }),
    end: async () => undefined,
  }
  return pool
}

const CLAIMS = 'tenant.domain_claim'
const DOORS = 'tenant.identity_connection'

/** A door row shaped as `CONNECTION_READ` selects it. */
const door = (id: string, over: Partial<Record<string, unknown>> = {}) => ({
  id,
  status: 'active',
  protocol: 'oidc',
  owner_kind: 'customer',
  owner_partner_id: null,
  owner_account_id: 'acc_acme',
  broker_issuer: 'https://cognito-idp.us-west-2.amazonaws.com/pool',
  broker_ref: `provider-${id}`,
  ...over,
})

/** A claim row shaped as `DOMAIN_CLAIM_READ` selects it. */
const claim = (connectionId: string, domain: string, verifiedAt: string | null) => ({
  connection_id: connectionId,
  domain,
  verified_at: verifiedAt,
})

const PROVED = '2026-09-01T00:00:00.000Z'

async function planeOver(pool: TenantPool): Promise<FastifyInstance> {
  return buildPlane<{ who: string }>(
    {
      plane: 'test-data-plane',
      /* Never called: the session tier declares `security: []` at document
       * level and this operation overrides nothing, so `spec.secured` is
       * false and the `onRequest` hook returns at its first line. A thrown
       * authenticator here would be the loudest possible proof of that. */
      authenticate: () => {
        throw new Error('the realm operation must never reach an authenticator')
      },
      unauthenticatedDetail: 'no session',
      authorise: () => 'not_held',
      unauthorisedDetail: 'no capability',
    },
    [{ tier: 'session', handlers: { resolveHomeRealm: servedPublicly(resolveHomeRealmHandler(pool)) } }],
  )
}

async function ask(pool: TenantPool, body: unknown): Promise<{ status: number; json: any }> {
  const app = await planeOver(pool)
  try {
    const res = await app.inject({ method: 'POST', url: '/session/realm', payload: body as object })
    return { status: res.statusCode, json: res.payload === '' ? null : JSON.parse(res.payload) }
  } finally {
    await app.close()
  }
}

/* ==================================================================== *
 * §1 · THE MOUNT — AND IT IS THE ONLY SESSION OPERATION MOUNTED
 * ==================================================================== */

const START = readFileSync(path.join(REPO_ROOT, 'server/data-plane/start.ts'), 'utf8')

/**
 * ⚠️ THIS TITLE READ *"mounts `resolveHomeRealm` and no other session
 * operation"* UNTIL 1 Oct 2026. S6 mounts `completeFederatedSignIn` under
 * D6-1 (G2490), and the paragraph below that refused it is kept as the history
 * it is. `getSession` and `signOut` are STILL refused, for the reason given.
 */
test('1 · the data plane mounts the three PUBLIC session operations and neither session-bearing one', () => {
  /**
   * 🛑 THE OTHER THREE ARE REFUSED BY NAME AT THE MOUNT, AND THIS ASSERTION
   * IS WHAT MAKES THAT A FACT RATHER THAN A COMMENT. `completeFederatedSignIn`
   * cannot mint (`tenant.session.user_id` is `NOT NULL` with no writer on any
   * request path); `getSession` and `signOut` read a session row nothing
   * mints, and both are person-facing exemptions the census counts.
   */
  /**
   * ⚠️ COMMENT LINES ARE DROPPED FIRST, AND THAT IS NOT TIDINESS — IT IS
   * G978's FINDING. `start.ts` NAMES all four session operations in prose:
   * three of them in the block that refuses each one BY NAME, and
   * `resolveHomeRealm` again in the correction about how many
   * `servedWithoutAGate()` call sites there are. **A scan that counted
   * mentions would answer FOUR and would answer four if nothing were mounted
   * at all.** What is counted is an entry in a `handlers` map: an operationId
   * followed by a colon and a handler constructor.
   */
  const code = START.split('\n')
    .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
    .join('\n')
  const mounted = SESSION_SPECS.map((s) => s.operationId).filter((id) =>
    new RegExp(`[{,\\s]${id}:\\s*[A-Za-z]`).test(code),
  )
  assert.deepEqual(
    mounted,
    /* `beginFederatedSignIn` since 1 Oct 2026 — G2541, the owner's ruling,
       argued at its mount in `start.ts` and in `signin-begin.ts`. */
    /* `relayBrokerReturn` since 2 Oct 2026 — G2549, the owner's shared-callback
       ruling (G2762), argued at its mount and in `signin-return.ts`. It is
       caller-less like the other three and serves no session row. */
    /* `signOut` since 2 Oct 2026 — G3004, the REVOKE half of the owner's
       profile-switcher ruling G2771. Its refusal above (*"read a session row
       nothing mints"*) went false when S6 began minting one; `getSession` is
       still refused. `tests/http/sign-out-served.test.ts` witnesses it. */
    /* `getSessionPrincipal` since 3 Oct 2026 — G3354, the chrome's who-am-I,
       argued at its mount and in `session-principal.ts`; it reads the
       caller's own row. `tests/http/session-principal-served.test.ts`
       witnesses it. */
    ['resolveHomeRealm', 'beginFederatedSignIn', 'relayBrokerReturn', 'completeFederatedSignIn', 'signOut', 'getSessionPrincipal'],
    'a further session operation is mounted. Each of the other three is refused at the ' +
      'mount for a stated reason; mounting one is a ruling and an argument, not a line.',
  )
})

test('1a · it is registered as a route rather than 404ing, and a sibling path still 404s', async () => {
  const pool = fakePool({})
  const app = await planeOver(pool)
  try {
    const served = await app.inject({
      method: 'POST',
      url: '/session/realm',
      payload: { domain: 'acme.example' },
    })
    assert.notEqual(served.statusCode, 404, 'the route is not registered at all')

    /* The other direction, and it is G191's honest 404: a DECLARED operation
     * with no handler is simply not registered. ⚠️ THIS PROBED
     * `/session/federated` UNTIL S6 MOUNTED IT (G2490); `GET /session` —
     * `getSession`, still refused at the mount — is the declared-and-unmounted
     * sibling now. */
    const unmounted = await app.inject({ method: 'GET', url: '/session' })
    assert.equal(unmounted.statusCode, 404)
    assert.equal(JSON.parse(unmounted.payload).code, 'resource_not_found')
  } finally {
    await app.close()
  }
})

/* ==================================================================== *
 * §2 · THE FOURTH FENCE DOES NOT FIRE, AND THE MARK IS TAKEN ANYWAY
 * ==================================================================== */

test('2 · the caller kind is `none`, so the fourth fence would NOT have compelled the mark', () => {
  /**
   * 🛑 THIS IS THE MEASUREMENT, NOT AN OPINION, AND IT IS §5.1 IN THE FENCE
   * THAT GUARDS THE GATE. `session.openapi.yaml` declares `security: []` and
   * this operation overrides nothing, so `callerOf()` answers `none` and
   * `callerMayBeAPerson('none')` is false — **the fence's own filter drops
   * the one operation in the corpus where a person has presented nothing
   * BECAUSE THEY HAVE NOT SIGNED IN YET.**
   *
   * A security scheme says what a caller PRESENTS. It does not say who they
   * ARE, and `none` collapses two different worlds: a load balancer polling
   * `/health`, and a person at a sign-in form. G1948 names the repair and
   * does not take it — widening `callerMayBeAPerson` to admit `none` is a
   * BOOT FAILURE on `checkLocalHealth`, which is mounted bare.
   */
  assert.equal(REALM.caller, 'none')
  assert.equal(callerOf([]), 'none')
  assert.equal(callerMayBeAPerson('none'), false)
  assert.equal(gateVerdictOf(REALM.capability), 'exempt')
})

test('2a · a BARE handler NO LONGER boots — D6-8 took G1948, and the SEVENTH fence refuses it', async () => {
  /**
   * ✅ **THIS TEST WAS `'2a · a BARE handler therefore boots, which is exactly
   * why the mark is a decision'` UNTIL 1 Oct 2026, AND ITS OWN TEXT NAMED THE
   * DAY IT WOULD FAIL:** *"If this ever fails, the fourth fence has learned to
   * compel the mark here — which would be G1948 taken — and the right response
   * is to delete this test and say so, not to remove the mark from
   * `start.ts`."* **G1948 is taken, by D6-8 (the owner's), and it is not the
   * FOURTH fence that learned — it is a separate SEVENTH**, because widening
   * the fourth was refused. So the test is INVERTED rather than deleted: its
   * old assertion (a bare mount boots) is now the red, and the mark in
   * `start.ts` is `servedPublicly()` rather than `servedWithoutAGate()`.
   */
  await assert.rejects(
    async () => {
      const app = await buildPlane<{ who: string }>(
        {
          plane: 'test-data-plane',
          authenticate: () => null,
          unauthenticatedDetail: 'no session',
          authorise: () => 'not_held',
          unauthorisedDetail: 'no capability',
        },
        [{ tier: 'session', handlers: { resolveHomeRealm: async () => ({ ok: true }) } }],
      )
      await app.close()
    },
    (err: Error) => {
      assert.match(err.message, /asks for NO CREDENTIAL OF ANY KIND/)
      assert.match(err.message, /resolveHomeRealm/)
      assert.match(err.message, /servedPublicly\(\)/)
      return true
    },
  )
})

test('2a2 · and the voluntary `servedWithoutAGate()` it used to wear does NOT satisfy it', async () => {
  /**
   * ⚠️ The two marks answer different questions — an AUTHENTICATED person
   * served past `decide()`, against ANYBODY served before there is a person —
   * so the old mark is not an acknowledgement of the new one. Mounting
   * `resolveHomeRealm` the way it was mounted from 22 to 30 Sep 2026 is a
   * boot failure now.
   */
  await assert.rejects(
    async () => {
      const app = await buildPlane<{ who: string }>(
        {
          plane: 'test-data-plane',
          authenticate: () => null,
          unauthenticatedDetail: 'no session',
          authorise: () => 'not_held',
          unauthorisedDetail: 'no capability',
        },
        [{ tier: 'session', handlers: { resolveHomeRealm: servedWithoutAGate(async () => ({})) } }],
      )
      await app.close()
    },
    /asks for NO CREDENTIAL OF ANY KIND/,
  )
})

test('2b · the mark is LAWFUL here — the fourth fence`s second half refuses only a GATED one', async () => {
  /**
   * 🛑 THE DIFFERENTIAL. `servedWithoutAGate()` acknowledges an exemption the
   * DOCUMENT states; it cannot create one. This operation is `exempt`, so the
   * mark agrees with the document and the plane boots (§1a already proved
   * that). A GATED operation wearing the same mark must NOT boot, and that is
   * asserted here over a real tier so the two arms sit side by side.
   */
  const capability = loadTier('capability')
  const gated = routesOf(capability, basePathOf(capability)).find(
    (s) => gateVerdictOf(s.capability) === 'gated',
  )
  assert.ok(gated, 'the capability tier declares no gated operation; pick another tier')

  await assert.rejects(
    async () => {
      const mount: TierMount = {
        tier: 'capability',
        handlers: { [gated.operationId]: servedWithoutAGate(async () => ({})) },
      }
      const app = await buildPlane<{ who: string }>(
        {
          plane: 'test-data-plane',
          authenticate: () => ({ who: 'x' }),
          unauthenticatedDetail: 'no session',
          authorise: () => 'held',
          unauthorisedDetail: 'no capability',
        },
        [mount],
      )
      await app.close()
    },
    (err: Error) => {
      assert.match(err.message, /marked `servedWithoutAGate\(\)`/)
      assert.match(err.message, new RegExp(gated.operationId))
      return true
    },
    'a mark that CONTRADICTS the document must be a boot failure',
  )
})

/* ==================================================================== *
 * §3 · THE SIXTH FENCE — VERIFIED, NOT ASSUMED
 * ==================================================================== */

test('3 · the sixth fence does not reach this operation, because it keys on `gated`', async () => {
  /**
   * 🛑 AND THE HOLE HAS A NAME. `server/http/app.ts`: *"an operation that buys
   * its way out with prose buys its way out of the record too."* Here it is
   * narrow in the one way that matters and the narrowness is a fact about the
   * MODEL rather than about this handler: `AuthorizationGrant extends
   * TenantScoped` and there is no tenant; `db/migrations/0091`'s second home
   * is keyed on the acting SESSION and there is none either. **`authorize()`
   * could not mint a record for this act at any price.**
   *
   * ⚠️ SO THE POSITIVE FORM IS ASSERTED TOO: wrapping it in
   * `recordsAuthorisation()` also boots, which proves the sixth fence is not
   * what admits this mount — the exemption is.
   */
  assert.equal(gateVerdictOf(REALM.capability), 'exempt')
  const app = await buildPlane<{ who: string }>(
    {
      plane: 'test-data-plane',
      authenticate: () => null,
      unauthenticatedDetail: 'no session',
      authorise: () => 'not_held',
      unauthorisedDetail: 'no capability',
    },
    [{ tier: 'session', handlers: { resolveHomeRealm: servedPublicly(async () => ({})) } }],
  )
  await app.close()
  /**
   * ⚠️ **THIS MOUNTED `recordsAuthorisation(…)` BARE UNTIL 1 Oct 2026, AND
   * THAT FORM NOW FAILS — ON THE SEVENTH FENCE, NOT THE SIXTH**, which is the
   * same proof from the other side: the refusal names the public mount and
   * says nothing about an authorisation record. The mount above is the
   * positive form under D6-8.
   */
  await assert.rejects(
    async () => {
      const bad = await buildPlane<{ who: string }>(
        {
          plane: 'test-data-plane',
          authenticate: () => null,
          unauthenticatedDetail: 'no session',
          authorise: () => 'not_held',
          unauthorisedDetail: 'no capability',
        },
        [{ tier: 'session', handlers: { resolveHomeRealm: recordsAuthorisation(async () => ({})) } }],
      )
      await bad.close()
    },
    (err: Error) => {
      assert.match(err.message, /asks for NO CREDENTIAL OF ANY KIND/)
      assert.doesNotMatch(err.message, /mint no authorisation record/)
      return true
    },
  )
})

/* ==================================================================== *
 * §4 · THE SCOPE — ONE GUC, BOUND, AND NOTHING ELSE
 * ==================================================================== */

test('4 · the domain reaches the database as a BOUND PARAMETER of set_config, never as SQL', async () => {
  /**
   * 🛑 THE ASSERTION NO DATABASE-BACKED TEST COULD MAKE, because a correct
   * implementation and an interpolating one return the same rows for a benign
   * input. `SET LOCAL` is utility syntax and takes no bind parameters, so the
   * obvious repair interpolates — **and here the value is a field of an
   * UNAUTHENTICATED request body**, which is the sharpest instance of that
   * trap in this repository.
   */
  const pool = fakePool({})
  await ask(pool, { domain: "acme.example'; DROP TABLE tenant.domain_claim; --" })

  const config = pool.issued.filter((q) => q.text.includes('set_config'))
  assert.equal(config.length, 1, 'exactly one GUC is set in a realm scope')
  assert.deepEqual(config[0]?.values, [
    'app.claimed_domain',
    "acme.example'; drop table tenant.domain_claim; --",
  ])
  for (const q of pool.issued) {
    assert.ok(
      !q.text.includes('acme.example'),
      `the domain appears in STATEMENT TEXT: ${q.text}`,
    )
  }
})

test('4a · no tenant scope and no session scope are opened, and the connection is released', async () => {
  /**
   * ⚠️ THE BLAST RADIUS IS THE POINT. `app.tenant_id` unset means every
   * tenant-scoped table reads EMPTY under G100; `app.session_ref` unset means
   * `tenant.session` is unaddressable even by a digest somebody guessed. A
   * caller who has presented nothing reaches exactly the claims on the domain
   * it named and the doors those claims point at.
   */
  const pool = fakePool({})
  await ask(pool, { domain: 'acme.example' })
  const names = pool.issued
    .filter((q) => q.text.includes('set_config'))
    .map((q) => q.values[0])
  assert.deepEqual(names, ['app.claimed_domain'])

  /**
   * ⚠️ **THIS READ `q.text === 'BEGIN'` AND WENT RED WHEN G1987 GAVE
   * `withRealmScope()` ITS `READ ONLY` MODE — G1998, 22 Sep 2026.** The
   * assertion was correct and the equality was keyed on the LANDMARK (the
   * exact statement text) rather than on the PROPERTY (that an explicit
   * transaction was opened at all) — §5.1, in a control about scoping.
   *
   * 🛑 **IT IS NOT LOOSENED TO A SUBSTRING AND LEFT THERE.** The mode is now
   * asserted POSITIVELY beside it, because `BEGIN READ ONLY` is the second
   * independent control `db/control-read-scope.ts` argues for and this is the
   * only scope in `db/` opened for a caller with no credential. A future edit
   * dropping the mode would otherwise pass a `startsWith('BEGIN')` silently.
   */
  const opened = pool.issued.find((q) => q.text.startsWith('BEGIN'))
  assert.ok(opened, 'no explicit transaction was opened')
  assert.equal(
    opened.text,
    'BEGIN READ ONLY',
    '`withRealmScope()` must open a READ ONLY transaction (G1987). The GRANT is per ' +
      'RELATION and per reviewer; the transaction mode is per STATEMENT and enforced by ' +
      'the server — and it is the layer that would refuse a write even while a policy ' +
      'was wrong, which `db/migrations/0170` is the recorded case of.',
  )
  assert.ok(pool.issued.some((q) => q.text === 'COMMIT'))
  assert.equal(pool.released, 1, 'the pooled connection must be returned')
})

test('4b · the reader adds NO predicate — the narrowing is the policy`s', async () => {
  /**
   * 🛑 `server/data-plane/identity.ts` one function over: *"a handler-side
   * predicate beside a policy-side one is two answers to one question, and
   * the handler is the one an attacker gets to influence."* A `WHERE domain =
   * $1` here would make `domain_claim_realm_rls` decorative.
   */
  const pool = fakePool({})
  await ask(pool, { domain: 'acme.example' })
  const reads = pool.issued.filter((q) => q.text.includes(CLAIMS) || q.text.includes(DOORS))
  assert.ok(reads.length >= 1, 'the handler read nothing at all')
  for (const q of reads) {
    assert.equal(q.values.length, 0, `the read binds a parameter: ${q.text}`)
    assert.ok(!/\bwhere\b/i.test(q.text), `the read carries its own predicate: ${q.text}`)
  }
})

/* ==================================================================== *
 * §5 · THE FOUR REFUSALS, AND THE ONE SUCCESS
 * ==================================================================== */

test('5 · a domain nobody claims is 422 `domain_not_claimed`', async () => {
  const out = await ask(fakePool({}), { domain: 'nobody.example' })
  assert.equal(out.status, 422)
  assert.equal(out.json.code, 'domain_not_claimed')
})

test('5a · a claim nobody proved is 422 `domain_not_verified`, NOT `not_claimed`', async () => {
  /**
   * 🛑 #221's OWN RED, and the mutation to defend against is a
   * `claims.length > 0` guard. `mayRouteToConnection()` is `verifiedAt !==
   * null` and nothing else; `db/migrations/0170` stores that null and refuses
   * a `challenge` column precisely so PRESENCE cannot be mistaken for PROOF.
   */
  const pool = fakePool({
    [CLAIMS]: [claim('idc_a', 'acme.example', null)],
    [DOORS]: [door('idc_a')],
  })
  const out = await ask(pool, { domain: 'acme.example' })
  assert.equal(out.status, 422)
  assert.equal(out.json.code, 'domain_not_verified')
})

test('5b · a verified claim on a DISABLED door is 422 `connection_disabled`', async () => {
  /**
   * ⚠️ THIS ARM IS WHY `db/migrations/0170` OWES A SECOND POLICY ON
   * `tenant.identity_connection`. `status` lives on the CONNECTION, so
   * without that policy the reader would see claims and no doors and answer
   * `domain_not_claimed` — a refusal that is WRONG and looks right.
   */
  const pool = fakePool({
    [CLAIMS]: [claim('idc_a', 'acme.example', PROVED)],
    [DOORS]: [door('idc_a', { status: 'disabled' })],
  })
  const out = await ask(pool, { domain: 'acme.example' })
  assert.equal(out.status, 422)
  assert.equal(out.json.code, 'connection_disabled')
})

test('5c · TWO verified claims is the TAKEOVER STATE and refuses rather than picking', async () => {
  /**
   * 🛑 *"picking either picks an `orgClass` for the user, which is the reach
   * invariant 2 exists to close."* This is also why
   * `readConnectionsClaimingDomain()` returns a LIST: a reader that returned
   * the first door would resolve a takeover by row order and report success.
   */
  const pool = fakePool({
    [CLAIMS]: [claim('idc_a', 'acme.example', PROVED), claim('idc_b', 'acme.example', PROVED)],
    [DOORS]: [door('idc_a'), door('idc_b')],
  })
  const out = await ask(pool, { domain: 'acme.example' })
  assert.equal(out.status, 422)
  assert.equal(out.json.code, 'domain_claimed_by_more_than_one_connection')
})

test('5d · an UNVERIFIED second claim does not take a tenant`s sign-in down', async () => {
  /**
   * 🛑 THE ASYMMETRY IS DELIBERATE AND IT IS THE MODEL'S: *"if an UNVERIFIED
   * claim counted towards ambiguity, anyone could take a tenant's sign-in
   * down by claiming its domain and never proving it. A denial of service is
   * not an improvement on a takeover."*
   */
  const pool = fakePool({
    [CLAIMS]: [claim('idc_a', 'acme.example', PROVED), claim('idc_b', 'acme.example', null)],
    [DOORS]: [door('idc_a'), door('idc_b')],
  })
  const out = await ask(pool, { domain: 'acme.example' })
  assert.equal(out.status, 200)
  assert.equal(out.json.connectionId, 'idc_a')
})

test('5e · the 200 carries an ID and NOTHING else — never a protocol, never an org', async () => {
  /**
   * ⚠️ *"Routing chooses the door; the door decides."* `RealmRouting` is
   * `additionalProperties: false` with one required key, and the contract
   * records the cost by name: a client cannot derive which FORM to render,
   * and widening that is a MODEL question rather than a wire one.
   */
  const pool = fakePool({
    [CLAIMS]: [claim('idc_a', 'acme.example', PROVED)],
    [DOORS]: [door('idc_a')],
  })
  const out = await ask(pool, { domain: 'acme.example' })
  assert.equal(out.status, 200)
  assert.deepEqual(Object.keys(out.json), ['connectionId'])
})

test('5f · a malformed OUR-SIDE row is a 500 and never a routing refusal', async () => {
  /**
   * 🛑 THE CHEAP ANSWER IS A 422 AND THE CHEAP ANSWER IS A LIE. Every member
   * of `DOMAIN_ROUTING_REFUSALS` is a statement about the CALLER'S domain;
   * `errors.yaml`'s closed enum has no member meaning *"our row is wrong"*.
   * Answering `domain_not_claimed` for an owner this build cannot assemble
   * would tell a customer their domain is not registered when it is.
   */
  const pool = fakePool({
    [CLAIMS]: [claim('idc_a', 'acme.example', PROVED)],
    [DOORS]: [door('idc_a', { owner_kind: 'partner', owner_partner_id: null })],
  })
  const out = await ask(pool, { domain: 'acme.example' })
  assert.equal(out.status, 500)
  assert.equal(out.json.code, 'upstream_unavailable')
})

/* ==================================================================== *
 * §6 · THE PROPERTIES THE CONTRACT CLAIMS ARE STRUCTURAL
 * ==================================================================== */

test('6 · the request admits a DOMAIN and refuses anything that names a person', async () => {
  /**
   * 🛑 THE NO-USER-EXISTENCE-SIGNAL PROPERTY, WITNESSED RATHER THAN QUOTED.
   * ajv runs with `removeAdditional: false` (G191), so a smuggled `email` is
   * REJECTED rather than stripped — under Fastify's default it would be
   * silently deleted and the request SERVED, which satisfies the rule and
   * leaves no evidence that it did.
   */
  const smuggled = await ask(fakePool({}), { domain: 'acme.example', email: 'mei@acme.example' })
  assert.equal(smuggled.status, 400)
  assert.equal(smuggled.json.code, 'validation_failed')

  const missing = await ask(fakePool({}), {})
  assert.equal(missing.status, 400)
})

test('6a · two addresses at one domain are ONE request, so the answers cannot differ', async () => {
  /**
   * ⚠️ IT IS THE SHAPE AND NOT THE IMPLEMENTATION, AND THIS ASSERTS THE
   * SHAPE: the client splits the address locally and the address never leaves
   * the browser. There is no second field to make a second request out of, so
   * the only variable is the domain — asserted by §6's rejection of `email`
   * and by the identity below.
   */
  const rows = {
    [CLAIMS]: [claim('idc_a', 'acme.example', PROVED)],
    [DOORS]: [door('idc_a')],
  }
  const first = await ask(fakePool(rows), { domain: 'acme.example' })
  const second = await ask(fakePool(rows), { domain: 'acme.example' })
  assert.deepEqual(first, second)
})

test('6b · the domain is folded through the MODEL`s own normaliser, not a local toLowerCase', async () => {
  /**
   * 🛑 *"DNS is case-insensitive and this comparison decides an ORG CLASS, so
   * folding is load-bearing rather than tidy."* The GUC must carry the folded
   * value, because the stored column holds the folded form and a policy
   * comparing an unfolded one matches nothing — the fail-closed direction,
   * and a silent one.
   */
  const pool = fakePool({})
  await ask(pool, { domain: '  ACME.Example  ' })
  const config = pool.issued.find((q) => q.text.includes('set_config'))
  assert.equal(config?.values[1], 'acme.example')
})

/* ==================================================================== *
 * §7 · NO AUTHENTICATOR IS REACHED
 * ==================================================================== */

test('7 · the operation is UNSECURED, so no authenticator runs and no principal exists', async () => {
  /**
   * The plane in `planeOver()` throws from `authenticate`, so any request that
   * reached the `onRequest` hook's second line would be a 500 with that
   * message. Every 200 and 422 above is therefore also evidence that the hook
   * returned at its first line.
   *
   * ⚠️ AND THE CONTRACT-SIDE HALF IS ASSERTED HERE RATHER THAN INFERRED: a
   * `secured` operation carrying no capability is `mountTier()`'s FIFTH fence
   * in reverse, and a reader must not have to derive `secured` from a 200.
   */
  assert.equal(REALM.secured, false)
  const out = await ask(fakePool({}), { domain: 'acme.example' })
  assert.notEqual(out.status, 500)
  assert.notEqual(out.status, 401)
})

/* ==================================================================== *
 * §8 · THE OVERSIZED BODY — AN ANONYMOUS CALLER'S HANDLE ON THE 5xx
 *      ALARM. G1985 / G1986, 22 Sep 2026.
 * ==================================================================== */

/**
 * 🛑 **THE RED, MEASURED BEFORE EITHER HALF WAS BUILT:**
 *
 *     POST /session/realm      2 MiB body -> 500 upstream_unavailable
 *     POST /context/resolve    2 MiB body -> 401 session_invalid
 *
 * The secured route answers 401 because authentication runs in `onRequest`,
 * BEFORE body parsing — `server/http/app.ts`'s second decision, working. The
 * unsecured route returns at that hook's first line, so parsing proceeded,
 * Fastify raised `FST_ERR_CTP_BODY_TOO_LARGE` (which already carries
 * `statusCode: 413`), the error handler did not map it, and **an
 * unauthenticated caller reached the arm reserved for OUR OWN unhandled
 * failures.** `infra/lib/observability-stack.ts` alarms on the data ALB's 5xx
 * rate with *"Expected rate is zero … 5xx is reserved for one
 * unhandled-failure arm"*, and since G1941 that arm is reachable through
 * CloudFront with no WAF and no throttle in front of it.
 *
 * ⚠️ **THE DIFFERENTIAL IS KEPT DELIBERATELY AND IS NOT DECORATION.** Without
 * it, §8 would pass against a plane that had simply stopped parsing bodies,
 * and §8b would pass against one that 401'd everything. The pair asserts that
 * the two routes differ for the REASON they are supposed to differ.
 */

const FOUNDATION_SPECS = routesOf(loadTier('foundation'), basePathOf(loadTier('foundation')))
const CONTEXT = FOUNDATION_SPECS.find((s) => s.operationId === 'resolveTenantContext')
assert.ok(CONTEXT, 'the foundation tier no longer declares `resolveTenantContext`')

test('8 · a body over the plane limit is 413 and never 500 — the alarm arm is not anonymously reachable', async () => {
  const app = await planeOver(fakePool({}))
  try {
    const res = await app.inject({
      method: 'POST',
      url: '/session/realm',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ domain: 'a'.repeat(2 * 1024 * 1024) }),
    })
    assert.equal(
      res.statusCode,
      413,
      'an oversized body must be a statement about the REQUEST. A 500 here is a claim ' +
        'about US, and it puts a lever on the data ALB`s 5xx alarm — whose declared ' +
        'expected rate is ZERO — into the hands of a caller who has presented nothing.',
    )
    const body = JSON.parse(res.payload) as { code?: string; detail?: string }
    assert.equal(
      body.code,
      'validation_failed',
      'the code is REUSED from `errors.yaml`s closed enum and not minted: adding a member ' +
        'is a contract change, and there is no `payload_too_large`.',
    )
    assert.ok(
      !/\d{4,}/.test(String(body.detail ?? '')),
      '`detail` must not echo the limit. `errors.yaml` forbids field values here, and a ' +
        'tuning parameter published to whoever is probing for it is worse than silence.',
    )
  } finally {
    await app.close()
  }
})

test('8a · and `maxLength` refuses an oversized domain INSIDE the limit, so ajv sees it', async () => {
  /**
   * 🛑 **BOTH HALVES ARE NEEDED AND NEITHER IS SUFFICIENT.** §8 covers a body
   * ABOVE Fastify's limit, which ajv never sees because parsing failed first.
   * This covers one BELOW it: a 300-octet domain in a small body, refused by
   * `RealmRequest.domain`'s `maxLength: 253` — RFC 1035's bound, so it refuses
   * nothing anybody can own. **A schema cannot bound what was never parsed,
   * and a status map cannot bound what parsed successfully.**
   */
  const out = await ask(fakePool({}), { domain: `${'a'.repeat(300)}.example` })
  assert.equal(out.status, 400, 'a domain longer than 253 octets is refused by the schema')
  assert.equal(out.json.code, 'validation_failed')
})

test('8b · the differential: the SECURED route answers 401 to the same body, before parsing', async () => {
  /**
   * ⚠️ THE AUTHENTICATOR RETURNS `null` HERE RATHER THAN THROWING, because
   * this plane exists to reach it — which is the opposite of `planeOver()`,
   * whose authenticator throws to prove the realm route never reaches one.
   */
  const app = await buildPlane<{ who: string }>(
    {
      plane: 'test-foundation-plane',
      authenticate: async () => null,
      unauthenticatedDetail: 'no session',
      authorise: () => 'not_held',
      unauthorisedDetail: 'no capability',
    },
    [
      {
        tier: 'foundation',
        handlers: {
          resolveTenantContext: servedWithoutAGate(async () => {
            throw new Error('the foundation route must never reach its handler unauthenticated')
          }),
        },
      },
    ],
  )
  try {
    const res = await app.inject({
      method: 'POST',
      url: '/context/resolve',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ domain: 'a'.repeat(2 * 1024 * 1024) }),
    })
    assert.equal(
      res.statusCode,
      401,
      'a SECURED operation must refuse the same body at `onRequest`, before the body is ' +
        'parsed at all. This is the property the realm route cannot have — it is ' +
        'unsecured by design — and it is why the 413 above had to be built.',
    )
    assert.equal(JSON.parse(res.payload).code, 'session_invalid')
    assert.equal(CONTEXT.secured, true, 'the differential is only meaningful while this is true')
  } finally {
    await app.close()
  }
})

/* ==================================================================== *
 * §9 · THE RESPONSE-LENGTH CHANNEL. G1989, 22 Sep 2026.
 * ==================================================================== */

test('9 · all four refusals are the SAME NUMBER OF BYTES, so length distinguishes none of them', async () => {
  /**
   * 🛑 **THE RED, MEASURED ON THE EXACT STRINGS THIS HANDLER SHIPS:**
   *
   *     364  domain_not_claimed
   *     366  domain_not_verified
   *     366  connection_disabled
   *     412  domain_claimed_by_more_than_one_connection   <- 46 bytes clear
   *
   * The `code` appears TWICE in an RFC 9457 problem — once as `type`'s last
   * segment and once as `code` — so the body's length is a linear function of
   * the code's length. **`domain_claimed_by_more_than_one_connection` IS THE
   * TAKEOVER STATE**, and it was the one arm a passive observer could identify
   * without TLS, without the body, and without ever making the request — from
   * a ciphertext length alone.
   *
   * The contract's stated reason for one shared status is that two statuses
   * would put the distinction *"in a channel a caller can read without parsing
   * a body."* **Length is exactly such a channel**, and the handler was already
   * careful about the other two (one `title`, one `detail`).
   *
   * ⚠️ **THIS ASSERTS EQUALITY AND NOT A CONSTANT.** Pinning 412 would make
   * every future wording change to `detail` a red gate for no property gained;
   * what must hold is that the four agree with EACH OTHER.
   */
  const PROVED_AT = '2026-09-01T00:00:00.000Z'
  const arms: ReadonlyArray<readonly [string, Record<string, Array<Record<string, unknown>>>]> = [
    ['domain_not_claimed', {}],
    ['domain_not_verified', { [CLAIMS]: [claim('idc_a', 'x.example', null)], [DOORS]: [door('idc_a')] }],
    [
      'connection_disabled',
      {
        [CLAIMS]: [claim('idc_a', 'x.example', PROVED_AT)],
        [DOORS]: [door('idc_a', { status: 'disabled' })],
      },
    ],
    [
      'domain_claimed_by_more_than_one_connection',
      {
        [CLAIMS]: [claim('idc_a', 'x.example', PROVED_AT), claim('idc_b', 'x.example', PROVED_AT)],
        [DOORS]: [door('idc_a'), door('idc_b')],
      },
    ],
  ]

  const seen: Array<{ code: string; bytes: number }> = []
  for (const [label, rows] of arms) {
    const app = await planeOver(fakePool(rows))
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/session/realm',
        payload: { domain: 'x.example' },
      })
      assert.equal(res.statusCode, 422, `${label} must be a 422`)
      seen.push({
        code: (JSON.parse(res.payload) as { code: string }).code,
        bytes: Buffer.byteLength(res.payload),
      })
    } finally {
      await app.close()
    }
  }

  /* Anti-vacuity: the four arms must actually BE four different arms, or
   * equal lengths would be trivially true. */
  assert.equal(new Set(seen.map((s) => s.code)).size, 4, 'the fixture must reach all four arms')

  const lengths = new Set(seen.map((s) => s.bytes))
  assert.equal(
    lengths.size,
    1,
    'every refusal on this operation must be the same number of bytes. The contract puts ' +
      'the distinction in `ErrorCode` "and by nothing else"; a length difference is a ' +
      'channel a network observer reads WITHOUT the body, and the widest gap was on the ' +
      `TAKEOVER arm. Got: ${seen.map((s) => `${s.code}=${s.bytes}`).join(' ')}`,
  )
})

test('9a · and the 200 is NOT padded to match — that oracle is the contract`s, and is D6`s to narrow', async () => {
  /**
   * ⚠️ **DELIBERATE, AND THE ONE ASSERTION IN THIS FILE THAT WOULD BE WRONG TO
   * "FIX".** A success is a couple of dozen bytes and a refusal is hundreds,
   * so a 200 and a 422 stay trivially distinguishable by length. **That is the
   * DOMAIN-EXISTENCE ORACLE the contract leaves open BY NAME** — *"A 200 for a
   * claimed domain and a 422 for an unclaimed one is a DOMAIN-existence
   * signal … It is not invented away"* — and closing it here would be a
   * contract change made in a handler.
   *
   * §9 closes the distinction AMONG the refusals, which the contract says must
   * not be readable outside the body. **Narrowing the oracle itself is D6's**,
   * and `server/data-plane/realm.ts`'s register carries it as entry (3).
   */
  const rows = {
    [CLAIMS]: [claim('idc_a', 'acme.example', PROVED)],
    [DOORS]: [door('idc_a')],
  }
  const ok = await ask(fakePool(rows), { domain: 'acme.example' })
  const refused = await ask(fakePool({}), { domain: 'acme.example' })
  assert.equal(ok.status, 200)
  assert.equal(refused.status, 422)
  assert.notEqual(
    JSON.stringify(ok.json).length,
    JSON.stringify(refused.json).length,
    'if these ever become equal, somebody has closed the contract`s deliberate oracle in a ' +
      'handler. That is a contract change and an owner`s ruling, not a padding decision.',
  )
})
