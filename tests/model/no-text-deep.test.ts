/**
 * `AssertNoTextDeep` — THE PROOF ITSELF, PUT UNDER TEST.
 *
 * Twenty declarations in `model/reconciliation.ts` and — since #240 — THREE in
 * `model/identity.ts` assert containment with
 * `AssertNoTextDeep`, and `docs/HANDOFF.md` cites one of them —
 * `_ReaderVerdictHoldsNoTextDeep` — as compile-time containment on the reader
 * path. G118 and G120 both lean on it. So the question this file exists to
 * answer is not "does the proof compile" but "does the proof BITE", and the
 * answer as written on 9 Aug 2026 was: less than the record claimed.
 *
 * The original proof banned the TYPE `string` at a property position. It did
 * not ban a string-BEARING value. Every one of the escapes below was compiled
 * against it and PASSED while a bare `string` correctly failed.
 *
 * ⚠️ WHY THIS FILE IS NOT IN `tests/model/reconciliation-controls.test.ts`.
 * That file has one frame and it is a deliberate one: it imports NOTHING from
 * `model/`, reads the module as TEXT and bytes, and makes the eleven `grep`
 * controls in the module header executable. This control is not a text control
 * — it is a TYPE, and testing it means importing the type and asking `tsc`.
 * Folding it in would have made that file's stated subject two subjects. The
 * one thing borrowed from it is the inertness guard at the bottom, which is the
 * same shape as `money-sentinel — the sentinel declaration is still in the code`.
 *
 * HOW THE COMPILE-TIME HALF IS ASSERTED, AND WHY IT BITES IN BOTH DIRECTIONS.
 * Every escape is a `@ts-expect-error` that MUST error. Weaken the proof and
 * the directive goes unused, which is itself `TS2578`, and `npm test` runs
 * `typecheck:tests` before it executes a single assertion. Every SAFE case
 * below carries no directive at all, so a proof that over-rejects fails just as
 * loudly. `tests/model/learned-dispositions.test.ts` uses the same device for
 * G127.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { AssertNoTextDeep } from '../../model/reconciliation.ts'
import type { Id } from '../../model/kernel.ts'

/* ==================================================================== *
 * 1. THE CONTROL — a bare `string` was caught before and must stay caught
 * ==================================================================== */

// @ts-expect-error — a bare `string` at a property position. The original proof
// caught this, and it is the ONE thing it did catch. If this directive ever goes
// unused the proof has stopped working entirely.
export type _BareString = AssertNoTextDeep<{ readonly a: string }>

/* ==================================================================== *
 * 2. THE ESCAPES — each of these PASSED the original proof
 *
 * Derived by compiling the tree's own machinery, not taken on trust. Grouped by
 * the mechanism that let them through, because the mechanism is what the fix
 * has to key on.
 * ==================================================================== */

/* -- 2a. CALLABLE LEAVES. A function type is an `object` with no keys, so the
 * object arm mapped it to `{}` and `{}` accepts anything. The return type was
 * never looked at. ------------------------------------------------------ */

// @ts-expect-error — a function that RETURNS text is a text carrier.
export type _FunctionReturningString = AssertNoTextDeep<{ readonly a: () => string }>

// @ts-expect-error — a constructor signature, same hole by the same route.
export type _ConstructorSignature = AssertNoTextDeep<{
  readonly a: { new (): { readonly v: string } }
}>

/* -- 2b. METHOD-BEARING OBJECTS. Every member is callable, so every member
 * mapped to `{}` and the whole object passed. This is the shape that matters:
 * it is what `ReadonlySet`, `ReadonlyMap` and the typed arrays all are. ---- */

// @ts-expect-error — one method, and it hands back the text.
export type _MethodReturningString = AssertNoTextDeep<{
  readonly a: { describe(): string }
}>

// @ts-expect-error — `ReadonlySet<string>` is a set OF STRINGS and it passed.
export type _ReadonlySetOfString = AssertNoTextDeep<{ readonly a: ReadonlySet<string> }>

// @ts-expect-error — `ReadonlyMap` values are text and it passed.
export type _ReadonlyMapToString = AssertNoTextDeep<{
  readonly a: ReadonlyMap<number, string>
}>

// @ts-expect-error — bytes are text with one decode step between.
export type _Uint8Array = AssertNoTextDeep<{ readonly a: Uint8Array }>

// @ts-expect-error — the same, one container out.
export type _ArrayBuffer = AssertNoTextDeep<{ readonly a: ArrayBuffer }>

// @ts-expect-error — `Date`. Not text-bearing, but not provably value-free
// either: `keyof Date` is nothing but methods, so nothing about it was checked.
export type _Date = AssertNoTextDeep<{ readonly a: Date }>

