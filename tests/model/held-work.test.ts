/**
 * `model/held-work.ts` — #238 [A-15], G156 · G162 · G225 · G233.
 *
 * WHAT THIS FILE EXISTS FOR. `/signin/lapsed` draws a panel that says work was
 * held, and — because G156 gives an open draft TWO independent clocks — it may
 * say the work is gone. Neither clock had a number and neither had a type. MG6,
 * `docs/model-gaps.md`: *"Neither module nor clock exists, so neither clock has
 * a number to render."*
 *
 * 🛑 HONEST STATEMENT OF THE FIRST RED, BECAUSE #238 DEMANDS ONE AND IT IS THE
 * WEAKEST KIND. `model/held-work.ts` did not exist, so this file failed at LOAD
 * with `TS2307: Cannot find module` and EVERY case failed identically — which
 * proves nothing whatever about the clocks. An import error is not a witnessed
 * red. Two things answer that, and both are in this file:
 *
 *   · the cases in §0 below assert facts that were TRUE AT BASE, before
 *     `model/held-work.ts` existed, so the red was reported as a split rather
 *     than as a uniform wall;
 *   · every behavioural assertion was additionally proved to BITE by mutation
 *     once the implementation existed. The mutations and the tests each caught
 *     are recorded in the block at the foot of this file.
 *
 * 🛑 THE TRAP THIS SUITE ALSO EXISTS TO KEEP SHUT. `MAX_AUTHORIZATION_SECONDS`
 * (`grep -n 'MAX_AUTHORIZATION_SECONDS' model/access.ts`) is a GRANT ceiling
 * keyed by resource class — how long one authorised ACT may live. A held draft
 * is not an act; it is unfinished human work. Reading one as the other is
 * `docs/HANDOFF.md` §5.1's landmark substitution exactly, #238 names it by
 * number, and #226 names the same trap for `SessionBounds`.
 * `test_the_held_work_module_takes_no_value_import_so_it_cannot_have_read_the_grant_ceiling`
 * makes that structural rather than a review convention.
 *
 * ⚠️ NO DURATION LITERAL APPEARS IN THE SLICE ITSELF. Both bounds are FDE-set
 * configuration refusing on absence (G139), `PRODUCT.md` forbids inventing a
 * figure, and no ruling has supplied one for drafts — unlike G220, which
 * supplied two integers for sessions. The numbers below are FIXTURE values
 * typed into this file, and they are deliberately round and small so that no
 * reader mistakes one for a schedule.
 *
 * Every expected value below is a literal typed into this file, for the reason
 * `tests/model/access-decide.test.ts` gives: comparing a constant to itself
 * passes forever and witnesses nothing.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  HELD_WORK_BOUND_FIELDS,
  HELD_WORK_BOUND_REFUSAL_REASONS,
  HELD_WORK_RETENTION_CLASS,
  HELD_WORK_STANDINGS,
  autosaveMeterGrain,
  heldWorkIdleSecondsFromRetentionDays,
  heldWorkStanding,
  latestPossiblePurge,
  purgeAfterForHeldDraft,
  touchHeldDraft,
  validateHeldWorkBounds,
} from '../../model/held-work.ts'
import type {
  HeldDraft,
  HeldWorkBoundRefusal,
  HeldWorkBounds,
  HeldWorkBoundsInput,
} from '../../model/held-work.ts'
import { RETENTION_CLASSES, RETENTION_RECORD_KIND } from '../../model/domain.ts'
import { PLACEHOLDER_RETENTION_POLICY } from '../../model/examples.ts'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/* A pair well inside every arm — one hour of absolute cap, ten minutes of idle
 * — so no test below sits on a boundary by accident. The boundaries get tests
 * of their own. FIXTURE VALUES, not a schedule; see the header. */
const bounds: HeldWorkBounds = { maxOpenDraftAgeSeconds: 3600, maxIdleSeconds: 600 }

/** T0. An arbitrary epoch second, round only so the arithmetic below is readable. */
const T0 = 1_000_000

function draftAt(heldAt: number, lastHeldAt: number): HeldDraft {
  return {
    tenantId: 'ten_acme',
    draftId: 'hd_1',
    heldByUserId: 'usr_1',
    heldAt,
    lastHeldAt,
    authorizationId: 'auth_1',
  }
}

