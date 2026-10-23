/**
 * THE DEMO INTAKE'S GUARDS — S5, 22 Sep 2026. The public marketing plane's one
 * write, and the only unauthenticated POST this product has ever had.
 *
 * 🛑 THIS FILE HOLDS NO AWS SDK IMPORT AND MAKES NO NETWORK CALL, DELIBERATELY.
 * It is the half of the function a test can execute with no credentials and no
 * network, and `tests/infra/demo-intake.test.mjs` witnesses every refusal below
 * RED by calling it. A guard that only ever runs inside a deployed Lambda is a
 * guard nobody has seen work — `docs/HANDOFF.md` §5.6.
 *
 * ┌─ 🛑 THE PROPERTY THIS FILE EXISTS FOR, AND IT IS A NEGATIVE ONE ──────────┐
 * │ **REFERRAL-CODE VALIDITY IS NEVER EVALUATED HERE, SO IT CANNOT LEAK.**    │
 * │                                                                           │
 * │ `referralCode` is carried, length-capped, and passed to the CRM as an     │
 * │ opaque string. **Nothing in this function asks whether it matches a deal  │
 * │ registration**, and that is not an omission — it is where the pack puts   │
 * │ the question: *"Match a deal registration … plane: control, surface:      │
 * │ staff console"*, and the branch beside it, *"No registration matches"*,   │
 * │ resolves by *"1CloudHub sales, by judgement"*.                            │
 * │                                                                           │
 * │ A function that VALIDATED the code and then hid the answer would be one   │
 * │ timing measurement and one error-message edit away from an oracle that    │
 * │ tells a stranger which partners exist and which codes are live. **A       │
 * │ property held by construction beats a property held by a careful          │
 * │ response**, which is the posture invariant 7 takes on model routing and   │
 * │ G297 takes on residency.                                                  │
 * │                                                                           │
 * │ ⚠️ THE SAME SHAPE IS ALREADY IN THE CONTRACT ONE PLANE OVER, and it is    │
 * │ the reason to trust it: `resolveHomeRealm` *"returns NO USER-EXISTENCE    │
 * │ SIGNAL, AND THE PROPERTY IS STRUCTURAL RATHER THAN PROMISED. It is never  │
 * │ GIVEN a user to look up."*                                                │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ AND THE REASON AN UNKNOWN FIELD IS REFUSED RATHER THAN IGNORED is the one
 * `server/http/app.ts` already states about AJV: *"Under the default,
 * `?tenantId=…` against a querystring marked `additionalProperties: false` is
 * silently deleted and the request served — which satisfies invariant 1 and
 * leaves no evidence that it did."* An intake that ignores an extra field
 * accepts it: the sender believes it was recorded and nothing anywhere says no.
 */

/**
 * The closed set of fields an intake may carry, and the longest each may be.
 *
 * ⚠️ IT IS WRITTEN TWICE AND THAT IS NAMED RATHER THAN HIDDEN. The CDK copy —
 * `DEMO_INTAKE_FIELDS` and `DEMO_INTAKE_FIELD_MAX_LENGTH` in
 * `infra/lib/config.ts` — is a `tsc`-checked total `Record`; this copy runs in
 * Lambda's world, and the seam between them is a zip file. Neither can cover
 * the other. What keeps them from drifting is
 * `tests/infra/demo-intake.test.mjs`, which asserts this object's keys and
 * values against the ones in `lib/config.ts` **in both directions** — the shape
 * `tenant-key-minter/guards.mjs` uses for `HANDLE_PATTERN` one function over.
 */
export const INTAKE_FIELDS = {
  name: 120,
  email: 254,
  company: 200,
  reconcilingToday: 2000,
  volume: 120,
  ownAwsAccount: 20,
  referralCode: 64,
}

/** The largest body this function will read. `DEMO_INTAKE_MAX_BODY_BYTES`. */
export const MAX_BODY_BYTES = 8 * 1024

