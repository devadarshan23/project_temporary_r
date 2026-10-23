/**
 * `RulePredicate.unique_within` — the evaluator. #239 [I-5], G178.
 *
 * WHAT WAS WRONG. The predicate has declared cross-run uniqueness since before
 * this pass began and nothing evaluated it:
 *
 *     grep -rn 'unique_within' model/*.ts     → 2 lines
 *
 * one declaration in `model/domain.ts` and one prose note in
 * `model/reconciliation.ts`. **The control was declared and did nothing** —
 * exactly the state `model/domain.ts` gives, four lines under the union, as the
 * reason the `matches_pattern` arm was DELETED rather than left standing:
 * *"that shape is DECLARED with NO EVALUATOR ANYWHERE IN THE TREE … That is not
 * a dormant feature, it is an instruction to the next engineer."*
 *
 * 🛑 THE MISREADING THIS SUITE GUARDS AGAINST. C17 landed as *"a duplicate
 * address is a named refusal"* and does not touch this. `duplicate_item_address`
 * fires on a repeated `itemKey` — an ADDRESS: a re-delivered file, or a
 * `lineIndex` minted from insertion order. It detects no repeated invoice
 * number and holds no cross-run state.
 * `test_the_uniqueness_verdict_is_not_the_population_defect_that_names_a_duplicate_address`
 * asserts the separation rather than assuming it (§5.1).
 *
 * ⚠️ WHAT THE FIRST RED PROVED AND WHAT IT DID NOT. `evaluateUniqueWithin` did
 * not exist, so this file failed at load with `TS2307` and every case failed
 * identically. §0 below asserts facts that were TRUE AT BASE so the red was
 * reportable as a split rather than as a uniform wall, and every behavioural
 * assertion was additionally proved to BITE by mutation once the
 * implementation existed — recorded at the foot of this file.
 *
 * Every expected value below is a literal typed into this file.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  POPULATION_DEFECT_KINDS,
  UNIQUENESS_SCOPES,
  accountLedgerWrite,
  evaluateUniqueWithin,
  uniquenessConflictPinning,
  uniquenessPreflight,
} from '../../model/reconciliation.ts'
import type {
  KnownUniquenessConflicts,
  LedgerInsertOutcome,
  SubjectDigest,
  UniquenessScope,
  UniquenessVerdict,
} from '../../model/reconciliation.ts'
import type { RulePredicate } from '../../model/domain.ts'
import type { FieldPath } from '../../model/kernel.ts'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/* Branded values are minted by a cast in fixtures, which is the house pattern:
 * nothing in `model/` may construct a `SubjectDigest`, because hashing needs
 * `node:crypto` and `model/tsconfig.json` is standalone. */
const digestA = 'sha256:aaa' as SubjectDigest
const digestB = 'sha256:bbb' as SubjectDigest

/* A `FieldPath` is a token list under G214, not a string. */
const invoiceNumberPath = [{ kind: 'key', key: 'invoice_number' }] as unknown as FieldPath

function uniqueWithin(scope: UniquenessScope): RulePredicate {
  return {
    kind: 'unique_within',
    subject: { kind: 'field', slot: 'invoice', path: invoiceNumberPath },
    scope,
  }
}

/** A conflicts map in which every named scope was QUERIED and found the given digests. */
function queried(
  entries: readonly (readonly [UniquenessScope, readonly SubjectDigest[]])[],
): KnownUniquenessConflicts {
  return {
    byScope: new Map(entries.map(([scope, digests]) => [scope, new Set(digests)])),
  }
}

function kindOf(verdict: UniquenessVerdict): string {
  return verdict.kind === 'refused' ? `refused:${verdict.refusal.kind}` : verdict.kind
}

/* ------------------------------------------------------------------ *
 * §0. Cases that PASSED AT BASE
 *
 * These read the tree as it stood before the evaluator existed. They do not
 * import anything from §11.
 * ------------------------------------------------------------------ */

test('test_at_base_the_predicate_is_declared_with_exactly_its_four_scopes', () => {
  const domain = readFileSync(join(REPO_ROOT, 'model', 'domain.ts'), 'utf8')
  /* The declaration #239's evidence block quotes. It was there at base and the
   * evaluator's totality is relative to it. */
  assert.match(
    domain,
    /kind: 'unique_within'; subject: Expr; scope: 'group' \| 'run' \| 'period' \| 'tenant_lifetime'/,
  )
})

