/**
 * CONFERRING A CAPABILITY — `grantRoleAssignment`, the operation `0009` refused
 * to grant a privilege for and G449 and G511 each declined to build alone.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS FILE IS THE OTHER HALF OF `db/migrations/0020_capability_granting.sql`
 *    AND NEITHER MAY LAND WITHOUT THE OTHER. READ THAT FILE'S HEADER FIRST.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * G511's disposition, quoted rather than paraphrased: *"The fence and the
 * writer are one commit or neither."* The fence is a `GRANT INSERT ON
 * tenant.role_assignment` plus a restrictive policy; this is the writer. **If
 * this operation is ever deleted, the `GRANT` goes with it in the same
 * commit**, or `0009`'s refusal becomes true again — *"a request path that
 * could write `role_assignment` could grant itself any capability in the closed
 * set, and `decide()` would then permit it CORRECTLY."*
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 FOUR CONTROLS STAND BETWEEN A REQUEST AND A ROW, AND THEY ARE NOT FOUR
 *    COPIES OF ONE CHECK. EACH ANSWERS A DIFFERENT QUESTION.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   1 · THE GATE — `server/http/app.ts`'s `preValidation` hook, `decide()`.
 *       *"May this caller perform `manage_roles` at all?"* A caller who is not
 *       an administrator never reaches this file.
 *   2 · THE RECORD — `authorisedHandler()` mints invariant 10's
 *       `AuthorizationGrant` through `authorize()` and writes it INSIDE this
 *       act's transaction. Nothing below runs until that row exists, and
 *       `mountTier()`'s sixth boot fence means an operation that stopped
 *       minting would not START rather than serve unrecorded.
 *   3 · `canGrant()` — `model/access.ts`. *"Is this ROW an escalation?"* It
 *       loops every capability of the conferred role, refuses
 *       `granter_lacks_capability` on the first one the granter does not hold,
 *       refuses `self_grant_forbidden`, and refuses a non-customer on either
 *       side. **The no-escalation rule is the model's and this file calls it;
 *       it does not re-implement one.**
 *   4 · `role_assignment_grant_restrictive` — `db/migrations/0020`. The same
 *       question again, in SQL, against the row as written.
 *
 * ⚠️ 3 AND 4 ARE A DELIBERATE DUPLICATION AND `0020`'s HEADER ARGUES IT AT
 * LENGTH. The short form: §5.3's copies are each NECESSARY, so the two must
 * agree or the control breaks; **these two are each SUFFICIENT**, so they may
 * disagree only by one being stricter, and a stricter database is a refused
 * write. They DO disagree, in both directions, and the file says which way:
 * the model additionally checks organisation and scope, which SQL cannot see;
 * the database additionally reads capability rows the model's closed set does
 * not name, which the model drops. **A row must pass both.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT THIS OPERATION CANNOT DO, AND EVERY ONE IS A PRIVILEGE THE MIGRATION
 *    DELIBERATELY WITHHELD RATHER THAN A FEATURE NOBODY GOT ROUND TO.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   · **IT CANNOT AUTHOR A ROLE.** No `INSERT` on `tenant.role` and none on
 *     `tenant.role_capability`. Composing capabilities into roles is
 *     `install_pack` and a pack is a platform release —
 *     `CAPABILITIES`' own declaration: *"A pack composes these into roles and
 *     can never introduce one."* A path that could write `role_capability`
 *     could add a verb to a role the granter ALREADY HOLDS, which widens their
 *     own authority with no conferral at all and which control 4 does not look
 *     at.
 *   · **IT CANNOT REVOKE.** No `UPDATE`, no `DELETE`. Revocation is a second
 *     operation with a second policy — it needs a `USING` clause, which this
 *     one deliberately does not have — and it is OWED rather than done.
 *   · **IT CANNOT NARROW.** `AssignmentScope` has SIX dimensions and `0009`'s
 *     scope note records that NONE of them has a column. Every assignment this
 *     writes carries `DENY_ALL`, which is what every assignment this database
 *     can produce already carries, and `decide()` returns that scope on an
 *     allow. **So a conferral is a VERB and never a DIMENSION** — G289's
 *     sentence about the platform arm, arriving here for a different reason.
 *   · **IT CANNOT CONFER TO A PERSON WHO IS NOT ALREADY A MEMBER.** The
 *     directory `0018` opened is *live members of this tenant*, so the target
 *     must already belong. There is no invitation path and `InvitationId` is
 *     `@dropped-for-v1`.
 *
 * ⚠️ AND TWO THINGS NOTHING HERE CLOSES, CARRIED FORWARD FROM G449 AND G511
 * WORD FOR WORD BECAUSE UNDERSTATING THEM WOULD BE THE WORST THING THIS FILE
 * COULD DO:
 *
 *   · **LATERAL SPREAD BY TWO COLLUDING HOLDERS** — each confers what it holds
 *     and the pair ends holding the union. That is a property of delegation
 *     itself; no expression in `model/` or in SQL can refuse it.
 *   · **A SINGLE COMPROMISED HOLDER OF `manage_roles` CREATING PERSISTENCE** —
 *     they gain no verb, and they may hand a second account everything they
 *     have, which survives the first account being disabled.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ THE BOOTSTRAP IS NOT CLOSED BY THIS FILE AND IS NAMED RATHER THAN IMPLIED.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * No-escalation means a conferral can only move authority that somebody already
 * holds. **So the FIRST holder of any capability in a tenant cannot arrive
 * through this operation, by construction.** Today that first holder is a
 * migrator-written seed — `server/dev/identity-seed.ts`, behind G192's flag —
 * and the real answer is tenant onboarding, which nothing in this repository
 * builds. This operation makes the SECOND holder reachable through the gate,
 * which is exactly what it claims and no more.
 */

