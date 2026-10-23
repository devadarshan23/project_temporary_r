/**
 * THE FIRST CLIENT — `listRuns` and `getRun`, read over HTTP from the data plane.
 *
 * 🛑 WHAT THIS FILE IS FOR. Twelve routes exist as static HTML in
 * `design/routes/` and until this module nothing in this repository CONSUMED a
 * served operation. Four of the declared operations are served — derive both
 * numbers, do not read them here:
 *
 *     for f in docs/contracts/[a-z]*.openapi.yaml; do grep -c '^ *operationId:' $f; done
 *     grep -n 'handlers:' server/control-plane/start.ts server/data-plane/start.ts
 *
 * G200 freezes MOUNTING. It does not forbid a client consuming what is already
 * mounted, so this module mints no operation, no capability and no G row: it
 * calls two operations `server/data-plane/start.ts` already serves.
 *
 * ┌─ 🛑 INVARIANT 1 IS A PROPERTY OF THIS FILE'S SIGNATURES ────────────────────┐
 * │ "Tenant scope is derived from the session, never read from a request."      │
 * │                                                                            │
 * │ THERE IS NO `tenantId` PARAMETER ON EITHER FUNCTION AND THERE MUST NEVER BE │
 * │ ONE. The only credential either function holds is `session`, and the tenant │
 * │ is derived FROM it by the plane — `server/data-plane/session.ts` — and is   │
 * │ never read out of the request by a handler.                                 │
 * │                                                                            │
 * │ ⚠️ THIS BLOCK SAID "THE ABSENT PARAMETER IS THE WHOLE CONTROL: A CLIENT     │
 * │ CANNOT PUT ON THE WIRE A VALUE IT WAS NEVER GIVEN." THAT WAS FALSE, AND IT  │
 * │ IS CORRECTED HERE RATHER THAN DELETED BECAUSE IT IS THE SENTENCE A READER   │
 * │ WOULD HAVE TRUSTED. `endpoint()` built its URL by CONCATENATION, so an      │
 * │ `origin` of `http://127.0.0.1:8080/v1/runs?tenantId=ten_globex&pad=`        │
 * │ produced a correctly-addressed `GET` with a tenant in the query — and       │
 * │ `main.tsx` derives `origin` from `?plane=`, so the value arrives in a LINK. │
 * │ A missing parameter is not a control; it is the absence of one obvious way  │
 * │ to fail. The control is that the URL is now RESOLVED against the origin     │
 * │ (see `endpoint()`), which drops a smuggled query structurally, and that     │
 * │ `frontend/src/api/plane.ts` allowlists which origins may receive the token  │
 * │ at all.                                                                     │
 * │                                                                            │
 * │ ⚠️ AND THE SERVER-SIDE TESTS CANNOT COVER THIS HALF. The plane's            │
 * │ querystring schema is `additionalProperties: false`, so a client appending  │
 * │ `?tenantId=…` is REFUSED rather than obeyed — every assertion in            │
 * │ `tests/http/` stays green while the client is wrong. What measures it is    │
 * │ `tests/http/register-consumes-runs.test.ts`, which wraps `globalThis.fetch` │
 * │ and scans the request this module actually put on the socket.               │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ NO BUNDLER, AND THAT IS A CONSTRAINT ON WHAT THIS FILE MAY IMPORT RATHER
 * THAN AN ACCIDENT. `tests/http/register-consumes-runs.test.ts` loads this module
 * directly in node. Node strips TypeScript types and does NOT transform JSX, so a
 * client importing a `.tsx`, a stylesheet or anything only Vite resolves would
 * fail to load and the test would be red against the module system rather than
 * against the property. The API client is the one part of a frontend that has no
 * business knowing about the framework, and here that is mechanical.
 *
 * ⚠️ THE ONE IMPORT IS TYPE-ONLY, AND THE INVERSE OF `run-vocabulary.ts`'S RULE
 * APPLIES. That file imports `RUN_TRIGGER_KINDS` as a VALUE precisely so the seam
 * cannot be satisfied while the image never opens `model/` at runtime. Here the
 * opposite is wanted: `RunStatus` is a type, `import type` is erased before the
 * loader sees it, and this module therefore loads in node with no `model/`
 * resolution at all — while `npm run typecheck:frontend` still fails if a status
 * this client can name leaves the model's union. The status vocabulary is
 * DERIVED, not transcribed.
 */

import type { RunStatus } from '../../../model/domain.ts'
import type { Money } from './exceptions.ts'

/**
 * `capability.openapi.yaml` → `servers[0].url` is `https://{dataPlaneHost}/v1`.
 * The host is configuration; the `/v1` prefix is not. Spelled the same way
 * `tests/http/harness.ts` spells it, for the same reason.
 */
