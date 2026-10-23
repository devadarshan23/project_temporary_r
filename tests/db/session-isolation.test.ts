/**
 * THE TWO-SESSION LEAK TEST — #228 [A-6], AND THE EXECUTABLE ARGUMENT FOR A
 * SECOND NAMED SCOPED HELPER.
 *
 * `tests/db/tenant-isolation.test.ts` is the shape this file copies, assertion
 * for assertion, and its header is the one to read first. What is NOT copied is
 * the predicate: the session row is keyed on the HANDLE DIGEST in a GUC under
 * **G160**, not on `app.tenant_id`, and the reason is mechanical rather than
 * stylistic.
 *
 * 🛑 WHY THE SESSION READ CANNOT RUN INSIDE `withTenantScope()`, WHICH IS THE
 * WHOLE OF WHY THIS FILE EXISTS. `Session.tenantId` is NULL between
 * authentication and selection (`model/domain.ts`, and the interface is
 * deliberately not `TenantScoped` — `model/identity.ts` asserts the negative so
 * that `extends TenantScoped` is a compile error). The predicate every other
 * scoped table uses is
 * `tenant_id = nullif(current_setting('app.tenant_id', true), '')`, which
 * evaluates to NULL against a NULL column; G100's polarity then denies
 * UNCONDITIONALLY, so the row would be invisible to the very connection that
 * just wrote it. `it('the tenant-scoped helper cannot see a session row at
 * all')` below WITNESSES that rather than asserting it in prose — it is the
 * S-1 recommendation made executable, and if it ever goes green-by-accident the
 * second helper has stopped being necessary and somebody should say so.
 *
 * THE FOUR ASSERTIONS #228 REQUIRES, none of them optional:
 *
 *   (a) the SQL the read issues carries NO session predicate and binds NO
 *       parameter for the scope — asserted by reading the statement TEXT that
 *       reached the server, not by inspecting the result set. And the SCOPE
 *       statement is asserted from the other side: it must BIND its value and
 *       must not be `SET LOCAL`, because `SET` is utility syntax that takes no
 *       parameters and the obvious repair interpolates the one value in the
 *       system that must never be attacker-influenced.
 *   (b) with the RLS policy DISABLED the same read LEAKS every session — so the
 *       isolation observed in (a) is demonstrably produced by the policy and by
 *       nothing else. Without this a green run means the query returned one row
 *       for reasons nobody checked, which is the §5.6 shape.
 *   (c) with `set_config` OMITTED the read returns ZERO rows — G100's
 *       deny-on-NULL, one predicate over. This is what separates "RLS is on"
 *       from "RLS is on AND the pooled connection is carrying the setting".
 *   (d) both session reads ran on the SAME pooled backend, asserted by
 *       `pg_backend_pid()` — not by construction order and not by trusting
 *       `max: 1`. G98 picked `pg` precisely because it exposes the PID.
 *
 * ✅ THE CAVEAT THAT STOOD HERE IS DISCHARGED, IN THE COMMIT IT WAS WAITING
 * FOR — AND IT IS QUOTED RATHER THAN DELETED, because it is the sentence a
 * reader would have trusted about what a green run proved. It read:
 *
 *   🛑 "WHAT THIS FILE DOES NOT PROVE … THE SESSION TABLE IS A FIXTURE BUILT BY
 *   THIS FILE, NOT A MIGRATION. `#228`'s slice is *the helper and its isolation
 *   test*; the session-and-membership migration is `#157`'s landing slot and
 *   `#228` says in its own body: 'No migration is written here … do not claim a
 *   migration number.' So what is proven here is that `withSessionScope()` plus
 *   a digest-keyed deny-on-NULL policy isolates, that it fails closed, and that
 *   the tenant helper cannot substitute for it. What is NOT proven is that the
 *   SHIPPED schema carries that policy — nothing ships it yet."
 *
 * **Something ships it now.** `db/migrations/0005_session_and_membership.sql`
 * creates `tenant.session` under G160 and G199, and every assertion below now
 * runs against the SHIPPED table. The fixture DDL is deleted, which is the
 * repair the refusal named, in the order it named it.
 *
 * ⚠️ AND THE REFUSAL DID ITS JOB, WHICH IS WORTH RECORDING RATHER THAN QUIETLY
 * BENEFITING FROM. `assertSessionTableIsStillOurs()` went RED the moment 0005
 * landed — `'session' !== null` — with a message naming the three-step repair.
 * A bare `CREATE TABLE` would have raised `42P07 relation already exists`, a
 * message about a relation saying nothing about sessions. The check survives
 * INVERTED, as `assertSessionTableIsTheMigrations()`: a fixture creeping back
 * in, or the migration losing the table, is now the red.
 *
 * 🛑 AND THE SHIPPED SCHEMA CARRIES ONE THING THE FIXTURE NEVER DID, WHICH IS
 * WHY THE INVERSION IS NOT CEREMONIAL. 0005 adds an `AS RESTRICTIVE`
 * `WITH CHECK` — B1's control on the tenant-binding WRITE — that this file's
 * fixture had no equivalent for, because #228 had no membership table to point
 * one at. Nothing below asserts it; `tests/db/session-membership-selection.test.ts`
 * is where that lives, and the two files deliberately do not overlap.
 *
 * ⚠️ TEN COLUMNS FOR ELEVEN KEYS, AND THE MISSING ONE IS DELIBERATE.
 * `Session.secondFactorAt` is `@dropped-for-v1` under G223 — federation owns
 * the second factor — and the standing v1 discipline is that a dropped
 * declaration gets "no table, no endpoint, no code". The migration honours
 * that; `tests/model/session-shape.test.ts` sweeps `model/` for the producer
 * and this file would have been the place a column smuggled one in.
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import {
  createAppPool,
  withTenantScope,
  type TenantPool,
  type QueryResultLike,
} from '../../db/tenant-scope.ts'
import { withSessionScope } from '../../db/session-scope.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE. Set before the first call that reads it.
 *
 * 🛑 NOT HYGIENE — THE FIX FOR A NAMED FLAKE, stated in full at
 * `tests/db/tenant-projection.test.ts`. `node --test` runs test FILES
 * concurrently; `db/provision.ts` locks `createRoles()` but `resetSchema()`
 * runs `DROP SCHEMA … CASCADE` and `applyMigrations()` outside any lock, so two
 * files sharing one database race on the rebuild and the loser dies inside
 * `applyMigrations` with a message about a relation. `db/env.ts` resolves
 * `RECONCILE_DB_NAME` per call and never at import, so setting it here — above
 * the `probeDatabase()` call — is sufficient and is the only placement that is.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_SESSION_DB_NAME'] ?? runScopedName('reconcile_session_test')

/* ------------------------------------------------------------------ *
 * The fixtures. G97 — ids are readable slugs, stored VERBATIM as `text`.
 *
 * The digests are the ones `model/examples.ts` already carries, so a reader
 * comparing the fixture against the model finds the same strings rather than
 * two plausible sets. They are digests of nothing in particular; the preimage
 * is never stored, which is `SessionHandleDigest`'s whole argument.
 * ------------------------------------------------------------------ */

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

