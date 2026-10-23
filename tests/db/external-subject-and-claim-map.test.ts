/**
 * THE FIRST WRITE PRIVILEGE ON A PERSON, AND THE THREE OBJECTS THAT FENCE IT.
 * W3-S1, G1631–G1636, 21 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 READ `db/migrations/0200_external_subject_and_claim_map.sql` FIRST. IT
 *    ARGUES EVERY CHOICE; THIS FILE ONLY WITNESSES THEM.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * R5 — the owner's — auto-provisions a person on first sign-in, and that needs
 * `GRANT INSERT ON tenant."user"`. `0009` gave the app role `SELECT` and
 * nothing else on all eight identity tables. **So the interesting assertions
 * here are the refusals**, and §1 is the baseline that makes them mean
 * something.
 *
 * ⚠️ THREE FORGERIES, THREE DIFFERENT OBJECTS, AND THE SUITE ASSERTS WHICH ONE
 *    REFUSED EACH. A suite that matched `/violates/` on all three would pass if
 *    any two were deleted, and each defeats an attack the others do not:
 *
 *      §3   door id and broker pair DISAGREE     -> the composite FOREIGN KEY
 *      §3b  id and pair AGREE, on a door the
 *           scope did not name                   -> the PERMISSIVE policy
 *      §3d  minted through `0009`'s session
 *           disjunct, round the permissive layer -> the RESTRICTIVE policy
 *
 * 🛑 §3d EXISTS BECAUSE MUTATION FOUND THAT IT HAD TO. Dropping
 *    `user_signin_mint_restrictive` left every other assertion in this file
 *    GREEN — the permissive policy refuses the ordinary forgeries by itself —
 *    so the restrictive fence was pinned by nothing but §5's catalogue read,
 *    which is a claim about the policy's SHAPE and not about what it stops.
 *    **A fence whose removal changes no behaviour any test observes is a fence
 *    nobody is keeping.** §3d is the arm it refuses alone, witnessed both ways.
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import { withSignInScope, type SignInScope } from '../../db/signin-scope.ts'
import { withSessionScope } from '../../db/session-scope.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_EXTERNAL_SUBJECT_DB_NAME'] ?? runScopedName('reconcile_external_subject_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const DOOR = 'idc_acme_entra'
const OTHER_DOOR = 'idc_globex_okta'
const MEI = 'usr_acme_mei'

const ISSUER = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_POOLAAA'
const REF = 'acme-entra'
const OTHER_ISSUER = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_POOLBBB'
const OTHER_REF = 'globex-okta'

/** 64 hex characters, the shape an HMAC-SHA256 output has, and not a real one. */
const STATE = '70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f'
const SESSION_DIGEST = 'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa7777bbbb8888'

const SUBJECT = 'a1b2c3d4-0000-4aaa-8bbb-ccccdddd0001'
const OTHER_SUBJECT = 'a1b2c3d4-0000-4aaa-8bbb-ccccdddd0002'

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the external-subject and claim-map suite', probe)

const SIGN_IN: SignInScope = { brokerIssuer: ISSUER, brokerRef: REF, stateDigest: STATE }

/** ONE statement for every arm, so a difference in outcome is a difference in
 *  the bound values or the scope, by construction. */
const MINT_PERSON = `
  INSERT INTO tenant."user"
    (id, email, display_name, status, connection_id, external_subject,
     broker_issuer, broker_ref)
  VALUES ($1, $2, 'New Person', 'active', $3, $4, $5, $6)
`