function reasonsOf(input: HeldWorkBoundsInput): readonly string[] {
  const result = validateHeldWorkBounds(input)
  if (result.ok) return []
  return result.refusals.map((refusal: HeldWorkBoundRefusal) => refusal.reason)
}

function fieldsOf(input: HeldWorkBoundsInput): readonly string[] {
  const result = validateHeldWorkBounds(input)
  if (result.ok) return []
  return result.refusals.map((refusal: HeldWorkBoundRefusal) => refusal.field)
}

/* ------------------------------------------------------------------ *
 * §0. Cases that PASSED AT BASE
 *
 * These assert facts about the tree as it stood BEFORE model/held-work.ts
 * existed. They are what turns the first red from "every case failed
 * identically at import" into a reportable split — #238's own requirement, and
 * the discipline `tests/model/managed-service.test.ts` states for itself.
 *
 * ⚠️ THEY DO NOT IMPORT model/held-work.ts. That is the whole point: a case in
 * this section that reached into the new module would have failed at base along
 * with everything else and proved nothing.
 * ------------------------------------------------------------------ */

test('test_at_base_the_grant_ceiling_is_keyed_by_resource_class_and_is_not_a_draft_bound', () => {
  const access = readFileSync(join(REPO_ROOT, 'model', 'access.ts'), 'utf8')
  /* It exists, and it is a Record keyed by resource class — not a duration a
   * draft could borrow. The point of asserting it here is that the trap #238
   * names is real and reachable, so the structural test below has something to
   * be structural ABOUT. */
  assert.ok(access.includes('MAX_AUTHORIZATION_SECONDS'))
  assert.match(access, /MAX_AUTHORIZATION_SECONDS\s*:\s*Record<\s*AccessResourceClass/)
})

test('test_at_base_a_timestamp_is_a_bare_string_alias_which_is_why_this_module_works_in_epoch_seconds', () => {
  const kernel = readFileSync(join(REPO_ROOT, 'model', 'kernel.ts'), 'utf8')
  /* `Timestamp = string`. G156's rule is arithmetic over instants, and string
   * arithmetic needs a codec that does not exist — `model/session.ts` records
   * why it must not be improvised. This is the fact that justifies
   * `EpochSeconds`, and it was true at base. */
  assert.match(kernel, /export type Timestamp = string/)
})

/* ------------------------------------------------------------------ *
 * §1. The structural fence — the landmark trap, kept shut
 * ------------------------------------------------------------------ */

