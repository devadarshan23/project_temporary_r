/**
 * THE ROSTER EXISTS AND NO PLANE CAN SERVE IT — the THIRD blocker, measured
 * rather than predicted, and it is a TOPOLOGY question the owner already named.
 *
 * G835 (20 Sep 2026), derived and not the owner's.
 *
 * ┌─ WHAT THIS FILE IS FOR ───────────────────────────────────────────────────┐
 * │ `tests/http/administration-tier-unmounted.test.ts` §4 measured THREE      │
 * │ blockers on the staff console: no gate, no table, no host. G781 and G726  │
 * │ closed the first and the third; G831 closes the second —                  │
 * │ `db/migrations-control/0002_tenancy_roster.sql` is the table, and         │
 * │ `tests/db/tenancy-roster.test.ts` proves its columns and its grant.       │
 * │                                                                            │
 * │ 🛑 **AND `listTenants` STILL MOUNTS NOWHERE, FOR A REASON THAT IS NEITHER  │
 * │ EFFORT NOR ANY OF THOSE THREE.** The owner named it in advance with the    │
 * │ ruling: *"the consoles must be served by a plane that can reach it —      │
 * │ which the deployed topology does not currently do."* This file is that    │
 * │ sentence turned into assertions, so the next slice meets a measurement    │
 * │ rather than a paragraph.                                                  │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE TENSION IN ONE SENTENCE: **G726 put the console SESSION on the DATA
 * plane** — *"reuse them rather than building a third process"* — and **G831
 * put the ROSTER in the CONTROL database.** Nothing joins them.
 *
 * ┌─ THE THREE SHAPES, AND WHY EACH ONE IS A RULING ──────────────────────────┐
 * │ §1 · THE DATA PLANE GAINS A READ-ONLY CONTROL POOL. The direction        │
 * │      invariant 3 permits, and the one the owner's ruling implies — but    │
 * │      it needs a network edge that does not exist in `compose.yaml` or in  │
 * │      `infra/`, and it contradicts a property `server/data-plane/          │
 * │      config.ts` states about itself and explains.                         │
 * │ §2 · THE CONTROL PLANE MOUNTS THE CONSOLE TIER. **Refused outright, and   │
 * │      it is the only one of the three refused on more than cost:** that    │
 * │      plane REFUSES TO BOOT if it mounts a gated operation, and resolving  │
 * │      a console principal there means reading the DATA database, which is  │
 * │      invariant 3 in the direction the invariant forbids.                  │
 * │ §3 · THE ROSTER PUBLISHED DOWNWARD into the data database. The verb       │
 * │      invariant 3 uses — and the data database already holds the fact, so  │
 * │      a copy is §5.3, and reading it across tenants lands on invariant 2.  │
 * │      There is also nothing to publish WITH.                               │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ **THE OWNER TOOK SHAPE (1) ON 20 Sep 2026 — G1161 — AND §1 IS THEREFORE
 *    REWRITTEN RATHER THAN DELETED. READ WHAT MOVED AND WHAT DID NOT.**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     "The data plane gains a READ-ONLY control-database pool. A second
 *      connection, `SELECT` only, on its own credential."
 *
 * **Every assertion §1 carried was TRUE when written and two of the three are
 * now false by ruling.** They are replaced, one for one, by assertions about
 * the property the ruling bought rather than deleted to make a slice compile:
 *
 *   1a  WAS  `data-plane` is on `data-net` ALONE, so `control-plane-db` does
 *            not resolve.
 *       NOW  `console-read-net` joins EXACTLY `data-plane` and
 *            `control-plane-db` and NOTHING ELSE — in both directions. A
 *            `control-plane` that joined it would hand the data plane a
 *            LISTENER to call, which is the SigV4-pull shape the owner did
 *            not take; a second data-side service that joined it would be a
 *            second credential holder. **And the FORBIDDEN direction is
 *            asserted unchanged**: `control-plane` is still on `control-net`
 *            alone, so `data-plane-db` still does not resolve inside it.
 *   1b  WAS  no `server/data-plane/**` module reads any `RECONCILE_CONTROL_*`.
 *       NOW  every `RECONCILE_CONTROL` literal reachable from the data plane
 *            begins **`RECONCILE_CONTROL_READ_`** — a narrower prefix, its
 *            own credential, and NOT the control plane's own, which
 *            `compose.yaml` sets two services away and which reads everything
 *            this database publishes downward. **The cross-plane IMPORT half
 *            of 1b is UNCHANGED and still asserted**, which is why
 *            `CONTROL_READ_ROLE` lives in `db/` and not beside
 *            `CONTROL_APP_ROLE`.
 *   1c  UNCHANGED, and it is the assertion that tells the reader which shape
 *            was taken: **shape (1) adds no `fetch(`.** If this one ever goes
 *            red, somebody has built the HTTP pull instead and that is a
 *            different ruling.
 *   1d  NEW.  The reach is READ-ONLY and CENSUS-ENFORCED, asserted over the
 *            source tree: `BEGIN READ ONLY`, a `SELECT`-only grant on one
 *            table, and `tests/db/control-plane-census.test.ts` naming the
 *            role. **`db/control-read-scope.ts` is where the live witnesses
 *            are** — this file needs no database and can only read text.
 *
 * 🛑 **AND WHAT THE RULING COST IS NOT SOLD AS A WASH HERE EITHER.** G193 held
 * invariant 3 *by construction*; `db/control-read-scope.ts` quotes the ruling:
 * *"By construction becomes by census, and that is a real loss, not a wash."*
 * §1d is the census being named; it is not the census being equivalent.
 *
 * ⚠️ **§4 IS UNCHANGED AND STILL PASSES, WHICH IS THE HONEST SHAPE OF THE
 * SLICE THAT TOOK THE RULING: THE TOPOLOGY BLOCKER CLOSED AND NOTHING WAS
 * MOUNTED.** §5 is new and says why, per operation, derived rather than
 * argued — and for `listTenants` the answer is **G833**, not topology.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ **AND ON 20 Sep 2026 THE LAST BLOCKER WENT TOO — G1241, THE OWNER'S
 *    RULING — SO THE FILE'S OWN TITLE IS NOW HALF FALSE AND IS CORRECTED
 *    HERE RATHER THAN RENAMED.** *"THE ROSTER EXISTS AND NO PLANE CAN SERVE
 *    IT"* was true for a day; the DATA plane serves it now.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     "Onboarding state lives in a table in the CONTROL database, one row per
 *      tenant, beside the roster — and `stage` is DERIVED at read time from
 *      the stored step state, never stored twice."
 *
 * 🛑 **G833 IS NOT DISCHARGED BY THAT AND MUST NOT BE READ AS DISCHARGED.** It
 * refused a `stage` COLUMN, and there is still none — `0030_onboarding_record.sql`
 * refuses one again on the same ground. What `listTenants` got is a DERIVATION,
 * whose input is two new relations and whose rule lives in `model/`.
 *
 * ⚠️ **§4 AND §5a ARE THEREFORE REWRITTEN RATHER THAN DELETED, AND BOTH ARE
 * STRICTER THAN WHAT THEY REPLACE**: §4 asserted *none is mounted* and now
 * asserts *exactly one, on the plane that can resolve a console principal*;
 * §5a was keyed on *is there a column of this name* and is now keyed on *is
 * there a PRODUCER*, which is the property — §5.1, repaired inside a control
 * written to measure a §5.1-shaped blocker. **The per-field, in-the-bytes
 * assertion that G833's blocker was really about lives in
 * `tests/http/console-roster-served.test.ts` §2**, which needs two databases
 * and therefore could not live here.
 *
 * ⚠️ IT NEEDS NO DATABASE AND NO BROWSER, SO IT NEVER SKIPS. Every assertion
 * is over the source tree, the contract documents and one live call into
 * `refuseGatedOperations()`. `tests/db/` carries what needs a server.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { sqlCode, sqlCorpus, sqlCorpusIsReal } from '../sql-code.ts'
import {
  tablesCarrying,
  columnFor,
  relationsAreReal,
  relationsOf,
  resolves,
  type Relations,
} from '../schema-table-resolver.ts'
import { basePathOf, loadTier } from '../../server/contract/document.ts'
import { routesOf } from '../../server/contract/routes.ts'
import { gateVerdictOf } from '../../server/contract/capability.ts'
import { refuseGatedOperations } from '../../server/control-plane/authorise.ts'
import type { Handler } from '../../server/http/app.ts'

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..')
const SERVER_DIR = path.join(REPO_ROOT, 'server')
const MIGRATIONS = path.join(REPO_ROOT, 'db', 'migrations')
const CONTROL_MIGRATIONS = path.join(REPO_ROOT, 'db', 'migrations-control')

/** `codeOf()`'s twin, and the same limitation: a scanner, not a parser. */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

