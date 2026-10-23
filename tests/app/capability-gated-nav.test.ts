/**
 * CAPABILITY-GATED DRAWING — G3522, 3 Oct 2026 (DERIVED, NOT THE OWNER'S).
 * C9 row #22 (*"Setup exists in the nav for an admin only"*) and G3193 (a
 * refused control is HIDDEN, not drawn and then refused).
 *
 *   §1  `holds()` — unread is NOT held; a list without the verb is not held.
 *   §2  every `DRAW_GATES` value is a member of the closed capability set, so a
 *       gate cannot be keyed on a verb the plane will never report.
 *   §3  each gated control's own source carries its gate, keyed on the
 *       control's data attribute — a control that lost its gate is a red here
 *       rather than a 403 a person meets. ⚠️ A SOURCE SCAN, NOT A RENDER: it
 *       proves the gate is WRITTEN beside the control; the browser witness for
 *       Setup is `tests/e2e/browser-login.test.ts` §25a/§25a2.
 *
 * WITNESSED RED: §3 with ChromeBar's `{mayConfigure ? (` guard removed —
 * *"ChromeBar.tsx draws `data-setup-door` without its gate"* — and §1 with
 * `holds()` returning `true` for a `null` list.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { CAPABILITIES } from '../../model/access.ts'
import { DRAW_GATES, holds } from '../../frontend/src/capabilities.ts'
import { REPO } from '../design/render.ts'

const src = (rel: string): string => readFileSync(join(REPO, 'frontend', 'src', rel), 'utf8')

describe('capability-gated drawing', () => {
  it('§1 · unread is not held, and an absent verb is not held', () => {
    assert.equal(holds(null, DRAW_GATES.setup), false, 'an unread principal must draw no gated control')
    assert.equal(holds([], DRAW_GATES.setup), false)
    assert.equal(holds(['view_exception'], DRAW_GATES.setup), false, 'a persona lacking configure_endpoint sees no Setup')
    assert.equal(holds(['view_exception', 'configure_endpoint'], DRAW_GATES.setup), true)
  })

  it('§2 · every gate names a member of the closed capability set', () => {
    const members = new Set<string>(Object.values(CAPABILITIES))
    for (const [name, verb] of Object.entries(DRAW_GATES)) {
      assert.ok(members.has(verb), `DRAW_GATES.${name} names \`${verb}\`, which is not a capability`)
    }
  })

  /** [file, the control's marker, the guard that must precede it] */
  const SITES: ReadonlyArray<readonly [string, string, string]> = [
    ['components/ChromeBar.tsx', 'data-setup-door', '{mayConfigure ? ('],
    ['components/Register.tsx', 'label="New reconciliation"', '|| !mayAuthor ? null : ('],
    ['components/StaffConsole.tsx', 'data-mark-done', '{mayAct && '],
    ['components/StaffConsole.tsx', 'data-force={', '{mayAct && '],
    ['components/PartnerPortal.tsx', 'data-register-open', '{mayRegister ? ('],
    ['components/PartnerPortal.tsx', 'data-sandbox-ask', '{mayOperate ? ('],
    ['components/PartnerPortal.tsx', 'data-invite-open', '{mayManage ? ('],
    /* C3-08 (the owner's, 4 Oct 2026) — Approvals is a chrome destination for
       holders of approve_resolution; it replaced the queue under the register. */
    ['main.tsx', 'data-dest="approvals"', 'mayApprove'],
    ['components/ChromeBar.tsx', 'data-approvals-dest', '{approvalsDrawn ? ('],
  ]

  it('§3 · each gated control is drawn under its own gate', () => {
    for (const [file, marker, guard] of SITES) {
      const text = src(file)
      const at = text.indexOf(marker)
      assert.ok(at !== -1, `${file} no longer draws \`${marker}\` — update this census`)
      /* The guard must open within the few lines before the control. */
      const window = text.slice(Math.max(0, at - 600), at)
      assert.ok(window.includes(guard), `${file} draws \`${marker}\` without its gate (\`${guard}\`)`)
    }
  })
})
