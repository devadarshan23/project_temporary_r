/**
 * THE SHIPPING SEED IS DRIVEN — `listTenants` REACHED BY THE PRINCIPAL
 * `server/dev/identity-seed.ts` ACTUALLY WRITES, OVER A SOCKET, AGAINST TWO
 * REAL DATABASES AND THE PRODUCTION AUTHORISER.
 *
 * **W2-C0 · R-P (THE OWNER'S) and G1385–G1388, 21 Sep 2026.**
 *
 * ┌─ WHY THIS FILE EXISTS AND WHY IT IS NOT A DUPLICATE OF ───────────────────┐
 * │  `tests/http/console-roster-served.test.ts`                               │
 * │                                                                            │
 * │  That suite builds its OWN substrate — its own door, its own person, its   │
 * │  own platform role — and proves that the OPERATION is correct. **This one  │
 * │  proves that the SEED is**, by calling `seedIdentitySubstrate()` itself    │
 * │  and driving the handle that function prints.                              │
 * │                                                                            │
 * │  🛑 THE GAP IS NAMED BY THE SEED IN ITS OWN VOICE, AND IT IS WHY THE LAST  │
 * │  DEFECT IN THAT FILE SURVIVED TO SHIP: *"AND THE DEFECT WAS INVISIBLE TO   │
 * │  EVERY TEST, WHICH IS WHY IT SURVIVED. `tests/e2e/browser-login.test.ts`   │
 * │  seeds its OWN three capability rows and never loads this module;          │
 * │  `tests/http/` suites build their own substrates. **Nothing in the gate    │
 * │  drives the shipping seed**, so the only observer was a person running the │
 * │  local stack by hand — which is exactly who this file exists for."*        │
 * │                                                                            │
 * │  The shipping seed then spent a release producing a subject that was       │
 * │  **403 on the product's own operator surface**. This suite is the          │
 * │  observer that sentence says does not exist.                               │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE RED THIS FILE WAS WITNESSED AGAINST — AND IT WAS NOT THE RED THAT WAS
 *    PREDICTED, WHICH IS THE MOST USEFUL THING IN THIS HEADER.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * W2-C0 expected `platform_assignment_absent` — a 403 from `decide()`'s fourth
 * arm, because nothing had ever written a `platform_role_assignment` row. **The
 * first run answered a 401 instead, and so did the TENANT operator, which had
 * nothing to do with the console work.** Captured verbatim:
 *
 *     §1  401  {"code":"session_invalid", …}   <- console principal
 *     §2  401  {"code":"session_invalid", …}   <- the SEEDED TENANT OPERATOR
 *
 * 🛑 **§2 IS THE FINDING. THE SHIPPING SEED'S TENANT SUBJECT COULD NOT
 *    AUTHENTICATE AT ALL — G1386.** `seedIdentitySubstrate()` writes a session
 *    already BOUND to `ten_acme` and wrote **no `tenant.membership` row**, and
 *    G641 put the membership-liveness question on EVERY request:
 *    `resolveAuthority()` calls `holdsLiveMembership()` directly, and that
 *    predicate **refuses an ABSENT membership too, deliberately** — *"the
 *    narrow reading … is §5.1, and it fails OPEN, because deleting the row
 *    would then buy a permanent session."* A 401 and not a 403, because naming
 *    the term would tell whoever holds the handle that their membership lapsed
 *    and roughly when.
 *
 * **So the predicted 403 was never reachable: the caller never got as far as
 * the gate.** Both reds are recorded because a header that reported only the
 * expected one would be describing a run that never happened.
 *
 * ⚠️ THE 403 IS REAL AND WAS SIMPLY BEHIND THE 401 — `decide()`'s fourth arm
 * reads `platformHeld`, which was `[]` for every principal the substrate could
 * produce (G289's own *"NOTHING PRODUCES A `PlatformRoleAssignment`"*, still
 * true on the day `listTenants` mounted). Derive the absence that used to be —
 * and note the command is anchored to the statement's own line ending rather
 * than to the words, because a recursive grep for prose ABOUT an insert matches
 * prose about an insert (G978):
 *
 *     grep -rc 'INTO tenant.platform_role_assignment$' server/dev/identity-seed.ts
 *
 * → **1** now; **0** across all of `db/` and `server/` before R-P. So
 * `listTenants` was **mounted and unreachable by every real caller**, and a
 * mounted operation nobody can call is not a served operation. That is the
 * whole of why R-P calls the seed a PREREQUISITE and not a convenience.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 §3 IS INVARIANT 8 AND IT IS THE ASSERTION MOST LIKELY TO BE READ AS
 *    OPTIONAL. IT IS NOT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Copy it, never paraphrase it: *"Being staff is not access."* The seeded FDE
 * reaches the FLEET ROSTER and must reach NO TENANT'S DATA — so §3 drives the
 * console principal at a tenant-tier operation and requires a refusal. A seed
 * that handed a staff person a membership would pass §1 and quietly demonstrate
 * the customer arm instead of the platform one.
 *
 * ⚠️ THE FLAG IS DELETED HERE, exactly as `console-roster-served.test.ts`
 * deletes it, and the reason is sharper in this file than in that one: under
 * `RECONCILE_LOCAL_TEST_AUTH` nothing resolves a subject and `decide()` is
 * never reached through its real terms — so the suite that exists to prove the
 * SEED works would be asserting the dev-token arm instead. **The seed is
 * called directly; the flag gates the IMPORT in `migrate-main.ts`, not the
 * function.** §4 asserts that import fence separately and as source.
 *
 * ⚠️ IT NEEDS BOTH DATABASES AND SKIPS LOUDLY WITHOUT THEM. A run in which this
 * file skipped is NOT evidence that the local stack's seeded console principal
 * can reach anything.
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import { controlDbPort } from '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { request as httpRequest } from 'node:http'

import { databaseRequiredUnderCi } from '../reachability.ts'

/* ------------------------------------------------------------------ *
 * TWO DATABASES, BOTH NAMED BEFORE ANYTHING READS A VARIABLE.
 *
 * `db/env.ts` and `server/control-plane/config.ts` both resolve per call rather
 * than at import, which is what makes a per-suite database possible while
 * agents gate concurrently.
 * ------------------------------------------------------------------ */

