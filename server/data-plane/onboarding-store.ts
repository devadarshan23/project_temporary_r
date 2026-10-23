/**
 * H2's SEQUENCE, FOR ONE TENANT — READ, COMPLETED AND FORCED.
 *
 * **G1425–G1428, 21 Sep 2026, applying R8 and R9 (both THE OWNER'S).**
 *
 * ┌─ WHY THIS FILE EXISTS WHEN `console-roster-store.ts` ALREADY READS ───────┐
 * │  THE SAME TWO TABLES                                                      │
 * │ Because it answers a different question with a different credential. That │
 * │ module answers *"where has each tenant in the fleet got to"* — the whole  │
 * │ roster, on the READ pool, through `withControlReadScope()`. This one      │
 * │ answers *"what are this tenant's six steps, and may this act change       │
 * │ them"*, and two thirds of it WRITES.                                      │
 * │                                                                           │
 * │ 🛑 IT IS NOT A NARROWER COPY OF THAT READER AND MUST NOT BECOME ONE.      │
 * │ `readConsoleRoster()` takes a `ControlReadPool` and issues `BEGIN READ    │
 * │ ONLY`; a write cannot be routed through it at ANY grant, which is a fact  │
 * │ about the server rather than about this repository —                      │
 * │ `cannot execute UPDATE in a read-only transaction`, witnessed in          │
 * │ `db/control-write-scope.ts`'s header and re-witnessed on every run by     │
 * │ `tests/db/onboarding-write-pool.test.ts` §4.                              │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE RULES LIVE IN `model/onboarding.ts` AND THIS MODULE HAS NONE OF ITS
 *    OWN. IT SUPPLIES STATE, ASKS, AND SPELLS THE ANSWER.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `completeStep()` and `forceStep()` are PURE and return a new record; this
 * module reads the old one, calls them, and writes what they returned.
 * **Nothing here knows that only the next step may be completed, that forcing
 * fills everything below, that a reason has a floor, or that forcing the
 * current step is refused.** Every one of those is a branch in that module,
 * and re-stating any of them here is §5.3 — *"two vocabularies for one
 * concept, and the one that drifts is always the copy"* — with the copy in
 * the place the console writes.
 *
 * ⚠️ WHICH IS WHY THE REFUSALS BELOW ARE ABOUT **ROWS** AND THE MODEL'S ARE
 * ABOUT **TRANSITIONS**, AND THE TWO SETS DO NOT OVERLAP. This module refuses
 * a tenant that is not on the roster, a delivery record that is absent, a
 * count it cannot read and a step key it does not recognise. It never refuses
 * a transition.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 BOTH WRITES ARE READ-MODIFY-WRITE IN ONE TRANSACTION, AND THE ROW IS
 *    LOCKED. THIS IS THE PART TO READ TWICE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The decision is a pure function of the CURRENT record, so reading it,
 * deciding, and writing must be one atomic unit or the decision is about a
 * state that may have moved. `withControlWriteScope()` makes them one
 * transaction; `SELECT … FOR UPDATE` is what makes them one DECISION.
 *
 * **Without the lock, two staff people completing the same step both read
 * `2`, both get `ok` from `completeStep()`, and both write `3`** — the second
 * write is not a decrement, so `0040`'s trigger cannot see it, and the
 * sequence advances once for two acts. Worse for `forceOnboardingStep`: two
 * forces of different gates both read the same record, and the second
 * `UPDATE` silently discards the first's advance while its append-only mark
 * survives — **a record carrying a forced mark for a step it claims is not
 * done.** The lock is not an optimisation.
 *
 * ⚠️ AND IT WAS NOT OBVIOUS THAT THE LOCK WOULD BE AVAILABLE. PostgreSQL
 * requires `UPDATE`, `DELETE` or `SELECT … FOR UPDATE` privilege to lock a
 * row, and `0040` grants `UPDATE` on ONE COLUMN. **Measured before this file
 * was written: a column-level grant satisfies the lock.** Had it not, the
 * read-modify-write would have needed a table-level `UPDATE` — the thing the
 * column list exists to refuse — and this slice would have owed a different
 * shape rather than a wider grant.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE `stepKey` ON THE WIRE IS THE MODEL'S `step`, AND THE RENAME IS THE
 *    ONLY TRANSFORMATION IN THE MODULE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `OnboardingStep`'s four `required` properties are `stepKey`, `title`,
 * `state` and `whoseHands`. Three of them come from total `Record`s in
 * `model/onboarding.ts` — `STEP_TITLE`, `STEP_HANDS` and the state machine in
 * `onboardingSteps()` — and the fourth is `ONBOARDING_STEPS` itself. **None
 * of the four has a column anywhere and none should**: they are constants
 * about our own process, and a column would be a second home that drifts the
 * day a title is edited. This is `TenantSummary.stage`'s shape (G1241) with
 * three derivations instead of one, and
 * `tests/http/console-roster-unreachable.test.ts`'s `DERIVED_PRODUCERS` is
 * where each is recorded so the producer test can see them.
 */