/** The acme session, tenant SELECTED. */
const ACME_DIGEST = 'c72d0b93e18a45f6027c9d31be5a086f4d2c7e10b93a65f8c04d17e2ba936c85'
/** The globex session, tenant SELECTED. A different tenant, a different digest. */
const GLOBEX_DIGEST = '5e6b19d02a7c384f9013bd57e2c6a840f71d95b3c082e461a9d73f50c2b81647'
/**
 * AUTHENTICATED BUT UNSELECTED — `tenant_id` IS NULL, and this row is the one
 * that makes the second helper necessary rather than merely tidy. Under the
 * tenant predicate it is invisible to everybody, including the connection that
 * wrote it.
 */
const UNSELECTED_DIGEST = 'a41c8e37b0d5926f4e18a7c30b5d29f6e84a1c73d05b2e69f37a04c81d6b25e9'

/** Every digest this file seeds, for the bound-parameter assertion. */
const KNOWN_DIGESTS: readonly string[] = [ACME_DIGEST, GLOBEX_DIGEST, UNSELECTED_DIGEST]

/**
 * THE STATEMENT UNDER TEST, AND IT IS THE POINT OF THE WHOLE FILE.
 *
 * No `WHERE`. No bound parameter. No mention of `app.session_ref`. Every row of
 * `tenant.session` for every session is in scope of this SQL, and the only
 * thing that can narrow it is the row-level security policy. Assertion (a)
 * reads the text that reached the server and proves this stayed true.
 */
const UNSCOPED_READ =
  'SELECT id, handle_digest, tenant_id FROM tenant.session ORDER BY id'