import { randomBytes } from 'node:crypto'

import type { FastifyRequest } from 'fastify'

import {
  DENY_ALL,
  canGrant,
  orgFor,
  type OrgClass,
} from '../../model/access.ts'
import type { ScopedClient } from '../../db/tenant-scope.ts'
import { sendProblem } from '../http/app.ts'
import { CODES } from '../http/problem.ts'
import type { AuthorisedBody, AuthorisedOperation } from './authorisation-record.ts'
import { readPersonInDirectory, readRoleById } from './identity.ts'

/**
 * A fresh `RoleAssignmentId`.
 *
 * ⚠️ IT IS `mintAuthorizationGrantId()`'s SHAPE AND ITS ARGUMENT, COPIED
 * DELIBERATELY RATHER THAN SHARED. G97 — *"every branded id is `text`; the slug
 * is stored VERBATIM. THERE IS NO `uuid` ANYWHERE IN THIS MODEL"* — and the
 * prefix is the one `db/migrations/0009` already uses for this table
 * (`ras_mei_approver` in the seed). A shared helper would need a prefix
 * parameter, and a mint-an-id-of-any-kind function is the thing a later reader
 * points at a table nobody argued about.
 *
 * 🛑 `randomBytes` AND NOT `Math.random()`, for the reason the grant id gives:
 * possession of this id confers nothing, but it is a PRIMARY KEY, and a
 * predictable one lets anybody who can write a row choose which act they
 * collide with. There is no `ON CONFLICT` on the `INSERT`, so a collision is
 * an error a person sees rather than a silent no-op.
 */
function mintRoleAssignmentId(): string {
  return `ras_${randomBytes(16).toString('hex')}`
}

