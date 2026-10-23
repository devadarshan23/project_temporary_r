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
import {
  MIN_FORCE_REASON,
  completeStep,
  fetchOnboarding,
  fetchTenants,
  forceStep,
  signOutHere,
  type OnboardingStep,
  type StepState,
  type TenantSummary,
} from '../api/console.ts'
import type { SessionPrincipal } from '../api/principal.ts'
import { PlaneRefused } from '../api/runs.ts'
import { ROUTE_ROOT_PROPS } from '../routes/screens.ts'

/**
 * THE 1CLOUDHUB STAFF CONSOLE — `docs/handoff-pack/S1 Staff.dc.html`, drawn on
 * the console host (G3321–G3330, 3 Oct 2026).
 *
 * Measured on staging the same day: a staff person signing in on
 * `console.reconcileai.app` landed on `/` and was shown the tenant shell's
 * unbuilt-entry placeholder. There was no staff console at all.
 *
 * WHAT IS REAL, AND WHERE EACH VALUE COMES FROM:
 *   · H1, the tenancy — `listTenants`. Every row, its mode, residency, plan,
 *     support access and the stage the plane DERIVES from the stored step
 *     count. The figures above the table are counted from those rows.
 *   · H2, one tenant's onboarding — `listOnboardingSteps`, and the two acts on
 *     it: `completeOnboardingStep` (Mark done, on the one `next` step) and
 *     `forceOnboardingStep` (Force it, with a reason, on a blocked one).
 *   · Sign out — `signOut`, on this host.
 *
 * WHAT IS DRAWN AND NOT SERVED, each a quiet `<Soon>` under G3091: Catalogue,
 * Agent builder, the palette, Needs you, the billing period, Create a tenant,
 * and the tenant record's floor, tags, licence and amendment sections. The
 * destinations the pack gives to OTHER staff roles — Billing, Partners,
 * Support — are ABSENT rather than disabled, which is the pack's own rule:
 * *"A DESTINATION THE ROLE DOES NOT NEED IS ABSENT, not disabled."*
 *
 * 🛑 BEING STAFF IS NOT ACCESS (invariant 8). Nothing here reads INSIDE a
 * tenant: the roster is the control plane's delivery record of which tenants
 * exist and where each has got to, and every act is gated by the plane on the
 * caller's platform role. A refusal is drawn where the act was asked.
 */

/* ═══ COPY THE PACK DRAWS, KEYED ON WIRE VALUES ═════════════════════════════
   A value the plane sends that is not in one of these maps is drawn as sent,
   never translated into something invented. */

const MODE_LABEL: Readonly<Record<string, string>> = { hosted: 'hosted', byoa: 'BYOA' }
const ACCESS_LABEL: Readonly<Record<string, string>> = {
  granted_only: 'on a grant',
  granted_with_customer_approval: 'on a grant, with their approval',
  never: 'never',
}
/** `S1`'s `STEPS[i].note`, keyed on the step the plane names. */
const STEP_NOTE: Readonly<Record<string, string>> = {
  tenant_record: 'mode, residency, retention, support access',
  tag_policy: 'the vocabulary is theirs; one key drives chargeback',
  sources_bound: 'we declare the source; the credential is theirs',
  pack_installed: 'a pack names roles; the install binds them',
  extraction_floor: 'after the first real documents, never before',
  first_run: 'and the tenant becomes billable',
}
const STATE_LABEL: { readonly [S in StepState]: string } = {
  blocked: 'blocked',
  next: 'next',
  done: 'done',
  done_forced: 'done · forced',
}

const labelOf = (map: Readonly<Record<string, string>>, v: string): string =>
  Object.hasOwn(map, v) ? (map[v] ?? v) : v

const stageLabel = (t: TenantSummary): string => t.stageNote === undefined ? t.stage : `${t.stage} · ${t.stageNote}`

/* ═══ LOAD STATES ═══════════════════════════════════════════════════════════ */

type Fail = { readonly phase: 'no-session' } | { readonly phase: 'forbidden' } | { readonly phase: 'refused'; readonly status: number | null }

function failOf(err: unknown): Fail {
  if (err instanceof PlaneRefused && err.status === 401) return { phase: 'no-session' }
  if (err instanceof PlaneRefused && err.status === 403) return { phase: 'forbidden' }
  return { phase: 'refused', status: err instanceof PlaneRefused ? err.status : null }
}

type RosterLoad = { readonly phase: 'reading' } | { readonly phase: 'read'; readonly tenants: readonly TenantSummary[] } | Fail
type StepsLoad =
  | { readonly phase: 'reading' }
  | { readonly phase: 'read'; readonly steps: readonly OnboardingStep[] }
  | { readonly phase: 'not-found' }
  | Fail

type Outcome = { readonly ok: boolean; readonly line: string } | null

/* ═══ THE CHROME ═══════════════════════════════════════════════════════════ */