const CAPABILITY_BASE = '/v1'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 G386, 19 Sep 2026 — THIS CLIENT SENDS NO CREDENTIAL, AND THE CONSTANT THAT
 *    USED TO STAND HERE IS DELETED RATHER THAN RENAMED.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It read `const SESSION_HEADER = 'X-Session'` and was attached to every
 * request. The ruling retires that channel from the production path: the
 * handle is an `HttpOnly` cookie, **so page script cannot read it and this
 * module has nothing to attach.** `credentials: 'same-origin'` is the whole
 * of what replaces it — the browser attaches the cookie, or it does not.
 *
 * ⚠️ `'same-origin'` AND NOT `'include'`, AND THE NARROWER ONE IS THE POINT.
 * `'include'` would send the cookie cross-origin, which needs CORS the planes
 * do not serve (`grep -rn "cors" server/` returns nothing) and would put the
 * credential on whatever host `?plane=` named. `'same-origin'` means the
 * browser will not send it anywhere but the page's own origin — **a control
 * the user agent enforces, which no allowlist in this repository can be.**
 *
 * 🛑 THE COST IS REAL AND IS NAMED: A CROSS-ORIGIN `?plane=` NO LONGER WORKS,
 * because the request goes out unauthenticated and the plane answers 401. Both
 * arrangements that exist are same-origin — the deployed one, where the data
 * plane is a second origin behind one CloudFront distribution, and
 * `npm run dev`, where Vite proxies `/v1` (G226) — so nothing that works today
 * stops working. A future cross-origin plane is a CORS decision and a ruling,
 * not a `credentials` value somebody widens.
 */

/**
 * One entry of the shortfall channel, carried VERBATIM and never narrowed here.
 *
 * ⚠️ DELIBERATELY NOT A MIRROR OF THE CONTRACT'S `oneOf`. `CompletenessFinding`
 * is a four-arm union in `capability.openapi.yaml` and in
 * `model/reconciliation.ts`, and transcribing it here would be a THIRD copy with
 * nothing checking it for drift — the argument `db/migrations/0002_run.sql`
 * makes for declining a third copy of a closed enum, one layer out. The register
 * reads only whether the channel is absent, empty or populated; anything that
 * needs an arm should reach for the model rather than widen this.
 */
export interface CompletenessFinding {
  readonly kind: string
}

/**
 * `capability.openapi.yaml` → `components.schemas.Run`, which is
 * `additionalProperties: false` and lists `completeness` as `required`.
 *
 * 🛑 `completeness` IS `readonly CompletenessFinding[] | null` AND THE `null` ARM
 * IS LOAD-BEARING. `server/data-plane/runs.ts` is explicit: "`[]` the ENGINE ran
 * and observed no shortfall; `null` THIS PLANE HOLDS NO ENGINE ACCOUNT FOR THIS
 * RUN AT ALL." Every row this plane can serve is `null`, because nothing in this
 * repository persists a `SetReconciliationResult`. A type that made the field
 * non-nullable would force the second answer to be spelled as the first.
 */
export interface Run {
  readonly runId: string
  readonly definitionId: string
  /**
   * G3351 — the definition's NAME as stored (`db/migrations/0420`), or `null`
   * when the plane holds none. OPERATOR TEXT: rendered as a React text node and
   * never as markup. `required` on the wire, so absence is refused by the
   * readers below rather than defaulted.
   */
  readonly definitionName: string | null
  readonly definitionVersion: number
  readonly periodId: string | null
  /**
   * G3429 — the period's first and last CALENDAR day (`YYYY-MM-DD`, inclusive),
   * or `null` when the plane holds no dates. `required` on the wire; both or
   * neither (`db/migrations/0430`'s CHECK). See `periodLabel()`.
   */
  readonly periodStartsOn: string | null
  readonly periodEndsOn: string | null
  readonly trigger: { readonly kind: string }
  readonly status: RunStatus
  readonly inputs?: Readonly<Record<string, readonly string[]>>
  readonly startedAt: string
  readonly finishedAt: string | null
  readonly exceptionsRaised: number | null
  readonly completeness: readonly CompletenessFinding[] | null
}

/**
 * WHAT A PERSON IS SHOWN FOR A DEFINITION: its stored name, else its id.
 * G3351. ⚠️ THE FALLBACK IS THE ID AND NEVER A PRETTIFIED ID — `def_mock_bank`
 * turned into "Mock bank" would be this client inventing a name the plane said
 * it does not hold.
 */
export function definitionLabel(run: Pick<Run, 'definitionId' | 'definitionName'>): string {
  return run.definitionName ?? run.definitionId
}

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

function ymd(date: string): { y: string; m: string; d: string } | null {
  const hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (hit === null) return null
  const month = MONTH[Number(hit[2]) - 1]
  if (month === undefined) return null
  return { y: hit[1] ?? '', m: month, d: hit[3] ?? '' }
}

/**
 * WHAT A PERSON IS SHOWN FOR A PERIOD — G3429: the pack's *"02 – 08 Mar 2026"*,
 * built from the stored calendar span, else the period id (a true thing to
 * render), else `null` for a run with no period at all.
 *
 * ⚠️ PARSED AS TEXT AND NEVER THROUGH `Date`: a `date` has no zone, and
 * `new Date('2026-03-02')` is midnight UTC — the 1st of March to a reader west
 * of Greenwich. The span is drawn as stored.
 */
