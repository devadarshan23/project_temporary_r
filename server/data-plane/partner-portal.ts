/**
 * THE PARTNER PORTAL'S FIRST MOUNTS — W5, 1 Oct 2026, G2633–G2640.
 *
 * FIVE OPERATIONS, each passing G300's four-part test — table AND model AND
 * capability AND an invariant 10 record — for the first time:
 *
 *   operation               verb (R10)           table (0321/0322)          record
 *   listDealRegistrations   view_deals           deal_registration          0320
 *   submitDealRegistration  register_deal        deal_registration          0320
 *   getSandboxTenant        view_sandbox         partner_sandbox            0320
 *   requestSandboxTenant    operate_sandbox      partner_sandbox_request    0320
 *   listPartnerPeople       view_partner_staff   "user" via 0321 §1–§3      0320
 *
 * 🛑 EVERY ONE IS ANSWERED ON `decide()`'s FIFTH ARM AND NONE OF THEM READS A
 *    TENANT. The arm is entered only for a `PARTNER_ONLY_RESOURCE_CLASSES` verb
 *    and reads `partnerHeld` ALONE; a partner's `PartnerAccessGrant` — invariant
 *    2's ONE cross-tenant path — is never consulted and cannot satisfy these,
 *    and a portal role cannot satisfy a tenant act. The bodies receive a SESSION
 *    scope (`authorisedHandler()`'s partner branch), in which `app.tenant_id` is
 *    unset and every tenant-scoped table reads EMPTY under G100.
 *    `tests/http/partner-portal-served.test.ts` §5 asserts the single path
 *    survives: these mounts give a partner nothing inside a customer tenant.
 *
 * ✅ AND A SIXTH SINCE 2 Oct 2026 — `invitePartnerPerson`, on
 *    `manage_partner_staff`, THE OWNER'S RULING (G2801): *"Drop `name` from
 *    invitePartnerPerson's 201 (filled at redemption). Then mount it and build
 *    invitation redemption at first sign-in."* Its table is `0321` §4 as
 *    widened by `0370` §1, its record `0320`.
 *
 * ⚠️ THREE PARTNER-PORTAL-ROLE OPERATIONS ARE ANNOTATED AND NOT MOUNTED, EACH
 *    FOR A NAMED REASON RATHER THAN A BACKLOG — see `start.ts`. ⚠️ THIS SAID
 *    FOUR, AND THE FOURTH WAS `invitePartnerPerson` (G2630, *"`name` is
 *    `required` on its 201 and has no producer"*), WHICH THE RULING ABOVE
 *    DISCHARGED. The three: `requestTrialTenant` (G2639, its only reachable
 *    answer is its own 422 — G359), `handBackSandboxTenant` and
 *    `resetSandboxTenant` (G2640, each asserts an act on a provisioned plane —
 *    *"Torn down"*, a restored seed — that no process in this repository can
 *    perform).
 */
import type { FastifyRequest } from 'fastify'

import type { PartnerAuthorizationGrant } from '../../model/access.ts'
import {
  DEAL_SHAPE_REFUSALS,
  PARTNER_INVITATION_STATE,
  type DealRegistrationFields,
  type DealShape,
  type PartnerInvitableRoleKey,
} from '../../model/partner-portal.ts'
import { parseMoneyWire } from '../../model/money.ts'
import { sendProblem } from '../http/app.ts'
import { CODES } from '../http/problem.ts'
import type {
  AnyAuthorizationGrant,
  AuthorisedBody,
  AuthorisedOperation,
} from './authorisation-record.ts'
import {
  DEAL_SUBMISSION_REFUSALS,
  readDealRegistrations,
  readSandbox,
  requestSandbox,
  submitDealRegistration,
} from './partner-portal-store.ts'
import {
  PARTNER_INVITATION_REFUSALS,
  readPartnerPeople,
  writePartnerInvitation,
} from './partner-staff-store.ts'

/**
 * The partner home's grant, or a THROW. `actingTenantOf()`'s polarity: the
 * capability is partner-only, so `authorize()` cannot have minted any other
 * home — reaching another one is a broken invariant between two functions, and
 * a 500 with a stack trace is the honest answer, not a 403.
 */
export function partnerGrantOf(grant: AnyAuthorizationGrant, operationId: string): PartnerAuthorizationGrant {
  if (grant.home !== 'partner') {
    throw new Error(
      `${operationId}: a partner-only verb was recorded in the ${grant.home} home. ` +
        '`authorize()` keys the third home on `capabilityIsPartnerOnly()`, the same test ' +
        'the fifth arm dispatches on; they cannot disagree unless one of them changed.',
    )
  }
  return grant
}

