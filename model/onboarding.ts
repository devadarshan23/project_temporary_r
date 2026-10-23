/**
 * H2 · RUN CUSTOMER ONBOARDING — THE SEQUENCE, THE GATE AND THE PERMANENT MARK.
 *
 * ┌─ WHY THIS MODULE EXISTS, IN THE PACK'S OWN WORDS ─────────────────────────┐
 * │ `Functional Specification.dc.html`, H2's last row:                        │
 * │                                                                           │
 * │   "Onboarding state in the model — Nothing persists the sequence, the      │
 * │    force or the mark. All of it is state on this surface.  NOT BUILT"     │
 * │                                                                           │
 * │ That row is the whole brief. Five of H2's six rows are marked `built` in  │
 * │ the pack — which means DRAWN AND OPERABLE IN THOSE HTML FILES, not built  │
 * │ here — and the sixth says the rules behind them live nowhere but in a     │
 * │ prototype's `setState`. This module is the sixth row and nothing else.    │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THIS IS THE **MODEL** THIRD OF G300 AND IT IS EXPLICITLY NOT THE OTHER
 * TWO. That ruling lifts G296's freeze *"for any operation whose TABLE, MODEL
 * and CAPABILITY are all real"*, and warns in its own voice that **"a table
 * alone is the trap."** The converse is equally true and is what this file is:
 * a model alone is not a mount. There is **no table** — nothing in
 * `db/migrations/` holds an onboarding step — and **no capability**, because
 * `ACCESS_RESOURCE_CLASSES` names no delivery pipeline and the three contract
 * operations say so on their own faces. Derive both, and do not read a
 * sentence here as evidence:
 *
 *     grep -rn 'onboarding' db/migrations/                      # nothing
 *     grep -n 'x-capability' -A 0 docs/contracts/administration.openapi.yaml \
 *       | grep -c 'listOnboardingSteps'                         # 0 — it is exempt
 *
 * ⚠️ AND A COLUMN AHEAD OF ITS READER IS `0004_subject_ledger.sql`'s REFUSAL,
 * SO NO MIGRATION LANDS WITH THIS. `db/migrations/0002_run.sql`'s sentence —
 * *"storing columns no wire can carry would create a second vocabulary with
 * nothing checking it; they land with the schemas that publish them"* — is why
 * this module ships alone. G511's form of the same rule is sharper and binds
 * the next slice rather than this one: **the fence and the writer are one
 * commit or neither.** When `listOnboardingSteps` is mountable, its table and
 * its handler arrive together, and this vocabulary is what they are built out
 * of rather than what they re-derive.
 *
 * ┌─ THE SIX STEPS ARE TRANSCRIBED FROM `S1 Staff.dc.html`, NOT INVENTED ─────┐
 * │ That file's `STEPS` array is the source, with its own header comment:     │
 * │                                                                           │
 * │   "H2 · THE SEQUENCE. Each step is blocked by the one above it, and the   │
 * │    blocking is the point: the cost of skipping is a first period measured │
 * │    against something nobody bound."                                       │
 * │                                                                           │
 * │ Reproduce the transcription rather than trusting it:                      │
 * │   grep -n "STEPS = \[" -A 16 'docs/handoff-pack/S1 Staff.dc.html'         │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 ONE DELIBERATE DIVERGENCE FROM THE PROTOTYPE, AND IT IS THE ONLY ONE.
 * `S1`'s state holds **one** forced mark per tenant — `forced:{t, i, why}` —
 * and forcing a second gate REPLACES it, silently destroying the first
 * reason. The contract calls that reason *"PERMANENT, AND THE ONLY RECORD OF
 * WHY THE SEQUENCE WAS BROKEN"* and adds *"there is no operation that clears
 * it: a gate that can be un-forced leaves no evidence it was ever forced."*
 * **A record a second write can overwrite is not a permanent record**, so
 * `OnboardingRecord.forced` is an append-only list, one entry per forced step,
 * and `forceStep()` has no path that shortens it. The prototype is a drawing
 * of a screen; this is the rule the screen was drawing.
 *
 * ⚠️ NO CLOCK, ANYWHERE IN THIS MODULE, AND THAT COSTS ONE THING BY NAME.
 * `S1`'s roster shows `stage: 'stalled · 19 days'` and the console's tenancy
 * summary counts *"Stalled over 14 days"*. **Stalled is not derivable here**:
 * it needs a timestamp per step transition and a threshold, and neither has a
 * producer — there is no table to carry the first and no ruling to set the
 * second. `onboardingStage()` below answers `live` or `onboarding` and refuses
 * to guess a third; inventing a `stalled` arm with no clock would be a stage
 * nothing ever reaches, which is worse than an absent one because it reads
 * as implemented. That absence is asserted in `tests/model/onboarding.test.ts`
 * §6 rather than left to be noticed.
 *
 * ⚠️ NO `AssertNoTextDeep` SITE, AND THE ABSENCE IS A STATEMENT. `ForcedStep`
 * carries a `reason`, which is free text a staff person types and which the
 * pack requires to travel *"verbatim"*. A containment proof over this
 * interface would be a compile error, exactly as `HeldRead`'s is and for the
 * same reason `model/reconciliation.ts` gives: *"the union carrying the REASON
 * holds the proof; the record carrying the declared path does not."* What IS
 * worth saying is the direction of the text: **this is OUR prose, not a
 * counterparty's**, so invariant 6 is not in play here — nothing in this
 * module is ingested content.
 *
 * Compiles under `model/tsconfig.json`: `strict`, `exactOptionalPropertyTypes`,
 * `noUncheckedIndexedAccess`, `erasableSyntaxOnly`, `verbatimModuleSyntax`,
 * `noUnusedLocals`, `noUnusedParameters`.
 */