export function periodLabel(run: Pick<Run, 'periodId' | 'periodStartsOn' | 'periodEndsOn'>): string | null {
  const a = run.periodStartsOn === null ? null : ymd(run.periodStartsOn)
  const b = run.periodEndsOn === null ? null : ymd(run.periodEndsOn)
  if (a === null || b === null) return run.periodId
  if (a.y !== b.y) return `${a.d} ${a.m} ${a.y} – ${b.d} ${b.m} ${b.y}`
  if (a.m !== b.m) return `${a.d} ${a.m} – ${b.d} ${b.m} ${b.y}`
  if (a.d === b.d) return `${a.d} ${a.m} ${a.y}`
  return `${a.d} – ${b.d} ${a.m} ${a.y}`
}

/** G3429 — both period dates are `required` and each is a date string or null. */
function assertPeriodDates(item: unknown, where: string): void {
  const rec = typeof item === 'object' && item !== null && !Array.isArray(item) ? (item as Record<string, unknown>) : null
  const ok = (k: string): boolean =>
    rec !== null && k in rec && (rec[k] === null || typeof rec[k] === 'string')
  if (!ok('periodStartsOn') || !ok('periodEndsOn')) {
    throw new Error(
      `${where} answered a run without \`periodStartsOn\`/\`periodEndsOn\` as a date or null. ` +
        'Both are `required` on `Run` (G3429); drawing the id in their place would hide a plane ' +
        'that stopped publishing them.',
    )
  }
}

/** `listRuns`'s 200 body, exactly: `required: [items, nextCursor]`. */
export interface RunPage {
  readonly items: readonly Run[]
  readonly nextCursor: string | null
}

/**
 * A refusal that reached the client. Carries the STATUS and the closed `code`
 * from `errors.yaml`, never the plane's `detail` — that field "MUST NOT contain
 * field values, record contents or customer-authored strings", and a client that
 * put it in front of a user would be the one place that rule is not held.
 */
export class PlaneRefused extends Error {
  readonly status: number
  readonly code: string | undefined
  /**
   * The REFUSAL KIND, when the problem's `detail` is exactly `refusal: <kind>`
   * and nothing else. G2876. The rule above still holds — the `detail` STRING
   * never reaches a user — but `declareEndpoint` and
   * `declareEndpointDocumentType` put a closed-vocabulary token there (*"The
   * refusal's kind is in `detail`; it is the caller's own input and discloses
   * nothing else"*), and an administrator told only "validation failed" cannot
   * tell an unpinned host key from a traversing path. So the token is EXTRACTED
   * by a pattern that admits `[a-z_]` alone, and a detail of any other shape
   * yields `undefined` rather than being shown. Optional, so every existing
   * caller is unchanged and the message below is byte-identical.
   */
  readonly refusalKind: string | undefined

  constructor(status: number, code: string | undefined, title: string, detail?: string) {
    super(`the data plane refused with ${status} (${code ?? 'no code'}): ${title}`)
    this.name = 'PlaneRefused'
    this.status = status
    this.code = code
    this.refusalKind = /^refusal: ([a-z_]{1,64})$/.exec(detail ?? '')?.[1]
  }
}

/** What every read needs and nothing more. NO TENANT — see the header. */
export interface Read {
  /**
   * The plane's origin, e.g. `http://127.0.0.1:8080`.
   *
   * 🛑 THIS IS THE DESTINATION OF THE SESSION TOKEN, NOT MERELY AN ADDRESS, and
   * the honest statement of what this module does and does not guarantee is:
   *
   *   · `endpoint()` REFUSES a malformed origin and RESOLVES rather than
   *     concatenates, so no caller can smuggle a query — a tenant included —
   *     onto the wire through this field.
   *   · IT DOES NOT ALLOWLIST THE HOST. A caller that names
   *     `https://evil.example` gets `GET https://evil.example/v1/runs` with
   *     `X-Session` attached. That is measured, not assumed.
   *
   * ⚠️ SO THE ALLOWLIST LIVES WHERE THE UNTRUSTED INPUT IS, which is
   * `frontend/src/api/plane.ts`: `?plane=` is the ONE route by which someone
   * other than the author of a call site chooses this value, and it is guarded
   * there. Putting a deployment allowlist in this module instead would make an
   * API client the authority on which environments exist. **A NEW CALL SITE THAT
   * TAKES THIS VALUE FROM ANYTHING A USER OR A LINK CAN INFLUENCE MUST GO
   * THROUGH `planeFrom()` FIRST.** This sentence is the whole of that contract;
   * nothing mechanical enforces it, and saying so is the point.
   */
  readonly origin: string
}

