/**
 * THE DEMO INTAKE'S WORKER — G3681–G3684, 3 Oct 2026. THE OWNER'S RULING,
 * VERBATIM, CLOSING G2007: *"Queue it: the intake enqueues and returns
 * immediately; a worker delivers to the CRM. Constant-time answer."*
 *
 * 🛑 THIS IS NOW THE ONLY CODE IN THIS ACCOUNT THAT REACHES THE CRM, AND IT IS
 * REACHED BY NO URL. Its trigger is an SQS event source on the intake queue;
 * its role is the only one that may read the CRM secret; and `index.mjs` — the
 * public function — imports nothing from this file, holds no secret verb and
 * makes no outbound call (`tests/infra/demo-intake.test.mjs` §10 reads the
 * source, `tests/infra/amplify.test.mjs` §5 reads the synthesised policy).
 *
 * ⚠️ THE TWO FILES SHARE ONE ASSET DIRECTORY, AND THAT IS NOT THE FENCE. Both
 * functions deploy the same zip (one `guards.mjs`, one copy of the field set)
 * and differ in `handler` and in ROLE. So the intake's zip CONTAINS this code
 * and cannot USE it: without `secretsmanager:GetSecretValue` the first call in
 * `crmConfig()` is an `AccessDenied`. **The fence is IAM**, and the source
 * check is the legible half.
 *
 * ┌─ WHAT A FAILED DELIVERY DOES NOW ─────────────────────────────────────────┐
 * │ G2001 and G2006 hold unchanged in shape, one process over: the CRM's      │
 * │ verdict is REPORTED — `CRM_DELIVERY_FAILED_TOKEN` to this function's own  │
 * │ log, which the metric filter in `lib/amplify-stack.ts` counts and the     │
 * │ alarm in `lib/observability-stack.ts` watches — and it reaches no visitor,│
 * │ because the visitor was answered before this function ever ran.          │
 * │                                                                           │
 * │ 🟢 **AND A FAILURE IS NOW RETRIED RATHER THAN LOST.** The record is       │
 * │ reported back as a `batchItemFailure`, SQS redelivers it after the        │
 * │ visibility timeout, and after `DEMO_INTAKE_QUEUE_MAX_RECEIVE_COUNT`       │
 * │ receives it is dead-lettered and kept for fourteen days. Before this, a   │
 * │ CRM that was down for one request dropped that lead for ever.             │
 * │                                                                           │
 * │ ⚠️ SO THE METRIC COUNTS ATTEMPTS, NOT LEADS — one lead can mint up to     │
 * │ five datapoints. The alarm is `> 0`, so it fires on the first either way. │
 * │ ⚠️ AND A CRM 4xx IS RETRIED TOO, deliberately: this file does not decide  │
 * │ that a CRM's refusal is permanent, because a 401 from a mis-set header is │
 * │ a 4xx a person fixes. The dead-letter queue is where a lead the CRM never │
 * │ accepted waits for a person, rather than a branch here choosing to delete │
 * │ it.                                                                       │
 * │                                                                           │
 * │ 🛑 G3734, 4 Oct 2026 — INCLUDING A 422, WHICH NO RETRY CAN CURE, AND THAT │
 * │ IS ARGUED RATHER THAN OVERLOOKED. PipelinePulse answers `LeadCreate`      │
 * │ validation failures with 422, and the same body will be refused the same  │
 * │ way four more times. The alternative — deleting the message on a 422 —    │
 * │ was REFUSED: this function logs NO lead data by rule, so the queued       │
 * │ message is the ONLY copy of a real prospect's name, employer and email    │
 * │ anywhere in this account, and a 422 usually means OUR side is wrong (a    │
 * │ stale motion/unit/region id in `lib/config.ts`) — which a person fixes    │
 * │ and then REDRIVES. A third option, sending straight to the DLQ, needs     │
 * │ `sqs:SendMessage` on it, a second write verb on this role for a           │
 * │ saving of four CRM calls. **The cost is bounded and named**: at most      │
 * │ `DEMO_INTAKE_QUEUE_MAX_RECEIVE_COUNT` calls and as many metric            │
 * │ datapoints per bad lead, at concurrency two. What changes is the REASON:  │
 * │ `crm_rejected` for 422, `crm_unauthorised` for 401/403 (the service       │
 * │ token), `crm_status` for every other non-2xx, so an operator reading the  │
 * │ log knows which person to call before redriving.                          │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ THE AWS SDK IS IMPORTED DYNAMICALLY, for the reason `index.mjs` and
 * `tenant-key-minter/index.mjs` give: `@aws-sdk/*` ships with the runtime and
 * is on disk nowhere a test could load it.
 *
 * ⚠️ `crmConfig()` AND `attemptDelivery()` ARE MOVED FROM `index.mjs` RATHER
 * THAN REWRITTEN (G3682). The transport, the timeout, the SSRF fence in
 * `readCrmConfig()` and the cache-either-arm rule are the ones G2001–G2008
 * argued; what changed is only WHO waits for the CRM.
 */