/**
 * A refusal this function can answer with.
 *
 * 🛑 EVERY MEMBER IS ABOUT THE REQUEST'S SHAPE OR ABOUT OUR OWN PLUMBING, AND
 * NOT ONE IS ABOUT A VALUE. There is no `referral_code_unknown`, there is no
 * `company_not_found`, and there must never be one: the moment a refusal is
 * keyed on what a field CONTAINS, this endpoint becomes a lookup service for
 * whatever that field names.
 *
 * 🛑 **AND NOT ONE IS ABOUT THE CRM's ANSWER, WHICH IS A STRICTLY STRONGER
 * CLAIM AND IS THE ONE S5's FIRST DRAFT DID NOT HOLD — G2001.** That draft's
 * refusal set passed the sentence above and leaked anyway: it had no code
 * NAMING a value, and `crm_unavailable` carried the CRM's own accept/reject
 * bit to the wire, so a stranger read referral-code validity out of a
 * SHAPE-named code. **A refusal's NAME is not where this property lives; what
 * it VARIES WITH is.** Since G3681 (3 Oct 2026) the request path never
 * reaches the CRM at all: `index.mjs`'s `answer()` enqueues, and the CRM is
 * `worker.mjs`'s.
 */
export class IntakeRefusal extends Error {
  /**
   * @param {string} code
   * @param {number} status
   * @param {string} [detail]
   */
  constructor(code, status, detail) {
    super(detail === undefined ? code : `${code}: ${detail}`)
    this.name = 'IntakeRefusal'
    this.code = code
    this.status = status
  }
}

/**
 * Read the HTTP method out of a Lambda Function URL event (payload 2.0).
 *
 * ⚠️ POST AND NOTHING ELSE. A `GET /demo/intake` that answered anything but a
 * refusal would make the endpoint reachable from a link, an image tag and a
 * prefetch — and every one of those is a lead nobody typed.
 *
 * 🛑 **AND THE COMPARISON IS EXACT — G1980, 22 Sep 2026. THIS RETURNED
 * `method.toUpperCase()`, SO `post` WAS ACCEPTED AS A `POST`.** HTTP methods
 * are case-SENSITIVE, so the endpoint admitted a request no compliant
 * intermediary would call a POST — and the cost of that leniency is that this
 * function's idea of *is this a POST* sits one character away from disagreeing
 * with every proxy, log parser and WAF rule in front of it. **It bypassed
 * nothing**, because the same branch was taken either way; it is narrowed
 * because narrowing is free and fails closed.
 */
export function readMethod(event) {
  const method = event?.requestContext?.http?.method
  if (typeof method !== 'string') throw new IntakeRefusal('intake_malformed', 400, 'no method')
  return method
}

/**
 * The one media type an intake may arrive as.
 *
 * ┌─ 🛑 THIS IS A CORS CONTROL AND IT IS THE ONLY ONE THIS ENDPOINT HAS ──────┐
 * │ **G2002, 22 Sep 2026 — and it replaces a FALSE security property.**       │
 * │                                                                           │
 * │ `lib/amplify-stack.ts` argued that no CORS configuration was needed       │
 * │ because *"the only caller is same-origin with the apex and therefore      │
 * │ makes no preflight at all."* **That misreads what CORS is.** CORS gates   │
 * │ READING A RESPONSE, not sending a request. A `POST` whose `Content-Type`  │
 * │ is `text/plain`, `application/x-www-form-urlencoded` or                   │
 * │ `multipart/form-data` is a CORS **simple request**: the browser sends it  │
 * │ cross-origin with NO preflight and blocks only the reply — and a          │
 * │ write-only endpoint does not need the reply. So                           │
 * │ `fetch(url, {method:'POST', mode:'no-cors', body:'…'})` from any page in  │
 * │ the world reached this function, and so did a plain cross-origin          │
 * │ `<form>`. Every visitor to an attacker's page was a lead-injection bot.   │
 * │                                                                           │
 * │ **`application/json` is NOT a safelisted `Content-Type` value**, so       │
 * │ requiring it makes every cross-origin attempt a PREFLIGHTED request. The  │
 * │ Function URL carries no CORS configuration — which is now load-bearing    │
 * │ rather than decorative — so the preflight `OPTIONS` is answered by this   │
 * │ handler with `intake_method_not_allowed` and **no**                       │
 * │ `Access-Control-Allow-Origin`, and the browser refuses to send the POST.  │
 * │                                                                           │
 * │ ⚠️ THE SAME-ORIGIN CALLER PAYS NOTHING: a same-origin request is not a    │
 * │ CORS request and never preflights, whatever its media type.               │
 * │                                                                           │
 * │ ⚠️ AND IT IS A BROWSER CONTROL AND NOT AN AUTHENTICATION. `curl` sets     │
 * │ whatever header it likes and always could; what this closes is the        │
 * │ AMBIENT case — somebody else's visitor, unknowingly. The remaining        │
 * │ exposure is a scripted flood, which is G1975's and is bounded by          │
 * │ reserved concurrency alone.                                               │
 * └───────────────────────────────────────────────────────────────────────────┘
 */
