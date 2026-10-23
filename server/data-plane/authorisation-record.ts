/**
 * INVARIANT 10's RECORD, MINTED IN THE HANDLER AND WRITTEN IN THE ACT'S OWN
 * TRANSACTION. **G301, 19 Sep 2026 — the end of a deferral that has stood since
 * G200's gate landed.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE INVARIANT, VERBATIM, BECAUSE A PARAPHRASED INVARIANT IS A CHANGED ONE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     "10. **An act with no authorisation is unrecordable.** `authorize()`
 *      mints an `AuthorizationGrant` and nothing else does; `AuditEvent`,
 *      `DataAccessEvent` and `UsageRecord` all carry its id, and
 *      `AUTHORIZATION_MAY_BE_ABSENT` says which actor kinds may leave it null
 *      (one: `system`). This does **not** make an unauthorised act impossible —
 *      nothing can, against root — it makes one visible or detectable, which is
 *      strictly more than the model had."
 *
 * 🛑 READ THE LAST CLAUSE TWICE AND DO NOT LET THIS FILE BE QUOTED AS MORE THAN
 *    IT IS. Nothing here makes an unauthorised read impossible. What it makes
 *    true is narrower and is stated as a property rather than as an ambition:
 *
 *      · A GATED OPERATION CANNOT BE SERVED WITHOUT A RECORD, because the plane
 *        refuses to boot — `server/http/app.ts`'s sixth fence.
 *      · THE RECORD AND THE ACT COMMIT TOGETHER OR NEITHER DOES, because the
 *        row is written inside the SAME `withTenantScope()` transaction as the
 *        read. A rolled-back act leaves no record; a record with no act cannot
 *        be produced by this path at all.
 *      · A CALLER NO AUTHORITY COVERS NEVER OPENS THE TRANSACTION, because
 *        `authorize()` is asked first and a refusal returns before any scope is
 *        entered. **A denial is not an authorisation, so a denial mints
 *        nothing.**
 *
 *    Everything outside that — anything holding the migrator credential,
 *    anything reaching the database directly, root on the box — is untouched,
 *    and `model/access.ts` says so where the whole spine is argued: *"It does
 *    NOT make an unauthorised act impossible — nothing in a type system can,
 *    against root."*
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHY A HANDLER AND NOT THE GATE. THE ANSWER IS A TYPE, NOT A PREFERENCE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `authorize()` mints against a `ResourceRef` — a class, an entity name and an
 * INSTANCE — and `server/http/app.ts`'s `preValidation` hook holds a route and
 * a principal and no resource. G200 deferred the record for exactly that reason
 * and `tests/http/authorisation-record.test.ts` carried the gap as a tripwire
 * for as long as it stood. G301 ends it in one sentence: *"the handler mints
 * it, because a handler knows its resource and `preValidation` does not."*
 *
 * ⚠️ AND THE SECOND BLOCKER WAS NOT THE HOOK AT ALL — IT WAS THAT THERE WAS
 * NOBODY TO MINT FOR. The tripwire's own header names the two shortcuts it
 * refused and why there was no third: *"a grant is minted against a PRINCIPAL,
 * and none could be resolved."* G299 resolved one. `Decision.via` now names the
 * `assignmentId`, the `roleId` and the pinned `roleVersion`, and that is the
 * evidence this file stores.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 `authorize()` IS THE ONLY THING THAT MINTS, AND THIS FILE ADDS NO SECOND
 *    PATH. THERE IS NO `INSERT` ANYWHERE IN `server/` THAT BUILDS ITS OWN ROW.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `writeAuthorisationRecord()` below takes an `AuthorizationGrant` and writes
 * its fields. It cannot construct one: the type is `model/access.ts`'s, every
 * field is server-written and server-read, and the ONLY expression in this
 * repository that produces one is `authorize()`'s return. That is the
 * invariant's first clause held by having nowhere else to get the value from,
 * rather than by a rule somebody remembers — and it is why this file takes a
 * grant as a parameter instead of taking the parts and assembling them.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THREE OF `authorize()`'s FOUR REFUSALS ARE UNREACHABLE FROM THIS SEAM BY
 *    CONSTRUCTION, AND EACH CONSTRUCTION IS NAMED SO THE CLAIM IS CHECKABLE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   `authorization_resource_class_mismatch`
 *       `authorize()` refuses when `CAPABILITY_RESOURCE_CLASS[capability]` and
 *       `request.resource.resourceClass` disagree. **This file does not let a
 *       caller supply the class: it DERIVES it from the capability through that
 *       same total `Record`.** An operation descriptor names a `resourceType`
 *       and an instance and nothing else, so the two values cannot disagree
 *       because they are one value. The refusal stays reachable for every other
 *       caller of `authorize()`, which is where it belongs — a `view_document`
 *       grant aimed at a `secret` is *"either a caller bug or an attempt to
 *       launder a class past `PERMITTED_RESOURCES`."*
 *   `authorization_ttl_out_of_bounds`
 *       the TTL is `min(SERVED_ACT_SECONDS, MAX_AUTHORIZATION_SECONDS[class])`.
 *       ⚠️ THE `min` IS NOT A CLAMP THAT HIDES A BUG — it is the ceiling
 *       WINNING, stated once. `secret` is bounded at 60 seconds and `authority`
 *       and `statutory` at 300; a seam-wide default of five minutes must not
 *       silently widen any of them, and `authorize()` would refuse if it tried.
 *       The `min` makes that refusal unreachable rather than papering over it.
 *   `authorization_clock_unparseable`
 *       `principal.now` is `new Date().toISOString()`. `Date.parse()` of an ISO
 *       string this process just produced does not return `NaN`.
 *
 * **The fourth is `decide()`'s own, and it is reachable and must stay so.** See
 * `refusedAfterTheGate()`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ WHAT THIS FILE DELIBERATELY DOES NOT BUILD. G301 LEAVES THE LIFECYCLE
 *    OPEN IN ITS OWN WORDS AND THE ABSENCES ARE NAMED RATHER THAN DISCOVERED.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * *"WHAT IS NOT SETTLED HERE: the grant LIFECYCLE — expiry, revocation, and
 * which of `AuditEvent`, `DataAccessEvent` and `UsageRecord` carry the id on
 * which path."* So, exactly:
 *
 *   · **NO `DataAccessEvent` IS WRITTEN.** A served read is a read of a
 *     customer's business and §8.4 has a whole stream for saying so. This file
 *     records THE AUTHORISATION THE ACT RAN UNDER and not the act itself.
 *     **Nobody should read an access log off `tenant.authorization_grant`**: it
 *     says a person was authorised to list runs, not which runs they saw.
 *   · **NO `AuditEvent`, NO `UsageRecord`.** Same reason, and the choice
 *     between the three is precisely what G301 reserves.
 *   · **NOTHING IS EVER REDEEMED.** `redeemAuthorization()` exists and is not
 *     called from anywhere, because the mint and the act are one transaction:
 *     there is no second hop, no id handed to a caller, and therefore no
 *     presentation to re-evaluate. The day a grant id crosses the wire, that
 *     function is the reader and it is already written.
 *   · **NO REVOCATION AND NO EXPIRY SWEEP.** `db/migrations/0010` carries no
 *     `revoked_at` for the reason `0004_subject_ledger.sql` states and this
 *     directory has now applied four times.
 */

