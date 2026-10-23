/**
 * THE CLIENT ENTRY — `npm run dev:frontend`.
 *
 * This is the only place the bridge stylesheet is imported, so there is exactly
 * one build of it and the dev surface and the pre-rendered pages cannot drift.
 * `shell.css` is imported beside it and AFTER it: both are unlayered, so source
 * order is what decides a tie, and the shell's system rules are meant to win
 * against nothing — they collide with the kernel nowhere, by construction
 * (`shell.css`, "CASCADE").
 *
 * 🛑 THIS RENDERS THE SHELL AND FETCHES REAL RUNS. `frontend/dist/specimen.html`
 * still carries `<Specimen/>`, emitted by `prerender.tsx`; the running app is the
 * product, and the product is the register.
 */
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

/* The kernel's two faces, self-hosted (RV-01, G3391). FIRST, so the
   @font-face rules precede every rule that names the family. */
import '../fonts/plex.css'
import './bridge.css'
import './shell.css'
/* AFTER shell.css, for the reason shell.css's own CASCADE note gives: all three
   are unlayered, so source order decides a tie. They collide nowhere — the
   overlay sheet declares no `.bar`, `.dest`, `.ctl` or `.menu` rule — and the
   order is stated rather than left to import sorting. */
import './overlays.css'
/* LAST, and scoped: every rule in it sits behind `.entry` or `.e1`, and two of
   its class names (`.btn`, `.field`) also exist in overlays.css — specificity
   and this order both keep the signed-out shell's meaning on its own pages. */
import './entry.css'
import './close.css'
/* AFTER close.css: the luminous touch's compositions with the Close surface's
   own cell rules (RM-04, G3399). Its rules out-rank close.css's on
   specificity, and the order is stated so a tie can never go the other way. */
import './luminous.css'
/* The staff console's surface — scoped under `.staff`, after close.css whose
   `.chrome` rules it reuses unchanged (G3321). */
import './staff.css'
import { startTheme } from './theme.ts'
/* RC-01/08/09, C4, C5 — the secondary surfaces, scoped under `.page`. */
import './secondary.css'
import { Shell } from './Shell.tsx'
import { ChromeBar, TabBar } from './components/ChromeBar.tsx'
import { ThemeToggle } from './components/ThemeToggle.tsx'
import { Finding, type FindingLoad } from './components/Finding.tsx'
import {
  RunAccount,
  type AccountLoad,
  type ResidueLoad,
  type RunLoad,
} from './components/RunAccount.tsx'
import { LiveRun } from './components/LiveRun.tsx'
import {
  PlaneRefused,
  fetchRun,
  fetchRunAccount,
  fetchRunResidue,
  fetchRuns,
  type Run,
} from './api/runs.ts'
import {
  assignException,
  fetchException,
  fetchExceptionCount,
  fetchExceptions,
  mergeAssignment,
  type ExceptionRow,
  type ExceptionSort,
} from './api/exceptions.ts'
import { fetchIntakeLanes } from './api/intake.ts'
import {
  ExceptionRegister,
  SHOWS,
  SHOW_KEYS,
  type AssignAct,
  type ShowKey,
} from './components/ExceptionRegister.tsx'
import { groupRuns, stripRunsOf } from './components/Register.tsx'
import { claimRoleOf, defaultDefinitionOf, defaultRunOf, refusalKindOf } from './close-state.ts'
import { READING_POLL_MS, anyReading, litTargetOf, workingRunOf } from './luminous.ts'
import { ToastRegion, useToasts } from './overlays/Toast.tsx'
import { useRegisterActs } from './register-acts-run.ts'
import type { IntakeLoad } from './Shell.tsx'
import { greetingFor } from './format.ts'
import { SignIn } from './components/SignIn.tsx'
import { ProfileSwitcher } from './components/ProfileSwitcher.tsx'
import { TEST_PERSONAS_ENABLED } from './test-personas.ts'
import { SignInCallback } from './components/SignInCallback.tsx'
import { Setup } from './components/Setup.tsx'
import { AskPage, EntryRoot, InvitePage, ReportsPage } from './components/Quiet.tsx'
import { ResolvePanel } from './components/Resolve.tsx'
import { ApprovalsQueue, PostProposal, loadApprovalsWaiting } from './components/Approvals.tsx'
import { reopenWindowOpen } from './register-acts.ts'
import { planeFrom, type Plane } from './api/plane.ts'
import { resolveTenantContext, type TenantContext } from './api/context.ts'
import { fetchSessionPrincipal, signOutAt, type SessionPrincipal } from './api/principal.ts'
import { DRAW_GATES, HeldCapabilities, holds } from './capabilities.ts'
import { apexUrlFor, isApexPath, type ApexPath } from './routes/apex.ts'
import { browserHost, createRouter } from './routes/router.ts'
import { ROUTE_ROOT_ID, RouteView, routeRoot, type Screens } from './routes/screens.ts'
import { SkipLink } from './components/SkipLink.tsx'
import { REGISTER_ID } from './components/ExceptionRegister.tsx'
import { isSignedOutSurface, titleOf } from './routes/surfaces.ts'
import { hrefOf, type Resolution, type RoutePath } from './routes/table.ts'
import { linkTo, useRoute } from './routes/useRoute.ts'
import { ErrorPage } from './components/ErrorPage.tsx'
import { StaffConsole } from './components/StaffConsole.tsx'
import { PartnerPortal, type PartnerDest } from './components/PartnerPortal.tsx'
import { surfaceOf } from './routes/surface.ts'
import './partner.css'
/* C9 · the parked pile on the register (rows 18, 19) — its own sheet. */
import './parked.css'
import { ParkedPile } from './components/ParkedPile.tsx'
import { readRefusalSentenceOf } from './run-account-words.ts'

/** The tab title E1 takes when it stands in for the register — G3044. */
const ERROR_TITLE = {
  '401': 'Signed out',
  '500': 'Something failed on our side',
  '503': 'The plane is not answering',
} as const

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 G486, 19 Sep 2026 — **THE ROUTE LAYER IS WIRED IN, AND UNTIL THIS COMMIT
 *    IT WAS DEAD CODE.** `frontend/src/routes/` held twelve routes, a mapped
 *    type that makes a thirteenth a compile error, a matcher, a focus rule and
 *    a provenance suite — and NOTHING OUTSIDE ITS OWN DIRECTORY IMPORTED ANY
 *    OF IT, so `vite build` dropped the lot. Reproduce the old state:
 *    `git show HEAD~1 -- frontend/src/main.tsx | grep -c routes/` → 0.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🛑 THE ROUTER IS BUILT ONCE, AT MODULE SCOPE, AND DELIBERATELY NOT IN A
 * HOOK. `createRouter()` subscribes to `popstate`; building it inside a
 * component would build a second one under `StrictMode`'s double-invoke and
 * leave the first listening, so the back button would settle twice and the
 * focus rule would fire on a router nothing renders. It is also the honest
 * shape: there is one history, so there is one router.
 *
 * ⚠️ WHAT THE BARE ORIGIN NOW RENDERS, STATED BECAUSE IT IS A BEHAVIOUR CHANGE
 * A READER WILL MEET FIRST. `/` is the ENTRY route in the drawn record — the
 * hero — and this repository has not built it, so `/` renders the route layer's
 * own scope: *"This route resolves. It has no screen yet."* **The register
 * moved to `/close`, which is where `ROUTE_PATHS` has always said it is.**
 * Mapping `/` to the register instead would have been the application
 * inventing a thirteenth meaning for a drawn path, which is exactly what the
 * closed set exists to prevent — and it would have hidden that the entry
 * surface is unbuilt behind a screen that looks finished.
 *
 * 🛑 THREE OF THE FOURTEEN HAVE A SCREEN AND THE OTHER ELEVEN ARE NOT HATCHED.
 * ⚠️ **THIS SAID "ONLY TWO OF THE TWELVE … THE OTHER TEN" AND WAS WRONG IN
 * BOTH HALVES BEFORE THIS SLICE TOUCHED IT — G1915, 22 Sep 2026.** G1031 added
 * the `/close/run/:runId` screen on 20 Sep 2026 and swept the map's own
 * comment below and not this header, so *two* was already *three*; G1911 then
 * took `ROUTE_PATHS` from twelve to fourteen. **The 3 was not this slice's to
 * make stale and is named so this sweep is not read as accounting for both.**
 * Derive both, never read them: `grep -cE "^    '/[^']*': \(" frontend/src/main.tsx`
 * and `awk '/^export const ROUTE_PATHS = \[/,/^\] as const/' frontend/src/routes/table.ts | grep -cE "^  '/"`.
 * `design/routes/index.html` §2's rule, which `table.ts` quotes: a route with
 * no screen is a GAP, not a REFUSAL, and the hatch means *refused* (G216 as
 * amended, G245). The scope renderer states the gap in words. A pathname the
 * product does not draw at all answers `not-found`, and a router that 404s an
 * undrawn route is truthful.
 */
const router = createRouter(browserHost(window, document))

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 G386, 19 Sep 2026 — **THIS APPLICATION NO LONGER HOLDS A CREDENTIAL, AND
 *    `const SESSION_KEY = 'reconcile.session'` IS DELETED RATHER THAN
 *    RENAMED.** THE PARAGRAPH THAT STOOD HERE IS QUOTED, BECAUSE IT IS THE
 *    SENTENCE FOUR OTHER FILES AND ONE TEST SUITE STILL POINT AT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     "WHERE THE SESSION COMES FROM, AND WHY IT IS NOT IN THE URL. 🛑 NEVER A
 *      QUERY PARAMETER … It is read from `sessionStorage`, which a developer
 *      sets by hand after minting one with `npm run token:mint`."
 *
 * The handle is an `HttpOnly` cookie. **`document.cookie` cannot see it, so
 * this file cannot read it, cannot store it, cannot pass it and cannot check
 * whether it exists.** Every `sessionStorage.getItem()` below is gone, and the
 * four `if (session === null) return` guards with them.
 *
 * 🛑 THE CONSEQUENCE IS A STATE MACHINE CHANGE AND IT IS THE INTERESTING PART.
 * `no-session` used to be decided BEFORE a request — a local fact, known for
 * free. It is now decided by the PLANE, from a **401**, which means the app
 * must ASK before it can say it is signed out. Two things follow, and both are
 * improvements rather than costs:
 *
 *   · A session that is revoked, expired, or bound to another host now renders
 *     as *"no session"* rather than as a refusal with a status code in it. It
 *     is the same fact and it was previously reported two different ways
 *     depending on whether the browser happened to hold a string.
 *   · A caption can no longer tell a developer to *"set `reconcile.session` in
 *     sessionStorage"*, because doing that would now achieve nothing. It names
 *     the cookie instead — and a developer without one has to sign in, which
 *     is the honest instruction even while the sign-in flow is unbuilt.
 *
 * ⚠️ AND THERE IS NO TENANT HERE, ANYWHERE, BY CONSTRUCTION. Invariant 1: scope
 * is DERIVED FROM THE SESSION, never read from a request. `fetchRuns` has no
 * `tenantId` parameter to pass one to — and now no `session` parameter either.
 */
