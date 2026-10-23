/**
 * THE LOG ALLOW-LIST — G261 §12.1's CONTAINMENT RULE, EXPRESSED AS CODE.
 *
 * Copied from `docs/tech-stack.md` §12.1, never paraphrased:
 *
 *   *"A log line carries identifiers, codes, counts and durations. It never
 *   carries a payload field value, counterparty text, a document body, a header
 *   value or a query string. … Enforced by an allow-list serializer on the
 *   logger — a field not in the allow-list is dropped AND COUNTED, never
 *   printed — not by review."*
 *
 * `tenantId` is an id and is allowed; §12.1 says so in its own words.
 *
 * ┌─ WHY THIS FILE EXISTS AND WHY IT IS NOT A LINE IN `app.ts` ────────────────┐
 * │ `server/http/app.ts` carried `logger: false` from 16 Aug 2026 to           │
 * │ 21 Sep 2026, so `Observability`'s (G1061) eight alarms could fire with no  │
 * │ structured log to explain one. That is G1067, recorded ⛔ NOT APPLIED.     │
 * │                                                                            │
 * │ It was owed rather than forgotten: **`logger: true` ALONE BREACHES §12.1   │
 * │ ON ITS FIRST REQUEST**, and this is measured rather than argued — the      │
 * │ measurement is quoted verbatim in `tests/http/log-allow-list.test.ts`.     │
 * │ Fastify's DEFAULT serializers emit, for one ordinary request:              │
 * │                                                                            │
 * │   "req": { "method": "GET",                                                │
 * │            "url": "/v1/runs/run_acme_1?tenantId=ten_globex&q=SECRETQUERY", │
 * │            "host": "ten-acme.us-west-2.reconcileai.app",                   │
 * │            "remoteAddress": "127.0.0.1" }                                  │
 * │                                                                            │
 * │ — a QUERY STRING (§12.1 by name), and a HOST that resolves to a TENANT     │
 * │ through `model/serving-host.ts`'s registry (G179/G180).                    │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE ALLOW-LIST IS A CONJUNCTION OF TWO RULES AND NEITHER ALONE WOULD DO.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1 · THE NAME must be in a closed set, or be id-shaped in the sense
 *     `CLAUDE.md` §7 already requires of every reference field — `id`,
 *     `<thing>Id`, `<thing>Ids`. That is the allow-list §12.1 asks for.
 *
 * 2 · THE VALUE must be a number, a boolean, or a string with NO WHITESPACE
 *     and at most 128 characters — `isLoggableValue()` below. That is the
 *     PROPERTY, and it is what rule 1 alone cannot hold.
 *
 * **Rule 1 alone is `docs/HANDOFF.md` §5.1 — a rule keyed on a landmark rather
 * than on the property it protects — and the hole is concrete rather than
 * theoretical.** A payload's keys are COUNTERPARTY-CHOSEN: `model/kernel.ts`
 * says so where it declares `FieldPath` (*"a path names counterparty-chosen
 * JSON keys"*), and `db/migrations/0012` stores the whole document as one
 * `jsonb` column. So a counterparty who names a key `invoiceId` defeats rule 1
 * on its own and reaches a log line with a value we never classified. Rule 2
 * refuses it, because counterparty text is a SENTENCE and a sentence has
 * spaces.
 *
 * **Rule 2 alone is not the allow-list §12.1 asks for**: it admits any
 * single-token value under any key at all, so a `filename` of `invoice.pdf`
 * and a `bodyRef` would both print. §12.1 is a rule about FIELDS.
 *
 * ⚠️ AND A NESTED OBJECT OR ARRAY FAILS RULE 2 BY SHAPE, which is why
 * `headers`, `query`, `params`, `body` and a document's `extracted` are refused
 * TWICE — once by name and once because an object is not a scalar. That is
 * deliberate belt-and-braces on the four fields that carry everything §12.1
 * names.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE OUTER GATE IS THE FORMATTER AND THE INNER GATES ARE THE SERIALIZERS,
 *    AND THAT ORDER IS PINO'S RATHER THAN OURS. MEASURED, NOT ASSUMED.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `formatters.log` runs FIRST, on the RAW object, and pino then applies the
 * per-key serializers to WHATEVER THE FORMATTER RETURNED. Witnessed against
 * `pino@10.3.1` before this file was written — a formatter reporting what it
 * saw printed `"SAW_ERR_TYPE":"raw Error"`, and a formatter that dropped a key
 * left that key's serializer UNCALLED:
 *
 *     A (passthrough formatter + err serializer):
 *       {"level":30,"err":{"SER":true,"msg":"boom"},"SAW_ERR_TYPE":"raw Error","msg":"m"}
 *     C (formatter drops everything):
 *       {"level":30,"kept":1,"msg":"m"}
 *
 * **So `formatLogObject()` MUST pass `req`, `res` and `err` through untouched
 * or their serializers never run at all** — a formatter written the obvious way
 * would have silently disabled the three controls this file is mostly about,
 * and every assertion about them would have passed over an absent field.
 * `tests/http/log-allow-list.test.ts` §5 re-witnesses the ordering on every run
 * rather than trusting this paragraph.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT `err` GETS, AND THE MESSAGE IS REFUSED. READ THIS BEFORE WIDENING IT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **`err.message` IS DROPPED, AND SO IS `err.stack` AS A WHOLE.** An allow-list
 * that admitted either re-opens everything the other two serializers closed,
 * and again this is measured rather than feared. A `pg` error thrown by a real
 * handler serialises, under pino's DEFAULT `err` serializer, as:
 *
 *     "message": "relation \"tenant.exception\" does not exist\nDETAIL: Key (tenant_id)=(ten_acme)",
 *     "detail":  "Key (tenant_id)=(ten_acme) already exists.",
 *     "stack":   "Error: relation \"tenant.exception\" does not exist\nDETAIL: Key (tenant_id)=(ten_acme)\n    at …"
 *
 * `detail` is a ROW VALUE — it is how PostgreSQL reports a unique-violation —
 * and `message` and the head of `stack` carry it too. `db/migrations` bind
 * every value so a STATEMENT text carries `$1`, and `infra/lib/data-stack.ts`
 * pins `log_parameter_max_length_on_error` so the database does not undo that
 * (G1065); an application log that printed `err.detail` would reintroduce, one
 * layer up, exactly the thing that ruling spent a cluster parameter group on.
 *
 * ⚠️ **AND "DROP THE FIRST LINE OF THE STACK" IS NOT A REPAIR — A MESSAGE IS
 * MULTI-LINE.** Measured: `new Error('line one\nline two DETAIL leak').stack`
 * splits to `["Error: line one", "line two DETAIL leak", "    at …"]`. So the
 * stack is reduced by KEEPING ONLY WHAT MATCHES A FRAME (`/^\s+at /`) rather
 * than by dropping a fixed number of lines, and each surviving frame is then
 * reduced FURTHER to its `file:line:column` and grammar-checked — because a
 * frame's other half is a FUNCTION NAME, which is the one part of a stack that
 * is not statically ours.
 *
 * 🛑 THE COST IS NAMED RATHER THAN HIDDEN: **a 5xx line says WHAT and WHERE and
 * never says it in a sentence.** `code` (a SQLSTATE such as `42501`, which is
 * the refusal this repository actually hits), `constraint`, `table`, `column`,
 * `routine`, `statusCode`, and a call path through our own files. What is lost
 * is the human sentence, and reproducing a failure therefore needs the code and
 * not only the log. That is the fail-closed direction and it is a trade, not a
 * free win. Widening it is a ruling, not a patch.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ WHAT THIS FILE DOES **NOT** GOVERN, SAID HERE SO IT IS NOT DISCOVERED.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * · **`msg` DOES NOT PASS THROUGH `formatters.log` AT ALL** — pino handles the
 *   message separately, so no allow-list here can reach it. What makes that
 *   survivable is a MEASUREMENT rather than a hope: Fastify sets `msg` to
 *   `error.message` on a 500 **only when no custom error handler is
 *   registered**, and `server/http/app.ts` registers one. Witnessed: with a
 *   custom handler the only lines emitted are `"incoming request"` and
 *   `"request completed"`, both constants. The residual is OUR OWN call sites
 *   interpolating a value into a message, and that is held by
 *   `tests/http/log-allow-list.test.ts` §7, which requires every `log.<level>`
 *   call under `server/` to pass a plain string literal — it FAILS on a call it
 *   cannot parse rather than skipping it.
 *
 * · **A CHILD LOGGER'S BINDINGS BYPASS BOTH FORMATTERS, AND THAT IS PINO'S
 *   DESIGN RATHER THAN AN OVERSIGHT.** Measured against `pino@10.3.1`, twice,
 *   because the first result was surprising enough to be worth a second probe:
 *
 *       log.child({ tenantId: 'ten_acme', filename: 'Invoice 55 — ACME Ltd.pdf' })
 *            .info({ extra: 'x' }, 'from a child')
 *
 *       {"level":30,"tenantId":"ten_acme","filename":"Invoice 55 — ACME Ltd.pdf",
 *        "SEEN_BY_LOG_FORMATTER":["extra"],"msg":"from a child"}
 *
 *   **The formatter saw `["extra"]` and the counterparty filename printed
 *   anyway.** Adding a `formatters.bindings` does NOT close it either — a
 *   second probe with one installed printed the filename unchanged, because
 *   pino does not call that formatter for child loggers.
 *
 *   **So the containment cannot be held at the logger for this path and is held
 *   at SOURCE instead**: `tests/http/log-allow-list.test.ts` §7b refuses any
 *   `.log.child(` under `server/`. There are ZERO call sites today — the one
 *   child logger in the process is the one FASTIFY creates per request, whose
 *   single binding is `reqId` (`req-1`), which is ours and value-free. **The
 *   control exists so that the first person to add one meets this paragraph at
 *   a red assertion rather than after the fact**, which is what the tripwire
 *   this slice replaced failed to do.
 *
 * · **`console.error` BYPASSES ALL OF THIS.** It is not the logger; it reaches
 *   the same CloudWatch stream through the `awslogs` driver and through no
 *   serializer at all. `server/data-plane/authorisation-record.ts` interpolates
 *   `err.message` into one, which is a live §12.1 breach that predates this
 *   slice and is REPORTED rather than repaired here — converting ~20 call sites
 *   across `server/data-plane/` is its own commit and its own argument.
 *
 * · **AN UNMATCHED PATH IS NOT LOGGED, AND THAT IS A COST.** `operationId` and
 *   `route` are both absent for a 404, so a probe for `/wp-admin` is visible as
 *   a 404 and not as a path. The raw path is refused because an unmatched one
 *   is ATTACKER-CHOSEN IN FULL — it is counterparty text, not an identifier —
 *   and where that belongs is an ALB access log, which is a different artefact
 *   with a different retention class.
 */