import { randomBytes } from 'node:crypto'

import type { FastifyReply, FastifyRequest } from 'fastify'

import { withSessionScope } from '../../db/session-scope.ts'
import { withTenantScope, type ScopedClient, type TenantPool } from '../../db/tenant-scope.ts'
import {
  CAPABILITY_RESOURCE_CLASS,
  MAX_AUTHORIZATION_SECONDS,
  authorize,
  type AuthorizationGrant,
  type Capability,
  type PartnerAuthorizationGrant,
  type PlatformAuthorizationGrant,
  type PrincipalContext,
  type ResourceRef,
} from '../../model/access.ts'
import type { AuthorizationGrantId, TenantId, Timestamp } from '../../model/kernel.ts'
import { CODES } from '../http/problem.ts'
import {
  gatedCapabilityOf,
  principalOf,
  recordsAuthorisation,
  sendProblem,
  type RecordingHandler,
} from '../http/app.ts'
import {
  UNAUTHORISED_DETAIL,
  asCapability,
  principalContextFor,
  type PrincipalSubstrate,
} from './authorise.ts'
import { actingSessionOf, boundTenantOf, type TenantSession } from './session.ts'

/**
 * How long one served act's authorisation lives.
 *
 * `MAX_AUTHORIZATION_SECONDS` explains the unit and this constant sits inside
 * it: *"the exposure is not 'how long may someone work' but 'how long does a
 * mis-issued artefact stay live'."* Five minutes is longer than any request on
 * this plane and shorter than every class ceiling but three — and for those
 * three the ceiling wins, which is what the `min` at the call site is for.
 *
 * ⚠️ IT IS NOT ZERO AND IT IS NOT THE REQUEST'S DURATION, THOUGH BOTH ARE
 * TEMPTING. `AuthorizationGrant.expiresAt` is a stored fact an auditor reads
 * years later; a grant that expired before the response was written would make
 * every row in the table read as expired, and *"a grant expiring exactly now is
 * expired"* is `redeemAuthorization()`'s own comparison. A bound that is true
 * and useless is worse than a bound that is true.
 */
const SERVED_ACT_SECONDS = 300

/**
 * A fresh `AuthorizationGrantId`.
 *
 * ⚠️ G97 — *"every branded id is `text`; the slug is stored VERBATIM. THERE IS
 * NO `uuid` ANYWHERE IN THIS MODEL."* This is a readable prefix and a random
 * tail, in the shape every other id here takes (`ten_`, `usr_`, `rol_`, `ras_`,
 * `ses_`). It is NOT a uuid and the column is not `uuid`.
 *
 * 🛑 `randomBytes` AND NOT `Math.random()`. The id is not a secret — possession
 * of it confers nothing, which `AuthorizationGrant` argues at length — but it
 * is a PRIMARY KEY on an append-only table, and a predictable one lets anybody
 * who can write a row choose which act they collide with. 16 bytes is the same
 * width `server/dev/mint-token.ts` uses for a value that IS a secret.
 *
 * ⚠️ AND THE CAST IS NAMED, BECAUSE A CAST OF SHAPE IS NOT A CHECK OF CONTENT.
 * `AuthorizationGrantId` is `Id<'AuthorizationGrant'>`, a brand over `string`
 * with no runtime form, so there is nothing here to check — the cast asserts a
 * NAMESPACE and not a value. This is the one place in the data plane that mints
 * one; `authorize()` refuses to invent an id precisely so that the decision
 * about its shape is taken somewhere a person can read it.
 */
export function mintAuthorizationGrantId(): AuthorizationGrantId {
  return `azg_${randomBytes(16).toString('hex')}` as AuthorizationGrantId
}

/**
 * ONE GRANT → ONE ROW, PLUS ONE ROW PER `via` ENTRY.
 *
 * 🛑 READ THE SQL AND NOTE WHAT IS NOT IN IT: THERE IS NO TENANT PREDICATE ON
 * THE WRITE EITHER. `tenant_id` is a COLUMN VALUE here, not a `WHERE`, and what
 * makes it safe is `authorization_grant_rls`'s `WITH CHECK` — which compares it
 * against `app.tenant_id`, the value `withTenantScope()` set, and refuses the
 * INSERT if they disagree. **A minting path that took the tenant from the wrong
 * place fails loudly instead of writing an audit row that attributes one
 * tenant's act to another.** `db/migrations/0010` argues that at the policy.
 *
 * ⚠️ `grant.tenantId` IS PASSED RATHER THAN THE SCOPE'S OWN STRING, AND THAT IS
 * DELIBERATE: passing the scope's value would make the `WITH CHECK` compare a
 * value against itself and assert nothing, which is §5.6 written in SQL. The
 * grant's tenant comes from `PrincipalContext.tenantId`; the scope's comes from
 * the session; the policy is what requires them to be the same fact.
 *
 * ⚠️ NO `ON CONFLICT`. A duplicate `(tenant_id, id)` is a 16-byte collision or
 * a double write, and both are things a person needs to be told about. Swallowing
 * it would turn the second act into a silent no-op with the first act's record.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 🛑 AND THEN IT NAMES THE ROW IT JUST WROTE, IN `app.authorisation_ref`.
 *    G507 — 19 Sep 2026. READ THIS BEFORE REMOVING THE LINE, WHICH LOOKS
 *    UNUSED FROM INSIDE THIS FILE BECAUSE NOTHING IN `server/` READS IT.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * `db/migrations/0018` and `0019` add row-level-security policies that open a
 * TENANT'S PERSON DIRECTORY and a LAPSED MEMBER'S SESSION — two things
 * `db/migrations/0009` and `0005` deliberately closed — and each of them asks
 * ONE question to decide whether to open: **does this transaction carry an
 * invariant 10 record for the capability I require?** This is the line that
 * lets it ask. `0018`'s header carries the whole argument; the short form:
 *
 *   · The policies do **NOT** re-evaluate authority. Re-deriving "holds
 *     `manage_roles`" in SQL would be a SECOND EVALUATOR — §5.3, and the exact
 *     thing G289 refused when it declined a control-plane evaluator beside
 *     `decide()`. It would also be a STRICTLY WEAKER one: `decide()` answers
 *     the role version pin, the org arms, `PARTNER_CAPABILITY_MASK`, revoked
 *     and expired as two different facts, and a four-line `EXISTS` answers
 *     three of those and says `true` to the rest.
 *   · So the policies check for **the RECORD**, which only `authorize()` can
 *     have written — invariant 10: *"`authorize()` mints an
 *     `AuthorizationGrant` and nothing else does."*
 *
 * ⚠️ IT IS A NAME, NOT A CLAIM, AND THAT IS THE WHOLE OF WHY IT IS NOT JUST
 *    MOVING THE TRUST. A flag (`app.may_read_people = '1'`) would be something
 *    the database must BELIEVE. A grant id is something the database CHECKS:
 *    the row must exist, be in this tenant scope, carry the right capability
 *    and be unexpired. Setting this GUC to a value for which no row exists
 *    opens nothing at all.
 *
 * 🛑 THE ORDER IS THE PROPERTY, AGAIN. The `set_config` is issued AFTER the
 *    `INSERT`, in the same transaction, so there is no instant at which a
 *    transaction names a record it has not written. Reversing them would make
 *    the GUC a promise instead of a receipt.
 *
 * ⚠️ IT IS SET FOR EVERY OPERATION AND NOT ONLY FOR THE ONES THAT NEED IT, AND
 *    THAT IS DELIBERATE: **this seam takes no authority decision.** It
 *    publishes the identifier of the act's own record and the POLICIES decide
 *    what, if anything, that record opens. A `listRuns` act names its own
 *    grant here too, and every directory policy looks at its `capability`
 *    column, finds `view_run`, and stays shut. Putting an `if` here would put
 *    a fragment of the access decision in the seam, which is the split G289
 *    calls *"the structural precondition for a confused deputy."*
 *
 * ⚠️ `set_config(…, true)` — LOCAL, like every other GUC in this repository,
 *    for G101's reason: reverted at COMMIT or ROLLBACK, so the connection
 *    returns to the pool carrying nothing. A bound parameter rather than
 *    `SET LOCAL` for `db/tenant-scope.ts`'s reason: `SET` is utility syntax
 *    and takes no parameters, so the obvious repair interpolates a value into
 *    a statement string.
 */
