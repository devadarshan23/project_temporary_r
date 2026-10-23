/**
 * `CarriedTurn` — THE CONTEXT-MINIMIZATION PROOF, PUT UNDER TEST.
 *
 * THE REJECTION HALF OF THIS FILE LANDED AS ITS OWN COMMIT, BEFORE THE
 * MIGRATION, AND THE ORDER IS THE CONTROL. `Assert<never>` compiles, so a
 * vacuous proof reads exactly like a real one. A commit that points
 * `AssertNoTextDeep` at `CarriedTurn`, observes green and stops has demonstrated
 * that SOMETHING compiled. What makes the green in §3 mean anything is §1-§2,
 * which were green — as refusals — one commit earlier, with
 * `model/identity.ts` still on the shallow form. Read the two commits, not the
 * file.
 *
 * WHAT G47 CLAIMS AND WHAT THE SHALLOW FORM PROVES ARE NOT THE SAME SENTENCE.
 * `AssertNoPlainText` (`model/identity.ts`) is a top-level mapped type,
 * `{ [K in keyof T]: string extends T[K] ? never : T[K] }`. It bans the TYPE
 * `string` at a property position, one level deep, and admits by default
 * everything nobody enumerated. §2 below is ten shapes it admits. Every one of
 * them carries text. **A set of strings is text.**
 *
 * ⚠️ THE TEN WERE RE-DERIVED AGAINST THIS TREE, NOT COPIED FROM G146's ROW.
 * G146 records that three of its own ten were found by re-deriving rather than
 * by trusting the ruling, so trusting the ruling here would have been the same
 * mistake one layer out. The derivation is a probe per case compiled with
 * `model/tsconfig.json`'s exact `compilerOptions` against `tsc` 5.9.3 from this
 * tree's own `node_modules`; the matrix it produced is the foot block at the
 * bottom of this file.
 *
 * ⚠️ AND THE FIRST RUN OF THAT PROBE WAS A FALSE RED — RECORDED BECAUSE IT IS
 * THE DEFECT THIS FILE EXISTS TO CATCH, ARRIVING IN THE DERIVATION ITSELF. All
 * twenty-six cases "failed" identically with `TS5023: Unknown compiler option`,
 * because the flags were held in a shell variable and `zsh` does not word-split
 * an unquoted expansion — the whole option list arrived as one argument. A red
 * that is uniform across every case is a red about the harness. Compare the
 * SHAPE of the failures before believing any of them.
 *
 * ⚠️ `AskTurn` IS DELIBERATELY NOT ASSERTED HERE OR ANYWHERE, and it is said
 * rather than left to be noticed. `AskTurn` is the TRANSCRIPT: it holds the
 * question and the answer in full because a HUMAN reads it. `CarriedTurn` is
 * what the MODEL sees of a prior turn. Asserting the transcript would be
 * asserting the wrong thing about the wrong type, and the distinction between
 * those two objects is the entire design (`model/domain.ts`, `CarriedTurn`).
 *
 * HOW THE COMPILE-TIME HALF IS ASSERTED. Every refusal below is a
 * `@ts-expect-error` that MUST error; weaken the proof and the directive goes
 * unused, which is itself `TS2578`, and `npm test` runs `typecheck:tests` before
 * it executes a single assertion. Same device as
 * `tests/model/no-text-deep.test.ts`, which is where the form itself is tested;
 * this file tests the form AT THESE TWO TYPES.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { AssertNoTextDeep } from '../../model/reconciliation.ts'
import type { AssertNoPlainText } from '../../model/identity.ts'
import type { CarriedReading, CarriedTurn } from '../../model/domain.ts'

/**
 * A class with ONE PRIVATE FIELD AND NOTHING ELSE. `keyof PrivateText` is
 * `never`, so a mapped type over it is `{}` and `{}` accepts anything — the
 * escape callability alone does not close.
 */
declare class PrivateText {
  private s: string
}

/* ==================================================================== *
 * 1. THE CONTROL — the one thing the shallow form DOES catch
 *
 * If this directive ever goes unused, the proof has stopped working entirely
 * and every other line in this file is noise.
 * ==================================================================== */

// @ts-expect-error — `question: string` on the carried turn. This is the exact
// edit `model/identity.ts` names in its own comment as the tempting one: someone
// will want the question back for a nicer follow-up.
export type _MutControlQuestion = AssertNoTextDeep<CarriedTurn & { readonly question: string }>

