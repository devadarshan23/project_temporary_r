/**
 * A PARTNER FIRM'S OWN DIRECTORY, AND THE INVITATION WRITER — W5, 1 Oct 2026.
 * G2624 (THE OWNER'S, taking G447 for partners) and G2625–G2632.
 *
 * Both functions run INSIDE a portal act's transaction, after
 * `writePartnerAuthorisationRecord()` has written the act's record and named it
 * in `app.authorisation_ref`. That ordering is not a convention: it is the only
 * way either read returns a row. `db/migrations/0321` keys the directory, the
 * colleague's assignment, the role catalogue and the invitation table on THAT
 * record, so outside an act every query below reads EMPTY under G100.
 *
 * 🛑 THE FIRM COMES FROM THE GRANT AND THE `WHERE` IS A BELT, NOT THE BRACES.
 *    `readPartnerPeople()` filters on `grant.partnerId`, and the policy would
 *    narrow to the same firm without it — `tests/db/partner-directory.test.ts`
 *    §1 asserts the policy ALONE by reading with no `WHERE` at all. The filter
 *    is here because a reader that silently depended on RLS for the one fact
 *    the operation is about is a reader nobody can follow.
 *
 * ⚠️ AN OUTER JOIN, AND A NULL ON THE FAR SIDE IS A REFUSAL, NOT A SKIPPED ROW.
 *    The person and the role are each read through a different policy from
 *    the assignment's. If they ever disagreed, an inner join would DROP the
 *    colleague from the roster — a departed employee silently absent from the
 *    one page that exists to show who still holds a role. The reader answers
 *    `unreadable` and the operation a 500, loudly.
 */
import type { ScopedClient } from '../../db/tenant-scope.ts'
import type { PartnerAuthorizationGrant } from '../../model/access.ts'
import type { AuthorizationGrantId, PartnerId, RoleId, Timestamp, UserId } from '../../model/kernel.ts'
import {
  PARTNER_INVITATION_OFFER_SECONDS,
  PARTNER_INVITED_ROLE_SECONDS,
  PARTNER_INVITATION_STATE,
  partnerPersonState,
  type PartnerInvitableRoleKey,
  type PartnerInvitation,
  type PartnerInvitationId,
  type PartnerPersonState,
} from '../../model/partner-portal.ts'
import { randomBytes } from 'node:crypto'

function iso(value: unknown): Timestamp {
  return value instanceof Date ? value.toISOString() : String(value)
}

function isoOrNull(value: unknown): Timestamp | null {
  return value === null || value === undefined ? null : iso(value)
}

/* ------------------------------------------------------------------ *
 * §1 · THE ROSTER — `listPartnerPeople`.
 * ------------------------------------------------------------------ */

/** The wire's `PartnerPerson`, minus `reaches` — optional there, and nothing produces it. */
export interface PartnerPersonRow {
  readonly name: string
  readonly email: string
  readonly role: string
  readonly state: PartnerPersonState
}

/**
 * A STANDING, UNREDEEMED OFFER, in the 201's own shape — G2904, closing
 * G2808. No `name`, for G2807's reason: nothing produces one before the
 * invitee signs in.
 */
export interface InvitedPartnerPersonRow {
  readonly email: string
  readonly role: string
  readonly state: typeof PARTNER_INVITATION_STATE
}

export type PartnerPeopleOutcome =
  | {
      readonly ok: true
      readonly people: readonly PartnerPersonRow[]
      readonly invitations: readonly InvitedPartnerPersonRow[]
    }
  | { readonly ok: false; readonly refusal: 'partner_directory_unreadable' }

const PARTNER_PEOPLE_READ = `
  SELECT u.display_name AS name,
         u.email        AS email,
         r.label        AS role,
         a.revoked_at   AS revoked_at,
         a.expires_at   AS expires_at
    FROM tenant.partner_role_assignment a
    LEFT JOIN tenant."user"       u ON u.id = a.user_id
    LEFT JOIN tenant.partner_role r ON r.id = a.role_id AND r.partner_id = a.partner_id
   WHERE a.partner_id = $1
   ORDER BY u.display_name, a.id
`

