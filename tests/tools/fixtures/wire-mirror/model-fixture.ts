/**
 * Fixture model for tools/check-wire-mirror.mjs.
 *
 * NOT part of model/. Nothing here is a domain declaration and nothing may
 * import it outside tests/tools/. It exists so the checker's four behaviours —
 * missing member, extra member, reordering, absent wire schema — can each be
 * witnessed against a model side that is fully under the test's control, rather
 * than against the real tree where a repair would silently delete the witness.
 *
 * It is deliberately shaped like the real declarations the checker scans: a
 * discriminated union keyed on `kind`, a `const` object of wire strings, and an
 * `Exclude` narrowing that is invisible to a line scanner.
 */

/** Mirrors the shape of `SubjectLocation` — a union discriminated on `kind`. */
export type FixtureLocation =
  | { kind: 'alpha'; alphaId: string }
  | { kind: 'bravo'; bravoId: string }
  | { kind: 'charlie'; charlieId: string }

/** Mirrors the shape of `METERS` — a const object whose VALUES are the wire strings. */
export const FIXTURE_METERS = {
  alphaCount: 'alpha_count',
  bravoCount: 'bravo_count',
} as const

export type FixtureMeter = (typeof FIXTURE_METERS)[keyof typeof FIXTURE_METERS]

/** Mirrors the shape of `LivePolicyKind` — derived by subtraction, never re-listed. */
export type LiveFixtureMeter = Exclude<FixtureMeter, 'bravo_count'>

/**
 * Mirrors the shape of `RunStatus` — a bare union of string literals with no
 * `kind:` discriminator and no const object behind it. This is the shape the
 * `literal_union` source kind exists to read, and the shape `unionKinds()`
 * returns [] for, which is why it needed a sibling rather than a widened regex.
 *
 * Written across several lines on purpose: the real declarations in `model/`
 * appear both ways (`SlotRole` on one line, `ExceptionStatus` over seven), and
 * a scanner that only reads one of the two forms is a scanner that will miss
 * the next one.
 */
export type FixtureRunStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