// @ts-expect-error — `label: string` on the carried reading. The other tempting
// edit, named in the same comment: the label back for a prettier citation.
export type _MutControlReadingLabel = AssertNoTextDeep<CarriedReading & {
  readonly label: string
}>

/* ==================================================================== *
 * 2. THE TEN ESCAPES, AS MUTATIONS OF THE REAL TYPE
 *
 * Not `{ a: X }` in the abstract — `CarriedTurn & { … }`, so each case is the
 * field an engineer would actually add, on the type they would actually add it
 * to. Each is REFUSED by the inverted allow-list. §4 shows each one ADMITTED by
 * the shallow form the two assertions use today.
 *
 * Grouped by the mechanism that lets them through, because the mechanism is
 * what the fix has to key on.
 * ==================================================================== */

/* -- 2a. METHOD-BEARING CONTAINERS. Every member is callable, so the shallow
 * form never looked at what they hold. This is the class that matters: it is
 * what `ReadonlySet`, `ReadonlyMap` and the typed arrays all are. --------- */

// @ts-expect-error — 1/10. THE DEFINING CASE. A set of strings is text.
export type _Mut01ReadonlySetOfString = AssertNoTextDeep<CarriedTurn & {
  readonly tags: ReadonlySet<string>
}>

// @ts-expect-error — 2/10. Reading index to label. The values are text.
export type _Mut02ReadonlyMapToString = AssertNoTextDeep<CarriedTurn & {
  readonly labels: ReadonlyMap<number, string>
}>

// @ts-expect-error — 3/10. One method, and it hands back the text.
export type _Mut03MethodReturningString = AssertNoTextDeep<CarriedTurn & {
  readonly summary: { describe(): string }
}>

// @ts-expect-error — 4/10. A lazy formatter. A value you can invoke can return
// anything, and a type system cannot see through the call.
export type _Mut04FunctionReturningString = AssertNoTextDeep<CarriedTurn & {
  readonly render: () => string
}>

// @ts-expect-error — 5/10. Bytes are text with one decode step between.
export type _Mut05Uint8Array = AssertNoTextDeep<CarriedTurn & {
  readonly digest: Uint8Array
}>

// @ts-expect-error — 6/10. The same, one container out.
export type _Mut06ArrayBuffer = AssertNoTextDeep<CarriedTurn & {
  readonly raw: ArrayBuffer
}>

// @ts-expect-error — 7/10. `Date`, AND IT IS THE ONE TO READ. `CarriedTurn`
// deliberately carries no `askedAt` because `Timestamp = string` is a naked
// alias and the shallow proof rejected it. A `Date` is the obvious repair, and
// the shallow proof ADMITS it — not because a `Date` is text, but because
// nothing about it was ever checked. The inverted form refuses it as not
// provably value-free, which is fail-closed and is the standing posture.
export type _Mut07Date = AssertNoTextDeep<CarriedTurn & { readonly askedAt: Date }>

/* -- 2b. OPAQUE AND CALLABLE LEAVES. No readable member at all, or a call
 * signature and nothing else. -------------------------------------------- */

// @ts-expect-error — 8/10. Bare `object` admits every string carrier there is.
export type _Mut08BareObject = AssertNoTextDeep<CarriedTurn & { readonly meta: object }>

// @ts-expect-error — 9/10. A constructor signature, same hole by the same route.
export type _Mut09ConstructorSignature = AssertNoTextDeep<CarriedTurn & {
  readonly Renderer: { new (): { readonly v: string } }
}>

// @ts-expect-error — 10/10. A class whose only field is private. Not callable,
// and with nothing to check. `[keyof T] extends [never] ? never` is the arm.
export type _Mut10PrivateOnlyClass = AssertNoTextDeep<CarriedTurn & {
  readonly opaque: PrivateText
}>

