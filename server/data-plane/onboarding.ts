/**
 * THE STAFF CONSOLE'S ONBOARDING PANEL — `GET`, `POST`, `POST`, and the FIRST
 * CONSOLE WRITES EITHER PLANE HAS EVER SERVED.
 *
 * **R8 and R9, 21 Sep 2026, BOTH THE OWNER'S. G1425–G1428 are DERIVED and say
 * so on their own faces**, as G190, G356, G511, G941, G961 and G1091 do.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS FILE MOUNTS RATHER THAN BUILDS — `server/data-plane/console-roster.ts`
 *    IS THE SHAPE AND ITS RULE GOVERNS HERE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The bodies are `server/data-plane/onboarding-store.ts`, minus the routes.
 * **No SQL is written here and no rule about the SEQUENCE exists here** — that
 * is `model/onboarding.ts`, reached through the store, and this file turns its
 * answers into status codes.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 G300'S THREE-PART TEST, DERIVED PER OPERATION, BECAUSE THAT RULING SAYS
 *    IN ITS OWN VOICE *"derive each; do not assert readiness"*.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   TABLE       `grep -c 'CREATE TABLE' db/migrations-control/0030_onboarding_record.sql`
 *               → 2. `onboarding_record` and `onboarding_forced_step`, G1241.
 *               **And for the two WRITES a table is not enough — a PRIVILEGE
 *               is the second half**, which is
 *               `db/migrations-control/0040_onboarding_writer.sql` (R9) and
 *               did not exist until this commit. `0030` granted `SELECT` to
 *               the reader and nothing to anybody else, by name.
 *   MODEL       `ONBOARDING_STEPS`, `onboardingSteps()`, `completeStep()` and
 *               `forceStep()` are `model/onboarding.ts`'s — G535 — and the
 *               store calls them rather than restating them.
 *   CAPABILITY  `grep -A1 'operationId: listOnboardingSteps' docs/contracts/administration.openapi.yaml`
 *               → `x-capability: view_substrate`. **THIS IS THE PART THAT WAS
 *               MISSING AND IT IS R8**: all three carried
 *               `x-capability: 'exempt: …'` until 21 Sep 2026, and an
 *               exemption is not a capability — `decide()` is never asked, and
 *               `mountTier()`'s FOURTH fence would have demanded
 *               `servedWithoutAGate()` at each of these three mounts.
 *
 * ⚠️ **AND THE THIRD PART WAS NOT MERELY UNWRITTEN — IT WAS UNREPRESENTABLE
 * UNTIL G911.** `TIER_REQUIRES_CAPABILITY` was per TIER and a tier is a FILE,
 * so gating an operation on `administration.openapi.yaml` meant cutting it
 * into a second document, which is what G781 did for fourteen others and
 * which the owner's own surviving objection calls *"still contract surgery and
 * still a ruling"*. Retiring that table made **annotating in place** the
 * cheaper of the two, and R8 takes it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE ACT'S RECORD AND THE ACT'S DATA ARE IN TWO DIFFERENT DATABASES —
 *    `console-roster.ts`'s SHAPE, AND HERE IT COVERS A WRITE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `authorisedHandler()`'s platform arm opens a SESSION scope on the DATA
 * database and writes `tenant.platform_authorization_grant` — invariant 10's
 * second home, G730 — and then runs the body. **The body ignores that `tx`**:
 * onboarding state is in the CONTROL database and is reached on its own
 * credential.
 *
 * ⚠️ **THE ORDER HOLDS AND THE LOST ATOMICITY IS ONE STEP WORSE HERE THAN IT
 * IS FOR A READ, WHICH IS NAMED RATHER THAN INHERITED QUIETLY.** The record is
 * written BEFORE the act, in a transaction that has not committed, so a body
 * that THROWS takes its own authorisation record down. What is lost is
 * atomicity in the other direction — and for `listTenants` that meant *a
 * record of an act whose RESULT nobody received*, which `console-roster.ts`
 * correctly calls the safe direction. **Here the act WRITES**, so the same
 * failure means a forced mark or an advanced counter that COMMITTED in the
 * control database while its authorisation record rolled back in the data one:
 * **a change to a delivery record with no trace of who authorised it.**
 *
 * 🛑 **THAT IS STILL THE SAFE DIRECTION OF THE TWO AVAILABLE, AND THE
 * ALTERNATIVE IS WORSE RATHER THAN BETTER.** Writing the record AFTER the act
 * would make the failure *an act with no record* in the ordinary case as well
 * as the exceptional one, which is what invariant 10 exists to refuse. A
 * two-phase commit across two PostgreSQL databases is the only shape that
 * closes it, and taking one is a ruling nobody has made. **The window is a
 * process death between one `COMMIT` and another**, it is named here, and
 * `db/migrations-control/0040`'s append-only trigger is what stops the
 * orphaned mark from being quietly edited afterwards.
 *
 * 🛑 `actingTenantOf()` IS NOT CALLED AND MUST NOT BE, for `console-roster.ts`'s
 * reason exactly: it THROWS for a platform grant by construction, and the
 * throw is invariant 8 speaking. These bodies read no tenant table and hold no
 * credential that could.
 *
 * ⚠️ **THE `{tenantId}` IN THE PATH IS A SUBJECT AND NEVER A SCOPE**, which is
 * the contract's own note on that parameter: *"the caller's authority comes
 * from a `TenantAccessGrant` that already names a tenant, and this value is
 * checked against it rather than establishing it."* **That sentence describes
 * the FDE path and not this one** — a platform principal holds no
 * `TenantAccessGrant`, and `view_substrate` is of class `substrate`, which
 * `PLATFORM_ASSIGNMENT_REACHES` opens over the whole fleet. So the value
 * narrows WHICH delivery record is read or written and narrows no authority at
 * all; invariant 1 is untouched because no tenant SCOPE is derived from it.
 */