/* RC-28 (G3481): what a reader quotes is plain — no "plane", no internal code. */
const NO_SESSION = 'no session'

/**
 * Is this refusal the plane saying *"I do not know who you are"*?
 *
 * 🛑 THE STATUS AND NOTHING ELSE. `errors.yaml`'s `session_invalid` is the code
 * and it would be the tempting thing to match on; the STATUS is what
 * `server/http/app.ts`'s authentication hook actually guarantees — one 401 for
 * every arm, *"so that 'no session' and 'an error while checking the session'
 * cannot take different paths"* — and matching a code would make this client
 * depend on which of them the plane chose.
 */
function isUnauthenticated(err: unknown): boolean {
  return err instanceof PlaneRefused && err.status === 401
}

/**
 * A refused list read, carrying the plane's STATUS and closed CODE beside the
 * message — G3050. `status` is `null` when no response arrived at all, which is
 * what lets the register tell E1's 500 (*"ours"*) from its 503 (*"we cannot
 * reach it"*) without parsing a sentence.
 */
interface Refusal {
  readonly phase: 'refused'
  readonly why: string
  readonly status: number | null
  readonly code: string | null
}

function refusalOf(err: unknown): Refusal {
  /* ⚠️ THE MESSAGE, NEVER THE PLANE'S `detail`. `errors.yaml` requires `detail`
     to carry no field values, record contents or customer strings, and a client
     that put it in front of a user would be the one place that rule is not
     held. `PlaneRefused` carries the status and the closed code, which is what
     an operator can act on. */
  return {
    phase: 'refused',
    why: err instanceof Error ? err.message : 'unreachable',
    status: err instanceof PlaneRefused ? err.status : null,
    code: err instanceof PlaneRefused ? err.code ?? null : null,
  }
}

type Load =
  | { readonly phase: 'no-session' }
  | { readonly phase: 'reading' }
  | { readonly phase: 'read'; readonly runs: readonly Run[]; readonly nextCursor: string | null }
  | Refusal

/*
 * ⛔ `provenanceFor()` STOOD HERE UNTIL 2 Oct 2026 AND IS DELETED UNDER G3091,
 * THE OWNER'S RULING — *"Engineering rationale stays in docs/tests, never on
 * screen."* It composed the register's caption (*"read from the data plane"*,
 * *"no rows read · data plane · …"*). Each load phase is now stated where the
 * pack states it: the strip's own empty cell, the count line, and — for a
 * refused `?plane=` — the status bar. Retrieve the function with
 * `git show 76f0341e:frontend/src/main.tsx`.
 */

/**
 * ⚠️ `RunDetail` AND `Opened` USED TO BE DECLARED HERE, AND THAT IS WHY THE PANEL
 * DREW A SECOND VOCABULARY FOR `completeness`. It rendered `[]` as
 * "0 accounted" while the register rendered the identical value as "engine
 * observed no shortfall", and it carried no `data-completeness`, so nothing in
 * this repository could reach it: this file is JSX and node does not transform
 * JSX. It became `frontend/src/components/RunDetail.tsx`, beside the register it
 * has to agree with, deriving both halves from `frontend/src/completeness.ts`.
 * The move is recorded here rather than left as an absence, because "the detail
 * panel lives in main.tsx" is the sentence a reader of this file would otherwise
 * still believe.
 *
 * ⛔ **AND THAT FILE IS DELETED — G1031, 20 Sep 2026.** The panel was the
 * stand-in for a ROUTE the drawn record always had, `/close/run/:runId`, while
 * the route layer was dead code; its own header recorded that it was *"STILL
 * UNWITNESSED AS A RENDERED SURFACE"*. `frontend/src/components/RunAccount.tsx`
 * is the route's screen and draws the same run identity from the same
 * `completeness.ts`, plus the account and the residue the panel could not
 * reach. Retrieve it if you need the history:
 * `git show HEAD~1:frontend/src/components/RunDetail.tsx`.
 */
/**
 * THE EXCEPTION REGISTER'S OWN LOAD, AND IT IS SEPARATE FROM `Load` ON PURPOSE.
 * G357, 19 Sep 2026.
 *
 * 🛑 TWO READS, TWO STATES, AND NEITHER MAY SPEAK FOR THE OTHER. `listRuns` and
 *    `listExceptions` are two operations against two tables; folding them into
 *    one `phase` would make a failure in either render BOTH registers as
 *    unread — and, worse, would let a SUCCESSFUL exception read be drawn while
 *    the caption said the runs were still loading. Each register states its own
 *    provenance because each has its own.
 *
 * ⚠️ AND THE `refused` ARM IS NOT COLLAPSED INTO AN EMPTY LIST. An empty
 *    exception register means *"nothing needs deciding"* on the surface a
 *    period is closed on; a refusal means *"this session could not ask"*.
 *    `frontend/src/api/exceptions.ts` refuses to fabricate the first from the
 *    second and this state machine refuses to as well.
 */
type ExceptionLoad =
  | { readonly phase: 'no-session' }
  | { readonly phase: 'reading' }
  | {
      readonly phase: 'read'
      readonly rows: readonly ExceptionRow[]
      readonly nextCursor: string | null
      readonly estimatedTotal: number | null
    }
  | Refusal

/**
 * WHEN THE REGISTER IS NOT A REGISTER — E1, G3050.
 *
 * `/close` is two list reads, and when BOTH come back with the same failure
 * there is no register to draw: there is the page E1 draws *"when there is no
 * application to draw into"*. Two cases are distinguishable from what the plane
 * answered and nothing else is claimed:
 *
 *   · both 401 → E1's 401. A visitor with no session no longer sees an empty
 *     register under a chrome bar of controls they cannot use.
 *   · both refused with a 5xx or no response → E1's 500 (*"ours"*) or, when
 *     every answer is a gateway's or absent, its 503 (*"we cannot reach it"*).
 *
 * 🛑 ONE READ FAILING ALONE IS NOT A PAGE. The second state machine's own
 * argument — *"a failure in any one must not redraw the other two as unread"*
 * — holds here too, so a mixed answer keeps the register and its captions.
 * And a 403 is NEVER a page: E1 says *"Inside the product a refusal is never a
 * page"*, so it stays in the register's caption, where it was.
 */
function registerErrorOf(
  runs: Load,
  exceptions: ExceptionLoad,
): { readonly code: '401' | '500' | '503'; readonly quote: string } | null {
  if (runs.phase === 'no-session' && exceptions.phase === 'no-session') {
    return { code: '401', quote: NO_SESSION }
  }
  if (runs.phase !== 'refused' || exceptions.phase !== 'refused') return null
  const failures = [runs, exceptions]
  if (!failures.every((f) => f.status === null || f.status >= 500)) return null
  const gateway = failures.every((f) => f.status === null || [502, 503, 504].includes(f.status))
  /* RC-28 (G3481): the ADDRESS, never the service's own code (`internal_error`,
     `upstream_unavailable`) — that vocabulary is for the logs, and "plane" is
     ours. The status is already the first half of the quote line. */
  return { code: gateway ? '503' : '500', quote: typeof location === 'undefined' ? '/close' : location.pathname }
}


/**
 * THE FINDING'S OWN LOAD, AND IT IS A THIRD STATE MACHINE FOR THE REASON THE
 * SECOND ONE GIVES. G486.
 *
 * 🛑 THREE READS, THREE STATES, AND NONE MAY SPEAK FOR ANOTHER. `listRuns`,
 * `listExceptions` and `getException` are three operations; a failure in any
 * one must not redraw the other two as unread, and — the direction that
 * actually misleads — a SUCCESSFUL finding read must not make the register
 * claim it has rows.
 *
 * ⚠️ IT ADDS AN ARM THE OTHER TWO DO NOT HAVE, AND THE ARM IS THE INTERESTING
 * PART: `not-found`. A list read cannot 404; a read BY REFERENCE can, and
 * invariant 1 makes that 404 the answer to two different questions at once —
 * another tenant's row and a row nobody raised — *"a 403 would confirm the row
 * exists, which is the disclosure invariant 1 forbids"*. Folding it into
 * `refused` would print a status code at a person; `Finding.tsx` prints a
 * sentence that is true of both.
 */
function findingLoadFrom(err: unknown): FindingLoad {
  if (isUnauthenticated(err)) return { phase: 'no-session' }
  if (err instanceof PlaneRefused && err.status === 404) return { phase: 'not-found' }
  /* ⚠️ THE MESSAGE, NEVER THE PLANE'S `detail` — `errors.yaml` requires
     `detail` to carry no field values, record contents or customer strings. */
  return { phase: 'refused', why: err instanceof Error ? err.message : 'unreachable' }
}

/**
 * THE RUN-ACCOUNT ROUTE'S THREE LOADS, AND THEY ARE THREE RATHER THAN ONE FOR
 * THE REASON THE SECOND AND THIRD STATE MACHINES ABOVE GIVE. G1031.
 *
 * 🛑 `getRun`, `getRunAccount` AND `listRunResidue` ARE THREE OPERATIONS AND
 * ONE OF THEM ANSWERING IS NOT THE OTHERS ANSWERING. Against every database
 * this repository can produce today the first is a **200** and the other two
 * are **404** — a run this session really can see, with no engine account —
 * and a single `phase` would have to choose one of those two words for all
 * three reads. It would choose the wrong one: folding them would either draw
 * the run as invisible because its account is absent, or draw the account as
 * present because the run is.
 *
 * 🛑 AND THE TWO 404s MEAN THE SAME THING AS EACH OTHER AND A DIFFERENT THING
 * FROM `getRun`'s. `run-account.ts` answers `no_account` for a run in another
 * tenant, a run that does not exist AND a run nobody reconciled —
 * deliberately collapsed — whereas `getRun`'s 404 is the narrower *"this
 * session cannot see this run"*. Two arms, two sentences, and neither
 * pretends to separate what the plane will not.
 */
function runLoadFrom(err: unknown): RunLoad {
  if (isUnauthenticated(err)) return { phase: 'no-session' }
  if (err instanceof PlaneRefused && err.status === 404) return { phase: 'not-found' }
  return { phase: 'refused', why: readRefusalSentenceOf(err instanceof PlaneRefused ? err : null) }
}