/**
 * Rule 2, and the whole of it.
 *
 * NO WHITESPACE is the operative clause: counterparty text is prose, prose has
 * spaces, and every value §12.1 permits — an id, a SQLSTATE, an HTTP method, an
 * operationId, a route template — is a single token. 128 characters is a
 * ceiling rather than a measurement; the longest thing intended to pass is a
 * route template.
 *
 * ⚠️ `?`, `&` AND `=` ARE OUTSIDE THE GRAMMAR DELIBERATELY. Nothing this file
 * emits needs one, and their absence means a query string cannot pass rule 2
 * even if a future edit puts `url` back into an allow-list by name.
 */
const LOGGABLE_TOKEN = /^[A-Za-z0-9_.:@/+-]{1,128}$/

/** A stack frame reduced to a code location: `/app/server/http/app.ts:377:11`. */
const CODE_LOCATION = /^[A-Za-z0-9_./\\:-]{1,200}:\d{1,7}:\d{1,7}$/

/** A frame line in a `.stack`, as opposed to the (possibly multi-line) message. */
const STACK_FRAME = /^\s+at /

/** At most this many frames reach a line. A deeper stack is counted, not printed. */
const MAX_FRAMES = 12

/**
 * Rule 1's non-id half: names that are not id-shaped and are still one of
 * §12.1's four permitted classes.
 *
 * ⚠️ `event` IS HERE BECAUSE A CALL SITE ALREADY DEPENDS ON IT AND WAS DEAD.
 * `server/data-plane/session.ts` has called `request.log.error({ event:
 * 'g180_revoke_failed' })` since G386 — into a NO-OP SINK, because the logger
 * was off. Turning the logger on makes that line live, and an allow-list
 * without `event` would have made its first live act a silent drop: G180's
 * revocation failure reported as an empty object. It is a closed-vocabulary
 * CODE, which is exactly what §12.1 permits.
 */
