/**
 * PRIMITIVE 4 · BREADCRUMB — `<Trail>`. Design System §5: *"It appears only
 * when you are deeper than a destination, and it is the way OUT as well as the
 * trail. The last crumb is not a link — it is where you are."*
 *
 * It replaces the body link "Back to the register" the finding and the run
 * account carried under their titles (RC-08). The first crumb keeps
 * `data-back`, because that attribute states what the control IS — the way
 * back — and the browser suite addresses it by that rather than by its label.
 */

import { Fragment } from 'react'

import type { LinkProps } from '../routes/useRoute.ts'

export interface Crumb {
  readonly label: string
  readonly link: LinkProps
}

export interface TrailProps {
  /** Every crumb but the last, outermost first. The first is the way back. */
  readonly crumbs: readonly Crumb[]
  /** Where you are. Never a link. */
  readonly here: string
}

export function Trail({ crumbs, here }: TrailProps) {
  return (
    <nav className="trail" aria-label="Breadcrumb">
      {crumbs.map((c, i) => (
        <Fragment key={`${c.link.href}-${i}`}>
          <a className="crumb" {...(i === 0 ? { 'data-back': '' } : {})} {...c.link}>
            {c.label}
          </a>
          <span className="sep" aria-hidden="true">/</span>
        </Fragment>
      ))}
      <span aria-current="page">{here}</span>
    </nav>
  )
}