/**
 * The sentence a refusal carries, and it names nothing about the request.
 *
 * 🛑 IT IS `UNAUTHORISED_DETAIL`'s ARGUMENT APPLIED TO A NARROWER SURFACE, AND
 * THE SURFACE IS WHY IT MATTERS MORE HERE THAN ANYWHERE ELSE SO FAR. A refusal
 * that said *"you do not hold `approve_resolution`"* would turn this operation
 * into **a roster oracle for the granter's own authority**, readable by anybody
 * who can reach it: try each role in turn and the refusals enumerate exactly
 * which verbs the administrator holds. `GrantDecision.reason` is a closed
 * vocabulary and `GrantDecision.capability` names the offending verb — both go
 * to the process log, which is the one reader entitled to them, and neither
 * crosses the wire.
 *
 * ⚠️ AND THE SAME CONSTANT COVERS EVERY ARM ON PURPOSE. `self_grant_forbidden`
 * looks harmless to disclose and is not: distinguishing it from
 * `granter_lacks_capability` tells a caller which of the two checks it tripped,
 * and a caller who can tell those apart can binary-search the other.
 */
const GRANT_REFUSED_DETAIL =
  'This conferral was refused. A role may be conferred only by a person who already holds ' +
  'every capability it carries, never to themselves, and only within one tenant.'

/** The target of the conferral. Validated by ajv before this runs. */
function targetUserIdOf(request: FastifyRequest): string {
  return (request.params as { userId: string }).userId
}

/**
 * ⚠️ `resourceId` IS THE TARGET PERSON AND NOT THE ROLE, AND THE CHOICE IS AN
 * AUDIT DECISION RATHER THAN A CONVENIENCE. `ResourceRef.resourceId` is *"the
 * instance this act is bound to"*, and the instance an auditor asks about is
 * *"who was given authority"*. The role is recoverable from the assignment row
 * this act writes; the person is the subject of the question.
 *
 * 🛑 AND IT IS THE PATH PARAMETER, READ AFTER AJV, WHICH IS THE ONLY REASON
 * READING A REQUEST HERE IS SAFE — `AuthorisedOperation.instanceOf`'s own rule:
 * *"a path parameter here is one the contract's own schema admitted. It is
 * still never PARSED — the value is stored verbatim."*
 */
