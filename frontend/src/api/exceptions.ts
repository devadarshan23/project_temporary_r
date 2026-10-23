/**
 * THE EXCEPTION REGISTER, READ OVER HTTP — `listExceptions` and
 * `assignException`. G357, 19 Sep 2026.
 *
 * ┌─ 🛑 INVARIANT 1 IS A PROPERTY OF THIS FILE'S SIGNATURES ───────────────────┐
 * │ "Tenant scope is derived from the session, never read from a request."     │
 * │                                                                            │
 * │ THERE IS NO `tenantId` PARAMETER ON ANY FUNCTION HERE AND THERE MUST NEVER │
 * │ BE ONE. The only credential any of them holds is `session`, and the tenant │
 * │ is derived FROM it by the plane.                                           │
 * │                                                                            │
 * │ ⚠️ AND `frontend/src/api/runs.ts` RECORDS WHY THE ABSENT PARAMETER IS NOT  │
 * │ THE CONTROL, which transfers here unchanged: its `endpoint()` once built   │
 * │ a URL by CONCATENATION, so an `origin` carrying `?tenantId=…` produced a   │
 * │ correctly-addressed request with a tenant in the query. **This module      │
 * │ imports that same `endpoint()` rather than writing a second one**, so the  │
 * │ resolution fix and the origin refusal are one implementation and not two.  │
 * │ A second URL builder here would be the shape that got fixed once and       │
 * │ regressed in the copy.                                                     │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ NO BUNDLER, AND THAT IS A CONSTRAINT ON WHAT THIS FILE MAY IMPORT rather
 * than an accident — `runs.ts` states it and it binds here identically. Node
 * strips TypeScript types and does NOT transform JSX, so a client importing a
 * `.tsx`, a stylesheet or anything only Vite resolves would fail to load in a
 * `node --test` process. **Every import below is `import type` or is
 * `runs.ts`.**
 *
 * 🛑 THIS MODULE DECLARES NO VOCABULARY. `Severity` and `ExceptionStatus` are
 * `import type` from `model/domain.ts` — erased before the loader sees them, so
 * this still loads in node with no `model/` resolution at all, while
 * `npm run typecheck:frontend` fails if a status this client can name leaves
 * the model's union. The vocabulary is DERIVED, not transcribed. Same trick
 * `runs.ts` plays with `RunStatus`, and the same reason.
 */

import { PlaneRefused, planeEndpoint, type Read } from './runs.ts'
import type { ExceptionStatus, Severity } from '../../../model/domain.ts'

/**
 * 🛑 G386 — NO CREDENTIAL IS ATTACHED HERE EITHER, AND `const SESSION_HEADER =
 * 'X-Session'` IS DELETED RATHER THAN RENAMED. `runs.ts` carries the whole
 * argument at the same position; this module takes it unchanged rather than
 * restating it, which is the same reason it imports `planeEndpoint()` instead
 * of writing a second URL builder.
 */

/**
 * `capability.openapi.yaml` → `components.schemas.Money`.
 *
 * 🛑 `amountMinor` IS A **STRING** AND A CLIENT THAT CALLS `Number()` ON IT HAS
 *    LOST THE GUARANTEE. G286: *"JSON has no bigint, and a JSON NUMBER would be
 *    read back by every consumer as an IEEE-754 double and silently lose
 *    exactness above 2^53 minor units."* Nothing in this file or in anything
 *    that renders its output may arithmetic on it — it is carried as text and
 *    displayed as text.
 */
export interface Money {
  readonly currency: string
  readonly amountMinor: string
  readonly exponent: number
}

/**
 * `capability.openapi.yaml` → `components.schemas.ExceptionQueueRow`.
 *
 * ⚠️ WHAT IS ABSENT IS THE DESIGN AND MUST STAY ABSENT: no `explanation`, no
 * provenance, no `confidence`. *"A triage decision needs the summary and the
 * columns. The evidence lives one click away, and the click is the point."*
 * A `confidence` here would be a column a register could be SORTED by, and
 * *"a number you can sort a list by is a ranking signal"* that invites bulk
 * approval — which this contract has no operation for and this client must not
 * make constructible.
 */