/**
 * ⚠️ `SESSION_FIXTURE_DDL` AND `createSessionFixture()` STOOD HERE UNTIL
 * `db/migrations/0005_session_and_membership.sql` LANDED, AND THEIR DELETION IS
 * THE REPAIR `assertSessionTableIsStillOurs()` NAMED WHEN IT WENT RED. There is
 * no fixture schema in this file any more: the table every assertion below runs
 * against is the SHIPPED one, created by the migration, which is strictly more
 * than this file used to prove.
 *
 * Everything load-bearing about the shipped table is what the fixture claimed —
 * `ENABLE` plus `FORCE` (without FORCE the owner is exempt and the test passes
 * with the policy doing nothing), `WITH CHECK` stated explicitly rather than
 * defaulted from `USING`, and the `nullif(current_setting(…, true), '')` idiom
 * whose three parts 0001 explains in full, keyed on `handle_digest` under G160.
 * **That claim is now checked rather than asserted**, by
 * `it('the shipped policy is the one this file tests')` below, which reads
 * `pg_policy` rather than trusting the constant one line down.
 */

/**
 * The policy, restated for the negative control that drops and restores it.
 *
 * 🛑 RE-POINTED AT THE MIGRATION'S TEXT, AND THE RE-POINTING IS EXACTLY WHAT
 * THE OLD REFUSAL DEMANDED: *"re-point `SESSION_POLICY` at the policy the
 * migration actually creates. If the shipped policy is not keyed on
 * `handle_digest` under G160, that is the finding and this file is where it
 * surfaces."* It is keyed on `handle_digest`. A restatement can still drift
 * from the migration, so it is not trusted — the catalogue assertion below
 * compares what the server holds against this string.
 */
const SESSION_POLICY = `
  CREATE POLICY session_rls ON tenant.session
    USING      (handle_digest = nullif(current_setting('app.session_ref', true), ''))
    WITH CHECK (handle_digest = nullif(current_setting('app.session_ref', true), ''))
`

/* ------------------------------------------------------------------ *
 * Reachability. A skipped test that says so is honest; a mocked database
 * asserting isolation is a lie that will be believed.
 * ------------------------------------------------------------------ */

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/db/session-isolation.test.ts DID NOT RUN.',
      '',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS IS THE TEST THAT CARRIES G160 AND THE SECOND NAMED SCOPE. A run',
      '   of the suite in which it skipped is NOT evidence that a session read',
      '   is isolated, and it is NOT evidence that `withSessionScope()` scopes',
      '   anything at all. Start a PostgreSQL and re-run before believing a',
      '   green suite.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

/** The skip REASON, not a boolean: node:test prints it beside each skipped test. */
const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the two-session leak test', probe)

/* ------------------------------------------------------------------ *
 * A recording pool. Identical in shape to the one in
 * `tests/db/tenant-isolation.test.ts` — production code is not instrumented for
 * this; `withSessionScope` takes a `TenantPool` and this satisfies it
 * structurally.
 *
 * 🛑 IT DOES NOT ADD `query` TO `TenantPool`, and #228 names that as an
 * acceptance criterion. The pool type has no `query` so that
 * `pool.query(...)` — one autocommitted statement on a checked-out connection,
 * which silently discards `SET LOCAL` — is a COMPILE ERROR at every call site
 * rather than a code-review catch.
 * ------------------------------------------------------------------ */

interface Recorded {
  readonly text: string
  readonly values: readonly unknown[]
}

function recordingPool(inner: TenantPool): {
  pool: TenantPool
  statements: Recorded[]
} {
  const statements: Recorded[] = []
  const pool: TenantPool = {
    async connect() {
      const client = await inner.connect()
      return {
        async query(text: string, values?: readonly unknown[]) {
          statements.push({ text, values: values ?? [] })
          return client.query(text, values)
        },
        release() {
          client.release()
        },
      }
    },
    async end() {
      await inner.end()
    },
  }
  return { pool, statements }
}

/** The statements that are transaction plumbing rather than the read under test. */
function isPlumbing(text: string): boolean {
  const t = text.trim().toUpperCase()
  return t === 'BEGIN' || t === 'COMMIT' || t === 'ROLLBACK' || t.startsWith('SELECT SET_CONFIG(')
}

/** The scope-setting statement, which assertion (a) inspects from the other side. */
function isScopeStatement(text: string): boolean {
  return text.trim().toUpperCase().startsWith('SELECT SET_CONFIG(')
}