export const REQUIRED_CONTENT_TYPE = 'application/json'

/**
 * Refuse an intake whose media type is not `application/json`.
 *
 * ⚠️ THE PARAMETERS ARE IGNORED AND THE TYPE IS COMPARED CASE-INSENSITIVELY.
 * `application/json; charset=utf-8` is what a real client sends; `APPLICATION/
 * JSON` is what a lazy one sends. Neither is an attack, and refusing them
 * would make this fence look like a parser bug and invite its deletion.
 */
export function readContentType(event) {
  const headers = event?.headers
  /* Lambda Function URL payload 2.0 lower-cases every header name, but this
   * function is also reachable through Amplify's proxy and through a test, so
   * the lookup does not trust the casing it is handed. */
  const raw =
    headers && typeof headers === 'object'
      ? Object.entries(headers).find(([name]) => String(name).toLowerCase() === 'content-type')?.[1]
      : undefined
  const media = typeof raw === 'string' ? raw.split(';')[0].trim().toLowerCase() : ''
  if (media !== REQUIRED_CONTENT_TYPE) {
    /* The refusal names what was required and NOT what arrived: the value is a
     * stranger's string and this message reaches our own log line. */
    throw new IntakeRefusal(
      'intake_content_type_not_allowed',
      415,
      `content-type must be ${REQUIRED_CONTENT_TYPE}`,
    )
  }
  return media
}

/**
 * The raw body, decoded, with the size cap applied BEFORE the JSON parse.
 *
 * 🛑 THE ORDER IS THE POINT. `JSON.parse` on an eight-megabyte string is the
 * denial of service, not the eight-megabyte string. The cap is measured in
 * BYTES rather than characters, because a body is bytes on the wire and a
 * multi-byte character would otherwise buy four times the budget.
 */
export function readBody(event) {
  const raw = event?.body
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new IntakeRefusal('intake_malformed', 400, 'empty body')
  }
  const decoded = event?.isBase64Encoded === true ? Buffer.from(raw, 'base64') : Buffer.from(raw, 'utf8')
  if (decoded.byteLength > MAX_BODY_BYTES) {
    throw new IntakeRefusal('intake_too_large', 413, `${decoded.byteLength} bytes`)
  }
  return decoded.toString('utf8')
}

/**
 * Parse and narrow an intake body to the closed field set.
 *
 * ⚠️ EVERY FIELD IS OPTIONAL AND NONE IS REQUIRED, WHICH IS DELIBERATE AND IS
 * NOT LAXITY. The pack's `V2` form asks for *"name, company, and what they are
 * reconciling today"* and then qualifies further; **which of those the marketing
 * site makes mandatory is the marketing site's decision, and it does not
 * exist.** A required field invented here would be this function refusing a
 * form nobody has drawn. What IS enforced is that nothing outside the set
 * arrives and that nothing is longer than its cap — the two properties that are
 * about this function rather than about a page.
 *
 * ⚠️ AND AN EMPTY OBJECT IS REFUSED, because a body carrying nothing at all is
 * a lead with no lead in it and delivering one would fill the CRM with rows a
 * human has to read before discarding.
 */
export function readIntake(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new IntakeRefusal('intake_malformed', 400, 'not JSON')
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new IntakeRefusal('intake_malformed', 400, 'not an object')
  }

  const unknown = Object.keys(parsed).filter((key) => !Object.hasOwn(INTAKE_FIELDS, key))
  if (unknown.length > 0) {
    throw new IntakeRefusal('intake_unknown_field', 400, unknown.join(', '))
  }

  /** @type {Record<string, string>} */
  const intake = {}
  for (const [field, limit] of Object.entries(INTAKE_FIELDS)) {
    if (!Object.hasOwn(parsed, field)) continue
    const value = parsed[field]
    if (typeof value !== 'string') {
      throw new IntakeRefusal('intake_field_not_a_string', 400, field)
    }
    if (value.length > limit) {
      /* The refusal names the FIELD and the LIMIT and never the value. A
       * message that echoed the value would put a stranger's text into our own
       * log line, which is invariant 6's neighbourhood wearing a 400. */
      throw new IntakeRefusal('intake_field_too_long', 400, `${field} > ${limit}`)
    }
    const trimmed = value.trim()
    if (trimmed.length > 0) intake[field] = trimmed
  }

  if (Object.keys(intake).length === 0) {
    throw new IntakeRefusal('intake_empty', 400, 'no fields')
  }
  return intake
}

