/**
 * H2's SEQUENCE, THE GATE AND THE PERMANENT MARK — `model/onboarding.ts`.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE EXISTS FOR
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The pack's H2 row: *"Onboarding state in the model — Nothing persists the
 * sequence, the force or the mark. All of it is state on this surface. **NOT
 * BUILT**"*. `model/onboarding.ts` is that row and this file is what makes it
 * more than a declaration: the module is types and pure functions, and
 * `CLAUDE.md` is explicit that in a types-only model *"a green `tsc` is WEAK
 * evidence"* and *"only a fixture witnesses the content."*
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE MUTATIONS, WITNESSED RED BEFORE THIS FILE WAS TRUSTED
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Every assertion below was confirmed to CATCH something by breaking the
 * module and reading the failure, and each mutation was then reverted. The
 * exact text is in the commit message; the shapes are:
 *
 *   · `completeStep` accepting any step (drop the `!==` guard)   → §3
 *   · `forceStep` marking ONLY the named step done               → §4
 *   · `forceStep` REPLACING `forced` instead of appending        → §5
 *   · the reason floor lowered to 0                              → §4c
 *   · `STEP_HANDS.tag_policy` flipped to `ours`                  → §1b
 *   · `onboardingSteps` marking the LAST incomplete step `next`  → §2
 *
 * 🛑 AND TWO MUTATIONS SURVIVED A FIRST DRAFT OF THIS FILE, WHICH IS WHY §2
 * AND §5 ARE SHAPED THE WAY THEY ARE. The first draft asserted the step
 * states of ONE record (`newOnboarding()`), and the "last incomplete step is
 * next" mutation passed it — at zero completed, the first and last incomplete
 * steps are not the same, but the assertion only looked at index 0's state
 * being `next` and index 5's being `blocked`, and the mutation gets index 0
 * wrong only when nothing is done. §2 now walks EVERY reachable record. The
 * second draft asserted `forced.length >= 1` after one force, and the
 * replace-instead-of-append mutation passed it; §5 forces twice and reads
 * both reasons back.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  ONBOARDING_STEPS,
  STEP_HANDS,
  STEP_TITLE,
  STEP_STATES,
  WHOSE_HANDS,
  ONBOARDING_REFUSALS,
  ONBOARDING_REFUSAL_KINDS,
  MIN_FORCE_REASON_CHARS,
  newOnboarding,
  onboardingSteps,
  onboardingStage,
  completeStep,
  forceStep,
  wasForced,
  type OnboardingRecord,
  type OnboardingStepKey,
} from '../../model/onboarding.ts'

/** Every record this module can reach: 0…6 completed, no forcing. */
function everyProgress(): OnboardingRecord[] {
  let record = newOnboarding()
  const all: OnboardingRecord[] = [record]
  for (const step of ONBOARDING_STEPS) {
    const out = completeStep(record, step)
    assert.ok(out.ok, `arranging: completing \`${step}\` in order was refused`)
    record = out.record
    all.push(record)
  }
  return all
}

/* ==================================================================== *
 * §1 · THE VOCABULARY IS THE PACK'S, AND IT IS TOTAL.
 * ==================================================================== */

test('§1 · six steps, in the order `S1 Staff.dc.html` declares them', () => {
  assert.deepEqual(
    [...ONBOARDING_STEPS],
    [
      'tenant_record',
      'tag_policy',
      'sources_bound',
      'pack_installed',
      'extraction_floor',
      'first_run',
    ],
    'The sequence is transcribed from `S1`\'s own `STEPS` array and the ORDER is the rule — ' +
      '"each step is blocked by the one above it". Derive the source: ' +
      '`grep -n "STEPS = \\[" -A 16 "docs/handoff-pack/S1 Staff.dc.html"`.',
  )
})

