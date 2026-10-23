import { useCallback, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { KeyboardEvent, ReactNode } from 'react'

import { Soon } from './Soon.tsx'
import type { SessionPrincipal } from '../api/principal.ts'
import { ORG_CLASS_WORD, servedRoleLine } from '../words.ts'
import { DRAW_GATES, useHolds } from '../capabilities.ts'
import { useOverlay } from '../overlays/useOverlay.ts'
import { MENU_ITEM_SELECTOR, isMenuKey, menuKeyTarget } from '../overlays/menu-keys.ts'
import type { LinkProps } from '../routes/useRoute.ts'
import { countryOfResidency } from '../chrome-state.ts'
import { initialsOf } from '../initials.ts'

/**
 * THE CHROME — `docs/handoff-pack/C1 Close.dc.html`, `<header class="chrome">`,
 * drawn as the pack draws it: ONE LINE, always.
 *
 *   logo · entity switcher · Close / Ask / Reports · audit trail ·
 *   Find, go, do or ask ⌘K · Needs you N · (spacer) · the meter · whoami
 *
 * 🛑 REBUILT 2 Oct 2026 UNDER G3091, THE OWNER'S RULING, AND THE PREVIOUS
 * COMPONENT IS RETRIEVABLE RATHER THAN NARRATED HERE:
 * `git show 76f0341e:frontend/src/components/ChromeBar.tsx`. It drew nine
 * controls of which seven were hatched with a G row and a paragraph each, which
 * rendered on staging as four rows of hatched blocks. The owner's verdict on it
 * was *"the styling and ux is nowhere close to the handoff"*, and the ruling is:
 * *"Pack-faithful, quiet: draw exactly as the pack, visibly disabled (muted, no
 * hatch, no G-numbers); a small tooltip says 'Coming soon'."*
 *
 * WHAT IS REAL, AND WHERE EACH VALUE COMES FROM:
 *   · Close — a route link (`/close`), `aria-current` driven by the caller.
 *   · Needs you N — the open and investigating counts from
 *     `getExceptionFacets`, summed over severity; pressing it switches the
 *     register to its "Needs you" view. Absent count = not read yet, and no
 *     number is drawn rather than a zero.
 *   · the account menu — a native `<details>` (the pre-rendered page carries no
 *     script) wired to the ONE overlay primitive for focus return (G247), with
 *     the Setup DOOR in it: a door, never a fourth destination.
 *
 * WHAT IS DRAWN AND NOT SERVED, each a `<Soon>`: the entity switcher (no
 * entity-set operation; the tenant is the HOST's, and the browser cannot read
 * it — `resolveTenantContext` needs the session handle in its body and the
 * handle is HttpOnly), Ask, Reports, the audit trail door, the palette, the
 * meter (no metering operation), Profile, Preferences and Sign out.
 *
 * TWO THINGS STAY OUT AND ARE ASSERTED OUT BY SHAPE in
 * `tests/design/shell.test.ts`: a dashboard of summary tiles above the register,
 * and a left sidebar. Both are ARGUED out on the record, not merely unbuilt.
 *
 * THE AUDIT TRAIL IS A DOOR BESIDE THE NAV, NOT INSIDE IT. The pack draws it as
 * `li.door` in the same list; it is placed after the `<nav>` here because the
 * destinations are three and the shell test reads every link in a `<nav>` as a
 * destination — the drawn position (a rule, then a mono word) is unchanged.
 */

/**
 * The account menu — a native `<details>` on the ONE overlay primitive for
 * focus return (G247). Exported so the partner portal's chrome (G3294) wears
 * the same menu rather than a second implementation of it (§5.3). The staff
 * console's chrome (G3322) wears it too: #538 and #542 each exported it, and
 * the integration keeps ONE export (G3371).
 */
export function AccountMenu({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null)
  const [open, setOpen] = useState(false)
  const dismiss = useCallback(() => {
    const el = ref.current
    if (el !== null) el.open = false
    setOpen(false)
  }, [])
  useOverlay(ref, open, dismiss, { trapFocus: false, lockScroll: false, returnFocus: true })
  /* Whether the overlay primitive is attached — read inside the key handler,
     which must not re-create on every toggle. */
  const attached = useRef(false)
  attached.current = open
  /* C3-24 (G4041) — the arrow keys a `role="menu"` promises (`menu-keys.ts`).
     ArrowDown or ArrowUp on the avatar opens the menu and enters it, as the
     APG's menu button does; inside, the keys walk the items and wrap.
     ⚠️ THE PRIMITIVE IS WIRED BEFORE FOCUS MOVES, SYNCHRONOUSLY. `<details>`
     reports its toggle a task after the keystroke that opened it, so a
     keyboard user who pressed Enter then ArrowDown at once had the primitive
     attached AFTER focus was on the first item — and `returnFocus` captured the
     ITEM as the opener, so Escape sent focus back into the menu it had closed.
     Measured RED, not reasoned (`tests/e2e/c3-remaining.test.ts` §1).
     `flushSync` commits the open state, and React flushes a sync render's
     effects before it returns, so the capture sees the avatar. */
  const onKeyDown = useCallback((e: KeyboardEvent<HTMLDetailsElement>) => {
    const el = ref.current
    if (el === null || !isMenuKey(e.key)) return
    const onSummary = (e.target as Element).closest('summary') !== null
    if (onSummary && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    if (!onSummary && !el.open) return
    el.open = true
    if (!attached.current) flushSync(() => { setOpen(true) })
    const items = [...el.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR)]
    const current = onSummary ? -1 : items.indexOf(document.activeElement as HTMLElement)
    const to = menuKeyTarget(e.key, items.length, current)
    if (to === null) return
    e.preventDefault()
    items[to]?.focus()
  }, [])
  return (
    <details
      className="disc acct"
      ref={ref}
      onToggle={(e) => { setOpen(e.currentTarget.open) }}
      onKeyDown={onKeyDown}
    >
      {children}
    </details>
  )
}

export interface ChromeBarProps {
  readonly close?: LinkProps
  readonly setup?: LinkProps
  readonly inSetup?: boolean
  /** True on the Close screens; Ask and Reports are never current (not built). */
  readonly onClose?: boolean
  /** Open + investigating, from the plane; `null` while unread or unreadable. */
  readonly needsYou?: number | null
  readonly needsYouPressed?: boolean
  readonly onNeedsYou?: () => void
  /**
   * C3-07 — whether the "Needs you" chip is drawn. Only a role that triages
   * lines (`propose_resolution`) has lines that need it; the approver's work is
   * Approvals and the assurance reader acts on nothing. Default drawn.
   */
  readonly needsYouShown?: boolean
  /**
   * C3-08 — THE OWNER'S RULING, 4 Oct 2026: *"Approvals is a nav destination,
   * tenant-wide: in the chrome nav for holders of approve_resolution."* The
   * pack's `Close · Ask · Approvals {{ apprWaiting }} · Reports`. Drawn only
   * when given AND the session holds `approve_resolution` (G3193). `count` is
   * the proposals waiting on THIS reader's approval; `null` while unread.
   */
  readonly approvals?: { readonly count: number | null; readonly current: boolean; readonly onGo: () => void }
  /**
   * G3191 — the STAGING profile switcher (G3003), passed ONLY by a test build:
   * `main.tsx` supplies it under `TEST_PERSONAS_ENABLED`, a compile-time
   * constant, so a production bundle never constructs it and this menu has no
   * extra item. It sits in the account menu because switching persona is an
   * act on "who am I", which is what this menu is for.
   */
  readonly switcher?: ReactNode
  /**
   * The tenant D1 bound this session to, or `null`/absent when nothing is
   * bound. G3213, applying G3006.
   *
   * 🛑 THE ID AND NOTHING ELSE. `TenantContext` — the only thing the plane
   * serves about the tenant — carries `tenantId`, `environment`, `residency`
   * and `deploymentMode`, and NO display name; no served operation names the
   * signed-in PERSON either. A tenant name or a person's name drawn here would
   * be invented, so the menu says *which tenant* and stops.
   *
   * ⚠️ IT IS NOT LOAD STATE IN G216's SENSE. G216 fences the CONNECTION LIGHT
   * from a fetch; this is a fact the plane asserted about the session, drawn
   * as words in the account menu, and it reaches no indicator. G3252: it moved
   * into #531's account menu (`acctwho`) in the merge with #533.
   */
  readonly boundTenant?: string | null
  /**
   * WHO IS SIGNED IN — `getSessionPrincipal`, G3354 (3 Oct 2026), or
   * `null`/absent while unread or unreadable.
   *
   * ⚠️ THE PARAGRAPH ABOVE SAID *"no served operation names the signed-in
   * PERSON either"* AND IT IS NOW FALSE — it is kept because it is why the menu
   * said "your account" until this prop existed. `TenantContext` still carries
   * no name; the tenant's name arrives HERE, from the control roster.
   *
   * 🛑 EVERY STRING IN IT IS DRAWN AS A TEXT NODE. `displayName` is what the
   * person's directory said, verbatim (D6-9).
   *
   * ⚠️ THIS SAID *"no initials are derived from it, because slicing a name is
   * interpreting it"* UNTIL 3 Oct 2026 AND IS CORRECTED RATHER THAN DELETED:
   * NC-08 / RV-16, THE OWNER'S RULING (G3473) — *"show two initials in the
   * account square, derived from the stored display name as a text node; '·'
   * only when no name exists."* `initialsOf()` below is the one derivation.
   */
  readonly principal?: SessionPrincipal | null
  /**
   * D1's `residency` for the bound tenant. ⚠️ NC-09 (G3473): IT IS NO LONGER
   * DRAWN AS-IS. The plane serves an infrastructure region token
   * (`ap-southeast-1`), and the pack draws a COUNTRY ("SG"); the chip now draws
   * `countryOfResidency()`'s answer for a region it knows and NOTHING for one it
   * does not, so a raw region code never reaches the chrome. ⚠️ NO CURRENCY IS
   * DRAWN: nothing the plane serves states a tenant's currency, so the pack's
   * "· SGD" has no source and is left out rather than guessed.
   */
  readonly residency?: string | null
  /**
   * THE DARK-THEME TOGGLE'S SLOT — RV-13. The kernel ships a full
   * `[data-theme="dark"]`; the toggle itself is `fix/ui-foundations`' component
   * and is mounted HERE, in the account menu (it is a preference about the
   * PERSON, which is what this menu holds), by passing it in. `main.tsx` passes `<ThemeToggle />`; with nothing passed
   * the menu draws no item — an empty slot is not drawn as a control.
   */
  readonly themeToggle?: ReactNode
  /**
   * SIGN OUT — `signOut`, `DELETE /session` (RC-12, 3 Oct 2026). It was drawn
   * `Coming soon` while the plane served the operation: the one item in this
   * menu a reviewer tries first. Absent (a specimen, a render with no plane)
   * leaves it quiet, which is the honest answer there.
   */
  readonly onSignOut?: () => void
}

/**
 * THE BOTTOM TAB BAR — the narrow tier's three destinations (RC-07, Design
 * System *The phone shell*: *"Three destinations, three tabs, and never a
 * fourth"*). Drawn at every width and shown by `close.css` below 720px only,
 * where the chrome keeps just the mark, the palette key and the avatar.
 */
export function TabBar({ close, onClose = false }: { readonly close?: LinkProps; readonly onClose?: boolean }) {
  return (
    <nav className="tabbar" aria-label="Destinations (narrow)" data-tabbar="">
      <a
        className="tab"
        href={close?.href ?? '/close'}
        onClick={close?.onClick}
        aria-current={onClose ? 'page' : undefined}
      >
        Close
      </a>
      <Soon as="link" className="tab">Ask</Soon>
      <Soon as="link" className="tab">Reports</Soon>
    </nav>
  )
}

export function ChromeBar({
  close,
  setup,
  inSetup = false,
  onClose = !inSetup,
  needsYou = null,
  needsYouPressed = false,
  onNeedsYou,
  needsYouShown = true,
  approvals,
  switcher,
  boundTenant = null,
  principal = null,
  residency = null,
  themeToggle,
  onSignOut,
}: ChromeBarProps = {}) {
  const tenant = principal?.tenant ?? null
  /* The roster's name, else the id — never an invented name (G3354). */
  const entity = tenant === null ? null : (tenant.name ?? tenant.tenantId)
  /* C1's chip is `SG · SGD`: the residency's country (G3473) and — G4046, the
     owner's — the tenant's DECLARED reporting currency. A tenant that declared
     none draws the country alone; nothing is defaulted (`0560` §1). */
  const country = countryOfResidency(residency)
  const currency = tenant?.reportingCurrency ?? null
  const chipTail = [country, currency].filter((x): x is string => x !== null).join(' · ')
  const mayConfigure = useHolds(DRAW_GATES.setup)
  const mayApprove = useHolds(DRAW_GATES.approvals)
  const approvalsDrawn = approvals !== undefined && mayApprove
  return (
    <header className="chrome" data-chrome="">
      <a className="mark" href={close?.href ?? '/close'} onClick={close?.onClick} aria-label="Reconcile AI — the close">
        <span className="logo">
          <span className="mascot" aria-hidden="true">
            <i className="d1">·</i>
            <i className="d2">·</i>
            <i className="d3">·</i>
          </span>
          <span>Reconcile</span>
          <span className="badge">AI</span>
        </span>
      </a>

      <Soon className="tenant" label="Entity switcher">
        {entity === null ? (
          <>
            All entities<span className="cc">each entity</span>
          </>
        ) : (
          <>
            <span data-entity-name="">{entity}</span>
            {chipTail === '' ? null : (
              <span className="cc" data-residency={residency ?? ''} data-currency={currency ?? ''}>{chipTail}</span>
            )}
          </>
        )}
        <span aria-hidden="true">▾</span>
      </Soon>

      <nav aria-label="Destinations">
        <ul className="dests">
          <li>
            <a
              href={close?.href ?? '/close'}
              onClick={close?.onClick}
              aria-current={onClose && !(approvalsDrawn && approvals.current) ? 'page' : undefined}
            >
              Close
            </a>
          </li>
          <li><Soon as="link">Ask</Soon></li>
          {approvalsDrawn ? (
            <li data-dest="approvals">
              <button
                type="button"
                className="destbtn"
                data-approvals-dest=""
                aria-current={approvals.current ? 'page' : undefined}
                onClick={approvals.onGo}
              >
                Approvals{approvals.count === null ? null : <span className="cnt">{approvals.count}</span>}
              </button>
            </li>
          ) : null}
          <li data-dest="reports"><Soon as="link">Reports</Soon></li>
        </ul>
      </nav>
      <span className="door"><Soon>audit trail</Soon></span>

      <Soon className="palbtn" label="Find, go, do or ask — command palette">
        <span>Find, go, do or ask</span>
        <kbd>⌘K</kbd>
      </Soon>

      {!needsYouShown ? null : onNeedsYou === undefined ? (
        <span className="abtn abtn--static" data-needs-you={needsYou ?? ''}>
          Needs you{needsYou === null ? null : <span className="cnt">{needsYou}</span>}
        </span>
      ) : (
        <button
          className="abtn"
          type="button"
          aria-pressed={needsYouPressed}
          onClick={onNeedsYou}
          data-needs-you={needsYou ?? ''}
        >
          Needs you{needsYou === null ? null : <span className="cnt">{needsYou}</span>}
        </button>
      )}

      <span className="sp" />

      <Soon className="meterbtn" label="What this tenant has spent against its plan">
        <span className="spent">
          — <span className="met" aria-hidden="true">∴</span>{' '}
          <span className="q">of the plan this month</span>
        </span>
      </Soon>

      <AccountMenu>
        <summary className="whoami" aria-haspopup="menu">
          <span className="init" aria-hidden="true" data-initials="">
            {initialsOf(principal?.displayName ?? null)}
          </span>
          {principal === null ? (
            <span>
              Signed in<span className="sub">your account</span>
            </span>
          ) : (
            <span data-whoami="">
              {principal.displayName}
              {/* G4045 — the live role name(s), as text; the org class only when none. */}
              <span className="sub" data-org-class={principal.orgClass} data-role-line="">
                {servedRoleLine(principal.roles, ORG_CLASS_WORD[principal.orgClass])}
              </span>
            </span>
          )}
          <span className="sr-only">Account menu</span>
        </summary>
        <ul className="acctmenu" role="menu" aria-label="Account">
          <li className="acctwho" role="none" {...(boundTenant === null ? {} : { 'data-bound-tenant': boundTenant })}>
            <b>{principal === null ? 'Signed in' : principal.displayName}</b>
            {principal === null ? null : <span data-whoami-email="">{principal.email}</span>}
            <span>{entity ?? (boundTenant === null ? 'this browser holds your session' : boundTenant)}</span>
          </li>
          {/* WHAT IS WAITING ON YOU — the pack's account menu holds it (`app.css`:
              "who you are, what is waiting on you …"), and at the narrow tier,
              where the chrome sheds "Needs you", this is where it is reached. */}
          {onNeedsYou === undefined ? null : (
            <li role="none">
              <button className="acctitem" type="button" role="menuitem" onClick={onNeedsYou} data-acct-needs-you="">
                Needs you{needsYou === null ? null : <span className="cnt">{needsYou}</span>}
              </button>
            </li>
          )}
          <li role="none"><Soon className="acctitem" menuItem>Profile</Soon></li>
          <li role="none"><Soon className="acctitem" menuItem>Preferences</Soon></li>
          {themeToggle === undefined ? null : <li role="none" data-theme-slot="">{themeToggle}</li>}
          {/* C9 #22 / G3193 — Setup is drawn for a session that HOLDS
              `configure_endpoint` and is absent otherwise (G3522). The route
              still answers its 403 for a typed address. */}
          {mayConfigure ? (
            <>
              <li className="sep" role="separator" />
              <li role="none">
                <a className="acctitem" role="menuitem" href={setup?.href ?? '/setup'} onClick={setup?.onClick} data-setup-door="">
                  Setup
                </a>
              </li>
            </>
          ) : null}
          <li className="sep" role="separator" />
          <li role="none">
            {onSignOut === undefined ? (
              <Soon className="acctitem" menuItem>Sign out</Soon>
            ) : (
              <button className="acctitem" type="button" role="menuitem" data-sign-out="" onClick={onSignOut}>
                Sign out
              </button>
            )}
          </li>
          {switcher === undefined ? null : (
            <>
              <li className="sep" role="separator" />
              <li role="none" data-acct-switcher="">{switcher}</li>
            </>
          )}
        </ul>
      </AccountMenu>
    </header>
  )
}