/**
 * The shape a CRM service token must have — RFC 6750's `b64token`.
 *
 * ┌─ 🛑 G3732, 4 Oct 2026: THE AUTH HEADER IS FIXED AND ONLY THE TOKEN IS ────┐
 * │    CONFIGURATION, BECAUSE THE CRM IS NAMED NOW.                           │
 * │                                                                           │
 * │ Until this commit the secret carried `authHeaderName` and                 │
 * │ `authHeaderValue`, and a `REFUSED_HEADER_NAMES` deny-list (`host`,        │
 * │ `content-length`, `transfer-encoding`, `te`, `trailer`, `cookie`, G2003)  │
 * │ fenced what configuration could name — because *"nothing in this          │
 * │ repository has ever named a CRM, so choosing `Bearer` over `x-api-key`    │
 * │ here would be this slice inventing a protocol."* **The owner named one    │
 * │ on 4 Oct 2026** (PipelinePulse), and its own contract declares exactly    │
 * │ one scheme: `BearerTokenAuth`, `http`/`bearer`. So the header is          │
 * │ `Authorization: Bearer <token>`, written here, and the secret is          │
 * │ `{endpoint, token}`.                                                      │
 * │                                                                           │
 * │ ⚠️ THE DENY-LIST IS DELETED RATHER THAN KEPT, AND THAT IS NOT A           │
 * │ WEAKENING: it fenced a header NAME configuration could choose, and        │
 * │ configuration chooses no name any more — a `Host` or a `Transfer-         │
 * │ Encoding` is now unwritable rather than refused. The list and G2003's     │
 * │ argument are in the history of this file before G3732.                    │
 * │                                                                           │
 * │ 🛑 G2003's VALUE HALF IS KEPT AND NARROWED: the old rule refused C0 and   │
 * │ DEL in a value; a `b64token` admits no space, no control character and    │
 * │ no colon at all, so header injection is unwritable through the token.     │
 * │ And a token pasted WITH its scheme (`Bearer abc…`) is refused by the      │
 * │ same rule — the space — rather than sent as `Bearer Bearer abc…` and      │
 * │ answered 401 by a CRM nobody is watching.                                 │
 * └───────────────────────────────────────────────────────────────────────────┘
 */
export const BEARER_TOKEN_PATTERN = /^[A-Za-z0-9\-._~+/]+=*$/

/**
 * THE ONE ORIGIN AN INTAKE MAY EVER BE DELIVERED TO.
 *
 * ┌─ 🛑 THE OWNER'S RULING, 4 Oct 2026 — G3861, CLOSING G3735 ────────────────┐
 * │                                                                           │
 * │   "Pin the host: the worker refuses any endpoint not on                   │
 * │    https://api.1chpipelinepulse.com; changing CRM becomes a code change." │
 * │                                                                           │
 * │ The secret still carries the endpoint — its PATH is configuration — but   │
 * │ its ORIGIN (scheme, host, port) is this constant, and a secret naming any │
 * │ other origin is refused `crm_endpoint_not_pinned` and NEVER CALLED.       │
 * │ Changing CRM is now an edit here, reviewed, rather than a                 │
 * │ `put-secret-value` nobody reviews.                                        │
 * │                                                                           │
 * │ ⛔ THE DENY-LIST THIS REPLACES IS DELETED, NOT KEPT BESIDE IT — G2004's   │
 * │ `REFUSED_ENDPOINT_HOSTS`, `REFUSED_ENDPOINT_HOST_SUFFIXES` and            │
 * │ `endpointHostIsReachable()`. It said of itself: *"IT IS A DENY-LIST AND A │
 * │ DENY-LIST IS THE WEAKER SHAPE … An allow-list of CRM hostnames is the     │
 * │ correct control and this repository cannot write one"* because no CRM was │
 * │ named. One is named (G3731) and the owner has now ruled the pin, so the   │
 * │ allow-list is strictly stronger: every name the deny-list refused is a    │
 * │ name the pin refuses, and the pin refuses every OTHER public name too.    │
 * │ Kept beside the pin it could refuse nothing the pin admits — a second     │
 * │ rule with no reachable arm. Retrieve it at the commit before G3861.       │
 * │                                                                           │
 * │ ⚠️ WHAT THE PIN DOES NOT CLOSE, SAID RATHER THAN IMPLIED: it fixes the    │
 * │ NAME, not the address. If `api.1chpipelinepulse.com` itself resolved      │
 * │ inward, this would still deliver there — the residual G2004 named for     │
 * │ EVERY public name is now a residual for ONE name, operated by the vendor  │
 * │ the owner chose. Resolution-time pinning is still not built.              │
 * └───────────────────────────────────────────────────────────────────────────┘
 */