import {
  CRM_DELIVERY_FAILED_TOKEN,
  CRM_PINNED_ORIGIN,
  IntakeRefusal,
  endpointIsPinned,
  readCrmConfig,
  readIntake,
} from './guards.mjs'
import { leadCreateFor, readLeadDefaults } from './lead.mjs'
import { INTAKE_MESSAGE_SOURCE } from './message.mjs'

/**
 * How long we wait for the CRM before giving up.
 *
 * ⚠️ IT IS SHORTER THAN THE FUNCTION'S OWN TIMEOUT ON PURPOSE. A fetch that
 * outlives the invocation is killed by Lambda with no log line and no answer,
 * so we learn nothing; an abort here is a refusal WE wrote, with a code an
 * operator can search for and a metric an alarm can watch.
 */
const CRM_TIMEOUT_MS = 5_000

/**
 * How long a read of the CRM secret — **value OR refusal** — is reused.
 *
 * ┌─ 🛑 G2008: THE OLD CACHE COULD NOT ENGAGE IN THE ONE STATE THE STACK IS ─┐
 * │    DESIGNED TO SHIP IN.                                                   │
 * │                                                                           │
 * │ The secret is created with `endpoint` EMPTY on purpose (G1971), so on day │
 * │ one every delivery goes through `readCrmConfig`, which **throws** — and   │
 * │ the old cache assigned only on the success path, so every request was a   │
 * │ `GetSecretValue`. **The outcome is cached now, refusal included**, so a   │
 * │ flood costs at most one call per environment per TTL.                     │
 * │                                                                           │
 * │ ⚠️ G3683: the cache moved with the CRM call into the worker, whose        │
 * │ concurrency is two rather than the intake's five, so the bound tightened. │
 * │ A person who fixes the secret sees deliveries resume within a minute.     │
 * └───────────────────────────────────────────────────────────────────────────┘
 */
export const CRM_CONFIG_CACHE_TTL_MS = 60_000

/**
 * The last read of the secret, and when it happened.
 *
 * ⚠️ IT HOLDS EITHER ARM. `{ at, config }` or `{ at, refusal }` — never
 * `undefined`-as-absence-of-a-success, which is the shape that produced G2008.
 */
let cached

/** Drop the cache. Exported for `tests/`; nothing in the function calls it. */
export function resetCrmConfigCache() {
  cached = undefined
}

/**
 * Read the CRM's endpoint and credential, at most once per TTL.
 *
 * @param {{ client: { send: (command: object) => Promise<object> }, command: (input: object) => object, secretId: string, now?: () => number }} deps
 */
export async function crmConfig({ client, command, secretId, now = Date.now }) {
  const at = now()
  if (cached !== undefined && at - cached.at < CRM_CONFIG_CACHE_TTL_MS) {
    if (cached.refusal !== undefined) throw cached.refusal
    return cached.config
  }
  let answer
  try {
    answer = await client.send(command({ SecretId: secretId }))
  } catch (cause) {
    /* 🛑 A FAILED READ IS CACHED TOO, AND THAT IS THE POINT RATHER THAN AN
     * OVERSIGHT: a throttled or denied `GetSecretValue` under a flood is
     * exactly when retrying every request makes the throttling worse. */
    const refusal = new IntakeRefusal('crm_not_configured', 502, `secret unreadable: ${String(cause)}`)
    cached = { at, refusal }
    throw refusal
  }
  try {
    const config = readCrmConfig(answer?.SecretString)
    cached = { at, config }
    return config
  } catch (refusal) {
    cached = { at, refusal }
    throw refusal
  }
}