/**
 * ┌─ 🛑 THE URL IS RESOLVED, NEVER CONCATENATED ───────────────────────────────┐
 * │ AND THIS IS WHERE THE HEADER'S CLAIM IS ACTUALLY MADE TRUE.                │
 * │                                                                            │
 * │ ⚠️ THIS FUNCTION WAS `origin.replace(/\/+$/,'') + CAPABILITY_BASE + path`,  │
 * │ AND THAT SPELLING PUT A TENANT ON THE WIRE. Measured:                      │
 * │                                                                            │
 * │   origin = 'http://127.0.0.1:8080/v1/runs?tenantId=ten_globex&pad='        │
 * │   →  GET http://127.0.0.1:8080/v1/runs?tenantId=ten_globex&pad=/v1/runs    │
 * │                                                                            │
 * │ The right endpoint, with a tenant in the query. `origin` is not a constant │
 * │ — `main.tsx` derives it from `?plane=` — so that value arrives in a LINK.  │
 * │ The plane refused it (`additionalProperties: false`), which means tenant   │
 * │ isolation was held BY THE SERVER: the exact inverse of what the header of  │
 * │ this file claims, which is that "a client cannot put on the wire a value   │
 * │ it was never given".                                                       │
 * │                                                                            │
 * │ `new URL(absolutePath, base)` DROPS the base's query and fragment, so a    │
 * │ tenant smuggled through `origin` cannot survive resolution. That is the    │
 * │ structural half. The explicit refusal below is the half that SAYS SO —     │
 * │ silently discarding a caller's query would leave them believing it was     │
 * │ honoured.                                                                  │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ THE GUARD IS HERE AND ALSO IN `frontend/src/api/plane.ts`, DELIBERATELY.
 * `plane.ts` allowlists which origins may receive the session token at all;
 * this refuses a malformed origin at the point of use. A control that lives
 * only at the caller stops existing the moment a second caller appears, and
 * this module is the one every read goes through.
 */
export function planeEndpoint(origin: string, path: string): URL {
  let base: URL
  try {
    base = new URL(origin)
  } catch {
    throw new Error(
      'the plane origin is not a URL. It is configuration, but it is also the destination ' +
        'of the session token, so it is parsed rather than pasted.',
    )
  }
  if (base.search !== '' || base.hash !== '') {
    throw new Error(
      'the plane origin carries a query or a fragment, which a plane origin never does. ' +
        'This is refused rather than stripped: it is the shape that smuggles a tenant onto ' +
        'the wire, and invariant 1 says scope is derived from the session, never read from ' +
        'a request.',
    )
  }
  /* Resolved against the ORIGIN alone. A path on the origin is dropped too —
     `capability.openapi.yaml` → `servers[0].url` is `https://{dataPlaneHost}/v1`,
     so the host is configuration and the `/v1` prefix is not. */
  return new URL(`${CAPABILITY_BASE}${path}`, base.origin)
}

/**
 * ⚠️ EXPORTED ON 19 Sep 2026 (G357) AND THE EXPORT IS THE POINT RATHER THAN A
 * CONVENIENCE. `frontend/src/api/exceptions.ts` is the second client, and the
 * obvious thing for it to do was write its own three-line URL builder.
 *
 * **This function is a REPAIR, not a helper.** Its own block above records the
 * measurement: the concatenating spelling put `?tenantId=ten_globex` on the
 * wire through `?plane=`, and `new URL(absolutePath, base)` dropping the base's
 * query is what stops it. A second client with its own builder is that defect
 * fixed once and regressed in the copy — §5.3, *"two vocabularies for one
 * concept, diverging"*, on the one seam where the divergence puts a tenant on
 * a request.
 *
 * `endpoint()` was its name while it had one caller. It is `planeEndpoint()`
 * now because a name that says nothing outside its own file is a name the next
 * caller re-invents.
 */

/**
 * One GET, and every read in this module goes through it.
 *
 * 🛑 NO BODY, ON PURPOSE AND NOT MERELY BECAUSE GET HAS NONE.
 * `server/contract/routes.ts` registers no body schema at all — "THERE IS NO
 * `body` KEY, AND ITS ABSENCE IS NOT AN OVERSIGHT" — so a body would reach no
 * validator on the way in. `fetch` is called with no `body` init, so the request
 * carries `null`.
 *
 * 🛑 AND `fetch` IS REACHED THROUGH THE GLOBAL, NOT THROUGH AN INJECTED
 * PARAMETER. A `fetchImpl` option would be the obvious testability affordance and
 * it is refused: it would let this client behave one way under test and another
 * in a browser, and the assertion that measures invariant 1 on the wire would
 * then be measuring the test's path instead of the product's.
 *
 * ┌─ 🛑 `redirect: 'error'` — A REDIRECT IS AN ORIGIN CHANGE THE ALLOWLIST NEVER │
 * │ SAW, AND IT CARRIED THE SESSION TOKEN THROUGH.                             │
 * │                                                                            │
 * │ ⚠️ MEASURED BEFORE THE REPAIR, NOT REASONED: two loopback servers, A        │
 * │ answering `302` to B. `fetchRuns({origin: A, session: 'LIVE'})` followed    │
 * │ it, **B logged `x-session: LIVE`**, and the client returned B's body as if  │
 * │ it were the plane's. Per Fetch, only `Authorization`, `Cookie` and          │
 * │ `Proxy-Authorization` are stripped across an origin change; a CUSTOM header │
 * │ survives, in node and in a browser alike — and `X-Session` is a custom      │
 * │ header, by `capability.openapi.yaml`'s own choice of `apiKey`/`in: header`. │
 * │                                                                            │
 * │ So `frontend/src/api/plane.ts` was titled "WHERE THE SESSION TOKEN MAY BE   │
 * │ SENT" while the destination it allowlisted could hand the token to any      │
 * │ origin it liked with one `Location:` header. The precondition is stronger   │
 * │ than the `?plane=` hole it resembles — it needs control of the RESPONSE     │
 * │ from a permitted origin — which is why it is a smaller finding and not a    │
 * │ smaller PROPERTY: an allowlist that a hop can leave is not an allowlist.    │
 * │                                                                            │
 * │ `redirect: 'error'` REJECTS rather than following. A plane that starts      │
 * │ answering `3xx` is a plane that has changed, and the honest response is to  │
 * │ fail loudly in front of whoever changed it, not to chase the `Location`.    │
 * │                                                                            │
 * │ ⚠️ G386 CHANGES WHAT THIS BUYS AND DOES NOT RETIRE IT. The measurement      │
 * │ above is about a CUSTOM HEADER surviving an origin change, and there is no │
 * │ custom header any more — a COOKIE is one of the three things Fetch strips  │
 * │ across an origin change, so the exfiltration this paragraph measured is    │
 * │ now impossible rather than blocked. **`redirect: 'error'` stays**, for the │
 * │ narrower reason in its last sentence and for one G386 adds: a plane that   │
 * │ answers `3xx` to a data read is a plane that could redirect a browser to a │
 * │ sign-in flow, and a client that followed one would turn an expired session │
 * │ into a rendered page of somebody else's HTML rather than a 401.            │
 * └────────────────────────────────────────────────────────────────────────────┘
 */