const grantRoleAssignmentBody: AuthorisedBody = async ({ request, reply, tx, principal }) => {
  const targetUserId = targetUserIdOf(request)
  const body = request.body as { readonly roleId: string; readonly expiresAt: string | null }

  /* --- The target, out of G506's directory. --- */
  const person = await readPersonInDirectory(tx, targetUserId)
  if (!person.ok) return unpublishableSubstrate(reply, 'user', person.refusal)
  if (person.rows === null) return noSuchTarget(reply)

  /**
   * 🛑 THE ORGANISATION IS DERIVED FROM THE DOOR AND FROM NOTHING ELSE, WHICH
   * IS G449's ENTIRE BLOCKER, CLOSED. `model/access.ts` is emphatic that
   * `orgClass` has one source — `orgFor(connection.owner)`, *"never a
   * membership and never the route"* — and the tempting repair here is the
   * worst available: the target HAS a membership (the directory would not have
   * returned them otherwise), so `orgClass: 'customer'` looks free. It is
   * G289's trap in the TARGET position, and `Membership.partnerScope` exists
   * precisely because partner-scoped memberships do.
   */
  const targetOrg: OrgClass = orgFor(person.rows.connection.owner)

  /* --- The role being conferred, with the verbs it carries. --- */
  const conferred = await readRoleById(tx, body.roleId)
  if (!conferred.ok) return unpublishableSubstrate(reply, 'role', conferred.refusal)
  if (conferred.role === null) return noSuchRole(reply)

  /**
   * 🛑 CONTROL 3. ONE CALL SITE, AND THE PRINCIPAL IS THE SEAM'S OWN — the
   * object `authorize()` already evaluated `decide()` against, handed down on
   * `AuthorisedContext` under G512 rather than resolved a second time here.
   * Two resolutions of one principal inside one act is the split
   * `model/access.ts` calls *"the structural precondition for a confused
   * deputy."*
   *
   * ⚠️ `scope: DENY_ALL` IS THE VALUE THIS DATABASE CAN PRODUCE AND IS NOT A
   * PLACEHOLDER. `0009`'s scope note: the columns do not exist, `DENY_ALL` is
   * the SAFE filler, and every assignment `readHeldAssignments()` returns
   * carries it — so `scopeIsNarrowerOrEqual(DENY_ALL, DENY_ALL)` is the
   * comparison being made and it is an honest one. **The day scope columns
   * land, the scope comes from the request and this line is where it arrives.**
   */
  const verdict = canGrant(principal, {
    userId: person.rows.user.id,
    orgClass: targetOrg,
    role: conferred.role,
    scope: DENY_ALL,
  })
  if (!verdict.allowed) {
    console.error(
      `data-plane: \`grantRoleAssignment\` refused — \`${verdict.reason}\`` +
        `${verdict.capability === null ? '' : ` on \`${verdict.capability}\``}. ` +
        `Granter \`${principal.subject.userId}\`, target \`${targetUserId}\`, role ` +
        `\`${body.roleId}\` in tenant \`${principal.tenantId}\`. The caller was told only ` +
        'that the conferral was refused.',
    )
    return sendProblem(reply, {
      status: 403,
      code: CODES.capabilityNotHeld,
      title: 'That conferral is not permitted.',
      detail: GRANT_REFUSED_DETAIL,
    })
  }

  /**
   * 🛑 THE PIN IS THE ROLE'S CURRENT VERSION, READ IN THIS TRANSACTION, AND IT
   * IS NOT A REQUEST FIELD. `RoleAssignment.roleVersion` is *"PINNED. A widened
   * role is a NEW version and needs consent"* — so a caller-supplied pin would
   * let somebody confer a role AS IT WAS, which is authority over a definition
   * nobody is looking at. `db/migrations/0020`'s own term requires the pin to
   * match, so a stale read here is a refused write rather than a wrong row.
   *
   * ⚠️ `granted_by` IS THE PRINCIPAL AND NOT THE REQUEST, AND THE DATABASE
   * CHECKS IT AGAINST THE ACT'S OWN AUTHORISATION RECORD. Forging it is term 1
   * of the fence; there is no field on the wire for it at all.
   */
  const row = {
    assignmentId: mintRoleAssignmentId(),
    userId: person.rows.user.id as string,
    roleId: conferred.role.id as string,
    roleVersion: conferred.role.version,
    grantedBy: principal.subject.userId as string,
    expiresAt: body.expiresAt,
  }

  const written = await insertRoleAssignment(tx, principal.tenantId as string, row)
  if (!written.ok) {
    /**
     * 🛑 THE DATABASE REFUSED WHAT THE MODEL PERMITTED, AND THAT IS A REACHABLE
     * STATE RATHER THAN AN IMPOSSIBLE ONE — SO IT IS HANDLED BY NAME.
     *
     * The two checks are each sufficient and the database is stricter in one
     * dimension: `role_assignment_grant_restrictive`'s term 3 reads
     * `tenant.role_capability` DIRECTLY, while `readRoleById()` DROPS a row
     * naming a verb this build does not declare. A role carrying a capability
     * the model has retired is therefore invisible to `canGrant()` and visible
     * to the policy — and the policy refuses, which is the safe direction and
     * is why the drop is safe in the first place.
     *
     * ⚠️ A 403 AND NOT A 500, DELIBERATELY. This is an ESCALATION REFUSED, not
     * a component failure: the caller asked for something they may not have and
     * got told no. A 500 would invite somebody to "fix" the discrepancy by
     * loosening the policy. The log says which side refused.
     */
    console.error(
      'data-plane: `grantRoleAssignment` — `canGrant()` PERMITTED a conferral that ' +
        '`role_assignment_grant_restrictive` then REFUSED. This is reachable and is not a ' +
        'defect on its own: the policy reads `tenant.role_capability` directly and the ' +
        'model drops rows naming verbs it does not declare, so the database is stricter. ' +
        `Granter \`${principal.subject.userId}\`, target \`${targetUserId}\`, role ` +
        `\`${body.roleId}\`. If the role carries only declared capabilities, the two ` +
        'controls have genuinely disagreed and one of them is wrong.',
    )
    return sendProblem(reply, {
      status: 403,
      code: CODES.capabilityNotHeld,
      title: 'That conferral is not permitted.',
      detail: GRANT_REFUSED_DETAIL,
    })
  }

  reply.code(201)
  return {
    assignmentId: row.assignmentId,
    userId: row.userId,
    roleId: row.roleId,
    roleVersion: row.roleVersion,
    grantedBy: row.grantedBy,
    grantedAt: written.grantedAt,
    expiresAt: written.expiresAt,
  }
}