async function seed(): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')
    await mig.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status, email_claim, name_claim)
       VALUES ($1,'oidc','Acme Entra','customer',NULL,'acc_acme',$2,$3,'active','email','name')`,
      [DOOR, ISSUER, REF],
    )
    /* A SECOND door in another pool. §3 and §3b are both about this row, and
     * it carries NO claim map — §7 needs one door that has not declared. */
    await mig.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES ($1,'oidc','Globex Okta','customer',NULL,'acc_globex',$2,$3,'active')`,
      [OTHER_DOOR, OTHER_ISSUER, OTHER_REF],
    )
    /* A SEEDED person with NO external subject — §2's whole point, and the row
     * §6 requires the session path to keep seeing. */
    await mig.query(
      `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
       VALUES ($1,'mei@acme.invalid','Mei','active',$2)`,
      [MEI, DOOR],
    )
    await mig.query(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ('ses_esc',$1,$2,$3,NULL,'acme.invalid',
               now(), now(), now() + interval '12 hours', NULL)`,
      [SESSION_DIGEST, MEI, DOOR],
    )
    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

describe('the external subject, the claim map, and the fence on minting a person', { skip }, () => {
  let pool: TenantPool

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    pool = await createAppPool(1)
  })

  after(async () => {
    await pool?.end()
  })

  /* ═════════════════════════════════════════════════════════════════════ *
   * §1 — THE BASELINE. A PERSON IS MINTED WHERE THE SCOPE SAYS SO.
   * ═════════════════════════════════════════════════════════════════════ */

  it('1 · the app role mints a person inside a sign-in scope that names the door and the subject', async () => {
    const n = await withSignInScope(pool, { ...SIGN_IN, externalSubject: SUBJECT }, async (tx) => {
      const r = await tx.query(MINT_PERSON, [
        'usr_minted_1',
        'new1@acme.invalid',
        DOOR,
        SUBJECT,
        ISSUER,
        REF,
      ])
      return r.rowCount ?? 0
    })
    assert.equal(
      n,
      1,
      'R5 IS NOT APPLIED. The owner ruled that a person is AUTO-PROVISIONED ON ' +
        'FIRST SIGN-IN, and `db/migrations/0200` §7 is the `GRANT INSERT` half. ' +
        'Before that grant this statement answered `permission denied for table ' +
        'user` — a privilege refusal and not a row-level-security one — so if ' +
        'this line is red the grant is gone and every refusal below is passing ' +
        'for a reason that has nothing to do with the policies under test.',
    )
  })

  /* ═════════════════════════════════════════════════════════════════════ *
   * §2 — THE SUBJECT IS UNIQUE PER CONNECTION, AND NULL IS OUTSIDE THE RULE.
   * ═════════════════════════════════════════════════════════════════════ */

  it('2 · a SECOND person on the same (door, subject) is refused by the partial unique index', async () => {
    await assert.rejects(
      () =>
        withSignInScope(pool, { ...SIGN_IN, externalSubject: SUBJECT }, async (tx) =>
          tx.query(MINT_PERSON, [
            'usr_minted_2',
            'new2@acme.invalid',
            DOOR,
            SUBJECT,
            ISSUER,
            REF,
          ]),
        ),
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        assert.match(
          message,
          /user_external_subject_per_connection/,
          'the mint was refused, but not by the index this assertion is about. ' +
            'R5 has no idempotency without it: a second sign-in by the same ' +
            'person would mint a SECOND person rather than finding the first, ' +
            `and every later read would have two to choose from. Refused with: ${message}`,
        )
        return true
      },
      'TWO PEOPLE NOW SHARE ONE (door, subject). `0011` made the broker handle a ' +
        'PAIR because a provider name is unique within one pool and nowhere ' +
        'else; the same reasoning one level down is that a `sub` is unique ' +
        'within an ISSUER. If this line is red the index is gone and the ' +
        'find-or-provision path has become find-one-of-several.',
    )
  })

  it('2b · ANTI-VACUOUS — two people with a NULL subject on ONE door both land', async () => {
    const mig = await migratorClient()
    try {
      await mig.query(
        `INSERT INTO tenant."user" (id,email,display_name,status,connection_id)
         VALUES ('usr_null_a','a@acme.invalid','A','active',$1)`,
        [DOOR],
      )
      await mig.query(
        `INSERT INTO tenant."user" (id,email,display_name,status,connection_id)
         VALUES ('usr_null_b','b@acme.invalid','B','active',$1)`,
        [DOOR],
      )
    } finally {
      await mig.end()
    }
    /* Reaching this line without throwing IS the assertion: §1 leaves the
     * column nullable, so a TOTAL unique index here would refuse the second
     * seeded person and every existing fixture in `tests/` with it. */
    assert.ok(
      true,
      'unreachable — the two inserts above throw if the index is not partial',
    )
  })

  /* ═════════════════════════════════════════════════════════════════════ *
   * §3 — THE TWO FORGERIES, AND THE TWO DIFFERENT OBJECTS THAT CATCH THEM.
   * ═════════════════════════════════════════════════════════════════════ */

  it('3 · a person whose door id and broker pair DISAGREE is unrepresentable — the composite FK', async () => {
    await assert.rejects(
      () =>
        withSignInScope(pool, { ...SIGN_IN, externalSubject: OTHER_SUBJECT }, async (tx) =>
          /* Acme's pair, Globex's connection id. */
          tx.query(MINT_PERSON, [
            'usr_forged_3',
            'f3@acme.invalid',
            OTHER_DOOR,
            OTHER_SUBJECT,
            ISSUER,
            REF,
          ]),
        ),
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        assert.match(
          message,
          /user_door_matches_broker_handle/,
          'the row was refused, but NOT by the foreign key this assertion is ' +
            'about. `db/migrations/0200` §2 makes a disagreeing row ' +
            'UNREPRESENTABLE rather than refused — G576\'s shape — and the ' +
            'refusal must therefore name the constraint. A row-level-security ' +
            'message here means the FK is gone and the policy happened to catch ' +
            `it, which it does not do in every arrangement. Refused with: ${message}`,
        )
        return true
      },
      'A PERSON NOW CARRIES ONE DOOR\'S ID AND ANOTHER DOOR\'S BROKER PAIR. ' +
        'Those two columns exist so a POLICY can ask the door question without ' +
        'reading `tenant.identity_connection` — which it may not do, because ' +
        '`0018`\'s `identity_connection_directory_rls` reads `tenant."user"` ' +
        'back and PostgreSQL refuses the cycle. **The FK is what makes the ' +
        'denormalised pair a projection rather than a second home**; without it ' +
        'the pair can say anything and the policy is testing a value the writer ' +
        'chose.',
    )
  })

  it('3b · a person on ANOTHER door, named honestly, is admitted by NO permissive policy', async () => {
    await assert.rejects(
      () =>
        withSignInScope(pool, { ...SIGN_IN, externalSubject: OTHER_SUBJECT }, async (tx) =>
          /* Globex's id AND Globex's pair — internally consistent, so the FK is
           * satisfied — inside a scope that named ACME's door. */
          tx.query(MINT_PERSON, [
            'usr_forged_3b',
            'f3b@globex.invalid',
            OTHER_DOOR,
            OTHER_SUBJECT,
            OTHER_ISSUER,
            OTHER_REF,
          ]),
        ),
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        assert.doesNotMatch(
          message,
          /user_door_matches_broker_handle/,
          '§3b is the POLICY arm and this refusal came from the foreign key. ' +
            'The row is internally consistent by construction — Globex\'s id ' +
            'with Globex\'s pair — so an FK refusal means the fixture no longer ' +
            `describes the case this assertion is about. Refused with: ${message}`,
        )
        assert.doesNotMatch(
          message,
          /user_signin_mint_restrictive/,
          '§3b is about the PERMISSIVE layer and this refusal names the ' +
            'restrictive policy. Measured: with the restrictive policy DROPPED ' +
            'this row is STILL refused, because `user_signin_rls`\'s `WITH ' +
            'CHECK` requires the pair to equal the scope\'s GUCs and no other ' +
            'permissive policy admits it — so an UNNAMED row-level-security ' +
            'message is the right one here, and a NAMED one means the ' +
            'permissive layer has stopped refusing. §3d is the restrictive ' +
            `policy's own arm. Refused with: ${message}`,
        )
        assert.match(message, /row-level security/i, `unexpected refusal: ${message}`)
        return true
      },
      'A CALLBACK THAT ARRIVED THROUGH ACME\'S DOOR MINTED A PERSON ON GLOBEX\'S. ' +
        'This is the arm the FK cannot reach, because the row disagrees with ' +
        'nothing about itself — it disagrees with the SCOPE. `orgFor(connection' +
        '.owner)` derives organisation from the door, so this is the org axis ' +
        'chosen by a writer: G289\'s five deleted controls, reached without ' +
        'anybody writing a default.',
    )
  })

  it('3d · THE RESTRICTIVE POLICY\'S OWN ARM — a person minted THROUGH the session disjunct', async () => {
    /*
     * 🛑 THIS IS THE ONLY ARM THE RESTRICTIVE POLICY REFUSES ALONE, AND
     *    WITHOUT IT THAT POLICY IS PINNED BY NOTHING BUT §5's CATALOGUE READ.
     *    Found by MUTATION rather than by review: dropping
     *    `user_signin_mint_restrictive` left every other assertion in this file
     *    GREEN, because the permissive `user_signin_rls` refuses the ordinary
     *    forgeries by itself. **A fence whose removal changes no behaviour any
     *    test observes is a fence nobody is keeping.**
     *
     * THE ATTACK, MEASURED RATHER THAN IMAGINED. `0009`'s `user_rls` is
     * PERMISSIVE and declares no `WITH CHECK`, so PostgreSQL reuses its
     * `USING` for INSERT — `id = (SELECT s.user_id FROM tenant.session s WHERE
     * s.handle_digest = app.session_ref)`. And `tenant.session.user_id` carries
     * NO foreign key. So a writer holding both privileges mints the SESSION
     * first, pointing at a person id that does not exist yet, and then mints
     * the PERSON with that id — at which point that disjunct is TRUE and admits
     * a person **on any door at all, with no broker pair**.
     *
     * WITNESSED BOTH WAYS against a live PostgreSQL:
     *   with the policy    -> new row violates row-level security policy
     *                         "user_signin_mint_restrictive" for table "user"
     *   without the policy -> the INSERT LANDS, rowCount 1
     *
     * ⚠️ AND THE NAMED REFUSAL IS THE HALF THAT MATTERS: PostgreSQL names a
     * policy only when a RESTRICTIVE one fails, so the name is proof that a
     * permissive policy ADMITTED this row and the restrictive one is the only
     * thing between it and the table.
     */
    const ATTACK_SESSION =
      'cccc1111dddd2222eeee3333ffff4444aaaa5555bbbb6666cccc7777dddd8888'

    await assert.rejects(
      () =>
        withSignInScope(
          pool,
          {
            ...SIGN_IN,
            externalSubject: 'a1b2c3d4-0000-4aaa-8bbb-ccccdddd0003',
            sessionRef: ATTACK_SESSION,
          },
          async (tx) => {
            await tx.query(
              `INSERT INTO tenant.session
                 (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
                  authenticated_at, last_used_at, expires_at, revoked_at)
               VALUES ('ses_attack_3d', $1, 'usr_ghost_3d', $2, NULL, 'acme.invalid',
                       now(), now(), now() + interval '1 hour', NULL)`,
              [ATTACK_SESSION, DOOR],
            )
            /* No broker pair at all, and GLOBEX's door. */
            return tx.query(
              `INSERT INTO tenant."user"
                 (id, email, display_name, status, connection_id)
               VALUES ('usr_ghost_3d','ghost@globex.invalid','Ghost','active',$1)`,
              [OTHER_DOOR],
            )
          },
        ),
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        assert.match(
          message,
          /user_signin_mint_restrictive/,
          'the row was refused and NOT by the restrictive policy. PostgreSQL ' +
            'names a policy only when a RESTRICTIVE one fails, so an unnamed ' +
            'message here means no permissive policy admitted the row — which ' +
            'would make this arm prove nothing about the fence it is named ' +
            `for, and the mutation that drops it would stay green. Refused with: ${message}`,
        )
        return true
      },
      'A PERSON WAS MINTED ON A DOOR THE CALLBACK NEVER ARRIVED THROUGH, BY ' +
        'GOING ROUND THE PERMISSIVE POLICY RATHER THAN THROUGH IT. ' +
        '`orgFor(connection.owner)` derives organisation from the door, so this ' +
        'row chooses its own organisation — G289\'s five deleted controls, ' +
        'reached by a writer instead of by a default. **The restrictive policy ' +
        'is ANDed into every write regardless of which permissive policy ' +
        'admitted it, and that is the whole of what it buys.**',
    )
  })

  it('3c · a mint OUTSIDE any sign-in scope is refused, with no broker GUC set at all', async () => {
    await assert.rejects(
      () =>
        withTenantScope(pool, ACME, async (tx) =>
          tx.query(MINT_PERSON, [
            'usr_forged_3c',
            'f3c@acme.invalid',
            DOOR,
            OTHER_SUBJECT,
            ISSUER,
            REF,
          ]),
        ),
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        assert.match(message, /row-level security/i, `unexpected refusal: ${message}`)
        return true
      },
      'A PERSON WAS MINTED BY A TRANSACTION THAT IS NOT A SIGN-IN. The ' +
        'restrictive policy compares the row\'s broker pair against ' +
        '`app.broker_issuer`/`app.broker_ref`, which no other scoped helper ' +
        'sets — so G100\'s deny-on-NULL is what refuses this, and the grant is ' +
        'reachable ONLY from `withSignInScope()`.',
    )
  })

  /* ═════════════════════════════════════════════════════════════════════ *
   * §4 — THE SUBJECT IS THE KEY, AND A DOOR IS NOT A PERSON.
   * ═════════════════════════════════════════════════════════════════════ */

  it('4 · a sign-in scope reads EXACTLY the person its subject names', async () => {
    const rows = await withSignInScope(
      pool,
      { ...SIGN_IN, externalSubject: SUBJECT },
      async (tx) =>
        (await tx.query(`SELECT id FROM tenant."user"`)).rows as Array<{ id: string }>,
    )
    assert.deepEqual(
      rows.map((r) => r.id),
      ['usr_minted_1'],
      'a sign-in scope sees a set of people that is not exactly the one its ' +
        'subject names. `db/signin-scope.ts` states the rule this policy is ' +
        'held to: "the policies admit exactly the row the key names". MEI and ' +
        'the two NULL-subject people are on the SAME door and must be invisible ' +
        'here — a policy keyed on the broker pair alone would return all four, ' +
        'and the sign-in scope would be a directory enumeration surface for ' +
        'anyone who could name a customer\'s provider.',
    )
  })

  it('4b · a scope naming a DIFFERENT subject sees nobody, though the people exist', async () => {
    const rows = await withSignInScope(
      pool,
      { ...SIGN_IN, externalSubject: OTHER_SUBJECT },
      async (tx) => (await tx.query(`SELECT id FROM tenant."user"`)).rows,
    )
    assert.equal(rows.length, 0, 'a subject that names nobody returned somebody')
  })

  it('4c · a scope declaring NO subject reaches no person at all', async () => {
    const rows = await withSignInScope(pool, SIGN_IN, async (tx) =>
      (await tx.query(`SELECT id FROM tenant."user"`)).rows,
    )
    assert.equal(
      rows.length,
      0,
      'a sign-in scope that named no subject reached a person. `externalSubject` ' +
        'is OPTIONAL on the helper and its absence means "this transaction ' +
        'touches no person" — exactly as `sessionRef`\'s absence means "does not ' +
        'mint". Every sign-in read written before `0200` (`assembleSignIn()`, ' +
        'which names no subject) depends on this being empty.',
    )
  })

  /* ═════════════════════════════════════════════════════════════════════ *
   * §5 — THE THREE DATABASE OBJECTS THE DOOR TEST RESTS ON.
   * ═════════════════════════════════════════════════════════════════════ */

  it('5 · the restrictive policy carries a WITH CHECK and NO USING', async () => {
    const mig = await migratorClient()
    try {
      const rows = (
        await mig.query(
          `SELECT qual, with_check FROM pg_policies
            WHERE schemaname='tenant' AND tablename='user'
              AND policyname='user_signin_mint_restrictive'`,
        )
      ).rows as Array<{ qual: string | null; with_check: string | null }>
      assert.equal(rows.length, 1, 'the restrictive fence is gone')
      assert.equal(
        rows[0]?.qual,
        null,
        'THE RESTRICTIVE POLICY HAS GROWN A `USING`, AND THAT IS AN ' +
          'AUTHENTICATION OUTAGE RATHER THAN A TIGHTENING. Measured on this ' +
          'table: a `RESTRICTIVE … FOR ALL USING (false)` took a session-scope ' +
          'read of `tenant."user"` from one row to ZERO, while the same policy ' +
          'with `WITH CHECK (false)` left it untouched. `resolveSubject()` reads ' +
          'this table on EVERY request, in a scope where no broker GUC is set — ' +
          'so a `USING` here ANDs a false-by-default test into every sign-in ' +
          'the product serves. §6 witnesses the consequence directly.',
      )
      assert.ok(rows[0]?.with_check, 'the restrictive policy has no WITH CHECK either')
    } finally {
      await mig.end()
    }
  })

  it('5b · no policy on tenant."user" reads tenant.identity_connection — the cycle', async () => {
    const mig = await migratorClient()
    try {
      const rows = (
        await mig.query(
          `SELECT policyname, COALESCE(qual,'')||' '||COALESCE(with_check,'') AS body
             FROM pg_policies WHERE schemaname='tenant' AND tablename='user'`,
        )
      ).rows as Array<{ policyname: string; body: string }>
      const offenders = rows.filter((r) => /identity_connection/.test(r.body))
      assert.deepEqual(
        offenders.map((r) => r.policyname),
        [],
        'A POLICY ON `tenant."user"` READS `tenant.identity_connection`, AND ' +
          'EVERY READ AND WRITE OF THIS TABLE IS NOW `infinite recursion ' +
          'detected in policy for relation "user"`. The cycle is not ' +
          'self-reference, which is why it keeps being written: `0018`\'s ' +
          '`identity_connection_directory_rls` ends `AND (id IN (SELECT ' +
          'u.connection_id FROM tenant."user" u))`, so the loop closes through a ' +
          'SECOND TABLE. It is STRUCTURAL — that policy\'s leading EXISTS is ' +
          'false on every sign-in and PostgreSQL still refuses, because the ' +
          'recursion is found while the expression is EXPANDED. The door test ' +
          'belongs on the row\'s own columns, with §2\'s foreign key making them ' +
          'honest.',
      )
    } finally {
      await mig.end()
    }
  })

  it('5c · 0011\'s partial unique index on the broker pair is still there', async () => {
    const mig = await migratorClient()
    try {
      const rows = (
        await mig.query(
          `SELECT indexname FROM pg_indexes
            WHERE schemaname='tenant' AND tablename='identity_connection'
              AND indexname='identity_connection_broker_handle_uniq'`,
        )
      ).rows
      assert.equal(
        rows.length,
        1,
        '`0011`\'s broker-handle index is gone and the door test has degraded ' +
          'SILENTLY. The fence is three objects, not one: §5\'s policy pins the ' +
          'PAIR to the scope, §2\'s foreign key pins `connection_id` to a row ' +
          'carrying that pair, and THIS index is what makes at most one row ' +
          'carry it. Without it two connections could share a broker handle and ' +
          '"the door the callback arrived through" stops being determined — ' +
          'which is G304\'s collided key, arriving through the person instead of ' +
          'the connection.',
      )
    } finally {
      await mig.end()
    }
  })

  /* ═════════════════════════════════════════════════════════════════════ *
   * §6 — THE SESSION PATH IS UNTOUCHED. THE ANTI-VACUITY FOR §5.
   * ═════════════════════════════════════════════════════════════════════ */

  it('6 · the ORDINARY session read of tenant."user" still sees its own person', async () => {
    const rows = await withSessionScope(pool, SESSION_DIGEST, async (tx) =>
      (await tx.query(`SELECT id FROM tenant."user"`)).rows as Array<{ id: string }>,
    )
    assert.deepEqual(
      rows.map((r) => r.id),
      [MEI],
      'THE RESTRICTIVE POLICY HAS BROKEN `resolveSubject()`. This is the read ' +
        'every request makes, in a session scope where no broker GUC is set, and ' +
        'it must be exactly as `0009` left it. If this line is red while §5 is ' +
        'green the restrictive policy has gained a `USING`; if both are red the ' +
        'policy is wrong in some other way. **A green suite with this line red ' +
        'is impossible by construction, which is the point of keeping the two ' +
        'assertions apart.**',
    )
  })

  /* ═════════════════════════════════════════════════════════════════════ *
   * §7 — NO UPDATE, NO DELETE, AND NO WRITE ON THE CLAIM MAP.
   * ═════════════════════════════════════════════════════════════════════ */

  it('7 · the app role holds INSERT on tenant."user" and holds no UPDATE and no DELETE', async () => {
    const mig = await migratorClient()
    try {
      const rows = (
        await mig.query(
          `SELECT has_table_privilege('tenant_rw','tenant."user"','INSERT') AS ins,
                  has_table_privilege('tenant_rw','tenant."user"','UPDATE') AS upd,
                  has_table_privilege('tenant_rw','tenant."user"','DELETE') AS del,
                  has_table_privilege('tenant_rw','tenant.identity_connection','INSERT') AS conn_ins,
                  has_table_privilege('tenant_rw','tenant.identity_connection','UPDATE') AS conn_upd`,
        )
      ).rows as Array<Record<string, boolean>>
      const p = rows[0]
      assert.equal(p?.['ins'], true, 'R5 has no privilege; see §1')
      assert.equal(
        p?.['upd'],
        false,
        'THE APP ROLE CAN NOW UPDATE A PERSON. `0009` says in its own voice that ' +
          'no policy filters on `status`, DELIBERATELY, because "a disabled ' +
          'person must be VISIBLE so the model can refuse them BY NAME" — so a ' +
          'path holding UPDATE can flip `status` from `disabled` to `active` and ' +
          'that refusal simply stops happening, with the control still present ' +
          'and still correct and asked about a row somebody edited. It would ' +
          'also let a path move an `external_subject` from one person to ' +
          'another, which is §2\'s uniqueness satisfied while the identity it ' +
          'protects is reassigned.',
      )
      assert.equal(
        p?.['del'],
        false,
        'THE APP ROLE CAN NOW DELETE A PERSON — `0010`\'s ' +
          'append-only-as-a-PRIVILEGE, breached. A person is what every audit ' +
          'row, every `granted_by` and every `assigned_to` in this schema points ' +
          'at.',
      )
      assert.equal(p?.['conn_ins'], false, 'a request path can now write a door')
      assert.equal(
        p?.['conn_upd'],
        false,
        'THE APP ROLE CAN NOW WRITE A CLAIM MAP. A path that could would point ' +
          '`email_claim` at a claim the CALLER controls and provision a person ' +
          'under somebody else\'s address — which is the whole of R6\'s exposure, ' +
          'reached through a grant instead of through a token.',
      )
    } finally {
      await mig.end()
    }
  })

  it('7b · the claim map is two columns and there is no subject_claim', async () => {
    const mig = await migratorClient()
    try {
      const rows = (
        await mig.query(
          `SELECT column_name FROM information_schema.columns
            WHERE table_schema='tenant' AND table_name='identity_connection'
              AND column_name LIKE '%_claim'
            ORDER BY column_name`,
        )
      ).rows as Array<{ column_name: string }>
      assert.deepEqual(
        rows.map((r) => r.column_name),
        ['email_claim', 'name_claim'],
        'THE CLAIM MAP HAS CHANGED SHAPE. A `subject_claim` was written and ' +
          'REMOVED, on two arguments `db/migrations/0200` §4 states at length: ' +
          'the subject is the sign-in scope\'s LOOKUP KEY and is therefore needed ' +
          'BEFORE the transaction opens, which a claim-mapped subject could not ' +
          'be; and a subject mapped to a mutable claim makes an account ' +
          'REASSIGNABLE — whoever next controls that address becomes that ' +
          'person. The subject is `sub`, fixed. A third column here is a RULING.',
      )
    } finally {
      await mig.end()
    }
  })
})
