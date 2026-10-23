import { useState } from 'react'

import { Drawer } from './Drawer.tsx'
import { Modal } from './Modal.tsx'
import { RefusedControl, Tooltip } from './Tooltip.tsx'
import { ToastRegion, useToasts } from './Toast.tsx'
import { reasonText } from './reason.ts'

/**
 * THE FOUR PRIMITIVES, LIVE — the surface `tests/design/overlays.test.ts` drives.
 *
 * 🛑 THIS PAGE IS SCRIPTED AND `Specimen.tsx` IS NOT, AND THE DIFFERENCE IS THE
 * WHOLE REASON IT IS A SEPARATE FILE. `frontend/dist/specimen.html` is
 * pre-rendered static markup because Chromium blocks `<script type="module">` on
 * a `file://` origin, and every primitive on that page can be seen AT REST — a
 * hatch, a meter, a light. Not one of the four primitives here has a meaningful
 * rest state: a drawer that never opens, a modal that never traps and a tooltip
 * that never receives Escape are exactly the four behaviours G247 says are
 * "impossible to notice differing". Asserting them against static markup would
 * be the §5.6 defect — a test that passes while witnessing nothing.
 *
 * So the assertions bundle THIS component to a classic IIFE and load it with the
 * SHIPPED stylesheet attached. Both halves of "what is asserted is what ships"
 * hold: the JavaScript is compiled from these very source files, and the CSS is
 * the exact bytes Vite emitted for the app, located through its own manifest —
 * the same route `prerender.tsx` takes, for the same reason.
 *
 * ⚠️ EVERY FIGURE AND EVERY NAME HERE IS ILLUSTRATIVE. PRODUCT.md governs: no
 * customer, no result, no price. The amounts below are chosen to be legible, not
 * to be true.
 */
export function OverlaySpecimen() {
  const [drawer, setDrawer] = useState(false)
  const [modal, setModal] = useState(false)
  const [outcome, setOutcome] = useState<string | null>(null)
  const toasts = useToasts()

  return (
    <>
      <main id="specimen" className="p-6 flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-title">The four overlay primitives</h1>
          <p className="text-label text-muted">
            One implementation of each behaviour, four surfaces over it. Figures
            are illustrative.
          </p>
        </header>

        {/* ── THE REGISTER THE DRAWER OPENS OVER ────────────────────────────
            🛑 THIS TABLE IS NOT DECORATION. The drawer's central claim is that it
            opens OVER the register and never away from it, and §1 of the
            assertions reads this table's column set before and while the drawer
            is open and requires them identical. A register that reflowed would
            still LOOK right in a screenshot, which is why it is measured. */}
        <section className="flex flex-col gap-2">
          <h2 className="text-label text-muted">The register</h2>
          <table id="register">
            <thead>
              <tr><th>Run</th><th>Definition</th><th>Status</th><th className="num">Value</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>run_0311</td><td>close.monthly v4</td><td>incomplete</td>
                <td className="num">273,254</td>
              </tr>
              <tr>
                <td>run_0310</td><td>close.monthly v4</td><td>complete</td>
                <td className="num">18,900</td>
              </tr>
            </tbody>
          </table>
          <div className="flex gap-2">
            <button id="open-drawer" className="btn btn--small" type="button"
              onClick={() => { setDrawer(true) }}>
              Ask about run_0311
            </button>
            <button id="open-modal" className="btn btn--small" type="button"
              onClick={() => { setModal(true) }}>
              Reject three proposals
            </button>
          </div>
        </section>

        {/* ── 3 · THE TOOLTIP ───────────────────────────────────────────────
            TWO TRIGGERS, AND THEY ARE DIFFERENT CASES ON PURPOSE. The first is
            INFORMATIONAL — a denominator, a period, an as-at date on a figure
            that is not refused. The second is EXPLANATORY: a refused control,
            which is G189's own case and the one where dropping the beside-text
            would apply the opposite of both positions at once. */}
        <section className="flex flex-col gap-2">
          <h2 className="text-label text-muted">The tooltip</h2>
          <p className="text-label">
            The token meter reads{' '}
            <Tooltip
              control={(t) => (
                <button id="tip-figure" className="btn btn--small mono" type="button" {...t}>
                  418K
                </button>
              )}
            >
              <b>418K of 2.0M tokens</b>
              <span className="sub">plan period 1&ndash;31 MAR 2026 &middot; as at 09:14 today</span>
            </Tooltip>{' '}
            this period.
          </p>

          <RefusedControl
            beside="Segregation of duties — you prepared this finding."
            detail={
              <>
                <b>You prepared this finding at 08:41.</b>
                <span className="sub">
                  The preparer is not the reviewer. Ask a second reviewer, or reassign.
                </span>
              </>
            }
          >
            Approve this finding
          </RefusedControl>
        </section>

        {/* ── 4 · THE TOAST ─────────────────────────────────────────────────
            🛑 THE BELL IS NOT THIS, and the bell is not on this page: it lives in
            `ChromeBar.tsx` as control 5 and shares no content with anything here.
            R5 — the six indicators stay six. */}
        <section className="flex flex-col gap-2">
          <h2 className="text-label text-muted">The toast</h2>
          <div className="flex gap-2">
            <button id="toast-ok" className="btn btn--small" type="button"
              onClick={() => { toasts.raise({
                id: 'ok-' + String(toasts.toasts.length),
                kind: 'ok',
                title: 'Posted · document 4900012241',
                body: 'Three lines · cleared from suspense.',
              }) }}>
              Raise a success
            </button>
            <button id="toast-fail" className="btn btn--small" type="button"
              onClick={() => { toasts.raise({
                id: 'fail-' + String(toasts.toasts.length),
                kind: 'fail',
                title: 'Not posted — the ERP was unreachable',
                body: 'Nothing was written. The three lines are unchanged and still in suspense.',
              }) }}>
              Raise a failure
            </button>
          </div>
          <p className="text-label text-muted" id="outcome">{outcome ?? 'no act taken'}</p>
        </section>
      </main>

      <Drawer
        open={drawer}
        onDismiss={() => { setDrawer(false) }}
        title="Ask about run_0311"
        footer={<button className="btn btn--small" type="button"
          onClick={() => { setDrawer(false) }}>Close</button>}
      >
        <p>
          The register is still behind this, with its columns unchanged. Evidence
          sits beside the decision.
        </p>
        <label className="field-l" htmlFor="ask">Your question</label>
        <textarea className="field-i" id="ask" defaultValue="" />
      </Drawer>

      <Modal
        open={modal}
        onDismiss={() => { setModal(false) }}
        title="Reject three proposals?"
        verb="Reject"
        hint="Cited on every future proposal of this shape. It is what an SOP amendment would be drafted from."
        onConfirm={(reason) => {
          setModal(false)
          setOutcome('rejected — ' + reasonText(reason))
          toasts.raise({
            id: 'rej-' + String(toasts.toasts.length),
            kind: 'undo',
            title: 'Rejected three proposals',
            body: 'Your reason is cited on every future proposal of this shape.',
            action: { label: 'Undo', run: () => { setOutcome('reversal recorded') } },
          })
        }}
      >
        <p>Three proposals stay in suspense. Nothing is written to the ERP.</p>
      </Modal>

      <ToastRegion store={toasts} />
    </>
  )
}