export async function writeAuthorisationRecord(
  tx: ScopedClient,
  grant: AuthorizationGrant,
): Promise<void> {
  await tx.query(
    `INSERT INTO tenant.authorization_grant
       (tenant_id, id, subject_user_id, org_class, partner_id, capability,
        resource_class, resource_type, resource_id, solution_id,
        issued_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      grant.tenantId,
      grant.id,
      grant.subjectUserId,
      grant.orgClass,
      grant.partnerId,
      grant.capability,
      grant.resource.resourceClass,
      grant.resource.resourceType,
      grant.resource.resourceId,
      grant.resource.solutionId,
      grant.issuedAt,
      grant.expiresAt,
    ],
  )

  /**
   * 🛑 THE `via` ROWS ARE WHAT G301 NAMES BY NAME, AND AN EMPTY `via` IS A FACT
   * RATHER THAN A SKIPPED WRITE. `decide()` fills it from the assignments that
   * CARRIED the verb, so a customer allow always has at least one; a platform
   * allow is *"a VERB and never a DIMENSION"* and can legitimately carry none.
   * Writing zero rows for zero entries records exactly that, and the parent row
   * is still there to be counted.
   */
  for (const [seq, via] of grant.via.entries()) {
    /**
     * 🛑 TWO KINDS OF AUTHORITY, DISCRIMINATED BEFORE ANY FIELD IS READ —
     * G2591, 1 Oct 2026. A staff-grant allow (G2407, THE OWNER'S) is carried
     * by a `TenantAccessGrant`, which has no role and no pinned version, so it
     * is written to `access_grant_id` and the three assignment columns stay
     * NULL. `db/migrations/0310` makes the two arms exclusive with a CHECK and
     * points `access_grant_id` at the grant with a composite foreign key, so a
     * via line naming a grant in another tenant is unrepresentable.
     */
    if ('accessGrantId' in via) {
      await tx.query(
        `INSERT INTO tenant.authorization_grant_via
           (tenant_id, grant_id, seq, access_grant_id)
         VALUES ($1, $2, $3, $4)`,
        [grant.tenantId, grant.id, seq, via.accessGrantId],
      )
      continue
    }
    await tx.query(
      `INSERT INTO tenant.authorization_grant_via
         (tenant_id, grant_id, seq, assignment_id, role_id, role_version)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [grant.tenantId, grant.id, seq, via.assignmentId, via.roleId, via.roleVersion],
    )
  }

  /* G507. The receipt, named after it is written. See the header. */
  await tx.query('SELECT set_config($1, $2, true)', ['app.authorisation_ref', grant.id])
}

