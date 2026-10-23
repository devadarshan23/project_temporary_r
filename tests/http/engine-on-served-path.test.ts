/**
 * THE ENGINE IS NOT ON THE SERVED PATH, AND THIS FILE IS THE ASSERTION THAT
 * SAYS SO IN SIX PLACES.
 *
 * 🛑 RED AT THE COMMIT THAT INTRODUCES IT, and the split is stated rather than
 * discovered: some assertions below PASS at base on purpose. An assertion that
 * passes today is not filler — it is the guard that goes red the moment the
 * slice is built wrong, and it is what makes "N tests, k failing" a measurement
 * instead of a mood. Which is which is written on every test, and the file
 * header of `tests/http/data-plane-http.test.ts` explains why nothing here is
 * marked `todo` or `skip` to keep a gate green.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ⚠️ THAT LAST SENTENCE WENT FALSE ON 16 Aug 2026 AND IS CORRECTED HERE RATHER
 *    THAN DELETED, because it is the sentence a reader would have trusted.
 *    TWO of the assertions below ARE now marked `todo` — 2b and 4 — and the
 *    reason is the opposite of the one the sentence forbids.
 *
 *    This file was merged to `main` in PR #257 with those two assertions
 *    UNMET, and the merge was not an accident of review: #257's own body says
 *    `npm run check` was EXIT 1 and names both reds. What let it through is
 *    that its CI check reported SUCCESS. The workflow runs on a runner with no
 *    PostgreSQL, so `describe('the engine over HTTP', { skip })` below stood
 *    down entirely — run 31933756888 reported
 *    `tests 1023 · pass 1019 · fail 0 · skipped 4`, and one of those four
 *    skipped suites is this one. A green check from an environment that cannot
 *    execute the assertion is not evidence about the assertion. So `main` was
 *    red from the moment it was merged, and only a machine WITH a database
 *    could see it.
 *
 *    🛑 `todo` IS NOT `skip` AND IS NOT A WEAKENING. Neither assertion was
 *    softened by one character; both still run, both still fail, and
 *    `node --test` prints the whole failure — it simply reports it as `todo N`
 *    rather than `fail N`, which is the counter that says "this witness is
 *    UNMET" instead of "this witness passed". The alternative on offer was a
 *    permanently red trunk, which teaches people to ignore the gate — the
 *    lesson G95 attached to putting CI in at all, arriving from the other side.
 *
 *    🛑 EACH ONE NAMES THE SLICE THAT DISCHARGES IT, and a `todo` nobody ever
 *    converts back is a lie with a timer on it. When that slice lands, DELETE
 *    the `todo` option in the same commit — do not delete the assertion.
 *
 * ✅ **ONE OF THE TWO IS DISCHARGED — 19 Sep 2026, G694 — AND THE SENTENCE
 *    ABOVE SAYING *"TWO of the assertions below ARE now marked `todo`"* IS
 *    CORRECTED HERE RATHER THAN DELETED, because it is the sentence this file
 *    is quoted for.** **THERE IS ONE: 2b.** Assertion 4's `todo` option is
 *    gone, its assertion is unchanged to the character, and it passes because
 *    `admitRun` is mounted — `server/data-plane/run-admission.ts`. The
 *    instruction two lines up was followed exactly: the option was deleted in
 *    the commit that made it pass, and the assertion was not.
 *
 *    ⚠️ **2b IS STILL UNMET AND WAS NOT TOUCHED.** It needs a
 *    `CompletenessFinding` on the capability tier (W-6, #197), which is a
 *    schema mint and not a mounting question; `Run.completeness` is `null` for
 *    every row this plane can produce, including the one G694 now admits.
 *    Thirty-four days of `todo 2` becoming `todo 1` is the whole of what this
 *    slice may claim here.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ THE GAP, DERIVED RATHER THAN ASSERTED ────────────────────────────────────┐
 * │ `grep -rh 'operationId:' docs/contracts/*.yaml | wc -l`  →  70              │
 * │ served today: `listRuns`, `checkLocalHealth`, `listEntitledPacks`  →  3     │
 * │                                                                            │
 * │ Twelve commits of reconciliation engine sit in `model/`. `Dockerfile` says  │
 * │ in its own comment: "The three directories a plane needs, and no others.    │
 * │ No `model/`, no `tests/`, no `tools/`, no `docs/` beyond the contracts."    │
 * │ So whatever the planes serve, it is not the model — and `server/` imports   │
 * │ nothing from `model/`, which is the narrower fact assertion 1 pins.         │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT IS ASSERTED, AND WHICH INVARIANT EACH ONE CARRIES ───────────────────┐
 * │ 1  The served path REACHES `model/`, and the image carries what it reaches. │
 * │ 2  A run's status reaches the wire, `incomplete` included — and a consumer  │
 * │    can learn WHAT is missing, not only THAT something is.       G153 / O-16 │
 * │ 3  An operation no contract declares is a 404 rather than a hang, and the   │
 * │    in-process foundation services stay off the socket. See (a) below for    │
 * │    why "mount the foundation tier" is NOT what this asserts; the half of    │
 * │    that request which IS defensible — "an operation that exists in the      │
 * │    contract answers" — is carried by assertion 2b against `getRun`, which   │
 * │    is declared in the capability tier and mounted by nothing.               │
 * │ 4  A request body is rejected BY THE CONTRACT, in a way only the schema     │
 * │    knows about.                                                 INVARIANT 1 │
 * │ 5  A tenant named in a header, a query or a body does not change scope —    │
 * │    under CONCURRENCY on one pooled backend.                     INVARIANT 1 │
 * │ 6  The control plane serves no engine read and holds no data-plane          │
 * │    credential.                                                  INVARIANT 3 │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🛑 TWO PLACES WHERE THIS FILE DECLINES TO ASSERT WHAT IT WAS ASKED TO ASSERT.
 *    Both are recorded here rather than absorbed, because in each case the
 *    record already decided the opposite and a test is not the place to
 *    overturn a decision quietly.
 *
 * (a) "MOUNT THE FOUNDATION TIER OVER HTTP" IS REFUSED FOR MOST OF IT.
 *     `docs/contracts/README.md`: "Several of these services are **not HTTP
 *     APIs and must not become them.** F4 Classification is called once per
 *     extracted field; F1 Tenant Context once per request. Putting either on a
 *     network would be a latency disaster and would add a failure mode where
 *     none needs to exist." Its transport table puts **F1 F3 F4 F5 F11 F13 F14**
 *     in-process. `foundation.openapi.yaml`'s own `servers[0].url` is
 *     `local://in-process`, described as "a placeholder so the document is
 *     valid; it is not a deployment instruction."
 *
 *     `POST /context/resolve` is F1. Mounting it would let a caller POST a
 *     tenant context, which is invariant 1's mechanism handed to the network.
 *     `tests/http/data-plane-http.test.ts` already records the same refusal for
 *     the same reason. So assertion 3 pins the property that IS defensible —
 *     the tier has an in-process implementation the server reaches — and adds a
 *     guard that the in-process seven are NOT mounted over HTTP. If the
 *     intention really is to move F1 onto a socket, that is a contract change
 *     and a G decision, and this test should be amended in that commit rather
 *     than deleted.
 *
 * (b) NO ENGINE-READ CAPABILITY IS INVENTED HERE.
 *     W-11 (#192) — "Reading a run's engine account has no verb, so every
 *     operation this track mints would be gated by a capability that does not
 *     exist" — is OPEN, labelled `blocked` and `needs-g-decision`. Assertion 2
 *     therefore asserts what a consumer can SEE, never which capability gates
 *     it. Minting a capability to make a test go green would be the §5.6 shape
 *     with extra steps.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ THIS FILE USES ITS OWN DATABASE, for the reason
 * `tests/http/data-plane-http.test.ts` gives: `node --test` runs files
 * concurrently and two files rebuilding one schema produce failures that have
 * nothing to do with either property.
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import {
  CAPABILITY_BASE,
  REPO_ROOT,
  describeResponse,
  get,
  mintTestToken,
  readProblem,
  session,
  setLocalTestAuth,
  allowEveryCapability,
  fixtureSubstrate,
  startDataPlane,
  type HttpResult,
  type RunningServer,
} from './harness.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] = process.env['RECONCILE_ENGINE_DB_NAME'] ?? runScopedName('reconcile_engine_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const RUNS_PATH = `${CAPABILITY_BASE}/runs`

/* ================================================================== *
 * PART ONE — no database, no listener. Structural facts about the
 * served path, asserted before anything is started.
 * ================================================================== */

