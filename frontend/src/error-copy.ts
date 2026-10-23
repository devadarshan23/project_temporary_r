/**
 * E1's COPY, PER HOST — the records `components/ErrorPage.tsx` draws, in a
 * `.ts` module so `node --test` drives them without a renderer (G3581). The
 * argument for every word is on `ErrorPage.tsx`'s header; this file is its
 * data and the one function that fills a record for a host.
 */
import { SITE_HOME } from './routes/apex.ts'
import type { Surface } from './routes/surface.ts'

export type ErrorCode = '401' | '403' | '404' | '429' | '500' | '503'

export interface Way {
  readonly label: string
  readonly note: string
  readonly to: string
}

/** The slot a record fills with THIS host's home way — `HOME_WAY`. */
const HOME = 'home'
/** A way whose TARGET is this host's home but whose words are the record's own (the 503's retry). */
const HOME_PATH = 'home-path'
type WaySlot = typeof HOME | Way | (Omit<Way, 'to'> & { readonly to: typeof HOME_PATH })

export interface ErrorCopy {
  readonly kind: string
  readonly head: string
  readonly said: string
  readonly means: string
  readonly refWhy: string
  readonly own: string | null
  readonly ways: readonly [WaySlot, WaySlot]
}

/** A record whose ways are filled for one host. */
export type FilledCopy = Omit<ErrorCopy, 'ways'> & { readonly ways: readonly [Way, Way] }

const SIGN_IN: Way = { label: 'Sign in again', note: 'your organisation’s directory', to: '/signin' }
const SITE: Way = { label: 'Back to the site', note: 'nothing needed', to: SITE_HOME }

/**
 * EACH HOST'S OWN HOME — G3581, the owner's. Total over `Surface`, and each is
 * a path that host SERVES: the register on a tenant host, the portal and the
 * console at their own `/` (`main.tsx` draws both there).
 */
export const HOME_WAY: { readonly [S in Surface]: Way } = {
  tenant: { label: 'Back to your register', note: 'where your work is', to: '/close' },
  partner: { label: 'Back to the partner portal', note: 'your deals and your firm', to: '/' },
  console: { label: 'Back to the staff console', note: 'the tenancy', to: '/' },
}

export const ERRORS: { readonly [C in ErrorCode]: ErrorCopy } = {
  '401': {
    kind: '401 · your session ended',
    head: 'You have been signed out.',
    said:
      'Sessions here are short by design, and this one has expired — or this browser never ' +
      'held one. Nothing was lost — anything committed before it ended is committed, and ' +
      'anything half-typed is not.',
    means:
      'Signing in again returns you to where you were. Your organisation’s directory says ' +
      'which organisation you belong to and your role is read from what it assigned you, so ' +
      'you will land on the same surface rather than at a menu.',
    refWhy:
      'What this browser presented, rather than an account: no session that would be accepted, ' +
      'and nothing about who you are.',
    own: null,
    ways: [SIGN_IN, SITE],
  },
  '403': {
    kind: '403 · refused',
    head: 'This is not yours to open.',
    said:
      'The address is real and the thing behind it exists. Your role does not reach it, and ' +
      'no grant on your account does either.',
    means:
      'You cannot widen this yourself, and neither can we from here — in this product ' +
      'authority is granted by somebody at your own organisation, which is who to ask. If you ' +
      'reached this from a link somebody sent you, they hold something you do not.',
    refWhy:
      'The refusal, not the resource. It records that a refusal happened and does not name ' +
      'what you were refused.',
    own:
      'Refusals are recorded on the tenant’s own audit trail, at the same weight as a read ' +
      'that succeeded. Nothing about this page is quiet.',
    ways: [HOME, { label: 'Sign in as someone else', note: 'if you hold two roles', to: '/signin' }],
  },
  '404': {
    kind: '404 · nothing at this address',
    head: 'There is nothing here.',
    said:
      'Nothing in this application answers to this address. It may have been mistyped, or it ' +
      'may name something this application does not have — and this page cannot tell those ' +
      'apart, deliberately.',
    means:
      'If you typed it, check it. If somebody sent it to you, ask them where they meant to ' +
      'send you.',
    refWhy:
      'The address. No request was made for it, so there is no record reference to give, ' +
      'which is the whole content of a 404.',
    own:
      'This page answers identically for every address that is not here. A page that ' +
      'distinguished them would tell a stranger what exists.',
    ways: [HOME, SITE],
  },
  '429': {
    kind: '429 · a quota, and it is not ours',
    head: 'The model quota in this account is exhausted.',
    said:
      'Extraction stopped part-way through the run. The quota belongs to the account this ' +
      'tenant runs in, which is yours rather than ours, so raising it is a change on your side ' +
      'and not something we can do from here.',
    means:
      'What was read before it stopped is kept and is on the register. Nothing has been ' +
      'posted, and re-running is safe — but it will stop again at the same place until the ' +
      'quota is raised, so raising it first is the cheaper order.',
    refWhy: 'The run. It carries what was read and where it stopped.',
    own:
      'The product has no ongoing check against this ceiling, so a run can stop here with no ' +
      'warning beforehand. That is a known gap rather than a surprise.',
    ways: [HOME, SITE],
  },
  '500': {
    kind: '500 · ours',
    head: 'We broke this, and we are sorry.',
    said:
      'Something on our side failed while answering you. Quoting the code below will get you ' +
      'past the first three questions.',
    means:
      'Nothing was written. This product does not leave half-finished work: an act either ' +
      'completed before the failure and is on your trail, or it did not happen at all. If you ' +
      'were mid-way through a form, its contents are gone, and that is the part that cost you ' +
      'something.',
    refWhy: 'The address it happened at. Quote it with the time, and support can find the request.',
    own:
      'A run in flight is unaffected. Runs complete or fail as a whole, and this page is about ' +
      'the request you just made rather than the work behind it.',
    ways: [HOME, { label: 'Back to the site', note: 'if you would rather leave it', to: SITE_HOME }],
  },
  '503': {
    kind: '503 · we cannot reach it',
    head: 'The service holding your data did not answer, and we are sorry for the wait.',
    said:
      'The application is served by us and it calls the service your data lives in. That call ' +
      'is not being answered. Whether that service is down, the network between us is, or a ' +
      'security group changed cannot be told apart from here, and all three look like this.',
    means:
      'Your documents have not moved and nothing has been read. If a run was due, it will be ' +
      'held rather than skipped.',
    refWhy: 'The address it happened at. The service holding your data keeps its own reference.',
    own:
      'Because that service may run in your own account, this is one of the few failures we may ' +
      'be unable to diagnose without asking you to look — which is slower, and honest.',
    ways: [
      { label: 'Try again in a few minutes', note: 'nothing is lost by waiting', to: HOME_PATH },
      { label: 'Back to the site', note: 'the public site is unaffected', to: SITE_HOME },
    ],
  },
}