/**
 * 🛑 THE REFUSAL, INVERTED — AND IT IS THE SAME CONTROL POINTING THE OTHER WAY.
 *
 * It used to demand `to_regclass('tenant.session')` be NULL, because a fixture
 * and a migration defining the same table is two competing definitions of the
 * thing under test. It went RED on the commit that added
 * `db/migrations/0005_session_and_membership.sql` — `'session' !== null` — and
 * the fixture was deleted, which is the repair its own message named.
 *
 * ⚠️ IT IS NOT DELETED WITH THE FIXTURE, AND THE REASON IS THE SAME ONE IT WAS
 * WRITTEN FOR. `resetSchema()` rebuilds from the migrations on every run, so if
 * 0005 ever stops creating this table — renumbered, reverted, or a migration
 * set pointed at the wrong directory — every assertion below would fail with a
 * message about a relation, saying nothing about sessions. This says what
 * happened instead.
 */
async function assertSessionTableIsTheMigrations(): Promise<void> {
  const mig = await migratorClient()
  try {
    const res = await mig.query("SELECT to_regclass('tenant.session') AS reg")
    const reg = (res.rows[0] as { reg: string | null } | undefined)?.reg ?? null
    assert.equal(
      reg,
      'session',
      'NO MIGRATION CREATES `tenant.session`. This file used to build its own ' +
        'fixture table and no longer does: `db/migrations/0005_session_and_membership.sql` ' +
        'is the definition every assertion below runs against, under G160 and ' +
        'G199. If that file has been renumbered, reverted, or is not in the set ' +
        '`resetSchema()` applies, THAT is the finding — not anything about ' +
        'isolation. Do NOT repair this by reinstating a fixture: a fixture and a ' +
        'migration defining one table is two competing definitions of the thing ' +
        'under test, which is what the previous form of this check existed to ' +
        'refuse.',
    )
  } finally {
    await mig.end()
  }
}

/**
 * Three sessions, seeded as the migrator.
 *
 * Seeding NEEDS the BYPASSRLS role and that is the policy working, not an
 * inconvenience: `reconcile_app` cannot write a row whose digest differs from
 * the one its transaction is scoped to, because `WITH CHECK` forbids it, so
 * there is no session in which the application role could create this fixture.
 */
async function seedSessions(): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')
    const rows: ReadonlyArray<readonly [string, string, string | null]> = [
      ['ses_acme_mei_scoped', ACME_DIGEST, ACME],
      ['ses_globex_ana_scoped', GLOBEX_DIGEST, GLOBEX],
      ['ses_acme_mei_unselected', UNSELECTED_DIGEST, null],
    ]
    for (const [id, digest, tenantId] of rows) {
      await mig.query(
        `INSERT INTO tenant.session
           (id, handle_digest, user_id, connection_id, tenant_id,
            issued_host, authenticated_at, last_used_at, expires_at, revoked_at)
         VALUES ($1, $2, 'usr_mei', 'idc_acme_entra', $3,
                 'app.reconcile.invalid',
                 '2026-08-22T08:40:00Z', '2026-08-22T08:40:00Z',
                 '2026-08-22T20:40:00Z', NULL)`,
        [id, digest, tenantId],
      )
    }
    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

