#!/usr/bin/env node
/**
 * check-g-numbers — keep the decision record addressable.
 *
 * A `G` number is the only address §3 of `docs/HANDOFF.md` has. Two sessions
 * minted the same numbers twice on 2026-08-15/16, and both were caught by a
 * person reading. A collided number RESOLVES, so no existing checker sees it.
 *
 * Two checks, and only two:
 *
 *   A · DUPLICATES — no `^| G(\d+) |` row number appears twice in the working
 *       tree's `docs/HANDOFF.md`. One file read. Always runs.
 *
 *   B · TRUNK COLLISIONS — no row on this branch SPENDS A NUMBER TRUNK ALREADY
 *       SPENT FOR A DIFFERENT RULING. The definition is three-sided and the
 *       third side is the whole point:
 *
 *         a row collides iff its number is ABSENT at `git merge-base
 *         origin/main HEAD`, PRESENT on `origin/main`, and PRESENT here with
 *         different text.
 *
 *       "Absent at the fork point" is what separates a collision from the two
 *       things it is constantly confused with. Compare branch-to-trunk alone
 *       and a byte difference has three causes, not one:
 *
 *         (a) I minted a number trunk had already spent  — THE COLLISION
 *         (b) trunk amended a row I have not pulled yet  — a stale branch
 *         (c) I amended an existing row in place         — normal operation
 *
 *       (b) and (c) both touch a number that EXISTED AT THE FORK POINT, so the
 *       merge-base side excludes them by construction. (a) cannot have existed
 *       at the fork point — that is what "newly minted" means. Marking a ruling
 *       ✅ applied is (c); this record does it constantly, and an earlier
 *       revision of this checker went red on every one of them.
 *
 *       Replayed against the one real collision in this repository's history —
 *       `design/teal-world-and-o16` (`ce2fb20e`) against trunk (`7f3aa24b`),
 *       merged at `1a919485` — this definition flags exactly G179–G183 and
 *       nothing else. Branch-to-trunk flags twelve, of which seven are
 *       amendments. The replay is committed as a fixture under
 *       `tests/tools/fixtures/g-numbers/replay-1a919485/`.
 *
 * 🛑 WHAT THIS CANNOT SEE. Read this before citing the gate as coverage.
 *
 *   · UNMERGED BRANCHES. The number another open PR has already spent is not in
 *     any object this checker reads. Both historical collisions were minted in
 *     parallel by sessions that could not see each other, and this checker
 *     would not have stopped either minting — it turns a silent overwrite into
 *     a red gate AT THE SECOND MERGE, which is when the renumber is owed.
 *     Closing the parallel half needs network (`git ls-remote` per branch, or
 *     `gh pr list`), whose answer changes between two runs a second apart —
 *     refused under G108's determinism condition, and refused explicitly rather
 *     than shipped as a flag that half-works. There is no `--remote`.
 *
 *   · GITHUB. This reads the tree, never the issue tracker. Issue bodies #177,
 *     #180, #187–#189, #204 and #206–#214 all cite `G18x` numbers by hand. A
 *     renumber leaves every one of them pointing at a different ruling, and no
 *     checker in this repository can see a single one of them. That hole is
 *     open and is not this checker's to close.
 *
 *   · CI, in practice. `.github/workflows/check.yml` runs `actions/checkout`
 *     with no `fetch-depth`, so `origin/main` is not a resolvable ref there.
 *     Check B therefore reports `unavailable` on essentially every CI run and
 *     only check A is live in CI. That is the safe direction — a check that
 *     cannot run must not look like a check that ran, `check-pack-safety.mjs`'s
 *     `vacuous` finding is the precedent — but do not read a green CI run as
 *     evidence that no number collided with trunk.
 *
 * Determinism, under G108: every git call is a LOCAL OBJECT READ against the
 * remote-tracking ref this clone already has. Nothing fetches; nothing touches
 * the network.
 */