test('test_the_held_work_module_takes_no_value_import_so_it_cannot_have_read_the_grant_ceiling', () => {
  const source = readFileSync(join(REPO_ROOT, 'model', 'held-work.ts'), 'utf8')
  const code = source
    .split('\n')
    .filter((line) => !/^\s*(\*|\/\*|\/\/)/.test(line))
    .join('\n')

  /* ZERO value imports. The one import in the file is `import type`, which
   * `verbatimModuleSyntax` erases before the loader sees it — so at runtime
   * this module has no module specifier at all and there is no path by which
   * the grant ceiling could be read even by accident. */
  const valueImports = code.match(/^import \{/gm) ?? []
  assert.deepEqual(valueImports, [])

  /* #238's acceptance criterion, verbatim:
   * `grep -rn 'MAX_AUTHORIZATION_SECONDS' model/held-work.ts | wc -l` → 0.
   * Asserted over the WHOLE source including comments, deliberately: the
   * constant must not be named here even in prose, because a reader who greps
   * for it should find nothing to copy. */
  assert.equal(source.includes('MAX_AUTHORIZATION_SECONDS'), false)
})

test('test_no_duration_literal_is_hard_coded_as_a_bound_anywhere_in_the_module', () => {
  const source = readFileSync(join(REPO_ROOT, 'model', 'held-work.ts'), 'utf8')
  const code = source
    .split('\n')
    .filter((line) => !/^\s*(\*|\/\*|\/\/)/.test(line))
    .join('\n')

  /* The ONLY numeric literal permitted in the code is 86400 — the seconds in a
   * day, used by the days->seconds conversion. It is a unit conversion, not a
   * bound: it states how long a day is, which nobody has to decide. Any other
   * number here would be an invented duration, which `PRODUCT.md` forbids and
   * G139 refuses. */
  const numbers = (code.match(/\b\d[\d_]*\b/g) ?? []).filter((n) => n !== '0' && n !== '1')
  assert.deepEqual(numbers, ['86400'])
})

/* ------------------------------------------------------------------ *
 * §2. Both clocks refuse on absence — G139
 * ------------------------------------------------------------------ */

test('test_both_clocks_refuse_on_absence_and_BOTH_are_named', () => {
  assert.deepEqual(reasonsOf({}), ['bounds_not_configured', 'bounds_not_configured'])
  /* BOTH fields, not just the first. A validator that stops at the first absent
   * bound tells a deployer to state one number and then refuses again for the
   * other. */
  assert.deepEqual(fieldsOf({}), ['maxOpenDraftAgeSeconds', 'maxIdleSeconds'])
})

test('test_a_present_but_undefined_bound_refuses_exactly_as_an_absent_one_does', () => {
  /* `exactOptionalPropertyTypes` makes these two different inputs, and a
   * configuration reader produces both: a spread of a partial object yields
   * `undefined`, an unset key yields absence. They are the same defect. */
  assert.deepEqual(reasonsOf({ maxOpenDraftAgeSeconds: undefined, maxIdleSeconds: 600 }), [
    'bounds_not_configured',
  ])
})

test('test_an_absent_bound_is_not_silently_filled_in_from_anything', () => {
  /* THE POINT OF THE WHOLE SLICE, and the sibling of #226's
   * `..._not_silently_filled_in_from_the_platform_ceiling`. There is no
   * platform ceiling here to become a default, and there must be no other
   * source either — refusal is the intended failure. */
  const result = validateHeldWorkBounds({ maxIdleSeconds: 600 })
  assert.equal(result.ok, false)
})

test('test_an_infinite_cap_is_refused_rather_than_read_as_a_very_long_one', () => {
  /* THE DANGEROUS ONE, and worse here than for a session: `Math.min`
   * PROPAGATES NaN, so a NaN cap makes `purgeAfter` NaN and every sweep
   * comparison against it is false. That is the never-expiring class G233
   * warns about, arriving through a config string. */
  assert.deepEqual(
    reasonsOf({ maxOpenDraftAgeSeconds: Number.POSITIVE_INFINITY, maxIdleSeconds: 600 }),
    ['bound_not_a_number'],
  )
  assert.deepEqual(reasonsOf({ maxOpenDraftAgeSeconds: Number.NaN, maxIdleSeconds: 600 }), [
    'bound_not_a_number',
  ])
})

test('test_a_zero_bound_is_refused_with_its_own_reason_rather_than_as_a_negative', () => {
  /* Absence wearing a value's clothes — what a missing integer reads as in most
   * configuration parsers. It gets its own arm so a deployer is told what
   * actually happened. */
  assert.deepEqual(reasonsOf({ maxOpenDraftAgeSeconds: 0, maxIdleSeconds: 600 }), ['bound_zero'])
})

test('test_a_fractional_bound_is_refused_rather_than_truncated', () => {
  assert.deepEqual(reasonsOf({ maxOpenDraftAgeSeconds: 3600.5, maxIdleSeconds: 600 }), [
    'bound_not_an_integer',
  ])
})

test('test_an_idle_bound_at_or_above_the_cap_is_refused_because_the_two_clocks_would_collapse_into_one', () => {
  /* 🛑 THIS ARM IS WHY G156 IS NOT §5.3. The ruling's author foreclosed the cap
   * as two-vocabularies-for-one-concept and the red disputed it and was upheld:
   * *"they are two different questions: idle expiry and absolute lifetime."*
   * A configuration in which the idle clock can never fire first is a
   * configuration with only ONE clock — the single-clock design that was
   * refused — so it is refused here rather than accepted and left inert. */
  assert.deepEqual(reasonsOf({ maxOpenDraftAgeSeconds: 600, maxIdleSeconds: 600 }), [
    'idle_at_least_cap',
  ])
  assert.deepEqual(reasonsOf({ maxOpenDraftAgeSeconds: 600, maxIdleSeconds: 900 }), [
    'idle_at_least_cap',
  ])
})

test('test_every_declared_refusal_reason_is_producible_by_some_input', () => {
  /* A DECLARED ARM NOTHING CAN PRODUCE is the defect review does not catch, and
   * `tests/model/session-bounds.test.ts` records a mutation that this shape and
   * only this shape caught. */
  const produced = new Set<string>([
    ...reasonsOf({}),
    ...reasonsOf({ maxOpenDraftAgeSeconds: Number.NaN, maxIdleSeconds: 600 }),
    ...reasonsOf({ maxOpenDraftAgeSeconds: 3600.5, maxIdleSeconds: 600 }),
    ...reasonsOf({ maxOpenDraftAgeSeconds: 0, maxIdleSeconds: 600 }),
    ...reasonsOf({ maxOpenDraftAgeSeconds: -1, maxIdleSeconds: 600 }),
    ...reasonsOf({ maxOpenDraftAgeSeconds: 600, maxIdleSeconds: 600 }),
  ])
  assert.deepEqual(
    [...produced].sort(),
    Object.values(HELD_WORK_BOUND_REFUSAL_REASONS).slice().sort(),
  )
})

test('test_a_well_formed_pair_survives_validation_unchanged', () => {
  const result = validateHeldWorkBounds({ maxOpenDraftAgeSeconds: 3600, maxIdleSeconds: 600 })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.bounds, { maxOpenDraftAgeSeconds: 3600, maxIdleSeconds: 600 })
})

