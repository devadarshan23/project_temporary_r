/**
 * THE MINT WRITER — PROVISION, MINT, AND THE TENANT THAT IS NOWHERE IN IT.
 * W3-S3, G1637–G1640, 21 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE SURFACE UNDER TEST IS REACHED BY NO ROUTE, AND `tests/` IS ITS ONLY
 *    CALLER. THAT IS DELIBERATE — READ `server/data-plane/session-mint-store.ts`
 *    BEFORE READING THIS AS A GAP.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `completeFederatedSignIn` is declared and MOUNTED NOWHERE, because
 * `docs/build/completion-plan.md` §5 W3 puts the mount at S6 behind **R1, an
 * OPEN OWNER'S RULING** — these would be the product's first public
 * UNAUTHENTICATED endpoints. This is `0007`'s precedent for proving a surface
 * without a route, and `server/data-plane/definition-store.ts`'s shape one file
 * over. Derive the served set, never read it:
 * `grep -rn 'handlers:' server&#47;*&#47;start.ts`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 §3 IS THE ONE TO READ. IT IS INVARIANT 1, AT THE FIRST REAL CALLER.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Copy it, never paraphrase it: *"Tenant scope is derived from the session,
 * never read from a request."* G315 puts the tenant in the OIDC `state`
 * DELIBERATELY, as a routing fact for the 302 — so the danger is not that
 * somebody deletes the derivation, it is that somebody CARRIES THIS ONE
 * FORWARD and finds a ruling that appears to endorse it.
 *
 * W3-S0 measured that the DATABASE refuses a tenantful mint, and W3-S2 made
 * `tenantId` absent from `MintSessionInput` rather than `null` in it. **§3 is
 * the third control and the one neither of those is**: it asserts, over a real
 * round trip, that the row this writer produced carries `NULL` — so a future
 * edit that found some other way to supply one is red here even if it satisfied
 * both of the others.
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, type TenantPool } from '../../db/tenant-scope.ts'
import { withSessionScope } from '../../db/session-scope.ts'
import {
  mintFederatedSession,
  type MintFederatedSessionInput,
} from '../../server/data-plane/session-mint-store.ts'
import type { SessionHandleDigest } from '../../model/domain.ts'
import type { IdentityConnectionId, SessionId, UserId } from '../../model/kernel.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_SESSION_MINT_WRITER_DB_NAME'] ?? runScopedName('reconcile_session_mint_writer_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const DOOR = 'idc_acme_entra' as IdentityConnectionId
const ISSUER = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_POOLAAA'
const REF = 'acme-entra'

/** Every digest is 64 hex characters and none is a real preimage. */
const STATE = '70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f' as SessionHandleDigest
const CHALLENGE = '11112222333344445555666677778888111122223333444455556666777788' as SessionHandleDigest
const NEW_HANDLE = 'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa7777bbbb8888' as SessionHandleDigest
const SECOND_HANDLE = 'bbbb1111cccc2222dddd3333eeee4444ffff5555aaaa6666bbbb7777cccc8888' as SessionHandleDigest

const SUBJECT = 'd4c3b2a1-0000-4aaa-8bbb-ccccdddd0001'

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the session-mint writer suite', probe)

/** One attempt row per arm — an attempt is single-use by design. */
async function seedAttempt(id: string, digest: string): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query(
      `INSERT INTO tenant.sign_in_attempt
         (id, handle_digest, connection_id, challenge_digest,
          started_at, expires_at, consumed_at)
       VALUES ($1, $2, $3, $4, now(), now() + interval '10 minutes', NULL)`,
      [id, digest, DOOR, CHALLENGE],
    )
  } finally {
    await mig.end()
  }
}

function inputFor(overrides: Partial<MintFederatedSessionInput>): MintFederatedSessionInput {
  return {
    brokerIssuer: ISSUER,
    brokerRef: REF,
    stateDigest: STATE,
    externalSubject: SUBJECT,
    callback: { handleDigest: STATE, connectionId: DOOR, challengeDigest: CHALLENGE },
    claims: { sub: SUBJECT, email: 'nadia@acme.invalid', name: 'Nadia' },
    emailVerified: true,
    newUserId: 'usr_minted_nadia' as UserId,
    newSessionId: 'ses_minted_1' as SessionId,
    newHandleDigest: NEW_HANDLE,
    issuedHost: 'acme.us-west-2.reconcileai.app',
    bounds: { maxLifetimeSeconds: 43200, maxIdleSeconds: 1800 },
    ...overrides,
  }
}