/**
 * Attempt one delivery. **It never throws for anything the CRM did**, and it
 * returns a report rather than a decision.
 *
 * 🛑 THE SPLIT IS THE CONTROL, AND SINCE G3681 IT IS A SPLIT BETWEEN TWO
 * PROCESSES. This returns a value `work()` may log and retry on and nothing
 * may publish — and nothing could: the visitor has already been answered.
 *
 * ⚠️ SINCE G3731 IT POSTS A PipelinePulse `LeadCreate` — `lead` is the body
 * `leadCreateFor()` built, sent as-is — and NOT the old
 * `{source, lead: <intake>}` envelope, which no CRM had ever agreed to.
 *
 * @param {object} deps
 * @param {{ endpoint: string, headerName: string, headerValue: string }} deps.config
 * @param {Record<string, string>} deps.lead
 * @param {typeof fetch} deps.fetchImpl
 * @returns {Promise<{ delivered: boolean, reason?: string, detail?: string }>}
 */
export async function attemptDelivery({ config, lead, fetchImpl }) {
  /* 🛑 G3861 — THE OWNER'S PIN, AT THE CALL ITSELF. `readCrmConfig()` already
   * refuses an off-origin secret; this is the seam a config built any other
   * way would reach, and it refuses WITHOUT calling `fetchImpl` — the lead,
   * the bearer token and the request never leave for an origin nobody
   * reviewed. Not a second rule: the same predicate, at the only line that
   * sends. */
  if (!endpointIsPinned(config.endpoint)) {
    return { delivered: false, reason: 'crm_endpoint_not_pinned', detail: `endpoint is not on ${CRM_PINNED_ORIGIN}` }
  }
  let answer
  try {
    answer = await fetchImpl(config.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [config.headerName]: config.headerValue,
      },
      body: JSON.stringify(lead),
      signal: AbortSignal.timeout(CRM_TIMEOUT_MS),
    })
  } catch (cause) {
    /* The transport's own words, never the intake. */
    return { delivered: false, reason: 'transport', detail: String(cause) }
  }
  if (answer.status < 200 || answer.status >= 300) {
    /* G3734: the reason names WHICH person fixes it; the response BODY is
     * never read, because a validation error may echo the lead back. */
    return { delivered: false, reason: crmFailureReason(answer.status), detail: `crm status ${answer.status}` }
  }
  return { delivered: true }
}

/**
 * The log reason for a non-2xx CRM answer — G3734.
 *
 * ⚠️ EVERY ARM IS STILL A RETRY. The reason changes what an operator reads,
 * not what the queue does (the header block argues why a 422 is not deleted).
 *
 * @param {number} status
 */
export function crmFailureReason(status) {
  if (status === 422) return 'crm_rejected'
  if (status === 401 || status === 403) return 'crm_unauthorised'
  return 'crm_status'
}

/**
 * Read one queue record back into a lead.
 *
 * ⚠️ THE LEAD IS RE-VALIDATED THROUGH `readIntake()`, AND NOT BECAUSE THE
 * QUEUE IS UNTRUSTED. Its only writer is the intake's role (`sqs:SendMessage`
 * on this one queue), so a malformed message is a defect rather than an
 * attack — and re-reading costs one parse, while forwarding a field the closed
 * set refuses would put something into the CRM no visitor could have sent.
 *
 * @param {{ body?: unknown }} record
 * @returns {Record<string, string> | undefined}
 */
export function readQueuedLead(record) {
  if (typeof record?.body !== 'string') return undefined
  let message
  try {
    message = JSON.parse(record.body)
  } catch {
    return undefined
  }
  if (message === null || typeof message !== 'object' || message.source !== INTAKE_MESSAGE_SOURCE) return undefined
  try {
    return readIntake(JSON.stringify(message.lead))
  } catch {
    return undefined
  }
}