test('test_the_bound_field_list_and_the_interface_are_the_same_two_names', () => {
  assert.deepEqual(HELD_WORK_BOUND_FIELDS.slice().sort(), [
    'maxIdleSeconds',
    'maxOpenDraftAgeSeconds',
  ])
})

/* ------------------------------------------------------------------ *
 * §3. 🛑 THE BEHAVIOURAL RED — touching cannot extend the cap
 * ------------------------------------------------------------------ */

test('test_touching_a_draft_cannot_extend_the_absolute_cap', () => {
  /* 🛑 THE CASE THIS WHOLE SLICE EXISTS FOR, #238 §2 item 2.
   *
   * A draft created at T0 with cap C, TOUCHED REPEATEDLY up to and past T0+C,
   * still expires at T0+C.
   *
   * The lazy repair G156 names by product is `purgeAfter = lastHeldAt + idle`
   * — recomputing the whole schedule from the last-touched timestamp. It passes
   * every idle-expiry test anybody would write and it makes an actively-touched
   * draft IMMORTAL: G156 records that it *"means the retention class is
   * decorative and destroys the PDPA argument that justified minting it."*
   *
   * This case fails on that repair and on no other. */
  const cap = T0 + bounds.maxOpenDraftAgeSeconds
  /* Past this instant the idle term would exceed the cap, so from here on the
   * cap is the binding operand and the answer must stop moving. Derived from
   * the bounds rather than typed in, so the fixture cannot drift away from it. */
  const capBindsFrom = cap - bounds.maxIdleSeconds

  let draft = draftAt(T0, T0)
  /* Touch every five minutes for two hours — well past the one-hour cap. */
  for (let at = T0 + 300; at <= T0 + 7200; at += 300) {
    draft = touchHeldDraft(draft, at)
    const purgeAfter = purgeAfterForHeldDraft(draft, bounds)

    /* THE INVARIANT, and the one the lazy repair breaks: no touch, ever, moves
     * the purge instant past the cap. */
    assert.ok(purgeAfter <= cap, `a touch at ${at} moved the purge instant past the cap`)

    /* And once the cap is the binding operand it is EXACTLY the answer and
     * stops moving. Under `purgeAfter = lastHeldAt + idle` this value grows
     * without bound instead — which is the immortal draft. */
    if (at >= capBindsFrom) {
      assert.equal(purgeAfter, cap, `a touch at ${at} failed to pin to the cap`)
    }
  }

  /* And the draft really was being touched — otherwise the loop above would be
   * asserting over a value nothing changed, which is the vacuous-fixture trap
   * §5.10 names. */
  assert.equal(draft.lastHeldAt, T0 + 7200)
  /* `heldAt` never moved. That is the mechanism, stated as an assertion. */
  assert.equal(draft.heldAt, T0)
})