const LOGGABLE_NAMES: ReadonlySet<string> = new Set([
  // §12.1: codes
  'event',
  'code',
  'method',
  'operationId',
  'route',
  'statusCode',
  'plane',
  'type',
  'severity',
  'constraint',
  'table',
  'column',
  'schema',
  'routine',
  'validationContext',
  'capability',
  'refusal',
  'reason',
  'origin',
  // §12.1: counts and durations
  'count',
  'dropped',
  'frames',
  'framesDropped',
  'responseTime',
  'durationMs',
  // pino's and Fastify's own, which are ours and value-free
  'reqId',
  'level',
  'time',
])

/** `CLAUDE.md` §7's own convention: a reference field is named id-shaped or no tool here can count it. */
const ID_SHAPED = /^(id|[a-z][A-Za-z0-9]*Ids?)$/

/**
 * §12.1's third permitted class, as a name shape.
 *
 * ⚠️ THIS ARM WAS ADDED BECAUSE A TEST FAILED AND THE TEST WAS RIGHT. §6 logs a
 * `SourceDocument`-shaped object carrying `pageCount: 3`; with `count` alone in
 * the closed set above, a field §12.1 permits IN SO MANY WORDS was dropped —
 * the allow-list refusing a class the rule names. A logger that swallows the
 * obviously-safe field is a logger somebody widens carelessly later.
 *
 * 🛑 AND IT CARRIES A SECOND CONJUNCT THAT THE ID ARM DOES NOT: the value must
 * be a NUMBER, checked in `allowOnly()`. `isLoggableValue()` would admit the
 * single-token STRING `'unpaid'` under a counterparty-chosen key named
 * `statusCount`, and a count that is not a number is not a count.
 */