function accountLoadFrom(err: unknown): AccountLoad {
  if (isUnauthenticated(err)) return { phase: 'no-session' }
  /* 🛑 `no-account` AND NOT `not-found`. The handler's own `NO_ACCOUNT_DETAIL`
     is *"No engine account for that run is visible to this session"*, and a
     client that rendered it as "no such run" would contradict the `getRun`
     read sitting two inches above it on the same screen — which on a surface
     whose subject is what the engine could not establish is the worst
     available failure. */
  if (err instanceof PlaneRefused && err.status === 404) return { phase: 'no-account' }
  return { phase: 'refused', why: readRefusalSentenceOf(err instanceof PlaneRefused ? err : null) }
}

function residueLoadFrom(err: unknown): ResidueLoad {
  if (isUnauthenticated(err)) return { phase: 'no-session' }
  if (err instanceof PlaneRefused && err.status === 404) return { phase: 'no-account' }
  return { phase: 'refused', why: readRefusalSentenceOf(err instanceof PlaneRefused ? err : null) }
}

/**
 * D1's OWN STATE — G3213, applying G3006 (2 Oct 2026, THE OWNER'S): *"D1
 * reads the cookie."* A sign-in mints a TENANT-LESS session (G726, S2), so
 * until D1 binds the host's tenant every capability read answers
 * `tenant_context_missing`. The app therefore BINDS FIRST and reads after.
 *
 * ⚠️ `settled` IS EVERY OUTCOME BUT `binding`, AND THE READS WAIT FOR IT
 * WHATEVER IT WAS. A refused D1 does not suppress the reads: each read then
 * reports its own refusal in its own words — a 401 as "no session", a 403 as
 * a refusal — rather than this state machine speaking for three others.
 */
type Binding =
  | { readonly phase: 'binding' }
  | { readonly phase: 'bound'; readonly context: TenantContext }
  | { readonly phase: 'unbound' }
const NO_RUNS: readonly Run[] = []
const NO_COUNTS: Readonly<Record<ShowKey, number | null>> = {
  all: null,
  needs: null,
  cleared: null,
}

/**
 * A TICK EVERY `READING_POLL_MS` WHILE `active` AND THE PAGE IS VISIBLE —
 * RMR-02 (G3472). `0` until the first tick, so an effect keyed on it can tell
 * the first read from a re-read. Paused while the tab is hidden: a background
 * tab asks the plane nothing, and a tab brought back asks at once rather than
 * waiting out the interval.
 */
function useReadingPoll(active: boolean): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    let timer: ReturnType<typeof setInterval> | null = null
    const start = (): void => {
      if (timer !== null) return
      timer = setInterval(() => { setTick((t) => t + 1) }, READING_POLL_MS)
    }
    const stop = (): void => {
      if (timer === null) return
      clearInterval(timer)
      timer = null
    }
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') {
        stop()
        return
      }
      setTick((t) => t + 1)
      start()
    }
    if (document.visibilityState !== 'hidden') start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [active])
  return tick
}

