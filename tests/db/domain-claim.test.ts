/**
 * `tenant.domain_claim` — THE TABLE `db/migrations/0009_identity_substrate.sql`
 * OWED TO THIS COMMIT BY NAME, AND THE TWO POLICIES THAT LET A CALLER WITH NO
 * CREDENTIAL READ IT. **G1942–G1946, 22 Sep 2026.**
 *
 * 0009, at `tenant.identity_connection`: *"**The commit that builds federated
 * sign-in owns the `domain_claim` table, in the same commit as the router that
 * reads it.**"* `resolveHomeRealm` is that router.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS SUITE IS THE HALF `tests/http/realm-served.test.ts` CANNOT PROVE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * That file drives the handler over a RECORDING FAKE POOL, so it proves the
 * wiring — the mount, the fences, one bound GUC, an empty `WHERE`, the
 * normalisation and all four refusal arms. **It proves nothing about the
 * POLICY**, and the policy is the whole of the security argument: without it
 * an unauthenticated caller reads the claim table rather than one domain's
 * rows.
 *
 * ⚠️ **§3 IS THE MEASUREMENT `db/realm-scope.ts` OWED AND COULD NOT MAKE, AND
 * IT HAS NOW BEEN MADE — 22 Sep 2026, PostgreSQL 16.13.** That header pays
 * `db/session-scope.ts`'s bar — *"each exists because a table cannot be
 * protected by the other's predicate"* — and said in its own voice that its
 * four arms were DERIVED FROM THE POLICY TEXT rather than run, because the
 * machine the slice was built on had no PostgreSQL. **§3 was that claim made
 * runnable; the first machine with a database confirmed it, and the header is
 * corrected in place.**
 *
 * 🛑 **AND THE FIRST RUN FOUND THAT ONE OF THE FOUR ARMS WAS NOT HERE —
 * G1993.** The header said §3 opened four scopes; it opened THREE. The missing
 * one was **`withSelectionScope()`, the WIDEST scope in `db/` and the only one
 * that sets BOTH GUCs** — the arm likeliest to read something was the arm
 * nobody had written. **A narration cannot notice its own gap.**
 *
 * ⚠️ **§4's SCOPE MOVED FOR A REASON WORTH READING BEFORE EDITING IT (G1995)**:
 * G1987 gave `withRealmScope()` a `READ ONLY` mode, which began refusing §4's
 * three statements for the WRONG REASON. §4 now runs in a WRITABLE scope so
 * that the only thing left to refuse them is the GRANT; the mode is asserted
 * separately at §8.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, type TenantPool } from '../../db/tenant-scope.ts'
import { withTenantScope } from '../../db/tenant-scope.ts'
import { withSessionScope } from '../../db/session-scope.ts'
import { withSelectionScope } from '../../db/selection-scope.ts'
import { withSignInScope } from '../../db/signin-scope.ts'
import { withRealmScope } from '../../db/realm-scope.ts'

import {
  DOMAIN_ROUTING_REFUSALS,
  normaliseClaimedDomain,
  routeToConnection,
} from '../../model/domain.ts'
import { readConnectionsClaimingDomain } from '../../server/data-plane/identity.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE. Set before the first call that reads it — the named flake
 * `tests/db/tenant-projection.test.ts` documents at length. `db/env.ts`
 * resolves `RECONCILE_DB_NAME` per call and never at import.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_REALM_DB_NAME'] ?? runScopedName('reconcile_realm_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

const DOOR_ACME = 'idc_acme_entra'
const DOOR_RIVAL = 'idc_rival_entra'
const DOOR_OFF = 'idc_acme_retired'

const ACME_DOMAIN = 'acme.example'
const UNPROVED_DOMAIN = 'claimed.example'
const DISABLED_DOMAIN = 'retired.example'
const CONTESTED_DOMAIN = 'contested.example'
/** A domain no row carries. §2 and §3 both need one. */
const ORPHAN_DOMAIN = 'nobody.example'

/** A session digest no row carries — §3's session arm. */
const ORPHAN_DIGEST = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

const PROVED = '2026-09-01T00:00:00Z'

const probe = await probeDatabase()
const skip = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the domain claim test', probe)

