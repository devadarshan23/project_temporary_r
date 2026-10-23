/**
 * G3193 — THE OWNER'S RULING OF 2 Oct 2026, HELD IN THE SOURCE:
 *
 *   "Hide refused items: controls refused by a ruling (G230 passkey, G265
 *    emailed sign-in link, and any other control whose absence is a RULING
 *    rather than unbuilt work) are omitted; only genuinely-planned unbuilt
 *    items show 'Coming soon'."
 *
 * G3091 made every unbuilt control a quiet `<Soon>` with the one tooltip
 * `Coming soon`. Applied to `/signin` (G3192) that tooltip promised two ways in
 * that rulings REFUSE — the passkey (G230) and the emailed link (G265) — and on
 * Setup a hatch still offered R16's email and SAP (G2442). G3193 is the answer:
 * a refusal is OMITTED, and `Coming soon` is reserved for work that is planned.
 *
 * ┌─ WHAT THIS ASSERTS ────────────────────────────────────────────────────────┐
 * │ §1 · every refused capability below is cited to a `docs/HANDOFF.md` row    │
 * │      that STILL says it is refused — so a ruling reversed upstream turns    │
 * │      this suite red rather than leaving it guarding a dead refusal;        │
 * │ §2 · no `<Soon>` anywhere in the two bundles names a refused capability;   │
 * │ §3 · the two surfaces that used to draw them — `/signin` and Setup — name  │
 * │      none of their refused capabilities in code at all (comments are where │
 * │      the rationale lives, and are excluded);                               │
 * │ §4 · ANTI-VACUITY: the scan sees the `<Soon>`s that exist, and the matcher │
 * │      flags the exact markup that stood before this ruling.                 │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE LIST IS TYPED, NOT DERIVED. `docs/HANDOFF.md` has no machine-readable
 * "refused" column, and inferring one from prose would be §5.1 — a rule keyed
 * on a word. A new refusal by ruling is added HERE, with its row, by the commit
 * that takes it.
 *
 * ⚠️ WHAT IT CANNOT SEE, NAMED: a `<Soon>` whose text is computed at run time
 * (`Shell.tsx`'s intake lanes render `{LANE_WORD[lane.channel]}`, which is a
 * label for a lane a tenant HAS configured, not an offer) and a refused option
 * spelled in words none of the patterns match. The rendered half is
 * `tests/e2e/browser-login.test.ts` §26a.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { REPO } from '../design/render.ts'

interface Refused {
  /** What a person would be offered. */
  readonly capability: string
  /** The ruling that refuses it. */
  readonly row: string
  /** A phrase that row carries, so a reversal upstream is a red here. */
  readonly rowSays: string
  /** How a control offering it would read. */
  readonly pattern: RegExp
  /** The surfaces whose code may not name it at all (§3). */
  readonly surfaces: readonly string[]
}

const SIGN_IN = 'components/SignIn.tsx'
const SETUP = 'components/Setup.tsx'

const REFUSED: readonly Refused[] = [
  {
    capability: 'a passkey',
    row: 'G230',
    rowSays: 'PASSKEYS ARE NOT IN v1',
    pattern: /\bpass-?keys?\b/i,
    surfaces: [SIGN_IN],
  },
  {
    capability: 'an emailed sign-in link',
    row: 'G265',
    rowSays: 'THE ONE-USE EMAILED SIGN-IN LINK IS DROPPED',
    pattern: /\bsign-?in\s+link\b|\bmagic\s+link\b|\bemail\s+me\b/i,
    surfaces: [SIGN_IN],
  },
  {
    capability: 'a second factor',
    row: 'G223',
    rowSays: 'NO SECOND FACTOR IN v1',
    pattern: /\bsecond\s+factor\b|\btwo-factor\b|\b2FA\b|\bMFA\b/i,
    surfaces: [SIGN_IN],
  },
  {
    capability: 'a password sign-in',
    row: 'G250',
    rowSays: '`signInWithPassword` IS NOT DECLARED AND IS NOT OWED',
    pattern: /\bpassword\b/i,
    surfaces: [SIGN_IN],
  },
  {
    capability: 'an SAP source',
    row: 'G2442',
    rowSays: 'SAP is oData, and read-only',
    pattern: /\bSAP\b|\boData\b/,
    surfaces: [SETUP],
  },
  {
    capability: 'an email source',
    row: 'G2442',
    rowSays: 'Email is forwarded, not read',
    pattern: /\bemail\s*·|·\s*email\b|\bforwarded\b|\bby\s+email\b/i,
    surfaces: [SETUP],
  },
  {
    capability: 'a legal hold',
    row: 'G2442',
    rowSays: 'Legal hold, and only that',
    pattern: /\blegal\s+hold\b/i,
    surfaces: [],
  },
  {
    capability: 'waiving four eyes',
    row: 'G2442',
    rowSays: 'Waived knowingly',
    pattern: /\bwaive|\bone-person\s+finance\b/i,
    surfaces: [],
  },
]

