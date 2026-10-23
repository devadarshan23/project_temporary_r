/**
 * PACKAGE THE APEX SITE FOR `aws amplify start-deployment` — G3155, 2 Oct 2026.
 *
 * `npm run package:site` builds the site (`npm run build:site`) and then runs
 * this, which VERIFIES the build before zipping it and refuses otherwise:
 *
 *   · each of the four pages exists at its directory index;
 *   · each was PRERENDERED — its `#root` is not empty — because an empty root
 *     is a page a crawler and a script-blocked visitor read as blank;
 *   · the build is the SITE and not the application shell — no `index.html`
 *     carrying the application's `<div id="root"></div>` mount — because the
 *     wrong zip to hand Amplify is `frontend/dist`, and
 *     `docs/build/deploy-handoff.md` §14.2 says so: pointing the apex at the
 *     application shell is exactly what `EDGE_APEX_IS_SERVED_ELSEWHERE` forbids.
 *
 * The zip is written to `frontend/site/reconcile-site.zip`, with `index.html`
 * at its ROOT, which is the shape Amplify's manual deployment requires.
 * ⚠️ It uses the system `zip`; the Amplify runbook already assumes the AWS CLI
 * and `curl`, and a hand-written zip encoder here would be a format nobody
 * reviews.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/* G3271: NOT `import.meta.dirname`, which is Node >= 20.11 — the Build
 * stage's image ran Node 18 and this line threw `ERR_INVALID_ARG_TYPE`. */
const SITE = dirname(fileURLToPath(import.meta.url))
const DIST = join(SITE, 'dist')
const ZIP = join(SITE, 'reconcile-site.zip')
const PAGES = ['index.html', 'demo/index.html', 'lookup/index.html', 'story/index.html']

for (const rel of PAGES) {
  const file = join(DIST, rel)
  if (!existsSync(file)) throw new Error(`package:site — ${rel} is missing from ${DIST}; run npm run build:site`)
  const html = readFileSync(file, 'utf8')
  if (!/<div id="root" data-page="[a-z]+">(?:<link [^>]*\/>)*<div class="public-plane"/.test(html)) {
    throw new Error(`package:site — ${rel} was not prerendered (its #root is empty or is not the site's)`)
  }
  if (html.includes('/src/main.tsx') || html.includes('ShellApp')) {
    throw new Error(`package:site — ${rel} is the APPLICATION's page, not the site's`)
  }
}

rmSync(ZIP, { force: true })
execFileSync('zip', ['-q', '-r', ZIP, '.'], { cwd: DIST, stdio: 'inherit' })
console.log(`package:site — ${ZIP} (${PAGES.length} pages, verified prerendered)`)
