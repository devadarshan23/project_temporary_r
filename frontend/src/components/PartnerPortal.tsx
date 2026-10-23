import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { AccountMenu } from './ChromeBar.tsx'
import { ErrorPage } from './ErrorPage.tsx'
import { SkipLink } from './SkipLink.tsx'
import { StatusGrammar } from './StatusGrammar.tsx'
import { Soon } from './Soon.tsx'
import { useQuietDrop } from './quiet-drop.ts'
import { ThemeToggle } from './ThemeToggle.tsx'
import { initialsOf } from '../initials.ts'
import { servedRoleLine } from '../words.ts'
import { DRAW_GATES, useHolds } from '../capabilities.ts'
import type { SessionPrincipal } from '../api/principal.ts'
import { PlaneRefused } from '../api/runs.ts'
import {
  DEAL_CURRENCY_DEFAULT,
  INVITABLE_ROLES,
  dealValueOf,
  exponentOf,
  fetchDealRegistrations,
  fetchPartnerPeople,
  fetchSandbox,
  invitePartnerPerson,
  requestSandbox,
  signOutHere,
  submitDealRegistration,
  type DealRegistration,
  type DealRegistrationRequest,
  type InvitableRole,
  type PartnerRoster,
  type SandboxView,
} from '../api/partner.ts'
import { dateOf, moneyFigure } from '../format.ts'
import { routeRoot } from '../routes/screens.ts'
import type { LinkProps } from '../routes/useRoute.ts'

/**
 * P1 · THE PARTNER PORTAL — `docs/handoff-pack/P1 Partner.dc.html`, drawn as
 * the pack draws it, on the partner host only (`routes/surface.ts`, one module since G3371).
 * G3291–G3300, 3 Oct 2026.
 *
 * ┌─ WHAT IS REAL, AND WHICH OPERATION STANDS BEHIND IT ──────────────────────┐
 * │ Deals    — the registry (`listDealRegistrations`) and its one write,      │
 * │            "Register a deal" (`submitDealRegistration`, a 202: received,  │
 * │            not registered).                                                │
 * │ Sandbox  — the demo tenant's standing (`getSandboxTenant`) and "Ask for   │
 * │            one" (`requestSandboxTenant`).                                  │
 * │ People   — the firm's roster and open offers (`listPartnerPeople`) and    │
 * │            "Invite someone" (`invitePartnerPerson`).                       │
 * │ Sign out — `DELETE /session` on this host.                                 │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * QUIET, NOT HATCHED (G3091): every control the pack draws and nothing serves
 * is a `<Soon>` — the firm switcher, Tenants sold, Commission, Cases,
 * Arrangement, Rate cards, Catalogue, the palette, "Needs you", the billing
 * period, the table filter, and the sandbox's reset, trial and hand-back.
 *
 * HIDDEN, NOT "COMING SOON" (G3193), because a ruling refuses them:
 *   · "Open the sandbox" — G270: a control-plane identity does not cross to a
 *     tenant host; the sandbox is reached by signing in to it.
 *   · the sandbox's document ledger — a document name is tenant data and a
 *     control-plane operation may not return one (the contract's §3).
 *   · People, Arrangement and Rate cards for a person who is not the firm's
 *     administrator — the pack draws them for the administrator alone, and the
 *     plane says which one this is: the roster read answers 200 to an
 *     administrator and 403 to everybody else, so that answer decides.
 *
 * NO NAME IS INVENTED. No served operation returns the firm's name or the
 * signed-in person's, so the chrome says "Your firm" and "Signed in" rather
 * than drawing the pack's synthetic Ascend Cloud Partners / Jonas Lim.
 *
 * ⚠️ HALF OF THAT PARAGRAPH WENT FALSE IN THE INTEGRATION (G3373): #543's
 * `getSessionPrincipal` names the signed-in PERSON, so the account menu now
 * draws their name and address as their directory stored them, as text nodes.
 * 🛑 THE FIRM HALF STANDS: the principal carries `orgClass: partner` and no
 * partner record, and nothing else served names the firm, so the switcher
 * still says "Your firm" rather than a name somebody would have to invent.
 */

export type PartnerDest = 'deals' | 'sandbox' | 'people'

export interface PartnerPortalProps {
  /** The allowlisted plane origin (`planeFrom()`), where every read goes. */
  readonly origin: string
  /** Which pane is open — the route's, never a value kept here. */
  readonly dest: PartnerDest
  readonly links: { readonly [D in PartnerDest]: LinkProps }
  /** The staging profile switcher, in a test build only. */
  readonly switcher?: ReactNode
  /** `getSessionPrincipal`'s answer, read by the caller, or `null` (G3373). */
  readonly principal?: SessionPrincipal | null
}

/** Where a read stands. A refusal is kept by status so each can be drawn. */
type Load<T> =
  | { readonly phase: 'reading' }
  | { readonly phase: 'read'; readonly value: T }
  | { readonly phase: 'refused'; readonly status: number; readonly code: string }

function refusedOf(err: unknown): { readonly phase: 'refused'; readonly status: number; readonly code: string } {
  if (err instanceof PlaneRefused) return { phase: 'refused', status: err.status, code: err.code ?? String(err.status) }
  return { phase: 'refused', status: 503, code: 'upstream_unavailable' }
}

function useRead<T>(read: () => Promise<T>, on: boolean, epoch: number): Load<T> {
  const [load, setLoad] = useState<Load<T>>({ phase: 'reading' })
  useEffect(() => {
    if (!on) return
    let live = true
    read()
      .then((value) => { if (live) setLoad({ phase: 'read', value }) })
      .catch((err: unknown) => { if (live) setLoad(refusedOf(err)) })
    return () => { live = false }
    /* `read` is rebuilt every render; the effect is keyed on what it reads. */
  }, [on, epoch])
  return load
}

/* ═══ THE CHROME ═══════════════════════════════════════════════════════════ */

