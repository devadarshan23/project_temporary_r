/**
 * EVERY `.mjs` IN `tools/` MUST PARSE, AND UNTIL 18 Aug 2026 ONE OF THEM DID NOT.
 *
 * 🛑 THE DEFECT THIS EXISTS FOR, NAMED RATHER THAN DESCRIBED.
 * `tools/planner/serve.mjs` — the planning companion's server, the one
 * `tools/planner/README.md` step 2 tells a reader to run — could not be loaded
 * by node at all from `3e594da0` (12 Aug 2026) to 18 Aug 2026. Six days.
 *
 * The commit that broke it was improving a message. It added markdown-style
 * backticks for emphasis INSIDE a template literal:
 *
 *     -  GET  /model-graph.json   (run tools/planner/extract.mjs to produce it)
 *     +  GET  /model-graph.json   (run `node tools/planner/extract.mjs --write` to produce it)
 *
 * The first backtick closed the template opened eleven lines above, and `node`
 * became a bare identifier. Twice, in two different messages.
 *
 * ⚠️ WHY NOTHING CAUGHT IT, WHICH IS THE WHOLE POINT OF THIS FILE.
 * `npm run check` type-checks `model/` and `tests/` and runs six checkers. It
 * never IMPORTS `serve.mjs`, and nothing else does either — the server is
 * started by a person, by hand, from a README. A file no test loads is a file
 * whose syntax nobody checks, and `tsc` cannot see it because it is `.mjs`.
 *
 * This is the same shape as the extensionless-value-import defect CLAUDE.md
 * records: three of sixteen `model/` modules could not be LOADED while `tsc`
 * stayed green throughout, because `import type` is erased before the loader
 * sees it. Green type-checking is not evidence that a file runs.
 *
 * 🛑 THE COUNT IS ASSERTED NON-ZERO. A parse check over an empty file list is
 * a control that passes while asserting nothing (§5.6) — and this test walks a
 * directory, so a bad glob would silently make it vacuous rather than red.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readdir } from 'node:fs/promises'
import { join, resolve, relative } from 'node:path'

const execFileP = promisify(execFile)

/** Repository root, derived from this file rather than from cwd. */
const REPO = resolve(import.meta.dirname, '..', '..')
const TOOLS = join(REPO, 'tools')

/** Every `.mjs` under `tools/`, at any depth. */
async function toolModules(dir) {
  const found = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...(await toolModules(full)))
    else if (entry.name.endsWith('.mjs')) found.push(full)
  }
  return found.sort()
}

test('every .mjs in tools/ parses — a file no test imports is a file nobody syntax-checks', async () => {
  const files = await toolModules(TOOLS)

  /* The vacuity guard. If the walk returns nothing the assertions below all
     hold trivially, so the count is the first thing asserted and it is
     REPORTED, not merely checked. */
  assert.ok(
    files.length > 0,
    `no .mjs files were found under ${relative(REPO, TOOLS)}/ — this test walked the ` +
      'tree and came back empty, which makes every assertion below vacuous. Fix the ' +
      'walk; do not delete the assertion.',
  )

  const broken = []
  for (const file of files) {
    try {
      await execFileP(process.execPath, ['--check', file])
    } catch (err) {
      const detail = String(err?.stderr ?? err?.message ?? err).split('\n').slice(0, 4).join('\n')
      broken.push(`${relative(REPO, file)}\n${detail}`)
    }
  }

  assert.deepEqual(
    broken,
    [],
    `${broken.length} of ${files.length} module(s) under tools/ do not PARSE. ` +
      'Nothing else in `npm run check` loads these files — `tsc` does not read .mjs and no ' +
      'test imports them — so a syntax error here ships silently and the tool simply fails ' +
      'the next time a person runs it by hand. `tools/planner/serve.mjs` spent six days in ' +
      `exactly this state.\n\n${broken.join('\n\n')}`,
  )

  /* Reported, in the shape the design suites use, so a reader of the gate
     output can see the control had a corpus rather than trusting that it did. */
  console.log(`    tools parse: ${files.length} of ${files.length} .mjs module(s) load`)
})
