/* ==================================================================== *
 * SET RECONCILIATION — the engine, as types and total functions
 *
 * WHAT THIS MODULE IS. The executable half of the `set_reconciliation`
 * archetype (`model/domain.ts:1993`). It admits two transaction populations,
 * folds `PairingSpec.strategies` over them in declared order, and returns the
 * residue. The residue is the product.
 *
 * WHAT THIS MODULE MUST NEVER DO, and each of these is structural rather than a
 * convention. ⚠️ EVERY CONTROL BELOW STRIPS COMMENTS FIRST. The first version of
 * this header ran the greps over the whole file and SIX OF NINE reported
 * non-zero — every hit was this header quoting the thing it bans. A control that
 * FAILS WHILE THE PROPERTY HOLDS teaches people to ignore controls, which is
 * §5.6 read from the other side. Define `code` once:
 *
 *   code() { grep -vE '^[[:space:]]*(\*|/\*|//)' model/reconciliation.ts; }
 *
 *   code | grep -c 'console\.'                       → 0   no telemetry path here
 *   code | grep -c 'new Date\|Date\.now'              → 0   no clock, no NaN sort
 *   code | grep -c 'new RegExp'                      → 0   S1
 *   code | grep -c 'Math\.random'                    → 0   determinism
 *   code | grep -c ': any'                           → 0
 *   code | grep -c 'throw '                          → 0   failures are values
 *   code | grep -ci 'price\|rateCard\|unitPrice'     → 0   invariant 5
 *   code | grep -c '\.cost'                          → 0   invariant 5
 *   code | grep -c 'anthropic\.\|claude-\|amazon\.'   → 0   G104
 *   grep -c '^import {' model/reconciliation.ts      → 2   §10's value imports
 *
 *   ⚠️ THAT CONTROL READ `→ 0   type-only imports` UNTIL 9 Aug 2026 AND THE
 *   PROPERTY IT NAMED IS GONE, DELIBERATELY. §10 CALLS `mayAutoResolve()`
 *   (`model/policy.ts:1547`) and `extractionInSetHolds()` (`model/domain.ts:420`),
 *   and a call is a value import. The property was never the goal — the goal was
 *   that this module makes no *decision* it does not own, and calling the two
 *   functions that own the autonomy gate and the predicate reading is that
 *   property, not a breach of it. What replaced a number with a number: the
 *   control now says WHICH two, so a third value import is a diff somebody has
 *   to justify. Both specifiers carry `.ts`; the `import type` twins do not,
 *   because `verbatimModuleSyntax` erases them before the loader sees them —
 *   `tests/model/runtime-importability.test.ts` is what catches the mistake.
 *   ⚠️ IT ALSO ENDS THE ONE-DIRECTION CLAIM `model/domain.ts:388` MAKES ABOUT
 *   THIS PAIR — that file's `import type { IdentifierNormalisation } from
 *   './reconciliation'` is erased, so the runtime edge is one-way and there is
 *   still no cycle. Verified: `grep -cE '^import \{' model/domain.ts` → 0 and
 *   `grep -cE '^import \{' model/policy.ts` → 0.
 *
 *   python3 -c "print(open('model/reconciliation.ts','rb').read().count(b'\x00'))"
 *                                                    → 0   the file stays greppable
 *   ⚠️ NOT `grep -c $'\x00'`. Bash expands that to the EMPTY STRING and grep then
 *   matches every line, so the control reports 2755 and looks catastrophic while
 *   the property holds. Second control in this header to have been wrong in its
 *   own right; both were found by RUNNING them, not by reading them.
 *
 * AND THE ONE THAT COSTS SOMETHING TO KEEP TRUE:
 *
 *   code | awk '/_MoneySectionEndsHere/,0' | grep -c 'amountMinor'  → 0
 *
 *   ⚠️ THE SENTINEL IS A DECLARATION, NOT A SECTION HEADING, and that is the
 *   third control in this header to have been wrong. Anchoring the range on the
 *   §4 banner made the control SELF-REFERENTIAL: `awk` matched this very line,
 *   started the range at the header, swallowed §3 and reported 20. Stripping
 *   comments FIRST removes the control's own text and leaves only the
 *   declaration, so the range can no longer begin inside the thing describing
 *   it. Found by running it — again.
 *
 * ⚠️ It was TWENTY code sites, spread across five passes and the post-conditions,
 * until every read was routed through `minorUnitsOf()` / `isPositiveMoney()` /
 * `isNegativeMoney()` / `guardMoney()`. That is what G111 asks for — one thing
 * owns the representation — and it makes G65's `bigint` retype a single loud
 * compile error in §3 instead of twenty silent `number`/`bigint` mixings.
 * ⚠️ THE CONTROL IS HONOUR-SYSTEM: no linter is configured and
 * `docs/build-conventions.md` §4 still lists the validation library as
 * undecided. Say "honour-system", never "enforced".
 *
 * ⚠️ A throw is banned and that is not style. A throw inside a fold over a
 * reconciliation batch either kills the run and loses every finding, or is
 * swallowed by a caller. **Every failure in this module is a value** — a result
 * union in the shape of `ModelResolution` (`model/catalog.ts:172`) and
 * `Decision` (`model/access.ts`).
 *
 * THE ENGINE HAS NO AUTHORITY, NO CLOCK, NO IDENTITY AND NO NETWORK.
 * It mints no id, reads no clock, calls no model and writes no record. It is a
 * pure, total fold. That is not asceticism: invariant 10 says an act with no
 * authorisation is unrecordable and `authorize()` (`model/access.ts:1610`) is the
 * only thing that mints an `AuthorizationGrant` — so a function that could make
 * a model call from inside a fold would be a function that could make an
 * unrecordable one. The seam is a TYPE the caller fills (§7), never a call this
 * module makes.
 *
 * BOUND TO THE MODEL, NOT A PARALLEL VOCABULARY (§5.3). The passes ARE
 * `PairingSpec.strategies` (`model/domain.ts:1959`) in declared order. The
 * strategy KINDS are the closed union at `model/domain.ts:1952` — a pack orders
 * and tunes them and can never add one, which is *packs parameterise, never
 * extend* made true of the engine rather than asserted about it. There is no
 * `MatchRuleConfig`, no `MatchResult.status` and no `GenericRecord` here: HOW a
 * pair formed is `PairingEvidence` (§5), WHAT it means is `MatchGroup.outcome`
 * (`model/domain.ts:2639`) and, for the residue, a `DispositionFamily` drawn
 * from `DISPOSITION_FAMILIES.set_reconciliation` (`model/domain.ts:1866`).
 *
 * ⚠️ TWO FIELDS THIS ENGINE NEEDS DO NOT EXIST ON `PopulationSpec` YET, and one
 * per-strategy field does not exist on `PairingStrategy`. They are in the
 * diff-plan at `docs/build/reconciliation-engine.md` §7. Until the orchestrator
 * applies them, `PopulationBinding` (§4) and `StrategyBinding` (§5) carry them
 * beside the model type rather than inside it. **That is a stated stopgap with a
 * stated end state, not a second vocabulary** — each binding names exactly the
 * model declaration it will collapse into.
 *
 * DECISIONS THIS MODULE IMPLEMENTS AND MAY NOT RELITIGATE
 *   G103  no third store — nothing here is cached in module state
 *   G104  no model identifier as a literal in engine code — grep is 0
 *   G105  N:M is bounded subset sum FIRST, FIFO waterfall as a recorded fallback
 *   G106  a key with no `FieldSpec` is UNREADABLE — admission fails closed
 *   G107  this is data-plane code
 *   G153  INCOMPLETE is an outcome distinct from INCONSISTENT — §9a
 *
 * 🛑 WHAT G153 CHANGED HERE, 16 Aug 2026, AND WHAT IT DELIBERATELY DID NOT.
 * CHANGED: `SetReconciliationResult` gains `completeness`, a second channel
 * carrying WHAT the engine could not establish about the population;
 * `POSTCONDITION_PROPERTY` declares which post-condition arms were ever about
 * soundness at all; `terminalRunStatus()` is the total join a caller applies;
 * and `RunStatus` (`model/domain.ts`) gains `incomplete`.
 * REJECTED: a boolean beside `completed` — it reproduces the defect one remove
 * out, because a consumer switching on `status` still sees a clean close.
 * REJECTED: folding the finding into `postconditions` — that channel already
 * carries two properties on one list, which is the confusion G153 names.
 * REJECTED: moving C18's reported defects off `postconditions` — an applied
 * decision with fixtures, and relocating it in a commit whose subject is O-16
 * would amend C18 sideways.
 * NOT DONE, AND IT IS A REAL GAP RATHER THAN AN OVERSIGHT: nothing here knows
 * what ARRIVED. There is no arrivals denominator anywhere in this repository,
 * so an incomplete run is *sound over less than what it was HANDED*, never
 * *less than what was sent*. §9a states the boundary at the declarations.
 * ==================================================================== */

import type {
  AgentAction,
  ControlTotal,
  DataClass,
  Disposition,
  DispositionFamily,
  DomainKey,
  ExtractedLine,
  ExtractedScalar,
  ExtractedValue,
  Expr,
  Money,
  Normaliser,
  PairingCardinality,
  PairingSpec,
  PairingStrategy,
  PopulationSpec,
  RulePredicate,
  RunStatus,
  Severity,
  SourceDocument,
  Tolerance,
} from './domain'
/* §10. The ONLY reading of an `extraction_in_set` arm, injected with
 * `applyExtraction` (§2) as its `ExtractionFn`. Re-implementing the arm here
 * would be §5.3 across a module boundary. */
import { extractionInSetHolds } from './domain.ts'
import type { Meter } from './billing'
import type { LearningEntryId } from './learning'
import type { AutonomyConfig, PolicyReasonCode } from './policy'
/* §10, G129. The autonomy gate. This module does not re-derive its arms and
 * does not carry a copy of its reason vocabulary. */
import { mayAutoResolve } from './policy.ts'
/* G214. `FieldPath` is a token list and nothing here may construct or split
 * one; `fieldPathKey()` is the only way to turn one into a lookup key, and the
 * only thing this module asks of the representation. */
import { fieldPathKey } from './field-path.ts'
/* G111/G286, 19 Sep 2026. §3 WAS HERE AND IS NOW `model/money.ts`. This module
 * asks the codec for arithmetic, guards and the one read out of the
 * representation, and names `amountMinor` nowhere — which is a STRONGER form of
 * the property §3's header was already defending with an `awk` range. */
import type { MoneyRefusal, MoneyResult, MoneyUnit } from './money'
/* ⚠️ ONE LINE, AGAINST THE HOUSE STYLE, AND FOR A CONTROL RATHER THAN A
 * PREFERENCE. `tests/model/reconciliation-controls.test.ts` licenses a value
 * import into this module by EXACT SPECIFIER STRING — an allow-list, not a
 * count, so that a THIRD import or a change to an existing one still fires. A
 * multi-line import would have to be licensed as the bare `import {`, which
 * licenses every multi-line value import there could ever be and turns an
 * exact allow-list into a shape one. The import is written where the control
 * can name it. */
import { addMoney, compareMoney, guardMoney, guardUnit, isNegativeMoney, isPositiveMoney, isZeroMoney, minMoney, minorUnitsFromCount, minorUnitsOf, sameUnit, subtractMoney, zeroLike } from './money.ts'
import type {
  FieldPath,
  FieldPathKey,
  ModelCatalogEntryId,
  RunId,
  SlotName,
  SourceDocumentId,
  TenantId,
} from './kernel'

/* ==================================================================== *
 * §0  COMPILE-TIME CONTROLS
 *
 * ⚠️ §5.10 APPLIES TO EVERY ONE OF THESE. A total record or a conditional
 * assertion holds the SHAPE; only a fixture that CONSTRUCTS a value witnesses
 * the CONTENT. Nothing in `model/` constructs a `PopulationSpec`, a
 * `PairingSpec` or a `MatchGroup` today, so `tsc` staying green after a change
 * here is not evidence of anything. The fixtures this module owes are listed in
 * `docs/build/reconciliation-engine.md` §8.
 * ==================================================================== */

type Assert<T extends true> = T

/**
 * The six dispositions this archetype may produce, restated locally.
 *
 * ⚠️ THE STATED REASON WAS *"`DISPOSITION_FAMILIES` is a VALUE and this module
 * takes no value imports"* AND THAT REASON DIED ON 9 Aug 2026 — §10 imports two
 * values. The restatement is kept anyway and the honest reason is narrower: it
 * is a TYPE, and importing a value to derive a type would put a runtime edge in
 * the graph for something erased at compile time. The assertion below is what
 * makes the restatement safe either way, and it is the thing to trust.
 *
 * The assertion below is what stops the restatement drifting: if a member is
 * renamed in `model/domain.ts:1866`, this line is a compile error rather than a
 * silently divergent second list. That is the §5.3 mitigation applied to the
 * one place a value import was not available.
 */
export type SetDisposition =
  | 'timing_difference'
  | 'in_transit'
  | 'error_left'
  | 'error_right'
  | 'unidentified'
  | 'write_off'

export type _SetDispositionsAreDeclaredFamilies = Assert<
  SetDisposition extends DispositionFamily ? true : false
>

/**
 * ⚠️ THE ENGINE MAY ONLY EVER ASSIGN THREE OF THE SIX.
 *
 * `timing_difference`, `in_transit` and `write_off` are JUDGEMENTS — about a
 * cut-off, about cash in flight, about a sum the firm has decided to stop
 * chasing. None of the three is derivable from the fact that two populations
 * failed to pair, and an engine that guessed one would be manufacturing a
 * finance decision out of an absence. They are for `residueRules`
 * (`model/domain.ts:1997`) and for a human.
 */
export type EngineAssignableDisposition =
  | 'unidentified'
  | 'error_left'
  | 'error_right'

export type _EngineDispositionsAreASubset = Assert<
  EngineAssignableDisposition extends SetDisposition ? true : false
>

/**
 * The four meters this engine's output can produce facts for.
 *
 * ⚠️ NO PRICE, EVER (invariant 5). `MeterPrice`, `PriceTier`, `RateCard` and
 * `RatedTotal` are not imported, and `ModelCatalogEntry.cost` is not read. A
 * meter is a measurement; rating is a layer that does not exist in v1.
 */
export type EngineMeter =
  | 'input_tokens'
  | 'output_tokens'
  | 'reconciliations_run'
  | 'exceptions_raised'

export type _EngineMetersAreDeclaredMeters = Assert<
  EngineMeter extends Meter ? true : false
>

/**
 * DEEP no-plain-text assertion, applied to everything that leaves the
 * quarantined side of §7.
 *
 * ⚠️ THIS IS STRICTLY STRONGER THAN `AssertNoPlainText` (`model/identity.ts`),
 * which is SHALLOW: it maps `{ [K in keyof T]: string extends T[K] ? never :
 * T[K] }`, so `readonly string[]`, a nested `{ v: string }` and a
 * `Record<string, string>` all pass G47's applied proof. This form recurses
 * into arrays, objects and index signatures.
 *
 * It lives here rather than in `model/identity.ts` because re-pointing
 * `_CarriedTurnHoldsNoText` at it would amend G47, an APPLIED decision, and that
 * is taken as its own change with its own red run — diff-plan DP-8.
 *
 * ─────────────────────────────────────────────────────────────────────
 * 🛑 INVERTED TO AN ALLOW-LIST, 9 Aug 2026. THE PREVIOUS FORM WAS A DENY-LIST
 * AND THE RECORD WAS CLAIMING MORE THAN IT DELIVERED.
 *
 * It read, and this is kept rather than deleted because the sentence a reader
 * would have trusted is the sentence that was wrong:
 *
 *     string extends T ? never : T extends string ? T
 *       : T extends readonly (infer U)[] ? readonly NoTextField<U>[]
 *       : T extends object ? { [K in keyof T]: NoTextField<T[K]> } : T
 *
 * That bans the TYPE `string` at a property position. It does not ban a
 * string-BEARING value, and the trailing `: T` admitted by default everything it
 * had not thought of — readable-by-default with a high bar, which is scope
 * failing OPEN. Thirteen sites lean on this, including
 * `_ReaderVerdictHoldsNoTextDeep`, which the handoff cites as compile-time
 * containment on the reader path.
 *
 * ⚠️ THE ESCAPE LIST, EVERY ONE COMPILED GREEN AGAINST THE OLD FORM WHILE A BARE
 * `string` CORRECTLY FAILED. Each is a live test in
 * `tests/model/no-text-deep.test.ts`, so none of them can quietly reopen:
 *
 *     () => string                a leaf that HANDS BACK the text
 *     { new (): { v: string } }   the same hole, constructor spelling
 *     { describe(): string }      one method, and it returns the text
 *     ReadonlySet<string>         a set OF strings
 *     ReadonlyMap<number,string>  values are text
 *     Uint8Array, ArrayBuffer     text with one decode step between
 *     Date                        not text-bearing; not provably anything
 *     class { private s: string } a carrier with no readable member
 *     object                      admits every carrier there is
 *
 * WHY THEY GOT THROUGH, AND IT IS ONE MECHANISM WITH TWO FACES. A function type
 * is an `object` whose `keyof` is nothing, so the object arm mapped it to `{}` —
 * and `{}` accepts anything. A method-bearing interface is that same fact once
 * per member. The return type was never looked at, not once.
 *
 * ─── THE FIX: CALLABILITY IS THE KEY, NOT SHAPE ───
 *
 * A leaf is admissible only if it is PROVABLY value-free: a number, a boolean,
 * `null`, `undefined`, a branded id, a literal-string union, and recursively
 * arrays and plain objects of those. Everything else is `never`. `T extends
 * Function ? never` is the arm that does the work, because callability is the
 * property the escapes actually share — a value you can invoke can return
 * anything, and a type system cannot see through the call.
 *
 * 🛑 THE REFUSED ALTERNATIVE, PRESERVED SO NOBODY REINVENTS IT. An earlier red
 * team proposed excluding containers BY SHAPE —
 * `{ readonly size: number } | { readonly byteLength: number }`. Refused: that is
 * itself the §5.1 defect, a rule keyed on a convenient landmark instead of the
 * property it protects, and it falsely rejects a nested `{ size, offset }` —
 * which is the shape of this design's own sample selection.
 *
 * ⚠️ CALLABILITY ALONE DOES NOT CLOSE IT, AND THE SECOND ARM IS NOT THE REFUSED
 * SHAPE RULE. A class whose only field is private is not callable and has no
 * readable member at all, so the mapped type is `{}` again. `[keyof T] extends
 * [never] ? never` rejects it — not because of what its members are NAMED, but
 * because it HAS none to check. An opaque leaf is not provably value-free, and
 * fail-closed is the standing posture (G106, `DENY_ALL`).
 *
 * THE ARM ORDER IS LOAD-BEARING, TWICE. `string extends T` first, or `any` and
 * `unknown` slip past. `T extends string` before the callability and object arms,
 * or a branded `Id<'X'>` recurses into `String`'s own method signatures — which
 * are callable — and every branded id in the tree fails.
 * ─────────────────────────────────────────────────────────────────────
 */
type NoTextField<T> = string extends T
  ? never
  : T extends string
    ? T
    : T extends Function
      ? never
      : T extends readonly (infer U)[]
        ? readonly NoTextField<U>[]
        : T extends object
          ? [keyof T] extends [never]
            ? never
            : { [K in keyof T]: NoTextField<T[K]> }
          : T extends number | bigint | boolean | null | undefined
            ? T
            : never
type NoTextDeep<T> = { [K in keyof T]: NoTextField<T[K]> }
export type AssertNoTextDeep<T extends NoTextDeep<T>> = T

/* ==================================================================== *
 * §1  RESULT UNIONS — every failure in this module is a value
 * ==================================================================== */

/**
 * ⚠️ DECLARED HERE UNTIL 19 Sep 2026 AND NOW RE-EXPORTED FROM `model/money.ts`
 * — G286 APPLYING G111, WHOSE SHAPE §3 PREDICTED IN ITS OWN WORDS. The arms and
 * their reasoning moved verbatim; nothing was added, removed or reordered, which
 * matters because `money_refusal_kinds` in `tools/check-wire-mirror.mjs` pins
 * this union against `docs/contracts/capability.openapi.yaml` AS A SEQUENCE.
 *
 * 🛑 TWO ARMS CHANGED MEANING WITHOUT CHANGING NAME AND THE CODEC'S HEADER IS
 * WHERE THAT IS ARGUED. `not_integer_minor_units` is unreachable from a
 * constructed `Money` now that `amountMinor` is `bigint`, and survives at the
 * two edges where a non-integer can still arrive. `exceeds_exact_integer_range`
 * no longer means `Number.isSafeInteger`; it means the `int8` column G65
 * declares money is stored in, and the bound rose by a factor of 1024. Read
 * `model/money.ts` before quoting either.
 */
export type { MoneyRefusal, MoneyResult } from './money'

/**
 * ⚠️ THE CONTAINMENT PROOF STAYS HERE, WHERE `AssertNoTextDeep` IS DECLARED,
 * THOUGH THE TYPE IT PROVES MOVED TO `model/money.ts` ON 19 Sep 2026. Moving it
 * with the type would have made the codec import a type from this file while
 * this file imports values from it — a cycle written to hold a one-line
 * assertion. The proof did not need to move; it needed the type in scope, and
 * an `import type` gives it that.
 *
 * ⚠️ `MoneyRefusal` carries NO amounts and NO currency string, deliberately.
 *
 * A refusal is the value most likely to be put in a log or an error message by
 * the first engineer who debugs this, and `TelemetryPolicy
 * .maxDataClassInSpanAttributes` governs what may be a span attribute. A
 * currency code is harmless; a minor-unit amount is a transaction value. The
 * cheapest way to make the harmful case impossible is for the type not to
 * admit it.
 */
export type _MoneyRefusalHoldsNoText = AssertNoTextDeep<MoneyRefusal>

/* ==================================================================== *
 * §2  IDENTIFIER NORMALISATION — the S1 ruling, in the type
 *
 * THE DRAFT ASKED AN LLM TO WRITE A JAVASCRIPT REGEX FROM A COUNTERPARTY-
 * CONTROLLED BANK DESCRIPTION AND THEN RAN IT. That is invariant 6 inverted —
 * ingested content becoming instruction — and it is a ReDoS vector with no
 * timeout, over a string an attacker chooses.
 *
 * THE RULING, AND IT IS BOTH HALVES OF THE BRIEF'S OPTION (a) AND A STRONGER
 * FORM OF (b), WITH (c) REJECTED AS A PRIMARY CONTROL:
 *
 *   RUNTIME (§7). The quarantined reader returns an INDEX into a candidate set
 *   the privileged side supplied. Not a pattern, and not a free string either —
 *   option (b) as the brief states it still lets attacker-composed text enter
 *   the engine and flow onward into a `MatchGroup`, an `Explanation`, an
 *   `AuditEvent` and a later prompt.
 *
 *   DURABLE (this section). A reusable extraction may be PROPOSED by a model
 *   and lands only as an approved `IdentifierNormalisation` on the tenant's own
 *   `ReconciliationDefinition` — which `extends TenantScoped`
 *   (`model/domain.ts:2010`). It is NOT a regex. It is a closed, parameterised
 *   op list terminating in the existing `Normaliser` (`model/domain.ts:441`).
 *
 * WHY (c) IS REJECTED AS PRIMARY: a step budget bounds the denial of service
 * and does nothing whatever about invariant 6. Executing a program written from
 * counterparty text is the violation whether it finishes in 10ms or never. And
 * there is no linear-time regex engine in the dependency set, so RE2 would be a
 * dependency proposal under `docs/build-conventions.md` §4 — not this module's
 * to take.
 *
 * ⚠️ A CLAIM I AM DECLINING TO MAKE. It is tempting to write "nothing generated
 * is ever executed". It would be false. `applyExtraction()` below IS a small
 * interpreter, and its `literal` and `separator` are data that may have been
 * derived from counterparty text before a human approved it. The honest claim
 * is narrower and it is the one that matters: **every op is total, allocates no
 * backtracking state, and has no quantifier — so catastrophic backtracking is
 * not a risk to be bounded, it is a property that cannot arise** — and a human
 * approving `split on '-', take segment 1, casefold` is approving something they
 * can evaluate, whereas a human approving a regex for ReDoS-safety is
 * performing §5.6, a control that passes while asserting nothing.
 *
 * WHAT IT COSTS, STATED:
 *   (i)  `ExtractionOp` is strictly LESS EXPRESSIVE than a regex. The draft's
 *        own `(?<=BR\d{3}-)TXN\d+(?=-SG)` is expressible (`split_take` on '-',
 *        index 1); arbitrary lookaround is not. Some real bank formats will
 *        never normalise deterministically and will sit in residue permanently.
 *   (ii) Until a human approves one, every residue record costs one inference
 *        call — O(residue), not O(distinct formats).
 *   (iii) Nothing in this repository can report "this definition has paid for
 *        inference on the same format for six months and nobody nominated it".
 *        That is a product surface nobody has drawn.
 * ==================================================================== */

export const EXTRACTION_OP_KINDS = {
  trim: 'trim',
  stripLeadingZeros: 'strip_leading_zeros',
  stripLiteral: 'strip_literal',
  splitTake: 'split_take',
} as const
export type ExtractionOpKind =
  (typeof EXTRACTION_OP_KINDS)[keyof typeof EXTRACTION_OP_KINDS]

export type ExtractionOp =
  | { kind: 'trim' }
  /** `0000123` → `123`. An all-zero input normalises to `0`, never to ''. */
  | { kind: 'strip_leading_zeros' }
  | { kind: 'strip_literal'; literal: string; at: 'prefix' | 'suffix' | 'anywhere' }
  | { kind: 'split_take'; separator: string; index: number }

export type _ExtractionOpKindsAreExhaustive = Assert<
  ExtractionOp['kind'] extends ExtractionOpKind ? true : false
>

/**
 * How an identifier is canonicalised before ANY strategy keys on it.
 *
 * REQUIRED AND NON-NULL, with the identity spelled `{ ops: [], then: 'exact' }`.
 * There is no safe default — the same discipline `MatchRule.scope`
 * (`model/domain.ts:1785`) states for itself. A bank line reads
 * `BR001-TXN99823-SG` and a ledger line reads `TXN99823`; with no declared
 * normalisation the two never key equal and every pass falls through to the
 * residue.
 *
 * ⚠️ NOT `| null`. A nullable normalisation reads as "unspecified", and
 * unspecified takes the permissive branch at the first call site somebody writes
 * in a hurry — §5.5's shape. The identity is one line to write and it is a
 * statement.
 */
export interface IdentifierNormalisation {
  readonly ops: readonly ExtractionOp[]
  /** Terminal whole-value transform. The existing closed union. */
  readonly then: Normaliser
  /**
   * Hard input cap, in UTF-16 code units, applied BEFORE any op runs.
   *
   * ⚠️ THE NUMBER IS NOT MINE AND IS NOT DEFAULTED. `PRODUCT.md` forbids
   * inventing a figure, and a bound with no number is not a bound (§5.6). It is
   * a required field, and `validateNormalisation()` refuses a non-positive or
   * non-integer value — so the choice is stated or the run refuses. It is never
   * silently unbounded, which is the outcome a default would produce.
   */
  readonly maxInputChars: number
}

export type NormalisationDefect =
  | { kind: 'max_input_chars_not_stated' }
  | { kind: 'empty_separator'; opIndex: number }
  | { kind: 'empty_literal'; opIndex: number }
  | { kind: 'negative_index'; opIndex: number }
  | { kind: 'non_integer_index'; opIndex: number }

export type _NormalisationDefectHoldsNoText = AssertNoTextDeep<NormalisationDefect>

/**
 * Refuses the three degenerate parameterisations that would otherwise corrupt
 * silently rather than fail.
 *
 * Each is a real defect and none is hypothetical:
 *   `separator: ''`  → `String.split('')` explodes to characters and `index`
 *                      then addresses a CHARACTER, so the key is one letter.
 *   `literal: ''`    → `replaceAll('', x)` inserts between every character.
 *                      Silent corruption, not a hang.
 *   `index` negative → under `noUncheckedIndexedAccess` the read is
 *   or fractional     `T | undefined`, and an undefined key is A9(d)
 *                      reintroduced one layer down.
 */
export function validateNormalisation(
  normalisation: IdentifierNormalisation,
): readonly NormalisationDefect[] {
  const defects: NormalisationDefect[] = []
  if (
    !Number.isInteger(normalisation.maxInputChars) ||
    normalisation.maxInputChars < 1
  ) {
    defects.push({ kind: 'max_input_chars_not_stated' })
  }
  for (let i = 0; i < normalisation.ops.length; i += 1) {
    const op = normalisation.ops[i]
    if (op === undefined) continue
    if (op.kind === 'split_take') {
      if (op.separator.length === 0) defects.push({ kind: 'empty_separator', opIndex: i })
      if (!Number.isInteger(op.index)) defects.push({ kind: 'non_integer_index', opIndex: i })
      else if (op.index < 0) defects.push({ kind: 'negative_index', opIndex: i })
    }
    if (op.kind === 'strip_literal' && op.literal.length === 0) {
      defects.push({ kind: 'empty_literal', opIndex: i })
    }
  }
  return defects
}

export type ExtractionRefusal =
  | { kind: 'input_exceeds_max_chars'; opIndex: null }
  | { kind: 'segment_index_out_of_range'; opIndex: number }
  | { kind: 'empty_after_ops'; opIndex: null }
  /** `name_normalise` has a name in the model and no definition anywhere. */
  | { kind: 'normaliser_not_implemented'; opIndex: null }

export type _ExtractionRefusalHoldsNoText = AssertNoTextDeep<ExtractionRefusal>

export type ExtractionResult =
  | { ok: true; key: string }
  | { ok: false; refusal: ExtractionRefusal }

function stripLeadingZeros(value: string): string {
  let i = 0
  while (i < value.length - 1 && value.charCodeAt(i) === 48) i += 1
  return value.slice(i)
}

function applyNormaliser(value: string, normaliser: Normaliser): ExtractionResult {
  if (normaliser === 'exact') return { ok: true, key: value }
  if (normaliser === 'casefold') return { ok: true, key: value.toLowerCase() }
  if (normaliser === 'digits_only') {
    let out = ''
    for (let i = 0; i < value.length; i += 1) {
      const c = value.charCodeAt(i)
      if (c >= 48 && c <= 57) out += String.fromCharCode(c)
    }
    return { ok: true, key: out }
  }
  /* 🛑 STUB, MARKED AS ONE. `name_normalise` is a member of the closed union at
   * `model/domain.ts:441` and NOTHING IN THIS REPOSITORY DEFINES WHAT IT DOES.
   * Company-suffix stripping? Diacritic folding? Punctuation? Each is a
   * different answer and each changes which records pair. Implementing a guess
   * would be fabricating a matching rule, so this refuses instead. The
   * definition is an open ruling — see the design record §6, OR-3. */
  return { ok: false, refusal: { kind: 'normaliser_not_implemented', opIndex: null } }
}

/**
 * Runs the approved op list, then the terminal `Normaliser`. Total; never
 * throws; never constructs a `RegExp`.
 *
 * Call `validateNormalisation()` first — this function assumes the op list has
 * been validated and refuses rather than guessing where it has not.
 */
export function applyExtraction(
  input: string,
  normalisation: IdentifierNormalisation,
): ExtractionResult {
  if (input.length > normalisation.maxInputChars) {
    return { ok: false, refusal: { kind: 'input_exceeds_max_chars', opIndex: null } }
  }
  let value = input
  for (let i = 0; i < normalisation.ops.length; i += 1) {
    const op = normalisation.ops[i]
    if (op === undefined) continue
    if (op.kind === 'trim') {
      value = value.trim()
    } else if (op.kind === 'strip_leading_zeros') {
      value = stripLeadingZeros(value)
    } else if (op.kind === 'strip_literal') {
      if (op.literal.length === 0) continue
      if (op.at === 'prefix') {
        if (value.startsWith(op.literal)) value = value.slice(op.literal.length)
      } else if (op.at === 'suffix') {
        if (value.endsWith(op.literal)) value = value.slice(0, value.length - op.literal.length)
      } else {
        value = value.split(op.literal).join('')
      }
    } else {
      if (op.separator.length === 0 || !Number.isInteger(op.index) || op.index < 0) {
        return { ok: false, refusal: { kind: 'segment_index_out_of_range', opIndex: i } }
      }
      const segments = value.split(op.separator)
      const segment = segments[op.index]
      if (segment === undefined) {
        return { ok: false, refusal: { kind: 'segment_index_out_of_range', opIndex: i } }
      }
      value = segment
    }
  }
  const normalised = applyNormaliser(value, normalisation.then)
  if (!normalised.ok) return normalised
  if (normalised.key.length === 0) {
    return { ok: false, refusal: { kind: 'empty_after_ops', opIndex: null } }
  }
  return normalised
}

/* ==================================================================== *
 * §3  MONEY — MOVED TO `model/money.ts` ON 19 Sep 2026 UNDER G286/G111
 *
 * ✅ THIS SECTION HELD THE MONEY REPRESENTATION FROM 10 Aug 2026 UNTIL
 * 19 Sep 2026, AND IT PREDICTED ITS OWN MOVE IN ITS OWN WORDS. Its header read:
 * *"G111 rules that ONE money codec module owns the representation; when it
 * lands, this section collapses into a call to it."* **IT HAS LANDED.** The
 * declarations below are re-exports, so every existing import of
 * `model/reconciliation.ts` still resolves at the same name; the reasoning went
 * with the code rather than being left behind as a comment about an absent file.
 *
 * 🛑 AND ONE SENTENCE THAT STOOD HERE WAS NOT STALE BUT WRONG, WHICH IS WHY IT
 * IS QUOTED RATHER THAN DELETED. It read: *"Verified at HEAD: `Money.amountMinor`
 * is `number` (`model/domain.ts:401`) and `grep -rn bigint model/*.ts` returns
 * 0."* That verification was honest and the tree really did say `number` — but
 * `CLAUDE.md` had said under **G111**, since 8 Aug 2026, that
 * *"`Money.amountMinor` is `bigint` in the model and a decimal STRING on the
 * wire"*. **Two documents asserted opposite things about the load-bearing type
 * in a reconciliation product, and each was verified against itself.**
 * **G286 (19 Sep 2026) rules that the RECORD WAS RIGHT AND THIS FILE WAS
 * WRONG.** The direction matters: the cheap correction — amending `CLAUDE.md` to
 * say `number` — was offered and refused, on the ground that it *"ratifies a
 * ceiling nobody chose by writing down what drifted."*
 *
 * ⚠️ WHAT THAT SENTENCE GOT RIGHT AND MUST NOT BE LOST IN THE CORRECTION. The
 * paragraph above it is still exactly true and is the reason this migration is
 * about a CEILING rather than about arithmetic: *"JavaScript `number` is EXACT
 * on integers under `+` and `−` up to 2^53, so a minor-unit waterfall
 * accumulates exactly zero error… this engine is correct BEFORE G65 lands, not
 * after. G65/G112 harden the ceiling; they do not rescue the arithmetic."* That
 * was right then and is right now. Nothing in the engine's arithmetic was broken
 * and nothing in it was fixed. What moved is how far it can count.
 *
 * ⚠️ THE FOUR MECHANICAL PROPERTIES SURVIVE, AND THE FIRST ONE GOT STRONGER.
 * It read *"`amountMinor` appears ONLY in this section. Greppable."* — enforced
 * by an `awk` range anchored on `_MoneySectionEndsHere` and by the
 * `money-sentinel` control in `tests/model/reconciliation-controls.test.ts`.
 * The property is now *"`amountMinor` appears nowhere in this file at all"*,
 * which needs no range and cannot be made self-referential the way the `awk`
 * control twice was. **BOTH CONTROLS ARE KEPT ANYWAY**: the sentinel still
 * guards the passes below it, and a file-wide count is not a substitute for a
 * control that says WHERE, only a strengthening of it.
 *
 * 🛑 WHAT THE MOVE DID NOT CLOSE. `model/access.ts` still compares `amountMinor`
 * inline in three places, none checking `exponent`. §3 called that a §5.3
 * instance with a scheduled end date and said the three *"should migrate in the
 * same commit"*. They did not, and `model/money.ts`'s header states the reason
 * in full: all three sit inside boolean-returning authorisation narrowing and
 * `compareMoney` returns a refusal, so routing them through it is a behaviour
 * change to authorisation code rather than a type migration. They compile
 * unchanged under `bigint`, which is exactly why the compiler will not force it.
 * ==================================================================== */

export type { MoneyUnit, MoneyWire } from './money'
export {
  MINOR_UNITS_MAX,
  MINOR_UNITS_MIN,
  addMoney,
  compareMoney,
  formatMinorUnits,
  guardMoney,
  guardUnit,
  isNegativeMoney,
  isPositiveMoney,
  isZeroMoney,
  minMoney,
  minorUnitsFromCount,
  minorUnitsOf,
  parseMinorUnits,
  parseMoneyWire,
  sameUnit,
  subtractMoney,
  toMoneyWire,
  zeroLike,
} from './money.ts'


/* -------------------------------------------------------------------- *
 * Tolerance — A9(g), and the polarity ruling I am NOT taking
 * -------------------------------------------------------------------- */

/**
 * Which SIGN of variance a money tolerance admits.
 *
 * Signed variance is defined once, here, and never re-derived: for a candidate
 * pairing, `variance = left.gross − right.gross`. `left_greater_only` admits a
 * pairing only where the LEFT population's amount exceeds the RIGHT's.
 *
 * ⚠️ DOMAIN-NEUTRAL ON PURPOSE. The finance reading — "shortfall" versus
 * "overpayment", "favours the customer" versus "favours the firm" — depends on
 * which population holds the obligation, and that is stated separately on
 * `SetReconciliationInput.obligationSide`. Baking a finance reading into the
 * type name is exactly the ERP vocabulary `CLAUDE.md` forbids in shared
 * surfaces: the engine is the product and finance is an instance.
 *
 * ⚠️ WHICH VALUE IS CORRECT IS A PRODUCT DECISION AND I AM NOT TAKING IT. A
 * tolerance that writes off SGD 20 the counterparty underpaid and SGD 20 they
 * overpaid under one number is a policy choice nobody made — the brief's A9(g).
 * The fix available to ENGINEERING is to make the choice impossible to leave
 * unstated: it is a required field on the run input with no default, and the
 * signed variance is recorded on every tolerant pairing so the direction stays
 * recoverable whichever way it is ruled.
 */
export type ToleranceDirection =
  | 'symmetric'
  | 'left_greater_only'
  | 'right_greater_only'

export type ToleranceRefusal =
  /**
   * ⚠️ `docs/build-conventions.md` §3 lists "a floating-point money type,
   * anywhere" as a BAN, on G65. `Tolerance` (`model/domain.ts:1766`) carries
   * `{ kind: 'absolute'; value: number }` and `{ kind: 'percentage'; value:
   * number }`, and BOTH are floating-point money the moment they are applied to
   * an amount. `percentage` additionally requires a multiply and a rounding
   * decision, and this engine never multiplies and never rounds.
   *
   * So the engine REFUSES both arms on an amount comparison rather than
   * implementing them. That is a real cost — a pack author who writes
   * `{ kind: 'percentage', value: 2 }` gets a refusal, not a match — and it is
   * the correct cost: the alternative is a silent float multiply on money in
   * the one function every allocation passes through.
   */
  | { kind: 'float_money_tolerance'; arm: 'absolute' | 'percentage' }
  /** `days` and `similarity` are tolerances on other quantities entirely. */
  | { kind: 'not_an_amount_tolerance'; arm: 'days' | 'similarity' }
  | { kind: 'money'; refusal: MoneyRefusal }

export type _ToleranceRefusalHoldsNoText = AssertNoTextDeep<ToleranceRefusal>

export type ToleranceVerdict =
  /**
   * ⚠️ `signedVarianceMinor` IS `bigint` SINCE 19 Sep 2026 — G286. It is a
   * DIFFERENCE OF TWO MONEY AMOUNTS and therefore money; leaving it `number`
   * while its two operands were `bigint` would have re-introduced the ceiling
   * one field below the type that raised it, which is the exact drift G111's
   * one-codec rule exists to prevent.
   */
  | { ok: true; admitted: boolean; signedVarianceMinor: bigint }
  | { ok: false; refusal: ToleranceRefusal }

/**
 * C16's third comparison, for ONE tolerance: does it name the declared unit?
 *
 * ⚠️ EVERY ARM BUT `money` RETURNS `null`, AND THAT IS A RULING RATHER THAN A
 * FALL-THROUGH. `rounding` is expressed in MINOR UNITS and is unit-free, so it
 * is admissible against ANY declaration — the same reasoning `toleranceAdmits`
 * already applies to it, and a gate that compared it against a declaration would
 * refuse every exponent-0 population configured with a rounding tolerance.
 * `days` and `similarity` are tolerances on other quantities entirely, and
 * `absolute`/`percentage` are float money that `toleranceAdmits` refuses on its
 * own ground. C16 owns denomination and nothing else.
 *
 * ⚠️ IT STAYED IN THIS FILE WHEN §3 MOVED TO `model/money.ts` ON 19 Sep 2026.
 * A tolerance is engine configuration, not money; what it borrows from the codec
 * is `sameUnit()`, which is why that function is now exported.
 */
function toleranceNamesUnit(tolerance: Tolerance, declared: MoneyUnit): MoneyRefusal | null {
  if (tolerance.kind !== 'money') return null
  return sameUnit(tolerance.value, declared)
}

/**
 * Does `left − right` fall inside `tolerance`, in the permitted direction?
 *
 * `rounding` is expressed in minor units and is unit-free, so it is admitted
 * against any currency. `money` must agree on currency AND exponent.
 *
 * ⚠️ G286 CHANGED WHAT THIS FUNCTION TOUCHES, NOT WHAT IT DECIDES. It read
 * `delta.value.amountMinor` and `tolerance.value.amountMinor` directly and used
 * `Math.abs`; it now reads through `minorUnitsOf()` and takes magnitude with a
 * sign test, because `Math.abs` is not defined on `bigint`. Every verdict this
 * function returns for a value both representations can hold is unchanged, and
 * `tests/scenarios/recon-corpus.ts` is the witness.
 */
export function toleranceAdmits(
  left: Money,
  right: Money,
  tolerance: Tolerance,
  direction: ToleranceDirection,
): ToleranceVerdict {
  const delta = subtractMoney(left, right)
  if (!delta.ok) return { ok: false, refusal: { kind: 'money', refusal: delta.refusal } }
  const variance = minorUnitsOf(delta.value)

  if (tolerance.kind === 'absolute' || tolerance.kind === 'percentage') {
    return { ok: false, refusal: { kind: 'float_money_tolerance', arm: tolerance.kind } }
  }
  if (tolerance.kind === 'days' || tolerance.kind === 'similarity') {
    return { ok: false, refusal: { kind: 'not_an_amount_tolerance', arm: tolerance.kind } }
  }

  let ceilingMinor: bigint
  if (tolerance.kind === 'rounding') {
    if (tolerance.minorUnits < 0) {
      return { ok: false, refusal: { kind: 'money', refusal: { kind: 'not_integer_minor_units' } } }
    }
    /**
     * ⚠️ `Tolerance.rounding.minorUnits` IS STILL A `number` AND THIS IS THE ONE
     * PLACE THAT MATTERS. It is pack configuration, not an amount, so G286 left
     * its type alone — but it is compared against money, so it has to become
     * money, and `minorUnitsFromCount()` is the ONLY thing permitted to do that
     * under G111. The negative test above stays here rather than moving into the
     * codec because a negative tolerance is a TOLERANCE defect and `MoneyRefusal`
     * has no arm that says so truthfully.
     */
    const count = minorUnitsFromCount(tolerance.minorUnits)
    if (!count.ok) return { ok: false, refusal: { kind: 'money', refusal: count.refusal } }
    ceilingMinor = count.value
  } else {
    const unit = sameUnit(tolerance.value, delta.value)
    if (unit !== null) return { ok: false, refusal: { kind: 'money', refusal: unit } }
    const g = guardMoney(tolerance.value)
    if (g !== null) return { ok: false, refusal: { kind: 'money', refusal: g } }
    const stated = minorUnitsOf(tolerance.value)
    ceilingMinor = stated < 0n ? -stated : stated
  }

  const magnitude = variance < 0n ? -variance : variance
  const withinMagnitude = magnitude <= ceilingMinor
  const directionOk =
    direction === 'symmetric'
      ? true
      : direction === 'left_greater_only'
        ? variance >= 0n
        : variance <= 0n
  return { ok: true, admitted: withinMagnitude && directionOk, signedVarianceMinor: variance }
}

/**
 * End of §3. Below this line nothing may name the money representation.
 *
 * A DECLARATION rather than a comment, deliberately: the header's negative
 * control strips comments before applying its range, so a comment sentinel
 * would vanish and a section heading would make the control self-referential.
 * This is the only marker that survives both.
 */
export type _MoneySectionEndsHere = true

/* ==================================================================== *
 * §4  ADMISSION — nothing is ever dropped
 *
 * THE RULE THAT KILLS A9(d) AND A9(f) TOGETHER: a record that cannot be read is
 * REFUSED with a stated reason and lands in the residue. It is never skipped.
 * The draft's `groupBy` silently dropped any record whose group key was absent,
 * and an absent group key is exactly the record a reconciliation exists to find.
 * ==================================================================== */

export type PopulationSide = 'left' | 'right'

/**
 * Addresses ONE transaction inside a population.
 *
 * A bank statement is one `SourceDocument` (`model/domain.ts:1706`) with four
 * hundred `ExtractedLine`s (`model/domain.ts:1701`), so a set reconciliation is
 * LINE-grain even though `PopulationSpec.documentTypeId` is document-grain.
 * Every allocation, every residual and every FIFO position is addressed by this
 * pair. `MatchGroup.members` (`model/domain.ts:2636`) addresses DOCUMENTS and
 * can never record which line paired — diff-plan DP-4.
 */
export interface ItemRef {
  readonly sourceDocumentId: SourceDocumentId
  /** Null for a header-grain transaction; the line index for a statement line. */
  readonly lineIndex: number | null
}

/**
 * Total, PROVABLY collision-free key for an item within a run.
 *
 * LENGTH-PREFIXED, not delimiter-joined. `${a}-${b}` is ambiguous the moment an
 * id contains the delimiter, and `Id<'SourceDocument'>` is a branded `string`
 * with nothing at runtime enforcing a slug shape — G97 says branded ids are
 * STORED verbatim as readable prefixed slugs, which is a statement about what we
 * write, not a constraint on what we may read back. A length prefix is injective
 * for any content at all, so this needs no assumption about ids.
 *
 * ⚠️ AND IT IS PLAIN ASCII, DELIBERATELY. The first version of this function
 * joined on a NUL byte. That is genuinely unambiguous, and it made the whole
 * source file BINARY to `grep`. In a repository whose entire verification
 * surface is greps — `tools/check-doc-counts.mjs`, the E5 sweep, every negative
 * control in this file's own header — a source file that `grep` silently skips
 * is a defect with a far larger blast radius than the one it solved. Found by
 * running the engine, not by reading it.
 */
export function itemKey(side: PopulationSide, ref: ItemRef): string {
  const id: string = ref.sourceDocumentId
  const line = ref.lineIndex === null ? 'h' : String(ref.lineIndex)
  return `${side}:${id.length}:${id}:${line}`
}

export interface AdmittedItem {
  readonly side: PopulationSide
  readonly ref: ItemRef
  readonly key: string
  readonly gross: Money
  /** `YYYY-MM-DD`, validated at admission. Never parsed with `new Date`. */
  readonly date: string
  /** Days since 1970-01-01, computed by integer arithmetic. Total order. */
  readonly dayNumber: number
  /** Normalised identifier per declared path. Absent paths are refusals. */
  readonly identifiers: ReadonlyMap<FieldPathKey, string>
  /** Null means UNATTRIBUTED — a real, named bucket, never a silent drop. */
  readonly counterparty: string | null
  /**
   * The one field carrying counterparty-controlled prose, and the only thing
   * that may ever be put in a prompt. Null where the definition names no
   * description path, or where `FieldSpec` forbids model processing.
   */
  readonly untrustedDescription: string | null
  readonly untrustedDescriptionClass: DataClass | null
  /** Position in the deterministic admission order. Breaks every FIFO tie. */
  readonly ordinal: number
  /**
   * G227 — the reads on this row that came in under their declared floor.
   *
   * 🛑 A NON-EMPTY ARRAY MAKES THE ITEM UNPAIRABLE. `openItems()` — the one seam
   * every pass and `buildReaderRequests()` draw candidates from — skips it, so
   * the item is admitted, counted, conserved and left OPEN, and it reaches the
   * residue with `read_held_below_floor`. That is what *"a person is asked
   * instead of guessed at"* means operationally: an engine that paired on a
   * value it does not trust has asked nobody.
   *
   * ⚠️ AND IT IS WHY THE HOLD IS NOT A REFUSAL. A refused row leaves the ledger
   * (`refusedAtAdmission`, settlement `null`); a held row stays IN it, with its
   * gross summed, its trailer comparison honest and `gross_not_partitioned`
   * balancing exactly as before. The value is kept and shown, which is the
   * design; only the automatic verdict is withheld.
   */
  readonly heldReads: readonly HeldRead[]
}

export type AdmissionRefusal =
  /**
   * G106, fail-closed. A key with no `FieldSpec` is UNREADABLE — it is stored
   * but unaddressable by any agent, prompt, export or dashboard. The engine
   * cannot see `FieldSpec` from here, so the caller supplies the resolved
   * classification map and an absent path refuses rather than defaulting.
   * `DENY_ALL` and G100's deny-on-NULL are the same posture.
   */
  | { kind: 'field_not_classified' }
  | { kind: 'field_absent' }
  | { kind: 'amount_not_money'; found: ExtractedScalar['kind'] }
  | { kind: 'date_not_extractable'; found: ExtractedScalar['kind'] }
  /** ⚠️ Carries NO value. The rejected string is counterparty-controlled. */
  | { kind: 'date_not_iso_calendar' }
  | { kind: 'identifier_not_extractable'; refusal: ExtractionRefusal }
  /**
   * C16. The row's money unit disagrees with the population's DECLARED unit —
   * currency or exponent, and `sameUnit()` (§3) is the only thing that decides
   * which. The name no longer says "population" because the population is no
   * longer the authority: a DECLARATION is, and a row that disagrees with it is
   * refused rather than allowed to redefine it.
   *
   * ⚠️ IT CATCHES A CASE THE OLD ARM COULD NOT SEE. The arm it replaces,
   * `currency_disagrees_with_population`, compared `gross.currency` alone — so
   * SGD-exponent-0 against SGD-exponent-2 was ADMITTED and failed later, inside a
   * pass, as a `MoneyRefusal` from `addMoney`: a hundredfold unit error surfacing
   * as a tolerance artefact instead of an admission refusal. §5.7 exactly.
   */
  | { kind: 'money_unit_disagrees_with_declared'; refusal: MoneyRefusal }
  /**
   * 🛑 THE EIGHTH ARM, AND IT EXISTS BECAUSE THE SEVEN ABOVE LET A ROW LEAVE
   * THE LEDGER ENTIRELY. OQ-1, ruled FIX NOW.
   *
   * ⚠️ WHAT THIS MODULE DID BEFORE, NARRATED RATHER THAN QUIETLY REPLACED,
   * because it is the behaviour every reader of §4 would have assumed was
   * impossible. `admitOne` checked that the amount scalar was `money` and that
   * its UNIT matched the declaration, AND NEVER CALLED `guardMoney`. So
   * `{ currency: 'SGD', amountMinor: 1.5, exponent: 2 }` was ADMITTED — and so
   * were `NaN`, `Infinity` and `MAX_SAFE_INTEGER + 2`. `residualOf` then refused
   * on every later read, and BOTH §6's residue build and `checkPostconditions`
   * skipped the item on the identical `if (!settlement.ok) continue`. The row
   * was in NEITHER the residue NOR the allocations; `refusedAtAdmission` was
   * EMPTY; and `open_item_missing_from_residue` — *"THE load-bearing one"* by
   * its own declaration, classified `soundness` — STRUCTURALLY COULD NOT FIRE
   * for the one case it is named for. The only channel that spoke was
   * `gross_not_partitioned`, which carries two totals and NO ADDRESS: the
   * operator was told the close does not balance and was not told which row
   * left it.
   *
   * ✅ §4's OWN HEADING IS *"ADMISSION — nothing is ever dropped"* AND ITS OWN
   * PARAGRAPH ALREADY SAID WHAT SHOULD HAPPEN: *"a record that cannot be read is
   * REFUSED with a stated reason and lands in the residue. It is never
   * skipped."* This arm is not a new rule. It is the rule the section states,
   * given the executable form it never had.
   *
   * 🛑 WHY A NEW ARM RATHER THAN AN EXISTING ONE, AND BOTH CANDIDATES WERE
   * WEIGHED. `amount_not_money` carries `found: ExtractedScalar['kind']` and the
   * scalar here IS `money` — the arm would report *"amount not money, found
   * money"*, which is a false statement on an operator's screen.
   * `money_unit_disagrees_with_declared` already carries a `MoneyRefusal` and
   * would have compiled, and it is the worse of the two: a `1.5` in a correctly
   * declared SGD/2 is not a disagreement with the declaration at all, so the arm
   * would send an operator to audit a currency mapping that is right. That is
   * §5.3 — two findings arriving under one name — bought for the price of not
   * editing a contract.
   *
   * ⚠️ THE PAYLOAD IS THE VOCABULARY THAT ALREADY EXISTED. `guardMinor` names
   * both failures — `not_integer_minor_units` and `exceeds_exact_integer_range`
   * — so this arm mints NO new reason. It carries the `MoneyRefusal` the guard
   * returns, exactly as `money_unit_disagrees_with_declared` carries the one
   * `sameUnit` returns, and `MoneyRefusalKind` is already on the wire.
   *
   * 🛑 THE ENUM ON THE WIRE IS CLOSED AND THIS IS THEREFORE A CONTRACT CHANGE,
   * MADE IN THE SAME COMMIT. `PopulationAdmissionRefusalKind` in
   * `docs/contracts/capability.openapi.yaml` is pinned against this union by
   * `tools/check-wire-mirror.mjs` (`admission_refusal_kinds`), member for member
   * and IN ORDER — so the member is APPENDED here and APPENDED there, and the
   * `PopulationAdmissionRefusal` `oneOf` gains the matching variant. Derive the
   * pairing, do not read this line:
   * `node -e "import('./tools/check-wire-mirror.mjs').then(m=>console.log(m.PAIRS.find(p=>p.name==='admission_refusal_kinds')))"`.
   * ⚠️ `docs/contracts/errors.yaml` is NOT touched: that closed enum is the
   * problem-code vocabulary for HTTP failures, and a refused ROW is a successful
   * run's finding rather than a failed request.
   *
   * ⚠️ AND IT MOVES A COUNT THAT A TEST GUARDED BY LANDMARK. G227's hold suite
   * under `tests/model/` asserted in its §1 that this union has SEVEN arms.
   * G227's property — a read below its declared confidence threshold is HELD
   * and shown, never refused — is UNTOUCHED by this arm, and the SEVEN was the
   * landmark rather than the property, which is §5.1 arriving inside the
   * control written to hold §5.1's line. That test is re-keyed onto the
   * property in the same commit.
   *
   * 🛑 AND THAT CONTROL SEARCHES THIS BLOCK FOR ONE WORD, SO THIS BLOCK MAY NOT
   * CONTAIN IT — not in prose, and not inside the suite's own FILENAME, which is
   * how the first draft of this docblock made the control inert while looking
   * like documentation. The word is the noun G227 argues about, and it is named
   * nowhere above deliberately. That is a fragile control and it is the honest
   * one available: the property *"no arm of this union is a confidence-threshold
   * breach"* is a statement about MEANING, and a text search is the only
   * mechanism `tsc` leaves for it.
   */
  | { kind: 'amount_not_exact_money'; refusal: MoneyRefusal }

export type _AdmissionRefusalHoldsNoText = AssertNoTextDeep<AdmissionRefusal>

export interface RefusedItem {
  readonly side: PopulationSide
  readonly ref: ItemRef
  readonly path: FieldPath
  readonly refusal: AdmissionRefusal
}

/* -------------------------------------------------------------------- *
 * Dates — A9(f), and a bug the brief did not name
 *
 * The draft sorted on `new Date(payload[dateKey])`. That is an unvalidated
 * parse whose failure value is `NaN`, and `NaN` compares false against
 * everything, so a comparator built on it produces an order that depends on the
 * sort implementation. The wrong invoice goes first in the FIFO queue and no
 * error is raised.
 *
 * `YYYY-MM-DD` compares lexicographically AND that IS the chronological order,
 * so `new Date` is not needed for ordering at all. It IS needed for a `days`
 * tolerance, and that is computed by the integer days-from-civil algorithm
 * below — no `Date` object, no timezone, no locale.
 * -------------------------------------------------------------------- */

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    return leap ? 29 : 28
  }
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30
  return 31
}

/** Days since 1970-01-01. Integer arithmetic only; proleptic Gregorian. */
function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year
  const era = Math.floor(y / 400)
  const yoe = y - era * 400
  const mp = month + (month > 2 ? -3 : 9)
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

export type CalendarDate = { readonly iso: string; readonly dayNumber: number }

/**
 * Accepts `YYYY-MM-DD`, or an RFC 3339 instant whose first ten characters are a
 * valid calendar date. Returns null on anything else — including `NaN`-producing
 * inputs, which is the entire point.
 */
export function parseCalendarDate(value: string): CalendarDate | null {
  if (value.length < 10) return null
  const iso = value.slice(0, 10)
  if (iso.charCodeAt(4) !== 45 || iso.charCodeAt(7) !== 45) return null
  for (const i of [0, 1, 2, 3, 5, 6, 8, 9]) {
    const c = iso.charCodeAt(i)
    if (c < 48 || c > 57) return null
  }
  if (value.length > 10) {
    const sep = value.charCodeAt(10)
    if (sep !== 84 && sep !== 32) return null
  }
  const year = Number(iso.slice(0, 4))
  const month = Number(iso.slice(5, 7))
  const day = Number(iso.slice(8, 10))
  if (month < 1 || month > 12) return null
  if (day < 1 || day > daysInMonth(year, month)) return null
  return { iso, dayNumber: daysFromCivil(year, month, day) }
}

/* -------------------------------------------------------------------- *
 * Reading a population
 * -------------------------------------------------------------------- */

/**
 * A `PopulationSpec` plus the two fields it does not carry yet.
 *
 * ⚠️ STOPGAP WITH A STATED END STATE. `PopulationSpec`
 * (`model/domain.ts:1931`) declares `documentTypeId`, `amount`, `date` and
 * `identifiers` and NOTHING ELSE — `MatchKey.normaliser` (`:1754`) and
 * `LineMatchKey.normaliser` (`:1763`) both exist, and `PopulationSpec` has no
 * normalisation surface at all. That is the model gap the owner's draft was
 * routing around when it invented `MatchRuleConfig`, and it is a real gap
 * rather than a draft defect.
 *
 * Diff-plan DP-2 moves `normalisation` and `counterparty` onto `PopulationSpec`
 * as required fields, at which point this interface collapses to
 * `{ spec, description }`. It is written this way, in this file, rather than
 * edited into `model/domain.ts`, because another build owns that file this
 * minute — and because a binding that names the exact declaration it will
 * collapse into is a stopgap, whereas a binding that redefines the concept is
 * §5.3.
 */
export interface PopulationBinding {
  readonly spec: PopulationSpec
  /**
   * → `PopulationSpec.declaredUnit` under DP-2. Required, NON-NULL.
   *
   * 🛑 C16 — CURRENCY IS DECLARED, NEVER INFERRED, AND THIS FIELD IS THE WHOLE
   * RULING. `admitPopulation` used to seed the population's currency from
   * WHICHEVER ROW WAS ADMITTED FIRST and check every later row against that seed.
   * A CSV cell carries no currency, so whoever controlled row one denominated the
   * entire side — and nothing refused, because row one was compared against
   * `null` and always agreed. The poisoned row was not rejected; it BECAME the
   * definition, and the same file in a different row order produced a different
   * close.
   *
   * NULLABLE WOULD REINTRODUCE THE DEFECT WEARING A NULL. `null` reads as "not
   * stated", and not-stated takes the permissive branch at the first call site
   * somebody writes in a hurry — §5.5, and `docs/access-and-agency.md` §8.6's
   * `neverExport → exportable` inversion is this record's own precedent for a
   * null that fails OPEN. Required and non-null; an unstated unit is a REFUSAL,
   * in the same gate as the three bounds this engine already refuses to default.
   *
   * ONE UNIT PER POPULATION, AND A MULTI-CURRENCY SOURCE IS SEVERAL POPULATIONS.
   * There is no currency-COLUMN binding here: validating a bound column would
   * need an ISO 4217 table, this tree records the deliberate absence of one, and
   * `PRODUCT.md` forbids inventing it. Denominations cannot be reconciled across
   * in any case — `FxConversion` and `FxPolicy` are both dropped for v1 — so one
   * population per denomination is the shape, not a limitation of this field.
   *
   * WHERE THE VALUE COMES FROM, AND IT IS NEVER THIS ENGINE: source configuration
   * set by an FDE, or a mapping whose codec validated it against a closed set
   * upstream. This module CONSUMES a declaration; it never resolves one.
   */
  readonly declaredUnit: MoneyUnit
  /**
   * → `DocumentType.carriesControlTotal` under DP-2. Required.
   *
   * 🛑 C18 — THE SECOND VOICE, AND WITHOUT IT THE CHECKED COMPONENT CAN SWITCH
   * THE CHECK OFF. `SourceDocument.controlTotal` records what the PARSER found;
   * this records what the format is SUPPOSED to carry. A shredder refactored to
   * stop reading trailers reports `not_declared_by_format` for every file, and
   * C18 then silently becomes a no-op on a green gate — the exact shape of a
   * control keyed on a convenient landmark rather than on the property it
   * protects (§5.1).
   *
   * ⚠️ IT IS A STOPGAP AT THIS GRAIN AND SAYS SO. The declaration belongs on
   * `DocumentType`, which is where it is written (`model/domain.ts`);
   * `SetReconciliationInput` carries no `DocumentType`, so the binding carries
   * the value beside the model type until DP-2 folds it in. Two spellings of one
   * declaration is a drift risk, which is why this comment names the owner.
   */
  readonly carriesControlTotal: 'always' | 'never'
  /**
   * → `PopulationSpec.emptyExpectation` under DP-2. Required.
   *
   * 🛑 O-15 — AN EMPTY POPULATION REFUSES, AND THIS FIELD IS THE ONLY ESCAPE.
   * NOTHING here refused a side that presented ZERO rows, and the reason it went
   * unnoticed is that every conservation post-condition ACCUMULATES FROM ZERO:
   * `checkPostconditions` walks `state.items`, so `admittedMinor !==
   * accountedMinor` compares `0 !== 0`, the residue-completeness partition is a
   * partition of the empty set, and all five arms are `count > 0` tests. A bank
   * statement that failed to parse, a source endpoint that returned nothing, or
   * a run handed no document at all therefore produced a CLEAN, FULLY-RECONCILED
   * CLOSE OVER NOTHING. Month-end shows green because nothing was loaded.
   *
   * A TRIVIALLY-PASSING POST-CONDITION IS WORSE THAN A FAILING ONE. A failing
   * check is read and acted on; a vacuous one is counted as evidence, and it
   * counts hardest exactly when the input is most broken. That is §5.6 arriving
   * through arithmetic rather than through a checker: sound over nothing is
   * indistinguishable, in the output, from sound.
   *
   * `'refuses'` is the posture. `'permitted'` is a DECLARATION made in advance
   * about a source genuinely capable of presenting nothing — a dormant account,
   * a new tenant's first close, a genuinely quiet week.
   *
   * 🛑 A DECLARATION AND NOT A PARAMETER, AND THE DIFFERENCE IS THE WHOLE
   * CONTROL. A boolean argument on `runSetReconciliation` would be §5.2 exactly:
   * an off-switch on the check, reachable by whoever finds the refusal
   * inconvenient at 2am on close day. This record refused that shape at G79 for
   * `requireImprovementOptOut` and refused it again for C13's ceiling. Declared
   * on the binding, the statement belongs to the SOURCE rather than to the CALL
   * — FDE-set configuration, auditable, and changing it is a change to the
   * definition of the population rather than an argument nobody reviews.
   *
   * ⚠️ NOT A BOOLEAN, for the same reason `carriesControlTotal` is not: the
   * literal union reads at the call site, and a third posture is addable without
   * inverting the meaning of a flag.
   *
   * ⚠️ IT DOES NOT COVER C13's CASE AND MUST NOT BE WIDENED INTO IT. Rows
   * PRESENTED and none admitted is `population_wholly_refused` — a parsing or
   * mapping failure, whose residue carries one reason per row and IS the output.
   * ZERO rows presented is an ingestion or configuration failure: no row carries
   * a reason and there is no residue to preserve. Two pathologies, two remedies,
   * two arms.
   *
   * WHERE THE VALUE COMES FROM, AND IT IS NEVER THIS ENGINE: source
   * configuration set by an FDE. This module CONSUMES a declaration; it never
   * resolves one.
   */
  readonly emptyExpectation: 'refuses' | 'permitted'
  /** → `PopulationSpec.normalisation` under DP-2. Required, non-null. */
  readonly normalisation: IdentifierNormalisation
  /**
   * → `PopulationSpec.counterparty` under DP-2.
   *
   * The field that partitions this population into N:M buckets. NULL MEANS THIS
   * DEFINITION HAS NOT ASKED FOR N:M, and `amount_sum` does not run — rather
   * than running over one bucket holding every transaction in the period. That
   * is the A9(d) fix at the spec level.
   *
   * PER-POPULATION and not on `PairingSpec`, because the two sides name it
   * differently (`Customer_ID` on the ledger, `Payer_Ref` on the statement) —
   * the same reason `amount` and `date` are on `PopulationSpec` and not on
   * `PairingSpec`. It is NOT a member of `identifiers`: those are PAIRING keys
   * and this is a PARTITION key, and folding them together is §5.1 exactly.
   */
  readonly counterparty: FieldPath | null
  /**
   * The path holding counterparty prose, if any. Null on a ledger side.
   *
   * A path here is not sufficient to reach a prompt: it must also be present in
   * `fieldClassification` (G106) and in `modelPromptEligible`, which is the
   * caller's projection of `FieldSpec.modelProcessingAllowed`
   * (`model/domain.ts:1597`) and `ModelUseConfig.maxDataClassInPrompt`. Two
   * gates, both fail-closed, neither invented here — invariant 4 says
   * classification is declared once on `FieldSpec` and everything derives from
   * it, so the engine derives rather than deciding.
   */
  readonly description: FieldPath | null
}

function readField(
  fields: Record<FieldPathKey, ExtractedValue>,
  path: FieldPath,
): ExtractedScalar | null {
  const value = fields[fieldPathKey(path)]
  if (value === undefined) return null
  return value.scalar
}

interface AdmissionContext {
  readonly fieldClassification: ReadonlyMap<FieldPathKey, DataClass>
  readonly modelPromptEligible: ReadonlySet<FieldPathKey>
  /**
   * G227 — the caller's projection of `FieldSpec.confidenceFloor`, keyed the same
   * way `fieldClassification` is. Fail-closed in the one direction that is this
   * module's to decide, and SILENT in the one that is not.
   *
   * 🛑 A PATH ABSENT FROM THIS MAP HOLDS NOTHING, AND THAT IS NOT G106's
   * POSTURE INVERTED. G106 fails closed on CLASSIFICATION because an unclassified
   * key is unreadable; a floor is a THRESHOLD, and there is no threshold below
   * which a stated-nothing is breached. `FieldSpec.confidenceFloor` is
   * `number | null` and its null means *"the pack's archetype default applies"* —
   * and under G139 that default is FDE-set pack configuration with **no surface
   * that sets one** ([M2-3]). Inventing a number here to fill the hole is what
   * `PRODUCT.md` forbids, so the engine holds what it was given a floor for and
   * says so, rather than manufacturing a floor nobody declared.
   *
   * ⚠️ WHERE IT DOES FAIL CLOSED: a path that HAS a floor and whose extraction
   * reported no confidence is HELD — see `HeldRead.readConfidence`.
   */
  readonly confidenceFloors: ReadonlyMap<FieldPathKey, number>
}

/**
 * G227 — every declared path this binding reads, once, in admission order.
 *
 * 🛑 ONE LIST, TWO CALLERS, FOR `presentedRows`'s REASON. `admitOne` walks these
 * paths to read values and `heldReadsFor` walks them to compare confidences; two
 * hand-written spellings of *"which fields does admission read"* are two branches
 * that agree until somebody adds a sixth (§5.3), and the disagreement would be
 * silent — a field read without its floor checked looks exactly like a field with
 * no floor.
 *
 * ⚠️ ORDER IS `amount · date · identifiers · counterparty · description`, which
 * is the order `admitOne` refuses in, so a row with two held reads reports them
 * in the order an operator meets them on the form.
 */
function declaredPaths(binding: PopulationBinding): readonly FieldPath[] {
  const paths: FieldPath[] = [binding.spec.amount, binding.spec.date, ...binding.spec.identifiers]
  if (binding.counterparty !== null) paths.push(binding.counterparty)
  if (binding.description !== null) paths.push(binding.description)
  return paths
}

/**
 * G227 — which of this row's declared reads came in under their floor.
 *
 * PURE, TOTAL, AND IT NEVER LOOKS AT A VALUE. It compares two numbers the caller
 * and the extractor each supplied, and it carries neither the scalar nor any part
 * of it into the result.
 *
 * 🛑 AN ABSENT FIELD IS NOT A HELD READ. A path with no entry, or one whose
 * scalar is `absent`, was never READ — there is no confidence to have come in
 * under anything, and holding it would report a low-confidence reading of a
 * value that does not exist. `field_absent` is the vocabulary for that and it is
 * an `AdmissionRefusal`, which is where it stays: this is a hold, not a refusal,
 * and the two must not become two spellings of one finding (§5.3).
 */
function heldReadsFor(
  ref: ItemRef,
  fields: Record<FieldPathKey, ExtractedValue>,
  binding: PopulationBinding,
  floors: ReadonlyMap<FieldPathKey, number>,
): readonly HeldRead[] {
  const held: HeldRead[] = []
  for (const path of declaredPaths(binding)) {
    const key = fieldPathKey(path)
    const floor = floors.get(key)
    if (floor === undefined) continue
    const value = fields[key]
    if (value === undefined || value.scalar.kind === 'absent') continue
    const confidence = value.provenance.confidence
    /* FAIL-CLOSED ON THE NULL. A floor was declared and the extractor reported
     * no confidence, so nothing can be compared against it — held, never passed.
     * `>=` and not `>`: a read AT the floor cleared it, which is what a floor
     * means, and the strict form would hold every exactly-conforming read. */
    if (confidence !== null && confidence >= floor) continue
    held.push({ ref, path, readConfidence: confidence, floor })
  }
  return held
}

function admitOne(
  side: PopulationSide,
  ref: ItemRef,
  fields: Record<FieldPathKey, ExtractedValue>,
  binding: PopulationBinding,
  context: AdmissionContext,
  ordinal: number,
): { ok: true; item: AdmittedItem } | { ok: false; refused: RefusedItem } {
  const refuse = (
    path: FieldPath,
    refusal: AdmissionRefusal,
  ): { ok: false; refused: RefusedItem } => ({ ok: false, refused: { side, ref, path, refusal } })

  const classified = (path: FieldPath): boolean =>
    context.fieldClassification.has(fieldPathKey(path))

  /* --- amount --- */
  const amountPath = binding.spec.amount
  if (!classified(amountPath)) return refuse(amountPath, { kind: 'field_not_classified' })
  const amountScalar = readField(fields, amountPath)
  if (amountScalar === null || amountScalar.kind === 'absent') {
    return refuse(amountPath, { kind: 'field_absent' })
  }
  if (amountScalar.kind !== 'money') {
    return refuse(amountPath, { kind: 'amount_not_money', found: amountScalar.kind })
  }
  const gross = amountScalar.value
  /* C16. Against the DECLARATION, and against it for EVERY row including the
   * first. There is no seed to agree with vacuously any more. */
  const disagreement = sameUnit(gross, binding.declaredUnit)
  if (disagreement !== null) {
    return refuse(amountPath, {
      kind: 'money_unit_disagrees_with_declared',
      refusal: disagreement,
    })
  }
  /* 🛑 OQ-1, AND THE ABSENCE OF THIS CALL IS THE DEFECT IT NAMED. `guardMoney`
   * has existed in §3 since the money section was written and admission never
   * called it, so a row whose `amountMinor` was `1.5`, `NaN`, `Infinity` or
   * `MAX_SAFE_INTEGER + 2` was admitted, became a ledger item, refused on every
   * later read through `residualOf`, and was then SKIPPED by both §6 and
   * `checkPostconditions` on the same `if (!settlement.ok) continue` — leaving
   * the ledger with no address anywhere in the result. §3 rule 4 is that this
   * engine only adds, subtracts and compares, and `1.5` breaks it; §4's heading
   * is *"nothing is ever dropped"*. See `AdmissionRefusal`'s eighth arm for the
   * full narration and for why no existing arm was reused.
   *
   * ⚠️ ORDERED AFTER C16's UNIT CHECK, DELIBERATELY, AND IT IS THE SAME
   * ARGUMENT C18's residue cause makes about dominating. A row denominated
   * against the wrong declaration has a MAPPING problem, and the exactness of a
   * number read under the wrong denomination is a question about the wrong
   * number. Report the mapping first. */
  const inexact = guardMoney(gross)
  if (inexact !== null) {
    return refuse(amountPath, { kind: 'amount_not_exact_money', refusal: inexact })
  }

  /* --- date --- */
  const datePath = binding.spec.date
  if (!classified(datePath)) return refuse(datePath, { kind: 'field_not_classified' })
  const dateScalar = readField(fields, datePath)
  if (dateScalar === null || dateScalar.kind === 'absent') {
    return refuse(datePath, { kind: 'field_absent' })
  }
  if (dateScalar.kind !== 'date') {
    return refuse(datePath, { kind: 'date_not_extractable', found: dateScalar.kind })
  }
  const parsed = parseCalendarDate(dateScalar.value)
  if (parsed === null) return refuse(datePath, { kind: 'date_not_iso_calendar' })

  /* --- identifiers --- */
  const identifiers = new Map<FieldPathKey, string>()
  for (const path of binding.spec.identifiers) {
    if (!classified(path)) return refuse(path, { kind: 'field_not_classified' })
    const scalar = readField(fields, path)
    if (scalar === null || scalar.kind === 'absent') continue
    if (scalar.kind !== 'identifier' && scalar.kind !== 'text' && scalar.kind !== 'number') {
      continue
    }
    const raw = scalar.kind === 'number' ? String(scalar.value) : scalar.value
    const extracted = applyExtraction(raw, binding.normalisation)
    if (!extracted.ok) {
      return refuse(path, { kind: 'identifier_not_extractable', refusal: extracted.refusal })
    }
    identifiers.set(fieldPathKey(path), extracted.key)
  }

  /* --- counterparty partition --- */
  let counterparty: string | null = null
  if (binding.counterparty !== null) {
    const path = binding.counterparty
    if (!classified(path)) return refuse(path, { kind: 'field_not_classified' })
    const scalar = readField(fields, path)
    if (scalar !== null && scalar.kind !== 'absent') {
      if (scalar.kind === 'identifier' || scalar.kind === 'text') counterparty = scalar.value
      else if (scalar.kind === 'number') counterparty = String(scalar.value)
    }
  }

  /* --- the untrusted description, behind two fail-closed gates --- */
  let untrustedDescription: string | null = null
  let untrustedDescriptionClass: DataClass | null = null
  if (binding.description !== null) {
    const path = binding.description
    const key = fieldPathKey(path)
    const dataClass = context.fieldClassification.get(key)
    if (dataClass !== undefined && context.modelPromptEligible.has(key)) {
      const scalar = readField(fields, path)
      if (scalar !== null && (scalar.kind === 'text' || scalar.kind === 'identifier')) {
        untrustedDescription = scalar.value
        untrustedDescriptionClass = dataClass
      }
    }
  }

  return {
    ok: true,
    item: {
      side,
      ref,
      key: itemKey(side, ref),
      gross,
      date: parsed.iso,
      dayNumber: parsed.dayNumber,
      identifiers,
      counterparty,
      untrustedDescription,
      untrustedDescriptionClass,
      ordinal,
      /* G227. Computed LAST, over the whole declared set, and only on a row that
       * survived every refusal above — a refused row has no admitted item to
       * carry a hold, and `RefusedItem` already states why that row is in the
       * residue. */
      heldReads: heldReadsFor(ref, fields, binding, context.confidenceFloors),
    },
  }
}

/**
 * Admits every transaction on one side, in a deterministic order.
 *
 * Header-grain when the document has no lines; line-grain otherwise. Ordering is
 * `(document order as supplied, then line index)` and it is total — which is
 * A9(h), a bug the brief did not name: FIFO with no tie-break allocates two
 * invoices dated the same day in map-insertion order, so the same input produces
 * two different audits. `RunTrigger.rerun` exists (`model/domain.ts:2629`), so
 * non-determinism here is not theoretical.
 *
 * ⚠️ THIS FUNCTION NO LONGER INFERS A DENOMINATION. The unit is
 * `binding.declaredUnit` and every row is checked against it, INCLUDING THE
 * FIRST — C16. There is no order-dependent state left in this fold, which makes
 * the admission result INDEPENDENT of row order rather than merely deterministic
 * in it. The two states this loop used to carry were `ordinal`, which is the
 * order, and `currency`, which had no business depending on it.
 */
export function admitPopulation(
  side: PopulationSide,
  documents: readonly ReconciliationDocument[],
  binding: PopulationBinding,
  context: AdmissionContext,
): { readonly admitted: readonly AdmittedItem[]; readonly refused: readonly RefusedItem[] } {
  const admitted: AdmittedItem[] = []
  const refused: RefusedItem[] = []
  let ordinal = 0

  for (const document of documents) {
    for (const row of presentedRows(document)) {
      const outcome = admitOne(side, row.ref, row.fields, binding, context, ordinal)
      ordinal += 1
      if (outcome.ok) admitted.push(outcome.item)
      else refused.push(outcome.refused)
    }
  }
  return { admitted, refused }
}

/**
 * THE ROWS A DOCUMENT PRESENTS, in admission order. ONE RULE, TWO CALLERS —
 * admission, and C18's line-count comparison.
 *
 * 🛑 KEEPING THE TWO COUNTS INDEPENDENT IS THE WHOLE ARGUMENT FOR C18;
 * DUPLICATING THE RULE IS NOT. The independent operands are *what the FILE
 * declared* and *what the DOCUMENT presented* — not two hand-written spellings
 * of "how many rows is this". A second `lines.length === 0` written beside the
 * first is two branches that agree until somebody edits one, and the check would
 * then report a disagreement that exists only between two copies of this module.
 *
 * ⚠️ AND IT CARRIES A KNOWN HOLE, NAMED RATHER THAN HIDDEN. A document with BOTH
 * header fields and lines presents its LINES only — the header transaction is
 * presented by neither admission nor this count, so a trailer declaring
 * `lines.length` passes while a transaction was dropped. That is the module's
 * stated admission behaviour and C18 deliberately mirrors it rather than
 * inventing a second one: a control that disagreed with admission would report a
 * defect against the engine, not against the file. The corpus witnesses the
 * behaviour so the choice is visible rather than assumed.
 */
function presentedRows(
  document: ReconciliationDocument,
): readonly { readonly ref: ItemRef; readonly fields: Record<FieldPathKey, ExtractedValue> }[] {
  const lines: readonly ExtractedLine[] = document.lines
  if (lines.length === 0) {
    return [{ ref: { sourceDocumentId: document.id, lineIndex: null }, fields: document.extracted }]
  }
  return lines.map((line) => ({
    ref: { sourceDocumentId: document.id, lineIndex: line.index },
    fields: line.fields,
  }))
}

/** Rows a document PRESENTS. One rule, four callers — never two branches. */
export function presentedRowCount(document: ReconciliationDocument): number {
  return presentedRows(document).length
}

/**
 * Rows a whole SIDE presents. The same rule again, folded over the documents
 * admission was handed, so C13's denominator and C18's per-document count are
 * the same count taken at two grains rather than two spellings of "how many
 * rows is this" (§5.3).
 */
function presentedRowsOnSide(documents: readonly ReconciliationDocument[]): number {
  let total = 0
  for (const document of documents) total += presentedRowCount(document)
  return total
}

/**
 * C13's SECOND HALF, AND IT IS THE ONE THAT NEEDS NO NUMBER FROM ANYBODY.
 *
 * What admission actually did on one side. Recorded on every successful run,
 * UNCONDITIONALLY — whether or not a ceiling was breached and whether or not the
 * ceiling that was stated is a permissive one. G114's posture: a bound that was
 * hit is recorded, never silently absorbed.
 *
 * 🛑 THE REMEDIATION IS *READ THE RATE*, NEVER *RAISE THE CEILING*. A prior
 * draft documented "set the ceiling at 10000 and read the refusals" as the
 * operator's procedure, and that sentence is REFUSED: a caller-supplied
 * parameter that switches a check off is §5.2, and this record refused the same
 * shape once already at G79 (`requireImprovementOptOut`). Because this record is
 * unconditional, a permissive ceiling can suppress the REFUSAL and can never
 * suppress the EVIDENCE.
 *
 * ⚠️ `presented` IS NOT `admitted + refused`, DELIBERATELY. It is folded from
 * `presentedRowCount` over the DOCUMENTS — a source independent of the admission
 * fold — so `presented === admitted + refused` is a property a caller can check
 * rather than a tautology it is handed. An admission fold that lost a row is
 * exactly the defect class C17 exists for, one grain up.
 */
export interface AdmissionRate {
  readonly side: PopulationSide
  /** Rows the DOCUMENTS presented. Independent of the admission fold. */
  readonly presented: number
  readonly admitted: number
  readonly refused: number
}

/* ==================================================================== *
 * §4a  POPULATION INTEGRITY — the defects that are properties of the
 *      POPULATION rather than of any one row
 *
 * §4 refuses a ROW it cannot read and puts it in the residue. Nothing there can
 * see a defect that only exists BETWEEN two rows. This section is where those
 * live, and the first of them is C17.
 * ==================================================================== */

export type PopulationDefect =
  /**
   * C17, and the reason it is a REFUSAL rather than a residue entry. Two rows
   * share one `itemKey` — the same `(side, sourceDocumentId, lineIndex)`. The
   * fold at §9 used to `Map.set` the second over the first, so the row VANISHED,
   * and `checkPostconditions` computes the admitted total by iterating THAT SAME
   * MAP — so conservation held, exactly, over a population one row short.
   * `gross_not_partitioned` could not fire: both of its two "independent" totals
   * were short by the same amount, because one of the two sources had already
   * eaten the row.
   *
   * THE ENGINE CANNOT PICK ONE. They are the same row by every identity it has,
   * and *"nothing is ever dropped"* forbids choosing. This is the one place
   * where refusing beats residue: there is no ROW to put in the residue — there
   * are two rows claiming to be one, and a residue entry for either of them
   * would be a claim about which one survived.
   *
   * 🛑 IT REQUIRES AT LEAST ONE ADMITTED COPY, and that narrowing is not
   * cosmetic. Two REFUSED copies of one address already produce a named outcome:
   * two residue entries at one key, raised as `item_in_residue_twice` by
   * `checkPostconditions`, with both rows and both reasons visible. Refusing the
   * run there would REPLACE a named outcome with nothing at all, which is a
   * regression. Only an admitted copy reaches the fold, and only the fold loses
   * money.
   *
   * ⚠️ THIS IS NOT DUPLICATE-INVOICE DETECTION, AND CONFLATING THEM IS §5.1 — a
   * rule keyed on the word *"duplicate"* instead of on the property it protects.
   * `itemKey` is an ADDRESS, not a value. The same invoice number at two
   * DIFFERENT addresses does not collide here at all; it is a different finding
   * with its own mechanism — `passIdentifierJoin`'s multimap, an
   * `AmbiguityFinding`, and `identifier_ambiguous` on every named ref. A
   * repeated ADDRESS is an ingestion defect and it is reachable exactly three
   * ways: the same `SourceDocument` supplied twice, two `ExtractedLine`s
   * carrying the same `index`, or the same document id delivered twice at
   * header grain.
   *
   * WHAT IT CARRIES, AND WHY THAT IS WHAT AN OPERATOR NEEDS. The refusal names
   * the SIDE (which population was mis-delivered) and the ADDRESS (which
   * document, and which line inside it) — so the fix is a file to re-cut, not a
   * search. `occurrences` is there because two and seventeen are different
   * defects: two is a re-delivery, seventeen is a mapper emitting a constant
   * line index. A refusal that said only *"a duplicate exists"* would not be
   * actionable, which is the whole reason this is a value and not a boolean.
   */
  | { kind: 'duplicate_item_address'; ref: ItemRef; occurrences: number }
  /**
   * C13's CONFIGURABLE HALF — the conformance floor, expressed as a ceiling on
   * the refusal rate. Today admission accumulates per-row refusals and CARRIES
   * ON, so a run in which most rows refused returns a ledger that is internally
   * perfect over the minority that parsed. Nothing could see it: every
   * `PostconditionFailure` arm is a count or a comparison WITHIN the admitted
   * set.
   *
   * CROSS-MULTIPLIED, NEVER DIVIDED: `refused × 10000 > ceiling × sideRowCount`
   * is exact integer arithmetic, and this module never divides. Strictly `>`, so
   * a rate AT the stated ceiling is admitted — the boundary is stated rather
   * than left to whoever writes the comparison next.
   *
   * 🛑 IT REQUIRES AT LEAST ONE ADMITTED ROW, AND THAT NARROWING IS THE SAME
   * SHAPE AS C17's. A side where EVERY row refused produces a rate of 10000
   * basis points, which exceeds every LEGAL ceiling (the upper bound is
   * exclusive), so without this narrowing a wholly-refused population would
   * always refuse the run — and refusing DELETES THE RESIDUE, which for a
   * wholly-refused population is the only output there is.
   * `unclassifiedFieldFailsClosed` is the corpus scenario whose entire point is
   * that a G106 refusal lands in the residue WITH ITS REASON ATTACHED. So the
   * two conditions are two different pathologies and they get two different
   * answers: this arm refuses a MISLEADING LEDGER (one exists, over a minority),
   * and `population_wholly_refused` REPORTS the case where there is no ledger to
   * mislead anybody with. The discontinuity between 99% and 100% is real and is
   * named here rather than discovered later.
   *
   * ⚠️ `sideRowCount` COUNTS ROWS ON THE WHOLE SIDE. C18's arms carry
   * `documentRowCount`, which counts rows in ONE DOCUMENT. Nothing may sum, max,
   * average or render "rows presented" across arms of this union: they are
   * different denominators and one field name for both would be §5.3 inverted.
   *
   * IT CARRIES BOTH OPERANDS AND THE CEILING because refusing discards the
   * result, and with it `admissionRates` — so the refusal has to be the evidence
   * an operator reads. A refusal saying only *"too many rows refused"* would
   * leave "read the rate" with nothing to read.
   */
  | {
      kind: 'admission_refusal_rate_above_ceiling'
      refusedCount: number
      sideRowCount: number
      ceilingBasisPoints: number
    }
  /**
   * C18. A trailer that declared neither a count nor a total. Degenerate;
   * admitting it would make the `declared` arm meaningless — the arm asserts a
   * trailer was FOUND, and a trailer asserting nothing is a parser that found a
   * row it could not read rather than a file that checked itself.
   */
  | { kind: 'control_total_declared_nothing'; sourceDocumentId: SourceDocumentId }
  /**
   * C18. THE TRUNCATED-SHRED DETECTOR, and the trailer-as-transaction detector.
   * Compared against rows PRESENTED, never rows admitted — a truncated file and
   * an unreadable row are different defects and keying one check on both is
   * §5.1.
   */
  | {
      kind: 'declared_line_count_disagrees'
      sourceDocumentId: SourceDocumentId
      declaredCount: number
      documentRowCount: number
    }
  /**
   * C18. ⚠️ THE ARM THAT MAKES THE TOTAL CHECK HONEST. A refused row has no
   * readable amount, so a sum over the admitted rows of a partially-refused
   * document is NOT the file's total, and comparing it produces a wrong verdict
   * in either direction. The engine says it cannot verify. Silently skipping the
   * comparison here is the C13 defect at document grain.
   */
  | {
      kind: 'control_total_unverifiable_rows_refused'
      sourceDocumentId: SourceDocumentId
      documentRowCount: number
      admittedCount: number
    }
  /**
   * C18. `sumGross`/`compareMoney` refused. The reachable case is a trailer
   * denominated differently from the declared unit — a real finding that must
   * not be reported as a mismatch, because the two numbers were never
   * comparable. C16 is what makes this distinguishable at all: the declaration
   * exists to be compared against.
   */
  | { kind: 'control_total_not_evaluable'; sourceDocumentId: SourceDocumentId; refusal: MoneyRefusal }
  /**
   * C18. The file's own arithmetic disagrees with the file's own rows.
   *
   * 🛑 THE EXPONENT IS CARRIED, in the one control whose entire subject is a
   * hundredfold error. `gross_not_partitioned` can omit it because one run is one
   * unit by construction; this arm is emitted PER DOCUMENT into a
   * multi-document array, where that is not true. Minor units and never a
   * `Money`: `Money.currency` is a `string`, so the containment proof forbids it
   * — the same reason `MoneyRefusal` carries no currency.
   */
  | {
      kind: 'declared_control_total_disagrees'
      sourceDocumentId: SourceDocumentId
      /* ⚠️ `bigint` SINCE 19 Sep 2026 — G286. BOTH MINOR FIELDS, AND NEITHER
       * EXPONENT. A minor-unit figure derived from a `Money` is money and
       * carries money's representation; an exponent is a power of ten in single
       * digits and is not. Splitting the two here rather than retyping the whole
       * arm is the same distinction `MoneyUnit` draws. */
      declaredMinor: bigint
      declaredExponent: number
      admittedMinor: bigint
      admittedExponent: number
    }
  /**
   * C18. The parser's arm disagrees with the type's declaration — the control the
   * checked component would otherwise be able to switch off. Both directions are
   * defects: a type declared `always` whose parser reports
   * `not_declared_by_format` is a shredder that stopped reading trailers, and a
   * type declared `never` whose parser produced one is a mapping nobody updated.
   */
  | { kind: 'control_total_arm_disagrees_with_document_type'; sourceDocumentId: SourceDocumentId }

/**
 * 🟢 THE CONTAINMENT PROOF, ON A UNION THAT NAMES DOCUMENTS.
 *
 * ⚠️ VERIFY IT RED BEFORE TRUSTING IT GREEN, and `Assert<never>` compiles, so a
 * vacuous proof is indistinguishable from a real one by reading. Add
 * `filename: string` to any arm and `tsc` must report TS2344. A branded
 * `SourceDocumentId` passes (`model/kernel.ts:43`; the `T extends string ? T`
 * arm at `NoTextField` exists precisely for it) while a raw filename cannot —
 * which is the distinction that matters here, because a filename is
 * counterparty-controlled and these defects will be logged.
 *
 * ⚠️ AND READ `CLAUDE.md` ON WHAT THIS PROVES: it bans the TYPE `string` at a
 * property position, not string-bearing values. It is a deny-list on one type
 * constructor, not a proof that the union carries no text.
 */
export type _PopulationDefectHoldsNoTextDeep = AssertNoTextDeep<PopulationDefect>

/**
 * Value-level mirror of the union's discriminant, in the module's own idiom
 * (`SCOPE_DIMENSION_ORDER`, `model/learning.ts:2171`).
 *
 * `satisfies` proves every member LISTED is a real kind. It does not prove the
 * list is COMPLETE — `_EveryPopulationDefectKindIsListed` below is what fails to
 * compile when a second kind is added and forgotten here, and the export-surface
 * suite is what fails when a listed kind has no fixture exercising it.
 */
export const POPULATION_DEFECT_KINDS = [
  'duplicate_item_address',
  'admission_refusal_rate_above_ceiling',
  'control_total_declared_nothing',
  'declared_line_count_disagrees',
  'control_total_unverifiable_rows_refused',
  'control_total_not_evaluable',
  'declared_control_total_disagrees',
  'control_total_arm_disagrees_with_document_type',
] as const satisfies readonly PopulationDefect['kind'][]

export type _EveryPopulationDefectKindIsListed =
  [PopulationDefect['kind']] extends [(typeof POPULATION_DEFECT_KINDS)[number]] ? true : never

/**
 * 🛑 C18's CENTRAL RULING, WRITTEN AS A DECLARATION RATHER THAN AS AN `if`.
 *
 * ONLY C17 REFUSES. The five comparison defects are POST-CONDITIONS reported
 * beside a sound ledger, and this is the decision that most shapes C18. Both of
 * a trailer's operands — `lineCount` and `total` — are counterparty-controlled
 * content parsed from the file's LAST ROW. `SetReconciliationOutcome`'s
 * `ok: false` arm carries no residue, no `refusedAtAdmission`, no ambiguities
 * and no reader requests, in the module whose §6 banner is *"RESIDUE — the
 * product"*. So a supplier writing `lineCount: 41` on a 40-row file would
 * discard the OTHER side's admitted rows too: a one-cell kill switch on the whole
 * close, handed to the party being reconciled against. A comparison failure has
 * to be reported beside a ledger, never instead of one.
 *
 * C17 is the opposite case and the contrast is the argument: an address
 * collision has no sound ledger to report beside, because the fold would eat a
 * row before any post-condition could see it.
 *
 * 🛑 C13 IS THE SECOND REFUSING KIND, AND IT DOES NOT WEAKEN THE RULING ABOVE.
 * The ruling turns on WHO CONTROLS THE OPERAND. A trailer's `lineCount` and
 * `total` are counterparty-controlled content parsed from a file's last row, so
 * refusing on them hands the party being reconciled against a one-cell kill
 * switch on the whole close. C13's operand is the OPERATOR'S OWN stated ceiling,
 * compared against a rate the ENGINE observed — nothing a supplier writes in a
 * file chooses the threshold. A supplier can still drive the rate up by sending
 * unreadable rows; what they cannot do is decide the number at which the close
 * stops, and that is the difference the split is drawn on.
 *
 * A total `Record` and not a lookup: an unclassified defect kind is a compile
 * error, so the next arm somebody adds cannot default into either bucket by
 * omission. `CAPABILITY_RESOURCE_CLASS` and `TOOL_EFFECT` exist for this.
 */
export const POPULATION_DEFECT_DISPOSITION = {
  duplicate_item_address: 'refuse',
  admission_refusal_rate_above_ceiling: 'refuse',
  control_total_declared_nothing: 'report',
  declared_line_count_disagrees: 'report',
  control_total_unverifiable_rows_refused: 'report',
  control_total_not_evaluable: 'report',
  declared_control_total_disagrees: 'report',
  control_total_arm_disagrees_with_document_type: 'report',
} as const satisfies Record<PopulationDefect['kind'], 'refuse' | 'report'>

/**
 * Which file do I re-cut. C17 addresses a document through an `ItemRef` because
 * a collision is an address; C18's six name it directly because a trailer is a
 * property of the file. A caller should not have to know which of the two
 * spellings an arm happens to use.
 *
 * 🛑 IT RETURNS `null` SINCE C13, AND THE NULL IS A STATEMENT RATHER THAN AN
 * ABSENCE. ⚠️ This function's own docblock read *"Every population defect names
 * ONE document"* and C13 ended that. A refusal rate is a property of the SIDE:
 * the rows came from every document on it, and naming one of them would be a
 * claim about which file caused a rate. `null` says *"this defect has no one
 * file to re-cut"* — the side, on the envelope, is the whole address it has.
 * Returning a document here would be worse than returning nothing, because a
 * caller would act on it.
 */
export function defectDocument(defect: PopulationDefect): SourceDocumentId | null {
  if (defect.kind === 'duplicate_item_address') return defect.ref.sourceDocumentId
  if (defect.kind === 'admission_refusal_rate_above_ceiling') return null
  return defect.sourceDocumentId
}

/**
 * Everything §4a needs, named rather than positional. Four arguments in a row is
 * how `side` and one of the two item arrays get transposed by somebody in a
 * hurry, and transposing `admitted` with `refused` here would silently invert
 * the at-least-one-admitted narrowing.
 *
 * ⚠️ IT CARRIED NO `documents` FIELD UNTIL C18, DELIBERATELY — C17 has nothing to
 * do with a document; it reads addresses, which admission has already derived,
 * and a field no branch reads is a field a caller can populate wrongly with no
 * consequence. C18 is the addition that was named there: it compares what the
 * FILE declared against what the DOCUMENT presented, so it needs both documents
 * and the type's own declaration, and both arrive as named fields rather than as
 * a fifth and sixth positional argument.
 */
export interface PopulationIntegrityInput {
  readonly side: PopulationSide
  readonly admitted: readonly AdmittedItem[]
  readonly refused: readonly RefusedItem[]
  /**
   * C18. The documents this population was admitted from, in supplied order —
   * the same array `admitPopulation` was handed, so the two counts are taken
   * over the same set.
   */
  readonly documents: readonly ReconciliationDocument[]
  /**
   * C18. `PopulationBinding.carriesControlTotal`, passed through rather than
   * re-derived. This is the TYPE's declaration; each document carries the
   * PARSER's. A disagreement between them is itself a defect.
   */
  readonly carriesControlTotal: 'always' | 'never'
  /**
   * C13. The operator's stated ceiling on the admission refusal rate, integer
   * basis points. Validated at the gate in `runSetReconciliation`, which refuses
   * an absent, non-integer, negative or `>= 10000` value before any population
   * is folded — so this function may compare against it rather than re-deriving
   * a policy it does not own.
   */
  readonly admissionRefusalCeilingBasisPoints: number
}

/**
 * Every population-grain defect, in a fixed order. Pure, total, no clock, no
 * throw — the same contract as `checkPostconditions()`, whose shape this copies
 * rather than inventing a second integrity idiom.
 *
 * 🛑 ORDER IS PART OF THE CONTRACT AND THE EARLY RETURN IS WHAT MAKES IT TRUE.
 * C17 is first and it RETURNS: an address collision makes every later count
 * wrong. A document listed twice with a declared trailer would otherwise report
 * `duplicate_item_address` PLUS a false line-count disagreement (2N against N)
 * PLUS a false control-total disagreement (the sum doubled) — two of three
 * false, beside one true. Whoever adds C18's checks adds them BELOW the early
 * return, not above it.
 */
export function checkPopulationIntegrity(
  input: PopulationIntegrityInput,
): readonly PopulationDefect[] {
  const defects: PopulationDefect[] = []

  /* --- C17: one address, one row, and at least one copy ADMITTED. --- */
  const admittedAt = new Set<string>()
  for (const item of input.admitted) admittedAt.add(itemKey(input.side, item.ref))

  const occurrences = new Map<string, number>()
  const firstRef = new Map<string, ItemRef>()
  for (const ref of [
    ...input.admitted.map((item) => item.ref),
    ...input.refused.map((item) => item.ref),
  ]) {
    const key = itemKey(input.side, ref)
    occurrences.set(key, (occurrences.get(key) ?? 0) + 1)
    if (!firstRef.has(key)) firstRef.set(key, ref)
  }
  for (const [key, count] of occurrences) {
    if (count <= 1) continue
    if (!admittedAt.has(key)) continue
    const ref = firstRef.get(key)
    /* Unreachable: `firstRef` is written on the same pass as `occurrences`.
     * `noUncheckedIndexedAccess` makes the read `ItemRef | undefined` and a
     * non-null assertion here would be the model asserting over its own map. */
    if (ref === undefined) continue
    defects.push({ kind: 'duplicate_item_address', ref, occurrences: count })
  }
  if (defects.length > 0) return defects

  /* --- C13: how much of this side admission could not read. ---
   *
   * BELOW C17's early return, because a duplicated address makes every count on
   * this side wrong, and ABOVE C18's per-document loop, because this is a
   * property of the SIDE and those are properties of a FILE.
   *
   * NO EARLY RETURN OF ITS OWN, and the contrast with C17 is the reason: a
   * collision invalidates the counts below it, while a refusal rate invalidates
   * nothing — the trailer comparisons over whatever DID parse stay true. The
   * caller filters on `POPULATION_DEFECT_DISPOSITION` and discards the reports
   * when it refuses; that is its decision to make, not this function's. */
  const sideRowCount = presentedRowsOnSide(input.documents)
  const refusedCount = input.refused.length
  const ceilingBasisPoints = input.admissionRefusalCeilingBasisPoints
  if (
    /* No denominator, no rate. An EMPTY population is O-15's case and not this
     * one, and a direct caller that supplied no documents has stated no side to
     * take a rate over. */
    sideRowCount > 0 &&
    /* THE NARROWING. Nothing was admitted, so there is no ledger over a minority
     * to refuse — see the arm's own declaration. `population_wholly_refused`
     * covers it, beside a residue that survives. */
    input.admitted.length > 0 &&
    refusedCount * 10_000 > ceilingBasisPoints * sideRowCount
  ) {
    defects.push({
      kind: 'admission_refusal_rate_above_ceiling',
      refusedCount,
      sideRowCount,
      ceilingBasisPoints,
    })
  }

  /* --- C18: what the FILE said about itself, against what it presented. ---
   *
   * Per document, in supplied order. Everything below the early return may
   * assume one row per address, which is what makes these counts meaningful:
   * a document listed twice would otherwise report `duplicate_item_address`
   * PLUS a false 2N-against-N line count PLUS a false doubled total. */
  const admittedByDocument = new Map<SourceDocumentId, AdmittedItem[]>()
  for (const item of input.admitted) {
    const bucket = admittedByDocument.get(item.ref.sourceDocumentId)
    if (bucket === undefined) admittedByDocument.set(item.ref.sourceDocumentId, [item])
    else bucket.push(item)
  }
  const refusedByDocument = new Map<SourceDocumentId, number>()
  for (const item of input.refused) {
    const id = item.ref.sourceDocumentId
    refusedByDocument.set(id, (refusedByDocument.get(id) ?? 0) + 1)
  }

  for (const document of input.documents) {
    const control = document.controlTotal
    const sourceDocumentId = document.id

    /* The TYPE's declaration against the PARSER's arm. A parser reporting
     * `not_declared_by_format` for a format declared to carry one is a shredder
     * that stopped reading trailers — the thing that would otherwise switch this
     * whole control off silently. */
    const parserFoundOrLookedForOne = control.kind !== 'not_declared_by_format'
    if (parserFoundOrLookedForOne !== (input.carriesControlTotal === 'always')) {
      defects.push({ kind: 'control_total_arm_disagrees_with_document_type', sourceDocumentId })
    }

    /* `expected_but_absent` is the RUN refusal and it is taken by the caller,
     * before admission, because it needs no admission output. It is skipped here
     * rather than reported: a defect for it would be a second vocabulary for one
     * condition (§5.3), and this function's contract is that everything it
     * returns is reported beside a ledger. */
    if (control.kind !== 'declared') continue

    if (control.lineCount === null && control.total === null) {
      defects.push({ kind: 'control_total_declared_nothing', sourceDocumentId })
      continue
    }

    const documentRowCount = presentedRowCount(document)
    if (control.lineCount !== null && control.lineCount !== documentRowCount) {
      defects.push({
        kind: 'declared_line_count_disagrees',
        sourceDocumentId,
        declaredCount: control.lineCount,
        documentRowCount,
      })
    }

    const declaredTotal = control.total
    if (declaredTotal === null) continue

    const admittedHere = admittedByDocument.get(sourceDocumentId) ?? []
    const refusedHere = refusedByDocument.get(sourceDocumentId) ?? 0
    if (refusedHere > 0) {
      /* NOT a disagreement verdict. A refused row has no readable amount, so a
       * sum over what was admitted is not this file's total and comparing it
       * would be wrong in whichever direction the missing rows happened to
       * point. The engine says it cannot verify — and it says so rather than
       * skipping, because a skipped comparison is a control that reports health
       * it never established. */
      defects.push({
        kind: 'control_total_unverifiable_rows_refused',
        sourceDocumentId,
        documentRowCount,
        admittedCount: admittedHere.length,
      })
      continue
    }

    const summed = sumGross(admittedHere)
    if (!summed.ok) {
      defects.push({ kind: 'control_total_not_evaluable', sourceDocumentId, refusal: summed.refusal })
      continue
    }
    /* THE UNIT CHECK IS INSIDE `compareMoney`, and it is why C16 went first. A
     * trailer denominated differently from the rows is a NAMED refusal here, not
     * a mismatch verdict — comparing 1,234.56 against 123456 across exponents
     * would report a hundredfold error that is really a mapping error. */
    const verdict = compareMoney(declaredTotal, summed.value)
    if (!verdict.ok) {
      defects.push({ kind: 'control_total_not_evaluable', sourceDocumentId, refusal: verdict.refusal })
      continue
    }
    if (verdict.value !== 0) {
      defects.push({
        kind: 'declared_control_total_disagrees',
        sourceDocumentId,
        declaredMinor: minorUnitsOf(declaredTotal),
        declaredExponent: declaredTotal.exponent,
        admittedMinor: minorUnitsOf(summed.value),
        admittedExponent: summed.value.exponent,
      })
    }
  }

  return defects
}

/* -------------------------------------------------------------------- *
 * §4b  G236 — WHAT EVERY FILE SAID ABOUT ITSELF, INCLUDING THE ONES THAT
 *      WERE RIGHT
 *
 * 🛑 THE RULING IS THE WORD *UNCONDITIONALLY*. C18 records a control-total
 * DISAGREEMENT as a `PopulationDefect`; a document whose declared count and
 * declared total both MATCH produces no defect and therefore appears in no
 * channel at all. So the engine's per-document account was a check that spoke
 * only when it failed — the exception to a posture this module holds everywhere
 * else. G114: *a bound that was hit is recorded, never silently absorbed.* C13
 * made `admissionRates` unconditional for the same reason one grain up.
 *
 * 🛑 AND THE COST OF THE MISSING ROW IS EXACT, WHICH IS WHY THIS IS NOT TIDINESS.
 * **A met trailer that produces no row is indistinguishable from a file that
 * declared nothing** — the operator cannot tell *"this file vouched for itself
 * and was right"* from *"this file said nothing"*, and the first is EVIDENCE
 * while the second is ABSENCE. `design/routes/close.html`'s panel *What each
 * file said about itself* draws both, side by side, and could not be built from
 * this module's result.
 *
 * ⚠️ **THAT CITATION IS AN ARCHIVE CITATION AND THE PANEL HAS NO PACK HOME.**
 * G264 deleted `design/routes/`; the sheet resolves at
 * `git show archive/pre-handoff-pack:design/routes/close.html`. **It is NOT
 * re-pointed, because there is nothing to re-point it to** —
 * `grep -ni 'control total\|said about itself\|trailer' docs/handoff-pack/*.dc.html`
 * returns nothing, so the north star draws no such panel. **A citation
 * re-pointed to an approximate home is worse than one left at the tag and
 * labelled**, because the next reader trusts it. The CALLER OBLIGATION the
 * paragraph below rests on — *"the drawn table IS the caller obligation"* —
 * therefore rests on a drawing the current design record does not carry, and
 * that is the finding rather than the citation. **Reported, not repaired:
 * either the pack draws the panel or C18's objection is reopened.**
 *
 * ⚠️ C18 REFUSED A THIRD RESULT CHANNEL ONCE — `populationFindings`, on the
 * ground that *"a channel with no caller obligation is C13 one layer up"* — and
 * the objection is ANSWERED here rather than ignored, in the idiom O-16 already
 * used for `completeness`. **The drawn table IS the caller obligation.** A
 * channel whose consumer is already drawn is not a channel with no caller.
 *
 * ⚠️ AND G195 IS NOT CONTRADICTED. G195 rejected a file's own declared control
 * total as the ARRIVALS DENOMINATOR, saying in its own text that this answers a
 * *document* question where the open one was a *population* question. This
 * answers the document question. Different denominators; both rulings stand.
 * -------------------------------------------------------------------- */

/**
 * What the comparison concluded about ONE file.
 *
 * 🛑 IT RE-DECLARES NONE OF C18's SIX COMPARISON ARMS. The disagreeing case
 * carries `PopulationDefect` VERBATIM. Spelling `declaredCount` and
 * `documentRowCount` again here would be two vocabularies for one finding,
 * drifting the first time an arm gained a field — §5.3, the shape this record
 * has seen recur most, and the same argument `PostconditionFailure` and
 * `CompletenessFinding` already make about carrying the defect whole.
 */
export type DocumentTrailerVerdict =
  /**
   * The format carries no trailer, so there was nothing to compare. NOT the same
   * as `agreed`, and collapsing the two is the exact conflation G236 forbids one
   * level down: a file that said nothing is not a file that vouched for itself.
   */
  | { kind: 'nothing_to_check' }
  /**
   * THE ARM THE RULING EXISTS FOR. A trailer was declared and every comparison
   * C18 ran over it passed. Before G236 this row did not exist anywhere.
   */
  | { kind: 'agreed' }
  /** One or more of C18's arms fired on this document, carried whole. */
  | { kind: 'reported'; defects: readonly PopulationDefect[] }
  /**
   * C17 fired somewhere on this side, so `checkPopulationIntegrity` returned
   * before any per-document comparison ran and there is no verdict to report.
   *
   * 🛑 IT IS A NAMED STATE AND NOT AN OMITTED ROW, for G236's own reason. An
   * address collision makes every count on the side wrong — a document listed
   * twice reports 2N against N and a doubled total — so reporting `agreed` here
   * would be a MANUFACTURED met trailer, which is worse than the silence the
   * ruling is fixing. Dropping the document from the array instead would be the
   * silence itself.
   *
   * ⚠️ UNREACHABLE THROUGH `runSetReconciliation`, said plainly rather than
   * implied by coverage: `POPULATION_DEFECT_DISPOSITION.duplicate_item_address`
   * is `'refuse'`, so a run that collided produced no result to carry this. It
   * exists because `documentAccounts()` is exported and callable directly, in the
   * idiom `MoneyRefusal.no_items` already uses in this module.
   */
  | { kind: 'not_evaluated_address_collision' }

/**
 * 🟢 THE CONTAINMENT PROOF. ⚠️ VERIFY IT RED BEFORE TRUSTING IT GREEN — add
 * `filename: string` to any arm and `tsc` must report TS2344. It holds only
 * because `PopulationDefect` carries its own proof; the `reported` arm inherits
 * it rather than restating it.
 */
export type _DocumentTrailerVerdictHoldsNoTextDeep = AssertNoTextDeep<DocumentTrailerVerdict>

/**
 * ONE FILE'S ACCOUNT OF ITSELF, emitted for every document on every successful
 * run whatever the comparison concluded.
 *
 * 🛑 A `SourceDocumentId` AND NEVER A FILENAME. A filename is
 * counterparty-controlled and this record is rendered and logged (invariant 6);
 * `_RunDocumentAccountHoldsNoTextDeep` is what makes that structural rather than
 * a review convention.
 *
 * 🛑 MINOR UNITS AND AN EXPONENT, NEVER A `Money`. `Money.currency` is a bare
 * `string`, so the containment proof forbids it — the same reason
 * `declared_control_total_disagrees` carries the pair and `MoneyRefusal` carries
 * no currency. The exponent is carried because this record is emitted PER
 * DOCUMENT into a multi-document array, where "one run is one unit" is not a
 * property anybody may lean on.
 *
 * ⚠️ `presented` IS `presentedRowCount(document)` AND `admitted + refused` IS THE
 * ADMISSION FOLD, and the two are independent on purpose — the same property
 * `AdmissionRate` states at side grain, taken at document grain, so
 * `presented === admitted + refused` stays something a caller can CHECK rather
 * than a tautology it is handed. `presentedRowCount` already existed and was
 * already called; the fold simply discarded it.
 */
export interface RunDocumentAccount {
  readonly side: PopulationSide
  readonly sourceDocumentId: SourceDocumentId
  /**
   * The PARSER's arm, verbatim. `expected_but_absent` is unreachable on a
   * produced result — `runSetReconciliation` refuses it in the gate — and the
   * field is typed over the whole union rather than an `Exclude<>` for
   * `TerminalRunStatus`'s stated reason: an `Exclude` silently widens to admit a
   * new arm, where the full union makes a new arm a decision somebody has to
   * take here.
   */
  readonly trailer: ControlTotal['kind']
  /** Null where no trailer was found, or where one was found declaring no count. */
  readonly declaredLineCount: number | null
  /** ⚠️ `bigint` since 19 Sep 2026 — G286. It is a `Money`'s minor units. */
  readonly declaredMinor: bigint | null
  readonly declaredExponent: number | null
  /** Rows the DOCUMENT presented — `presentedRowCount`, one rule, four callers. */
  readonly presented: number
  readonly admitted: number
  readonly refused: number
  readonly verdict: DocumentTrailerVerdict
}

/**
 * 🟢 THE CONTAINMENT PROOF, ON A RECORD THAT NAMES DOCUMENTS. ⚠️ VERIFY IT RED —
 * add `filename: string` and `tsc` must report TS2344. A branded
 * `SourceDocumentId` passes; a raw filename cannot, and that is the distinction
 * that matters, because this record exists to be rendered.
 */
export type _RunDocumentAccountHoldsNoTextDeep = AssertNoTextDeep<RunDocumentAccount>

/**
 * G236 — one account per document, in supplied order, unconditionally.
 *
 * 🛑 IT TAKES THE DEFECTS RATHER THAN RECOMPUTING THEM, AND THAT IS THE WHOLE
 * SHAPE OF THIS FUNCTION. Re-running C18's comparisons here to decide a verdict
 * would be a second implementation of the check, and two implementations agree
 * until somebody edits one — the module would then report a verdict that
 * disagrees with its own `postconditions` about the same file. One comparison,
 * two grains of report: `checkPopulationIntegrity` decides, this folds.
 *
 * ⚠️ IT IS THEREFORE ONLY AS TRUE AS THE DEFECT LIST IT IS HANDED. Pass the
 * defects from the SAME `checkPopulationIntegrity(input)` call, on the SAME
 * input — `runSetReconciliation` hoists one object and hands it to both for
 * exactly this reason. Handing it a filtered list would manufacture `agreed`
 * rows, which is the failure G236 exists to end.
 *
 * ⚠️ A DEFECT THAT NAMES NO DOCUMENT IS NOT DROPPED SILENTLY — it is not this
 * record's to carry. `defectDocument()` returns `null` for C13's rate, which is a
 * property of the SIDE, and `admissionRates` is where a side reports itself.
 * Attributing a rate to one file would be a claim about which file caused it.
 */
export function documentAccounts(
  input: PopulationIntegrityInput,
  defects: readonly PopulationDefect[],
): readonly RunDocumentAccount[] {
  const collided = defects.some((defect) => defect.kind === 'duplicate_item_address')

  const admittedByDocument = new Map<SourceDocumentId, number>()
  for (const item of input.admitted) {
    const id = item.ref.sourceDocumentId
    admittedByDocument.set(id, (admittedByDocument.get(id) ?? 0) + 1)
  }
  const refusedByDocument = new Map<SourceDocumentId, number>()
  for (const item of input.refused) {
    const id = item.ref.sourceDocumentId
    refusedByDocument.set(id, (refusedByDocument.get(id) ?? 0) + 1)
  }
  const defectsByDocument = new Map<SourceDocumentId, PopulationDefect[]>()
  for (const defect of defects) {
    /* The join is `defectDocument()` and not a `kind ===` chain, so an arm added
     * to `PopulationDefect` reaches this table by declaring its address once. */
    const id = defectDocument(defect)
    if (id === null) continue
    const bucket = defectsByDocument.get(id)
    if (bucket === undefined) defectsByDocument.set(id, [defect])
    else bucket.push(defect)
  }

  const accounts: RunDocumentAccount[] = []
  for (const document of input.documents) {
    const control = document.controlTotal
    const declaredTotal = control.kind === 'declared' ? control.total : null
    const here = defectsByDocument.get(document.id) ?? []
    const verdict: DocumentTrailerVerdict = collided
      ? { kind: 'not_evaluated_address_collision' }
      : here.length > 0
        ? { kind: 'reported', defects: here }
        : control.kind === 'declared'
          ? { kind: 'agreed' }
          : { kind: 'nothing_to_check' }

    accounts.push({
      side: input.side,
      sourceDocumentId: document.id,
      trailer: control.kind,
      declaredLineCount: control.kind === 'declared' ? control.lineCount : null,
      declaredMinor: declaredTotal === null ? null : minorUnitsOf(declaredTotal),
      declaredExponent: declaredTotal === null ? null : declaredTotal.exponent,
      presented: presentedRowCount(document),
      admitted: admittedByDocument.get(document.id) ?? 0,
      refused: refusedByDocument.get(document.id) ?? 0,
      verdict,
    })
  }
  return accounts
}

/* ==================================================================== *
 * §5  THE LEDGER, AND WHAT A PASS MAY DO TO IT
 *
 * ALLOCATION STATE LIVES IN AN APPEND-ONLY LEDGER, NEVER AS A MUTABLE FIELD ON
 * AN INPUT RECORD. The draft did `datasetA.forEach(r => r.residualAmount = …)`
 * — it mutated its caller's arrays, which is A9(e), and it stored a residual
 * beside the allocations that produce it, which drifts. `residualOf()` and
 * `settlementOf()` are DERIVED by folding allocations. This matches the model's
 * posture everywhere else: `UsageRecord` append-only, `Explanation` stored not
 * derived, `Exception.reversals` an array and not a flag.
 *
 * ⚠️ ONE CONSEQUENCE OF DERIVING, STATED BECAUSE IT INVALIDATES AN OBVIOUS
 * TEST. If residual is derived by folding allocations, then
 * `gross = residual + Σ allocations` is `gross = gross` — it cannot fail, on any
 * input, ever, and it does NOT catch A9(b). Under an append-only ledger "the
 * payments are marked spent" means the item was dropped from the RESIDUE
 * without an allocation, and the identity still holds because the money is lost
 * from the residue and not from the ledger. **The load-bearing post-condition is
 * RESIDUE COMPLETENESS, not conservation** — see §9. This is the single most
 * useful correction the red team made and it is recorded rather than absorbed.
 * ==================================================================== */

export type SimilarityMetric = 'levenshtein_ratio' | 'jaro_winkler'

export type PairingEvidence =
  | { kind: 'exact_identifier'; on: FieldPath }
  | { kind: 'tolerant_identifier'; on: FieldPath; signedVarianceMinor: bigint }
  | { kind: 'amount_and_date'; dayGap: number }
  /**
   * G105's first half: an exact combination of open obligations summing to the
   * payment is what the counterparty INTENDED to pay, and it is a MATCH.
   */
  | { kind: 'amount_sum_exact'; memberCount: number }
  /**
   * G105's second half, and the distinction is the whole ruling: the waterfall
   * is a JUDGEMENT the firm makes about cash it cannot attribute. The audit
   * trail must not confuse the two, so the fall-through is recorded ON THE ROW
   * and never inferred from its absence. G105: "silently truncating the search
   * would make an allocation look like a match".
   */
  | { kind: 'amount_sum_waterfall'; fellThroughFrom: 'budget_exhausted' | 'no_exact_solution' }
  | { kind: 'fuzzy_reference'; similarityBasisPoints: number; metric: SimilarityMetric }
  /** §7. Never auto-applied above `AutonomyConfig`; the caller decides. */
  | { kind: 'reader_confirmed'; confidenceBasisPoints: number; modelEntryId: ModelCatalogEntryId }

export interface Allocation {
  readonly ordinal: number
  /** Item the value came OUT of. */
  readonly fromKey: string
  /** Item the value went INTO. */
  readonly toKey: string
  readonly amount: Money
  readonly evidence: PairingEvidence
}

export interface MatchingState {
  readonly items: ReadonlyMap<string, AdmittedItem>
  readonly allocations: readonly Allocation[]
}

/**
 * ⚠️ THERE IS DELIBERATELY NO `over_allocated` MEMBER. §5.5 says do not make the
 * invalid state legal. Over-allocation is a REFUSAL from `applyAllocation()`
 * carrying both numbers, not a state something can be left in.
 */
export type ItemSettlement =
  | { kind: 'unallocated'; residual: Money }
  | { kind: 'partially_allocated'; allocated: Money; residual: Money }
  | { kind: 'fully_allocated'; allocated: Money }

export function allocatedOf(state: MatchingState, key: string): MoneyResult<Money> {
  const item = state.items.get(key)
  if (item === undefined) return { ok: false, refusal: { kind: 'currency_mismatch' } }
  let total = zeroLike(item.gross)
  for (const allocation of state.allocations) {
    if (allocation.fromKey !== key && allocation.toKey !== key) continue
    const sum = addMoney(total, allocation.amount)
    if (!sum.ok) return sum
    total = sum.value
  }
  return { ok: true, value: total }
}

export function residualOf(state: MatchingState, key: string): MoneyResult<Money> {
  const item = state.items.get(key)
  if (item === undefined) return { ok: false, refusal: { kind: 'currency_mismatch' } }
  const allocated = allocatedOf(state, key)
  if (!allocated.ok) return allocated
  return subtractMoney(item.gross, allocated.value)
}

/**
 * A half-paid obligation is therefore distinguishable in three independent
 * places — its settlement, its residue entry, and the signed variance on its
 * allocations — and in NONE of them by a boolean somebody can forget to set.
 * That is A9(c).
 */
export function settlementOf(state: MatchingState, key: string): MoneyResult<ItemSettlement> {
  const allocated = allocatedOf(state, key)
  if (!allocated.ok) return allocated
  const residual = residualOf(state, key)
  if (!residual.ok) return residual
  if (isZeroMoney(allocated.value)) {
    return { ok: true, value: { kind: 'unallocated', residual: residual.value } }
  }
  if (isZeroMoney(residual.value)) {
    return { ok: true, value: { kind: 'fully_allocated', allocated: allocated.value } }
  }
  return {
    ok: true,
    value: {
      kind: 'partially_allocated',
      allocated: allocated.value,
      residual: residual.value,
    },
  }
}

export type AllocationRefusal =
  | { kind: 'unknown_item' }
  | { kind: 'same_side' }
  | { kind: 'non_positive_amount' }
  | { kind: 'would_over_allocate'; requestedMinor: bigint; residualMinor: bigint }
  | { kind: 'money'; refusal: MoneyRefusal }

export type _AllocationRefusalHoldsNoText = AssertNoTextDeep<AllocationRefusal>

export type AllocationOutcome =
  | { ok: true; state: MatchingState }
  | { ok: false; refusal: AllocationRefusal }

/**
 * Appends one allocation, or refuses. Never mutates `state`.
 *
 * `fully_allocated` is ABSORBING — residual is monotonically non-increasing,
 * because nothing here removes an allocation. That is what makes the `first
 * strategy that pairs wins` rule at `model/domain.ts:1948` a MONOTONICITY
 * PROPERTY OF THE FOLD rather than a convention a later pass could break, and
 * it is what makes a re-run replayable.
 */
export function applyAllocation(
  state: MatchingState,
  fromKey: string,
  toKey: string,
  amount: Money,
  evidence: PairingEvidence,
): AllocationOutcome {
  const from = state.items.get(fromKey)
  const to = state.items.get(toKey)
  if (from === undefined || to === undefined) return { ok: false, refusal: { kind: 'unknown_item' } }
  if (from.side === to.side) return { ok: false, refusal: { kind: 'same_side' } }
  const g = guardMoney(amount)
  if (g !== null) return { ok: false, refusal: { kind: 'money', refusal: g } }
  if (!isPositiveMoney(amount)) return { ok: false, refusal: { kind: 'non_positive_amount' } }

  for (const key of [fromKey, toKey]) {
    const residual = residualOf(state, key)
    if (!residual.ok) return { ok: false, refusal: { kind: 'money', refusal: residual.refusal } }
    const comparison = compareMoney(amount, residual.value)
    if (!comparison.ok) return { ok: false, refusal: { kind: 'money', refusal: comparison.refusal } }
    if (comparison.value > 0) {
      return {
        ok: false,
        refusal: {
          kind: 'would_over_allocate',
          requestedMinor: minorUnitsOf(amount),
          residualMinor: minorUnitsOf(residual.value),
        },
      }
    }
  }

  const appended: Allocation = {
    ordinal: state.allocations.length,
    fromKey,
    toKey,
    amount,
    evidence,
  }
  return { ok: true, state: { items: state.items, allocations: [...state.allocations, appended] } }
}

/* -------------------------------------------------------------------- *
 * Strategy bindings — the second stopgap, and the reason for it
 * -------------------------------------------------------------------- */

/**
 * Whether a fuzzy string comparison is anchored on an EXACT amount.
 *
 * THE GOLDEN RULE, in the type instead of a comment: if the string is blurry,
 * the amount must not be. Blurring both is O(N×M) and its false positives are
 * money moved to the wrong account.
 *
 * ⚠️ THIS IS A FALSE-POSITIVE CONTROL AND IT IS **NOT** THE CONTAINMENT BOUND.
 * The red team is right that promoting it to a security bound and then minting
 * `'within_tolerance'` gives a pack author an authorable opt-out from
 * containment — a configuration change that widens what the quarantined model
 * may be shown. So the two bounds are separated and only one is authorable:
 * `amountAnchor` tunes PAIRING, and the reader's candidate set is built under
 * an EXACT anchor ALWAYS, whatever this says, plus a hard numeric cap the
 * caller must state (§7). One knob a pack may turn, one it may not.
 */
export type AmountAnchor = 'exact' | 'within_tolerance'

/**
 * A `PairingStrategy` plus the per-strategy tolerance the model does not carry.
 *
 * ⚠️ WHY IT IS NEEDED, AND IT IS NOT COSMETIC. `PairingSpec`
 * (`model/domain.ts:1959`) carries ONE `amountTolerance` for the whole spec, so
 * an ordered strategy list CANNOT express "exact first, then tolerant" — the
 * draft's pass 1 and pass 2 are the same strategy KIND differing only in
 * tolerance. Without a per-strategy tolerance the multi-pass certainty ordering
 * the whole design rests on collapses into one tolerant pass, and the engine can
 * no longer say that an exact match is stronger evidence than a tolerant one.
 *
 * `amountTolerance: null` INHERITS `PairingSpec.amountTolerance` — the same
 * shape and the same reading as `MatchRule.when: RulePredicate | null`
 * (`model/domain.ts:1796`), a guard whose null means unguarded. Diff-plan DP-3.
 */
export interface StrategyBinding {
  readonly strategy: PairingStrategy
  readonly amountTolerance: Tolerance | null
  /** Read only by `fuzzy_reference`; stated for every binding so it is visible. */
  readonly amountAnchor: AmountAnchor
}

export interface AmbiguityFinding {
  readonly on: FieldPath | null
  readonly strategyKind: PairingStrategy['kind']
  readonly leftCandidates: number
  readonly rightCandidates: number
  readonly leftRefs: readonly ItemRef[]
  readonly rightRefs: readonly ItemRef[]
}

/* -------------------------------------------------------------------- *
 * §5b  THE TOLERANCE DECLINE — G291, 19 Sep 2026
 *
 * 🛑 THE RULING IS G114's OWN SENTENCE APPLIED TO A PLACE THAT DID NOT FOLLOW
 * IT: *"a bound that was hit is recorded, never silently absorbed."* This is not
 * a new rule. It is a rule this module states, enforces for the subset-sum
 * budget and the bucket width, and then breaks one pass over.
 *
 * WHAT WAS THERE. `passIdentifierJoin` executed a BARE `continue` on
 * `{ ok: true, admitted: false }` — the verdict that says *the comparison ran,
 * it produced a figure, and the figure is outside the tolerance.* Nothing was
 * pushed anywhere. `toleranceRefusals` carries only `{ ok: false }` verdicts,
 * which are MALFORMED tolerances — a float arm, a `days` arm, a wrong
 * denomination — and never declined ones. §6 then dispositioned every row in
 * that bucket `no_strategy_paired`, whose meaning is *nothing matched it*.
 *
 * Something matched it. The reference matched EXACTLY and the money did not.
 *
 * ⚠️ THE OPERATIONAL COST IS THE ARGUMENT AND IT IS NOT AESTHETIC. Those two
 * findings have two entirely different fixes. *Nothing matched* sends an
 * operator to audit their MATCHING RULES — the identifiers, the normalisation,
 * the counterparty mapping — and every hour of that is wasted when the true
 * answer is A TOLERANCE THAT IS TOO TIGHT, which is one number in one pack.
 * `control_total_unverified`'s own declaration already makes this argument
 * about itself, in the same words, for a different cause; the argument was in
 * the file and this pass was not covered by it.
 *
 * 🛑 WHY THIS IS A CHANNEL AND NOT ONLY A CAUSE, and it is the half that
 * decides the shape. `ResidueEntry.cause` is ONE SLOT and it is DOMINATED:
 * `control_total_unverified` outranks every matching verdict, and
 * `read_held_below_floor` outranks the rest. A decline that lived only there
 * would be absorbed — silently — by a file whose trailer did not reconcile,
 * which is the exact word G114 forbids. A channel fires whatever the row ends
 * up saying, which is also G217's rule about itself: *a channel that only
 * speaks when it fired cannot be told from one nobody wired up.*
 *
 * ✅ WHY NOT `toleranceRefusals`, WHICH ALREADY EXISTS. Because that channel
 * means *this tolerance is nonsense* and this one means *this tolerance was too
 * tight*, and the fixes are, again, different: the first is a pack that will
 * never match anything and the second is a pack matching less than its author
 * intended. Folding a decline into it would reproduce the defect G291 is about
 * ONE LEVEL UP — two findings, one channel — inside the fix for it. The type
 * system had already made the distinction and the reporting layer threw it
 * away: `ToleranceVerdict` is `{ ok: false }` against `{ ok: true, admitted:
 * false }`, and those are two different things.
 *
 * ✅ WHY NOT `SearchBoundary`, which is the closest-looking home. Its three
 * arrays are COST bounds — a bucket refused on a PREDICTED cost, a search cut
 * short on an OBSERVED one, a row skipped because its bucket was too wide — and
 * its own declaration says it answers *how was the search SHAPED*. A tolerance
 * is a VALUE bound: the engine did not stop looking, it looked, found the
 * counterparty, compared, and the money disagreed. That field's docblock
 * records that its predecessor was renamed because *"the fix for a field that
 * lies about its grain is a field with the right name"*; putting a value bound
 * under a name that says `searchBoundary` is the same defect chosen on purpose.
 *
 * ⚠️ AND WHY ONLY THIS PASS, stated because the next reader will check.
 * `passAmountAndDate` ALSO drops an `admitted: false` verdict on the floor —
 * and there it is the pass DOING ITS JOB. That pass scans every open right row
 * against every open left row; a decline is the ordinary outcome for almost all
 * of them, and recording one per comparison would emit an O(n²) channel that no
 * operator could read, which is a different way of telling them nothing. The
 * identifier join is different in kind: THE JOIN ALREADY SUCCEEDED. The
 * reference matched, the arity was permitted, and the only thing left was the
 * money. That is a bound being hit on a bucket somebody meant to pair, and it
 * is what this channel is about.
 *
 * 🛑 A STATED LIMIT, BECAUSE THIS CHANNEL DOES NOT SAY WHICH HALF DECLINED.
 * `toleranceAdmits` returns ONE boolean over TWO conditions — the magnitude is
 * inside the ceiling, AND the sign is one `toleranceDirection` permits — so a
 * bucket declined at `|variance| > ceiling` and a bucket declined because a
 * `left_greater_only` run met a right-greater variance arrive here identically.
 * Both are recoverable by a reader who has `signedVarianceMinor` and the run's
 * declared direction, and neither is NAMED. Separating them means widening
 * `ToleranceVerdict`'s `ok: true` arm, and every expectation for that function
 * is a hand-derived corpus vector — so it is a ruling with a corpus sweep behind
 * it, not a line of this one. Named here rather than left for somebody to
 * discover.
 * -------------------------------------------------------------------- */

/**
 * ONE BUCKET THE IDENTIFIER JOIN FOUND AND THE MONEY DECLINED — the shape, the
 * figure, and one address into it.
 *
 * `signedVarianceMinor` is `leftTotal − rightTotal` over the WHOLE bucket, the
 * sign convention `ToleranceDirection` declares once and nothing re-derives. It
 * is the figure the engine computed and then discarded, and it is the single
 * most useful number an operator can be handed here: it is the difference
 * between *widen the tolerance by this much* and *go find out why these two
 * files disagree by this much.*
 *
 * 🛑 `exampleRef` IS AN EXAMPLE AND THE NAME IS LOAD-BEARING, exactly as it is
 * on `SearchBoundaryEntry`. The FULL membership is already on the residue, one
 * row each, carrying `amount_tolerance_declined`. This channel answers what the
 * residue cannot — HOW MANY buckets are in this state and how wide each was —
 * because rows spread across three declined buckets and rows all inside one
 * look identical there.
 *
 * ⚠️ NO BUCKET KEY, AND NO ROOM FOR ONE. G217's ruling is unchanged and applies
 * here unchanged: the join key is counterparty-authored text BY CONSTRUCTION,
 * and the proof below is a compile error the moment a `string` property appears.
 */
export interface ToleranceDecline {
  /** Open items on the LEFT of the bucket. Never a size class. */
  readonly leftItemCount: number
  /** Open items on the RIGHT of the bucket. */
  readonly rightItemCount: number
  /** `leftTotal − rightTotal`, in minor units. The figure that was discarded. */
  readonly signedVarianceMinor: bigint
  readonly exampleRef: ItemRef
}

/**
 * 🟢 THE CONTAINMENT PROOF, ATTACHED AT BIRTH RATHER THAN RETROFITTED — which
 * is what §5a's banner asks of every channel added after it: *"a future channel
 * with no proof and no sentence here is the defect G217 was taken about,
 * arriving again."*
 *
 * ⚠️ VERIFY IT RED BEFORE TRUSTING IT GREEN — `Assert<never>` compiles, so a
 * vacuous proof reads exactly like a real one. Add `bucketKey: string` to
 * `ToleranceDecline` and `tsc` must report TS2344.
 */
export type _ToleranceDeclineHoldsNoTextDeep = AssertNoTextDeep<ToleranceDecline>

/**
 * The bucket's ITEM KEYS, kept INSIDE the engine and joined to nothing that
 * leaves it — the same split `KeyedSearchBoundaryEntry` already makes, for the
 * same reason. `runSetReconciliation` needs them to attribute a residue cause;
 * that attribution happens inside the function that produced them, and only
 * `decline` reaches `SetReconciliationResult`.
 */
export interface KeyedToleranceDecline {
  readonly itemKeys: readonly string[]
  readonly decline: ToleranceDecline
}

/* -------------------------------------------------------------------- *
 * Pass: identifier join — A9(a) for ALL FOUR cardinalities
 *
 * The draft built `new Map(unmatchedB.map(b => [b.normalizedId, b]))`. Duplicate
 * normalised ids COLLAPSE, last wins, and the dropped record is never matched.
 * The index here is `Map<key, AdmittedItem[]>` and it is never `Map<key, item>`.
 *
 * ⚠️ THE COLLAPSE AND THE DISPOSITION ARE TWO SEPARATE FIXES, and the red team
 * is right that only the first is cardinality-independent. The multimap fixes
 * the collapse for every cardinality. What an AMBIGUITY MEANS is ruled here,
 * per cardinality, because it was unruled for three of the four:
 *
 *   one_to_one    — pairs only 1 × 1. Anything else is an ambiguity finding and
 *                   BOTH sides go to the residue as `unidentified`.
 *   one_to_many   — pairs only 1 × N (left singleton).
 *   many_to_one   — pairs only N × 1 (right singleton).
 *   many_to_many  — pairs only where AT LEAST ONE side is a singleton.
 *
 * The last is the one nobody had ruled and it is the one that matters, because
 * `many_to_many` is where a real N:M waterfall lives. The ruling: an identifier
 * that repeats on BOTH sides names no unique pair, so the identifier join
 * declines it and `amount_sum` — which exists precisely to resolve N:M by value
 * rather than by name — gets it instead. An identifier strategy that guessed
 * here would be moving money on a name collision.
 *
 * `RulePredicate.unique_within` already exists in the model because a duplicate
 * invoice number is a REAL FINDING, so surfacing the ambiguity is a product
 * feature and not a degraded mode.
 * -------------------------------------------------------------------- */

function indexBy(
  items: readonly AdmittedItem[],
  on: FieldPath,
): ReadonlyMap<string, readonly AdmittedItem[]> {
  const index = new Map<string, AdmittedItem[]>()
  for (const item of items) {
    const key = item.identifiers.get(fieldPathKey(on))
    if (key === undefined) continue
    const bucket = index.get(key)
    if (bucket === undefined) index.set(key, [item])
    else bucket.push(item)
  }
  return index
}

function arityPermits(
  cardinality: PairingCardinality,
  leftCount: number,
  rightCount: number,
): boolean {
  if (leftCount === 0 || rightCount === 0) return false
  if (cardinality === 'one_to_one') return leftCount === 1 && rightCount === 1
  if (cardinality === 'one_to_many') return leftCount === 1
  if (cardinality === 'many_to_one') return rightCount === 1
  return leftCount === 1 || rightCount === 1
}

/**
 * Every item on one side that still has money outstanding AND that a pass may
 * act on. The one seam six passes and `buildReaderRequests()` draw from.
 *
 * 🛑 G227 — AN ITEM WITH A HELD READ IS OPEN AND IS NOT OFFERED, AND THIS IS THE
 * ONE PLACE THAT IS DECIDED. `FieldSpec.confidenceFloor` says a read below the
 * floor means *"a person is asked instead of guessed at"*; an engine that paired
 * on it, or that offered it to the quarantined reader as a candidate, has asked
 * nobody. Filtering here rather than in each pass is deliberate: six copies of
 * the test are six branches that agree until somebody adds a seventh pass, and
 * the seventh would silently pair on values the floor withheld.
 *
 * ⚠️ IT REMOVES THE ITEM FROM THE PASSES AND FROM NOTHING ELSE. The residue
 * builder and `checkPostconditions()` walk `state.items` directly, so a held item
 * is still summed into the admitted gross, still required to appear in the residue
 * exactly once, and `gross_not_partitioned` still balances over it. A filter
 * applied one layer earlier — dropping the row before admission — is precisely
 * the A9(b) shape §10's banner exists to refuse.
 */
function openItems(state: MatchingState, side: PopulationSide): AdmittedItem[] {
  const open: AdmittedItem[] = []
  for (const item of state.items.values()) {
    if (item.side !== side) continue
    if (item.heldReads.length > 0) continue
    const residual = residualOf(state, item.key)
    if (!residual.ok) continue
    if (isPositiveMoney(residual.value)) open.push(item)
  }
  open.sort((a, b) => a.ordinal - b.ordinal)
  return open
}

/** FIFO order: oldest first, then admission ordinal. Total — A9(h). */
function fifoOrder(a: AdmittedItem, b: AdmittedItem): number {
  if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber
  return a.ordinal - b.ordinal
}

function sumGross(items: readonly AdmittedItem[]): MoneyResult<Money> {
  const first = items[0]
  /* C18/NOTED 15. This said `currency_mismatch`, which was false: an empty list
   * has no second currency to disagree with. There is no zero to return either —
   * `zeroLike` needs a denomination and this module never invents one. */
  if (first === undefined) return { ok: false, refusal: { kind: 'no_items' } }
  let total = zeroLike(first.gross)
  for (const item of items) {
    const next = addMoney(total, item.gross)
    if (!next.ok) return next
    total = next.value
  }
  return { ok: true, value: total }
}

export interface PassOutcome {
  readonly state: MatchingState
  readonly ambiguities: readonly AmbiguityFinding[]
  readonly toleranceRefusals: readonly ToleranceRefusal[]
}

/**
 * G115 — `passFuzzyReference` alone can refuse a bucket on size, so it alone
 * reports which.
 *
 * ⚠️ THIS FIELD HELD THE AMOUNT BUCKET KEY UNTIL G217, AND THE KEY WAS NEVER THE
 * USEFUL HALF. The old note said it is *"keyed by AMOUNT, not by counterparty:
 * the two passes bucket on different things and conflating them would be §5.1"*
 * — which was right, and was also the reason `runSetReconciliation` could do
 * nothing with it. It accumulated the keys into a local and read them nowhere.
 * The boundary entries below are what that local should always have been: one
 * per row whose comparison was skipped, addressed at line grain.
 */
export interface FuzzyPassOutcome extends PassOutcome {
  readonly oversizedAmountBuckets: readonly SearchBoundaryEntry[]
}

/**
 * G291 — `passIdentifierJoin` alone can DECLINE a bucket it already joined, so
 * it alone reports which.
 *
 * ⚠️ IT IS A PASS-SPECIFIC EXTENSION FOR THE REASON `FuzzyPassOutcome` IS ONE,
 * and the shape is copied from it deliberately rather than widening
 * `PassOutcome`. Putting `toleranceDeclines` on the shared outcome would oblige
 * `passAmountAndDate` and `passFuzzyReference` to return an empty array they can
 * never fill, and an always-empty field is exactly the *"channel nobody wired
 * up"* G217 refuses. The type says which pass can produce one; §5b says why the
 * other two cannot.
 */
export interface IdentifierJoinOutcome extends PassOutcome {
  readonly toleranceDeclines: readonly KeyedToleranceDecline[]
}

export function passIdentifierJoin(
  state: MatchingState,
  on: FieldPath,
  tolerance: Tolerance,
  direction: ToleranceDirection,
  cardinality: PairingCardinality,
): IdentifierJoinOutcome {
  let current = state
  const ambiguities: AmbiguityFinding[] = []
  const toleranceRefusals: ToleranceRefusal[] = []
  /* G291 — the buckets that joined and whose totals missed. See §5b. */
  const toleranceDeclines: KeyedToleranceDecline[] = []

  const leftIndex = indexBy(openItems(current, 'left'), on)
  const rightIndex = indexBy(openItems(current, 'right'), on)

  const keys = [...leftIndex.keys()].sort()
  for (const key of keys) {
    const left = leftIndex.get(key) ?? []
    const right = rightIndex.get(key) ?? []
    if (right.length === 0) continue
    if (!arityPermits(cardinality, left.length, right.length)) {
      ambiguities.push({
        on,
        strategyKind: 'exact_identifier',
        leftCandidates: left.length,
        rightCandidates: right.length,
        leftRefs: left.map((i) => i.ref),
        rightRefs: right.map((i) => i.ref),
      })
      continue
    }
    const leftTotal = sumGross(left)
    const rightTotal = sumGross(right)
    if (!leftTotal.ok || !rightTotal.ok) continue
    const verdict = toleranceAdmits(leftTotal.value, rightTotal.value, tolerance, direction)
    if (!verdict.ok) {
      toleranceRefusals.push(verdict.refusal)
      continue
    }
    if (!verdict.admitted) {
      /* 🛑 G291 — THIS WAS A BARE `continue` AND THAT IS THE WHOLE DEFECT. The
       * comparison ran, it produced `signedVarianceMinor`, and the figure went
       * on the floor while §6 told the operator *nothing matched it*. See §5b
       * for why this is a channel of its own and not `toleranceRefusals`.
       *
       * The address is the FIFO-oldest LEFT member, and that is a choice rather
       * than convenience — the same one G217 makes for an oversized bucket. The
       * keys are indexed FROM the left side, so `left` is non-empty here by
       * construction; the guard is a named negative control rather than a cast,
       * which is the posture this module takes everywhere it can reach for one. */
      const oldest = [...left].sort(fifoOrder)[0]
      if (oldest !== undefined) {
        toleranceDeclines.push({
          itemKeys: [...left, ...right].map((item) => item.key),
          decline: {
            leftItemCount: left.length,
            rightItemCount: right.length,
            signedVarianceMinor: verdict.signedVarianceMinor,
            exampleRef: oldest.ref,
          },
        })
      }
      continue
    }

    const evidence: PairingEvidence =
      verdict.signedVarianceMinor === 0n
        ? { kind: 'exact_identifier', on }
        : { kind: 'tolerant_identifier', on, signedVarianceMinor: verdict.signedVarianceMinor }

    current = pourFifo(current, [...left].sort(fifoOrder), [...right].sort(fifoOrder), evidence)
  }
  return { state: current, ambiguities, toleranceRefusals, toleranceDeclines }
}

/**
 * Pours value from the RIGHT list into the LEFT list, oldest first on both,
 * stopping when EITHER runs out.
 *
 * ⚠️ THIS IS THE A9(b) FIX AND IT IS ONE LINE OF BEHAVIOUR: it stops. The draft
 * ended pass 3 with `unmatchedB.filter(b => !payments.includes(b))`, which
 * consumed EVERY payment in the group even when `totalCashPool` was left over —
 * the leftover was recorded as `variance` and the payments were marked spent.
 * Money disappeared, and no type in this repository could have caught it.
 *
 * Here, an item with residual > 0 after the pour is simply still open, and every
 * open item lands in the residue (§6). Leftover cash is not `variance`; calling
 * it variance is what made the draft lose money silently.
 */
function pourFifo(
  state: MatchingState,
  into: readonly AdmittedItem[],
  from: readonly AdmittedItem[],
  evidence: PairingEvidence,
): MatchingState {
  let current = state
  let fromIndex = 0
  for (const target of into) {
    while (fromIndex < from.length) {
      const targetResidual = residualOf(current, target.key)
      if (!targetResidual.ok) return current
      if (!isPositiveMoney(targetResidual.value)) break
      const source = from[fromIndex]
      if (source === undefined) break
      const sourceResidual = residualOf(current, source.key)
      if (!sourceResidual.ok) return current
      if (!isPositiveMoney(sourceResidual.value)) {
        fromIndex += 1
        continue
      }
      const amount = minMoney(targetResidual.value, sourceResidual.value)
      if (!amount.ok) return current
      const applied = applyAllocation(current, source.key, target.key, amount.value, evidence)
      if (!applied.ok) return current
      current = applied.state
    }
  }
  return current
}

/* -------------------------------------------------------------------- *
 * Pass: amount and date
 * -------------------------------------------------------------------- */

function dayTolerance(tolerance: Tolerance): number | null {
  if (tolerance.kind !== 'days') return null
  if (!Number.isInteger(tolerance.value) || tolerance.value < 0) return null
  return tolerance.value
}

export function passAmountAndDate(
  state: MatchingState,
  amountTolerance: Tolerance,
  dateTolerance: Tolerance,
  direction: ToleranceDirection,
): PassOutcome {
  let current = state
  const ambiguities: AmbiguityFinding[] = []
  const toleranceRefusals: ToleranceRefusal[] = []
  const days = dayTolerance(dateTolerance)
  if (days === null) return { state: current, ambiguities, toleranceRefusals }

  const right = openItems(current, 'right')
  for (const leftItem of openItems(current, 'left').sort(fifoOrder)) {
    const candidates: AdmittedItem[] = []
    for (const rightItem of right) {
      const residual = residualOf(current, rightItem.key)
      if (!residual.ok || !isPositiveMoney(residual.value)) continue
      if (Math.abs(rightItem.dayNumber - leftItem.dayNumber) > days) continue
      const verdict = toleranceAdmits(leftItem.gross, rightItem.gross, amountTolerance, direction)
      if (!verdict.ok) {
        toleranceRefusals.push(verdict.refusal)
        continue
      }
      if (verdict.admitted) candidates.push(rightItem)
    }
    const only = candidates[0]
    if (only === undefined) continue
    if (candidates.length > 1) {
      ambiguities.push({
        on: null,
        strategyKind: 'amount_and_date',
        leftCandidates: 1,
        rightCandidates: candidates.length,
        leftRefs: [leftItem.ref],
        rightRefs: candidates.map((i) => i.ref),
      })
      continue
    }
    const leftResidual = residualOf(current, leftItem.key)
    const rightResidual = residualOf(current, only.key)
    if (!leftResidual.ok || !rightResidual.ok) continue
    const amount = minMoney(leftResidual.value, rightResidual.value)
    if (!amount.ok) continue
    const applied = applyAllocation(current, only.key, leftItem.key, amount.value, {
      kind: 'amount_and_date',
      dayGap: only.dayNumber - leftItem.dayNumber,
    })
    if (applied.ok) current = applied.state
  }
  return { state: current, ambiguities, toleranceRefusals }
}

/* -------------------------------------------------------------------- *
 * Pass: amount-anchored fuzzy reference
 * -------------------------------------------------------------------- */

/**
 * Levenshtein similarity in BASIS POINTS, never a float.
 *
 * Basis points because a similarity threshold is compared, and comparing floats
 * for a threshold is how `0.85 >= 0.85` becomes false in the one case that
 * matters. `minSimilarity` on `PairingStrategy` (`model/domain.ts:1957`) is a
 * `number` in [0,1]; it is converted once, at the comparison, by multiplying by
 * 10000 and rounding — the ONLY rounding in this module, and it is on a
 * similarity score, never on money.
 *
 * Bounded: refuses beyond `maxChars` rather than allocating an O(n·m) matrix
 * over an attacker-influenced string.
 */
export function levenshteinBasisPoints(
  a: string,
  b: string,
  maxChars: number,
): number | null {
  if (a.length > maxChars || b.length > maxChars) return null
  if (a.length === 0 && b.length === 0) return 10000
  const n = a.length
  const m = b.length
  let previous: number[] = new Array<number>(m + 1)
  let currentRow: number[] = new Array<number>(m + 1)
  for (let j = 0; j <= m; j += 1) previous[j] = j
  for (let i = 1; i <= n; i += 1) {
    currentRow[0] = i
    for (let j = 1; j <= m; j += 1) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      const del = (previous[j] ?? 0) + 1
      const ins = (currentRow[j - 1] ?? 0) + 1
      const sub = (previous[j - 1] ?? 0) + cost
      currentRow[j] = Math.min(del, ins, sub)
    }
    const swap = previous
    previous = currentRow
    currentRow = swap
  }
  const distance = previous[m] ?? Math.max(n, m)
  const longest = Math.max(n, m)
  if (longest === 0) return 10000
  return Math.round(((longest - distance) / longest) * 10000)
}

/**
 * 🛑 STUB, MARKED AS ONE — `jaro_winkler` IS DECLARED AND NOT IMPLEMENTED.
 *
 * The owner's draft favours Jaro-Winkler where a prefix may be dropped
 * (`PO-998` vs `998`), and that instinct is right. It is not implemented here
 * because Jaro-Winkler has a prefix-scale parameter and a prefix-length cap,
 * and choosing them changes which records pair — a matching-policy decision
 * with money on it, not a coding detail. Returning a fabricated score would be
 * inventing that policy. It returns null and the strategy refuses.
 *
 * Note that the same case is already served deterministically: `PO-998` versus
 * `998` is `strip_literal { literal: 'PO-', at: 'prefix' }` in §2, applied at
 * admission by a human-approved normalisation, and a deterministic
 * normalisation is strictly better evidence than a similarity score.
 */
function similarityBasisPoints(
  metric: SimilarityMetric,
  a: string,
  b: string,
  maxChars: number,
): number | null {
  if (metric === 'levenshtein_ratio') return levenshteinBasisPoints(a, b, maxChars)
  return null
}

/** Length-prefixed for the reason `itemKey()` gives: a currency code is a `string`. */
function amountBucketKey(value: Money): string {
  return `${value.currency.length}:${value.currency}:${value.exponent}:${minorUnitsOf(value)}`
}

export function passFuzzyReference(
  state: MatchingState,
  on: FieldPath,
  minSimilarity: number,
  metric: SimilarityMetric,
  maxChars: number,
  /**
   * G115 — the SAME ceiling `passAmountSum` reads, threaded here because this
   * pass never received it and was therefore unbounded. See the bucket check.
   */
  maxBucketSize: number,
): FuzzyPassOutcome {
  let current = state
  const ambiguities: AmbiguityFinding[] = []
  const oversizedBuckets: SearchBoundaryEntry[] = []
  const threshold = Math.round(minSimilarity * 10000)

  /* THE GOLDEN RULE, mechanically: bucket by EXACT minor units first, then run
   * the string maths only inside a bucket. This is what keeps the pass inside a
   * serverless compute budget — the naive form is O(N×M) over the whole
   * population — and it is also what bounds the false positives. */
  const buckets = new Map<string, AdmittedItem[]>()
  for (const item of openItems(current, 'right')) {
    const bucketKey = amountBucketKey(item.gross)
    const bucket = buckets.get(bucketKey)
    if (bucket === undefined) buckets.set(bucketKey, [item])
    else bucket.push(item)
  }

  for (const leftItem of openItems(current, 'left').sort(fifoOrder)) {
    const leftKeyValue = leftItem.identifiers.get(fieldPathKey(on))
    if (leftKeyValue === undefined) continue
    const bucketKey = amountBucketKey(leftItem.gross)
    const bucket = buckets.get(bucketKey)
    if (bucket === undefined) continue
    /**
     * 🛑 G115, 9 Aug 2026 — THE FUZZY PASS WAS AN UNBOUNDED QUADRATIC AND IS NOW
     * BOUNDED BY THE SAME CONSTANT `passAmountSum` ALREADY USES.
     *
     * `bound.maxBucketSize` was read at EXACTLY ONE SITE in this module, inside
     * `passAmountSum`. This loop buckets by exact amount and then iterated every
     * member with no cardinality check, so a bucket of k items cost k²
     * `levenshteinBasisPoints` evaluations — over reference strings a
     * COUNTERPARTY controls, with `similarityMaxChars` itself unbounded until
     * this commit. Neither dimension had a ceiling.
     *
     * Found independently by two agents while assessing a proposed constant-factor
     * optimisation of `levenshteinBasisPoints`. **A constant factor cannot rescue
     * an uncapped quadratic**, which is why this landed and that did not.
     *
     * The SAME bound and the SAME refusal are reused rather than minting a second
     * knob (G55: fewer knobs). ⚠️ Cost accepted and stated: a bucket sized for a
     * subset-sum search may be the wrong size for string comparison — they are
     * different algorithms with different cost curves. If that binds, the fix is a
     * second bound taken deliberately, not drift.
     */
    if (bucket.length > maxBucketSize) {
      /* G217 — the AMOUNT bucket key is derived from a `Money` and not from
       * counterparty prose, and it is still not reported: `Money.currency` is a
       * bare `string`, the key is a length-prefixed join of four operands, and a
       * channel that carried one shape of key would be the place the next one
       * arrives. `itemCount` is how many candidates went uncompared;
       * `exampleRef` is the LEFT row whose comparison was skipped, because that
       * is the row an operator is looking for when they ask why it did not
       * match. */
      oversizedBuckets.push({ itemCount: bucket.length, exampleRef: leftItem.ref })
      continue
    }

    let best: { item: AdmittedItem; score: number } | null = null
    /**
     * THE TIED SET, NOT A TIE COUNT — and the difference is a real defect that a
     * count could not express.
     *
     * This was `let tied = 0` until 9 Aug 2026, and the finding it raised said
     * `rightCandidates: tied` (two, truthfully) beside `rightRefs: [best.item.ref]`
     * (one). Those two fields then disagreed, and the disagreement was not
     * cosmetic: `runSetReconciliation` derives the ambiguous disposition by
     * walking `finding.rightRefs`, so **a tied candidate the finding did not NAME
     * was dispositioned `no_strategy_paired`** — "nothing matched" — when the truth
     * was "this tied with another candidate and the engine could not tell them
     * apart". An auditor reading the second credit saw the wrong reason.
     *
     * That is §5.1: a rule keyed on a convenient landmark — the winner — instead of
     * the property it protects, which is EVERY candidate that could have won. Both
     * sibling passes already named the whole set (`right.map(i => i.ref)` and
     * `candidates.map(i => i.ref)`); this pass was the odd one out.
     *
     * Found by the scenario corpus, which asserted the spec-derived expectation and
     * was left RED rather than bent to match the module.
     */
    let tiedItems: AdmittedItem[] = []
    for (const rightItem of bucket) {
      const residual = residualOf(current, rightItem.key)
      if (!residual.ok || !isPositiveMoney(residual.value)) continue
      const rightKeyValue = rightItem.identifiers.get(fieldPathKey(on))
      if (rightKeyValue === undefined) continue
      const score = similarityBasisPoints(metric, leftKeyValue, rightKeyValue, maxChars)
      if (score === null || score < threshold) continue
      if (best === null || score > best.score) {
        best = { item: rightItem, score }
        tiedItems = [rightItem]
      } else if (score === best.score) {
        tiedItems.push(rightItem)
      }
    }
    if (best === null) continue
    if (tiedItems.length > 1) {
      ambiguities.push({
        on,
        strategyKind: 'fuzzy_reference',
        leftCandidates: 1,
        rightCandidates: tiedItems.length,
        leftRefs: [leftItem.ref],
        rightRefs: tiedItems.map((i) => i.ref),
      })
      continue
    }
    const leftResidual = residualOf(current, leftItem.key)
    const rightResidual = residualOf(current, best.item.key)
    if (!leftResidual.ok || !rightResidual.ok) continue
    const amount = minMoney(leftResidual.value, rightResidual.value)
    if (!amount.ok) continue
    const applied = applyAllocation(current, best.item.key, leftItem.key, amount.value, {
      kind: 'fuzzy_reference',
      similarityBasisPoints: best.score,
      metric,
    })
    if (applied.ok) current = applied.state
  }
  return { state: current, ambiguities, toleranceRefusals: [], oversizedAmountBuckets: oversizedBuckets }
}

/* -------------------------------------------------------------------- *
 * Pass: N:M — G105, bounded subset sum FIRST, waterfall as a RECORDED fallback
 * -------------------------------------------------------------------- */

export interface SubsetSumBound {
  /** `PairingStrategy.amount_sum.maxMembers` — arity bound. */
  readonly maxMembers: number
  /**
   * Step budget. G105: "subset sum is NP-hard, so it takes a hard bound — max
   * group size and a step budget — with a STATED, LOGGED fall-through to FIFO
   * when the bound is hit."
   *
   * ⚠️ `maxMembers` alone is NOT a tractability bound and the model's own
   * comment at `model/domain.ts:1955` overstates it: `maxMembers: 8` over a
   * 400-line counterparty bucket is C(400,8) ≈ 2×10^15 combinations. It bounds
   * TERMINATION and not COST. This second bound is the one that makes the pass
   * affordable, and its VALUE is the caller's — see the design record OR-2.
   */
  readonly stepBudget: number
  /** Buckets larger than this are refused to the residue rather than attempted. */
  readonly maxBucketSize: number
}

type SubsetSumResult =
  | { kind: 'found'; members: readonly AdmittedItem[] }
  | { kind: 'no_solution' }
  | { kind: 'budget_exhausted' }

/**
 * Bounded depth-first subset sum over open obligations, deterministic order.
 *
 * Deterministic because the candidate list is pre-sorted FIFO and the search
 * takes members in that order — so the same input yields the same combination,
 * which `RunTrigger.rerun` requires.
 */
function boundedSubsetSum(
  candidates: readonly AdmittedItem[],
  /* ⚠️ `bigint` SINCE 19 Sep 2026 — G286. Every value in this map and the
   * target itself came out of `minorUnitsOf()`; a subset sum over money that
   * accumulated in `number` would have carried the ceiling into the one search
   * in this engine that ADDS an unbounded number of amounts together. */
  residualOfCandidate: ReadonlyMap<string, bigint>,
  targetMinor: bigint,
  bound: SubsetSumBound,
): SubsetSumResult {
  let steps = 0
  let exhausted = false
  const chosen: AdmittedItem[] = []

  /* ⚠️ `remaining` IS MINOR UNITS AND THEREFORE `bigint` SINCE 19 Sep 2026 —
   * G286. `start` is an INDEX into `candidates` and stays a `number`; the two
   * parameters are different kinds of quantity and only one of them is money. */
  const search = (start: number, remaining: bigint): AdmittedItem[] | null => {
    if (remaining === 0n && chosen.length > 0) return [...chosen]
    if (chosen.length >= bound.maxMembers) return null
    for (let i = start; i < candidates.length; i += 1) {
      steps += 1
      if (steps > bound.stepBudget) {
        exhausted = true
        return null
      }
      const candidate = candidates[i]
      if (candidate === undefined) continue
      const value = residualOfCandidate.get(candidate.key)
      if (value === undefined || value <= 0n || value > remaining) continue
      chosen.push(candidate)
      const found = search(i + 1, remaining - value)
      if (found !== null) return found
      chosen.pop()
      if (exhausted) return null
    }
    return null
  }

  if (targetMinor <= 0n) return { kind: 'no_solution' }
  const found = search(0, targetMinor)
  if (found !== null) return { kind: 'found', members: found }
  return exhausted ? { kind: 'budget_exhausted' } : { kind: 'no_solution' }
}

/* -------------------------------------------------------------------- *
 * §5a  THE SEARCH BOUNDARY — G217, 22 Aug 2026
 *
 * 🛑 THE RULING: THE SEARCH BOUNDARY IS REPORTED AS COUNTS PLUS `ItemRef`. NO
 * BUCKET KEY REACHES THE WIRE, IN ANY FORM — NOT VERBATIM AND NOT HASHED.
 *
 * A bucket key is counterparty-authored text BY CONSTRUCTION: it is whatever the
 * join key held in a file somebody sent us. `SetReconciliationResult` carried
 * two `readonly (string | null)[]` arrays of them until this slice, and it
 * carried NO containment site at all — which is how they got there. The two
 * facts are one fact: an interface with no proof on it is an interface nobody
 * had to argue with.
 *
 * ⚠️ THE HASH ALTERNATIVE WAS REFUSED, AND THE REASON IS WORTH KEEPING BECAUSE
 * IT LOOKS SAFE. A digest of a LOW-CARDINALITY key — a date, a short code, an
 * invoice prefix — is reversible by anyone who can guess the input space, and
 * for a reconciliation join key that space is small and structured. A hash of a
 * guessable value is an ENCODING, not a protection. The verbatim option was
 * refused on invariant 6: ingested content is data, never instruction, and a
 * rendered operator console is exactly where that gets tested.
 *
 * WHAT IT COSTS, STATED PLAINLY: some debugging convenience. An operator who
 * wants the key reads the row through the `ItemRef`, inside the tenant scope,
 * through an operation that is authorised — rather than having it handed to them
 * in a summary that is not.
 * -------------------------------------------------------------------- */

/**
 * ONE PLACE A BOUND BIT — how much was in scope, and one address into it.
 *
 * 🛑 `exampleRef` IS AN EXAMPLE AND THE NAME IS LOAD-BEARING. It is not the
 * bucket's membership list and must not be read as one: the FULL membership is
 * already on the residue, one row each, carrying `bucket_exceeded_bound` or
 * `search_budget_exhausted`. This channel answers the question the residue
 * cannot — *how was the search SHAPED* — because rows spread across three
 * refused buckets and rows all inside one look identical there.
 *
 * ⚠️ NO KEY, AND NO ROOM FOR ONE. `_SearchBoundaryHoldsNoTextDeep` below is a
 * compile error the moment a `string` property appears here, which is the whole
 * of G217 expressed as something that fails a build rather than a review.
 */
export interface SearchBoundaryEntry {
  /** Open items in scope when the engine stopped. Never a size class. */
  readonly itemCount: number
  readonly exampleRef: ItemRef
}

/**
 * WHERE THE ENGINE STOPPED LOOKING, ON THREE CHANNELS WITH THREE DIFFERENT
 * GRAINS — and the grains are stated per field because they are NOT the same
 * and the old shape claimed they were.
 *
 * ⚠️ `exhaustedBuckets` WAS THE OLD NAME AND IT COUNTED SEARCHES, NOT BUCKETS.
 * `passAmountSum` pushed once per CASH ITEM whose subset-sum search ran out of
 * budget, so a single counterparty bucket with four such payments appeared four
 * times. The array was `(string | null)[]` and never held a null — `bucketsOf()`
 * skips an unattributed item before a key is ever taken. Both are corrected in
 * the names rather than in a comment; the fix for a field that lies about its
 * grain is a field with the right name.
 */
export interface SearchBoundary {
  /** One entry per BUCKET refused before any search ran, on a PREDICTED cost. */
  readonly oversizedBuckets: readonly SearchBoundaryEntry[]
  /** G114 — one entry per SEARCH cut short by the step budget. An OBSERVED cost. */
  readonly exhaustedSearches: readonly SearchBoundaryEntry[]
  /**
   * G115 — one entry per ROW whose fuzzy comparison was skipped because its
   * exact-amount bucket was wider than `maxBucketSize`.
   *
   * 🛑 THIS CHANNEL IS WHERE G115's REFUSAL BECAME VISIBLE FOR THE FIRST TIME,
   * AND THAT IS A FINDING RATHER THAN A FEATURE. `runSetReconciliation`
   * accumulated `oversizedAmountBuckets` from the fuzzy pass into a local and
   * then read it NOWHERE — the comment at the accumulation site said it *"reuses
   * `bucket_exceeded_bound`"*, and it does not: that cause is joined on the
   * COUNTERPARTY key and these are AMOUNT keys, so the two sets never met. A
   * bound that was hit was being silently absorbed, which is the exact thing
   * G114 exists to forbid. `noUnusedLocals` cannot see a variable that is
   * written; nothing else was looking.
   */
  readonly oversizedAmountBuckets: readonly SearchBoundaryEntry[]
}

/**
 * 🟢 THE CONTAINMENT PROOF G217 ATTACHES TO THIS SLICE, AND THE FIRST ONE THIS
 * RESULT HAS EVER CARRIED.
 *
 * ⚠️ VERIFY IT RED BEFORE TRUSTING IT GREEN — `Assert<never>` compiles, so a
 * vacuous proof reads exactly like a real one. Add `bucketKey: string` to
 * `SearchBoundaryEntry` and `tsc` must report TS2344.
 */
export type _SearchBoundaryHoldsNoTextDeep = AssertNoTextDeep<SearchBoundary>

/**
 * The bucket key, kept INSIDE the engine and joined to nothing that leaves it.
 *
 * 🛑 IT CARRIES A COUNTERPARTY KEY AND THEREFORE CANNOT CARRY
 * `AssertNoTextDeep`, AND THAT IS THE PROOF WORKING RATHER THAN AN OVERSIGHT —
 * the same shape `HeldRead` and `RefusedItem` already have, where the record
 * carrying the address holds no proof and the value that reaches a reader does.
 * `runSetReconciliation` needs the key to attribute a residue cause
 * (`bucket_exceeded_bound`), and that attribution happens inside the same
 * function that produced it. Nothing derived from `counterparty` reaches
 * `SetReconciliationResult`; `boundary` is the half that does.
 */
export interface KeyedSearchBoundaryEntry {
  readonly counterparty: string
  readonly boundary: SearchBoundaryEntry
}

export interface AmountSumOutcome {
  readonly state: MatchingState
  /** Buckets refused before any search, on a PREDICTED cost. */
  readonly oversizedBuckets: readonly KeyedSearchBoundaryEntry[]
  /** G114 — searches cut short by the step budget. Their items stay OPEN. */
  readonly exhaustedSearches: readonly KeyedSearchBoundaryEntry[]
}

/**
 * THE WATERFALL IS DRIVEN BY THE OBLIGATIONS, AND LEFTOVER CASH STAYS OPEN.
 *
 * `obligationSide` names which population holds what is owed. Cash is poured
 * into obligations oldest-first; when the obligations in a bucket are exhausted
 * the pour STOPS, and every cash item with residual > 0 remains
 * `partially_allocated` and lands in the residue. That is A9(b).
 *
 * The counterparty partition is ABSOLUTE and the waterfall never crosses it: a
 * payment from one counterparty clearing another's obligation is a FINDING, not
 * a match. `PairingCardinality` describes ARITY and says nothing about
 * PARTITION, so this is stated here — design record OR-4.
 *
 * `counterparty: null` is a real, named, UNATTRIBUTED bucket which is excluded
 * from N:M and flows to the residue intact. That is A9(d): the draft's `groupBy`
 * dropped it.
 */
export function passAmountSum(
  state: MatchingState,
  obligationSide: PopulationSide,
  bound: SubsetSumBound,
): AmountSumOutcome {
  let current = state
  const oversizedBuckets: KeyedSearchBoundaryEntry[] = []
  /* G114: searches that ran out of step budget. Distinct from oversizedBuckets —
   * that is a PREDICTED cost, this is an OBSERVED one, and the GRAIN differs
   * too: a bucket is refused once, a search is cut short once per cash item. */
  const exhaustedSearches: KeyedSearchBoundaryEntry[] = []
  const cashSide: PopulationSide = obligationSide === 'left' ? 'right' : 'left'

  const bucketsOf = (side: PopulationSide): Map<string, AdmittedItem[]> => {
    const buckets = new Map<string, AdmittedItem[]>()
    for (const item of openItems(current, side)) {
      if (item.counterparty === null) continue
      const bucket = buckets.get(item.counterparty)
      if (bucket === undefined) buckets.set(item.counterparty, [item])
      else bucket.push(item)
    }
    return buckets
  }

  const obligationBuckets = bucketsOf(obligationSide)
  const cashBuckets = bucketsOf(cashSide)

  for (const counterparty of [...cashBuckets.keys()].sort()) {
    const cash = (cashBuckets.get(counterparty) ?? []).slice().sort(fifoOrder)
    const obligations = (obligationBuckets.get(counterparty) ?? []).slice().sort(fifoOrder)
    if (obligations.length === 0) continue
    if (obligations.length > bound.maxBucketSize || cash.length > bound.maxBucketSize) {
      /* G217 — the KEY stays here and the BOUNDARY travels. `obligations` is
       * non-empty (guarded one line up) and sorted FIFO, so its first member is
       * the oldest thing in the refused bucket and the address an operator would
       * open first. `itemCount` spans BOTH sides because the bucket is the
       * counterparty partition and either side can be what breached the bound. */
      const oldest = obligations[0]
      if (oldest !== undefined) {
        oversizedBuckets.push({
          counterparty,
          boundary: {
            itemCount: obligations.length + cash.length,
            exampleRef: oldest.ref,
          },
        })
      }
      continue
    }

    for (const cashItem of cash) {
      const cashResidual = residualOf(current, cashItem.key)
      if (!cashResidual.ok || !isPositiveMoney(cashResidual.value)) continue

      const openObligations = obligations.filter((o) => {
        const r = residualOf(current, o.key)
        return r.ok && isPositiveMoney(r.value)
      })
      if (openObligations.length === 0) break

      const residuals = new Map<string, bigint>()
      let unitMismatch = false
      for (const obligation of openObligations) {
        const r = residualOf(current, obligation.key)
        if (!r.ok) {
          unitMismatch = true
          break
        }
        if (r.value.currency !== cashResidual.value.currency) unitMismatch = true
        if (r.value.exponent !== cashResidual.value.exponent) unitMismatch = true
        residuals.set(obligation.key, minorUnitsOf(r.value))
      }
      if (unitMismatch) continue

      /* G105, first: an EXACT combination is what the payer intended. A MATCH. */
      const exact = boundedSubsetSum(
        openObligations,
        residuals,
        minorUnitsOf(cashResidual.value),
        bound,
      )
      if (exact.kind === 'found') {
        const evidence: PairingEvidence = {
          kind: 'amount_sum_exact',
          memberCount: exact.members.length,
        }
        current = pourFifo(current, [...exact.members].sort(fifoOrder), [cashItem], evidence)
        continue
      }

      /**
       * 🛑 G114, 9 Aug 2026 — THE EXHAUSTION ARM DOES NOT POUR. It leaves the
       * bucket open and the items reach the residue.
       *
       * This amends G105's wording and is forced by G105's own reasoning. G105
       * licenses the waterfall for cash the firm *cannot attribute* — and
       * `no_solution` IS that finding: the search RAN OUT THE SPACE and proved
       * no subset sums to the payment. `budget_exhausted` establishes only that
       * **the engine stopped looking**. Pouring on it applies the judgement
       * without the condition that licenses it.
       *
       * ⚠️ WHY "IT IS ALREADY VISIBLE" WAS WRONG, and it was believed for a day.
       * The old code recorded `fellThroughFrom: 'budget_exhausted'` on every row
       * it produced, which reads like disclosure. It is not: `pourFifo` mints
       * allocations, the item becomes `fully_allocated`, and the residue builder
       * below skips a `fully_allocated` item — so the item LEFT THE RESIDUE
       * ENTIRELY and the marker survived only inside `Allocation.evidence`, on a
       * field nothing queues on. The reason was recorded in a place and the item
       * was removed from the place people look. **The residue is the product**
       * for this archetype; a controller saw nothing at all.
       *
       * 🟢 IT ALSO ENDS AN INCONSISTENCY THE MODULE ALREADY HAD. `maxBucketSize`
       * refuses a bucket to the residue on a PREDICTED cost (:1895); this arm
       * poured chronologically on an OBSERVED one. Two bounds on the same
       * resource with opposite behaviour on breach, and no answer to an auditor
       * asking why a 501-line bucket goes to review untouched while a 500-line
       * bucket that burned the whole step budget gets applied oldest-first.
       *
       * WHAT SURVIVES OF G105, WHICH IS EVERYTHING ELSE: subset sum still runs
       * FIRST; an exact combination is still a MATCH; the waterfall still runs
       * on `no_solution` with its full evidence row; the bound is still hard.
       * G105's closing sentence — *silently truncating the search would make an
       * allocation look like a match* — is STRENGTHENED, because this removes
       * the last path on which a truncated search produces an allocation at all.
       */
      if (exact.kind === 'budget_exhausted') {
        /* G217 — the address is the CASH ITEM, not an obligation, and that is a
         * choice rather than convenience: this payment is the thing the engine
         * gave up trying to attribute, and it is what an operator opens. */
        exhaustedSearches.push({
          counterparty,
          boundary: {
            itemCount: openObligations.length + 1,
            exampleRef: cashItem.ref,
          },
        })
        continue
      }

      /* G105, second: the waterfall is a JUDGEMENT, and it runs only where the
       * search COMPLETED and found nothing. The reason is still recorded on
       * every row rather than inferred from silence. */
      const evidence: PairingEvidence = {
        kind: 'amount_sum_waterfall',
        fellThroughFrom: 'no_exact_solution',
      }
      current = pourFifo(current, openObligations, [cashItem], evidence)
    }
  }
  return { state: current, oversizedBuckets, exhaustedSearches }
}

/* ==================================================================== *
 * §6  RESIDUE — the product
 * ==================================================================== */

export type ResidueCause =
  | { kind: 'no_strategy_paired' }
  | { kind: 'identifier_ambiguous' }
  | { kind: 'admission_refused'; refusal: AdmissionRefusal }
  | { kind: 'cash_exceeded_obligations' }
  | { kind: 'obligation_not_fully_settled' }
  | { kind: 'counterparty_unattributed' }
  | { kind: 'bucket_exceeded_bound' }
  /**
   * G114 — the subset-sum search was cut short by its step budget, so the engine
   * does not know whether an exact combination exists. Distinct from
   * `bucket_exceeded_bound`, which is a bucket REFUSED on a predicted cost, and
   * distinct from `no_strategy_paired`, which would claim nothing matched.
   */
  | { kind: 'search_budget_exhausted' }
  | { kind: 'reader_refused'; refusal: ReaderRefusal }
  | { kind: 'reader_found_no_candidate' }
  /**
   * C18 — this row came from a document whose own trailer could not be
   * reconciled against its rows. The finding is reported on the RESIDUE ROW an
   * operator actually reads, not only in `postconditions` where it would be a
   * run-level footnote.
   *
   * 🛑 IT DOMINATES THE OTHER CAUSES DELIBERATELY. If a file is truncated,
   * doubled, or one row short, every matching verdict over its rows is suspect —
   * so *"nothing matched it"* would send an operator chasing a match for a row
   * whose file is the actual problem. The fix is a file to re-cut, and the cause
   * has to say so before it says anything else.
   */
  | { kind: 'control_total_unverified' }
  /**
   * G227 — A READ CAME IN UNDER `FieldSpec.confidenceFloor`, SO A PERSON IS
   * ASKED INSTEAD OF THE VALUE BEING GUESSED AT. The twelfth cause.
   *
   * 🛑 IT IS NOT AN `AdmissionRefusal` ARM AND THAT IS THE WHOLE POINT.
   * The floor's own docblock (`FieldSpec.confidenceFloor`, `model/domain.ts`;
   * derive it with `grep -n 'confidenceFloor' model/domain.ts`) says the value is
   * *"asked instead of guessed at"* — a refusal DISCARDS the value, and the
   * design requires a person to see it. The eighth arm passes every *"the floor
   * is enforced"* assertion anybody would write and breaks the design the floor
   * states about itself, which is why no arm of `AdmissionRefusal` is a floor
   * breach and `tests/model/below-floor-held.test.ts` guards THAT.
   *
   * ⚠️ THIS OPENED *"IT IS NOT AN EIGHTH `AdmissionRefusal` ARM"* AND ENDED
   * *"which is why `AdmissionRefusal` stays at SEVEN and
   * `tests/model/below-floor-held.test.ts` guards the count"* UNTIL OQ-1 WAS
   * FIXED. Both are corrected rather than deleted, because the SEVEN was quoted
   * onward and because a reader counting arms would now reach a different
   * number and conclude this ruling had been overturned. It has not been. The
   * union has EIGHT arms; the eighth is `amount_not_exact_money`, which refuses
   * an amount that cannot be added, subtracted or compared AT ALL, and it has
   * nothing to do with G227. That test now guards the PROPERTY rather than the
   * number, which is the form it should always have had.
   *
   * 🛑 AND IT IS NOT A THIRD RESULT CHANNEL. C18 refused `populationFindings` as
   * *"a channel with no caller obligation"*; the residue HAS one — something must
   * dispose of every entry, which is what makes `settlement` required — so a held
   * read dropped here inherits an obligation to resolve it. The same fact on a
   * channel of its own would inherit none.
   *
   * ⚠️ THE ARM CARRIES NO PAYLOAD AND THE DETAIL IS NOT LOST: it is on
   * `ResidueEntry.heldReads`, which carries the `ItemRef`, the declared
   * `FieldPath`, the confidence read and the floor missed. See that field for why
   * the split is forced rather than chosen.
   */
  | { kind: 'read_held_below_floor' }
  /**
   * G291 — THE IDENTIFIER JOIN FOUND THIS ROW'S BUCKET AND THE MONEY DECLINED.
   * The thirteenth cause. See §5b for the ruling and for why the decline also
   * reaches a channel of its own.
   *
   * 🛑 IT EXISTS BECAUSE `no_strategy_paired` WAS ABSORBING IT, AND THE TWO ARE
   * OPPOSITE CLAIMS. `no_strategy_paired` means *the engine looked and found
   * nothing to pair this with*. This means *the engine found exactly what to
   * pair it with, and the totals were outside the tolerance you declared*. An
   * operator handed the first goes and audits their matching rules; an operator
   * handed the second changes one number. `control_total_unverified`'s own
   * declaration makes this argument, in these words, about a different cause.
   *
   * ⚠️ IT CARRIES THE FIGURE AND CARRIES NOTHING ELSE, and both halves are
   * decided rather than convenient. It carries `signedVarianceMinor` because
   * C18 ruled that a finding belongs *"on the RESIDUE ROW an operator actually
   * reads"* rather than only on a run-level channel, and because this is the
   * one channel of the two that reaches the wire today. It carries neither the
   * bucket's counts nor an example ref because the row IS an address and the
   * counts are a property of the BUCKET — putting them here would spell one
   * fact two ways on two grains, which is §5.3.
   *
   * ⚠️ THE VARIANCE IS A BUCKET FIGURE ON A ROW, AND THAT IS STATED SO IT IS
   * NOT MISREAD AS THIS ROW'S OWN SHORTFALL. The tolerance is applied to
   * `sumGross(left)` against `sumGross(right)` for the whole bucket, so on an
   * N:M bucket every member carries the same number and it is the BUCKET's. The
   * same shape `control_total_unverified` already has — a DOCUMENT-grain fact
   * reported on every row of that document — and argued there for this reason.
   *
   * 🛑 `bigint`, NEVER `number`, AND `_ResidueCauseHoldsNoText` BELOW STILL
   * HOLDS. `NoTextField` admits `bigint`; a variance is a difference of two
   * money amounts and is therefore money, and G286 is explicit that leaving one
   * as `number` beside `bigint` operands re-introduces the ceiling one field
   * below the type that raised it.
   */
  | { kind: 'amount_tolerance_declined'; signedVarianceMinor: bigint }

/**
 * 🟢 THE CONTAINMENT PROOF, AND IT IS WHAT DECIDED WHERE G227's DETAIL LIVES.
 *
 * ⚠️ VERIFY IT RED BEFORE TRUSTING IT GREEN. Add `key: string` to any arm and
 * `tsc` must report TS2344.
 */
export type _ResidueCauseHoldsNoText = AssertNoTextDeep<ResidueCause>

/**
 * G227 — ONE READ THE ENGINE WOULD NOT TRUST, at field grain.
 *
 * A read whose extraction confidence came in under the floor the pack declared
 * for that field. It is HELD: the item is admitted, it is kept out of every
 * pass, and it lands in the residue carrying this record — so a person is asked
 * rather than the value being guessed at, which is what
 * `FieldSpec.confidenceFloor` says about itself.
 *
 * 🛑 IT CARRIES A `FieldPath` AND THEREFORE CANNOT CARRY `AssertNoTextDeep`,
 * AND THAT IS A FINDING RATHER THAN AN OVERSIGHT. `FieldSegment` is
 * `{ kind: 'key'; key: string } | { kind: 'index'; index: number }`
 * (`model/kernel.ts`), so a `FieldPath` holds a bare `string` at a property
 * position and `AssertNoTextDeep<HeldRead>` is a compile error. That is the
 * proof working: a path names counterparty-chosen JSON keys.
 * `tests/model/below-floor-held.test.ts` asserts the error rather than leaving
 * the absence to be read as forgetfulness, and asserts that the record's
 * value-free part passes the proof while an added `extractedValue: string`
 * fails it.
 *
 * THE PRECEDENT IS `RefusedItem`, EXACTLY. There too the closed union carrying
 * the REASON holds the proof (`_AdmissionRefusalHoldsNoText`) while the record
 * carrying the declared `path` does not — because a declared path is
 * operator-authored addressing and the refusal is what gets logged. G227's
 * *"the field-level detail must survive the fold"* is met by the record; the
 * cause stays value-free.
 *
 * 🛑 NO EXTRACTED VALUE, EVER. The whole reason a read is held is that somebody
 * will look at the value, and that is precisely why it must be FETCHED under a
 * classification rather than embedded here: this record is rendered on an
 * operator surface and logged (invariant 6). The reference is the address; the
 * value is not the engine's to carry.
 */
export interface HeldRead {
  readonly ref: ItemRef
  /**
   * The declared path that was read — operator-authored `FieldSpec` addressing,
   * never a value out of the payload. Same field, same argument, as
   * `RefusedItem.path`.
   */
  readonly path: FieldPath
  /**
   * 🛑 REQUIRED AND NULLABLE, NEVER OPTIONAL, and the null is a STATE rather
   * than an absence. A floor was declared for this path and the extraction
   * reported no confidence at all (`Provenance.confidence` is `number | null`),
   * so there is nothing to compare against the floor. That is HELD, not passed
   * — fail-closed, the same direction as G106's unreadable-by-default and
   * G100's deny-on-NULL. Optional-and-absent would make *"no confidence
   * reported"* indistinguishable from *"this field has no held read"*.
   */
  readonly readConfidence: number | null
  /**
   * The floor this read missed, in `FieldSpec.confidenceFloor`'s OWN UNIT and
   * converted to nothing.
   *
   * ⚠️ DELIBERATELY NOT BASIS POINTS, against this module's own habit. C13's
   * ceiling and `ReaderVerdict.confidenceBasisPoints` count in basis points;
   * `FieldSpec.confidenceFloor` and `Provenance.confidence` do not — the corpus
   * carries `0.95`. Converting here would mint a SECOND representation of one
   * declared number, which is the shape G111 names about the money codec and
   * G67 about `parseFxRate()`. The engine compares the caller's floor against
   * the extractor's confidence in the unit both were already stated in, and
   * invents nothing.
   */
  readonly floor: number
}

export interface ResidueEntry {
  readonly side: PopulationSide
  readonly ref: ItemRef
  /**
   * NULL FOR AN ITEM REFUSED AT ADMISSION, and this is not a convenience.
   *
   * An item whose amount could not be read HAS no settlement — it has no
   * amount. The first version of this field was non-null and the refused case
   * carried `{ currency: '', amountMinor: 0, exponent: 0 }`, which is a
   * FABRICATED zero in a fabricated currency, sitting on the one row a finance
   * user reads to find out what went wrong. `CLAUDE.md` forbids inventing data;
   * a hand-written money literal is how it got invented, which is precisely why
   * `zeroLike()` exists in §3 and why nothing may construct a `Money` by hand.
   * Required-and-nullable, never optional: the `TS2741` at each construction
   * site is the only evidence the field landed.
   */
  readonly settlement: ItemSettlement | null
  readonly disposition: EngineAssignableDisposition
  readonly cause: ResidueCause
  /**
   * G227 — every read on this row that came in under its declared floor.
   *
   * 🛑 REQUIRED AND EMPTY, NEVER OPTIONAL. An empty array says *"every declared
   * read on this row cleared its floor, or no floor was declared for it"*; an
   * absent field would say nothing at all, and the two are exactly the pair
   * G236 refuses to conflate one grain up. The `TS2741` at each construction
   * site is the only evidence the field landed, which is the argument
   * `settlement` above already makes about itself.
   *
   * ⚠️ IT IS NOT KEYED ON `cause === 'read_held_below_floor'`. A row from a
   * document whose trailer did not reconcile carries `control_total_unverified`,
   * which DOMINATES — and it may still hold a below-floor read that a person has
   * to resolve once the file is re-cut. Keying the detail on the cause would be
   * §5.1: a rule keyed on a convenient landmark instead of the property it
   * protects.
   *
   * ⚠️ EMPTY ON A ROW REFUSED AT ADMISSION, and that is a statement about the
   * fold rather than a gap. `admitOne` refuses on the first unusable field and
   * returns a `RefusedItem`, so there is no admitted item to hold reads for; the
   * refusal is the finding on those rows and it is already on `cause`.
   */
  readonly heldReads: readonly HeldRead[]
}

function dispositionFor(
  side: PopulationSide,
  cause: ResidueCause,
): EngineAssignableDisposition {
  if (cause.kind === 'admission_refused') return side === 'left' ? 'error_left' : 'error_right'
  return 'unidentified'
}

/* -------------------------------------------------------------------- *
 * §6a  THE REGISTER'S OWN OPEN-A-FINDING TRANSITION — G228, 22 Aug 2026
 *
 * 🛑 THE RULING: A LINE-GRAIN FINDING IS A SECOND ROW TYPE BESIDE `Exception`,
 * NOT A WIDENING OF IT.
 *
 * THE GAP IT CLOSES (MG14). An `Exception` is addressed at DOCUMENT grain —
 * `matchGroupId` and `ruleId` are both required on it. A residue entry is
 * addressed at LINE grain by an `ItemRef`. Nothing converted one to the other,
 * so a finding opened from a residue row could not carry its own audit trail:
 * the row that caused it is addressed by `(side, sourceDocumentId, lineIndex)`
 * and the thing it became had no field that could hold any of the three.
 *
 * 🛑 WIDENING `Exception` IS THE MORE INVASIVE CHANGE DISGUISED AS THE SMALLER
 * ONE, AND THAT IS THE WHOLE OF THE RULING. It reads as *"one type, one grain,
 * no synthesis step"* — but it changes the MEANING of every existing `Exception`
 * reader, and every document-grain consumer would silently need to aggregate. A
 * type whose grain changes under its readers is worse than a second type,
 * because the second type ANNOUNCES ITSELF and the widening does not. G74 had
 * already adjudicated the register as HETEROGENEOUS — row A is a `MatchGroup`,
 * row D is a `SourceDocument` under `FieldSpec.confidenceFloor`, and only some
 * rows are `Exception` — so a second row type is the shape the register was
 * ruled to have, not a new one.
 *
 * ⚠️ WHAT THIS SECTION DOES NOT DECIDE, STATED SO NOBODY READS IT AS BROADER.
 * `FindingBasis`'s arity is [W-14]'s. Nothing here adds a basis arm, nothing
 * here reaches `standingFor()`, and nothing here mints a `FindingStanding`.
 * Whichever of the two lands first sets that arity, and two independent answers
 * to one question is §5.3's two-vocabularies defect arriving by another door.
 *
 * 🛑 NO `matchGroupId` IS SYNTHESISED, HERE OR ANYWHERE. There is nothing to
 * derive one FROM: a residue row has no match group, and minting one out of a
 * source document id is a FABRICATED FACT on the single row an auditor reads.
 * `tests/model/residue-to-exception.test.ts` greps this module's code for the
 * identifier and requires zero, so the prohibition is mechanical rather than a
 * review convention.
 * -------------------------------------------------------------------- */

/**
 * A FINDING AT LINE GRAIN — the register's second row type.
 *
 * 🛑 `grain` IS THE DISCRIMINATOR AND IT IS THE POINT OF THE TYPE. A
 * heterogeneous register can tell a line-grain row from a document-grain one
 * without inspecting its fields and without a rule keyed on which fields happen
 * to be present, which is §5.1 in the one place it would be most tempting.
 *
 * ⚠️ IT DOES NOT EXTEND `TenantScoped`, AND IT CARRIES NO ID. The engine has no
 * clock and no identity — `terminalRunStatus()` says the same about itself — so
 * this is what a run's residue row IS as a finding, not a row somebody stored.
 * Invariant 1: scope is derived from the session, so the writer that persists
 * one does it inside `withTenantScope()` and the tenant, the id and the
 * timestamps are the writer's. A pure derivation that took a tenant would invite
 * a caller to hand it one read off a request.
 *
 * 🛑 NO MONEY AND NO `FieldPath`, AND BOTH ARE FORCED RATHER THAN CHOSEN.
 * `Money.currency` is a bare `string` and `FieldSegment`'s `key` arm is a bare
 * `string`, so a settlement or a held read on this type is a `TS2344` against
 * the containment proof below. The amount is on `ResidueEntry.settlement` and
 * the paths are on `ResidueEntry.heldReads`, both read through the same
 * operation under the same capability; carrying either here would mint a second
 * representation of one number (G111's argument about the money codec) as well
 * as breaking the proof.
 */
export interface LineFinding {
  readonly grain: 'line'
  readonly runId: RunId
  readonly side: PopulationSide
  readonly ref: ItemRef
  readonly cause: ResidueCause
  readonly disposition: EngineAssignableDisposition
}

/**
 * Why an address did not become a finding. Every failure in this module is a
 * value (§1), and neither arm carries the address it was given back.
 */
export type LineFindingRefusal =
  /**
   * The `(side, ref)` pair names no row in this run's residue. `/close/finding/:ref`
   * is addressed BY THE CALLER, so this is the shape a stale link, a re-run
   * whose residue moved, or a hand-typed address takes.
   */
  | { kind: 'no_such_residue_row' }
  /**
   * It names MORE THAN ONE, and picking the first is a silent choice about which
   * finding an operator opens.
   *
   * 🛑 UNREACHABLE FROM `runSetReconciliation` TODAY, SAID PLAINLY RATHER THAN
   * IMPLIED BY COVERAGE, in the idiom `admitted_item_key_collision` and
   * `MoneyRefusal.no_items` already use in this module: §4a refuses a duplicated
   * address before the residue is built. The arm exists because this function
   * takes a `SetReconciliationResult` — a public, constructible interface — and
   * because a refusal that names the wrong cause is worse than one nobody sees.
   */
  | { kind: 'residue_row_not_unique' }

export type _LineFindingHoldsNoTextDeep = AssertNoTextDeep<LineFinding>

/**
 * 🟢 THE CONTAINMENT PROOF ON THE REFUSAL, and it is the one that would be
 * logged. ⚠️ Verify it RED: add `ref: ItemRef` — no, add `documentName: string`
 * — to either arm and `tsc` must report TS2344.
 */
export type _LineFindingRefusalHoldsNoText = AssertNoTextDeep<LineFindingRefusal>

export type LineFindingOutcome =
  | { ok: true; finding: LineFinding }
  | { ok: false; refusal: LineFindingRefusal }

/**
 * THE JOIN MG14 SAID WAS MISSING — a residue row, addressed the way the route
 * addresses it, becomes a finding that still resolves to the line.
 *
 * TOTAL AND PURE. No tenant, no clock, no id, no throw.
 *
 * ⚠️ THE ADDRESS IS `(side, ref)` AND THE SIDE IS NOT DECORATION. The same line
 * index on the other side is a different row, and a lookup keyed on the `ItemRef`
 * alone would reach it by accident — `itemKey()` already carries the side for
 * this reason, and this function uses it rather than restating the rule.
 */
export function openLineFinding(
  result: SetReconciliationResult,
  runId: RunId,
  side: PopulationSide,
  ref: ItemRef,
): LineFindingOutcome {
  const wanted = itemKey(side, ref)
  const matches = result.residue.filter((entry) => itemKey(entry.side, entry.ref) === wanted)
  const entry = matches[0]
  if (entry === undefined) return { ok: false, refusal: { kind: 'no_such_residue_row' } }
  if (matches.length > 1) return { ok: false, refusal: { kind: 'residue_row_not_unique' } }
  return {
    ok: true,
    finding: {
      grain: 'line',
      runId,
      /* All three components of the address travel, by reference rather than by
       * reconstruction. `entry.ref` and not a rebuilt `{ sourceDocumentId,
       * lineIndex }`: a copy is a place a `lineIndex` gets dropped. */
      side: entry.side,
      ref: entry.ref,
      cause: entry.cause,
      disposition: entry.disposition,
    },
  }
}

/* ==================================================================== *
 * §7  THE LLM SEAM — a TYPE the caller fills, never a call this module makes
 *
 * WHERE THE MODEL CALL BELONGS, AND WHERE IT DOES NOT. `runSetReconciliation()`
 * is pure and synchronous. It EMITS `ReaderRequest`s and consumes
 * `ReaderOutcome`s through `applyReaderVerdicts()`. It never awaits, never
 * calls, never meters and never audits. Everything the brief's S5, S6, S7 and
 * S8 are about happens in the caller, WITH the authorisation it must already
 * hold — and it is enumerable, which is why it is written out at the end of this
 * section rather than assumed.
 *
 * 🛑 WHERE THE PASS RUNS IS AN OPEN RULING AND I AM NOT TAKING IT, but one thing
 * about it is a FINDING and not a preference. The `agent` variant of `AuditActor`
 * (`model/governance.ts:1058`) requires `stepId` and `stepExecutionId`;
 * `ProcedureStepExecution` (`model/domain.ts:3157`) is keyed on `exceptionId`,
 * because a procedure is walked per exception. `AUTHORIZATION_MAY_BE_ABSENT`
 * (`model/governance.ts:1232`) has `agent: false`. So **a model call made
 * mid-run, before any exception exists, has NO CONSTRUCTIBLE AuditActor today**
 * — and the tempting fix, `{ kind: 'system' }`, is laundering an agent read into
 * the machinery variant, which typechecks and which that constant's own comment
 * forbids. Verified: `grep -c 'AuthorizationGrantId\|authorizationId'
 * model/agents.ts` → 0, so `DerivedAgentGrant` has no authorisation join key at
 * all. Whether the pass moves behind exception-raising (legal today, and it
 * changes the product surface — exceptions that appear and clear within
 * seconds) or `DerivedAgentGrant` gains the field (diff-plan DP-6) is the
 * owner's, not mine. Emitting a request rather than making a call is what lets
 * this module compile and be correct under EITHER ruling.
 *
 * 🛑 ONE PROMPT CARRIES EXACTLY ONE COUNTERPARTY DESCRIPTION. THIS IS THE
 * RULING AGAINST BATCHED CONTEXT AND IT IS THE MOST IMPORTANT LINE IN THE FILE.
 * Batching N residue rows into one prompt to amortise the authorisation, the
 * audit-chain lock and the token side channel puts N counterparty-controlled
 * descriptions and a shared candidate list in one context window — and
 * description #1 is then in a position to instruct the reader about the verdict
 * for description #7. An index-only output contract does NOT close that: the
 * containment argument is about the ALPHABET of the output, and the attack does
 * not need a new symbol, it needs `candidateIndex: 3` on a row that should have
 * been `no_candidate`. Attacker-controlled text sitting in the same context as
 * the decision for another party's row is precisely what invariant 6 forbids.
 *
 * The constraints that motivated batching are real and they are satisfied a
 * different way: BATCH THE TRANSPORT, NOT THE CONTEXT. One
 * `AuthorizationGrant` covers a batch of requests; the requests are N
 * independent single-record calls; the meters are summed per call and shipped
 * together. `MAX_AUTHORIZATION_SECONDS` (`model/access.ts:1468`) bounds GRANT
 * LIFETIME, not context width, so it never required a shared prompt. The type
 * below carries exactly one description and there is no plural arm, so the
 * shape is not available to be chosen later in a hurry.
 * ==================================================================== */

/**
 * One candidate the PRIVILEGED side offers. The model may name it only by
 * index.
 *
 * `identifierForPrompt` is OUR OWN normalised identifier — the tenant's ledger
 * reference. It is tenant data going to the tenant's own gated model call, and
 * it is what makes the reading possible at all. `ref` is NOT put in the prompt;
 * it is how the privileged side resolves the returned index.
 */
export interface ReaderCandidate {
  readonly index: number
  readonly ref: ItemRef
  readonly identifierForPrompt: string
}

export interface ReaderRequest {
  readonly requestOrdinal: number
  readonly subjectRef: ItemRef
  /** ⚠️ COUNTERPARTY-CONTROLLED. Exactly one record's. Data, never instruction. */
  readonly untrustedDescription: string
  /** Checked against `ModelUseConfig.maxDataClassInPrompt` BY THE CALLER. */
  readonly untrustedDescriptionClass: DataClass
  readonly candidates: readonly ReaderCandidate[]
}

/**
 * What may cross back from the quarantined side. AN INDEX, NEVER A STRING.
 *
 * ⚠️ STRICTLY STRONGER THAN THE BRIEF'S OPTION (b). "The LLM returns only the
 * extracted ID" still lets an attacker-composed string enter the engine, and
 * that string then flows into a `MatchGroup`, an `Explanation`, a proposal, an
 * `AuditEvent` and a later prompt. Here the privileged side supplies the
 * VOCABULARY and the quarantined side CHOOSES FROM IT.
 *
 * FOUR ARMS, NOT FIVE. The draft's contract, and one of the designs, carried
 * both `AMBIGUOUS_ID` and `MULTIPLE_IDS_DETECTED`. Those are one fact with two
 * names — "more than one candidate fits" — and a union with two spellings of one
 * value is §5.3 in miniature, on the single type whose whole job is to be
 * closed. `several` is that fact; the caller sees how many.
 *
 * `confidenceBasisPoints` is KEPT and ruled NON-LOAD-BEARING. It is a model's
 * self-report about attacker-influenced input, so it is itself
 * attacker-influenceable. It may ORDER A QUEUE; it may never GATE A
 * DISPOSITION. Autonomy is governed by `AutonomyConfig`, never by a model's
 * opinion of itself. ⚠️ That ruling lives in this comment and nothing enforces
 * it, which is §5.1's shape — recorded as a deliberate choice of expressiveness
 * over enforceability, once.
 */
export type ReaderVerdict =
  | { kind: 'candidate'; candidateIndex: number; confidenceBasisPoints: number }
  | { kind: 'several'; candidateIndices: readonly number[]; confidenceBasisPoints: number }
  | { kind: 'no_candidate'; confidenceBasisPoints: number }
  | { kind: 'unreadable'; confidenceBasisPoints: number }

/**
 * 🟢 THE CONTAINMENT PROOF. If a `string` ever appears anywhere inside
 * `ReaderVerdict`, at any depth, this is a compile error.
 *
 * VERIFY IT RED BEFORE TRUSTING IT GREEN: add `canonicalId: string` to the
 * `candidate` arm and `tsc` reports
 *   TS2344: Type 'ReaderVerdict' does not satisfy the constraint
 *           'NoTextDeep<ReaderVerdict>' … Type 'string' is not assignable to
 *           type 'never'.
 * The tempting edits are exactly two — someone will want the extracted id back
 * for a nicer explanation, and the regex back for a cache — which is why they
 * are named here rather than left to a reviewer to remember.
 */
export type _ReaderVerdictHoldsNoTextDeep = AssertNoTextDeep<ReaderVerdict>

/**
 * A malformed response is an OUTCOME, not an error, and never a rescue-scrape.
 *
 * ⚠️ THE DRAFT'S `try/catch` THAT REGEX-SCRAPES `\{[\s\S]*\}` OUT OF THE
 * RESPONSE IS REJECTED OUTRIGHT, on two grounds. First, it is a second greedy
 * regex over attacker-influenced text — the S1 bug one layer down, inside the
 * code written to handle S1's failure. Second and worse: a model that ignored
 * the FORMAT instruction is a model that may have ignored the OTHER
 * instructions, and the correct inference is "this call is untrustworthy", not
 * "let me go and find the JSON".
 *
 * ZERO retries on `contract_violation` — retrying with a different prompt is
 * negotiating with the input. At most one retry on a TRANSPORT failure, and it
 * must reuse the same idempotency key or it double-meters (§8).
 *
 * ⚠️ ON `temperature: 0`. The draft calls it determinism. It is not: no vendor
 * guarantees bitwise reproducibility across replicas or model versions. The
 * honest claim is "no sampling diversity". The reproducibility property that
 * actually matters for invariant 10 is that the verdict is WRITTEN TO A ROW and
 * the rest of the engine reads the row — a re-run does not re-ask.
 */
export type ReaderRefusal =
  | { kind: 'not_implemented' }
  | { kind: 'contract_violation' }
  | { kind: 'response_truncated' }
  | { kind: 'response_exceeded_byte_cap' }
  | { kind: 'transport_failed' }
  /** The model named an index outside the candidate set. Containment held. */
  | { kind: 'candidate_index_out_of_range' }
  /** `resolveModel()` returned `{ ok: false }`. A refusal, never a fallback. */
  | { kind: 'model_rejected_by_policy' }
  | { kind: 'field_not_eligible_for_prompt' }

export type _ReaderRefusalHoldsNoText = AssertNoTextDeep<ReaderRefusal>

/**
 * Provider-reported token counts. NEVER ESTIMATED.
 *
 * If the provider response omits them, the caller passes `null` and NO TOKEN
 * METER IS EMITTED — a computed estimate written into an append-only table with
 * no compensating instrument (`model/billing.ts:133`) is fabricated revenue
 * data. `providerRequestId` is the vendor's own string and stays bare under
 * rule R1: branding a foreign namespace claims an authority we do not have.
 *
 * ⚠️ NOT asserted with `AssertNoTextDeep`, deliberately, and the reason is the
 * point of the assertion: `providerRequestId` IS a plain string, so this type
 * would fail — correctly. It is not a quarantined output; it is transport
 * metadata the privileged side reads from the SDK, never from the model's
 * generated content. Asserting it would be asserting the wrong thing about the
 * wrong type, which is the distinction `_CarriedTurnHoldsNoText` already makes
 * for `AskTurn`.
 */
export interface ReaderTokenUsage {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly modelEntryId: ModelCatalogEntryId
  readonly providerRequestId: string
}

export type ReaderOutcome =
  | { kind: 'verdict'; requestOrdinal: number; verdict: ReaderVerdict; usage: ReaderTokenUsage | null }
  | { kind: 'refused'; requestOrdinal: number; refusal: ReaderRefusal; usage: ReaderTokenUsage | null }

/**
 * The seam. The caller supplies an implementation; this module never does.
 *
 * The implementation's obligations, in order, none skippable — every one of
 * them is OUTSIDE this module because every one of them needs authority,
 * identity or a clock, and this module has none of the three:
 *
 *  1. `authorize()` (`model/access.ts:1610`) mints an `AuthorizationGrant`.
 *     Nothing else mints one. Invariant 10: an act with no authorisation is
 *     unrecordable, and the grant's id lands on the `AuditEvent`, the
 *     `DataAccessEvent` and the `UsageRecord` alike.
 *  2. `FieldSpec.modelProcessingAllowed` (`model/domain.ts:1597`) is true and
 *     `request.untrustedDescriptionClass` is at or below
 *     `ModelUseConfig.maxDataClassInPrompt`. ⚠️ `resolveModel()` DOES NOT CHECK
 *     CLASSIFICATION and people will assume it does. These two are invariant
 *     4's own mechanism — per-field and pack-declared — so they are derived
 *     from `FieldSpec`, never re-invented as a gate.
 *  3. `resolveModel()` (`model/catalog.ts:184`) with `allowedModels`,
 *     `allowedRegions` and `requireZeroRetention` from
 *     `EffectivePolicySet.modelUse`. The `ModelCatalogEntryId` comes from a
 *     catalogue row the FDE published downward (G49, G104). ⚠️ **THERE IS NO
 *     MODEL IDENTIFIER LITERAL ANYWHERE IN THIS MODULE and there must never be
 *     one** — `docs/build-conventions.md` §3 bans it, and a bare string skips
 *     the only executable enforcement of invariant 7.
 *  4. On `{ ok: false }`: return `{ kind: 'refused', refusal:
 *     'model_rejected_by_policy' }`. NO FALLBACK. `ModelFallbackChain` is
 *     `@dropped-for-v1` anyway (`model/catalog.ts:150`).
 *  5. Refuse BEFORE parsing on a byte cap or a truncated stop reason —
 *     truncated JSON that happens to parse is the worst case, because it parses.
 *  6. Emit the audit and access rows. ⚠️ `AuditEvent.chain` is a `RecordChain`
 *     over a "canonical body" and NO CANONICALISATION SCHEME IS APPLIED YET:
 *     G20 picked RFC 8785 / JCS and `docs/build-conventions.md` §2 marks it
 *     "not applied, and irreversible after the first hash". **Nothing may write
 *     a chained row until JCS lands.**
 *
 * Nothing above is enforceable from inside this module, and saying so is part
 * of the deliverable. What IS enforceable from here is that the module cannot
 * do any of it wrongly, because it cannot do any of it at all.
 */
export type NormalisationReader = (request: ReaderRequest) => ReaderOutcome

/**
 * 🛑 THE UNIMPLEMENTED SIDE OF THE SEAM. THIS IS A STUB AND IT SAYS SO.
 *
 * It returns a REFUSAL, not a fabricated value. The draft's own failure mode
 * here was `return []` — a fabricated empty result that is indistinguishable
 * from "the model found nothing", so a broken integration reads as a clean
 * reconciliation. `CLAUDE.md` forbids inventing data or mocking an API; a
 * refusal is neither.
 *
 * The Bedrock `InvokeModel` call belongs behind this signature, in the
 * data-plane worker (G107), with the six obligations above discharged in order.
 */
export function notImplementedReader(_request: ReaderRequest): ReaderOutcome {
  return {
    kind: 'refused',
    requestOrdinal: _request.requestOrdinal,
    refusal: { kind: 'not_implemented' },
    usage: null,
  }
}

/**
 * Builds the reader requests for the residue.
 *
 * TWO BOUNDS, AND ONLY ONE OF THEM IS AUTHORABLE:
 *
 *  - the candidate set is built under an EXACT amount anchor, ALWAYS, whatever
 *    `StrategyBinding.amountAnchor` says. `amountAnchor` tunes pairing; it may
 *    not widen what the quarantined model is shown.
 *  - `candidateCap` is a hard ceiling. A subject whose candidate set exceeds it
 *    is NOT sent — it goes to the residue as `unidentified`. ⚠️ The VALUE is the
 *    caller's and there is no default: a bound with no number is not a bound
 *    (§5.6), and a default would be a number I invented.
 *
 * An EMPTY candidate set produces NO REQUEST. The reader can only ever confirm
 * something that already exists on our side; a payment naming an obligation
 * genuinely absent from the ledger gets nothing, and that is correct for
 * reconciliation — the residue is the product. ⚠️ It also means this seam is NOT
 * a general-purpose extractor and must never be reused as one.
 */
export function buildReaderRequests(
  state: MatchingState,
  residue: readonly ResidueEntry[],
  candidateCap: number,
): readonly ReaderRequest[] {
  if (!Number.isInteger(candidateCap) || candidateCap < 1) return []
  const requests: ReaderRequest[] = []
  const rightOpen = openItems(state, 'right')

  for (const entry of residue) {
    if (entry.side !== 'left') continue
    /* 🛑 G227 — A HELD READ IS NEVER SENT TO THE READER, AND THE FILTER IS HERE
     * AS WELL AS IN `openItems` BECAUSE SUBJECTS COME FROM THE RESIDUE AND
     * CANDIDATES COME FROM THE LEDGER. `openItems` below covers the candidate
     * side only. Asking a model about a row whose own read the pack declared
     * untrustworthy answers the floor's question — *is a person asked?* — with
     * *no, a model was*, which is the substitution G139's floor exists to
     * prevent. */
    if (entry.heldReads.length > 0) continue
    const item = state.items.get(itemKey(entry.side, entry.ref))
    if (item === undefined) continue
    const description = item.untrustedDescription
    const dataClass = item.untrustedDescriptionClass
    if (description === null || dataClass === null) continue

    const candidates: ReaderCandidate[] = []
    for (const other of rightOpen) {
      const residual = residualOf(state, other.key)
      if (!residual.ok || !isPositiveMoney(residual.value)) continue
      const comparison = compareMoney(residual.value, item.gross)
      if (!comparison.ok || comparison.value !== 0) continue
      const identifier = [...other.identifiers.values()][0]
      if (identifier === undefined) continue
      candidates.push({ index: candidates.length, ref: other.ref, identifierForPrompt: identifier })
      if (candidates.length > candidateCap) break
    }
    if (candidates.length === 0 || candidates.length > candidateCap) continue

    requests.push({
      requestOrdinal: requests.length,
      subjectRef: item.ref,
      untrustedDescription: description,
      untrustedDescriptionClass: dataClass,
      candidates,
    })
  }
  return requests
}

export interface ReaderApplication {
  readonly state: MatchingState
  readonly meterFacts: readonly MeterFact[]
  readonly unresolved: readonly { readonly ref: ItemRef; readonly cause: ResidueCause }[]
}

/**
 * Folds reader outcomes back into the ledger. Pure; validates every index.
 *
 * THE INDEX BOUNDS CHECK IS THE CONTAINMENT ENFORCEMENT POINT. A verdict naming
 * an index outside the request's candidate array is converted to a refusal and
 * NOT to a lookup — under `noUncheckedIndexedAccess` the naive read is
 * `T | undefined`, and an undefined candidate silently skipped is A9(d)
 * reintroduced at the seam.
 *
 * `several` and `unreadable` never allocate. The reader's job is to CONFIRM a
 * single candidate or to say it cannot; anything else is a finding for a human.
 */
export function applyReaderVerdicts(
  state: MatchingState,
  requests: readonly ReaderRequest[],
  outcomes: readonly ReaderOutcome[],
): ReaderApplication {
  let current = state
  const meterFacts: MeterFact[] = []
  const unresolved: { ref: ItemRef; cause: ResidueCause }[] = []
  const byOrdinal = new Map<number, ReaderRequest>()
  for (const request of requests) byOrdinal.set(request.requestOrdinal, request)

  for (const outcome of outcomes) {
    if (outcome.usage !== null) meterFacts.push(...tokenMeterFacts(outcome.usage))
    const request = byOrdinal.get(outcome.requestOrdinal)
    if (request === undefined) continue

    if (outcome.kind === 'refused') {
      unresolved.push({
        ref: request.subjectRef,
        cause: { kind: 'reader_refused', refusal: outcome.refusal },
      })
      continue
    }
    const verdict = outcome.verdict
    if (verdict.kind !== 'candidate') {
      unresolved.push({ ref: request.subjectRef, cause: { kind: 'reader_found_no_candidate' } })
      continue
    }
    const candidate = request.candidates[verdict.candidateIndex]
    if (candidate === undefined) {
      unresolved.push({
        ref: request.subjectRef,
        cause: { kind: 'reader_refused', refusal: { kind: 'candidate_index_out_of_range' } },
      })
      continue
    }
    const subjectKey = itemKey('left', request.subjectRef)
    const candidateKey = itemKey('right', candidate.ref)
    const subjectResidual = residualOf(current, subjectKey)
    const candidateResidual = residualOf(current, candidateKey)
    if (!subjectResidual.ok || !candidateResidual.ok) continue
    const amount = minMoney(subjectResidual.value, candidateResidual.value)
    if (!amount.ok) continue
    const modelEntryId = outcome.usage === null ? null : outcome.usage.modelEntryId
    if (modelEntryId === null) {
      unresolved.push({
        ref: request.subjectRef,
        cause: { kind: 'reader_refused', refusal: { kind: 'contract_violation' } },
      })
      continue
    }
    const applied = applyAllocation(current, candidateKey, subjectKey, amount.value, {
      kind: 'reader_confirmed',
      confidenceBasisPoints: verdict.confidenceBasisPoints,
      modelEntryId,
    })
    if (applied.ok) current = applied.state
  }
  return { state: current, meterFacts, unresolved }
}

/* ==================================================================== *
 * §8  METERS — the missing producer for `input_tokens` / `output_tokens`
 *
 * §4.1 of the handoff records that these two meters "have no producer — found
 * independently by three agents". This module is that producer, and it produces
 * FACTS rather than records: a `UsageRecord` needs a `dataPlaneId`, a
 * `sequence`, an `at`, a `recordedAt` and an `authorizationId`, and this module
 * has no clock, no plane identity and no authority. The caller assembles them.
 *
 * 🛑 THE IDEMPOTENCY KEY IS METER-QUALIFIED, AND THE LIVE RECOMMENDATION IS
 * WRONG. `UsageRecord` carries ONE `meter` and ONE `quantity`
 * (`model/billing.ts:182`), so a single model call produces TWO rows.
 * `docs/build/event-architecture-recommendation.md` §5.4 recommends
 * "idempotencyKey = the provider's own request id" for BOTH. `/metering/record`
 * is idempotent on `idempotencyKey` and answers `409 IdempotencyConflict`, so
 * the second row is REJECTED and OUTPUT TOKENS ARE NEVER COUNTED — in
 * production, silently, with no error anyone sees. `${providerRequestId}#${meter}`
 * fixes it. Diff-plan DP-7 amends the field's own doc comment so the derivation
 * is stated where an implementer will read it.
 *
 * ⚠️ NO PRICE, NO COST, NO RATE. Invariant 5: money is always derived and
 * `UsageRecord` is immutable and UNPRICED. Nothing in this file imports
 * `MeterPrice`, `PriceTier`, `RateCard` or `RatedTotal`, and nothing reads
 * `ModelCatalogEntry.cost`. That is currently enforced by nobody; the design
 * record proposes it as a three-line CI grep.
 *
 * ⚠️ A SIDE CHANNEL I AM RECORDING RATHER THAN ASSERTING AWAY. `UsageRecord`'s
 * claim to be "PII-free BY CONSTRUCTION" is weaker than it reads: a token
 * quantity is a monotone function of prompt length, which is a function of
 * content. On a run whose residue is one row, `input_tokens` measures one
 * counterparty description. Per-record calls (§7) make this SHARPER, not
 * blunter, and that is the honest cost of the ruling against batched context. It
 * is a real trade and the security argument wins it, but it must be written
 * down rather than traded silently.
 * ==================================================================== */

export interface MeterFact {
  readonly meter: EngineMeter
  /** Integer. Provider-reported for tokens; counted for the rest. */
  readonly quantity: number
  /** `${providerRequestId}#${meter}` or `${runId}#${meter}`. Never bare. */
  readonly idempotencyKey: string
  /** Which catalogue row incurred it. Null for non-inference meters. */
  readonly modelEntryId: ModelCatalogEntryId | null
}

export function tokenMeterFacts(usage: ReaderTokenUsage): readonly MeterFact[] {
  if (!Number.isInteger(usage.inputTokens) || !Number.isInteger(usage.outputTokens)) return []
  return [
    {
      meter: 'input_tokens',
      quantity: usage.inputTokens,
      idempotencyKey: `${usage.providerRequestId}#input_tokens`,
      modelEntryId: usage.modelEntryId,
    },
    {
      meter: 'output_tokens',
      quantity: usage.outputTokens,
      idempotencyKey: `${usage.providerRequestId}#output_tokens`,
      modelEntryId: usage.modelEntryId,
    },
  ]
}

export function runMeterFact(runId: RunId, meter: EngineMeter, quantity: number): MeterFact {
  return {
    meter,
    quantity,
    idempotencyKey: `${runId}#${meter}`,
    modelEntryId: null,
  }
}

/* ==================================================================== *
 * §9  THE RUN, AND ITS POST-CONDITIONS
 * ==================================================================== */

/**
 * WHAT THE ENGINE ACTUALLY READS OFF A DOCUMENT — G1501, 21 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 A `Pick` OF `SourceDocument` AND NEVER A RESTATEMENT OF ONE, WHICH IS
 *    G1122's `StoredDefinition` MOVE IN THE OTHER DIRECTION.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `StoredDefinition` is an `Omit` of this module's own input, so a nineteenth
 * field on `SetReconciliationInput` is a `TS2739` in the reader rather than a
 * column somebody forgets. This is the same control applied to the operand: a
 * SIXTH field this engine starts reading off a document is a compile error at
 * every producer, rather than a field a producer quietly leaves undefined.
 *
 * ─── WHY IT IS FIVE, MEASURED RATHER THAN CHOSEN ────────────────────────────
 *
 * Every property access this module makes on a document, derived before the
 * type was narrowed and reproducible against any tree:
 *
 *     grep -rhoE '\b(document|doc)\.[a-zA-Z]+' model/*.ts | sort | uniq -c
 *     #   8 document.id · 3 document.controlTotal · 1 document.tenantId
 *     #   1 document.lines · 1 document.extracted        — and nothing else
 *
 * **`filename`, `storageRef`, `synthetic`, `purgeAfter`, `purgedAt`,
 * `ingestedAt` and `documentTypeId` are never read here.** The first five have
 * NO COLUMN ANYWHERE — `db/migrations/0012` §3 refuses each of them BY NAME,
 * on the ground that `ArrivalFacts` carries no filename and no object is
 * stored by this path — so a producer forced to supply a whole
 * `SourceDocument` would have to INVENT five facts per document to satisfy a
 * type the engine does not consult. `PRODUCT.md` forbids inventing a figure,
 * and a fabricated `synthetic: false` on a real document is worse than a
 * figure: it is an audit answer to *"was any real data ever in the sandbox?"*.
 *
 * ⚠️ THIS NARROWS AN APPETITE AND WIDENS NOTHING. A whole `SourceDocument`
 *    satisfies this structurally, so every call site that had one still
 *    compiles — `tests/scenarios/recon-corpus.ts` builds full documents and is
 *    untouched. What changes is that `server/data-plane/document-assembly.ts`
 *    can now supply exactly what it read out of columns.
 *
 * 🛑 AND IT BUYS A PROPERTY BEYOND HONESTY: **a reconciliation result can no
 *    longer depend on a file's NAME.** `filename` is counterparty-controlled
 *    and is not in this type, so no arm of this engine can branch on it —
 *    which invariant 6 would otherwise have to be argued about one call site
 *    at a time.
 */
export type ReconciliationDocument = Pick<
  SourceDocument,
  'tenantId' | 'id' | 'extracted' | 'lines' | 'controlTotal'
>

export interface SetReconciliationInput {
  readonly runId: RunId
  /**
   * ⚠️ CARRIED FOR REFUSAL, NEVER FOR SCOPE. Invariant 1 says tenant scope is
   * DERIVED FROM THE SESSION and never read from a request, so this is not the
   * engine deciding a tenant — it is the engine refusing a document set that
   * disagrees with the run it was handed.
   *
   * And it is explicitly the WEAKER of two lines. `model/access.ts` concedes the
   * same limit about itself: a caller that lifted the tenant out of a payload
   * has already broken the invariant before this function is reached, and no
   * check here can detect it. The real enforcement is G100's deny-on-NULL RLS
   * policy plus G101's explicit transaction carrying `SET LOCAL`. Describing
   * this check as the enforcement would be `MAX_GRANT_HOURS`'s failure again —
   * a comment claiming enforcement over zero call sites.
   */
  readonly tenantId: TenantId
  readonly left: PopulationBinding
  readonly right: PopulationBinding
  readonly leftDocuments: readonly ReconciliationDocument[]
  readonly rightDocuments: readonly ReconciliationDocument[]
  readonly pairing: PairingSpec
  /** Binds 1:1 to `pairing.strategies`, in order. Mismatch is a refusal. */
  readonly strategyBindings: readonly StrategyBinding[]
  /** Which population holds what is owed. Required by the waterfall. */
  readonly obligationSide: PopulationSide
  /** A9(g). Required, no default. See `ToleranceDirection`. */
  readonly toleranceDirection: ToleranceDirection
  /** G106: a path absent from this map is UNREADABLE. Fail-closed. */
  readonly fieldClassification: ReadonlyMap<FieldPathKey, DataClass>
  /** Caller's projection of `FieldSpec.modelProcessingAllowed`. Fail-closed. */
  readonly modelPromptEligible: ReadonlySet<FieldPathKey>
  /**
   * G227 — the caller's projection of `FieldSpec.confidenceFloor`, keyed as
   * `fieldClassification` is. Required and possibly EMPTY, never optional.
   *
   * 🛑 REQUIRED-AND-EMPTY RATHER THAN OPTIONAL, and the distinction is the one
   * this module keeps making: an empty map says *"no field on this run declared a
   * floor"*, an absent field says nothing, and only the first is a statement a
   * caller made. The `TS2741` at each construction site is the evidence the
   * decision was taken.
   *
   * ⚠️ AND IT IS DELIBERATELY NOT A `SetReconciliationRefusal` ON ABSENCE, unlike
   * the four bounds above it. Those are engine parameters with no safe default;
   * a floor is FDE-set PACK configuration whose surface does not exist yet
   * ([M2-3], under G139), so refusing every run until one exists would refuse
   * every run. The floors that ARE declared are enforced; nothing here invents
   * one, and `PRODUCT.md` is why.
   */
  readonly confidenceFloors: ReadonlyMap<FieldPathKey, number>
  readonly subsetSumBound: SubsetSumBound
  /** §7. Required, no default, must be a positive integer. */
  readonly readerCandidateCap: number
  /** Input cap for the similarity matrix. Required, no default. */
  readonly similarityMaxChars: number
  readonly similarityMetric: SimilarityMetric
  /**
   * C13 — THE ADMISSION FLOOR, AS A CEILING ON THE REFUSAL RATE. Required, no
   * default, integer basis points in [0, 10000).
   *
   * 🛑 THE UPPER BOUND IS EXCLUSIVE AND THAT EXCLUSIVITY IS THE WHOLE CONTROL.
   * At 10000 the comparison `refused × 10000 > 10000 × presented` reduces
   * algebraically to `admitted < 0`, which is unsatisfiable for a `.length` — so
   * a gate that admitted it would certify OFF as STATED, which is §5.2 wearing a
   * required-field costume. `SIMILARITY_MAX_CHARS_CEILING` is this module's own
   * precedent for a gate that refuses ABOVE a bound and not only below it.
   *
   * BASIS POINTS BECAUSE THIS MODULE ALREADY COUNTS IN THEM —
   * `levenshteinBasisPoints` and `ReaderVerdict.confidenceBasisPoints`. A second
   * rate unit would be §5.3.
   *
   * THE VALUE IS THE OWNER'S (O-8) and is FDE-set pack configuration in the
   * `FieldSpec.confidenceFloor` posture — never a constant here (`PRODUCT.md`).
   *
   * ⚠️ THE REMEDIATION IS "READ THE RATE", NEVER "RAISE THE CEILING".
   * `SetReconciliationResult.admissionRates` is recorded UNCONDITIONALLY, and
   * the refusal arm carries both operands, so a permissive ceiling suppresses
   * the refusal and never the evidence.
   */
  readonly admissionRefusalCeilingBasisPoints: number
}

export type SetReconciliationRefusal =
  | { kind: 'cross_tenant_documents' }
  | { kind: 'strategy_binding_count_mismatch'; expected: number; supplied: number }
  | { kind: 'strategy_binding_kind_mismatch'; index: number }
  | { kind: 'normalisation_invalid'; side: PopulationSide; defects: readonly NormalisationDefect[] }
  | { kind: 'reader_candidate_cap_not_stated' }
  | { kind: 'similarity_max_chars_not_stated' }
  | { kind: 'subset_sum_bound_not_stated' }
  /**
   * C13. The conformance floor was not stated, or was stated as an off-switch.
   * Same posture as the three bound arms above — an absent bound is a refusal,
   * never a default — with one addition that the other three do not need: this
   * arm also fires on `10000` and above, because at 10000 the comparison the
   * ceiling governs cannot be satisfied by any input. See the field's own
   * declaration on `SetReconciliationInput`.
   *
   * ⚠️ IT CARRIES NO NUMBER, unlike `admission_refusal_rate_above_ceiling`. The
   * rejected value is configuration the caller already holds, and echoing it
   * back would say nothing the caller does not know.
   */
  | { kind: 'admission_refusal_ceiling_not_stated' }
  /**
   * C16. A population whose denomination was not stated, or stated invalidly.
   * Same posture as the three bound arms above: an absent bound is a refusal,
   * never a default. Carries the reasoned `MoneyRefusal` rather than one flat
   * kind, because "no currency" and "exponent −1" are different operator errors
   * with different fixes (§5.2).
   */
  | { kind: 'declared_unit_invalid'; side: PopulationSide; refusal: MoneyRefusal }
  /**
   * C16. Two declarations that are each individually valid and do not name the
   * same denomination.
   *
   * 🛑 THIS IS THE ARM A PER-SIDE DECLARATION FORGETS, AND IT IS THE DANGEROUS
   * ONE. Declaring a unit per side and never reading one against the other moves
   * the error from the FILE into CONFIGURATION, where it is systematic and
   * silent: an FDE configuring `{SGD, 0}` against `{SGD, 2}` admits EVERY row on
   * both sides, allocates nothing, lands the whole population in the residue as
   * `no_strategy_paired` — *"nothing matched it"*, which is false — and
   * `postconditions` is EMPTY, because conservation over zero allocations is
   * trivially sound. A 100%-unmatched close reported SOUND.
   *
   * 🛑 THIS ARM CARRIED THE TOLERANCE COMPARISON TOO, AND THAT MADE A
   * MEANINGLESS STATE REPRESENTABLE. It shipped as
   * `{ against: 'other_side' | 'amount_tolerance'; strategyIndex: number | null }`,
   * so `{ against: 'other_side', strategyIndex: 3 }` COMPILED — a cross-side
   * comparison naming a strategy binding that took no part in it. Nothing but a
   * sentence in this comment said the field was `null` whenever `against` was
   * `other_side`, and a sentence is not a control: §5.5, an invalid state the
   * type made legal, inside a type written to close a different fail-open.
   *
   * Two kinds close it, each carrying exactly the fields that mean something for
   * it. THIS one is the cross-side comparison — `sameUnit(left.declaredUnit,
   * right.declaredUnit)` — which names no tolerance and no strategy, so it
   * carries neither. The tolerance comparison is `tolerance_unit_disagrees`
   * below. Both still carry the reasoned `MoneyRefusal` rather than one flat
   * kind (§5.2): `currency_mismatch` and `exponent_mismatch` are different
   * operator errors with different fixes.
   */
  | { kind: 'declared_units_disagree'; refusal: MoneyRefusal }
  /**
   * C16. An amount tolerance denominated in something neither side declared.
   * The other half of the split above.
   *
   * `tolerance` names WHICH tolerance, because the fix differs and only one of
   * the two routes has an index to give:
   *
   *   - `pairing` — `input.pairing.amountTolerance`, the value the whole run
   *     falls back to. There is one of it, so there is nothing to index.
   *   - `strategy_binding` — `strategyBindings[index].amountTolerance`, the
   *     per-strategy OVERRIDE, which is what actually reaches `toleranceAdmits`
   *     (`binding.amountTolerance ?? input.pairing.amountTolerance`). The index
   *     is the binding an operator has to fix, and it is not optional here
   *     because a refusal from this route always has one.
   *
   * ⚠️ THE OVERRIDE IS NOT A DETAIL. A gate that inspected `pairing
   * .amountTolerance` alone would close the comparison it names and leave the
   * override open — §5.1, a rule keyed on the convenient landmark rather than on
   * the property it protects. The split does not narrow that coverage: both
   * routes still refuse, and the nested union is what makes "which route" a
   * question the type answers rather than a convention.
   */
  | {
      kind: 'tolerance_unit_disagrees'
      tolerance: { kind: 'pairing' } | { kind: 'strategy_binding'; index: number }
      refusal: MoneyRefusal
    }
  /**
   * C17. ONE arm carrying MANY named defects — the exact shape of
   * `normalisation_invalid` above, chosen so that a population reports every
   * defect it has rather than the first one found, and so that C18 and C13 add
   * a `PopulationDefect` member rather than a second refusal vocabulary.
   *
   * `side` is on the ARM and not inside each defect: every defect in the list
   * comes from one call of `checkPopulationIntegrity`, so a per-defect side
   * would be the same value repeated, and repeating it is how the two drift.
   */
  | {
      kind: 'population_integrity_refused'
      side: PopulationSide
      defects: readonly PopulationDefect[]
    }
  /**
   * C17's SECOND site, and it is a NAMED NEGATIVE CONTROL rather than a live
   * arm. `population_integrity_refused` runs first and refuses every population
   * that could reach it, so this is UNREACHABLE TODAY — said plainly instead of
   * being implied by coverage. Its only witness is a mutation: delete the §4a
   * call site and the corpus's duplicate-address fixtures refuse HERE instead,
   * with this kind.
   *
   * It stays because THIS is the line that loses the row. A `Map.set` that can
   * silently eat a transaction should not be one careless edit away from doing
   * it again, and a guard that only exists in the caller is a guard that stops
   * existing the moment a second caller appears.
   */
  | { kind: 'admitted_item_key_collision'; side: PopulationSide; ref: ItemRef }
  /**
   * C18, AND THE ONE ARM THAT MAY REFUSE. A format declared to carry a trailer
   * arrived without one, which is exactly what truncation looks like — so there
   * is no sound ledger to produce and no residue worth preserving. Argued for
   * ITSELF; the five comparison defects are post-conditions, because a wrong
   * number in a trailer must not delete a correct residue
   * (`POPULATION_DEFECT_DISPOSITION`).
   *
   * 🛑 IT IS THE ARM A NULLABLE PAIR CANNOT EXPRESS. `expectedLineCount: number
   * | null` reads *"unchecked"* for both "this format has no trailer" and "the
   * trailer should have been there and was not", and the second is the truncated
   * file. Collapse the three arms to the pair and the counter-example fixture
   * cannot be WRITTEN — which is the strongest form a control takes here.
   */
  | { kind: 'control_total_expected_but_absent'; side: PopulationSide; sourceDocumentId: SourceDocumentId }
  /**
   * O-15. A population presented ZERO rows and its binding did not declare that
   * zero is expected.
   *
   * 🛑 IT REFUSES RATHER THAN REPORTING, AND THE ASYMMETRY WITH
   * `population_wholly_refused` IS THE RULING RATHER THAN AN OVERSIGHT. A
   * wholly-refused side HAS rows, each carrying the reason admission gave, and
   * the residue is the product — refusing there would delete the output, which
   * is the argument that arm's own declaration makes. An EMPTY side has no rows
   * and therefore NO RESIDUE TO PRESERVE: nothing carries a reason and nothing
   * is operated on. Refusing costs no output here, and reporting would cost the
   * whole finding, because every conservation check accumulates from zero and
   * would sit beside the report saying SOUND.
   *
   * ⚠️ THE ADJUDICATION RECOMMENDED A POST-CONDITION AND THE OWNER RULED A
   * REFUSAL; the recommendation is recorded rather than dropped. Its argument
   * was *the residue must survive*, which is the right argument for
   * `population_wholly_refused` and does not reach here: an empty side has no
   * residue to survive.
   *
   * IT RUNS IN THE GATE SEQUENCE AND NOT IN §4a, for `control_total_expected
   * _but_absent`'s reason exactly — it needs no admitted item, no address and no
   * sum, only the documents the side was handed.
   *
   * ⚠️ IT CARRIES THE SIDE AND NOTHING ELSE, AND THE ABSENCE IS A STATEMENT.
   * Every count this arm could carry is zero by the condition that produced it,
   * and a field fixed at zero is a field a reader would try to read —
   * `defectDocument`'s `null` is the same idiom. Which population failed to
   * arrive is the whole address there is.
   */
  | { kind: 'population_empty_and_not_expected'; side: PopulationSide }

export type _SetReconciliationRefusalHoldsNoText = AssertNoTextDeep<SetReconciliationRefusal>

export type PostconditionFailure =
  /** THE load-bearing one. See §5's note on why conservation is a tautology. */
  | { kind: 'open_item_missing_from_residue'; count: number }
  | { kind: 'item_in_residue_twice'; count: number }
  | { kind: 'fully_allocated_item_in_residue'; count: number }
  | { kind: 'negative_residual'; count: number }
  | { kind: 'gross_not_partitioned'; admittedMinor: bigint; accountedMinor: bigint }
  /**
   * C18. A population-grain defect REPORTED beside a sound ledger rather than
   * refusing the run — every arm of `PopulationDefect` whose
   * `POPULATION_DEFECT_DISPOSITION` is `'report'`.
   *
   * 🛑 ONE WRAPPING ARM, NOT FIVE COPIES. `PopulationDefect` is the vocabulary
   * and this is the envelope, exactly as `population_integrity_refused` is the
   * envelope on the refusal side. Re-declaring the five arms here would be two
   * spellings of one finding inside one module — §5.3, the shape this record has
   * seen recur most — and the two would drift the first time an arm gained a
   * field.
   *
   * One post-condition PER DEFECT, in the order `checkPopulationIntegrity`
   * emitted them: a shredded trailer produces a count disagreement AND a total
   * disagreement, and the two are independent findings about the same file.
   */
  | { kind: 'population_integrity_reported'; side: PopulationSide; defect: PopulationDefect }
  /**
   * C13's NON-CONFIGURABLE HALF. Every row on this side was presented and none
   * was admitted, so the ledger is sound over NOTHING.
   *
   * 🛑 NOT A REFUSAL, AND THIS ARM PROTECTS A DECISION RATHER THAN A MECHANISM.
   * Refusing DELETES THE RESIDUE, and a wholly-refused population is exactly the
   * case where the residue — one entry per row, each carrying the reason
   * admission gave — IS the output an operator needs.
   * `unclassifiedFieldFailsClosed` is the corpus scenario whose entire point is
   * that a G106 refusal arrives with its reason attached; refusing here would
   * replace it with a count. If a later reader "hardens" this into a refusal,
   * `wholeRunRefusedStillProducesTheResidue` is the fixture that must go red.
   *
   * THE REJECTED ALTERNATIVE IS RECORDED RATHER THAN DROPPED: a third result
   * channel (`SetReconciliationResult.populationFindings`) was considered and
   * refused, because a channel with no caller obligation is C13 one layer up —
   * whereas `postconditions` already carries a stated obligation.
   *
   * IT NEEDS NO NUMBER FROM ANYBODY, which is why it lands regardless of whether
   * a ceiling has been agreed, and why it is on a different half of C13 from
   * `admission_refusal_rate_above_ceiling`.
   *
   * `presented === 0` is NOT this arm, and O-15 is now the answer rather than a
   * forward reference. An empty population has no rows to have refused, so it
   * REFUSES the run at the gate — `population_empty_and_not_expected` — unless
   * its binding declared `emptyExpectation: 'permitted'`. A population that
   * reaches this loop with `presented === 0` is therefore one somebody declared
   * capable of being empty, and reporting it here would be reporting a
   * declaration back to the caller who made it.
   */
  | { kind: 'population_wholly_refused'; side: PopulationSide; sideRowCount: number }

export type _PostconditionFailureHoldsNoText = AssertNoTextDeep<PostconditionFailure>

/* ==================================================================== *
 * §9a  COMPLETENESS — O-16 / G153
 *
 * 🛑 THE DEFECT THIS SECTION EXISTS TO END, STATED AS THE ENGINE'S OWN
 * SENTENCE. Every arm of `PostconditionFailure` above is a count or a
 * comparison WITHIN the admitted set, and `checkPostconditions` iterates
 * `state.items`. So the engine could say *"what I was given balances"* and
 * never *"I was given everything"* — a ledger perfect over two of three rows
 * returned `postconditions: []`, which reads as a clean close.
 *
 * 🛑 AND THE ENGINE ALREADY KNEW. C13 made `admissionRates` UNCONDITIONAL, so
 * `{ presented: 3, admitted: 2 }` sat in the SAME result object as the empty
 * `postconditions`, and C18 put the file's own trailer disagreement two fields
 * away. **O-16 is not a new measurement. It is a join that was never made**,
 * and saying so plainly is what keeps this section from being read as a new
 * source of truth about the population.
 *
 * *Inconsistent* means do-not-persist. *Incomplete* means sound over less than
 * everything — persistable, over a population that is not the population.
 * Different acts for different people, which is why `RunStatus` gains a member
 * (`model/domain.ts`) rather than this landing as a flag on `completed`.
 *
 * 🛑 THE BOUNDARY, AND IT IS THE MOST IMPORTANT SENTENCE HERE. The engine knows
 * what the documents it was HANDED presented, and what a file said about
 * ITSELF. **Nothing in this repository knows what ARRIVED.** There is no
 * manifest, no delivery receipt and no expected-file register, so *"ten files
 * were despatched and three landed"* is invisible to every finding below and
 * would stay invisible if all three were internally perfect. The arrivals
 * denominator is a real, open, unclosed gap; O-16 is scoped to what the engine
 * can actually observe, and a count invented to make this state tidy would be a
 * number with no source.
 * ==================================================================== */

/**
 * Which PROPERTY each post-condition arm is about — the classifier that makes
 * *incomplete* expressible without a second engine.
 *
 * 🛑 THIS IS THE DECLARATION THAT STOPS `postconditions.length > 0` FROM
 * MEANING `failed`. Two of the seven arms were never about soundness at all,
 * and the docblock on `SetReconciliationResult.postconditions` had already been
 * corrected once to admit it: *"Non-empty means EITHER the ledger is unsound OR
 * the population it was computed over is not the population."* Two properties
 * on one channel, distinguished nowhere. That sentence is the O-16 defect
 * written down eight days before O-16, and this record is what a caller reads
 * instead of guessing.
 *
 * WHY `population_integrity_reported` IS COMPLETENESS FOR EVERY DEFECT IT CAN
 * WRAP, with no per-arm test. C18 already drew that line and drew it on a
 * stronger criterion than this one could: **who controls the operand.** A
 * defect whose operand is counterparty-controlled content REPORTS and never
 * refuses, because refusing hands the party being reconciled against a one-cell
 * kill switch on the whole close. Every defect reaching this envelope is by
 * construction one of those, and every one of them says the file's account of
 * itself could not be met — which is a completeness claim, never a claim about
 * the ledger's arithmetic. Re-testing each arm here would be a second, weaker
 * copy of `POPULATION_DEFECT_DISPOSITION` (§5.3).
 *
 * A total `Record` and not a lookup, for the reason `POPULATION_DEFECT_DISPOSITION`
 * is one: the next arm somebody adds is a COMPILE ERROR until it is classified,
 * rather than defaulting into whichever bucket an `else` happens to be.
 * ⚠️ And read `docs/HANDOFF.md` §5.10 on what that proves — a total `Record`
 * bites where something CONSTRUCTS one, and this object is constructed here, so
 * the compile error is real for the KEY SET and says nothing about whether the
 * VALUE chosen for a new arm is the right one. Only a fixture witnesses that.
 */
export const POSTCONDITION_PROPERTY = {
  open_item_missing_from_residue: 'soundness',
  item_in_residue_twice: 'soundness',
  fully_allocated_item_in_residue: 'soundness',
  negative_residual: 'soundness',
  gross_not_partitioned: 'soundness',
  population_integrity_reported: 'completeness',
  /* C13's non-configurable half. A side where every presented row refused is
   * the EXTREME of incomplete, not a case of unsoundness: the arm's own
   * docblock says the ledger is "sound over NOTHING", and refusing it was
   * refused because the residue is then the only output there is. */
  population_wholly_refused: 'completeness',
} as const satisfies Record<PostconditionFailure['kind'], 'soundness' | 'completeness'>

/**
 * WHAT the engine could not establish about completeness — and it carries the
 * magnitude and the address, never a bare fact that something is amiss.
 *
 * 🛑 A BOOLEAN WAS REFUSED, AND THE REASON IS THE WHOLE POINT OF THE CHANNEL.
 * `complete: false` reproduces O-16 one remove out: an operator learns that
 * *something* is missing and cannot tell a mapper that dropped one row in three
 * from a shredder that truncated a file, which are different remedies applied
 * by different people. Both arms below carry counts an operator can act on, and
 * both name the SIDE so the fix is a population rather than a search.
 *
 * TWO ARMS, AND THEY ARE DISJOINT BY WHAT WITNESSES THEM.
 *   • `rows_presented_not_admitted` — the run's OWN observation. It needs no
 *     trailer and no cooperation from the file: the documents presented N rows
 *     and admission produced fewer.
 *   • `source_self_report_unmet` — the FILE's observation about itself, which
 *     the run merely failed to meet. Invisible to the first arm, because every
 *     row that arrived may be perfectly readable.
 * A run can carry both, and test 1 and test 4 of
 * `tests/model/run-completeness.test.ts` exist because an implementation
 * handling only one of the two passes half of it.
 *
 * ⚠️ NEITHER ARM MEANS DO-NOT-PERSIST. That is `postconditions` on a soundness
 * arm, and the two channels are kept apart precisely so a caller can persist a
 * partial close and refuse an unsound one.
 *
 * ⚠️ AND NEITHER ARM IS AN ARRIVALS COUNT. See §9a's banner: the denominators
 * here are rows the handed documents PRESENTED and a number the file wrote
 * about itself. Nothing here can see a file that never arrived.
 */
export type CompletenessFinding =
  /**
   * Rows the documents on this side PRESENTED, and the smaller number admission
   * produced. C13's record, joined to an outcome for the first time.
   *
   * 🛑 THE TEST IS `presented > admitted`, NOT `refused > 0`, AND THAT IS NOT
   * COSMETIC. `AdmissionRate.presented` is folded from the DOCUMENTS, a source
   * independent of the admission fold, which is what makes
   * `presented === admitted + refused` a property rather than a tautology. A
   * fold that LOST a row without refusing it — the C17 class, one grain up —
   * moves `admitted` and leaves `refused` alone, so keying on `refused` would
   * miss exactly the case where the shortfall was silent. `refused` is carried
   * beside them as evidence, and `presented !== admitted + refused` is a
   * caller-checkable disagreement between two independent counts.
   *
   * ⚠️ AND THE STRONGER TEST IS UNWITNESSED TODAY — SAID HERE RATHER THAN LEFT
   * FOR SOMEBODY TO ASSUME. Verified by mutation on the day this landed:
   * replacing the condition with `rate.refused === 0` leaves the ENTIRE suite
   * green, because no fixture in the tree loses a row without refusing it —
   * C17 refuses an address collision before the fold can eat one, which is the
   * only route the engine has to a silent loss. So the stronger test is a
   * DEFENCE against a defect the engine cannot currently produce, not a
   * property any test here proves. Do not cite it as covered, and if C17's
   * guard is ever relaxed this is the line that must gain a fixture.
   *
   * WHICH rows, and why they are not listed here. `refusedAtAdmission` already
   * carries one entry per refused row with its `ref` and the reason admission
   * gave, and the residue carries the rest. Restating them inside this arm
   * would be a second copy of the module's own output (§5.3) that could drift
   * from it.
   *
   * `admitted === 0` is not a separate arm. A wholly-refused side is this arm
   * at its extreme and is reported as such rather than as a fifth vocabulary;
   * `population_wholly_refused` continues to say the same thing on
   * `postconditions`, where C13 put it.
   */
  | {
      kind: 'rows_presented_not_admitted'
      side: PopulationSide
      presented: number
      admitted: number
      refused: number
    }
  /**
   * The file's own account of itself could not be met — C18's reported defects,
   * re-addressed as the completeness facts they always were.
   *
   * 🛑 IT CARRIES THE `PopulationDefect` VERBATIM RATHER THAN RESTATING ITS
   * FIELDS. `PopulationDefect` is the vocabulary and this is a second envelope
   * over it, exactly as `population_integrity_reported` is the first; declaring
   * `declaredCount`/`documentRowCount` again here would be two spellings of one
   * finding inside one module, drifting the first time an arm gained a field
   * (§5.3). The two envelopes cannot diverge in MEMBERSHIP either, because
   * `runSetReconciliation` pushes both in one loop body from one `defect`.
   *
   * ⚠️ WHY THE C18 REPORTS ARE NOT SIMPLY MOVED HERE. They stay on
   * `postconditions` as well, and that duplication is deliberate rather than
   * unnoticed: `population_integrity_reported` is an APPLIED decision with
   * fixtures pinning it, and relocating an applied arm to tidy a new one would
   * amend C18 in a commit whose subject is O-16. The two channels answer
   * different questions — *what did the engine find* and *what could it not
   * establish about the population* — and `POSTCONDITION_PROPERTY` above is the
   * declaration that joins them rather than a third opinion.
   */
  | { kind: 'source_self_report_unmet'; side: PopulationSide; defect: PopulationDefect }

/**
 * 🟢 THE CONTAINMENT PROOF, and the fifteenth site in this module.
 *
 * ⚠️ VERIFY IT RED BEFORE TRUSTING IT GREEN — `Assert<never>` compiles, so a
 * vacuous proof reads exactly like a real one. Add `filename: string` to either
 * arm and `tsc` must report TS2344.
 *
 * ⚠️ AND READ `CLAUDE.md` ON WHAT IT PROVES: it bans the TYPE `string` at a
 * property position, not string-bearing values. A `ReadonlySet<string>` walks
 * straight through it. These findings will be logged and rendered on an
 * operator surface, and the counterparty controls a filename.
 */
export type _CompletenessFindingHoldsNoTextDeep = AssertNoTextDeep<CompletenessFinding>

/**
 * The three states a FINISHED run may be in.
 *
 * Derived from `RunStatus` by `Extract` rather than restated, and the direction
 * is chosen: `Extract` yields `never` for a member that was renamed, so every
 * `return` below stops compiling. `Exclude<RunStatus, 'queued' | 'running'>`
 * would silently widen to admit a new lifecycle state instead.
 */
export type TerminalRunStatus = Extract<RunStatus, 'completed' | 'failed' | 'incomplete'>

/**
 * O-16's JOIN — the outcome a caller records for a finished run.
 *
 * 🛑 THE ENGINE DOES NOT SET A RUN'S STATUS AND THIS FUNCTION IS NOT IT DOING
 * SO. `SetReconciliationResult` and `ReconciliationRun` are different objects;
 * the engine has no clock and no identity. This is a TOTAL, PURE derivation
 * from a finished result to the state a caller writes — one function rather
 * than a rule repeated at every call site, for G111's stated reason:
 * correctness that lives at call sites is correctness that drifts.
 *
 * 🛑 SOUNDNESS OUTRANKS COMPLETENESS, AND THE ORDER IS AN INSTRUCTION RATHER
 * THAN A PREFERENCE. `failed` means do-not-persist; `incomplete` means
 * persist-and-tell-somebody. A run that is both must report the stronger
 * instruction, because acting on the weaker one persists an unsound ledger. The
 * evidence for the other property is not lost by this: both channels are on the
 * result and a caller reads them whichever state it records.
 *
 * ⚠️ IT READS BOTH CHANNELS FOR `incomplete`, AND THE REDUNDANCY IS A GUARD
 * RATHER THAN AN OVERSIGHT. On every result this engine produces the two agree
 * by construction — a `population_integrity_reported` arrives with its
 * `source_self_report_unmet` from the same loop body, and
 * `population_wholly_refused` implies `presented > admitted`. The second read
 * is what happens when that stops being true: an arm classified `completeness`
 * in `POSTCONDITION_PROPERTY` whose producer forgot the matching finding would
 * otherwise report `completed`, which is O-16 recurring inside O-16's own fix.
 * Where the two disagree this answers `incomplete` — it fails toward telling
 * the operator, the same direction as G106's unreadable-by-default.
 *
 * ⚠️ `queued` AND `running` ARE NOT REACHABLE HERE and that is a statement about
 * the input, not an omission: a `SetReconciliationResult` exists only because a
 * run finished. `TerminalRunStatus` says so in the type rather than in a
 * comment nobody can run.
 */
export function terminalRunStatus(result: SetReconciliationResult): TerminalRunStatus {
  for (const failure of result.postconditions) {
    if (POSTCONDITION_PROPERTY[failure.kind] === 'soundness') return 'failed'
  }
  if (result.completeness.length > 0) return 'incomplete'
  for (const failure of result.postconditions) {
    if (POSTCONDITION_PROPERTY[failure.kind] === 'completeness') return 'incomplete'
  }
  return 'completed'
}

/**
 * EVERYTHING ONE RUN PRODUCED.
 *
 * 🛑 THIS INTERFACE CANNOT CARRY `AssertNoTextDeep` AND THE THREE REASONS ARE
 * NAMED HERE RATHER THAN LEFT AS AN ABSENCE, because the absence is what let two
 * arrays of counterparty-authored bucket keys sit on it until G217. An
 * unexplained missing proof reads as forgetfulness; this one is a statement.
 *
 *   · `state`          — `MatchingState.items` is a `ReadonlyMap`, and an
 *                        `AdmittedItem` holds `untrustedDescription`. This is
 *                        the ledger, and the ledger is made of the documents.
 *   · `readerRequests` — `ReaderRequest.untrustedDescription` is a bare `string`
 *                        BY DESIGN (§7). It is the one value that may enter a
 *                        prompt, and the type says so on itself.
 *   · `meterFacts`     — `MeterFact.idempotencyKey` is a `string` we mint.
 *
 * Every OTHER channel here either carries its own proof or is built from types
 * that do. The proof this slice adds is `_SearchBoundaryHoldsNoTextDeep` (§5a);
 * `_ResidueCauseHoldsNoText`, `_AdmissionRefusalHoldsNoText`,
 * `_PostconditionFailureHoldsNoText`, `_CompletenessFindingHoldsNoTextDeep` and
 * `_RunDocumentAccountHoldsNoTextDeep` are the others. A future channel with no
 * proof and no sentence here is the defect G217 was taken about, arriving again.
 *
 * ✅ AND ONE ARRIVED, WITH ITS PROOF, WHICH IS WHAT THE PARAGRAPH ABOVE IS FOR.
 * `toleranceDeclines` (G291, §5b) carries `_ToleranceDeclineHoldsNoTextDeep`,
 * attached at birth rather than retrofitted after somebody noticed two arrays of
 * counterparty text on the result type.
 */
export interface SetReconciliationResult {
  readonly state: MatchingState
  readonly residue: readonly ResidueEntry[]
  readonly refusedAtAdmission: readonly RefusedItem[]
  readonly ambiguities: readonly AmbiguityFinding[]
  readonly toleranceRefusals: readonly ToleranceRefusal[]
  /**
   * G291 — THE BUCKETS THAT JOINED AND WHOSE TOTALS MISSED THE TOLERANCE, as
   * counts plus the discarded figure plus one `ItemRef`. See §5b.
   *
   * 🛑 IT SITS BESIDE `toleranceRefusals` AND IS NOT PART OF IT, and the two
   * names are chosen so the split is legible without reading either type. A
   * REFUSAL is *this tolerance is nonsense* — a float arm, a `days` arm, a
   * denomination that does not match the population. A DECLINE is *this
   * tolerance is sound and it was too tight*. Two findings with two different
   * fixes, which is the whole of G291; putting them on one channel would be the
   * defect it corrects, one level up.
   *
   * ⚠️ UNCONDITIONAL AND POSSIBLY EMPTY, like `admissionRates`,
   * `documentAccounts` and `searchBoundary`, and for their reason: a channel
   * that only speaks when it fired cannot be told from one nobody wired up.
   *
   * 🛑 IT DOES NOT REACH THE WIRE YET AND THAT IS A NAMED GAP RATHER THAN AN
   * OVERSIGHT. `RunAccount` on `docs/contracts/capability.openapi.yaml` carries
   * NEITHER tolerance channel — `toleranceRefusals` has never been published
   * either — so putting this one on the wire alone would publish *the tolerance
   * was too tight* while *the tolerance is nonsense* stayed invisible, which is
   * the same two-findings-one-view defect pointing the other way. The ROW-level
   * half DOES reach the wire, as `amount_tolerance_declined` with its variance,
   * so an operator is no longer told *nothing matched it*. Publishing both
   * channels together is owed.
   */
  readonly toleranceDeclines: readonly ToleranceDecline[]
  /**
   * G217 — WHERE THE ENGINE STOPPED LOOKING, AS COUNTS PLUS `ItemRef`.
   *
   * ⚠️ THIS REPLACED `oversizedBuckets` AND `exhaustedBuckets`, both
   * `readonly (string | null)[]` OF COUNTERPARTY-AUTHORED JOIN KEYS. See §5a for
   * the ruling and for why the hash alternative was refused. Unconditional, like
   * `admissionRates` and `documentAccounts` and for their reason: a channel that
   * only speaks when it fired cannot be told from one nobody wired up.
   */
  readonly searchBoundary: SearchBoundary
  readonly readerRequests: readonly ReaderRequest[]
  readonly meterFacts: readonly MeterFact[]
  /**
   * C13. What admission did, per side, ALWAYS — see `AdmissionRate`. One entry
   * for `left` and one for `right`, in that order, on every successful run.
   */
  readonly admissionRates: readonly AdmissionRate[]
  /**
   * G236. What EVERY document said about itself, per side, in supplied order,
   * ALWAYS — see `RunDocumentAccount` and §4b's banner. One entry per document
   * on both sides, whether or not its trailer was met and whether or not it
   * declared one.
   *
   * 🛑 THE MET ROWS ARE THE POINT. A check that only speaks when it fails leaves
   * an operator unable to tell *"this file vouched for itself and was right"*
   * from *"this file said nothing"*, and this is the channel that separates
   * them. Reading only `postconditions` for a per-document table gives back
   * exactly the drawing G236 was taken to make buildable.
   *
   * ⚠️ IT IS NOT A SECOND VOCABULARY FOR C18. The disagreeing case carries the
   * same `PopulationDefect` values that reach `postconditions` and
   * `completeness`, by reference, from one call of `checkPopulationIntegrity`.
   * `admissionRates` is the same fact one grain up and neither replaces the
   * other: a rate is a property of a SIDE and a trailer is a property of a FILE.
   */
  readonly documentAccounts: readonly RunDocumentAccount[]
  /**
   * ⚠️ THIS READ *"Non-empty means the run produced an unsound ledger. Do not
   * persist it."* C13 made that false and it is corrected here rather than
   * deleted, because it is the sentence a caller would have trusted.
   *
   * Non-empty means EITHER the ledger is unsound OR the population it was
   * computed over is not the population. Two properties on one channel, argued
   * here rather than done quietly: a third result channel was refused because a
   * channel with no caller obligation is C13 one layer up.
   * `population_wholly_refused` is the arm that is sound-but-over-nothing.
   *
   * ⚠️ SINCE O-16, *"non-empty"* IS NOT AN INSTRUCTION AND MUST NOT BE READ AS
   * ONE. Which of the two properties an arm is about is declared by
   * `POSTCONDITION_PROPERTY`, and `terminalRunStatus()` is what a caller uses
   * instead of a length test. A caller that still treats this list as a
   * do-not-persist flag will discard sound partial closes — which is the same
   * defect O-16 fixes, pointing the other way.
   */
  readonly postconditions: readonly PostconditionFailure[]
  /**
   * O-16. WHAT the engine could not establish about COMPLETENESS, as opposed to
   * about soundness — see `CompletenessFinding` and §9a's banner. Non-empty
   * maps to `RunStatus.incomplete`; it does NOT mean do-not-persist.
   *
   * 🛑 A THIRD RESULT CHANNEL WAS REFUSED ONCE, AND THE OBJECTION IS ANSWERED
   * RATHER THAN IGNORED. C18 considered `populationFindings` and refused it on
   * the ground that *"a channel with no caller obligation is C13 one layer
   * up"* — whereas `postconditions` already carried a stated obligation. That
   * was right about a channel with no obligation, and this one HAS one: it
   * terminates in a run status a consumer must switch on, which is a different
   * act for a different person. Folding it into `postconditions` instead would
   * make a sound partial close indistinguishable from an unsound ledger, which
   * is precisely what G153 rules against.
   *
   * EMPTY ON A WHOLE RUN, and that is what makes the state worth having: a
   * channel that fired on everything would be routed around within a week.
   */
  readonly completeness: readonly CompletenessFinding[]
}

export type SetReconciliationOutcome =
  | { ok: true; result: SetReconciliationResult }
  | { ok: false; refusal: SetReconciliationRefusal }

/**
 * RESIDUE COMPLETENESS — the post-condition that actually catches A9(b).
 *
 * Every admitted item whose derived settlement is not `fully_allocated` appears
 * in the residue EXACTLY ONCE, and no `fully_allocated` item appears at all. A
 * partition check over the item set, not an identity over derived quantities.
 *
 * `gross_not_partitioned` is the second half and it is likewise non-tautological
 * BECAUSE IT IS COMPUTED FROM TWO INDEPENDENT SOURCES: the admitted items'
 * gross, and the sum of (settled + residue-carried) over what the residue and
 * the ledger say. A dropped item changes the second and not the first.
 *
 * 🛑 THE THIRD PARAMETER IS THE OPERAND C13 NEEDED, AND WITHOUT IT ONE PROPERTY
 * HERE IS NOT EXPRESSIBLE. Every check below iterates the ADMITTED set, so this
 * function trusts `state.items` to hold every item admission produced — a state
 * handed in one row short still balances, and a side where NOTHING was admitted
 * is trivially consistent. Reverse-engineering the wholly-refused case from the
 * residue instead would key on the residue's *happening* to hold refused rows,
 * which is §5.1, and it still could not tell a wholly-refused side from an
 * empty one. `AdmissionRate.presented` is folded from the DOCUMENTS, so the
 * claim joins two independent sources in the idiom the paragraph above sets.
 */
export function checkPostconditions(
  state: MatchingState,
  residue: readonly ResidueEntry[],
  admission: readonly AdmissionRate[],
): readonly PostconditionFailure[] {
  const failures: PostconditionFailure[] = []

  /* C13, FIRST, because it frames every count below it: on a wholly-refused
   * side there is nothing for them to be true OF.
   *
   * `presented === 0` IS SKIPPED, AND SINCE O-15 THE SKIP HAS A NAMED OWNER
   * RATHER THAN A FORWARD REFERENCE. An empty population has no rows to have
   * refused; `runSetReconciliation` refuses it at the gate with
   * `population_empty_and_not_expected` unless the binding declared
   * `emptyExpectation: 'permitted'`. Through the engine, then, this `continue`
   * is reached only on a DECLARED-empty side. Reached DIRECTLY — this function
   * is exported and called at six sites under `tests/` — it is still the right
   * behaviour: a rate of `0 / 0` is not a wholly-refused population, and this
   * function holds no binding to consult. */
  for (const rate of admission) {
    if (rate.presented === 0) continue
    if (rate.admitted > 0) continue
    failures.push({
      kind: 'population_wholly_refused',
      side: rate.side,
      sideRowCount: rate.presented,
    })
  }

  /* TWO MAPS OVER ONE ARRAY, BECAUSE THEY ANSWER TWO DIFFERENT QUESTIONS.
   *
   * `occurrences` counts EVERY residue entry at an address — that is what
   * `item_in_residue_twice` is about, and it must keep counting refused rows.
   * Two admission-refused copies of one address are exactly the outcome §4a's
   * `admitted_item_key_collision` narrowing declines to replace: both rows and
   * both reasons stay visible, reported here.
   *
   * `settled` counts only entries that CARRY a settlement, and it is the only
   * one `inResidue` below may read.
   *
   * 🛑 WHY THE SPLIT. An entry with `settlement: null` is an item REFUSED AT
   * ADMISSION (§4). It has no amount, it was never admitted, and it is not in
   * `state.items` at all — the ledger has no row for it. But `itemKey` is an
   * ADDRESS, not a value, so a refused copy of a duplicated address produces
   * the SAME key as an admitted twin. Counting it here made `inResidue` TRUE
   * for a ledger row whose residue entry belonged to the other copy, and every
   * consequence follows from that one lie: the twin's residual was credited as
   * residue-carried, `open_item_missing_from_residue` could not fire, and
   * `gross_not_partitioned` BALANCED over a ledger missing a transaction — with
   * `postconditions` empty. The residue and the ledger share one key space and
   * this check used to assume they did not.
   *
   * ⚠️ THIS IS UNREACHABLE THROUGH `runSetReconciliation()` AND THE GUARD STAYS
   * ANYWAY. C17's `population_integrity_refused` now refuses a population with
   * a duplicated address as soon as ONE copy is admitted, so no run can hand
   * this function a mixed admitted/refused pair. C17 MASKS this; it does not
   * fix it. `checkPostconditions` is exported, is called directly at six sites
   * under `tests/`, and is the check a caller runs to find out whether the
   * ledger it holds is sound. A post-condition that is only correct when its
   * caller is well-behaved is not a post-condition — it is a restatement of the
   * caller. Found by walking the two maps against each other, not by a failing
   * test; no corpus scenario reaches it.
   */
  const occurrences = new Map<string, number>()
  const settled = new Map<string, number>()
  for (const entry of residue) {
    const key = itemKey(entry.side, entry.ref)
    occurrences.set(key, (occurrences.get(key) ?? 0) + 1)
    if (entry.settlement === null) continue
    settled.set(key, (settled.get(key) ?? 0) + 1)
  }

  let duplicated = 0
  for (const count of occurrences.values()) if (count > 1) duplicated += 1
  if (duplicated > 0) failures.push({ kind: 'item_in_residue_twice', count: duplicated })

  let missing = 0
  let closedInResidue = 0
  let negative = 0
  /* ⚠️ `0n` SINCE 19 Sep 2026 — G286, AND THIS IS THE PAIR THE RULING IS
   * ABOUT. These two are CUMULATIVE TOTALS over a whole population: the one
   * place `Number.isSafeInteger`'s 2^53 ceiling was reachable without any single
   * amount going anywhere near it. G286: *"ample for one close and not ample for
   * a cumulative total."* */
  let admittedMinor = 0n
  let accountedMinor = 0n

  for (const item of state.items.values()) {
    admittedMinor += minorUnitsOf(item.gross)
    const settlement = settlementOf(state, item.key)
    if (!settlement.ok) continue
    const inResidue = (settled.get(item.key) ?? 0) > 0
    if (settlement.value.kind === 'fully_allocated') {
      accountedMinor += minorUnitsOf(settlement.value.allocated)
      if (inResidue) closedInResidue += 1
      continue
    }
    const residual = settlement.value.residual
    if (isNegativeMoney(residual)) negative += 1
    const allocated = settlement.value.kind === 'partially_allocated'
      ? minorUnitsOf(settlement.value.allocated)
      : 0n
    accountedMinor += allocated + (inResidue ? minorUnitsOf(residual) : 0n)
    if (!inResidue) missing += 1
  }

  if (missing > 0) failures.push({ kind: 'open_item_missing_from_residue', count: missing })
  if (closedInResidue > 0) {
    failures.push({ kind: 'fully_allocated_item_in_residue', count: closedInResidue })
  }
  if (negative > 0) failures.push({ kind: 'negative_residual', count: negative })
  if (admittedMinor !== accountedMinor) {
    failures.push({ kind: 'gross_not_partitioned', admittedMinor, accountedMinor })
  }
  return failures
}

function bindingsAgree(
  spec: PairingSpec,
  bindings: readonly StrategyBinding[],
): SetReconciliationRefusal | null {
  if (spec.strategies.length !== bindings.length) {
    return {
      kind: 'strategy_binding_count_mismatch',
      expected: spec.strategies.length,
      supplied: bindings.length,
    }
  }
  for (let i = 0; i < spec.strategies.length; i += 1) {
    const declared = spec.strategies[i]
    const bound = bindings[i]
    if (declared === undefined || bound === undefined) {
      return { kind: 'strategy_binding_kind_mismatch', index: i }
    }
    if (declared.kind !== bound.strategy.kind) {
      return { kind: 'strategy_binding_kind_mismatch', index: i }
    }
  }
  return null
}

/**
 * THE ENGINE. Pure, total, deterministic, side-effect-free.
 *
 * The passes ARE `PairingSpec.strategies` in declared order — `model/domain.ts
 * :1946` says the FIRST that pairs wins, and because `fully_allocated` is
 * absorbing (§5) that is a property of this fold rather than a convention.
 * `amount_sum` additionally runs G105's two-stage form.
 *
 * ⚠️ IT MUTATES NOTHING IT WAS GIVEN. Every collection returned is fresh; the
 * input arrays are read and never written. That is A9(e), and the test for it
 * is to `Object.freeze` the inputs — under strict mode an assignment to a frozen
 * object throws, so a mutating implementation fails loudly instead of passing.
 */
/**
 * G115 — the hard ceiling on `similarityMaxChars`. See its validation.
 */
export const SIMILARITY_MAX_CHARS_CEILING = 512

export function runSetReconciliation(input: SetReconciliationInput): SetReconciliationOutcome {
  /* --- gate on stated bounds. An absent bound is a refusal, never a default. --- */
  if (!Number.isInteger(input.readerCandidateCap) || input.readerCandidateCap < 1) {
    return { ok: false, refusal: { kind: 'reader_candidate_cap_not_stated' } }
  }
  /**
   * 🛑 G115 — AN UPPER BOUND, NOT ONLY A LOWER ONE. This validated
   * `>= 1` and nothing more, in a module whose header advertises that it bounds
   * this input. `levenshteinBasisPoints` is O(n×m), so an unbounded value made
   * the per-comparison cost unbounded too — the second of the two dimensions
   * that together made the fuzzy pass an unbounded quadratic over
   * counterparty-controlled text.
   *
   * 512 is a stated ceiling rather than a derived one: an invoice reference is
   * tens of characters, and anything approaching this is not a reference. If a
   * real corpus needs more, raise it deliberately — that is a matching-policy
   * decision with money on it, which is why it is a NUMBER IN A REFUSAL and not
   * a silent clamp.
   */
  if (
    !Number.isInteger(input.similarityMaxChars) ||
    input.similarityMaxChars < 1 ||
    input.similarityMaxChars > SIMILARITY_MAX_CHARS_CEILING
  ) {
    return { ok: false, refusal: { kind: 'similarity_max_chars_not_stated' } }
  }
  const bound = input.subsetSumBound
  if (
    !Number.isInteger(bound.maxMembers) || bound.maxMembers < 1 ||
    !Number.isInteger(bound.stepBudget) || bound.stepBudget < 1 ||
    !Number.isInteger(bound.maxBucketSize) || bound.maxBucketSize < 1
  ) {
    return { ok: false, refusal: { kind: 'subset_sum_bound_not_stated' } }
  }
  /**
   * 🛑 C13 — AND THE UPPER BOUND IS EXCLUSIVE. The three bounds above refuse an
   * absent value; this one refuses an absent value AND an off-switch, because
   * `10000` is a stated number whose comparison no input can satisfy. A
   * caller-supplied parameter that switches a check off is §5.2, and a gate that
   * accepted it would certify OFF as STATED — the failure mode a required field
   * is usually reached for to prevent. `SIMILARITY_MAX_CHARS_CEILING` above is
   * the same posture at a different bound.
   */
  const ceiling = input.admissionRefusalCeilingBasisPoints
  if (!Number.isInteger(ceiling) || ceiling < 0 || ceiling >= 10_000) {
    return { ok: false, refusal: { kind: 'admission_refusal_ceiling_not_stated' } }
  }

  for (const side of ['left', 'right'] as const) {
    const binding = side === 'left' ? input.left : input.right
    /* C16, comparison 1: the side's own declaration is STATED and valid. */
    const unstated = guardUnit(binding.declaredUnit)
    if (unstated !== null) {
      return { ok: false, refusal: { kind: 'declared_unit_invalid', side, refusal: unstated } }
    }
    const defects = validateNormalisation(binding.normalisation)
    if (defects.length > 0) {
      return { ok: false, refusal: { kind: 'normalisation_invalid', side, defects } }
    }
  }

  /* C16, comparisons 2 and 3 — the ones a per-side declaration cannot make, and
   * the reason this block sits outside the loop above: both need more than one
   * side in scope at once. `sameUnit` is the function widened for exactly this;
   * using it on one pair out of three would be widening it and then declining to
   * use it. */
  const sidesAgree = sameUnit(input.left.declaredUnit, input.right.declaredUnit)
  if (sidesAgree !== null) {
    return {
      ok: false,
      refusal: { kind: 'declared_units_disagree', refusal: sidesAgree },
    }
  }

  /* Both declarations agree by the check above, so comparing against the LEFT one
   * compares against both. `rounding` and the non-money arms are admitted against
   * any declaration — `toleranceNamesUnit` carries that ruling, not this loop. */
  const pairingTolerance = toleranceNamesUnit(input.pairing.amountTolerance, input.left.declaredUnit)
  if (pairingTolerance !== null) {
    return {
      ok: false,
      refusal: {
        kind: 'tolerance_unit_disagrees',
        tolerance: { kind: 'pairing' },
        refusal: pairingTolerance,
      },
    }
  }

  /* 🛑 THE PER-STRATEGY OVERRIDE, AND IT IS NOT THE SAME TOLERANCE. The fold
   * reads `binding.amountTolerance ?? input.pairing.amountTolerance`, so a money
   * tolerance declared on a STRATEGY BINDING in a third denomination never passes
   * through `pairing.amountTolerance` at all. Gating only the pairing-level value
   * would leave this route open while reporting the comparison closed. */
  for (let index = 0; index < input.strategyBindings.length; index += 1) {
    const override = input.strategyBindings[index]?.amountTolerance
    if (override === undefined || override === null) continue
    const disagreement = toleranceNamesUnit(override, input.left.declaredUnit)
    if (disagreement !== null) {
      return {
        ok: false,
        refusal: {
          kind: 'tolerance_unit_disagrees',
          tolerance: { kind: 'strategy_binding', index },
          refusal: disagreement,
        },
      }
    }
  }

  for (const document of [...input.leftDocuments, ...input.rightDocuments]) {
    if (document.tenantId !== input.tenantId) {
      return { ok: false, refusal: { kind: 'cross_tenant_documents' } }
    }
  }

  /* --- C18's ONLY refusal, and it runs in the GATE sequence rather than in §4a.
   *
   * A trailer that a format was declared to carry and that the parser did not
   * find is a property of the DOCUMENT alone: it needs no admitted item, no
   * address and no sum, so it belongs beside the tenancy gate rather than after
   * a fold that would be reading a file which may be missing its tail. A
   * truncated file presents exactly like this, and there is no sound ledger to
   * produce from one. Every other C18 finding is a post-condition — see
   * `POPULATION_DEFECT_DISPOSITION` for why that asymmetry is the ruling. */
  for (const side of ['left', 'right'] as const) {
    const documents = side === 'left' ? input.leftDocuments : input.rightDocuments
    for (const document of documents) {
      if (document.controlTotal.kind === 'expected_but_absent') {
        return {
          ok: false,
          refusal: {
            kind: 'control_total_expected_but_absent',
            side,
            sourceDocumentId: document.id,
          },
        }
      }
    }
  }

  /* --- O-15's refusal, beside C18's and admitted for the same reason.
   *
   * A side that presented NOTHING AT ALL. Like the arm above it needs no
   * admitted item, no address and no sum — only the documents — so it belongs in
   * the gate sequence rather than in §4a, where every check reads admission's
   * output.
   *
   * IT SITS BELOW C18's LOOP AND THE TWO ARE DISJOINT BY CONSTRUCTION.
   * `presentedRows` derives one header-grain row from a document with no lines,
   * so a side presents zero rows exactly when it was handed no document — and a
   * side with no document has no trailer to be missing. Order between them is
   * therefore a statement about reading, not about precedence.
   *
   * 🛑 IT FOLDS `presentedRowsOnSide` RATHER THAN READING `documents.length`,
   * AND THE TWO AGREE TODAY — WHICH IS THE POINT. They agree because ONE rule
   * decides what a document presents; a second spelling of that rule here would
   * be two branches that agree until somebody edits one (§5.3), and this gate
   * would then contradict admission about what "no rows" means rather than
   * follow it.
   *
   * 🛑 AND IT IS NOT C13's CASE. `population_wholly_refused` is rows PRESENTED
   * and none admitted; this is nothing presented. `checkPostconditions` skips
   * `presented === 0` for exactly this reason, so the only population that
   * reaches that skip is one whose binding declared zero PERMITTED. */
  for (const side of ['left', 'right'] as const) {
    const documents = side === 'left' ? input.leftDocuments : input.rightDocuments
    if (presentedRowsOnSide(documents) > 0) continue
    const binding = side === 'left' ? input.left : input.right
    if (binding.emptyExpectation === 'permitted') continue
    return { ok: false, refusal: { kind: 'population_empty_and_not_expected', side } }
  }

  const disagreement = bindingsAgree(input.pairing, input.strategyBindings)
  if (disagreement !== null) return { ok: false, refusal: disagreement }

  /* --- admission --- */
  const context: AdmissionContext = {
    fieldClassification: input.fieldClassification,
    modelPromptEligible: input.modelPromptEligible,
    confidenceFloors: input.confidenceFloors,
  }
  const left = admitPopulation('left', input.leftDocuments, input.left, context)
  const right = admitPopulation('right', input.rightDocuments, input.right, context)

  /* C13's UNCONDITIONAL HALF. Built here, before any gate below can refuse, so
   * that it is a record of what admission DID rather than of what survived the
   * checks — and `presented` is folded from the documents, not from the two
   * arrays above, which is what makes `presented === admitted + refused` a
   * property a caller can check. */
  const admissionRates: readonly AdmissionRate[] = [
    {
      side: 'left',
      presented: presentedRowsOnSide(input.leftDocuments),
      admitted: left.admitted.length,
      refused: left.refused.length,
    },
    {
      side: 'right',
      presented: presentedRowsOnSide(input.rightDocuments),
      admitted: right.admitted.length,
      refused: right.refused.length,
    },
  ]

  /* O-16's FIRST HALF, folded from `admissionRates` and from nothing else.
   *
   * `presented > admitted` rather than `refused > 0` — see `CompletenessFinding`
   * for why the weaker test would miss the silent case. Built here so that a
   * reader sees it derived from C13's record on the line below it: the shortfall
   * was ALREADY in the result object and nothing joined it to an outcome. */
  const completeness: CompletenessFinding[] = []
  for (const rate of admissionRates) {
    if (rate.presented <= rate.admitted) continue
    completeness.push({
      kind: 'rows_presented_not_admitted',
      side: rate.side,
      presented: rate.presented,
      admitted: rate.admitted,
      refused: rate.refused,
    })
  }

  /* --- C17: population integrity, per side, BEFORE anything folds. --- *
   *
   * It runs here and not earlier because it reads ADMISSION's output: whether a
   * copy was admitted is what decides between a refusal and the named outcome
   * `item_in_residue_twice`. It runs here and not later because the very next
   * statement is the fold that would eat the row. */
  const reportedDefects: PostconditionFailure[] = []
  const unverifiedDocuments = new Set<SourceDocumentId>()
  const runDocumentAccounts: RunDocumentAccount[] = []
  for (const side of ['left', 'right'] as const) {
    const outcome = side === 'left' ? left : right
    const binding = side === 'left' ? input.left : input.right
    const documents = side === 'left' ? input.leftDocuments : input.rightDocuments
    /* 🛑 HOISTED TO ONE OBJECT SINCE G236, AND THE HOIST IS THE CONTROL. The
     * defects and the per-document accounts must be taken over the SAME input or
     * the second manufactures `agreed` rows the first would have contradicted —
     * which is the exact silence G236 exists to end, reintroduced by a second
     * argument list. */
    const integrityInput: PopulationIntegrityInput = {
      side,
      admitted: outcome.admitted,
      refused: outcome.refused,
      documents,
      carriesControlTotal: binding.carriesControlTotal,
      admissionRefusalCeilingBasisPoints: ceiling,
    }
    const defects = checkPopulationIntegrity(integrityInput)
    /* G236's UNCONDITIONAL HALF, built BEFORE the refusal filter below so that it
     * is a record of what every file said rather than of what survived the
     * checks — C13's `admissionRates` is built one screen up for the same reason
     * and states it in the same words. On the refusing branch it is discarded
     * with the rest of the result, which is `POPULATION_DEFECT_DISPOSITION`'s
     * ruling and not this line's to soften. */
    runDocumentAccounts.push(...documentAccounts(integrityInput, defects))
    /* 🛑 WHICH DEFECTS REFUSE IS READ FROM A DECLARATION, NOT DECIDED HERE. C18's
     * ruling is that only C17 refuses; expressing it as a `kind ===` test in this
     * loop would put the ruling in a branch somebody can widen in a hurry, and a
     * new arm would fall into whichever bucket the `else` happens to be. The
     * total `Record` makes an unclassified arm a compile error instead. */
    const refusing = defects.filter((d) => POPULATION_DEFECT_DISPOSITION[d.kind] === 'refuse')
    if (refusing.length > 0) {
      return {
        ok: false,
        refusal: { kind: 'population_integrity_refused', side, defects: refusing },
      }
    }
    for (const defect of defects) {
      reportedDefects.push({ kind: 'population_integrity_reported', side, defect })
      /* O-16's SECOND HALF, pushed in the SAME loop body from the SAME `defect`
       * so the two envelopes cannot diverge in membership. A `for` over
       * `reportedDefects` afterwards would be a second traversal that a later
       * edit could desynchronise, and the whole reason this arm carries the
       * defect verbatim is to keep one vocabulary. */
      completeness.push({ kind: 'source_self_report_unmet', side, defect })
      /* `null` since C13 — a defect that names no one file. Nothing to mark
       * unverified: the arm that returns it refuses, so it never reaches here,
       * and the guard is the named negative control rather than a cast. */
      const document = defectDocument(defect)
      if (document !== null) unverifiedDocuments.add(document)
    }
  }

  const items = new Map<string, AdmittedItem>()
  for (const item of [...left.admitted, ...right.admitted]) {
    /* THE LINE THAT LOSES THE ROW, given a guard rather than a comment. §4a
     * refuses this case above, so this arm is UNREACHABLE TODAY and its own
     * declaration says so — the posture G99 demands of `withTenantScope()`: a
     * named negative control, not a review convention. */
    if (items.has(item.key)) {
      return {
        ok: false,
        refusal: { kind: 'admitted_item_key_collision', side: item.side, ref: item.ref },
      }
    }
    items.set(item.key, item)
  }
  let state: MatchingState = { items, allocations: [] }

  /* --- the passes, in declared order --- */
  const ambiguities: AmbiguityFinding[] = []
  const toleranceRefusals: ToleranceRefusal[] = []
  const oversizedBuckets: KeyedSearchBoundaryEntry[] = []
  const exhaustedSearches: KeyedSearchBoundaryEntry[] = []
  const oversizedAmountBuckets: SearchBoundaryEntry[] = []
  /* G291 — buckets the identifier join found and the money declined. §5b. */
  const keyedDeclines: KeyedToleranceDecline[] = []

  for (const binding of input.strategyBindings) {
    const strategy = binding.strategy
    const amountTolerance = binding.amountTolerance ?? input.pairing.amountTolerance

    if (strategy.kind === 'exact_identifier') {
      const outcome = passIdentifierJoin(
        state,
        strategy.on,
        amountTolerance,
        input.toleranceDirection,
        input.pairing.cardinality,
      )
      state = outcome.state
      ambiguities.push(...outcome.ambiguities)
      toleranceRefusals.push(...outcome.toleranceRefusals)
      /* G291. ⚠️ THE ACCUMULATOR IS READ TWICE BELOW — once for the CHANNEL and
       * once to attribute the residue cause — and that is the lesson G115's own
       * note records the hard way: it accumulated `oversizedAmountBuckets` into
       * a local and read it NOWHERE, for a bound that really did fire, and
       * `noUnusedLocals` cannot see a variable that is written. */
      keyedDeclines.push(...outcome.toleranceDeclines)
    } else if (strategy.kind === 'amount_and_date') {
      const outcome = passAmountAndDate(
        state,
        amountTolerance,
        input.pairing.dateTolerance,
        input.toleranceDirection,
      )
      state = outcome.state
      ambiguities.push(...outcome.ambiguities)
      toleranceRefusals.push(...outcome.toleranceRefusals)
    } else if (strategy.kind === 'fuzzy_reference') {
      const on = input.left.spec.identifiers[0]
      if (on === undefined) continue
      const outcome = passFuzzyReference(
        state,
        on,
        strategy.minSimilarity,
        input.similarityMetric,
        input.similarityMaxChars,
        bound.maxBucketSize,
      )
      state = outcome.state
      ambiguities.push(...outcome.ambiguities)
      /* G115 — an amount bucket too wide to compare is refused, not truncated.
       *
       * 🛑 THE SENTENCE THAT STOOD HERE WAS FALSE AND IT COST THIS CHANNEL ITS
       * ONLY READER. It said this *"reuses `bucket_exceeded_bound`, the cause
       * `maxBucketSize` already produces, because it IS the same bound being
       * enforced."* The bound is the same; the KEY is not. `bucket_exceeded_bound`
       * is attributed by looking an item's COUNTERPARTY up in the oversized set,
       * and these were AMOUNT bucket keys, so the two sets never intersected —
       * this local was written and read nowhere, for a bound that really did fire.
       * G217's `SearchBoundary.oversizedAmountBuckets` is where it lands now.
       * ⚠️ The residue CAUSE is deliberately not changed by this slice: these rows
       * still report `no_strategy_paired`, which is what a fuzzy pass that never
       * ran leaves behind, and re-attributing them is a matching decision rather
       * than a reporting one. */
      oversizedAmountBuckets.push(...outcome.oversizedAmountBuckets)
    } else {
      /* A9(d) at the spec level: a definition that has not named a partition key
       * does not silently get one giant bucket — pass 3 simply does not run. */
      if (input.left.counterparty === null || input.right.counterparty === null) continue
      const outcome = passAmountSum(state, input.obligationSide, {
        maxMembers: Math.min(bound.maxMembers, strategy.maxMembers),
        stepBudget: bound.stepBudget,
        maxBucketSize: bound.maxBucketSize,
      })
      state = outcome.state
      oversizedBuckets.push(...outcome.oversizedBuckets)
      exhaustedSearches.push(...outcome.exhaustedSearches)
    }
  }

  /* --- residue --- */
  const ambiguousKeys = new Set<string>()
  for (const finding of ambiguities) {
    for (const ref of finding.leftRefs) ambiguousKeys.add(itemKey('left', ref))
    for (const ref of finding.rightRefs) ambiguousKeys.add(itemKey('right', ref))
  }
  /* G217 — the KEYS are read HERE, inside the function that produced them, and
   * nowhere else. `SetReconciliationResult` gets the boundary halves only. */
  const oversized = new Set(oversizedBuckets.map((entry) => entry.counterparty))
  const exhausted = new Set(exhaustedSearches.map((entry) => entry.counterparty))
  /* G291 — the ITEM KEYS are read HERE, inside the function that produced them,
   * and nowhere else; `SetReconciliationResult` gets the `decline` halves only.
   * The same split `oversized`/`exhausted` make one line up, for G217's reason.
   *
   * ⚠️ LAST DECLINE WINS WHERE A ROW WAS DECLINED TWICE — two strategy bindings
   * can join on two identifiers, and a row can be in a declined bucket under
   * both. The LATER binding is the one the operator's waterfall reached last and
   * the one whose tolerance they were relying on, so it is the truer answer; and
   * BOTH declines are on `toleranceDeclines` regardless, which is the point of
   * having the channel. Stated rather than left to the reader of a `Map.set`. */
  const declinedVariance = new Map<string, bigint>()
  for (const entry of keyedDeclines) {
    for (const key of entry.itemKeys) {
      declinedVariance.set(key, entry.decline.signedVarianceMinor)
    }
  }

  const residue: ResidueEntry[] = []
  for (const refused of [...left.refused, ...right.refused]) {
    residue.push({
      side: refused.side,
      ref: refused.ref,
      settlement: null,
      disposition: dispositionFor(refused.side, {
        kind: 'admission_refused',
        refusal: refused.refusal,
      }),
      cause: { kind: 'admission_refused', refusal: refused.refusal },
      /* G227. A refused row has no admitted item, so there is nothing whose
       * reads could have been held — see `ResidueEntry.heldReads`. */
      heldReads: [],
    })
  }
  for (const item of state.items.values()) {
    const settlement = settlementOf(state, item.key)
    if (!settlement.ok) continue
    if (settlement.value.kind === 'fully_allocated') continue
    let cause: ResidueCause = { kind: 'no_strategy_paired' }
    /* C18 FIRST, and the ordering is the argument. A row out of a file whose own
     * trailer does not reconcile against its rows has a provenance problem, and
     * every later cause here is a MATCHING verdict over that row. Reporting
     * `no_strategy_paired` would send an operator hunting a counterparty for a
     * row whose file is short — the fix is the file. */
    if (unverifiedDocuments.has(item.ref.sourceDocumentId)) {
      cause = { kind: 'control_total_unverified' }
    } else if (item.heldReads.length > 0) {
      /* G227, SECOND — below C18 and above every matching verdict.
       *
       * The file's own account comes first for the reason stated above: the fix
       * for a short file is the file. A held read comes next because every cause
       * below this line is a MATCHING verdict, and reporting one over a row the
       * engine deliberately never offered to a pass would be a claim about a
       * counterparty derived from a comparison that did not happen —
       * `no_strategy_paired` on a row nothing was allowed to try to pair.
       *
       * ⚠️ THE BRANCH IS AN ASSERTION AS WELL AS A CHOICE. `openItems()` keeps a
       * held item out of every pass, so `identifier_ambiguous`,
       * `bucket_exceeded_bound` and `search_budget_exhausted` are unreachable for
       * it by construction. Ordering it here means a later edit that reopened one
       * of those paths would still report the held read rather than the artefact.
       */
      cause = { kind: 'read_held_below_floor' }
    } else if (ambiguousKeys.has(item.key)) cause = { kind: 'identifier_ambiguous' }
    else if (settlement.value.kind === 'unallocated' && declinedVariance.has(item.key)) {
      /* G291, THIRD — below the two dominating causes and ABOVE every cause that
       * is a statement about a pass which did not run.
       *
       * 🛑 `kind === 'unallocated'` IS NOT A TIGHTENING, IT IS THE RULING, AND
       * THE CORPUS TAUGHT IT RATHER THAN A REVIEWER. A decline is a statement
       * about a comparison THAT DID NOT RESULT IN A PAIRING. The waterfall is
       * ordered by certainty precisely so that a LATER pass may succeed where an
       * earlier one declined — and `bankFeeWithinTolerance` is that scenario
       * written down: pass 1 declines on a zero rounding tolerance, pass 2
       * admits the same bucket at SGD 15.00, pours 398500, and the invoice is
       * open for the FEE. Without this test the engine reported
       * `amount_tolerance_declined` on a row that paired, which is G291's own
       * defect pointing the other way — an operator sent to widen a tolerance
       * that already worked, on a row whose real finding is an unpaid SGD 15.00.
       *
       * ⚠️ THE FIRST IMPLEMENTATION OF THIS RULING DID EXACTLY THAT, and the
       * corpus caught it on the first run. The expectation it broke —
       * `obligation_not_fully_settled` — was NOT edited: that scenario's own
       * `summary` and `derivedFrom` state the two-pass behaviour in the
       * specification's voice, so the corpus was right and the engine was wrong.
       * Recorded here rather than quietly repaired, because "an expectation
       * copied from the engine is a constant compared to itself".
       *
       * ⚠️ THE BOUND IS STILL RECORDED WHERE THE ROW PAIRED. `toleranceDeclines`
       * carries pass 1's decline on that scenario whatever this slot says, which
       * is why the guard is safe under G114: this narrows a DISPOSITION, never
       * the record of a bound that was hit.
       *
       * ⚠️ THE ORDERING IS A USEFULNESS JUDGEMENT AND NOT A SOUNDNESS ONE, and
       * saying which it is matters. G114's *never silently absorbed* is
       * satisfied by `toleranceDeclines`, which fires whatever this slot ends up
       * holding — so no ordering here can absorb the bound. What the ordering
       * decides is which single sentence the operator reads on the row.
       *
       * It sits above `counterparty_unattributed`, `bucket_exceeded_bound` and
       * `search_budget_exhausted` because a DECLINE IS AN OBSERVATION and each of
       * those is an ABSENCE: the engine really compared this bucket and really
       * produced a figure, where the others say a later pass was never run, was
       * refused on a predicted cost, or was cut short. Telling an operator whose
       * reference matched exactly that their counterparty could not be
       * attributed sends them to the wrong file, which is the class of harm
       * G291 was taken about.
       *
       * It sits BELOW `identifier_ambiguous` because that is the earlier verdict
       * from the same pass — an ambiguous bucket is refused by `arityPermits`
       * BEFORE `sumGross` is ever called, so the two cannot both be true of one
       * bucket, and where they are both true of one ROW across two bindings the
       * arity finding is the one with the duplicate-invoice reading.
       *
       * The `?? 0n` is unreachable — `has` guarded it one line up — and it is a
       * named negative control rather than a cast, because `noUncheckedIndexedAccess`
       * gives `Map.get` a `| undefined` and `!` is how a real absence would get
       * written as a zero variance nobody computed. */
      cause = {
        kind: 'amount_tolerance_declined',
        signedVarianceMinor: declinedVariance.get(item.key) ?? 0n,
      }
    } else if (item.counterparty === null && input.left.counterparty !== null) {
      cause = { kind: 'counterparty_unattributed' }
    } else if (item.counterparty !== null && oversized.has(item.counterparty)) {
      cause = { kind: 'bucket_exceeded_bound' }
    } else if (item.counterparty !== null && exhausted.has(item.counterparty)) {
      /* G114 — ordered AFTER bucket_exceeded_bound deliberately: a bucket refused
       * before the search never reached the budget, so the predicted cost is the
       * truer reason where both could apply. */
      cause = { kind: 'search_budget_exhausted' }
    } else if (settlement.value.kind === 'partially_allocated') {
      cause =
        item.side === input.obligationSide
          ? { kind: 'obligation_not_fully_settled' }
          : { kind: 'cash_exceeded_obligations' }
    }
    residue.push({
      side: item.side,
      ref: item.ref,
      settlement: settlement.value,
      disposition: dispositionFor(item.side, cause),
      cause,
      /* G227. Carried whatever the cause turned out to be — a row held down by a
       * dominating `control_total_unverified` still has a person's question on
       * it once the file is re-cut. */
      heldReads: item.heldReads,
    })
  }

  const readerRequests = buildReaderRequests(state, residue, input.readerCandidateCap)

  return {
    ok: true,
    result: {
      state,
      residue,
      refusedAtAdmission: [...left.refused, ...right.refused],
      ambiguities,
      toleranceRefusals,
      /* G291. The `decline` halves only — the item keys stayed inside, above. */
      toleranceDeclines: keyedDeclines.map((entry) => entry.decline),
      /* G217. Counts plus `ItemRef`, and not one byte of a join key. */
      searchBoundary: {
        oversizedBuckets: oversizedBuckets.map((entry) => entry.boundary),
        exhaustedSearches: exhaustedSearches.map((entry) => entry.boundary),
        oversizedAmountBuckets,
      },
      readerRequests,
      meterFacts: [runMeterFact(input.runId, 'reconciliations_run', 1)],
      admissionRates,
      /* G236. Left's documents then right's, each in supplied order, and every
       * document present whatever its trailer said. */
      documentAccounts: runDocumentAccounts,
      /* C18's reports first, then the ledger's own checks. The population
       * defects are about the INPUT — they say the file disagrees with itself —
       * and reading them before the conservation findings is the order an
       * operator needs, because an unsound-looking ledger over a truncated file
       * is explained by the first list. */
      postconditions: [...reportedDefects, ...checkPostconditions(state, residue, admissionRates)],
      /* O-16. The run's own observation first, then the file's account of
       * itself — the order an operator acts in, because a side that admitted
       * nothing explains a trailer disagreement and never the other way round.
       * ⚠️ It is NOT folded from `postconditions` above: `checkPostconditions`
       * runs after this array is complete, and `population_wholly_refused` is
       * already covered by `rows_presented_not_admitted` at its extreme. */
      completeness,
    },
  }
}

/* ==================================================================== *
 * §10  THE RESIDUE-SIDE DISPOSITION PASS — G123's RIGHT-HAND HALF
 *
 * WHERE IT RUNS, AND WHY THERE AND NOWHERE ELSE. G123: *normalisation shifts
 * left; disposition runs RIGHT, over the residue.* This pass consumes
 * `SetReconciliationResult.residue` — it runs AFTER `runSetReconciliation()`
 * and never before it, and the reason is a property rather than a preference.
 *
 * 🛑 A PRE-ENGINE FILTER IS INVISIBLE TO THE CONSERVATION PROOF. Both
 * post-conditions in §9 are scoped to WHAT THE ENGINE WAS GIVEN:
 * `open_item_missing_from_residue` walks `state.items`, and
 * `gross_not_partitioned` sums the admitted gross. A record removed before
 * admission is in neither total, so removing it breaks nothing and is caught by
 * nothing. That is the A9(b) shape sitting one layer ABOVE the check written to
 * catch A9(b) — money leaving without the ledger knowing, except now it leaves
 * before the ledger exists. `tests/model/learned-dispositions.test.ts`
 * demonstrates the failure rather than asserting it: the same rule applied as a
 * pre-engine filter is shown breaking both checks on the same fixture.
 *
 * And the second half of G123's argument, which is about the product and not
 * about the proof: a pre-engine filter would suspend a payment THAT WOULD HAVE
 * MATCHED. Routing to suspense is only defensible once the engine has failed to
 * pair the row.
 *
 * WHAT THIS PASS THEREFORE DOES NOT DO, and each is structural:
 *   · it removes NO item from the residue and adds none;
 *   · it mints NO allocation, so no settlement moves and `gross_not_partitioned`
 *     balances exactly as it did before;
 *   · it writes NO ledger state at all. It returns PROPOSALS.
 * It is a pure, total fold like everything else here — no clock, no randomness,
 * no I/O, every failure a value.
 *
 * 🛑 G129 — THE GATE IS CALLED, AND CALLING IT IS THE POINT OF THIS SECTION.
 * `mayAutoResolve()` (`model/policy.ts:1547`) landed with a fixture and NO
 * PRODUCTION CALLER. §9 of this file already names that defect shape by name
 * about a different control — *"a comment claiming enforcement over zero call
 * sites"* — and a gate nothing routes through is the same shape. Every proposal
 * this pass emits carries the gate's `{ allowed, reason }` VERBATIM, so a
 * refusal is visible on the row rather than inferred from the row's absence.
 * The reason vocabulary is `PolicyReasonCode`; this module does not re-spell it.
 *
 * 🛑 G127 IS IN THE TYPE. `LearnedDisposition` EXCLUDES `write_off`.
 *
 * WHY SUSPENSE IS ADMISSIBLE: routing to suspense is a HOLDING decision. It is
 * reversible by an operator the same day, it names no counterparty and it
 * changes no balance — the cash stays on the balance sheet, still owed to
 * somebody, waiting to be attributed. Nothing is destroyed by getting it wrong.
 *
 * WHY WRITE-OFF IS NOT: a write-off REMOVES THE RECEIVABLE. It is the one
 * disposition in the set that destroys the thing being reconciled, and after it
 * there is nothing left to reconcile against. G127 rules that a learned rule may
 * never fire it unattended, and the boundary is expressed as an `Exclude<>` on
 * the type rather than as a runtime `if`, because a runtime `if` is the shape
 * somebody in a hurry deletes — and the hurry arrives the first time suspense
 * feels tedious. `write_off` remains a declared member of
 * `DISPOSITION_FAMILIES.set_reconciliation`, and a HUMAN may still choose it;
 * G127 removes it from this path, not from the product.
 *
 * 🛑 G124/G130 — NO PATTERN IS EVER COMPILED. The only predicate arm a learned
 * rule may carry is `extraction_in_set` (`model/domain.ts:352`): the approved
 * `IdentifierNormalisation` op list from §2, plus the enumerated values its
 * OUTPUT is compared against. The arm is read by `extractionInSetHolds()`, which
 * is imported rather than re-implemented, with `applyExtraction` injected as its
 * `ExtractionFn`.
 *
 * 🛑 G125/G131 — A RULE MATCHES WHAT THE HUMAN WAS SHOWN. `values` is
 * ENUMERATED, never inferred, and `LearnedDispositionRule.entryId` carries the
 * `LearningEntry` that proposed it onto every proposal — so *which human
 * assertion moved this row* is answerable from the row.
 * ==================================================================== */

/**
 * G127, IN THE TYPE.
 *
 * ⚠️ VERIFY IT RED BEFORE TRUSTING IT GREEN, the same way
 * `_ReaderVerdictHoldsNoTextDeep` asks to be verified. Widen this to
 * `SetDisposition` and `tests/model/learned-dispositions.test.ts` fails to
 * COMPILE — its `@ts-expect-error` directive becomes unused, which is itself
 * `TS2578`. The control therefore bites in both directions and cannot rot into
 * a comment nobody runs, because `npm test` typechecks before it executes.
 */
export type LearnedDisposition = Exclude<SetDisposition, 'write_off'>

/**
 * The `AgentAction` the gate is asked about, and it is EXECUTION.
 *
 * Proposing is not the risky act. A pass that gated `propose_resolution` would
 * answer a question nobody is asking and would leave execution ungated the first
 * time somebody wires this output to a writer — §5.1 exactly: a rule keyed on a
 * convenient landmark instead of the property it protects.
 *
 * ⚠️ THE PASS ITSELF EXECUTES NOTHING. It asks whether the act it is proposing
 * WOULD be permitted unattended, and records the answer. `narrowLiveAutonomy`
 * (`model/examples.ts:847`) sets `mayProposeBeyondLimits: true` for exactly this
 * reason: refusing to execute is not refusing to speak.
 */
export const LEARNED_RULE_ACTION: AgentAction = 'execute_resolution'

/**
 * A promoted `LearningEntry`, in the one executable shape this pass accepts.
 *
 * `disposition` is the WHOLE `Disposition` record and not a `Reversibility`, for
 * the reason `mayAutoResolve()`'s own parameter comment gives: passing the
 * declared field out of its own record is where a caller starts choosing which
 * reversibility to claim. `proposed` and `disposition.family` must AGREE, and a
 * rule where they do not is refused as unusable rather than evaluated — if the
 * record the gate reads is not the disposition being proposed, the gate is
 * gating a different act, which is §5.6 with two objects instead of one.
 */
export interface LearnedDispositionRule {
  /** G125/G131 — provenance. Which human assertion this rule came from. */
  readonly entryId: LearningEntryId
  /** G124/G130 — the ONLY predicate arm a learned rule may use. */
  readonly predicate: Extract<RulePredicate, { kind: 'extraction_in_set' }>
  readonly proposed: LearnedDisposition
  readonly disposition: Disposition
}

/**
 * Why a rule was not run AT ALL — a fact about the RULE, not about any row.
 *
 * Reported once per rule rather than once per row it failed to match, because
 * an unusable rule is an authoring defect somebody has to fix, and N copies of
 * it in a residue-length list is noise that hides it.
 */
export type LearnedRuleDefect =
  | { kind: 'disposition_family_disagrees' }
  /**
   * The predicate's subject names a path that is NEITHER side's description.
   *
   * Evaluating it against the description anyway would run the rule over a field
   * its author never named — and the author is a finance operator who approved
   * an op list against a specific column. Refused BY NAME instead.
   */
  | { kind: 'subject_not_the_description' }
  | { kind: 'normalisation_invalid'; defects: readonly NormalisationDefect[] }
  /**
   * `values: []` is a predicate that is silently false forever —
   * `model/domain.ts:341` names this exact hazard and declines to validate it
   * there because the check needs the injected extractor. This is the call site
   * that has one, so it is checked here.
   */
  | { kind: 'no_enumerated_values' }

export type _LearnedRuleDefectHoldsNoText = AssertNoTextDeep<LearnedRuleDefect>

export interface UnusableLearnedRule {
  readonly entryId: LearningEntryId
  readonly reason: LearnedRuleDefect
}

/**
 * Why the gate was never reached for a row the rule DID address.
 *
 * Every member is a refusal to INVENT something the gate needs, and each one
 * leaves the row for a human. `CLAUDE.md` forbids inventing data; a defaulted
 * severity is invented data that buys a pass through a dial nobody set.
 */
export type LearnedGateNotReached =
  /**
   * The op list declined to canonicalise this row's description — over the
   * character cap, segment index out of range.
   *
   * ⚠️ KEPT DISTINCT FROM AN ORDINARY MISS, WHICH PRODUCES NO ROW AT ALL.
   * `extractionInSetHolds()`'s own docblock says collapsing the two "would make
   * a refusal indistinguishable from an ordinary miss at every call site that
   * reports one". This is such a call site.
   */
  | 'extraction_refused'
  /**
   * The row's description was never readable, so a rule keyed on it cannot hold.
   *
   * ⚠️ AND THIS IS OVER-STRICT ON PURPOSE, STATED RATHER THAN WORKED AROUND.
   * `AdmittedItem.untrustedDescription` is the only carrier of the description
   * in this module, and admission (§4) fills it only behind TWO fail-closed
   * gates: `fieldClassification` (G106) and `modelPromptEligible`. The second is
   * a MODEL-PROMPT gate and a learned rule makes no model call — so a
   * description that is classified but not prompt-eligible is invisible to a
   * deterministic op list that could safely have read it. That is a real cost.
   * It is paid rather than routed around, because the alternative is a second
   * path to the untrusted description that does not pass invariant 4's
   * mechanism, and this member makes the cost VISIBLE on the row instead of
   * silently disabling every learned rule in the tenant.
   */
  | 'description_unreadable'
  /**
   * A residue row HAS no severity. There is no `Exception` yet — this pass runs
   * inside a reconciliation run, and severity is assigned when an exception is
   * raised. Defaulting to `'low'` would buy a pass through the severity dial
   * with a number nobody stated.
   */
  | 'severity_not_supplied'
  /**
   * A residue row HAS no domain either. `DomainKey` is a property of the
   * definition and the tenant, not of a pair of unmatched transactions, and
   * defaulting to `'finance'` would be the ERP vocabulary `CLAUDE.md` forbids
   * baked into an autonomy decision — in the one product whose non-finance
   * domains (`kyc`, `credit_underwriting`, `medical_records`) are exactly the
   * three `DEFAULT_AUTONOMY_BY_DOMAIN` sets to `'none'`.
   */
  | 'domain_not_supplied'

/**
 * The gate's answer, carried verbatim, or the named reason it was not reached.
 *
 * `gated` carries `allowed` AND `reason` even when allowed, because
 * `mayAutoResolve()` returns both and dropping the permitted reason would make
 * a permitted row indistinguishable from a row nothing looked at.
 */
export type LearnedProposalOutcome =
  | { kind: 'gated'; allowed: boolean; reason: PolicyReasonCode }
  | { kind: 'not_gated'; reason: LearnedGateNotReached }

/**
 * 🟢 CONTAINMENT, REUSED. If a plain `string` ever appears anywhere in this
 * type, at any depth, this is a compile error.
 *
 * The tempting edit is named rather than left to a reviewer: somebody will want
 * the MATCHED DESCRIPTION on the proposal for a nicer explanation. That is
 * counterparty-controlled prose, and this proposal is the row a finance user
 * reads and a dashboard renders. `PolicyReasonCode` and `LearnedGateNotReached`
 * are closed unions of literals and pass; a `matchedText: string` would not.
 */
export type _LearnedProposalOutcomeHoldsNoTextDeep = AssertNoTextDeep<LearnedProposalOutcome>

/**
 * ONE PROPOSED DISPOSITION FOR ONE RESIDUE ROW. Not a decision, and not a write.
 *
 * `ref` and `side` ADDRESS the row; they do not replace it. The residue entry
 * this was derived from is untouched and still carries its engine-assigned
 * `disposition` and its `cause`.
 */
export interface LearnedDispositionProposal {
  readonly side: PopulationSide
  readonly ref: ItemRef
  /** G125/G131 — which promoted learning proposed this. */
  readonly entryId: LearningEntryId
  readonly proposed: LearnedDisposition
  readonly outcome: LearnedProposalOutcome
}

export interface ResidueDispositionInput {
  readonly state: MatchingState
  /** Read, never rewritten. Nothing leaves this list. */
  readonly residue: readonly ResidueEntry[]
  readonly left: PopulationBinding
  readonly right: PopulationBinding
  readonly rules: readonly LearnedDispositionRule[]
  readonly autonomy: AutonomyConfig
  /**
   * The two fields a residue row cannot supply, supplied by the caller or not
   * at all. Both nullable, and null REFUSES rather than defaults.
   */
  readonly context: {
    readonly severity: Severity | null
    readonly domain: DomainKey | null
  }
}

/**
 * BOTH LISTS ARE ALWAYS PRESENT, and that is what makes "the pass ran and
 * proposed nothing" distinguishable from "the pass did not run". An absent key
 * would read as `undefined` at every call site that destructures it.
 */
export interface ResidueDispositionOutcome {
  readonly proposals: readonly LearnedDispositionProposal[]
  readonly unusableRules: readonly UnusableLearnedRule[]
}

/**
 * THE VALUE STILL AT RISK ON A RESIDUE ROW — the one gate input this pass can
 * derive, and it is derived from the row rather than asked of the caller.
 *
 * It is the RESIDUAL, never the gross. On the fixture in this module's tests a
 * 20000 payment met 15000 of obligations: the money still unattributed is 5000,
 * and reporting 20000 would hand the gate a figure four times the exposure.
 *
 * ⚠️ IT REFUSES ON TWO ROWS RATHER THAN FABRICATING A NUMBER, and both refusals
 * are the fail-closed reading:
 *   · `settlement: null` — an item REFUSED AT ADMISSION. It has no amount, so it
 *     has no residual, and §6 already refuses to invent a zero for it.
 *   · `fully_allocated` — a closed item in the residue is
 *     `fully_allocated_item_in_residue`, an unsound run. Reporting the ALLOCATED
 *     amount as at-risk would be a fabricated figure on an already-broken row.
 * A refusal here becomes `valueAtRisk: null` at the gate, which
 * `mayAutoResolve()` reads as *nothing monetary is at risk* — safe only because
 * its value arm refuses on any STATED ceiling anyway. If G66/G112 ever make that
 * arm compare, revisit this line: `null` would then mean "unbounded" instead of
 * "unknown", and those are different facts.
 */
export type ValueAtRisk = { ok: true; value: Money } | { ok: false }

export function valueAtRiskOf(entry: ResidueEntry): ValueAtRisk {
  const settlement = entry.settlement
  if (settlement === null) return { ok: false }
  if (settlement.kind === 'fully_allocated') return { ok: false }
  return { ok: true, value: settlement.residual }
}

/**
 * Which population side(s) a predicate's subject addresses.
 *
 * A learned rule reads the untrusted description and nothing else, so the
 * subject must name a side's declared `description` path. Empty means the rule
 * addresses no side and is unusable — never "try both anyway".
 */
function sidesAddressedBy(
  subject: Expr,
  left: PopulationBinding,
  right: PopulationBinding,
): readonly PopulationSide[] {
  if (subject.kind !== 'field') return []
  const sides: PopulationSide[] = []
  if (left.description !== null && left.description === subject.path) sides.push('left')
  if (right.description !== null && right.description === subject.path) sides.push('right')
  return sides
}

/**
 * THE PASS. Pure, total, deterministic; mutates nothing it was given.
 *
 * Rules are validated ONCE, up front, and a rule that fails validation evaluates
 * no row at all. Then the residue is walked in its own order — the product
 * order — and each usable rule addressing that row's side is evaluated against
 * the row's description.
 *
 * THE FOUR OUTCOMES OF EVALUATING ONE RULE AGAINST ONE ROW, and only two of them
 * produce a row:
 *   held           → a proposal carrying the gate's verdict
 *   extraction_refused / description_unreadable / no severity / no domain
 *                  → a proposal carrying the named reason the gate was skipped
 *   not_in_set     → NOTHING. An ordinary miss is not a finding.
 *   wrong side / not an admitted item
 *                  → NOTHING. The rule does not address this row.
 */
export function proposeResidueDispositions(
  input: ResidueDispositionInput,
): ResidueDispositionOutcome {
  const proposals: LearnedDispositionProposal[] = []
  const unusableRules: UnusableLearnedRule[] = []
  const usable: { rule: LearnedDispositionRule; sides: ReadonlySet<PopulationSide> }[] = []

  for (const rule of input.rules) {
    /* First, because a disagreeing record means the gate would read the
     * reversibility of a disposition other than the one being proposed. */
    if (rule.disposition.family !== rule.proposed) {
      unusableRules.push({
        entryId: rule.entryId,
        reason: { kind: 'disposition_family_disagrees' },
      })
      continue
    }
    const sides = sidesAddressedBy(rule.predicate.subject, input.left, input.right)
    if (sides.length === 0) {
      unusableRules.push({
        entryId: rule.entryId,
        reason: { kind: 'subject_not_the_description' },
      })
      continue
    }
    /* §2's own instruction: call `validateNormalisation()` FIRST. */
    const defects = validateNormalisation(rule.predicate.extraction)
    if (defects.length > 0) {
      unusableRules.push({
        entryId: rule.entryId,
        reason: { kind: 'normalisation_invalid', defects },
      })
      continue
    }
    if (rule.predicate.values.length === 0) {
      unusableRules.push({ entryId: rule.entryId, reason: { kind: 'no_enumerated_values' } })
      continue
    }
    usable.push({ rule, sides: new Set(sides) })
  }

  for (const entry of input.residue) {
    for (const candidate of usable) {
      const rule = candidate.rule
      if (!candidate.sides.has(entry.side)) continue
      const item = input.state.items.get(itemKey(entry.side, entry.ref))
      /* An admission-refused row is in the residue and NOT in `state.items`. It
       * has no description, so no rule addresses it. */
      if (item === undefined) continue

      const propose = (outcome: LearnedProposalOutcome): void => {
        proposals.push({
          side: entry.side,
          ref: entry.ref,
          entryId: rule.entryId,
          proposed: rule.proposed,
          outcome,
        })
      }

      const description = item.untrustedDescription
      if (description === null) {
        propose({ kind: 'not_gated', reason: 'description_unreadable' })
        continue
      }

      const held = extractionInSetHolds(rule.predicate, description, applyExtraction)
      if (!held.held) {
        if (held.reason === 'extraction_refused') {
          propose({ kind: 'not_gated', reason: 'extraction_refused' })
        }
        continue
      }

      if (input.context.severity === null) {
        propose({ kind: 'not_gated', reason: 'severity_not_supplied' })
        continue
      }
      if (input.context.domain === null) {
        propose({ kind: 'not_gated', reason: 'domain_not_supplied' })
        continue
      }

      /* G129. The gate, called — with the whole `Disposition` record, and with
       * the residual rather than the gross. */
      const atRisk = valueAtRiskOf(entry)
      const verdict = mayAutoResolve(input.autonomy, rule.disposition, {
        severity: input.context.severity,
        domain: input.context.domain,
        action: LEARNED_RULE_ACTION,
        valueAtRisk: atRisk.ok ? atRisk.value : null,
      })
      propose({ kind: 'gated', allowed: verdict.allowed, reason: verdict.reason })
    }
  }

  return { proposals, unusableRules }
}

/* ==================================================================== *
 * §11  CROSS-RUN UNIQUENESS — G178, 23 Aug 2026
 *
 * WHAT WAS WRONG. `RulePredicate` has declared
 * `{ kind: 'unique_within'; subject: Expr; scope: 'group' | 'run' | 'period' |
 * 'tenant_lifetime' }` since before this pass began, and its own docblock says
 * *"`tenant_lifetime` is what duplicate-invoice detection actually needs."*
 * `grep -rn 'unique_within' model/*.ts` returned TWO lines: that declaration
 * and one prose note in this file. **There was no evaluator. The control was
 * declared and did nothing** — the exact state `model/domain.ts` records, four
 * lines under the union, as the reason the `matches_pattern` arm was DELETED
 * rather than left standing: *"that shape is DECLARED with NO EVALUATOR
 * ANYWHERE IN THE TREE … That is not a dormant feature, it is an instruction to
 * the next engineer."*
 *
 * 🛑 THE MISREADING THIS SECTION EXISTS TO REFUSE, RESTATED BECAUSE A HEADLINE
 * INVITES IT. C17 landed as *"a duplicate address is a named refusal"* and
 * **does not touch this**. `duplicate_item_address` (§4a) fires on a repeated
 * `itemKey` — an ADDRESS: a re-delivered file, or a `lineIndex` minted from
 * insertion order. It detects no repeated invoice number and holds no cross-run
 * state. The only mechanism that previously noticed a duplicate identifier was
 * the identifier join declining an ambiguous pair — a different thing, reported
 * differently, at a different grain. `UniquenessVerdict` below is deliberately
 * NOT `LineFinding` and NOT `PopulationDefect`, and the separation is asserted
 * rather than assumed (§5.1, landmark substitution).
 *
 * THE DESIGN, AND WHY IT IS INJECTION RATHER THAN A QUERY. `period` and
 * `tenant_lifetime` cross run boundaries, and this module reaches no database.
 * G178 therefore rules a pure pre-flight EXTRACTION (which subjects a run will
 * need to check), ONE batched query by the caller, and INJECTION of the result
 * as a map — the pattern `AdmissionContext.fieldClassification` already
 * establishes, where an absent entry REFUSES.
 *
 * 🛑 AMENDMENT (a) IS THE WHOLE OF WHY THIS IS NOT A ONE-LINER. The natural
 * implementation is `conflicts.get(scope)?.has(digest)`, which yields
 * `undefined` when the map was never supplied — falsy — so **the rule SILENTLY
 * PASSES: fail-open on a duplicate-payment control.** G178 states in its own
 * cell that `noUncheckedIndexedAccess` will NOT catch this one, because the
 * optional chain is legal. The shape below makes absence a REFUSAL by
 * distinguishing a scope that was queried and found nothing (present, empty
 * set) from a scope that was never queried at all (absent key) — the
 * required-and-possibly-empty distinction §9 already makes for
 * `confidenceFloors`.
 * ==================================================================== */

/**
 * G178 amendment (b) — the canonical hash of a uniqueness subject.
 *
 * 🛑 A BRANDED VALUE, NOT AN `Id<…>`, AND THE DISTINCTION IS ENFORCED BY A TEST
 * RATHER THAN BY THIS COMMENT. It was first written `Id<'SubjectDigest'>` in
 * `model/kernel.ts` and `tests/model/normalised-description.test.ts` went RED:
 * that suite requires every branded id in the tree to RESOLVE to an interface
 * of the same name, and a hash has no interface because **it is not an
 * entity**. Nothing mints one to name a thing; it is minted by hashing a value
 * so the value need not be stored, and two different invoice numbers that hash
 * alike are one digest — a property no id in this repository has.
 * `NormalisedDescriptionValue` (`model/learning.ts`) is the precedent this
 * follows, for the same reason and with the same shape.
 *
 * **Why it is branded at all.** A bare `string` here would fail
 * `AssertNoTextDeep` on `UniquenessVerdict` — correctly, because the whole
 * point of amendment (b) is that a raw invoice number is counterparty-controlled
 * text and must never reach the ledger or the verdict. Branding is what lets
 * the containment proof pass while still refusing the raw value:
 * `NoTextField`'s `T extends string ? T` arm admits a branded string and
 * `string extends T ? never` rejects a naked one.
 *
 * 🛑 NOTHING IN `model/` MAY CONSTRUCT ONE. Hashing needs `node:crypto` and
 * `model/tsconfig.json` is standalone — `model/canonical.ts` states the same
 * rule for itself: *"It does not hash … The hasher lives with the writer,
 * outside `model/`."* This module RECEIVES digests and compares them with
 * `===`, compiles no pattern and interprets no expression.
 */
declare const subjectDigest: unique symbol

export type SubjectDigest = string & {
  readonly [subjectDigest]: 'SubjectDigest'
}

/**
 * The four scopes, as a value. Mirrors the `unique_within` arm's own literal
 * union in `model/domain.ts` — restated here rather than imported because it is
 * a TYPE there, and `_UniquenessScopesMirrorThePredicate` below is what fails
 * to compile if the two ever disagree.
 */
export const UNIQUENESS_SCOPES = {
  group: 'group',
  run: 'run',
  period: 'period',
  tenantLifetime: 'tenant_lifetime',
} as const

export type UniquenessScope =
  (typeof UNIQUENESS_SCOPES)[keyof typeof UNIQUENESS_SCOPES]

/**
 * The pin between this section and the predicate it evaluates.
 *
 * ⚠️ WRITTEN IN THE CONSTRAINT FORM, NOT `? true : never`. `model/domain.ts`
 * records that shape MEASURED as inert: *"a type alias that merely EVALUATES to
 * `never` compiles perfectly happily and asserts nothing"*, and a planted union
 * member left `tsc` at EXIT 0 against it. `Assert<T extends true>` (§0) is the
 * form that stops the build.
 *
 * BOTH DIRECTIONS. A fifth scope added to the predicate and not here is a
 * compile error; a fifth added here and not to the predicate is too.
 */
type UniqueWithinArm = Extract<RulePredicate, { kind: 'unique_within' }>

export type _UniquenessScopesMirrorThePredicate = Assert<
  UniqueWithinArm['scope'] extends UniquenessScope
    ? UniquenessScope extends UniqueWithinArm['scope']
      ? true
      : false
    : false
>

/* ------------------------------------------------------------------ *
 * §11.1  The pure pre-flight extraction
 * ------------------------------------------------------------------ */

/**
 * One subject a run will have to check, and the scope to check it in.
 *
 * `path` is a `FieldPath` — a token list under G214, not a string — so this
 * record carries a counterparty-chosen JSON key and therefore holds NO
 * containment proof. That is the same deliberate absence `RefusedItem` and
 * G227's `HeldRead` carry, and it is stated rather than left to read as an
 * oversight: **the union carrying the REASON holds the proof; the record
 * carrying the declared path does not.**
 */
export interface UniquenessSubject {
  readonly scope: UniquenessScope
  readonly slot: SlotName
  readonly path: FieldPath
}

/**
 * Why a declared `unique_within` cannot be checked at all.
 *
 * Distinct from `UniquenessRefusal` below, which is about the EVALUATION. This
 * one is about the PREDICATE: a rule whose subject names no addressable field
 * can never be evaluated, and the run should learn that before it queries
 * anything rather than at every row.
 */
export type UniquenessExtractionDefect =
  /**
   * The subject is an arithmetic expression — a `sum`, a `difference`, a
   * `product` or a `constant` — so it names no field and there is nothing to
   * key a ledger on. Refused rather than silently skipped: a `unique_within`
   * nobody evaluates is the state this whole section exists to end.
   */
  | { readonly kind: 'subject_not_a_field_reference'; readonly scope: UniquenessScope }

export type _UniquenessExtractionDefectHoldsNoText =
  AssertNoTextDeep<UniquenessExtractionDefect>

export interface UniquenessPreflight {
  readonly subjects: readonly UniquenessSubject[]
  readonly defects: readonly UniquenessExtractionDefect[]
}

/**
 * Which subjects a run will need to check. PURE — no clock, no query, no
 * mutation — which is what lets the caller run it before opening a transaction
 * and batch every scope into one statement, as G178 requires.
 *
 * Total over `Expr`'s six arms via the `switch`: `field` and `aggregate` name a
 * `FieldPath`; the other four do not and produce a defect. A seventh `Expr` arm
 * is a compile error at the `never` binding below, not a silently unchecked
 * rule.
 */
export function uniquenessPreflight(
  predicates: readonly RulePredicate[],
): UniquenessPreflight {
  const subjects: UniquenessSubject[] = []
  const defects: UniquenessExtractionDefect[] = []

  for (const predicate of predicates) {
    if (predicate.kind !== 'unique_within') continue
    const scope = predicate.scope
    const subject = predicate.subject
    switch (subject.kind) {
      case 'field':
      case 'aggregate':
        subjects.push({ scope, slot: subject.slot, path: subject.path })
        break
      case 'constant':
      case 'sum':
      case 'difference':
      case 'product':
        defects.push({ kind: 'subject_not_a_field_reference', scope })
        break
      default: {
        /* A seventh `Expr` arm lands here as a type error rather than as a
         * subject nobody extracts. */
        const unreachable: never = subject
        void unreachable
      }
    }
  }

  return { subjects, defects }
}

/* ------------------------------------------------------------------ *
 * §11.2  The injected conflict map — amendment (a)
 * ------------------------------------------------------------------ */

/**
 * What the caller's ONE batched pre-flight query produced.
 *
 * 🛑 READ THE ABSENCE RULE BEFORE USING THIS TYPE, BECAUSE IT IS THE WHOLE
 * CONTROL. Three states are representable and they mean three different things:
 *
 *   scope key ABSENT       the query was never run for this scope → REFUSE
 *   scope key → empty Set  the query ran and found nothing        → unique
 *   scope key → Set{d…}    the query ran and found these digests  → duplicate
 *
 * The middle case is why this is a `ReadonlyMap` of `ReadonlySet` rather than a
 * flat `ReadonlySet`. A flat set collapses *"queried, nothing found"* into
 * *"never queried"*, and the collapse fails OPEN on a duplicate-payment control
 * — which is exactly amendment (a). §9's `confidenceFloors` makes the same
 * required-and-possibly-empty distinction for the same reason.
 *
 * ⚠️ REQUIRED, NEVER OPTIONAL, at every construction site. The `TS2741` a
 * caller gets for omitting it is the evidence a decision was taken.
 */
export interface KnownUniquenessConflicts {
  readonly byScope: ReadonlyMap<UniquenessScope, ReadonlySet<SubjectDigest>>
}

/**
 * Every way an evaluation can decline to answer.
 *
 * CLOSED, and carrying `scope` — a literal union — but never the subject value.
 * Amendment (b): the raw invoice number is counterparty text and does not enter
 * this module at all; only its digest does.
 */
export type UniquenessRefusal =
  /**
   * 🛑 AMENDMENT (a), THE DEFINING ARM. No entry for this scope in
   * `knownUniquenessConflicts.byScope` — the pre-flight query for it was never
   * run, or its result was never passed in. The rule CANNOT be evaluated and
   * says so. **The implementation this arm exists to refuse is
   * `conflicts.get(scope)?.has(digest)`, which returns `undefined` here and
   * passes the row.**
   */
  | { readonly kind: 'conflict_map_not_supplied'; readonly scope: UniquenessScope }
  /**
   * The caller supplied no digest for this subject on this row. Distinct from
   * the arm above: the ledger WAS consulted, and this row has nothing to
   * compare against it. Fail-closed for G106's reason — an unhashed subject is
   * an unreadable one.
   */
  | { readonly kind: 'subject_not_digested'; readonly scope: UniquenessScope }

export type _UniquenessRefusalHoldsNoText = AssertNoTextDeep<UniquenessRefusal>

/**
 * The answer for one subject on one row.
 *
 * ⚠️ VERIFY THIS PROOF RED BEFORE TRUSTING IT GREEN — `Assert<never>` compiles,
 * so a vacuous proof reads exactly like a real one. Add
 * `subjectValue: string` to the `duplicate` arm and `tsc` must report TS2344.
 * That is not a hypothetical mutation: **the raw subject value is precisely
 * what amendment (b) exists to keep out of this type**, and a future reader
 * wanting to show an operator *which* invoice collided is the person who would
 * add it.
 */
export type UniquenessVerdict =
  | { readonly kind: 'unique' }
  /**
   * ⚠️ IT NAMES THE DIGEST AND NOT THE PRIOR ROW, AND THAT IS A STATED COST,
   * NOT AN OMISSION. G178 amendment (b): *"the ledger alone can no longer show
   * WHICH prior invoice collided — only that one did."* Joining back to the
   * offending run is a separate, authorised read against the ledger; it is not
   * something this verdict can be made to carry by widening it.
   */
  | {
      readonly kind: 'duplicate'
      readonly scope: UniquenessScope
      readonly digest: SubjectDigest
    }
  | { readonly kind: 'refused'; readonly refusal: UniquenessRefusal }

export type _UniquenessVerdictHoldsNoTextDeep = AssertNoTextDeep<UniquenessVerdict>

/**
 * Evaluate one `unique_within` subject against the injected ledger projection.
 *
 * 🛑 THE ORDER OF THE TWO GUARDS IS LOAD-BEARING. The scope lookup uses `.has()`
 * and happens FIRST, before the digest is even examined, so that a missing map
 * refuses whether or not the row happened to be digestible. Written the other
 * way round, a row with no digest against a scope that was never queried would
 * report `subject_not_digested` — a true statement that hides the larger one,
 * and the caller would fix the digest and still be fail-open.
 *
 * Total; never throws; reads no clock and no database.
 */
export function evaluateUniqueWithin(input: {
  readonly scope: UniquenessScope
  readonly digest: SubjectDigest | null
  readonly conflicts: KnownUniquenessConflicts
}): UniquenessVerdict {
  const { scope, conflicts } = input

  /* Amendment (a). `.has()` and NOT `.get()`, for the reason `admitOne` gives
   * for `fieldClassification`: `.get()` on an absent key and `.get()` on a key
   * mapped to an empty set are both falsy, and these are the two cases that
   * must not be confused. */
  if (!conflicts.byScope.has(scope)) {
    return { kind: 'refused', refusal: { kind: 'conflict_map_not_supplied', scope } }
  }

  if (input.digest === null) {
    return { kind: 'refused', refusal: { kind: 'subject_not_digested', scope } }
  }

  const seen = conflicts.byScope.get(scope)
  /* `noUncheckedIndexedAccess` does not apply to `Map.get`, and the `.has()`
   * above does not narrow it either, so this is a real check rather than a
   * ceremonial one. Treating an unexpectedly-absent set as a REFUSAL rather
   * than as `unique` keeps the fail-closed posture on the one path the type
   * system cannot rule out. */
  if (seen === undefined) {
    return { kind: 'refused', refusal: { kind: 'conflict_map_not_supplied', scope } }
  }

  if (seen.has(input.digest)) {
    return { kind: 'duplicate', scope, digest: input.digest }
  }
  return { kind: 'unique' }
}

/* ------------------------------------------------------------------ *
 * §11.3  Pinning — amendment (c)
 * ------------------------------------------------------------------ */

/**
 * The conflict map, flattened to a canonical, order-stable structure.
 *
 * 🛑 WHY THIS EXISTS AND WHAT IT DELIBERATELY IS NOT. Amendment (c) requires
 * `knownUniquenessConflicts` to be pinned *"in the `RunPlan` and in the content
 * key"*, or **two resumes against different ledger states produce two different
 * answers from identical input** — the key stable while the answer was not.
 *
 * ⚠️ NEITHER `RunPlan` NOR ANY CONTENT KEY EXISTS IN THIS REPOSITORY.
 * `grep -rl 'RunPlan' model/*.ts` → 0, and there is no content-key mechanism
 * anywhere to pin into — the nearest thing in the tree is `TokenMeter
 * .idempotencyKey`, which is a provider request id for at-least-once delivery
 * and a different concept. **So this slice mints the PINNABLE PROJECTION and
 * not the plan**, because minting `RunPlan` here would decide TWO shared shapes
 * — the plan and the key — from one caller's needs, which is the cost #239
 * names against that option in its own decision table.
 *
 * What that buys, concretely: when the content key lands it has exactly one
 * thing to include for uniqueness and no second implementation to reconcile.
 * G111's argument for one money codec, applied to a key instead of to money.
 *
 * 🛑 IT RETURNS A STRUCTURE, NOT A HASH AND NOT A STRING. Hashing needs
 * `node:crypto` and canonicalising is `model/canonical.ts`'s job — and this
 * module may not import it, because §0's control caps the value imports here at
 * a stated number and each one has to be argued for. The caller passes this to
 * `canonicalise()` and hashes the result outside `model/`, which is the same
 * seam amendment (b) already puts the subject hash behind.
 *
 * ORDER IS FIXED BY `UNIQUENESS_SCOPES`, and digests are sorted within a scope,
 * so two callers holding equal maps produce byte-identical output. **A `Set`
 * iterates in insertion order**, which is a property of how the caller happened
 * to build it rather than of what it contains — pinning that would make the
 * content key depend on the order rows came back from a database. G143(b)
 * requires a rebuild to be a pure function of its named inputs; insertion order
 * is not one of them.
 */
export function uniquenessConflictPinning(
  conflicts: KnownUniquenessConflicts,
): readonly (readonly [UniquenessScope, readonly string[]])[] {
  const pinned: (readonly [UniquenessScope, readonly string[]])[] = []
  for (const scope of Object.values(UNIQUENESS_SCOPES)) {
    const seen = conflicts.byScope.get(scope)
    /* An unqueried scope is pinned as ABSENT rather than as an empty list. The
     * two mean different things everywhere else in this section and must go on
     * meaning different things inside the content key, or a resume that
     * refused and a resume that passed share a key. */
    if (seen === undefined) continue
    pinned.push([scope, [...seen].sort()])
  }
  return pinned
}

/* ------------------------------------------------------------------ *
 * §11.4  The post-flight insert — amendment (d), G143(c)
 * ------------------------------------------------------------------ */

/**
 * How the caller's post-flight ledger insert ended.
 *
 * **The `UNIQUE` constraint on the ledger is the race guard and is the point of
 * the table** — a check-then-insert is not it, because two runs can both read
 * "absent" before either writes. The pre-flight map narrows the window; the
 * constraint closes it.
 */
export type LedgerInsertOutcome =
  /** The digest was new. */
  | { readonly kind: 'inserted' }
  /**
   * The `UNIQUE` constraint fired: another run wrote this digest between the
   * pre-flight query and this insert. **Not an error** — it is the race guard
   * doing its job, and the row is a duplicate after all.
   */
  | { readonly kind: 'raced' }

/**
 * Amendment (d), G143(c) verbatim: *"Bound the retry and COUNT the
 * suppression."*
 *
 * 🛑 PART (c) IS THE HALF EVERYONE DROPS, AND G143 SAYS SO: *"a no-op that
 * leaves no trace is indistinguishable from work that never happened. No design
 * on any surface may claim retry-safety without naming its content key and its
 * counter."* `suppressedRepeats` is that counter and it is a plain number a
 * person can query, not a log line.
 *
 * `attemptsUsed` and the bound are both recorded, so an exhausted budget is
 * visible rather than absorbed — the shape §5 already uses for
 * `SubsetSumBound`, whose exhaustion surfaces as
 * `fellThroughFrom: 'budget_exhausted'` rather than as silence. G114: *"a bound
 * that was hit is recorded, never silently absorbed."*
 */
export interface LedgerWriteAccount {
  readonly attemptsUsed: number
  /**
   * ⚠️ NAMED `attemptBudget` AND NOT `maxAttempts`, AND THE REASON IS A CONTROL
   * IN ANOTHER SLICE THAT CAUGHT THIS ON ITS FIRST RUN.
   * `tests/model/sign-in-attempt.test.ts` greps ALL of `model/` for
   * `lockout|lockedUntil|attemptCount|failedAttempts|maxAttempts` and fails on
   * any hit, because **G223** rules that a sign-in lockout is a separate,
   * unruled question and *"must not arrive as a side effect of this slice"* —
   * a per-user attempt counter cannot exist without re-creating the
   * user-existence oracle `SignInAttempt` is shaped to avoid.
   *
   * That guard is keyed on a NAME across the whole model, which makes it
   * deliberately over-broad: this field is a database retry bound and has
   * nothing to do with sign-in. **The right response is to rename here, not to
   * narrow the guard** — a control that gets weakened the first time it fires
   * inconveniently stops being a control. `budget` is also the tree's own word
   * for a bound of this kind (`SubsetSumBound.stepBudget`, §5), so the rename
   * moves toward the house vocabulary rather than away from it.
   */
  readonly attemptBudget: number
  /** How many attempts hit the `UNIQUE` constraint. The counted suppression. */
  readonly suppressedRepeats: number
  readonly settled: 'inserted' | 'duplicate' | 'budget_exhausted'
}

export type _LedgerWriteAccountHoldsNoTextDeep = AssertNoTextDeep<LedgerWriteAccount>

/**
 * Fold a bounded sequence of insert attempts into one account.
 *
 * PURE — it performs no insert. The caller drives the attempts against the
 * database and hands the outcomes here, for the same reason §7 makes the LLM
 * seam a type rather than a call: this module reaches nothing.
 *
 * ⚠️ `attemptBudget` IS THE CALLER'S AND HAS NO DEFAULT. A default retry bound is
 * a number nobody stated, which `PRODUCT.md` forbids and G139 refuses; a
 * non-positive bound settles as `budget_exhausted` with zero attempts rather
 * than looping or throwing.
 *
 * ⚠️ MORE OUTCOMES THAN THE BOUND PERMITS ARE TRUNCATED, NOT HONOURED. A caller
 * that ignored its own budget does not get a different answer by handing over
 * extra evidence.
 */
export function accountLedgerWrite(
  outcomes: readonly LedgerInsertOutcome[],
  attemptBudget: number,
): LedgerWriteAccount {
  const bound = Number.isInteger(attemptBudget) && attemptBudget > 0 ? attemptBudget : 0
  let attemptsUsed = 0
  let suppressedRepeats = 0
  let settled: LedgerWriteAccount['settled'] = 'budget_exhausted'

  for (const outcome of outcomes) {
    if (attemptsUsed >= bound) break
    attemptsUsed += 1
    if (outcome.kind === 'inserted') {
      settled = 'inserted'
      break
    }
    suppressedRepeats += 1
    settled = 'duplicate'
  }

  return { attemptsUsed, attemptBudget: bound, suppressedRepeats, settled }
}
