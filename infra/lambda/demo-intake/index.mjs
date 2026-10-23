/**
 * THE DEMO INTAKE — S5, 22 Sep 2026. The public marketing plane's one write.
 * **AND SINCE G3681, 3 Oct 2026, IT NO LONGER TALKS TO THE CRM AT ALL.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE OWNER'S RULING, VERBATIM, CLOSING G2007: *"Queue it: the intake
 *    enqueues and returns immediately; a worker delivers to the CRM.
 *    Constant-time answer."*
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This function validates the request (method, media type, size, the closed
 * field set and its caps — `guards.mjs`, unchanged), sends ONE message to the
 * intake queue, and answers `ACCEPTED`. **The CRM is not on this path, so
 * nothing the CRM does — its status, its body, its LATENCY — can reach the
 * answer.** `worker.mjs`, on an SQS event source, delivers; this file imports
 * nothing from it.
 *
 *   ⛔ It holds no CRM credential and no verb that could read one. Its whole
 *      IAM is `sqs:SendMessage` on ONE queue and stream writes to ONE log
 *      group — `tests/infra/amplify.test.mjs` §5 reads the synthesised policy.
 *   ⛔ It makes no outbound call but `SendMessage` — no `fetch` —
 *      `tests/infra/demo-intake.test.mjs` §10 reads the source.
 *   ⛔ It never writes the intake to its own log. A lead is a named person at a
 *      named employer; `docs/tech-stack.md` §12.1 forbids a query string in a
 *      log line for a weaker reason than this one.
 *
 * ┌─ WHAT "CONSTANT-TIME" MEANS HERE, PRECISELY ──────────────────────────────┐
 * │ The answer's TIME depends on validation (a function of the request's     │
 * │ own size and shape, which the sender already knows) and on one SQS       │
 * │ `SendMessage`, whose latency is blind to which referral code or which    │
 * │ email the body carries. **It is not a fixed wall-clock duration** — SQS  │
 * │ has jitter like any network call — and it is not padded to one, because  │
 * │ padding would bound a channel that no longer carries the CRM's verdict.  │
 * │ What is closed is the channel G2007 named: the time to the answer no     │
 * │ longer contains the CRM's time to ITS answer.                            │
 * │                                                                           │
 * │ ⚠️ AND G1971's LOUDNESS MOVED: an unconfigured CRM secret used to be a   │
 * │ 502 here; this function cannot know the secret's state now, so a fresh   │
 * │ stack answers 202 and the WORKER fails every lead into the dead-letter   │
 * │ queue, minting `CrmDeliveryFailed` on its first attempt. The loud half   │
 * │ is the alarm; `docs/build/deploy-handoff.md` §27 is the redrive.         │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 🛑 G2001, 22 Sep 2026 — THE ORACLE THAT WAS OPEN, KEPT AS HISTORY ───────┐
 * │                                                                           │
 * │ The first draft of this file delegated the answer to the CRM and          │
 * │ republished the verdict as one bit of HTTP status: `referralCode=         │
 * │ PARTNER-ACME-2026` → 202 and `GUESS-0001` → 502, at a public URL with no  │
 * │ credential. G2001 closed the STATUS by giving `deliver()` one `return`    │
 * │ and no `throw` — and named, in this file, what it did not close:          │
 * │                                                                           │
 * │   *"🛑 WHAT IS NOT CLOSED, NAMED RATHER THAN LEFT TO BE FOUND: LATENCY.   │
 * │    The status no longer varies; the time to it still does, because a CRM  │
 * │    that 404s an unknown code may answer faster than one that writes a     │
 * │    row. … The repair is to put the lead on a queue and answer before the  │
 * │    CRM is touched at all … an owner's ruling rather than a remediation.   │
 * │    G2007 carries it."*                                                    │
 * │                                                                           │
 * │ **That ruling is G3681 and this file is its request half.** The sentence  │
 * │ is quoted rather than kept in the present tense, because it is no longer  │
 * │ true of this function.                                                    │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ THE AWS SDK IS IMPORTED DYNAMICALLY AND THAT IS NOT STYLE — it is the same
 * reason `tenant-key-minter/index.mjs` gives. `@aws-sdk/*` is bundled with the
 * `nodejs22.x` runtime and is on disk nowhere in this repository outside
 * `server/` (fenced by `tests/ci/aws-sdk-scope.test.ts`). A static import would
 * make this file unloadable by `tests/infra/demo-intake.test.mjs` and by
 * `tests/e2e/apex-origin.ts`, which both execute it.
 */

import {
  ACCEPTED,
  IntakeRefusal,
  readBody,
  readContentType,
  readIntake,
  readMethod,
  refusalResponse,
} from './guards.mjs'
import { intakeMessage } from './message.mjs'