/**
 * THE SAME WRITE, INTO INVARIANT 10's SECOND HOME — G730, 19 Sep 2026, the
 * owner's ruling, and the end of the one thing G728 named as standing between
 * a console principal and a mounted console operation.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS IS A SECOND WRITER AND NOT A SECOND MINTER, AND THE DIFFERENCE IS
 *    THE WHOLE OF WHY IT DOES NOT TOUCH INVARIANT 10's FIRST CLAUSE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * *"`authorize()` mints an `AuthorizationGrant` and nothing else does."* This
 * function takes a `PlatformAuthorizationGrant` and cannot construct one: the
 * type is `model/access.ts`'s, every field is server-written and server-read,
 * and the only expression in this repository that produces one is
 * `authorize()`'s return — the same argument `writeAuthorisationRecord()`
 * makes one function up, unchanged. **`tests/http/authorisation-record.test.ts`
 * §2b still finds exactly one call site under `server/` that MARKS a handler
 * as minting, and it is still the one in this file**, because the two homes
 * share `authorisedHandler()` and the mark sits around the seam rather than
 * around the write.
 *
 * 🛑 THE SCOPE IS THE SESSION AND THERE IS NO TENANT PREDICATE ANYWHERE —
 *    NOT IN THE SQL AND NOT IN THE POLICY. `platform_authorization_grant_rls`
 *    compares `subject_user_id` against the user of the row
 *    `app.session_ref` names, on `USING` **and** on `WITH CHECK`. So a caller
 *    can write a record of THEIR OWN act and of nobody else's, and read back
 *    the same set. This is `db/migrations/0009`'s shape, quoted at the policy:
 *    *"because a person is read BEFORE a tenant is selected and a `tenant_id`
 *    predicate would deny unconditionally under G100."*
 *
 * ⚠️ `grant.subjectUserId` IS PASSED RATHER THAN THE SESSION'S OWN USER, FOR
 *    `writeAuthorisationRecord()`'s REASON: passing the scope's value would
 *    make the `WITH CHECK` compare a value against itself and assert nothing,
 *    which is §5.6 written in SQL. The grant's subject comes from
 *    `PrincipalContext.subject.userId`; the scope's comes from the session
 *    row; the policy is what requires them to be the same fact.
 *
 *    🛑 **AND THAT SENTENCE IS AN ARGUMENT, NOT A WITNESSED CONTROL, WHICH IS
 *    MEASURED RATHER THAN ASSUMED.** `tests/db/platform-authorisation-record.test.ts`
 *    records mutation **M4b**: this line replaced by a subselect on
 *    `app.session_ref` leaves **all fifteen assertions green.** Nothing
 *    observes it, and the reason is structural — the policy requires the two
 *    values to be EQUAL, so on every row that can exist they are the same
 *    value and no read can tell which source produced it. The argument for
 *    writing it this way is unchanged and is about what the `WITH CHECK`
 *    MEANS; the claim that a test would catch a change is one this file does
 *    not make. The same caveat applies verbatim to
 *    `writeAuthorisationRecord()`'s identical sentence one function up, which
 *    nobody had mutated either.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 🛑 AND IT DOES **NOT** SET `app.authorisation_ref`. READ THIS BEFORE ADDING
 *    THE LINE FOR SYMMETRY WITH THE FUNCTION ABOVE.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * G507's receipt exists because `db/migrations/0018` and `0019` ask one
 * question of it — *"does this transaction carry an invariant 10 record for
 * the capability I require?"* — and both answer it by selecting from
 * `tenant.authorization_grant`, the TENANT home. A platform grant id set in
 * that GUC would name a row that does not exist in the table those policies
 * read, so it would open nothing; it would also be a GUC pointing into the
 * wrong table, which is worse than an unset one because it reads as a
 * receipt. **Nothing reads a platform receipt, so there is none** —
 * `db/migrations/0004_subject_ledger.sql`'s rule, which this repository has
 * now applied five times: a thing ahead of its reader is a thing nothing
 * checks. The commit that writes a policy against this table owes the
 * `set_config` in the same commit as the reader.
 */
export async function writePlatformAuthorisationRecord(
  tx: ScopedClient,
  grant: PlatformAuthorizationGrant,
): Promise<void> {
  await tx.query(
    `INSERT INTO tenant.platform_authorization_grant
       (subject_user_id, id, org_class, partner_id, capability,
        resource_class, resource_type, resource_id, solution_id,
        issued_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      grant.subjectUserId,
      grant.id,
      grant.orgClass,
      grant.partnerId,
      grant.capability,
      grant.resource.resourceClass,
      grant.resource.resourceType,
      grant.resource.resourceId,
      grant.resource.solutionId,
      grant.issuedAt,
      grant.expiresAt,
    ],
  )

  /**
   * 🛑 AN EMPTY `via` IS THE COMMON CASE HERE AND IS A FACT RATHER THAN A
   * SKIPPED WRITE — and it is the case `writeAuthorisationRecord()`'s own note
   * describes as legitimate: *"a platform allow is 'a VERB and never a
   * DIMENSION' and can legitimately carry none."* That is wrong about THIS
   * arm in one direction and the direction is worth naming: `decide()`'s
   * platform arm DOES fill `via`, from `platformCarrying`, so a console allow
   * normally has at least one line. What it can never carry is a
   * `RoleAssignmentId` — every entry here is a `PlatformRoleAssignmentId`,
   * which is `db/migrations/0009`'s `tenant.platform_role_assignment` and not
   * `tenant.role_assignment`. **There is still no foreign key**, for `0010`'s
   * reason: `DecisionVia.assignmentId` is a union of two brands over two
   * tables and a foreign key has to name one.
   */
  for (const [seq, via] of grant.via.entries()) {
    /**
     * 🛑 A STAFF-GRANT `via` CANNOT REACH THIS HOME AND IS THROWN RATHER THAN
     * WRITTEN — G2591. `decide()`'s staff-grant branch refuses a principal
     * with no tenant (`staff_grant_without_tenant`) before it can allow, and
     * this home holds only tenant-less acts, so arriving here means the
     * evaluator and the router disagree. `0091`'s via table has no column for
     * a grant, and dropping the line would record an act with its authority
     * erased — worse than a 500, which takes the act down with it.
     */
    if ('accessGrantId' in via) {
      throw new Error(
        'a staff-grant authority reached the PLATFORM authorisation record. A ' +
          'TenantAccessGrant reaches a tenant or nothing, so its record belongs in ' +
          'tenant.authorization_grant — the evaluator allowed a tenant-less act on a grant.',
      )
    }
    await tx.query(
      `INSERT INTO tenant.platform_authorization_grant_via
         (subject_user_id, grant_id, seq, assignment_id, role_id, role_version)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [grant.subjectUserId, grant.id, seq, via.assignmentId, via.roleId, via.roleVersion],
    )
  }
}

/**
 * What a gated handler is, once the record is not optional.
 *
 * 🛑 NOTE WHAT A BODY DOES **NOT** RECEIVE: A POOL. It is handed a `tx` that is
 * already open, already tenant-scoped, and already carries the record. **A body
 * therefore has no way to reach tenant data except through the transaction the
 * mint opened** — which is the structural half of G301's precondition, and it
 * is a stronger statement than the boot fence: the fence says a handler that
 * does not mint may not MOUNT; this says a handler that does not mint cannot
 * READ. `server/data-plane/runs.ts` used to take `pool` and does not any more,
 * and that removal is the whole of the change to it.
 */
/** The three homes of invariant 10's one meaning — G730, G2621. */
export type AnyAuthorizationGrant =
  | AuthorizationGrant
  | PlatformAuthorizationGrant
  | PartnerAuthorizationGrant

/**
 * INVARIANT 10's THIRD HOME — G2621, 1 Oct 2026, THE OWNER'S RULING:
 * *"Session-keyed table: tenant.partner_authorization_grant keyed on the
 * acting session — G730's second-home shape, a third home for one meaning."*
 *
 * `writePlatformAuthorisationRecord()`'s shape with `partner_id` NOT NULL, and
 * with ONE thing the platform writer deliberately does not do: it sets
 * `app.authorisation_ref`, as the TENANT writer does (G507). The firm's
 * directory, its invitations and its deals are keyed on this row
 * (`db/migrations/0321`, `0322`), so a portal act's body reads them only
 * through the record it was minted under — and `0320` §2's `WITH CHECK` is
 * what makes that record a receipt rather than a claim: it cannot be written
 * for a firm in which the actor holds no live role carrying the verb.
 */