const HANDOFF = readFileSync(join(REPO, 'docs', 'HANDOFF.md'), 'utf8')

function rowOf(g: string): string | null {
  const line = HANDOFF.split('\n').find((l) => l.startsWith(`| ${g} |`))
  return line ?? null
}

/** Code with every comment form removed — JSX comments first, then block, then line. */
function codeOf(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
}

const ROOTS = [join(REPO, 'frontend', 'src'), join(REPO, 'frontend', 'site', 'src')]

function tsxUnder(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...tsxUnder(path))
    else if (name.endsWith('.tsx')) out.push(path)
  }
  return out
}

/** Every `<Soon …>…</Soon>`, as the words a person would read: `label`, then text. */
export function soonsIn(source: string): string[] {
  const words: string[] = []
  for (const m of codeOf(source).matchAll(/<Soon\b([^>]*)>([\s\S]*?)<\/Soon>/g)) {
    const attrs = m[1] ?? ''
    const label = /\blabel="([^"]*)"/.exec(attrs)?.[1] ?? ''
    const text = (m[2] ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    words.push(`${label} ${text}`.trim())
  }
  return words
}

function offenders(words: readonly string[]): string[] {
  const found: string[] = []
  for (const w of words) {
    for (const r of REFUSED) if (r.pattern.test(w)) found.push(`"${w}" offers ${r.capability} (${r.row})`)
  }
  return found
}

describe('G3193 · a control refused by a ruling is omitted, never "Coming soon"', () => {
  it('§1 · every refused capability is cited to a HANDOFF row that still refuses it', () => {
    for (const r of REFUSED) {
      const row = rowOf(r.row)
      assert.ok(row !== null, `${r.row} is not a row in docs/HANDOFF.md — the citation for ${r.capability} is dead`)
      assert.ok(
        row.includes(r.rowSays),
        `${r.row} no longer says "${r.rowSays}". If the ruling refusing ${r.capability} was reversed, ` +
          'this entry goes, and the control may come back as planned work.',
      )
    }
    const g3193 = rowOf('G3193')
    assert.ok(g3193 !== null && /THE OWNER'S RULING/.test(g3193), 'G3193 is not recorded as the owner\'s ruling')
  })

  it('§2 · no `<Soon>` in either bundle names a refused capability', () => {
    const found: string[] = []
    for (const root of ROOTS) {
      for (const file of tsxUnder(root)) {
        for (const o of offenders(soonsIn(readFileSync(file, 'utf8')))) found.push(`${relative(REPO, file)}: ${o}`)
      }
    }
    assert.deepEqual(found, [], 'a refused capability is drawn as "Coming soon" — G3193 omits it')
  })

  it('§3 · /signin and Setup name none of their refused capabilities in code', () => {
    const found: string[] = []
    for (const r of REFUSED) {
      for (const rel of r.surfaces) {
        const code = codeOf(readFileSync(join(REPO, 'frontend', 'src', rel), 'utf8'))
          /* Setup's credential input is `type="password"` — a SECRET for a
             source, not a sign-in method — and is the one structural use. */
          .replace(/type="password"|autoComplete="new-password"/g, '')
        const m = r.pattern.exec(code)
        if (m !== null) found.push(`${rel} names ${r.capability} ("${m[0]}", ${r.row})`)
      }
    }
    assert.deepEqual(found, [], 'a surface still offers a capability a ruling refuses')
  })

  it('§4 · ANTI-VACUITY — the scan sees the Soons that exist, and flags the markup that stood before', () => {
    const all = ROOTS.flatMap((root) => tsxUnder(root).flatMap((f) => soonsIn(readFileSync(f, 'utf8'))))
    assert.ok(all.length >= 20, `only ${all.length} <Soon> controls were seen — the scan went blind`)
    assert.ok(all.includes('Whose documents'), 'Setup\'s planned "Whose documents" is not seen as a <Soon>')
    /* The exact markup `SignIn.tsx` carried under G3192, and Setup's G2442 label. */
    const before = soonsIn(
      '<Soon className="btn">Use a passkey</Soon>\n' +
        '<Soon className="btn">\n  Email me a sign-in link<span className="k">one use · 15 min</span>\n</Soon>\n' +
        '<Soon className="text-label">Email · SAP</Soon>',
    )
    assert.deepEqual(before, ['Use a passkey', 'Email me a sign-in link one use · 15 min', 'Email · SAP'])
    assert.equal(offenders(before).length, 4, 'the matcher misses markup this ruling removed')
    assert.deepEqual(offenders(['Whose documents', 'Install a blueprint', 'Coming soon']), [],
      'the matcher flags planned work as refused')
  })
})