export interface StaffChromeProps {
  readonly onTenants: () => void
  readonly inTenants: boolean
  /** The STAGING profile switcher, passed only by a test build (G3003). */
  readonly switcher?: ReactNode
  /**
   * WHO IS SIGNED IN — `getSessionPrincipal` (G3354), or `null` while unread
   * or unreadable (G3373). The person is drawn as their directory stored them,
   * as a TEXT NODE (D6-9); `orgClass` is the plane's, via `orgFor()`. A console
   * session binds no tenant (G726), so no tenant is drawn unless the plane
   * names one. ⚠️ THE CHROME SAID *"Signed in · 1CloudHub staff"* UNTIL THE
   * INTEGRATION WIRED THIS — #538 landed before #543's read existed.
   */
  readonly principal?: SessionPrincipal | null
}

/** "1CloudHub staff" is the PLATFORM org's own label; any other class is drawn as the plane sent it. */
const ORG_LABEL: Readonly<Record<string, string>> = { platform: '1CloudHub staff' }

export function StaffChrome({ onTenants, inTenants, switcher, principal = null }: StaffChromeProps) {
  const org = principal === null ? '1CloudHub staff' : labelOf(ORG_LABEL, principal.orgClass)
  const tenant = principal?.tenant ?? null
  const [leaving, setLeaving] = useState(false)
  const signOut = (): void => {
    setLeaving(true)
    void signOutHere().then(() => { window.location.assign('/signin') })
  }
  const toTenants = (e: { preventDefault(): void }): void => {
    e.preventDefault()
    onTenants()
  }
  /* NS-01 (G3710): the partner bar's drop order — the quiet destinations
     collapse behind a `+N` before the built one is ever clipped. */
  const dests = useRef<HTMLUListElement | null>(null)
  const dropped = useQuietDrop(dests, 'staff')
  return (
    <header className="chrome" data-chrome="" data-staff-chrome="">
      <a className="mark" href="/" onClick={toTenants} aria-label="Reconcile AI — the staff console">
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
      <span className="tenant">
        1CloudHub<span className="cc">staff console</span>
      </span>
      <nav aria-label="Destinations">
        <ul className="dests" ref={dests} data-quiet-dropped={dropped}>
          <li data-built="">
            <a href="/" onClick={toTenants} aria-current={inTenants ? 'page' : undefined} data-dest="tenants">
              Tenants
            </a>
          </li>
          <li data-quiet=""><Soon as="link">Catalogue</Soon></li>
          <li data-quiet=""><Soon as="link">Agent builder</Soon></li>
          <li data-more="" hidden={dropped === 0}>
            <Soon as="link" label={`${String(dropped)} more ${dropped === 1 ? 'destination' : 'destinations'}, not built yet`}>
              +{dropped}
            </Soon>
          </li>
        </ul>
      </nav>
      <span className="sp" />
      <Soon className="palbtn" label="Find a tenant, go, or do — command palette">
        <span>Find a tenant, go, or do</span>
        <kbd>⌘K</kbd>
      </Soon>
      <Soon className="abtn">Needs you</Soon>
      {/* RS-05 (G3584): the pack's two parts — the period, then the label —
          with the period `—` because no served operation names one. */}
      <Soon className="abtn period" label="Billing period">
        <span className="mono">—</span>
        <span className="q">billing period</span>
      </Soon>
      <AccountMenu>
        <summary className="whoami" aria-haspopup="menu">
          {/* N-04 (G3484, the owner's): two initials from the stored name; `·`
              only when there is none. */}
          <span className="init" aria-hidden="true">{initialsOf(principal?.displayName)}</span>
          {principal === null ? (
            <span>
              Signed in<span className="sub">1CloudHub staff</span>
            </span>
          ) : (
            <span data-whoami="">
              {principal.displayName}
              <span className="sub" data-role-line="">{servedRoleLine(principal.roles, org)}</span>
            </span>
          )}
          <span className="sr-only">Account menu</span>
        </summary>
        <ul className="acctmenu" role="menu" aria-label="Account">
          <li className="acctwho" role="none">
            <b>{principal === null ? 'Signed in' : principal.displayName}</b>
            {principal === null ? null : <span data-whoami-email="">{principal.email}</span>}
            <span>
              {tenant === null ? '1CloudHub staff console' : (tenant.name ?? tenant.tenantId)}
            </span>
          </li>
          <li role="none"><Soon className="acctitem" menuItem>Profile</Soon></li>
          {/* N-04 — the light/dark/system toggle (G3392), the same component the
              tenant shell's account menu carries. */}
          <li role="none" data-theme-slot=""><ThemeToggle menu /></li>
          <li className="sep" role="separator" />
          <li role="none">
            <button className="acctitem" type="button" role="menuitem" onClick={signOut} aria-disabled={leaving ? 'true' : undefined} data-sign-out="">
              {leaving ? 'Signing out' : 'Sign out'}
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

/* ═══ H1 · THE TENANCY ═════════════════════════════════════════════════════ */

const COLUMNS = [
  { key: 'name', label: 'Tenant', of: (t: TenantSummary) => t.name },
  { key: 'mode', label: 'Mode', of: (t: TenantSummary) => labelOf(MODE_LABEL, t.deploymentMode) },
  { key: 'stage', label: 'Stage', of: (t: TenantSummary) => stageLabel(t) },
  { key: 'plan', label: 'Plan', of: (t: TenantSummary) => t.plan ?? '' },
  { key: 'access', label: 'Support access', of: (t: TenantSummary) => labelOf(ACCESS_LABEL, t.supportAccessMode) },
] as const
type ColumnKey = (typeof COLUMNS)[number]['key']
type Sort = { readonly key: ColumnKey; readonly dir: 'ascending' | 'descending' } | null

/**
 * NP-05 / NS-03 (G3708, G3709) — WHERE KEYBOARD FOCUS LANDS. The skip link and
 * an opened record land on the PANE'S HEADING (a legible thing to ring, where
 * the skip into `main` ringed the whole region); Back returns focus to the row
 * whose *Open* was pressed, rather than dropping it on `<body>`.
 */
const WORK_ID = 'work'

function Tenancy({
  tenants,
  onOpen,
  returnTo = null,
}: {
  readonly tenants: readonly TenantSummary[]
  readonly onOpen: (id: string) => void
  /** NS-03: the tenant whose record was just left; its *Open* takes focus. */
  readonly returnTo?: string | null
}) {
  const table = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (returnTo === null) return
    table.current?.querySelector<HTMLButtonElement>(`[data-open-tenant="${CSS.escape(returnTo)}"]`)?.focus()
  }, [returnTo])
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [stageFilter, setStageFilter] = useState('')

  const stages = useMemo(() => [...new Set(tenants.map((t) => t.stage))].sort(), [tenants])
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const kept = tenants.filter(
      (t) =>
        (stageFilter === '' || t.stage === stageFilter) &&
        (q === '' || COLUMNS.some((c) => c.of(t).toLowerCase().includes(q)) || t.residency.toLowerCase().includes(q)),
    )
    if (sort === null) return kept
    const col = COLUMNS.find((c) => c.key === sort.key)
    if (col === undefined) return kept
    const sign = sort.dir === 'ascending' ? 1 : -1
    return [...kept].sort((a, b) => sign * col.of(a).localeCompare(col.of(b)))
  }, [tenants, query, sort, stageFilter])

  const live = tenants.filter((t) => t.stage === 'live').length
  const onboarding = tenants.filter((t) => t.stage === 'onboarding').length
  const ownAccount = tenants.filter((t) => t.deploymentMode === 'byoa').length
  const narrowed = rows.length !== tenants.length
  const noun = (n: number) => (n === 1 ? 'tenant' : 'tenants')

  return (
    <div className="pane" data-tenancy="">
      <div>
        <div className="paneh">
          <span className="lab" id={WORK_ID} tabIndex={-1}>Tenancy · every tenant, and where each one has got to</span>
          <Soon className="abtn">Create a tenant</Soon>
        </div>
        <div className="figs" style={{ marginTop: 'calc(var(--u)*4)' }}>
          <span className="fig"><span className="k">Live</span><span className="v" data-fig="live">{live}</span></span>
          <span className="fig"><span className="k">Onboarding</span><span className="v" data-fig="onboarding">{onboarding}</span></span>
          {/* RS-08 (G3585): an unmeasured figure is a quiet `<Soon>` (G3092), as
              the partner portal's *Matched to a lead* is — one treatment. */}
          <QuietFig k="Stalled over 14 days" />
          <span className="fig"><span className="k">In their own account</span><span className="v" data-fig="byoa">{ownAccount}</span></span>
        </div>
        <p className="q" style={{ marginTop: 'calc(var(--u)*3)' }}>
          Two of the four choices made at creation are permanent: deployment mode and residency. A customer who
          outgrows either gets a second tenant and a migration, not an amended record.
        </p>
      </div>

      <div ref={table}>
        <div className="tbar">
          <label className="tsearch">
            <span className="sr-only">Search Tenancy</span>
            <input type="search" value={query} onChange={(e) => { setQuery(e.target.value) }} placeholder="Search these rows" />
          </label>
          <button className="abtn" type="button" aria-pressed={filterOpen} onClick={() => { setFilterOpen((o) => !o) }}>
            {filterOpen ? 'Hide filters' : 'Filter'}
          </button>
          <span className="tcount" role="status" data-tenant-count={rows.length}>
            {narrowed ? `${rows.length} of ${tenants.length} ${noun(tenants.length)}` : `${tenants.length} ${noun(tenants.length)}`}
          </span>
        </div>
        {narrowed ? (
          <p className="tnarrow" role="status">
            Showing {rows.length} of {tenants.length}. Clear the search{filterOpen ? ' and the stage filter' : ''} to see every tenant.
          </p>
        ) : null}
        <div className="scroller">
          <table className="tbl">
            <caption className="sr-only">Tenancy, sortable and filterable by column</caption>
            <thead>
              <tr>
                {COLUMNS.map((c) => {
                  const on = sort?.key === c.key ? sort.dir : 'none'
                  return (
                    <th key={c.key} scope="col" aria-sort={on}>
                      <button
                        className="tsort"
                        type="button"
                        onClick={() => {
                          setSort((s) =>
                            s?.key !== c.key ? { key: c.key, dir: 'ascending' } : s.dir === 'ascending' ? { key: c.key, dir: 'descending' } : null,
                          )
                        }}
                      >
                        {c.label}
                        <span className="ind" aria-hidden="true">{on === 'ascending' ? '↑' : on === 'descending' ? '↓' : ''}</span>
                      </button>
                    </th>
                  )
                })}
                <th scope="col"><span className="sr-only">Open</span></th>
              </tr>
              {filterOpen ? (
                <tr className="tfilters">
                  <th scope="col" />
                  <th scope="col" />
                  <th scope="col">
                    <label>
                      <span className="sr-only">Filter by stage</span>
                      <select value={stageFilter} onChange={(e) => { setStageFilter(e.target.value) }}>
                        <option value="">every stage</option>
                        {stages.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </label>
                  </th>
                  <th scope="col" />
                  <th scope="col" />
                  <th scope="col" />
                </tr>
              ) : null}
            </thead>
            <tbody>
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="tempty" data-empty="">
                    No tenants yet. A tenant appears here the moment it is created, with its onboarding at the first step.
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="tempty">Nothing matches. Clear the search to see every tenant.</td>
                </tr>
              ) : (
                rows.map((t) => (
                  <tr key={t.tenantId} data-tenant={t.tenantId}>
                    <th scope="row">
                      {t.name}
                      {t.soldVia === undefined ? null : <span className="q sub">via {t.soldVia}</span>}
                    </th>
                    <td className="mono">
                      {labelOf(MODE_LABEL, t.deploymentMode)}
                      <span className="q sub">{t.residency}</span>
                    </td>
                    <td>
                      <span className="chip" data-stage={t.stage}>{stageLabel(t)}</span>
                    </td>
                    <td className="mono">{t.plan ?? '—'}</td>
                    <td>{labelOf(ACCESS_LABEL, t.supportAccessMode)}</td>
                    <td>
                      <button className="abtn" type="button" onClick={() => { onOpen(t.tenantId) }} data-open-tenant={t.tenantId}>
                        Open<span className="sr-only"> {t.name}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ═══ H2 · ONE TENANT ══════════════════════════════════════════════════════ */

function refusalLine(err: unknown, act: 'done' | 'force'): string {
  if (err instanceof PlaneRefused) {
    if (err.status === 401) return 'Your session has ended. Sign in again to carry on.'
    if (err.status === 403) return 'Your role does not reach this tenant’s onboarding. Nothing was changed.'
    if (err.status === 404) return 'That step is not part of this tenant’s sequence. Nothing was changed.'
    if (err.status === 409) return 'The sequence moved on since this page read it. It is shown again below, as it stands.'
    if (err.status === 422) return `A reason needs at least ${MIN_FORCE_REASON} characters, so a review can read why.`
  }
  return act === 'done'
    ? 'That did not go through. The sequence is read again below, as it stands.'
    : 'The force did not go through. The sequence is read again below, as it stands.'
}

const SECTION_BOX = {
  backgroundColor: 'var(--sheet)',
  boxShadow: 'inset 0 0 0 1px var(--rule)',
  padding: 'calc(var(--u)*4)',
  maxWidth: 'var(--measure-text)',
} as const

/**
 * A FIGURE NOTHING SERVES — G3092's `<Soon>`: muted, `aria-disabled`, and
 * "Coming soon" only as its tooltip (RS-08). The value is the pack's `—`.
 */
function QuietFig({ k }: { readonly k: string }) {
  return (
    <Soon className="fig" label={`${k}, coming soon`}>
      <span className="k">{k}</span>
      <span className="v">—</span>
    </Soon>
  )
}

/**
 * THE PACK'S TABLE, DRAWN QUIET — RS-04 (G3585). G3091 puts "Coming soon" in a
 * TOOLTIP and nowhere else, and this was the one place on any surface that
 * printed it as page copy, in a body row. The headers are the pack's; the one
 * body row is muted `—` per column, the pack's mark for a value not measured,
 * and the table says why in its caption for a screen reader.
 */
function QuietTable({ caption, heads }: { readonly caption: string; readonly heads: readonly string[] }) {
  return (
    <div className="scroller">
      <table className="tbl" data-soon-section="">
        <caption className="sr-only">{caption} — coming soon</caption>
        <thead><tr>{heads.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>
          <tr className="quiet">{heads.map((h) => <td key={h}>—</td>)}</tr>
        </tbody>
      </table>
    </div>
  )
}

function TenantRecord({
  origin,
  tenant,
  onBack,
  focusOnMount = false,
}: {
  readonly origin: string
  readonly tenant: TenantSummary
  readonly onBack: () => void
  /** NS-03: opened by a person (not by a pasted address), so focus follows. */
  readonly focusOnMount?: boolean
}) {
  const [steps, setSteps] = useState<StepsLoad>({ phase: 'reading' })
  const [busy, setBusy] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<Outcome>(null)
  const [forceOn, setForceOn] = useState<OnboardingStep | null>(null)
  /* G3522 — the two onboarding acts are drawn only for a session holding
     their verb (R8 annotated both `view_substrate`); the 403 stays the backstop. */
  const mayAct = useHolds(DRAW_GATES.onboardingAct)
  const [why, setWhy] = useState('')
  /* NS-03 (G3709): opening a record moves focus to its heading. */
  const head = useRef<HTMLSpanElement | null>(null)
  useEffect(() => {
    if (focusOnMount) head.current?.focus()
  }, [focusOnMount])

  const reread = useCallback(() => {
    let live = true
    fetchOnboarding({ origin, tenantId: tenant.tenantId })
      .then((s) => { if (live) setSteps({ phase: 'read', steps: s }) })
      .catch((err: unknown) => {
        if (!live) return
        setSteps(err instanceof PlaneRefused && err.status === 404 ? { phase: 'not-found' } : failOf(err))
      })
    return () => { live = false }
  }, [origin, tenant.tenantId])
  useEffect(() => reread(), [reread])

  const markDone = (step: OnboardingStep): void => {
    setBusy(step.stepKey)
    setOutcome(null)
    completeStep({ origin, tenantId: tenant.tenantId, stepKey: step.stepKey })
      .then((written) => {
        setOutcome({ ok: true, line: `Done. ${written.title} is marked done, and the step after it is now the one that can be done.` })
      })
      .catch((err: unknown) => { setOutcome({ ok: false, line: refusalLine(err, 'done') }) })
      .finally(() => {
        setBusy(null)
        reread()
      })
  }

  const ready = why.trim().length >= MIN_FORCE_REASON
  const commitForce = (): void => {
    if (forceOn === null || !ready) return
    const step = forceOn
    const reason = why.trim()
    setBusy(step.stepKey)
    setOutcome(null)
    forceStep({ origin, tenantId: tenant.tenantId, stepKey: step.stepKey, reason })
      .then((all) => {
        setSteps({ phase: 'read', steps: all })
        setForceOn(null)
        setWhy('')
        setOutcome({
          ok: true,
          line:
            `Forced. ${step.title} is marked done and so is everything above it, because a gate passed out of order does not leave the earlier ones meaningful. ` +
            `This tenant now carries a forced-step mark for the life of the record, and your reason travels with it: “${reason}”`,
        })
      })
      .catch((err: unknown) => {
        setOutcome({ ok: false, line: refusalLine(err, 'force') })
        reread()
      })
      .finally(() => { setBusy(null) })
  }

  return (
    <div className="pane" data-tenant-record={tenant.tenantId}>
      <div>
        <div className="paneh">
          <span className="lab" id={WORK_ID} tabIndex={-1} ref={head}>{tenant.name} · the tenant record</span>
          <button className="abtn" type="button" onClick={onBack} data-back="">Back to tenancy</button>
        </div>
        <div className="figs" style={{ marginTop: 'calc(var(--u)*4)' }}>
          {/* RS-07 (G3586): S1's five, in S1's order — Mode · Residency ·
              Retention · Support access · Plan. Retention is not served, so it
              is drawn quiet rather than dropped; Stage is not on the pack's
              record (it is the onboarding table's whole subject, below). */}
          <span className="fig"><span className="k">Mode</span><span className="v sm">{labelOf(MODE_LABEL, tenant.deploymentMode)}</span></span>
          <span className="fig"><span className="k">Residency</span><span className="v sm">{tenant.residency}</span></span>
          <Soon className="fig" label="Retention, coming soon">
            <span className="k">Retention</span>
            <span className="v sm">—</span>
          </Soon>
          <span className="fig"><span className="k">Support access</span><span className="v sm">{labelOf(ACCESS_LABEL, tenant.supportAccessMode)}</span></span>
          <span className="fig"><span className="k">Plan</span><span className="v sm">{tenant.plan ?? '—'}</span></span>
        </div>
        {tenant.soldVia === undefined ? null : (
          <p className="q" style={{ marginTop: 'calc(var(--u)*3)' }}>
            Sold via {tenant.soldVia}, so this tenant is never invoiced to the customer — it is a line on that partner’s
            consolidated invoice.
          </p>
        )}
      </div>

      <div style={SECTION_BOX}>
        <span className="lab" style={{ margin: 0 }}>Mode and residency are frozen on this record</span>
        <p className="note">
          Neither is a field, here or anywhere. A customer who needs their own account does not have this one amended:{' '}
          <b>we provision a second tenant and migrate into it</b> — documents, runs, resolutions, approvals and the trail
          together — and this one goes read-only at cutover. The record never changes because the tenant does not.
        </p>
      </div>

      <section aria-labelledby="h2-onboarding">
        <span className="lab" id="h2-onboarding">Onboarding, in the order that is load-bearing</span>
        <p style={{ marginTop: 'calc(var(--u)*3)' }}>
          Every step is blocked by the one above it. The order is not guidance: skipping it produces a first period
          measured against a source nobody bound, or a floor nobody set, and the customer reads the result as the product
          being wrong.
        </p>
        {steps.phase === 'read' ? (
          <div className="scroller">
            <table className="tbl" data-onboarding="">
              <thead>
                <tr>
                  <th scope="col">Step</th>
                  <th scope="col">State</th>
                  <th scope="col">Whose hands</th>
                  <th scope="col"><span className="sr-only">Act</span></th>
                </tr>
              </thead>
              <tbody>
                {steps.steps.map((s) => {
                  const forced = s.state === 'done_forced'
                  const stale = forced || s.state === 'blocked'
                  return (
                    <tr key={s.stepKey} data-step={s.stepKey} data-state={s.state}>
                      <th scope="row">
                        {s.title}
                        {Object.hasOwn(STEP_NOTE, s.stepKey) ? <span className="q sub">{STEP_NOTE[s.stepKey]}</span> : null}
                        {s.forcedReason === undefined ? null : <span className="q sub">forced: “{s.forcedReason}”</span>}
                      </th>
                      <td><span className={stale ? 'chip stale' : 'chip'}>{STATE_LABEL[s.state]}</span></td>
                      <td>{s.whoseHands}</td>
                      <td>
                        {mayAct && s.state === 'next' ? (
                          <button
                            className="abtn"
                            type="button"
                            data-commit=""
                            data-mark-done={s.stepKey}
                            aria-disabled={busy !== null ? 'true' : undefined}
                            onClick={() => { if (busy === null) markDone(s) }}
                          >
                            {busy === s.stepKey ? 'Marking done' : 'Mark done'}
                          </button>
                        ) : null}
                        {mayAct && s.state === 'blocked' ? (
                          <button
                            className="abtn"
                            type="button"
                            data-force={s.stepKey}
                            aria-pressed={forceOn?.stepKey === s.stepKey}
                            onClick={() => { setForceOn(s); setWhy(''); setOutcome(null) }}
                          >
                            Force it
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="q" role="status" data-steps={steps.phase} {...(steps.phase === 'reading' ? { 'data-reading': '' } : {})} style={{ marginTop: 'calc(var(--u)*3)' }}>
            {steps.phase === 'reading'
              ? 'Reading this tenant’s onboarding.'
              : steps.phase === 'not-found'
                ? 'This tenant has no onboarding record yet.'
                : steps.phase === 'forbidden'
                  ? 'Your role does not reach this tenant’s onboarding.'
                  : steps.phase === 'no-session'
                    ? 'Your session has ended. Sign in again to carry on.'
                    : 'The onboarding could not be read just now. Try again in a moment.'}
          </p>
        )}

        {forceOn === null ? null : (
          <div className="reasons" data-force-form={forceOn.stepKey}>
            <span className="lab" style={{ margin: 0 }}>Forcing {forceOn.title} · out of order, and on the record</span>
            <p style={{ marginTop: 'calc(var(--u)*2)' }}>
              The gate exists because of what the next period looks like without it. You may pass it, and what you type
              here is what a review reads when it asks why the first period was wrong.
            </p>
            <div className="pfields">
              <label>
                <span className="lab" style={{ margin: 0 }}>Why, in your words</span>
                <input
                  type="text"
                  value={why}
                  onChange={(e) => { setWhy(e.target.value) }}
                  placeholder="what makes this step waitable"
                  data-force-reason=""
                />
              </label>
            </div>
            <div className="acts" style={{ marginTop: 'calc(var(--u)*3)' }}>
              <button
                className="abtn"
                type="button"
                data-commit=""
                data-force-commit=""
                aria-disabled={ready && busy === null ? undefined : 'true'}
                onClick={commitForce}
              >
                Force it, with that reason
              </button>
              <button className="abtn" type="button" onClick={() => { setForceOn(null); setWhy('') }}>Leave the gate</button>
            </div>
          </div>
        )}

        {outcome === null ? null : (
          <div className={outcome.ok ? 'result' : 'result refused'} role="status" data-outcome={outcome.ok ? 'ok' : 'refused'}>
            {outcome.line}
          </div>
        )}
      </section>

      <section aria-labelledby="h4-floor">
        <span className="lab" id="h4-floor">The extraction floor for this tenant</span>
        <p style={{ marginTop: 'calc(var(--u)*3)' }}>
          Set off the customer’s surface, because the band may exist and the number may not: a facet printing it would
          assert a value the tenant has no access to.
        </p>
        <div className="figs" style={{ marginTop: 'calc(var(--u)*4)' }}>
          <QuietFig k="Pack default" />
          <QuietFig k="This tenant" />
          <QuietFig k="Parked for a person, last run" />
        </div>
        {/* RS-04 (G3585): S1's *New floor* field, drawn and disabled rather than
            omitted — nothing serves a floor (G139). */}
        {/* NS-04 (G3711): one disabled field, the width of what it takes —
            it spanned the pane, 1420px of grey bar at 1440. */}
        <div className="pfields narrow" style={{ marginTop: 'calc(var(--u)*4)' }}>
          <label>
            <span className="lab" style={{ margin: 0 }}>New floor</span>
            <input type="text" disabled placeholder="e.g. 0.74" data-soon-field="" />
          </label>
        </div>
        <div className="acts" style={{ marginTop: 'calc(var(--u)*3)' }}>
          <Soon className="abtn">Set the floor</Soon>
        </div>
      </section>

      <section aria-labelledby="h9-tags">
        <span className="lab" id="h9-tags">Tags and chargeback</span>
        <p style={{ marginTop: 'calc(var(--u)*3)' }}>
          The vocabulary is the customer’s — they own the names — and what the meter does with them is ours. One key is
          nominated to drive chargeback, and everything downstream depends on that one choice.
        </p>
        <QuietTable caption="Tags and chargeback" heads={['Key', 'Values seen', 'Drives chargeback', 'Coverage this period']} />
      </section>

      <section aria-labelledby="h10-licence">
        <span className="lab" id="h10-licence">The licence position in their account</span>
        <p style={{ marginTop: 'calc(var(--u)*3)' }}>
          Every third-party runtime that lands inside a customer’s account has to have a defensible answer ready before
          their security review asks. Under BYOA the answer is theirs to accept, which makes it ours to have.
        </p>
        <QuietTable caption="The licence position" heads={['Runtime', 'Licence', 'Where it runs', 'Position']} />
      </section>

      <div style={SECTION_BOX}>
        <span className="lab" style={{ margin: 0 }}>Amending retention or support access</span>
        <p className="note">
          Both are the customer’s to change and ours to execute, and both are recorded with who asked and when it took
          effect. <b>Shortening retention destroys documents</b>, so it is the one amendment that needs the customer’s
          instruction in writing rather than a message on a case.
        </p>
        <div className="acts" style={{ marginTop: 'calc(var(--u)*3)' }}>
          <Soon className="abtn">Amend</Soon>
        </div>
      </div>
    </div>
  )
}

/* ═══ THE APPLICATION ON THE CONSOLE HOST ══════════════════════════════════ */

export interface StaffConsoleProps {
  /** The plane origin `planeFrom()` already allowlisted. */
  readonly origin: string
  readonly switcher?: ReactNode
  /** `getSessionPrincipal`'s answer, read by the caller (G3373). */
  readonly principal?: SessionPrincipal | null
}

/**
 * RS-10 (G3587) — A TENANT RECORD IS AN ADDRESS: `/?tenant=<id>` on the console
 * host. A QUERY on `/`, not a path, deliberately: the console host draws the
 * console only at `/` (`main.tsx`), and a new path would be a row in the
 * closed `ROUTE_PATHS` set the pack's route map does not draw. Any other
 * parameter (`?plane=`) is kept. Opening pushes a history entry, so Back
 * returns to the tenancy; a reload or a pasted link opens the same record.
 */
const TENANT_PARAM = 'tenant'

function tenantInAddress(): string | null {
  if (typeof window === 'undefined') return null
  const id = new URLSearchParams(window.location.search).get(TENANT_PARAM)
  return id === null || id === '' ? null : id
}

function addressFor(tenantId: string | null): string {
  const q = new URLSearchParams(window.location.search)
  if (tenantId === null) q.delete(TENANT_PARAM)
  else q.set(TENANT_PARAM, tenantId)
  const search = q.toString()
  return `${window.location.pathname}${search === '' ? '' : `?${search}`}`
}

export function StaffConsole({ origin, switcher, principal = null }: StaffConsoleProps) {
  const [roster, setRoster] = useState<RosterLoad>({ phase: 'reading' })
  const [open, setOpenState] = useState<string | null>(tenantInAddress)
  /* NS-03 (G3709): which way the last change went, so focus can follow it —
     into the record on open, back to that row's Open on the way out. A first
     paint (a reload, a pasted address) moves nothing. */
  const [moved, setMoved] = useState<{ readonly to: 'record' } | { readonly to: 'list'; readonly from: string } | null>(null)
  const openNow = useRef(open)
  const goTo = useCallback((next: string | null): void => {
    const was = openNow.current
    openNow.current = next
    setMoved(next !== null ? { to: 'record' } : was === null ? null : { to: 'list', from: was })
    setOpenState(next)
  }, [])

  useEffect(() => {
    const follow = (): void => { goTo(tenantInAddress()) }
    window.addEventListener('popstate', follow)
    return () => { window.removeEventListener('popstate', follow) }
  }, [goTo])

  const setOpen = useCallback((tenantId: string | null): void => {
    if (tenantId !== tenantInAddress()) window.history.pushState(null, '', addressFor(tenantId))
    goTo(tenantId)
  }, [goTo])

  useEffect(() => {
    let live = true
    fetchTenants({ origin })
      .then((tenants) => { if (live) setRoster({ phase: 'read', tenants }) })
      .catch((err: unknown) => { if (live) setRoster(failOf(err)) })
    return () => { live = false }
  }, [origin])

  const opened = roster.phase === 'read' && open !== null ? roster.tenants.find((t) => t.tenantId === open) ?? null : null

  useEffect(() => {
    document.title = opened === null ? 'Tenants · ReconcileAI' : `${opened.name} · ReconcileAI`
  }, [opened])

  /* E1 in place of the console when the plane says nobody is signed in, or is
     not answering at all — the same rule the tenant register keeps. A 403 is
     never a page: it stays inside the console, where it was asked. */
  if (roster.phase === 'no-session') {
    return <main className="route" {...ROUTE_ROOT_PROPS}><ErrorPage code="401" quote="no session" /></main>
  }
  if (roster.phase === 'refused' && (roster.status === null || roster.status >= 500)) {
    const gateway = roster.status === null || [502, 503, 504].includes(roster.status)
    return (
      <main className="route" {...ROUTE_ROOT_PROPS}>
        {/* RC-28 (G3481): the address, never "plane" or the service's code. */}
        <ErrorPage code={gateway ? '503' : '500'} quote={location.pathname} />
      </main>
    )
  }

  const backToList = (): void => { setOpen(null) }
  /* A `?tenant=` naming no row in the roster draws the tenancy — the address
     names nothing this reader can see, and the list is where they choose. */

  return (
    <div className="app staff" data-surface="console">
      <SkipLink target={roster.phase === 'read' ? WORK_ID : 'route-root'}>Skip to the work</SkipLink>
      <h1 className="sr-only">Reconcile AI · staff console</h1>
      <StaffChrome onTenants={backToList} inTenants principal={principal} {...(switcher === undefined ? {} : { switcher })} />
      <main className="route staff-work" {...ROUTE_ROOT_PROPS}>
        {roster.phase === 'reading' ? (
          <div className="pane"><p className="q" role="status" data-reading="">Reading the tenancy.</p></div>
        ) : roster.phase === 'forbidden' ? (
          <div className="pane" data-roster="forbidden">
            <span className="lab">Tenancy</span>
            <p>Your 1CloudHub account holds no role that reaches the tenancy. Ask whoever administers staff roles to grant one.</p>
          </div>
        ) : roster.phase === 'read' ? (
          opened === null ? (
            <Tenancy tenants={roster.tenants} onOpen={setOpen} returnTo={moved?.to === 'list' ? moved.from : null} />
          ) : (
            <TenantRecord
              key={opened.tenantId}
              origin={origin}
              tenant={opened}
              onBack={backToList}
              focusOnMount={moved?.to === 'record'}
            />
          )
        ) : (
          <div className="pane"><p className="q" role="status">The tenancy could not be read just now. Try again in a moment.</p></div>
        )}
      </main>
      {/* The pack's status bar, minus the period and the person: no served
          operation names either, so neither is drawn rather than invented. */}
      {/* U-27 (G4181): the same narrow row and sheet as Close — one
          implementation, `StatusGrammar.tsx`. The row shows the provenance
          slot; on this surface that is the plane the console reads from. */}
      <StatusGrammar
        barData={{ 'data-staff-statusbar': '' }}
        bar={
          <>
            <span className="bit">1CloudHub · <b>staff console</b></span>
            <span className="bit">control plane · a customer tenant is reached only under the mode they chose</span>
          </>
        }
        row={<>Provenance · <b>control plane</b> · staff console</>}
        sheet={[
          { name: 'entity', content: <>1CloudHub · <b>staff console</b></> },
          { name: 'plane', content: 'control plane · a customer tenant is reached only under the mode they chose' },
        ]}
      />
    </div>
  )
}
