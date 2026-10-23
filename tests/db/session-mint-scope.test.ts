/**
 * THE SESSION MINT NEEDS NO NEW GRANT AND NO NEW POLICY — MEASURED, NOT
 * PREDICTED. W3-S0, G1381–G1384, 21 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS SUITE BUILDS NOTHING, AND THAT IS THE POINT OF IT. READ THIS HEADER
 *    BEFORE READING A SINGLE ASSERTION.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `docs/build/completion-plan.md` §W3 puts S0 first and says why:
 *
 *     "S0 IS FIRST AND BUILDS NOTHING, BECAUSE THE WHOLE TRACK RESTS ON A
 *      PREDICTION NOBODY HAS MEASURED. `0005:385` already grants the app role
 *      `INSERT ON tenant.session`, and `0027` says in its own text 'INSERT is
 *      admitted by neither policy' — so the mint appears to need no new grant
 *      and no new policy, and RLS alone is the control. If S0 §1 fails, every
 *      slice below changes shape and a migration on `tenant.session` enters
 *      the plan."
 *
 * **The prediction HOLDS.** §1 succeeds. No migration on `tenant.session` is
 * owed, S1's grants are unchanged, and S2/S3 keep the shape the plan gives
 * them. That is a fact about this tree and it is re-derived on every run
 * rather than quoted from this paragraph — which is the whole reason a
 * measurement slice is a SUITE and not a note in a document.
 *
 * ⚠️ AND THE OPPOSITE OUTCOME WAS THE VALUABLE ONE, WHICH IS WHY THE SUITE IS
 *    WRITTEN SO THAT IT SAYS SO. Every refusal message below names what a
 *    failure would MEAN for the plan, not merely that a query did not run. A
 *    red §1 is not a broken test; it is a migration entering the sign-in track.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 §2 IS THE INVARIANT-1 CONTROL AND IT IS THE SHARPEST THING HERE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Copy it, never paraphrase it — `CLAUDE.md`'s numbered list of eleven, 1:
 *
 *     "Tenant scope is derived from the session, never read from a request."
 *
 * The plan names the breach that arrives THROUGH A BLESSING: G315 puts the
 * tenant in the OIDC `state` deliberately, as a routing fact for the 302, so
 * a hurried S3 could carry it out of the auth host's grant and write it into
 * the mint — *"tenant scope becomes a thing conferred by authentication, with
 * a ruling apparently endorsing it."*
 *
 * **§2 measures that the DATABASE refuses it even if every layer above says
 * yes.** `session_selection_restrictive`'s membership subquery reads
 * `tenant.membership` under `membership_rls`; `withSignInScope()` sets no
 * `app.tenant_id` — and must never set one, its own header forbids it — so the
 * `EXISTS` is empty, all three later disjuncts are empty with it, and the only
 * disjunct left standing is the first: `tenant_id IS NULL`.
 *
 * 🛑 THE FIXTURE MAKES THAT NON-VACUOUS BY BEING GENEROUS. MEI HOLDS A **LIVE,
 *    UNREVOKED, UNEXPIRED** MEMBERSHIP IN `ten_acme`. A fixture with no
 *    membership would be refused for a reason that has nothing to do with the
 *    scope, and §2 would pass against a database that simply had no row —
 *    §5.6, a control whose failing case cannot occur. Here the row EXISTS and
 *    the mint is refused anyway, because the sign-in scope cannot SEE it.
 *
 * ⚠️ AND §2b IS WHY §2 IS ABOUT THE SCOPE RATHER THAN ABOUT THE ROW. The
 *    identical INSERT, with the identical values, LANDS inside
 *    `withSelectionScope()` — the one helper that sets both GUCs, and whose
 *    candidate tenant comes from the HOST BINDING under G179/G210 and from
 *    nowhere else. Without §2b, §2 is satisfied by any arrangement that
 *    refuses everything.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 TWO DIFFERENT REFUSALS WEAR TWO DIFFERENT MESSAGES, AND THE DIFFERENCE IS
 *    ASSERTED RATHER THAN OBSERVED IN PASSING.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Measured against PostgreSQL 14 before these assertions were written:
 *
 *   §2  →  new row violates row-level security policy
 *          "session_selection_restrictive" for table "session"
 *   §3  →  new row violates row-level security policy for table "session"
 *   §4  →  new row violates row-level security policy for table "session"
 *
 * **A named policy is a RESTRICTIVE policy failing; an unnamed one is the
 * PERMISSIVE set failing**, because there is no single permissive policy to
 * blame when none of them admits the row. So §2 asserts the NAME and §3/§4
 * assert its ABSENCE. A suite that matched `/row-level security/` on all three
 * would pass if the restrictive check were deleted and `session_rls` happened
 * to refuse instead — which is the repair a hurried reader reaches for, and
 * the one G1382 exists to make loud.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ EVERY ARM WAS WITNESSED RED BY MUTATION BEFORE THIS FILE WAS COMMITTED,
 *    AND THE TWO MUTATIONS ANSWER TWO DIFFERENT QUESTIONS.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   `REVOKE INSERT ON tenant.session FROM tenant_rw`
 *       → **6 of 7 RED.** Not only §1: §2, §3 and §4 go red WITH it, because a
 *         `permission denied` is not a row-level-security refusal and none of
 *         the three matches it. **That is the anti-vacuity property of this
 *         whole file, measured rather than asserted** — three refusal arms
 *         that would have been satisfied by a database refusing everything are
 *         demonstrably not.
 *
 *   `DROP POLICY session_selection_restrictive ON tenant.session`
 *       → **§2 ALONE RED**, and red because the mint SUCCEEDS. Every other arm
 *         stays green, which is the specificity that makes §2 a statement
 *         about invariant 1 rather than about RLS in general.
 *
 * ⚠️ EVERY WRITE IN THE FIXTURE IS THE MIGRATOR'S — `LOGIN BYPASSRLS` — because
 *    `0009` grants the app role `SELECT` on `tenant."user"`, on
 *    `tenant.identity_connection` and on `tenant.membership`, and nothing more.
 *    A fixture seeded as the app role would be asserting against grants the
 *    product does not have. `tenant.session` is the ONE table here the app role
 *    may write, which is the entire subject of this file.
 *
 * ⚠️ THIS SUITE MOUNTS NOTHING, DECLARES NOTHING, MINTS NO CAPABILITY AND ADDS
 *    NO MIGRATION. Derive the served set, never read it:
 *    `grep -rn 'handlers:' server/*&#47;start.ts`.
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, type TenantPool } from '../../db/tenant-scope.ts'
import { withSignInScope, type SignInScope } from '../../db/signin-scope.ts'
import { withSessionScope } from '../../db/session-scope.ts'
import { withSelectionScope } from '../../db/selection-scope.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE. Set before the first call that reads it — the named flake
 * `tests/db/tenant-projection.test.ts` documents at length. `db/env.ts`
 * resolves `RECONCILE_DB_NAME` per call and never at import, so this placement
 * is sufficient and is the only one that is.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_SESSION_MINT_DB_NAME'] ?? runScopedName('reconcile_session_mint_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const DOOR = 'idc_acme_entra'
const MEI = 'usr_acme_mei'

const ISSUER = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_POOLAAA'
const REF = 'acme-entra'

/**
 * ⚠️ EVERY DIGEST IS A PLACEHOLDER OF THE RIGHT SHAPE — 64 hex characters, an
 * HMAC-SHA256 output — and is not a real one, for
 * `tests/db/session-membership-selection.test.ts`'s stated rule: a fixture
 * carrying a readable handle would be the first place a preimage got written
 * down. `state` is a credential exactly as a session handle is.
 */