describe('the federated session mint writer', { skip }, () => {
  let pool: TenantPool

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    const mig = await migratorClient()
    try {
      await mig.query(
        `INSERT INTO tenant.identity_connection
           (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
            broker_issuer, broker_ref, status, email_claim, name_claim)
         VALUES ($1,'oidc','Acme Entra','customer',NULL,'acc_acme',$2,$3,'active',
                 'email','name')`,
        [DOOR, ISSUER, REF],
      )
    } finally {
      await mig.end()
    }
    pool = await createAppPool(1)
  })

  after(async () => {
    await pool?.end()
  })

  /* ═════════════════════════════════════════════════════════════════════ *
   * §1 — R5: THE FIRST SIGN-IN PROVISIONS A PERSON AND MINTS A SESSION.
   * ═════════════════════════════════════════════════════════════════════ */

  it('1 · a first sign-in PROVISIONS the person and mints the session, in one transaction', async () => {
    await seedAttempt('sia_1', STATE)
    const out = await mintFederatedSession(pool, inputFor({}))

    assert.equal(
      out.ok,
      true,
      'THE MINT FAILED AND R5 IS THEREFORE NOT REACHABLE END TO END. ' +
        `Outcome: ${JSON.stringify(out)}`,
    )
    if (!out.ok) return

    assert.equal(
      out.provisioned,
      true,
      'the writer reported that it FOUND a person on a database where none ' +
        'existed. R5 auto-provisions on FIRST sign-in and `provisioned` is that ' +
        "ruling's one observable half.",
    )
    assert.equal(out.session.userId, 'usr_minted_nadia')
    assert.equal(
      out.session.connectionId,
      DOOR,
      'the minted session records a door other than the one the attempt pinned',
    )
  })

  it('1b · the provisioned person carries the projected claims and the door', async () => {
    const mig = await migratorClient()
    try {
      const rows = (
        await mig.query(
          `SELECT email, display_name, status, connection_id, external_subject,
                  broker_issuer, broker_ref
             FROM tenant."user" WHERE id = 'usr_minted_nadia'`,
        )
      ).rows as Array<Record<string, unknown>>
      const person = rows[0]
      assert.ok(person, 'no person was written at all')
      assert.equal(
        person['email'],
        'nadia@acme.invalid',
        'the claim map was not applied: `email_claim` on this door is `email`, ' +
          'and the projection is the ONE place a claim name is read.',
      )
      assert.equal(person['display_name'], 'Nadia')
      assert.equal(person['external_subject'], SUBJECT)
      assert.equal(person['connection_id'], DOOR)
      assert.equal(
        person['broker_issuer'],
        ISSUER,
        'the broker pair was not written, so `db/migrations/0200` §6\'s policy ' +
          'could not have admitted this row — which means the fence is not ' +
          'doing what this suite believes it is.',
      )
      assert.equal(person['broker_ref'], REF)
    } finally {
      await mig.end()
    }
  })

  /* ═════════════════════════════════════════════════════════════════════ *
   * §2 — THE SECOND SIGN-IN FINDS THE FIRST PERSON. R5's IDEMPOTENCY.
   * ═════════════════════════════════════════════════════════════════════ */

  it('2 · a SECOND sign-in FINDS that person rather than minting another', async () => {
    const SECOND_STATE =
      '99998888777766665555444433332222999988887777666655554444333322' as SessionHandleDigest
    await seedAttempt('sia_2', SECOND_STATE)

    const out = await mintFederatedSession(
      pool,
      inputFor({
        stateDigest: SECOND_STATE,
        callback: { handleDigest: SECOND_STATE, connectionId: DOOR, challengeDigest: CHALLENGE },
        newSessionId: 'ses_minted_2' as SessionId,
        newHandleDigest: SECOND_HANDLE,
        /* A DIFFERENT id, which must be ignored because the person exists. */
        newUserId: 'usr_would_be_second' as UserId,
        /* Different claims, which must NOT be re-projected — `0200` §7 grants
         * no UPDATE, and re-projection is a separate ruling. */
        claims: { sub: SUBJECT, email: 'renamed@acme.invalid', name: 'Renamed' },
      }),
    )

    assert.equal(out.ok, true, `the second sign-in failed: ${JSON.stringify(out)}`)
    if (!out.ok) return

    assert.equal(
      out.provisioned,
      false,
      'THE SECOND SIGN-IN MINTED A SECOND PERSON. R5 has no idempotency without ' +
        'the find-first path, and `db/migrations/0200` §3\'s unique index would ' +
        'have refused it — so a green `ok` with `provisioned: true` means the ' +
        'reader failed to see a person the policy does admit, which is the more ' +
        'confusing of the two failures.',
    )
    assert.equal(
      out.session.userId,
      'usr_minted_nadia',
      'the session was minted against the id the CALLER offered rather than the ' +
        'id of the person that already exists',
    )

    const mig = await migratorClient()
    try {
      const rows = (
        await mig.query(
          `SELECT id, email FROM tenant."user" WHERE external_subject = $1`,
          [SUBJECT],
        )
      ).rows as Array<{ id: string; email: string }>
      assert.equal(rows.length, 1, 'two people now share one external subject')
      assert.equal(
        rows[0]?.email,
        'nadia@acme.invalid',
        'THE SECOND SIGN-IN RE-PROJECTED THE CLAIMS AND REWROTE THE PERSON. ' +
          '`db/migrations/0200` §7 grants no `UPDATE` on `tenant."user"`, so ' +
          'this should be impossible — and the reason the grant is withheld is ' +
          'that a path holding it could flip `status` from `disabled` to ' +
          '`active`. Re-projection on each sign-in is a separate RULING with ' +
          'that objection as its first.',
      )
    } finally {
      await mig.end()
    }
  })

  /* ═════════════════════════════════════════════════════════════════════ *
   * §3 — INVARIANT 1, OVER A REAL ROUND TRIP.
   * ═════════════════════════════════════════════════════════════════════ */

  it('3 · every session this writer has minted carries a NULL tenant', async () => {
    const mig = await migratorClient()
    try {
      const rows = (
        await mig.query(
          `SELECT id, tenant_id FROM tenant.session ORDER BY id`,
        )
      ).rows as Array<{ id: string; tenant_id: string | null }>

      assert.ok(rows.length >= 2, 'the mints in §1 and §2 did not both land')
      assert.deepEqual(
        rows.filter((r) => r.tenant_id !== null),
        [],
        'A SESSION THIS WRITER MINTED CARRIES A TENANT. Copy invariant 1 rather ' +
          'than paraphrasing it: "Tenant scope is derived from the session, ' +
          'never read from a request." G315 puts the tenant in the OIDC `state` ' +
          'DELIBERATELY as a routing fact for the 302, so the failure this ' +
          'guards is not a deleted derivation — it is somebody CARRYING THAT ONE ' +
          'FORWARD and finding a ruling that appears to endorse it. ' +
          '**THREE INDEPENDENT CONTROLS HAVE TO FAIL FOR THIS LINE TO GO RED**: ' +
          '`MintSessionInput` has no `tenantId` field (S2), `MintedSessionFacts` ' +
          'is an `Omit` with nowhere to put one (S2, and the load-bearing half ' +
          'because excess-property checking is literal-only), and ' +
          '`session_selection_restrictive` refuses a tenantful row in a sign-in ' +
          'scope (S0). This is the fourth, and it is the only one that looks at ' +
          'the row that was actually written.',
      )
    } finally {
      await mig.end()
    }
  })

  it('3b · ANTI-VACUOUS — the minted session is READABLE through withSessionScope()', async () => {
    const rows = await withSessionScope(pool, NEW_HANDLE, async (tx) =>
      (
        await tx.query(
          `SELECT id, user_id, tenant_id FROM tenant.session WHERE handle_digest = $1`,
          [NEW_HANDLE],
        )
      ).rows as Array<{ id: string; user_id: string; tenant_id: string | null }>,
    )
    assert.equal(
      rows.length,
      1,
      '§1 reported a session and the session scope cannot see it. A mint whose ' +
        'row no later request can read is not a mint — the very next request ' +
        'resolves the handle through exactly this helper. Without this arm §3 ' +
        'would be satisfied by a writer that wrote nothing at all.',
    )
    assert.equal(rows[0]?.user_id, 'usr_minted_nadia')
    assert.equal(rows[0]?.tenant_id, null)
  })

  /* ═════════════════════════════════════════════════════════════════════ *
   * §4 — THE ATTEMPT IS CONSUMED IN THE SAME TRANSACTION, AND ONCE.
   * ═════════════════════════════════════════════════════════════════════ */

  it('4 · the attempt is consumed, and a REPLAY of it is refused', async () => {
    const mig = await migratorClient()
    try {
      const rows = (
        await mig.query(`SELECT consumed_at FROM tenant.sign_in_attempt WHERE id = 'sia_1'`)
      ).rows as Array<{ consumed_at: unknown }>
      assert.notEqual(
        rows[0]?.consumed_at,
        null,
        'the attempt was not consumed, so the `state` is REPLAYABLE — G315: "a ' +
          'replayable `state` or a reusable grant would hand the whole flow ' +
          'away."',
      )
    } finally {
      await mig.end()
    }

    const replay = await mintFederatedSession(
      pool,
      inputFor({
        newSessionId: 'ses_replay' as SessionId,
        newHandleDigest:
          'dddd1111eeee2222ffff3333aaaa4444bbbb5555cccc6666dddd7777eeee8888' as SessionHandleDigest,
      }),
    )
    assert.equal(
      replay.ok,
      false,
      'A CONSUMED ATTEMPT MINTED A SECOND SESSION. The single-use property IS ' +
        'the atomicity: `consumeSignInAttempt()` refuses a replayed attempt and ' +
        'the consuming write is in the same transaction as the mint, so there is ' +
        'no window between reading an unconsumed attempt and writing ' +
        '`consumed_at`.',
    )
    if (replay.ok) return
    /*
     * ⚠️ THE REFUSAL ARRIVES NESTED, AND ASSERTING THE OUTER `kind` ALONE WOULD
     * HAVE BEEN SATISFIED BY ANY FAILURE AT ALL. `mintFederatedSession` wraps
     * `assembleSignIn`'s whole answer under `kind: 'assembly'` — deliberately,
     * because that seam carries THREE vocabularies and flattening them is
     * *"a fact about us reported as a fact about the caller"*. So the arm that
     * matters is the inner one, and it must be the MODEL's `sign_in_attempt_
     * replayed` rather than, say, a substrate refusal about a row that vanished.
     */
    assert.equal(
      replay.kind,
      'assembly',
      `a replay was refused by the wrong layer: ${JSON.stringify(replay)}`,
    )
    assert.equal(replay.assembly.ok, false)
    if (replay.assembly.ok) return
    assert.equal(
      replay.assembly.kind,
      'attempt',
      'the replay was not refused by the MODEL. `consumeSignInAttempt()` is ' +
        'where single-use lives, and a refusal from any other layer means the ' +
        'attempt was still unconsumed and something else happened to stop it — ' +
        `which is a different property. Got: ${JSON.stringify(replay.assembly)}`,
    )
    assert.equal(
      replay.assembly.refusal,
      'sign_in_attempt_replayed',
      `the model refused the replay for the wrong reason: ${JSON.stringify(replay.assembly)}`,
    )
  })

  /* ═════════════════════════════════════════════════════════════════════ *
   * §5 — THE DOOR WITH NO CLAIM MAP IS A REFUSAL AND NEVER A DEFAULT.
   * ═════════════════════════════════════════════════════════════════════ */

  it('5 · a door that declares no claim map cannot provision anybody', async () => {
    const UNDECLARED_ISSUER = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_POOLCCC'
    const UNDECLARED_REF = 'acme-unmapped'
    const UNDECLARED_STATE =
      '44443333222211110000aaaabbbbcccc44443333222211110000aaaabbbbcc' as SessionHandleDigest
    const UNDECLARED_DOOR = 'idc_acme_unmapped' as IdentityConnectionId

    const mig = await migratorClient()
    try {
      /* A door with NO `email_claim` and NO `name_claim`. */
      await mig.query(
        `INSERT INTO tenant.identity_connection
           (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
            broker_issuer, broker_ref, status)
         VALUES ($1,'oidc','Acme Unmapped','customer',NULL,'acc_acme',$2,$3,'active')`,
        [UNDECLARED_DOOR, UNDECLARED_ISSUER, UNDECLARED_REF],
      )
      await mig.query(
        `INSERT INTO tenant.sign_in_attempt
           (id, handle_digest, connection_id, challenge_digest,
            started_at, expires_at, consumed_at)
         VALUES ('sia_5', $1, $2, $3, now(), now() + interval '10 minutes', NULL)`,
        [UNDECLARED_STATE, UNDECLARED_DOOR, CHALLENGE],
      )
    } finally {
      await mig.end()
    }

    const out = await mintFederatedSession(
      pool,
      inputFor({
        brokerIssuer: UNDECLARED_ISSUER,
        brokerRef: UNDECLARED_REF,
        stateDigest: UNDECLARED_STATE,
        externalSubject: 'd4c3b2a1-0000-4aaa-8bbb-ccccdddd0005',
        callback: {
          handleDigest: UNDECLARED_STATE,
          connectionId: UNDECLARED_DOOR,
          challengeDigest: CHALLENGE,
        },
        newUserId: 'usr_unmapped' as UserId,
        newSessionId: 'ses_unmapped' as SessionId,
        newHandleDigest:
          'eeee1111ffff2222aaaa3333bbbb4444cccc5555dddd6666eeee7777ffff8888' as SessionHandleDigest,
      }),
    )

    assert.equal(
      out.ok,
      false,
      'A PERSON WAS PROVISIONED THROUGH A DOOR THAT DECLARED NO CLAIM MAP, WHICH ' +
        'MEANS SOMETHING FELL BACK TO THE OIDC STANDARD NAMES. `db/migrations/0200` ' +
        '§4 refuses that by name: a default that is right for every door we ' +
        'provisioned and wrong for a BYOA door (G276 — the pool is in the ' +
        "CUSTOMER's account) maps the wrong claim SILENTLY, which is scope " +
        'failing OPEN. **The claims in this call deliberately DO carry `email` ' +
        'and `name`, so a fall-back would have succeeded** — the refusal has to ' +
        'come from the absent map and not from absent claims.',
    )
    if (out.ok) return
    assert.equal(out.kind, 'projection', `refused by the wrong layer: ${JSON.stringify(out)}`)
    assert.equal(out.refusal, 'connection_claim_map_absent')

    const after = await migratorClient()
    try {
      const rows = (
        await after.query(`SELECT id FROM tenant."user" WHERE id = 'usr_unmapped'`)
      ).rows
      assert.equal(
        rows.length,
        0,
        'the refusal left a person behind. One transaction means the ROLLBACK ' +
          'takes the person, the consumption and the session together.',
      )
    } finally {
      await after.end()
    }
  })

  it('5b · a declared claim that the token does not carry is refused, and nothing is written', async () => {
    const STATE_6 =
      '5555666677778888999900001111222233335555666677778888999900001' as SessionHandleDigest
    await seedAttempt('sia_6', STATE_6)

    const out = await mintFederatedSession(
      pool,
      inputFor({
        stateDigest: STATE_6,
        callback: { handleDigest: STATE_6, connectionId: DOOR, challengeDigest: CHALLENGE },
        externalSubject: 'd4c3b2a1-0000-4aaa-8bbb-ccccdddd0006',
        /* `name` is declared on this door and is absent here. */
        claims: { sub: 'x', email: 'someone@acme.invalid' },
        newUserId: 'usr_no_name' as UserId,
        newSessionId: 'ses_no_name' as SessionId,
        newHandleDigest:
          'ffff1111aaaa2222bbbb3333cccc4444dddd5555eeee6666ffff7777aaaa8888' as SessionHandleDigest,
      }),
    )

    assert.equal(out.ok, false, 'a person was provisioned from a token missing a declared claim')
    if (out.ok) return
    assert.equal(out.kind, 'projection')
    assert.equal(
      out.refusal,
      'claim_absent',
      'the projection refused for the wrong reason — the map IS declared on this ' +
        'door, so claim_absent is the arm and not connection_claim_map_absent. ' +
        `Got: ${out.refusal}`,
    )
  })

  /* ═════════════════════════════════════════════════════════════════════ *
   * §6 — THE CLAIM MAP REACHES NO AUTHORISATION SURFACE.
   * ═════════════════════════════════════════════════════════════════════ */

  it('6 · no claim name is reachable from model/access.ts or any authorisation seam', async () => {
    const { readFile } = await import('node:fs/promises')
    for (const file of [
      'model/access.ts',
      'server/data-plane/authorise.ts',
      'server/data-plane/identity.ts',
    ]) {
      const text = await readFile(new URL(`../../${file}`, import.meta.url), 'utf8')
      assert.doesNotMatch(
        text,
        /email_claim|name_claim|emailClaim|nameClaim/,
        `THE CLAIM MAP HAS REACHED ${file}. It is read as two bare strings by ` +
          '`server/data-plane/session-mint-store.ts`, applied, and discarded — it ' +
          'reaches no model type and travels on no `IdentityConnection`, so no ' +
          'claim name an OPERATOR chose can reach `orgFor()`, `decide()` or any ' +
          'authorisation decision. **That containment is the reason the map was ' +
          'kept off `IdentityConnection` rather than added to it**, and this is ' +
          'the assertion that keeps it true.',
      )
    }
  })
})