/* ==================================================================== *
 * 3. THE ACCEPTANCE HALF — and it is only worth reading because §1-§2 exist
 *
 * The two declarations below carry NO `@ts-expect-error`, so they are an
 * assertion in the other direction: an inversion that over-rejects fails here
 * just as loudly as one that under-rejects fails above. This is the same shape
 * as `tests/model/no-text-deep.test.ts` §3.
 *
 * ⚠️ THESE MIRROR `model/identity.ts` RATHER THAN REPLACING IT. The live proofs
 * are `_CarriedTurnHoldsNoText` and `_CarriedReadingHoldsNoText` in that module,
 * and §5's runtime guard is what pins them there. These two exist so that this
 * file states the acceptance half in the same frame as the rejection half — read
 * end to end, it is one matrix and not two half-arguments in two files.
 *
 * `CarriedTurn` is `turnId: AskTurnId`, `proposalIds: OperatorProposalId[]`,
 * `readings: CarriedReading[]`; `CarriedReading` is `readingId:
 * EndpointReadingId`, `numericValue: number | null`. Branded ids, an array of
 * plain objects, and a nullable number — every one of them on the allow-list by
 * being provably value-free, not by being unenumerated.
 * ==================================================================== */

export type _RealCarriedTurnIsAdmitted = AssertNoTextDeep<CarriedTurn>
export type _RealCarriedReadingIsAdmitted = AssertNoTextDeep<CarriedReading>

/* ==================================================================== *
 * 4. THE SHALLOW FORM'S WEAKNESS, EXECUTABLE
 *
 * ⚠️ READ THE DIRECTION OF THESE BEFORE EDITING THEM. There is NO
 * `@ts-expect-error` on any line below, and that is the assertion: every one of
 * the ten compiles GREEN against `AssertNoPlainText` — the form
 * `model/identity.ts` asserted with until #240 migrated it away. The weakness is
 * pinned as a type rather than as a paragraph, in the idiom
 * `tests/model/no-text-deep.test.ts` already uses for its refused alternative.
 *
 * 🛑 IF THESE EVER GO RED, `AssertNoPlainText` HAS BEEN STRENGTHENED AND THAT IS
 * A WELCOME RED. Delete this section rather than weakening it back; the control
 * it exists to state has been superseded by the mechanism.
 *
 * The bare-`string` control is NOT repeated here: §1 already shows the one thing
 * the shallow form catches, and repeating it would suggest the two halves differ
 * on it. They do not.
 * ==================================================================== */

export type _ShallowAdmits01 = AssertNoPlainText<CarriedTurn & {
  readonly tags: ReadonlySet<string>
}>
export type _ShallowAdmits02 = AssertNoPlainText<CarriedTurn & {
  readonly labels: ReadonlyMap<number, string>
}>
export type _ShallowAdmits03 = AssertNoPlainText<CarriedTurn & {
  readonly summary: { describe(): string }
}>
export type _ShallowAdmits04 = AssertNoPlainText<CarriedTurn & {
  readonly render: () => string
}>
export type _ShallowAdmits05 = AssertNoPlainText<CarriedTurn & { readonly digest: Uint8Array }>
export type _ShallowAdmits06 = AssertNoPlainText<CarriedTurn & { readonly raw: ArrayBuffer }>
export type _ShallowAdmits07 = AssertNoPlainText<CarriedTurn & { readonly askedAt: Date }>
export type _ShallowAdmits08 = AssertNoPlainText<CarriedTurn & { readonly meta: object }>
export type _ShallowAdmits09 = AssertNoPlainText<CarriedTurn & {
  readonly Renderer: { new (): { readonly v: string } }
}>
export type _ShallowAdmits10 = AssertNoPlainText<CarriedTurn & { readonly opaque: PrivateText }>

/* ==================================================================== *
 * 5. THE INERTNESS GUARD
 *
 * Everything above is a type, and a type is erased before node sees it. So
 * §1-§4 are asserted by `npm run typecheck:tests` and nothing here would notice
 * if this file stopped being typechecked at all. This runtime test is the second
 * lock, and it is the same shape as the guard at the bottom of
 * `tests/model/no-text-deep.test.ts`.
 * ==================================================================== */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const IDENTITY_TEXT = readFileSync(join(REPO_ROOT, 'model', 'identity.ts'), 'utf8')

test('both carried-turn proofs assert with the INVERTED form, by name', () => {
  // Naming the form is the point. `Assert\w+<` would pass against
  // `AssertNoPlainText` and this whole file would go on compiling while the
  // migration was reverted underneath it — §1-§2 are about the FORM, not about
  // the existence of an assertion.
  for (const site of ['_CarriedTurnHoldsNoText', '_CarriedReadingHoldsNoText']) {
    assert.ok(
      new RegExp(`^export type ${site} = AssertNoTextDeep<`, 'm').test(IDENTITY_TEXT),
      `${site} is not asserted with AssertNoTextDeep in model/identity.ts — ` +
        `either it was deleted to make a red go away, or #240's migration was ` +
        `reverted to the shallow form that admits the ten escapes in §2`,
    )
  }
})