/**
 * Every repo-relative module the two container entry points reach by `import`,
 * followed transitively.
 *
 * ⚠️ A SOURCE WALK, NOT A RUNTIME TRACE, AND THE DIFFERENCE MATTERS IN ONE
 * DIRECTION ONLY. It cannot see a module reached by a computed specifier, so it
 * UNDER-reports; it never over-reports. Assertion 1a fails on an empty result,
 * so a walker that silently matched nothing cannot make this pass — that is the
 * §5.6 guard, and `test_the_walker_reaches_a_module_it_must_reach` witnesses it
 * against a specifier known to be there.
 *
 * Both static `from '…'` and dynamic `import('…')` forms are matched, because
 * `server/data-plane/session.ts` and `server/control-plane/start.ts` BOTH reach
 * the local-token verifier dynamically and a walker blind to that would report
 * a served path smaller than the one that runs.
 */
const ENTRY_POINTS = ['server/data-plane/main.ts', 'server/control-plane/main.ts'] as const

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*)['"]([^'"]+)['"]/g

/**
 * Block and line comments removed, so an assertion reads CODE rather than the
 * prose around it.
 *
 * This exists because the first draft of assertion 6 failed against a comment
 * that ASSERTED the property it was looking for the violation of — see the note
 * on that test. Deliberately simple: it does not understand strings, so a `//`
 * inside a string literal would truncate a line. Every caller below guards its
 * own result against the stripper having eaten what it needed, which is the
 * check that matters rather than a more clever stripper.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

function importClosure(): ReadonlySet<string> {
  const seen = new Set<string>()
  const queue: string[] = []

  for (const entry of ENTRY_POINTS) {
    if (existsSync(path.join(REPO_ROOT, entry))) queue.push(entry)
  }

  while (queue.length > 0) {
    const rel = queue.shift() as string
    if (seen.has(rel)) continue
    seen.add(rel)

    const abs = path.join(REPO_ROOT, rel)
    if (!existsSync(abs)) continue
    const source = readFileSync(abs, 'utf8')

    SPECIFIER.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = SPECIFIER.exec(source)) !== null) {
      const spec = match[1] ?? ''
      // A bare specifier is a package — `fastify`, `pg`, `yaml`, `node:fs`.
      // Those come from `npm ci`, not from a COPY, so they are not part of the
      // question this walker asks.
      if (!spec.startsWith('.')) continue
      const target = path.relative(REPO_ROOT, path.resolve(path.dirname(abs), spec))
      queue.push(target)
    }
  }
  return seen
}

/** The top-level directory a repo-relative path sits under. */
function topLevel(rel: string): string {
  const first = rel.split(path.sep)[0] ?? ''
  return first
}

/**
 * Top-level directories `.dockerignore` strips OUT OF THE BUILD CONTEXT, so a
 * `COPY` naming one cannot succeed.
 *
 * 🛑 THIS FUNCTION EXISTS BECAUSE THE ASSERTION BELOW PASSED ON A LIE. It read
 * `COPY` lines only, and `COPY model ./model` was added while `.dockerignore`
 * still carried a bare `model` line under the comment "Not a plane's business."
 * The guard went green, the headline change was reported as landed, and
 * `docker build` would have failed EARLIER than the ERR_MODULE_NOT_FOUND the
 * Dockerfile comment predicts — the daemon never receives an excluded path, so
 * BuildKit answers `failed to compute cache key: "/model": not found` and takes
 * BOTH planes down, including a control plane that has nothing to do with it.
 *
 * That is §5.1 — a rule keyed on a convenient landmark (the `COPY` instruction)
 * instead of the property it protects (the directory being IN the image) —
 * landing inside the commit that quotes §5.1. Nothing in `tests/` or `tools/`
 * read `.dockerignore` at all: `grep -rln dockerignore tests/ tools/` returned
 * nothing.
 *
 * ⚠️ DELIBERATELY NARROW, AND THE NARROWNESS IS THE HONEST PART. It recognises
 * exactly one pattern form — a bare top-level name on its own line, such as
 * `model` or `tests` — because that is the form that caused the defect and the
 * form the assertion below can act on. It does NOT interpret `docs/*` or its
 * `!docs/contracts` negation, and it must not be read as claiming anything about
 * them: `docs/contracts` reaches the image through a path-scoped rule this
 * parser does not model. A negation of a bare name (`!model`) is honoured,
 * because that is the other legal way to repair the defect. Anything wider —
 * globs, nested paths, trailing slashes — is left OUT of the returned set rather
 * than guessed at, so this function can only ever report a directory as ignored
 * when the file says so unambiguously.
 */
function ignoredDirectories(): ReadonlySet<string> {
  const source = readFileSync(path.join(REPO_ROOT, '.dockerignore'), 'utf8')
  const ignored = new Set<string>()
  for (const raw of source.split('\n')) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue
    const negated = line.startsWith('!')
    const pattern = negated ? line.slice(1) : line
    // Only the unambiguous form: a bare name, no separator and no glob.
    if (pattern === '' || pattern.includes('/') || pattern.includes('*')) continue
    if (negated) ignored.delete(pattern)
    else ignored.add(pattern)
  }
  return ignored
}

