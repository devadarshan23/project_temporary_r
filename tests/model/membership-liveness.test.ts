/**
 * THE MEMBERSHIP LIVENESS TERM, AND THE FACT THAT THERE IS EXACTLY ONE OF IT —
 * G641, 19 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHY THIS FILE EXISTS, AND IT IS NOT "TO TEST A PREDICATE".
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `selectTenantForSession()` refuses to check SESSION liveness, and says why:
 *
 *     "`resolveSubject()` above owns revocation, expiry, the user's status and
 *      the door's status, in an order its own header defends. A second copy
 *      here would be §5.3 — two implementations of one order — and the one
 *      that drifts is always the copy."
 *
 * **G641 puts a MEMBERSHIP check on the other side of that seam**, so the same
 * objection arrives pointing the other way. The answer is that the four terms
 * are written ONCE, in `holdsLiveMembership()`, and that both callers reach
 * them — `selectTenantForSession()` at binding, `resolveAuthority()` on every
 * request. **§4 is the assertion that makes that structural rather than
 * aspirational**: it reads `selectTenantForSession()`'s own bytes and requires
 * that the terms are NOT restated there.
 *
 * ⚠️ AND §1 IS NOT DECORATION. A control whose only observable behaviour is
 * refusal is `docs/HANDOFF.md` §5.6, and this repository has been caught by it
 * repeatedly. Every refusal below removes exactly one term from a fixture that
 * §1 has already proved is admitted.
 *
 * ⚠️ WHAT THIS FILE CANNOT SHOW: that the per-request path CALLS this. That is
 * `tests/http/membership-liveness-on-read.test.ts`, over a socket, against a
 * real PostgreSQL and the production authoriser — because a green unit test
 * about a predicate nobody invokes is the §5.6 this header opens with.
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  TENANT_SELECTION_REFUSALS,
  holdsLiveMembership,
  selectTenantForSession,
} from '../../model/access.ts'
import type { Membership, Session } from '../../model/domain.ts'
import type {
  MembershipId,
  RoleId,
  TenantId,
  Timestamp,
  UserId,
} from '../../model/kernel.ts'

const ACME = 'ten_acme' as TenantId
const GLOBEX = 'ten_globex' as TenantId
const MEI = 'usr_ops_mei' as UserId
const VIK = 'usr_ops_vik' as UserId

/** The clock every case below is decided against. Supplied, never read. */
const NOW = '2026-09-19T12:00:00.000Z' as Timestamp
const YESTERDAY = '2026-09-18T12:00:00.000Z' as Timestamp
const TOMORROW = '2026-09-20T12:00:00.000Z' as Timestamp

/**
 * ⚠️ BUILT HERE AND EVERY FIELD STATED, for `tests/model/session-resolution
 * .test.ts`'s recorded reason: *"a partial builder with defaults is how a test
 * ends up asserting against a row no production path could produce."*
 */
function membership(o: {
  readonly id: string
  readonly userId: UserId
  readonly tenantId: TenantId
  readonly expiresAt?: Timestamp | null
  readonly revokedAt?: Timestamp | null
}): Membership {
  return {
    id: o.id as MembershipId,
    userId: o.userId,
    tenantId: o.tenantId,
    roleId: 'rol_pack_ap_approver' as RoleId,
    grantedBy: 'usr_acme_admin' as UserId,
    grantedAt: '2026-08-01T00:00:00.000Z' as Timestamp,
    expiresAt: o.expiresAt ?? null,
    revokedAt: o.revokedAt ?? null,
  }
}

const LIVE = membership({ id: 'mem_live', userId: MEI, tenantId: ACME })

function live(memberships: readonly Membership[]): boolean {
  return holdsLiveMembership({ memberships, userId: MEI, tenantId: ACME, now: NOW })
}