function tsFilesUnder(dir: string): { file: string; code: string }[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts'))
    .map((f) => ({ file: f, code: codeOf(readFileSync(path.join(dir, f), 'utf8')) }))
}

const compose = readFileSync(path.join(REPO_ROOT, 'compose.yaml'), 'utf8')

/* ==================================================================== *
 * §0 · THE §5.6 GUARD AND THE PREMISE. The roster is real, and nothing
 *      below means anything if it is not.
 * ==================================================================== */

describe('§0 · the table exists and the operation is declared and gated', () => {
  it('0a · `tenancy_roster` is in the control migration set', () => {
    const control = sqlCode(sqlCorpus(CONTROL_MIGRATIONS))
    sqlCorpusIsReal(control, 'the control migration set')
    assert.ok(
      /CREATE TABLE ("?)tenancy_roster\1\s*\(/.test(control),
      'the roster table is gone, so every "and yet nothing serves it" assertion below is a ' +
        'statement about a table that does not exist. G831 landed it; ' +
        '`tests/db/tenancy-roster.test.ts` proves its columns.',
    )
  })

  it('0b · `listTenants` is declared on the platform-console tier and NAMES a capability', () => {
    const doc = loadTier('platformConsole')
    const routes = routesOf(doc, basePathOf(doc))
    const listTenants = routes.find((r) => r.operationId === 'listTenants')
    assert.ok(listTenants !== undefined, '`listTenants` is not declared on the console tier')
    assert.equal(
      listTenants.capability.kind,
      'capability',
      '`listTenants` no longer names a capability. G781 split this document out of ' +
        '`administration.openapi.yaml` precisely so it could, and §2 below rests on it.',
    )
    /* ⚠️ THIS ASSERTED `TIER_REQUIRES_CAPABILITY.platformConsole === true`
       UNTIL THE MERGE OF 20 Sep 2026, AND THE CONSTANT NO LONGER EXISTS —
       G911 RETIRED IT, on the owner's ruling that *"the file boundary should
       not carry an authorisation decision."* Two slices were green in
       parallel and neither could see the other: this file was written
       against the tier table on one branch while the other deleted it, and
       `git merge` reported NO CONFLICT because they are different files.
       `tsc` is what caught it — `TS2305: Module '"../../server/contract/
       capability.ts"' has no exported member 'TIER_REQUIRES_CAPABILITY'` —
       which is §5.11 with a second parent arriving as a TYPE ERROR rather
       than as a wrong number.
       🛑 THE ASSERTION IS RESTATED, NOT DROPPED, AND IT IS NOW STRONGER: it
       was standing in for *"this operation is gated"* and said it about the
       FILE. `gateVerdictOf()` says it about the OPERATION, which is the
       whole content of G911. */
    assert.equal(
      gateVerdictOf(listTenants.capability),
      'gated',
      '`listTenants` is no longer GATED. §2 below rests on it — the point of this file is ' +
        'that a gated console operation exists and no plane can serve it. Read G911 and ' +
        'G781 before widening this.',
    )
  })
})

/* ==================================================================== *
 * §1 · SHAPE ONE — THE DATA PLANE READS THE CONTROL DATABASE.
 *      ⚠️ THIS BANNER READ "Taken in substance by the owner's ruling
 *      ('which the consoles read') and NOT BUILT, because the edge is
 *      topology", AND IT IS CORRECTED RATHER THAN DELETED: it was the
 *      sentence this section was commissioned against. **G1161 takes it
 *      explicitly and BUILDS the edge** — one compose network with two
 *      members, one role, one table, `SELECT`, `BEGIN READ ONLY`.
 *      What §1 asserts now is that the edge is exactly that narrow.
 * ==================================================================== */

describe('§1 · the data plane’s reach into the control database is one narrow edge', () => {
  /** The lines belonging to one compose service, by the two-space indent. */
  const block = (service: string): string => {
    const start = compose.indexOf(`\n  ${service}:`)
    assert.ok(start >= 0, `compose.yaml declares no \`${service}\` service`)
    const rest = compose.slice(start + 1)
    const next = rest.search(/\n {2}[a-z][a-z0-9-]*:/)
    return next < 0 ? rest : rest.slice(0, next)
  }

  /** The networks one service's own block names. */
  const networksOf = (service: string): readonly string[] => {
    const m = /networks:\s*\[([^\]]*)\]/.exec(block(service))
    return m === null
      ? []
      : (m[1] ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s !== '')
  }

  const SERVICES = [
    'data-plane',
    'data-plane-db',
    'data-plane-migrate',
    'control-plane',
    'control-plane-db',
    'control-plane-migrate',
  ] as const

  it('1a · ⛔ `console-read-net` is RETIRED and no service joins the control database but the control plane’s own (G4320)', () => {
    /**
     * This read *"`console-read-net` joins exactly the data plane and the
     * control database"* (G1161) until 5 Oct 2026. THE OWNER'S "Full restore"
     * ruling retired the data plane's read-only control pool; the network went
     * with it, so `control-plane-db` is on `control-net` alone again.
     */
    const members = SERVICES.filter((s) => networksOf(s).includes('console-read-net'))
    assert.deepEqual(members, [], `a service is still on \`console-read-net\`: [${members.join(', ')}]`)
    assert.deepEqual(
      networksOf('control-plane-db'),
      ['control-net'],
      'the control database is on a network other than `control-net` — the data plane must not ' +
        'resolve it (G4320).',
    )
    assert.ok(!networksOf('data-plane').includes('control-net'), 'the data plane joined `control-net`')
  })
  it('1a3 · `internal-net` joins exactly the data plane and the control plane — no database (G4310)', () => {
    const members = SERVICES.filter((s) => networksOf(s).includes('internal-net'))
    assert.deepEqual(
      [...members].sort(),
      ['control-plane', 'data-plane'],
      'the internal edge is not exactly `data-plane` -> `control-plane`. The owner`s ruling of ' +
        '5 Oct 2026 put onboarding writes and roster reads behind signed control-plane ' +
        'endpoints; a DATABASE on this network would make it a second, unsigned path. ' +
        `Found: [${members.join(', ')}]`,
    )
  })

  it('1a2 · and the FORBIDDEN direction is untouched — the control plane still cannot resolve the data database', () => {
    /**
     * 🛑 THE HALF THAT MUST NEVER MOVE, AND THE REASON §1a IS SAFE TO HAVE
     * CHANGED. Copy it, never paraphrase it:
     *
     *     "3. **The control plane publishes downward and never reads tenant
     *      data.**"
     *
     * G1161 opens an edge in the direction invariant 3 PERMITS — a data plane
     * reading a control-owned fact, downward, in a process that publishes
     * nothing back. Attaching `data-plane` to a network does not attach
     * `control-plane` to `data-net`, and this is the assertion that keeps the
     * two facts from being confused by the next reader.
     */
    /**
     * ⚠️ `internal-net` SINCE 5 Oct 2026 — G4310, THE OWNER'S "Full restore"
     * RULING. It carries the data plane's signed calls INTO this service and
     * has exactly two members (§1a3), neither a database, so the property
     * this assertion holds — `data-plane-db` does not resolve here — is
     * unchanged; §1a3 is what keeps it true.
     */
    assert.deepEqual(
      networksOf('control-plane'),
      ['control-net', 'internal-net'],
      'the `control-plane` service is on a network other than `control-net` and `internal-net`. G193: `data-plane-db` ' +
        'must not RESOLVE inside that container — "not refused, not unauthorised: does not ' +
        'resolve." That is invariant 3 in the direction the invariant forbids, and G1161 ' +
        'opened the OTHER one. Nothing about the console ruling touches this.',
    )
    assert.deepEqual(
      networksOf('control-plane-migrate'),
      ['control-net'],
      'the control plane’s one-shot migrator — which holds the admin credential for that ' +
        'database — has gained a network. It needs `control-net` and nothing else.',
    )
    assert.deepEqual(
      networksOf('data-plane-db'),
      ['data-net'],
      'the tenant database has moved off `data-net` alone, which would put it within reach ' +
        'of whatever else shares the network it gained',
    )
  })

  it('1b · ⛔ the data plane names NO `RECONCILE_CONTROL*` variable, and still imports no control module (G4320)', () => {
    /**
     * This read *"the data plane names only `RECONCILE_CONTROL_READ_*`"*
     * (G1161) until 5 Oct 2026. THE OWNER'S "Full restore" ruling retired both
     * control-DB credentials from the data plane, so the narrow prefix that was
     * the control here is now the thing that must be ABSENT. The internal edge's
     * own address is `RECONCILE_INTERNAL_CONTROL_PLANE_URL`, outside this prefix
     * on purpose.
     */
    const files = tsFilesUnder(path.join(SERVER_DIR, 'data-plane'))
    assert.ok(files.length > 20, 'the data-plane source tree did not load')
    assert.ok(
      files.some((f) => f.code.includes('RECONCILE_INTERNAL_CONTROL_PLANE_URL')),
      'anti-vacuity: the scan cannot see the internal edge`s own variable, so the absence ' +
        'below would be the silence of a broken check',
    )
    const named = files.flatMap((f) =>
      [...f.code.matchAll(/(?<![A-Z_])RECONCILE_CONTROL[A-Z_]*/g)].map((m) => `${f.file}: ${m[0]}`),
    )
    assert.deepEqual(
      named,
      [],
      'something reachable from the data plane names a `RECONCILE_CONTROL*` variable. G4320 ' +
        '(the owner`s 5 Oct 2026 ruling) retired every control-database credential from this ' +
        `plane. Found: ${named.join(', ')}`,
    )
    const imports = files.filter((f) => /from '\.\.\/control-plane\//.test(f.code)).map((f) => f.file)
    assert.deepEqual(imports, [], `a data-plane module imports from \`server/control-plane/\`: ${imports.join(', ')}`)
  })
  it('1d · ⛔ the two scope helpers that opened the reach are DELETED (G4320)', () => {
    /**
     * This asserted `withControlReadScope()`'s `BEGIN READ ONLY` (G1161) until
     * 5 Oct 2026. Both helpers — the reader's and R9's writer's — are deleted
     * with the credentials; `tests/db/control-plane-census.test.ts` §C and §R
     * assert the database half (no reach, no login).
     */
    for (const f of ['control-read-scope.ts', 'control-write-scope.ts']) {
      assert.equal(existsSync(path.join(REPO_ROOT, 'db', f)), false, `db/${f} is back`)
    }
  })
  it('1c · and the console roster still cannot be PULLED: the control plane makes ONE outbound request, to STS, and nothing else (G4302)', () => {
    /**
     * ⚠️ THE ESTABLISHED DISTRIBUTION PATTERN IS A CONTRACT, NOT A CONNECTION
     * STRING. `control-plane.openapi.yaml`'s `listEntitledPacks` exists so
     * that a data plane PULLS from the control plane over a declared
     * operation under SigV4 — *"the data plane assumes a narrow role in OUR
     * account"*. A direct SQL read would be the first time either plane
     * reached into the other's storage. **And the HTTP form is not free
     * either.**
     *
     * 🛑 **THIS ASSERTION USED TO COVER BOTH PLANE DIRECTORIES AND DEMAND AN
     * EMPTY LIST, AND R2 SPENT THAT — 25 Sep 2026, THE OWNER'S: *"The JWKS is
     * fetched ONCE AT BOOT and cached in memory. No runtime egress."* IT IS
     * RE-ARGUED HERE RATHER THAN DELETED, AND THE SPLIT IS THE ARGUMENT.**
     *
     * The old form asserted `[]` over `data-plane` and `control-plane`
     * together, and **its stated subject was the SigV4 pull** — a shape the
     * owner refused, on the CONTROL side. That subject is untouched and is
     * asserted here at FULL STRENGTH: the control plane still makes no
     * outbound request of any kind, so the roster cannot be pulled over HTTP
     * whatever happens to the other plane.
     *
     * What moved is the DATA plane, and what replaces `[]` is a NAMED
     * ALLOW-LIST of one file — **a census rather than a construction**, which
     * is the loss `db/control-read-scope.ts` records in the owner's own words
     * for the read-only pool: *"By construction becomes by census, and that is
     * a real loss, not a wash."* A `deepEqual` against one name is what makes
     * the second outbound call in this repository a RED GATE rather than a
     * line in a diff nobody keyed on.
     */
    const controlPlane = tsFilesUnder(path.join(SERVER_DIR, 'control-plane'))
      .filter((f) => /\bfetch\s*\(/.test(f.code))
      .map((f) => f.file)
    /**
     * 🛑 RE-ARGUED, NOT LOOSENED — G4302, 5 Oct 2026, THE OWNER'S "SigV4 task
     * role" RULING: *the data-plane task role signs internal requests; the
     * control plane verifies.* A SigV4 signature by an IAM role is verified
     * with a key only AWS holds, so "the control plane verifies" has exactly
     * one in-process implementation: forward the signed
     * `sts:GetCallerIdentity` to STS (`server/control-plane/sts-verifier.ts`).
     * That ONE file may reach the network, its destination is the regional
     * STS endpoint built from configuration, and STS holds no tenant data —
     * invariant 3 does not move. The ROSTER is still not pulled by this plane:
     * it is the DATA plane that calls, over the internal edge.
     */
    assert.deepEqual(
      controlPlane,
      ['sts-verifier.ts'],
      'the CONTROL plane now makes an outbound HTTP request. R2 authorised one at BOOT in ' +
        'the DATA plane and said nothing about this one. If it is the console roster being ' +
        'pulled over a contract, it is a new operation on `control-plane.openapi.yaml` and a ' +
        `new credential posture, and both are rulings. Found: ${controlPlane.join(', ')}`,
    )

    /**
     * 🛑 ONE FILE, BY NAME. **Comments are stripped before this looks** —
     * `codeOf()` — which is G978's repair applied to the control rather than
     * to the prose: three headers in `server/data-plane/` now DISCUSS the
     * outbound call, and a `grep` over raw text would count every one of them.
     */
    const dataPlane = tsFilesUnder(path.join(SERVER_DIR, 'data-plane'))
      .filter((f) => /\bfetch\s*\(/.test(f.code))
      .map((f) => f.file)
    /**
     * ✅ TWO NAMES SINCE 1 Oct 2026 — G2443, THE OWNER'S: *"Yes, bounded —
     * exactly ONE file (`server/data-plane/code-exchange.ts`) may POST to the
     * PINNED connection's token endpoint only, with a short timeout, outside
     * any database transaction."* ⚠️ **THE ONE-NAME LIST IS RE-ARGUED, NOT
     * LOOSENED**: it is still a `deepEqual` against NAMES, so a THIRD outbound
     * call is the same red gate the second used to be. *"By construction
     * becomes by census"* a second time, and the census is the one that was
     * already here. The old message is quoted because it is what told the S6
     * author to stop at the seam: *"EXACTLY ONE may: `jwks-source.ts` … A
     * SECOND one is request-path egress, which NO ruling authorises."*
     */
    /**
     * ⚠️ AND A THIRD SINCE 5 Oct 2026 — G4310, THE OWNER'S "Full restore"
     * RULING, which PERMITS the data plane → control plane internal call as
     * request-path egress (G2151 and R2 scoped to this ONE edge). The file is
     * `control-plane-client.ts` and its two destinations are both
     * configuration: the control plane's internal ALB, and the ECS container
     * credentials endpoint that hands the task its signing credentials.
     */
    assert.deepEqual(
      [...dataPlane].sort(),
      ['code-exchange.ts', 'control-plane-client.ts', 'jwks-source.ts'],
      'the set of files in `server/data-plane/` that make an outbound HTTP request has ' +
        'changed. EXACTLY THREE may: `control-plane-client.ts`, the internal edge to the ' +
        'control plane under the owner\'s 5 Oct 2026 ruling (G4310); `jwks-source.ts`, which obtains the broker key document ' +
        'ONCE AT BOOT under R2, and `code-exchange.ts`, which POSTs ONE code to the PINNED ' +
        'door\'s token endpoint per sign-in under G2443. A THIRD is egress no ruling ' +
        'authorises, and `docs/build/d6-threat-model.md` D6-4 measures what an anonymous ' +
        `caller can already make this plane spend. Found: [${dataPlane.join(' | ')}]`,
    )

    /**
     * 🛑 AND THE BOOT-ONLY HALF, WHICH THE FILE LIST CANNOT SEE. A module that
     * makes an outbound call only at boot is only boot-only while nothing on a
     * request path can reach it. The fence is `run-queue.ts`'s (G1201): the
     * reach is a DYNAMIC import, so a plane that configures no broker never
     * loads the transport at all.
     *
     * ⚠️ A STATIC `import type` IS NOT A BREACH and is deliberately admitted:
     * `verbatimModuleSyntax` erases a type-only specifier before the loader
     * sees it. **So this keys on the VALUE import**, which is the property,
     * rather than on the path appearing in a file, which is the landmark.
     */
    const valueImporters = tsFilesUnder(path.join(SERVER_DIR, 'data-plane'))
      .filter((f) => /(?<!import type )\{[^}]*\}\s*from\s*'\.\/jwks-source\.ts'/.test(f.code))
      .map((f) => f.file)
    assert.deepEqual(
      valueImporters,
      [],
      'something under `server/data-plane/` now STATICALLY value-imports the key-document ' +
        'transport. R2 is "once at boot", and what makes that structural rather than a ' +
        'comment is that `loadVerificationTerms()` reaches it through a DYNAMIC import, so ' +
        'a plane with no broker configured never loads the module. A static value import ' +
        `puts it in every request path’s closure. Found: [${valueImporters.join(' | ')}]`,
    )

    const terms = readFileSync(
      path.join(SERVER_DIR, 'data-plane', 'verification-terms.ts'),
      'utf8',
    )
    assert.ok(
      /await import\('\.\/jwks-source\.ts'\)/.test(codeOf(terms)),
      '`loadVerificationTerms()` no longer reaches the transport through a dynamic import. ' +
        'That import IS the fence (G1201’s shape): it is what keeps a plane with no ' +
        'broker configured from ever loading an outbound HTTP client.',
    )
  })
})

/* ==================================================================== *
 * §2 · SHAPE TWO — THE CONTROL PLANE MOUNTS THE CONSOLE TIER.
 *      REFUSED, and measured against the real fence.
 * ==================================================================== */

describe('§2 · the control plane refuses to BOOT with a console operation mounted', () => {
  it('2a · `refuseGatedOperations()` throws for `listTenants`, live', () => {
    /**
     * 🛑 NOT REASONED — CALLED. `server/control-plane/authorise.ts` refuses to
     * start the process at all if any operation it mounts names a capability,
     * *"because this plane authenticates a MACHINE over SigV4 and builds no
     * principal a capability could be evaluated against"*. Every one of the
     * console tier's fourteen operations names one, so this shape is not a
     * cost — it is a plane that does not start.
     */
    const stub: Handler = async () => ({ tenants: [] })
    assert.throws(
      () => refuseGatedOperations([{ tier: 'platformConsole', handlers: { listTenants: stub } }]),
      /refuses to start/,
      'the control plane would now BOOT with a gated console operation mounted. That fence ' +
        'is what makes shape two a refusal rather than a cost — if it has been removed, the ' +
        'plane serves a tenancy roster to a caller it cannot evaluate, which is G534`s ' +
        'measurement exactly: "mounting any of the 59 is mounting an ungated, unrecorded read".',
    )
  })

  it('2b · and the console principal`s substrate is in the OTHER database', () => {
    /**
     * The deeper half, and it is the one that would survive deleting the boot
     * fence. A console principal is a `tenant.session` + `tenant."user"` +
     * `tenant.platform_role_assignment`, all three in `db/migrations/`. For
     * the control plane to resolve one it would have to read the DATA
     * database — invariant 3, in the direction the invariant forbids.
     */
    const control = sqlCode(sqlCorpus(CONTROL_MIGRATIONS))
    sqlCorpusIsReal(control, 'the control migration set')
    for (const table of ['session', 'platform_role_assignment', '"user"']) {
      assert.ok(
        !control.includes(`CREATE TABLE ${table}`) && !control.includes(`CREATE TABLE public.${table}`),
        `the control migration set declares \`${table}\`. A console principal resolved in ` +
          'the control database is a SECOND identity substrate — `model/access.ts` has one ' +
          '`decide()` for the same reason — and the first one is ' +
          '`db/migrations/0009_identity_substrate.sql`, in the data database.',
      )
    }
    const data = sqlCode(sqlCorpus(MIGRATIONS))
    sqlCorpusIsReal(data, 'the data migration set', 10_000)
    assert.ok(
      data.includes('tenant.platform_role_assignment'),
      'the platform assignment substrate is not in the data migration set either, so the ' +
        'claim above is about nothing. `db/migrations/0009_identity_substrate.sql` declares it.',
    )
  })
})

/* ==================================================================== *
 * §3 · SHAPE THREE — PUBLISH THE ROSTER DOWNWARD.
 * ==================================================================== */

describe('§3 · a published roster would be a second copy behind a policy that denies it', () => {
  it('3a · the data database already holds the fact, so a copy is §5.3', () => {
    const data = sqlCode(sqlCorpus(MIGRATIONS))
    sqlCorpusIsReal(data, 'the data migration set', 10_000)
    assert.ok(
      /CREATE TABLE tenant\.tenant\b/.test(data) || /CREATE TABLE tenant\b/.test(data),
      'the data database no longer holds a `tenant` table, which is the premise of this ' +
        'whole section: shape three would be a SECOND home for a fact `0001` already stores.',
    )
    assert.ok(
      data.includes('partner_id'),
      '`db/migrations/0039_partner_access_grant.sql`s `partner_id` is gone from the data ' +
        'set. That column is the other half of the duplication argument — invariant 2`s ' +
        'first conjunct is enforced there by a composite FOREIGN KEY, and a published roster ' +
        'carrying the same fact could disagree with it with nothing to notice.',
    )
  })

  it('3b · and `tenant_rls` is keyed on `app.tenant_id`, which a console act never sets', () => {
    /**
     * 🛑 THE MEASURED PROBLEM, AT ITS SOURCE. A console act's transaction is
     * `withSessionScope()` — `server/data-plane/authorisation-record.ts`'s
     * platform arm — so `app.tenant_id` is unset and G100 denies. A roster
     * published into `tenant.` would be readable by a console session only
     * under a policy NOT keyed on that GUC, which is a second cross-tenant
     * read path and therefore invariant 2.
     */
    const zero = readFileSync(path.join(MIGRATIONS, '0001_tenancy_and_rls.sql'), 'utf8')
    assert.match(
      sqlCode(zero),
      /CREATE POLICY tenant_rls[\s\S]{0,400}app\.tenant_id/,
      '`tenant_rls` is no longer keyed on `app.tenant_id`. That predicate is why a console ' +
        'session reads an EMPTY `tenant.tenant` and why the roster went to the control ' +
        'database at all — if it has changed, G831`s premise has changed with it.',
    )

    const record = codeOf(
      readFileSync(path.join(SERVER_DIR, 'data-plane', 'authorisation-record.ts'), 'utf8'),
    )
    assert.ok(
      /grant\.home === 'platform'[\s\S]{0,400}withSessionScope/.test(record),
      "the platform arm of `authorisedHandler()` no longer opens a SESSION scope. That is " +
        'the transaction a console act`s body runs in, and it is the reason every ' +
        'tenant-scoped table reads empty inside one — the finding this whole file exists ' +
        'to record.',
    )
  })
})

/* ==================================================================== *
 * §4 · AND THEREFORE: NOTHING IS MOUNTED, AND THE SERVED SET IS
 *      UNCHANGED BY THIS SLICE.
 * ==================================================================== */

describe('§4 · exactly one console operation is served', () => {
  it('4a · `listTenants` is mounted on the DATA plane, and the other thirteen are not', () => {
    /**
     * ✅ **THIS ASSERTION READ `deepEqual(found, [])` UNTIL 20 Sep 2026 AND
     * FIRED EXACTLY AS DESIGNED — G1241, THE OWNER'S RULING. ITS MESSAGE IS
     * QUOTED IN FULL RATHER THAN DELETED, because it named its own successor:**
     *
     *     "a platform-console operation is mounted. ⚠️ THIS MESSAGE READ 'The
     *      TABLE blocker is closed (G831) and the TOPOLOGY one is not' AND THE
     *      SECOND HALF WENT FALSE ON 20 Sep 2026 — G1161 … What is left is
     *      NEITHER of those: §5 below derives, per operation, which `required`
     *      response fields have no column anywhere in the control migration
     *      set — and for `listTenants` the answer is `stage`, which is G833 …
     *      If a mount has been taken, this assertion is what the taking commit
     *      re-argues."
     *
     * **This is that commit and this is that re-argument.** `stage` did not get
     * a column — G833 stands — it got a DERIVATION, and §5 below is rewritten
     * around the difference.
     *
     * 🛑 **WHAT REPLACES AN ABSENCE IS A COUNT AND A PLACE, BOTH OF WHICH ARE
     * STRICTER THAN THE PROSE THEY REPLACE.** The old assertion could only say
     * *none*; this says *exactly one, and on the plane that can resolve a
     * console principal* — so a fourteenth mount, or the same mount on the
     * control plane, is a red gate rather than a thing nobody counted.
     */
    const doc = loadTier('platformConsole')
    const declared = routesOf(doc, basePathOf(doc)).map((r) => r.operationId)
    assert.ok(declared.length >= 14, `the console tier declares ${declared.length} operations`)

    const mounted: string[] = []
    for (const plane of ['control-plane', 'data-plane']) {
      const file = path.join(SERVER_DIR, plane, 'start.ts')
      const text = readFileSync(file, 'utf8')
      assert.ok(text.includes('handlers:'), `server/${plane}/start.ts has no mounts at all`)
      for (const id of declared) {
        if (new RegExp(`\\b${id}\\b`).test(text)) mounted.push(`server/${plane}/start.ts: ${id}`)
      }
    }
    assert.deepEqual(
      mounted,
      ['server/data-plane/start.ts: listTenants'],
      'the served console set is not exactly `listTenants` on the DATA plane. **A SECOND ' +
        'MOUNT IS NOT A CONSEQUENCE OF THE FIRST**: G300 lifts per operation and on merit, ' +
        'and §5 below derives what each of the other thirteen is still short of — thirteen ' +
        'of them have no table in either database at all. **AND A MOUNT ON THE CONTROL PLANE ' +
        'IS NOT A WIDENING, IT IS A PLANE THAT DOES NOT START**: `refuseGatedOperations()` ' +
        `throws at boot, witnessed live at §2a. Found: [${mounted.join(', ')}]`,
    )
  })
})

/* ==================================================================== *
 * §5 · WHY NOTHING IS MOUNTED, PER OPERATION, DERIVED — G1166.
 *
 * 🛑 **THE TOPOLOGY BLOCKER IS CLOSED AND NOT ONE OF THE FOURTEEN MOVED,
 *    AND THAT IS A MEASUREMENT RATHER THAN A CONFESSION.** §4 says
 *    nothing is served; this says what each one would have to have, and
 *    it derives the answer from the contract and the migration set rather
 *    than asserting it in prose — so an operation that becomes mountable
 *    turns this section RED and the mounting commit meets a list rather
 *    than a paragraph.
 *
 * ⚠️ THE TEST IS G300's FIRST PART ONLY — **TABLE** — AND IT IS THE ONE
 *    THAT IS MECHANICAL. *"A table alone is the trap"*: G300 requires
 *    TABLE and MODEL and CAPABILITY, and the other two need a reader.
 *    What this measures is the narrower thing G656 found and G833 named:
 *    **a `required` response field with no column anywhere is a 200 that
 *    ships incomplete, silently.**
 * ==================================================================== */

describe('§5 · every console operation, and the required field it cannot produce', () => {
  /**
   * ⚠️ `columnFor` USED TO BE DECLARED HERE AND IS NOW IMPORTED — K5, G1772.
   * It was three characters of regex written twice, here and in
   * `tests/db/tenancy-roster.test.ts`, which is `0002`'s *"a third place to
   * drift"* in a helper. It lives in `tests/schema-table-resolver.ts` with the
   * reader that uses it.
   */

  /**
   * 🛑 **RESPONSE FIELDS WHOSE PRODUCER IS A DERIVATION RATHER THAN A COLUMN —
   * ADDED 20 Sep 2026, G1241, AND IT IS A §5.1 REPAIR TO THIS SECTION'S OWN
   * RULE.**
   *
   * §5a was keyed on a LANDMARK — *is there a column of this name?* — and the
   * property it was protecting is *does anything produce this value?* The two
   * agreed for every operation on this tier until the owner ruled that
   * `TenantSummary.stage` is **DERIVED at read time from the stored step state,
   * never stored twice**. A rule keyed on the landmark reports `listTenants`
   * unproducible for ever, about a field this repository now serves — which is
   * the shape `docs/HANDOFF.md` §5 catalogues most, arriving inside a control
   * written to measure a §5.1-shaped blocker.
   *
   * ⚠️ **AN ENTRY HERE IS A DECISION, NOT A FIX**, and the two halves are
   * checked below rather than asserted: `derivation` must be reachable from
   * `server/data-plane/`, and `from` must be a real relation in the control
   * migration set. A field whose derivation reads NOTHING is not derived — it
   * is invented, which is the direction G284 and G833 both refuse.
   */
  /**
 * 🛑 **THIS TABLE COVERS ONE TIER, AND ON 21 Sep 2026 THAT BECAME A HOLE RATHER
 * THAN A SCOPE — G1421's SLICE FOUND IT AND IS REPORTING IT RATHER THAN
 * CLOSING IT.**
 *
 * §5a walks `loadTier('platformConsole')` and nothing else, which was the whole
 * corpus of console operations when it was written. **R8 gated and mounted
 * three console operations on `administration.openapi.yaml`** —
 * `listOnboardingSteps`, `completeOnboardingStep`, `forceOnboardingStep` — and
 * **§5a cannot see any of them.** So the producer derivation this file performs
 * for fourteen operations is performed for those three by NOTHING: there is no
 * assertion anywhere that every `required` field of `OnboardingStep` has a
 * producer before it is mounted.
 *
 * ⚠️ **IT IS NOT VACUOUS FOR THE THREE, WHICH IS WHY THIS IS A GAP AND NOT A
 * BREACH.** `tests/http/onboarding-console-served.test.ts` §2 derives
 * `OnboardingStep.required` from the document and checks each name against the
 * BYTES of a real served response — which is strictly stronger than this
 * derivation and strictly narrower: it needs two databases and a mounted route,
 * so it can only ever speak about operations that are ALREADY served. **This
 * table's whole value is that it speaks about operations that are not.**
 *
 * 🛑 **THE REPAIR IS TO MAKE §5a TIER-AGNOSTIC AND IT IS A DIFFERENT SLICE.**
 * Walking every tier would put all 136 operations through `columnFor()` against
 * the CONTROL corpus, and most of them are tenant-database operations for which
 * that is the wrong corpus entirely — `COINCIDENTAL_COLUMN_MATCH` already
 * records one false positive from a single unrelated `reason` column, and
 * widening the population without widening the corpus would manufacture
 * dozens. **Naming it here is what stops the next reader treating this table's
 * silence as evidence.**
 */
const DERIVED_PRODUCERS: Readonly<
    Record<string, { readonly derivation: string; readonly from: string }>
  > = {
    /**
     * `onboardingStage()` is `model/onboarding.ts`'s and is called once per
     * tenant by `server/data-plane/console-roster-store.ts`. Its INPUT is the
     * prefix length and the forced marks; there is no `stage` column and
     * `0030_onboarding_record.sql` refuses one again, so G833 is NOT discharged
     * — it is what made a derivation necessary.
     */
    'TenantSummary.stage': { derivation: 'onboardingStage', from: 'onboarding_record' },
  }

  /**
   * ✅ **THE NAMED HOLD-OUT IS RETIRED AND ITS ARGUMENT IS QUOTED WHOLE BELOW,
   * BECAUSE A CONTROL DELETED WHEN IT FIRES IS NOT A CONTROL — K5, G1773,
   * 21 Sep 2026.** What replaces it is not a shorter list: it is the RESOLVER
   * this section said in its own voice it did not have, and the operation it
   * held out is now refused by the property rather than by its name.
   *
   * THE ORIGINAL, UNCHANGED:
   *
   *   > 🛑 **ONE MEASURED FALSE POSITIVE, HELD OUT BY NAME RATHER THAN BY A
   *   > RULE — AND IT IS THIS SECTION'S OWN §5.1 ARRIVING ON THE DAY A COLUMN
   *   > LANDED.** The scanner asks *"does this token appear anywhere in the
   *   > control migration corpus"* and never *"is there a column of this name
   *   > ON A TABLE THIS OPERATION COULD READ OR WRITE"*, because it has no
   *   > schema→table mapping and is, in its own words above, *"still a scanner
   *   > and not a resolver"*. **`openByoaEscalation`'s only `required` field is
   *   > `ByoaEscalationRequest.reason`, and `db/migrations-control/
   *   > 0030_onboarding_record.sql` added a `reason` column to
   *   > `onboarding_forced_step` — a table about H2's delivery sequence, with
   *   > nothing whatever to do with a hosted-to-BYOA move.** The operation went
   *   > from unproducible to producible on 20 Sep 2026 without anybody building
   *   > it anything … So the exclusion is by NAME, with the argument, exactly
   *   > as G783 holds `raiseAdjustment` out of the console split by a named
   *   > tripwire rather than by a rule that would admit it.
   *
   * 🛑 **THE RED WAS RE-WITNESSED BEFORE THE REPAIR RATHER THAN TAKEN FROM THE
   * RECORD.** Emptying that array and running this section, 21 Sep 2026:
   *
   *     Producible: [listTenants, openByoaEscalation].
   *     Still short of a producer (12): …
   *
   * ⚠️ **AND IT IS STILL UNMOUNTED FOR REASONS THIS SECTION CANNOT SEE**: it is
   * a WRITE, there is no `byoa_escalation` table in either database, and G300's
   * other two parts — MODEL and CAPABILITY — are untouched by any of this.
   */

  /**
   * 🛑 **THE SCHEMA→TABLE MAP. AN ENTRY IS A DECISION AND `null` IS ONE TOO —
   * K5, G1773.**
   *
   * The resolver's polarity is the whole of what this buys: a schema that
   * resolves to no table produces NOTHING, whatever tokens happen to exist
   * elsewhere in the corpus. That is `0001`'s deny-on-NULL and G106's
   * unreadable-by-default, applied to a scanner, and it turns *"it fails toward
   * producible"* — `docs/build/completion-plan.md` §6's K5 row, the reason this
   * exists — into failing toward unproducible.
   *
   * ⚠️ **THE COST OF THAT POLARITY IS THAT `null` COULD BE A LIE, AND A LIE
   * HERE IS FREE**: it reports an operation unmountable for ever, about a
   * schema somebody has since built a table for. So **`null` IS FALSIFIED
   * MECHANICALLY BELOW** rather than trusted — if any single control table
   * carries EVERY one of a `null`-mapped schema's `required` columns, this
   * section goes red and says which. That is the equality assertion in the
   * direction nobody usually writes.
   *
   * 🛑 **THE MAP IS REQUIRED TO BE TOTAL OVER THE SCHEMAS THIS TIER REACHES**,
   * checked below by set equality, so a seventeenth schema is a RED rather than
   * a silent `undefined` reading as `null`. `Record<string, …>` in TypeScript
   * admits a missing key at an index read; the assertion is what makes it total.
   *
   * ⚠️ **THREE ENTRIES ARE REAL AND FOURTEEN ARE `null`, AND THE THREE ARE THE
   * ONES THAT MAKE THIS NON-VACUOUS.** A map of all-`null` would report every
   * operation unproducible while reading nothing — `docs/HANDOFF.md` §5.6, and
   * a sharper risk here than for the token scanner, because a broken reader
   * makes the scanner loud and makes this one SILENT.
   */
  const SCHEMA_TABLE: Readonly<Record<string, string | null>> = {
    /**
     * G831's table, and the roster IS the tenant record — `0002_tenancy_roster.sql`
     * is titled for it. Five of `TenantSummary`'s six `required` fields are
     * columns on it; `stage` is the sixth and is DERIVED (below), never stored.
     */
    TenantSummary: 'tenancy_roster',
    /**
     * The same subject, read wide. It resolves to a REAL table and is still
     * unproducible, which is the distinction the token scanner could not draw:
     * `retention`, `telemetryProfile`, `environment` and `permanentFields` are
     * columns `0002` REFUSES BY NAME — *"`created_at` and `retention` on 0004's
     * narrower rule"* — rather than columns nobody got round to. **A resolved
     * miss is a statement about a refusal; an unresolved miss is a statement
     * about an absent table.**
     */
    TenantRecord: 'tenancy_roster',
    /**
     * `createTenant`'s request body. It writes the roster, and `0002` grants
     * `SELECT` and nothing else precisely so that it cannot — *"a write
     * privilege ahead of a writer"*. Mapped to the table it would write, so its
     * three missing fields are read against the right relation.
     */
    TenantCreationRequest: 'tenancy_roster',

    /**
     * ⚠️ FOURTEEN `null`s, AND §5b's OWN SENTENCE IS THE ARGUMENT FOR ALMOST
     * ALL OF THEM: *"Thirteen of the fourteen have no table at all — a billing
     * period, an invoice, a pack draft, a rate card; none of those exists in
     * either database."* Each is falsified below rather than asserted.
     */
    BillingPeriodView: null,
    /**
     * 🛑 THE ONE `null` THAT IS A JUDGEMENT RATHER THAN AN OBSERVATION, NAMED
     * SO NOBODY READS IT AS THE OTHERS. `pack_catalogue` EXISTS and is the
     * nearest relation — but it is the PUBLISHED catalogue, keyed
     * `(pack_key, pack_version)`, and `BuilderPackSummary` requires a
     * `draftVersion`. A draft has no home in a published catalogue, and mapping
     * it there would invite somebody to add a `name` column to the artefact the
     * control plane PUBLISHES in order to satisfy a builder screen. Refused on
     * `0001`'s ground: the catalogue is written by X1, which is not this
     * process and is not built.
     */
    BuilderPackSummary: null,
    /** No `byoa_escalation` table in either database — the operation the coincidence used to pass. */
    ByoaEscalationRequest: null,
    CatalogueBlueprint: null,
    CatalogueRateCard: null,
    InvoiceDetail: null,
    InvoiceSummary: null,
    PackDraft: null,
    PackPublishRequest: null,
    PackRuleRequest: null,
    PackRuleRow: null,
    PartnerSettlementRow: null,
    ResaleScopeRequest: null,
    /**
     * `errors.yaml`'s shape, reached by every operation that declares a 4xx. It
     * is a WIRE envelope and not a stored thing; it has no `required` set here,
     * so it contributes nothing either way and is listed only to keep the map
     * total.
     */
    Problem: null,
  }

  it('5a · only `listTenants` has a producer for every `required` field it names', () => {
    const doc = loadTier('platformConsole') as unknown as {
      components: { schemas: Record<string, { properties?: object; required?: string[] }> }
      paths: Record<string, Record<string, unknown>>
    }
    const control = sqlCode(sqlCorpus(CONTROL_MIGRATIONS))
    sqlCorpusIsReal(control, 'the control migration set')

    /**
     * 🛑 **THE CORPUS IS RESOLVED INTO RELATIONS, NOT SCANNED FOR TOKENS —
     * K5, G1773.** `relationsOf()` is `tests/schema-table-resolver.ts`'s and
     * its header carries the measurement. The corpus is UNCHANGED: this is
     * still `db/migrations-control/` and nothing else, because
     * `docs/build/completion-plan.md` §6 forbids pointing this scan at
     * `db/migrations/` by name, and the resolver is the PRECONDITION for that
     * widening rather than the widening.
     */
    const relations: Relations = relationsOf(control)
    relationsAreReal(relations, 'the control migration set', 4, 6)

    /* ANTI-VACUOUS. `tenancy_roster`'s columns must RESOLVE — not merely appear
       — or every operation below is "unproducible" because the reader parsed
       nothing. This reads three columns OFF THE NAMED TABLE, which is a
       strictly stronger probe than the token test it replaces: the old version
       passed on `tenant_id` appearing anywhere at all. */
    for (const known of ['tenant_id', 'deployment_mode', 'support_access_mode']) {
      assert.ok(
        relations.get('tenancy_roster')?.has(known) === true,
        `\`tenancy_roster\` did not resolve a \`${known}\` column, so this section would ` +
          'report every field unproducible against a corpus it failed to parse. **This ' +
          'resolver fails CLOSED, so a broken reader is a GREEN run**, which is the ' +
          'opposite of the token scanner it replaced and the reason this probe exists. ' +
          `Parsed tables: [${[...relations.keys()].join(', ')}]`,
      )
    }

    /**
     * ⚠️ WALKED OUT OF `paths` RATHER THAN OUT OF `routesOf()`, AND THE REASON
     * IS THE ONE THIS REPOSITORY CATALOGUES: `RouteSpec` carries `url` — the
     * FASTIFY form, `:param` and the base path applied — and the document is
     * keyed on the OpenAPI form. Joining the two by string would be a rule
     * keyed on a spelling. The operation OBJECT is what carries the `$ref`s,
     * so this reads the document it is asking about.
     */
    const operations: { id: string; raw: string }[] = []
    for (const [, item] of Object.entries(doc.paths)) {
      for (const [method, op] of Object.entries(item)) {
        if (!['get', 'put', 'post', 'patch', 'delete'].includes(method)) continue
        const id = (op as { operationId?: string }).operationId
        if (id === undefined) continue
        operations.push({ id, raw: JSON.stringify(op) })
      }
    }
    assert.ok(
      operations.length >= 14,
      `the console tier declares ${operations.length} operations, so the enumeration is not ` +
        'reading the document',
    )

    /**
     * Every `required` property name an operation's schemas can carry, at any
     * depth, following `$ref` transitively.
     *
     * 🛑 **THE FIRST DRAFT READ ONLY A NAMED SCHEMA'S TOP-LEVEL `required` AND
     * THE DOCUMENT CAUGHT IT — G1166.** `getInvoice` names `InvoiceDetail`,
     * which is an `allOf` of `InvoiceSummary` and an INLINE object; its own
     * top level has no `required` at all, so the operation reported ZERO
     * unproducible fields and read as mountable while every one of
     * `InvoiceSummary`'s six is missing and there is no invoice table in
     * either database. **A rule keyed on where `required` usually sits rather
     * than on where it can sit** — §5.1, inside a control that measures a
     * §5.1-shaped blocker. Recorded rather than quietly fixed, because the
     * shape it would have produced is the one G833 exists to refuse: an
     * operation that looks complete and ships a 200 missing its own fields.
     *
     * ⚠️ THIS IS STILL A SCANNER AND NOT A RESOLVER — the `visited` set is
     * what keeps a recursive `$ref` from hanging, and nothing here evaluates
     * `oneOf`, `discriminator` or `not`. G109's real parser is ruled and
     * unbought; `tools/check-wire-mirror.mjs` hand-scans for the same reason
     * and says so in the same words.
     */
    const requiredIn = (node: unknown, visited: Set<string>): readonly string[] => {
      if (node === null || typeof node !== 'object') return []
      if (Array.isArray(node)) return node.flatMap((v) => requiredIn(v, visited))
      const obj = node as Record<string, unknown>
      const out: string[] = []
      const ref = obj['$ref']
      if (typeof ref === 'string') {
        const name = /#\/components\/schemas\/([A-Za-z]+)/.exec(ref)?.[1]
        if (name !== undefined && !visited.has(name)) {
          visited.add(name)
          out.push(...requiredIn(doc.components.schemas[name], visited))
        }
      }
      if (Array.isArray(obj['required'])) {
        out.push(...(obj['required'] as unknown[]).filter((v): v is string => typeof v === 'string'))
      }
      for (const [k, v] of Object.entries(obj)) {
        if (k === 'required' || k === '$ref') continue
        out.push(...requiredIn(v, visited))
      }
      return out
    }

    const requiredOf = (schemaName: string): readonly string[] => [
      ...new Set(requiredIn(doc.components.schemas[schemaName], new Set([schemaName]))),
    ]

    const unproducible: string[] = []
    const producible: string[] = []
    for (const op of operations) {
      // Every `#/components/schemas/X` this operation mentions at all. A
      // request body counts too: an operation nothing can SATISFY is as
      // unmountable as one nothing can ANSWER.
      const named = [
        ...new Set([...op.raw.matchAll(/#\/components\/schemas\/([A-Za-z]+)/g)].map((m) => m[1] ?? '')),
      ]
      const missing = named.flatMap((s) =>
        requiredOf(s)
          .filter(
            (p) =>
              /* THE RESOLUTION. `SCHEMA_TABLE[s]` is the table this schema
                 comes from, and `undefined` — a schema the map does not cover
                 — is coerced to `null` here and CAUGHT by the totality
                 assertion below, so it can never read as a quiet exemption. */
              !resolves(relations, SCHEMA_TABLE[s] ?? null, p) &&
              DERIVED_PRODUCERS[`${s}.${p}`] === undefined,
          )
          .map((p) => `${s}.${p}`),
      )
      if (missing.length > 0) unproducible.push(`${op.id}: ${missing.join(', ')}`)
      else producible.push(op.id)
    }

    /* ANTI-VACUOUS, THE OTHER WAY. A derivation nobody can find would make this
       section report an operation producible on the strength of a string. */
    const serverDir = path.join(SERVER_DIR, 'data-plane')
    const planeCode = tsFilesUnder(serverDir)
      .map((f) => f.code)
      .join('\n')
    for (const [field, { derivation, from }] of Object.entries(DERIVED_PRODUCERS)) {
      assert.ok(
        new RegExp(`\\b${derivation}\\b`).test(planeCode),
        `\`${field}\` is exempted above on the strength of \`${derivation}()\`, and nothing ` +
          'in `server/data-plane/` calls it. **An exemption whose producer does not exist is ' +
          'this section reporting an operation mountable because somebody wrote a string in ' +
          'a map** — which is worse than the landmark rule it replaced. Either the derivation ' +
          'moved, or the entry is stale and the operation is unproducible again.',
      )
      assert.ok(
        new RegExp(`\\b${from}\\b`).test(control),
        `\`${field}\`'s derivation reads \`${from}\`, which is not in the control migration ` +
          'set. A derivation with no INPUT is not a derivation — it is an invention, which ' +
          'is the direction G284 refuses (*"a result nobody may read is not persistence"*) ' +
          'and G833 refuses one table over.',
      )
    }

    /* ------------------------------------------------------------------ *
     * THE MAP'S OWN THREE GUARDS — K5, G1774. Each is red in a direction
     * somebody would otherwise reach for.
     * ------------------------------------------------------------------ */

    /* (1) TOTAL. A schema the map does not cover reads as `null` above, which
       is an exemption nobody argued. Set equality both ways: an unlisted
       schema AND a listed one the tier no longer reaches are each a red. */
    const referenced = [
      ...new Set(
        operations.flatMap((op) =>
          [...op.raw.matchAll(/#\/components\/schemas\/([A-Za-z]+)/g)].map((m) => m[1] ?? ''),
        ),
      ),
    ].sort()
    assert.deepEqual(
      Object.keys(SCHEMA_TABLE).sort(),
      referenced,
      'the schema→table map is not TOTAL over the schemas this tier reaches. A schema it ' +
        'does not cover resolves to `null` and reports unproducible — which is the SAFE ' +
        'direction and is still a verdict nobody argued, and a schema it covers that the ' +
        'tier no longer reaches is a decision about a document that has moved. **A missing ' +
        'key is not a compile error in TypeScript at an index read**, which is the whole ' +
        `reason this assertion exists. Tier reaches ${referenced.length}; map covers ` +
        `${Object.keys(SCHEMA_TABLE).length}.`,
    )

    /* (2) EVERY NAMED TABLE IS REAL. §5a already owes this for a derivation's
       `from`; a resolution target owes exactly the same thing, and a map
       pointing at a table nobody built would report fields producible on the
       strength of a string. */
    for (const [schema, table] of Object.entries(SCHEMA_TABLE)) {
      if (table === null) continue
      assert.ok(
        relations.has(table),
        `\`${schema}\` is mapped to \`${table}\`, which is not a table in the control ` +
          'migration set. **A map entry pointing at a relation nobody built is this section ' +
          'reporting an operation mountable because somebody wrote a string** — the same ' +
          `defect \`DERIVED_PRODUCERS\` guards against one block up. Parsed: ` +
          `[${[...relations.keys()].join(', ')}]`,
      )
    }

    /* (3) NO `null` IS A LIE. This is the assertion in the direction nobody
       writes: if some single control table carries EVERY one of a `null`-mapped
       schema's `required` columns, the `null` is describing a schema that now
       HAS a plausible home, and the decision has to be re-read rather than
       inherited. Checked against the CONTROL corpus alone — checking it against
       `db/migrations/` would manufacture exactly the coincidences this slice
       removes, because a tenant-database table cannot serve a console
       operation at any price (G831). */
    /**
     * 🛑 **AND ITS FIRST RUN REPRODUCED THE EXACT DEFECT THIS SLICE REMOVES,
     * WHICH IS WHY THE ARITY CLAUSE BELOW IS AN ARGUMENT AND NOT A THRESHOLD —
     * K5, G1775.** The first draft was *"a table carries EVERY required column"*
     * with no arity condition, and it went red on its first run:
     *
     *     ByoaEscalationRequest -> onboarding_forced_step carries all of [reason]
     *
     * **`ByoaEscalationRequest` requires exactly ONE field, so *"every required
     * column"* IS *"one coincidental column"* — the `reason` coincidence,
     * arriving inside the guard written to police the repair for it.** §5.1,
     * one layer up from where this section last caught it.
     *
     * ⚠️ **THE REPAIR IS NOT `>= 2` AS A NUMBER SOMEBODY PICKED.** A falsifier
     * is an EVIDENCE test, and one matching column is not weak evidence — it is
     * the definition of the thing being excluded, carrying zero corroboration.
     * **One and two are qualitatively different; two and three would be a
     * guess**, which is the distinction `tools/check-doc-counts.mjs`'s band
     * commentary spends a page on.
     *
     * ⚠️ **AND THE EXCLUDED SET IS DERIVED AND PINNED RATHER THAN NAMED**, so a
     * SECOND single-field schema cannot slip into the unfalsifiable class
     * silently — the assertion below is what a reader meets.
     */
    const nullIsALie: string[] = []
    const unfalsifiable: string[] = []
    for (const [schema, table] of Object.entries(SCHEMA_TABLE)) {
      if (table !== null) continue
      const need = requiredOf(schema).map(columnFor)
      if (need.length === 0) continue
      if (need.length < 2) {
        unfalsifiable.push(schema)
        continue
      }
      for (const [candidate, columns] of relations) {
        if (need.every((c) => columns.has(c))) {
          nullIsALie.push(`${schema} -> ${candidate} carries all of [${need.join(', ')}]`)
        }
      }
    }
    assert.deepEqual(
      unfalsifiable.sort(),
      /**
       * ⚠️ **THIS WAS WRITTEN AS `['ByoaEscalationRequest']` AND THE ASSERTION
       * FOUND THE SECOND ONE — `ResaleScopeRequest`, whose only `required`
       * field is `blueprints`. It is DERIVED here rather than corrected
       * quietly**, because a guard that has to be told its own subject twice
       * is the reason it enumerates rather than names.
       */
      ['ByoaEscalationRequest', 'ResaleScopeRequest'],
      'the set of `null`-mapped schemas too narrow to falsify has moved. **A schema ' +
        'requiring ONE field cannot be checked by column overlap, because a single match is ' +
        'exactly what a coincidence looks like** — measured: the first draft of the guard ' +
        'below reported `ByoaEscalationRequest -> onboarding_forced_step` on the strength of ' +
        'the same `reason` column that made this operation look producible in the first ' +
        'place. If this set GREW, a second schema now has a `null` nothing can check and its ' +
        'entry is carried on its argument alone; if it SHRANK, a schema gained a required ' +
        `field and is falsifiable now. Found: [${unfalsifiable.join(', ')}]`,
    )
    assert.deepEqual(
      nullIsALie,
      [],
      'a schema mapped to `null` — "no table produces this" — has a control table carrying ' +
        'EVERY one of its `required` columns. **`null` is fail-closed and therefore FREE: it ' +
        'reports an operation unmountable for ever, and nothing else in this suite would ' +
        'ever notice it had become wrong.** Re-read the entry and its argument before ' +
        `changing it; a coincidence is still possible and is still a decision.\n  ` +
        nullIsALie.join('\n  '),
    )

    /**
     * ⚠️ **THE HELD-OUT OPERATION'S CONDITION IS REPLACED BY A POSITIVE
     * ASSERTION, NOT DELETED WITH THE HOLD-OUT — K5, G1773.** The old form
     * checked that `ByoaEscalationRequest` still required exactly `reason`, so
     * that a NAMED exclusion could be trusted. There is no exclusion now, so
     * the thing to assert is the one that would silently regress: that the
     * resolver refuses this operation FOR THE RIGHT REASON.
     *
     * 🛑 IT IS A DIFFERENTIAL AND THAT IS THE POINT — the token scanner this
     * replaced said PRODUCIBLE for this exact operation, witnessed. If the
     * `reason` column on `onboarding_forced_step` ever makes it producible
     * again, the resolver has stopped resolving.
     */
    const byoaReason = tablesCarrying(relations, 'reason')
    assert.ok(
      byoaReason.length > 0,
      'no control table carries a `reason` column, so the differential below is vacuous — ' +
        'the coincidence this section was repaired for no longer exists in the corpus and ' +
        'this assertion is asserting nothing. **A control that can only pass is not a ' +
        'control.** Re-read `db/migrations-control/0030_onboarding_record.sql`.',
    )
    assert.ok(
      unproducible.some((row) => row.startsWith('openByoaEscalation:')),
      '`openByoaEscalation` is not in the unproducible set. **The TOKEN SCANNER this ' +
        'section used until 21 Sep 2026 reported it PRODUCIBLE, on the strength of the ' +
        `\`reason\` column on [${byoaReason.join(', ')}] — a table about H2's delivery ` +
        'sequence with nothing to do with a hosted-to-BYOA move.** Witnessed: *"Producible: ' +
        '[listTenants, openByoaEscalation]"*. If it is producible again, either a ' +
        '`byoa_escalation` table was built — in which case read G300s other two parts — or ' +
        'the resolver has regressed to a token test and the coincidence is back.',
    )

    assert.deepEqual(
      producible,
      ['listTenants'],
      /**
       * ⚠️ **THIS ASSERTED `[]` UNTIL 20 Sep 2026 AND ITS MESSAGE IS QUOTED
       * INSIDE THE NEW ONE, because it named the exact thing the mounting
       * commit had to do.**
       */
      'the producible set on the platform-console tier is not exactly `listTenants`. ' +
        '⚠️ THIS ASSERTION READ `[]` UNTIL 20 Sep 2026 and its message said: *"an operation ' +
        'on the platform-console tier now has EVERY `required` field … backed by a column … ' +
        'it is the moment to read the other two — MODEL and CAPABILITY — rather than to ' +
        'mount. G833 is the one to check first."* **That was done**: G833 was checked, the ' +
        '`stage` column stayed refused, and the owner ruled the value DERIVED instead. ' +
        '🛑 IF THIS SET HAS GROWN, the same instruction applies to whatever joined it — ' +
        'G300 lifts PER OPERATION and on merit, and a table is only the first of its three ' +
        'parts. **IF IT HAS SHRUNK, `listTenants` is mounted and unproducible**, which is ' +
        'the 500 `tests/http/console-roster-served.test.ts` §2 exists to catch. ' +
        `Producible: [${producible.join(', ')}].\n` +
        `Still short of a producer (${unproducible.length}):\n` +
        unproducible.join('\n'),
    )
    assert.equal(
      unproducible.length,
      13,
      /**
       * ⚠️ **THIS READ `12` UNTIL 21 Sep 2026 AND THE THIRTEENTH IS NOT A NEW
       * BLOCKER — IT IS `openByoaEscalation` ARRIVING WHERE IT ALWAYS BELONGED,
       * K5, G1773.** The old message is quoted whole because its arithmetic is
       * the thing that changed: *"TWELVE, PLUS THE ONE HELD OUT BY NAME ABOVE,
       * IS THIRTEEN OF THE FOURTEEN — a billing period, an invoice, a pack
       * draft, a rate card; none of those has a table in either database."*
       * **The sum was always thirteen; what moved is that one of the thirteen
       * is now refused by the PROPERTY rather than by a named hold-out**, so
       * this figure and `producible` now partition the fourteen between them
       * with nothing set aside.
       */
      'the number of console operations with no producer for a `required` field has moved ' +
        'and the producible set has not. **THIRTEEN OF THE FOURTEEN, WITH NOTHING HELD OUT ' +
        'BY NAME** — a billing period, an invoice, a pack draft, a rate card, a BYOA ' +
        'escalation; none of those has a table in either database. This figure moving ' +
        'without `producible` moving means a SCHEMA changed rather than a mount, and the ' +
        `two are different events. Found ${unproducible.length}:\n` +
        unproducible.join('\n'),
    )
    /* The two sets PARTITION the tier. With the hold-out gone there is no third
       bucket, and an operation falling out of both would be a reader defect
       rather than a finding. */
    assert.equal(
      producible.length + unproducible.length,
      operations.length,
      'the producible and unproducible sets no longer partition the tier. Every operation ' +
        'must land in exactly one of them now that nothing is held out by name.',
    )
  })

  it('5b · and `stage` is STILL not a column — G833 stands, and is not what unblocked it', () => {
    /**
     * 🛑 NAMED SEPARATELY BECAUSE IT IS THE ONE THE RULING UNBLOCKED. Thirteen
     * of the fourteen have no table at all — a billing period, an invoice, a
     * pack draft, a rate card; none of those exists in either database.
     * `listTenants` has its table (G831), its reach (G1161) and its capability
     * (`view_substrate`, G601), and is short of ONE COLUMN.
     *
     * ⚠️ AND THE COLUMN IS REFUSED RATHER THAN MISSING. `0002_tenancy_roster.sql`
     * refuses it by name and calls the refusal a BLOCKER: *"`fast-json-stringify`
     * serialises without validating, so an operation with an almost-complete
     * table ships a 200 missing `required` fields SILENTLY."* The commit that
     * gives a stage a producer deletes this assertion and re-argues that
     * refusal; it does not discover this test.
     */
    const doc = loadTier('platformConsole') as unknown as {
      components: { schemas: Record<string, { required?: string[] }> }
    }
    const control = sqlCode(sqlCorpus(CONTROL_MIGRATIONS))
    sqlCorpusIsReal(control, 'the control migration set')

    /**
     * ⚠️ **RESOLVED RATHER THAN SCANNED SINCE 21 Sep 2026 — K5, G1773.** The
     * answer is the same `['stage']` and the QUESTION is different: this reads
     * five columns off `tenancy_roster` BY NAME rather than finding five tokens
     * somewhere in a four-table corpus. Leaving a token test beside a resolver
     * would be two rules for one question, and the weaker one is the one a
     * later reader copies.
     */
    const relations = relationsOf(control)
    relationsAreReal(relations, 'the control migration set', 4, 6)

    const required = doc.components.schemas['TenantSummary']?.required ?? []
    assert.ok(required.includes('stage'), '`TenantSummary` no longer marks `stage` required')
    const missing = required.filter((p) => !resolves(relations, 'tenancy_roster', p))
    assert.deepEqual(
      missing,
      ['stage'],
      '`TenantSummary`s unproducible `required` set is no longer exactly `[stage]`. If it ' +
        'GREW, the roster table lost a column and `listTenants` got further from mountable; ' +
        'if it SHRANK to empty, `stage` has a producer and **G833 is discharged** — in which ' +
        'case read `db/migrations-control/0002_tenancy_roster.sql`s refusal and G535`s ' +
        'deliberate absence before mounting, because a `stage` column in the control ' +
        `database is a second home for H2's onboarding state. Found: [${missing.join(', ')}]`,
    )
  })
})
