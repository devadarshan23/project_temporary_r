/**
 * THE MENU'S ARROW KEYS — C3-24, G4041 (4 Oct 2026, derived — NOT THE OWNER'S).
 *
 * Design System primitive 5 draws the account menu as `ul.menu[role=menu]`
 * with `li[role=none] > button[role=menuitem]`. A `role="menu"` is a PROMISE
 * to assistive technology that the arrow keys move between its items (WAI-ARIA
 * APG, *Menu Button*); roles without the keys would be a widget that announces
 * itself as one thing and behaves as another, which is worse than the plain
 * list it replaces. This is the whole of that promise, framework-free so it is
 * testable without a DOM:
 *
 *   ArrowDown / ArrowUp  the next / previous item, wrapping at either end;
 *   Home / End           the first / last item.
 *
 * `current === -1` means focus is not on an item (it is on the avatar that
 * opened the menu): ArrowDown then goes to the first item and ArrowUp to the
 * last. Any other key answers nothing — Escape belongs to the overlay
 * primitive (`behaviour.ts`), which closes AND returns focus, and Tab leaves
 * the menu as it leaves any disclosure.
 */
export type MenuKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End'

const MENU_KEYS: readonly string[] = ['ArrowDown', 'ArrowUp', 'Home', 'End'] satisfies readonly MenuKey[]

export function isMenuKey(key: string): key is MenuKey {
  return MENU_KEYS.includes(key)
}

/** The index focus moves to, or `null` when there is no item to move to. */
export function menuKeyTarget(key: MenuKey, count: number, current: number): number | null {
  if (count <= 0) return null
  switch (key) {
    case 'Home':
      return 0
    case 'End':
      return count - 1
    case 'ArrowDown':
      return current < 0 ? 0 : (current + 1) % count
    case 'ArrowUp':
      return current < 0 ? count - 1 : (current - 1 + count) % count
  }
}

/** The selector for a menu's items — every `menuitem` kind, as the APG names them. */
export const MENU_ITEM_SELECTOR = '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]'