export async function writePartnerAuthorisationRecord(
  tx: ScopedClient,
  grant: PartnerAuthorizationGrant,
): Promise<void> {
  await tx.query(
    `INSERT INTO tenant.partner_authorization_grant
       (subject_user_id, id, org_class, partner_id, capability,
        resource_class, resource_type, resource_id, solution_id,
        issued_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      grant.subjectUserId,
      grant.id,
      grant.orgClass,
      grant.partnerId,
      grant.capability,
      grant.resource.resourceClass,
      grant.resource.resourceType,
      grant.resource.resourceId,
      grant.resource.solutionId,
      grant.issuedAt,
      grant.expiresAt,
    ],
  )
  for (const [seq, via] of grant.via.entries()) {
    /**
     * 🛑 A STAFF-GRANT `via` CANNOT REACH THIS HOME AND IS THROWN RATHER THAN
     * WRITTEN — G2742, integrate/1oct-c, joining #511's G2592 to #514's
     * G2621. `decide()` consults `staffGrant` on the PLATFORM arm only, and
     * this home holds PARTNER acts, so arriving here means the evaluator and
     * the router disagree. `0320`'s via table has no column for a grant —
     * #511's `0310` widened only the tenant home's — and dropping the line
     * would record an act with its authority erased: the platform writer's
     * argument, one home over.
     */
    if ('accessGrantId' in via) {
      throw new Error(
        'a staff-grant authority reached the PARTNER authorisation record. A ' +
          'TenantAccessGrant is honoured on the platform arm only and reaches a tenant ' +
          'or nothing — the evaluator allowed a partner act on a grant.',
      )
    }
    await tx.query(
      `INSERT INTO tenant.partner_authorization_grant_via
         (subject_user_id, grant_id, seq, assignment_id, role_id, role_version)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [grant.subjectUserId, grant.id, seq, via.assignmentId, via.roleId, via.roleVersion],
    )
  }
  /* G507's receipt, named after it is written — the tenant writer's line. */
  await tx.query('SELECT set_config($1, $2, true)', ['app.authorisation_ref', grant.id])
}

/**
 * 🛑 A BODY'S ANSWER LEAVES THE PROCESS AFTER ITS TRANSACTION COMMITS, NEVER
 * BEFORE — G2745, integrate/1oct-c, and it is the root cause of #511's red PR
 * gate.
 *
 * Every refusal a body answers goes through `sendProblem()`, which is
 * `reply.code(…).type(…).send(…)` — and Fastify WRITES the response the moment
 * `send()` is called. A body runs INSIDE `withTenantScope()` /
 * `withSessionScope()`, and the act's invariant 10 record was written at the
 * top of that transaction, so the client was told the outcome while the
 * record was still UNCOMMITTED. Two consequences, one observed and one not:
 *
 *  - OBSERVED: `tests/http/proposal-chain-served.test.ts` §9 counts
 *    `tenant.authorization_grant` around ONE read and failed `23 !== 22` on
 *    #511's CodeBuild run while passing locally. §8b's 409 had reached the
 *    client before its transaction committed, so its record landed INSIDE §9's
 *    window. **Witnessed deterministically, not inferred**: a 150 ms sleep
 *    before `COMMIT` in `db/tenant-scope.ts` turns §9 red with exactly
 *    `23 !== 22` on every run — and the same sleep leaves it green once this
 *    hold is in place. The race predates #511 (no body that answers early was
 *    touched by it); #511 only exposed it on a slower runner.
 *  - NOT OBSERVED AND WORSE: a body that answered through `send()` and then saw
 *    its `COMMIT` fail would have told the client an outcome for an act that
 *    rolled back — with its record.
 *
 * So `send()` is HELD: the body gets a view of the reply whose `send` records
 * the payload, every chained setter (`code`, `type`, `header`) still lands on
 * the real reply but returns the view, and `flush()` performs the real `send`
 * only after the scope helper has returned — i.e. after `COMMIT`. A body that
 * throws after a held `send` loses that answer, and the client gets the error
 * the rolled-back act deserves. **The assertion at §9 was right and is not
 * touched**: one read, one record, observable the moment the read is answered.
 */
export interface HeldReply {
  readonly view: FastifyReply
  /** Send whatever the body held, after commit; otherwise pass the outcome through. */
  flush(outcome: unknown): unknown
}

export function heldReply(reply: FastifyReply): HeldReply {
  let held: { readonly payload: unknown } | null = null
  const view: FastifyReply = new Proxy(reply, {
    get(target, prop, receiver) {
      if (prop === 'send') {
        return (payload?: unknown) => {
          held = { payload }
          return view
        }
      }
      if (prop === 'sent') return held !== null || target.sent
      /* ⚠️ NOT THENABLE. A Fastify reply has a `then` that settles when the
       * response is SENT, and a body returns `sendProblem(view, …)` from an
       * async callback — so a thenable view would be awaited by the scope
       * helper until a send that is held until the helper returns. Measured:
       * the first draft of this hold hung `proposeResolution`'s 409 forever. */
      if (prop === 'then') return undefined
      const value: unknown = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function') return value
      return (...args: unknown[]) => {
        const r: unknown = (value as (...a: unknown[]) => unknown).apply(target, args)
        return r === target ? view : r
      }
    },
  })
  return {
    view,
    flush(outcome) {
      if (held !== null) return reply.send(held.payload)
      return outcome === view ? reply : outcome
    },
  }
}

export interface AuthorisedContext {
  readonly request: FastifyRequest
  readonly reply: FastifyReply
  /** Open, tenant-scoped, and carrying this act's record. Committed on return. */
  readonly tx: ScopedClient
  /**
   * The act's own authorisation, for a body that needs to name it. Nothing in
   * the tree reads it yet — it is here because a `DataAccessEvent` writer will
   * need `grant.id` and will need it from the same object, not from a second
   * mint.
   */
  readonly grant: AnyAuthorizationGrant
  /**
   * ✅ **THE ACTING PRINCIPAL — G512, 19 Sep 2026, AND G511 ASKED FOR IT BY
   * NAME.** That row's enumeration of what the granting commit owed reads:
   * *"a handler built with `authorisedHandler()`, which needs the granter's
   * `PrincipalContext` — **`AuthorisedContext` does not carry one today and
   * the seam already computes it**"*.
   *
   * 🛑 IT IS THE SEAM'S OWN OBJECT AND NOT A SECOND RESOLUTION, WHICH IS THE
   * WHOLE OF WHY THIS IS A FIELD RATHER THAN A HELPER A BODY COULD CALL.
   * `principalContextFor()` runs exactly once per act, a few lines above, and
   * `authorize()` has already evaluated `decide()` against THIS object. A body
   * that resolved its own would be asking the same question a second time
   * against a substrate that may have moved, and `canGrant()` reading a
   * different principal from the one the gate allowed is precisely the
   * two-halves split `model/access.ts` calls *"the structural precondition for
   * a confused deputy."* One resolution, one principal, one act.
   *
   * ⚠️ AND IT IS NOT AN AUTHORITY TO SPEND. Holding this object confers
   * nothing: every field on it is already what the gate and the mint read, and
   * the only thing a body may do with it is ask the model a FURTHER question
   * about a DIFFERENT object — which is what `canGrant()` is, and why the
   * first reader of this field is a conferral rather than a read.
   */
  readonly principal: PrincipalContext
}

