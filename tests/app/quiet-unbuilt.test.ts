/**
 * G3091 — THE OWNER'S RULING OF 2 Oct 2026, HELD IN THE SOURCE:
 *
 *   "Pack-faithful, quiet: draw exactly as the pack, visibly disabled (muted,
 *    no hatch, no G-numbers); a small tooltip says 'Coming soon'. Engineering
 *    rationale stays in docs/tests, never on screen."
 *
 * The RENDERED half — every `[data-soon]` on the built page is aria-disabled,
 * href-less, muted and carries the tooltip; no `.nb` and no G row reach the
 * screen — is `tests/design/shell.test.ts` §7, and the CLICKED half is
 * `tests/e2e/browser-login.test.ts` §27. This file is the half that needs no
 * browser, so it runs on every machine: the product surfaces the ruling names
 * may not import the hatch, may not pass a G row to anything, and may not spell
 * one in a string or in JSX text.
 *
 * ⚠️ COMMENTS ARE EXCLUDED AND HAVE TO BE. Every one of these files records its
 * own history in G rows — that is where the rationale was ruled to live — and a
 * rule that counted prose would be red against the documentation of the rule.
 *
 * ⚠️ SCOPE, STATED RATHER THAN IMPLIED: the chrome, the Close screen and its two
 * drill-downs (the finding and the run's account) — and, since G3261 (2 Oct
 * 2026, applying the owner's G3193), `SignIn.tsx` and `Setup.tsx`. THE
 * SENTENCE THAT STOOD HERE READ: *"`SignIn.tsx` and `Setup.tsx` still draw
 * hatches that their own suites assert by G row (§26a, §25f); they are product
 * surfaces too and are NOT yet converted"*. G3192 and G3194 took their hatches
 * on the 403 and the card; G3193 omitted their refused controls and turned
 * Setup's last three hatches into `<Soon>`s, so both join the list.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { REPO } from '../design/render.ts'

const SRC = join(REPO, 'frontend', 'src')
const QUIET = [
  'Shell.tsx',
  'components/ChromeBar.tsx',
  'components/Register.tsx',
  'components/ExceptionRegister.tsx',
  'components/Finding.tsx',
  'components/RunAccount.tsx',
  'components/Resolve.tsx',
  'components/Approvals.tsx',
  'components/Quiet.tsx',
  'components/Trail.tsx',
  'routes/screens.ts',
  'components/SignIn.tsx',
  'components/Setup.tsx',
  'components/PartnerPortal.tsx',
  'components/StaffConsole.tsx',
  /* C9 rows 18/19 — the parked pile (feat/ui-parked-pile, G3501). */
  'components/ParkedPile.tsx',
] as const

function codeOf(rel: string): string {
  return readFileSync(join(SRC, rel), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
}

describe('G3091 · the product surfaces are quiet, in the source', () => {
  it('no product surface imports the hatch or names a refusing G row', () => {
    const offenders: string[] = []
    for (const rel of QUIET) {
      const code = codeOf(rel)
      if (/from '\.{1,2}\/(?:components\/)?NotBuilt\.tsx'/.test(code)) offenders.push(`${rel} imports NotBuilt`)
      if (/\brefusedBy\b/.test(code)) offenders.push(`${rel} passes refusedBy`)
      for (const m of code.matchAll(/\bG\d{2,4}\b/g)) offenders.push(`${rel} spells ${m[0]} in code`)
      if (/[Rr]ow-level security/.test(code)) offenders.push(`${rel} explains row-level security on screen`)
    }
    assert.deepEqual(offenders, [],
      `a product surface still carries the hatch or engineering rationale: ${JSON.stringify(offenders)}. ` +
      '"Engineering rationale stays in docs/tests, never on screen."')
  })

  it('POSITIVE CONTROL — the probe sees a G row and a NotBuilt import when they are there', () => {
    /* Without this, a `codeOf()` that stripped everything would pass the
       assertion above over nothing. The specimen still imports the hatch on
       purpose — it is where its survival is measured. */
    const specimen = readFileSync(join(SRC, 'Specimen.tsx'), 'utf8')
    assert.match(specimen, /NotBuilt/, 'the specimen no longer carries the hatch, so this control is vacuous')
    assert.match('refusedBy="G200"', /\bG\d{2,4}\b/)
  })

  it('`<Soon>` takes no reason and no G row, and renders aria-disabled with no href', () => {
    const soon = codeOf('components/Soon.tsx')
    const props = /export interface SoonProps \{([\s\S]*?)\n\}/.exec(soon)?.[1] ?? ''
    assert.ok(props.length > 0, 'SoonProps was not found — the probe is inert')
    assert.doesNotMatch(props, /\b(?:why|refusedBy|reason)\b/,
      'Soon grew a reason prop — a reason on the component is a reason on the screen')
    assert.equal((soon.match(/aria-disabled="true"/g) ?? []).length, 2,
      'both of Soon\'s elements (the button and the nav link) must be aria-disabled')
    assert.doesNotMatch(soon, /\bhref=/, 'Soon renders an href, so an unbuilt control would navigate')
    assert.doesNotMatch(soon, /\sdisabled[=\s>]/, 'Soon uses the disabled attribute — G189 forbids it')
    assert.match(soon, /'Coming soon'/, 'the tooltip text is the ruling\'s own words')
  })
})