async function readJson(url: URL): Promise<unknown> {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'error',
    credentials: 'same-origin',
    headers: {
      accept: 'application/json',
    },
  })

  const text = await response.text()
  let parsed: unknown
  try {
    parsed = text === '' ? undefined : JSON.parse(text)
  } catch {
    parsed = undefined
  }

  if (!response.ok) {
    const problem = isRecord(parsed) ? parsed : {}
    throw new PlaneRefused(
      response.status,
      typeof problem['code'] === 'string' ? problem['code'] : undefined,
      typeof problem['title'] === 'string' ? problem['title'] : '(no title)',
    )
  }
  return parsed
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 🛑 THE CHECKS BELOW REFUSE; THEY NEVER REPAIR, AND THAT IS THE DIFFERENCE
 * BETWEEN THIS FUNCTION AND THE ONE-LINER EVERY CONVENIENCE HELPER WRITES.
 *
 * `items: body.items ?? []` and `nextCursor: body.nextCursor ?? null` are the
 * idiomatic spelling and both are FABRICATIONS: the first turns a malformed
 * response into an empty register, and the second turns a page that has a
 * successor into one that claims it is the end. A register that cannot page
 * shows an arbitrary prefix of a tenant's runs WHILE LOOKING COMPLETE.
 *
 * ⚠️ AND `completeness` IS NOT TOUCHED AT ALL. It is carried through exactly as
 * the plane sent it, so `null` stays `null`. `?? []` on that field would
 * fabricate a clean close for every run in a database that has never run the
 * engine — and on an `incomplete` run it would be self-contradictory, because
 * `terminalRunStatus()` derives `incomplete` FROM a non-empty completeness
 * channel. Reshaping belongs to whatever DRAWS, not to the thing that READS.
 */
function asRunPage(body: unknown, where: string): RunPage {
  if (!isRecord(body)) {
    throw new Error(`${where} did not answer with a JSON object`)
  }
  if (!Array.isArray(body['items'])) {
    throw new Error(
      `${where} answered without an \`items\` array. \`listRuns\` publishes ` +
        '`{ items, nextCursor }` and both are `required`; defaulting the absence to `[]` ' +
        'would render an empty register for a tenant that has runs.',
    )
  }
  if (!('nextCursor' in body)) {
    throw new Error(
      `${where} answered without \`nextCursor\`. It is \`required\` on the 200 body and ` +
        'the cursor is opaque on purpose — defaulting it to `null` would claim every page ' +
        'is the last one.',
    )
  }
  const nextCursor = body['nextCursor']
  if (nextCursor !== null && typeof nextCursor !== 'string') {
    throw new Error(`${where} answered with a \`nextCursor\` that is neither a string nor null`)
  }
  for (const item of body['items'] as readonly unknown[]) {
    assertPeriodDates(item, where)
    const name = isRecord(item) ? item['definitionName'] : undefined
    if (!isRecord(item) || !('definitionName' in item) || (name !== null && typeof name !== 'string')) {
      throw new Error(
        `${where} answered a run without a \`definitionName\` that is text or null. It is ` +
          '`required` on `Run` (G3351); rendering the id in its place would hide a plane that ' +
          'stopped publishing the name.',
      )
    }
  }
  return { items: body['items'] as readonly Run[], nextCursor }
}