function ShellApp() {
  const [binding, setBinding] = useState<Binding>({ phase: 'binding' })
  /* G3354 — who is signed in, for the chrome. `null` while unread AND when the
     read failed: the chrome then says nothing about who, which is true. */
  const [principal, setPrincipal] = useState<SessionPrincipal | null>(null)
  const [load, setLoad] = useState<Load>({ phase: 'reading' })
  const [exceptions, setExceptions] = useState<ExceptionLoad>({ phase: 'reading' })
  const [finding, setFinding] = useState<FindingLoad>({ phase: 'reading' })
  const [oneRun, setOneRun] = useState<RunLoad>({ phase: 'reading' })
  const [account, setAccount] = useState<AccountLoad>({ phase: 'reading' })
  const [residue, setResidue] = useState<ResidueLoad>({ phase: 'reading' })

  /* C1's own state — G3091. Which reconciliation and which of its runs the
     arrival is about, the register's SHOW and ORDER BY, the counts behind both
     the facets and the chrome's "Needs you", the intake lanes, the selected
     run's engine account, and the one row that is open. All of it lives here so
     `Shell` stays a pure function of what it is handed. */
  const [pickedDefinition, setPickedDefinition] = useState<string | null>(null)
  const [pickedRun, setPickedRun] = useState<string | null>(null)
  const [show, setShow] = useState<ShowKey>('all')
  const [order, setOrder] = useState<ExceptionSort>('severity_then_value')
  const [counts, setCounts] = useState<Readonly<Record<ShowKey, number | null>>>(NO_COUNTS)
  const [intake, setIntake] = useState<IntakeLoad>({ phase: 'reading' })
  const [runAccount, setRunAccount] = useState<AccountLoad>({ phase: 'reading' })
  const [openRow, setOpenRow] = useState<string | null>(null)
  const [rowDetail, setRowDetail] = useState<FindingLoad>({ phase: 'reading' })
  /* RC-03 — the chrome's "Needs you" is TENANT-WIDE (unassigned or yours, open
     or investigating), while the register's facets and the greeting are the
     SELECTED reconciliation's. Two counts, two states, so neither speaks for
     the other. `countsEpoch` re-reads both after an assignment moves a line. */
  const [needsYouAll, setNeedsYouAll] = useState<number | null>(null)
  /* NC-02 (G3443) — which reconciliations hold a line that needs the reader:
     `null` when the read failed (the default then ignores it), `'reading'`
     until it lands, so the register is scoped once rather than drawn and
     redrawn. */
  const [needsDefinitions, setNeedsDefinitions] = useState<readonly string[] | null | 'reading'>('reading')
  /* G3626 — the runs those lines were raised by (`0480`), from the SAME read,
     for the default RUN within the selected reconciliation. `null` when the
     read failed or nothing is recorded. */
  const [needsRuns, setNeedsRuns] = useState<readonly string[] | null>(null)
  /* G3626 — per strip run, its "N need you" (the pack's per-cell count). */
  const [needsByRun, setNeedsByRun] = useState<Readonly<Record<string, number | null>>>({})
  const [countsEpoch, setCountsEpoch] = useState(0)
  /* C3-08 (the owner's) — which destination /close is showing: the register,
     or Approvals. A VIEW of the Close route, as the pack draws it (`dest:'appr'`
     in `C1 Close.dc.html`), not a new route. */
  const [closeDest, setCloseDest] = useState<'close' | 'approvals'>('close')
  /* C3-07 / C3-08 — the proposals waiting on THIS reader's approval, tenant-wide
     (`loadApprovalsWaiting`). `null` while unread or for a role that may not
     approve. Feeds the chrome's count and the approver's greeting. */
  const [approvalsWaiting, setApprovalsWaiting] = useState<number | null>(null)
  /* C3-07 — the viewer's claim: open lines in the selected run, whoever holds them. */
  const [openCount, setOpenCount] = useState<number | null>(null)
  /* C3-18 (the owner's) — the selected reconciliation's lines whose run was not
     recorded, shown in an "Unattributed" section under the run's register. */
  const [unattributed, setUnattributed] = useState<readonly ExceptionRow[]>([])
  /* C3-11 — the cleared lines on the page still inside the reversal window. */
  const [reopenable, setReopenable] = useState<ReadonlySet<string>>(new Set())
  /* The undo and failure notices for acts on a line (RC-04). */
  const toasts = useToasts()
  const [toastSeq, setToastSeq] = useState(0)

  /* Where we are. `useSyncExternalStore` under the hood, so a deep link paints
     the right route on the FIRST frame rather than correcting itself after
     one — see `useRoute`. */
  const route = useRoute(router)

  /**
   * 🛑 THE SIGNED-OUT SHELL — G3041–G3043, 2 Oct 2026. Measured on staging,
   * signed out: every page a visitor loaded drew the chrome bar AND fired
   * `GET /v1/runs` and `GET /v1/exceptions`, and the plane answered 401 to
   * both on every load — because this component mounted the bar and both reads
   * unconditionally, on `/signin` and on a mistyped address alike.
   *
   * `signedOut` comes from the ROUTE TABLE (`routes/surfaces.ts`), never from a
   * list kept here. `readsRegister` is narrower and is the point of the fix:
   * the two list reads feed exactly ONE screen, `/close`, so they are made on
   * that route and on no other — a signed-out page makes no `/v1` request at
   * all, and `tests/e2e/browser-login.test.ts` §26 counts them.
   */
  const signedOut = isSignedOutSurface(route)
  const readsRegister = route.kind === 'route' && route.path === '/close'
  const onCloseScreens =
    route.kind === 'route' &&
    (route.path === '/close' ||
      route.path === '/close/finding/:ref' ||
      route.path === '/close/finding/:ref/post' ||
      route.path === '/close/run/:runId')
  /* RV-17 (G3483): the chrome's "Needs you" keeps its count on Setup too —
     the chip is drawn there, and dropping the number made it read as zero. */
  const readsNeedsYou = onCloseScreens || (route.kind === 'route' && route.path === '/setup')

  /**
   * The reference this route is about, or `null` if we are not on that route.
   *
   * 🛑 THE PATH IS COMPARED AGAINST A MEMBER OF `RoutePath` AND NOT A LITERAL
   * SOMEBODY TYPED. `route.path` is the closed union, so a mistyped comparison
   * is `TS2367` (this comparison appears unintentional) rather than a branch
   * that silently never runs — which is the failure mode a string comparison
   * against a hand-written URL has, and the one the whole table exists to make
   * impossible.
   */
  const reference =
    route.kind === 'route' && route.path === '/close/finding/:ref'
      ? route.params['ref'] ?? null
      : null

  /**
   * The run this route is about, or `null` if we are not on that route. G1031.
   *
   * 🛑 THE SAME CLOSED-UNION COMPARISON `reference` USES, FOR THE SAME REASON:
   * `route.path` is `RoutePath`, so a mistyped literal is `TS2367` rather than
   * a branch that silently never runs.
   */
  const openRunId =
    route.kind === 'route' && route.path === '/close/run/:runId'
      ? route.params['runId'] ?? null
      : null

  /* Resolved ONCE, and both reads below use this same value. Two independent
     resolutions of the same parameter are two places for the allowlist to be
     applied in one and forgotten in the other. */
  const [plane] = useState<Plane>(() => planeFrom(location.search))

  /**
   * D1 — BIND THE SESSION TO THIS HOST'S TENANT, ONCE PER BOOT. G3213.
   *
   * 🛑 NOTHING IS SENT BUT `{}` AND THE COOKIE THE BROWSER ATTACHES. The tenant
   * is the HOST's and the plane checks the membership; this effect cannot name
   * one.
   *
   * 🛑 NOT RUN ON A SIGNED-OUT SURFACE — G3251, the merge with #533. #532 keyed
   * the skip on the two sign-in paths by name; #533 put the whole signed-out
   * set in `routes/surfaces.ts` (the `Entry` tier, the `public` plane and every
   * unknown address) and made a signed-out page issue NO `/v1` request. A D1 on
   * those pages would be a `POST /context/resolve` answered 401 on every
   * visitor's load — exactly the noise G3041 removed — so the skip keys on the
   * SAME predicate the chrome and the reads do, and not on a list kept here.
   * Navigating in-app from a signed-out page to a signed-in one binds then.
   */
  /* The run the arrival is about: the picked one, else the latest run of the
     picked definition, else the latest run of the most recent definition. */
  const runList = load.phase === 'read' ? load.runs : NO_RUNS
  /* NC-02 (G3443) — the DEFAULT is the reconciliation with the reader's work
     that has finished reading, never simply the most recent one (which opened
     C1 on a running reconciliation with an empty register while the chrome
     said "Needs you 3"). A picked definition always wins. */
  const runGroups = groupRuns(runList)
  const defaultDefinition = defaultDefinitionOf(runGroups, needsDefinitions === 'reading' ? null : needsDefinitions)
  const group =
    runGroups.find((g) => g.definitionId === pickedDefinition) ??
    runGroups.find((g) => g.definitionId === defaultDefinition) ??
    runGroups[0]
  /* G3626 — and within it, the run with the reader's work (`defaultRunOf()`):
     since `0480` the register is the selected RUN's, and opening on a latest
     run that is still reading drew an empty register over a period whose lines
     need the reader. A picked run always wins. */
  const selectedRunId =
    group === undefined
      ? null
      : (group.runs.find((r) => r.runId === pickedRun)?.runId ?? defaultRunOf(group.runs, needsRuns))

  /* The register waits for the runs to settle, because it is SCOPED to the
     reconciliation the strip selects (RC-03) and an unscoped first read would
     draw the whole tenant's lines and then redraw. A refused run read settles
     too, and the register is then unscoped — still the reader's lines. */
  const runsSettled = load.phase !== 'reading' && needsDefinitions !== 'reading'
  const scopeDefinition = group?.definitionId ?? null
  /* The selected run's STATUS: when a poll sees it finish, its engine account
     is read again (RMR-02), so the arrival's figures follow the run. */
  const selectedStatus = group?.runs.find((r) => r.runId === selectedRunId)?.status ?? null

  const bindingPending = binding.phase === 'binding'
  useEffect(() => {
    if (signedOut || !bindingPending) return
    let live = true
    resolveTenantContext(plane.origin)
      .then((context) => { if (live) setBinding({ phase: 'bound', context }) })
      .catch(() => { if (live) setBinding({ phase: 'unbound' }) })
    return () => { live = false }
  }, [plane, signedOut, bindingPending])
  const settled = binding.phase !== 'binding'

  /* G3354 — WHO AM I, read AFTER D1 settles, because the tenant it names is
     the one the session row is bound to and D1 is what binds it. A failure is
     SILENT on purpose: the chrome's who-am-I is not a register, and a refused
     read leaves it saying "Signed in" rather than an error in the header. */
  useEffect(() => {
    if (signedOut || !settled) return
    let live = true
    fetchSessionPrincipal(plane.origin)
      .then((p) => { if (live) setPrincipal(p) })
      .catch(() => { if (live) setPrincipal(null) })
    return () => { live = false }
  }, [plane, signedOut, settled])

  /* RMR-02 (G3472) — THE LIGHT GOES OUT WHEN THE WORK DOES. `/close` read the
     runs once, so a run that finished after the page loaded kept its light,
     its 17s sweep and its working mark for as long as the tab stayed open: the
     product's one "live" signal asserting a state the plane no longer held.
     While any run on the strip is `running`, the runs are re-read every
     `READING_POLL_MS` with the page visible; nothing is polled once nothing
     reads. The read below keeps the strip on screen while it re-reads (it does
     not reset to `reading`), so a poll is invisible unless something changed. */
  const runsTick = useReadingPoll(
    readsRegister && load.phase === 'read' && anyReading(load.runs),
  )

  useEffect(() => {
    if (!settled) return
    /* 🛑 G386 — NO PRE-FLIGHT CHECK, BECAUSE THERE IS NOTHING TO CHECK. The
       credential is an `HttpOnly` cookie the browser attaches and page script
       cannot see. The read is ATTEMPTED and the plane answers. */
    if (!readsRegister) return
    const origin = plane.origin

    let live = true
    fetchRuns({ origin })
      .then((page) => {
        if (!live) return
        setLoad({ phase: 'read', runs: page.items, nextCursor: page.nextCursor })
      })
      .catch((err: unknown) => {
        if (!live) return
        /* A failed RE-read (RMR-02's poll) keeps the strip that was read: one
           missed poll is not an unreadable register. The next tick asks again. */
        if (runsTick > 0 && !isUnauthenticated(err)) return
        if (isUnauthenticated(err)) {
          setLoad({ phase: 'no-session' })
          return
        }
        /* ⚠️ THE MESSAGE, NEVER THE PLANE'S `detail` — see `refusalOf()`. */
        setLoad(refusalOf(err))
      })
    return () => { live = false }
  }, [plane, readsRegister, settled, runsTick])

  /* A SECOND EFFECT, NOT A SECOND BRANCH OF THE FIRST. The two reads are
     independent and either may fail alone; sequencing them would make the
     exception register wait on a run read it does not depend on. */
  useEffect(() => {
    if (!readsRegister || !settled || !runsSettled) return
    let live = true
    setExceptions({ phase: 'reading' })
    fetchExceptions({
      origin: plane.origin,
      status: SHOWS[show].status,
      sort: order,
      definitionId: scopeDefinition,
      /* G3626 — the owner's G3621: the register is the SELECTED RUN's. A line
         whose run is not recorded (`0480` §1) is in no run's register. */
      runId: selectedRunId,
      mineOrUnassigned: SHOWS[show].mine,
    })
      .then((page) => {
        if (!live) return
        setExceptions({
          phase: 'read',
          rows: page.items,
          nextCursor: page.nextCursor,
          estimatedTotal: page.estimatedTotal,
        })
      })
      .catch((err: unknown) => {
        if (!live) return
        if (isUnauthenticated(err)) {
          setExceptions({ phase: 'no-session' })
          return
        }
        /* ⚠️ THE MESSAGE, NEVER THE PLANE'S `detail` — see `refusalOf()`. */
        setExceptions(refusalOf(err))
      })
    return () => { live = false }
  }, [plane, readsRegister, show, order, settled, runsSettled, scopeDefinition, selectedRunId])

  /* THE COUNTS — one `getExceptionFacets` per SHOW member, each summed over
     severity (see `fetchExceptionCount`). Read on the Close screens only: they
     feed the facets, the greeting's claim and the chrome's "Needs you", and a
     count that failed is `null` — no number is drawn — never a zero. */
  useEffect(() => {
    if (!readsRegister || !settled || !runsSettled) return
    let live = true
    /* Reset first: a count from the PREVIOUS reconciliation drawn beside this
       one's register is the claim RC-03 measured, one click later. */
    setCounts(NO_COUNTS)
    for (const key of SHOW_KEYS) {
      fetchExceptionCount({
        origin: plane.origin,
        status: SHOWS[key].status,
        definitionId: scopeDefinition,
        runId: selectedRunId,
        mineOrUnassigned: SHOWS[key].mine,
      })
        .then((n) => { if (live) setCounts((c) => ({ ...c, [key]: n })) })
        .catch(() => { if (live) setCounts((c) => ({ ...c, [key]: null })) })
    }
    return () => { live = false }
  }, [plane, readsRegister, settled, runsSettled, scopeDefinition, selectedRunId, countsEpoch])

  /* G3626 — THE STRIP'S "N NEED YOU", one count per cell's run: the pack's
     *"5 need you · 14 open"*. Cheap since `0480` — a facet read with `runId`.
     Keyed on the cells' run ids as one string, so a poll that changes nothing
     asks nothing. A failed count draws nothing, never a zero. */
  const stripRunKey = stripRunsOf(runList, scopeDefinition, selectedRunId).map((r) => r.runId).join(' ')
  useEffect(() => {
    if (!readsRegister || !settled || !runsSettled || stripRunKey === '') return
    let live = true
    setNeedsByRun({})
    /* C3-07 — "N need you" on a strip cell is an ACTOR's sentence. */
    if (
      principal !== null &&
      !holds(principal.capabilities, DRAW_GATES.acceptLine) &&
      !holds(principal.capabilities, DRAW_GATES.takeLine)
    ) return
    for (const runId of stripRunKey.split(' ')) {
      fetchExceptionCount({ origin: plane.origin, status: SHOWS.needs.status, runId, mineOrUnassigned: true })
        .then((n) => { if (live) setNeedsByRun((c) => ({ ...c, [runId]: n })) })
        .catch(() => { if (live) setNeedsByRun((c) => ({ ...c, [runId]: null })) })
    }
    return () => { live = false }
  }, [plane, readsRegister, settled, runsSettled, stripRunKey, countsEpoch, principal])

  /* NC-02 (G3443) — WHERE THE READER'S WORK IS, for the default selection:
     one page of their needs-you lines, tenant-wide, reduced to definitions in
     the order the plane answered (most severe first). Read once per boot on
     /close; a refusal leaves the default to the finished-run rule. */
  useEffect(() => {
    if (!readsRegister || !settled) return
    let live = true
    fetchExceptions({ origin: plane.origin, status: SHOWS.needs.status, sort: 'severity_then_value', mineOrUnassigned: true })
      .then((page) => {
        if (!live) return
        setNeedsDefinitions([...new Set(page.items.map((row) => row.definitionId))])
        setNeedsRuns([...new Set(page.items.map((row) => row.runId).filter((id): id is string => id !== null))])
      })
      .catch(() => { if (live) setNeedsDefinitions(null) })
    return () => { live = false }
  }, [plane, readsRegister, settled])

  /* THE CHROME'S "NEEDS YOU" — every open line in the tenant that is
     unassigned or yours. Read on the Close screens, as before. */
  useEffect(() => {
    if (!readsNeedsYou || !settled) return
    let live = true
    fetchExceptionCount({ origin: plane.origin, status: SHOWS.needs.status, mineOrUnassigned: true })
      .then((n) => { if (live) setNeedsYouAll(n) })
      .catch(() => { if (live) setNeedsYouAll(null) })
    return () => { live = false }
  }, [plane, readsNeedsYou, settled, countsEpoch])

  /* HOW THE DOCUMENTS ARRIVED — `listIntakeChannels`. A refusal hides the
     strip rather than captioning it: a lane list is a convenience on C1, and a
     role that cannot read it loses a strip, not the register. */
  useEffect(() => {
    if (!readsRegister || !settled) return
    let live = true
    fetchIntakeLanes({ origin: plane.origin })
      .then((lanes) => { if (live) setIntake({ phase: 'read', lanes }) })
      .catch(() => { if (live) setIntake({ phase: 'refused' }) })
    return () => { live = false }
  }, [plane, readsRegister, settled])

  /* THE SELECTED RUN'S ENGINE ACCOUNT — the arrival's figures. A 404 is the
     honest `no-account` arm, drawn as unmeasured figures and never as zeros. */
  useEffect(() => {
    if (!readsRegister || !settled || selectedRunId === null) return
    let live = true
    setRunAccount({ phase: 'reading' })
    fetchRunAccount({ origin: plane.origin, runId: selectedRunId })
      .then((read) => { if (live) setRunAccount({ phase: 'read', account: read }) })
      .catch((err: unknown) => { if (live) setRunAccount(accountLoadFrom(err)) })
    return () => { live = false }
  }, [plane, readsRegister, settled, selectedRunId, selectedStatus])

  /* THE OPEN ROW — the evidence under it is `getException`, read when the row
     opens and set to `reading` first, so one finding's explanation is never
     drawn under another's line. */
  useEffect(() => {
    if (!readsRegister || !settled || openRow === null) return
    let live = true
    setRowDetail({ phase: 'reading' })
    fetchException({ origin: plane.origin, exceptionId: openRow })
      .then((detail) => { if (live) setRowDetail({ phase: 'read', finding: detail }) })
      .catch((err: unknown) => { if (live) setRowDetail(findingLoadFrom(err)) })
    return () => { live = false }
  }, [plane, readsRegister, settled, openRow])

  /**
   * A THIRD EFFECT, KEYED ON THE REFERENCE IN THE URL. G486.
   *
   * 🛑 IT RE-READS WHEN THE REFERENCE CHANGES AND NOT WHEN THE ROUTE OBJECT
   * DOES. `route` is a fresh object on every settle, so keying on it would
   * re-fetch the same finding every time the back button moved anywhere; the
   * dependency is the STRING, which is the fact the read is about.
   *
   * ⚠️ IT SETS `reading` BEFORE IT ASKS, and that is not decoration: navigating
   * from one finding to another without it would leave the previous finding's
   * fields on screen under the new reference in the heading — a surface saying
   * one thing in the title and another in the body, which on a triage screen
   * is the worst available failure.
   */
  useEffect(() => {
    if (reference === null || !settled) return
    let live = true
    setFinding({ phase: 'reading' })
    fetchException({ origin: plane.origin, exceptionId: reference })
      .then((detail) => {
        if (live) setFinding({ phase: 'read', finding: detail })
      })
      .catch((err: unknown) => {
        if (live) setFinding(findingLoadFrom(err))
      })
    return () => { live = false }
  }, [reference, plane, settled])

  /**
   * A FOURTH EFFECT, KEYED ON THE RUN ID IN THE URL — AND IT ISSUES THREE
   * REQUESTS. G1031.
   *
   * 🛑 THREE REQUESTS AND NOT ONE CHAIN. `getRun`, `getRunAccount` and
   * `listRunResidue` are independent reads and each may fail alone; sequencing
   * them would make the account wait on a run read it does not depend on, and
   * — the direction that actually misleads — a `getRun` 404 would leave the
   * account and the residue reading *"reading"* forever, which on a surface
   * whose subject is what could not be established is indistinguishable from a
   * slow plane. Each read lands in its own arm, which is why there are three
   * state machines rather than one.
   *
   * ⚠️ ALL THREE ARE SET TO `reading` BEFORE ANY IS ASKED, for the reason the
   * finding effect gives: navigating from one run to another without it would
   * leave the previous run's panels on screen under the new id in the heading.
   *
   * ⚠️ AND THE DEPENDENCY IS THE STRING, NOT THE ROUTE OBJECT. `route` is a
   * fresh object on every settle, so keying on it would re-fetch the same run
   * every time the back button moved anywhere.
   */
  useEffect(() => {
    if (openRunId === null || !settled) return
    const origin = plane.origin
    let live = true
    setOneRun({ phase: 'reading' })
    setAccount({ phase: 'reading' })
    setResidue({ phase: 'reading' })

    fetchRun({ origin, runId: openRunId })
      .then((run) => { if (live) setOneRun({ phase: 'read', run }) })
      .catch((err: unknown) => { if (live) setOneRun(runLoadFrom(err)) })

    fetchRunAccount({ origin, runId: openRunId })
      .then((read) => { if (live) setAccount({ phase: 'read', account: read }) })
      .catch((err: unknown) => { if (live) setAccount(accountLoadFrom(err)) })

    fetchRunResidue({ origin, runId: openRunId })
      .then((page) => {
        if (live) setResidue({ phase: 'read', items: page.items, nextCursor: page.nextCursor })
      })
      .catch((err: unknown) => { if (live) setResidue(residueLoadFrom(err)) })

    return () => { live = false }
  }, [openRunId, plane, settled])

  /* RMR-02 / RMR-07 (G3472, G3476) — A RUNNING RUN'S PAGE FOLLOWS THE RUN.
     The page carries a live sign while the run reads, so the run is re-read
     on the same interval as the strip; when it stops reading its account and
     residue are read again. A failed re-read keeps what was read. */
  const runIsReading = oneRun.phase === 'read' && oneRun.run.status === 'running'
  const runTick = useReadingPoll(openRunId !== null && runIsReading)
  useEffect(() => {
    if (openRunId === null || !settled || runTick === 0) return
    const origin = plane.origin
    let live = true
    fetchRun({ origin, runId: openRunId })
      .then((run) => {
        if (!live) return
        setOneRun({ phase: 'read', run })
        if (run.status === 'running') return
        fetchRunAccount({ origin, runId: openRunId })
          .then((read) => { if (live) setAccount({ phase: 'read', account: read }) })
          .catch((err: unknown) => { if (live) setAccount(accountLoadFrom(err)) })
        fetchRunResidue({ origin, runId: openRunId })
          .then((page) => {
            if (live) setResidue({ phase: 'read', items: page.items, nextCursor: page.nextCursor })
          })
          .catch((err: unknown) => { if (live) setResidue(residueLoadFrom(err)) })
      })
      .catch(() => { /* one missed poll is not an unreadable run */ })
    return () => { live = false }
  }, [openRunId, plane, settled, runTick])

  /**
   * Take a line, put it down, take it over or release it — RC-04 (the owner's,
   * G3423) and RC-05.
   *
   * ⚠️ THE SESSION IS READ AGAIN HERE RATHER THAN CLOSED OVER, for the reason
   * `openRun` states: *"A stale credential held in a closure is the shape that
   * keeps a signed-out tab working, and the tenant behind that session is the
   * thing it would keep working AS."*
   *
   * 🛑 THE ANSWER IS APPLIED TO THE ROW RATHER THAN ASSUMED — and since RC-05
   * it is MERGED, not swapped in. `assignException` answers an `Exception`,
   * which carries no `summary`; swapping it in for the queue row erased the
   * line's text on every Take and Release. `mergeAssignment()` takes exactly
   * the two fields the act changed from what the plane STORED.
   *
   * 🛑 `assignedTo` IS THE READER'S OWN USER ID (`getSessionPrincipal`), NEVER
   * AN ALIAS. The register sent `'me'` and the plane stored it (RC-14); the
   * plane now refuses a value that names no member (G3426).
   *
   * ⚠️ AN ACT ON A COLLEAGUE'S LINE WAS CONFIRMED IN THE REGISTER, AND IT IS
   * UNDONE HERE: an undo notice puts the line back with whoever held it. A
   * failure is a failure notice, and the register is NOT replaced by a refusal —
   * one refused write is not an unreadable register.
   */
  const assign = (act: AssignAct): void => {
    const next = toastSeq + 1
    setToastSeq(next)
    assignException({ origin: plane.origin, exceptionId: act.exceptionId, assignedTo: act.assignedTo })
      .then((written) => {
        setExceptions((current) =>
          current.phase === 'read'
            ? {
                ...current,
                rows: current.rows.map((r) => (r.exceptionId === written.exceptionId ? mergeAssignment(r, written) : r)),
              }
            : current,
        )
        setCountsEpoch((e) => e + 1)
        if (act.displaces) {
          toasts.raise({
            id: `assign-${String(next)}`,
            kind: 'undo',
            title: act.assignedTo === null ? 'Released — the line is with nobody now.' : 'Taken over — the line is with you now.',
            body: 'It was with a colleague.',
            action: {
              label: 'Undo',
              run: () => {
                assign({ exceptionId: act.exceptionId, assignedTo: act.prior, prior: act.assignedTo, displaces: false })
              },
            },
          })
        }
      })
      .catch((err: unknown) => {
        const status = err instanceof PlaneRefused ? err.status : null
        toasts.raise({
          id: `assign-${String(next)}`,
          kind: 'fail',
          title: 'The line was not changed.',
          body:
            status === 403
              ? 'Taking lines is not part of your role.'
              : status === 429
                ? 'Too many requests from this browser — try again in a minute.'
                : status === 422
                  ? 'That person is not a member of this tenant.'
                  : 'The change did not reach the register. Try again.',
        })
      })
  }

  /* G3641 — the register's Accept and Reopen (`register-acts-run.ts`). The
     line is merged from what the plane STORED, as Take's is; `actsEpoch`
     re-reads the counts and the Approvals queue after an act moves a line. */
  const [actsEpoch, setActsEpoch] = useState(0)
  const lineActs = useRegisterActs({
    origin: plane.origin,
    toasts,
    mayPost: holds(principal?.capabilities ?? null, DRAW_GATES.postResolution),
    onLine: (written) => {
      setExceptions((current) =>
        current.phase === 'read'
          ? { ...current, rows: current.rows.map((r) => (r.exceptionId === written.exceptionId ? mergeAssignment(r, written) : r)) }
          : current,
      )
    },
    onMoved: () => {
      setCountsEpoch((e) => e + 1)
      setActsEpoch((e) => e + 1)
    },
    toFinding: (exceptionId: string) => {
      router.navigate(hrefOf('/close/finding/:ref', { ref: exceptionId }))
    },
  })

  /* C3-07 — who the greeting speaks to, and whose controls the chrome draws.
     `null` while the principal is unread: nothing is claimed for the wrong role. */
  const heldNow = principal?.capabilities ?? null
  const mayApprove = holds(heldNow, DRAW_GATES.approvals)
  const role = heldNow === null
    ? null
    : claimRoleOf({
        act: holds(heldNow, DRAW_GATES.acceptLine) || holds(heldNow, DRAW_GATES.takeLine),
        approve: mayApprove,
      })

  useEffect(() => {
    if (!settled || !onCloseScreens || !mayApprove) {
      setApprovalsWaiting(null)
      return
    }
    let live = true
    loadApprovalsWaiting(plane.origin, principal?.userId ?? null)
      .then((items) => { if (live) setApprovalsWaiting(items.length) })
      .catch(() => { if (live) setApprovalsWaiting(null) })
    return () => { live = false }
  }, [plane, settled, onCloseScreens, mayApprove, principal?.userId, actsEpoch, countsEpoch])

  useEffect(() => {
    if (!readsRegister || !settled || !runsSettled || role !== 'viewer') return
    let live = true
    setOpenCount(null)
    fetchExceptionCount({
      origin: plane.origin,
      status: ['open', 'investigating'],
      definitionId: scopeDefinition,
      runId: selectedRunId,
      mineOrUnassigned: false,
    })
      .then((n) => { if (live) setOpenCount(n) })
      .catch(() => { if (live) setOpenCount(null) })
    return () => { live = false }
  }, [plane, readsRegister, settled, runsSettled, role, scopeDefinition, selectedRunId, countsEpoch])

  useEffect(() => {
    if (!readsRegister || !settled || !runsSettled || selectedRunId === null || scopeDefinition === null) {
      setUnattributed([])
      return
    }
    let live = true
    /* No served filter selects `run_id IS NULL`, so the reconciliation's
       lines are read unscoped by run and the run-less ones kept. ⚠️ ONE PAGE:
       a run-less line beyond the first page of the reconciliation is not
       listed here (the plane's paging is by severity, so the most severe are). */
    fetchExceptions({
      origin: plane.origin,
      status: SHOWS[show].status,
      sort: order,
      definitionId: scopeDefinition,
      mineOrUnassigned: SHOWS[show].mine,
    })
      .then((page) => { if (live) setUnattributed(page.items.filter((r) => r.runId === null)) })
      .catch(() => { if (live) setUnattributed([]) })
    return () => { live = false }
  }, [plane, readsRegister, settled, runsSettled, selectedRunId, scopeDefinition, show, order, countsEpoch])

  /* C3-11 — when was each cleared line's resolution posted? Read for the
     lines a Reopen could be drawn on, only for a session that may reverse;
     a line whose time is unread is NOT reopenable (unread is not held). */
  const mayReverse = holds(heldNow, DRAW_GATES.reopenLine)
  const clearedKey = [...(exceptions.phase === 'read' ? exceptions.rows : []), ...unattributed]
    .filter((r) => r.status === 'resolved' || r.status === 'rejected' || r.status === 'dismissed')
    .map((r) => r.exceptionId)
    .join(' ')
  useEffect(() => {
    if (!mayReverse || clearedKey === '') {
      setReopenable(new Set())
      return
    }
    let live = true
    const ids = clearedKey.split(' ')
    Promise.all(
      ids.map((exceptionId) =>
        fetchException({ origin: plane.origin, exceptionId })
          .then((d) => (reopenWindowOpen(d.resolution?.at, new Date()) ? exceptionId : null))
          .catch(() => null),
      ),
    ).then((open) => {
      if (live) setReopenable(new Set(open.filter((id): id is string => id !== null)))
    })
    return () => { live = false }
  }, [plane, mayReverse, clearedKey])

  const runs = load.phase === 'read' ? load.runs : []
  const nextCursor = load.phase === 'read' ? load.nextCursor : null

  /* ONE LIGHT PER VIEW — `luminous.ts` (RM-07). The open row's evidence wins
     when it is DRAWN; otherwise the reading reconciliation's cell. */
  const openPanel =
    exceptions.phase === 'read' && openRow !== null && exceptions.rows.some((r) => r.exceptionId === openRow)
      ? openRow
      : null
  const stripRuns = stripRunsOf(runs, group?.definitionId ?? null, selectedRunId)
  const lit = litTargetOf({ openPanel, stripRuns })
  /* RMR-04 (G3471, the owner's) — the one reading run whose mark works; every
     other reading cell draws the still mark. */
  const workingRunId = workingRunOf(stripRuns)
  const registerRead = exceptions.phase === 'read'
  const entity = principal?.tenant === null || principal?.tenant === undefined
    ? null
    : principal.tenant.name ?? principal.tenant.tenantId
  /* C3-08 — Close (the link, the mark, the tab) returns to the register from
     the Approvals destination as well as from another route. */
  const closeBase = linkTo(router, hrefOf('/close', {}))
  const closeLink = {
    href: closeBase.href,
    onClick: (e: Parameters<typeof closeBase.onClick>[0]) => {
      setCloseDest('close')
      closeBase.onClick(e)
    },
  }
  const needsYouGo = (): void => {
    setCloseDest('close')
    setShow('needs')
    if (!readsRegister) router.navigate(hrefOf('/close', {}))
  }

  /**
   * THE SCREENS, AND THERE ARE THREE OF THEM.
   *
   * ⚠️ THIS SAID TWO UNTIL 20 Sep 2026 (G1031). The third is
   * `/close/run/:runId`, drawn against `getRun`, `getRunAccount` and
   * `listRunResidue` — **all three MOUNTED since G300 on 19 Sep 2026**, and
   * all three unconsumed by this application until now.
   *
   * 🛑 THE KEYS ARE MEMBERS OF `RoutePath` AND A THIRTEENTH IS `TS2353`.
   * `Screens` is a partial MAPPED TYPE over the closed set, so this object
   * cannot grow a route — which is the acceptance criterion *"a route added by
   * hand in a component is a test failure"* holding at the exact place a
   * component would otherwise add one.
   *
   * ⚠️ ELEVEN ROUTES ARE ABSENT FROM THIS OBJECT AND THAT IS THE DESIGN, NOT AN
   * OMISSION. An absent key falls through to the scope renderer, which says in
   * words that the route resolves and has no screen — a GAP stated, not a
   * refusal marked. Adding placeholder entries here would be the *"twelve
   * places a thirteenth route could be grown by hand"* `screens.ts` refuses.
   *
   * ⚠️ **THIS SAID NINE UNTIL 22 Sep 2026 AND WAS CORRECT WHEN WRITTEN.**
   * G1911 added `/demo` and `/lookup` to `ROUTE_PATHS` — the pack's two
   * PUBLIC-plane routes — and neither gets a screen here, deliberately: the
   * pack's Exists column marks both `specified`, the content is a parked
   * slice, and a placeholder would be the thing this paragraph refuses.
   * **Derive the two numbers rather than reading them**; both move on every
   * frontend slice.
   *
   * 🛑 **AND WHOEVER TAKES THAT PARKED SLICE HAS A DRAWING TO WORK FROM —
   * G1917, 22 Sep 2026.** *Specified* is the pack's STATUS word and not a
   * statement that nothing is drawn: `docs/handoff-pack/V2 Book a Demo.dc.html`
   * draws the two-step demo form and `V3 Sign In.dc.html` draws the
   * email-lookup states, and `frontend/src/routes/table.ts` cites each by
   * record and anchor. **`screens.ts` rendered *"drawn nowhere"* for both for
   * a few hours and it was false**; the two facts this file keeps apart are
   * *drawn* and *screened*, and only the second is absent here.
   *
   * ✅ **BOTH HAVE A SCREEN SINCE 2 Oct 2026 — G3071–G3077 — AND STILL NOT
   * HERE.** They are rendered by `App` below, OUTSIDE this component, so the
   * chrome bar is not drawn over them and the four `/v1` effects above never
   * mount for a visitor. The paragraphs above are kept because they are the
   * reasoning this one corrects: *"neither gets a screen here"* is still true
   * of THIS object, and false of the application.
   */
  const screens: Screens = {
    /**
     * ✅ W3/S7 — the fourth screen, G2502: returning from the directory. It
     * completes the sign-in S6 mounted and navigates on to the landing PATH
     * the plane chose. See `components/SignInCallback.tsx`.
     */
    /**
     * ✅ THE FIFTH SCREEN — 1 Oct 2026, G2541: `/signin`, the begin half. It
     * asks which door, pins it (`beginFederatedSignIn`), keeps the tab's
     * `state` and verifier, and sends the browser to the directory. See
     * `components/SignIn.tsx`.
     */
    '/signin': () => <SignIn />,
    '/signin/callback': () => <SignInCallback />,
    '/close': () => closeDest === 'approvals' && mayApprove ? (
      /* C3-08 — THE APPROVALS DESTINATION: the pack's pane, its own words, and
         the queue of every proposal this reader may approve, tenant-wide. */
      <div className="page approvals-dest" data-dest="approvals">
        <header className="head">
          <span className="lab">Approvals</span>
          <h1>What is waiting on your authority</h1>
          <p className="q">
            The evidence behind each proposal, rather than a summary of it. Posting writes the journal;
            refusing writes a reason onto the line it touched.
          </p>
        </header>
        <ApprovalsQueue
          key={actsEpoch}
          origin={plane.origin}
          viewer={principal?.userId ?? null}
          postLinkFor={(exceptionId: string) =>
            linkTo(router, hrefOf('/close/finding/:ref/post', { ref: exceptionId }))}
        />
      </div>
    ) : (
      <Shell
        runs={runs}
        runsState={load.phase === 'read' ? 'read' : load.phase === 'reading' ? 'reading' : 'refused'}
        {...(load.phase === 'refused' ? { runsRefusal: refusalKindOf(load.status) } : {})}
        registerReadable={registerRead}
        litRunId={lit.kind === 'strip' ? lit.runId : null}
        workingRunId={workingRunId}
        needsByRun={needsByRun}
        entity={entity}
        nextCursor={nextCursor}
        /* The refused `?plane=` is named in the status bar — the one place on
           C1 that states where the screen's data came from. */
        {...(plane.refused === null ? {} : { provenance: plane.refused })}
        selectedDefinition={group?.definitionId ?? null}
        selectedRunId={selectedRunId}
        onSelectDefinition={(definitionId: string) => {
          setPickedDefinition(definitionId)
          setPickedRun(null)
          setOpenRow(null)
        }}
        onSelectRun={setPickedRun}
        account={runAccount}
        intake={intake}
        greeting={greetingFor(new Date(), principal?.displayName ?? null)}
        /* RC-16 — no claim while the register is still being read. */
        needsYou={registerRead ? counts.needs : null}
        total={registerRead ? counts.all : null}
        role={role}
        openCount={registerRead ? openCount : null}
        approvalsWaiting={approvalsWaiting}
        onApprovals={() => { setCloseDest('approvals') }}
        /* 🛑 THE LINK IS BUILT FROM THE CLOSED SET AND THE ROW SUPPLIES ONLY
           THE BINDING — `hrefOf` percent-encodes it, so a plane-supplied run id
           cannot re-address the href. Identical shape to `findingLink` below,
           deliberately: two routes, one way of spelling a path. */
        accountLink={(runId: string) =>
          linkTo(router, hrefOf('/close/run/:runId', { runId }))}
        exceptions={
          <>
          {/* C9 · ROWS 18 AND 19 — the parked pile, COUNTED APART from the
              register below it (G3501): its own read, its own section, and no
              count the facets or the chrome draw. See `ParkedPile.tsx`. */}
          <ParkedPile origin={plane.origin} />
          <ExceptionRegister
            rows={exceptions.phase === 'read' ? exceptions.rows : []}
            state={exceptions.phase === 'read' ? 'read' : exceptions.phase === 'reading' ? 'reading' : 'refused'}
            {...(exceptions.phase === 'refused' ? { refusal: refusalKindOf(exceptions.status) } : {})}
            scope={group?.label ?? null}
            me={principal?.userId ?? null}
            litPanel={lit.kind === 'panel'}
            nextCursor={exceptions.phase === 'read' ? exceptions.nextCursor : null}
            estimatedTotal={exceptions.phase === 'read' ? exceptions.estimatedTotal : null}
            counts={counts}
            show={show}
            onShow={setShow}
            order={order}
            onOrder={setOrder}
            onAssign={assign}
            onAccept={lineActs.accept}
            onReopen={lineActs.reopen}
            actBusy={lineActs.busy}
            notConfigured={lineActs.notConfigured}
            reopenable={reopenable}
            /* 🛑 THE LINK IS BUILT FROM THE CLOSED SET AND THE ROW SUPPLIES
               ONLY THE BINDING. `hrefOf` percent-encodes it, so a
               plane-supplied id cannot re-address the href — which is the one
               safe way to satisfy `ExceptionRegister.tsx`'s own rule that a
               row field must never reach a `href` raw. */
            findingLink={(exceptionId: string) =>
              linkTo(router, hrefOf('/close/finding/:ref', { ref: exceptionId }))}
            openRow={openRow}
            onToggle={(exceptionId: string) => {
              setOpenRow((current) => (current === exceptionId ? null : exceptionId))
            }}
            detail={rowDetail}
          />
            {/* C3-18 — THE OWNER'S RULING, 4 Oct 2026: *"show run-less
                exceptions in an 'Unattributed' section of the register."* A line
                whose raising run was not recorded is in no run's register, and
                was counted by the bell and reachable from no screen. */}
            {unattributed.length === 0 ? null : (
              <ExceptionRegister
                section={{
                  heading: 'Unattributed',
                  note: `${String(unattributed.length)} ${unattributed.length === 1 ? 'line' : 'lines'} of ${group?.label ?? 'this reconciliation'} whose run was not recorded.`,
                }}
                rows={unattributed}
                state="read"
                me={principal?.userId ?? null}
                nextCursor={null}
                estimatedTotal={null}
                onAssign={assign}
                onAccept={lineActs.accept}
                onReopen={lineActs.reopen}
                actBusy={lineActs.busy}
                notConfigured={lineActs.notConfigured}
                reopenable={reopenable}
                findingLink={(exceptionId: string) =>
                  linkTo(router, hrefOf('/close/finding/:ref', { ref: exceptionId }))}
              />
            )}
            {/* ⛔ C5's queue is no longer drawn under the register — the owner's
                C3-08 ruling made Approvals a nav destination (above), amending
                G3436/G3469, whose reason (*"nothing the client holds says who
                is one"*) ended with G3522. */}
          </>
        }
      />
    ),
    '/close/finding/:ref': (params) => (
      <Finding
        /* The matcher's binding, not `reference` — they are the same string by
           construction, and reading the one the renderer was handed keeps this
           screen a pure function of its resolution rather than of a value
           computed beside it. */
        reference={params['ref'] ?? ''}
        load={finding}
        viewer={principal?.userId ?? null}
        back={linkTo(router, hrefOf('/close', {}))}
        /* C4 — what you can do. Mounted once the finding is read: the panel
           needs its value at risk (an adjustment's currency) and its status. */
        {...(finding.phase === 'read'
          ? {
              resolve: (
                <ResolvePanel
                  origin={plane.origin}
                  finding={finding.finding}
                  viewer={principal?.userId ?? null}
                  postLink={linkTo(router, hrefOf('/close/finding/:ref/post', { ref: finding.finding.exceptionId }))}
                />
              ),
            }
          : {})}
      />
    ),
    /**
     * C5 — APPROVE AND POST, at the drawn record's `/close/finding/:ref/post`.
     * The screen owns its reads (`getException`, `listProposals`) and its
     * writes (`decideApproval`, `executeProposal`), as Setup does, and is
     * mounted only once D1 has settled for Setup's reason.
     */
    '/close/finding/:ref/post': (params) =>
      settled ? (
        <PostProposal
          origin={plane.origin}
          reference={params['ref'] ?? ''}
          viewer={principal?.userId ?? null}
          close={linkTo(router, hrefOf('/close', {}))}
          findingLink={linkTo(router, hrefOf('/close/finding/:ref', { ref: params['ref'] ?? '' }))}
          postLinkFor={(exceptionId: string) =>
            linkTo(router, hrefOf('/close/finding/:ref/post', { ref: exceptionId }))}
        />
      ) : (
        <p className="text-body" role="status" data-binding="pending">Opening your workspace.</p>
      ),
    /* RC-01 — the routes that rendered the route layer's own scope. `/` on a
       tenant host decides between the register and sign-in; `/signin/lapsed`
       is E1's 401; the rest are the pack's quiet panes. */
    '/': () => <EntryRoot origin={plane.origin} />,
    '/signin/lapsed': () => <ErrorPage code="401" quote="this browser’s session ended" />,
    '/invite': () => <InvitePage />,
    '/ask': () => <AskPage />,
    '/reports': () => <ReportsPage />,
    /**
     * 🛑 G1031 — THE RUN'S OWN ACCOUNT, AND THE HATCH IT REPLACES WAS FALSE.
     * `Register.tsx` refused this control on G200 with
     * *"getRunAccount and listRunResidue are declared and not mounted"*, one
     * day before G300 mounted both. Derive the mount, never read it:
     * `grep -n 'getRunAccount\|listRunResidue' server/data-plane/start.ts`.
     */
    '/close/run/:runId': (params) => (
      <>
      {/* RMR-07 (G3476) — the run's own page carries the live sign while the
          run reads; RMR-02's poll takes it down when the run finishes. */}
      {runIsReading ? <LiveRun /> : null}
      <RunAccount
        /* The matcher's binding, not `openRunId` — they are the same string by
           construction, and reading the one the renderer was handed keeps this
           screen a pure function of its resolution. */
        runId={params['runId'] ?? ''}
        run={oneRun}
        account={account}
        residue={residue}
        back={linkTo(router, hrefOf('/close', {}))}
      />
      </>
    ),
    /**
     * C9 · SETUP — G2875. The screen owns its own reads and writes, unlike the
     * register's, because nothing else on any route reads a source and lifting
     * six operations' state into this component would be state no other screen
     * consumes. `origin` is the ONE thing it takes, and it is the plane origin
     * `planeFrom()` already allowlisted — the session token's destination.
     */
    /* ⚠️ MOUNTED ONLY ONCE D1 HAS SETTLED (G3213): `Setup` issues its own
       reads on mount, and a read racing the bind answers
       `tenant_context_missing` for a session that is about to be bound. */
    '/setup': () =>
      settled ? (
        <Setup origin={plane.origin} />
      ) : (
        <p className="text-body" role="status" data-binding="pending">Opening your workspace.</p>
      ),
  }

  /* E1 in place of the register, when both of its reads failed the same way.
     See `registerErrorOf()`; it is computed only on the route that reads. */
  const registerError = readsRegister ? registerErrorOf(load, exceptions) : null
  const chromeless = signedOut || registerError !== null

  /* G3044: a real title per route. `index.html` carried the specimen's —
     *"ReconcileAI — kernel primitives"* — on every page. */
  const title = titleOf(route, registerError === null ? null : ERROR_TITLE[registerError.code])
  useEffect(() => {
    document.title = title
  }, [title])

  return (
    /* G3522 — what this session may do, for DRAWING only (`capabilities.ts`). */
    <HeldCapabilities.Provider value={principal?.capabilities ?? null}>
    <div className={chromeless ? undefined : 'app'}>
      {/* 🛑 OUTSIDE THE ROUTE, AND THAT IS THE MOVE THIS SLICE MADE. The bar
          used to be rendered by `Shell`, so it existed on exactly one surface;
          it is app chrome and now sits beside `RouteView`.
          ⚠️ IT SAID *"drawn on every route including the 404"* UNTIL 2 Oct 2026
          AND IS CORRECTED RATHER THAN DELETED — G3041. A signed-out surface
          (`routes/surfaces.ts`: the `Entry` tier, the `public` plane and every
          unknown address) and E1 in place of the register draw NO bar: the bar
          is a session's controls and those pages exist because there is none.
          It still TAKES NOTHING — G216's fence is
          untouched, and no control in it is a function of any route's load
          state.

          ⚠️ AND ITS THREE DESTINATIONS ARE STILL FRAGMENT LINKS, WHICH IS A
          KNOWN GAP RATHER THAN AN OVERSIGHT. The wordmark's own comment says
          it *"returns to Close"*, and `href="#register"` does not do that from
          `/close/finding/:ref`. Turning it into a route link is a one-line
          change and it is NOT made here, because `Ask` and `Reports` carry the
          hatch and a hatched control that navigates is a control claiming to
          be refused while acting — G216's error inverted. Which of the three
          become route links is a design decision, and this slice does not take
          it.

          ⚠️ IT TAKES TWO THINGS SINCE 2 Oct 2026 (G2877) AND NEITHER IS LOAD
          STATE: the Setup door's link, and whether the route IS Setup — inside
          Setup no destination is current. G216's fence is about the connection
          light binding to a fetch, and neither prop reaches it. */}
      {/* C3-28 (G4043) — THE FIRST TAB STOP. The quiet controls G189 keeps in
          the tab order (the entity switcher, the lanes, Rename, ← →, *Read by
          the machine*) stood between a keyboard and the register; this is the
          one stop past all of them, to the register on `/close` and to the
          route's own root everywhere else. It is FIRST in the document, which
          is the property `SkipLink.tsx` says a component cannot hold alone. */}
      {chromeless ? null : readsRegister ? (
        <SkipLink target={REGISTER_ID}>Skip to the register</SkipLink>
      ) : (
        <SkipLink target={ROUTE_ROOT_ID}>Skip to the content</SkipLink>
      )}
      {chromeless ? null : (
        <ChromeBar
          close={closeLink}
          setup={linkTo(router, hrefOf('/setup', {}))}
          inSetup={route.kind === 'route' && route.path === '/setup'}
          onClose={onCloseScreens}
          needsYou={readsNeedsYou ? needsYouAll : null}
          needsYouPressed={readsRegister && show === 'needs' && closeDest === 'close'}
          onNeedsYou={needsYouGo}
          /* C3-07 — the chip is an ACTOR's: the approver's work is Approvals
             and the assurance reader acts on nothing. */
          needsYouShown={role === 'actor'}
          approvals={{
            count: approvalsWaiting,
            current: readsRegister && closeDest === 'approvals',
            onGo: () => {
              setCloseDest('approvals')
              if (!readsRegister) router.navigate(hrefOf('/close', {}))
            },
          }}
          boundTenant={binding.phase === 'bound' ? binding.context.tenantId : null}
          principal={principal}
          residency={binding.phase === 'bound' ? binding.context.residency : null}
          /* RV-13 (G3392, the owner's) — the theme toggle lives in the account
             menu, beside what is about the PERSON (G3433). */
          themeToggle={<ThemeToggle menu />}
          onSignOut={() => {
            void signOutAt(plane.origin).then(() => { window.location.assign('/signin') })
          }}
          {...(TEST_PERSONAS_ENABLED ? { switcher: <ProfileSwitcher placement="menu" /> } : {})}
        />
      )}
      {registerError === null ? (
        <RouteView resolution={route} screens={screens} />
      ) : (
        routeRoot(<ErrorPage code={registerError.code} quote={registerError.quote} />)
      )}
      {/* G3003 — the STAGING profile switcher, `null` in every build but a test
          build by a compile-time constant (`test-personas.ts`). G3191: when
          the chrome is drawn it lives in the account menu (above); a
          signed-out surface has no account menu, so it is drawn here. */}
      {chromeless ? <ProfileSwitcher placement="page" /> : null}
      {/* RC-04 — the undo and failure notices for acts on a line. Mounted
          beside the route, so a notice outlives the row it is about. */}
      {/* RC-07 — the narrow tier's bottom tab bar; `close.css` shows it below
          720px only, where the chrome sheds its destinations. */}
      {chromeless ? null : (
        <TabBar close={closeLink} onClose={onCloseScreens} />
      )}
      {chromeless ? null : <ToastRegion store={toasts} />}
    </div>
    </HeldCapabilities.Provider>
  )
}