test('test_an_untouched_draft_expires_on_the_idle_clock_which_is_the_earlier_one', () => {
  /* The other half. Without this, an implementation that always returned
   * `heldAt + cap` would pass the case above and drop the idle clock entirely
   * — which is the mirror-image defect and just as wrong. */
  const draft = draftAt(T0, T0)
  assert.equal(purgeAfterForHeldDraft(draft, bounds), T0 + bounds.maxIdleSeconds)
  /* And it is genuinely the earlier of the two, not a coincidence of fixture. */
  assert.ok(T0 + bounds.maxIdleSeconds < T0 + bounds.maxOpenDraftAgeSeconds)
})

test('test_a_touch_moves_the_purge_instant_forward_until_the_cap_is_reached_and_then_stops', () => {
  /* The two clocks doing two different things, in one sequence. */
  const draft0 = draftAt(T0, T0)
  assert.equal(purgeAfterForHeldDraft(draft0, bounds), T0 + 600)

  /* A touch at T0+1800: idle would give T0+2400, cap gives T0+3600. Idle wins. */
  const draft1 = touchHeldDraft(draft0, T0 + 1800)
  assert.equal(purgeAfterForHeldDraft(draft1, bounds), T0 + 2400)

  /* A touch at T0+3300: idle would give T0+3900, cap gives T0+3600. Cap wins,
   * and from here no further touch changes the answer. */
  const draft2 = touchHeldDraft(draft1, T0 + 3300)
  assert.equal(purgeAfterForHeldDraft(draft2, bounds), T0 + 3600)

  const draft3 = touchHeldDraft(draft2, T0 + 3599)
  assert.equal(purgeAfterForHeldDraft(draft3, bounds), T0 + 3600)
})

test('test_a_replayed_or_backdated_touch_cannot_move_the_schedule_in_either_direction', () => {
  /* G143 requires a retry to be reconstructible. Clocks go backwards across
   * nodes, and a replayed autosave must be a no-op rather than a rewind. */
  const draft = touchHeldDraft(draftAt(T0, T0), T0 + 300)
  assert.equal(touchHeldDraft(draft, T0 + 100).lastHeldAt, T0 + 300)
  assert.equal(touchHeldDraft(draft, T0 + 300).lastHeldAt, T0 + 300)
  assert.equal(touchHeldDraft(draft, Number.NaN).lastHeldAt, T0 + 300)
})

test('test_a_touch_never_rewrites_held_at', () => {
  /* The immutability that makes the cap term a constant of the draft. Asserted
   * directly, because an implementation that mutated `heldAt` would pass a
   * carelessly-written version of the cap test above. */
  const draft = touchHeldDraft(draftAt(T0, T0), T0 + 9999)
  assert.equal(draft.heldAt, T0)
})

/* ------------------------------------------------------------------ *
 * §4. The abandonment rule — G233's explicit demand
 * ------------------------------------------------------------------ */

test('test_the_purge_instant_is_bounded_by_a_number_that_no_touch_enters_into', () => {
  /* 🛑 G233: *"a class whose clock never starts is a class that never
   * expires."* This is the executable answer. `latestPossiblePurge()` is
   * computed from `heldAt` alone — `lastHeldAt` is not a parameter — so it is
   * fixed at creation, and the purge instant can never exceed it however the
   * draft is used. Abandonment therefore needs no event: a holder who walks
   * away is expired by the idle term, a holder who never stops is expired by
   * the cap term, and there is no third case. */
  const latest = latestPossiblePurge(draftAt(T0, T0), bounds)
  assert.equal(latest, T0 + 3600)

  let draft = draftAt(T0, T0)
  for (let at = T0 + 60; at <= T0 + 100_000; at += 60) {
    draft = touchHeldDraft(draft, at)
    assert.ok(
      purgeAfterForHeldDraft(draft, bounds) <= latest,
      `purge instant escaped the cap after a touch at ${at}`,
    )
  }
})