import {
  ONBOARDING_REFUSAL_KINDS,
  ONBOARDING_STEPS,
  STEP_STATES,
  onboardingSteps,
  type ForcedStep,
  type OnboardingRecord,
  type OnboardingRefusal,
  type OnboardingStepKey,
  type StepState,
} from '../../model/onboarding.ts'
import {
  CONSOLE_ROSTER_REFUSALS,
  completedCountOf,
  stepKeyOf,
} from './console-roster-store.ts'
import type { ControlPlaneClient } from './control-plane-client.ts'

/**
 * `StepState` as the wire spells it.
 *
 * 🛑 A TOTAL `Record` KEYED ON THE UNION, SO A FIFTH STATE IS A COMPILE ERROR
 * HERE RATHER THAN A STEP THAT RENDERS AS NOTHING. `STAGE_WIRE` in
 * `console-roster-store.ts` is the precedent and the argument is the same one.
 *
 * ⚠️ **IT IS AN IDENTITY MAPPING TODAY AND IT IS STILL WORTH HAVING, WHICH IS
 * THE UNUSUAL CLAIM AND SO IS ARGUED RATHER THAN ASSUMED.** Until 21 Sep 2026
 * the contract named the fourth value only in a `description`, and it named it
 * **`done-and-forced`** while `model/onboarding.ts` has emitted
 * **`done_forced`** since G535. *"The wire spells the fourth `done-and-forced`
 * and nothing pins the pair"* is that module's own sentence, and it ends with
 * *"It is owed by the commit that mounts `listOnboardingSteps`."*
 *
 * 🛑 **THE PAIR IS PINNED IN THAT COMMIT AND THE CONTRACT TOOK THE MODEL'S
 * SPELLING, NOT THE PROSE'S.** The hyphenated form was never emitted by
 * anything — no handler, no serialiser, no test — so writing it into the
 * `enum` would have invented a wire value the product does not produce and
 * then frozen it. **What this `Record` buys is that the next divergence is a
 * `TS2741` here instead of a sentence nobody joins to a constant**, and
 * `tools/check-wire-mirror.mjs` registers `step_states` as the 28th pair so
 * the enum and this union are compared on every run.
 */
const STEP_STATE_WIRE: Readonly<Record<StepState, string>> = {
  [STEP_STATES.blocked]: 'blocked',
  [STEP_STATES.next]: 'next',
  [STEP_STATES.done]: 'done',
  [STEP_STATES.doneForced]: 'done_forced',
}

/**
 * One row of `S1`'s six-step panel — `OnboardingStep`, and named for it.
 *
 * 🛑 EVERY `required` PROPERTY IS NON-OPTIONAL HERE, AND THAT IS THE ONE
 * THING `fast-json-stringify` WILL NOT CHECK FOR US IN THE DIRECTION THAT
 * MATTERS. G1244 measured both directions at the pinned version: a missing
 * `required` property **THROWS**, so the failure is a 500 on every request
 * rather than a quiet gap; a property present and not in `properties` is
 * DROPPED, silently. TypeScript is one control and it is not sufficient —
 * `tests/http/onboarding-console-served.test.ts` §2 derives the `required`
 * list from the contract document and asserts each name against the BYTES of
 * a real served response.
 *
 * ⚠️ `forcedReason` IS OPTIONAL AND IS PRESENT ONLY ON A `done_forced` STEP.
 * It is spread rather than set to `undefined`, for `console-roster-store.ts`'s
 * reason: under `exactOptionalPropertyTypes` the absent key is what an
 * optional property means.
 */