export type AuthorisedBody = (ctx: AuthorisedContext) => Promise<unknown>

/**
 * THE TENANT THIS ACT RAN IN, FOR A BODY THAT READS TENANT DATA — G730,
 * 19 Sep 2026.
 *
 * ⚠️ IT EXISTS BECAUSE `AuthorisedContext.grant` IS A UNION SINCE THE SECOND
 * HOME LANDED, AND IT IS A NARROWING RATHER THAN A CAST. The two call sites
 * previously wrote `grant.tenantId as TenantId` — a cast of shape that is not
 * a check of content — and the compiler now requires the question to be
 * answered instead. Answering it once, here, is the alternative to answering
 * it differently in every body.
 *
 * 🛑 THE THROW IS UNREACHABLE AND IT IS INVARIANT 8 THAT MAKES IT SO, NOT
 * THIS FUNCTION. Every caller is a `tenant_data` body, and
 * `PLATFORM_ASSIGNMENT_REACHES.tenant_data` is `false` — *"invariant 8 moved
 * from the ORG term to that entry"* — so `decide()` refuses a platform
 * principal that class before `authorize()` mints anything, and no
 * `PlatformAuthorizationGrant` can reach a body that reads a tenant row. A
 * THROW rather than a refusal, for the polarity this file already takes
 * twice: *"a 403 would be a gate reporting success at doing nothing."*
 */
export function actingTenantOf(grant: AnyAuthorizationGrant): TenantId {
  if (grant.home !== 'tenant') {
    throw new Error(
      `a tenant-scoped body ran under a PLATFORM authorisation for \`${grant.capability}\`. ` +
        'Invariant 10\'s platform home carries no tenant by construction, and invariant 8 ' +
        'is what should have stopped this reaching a body at all: ' +
        '`PLATFORM_ASSIGNMENT_REACHES.tenant_data` is `false`, so `decide()` refuses a ' +
        'platform principal that class before anything is minted. Reaching here means ' +
        'either that record has changed or a non-tenant_data body is asking for a tenant.',
    )
  }
  return grant.tenantId
}

/**
 * An operation, described in the terms a `ResourceRef` needs.
 *
 * ⚠️ THERE IS NO `resourceClass` FIELD AND THERE MUST NOT BE ONE. It is derived
 * from the capability by `CAPABILITY_RESOURCE_CLASS`, which is the same total
 * `Record` `authorize()` checks the request against — see the header for why
 * that makes one of the four refusals unreachable here.
 */
export interface AuthorisedOperation {
  /** For the messages `boundTenantOf()` and `actingSessionOf()` throw, and for nothing else. */
  readonly operationId: string
  /**
   * 🛑 THERE IS NO `capability` FIELD AND THERE MUST NOT BE ONE — G3961,
   * 4 Oct 2026. It was here until this commit, a second spelling of the
   * operation's `x-capability`, and nothing at boot compared the two: when they
   * diverged the gate passed the caller on the CONTRACT's verb and `authorize()`
   * refused on the HANDLER's, so every request answered a 403 nobody could read.
   * The record now mints against `gatedCapabilityOf(request)` — the same route
   * config the gate read — and `mountTier()`'s EIGHTH FENCE refuses at boot a
   * contract verb this file cannot mint. Adding the field back is `TS2353` at
   * every literal that sets it.
   */
  /** *"Entity name: 'Exception', 'SourceDocument', 'Solution'. Never parsed."* */
  readonly resourceType: string
  /**
   * The instance this act is bound to, or `null` where it is genuinely not
   * instance-bound — *"opening a list, running a report."*
   *
   * 🛑 IT READS THE VALIDATED REQUEST, WHICH IS SAFE ONLY BECAUSE OF WHERE THIS
   * RUNS. A handler runs after ajv, so a path parameter here is one the
   * contract's own schema admitted. It is still never PARSED — the value is
   * stored verbatim, exactly as `ResourceRef.resourceId` requires.
   */
  readonly instanceOf: (request: FastifyRequest) => string | null
  readonly body: AuthorisedBody
  /**
   * ✅ **THE ONLY THING IN THIS FILE THAT RUNS AFTER THE TRANSACTION IS GONE —
   * R-B, 20 Sep 2026, AND IT EXISTS FOR EXACTLY ONE CALLER.**
   *
   * 🛑 READ WHY IT IS ON THE SEAM RATHER THAN IN A BODY, BECAUSE "just do it at
   * the end of `admitRunBody`" IS THE OBVIOUS REPAIR AND IT IS WRONG. A body
   * runs INSIDE `withTenantScope()`; the commit happens when the body returns.
   * So anything a body does is inside a transaction that may still roll back,
   * and `server/data-plane/run-queue.ts` §2 argues at length why a message for
   * a run that may roll back is the one arm that must not exist — the worker
   * would be handed a run id it cannot find, and *"a phantom message is
   * indistinguishable from an attack."* **This seam is the only place that
   * knows the transaction committed.**
   *
   * ⚠️ AND WRAPPING THE HANDLER WAS THE OTHER CANDIDATE AND IS REFUSED BY
   * NAME: `authorisedHandler()` returns a `RecordingHandler`, and
   * `mountTier()`'s SIXTH FENCE reads the mark on it. A wrapper would have to
   * re-apply that mark, which is a fence being re-asserted by the code it
   * fences — so the extension goes here, where the fence is untouched.
   *
   * ⚠️ `result` IS `unknown` AND THE ONE IMPLEMENTOR NARROWS IT WITH A REAL
   * RUNTIME GUARD. Making `AuthorisedOperation` generic in its body's return
   * type for the sake of one operation would ripple through twenty-five mounts
   * in `server/data-plane/start.ts`; a guard at the single call site costs one
   * function and fails CLOSED — a body that changes shape publishes nothing
   * and says so, rather than publishing a wrong message.
   *
   * 🛑 A THROW HERE IS CAUGHT AND LOGGED AND DOES NOT FAIL THE REQUEST. The act
   * has COMMITTED; turning a committed 201 into a 500 would tell an operator
   * that a run which genuinely exists does not. The recovery is the operator
   * pressing Run again, which `run_idempotency_key` makes free.
   */
  readonly afterCommit?: (act: CommittedAct) => Promise<void>
}