test('test_at_base_an_absent_field_classification_already_REFUSES_at_four_sites', () => {
  const source = readFileSync(join(REPO_ROOT, 'model', 'reconciliation.ts'), 'utf8')
  /* G178 adopted the injection design *"because it matches the engine's
   * established pattern"* — `AdmissionContext.fieldClassification` is already a
   * caller-supplied map whose absent entry refuses. Five lines: the declaration
   * plus four refusal sites. This is the precedent amendment (a) says to match,
   * and it was true at base. */
  const hits = source.match(/field_not_classified/g) ?? []
  assert.equal(hits.length, 5)
})

/* ------------------------------------------------------------------ *
 * §1. 🛑 AMENDMENT (a) — THE DEFINING CASE
 * ------------------------------------------------------------------ */

test('test_an_unsupplied_conflict_map_REFUSES_rather_than_passing', () => {
  /* 🛑 THE CASE THE WHOLE SLICE EXISTS FOR, #239 §2 item 1, G178 amendment (a).
   *
   * The natural implementation is `conflicts.get(scope)?.has(digest)`. On an
   * unsupplied map that yields `undefined`, which is FALSY, so the rule
   * SILENTLY PASSES — fail-open on a duplicate-payment control. G178 states in
   * its own cell that `noUncheckedIndexedAccess` will NOT catch this one,
   * because the optional chain is legal.
   *
   * This case fails against the optional-chain implementation and passes
   * against the refusing one. */
  const empty: KnownUniquenessConflicts = { byScope: new Map() }

  for (const scope of Object.values(UNIQUENESS_SCOPES)) {
    const verdict = evaluateUniqueWithin({ scope, digest: digestA, conflicts: empty })
    assert.equal(
      kindOf(verdict),
      'refused:conflict_map_not_supplied',
      `scope ${scope} passed instead of refusing`,
    )
  }
})

test('test_a_scope_that_was_QUERIED_and_found_nothing_is_unique_and_is_not_confused_with_an_unqueried_one', () => {
  /* 🛑 THE DISTINCTION THAT MAKES THE CONTROL WORK, and the reason the shape is
   * a Map of Sets rather than a flat Set. A flat set collapses "queried, found
   * nothing" into "never queried" — and the collapse fails OPEN.
   *
   * Present-and-empty must be `unique`; absent must be `refused`. Two states,
   * two answers, from inputs that are both "no digest matched". */
  const queriedEmpty = queried([['tenant_lifetime', []]])
  assert.equal(
    kindOf(evaluateUniqueWithin({ scope: 'tenant_lifetime', digest: digestA, conflicts: queriedEmpty })),
    'unique',
  )

  const neverQueried: KnownUniquenessConflicts = { byScope: new Map() }
  assert.equal(
    kindOf(evaluateUniqueWithin({ scope: 'tenant_lifetime', digest: digestA, conflicts: neverQueried })),
    'refused:conflict_map_not_supplied',
  )
})

test('test_a_map_that_queried_ONE_scope_does_not_satisfy_the_guard_for_the_OTHER_THREE', () => {
  /* 🛑 ADDED AFTER MUTATION TESTING, AND THE MUTATION IS WORTH NAMING BECAUSE
   * THE GAP WAS INVISIBLE BY READING. Replacing `conflicts.byScope.has(scope)`
   * with `conflicts.byScope.size > 0` left the entire suite GREEN — including
   * `..._an_unsupplied_conflict_map_REFUSES_rather_than_passing`, which loops
   * over all four scopes and therefore looked like the case that would catch it.
   *
   * It did not, and the reason is instructive: that case passes a COMPLETELY
   * EMPTY map, so `size > 0` is false for every scope and the mutant refuses
   * exactly as the real implementation does. **Iterating the scopes was not the
   * same as varying which of them was queried.**
   *
   * Under the mutant, a run that queried the ledger for `run` alone would be
   * told its `tenant_lifetime` subjects are unique — a duplicate invoice from
   * six months ago silently passing, which is the precise fail-open G178
   * amendment (a) exists to refuse. The map below is the one that distinguishes
   * them: non-empty, and missing three of the four scopes. */
  const onlyRunQueried = queried([['run', [digestA]]])

  assert.equal(
    kindOf(evaluateUniqueWithin({ scope: 'run', digest: digestA, conflicts: onlyRunQueried })),
    'duplicate',
    'the one scope that WAS queried must still be answered',
  )

  for (const scope of ['group', 'period', 'tenant_lifetime'] as const) {
    assert.equal(
      kindOf(evaluateUniqueWithin({ scope, digest: digestA, conflicts: onlyRunQueried })),
      'refused:conflict_map_not_supplied',
      `scope ${scope} was never queried and must refuse, not inherit run's answer`,
    )
  }
})