export interface OnboardingStepRow {
  readonly stepKey: string
  readonly title: string
  readonly state: string
  readonly whoseHands: string
  readonly forcedReason?: string
}

/**
 * Every way this module refuses, and none of them is a transition.
 *
 * 🛑 THREE OF THE FOUR ARE `CONSOLE_ROSTER_REFUSALS`' OWN MEMBERS, IMPORTED
 * RATHER THAN RESPELLED. They mean the same thing about the same two tables
 * and a second set of strings would be §5.3 — and worse than usual, because a
 * reader comparing a roster refusal with a step refusal would have no way to
 * tell whether the two were the same finding.
 *
 * ⚠️ THE FOURTH IS NEW BECAUSE IT HAS A DIFFERENT STATUS CODE. A tenant that
 * is not on the roster is `resource_not_found`, a **404** — the operation's
 * own declared response — where the other three are 500s about a row this
 * plane did not write. `readConsoleRoster()` never needs it: it reads the
 * whole roster, so *"a tenant that is not on it"* is not a case it can meet.
 */
export const ONBOARDING_READ_REFUSALS = {
  /** The tenant named in the path is not on the roster at all. A 404. */
  tenantNotOnRoster: 'tenant_not_on_roster',
  onboardingRecordAbsent: CONSOLE_ROSTER_REFUSALS.onboardingRecordAbsent,
  completedCountUnreadable: CONSOLE_ROSTER_REFUSALS.completedCountUnreadable,
  forcedStepUnreadable: CONSOLE_ROSTER_REFUSALS.forcedStepUnreadable,
} as const
export type OnboardingReadRefusal =
  (typeof ONBOARDING_READ_REFUSALS)[keyof typeof ONBOARDING_READ_REFUSALS]

export type OnboardingStepsOutcome =
  | { readonly ok: true; readonly steps: readonly OnboardingStepRow[] }
  | { readonly ok: false; readonly refusal: OnboardingReadRefusal }

/**
 * A write's answer: the row-level refusals above, or the model's own verdict.
 *
 * ⚠️ THE TWO KINDS ARE SEPARATE ARMS AND ARE NOT FLATTENED INTO ONE UNION OF
 * STRINGS, BECAUSE THEY BECOME DIFFERENT STATUS CODES AND THE HANDLER MUST
 * NOT HAVE TO REMEMBER WHICH IS WHICH. A `refusal` is a 404 or a 500 about
 * the state of a row; a `verdict` is a 409 or a 422 about an act the caller
 * asked for. `server/data-plane/onboarding.ts` maps each arm once.
 */
export type OnboardingWriteOutcome =
  | { readonly ok: true; readonly steps: readonly OnboardingStepRow[] }
  | { readonly ok: false; readonly refusal: OnboardingReadRefusal }
  | { readonly ok: false; readonly verdict: OnboardingRefusal }

/**
 * The roster row and its delivery record, for ONE tenant.
 *
 * ⚠️ **THE `WHERE` IS NOT EMPTY HERE, AND THE DIFFERENCE FROM EVERY OTHER
 * READER IN THIS PLANE IS WORTH ONE LINE BECAUSE IT LOOKS LIKE THE DEFECT
 * THOSE HEADERS WARN ABOUT.** `console-roster-store.ts`, `roster-store.ts`
 * and `identity.ts` §6a all carry *"the `WHERE` is empty"* and mean the same
 * thing: **no predicate here may narrow AUTHORITY**, because every predicate
 * somebody adds deletes a refusal that belongs to a policy or to the model.
 * `r.tenant_id = $1` narrows nothing of the sort — **it is the operation's
 * own SUBJECT**, arriving from the path, and it is the whole reason the
 * operation takes a `{tenantId}` at all. The authority question was answered
 * by `decide()` before this module ran, on a capability whose class is
 * `substrate`, and no row in this database is visible to one caller and not
 * another.
 *
 * ⚠️ A `LEFT JOIN` AND NOT AN INNER ONE, for `console-roster-store.ts`'s
 * reason exactly: an inner join collapses *"no such tenant"* and *"a tenant
 * with no delivery record"* into one empty result, and the two are a 404 and
 * a 500 respectively. The left join keeps them distinguishable — a missing
 * roster row returns NO rows, a missing onboarding row returns one with a
 * `NULL`.
 */

