/**
 * THE APEX SITE'S FRAME — the chrome, the footer and the mark the four public
 * pages share. G3151–G3154, 2 Oct 2026, under the OWNER'S ruling of the same
 * day: *"Apex only: serve /demo and /lookup from the apex marketing site
 * (Amplify); tenant/console hosts redirect there. The marketing site needs
 * building."*
 *
 * ⚠️ THIS FILE WAS `frontend/src/public/PublicPlane.tsx` (G3077) AND IT MOVED
 * RATHER THAN BEING COPIED. Under G3077 the application bundle rendered `/demo`
 * and `/lookup` outside `ShellApp` and this frame injected the pack's
 * `public.css` as a `<style>` element while a public route was mounted, because
 * loaded globally that sheet's bare `h1`, `p`, `.btn` and `.card` rules would
 * have restyled every APPLICATION surface. **On the apex there is no
 * application surface to restyle**, so the sheet is imported once, globally, by
 * `entry.tsx`, and the injection — and its `?inline` type shim — are deleted.
 * The application bundle now renders neither page; it REDIRECTS (`main.tsx`).
 *
 * 🛑 NO APP CHROME AND NO `/v1` READ, AND BOTH ARE STRUCTURAL HERE RATHER THAN
 * ARRANGED: this is a separate Vite build (`frontend/site/vite.config.ts`) whose
 * module graph does not contain `ShellApp`, the chrome bar or any `/v1` client.
 * `tests/app/apex-site.test.ts` walks that graph and requires it.
 *
 * ✅ AND THE LANDING-PAGE ANCHORS ARE BACK. G3077 left the pack's `#how`,
 * `#platform` and `#runs` links out of `/demo`'s chrome because no route in the
 * application drew a landing page. The apex draws one (`Landing.tsx`), so the
 * chrome below is the pack's own, link for link.
 */

import type { CSSProperties, ReactNode } from 'react'

import publisherMark from '../../../assets/1cloudhub-logo-horiz.jpg'

/** The site's four pages, as directory-index paths — Amplify serves `<dir>/index.html`. */
export const SITE_PATHS = {
  home: '/',
  demo: '/demo/',
  lookup: '/lookup/',
  story: '/story/',
} as const

export type SitePage = keyof typeof SITE_PATHS

/** A custom property the pack sets inline. `CSSProperties` has no index for them. */
export function cssVar(name: `--${string}`, value: string): CSSProperties {
  return { [name]: value } as CSSProperties
}

/** The mark, exactly as the pack draws it in `.pchrome` and `.pfoot`. */
export function Logo(): ReactNode {
  return (
    <span className="logo" style={cssVar('--logo-size', '1.0625rem')}>
      <span className="mascot" style={cssVar('--mascot-size', '1em')} aria-hidden="true">
        <i className="d1">·</i>
        <i className="d2">·</i>
        <i className="d3">·</i>
      </span>
      <span>Reconcile</span>
      <span className="badge">AI</span>
    </span>
  )
}

/** The landing page's three section anchors, which every other page's nav points back at. */
const SECTION_LINKS = [
  { href: `${SITE_PATHS.home}#how`, label: 'How it reads' },
  { href: `${SITE_PATHS.home}#platform`, label: 'The platform' },
  { href: `${SITE_PATHS.home}#runs`, label: 'Where it runs' },
] as const

/**
 * `.pchrome`. The landing page names its own four sections; every other page
 * leads with *"Back to the site"* and then the landing page's sections, as V2
 * and V4 draw them. *"Book a demo"* is the one action, so it is absent on the
 * page that IS that action.
 */