/* ==================================================================== *
 * §1 · THE SEQUENCE.
 * ==================================================================== */

/**
 * The six steps, IN ORDER, and the order is the load-bearing part.
 *
 * 🛑 A TUPLE RATHER THAN A `Record`, BECAUSE THE ORDER IS THE RULE. Every
 * other closed vocabulary in `model/` is a const object joined to a total
 * `Record`, and that shape is right when the members are independent. Here
 * *"each step is blocked by the one above it"*, so a declaration that did not
 * carry the order would need a second `stepIndex` table beside it — a third
 * place to drift, which `db/migrations/0002_run.sql` refuses by name. The
 * total `Record`s below are keyed on this tuple's members, so they cannot
 * name a step that is not in the sequence and cannot omit one that is.
 */
export const ONBOARDING_STEPS = [
  /** `S1`: "mode, residency, retention, support access". H1 produces it. */
  'tenant_record',
  /** `S1`: "the vocabulary is theirs; one key drives chargeback". */
  'tag_policy',
  /** `S1`: "we declare the source; the credential is theirs". */
  'sources_bound',
  /** `S1`: "a pack names roles; the install binds them". */
  'pack_installed',
  /** `S1`: "after the first real documents, never before". */
  'extraction_floor',
  /** `S1`: "and the tenant becomes billable". */
  'first_run',
] as const

export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number]

/**
 * Whose hands a step is in — `ours`, `theirs`, or `both`.
 *
 * The pack makes this a first-class field rather than prose and gives the
 * reason in `listOnboardingSteps`'s own description: *"a stall with no named
 * owner is chased by the wrong party, which is `User Journeys` H2.9's whole
 * complaint."*
 */
export const WHOSE_HANDS = {
  ours: 'ours',
  theirs: 'theirs',
  both: 'both',
} as const
export type WhoseHands = (typeof WHOSE_HANDS)[keyof typeof WHOSE_HANDS]

/**
 * Whose hands each step is in. TOTAL over the sequence, so a seventh step is
 * a compile error here rather than a step that renders with no owner — which
 * is precisely the state H2.9 complains about.
 *
 * Transcribed from `S1`'s `hands:` field, step for step.
 */
export const STEP_HANDS: Readonly<Record<OnboardingStepKey, WhoseHands>> = {
  tenant_record: WHOSE_HANDS.ours,
  tag_policy: WHOSE_HANDS.theirs,
  sources_bound: WHOSE_HANDS.both,
  pack_installed: WHOSE_HANDS.ours,
  extraction_floor: WHOSE_HANDS.ours,
  first_run: WHOSE_HANDS.ours,
}

/**
 * The step's title, as the console draws it.
 *
 * ⚠️ IT IS HERE BECAUSE `OnboardingStep.title` IS `required` ON THE WIRE AND
 * HAS NO OTHER PRODUCER. That is the check G300's row calls for by name — *"a
 * table alone is the trap"*, generalised to *every `required` field in a 200
 * needs a producer* — applied before the operation exists rather than after.
 * A handler that invented these strings would be a second vocabulary with
 * nothing checking it.
 *
 * ⚠️ AND IT IS ENGLISH, WHICH IS A DECISION NOBODY HAS TAKEN. There is no
 * localisation seam in this repository and this module does not invent one;
 * the strings are the pack's, verbatim, and the day a second language arrives
 * this `Record` is where the question lands.
 */