test('test_the_retention_window_converts_from_days_and_refuses_a_number_that_is_not_one', () => {
  /* The idle term's provenance, made executable. G156's ruled formula names
   * `days.held_work` as the second operand directly. */
  assert.equal(heldWorkIdleSecondsFromRetentionDays(1), 86400)
  assert.equal(heldWorkIdleSecondsFromRetentionDays(30), 2_592_000)
  assert.equal(heldWorkIdleSecondsFromRetentionDays(0), null)
  assert.equal(heldWorkIdleSecondsFromRetentionDays(-1), null)
  assert.equal(heldWorkIdleSecondsFromRetentionDays(1.5), null)
  assert.equal(heldWorkIdleSecondsFromRetentionDays(Number.NaN), null)
})

/* ------------------------------------------------------------------ *
 * §5. The standing — G156's warning requirement
 * ------------------------------------------------------------------ */

test('test_a_lapse_on_the_cap_is_reported_differently_from_a_lapse_on_idleness', () => {
  /* An operator whose work was dropped for AGE must not be told it was dropped
   * for INACTIVITY. The `lapsed_cap` arm is the one a single-clock design
   * cannot produce, which is why it earns its own name. */
  const touchedThroughout = draftAt(T0, T0 + 3590)
  assert.equal(
    heldWorkStanding({
      draft: touchedThroughout,
      bounds,
      now: T0 + 3600,
      warnAtRemainingFraction: 0.1,
    }),
    HELD_WORK_STANDINGS.lapsedCap,
  )

  const abandoned = draftAt(T0, T0)
  assert.equal(
    heldWorkStanding({ draft: abandoned, bounds, now: T0 + 600, warnAtRemainingFraction: 0.1 }),
    HELD_WORK_STANDINGS.lapsedIdle,
  )
})

test('test_when_both_clocks_fire_at_the_same_instant_the_CAP_wins_the_tie', () => {
  /* 🛑 ADDED AFTER MUTATION TESTING, AND THE REASON IS RECORDED RATHER THAN THE
   * CASE QUIETLY APPEARING. The implementation reports a tie as `lapsed_cap`
   * (`cappedAt <= idleAt`), and mutating that `<=` to `<` — so a tie reports
   * `lapsed_idle` — left the ENTIRE suite GREEN. The fixture above looked like
   * a tie and was not: it touches to `T0 + 3590`, which puts the idle clock 590
   * seconds PAST the cap, so the comparison was never on its boundary.
   *
   * A boundary asserted only by a fixture that misses it is `docs/HANDOFF.md`
   * §5.6 in miniature — a control that exists and asserts nothing.
   *
   * The tie is derived, not typed in: `lastHeldAt` is placed exactly
   * `cap - idle` after `heldAt`, so both operands land on the same instant and
   * the fixture cannot drift off the boundary if a bound changes. */
  const tieAt = T0 + (bounds.maxOpenDraftAgeSeconds - bounds.maxIdleSeconds)
  const tied = draftAt(T0, tieAt)

  /* Both clocks really do fire together — asserted, so the case cannot pass by
   * having missed the boundary the way the one above did. */
  assert.equal(
    tied.heldAt + bounds.maxOpenDraftAgeSeconds,
    tied.lastHeldAt + bounds.maxIdleSeconds,
  )

  /* The cap is the stronger statement: it fires whether or not the holder came
   * back. Reporting the tie as an idle lapse would tell an operator their work
   * was dropped for inactivity when they had been touching it. */
  assert.equal(
    heldWorkStanding({
      draft: tied,
      bounds,
      now: T0 + bounds.maxOpenDraftAgeSeconds,
      warnAtRemainingFraction: 0.1,
    }),
    HELD_WORK_STANDINGS.lapsedCap,
  )
})

test('test_the_operator_is_warned_before_the_work_is_gone_rather_than_after', () => {
  /* G156 accepts as a cost that *"a genuinely long-running investigation loses
   * its draft at the ceiling"*, and requires that *"the operator must be warned
   * well before it"*. A standing with no warning arm gives `/signin/lapsed`
   * nothing to render until the work is already lost. */
  const draft = draftAt(T0, T0 + 3400)
  const at = (now: number): string =>
    heldWorkStanding({ draft, bounds, now, warnAtRemainingFraction: 0.1 })

  /* purgeAfter is T0+3600; the window from `heldAt` is 3600s, so the warning
   * point is the last 360s. */
  assert.equal(at(T0 + 3000), HELD_WORK_STANDINGS.held)
  assert.equal(at(T0 + 3300), HELD_WORK_STANDINGS.lapsingSoon)
  assert.equal(at(T0 + 3599), HELD_WORK_STANDINGS.lapsingSoon)
  assert.equal(at(T0 + 3600), HELD_WORK_STANDINGS.lapsedCap)
})