export interface ExceptionRow {
  readonly exceptionId: string
  readonly domain: string
  readonly definitionId: string
  readonly ruleLabel: string
  readonly severity: Severity
  readonly severityRank: number
  readonly valueAtRisk: Money | null
  readonly costCentre: string | null
  readonly legalEntity: string | null
  readonly status: ExceptionStatus
  readonly assignedTo: string | null
  /** C3-05 / G3886 — the assignee's display name: `null` when the plane may not name them (`0520`). */
  readonly assignedToName: string | null
  /** G4021 — true iff the assignee held a membership here and holds no live one (a former member); never a name. */
  readonly assignedToFormerMember: boolean
  readonly raisedAt: string
  readonly summary: string | null
  readonly carriedForwardFrom: string | null
  /**
   * G3622 — the run that RAISED this line (`db/migrations/0480`). `null` is
   * NOT RECORDED (a row stored before the column existed), never "no run".
   */
  readonly runId: string | null
  /**
   * G3542 — the line's signed money variance (`Explanation.delta.absolute` when
   * the delta is `money`). REQUIRED AND NULLABLE: `null` is "no money variance
   * on this line", which includes a delta taken across currencies — refused by
   * the plane, because there is no FX here and the register totals the column.
   */
  readonly variance: Money | null
}

/**
 * `capability.openapi.yaml` → `components.schemas.Explanation`, as much of it
 * as anything here reads.
 *
 * 🛑 `confidence` IS READ AND IS NOT A COLUMN, WHICH IS THE WHOLE POINT OF THE
 * SPLIT. The contract serves it on THIS operation and on no other, and its
 * reasoning is the difference between a ranking signal and provenance:
 * *"a number you can sort a list by is a ranking signal"*, and the same number
 * *"rendered against the evidence it was computed over is provenance."* So it
 * is typed here, on the DETAIL, and there is deliberately no field for it on
 * `ExceptionRow` above.
 *
 * ⚠️ `null` MEANS NOT APPLICABLE AND NEVER UNKNOWN — *"a client that renders
 * null as 0% has inverted the meaning of the most trustworthy path in the
 * product."* Whatever renders this must say the word, not the number.
 *
 * ⚠️ `observed` IS TYPED AS AN OPAQUE COUNT-BEARING ARRAY AND NOT AS
 * `ObservedValue`. That schema carries a `FieldPath`, an `ExtractedScalar`
 * union and a `Provenance` with a page and a bounding box, and NOTHING IN THIS
 * REPOSITORY DRAWS AN EVIDENCE PANEL — transcribing the shape here would
 * declare a vocabulary no surface consumes, which is the drift
 * `model/domain.ts`'s own `import type` discipline exists to refuse. When the
 * panel is drawn it types what it draws.
 */
export interface Explanation {
  readonly summary: string | null
  readonly expected: string
  readonly observed: readonly unknown[]
  readonly confidence: number | null
}

/**
 * `capability.openapi.yaml` → `components.schemas.Exception`, narrowed to what
 * a surface in this repository can honestly draw.
 *
 * 🛑 THIS IS NOT THE WHOLE SCHEMA AND THE ABSENCES ARE DECLARED RATHER THAN
 * OMITTED. `matchGroupId`, `ruleId`, `ruleVersion`, `definitionVersion`,
 * `lineKey`, `resolution` and `reversals` are all on the wire and none is read:
 * `resolution` is always `null` here because **nothing in this repository can
 * produce one** — G359 refuses to mount `reverseResolution` on exactly that
 * ground — and a client that declared the field would invite a surface to draw
 * a disposition history that is structurally empty.
 */