function unreadable(reply: Parameters<AuthorisedBody>[0]['reply'], operationId: string, why: string): unknown {
  console.error(`data-plane: \`${operationId}\` — ${why}`)
  return sendProblem(reply, {
    status: 500,
    code: CODES.upstreamUnavailable,
    title: 'This could not be read.',
    detail: 'A record could not be read. The reason is in this plane’s log.',
  })
}

/* ------------------------------------------------------------------ *
 * DEALS.
 * ------------------------------------------------------------------ */

export function listDealRegistrationsOperation(): AuthorisedOperation {
  return {
    operationId: 'listDealRegistrations',
    resourceType: 'DealRegistration',
    instanceOf: () => null,
    body: async ({ request, tx, grant }) => {
      const q = request.query as Record<string, unknown> | undefined
      const standing = typeof q?.['standing'] === 'string' ? q['standing'] : null
      return {
        registrations: await readDealRegistrations(
          tx,
          partnerGrantOf(grant, 'listDealRegistrations'),
          standing,
        ),
      }
    },
  }
}

/**
 * The body, as the model's fields — or `null` when the deal's value is refused
 * by the money codec itself (G3561: *"through the money codec (model/money.ts,
 * G111)"*). `parseMoneyWire()` is the ONLY conversion from the wire's decimal
 * string to the model's `bigint`; nothing here reads `amountMinor` as a number.
 */
function dealFieldsOf(request: FastifyRequest): DealRegistrationFields | null {
  /* ajv has run: `shape` is one of the enum, `company` is a string,
   * `annualValue` is `DealValue`'s three fields, and `additionalProperties:
   * false` REJECTED anything else (G191). */
  const b = request.body as Record<string, unknown>
  const str = (k: string): Record<string, string> =>
    typeof b[k] === 'string' ? { [k]: b[k] as string } : {}
  const wire = b['annualValue'] as { currency: string; amountMinor: string; exponent: number } | undefined
  let value: Record<string, never> | { annualValue: NonNullable<DealRegistrationFields['annualValue']> } = {}
  if (wire !== undefined) {
    const parsed = parseMoneyWire(wire)
    if (!parsed.ok) return null
    value = { annualValue: parsed.value }
  }
  return {
    shape: b['shape'] as DealShape,
    company: b['company'] as string,
    ...value,
    ...str('expectedClose'),
    ...str('contact'),
    ...str('rationale'),
    ...(Array.isArray(b['resaleScope']) ? { resaleScope: b['resaleScope'] as string[] } : {}),
  }
}

export function submitDealRegistrationOperation(): AuthorisedOperation {
  return {
    operationId: 'submitDealRegistration',
    resourceType: 'DealRegistration',
    instanceOf: () => null,
    body: async ({ request, reply, tx, grant }) => {
      const fields = dealFieldsOf(request)
      if (fields === null) {
        return sendProblem(reply, {
          status: 422,
          code: CODES.validationFailed,
          title: 'That registration could not be received.',
          detail: 'The deal value is not an amount of money the codec can hold.',
        })
      }
      const out = await submitDealRegistration(
        tx,
        partnerGrantOf(grant, 'submitDealRegistration'),
        fields,
      )
      if (out.ok) {
        /* 202 AND NOT 201 — *"It is a request until we accept it."* */
        reply.code(202)
        return { receivedAt: out.receivedAt, standing: out.standing }
      }
      if (out.refusal === DEAL_SUBMISSION_REFUSALS.rowRefused) {
        return unreadable(reply, 'submitDealRegistration', 'the deal row was refused by 0322’s write policy after the gate allowed the act')
      }
      /* The contract's own 422 holds two arms behind one code — a body that does
       * not satisfy its shape, and a company on which a claim already stands —
       * and names the second as a gap in `errors.yaml` rather than inventing a
       * code. The detail does not say WHOSE claim; no field could. */
      return sendProblem(reply, {
        status: 422,
        code: CODES.validationFailed,
        title: 'That registration could not be received.',
        detail:
          out.refusal === DEAL_SUBMISSION_REFUSALS.companyAlreadyClaimed
            ? 'A claim on that company already stands.'
            : out.refusal === DEAL_SHAPE_REFUSALS.valueNotPositive
              ? 'A deal value must be a positive amount, with its currency.'
              : 'The fields do not match the chosen shape: a deal carries a value and a close date, a customer claim a rationale and a resale scope.',
      })
    },
  }
}

/* ------------------------------------------------------------------ *
 * THE SANDBOX.
 * ------------------------------------------------------------------ */

export function getSandboxTenantOperation(): AuthorisedOperation {
  return {
    operationId: 'getSandboxTenant',
    resourceType: 'PartnerSandbox',
    instanceOf: () => null,
    body: async ({ tx, grant }) => readSandbox(tx, partnerGrantOf(grant, 'getSandboxTenant')),
  }
}