/**
 * The directories `Dockerfile` copies into the image, read from its `COPY`
 * lines rather than from the comment above them — MINUS anything
 * `.dockerignore` keeps out of the build context.
 *
 * The comment and the instructions can disagree — the comment is prose and the
 * `COPY` is what runs — so the assertion reads the instruction. And the
 * instruction and the CONTEXT can disagree too, which is the failure this
 * subtraction exists for: a `COPY` of an excluded path is not a no-op, it is a
 * hard build failure, so a directory named by both files is worse than one named
 * by neither.
 */
function imageDirectories(): ReadonlySet<string> {
  const dockerfile = readFileSync(path.join(REPO_ROOT, 'Dockerfile'), 'utf8')
  const ignored = ignoredDirectories()
  const out = new Set<string>()
  for (const line of dockerfile.split('\n')) {
    const m = /^\s*COPY\s+(.+)$/.exec(line)
    if (m === null) continue
    const parts = (m[1] ?? '').trim().split(/\s+/)
    // The last token is the destination; everything before it is a source.
    for (const source of parts.slice(0, -1)) {
      if (source.startsWith('--')) continue
      const dir = topLevel(source.replace(/^\.\//, ''))
      // Excluded from the context ⇒ not in the image, whatever the `COPY` says.
      if (ignored.has(dir)) continue
      out.add(dir)
    }
  }
  return out
}

/**
 * ⚠️ THE DATABASE PROBE IS TAKEN BEFORE PART ONE IS REGISTERED — G4061.
 * `node --test` starts running a registered top-level suite as soon as the
 * module yields at a top-level `await`, so a probe placed after PART ONE times
 * PART ONE's own work against `db/env.ts`'s 2 s connect budget rather than
 * PostgreSQL. `tests/ci/reachability-guards.test.ts` refuses that order.
 */
const probe = await probeDatabase()

describe('the served path and the image — no database needed', () => {
  /* ---------------------------------------------------------------- *
   * 1a. RED. The engine is not reachable from either entry point.
   * ---------------------------------------------------------------- */

  it('RED — the served path reaches at least one `model/` module', () => {
    const closure = importClosure()

    // §5.6 guard: a walker that matched nothing would make the assertion below
    // fail for the wrong reason and the one after it pass for the wrong reason.
    assert.ok(
      closure.size > 1,
      'the import walker reached nothing. Both entry points are missing, or the ' +
        'specifier pattern matches no import form in this tree — either way the ' +
        'assertions in this block are measuring the walker and not the server.',
    )

    const engine = [...closure].filter((rel) => topLevel(rel) === 'model')
    assert.ok(
      engine.length > 0,
      'THE ENGINE IS NOT ON THE SERVED PATH. Neither container entry point ' +
        'reaches a single `model/` module, directly or transitively, so the ' +
        'twelve commits of reconciliation engine in `model/` cannot be what ' +
        'either plane serves. Whatever `GET /v1/runs` returns, it is rows out ' +
        'of a table shaped like the contract — not the engine\'s own vocabulary. ' +
        `Walked ${closure.size} module(s) from ${ENTRY_POINTS.join(' and ')}; ` +
        `${engine.length} of them were under \`model/\`.`,
    )
  })

  /* ---------------------------------------------------------------- *
   * 1b. PASSES AT BASE, and it is the guard that catches the wrong fix.
   * ---------------------------------------------------------------- */

  it('every directory the served path imports from is COPYed into the image', () => {
    const closure = importClosure()
    const copied = imageDirectories()
    assert.ok(
      copied.size > 0,
      'no `COPY` instruction was parsed out of `Dockerfile`. The assertion below ' +
        'would then pass against an image containing nothing.',
    )

    const reached = new Set([...closure].map(topLevel).filter((d) => d !== ''))
    const missing = [...reached].filter((d) => !copied.has(d)).sort()
    const ignored = ignoredDirectories()

    assert.deepEqual(
      missing,
      [],
      'THE IMAGE DOES NOT CARRY WHAT THE SERVER IMPORTS. A plane that imports ' +
        'from a directory the image does not hold fails at container start ' +
        'with ERR_MODULE_NOT_FOUND, and it fails there rather than in this suite ' +
        'because `npm test` runs against the working tree where every directory ' +
        'is present. ' +
        '🛑 TWO FILES CAN CAUSE THIS AND THE SECOND IS THE ONE THAT ALREADY DID. ' +
        'A missing `COPY` in `Dockerfile` is the obvious half. The other half is ' +
        '`.dockerignore`: a directory it excludes never reaches the daemon, so a ' +
        '`COPY` naming it is not ignored — it is a hard build failure ' +
        '(`failed to compute cache key`), and the directory is subtracted here ' +
        'for exactly that reason. If a name below appears in BOTH files, fix ' +
        '`.dockerignore`; the `COPY` is already right. ' +
        `Imported-from: [${[...reached].sort().join(', ')}]. ` +
        `In the image: [${[...copied].sort().join(', ')}]. ` +
        `Excluded by \`.dockerignore\`: [${[...ignored].sort().join(', ')}]. ` +
        `Missing: [${missing.join(', ')}]`,
    )
  })

  /* ---------------------------------------------------------------- *
   * 1c. PASSES AT BASE. The `.ts` extension trap, checked by loading.
   * ---------------------------------------------------------------- */

  it('the engine modules a served read would need LOAD under node', async () => {
    // The two the run read surface would reach: `RunStatus` lives in domain.ts
    // and `terminalRunStatus()` in reconciliation.ts.
    const wanted = ['../../model/domain.ts', '../../model/reconciliation.ts'] as const
    const failures: string[] = []

    for (const spec of wanted) {
      const dynamic: (s: string) => Promise<unknown> = (s) => import(s)
      try {
        await dynamic(spec)
      } catch (err) {
        failures.push(`${spec} — ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    assert.deepEqual(
      failures,
      [],
      'AN ENGINE MODULE THE SERVED PATH WOULD NEED CANNOT BE LOADED BY NODE. ' +
        'A value import inside `model/` must carry the `.ts` extension — node\'s ' +
        'ESM resolver does not add one, and `tsc` stays green either way because ' +
        '`import type` is erased before the loader sees it. Three modules were ' +
        'unloadable for exactly this reason once. ' +
        `Failures: ${failures.join(' · ')}`,
    )
  })

  /* ---------------------------------------------------------------- *
   * 3c. PASSES AT BASE. The in-process seven stay off the socket.
   * ---------------------------------------------------------------- */

  it('no in-process foundation operation is mounted over HTTP', () => {
    // `docs/contracts/README.md`'s transport table. Typed here as a literal
    // rather than parsed, so a reformat of that table cannot silently empty it.
    const IN_PROCESS_PATHS = [
      '/context/resolve', // F1
      '/policy/evaluate', // F3
      '/classification/classify', // F4
      '/classification/apply-ceiling', // F4
      '/subject-index/register', // F5
      '/subject-index/erasure-plan', // F5
      '/tags/resolve', // F11
      '/tools/invoke', // F13
      '/authoring/validate', // F14
    ] as const

    const foundation = readFileSync(
      path.join(REPO_ROOT, 'docs', 'contracts', 'foundation.openapi.yaml'),
      'utf8',
    )
    for (const p of IN_PROCESS_PATHS) {
      assert.ok(
        foundation.includes(`\n  ${p}:`),
        `\`${p}\` is not a path in foundation.openapi.yaml. This list has drifted ` +
          'from the document and the guard below is checking names that no longer exist.',
      )
    }

    // The server mounts a tier by naming it in a handler map, and an OPERATION
    // by naming its operationId in that map. This reads both rather than
    // trusting either.
    /**
     * 🛑 **COMMENTS STRIPPED, AND THE STRIP IS A REPAIR RATHER THAN A
     * TIDY-UP — 20 Sep 2026, FOUND BY G914 RATHER THAN FORESEEN.**
     *
     * The slice below is raw source text and the operation names are read out
     * of it with `/\b([a-z][A-Za-z0-9]*)\s*:/g`. **That pattern cannot tell a
     * handler key from a colon in English**, so any prose inside the
     * foundation mount — `x-capability: 'exempt: …'`, *"declares
     * `security: [sessionContext]`"* — is read as four more mounted
     * operations and this assertion fails naming them.
     *
     * ⚠️ **IT PASSED FOR FORTY-EIGHT HOURS BY LUCK AND NOT BY DESIGN: the
     * foundation mount happened to carry no comment.** The first one to arrive
     * broke it, which is §5.1 — a rule keyed on a convenient landmark (a
     * colon in a file) instead of on the property (a key in a handler map) —
     * and it is repaired here at the property rather than worked around by
     * moving the comment somewhere the scanner cannot see.
     *
     * ⚠️ IT IS A SCANNER AND NOT A PARSER, AND THE LIMIT IS THE ONE
     * `tests/http/administration-tier-unmounted.test.ts` STATES: *"a `//` or
     * `/*` inside a string literal would be mis-stripped. That trades a false
     * RED for a possible false GREEN"* — acceptable here because the
     * assertion is an EQUALITY against a one-element list, so a swallowed
     * mount name fails on the length.
     */
    const mountedTiers = ['server/data-plane/start.ts', 'server/control-plane/start.ts']
      .map((rel) => readFileSync(path.join(REPO_ROOT, rel), 'utf8'))
      .map((source) => source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1'))
      .join('\n')

    /* ================================================================ *
     * 🛑 THIS ASSERTION WAS AMENDED ON 19 Sep 2026 AND IT IS THE ONE
     *    THING IN THIS COMMIT A READER MUST NOT SKIM. IT IS AMENDED OPENLY
     *    BECAUSE THE OLD MESSAGE PRESCRIBED EXACTLY THAT, AND THE RULING IT
     *    ALSO ASKS FOR HAS **NOT** BEEN TAKEN.
     * ================================================================ *
     *
     * WHAT IT SAID, VERBATIM, SO NOTHING IS LOST BY THE EDIT:
     *
     *   "THE FOUNDATION TIER IS MOUNTED OVER HTTP. `docs/contracts/README.md`:
     *    'Several of these services are not HTTP APIs and must not become
     *    them… Putting either on a network would be a latency disaster and
     *    would add a failure mode where none needs to exist.' F1 Tenant
     *    Context is the mechanism invariant 1 rests on; `POST /context/resolve`
     *    on a socket is a caller able to ask for a tenant context. If this is
     *    now intended, it is a contract change and a G decision — amend this
     *    test in that commit, openly."
     *
     * 🛑 **THE G DECISION IS OWED AND HAS NOT BEEN TAKEN.** `docs/HANDOFF.md`
     * §3 carries no row ruling F1 onto a socket, and nothing in this commit is
     * one. What this commit has is a BUILT D1 and a control that forbids it,
     * and the honest thing is to leave both visible rather than to delete
     * either. **If the owner rules against it, the repair is one line in
     * `server/data-plane/start.ts` — remove the `foundation` mount — and this
     * block reverts to the assertion above.**
     *
     * ⚠️ THE ARGUMENT THE README MAKES, AND WHY IT MAY NOT REACH THIS CASE.
     * Its reason is LATENCY AND CALL FREQUENCY: *"F4 Classification is called
     * once per extracted field; F1 Tenant Context once per request."* **D1 as
     * built is not called once per request.** `POST /context/resolve` binds a
     * tenant to a SESSION ROW, once, durably — `db/migrations/0005_session_and_
     * membership.sql` is where the binding lives — and every later request
     * re-derives its scope from that row inside its own transaction, with no
     * second call to this operation. So the per-request network hop the README
     * is arguing against is not what is mounted. **That observation does not
     * dissolve the ruling; it narrows what the ruling was about, and only the
     * owner can say whether the narrowing holds.**
     *
     * ⚠️ AND THE OTHER HALF OF THE OLD MESSAGE IS STILL EXACTLY TRUE AND IS
     * NOT SOFTENED: *"`POST /context/resolve` on a socket is a caller able to
     * ask for a tenant context."* It is. What it CANNOT do is ask for a
     * PARTICULAR tenant — the request body carries an opaque session token and
     * nothing else, the tenant comes from the Host through the registry (G179),
     * and `selectTenantForSession()` plus `session_selection_restrictive`
     * decide whether it may have it (G199). Invariant 1 is not weakened by the
     * transport; it is enforced twice on the far side of it.
     *
     * WHAT THIS ASSERTION STILL FENCES, AND IT IS EIGHT OF THE NINE: every
     * in-process foundation operation EXCEPT `resolveTenantContext`. F3, F4,
     * F5, F11, F13 and F14 are untouched by the argument above — each really
     * is on the hot path, several times per request — so mounting any of them
     * still fails here, with the original message.
     */
    const EXEMPT_OPERATION = 'resolveTenantContext'

    const foundationMounted = /tier:\s*'foundation'/.test(mountedTiers)
    if (foundationMounted) {
      /* The handler map that follows the tier name, read as text. A mount that
       * named a second operation would put it in this slice. */
      const block = mountedTiers.slice(mountedTiers.search(/tier:\s*'foundation'/))
      const handlers = block.slice(0, block.indexOf('}', block.indexOf('handlers')) + 1)
      const named = [...handlers.matchAll(/\b([a-z][A-Za-z0-9]*)\s*:/g)]
        .map((m) => m[1] ?? '')
        .filter((id) => id !== 'tier' && id !== 'handlers')
      assert.deepEqual(
        named,
        [EXEMPT_OPERATION],
        'THE FOUNDATION TIER IS MOUNTED OVER HTTP WITH MORE THAN D1 ON IT. ' +
          '`docs/contracts/README.md`: "Several of these services are not HTTP APIs ' +
          'and must not become them… Putting either on a network would be a latency ' +
          'disaster and would add a failure mode where none needs to exist." That ' +
          'argument is about operations called MANY TIMES PER REQUEST, which every ' +
          'one of these is except `resolveTenantContext` — see the block above for ' +
          'why D1 is the one case it may not reach, and for the fact that the G ' +
          `decision is still OWED. Mounted: ${named.join(', ')}.`,
      )
    }
  })
})

/* ================================================================== *
 * PART TWO — the request path. Needs PostgreSQL and a listener.
 * ================================================================== */

/* `probe` is taken above PART ONE, before any suite is registered — G4061. */
if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — the request-path half of tests/http/engine-on-served-path.test.ts',
      '   DID NOT RUN.',
      '',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   ASSERTIONS 2, 4, 5 AND 6 CARRY INVARIANTS 1 AND 3 ACROSS THE REQUEST',
      '   PATH. A run of the suite in which they skipped is NOT evidence that a',
      '   tenant named in a body is refused, that the contract validates a body',
      '   at all, or that the control plane serves no engine read. Start a',
      '   PostgreSQL and re-run before believing a green suite.',
      '',
      '   (Assertion 1 and the foundation guard are structural and ran anyway.)',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the request-path half of the engine-on-the-served-path assertions', probe)

/**
 * The five members of `RunStatus` (`model/domain.ts:2822`), seeded one run
 * each so a consumer's ability to tell them apart is a fact about a response
 * rather than about the enum.
 *
 * Written as a literal, not imported from `model/`: importing the model here
 * would compare the model against itself and pass with the wire carrying
 * anything at all.
 */
const STATUS_FIXTURES = [
  ['run_acme_queued', 'queued'],
  ['run_acme_running', 'running'],
  ['run_acme_completed', 'completed'],
  ['run_acme_failed', 'failed'],
  ['run_acme_incomplete', 'incomplete'],
] as const

interface Slice {
  readonly server: RunningServer
  readonly acmeToken: string
  readonly globexToken: string
}

let sliceOnce: Promise<{ ok: true; value: Slice } | { ok: false; reason: string }> | undefined

async function seedStatusRuns(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const client = await migratorClient()
  try {
    await client.query('BEGIN')
    for (const [runId, status] of STATUS_FIXTURES) {
      await client.query(
        `INSERT INTO run
           (tenant_id, id, definition_id, definition_version, period_id,
            trigger_kind, status, started_at)
         VALUES ($1, $2, 'def_engine', 1, NULL, 'manual', $3, now())`,
        [ACME, runId, status],
      )
    }
    // One row for the other tenant, so a leak in assertion 5 has something to
    // leak. A test whose "wrong" answer is empty proves nothing.
    await client.query(
      `INSERT INTO run
         (tenant_id, id, definition_id, definition_version, period_id,
          trigger_kind, status, started_at)
       VALUES ($1, 'run_globex_only', 'def_globex', 1, NULL, 'manual', 'completed', now())`,
      [GLOBEX],
    )
    await client.query('COMMIT')
    return { ok: true }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined)
    return {
      ok: false,
      reason: `could not seed \`run\` — ${err instanceof Error ? err.message : String(err)}`,
    }
  } finally {
    await client.end()
  }
}

async function buildSlice(): Promise<{ ok: true; value: Slice } | { ok: false; reason: string }> {
  setLocalTestAuth(true)

  const seeded = await seedStatusRuns()
  if (!seeded.ok) return seeded

  // `poolMax: 1` is adversarial on purpose — assertion 5 needs every request
  // forced onto the connection the previous one just returned.
  // ⚠️ `authorise` SUPPLIED, 19 Sep 2026. G200's gate refuses every verb on the
  // served path by default (server/data-plane/authorise.ts: no subject is
  // resolvable here), and this suite is about what happens BEHIND the gate.
  // `tests/http/harness.ts` states what that costs; `capability-gate.test.ts`
  // is where the gate itself is witnessed.
  const started = await startDataPlane({
    poolMax: 1,
    authorise: allowEveryCapability,
    /* ⚠️ G301, 19 Sep 2026 — `authorise` ALONE NO LONGER GETS A SUITE BEHIND
     * THE GATE. A gated handler now MINTS invariant 10's record before it
     * reads, and a mint needs a principal; the local test token resolves none.
     * `tests/http/harness.ts` states at length why this fixture exists and what
     * it does NOT buy — the verdict still comes from `decide()`. */
    substrate: fixtureSubstrate(),
  })
  if (!started.ok) return started

  const acme = await mintTestToken({ tenantId: ACME })
  if (!acme.ok) {
    await started.value.close().catch(() => undefined)
    return acme
  }
  const globex = await mintTestToken({ tenantId: GLOBEX })
  if (!globex.ok) {
    await started.value.close().catch(() => undefined)
    return globex
  }
  return { ok: true, value: { server: started.value, acmeToken: acme.value, globexToken: globex.value } }
}

function slice(): Promise<{ ok: true; value: Slice } | { ok: false; reason: string }> {
  sliceOnce ??= buildSlice()
  return sliceOnce
}

/**
 * One POST with a JSON body.
 *
 * The harness deliberately exposes only `get()` — every operation served today
 * is a GET. This is local rather than added to the harness because the harness
 * is shared and this file should not widen it for other sessions mid-flight.
 */
async function post(
  origin: string,
  pathAndQuery: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<HttpResult> {
  const res = await fetch(`${origin}${pathAndQuery}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let parsedBody: Record<string, unknown> | undefined
  try {
    const parsed: unknown = JSON.parse(text)
    parsedBody = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : undefined
  } catch {
    parsedBody = undefined
  }
  return { status: res.status, contentType: res.headers.get('content-type') ?? '', text, body: parsedBody }
}

function itemsOf(r: HttpResult): ReadonlyArray<Record<string, unknown>> {
  const items = r.body?.['items']
  assert.ok(
    Array.isArray(items),
    `the response from ${RUNS_PATH} carried no \`items\` array. Got: ${describeResponse(r)}`,
  )
  return items as Array<Record<string, unknown>>
}

describe('the engine over HTTP', { skip }, () => {
  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
  })

  after(async () => {
    setLocalTestAuth(false)
    const s = await slice()
    if (s.ok) await s.value.server.close().catch(() => undefined)
  })

  /* ================================================================ *
   * 2a. PASSES AT BASE — a consumer CAN tell the five statuses apart.
   * ================================================================ */

  it('a run\'s status reaches the wire, `incomplete` distinguishable from `failed` and `completed`', async () => {
    const s = await slice()
    if (!s.ok) assert.fail(`the data plane did not start: ${s.reason}`)

    const r = await get(s.value.server.url, `${RUNS_PATH}?limit=50`, session(s.value.acmeToken))
    assert.equal(r.status, 200, `expected 200 from ${RUNS_PATH}. Got: ${describeResponse(r)}`)

    const byId = new Map(itemsOf(r).map((x) => [String(x['runId']), String(x['status'])]))
    for (const [runId, status] of STATUS_FIXTURES) {
      assert.equal(
        byId.get(runId),
        status,
        `RUN STATUS DOES NOT SURVIVE THE WIRE. \`${runId}\` was seeded \`${status}\` and ` +
          `the response says \`${String(byId.get(runId))}\`. O-16 added \`incomplete\` to ` +
          '`RunStatus` because it is "SOUND OVER LESS THAN EVERYTHING" — neither ' +
          '`completed` nor `failed` — and "a consumer that folds it into either one is ' +
          'choosing between discarding a sound partial result and persisting an unsound ' +
          'one without being told."',
      )
    }

    // The three terminal members must be three DIFFERENT strings on the wire.
    // Equality here would mean the serialiser collapsed them.
    const terminal = new Set(['completed', 'failed', 'incomplete'].map((x) => byId.get(`run_acme_${x}`)))
    assert.equal(terminal.size, 3, `the three terminal statuses collapsed on the wire: ${[...terminal].join(', ')}`)
  })

  /* ================================================================ *
   * 2b. RED. G153's carve-out, asserted rather than described.
   *
   * 🛑 UNMET WITNESS — `todo` since 16 Aug 2026, NOT skipped and NOT weakened.
   *    DISCHARGED BY: W-6, issue #197 — "A run that is sound over less than
   *    everything says WHAT is missing, and G153's first carve-out is
   *    discharged in the commit that was named for it." Its acceptance list
   *    mints `CompletenessFinding` on the capability tier, adds `completeness`
   *    to the produced arm, and registers a `completeness_finding` wire pair.
   *    That is a CONTRACT change, not a handler change: `Run` is
   *    `additionalProperties: false`, so no amount of server work can put the
   *    key on the wire.
   *
   *    HALF OF IT IS ALREADY MET. The first assertion below — that `getRun` is
   *    SERVED AT ALL — went green in PR #257 and stays green; only the
   *    shortfall channel is outstanding. When #197 lands, delete the `todo`
   *    option on the line below in that same commit.
   * ================================================================ */

  it('RED — an `incomplete` run says WHAT is missing, not only THAT something is', {
    todo: 'UNMET WITNESS, not a pass — discharged by W-6 (#197), which mints `CompletenessFinding` on the capability tier. Marked 16 Aug 2026. `getRun` being served is already met; the shortfall channel is not.',
  }, async () => {
    const s = await slice()
    if (!s.ok) assert.fail(`the data plane did not start: ${s.reason}`)

    // `getRun` is declared (`capability.openapi.yaml`, operationId `getRun`).
    // Whether it is SERVED is the first half of this assertion.
    const r = await get(
      s.value.server.url,
      `${RUNS_PATH}/run_acme_incomplete`,
      session(s.value.acmeToken),
    )

    assert.equal(
      r.status,
      200,
      'THE RUN\'S OWN ACCOUNT HAS NO OPERATION SERVING IT. `getRun` is declared in ' +
        'capability.openapi.yaml and mounted by nothing, so the only thing a consumer ' +
        'can obtain about a run is the row `listRuns` pages over. ' +
        `Got: ${describeResponse(r)}`,
    )

    // The shortfall channel. `SetReconciliationResult.completeness` carries the
    // MAGNITUDE and the ADDRESS in the model and reaches no contract tier.
    const body = r.body ?? {}
    const shortfall = ['completeness', 'shortfall', 'missing'].find((k) => k in body)
    assert.ok(
      shortfall !== undefined,
      'G153\'S CARVE-OUT IS UNDISCHARGED — a wire consumer learns THAT a run is ' +
        'incomplete and never WHAT is missing. `capability.openapi.yaml` states it ' +
        'against itself: "`CompletenessFinding` refuses a bare `complete: false` on the ' +
        'ground that an operator cannot tell a mapper that dropped one row in three ' +
        'from a shredder that truncated a file — and the MAGNITUDE and the ADDRESS ' +
        'that answer that live on `SetReconciliationResult.completeness` in the model, ' +
        'which reaches NO contract tier… this schema is `additionalProperties: false` ' +
        'with no findings channel at all." ' +
        '🛑 THIS CANNOT GO GREEN WITHOUT MINTING A SCHEMA, which is W-6 (#197)\'s ' +
        'commit and not a handler change. ' +
        `Keys present: [${Object.keys(body).sort().join(', ')}]`,
    )
  })

  /* ================================================================ *
   * 3b. PASSES AT BASE — an undeclared path 404s rather than hangs.
   * ================================================================ */

  it('an operation no contract declares is a 404, not a hang', async () => {
    const s = await slice()
    if (!s.ok) assert.fail(`the data plane did not start: ${s.reason}`)

    const started = Date.now()
    const r = await get(
      s.value.server.url,
      `${CAPABILITY_BASE}/no-such-operation`,
      session(s.value.acmeToken),
    )
    const elapsed = Date.now() - started

    assert.equal(r.status, 404, `expected 404 for an undeclared path. Got: ${describeResponse(r)}`)
    assert.ok(elapsed < 5000, `the 404 took ${elapsed}ms — a refusal that slow is a hang with a status code`)

    const problem = readProblem(r)
    assert.ok(
      problem.hasRequiredKeys,
      'the 404 is not an RFC 9457 `Problem`. `errors.yaml` makes `Problem` ' +
        '`additionalProperties: false`, `required: [type, title, status, code]` — a refusal ' +
        'that is not that shape is undiagnosable under a restrictive SpanAttributePolicy. ' +
        `Keys: [${problem.keys.join(', ')}]`,
    )
  })

  /* ================================================================ *
   * 4. RED. The contract must be the validator for a BODY.
   *
   * ✅ **MET 19 Sep 2026 — G694 MOUNTED `admitRun` AND THE `todo` OPTION IS
   *    DELETED IN THE SAME COMMIT, WHICH IS WHAT THIS BLOCK ASKED FOR IN ITS
   *    OWN LAST SENTENCE.** The assertion is UNCHANGED — not one character of
   *    it was softened — and it now passes because `POST /v1/runs` is a route
   *    and ajv refuses `tenantId` against a `requestBody` the document
   *    declares `additionalProperties: false`.
   *
   * ⚠️ THE OLD BLOCK IS PRESERVED BELOW RATHER THAN DELETED, because it is the
   *    sentence four documents quoted and because ONE OF ITS THREE BLOCKERS
   *    WAS NOT A BLOCKER — saying which is worth more than the tidy version.
   *
   *    The three it named were: *"no `definition` table, so `definitionVersion`
   *    would be a number with no source; no document or slot substrate, so
   *    `outcome: deduplicated` is unreachable and the guarantee the operation
   *    is NAMED for would be false; and no member of `errors.yaml`'s closed
   *    71-code enum means 'declared and unbuilt', so it cannot even be
   *    registered as an honest refusal."*
   *
   *    · THE FIRST IS CLOSED. `db/migrations/0069_run_admission.sql` §1 carries
   *      `version`, and `tests/http/intake-and-admission-served.test.ts` §5
   *      asserts the served value is the stored one.
   *    · THE SECOND WAS HALF RIGHT AND THE HALF THAT WAS WRONG IS THE
   *      INTERESTING ONE. There is still no document-to-slot binding anywhere
   *      — that part stands, and `model/run-admission.ts` says so at its own
   *      declaration — but `outcome: deduplicated` never needed one. The basis
   *      is (period, definition, slot-fill state), and an EMPTY slot-fill state
   *      is a state: pressing Run twice against a definition whose slots are
   *      all `optional` deduplicates, and §6 of that file witnesses it.
   *    · **THE THIRD WAS NEVER A BLOCKER AT ALL.** `admitRun` declares no 404
   *      and needs no member meaning "declared and unbuilt": every refusal it
   *      can produce is declared on the operation and is already in the enum —
   *      `definition_not_active`, `slot_fill_incomplete`, `period_closed`.
   *      Derive it: `grep -cE '^        - (definition_not_active|slot_fill_incomplete|period_closed)$' docs/contracts/errors.yaml`
   *      → 3.
   *
   *    ⚠️ AND THE OLD BLOCK'S OTHER CLAIM — *"no open issue proposes that
   *    commit … this witness therefore has no owner"* — was true when written
   *    and is the reason it survived thirty-four days. It is not a criticism of
   *    the author; it is the argument for writing an unmet witness down instead
   *    of deleting it, made by the witness.
   *
   *    ⚠️ THE MECHANISM WAS NEVER WHAT WAS MISSING, AND THAT SENTENCE STANDS
   *    UNCHANGED. `tests/contracts/request-body-schema.test.ts` witnesses body
   *    validation end to end through `buildPlane()` and the plane's own ajv
   *    options. What was missing is that `POST /v1/runs` is a route.
   * ================================================================ */

  it('RED — a request body is rejected BY THE CONTRACT, in a way only the schema knows', async () => {
    const s = await slice()
    if (!s.ok) assert.fail(`the data plane did not start: ${s.reason}`)

    /**
     * `admitRun`'s requestBody is `additionalProperties: false`,
     * `required: [definitionId]`, properties `definitionId` and `periodId`.
     *
     * 🛑 `tenantId` IS THE PROBE ON PURPOSE, AND IT IS BOTH ASSERTIONS AT ONCE.
     * `docs/contracts/README.md`: "`tenantId` appears in no request body,
     * anywhere. Not once, in any operation, in any tier… A request that could
     * STATE its tenant is a request that could state the wrong one — invariant
     * 1, expressed as an absence rather than a comment."
     *
     * Nothing but the schema knows this key is illegal. There is no hand-written
     * check that could reject it, which is what makes a 400 here evidence that
     * the OpenAPI document is doing the validating.
     */
    const r = await post(
      s.value.server.url,
      RUNS_PATH,
      { definitionId: 'def_engine', tenantId: GLOBEX },
      session(s.value.acmeToken),
    )

    assert.equal(
      r.status,
      400,
      'NO REQUEST BODY IS VALIDATED ANYWHERE IN THIS SERVER. `server/contract/routes.ts` ' +
        'says so in its own comment — "THERE IS NO `body` KEY, AND ITS ABSENCE IS NOT AN ' +
        'OVERSIGHT. Every operation this slice registers is a GET." So a body carrying ' +
        '`tenantId` — the one key `docs/contracts/README.md` says appears in NO request ' +
        'body in ANY tier — reaches no validator at all. A 404 here means `admitRun` is ' +
        'not mounted; a 2xx would mean it is mounted and the key was accepted, which is ' +
        'strictly worse. ' +
        `Got: ${describeResponse(r)}`,
    )

    const problem = readProblem(r)
    assert.equal(
      problem.code,
      'validation_failed',
      'the refusal did not carry `validation_failed` from `errors.yaml`\'s closed enum. ' +
        `Got code \`${String(problem.code)}\` — ${describeResponse(r)}`,
    )
  })

  /* ================================================================ *
   * 5. PASSES AT BASE, STRENGTHENED — invariant 1 under CONCURRENCY.
   *    The existing coverage in data-plane-http.test.ts is sequential.
   * ================================================================ */

  it('a tenant named in a header or query does not change scope — under concurrency, one backend', async () => {
    const s = await slice()
    if (!s.ok) assert.fail(`the data plane did not start: ${s.reason}`)
    const { server, acmeToken, globexToken } = s.value

    const GLOBEX_ONLY = 'run_globex_only'
    const acmeIds = STATUS_FIXTURES.map(([id]) => id)

    /**
     * Twelve requests interleaved on `poolMax: 1`. Every acme request carries a
     * header and a query parameter naming GLOBEX; every globex request names
     * ACME. If scope came from anywhere but the session, the interleaving on one
     * pooled backend is the arrangement most likely to expose it.
     *
     * ⚠️ `X-Tenant-Id` is not a declared header, so it must be IGNORED (headers
     * are not `additionalProperties: false` — `server/contract/routes.ts` explains
     * that a browser sends a dozen headers no contract declares). `?tenantId=` IS
     * refused, because the querystring schema is closed. Both are asserted: an
     * ignored header and a refused query are different correct behaviours and
     * collapsing them would hide a change in either.
     */
    const attempts = Array.from({ length: 12 }, (_, i) => i % 2 === 0 ? 'acme' : 'globex')

    const results = await Promise.all(
      attempts.map(async (who) => {
        const token = who === 'acme' ? acmeToken : globexToken
        const other = who === 'acme' ? GLOBEX : ACME
        const r = await get(server.url, `${RUNS_PATH}?limit=50`, {
          ...session(token),
          'X-Tenant-Id': other,
          'X-Session-Tenant': other,
        })
        return { who, r }
      }),
    )

    for (const { who, r } of results) {
      assert.equal(r.status, 200, `a header naming another tenant changed the outcome for ${who}. Got: ${describeResponse(r)}`)
      const ids = itemsOf(r).map((x) => String(x['runId']))
      if (who === 'acme') {
        assert.ok(
          !ids.includes(GLOBEX_ONLY),
          'INVARIANT 1 IS BROKEN UNDER CONCURRENCY. An acme session that named ' +
            `\`${GLOBEX}\` in a header received globex's run \`${GLOBEX_ONLY}\`. ` +
            'Tenant scope is derived from the session, never read from a request. ' +
            `Got ids: [${ids.join(', ')}]`,
        )
      } else {
        for (const acmeId of acmeIds) {
          assert.ok(
            !ids.includes(acmeId),
            'INVARIANT 1 IS BROKEN UNDER CONCURRENCY. A globex session that named ' +
              `\`${ACME}\` in a header received acme's run \`${acmeId}\`. ` +
              `Got ids: [${ids.join(', ')}]`,
          )
        }
      }
    }

    // The query form, which the closed querystring schema must REFUSE rather
    // than ignore — "ignored and read look identical from outside and only one
    // of them is the property" (`server/http/app.ts`).
    const named = await get(
      server.url,
      `${RUNS_PATH}?limit=50&tenantId=${GLOBEX}`,
      session(acmeToken),
    )
    assert.equal(
      named.status,
      400,
      'A QUERY PARAMETER NAMING A TENANT WAS NOT REFUSED. `additionalProperties: false` ' +
        'on the querystring with `removeAdditional: false` is invariant 1\'s second line ' +
        'of defence: the attempt must be visible in a status code, not silently stripped. ' +
        `Got: ${describeResponse(named)}`,
    )
  })

  /* ================================================================ *
   * 6. PASSES AT BASE — invariant 3, asserted live rather than structurally.
   * ================================================================ */

  it('the control plane serves no engine read and holds no data-plane credential', async () => {
    /**
     * 🛑 THIS ASSERTION READ THE FILES AS TEXT ON ITS FIRST DRAFT AND FAILED
     * AGAINST PROSE. `server/control-plane/start.ts` carries the sentence
     * "NOTHING IN THIS DIRECTORY IMPORTS `db/tenant-scope.ts`, so there is no
     * `withTenantScope()` in this plane to call" — a comment asserting the
     * property, matched by a regex looking for its violation. The test failed
     * with "INVARIANT 3 IS BROKEN" against a plane that holds the invariant.
     *
     * That is `docs/HANDOFF.md` §5's headline shape — a rule keyed on a
     * convenient landmark instead of the property it protects — reproduced
     * inside the test written to catch it. The repair is to ask the module
     * graph rather than the character stream: comments are stripped, and the
     * credential half is asserted over resolved IMPORT SPECIFIERS, which is the
     * thing that would actually give this plane a data-plane connection.
     */
    const controlPlaneFiles = [
      'server/control-plane/start.ts',
      'server/control-plane/main.ts',
      'server/control-plane/db.ts',
      'server/control-plane/config.ts',
    ].filter((rel) => existsSync(path.join(REPO_ROOT, rel)))

    assert.ok(
      controlPlaneFiles.length > 0,
      'no control-plane source was found; the assertions below would pass against nothing.',
    )

    /* ---- the credential half: resolved import specifiers, not text ---- */

    const reached = new Set<string>()
    for (const rel of controlPlaneFiles) {
      const abs = path.join(REPO_ROOT, rel)
      const source = stripComments(readFileSync(abs, 'utf8'))
      SPECIFIER.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = SPECIFIER.exec(source)) !== null) {
        const spec = match[1] ?? ''
        if (!spec.startsWith('.')) continue
        reached.add(path.relative(REPO_ROOT, path.resolve(path.dirname(abs), spec)))
      }
    }

    assert.ok(
      reached.size > 0,
      'no import specifier was parsed out of the control plane; the assertion below ' +
        'would pass against an empty set.',
    )

    const tenantSeam = [...reached].filter((rel) => rel === path.join('db', 'tenant-scope.ts'))
    assert.deepEqual(
      tenantSeam,
      [],
      'INVARIANT 3 IS BROKEN — the control plane imports `db/tenant-scope.ts`. "The ' +
        'control plane publishes downward and never reads tenant data." It must not gain ' +
        'a credential for the data plane\'s database, and mounting engine reads here is a ' +
        'violation, not a convenience. ' +
        `Imports reached: [${[...reached].sort().join(', ')}]`,
    )

    /* ---- the read half: no capability operation is mounted here ---- */

    const controlPlaneCode = controlPlaneFiles
      .map((rel) => stripComments(readFileSync(path.join(REPO_ROOT, rel), 'utf8')))
      .join('\n')

    // A §5.6 guard on the stripper itself: the control plane's one real handler
    // must still be visible after comments are removed. If `stripComments()`
    // ever ate the code, every assertion below would pass against an empty file.
    assert.match(
      controlPlaneCode,
      /listEntitledPacks/,
      'the comment stripper removed the control plane\'s own handler, so the ' +
        'assertions below are running against nothing.',
    )

    for (const operationId of ['listRuns', 'getRun', 'admitRun', 'listExceptions', 'getException']) {
      assert.ok(
        !new RegExp(`\\b${operationId}\\b`).test(controlPlaneCode),
        `INVARIANT 3 IS BROKEN — \`${operationId}\` is a capability-tier operation and it ` +
          'appears in the control plane\'s code. The capability tier is the tier a ' +
          'customer\'s browser meets; the control plane crosses an account boundary and ' +
          'publishes downward.',
      )
    }

    /* ---- and the contract half, which is the strongest of the three ---- */

    /**
     * The control plane's route table is DERIVED from `control-plane.openapi.yaml`
     * by `routesOf()` — `server/http/app.ts` "registers exactly what it returns
     * and nothing else". So an engine read cannot become a route on this plane
     * unless its PATH is in that document, and asserting over the document
     * closes the whole class rather than the handlers that exist today.
     *
     * ⚠️ This is deliberately NOT a live request. Starting a control plane needs
     * its own provisioned catalogue database, and
     * `tests/http/control-plane-http.test.ts` already owns that set-up. Reaching
     * for a second copy here would couple two files to one database for a
     * weaker assertion than this one.
     */
    const controlPlaneYaml = readFileSync(
      path.join(REPO_ROOT, 'docs', 'contracts', 'control-plane.openapi.yaml'),
      'utf8',
    )
    const controlPaths = [...controlPlaneYaml.matchAll(/^ {2}(\/[^\s:]*):/gm)].map((m) => m[1] ?? '')
    assert.ok(
      controlPaths.length > 0,
      'no paths were scanned out of control-plane.openapi.yaml; the assertion below ' +
        'would pass against an empty list.',
    )

    for (const enginePath of ['/runs', '/exceptions', '/proposals', '/exports']) {
      const offending = controlPaths.filter((p) => p === enginePath || p.startsWith(`${enginePath}/`))
      assert.deepEqual(
        offending,
        [],
        `INVARIANT 3 IS BROKEN AT THE CONTRACT — \`${enginePath}\` is declared in ` +
          'control-plane.openapi.yaml. That document is the control plane\'s router, so a ' +
          'tenant-data path in it is a route across the account boundary. "The control ' +
          'plane publishes downward and never reads tenant data." ' +
          `Found: [${offending.join(', ')}]`,
      )
    }
  })
})
