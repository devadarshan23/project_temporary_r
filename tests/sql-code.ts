/**
 * A MIGRATION'S SQL WITH ITS COMMENTS REMOVED — and the reason it exists is a
 * defect that fired twice in this repository, in the same shape, a day apart.
 *
 * G834 (20 Sep 2026), derived and not the owner's.
 *
 * ┌─ THE INSTANCE, AND IT IS THE SECOND ONE ──────────────────────────────────┐
 * │ `tests/http/administration-tier-unmounted.test.ts` §4a asserts that no    │
 * │ migration in either set declares an onboarding step, and it does it by    │
 * │ scanning the RAW TEXT of every `.sql` file for the token `onboarding`.    │
 * │ `db/migrations-control/0002_tenancy_roster.sql` (G831) declares no such   │
 * │ column and **REFUSES one by name**, arguing on its own face that a stage  │
 * │ column here would be a second home for H2's state. That refusal made §4a  │
 * │ RED. Exact text, witnessed before this file existed:                      │
 * │                                                                            │
 * │   "`onboarding` appears in the migration corpus. H2's state has a column  │
 * │    now, and `model/onboarding.ts` is the vocabulary it must be built out  │
 * │    of rather than a second one."                                          │
 * │                                                                            │
 * │ **Every clause of that message was false.** No column existed; the token  │
 * │ was in a comment explaining why one must not.                             │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE SAME FILE ALREADY RECORDS THIS DEFECT AGAINST ITSELF, ONE SECTION
 * OVER, WHICH IS WHY THE REPAIR IS THIS AND NOT A NARROWER REGEX. Its `codeOf()`
 * carries the note in full:
 *
 *     "ADDED AFTER §5b's FIRST RUN WENT RED FOR THE WRONG REASON, AND THE
 *      CORRECTION IS §5.1 CAUGHT IN THE ACT. The first version scanned raw file
 *      text for a console hostname and found one — in `server/contract/
 *      document.ts`, inside the DOCBLOCK G533 had just written to explain that
 *      no plane serves those hosts. The assertion was keyed on a landmark (the
 *      string appearing anywhere in a file) instead of on the property it
 *      protects … and it would have made every future explanation of this
 *      blocker a red gate."
 *
 * **§4a is that sentence, in SQL, in the same file.** So the repair is the
 * same repair: strip the commentary, then read the absence off what is left.
 *
 * ⚠️ IT IS A SCANNER AND NOT A PARSER, AND THE LIMIT IS NAMED — `codeOf()`'s
 * own caveat, transferred. A `--` sequence inside a string literal is
 * mis-stripped. That trades a false RED for a possible false GREEN, so **every
 * caller must assert that the stripper left real SQL behind before reading an
 * absence off it** — `sqlCorpusIsReal()` below is that guard, stated once so a
 * caller cannot forget to write it, and it is the guard that would have caught
 * the ordering defect `sqlCode()`'s own header records.
 *
 * ⚠️ DOLLAR-QUOTED BODIES ARE NOT PROTECTED EITHER. `db/migrations/0019` and
 * `0035` carry `CREATE OR REPLACE FUNCTION … $$ … $$`, and a `--` inside one
 * of those bodies is a real SQL comment, so stripping it is correct; a `--`
 * inside a STRING inside such a body is not, and would be mis-stripped. No
 * migration in the tree has one, and this note is here so the first one to
 * arrive is met by a named limitation rather than by a silent green.
 */

import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Remove `--` line comments, then block comments.
 *
 * 🛑 **THE ORDER IS THE OPPOSITE OF `codeOf()`'s AND IT IS NOT A STYLE CHOICE —
 * THE FIRST DRAFT TOOK BLOCK COMMENTS FIRST AND DESTROYED THE CORPUS.** It was
 * caught by `tests/http/console-roster-unreachable.test.ts` §2b going red on a
 * claim that is plainly true of the tree: `tenant.platform_role_assignment`
 * appeared to be absent from `db/migrations/`, and it is declared at
 * `db/migrations/0009_identity_substrate.sql`'s `CREATE TABLE`.
 *
 * **The cause is that these migrations have no block comments at all and are
 * full of things that look like one.** Measured, not guessed:
 *
 *     node -e "…count '/*' and '*' + '/' per file…"   # 11 of 26 files, unbalanced
 *
 * Every one of those sequences is inside a `--` line, and almost all of them
 * are PATHS a comment cites — `db/migrations/*.sql`, `model/*.ts`,
 * `tests/db/*.test.ts`. A `/` immediately before a `*` opens a block comment
 * that then runs to the next `*` immediately before a `/`, **hundreds of lines
 * later and usually in another file**, taking real DDL with it.
 *
 * ⚠️ AND IT WOULD HAVE FAILED SILENTLY IN THE OTHER DIRECTION. An absence
 * asserted over a corpus that has been eaten is FREE — this repository's §5.6
 * exactly — and `sqlCorpusIsReal()`'s length floor is the only thing standing
 * between that and a green run. Taking `--` first removes the glob before it
 * can open anything, which for THIS corpus is exactly right and for a corpus
 * carrying genuine C-style block comments would be exactly wrong. **There are
 * none; if one arrives, this function is what has to change, and the guard
 * below is what should notice.**
 */
export function sqlCode(source: string): string {
  return source.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')
}

/** Every `.sql` file in a directory, concatenated, in filename order. */
export function sqlCorpus(dir: string): string {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(path.join(dir, f), 'utf8'))
    .join('\n')
}

/**
 * THE GUARD EVERY CALLER OWES, WRITTEN ONCE.
 *
 * An absence read off an empty string is free. This requires the stripped
 * corpus to still contain real DDL before any caller may read a `!includes()`
 * off it — the §5.6 shape `rls-census` and `administration-tier-unmounted`
 * both state for their own scanners.
 */
export function sqlCorpusIsReal(stripped: string, what: string, minChars = 500): void {
  assert.ok(
    stripped.includes('CREATE TABLE'),
    `${what}: the stripped SQL corpus holds no CREATE TABLE, so every absence read off it ` +
      'is vacuous. Either the corpus did not load or `sqlCode()` removed the whole file — ' +
      'both are the §5.6 failure this guard exists for.',
  )
  /**
   * ⚠️ THE FLOOR IS A PARAMETER BECAUSE THE TWO CORPORA ARE TWO ORDERS OF
   * MAGNITUDE APART, AND A SHARED CONSTANT WOULD BE WRONG FOR ONE OF THEM.
   * `db/migrations/` strips to tens of thousands of characters; the control
   * set is two files and strips to around a thousand. A floor set for the
   * first is no guard at all over the second, and a floor set for the second
   * would let `db/migrations/` lose fifty files and still pass.
   */
  assert.ok(
    stripped.length > minChars,
    `${what}: the stripped SQL corpus is ${stripped.length} characters against a floor of ` +
      `${minChars}, which is too small to be the corpus this caller means. Read the note in ` +
      '`tests/sql-code.ts` about string literals before assuming the stripper is right.',
  )
}