/**
 * THE ONE `INSERT`. It writes `tenant_id` as a COLUMN VALUE and no `WHERE`,
 * exactly as `writeAuthorisationRecord()` does and for the same reason:
 * `role_assignment_rls`'s `WITH CHECK` — added by `db/migrations/0020`, which is
 * `0009`'s owed clause — compares it against `app.tenant_id` and refuses the
 * write if they disagree. **A path that took the tenant from the wrong place
 * fails loudly instead of conferring authority inside somebody else's tenant.**
 *
 * ⚠️ THE VALUE PASSED IS `PrincipalContext.tenantId` AND NOT THE SCOPE'S OWN
 * STRING, WHICH IS THE SAME DELIBERATE CHOICE: passing the scope's value would
 * make the `WITH CHECK` compare a value against itself and assert nothing,
 * which is §5.6 written in SQL.
 *
 * 🛑 `granted_at` IS `now()` — THE TRANSACTION'S CLOCK — AND IS RETURNED FROM
 * THE `INSERT` RATHER THAN COMPUTED HERE. Two clocks disagreeing about when an
 * authority began is exactly the ambiguity an auditor cannot resolve, and the
 * row is the record. `0018` names the same divergence for `expires_at`:
 * *"`now()` is the transaction's clock, and the model's is the caller's."*
 *
 * ⚠️ NO `ON CONFLICT`. A duplicate `(tenant_id, id)` is a 16-byte collision,
 * which is a thing a person needs to be told about — `writeAuthorisationRecord()`
 * states the argument and this follows it rather than restating it.
 */
interface AssignmentWrite {
  readonly assignmentId: string
  readonly userId: string
  readonly roleId: string
  readonly roleVersion: number
  readonly grantedBy: string
  readonly expiresAt: string | null
}

type InsertOutcome =
  | { readonly ok: true; readonly grantedAt: string; readonly expiresAt: string | null }
  | { readonly ok: false }

/**
 * `42501` is `insufficient_privilege`, which is what PostgreSQL raises for
 * *"new row violates row-level security policy"*. Narrowed to that one code
 * deliberately: a lost connection, a constraint violation or a duplicate key
 * must NOT be reported to a caller as a refusal, because a refusal is a
 * statement about their authority and those are statements about us.
 */
const RLS_REFUSAL_SQLSTATE = '42501'

async function insertRoleAssignment(
  tx: ScopedClient,
  tenantId: string,
  row: AssignmentWrite,
): Promise<InsertOutcome> {
  try {
    const result = await tx.query(
      `INSERT INTO tenant.role_assignment
         (tenant_id, id, user_id, role_id, role_version,
          granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, $5, $6, now(), $7, NULL)
       RETURNING granted_at, expires_at`,
      [
        tenantId,
        row.assignmentId,
        row.userId,
        row.roleId,
        row.roleVersion,
        row.grantedBy,
        row.expiresAt,
      ],
    )
    const written = (result.rows as Array<Record<string, unknown>>)[0]
    if (written === undefined) return { ok: false }
    return {
      ok: true,
      grantedAt: new Date(String(written['granted_at'])).toISOString(),
      expiresAt:
        written['expires_at'] === null || written['expires_at'] === undefined
          ? null
          : new Date(String(written['expires_at'])).toISOString(),
    }
  } catch (err) {
    const code = (err as { code?: unknown }).code
    if (code === RLS_REFUSAL_SQLSTATE) return { ok: false }
    /**
     * 🛑 RETHROWN, WHICH ROLLS THE TRANSACTION BACK AND TAKES THIS ACT'S
     * INVARIANT 10 RECORD WITH IT. That is `authorisedHandler()`'s property
     * rather than this function's, and it is the right outcome: a conferral
     * that failed for a reason nobody understands must not leave a record
     * saying somebody was authorised to make it.
     */
    throw err
  }
}

