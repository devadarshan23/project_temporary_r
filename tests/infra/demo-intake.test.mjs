/**
 * THE DEMO INTAKE'S CODE, EXECUTED — because a green `cdk synth` says nothing
 * whatever about code inside a zip file. **S5, 22 Sep 2026.**
 *
 * 🛑 WHY THIS SUITE EXISTS AND WHY IT IS THE LOAD-BEARING HALF OF THE SLICE.
 * `tests/infra/amplify.test.mjs` reads a synthesised TEMPLATE: it can prove the
 * intake's IAM policy withholds `secretsmanager:ListSecrets` and it **cannot
 * prove that two different referral codes produce the same answer**, which is
 * the one property the whole endpoint exists to hold. That is a run-time
 * property, and until this file existed nothing in this repository had executed
 * a line of that function — `docs/HANDOFF.md` §5.6, a control that cannot be
 * witnessed asserts nothing.
 *
 * ⚠️ IT NEEDS NO AWS AND NO SDK ON DISK. `index.mjs` imports
 * `@aws-sdk/client-secrets-manager` DYNAMICALLY, inside `handler()` only, for
 * the reason `tenant-key-minter/index.mjs` gives. So `deliver()` imports
 * cleanly and is driven below against a recording double.
 *
 * 🛑 **G3681, 3 Oct 2026 — THE OWNER'S RULING, CLOSING G2007: *"Queue it: the
 * intake enqueues and returns immediately; a worker delivers to the CRM.
 * Constant-time answer."*** `deliver()` is GONE: the public function
 * (`index.mjs`) is `answer()`, which validates and ENQUEUES, and the CRM call
 * moved to `worker.mjs`'s `work()`. The sentence above is kept as the history
 * of this suite; §2 and §8 now drive `answer()` with CRM doubles installed on
 * `globalThis.fetch` and require ZERO calls to them, and §10 is the
 * timing-independence the ruling asks for.
 *
 * ⚠️ AND IT IS `.mjs` FOR THE REASON `support.mjs` STATES: the gate type-checks
 * `tests/` from the ROOT, where `aws-cdk-lib` is deliberately absent.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { INFRA_DIR } from './support.mjs'

const INTAKE_DIR = join(INFRA_DIR, 'lambda', 'demo-intake')

const { answer, handler } = await import(join(INTAKE_DIR, 'index.mjs'))
const { attemptDelivery, crmConfig, crmFailureReason, readQueuedLead, resetCrmConfigCache, work, CRM_CONFIG_CACHE_TTL_MS } =
  await import(join(INTAKE_DIR, 'worker.mjs'))
const { LEAD_DEFAULT_ENV, SDR_NOTES_PREAMBLE, leadCreateFor, readLeadDefaults } = await import(join(INTAKE_DIR, 'lead.mjs'))
const { INTAKE_MESSAGE_SOURCE, intakeMessage } = await import(join(INTAKE_DIR, 'message.mjs'))
const {
  ACCEPTED,
  CRM_DELIVERY_FAILED_TOKEN,
  INTAKE_FIELDS,
  INTERNAL_FAILURE_WIRE_CODE,
  IntakeRefusal,
  MAX_BODY_BYTES,
  REQUIRED_CONTENT_TYPE,
  CRM_PINNED_ORIGIN,
  endpointIsPinned,
  readBody,
  readContentType,
  readCrmConfig,
  readIntake,
  readMethod,
  refusalResponse,
} = await import(join(INTAKE_DIR, 'guards.mjs'))

/**
 * The owner's defaults as the worker sees them (G3733). Deliberately NOT the
 * real PipelinePulse ids: those are joined to `lib/config.ts` and to the
 * synthesised environment in §11, and a fixture that copied them would pass
 * whether or not the worker read them from its environment.
 */
const DEFAULTS = {
  gtm_motion_id: 'motion-from-env',
  business_unit_id: 'unit-from-env',
  business_region_id: 'region-from-env',
  lead_status: 'MQL',
  source: 'reconcileai.app demo',
}

const CONFIG = {
  /* G3861: on the owner's pinned origin, or every delivery test below would
   * be a refusal test. */
  endpoint: 'https://api.1chpipelinepulse.com/api/v1/leads',
  headerName: 'authorization',
  headerValue: 'Bearer not-a-real-token',
  defaults: DEFAULTS,
}

/**
 * A `fetch` double that RECORDS rather than simulates.
 *
 * 🛑 `statusFor` IS THE REPAIR G2001 REQUIRED. The old double took ONE status
 * and answered it to every call, so *"two inputs produced one answer"* was a
 * fact about the double. It must be able to DISAGREE, or a test built on it
 * cannot fail for the right reason.
 */
function recordingFetch({ status = 201, statusFor = undefined, throws = undefined } = {}) {
  const calls = []
  const impl = async (url, init) => {
    if (throws !== undefined) {
      calls.push({ url, init, threw: throws })
      throw throws
    }
    const answered = statusFor === undefined ? status : statusFor(JSON.parse(init.body))
    calls.push({ url, init, status: answered })
    return { status: answered }
  }
  impl.calls = calls
  return impl
}

const silent = { error: () => {} }

/**
 * A queue double: it records the bodies the intake sends and never fails.
 * The intake's answer has exactly two inputs — the request and whether this
 * succeeded — so holding it fixed holds the backend fixed.
 */
function recordingQueue({ fails = false } = {}) {
  const sent = []
  const enqueue = async (body) => {
    if (fails) throw new IntakeRefusal('intake_queue_unavailable', 502, 'double')
    sent.push(body)
  }
  enqueue.sent = sent
  return enqueue
}

/**
 * Install a CRM double on `globalThis.fetch` for the length of `body()`.
 *
 * 🛑 THIS IS WHERE A CRM WOULD BE REACHED FROM IF THE REQUEST PATH STILL
 * REACHED ONE — `fetch` is the runtime's global, and `deliver()` called it
 * with no argument naming it. So a CRM that is slow, failing or discriminating
 * is installed THERE, and the assertion is that nothing calls it.
 */
async function withCrm(crm, body) {
  const previous = globalThis.fetch
  const calls = []
  globalThis.fetch = async (...args) => {
    calls.push(args)
    return crm(...args)
  }
  try {
    return await body(calls)
  } finally {
    globalThis.fetch = previous
  }
}

/** Five CRMs a real one could be, each of which the first draft would have published. */
const CRM_DOUBLES = {
  succeeding: async () => ({ status: 201 }),
  refusing: async () => ({ status: 404 }),
  failing: async () => {
    throw new Error('ECONNRESET')
  },
  slow: () => new Promise((resolve) => setTimeout(() => resolve({ status: 201 }), 2_000).unref()),
  neverSettling: () => new Promise(() => {}),
}

/** An SQS event carrying the bodies given. */
const sqsEvent = (...bodies) => ({
  Records: bodies.map((body, i) => ({ messageId: `m-${i}`, body })),
})

/** A Function URL event (payload 2.0) carrying `body`. */
const postEvent = (body, contentType = REQUIRED_CONTENT_TYPE) => ({
  requestContext: { http: { method: 'POST' } },
  headers: contentType === undefined ? {} : { 'content-type': contentType },
  body,
})

// ------------------------------------------------------ 1. the intake's shape

test('test_only_post_is_accepted_so_a_link_a_prefetch_and_an_image_tag_are_not_leads', () => {
  assert.equal(readMethod({ requestContext: { http: { method: 'POST' } } }), 'POST')
  assert.equal(readMethod({ requestContext: { http: { method: 'GET' } } }), 'GET')
  assert.throws(() => readMethod({}), IntakeRefusal)

  /* 🛑 THE COMPARISON IS EXACT — G1980. `readMethod` returned
   * `method.toUpperCase()`, so `post` was accepted as a POST. HTTP methods are
   * case-SENSITIVE; it bypassed nothing (the same branch was taken either way)
   * and it is narrowed because narrowing is free and fails closed. */
  for (const method of ['post', 'Post', 'pOsT']) {
    assert.notEqual(
      readMethod({ requestContext: { http: { method } } }),
      'POST',
      `'${method}' was normalised to POST. A method is case-sensitive, so this function's ` +
        'idea of "is this a POST" would sit one character from disagreeing with every proxy, ' +
        'log parser and WAF rule in front of it.',
    )
  }
})

/**
 * ⚠️ AND THE HANDLER REFUSES EVERY ONE OF THEM, which is the arm that matters:
 * `readMethod` reporting a lower-case method is only a fence if the caller
 * then compares it to `POST` and refuses.
 */
test('test_the_handler_refuses_a_lower_case_method_and_every_other_verb', async () => {
  for (const method of ['post', 'GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS', 'TRACE']) {
    const answer = await handler({
      requestContext: { http: { method } },
      headers: { 'content-type': REQUIRED_CONTENT_TYPE },
      body: JSON.stringify({ name: 'Ada' }),
    })
    assert.equal(answer.statusCode, 405, `'${method}' was served`)
    assert.equal(JSON.parse(answer.body).code, 'intake_method_not_allowed')
  }
})