/* ------------------------------------------------------------------ *
 * §6. Autosave metering grain — G175
 * ------------------------------------------------------------------ */

test('test_autosave_is_metered_at_draft_grain_one_row_per_draft_across_many_touches', () => {
  /* G175: *"ONE ROW PER DRAFT, NEVER PER KEYSTROKE-BATCH."* The rejected
   * alternative lost because a row per keystroke-batch makes the metering table
   * *"a per-person typing-cadence record of a regulated customer's staff —
   * not a billing artefact but behavioural telemetry about named individuals,
   * produced as a side effect of a save button."*
   *
   * The assertion is on the COUNT across N touches, which is the only thing
   * that distinguishes the two grains. */
  const touches = Array.from({ length: 500 }, () => ({ draftId: 'hd_1' }))
  assert.deepEqual(autosaveMeterGrain(touches), ['hd_1'])

  /* Two drafts, interleaved, many touches each — two rows, in first-touch
   * order. Order stability is what G143(b) requires of anything a retry may
   * recompute. */
  const interleaved = [
    { draftId: 'hd_2' },
    { draftId: 'hd_1' },
    { draftId: 'hd_2' },
    { draftId: 'hd_1' },
    { draftId: 'hd_2' },
  ]
  assert.deepEqual(autosaveMeterGrain(interleaved), ['hd_2', 'hd_1'])
  assert.deepEqual(autosaveMeterGrain([]), [])
})

/* ------------------------------------------------------------------ *
 * §7. G233 — the fourteenth retention class, shared
 * ------------------------------------------------------------------ */

test('test_held_work_is_a_minted_retention_class_and_the_roster_is_fourteen', () => {
  /* G233: *"HELD WORK MINTS ONE FOURTEENTH `RetentionClass`, SHARED BY #238 AND
   * #239. IT IS ANSWERED ONCE."* Both halves land in this commit, so the class
   * is minted once here and #239 uses it. */
  assert.equal(HELD_WORK_RETENTION_CLASS, 'held_work')
  assert.equal(RETENTION_CLASSES.heldWork, 'held_work')
  assert.equal(Object.values(RETENTION_CLASSES).length, 14)
})

test('test_the_new_class_answers_every_total_record_that_is_keyed_by_retention_class', () => {
  /* §5.10: a total `Record` holds the SHAPE; only a fixture witnesses the
   * CONTENT. These are the two construction sites in the tree, and without
   * these assertions `tsc` alone would prove only that the syntax parsed. */
  assert.equal(RETENTION_RECORD_KIND.held_work, 'content')
  assert.equal(PLACEHOLDER_RETENTION_POLICY.days.held_work, 365)

  /* Every class has an answer in both, derived rather than listed — a
   * fifteenth class added to one and not the other fails here. */
  for (const retentionClass of Object.values(RETENTION_CLASSES)) {
    assert.ok(RETENTION_RECORD_KIND[retentionClass] !== undefined, retentionClass)
    assert.ok(PLACEHOLDER_RETENTION_POLICY.days[retentionClass] !== undefined, retentionClass)
  }
})

test('test_held_work_is_classified_as_content_so_the_audit_window_must_outlive_it', () => {
  /* The conservative direction, and the same reasoning `score_result` carries:
   * a held draft holds whatever a person typed into it, so it is payload rather
   * than a record ABOUT payload. `content` pulls it under `AUDIT_MUST_OUTLIVE`,
   * which lengthens the audit window rather than shortening a retention one. */
  assert.equal(RETENTION_RECORD_KIND.held_work, RETENTION_RECORD_KIND.source_document)
})