describe('session isolation — two sessions, one pooled connection', { skip }, () => {
  let appPool: TenantPool
  let recorded: Recorded[]

  before(async () => {
    // Rebuilt from the migrations on every run, so a crashed earlier run that
    // left a policy dropped cannot make a later run report a false green.
    await resetSchema()
    await assertSessionTableIsTheMigrations()
    await seedTwoTenants(ACME, GLOBEX)
    await seedSessions()

    /**
     * ⚠️ `max: 1` IS ADVERSARIAL ON PURPOSE, NOT A RESOURCE ECONOMY. With a
     * one-connection pool the second session's transaction is FORCED onto the
     * very connection the first session's transaction just returned — the exact
     * condition B5 describes, where RLS session variables are connection state
     * rather than request state. The test runs against the arrangement most
     * likely to leak rather than one that happens not to.
     */
    const rec = recordingPool(await createAppPool(1))
    appPool = rec.pool
    recorded = rec.statements
  })

  after(async () => {
    if (appPool !== undefined) await appPool.end()
  })

  /* ---------------------------------------------------------------- *
   * The isolation assertion, plus (a) and (d).
   * ---------------------------------------------------------------- */

  it('each session sees only its own row, and neither query says so in SQL', async () => {
    const acme = await withSessionScope(appPool, ACME_DIGEST, async (tx) => {
      const pid = await tx.query('SELECT pg_backend_pid() AS pid')
      const rows = await tx.query(UNSCOPED_READ)
      return { pid: pidOf(pid), rows: rows.rows as Array<{ id: string; handle_digest: string }> }
    })

    const globex = await withSessionScope(appPool, GLOBEX_DIGEST, async (tx) => {
      const pid = await tx.query('SELECT pg_backend_pid() AS pid')
      const rows = await tx.query(UNSCOPED_READ)
      return { pid: pidOf(pid), rows: rows.rows as Array<{ id: string; handle_digest: string }> }
    })

    // Each side saw a row, and saw ONLY its own. Both halves matter: a policy
    // that denies everything would satisfy the second half alone.
    assert.equal(acme.rows.length, 1, 'the acme-scoped read did not return exactly its own row')
    assert.equal(globex.rows.length, 1, 'the globex-scoped read did not return exactly its own row')
    assert.deepEqual(
      acme.rows.map((r) => r.handle_digest),
      [ACME_DIGEST],
      'the acme-scoped read returned a row belonging to another session',
    )
    assert.deepEqual(
      globex.rows.map((r) => r.handle_digest),
      [GLOBEX_DIGEST],
      'the globex-scoped read returned a row belonging to another session',
    )

    /* (d) SAME POOLED BACKEND — asserted, not assumed. */
    assert.equal(
      acme.pid,
      globex.pid,
      'the two session reads ran on DIFFERENT backends, so this run proved nothing ' +
        "about a pooled connection carrying another session's state",
    )

    /* (a) NO SESSION PREDICATE IN THE SQL THAT REACHED THE SERVER. */
    const reads = recorded.filter((s) => !isPlumbing(s.text))
    assert.ok(reads.length >= 2, 'expected the reads to have been recorded')
    for (const s of reads) {
      const text = s.text.toLowerCase()
      assert.ok(
        !text.includes('where'),
        `statement carried a WHERE clause, so isolation may come from the query rather than RLS: ${s.text}`,
      )
      assert.ok(
        !text.includes('app.session_ref'),
        `statement referenced app.session_ref directly: ${s.text}`,
      )
      assert.ok(
        !text.includes('handle_digest ='),
        `statement carried a session predicate: ${s.text}`,
      )
    }
    const theRead = reads.filter((s) => s.text === UNSCOPED_READ)
    assert.equal(theRead.length, 2, 'both reads should be the identical unscoped statement')
    for (const s of theRead) {
      assert.deepEqual(s.values, [], 'the read must bind no session parameter')
    }
  })

  /* ---------------------------------------------------------------- *
   * (a), from the other side: the SCOPE statement itself.
   *
   * 🛑 #228 STATES THIS AS ITS OWN ACCEPTANCE LINE AND IT IS THE ONE MOST
   * LIKELY TO BE "REPAIRED" INTO A VULNERABILITY. `SET LOCAL app.session_ref =
   * $1` does not work — `SET` is utility syntax and takes no bind parameters —
   * and the obvious fix is to interpolate the digest into the statement string,
   * which is a SQL injection on a credential's shadow. `set_config(name, value,
   * is_local)` is an ordinary function call, so the value binds as $1 and is
   * never parsed as SQL.
   * ---------------------------------------------------------------- */

  it('the scope is set by a BOUND set_config, never by SET LOCAL', async () => {
    const scoped = recorded.filter((s) => isScopeStatement(s.text))
    assert.ok(scoped.length >= 2, 'expected a scope statement per scoped transaction')

    for (const s of recorded) {
      assert.ok(
        !/\bSET\s+LOCAL\s+app\./i.test(s.text),
        'a `SET LOCAL app.…` statement reached the server. It takes no bind ' +
          'parameters, so this statement either does nothing or carries an ' +
          `interpolated value: ${s.text}`,
      )
    }

    for (const s of scoped) {
      /**
       * ⚠️ ASSERTED AS A PROPERTY, NOT BY INDEX INTO THE CALL ORDER. "the
       * second scope statement bound the globex digest" is a rule keyed on a
       * convenient landmark, and it starts passing for the wrong reason the
       * first time a test is inserted above it. What matters is that BOTH
       * arguments were bound, that the first is the session GUC and not the
       * tenant one, and that the second is a digest this file seeded.
       */
      assert.equal(s.values.length, 2, `set_config bound ${s.values.length} values, not 2`)
      assert.equal(
        s.values[0],
        'app.session_ref',
        'the scope statement did not bind the SESSION guc name',
      )
      assert.ok(
        KNOWN_DIGESTS.includes(String(s.values[1])),
        `set_config bound something that is not one of this file's digests: ${String(s.values[1])}`,
      )
      assert.ok(
        !s.text.includes(ACME_DIGEST) && !s.text.includes(GLOBEX_DIGEST),
        `the digest was interpolated into the statement text rather than bound: ${s.text}`,
      )
      assert.ok(
        !s.text.toLowerCase().includes('app.tenant_id'),
        'the session helper set the TENANT guc. A session read must not open a ' +
          'tenant scope — that is invariant 1 held by construction, and this is ' +
          `the statement that would end it: ${s.text}`,
      )
    }
  })

  /* ---------------------------------------------------------------- *
   * THE ARGUMENT FOR A SECOND HELPER, WITNESSED RATHER THAN ASSERTED IN PROSE.
   * ---------------------------------------------------------------- */

  it('the tenant-scoped helper cannot see a session row at all, which is why this helper exists', async () => {
    const rows = await withTenantScope(appPool, ACME, async (tx) => {
      const res = await tx.query(UNSCOPED_READ)
      return res.rowCount
    })

    assert.equal(
      rows,
      0,
      'a tenant-scoped transaction READ THE SESSION TABLE. The session policy is ' +
        'keyed on the handle digest under G160, so `app.tenant_id` should narrow ' +
        'nothing here and the deny-on-NULL polarity should return nothing. If ' +
        'this returns rows, either the session policy is keyed on the tenant ' +
        'after all — in which case the unselected session below is unreachable — ' +
        'or the table is not protected.',
    )
  })

  it('an UNSELECTED session (tenant_id NULL) is readable by its own digest', async () => {
    const rows = await withSessionScope(appPool, UNSELECTED_DIGEST, async (tx) => {
      const res = await tx.query(UNSCOPED_READ)
      return res.rows as Array<{ id: string; tenant_id: string | null }>
    })

    assert.equal(
      rows.length,
      1,
      'the session authenticated but not yet scoped to a tenant was INVISIBLE to ' +
        'its own digest. This is the exact failure S-1 predicts for a ' +
        'tenant-keyed session policy: `tenant_id = nullif(current_setting(…))` ' +
        'is NULL against a NULL column and G100 then denies unconditionally, so ' +
        'the row is hidden from the connection that just wrote it. Liveness ' +
        'could not be checked before tenant selection and nothing could ever ' +
        'select one.',
    )
    assert.equal(rows[0]?.tenant_id, null, 'the unselected fixture carries a tenant after all')
  })

  /* ---------------------------------------------------------------- *
   * (c) THE `set_config` NEGATIVE CONTROL — G100's deny-on-NULL.
   * ---------------------------------------------------------------- */

  it('a query issued OUTSIDE withSessionScope sees zero rows (deny-on-NULL)', async () => {
    // Deliberately bypasses the helper: a checked-out connection with no
    // transaction and no set_config. This is the exact hazard G99 names in
    // Drizzle and `pg` — an autocommitted statement silently discards SET LOCAL.
    const client = await appPool.connect()
    try {
      const unset = await client.query("SELECT current_setting('app.session_ref', true) AS v")
      assert.ok(
        settingIsAbsent(unset),
        'app.session_ref leaked across pooled checkouts — the setting is not being ' +
          'scoped to a transaction, so a later request is served on a connection ' +
          "still carrying an earlier session's digest",
      )

      const res = await client.query(UNSCOPED_READ)
      assert.equal(
        res.rowCount,
        0,
        'the policy PERMITTED on NULL. G100 requires deny-on-NULL: a forgotten ' +
          "transaction must yield an empty result set, never another session's row",
      )
    } finally {
      client.release()
    }
  })

  /* ---------------------------------------------------------------- *
   * (b) THE NEGATIVE CONTROL — WITHOUT ROW-LEVEL SECURITY, THIS LEAKS.
   *
   * ⚠️ THE CONTROL IS `DISABLE`, NOT `DROP POLICY`, and the reason is recorded
   * in full at `tests/db/tenant-isolation.test.ts`: dropping the policy while
   * RLS stays ENABLED does not leak, because PostgreSQL default-denies when no
   * policy matches, so the read returns zero rows and cannot distinguish
   * "isolation comes from RLS" from "the query returns nothing". The realistic
   * defect is a migration that creates the table and FORGETS to enable RLS,
   * which fails OPEN — and `DISABLE ROW LEVEL SECURITY` reproduces exactly
   * that state.
   * ---------------------------------------------------------------- */

  it('with RLS DISABLED the same read leaks every session — isolation comes from RLS', async () => {
    const admin = await migratorClient()
    try {
      await admin.query('ALTER TABLE tenant.session DISABLE ROW LEVEL SECURITY')

      const leaked = await withSessionScope(appPool, ACME_DIGEST, async (tx) => {
        const rows = await tx.query(UNSCOPED_READ)
        return rows.rows as Array<{ handle_digest: string }>
      })

      assert.deepEqual(
        leaked.map((r) => r.handle_digest).sort(),
        [ACME_DIGEST, GLOBEX_DIGEST, UNSELECTED_DIGEST].sort(),
        'turning RLS OFF did not change the result, which means the isolation ' +
          'asserted by the other tests in this file is NOT coming from RLS. Either ' +
          'the query is narrowing the rows itself, or the three sessions are not ' +
          'all present — and in either case this file is proving nothing.',
      )
    } finally {
      await admin.query('ALTER TABLE tenant.session ENABLE ROW LEVEL SECURITY')
      await admin.end()
    }
  })

  /* ---------------------------------------------------------------- *
   * 🛑 THE POLICY THIS FILE RESTATES IS THE POLICY THE SERVER HOLDS.
   *
   * `SESSION_POLICY` is a hand-written copy of a statement that lives in
   * `db/migrations/0005_session_and_membership.sql`, and the negative control
   * below RE-CREATES the policy from that copy after dropping it. So a copy
   * that drifted would leave the suite green while restoring a DIFFERENT
   * policy than the migration ships — and every later file in the run would
   * then be testing this file's opinion instead of the tree. Asserted against
   * `pg_policy` rather than trusted.
   *
   * ⚠️ IT READS THE CATALOGUE'S RENDERING, NOT THE MIGRATION'S TEXT, because
   * PostgreSQL normalises an expression on the way in — parentheses, casts and
   * schema qualification all move. Comparing two SQL strings would be a
   * checker that fails on whitespace; comparing the two COLUMN NAMES and the
   * GUC the predicate reads is the property that matters.
   * ---------------------------------------------------------------- */

  it('the shipped policy is keyed on handle_digest under G160, on BOTH halves', async () => {
    const admin = await migratorClient()
    try {
      const res = await admin.query(`
        SELECT p.polname,
               p.polpermissive,
               pg_catalog.pg_get_expr(p.polqual,       p.polrelid) AS using_expr,
               pg_catalog.pg_get_expr(p.polwithcheck,  p.polrelid) AS check_expr
          FROM pg_policy p
          JOIN pg_class c     ON c.oid = p.polrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'tenant' AND c.relname = 'session' AND p.polname = 'session_rls'
      `)
      const row = res.rows[0] as
        | {
            polpermissive: boolean
            using_expr: string | null
            check_expr: string | null
          }
        | undefined

      assert.ok(
        row,
        'there is no policy named `session_rls` on `tenant.session`. The ' +
          'negative control below restores one by that name from `SESSION_POLICY`, ' +
          'so a run that got here without it has already diverged from the migration.',
      )
      assert.equal(
        row.polpermissive,
        true,
        '`session_rls` is RESTRICTIVE. Restrictive policies are AND-ed and grant ' +
          'nothing, so a restrictive-only session table would deny every read — ' +
          'and `SESSION_POLICY` would restore it as PERMISSIVE, silently repairing ' +
          'the tree from a test file.',
      )
      for (const [half, expr] of [
        ['USING', row.using_expr],
        ['WITH CHECK', row.check_expr],
      ] as const) {
        assert.ok(
          expr !== null && /handle_digest/.test(expr),
          `\`session_rls\`'s ${half} half does not read \`handle_digest\`. G160 keys ` +
            'the session predicate on the HANDLE DIGEST IN A GUC — the row id via a ' +
            '`SECURITY DEFINER` function is the REJECTED alternative, refused because ' +
            'such a function "becomes the most security-relevant object in the ' +
            `schema". Got: ${String(expr)}`,
        )
        assert.ok(
          expr !== null && /app\.session_ref/.test(expr),
          `\`session_rls\`'s ${half} half does not read \`app.session_ref\`, which is ` +
            'the GUC `db/session-scope.ts` sets and the only thing that narrows this ' +
            `table. Got: ${String(expr)}`,
        )
        assert.ok(
          expr !== null && !/app\.tenant_id/.test(expr),
          `\`session_rls\`'s ${half} half reads \`app.tenant_id\`. \`Session.tenantId\` ` +
            'is NULL between authentication and selection, so a tenant-keyed predicate ' +
            'denies UNCONDITIONALLY against it and nothing could ever select a tenant — ' +
            `which is the whole argument for a second scoped helper. Got: ${String(expr)}`,
        )
      }
    } finally {
      await admin.end()
    }
  })

  /* ---------------------------------------------------------------- *
   * The companion property: losing the POLICY while RLS stays enabled fails
   * CLOSED. Worth locking in — it means the dangerous edit is a missing
   * `ENABLE`, not a missing `CREATE POLICY`.
   *
   * ⚠️ THE RESTRICTIVE POLICY 0005 ALSO SHIPS IS NOT DROPPED HERE AND MUST NOT
   * BE. It restricts WRITES only, so it cannot affect a read either way; and
   * dropping it would turn this negative control into an unwitnessed repeal of
   * B1's control, restored from a string in a test file.
   * ---------------------------------------------------------------- */

  it('with the policy DROPPED but RLS still enabled, the read fails CLOSED', async () => {
    const admin = await migratorClient()
    try {
      await admin.query('DROP POLICY session_rls ON tenant.session')

      const rows = await withSessionScope(appPool, ACME_DIGEST, async (tx) => {
        const res = await tx.query(UNSCOPED_READ)
        return res.rowCount
      })

      assert.equal(
        rows,
        0,
        'a table with RLS enabled and NO policy returned rows. The default-deny ' +
          'this test locks in is gone, and every future table that gains ENABLE ' +
          'before its policy is now readable.',
      )
    } finally {
      await admin.query('SET ROLE reconcile_owner')
      await admin.query(SESSION_POLICY)
      await admin.end()
    }
  })

  /* ---------------------------------------------------------------- *
   * The role attributes every assertion above silently depends on.
   *
   * A superuser or a BYPASSRLS role passes the isolation test by accident,
   * seeing everything and being asked about only one session at a time.
   * Asserted rather than assumed.
   * ---------------------------------------------------------------- */

  it('the pool role can neither bypass RLS nor own the session table it reads', async () => {
    const attrs = await withSessionScope(appPool, ACME_DIGEST, async (tx) => {
      const res = await tx.query(`
        SELECT r.rolsuper, r.rolbypassrls,
               (SELECT c.relforcerowsecurity FROM pg_class c
                  JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE c.relname = 'session' AND n.nspname = 'tenant') AS forced,
               (SELECT c.relrowsecurity FROM pg_class c
                  JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE c.relname = 'session' AND n.nspname = 'tenant') AS enabled,
               pg_catalog.pg_get_userbyid(
                 (SELECT c.relowner FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                   WHERE c.relname = 'session' AND n.nspname = 'tenant')) AS owner
        FROM pg_roles r WHERE r.rolname = current_user
      `)
      return res.rows[0] as {
        rolsuper: boolean
        rolbypassrls: boolean
        forced: boolean
        enabled: boolean
        owner: string
      }
    })

    assert.equal(attrs.rolsuper, false, 'the pool connected as a SUPERUSER, which bypasses RLS unconditionally')
    assert.equal(
      attrs.rolbypassrls,
      false,
      'the pool role holds BYPASSRLS, so no assertion in this file means anything',
    )
    assert.equal(attrs.enabled, true, 'row level security is not enabled on tenant.session')
    assert.equal(
      attrs.forced,
      true,
      'FORCE ROW LEVEL SECURITY is off, so the table OWNER is exempt from the policy — ' +
        'which is the exemption G100 requires be held only by the explicit BYPASSRLS role',
    )
    assert.notEqual(
      attrs.owner,
      'reconcile_app',
      'the pool role OWNS the table it reads, and an owner may disable RLS on it',
    )
  })
})

function pidOf(result: QueryResultLike): number {
  const row = result.rows[0] as { pid: number } | undefined
  assert.ok(row !== undefined, 'pg_backend_pid() returned no row')
  return row.pid
}

function settingIsAbsent(result: QueryResultLike): boolean {
  const row = result.rows[0] as { v: string | null } | undefined
  return row === undefined || row.v === null || row.v === ''
}