test('test_the_size_cap_is_applied_in_bytes_and_before_the_json_parse', () => {
  /* The cap is on BYTES. A multi-byte character would otherwise buy four times
   * the budget, and `JSON.parse` on an eight-megabyte string is the denial of
   * service rather than the string itself. */
  const justUnder = JSON.stringify({ name: 'a'.repeat(100) })
  assert.equal(readBody({ body: justUnder }), justUnder)

  const tooBig = 'é'.repeat(MAX_BODY_BYTES) // two bytes each
  assert.throws(
    () => readBody({ body: tooBig }),
    (error) => error instanceof IntakeRefusal && error.code === 'intake_too_large',
    'a body over the cap in BYTES was read. A character-length cap buys a multi-byte body ' +
      'several times the budget.',
  )
  assert.throws(() => readBody({ body: '' }), IntakeRefusal)
})

test('test_an_unknown_field_is_refused_rather_than_ignored', () => {
  assert.throws(
    () => readIntake(JSON.stringify({ name: 'Ada', tenantId: 'ten_acme' })),
    (error) => error instanceof IntakeRefusal && error.code === 'intake_unknown_field',
    'an unknown field was ignored. server/http/app.ts already states why that is worse than ' +
      'a refusal: "silently deleted and the request served ... leaves no evidence that it did". ' +
      'The sender believes it was recorded and nothing anywhere says no.',
  )
  assert.throws(() => readIntake('not json'), IntakeRefusal)
  assert.throws(() => readIntake('[]'), IntakeRefusal)
  assert.throws(() => readIntake(JSON.stringify({ name: 7 })), IntakeRefusal)
  assert.throws(() => readIntake(JSON.stringify({})), IntakeRefusal)
  assert.throws(() => readIntake(JSON.stringify({ name: '   ' })), IntakeRefusal)
})

/**
 * 🛑 A LENGTH REFUSAL NAMES THE FIELD AND THE LIMIT AND NEVER THE VALUE.
 *
 * A message that echoed the value would put a stranger's text into our own log
 * line, which is invariant 6's neighbourhood wearing a 400.
 */
test('test_a_length_refusal_names_the_field_and_the_limit_and_never_the_value', () => {
  const secret = 'SUPERCALIFRAGILISTIC'.repeat(20)
  try {
    readIntake(JSON.stringify({ referralCode: secret }))
    assert.fail('an over-long referral code was accepted')
  } catch (error) {
    assert.ok(error instanceof IntakeRefusal)
    assert.equal(error.code, 'intake_field_too_long')
    assert.ok(error.message.includes('referralCode'), 'the refusal must name the field')
    assert.equal(
      error.message.includes(secret),
      false,
      'the refusal echoes the value a stranger typed, which puts it in our own log line',
    )
  }
})

// ------------------------------- 2. the property the whole endpoint is for

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 REFERRAL-CODE VALIDITY CANNOT LEAK — AND THE TEST THAT STOOD HERE COULD
 *    NOT HAVE FAILED. G2001, 22 Sep 2026.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE OLD TEST drove two referral codes through `deliver()` against
 * `recordingFetch()`, whose default is `status: 201` **for both**, and
 * required the two answers to match. They matched because the stub answered
 * identically, not because the function did — so it passed on a function that
 * returned `202` iff the CRM answered `2xx`, which is exactly the oracle it
 * was written to catch. **A double that cannot disagree cannot witness
 * agreement**, and the assertion below is the repair: the CRM double now
 * REFUSES one of the two codes, as a real CRM does with a code it has never
 * heard of.
 *
 * Reproduced against the first draft, which answered:
 *
 *     referralCode=PARTNER-ACME-2026  ->  202 {"status":"received"}
 *     referralCode=GUESS-0001         ->  502 {"code":"crm_unavailable"}
 */
test('test_a_crm_that_refuses_one_referral_code_and_accepts_the_other_produces_one_answer', async () => {
  /* A CRM that behaves like one: a code it does not know is a 404. Since
   * G3681 it is installed where the request path WOULD reach it, and the
   * worker below is the only thing that does. */
  const discriminating = async (_url, init) =>
    JSON.parse(init.body).lead.referralCode === 'PARTNER-LIVE' ? { status: 201 } : { status: 404 }

  await withCrm(discriminating, async (calls) => {
    const queue = recordingQueue()
    const accepted = await answer({
      event: postEvent(JSON.stringify({ company: 'Acme', referralCode: 'PARTNER-LIVE' })),
      enqueue: queue,
      log: silent,
    })
    const refused = await answer({
      event: postEvent(JSON.stringify({ company: 'Acme', referralCode: 'not-a-code-at-all' })),
      enqueue: queue,
      log: silent,
    })
    assert.equal(
      JSON.stringify(accepted),
      JSON.stringify(refused),
      'two referral codes produced two answers, so a stranger reads validity off this ' +
        'endpoint with no credential at all.',
    )
    assert.equal(accepted.statusCode, 202)
    assert.equal(calls.length, 0, 'the request path reached the CRM. G3681: it enqueues and answers.')
    /* And both codes really travelled — to the QUEUE. */
    assert.equal(queue.sent.length, 2)
    assert.ok(queue.sent[0].includes('PARTNER-LIVE'))
    assert.ok(queue.sent[1].includes('not-a-code-at-all'))
  })

  /* 🛑 AND THE DOUBLE REALLY DISAGREES, which is how the pre-G2001 version of
   * this test passed against a function with an open oracle: drive the same
   * two leads through the WORKER and the CRM must answer them differently. */
  const crm = recordingFetch({ statusFor: (lead) => (lead.sdr_notes.includes('PARTNER-LIVE') ? 201 : 404) })
  const report = await work({
    event: sqsEvent(
      intakeMessage({ company: 'Acme', referralCode: 'PARTNER-LIVE' }),
      intakeMessage({ company: 'Acme', referralCode: 'not-a-code-at-all' }),
    ),
    readConfig: async () => CONFIG,
    fetchImpl: crm,
    log: silent,
  })
  assert.deepEqual(crm.calls.map((c) => c.status), [201, 404], 'the CRM double must disagree')
  assert.deepEqual(report, { batchItemFailures: [{ itemIdentifier: 'm-1' }] })
})

/**
 * 🛑 AND EXHAUSTIVELY OVER THE CRM's WHOLE ANSWER SPACE — now on the WORKER,
 * which is the only place a CRM answer exists. Every 2xx is a delivery; every
 * other status, a dead socket and a timeout is a RETRY (a `batchItemFailure`),
 * never an exception that would fail the batch, and never a dropped lead.
 */
test('test_every_crm_status_and_a_dead_socket_is_a_delivery_or_a_retry_and_never_a_throw', async () => {
  for (let status = 100; status < 600; status += 1) {
    const report = await work({
      event: sqsEvent(intakeMessage({ name: 'Ada', company: 'Acme' })),
      readConfig: async () => CONFIG,
      fetchImpl: recordingFetch({ status }),
      log: silent,
    })
    const expected = status >= 200 && status < 300 ? [] : [{ itemIdentifier: 'm-0' }]
    assert.deepEqual(report.batchItemFailures, expected, `status ${status}`)
  }
  for (const throws of [new Error('ECONNRESET'), Object.assign(new Error('timed out'), { name: 'TimeoutError' })]) {
    const report = await work({
      event: sqsEvent(intakeMessage({ name: 'Ada', company: 'Acme' })),
      readConfig: async () => CONFIG,
      fetchImpl: recordingFetch({ throws }),
      log: silent,
    })
    assert.deepEqual(report.batchItemFailures, [{ itemIdentifier: 'm-0' }])
  }
})

/**
 * 🛑 AND A FAILED DELIVERY IS LOUD ON THE INSIDE, WHICH IS THE ONLY THING THAT
 * PAYS FOR THE SILENT WIRE.
 *
 * The worker returns normally, so Lambda records a SUCCESSFUL invocation and
 * `AWS/Lambda Errors` reads 0 — a generic alarm sees nothing. The log line is
 * therefore the whole signal, and `lib/amplify-stack.ts`'s metric filter (on
 * the WORKER's log group since G3681) reads exactly the token asserted here.
 * **And it carries no lead.**
 */
