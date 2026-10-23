/**
 * THE APEX SITE'S FOUR PAGES, AND THE ONE PLACE A PAGE KEY BECOMES A COMPONENT.
 * G3151, 2 Oct 2026. Each HTML entry (`index.html`, `demo/index.html`,
 * `lookup/index.html`, `story/index.html`) names its page on `#root`'s
 * `data-page`; the client entry and the prerender both read it here, so the
 * markup the prerender writes and the tree the client hydrates are the same
 * component by construction.
 */

import type { ReactNode } from 'react'

import { Demo } from './Demo.tsx'
import { Landing } from './Landing.tsx'
import { Lookup } from './Lookup.tsx'
import type { SitePage } from './PublicPlane.tsx'
import { Story } from './Story.tsx'

export const PAGES: { readonly [P in SitePage]: () => ReactNode } = {
  home: () => <Landing />,
  demo: () => <Demo />,
  lookup: () => <Lookup />,
  story: () => <Story />,
}

export function isSitePage(value: string | undefined): value is SitePage {
  return value !== undefined && Object.hasOwn(PAGES, value)
}