/**
 * This tenant's forced gates.
 *
 * ⚠️ READ ON THE WRITE PATH TOO, EVEN THOUGH NEITHER TRANSITION CONSULTS THE
 * LIST TO DECIDE. `forceStep()` APPENDS to `record.forced`, so handing it a
 * record whose `forced` was `[]` would return a new record with exactly one
 * mark on it — **and this module would then have no way to tell an append
 * from a replacement.** It does not write the list back (the mark is one
 * `INSERT`), so nothing would be lost today; what would be lost is the
 * property that `OnboardingRecord` is a TOTAL record rather than the subset
 * one caller happens to need, which is `console-roster-store.ts`'s argument
 * for reading it there.
 */

interface ForcedRow {
  readonly step: unknown
  readonly reason: unknown
}

/** The wire's six rows, from a record the model already validated. */
function rowsOf(record: OnboardingRecord): readonly OnboardingStepRow[] {
  return onboardingSteps(record).map((view): OnboardingStepRow => {
    const base = {
      stepKey: view.step,
      title: view.title,
      state: STEP_STATE_WIRE[view.state],
      whoseHands: view.whoseHands,
    }
    return view.forcedReason === undefined ? base : { ...base, forcedReason: view.forcedReason }
  })
}

/**
 * Assemble one tenant's `OnboardingRecord` from two result sets, refusing by
 * name rather than guessing.
 *
 * ⚠️ IT TAKES ROWS AND NOT A CLIENT, WHICH IS WHAT LETS THE READ PATH AND THE
 * WRITE PATH SHARE IT WITHOUT SHARING A CREDENTIAL. The two run on different
 * pools, in different transaction modes, and this function is the only place
 * that turns `onboarding_record` and `onboarding_forced_step` into a record —
 * so the refusal vocabulary cannot diverge between a read and a write.
 */
function recordFrom(
  onRoster: boolean,
  /** The stored count, or `null`/`undefined` where there is no delivery record. */
  completedRaw: unknown,
  forced: readonly ForcedRow[],
): { readonly ok: true; readonly record: OnboardingRecord } | { readonly ok: false; readonly refusal: OnboardingReadRefusal } {
  if (!onRoster) {
    return { ok: false, refusal: ONBOARDING_READ_REFUSALS.tenantNotOnRoster }
  }
  if (completedRaw === null || completedRaw === undefined) {
    return { ok: false, refusal: ONBOARDING_READ_REFUSALS.onboardingRecordAbsent }
  }
  const completed = completedCountOf(completedRaw)
  if (completed === null) {
    return { ok: false, refusal: ONBOARDING_READ_REFUSALS.completedCountUnreadable }
  }

  const marks: ForcedStep[] = []
  for (const f of forced) {
    const step = stepKeyOf(f.step)
    /**
     * 🛑 A REFUSAL AND NEVER A SKIP, WHICH IS `console-roster-store.ts`'s
     * SENTENCE AND MATTERS MORE HERE. A reader that dropped an unrecognised
     * key would publish the step as ordinarily `done` — **silently losing the
     * only record of why the sequence was broken** — and on the WRITE path it
     * would then hand `forceStep()` a record missing a mark, so an append
     * would be computed against a list that had already lost one.
     */
    if (step === null) {
      return { ok: false, refusal: ONBOARDING_READ_REFUSALS.forcedStepUnreadable }
    }
    marks.push({ step, reason: String(f.reason) })
  }

  return { ok: true, record: { completed, forced: marks } }
}

/**
 * H2's six steps for one tenant — `listOnboardingSteps`.
 *
 * ⚠️ IT TAKES THE **READ** POOL, AND THAT IS NOT AN OVERSIGHT NOW THAT A
 * WRITE POOL EXISTS. `db/control-read-scope.ts` carries two independent
 * controls this read would otherwise spend for nothing: a credential that
 * cannot write, and a transaction mode that refuses a write anyway. Routing a
 * read through the writer would hold a connection from a pool sized for one
 * staff person per tenant, on a credential that holds `UPDATE`, to do
 * something neither is needed for.
 *
 * ⚠️ TWO STATEMENTS IN ONE TRANSACTION for `readConsoleRoster()`'s reason: a
 * force landing between them would produce a record whose `completed`
 * predates its own mark.
 */