const CONTROL_DB =
  process.env['RECONCILE_CONSOLE_SEED_CONTROL_DB_NAME'] ?? runScopedName('reconcile_console_seed_control_test')
const TENANT_DB =
  process.env['RECONCILE_CONSOLE_SEED_TENANT_DB_NAME'] ?? runScopedName('reconcile_console_seed_tenant_test')

process.env['RECONCILE_CONTROL_DB_NAME'] = CONTROL_DB
process.env['RECONCILE_CONTROL_READ_DB_NAME'] = CONTROL_DB
process.env['RECONCILE_DB_NAME'] = TENANT_DB
if ((process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? '') === '') {
  process.env['RECONCILE_CONTROL_DB_ADMIN'] = process.env['USER'] ?? 'postgres'
}

/** See the header: the dev-token arm would replace the thing under test. */
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

const { probeDatabase, describeTarget } = await import('../../db/env.ts')
const { loadPg } = await import('../../db/pg.ts')

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/http/console-seed-served.test.ts DID NOT RUN.',
      '',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS IS THE ONLY PLACE THE SHIPPING SEED IS DRIVEN END TO END. Every',
      '   other suite builds its own substrate, which is exactly how the seed',
      '   last shipped a subject that was 403 on the operator surface. A run in',
      '   which this file skipped is NOT evidence that the local stack works.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the seeded console principal', probe)