export interface ExceptionDetail {
  readonly exceptionId: string
  readonly domain: string
  readonly definitionId: string
  readonly ruleLabel: string
  readonly severity: Severity
  readonly severityRank: number
  readonly valueAtRisk: Money | null
  readonly costCentre: string | null
  readonly legalEntity: string | null
  readonly status: ExceptionStatus
  readonly assignedTo: string | null
  /** C3-05 / G3886 — the assignee's display name: `null` when the plane may not name them (`0520`). */
  readonly assignedToName: string | null
  /** G4021 — true iff the assignee held a membership here and holds no live one (a former member); never a name. */
  readonly assignedToFormerMember: boolean
  readonly raisedAt: string
  readonly explanation: Explanation
  /**
   * C3-11 (G3851) — read for ONE fact: when the resolution was posted, which
   * decides whether Reopen is still inside the plane's reversal window. The
   * rest of `ExceptionResolution` is not read here.
   */
  readonly resolution?: { readonly at: string } | null
}

/** `listExceptions`'s 200 body, exactly: `required: [items, nextCursor, estimatedTotal]`. */
export interface ExceptionPage {
  readonly items: readonly ExceptionRow[]
  readonly nextCursor: string | null
  /**
   * ⚠️ ALWAYS `null` TODAY, AND THE CLIENT MUST NOT RENDER IT AS ZERO.
   * *"APPROXIMATE, and null when it cannot be estimated cheaply."* The plane
   * returns null because the cheap estimate counts rows the session cannot see.
   * `null` means *"not known"*; `0` would mean *"none"*, and a register that
   * said "0 exceptions" over a page of rows is worse than one that says
   * nothing.
   */
  readonly estimatedTotal: number | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * One request, and every call in this module goes through it — and, since
 * 2 Oct 2026 (G2876), every call in `api/sources.ts` too, which IMPORTS it
 * rather than writing a third request function beside this one and `runs.ts`'s.
 *
 * ⚠️ `redirect: 'error'` — MEASURED, NOT REASONED, AND THE MEASUREMENT IS IN
 *    `runs.ts`. Per Fetch, only `Authorization`, `Cookie` and
 *    `Proxy-Authorization` are stripped across an origin change; a CUSTOM
 *    header SURVIVES, in node and in a browser alike — and `X-Session` is a
 *    custom header by the contract's own choice of `apiKey`/`in: header`. Two
 *    loopback servers proved it: A answered `302` to B, and **B logged
 *    `x-session: LIVE`**. An allowlist that a hop can leave is not an
 *    allowlist.
 *
 * 🛑 AND `fetch` IS REACHED THROUGH THE GLOBAL, NOT THROUGH AN INJECTED
 *    PARAMETER. A `fetchImpl` option is the obvious testability affordance and
 *    it is refused for `runs.ts`'s reason: it would let this client behave one
 *    way under test and another in a browser, and the assertion that measures
 *    invariant 1 on the wire would then be measuring the test's path instead of
 *    the product's.
 */
export async function call(url: URL, init: { method: string; body?: unknown }): Promise<unknown> {
  const payload = init.body === undefined ? undefined : JSON.stringify(init.body)
  const response = await fetch(url, {
    method: init.method,
    redirect: 'error',
    /* 🛑 G386. See `runs.ts`: `'same-origin'`, never `'include'`.
     *
     * ⚠️ AND THIS MODULE IS WHERE THE CSRF QUESTION IS LIVE, BECAUSE
     * `assignException` IS A **`PUT`** — the first write either plane serves.
     * `SameSite=Lax` attaches the cookie only to a top-level navigation with a
     * SAFE method, so a cross-site `PUT` carries no credential and is answered
     * 401; `server/data-plane/session-cookie.ts` states exactly what that does
     * and does not buy, including the case it does NOT cover. Do not read
     * `Lax` as an anti-CSRF token. */
    credentials: 'same-origin',
    headers: {
      accept: 'application/json',
      ...(payload === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(payload === undefined ? {} : { body: payload }),
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
    /* ⚠️ THE STATUS AND THE CLOSED `code`, NEVER THE PLANE'S `detail`.
       `errors.yaml` requires `detail` to carry no field values, record contents
       or customer-authored strings, and a client that put it in front of a user
       would be the one place that rule is not held. */
    throw new PlaneRefused(
      response.status,
      typeof problem['code'] === 'string' ? problem['code'] : undefined,
      typeof problem['title'] === 'string' ? problem['title'] : '(no title)',
      typeof problem['detail'] === 'string' ? problem['detail'] : undefined,
    )
  }
  return parsed
}

/**
 * 🛑 THE CHECKS BELOW REFUSE; THEY NEVER REPAIR, which is the difference
 * between this function and the one-liner every convenience helper writes.
 *
 * `items: body.items ?? []` and `nextCursor: body.nextCursor ?? null` are the
 * idiomatic spelling and both are FABRICATIONS: the first turns a malformed
 * response into an EMPTY REGISTER — which, on the surface a period is closed
 * on, reads as *"nothing needs deciding"* — and the second turns a page that
 * has a successor into one that claims it is the end.
 */
function asExceptionPage(body: unknown): ExceptionPage {
  if (!isRecord(body)) throw new Error('`listExceptions` did not answer with a JSON object')
  if (!Array.isArray(body['items'])) {
    throw new Error(
      '`listExceptions` answered without an `items` array. It is `required` on the 200 body, ' +
        'and defaulting the absence to `[]` would render an empty register for a tenant that ' +
        'has exceptions — which on this surface reads as a clean close.',
    )
  }
  if (!('nextCursor' in body)) {
    throw new Error(
      '`listExceptions` answered without `nextCursor`. It is `required`, and defaulting it ' +
        'to `null` would claim every page is the last one.',
    )
  }
  if (!('estimatedTotal' in body)) {
    throw new Error(
      '`listExceptions` answered without `estimatedTotal`. It is `required` and it is ' +
        'allowed to be null; an ABSENT key and a null are different facts and only one of ' +
        'them is the contract.',
    )
  }
  const nextCursor = body['nextCursor']
  if (nextCursor !== null && typeof nextCursor !== 'string') {
    throw new Error('`listExceptions` answered with a `nextCursor` that is neither string nor null')
  }
  const estimatedTotal = body['estimatedTotal']
  if (estimatedTotal !== null && typeof estimatedTotal !== 'number') {
    throw new Error('`listExceptions` answered with an `estimatedTotal` that is neither a number nor null')
  }
  return { items: body['items'] as readonly ExceptionRow[], nextCursor, estimatedTotal }
}

/**
 * `GET /v1/exceptions` — the queue. The product's home screen.
 *
 * ⚠️ NO `sort` AND NO `limit` ARE SENT. Both carry a `default:` in the
 * contract and `useDefaults` is on in the plane's ajv, so a client restating
 * either is a second place for it to drift — the same reason `fetchRuns()`
 * declines to send `limit`. The default IS the journey's stated default:
 * severity rank, then value at risk.
 */
export async function fetchExceptions(
  o: Read & {
    readonly cursor?: string
    readonly status?: readonly ExceptionStatus[]
    readonly sort?: ExceptionSort
  } & ExceptionScope,
): Promise<ExceptionPage> {
  const url = planeEndpoint(o.origin, '/exceptions')
  if (o.cursor !== undefined) url.searchParams.set('cursor', o.cursor)
  for (const s of o.status ?? []) url.searchParams.append('status', s)
  if (o.sort !== undefined) url.searchParams.set('sort', o.sort)
  scopeInto(url, o)
  return asExceptionPage(await call(url, { method: 'GET' }))
}

/**
 * The four orders `listExceptions` declares, in the contract's own order —
 * `docs/contracts/capability.openapi.yaml`, the `sort` parameter's `enum`. The
 * register's ORDER BY segmented control is these four and no fifth, because an
 * order the plane does not declare would be a client-side sort of ONE PAGE
 * drawn as an order of the whole list.
 */
export const EXCEPTION_SORTS = [
  'severity_then_value',
  'value_at_risk_desc',
  'raised_at_desc',
  'raised_at_asc',
] as const
export type ExceptionSort = (typeof EXCEPTION_SORTS)[number]

/**
 * G3424 — the two narrowings the Close screen needs, spelled with the
 * contract's own terms on BOTH `listExceptions` and `getExceptionFacets`, so a
 * count beside the register is a count OF that register (RC-03).
 *
 *   · `definitionId` — the reconciliation the screen is showing;
 *   · `mineOrUnassigned` — *"needs you"*: open rows unassigned or assigned to
 *     the acting person. A BOOLEAN: the plane reads WHO from the session, so a
 *     client cannot ask what needs somebody else.
 */
export interface ExceptionScope {
  readonly definitionId?: string | null
  /**
   * G3622 — the run the screen is showing (the owner's G3621: *"the register,
   * counts and 'Needs you' can scope to the selected run"*). A line whose run
   * is not recorded is outside every run-scoped answer.
   */
  readonly runId?: string | null
  readonly mineOrUnassigned?: boolean
}

function scopeInto(url: URL, o: ExceptionScope): void {
  if (o.definitionId !== undefined && o.definitionId !== null) url.searchParams.append('definitionId', o.definitionId)
  if (o.runId !== undefined && o.runId !== null) url.searchParams.append('runId', o.runId)
  if (o.mineOrUnassigned === true) url.searchParams.set('mineOrUnassigned', 'true')
}

/** One facet bucket — `FacetCount` on the wire. */
export interface FacetCount {
  readonly value: string
  readonly label: string
  readonly count: number
}

/**
 * `GET /v1/exceptions/facets` — the counts behind the register's SHOW control
 * and the chrome's "Needs you". The wire splits by domain, definition, rule and
 * severity, never by status, so a status set is asked for as the `status`
 * filter and the count is the SUM OVER SEVERITY — every exception carries
 * exactly one severity, so the sum is the total of that set and nothing is
 * counted twice. Refuses rather than repairs, `asExceptionPage`'s rule.
 */
export async function fetchExceptionCount(
  o: Read & { readonly status?: readonly ExceptionStatus[] } & ExceptionScope,
): Promise<number> {
  const url = planeEndpoint(o.origin, '/exceptions/facets')
  for (const s of o.status ?? []) url.searchParams.append('status', s)
  scopeInto(url, o)
  const body = await call(url, { method: 'GET' })
  if (!isRecord(body) || !Array.isArray(body['severities'])) {
    throw new Error(
      '`getExceptionFacets` answered without a `severities` array. It is `required`, and ' +
        'a missing bucket list summed to zero would draw "nothing needs you" for a tenant ' +
        'whose register is full.',
    )
  }
  let total = 0
  for (const bucket of body['severities'] as readonly unknown[]) {
    if (!isRecord(bucket) || typeof bucket['count'] !== 'number') {
      throw new Error('`getExceptionFacets` answered with a severity bucket carrying no count')
    }
    total += bucket['count']
  }
  return total
}

/**
 * `GET /v1/exceptions/{exceptionId}` — one finding, with the explanation that
 * justifies it. G486, 19 Sep 2026, for the `/close/finding/:ref` route.
 *
 * 🛑 THE CHECKS REFUSE AND NEVER REPAIR, WHICH IS `asExceptionPage`'s RULE
 * ARRIVING ON A SINGLE READ. `explanation` is `required` on the 200 body, and
 * PRODUCT.md Principle 1 is why: *"an exception without its explanation has
 * lost the product's point."* Defaulting an absent one to an empty summary
 * would draw a finding with no reason beside it — which is the screen the whole
 * product exists to refuse — so the absence throws.
 *
 * 🛑 `exceptionId` IS PATH-ENCODED, for `assignException`'s reason verbatim: an
 * id containing a `/` or a `?` would re-address the request, and **G97 puts no
 * format constraint on a branded id in the database**.
 *
 * ⚠️ A 404 IS NOT CAUGHT HERE. A cross-tenant id and an id nobody seeded answer
 * identically — invariant 1's own disclosure rule, *"a 403 would confirm the
 * row exists"* — so this client must not turn either into a distinguishable
 * state. `PlaneRefused` carries the status and the caller decides.
 */
export async function fetchException(
  o: Read & { readonly exceptionId: string },
): Promise<ExceptionDetail> {
  const url = planeEndpoint(o.origin, `/exceptions/${encodeURIComponent(o.exceptionId)}`)
  const body = await call(url, { method: 'GET' })
  if (!isRecord(body) || typeof body['exceptionId'] !== 'string') {
    throw new Error('`getException` did not answer with an `Exception`')
  }
  if (!isRecord(body['explanation'])) {
    throw new Error(
      '`getException` answered without an `explanation` object. It is `required` on the 200 ' +
        'body and non-optional in the model, because PRODUCT.md Principle 1 says an exception ' +
        'without its explanation has lost the product\'s point — so an absence is refused ' +
        'rather than drawn as a finding with no reason beside it.',
    )
  }
  return body as unknown as ExceptionDetail
}

/**
 * `PUT /v1/exceptions/{exceptionId}/assignment` — take a row, or put it down.
 *
 * 🛑 `assignedTo: null` IS A VALUE AND NOT AN OMISSION. *"A PUT rather than a
 * PATCH because the field has exactly two states and an idempotent replace is
 * the honest verb. Assigning to null unassigns."* The parameter is therefore
 * `string | null` and not `string | undefined`, so a caller cannot express
 * "leave it alone" — because this operation has no such mode.
 *
 * 🛑 `exceptionId` IS PATH-ENCODED. It arrives from a row the client itself
 * drew, and encoding it is still not optional: an id containing a `/` or a `?`
 * would re-address the request, and **G97 puts NO format constraint on a
 * branded id in the database** — *"the database enforces no id format"*.
 */
export async function assignException(
  o: Read & { readonly exceptionId: string; readonly assignedTo: string | null },
): Promise<ExceptionDetail> {
  const url = planeEndpoint(o.origin, `/exceptions/${encodeURIComponent(o.exceptionId)}`)
  url.pathname = `${url.pathname}/assignment`
  const body = await call(url, { method: 'PUT', body: { assignedTo: o.assignedTo } })
  if (!isRecord(body) || typeof body['exceptionId'] !== 'string' || !('assignedTo' in body)) {
    throw new Error('`assignException` did not answer with an `Exception`')
  }
  /* 🛑 RC-05 — THE 200 IS AN `Exception`, NOT A QUEUE ROW. It carries no
     `summary`, so casting it to `ExceptionRow` and swapping it into the list
     erased the row's line text on every Take and Release. Typed as what it is;
     `mergeAssignment()` takes the two fields the act changed. */
  return body as unknown as ExceptionDetail
}

/**
 * The register row after an assignment: the row as it was, with the two fields
 * the plane says it now holds. RC-05. Every other field — the line text, the
 * value, the severity — is the queue's and is kept.
 */
export function mergeAssignment(row: ExceptionRow, written: Pick<ExceptionDetail, 'assignedTo' | 'status'>): ExceptionRow {
  /* G3886 — the assignment write answers an id and no name, so a name read for
     the PREVIOUS holder must not survive onto the new one; `null` until the
     next read is "a colleague" (or "you"), never the wrong person. */
  const same = written.assignedTo === row.assignedTo
  const assignedToName = same ? row.assignedToName : null
  /* G4021 — the plane refuses an assignee who is not a LIVE member (G3426), so
     a changed holder is never a former member; an unchanged one keeps the fact. */
  const assignedToFormerMember = same ? row.assignedToFormerMember : false
  return { ...row, assignedTo: written.assignedTo, assignedToName, assignedToFormerMember, status: written.status }
}

/**
 * THE LINE A PERSON READS FOR ONE FINDING — G3748, 4 Oct 2026, applying R-D
 * (the owner's): *"Store typed facts only … the sentence is composed where it
 * is displayed."* This is the display.
 *
 * An exception the ENGINE raises stores no sentence (`db/migrations/0500` §2),
 * so `summary` is `null` on the wire and the line is the row's declared RULE
 * LABEL — the operator's own words for what broke (`MatchRule.label`), never a
 * sentence this repository authored and never counterparty text it did not
 * already carry. A stored summary is still shown verbatim, as a text child
 * (invariant 6). ⚠️ NO PLACEHOLDER: an empty or "no explanation" string would
 * be this client authoring an explanation, which R-D forbids at every layer.
 */
export function findingLine(row: {
  readonly summary: string | null
  readonly ruleLabel: string
}): string {
  return row.summary ?? row.ruleLabel
}