export const STEP_TITLE: Readonly<Record<OnboardingStepKey, string>> = {
  tenant_record: 'Tenant record and plan',
  tag_policy: 'Tag policy agreed',
  sources_bound: 'Sources declared and bound',
  pack_installed: 'Pack installed and source roles bound',
  extraction_floor: 'Extraction floor set',
  first_run: 'First reconciliation run',
}

/**
 * How many steps are done. A PREFIX LENGTH, never a set.
 *
 * 🛑 §5.5 — DO NOT MAKE AN INVALID STATE REPRESENTABLE. The obvious shape is
 * `Record<OnboardingStepKey, boolean>` or a list of completed keys, and both
 * admit *"`pack_installed` done, `tag_policy` not"* — a state the rules below
 * can never produce and every reader would then have to defend against. Both
 * transitions this module offers produce a prefix: completing advances by one
 * from the front, and forcing fills *"that step and everything above it"*. So
 * the state IS a prefix length, and a non-prefix onboarding cannot be written
 * down.
 *
 * The union is DERIVED from the tuple rather than typed out, so adding a
 * seventh step widens it with no edit here. `_MAX_IS_EVERY_STEP` below is the
 * proof that the derivation reaches the end of the sequence.
 */
type TupleIndex<T extends readonly unknown[]> = Exclude<keyof T, keyof unknown[]> extends infer K
  ? K extends `${infer N extends number}`
    ? N
    : never
  : never

export type CompletedStepCount = TupleIndex<typeof ONBOARDING_STEPS> | typeof ONBOARDING_STEPS.length

/**
 * ⚠️ A COMPILE-TIME PROOF, NOT A COMMENT: the count union reaches "all six
 * done". If `TupleIndex` ever stopped producing the indices, this collapses to
 * `never` and the assignment below is `TS2322`.
 */
export type _MaxIsEveryStep = typeof ONBOARDING_STEPS.length extends CompletedStepCount
  ? true
  : never
export const _MAX_IS_EVERY_STEP: _MaxIsEveryStep = true

/**
 * One forced gate, and the reason it was forced.
 *
 * ⚠️ NO TIMESTAMP AND NO ACTOR, AND BOTH ARE OWED RATHER THAN REFUSED. Either
 * would be a field with no producer: there is no table to carry one and no
 * mounted operation to supply one, and `0004_subject_ledger.sql` refuses a
 * column ahead of its writer. The commit that gives this a table owes both —
 * *"a review asking why a first period was wrong reads the reason in the words
 * of the person who decided it"*, and "the person" is not in this record yet.
 */
export interface ForcedStep {
  readonly step: OnboardingStepKey
  /**
   * PERMANENT. Free text, at least `MIN_FORCE_REASON_CHARS` characters.
   *
   * The floor is the pack's own: `S1` will not commit the modal under
   * `forceWhy.trim().length > 6`, and `ForceStepRequest.reason` carries
   * `minLength: 7` for the same reason `MIN_REASON_CHARS` exists on an
   * annotation — *"to reject the thing a person types when they have not made
   * the decision the field is asking for."*
   */
  readonly reason: string
}

/**
 * A tenant's onboarding, whole.
 *
 * 🛑 `forced` IS APPEND-ONLY AND NOTHING HERE SHORTENS IT. See the header's
 * one-divergence note: the prototype overwrites, the contract says permanent,
 * and permanent wins.
 */
export interface OnboardingRecord {
  readonly completed: CompletedStepCount
  readonly forced: readonly ForcedStep[]
}

/** A tenant that has just been created: nothing done, nothing forced. */
export function newOnboarding(): OnboardingRecord {
  return { completed: 0, forced: [] }
}

/* ==================================================================== *
 * §2 · THE VIEW — what the console renders, derived and never stored.
 * ==================================================================== */

/**
 * `blocked`, `next`, `done`, `done_forced`.
 *
 * ⚠️ THE WIRE SPELLS THE FOURTH `done-and-forced` AND NOTHING PINS THE PAIR.
 * `OnboardingStep.state` is `type: string` in the contract with the four
 * values named only in a `description`, so `tools/check-wire-mirror.mjs` has
 * no pair to register and a drift between these members and that prose is
 * caught by nobody. **That is stated rather than fixed**: registering the pair
 * needs an inline `enum` on a contract this slice does not mount, and a
 * mirrored enum with no reader is the shape G284 refused. It is owed by the
 * commit that mounts `listOnboardingSteps`.
 */