import { resetSchema, seedTwoTenants } from '../../db/provision.ts'
import { startDataPlane } from '../../server/data-plane/start.ts'
import { provisionControlPlane, seedTenancyRoster } from '../../server/control-plane/provision.ts'
import {
  seedIdentitySubstrate,
  SEED_CONSOLE_HANDLE,
  SEED_CONSOLE_HOST,
  SEED_CONSOLE_USER,
  SEED_HANDLE,
  SEED_HOST,
  SEED_TENANT,
} from '../../server/dev/identity-seed.ts'
import { sessionCookie } from './harness.ts'
import { startInternalPair, type InternalPair } from './internal-pair.ts'
import { runScopedName } from '../run-scoped-db.ts'

/**
 * THE HOSTS THE SEED'S TWO SESSIONS ARE BOUND TO, REGISTERED THE WAY A LOCAL
 * OPERATOR MUST REGISTER THEM.
 *
 * 🛑 TWO VARIABLES AND NOT ONE, AND THE CONSOLE LINE IS FLAT. G297: *"a console
 * has no tenant and a region label on one would assert a residency invariant 3
 * says the control plane does not have"*, and
 * `checkConsoleHostRegistration()` refuses a labelled one AT BOOT. These lines
 * are the ones `SEED_HOST` and `SEED_CONSOLE_HOST` tell an operator to set, so
 * a change to either constant that nobody mirrored here is a red here rather
 * than a 401 nobody can explain at 2am.
 */
process.env['RECONCILE_SERVING_HOSTS'] = `${SEED_HOST}|${SEED_TENANT}|ap-southeast-1|pooled|active`
process.env['RECONCILE_CONSOLE_HOSTS'] = `${SEED_CONSOLE_HOST}|staff|active`

const ROSTER_PATH = '/v1/staff/tenants'
/** A tenant-tier read, for §3's differential. `admit_source`, which the FDE has not got. */
const RUNS_PATH = '/v1/runs'

interface Response {
  readonly status: number
  readonly body: Record<string, unknown> | undefined
  readonly text: string
}

/**
 * `node:http` AND NEVER `fetch`, for `tests/http/context-resolve.test.ts`'s
 * reason: `Host` is a forbidden header name in the Fetch standard and undici
 * drops it, so every host-binding assertion would be about a binding this file
 * did not choose.
 */
function send(
  origin: string,
  path: string,
  opts: { host: string; session?: string },
): Promise<Response> {
  const url = new URL(origin)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path,
        method: 'GET',
        headers: {
          Host: opts.host,
          ...(opts.session === undefined ? {} : sessionCookie(opts.session)),
        },
      },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => {
          text += chunk
        })
        res.on('end', () => {
          let body: Record<string, unknown> | undefined
          try {
            const parsed: unknown = JSON.parse(text)
            body =
              typeof parsed === 'object' && parsed !== null
                ? (parsed as Record<string, unknown>)
                : undefined
          } catch {
            body = undefined
          }
          resolve({ status: res.statusCode ?? 0, body, text })
        })
      },
    )
    req.on('error', reject)
    req.end()
  })
}

async function createDatabaseIfAbsent(name: string): Promise<void> {
  const { Client } = await loadPg()
  const admin = new Client({
    host: '127.0.0.1',
    port: controlDbPort(),
    database: 'postgres',
    user: process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? 'postgres',
    application_name: 'reconcile-console-seed-setup',
  })
  await admin.connect()
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])
    // CREATE DATABASE cannot run inside a transaction block, hence no BEGIN.
    if (exists.rowCount === 0) await admin.query(`CREATE DATABASE ${name}`)
  } finally {
    await admin.end()
  }
}

