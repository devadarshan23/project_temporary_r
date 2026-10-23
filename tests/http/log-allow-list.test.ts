/**
 * §12.1's CONTAINMENT RULE, ASSERTED OVER THE BYTES A REAL PLANE EMITS.
 *
 * Copied from `docs/tech-stack.md` §12.1, never paraphrased:
 *
 *   *"A log line carries identifiers, codes, counts and durations. It never
 *   carries a payload field value, counterparty text, a document body, a header
 *   value or a query string."*
 *
 * ┌─ WHY THIS FILE READS OUTPUT AND NOT CONFIGURATION ─────────────────────────┐
 * │ Every assertion below reads a LINE THE SERVER PRINTED. None reads a        │
 * │ property of the options object, and that is the whole design: the thing    │
 * │ §12.1 governs is what appears in CloudWatch, and a test that asserted      │
 * │ `serializers.req === serializeRequest` would pass over a serializer that   │
 * │ emitted the cookie.                                                        │
 * │                                                                            │
 * │ The plane is built with `buildPlane()` over the REAL contract documents    │
 * │ and driven with `app.inject()` — `tests/http/parameter-free-querystring.   │
 * │ test.ts`'s harness, inherited whole: NO PORT, NO DATABASE, NEVER SKIPS.    │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🛑 RED ONE — THE CONTROL THIS FILE REPLACES PASSES AGAINST THE DEFECT.
 *
 * `tests/infra/observability.test.mjs` §9 was one line —
 * `assert.match(source, /logger:\s*false/)` — a tripwire meant to stop the
 * logger being turned on without this allow-list. **IT PASSED AGAINST THE
 * COMMIT THAT TURNED THE LOGGER ON**, run before that assertion was touched:
 *
 *     ✔ test_the_planes_still_run_with_the_logger_OFF_which_is_owed_not_done (3.008625ms)
 *     ℹ tests 1
 *     ℹ pass 1
 *     ℹ fail 0
 *
 * **It did not have to be DELETED, which is what `docs/build/completion-plan.md`
 * predicted — it was satisfied by PROSE.** At that moment `server/http/app.ts`
 * contained `logger: false` exactly twice and both were comments narrating the
 * history, while the live setting three hundred lines below read `logger,`:
 *
 *     86: * │   G1391–G1396 … `logger: false` stood here  │
 *     589:     * than `request.log`: the instance is built with `logger: false`, so
 *     498:    logger,
 *
 * **That is `docs/HANDOFF.md` §5.1 — a rule keyed on a convenient landmark (a
 * substring) instead of on the property it protects (what reaches a log line) —
 * arriving in the one control written to prevent this exact slice from going
 * wrong.** A grep cannot tell code from a sentence about code, and this
 * repository has now recorded that shape in a checker, in a header and here.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🛑 RED TWO — THE REPLACEMENT, AGAINST A DELIBERATELY BAD IMPLEMENTATION.
 *
 * A control added without a demonstrated red is `docs/HANDOFF.md` §5.6. This
 * whole file was run against `logger: true` with a `req` serializer that drops
 * `url` and KEEPS `headers` — the precise shape `docs/build/completion-plan.md`
 * says would sail through the old tripwire. **THE OLD TRIPWIRE PASSED AND THIS
 * FILE FAILED SEVEN ASSERTIONS**, both runs against the same tree:
 *
 *     ✔ test_the_planes_still_run_with_the_logger_OFF_which_is_owed_not_done (0.786ms)
 *     ℹ pass 1   ℹ fail 0
 *
 *     ✖ 1 · NO line carries the query string
 *       a query-string value reached a log line. §12.1: a log line never carries a
 *       query string. Fastify's default req serializer emits req.url, which carries one.
 *     ✖ 2 · NO line carries a header value — the cookie IS the session handle
 *       the session handle reached a log line. `Cookie` carries
 *       `__Host-reconcile_session`, so logging headers is logging a live credential (G386).
 *     ✖ 3 · NO line carries the host, which resolves to a tenant
 *       the Host header reached a log line. Under G179/G180 a serving host resolves to
 *       a TENANT through a registry, so it is tenant-identifying.
 *     ✖ 4 · a request line carries the operationId, the method and a count of what was refused
 *       the contract's own name for the operation is what REPLACES `url`
 *     ✖ 4c · every string on every line passes the value grammar
 *       `req.headers.cookie` carries a value the grammar refuses:
 *       "__Host-reconcile_session=THE-LIVE-SESSION-HANDLE"
 *     ✖ 6 · a SourceDocument-shaped object logs its id and none of its text
 *       a filename is counterparty text
 *     ✖ 9 · a 500 publishes a code and a location and no sentence
 *       `err.message` must never be emitted
 *     ℹ tests 19   ℹ pass 12   ℹ fail 7
 *
 * ⚠️ **§4c IS THE ONE TO READ, BECAUSE NOBODY POINTED IT AT THE COOKIE.** §2
 * names the handle; §4c found the same leak by walking EVERY string on EVERY
 * line against the value grammar, which is what will catch the field the next
 * serializer emits that nobody thought to name here.
 *
 * ⚠️ AND §5 PASSED IN THE RED ARM, correctly: with no formatter at all the three
 * keys reach their serializers trivially. It is a control on THIS design — a
 * formatter that stops passing them through — and not on the defect above.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { Writable } from 'node:stream'
import { fileURLToPath } from 'node:url'

import type { FastifyInstance, FastifyRequest } from 'fastify'
import ts from 'typescript'

import {
  buildPlane,
  recordsAuthorisation,
  type CapabilityAuthoriser,
} from '../../server/http/app.ts'
import {
  ERROR_ALLOW_LIST,
  REQUEST_ALLOW_LIST,
  RESPONSE_ALLOW_LIST,
  isLoggableValue,
  reduceStack,
  serializeError,
} from '../../server/http/log-allow-list.ts'

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))

/** Shape-compatible with `TenantSession`; nothing below reads a field of it. */
interface Caller {
  readonly tenantId: string
  readonly sessionRef: string | null
  readonly row: null
  readonly principal: null
}