test('test_a_dropped_lead_writes_the_metric_token_and_never_writes_the_lead', async () => {
  const lines = []
  const log = { error: (...args) => lines.push(args) }
  const lead = { name: 'Ada Lovelace', company: 'Analytical Engines', referralCode: 'PARTNER-LIVE' }

  await work({ event: sqsEvent(intakeMessage(lead)), readConfig: async () => CONFIG, fetchImpl: recordingFetch({ status: 404 }), log })
  assert.equal(lines.length, 1, 'a failed delivery wrote no log line, so nothing anywhere can see it')
  assert.equal(
    lines[0][0],
    CRM_DELIVERY_FAILED_TOKEN,
    'the failure was logged without the token the metric filter keys on, so the alarm in ' +
      'lib/observability-stack.ts counts nothing and the failure is observable NOWHERE.',
  )
  const rendered = JSON.stringify(lines)
  for (const value of Object.values(lead)) {
    assert.equal(
      rendered.includes(value),
      false,
      `the failure log line carries "${value}" - a lead is a named person at a named employer.`,
    )
  }

  /* And a DELIVERED lead is silent, or the metric counts every request. */
  lines.length = 0
  await work({ event: sqsEvent(intakeMessage(lead)), readConfig: async () => CONFIG, fetchImpl: recordingFetch({ status: 201 }), log })
  assert.deepEqual(lines, [], 'a successful delivery wrote the failure token, so the alarm fires always')
})

/**
 * ⚠️ `ACCEPTED` IS STILL A FROZEN CONSTANT — and this test no longer claims
 * that this is what holds the property. G2001: *a constant cannot make a claim
 * about the answer, because the answer is the choice of whether to return it.*
 * What it does buy is that a handler cannot mutate the shared object.
 */
test('test_the_one_successful_answer_is_a_frozen_constant_that_takes_no_argument', () => {
  assert.equal(typeof ACCEPTED, 'object')
  assert.equal(Object.isFrozen(ACCEPTED), true, 'ACCEPTED is mutable, so a handler could edit it')
  assert.equal(ACCEPTED.body, '{"status":"received"}')
  assert.equal(
    ACCEPTED.body.toLowerCase().includes('referral'),
    false,
    'the successful body mentions the referral code',
  )
})

/**
 * 🛑 A 5xx NEVER NAMES WHICH OF OUR OWN PARTS FAILED — G2005.
 *
 * `crm_not_configured` and `crm_unavailable` were distinguishable on the wire,
 * which told a stranger whether this environment had ever been configured and
 * whether its CRM was up. Neither is a fact about the caller. The distinction
 * is MOVED to the log, not lost.
 */
test('test_every_5xx_wears_one_wire_code_and_a_4xx_keeps_its_own', () => {
  const rendered = ['crm_not_configured', 'crm_unavailable', 'intake_unavailable'].map((code) =>
    JSON.parse(refusalResponse(new IntakeRefusal(code, 502, 'a detail')).body),
  )
  assert.deepEqual(
    [...new Set(rendered.map((r) => r.code))],
    [INTERNAL_FAILURE_WIRE_CODE],
    `a 5xx named our own failing part on the wire: ${JSON.stringify(rendered)}`,
  )
  /* A 4xx is about the REQUEST, and telling the sender what was wrong with
   * their own request is the point of one. */
  assert.equal(
    JSON.parse(refusalResponse(new IntakeRefusal('intake_unknown_field', 400, 'tenantId')).body).code,
    'intake_unknown_field',
  )
  /* And the detail never reaches the caller, whichever arm it is. */
  for (const refusal of [new IntakeRefusal('crm_not_configured', 502, 'SECRET'), new IntakeRefusal('intake_malformed', 400, 'SECRET')]) {
    assert.equal(refusalResponse(refusal).body.includes('SECRET'), false)
  }
})

// ----------------------------------------------------- 3. the CRM's config

test('test_an_empty_endpoint_is_a_loud_refusal_and_never_a_quiet_success', () => {
  for (const value of [
    JSON.stringify({ endpoint: '', token: 'y' }),
    JSON.stringify({ endpoint: 'not a url', token: 'y' }),
    JSON.stringify({ endpoint: 'http://crm.example.invalid', token: 'y' }),
    /* The stack's own generated placeholder — the old three keys, endpoint
     * EMPTY (G3736: the secret resource is deliberately unchanged). */
    JSON.stringify({ endpoint: '', authHeaderName: '', authHeaderValue: 'x'.repeat(40) }),
    'not json at all',
  ]) {
    assert.throws(
      () => readCrmConfig(value),
      (error) => error instanceof IntakeRefusal && error.code === 'crm_not_configured',
      `readCrmConfig accepted ${value}. The secret is created with endpoint EMPTY, so a ` +
        'freshly deployed stack MUST refuse loudly - "a form submission that reaches nobody" ' +
        'is the failure the pack already names as V2`s bad exit.',
    )
  }
  const ok = readCrmConfig(JSON.stringify({ endpoint: 'https://api.1chpipelinepulse.com/api/v1/leads', token: 'k' }))
  assert.equal(ok.headerName, 'authorization')
  assert.equal(ok.headerValue, 'Bearer k')
})

/**
 * 🛑 THE SECRET IS `{endpoint, token}` SINCE G3732 — THE OWNER'S RULING:
 * *"someone on the CRM side issues a long-lived service/API token for this
 * integration and puts it in the reconcile-staging-crm-lead-intake secret"*.
 * A missing or empty token is its own loud refusal; and the header NAME is no
 * longer configuration at all, which is what retired G2003's deny-list.
 *
 * Witnessed RED first: against `origin/main`'s `readCrmConfig`, every
 * `{endpoint, token}` value below — the valid one included — was refused
 * `auth header is empty`, because that code read `authHeaderName` and never
 * `token`.
 */
test('test_a_missing_or_empty_token_is_refused_and_a_present_one_becomes_a_bearer_header', () => {
  for (const value of [
    { endpoint: 'https://api.1chpipelinepulse.com/api/v1/leads' },
    { endpoint: 'https://api.1chpipelinepulse.com/api/v1/leads', token: '' },
    { endpoint: 'https://api.1chpipelinepulse.com/api/v1/leads', token: '   ' },
    { endpoint: 'https://api.1chpipelinepulse.com/api/v1/leads', token: 42 },
    /* The old shape is NOT read any more: a secret still written the G2011 way
     * is a refusal, not a silently-different header. */
    { endpoint: 'https://api.1chpipelinepulse.com/api/v1/leads', authHeaderName: 'authorization', authHeaderValue: 'Bearer k' },
  ]) {
    assert.throws(
      () => readCrmConfig(JSON.stringify(value)),
      (error) => error instanceof IntakeRefusal && error.code === 'crm_not_configured' && /token/.test(error.message),
      `readCrmConfig accepted ${JSON.stringify(value)} with no usable token.`,
    )
  }
  const config = readCrmConfig(
    JSON.stringify({ endpoint: 'https://api.1chpipelinepulse.com/api/v1/leads', token: 'pp_svc.AbC-123_~+/xyz==' }),
  )
  assert.deepEqual(config, {
    endpoint: 'https://api.1chpipelinepulse.com/api/v1/leads',
    headerName: 'authorization',
    headerValue: 'Bearer pp_svc.AbC-123_~+/xyz==',
  })
})

// ------------------------------------- 4. the two copies of the field set

/**
 * 🛑 THE FIELD SET IS WRITTEN TWICE — ONE COPY IN `tsc`'s WORLD AND ONE IN
 * LAMBDA'S — AND THE SEAM BETWEEN THEM IS A ZIP FILE. Neither can cover the
 * other, so this joins them **in both directions**: a field the CDK knows and
 * the function does not is a form field silently dropped, and a field the
 * function accepts and the CDK does not is a cap nobody reviewed.
 * `tenant-key-minter.test.mjs` does exactly this for `HANDLE_PATTERN`.
 */
test('test_the_synth_time_field_set_and_the_run_time_one_have_not_drifted', () => {
  const config = readFileSync(join(INFRA_DIR, 'lib', 'config.ts'), 'utf8')

  const fields = /DEMO_INTAKE_FIELDS\s*=\s*\[([\s\S]*?)\]\s*as const/.exec(config)
  assert.ok(fields, 'DEMO_INTAKE_FIELDS is not declared as a literal tuple any more')
  const declared = [...fields[1].matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]).sort()
  assert.deepEqual(
    declared,
    Object.keys(INTAKE_FIELDS).sort(),
    'the CDK`s field allow-list and the function`s have drifted. A field one accepts and the ' +
      'other refuses is a form field silently dropped or a cap nobody reviewed.',
  )

  const lengths = /DEMO_INTAKE_FIELD_MAX_LENGTH[^{]*\{([\s\S]*?)\n\}/.exec(config)
  assert.ok(lengths, 'DEMO_INTAKE_FIELD_MAX_LENGTH is not declared as a literal any more')
  const declaredLengths = Object.fromEntries(
    [...lengths[1].matchAll(/([A-Za-z]+):\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]),
  )
  assert.deepEqual(declaredLengths, INTAKE_FIELDS, 'the per-field length caps have drifted')

  const cap = /DEMO_INTAKE_MAX_BODY_BYTES\s*=\s*([^\n]+)/.exec(config)
  assert.ok(cap, 'DEMO_INTAKE_MAX_BODY_BYTES is not declared as a literal any more')
  // eslint-disable-next-line no-new-func
  assert.equal(Number(new Function(`return ${cap[1]}`)()), MAX_BODY_BYTES, 'the body cap has drifted')
})