/* -- 2c. OPAQUE OBJECTS. Not callable, and with NO readable member at all —
 * so the mapped type was `{}` and the leaf was admitted without a single one of
 * its contents ever being examined. Callability does not catch these; see the
 * declaration in `model/reconciliation.ts` for why the fix rejects them
 * separately. ------------------------------------------------------------ */

declare class PrivateText {
  private s: string
}

// @ts-expect-error — a class carrying a private string field.
export type _PrivateField = AssertNoTextDeep<{ readonly a: PrivateText }>

// @ts-expect-error — bare `object` admits every string carrier there is.
export type _BareObject = AssertNoTextDeep<{ readonly a: object }>

/* ==================================================================== *
 * 3. THE SAFE CASES — no directive, so an OVER-strict proof fails here
 *
 * ⚠️ THIS HALF IS NOT DECORATION. An inversion is only worth having if it still
 * admits what the eighteen live sites actually carry, and every live site is
 * built from these pieces: `kind` discriminants, basis-point numbers, index
 * arrays, branded ids, nested plain objects. ⚠️ THIRTEEN WHEN THIS WAS WRITTEN;
 * the two newest are `model/identity.ts`'s carried-turn proofs, which #240
 * migrated onto this form and which are built from exactly those pieces.
 * ==================================================================== */

export type _LiteralUnion = AssertNoTextDeep<{ readonly kind: 'candidate' | 'several' }>
export type _Numbers = AssertNoTextDeep<{
  readonly n: number
  readonly b: boolean
  readonly z: bigint
}>
export type _NullAndUndefined = AssertNoTextDeep<{
  readonly a: null
  readonly b: number | undefined
}>
export type _OptionalProperty = AssertNoTextDeep<{ readonly a?: number }>
export type _BrandedId = AssertNoTextDeep<{ readonly id: Id<'Tenant'> }>
export type _ArrayOfNumbers = AssertNoTextDeep<{ readonly xs: readonly number[] }>
export type _ArrayOfLiterals = AssertNoTextDeep<{ readonly xs: readonly ('a' | 'b')[] }>
export type _ArrayOfObjects = AssertNoTextDeep<{
  readonly xs: readonly { readonly kind: 'x'; readonly n: number }[]
}>
export type _NestedObject = AssertNoTextDeep<{
  readonly sel: { readonly size: number; readonly offset: number }
}>

/**
 * ⚠️ THE REFUSED ALTERNATIVE, PINNED AS A TEST RATHER THAN AS PROSE.
 *
 * A red team proposed excluding container types by SHAPE —
 * `{ readonly size: number } | { readonly byteLength: number }` — and it was
 * refused as itself a landmark rule (§5.1): it falsely rejects a nested
 * `{ size, offset }`, which is the design's own `SampleSelection`. `_NestedObject`
 * above and this alias are that refusal, executable. If someone reintroduces the
 * shape rule, these two go red and the reason is one line away.
 */
export type _SampleSelectionShaped = AssertNoTextDeep<{
  readonly selection: { readonly size: number }
}>

/* ==================================================================== *
 * 4. THE INERTNESS GUARD
 *
 * Everything above is a type, and a type is erased before node sees it. So the
 * whole of §1–§3 is asserted by `npm run typecheck:tests` and NOTHING here would
 * notice if `AssertNoTextDeep` were quietly reverted to something that compiles
 * against the safe cases and silently admits the escapes — the `@ts-expect-error`
 * directives would catch that, but only if this file is still typechecked. This
 * test is the second lock: it reads the module and pins the two arms the
 * inversion turns on.
 * ==================================================================== */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const MODULE_TEXT = readFileSync(join(REPO_ROOT, 'model', 'reconciliation.ts'), 'utf8')
const IDENTITY_TEXT = readFileSync(join(REPO_ROOT, 'model', 'identity.ts'), 'utf8')
const INGESTION_TEXT = readFileSync(join(REPO_ROOT, 'model', 'ingestion.ts'), 'utf8')

test('the proof is an allow-list keyed on callability, not a ban on `string`', () => {
  for (const arm of [
    // Callability. The escape class in §2a and §2b.
    'T extends Function',
    // The opaque-object arm. The escape class in §2c, which callability misses.
    '[keyof T] extends [never]',
  ]) {
    assert.ok(
      MODULE_TEXT.includes(arm),
      `AssertNoTextDeep has lost its \`${arm}\` arm — the escapes in ` +
        `tests/model/no-text-deep.test.ts are open again`,
    )
  }
})