const COUNT_SHAPED = /^[a-z][A-Za-z0-9]*Count$/

/** Rule 1. */
export function isLoggableName(key: string): boolean {
  return LOGGABLE_NAMES.has(key) || ID_SHAPED.test(key) || COUNT_SHAPED.test(key)
}

/** Rule 2. */
export function isLoggableValue(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'boolean') return true
  if (typeof value === 'string') return LOGGABLE_TOKEN.test(value)
  return false
}

/** What an allow-list did: what survived, and HOW MANY did not. */
export interface Allowed {
  readonly kept: Record<string, unknown>
  readonly dropped: number
}

/**
 * The one filter. Both rules, in one place, for `model/money.ts`'s reason —
 * *"correctness that lives at call sites is correctness that drifts."*
 *
 * `undefined` is ABSENT rather than dropped: a field a request did not carry
 * was never offered, and counting it would make the count a property of the
 * candidate shape instead of a property of what arrived.
 */
export function allowOnly(
  candidate: Readonly<Record<string, unknown>>,
  isAllowed: (key: string) => boolean,
): Allowed {
  const kept: Record<string, unknown> = {}
  let dropped = 0
  for (const [key, value] of Object.entries(candidate)) {
    if (value === undefined) continue
    const admitted =
      isAllowed(key) &&
      isLoggableName(key) &&
      isLoggableValue(value) &&
      (!COUNT_SHAPED.test(key) || typeof value === 'number')
    if (admitted) {
      kept[key] = value
      continue
    }
    dropped += 1
  }
  return { kept, dropped }
}

/** A `ReadonlySet` as rule 1's first conjunct, for the three fixed serializers. */
const oneOf =
  (names: ReadonlySet<string>) =>
  (key: string): boolean =>
    names.has(key)

function withCount(allowed: Allowed): Record<string, unknown> {
  return allowed.dropped === 0 ? allowed.kept : { ...allowed.kept, dropped: allowed.dropped }
}

/**
 * ⚠️ THE THREE ALLOW-LISTS ARE EXPORTED SO A TEST READS THE PLANE'S OWN SET
 * RATHER THAN A COPY OF IT — `AJV_OPTIONS`'s precedent in `server/http/app.ts`,
 * and for the identical reason: *"a test that restated it would go on passing
 * after somebody changed it here."*
 */
export const REQUEST_ALLOW_LIST: ReadonlySet<string> = new Set(['method', 'operationId', 'route'])
export const RESPONSE_ALLOW_LIST: ReadonlySet<string> = new Set(['statusCode'])
export const ERROR_ALLOW_LIST: ReadonlySet<string> = new Set([
  'type',
  'code',
  'statusCode',
  'severity',
  'constraint',
  'table',
  'column',
  'schema',
  'routine',
  'validationContext',
])