export const STEP_STATES = {
  blocked: 'blocked',
  next: 'next',
  done: 'done',
  doneForced: 'done_forced',
} as const
export type StepState = (typeof STEP_STATES)[keyof typeof STEP_STATES]

export interface OnboardingStepView {
  readonly step: OnboardingStepKey
  readonly title: string
  readonly state: StepState
  readonly whoseHands: WhoseHands
  /** Present only on a `done_forced` step. */
  readonly forcedReason?: string
}

/**
 * The six steps as the console renders them.
 *
 * 🛑 **EXACTLY ONE STEP IS `next`, AND EXACTLY ZERO WHEN ALL SIX ARE DONE.**
 * `S1`: *"the first step that is not done is the only one that can be done."*
 * `tests/model/onboarding.test.ts` §2 asserts the count over every reachable
 * record rather than over a chosen example, because "exactly one" is the kind
 * of claim a single fixture cannot make.
 */
export function onboardingSteps(record: OnboardingRecord): readonly OnboardingStepView[] {
  const forcedBy = new Map<OnboardingStepKey, string>()
  for (const f of record.forced) forcedBy.set(f.step, f.reason)

  return ONBOARDING_STEPS.map((step, index): OnboardingStepView => {
    const done = index < record.completed
    const reason = forcedBy.get(step)
    const base = {
      step,
      title: STEP_TITLE[step],
      whoseHands: STEP_HANDS[step],
    }
    if (done && reason !== undefined) {
      return { ...base, state: STEP_STATES.doneForced, forcedReason: reason }
    }
    if (done) return { ...base, state: STEP_STATES.done }
    if (index === record.completed) return { ...base, state: STEP_STATES.next }
    return { ...base, state: STEP_STATES.blocked }
  })
}

/**
 * Where the roster's `stage` column comes from.
 *
 * ⚠️ TWO ARMS AND NOT THREE. See the header: `stalled` needs a clock this
 * module does not have and a threshold nobody has ruled on.
 */
export type OnboardingStage =
  | { readonly kind: 'live' }
  | { readonly kind: 'onboarding'; readonly next: OnboardingStepKey }

export function onboardingStage(record: OnboardingRecord): OnboardingStage {
  /**
   * ⚠️ WIDENED TO AN ARRAY ON PURPOSE, AND `tsc` INSISTED. Indexing the TUPLE
   * at `record.completed` is `TS2493` — *"has no element at index '6'"* —
   * because the all-done count is one past the end, which is exactly the case
   * this function exists to answer. Widening makes `noUncheckedIndexedAccess`
   * hand back `| undefined` and the `live` arm is that `undefined`, read
   * rather than asserted away with a cast.
   */
  const steps: readonly OnboardingStepKey[] = ONBOARDING_STEPS
  const next = steps[record.completed]
  if (next === undefined) return { kind: 'live' }
  return { kind: 'onboarding', next }
}

/* ==================================================================== *
 * §3 · THE TWO TRANSITIONS, AND THE ONLY TWO.
 * ==================================================================== */

/** `S1` will not commit a force under seven characters. So neither will this. */
export const MIN_FORCE_REASON_CHARS = 7

/**
 * Every way a transition is refused.
 *
 * ⚠️ THESE ARE MODEL REFUSALS AND NOT WIRE CODES. `errors.yaml`'s enum is
 * CLOSED and the contract maps exactly one of these onto it —
 * `completeOnboardingStep`'s 409 is `step_not_current`, *"an existing member
 * of the closed enum, minted for a procedure step and exactly right here"*.
 * The other three have no wire spelling because no operation is mounted; the
 * commit that mounts one owes the mapping, and `stepIsCurrent` is the one to
 * argue about, because 422 and 409 are both defensible for it.
 */