import type { FastifyRequest } from 'fastify'

import { ONBOARDING_REFUSALS, type OnboardingRefusal } from '../../model/onboarding.ts'
import type { ControlPlaneClient } from './control-plane-client.ts'
import { sendProblem } from '../http/app.ts'
import { CODES } from '../http/problem.ts'
import type { AuthorisedBody, AuthorisedOperation } from './authorisation-record.ts'
import {
  ONBOARDING_READ_REFUSALS,
  completeOnboardingStepIn,
  forceOnboardingStepIn,
  onboardingStepKeyOf,
  readOnboardingSteps,
  type OnboardingReadRefusal,
  type OnboardingStepRow,
} from './onboarding-store.ts'

/**
 * The path parameters, read AFTER ajv.
 *
 * ⚠️ NEVER PARSED, ONLY READ. `TenantId` and `StepKey` are both
 * `{ type: string }` in the contract with no pattern and no `enum`, so these
 * are whatever the caller sent. `tenantId` goes into a bind parameter and
 * nowhere else; `stepKey` is narrowed against `ONBOARDING_STEPS` by the store,
 * which is the only place the closed set lives.
 */
function paramsOf(request: FastifyRequest): { tenantId: string; stepKey: string } {
  const p = request.params as Record<string, unknown> | undefined
  return {
    tenantId: typeof p?.['tenantId'] === 'string' ? p['tenantId'] : '',
    stepKey: typeof p?.['stepKey'] === 'string' ? p['stepKey'] : '',
  }
}

/**
 * A row-level refusal, turned into a status code exactly once.
 *
 * 🛑 THE 404 AND THE 500 ARE DIFFERENT KINDS OF FACT AND COLLAPSING THEM WOULD
 * LOSE THE ONE THAT CAN BE ACTED ON. `tenant_not_on_roster` is a fact about the
 * REQUEST — the caller named a tenant this platform does not have — and the
 * contract declares a 404 for it. The other three are facts about a ROW this
 * plane did not write and cannot repair, and `upstream_unavailable` is
 * `errors.yaml`'s own words for that: *"An unhandled failure below us. The only
 * honest code for a 500."*
 *
 * ⚠️ THE REASON AND THE TENANT GO TO THE PROCESS LOG AND NEVER TO THE CALLER,
 * which is every refusal on this plane. A 404 that distinguished *"no such
 * tenant"* from *"a tenant whose delivery record is unreadable"* would be an
 * existence oracle over the fleet for anybody who can authenticate.
 */
function sendReadRefusal(
  reply: Parameters<AuthorisedBody>[0]['reply'],
  operationId: string,
  tenantId: string,
  refusal: OnboardingReadRefusal,
): unknown {
  if (refusal === ONBOARDING_READ_REFUSALS.tenantNotOnRoster) {
    return sendProblem(reply, {
      status: 404,
      code: CODES.resourceNotFound,
      title: 'No such tenant.',
      detail: 'No tenant with that id is on the platform roster.',
    })
  }
  console.error(
    `data-plane: \`${operationId}\` refused — \`${refusal}\` on \`${tenantId}\`. The delivery ` +
      'record in the CONTROL database could not be read. See ' +
      '`server/data-plane/onboarding-store.ts` for what each refusal means and which writer ' +
      'owes the repair — `onboarding_record_absent` is `createTenant`’s, and it is declared ' +
      'and unmounted.',
  )
  return sendProblem(reply, {
    status: 500,
    code: CODES.upstreamUnavailable,
    title: 'This tenant’s onboarding record could not be read.',
    detail: 'A delivery record could not be read. The reason is in this plane’s log.',
  })
}