/**
 * ⚠️ 404 AND NOT 403, AND THE TWO ANSWERS ARE DELIBERATELY THE SAME FOR THREE
 * DIFFERENT FACTS. A person who does not exist, a person in another tenant, and
 * a person whose membership has lapsed all produce an empty directory read and
 * all get this. `errors.yaml`'s `NotFound` states the rule this follows:
 * *"Returned identically for a row that does not exist and for a row in another
 * tenant — distinguishing them would make this endpoint an existence oracle
 * across the tenant boundary."*
 */
const NO_TARGET_DETAIL = 'No such person is visible to this session.'
const NO_ROLE_DETAIL = 'No such role is visible to this session.'

function noSuchTarget(reply: Parameters<AuthorisedBody>[0]['reply']) {
  return sendProblem(reply, {
    status: 404,
    code: CODES.resourceNotFound,
    title: 'No such person.',
    detail: NO_TARGET_DETAIL,
  })
}

function noSuchRole(reply: Parameters<AuthorisedBody>[0]['reply']) {
  return sendProblem(reply, {
    status: 404,
    code: CODES.resourceNotFound,
    title: 'No such role.',
    detail: NO_ROLE_DETAIL,
  })
}

/**
 * A ROW WE WROTE WRONG, AND IT IS OUR FAULT RATHER THAN THE CALLER'S.
 *
 * `SubstrateRefusal` is *"a fact about OUR SUBSTRATE"* — `server/data-plane/
 * identity.ts`'s own line — so an unrecognised status or an owner that will not
 * assemble is a 500 and never a 403. Reporting it as a refusal would tell an
 * administrator they lack authority they have, and would hide a malformed row
 * from the only person who can fix it.
 */
function unpublishableSubstrate(
  reply: Parameters<AuthorisedBody>[0]['reply'],
  what: 'user' | 'role',
  refusal: string,
) {
  console.error(
    `data-plane: \`grantRoleAssignment\` could not assemble a ${what} record from the ` +
      `directory — \`${refusal}\`. A stored row carries a value the domain model does not ` +
      'define; the conferral was not attempted.',
  )
  return sendProblem(reply, {
    status: 500,
    code: CODES.upstreamUnavailable,
    title: 'The request could not be completed.',
    detail: 'A stored identity record carries a value the domain model does not define.',
  })
}

/**
 * THE OPERATION, AS G301 REQUIRES IT: A CAPABILITY, A RESOURCE, A BODY.
 *
 * 🛑 THE CAPABILITY IS TAKEN FROM `CAPABILITIES` AND NOT WRITTEN AS A STRING, so
 * a capability the model retires is a compile error here rather than a 403
 * nobody can explain. It must equal the `x-capability` the contract annotates,
 * and the two are joined by nothing but a test:
 * `tests/http/authorisation-record.test.ts` §3.
 *
 * ⚠️ `resourceType` IS `'User'` AND NOT `'RoleAssignment'`, AND THE CHOICE
 * MATCHES `resourceId`. *"Entity name … Never parsed."* The act is bound to the
 * person receiving authority; the assignment is what the act PRODUCES, and
 * naming an entity that does not exist until the act succeeds would make the
 * record unreadable for a refused attempt.
 */
export const grantRoleAssignmentOperation: AuthorisedOperation = {
  operationId: 'grantRoleAssignment',
  resourceType: 'User',
  instanceOf: (request) => targetUserIdOf(request),
  body: grantRoleAssignmentBody,
}
