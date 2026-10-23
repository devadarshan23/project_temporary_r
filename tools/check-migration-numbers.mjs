#!/usr/bin/env node
/**
 * check-migration-numbers — two migrations may not spend the same number.
 *
 * ┌─ WHY THIS EXISTS, AND IT IS NOT A HYPOTHETICAL ───────────────────────────┐
 * │ On 19 Sep 2026 two agents working in parallel each wrote a migration and   │
 * │ each numbered it `0011`: `0011_federated_connection.sql` (G304) and        │
 * │ `0011_payload_and_subject_index.sql` (G320). Both branches were green.     │
 * │ **`git merge` produced BOTH FILES WITH NO CONFLICT**, because they are     │
 * │ different filenames and git had no reason to object.                       │
 * │                                                                            │
 * │ 🛑 AND NOTHING DOWNSTREAM WOULD HAVE OBJECTED EITHER. `db/migrate.ts`       │
 * │ orders by `readdir().sort()` and keys `public.schema_migration` on the     │
 * │ FILENAME, so both would have applied, in ALPHABETICAL order —              │
 * │ `_federated_` before `_payload_` — which is an order nobody chose and      │
 * │ which would flip on a rename. G88 makes migrations FORWARD-ONLY, so an     │
 * │ accidental order is not a thing you fix later; it is a thing you live in.  │
 * │                                                                            │
 * │ The two that collided happened to be independent. The next pair will not   │
 * │ be, and the failure then is a migration that runs before the thing it      │
 * │ depends on — on whichever machine sorts differently, or after whichever    │
 * │ rename.                                                                     │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHY A CHECKER AND NOT A CONVENTION ──────────────────────────────────────┐
 * │ `docs/HANDOFF.md` §3's G-numbers had exactly this problem, twice, on       │
 * │ 15–16 Aug 2026, and the answer was `tools/check-g-numbers.mjs` rather than │
 * │ a rule people were asked to remember. Its header states the reason and it  │
 * │ transfers unchanged: *"A collided number RESOLVES, so no existing checker  │
 * │ sees it."* A collided migration number resolves too — both files exist,    │
 * │ both parse, both apply.                                                     │
 * │                                                                            │
 * │ ⚠️ THE G-NUMBER CHECKER DOES NOT COVER THIS. It reads `^| G(\\d+) |` rows   │
 * │ in one Markdown file. A migration is a filename in two directories, and    │
 * │ the reservation scheme that prevented the G collision on this very day     │
 * │ (blocks handed to each agent) was never extended to migrations — which is  │
 * │ how the collision happened while the G-numbers stayed clean.               │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * G108: a new checker JOINS `npm run check` rather than standing beside it, and
 * must be **deterministic and fast**. This reads two directory listings and
 * compares integers — no database, no network, no parse. It was **witnessed RED
 * first**, against the real merged tree that carried both `0011`s, which is the
 * acceptance condition G108 attaches and which a checker added on a green tree
 * cannot claim.
 *
 * ⚠️ THE TWO SETS ARE CHECKED SEPARATELY AND THAT IS DELIBERATE, NOT AN
 * OVERSIGHT. `db/migrations/` and `db/migrations-control/` are two independent
 * forward-only sequences under G193 — two planes, two databases — and each is
 * driven by its own entry point. `0001` legitimately exists in both. Merging
 * them into one namespace would invent a constraint the deployment does not
 * have.
 *
 * ┌─ THE DENOMINATOR — G1473, AND IT WAS WITNESSED RED ───────────────────────┐
 * │ ⚠️ THIS CHECKER PRINTED A TICK OVER AN EMPTY SUBJECT AND EXITED 0 UNTIL    │
 * │ 21 Sep 2026, WHICH IS §5.6 ARRIVING IN A TOOL WRITTEN TO CATCH §5.6.       │
 * │ Measured rather than reasoned, in a sandbox holding this file and two      │
 * │ EMPTY directories:                                                         │
 * │                                                                            │
 * │     ✔ db/migrations — 0 migrations, 0 distinct numbers                     │
 * │     ✔ db/migrations-control — 0 migrations, 0 distinct numbers             │
 * │     EMPTY-SUBJECT EXIT=0                                                   │
 * │                                                                            │
 * │ Two green ticks, byte-identical in shape to the real ones, over nothing.   │
 * │ **A collision cannot be found among zero files**, so that run asserted     │
 * │ exactly nothing and said so in the vocabulary of success. A directory that │
 * │ moved, a `readdir` that started filtering differently, an extension that   │
 * │ changed — each reads as a clean gate.                                      │
 * │                                                                            │
 * │ ⚠️ AND A SECOND DEFECT WAS FOUND WHILE FIXING THE FIRST: `if (failed ===   │
 * │ 0)` read the ACCUMULATED counter, so a collision in `db/migrations`        │
 * │ SUPPRESSED THE TICK FOR `db/migrations-control` — the second set was       │
 * │ checked and its result never printed. The counter is now per-set, and the  │
 * │ tick is per-set with it.                                                   │
 * └────────────────────────────────────────────────────────────────────────────┘
 */

import { readdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** The two independent sequences. See the header for why they are not pooled. */
const SETS = ['db/migrations', 'db/migrations-control']

/**
 * ⚠️ ANCHORED, AND IT REFUSES A FILE THAT DOES NOT MATCH RATHER THAN SKIPPING
 * IT. A migration named outside the convention is not a file this checker has
 * no opinion about — it is a file whose ORDER is undefined, which is the same
 * defect wearing a different name. Skipping it would make this checker pass
 * while asserting nothing about that file (§5.6).
 */
const NAME = /^(\d{4})_[a-z0-9_]+\.sql$/

let failed = 0

for (const set of SETS) {
  /* Per-set, so a failure in the first set cannot suppress the second set's
     report. See the header: the accumulated counter did exactly that. */
  let setFailed = 0
  let files
  try {
    files = (await readdir(resolve(REPO, set))).filter((f) => f.endsWith('.sql')).sort()
  } catch {
    console.error(`✖ ${set} — cannot be read`)
    failed += 1
    continue
  }

  /* THE ANTI-VACUOUS GUARD, FIRST AND BEFORE ANY VERDICT. Every statement
     below is drawn from `files`; over an empty list each of them is true and
     none of them is about anything. A collision cannot be found among zero
     files, so a green run here would be a report on a directory that is not
     there rather than on a directory that is clean. Both sets are REQUIRED to
     be non-empty: each is a live forward-only sequence under G193, and neither
     has been empty since 9 Aug 2026. */
  if (files.length === 0) {
    console.error(
      `✖ ${set} — NO MIGRATIONS FOUND, so every check below would be vacuous.\n` +
        '    A collision cannot be found among zero files, and a tick over an empty ' +
        'directory\n    is indistinguishable from a tick over a clean one. Fix the ' +
        'derivation — the\n    directory, the `.sql` filter or the path — and do not delete ' +
        'the assertion.',
    )
    failed += 1
    continue
  }

  const byNumber = new Map()
  const malformed = []

  for (const f of files) {
    const m = NAME.exec(f)
    if (m === null) {
      malformed.push(f)
      continue
    }
    const n = m[1]
    if (!byNumber.has(n)) byNumber.set(n, [])
    byNumber.get(n).push(f)
  }

  for (const f of malformed) {
    console.error(
      `✖ ${set}/${f} — not \`NNNN_lower_snake.sql\`, so its position in ` +
        '`readdir().sort()` is undefined. A migration with an undefined order ' +
        'is the same defect as a collided number.',
    )
    failed += 1
    setFailed += 1
  }

  for (const [n, group] of [...byNumber].sort()) {
    if (group.length > 1) {
      console.error(
        `✖ ${set} — ${group.length} migrations spend the number ${n}:\n` +
          group.map((f) => `      ${f}`).join('\n') +
          '\n    `db/migrate.ts` orders by `readdir().sort()` and keys the ledger ' +
          'on the FILENAME, so BOTH would apply, in alphabetical order — an order ' +
          'nobody chose. G88 makes migrations forward-only, so that order is not ' +
          'something a later commit can correct. Renumber one.',
      )
      failed += 1
      setFailed += 1
    }
  }

  /**
   * ⚠️ A GAP IS REPORTED AND DOES NOT FAIL, AND THE ASYMMETRY IS THE POINT. A
   * collision makes the order AMBIGUOUS, which is a defect. A gap — 0007 then
   * 0009 — leaves the order TOTAL, and it is the honest trace of a migration
   * that was written and withdrawn. Failing on one would pressure somebody to
   * renumber an APPLIED migration, and `public.schema_migration` is keyed on
   * the filename: renaming an applied file makes it apply a second time.
   */
  const nums = [...byNumber.keys()].map(Number).sort((a, b) => a - b)
  const gaps = nums.filter((n, i) => i > 0 && n !== nums[i - 1] + 1)
  if (gaps.length > 0) {
    console.log(`ℹ ${set} — gap before ${gaps.join(', ')} (reported, not a failure)`)
  }

  if (setFailed === 0) {
    console.log(`✔ ${set} — ${files.length} migrations, ${byNumber.size} distinct numbers`)
  }
}

if (failed > 0) {
  console.error(
    `\n${failed} problem(s). A collided migration number RESOLVES — both files ` +
      'exist, both parse, both apply — so no other checker here can see it, and ' +
      '`git merge` produces both with no conflict.',
  )
  process.exit(1)
}
