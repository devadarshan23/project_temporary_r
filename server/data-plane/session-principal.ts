/**
 * `getSessionPrincipal` — `GET /session/principal`. WHO THE CALLER IS, for
 * the chrome's who-am-I. G3354–G3360, 3 Oct 2026 (DERIVED — NOT THE OWNER'S).
 *
 * THE LIVE FINDING (staging, 3 Oct 2026, the mock persona on `/close`): the
 * account menu read *"Signed in · your account"* and the entity switcher
 * *"All entities"*, because no served operation named the signed-in PERSON and
 * `TenantContext` carries no tenant NAME. Drawing either would have been the
 * frontend inventing it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THREE READS, EACH IN THE ONE SCOPE THAT ADMITS IT, AND NOTHING ELSE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   the person     `SELECT display_name, email FROM tenant."user"` inside
 *                  `withSessionScope()`. 🛑 NO `WHERE`: `user_visible_to_session`
 *                  (`0009`) admits exactly the row the presented digest names —
 *                  the same property `readSubjectRows()` states about its own
 *                  read. A predicate here would make the target a value this
 *                  handler chose.
 *   the org class  `orgFor(connection.owner)` — G289's ONE producer — over the
 *                  door `readSubjectRows()` reads in the same scope. ⚠️ NOT
 *                  `TenantSession.principal.orgClass`, AND THAT WAS MEASURED:
 *                  `principal` is `null` for a live UNSCOPED session on a
 *                  tenant host (`session.ts` says so), so a handler keyed on it
 *                  answered such a person 401 — witnessed RED at
 *                  `tests/http/session-principal-served.test.ts` §3. The same
 *                  function over the same row is not a second producer.
 *   the tenant     the id is `Session.tenantId`, the row D1 wrote — invariant 1,
 *                  read off the session and never off the request. The NAME is
 *                  `tenancy_roster.name` in the CONTROL database, through the
 *                  data plane's read-only control pool (G1161).
 *
 * 🛑 WHY THE ROSTER AND NOT A COLUMN ON `tenant.tenant` — AND THIS IS THE ONE
 * DECISION A READER'S INSTINCT GETS BACKWARDS. The obvious repair is
 * `ALTER TABLE tenant.tenant ADD COLUMN name`, and it is REFUSED BY A RULING:
 * G185(d) makes the tenant's name a CONTROL-OWNED fact, `0003` dropped it from
 * the data projection on exactly that ground, and
 * `tests/db/tenant-projection.test.ts` holds the absence as an exact column set.
 * The roster is where the name already lives (`0002_tenancy_roster.sql`), and
 * a second copy would be §5.3 with no publication path between the two.
 *
 * ⚠️ THE ROSTER READ CARRIES A `WHERE tenant_id = $1`, AND THAT IS THE ONE
 * TENANT PREDICATE IN THIS FILE — STATED RATHER THAN HIDDEN. The control
 * database has no row-level security (`0001`'s and `0002`'s argument: there is
 * no tenant session there), so the bind IS the narrowing. What makes it safe is
 * WHERE THE VALUE COMES FROM: the session row's `tenant_id`, which D1 bound
 * after `selectTenantForSession()` checked a live membership or staff grant.
 * Nothing in the request can reach it — the operation declares no parameter
 * and no body, and its querystring schema is closed (G941). And the column
 * read is `name` alone: never `plan`, `support_access_mode` or anything else
 * the platform sold.
 *
 * ⚠️ INVARIANT 3 IS UNTOUCHED, IN THE DIRECTION G1161 ARGUES: this is the DATA
 * plane reading the CONTROL database DOWNWARD, through a role holding `SELECT`
 * on one table in a `BEGIN READ ONLY` transaction. The control plane reads
 * nothing here.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * INVARIANT 6 / D6-9 — A DIRECTORY-SUPPLIED DISPLAY NAME IS DATA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `display_name` and `email` were written at first sign-in from the
 * directory's claims, verbatim (R5/R6), and under BYOA that directory is the
 * CUSTOMER's. This module parses neither, branches on neither, logs neither and
 * sends neither anywhere but the one response body whose schema calls them
 * text. It calls no model — `tests/http/directory-text-reaches-no-model.test.ts`
 * walks this file with the rest of `server/`. 🛑 `0009`'s own sentence is the
 * licence and the limit: *"The day something renders a name, that is a new read
 * with its own classification question."* The answer here is that the subject
 * of the read is the person reading it — the one principal to whom disclosing
 * their own name and address discloses nothing — and that is why this read is
 * keyed on the session and on nothing a caller can choose.
 *
 * ⚠️ `USER_READ` IN `identity.ts` IS NOT WIDENED, DELIBERATELY: that statement
 * feeds `PrincipalContext`, which is *"structurally narrowed to `{ userId,
 * status }` … so that no evaluation can reach an email, a display name"*. This
 * is a separate statement in a separate module so that narrowing survives.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * `capabilities` — WHAT THIS SESSION MAY DO, FOR DRAWING (G3521, 3 Oct 2026)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * C9 row #22 (*"Admin is a capability, not a person"*) and G3193 (a refused
 * control is HIDDEN) both need the client to know which verbs it holds, and
 * G2871 measured that nothing served told it. The answer is
 * `heldCapabilities()` over the plane's OWN `CapabilityAuthoriser` — the
 * function the gate calls — so it is the gate's verdicts read back, never a
 * second evaluator. A session `decide()` cannot assemble a principal for (an
 * unbound session on a tenant host) answers `[]`, which is also what the gate
 * would do to every gated operation. 🛑 ADVISORY: every operation still gates.
 * It names verbs the caller holds and never a role, an assignment or anybody
 * else, so the "nothing about anybody else" property survives.
 *
 * ⚠️ NO INVARIANT 10 RECORD, AND THE ABSENCE IS THE `exempt` VERDICT'S: the
 * operation names no capability, so the sixth fence does not apply — the same
 * position `signOut` takes about the same row.
 */

