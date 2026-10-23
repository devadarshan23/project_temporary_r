import { useState } from 'react'

import {
  THEME_PREFERENCES,
  browserStore,
  chooseTheme,
  readPreference,
  type ThemePreference,
} from '../theme.ts'

/**
 * THE THEME TOGGLE — light · dark · system, for the account menu.
 * RV-13, THE OWNER'S RULING OF 3 Oct 2026 (G3392).
 *
 * ⚠️ EXPORTED, NOT MOUNTED BY THIS SLICE. The account menu is the Close
 * surface's (ChromeBar), which a concurrent slice owns; this component is the
 * whole of the control and that slice places it — `<ThemeToggle />` inside the
 * menu, nothing else to wire. The theme itself already FOLLOWS THE OS without
 * it: `main.tsx` calls `startTheme()` at boot, so the ruling's first half holds
 * the moment this lands and the toggle only adds the override.
 *
 * A group of three buttons with `aria-pressed`, not a `<select>`: three
 * choices, all visible, one press each — and a button is the control the
 * kernel's ink default already styles. Words, not icons: the system draws with
 * text, and a sun/moon pair would be a glyph the kernel has not counted.
 */
const LABEL: Readonly<Record<ThemePreference, string>> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
}

/**
 * C3-24 (G4041) — inside an account menu (`role="menu"`) the three choices are
 * `menuitemradio`s carrying `aria-checked`, so the menu's arrow keys walk them
 * with every other item; `aria-pressed` is a toggle BUTTON's state and is not
 * an item of a menu. Outside a menu (no caller today, but the component does
 * not assume where it is mounted) it stays a group of toggle buttons.
 */
export function ThemeToggle({ id = 'theme-toggle', menu = false }: { readonly id?: string; readonly menu?: boolean }) {
  const [preference, setPreference] = useState<ThemePreference>(() => readPreference(browserStore()))
  return (
    <div className="theme-toggle" role="group" aria-labelledby={`${id}-label`}>
      <span className="theme-toggle-l" id={`${id}-label`}>Theme</span>
      {THEME_PREFERENCES.map((p) => (
        <button
          key={p}
          type="button"
          className="theme-toggle-b"
          {...(menu
            ? { role: 'menuitemradio', 'aria-checked': preference === p }
            : { 'aria-pressed': preference === p })}
          data-theme-choice={p}
          onClick={() => {
            chooseTheme(p)
            setPreference(p)
          }}
        >
          {LABEL[p]}
        </button>
      ))}
    </div>
  )
}