interface RequestLike {
  readonly method?: unknown
  readonly url?: unknown
  readonly host?: unknown
  readonly hostname?: unknown
  readonly ip?: unknown
  readonly headers?: unknown
  readonly query?: unknown
  readonly params?: unknown
  readonly body?: unknown
  readonly routeOptions?: { readonly url?: unknown; readonly config?: unknown } | undefined
}

/**
 * THE CANDIDATE IS WRITTEN OUT IN FULL, INCLUDING THE FIELDS THAT ARE REFUSED,
 * AND THAT IS WHAT MAKES `dropped` A REAL NUMBER.
 *
 * A serializer that simply PROJECTED the three survivors would emit the same
 * line and count nothing — and §12.1 asks for *"dropped AND COUNTED"* because a
 * silently dropped field and an absent field look identical, which is a
 * confusion this record has logged more than once. Naming the refused surface
 * here means `dropped` reports what the REQUEST carried, so a request with a
 * query string and eleven headers is visibly different from one with neither.
 */
export function serializeRequest(request: RequestLike): Record<string, unknown> {
  const config = request.routeOptions?.config
  const operationId =
    typeof config === 'object' && config !== null && 'operationId' in config
      ? (config as { operationId?: unknown }).operationId
      : undefined
  return withCount(
    allowOnly(
      {
        // Kept — a code, the contract's own name for the operation, and the
        // route TEMPLATE, which has placeholders where a URL has values.
        method: request.method,
        operationId,
        route: request.routeOptions?.url,
        // Refused, and named so the count is honest.
        url: request.url, //        the QUERY STRING — §12.1 by name
        host: request.host, //      resolves to a TENANT — G179/G180
        hostname: request.hostname,
        remoteAddress: request.ip,
        headers: request.headers, // `Cookie` IS the session handle — G386
        query: request.query,
        params: request.params,
        body: request.body,
      },
      oneOf(REQUEST_ALLOW_LIST),
    ),
  )
}

interface ReplyLike {
  readonly statusCode?: unknown
  readonly getHeaders?: unknown
}

/**
 * `statusCode` and nothing else.
 *
 * ⚠️ THAT IS WHAT FASTIFY'S DEFAULT `res` SERIALIZER ALSO EMITS TODAY, AND
 * DECLARING IT IS STILL THE POINT: a default is not a control. The response
 * headers are put into the candidate rather than left out of it because
 * `Set-Cookie` carries `__Host-reconcile_session` ON THE WAY OUT — the same
 * handle `serializeRequest()` refuses on the way in — so the refusal is
 * asserted in both directions rather than only the one anybody thinks of.
 */
export function serializeResponse(reply: ReplyLike): Record<string, unknown> {
  const headers =
    typeof reply.getHeaders === 'function'
      ? (reply.getHeaders as () => unknown).call(reply)
      : undefined
  return withCount(
    allowOnly({ statusCode: reply.statusCode, headers }, oneOf(RESPONSE_ALLOW_LIST)),
  )
}

/** The `file:line:column` of a frame, with the function name discarded. */
function locationOf(frame: string): string | undefined {
  const parenthesised = /\(([^()]*)\)\s*$/.exec(frame)
  const raw = (parenthesised?.[1] ?? frame.replace(STACK_FRAME, '')).trim()
  const bare = raw.startsWith('file://') ? raw.slice('file://'.length) : raw
  return CODE_LOCATION.test(bare) ? bare : undefined
}

export interface ReducedStack {
  readonly frames: readonly string[]
  readonly framesDropped: number
}

/**
 * A stack reduced to code locations.
 *
 * KEEPS WHAT MATCHES A FRAME rather than dropping a fixed prefix, because a
 * message is multi-line — see this file's header for the measurement. Then
 * reduces each frame to its location, because the rest of a frame is a FUNCTION
 * NAME and a function name is the one part of a stack that is not statically
 * ours.
 */
export function reduceStack(stack: unknown): ReducedStack {
  if (typeof stack !== 'string') return { frames: [], framesDropped: 0 }
  const frames: string[] = []
  let framesDropped = 0
  for (const line of stack.split('\n')) {
    if (!STACK_FRAME.test(line)) continue
    const location = locationOf(line)
    if (location === undefined || frames.length >= MAX_FRAMES) {
      framesDropped += 1
      continue
    }
    frames.push(location)
  }
  return { frames, framesDropped }
}