/**
 * ⚠️ AND A TRIPWIRE ON THE ONE FIELD THIS SLICE IS ABOUT. `referralCode` must
 * stay in the set and must stay unevaluated; a `referral_code_*` refusal code
 * appearing anywhere in the function is the moment this endpoint becomes a
 * lookup service for whichever partners exist.
 *
 * 🛑 **AND READ WHAT THIS DOES NOT COVER, BECAUSE IT DID NOT COVER THE LEAK IT
 * WAS WRITTEN FOR — G2001.** It greps refusal codes for
 * `referral|company|email|domain|partner`, and the oracle arrived through
 * `crm_unavailable` — a SHAPE-named code carrying a value-derived bit.
 * **Where a leak is SPELLED is a landmark; what the answer VARIES WITH is the
 * property** (`docs/HANDOFF.md` §5.1). The tests two sections up hold the
 * property; this holds a narrower thing and is kept because the narrower thing
 * is also worth holding.
 */
test('test_no_refusal_in_the_function_is_keyed_on_what_a_field_contains', () => {
  const source = [
    readFileSync(join(INTAKE_DIR, 'guards.mjs'), 'utf8'),
    readFileSync(join(INTAKE_DIR, 'index.mjs'), 'utf8'),
  ].join('\n')
  const codes = [...source.matchAll(/IntakeRefusal\(\s*'([a-z_]+)'/g)].map((m) => m[1])
  assert.ok(codes.length > 0, 'no refusal codes were found; this assertion read nothing')
  const valueKeyed = codes.filter((code) => /referral|company|email|domain|partner/.test(code))
  assert.deepEqual(
    valueKeyed,
    [],
    `these refusal codes are keyed on what a field CONTAINS: ${valueKeyed.join(', ')}. Every ` +
      'member must be about the request`s SHAPE or about our own plumbing - the moment a ' +
      'refusal names a value, this endpoint is a lookup service for whatever that value names.',
  )
  assert.ok(Object.hasOwn(INTAKE_FIELDS, 'referralCode'), 'referralCode left the field set')
})

// ------------------------------- 5. the cross-origin fence (BLOCKER 2, G2002)

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 A CROSS-ORIGIN `POST` WITH A SAFELISTED MEDIA TYPE IS SENT WITH NO
 *    PREFLIGHT, AND A WRITE-ONLY ENDPOINT DOES NOT NEED THE REPLY.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `lib/amplify-stack.ts` argued that no CORS configuration was needed because
 * *"the only caller is same-origin with the apex and therefore makes no
 * preflight at all"*. **CORS gates READING A RESPONSE, not sending a request.**
 * So `fetch(url, {method:'POST', mode:'no-cors', body:'…'})` from any page in
 * the world reached this function, as did a plain cross-origin `<form>`, and
 * the handler inspected no inbound header but the method.
 *
 * Requiring `application/json` — which is NOT a safelisted `Content-Type`
 * value — makes every cross-origin attempt a PREFLIGHTED one, and the Function
 * URL's absent CORS configuration then fails the preflight.
 */
test('test_the_three_cors_safelisted_media_types_are_refused_because_they_need_no_preflight', () => {
  /* The three values that make a POST a CORS *simple request*. Each of these
   * is what an attacker's page or a cross-origin <form> actually sends. */
  for (const media of [
    'text/plain',
    'text/plain;charset=UTF-8',
    'application/x-www-form-urlencoded',
    'multipart/form-data; boundary=x',
  ]) {
    assert.throws(
      () => readContentType(postEvent('{}', media)),
      (error) => error instanceof IntakeRefusal && error.code === 'intake_content_type_not_allowed',
      `'${media}' was accepted. It is a CORS-safelisted Content-Type, so a cross-origin POST ` +
        'carrying it is sent with NO preflight and only the REPLY is blocked - which a ' +
        'write-only lead endpoint does not need. Every visitor to an attacker`s page is then ' +
        'a lead-injection bot.',
    )
  }
  /* And an absent header, which is what a form post degrades to in a client
   * that sets none. */
  assert.throws(() => readContentType({ headers: {} }), IntakeRefusal)
  assert.throws(() => readContentType({}), IntakeRefusal)
})

test('test_application_json_is_accepted_with_parameters_and_in_any_case', () => {
  for (const media of [
    'application/json',
    'application/json; charset=utf-8',
    'APPLICATION/JSON',
    ' application/json ',
  ]) {
    assert.equal(
      readContentType(postEvent('{}', media)),
      REQUIRED_CONTENT_TYPE,
      `'${media}' was refused. Refusing a real client's own spelling makes this fence look ` +
        'like a parser bug and invites its deletion.',
    )
  }
  /* Header casing is not trusted: the Function URL lower-cases, the proxy and
   * a test need not. */
  assert.equal(readContentType({ headers: { 'Content-Type': 'application/json' } }), REQUIRED_CONTENT_TYPE)
})

/**
 * 🛑 THE PREFLIGHT ITSELF MEETS THE **METHOD** REFUSAL, AND THAT IS THE ONE
 * THAT CARRIES NO `Access-Control-Allow-Origin`.
 *
 * With no CORS configuration on the Function URL, an `OPTIONS` reaches this
 * handler. It must be refused, and the refusal must carry no CORS header, or
 * the browser goes on to send the POST.
 */
test('test_a_preflight_options_is_refused_and_the_refusal_carries_no_cors_header', async () => {
  const answer = await handler({ requestContext: { http: { method: 'OPTIONS' } }, headers: {} })
  assert.equal(answer.statusCode, 405)
  const headerNames = Object.keys(answer.headers).map((n) => n.toLowerCase())
  for (const forbidden of [
    'access-control-allow-origin',
    'access-control-allow-methods',
    'access-control-allow-headers',
  ]) {
    assert.equal(
      headerNames.includes(forbidden),
      false,
      `the refusal carries ${forbidden}, which ALLOWS the preflight and re-opens the endpoint ` +
        'to every origin. The absence of a CORS block is what fails the preflight, and it is ' +
        'load-bearing now rather than decorative.',
    )
  }
  /* And the same for a POST the media-type fence refuses. */
  const refused = await handler(postEvent(JSON.stringify({ name: 'Ada' }), 'text/plain'))
  assert.equal(refused.statusCode, 415)
  assert.equal(
    Object.keys(refused.headers).some((n) => n.toLowerCase().startsWith('access-control-')),
    false,
  )
})

// --------------------------------- 6. the secret is read at most once per TTL

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE CACHE COULD NOT ENGAGE IN THE ONE STATE THE STACK SHIPS IN. G2008.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `readCrmConfig` THROWS while the secret is unconfigured — which is day one
 * by design (G1971) — and the old cache assigned only on the success path. So
 * every request was a `GetSecretValue` during exactly the window G1976 calls
 * the likely failure: at this endpoint's own concurrency ceiling, ~17.3M API
 * calls a day, ≈$86/day against ≈$1.44/day of compute.
 */
test('test_an_unconfigured_secret_is_read_once_per_ttl_and_not_once_per_request', async () => {
  resetCrmConfigCache()
  let sends = 0
  const client = {
    send: async () => {
      sends += 1
      return { SecretString: JSON.stringify({ endpoint: '' }) }
    },
  }
  const command = (input) => input
  const at = 1_000_000
  const deps = { client, command, secretId: 's', now: () => at }

  for (let i = 0; i < 25; i += 1) {
    await assert.rejects(
      () => crmConfig(deps),
      (e) => e instanceof IntakeRefusal && e.code === 'crm_not_configured',
    )
  }
  assert.equal(
    sends,
    1,
    `the secret was read ${sends} times for 25 refused requests. readCrmConfig throws, so a ` +
      'cache assigned only on the success path never engages - and the unconfigured secret ' +
      'is the state this stack is DESIGNED to ship in.',
  )

  /* And the refusal expires, so a person who runs put-secret-value is not
   * waiting on an environment recycle. */
  let clock = at + CRM_CONFIG_CACHE_TTL_MS + 1
  await assert.rejects(() => crmConfig({ client, command, secretId: 's', now: () => clock }), IntakeRefusal)
  assert.equal(sends, 2, 'the refusal never expired, so a fixed secret is never picked up')
  resetCrmConfigCache()
})

test('test_a_readable_secret_is_also_read_once_per_ttl_and_the_rotation_window_is_bounded', async () => {
  resetCrmConfigCache()
  let sends = 0
  const value = JSON.stringify({ endpoint: 'https://api.1chpipelinepulse.com/api/v1/leads', token: 'k' })
  let clock = 5_000_000
  const deps = {
    client: {
      send: async () => {
        sends += 1
        return { SecretString: value }
      },
    },
    command: (i) => i,
    secretId: 's',
    now: () => clock,
  }

  assert.equal((await crmConfig(deps)).headerValue, 'Bearer k')
  assert.equal((await crmConfig(deps)).headerValue, 'Bearer k')
  assert.equal(sends, 1, 'a readable secret was re-read inside the TTL')

  clock += CRM_CONFIG_CACHE_TTL_MS + 1
  await crmConfig(deps)
  assert.equal(
    sends,
    2,
    'the success cache never expires, which is the property the first draft named as its own ' +
      'cost - "a rotated credential is not picked up until the environment is recycled" - and ' +
      'that window is unbounded. A TTL bounds it.',
  )
  resetCrmConfigCache()
})

/**
 * 🛑 AND A FAILED `GetSecretValue` IS CACHED TOO, which is not an oversight:
 * a throttled or denied read under a flood is exactly when retrying on every
 * request makes the throttling worse.
 */
test('test_a_failed_secretsmanager_read_is_cached_rather_than_retried_per_request', async () => {
  resetCrmConfigCache()
  let sends = 0
  const deps = {
    client: {
      send: async () => {
        sends += 1
        throw new Error('ThrottlingException')
      },
    },
    command: (i) => i,
    secretId: 's',
    now: () => 9_000_000,
  }
  for (let i = 0; i < 10; i += 1) await assert.rejects(() => crmConfig(deps), IntakeRefusal)
  assert.equal(sends, 1, `a throttled read was retried ${sends} times, which deepens the throttle`)
  resetCrmConfigCache()
})

// ------------------------------------ 7. the endpoint and the header, fenced

/**
 * 🛑 THE OWNER'S PIN — G3861, 4 Oct 2026, CLOSING G3735, verbatim:
 *
 *     "Pin the host: the worker refuses any endpoint not on
 *      https://api.1chpipelinepulse.com; changing CRM becomes a code change."
 *
 * ⚠️ THIS SECTION WAS G2004's DENY-LIST TEST UNTIL THE RULING, AND ITS EIGHT
 * INTERNAL ENDPOINTS ARE KEPT BELOW: every one is still refused, now by the
 * pin and under the DISTINCT code `crm_endpoint_not_pinned`, so an operator can
 * tell "the secret names the wrong CRM" from "the secret names none". What the
 * deny-list ADMITTED and the pin refuses is the second list — any other public
 * name, including the four that START WITH the pinned text and are not on it.
 *
 * WITNESSED RED: with both `endpointIsPinned()` checks replaced by `false`
 * (`readCrmConfig` and `attemptDelivery`), §7a failed — *"Missing expected
 * exception: https://169.254.169.254/latest/meta-data/iam/security-credentials/
 * was not refused as crm_endpoint_not_pinned"* — and §7c failed —
 * *"attemptDelivery answered {"delivered":true} for https://169.254.169.254/…"*,
 * i.e. the double was CALLED, the request this ruling exists to prevent. And
 * the pre-G3861 deny-list admitted `https://crm.example.com/leads` outright —
 * its own §7 asserted exactly that as its anti-vacuity case.
 */
const IMPOSTORS = [
  /* G2004's eight — inward names. */
  'https://169.254.169.254/latest/meta-data/iam/security-credentials/',
  'https://[fd00:ec2::254]/latest/meta-data/',
  'https://localhost/leads',
  'https://127.0.0.1/leads',
  'https://10.0.0.5/leads',
  'https://crm.internal/leads',
  'https://vault.local/leads',
  'https://crm/leads',
  /* Public names the deny-list admitted and the pin does not. */
  'https://crm.example.com/leads',
  'https://pipelinepulse.com/api/v1/leads',
  'https://1chpipelinepulse.com/api/v1/leads',
  /* Prefix and confusable spellings — each STARTS WITH the pinned text. */
  'https://api.1chpipelinepulse.com.evil.example/api/v1/leads',
  'https://api.1chpipelinepulse.com@evil.example/api/v1/leads',
  'https://user:pw@api.1chpipelinepulse.com/api/v1/leads',
  'https://api.1chpipelinepulse.com:8443/api/v1/leads',
]

test('test_7a_every_endpoint_off_the_pinned_origin_is_refused_with_its_own_reason', () => {
  assert.equal(CRM_PINNED_ORIGIN, 'https://api.1chpipelinepulse.com', 'the pinned origin is the owner`s, typed in here')
  for (const endpoint of IMPOSTORS) {
    assert.throws(
      () => readCrmConfig(JSON.stringify({ endpoint, token: 'k' })),
      (error) =>
        error instanceof IntakeRefusal &&
        error.code === 'crm_endpoint_not_pinned' &&
        !String(error.message).includes('evil') &&
        !String(error.message).includes('169.254'),
      `${endpoint} was not refused as crm_endpoint_not_pinned (or the refusal echoed the ` +
        'configured endpoint). The owner pinned the CRM to https://api.1chpipelinepulse.com; ' +
        'changing it is a code change, not a put-secret-value.',
    )
    assert.equal(endpointIsPinned(endpoint), false, `${endpoint} counted as pinned`)
  }
})

test('test_7b_the_pinned_origin_passes_with_any_path_and_its_default_port_spelled_out', () => {
  /* Anti-vacuity: a pin that refused everything would pass §7a. */
  for (const endpoint of [
    'https://api.1chpipelinepulse.com/api/v1/leads',
    'https://API.1chpipelinepulse.com/api/v1/leads',
    'https://api.1chpipelinepulse.com:443/api/v1/leads',
    'https://api.1chpipelinepulse.com',
  ]) {
    assert.equal(endpointIsPinned(endpoint), true, `${endpoint} is on the pinned origin and was refused`)
    assert.equal(new URL(readCrmConfig(JSON.stringify({ endpoint, token: 'k' })).endpoint).origin, CRM_PINNED_ORIGIN)
  }
  /* And `http:` on the right host is still the older, louder refusal. */
  assert.throws(
    () => readCrmConfig(JSON.stringify({ endpoint: 'http://api.1chpipelinepulse.com/api/v1/leads', token: 'k' })),
    (error) => error instanceof IntakeRefusal && error.code === 'crm_not_configured',
  )
})

test('test_7c_attemptDelivery_refuses_an_off_origin_config_without_calling_it', async () => {
  for (const endpoint of IMPOSTORS) {
    const double = recordingFetch({ status: 201 })
    const outcome = await attemptDelivery({
      config: { ...CONFIG, endpoint },
      lead: { company_name: 'Acme' },
      fetchImpl: double,
    })
    assert.deepEqual(
      { delivered: outcome.delivered, reason: outcome.reason },
      { delivered: false, reason: 'crm_endpoint_not_pinned' },
      `attemptDelivery answered ${JSON.stringify(outcome)} for ${endpoint}`,
    )
    assert.equal(
      double.calls.length,
      0,
      `attemptDelivery CALLED ${endpoint}. The lead and the bearer token left for an origin ` +
        'the owner did not pin — the one thing this ruling forbids.',
    )
  }
  /* Anti-vacuity: the pinned origin IS called. */
  const double = recordingFetch({ status: 201 })
  assert.deepEqual(
    await attemptDelivery({ config: CONFIG, lead: { company_name: 'Acme' }, fetchImpl: double }),
    { delivered: true },
  )
  assert.equal(double.calls.length, 1)
})

/**
 * 🛑 G2003's VALUE HALF, KEPT AND NARROWED BY G3732. The header NAME is fixed
 * now, so the old deny-list of names (`Host`, `Transfer-Encoding`, `Cookie`…)
 * has nothing left to refuse and is deleted; the token is the one value that
 * still reaches a header, and RFC 6750's `b64token` admits no space, no
 * control character and no colon. A token pasted WITH its scheme is refused
 * by the same rule rather than sent as `Bearer Bearer …`.
 */
test('test_a_token_carrying_crlf_a_nul_a_space_or_its_own_scheme_is_refused', () => {
  for (const token of ['k\r\nX-Injected: 1', 'k\nX-Injected: 1', 'k\rx', 'k\u0000', 'k\u007f', 'Bearer abc', 'a b', 'k:v', 'k;v']) {
    assert.throws(
      () => readCrmConfig(JSON.stringify({ endpoint: 'https://api.1chpipelinepulse.com', token })),
      (error) => error instanceof IntakeRefusal && error.code === 'crm_not_configured',
      `the token ${JSON.stringify(token)} was accepted. A value carrying CR or LF is header ` +
        'injection, and one carrying its own scheme is a guaranteed 401 nobody is watching.',
    )
  }
  /* The refusal names the RULE and never the credential. */
  try {
    readCrmConfig(JSON.stringify({ endpoint: 'https://api.1chpipelinepulse.com', token: 'SECRET VALUE' }))
    assert.fail('refused nothing')
  } catch (error) {
    assert.equal(String(error.message).includes('SECRET'), false, 'the refusal echoed the token')
  }
})

// ---------------------------- 8. the whole handler, invariant across a fixed
//                                 backend state

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE PROPERTY, STATED AS THE ONE THING IT ACTUALLY IS: **FOR A FIXED
 *    BACKEND STATE, EVERY WELL-FORMED INTAKE PRODUCES ONE BYTE-IDENTICAL
 *    ANSWER.**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This is the equivalence-class form and it is what the earlier tests missed:
 * they compared two inputs against a double that could not disagree. Here the
 * backend is held fixed and a HOSTILE set of intakes — a live referral code, a
 * guessed one, a customer who already exists, a stranger — is driven through
 * the function end to end.
 *
 * ⚠️ THE UNCONFIGURED ARM IS THE SECOND HALF AND IT IS WHY THE 502 THAT
 * SURVIVES IS NOT A REOPENING OF G2001: `crm_not_configured` is a fact about
 * OUR deployment, identical for every caller and every body, so it carries no
 * bit about the lead. What it buys is G1971's loudness.
 */
test('test_for_a_fixed_backend_every_well_formed_intake_produces_one_answer', async () => {
  const hostile = [
    { referralCode: 'PARTNER-LIVE' },
    { referralCode: 'GUESS-0001' },
    { email: 'already@customer.example' },
    { email: 'nobody@nowhere.example' },
    { name: 'Ada', company: 'Acme', referralCode: 'PARTNER-LIVE' },
  ]

  /* A CRM that discriminates on every axis a real one would — installed where
   * the request path would reach it, and reached by nothing (G3681). */
  const crm = async (_url, init) => {
    const lead = JSON.parse(init.body).lead
    if (lead.referralCode !== undefined && lead.referralCode !== 'PARTNER-LIVE') return { status: 404 }
    if (lead.email === 'already@customer.example') return { status: 409 }
    return { status: 201 }
  }

  const configured = new Set()
  await withCrm(crm, async (calls) => {
    for (const intake of hostile) {
      configured.add(
        JSON.stringify(await answer({ event: postEvent(JSON.stringify(intake)), enqueue: recordingQueue(), log: silent })),
      )
    }
    assert.equal(calls.length, 0, 'the request path reached the CRM')
  })
  assert.deepEqual(
    [...configured],
    [JSON.stringify(ACCEPTED)],
    'a discriminating CRM produced more than one answer, which is a referral-code oracle and ' +
      `a customer-list oracle at a public URL with no credential: ${JSON.stringify([...configured])}`,
  )

  /* And the unconfigured arm: the QUEUE URL is unset (since G3681 the intake
   * cannot know the CRM secret's state at all), so the handler refuses before
   * it ever reaches an SDK import. */
  const previous = process.env.RECONCILE_DEMO_INTAKE_QUEUE_URL
  delete process.env.RECONCILE_DEMO_INTAKE_QUEUE_URL
  try {
    const unconfigured = new Set()
    for (const intake of hostile) {
      unconfigured.add(JSON.stringify(await handler(postEvent(JSON.stringify(intake)))))
    }
    assert.equal(
      unconfigured.size,
      1,
      `an unconfigured environment answered differently to different intakes: ${JSON.stringify([
        ...unconfigured,
      ])}`,
    )
    const only = JSON.parse([...unconfigured][0])
    assert.equal(only.statusCode, 502)
    assert.equal(
      JSON.parse(only.body).code,
      INTERNAL_FAILURE_WIRE_CODE,
      'the wire named which of OUR parts failed, which tells a stranger whether this ' +
        'environment has ever been configured (G2005)',
    )
  } finally {
    if (previous === undefined) delete process.env.RECONCILE_DEMO_INTAKE_QUEUE_URL
    else process.env.RECONCILE_DEMO_INTAKE_QUEUE_URL = previous
  }
})

/**
 * ⚠️ AND `attemptDelivery()` REPORTS RATHER THAN DECIDES. Since G3681 it lives
 * in `worker.mjs` and nothing it reports can reach a visitor; if it threw for a
 * CRM outcome, `work()` would fail the WHOLE batch and redeliver leads the CRM
 * had already taken.
 */
test('test_attempt_delivery_never_throws_for_anything_the_crm_did', async () => {
  for (const options of [{ status: 404 }, { status: 409 }, { status: 500 }, { throws: new Error('ECONNRESET') }]) {
    const outcome = await attemptDelivery({
      config: CONFIG,
      lead: { company_name: 'Acme' },
      fetchImpl: recordingFetch(options),
    })
    assert.equal(outcome.delivered, false)
    assert.equal(typeof outcome.reason, 'string')
  }
  assert.deepEqual(
    await attemptDelivery({ config: CONFIG, lead: { company_name: 'Acme' }, fetchImpl: recordingFetch({ status: 201 }) }),
    { delivered: true },
  )
})

// ------------------------- 9. the metric token's two copies have not drifted

/**
 * 🛑 THE METRIC FILTER IS KEYED ON A LOG-LINE SPELLING, WHICH IS §5.1's SHAPE,
 * AND THIS IS THE ANSWER `INTAKE_FIELDS` ALREADY USES: the token is written
 * twice — once in Lambda's world and once in `tsc`'s — and the seam between
 * them is a zip file. A token edited on one side must be a RED GATE and not a
 * filter that silently matches nothing for ever, which is the failure mode a
 * metric filter fails with and the reason they are usually worthless.
 */
test('test_the_metric_token_and_the_content_type_have_not_drifted_between_their_two_copies', () => {
  const config = readFileSync(join(INFRA_DIR, 'lib', 'config.ts'), 'utf8')

  const token = /CRM_DELIVERY_FAILED_TOKEN\s*=\s*'([^']+)'/.exec(config)
  assert.ok(token, 'CRM_DELIVERY_FAILED_TOKEN is not declared as a literal in lib/config.ts any more')
  assert.equal(
    token[1],
    CRM_DELIVERY_FAILED_TOKEN,
    'the CDK copy of the delivery-failure token and the function copy have drifted, so the ' +
      'metric filter in lib/amplify-stack.ts matches nothing and every dropped lead is ' +
      'observable NOWHERE - the handler catches, so AWS/Lambda Errors reads 0.',
  )

  const media = /DEMO_INTAKE_CONTENT_TYPE\s*=\s*'([^']+)'/.exec(config)
  assert.ok(media, 'DEMO_INTAKE_CONTENT_TYPE is not declared as a literal in lib/config.ts any more')
  assert.equal(
    media[1],
    REQUIRED_CONTENT_TYPE,
    'the required media type has drifted between its two copies. It is a CORS control: the ' +
      'value must not be one of the three CORS-safelisted Content-Types, or a cross-origin ' +
      'POST is sent with no preflight again.',
  )
  for (const safelisted of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data']) {
    assert.notEqual(
      REQUIRED_CONTENT_TYPE,
      safelisted,
      `the required media type is '${safelisted}', which IS CORS-safelisted - so requiring it ` +
        'forces no preflight and the fence is inert.',
    )
  }
})