test('test_a_missing_map_refuses_BEFORE_a_missing_digest_is_considered', () => {
  /* The order of the two guards is load-bearing. Written the other way round, a
   * row with no digest against a scope that was never queried reports
   * `subject_not_digested` — a true statement that hides the larger one — and
   * the caller fixes the digest and is still fail-open. */
  const empty: KnownUniquenessConflicts = { byScope: new Map() }
  assert.equal(
    kindOf(evaluateUniqueWithin({ scope: 'run', digest: null, conflicts: empty })),
    'refused:conflict_map_not_supplied',
  )

  /* 🛑 THE NON-EMPTY CASE, ADDED AFTER MUTATION TESTING, AND IT IS THE ONLY
   * THING THAT SEPARATES THE SCOPE GUARD FROM A SIZE CHECK.
   *
   * Mutating `conflicts.byScope.has(scope)` to `conflicts.byScope.size === 0`
   * left the suite GREEN, and the reason is worth writing down rather than
   * patching around: the evaluator has DEFENCE IN DEPTH. Its later
   * `seen === undefined` arm catches an unqueried scope and returns the same
   * refusal, so on almost every input the two implementations are
   * indistinguishable — an equivalent mutant, not a live fault.
   *
   * They differ on EXACTLY ONE input: a non-empty map that does not carry this
   * scope, with no digest. The real implementation refuses on the MAP, which is
   * the larger and more actionable fact; the size check falls through to the
   * digest arm and reports `subject_not_digested`, sending the caller to fix a
   * hash when the actual defect is a pre-flight query they never ran.
   *
   * That is the same ordering argument this case was written for, now driven on
   * the one input that can observe it. The redundant guard stays: two arms
   * arriving at the same refusal by different routes is the fail-closed posture
   * working, not duplication to be tidied away. */
  const otherScopeQueried = queried([['period', [digestA]]])
  assert.equal(
    kindOf(evaluateUniqueWithin({ scope: 'run', digest: null, conflicts: otherScopeQueried })),
    'refused:conflict_map_not_supplied',
  )

  /* And with THIS scope supplied, the digest arm is reachable — otherwise the
   * assertions above would be passing for the wrong reason. */
  assert.equal(
    kindOf(evaluateUniqueWithin({ scope: 'run', digest: null, conflicts: queried([['run', []]]) })),
    'refused:subject_not_digested',
  )
})

/* ------------------------------------------------------------------ *
 * §2. Totality over the four scopes — §5.10, each with a fixture
 * ------------------------------------------------------------------ */

test('test_the_evaluator_answers_all_four_scopes_and_each_has_a_constructed_fixture', () => {
  /* §5.10: a total record or a conditional assertion holds the SHAPE; only a
   * fixture that CONSTRUCTS a value witnesses the CONTENT. Each of the four
   * scopes is driven here with a real duplicate and a real miss. */
  const scopes = Object.values(UNIQUENESS_SCOPES)
  assert.deepEqual(scopes.slice().sort(), ['group', 'period', 'run', 'tenant_lifetime'])

  for (const scope of scopes) {
    const conflicts = queried([[scope, [digestA]]])
    assert.equal(
      kindOf(evaluateUniqueWithin({ scope, digest: digestA, conflicts })),
      'duplicate',
      `scope ${scope} failed to report a duplicate`,
    )
    assert.equal(
      kindOf(evaluateUniqueWithin({ scope, digest: digestB, conflicts })),
      'unique',
      `scope ${scope} reported a duplicate for an unseen digest`,
    )
  }
})

