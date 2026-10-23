/**
 * D1 — `POST /context/resolve`, `resolveTenantContext`. THE OPERATION EVERY
 * OTHER OPERATION IN EVERY TIER IS TOLD IT RECEIVES THE RESULT OF.
 *
 * Its own contract description, quoted because paraphrasing it loses the
 * claim: *"Every other operation in every tier receives the result of this
 * call. None of them asks for a tenant."* That sentence has been true as an
 * ABSENCE since the contracts were written — no tier declares a `tenantId`
 * request field — and false as a MECHANISM, because nothing produced the
 * result the sentence says they receive. This file produces it.
 *
 * ┌─ WHY MOUNTING THIS IS NOT A G200 VIOLATION, STATED FIRST ──────────────────┐
 * │ G200 freezes MOUNTING until authorisation exists. Two separate things make  │
 * │ this operation lawful to mount and both are on the operation itself:        │
 * │                                                                            │
 * │   · it is FOUNDATION-tier and states an EXEMPTION (⚠️ this cited            │
 * │     `TIER_REQUIRES_CAPABILITY.foundation` until G911 retired it), which is  │
 * │     `false` — *"no operation has a human principal; every caller is the     │
 * │     engine itself"*;                                                       │
 * │   · its annotation is an EXEMPTION WITH A REASON, and the reason is the     │
 * │     one that cannot be answered any other way: `x-capability: 'exempt: no   │
 * │     human principal — this operation MINTS the session a capability check   │
 * │     would later be built from, so gating it on one is circular'`.          │
 * │                                                                            │
 * │ 🛑 AND THE GATE EXISTS NOW, WHICH IS THE CONDITION G200 ATTACHES. It runs   │
 * │ in `preValidation`, it refuses every capability-tier verb, and NOTHING ON   │
 * │ THE CAPABILITY TIER IS MOUNTED BY THIS COMMIT. A foundation-tier exemption  │
 * │ is not a widening of the freeze; it is the operation the freeze was waiting │
 * │ on, because a capability is a question about a subject and a subject is     │
 * │ what this resolves.                                                        │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE SIDE EFFECT THE CONTRACT DESCRIBES IS NOT THE SIDE EFFECT THIS HAS,
 *    AND THE DIFFERENCE IS G101. READ THIS BEFORE BELIEVING EITHER.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The contract says: *"Sets the row-level-security session variable as a side
 * effect. A caller that reaches PostgreSQL without having called this sees
 * nothing."*
 *
 * **A session variable that outlived this request would be the exact defect
 * `db/tenant-scope.ts` calls leak MODE 1**, in its own words: *"request A for
 * tenant T sets it, returns the connection to the pool, and request B for
 * tenant U is served on that connection reading T's rows with RLS reporting
 * success."* G101 settles it the other way: `SET LOCAL` inside an explicit
 * transaction, reverted at COMMIT, *"the only posture a later deployment
 * decision cannot invalidate."*
 *
 * So what this operation actually does is **bind the tenant to the SESSION
 * ROW**, durably, and every later request re-derives the GUC from that row
 * inside its own scoped transaction. The contract's second sentence survives
 * unchanged and is the one that matters — a caller that has not called this
 * has a session whose `tenant_id` is NULL, `withTenantScope()` is opened with
 * nothing, and G100's deny-on-NULL returns an empty page. **The first sentence
 * describes a connection-scoped variable and is wrong about the mechanism; it
 * is recorded here rather than edited, because a contract change is not this
 * slice's to make and because a reader who quoted it would be describing MODE 1
 * as the design.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE TENANT COMES FROM THE HOST. NOTHING HERE PARSES A HOSTNAME.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * G179: one host serves one tenant *"precisely so that there is no selector to
 * defeat"*, and resolution is a REGISTRY LOOKUP. `resolveServingHost()` does
 * it, and its own header records the mutation it is shaped to survive —
 * `host.split('.')[0]`, which *"breaks SILENTLY, because every pooled tenant
 * goes on working"* and fails only for the BYOA customer serving from its own
 * domain. There is no `split`, no `indexOf` and no substring of a presented
 * host anywhere in this file either.
 *
 * G210: this is a CHECK and never a CHOOSER. The request body carries
 * NOTHING — ⚠️ it carried an opaque `sessionToken` until G3006 (2 Oct 2026)
 * moved the session onto the cookie alone — no tenant, no list, no preference —
 * and `selectTenantForSession()` answers yes or no about the ONE tenant the
 * host named. *"A deferred selection operation is a selector with a later
 * date on it."*
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ WHAT THIS DOES NOT DO — AND THE LIST IS LONGER THAN THE LIST OF WHAT IT
 *    DOES. DO NOT READ A MOUNTED D1 AS A BUILT IDENTITY SUBSTRATE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   · IT MINTS NOTHING. There is no sign-in here and no session issue path:
 *     `session.openapi.yaml`'s four operations are declared and mounted
 *     nowhere, and a session row arrives in this database by a migrator-role
 *     INSERT (a fixture) and by no other means. **So the only callers who can
 *     use this today are ones somebody seeded a row for.**
 *   · IT RESOLVES NO SUBJECT. `resolveSubject()` needs a `User` and an
 *     `IdentityConnection` and neither has a table —
 *     `server/data-plane/session.ts` carries the full accounting of which of
 *     its seven arms are enforced (two) and which are not (four).
 *   · IT RECORDS NOTHING. Invariant 10 is deferred here exactly as it is
 *     deferred in the gate, and for a sharper reason: the record is minted
 *     against a resource, and the RESOURCE this operation touches is the
 *     caller's own session row. `tests/http/authorisation-record.test.ts` is
 *     the tripwire that makes a half-built trail impossible to introduce
 *     quietly, and it stays green through this commit because this commit
 *     builds no part of one.
 */

