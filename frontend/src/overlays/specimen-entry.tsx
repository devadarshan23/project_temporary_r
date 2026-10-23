import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { OverlaySpecimen } from './OverlaySpecimen.tsx'

/**
 * THE ENTRY `tests/design/overlays.test.ts` BUNDLES.
 *
 * 🛑 IT IS A SEPARATE ENTRY FROM `main.tsx` AND CARRIES NO STYLESHEET IMPORT.
 * `main.tsx` imports `bridge.css`, which pulls Tailwind and the kernel through
 * the Vite plugin; bundling that here would compile a SECOND build of the bridge
 * for the test to measure, and the whole argument of `tests/design/` is that what
 * is asserted is what ships. The test attaches the stylesheet the app build
 * emitted instead, located through Vite's own manifest — the same route
 * `prerender.tsx` takes.
 *
 * ⚠️ IT IS ALSO NOT IN `npm run build:frontend`, DELIBERATELY. Nothing ships this
 * page: it is a bench for four primitives whose behaviour cannot be seen at rest.
 * Adding it to the build would emit a third HTML artefact that no route serves
 * and that `check-doc-counts` would then have to be taught about.
 *
 * 🛑 `StrictMode` IS ON, AND IT IS LOAD-BEARING RATHER THAN IDIOMATIC. React 19's
 * StrictMode mounts, unmounts and remounts every effect in development. That is
 * precisely the double-fire that a scroll lock without a reference count, or a
 * focus restore without an idempotent disposer, gets wrong — and it gets it wrong
 * silently. The assertions run against the harsher of the two behaviours on
 * purpose.
 */
const mount = document.getElementById('root')
if (mount === null) throw new Error('no #root in the overlay bench')

createRoot(mount).render(
  <StrictMode>
    <OverlaySpecimen />
  </StrictMode>,
)