test('§1b · whose hands each step is in, transcribed and TOTAL', () => {
  /**
   * 🛑 THE POSITIVE HALF FIRST. Asserting only "every step has an owner"
   * would pass against a `Record` filled with `ours`, which is the mutation
   * this section was witnessed against — and it is the one that matters,
   * because H2.9's complaint is *"a stall with no named owner is chased by
   * the wrong party"* and a uniformly-`ours` table chases every stall
   * internally while looking complete.
   */
  assert.equal(STEP_HANDS.tag_policy, WHOSE_HANDS.theirs, 'the tag vocabulary is the customer\'s')
  assert.equal(STEP_HANDS.sources_bound, WHOSE_HANDS.both, 'we declare the source; the credential is theirs')
  assert.equal(STEP_HANDS.first_run, WHOSE_HANDS.ours)

  const distinct = new Set(ONBOARDING_STEPS.map((s) => STEP_HANDS[s]))
  assert.ok(
    distinct.size === 3,
    `The six steps name ${distinct.size} distinct owner(s) and the pack draws three. A table ` +
      'that collapsed to one would satisfy every totality check and answer H2.9 wrongly.',
  )

  for (const step of ONBOARDING_STEPS) {
    assert.ok(STEP_TITLE[step].length > 0, `\`${step}\` has no title, and \`OnboardingStep.title\` is required on the wire`)
  }
})

/* ==================================================================== *
 * §2 · EXACTLY ONE STEP IS `next` — over EVERY reachable record.
 * ==================================================================== */

test('§2 · exactly one step is `next`, and exactly zero once the sixth is done', () => {
  const records = everyProgress()
  assert.equal(records.length, 7, 'arranging: 0…6 completed is seven records')

  records.forEach((record, completed) => {
    const views = onboardingSteps(record)
    assert.equal(views.length, ONBOARDING_STEPS.length)

    const next = views.filter((v) => v.state === STEP_STATES.next)
    const expected = completed === ONBOARDING_STEPS.length ? 0 : 1
    assert.equal(
      next.length,
      expected,
      `With ${completed} step(s) done, ${next.length} step(s) read \`next\` and ${expected} ` +
        'should. `S1`: "the first step that is not done is the only one that can be done."',
    )
    if (expected === 1) {
      assert.equal(
        next[0]?.step,
        ONBOARDING_STEPS[completed],
        'the `next` step is the FIRST incomplete one, never a later one',
      )
    }

    /* And the shape around it: a done prefix, then next, then blocked. */
    views.forEach((view, index) => {
      if (index < completed) {
        assert.ok(
          view.state === STEP_STATES.done || view.state === STEP_STATES.doneForced,
          `step ${index} is inside the completed prefix and reads \`${view.state}\``,
        )
      } else if (index > completed) {
        assert.equal(view.state, STEP_STATES.blocked, `step ${index} is above the gate and must be blocked`)
      }
    })
  })
})

test('§2b · the stage is `onboarding` until the sixth step, then `live`', () => {
  const records = everyProgress()
  records.forEach((record, completed) => {
    const stage = onboardingStage(record)
    if (completed === ONBOARDING_STEPS.length) {
      assert.equal(stage.kind, 'live')
    } else {
      assert.equal(stage.kind, 'onboarding')
      assert.equal(
        stage.kind === 'onboarding' ? stage.next : null,
        ONBOARDING_STEPS[completed],
        'the stage names the step the tenant is waiting on',
      )
    }
  })
})

/* ==================================================================== *
 * §3 · ONLY THE NEXT STEP MAY BE COMPLETED.
 * ==================================================================== */

test('§3 · completing any step but the next is refused `step_not_current`', () => {
  const fresh = newOnboarding()

  const ok = completeStep(fresh, 'tenant_record')
  assert.ok(ok.ok, 'the FIRST step is completable on a fresh record — the positive half')
  assert.equal(ok.record.completed, 1)

  /* Every other step, and there are five of them. */
  for (const step of ONBOARDING_STEPS.slice(1)) {
    const out = completeStep(fresh, step)
    assert.equal(out.ok, false, `\`${step}\` was completed out of order`)
    assert.equal(
      out.ok === false ? out.refusal : null,
      ONBOARDING_REFUSALS.stepNotCurrent,
      'the contract maps this one onto `errors.yaml`\'s existing `step_not_current` rather ' +
        'than minting a twin',
    )
  }
})

