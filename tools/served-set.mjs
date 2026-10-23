#!/usr/bin/env node
/**
 * served-set — G2083. The served set, DERIVED. A reporter, not a checker: it
 * prints and it cannot fail anything, and it is not in `npm run check`.
 *
 * WHY THIS EXISTS. Four documents handed out `grep -rn 'handlers:' server/…`
 * as the derivation of *"N of 136 operations served"*, and on 23 Sep 2026 a
 * circulated summary ran it and reported **29 of 137**. The truth was **30 of
 * 136**. The command was wrong twice over and each failure needs its own
 * sentence, because only one of them is the self-measuring class:
 *
 *   1 · IT COUNTED ITS OWN EXPLANATION. One of the eight lines it returned was
 *       a block COMMENT in `server/data-plane/start.ts` quoting the command
 *       with its middle glob DROPPED — because a star followed by a slash ends
 *       a block comment, so the glob could not be written there — and that
 *       avoidance is exactly what left the quotation inside the command's own
 *       scope. G978's shape; G2081's gate.
 *
 *       ⚠️ THE SAME TRAP CLOSED THIS HEADER ON ITS FIRST RUN. The paragraph
 *       above originally SPELLED the two characters and the file would not
 *       parse — `SyntaxError: Unexpected identifier 'handlers'`. The repair is
 *       the one this slice is about: describe the token, do not spell it
 *       inside the scope that reads it.
 *
 *   2 · IT WAS NEVER A DERIVATION OF THE NUMBER IT WAS HANDED OUT FOR, and
 *       this is the half no document had noticed. `handlers:` occurs ONCE PER
 *       TIER MOUNT, not once per operation. Comment-stripped it answers SEVEN,
 *       and seven is the number of tier mounts. **Nobody could ever have
 *       reached 30 from it.** The figures in circulation — 23, 25, 26, 29 —
 *       were arrived at by reading the blocks and counting keys by eye, which
 *       is why no two documents agreed.
 *
 * WHAT THE DERIVATION ACTUALLY NEEDS, AND WHY IT IS NOT A `grep`. Three things,
 * none of which a line scanner can do:
 *
 *   · THE DENOMINATOR MUST BE PARSED. `grep -c 'operationId:'` over the
 *     contract corpus answers 137 because one of the matches is prose quoting
 *     that command. This reads the YAML.
 *   · COMMENTS MUST BE STRIPPED. `server/` headers mention operation names
 *     constantly. The stripper is `tools/check-clock-fixtures.mjs`'s, imported
 *     rather than copied — a second implementation of one rule is §5.3, and the
 *     one that drifts is always the copy.
 *   · ES6 SHORTHAND MUST BE READ. `handlers: { checkLocalHealth }` carries NO
 *     COLON. A key-and-colon scan misses it and answers 29; the loose scan that
 *     appeared to answer 30 did so by ALSO matching the TYPE ANNOTATION on
 *     `const checkLocalHealth: Handler`, one false positive cancelling one
 *     false negative. Both were wrong and their sum looked right.
 *
 * ⚠️ WHAT THIS CANNOT SEE — a landmark, not the property. The property is *this
 * operationId is reachable over HTTP*. What is measured is *this operationId
 * appears as an object key in a comment-stripped `start.ts`*. A key inside some
 * other object literal in those two files would count, and a handler reached
 * through a variable or a spread would not. The two files are small, flat and
 * read end to end by every mount review; the day that stops being true this
 * wants `tsc`'s AST rather than a wider regex.
 *
 *   node tools/served-set.mjs
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import { stripComments } from './check-clock-fixtures.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONTRACTS = join(ROOT, 'docs', 'contracts')
const START_FILES = ['server/control-plane/start.ts', 'server/data-plane/start.ts']

/** Every `operationId` declared across the contract tiers. Parsed, never grepped. */
export function declaredOperations(root = ROOT) {
  const dir = join(root, 'docs', 'contracts')
  const ids = new Map()
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.openapi.yaml')).sort()) {
    const doc = YAML.parse(readFileSync(join(dir, file), 'utf8'))
    for (const [path, item] of Object.entries(doc?.paths ?? {}))
      for (const [method, op] of Object.entries(item ?? {}))
        if (op && typeof op === 'object' && op.operationId)
          ids.set(op.operationId, { file, path, method })
  }
  return ids
}

/** Every declared operation that is mounted as a handler key. */
export function mountedOperations(root = ROOT, declared = declaredOperations(root)) {
  const source = START_FILES.map((f) => stripComments(readFileSync(join(root, f), 'utf8'))).join('\n')
  const mounted = new Set()
  for (const id of declared.keys()) {
    // a key followed by a colon, OR ES6 shorthand closed by a comma or a brace
    if (new RegExp('(?:^|[{,])\\s*' + id + '\\s*(?::|[,}])', 'm').test(source)) mounted.add(id)
  }
  return mounted
}

function main() {
  const declared = declaredOperations()
  const mounted = mountedOperations(ROOT, declared)

  if (declared.size === 0) {
    console.error('✘ REFUSING A ZERO SUBJECT — no operationId parsed from docs/contracts/.')
    process.exit(1)
  }

  const byTier = new Map()
  for (const id of mounted) {
    const t = declared.get(id).file.replace('.openapi.yaml', '')
    byTier.set(t, [...(byTier.get(t) ?? []), id])
  }
  for (const tier of [...byTier.keys()].sort())
    console.log(`  ${tier.padEnd(22)} ${byTier.get(tier).sort().join(' ')}`)

  console.log(`\nserved set: ${mounted.size} of ${declared.size} declared operations mounted.`)
}

if (process.argv[1] && process.argv[1].endsWith('served-set.mjs')) main()