test('test_a_duplicate_verdict_names_the_scope_and_the_digest_and_never_the_subject_value', () => {
  /* Amendment (b), asserted on the value rather than only on the type. The
   * verdict's whole payload is a scope and a hash. */
  const verdict = evaluateUniqueWithin({
    scope: 'tenant_lifetime',
    digest: digestA,
    conflicts: queried([['tenant_lifetime', [digestA]]]),
  })
  assert.deepEqual(verdict, { kind: 'duplicate', scope: 'tenant_lifetime', digest: digestA })
})

/* ------------------------------------------------------------------ *
 * §3. The two hard scopes, driven across TWO runs
 * ------------------------------------------------------------------ */

test('test_period_and_tenant_lifetime_catch_the_duplicate_in_the_SECOND_run', () => {
  /* 🛑 #239 §2 item 3. `period` and `tenant_lifetime` cross run boundaries,
   * which is why G178 rules pre-flight INJECTION rather than an in-run check.
   *
   * An evaluator that only sees the current run's population passes `group` and
   * `run` and fails these two — which is exactly the implementation the ruling
   * exists to refuse. The duplicate is caught in the SECOND run, against a
   * ledger the first run wrote.
   *
   * The ledger is a plain Set here: this module reaches no database, and the
   * caller's one batched query is what produces the map. */
  for (const scope of ['period', 'tenant_lifetime'] as const) {
    const ledger = new Set<SubjectDigest>()

    /* RUN 1. The ledger is empty but it WAS queried, so the answer is unique
     * rather than a refusal. The run then writes its digest post-flight. */
    const run1 = evaluateUniqueWithin({
      scope,
      digest: digestA,
      conflicts: { byScope: new Map([[scope, new Set(ledger)]])},
    })
    assert.equal(kindOf(run1), 'unique', `${scope}: run 1 should be unique`)
    ledger.add(digestA)

    /* RUN 2, a separate run with its own population. The same identifier
     * arrives again — months later, in the `tenant_lifetime` case — and is
     * caught only because the ledger crossed the run boundary. */
    const run2 = evaluateUniqueWithin({
      scope,
      digest: digestA,
      conflicts: { byScope: new Map([[scope, new Set(ledger)]])},
    })
    assert.equal(kindOf(run2), 'duplicate', `${scope}: run 2 should be a duplicate`)
  }
})

/* ------------------------------------------------------------------ *
 * §4. The pure pre-flight extraction
 * ------------------------------------------------------------------ */

test('test_the_preflight_extracts_only_unique_within_subjects_and_leaves_other_predicates_alone', () => {
  const predicates: RulePredicate[] = [
    { kind: 'present', subject: { kind: 'field', slot: 'invoice', path: invoiceNumberPath } },
    uniqueWithin('tenant_lifetime'),
    uniqueWithin('run'),
  ]
  const preflight = uniquenessPreflight(predicates)
  assert.deepEqual(
    preflight.subjects.map((s) => s.scope),
    ['tenant_lifetime', 'run'],
  )
  assert.deepEqual(preflight.defects, [])
})

test('test_a_subject_that_names_no_field_is_a_named_defect_rather_than_a_silently_skipped_rule', () => {
  /* Only `field` and `aggregate` name a `FieldPath`; `constant`, `sum`,
   * `difference` and `product` have no addressable key to hang a ledger row on.
   * Refusing loudly matters because a silently skipped `unique_within` is
   * exactly the declared-and-does-nothing state this slice ends. */
  const preflight = uniquenessPreflight([
    {
      kind: 'unique_within',
      subject: {
        kind: 'difference',
        left: { kind: 'field', slot: 'invoice', path: invoiceNumberPath },
        right: { kind: 'field', slot: 'payment', path: invoiceNumberPath },
      },
      scope: 'run',
    },
  ])
  assert.deepEqual(preflight.subjects, [])
  assert.deepEqual(preflight.defects, [
    { kind: 'subject_not_a_field_reference', scope: 'run' },
  ])
})

test('test_the_preflight_is_pure_and_returns_the_same_answer_twice', () => {
  /* G143(b): the rebuild is a pure, total function of its named inputs. */
  const predicates = [uniqueWithin('period')]
  assert.deepEqual(uniquenessPreflight(predicates), uniquenessPreflight(predicates))
})