test('§3b · completing a step already done is refused by NAME, not silently allowed', () => {
  const one = completeStep(newOnboarding(), 'tenant_record')
  assert.ok(one.ok)
  const again = completeStep(one.record, 'tenant_record')
  assert.equal(again.ok, false)
  assert.equal(
    again.ok === false ? again.refusal : null,
    ONBOARDING_REFUSALS.stepAlreadyDone,
    'a second completion is not idempotent — the caller believes something happened that ' +
      'did not, and `step_not_current` would misdescribe it',
  )
})

/* ==================================================================== *
 * §4 · FORCING A GATE.
 * ==================================================================== */

test('§4 · forcing a blocked step marks it AND everything above it done', () => {
  const fresh = newOnboarding()
  const forced = forceStep(fresh, 'extraction_floor', 'the customer set it by hand last week')
  assert.ok(forced.ok, forced.ok === false ? `refused ${forced.refusal}` : '')

  assert.equal(
    forced.record.completed,
    5,
    'forcing step five marks five done. The contract: "a gate passed out of order does not ' +
      'leave the earlier ones meaningful."',
  )

  const views = onboardingSteps(forced.record)
  assert.equal(views[4]?.state, STEP_STATES.doneForced, 'the forced step carries the forced mark')
  assert.equal(views[4]?.forcedReason, 'the customer set it by hand last week')

  /**
   * 🛑 AND THE FOUR BELOW IT ARE `done`, NOT `done_forced`. One decision was
   * taken, by one person, for one reason; five copies of the mark would make
   * a review think five were.
   */
  for (const index of [0, 1, 2, 3]) {
    assert.equal(views[index]?.state, STEP_STATES.done, `step ${index} was swept, not forced`)
    assert.equal(views[index]?.forcedReason, undefined)
  }
  assert.equal(views[5]?.state, STEP_STATES.next, 'the sixth step is now the one that can be done')
})

test('§4b · forcing the step that is already NEXT is refused `step_is_current`', () => {
  const out = forceStep(newOnboarding(), 'tenant_record', 'a perfectly good reason')
  assert.equal(out.ok, false)
  assert.equal(
    out.ok === false ? out.refusal : null,
    ONBOARDING_REFUSALS.stepIsCurrent,
    'forcing the next step breaks no sequence, so a mark recording that the sequence was ' +
      'broken would be a FALSE record. `S1` draws it: `canForce: !done && !isNext`.',
  )
})

test('§4c · a reason under the floor is refused, and the floor is the pack\'s', () => {
  assert.equal(MIN_FORCE_REASON_CHARS, 7, '`ForceStepRequest.reason` carries `minLength: 7`')

  for (const reason of ['', '   ', 'n/a', 'todo', '      ok     ']) {
    const out = forceStep(newOnboarding(), 'first_run', reason)
    assert.equal(out.ok, false, `"${reason}" was accepted as a reason`)
    assert.equal(
      out.ok === false ? out.refusal : null,
      ONBOARDING_REFUSALS.reasonTooShort,
      'the floor exists "to reject the thing a person types when they have not made the ' +
        'decision the field is asking for"',
    )
  }

  /* The positive half: seven characters is enough, and it is TRIMMED. */
  const ok = forceStep(newOnboarding(), 'first_run', '  waiting on their SFTP key  ')
  assert.ok(ok.ok)
  assert.equal(
    ok.ok === true ? ok.record.forced[0]?.reason : null,
    'waiting on their SFTP key',
    'the stored reason is trimmed, so the floor cannot be cleared with whitespace',
  )
})

/* ==================================================================== *
 * §5 · THE MARK IS PERMANENT, AND PERMANENT MEANS APPEND-ONLY.
 * ==================================================================== */