async function seed(): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')

    await mig.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES
         ($1, 'oidc', 'Acme Entra ID',   'customer', NULL, 'acc_acme',   $4, 'acme-entra',   'active'),
         ($2, 'oidc', 'Rival Entra ID',  'customer', NULL, 'acc_rival',  $4, 'rival-entra',  'active'),
         ($3, 'oidc', 'Acme retired',    'customer', NULL, 'acc_acme',   $4, 'acme-retired', 'disabled')`,
      [DOOR_ACME, DOOR_RIVAL, DOOR_OFF, 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_POOL'],
    )

    /**
     * ⚠️ FOUR CLAIMS ACROSS THREE DOORS, AND EVERY ONE OF THEM EXISTS TO MAKE
     * ONE REFUSAL REACHABLE. A fixture carrying only the happy case would let
     * §2's four arms pass whether the reader distinguished them or not —
     * §5.6, a control whose failing case cannot occur.
     */
    await mig.query(
      `INSERT INTO tenant.domain_claim (connection_id, domain, verified_at)
       VALUES
         ($1, $4, $8),      -- proved, active door            -> 200
         ($1, $5, NULL),    -- claimed, NEVER proved          -> domain_not_verified
         ($3, $6, $8),      -- proved, DISABLED door          -> connection_disabled
         ($1, $7, $8),      -- two doors, both proved         -> ambiguous
         ($2, $7, $8)`,
      [
        DOOR_ACME,
        DOOR_RIVAL,
        DOOR_OFF,
        ACME_DOMAIN,
        UNPROVED_DOMAIN,
        DISABLED_DOMAIN,
        CONTESTED_DOMAIN,
        PROVED,
      ],
    )

    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

describe('the domain claim — one table, two policies, and no credential at all', { skip }, () => {
  let pool: TenantPool

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    /* `max: 1` is adversarial on purpose: every scoped transaction is forced
     * onto the connection the previous one released, which is the condition
     * under which a `set_config` whose third argument was `false` would leak
     * between scopes. */
    pool = await createAppPool(1)
  })

  after(async () => {
    await pool.end()
  })

  /* ================================================================ *
   * §1 — THE POLICY NARROWS TO ONE DOMAIN, AND THE NARROWING IS ITS
   * ================================================================ */

  it('1. a realm scope reads the claims on the ONE domain it named and no others', async () => {
    const rows = await withRealmScope(pool, { claimedDomain: ACME_DOMAIN }, async (tx) =>
      (await tx.query('SELECT connection_id, domain FROM tenant.domain_claim')).rows,
    )
    assert.deepEqual(
      rows.map((r) => (r as { domain: string }).domain),
      [ACME_DOMAIN],
      'the SELECT carries no WHERE at all, so a result wider than one domain means ' +
        '`domain_claim_realm_rls` was widened — and the handler, which also carries no ' +
        'WHERE, would then return the claim table to an unauthenticated caller.',
    )
  })

  it('1a. it reads the DOORS those claims point at, and no others', async () => {
    const rows = await withRealmScope(pool, { claimedDomain: CONTESTED_DOMAIN }, async (tx) =>
      (await tx.query('SELECT id FROM tenant.identity_connection ORDER BY id')).rows,
    )
    assert.deepEqual(
      rows.map((r) => (r as { id: string }).id).sort(),
      [DOOR_ACME, DOOR_RIVAL].sort(),
      '`identity_connection_realm_rls` must admit exactly the doors claiming the named ' +
        'domain. Fewer and `connection_disabled` is unreachable; more and a realm lookup ' +
        'is a directory listing.',
    )
  })

  it('1b. a domain nobody claims reads NOTHING rather than everything', async () => {
    const rows = await withRealmScope(pool, { claimedDomain: ORPHAN_DOMAIN }, async (tx) => ({
      claims: (await tx.query('SELECT 1 FROM tenant.domain_claim')).rows.length,
      doors: (await tx.query('SELECT 1 FROM tenant.identity_connection')).rows.length,
    }))
    assert.deepEqual(rows, { claims: 0, doors: 0 })
  })

  /* ================================================================ *
   * §2 — THE READER AND THE MODEL, END TO END OVER REAL POLICIES
   * ================================================================ */

  const route = async (domain: string) =>
    withRealmScope(pool, { claimedDomain: domain }, async (tx) => {
      const outcome = await readConnectionsClaimingDomain(tx)
      assert.ok(outcome.ok, `the reader refused: ${outcome.ok ? '' : outcome.refusal}`)
      return routeToConnection(outcome.connections, domain)
    })

  it('2. a verified claim on a live door routes, and returns an ID', async () => {
    const out = await route(ACME_DOMAIN)
    assert.deepEqual(out, { ok: true, connectionId: DOOR_ACME })
  })

  it('2a. a claim nobody proved is `domain_not_verified` — #221`s red', async () => {
    const out = await route(UNPROVED_DOMAIN)
    assert.deepEqual(out, {
      ok: false,
      refusal: DOMAIN_ROUTING_REFUSALS.domainNotVerified,
    })
  })

  it('2b. a verified claim on a disabled door is `connection_disabled`', async () => {
    const out = await route(DISABLED_DOMAIN)
    assert.deepEqual(out, {
      ok: false,
      refusal: DOMAIN_ROUTING_REFUSALS.connectionDisabled,
    })
  })

  it('2c. two verified claims is the takeover state and refuses', async () => {
    const out = await route(CONTESTED_DOMAIN)
    assert.deepEqual(out, {
      ok: false,
      refusal: DOMAIN_ROUTING_REFUSALS.domainClaimedByMoreThanOneConnection,
    })
  })

  it('2d. a domain nobody claims is `domain_not_claimed`', async () => {
    const out = await route(ORPHAN_DOMAIN)
    assert.deepEqual(out, { ok: false, refusal: DOMAIN_ROUTING_REFUSALS.domainNotClaimed })
  })

  /* ================================================================ *
   * §3 — `db/realm-scope.ts` OWES `session-scope.ts`'s BAR. THIS IS IT.
   * ================================================================ */

  it('3. the realm read is REFUSED inside every other scope in this directory', async () => {
    const count = async (tx: { query: (t: string) => Promise<{ rows: unknown[] }> }) =>
      (await tx.query('SELECT 1 FROM tenant.domain_claim')).rows.length

    /* withTenantScope — there is no tenant before a session, and this table is
     * not keyed on `app.tenant_id` in any case. */
    const inTenant = await withTenantScope(pool, ACME, count)
    assert.equal(inTenant, 0, 'a tenant scope must read no claim: the table has no tenant_id')

    /* withSessionScope — a person asking which door to knock on has not been
     * through any door. G340's deadlock, one step earlier. */
    const inSession = await withSessionScope(pool, ORPHAN_DIGEST, count)
    assert.equal(inSession, 0, 'a session scope must read no claim')

    /* withSignInScope — the CLOSEST MISS, and the one to read. That helper is
     * keyed on the handle of the door the caller has ALREADY been sent to;
     * `resolveHomeRealm` is the operation that answers which door that is.
     * A caller cannot name the door it is asking about. */
    const inSignIn = await withSignInScope(
      pool,
      { brokerIssuer: '', brokerRef: '', stateDigest: ORPHAN_DIGEST },
      count,
    )
    assert.equal(inSignIn, 0, 'a sign-in scope must read no claim')

    /**
     * ⚠️ `withSelectionScope` — ADDED 22 Sep 2026, G1993. **THIS ARM WAS
     * MISSING AND `db/realm-scope.ts`'s HEADER CLAIMED IT WAS HERE**: that
     * file said §3 *"opens each of the four scopes in turn"* and this test
     * opened THREE. The header argued four arms in prose and the runnable
     * claim covered three of them, so the one scope that sets BOTH GUCs — the
     * widest in the directory, and therefore the likeliest to read something
     * — was the one nobody measured.
     *
     * It sets `app.tenant_id` AND `app.session_ref` and must STILL read
     * nothing: `tenant.domain_claim` carries no `tenant_id` column for the
     * first to narrow on, and the second resolves a door through a session
     * that names no row. Two GUCs, neither of them `app.claimed_domain`.
     */
    const inSelection = await withSelectionScope(pool, ORPHAN_DIGEST, ACME, count)
    assert.equal(
      inSelection,
      0,
      'a selection scope sets BOTH GUCs and must still read no claim. A non-zero here ' +
        'means the widest scope in `db/` reaches the realm table, which is the one ' +
        'outcome `db/realm-scope.ts` exists to make impossible.',
    )

    /**
     * ⚠️ **`withControlReadScope` GETS NO ARM AND THE ABSENCE IS ARGUED.** It
     * opens the CONTROL database on its own credential; `domain_claim` and
     * `identity_connection` are in the DATA one, so the statement above would
     * fail with `relation "tenant.domain_claim" does not exist` rather than
     * return zero rows. **That is a different fact from the one this test
     * asserts** — topology rather than policy — and dressing it up as a
     * zero-row read would be an assertion that passed for the wrong reason.
     * `tests/http/console-roster-unreachable.test.ts` §1b holds the
     * cross-plane fence from the other side.
     */
  })

  it('3a. and the realm scope admits NOTHING to the scopes it sits beside', async () => {
    /**
     * 🛑 THE OTHER DIRECTION, AND IT IS THE ONE A NEW PERMISSIVE POLICY
     * BREAKS. `identity_connection_realm_rls` is a THIRD policy on a table two
     * other scopes already read, and permissive policies are OR-ed — so if
     * its `EXISTS` were satisfiable with the GUC unset, every session-scoped
     * caller in the product would gain a directory listing. G100's
     * deny-on-NULL is what stops that, and this asserts it rather than
     * reasoning about it.
     */
    const inSession = await withSessionScope(pool, ORPHAN_DIGEST, async (tx) =>
      (await tx.query('SELECT id FROM tenant.identity_connection')).rows.length,
    )
    assert.equal(
      inSession,
      0,
      'a session naming no row must still see NO door. A non-zero here means the realm ' +
        'policy is satisfiable with `app.claimed_domain` unset, and it has widened every ' +
        'other scope in the product rather than adding one of its own.',
    )
  })

  /* ================================================================ *
   * §4 — THE GRANT. `SELECT` AND NOTHING ELSE.
   * ================================================================ */

  it('4. the app role cannot write a claim, at any price', async () => {
    /**
     * 🛑 A PATH THAT COULD WRITE HERE COULD CLAIM A DOMAIN IT DOES NOT OWN,
     * PROVE IT BY WRITING A TIMESTAMP, AND CAPTURE EVERY SIGN-IN AT THAT
     * DOMAIN — and, because `orgClass` derives from `orgFor(connection.owner)`,
     * the ORGANISATION those people resolve to as well. `model/domain.ts`
     * names the attack: *"a partner that registers a customer's domain
     * captures those logins AND the organisation those users resolve to."*
     *
     * ⚠️ IT IS ASSERTED AS A LIVE REFUSAL AND NOT AS AN ABSENT `GRANT` LINE,
     * because an absent grant and an absent table look identical in a
     * migration set — `db/migrations-control/0020`'s own finding.
     *
     * ═════════════════════════════════════════════════════════════════════
     * 🛑 THE SCOPE CHANGED ON 22 Sep 2026 AND THE REASON IS A FINDING, NOT A
     *    TIDY-UP — G1995.
     * ═════════════════════════════════════════════════════════════════════
     *
     * **This ran inside `withRealmScope()` and G1987 gave that helper
     * `BEGIN READ ONLY`, so all three statements began failing with
     * `cannot execute INSERT in a read-only transaction` — and the
     * `/permission denied/i` matcher caught it.** The suite went RED, which
     * is the only reason anybody noticed.
     *
     * **Had the matcher been loose, this control would have gone on passing
     * while testing the TRANSACTION MODE instead of the GRANT** — so a later
     * commit adding `GRANT INSERT ON tenant.domain_claim` would not have
     * moved it. That is §5.6 arriving through a control that was correct
     * until a second control was added in front of it.
     *
     * **So the statements run in `withTenantScope()`, which is WRITABLE.**
     * PostgreSQL checks table privileges BEFORE row-level security, so the
     * only thing left to refuse them is the privilege `0170` withholds —
     * which is exactly what this test is named for. **The read-only mode is
     * asserted separately at §8, where nothing can mask it either.** Two
     * independent controls, each witnessed where the other cannot stand in
     * for it.
     */
    for (const statement of [
      `INSERT INTO tenant.domain_claim (connection_id, domain, verified_at)
         VALUES ('${DOOR_RIVAL}', '${ACME_DOMAIN}', now())`,
      `UPDATE tenant.domain_claim SET verified_at = now()`,
      `DELETE FROM tenant.domain_claim`,
    ]) {
      await assert.rejects(
        withTenantScope(pool, ACME, async (tx) => tx.query(statement)),
        /permission denied/i,
        `the app role performed: ${statement}`,
      )
    }
  })

  /* ================================================================ *
   * §5 — THE TRIPWIRE. G231's EXPIRY QUESTION IS STILL OPEN.
   * ================================================================ */

  it('5. the table carries NO expiry column, and the absence is G231 declining a decision', async () => {
    /**
     * 🛑 THIS ASSERTS A LIMITATION, SO IT GOES RED THE DAY SOMEBODY ADDS THE
     * COLUMN — WHICH IS DELIBERATE. `DomainClaim.verificationExpiresAt` is
     * *"RECORDED AND NOTHING ROUTES ON IT"*, and G231 says the reversal
     * *"needs its own argument rather than arriving as a side effect of this
     * row"*: blocking on lapse is the OPPOSITE polarity to `TenantContact`,
     * and it is the polarity that can lock a tenant out of its own directory
     * on a clerical failure. `mayRouteToConnection()` takes no clock for the
     * same reason.
     *
     * **A column here would be read by nothing (0004's refusal) and would be
     * the obvious thing for the next reader to add an
     * `AND verification_expires_at > now()` against.** The commit that takes
     * that ruling deletes this assertion and says so.
     */
    const mig = await migratorClient()
    try {
      const cols = await mig.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'tenant' AND table_name = 'domain_claim'
          ORDER BY column_name`,
      )
      assert.deepEqual(
        cols.rows.map((r) => (r as { column_name: string }).column_name),
        ['connection_id', 'domain', 'verified_at'],
        'THREE columns and the two that are absent are refused BY NAME on the migration`s ' +
          'face: the `challenge` pair is the VERIFIER`s and there is no verifier, and ' +
          '`verification_expires_at` is G231 declining a decision. Adding either is a ' +
          'ruling, and it deletes this assertion.',
      )
    } finally {
      await mig.end()
    }
  })

  it('5a. RLS is ENABLEd and FORCEd, so the owner is bound too', async () => {
    const mig = await migratorClient()
    try {
      const out = await mig.query(
        `SELECT c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'tenant' AND c.relname = 'domain_claim'`,
      )
      assert.deepEqual(out.rows[0], { enabled: true, forced: true })
    } finally {
      await mig.end()
    }
  })

  /* ================================================================ *
   * §6 — THE POLICIES NAME A VERB. G1982, 22 Sep 2026.
   *
   * 🛑 BOTH POLICIES SHIPPED AS `FOR ALL` WITH NO `WITH CHECK`, AND THAT
   *    IS NOT THE SAME AS HAVING NO `WITH CHECK`: PostgreSQL REUSES THE
   *    `USING` EXPRESSION AS THE `WITH CHECK` FOR INSERT AND UPDATE.
   *    `db/migrations/0027_session_lapsed_policy_is_update_only.sql` exists
   *    in this repository for exactly this defect, on a different table.
   * ================================================================ */

  it('6. both realm policies are FOR SELECT, and neither carries a WITH CHECK', async () => {
    /**
     * ⚠️ READ FROM THE CATALOGUE AND NOT FROM THE MIGRATION TEXT. A grep of
     * the `.sql` would pass on a file that spelled `FOR SELECT` in a comment;
     * `pg_policy.polcmd` is what the server actually stored.
     *
     * `polcmd` is `'r'` for SELECT and `'*'` for ALL. The `'*'` is the shipped
     * defect and this assertion is the thing that would have caught it.
     */
    const mig = await migratorClient()
    try {
      const out = await mig.query(
        `SELECT p.polname, p.polcmd::text AS cmd,
                pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
           FROM pg_policy p
          WHERE p.polname IN ('domain_claim_realm_rls', 'identity_connection_realm_rls')
          ORDER BY p.polname`,
      )
      assert.deepEqual(
        out.rows,
        [
          { polname: 'domain_claim_realm_rls', cmd: 'r', with_check: null },
          { polname: 'identity_connection_realm_rls', cmd: 'r', with_check: null },
        ],
        'cmd must be `r` (SELECT). A `*` means the policy is FOR ALL, and a FOR ALL ' +
          'policy with a USING and no WITH CHECK uses the USING expression AS the ' +
          'WITH CHECK for INSERT — so the clause governing writes would be present, ' +
          'permissive, and derived from `app.claimed_domain`, a value the CALLER supplies.',
      )
    } finally {
      await mig.end()
    }
  })

  it('6b. and a claim INSERT is refused even to a role that HOLDS the privilege', async () => {
    /**
     * 🛑 THE CAPTURED RED, RE-WITNESSED ON EVERY RUN. Against the policy as it
     * shipped — `FOR ALL`, no `WITH CHECK` — this exact INSERT returned
     * `INSERT 0 1` and COMMITTED, because the implied check was
     * `domain = app.claimed_domain` and the attacker had named that domain.
     * **The policy admitted precisely the takeover row and refused only rows
     * for a domain the caller had not named.**
     *
     * ⚠️ THE GRANT IS MADE HERE DELIBERATELY AND IS THE WHOLE POINT. `0170`
     * grants `SELECT` alone, so asserting against the app role would pass on
     * the PRIVILEGE and prove nothing about the POLICY — §5.6, a control whose
     * failing case cannot occur. This role is given the INSERT so that the
     * only thing left to refuse it is `domain_claim_realm_rls`.
     *
     * ⚠️ AND THE TRANSACTION IS OPENED BY HAND RATHER THAN THROUGH
     * `withRealmScope()`, BECAUSE THAT HELPER IS `BEGIN READ ONLY` SINCE
     * G1987 AND WOULD REFUSE THIS WRITE BEFORE THE POLICY EVER SAW IT. Using
     * it here would make this assertion a second copy of §8 wearing §6b's
     * name — the exact masking G1995 records one section up. **What is under
     * test is the POLICY, so the mode is deliberately not in the way.**
     */
    const mig = await migratorClient()
    let granted = false
    try {
      /* The app role is given the privilege `0170` withholds, so that the
       * only thing left to refuse the write is `domain_claim_realm_rls`. */
      await mig.query('GRANT INSERT ON tenant.domain_claim TO reconcile_app')
      granted = true

      const client = await pool.connect()
      let refusal: string | null = null
      let readBack = -1
      try {
        await client.query('BEGIN')
        await client.query('SELECT set_config($1, $2, true)', ['app.claimed_domain', ACME_DOMAIN])

        /* ⚠️ ANTI-VACUITY FIRST: the SELECT arm must work in this very
         * transaction, or the refusal below could be a policy that denies
         * everything — or a GUC that never got set. */
        readBack = (await client.query('SELECT connection_id FROM tenant.domain_claim')).rows.length

        try {
          await client.query(
            `INSERT INTO tenant.domain_claim (connection_id, domain, verified_at)
             VALUES ($1, $2, now())`,
            [DOOR_RIVAL, ACME_DOMAIN],
          )
        } catch (err) {
          refusal = err instanceof Error ? err.message : String(err)
        }
        await client.query('ROLLBACK')
      } finally {
        client.release()
      }

      assert.equal(readBack, 1, 'the SELECT arm must be unaffected by naming the verb')
      assert.ok(
        refusal !== null && /row-level security/i.test(refusal),
        'a role HOLDING `INSERT` must still be refused by the POLICY. A success here means ' +
          '`domain_claim_realm_rls` is FOR ALL again — and because its implied WITH CHECK is ' +
          'the USING expression, it would admit PRECISELY the takeover row: a claim on the ' +
          'domain the caller named, verified by a timestamp the caller wrote, capturing every ' +
          'sign-in at that domain and the ORGANISATION those people resolve to. ' +
          `Got: ${refusal ?? 'the INSERT SUCCEEDED'}`,
      )
    } finally {
      if (granted) {
        await mig
          .query('REVOKE INSERT ON tenant.domain_claim FROM reconcile_app')
          .catch(() => undefined)
      }
      await mig.end()
    }
  })

  /* ================================================================ *
   * §7 — THE INDEX ON `domain`, AND THE UNIQUE ONE THAT IS ABSENT.
   * ================================================================ */

  it('7. `domain` is indexed on its own, because it is the only column any reader filters on', async () => {
    /**
     * 🛑 THE PRIMARY KEY IS `(connection_id, domain)` AND POSTGRESQL HAS NO
     * INDEX SKIP SCAN, so a predicate naming only `domain` cannot use it.
     * Every reader and both policies filter on `domain`; **nothing anywhere
     * filters on `connection_id` alone.** An anonymous caller chooses the cost
     * of that scan and holds a pooled connection for the whole of it.
     */
    const mig = await migratorClient()
    try {
      const out = await mig.query(
        `SELECT indexdef FROM pg_indexes
          WHERE schemaname = 'tenant' AND tablename = 'domain_claim'`,
      )
      const defs = out.rows.map((r) => (r as { indexdef: string }).indexdef)
      assert.ok(
        defs.some((d) => /\(domain\)/.test(d) && !/UNIQUE/i.test(d)),
        'a non-unique index leading on `domain` must exist. Without it every realm lookup ' +
          `is a sequential scan chosen by an unauthenticated caller. Got: ${defs.join(' | ')}`,
      )
    } finally {
      await mig.end()
    }
  })

  it('7a. and there is NO unique index on `domain` — G1983 is put to the owner, not taken', async () => {
    /**
     * 🛑 THIS ASSERTS A LIMITATION, SO IT GOES RED THE DAY SOMEBODY TAKES THE
     * RULING — WHICH IS DELIBERATE. `UNIQUE (domain) WHERE verified_at IS NOT
     * NULL` would make the VERIFIED collision unrepresentable, and
     * `db/migrations/0220_domain_claim.sql`'s closing block argues it both
     * ways at length: it would stop a takeover converting into a permanent
     * sign-in outage for the victim, and it would make
     * `domain_claimed_by_more_than_one_connection` unreachable through the
     * only writer this product will ever have.
     *
     * **The commit that takes it deletes this assertion and meets that block
     * on the way past.**
     */
    const mig = await migratorClient()
    try {
      const out = await mig.query(
        `SELECT indexdef FROM pg_indexes
          WHERE schemaname = 'tenant' AND tablename = 'domain_claim'
            AND indexdef ILIKE '%UNIQUE%'`,
      )
      const defs = out.rows.map((r) => (r as { indexdef: string }).indexdef)
      assert.deepEqual(
        defs.filter((d) => !/\(connection_id, domain\)/.test(d)),
        [],
        'the ONLY unique index here is the primary key. A second one means G1983 was taken ' +
          'without the owner, and two connections holding a verified claim on one domain — ' +
          'the takeover state the product REPORTS — became unrepresentable.',
      )
    } finally {
      await mig.end()
    }
  })

  /* ================================================================ *
   * §8 — THE REALM SCOPE IS READ ONLY. G1987, 22 Sep 2026.
   * ================================================================ */

  it('8. `withRealmScope()` opens a READ ONLY transaction, and the scoping statement survives it', async () => {
    /**
     * 🛑 TWO ASSERTIONS AND BOTH ARE NEEDED. The mode is a SECOND, independent
     * control beside the `GRANT` — per STATEMENT and enforced by the server,
     * where a grant is per RELATION and per reviewer — and it is the layer
     * that would have refused a write even while `0170`'s policies were
     * `FOR ALL`.
     *
     * ⚠️ AND `set_config(…, is_local => true)` MUST STILL WORK INSIDE IT, or
     * the helper's own scoping statement would be refused and every realm
     * lookup would fail closed in a way that reads like a policy problem. That
     * is measured here rather than assumed — §1 above passing IS that
     * measurement, and this asserts the mode that makes it non-obvious.
     */
    const mode = await withRealmScope(pool, { claimedDomain: ACME_DOMAIN }, async (tx) =>
      (await tx.query('SHOW transaction_read_only')).rows[0],
    )
    assert.deepEqual(
      mode,
      { transaction_read_only: 'on' },
      '`withRealmScope()` must issue `BEGIN READ ONLY`. It is the only read-only scope in ' +
        '`db/` opened for a caller with NO CREDENTIAL, and `db/control-read-scope.ts` argues ' +
        'the control at length: the grant is per relation, the mode is per statement.',
    )

    /* The write arm, witnessed rather than reasoned: a migrator INSERT that
     * would otherwise succeed must be refused by the MODE. */
    let refusal: string | null = null
    try {
      await withRealmScope(pool, { claimedDomain: ACME_DOMAIN }, async (tx) => {
        await tx.query(
          `INSERT INTO tenant.domain_claim (connection_id, domain) VALUES ($1, $2)`,
          [DOOR_ACME, 'read-only-probe.example'],
        )
      })
    } catch (err) {
      refusal = err instanceof Error ? err.message : String(err)
    }
    assert.ok(
      refusal !== null && /read-only transaction/i.test(refusal),
      'a write inside a realm scope must be refused by the TRANSACTION MODE, independently ' +
        `of any grant or policy. Got: ${refusal ?? 'the INSERT was not refused'}`,
    )
  })

  /* ================================================================ *
   * §9 — `normaliseClaimedDomain()` MEETS A REAL DATABASE. G1994.
   *
   * 🛑 THE FUNCTION IS `trim().toLowerCase()` AND THE INTERESTING CASES ARE
   *    THE ONES IT DOES NOT HANDLE. They are RECORDED rather than fixed:
   *    changing the fold is a comparison that decides an ORG CLASS, and it is
   *    `model/domain.ts`'s decision, not this suite's.
   * ================================================================ */

  it('9. a NUL byte in the domain reaches `set_config` and is REFUSED by the server', async () => {
    /**
     * 🛑 THE ONE CASE THAT IS A LIVE QUESTION RATHER THAN A CURIOSITY, AND IT
     * IS NOW TESTABLE BECAUSE A REAL SERVER IS ANSWERING.
     *
     * `normaliseClaimedDomain()` is `trim().toLowerCase()`: a NUL is neither
     * whitespace nor cased, so **it passes through untouched** and arrives at
     * `set_config($1, $2, true)` as a bound parameter. PostgreSQL's `text`
     * type cannot hold one.
     *
     * **This asserts the SERVER refuses it, and that is the important half:
     * the value is bound, never interpolated, so the failure is a clean error
     * on a parameter rather than a truncated string silently matching a
     * DIFFERENT domain.** A `set_config` built by concatenation would
     * truncate at the NUL in the C string and scope the read to a prefix —
     * which is `db/realm-scope.ts`'s whole argument for the bind, witnessed.
     */
    let refusal: string | null = null
    try {
      await withRealmScope(pool, { claimedDomain: `${ACME_DOMAIN}\u0000.evil.example` }, async (tx) =>
        (await tx.query('SELECT 1 FROM tenant.domain_claim')).rows.length,
      )
    } catch (err) {
      refusal = err instanceof Error ? err.message : String(err)
    }
    assert.ok(
      refusal !== null,
      'a NUL byte must be REFUSED rather than truncated. A silent truncation here would ' +
        'scope the read to a PREFIX of the domain the caller named, which is the failure ' +
        'mode the bound parameter exists to prevent.',
    )
  })

  it('9a. a trailing dot and a Kelvin sign are NOT folded, and both simply fail to match', async () => {
    /**
     * ⚠️ THREE RECORDED NON-EQUIVALENCES, ASSERTED AS REFUSALS RATHER THAN
     * REPAIRED. All three are fail-CLOSED — an unfolded value matches no
     * stored row, so the answer is `domain_not_claimed` and never a WRONG
     * DOOR — which is why they are recorded here instead of changed.
     *
     *   `acme.example.`  THE FULLY QUALIFIED FORM. DNS treats the trailing
     *                    root label as equivalent; `trim()` does not strip a
     *                    dot. A browser will not send one in a `Host`, but a
     *                    caller POSTing JSON can type one.
     *
     *   `ACME.EXAMPLE`   FOLDED CORRECTLY, and it is here as the positive
     *                    control: without it this test could pass against a
     *                    normaliser that did nothing at all (§5.6).
     *
     *   `ACME.EXAMPLE` with U+212A KELVIN SIGN in place of `K` — not used by
     *                    this fixture's domains, so the case is stated on the
     *                    IDN line below rather than asserted on a letter this
     *                    domain does not contain. `String.prototype
     *                    .toLowerCase()` DOES fold U+212A to `k`, while
     *                    PostgreSQL's `lower()` under a C collation does NOT
     *                    — **which is precisely why `0170` refuses a
     *                    `CHECK (domain = btrim(lower(domain)))`**: it would
     *                    be a second implementation of the fold, in SQL, over
     *                    a case mapping the two engines disagree about.
     *
     * 🛑 AND AN IDN IS NOT HANDLED AT ALL: `normaliseClaimedDomain()` performs
     * no IDNA / punycode conversion, so `bücher.example` and
     * `xn--bcher-kva.example` are two different keys for one domain. Whoever
     * registers a claim decides which form the tenant is reachable by, and
     * nothing warns them. **That is a MODEL ruling (`model/domain.ts`) and an
     * open one; it is recorded here and in `server/data-plane/realm.ts`'s D6
     * register rather than repaired in a test.**
     */
    /* ⚠️ `route()` ABOVE TAKES ITS ARGUMENT RAW — the HANDLER normalises, the
     * scope helper deliberately does not (`db/realm-scope.ts`: a helper that
     * folded its own input would be a second implementation, §5.3). So these
     * arms call `normaliseClaimedDomain()` exactly where
     * `resolveHomeRealmHandler` calls it, which is what makes this a test of
     * the fold COMPOSED WITH the policy comparison rather than of either
     * alone. */
    const routeAsHandler = async (typed: string) => route(normaliseClaimedDomain(typed))

    const folded = await routeAsHandler('ACME.EXAMPLE')
    assert.deepEqual(
      folded,
      { ok: true, connectionId: DOOR_ACME },
      'the positive control: case folding IS performed, so this suite is not vacuous',
    )

    const trailingDot = await routeAsHandler('acme.example.')
    assert.deepEqual(
      trailingDot,
      { ok: false, refusal: DOMAIN_ROUTING_REFUSALS.domainNotClaimed },
      'the fully qualified form is a DIFFERENT key and answers `domain_not_claimed`. That ' +
        'is fail-closed and is recorded rather than repaired: stripping a trailing dot is a ' +
        'change to the one comparison that decides an ORG CLASS, and it is `model/domain.ts`s.',
    )

    const padded = await routeAsHandler('   acme.example   ')
    assert.deepEqual(
      padded,
      { ok: true, connectionId: DOOR_ACME },
      'surrounding whitespace IS trimmed — the second half of the positive control',
    )
  })
})