const HEADER = 'x-session'

/**
 * THE FIVE STRINGS THAT MUST NEVER APPEAR, each standing for one clause of
 * §12.1 and each pushed through the plane on a real request.
 */
const QUERY_VALUE = 'SECRETQUERYVALUE'
const FORBIDDEN_TENANT = 'ten_globex_forbidden'
const SESSION_HANDLE = 'THE-LIVE-SESSION-HANDLE'
/** `server/data-plane/session-cookie.ts` is the only module that may NAME it. */
const COOKIE_NAME = '__Host-reconcile_session'
const TENANT_HOST = 'ten-acme.us-west-2.reconcileai.app'

interface Line {
  readonly [key: string]: unknown
}

interface Capture {
  readonly app: FastifyInstance
  readonly lines: readonly Line[]
  readonly raw: string
  /**
   * Re-read the sink AFTER logging something else on `app.log`.
   *
   * ⚠️ `lines` AND `raw` ARE SNAPSHOTS TAKEN WHEN `drive()` RETURNED, and the
   * first draft of §6 logged a document and then asserted over `raw` — which
   * was a string captured before the write and therefore could never contain
   * it. It failed with *"the logged document produced no line"*, which is the
   * assertion being honest about a test-harness fault rather than about the
   * server; a snapshot that silently answered "absent" would have made every
   * absence assertion in this file vacuous.
   */
  readonly read: () => { readonly lines: readonly Line[]; readonly raw: string }
}

/**
 * ⚠️ THE THROWING HANDLER CARRIES A `pg`-SHAPED ERROR AND THAT IS THE POINT:
 * `detail` is how PostgreSQL reports a unique violation and it is a ROW VALUE.
 * A serializer that spread the error would publish a tenant id from a database
 * constraint onto the one path the 5xx alarm watches.
 */
function pgShapedFailure(): Error {
  const error = new Error(
    `relation "tenant.exception" does not exist\nDETAIL: Key (tenant_id)=(${FORBIDDEN_TENANT})`,
  )
  Object.assign(error, {
    code: '42P01',
    severity: 'ERROR',
    detail: `Key (tenant_id)=(${FORBIDDEN_TENANT}) already exists.`,
    table: 'exception',
    schema: 'tenant',
    routine: 'errorMissingRTE',
    where: `PL/pgSQL function do_thing(text) line 3 at SQL statement, value ${QUERY_VALUE}`,
  })
  return error
}

