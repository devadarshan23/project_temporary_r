/**
 * A PARTNER INVITATION, REDEEMED AT SIGN-IN — 2 Oct 2026, G2801–G2816, and
 * at ANY sign-in since G2906 (THE OWNER'S, same day): *"Any sign-in: open,
 * unexpired invitations matching the VERIFIED email redeem at the person's
 * next sign-in (not only first), with the same fences — single-use,
 * no-escalation re-check, same door/firm, email_verified required."*
 *
 * THE OWNER'S RULING, verbatim: *"Drop `name` from invitePartnerPerson's 201
 * (filled at redemption). Then mount it and build invitation redemption at
 * first sign-in."*
 *
 * This is the writer `db/migrations/0370` grants `INSERT` on
 * `tenant.partner_role_assignment` to, in the same commit (G511: *"the fence
 * and the writer are one commit or neither"*). Its one caller is
 * `mintFederatedSession()` — ⚠️ on EVERY mint since G2906, not only R5's
 * provisioning path as this said until then — INSIDE the sign-in
 * transaction — after the person is written and after the session is written,
 * so that `app.session_ref` names a session that exists and `0370` §3a can find
 * the person it belongs to.
 *
 * 🛑 ONE TRANSACTION WITH PROVISIONING, AND THAT IS G1637's PRECEDENT CARRIED
 *    ONE TABLE FURTHER. A redemption in its own transaction would leave an
 *    invitation unredeemed for a person whose sign-in committed — or, worse, an
 *    assignment for a person whose sign-in rolled back, which `resolveSubject()`
 *    would never reach and `listPartnerPeople` would show as a colleague.
 *
 * 🛑 A REFUSED REDEMPTION DOES NOT REFUSE THE SIGN-IN, AND THE SAVEPOINT IS
 *    WHAT MAKES THAT TRUE (G2809). The person authenticated, legitimately, at
 *    their own firm's door; an expired or stale offer is a fact about the
 *    OFFER. So a refusal rolls back to a savepoint, the person and the session
 *    stand, and the person reaches no portal operation — `decide()`'s fifth arm
 *    answers `partner_staff_assignment_absent`, which is the fail-closed
 *    direction for AUTHORITY. Refusing the sign-in instead would turn a stale
 *    invitation into a lock-out from a door the firm controls.
 *
 * ⚠️ NO `WHERE` ON THE INVITATION READ, AND THE ABSENCE IS THE CONTROL —
 *    `session-mint-store.ts`'s rule: *"each predicate somebody would add
 *    deletes a control."* `0370` §3a admits exactly the invitations whose firm
 *    owns this door and whose address is this person's; a `WHERE email = $1`
 *    here would make the address a value this statement CHOSE rather than one
 *    the database derived from the person row, and would still be satisfied
 *    with the policy dropped. And there is no expiry filter either: an expired
 *    offer reaches the TRIGGER and is refused BY NAME (`expired`), rather than
 *    vanishing into `none` where nobody could tell it from no invitation at all.
 *
 * Compiles under: tsc -p server/tsconfig.json --noEmit
 */
import { randomBytes } from 'node:crypto'

import type { ScopedClient } from '../../db/tenant-scope.ts'
import type { PartnerRoleAssignmentId } from '../../model/access.ts'
import type { PartnerId, RoleId, UserId } from '../../model/kernel.ts'
import {
  PARTNER_REDEMPTION_REFUSALS,
  type PartnerInvitationId,
  type PartnerRedemptionRefusal,
} from '../../model/partner-portal.ts'

export type PartnerRedemptionOutcome =
  /** No invitation stands for this person at this door's firm — the ordinary case. */
  | { readonly kind: 'none' }
  | {
      readonly kind: 'redeemed'
      readonly invitationId: PartnerInvitationId
      readonly assignmentId: PartnerRoleAssignmentId
      readonly partnerId: PartnerId
      readonly roleId: RoleId
    }
  | { readonly kind: 'refused'; readonly refusal: PartnerRedemptionRefusal }

export function mintPartnerRoleAssignmentId(): PartnerRoleAssignmentId {
  return `pra_${randomBytes(16).toString('hex')}` as PartnerRoleAssignmentId
}

/**
 * `0370` §3a is the whole narrowing. See the header.
 *
 * ⚠️ `assignment_expires_at` IS READ AS `text`, AND THAT IS A MEASUREMENT: read
 *    as a `timestamptz` it arrives as a JavaScript `Date`, which holds
 *    MILLISECONDS, and `now()` holds MICROSECONDS — so the value written back
 *    differed from the invitation's by up to 999µs and the trigger refused
 *    every honest redemption as `terms_disagree`. Text round-trips exactly.
 */
const OPEN_INVITATION_READ = `
  SELECT id, partner_id, role_id, role_version, invited_by,
         assignment_expires_at::text AS assignment_expires_at,
         expires_at > now()          AS standing
    FROM tenant.partner_invitation
   WHERE NOT EXISTS (
     SELECT 1 FROM tenant.partner_role_assignment a
      WHERE a.invitation_id = partner_invitation.id
   )
   ORDER BY expires_at DESC, id
`

/*
 * ⚠️ THE `NOT EXISTS` ABOVE IS G2907 AND IT IS NARROWER THAN IT LOOKS. It is
 * read BEFORE the redemption GUCs are set, so `0250`'s
 * `partner_role_assignment_rls` admits exactly the SESSION's person's own
 * assignments: an offer THIS person already redeemed drops out, and a later
 * sign-in answers `none` instead of `already_redeemed` on every visit for the
 * rest of the role's life. ANOTHER person's redemption of the same offer is
 * invisible here, so a second account at that address still reaches the
 * INSERT and is still refused BY NAME by `0370` §2's unique index — single
 * use is the index's, never this filter's.
 */