const STATE = '70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f'
/** The digest §1 declares and mints. §5 reads exactly this row back. */
const MINT_NULL = 'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa7777bbbb8888'
/** §2's digest. A distinct one, so a refusal can never be a UNIQUE collision. */
const MINT_TENANT = 'bbbb1111cccc2222dddd3333eeee4444ffff5555aaaa6666bbbb7777cccc8888'
/** §2b's digest — the row that LANDS, in the scope where it is legitimate. */
const MINT_SELECTED = 'cccc1111dddd2222eeee3333ffff4444aaaa5555bbbb6666cccc7777dddd8888'
/** §3's digest: declared to nobody, because §3 declares no `sessionRef` at all. */
const MINT_UNDECLARED = 'dddd1111eeee2222ffff3333aaaa4444bbbb5555cccc6666dddd7777eeee8888'
/** §4's digest — deliberately NOT the one the scope declares. */
const MINT_MISMATCH = 'eeee1111ffff2222aaaa3333bbbb4444cccc5555dddd6666eeee7777ffff8888'

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the session-mint scope suite', probe)

/** The three lookup keys every arrangement below shares. */
const SIGN_IN: SignInScope = { brokerIssuer: ISSUER, brokerRef: REF, stateDigest: STATE }

/**
 * The mint, spelled ONCE.
 *
 * 🛑 ONE STATEMENT FOR EVERY ARM, AND IT IS NOT TIDINESS. Five arrangements
 * that differed in their SQL as well as in their scope would leave every
 * refusal ambiguous between the two. The only things that vary below are the
 * bound values and the scope the statement runs in, so a difference in outcome
 * is a difference in scope by construction.
 */
