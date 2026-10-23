/**
 * U-12 (G4136) — EVERY IN-FLIGHT CAPTION CARRIES `data-reading`, AND NOTHING
 * THAT IS NOT A LOAD DOES.
 *
 * `tests/e2e/browser-login.test.ts`'s `settled()` waited for the WORD
 * "reading" to leave the page (`!/\breading\b/i` over the body text). That
 * made "reading" a word the product could not say: G3444 and G3476 each drew
 * "running" over the pack's "reading" for that reason alone. Once `running` was
 * real (G4132) a running run's cell said the pack's word, and the helper hung —
 * witnessed: `✖ §33 … page.waitForFunction: Timeout 15000ms exceeded`.
 *
 * The helper now waits for `document.querySelector('[data-reading]') === null`,
 * which is only as good as the markup. This is the census that keeps it so:
 *
 *   · every source line rendering a caption that opens "Reading …" carries
 *     `data-reading` on it or on the element just above it, or is a named
 *     exception whose RENDER SITE carries it;
 *   · the one live sign that says "Reading" and is NOT a load (`LiveRun`) must
 *     NOT carry it — a marker there would make `settled()` wait for a run to
 *     finish, which is the hang moved rather than removed.
 *
 * ⚠️ A LINE SCANNER, NOT A PARSER. It sees a caption written as a literal; a
 *    caption assembled from parts, or moved more than sixteen lines from its
 *    element, escapes it. It is the control that would have caught every
 *    caption in the tree at `b2563cab`, and its denominator is printed and
 *    floored so it cannot pass over nothing.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '../../frontend/src')

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? files(join(dir, e.name))
      : /\.(ts|tsx)$/.test(e.name)
        ? [join(dir, e.name)]
        : [],
  )
}

const COMMENT = /^\s*(\*|\/\/|\/\*)/
const CAPTION = /['"`>]Reading\b/

/** Captions returned by a helper and rendered elsewhere: the render site is checked instead. */
const RENDERED_ELSEWHERE: Readonly<Record<string, { readonly site: string; readonly marker: string }>> = {
  'components/Register.tsx:emptyLine': {
    site: 'components/Register.tsx',
    marker: `{...(state === 'reading' ? { 'aria-busy': true, 'data-reading': '' } : {})}`,
  },
  'components/ExceptionRegister.tsx:countLine': {
    site: 'components/ExceptionRegister.tsx',
    marker: `data-count {...(props.state === 'reading' ? { 'data-reading': '' } : {})}`,
  },
}

/** Says "Reading" and is NOT a load — must carry no marker. */
const NOT_A_LOAD = new Set(['components/LiveRun.tsx'])

describe('U-12 — `settled()` reads a marker, and the marker is on every load', () => {
  const found: { file: string; line: number; text: string; marked: boolean; fn: string | null }[] = []
  for (const path of files(ROOT)) {
    const rel = path.slice(ROOT.length + 1)
    const lines = readFileSync(path, 'utf8').split('\n')
    let fn: string | null = null
    lines.forEach((text, i) => {
      const decl = /^function (\w+)\(/.exec(text)
      if (decl !== null) fn = decl[1] ?? null
      if (COMMENT.test(text) || !CAPTION.test(text)) return
      const window = lines.slice(Math.max(0, i - 16), i + 1).join('\n')
      found.push({ file: rel, line: i + 1, text: text.trim(), marked: window.includes('data-reading'), fn })
    })
  }

  it('the census has a denominator — it found the captions it exists for', () => {
    console.log(`reading-marker: ${found.length} caption line(s) opening "Reading" in frontend/src`)
    assert.ok(found.length >= 10, `only ${found.length} captions found — the scanner is reading nothing`)
  })

  it('every in-flight caption carries `data-reading`', () => {
    const unmarked = found.filter((f) => {
      if (NOT_A_LOAD.has(f.file) || f.marked) return false
      const key = `${f.file}:${f.fn ?? ''}`
      const elsewhere = RENDERED_ELSEWHERE[key]
      if (elsewhere === undefined) return true
      return !readFileSync(join(ROOT, elsewhere.site), 'utf8').includes(elsewhere.marker)
    })
    assert.deepEqual(unmarked.map((f) => `${f.file}:${f.line} ${f.text}`), [])
  })

  it('the live sign says "Reading" and is NOT marked — a run is not a load', () => {
    const live = readFileSync(join(ROOT, 'components/LiveRun.tsx'), 'utf8')
    assert.match(live, /<b>Reading now\.<\/b>/)
    assert.equal(live.includes('data-reading'), false)
  })

  it('the chrome period word marks its own reading state', () => {
    const shell = readFileSync(join(ROOT, 'Shell.tsx'), 'utf8')
    const marked = shell.match(/<b data-period=\{period\.state\} \{\.\.\.\(period\.state === 'reading' \? \{ 'data-reading': '' \} : \{\}\)\}>/g)
    assert.equal(marked?.length, 2, 'both period words (status bar and sheet) must carry the marker')
  })
})
