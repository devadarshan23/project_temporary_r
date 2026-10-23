/**
 * A SESSION ROW CANNOT BE FORGED — `session_lapsed_member_rls` IS `FOR UPDATE`.
 *
 * ┌─ THE DEFECT THIS EXISTS FOR, PROVED BEFORE IT WAS FIXED ──────────────────┐
 * │ `0019` created its policy with no `FOR` clause, which in PostgreSQL means │
 * │ **`FOR ALL`** — so the `WITH CHECK` written to constrain a revoking       │
 * │ UPDATE also governed **INSERT**. Inside a `manage_roles` act the app role │
 * │ could fabricate a pre-revoked session row for ANOTHER PERSON, with an     │
 * │ arbitrary `handle_digest`, an arbitrary `issued_host` and a back-dated    │
 * │ `authenticated_at`. Every term of the check was satisfied.                │
 * │                                                                            │
 * │ 🛑 AND IT IS THE SAME FILE'S ARGUMENT TURNED AROUND. G510 revoked         │
 * │ `DELETE` on this table because *"deleting the row destroys the            │
 * │ `revoked_at` evidence the column exists to hold"* — and the same slice    │
 * │ made it possible to MANUFACTURE that evidence. A table hardened against   │
 * │ erasing a record of an act accepted a forged one.                          │
 * │                                                                            │
 * │ ⚠️ The forged row is INERT for authentication — it is pre-revoked, so     │
 * │ `resolveSubject()` refuses it. What it corrupts is the audit surface,     │
 * │ which is the whole reason this table keeps `revoked_at` instead of        │
 * │ losing the row. And it is PERMANENT: `handle_digest` is `NOT NULL         │
 * │ UNIQUE`, so a forged row squats a digest nothing can reclaim, because     │
 * │ `DELETE` is revoked by G510 deliberately.                                  │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 §2 IS THE CONTROL THAT MAKES §1 MEAN ANYTHING, AND IT IS THE SHAPE THIS
 * REPOSITORY KEEPS LEARNING. A refusal assertion is satisfied by a feature
 * that does not exist: if the grant, the scope or the fixture were wrong, §1
 * would pass against a database that refuses everything. §2 performs the
 * UPDATE the policy is *for* and requires it to SUCCEED in the same scope —
 * so §1 can only pass because INSERT specifically is closed.
 *
 * ⚠️ WHY THIS IS A `tests/db/` SUITE AND NOT AN HTTP ONE. No served operation
 * is gated on `manage_roles` — `grep -rn "manage_roles" server/` returns
 * comments and no producer — so the act cannot be driven over a socket at all.
 * That is itself worth knowing and is asserted in §3 rather than assumed: if a
 * handler ever mints such a grant, this suite's premise changes and the
 * assertion should be re-read rather than trusted.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, type TenantPool } from '../../db/tenant-scope.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_SESSION_FORGE_DB_NAME'] ?? runScopedName('reconcile_session_forge_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const MEI = 'usr_ops_mei'
const ADMIN = 'usr_acme_admin'
const DOOR = 'idc_acme_entra'
const GRANT = 'agr_forge_probe'

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the session-forge suite', probe)

async function asMigrator(sql: string, params: readonly unknown[] = []): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query(sql, params as unknown[])
  } finally {
    await mig.end()
  }
}

describe('a session row cannot be forged', { skip }, () => {
  let pool: TenantPool

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await asMigrator(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES ($1,'oidc','Acme Entra ID','customer',NULL,'acc_acme',
               'https://login.microsoftonline.com/acme-forge/v2.0','acme-entra-forge','active')`,
      [DOOR],
    )
    for (const u of [MEI, ADMIN]) {
      await asMigrator(
        `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
         VALUES ($1, $1 || '@acme.invalid', $1, 'active', $2)`,
        [u, DOOR],
      )
    }
    /*
     * 🛑 MEI IS **LAPSED**, NOT **ABSENT**, AND THE DIFFERENCE IS LOAD-BEARING.
     * A REVOKED membership ROW EXISTS. The first draft of this fixture gave
     * MEI no membership at all and §2 failed — correctly — because
     * `session_selection_restrictive`'s fourth disjunct requires
     * `EXISTS (… membership … )` with no liveness term: **a row must have
     * existed at some point.**
     *
     * That is the three-arm result a previous slice measured — live →
     * revocable, lapsed → revocable, **absent → refused** — and the absent arm
     * is the one it said needs a separate ruling and left as the standing
     * unmet witness at `tests/e2e/browser-login.test.ts` §12b. This suite
     * therefore uses the arm that is supported, so that §1 is testing INSERT
     * and not re-testing that open question.
     */
    await asMigrator(
      `INSERT INTO tenant.membership
         (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1,'mem_mei_lapsed',$2,'rol_any','usr_acme_admin',
               now() - interval '30 days', NULL, now() - interval '1 day')`,
      [ACME, MEI],
    )
    await asMigrator(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ('ses_lapsed_mei', 'digest_lapsed_mei', $1, $2, $3, 'acme.invalid',
               now(), now(), now() + interval '12 hours', NULL)`,
      [MEI, DOOR, ACME],
    )
    /* A REAL `manage_roles` grant — the transaction below names it, so the
       policy's authorisation arm is satisfied and cannot be the reason for a
       refusal. */
    await asMigrator(
      `INSERT INTO tenant.authorization_grant
         (tenant_id, id, subject_user_id, org_class, partner_id, capability,
          resource_class, resource_type, resource_id, solution_id,
          issued_at, expires_at)
       VALUES ($2,$1,$3,'customer',NULL,'manage_roles',
               'authority','tenant',$2,NULL,
               now(), now() + interval '1 hour')`,
      [GRANT, ACME, ADMIN],
    )
    pool = await createAppPool(1)
  })

  after(async () => {
    await pool?.end()
  })

  /**
   * ⚠️ BOTH GUCs, SET THE WAY THE SEAM SETS THEM. The scope is deliberately
   * the one in which the act is LEGITIMATE — anything narrower would refuse
   * for a reason other than the one under test.
   */
  async function inManageRolesScope<T>(
    fn: (c: { query: (q: string, v?: unknown[]) => Promise<{ rowCount: number | null }> }) => Promise<T>,
  ): Promise<T> {
    const c = await pool.connect()
    try {
      await c.query('BEGIN')
      await c.query(`SELECT set_config('app.tenant_id', $1, true)`, [ACME])
      await c.query(`SELECT set_config('app.authorisation_ref', $1, true)`, [GRANT])
      const out = await fn(c)
      await c.query('COMMIT')
      return out
    } catch (err) {
      await c.query('ROLLBACK').catch(() => undefined)
      throw err
    } finally {
      c.release()
    }
  }

  it('1 · the app role cannot INSERT a pre-revoked session for another person', async () => {
    await assert.rejects(
      () =>
        inManageRolesScope((c) =>
          c.query(
            `INSERT INTO tenant.session
               (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
                authenticated_at, last_used_at, expires_at, revoked_at)
             VALUES ('ses_forged','digest_forged',$1,$2,$3,'attacker.invalid',
                     timestamptz '2025-08-14 00:00:00+00', now(),
                     now() + interval '12 hours', now())`,
            [MEI, DOOR, ACME],
          ),
        ),
      /row-level security|permission denied/i,
      'THE APP ROLE FORGED A SESSION ROW. `session_lapsed_member_rls` was created ' +
        'with no `FOR` clause, so it defaulted to `FOR ALL` and its `WITH CHECK` — ' +
        'written for the revoking UPDATE — also governed INSERT. That is forged ' +
        'evidence in the table G510 revoked DELETE on IN ORDER TO PRESERVE EVIDENCE, ' +
        'and `handle_digest` is UNIQUE so the row could never be reclaimed.',
    )
  })

  /**
   * 🛑 THE ANTI-VACUOUS CONTROL. Without it §1 passes against a database that
   * refuses everything — a wrong grant id, a missing GUC, a bad fixture.
   */
  it('2 · ANTI-VACUOUS — the UPDATE the policy IS for still succeeds in the same scope', async () => {
    const n = await inManageRolesScope(async (c) => {
      const r = await c.query(
        `UPDATE tenant.session SET revoked_at = now()
          WHERE id = 'ses_lapsed_mei' AND revoked_at IS NULL`,
      )
      return r.rowCount ?? 0
    })
    assert.equal(
      n,
      1,
      'the revoking UPDATE did not land, so §1 proves nothing — it would refuse an ' +
        'INSERT in a scope that refuses everything. Check the grant, the GUCs and ' +
        'that MEI is genuinely lapsed.',
    )
  })

  /**
   * ✅ THE PREMISE CHANGED, AND THIS TEST IS WHAT NOTICED — BY DESIGN.
   *
   * It used to read *"no served operation is gated on `manage_roles`"* and
   * carried its own instruction for this day: *"if a handler ever mints such
   * a grant, this suite's premise changes and the assertion should be re-read
   * rather than trusted."* `grantRoleAssignment` was mounted hours later, the
   * test went red, and it is **re-read here rather than relaxed**.
   *
   * 🛑 WHAT THAT MEANS FOR §1. When this suite was written the forge was
   * unreachable over a socket, so a database-level assertion was the only
   * place it could be made. **It is now reachable-adjacent**: a real operator
   * can hold `manage_roles` through a mounted operation, so the GUC the policy
   * keys on is set by a served act rather than only by a fixture.
   *
   * ⚠️ AND THE FORGE IS STILL A DATABASE-LEVEL ATTACK, WHICH IS WHY §1 STAYS
   * WHERE IT IS. `grantRoleAssignment` writes `tenant.role_assignment`; it
   * does not write `tenant.session`, and no mounted operation does. So the
   * served path supplies the *authority*, and the INSERT §1 attempts is still
   * one only a direct database caller can make. **The two halves are separate
   * and both are needed**, which is the honest reason this is not simply
   * moved to `tests/http/`.
   *
   * 🛑 WHAT IS OWED, NAMED RATHER THAN LEFT IMPLIED: the same forge attempted
   * *through* a served `manage_roles` act — driving `grantRoleAssignment` to
   * obtain the grant, then reusing that transaction's `app.authorisation_ref`
   * against `tenant.session`. That is a larger harness than this file and it
   * is not built.
   */
  it('3 · the premise — the mounted `manage_roles` operation does not write `tenant.session`', async () => {
    const { readFile } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const repo = join(import.meta.dirname, '..', '..')

    const yaml = await readFile(join(repo, 'docs', 'contracts', 'capability.openapi.yaml'), 'utf8')
    assert.equal(
      /x-capability:\s*manage_roles/.test(yaml),
      true,
      'no operation declares `manage_roles` any more. This suite was rewritten when ' +
        'one was mounted; if it has been unmounted, the earlier premise is back and ' +
        'the reasoning above should be re-read again rather than this line adjusted.',
    )

    /*
     * The property §1 actually rests on: the authority is served, the WRITE is
     * not. A grep is the right control here because the claim is about which
     * tables the server can write at all, and it is cheap enough to keep true.
     */
    const grants = await readFile(join(repo, 'server', 'data-plane', 'role-grants.ts'), 'utf8')
    assert.equal(
      /INSERT\s+INTO\s+tenant\.session/i.test(grants),
      false,
      'the mounted `manage_roles` operation now writes `tenant.session`. §1 asserts ' +
        'at the database because no served path could reach that table; if one can, ' +
        'the forge must be attacked through the served path too.',
    )
  })
})