export function requestSandboxTenantOperation(): AuthorisedOperation {
  return {
    operationId: 'requestSandboxTenant',
    resourceType: 'PartnerSandbox',
    instanceOf: () => null,
    body: async ({ reply, tx, grant }) => {
      const out = await requestSandbox(tx, partnerGrantOf(grant, 'requestSandboxTenant'))
      if (out.ok) {
        /* *"Requested. A person provisions it."* No body is declared. The empty
         * string is returned rather than `reply.send()` so the response leaves
         * AFTER the act's transaction commits — `authorisedHandler()` hands the
         * body's value to Fastify only once `withSessionScope()` returns. */
        reply.code(202)
        return ''
      }
      if (out.refusal === 'sandbox_already_stands') {
        return sendProblem(reply, {
          status: 409,
          code: CODES.idempotencyConflict,
          title: 'A sandbox already stands.',
          detail: 'One sandbox per partner: one is live or has already been asked for.',
        })
      }
      return unreadable(reply, 'requestSandboxTenant', 'the sandbox request was refused by 0322’s write policy after the gate allowed the act')
    },
  }
}

/* ------------------------------------------------------------------ *
 * PEOPLE — the owner's ruling, G2624.
 * ------------------------------------------------------------------ */

export function listPartnerPeopleOperation(): AuthorisedOperation {
  return {
    operationId: 'listPartnerPeople',
    resourceType: 'PartnerPerson',
    instanceOf: () => null,
    body: async ({ reply, tx, grant }) => {
      const out = await readPartnerPeople(tx, partnerGrantOf(grant, 'listPartnerPeople'))
      if (!out.ok) {
        return unreadable(reply, 'listPartnerPeople', `${out.refusal}: a colleague’s assignment was visible and their person or role was not — 0321’s four policies disagree`)
      }
      return { people: out.people, invitations: out.invitations }
    },
  }
}

/**
 * `invitePartnerPerson` — G2801, THE OWNER'S RULING. ⚠️ G2630 HELD THIS BACK:
 * its 201 was a `PartnerPerson` whose `name` nothing produces. The 201 is an
 * `InvitedPartnerPerson` now and every one of its three `required` fields has
 * a producer here — `email` (the request's, verbatim), `role` (the role's
 * label, read by the writer) and `state` (`invited`, a constant: nobody has
 * signed in when this answers).
 *
 * THE THREE REFUSALS, MAPPED ONTO THE CONTRACT'S OWN CODES:
 *   · `partner_role_not_offered`  → 422: the firm's catalogue has no active
 *     role with that key — a fact about the BODY.
 *   · `partner_person_already_invited` → 422: one STANDING offer per address
 *     per firm (`0390` §3's trigger). ✅ AN EXPIRED ONE NO LONGER COUNTS —
 *     G2903, closing G2811. ⚠️ This read *"`0321`'s index. INCLUDING AN EXPIRED
 *     ONE — G2811, named: … an address whose offer lapsed cannot be invited
 *     again until a lifecycle writer exists"* and is corrected rather than
 *     deleted: the index is dropped, and a lapsed offer stops blocking at the
 *     instant it stops offering.
 *   · `partner_invitation_not_permitted` → 403, `AdministratorOnly`: `0321` §5
 *     refused the row — the role confers a verb the inviter does not hold, or
 *     the address is their own. The caller passed the gate and is still not
 *     permitted to confer THIS role.
 */
export function invitePartnerPersonOperation(): AuthorisedOperation {
  return {
    operationId: 'invitePartnerPerson',
    resourceType: 'PartnerInvitation',
    instanceOf: () => null,
    body: async ({ request, reply, tx, grant }) => {
      /* ajv has run: `email` is a string and `role` one of the enum's two —
       * `partner delivery` is not invitable, by the schema (G191). */
      const b = request.body as { email: string; role: PartnerInvitableRoleKey }
      const out = await writePartnerInvitation(tx, partnerGrantOf(grant, 'invitePartnerPerson'), {
        email: b.email,
        role: b.role,
      })
      if (out.ok) {
        reply.code(201)
        return { email: out.invitation.email, role: out.roleLabel, state: PARTNER_INVITATION_STATE }
      }
      if (out.refusal === PARTNER_INVITATION_REFUSALS.notPermitted) {
        return sendProblem(reply, {
          status: 403,
          code: CODES.capabilityNotHeld,
          title: 'You may not invite into that role.',
          detail: 'An invitation may confer only verbs its inviter holds, and never to the inviter’s own address.',
        })
      }
      return sendProblem(reply, {
        status: 422,
        code: CODES.validationFailed,
        title: 'That invitation could not be made.',
        detail:
          out.refusal === PARTNER_INVITATION_REFUSALS.alreadyInvited
            ? 'An invitation to that address already stands in this firm.'
            : 'This firm offers no active role of that kind.',
      })
    },
  }
}
