/**
 * THE APEX SITE'S CLIENT ENTRY. G3151, 2 Oct 2026.
 *
 * 🛑 THE PACK'S TWO SHEETS ARE LOADED GLOBALLY AND NOTHING ELSE IS. The kernel
 * (`tokens.css`) and the public plane's geometry (`public.css`) are the pack's
 * files, unmodified. There is no Tailwind and no `bridge.css` here: those are
 * the APPLICATION's, and the public sheet's bare `h1`/`p`/`.btn` rules are
 * exactly what the application's world must never meet (G3077). On the apex
 * nothing else exists to collide with.
 *
 * The prerender (`prerender.tsx`) writes each page's markup into `#root`, so
 * this HYDRATES rather than renders: a visitor without script still reads the
 * page, and a crawler reads it without running one.
 */

import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'

/* Self-hosted Plex (RV-01, G3391) — replaces the Google Fonts <link>. */
import '../../fonts/plex.css'
import '../../../docs/handoff-pack/tokens.css'
import '../../../docs/handoff-pack/public.css'

import { isSitePage, PAGES } from './pages.tsx'

const root = document.getElementById('root')
const page = root?.dataset['page']
if (root === null || !isSitePage(page)) throw new Error('no #root[data-page] naming a site page')

hydrateRoot(root, <StrictMode>{PAGES[page]()}</StrictMode>)