/**
 * THE TWO PUBLIC-PLANE ROUTES REDIRECT TO THE APEX — G3156, 2 Oct 2026, under
 * the OWNER'S ruling of the same day, which answers G3078: *"Apex only: serve
 * /demo and /lookup from the apex marketing site (Amplify); tenant/console hosts
 * redirect there."*
 *
 * ⚠️ THIS READ *"THE TWO PUBLIC-PLANE ROUTES, RENDERED OUTSIDE `ShellApp` —
 * G3077"* AND IT IS CORRECTED RATHER THAN DELETED, because its reasoning is the
 * half that survives: `/demo` and `/lookup` are a visitor's, with no session,
 * no tenant and no chrome, and inside `ShellApp` they were drawn under the
 * chrome bar while its four effects fired `/v1` reads a visitor cannot answer.
 * G3077 fixed that by rendering the pack's screens HERE, outside `ShellApp`;
 * G3078 put back to the owner whether this bundle may render the public plane
 * at all, and **the owner said no**. Both screens moved to the apex site
 * (`frontend/site/`), the one host `/demo/intake` is routed at, and this
 * bundle now renders NEITHER. It sends the visitor there.
 *
 * 🛑 STILL KEYED ON THE TWO PATHS BY NAME, and still OUTSIDE `ShellApp`, so no
 * chrome is drawn and no `/v1` read fires on the way out. `location.replace`
 * rather than `assign`: the tenant-host URL was never a page, and Back should
 * not return to a redirect. The line below the effect is what a visitor sees
 * for a moment; it is a link, so it also works if the navigation is blocked.
 */