export async function readOnboardingSteps(
  client: ControlPlaneClient,
  tenantId: string,
  authorisationId: string,
): Promise<OnboardingStepsOutcome> {
  /* G4318 — the stored facts come from `getInternalOnboarding`; this module
     still assembles them and names every refusal. A tenant id the roster could
     not hold is the roster's own answer, given here. */
  if (!TENANT_SLUG.test(tenantId)) return { ok: false, refusal: ONBOARDING_READ_REFUSALS.tenantNotOnRoster }
  const reply = await client.get(`/internal/console/tenants/${encodeURIComponent(tenantId)}/onboarding`, {
    authorisationId,
    idempotencyKey: authorisationId,
  })
  const fact = reply.body as { onRoster?: unknown; completedSteps?: unknown; forced?: unknown } | null
  if (reply.status !== 200 || fact === null || typeof fact.onRoster !== 'boolean' || !Array.isArray(fact.forced)) {
    throw new Error(`the control plane answered ${reply.status} to the onboarding read`)
  }
  const assembled = recordFrom(fact.onRoster, fact.completedSteps, fact.forced as readonly ForcedRow[])
  if (!assembled.ok) return assembled
  return { ok: true, steps: rowsOf(assembled.record) }
}

/**
 * One transition, decided and written BY THE CONTROL PLANE under its row lock —
 * G4316, 5 Oct 2026, THE OWNER'S "Full restore" ruling: *"…put onboarding
 * writes … behind signed control-plane endpoints…"*.
 *
 * ⚠️ THIS WAS A LOCKED TRANSACTION ON THE CONTROL DATABASE, OPENED FROM THIS
 * PLANE AS `reconcile_control_writer` (R9, `db/control-write-scope.ts`), until
 * then. The lock, the order and the model's decision moved WITH the write, to
 * `server/control-plane/console-store.ts`, because a decision taken outside the
 * transaction that writes would race. What stays here is the RENDERING and every
 * refusal a console caller sees: the control plane answers `ok` with the stored
 * facts, `refused` with a stored-fact refusal, or `verdict` with the model's
 * refusal, and this function maps each exactly as the local write did.
 *
 * 🛑 THE AUTHORISATION ID IS THE ACT'S OWN INVARIANT 10 RECORD AND IT IS ALSO THE
 * IDEMPOTENCY KEY. One act, one record, one key: a retry of the SAME act re-sends
 * the SAME key and receives the first answer (G4306), and two acts can never
 * share one. The control plane stores it on the receipt and, for a force, on the
 * mark itself (`0051`, G4317).
 *
 * ⚠️ ANY ANSWER BUT A WELL-FORMED 200 THROWS — a 500 `upstream_unavailable` from
 * the error handler. The act's record is written before this runs and commits
 * only if this returns, so a throw takes the record down with it: G1426's SAFE
 * direction, unchanged by the move.
 */
async function transitionThroughControlPlane(
  client: ControlPlaneClient,
  path: string,
  body: unknown,
  authorisationId: string,
): Promise<OnboardingWriteOutcome> {
  const reply = await client.post(path, body, { authorisationId, idempotencyKey: authorisationId })
  if (reply.status !== 200 || typeof reply.body !== 'object' || reply.body === null) {
    throw new Error(`the control plane answered ${reply.status} to an onboarding write`)
  }
  const answer = reply.body as Record<string, unknown>
  if (answer['outcome'] === 'refused') {
    const refusal = answer['refusal']
    const known: readonly unknown[] = Object.values(ONBOARDING_READ_REFUSALS)
    if (!known.includes(refusal)) throw new Error(`the control plane refused with an unknown reason: ${String(refusal)}`)
    return { ok: false, refusal: refusal as OnboardingReadRefusal }
  }
  if (answer['outcome'] === 'verdict') {
    const verdict = answer['verdict']
    const known: readonly unknown[] = ONBOARDING_REFUSAL_KINDS
    if (!known.includes(verdict)) throw new Error(`the control plane returned an unknown verdict: ${String(verdict)}`)
    return { ok: false, verdict: verdict as OnboardingRefusal }
  }
  if (answer['outcome'] !== 'ok' || !Array.isArray(answer['forced'])) {
    throw new Error('the control plane answered an onboarding write with no outcome')
  }
  const assembled = recordFrom(true, answer['completedSteps'], answer['forced'] as readonly ForcedRow[])
  if (!assembled.ok) return assembled
  return { ok: true, steps: rowsOf(assembled.record) }
}