/**
 * THE WORDS A CONSOLE OR PARTNER HOST TAKES IN PLACE OF THE TENANT'S — only
 * where the tenant's would be false there. A staff person or a partner has no
 * tenant data behind this page and no run that could be held (RS-02).
 */
type SurfaceText = Partial<Pick<ErrorCopy, 'kind' | 'head' | 'said' | 'means' | 'refWhy' | 'own' | 'ways'>>

const NOT_THE_TENANT: { readonly [C in ErrorCode]?: SurfaceText } = {
  '403': {
    own:
      'Refusals are recorded at the same weight as a read that succeeded. Nothing about this page ' +
      'is quiet.',
  },
  '500': { own: null },
}

const SURFACE_COPY: { readonly [S in Surface]: { readonly [C in ErrorCode]?: SurfaceText } } = {
  tenant: {},
  console: {
    ...NOT_THE_TENANT,
    '503': {
      head: 'The staff console could not reach what it reads, and we are sorry for the wait.',
      said:
        'The console is served by us and it reads the tenancy from our own control service. ' +
        'That read is not being answered, and from here a service that is down cannot be told ' +
        'apart from a network that is.',
      means:
        'Nothing about any tenant has changed and nothing was written. Every tenant’s own work ' +
        'carries on without this page.',
      refWhy: 'The address it happened at. Quote it with the time, and support can find the request.',
      own: null,
      /* The pack's retry is this host's home by name — the ruling's "wording
         naming that surface" — and waiting there loses nothing. */
      ways: [HOME, { label: 'Back to the site', note: 'the public site is unaffected', to: SITE_HOME }],
    },
  },
  partner: {
    ...NOT_THE_TENANT,
    '503': {
      head: 'The partner portal could not reach what it reads, and we are sorry for the wait.',
      said:
        'The portal is served by us and it reads your firm’s deals and people from our own ' +
        'service. That read is not being answered, and from here a service that is down cannot ' +
        'be told apart from a network that is.',
      means:
        'Nothing you registered has been lost and nothing was written. Your customers’ own work ' +
        'carries on without this page.',
      refWhy: 'The address it happened at. Quote it with the time, and support can find the request.',
      own: null,
      /* The pack's retry is this host's home by name — the ruling's "wording
         naming that surface" — and waiting there loses nothing. */
      ways: [HOME, { label: 'Back to the site', note: 'the public site is unaffected', to: SITE_HOME }],
    },
  },
}

/** The copy a host draws for a code: the pack's, with that surface's own words over it. */
export function errorCopyFor(code: ErrorCode, surface: Surface): FilledCopy {
  const copy: ErrorCopy = { ...ERRORS[code], ...SURFACE_COPY[surface][code] }
  const fill = (w: WaySlot): Way =>
    w === HOME ? HOME_WAY[surface] : w.to === HOME_PATH ? { ...w, to: HOME_WAY[surface].to } : { ...w, to: w.to }
  return { ...copy, ways: [fill(copy.ways[0]), fill(copy.ways[1])] }
}