/**
 * THE OPEN OFFERS — G2904. Read inside the SAME act as the roster, through
 * `0321`'s `partner_invitation_read_rls` (the act's `view_partner_staff` or
 * `manage_partner_staff` record names the firm), so nothing new is opened.
 *
 * 🛑 BOTH TERMS ARE WHAT "PENDING" MEANS AND EACH WAS CHOSEN OVER A WIDER
 *    READING. `expires_at > now()`: a lapsed offer offers nothing, and listing
 *    it as `invited` would assert a standing that `0370`'s trigger refuses.
 *    `NOT EXISTS` an assignment carrying it: a redeemed offer's person is in
 *    `people`, and listing them twice is a roster that disagrees with itself.
 *    ⚠️ The `NOT EXISTS` reads assignments under the SAME act, which `0321`
 *    opens for the whole firm — so a colleague's redemption is visible here
 *    and cannot be mistaken for an open offer.
 *
 * ⚠️ `now()` AND NOT `grant.issuedAt`: the people's states are derived from
 *    the act's own instant in TypeScript, and this filter runs in the same
 *    transaction that minted that instant — the two agree to within one
 *    statement, and the database clock is the one `0370`'s trigger judges by.
 */
const OPEN_INVITATIONS_READ = `
  SELECT i.email AS email,
         r.label AS role
    FROM tenant.partner_invitation i
    LEFT JOIN tenant.partner_role r ON r.id = i.role_id AND r.partner_id = i.partner_id
   WHERE i.partner_id = $1
     AND i.expires_at > now()
     AND NOT EXISTS (
       SELECT 1 FROM tenant.partner_role_assignment a WHERE a.invitation_id = i.id
     )
   ORDER BY lower(i.email), i.id
`

export async function readPartnerPeople(
  tx: ScopedClient,
  grant: PartnerAuthorizationGrant,
): Promise<PartnerPeopleOutcome> {
  const rows = (await tx.query(PARTNER_PEOPLE_READ, [grant.partnerId])).rows as Array<
    Record<string, unknown>
  >
  const people: PartnerPersonRow[] = []
  for (const row of rows) {
    const name = row['name']
    const email = row['email']
    const role = row['role']
    if (typeof name !== 'string' || typeof email !== 'string' || typeof role !== 'string') {
      return { ok: false, refusal: 'partner_directory_unreadable' }
    }
    people.push({
      name,
      email,
      role,
      state: partnerPersonState(
        { revokedAt: isoOrNull(row['revoked_at']), expiresAt: iso(row['expires_at']) },
        grant.issuedAt,
      ),
    })
  }
  const offers = (await tx.query(OPEN_INVITATIONS_READ, [grant.partnerId])).rows as Array<
    Record<string, unknown>
  >
  const invitations: InvitedPartnerPersonRow[] = []
  for (const row of offers) {
    const email = row['email']
    const role = row['role']
    if (typeof email !== 'string' || typeof role !== 'string') {
      return { ok: false, refusal: 'partner_directory_unreadable' }
    }
    invitations.push({ email, role, state: PARTNER_INVITATION_STATE })
  }
  return { ok: true, people, invitations }
}

/* ------------------------------------------------------------------ *
 * §2 · THE INVITATION — `invitePartnerPerson`'s writer. G2629/G2630, and
 *      since 2 Oct 2026 G2801's: MOUNTED.
 *
 * ✅ **REACHED BY A ROUTE SINCE 2 Oct 2026 — THE OWNER'S RULING, G2801.** ⚠️
 *    THIS READ *"REACHED BY NO ROUTE, and that is G2630 rather than an
 *    oversight: the 201 is a `PartnerPerson` and `name` is `required` there,
 *    while the request carries no name"* AND IS CORRECTED RATHER THAN DELETED.
 *    The 201 is an `InvitedPartnerPerson` now, which carries no `name` — it is
 *    *"filled at redemption"* — and `partner-portal.ts` mounts this writer.
 *
 * 🛑 THE TWO CLOCKS ARE THE DATABASE'S AND THE NUMBERS ARE THE MODEL'S (G2803).
 *    `now()` is the transaction's — `0370` §1's restrictive policy pins
 *    `invited_at` to it — and the two intervals are bound from
 *    `PARTNER_INVITATION_OFFER_SECONDS` and `PARTNER_INVITED_ROLE_SECONDS`,
 *    which `0370`'s CHECKs mirror and a test holds equal. The offer also
 *    carries the act's own record id, which `0370` pins to
 *    `app.authorisation_ref`.
 * ------------------------------------------------------------------ */