const listOnboardingStepsBody =
  (client: ControlPlaneClient): AuthorisedBody =>
  async ({ request, reply, grant }) => {
    const { tenantId } = paramsOf(request)
    const outcome = await readOnboardingSteps(client, tenantId, grant.id)
    if (!outcome.ok) {
      return sendReadRefusal(reply, 'listOnboardingSteps', tenantId, outcome.refusal)
    }
    return { steps: outcome.steps }
  }

/**
 * 🛑 THE READ TAKES THE **READ** POOL AND THE TWO WRITES TAKE THE **WRITE**
 * ONE, AND THE SPLIT IS NOT TIDINESS. `db/control-read-scope.ts` carries two
 * independent controls — a credential that cannot write, and `BEGIN READ ONLY`
 * which refuses a write per STATEMENT whatever the grant says. Routing this
 * read through the writer would spend both for nothing.
 */
export function listOnboardingStepsOperation(client: ControlPlaneClient): AuthorisedOperation {
  return {
    operationId: 'listOnboardingSteps',
    /**
     * ⚠️ `resourceType: 'Tenant'` — the ENTITY name from `model/domain.ts`,
     * never a path and never a table, exactly as `console-roster.ts` does it.
     * There is no `Onboarding` entity in `model/domain.ts` to name, and
     * inventing one for a `ResourceRef` would be a second vocabulary in the
     * one record invariant 10 keeps.
     */
    resourceType: 'Tenant',
    /**
     * ⚠️ AND UNLIKE `listTenants` THIS ONE IS INSTANCE-BOUND. That operation
     * passes `null` because *"opening a list"* names no instance; this act is
     * about ONE tenant's delivery record, and the id is what a review reads
     * off the record afterwards.
     */
    instanceOf: (request) => paramsOf(request).tenantId,
    body: listOnboardingStepsBody(client),
  }
}

/**
 * The model's verdicts, turned into status codes.
 *
 * 🛑 A TOTAL `Record` OVER `OnboardingRefusal`, SO A FIFTH REFUSAL IS A
 * COMPILE ERROR HERE rather than a verdict that falls through to a 500. The
 * two operations do not share a mapping, because the contract does not declare
 * the same responses for them — so each gets its own total record and each
 * arm is argued where it is written.
 */
interface VerdictAnswer {
  readonly status: number
  readonly code: string
  readonly title: string
  readonly detail: string
}

/**
 * `completeOnboardingStep` — ONE 409, and the contract names the code.
 *
 * 🛑 TWO MODEL REFUSALS COLLAPSE ONTO IT AND THE LOSS IS NAMED. The contract
 * declares exactly one 409 — *"`step_not_current` — the named step is not the
 * next one"* — and `errors.yaml`'s enum is CLOSED with no `step_already_done`
 * in it. **Both arms are true of the code**: a step already done is not the
 * next one. What a caller cannot tell from the answer is whether they were
 * early or late, and `model/onboarding.ts` can. Minting a second member is a
 * contract change and a ruling.
 *
 * ⚠️ THE OTHER TWO ARMS ARE UNREACHABLE HERE AND ARE ANSWERED ANYWAY.
 * `stepIsCurrent` and `reasonTooShort` are `forceStep()`'s, and `completeStep()`
 * cannot produce either — but the `Record` is total over the union rather than
 * over *"the arms I think this caller sees"*, because that judgement is exactly
 * what a fifth arm would invalidate. They answer a 500, which is the honest
 * code for *this plane reached a state it believes impossible*.
 */
const COMPLETE_VERDICT: Readonly<Record<OnboardingRefusal, VerdictAnswer>> = {
  [ONBOARDING_REFUSALS.stepNotCurrent]: {
    status: 409,
    code: CODES.stepNotCurrent,
    title: 'That is not the next step.',
    detail: 'Only the first step that is not done may be completed.',
  },
  [ONBOARDING_REFUSALS.stepAlreadyDone]: {
    status: 409,
    code: CODES.stepNotCurrent,
    title: 'That step is already done.',
    detail: 'Only the first step that is not done may be completed.',
  },
  [ONBOARDING_REFUSALS.stepIsCurrent]: {
    status: 500,
    code: CODES.upstreamUnavailable,
    title: 'Unreachable verdict.',
    detail: 'The reason is in this plane’s log.',
  },
  [ONBOARDING_REFUSALS.reasonTooShort]: {
    status: 500,
    code: CODES.upstreamUnavailable,
    title: 'Unreachable verdict.',
    detail: 'The reason is in this plane’s log.',
  },
}