// ------------------- 10. G3681: the answer is independent of the CRM, by time

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 G3681, 3 Oct 2026 — THE OWNER'S RULING, CLOSING G2007: *"Queue it: the
 *    intake enqueues and returns immediately; a worker delivers to the CRM.
 *    Constant-time answer."*
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * G2001 made the STATUS independent of the CRM and named what it left open:
 * *"the time to it still does"*. `deliver()` AWAITED the CRM, so a CRM that
 * 404s an unknown referral code faster than it writes a lead row published its
 * verdict as latency. **The assertion that closes it is not a stopwatch** — a
 * wall-clock bound is a flaky test of a property — **it is a CRM that never
 * settles**: if the request path awaited the CRM, `answer()` could not resolve
 * at all. Witnessed RED by putting one `await fetch(...)` back into `answer()`
 * before the `return`: every arm below times out.
 */
test('test_the_answer_never_awaits_the_crm_whatever_the_crm_does', async () => {
  const answers = new Set()
  for (const [name, crm] of Object.entries(CRM_DOUBLES)) {
    await withCrm(crm, async (calls) => {
      const queue = recordingQueue()
      const started = performance.now()
      const raced = await Promise.race([
        answer({ event: postEvent(JSON.stringify({ name: 'Ada', referralCode: 'GUESS-0001' })), enqueue: queue, log: silent }),
        new Promise((resolve) => setTimeout(() => resolve('TIMED_OUT'), 1_000).unref()),
      ])
      const elapsed = performance.now() - started
      assert.notEqual(
        raced,
        'TIMED_OUT',
        `against a ${name} CRM the intake did not answer within a second. The request path is ` +
          'waiting on the CRM, which is G2007`s timing oracle reopened.',
      )
      assert.equal(calls.length, 0, `against a ${name} CRM the request path called it ${calls.length} time(s)`)
      assert.equal(queue.sent.length, 1, 'the lead was not enqueued')
      assert.ok(elapsed < 1_000)
      answers.add(JSON.stringify(raced))
    })
  }
  assert.deepEqual([...answers], [JSON.stringify(ACCEPTED)], 'the answer varied with the CRM')
})