/* ------------------------------------------------------------------ *
 * §5. Amendment (c) — pinning
 * ------------------------------------------------------------------ */

test('test_two_resumes_against_different_ledger_states_cannot_produce_two_answers_from_one_content_key', () => {
  /* 🛑 #239 §2 item 5, G178 amendment (c). Without pinning
   * `knownUniquenessConflicts`, **two resumes against different ledger states
   * produce two different answers from identical input** — the key stable while
   * the answer was not.
   *
   * The two ledger states below give genuinely different ANSWERS, so their
   * pinnings must differ. If the pinning were equal, a content key built over
   * it would be equal too, and the resume would be unsound. */
  const before = queried([['tenant_lifetime', []]])
  const after = queried([['tenant_lifetime', [digestA]]])

  assert.equal(
    kindOf(evaluateUniqueWithin({ scope: 'tenant_lifetime', digest: digestA, conflicts: before })),
    'unique',
  )
  assert.equal(
    kindOf(evaluateUniqueWithin({ scope: 'tenant_lifetime', digest: digestA, conflicts: after })),
    'duplicate',
  )

  assert.notDeepEqual(uniquenessConflictPinning(before), uniquenessConflictPinning(after))
})

test('test_an_unqueried_scope_pins_differently_from_a_queried_empty_one', () => {
  /* The same distinction §1 makes, carried into the content key. A resume that
   * REFUSED and a resume that passed must not share a key. */
  const neverQueried: KnownUniquenessConflicts = { byScope: new Map() }
  const queriedEmpty = queried([['run', []]])
  assert.deepEqual(uniquenessConflictPinning(neverQueried), [])
  assert.deepEqual(uniquenessConflictPinning(queriedEmpty), [['run', []]])
})

test('test_the_pinning_is_stable_across_set_insertion_order_and_map_key_order', () => {
  /* 🛑 A `Set` ITERATES IN INSERTION ORDER, which is a property of how the
   * caller happened to build it — not of what it contains. Pinning that would
   * make the content key depend on the order rows came back from a database,
   * and G143(b) requires the rebuild to be a pure function of its NAMED inputs.
   * Insertion order is not one of them. */
  const one: KnownUniquenessConflicts = {
    byScope: new Map([
      ['run', new Set([digestA, digestB])],
      ['period', new Set([digestB])],
    ] as const),
  }
  const other: KnownUniquenessConflicts = {
    byScope: new Map([
      ['period', new Set([digestB])],
      ['run', new Set([digestB, digestA])],
    ] as const),
  }
  assert.deepEqual(uniquenessConflictPinning(one), uniquenessConflictPinning(other))
  /* And the order is the declared scope order, not the map's. */
  assert.deepEqual(uniquenessConflictPinning(one), [
    ['run', ['sha256:aaa', 'sha256:bbb']],
    ['period', ['sha256:bbb']],
  ])
})

/* ------------------------------------------------------------------ *
 * §6. Amendment (d) — bounded retry, COUNTED suppression
 * ------------------------------------------------------------------ */

test('test_the_retry_is_bounded_and_the_suppression_is_counted', () => {
  /* G143(c) verbatim: *"Bound the retry and COUNT the suppression."* Part (c)
   * is the half everyone drops — *"a no-op that leaves no trace is
   * indistinguishable from work that never happened."* */
  const raced: LedgerInsertOutcome[] = [{ kind: 'raced' }, { kind: 'raced' }, { kind: 'inserted' }]

  const settled = accountLedgerWrite(raced, 3)
  assert.deepEqual(settled, {
    attemptsUsed: 3,
    attemptBudget: 3,
    suppressedRepeats: 2,
    settled: 'inserted',
  })

  /* Bounded: the same sequence under a budget of 2 stops, and says so rather
   * than absorbing it. G114 — *"a bound that was hit is recorded, never
   * silently absorbed."* */
  const exhausted = accountLedgerWrite(raced, 2)
  assert.deepEqual(exhausted, {
    attemptsUsed: 2,
    attemptBudget: 2,
    suppressedRepeats: 2,
    settled: 'duplicate',
  })
})