export const CRM_PINNED_ORIGIN = 'https://api.1chpipelinepulse.com'

/**
 * Whether `endpoint` is on `CRM_PINNED_ORIGIN` — compared as a parsed ORIGIN,
 * never as a string prefix: `https://api.1chpipelinepulse.com.evil.example/`
 * and `https://api.1chpipelinepulse.com@evil.example/` both START WITH the
 * pinned text and neither is on it. A URL carrying userinfo is refused
 * outright, and a non-default port is a different origin.
 *
 * @param {string | URL} endpoint
 * @returns {boolean}
 */
export function endpointIsPinned(endpoint) {
  let url
  try {
    url = endpoint instanceof URL ? endpoint : new URL(String(endpoint))
  } catch {
    return false
  }
  if (url.username !== '' || url.password !== '') return false
  return url.origin === CRM_PINNED_ORIGIN
}

/**
 * Read the CRM's endpoint and service token out of the secret's JSON value —
 * `{"endpoint": "https://…", "token": "…"}` since G3732.
 *
 * ⚠️ AN UNCONFIGURED SECRET IS A DISTINCT, LOUD REFUSAL AND NOT A SILENT
 * SUCCESS. `crmLeadIntakeSecretName()` in `lib/config.ts` creates the secret
 * with `endpoint` EMPTY, so a freshly deployed stack answers `crm_not_configured`
 * on every intake until a person runs one `put-secret-value`. **A form that
 * thanks a visitor and reaches nobody is the failure the pack already names as
 * `V2`'s bad exit** — *"or a form submission that reaches nobody"* — so it is
 * made loud here instead of being allowed to happen quietly.
 */
export function readCrmConfig(secretText) {
  let parsed
  try {
    parsed = JSON.parse(String(secretText))
  } catch {
    throw new IntakeRefusal('crm_not_configured', 502, 'secret is not JSON')
  }
  const endpoint = typeof parsed?.endpoint === 'string' ? parsed.endpoint.trim() : ''
  if (endpoint === '') {
    throw new IntakeRefusal('crm_not_configured', 502, 'endpoint is empty')
  }
  let url
  try {
    url = new URL(endpoint)
  } catch {
    throw new IntakeRefusal('crm_not_configured', 502, 'endpoint is not a URL')
  }
  if (url.protocol !== 'https:') {
    /* A lead carries a person's name, their employer and their work email.
     * `db/tls-everywhere` takes the same position one layer down for
     * PostgreSQL, and `enforceSSL` takes it for SQS. */
    throw new IntakeRefusal('crm_not_configured', 502, 'endpoint is not https')
  }
  if (!endpointIsPinned(url)) {
    /* G3861 — the owner's pin. A DISTINCT code, so an operator reading the
     * log knows the secret names the wrong CRM rather than none at all. The
     * refusal names the pinned origin and never the configured one, which is
     * whatever somebody pasted. */
    throw new IntakeRefusal('crm_endpoint_not_pinned', 502, `endpoint is not on ${CRM_PINNED_ORIGIN}`)
  }

  /* 🛑 THE TOKEN IS REQUIRED AND AN EMPTY ONE IS ITS OWN LOUD REFUSAL —
   * G3732. The owner's ruling puts a long-lived service token in this
   * secret; until somebody on the CRM side issues one, every lead is a
   * `crm_not_configured` retry and then a dead letter, never a call the CRM
   * answers 401 to. */
  const token = typeof parsed?.token === 'string' ? parsed.token.trim() : ''
  if (token === '') {
    throw new IntakeRefusal('crm_not_configured', 502, 'token is empty')
  }
  if (!BEARER_TOKEN_PATTERN.test(token)) {
    /* The refusal names the RULE and never the value: it is a credential. */
    throw new IntakeRefusal('crm_not_configured', 502, 'token is not a bearer token (b64token)')
  }
  const headerName = 'authorization'
  const headerValue = `Bearer ${token}`
  return { endpoint: url.toString(), headerName, headerValue }
}