export function PublicChrome({ page }: { readonly page: Exclude<SitePage, 'lookup'> }): ReactNode {
  const nav =
    page === 'home'
      ? [
          { href: '#cost', label: 'The cost' },
          { href: '#how', label: 'How it reads' },
          { href: '#platform', label: 'The platform' },
          { href: '#runs', label: 'Where it runs' },
        ]
      : [
          { href: SITE_PATHS.home, label: 'Back to the site', back: true },
          ...(page === 'story' ? [{ href: `${SITE_PATHS.home}#proof`, label: 'Success stories' }] : []),
          ...SECTION_LINKS,
        ]
  return (
    <header className="pchrome">
      {page === 'home' ? (
        <Logo />
      ) : (
        <a href={SITE_PATHS.home} style={{ textDecoration: 'none' }} aria-label="Reconcile AI">
          <Logo />
        </a>
      )}
      <nav>
        <ul className="pnav">
          {nav.map((l) => (
            <li key={l.href}>
              <a href={l.href}>
                {'back' in l && (
                  <>
                    <span className="mono" aria-hidden="true">‹</span>&nbsp;
                  </>
                )}
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <span className="sp" />
      <a className="btn btn--quiet" href={SITE_PATHS.lookup}>
        Sign in
      </a>
      {page !== 'demo' && (
        <a className="btn" data-commit href={SITE_PATHS.demo}>
          Book a demo
        </a>
      )}
    </header>
  )
}

/**
 * The publisher's own mark, from the trunk (`assets/1cloudhub-logo-horiz.jpg`,
 * PRODUCT.md's Brand Commitments). ⚠️ THE PACK HOTLINKS THIS IMAGE FROM
 * `1cloudhub.com/wp-content/…`; a hotlink is a third-party request on every page
 * view and a broken mark the day that site moves, so the trunk's copy is
 * bundled instead. It is the PUBLISHER, not a customer — PRODUCT.md forbids a
 * customer logo and requires this one.
 */
export function Publisher({ label }: { readonly label: string }): ReactNode {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(var(--u)*3)', alignItems: 'flex-start' }}>
      <span className="small" style={{ fontSize: 'var(--s1)', letterSpacing: 'var(--tr-micro)', textTransform: 'uppercase' }}>
        {label}
      </span>
      <a
        href="https://www.1cloudhub.com"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          backgroundColor: '#fff',
          padding: 'calc(var(--u)*2) calc(var(--u)*3)',
          boxShadow: 'inset 0 0 0 1px var(--rule-strong)',
        }}
      >
        <img src={publisherMark} alt="1CloudHub" style={{ display: 'block', height: 'calc(var(--u)*7)', width: 'auto' }} />
      </a>
    </div>
  )
}

/** `.pfoot`. `withPublisher` is the pack's V1/V4 footer; V2's has no mark column. */
export function PublicFooter({
  page,
  withPublisher,
  disclaimer,
}: {
  readonly page: Exclude<SitePage, 'lookup'>
  readonly withPublisher: boolean
  readonly disclaimer?: ReactNode
}): ReactNode {
  return (
    <footer className="pfoot">
      <div className="wrapper">
        <div className="rows">
          <a href={SITE_PATHS.home} style={{ textDecoration: 'none' }} aria-label="Reconcile AI">
            <Logo />
          </a>
          <ul>
            {SECTION_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
          <ul>
            <li>
              {/* V2 draws "The landing page" here, where V1 and V4 draw "Book a demo". */}
              {page === 'demo' ? (
                <a href={SITE_PATHS.home}>The landing page</a>
              ) : (
                <a href={SITE_PATHS.demo}>Book a demo</a>
              )}
            </li>
            <li>
              <a href={SITE_PATHS.lookup}>Sign in</a>
            </li>
          </ul>
          {withPublisher && <Publisher label="Built, delivered and run by" />}
        </div>
        {disclaimer !== undefined && <p className="disclaimer">{disclaimer}</p>}
      </div>
    </footer>
  )
}

/** The page root. `data-public-plane` names the page, which the browser suites key on. */
export function PublicFrame({ page, children }: { readonly page: SitePage; readonly children: ReactNode }): ReactNode {
  return (
    <div className="public-plane" data-public-plane={page}>
      {children}
    </div>
  )
}