/**
 * `forceOnboardingStep` — 422 for all three, because it declares NO 409.
 *
 * ⚠️ **`stepAlreadyDone` IS A STATE CONFLICT WEARING A VALIDATION CODE, AND
 * THAT IS A COMPROMISE RATHER THAN A JUDGEMENT.** The operation declares
 * `401`, `403`, `404` and `422` and no 409 at all, so a conflict has nowhere
 * else to go; adding one, or minting `step_already_done` in the closed enum,
 * is a contract change this slice does not take. **The 422 is honest about the
 * outcome and imprecise about the kind**, and it is named here so the next
 * reader does not mistake the imprecision for a decision that forcing a
 * finished step is a malformed request.
 *
 * 🛑 `stepIsCurrent` IS THE ONE THAT IS GENUINELY A 422, and it is a rule about
 * what the MARK MEANS rather than about the request's shape: forcing the step
 * that could simply be completed *"breaks no sequence, so a record carrying
 * that mark would report a gate passed out of order when none was"*.
 *
 * ⚠️ `reasonTooShort` IS REACHABLE DESPITE `minLength: 7` ON THE WIRE, which is
 * why it is answered rather than treated as unreachable: ajv counts CHARACTERS
 * and `forceStep()` counts them AFTER `trim()`, so eight spaces and a letter
 * pass the schema and fail the model. **The model is the stricter of the two
 * and is the one that decides.**
 */
const FORCE_VERDICT: Readonly<Record<OnboardingRefusal, VerdictAnswer>> = {
  [ONBOARDING_REFUSALS.stepAlreadyDone]: {
    status: 422,
    code: CODES.validationFailed,
    title: 'That step is already done.',
    detail: 'A gate that is already passed cannot be forced.',
  },
  [ONBOARDING_REFUSALS.stepIsCurrent]: {
    status: 422,
    code: CODES.validationFailed,
    title: 'That step is the next one.',
    detail: 'A step that can simply be completed cannot be forced: forcing it breaks no sequence.',
  },
  [ONBOARDING_REFUSALS.reasonTooShort]: {
    status: 422,
    code: CODES.validationFailed,
    title: 'The reason is too short.',
    detail: 'The reason is the only record of why the sequence was broken, and it is required.',
  },
  [ONBOARDING_REFUSALS.stepNotCurrent]: {
    status: 500,
    code: CODES.upstreamUnavailable,
    title: 'Unreachable verdict.',
    detail: 'The reason is in this plane’s log.',
  },
}

function sendVerdict(
  reply: Parameters<AuthorisedBody>[0]['reply'],
  operationId: string,
  table: Readonly<Record<OnboardingRefusal, VerdictAnswer>>,
  verdict: OnboardingRefusal,
): unknown {
  const answer = table[verdict]
  if (answer.status === 500) {
    console.error(
      `data-plane: \`${operationId}\` received the verdict \`${verdict}\` from ` +
        '`model/onboarding.ts`, which this operation believes it cannot produce. Either that ' +
        'module gained an arm or this mapping is wrong; both are a code change rather than a ' +
        'caller error, so the answer is a 500 rather than a 4xx blaming the request.',
    )
  }
  return sendProblem(reply, {
    status: answer.status,
    code: answer.code,
    title: answer.title,
    detail: answer.detail,
  })
}

/**
 * An unrecognised step key is a **404** and not a 409.
 *
 * 🛑 THE DISTINCTION IS REAL AND IS NOT PEDANTRY. `StepKey` is
 * `{ type: string }` with no `enum` — deliberately, because the closed set
 * lives in `model/onboarding.ts` and a copy in YAML would be the third home
 * `0030` refuses — so ajv admits `banana`. Handed to `completeStep()` that
 * becomes `indexOf` → `-1`, which is `stepNotCurrent`: **a 409 telling the
 * caller their step is out of ORDER, about a step that does not exist.** A
 * 404 says the thing that is true.
 */
function sendUnknownStep(
  reply: Parameters<AuthorisedBody>[0]['reply'],
  stepKey: string,
  operationId: string,
): unknown {
  console.error(
    `data-plane: \`${operationId}\` was asked for a step that is not in \`ONBOARDING_STEPS\`: ` +
      `\`${stepKey}\`.`,
  )
  return sendProblem(reply, {
    status: 404,
    code: CODES.resourceNotFound,
    title: 'No such onboarding step.',
    detail: 'That step key is not a member of the onboarding sequence.',
  })
}