/**
 * Deliver every record in one SQS batch, and report which failed.
 *
 * 🛑 IT RETURNS `batchItemFailures` AND NEVER THROWS FOR A LEAD. A throw would
 * fail the whole batch and redeliver leads that had already reached the CRM;
 * the partial-batch answer redelivers exactly the ones that did not. The
 * event source sets `reportBatchItemFailures`, without which this return
 * value is IGNORED and every record is deleted — `tests/infra/amplify.test.mjs`
 * asserts the flag on the template.
 *
 * ⚠️ AND EVERY LOG LINE IS THE TOKEN, A REASON AND A DETAIL — NEVER A FIELD
 * OF THE LEAD, the rule the intake has held since S5.
 *
 * @param {object} deps
 * @param {{ Records?: Array<{ messageId: string, body?: unknown }> }} deps.event
 * @param {() => Promise<{ endpoint: string, headerName: string, headerValue: string, defaults: Record<string, string> }>} deps.readConfig
 * @param {typeof fetch} deps.fetchImpl
 * @param {{ error: (...args: unknown[]) => void }} [deps.log]
 * @returns {Promise<{ batchItemFailures: Array<{ itemIdentifier: string }> }>}
 */
export async function work({ event, readConfig, fetchImpl, log = console }) {
  const records = Array.isArray(event?.Records) ? event.Records : []
  const failed = []
  let config
  for (const record of records) {
    const intake = readQueuedLead(record)
    if (intake === undefined) {
      log.error(CRM_DELIVERY_FAILED_TOKEN, { reason: 'message_unreadable' })
      failed.push(record.messageId)
      continue
    }
    if (config === undefined) {
      try {
        config = await readConfig()
      } catch (refusal) {
        /* Unconfigured or unreadable — day one, by design (G1971). The lead is
         * retried and then dead-lettered; it is never dropped here. */
        const reason = refusal instanceof IntakeRefusal ? refusal.code : 'crm_not_configured'
        log.error(CRM_DELIVERY_FAILED_TOKEN, { reason, detail: String(refusal?.message ?? refusal) })
        failed.push(record.messageId)
        continue
      }
    }
    /* G3731: map to the CRM's own `LeadCreate`. A lead it cannot accept
     * (no company — `company_name` is required) is refused HERE, without a
     * call, and goes the same retry-then-dead-letter way as everything else. */
    const mapped = leadCreateFor(intake, config.defaults)
    if (!mapped.ok) {
      log.error(CRM_DELIVERY_FAILED_TOKEN, { reason: mapped.reason })
      failed.push(record.messageId)
      continue
    }
    const outcome = await attemptDelivery({ config, lead: mapped.body, fetchImpl })
    if (!outcome.delivered) {
      log.error(CRM_DELIVERY_FAILED_TOKEN, { reason: outcome.reason, detail: outcome.detail })
      failed.push(record.messageId)
    }
  }
  return { batchItemFailures: failed.map((itemIdentifier) => ({ itemIdentifier })) }
}

/** The SQS event source's entry point. */
export async function handler(event) {
  return work({
    event,
    readConfig: async () => {
      const secretId = process.env.RECONCILE_CRM_SECRET_NAME
      if (typeof secretId !== 'string' || secretId === '') {
        throw new IntakeRefusal('crm_not_configured', 502, 'RECONCILE_CRM_SECRET_NAME is unset')
      }
      /* G3733: the owner's defaults come from the environment the stack
       * renders out of `lib/config.ts`, never from this file. An unset one is
       * the same loud `crm_not_configured` as an empty secret. */
      const read = readLeadDefaults(process.env)
      if (!read.ok) {
        throw new IntakeRefusal('crm_not_configured', 502, `lead defaults unset: ${read.missing.join(', ')}`)
      }
      const sdk = await import('@aws-sdk/client-secrets-manager')
      const config = await crmConfig({
        client: new sdk.SecretsManagerClient({}),
        command: (input) => new sdk.GetSecretValueCommand(input),
        secretId,
      })
      return { ...config, defaults: read.defaults }
    },
    fetchImpl: fetch,
  })
}
