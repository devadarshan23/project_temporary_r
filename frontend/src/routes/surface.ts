/**
 * WHICH SURFACE THIS HOST SERVES — G3321 and G3291, 3 Oct 2026; ONE MODULE
 * SINCE G3371.
 *
 * ⚠️ TWO SLICES LANDED THIS SAME DECISION THE SAME DAY IN TWO FILES — this one
 * (#538, `surfaceOf`, with a registry override) and `routes/host-surface.ts`
 * (#542, `hostSurfaceOf`, with the labels IMPORTED from `infra/lib/config.ts`).
 * That is §5.3 arriving in the merge, against this header's own sentence
 * below. The integration keeps THIS file and BOTH properties: the reserved
 * labels are imported from the edge config, never retyped (so a renamed
 * console label moves this answer with it, and no tenant slug can ever be
 * either — both are `RESERVED_HOST_LABELS` members), and a registry entry
 * still wins over the label. `host-surface.ts` is deleted; it is retrievable
 * from `origin/feat/p1-partner-portal-ui`.
 *
 * ⚠️ THE PLANE DOES NOT REPORT THE SURFACE (G3291's argument, kept): D1
 * answers 403 on a console host by design and the session tier answers
 * nothing about the host, so minting a "which surface am I on" read would be
 * a contract change for a fact the browser already holds.
 *
 * One bundle is served on three kinds of host: a tenant host (the customer's
 * product), the 1CloudHub staff console, and the partner portal. A signed-in
 * staff person on `console.reconcileai.app` landed on `/` and was shown the
 * tenant shell's unbuilt-entry placeholder (measured on staging, 3 Oct 2026),
 * because nothing in this application asked which surface the host was.
 *
 * 🛑 THIS IS ONE SMALL MODULE ON PURPOSE, AND THE PARTNER PORTAL'S SLICE
 * SHARES IT. Two surfaces each keeping their own `startsWith()` would be two
 * authorities for one fact (§5.3), and the one that drifts is always the copy.
 *
 * ⚠️ IT IS A RENDERING DECISION AND NOT A RESOLUTION. The plane resolves a
 * host by LOOKUP in its own two registries (G179, G726) and binds the session
 * to it (G180); a page drawn for the wrong surface is refused there, read by
 * read. What this decides is which chrome and which screen to draw — and the
 * shape it keys on is G297's, the one `surfaces.ts`'s `partnerSignIn()`
 * already relies on: the two consoles are FLAT, one label each on the apex
 * (`console.` and `partners.`), while a tenant host carries a tenant and a
 * region label, or is a customer's own domain under BYOA.
 *
 * ⚠️ A REGISTRY, WHEN ONE IS SUPPLIED, WINS OVER THE LABEL. A host named in it
 * is answered from it, so a deployment that serves a console on a name that
 * does not begin `console.` is expressible without touching this rule.
 */

import { CONSOLE_HOST_LABEL, PARTNERS_HOST_LABEL } from '../../../infra/lib/config.ts'

export const SURFACES = ['tenant', 'console', 'partner'] as const
export type Surface = (typeof SURFACES)[number]

/** An explicit host → surface map; a host absent from it falls to the label rule. */
export type SurfaceRegistry = Readonly<Record<string, Surface>>

const LABEL_SURFACE: Readonly<Record<string, Surface>> = {
  [CONSOLE_HOST_LABEL]: 'console',
  [PARTNERS_HOST_LABEL]: 'partner',
}

/**
 * The surface a hostname serves. The port is ignored; the name is compared
 * case-insensitively and without a trailing dot.
 */
export function surfaceOf(hostname: string, registry: SurfaceRegistry = {}): Surface {
  const host = hostname.toLowerCase().replace(/\.$/, '').split(':')[0] ?? ''
  const listed = Object.hasOwn(registry, host) ? registry[host] : undefined
  if (listed !== undefined) return listed
  const dot = host.indexOf('.')
  /* A bare name (`localhost`) has no label to read and is a tenant host —
     the development plane serves the tenant shell there. */
  if (dot <= 0) return 'tenant'
  const first = host.slice(0, dot)
  return Object.hasOwn(LABEL_SURFACE, first) ? (LABEL_SURFACE[first] ?? 'tenant') : 'tenant'
}