const MINT_SQL = `INSERT INTO tenant.session
    (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
     authenticated_at, last_used_at, expires_at, revoked_at)
  VALUES ($1, $2, $3, $4, $5, 'acme.invalid',
          now(), now(), now() + interval '12 hours', NULL)`

async function seed(): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')

    await mig.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES ($1,'oidc','Acme Entra ID','customer',NULL,'acc_acme',$2,$3,'active')`,
      [DOOR, ISSUER, REF],
    )

    await mig.query(
      `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
       VALUES ($1, 'mei@acme.invalid', 'Mei', 'active', $2)`,
      [MEI, DOOR],
    )

    /*
     * 🛑 LIVE, UNREVOKED AND UNEXPIRED, AND THAT IS §2's WHOLE CREDIBILITY.
     * `session_selection_restrictive`'s second disjunct asks for exactly this
     * row. It exists. The mint in §2 is refused anyway, because
     * `withSignInScope()` sets no `app.tenant_id` and `membership_rls` then
     * denies on NULL inside the policy's own subquery — G100 working, one
     * layer in. A fixture without this row would make §2 pass for a reason
     * that has nothing to do with the scope under test.
     */
    await mig.query(
      `INSERT INTO tenant.membership
         (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1,'mem_mei_live',$2,'rol_any','usr_acme_admin', now(), NULL, NULL)`,
      [ACME, MEI],
    )

    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

describe('the session mint needs no new grant and no new policy', { skip }, () => {
  let pool: TenantPool

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    /* `max: 1` — one backend, so nothing here can be explained by two
       connections carrying two different sets of GUCs. */
    pool = await createAppPool(1)
  })

  after(async () => {
    await pool?.end()
  })

  /** The mint, run inside a sign-in scope, with the values each arm varies. */
  async function mintInSignInScope(
    scope: SignInScope,
    row: { id: string; digest: string; tenantId: string | null },
  ): Promise<number> {
    return withSignInScope(pool, scope, async (tx) => {
      const r = await tx.query(MINT_SQL, [row.id, row.digest, MEI, DOOR, row.tenantId])
      return r.rowCount ?? 0
    })
  }

  /* ═════════════════════════════════════════════════════════════════════ *
   * §1 — THE PREDICTION THE WHOLE SIGN-IN TRACK RESTS ON.
   * ═════════════════════════════════════════════════════════════════════ */

  it('1 · a TENANTLESS session is minted by the app role inside a sign-in scope', async () => {
    const n = await mintInSignInScope(
      { ...SIGN_IN, sessionRef: MINT_NULL },
      { id: 'ses_mint_null', digest: MINT_NULL, tenantId: null },
    )
    assert.equal(
      n,
      1,
      'THE MINT WAS REFUSED, AND THAT IS A FINDING RATHER THAN A BROKEN TEST. ' +
        '`docs/build/completion-plan.md` §W3 puts every slice of the sign-in track ' +
        'downstream of this one succeeding: `0005` grants the app role `INSERT ON ' +
        'tenant.session` and `session_selection_restrictive`\'s FIRST disjunct is ' +
        '`tenant_id IS NULL`, so a tenantless mint should need no new grant and no ' +
        'new policy. If this line is red, that prediction is wrong — **a migration ' +
        'on `tenant.session` enters the plan**, S1\'s grants change, and S2 and S3 ' +
        'change shape with them. Report it; do NOT add a grant or a policy to make ' +
        'it green, because a grant is a ruling.',
    )
  })

  /* ═════════════════════════════════════════════════════════════════════ *
   * §2 — INVARIANT 1, HELD BY THE DATABASE AND NOT BY A REVIEW COMMENT.
   * ═════════════════════════════════════════════════════════════════════ */

  it('2 · a mint that NAMES A TENANT is refused — invariant 1, in SQL', async () => {
    await assert.rejects(
      () =>
        mintInSignInScope(
          { ...SIGN_IN, sessionRef: MINT_TENANT },
          { id: 'ses_mint_tenant', digest: MINT_TENANT, tenantId: ACME },
        ),
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        assert.match(
          message,
          /session_selection_restrictive/,
          'the mint was refused, but NOT by the restrictive check this assertion is ' +
            'about. A refusal by `session_rls` carries no policy name; this one must ' +
            'name `session_selection_restrictive`, because that is the policy holding ' +
            'invariant 1 against a tenant carried out of an OIDC `state`. Refused ' +
            `with: ${message}`,
        )
        return true
      },
      'A SESSION WAS MINTED CARRYING A TENANT THE CALLER NAMED. Copy invariant 1 ' +
        'rather than paraphrasing it: "Tenant scope is derived from the session, ' +
        'never read from a request." G315 puts the tenant in the OIDC `state` ' +
        'DELIBERATELY, as a routing fact for the 302 — so if the auth host\'s ' +
        'one-time grant carries it and the mint writes it, **tenant scope becomes a ' +
        'thing conferred by authentication, with a ruling apparently endorsing it**. ' +
        'This line is the database refusing that even when every layer above says ' +
        'yes. MEI holds a LIVE membership in ' +
        `${ACME} and the mint must be refused anyway, because a sign-in scope sets ` +
        'no `app.tenant_id` and cannot see it.',
    )
  })

  /**
   * 🛑 THE ANTI-VACUOUS CONTROL FOR §2, AND WITHOUT IT §2 PROVES NOTHING.
   *
   * §2 is a refusal assertion, and a refusal assertion is satisfied by any
   * arrangement that refuses everything — a wrong door, a missing user, a
   * fixture that never committed. This runs the IDENTICAL statement with the
   * IDENTICAL values and the SAME tenant, inside the one helper that sets both
   * GUCs, and requires it to LAND.
   *
   * ⚠️ `withSelectionScope()` IS NOT A LOOPHOLE AND ITS OWN HEADER IS THE
   * REASON: its `candidateTenantId` *"may be a value the platform derived from
   * the Host header through the registry, and nothing else"* — G179/G210. So
   * the contrast §2 and §2b draw is exactly the right one: a tenant that came
   * from the HOST is writable, and a tenant that came from the CALLER is not.
   */
  it('2b · ANTI-VACUOUS — the same row LANDS in a selection scope, so §2 is about the SCOPE', async () => {
    const n = await withSelectionScope(pool, MINT_SELECTED, ACME, async (tx) => {
      const r = await tx.query(MINT_SQL, ['ses_sel_tenant', MINT_SELECTED, MEI, DOOR, ACME])
      return r.rowCount ?? 0
    })
    assert.equal(
      n,
      1,
      'the tenant-bearing INSERT did not land in ANY scope, so §2 proves nothing — ' +
        'it would be refusing a row this database refuses everywhere, for a reason ' +
        'that has nothing to do with the sign-in scope. Check the door, the user, ' +
        "MEI's live membership, and that the fixture committed.",
    )
  })

  /* ═════════════════════════════════════════════════════════════════════ *
   * §3 AND §4 — THE FENCE `db/signin-scope.ts` CALLS "THE DIFFERENCE BETWEEN
   * A READER AND A WRITER, MADE VISIBLE AT THE CALL SITE".
   * ═════════════════════════════════════════════════════════════════════ */

  it('3 · a scope that declares NO `sessionRef` cannot mint at all', async () => {
    await assert.rejects(
      () =>
        mintInSignInScope(SIGN_IN, {
          id: 'ses_mint_undeclared',
          digest: MINT_UNDECLARED,
          tenantId: null,
        }),
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        assert.doesNotMatch(
          message,
          /session_selection_restrictive/,
          'this refusal came from the RESTRICTIVE check, not from `session_rls`. §3 ' +
            'is about the permissive policy comparing `handle_digest` against an ' +
            'UNSET GUC; a named policy in the message means the row failed somewhere ' +
            `else and this arm is measuring the wrong fence. Refused with: ${message}`,
        )
        assert.match(message, /row-level security/i, `unexpected refusal: ${message}`)
        return true
      },
      '`withSignInScope()` MINTED A SESSION WITHOUT BEING TOLD IT WAS A WRITER. ' +
        'That helper\'s header states the fence in its own voice: "A caller that ' +
        'passes none cannot write a session row at all: `session_rls`\'s `WITH ' +
        'CHECK` compares `handle_digest` against an unset GUC, that is NULL, and the ' +
        'INSERT is refused. So the READ path — which is all this repository serves ' +
        'today — structurally cannot mint." If this line is red, every existing ' +
        'sign-in READ is a latent writer.',
    )
  })

  it('4 · a mint may only write the digest its scope DECLARED', async () => {
    await assert.rejects(
      () =>
        mintInSignInScope(
          { ...SIGN_IN, sessionRef: MINT_NULL },
          { id: 'ses_mint_mismatch', digest: MINT_MISMATCH, tenantId: null },
        ),
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        assert.doesNotMatch(
          message,
          /session_selection_restrictive/,
          '§4 is `session_rls`\'s `WITH CHECK` refusing a digest that is not the one ' +
            'declared. A named restrictive policy means something else refused it ' +
            `and this arm is measuring the wrong fence. Refused with: ${message}`,
        )
        assert.match(message, /row-level security/i, `unexpected refusal: ${message}`)
        return true
      },
      'A SCOPE DECLARING ONE DIGEST WROTE ANOTHER. `handle_digest` is `NOT NULL ' +
        'UNIQUE` and G510 revoked `DELETE` on this table deliberately, so a row ' +
        'written under a digest nobody declared SQUATS that digest permanently and ' +
        'nothing can reclaim it — which is `tests/db/session-forge-refused.test.ts`\'s ' +
        'finding arriving through the sign-in door instead of the `manage_roles` one.',
    )
  })

  /* ═════════════════════════════════════════════════════════════════════ *
   * §5 — ANTI-VACUOUS FOR §1. A WRITE NOBODY CAN READ IS NOT A MINT.
   * ═════════════════════════════════════════════════════════════════════ */

  it('5 · ANTI-VACUOUS — §1\'s row is readable through `withSessionScope()`', async () => {
    const rows = await withSessionScope(pool, MINT_NULL, async (tx) => {
      const r = await tx.query(
        `SELECT id, tenant_id FROM tenant.session WHERE handle_digest = $1`,
        [MINT_NULL],
      )
      return r.rows as unknown as ReadonlyArray<{ id: string; tenant_id: string | null }>
    })

    assert.equal(
      rows.length,
      1,
      '§1 reported a row and the session scope cannot see it. A mint whose row no ' +
        'later request can read is not a mint — `completeFederatedSignIn` hands back ' +
        'a handle, and the very next request resolves it through exactly this ' +
        'helper. Either §1 committed nothing or `session_rls` disagrees with the ' +
        'digest that was written.',
    )
    assert.equal(
      rows[0]?.tenant_id,
      null,
      'the minted session carries a tenant. §1 bound NULL, so a non-null value here ' +
        'means something between the bind and the row supplied one — which is ' +
        'invariant 1 breached by a default rather than by a request.',
    )
  })
})
