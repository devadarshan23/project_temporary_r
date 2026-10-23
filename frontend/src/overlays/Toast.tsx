import { useCallback, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

import { captureReturnFocus } from './behaviour.ts'
import { LEAVE_MS } from './Surface.tsx'

/**
 * THE TOAST — *"the terminal state of an asynchronous act. The bell is not
 * this"* (`design/system/index.html`).
 *
 * 🛑 THE BOUNDARY AGAINST THE NOTIFICATION BELL IS DRAWN EXPLICITLY AND IT IS AN
 * R5 MATTER, NOT A NAMING ONE. A notification is for *what happened while you
 * were looking somewhere else*; a toast is the outcome of something you just did
 * and are still watching. Building them as one surface is how a system grows a
 * seventh indicator by accident, which R5 forbids — so this file renders nothing
 * the bell renders, the bell (`ChromeBar.tsx`, control 5) renders nothing this
 * renders, and neither imports the other. `tests/design/overlays.test.ts` §6
 * asserts the two share no content rather than trusting the separation.
 *
 * 🛑 AND NO NEW INDICATOR ARRIVES WITH IT. THE SIX INDICATORS stay six: a toast
 * carries WORDS. No progress bar (a second line — the token meter has the only
 * line), no status dot (a second dot — the connection light has the only one),
 * no spinner. An in-flight toast says it is in flight.
 *
 * ┌─ 🛑 WHICH OF THE FOUR SHARED BEHAVIOURS A TOAST TAKES, AND WHY NOT THE REST ┐
 * │ RETURN FOCUS  — YES, and it is the only surface where the failure is        │
 * │   guaranteed rather than possible: dismissing a toast removes the very      │
 * │   button that was focused, so focus lands on `<body>` every time unless     │
 * │   something catches it. `captureReturnFocus()`'s detached-opener branch is  │
 * │   what catches it, and this is that branch's real call site.                │
 * │ ESCAPE — NO, DELIBERATELY. A toast is not a dismissible overlay in the      │
 * │   1.4.13 sense: it obscures nothing and it has a visible Dismiss. Wiring it │
 * │   into the shared Escape stack would be actively wrong — that stack answers │
 * │   for the TOPMOST overlay, so a toast raised while a modal is open would    │
 * │   swallow the modal's Escape. Declined with a reason rather than omitted.   │
 * │ FOCUS TRAP · SCROLL LOCK — NO. A toast blocks nothing.                      │
 * └────────────────────────────────────────────────────────────────────────────┘
 */

/**
 * 🛑 THE KIND DECIDES WHICH LIVE REGION THE TOAST IS APPENDED TO, AND NOTHING
 * CARRIES A PER-NODE `role`. A failure interrupts and everything else is polite;
 * putting `role="alert"` on the node itself would announce it only if the node
 * existed when the screen reader started watching. The two regions are
 * PERSISTENT and the toast joins one of them.
 */
export type ToastKind = 'inflight' | 'ok' | 'fail' | 'queued' | 'undo'

export interface Toast {
  readonly id: string
  readonly kind: ToastKind
  readonly title: string
  readonly body?: string
  readonly meta?: string
  /** An affordance the outcome offers — "Undo", "Replay from the queue row". */
  readonly action?: { readonly label: string; readonly run: () => void }
}

/** Which region a kind is announced through. `fail` interrupts; nothing else does. */
export function isAssertive(kind: ToastKind): boolean {
  return kind === 'fail'
}

/**
 * 🛑 ONLY A SUCCESS AUTO-DISMISSES, AND THE RULE IS STATED HERE RATHER THAN AT
 * EACH CALL SITE. *"A failure that vanished is a failure nobody saw, and an undo
 * affordance that vanishes has asserted a window"* — a window nothing in this
 * system has established. An `inflight` toast does not expire either: it is
 * replaced by its own outcome.
 */
export function autoDismisses(t: Toast): boolean {
  return t.kind === 'ok' && t.action === undefined
}

export interface ToastStore {
  readonly toasts: readonly Toast[]
  readonly raise: (t: Toast) => void
  readonly dismiss: (id: string) => void
  /** Toasts fading out after a dismissal — RMR-03. Paint only; never a live region. */
  readonly leaving?: readonly Toast[]
}

export function useToasts(): ToastStore {
  const [toasts, setToasts] = useState<readonly Toast[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  /* The toasts as last rendered, so a removal can read what it removes WITHOUT
     a side effect inside a state updater. */
  const current = useRef<readonly Toast[]>(toasts)
  current.current = toasts

  /* RMR-03 (G3479) — A LEAVING TOAST TAKES A PLAIN FADE. The toast leaves its
     live region AT ONCE — removal, focus restore and the region's contents are
     exactly as before — and an inert, `aria-hidden` copy fades for one
     `--t-fade` where it stood (`ToastRegion`'s third container). Nothing
     focusable, announced or counted survives the dismissal. */
  const [leaving, setLeaving] = useState<readonly Toast[]>([])
  const ghost = useCallback((id: string) => {
    const gone = current.current.find((t) => t.id === id)
    if (gone === undefined) return
    setLeaving((all) => [...all.filter((x) => x.id !== id), gone])
    setTimeout(() => { setLeaving((all) => all.filter((x) => x.id !== id)) }, LEAVE_MS)
  }, [])

  const dismiss = useCallback((id: string) => {
    /* 🛑 CAPTURED BEFORE THE REMOVAL, RESTORED AFTER IT. The focused element is
       the Dismiss button that is about to stop existing, so `captureReturnFocus`
       takes its detached-opener branch and lands focus on `<main>` — which is
       where a Tab can continue from. Without this, dismissing a toast by keyboard
       drops focus to `<body>` and the next Tab restarts at the top of the
       document. That is the shared implementation doing the work; this surface
       adds nothing to it.

       🛑 AND `flushSync` IS LOAD-BEARING, NOT A PERFORMANCE HINT. WITHOUT IT THIS
       FUNCTION RESTORED FOCUS TO A BUTTON THAT WAS ABOUT TO BE REMOVED, AND IT WAS
       MEASURED DOING SO. React batches state updates, so a bare `setToasts(…)`
       followed by `restore()` runs the restore while the Dismiss button is STILL
       CONNECTED: `captureReturnFocus` takes its live-opener branch, focuses the
       button, and React then unmounts it — dropping focus to `<body>`, which is
       the exact failure this code exists to prevent. The detached-opener branch
       was unreachable from here until the removal was made synchronous.
       `tests/design/overlays.test.ts` §4 caught it. */
    const restore = captureReturnFocus()
    const timer = timers.current.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    ghost(id)
    flushSync(() => {
      setToasts((all) => all.filter((t) => t.id !== id))
    })
    restore()
  }, [ghost])

  const raise = useCallback((t: Toast) => {
    setToasts((all) => [...all, t])
    if (!autoDismisses(t)) return
    timers.current.set(t.id, setTimeout(() => {
      timers.current.delete(t.id)
      ghost(t.id)
      setToasts((all) => all.filter((x) => x.id !== t.id))
    }, 6000))
  }, [ghost])

  return { toasts, raise, dismiss, leaving }
}

/**
 * THE TWO PERSISTENT REGIONS.
 *
 * 🛑 BOTH ARE ALWAYS RENDERED, EMPTY OR NOT. A live region created at the moment
 * it has something to say is a region the screen reader was not watching, and the
 * first announcement — which is the one that matters — is lost. Emptying the
 * region is likewise not the same as removing it, and the drawn design records
 * the same rule: *"the two slots are PERSISTENT — emptying the region itself
 * would delete the live regions and the next toast would announce nothing."*
 */
export function ToastRegion({ store }: { store: ToastStore }) {
  const polite = store.toasts.filter((t) => !isAssertive(t.kind))
  const alert = store.toasts.filter((t) => isAssertive(t.kind))
  return (
    <>
      <div className="toasts" data-toasts="">
        <div className="toasts-slot" role="status" aria-live="polite">
          {polite.map((t) => <ToastNode key={t.id} toast={t} store={store} />)}
        </div>
        <div className="toasts-slot" role="alert" aria-live="assertive">
          {alert.map((t) => <ToastNode key={t.id} toast={t} store={store} />)}
        </div>
      </div>
      {/* RMR-03 — the leaving copies: outside both live regions, inert and
          hidden from assistive technology, so a removal is never announced and
          nothing in them can be reached. */}
      <div className="toasts toasts-leaving" aria-hidden="true" inert>
        {(store.leaving ?? []).map((t) => (
          <div key={t.id} className="toast" data-kind={t.kind}>
            <div className="toast-l">
              <p className="toast-t">{t.title}</p>
              {t.body === undefined ? null : <p className="toast-b">{t.body}</p>}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function ToastNode({ toast, store }: { toast: Toast; store: ToastStore }) {
  return (
    <div className="toast" data-kind={toast.kind}>
      <div className="toast-l">
        <p className="toast-t">{toast.title}</p>
        {toast.body === undefined ? null : <p className="toast-b">{toast.body}</p>}
        {toast.meta === undefined ? null : <span className="toast-m">{toast.meta}</span>}
        {toast.action === undefined ? null : (
          <div className="toast-a">
            <button
              className="btn btn--small"
              type="button"
              onClick={() => {
                const run = toast.action?.run
                store.dismiss(toast.id)
                if (run !== undefined) run()
              }}
            >
              {toast.action.label}
            </button>
          </div>
        )}
      </div>
      <button
        className="btn btn--small btn--quiet"
        type="button"
        onClick={() => { store.dismiss(toast.id) }}
      >
        Dismiss
      </button>
    </div>
  )
}