describe('holdsLiveMembership — one term, and it admits before it refuses', () => {
  /* ================================================================ *
   * §1 · THE ALLOW. Without it every assertion below is vacuous.
   * ================================================================ */

  it('1 · a live membership ADMITS — the arm every refusal below removes a term from', () => {
    assert.equal(
      live([LIVE]),
      true,
      'a live membership was not admitted, so every refusal in this file is vacuous — ' +
        'a control whose only observable behaviour is refusal is `docs/HANDOFF.md` §5.6.',
    )
  })

  it('1a · and `selectTenantForSession()` binds on it, which is the same answer one caller up', () => {
    const outcome = selectTenantForSession({
      session: session(),
      hostBoundTenantId: ACME,
      memberships: [LIVE],
      now: NOW,
    })
    assert.equal(outcome.ok, true, 'the binding arm refused a live membership')
  })

  /* ================================================================ *
   * §2 · THE TWO LIVENESS TERMS, EACH REMOVED ALONE.
   * ================================================================ */

  it('2a · a REVOKED membership is refused — a revoked row is still a row', () => {
    assert.equal(
      live([membership({ id: 'mem_r', userId: MEI, tenantId: ACME, revokedAt: YESTERDAY })]),
      false,
      '`Membership.revokedAt` is "retained rather than deleted, so a transfer between ' +
        'partners is auditable", so an `EXISTS` on `(userId, tenantId)` alone would ' +
        're-grant every membership anyone ever lost.',
    )
  })

  it('2b · an EXPIRED membership is refused — and this is the arm G641 exists for', () => {
    assert.equal(
      live([membership({ id: 'mem_e', userId: MEI, tenantId: ACME, expiresAt: YESTERDAY })]),
      false,
      'an expired membership was admitted. `db/migrations/0035` names this as the only ' +
        'remaining expiry gap: "the CLOCK ARRIVING IS NOT AN `UPDATE` … a trigger has no ' +
        'tick", so nothing but a read-side check refuses it.',
    )
  })

  it('2c · a FUTURE expiry is live — NULL and "later" are not absences to refuse on', () => {
    assert.equal(
      live([membership({ id: 'mem_f', userId: MEI, tenantId: ACME, expiresAt: TOMORROW })]),
      true,
      'a membership expiring tomorrow was refused today.',
    )
    assert.equal(
      live([membership({ id: 'mem_n', userId: MEI, tenantId: ACME, expiresAt: null })]),
      true,
      '`Membership.expiresAt`: "Partner-scoped memberships must expire. Null only for ' +
        'direct staff" — so NULL means DOES NOT EXPIRE and must not be read as an absence.',
    )
  })

  it('2d · the boundary is `<=`, so a membership expiring AT `now` is already gone', () => {
    assert.equal(
      live([membership({ id: 'mem_b', userId: MEI, tenantId: ACME, expiresAt: NOW })]),
      false,
      'the comparison is `expiresAt <= now`, matching `decide()`, `redeemAuthorization()` ' +
        'and `resolveSubject()` exactly. A `<` here would be a fourth clock with a ' +
        'different boundary, which is the drift this function exists to prevent.',
    )
  })

  /* ================================================================ *
   * §3 · A HAYSTACK, NOT A MENU. The two matching terms.
   * ================================================================ */

  it('3a · somebody else`s live membership does not admit me', () => {
    assert.equal(
      live([membership({ id: 'mem_v', userId: VIK, tenantId: ACME })]),
      false,
      'a row for another user was matched. "The function does not trust the caller to ' +
        'have filtered, because a check that depends on its caller having already ' +
        'checked is not a check."',
    )
  })

  it('3b · my live membership in ANOTHER tenant does not admit me here', () => {
    assert.equal(
      live([membership({ id: 'mem_g', userId: MEI, tenantId: GLOBEX })]),
      false,
      'a row for another tenant was matched — which over HTTP would be a cross-tenant ' +
        'admission, since the per-request caller passes `ResolvedSubject.tenantId`.',
    )
  })

  it('3c · an EMPTY haystack refuses, and so does a haystack of only dead rows', () => {
    assert.equal(live([]), false, 'no membership at all was admitted')
    assert.equal(
      live([
        membership({ id: 'mem_r2', userId: MEI, tenantId: ACME, revokedAt: YESTERDAY }),
        membership({ id: 'mem_e2', userId: MEI, tenantId: ACME, expiresAt: YESTERDAY }),
      ]),
      false,
      'two dead rows admitted between them what neither admits alone',
    )
  })

  it('3d · ONE live row among dead ones and strangers is enough — 0005 has no UNIQUE pair', () => {
    assert.equal(
      live([
        membership({ id: 'mem_r3', userId: MEI, tenantId: ACME, revokedAt: YESTERDAY }),
        membership({ id: 'mem_v3', userId: VIK, tenantId: ACME }),
        membership({ id: 'mem_g3', userId: MEI, tenantId: GLOBEX }),
        LIVE,
      ]),
      true,
      '`db/migrations/0005` deliberately has no `UNIQUE (tenant_id, user_id)` — "the same ' +
        'pair recurs every time a person is re-granted" — so two live memberships for one ' +
        'person is a SUPPORTED SHAPE and a re-grant must not be shadowed by the row it ' +
        'replaced.',
    )
  })
})

/* ------------------------------------------------------------------ *
 * §4 · THE SEAM. One implementation, and the proof is textual.
 * ------------------------------------------------------------------ */

const ACCESS_SOURCE = readFileSync(
  fileURLToPath(new URL('../../model/access.ts', import.meta.url)),
  'utf8',
)