/**
 * THE ERROR SERIALIZER, AND ITS INTERESTING PROPERTY IS WHAT IT REFUSES.
 *
 * `message`, `stack`, `detail`, `where`, `hint`, `internalQuery`, `query` and
 * `parameters` are all simply NOT IN `ERROR_ALLOW_LIST`, so none of them needs
 * naming here to be refused — an allow-list refuses by omission, which is the
 * property a deny-list does not have. They ARE put into the candidate, so the
 * count reports that an error carried them.
 */
export function serializeError(error: unknown): Record<string, unknown> {
  if (typeof error !== 'object' || error === null) {
    return { type: 'non_error_thrown', dropped: 1 }
  }
  const own = error as Record<string, unknown>
  const message = own['message']
  const stack = own['stack']
  const reduced = reduceStack(stack)
  const allowed = allowOnly(
    {
      // pg and Fastify put their diagnostics on as OWN ENUMERABLE properties,
      // so the spread is what reaches `code`, `constraint`, `table` — and
      // `detail`, which is refused.
      ...own,
      type: error.constructor?.name,
      // Non-enumerable on a native Error, so they would miss the spread and
      // would therefore also miss the COUNT. Named to be counted, not to be
      // kept: neither is in `ERROR_ALLOW_LIST`.
      message: typeof message === 'string' ? message : undefined,
      stack: typeof stack === 'string' ? stack : undefined,
    },
    oneOf(ERROR_ALLOW_LIST),
  )
  return {
    ...withCount(allowed),
    ...(reduced.frames.length === 0 ? {} : { frames: reduced.frames }),
    ...(reduced.framesDropped === 0 ? {} : { framesDropped: reduced.framesDropped }),
  }
}

/**
 * The three keys whose VALUES are objects and which must survive the formatter
 * untouched so that pino then hands them to the serializers above.
 *
 * 🛑 THIS SET IS THE MEASURED REQUIREMENT FROM THIS FILE'S HEADER, NOT A
 * CONVENIENCE. Remove a name from it and that name's serializer is never
 * called — silently, with the field simply absent and every assertion about it
 * passing.
 */
const SERIALIZED_KEYS: ReadonlySet<string> = new Set(['req', 'res', 'err'])

/**
 * THE OUTER GATE — every object any call site logs, governed by the same two
 * rules.
 *
 * This is the half §12.1 names its own test for: *"a test that logs a
 * `SourceDocument`-shaped object and asserts the line holds its id and nothing
 * else."* `tests/http/log-allow-list.test.ts` §6 is that test.
 */
export function formatLogObject(
  object: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const passed: Record<string, unknown> = {}
  const candidate: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(object)) {
    if (SERIALIZED_KEYS.has(key)) {
      passed[key] = value
      continue
    }
    candidate[key] = value
  }
  const allowed = allowOnly(candidate, isLoggableName)
  return { ...passed, ...withCount(allowed) }
}

/**
 * The logger options every plane logs with.
 *
 * ⚠️ `base` DROPS `pid` AND THE OS `hostname`, AND THE REASON IS NOT A THREAT —
 * say so rather than overclaiming. A Fargate task's OS hostname is not
 * tenant-identifying; what replaces it is better than it anyway, because the
 * `awslogs` driver names the log STREAM after the ECS task id, so the task
 * identity is already on every line by construction and a second copy inside
 * the line is noise. What `base` keeps is the PLANE, which the stream name does
 * not carry when two planes share a group.
 *
 * ⚠️ THE RETURN TYPE IS INFERRED AND MUST STAY THAT WAY. pino's `SerializerFn`
 * is `(value: any) => any`, and a hand-written annotation of
 * `(value: never) => …` does NOT satisfy it — which does not surface here: it
 * makes `Fastify()`'s FIRST overload fail, so the HTTP/2-secure one wins and
 * `tsc` reports nine errors about `Http2ServerRequest` in a file that never
 * mentions HTTP/2. Measured, and the reason `app.ts` annotates the value it
 * passes.
 */
export function loggerOptions(plane: string) {
  return {
    base: { plane },
    serializers: {
      req: serializeRequest,
      res: serializeResponse,
      err: serializeError,
    },
    formatters: { log: formatLogObject },
  }
}