async function drive(): Promise<Capture> {
  const chunks: string[] = []
  const sink = new Writable({
    write(chunk: Buffer | string, _encoding, callback) {
      chunks.push(chunk.toString())
      callback()
    },
  })

  const allows: CapabilityAuthoriser<Caller> = () => 'held'

  const app = await buildPlane<Caller>(
    {
      plane: 'test-log-plane',
      authenticate: (request: FastifyRequest) => {
        const raw = request.headers[HEADER]
        return typeof raw === 'string' && raw !== ''
          ? { tenantId: raw, sessionRef: null, row: null, principal: null }
          : null
      },
      unauthenticatedDetail: 'no session',
      authorise: allows,
      unauthorisedDetail: 'no capability',
      logDestination: sink,
    },
    [
      {
        tier: 'capability',
        handlers: {
          listIntakeChannels: recordsAuthorisation(async () => ({ channels: [] })),
        },
      },
      {
        tier: 'dataPlaneLocal',
        handlers: {
          // Unsecured, caller `none`, so a bare handler boots — the fourth and
          // sixth fences do not apply. It THROWS, which is how §9 reaches the
          // 500 path without a database.
          checkLocalHealth: async () => {
            throw pgShapedFailure()
          },
        },
      },
    ],
  )

  const headers = {
    [HEADER]: 'ten_acme',
    host: TENANT_HOST,
    cookie: `${COOKIE_NAME}=${SESSION_HANDLE}`,
    authorization: 'Bearer A-BEARER-TOKEN-THAT-IS-A-CREDENTIAL',
  }

  // A served 200, with a cookie and a host.
  await app.inject({ method: 'GET', url: '/v1/intake/channels', headers })
  // A refused 400 carrying the query string invariant 1 forbids.
  await app.inject({
    method: 'GET',
    url: `/v1/intake/channels?tenantId=${FORBIDDEN_TENANT}&q=${QUERY_VALUE}`,
    headers,
  })
  // A 500, through the plane's own error handler.
  await app.inject({ method: 'GET', url: '/health', headers })
  // A 404 — an unmatched, attacker-chosen path.
  await app.inject({ method: 'GET', url: `/wp-admin/${QUERY_VALUE}`, headers })

  await new Promise((resolve) => setTimeout(resolve, 20))

  const read = (): { readonly lines: readonly Line[]; readonly raw: string } => {
    const raw = chunks.join('')
    const lines = raw
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line) as Line)
    return { lines, raw }
  }
  const snapshot = read()
  return { app, lines: snapshot.lines, raw: snapshot.raw, read }
}

function tsFilesUnder(directory: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry)
    if (statSync(full).isDirectory()) {
      out.push(...tsFilesUnder(full))
      continue
    }
    if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) out.push(full)
  }
  return out
}

