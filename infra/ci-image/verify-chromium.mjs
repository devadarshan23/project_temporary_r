/**
 * CAN THIS IMAGE RENDER A PAGE AND READ A COMPUTED STYLE?
 *
 * 🛑 THE ONE UNPROVEN PIECE OF THE WHOLE DEPLOYMENT PLAN, TURNED INTO A BUILD
 * STEP. `docs/tech-stack.md` §14 lists "chromium runs on the AL2023 arm64 CI
 * image" as NOT VERIFIED, and G258 requires the machine witnessed before the
 * pipeline depends on it. This file is the narrow half of that: an image whose
 * chromium cannot launch FAILS TO BUILD, so the unverified row cannot be closed
 * by an image that merely downloaded a zip.
 *
 * ⚠️ IT ASSERTS THE PROPERTY, NOT THE LANDMARK. `tests/design/render.ts` records
 * the mistake this avoids, made once already inside this repository: a guard
 * that stat-ed `chromium-*` skipped twelve suites on a machine that rendered
 * perfectly well, because `--only-shell` writes `chromium_headless_shell-*`. So
 * this launches a page and reads `borderRadius` back — the same shape, and the
 * same value, `browserSkip()` uses.
 *
 * ⚠️ IT IS NOT A SUBSTITUTE FOR THE RED-FIRST WITNESS. It can only ever report
 * that the browser IS there. That an ABSENT browser costs an exit code is a
 * different claim, and `infra/ci-image/VERIFY.md` is where it is observed.
 *
 * ⚠️ AND IT IS NOT THE SUITE. It launches through the globally installed
 * playwright, which the image pinned to `devDependencies.playwright`. The gate's
 * own `npm ci` installs that same version from the lockfile and finds the same
 * browser through `PLAYWRIGHT_BROWSERS_PATH`; if those two ever disagree the
 * suites skip with a browser on disk, which is why the version is derived from
 * the manifest in the Dockerfile rather than written down twice.
 */

import { chromium } from 'playwright'

const started = Date.now()
let browser

try {
  browser = await chromium.launch()
} catch (error) {
  console.error('🛑 CHROMIUM DID NOT LAUNCH IN THIS IMAGE.')
  console.error('')
  console.error('   This is the failure docs/tech-stack.md §14 says is unproven, happening.')
  console.error('   Read the message below before changing anything: a missing shared library')
  console.error('   names itself, and a sandbox refusal reads completely differently.')
  console.error('')
  console.error(`   ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

try {
  const page = await browser.newPage()
  await page.setContent('<i id="p" style="border-radius:50%">x</i>')
  const radius = await page.evaluate(
    () => getComputedStyle(document.getElementById('p')).borderRadius,
  )
  if (radius !== '50%') {
    console.error(
      `🛑 A PAGE RENDERED AND COMPUTED STYLE READ BACK "${radius}", NOT "50%". ` +
        'A browser that answers the wrong thing is worse than one that does not answer.',
    )
    process.exit(1)
  }
  console.log(
    `chromium ${browser.version()} launched and computed a style in ${Date.now() - started}ms ` +
      `— headless shell, ${process.arch}, ${process.env['PLAYWRIGHT_BROWSERS_PATH']}`,
  )
} finally {
  await browser.close()
}
