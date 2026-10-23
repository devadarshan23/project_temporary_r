/**
 * WHERE THE PUBLIC PLANE LIVES, FROM THE APPLICATION'S SIDE — G3156, 2 Oct 2026,
 * under the OWNER'S ruling of the same day (it answers G3078): *"Apex only:
 * serve /demo and /lookup from the apex marketing site (Amplify);
 * tenant/console hosts redirect there."*
 *
 * The application bundle is served on tenant and console hosts. It names
 * `/demo` and `/lookup` in its route table (G1911 — a CITATION, `plane:
 * 'public'`) and renders neither: it REDIRECTS each to the apex page that
 * serves it. This file is the one place that mapping is written.
 *
 * ⚠️ THE TARGET CARRIES NOTHING FROM THE REQUEST — no query, no fragment. A
 * public page needs no state from the host a visitor arrived at, and carrying a
 * query across would hand whatever a link-maker put in one to a different
 * origin.
 *
 * ⚠️ THE TRAILING SLASH IS DELIBERATE: the apex serves each page as a directory
 * index (`frontend/site/vite.config.ts`), and asking for `/demo/` rather than
 * `/demo` spares the visitor whatever the static host does with the bare name.
 *
 * 🛑 THE HOST IS `APEX_HOST`, IMPORTED — the constant the Amplify stack binds
 * the apex domain from — and never a literal, so a renamed apex moves this
 * redirect with it. `infra/lib/config.ts` declares no imports, so nothing of CDK
 * reaches the bundle (`frontend/vite.config.ts`'s own argument).
 */

import { APEX_HOST } from '../../../infra/lib/config.ts'

/** The two public-plane paths the application names and does not serve. */
export const APEX_PAGES = {
  '/demo': '/demo/',
  '/lookup': '/lookup/',
} as const

export type ApexPath = keyof typeof APEX_PAGES

export function isApexPath(path: string): path is ApexPath {
  return Object.hasOwn(APEX_PAGES, path)
}

/** The absolute apex URL a public-plane path redirects to. */
export function apexUrlFor(path: ApexPath): string {
  return `https://${APEX_HOST}${APEX_PAGES[path]}`
}

/**
 * THE PUBLIC SITE'S HOME — the apex's `/`, which is built (G3151). Every
 * "Back to the site" on a signed-out page goes HERE and never to this host's
 * own `/`: on a console host that is the staff console and on a partner host
 * the portal, so a link labelled "the site" would land a person inside the
 * product (G3581).
 */
export const SITE_HOME = `https://${APEX_HOST}/`
