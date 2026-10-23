/**
 * THE REASON A DESTRUCTIVE ACT CARRIES — required IN THE TYPE, not by review.
 *
 * 🛑 THE BUNDLE IS EXPLICIT THAT THIS IS NOT A COURTESY FIELD.
 * `design/system/index.html`, on the modal: the reason *"is product machinery —
 * it is what an SOP amendment would be drafted from."* A field described that way
 * and typed `string` is a field that arrives empty, because `''` is a `string`
 * and every caller that forgets it still compiles.
 *
 * So the reason is BRANDED. `Reason` cannot be written down — there is no literal
 * of this type — and the only way to obtain one is `reasonFrom()`, which returns
 * `null` for anything blank. A destructive act whose confirm handler takes a
 * `Reason` therefore cannot be invoked without one, and "a destructive act with
 * no reason does not compile" is a property of the type rather than a sentence in
 * a checklist.
 *
 * ⚠️ WHY A BRAND AND NOT A REQUIRED `reason: string` PROP. A required prop is
 * satisfied by `reason=""`, by `reason={undefined as string}` and by a state
 * variable that has not been filled in yet — all three compile, and all three are
 * the empty-reason bug. The brand moves the check to the ONE place a reason
 * enters the system, which is the point of `Money.amountMinor`'s codec under G111
 * and of every branded id in `model/`: *"correctness that lives at call sites is
 * correctness that drifts."*
 *
 * ⚠️ AND THE BRAND IS ERASABLE. `declare const` is ambient — it emits nothing —
 * so this file satisfies `erasableSyntaxOnly` alongside the rest of the frontend.
 */

declare const REASON: unique symbol

/** A non-blank reason. Obtainable only from `reasonFrom()`. */
export type Reason = string & { readonly [REASON]: true }

/**
 * Mint a `Reason`, or `null` if there is not one.
 *
 * ⚠️ THE TEXT IS TRIMMED BEFORE IT IS JUDGED AND THE TRIMMED FORM IS WHAT IS
 * RETURNED. A reason of three spaces is not a reason, and storing it with its
 * whitespace would put the difference between `"posted"` and `"posted "` into the
 * audit trail an SOP amendment is drafted from.
 */
export function reasonFrom(text: string): Reason | null {
  const trimmed = text.trim()
  return trimmed === '' ? null : (trimmed as Reason)
}

/**
 * Read a `Reason` back as ordinary text.
 *
 * It exists so that reaching the string is a NAMED act. `String(reason)` works —
 * the brand is structural — and that is fine; what this stops is the reverse
 * direction being equally easy to write by accident.
 */
export function reasonText(reason: Reason): string {
  return reason
}