/**
 * Validate, enqueue, answer. THE PURE-ISH HALF: the queue is an argument, so a
 * test drives it with no credentials, no network and no CRM in existence.
 *
 * ┌─ 🛑 THE ANSWER HAS EXACTLY TWO INPUTS ────────────────────────────────────┐
 * │ The request, and whether ONE `SendMessage` succeeded. There is no third,  │
 * │ because there is no CRM in scope: `tests/infra/demo-intake.test.mjs` §10  │
 * │ installs slow, failing and succeeding CRM doubles on `globalThis.fetch`   │
 * │ and requires the identical answer, ZERO calls to any of them, and an      │
 * │ answer that arrives while a never-settling CRM is still pending.          │
 * │                                                                           │
 * │ ⚠️ A FAILED `SendMessage` IS A 502, AND THAT IS NOT A REOPENING OF G2001: │
 * │ it is a fact about OUR queue — the body is capped at 8 KiB against SQS's  │
 * │ 256 KiB, so no lead can make the send fail and another succeed — and it   │
 * │ wears `intake_unavailable` on the wire like every other 5xx (G2005).      │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE `content-type` CHECK IS THE CROSS-ORIGIN FENCE AND IT IS SECOND, NOT
 * FIRST. A preflight `OPTIONS` must meet the METHOD refusal, because that is
 * the refusal that carries no `Access-Control-Allow-Origin` and therefore fails
 * the preflight. `guards.mjs`'s `readContentType` block carries the argument.
 *
 * ⚠️ AND VALIDATION PRECEDES THE QUEUE, so an unconfigured queue is reached
 * only by a well-formed lead — a malformed one meets its own 400 first, which
 * `tests/e2e/browser-login.test.ts` §28b relies on.
 *
 * @param {object} deps
 * @param {unknown} deps.event
 * @param {(body: string) => Promise<void>} deps.enqueue
 * @param {{ error: (...args: unknown[]) => void }} [deps.log]
 */
export async function answer({ event, enqueue, log = console }) {
  try {
    if (readMethod(event) !== 'POST') {
      throw new IntakeRefusal('intake_method_not_allowed', 405)
    }
    readContentType(event)
    const intake = readIntake(readBody(event))
    await enqueue(intakeMessage(intake))
    return ACCEPTED
  } catch (error) {
    if (error instanceof IntakeRefusal) {
      /* The INTERNAL code reaches the log; `refusalResponse` collapses every
       * 5xx to one wire code (G2005), so this line is the only place the
       * distinction survives. */
      if (error.status >= 500) log.error('demo-intake:', error.message)
      return refusalResponse(error)
    }
    /* Anything else is a defect in this file. It must not become a 202 and it
     * must not carry its own words to the caller. */
    log.error('demo-intake: unhandled', String(error))
    return refusalResponse(new IntakeRefusal('intake_unavailable', 500))
  }
}

/** One client per execution environment, built on first use. */
let sqsClient

/**
 * Send one message to the intake queue named by the environment.
 *
 * ⚠️ AN UNSET QUEUE URL IS A 502 AND NEVER A QUIET 202 — the same loudness
 * G1971 asked of the secret: a stack whose wiring is broken says so rather
 * than thanking a visitor into a void. It is the same answer for every caller.
 *
 * @param {string} body
 */
export async function sqsEnqueue(body) {
  const queueUrl = process.env.RECONCILE_DEMO_INTAKE_QUEUE_URL
  if (typeof queueUrl !== 'string' || queueUrl === '') {
    throw new IntakeRefusal('intake_queue_not_configured', 502, 'RECONCILE_DEMO_INTAKE_QUEUE_URL is unset')
  }
  const sdk = await import('@aws-sdk/client-sqs')
  sqsClient ??= new sdk.SQSClient({})
  try {
    await sqsClient.send(new sdk.SendMessageCommand({ QueueUrl: queueUrl, MessageBody: body }))
  } catch (cause) {
    /* The SDK's own words, never the body. */
    throw new IntakeRefusal('intake_queue_unavailable', 502, String(cause?.name ?? cause))
  }
}

/**
 * The Lambda Function URL entry point.
 *
 * ⚠️ THE FUNCTION URL'S AUTH TYPE IS `NONE` AND THAT IS STATED ON THE STACK
 * RATHER THAN HERE, BUT IT IS WHY THE GUARDS ARE THE FENCE: the URL is
 * reachable directly, not only through Amplify's rewrite, because Amplify's
 * proxy signs nothing and `AWS_IAM` would refuse it. So nothing about being
 * behind the apex may be assumed by this handler.
 */
export async function handler(event) {
  return answer({ event, enqueue: sqsEnqueue })
}