export const ONBOARDING_REFUSALS = {
  /** A step other than the first incomplete one was named for completion. */
  stepNotCurrent: 'step_not_current',
  /** The named step is already done. Completing it twice is not idempotent — it is a lie. */
  stepAlreadyDone: 'step_already_done',
  /**
   * A force was aimed at the step that could simply be completed.
   *
   * 🛑 REFUSED RATHER THAN ALLOWED, AND IT IS A RULE ABOUT WHAT THE MARK
   * MEANS. `S1` draws it — `canForce: !done && !isNext` — and the reason is in
   * the contract: the mark records *"why the sequence was broken"*. Forcing
   * the step that was next breaks no sequence, so a record carrying that mark
   * would report a gate passed out of order when none was, and a review
   * reading the mark would be reading a false one.
   */
  stepIsCurrent: 'step_is_current',
  /** Under `MIN_FORCE_REASON_CHARS` once trimmed. */
  reasonTooShort: 'reason_too_short',
} as const
export type OnboardingRefusal = (typeof ONBOARDING_REFUSALS)[keyof typeof ONBOARDING_REFUSALS]

export const ONBOARDING_REFUSAL_KINDS = [
  'step_not_current',
  'step_already_done',
  'step_is_current',
  'reason_too_short',
] as const satisfies readonly OnboardingRefusal[]

/** The house proof that the list above is complete. */
export type _EveryOnboardingRefusalIsListed =
  [OnboardingRefusal] extends [(typeof ONBOARDING_REFUSAL_KINDS)[number]] ? true : never

export type OnboardingOutcome =
  | { readonly ok: true; readonly record: OnboardingRecord }
  | { readonly ok: false; readonly refusal: OnboardingRefusal }

/**
 * Mark the next step done. Only ever the next one.
 *
 * Pure: it returns a new record and mutates nothing, which is what lets a
 * handler put the write and the read in one transaction without the two
 * disagreeing about what it just did.
 */
export function completeStep(record: OnboardingRecord, step: OnboardingStepKey): OnboardingOutcome {
  const index = ONBOARDING_STEPS.indexOf(step)
  if (index < record.completed) {
    return { ok: false, refusal: ONBOARDING_REFUSALS.stepAlreadyDone }
  }
  if (index !== record.completed) {
    return { ok: false, refusal: ONBOARDING_REFUSALS.stepNotCurrent }
  }
  return { ok: true, record: { ...record, completed: advanceTo(index + 1) } }
}

/**
 * Force a BLOCKED gate, out of order, permanently on the record.
 *
 * 🛑 THE EFFECT IS DELIBERATELY WIDE: the named step **and everything above
 * it** become done. The contract's reason is the one to keep: *"a gate passed
 * out of order does not leave the earlier ones meaningful."* `S1` does the
 * same thing — `for (let i = 0; i <= forceOn; i++) m[i] = true` — and the
 * prefix-length state makes it one assignment here rather than a loop.
 *
 * ⚠️ ONE MARK IS WRITTEN, NOT ONE PER SKIPPED STEP. The steps below the forced
 * one are marked `done`, not `done_forced`, and that matches both the drawing
 * and the meaning: one decision was taken, by one person, for one reason, and
 * inventing five copies of it would make a review think five were.
 */
export function forceStep(
  record: OnboardingRecord,
  step: OnboardingStepKey,
  reason: string,
): OnboardingOutcome {
  const index = ONBOARDING_STEPS.indexOf(step)
  if (index < record.completed) {
    return { ok: false, refusal: ONBOARDING_REFUSALS.stepAlreadyDone }
  }
  if (index === record.completed) {
    return { ok: false, refusal: ONBOARDING_REFUSALS.stepIsCurrent }
  }
  const trimmed = reason.trim()
  if (trimmed.length < MIN_FORCE_REASON_CHARS) {
    return { ok: false, refusal: ONBOARDING_REFUSALS.reasonTooShort }
  }
  return {
    ok: true,
    record: {
      completed: advanceTo(index + 1),
      /* APPEND. Nothing in this module removes an entry. */
      forced: [...record.forced, { step, reason: trimmed }],
    },
  }
}

/** Was this tenant's sequence ever broken? The question a review asks first. */
export function wasForced(record: OnboardingRecord): boolean {
  return record.forced.length > 0
}

/**
 * The one narrowing in the module, and it is named rather than inlined.
 *
 * `indexOf` returns `number`, and `CompletedStepCount` is a literal union, so
 * some narrowing is unavoidable. It is confined here, beside the bound that
 * makes it sound: both callers have already established
 * `0 <= index < ONBOARDING_STEPS.length`, so `index + 1` is in `1..length`,
 * every member of which is in the union by `_MAX_IS_EVERY_STEP` and
 * `TupleIndex`. The `as` is the cast `CLAUDE.md` requires to say why; this
 * docblock is the why.
 */
function advanceTo(count: number): CompletedStepCount {
  return count as CompletedStepCount
}