import type { FastifyReply, FastifyRequest } from 'fastify'

import { withSessionScope } from '../../db/session-scope.ts'
import { withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import { orgFor, type Capability } from '../../model/access.ts'
import { principalOf, sendProblem, type CapabilityAuthoriser, type Handler } from '../http/app.ts'
import { CODES } from '../http/problem.ts'
import { heldCapabilities } from './authorise.ts'
import { readSubjectRows } from './identity.ts'
import type { ResolvedPrincipal, TenantSession } from './session.ts'

/** The person, as stored. No `WHERE` — the policy names the caller. */
export const PERSON_DISPLAY_READ = 'SELECT display_name, email FROM tenant."user"'

/**
 * The bound tenant's name, from the DATA plane's projection — G4313, 5 Oct
 * 2026, THE OWNER'S "Full restore" ruling: *"copy the tenant name to the data
 * plane"*. ⚠️ THIS READ `tenancy_roster` IN THE CONTROL DATABASE through the
 * read-only control pool until then (G3356, quoted rather than deleted:
 * `SELECT name FROM tenancy_roster WHERE tenant_id = $1`), which put the control
 * database on the tenant hot path. The projection is pulled over the signed
 * internal edge by `tenant-name-sync.ts`. No `WHERE`, for the person read's
 * reason: the policy names the scope's one row.
 */
export const TENANT_NAME_READ = 'SELECT name FROM tenant.tenant_name_projection'

/**
 * G4046 — THE OWNER'S RULING, 4 Oct 2026: *"Declare tenant currency."* The
 * bound tenant's declared reporting currency, from `0560`'s DATA-PLANE table.
 *
 * 🛑 NO `WHERE`, FOR THE PERSON READ'S REASON: it runs inside
 * `withTenantScope()` on the SESSION ROW's tenant (invariant 1), and
 * `tenant_reporting_currency_rls` is `0001`'s predicate verbatim, so the
 * policy names the one row a tenant may have. A `WHERE tenant_id = $1` would
 * make the target a value this handler chose.
 *
 * ⚠️ NOT THE ROSTER, THOUGH THE NAME IS THERE: G185(d) limits the control-owned
 * row to identification and placement, and a reporting currency is neither —
 * `0560` §0 argues it.
 */
export const REPORTING_CURRENCY_READ = 'SELECT currency FROM tenant.tenant_reporting_currency'

/** ISO 4217 by SHAPE — never as a member (`model/money.ts`). `0560` §2. */
const CURRENCY_SHAPE = /^[A-Z]{3}$/

/** An arm of `ResolvedPrincipal` that carries role assignments. */
type HeldArm = 'held' | 'platformHeld' | 'partnerHeld'
const HELD_ARMS: readonly HeldArm[] = ['held', 'platformHeld', 'partnerHeld']

/**
 * G4045 — THE OWNER'S RULING, 4 Oct 2026: *"Serve role labels."* The labels of
 * the roles this session LIVE-holds.
 *
 * 🛑 NO NEW READ AND NO NEW REACH. The assignments are the ones the
 * authenticator ALREADY resolved for this session — `readHeldAssignments()`
 * (`WHERE a.user_id = $1`, the caller's own id, inside the session's bound
 * tenant under `0009`'s `role_assignment_rls`), `readPlatformHeld()` and
 * `readPartnerHeld()` (both keyed on the acting session by policy). So a label
 * here is a role THIS person was assigned, in THIS session's scope, and never
 * another member's.
 *
 * 🛑 "LIVE" IS THE GATE'S WORD, NEVER A SECOND PREDICATE (§5.3). `decide()`
 * states liveness inline — revoked, expired, role not active, version moved,
 * a durable assignment refused for the org — and a copy here would be the
 * copy that drifts. So each assignment is put to the SAME authoriser the gate
 * uses, ALONE: a principal holding that one assignment and nothing else on
 * any arm, and no staff grant (a grant is not a role, and it would make a
 * dead role look live). The role is named iff at least one capability it
 * carries is then `held`. A role that confers nothing is therefore not named,
 * which is the honest answer: it is not a role this person can act in.
 *
 * ⚠️ TENANT-AUTHORED TEXT, RETURNED AS STORED (D6-9). The client renders each
 * label as a text node.
 */
export function liveRoleLabels(
  authorise: CapabilityAuthoriser<TenantSession>,
  session: TenantSession,
): string[] {
  const principal = session.principal
  if (principal === null) return []
  const labels: string[] = []
  for (const arm of HELD_ARMS) {
    const list = principal[arm] ?? null
    if (list === null) continue
    for (const one of list) {
      const alone: ResolvedPrincipal = {
        ...principal,
        held: principal.held === null ? null : arm === 'held' ? [one as never] : [],
        platformHeld: principal.platformHeld === null ? null : arm === 'platformHeld' ? [one as never] : [],
        partnerHeld: (principal.partnerHeld ?? null) === null ? null : arm === 'partnerHeld' ? [one as never] : [],
        staffGrant: null,
      }
      const probe: TenantSession = { ...session, principal: alone }
      const carried = one.role.capabilities as readonly Capability[]
      if (!carried.some((c) => authorise(probe, c) === 'held')) continue
      const label = one.role.label
      if (typeof label === 'string' && !labels.includes(label)) labels.push(label)
    }
  }
  return labels
}

const NO_PERSON =
  'This caller authenticated without a session row, so there is no person to name. ' +
  'A locally minted test token is not a session.'

export function getSessionPrincipalHandler(
  pool: TenantPool,
  authorise: CapabilityAuthoriser<TenantSession>,
): Handler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const session = principalOf<TenantSession>(request)
    const { sessionRef, row } = session
    if (sessionRef === null || row === null) {
      return sendProblem(reply, {
        status: 401,
        code: CODES.sessionInvalid,
        title: 'There is no signed-in person behind this credential.',
        detail: NO_PERSON,
      })
    }

    const { people, subject } = await withSessionScope(pool, sessionRef, async (tx) => {
      const r = await tx.query(PERSON_DISPLAY_READ)
      return { people: r.rows as Array<Record<string, unknown>>, subject: await readSubjectRows(tx) }
    })
    if (!subject.ok) {
      /* The authenticator read these rows a moment ago; a refusal now is a
         substrate defect, and it goes to the operator's log — never to the
         caller, for `session.ts`'s reason. */
      throw new Error(`getSessionPrincipal could not read the caller's subject — ${subject.refusal}`)
    }
    const person = people[0]
    if (person === undefined || people.length !== 1) {
      /* The authenticator resolved this person a moment ago in the same
       * scope; one row is the only answer that is not a substrate defect. */
      throw new Error(`getSessionPrincipal read ${String(people.length)} person rows, not the caller's one`)
    }
    const displayName = person['display_name']
    const email = person['email']
    if (typeof displayName !== 'string' || typeof email !== 'string') {
      throw new Error('getSessionPrincipal read a person row whose name or address is not text')
    }

    let tenant: { tenantId: string; name: string | null; reportingCurrency: string | null } | null = null
    const bound = row.tenantId
    if (bound !== null) {
      /* G4046 — the SESSION ROW's tenant, never the request's (invariant 1). */
      const { declared, names } = await withTenantScope(pool, bound, async (tx) => {
        const r = await tx.query(REPORTING_CURRENCY_READ)
        const n = await tx.query(TENANT_NAME_READ)
        return {
          declared: r.rows as Array<Record<string, unknown>>,
          names: n.rows as Array<Record<string, unknown>>,
        }
      })
      /* G4313 — the projection's one row, or none: an unpulled tenant is
         `null`, never the id dressed as a name. */
      const name = names[0]?.['name']
      if (declared.length > 1) {
        /* The PRIMARY KEY makes this unrepresentable; a second row would mean
           the policy admitted another tenant's. Operator's log, never the caller. */
        throw new Error(`getSessionPrincipal read ${String(declared.length)} reporting-currency rows, not at most one`)
      }
      const currency = declared[0]?.['currency']
      if (currency !== undefined && (typeof currency !== 'string' || !CURRENCY_SHAPE.test(currency))) {
        /* `0560` §2's CHECK forbids it; a malformed declaration is a substrate
           defect, and it is REFUSED rather than published or defaulted. */
        throw new Error('getSessionPrincipal read a reporting currency that is not ISO 4217 shaped')
      }
      tenant = {
        tenantId: bound,
        name: typeof name === 'string' ? name : null,
        /* `0560` §1 — no row is "declared none": `null`, never a default. */
        reportingCurrency: currency ?? null,
      }
    }

    reply.header('cache-control', 'no-store')
    return {
      userId: subject.rows.user.id,
      displayName,
      email,
      orgClass: orgFor(subject.rows.connection.owner),
      tenant,
      /* G3521 — the gate's own authoriser, asked once per verb. ADVISORY:
         the client hides what is absent; every operation still gates. */
      capabilities: heldCapabilities(authorise, session),
      /* G4045 — the gate's own authoriser again, one assignment at a time. */
      roles: liveRoleLabels(authorise, session),
    }
  }
}