/**
 * 🛑 AND THE ANSWER HAS EXACTLY TWO INPUTS: the request, and whether the one
 * `SendMessage` succeeded. A failed send is a 502 that wears
 * `intake_unavailable` and is the SAME for every lead — it is a fact about our
 * queue, never about the caller (the body is capped at 8 KiB against SQS's
 * 256 KiB, so no lead can make the send fail where another succeeds).
 */
test('test_a_failed_enqueue_is_one_uniform_502_and_never_a_202', async () => {
  const answers = new Set()
  for (const intake of [{ referralCode: 'PARTNER-LIVE' }, { referralCode: 'GUESS-0001' }, { email: 'a@b.example' }]) {
    answers.add(JSON.stringify(await answer({ event: postEvent(JSON.stringify(intake)), enqueue: recordingQueue({ fails: true }), log: silent })))
  }
  assert.equal(answers.size, 1)
  const only = JSON.parse([...answers][0])
  assert.equal(only.statusCode, 502, 'a lead the queue refused was thanked - a form submission that reaches nobody')
  assert.equal(JSON.parse(only.body).code, INTERNAL_FAILURE_WIRE_CODE)

  /* And validation PRECEDES the queue: a malformed lead meets its own 400 and
   * is never enqueued (tests/e2e/browser-login.test.ts §28b relies on it). */
  const queue = recordingQueue()
  const malformed = await answer({ event: postEvent('{"tenantId":"ten_acme"}'), enqueue: queue, log: silent })
  assert.equal(malformed.statusCode, 400)
  assert.equal(queue.sent.length, 0)
})