/**
 * `GET /v1/runs` — the register's own read. Most recent first, as the operation's
 * summary says.
 *
 * `cursor` is the opaque value a previous page returned as `nextCursor`. It is
 * NOT constructible by a client and this module does not try:
 * `capability.openapi.yaml` → `components.parameters.Cursor` — "A cursor a client
 * can construct is a cursor a client can point at another tenant's ordering key."
 *
 * ⚠️ `limit` IS NOT SENT. `components.parameters.Limit` declares
 * `default: 50`, and a client restating a default is a second place for it to
 * drift. The plane's ajv instance applies it.
 */
export async function fetchRuns(o: Read & { readonly cursor?: string }): Promise<RunPage> {
  const url = planeEndpoint(o.origin, '/runs')
  if (o.cursor !== undefined) url.searchParams.set('cursor', o.cursor)
  return asRunPage(await readJson(url), '`listRuns`')
}

/**
 * `GET /v1/runs/{runId}` — one run.
 *
 * ⚠️ A 404 HERE IS NOT PROOF THE RUN DOES NOT EXIST, and a caller that says so in
 * a message is wrong. The plane answers identically "for a row that does not
 * exist and for a row in another tenant — distinguishing them would make this
 * endpoint an existence oracle across the tenant boundary"
 * (`capability.openapi.yaml`). The honest rendering is "no run with that id is
 * visible to this session", which is what the plane's own `detail` says.
 *
 * 🛑 `runId` IS PATH-ENCODED. It arrives from a row the client itself drew, but
 * encoding it is not optional: an id containing a `/` or a `?` would otherwise
 * re-address the request, and `G97` puts NO format constraint on a branded id in
 * the database — "the database enforces no id format".
 */