test('test_a_first_attempt_that_inserts_stops_immediately_and_counts_no_suppression', () => {
  assert.deepEqual(accountLedgerWrite([{ kind: 'inserted' }], 3), {
    attemptsUsed: 1,
    attemptBudget: 3,
    suppressedRepeats: 0,
    settled: 'inserted',
  })
})

test('test_a_non_positive_or_fractional_budget_settles_as_exhausted_rather_than_inventing_a_default', () => {
  /* A default retry bound is a number nobody stated, which `PRODUCT.md` forbids
   * and G139 refuses. */
  for (const bad of [0, -1, 2.5, Number.NaN]) {
    const account = accountLedgerWrite([{ kind: 'inserted' }], bad)
    assert.equal(account.settled, 'budget_exhausted')
    assert.equal(account.attemptsUsed, 0)
    assert.equal(account.attemptBudget, 0)
  }
})

/* ------------------------------------------------------------------ *
 * §7. Containment and separation
 * ------------------------------------------------------------------ */

test('test_the_uniqueness_verdict_is_not_the_population_defect_that_names_a_duplicate_address', () => {
  /* 🛑 §5.1, landmark substitution, asserted rather than assumed — #239 §3.
   * `duplicate_item_address` fires on a repeated `itemKey`: a re-delivered file
   * or a `lineIndex` minted from insertion order. It is an ADDRESS, at a
   * different grain, reported differently, and it holds no cross-run state.
   * Nothing in this slice may be filed under it. */
  assert.ok(POPULATION_DEFECT_KINDS.includes('duplicate_item_address'))
  const verdict = evaluateUniqueWithin({
    scope: 'tenant_lifetime',
    digest: digestA,
    conflicts: queried([['tenant_lifetime', [digestA]]]),
  })
  assert.equal(verdict.kind, 'duplicate')
  /* The verdict is not a `PopulationDefect` and carries no `kind` from that
   * union — a future edit that merged the two would fail here. */
  assert.equal(POPULATION_DEFECT_KINDS.includes(verdict.kind as never), false)
})

test('test_the_evaluator_never_receives_a_raw_subject_value_because_the_hash_is_minted_outside_model', () => {
  /* Amendment (b), asserted structurally. `model/canonical.ts` states the rule
   * for itself — *"It does not hash … The hasher lives with the writer, outside
   * `model/`."* — and §11 takes only a branded `SubjectDigest`. */
  const source = readFileSync(join(REPO_ROOT, 'model', 'reconciliation.ts'), 'utf8')
  const code = source
    .split('\n')
    .filter((line) => !/^\s*(\*|\/\*|\/\/)/.test(line))
    .join('\n')
  /* The module hashes nothing and imports no crypto. `model/tsconfig.json` is
   * standalone, so a `node:crypto` import here would end that property too. */
  assert.equal(/node:crypto/.test(code), false)
  assert.equal(/createHash/.test(code), false)
})

test('test_the_migration_stores_a_digest_column_and_no_raw_subject_value', () => {
  /* #239's acceptance: the ledger column stores a hash. Read from the
   * migration's own bytes rather than trusted. */
  const migration = readFileSync(
    join(REPO_ROOT, 'db', 'migrations', '0004_subject_ledger.sql'),
    'utf8',
  )
  assert.match(migration, /subject_digest\s+text\s+NOT NULL/)
  /* The column the ruling forbids must not exist. */
  assert.equal(/subject_value/.test(migration), false)
  /* The race guard, and RLS both ENABLEd and FORCEd with G100's deny-on-NULL
   * predicate written out rather than described. */
  assert.match(migration, /CREATE UNIQUE INDEX subject_ledger_unique/)
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/)
  assert.match(migration, /FORCE\s+ROW LEVEL SECURITY/)
  assert.match(migration, /nullif\(current_setting\('app\.tenant_id', true\), ''\)/)
})