/**
 * EVERY COLUMN COPIED FROM THE INVITATION, AND THE TRIGGER CHECKS EACH COPY.
 * `granted_at` is the transaction's `now()` (§4's permissive policy pins it),
 * and `expires_at` is the invitation's `assignment_expires_at`, verbatim —
 * decided when the offer was made, never here.
 */
const ASSIGNMENT_INSERT = `
  INSERT INTO tenant.partner_role_assignment
    (id, partner_id, user_id, role_id, role_version, granted_by, granted_at,
     expires_at, revoked_at, invitation_id)
  VALUES ($1, $2, $3, $4, $5, $6, now(), $7, NULL, $8)
`

/** `0370` §4's messages lead with the refusal; the vocabulary is closed. */
const TRIGGER_REFUSALS: readonly PartnerRedemptionRefusal[] = [
  PARTNER_REDEMPTION_REFUSALS.notRedeemable,
  PARTNER_REDEMPTION_REFUSALS.emailUnverified,
  PARTNER_REDEMPTION_REFUSALS.expired,
  PARTNER_REDEMPTION_REFUSALS.termsDisagree,
  PARTNER_REDEMPTION_REFUSALS.self,
  PARTNER_REDEMPTION_REFUSALS.roleMoved,
  PARTNER_REDEMPTION_REFUSALS.inviterLacksVerb,
]

function refusalOf(err: unknown): PartnerRedemptionRefusal | null {
  const e = err as { code?: string; constraint?: string; message?: string }
  if (e.code === '23505' && e.constraint === 'partner_role_assignment_one_per_invitation') {
    return PARTNER_REDEMPTION_REFUSALS.alreadyRedeemed
  }
  if (e.code === '42501' && typeof e.message === 'string') {
    const head = e.message.split(':', 1)[0] ?? ''
    return TRIGGER_REFUSALS.find((r) => r === head) ?? null
  }
  return null
}

async function setRedemptionGucs(tx: ScopedClient, partnerId: string, inviter: string): Promise<void> {
  /* `set_config`, never `SET LOCAL` — `db/signin-scope.ts`'s argument: a value
   * read out of a row must bind as `$2`, never be interpolated. LOCAL, so it
   * reverts at COMMIT and the pooled connection carries nothing. */
  await tx.query('SELECT set_config($1, $2, true)', ['app.redeeming_partner', partnerId])
  await tx.query('SELECT set_config($1, $2, true)', ['app.redeeming_inviter', inviter])
}

/**
 * Redeem the one open invitation this sign-in's person may redeem, if any.
 *
 * MUST be called inside `withSignInScope()` with `sessionRef` set and the
 * session row already written — `0370` §3a reads the session to find the
 * person, and §4's permissive policy pins `user_id` to that session's person.
 */
export async function redeemPartnerInvitation(
  tx: ScopedClient,
  input: { readonly userId: UserId; readonly newAssignmentId: PartnerRoleAssignmentId },
): Promise<PartnerRedemptionOutcome> {
  const rows = (await tx.query(OPEN_INVITATION_READ)).rows as Array<Record<string, unknown>>
  if (rows.length === 0) return { kind: 'none' }
  /* G2903 — SINCE `0390` §3 AN ADDRESS MAY CARRY SEVERAL OFFERS, AT MOST ONE
   * STANDING. An expired offer no longer blocks re-inviting (G2811), so the
   * policy can show one live offer beside the lapsed ones it replaced. The
   * STANDING one is taken; with none standing the most recent lapsed one is
   * still ATTEMPTED, so the trigger refuses it BY NAME (`expired`) rather than
   * the sign-in reporting `none` — `0370`'s *"an expired offer is refused BY
   * NAME rather than vanishing"*, kept. This is not a choice between roles:
   * `0390` §3's trigger makes two STANDING offers to one address
   * unrepresentable, and two of them here is still a THROW. */
  const standing = rows.filter((r) => r['standing'] === true)
  if (standing.length > 1) {
    throw new Error(
      `redeemPartnerInvitation: ${standing.length} standing invitations are visible to one sign-in; ` +
        '0390 §3’s one-standing-offer trigger and 0370 §3a’s firm term cannot both be holding',
    )
  }
  const inv = (standing[0] ?? rows[0]) as Record<string, unknown>

  await setRedemptionGucs(tx, String(inv['partner_id']), String(inv['invited_by']))
  await tx.query('SAVEPOINT partner_redemption')
  try {
    await tx.query(ASSIGNMENT_INSERT, [
      input.newAssignmentId,
      inv['partner_id'],
      input.userId,
      inv['role_id'],
      inv['role_version'],
      inv['invited_by'],
      inv['assignment_expires_at'],
      inv['id'],
    ])
    await tx.query('RELEASE SAVEPOINT partner_redemption')
    return {
      kind: 'redeemed',
      invitationId: String(inv['id']) as PartnerInvitationId,
      assignmentId: input.newAssignmentId,
      partnerId: String(inv['partner_id']) as PartnerId,
      roleId: String(inv['role_id']) as RoleId,
    }
  } catch (err) {
    await tx.query('ROLLBACK TO SAVEPOINT partner_redemption')
    const refusal = refusalOf(err)
    if (refusal === null) throw err
    return { kind: 'refused', refusal }
  } finally {
    /* Narrow again before anything else runs in this transaction: §3b and §3c
     * open the inviter's roles and the firm's catalogue only while asked. */
    await setRedemptionGucs(tx, '', '').catch(() => undefined)
  }
}