export const PARTNER_INVITATION_REFUSALS = {
  /** No ACTIVE role with that key in the firm's catalogue. 422. */
  roleNotOffered: 'partner_role_not_offered',
  /** An invitation to that address already stands in this firm. 422. */
  alreadyInvited: 'partner_person_already_invited',
  /**
   * `0321` §5 refused the row: the role confers a verb the inviter does not
   * hold live, or the address is the inviter's own. 403 — the caller is not
   * permitted to confer it, which is what `AdministratorOnly` says.
   */
  notPermitted: 'partner_invitation_not_permitted',
} as const
export type PartnerInvitationRefusal =
  (typeof PARTNER_INVITATION_REFUSALS)[keyof typeof PARTNER_INVITATION_REFUSALS]

export type PartnerInvitationOutcome =
  | {
      readonly ok: true
      readonly invitation: PartnerInvitation
      /** The role's LABEL, for the 201's `role` — the roster's own field (`r.label`). */
      readonly roleLabel: string
    }
  | { readonly ok: false; readonly refusal: PartnerInvitationRefusal }

export function mintPartnerInvitationId(): PartnerInvitationId {
  return `pinv_${randomBytes(16).toString('hex')}` as PartnerInvitationId
}

/**
 * 🛑 A SAVEPOINT AROUND THE INSERT, AND IT IS WHAT KEEPS INVARIANT 10's RECORD.
 *    A refused `INSERT` aborts the transaction; the act's record was written
 *    earlier in it, and `COMMIT` on an aborted transaction is a silent
 *    `ROLLBACK`. Without the savepoint an authorised attempt that the database
 *    refused would leave no record at all — the act happened (it was tried, and
 *    refused at the row), so the record must stand.
 */
export async function writePartnerInvitation(
  tx: ScopedClient,
  grant: PartnerAuthorizationGrant,
  request: { readonly email: string; readonly role: PartnerInvitableRoleKey },
): Promise<PartnerInvitationOutcome> {
  const role = (
    await tx.query(
      `SELECT id, version, label FROM tenant.partner_role
        WHERE partner_id = $1 AND key = $2 AND status = 'active'`,
      [grant.partnerId, request.role],
    )
  ).rows[0] as { id: string; version: number; label: string } | undefined
  if (role === undefined) return { ok: false, refusal: PARTNER_INVITATION_REFUSALS.roleNotOffered }

  const id = mintPartnerInvitationId()
  await tx.query('SAVEPOINT partner_invitation')
  try {
    const row = (
      await tx.query(
        `INSERT INTO tenant.partner_invitation
           (id, partner_id, email, role_id, role_version, invited_by, invited_at,
            expires_at, assignment_expires_at, authorization_id)
         VALUES ($1, $2, $3, $4, $5, $6, now(),
                 now() + make_interval(secs => $7),
                 now() + make_interval(secs => $8),
                 $9)
         RETURNING invited_at, expires_at, assignment_expires_at`,
        [
          id,
          grant.partnerId,
          request.email,
          role.id,
          role.version,
          grant.subjectUserId,
          PARTNER_INVITATION_OFFER_SECONDS,
          PARTNER_INVITED_ROLE_SECONDS,
          grant.id,
        ],
      )
    ).rows[0] as { invited_at: unknown; expires_at: unknown; assignment_expires_at: unknown }
    await tx.query('RELEASE SAVEPOINT partner_invitation')
    return {
      ok: true,
      invitation: {
        id,
        partnerId: grant.partnerId as PartnerId,
        email: request.email,
        roleId: role.id as RoleId,
        roleVersion: role.version,
        invitedBy: grant.subjectUserId as UserId,
        invitedAt: iso(row.invited_at),
        expiresAt: iso(row.expires_at),
        assignmentExpiresAt: iso(row.assignment_expires_at),
        authorizationId: grant.id as AuthorizationGrantId,
      },
      roleLabel: role.label,
    }
  } catch (err) {
    await tx.query('ROLLBACK TO SAVEPOINT partner_invitation')
    const code = (err as { code?: string }).code
    if (code === '23505') return { ok: false, refusal: PARTNER_INVITATION_REFUSALS.alreadyInvited }
    if (code === '42501') return { ok: false, refusal: PARTNER_INVITATION_REFUSALS.notPermitted }
    throw err
  }
}