export async function fetchRun(o: Read & { readonly runId: string }): Promise<Run> {
  const url = planeEndpoint(o.origin, `/runs/${encodeURIComponent(o.runId)}`)
  const body = await readJson(url)
  if (!isRecord(body) || typeof body['runId'] !== 'string') {
    throw new Error('`getRun` did not answer with a `Run`')
  }
  if (!('completeness' in body)) {
    throw new Error(
      '`getRun` answered without `completeness`. It is `required` on `Run`, and a client ' +
        'that tolerates its absence cannot tell an unaccounted run from an accounted one.',
    )
  }
  if (!('definitionName' in body)) {
    throw new Error('`getRun` answered without `definitionName`, which is `required` on `Run` (G3351).')
  }
  assertPeriodDates(body, '`getRun`')
  return body as unknown as Run
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE RUN'S OWN ACCOUNT — `getRunAccount` and `listRunResidue`. G1031,
   20 Sep 2026.

   🛑 BOTH OPERATIONS WERE MOUNTED ON 19 Sep 2026 (G300) AND NOTHING IN THIS
   APPLICATION CONSUMED EITHER OF THEM. What stood in their place was a HATCH,
   at the foot of `frontend/src/components/Register.tsx`, reading
   `refusedBy="G200"` and `why="getRunAccount and listRunResidue are declared
   and not mounted"`. **That hatch was FALSE**, and a false hatch is the worst
   mark this system can carry: G245 minted a separate REFUSED ink step
   precisely so the mark could keep meaning only *refused*, and a mark saying a
   SERVED operation is unserved spends it on a claim the tree had already
   discharged. Derive the mount, never read it:

     grep -n 'getRunAccount\|listRunResidue' server/data-plane/start.ts

   ⚠️ NO SECOND URL BUILDER AND NO SECOND READER. Both reads go through
   `planeEndpoint()` and `readJson()` above, for the reason `planeEndpoint`'s
   own block states: the concatenating spelling put `?tenantId=` on the wire
   through `?plane=`, and a second builder is that defect fixed once and
   regressed in the copy.

   🛑 AND THE HONEST ANSWER TO BOTH, AGAINST EVERY DATABASE THIS REPOSITORY CAN
   PRODUCE TODAY, IS **404**. `server/data-plane/run-account.ts` answers
   `no_account` for a run with no engine account, and nothing here persists a
   `SetReconciliationResult` — so the arm every surface actually meets is the
   absent one. It is a SENTENCE rather than an empty panel, because *"an empty
   page is a real answer here and it means the engine left no residue"* and the
   404 means nothing reconciled this run. Drawing them the same way is the
   `?? []` defect one layer out.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * `capability.openapi.yaml` → `components.schemas.AdmissionRate`.
 *
 * 🛑 THREE INDEPENDENT COUNTS AND NOTHING DIVIDED, AND THIS CLIENT ADDS NO
 * FOURTH. The schema is explicit that `presented === admitted + refused` is a
 * property a caller may CHECK rather than a tautology it is handed — *"a fold
 * that LOST a row moves `admitted` and leaves `refused` alone"* — so a `rate`
 * computed here would destroy the one thing the channel exists for.
 */
export interface AdmissionRate {
  readonly side: string
  readonly presented: number
  readonly admitted: number
  readonly refused: number
}

/**
 * `capability.openapi.yaml` → `components.schemas.RunDocumentAccount`. G236.
 *
 * ⚠️ `declaredMinor` IS A **STRING** AND NOTHING MAY CALL `Number()` ON IT.
 * The schema says so in its own voice — *"A DECIMAL STRING SINCE 19 Sep 2026 —
 * G286. It is a `Money`'s minor units"* — and G286's argument is that a JSON
 * number loses exactness above 2^53 minor units.
 *
 * ⚠️ AND THERE IS NO `filename` FIELD TO ADD: *"A `sourceDocumentId` AND NEVER
 * A FILENAME. A filename is counterparty-controlled and this record is
 * rendered and logged (invariant 6)."*
 */
export interface RunDocumentAccount {
  readonly side: string
  readonly sourceDocumentId: string
  readonly trailer: string
  readonly declaredLineCount: number | null
  readonly declaredMinor: string | null
  readonly declaredExponent: number | null
  readonly presented: number
  readonly admitted: number
  readonly refused: number
  readonly verdict: { readonly kind: string }
}

/**
 * A closed union carried by its discriminant alone.
 *
 * 🛑 THE SAME DECISION `CompletenessFinding` MAKES ABOVE, FOR THE SAME REASON.
 * `RefusedItem`, `AmbiguityFinding`, `PostconditionFailure`, `MeterFact` and
 * `RunRefusal` are each a closed union declared in `capability.openapi.yaml`
 * AND in `model/reconciliation.ts`; transcribing one here would be a THIRD
 * copy with nothing checking it for drift — the argument
 * `db/migrations/0002_run.sql` makes for declining a third copy of a closed
 * enum, one layer out. Each is drawn on this surface as a COUNT plus, where
 * the arm carries one, its `kind`. **A panel that needs an arm's operands
 * types what it draws, in the slice that draws it.**
 */
export interface Kinded {
  readonly kind: string
}

/**
 * `capability.openapi.yaml` → `components.schemas.UnsettledValue` — G3541.
 * Three arms and never a zero or a conversion: a side with nothing open has no
 * currency to put a zero in, and residuals in two currencies are REFUSED
 * (`mixed_units`) rather than summed, because there is no FX on this path.
 */
export type UnsettledValue =
  | { readonly kind: 'nothing_open' }
  | { readonly kind: 'total'; readonly total: Money }
  | { readonly kind: 'mixed_units' }

/**
 * `capability.openapi.yaml` → `components.schemas.SettlementTally` — G3541.
 * `matched + open === admitted` for the side, a property a caller can CHECK
 * against `admissionRates`; this client draws it and computes nothing.
 */
export interface SettlementTally {
  readonly side: string
  readonly matched: number
  readonly open: number
  readonly unsettled: UnsettledValue
}

/** The produced arm. Every channel is `required` and none of them is optional. */
export interface RunAccountProduced {
  readonly outcome: 'produced'
  readonly terminalStatus: string
  readonly admissionRates: readonly AdmissionRate[]
  readonly settlementTallies: readonly SettlementTally[]
  /**
   * G3804 / G3885 — *"IN VARIANCE"*, AS THE OWNER DEFINED IT: the LEFT side's
   * unsettled total minus the RIGHT side's, so `total.amountMinor` MAY BE
   * NEGATIVE. It equals the run's register Variance total; this client draws
   * it and computes nothing.
   */
  readonly openResidual: UnsettledValue
  readonly documentAccounts: readonly RunDocumentAccount[]
  readonly refusedAtAdmission: readonly unknown[]
  readonly ambiguities: readonly unknown[]
  readonly searchBoundary: {
    readonly oversizedBuckets: readonly unknown[]
    readonly exhaustedSearches: readonly unknown[]
    readonly oversizedAmountBuckets: readonly unknown[]
  }
  readonly postconditions: readonly Kinded[]
  readonly completeness: readonly CompletenessFinding[]
  readonly meterFacts: readonly unknown[]
}

/**
 * The refused arm.
 *
 * 🛑 IT CARRIES NO LEDGER AND THIS TYPE MUST NEVER GROW ONE. The schema:
 * *"a refused run produced NOTHING, and the refusal IS the output. Declaring
 * those properties on it 'just in case' would make an invalid state legal
 * (§5.5)."* One interface with optional channels is exactly that mistake
 * spelled in TypeScript, which is why this is a two-arm union discriminated on
 * `outcome` rather than one record.
 */
export interface RunAccountRefused {
  readonly outcome: 'refused'
  readonly refusal: Kinded
}

export type RunEngineAccount = RunAccountProduced | RunAccountRefused

/**
 * `capability.openapi.yaml` → `components.schemas.ResidueEntry`.
 *
 * 🛑 `settlement` IS REQUIRED AND NULLABLE, NEVER OPTIONAL, and the schema
 * records what the first version cost: *"the refused case carried a zero in an
 * empty currency — a FABRICATED zero sitting on the one row a finance user
 * reads to find out what went wrong."* It is carried opaque because
 * `ItemSettlement` is a three-arm union this surface reports by PRESENCE, and
 * narrowing it here would be the third copy the block above refuses.
 *
 * ⚠️ NO COUNTERPARTY PROSE REACHES THIS ROW AND NONE MAY BE ADDED.
 * `AdmittedItem.untrustedDescription` is named in the schema precisely so
 * nobody adds it: the row is rendered on an operator surface and logged
 * (invariant 6).
 */
export interface ResidueEntry {
  readonly side: string
  /* C3-01 (G3831) — `null` for a header-grain document: the item is the whole
     file. It was typed `number`, so `countOf(null)` compiled and the run page
     crashed on every produced run. */
  readonly ref: { readonly sourceDocumentId: string; readonly lineIndex: number | null }
  readonly settlement: unknown
  readonly disposition: string
  readonly cause: Kinded
  readonly heldReads?: readonly unknown[]
}

/** `listRunResidue`'s 200 body, exactly: `required: [items, nextCursor]`. */
export interface ResiduePage {
  readonly items: readonly ResidueEntry[]
  readonly nextCursor: string | null
}

/**
 * `GET /v1/runs/{runId}/account` — the run's own account of itself.
 *
 * 🛑 THE CHECK REFUSES AND NEVER REPAIRS, WHICH IS `asRunPage`'s RULE ARRIVING
 * ON A DISCRIMINATED UNION. `outcome` is the discriminator and a body without
 * one is not a `RunEngineAccount` at all; defaulting an absent `outcome` to
 * `produced` would draw five empty panels as a clean run, and defaulting it to
 * `refused` would invent a refusal nobody recorded. Both are worse than the
 * throw.
 *
 * ⚠️ A 404 IS NOT CAUGHT HERE, for `fetchException`'s reason and for one this
 * operation adds. `server/data-plane/run-account.ts` answers the SAME 404 for
 * a run in another tenant, a run that does not exist, and a run nobody has
 * reconciled — *"Those two facts are collapsed today"* — so this client must
 * not turn any of them into a distinguishable state. `PlaneRefused` carries
 * the status and the caller decides how to say it.
 *
 * 🛑 NO QUERY IS SENT, AND SINCE G941 THAT IS ENFORCED RATHER THAN MERELY
 * TIDY: every parameter-free operation carries a CLOSED empty querystring
 * schema, so a client appending any undeclared key is answered **400** instead
 * of being ignored. `runId` is this operation's only parameter and it is in
 * the PATH.
 */
export async function fetchRunAccount(
  o: Read & { readonly runId: string },
): Promise<RunEngineAccount> {
  const url = planeEndpoint(o.origin, `/runs/${encodeURIComponent(o.runId)}/account`)
  const body = await readJson(url)
  if (!isRecord(body)) throw new Error('`getRunAccount` did not answer with a JSON object')
  const outcome = body['outcome']
  if (outcome !== 'produced' && outcome !== 'refused') {
    throw new Error(
      '`getRunAccount` answered without a recognised `outcome`. It is the discriminator on ' +
        '`RunEngineAccount` and is `required` on both arms; defaulting it would draw a run ' +
        'that produced nothing as one that produced everything, or the reverse.',
    )
  }
  return body as unknown as RunEngineAccount
}

/**
 * `GET /v1/runs/{runId}/residue` — the residue, one row per open item.
 *
 * 🛑 AN EMPTY PAGE AND A 404 ARE DIFFERENT FACTS AND THIS CLIENT KEEPS THEM
 * APART BY DOING NOTHING TO EITHER. The handler is explicit: *"A run with no
 * engine account and a run whose residue is empty both produce zero rows from
 * the table below. The first means nothing reconciled this run; the second
 * means the engine closed everything. Answering `{items: [], nextCursor:
 * null}` to both would report a clean close for a run nobody ran."* A `catch`
 * here that turned the 404 into an empty page would put that defect back in
 * the client one layer above where the server refused it.
 *
 * ⚠️ `limit` IS NOT SENT, for `fetchRuns`'s reason: `components.parameters.Limit`
 * declares a `default:` that the plane's ajv applies, and a client restating
 * one is a second place for it to drift.
 */
export async function fetchRunResidue(
  o: Read & { readonly runId: string; readonly cursor?: string },
): Promise<ResiduePage> {
  const url = planeEndpoint(o.origin, `/runs/${encodeURIComponent(o.runId)}/residue`)
  if (o.cursor !== undefined) url.searchParams.set('cursor', o.cursor)
  const body = await readJson(url)
  if (!isRecord(body)) throw new Error('`listRunResidue` did not answer with a JSON object')
  if (!Array.isArray(body['items'])) {
    throw new Error(
      '`listRunResidue` answered without an `items` array. It is `required` on the 200 body, ' +
        'and defaulting the absence to `[]` would report a run with no open items — which on ' +
        'this surface reads as a clean close for a run nobody reconciled.',
    )
  }
  if (!('nextCursor' in body)) {
    throw new Error(
      '`listRunResidue` answered without `nextCursor`. It is `required`, and defaulting it to ' +
        '`null` would claim every page is the last one — which over a residue of a hundred ' +
        'thousand open rows draws an arbitrary prefix as the whole.',
    )
  }
  const nextCursor = body['nextCursor']
  if (nextCursor !== null && typeof nextCursor !== 'string') {
    throw new Error('`listRunResidue` answered with a `nextCursor` that is neither string nor null')
  }
  return { items: body['items'] as readonly ResidueEntry[], nextCursor }
}