/**
 * What an operation's `afterCommit` is handed.
 *
 * ⚠️ THE GRANT AND NOT THE SESSION, AND NOT THE REQUEST. Whatever this runs
 * for, the TENANT it runs for comes from the act's own authorisation record —
 * `actingTenantOf(grant)` — which is the same object the policy compared
 * against `app.tenant_id` when the row was written. A second derivation from
 * the session here would be a second answer to a question already answered.
 */
export interface CommittedAct {
  readonly grant: AnyAuthorizationGrant
  readonly result: unknown
}

/**
 * 🛑 THE SEAM. It mints, it writes, and then it runs the act — in that order,
 * in one transaction, and with no way for a body to skip a step.
 *
 * ⚠️ `substrateFor` IS A PARAMETER FOR THE SAME REASON `capabilityAuthoriser()`
 * TAKES ONE, AND WITH THE SAME FENCE AROUND IT. `server/data-plane/start.ts`
 * passes `substrateFromSession` from BOTH entry points and admits an override
 * on the EPHEMERAL-PORT one only, exactly as it does for `authorise`. A test
 * that supplies a fixture substrate is witnessing the HANDLER; a deployed
 * process has no argument through which one could arrive. And a fixture cannot
 * make this permissive on its own: the verdict still comes from `authorize()`,
 * which asks `decide()`, which is the single evaluator — *"A reader that
 * returned a fabricated substrate would be lying to the evaluator rather than
 * replacing it."*
 */
export function authorisedHandler(
  pool: TenantPool,
  substrateFor: (session: TenantSession) => PrincipalSubstrate,
  op: AuthorisedOperation,
): RecordingHandler {
  return recordsAuthorisation(async (request, reply) => {
    const session = principalOf<TenantSession>(request)
    const capability = capabilityTheGateChecked(request, op)
    /**
     * ⚠️ **THIS LINE READ `const tenantId = boundTenantOf(session, op.operationId)`
     * AND IT IS CORRECTED RATHER THAN DELETED — G730, 19 Sep 2026.** A
     * tenant-less session reaching a gated operation used to be, by
     * definition, the gate not having run: *"a handler reaching here with no
     * tenant means the gate did not run."* Since the owner's console ruling it
     * is a LEGITIMATE caller — a platform principal on a console host, which
     * `decide()`'s fourth arm can allow and which now has a home for its
     * record. **Reading the session's tenant unconditionally is what lets
     * `authorize()` decide the home**, and `boundTenantOf()` survives on the
     * tenant arm below as the backstop it always was.
     */
    const tenantId = session.tenantId
    const now = new Date().toISOString() as Timestamp

    const resolution = principalContextFor({
      tenantId: tenantId === null ? null : (tenantId as TenantId),
      substrate: substrateFor(session),
      now,
    })
    if (!resolution.ok) {
      /**
       * 🛑 A THROW RATHER THAN A REFUSAL, AND IT IS THE SAME POLARITY
       * `boundTenantOf()` AND THE GATE'S OWN UNREACHABLE BRANCH TAKE:
       * *"THROWN rather than refused so that it stays unreachable."* The gate
       * resolved this same principal, out of this same frozen session object,
       * microseconds ago and answered `held`. `substrateFromSession()` is a
       * pure projection, so a different answer here is not a race — it is a
       * broken invariant between two functions that must agree. A 403 would be
       * a gate reporting success at doing nothing; a 500 with a stack trace is
       * the honest answer.
       */
      throw new Error(
        `${op.operationId}: the gate allowed a caller whose principal will not resolve ` +
          `(missing: ${resolution.missing.join(', ')}). The authoriser and the record are ` +
          'reading the same session object through the same projection, so they cannot ' +
          'disagree unless one of them has changed. Invariant 10 has no honest answer here.',
      )
    }

    /**
     * ⚠️ `solutionId: null` ON BOTH OPERATIONS, AND IT IS A VALUE RATHER THAN A
     * GAP. *"A SCOPE, NEVER A GRANT. Its presence narrows; its absence never
     * widens."* Neither run read runs inside a solution — nothing on this plane
     * resolves one — so a fabricated id would be a narrowing nobody chose, and
     * the null says accurately that the act was not solution-bound.
     */
    const resource: ResourceRef = {
      resourceClass: CAPABILITY_RESOURCE_CLASS[capability],
      resourceType: op.resourceType,
      resourceId: op.instanceOf(request),
      solutionId: null,
    }

    const authorisation = authorize(resolution.principal, capability, {
      id: mintAuthorizationGrantId(),
      resource,
      ttlSeconds: Math.min(SERVED_ACT_SECONDS, MAX_AUTHORIZATION_SECONDS[resource.resourceClass]),
    })

    const grant = authorisation.grant
    if (grant === null) return refusedAfterTheGate(reply, op, authorisation.decision.reason)

    /**
     * 🛑 THE ACT'S RECORD GOES TO THE HOME ITS PRINCIPAL HAS A SCOPE FOR —
     * G730, 19 Sep 2026, THE OWNER'S RULING. *"Invariant 10 keeps one meaning
     * with two homes, and each home has a scope that can actually read it."*
     *
     * ⚠️ THE BRANCH IS ON `grant.home` AND NOT ON `session.tenantId`, AND THAT
     * IS THE POINT OF THE DISCRIMINANT. The home is decided by `authorize()`
     * — one function, reading one principal — and this seam reads its answer.
     * Branching on the session here would be a second derivation of the same
     * fact, and the two could disagree the day anything else touches either.
     *
     * 🛑 A TENANT-DATA BODY CANNOT BE REACHED ON THIS ARM, AND IT IS INVARIANT
     * 8 THAT MAKES IT SO RATHER THAN ANYTHING IN THIS FILE. `tx` is a SESSION
     * scope here: `app.tenant_id` is unset, so every tenant-scoped table reads
     * EMPTY under G100. That would be a silent wrong answer if a
     * `tenant_data` operation could arrive — and none can, because
     * `PLATFORM_ASSIGNMENT_REACHES.tenant_data` is `false` and `decide()`
     * refuses a platform principal that class before `authorize()` mints
     * anything. The three classes that DO open — `substrate`, `catalogue`,
     * `commercial` — have no tenant table between them.
     */
    /**
     * 🛑 THE THIRD HOME — G2621. A portal act is recorded under the acting
     * session, as a console act is, and into the firm's own table rather than
     * the platform's. Branching on `grant.home` keeps `authorize()` the one
     * place the home is decided.
     */
    if (grant.home === 'partner') {
      const digest = actingSessionOf(session, op.operationId)
      const answer = heldReply(reply)
      const outcome = answer.flush(
        await withSessionScope(pool, digest, async (tx) => {
          await writePartnerAuthorisationRecord(tx, grant)
          return op.body({ request, reply: answer.view, tx, grant, principal: resolution.principal })
        }),
      )
      await runAfterCommit(op, grant, outcome)
      return outcome
    }

    if (grant.home === 'platform') {
      const digest = actingSessionOf(session, op.operationId)
      const answer = heldReply(reply)
      const outcome = answer.flush(
        await withSessionScope(pool, digest, async (tx) => {
          await writePlatformAuthorisationRecord(tx, grant)
          return op.body({ request, reply: answer.view, tx, grant, principal: resolution.principal })
        }),
      )
      await runAfterCommit(op, grant, outcome)
      return outcome
    }

    /**
     * 🛑 ONE TRANSACTION, AND THE ORDER INSIDE IT IS THE PROPERTY. The record is
     * written BEFORE the act, so a failure in the act rolls the record back with
     * it and a failure in the record never lets the act run. The tripwire this
     * commit retires demanded exactly this, in its own words: the record must be
     * written *"inside the same `withTenantScope()` transaction as the read, so
     * a record cannot outlive a rolled-back act."*
     *
     * ⚠️ A BODY THAT ANSWERS 404 STILL COMMITS THE RECORD, AND THAT IS CORRECT
     * RATHER THAN SLOPPY. `getRun` answering *"no run with that id is visible to
     * this session"* is an authorised read that found nothing — the
     * authorisation happened, the act happened, and the absence is the result.
     * What must not commit is an act that THREW, and that one does not.
     *
     * ⚠️ `boundTenantOf()` IS STILL THE SCOPE'S SOURCE AND IT IS NOT
     * `grant.tenantId`, WHICH LOOKS LIKE THE TIDIER LINE AND WOULD DELETE THE
     * CONTROL. `writeAuthorisationRecord()` argues it at length: the grant's
     * tenant comes from `PrincipalContext`, the scope's comes from the
     * session, and `authorization_grant_rls`'s `WITH CHECK` is what requires
     * them to be the same fact. Taking both from the grant would make the
     * policy compare a value against itself.
     */
    /* G2745: the body's answer is HELD until the scope commits. */
    const answer = heldReply(reply)
    const outcome = answer.flush(
      await withTenantScope(pool, boundTenantOf(session, op.operationId), async (tx) => {
        await writeAuthorisationRecord(tx, grant)
        return op.body({ request, reply: answer.view, tx, grant, principal: resolution.principal })
      }),
    )
    await runAfterCommit(op, grant, outcome)
    return outcome
  }, (verb) => asCapability(verb) !== null)
}