describe('the seeded console principal reaches the fleet roster', { skip }, () => {
  let plane: { url: string; close: () => Promise<void> }
  let pair: InternalPair | undefined
  /** What the seed reports about itself. §5 reads it rather than re-deriving it. */
  let summary: string

  before(async () => {
    await createDatabaseIfAbsent(CONTROL_DB)
    await provisionControlPlane()
    /* Roster AND onboarding rows, in one transaction — `seedTenancyRoster()`
       writes both deliberately, because `console-roster-store.ts` answers
       `onboarding_record_absent` and takes the WHOLE response down rather than
       publishing a tenant whose stage it had to invent. A roster seeded without
       them is a roster nothing can read. */
    await seedTenancyRoster()

    await createDatabaseIfAbsent(TENANT_DB)
    await resetSchema()
    await seedTwoTenants(SEED_TENANT, 'ten_globex')

    /* 🛑 THE SHIPPING SEED ITSELF, AND THAT IS THE ENTIRE POINT OF THIS FILE.
       Not a fixture that resembles it. If this call stops writing what the
       console principal needs, this suite goes red and the local stack and the
       e2e browser run stop being reachable in the same commit. */
    summary = await seedIdentitySubstrate()

    /**
     * 🛑 NO `authorise` AND NO `substrate` ARGUMENT — THE PRODUCTION SEAMS,
     * which is the only thing that makes a green 200 below worth anything: the
     * verdict comes from `decide()` against a principal assembled entirely out
     * of the rows the seed wrote.
     */
    /* G4318 — the roster now reaches the data plane over the signed internal
       edge, from a REAL control plane over this database (local internal token,
       passed as an argument). The data plane holds no control-database pool. */
    pair = await startInternalPair()
    plane = await startDataPlane({ poolMax: 4, controlPlane: pair.client })
  })

  after(async () => {
    if (plane !== undefined) await plane.close()
    if (pair !== undefined) await pair.close()
  })

  /* ================================================================ *
   * §1 · THE PREREQUISITE. THIS IS THE ASSERTION THAT WAS RED.
   * ================================================================ */

  it('1 · the SEEDED platform principal gets a 200 from `listTenants`', async () => {
    const res = await send(plane.url, ROSTER_PATH, {
      host: SEED_CONSOLE_HOST,
      session: SEED_CONSOLE_HANDLE,
    })
    assert.equal(
      res.status,
      200,
      'THE SHIPPING SEED DOES NOT PRODUCE A PRINCIPAL THAT CAN REACH THE ONE CONSOLE ' +
        'OPERATION EITHER PLANE MOUNTS. ⚠️ READ THE STATUS BEFORE ASSUMING WHICH FENCE ' +
        'REFUSED: a 401 is the SESSION (the handle, the host binding under G180, or ' +
        'G641\'s per-request membership check) and a 403 is the GATE ' +
        '(`platform_assignment_absent`). Before R-P this answered 401, not the 403 that ' +
        'was predicted, because the caller never got as far as the gate. Five things ' +
        'must hold at once: the seed writes a PLATFORM-owned `identity_connection` (so ' +
        '`orgFor()` derives `platform` — federation is never a source of organisation), ' +
        'a person on it, a `platform_role` carrying `view_substrate`, a LIVE ' +
        '`platform_role_assignment` (`expires_at` is NOT NULL by construction, because ' +
        '`DURABLE_ASSIGNMENT_PERMITTED.platform` is false), and a session with ' +
        `\`tenant_id\` NULL bound to a REGISTERED console host. Body: ${res.text}`,
    )

    const tenants = res.body?.['tenants']
    assert.ok(Array.isArray(tenants), `the response carries no \`tenants\` array: ${res.text}`)
    assert.ok(
      tenants.length >= 3,
      'the roster came back with fewer than the three rows `seedTenancyRoster()` writes. ' +
        '⚠️ AN EMPTY ARRAY IS THE EXACT FAILURE `db/migrations-control/0002_tenancy_roster.sql` ' +
        'EXISTS TO REFUSE: *"`listTenants` mounted against `tenant.tenant` answers ' +
        `200 {"tenants":[]} — worse than G300's honest 404."* Body: ${res.text}`,
    )
  })

  /* ================================================================ *
   * §2 · THE SEEDED TENANT PRINCIPAL IS UNDISTURBED.
   * ================================================================ */

  it('2 · the seeded TENANT operator still reaches its own tier — the seed was extended, not rewired', async () => {
    const res = await send(plane.url, RUNS_PATH, { host: SEED_HOST, session: SEED_HANDLE })
    assert.equal(
      res.status,
      200,
      'the seeded CUSTOMER operator stopped working when the console principal was added. ' +
        'The two share a seed and a transaction and nothing else — different doors, ' +
        'different people, different handles — so a red here means the platform rows ' +
        `disturbed the tenant ones rather than joining them. Body: ${res.text}`,
    )
  })

  /* ================================================================ *
   * §3 · INVARIANT 8. THE ASSERTION MOST LIKELY TO BE READ AS OPTIONAL.
   * ================================================================ */

  /**
   * 🛑 THE ANTI-VACUOUS HALF IS THE FIRST HALF OF THIS TEST AND NOT A TEST OF
   *    ITS OWN, AND THE REASON IS A DEFECT THIS SUITE HIT WHILE BEING WRITTEN.
   *
   * A refused-because-unauthenticated and a refused-because-unauthorised look
   * identical to `notEqual(200)`, and only one of them is invariant 8 — so the
   * handle must be shown RESOLVING before it is shown REFUSED.
   *
   * ⚠️ IT CANNOT BE A LATER `it()`, BECAUSE THE PROBE BELOW DESTROYS THE
   *    SESSION. G180's binding is PERMANENT and `checkHostBinding()` **revokes
   *    on a mismatch**, on every request rather than only at sign-in — *"a
   *    binding checked once, at sign-in, would be a binding that stops being
   *    checked exactly when it starts mattering."* So driving the console
   *    handle at a TENANT host is a one-shot act: a following test that
   *    re-presented it would get a 401 and would be measuring the revocation
   *    rather than the authority. **Witnessed: this was two `it()`s and the
   *    second one failed exactly that way.** One test, one order, stated here
   *    so nobody splits it again.
   */
  it('3 · BEING STAFF IS NOT ACCESS — the console principal reaches NO tenant data', async () => {
    const reachable = await send(plane.url, ROSTER_PATH, {
      host: SEED_CONSOLE_HOST,
      session: SEED_CONSOLE_HANDLE,
    })
    assert.equal(
      reachable.status,
      200,
      'the console handle does not resolve at all, so the refusal below would be about ' +
        'an unauthenticated caller rather than an unauthorised one and would prove ' +
        `nothing about invariant 8. Body: ${reachable.text}`,
    )

    const res = await send(plane.url, RUNS_PATH, {
      host: SEED_HOST,
      session: SEED_CONSOLE_HANDLE,
    })
    assert.notEqual(
      res.status,
      200,
      'THE SEEDED FDE READ A TENANT\'S RUNS. Copy invariant 8 rather than paraphrasing ' +
        'it: "Being staff is not access." Reaching a tenant requires a ' +
        '`TenantAccessGrant`, and this person holds NONE — no membership, no tenant ' +
        'role, no access grant, in any tenant. Their only authority is a ' +
        '`platform_role_assignment` carrying `view_substrate`, which is G289\'s second ' +
        'instrument and is NOT a grant. A seed that handed a staff person a membership ' +
        'would pass §1 and quietly demonstrate `decide()`\'s CUSTOMER arm instead of ' +
        `its platform one. Body: ${res.text}`,
    )
  })

  /**
   * ✅ G180's REVOCATION, OBSERVED RATHER THAN ASSUMED — and it is what makes
   * §3 a ONE-SHOT probe.
   *
   * §3 presented the console handle against a TENANT host. `checkHostBinding()`
   * refuses **and revokes**, so the session is now dead on its OWN host too.
   * This asserts that, which turns the constraint §3's header describes into a
   * fact this suite re-measures rather than a caution somebody has to believe.
   *
   * ⚠️ IT DEPENDS ON §3 HAVING RUN, which is ordinary for `node:test` within one
   * `describe` and is stated because the dependency is otherwise invisible.
   */
  it('3b · and the mismatched presentation REVOKED it — G180 is permanent, not advisory', async () => {
    const after = await send(plane.url, ROSTER_PATH, {
      host: SEED_CONSOLE_HOST,
      session: SEED_CONSOLE_HANDLE,
    })
    assert.notEqual(
      after.status,
      200,
      'the console session survived being presented against a tenant host. G180 binds a ' +
        'session to its issuing host PERMANENTLY and `checkHostBinding()` revokes on a ' +
        'mismatch on EVERY request — *"a binding checked once, at sign-in, would be a ' +
        'binding that stops being checked exactly when it starts mattering."* If this is ' +
        `green, a stolen console handle is replayable from any registered host. Body: ${after.text}`,
    )
    assert.equal(
      SEED_CONSOLE_USER.startsWith('usr_'),
      true,
      'the seeded console user id no longer looks like a user id; the fixture and the ' +
        'seed have drifted apart.',
    )
  })

  /* ================================================================ *
   * §4 · G192's FENCE, AS SOURCE. THE SEED IS REACHED DYNAMICALLY OR IT
   *      IS NOT FENCED AT ALL.
   * ================================================================ */

  it('4 · no module under `server/data-plane/` statically imports `server/dev/`', async () => {
    const { readdir, readFile } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const dir = join(import.meta.dirname, '..', '..', 'server', 'data-plane')

    const names = (await readdir(dir)).filter((n) => n.endsWith('.ts'))
    assert.ok(
      names.length > 10,
      `only ${names.length} modules found under server/data-plane — the scan stopped ` +
        'reading and this assertion has become a floor against nothing.',
    )

    const offenders: string[] = []
    for (const name of names) {
      const src = await readFile(join(dir, name), 'utf8')
      /* A STATIC import only. `await import('../dev/…')` is the sanctioned seam
         and must not be caught, which is why this is anchored to `import … from`
         rather than to the path alone. */
      if (/^\s*import\s[^\n]*from\s+'\.\.\/dev\//m.test(src)) offenders.push(name)
    }

    assert.deepEqual(
      offenders,
      [],
      'A STATIC IMPORT FROM `server/data-plane/**` INTO `server/dev/**` CONVERTS A ' +
        'PROPERTY INTO AN INTENTION — G192. A plane started without ' +
        '`RECONCILE_LOCAL_TEST_AUTH=1` must never LOAD the seed, so there is no ' +
        'seeding code path in the process to reach, bypass or mis-review. This seed ' +
        'writes a person, a directory, a live PLATFORM assignment and two live ' +
        'sessions whose handles are published constants: anything that can run it can ' +
        `authenticate as staff. Offenders: ${offenders.join(', ')}`,
    )
  })

  /* ================================================================ *
   * §5 · THE SEED TELLS AN OPERATOR HOW TO USE WHAT IT WROTE.
   * ================================================================ */

  it('5 · the summary names the console handle and its host, so the operator is not left guessing', () => {
    assert.match(
      summary,
      new RegExp(SEED_CONSOLE_HANDLE.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')),
      'the seed wrote a console principal and did not say so in the line it prints. ' +
        'That line is the whole interface between this module and the person running ' +
        'the local stack — G386 corrected it once already, for printing `X-Session:` ' +
        `alone. Printed: ${summary}`,
    )
    assert.match(
      summary,
      new RegExp(SEED_CONSOLE_HOST.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')),
      'the summary names a console handle and not the host it is BOUND to. Under G180 ' +
        'a session presented against any other Host is refused AND REVOKED on its first ' +
        'request, so a handle without its host is a fixture that destroys itself. ' +
        `Printed: ${summary}`,
    )
  })
})