test('§5 · a SECOND force does not overwrite the first reason', () => {
  /**
   * 🛑 THIS IS THE ONE DELIBERATE DIVERGENCE FROM THE PROTOTYPE, ASSERTED
   * RATHER THAN NARRATED. `S1` holds `forced:{t, i, why}` — one slot — and a
   * second force REPLACES it. The contract calls the reason *"PERMANENT, AND
   * THE ONLY RECORD OF WHY THE SEQUENCE WAS BROKEN"*, and a record a second
   * write can overwrite is not a permanent record.
   *
   * ⚠️ AND IT IS TWO FORCES RATHER THAN ONE BECAUSE A ONE-FORCE ASSERTION
   * PASSES AGAINST THE REPLACING IMPLEMENTATION. That mutation survived the
   * first draft of this file.
   */
  const first = forceStep(newOnboarding(), 'tag_policy', 'their vocabulary is not agreed yet')
  assert.ok(first.ok)
  const second = forceStep(first.record, 'extraction_floor', 'floor set from the pilot corpus')
  assert.ok(second.ok, second.ok === false ? `refused ${second.refusal}` : '')

  assert.equal(second.record.forced.length, 2, 'the first forcing was overwritten by the second')
  assert.deepEqual(
    second.record.forced.map((f) => f.step),
    ['tag_policy', 'extraction_floor'],
    'both marks survive, in the order they were taken',
  )

  const views = onboardingSteps(second.record)
  assert.equal(views[1]?.forcedReason, 'their vocabulary is not agreed yet')
  assert.equal(views[4]?.forcedReason, 'floor set from the pilot corpus')
  assert.ok(wasForced(second.record))
})

test('§5b · nothing in the module clears a mark — asserted over the exported surface', () => {
  /**
   * The contract: *"There is no operation that clears it: a gate that can be
   * un-forced leaves no evidence it was ever forced."* The module-level form
   * of that is that the only two transitions both preserve `forced`.
   */
  const forced = forceStep(newOnboarding(), 'tag_policy', 'their vocabulary is not agreed yet')
  assert.ok(forced.ok)
  const after = completeStep(forced.record, 'sources_bound')
  assert.ok(after.ok, after.ok === false ? `refused ${after.refusal}` : '')
  assert.deepEqual(
    after.record.forced.map((f) => f.step),
    ['tag_policy'],
    'completing a later step dropped the forced mark',
  )
  assert.ok(wasForced(after.record), 'a tenant carries the mark "for the life of the record"')
})

/* ==================================================================== *
 * §6 · WHAT THIS MODULE DELIBERATELY DOES NOT DO.
 * ==================================================================== */

test('§6 · the refusal vocabulary is closed and complete', () => {
  assert.deepEqual(
    [...ONBOARDING_REFUSAL_KINDS].sort(),
    Object.values(ONBOARDING_REFUSALS).sort(),
    'the listed kinds and the declared members disagree — `_EveryOnboardingRefusalIsListed` ' +
      'proves the type side and this proves the value side, which is the pair CLAUDE.md ' +
      'says a total Record needs because "a total Record only bites where something ' +
      'CONSTRUCTS one"',
  )
})

test('§6b · there is NO `stalled` stage, and the absence is a statement', () => {
  /**
   * 🛑 A TRIPWIRE, AND IT IS THE KIND THAT IS HONEST: it asserts an absence
   * whose REASON is a missing producer rather than a missing feature. `S1`
   * draws `stage: 'stalled · 19 days'` and counts *"Stalled over 14 days"*,
   * and neither the timestamp nor the threshold has a producer anywhere —
   * there is no table to carry one and no ruling to set the other. Inventing
   * the arm would ship a stage nothing ever reaches, which reads as
   * implemented.
   *
   * ⚠️ WHEN A CLOCK ARRIVES THIS GOES RED, which is the point: the commit
   * that adds one must argue the threshold rather than discover this test.
   */
  const kinds = new Set(everyProgress().map((r) => onboardingStage(r).kind))
  assert.deepEqual([...kinds].sort(), ['live', 'onboarding'])
})

test('§6c · a step key that is not in the sequence is not constructible', () => {
  /**
   * The compile-time half, kept runnable rather than left to `tsc`. If
   * `OnboardingStepKey` ever widened to `string`, this line stops being a
   * type error and the `@ts-expect-error` becomes TS2578 — a RED — which is
   * the same device `tests/model/below-floor-held.test.ts` uses for
   * `AssertNoTextDeep`.
   */
  // @ts-expect-error `first_reconciliation` is not a member of the closed sequence
  const bogus: OnboardingStepKey = 'first_reconciliation'
  assert.equal(typeof bogus, 'string')
})