/**
 * 🛑 THE LEGIBLE HALF OF THE FENCE: `index.mjs` imports nothing from
 * `worker.mjs`, calls no `fetch` and names no Secrets Manager client. **The
 * load-bearing half is IAM** — the intake's role cannot read the CRM secret
 * (`tests/infra/amplify.test.mjs` §5) — because both files ship in one zip.
 * Comments are stripped first: this file's own header discusses `fetch` and the
 * worker at length, and a grep for a name in a file that discusses the name
 * measures the discussion (G978).
 */
test('test_the_public_function_imports_no_worker_code_and_makes_no_outbound_call', () => {
  const source = readFileSync(join(INTAKE_DIR, 'index.mjs'), 'utf8')
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const statics = [...code.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]).sort()
  assert.deepEqual(statics, ['./guards.mjs', './message.mjs'], `index.mjs imports ${JSON.stringify(statics)}`)
  const dynamics = [...code.matchAll(/import\(\s*'([^']+)'\s*\)/g)].map((m) => m[1])
  assert.deepEqual(dynamics, ['@aws-sdk/client-sqs'], `index.mjs dynamically imports ${JSON.stringify(dynamics)}`)
  assert.doesNotMatch(code, /\bfetch\s*\(/, 'the public function makes an outbound HTTP call')
  assert.doesNotMatch(code, /secrets-manager|SecretsManager|RECONCILE_CRM_SECRET_NAME/, 'the public function names the CRM secret')

  /* Anti-vacuity: the stripper did not strip the code it is reading. */
  assert.match(code, /export async function answer/)
  assert.match(code, /SendMessageCommand/)
})

/**
 * 🛑 WHAT THE INTAKE PUTS ON THE QUEUE IS EXACTLY WHAT THE WORKER READS BACK —
 * the round trip is the contract between two processes that share no memory,
 * and a drift here is every lead dead-lettered as `message_unreadable`.
 */
test('test_the_enqueued_message_round_trips_through_the_worker_and_a_foreign_one_is_refused', async () => {
  const lead = { name: 'Ada', company: 'Acme', referralCode: 'PARTNER-LIVE' }
  const queue = recordingQueue()
  await answer({ event: postEvent(JSON.stringify(lead)), enqueue: queue, log: silent })
  assert.deepEqual(readQueuedLead({ body: queue.sent[0] }), lead)
  assert.equal(JSON.parse(queue.sent[0]).source, INTAKE_MESSAGE_SOURCE)

  for (const body of [
    'not json',
    JSON.stringify({ source: 'elsewhere', lead }),
    JSON.stringify({ source: INTAKE_MESSAGE_SOURCE, lead: { ...lead, tenantId: 'ten_acme' } }),
    JSON.stringify({ source: INTAKE_MESSAGE_SOURCE }),
    undefined,
  ]) {
    assert.equal(readQueuedLead({ body }), undefined, `the worker read ${String(body)} as a lead`)
  }

  /* An unreadable message is retried-then-dead-lettered and logged, and the
   * CRM is not called for it. */
  const lines = []
  const crm = recordingFetch()
  const report = await work({ event: sqsEvent('not json', intakeMessage(lead)), readConfig: async () => CONFIG, fetchImpl: crm, log: { error: (...a) => lines.push(a) } })
  assert.deepEqual(report, { batchItemFailures: [{ itemIdentifier: 'm-0' }] })
  assert.equal(crm.calls.length, 1, 'the readable lead was not delivered, or the unreadable one was')
  assert.equal(lines[0][0], CRM_DELIVERY_FAILED_TOKEN)
})

/**
 * 🛑 DAY ONE: THE SECRET IS EMPTY BY DESIGN (G1971). The intake cannot see
 * that any more, so the WORKER is where it is loud — every lead is a retry
 * (and then a dead letter, never a drop), every attempt writes the token the
 * alarm watches, and the CRM is not called with a configuration nobody wrote.
 */
test('test_an_unconfigured_crm_fails_every_lead_loudly_into_a_retry_and_calls_nothing', async () => {
  const lines = []
  const crm = recordingFetch()
  const report = await work({
    event: sqsEvent(intakeMessage({ name: 'Ada' }), intakeMessage({ name: 'Grace' })),
    readConfig: async () => {
      throw new IntakeRefusal('crm_not_configured', 502, 'endpoint is empty')
    },
    fetchImpl: crm,
    log: { error: (...a) => lines.push(a) },
  })
  assert.deepEqual(report.batchItemFailures.map((f) => f.itemIdentifier), ['m-0', 'm-1'])
  assert.equal(crm.calls.length, 0)
  assert.equal(lines.length, 2)
  for (const line of lines) {
    assert.equal(line[0], CRM_DELIVERY_FAILED_TOKEN)
    assert.equal(line[1].reason, 'crm_not_configured')
    assert.equal(JSON.stringify(line).includes('Ada') || JSON.stringify(line).includes('Grace'), false)
  }
})

// ------------------- 11. the PipelinePulse `LeadCreate` mapping (G3731–G3736)

/**
 * 🛑 THE OWNER'S RULINGS OF 4 Oct 2026, VERBATIM. AUTH: *"You add a service
 * token: someone on the CRM side issues a long-lived service/API token for
 * this integration and puts it in the reconcile-staging-crm-lead-intake
 * secret; build the worker mapping now."* DEFAULTS: *"Use these: motion
 * ReconcileAI, unit Marketing Lead, SEA region, status MQL, source
 * 'reconcileai.app demo'; the rest of the form goes into SDR notes."*
 *
 * The body is asserted EXACTLY — every key, every value, the key order and
 * the absence of anything else — because PipelinePulse's `LeadCreate` is
 * `additionalProperties: false`, so one stray key is a 422 on every lead.
 *
 * Witnessed RED first: against the pre-G3731 worker the CRM double received
 * `{"source":"reconcileai.app/demo","lead":{…}}` — no `company_name`, no ids,
 * the envelope no CRM had ever agreed to — and both assertions below failed.
 */
test('test_a_full_intake_becomes_exactly_one_lead_create_with_a_bearer_header_and_the_env_ids', async () => {
  const intake = {
    name: 'Ada Lovelace',
    email: 'ada@analytical.example',
    company: 'Analytical Engines Pte Ltd',
    reconcilingToday: 'Bank to ledger, daily.\nIntercompany monthly.',
    volume: '12,000 lines a month',
    ownAwsAccount: 'yes',
    referralCode: 'PARTNER-LIVE',
  }
  const crm = recordingFetch({ status: 201 })
  const report = await work({ event: sqsEvent(intakeMessage(intake)), readConfig: async () => CONFIG, fetchImpl: crm, log: silent })
  assert.deepEqual(report, { batchItemFailures: [] })
  assert.equal(crm.calls.length, 1)
  const [{ url, init }] = crm.calls
  assert.equal(url, CONFIG.endpoint)
  assert.equal(init.method, 'POST')
  assert.deepEqual(init.headers, { 'content-type': 'application/json', authorization: 'Bearer not-a-real-token' })
  assert.equal(
    init.body,
    JSON.stringify({
      company_name: 'Analytical Engines Pte Ltd',
      lead_status: 'MQL',
      business_region_id: 'region-from-env',
      gtm_motion_id: 'motion-from-env',
      business_unit_id: 'unit-from-env',
      source: 'reconcileai.app demo',
      contact_name: 'Ada Lovelace',
      email: 'ada@analytical.example',
      company_domain: 'analytical.example',
      sdr_notes: [
        SDR_NOTES_PREAMBLE,
        'What they reconcile today: Bank to ledger, daily.\nIntercompany monthly.',
        'Volume: 12,000 lines a month',
        'Own AWS account: yes',
        'Referral code (not checked): PARTNER-LIVE',
      ].join('\n'),
    }),
  )
})

test('test_a_minimal_intake_sends_only_the_required_fields_and_omits_every_absent_one', () => {
  assert.deepEqual(leadCreateFor({ company: 'Acme' }, DEFAULTS), {
    ok: true,
    body: {
      company_name: 'Acme',
      lead_status: 'MQL',
      business_region_id: 'region-from-env',
      gtm_motion_id: 'motion-from-env',
      business_unit_id: 'unit-from-env',
      source: 'reconcileai.app demo',
    },
  })
  /* A free-mail address is forwarded but is NOT a company domain — the CRM
   * calls `company_domain` a dedup key, and every gmail.com prospect would
   * collapse into one lead. */
  const freeMail = leadCreateFor({ company: 'Acme', name: 'Grace', email: 'grace@Gmail.com' }, DEFAULTS)
  assert.equal(freeMail.ok && freeMail.body.email, 'grace@Gmail.com')
  assert.equal(freeMail.ok && 'company_domain' in freeMail.body, false)
  /* A non-address is moved into the notes VERBATIM rather than sent to a
   * `format: email` field that would 422 on every retry. */
  const typo = leadCreateFor({ company: 'Acme', email: 'grace at acme' }, DEFAULTS)
  assert.equal(typo.ok && 'email' in typo.body, false)
  assert.equal(typo.ok && typo.body.sdr_notes, `${SDR_NOTES_PREAMBLE}\nEmail (as typed, not an address): grace at acme`)
})

/**
 * 🛑 `company_name` IS REQUIRED BY `LeadCreate` AND NO INTAKE FIELD IS, so a
 * company-less lead is refused BEFORE the CRM is called — and refused into a
 * retry and a dead letter, never dropped, and never given an invented company.
 */
test('test_a_lead_with_no_company_is_unmappable_calls_nothing_and_is_never_dropped', async () => {
  assert.deepEqual(leadCreateFor({ name: 'Ada', email: 'ada@x.example' }, DEFAULTS), { ok: false, reason: 'lead_unmappable' })
  const lines = []
  const crm = recordingFetch()
  const report = await work({
    event: sqsEvent(intakeMessage({ name: 'Ada', email: 'ada@x.example' })),
    readConfig: async () => CONFIG,
    fetchImpl: crm,
    log: { error: (...a) => lines.push(a) },
  })
  assert.deepEqual(report, { batchItemFailures: [{ itemIdentifier: 'm-0' }] })
  assert.equal(crm.calls.length, 0)
  assert.deepEqual(lines, [[CRM_DELIVERY_FAILED_TOKEN, { reason: 'lead_unmappable' }]])
})

/**
 * 🛑 G3734: A 422 IS STILL A RETRY AND THEN A DEAD LETTER, NEVER A DELETE —
 * the queued message is the only copy of the lead in this account, and a 422
 * usually means a stale id in `lib/config.ts`, which a person fixes and then
 * redrives. What changes is the REASON, so the log names which person to call.
 */
test('test_a_crm_422_401_and_500_are_retries_with_three_distinct_reasons', async () => {
  for (const [status, reason] of [[422, 'crm_rejected'], [401, 'crm_unauthorised'], [403, 'crm_unauthorised'], [500, 'crm_status'], [409, 'crm_status']]) {
    assert.equal(crmFailureReason(status), reason)
    const lines = []
    const report = await work({
      event: sqsEvent(intakeMessage({ company: 'Acme', name: 'Ada Lovelace' })),
      readConfig: async () => CONFIG,
      fetchImpl: recordingFetch({ status }),
      log: { error: (...a) => lines.push(a) },
    })
    assert.deepEqual(report, { batchItemFailures: [{ itemIdentifier: 'm-0' }] }, `status ${status} was not retried`)
    assert.deepEqual(lines, [[CRM_DELIVERY_FAILED_TOKEN, { reason, detail: `crm status ${status}` }]])
  }
})

/**
 * 🛑 THE IDS COME FROM THE ENVIRONMENT, AND AN UNSET ONE IS A REFUSAL — NEVER
 * A FALLBACK THAT FILES A PROSPECT UNDER A MOTION NOBODY CHOSE (G3733).
 */
test('test_the_lead_defaults_are_read_from_the_environment_and_a_missing_one_is_refused', () => {
  const env = {
    RECONCILE_CRM_GTM_MOTION_ID: 'm',
    RECONCILE_CRM_BUSINESS_UNIT_ID: 'u',
    RECONCILE_CRM_BUSINESS_REGION_ID: 'r',
    RECONCILE_CRM_LEAD_STATUS: 'MQL',
    RECONCILE_CRM_LEAD_SOURCE: 'reconcileai.app demo',
  }
  assert.deepEqual(readLeadDefaults(env), {
    ok: true,
    defaults: { gtm_motion_id: 'm', business_unit_id: 'u', business_region_id: 'r', lead_status: 'MQL', source: 'reconcileai.app demo' },
  })
  for (const name of Object.keys(env)) {
    assert.deepEqual(readLeadDefaults({ ...env, [name]: '' }), { ok: false, missing: [name] })
    const without = { ...env }
    delete without[name]
    assert.deepEqual(readLeadDefaults(without), { ok: false, missing: [name] })
  }
  assert.equal(readLeadDefaults({ ...env, RECONCILE_CRM_LEAD_SOURCE: 'x'.repeat(101) }).ok, false, 'LeadCreate.source is maxLength 100')
})

/**
 * 🛑 THE DEFAULTS ARE WRITTEN TWICE — `DEMO_INTAKE_CRM_LEAD_DEFAULT_ENV` in
 * `lib/config.ts` and `LEAD_DEFAULT_ENV` in `lead.mjs` — and the seam is a zip
 * file, so they are joined here in both directions, and the owner's values
 * are pinned at their one home.
 */
test('test_the_lead_default_env_names_and_the_owner_values_have_not_drifted', () => {
  const config = readFileSync(join(INFRA_DIR, 'lib', 'config.ts'), 'utf8')
  const envBlock = /DEMO_INTAKE_CRM_LEAD_DEFAULT_ENV:[^=]*=\s*\{([\s\S]*?)\}/.exec(config)
  assert.ok(envBlock, 'DEMO_INTAKE_CRM_LEAD_DEFAULT_ENV not found in lib/config.ts')
  const configNames = [...envBlock[1].matchAll(/'(RECONCILE_CRM_[A-Z_]+)'/g)].map((m) => m[1]).sort()
  assert.deepEqual(configNames, Object.values(LEAD_DEFAULT_ENV).sort())

  const values = /DEMO_INTAKE_CRM_LEAD_DEFAULTS\s*=\s*\{([\s\S]*?)\}\s*as const/.exec(config)
  assert.ok(values, 'DEMO_INTAKE_CRM_LEAD_DEFAULTS not found in lib/config.ts')
  const pairs = Object.fromEntries([...values[1].matchAll(/(\w+):\s*'([^']*)'/g)].map((m) => [m[1], m[2]]))
  assert.deepEqual(pairs, {
    gtmMotionId: '69b719bd-b86a-41f0-a3a4-5256cef59ca8',
    businessUnitId: 'c39a4e1c-5127-484c-b8a9-bff0becaa8ff',
    businessRegionId: 'a02f4c75-dd7b-4789-8f9d-3d500a1a83e8',
    leadStatus: 'MQL',
    source: 'reconcileai.app demo',
  })

  /* And the worker body names none of them: the ids live in config only. */
  for (const file of ['worker.mjs', 'lead.mjs']) {
    const source = readFileSync(join(INTAKE_DIR, file), 'utf8')
    for (const id of [pairs.gtmMotionId, pairs.businessUnitId, pairs.businessRegionId]) {
      assert.equal(source.includes(id), false, `${file} hard-codes ${id}`)
    }
  }
})