test('all thirty-one live assertion sites are still assertions', () => {
  // A proof with no call site is `MAX_GRANT_HOURS`'s failure again. This counts
  // the sites so that a site DELETED to make a red go away is itself a red.
  //
  // ⚠️ THIRTEEN UNTIL C17. The fourteenth is `_PopulationDefectHoldsNoTextDeep`
  // (`model/reconciliation.ts` §4a), and this test going red on the day it
  // landed is the control working: the number is not free to drift, and raising
  // it is a deliberate act with a named site behind it.
  //
  // ⚠️ FOURTEEN UNTIL O-16, 16 Aug 2026. The fifteenth is
  // `_CompletenessFindingHoldsNoTextDeep` (§9a) — and it went red exactly as
  // C17 did, which is the second time this control has been the thing that
  // noticed. Raising a count control is only honest with the site named, so:
  // the site is `CompletenessFinding`, whose `source_self_report_unmet` arm
  // carries a `PopulationDefect` and whose other arm carries three numbers and
  // a side.
  //
  // 🛑 FIFTEEN IN ONE MODULE UNTIL #240, AND THE SHAPE OF THIS CONTROL CHANGED
  // WITH IT RATHER THAN ITS NUMBER. `model/identity.ts` gained the two
  // carried-turn proofs — `_CarriedTurnHoldsNoText` and
  // `_CarriedReadingHoldsNoText`, migrated off the shallow `AssertNoPlainText`
  // — so `model/reconciliation.ts` is STILL 15 and a control that counted only
  // that file would have stayed green through a change to its own subject.
  // Both modules are counted, separately, so that a site MOVED between them is
  // as red as a site deleted. The total is asserted too, because two
  // per-module figures that each drift by one in opposite directions agree
  // with nothing.
  const sitesIn = (text: string): string[] =>
    text.split('\n').filter((l: string) => /^export type _\w+ = AssertNoTextDeep</.test(l))

  const reconciliationSites = sitesIn(MODULE_TEXT)
  const identitySites = sitesIn(IDENTITY_TEXT)
  const ingestionSites = sitesIn(INGESTION_TEXT)

  /* 🛑 FIFTEEN UNTIL G236, SEVENTEEN SINCE, AND BOTH NEW SITES ARE NAMED
   * BECAUSE RAISING A COUNT CONTROL WITHOUT NAMING THE SITE IS HOW ONE STOPS
   * MEANING ANYTHING. `_DocumentTrailerVerdictHoldsNoTextDeep` and
   * `_RunDocumentAccountHoldsNoTextDeep` (§4b) — the per-document trailer
   * account, which names documents and will be rendered and logged, so a
   * `filename: string` on either is a TS2344 rather than a review finding.
   *
   * ⚠️ AND THE THIRD TYPE THAT ARRIVED WITH THEM HAS NO SITE ON PURPOSE.
   * G227's `HeldRead` carries a `FieldPath`, whose `key` segment is a bare
   * `string`, so `AssertNoTextDeep<HeldRead>` is a COMPILE ERROR — the proof
   * working, not forgotten. `tests/model/below-floor-held.test.ts` asserts that
   * error rather than leaving the absence to read as an oversight, and
   * `RefusedItem` is the same shape for the same reason: the closed union
   * carrying the REASON holds the proof, the record carrying the declared path
   * does not. */
  /* 🛑 SEVENTEEN UNTIL G217 AND G228, TWENTY SINCE, AND ALL THREE ARE NAMED FOR
   * THE REASON THE BLOCK ABOVE GIVES — a count control raised without its sites
   * named is a count control that has stopped meaning anything.
   *
   *   · `_SearchBoundaryHoldsNoTextDeep` (§5a, G217/#201) — and it is the reason
   *     the slice exists. `SetReconciliationResult` had NO containment site at
   *     all, which is how two `readonly (string | null)[]` arrays of
   *     counterparty-authored BUCKET KEYS got onto it. The search boundary is
   *     now counts plus `ItemRef`, and a `string` on `SearchBoundaryEntry` is a
   *     TS2344 rather than a review finding.
   *   · `_LineFindingHoldsNoTextDeep` and `_LineFindingRefusalHoldsNoText`
   *     (§6a, G228/#247) — the register's second row type and its refusal. The
   *     finding carries the line it came from and no money and no `FieldPath`,
   *     and BOTH omissions are forced by this proof rather than chosen: a
   *     `Money.currency` and a `FieldSegment.key` are each a bare `string`.
   *
   * ⚠️ AND THE WHOLE OF `SetReconciliationResult` STILL HAS NO SITE, WHICH IS
   * NOT AN OVERSIGHT AND IS NOW WRITTEN DOWN AT THE DECLARATION. `state`,
   * `readerRequests` and `meterFacts` each carry text legitimately — the ledger
   * is made of the documents, the reader's prompt input is the one value that
   * may enter a prompt, and an idempotency key is ours. Naming them is what
   * keeps the absence from reading as forgetfulness.
   */
  /* ✅ 23 UNTIL G291, 24 SINCE, AND THE SITE IS NAMED BECAUSE RAISING A COUNT
   * CONTROL WITHOUT NAMING ITS SITE IS HOW ONE STOPS MEANING ANYTHING.
   * `_ToleranceDeclineHoldsNoTextDeep` (§5b) — the bucket the identifier join
   * found and the money declined, reported as two counts, a `bigint` variance
   * and one `ItemRef`. It is the first channel added to
   * `SetReconciliationResult` SINCE the paragraph below was written, and it
   * arrived carrying its proof rather than acquiring one after somebody noticed
   * two arrays of counterparty text on the result type — which is the whole of
   * what §5a asked of the next channel, done. */
  assert.equal(
    reconciliationSites.length,
    24,
    `AssertNoTextDeep sites in model/reconciliation.ts: ${reconciliationSites.join(' | ')}`,
  )
  /* THREE, not two. This branch migrated the two CarriedTurn/CarriedReading
   * proofs off the shallow form; main added a THIRD site in the same file —
   * the field-path seam's containment proof (SLICE 8, G214/#335) — while this
   * branch was open. Neither side computed three. The total moves 17 -> 18 for
   * the same reason, and it is re-derived here rather than incremented. */
  assert.equal(
    identitySites.length,
    3,
    `AssertNoTextDeep sites in model/identity.ts: ${identitySites.join(' | ')}`,
  )
  /* 🛑 A THIRD MODULE, 24 Aug 2026 (#176) — AND IT WAS FOUND BY MUTATING THE
   * CONTROL RATHER THAN BY READING IT, WHICH IS WORTH RECORDING BECAUSE THE
   * BLOCK ABOVE PREDICTED IT IN WRITING. `model/identity.ts` was added here
   * with the sentence "a control that counted only that file would have stayed
   * green through a change to its own subject" — and that is exactly what
   * happened again: `model/ingestion.ts` landed with three sites, DELETING ONE
   * OF THEM OUTRIGHT LEFT THE WHOLE SUITE GREEN, and nothing in the gate
   * noticed. A count control is a fact about the files it reads.
   *
   * The three sites, named, because raising a count control without naming its
   * sites is how one stops meaning anything:
   *
   *   · `_ArrivalFactsHoldsNoTextDeep` — the cascade's INPUT, which is the
   *     direction new to this tree. It is what makes "the cascade never reads
   *     the artefact" a compile error rather than a promise: no `filename`, no
   *     `bytes`, no parser message, and no seventh field that is one.
   *   · `_ArrivalRefusalHoldsNoText` — the return path, the same job
   *     `_MoneyRefusalHoldsNoText` does for money.
   *   · `_IntakeChannelDefectHoldsNoText` — the lane's own defect union, which
   *     carries ids and no location string, no mailbox address and no bucket
   *     prefix.
   *
   * ⚠️ AND `ArrivalContext` HAS NO SITE ON PURPOSE, in the shape the
   * `HeldRead` note above uses. It carries `Timestamp`, which is a bare
   * `string` alias, so the proof would be a compile error. The honest claim is
   * the one its declaration makes: it carries nothing a COUNTERPARTY wrote — a
   * clock reading, a channel row an operator configured, and grant ids the
   * caller resolved. */
  /* ⚠️ 3 UNTIL 2 Oct 2026 — G2831–G2840 ADDED `_MappingRefusalHoldsNoText`
   * (`model/ingestion.ts` §2a): the refusal a pair's mapping answers with when
   * a held artefact cannot be projected. It carries a `kind` and nothing else,
   * so no counterparty field name can ride it into a log. `ArrivalFilename`
   * HAS NO SITE ON PURPOSE — it is a branded `string`, verbatim by ruling, and
   * it stays OFF `ArrivalFacts`, whose site above is unchanged. */
  assert.equal(
    ingestionSites.length,
    4,
    `AssertNoTextDeep sites in model/ingestion.ts: ${ingestionSites.join(' | ')}`,
  )
  /* 29, not 26: two branches each added sites and each was right about its own
   tree — #360 took reconciliation.ts to 23 while #361 added ingestion.ts's 3.
   Re-derived from the merged tree, which is the fourth time this week a count
   has had a third value neither side computed.
   ⚠️ 29 UNTIL G291, 30 SINCE — `_ToleranceDeclineHoldsNoTextDeep`, named at the
   per-module assertion above. Re-derived rather than incremented, for the
   reason the paragraph one block up gives about itself. */
  // ⚠️ 30 UNTIL 2 Oct 2026 — `_MappingRefusalHoldsNoText`, named above.
  assert.equal(reconciliationSites.length + identitySites.length + ingestionSites.length, 31)
})