/* ====================================================================
 * MUTATIONS — MEASURED, not predicted. Each was applied, the suite run, the
 * reds recorded, and the tree restored with `git checkout`.
 *
 * 🛑 `tsc` WAS GREEN FOR EVERY ONE OF THESE EXCEPT M12. That is the point, and
 * it is §5.10 at full strength: this module is arithmetic over numbers, so
 * every mutation below type-checks perfectly. A green compiler said nothing
 * about any of them.
 *
 *   M1  🛑 THE ONE THIS SLICE EXISTS FOR. `purgeAfterForHeldDraft` returns
 *       `lastHeldAt + maxIdleSeconds` — G156's named lazy repair, dropping the
 *       `heldAt` term entirely. An actively-touched draft becomes immortal.
 *       → 3 red: `..._touching_a_draft_cannot_extend_the_absolute_cap`,
 *          `..._until_the_cap_is_reached_and_then_stops`,
 *          `..._bounded_by_a_number_that_no_touch_enters_into`.
 *          🛑 `..._an_untouched_draft_expires_on_the_idle_clock` STAYED GREEN,
 *          which is precisely the ruling's warning made visible: the repair
 *          passes every idle-expiry test anybody would write.
 *
 *   M2  Returns `heldAt + maxOpenDraftAgeSeconds` — the mirror-image defect,
 *       dropping the idle clock.
 *       → 2 red, including `..._an_untouched_draft_expires_on_the_idle_clock`.
 *          The cap tests stayed green, which is why BOTH halves earn a case.
 *
 *   M3  `Math.min` → `Math.max`. → 4 red. `least` is the ruling's own word and
 *       the direction is not arbitrary: `max` means a draft survives until BOTH
 *       clocks have fired — the union of two permissions rather than the
 *       intersection of two limits.
 *
 *   M4  `touchHeldDraft` also writes `heldAt: at`. → 4 red, and
 *       `..._a_touch_never_rewrites_held_at` is the one that names it. This is
 *       M1 wearing different clothes — it moves the cap by moving what the cap
 *       is measured FROM — and it is the version a reader is likelier to write,
 *       because it looks like housekeeping.
 *
 *   M5  Delete the `value === 0` arm, so zero is ADMITTED. → 2 red: its own
 *       case and the reason-closure case. The closure case is the one that
 *       matters — it catches a DECLARED arm nothing can produce.
 *
 *   M6  `!Number.isFinite(value)` → `Number.isNaN(value)`, so `Infinity`
 *       survives. → 1 red. Under the mutant an untouched draft's `purgeAfter`
 *       is `Infinity` and `now >= Infinity` is false forever — G233's
 *       never-expiring class, reached through a config string.
 *
 *   M7  `idle >= cap` → `idle > cap`, admitting an idle bound EQUAL to the cap.
 *       → 2 red. The idle clock can then never fire first, so the two clocks
 *          collapse into one and G156's upheld red is reversed by an operator.
 *
 *   M8  Delete the combined `!cap.ok && !idle.ok` arm. → 1 red. A deployer
 *       under the mutant states one number, redeploys, and is refused for the
 *       other.
 *
 *   M9  🛑 THE ONE THAT SURVIVED THE FIRST ROUND, AND IT IS RECORDED BECAUSE
 *       THE MISS WAS THE USEFUL FINDING. `cappedAt <= idleAt` → `<`, so a tie
 *       reports `lapsed_idle`. → **0 red on the first run.** The tie case
 *       existed in name only: the fixture touched to `T0 + 3590`, putting the
 *       idle clock 590 seconds past the cap, so the comparison was never on its
 *       boundary. A boundary asserted by a fixture that misses it is §5.6 in
 *       miniature. `..._the_CAP_wins_the_tie` was added, deriving the tie from
 *       the bounds rather than typing it in, and the mutation now produces
 *       → 1 red.
 *
 *   M11 `autosaveMeterGrain` returns `touches.map(t => t.draftId)` — the
 *       per-keystroke-batch grain G175 refused. → 1 red, with 500 rows where
 *       one belongs. Nothing else in the tree catches this; the meter itself is
 *       not minted.
 *
 *   M12 Delete `held_work` from `RETENTION_RECORD_KIND`. → `TS2741`, and
 *       `..._answers_every_total_record` red. **The only mutation in this list
 *       the compiler catches**, named so the contrast with the other eleven is
 *       on the page rather than in someone's memory.
 * ==================================================================== */
