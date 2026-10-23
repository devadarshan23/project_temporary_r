/**
 * Hand-written types for `tools/skip-census.mjs`, on the same footing as
 * `db/pg.d.ts`: the tool is plain ESM because every other checker in `tools/`
 * is, and a test that imports it must still typecheck under
 * `tests/tsconfig.json`.
 *
 * ⚠️ NOT GENERATED. If the tool's shape changes, this changes with it, by hand.
 */

/** One suite the runner reported as skipped, as the reporter records it. */
export interface SkippedSuite {
  readonly file: string
  readonly line: number
  readonly column: number
  readonly name: string
  readonly reason: string
}

/** What a skipped suite's callback would have created, had it run. */
export interface Hidden {
  readonly assertions: number
  readonly suites: number
  /** True when a counted call sits in a loop: the count is a floor, not a total. */
  readonly indeterminate: boolean
}

export function hiddenAssertions(
  file: string,
  line: number,
  column: number,
): Hidden | null

export function censusText(
  skippedSuites: readonly SkippedSuite[],
  counts: { readonly tests: number; readonly skipped: number },
  cwd?: string,
): string

declare const skipCensus: (
  source: AsyncIterable<unknown>,
) => AsyncGenerator<string, void, unknown>

export default skipCensus
