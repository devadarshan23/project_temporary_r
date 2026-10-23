import type { ReactNode } from 'react'

/**
 * MARK TWO · THE CONNECTION LIGHT — the ONLY dot, ported.
 *
 * 🛑 ITS HALO IS THE LIFE SIGNAL, and absence of life is the signal. A live
 * connection breathes; an unreachable one is hollow and STILL. There is no hazard
 * colour and none is needed — the kernel paints both states in `--ink`, because
 * infrastructure reporting on ITSELF is not a measurement and may not take the
 * agent green.
 *
 * THREE RULES MEET ON THIS ONE PRIMITIVE, which is why it is worth porting:
 *   · THE SQUARE CORNER RULE — this is the only non-zero radius in the system.
 *     Everything else, including the mark, is square (owner ruling R3).
 *   · prefers-reduced-motion — the halo must stop, and must settle at .3 rather
 *     than 0, because a DOWN light differs from a live one by an opacity-0 halo
 *     AND a hollow centre. Stopping a live halo at 0 collapses two differences
 *     into one under exactly the setting meant to preserve them. The kernel holds
 *     that guard; nothing here re-implements it, and that is the point — six
 *     files once wrote six versions of it.
 *   · THE NO-HUE-STATE RULE — the state is in `children`, as a word.
 *
 * ⚠️ THE `<i>` CARRIES NO CLASS, AND IT MUST NOT. The kernel selects it as
 * `.conn i`, and the ONE DOT detector labels an unclassed element by its nearest
 * classed ancestor — so a `className` here would both miss the kernel's rule and
 * make the light report as a dot belonging to nothing.
 *
 * ⚠️ AND ORDER MATTERS ON THE PAGE, WHICH IS NOT THIS FILE'S DOING BUT IS WHERE A
 * READER WILL LOOK. The kernel gives a DOWN light `opacity:0` on its halo, so the
 * FIRST `.conn` rendered must be a live one or a reduced-motion check reading
 * `.conn i` finds the still ring and reports the guard broken.
 */
export interface ConnectionProps {
  /** `up` breathes, `down` is hollow and still. The word beside it says which. */
  state: 'up' | 'down'
  /** The state, as text. Never omit it: a state may not depend on a light alone. */
  children: ReactNode
}

export function Connection({ state, children }: ConnectionProps) {
  return (
    <span className="conn" data-state={state}>
      <i aria-hidden="true" />
      {children}
    </span>
  )
}
