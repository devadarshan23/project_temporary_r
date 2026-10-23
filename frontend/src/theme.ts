/**
 * THE THEME — RV-13, THE OWNER'S RULING OF 3 Oct 2026 (G3392):
 * *"Dark theme follows the OS setting (prefers-color-scheme) with a
 * light/dark/system toggle in the account menu."*
 *
 * The kernel has carried a full recomputed `[data-theme="dark"]` since the pack
 * landed (`tokens.css`, THE DARK THEME) and nothing in `frontend/src` ever set
 * the attribute — a dark-mode browser got the light portal. Every computed
 * colour on every app page is a kernel token (the red team's census), so the
 * theme applies cleanly the moment the attribute is set; this module is the
 * ONE writer of that attribute.
 *
 *   · `preference` — what the person chose: `light`, `dark` or `system`.
 *     Default `system`. Persisted per browser in localStorage, which is the
 *     right home for it: a per-viewer convenience, never shared state.
 *   · `resolved` — what is painted: `light` or `dark`. `system` resolves from
 *     `prefers-color-scheme` and FOLLOWS it while the page is open.
 *
 * 🛑 EVERY STORAGE ACCESS IS WRAPPED. `localStorage` throws in a private window
 * with storage blocked, in a sandboxed frame, and on `file://` in some
 * browsers; a throw here must degrade to `system`, never blank the page.
 *
 * ⚠️ `frontend/public/theme-boot.js` (loaded by `index.html`) is a tiny copy of `resolve()` so the
 * first paint is already in the right theme (the module script runs after
 * parse, which is a flash of the light theme for every dark-mode reader). It
 * reads THE SAME KEY, and `tests/app/theme.test.ts` fails if the two drift.
 */

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const
export type ThemePreference = (typeof THEME_PREFERENCES)[number]
export type ResolvedTheme = 'light' | 'dark'

/** The localStorage key. `frontend/public/theme-boot.js` spells it too. */
export const THEME_STORAGE_KEY = 'reconcile.theme'

export const DARK_QUERY = '(prefers-color-scheme: dark)'

/** Narrow an untrusted stored value. Anything unrecognised is `system`. */
export function parsePreference(raw: string | null | undefined): ThemePreference {
  return (THEME_PREFERENCES as readonly string[]).includes(raw ?? '') ? (raw as ThemePreference) : 'system'
}

/** The painted theme for a preference and the OS's current setting. */
export function resolveTheme(preference: ThemePreference, osPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return osPrefersDark ? 'dark' : 'light'
  return preference
}

/** Minimal storage surface, so tests can pass a throwing double. */
export interface PreferenceStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function readPreference(store: PreferenceStore | null | undefined): ThemePreference {
  try {
    return parsePreference(store?.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

/** Returns whether the choice was persisted; a refusal is not an error. */
export function writePreference(store: PreferenceStore | null | undefined, preference: ThemePreference): boolean {
  try {
    if (store == null) return false
    store.setItem(THEME_STORAGE_KEY, preference)
    return true
  } catch {
    return false
  }
}

/** `window.localStorage`, or null where even TOUCHING it throws. */
export function browserStore(): PreferenceStore | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function osPrefersDark(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches
  } catch {
    return false
  }
}

/** THE ONE WRITER of `data-theme`. Sets the attribute on the root element. */
export function applyTheme(resolved: ResolvedTheme, root: HTMLElement | null =
  typeof document === 'undefined' ? null : document.documentElement): void {
  if (root !== null) root.setAttribute('data-theme', resolved)
}

/**
 * Boot: paint the stored preference now, and follow the OS while the
 * preference is `system`. Returns an unsubscribe. Called once, by `main.tsx`.
 */
export function startTheme(): () => void {
  const paint = (): void => { applyTheme(resolveTheme(readPreference(browserStore()), osPrefersDark())) }
  paint()
  let mql: MediaQueryList | null = null
  try {
    mql = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null
  } catch {
    mql = null
  }
  mql?.addEventListener('change', paint)
  return () => { mql?.removeEventListener('change', paint) }
}

/** Persist a choice and repaint. What the toggle calls. */
export function chooseTheme(preference: ThemePreference): ResolvedTheme {
  writePreference(browserStore(), preference)
  const resolved = resolveTheme(preference, osPrefersDark())
  applyTheme(resolved)
  return resolved
}
