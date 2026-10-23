/**
 * INVARIANT 3, MADE STRUCTURAL — "the control plane publishes downward and never
 * reads tenant data."
 *
 * 🛑 RED AT THE COMMIT THAT INTRODUCES IT. There is no compose file, no control
 * plane and no data plane in this repository.
 *
 * ⚠️ THIS FILE NEVER SKIPS, AND THAT IS THE POINT OF IT. Every other test in
 * `tests/http/` and `tests/db/` skips loudly when no PostgreSQL answers, which
 * means a machine with no database can run the suite and learn nothing about
 * tenancy. This one needs no database and no listener: it reads a topology and a
 * configuration. A property that can be checked without running anything should
 * be checked without running anything, because that is the check that still runs
 * on the day the database is down.
 *
 * WHY STRUCTURAL RATHER THAN BEHAVIOURAL. A test that asserted "the control
 * plane returned 403 when it tried to read a tenant row" would be asserting that
 * a check exists — and a check is a thing that can be removed, bypassed, or
 * simply not reached by the one code path that matters. RULING 3, 16 Aug 2026:
 * **two processes, two databases, compose — the plane boundary is enforced by
 * TOPOLOGY, not by review.** The control plane must not be able to reach tenant
 * data because it holds no credential that reaches it, and a credential it does
 * not hold cannot be misused by code nobody reviewed.
 *
 * ┌─ WHAT THIS FILE PINS ──────────────────────────────────────────────────────┐
 * │ The compose service NAMES below are the contract this test asserts against. │
 * │ They are pinned here because a topology nothing can name is a topology       │
 * │ nothing can check. Rename a service and rename it here, in the same commit.  │
 * │                                                                             │
 * │   control-plane      control-plane-db                                       │
 * │   data-plane         data-plane-db                                          │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ A LINE SCANNER, NOT A YAML PARSER — G109's real parser is ruled and
 * unbought, and buying one is not this file's decision. Every scan asserts it
 * found its anchor, and the ANTI-VACUOUS assertion below is the load-bearing
 * one: before claiming the control-plane block does not reference the data
 * plane's database, this file proves it can SEE such a reference, by finding the
 * one the data-plane block is required to carry. Without that, a scanner that
 * matched nothing at all would report perfect isolation — §5.6, the defect
 * shape where a checker passes while asserting nothing.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { REPO_ROOT, planeConfig } from './harness.ts'

/* ------------------------------------------------------------------ *
 * The compose file.
 * ------------------------------------------------------------------ */

const CANDIDATES = ['compose.yaml', 'compose.yml', 'docker-compose.yaml', 'docker-compose.yml']

function findCompose(): { path: string; text: string } | null {
  for (const name of CANDIDATES) {
    const p = path.join(REPO_ROOT, name)
    if (existsSync(p)) return { path: name, text: readFileSync(p, 'utf8') }
  }
  return null
}

const CONTROL = 'control-plane'
const CONTROL_DB = 'control-plane-db'
const DATA = 'data-plane'
const DATA_DB = 'data-plane-db'

/**
 * The lines belonging to one service, by indentation. `services:` at column 0,
 * each service name at indent 2, its body deeper than that.
 */
function serviceBlock(text: string, name: string): readonly string[] | null {
  const lines = text.split('\n')
  const at = lines.findIndex((l) => new RegExp(`^\\s{2}${name}:\\s*$`).test(l))
  if (at === -1) return null
  const body: string[] = []
  for (let i = at + 1; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (line.trim() === '') continue
    const indent = line.length - line.trimStart().length
    if (indent <= 2) break
    body.push(line)
  }
  return body
}

/* ------------------------------------------------------------------ *
 * Credential-shaped leaves of a plane's own configuration.
 * ------------------------------------------------------------------ */

/**
 * 🛑 `host` AND `port` ARE DELIBERATELY NOT IN THIS LIST, AND THE FIRST GREEN RUN
 * OF THIS FILE IS WHY. With both planes on 5432 — the ordinary case, and the
 * case in the compose file above — a rule that treated a port as a credential
 * reported a cross-plane leak on two configurations that shared nothing but the
 * PostgreSQL default. A control that fails while the property holds is a control
 * people learn to switch off; `tools/check-pack-safety.mjs:40-44` argues the same
 * polarity from the other side.
 *
 * What survives is the narrower and truer claim: a host and a port do not
 * authenticate anybody. **A database NAME, a USER, a PASSWORD or a whole URL
 * do**, and the control plane must hold none of the data plane's.
 */
const CREDENTIAL_KEY = /^(name|database|user|username|password|secret|url|dsn|connectionString)$/i
const DATABASE_PATH = /(^|[^a-z])(db|database|postgres|pg|sql)([^a-z]|$)/i