const stepPath = (tenantId: string, step: OnboardingStepKey, verb: 'complete' | 'force'): string =>
  `/internal/console/tenants/${encodeURIComponent(tenantId)}/onboarding/steps/${step}/${verb}`

const TENANT_SLUG = /^ten_[a-z0-9][a-z0-9_]{0,60}$/

/**
 * Mark the next step done — `completeOnboardingStep`.
 *
 * ⚠️ THE STEP KEY IS NARROWED HERE AND NOT IN THE HANDLER, BECAUSE AN
 * UNRECOGNISED KEY IS NOT A REFUSAL THIS MODULE CAN EXPRESS. `StepKey` is
 * `{ type: string }` in the contract with no `enum` — deliberately, because
 * the closed set lives in `model/onboarding.ts` and a second copy in YAML is
 * the third home `0030` refuses — so ajv admits any string. A key that is not
 * a member reaches `completeStep()` as `indexOf` returning `-1`, which would
 * be `stepNotCurrent` for every value including a typo. **`null` here means
 * the caller named something that is not a step at all**, and the handler
 * answers 404 rather than 409: there is no such step to be out of order.
 */
export function onboardingStepKeyOf(raw: string): OnboardingStepKey | null {
  const steps: readonly string[] = ONBOARDING_STEPS
  return steps.includes(raw) ? (raw as OnboardingStepKey) : null
}

export async function completeOnboardingStepIn(
  client: ControlPlaneClient,
  tenantId: string,
  step: OnboardingStepKey,
  authorisationId: string,
): Promise<OnboardingWriteOutcome> {
  /* A tenant id the roster could not hold is the roster's answer, given here
     rather than sent as a path the internal contract would 400. */
  if (!TENANT_SLUG.test(tenantId)) return { ok: false, refusal: ONBOARDING_READ_REFUSALS.tenantNotOnRoster }
  return await transitionThroughControlPlane(client, stepPath(tenantId, step, 'complete'), undefined, authorisationId)
}

/**
 * Force a blocked gate — `forceOnboardingStep`.
 *
 * 🛑 THE ADVANCE AND THE MARK ARE ONE TRANSACTION, AND THAT IS THE PROPERTY
 * TO PRESERVE IF ANYTHING HERE IS EVER REFACTORED. Two transactions — advance
 * in one, append in the other — would admit a state the whole design refuses:
 * a step recorded as done out of order with **no record of why**, which is
 * exactly what the contract calls *"PERMANENT, AND THE ONLY RECORD OF WHY THE
 * SEQUENCE WAS BROKEN"*. ⚠️ SINCE G4316 THE CONTROL PLANE'S ONE TRANSACTION
 * (`server/control-plane/console-store.ts`) is what makes them one.
 *
 * ⚠️ THE `reason` PASSED HERE IS THE REQUEST'S AND THE `reason` STORED IS THE
 * MODEL'S. `forceStep()` trims before storing and applies
 * `MIN_FORCE_REASON_CHARS` after trimming, so the control plane writes the
 * appended entry out of the returned record rather than what arrived — seven spaces are refused rather than stored.
 */
export async function forceOnboardingStepIn(
  client: ControlPlaneClient,
  tenantId: string,
  step: OnboardingStepKey,
  reason: string,
  authorisationId: string,
): Promise<OnboardingWriteOutcome> {
  if (!TENANT_SLUG.test(tenantId)) return { ok: false, refusal: ONBOARDING_READ_REFUSALS.tenantNotOnRoster }
  return await transitionThroughControlPlane(client, stepPath(tenantId, step, 'force'), { reason }, authorisationId)
}