function MovedToApex({ path }: { readonly path: ApexPath }) {
  const target = apexUrlFor(path)
  useEffect(() => {
    window.location.replace(target)
  }, [target])
  return (
    <main className="route" data-moved-to-apex={path}>
      <p>
        This page is on the ReconcileAI site: <a href={target}>{target}</a>
      </p>
    </main>
  )
}

/**
 * THE SURFACE THIS HOST SERVES — G3321, 3 Oct 2026. Decided ONCE, at module
 * scope, because a host does not change under a page; `routes/surface.ts` is
 * the one place the rule lives and the partner portal's slice reads it too.
 */
const SURFACE = surfaceOf(window.location.hostname)

/**
 * WHO IS SIGNED IN ON A CONSOLE HOST — `getSessionPrincipal` (G3354), read
 * once per mount for the staff console's and the partner portal's chrome
 * (G3373). `null` while unread or unreadable, and the chrome then says nothing
 * about who is signed in, which is true; a name is never invented.
 */
function useSessionPrincipal(origin: string): SessionPrincipal | null {
  const [principal, setPrincipal] = useState<SessionPrincipal | null>(null)
  useEffect(() => {
    let live = true
    fetchSessionPrincipal(origin)
      .then((p) => { if (live) setPrincipal(p) })
      .catch(() => { if (live) setPrincipal(null) })
    return () => { live = false }
  }, [origin])
  return principal
}