/**
 * The ONE successful answer this function has.
 *
 * 🛑 IT IS A CONSTANT AND IT TAKES NO ARGUMENT — and **that was never the
 * enforcement this file claimed it was.** The first draft of S5 said so in
 * these words: *"there is no parameter here a referral code, a company name or
 * a CRM response could reach, so 'the answer does not vary with the input' is a
 * fact about the signature."* **A constant cannot make a claim about the
 * answer, because the answer is the choice of WHETHER TO RETURN IT** — and the
 * first draft made that choice by asking the CRM. G2001 made `deliver()` reach
 * it unconditionally; since G3681 `index.mjs`'s `answer()` reaches it with no
 * CRM in scope at all.
 */
export const ACCEPTED = Object.freeze({
  statusCode: 202,
  headers: Object.freeze({ 'content-type': 'application/json', 'cache-control': 'no-store' }),
  body: '{"status":"received"}',
})

/**
 * The one code every 5xx wears on the wire.
 *
 * 🛑 **A REFUSAL ABOUT OUR OWN PLUMBING DOES NOT NAME WHICH PART — G2005.**
 * `crm_not_configured` and `crm_unavailable` were distinguishable from outside,
 * which told a stranger whether this environment had ever been configured and
 * whether its CRM was up. Neither is a fact about the caller and neither is
 * theirs. **The distinction is not lost, it is MOVED**: the internal code and
 * the `detail` both go to the log, where an operator reads them and a metric
 * filter counts them.
 *
 * ⚠️ IT IS KEYED ON THE STATUS AND NOT ON A LIST OF CODE NAMES, so a plumbing
 * refusal added later is collapsed without anybody remembering to add it —
 * `docs/HANDOFF.md` §5.1 the right way round.
 */
export const INTERNAL_FAILURE_WIRE_CODE = 'intake_unavailable'

/**
 * Render a refusal.
 *
 * ⚠️ THE `detail` NEVER REACHES THE CALLER. It is written to the function's own
 * log, where an operator can read it, and the body carries the CODE alone —
 * `errors.yaml`'s closed-enum posture, arriving at a plane that has no contract.
 *
 * ⚠️ AND A 5xx CARRIES `INTERNAL_FAILURE_WIRE_CODE` RATHER THAN ITS OWN NAME.
 * A 4xx keeps its code, because a 4xx is about the REQUEST and telling the
 * sender what was wrong with their own request is the point of one.
 */
export function refusalResponse(refusal) {
  return {
    statusCode: refusal.status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify({ code: refusal.status >= 500 ? INTERNAL_FAILURE_WIRE_CODE : refusal.code }),
  }
}

/**
 * The token every CRM delivery failure is logged with, and the metric filter's
 * only join to this file.
 *
 * ┌─ 🛑 THE FAILURE PATH IS INVISIBLE TO EVERY GENERIC ALARM — G2006 ─────────┐
 * │ ⚠️ SINCE G3681 THE TOKEN IS WRITTEN BY `worker.mjs`, NOT THE INTAKE.      │
 * │ `handler()` CATCHES, so Lambda records a SUCCESSFUL invocation and        │
 * │ `AWS/Lambda Errors` reads **0** while every lead on earth is being        │
 * │ dropped. G2001 makes that strictly worse rather than better: the visitor  │
 * │ is now told `received` as well. **So the delivery outcome has to mint a   │
 * │ metric of its own or it is observable nowhere** — which is what G1976     │
 * │ named and did not build.                                                  │
 * │                                                                           │
 * │ ⚠️ IT IS WRITTEN TWICE, HERE AND IN `lib/config.ts`, AND THE SEAM IS A    │
 * │ ZIP FILE — the same seam `INTAKE_FIELDS` has, answered the same way:      │
 * │ `tests/infra/demo-intake.test.mjs` joins the two copies in both           │
 * │ directions, so a token edited on one side is a red gate rather than a     │
 * │ metric filter that silently matches nothing.                              │
 * │                                                                           │
 * │ ⚠️ AND IT CARRIES NO LEAD. The line is the token, the internal code and   │
 * │ the CRM's status — never a field, never a value, never the body. A log    │
 * │ line naming a person at a named employer is the thing this whole function │
 * │ is written not to do.                                                     │
 * └───────────────────────────────────────────────────────────────────────────┘
 */
export const CRM_DELIVERY_FAILED_TOKEN = 'RECONCILE_CRM_DELIVERY_FAILED'
