/**
 * INVARIANT 2's ONE CROSS-TENANT READ PATH, AS A TABLE — G576, 19 Sep 2026,
 * over `db/migrations/0039_partner_access_grant.sql` and
 * `server/data-plane/identity.ts` §6a.
 *
 * THE INVARIANT, COPIED AND NOT PARAPHRASED (CLAUDE.md, the only place the
 * eleven are numbered):
 *
 *     "Exactly one cross-tenant read path — `partner_admin(P)` may read tenant
 *      `T` iff `T.partnerId = P`, and only within a live `PartnerAccessGrant`
 *      beyond commercial metadata."
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 IT IS A CONJUNCTION AND THIS FILE ASSERTS BOTH HALVES SEPARATELY, BECAUSE
 *    A SLICE THAT BUILT ONLY THE GRANT WOULD HAVE LOOKED FINISHED.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   §2  `T.partnerId = P` — held by a composite FOREIGN KEY, so a grant into a
 *       tenant the partner did not sell is UNREPRESENTABLE rather than merely
 *       refused. Before 0039 there was no `partner_id` on `tenant.tenant` at
 *       all, so this half of the invariant had NO enforcement of any kind
 *       anywhere in the repository — not a column, not a predicate, not a
 *       comment.
 *   §1  "…and only within a live grant" — and the liveness is `decide()`'s,
 *       BY NAME. §1 is the anti-§5.6 half: the reader must return a revoked
 *       grant, an expired grant and another partner's grant UNFILTERED, or
 *       three of `decide()`'s four partner refusals become unreachable and the
 *       tests that assert them pass for the wrong reason.
 *
 * ⚠️ WHAT THIS FILE DOES NOT PROVE, SO THE COVERAGE IS NOT OVERCLAIMED: that
 *    the gate SERVES a granted partner and refuses an ungranted one over a
 *    socket. That is `tests/http/partner-arm-served.test.ts`, against the
 *    production authoriser, and it is the ALLOW arm. Neither file is the whole
 *    control.
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import { PARTNER_ACCESS_SCOPES } from '../../model/access.ts'
import { readPartnerGrant, SUBSTRATE_REFUSALS } from '../../server/data-plane/identity.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_PARTNER_GRANT_DB_NAME'] ?? runScopedName('reconcile_partner_grant_test')

const probe = await probeDatabase()
const skip = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the partner access grant test', probe)

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const NORTHWIND = 'prt_northwind'
const CONTOSO = 'prt_contoso'

async function asMigrator(sql: string, params: readonly unknown[] = []): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query(sql, params as unknown[])
  } finally {
    await mig.end()
  }
}

async function migratorRows(
  sql: string,
  params: readonly unknown[] = [],
): Promise<Array<Record<string, unknown>>> {
  const mig = await migratorClient()
  try {
    return (await mig.query(sql, params as unknown[])).rows as Array<Record<string, unknown>>
  } finally {
    await mig.end()
  }
}

/** The error a write was refused with, or `null` if it was not refused. */
async function refusalOf(sql: string, params: readonly unknown[] = []): Promise<string | null> {
  const mig = await migratorClient()
  try {
    await mig.query(sql, params as unknown[])
    return null
  } catch (err) {
    const e = err as { code?: string; constraint?: string }
    return `${e.code ?? '?'}:${e.constraint ?? '?'}`
  } finally {
    await mig.end()
  }
}

const INSERT_GRANT = `
  INSERT INTO tenant.partner_access_grant
    (tenant_id, id, partner_id, scope, expires_at, revoked_at)
  VALUES ($1, $2, $3, $4, $5, $6)
`

/**
 * ACME was sold by Northwind. GLOBEX was sold by nobody — 1CloudHub direct —
 * and that is the fixture §2a needs: a tenant with `partner_id IS NULL` is the
 * shape a partner must not be able to reach into, and it is also the shape
 * EVERY tenant in this repository had before 0039.
 */
async function seed(): Promise<void> {
  await asMigrator(`UPDATE tenant.tenant SET partner_id = $2 WHERE id = $1`, [ACME, NORTHWIND])
  await asMigrator(
    INSERT_GRANT + ' ON CONFLICT DO NOTHING',
    [ACME, 'pag_acme', NORTHWIND, PARTNER_ACCESS_SCOPES.exceptionsRead, new Date(Date.now() + 864e5), null],
  )
}