import type { FastifyReply, FastifyRequest } from 'fastify'

import { withSelectionScope } from '../../db/selection-scope.ts'
import { withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import {
  TENANT_SELECTION_REFUSALS,
  selectTenantForSession,
  type TenantContext,
} from '../../model/access.ts'
import {
  DEPLOYMENT_MODES,
  type Session,
  type TenantEnvironment,
} from '../../model/domain.ts'
import {
  REGION_HOST_LABEL,
  resolveServingHost,
  type ServingHost,
} from '../../model/serving-host.ts'
import type { TenantId, Timestamp } from '../../model/kernel.ts'
import { principalOf, sendProblem, type Handler } from '../http/app.ts'
import { CODES } from '../http/problem.ts'
import { readMemberships, readStaffGrant } from './identity.ts'
import type { TenantSession } from './session.ts'

/**
 * THE STATEMENT THE WHOLE SLICE TURNS ON, AND IT HAS NO `WHERE`.
 *
 * `tests/db/session-membership-selection.test.ts` pins the identical string and
 * explains why in its own header: *"No `WHERE handle_digest = …`, so nothing in
 * the SQL says which session is being written. No `EXISTS (SELECT … FROM
 * membership …)`, so nothing in the SQL says the principal is entitled to it.
 * Both narrowings come from the policies and from nowhere else."*
 *
 * 🛑 DO NOT ADD A PREDICATE TO MAKE IT "SAFER". A `WHERE` here would make the
 * handler and the policy two answers to one question, and the handler is the
 * one an attacker gets to influence. The database refusing a write the model
 * also refuses is #157's *"either alone is a defeat"* held in one statement.
 */
const SELECTION_WRITE = 'UPDATE tenant.session SET tenant_id = $1'

/**
 * 🛑 THE MEMBERSHIP STATEMENT USED TO BE DECLARED HERE AND IS NOW IMPORTED —
 * G641, 19 Sep 2026, AND THE MOVE IS A CONTROL RATHER THAN A TIDY-UP.
 *
 * It read `MEMBERSHIP_READ`, `rowToMembership()` and `readMemberships()`, and
 * every word of their argument — *"the `user_id` filter is an INDEX HINT and
 * not a control"*, *"NO LIVENESS TERM IN THIS QUERY"* — travelled with them to
 * `server/data-plane/identity.ts` §5a, which is the module that already owns
 * *"there is no liveness test in this file"*. **The reason they moved is that
 * G641 gave the statement a SECOND caller**: `resolveAuthority()` in
 * `server/data-plane/session.ts` asks the same question on every request, and
 * a second `SELECT … FROM tenant.membership` beside this one is the drift
 * `db/migrations/0035` catalogues in SQL, reproduced in TypeScript.
 *
 * ⚠️ NOTHING ABOUT WHAT D1 DOES CHANGED. The rows this function reads, the
 * columns it reads them from and the absence of a `WHERE` on liveness are
 * byte-for-byte what they were; `tests/db/session-membership-selection.test.ts`
 * assertion (e) still watches the halves compare the same rows.
 */

/** `tenant.tenant` is the narrow projection — four of its five columns are this. */
const TENANT_PROJECTION_READ =
  'SELECT id, environment, residency, deployment_mode FROM tenant.tenant'

/**
 * THE THREE CLOSED SETS `TenantContext` IS MADE OF, NARROWED RATHER THAN
 * TRUSTED.
 *
 * 🛑 A TOTAL `Record` OVER THE MODEL'S UNION, WHICH IS THE DISCIPLINE CLAUDE.md
 * STATES FOR A CLOSED KEY SET — and here it buys something specific: a FOURTH
 * `TenantEnvironment` added to `model/domain.ts` is a **TS2741 at this
 * literal**, so the person who mints it has to decide, in a diff, whether this
 * plane may serve it. A hand-written array of three strings would just go on
 * refusing the fourth as unrecognised, at runtime, in production.
 *
 * ⚠️ `DeploymentMode` AND `RegionKey` ARE NOT RESTATED AT ALL — `DEPLOYMENT_MODES`
 * is already a const object in `model/domain.ts` and `REGION_HOST_LABEL` is
 * already `Record<RegionKey, string>` in `model/serving-host.ts`, so their key
 * sets are read rather than copied. `TenantEnvironment` is a bare union with no
 * const object beside it, which is the only reason one is written here.
 *
 * 🛑 AND `db/migrations/0003_tenant_schema.sql` IS WHY ANY OF THIS IS NEEDED:
 * *"A CHECK constraint is NOT added … a third copy of a closed enum is a third
 * place to drift."* The column is bare `text`. Something has to decide whether
 * the bytes in it are a member, and it is better that the something is the one
 * place the union is total over.
 */
const TENANT_ENVIRONMENTS: Readonly<Record<TenantEnvironment, true>> = {
  sandbox: true,
  evaluation: true,
  production: true,
}

/**
 * 🛑 A ROW THIS PLANE CANNOT CLASSIFY IS A THROW, NOT A GUESS AND NOT A
 * REFUSAL. A guess puts a manufactured compliance posture on the one response
 * every other tier is told to trust; a refusal tells the caller their tenant is
 * not permitted when what happened is that OUR row is wrong. A 500 with the
 * column named in the stack is the only answer that reaches the person who can
 * fix it — the same polarity `server/http/app.ts` uses for its unreachable
 * branch.
 */
function classify<T extends string>(
  members: Readonly<Record<T, unknown>>,
  value: unknown,
  column: string,
): T {
  const found = Object.keys(members).find((m) => m === value) as T | undefined
  if (found === undefined) {
    throw new Error(
      `tenant.tenant.${column} holds a value this plane cannot classify. The column is ` +
        'bare `text` — `db/migrations/0003_tenant_schema.sql` records why no CHECK ' +
        'constraint is added — so the closed set lives in `model/` and this row is ' +
        'outside it. A TenantContext with a guessed posture is worse than a 500.',
    )
  }
  return found
}

/**
 * THE PROJECTION, AND `projectTenantContext()` IS DELIBERATELY NOT CALLED.
 *
 * ⚠️ THAT IS NOT AN OVERSIGHT AND IT IS NOT §5.3. `projectTenantContext(tenant:
 * Tenant)` takes the WHOLE control-owned row — seventeen fields including
 * `accountId`, `retention`, `processingPurpose` and `supportAccessMode` — and
 * `db/migrations/0003_tenant_schema.sql` DROPPED three of them from this
 * database on purpose, because they are control-owned under G185(d). **To call
 * that function this file would have to FABRICATE thirteen fields in order to
 * read four back out**, which is a worse defect than the duplication it would
 * avoid: a fabricated `supportAccessMode` sitting in a local, briefly, is
 * exactly the shape that gets lifted into something that persists.
 *
 * 🛑 WHAT HOLDS THE TWO TOGETHER INSTEAD IS THE TYPE. The return annotation is
 * `TenantContext` — `model/access.ts`'s own declaration, which mirrors
 * `foundation.openapi.yaml` key for key and carries the standing note that it
 * *"gains `orgClass` in the SAME commit as the wire and not before"*. A fifth
 * key added there is a compile error here. That is a weaker tie than one call
 * site and it is the strongest one available while the plane holds a
 * projection rather than a row.
 */
function rowToTenantContext(row: Record<string, unknown>): TenantContext {
  return {
    tenantId: String(row['id']),
    environment: classify(TENANT_ENVIRONMENTS, row['environment'], 'environment'),
    residency: classify(REGION_HOST_LABEL, row['residency'], 'residency'),
    /* `DEPLOYMENT_MODES` is `{ hosted, byoa }` keyed by its own values, so its
     * KEY set IS `DeploymentMode` — read, never copied. */
    deploymentMode: classify(DEPLOYMENT_MODES, row['deployment_mode'], 'deployment_mode'),
  } as TenantContext
}

/**
 * 🛑 THE REFUSAL ARM IS DERIVED FROM THE FUNCTION, NOT TRANSCRIBED FROM IT, AND
 * THIS LINE IS THE ONLY THING S-21 CHANGED IN `server/`.
 *
 * It read `refusal: 'membership_absent'` — a hand copy of a closed union that
 * `model/access.ts` owns — and G199 required that union to gain a second member
 * when the staff arm landed, *"a VISIBLE ADDITION TO A CLOSED UNION rather than
 * a widened predicate inside a function body."* The copy here is what makes
 * such an addition a compile error in a file that should not have an opinion
 * about it: this plane's job is to RELAY a refusal, never to enumerate which
 * ones exist. `Exclude<…, { ok: true }>['refusal']` reads the answer off
 * `selectTenantForSession` itself — already imported as a value — so the next
 * member costs nothing here and cannot be silently dropped either.
 *
 * ⚠️ TYPE-ONLY, AND NO BEHAVIOUR MOVED. The plane still passes no `staffGrant`,
 * so the served path still refuses every platform FDE; making it supply one is
 * a `server/` slice this one was fenced out of, and it is named as owed in
 * `model/access.ts` §7a rather than quietly started here.
 */
type Outcome =
  | { readonly ok: true; readonly tenantId: string }
  | {
      readonly ok: false
      readonly refusal: Exclude<
        ReturnType<typeof selectTenantForSession>,
        { ok: true }
      >['refusal']
    }

/**
 * THE BINDING WRITE, INSIDE THE ONE HELPER THAT CAN SATISFY THE RESTRICTIVE
 * POLICY.
 *
 * `db/selection-scope.ts` is the third named scoped helper and its header is
 * the argument for why it exists: *"PostgreSQL applies row-level security to a
 * table referenced inside a policy expression, as the querying role"*, so
 * inside `withSessionScope()` alone the `EXISTS` over `tenant.membership` is
 * empty and **a legitimate selection is refused**. Both GUCs, or neither.
 *
 * 🛑 THE BODY IS THE SELECTION AND NOTHING ELSE — THE HELPER ASKS FOR THAT IN
 * AS MANY WORDS: *"Inside this transaction every tenant-scoped table for the
 * candidate tenant IS readable … Keep the body of `fn` to the selection and
 * nothing else."* The tenant row is therefore read AFTERWARDS, in an ordinary
 * `withTenantScope()`, on a tenant this caller has by then been proved a
 * member of. Reading it here would hand tenancy metadata for the host's tenant
 * to a caller who holds no membership in it, which is the first half of the
 * cross-tenant read B1 describes.
 */
async function bindTenant(
  pool: TenantPool,
  sessionRef: string,
  session: Session,
  hostBoundTenantId: string,
  now: string,
): Promise<Outcome> {
  return withSelectionScope(pool, sessionRef, hostBoundTenantId, async (tx) => {
    const memberships = await readMemberships(tx, session.userId)
    /**
     * ✅ **THE STAFF GRANT REACHES THE SERVED PATH — G729, 19 Sep 2026 — AND
     * THIS FILE NAMED THE DEBT BEFORE IT PAID IT.** ⚠️ **The sentence that
     * stood on `Outcome` above is QUOTED rather than deleted, because it is
     * the one four documents carried and the one that told a reader an FDE
     * could not reach a tenant over HTTP:** *"TYPE-ONLY, AND NO BEHAVIOUR
     * MOVED. The plane still passes no `staffGrant`, so the served path still
     * refuses every platform FDE; making it supply one is a `server/` slice
     * this one was fenced out of, and it is named as owed in `model/access.ts`
     * §7a rather than quietly started here."* **This is that slice.**
     *
     * 🛑 THE READ IS INSIDE `withSelectionScope()` AND THAT IS WHAT MAKES IT
     * POSSIBLE AT ALL, rather than a convenience. `tenant_access_grant_rls` is
     * 0001's predicate on `app.tenant_id`, and `db/selection-scope.ts` is the
     * one helper that sets BOTH GUCs — its own header records the measurement:
     * *"PostgreSQL applies row-level security to a table referenced inside a
     * policy expression, as the querying role … and to
     * `tenant.tenant_access_grant` inside the staff disjunct, which is the
     * same second narrowing for free."* Inside `withSessionScope()` alone this
     * statement returns nothing and every FDE is refused as if no grant
     * existed.
     *
     * ⚠️ AND THE BODY IS STILL THE SELECTION AND NOTHING ELSE — the helper
     * asks for that in as many words. Two reads and one write, all of them
     * about whether this principal may be scoped here; the tenant row is
     * still read AFTERWARDS, in an ordinary `withTenantScope()`.
     *
     * 🛑 A FAILED READ REFUSES THE SELECTION RATHER THAN PROCEEDING WITHOUT
     * THE GRANT. Proceeding would turn our substrate defect into
     * `membership_absent` on the wire — a fact about us reported as a fact
     * about whether anybody ever granted this person access — which is the
     * collapse `readPartnerGrant()` forbids in capitals one table over.
     */
    const staffGrant = await readStaffGrant(tx, session.userId)
    if (!staffGrant.ok) {
      console.error(`data-plane: the staff-grant read refused — ${staffGrant.refusal}`)
      return { ok: false, refusal: TENANT_SELECTION_REFUSALS.membershipAbsent } as const
    }
    const selection = selectTenantForSession({
      session,
      hostBoundTenantId: hostBoundTenantId as TenantId,
      memberships,
      now: now as Timestamp,
      staffGrant: staffGrant.grant,
    })
    if (!selection.ok) return { ok: false, refusal: selection.refusal } as const
    await tx.query(SELECTION_WRITE, [selection.tenantId])
    return { ok: true, tenantId: String(selection.tenantId) } as const
  })
}

/**
 * The refusal sentences. Constants, every one of them — `errors.yaml` forbids
 * `detail` from carrying anything request-derived, and a refusal that named the
 * host or the tenant would turn this operation into a registry oracle for
 * anybody holding a session.
 */
const DETAIL = {
  noRow:
    'This caller authenticated without a session row, so there is no session to bind a ' +
    'tenant to. A locally minted test token arrives already scoped and cannot be ' +
    'rescoped; only a real session can be.',
  hostUnresolved:
    'No tenant is served on the host this request arrived at. A host resolves to a tenant ' +
    'through the published registry or not at all — there is no pattern, no fallback and ' +
    'no default.',
  membership:
    'This principal holds no live membership in the tenant served here. Revoked, expired ' +
    'and never-granted are one answer on purpose: telling them apart would disclose that ' +
    'the tenant exists and that they were once in it.',
  bound:
    'The tenant was bound and its row could not be read back inside the scope that binding ' +
    'opened. Nothing is returned rather than a context assembled from a partial read.',
} as const

/**
 * ⚠️ `startedElsewhere()` LIVED HERE UNTIL 2 Oct 2026 AND IS MOVED, NOT
 * DELETED — G3231. It is `server/http/cross-origin.ts`'s now, byte-for-byte,
 * and it is asked by the transport's `onRequest` hook for EVERY non-safe,
 * secured, person-facing operation rather than by this handler for D1 alone.
 */
/**
 * ⚠️ THE 403s BELOW ARE THE CONTRACT'S OWN RESPONSE SET AND NOT A CHOICE MADE
 * HERE. D1 declares exactly three responses — `200`, `401` (`Unauthenticated`)
 * and `403` (`Denied`). A 404 for an unregistered host would read better and is
 * NOT AVAILABLE: inventing a status the document does not declare is a contract
 * change, and a contract change is not this slice's to make. Both non-200
 * outcomes are therefore "authenticated, and not permitted", which is true of
 * both.
 */
export function resolveTenantContextHandler(
  pool: TenantPool,
  registry: readonly ServingHost[],
): Handler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const principal = principalOf<TenantSession>(request)
    const { row, sessionRef } = principal

    /**
     * ═════════════════════════════════════════════════════════════════════
     * 🛑 D1 READS THE COOKIE — G3006, 2 Oct 2026, THE OWNER'S RULING, AND THE
     *    TWO-CHANNEL COMPARISON THAT STOOD HERE IS DELETED (G3211).
     * ═════════════════════════════════════════════════════════════════════
     *
     * *"D1 reads the cookie: POST /context/resolve takes the session from the
     * HttpOnly cookie (not the body); the tenant still comes only from the
     * host registry and selectTenantForSession() still checks
     * membership/grant. Mint stays tenant-less (G726/S2 unchanged)."*
     *
     * ⚠️ THE OLD BLOCK IS QUOTED RATHER THAN SILENTLY REMOVED, because its
     * argument was right about the contract it was written against: *"The
     * same credential is demanded in two places … Requiring them to be equal
     * makes 'which one did you honour' a question with no answer rather than
     * a question with a surprising one. THE FIX IS A CONTRACT CHANGE AND IT IS
     * NOT THIS SLICE'S TO MAKE: either the body loses `sessionToken` or the
     * operation declares `security: []`."* **This is that contract change, and
     * it took the first of the two.** The body is a closed EMPTY object in
     * `foundation.openapi.yaml`, so ajv refuses a smuggled `sessionToken` or
     * `tenantId` with a 400 before this handler runs (G191's
     * `removeAdditional: false`) — and there is no second channel left to
     * disagree with the first. The handle reaches this plane through
     * `sessionCookieFrom()` and, behind `RECONCILE_LOCAL_TEST_AUTH` alone, the
     * dev header reader; `resolveSessionReader()` chose which at boot.
     *
     * 🛑 AND THE DELETION WAS FORCED, NOT TIDY: the cookie is `HttpOnly`, so
     * page script cannot read it and therefore cannot copy it into a body.
     * With the body field required, D1 was uncallable by the one client G386
     * built the cookie for — every browser request would have been a 401.
     *
     * ═════════════════════════════════════════════════════════════════════
     * 🛑 CSRF — G3212, AND THE CHECK THAT STOOD HERE HAS MOVED TO THE
     *    TRANSPORT (G3231). IT WAS NOT DELETED.
     * ═════════════════════════════════════════════════════════════════════
     *
     * This handler opened with `if (startedElsewhere(request)) { 401 }`, and
     * G3212's row recorded why that was not enough: *"⚠️ SCOPED TO D1:
     * `assignException` (a `PUT`) and the other cookie-authenticated writes do
     * not carry it — owed, and the authenticator is the right home."* The
     * `onRequest` hook in `server/http/app.ts` now asks the same predicate for
     * every non-safe, secured, person-facing route — D1 included — BEFORE the
     * session is read, so a refused request still binds nothing and still
     * revokes nothing. `tests/http/context-resolve.test.ts` a5/a6 are
     * unchanged and still pass, which is the evidence D1 lost nothing.
     */
    if (row === null || sessionRef === null) {
      return sendProblem(reply, {
        status: 403,
        code: CODES.tenantContextMissing,
        title: 'This session cannot be scoped.',
        detail: DETAIL.noRow,
      })
    }

    /**
     * 🛑 THE HOST IS READ ONCE, HERE, AND THE BINDING WAS ALREADY CHECKED
     * AGAINST IT. `server/data-plane/session.ts` runs `checkHostBinding()` on
     * every request before this handler exists, so the host this resolves
     * against is BYTE-EQUAL to the one the session was issued on — G180. The
     * registry lookup below therefore cannot name a different tenant than the
     * session's own host would.
     */
    const host = typeof request.headers.host === 'string' ? request.headers.host : ''
    const served = resolveServingHost(registry, host)
    if (!served.ok) {
      return sendProblem(reply, {
        status: 403,
        code: CODES.tenantContextMissing,
        title: 'No tenant is served here.',
        detail: DETAIL.hostUnresolved,
      })
    }

    /**
     * ⚠️ SUPPLIED RATHER THAN READ INSIDE THE MODEL, for `PrincipalContext.now`'s
     * reason — *"a decision has to be reproducible in an audit"*. The database
     * half uses `now()`, the transaction's clock, because a policy expression
     * has no parameter to take; `db/migrations/0005_session_and_membership.sql`
     * names the divergence and its size: *"They agree to within one
     * transaction, which is the whole of the exposure."*
     */
    const now = new Date().toISOString()
    const outcome = await bindTenant(pool, sessionRef, row, String(served.tenantId), now)
    if (!outcome.ok) {
      return sendProblem(reply, {
        status: 403,
        code: CODES.membershipAbsent,
        title: 'No live membership in the tenant served here.',
        detail: DETAIL.membership,
      })
    }

    const context = await withTenantScope(pool, outcome.tenantId, async (tx) => {
      const result = await tx.query(TENANT_PROJECTION_READ)
      const rows = result.rows as Array<Record<string, unknown>>
      const only = rows[0]
      return only === undefined || rows.length !== 1 ? null : rowToTenantContext(only)
    })

    if (context === null) {
      /**
       * Reachable only if the tenant row vanished between the membership check
       * and this read, or if `tenant_rls` narrowed to something other than one
       * row. Both are our failure and neither is the caller's to diagnose.
       */
      return sendProblem(reply, {
        status: 403,
        code: CODES.tenantContextMissing,
        title: 'The tenant context could not be read.',
        detail: DETAIL.bound,
      })
    }

    return reply.send(context)
  }
}