/**
 * THE STAFF CONSOLE ON THE CONSOLE HOST'S `/` — G3322.
 *
 * ⚠️ `/` ON A CONSOLE HOST RENDERED THE TENANT SHELL'S UNBUILT-ENTRY SCOPE —
 * *"This route resolves. It has no screen yet."* — to a staff person who had
 * just signed in, because the sign-in lands a console on `/`
 * (`SIGN_IN_LANDING`) and nothing here asked which surface the host was.
 * Measured on staging, 3 Oct 2026. The pack's route map names the staff
 * console as a HOST surface with no path of its own (`User Journeys`, the
 * `staff console` row), so it is drawn at `/` of that host and adds nothing to
 * the closed `ROUTE_PATHS` set.
 *
 * 🛑 OUTSIDE `ShellApp`, so the tenant chrome is not drawn and none of its
 * `/v1` reads or the D1 bind fire for a session that has no tenant (G726).
 */
function StaffConsoleApp() {
  const [plane] = useState<Plane>(() => planeFrom(location.search))
  const principal = useSessionPrincipal(plane.origin)
  return (
    <HeldCapabilities.Provider value={principal?.capabilities ?? null}>
      <StaffConsole
        origin={plane.origin}
        principal={principal}
        {...(TEST_PERSONAS_ENABLED ? { switcher: <ProfileSwitcher placement="menu" /> } : {})}
      />
    </HeldCapabilities.Provider>
  )
}