const completeOnboardingStepBody =
  (client: ControlPlaneClient): AuthorisedBody =>
  async ({ request, reply, grant }) => {
    const { tenantId, stepKey } = paramsOf(request)
    const step = onboardingStepKeyOf(stepKey)
    if (step === null) return sendUnknownStep(reply, stepKey, 'completeOnboardingStep')

    const outcome = await completeOnboardingStepIn(client, tenantId, step, grant.id)
    if ('refusal' in outcome) {
      return sendReadRefusal(reply, 'completeOnboardingStep', tenantId, outcome.refusal)
    }
    if ('verdict' in outcome) {
      return sendVerdict(reply, 'completeOnboardingStep', COMPLETE_VERDICT, outcome.verdict)
    }

    /**
     * 🛑 THE 200 IS **ONE STEP** AND NOT THE LIST, WHICH IS THE ONE PLACE THE
     * TWO WRITES DISAGREE ON THE WIRE. `completeOnboardingStep` declares
     * `schema: { $ref: OnboardingStep }` and `forceOnboardingStep` declares
     * `{ steps: [...] }` — an asymmetry in the contract, not here — and the
     * reason it is defensible is the reason forcing differs: completing moves
     * ONE step, forcing moves *"that step and everything above it"*, so a
     * console redrawing after a force needs the whole panel and after a
     * completion needs one row.
     *
     * ⚠️ THE ROW IS FOUND BY KEY AND NOT BY INDEX. `onboardingSteps()` returns
     * the six in sequence order and the completed one is at `index`, but
     * reading a position would silently answer the wrong row the day the
     * sequence or the return order changes; matching on the key the caller
     * named cannot.
     */
    const done = outcome.steps.find((s: OnboardingStepRow) => s.stepKey === step)
    if (done === undefined) {
      /**
       * Unreachable: `completeStep()` returned `ok` for this key, so the key
       * is a member of the sequence and `onboardingSteps()` is total over it.
       * A 500 rather than a guess, for `sendVerdict()`'s reason.
       */
      console.error(
        `data-plane: \`completeOnboardingStep\` completed \`${step}\` and the rendered sequence ` +
          'carries no row for it. `onboardingSteps()` is total over `ONBOARDING_STEPS`, so ' +
          'reaching here means the two have diverged.',
      )
      return sendProblem(reply, {
        status: 500,
        code: CODES.upstreamUnavailable,
        title: 'The completed step could not be rendered.',
        detail: 'The reason is in this plane’s log.',
      })
    }
    return done
  }

export function completeOnboardingStepOperation(client: ControlPlaneClient): AuthorisedOperation {
  return {
    operationId: 'completeOnboardingStep',
    resourceType: 'Tenant',
    instanceOf: (request) => paramsOf(request).tenantId,
    body: completeOnboardingStepBody(client),
  }
}

const forceOnboardingStepBody =
  (client: ControlPlaneClient): AuthorisedBody =>
  async ({ request, reply, grant }) => {
    const { tenantId, stepKey } = paramsOf(request)
    const step = onboardingStepKeyOf(stepKey)
    if (step === null) return sendUnknownStep(reply, stepKey, 'forceOnboardingStep')

    /**
     * ⚠️ THE BODY IS READ WITHOUT A CAST OF CONTENT. `ForceStepRequest` is
     * `required: [reason]`, `additionalProperties: false`, `minLength: 7`, and
     * ajv has already refused anything else — so `reason` is a string here.
     * It is still handed to the MODEL untrimmed, because `forceStep()` trims
     * and re-checks: this handler must not be the place the floor is applied.
     */
    const body = request.body as { reason?: unknown } | undefined
    const reason = typeof body?.reason === 'string' ? body.reason : ''

    const outcome = await forceOnboardingStepIn(client, tenantId, step, reason, grant.id)
    if ('refusal' in outcome) {
      return sendReadRefusal(reply, 'forceOnboardingStep', tenantId, outcome.refusal)
    }
    if ('verdict' in outcome) {
      return sendVerdict(reply, 'forceOnboardingStep', FORCE_VERDICT, outcome.verdict)
    }
    return { steps: outcome.steps }
  }

export function forceOnboardingStepOperation(client: ControlPlaneClient): AuthorisedOperation {
  return {
    operationId: 'forceOnboardingStep',
    resourceType: 'Tenant',
    instanceOf: (request) => paramsOf(request).tenantId,
    body: forceOnboardingStepBody(client),
  }
}