/**
 * Every string leaf of `value` that sits under a database-ish path AND is named
 * like a credential. Shape-tolerant on purpose: `{ database: { host, name, user } }`
 * and `{ db: { url } }` both yield their secrets, and neither layout is
 * prescribed by this test.
 *
 * Numbers are excluded outright — every numeric leaf a database config carries is
 * a port, a pool size or a timeout, and none of them is a key.
 */
function databaseLeaves(value: unknown, trail: readonly string[] = []): readonly string[] {
  if (value === null || value === undefined) return []
  if (typeof value === 'string') {
    const key = trail[trail.length - 1] ?? ''
    const underDatabase = trail.some((k) => DATABASE_PATH.test(k))
    if (underDatabase && CREDENTIAL_KEY.test(key)) {
      return value.length >= 4 && !/^\d+$/.test(value) ? [value] : []
    }
    return []
  }
  if (typeof value === 'number' || typeof value === 'boolean') return []
  if (Array.isArray(value)) return value.flatMap((v, i) => databaseLeaves(v, [...trail, String(i)]))
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      databaseLeaves(v, [...trail, k]),
    )
  }
  return []
}

describe('plane separation — the control plane holds no route to tenant data', () => {
  /* ================================================================ *
   * 4a. THE TOPOLOGY.
   * ================================================================ */

  it('compose declares two planes and two databases, and the control plane names neither of the data plane\'s', () => {
    const compose = findCompose()
    if (compose === null) {
      assert.fail(
        'INVARIANT 3 IS ENFORCED BY NOTHING. RULING 3 (16 Aug 2026) puts the plane ' +
          'boundary in the topology — two processes, two databases, compose — so that ' +
          '"the control plane never reads tenant data" is a credential the control ' +
          'plane does not hold rather than a check somebody remembered to write. ' +
          `None of ${CANDIDATES.join(', ')} exists at the repository root, so there is ` +
          'no topology to enforce it and no artefact this test can read. Note that ' +
          'this is NOT a missing symbol: the assertion is that a separation exists, ' +
          'and it does not.',
      )
    }

    // ⚠️ Annotated explicitly, and not for style: `assert.ok` is an assertion
    // FUNCTION, and TypeScript refuses to narrow a binding whose type it had to
    // infer (TS7022). An inferred `readonly string[] | null` here compiles until
    // the first `assert.ok(control !== null)`, and then fails circularly.
    const control: readonly string[] | null = serviceBlock(compose.text, CONTROL)
    const controlDb: readonly string[] | null = serviceBlock(compose.text, CONTROL_DB)
    const data: readonly string[] | null = serviceBlock(compose.text, DATA)
    const dataDb: readonly string[] | null = serviceBlock(compose.text, DATA_DB)

    // `assert.fail` returns `never`, so this narrows by ordinary control flow.
    // `assert.ok` would not: it is an assertion FUNCTION, and TypeScript then
    // refuses to narrow anything downstream that it had to infer (TS7022).
    for (const [name, block] of [
      [CONTROL, control],
      [CONTROL_DB, controlDb],
      [DATA, data],
      [DATA_DB, dataDb],
    ] as ReadonlyArray<readonly [string, readonly string[] | null]>) {
      if (block === null) {
        assert.fail(
          `${compose.path} declares no service \`${name}\`. This test pins the four ` +
            'service names because a topology nothing can name is a topology nothing ' +
            'can check; see the header.',
        )
      }
    }
    if (control === null || data === null || dataDb === null) {
      assert.fail('unreachable: the per-service check above already failed')
    }

    /* ANTI-VACUOUS, AND IT IS THE ASSERTION THE NEXT ONE RESTS ON.
     *
     * Before claiming the control-plane block does not mention the data plane's
     * database, prove this scanner can see such a mention at all — by finding the
     * one the data plane itself must carry. A scanner that matched nothing would
     * otherwise report perfect isolation on an empty file. */
    assert.ok(
      data.some((l) => l.includes(DATA_DB)),
      `the \`${DATA}\` service does not reference \`${DATA_DB}\` anywhere in its ` +
        'block, so either the data plane does not reach its own database — in which ' +
        'case nothing works — or this scanner cannot see a reference, in which case ' +
        'the isolation asserted next is the silence of a broken check.',
    )

    /* THE ASSERTION. */
    const trespass: readonly string[] = control.filter((l) => l.includes(DATA_DB) || l.includes(`${DATA}-db`))
    assert.deepEqual(
      trespass,
      [],
      `the \`${CONTROL}\` service references \`${DATA_DB}\`. INVARIANT 3: "the ` +
        'control plane publishes downward and never reads tenant data." Two ' +
        'databases exist so that fails by CONSTRUCTION; a control plane that can ' +
        'resolve the data plane\'s database host has put the boundary back into ' +
        'review, where it was before ruling 3.',
    )

    /* And the credentials themselves, wherever the data plane's database states
     * them. A control plane that names a different host but the same password is
     * one DNS entry away from a cross-plane read. */
    const secrets: readonly string[] = (dataDb ?? [])
      .map((l) => /^\s*-?\s*(?:POSTGRES_(?:DB|USER|PASSWORD))[:=]\s*['"]?([^'"\s]+)/.exec(l))
      .flatMap((m) => (m === null ? [] : [m[1] ?? '']))
      .filter((v) => v.length >= 4)

    assert.ok(
      secrets.length > 0,
      `no POSTGRES_DB / POSTGRES_USER / POSTGRES_PASSWORD could be read out of the ` +
        `\`${DATA_DB}\` service, so the credential comparison below would compare ` +
        'nothing and pass against anything.',
    )

    for (const secret of secrets) {
      const leaked: readonly string[] = control.filter((l) => l.includes(secret))
      assert.deepEqual(
        leaked,
        [],
        `the \`${CONTROL}\` service carries \`${secret}\`, which is a credential of ` +
          `\`${DATA_DB}\`. The plane boundary is only a boundary while the control ` +
          'plane cannot authenticate to the data plane\'s database.',
      )
    }
  })

  /* ================================================================ *
   * 4b. THE RESOLVED CONFIGURATION, WHICH IS WHAT THE PROCESS ACTUALLY USES.
   *
   * Compose describes what is handed to a container. This asserts what the
   * process makes of it — the two are not the same thing, and a default baked
   * into a config module is invisible to the file above.
   * ================================================================ */

  /* ================================================================ *
   * 4c. THE IMPORT GRAPH — ADDED 19 Sep 2026 WITH G200's GATE, AND IT
   *     CLOSES A DIRECTION 4a AND 4b CANNOT SEE.
   *
   * 🛑 WHY THE GATE MADE THIS NECESSARY. G200 put an authoriser on
   * `PlaneOptions`, which lives in `server/http/app.ts` — THE ONE MODULE
   * BOTH PLANES SHARE. The obvious shape for it was
   * `(principal, capability: Capability) => …`, typed from
   * `model/access.ts`. That would have put the access model on the
   * CONTROL PLANE's import graph by way of the layer they share, and
   * neither assertion above could have seen it: 4a reads compose and 4b
   * reads a resolved configuration object, and an import is in neither.
   * The parameter is therefore a `string`, and `app.ts` says so on the
   * declaration.
   *
   * A property that is bought by a type signature is a property one
   * refactor can spend. This is the reader for it.
   *
   * ⚠️ A LINE SCANNER, and it is honest about what that costs: it reads
   * `import` specifiers as text and cannot follow one module to the
   * next. `server/control-plane/start.ts` already carries the standing
   * correction about the transitive case — `provision.ts` imports
   * `db/migrate.ts`, which imports `ROLES` from `db/env.ts`, so
   * `dbTarget()` IS loaded here transitively and nothing calls it. What
   * this asserts is the DIRECT edge, which is the one a refactor adds.
   * ================================================================ */

  it('no module under server/control-plane names model/access.ts or db/tenant-scope.ts', () => {
    const dir = path.join(REPO_ROOT, 'server', 'control-plane')
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts'))

    /* ANTI-VACUOUS. A directory listing that came back empty would report
     * perfect isolation, and the shared layer below must be found or the
     * scanner is not reading import lines at all. */
    assert.ok(
      files.length >= 5,
      `only ${files.length} TypeScript file(s) under server/control-plane, so this scan is ` +
        'reading the wrong directory and its silence means nothing.',
    )
    const sources = files.map((f) => ({ f, text: readFileSync(path.join(dir, f), 'utf8') }))
    assert.ok(
      sources.some(({ text }) => /from '\.\.\/http\/app\.ts'/.test(text)),
      'no file in this directory imports `../http/app.ts`, which every plane is built from — ' +
        'so this scanner is not seeing import specifiers, and the absences it reports below ' +
        'are the silence of a broken check rather than a property.',
    )

    const FORBIDDEN = [/model\/access/, /tenant-scope/]
    const trespass = sources.flatMap(({ f, text }) =>
      text
        .split('\n')
        .filter((l) => /^\s*import\b/.test(l) || /\bfrom '/.test(l) || /\bawait import\(/.test(l))
        .filter((l) => FORBIDDEN.some((re) => re.test(l)))
        .map((l) => `${f}: ${l.trim()}`),
    )

    assert.deepEqual(
      trespass,
      [],
      'a module in the control plane imports the access model or the tenant-scoped ' +
        'transaction seam. INVARIANT 3: "the control plane publishes downward and never reads ' +
        'tenant data." `server/http/app.ts` types its authoriser\'s capability as a bare ' +
        '`string` precisely so that adding a gate to the shared layer cannot drag ' +
        '`model/access.ts` in here, and this is the assertion that keeps that decision from ' +
        `being undone by a tidy-up.\n\n${trespass.join('\n')}`,
    )
  })

  it('the control plane\'s resolved configuration holds no credential for the data plane\'s database', async () => {
    const control = await planeConfig('control')
    if (!control.ok) {
      assert.fail(
        'INVARIANT 3 HAS NO CONFIGURATION TO BE TRUE OF. There is no control plane, ' +
          'so the property "it holds no credential reaching tenant data" is neither ' +
          'true nor false — and the day it acquires one, nothing here will notice. ' +
          `Cause: ${control.reason}`,
      )
    }
    const data = await planeConfig('data')
    if (!data.ok) {
      assert.fail(
        'THERE IS NO DATA-PLANE CONFIGURATION TO COMPARE AGAINST, so this test ' +
          'cannot name the credentials the control plane must not hold, and an ' +
          `absence it cannot describe is an absence it cannot assert. Cause: ${data.reason}`,
      )
    }

    /**
     * 🛑 **NARROWED TO THE TENANT DATABASE ON 20 Sep 2026 — G1167 — AND THE
     * NARROWING IS A REPAIR RATHER THAN A WEAKENING.** This read
     * `databaseLeaves(data.value)`, every credential-shaped leaf of the data
     * plane's WHOLE configuration, and it went RED the moment that
     * configuration gained a second database block:
     *
     *     the control plane's resolved configuration carries the data plane's
     *     database credentials … Found: [ 'reconcile_control' ]
     *
     * **`reconcile_control` is the name of the CONTROL database and both
     * planes name it on purpose** — G1161, the owner's ruling: *"The data
     * plane gains a READ-ONLY control-database pool."* The rule was keyed on
     * "a credential-shaped leaf of the data plane's config" (the landmark)
     * rather than on "a credential that reaches TENANT DATA" (the property
     * invariant 3 names), and the first configuration that distinguished the
     * two made it report a breach that IS the ruling. §5.1, inside the control
     * written to hold this boundary.
     *
     * ⚠️ **`data.value.database` IS THE TENANT DATABASE AND `data.value.controlRead`
     * IS NOT**, which is exactly why `server/data-plane/config.ts` carries them
     * as two fields rather than as two entries of one list: a walk over "every
     * database-ish leaf" cannot tell them apart, and the field they sit on can.
     */
    const dataConfig = data.value as { database?: unknown }
    const dataSecrets = databaseLeaves({ database: dataConfig.database })
    assert.ok(
      dataSecrets.length > 0,
      'no database credential could be identified in the data plane\'s own TENANT ' +
        'database block, so the assertion below would search for nothing and pass ' +
        'against any control plane at all. The field is `database`; if it has been ' +
        'renamed, this narrowing is reading nothing.',
    )

    const controlText = JSON.stringify(control.value)
    const held: readonly string[] = dataSecrets.filter((secret) => controlText.includes(secret))

    assert.deepEqual(
      held,
      [],
      'the control plane\'s resolved configuration carries the data plane\'s ' +
        'TENANT database credentials. INVARIANT 3: "the control plane publishes downward ' +
        'and never reads tenant data." It is enforced by not holding the key, not ' +
        'by choosing not to turn it.',
    )
  })

  /* ================================================================ *
   * 4d. THE OTHER DIRECTION, WHICH ONLY EXISTS SINCE 20 Sep 2026 —
   *     G1161, AND IT IS THE HALF THE NARROWING ABOVE OWES.
   * ================================================================ */

  it('⛔ the data plane holds NO control-database credential at all — G4320', async () => {
    /**
     * This read *"the data plane's control-read credential is its OWN, and not
     * the control plane's"* (G1161) until 5 Oct 2026. THE OWNER'S "Full
     * restore" ruling retired it: the data plane reaches the roster through the
     * control plane's signed internal tier and carries the ADDRESS of that tier,
     * never a credential for the control database.
     */
    const data = await planeConfig('data')
    if (!data.ok) assert.fail(`the data plane's configuration did not resolve: ${data.reason}`)
    const value = data.value as Record<string, unknown>
    assert.ok('internalControlPlaneUrl' in value, 'anti-vacuity: the data plane config lost its internal-edge field')
    assert.equal('controlRead' in value, false, 'the data plane config carries a `controlRead` target again')
  })
})