/** The function body, comments and all, from its `export function` to its close. */
function selectTenantForSessionBody(): string {
  const start = ACCESS_SOURCE.indexOf(
    'export function selectTenantForSession(input: TenantSelectionInput): TenantSelection {',
  )
  assert.notEqual(
    start,
    -1,
    '`selectTenantForSession()` was renamed or resignatured, so §4 is asserting nothing.',
  )
  const end = ACCESS_SOURCE.indexOf('\n}\n', start)
  assert.notEqual(end, -1, 'the end of `selectTenantForSession()` could not be found')
  return ACCESS_SOURCE.slice(start, end)
}

describe('the term lives in ONE place, and the copy that would drift does not exist', () => {
  it('4a · `selectTenantForSession()` CALLS the predicate rather than restating it', () => {
    assert.match(
      selectTenantForSessionBody(),
      /holdsLiveMembership\(\{/,
      '`selectTenantForSession()` no longer reaches the shared term. If the membership ' +
        'arm was inlined back into it, there are two implementations of one predicate ' +
        'again — §5.3, "and the one that drifts is always the copy".',
    )
  })

  /**
   * 🛑 THE FIRST DRAFT OF THIS ASSERTION WAS §5.1 AND IS RECORDED RATHER THAN
   *    TIDIED AWAY, BECAUSE IT IS THE DEFECT THIS WHOLE FILE IS ABOUT.
   *
   * It banned the IDENTIFIERS `revokedAt` and `expiresAt` from the function
   * body — *a rule keyed on a convenient landmark instead of the property it
   * protects* — and it went RED on a correct tree, because **G292's STAFF arm
   * legitimately reads `staffGrant.revokedAt` and `staffGrant.expiresAt`**:
   * those are the GRANT's liveness terms, which are that arm's own and belong
   * nowhere else. Banning the names would have forbidden the second arm from
   * doing its job in order to police the first.
   *
   * **The property is that the body may not touch a MEMBERSHIP ROW at all.**
   * It gets the haystack as one value and hands it, whole, to the one
   * predicate — so there is nothing for a liveness term to be applied TO, and
   * a future editor who wants to inline one has to widen this assertion first
   * and say why in the diff.
   */
  it('4b · and the body cannot touch a membership ROW — the copy has nothing to be made of', () => {
    const body = selectTenantForSessionBody()
    /* Comments narrate all of this at length and must be allowed to; the
     * prohibition is on CODE. Strip block comments and line comments first. */
    const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

    assert.equal(
      /\bof\s+memberships\b/.test(code),
      false,
      '`selectTenantForSession()` iterates the membership rows again. The four terms are ' +
        '`holdsLiveMembership()`\'s, and a loop here is the second implementation — §5.3, ' +
        '"and the one that drifts is always the copy". `db/migrations/0035` records what ' +
        'that drift looks like in SQL: one of seven copies of this predicate was written ' +
        'with the expiry term missing.',
    )

    const mentions = code.match(/\bmemberships\b/g) ?? []
    assert.equal(
      mentions.length,
      2,
      'the body names `memberships` ' +
        `${mentions.length} times and must name it exactly twice — once to take it out of ` +
        'the input and once to hand it to `holdsLiveMembership()`. A third mention means ' +
        'the body has reached into the rows, which is the only way a second copy of the ' +
        'liveness terms can start. If a new caller genuinely needs one, widen this ' +
        'assertion in the same diff and argue it.',
    )
  })

  it('4c · and the refusal it returns is still the ONE word, not a split', () => {
    const outcome = selectTenantForSession({
      session: session(),
      hostBoundTenantId: ACME,
      memberships: [membership({ id: 'mem_x', userId: MEI, tenantId: ACME, expiresAt: YESTERDAY })],
      now: NOW,
    })
    assert.equal(outcome.ok, false)
    assert.equal(
      outcome.ok === false ? outcome.refusal : '',
      TENANT_SELECTION_REFUSALS.membershipAbsent,
      'an EXPIRED membership must come back as `membership_absent`, the same word as ' +
        'revoked and never-existed. "Splitting it into `membership_revoked` and ' +
        '`membership_expired` would build an oracle" — it discloses that the tenant ' +
        'exists, that they were once in it, and roughly when that changed.',
    )
  })
})

/**
 * ⚠️ DECLARED LAST AND USED ABOVE, WHICH IS LEGAL FOR A `function` AND IS
 * DELIBERATE: the session is scenery here. Only `userId` is read.
 */
function session(): Session {
  return {
    id: 'ses_mei',
    handleDigest: 'd'.repeat(64),
    userId: MEI,
    connectionId: 'idc_acme_entra',
    tenantId: null,
    issuedHost: 'acme.us-west-2.reconcileai.app',
    authenticatedAt: '2026-09-19T11:00:00.000Z' as Timestamp,
    secondFactorAt: null,
    lastUsedAt: '2026-09-19T11:30:00.000Z' as Timestamp,
    expiresAt: TOMORROW,
    revokedAt: null,
  } as Session
}
