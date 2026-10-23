import { useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'

/*
 * ONE DROP ORDER FOR TWO CHROMES — moved out of `PartnerPortal.tsx` under
 * NS-01 (G3710, 4 Oct 2026): the staff console's bar lost *Agent builder* at
 * 820 with no cue while the partner bar collapsed its quiet destinations
 * behind a `+N`. Two surfaces solving one problem two ways is §5.3; both now
 * call this.
 */

/**
 * RP-02 (G3567) — THE DROP ORDER. The bar never wraps (close.css), so when the
 * destinations do not fit, the QUIET ones (`<Soon>`, nothing behind them) are
 * collapsed from the end, one at a time, BEFORE a built one is ever clipped:
 * People is the only built administrator destination and it sat past the
 * clip at 1440 with "Rate cards" cut mid-word. A quiet `+N` takes their place
 * as the visible cue, and what is still left over scrolls, as the pack's
 * `.dests` does, with its edge marked (`data-overflow`).
 * Returns how many quiet destinations are collapsed.
 */
export function useQuietDrop(list: RefObject<HTMLUListElement | null>, key: string): number {
  const [dropped, setDropped] = useState(0)
  useLayoutEffect(() => {
    const ul = list.current
    if (ul === null) return
    const fit = (): void => {
      const quiet = Array.from(ul.querySelectorAll<HTMLLIElement>(':scope > li[data-quiet]'))
      const more = ul.querySelector<HTMLLIElement>(':scope > li[data-more]')
      for (const li of quiet) li.hidden = false
      if (more !== null) more.hidden = true
      /* Measured on the LIST ITEMS, not on `scrollWidth`: a quiet control's
         tooltip is laid out (unseen) past its own edge, and would read as an
         overflow of every bar that ends in one. */
      const over = (): boolean => {
        const edge = ul.getBoundingClientRect().right + ul.scrollLeft
        let right = 0
        for (const li of Array.from(ul.children)) {
          if (!(li as HTMLElement).hidden) right = Math.max(right, li.getBoundingClientRect().right + ul.scrollLeft)
        }
        return right > edge + 1
      }
      let n = 0
      if (over()) {
        /* The cue takes its own width first, so what is measured is the bar
           as it will be drawn. */
        if (more !== null) more.hidden = false
        for (let i = quiet.length - 1; i >= 0 && over(); i--) {
          const li = quiet[i]
          if (li === undefined) break
          li.hidden = true
          n += 1
        }
      }
      ul.dataset['overflow'] = over() ? 'end' : ''
      setDropped(n)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(ul)
    if (ul.parentElement !== null) ro.observe(ul.parentElement)
    window.addEventListener('resize', fit)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [list, key])
  return dropped
}