/**
 * The verb this act mints against: the one the GATE checked, read off the same
 * route config — G3961. There is no second spelling to read instead.
 *
 * 🛑 THROWN RATHER THAN REFUSED, because both arms are unreachable past
 * `mountTier()`: the eighth fence refuses a recording handler on an ungated
 * operation, and refuses a contract verb outside the closed set. Reaching here
 * means a fence did not fire, and a 403 would be a gate reporting success at
 * doing nothing.
 */
function capabilityTheGateChecked(request: FastifyRequest, op: AuthorisedOperation): Capability {
  const named = gatedCapabilityOf(request)
  const verb = named === undefined ? null : asCapability(named)
  if (verb === null) {
    throw new Error(
      `${op.operationId}: a recording handler ran on a route whose gate names ` +
        `${named === undefined ? 'no capability' : `\`${named}\`, which is not in the closed set`}. ` +
        "`mountTier()`'s eighth fence refuses both at boot, so it did not fire.",
    )
  }
  return verb
}

/**
 * Run an operation's `afterCommit`, and never let it change the answer.
 *
 * 🛑 THE `catch` IS THE POINT AND IS NOT DEFENSIVE PROGRAMMING. By the time
 * this runs the act has COMMITTED and the response value is decided; an
 * exception escaping here would be Fastify turning a committed 201 into a 500,
 * which tells an operator that a run which exists does not — and which invites
 * them to press Run again for the WRONG reason. The log line names the
 * operation, so a person reading it can tell a queue that is down from a queue
 * that is not configured.
 *
 * ⚠️ AN OPERATION WITH NO `afterCommit` PAYS NOTHING: the property is optional
 * and twenty-four of the twenty-five mounted operations do not declare one.
 */
async function runAfterCommit(
  op: AuthorisedOperation,
  grant: AnyAuthorizationGrant,
  result: unknown,
): Promise<void> {
  if (op.afterCommit === undefined) return
  try {
    await op.afterCommit({ grant, result })
  } catch (err) {
    console.error(
      `data-plane: \`${op.operationId}\`'s after-commit step threw AFTER the act committed. ` +
        'The act stands and the response is unchanged. ' +
        `${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

/**
 * The gate said `held` and `authorize()` said no.
 *
 * ⚠️ THIS IS REACHABLE AND MUST STAY SO, WHICH IS WHY IT IS A FUNCTION WITH A
 * NAME RATHER THAN A LINE. Three of `authorize()`'s four refusals are
 * unreachable from this seam by construction — the header names each
 * construction — and the fourth is `decide()`'s own, arriving through the clock:
 * the gate evaluates at `preValidation` and this evaluates in the handler, so an
 * assignment that expires in between is refused HERE having been allowed THERE.
 * That is a race the model is built to lose safely, and losing it safely means a
 * 403 rather than a served read with no record.
 *
 * 🛑 NO ROW IS WRITTEN AND NO TRANSACTION IS OPENED. **A denial is not an
 * authorisation.** A refusal that minted a grant would put a record of
 * permission into an append-only table for an act that never happened, which is
 * worse than the gap this whole commit closes: the tripwire's own words for it
 * were *"an audit trail that reads as evidence and is not."*
 *
 * ⚠️ THE REASON GOES TO THE PROCESS LOG AND NEVER TO THE CALLER. `errors.yaml`
 * forbids `detail` from carrying anything request-derived, and
 * `UNAUTHORISED_DETAIL` is the constant every other refusal on this plane
 * carries — *"a refusal naming the capability the caller lacks would turn the
 * gate into a roster oracle for anybody who can authenticate."* The operator who
 * can act on it reads the log; the caller learns "no".
 */
function refusedAfterTheGate(
  reply: FastifyReply,
  op: AuthorisedOperation,
  reason: string,
): FastifyReply {
  console.error(
    `data-plane: \`${op.operationId}\` passed the capability gate and \`authorize()\` then ` +
      `refused it — \`${reason}\`. No authorisation record was minted and no act was run. ` +
      'If this is not a clock race on an expiring assignment, the gate and the mint are ' +
      'disagreeing about the same principal and one of them is wrong.',
  )
  return sendProblem(reply, {
    status: 403,
    code: CODES.capabilityNotHeld,
    title: 'That capability is not held.',
    detail: UNAUTHORISED_DETAIL,
  })
}