/* ====================================================================
 * MUTATIONS — MEASURED, not predicted. Applied, suite run, reds recorded, tree
 * restored with `git checkout`.
 *
 * `tsc` was GREEN for all but M9 and M10. §5.10 again: the compiler had nothing
 * to say about the eight that matter most.
 *
 *   M1  🛑 THE ONE THIS SLICE EXISTS FOR. The whole guard replaced by the
 *       natural optional chain:
 *         `if (conflicts.byScope.get(scope)?.has(digest) === true) return duplicate
 *          return { kind: 'unique' }`
 *       — G178 amendment (a)'s named fail-open, written exactly as a hurried
 *       reader would write it.
 *       → 4 red: `..._an_unsupplied_conflict_map_REFUSES_rather_than_passing`,
 *          `..._QUERIED_and_found_nothing_is_unique_and_is_not_confused…`,
 *          `..._refuses_BEFORE_a_missing_digest_is_considered`, and
 *          `..._queried_ONE_scope_does_not_satisfy_the_guard_for_the_OTHER_THREE`.
 *          🛑 `tsc` EXIT 0, and every scope case and both two-run cases stayed
 *          GREEN. **Nothing else in the repository catches it**, which is the
 *          ruling's own point about `noUncheckedIndexedAccess`.
 *
 *   M2  🛑 THE ONE THAT SURVIVED THE FIRST ROUND, AND THE REASON IS WORTH MORE
 *       THAN THE MUTATION. `conflicts.byScope.has(scope)` →
 *       `conflicts.byScope.size === 0`. → **0 red on the first run**, including
 *       against `..._an_unsupplied_conflict_map_REFUSES_rather_than_passing`,
 *       which loops over all four scopes and looked like the case that would
 *       catch it. It did not: that case passes a COMPLETELY EMPTY map, so
 *       `size === 0` is true for every scope and the mutant refuses identically.
 *       **Iterating the scopes was not the same as varying which was queried.**
 *
 *       Investigating the survival found the evaluator has DEFENCE IN DEPTH —
 *       its later `seen === undefined` arm catches an unqueried scope by another
 *       route — so on almost every input the two are an EQUIVALENT MUTANT rather
 *       than a live fault. They differ on exactly one: a non-empty map missing
 *       this scope, with no digest, where the mutant reports
 *       `subject_not_digested` and sends the caller to fix a hash when the real
 *       defect is a pre-flight query they never ran. Two cases were added — the
 *       one-scope-queried case and that distinguishing input — and the mutation
 *       now produces → 1 red. The redundant guard STAYS: two arms reaching the
 *       same refusal by different routes is the fail-closed posture working.
 *
 *   M3  Swap the two guards so the digest check runs first. → 1 red:
 *       `..._refuses_BEFORE_a_missing_digest_is_considered`.
 *
 *   M4  `uniquenessPreflight` treats the four non-field `Expr` arms as a
 *       `continue` instead of a defect — the silent skip. → 1 red. Under the
 *       mutant a `unique_within` over an expression is declared and does
 *       nothing, which is the exact state this slice ends.
 *
 *   M5  `uniquenessConflictPinning` pins `[...seen]` unsorted. → 1 red:
 *       `..._stable_across_set_insertion_order_and_map_key_order`. The content
 *       key then depends on database row order.
 *
 *   M6  Pins `[scope, []]` for an unqueried scope instead of skipping it.
 *       → 2 red. A refusing resume and a passing resume then share a key.
 *
 *   M7  `accountLedgerWrite` drops the `attemptsUsed >= bound` break. → 2 red.
 *       The retry stops being bounded: G143(c) half applied, counter without
 *       the bound.
 *
 *   M8  Stops counting `suppressedRepeats`. → 1 red. The bound without the
 *       counter — the half G143 says everyone drops, and *"a no-op that leaves
 *       no trace is indistinguishable from work that never happened."*
 *
 *   M9  Add `subjectValue: string` to the `duplicate` arm. → `TS2344` at
 *       `_UniquenessVerdictHoldsNoTextDeep`. **This is the containment proof
 *       verified RED**, which it had to be before being trusted green:
 *       `Assert<never>` compiles, so a vacuous proof reads exactly like a real
 *       one. It is also the mutation a future reader wanting to show an operator
 *       WHICH invoice collided would actually write.
 *
 *   M10 Delete `tenantLifetime` from `UNIQUENESS_SCOPES`. → `TS2344` at
 *       `_UniquenessScopesMirrorThePredicate`, plus 2 red. The pin between the
 *       evaluator and the predicate, biting. Written in the constraint form
 *       deliberately: `model/domain.ts` records the `? true : never` shape
 *       MEASURED as inert against exactly this mutation.
 * ==================================================================== */