test('no containment proof in `model/identity.ts` uses the shallow form any more', () => {
  const shallowSites = IDENTITY_TEXT.split('\n').filter((l) =>
    /^export type _\w+ = AssertNoPlainText</.test(l),
  )
  assert.deepEqual(
    shallowSites,
    [],
    `AssertNoPlainText is being used as a containment proof again: ${shallowSites.join(' | ')}. ` +
      `It admits ReadonlySet<string>, ReadonlyMap<number,string>, {describe(): string}, ` +
      `() => string, Uint8Array, ArrayBuffer, Date, object, a constructor signature and a ` +
      `private-only class — all ten re-derived against this tree and all ten in §2 above`,
  )
})

test('`AskTurn` is still deliberately unasserted', () => {
  // Said rather than left to be noticed, because its absence looks like an
  // oversight and is a decision. `AskTurn` is the TRANSCRIPT: it holds the
  // question and the answer in full because a HUMAN reads it. `CarriedTurn` is
  // what the MODEL sees. Asserting the transcript would be asserting the wrong
  // thing about the wrong type, and the distinction is the entire design.
  assert.ok(
    !/Assert\w*<AskTurn>/.test(IDENTITY_TEXT),
    'AskTurn has acquired a containment assertion. Before deleting this test, ' +
      'read `CarriedTurn`s docblock in model/domain.ts: the two objects are ' +
      'different on purpose',
  )
})

/* ==================================================================== *
 * 6. THE FOOT BLOCK — the derivation, recorded rather than described
 *
 * Twenty-two probes, one per case per form, each compiled as its own `tsc`
 * invocation so that the verdict is an exit code and not a reading of a
 * diagnostic list. `model/tsconfig.json`'s exact `compilerOptions`, `tsc` 5.9.3
 * from this tree's `node_modules`, 22 Aug 2026, against the real
 * `CarriedTurn` / `CarriedReading` from `model/domain.ts`.
 *
 *   MUTATION                                    SHALLOW      INVERTED
 *   ------------------------------------------  -----------  ----------------
 *   control  question: string                   REJECTED     REJECTED TS2344
 *   control  CarriedReading.label: string       REJECTED     REJECTED TS2344
 *    1/10    tags: ReadonlySet<string>          ADMITTED     REJECTED TS2344
 *    2/10    labels: ReadonlyMap<number,string>  ADMITTED     REJECTED TS2344
 *    3/10    summary: { describe(): string }    ADMITTED     REJECTED TS2344
 *    4/10    render: () => string               ADMITTED     REJECTED TS2344
 *    5/10    digest: Uint8Array                 ADMITTED     REJECTED TS2344
 *    6/10    raw: ArrayBuffer                   ADMITTED     REJECTED TS2344
 *    7/10    askedAt: Date                      ADMITTED     REJECTED TS2344
 *    8/10    meta: object                       ADMITTED     REJECTED TS2344
 *    9/10    Renderer: { new (): {v: string} }  ADMITTED     REJECTED TS2344
 *   10/10    opaque: PrivateText                ADMITTED     REJECTED TS2344
 *
 * TEN ADMITTED BY THE FORM THEN IN USE; TEN REFUSED BY THE FORM THEN UNUSED.
 * That gap WAS the issue. The next commit closed it by pointing
 * `model/identity.ts`'s two proofs at the right-hand column, and this table is
 * kept as the derivation rather than rewritten as a result — a matrix that only
 * ever showed the outcome would not show why the outcome was worth having.
 *
 * ⚠️ EVERY REFUSAL IS `TS2344` AND THAT IS NOT A COINCIDENCE TO BE READ AS ONE.
 * All twelve are one failure mode — the argument does not satisfy the
 * constraint — and the constraint is where all the reasoning lives. The
 * DIAGNOSTIC differs per case and is the part worth reading: `ReadonlySet` fails
 * on `tags.forEach`, `Date` on `askedAt.toString`, `Uint8Array` on
 * `digest.buffer`, and the opaque class on the property itself. A uniform code
 * with uniform detail would have been the harness failing, not the proof
 * working — see the `TS5023` note in this file's header.
 * ==================================================================== */