/**
 * THE PARTNER HOST — THE HOST DECIDES THE SURFACE — G3291–G3296, 3 Oct 2026.
 *
 * 🛑 A PARTNER SIGNING IN ON `partners.reconcileai.app` LANDED ON `/` AND WAS
 * SHOWN THE TENANT APPLICATION'S ROUTE PLACEHOLDER, measured on staging. The
 * plane lands every console sign-in on `/` (`SIGN_IN_LANDING.console`) and
 * reports no surface kind to the browser, so the surface is read off the
 * host's first label against the reserved console labels the edge itself
 * binds (`routes/surface.ts` argues why that and not a plane read — one
 * module since G3371).
 *
 *   · partner host — every signed-in address is the PORTAL: `/` and
 *     `/partner/deals` are Deals, `/partner/sandbox` and `/partner/people` their
 *     panes, and a tenant work address (`/close`, `/setup`, …) is Deals too —
 *     a partner session never reaches the tenant shell or its D1. The sign-in
 *     surfaces stay where they are, because that is how a partner gets here.
 *   · staff console host — `/` is the S1 staff console (`StaffConsole`,
 *     G3322). ⚠️ #542 drew an interim quiet front door here (`ConsoleHome`);
 *     #538 built the real screen the same day and the integration routes
 *     `/` to it and deletes the interim (G3372).
 *   · tenant host — unchanged; a portal address there is a 404, because the
 *     portal is not served on a tenant host and a tenant-host session could
 *     read none of it (G180).
 */
const PARTNER_DEST_OF: { readonly [P in RoutePath]?: PartnerDest } = {
  '/': 'deals',
  '/partner/deals': 'deals',
  '/partner/sandbox': 'sandbox',
  '/partner/people': 'people',
}

const PARTNER_TITLE: { readonly [D in PartnerDest]: RoutePath } = {
  deals: '/partner/deals',
  sandbox: '/partner/sandbox',
  people: '/partner/people',
}

function partnerDestOf(route: Resolution): PartnerDest | null {
  if (route.kind !== 'route') return null
  const named = PARTNER_DEST_OF[route.path]
  if (named !== undefined) return named
  /* Every other signed-in address on the partner host is the portal's first
     pane; the signed-out ones (`/signin`, the callback) are left to render. */
  return isSignedOutSurface(route) ? null : 'deals'
}

function PartnerScreen({ dest }: { readonly dest: PartnerDest }) {
  const [plane] = useState<Plane>(() => planeFrom(location.search))
  const principal = useSessionPrincipal(plane.origin)
  const title = titleOf({ kind: 'route', path: PARTNER_TITLE[dest], params: {} })
  useEffect(() => {
    document.title = title
  }, [title])
  return (
    <HeldCapabilities.Provider value={principal?.capabilities ?? null}>
      <PartnerPortal
        origin={plane.origin}
        principal={principal}
        dest={dest}
        links={{
          deals: linkTo(router, hrefOf('/partner/deals', {})),
          sandbox: linkTo(router, hrefOf('/partner/sandbox', {})),
          people: linkTo(router, hrefOf('/partner/people', {})),
        }}
        {...(TEST_PERSONAS_ENABLED ? { switcher: <ProfileSwitcher placement="menu" /> } : {})}
      />
    </HeldCapabilities.Provider>
  )
}

function App() {
  const route = useRoute(router)
  if (route.kind === 'route' && isApexPath(route.path)) return <MovedToApex path={route.path} />
  if (SURFACE === 'partner') {
    const dest = partnerDestOf(route)
    if (dest !== null) return <PartnerScreen dest={dest} />
  } else if (route.kind === 'route' && route.path.startsWith('/partner/')) {
    return routeRoot(<ErrorPage code="404" quote={route.path} />)
  }
  if (SURFACE === 'console' && route.kind === 'route' && route.path === '/') return <StaffConsoleApp />
  return <ShellApp />
}

/* RV-13 (G3392, THE OWNER'S): the theme follows the OS setting, overridable by
   the account menu's toggle. Before the first render, so no frame paints in
   the wrong theme; public/theme-boot.js has usually done it already. */
startTheme()

const mount = document.getElementById('root')
if (mount === null) throw new Error('no #root in index.html')

createRoot(mount).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