function PartnerChrome({
  dest,
  links,
  admin,
  settled,
  roleKnown,
  switcher,
  principal,
}: {
  readonly dest: PartnerDest
  readonly links: PartnerPortalProps['links']
  readonly admin: boolean
  /** RP-06 (G3569): the roster read has answered, so the bar may be shown. */
  readonly settled: boolean
  /**
   * NP-02 (G3703): the answer NAMED a role — 200 (administrator) or 403 (user).
   * A read that failed any other way settles the bar and names no role.
   */
  readonly roleKnown: boolean
  readonly switcher: ReactNode | undefined
  readonly principal: SessionPrincipal | null
}) {
  const [leaving, setLeaving] = useState(false)
  const signOut = useCallback(() => {
    if (leaving) return
    setLeaving(true)
    void signOutHere().then(() => { window.location.assign('/signin') })
  }, [leaving])
  const current = (d: PartnerDest): 'page' | undefined => (dest === d ? 'page' : undefined)
  const dests = useRef<HTMLUListElement | null>(null)
  const dropped = useQuietDrop(dests, `${String(admin)}:${String(settled)}:${String(roleKnown)}`)
  /* RP-06 — until the role is known, the role-dependent sub-line is held (a
     reserved, blank line) rather than drawn as a partner user's and redrawn.
     NP-02 — a failed read is not a partner user: the line stays neutral. */
  /* G4045 — the served role names first; the derived line only when none. */
  const roleLine = servedRoleLine(principal?.roles, roleLineOf(admin, settled, roleKnown))
  /* NP-02 (G3703): the least-privileged role's own items (Catalogue is drawn
     for every role) stay; what a role ADDS is drawn only when it is known. */

  return (
    <header className="chrome" data-chrome="" data-partner-chrome="">
      <a className="mark" href={links.deals.href} onClick={links.deals.onClick} aria-label="Reconcile AI — partner portal">
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

      <Soon className="tenant" label="Firm switcher">
        Your firm<span className="cc">partner</span>
        <span aria-hidden="true">▾</span>
      </Soon>

      {/* RP-06: the destinations are held (space kept, not shown) until the
          roster read settles, so an administrator's bar never reflows under
          the cursor. RP-02: quiet ones carry `data-quiet` and drop first. */}
      <nav aria-label="Destinations" data-settling={settled ? undefined : ''} aria-busy={!settled}>
        <ul className="dests" ref={dests} data-quiet-dropped={dropped}>
          <li data-built="">
            <a href={links.deals.href} onClick={links.deals.onClick} aria-current={current('deals')}>Deals</a>
          </li>
          <li data-quiet=""><Soon as="link">Tenants sold</Soon></li>
          <li data-quiet=""><Soon as="link">Commission</Soon></li>
          <li data-quiet=""><Soon as="link">Cases</Soon></li>
          <li data-built="">
            <a href={links.sandbox.href} onClick={links.sandbox.onClick} aria-current={current('sandbox')}>Sandbox</a>
          </li>
          {admin ? <li data-quiet=""><Soon as="link">Arrangement</Soon></li> : null}
          {admin ? <li data-quiet=""><Soon as="link">Rate cards</Soon></li> : null}
          <li data-quiet=""><Soon as="link">Catalogue</Soon></li>
          {admin ? (
            <li data-built="">
              <a href={links.people.href} onClick={links.people.onClick} aria-current={current('people')}>People</a>
            </li>
          ) : null}
          {/* The cue that more destinations exist than fit: a count of the
              collapsed quiet ones, itself quiet, since nothing is behind them. */}
          <li data-more="" hidden={dropped === 0}>
            <Soon as="link" label={`${String(dropped)} more ${dropped === 1 ? 'destination' : 'destinations'}, not built yet`}>
              +{dropped}
            </Soon>
          </li>
        </ul>
      </nav>

      <span className="sp" />

      <Soon className="palbtn" label="Find, go or do — command palette">
        <span>Find, go or do</span>
        <kbd>⌘K</kbd>
      </Soon>
      <Soon className="abtn">Needs you</Soon>
      {/* RP-08f: the pack's two-part label, the period in ink and "billing
          period" in q. No served operation names a period, so the ink half is
          the pack's not-measured mark rather than an invented month. */}
      <Soon className="abtn" label="Billing period, not served yet">
        —<span className="q">billing period</span>
      </Soon>

      <AccountMenu>
        <summary className="whoami" aria-haspopup="menu">
          {/* N-04 (G3484, the owner's): two initials from the stored name; `·`
              only when there is none. */}
          <span className="init" aria-hidden="true">{initialsOf(principal?.displayName)}</span>
          <span {...(principal === null ? {} : { 'data-whoami': '' })}>
            {principal === null ? 'Signed in' : principal.displayName}
            <span className="sub" data-role-line="">{roleLine}</span>
          </span>
          <span className="sr-only">Account menu</span>
        </summary>
        <ul className="acctmenu" role="menu" aria-label="Account">
          <li className="acctwho" role="none">
            <b>{principal === null ? 'Signed in' : principal.displayName}</b>
            {principal === null ? null : <span data-whoami-email="">{principal.email}</span>}
            <span>partner portal · your own directory</span>
          </li>
          <li role="none"><Soon className="acctitem" menuItem>Your profile</Soon></li>
          <li role="none"><Soon className="acctitem" menuItem>Pending actions</Soon></li>
          <li role="none"><Soon className="acctitem" menuItem>Keyboard shortcuts</Soon></li>
          {/* RP-08g: the administrator's Administration item, quiet rather than absent. */}
          {admin ? (
            <li role="none">
              <Soon className="acctitem" menuItem>
                Administration<span className="k">people and cards</span>
              </Soon>
            </li>
          ) : null}
          {/* N-04 — the light/dark/system toggle (G3392), the same component the
              tenant shell's account menu carries. */}
          <li role="none" data-theme-slot=""><ThemeToggle menu /></li>
          <li className="sep" role="separator" />
          <li role="none">
            <button className="acctitem" type="button" role="menuitem" data-sign-out="" aria-disabled={leaving} onClick={signOut}>
              Sign out<span className="k">ends this session</span>
            </button>
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

/**
 * The role line beside the avatar and in the status bar: blank until the read
 * answers (RP-06), and NEUTRAL when it answered without naming a role (NP-02,
 * G3703). ⚠️ A failed roster read (503) drew an ADMINISTRATOR as *"partner
 * user"* — a role the person does not hold. `partner` is true of both.
 */
function roleLineOf(admin: boolean, settled: boolean, roleKnown: boolean): string {
  if (!settled) return '\u00a0'
  if (!roleKnown) return 'partner'
  return admin ? 'partner administrator' : 'partner user'
}

/**
 * THE BOTTOM TAB BAR — the phone shell's destinations (Design System *The phone
 * shell*: *"Three destinations, three tabs, and never a fourth"*), shown by
 * `close.css` below 720px, where the bar keeps only the mark, the palette key
 * and the avatar. RP-01 (G3566): the partner chrome hid its destinations at that
 * step and drew no tab bar, so a phone reached no pane but the first. The tabs
 * are the BUILT destinations — Deals, Sandbox and, for an administrator, People
 * — which is exactly three, so no quiet one is drawn here.
 */
function PartnerTabBar({
  dest,
  links,
  admin,
}: {
  readonly dest: PartnerDest
  readonly links: PartnerPortalProps['links']
  readonly admin: boolean
}) {
  const tab = (d: PartnerDest, label: string) => (
    <a className="tab" href={links[d].href} onClick={links[d].onClick} aria-current={dest === d ? 'page' : undefined}>
      {label}
    </a>
  )
  return (
    <nav className="tabbar" aria-label="Destinations (narrow)" data-tabbar="" data-partner-tabbar="">
      {tab('deals', 'Deals')}
      {tab('sandbox', 'Sandbox')}
      {admin ? tab('people', 'People') : null}
    </nav>
  )
}

/* ═══ SHARED PIECES ════════════════════════════════════════════════════════ */

/**
 * NP-05 (G3708) — THE SKIP LINK LANDS ON THE PANE'S HEADING. It focused a
 * zero-height `span#work`, so a keyboard user saw no focus at all; the pane's
 * own label is what the work is called, and it is legible when ringed. Every
 * pane draws exactly one, as its first label.
 */
const WORK_ID = 'work'

function PaneHead({ children }: { readonly children: ReactNode }) {
  return (
    <span className="lab" id={WORK_ID} tabIndex={-1}>
      {children}
    </span>
  )
}

/** A read that did not answer, drawn in the pane rather than as a page. */
function Unread({ load, what }: { readonly load: Load<unknown>; readonly what: string }) {
  if (load.phase === 'reading') {
    return <p className="tempty" role="status" data-reading="">Reading {what}.</p>
  }
  if (load.phase !== 'refused') return null
  if (load.status === 403) {
    return (
      <p className="tempty" role="status" data-refused="403">
        Your role here does not reach {what}. A partner administrator at your firm decides who carries what.
      </p>
    )
  }
  return (
    <p className="tempty" role="status" data-refused={String(load.status)}>
      {what.charAt(0).toUpperCase() + what.slice(1)} could not be read just now. Nothing was changed — try again in a few
      minutes, and quote <span className="mono">{load.status} · {load.code}</span> if it persists.
    </p>
  )
}

function Result({ kind, children }: { readonly kind: 'ok' | 'refused'; readonly children: ReactNode }) {
  return (
    <div className={kind === 'refused' ? 'result refused' : 'result'} role="status" data-result={kind}>
      {children}
    </div>
  )
}

/* ═══ DEALS · THE REGISTRY, AND THE ONE WRITE THIS PORTAL HAS ═════════════ */

const SHAPE_LABEL: Readonly<Record<string, string>> = { deal: 'A deal', customer_claim: 'A customer' }
const STANDING_LABEL: Readonly<Record<string, string>> = {
  waiting: 'waiting on us',
  accepted: 'accepted',
  dormant: 'dormant',
  refused: 'refused',
}
/** The pack's two tones: a quiet chip, and `stale` for what is going quiet or was refused. */
const STALE_STANDINGS: ReadonlySet<string> = new Set(['dormant', 'refused'])

/** The pack's resale scopes, offered on the customer-shaped claim. */
const RESALE_SCOPES = ['Three-way match', 'Bank reconciliation', 'Card settlement'] as const

type SortKey = 'company' | 'shape' | 'registeredAt' | 'lastActivityAt' | 'standing'
const COLUMNS: readonly { readonly key: SortKey; readonly label: string }[] = [
  { key: 'company', label: 'Customer' },
  { key: 'shape', label: 'Shape' },
  { key: 'registeredAt', label: 'Registered' },
  { key: 'lastActivityAt', label: 'Last activity' },
  { key: 'standing', label: 'Standing' },
]
const PER_PAGE = 8

interface Sent {
  readonly kind: 'ok' | 'refused'
  readonly text: string
}

function DealsPane({ origin }: { readonly origin: string }) {
  const [epoch, setEpoch] = useState(0)
  const load = useRead(() => fetchDealRegistrations(origin), true, epoch)
  const [regOpen, setRegOpen] = useState(false)
  const [shape, setShape] = useState<0 | 1>(0)
  const [cust, setCust] = useState('')
  const [value, setValue] = useState('')
  /* G3561 (the owner's): the value carries a currency; the form defaults to
     SGD and shows it. */
  const [currency, setCurrency] = useState(DEAL_CURRENCY_DEFAULT)
  const [close, setClose] = useState('')
  const [who, setWho] = useState('')
  const [why, setWhy] = useState('')
  const [scope, setScope] = useState(0)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<Sent | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ readonly key: SortKey; readonly dir: 1 | -1 }>({ key: 'registeredAt', dir: -1 })
  const [page, setPage] = useState(0)
  /* G3522 — each portal write is drawn only for a session holding its verb. */
  const mayRegister = useHolds(DRAW_GATES.registerDeal)

  const amount = dealValueOf(value, currency)
  const request: DealRegistrationRequest | null = useMemo(() => {
    const company = cust.trim()
    if (company === '') return null
    if (shape === 0) {
      if (amount === null || close.trim() === '') return null
      return {
        shape: 'deal',
        company,
        annualValue: amount,
        expectedClose: close.trim(),
        ...(who.trim() === '' ? {} : { contact: who.trim() }),
      }
    }
    const picked = RESALE_SCOPES[scope]
    if (why.trim() === '' || picked === undefined) return null
    return { shape: 'customer_claim', company, rationale: why.trim(), resaleScope: [picked] }
  }, [cust, shape, amount, close, who, why, scope])
  /* NP-03 (G3705): a currency the browser's ISO 4217 data refuses is invalid
     too, not only one that is not three letters. */
  const currencyBad = exponentOf(currency) === null
  const valueBad = !currencyBad && value.trim() !== '' && amount === null

  const send = (): void => {
    if (request === null || sending) return
    setSending(true)
    submitDealRegistration(origin, request)
      .then(() => {
        /* NP-04 (G3706): the receipt echoes the amount and its currency, so a
           mistyped USD can be caught after submit — the table has no value column. */
        const figure = request.shape === 'deal' ? moneyFigure(request.annualValue) : null
        const worth = figure === null ? '' : `, ${figure.unit} ${figure.figure} a year`
        setSent({
          kind: 'ok',
          text:
            `Received ${request.shape === 'deal' ? 'as a deal' : 'as a customer claim'} on ${request.company}${worth}. ` +
            'It is a request until we accept it, and the time we received it is what decides precedence if ' +
            'somebody else claims the same company. Nothing is registered yet.',
        })
        setRegOpen(false)
        setCust('')
        setValue('')
        setCurrency(DEAL_CURRENCY_DEFAULT)
        setClose('')
        setWho('')
        setWhy('')
        setEpoch((n) => n + 1)
      })
      .catch((err: unknown) => {
        const status = err instanceof PlaneRefused ? err.status : 503
        setSent({
          kind: 'refused',
          text:
            status === 422
              ? `Refused. Either a claim already stands on ${request.company}, or the fields did not fit the shape ` +
                'you chose. We never say whose claim it is — a registry that named the holder would be a map of ' +
                'everyone’s pipeline. If you believe the relationship is yours, raise it with your partner manager ' +
                'and we will read both sides.'
              : status === 403
                ? 'Refused. Your role here does not register deals.'
                : 'Not sent — the registry could not be reached. Nothing was received; try again in a few minutes.',
        })
        if (status === 422) setRegOpen(false)
      })
      .finally(() => { setSending(false) })
  }

  const rows = load.phase === 'read' ? load.value : []
  const counts = {
    accepted: rows.filter((r) => r.standing === 'accepted').length,
    waiting: rows.filter((r) => r.standing === 'waiting').length,
    dormant: rows.filter((r) => r.standing === 'dormant').length,
  }
  const needle = query.trim().toLowerCase()
  const shown = rows
    .filter((r) =>
      needle === ''
        ? true
        : [r.company, SHAPE_LABEL[r.shape] ?? r.shape, STANDING_LABEL[r.standing] ?? r.standing]
            .join(' ')
            .toLowerCase()
            .includes(needle),
    )
    .slice()
    .sort((a, b) => {
      const av = sortValue(a, sort.key)
      const bv = sortValue(b, sort.key)
      return av < bv ? -sort.dir : av > bv ? sort.dir : 0
    })
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE))
  const at = Math.min(page, pages - 1)
  const pageRows = shown.slice(at * PER_PAGE, at * PER_PAGE + PER_PAGE)

  return (
    <div className="pane" data-partner-pane="deals">
      <div>
        <div className="paneh">
          <PaneHead>Registered deals · a claim is a request until we accept it</PaneHead>
          {mayRegister ? (
            <button
              className="abtn"
              type="button"
              aria-pressed={regOpen}
              data-register-open=""
              onClick={() => { setRegOpen((o) => !o); setSent(null) }}
            >
              Register a deal
            </button>
          ) : null}
        </div>
        <div className="figs mt4">
          {/* RP-07: while the read is out a figure is EMPTY and says it is
              reading; `—` stays the pack's mark for "not measured". */}
          {/* RP-07 (G3704): a read that FAILED is not one still out — the
              figures say they were not read, rather than "reading" for ever. */}
          <Fig k="Accepted claims" v={load.phase === 'read' ? String(counts.accepted) : null} unread={load.phase === 'refused'} />
          <Fig k="Waiting on us" v={load.phase === 'read' ? String(counts.waiting) : null} unread={load.phase === 'refused'} />
          <Fig k="Dormant" v={load.phase === 'read' ? String(counts.dormant) : null} unread={load.phase === 'refused'} />
          <Soon className="fig">
            <span className="k">Matched to a lead</span>
            <span className="v">—</span>
          </Soon>
        </div>
        <p className="q mt3">
          A registration is the one thing this portal writes, and it is a request: we accept it, and only then can
          a later lead be matched against it.
        </p>
      </div>

      {regOpen ? (
        <div className="reasons" data-register-form="">
          <span className="lab flat">Two ways to claim a deal · pick one and the form changes</span>
          <div className="fac">
            {(['A deal', 'A customer'] as const).map((label, i) => (
              <button
                key={label}
                className="choice"
                type="button"
                aria-pressed={shape === i}
                data-shape={i === 0 ? 'deal' : 'customer_claim'}
                onClick={() => { setShape(i === 0 ? 0 : 1) }}
              >
                <span>{label}</span>
                <span className="to">{i === 0 ? 'customer · value · close date' : 'the relationship, no expiry'}</span>
              </button>
            ))}
          </div>

          {shape === 0 ? (
            <div className="drop lefted">
              <b>A deal, as your pipeline holds it</b>
              <p className="mt2">
                What you are claiming is a specific opportunity: this customer, this size, closing around this date. It
                reads like your CRM because that is where it also lands.
              </p>
              <div className="pfields">
                <label>
                  <span className="lab flat">Customer</span>
                  <input type="text" name="company" value={cust} onChange={(e) => { setCust(e.target.value) }} placeholder="registered company name" />
                </label>
                <div data-deal-value="">
                  {/* RP-08a: the pack's own label, "Deal value, SGD a year".
                      NP-04 (G3706): the currency is stated ONCE — it IS the
                      label's middle word, an editable three-letter field, so
                      the separate Currency field that repeated it is gone. */}
                  <span className="lab flat" id="deal-value-lab" data-value-label="">
                    Deal value,{' '}
                    <input
                      className="cur"
                      type="text"
                      name="currency"
                      value={currency}
                      maxLength={3}
                      size={3}
                      autoCapitalize="characters"
                      spellCheck={false}
                      aria-label="Currency, three letters"
                      aria-invalid={currencyBad}
                      aria-describedby={currencyBad ? 'deal-value-note' : undefined}
                      onChange={(e) => { setCurrency(e.target.value.toUpperCase()) }}
                    />{' '}
                    a year
                  </span>
                  <input
                    type="text"
                    name="annualValue"
                    inputMode="decimal"
                    value={value}
                    aria-labelledby="deal-value-lab"
                    aria-invalid={valueBad}
                    aria-describedby={valueBad ? 'deal-value-note' : undefined}
                    onChange={(e) => { setValue(e.target.value) }}
                    placeholder="e.g. 180,000"
                  />
                  {/* NP-03 (G3705): a value the codec refuses says why, beside
                      the field, rather than greying Submit with no word. */}
                  {currencyBad || valueBad ? (
                    <p className="fieldnote" id="deal-value-note" role="alert" data-value-note="">
                      {currencyBad
                        ? 'The currency is three letters, e.g. SGD or USD.'
                        : `A positive amount in ${currency}, e.g. 180,000${
                            (exponentOf(currency) ?? 0) > 0 ? `, with at most ${String(exponentOf(currency))} decimal places` : ', with no decimals'
                          }.`}
                    </p>
                  ) : null}
                </div>
                <label>
                  <span className="lab flat">Expected close</span>
                  <input type="text" name="expectedClose" value={close} onChange={(e) => { setClose(e.target.value) }} placeholder="e.g. 30 Nov 2026" />
                </label>
                <label>
                  <span className="lab flat">Your contact there</span>
                  <input type="text" name="contact" value={who} onChange={(e) => { setWho(e.target.value) }} placeholder="name and role" />
                </label>
              </div>
            </div>
          ) : (
            <div className="drop lefted">
              <b>A customer you are protecting</b>
              <p className="mt2">
                What you are claiming is the relationship, not one opportunity in it. No value, no close date — a claim
                that can hold while the deal changes shape, and which any later lead from that company is matched
                against.
              </p>
              <div className="pfields">
                <label>
                  <span className="lab flat">Customer</span>
                  <input type="text" name="company" value={cust} onChange={(e) => { setCust(e.target.value) }} placeholder="registered company name" />
                </label>
                <label>
                  <span className="lab flat">Why you, in one line</span>
                  <input type="text" name="rationale" value={why} onChange={(e) => { setWhy(e.target.value) }} placeholder="the relationship you are claiming on" />
                </label>
                <div>
                  <span className="lab flat">What you are selling into</span>
                  <div className="fac">
                    {RESALE_SCOPES.map((label, i) => (
                      <button key={label} className="choice" type="button" aria-pressed={scope === i} onClick={() => { setScope(i) }}>
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <p className="note">
                A claim does not expire. It goes <b>dormant</b> when nothing happens on it, and dormancy is shown to us
                and to you — so a registry nobody works stops reading like a registry somebody owns.
              </p>
            </div>
          )}

          <div className="acts">
            <button
              className="abtn"
              type="button"
              data-commit=""
              data-register-send=""
              aria-disabled={request === null || sending}
              onClick={send}
            >
              {sending ? 'Submitting the claim' : 'Submit the claim'}
            </button>
            <button className="abtn" type="button" onClick={() => { setRegOpen(false) }}>Cancel</button>
          </div>
        </div>
      ) : null}

      {sent === null ? null : <Result kind={sent.kind}>{sent.text}</Result>}

      <span className="lab flat" id="claims-cap">
        Your claims · what we have accepted, and what is going quiet
      </span>

      <div className="tbar">
        <label className="tsearch">
          <span className="sr-only">Search your claims</span>
          <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0) }} placeholder="Search these rows" />
        </label>
        <Soon className="abtn">Filter</Soon>
        <span className="tcount" role="status">
          {load.phase === 'read'
            ? needle === ''
              ? `${String(rows.length)} ${rows.length === 1 ? 'row' : 'rows'}`
              : `${String(shown.length)} of ${String(rows.length)}`
            : ''}
        </span>
        {pages > 1 ? (
          <div className="tpager">
            {/* RP-08d — THE OWNER'S RULING (4 Oct 2026, G3712): *"Keep words:
                Previous / Next."* The pack's pager draws `‹` `›`, and `›` is this
                tree's YOUR-MOVE grammar mark (indicator-roster §4 refuses it typed
                anywhere else), so the pager keeps its words. G3570 derived it;
                the ruling settles it. */}
            <button type="button" aria-disabled={at === 0} onClick={() => { if (at > 0) setPage(at - 1) }}>Previous</button>
            <span className="tpageline">{at + 1} of {pages}</span>
            <button type="button" aria-disabled={at >= pages - 1} onClick={() => { if (at < pages - 1) setPage(at + 1) }}>Next</button>
          </div>
        ) : null}
      </div>

      {load.phase === 'read' ? (
        rows.length === 0 ? (
          <p className="tempty" role="status" data-claims-empty="">
            You have not registered a deal yet. A claim you register appears here, waiting on us until we accept it.
          </p>
        ) : (
          <>
            <div className="scroller">
              <table className="tbl" aria-describedby="claims-cap" data-claims="">
                <caption className="sr-only">Your registered claims, sortable by column</caption>
                <thead>
                  <tr>
                    {COLUMNS.map((c) => {
                      const on = sort.key === c.key
                      return (
                        <th key={c.key} scope="col" aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                          <button
                            className="tsort"
                            type="button"
                            onClick={() => { setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : 1 })) }}
                          >
                            {c.label}
                            <span className="ind" aria-hidden="true">{on ? (sort.dir === 1 ? '↑' : '↓') : ''}</span>
                          </button>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r.registrationId} data-registration={r.registrationId}>
                      <th scope="row">{r.company}</th>
                      <td>{SHAPE_LABEL[r.shape] ?? r.shape}</td>
                      <td className="mono">{dateOf(r.registeredAt)}</td>
                      <td className="mono">{r.lastActivityAt === null ? '—' : dateOf(r.lastActivityAt)}</td>
                      <td>
                        <span className={STALE_STANDINGS.has(r.standing) ? 'chip stale' : 'chip'}>
                          {STANDING_LABEL[r.standing] ?? r.standing}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {shown.length === 0 ? (
              <p className="tempty" role="status">No claim matches “{query.trim()}”.</p>
            ) : null}
          </>
        )
      ) : (
        <Unread load={load} what="your claims" />
      )}

      <div className="sheet-note">
        <span className="lab flat">Precedence, stated</span>
        <p>
          The <b>first accepted registration wins</b>. Register a customer somebody already holds and you are told a
          claim exists — <b>never who holds it</b>, because that would turn the registry into a map of each other’s
          pipelines. You will see the refusal, not the rival.
        </p>
      </div>
    </div>
  )
}