import { readFileSync, realpathSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** The record, relative to the repository root. */
export const RECORD_PATH = 'docs/HANDOFF.md'

/**
 * The trunk side is the REMOTE-TRACKING ref, never bare `main`. A local `main`
 * is arbitrarily behind whatever was last pulled, and that staleness is exactly
 * how both historical collisions reproduce: three sessions read "the next free
 * number is G186" off three different answers to the same question.
 */
export const TRUNK_REF = 'origin/main'

/** The branch side. */
export const BRANCH_REF = 'HEAD'

/**
 * A row anchor is `| G<digits> |` AT COLUMN 0, and nothing else is a row.
 *
 * Prose narrating a renumber ("G179–G183 … renumber to G186–G190") and a cell
 * citing another ruling ("🛑 REOPENED BY G203") both name a G number inside a
 * line, and neither mints one. Fenced blocks are skipped whole because the
 * reproduce commands in this record quote row syntax verbatim.
 */
export function parseGRows(text) {
  const rows = []
  let fenced = false
  for (const [index, line] of text.split('\n').entries()) {
    if (/^\s*```/.test(line)) { fenced = !fenced; continue }
    if (fenced) continue
    const m = line.match(/^\| G(\d+) \|/)
    if (m?.[1]) rows.push({ number: Number(m[1]), line: index + 1, text: line })
  }
  return rows
}

/** Check A. Any number that anchors two rows in one tree. */
export function findDuplicates(rows) {
  const seen = new Set(), duplicates = new Set()
  for (const row of rows) { if (seen.has(row.number)) duplicates.add(row.number); seen.add(row.number) }
  return [...duplicates].sort((a, b) => a - b)
}

/**
 * Check B. See the module header for why all three sides are required.
 *
 * `baseRows` is the record AT THE MERGE BASE. Passing `trunkRows` as `baseRows`
 * would make every branch row look pre-existing and the check would never fire;
 * passing `null` for either side is `unavailable`, not `ok`.
 */
export function findTrunkCollisions(rows, trunkRows, baseRows) {
  if (!trunkRows || !baseRows) return { state: 'unavailable', numbers: [] }
  const trunk = new Map(trunkRows.map(row => [row.number, row.text]))
  const atFork = new Set(baseRows.map(row => row.number))
  const numbers = rows
    .filter(row => !atFork.has(row.number) && trunk.has(row.number) && trunk.get(row.number) !== row.text)
    .map(row => row.number)
  return { state: 'ok', numbers: [...new Set(numbers)].sort((a, b) => a - b) }
}

/**
 * Resolves the two comparison sides through an INJECTED git runner, so a test
 * can observe exactly which refs are asked for rather than trusting a comment.
 * `git(args)` takes an argv array and returns stdout, or throws.
 */
export function readComparisonSides(git) {
  let base
  try {
    base = git(['merge-base', TRUNK_REF, BRANCH_REF]).trim()
  } catch {
    return { state: 'unavailable', reason: `no merge base for ${TRUNK_REF} and ${BRANCH_REF}`, trunkRows: null, baseRows: null }
  }
  if (!base) return { state: 'unavailable', reason: `no merge base for ${TRUNK_REF} and ${BRANCH_REF}`, trunkRows: null, baseRows: null }
  try {
    return {
      state: 'ok',
      reason: null,
      trunkRows: parseGRows(git(['show', `${TRUNK_REF}:${RECORD_PATH}`])),
      baseRows: parseGRows(git(['show', `${base}:${RECORD_PATH}`])),
    }
  } catch {
    return { state: 'unavailable', reason: `${RECORD_PATH} unreadable at ${TRUNK_REF} or at the merge base`, trunkRows: null, baseRows: null }
  }
}

/** The real runner. Local object reads only — `stderr: 'pipe'` keeps git's own
 * `fatal: …` off the console, because the `unavailable` line below is the
 * message a reader is meant to act on. */
const localGit = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1024 * 1024 * 256, stdio: ['ignore', 'pipe', 'pipe'] })

export function main(argv = []) {
  // This checker takes no arguments, and an unknown one is refused rather than
  // ignored. `--remote` in particular USED TO EXIST here as a placeholder that
  // printed "unavailable" and did nothing; it is gone, because a flag naming a
  // capability it does not have is the overstatement this record catches most
  // often. Ignoring it silently would let a session run it, read exit 0, and
  // believe open branches were checked. Nothing checks open branches.
  if (argv.length) {
    console.log(`check-g-numbers takes no arguments; got ${argv.join(' ')}`)
    if (argv.includes('--remote')) {
      console.log('`--remote` was REMOVED, not renamed. Scanning unmerged branches needs the network,')
      console.log('whose answer changes between two runs a second apart — refused under G108. See the header.')
    }
    return 2
  }

  const rows = parseGRows(readFileSync(join(ROOT, RECORD_PATH), 'utf8'))

  /**
   * THE DENOMINATOR, FIRST AND BEFORE ANY VERDICT — G1475, and it was
   * witnessed RED against a sandbox holding this file and an EMPTY
   * `docs/HANDOFF.md`:
   *
   *     G rows: 0 · duplicates 0
   *     trunk collisions: 0
   *     EMPTY-SUBJECT EXIT=0
   *
   * **A duplicate cannot be found among zero rows and a collision cannot be
   * found against zero rows**, so that run asserted nothing and said so in
   * the vocabulary of success — `docs/build/completion-plan.md` K4, and
   * `docs/HANDOFF.md` §5.6 inside a checker whose own header warns that *"a
   * guard that turns the checker into a no-op is worse than no guard."*
   *
   * ⚠️ IT KEYS ON THE ROW SET AND NOT ON THE FILE. A `docs/HANDOFF.md` that
   * is present and parses to nothing — a table reformatted, the `| G123 |`
   * form changed, a regex that stopped matching — is exactly the case a
   * file-exists check would wave through, and it is the one that has
   * actually happened to line scanners in this repository.
   *
   * ⚠️ AND IT IS NOT A CEILING. It asks whether the subject EXISTS, not
   * whether it is big enough; a floor somebody guessed is the plausibility
   * band `check-doc-counts.mjs` records the cost of.
   */
  if (rows.length === 0) {
    console.log(`NO G ROWS PARSED from ${RECORD_PATH} — every verdict below would be vacuous.`)
    console.log('  A duplicate cannot be found among zero rows, and a trunk collision cannot be')
    console.log('  found against zero rows. The record parsing to nothing looks exactly like a')
    console.log('  clean record. Fix the derivation; do not delete the assertion.')
    return 1
  }

  const duplicates = findDuplicates(rows)
  const sides = readComparisonSides(localGit)
  const collisions = findTrunkCollisions(rows, sides.trunkRows, sides.baseRows)

  console.log(`G rows: ${rows.length} · duplicates ${duplicates.length}`)
  if (collisions.state === 'unavailable') {
    console.log(`trunk collision check unavailable (non-fatal) — ${sides.reason}`)
    console.log(`  it compares against ${TRUNK_REF} and \`git merge-base ${TRUNK_REF} ${BRANCH_REF}\`; a shallow checkout has neither`)
  } else {
    console.log(`trunk collisions: ${collisions.numbers.length} (numbers absent at the merge base, spent on ${TRUNK_REF})`)
  }
  if (duplicates.length) console.log(`DUPLICATE G numbers: ${duplicates.join(', ')}`)
  if (collisions.numbers.length) console.log(`TRUNK COLLISIONS: ${collisions.numbers.join(', ')}`)
  return duplicates.length || collisions.numbers.length ? 1 : 0
}

/**
 * The main-module guard, and `realpathSync` is load-bearing rather than
 * defensive. Node resolves symlinks when it builds `import.meta.url` and does
 * NOT resolve them in `process.argv[1]`, so on any checkout reached through a
 * symlink — macOS's `/tmp` → `/private/tmp` being the one every test here hits
 * — the two strings differ and the CLI silently does nothing while exiting 0.
 * A guard that turns the checker into a no-op is worse than no guard.
 */
function isEntryPoint() {
  const argv1 = process.argv[1]
  if (!argv1) return false
  try { return import.meta.url === pathToFileURL(realpathSync(argv1)).href }
  catch { return import.meta.url === pathToFileURL(argv1).href }
}

if (isEntryPoint()) process.exit(main(process.argv.slice(2)))