describe('the partner access grant — invariant 2, both conjuncts', { skip }, () => {
  let pool: TenantPool

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    pool = await createAppPool(2)
  })

  after(async () => {
    if (pool !== undefined) await pool.end()
  })

  /* ================================================================ *
   * §1 · THE READER RETURNS THE ROW UNFILTERED. Three refusals depend
   *      on it, and a `WHERE` would delete all three silently.
   * ================================================================ */

  it('1a · a LIVE grant is read, in the terms `decide()` takes', async () => {
    const outcome = await withTenantScope(pool, ACME, (tx) => readPartnerGrant(tx))
    assert.equal(outcome.ok, true, 'the reader refused a well-formed grant')
    assert.notEqual(outcome.ok && outcome.grant, null, 'the reader found no grant')
    if (!outcome.ok || outcome.grant === null) return
    assert.equal(outcome.grant.partnerId, NORTHWIND)
    assert.equal(outcome.grant.scope, PARTNER_ACCESS_SCOPES.exceptionsRead)
    assert.equal(outcome.grant.revokedAt, null)
    assert.equal(
      typeof outcome.grant.expiresAt,
      'string',
      '`decide()` compares `expiresAt <= principal.now` and `principal.now` is an ISO ' +
        'STRING. A `Date` here compares as `[object Date]`, which is greater than every ' +
        'ISO-8601 timestamp — so EVERY grant would read as unexpired and ' +
        '`partner_grant_expired` would be unreachable. The bug would be invisible: the ' +
        'ALLOW arm would still pass.',
    )
  })

  it('1b · a REVOKED grant is RETURNED, not filtered — `partner_grant_revoked` is `decide()`\'s', async () => {
    await asMigrator(`UPDATE tenant.partner_access_grant SET revoked_at = now() WHERE id = 'pag_acme'`)
    const outcome = await withTenantScope(pool, ACME, (tx) => readPartnerGrant(tx))
    await asMigrator(`UPDATE tenant.partner_access_grant SET revoked_at = NULL WHERE id = 'pag_acme'`)

    assert.equal(outcome.ok, true)
    assert.notEqual(
      outcome.ok && outcome.grant,
      null,
      'THE READER FILTERED A REVOKED GRANT OUT. `server/data-plane/identity.ts` opens with ' +
        '"IT DECIDES NOTHING", and a `WHERE revoked_at IS NULL` here would make ' +
        '`DECISION_REASONS.partner_grant_revoked` a member nothing can return — the ' +
        'refusal deleted by a predicate rather than by a decision. The served suite would ' +
        'still go green, because a revoked partner is refused either way; what would be ' +
        'lost is WHICH refusal, which is the only thing an auditor can act on.',
    )
    assert.notEqual(outcome.ok && outcome.grant !== null && outcome.grant.revokedAt, null)
  })

  it('1c · an EXPIRED grant is RETURNED, not filtered', async () => {
    await asMigrator(
      `UPDATE tenant.partner_access_grant SET expires_at = now() - interval '1 day' WHERE id = 'pag_acme'`,
    )
    const outcome = await withTenantScope(pool, ACME, (tx) => readPartnerGrant(tx))
    await asMigrator(
      `UPDATE tenant.partner_access_grant SET expires_at = now() + interval '1 day' WHERE id = 'pag_acme'`,
    )
    assert.equal(outcome.ok, true)
    assert.notEqual(
      outcome.ok && outcome.grant,
      null,
      'a `WHERE expires_at > now()` would delete `partner_grant_expired`. Same shape as 1b.',
    )
  })

  it('1d · a grant naming ANOTHER partner is RETURNED — §9.5\'s check is `decide()`\'s', async () => {
    /**
     * 🛑 THIS IS THE SHARPEST OF THE FOUR AND IT IS THE ONE A `WHERE
     * partner_id = $1` WOULD HAVE LOOKED MOST REASONABLE ON. `decide()` refuses
     * `partner_grant_other_partner` by comparing the grant's partner against
     * the one `orgFor(connection.owner)` derived — *"a partner engineer who
     * moved to the customer keeps grant-derived assignments evaluated under the
     * wrong organisation"*. Filtered in the reader, that refusal collapses into
     * `partner_grant_absent`, and the two say opposite things about whether a
     * grant exists.
     *
     * ⚠️ THE FIXTURE HAS TO MOVE THE TENANT'S OWN `partner_id` TOO, and THAT
     * IS §2's constraint proving itself from the inside: the FK will not let a
     * grant name Contoso while ACME says Northwind. So the state this asserts
     * on is reachable only by a tenant TRANSFER, which is exactly the real
     * scenario — `0005`'s own note says *"a transfer between partners is meant
     * to leave both rows."*
     */
    await asMigrator(`DELETE FROM tenant.partner_access_grant WHERE tenant_id = $1`, [ACME])
    await asMigrator(`UPDATE tenant.tenant SET partner_id = $2 WHERE id = $1`, [ACME, CONTOSO])
    await asMigrator(INSERT_GRANT, [
      ACME,
      'pag_contoso',
      CONTOSO,
      PARTNER_ACCESS_SCOPES.exceptionsOperate,
      new Date(Date.now() + 864e5),
      null,
    ])

    const outcome = await withTenantScope(pool, ACME, (tx) => readPartnerGrant(tx))

    await asMigrator(`DELETE FROM tenant.partner_access_grant WHERE tenant_id = $1`, [ACME])
    await asMigrator(`UPDATE tenant.tenant SET partner_id = $2 WHERE id = $1`, [ACME, NORTHWIND])
    await seed()

    assert.equal(outcome.ok, true)
    assert.equal(
      outcome.ok && outcome.grant !== null && outcome.grant.partnerId,
      CONTOSO,
      'the reader must hand `decide()` whichever partner the row names, so that §9.5\'s ' +
        'comparison against the DERIVED partner can happen at all.',
    )
  })

  it('1e · an UNRECOGNISED scope is REFUSED, never coerced', async () => {
    await asMigrator(`UPDATE tenant.partner_access_grant SET scope = 'everything' WHERE id = 'pag_acme'`)
    const outcome = await withTenantScope(pool, ACME, (tx) => readPartnerGrant(tx))
    await asMigrator(
      `UPDATE tenant.partner_access_grant SET scope = $1 WHERE id = 'pag_acme'`,
      [PARTNER_ACCESS_SCOPES.exceptionsRead],
    )

    assert.equal(outcome.ok, false, 'an unknown scope was accepted')
    assert.equal(
      !outcome.ok && outcome.refusal,
      SUBSTRATE_REFUSALS.valueUnrecognised,
      '0039 declines a CHECK constraint on `scope` for 0002\'s enum reason, so the ' +
        'narrowing is the reader\'s. The convenient coercion is `commercial_only` — the ' +
        'weakest scope, which LOOKS safe — and it is wrong for the same reason defaulting ' +
        '`orgClass` to `customer` is wrong: it invents a customer decision nobody took.',
    )
  })

  /* ================================================================ *
   * §2 · `T.partnerId = P`. The conjunct that had no enforcement of
   *      any kind before 0039.
   * ================================================================ */

  it('2a · a grant into a DIRECT-SOLD tenant is UNREPRESENTABLE', async () => {
    const refusal = await refusalOf(INSERT_GRANT, [
      GLOBEX,
      'pag_globex',
      NORTHWIND,
      PARTNER_ACCESS_SCOPES.exceptionsOperate,
      new Date(Date.now() + 864e5),
      null,
    ])
    assert.equal(
      refusal,
      '23503:partner_access_grant_sold_by_this_partner',
      'A PARTNER GRANT WAS WRITTEN INTO A TENANT WITH NO PARTNER. This is invariant 2\'s ' +
        'first conjunct and it is held by a composite FOREIGN KEY against ' +
        '`tenant.tenant (id, partner_id)`: the referencing columns are NOT NULL, so under ' +
        'MATCH SIMPLE a NULL on the referenced side matches nothing. Losing this makes the ' +
        'grant table sufficient on its own, which is HALF the invariant wearing the whole ' +
        `one's name. Got: ${String(refusal)}`,
    )
  })

  it('2b · a grant naming a partner who did not sell THIS tenant is UNREPRESENTABLE', async () => {
    await asMigrator(`UPDATE tenant.tenant SET partner_id = $2 WHERE id = $1`, [GLOBEX, CONTOSO])
    const refusal = await refusalOf(INSERT_GRANT, [
      GLOBEX,
      'pag_wrong',
      NORTHWIND,
      PARTNER_ACCESS_SCOPES.exceptionsOperate,
      new Date(Date.now() + 864e5),
      null,
    ])
    await asMigrator(`UPDATE tenant.tenant SET partner_id = NULL WHERE id = $1`, [GLOBEX])

    assert.equal(
      refusal,
      '23503:partner_access_grant_sold_by_this_partner',
      'Northwind was handed a grant into a tenant Contoso sold. `T.partnerId = P` is an ' +
        `EQUALITY, not an existence test. Got: ${String(refusal)}`,
    )
  })

  it('2c · a tenant carrying a grant cannot be RELABELLED to another partner', async () => {
    /**
     * A property nobody asked for and the FK supplies: `ON UPDATE NO ACTION` is
     * the default, so moving `tenant.partner_id` out from under a live grant is
     * refused. **A tenant transfer must therefore revoke the grant first**,
     * which is the order invariant 2 would want and which no handler exists to
     * get wrong.
     */
    const refusal = await refusalOf(`UPDATE tenant.tenant SET partner_id = $2 WHERE id = $1`, [
      ACME,
      CONTOSO,
    ])
    assert.equal(refusal, '23503:partner_access_grant_sold_by_this_partner')
  })

  it('2d · at most ONE grant per tenant, so the reader never chooses', async () => {
    const refusal = await refusalOf(INSERT_GRANT, [
      ACME,
      'pag_second',
      NORTHWIND,
      PARTNER_ACCESS_SCOPES.exceptionsOperate,
      new Date(Date.now() + 864e5),
      null,
    ])
    assert.equal(
      refusal,
      '23505:partner_access_grant_one_per_tenant',
      '`PrincipalContext.partnerGrant` is SINGULAR by declaration. Without this ' +
        'constraint something has to pick one of several, and the only candidates are the ' +
        'reader (forbidden — it decides nothing) or the model (a ruling). 0039 enumerates ' +
        `all three. Got: ${String(refusal)}`,
    )
  })

  /* ================================================================ *
   * §3 · ROW-LEVEL SECURITY, with both negative controls.
   * ================================================================ */

  it('3a · ENABLE and FORCE are both set', async () => {
    const rows = await migratorRows(
      `SELECT c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'tenant' AND c.relname = 'partner_access_grant'`,
    )
    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.['enabled'], true)
    assert.equal(
      rows[0]?.['forced'],
      true,
      '`ENABLE` alone leaves the TABLE OWNER exempt — 0001\'s argument. A suite connecting ' +
        'as the owner would then pass with the policy doing nothing and pass just as well ' +
        'with the policy dropped.',
    )
  })

  it('3b · ACME\'s grant is INVISIBLE inside GLOBEX\'s scope', async () => {
    const seen = await withTenantScope(pool, GLOBEX, (tx) => readPartnerGrant(tx))
    assert.equal(seen.ok, true)
    assert.equal(
      seen.ok && seen.grant,
      null,
      'THE ONE CROSS-TENANT READ PATH LEAKED ACROSS TENANTS. `readPartnerGrant()` writes ' +
        'NO tenant clause — the narrowing is `partner_access_grant_rls`, 0001\'s predicate ' +
        'verbatim — so a row visible here means the policy is not doing it.',
    )
  })

  it('3c · NEGATIVE CONTROL — with RLS DISABLED, the same read LEAKS', async () => {
    /**
     * 🛑 THE CONTROL 0008 CARRIES, AND THE REASON IS §5.6: 3b passes just as
     * well against a table that is EMPTY for an unrelated reason. This proves
     * the row is there and that row-level security is what hides it.
     *
     * ⚠️ IT IS `DISABLE ROW LEVEL SECURITY` AND NOT `DROP POLICY`, AND THE
     * FIRST DRAFT OF THIS FILE HAD IT THE OTHER WAY ROUND AND WENT RED —
     * RECORDED RATHER THAN TIDIED, because the mistake is instructive and 0008
     * states the distinction in one line that I read past: *"with RLS DISABLED
     * the same read leaks both tenants, and with the policy DROPPED it fails
     * closed."* A table with RLS enabled and NO policy denies everything, so a
     * draft asserting a leak from a dropped policy is asserting the opposite of
     * the way PostgreSQL fails. 3d is the other half and they are two different
     * facts.
     */
    await asMigrator('ALTER TABLE tenant.partner_access_grant DISABLE ROW LEVEL SECURITY')
    const leaked = await withTenantScope(pool, GLOBEX, (tx) => readPartnerGrant(tx))
    await asMigrator('ALTER TABLE tenant.partner_access_grant ENABLE ROW LEVEL SECURITY')

    assert.equal(leaked.ok, true)
    assert.notEqual(
      leaked.ok && leaked.grant,
      null,
      'With RLS disabled the read did NOT leak, which means 3b was green for a reason ' +
        'other than the policy — the assertion is measuring something else and the fixture ' +
        'must be repaired before either is believed.',
    )
  })

  it('3d · NEGATIVE CONTROL — with the POLICY dropped it fails CLOSED, not open', async () => {
    /**
     * The other direction, and the reason both are here. `ENABLE` with no
     * policy is a total denial: a future migration that removes
     * `partner_access_grant_rls` while leaving the table enabled breaks the
     * product loudly rather than opening it quietly. Asserting it pins which
     * of the two failure modes this table has.
     */
    await asMigrator('DROP POLICY partner_access_grant_rls ON tenant.partner_access_grant')
    const closed = await withTenantScope(pool, ACME, (tx) => readPartnerGrant(tx))
    await asMigrator(
      `CREATE POLICY partner_access_grant_rls ON tenant.partner_access_grant
         USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
         WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''))`,
    )

    assert.equal(closed.ok, true)
    assert.equal(
      closed.ok && closed.grant,
      null,
      'a table with RLS ENABLEd and no policy must show the app role nothing — including ' +
        'inside its OWN tenant scope, which is why this reads ACME rather than GLOBEX.',
    )
  })

  it('3e · NEGATIVE CONTROL — the policy DENIES on NULL. G100.', async () => {
    const mig = await migratorClient()
    let visibleWithoutScope = -1
    try {
      /* As the APP role, outside any scope. `migratorClient()` is BYPASSRLS, so
       * the read has to be taken through the app pool with no GUC set — which
       * `withTenantScope()` will not do, by construction. A raw pool client is
       * the only way to ask the question. */
      await mig.end()
      const raw = await createAppPool(1)
      const client = await raw.connect()
      try {
        const res = await client.query('SELECT count(*)::int AS n FROM tenant.partner_access_grant')
        visibleWithoutScope = Number((res.rows[0] as Record<string, unknown>)['n'])
      } finally {
        client.release()
        await raw.end()
      }
    } catch {
      /* A throw is also a refusal and is at least as safe as zero rows. */
      visibleWithoutScope = 0
    }
    assert.equal(
      visibleWithoutScope,
      0,
      'A FORGOTTEN TRANSACTION SAW PARTNER GRANTS. G100: the policy denies on NULL, so an ' +
        'unscoped read yields an empty set rather than a cross-tenant one.',
    )
  })

  /* ================================================================ *
   * §4 · LEAST PRIVILEGE. The request path may read and may not write.
   * ================================================================ */

  it('4 · `tenant_rw` holds SELECT and holds no INSERT, UPDATE or DELETE', async () => {
    const rows = await migratorRows(
      `SELECT privilege_type
         FROM information_schema.role_table_grants
        WHERE table_schema = 'tenant'
          AND table_name = 'partner_access_grant'
          AND grantee = 'tenant_rw'
        ORDER BY 1`,
    )
    const held = rows.map((r) => String(r['privilege_type'])).sort()
    assert.deepEqual(
      held,
      ['SELECT'],
      'A REQUEST PATH THAT CAN WRITE THIS TABLE CAN MINT THE ONLY CROSS-TENANT READ PATH ' +
        'IN THE PRODUCT, IN ONE STATEMENT. 0008 withheld the same three verbs on ' +
        `tenant.tenant_access_grant for the WEAKER of the two invariants. Got: ${held.join(',')}`,
    )
  })

  /* ================================================================ *
   * §5 · THE REFUSAL THAT IS STRUCTURALLY UNREACHABLE, WITNESSED.
   * ================================================================ */

  it('5 · two grants in one tenant REFUSE the read — they do not pick one', async () => {
    /**
     * `partner_grant_not_unique` cannot be produced while
     * `partner_access_grant_one_per_tenant` stands, which is what makes it look
     * like dead code. Dropping the constraint is the only way to witness it,
     * and witnessing it is the difference between a branch somebody will delete
     * as unreachable and a branch that is the schema's safety net.
     */
    await asMigrator(
      'ALTER TABLE tenant.partner_access_grant DROP CONSTRAINT partner_access_grant_one_per_tenant',
    )
    await asMigrator(INSERT_GRANT, [
      ACME,
      'pag_shadow',
      NORTHWIND,
      PARTNER_ACCESS_SCOPES.exceptionsOperate,
      new Date(Date.now() + 864e5),
      null,
    ])

    const outcome = await withTenantScope(pool, ACME, (tx) => readPartnerGrant(tx))

    await asMigrator(`DELETE FROM tenant.partner_access_grant WHERE id = 'pag_shadow'`)
    await asMigrator(
      'ALTER TABLE tenant.partner_access_grant ADD CONSTRAINT partner_access_grant_one_per_tenant UNIQUE (tenant_id)',
    )

    assert.equal(
      outcome.ok,
      false,
      'THE READER CHOSE. With two rows visible it must refuse, not pick — and the one it ' +
        'would have picked is whichever the planner returned first, which is a decision ' +
        'nobody wrote down and which would silently prefer `exceptions_operate` half the ' +
        'time.',
    )
    assert.equal(!outcome.ok && outcome.refusal, SUBSTRATE_REFUSALS.partnerGrantNotUnique)
  })

  /* ================================================================ *
   * §6 · THE ADVERSARIAL CONTROL. 0003 lets the app role write
   *      `tenant.tenant`, so it can label its own tenant. It buys nothing.
   * ================================================================ */

  it('6 · an app-role path that LABELS its tenant still cannot mint a grant', async () => {
    /**
     * 🛑 0039 §1 NAMES THIS AS A MEASURED RESIDUAL RATHER THAN A CLOSED HOLE:
     * `0003_tenant_schema.sql` grants `SELECT, INSERT, UPDATE, DELETE ON
     * tenant.tenant TO tenant_rw`, so a request path inside a tenant scope can
     * set its own `partner_id` to any string at all. The claim is that this
     * confers NOTHING, and a claim about a privilege is worth exactly as much
     * as the test that exercises it.
     */
    const labelled = await withTenantScope(pool, GLOBEX, async (tx) => {
      await tx.query(`UPDATE tenant.tenant SET partner_id = $1 WHERE id = $2`, [CONTOSO, GLOBEX])
      let minted = false
      try {
        await tx.query(INSERT_GRANT, [
          GLOBEX,
          'pag_self',
          CONTOSO,
          PARTNER_ACCESS_SCOPES.exceptionsOperate,
          new Date(Date.now() + 864e5),
          null,
        ])
        minted = true
      } catch {
        minted = false
      }
      return minted
    })
    await asMigrator(`UPDATE tenant.tenant SET partner_id = NULL WHERE id = $1`, [GLOBEX])

    assert.equal(
      labelled,
      false,
      'A REQUEST PATH RELABELLED ITS TENANT AND THEN MINTED ITSELF A CROSS-TENANT READ ' +
        'PATH. The fence is the `SELECT`-only GRANT on `partner_access_grant`, not the ' +
        'label — and if this ever passes, 0039 §1\'s argument for leaving 0003\'s privilege ' +
        'alone has failed and the column list must be narrowed.',
    )
  })
})