function sortValue(r: DealRegistration, key: SortKey): string {
  if (key === 'lastActivityAt') return r.lastActivityAt ?? ''
  if (key === 'company') return r.company.toLowerCase()
  return r[key]
}

function Fig({
  k,
  v,
  sm = false,
  unread = false,
}: {
  readonly k: string
  readonly v: string | null
  readonly sm?: boolean
  /** RP-07 (G3704): the read was refused, so the value is NOT measured — not "reading". */
  readonly unread?: boolean
}) {
  if (v === null && unread) {
    return (
      <span className="fig" data-unread="">
        <span className="k">{k}</span>
        <span className="v unread">
          <span aria-hidden="true">—</span>
          <span className="sr-only">not read</span>
        </span>
      </span>
    )
  }
  return (
    <span className="fig" {...(v === null ? { 'aria-busy': true } : {})}>
      <span className="k">{k}</span>
      {v === null ? (
        <span className="v" data-reading="">
          {'\u00a0'}<span className="sr-only">reading</span>
        </span>
      ) : (
        <span className={sm ? 'v sm' : 'v'}>{v}</span>
      )}
    </span>
  )
}

/* ═══ THE SANDBOX · THE ONE TENANT A PARTNER OWNS ═════════════════════════ */

function SandboxPane({ origin }: { readonly origin: string }) {
  const [epoch, setEpoch] = useState(0)
  const load = useRead(() => fetchSandbox(origin), true, epoch)
  const mayOperate = useHolds(DRAW_GATES.operateSandbox)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<Sent | null>(null)

  const ask = (): void => {
    if (sending) return
    setSending(true)
    requestSandbox(origin)
      .then(() => {
        setSent({
          kind: 'ok',
          text:
            'Requested. A person at 1CloudHub provisions it — about two days — in your own AWS account, and it ' +
            'appears here when it is live.',
        })
        setEpoch((n) => n + 1)
      })
      .catch((err: unknown) => {
        const status = err instanceof PlaneRefused ? err.status : 503
        /* NP-01 (G3701): a 409 means a request already stands — read again, so
           the pane draws the pending request rather than the ask. */
        if (status === 409) setEpoch((n) => n + 1)
        setSent({
          kind: status === 409 ? 'ok' : 'refused',
          text:
            status === 409
              ? 'You have already asked for one. A person at 1CloudHub provisions it, and it appears here when it is live.'
              : status === 403
                ? 'Refused. Your role here does not ask for a sandbox.'
                : 'Not sent — the request could not be reached. Nothing was asked for; try again in a few minutes.',
        })
      })
      .finally(() => { setSending(false) })
  }

  if (load.phase !== 'read') {
    return (
      <div className="pane" data-partner-pane="sandbox">
        <PaneHead>Your demo tenant</PaneHead>
        <Unread load={load} what="the sandbox" />
      </div>
    )
  }
  const s: SandboxView = load.value
  if (s.standing === 'live') {
    return (
      <div className="pane" data-partner-pane="sandbox" data-sandbox="live">
        <div>
          <PaneHead>Your demo tenant · a tenant like any other, and it is yours</PaneHead>
          <p className="mt3">
            This is the one tenant your people can sign into, because nothing in it belongs to a customer. It runs in{' '}
            <b>your own AWS account</b>, seeded with a story we keep current, so a demo shows the product reading
            real-looking documents rather than a slide of screenshots. Sign in to it at its own address, as you would
            any tenant.
          </p>
          <div className="figs mt4">
            <Fig k="Standing" v="live" />
            {s.seedVersion === null ? null : <Fig k="Seeded story" v={s.seedVersion} />}
            {s.nextResetAt === null ? null : <Fig k="Next automatic reset" v={dateOf(s.nextResetAt)} />}
            {/* RP-11: drawn quiet — no served operation prices the sandbox. */}
            <Soon className="fig">
              <span className="k">This month, wholesale</span>
              <span className="v">—</span>
            </Soon>
          </div>
          {s.awsAccountId === null ? null : (
            <p className="q mt3">
              Runs in your AWS account <span className="mono">{s.awsAccountId}</span>
              {s.residency === null ? '' : `, ${s.residency}`} — a different account from every production tenant you
              hold, so nothing in one can reach the other.
            </p>
          )}
        </div>

        <div>
          <div className="paneh">
            <span className="lab">Documents you have loaded · purged at the next reset</span>
            <Soon className="abtn">Reset it now</Soon>
          </div>
          <p>Documents loaded into the sandbox are read inside it, where you sign in to it — never on this portal.</p>
        </div>

        {/* RP-11: the pack draws these two sections on the live sandbox. Neither
            is served — no operation reads the tenant's boundaries or who at the
            firm reaches it — so each is drawn as its heading and a quiet line,
            rather than left out or filled with the pack's synthetic rows. */}
        <div data-sandbox-quiet="refuses">
          <span className="lab">What the sandbox refuses, so a demo cannot become a leak</span>
          <p className="q">Not shown here yet: nothing this portal can read states the tenant’s boundaries.</p>
        </div>

        <div data-sandbox-quiet="who">
          <span className="lab">Who at your firm can reach it</span>
          <p className="q">Not shown here yet: nothing this portal can read lists who reaches the sandbox.</p>
        </div>

        <div>
          <div className="paneh">
            <span className="lab">A prospect who wants to try it themselves</span>
            <Soon className="abtn">Request a trial tenant</Soon>
          </div>
          <p className="mt3">
            Do not put a prospect in your sandbox. Ask us for a <b>trial tenant in their name</b>: we create it, your
            registration attributes it to you, and you cannot sign into it — the same boundary that holds for every
            customer you sell.
          </p>
        </div>

        <div>
          <div className="paneh">
            <span className="lab">If you no longer want it</span>
            <Soon className="abtn">Hand it back</Soon>
          </div>
          <p className="mt3">
            The sandbox is optional and it bills. Handing it back tears down the tenant in your account and stops the
            line on your statement; asking for it again is a provisioning step, not a switch.
          </p>
        </div>
      </div>
    )
  }
  if (s.standing === 'requested') {
    /* NP-01 — THE OWNER'S RULING (4 Oct 2026, G3701): *"Report 'requested':
       getSandboxTenant gains a 'requested' state (contract change) and the
       portal shows the pending request."* The firm asked and nobody has
       provisioned it yet: the 202's own sentence, and no *Ask for one* —
       a second ask could only be the 409. */
    return (
      <div className="pane" data-partner-pane="sandbox" data-sandbox="requested">
        <div>
          <div className="paneh">
            <PaneHead>Your demo tenant · requested</PaneHead>
          </div>
          <div className="result" role="status" data-sandbox-requested="">
            Requested{s.requestedAt === null ? '' : ` on ${dateOf(s.requestedAt)}`}. A person at 1CloudHub provisions
            it — about two days — in your own AWS account, and it appears here when it is live.
          </div>
          <div className="figs mt4">
            <Fig k="Runs in" v="your account" sm />
            <Fig k="Set-up" v="about 2 days" sm />
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="pane" data-partner-pane="sandbox" data-sandbox="none">
      <div>
        <div className="paneh">
          <PaneHead>You do not have a demo tenant</PaneHead>
          {mayOperate ? (
            <button className="abtn" type="button" data-commit="" data-sandbox-ask="" aria-disabled={sending} onClick={ask}>
              {sending ? 'Asking' : 'Ask for one'}
            </button>
          ) : null}
        </div>
        <p className="mt3">
          It was offered when your agreement was signed and it stays available. A sandbox is a{' '}
          <b>tenant in your own AWS account</b>, seeded with a story we keep current, that your sales people can sign
          into and demo from — the only tenant any partner user reaches, because nothing in it belongs to a customer.
          It is optional, and it bills at your wholesale card like any other tenant.
        </p>
        <div className="figs mt4">
          {/* RP-10: prose is not a figure — the small value, as staff draws it. */}
          <Fig k="Runs in" v="your account" sm />
          <Fig k="Set-up" v="about 2 days" sm />
        </div>
        {sent === null ? null : <Result kind={sent.kind}>{sent.text}</Result>}
      </div>
    </div>
  )
}

/* ═══ PEOPLE ═══════════════════════════════════════════════════════════════ */

const ROLE_CHOICE: { readonly [R in InvitableRole]: { readonly label: string; readonly meta: string } } = {
  partner_administrator: { label: 'Partner administrator', meta: 'commercials and people' },
  partner_user: { label: 'Partner user', meta: 'deals, tenants, cases' },
}
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function PeoplePane({
  origin,
  roster,
  onChanged,
}: {
  readonly origin: string
  readonly roster: Load<PartnerRoster>
  readonly onChanged: () => void
}) {
  const [invOpen, setInvOpen] = useState(false)
  const mayManage = useHolds(DRAW_GATES.managePartnerStaff)
  const [mail, setMail] = useState('')
  const [role, setRole] = useState<InvitableRole>('partner_user')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<Sent | null>(null)
  const ready = EMAIL_SHAPE.test(mail.trim())

  const send = (): void => {
    if (!ready || sending) return
    const email = mail.trim()
    setSending(true)
    invitePartnerPerson(origin, { email, role })
      .then(() => {
        setSent({
          kind: 'ok',
          text:
            `Invitation sent to ${email}. They sign in with your own identity provider, so their account stays ` +
            'yours to disable; what we hold is the role they carry on this portal and nothing else.',
        })
        setInvOpen(false)
        setMail('')
        onChanged()
      })
      .catch((err: unknown) => {
        const status = err instanceof PlaneRefused ? err.status : 503
        setSent({
          kind: 'refused',
          text:
            status === 403
              ? 'Refused. An invitation may confer only what you yourself carry, and never to your own address.'
              : status === 422
                ? `Not sent. An invitation to ${email} may already stand, or this firm does not offer that role.`
                : 'Not sent — the roster could not be reached. Nothing was offered; try again in a few minutes.',
        })
      })
      .finally(() => { setSending(false) })
  }

  return (
    <div className="pane" data-partner-pane="people">
      <div>
        <div className="paneh">
          <PaneHead>People · who at your firm sees this portal</PaneHead>
          {mayManage ? (
            <button className="abtn" type="button" aria-pressed={invOpen} data-invite-open="" onClick={() => { setInvOpen((o) => !o); setSent(null) }}>
              Invite someone
            </button>
          ) : null}
        </div>
        <p className="mt3">
          An invitation reaches this portal and nothing else. Your people sign in with your own organisation’s identity
          provider, so you add and remove them where you already manage everyone — we only hold what role they carry
          here.
        </p>
      </div>

      {invOpen ? (
        <div className="reasons" data-invite-form="">
          <span className="lab flat">Their work email</span>
          <div className="drop lefted">
            <input type="email" name="email" value={mail} onChange={(e) => { setMail(e.target.value) }} placeholder="them@yourfirm.com" aria-label="Their work email" />
          </div>
          <span className="lab flat">What they carry</span>
          <div className="fac">
            {INVITABLE_ROLES.map((r) => (
              <button key={r} className="choice" type="button" aria-pressed={role === r} data-role={r} onClick={() => { setRole(r) }}>
                <span>{ROLE_CHOICE[r].label}</span>
                <span className="to">{ROLE_CHOICE[r].meta}</span>
              </button>
            ))}
          </div>
          <div className="acts">
            <button className="abtn" type="button" data-commit="" data-invite-send="" aria-disabled={!ready || sending} onClick={send}>
              {sending ? 'Sending the invitation' : 'Send the invitation'}
            </button>
            <button className="abtn" type="button" onClick={() => { setInvOpen(false) }}>Cancel</button>
          </div>
        </div>
      ) : null}

      {sent === null ? null : <Result kind={sent.kind}>{sent.text}</Result>}

      {roster.phase === 'read' ? (
        roster.value.people.length + roster.value.invitations.length === 0 ? (
          <p className="tempty" role="status">Nobody at your firm reaches this portal yet.</p>
        ) : (
          <div className="scroller">
            <table className="tbl" data-people="">
              <caption className="sr-only">Who at your firm reaches this portal</caption>
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  <th scope="col">Carries</th>
                  <th scope="col">Reaches</th>
                  <th scope="col">Standing</th>
                </tr>
              </thead>
              <tbody>
                {roster.value.people.map((p) => (
                  <tr key={`p-${p.email}`} data-person={p.email}>
                    <th scope="row">
                      {p.name}
                      <span className="q sub">{p.email}</span>
                    </th>
                    <td>{p.role}</td>
                    <td>{p.reaches ?? '—'}</td>
                    <td><span className="chip">{p.state}</span></td>
                  </tr>
                ))}
                {roster.value.invitations.map((i) => (
                  <tr key={`i-${i.email}`} data-invitation={i.email}>
                    <th scope="row">{i.email}</th>
                    <td>{i.role}</td>
                    <td>—</td>
                    <td><span className="chip">invited · not signed in</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <Unread load={roster} what="your firm’s people" />
      )}
    </div>
  )
}

/* ═══ THE PORTAL ═══════════════════════════════════════════════════════════ */

export function PartnerPortal({ origin, dest, links, switcher, principal = null }: PartnerPortalProps) {
  /* The roster is read on every pane, because its answer decides which
     destinations the chrome draws: 200 is an administrator, 403 is not. */
  const [rosterEpoch, setRosterEpoch] = useState(0)
  const roster = useRead(() => fetchPartnerPeople(origin), true, rosterEpoch)
  const admin = roster.phase === 'read'
  const settled = roster.phase !== 'reading'
  /* NP-02 (G3703): only 200 and 403 name a role; any other refusal is UNREAD. */
  const roleKnown = admin || (roster.phase === 'refused' && roster.status === 403)

  /* A 401 on the roster read means no session reached this host — the portal
     is not drawn at all, and E1's 401 says so on the public shell. */
  if (roster.phase === 'refused' && roster.status === 401) {
    /* RC-28 (G3481): "no session", never the service's own code. */
    return routeRoot(<ErrorPage code="401" quote="no session" />)
  }

  const pane =
    dest === 'sandbox' ? (
      <SandboxPane origin={origin} />
    ) : dest === 'people' ? (
      roster.phase === 'refused' && roster.status === 403 ? (
        <div className="pane" data-partner-pane="people">
          <PaneHead>People</PaneHead>
          <Unread load={roster} what="your firm’s people" />
        </div>
      ) : (
        <PeoplePane origin={origin} roster={roster} onChanged={() => { setRosterEpoch((n) => n + 1) }} />
      )
    ) : (
      <DealsPane origin={origin} />
    )

  const who = `${principal === null ? 'Signed in' : principal.displayName} · ${servedRoleLine(principal?.roles, roleLineOf(admin, settled, roleKnown))}`

  /* The chrome sits OUTSIDE the route root, as it does beside the register: a
     route change moves focus to the pane, never to the bar. */
  return (
    <div className="app" data-partner-portal={dest}>
      {/* RP-05 (G3568): the pack's skip link and page heading
          (`P1 Partner.dc.html`: `<a class="skip" href="#work">` and the sr-only
          h1). The skip link is the first focusable element on the page. */}
      <SkipLink target={WORK_ID}>Skip to the work</SkipLink>
      <h1 className="sr-only">Reconcile AI · partner portal</h1>
      <PartnerChrome dest={dest} links={links} admin={admin} settled={settled} roleKnown={roleKnown} switcher={switcher} principal={principal} />
      {routeRoot(
        <div className="portal">
          {pane}
          {/* RP-08e: the pack's order — firm · control plane · person · role —
              with the unserved values (period, cards) dropped, and the role
              inline rather than pushed to the right edge. */}
          {/* U-27 (G4181): the same narrow row and sheet as Close — one
              implementation, `StatusGrammar.tsx`. The row shows the
              provenance slot: the plane, and that it carries no tenant data. */}
          <StatusGrammar
            bar={
              <>
                <span className="bit">Your firm · partner portal</span>
                <span className="bit">
                  control plane · <b>no tenant data on this surface</b>
                </span>
                <span className="bit" data-status-who="">{who}</span>
              </>
            }
            row={<>Provenance · <b>control plane</b> · no tenant data on this surface</>}
            sheet={[
              { name: 'entity', content: 'Your firm · partner portal' },
              { name: 'plane', content: <>control plane · <b>no tenant data on this surface</b></> },
              { name: 'who', content: who },
            ]}
          />
        </div>,
      )}
      <PartnerTabBar dest={dest} links={links} admin={admin} />
    </div>
  )
}