describe('the log allow-list holds §12.1 over emitted bytes', () => {
  let capture: Capture

  before(async () => {
    capture = await drive()
  })

  // ------------------------------------------------- 0. the run is not vacuous

  it('0a · the plane emitted lines at all', () => {
    assert.ok(
      capture.lines.length >= 6,
      `only ${capture.lines.length} line(s) captured. Every assertion below is an ABSENCE, ` +
        'so a run that logged nothing would pass all of them — §5.6. Four requests must ' +
        'produce at least an incoming/completed pair each for the three matched routes.',
    )
  })

  it('0b · the forbidden strings really were sent', () => {
    // Anti-vacuity in the other direction: proving the absence of a string that
    // was never pushed through the server proves nothing at all.
    assert.ok(QUERY_VALUE.length > 0 && SESSION_HANDLE.length > 0)
    assert.equal(capture.raw.includes('test-log-plane'), true, 'the `plane` base binding is absent')
  })

  // ------------------------------------------------------ 1-3. the three leaks

  it('1 · NO line carries the query string', () => {
    assert.equal(
      capture.raw.includes(QUERY_VALUE),
      false,
      'a query-string value reached a log line. §12.1: a log line never carries a query ' +
        `string. Fastify's default req serializer emits req.url, which carries one.\n` +
        offending(capture, QUERY_VALUE),
    )
    assert.equal(
      capture.raw.includes(FORBIDDEN_TENANT),
      false,
      'the `?tenantId=` an operation REFUSED still reached a log line — the refusal is ' +
        'visible in a status code and the value must not be visible anywhere.\n' +
        offending(capture, FORBIDDEN_TENANT),
    )
  })

  it('2 · NO line carries a header value — the cookie IS the session handle', () => {
    assert.equal(
      capture.raw.includes(SESSION_HANDLE),
      false,
      'the session handle reached a log line. `Cookie` carries ' +
        '`__Host-reconcile_session`, so logging headers is logging a live credential ' +
        '(G386).\n' + offending(capture, SESSION_HANDLE),
    )
    assert.equal(
      capture.raw.includes('A-BEARER-TOKEN-THAT-IS-A-CREDENTIAL'),
      false,
      'an Authorization header value reached a log line.\n' +
        offending(capture, 'A-BEARER-TOKEN'),
    )
    assert.equal(capture.raw.includes(COOKIE_NAME), false, 'the cookie NAME reached a log line')
  })

  it('3 · NO line carries the host, which resolves to a tenant', () => {
    assert.equal(
      capture.raw.includes(TENANT_HOST),
      false,
      'the Host header reached a log line. Under G179/G180 a serving host resolves to a ' +
        'TENANT through a registry, so it is tenant-identifying.\n' +
        offending(capture, TENANT_HOST),
    )
  })

  it('3b · NO line carries an unmatched, attacker-chosen path', () => {
    assert.equal(
      capture.raw.includes('wp-admin'),
      false,
      'a 404 published the path it refused. An unmatched path is chosen in full by the ' +
        'caller, so it is counterparty text rather than an identifier. The cost — you ' +
        'cannot see WHICH unknown path was probed — is named in log-allow-list.ts.',
    )
  })

  // ---------------------------------------------- 4. what a line DOES carry

  it('4 · a request line carries the operationId, the method and a count of what was refused', () => {
    const line = capture.lines.find((l) => l['msg'] === 'incoming request')
    assert.ok(line !== undefined, 'no `incoming request` line was emitted')
    const req = line['req'] as Record<string, unknown> | undefined
    assert.ok(req !== undefined, 'the `req` key is absent — its serializer did not run')
    assert.equal(req['method'], 'GET')
    assert.equal(
      req['operationId'],
      'listIntakeChannels',
      "the contract's own name for the operation is what REPLACES `url`",
    )
    assert.equal(req['route'], '/v1/intake/channels', 'the route TEMPLATE, which holds no values')
    assert.equal(req['url'], undefined, '`url` must never be emitted')
    assert.equal(req['headers'], undefined, '`headers` must never be emitted')
    assert.equal(req['host'], undefined, '`host` must never be emitted')
    assert.ok(
      typeof req['dropped'] === 'number' && (req['dropped'] as number) > 0,
      '§12.1 requires a refused field to be dropped AND COUNTED. A `dropped` of 0 or ' +
        'absent over a request that carried headers, a host and an address means the ' +
        'refusal is invisible, and an absent field then looks identical to one that was ' +
        `never sent. Got: ${String(req['dropped'])}`,
    )
  })

  it('4b · a response line carries the status code and a duration, and nothing else', () => {
    const line = capture.lines.find((l) => l['msg'] === 'request completed')
    assert.ok(line !== undefined, 'no `request completed` line was emitted')
    const res = line['res'] as Record<string, unknown> | undefined
    assert.ok(res !== undefined, 'the `res` key is absent — its serializer did not run')
    assert.equal(typeof res['statusCode'], 'number')
    assert.equal(typeof line['responseTime'], 'number', 'a duration is permitted by §12.1')
    for (const key of Object.keys(res)) {
      assert.ok(
        key === 'statusCode' || key === 'dropped',
        `the res serializer emitted \`${key}\`. It emits a status code and a refusal count ` +
          'and nothing else — `Set-Cookie` carries the session handle on the way OUT.',
      )
    }
  })

  it('4c · every string on every line passes the value grammar', () => {
    // The property rather than the enumeration: whatever a line carries, no
    // field of it may be a sentence. This is what catches a field nobody
    // thought to name in §1-§3.
    for (const line of capture.lines) {
      for (const [key, value] of Object.entries(line)) {
        if (key === 'msg') continue // pino's own; governed by §7 instead.
        walk(key, value)
      }
    }
  })

  // ------------------------------- 5. the formatter/serializer ordering, live

  it('5 · the formatter passes `req`, `res` and `err` to their serializers', () => {
    // Measured against pino before log-allow-list.ts was written:
    // `formatters.log` runs FIRST on the RAW object and a formatter that drops
    // a key leaves that key's serializer UNCALLED. So this assertion is not
    // decoration — if the formatter stopped passing these three through, every
    // assertion in §1-§3 would pass over three ABSENT fields.
    const hasReq = capture.lines.some((l) => typeof l['req'] === 'object' && l['req'] !== null)
    const hasRes = capture.lines.some((l) => typeof l['res'] === 'object' && l['res'] !== null)
    const hasErr = capture.lines.some((l) => typeof l['err'] === 'object' && l['err'] !== null)
    assert.equal(hasReq, true, 'no line carries `req` — the formatter dropped it before pino serialized it')
    assert.equal(hasRes, true, 'no line carries `res` — the formatter dropped it')
    assert.equal(hasErr, true, 'no line carries `err` — the formatter dropped it, so §9 asserts nothing')
  })

  // ------------------------------------- 6. §12.1's own named test, over a plane

  it('6 · a SourceDocument-shaped object logs its id and none of its text', async () => {
    /* §12.1 names this test in its own words: *"a test that logs a
     * `SourceDocument`-shaped object and asserts the line holds its id and
     * nothing else."*
     *
     * ⚠️ `invoiceId` IS THE ONE TO READ. A payload's keys are
     * COUNTERPARTY-CHOSEN (`model/kernel.ts`, on `FieldPath`), so a counterparty
     * who names a key id-shaped defeats the NAME rule on its own — and the
     * VALUE rule refuses it, because what they put there is a sentence. It is
     * logged on the PLANE'S OWN LOGGER rather than by calling the formatter,
     * so what is asserted is a line the server printed. */
    const capture2 = await drive()
    capture2.app.log.info(
      {
        id: 'doc_acme_00713',
        tenantId: 'ten_acme',
        filename: 'Invoice 55 — ACME Ltd (final).pdf',
        extracted: { supplier: 'ACME Ltd', note: 'please pay this immediately' },
        lines: [{ description: 'consulting, September' }],
        invoiceId: 'INV 55 — please remit at once',
        pageCount: 3,
      },
      'document received',
    )
    await new Promise((resolve) => setTimeout(resolve, 20))
    const after = capture2.read()
    const emitted = after.raw
    const line = after.lines.find((l) => l['msg'] === 'document received')
    assert.ok(line !== undefined, 'the logged document produced no line')

    assert.equal(line['id'], 'doc_acme_00713', 'the id is an identifier and §12.1 permits one')
    assert.equal(line['tenantId'], 'ten_acme', '§12.1: "`tenantId` is an id and is allowed"')
    assert.equal(
      line['pageCount'],
      3,
      'a count is permitted by §12.1 in so many words. This assertion FAILED on its first ' +
        'run — `pageCount` matched neither the closed name set nor the id shape, so the ' +
        'allow-list was refusing a class the rule it implements explicitly permits. The ' +
        'repair is COUNT_SHAPED, and it carries a numeric conjunct the id arm does not.',
    )

    assert.equal(line['filename'], undefined, 'a filename is counterparty text')
    assert.equal(line['extracted'], undefined, 'a payload is refused by name AND by shape')
    assert.equal(line['lines'], undefined, 'a document body is refused')
    assert.equal(
      line['invoiceId'],
      undefined,
      'an ID-SHAPED key with a SENTENCE in it was admitted. Rule 1 (the name) cannot ' +
        'hold this on its own because a payload\'s keys are counterparty-chosen; rule 2 ' +
        '(the value grammar) is what refuses it, and this assertion is the only place ' +
        'the conjunction is witnessed.',
    )
    assert.ok(
      typeof line['dropped'] === 'number' && (line['dropped'] as number) >= 4,
      `dropped=${String(line['dropped'])}: four refused fields must be COUNTED, not merely absent`,
    )
    for (const forbidden of ['ACME Ltd', 'please pay this immediately', 'consulting, September']) {
      assert.equal(emitted.includes(forbidden), false, `counterparty text reached a line: ${forbidden}`)
    }
  })

  // --------------------------------------------- 7. the `msg` residual, at source

  it('7 · every `log.<level>` call under `server/` passes a plain string literal or no message', () => {
    /* 🛑 `msg` DOES NOT PASS THROUGH `formatters.log` AT ALL — pino handles the
     * message separately, so no allow-list can reach it. Fastify's own error
     * line (which sets `msg` to `error.message`) is suppressed by the custom
     * error handler, measured at §9b; the residual is OUR call sites
     * interpolating a value into a message, and this is the control for it.
     *
     * ══════════════════════════════════════════════════════════════════════════
     * 🛑 THIS CONTROL WAS FIRST WRITTEN AS A REGEX AND IT COMMITTED THE EXACT
     *    DEFECT THIS FILE'S HEADER IS ABOUT. CAPTURED, NOT NARRATED:
     *
     *      ✖ 7 · every `log.<level>` call under `server/` passes a plain string literal
     *        AssertionError: server/http/app.ts: a `.log.` call's MESSAGE is `…`.
     *
     * There is no such call. It matched `request.log.error({ err }, …)` inside
     * a PROSE COMMENT in this repository's own header — a scanner that cannot
     * tell code from a sentence ABOUT code, which is precisely what let the
     * control this file replaces pass against the defect it was guarding. **The
     * regex found the landmark and the AST finds the property**, and the repair
     * is `tests/ci/reachability-guards.test.ts`'s precedent rather than a
     * cleverer pattern: comments are not nodes.
     * ══════════════════════════════════════════════════════════════════════════ */
    const levels = new Set(['info', 'warn', 'error', 'debug', 'trace', 'fatal'])
    let calls = 0

    for (const file of tsFilesUnder(join(REPO_ROOT, 'server'))) {
      const parsed = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.ESNext,
        true,
        ts.ScriptKind.TS,
      )
      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          levels.has(node.expression.name.text) &&
          ts.isPropertyAccessExpression(node.expression.expression) &&
          node.expression.expression.name.text === 'log'
        ) {
          calls += 1
          const args = node.arguments
          const where = `${file}:${
            parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1
          }`
          assert.ok(args.length > 0, `${where}: a \`.log.\` call with no arguments logs nothing`)
          const last = args[args.length - 1] as ts.Expression
          // Object-only (`log.error({ event: 'x' })`) carries no message at all.
          if (args.length === 1 && ts.isObjectLiteralExpression(last)) {
            ts.forEachChild(node, visit)
            return
          }
          assert.ok(
            ts.isStringLiteral(last),
            `${where}: a \`.log.\` call's MESSAGE is \`${last.getText(parsed)}\` ` +
              `(a ${ts.SyntaxKind[last.kind]}). It must be a plain string literal, or absent. ` +
              '`msg` bypasses the allow-list entirely — no serializer and no formatter can ' +
              'reach it — so an interpolated value there reaches CloudWatch ungoverned. Put ' +
              'the value in the object argument under an allow-listed key instead.',
          )
        }
        ts.forEachChild(node, visit)
      }
      ts.forEachChild(parsed, visit)
    }

    assert.ok(
      calls > 0,
      'no `.log.` call site was found under `server/` at all — this control is vacuous (§5.6)',
    )
  })

  it('7b · nothing under `server/` creates a child logger', () => {
    /* 🛑 A CHILD LOGGER'S BINDINGS BYPASS BOTH FORMATTERS — MEASURED
     * AGAINST `pino@10.3.1`, AND THE SECOND PROBE IS THE ONE THAT MATTERS.
     *
     *     log.child({ tenantId: 'ten_acme', filename: 'Invoice 55 — ACME Ltd.pdf' })
     *          .info({ extra: 'x' }, 'from a child')
     *
     *     {"level":30,"tenantId":"ten_acme","filename":"Invoice 55 — ACME Ltd.pdf",
     *      "SEEN_BY_LOG_FORMATTER":["extra"],"msg":"from a child"}
     *
     * `formatters.log` saw `["extra"]` and the counterparty filename printed
     * anyway. **Installing a `formatters.bindings` does not close it either** —
     * a second probe with one installed printed the filename unchanged, because
     * pino does not call that formatter for child loggers.
     *
     * So this one is held at SOURCE, and it is cheap because there is nothing to
     * hold: ZERO call sites today. The one child logger in the process is
     * FASTIFY'S, created per request, whose single binding is `reqId` — ours
     * and value-free, which §4c walks like every other field.
     *
     * ⚠️ **THE POINT IS THE TIMING.** The control the rest of this file
     * replaces failed because it was written to catch a change and could be
     * satisfied without one. This is written before the first call site exists,
     * so the person who adds one meets the measurement rather than discovering
     * it. If a child logger is genuinely wanted, the repair is a
     * `childLoggerFactory` that runs the bindings through `allowOnly()` — and
     * that is a change to this file as well as to `app.ts`. */
    for (const file of tsFilesUnder(join(REPO_ROOT, 'server'))) {
      const parsed = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.ESNext,
        true,
        ts.ScriptKind.TS,
      )
      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === 'child' &&
          ts.isPropertyAccessExpression(node.expression.expression) &&
          node.expression.expression.name.text === 'log'
        ) {
          const line =
            parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1
          assert.fail(
            `${file}:${line} creates a child logger. **Its bindings bypass BOTH ` +
              '`formatters.log` AND `formatters.bindings`** — measured against pino@10.3.1 — ' +
              'so every field in them reaches CloudWatch ungoverned by the allow-list. ' +
              'Read this test and log-allow-list.ts before adding one: the repair is a ' +
              '`childLoggerFactory` running the bindings through `allowOnly()`.',
          )
        }
        ts.forEachChild(node, visit)
      }
      ts.forEachChild(parsed, visit)
    }
  })

  // ------------------------------- 8. the destination has no production caller

  it('8 · neither plane passes a `logDestination`', () => {
    for (const plane of ['data-plane', 'control-plane']) {
      for (const file of tsFilesUnder(join(REPO_ROOT, 'server', plane))) {
        assert.equal(
          readFileSync(file, 'utf8').includes('logDestination'),
          false,
          `${file} names \`logDestination\`. It is a test seam; a production caller passing ` +
            'one would divert every log line away from stdout, which is where the ECS ' +
            '`awslogs` driver reads them.',
        )
      }
    }
  })

  // --------------------------------------------------- 9. the 500 path, served

  it('9 · a 500 publishes a code and a location and no sentence', () => {
    const line = capture.lines.find((l) => typeof l['err'] === 'object' && l['err'] !== null)
    assert.ok(line !== undefined, 'the throwing handler produced no `err` line')
    const err = line['err'] as Record<string, unknown>

    assert.equal(err['code'], '42P01', 'the SQLSTATE is a CODE and is what makes a 5xx diagnosable')
    assert.equal(err['table'], 'exception', 'a schema identifier is ours')
    assert.equal(err['severity'], 'ERROR')

    assert.equal(err['message'], undefined, '`err.message` must never be emitted')
    assert.equal(err['stack'], undefined, '`err.stack` must never be emitted whole')
    assert.equal(
      err['detail'],
      undefined,
      '`err.detail` is a ROW VALUE — PostgreSQL reports a unique violation as ' +
        '`Key (tenant_id)=(…)`. An allow-list that admitted it would reintroduce, one ' +
        'layer up, exactly what `infra/lib/data-stack.ts` spent a parameter group on (G1065).',
    )
    assert.equal(err['where'], undefined, '`err.where` carries statement context')

    assert.equal(line['msg'], 'unhandled failure', 'the 500 message is a CONSTANT')
    const frames = err['frames']
    assert.ok(Array.isArray(frames) && frames.length > 0, 'no stack frames survived at all')
    for (const frame of frames as unknown[]) {
      assert.equal(typeof frame, 'string')
      assert.equal(
        /^[A-Za-z0-9_./\\:-]+:\d+:\d+$/.test(frame as string),
        true,
        `a frame is not a bare code location: ${String(frame)}. A frame's other half is a ` +
          'FUNCTION NAME, which is the one part of a stack that is not statically ours.',
      )
    }
  })

  it('9b · Fastify emits no error line of its own — the custom handler suppresses it', () => {
    // Measured before this file was written: WITHOUT a custom error handler,
    // Fastify logs the error at level 50 and sets the top-level `msg` to
    // `error.message`, which no serializer and no formatter can reach.
    // `server/http/app.ts` registers one, so the only 500 line is ours.
    const errorLines = capture.lines.filter((l) => l['level'] === 50)
    assert.equal(
      errorLines.length,
      1,
      `${errorLines.length} error-level lines. Exactly one is ours; a second is Fastify's ` +
        'own, which would carry `error.message` as `msg` and defeat the whole allow-list.',
    )
  })

  // ------------------------------------------- 10. the serializer, unit-level

  it('10 · a MULTI-LINE message does not survive in the stack', () => {
    // "Drop the first line of the stack" is not a repair: a message is
    // multi-line, and a pg error's second line is its DETAIL.
    const reduced = reduceStack(
      'Error: line one\nline two DETAIL Key (tenant_id)=(ten_acme)\n    at Object.x (/app/server/a.ts:1:2)',
    )
    assert.deepEqual(reduced.frames, ['/app/server/a.ts:1:2'])
    assert.equal(
      JSON.stringify(reduced).includes('ten_acme'),
      false,
      'a multi-line message leaked through the stack reduction',
    )
  })

  it('10b · a thrown non-Error is still refused', () => {
    const out = serializeError('a bare string thrown from somewhere')
    assert.equal(JSON.stringify(out).includes('bare string'), false)
    assert.equal(out['type'], 'non_error_thrown')
  })

  it('10c · the value grammar refuses anything with whitespace or any container', () => {
    assert.equal(isLoggableValue('ten_acme'), true)
    assert.equal(isLoggableValue('/v1/runs/:runId'), true)
    assert.equal(isLoggableValue(42), true)
    assert.equal(isLoggableValue('ACME Ltd'), false, 'a space means prose')
    assert.equal(isLoggableValue('a?b=c'), false, 'a query string must not pass the grammar')
    assert.equal(isLoggableValue({ a: 1 }), false)
    assert.equal(isLoggableValue(['a']), false)
    assert.equal(isLoggableValue('x'.repeat(129)), false)
  })

  it('10d · the three allow-lists are the plane\'s own, and `err` refuses the sentence fields', () => {
    // Imported rather than restated — `AJV_OPTIONS`'s precedent in app.ts: "a
    // test that restated it would go on passing after somebody changed it here."
    assert.deepEqual([...REQUEST_ALLOW_LIST].sort(), ['method', 'operationId', 'route'])
    assert.deepEqual([...RESPONSE_ALLOW_LIST], ['statusCode'])
    for (const forbidden of ['message', 'stack', 'detail', 'where', 'hint', 'query', 'parameters']) {
      assert.equal(
        ERROR_ALLOW_LIST.has(forbidden),
        false,
        `\`${forbidden}\` is in ERROR_ALLOW_LIST. Read log-allow-list.ts's header before ` +
          'widening it: Fastify\'s own types ASK for `message` and `stack`, and that ' +
          'request is the defect rather than the requirement.',
      )
    }
  })
})

/** Every string leaf must pass the value grammar. */
function walk(path: string, value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(`${path}[${index}]`, item))
    return
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, inner] of Object.entries(value)) walk(`${path}.${key}`, inner)
    return
  }
  if (typeof value !== 'string') return
  // `frames` is the one derived field outside the scalar grammar; it has its
  // own, stricter one, asserted in §9.
  if (path.endsWith('frames') || /\.frames\[\d+\]$/.test(path)) return
  assert.equal(
    isLoggableValue(value),
    true,
    `\`${path}\` carries a value the grammar refuses: ${JSON.stringify(value)}. §12.1 permits ` +
      'identifiers, codes, counts and durations — none of which contains whitespace.',
  )
}

function offending(capture: Capture, needle: string): string {
  const hit = capture.lines.find((line) => JSON.stringify(line).includes(needle))
  return hit === undefined ? '' : `The line: ${JSON.stringify(hit)}`
}
