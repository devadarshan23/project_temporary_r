/**
 * THE RENDERER — the only place a test in tests/design/ gets a computed style.
 *
 * 🛑 WHY A REAL BROWSER AND NOT jsdom. Every one of the six assertions in this
 * directory is about a property no DOM shim computes:
 *
 *   · CASCADE LAYERS. `@layer` ORDER OUTRANKS SPECIFICITY. That single fact is
 *     the whole risk of putting Tailwind under this kernel, and it is the fact
 *     jsdom does not implement at all.
 *   · PSEUDO-ELEMENTS. The hatch's word, the meter's two bars and the connection
 *     light's halo are ALL ::before/::after. jsdom's getComputedStyle takes no
 *     pseudo-element argument that resolves anything.
 *   · var() RESOLUTION at the use site — assertion 6 is exactly the question of
 *     whether a token still resolves through Tailwind, so a shim that returns
 *     the literal `var(--agent)` answers nothing.
 *   · prefers-reduced-motion, as a MEDIA state that has to be emulated.
 *
 * So: playwright + chromium, driven from `node --test`.
 *
 * 🛑 AND NOT `@playwright/test`. G108 rules that a new check JOINS `npm run
 * check` rather than standing beside it. `@playwright/test` is a second RUNNER
 * with its own config, its own discovery and its own reporter; adopting it would
 * put a second gate next to the one G108 exists to keep single. `node --test`
 * already runs `tests/**\/*.test.ts` and is already inside `npm run check`, so
 * playwright is used here as a LIBRARY and the runner does not change.
 *
 * ⚠️ THE SKIP IS HONEST AND IT IS ALSO A KNOWN WEAKNESS. The chromium binary is
 * not in the npm manifest — it arrives via `npx playwright install chromium
 * --only-shell`. This repository has been here once already: db/pg.ts reaches
 * its driver dynamically and `tests/db/tenant-isolation.test.ts` skips loudly
 * when no Postgres answers, and CLAUDE.md records the consequence in as many
 * words — *"the leak test's evidence is machine-local and not reproducible from
 * the manifest."* The same sentence is true of this directory and is written
 * here rather than discovered later. A green run on a machine with no browser is
 * NOT evidence that the hatch survives.
 */

import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileP = promisify(execFile)

/** Repository root, derived from this file rather than from cwd. */
export const REPO = resolve(import.meta.dirname, '..', '..')

/** THE KERNEL. Derive the path, never restate the file's contents. */
export const KERNEL = join(REPO, 'docs', 'handoff-pack', 'tokens.css')

/**
 * The frontend seams this pass declares and does NOT build. A red assertion
 * naming one of these fails on the PROPERTY it could not witness, not on an
 * import that threw — see the header of frontend-bridge.test.ts.
 */
/**
 * 🛑 THE SEAM IS A BUILT PAGE, AND THE FIRST DRAFT MADE IT A MODULE IMPORT.
 *
 * That draft asked for `frontend/src/components/kernel.tsx` and rendered it with
 * `react-dom/server`. It CANNOT WORK: node strips TypeScript types but does not
 * transform JSX, `--experimental-transform-types` is gone in node 26, and the
 * whole suite therefore failed with `Unknown file extension ".tsx"` no matter
 * what the components did. A red assertion that can never go green is worse than
 * no assertion — it is red against the runner, which is the exact "red against a
 * typo" this pass was warned about, one level down.
 *
 * The replacement is BETTER and not merely workable. A built page is what SHIPS.
 * Compiling `bridge.css` here with the Tailwind CLI would only ever have been an
 * APPROXIMATION of what Vite's Tailwind plugin emits, and the entire finding this
 * suite pins is about cascade order — the one thing an approximated build is most
 * likely to get differently. Reading the built artefact removes that gap.
 *
 * The implementation slice must emit ONE self-contained page carrying the three
 * ported primitives in their states, with its real stylesheet attached.
 */
export const SPECIMEN = join(REPO, 'frontend', 'dist', 'specimen.html')

/**
 * Every Tailwind utility any test in this directory relies on. Listed once,
 * because `@source inline(...)` is what makes the compile deterministic: no
 * scanning of a source tree, no dependence on what a component happens to
 * spell today.
 *
 * The four that matter are the background ones. `bg-white` sets background-COLOR
 * and is the near miss — it does NOT reach the hatch. `bg-none`, `bg-linear-to-r`
 * and the arbitrary `[background:…]` DO write background-image, and they are the
 * shorthand failure in its new register.
 */
export const UTILITIES = [
  'bg-white', 'bg-none', 'bg-linear-to-r', 'bg-[image:none]', 'bg-[#00303f]',
  'bg-agent', 'text-agent', 'p-2', 'flex', 'rounded-full', 'rounded-lg', 'w-1/2',
].join(' ')

let browserPromise: Promise<Browser> | null = null
let chromiumMissing: string | null = null

/** Minimal structural types — playwright is a library here, not the runner. */
type Page = {
  setContent(html: string): Promise<void>
  goto(url: string, o?: { waitUntil: 'load' }): Promise<unknown>
  emulateMedia(o: { reducedMotion: 'reduce' | 'no-preference' }): Promise<void>
  evaluate<T>(fn: () => T): Promise<T>
  evaluate<T, A>(fn: (arg: A) => T | Promise<T>, arg: A): Promise<T>
  screenshot(o: { clip: { x: number; y: number; width: number; height: number } }): Promise<Uint8Array>
  hover(selector: string): Promise<void>
  keyboard: { press(key: string): Promise<void> }
  click(selector: string): Promise<void>
  bringToFront(): Promise<void>
  addInitScript(fn: () => void): Promise<void>
  route(glob: string, handler: (r: { abort(): Promise<void> }) => unknown): Promise<void>
  close(): Promise<void>
}
type Browser = { newPage(): Promise<Page>; close(): Promise<void> }

/**
 * Reachability, resolved once. Returns `false` when a browser is available and
 * a SENTENCE when it is not — `node --test`'s `{ skip }` prints the sentence,
 * so a skipped file says why rather than reading as a pass.
 *
 * 🛑 THIS GUARD LAUNCHES A BROWSER AND READS A COMPUTED STYLE. IT DOES NOT STAT
 * A PATH, AND THE FIRST DRAFT DID. That draft called `chromium.executablePath()`
 * and checked the file existed — which is a rule keyed on a convenient LANDMARK
 * instead of the property it protects, the shape docs/HANDOFF.md §5 catalogues.
 * It skipped all twelve suites on a machine that renders perfectly well, because
 * `--only-shell` installs `chromium_headless_shell-*` and the landmark named
 * `chromium-*`. A guard that silently skips is worse than no guard: it reports
 * green while asserting nothing. The property is *can a page be rendered and its
 * computed style read* — so that is what is tested.
 */
export async function browserSkip(): Promise<false | string> {
  if (chromiumMissing !== null) return chromiumMissing
  try {
    const page = await (await browser()).newPage()
    try {
      await page.setContent('<i id="p" style="border-radius:50%">x</i>')
      const r = await page.evaluate<string>(
        () => getComputedStyle(document.getElementById('p') as Element).borderRadius)
      if (r !== '50%') throw new Error(`a page rendered but computed style read "${r}"`)
    } finally { await page.close() }
    return false
  } catch (e) {
    chromiumMissing =
      'no browser — these assertions are about COMPUTED STYLE and cannot be ' +
      'evaluated without one. Run `npx playwright install chromium --only-shell`. ' +
      'A skipped run is NOT evidence that the hatch survives. ' +
      `(${e instanceof Error ? e.message.split('\n')[0] : String(e)})`
    /* 🛑 DROP THE REJECTED MEMO. `browser()` caches the promise it created, and
       on a machine with no chromium that promise is REJECTED. Keeping it here
       left a rejected promise in a module-level variable for `closeBrowser()`
       to await a SECOND time, where nothing catches it — see the note there. */
    browserPromise = null
    return chromiumMissing
  }
}

async function browser(): Promise<Browser> {
  if (browserPromise === null) {
    browserPromise = import('playwright').then((pw) => pw.chromium.launch() as Promise<Browser>)
  }
  return browserPromise
}

/**
 * 🛑 THIS TURNED "NO BROWSER" INTO A FAILING TEST FILE, AND THE SKIP ABOVE
 * WORKED PERFECTLY WHILE IT DID — which is why it took a CI run to see.
 *
 * `browserSkip()` catches the launch rejection and every suite skips loudly, as
 * designed. But the rejected promise stayed in `browserPromise`, and the `after`
 * hook in each test file calls this function, which awaited it a SECOND time
 * with nothing to catch it. node --test attributes that to the HOOK, so the run
 * reported `✖ tests/design/frontend-bridge.test.ts` and `✖ …/kernel-under-
 * tailwind.test.ts` — two failures naming the files rather than the cause — on
 * top of twelve correct skips. Green locally, red on CI, for a reason that was
 * about promise bookkeeping and not about the cascade at all.
 *
 * CLOSING A BROWSER THAT NEVER LAUNCHED IS A NO-OP, NOT A FAILURE. The teardown
 * says so now, so a machine with no chromium reports exactly one thing — the
 * loud skip — instead of that plus a failure it cannot act on.
 */
export async function closeBrowser(): Promise<void> {
  if (browserPromise !== null) {
    const pending = browserPromise
    browserPromise = null
    try {
      await (await pending).close()
    } catch {
      /* Never launched. `browserSkip()` has already reported why, in a sentence
         a reader can act on; a teardown must not restate it as a failure. */
    }
  }
}

/**
 * Compile REAL Tailwind v4, not an imitation of it.
 *
 * 🛑 G109's lesson, one domain over: a hand-rolled stand-in for a real parser
 * produces *"a checker that passes while asserting nothing"* (§5.6). The layer
 * STATEMENT Tailwind emits — `@layer theme, base, components, utilities;` — is
 * the entire mechanism under test here. Writing that line by hand would make
 * this suite assert a fact about a string I wrote rather than about Tailwind.
 */
/**
 * A scratch directory INSIDE the repository. It has to be inside: Tailwind
 * resolves the `tailwindcss` import relative to the entry CSS file's own
 * directory, so an entry written to the OS temp dir fails with
 * `Can't resolve 'tailwindcss'`. Under node_modules/ so nothing can be
 * committed by accident.
 */
export async function scratch(prefix: string): Promise<string> {
  const base = join(REPO, 'node_modules', '.reconcile-design')
  await mkdir(base, { recursive: true })
  return mkdtemp(join(base, prefix))
}

let twCache: string | null = null
export async function tailwind(): Promise<string> {
  if (twCache !== null) return twCache
  const dir = await scratch('tw-')
  const inPath = join(dir, 'in.css')
  const outPath = join(dir, 'out.css')
  await writeFile(inPath, `@import "tailwindcss" source(none);\n@source inline("${UTILITIES}");\n`)
  await execFileP('node', [join(REPO, 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs'),
    '-i', inPath, '-o', outPath], { cwd: REPO })
  twCache = await readFile(outPath, 'utf8')
  return twCache
}

export async function kernel(): Promise<string> {
  return readFile(KERNEL, 'utf8')
}

/**
 * THE THREE ARRANGEMENTS a bridge can take, named so a test can say which one
 * it is talking about. Each takes the SAME two stylesheets and differs only in
 * where the kernel sits relative to Tailwind's layers.
 *
 *   unlayered  the kernel outside every layer. Unlayered styles beat ALL
 *              layered ones, so the kernel wins everything — including the
 *              things Tailwind is being adopted to do.
 *   inBase     the kernel wrapped in `@layer base`. This is the natural reading
 *              of *"tokens.css becomes a THEME LAYER"*, and it is the one that
 *              LOSES THE HATCH.
 *   ownLayer   the kernel in its own layer declared AFTER utilities.
 */
export type Arrangement = 'unlayered' | 'inBase' | 'ownLayer'

export function compose(tw: string, k: string, how: Arrangement): string {
  if (how === 'unlayered') return `${tw}\n${k}`
  if (how === 'inBase') return `${tw}\n@layer base {\n${k}\n}\n`
  return `@layer tw, kernel;\n@layer tw {\n${tw}\n}\n@layer kernel {\n${k}\n}\n`
}

/**
 * Render `css` + `body`, then run `read` INSIDE the page and return what it
 * saw. `reducedMotion` is emulated as a MEDIA state, which is the only way the
 * kernel's own `@media (prefers-reduced-motion:reduce)` block is exercised at
 * all — setting a class or a data attribute would test a different thing and
 * pass while the real setting did nothing.
 *
 * ⚠️ `read` is serialised to source and re-parsed in the page. It may NOT close
 * over anything in this module.
 *
 * 🛑 `init` IS NOT SYMMETRY WITH renderFile; IT CLOSES A WITNESS THAT ASSERTED
 * NOTHING. The click-listener census has to wrap `addEventListener` before the
 * fixture's own <script> calls it, and only `addInitScript` runs that early.
 * Without it `window.__clicked` is undefined in this path, `readReach` returns
 * `[]` for a fixture carrying a planted defect, and the §0 assertion
 * `planted.length === 0 || planted.some(…)` passes on its FIRST disjunct — so
 * the one branch of that detector no source read can replace had never been
 * witnessed in either direction. Measured, 17 Aug 2026: `readReach` on
 * CLEAN + PLANTED through this function returned `[]`.
 *
 * 🛑 AND IT IS INLINED, NOT `addInitScript`. renderFile's hook does not work
 * here: `setContent` REUSES the existing document rather than committing a new
 * one, so playwright never fires an init script for it. Measured before it was
 * relied on — `addInitScript(() => { window.__probe = 'installed' })` followed
 * by `setContent` reports `__probe: undefined` and an inline script in the same
 * content reads `MISSING`. Writing it as the first `<script>` in the body is
 * what actually runs before the fixture's own scripts.
 */
export async function render<T>(
  css: string,
  body: string,
  read: () => T,
  reducedMotion: 'reduce' | 'no-preference' = 'no-preference',
  init?: () => void,
): Promise<T> {
  const page = await (await browser()).newPage()
  try {
    const boot = init === undefined ? '' : `<script>(${init.toString()})()</script>`
    await page.emulateMedia({ reducedMotion })
    await page.setContent(`<style>${css}</style>${boot}${body}`)
    return await page.evaluate<T>(read)
  } finally {
    await page.close()
  }
}

/**
 * Load a BUILT page from disk over `file://` — so its own `<link>`ed stylesheet
 * is fetched and applied exactly as the browser will apply it in production.
 * `prepare` runs first and may add markup; `read` then reports what it saw.
 */
export async function renderFile<T>(
  path: string,
  prepare: () => void,
  read: () => T,
  reducedMotion: 'reduce' | 'no-preference' = 'no-preference',
  init?: () => void,
): Promise<T> {
  const page = await (await browser()).newPage()
  try {
    /* 🛑 THE ROUTE FILES <link> GOOGLE FONTS, AND A TEST THAT REACHES THE
       NETWORK IS NOT DETERMINISTIC — it is slow where there is a network and it
       HANGS on `waitUntil:'load'` where there is a captive one. The two font
       origins are refused here rather than in each caller. Nothing under
       design/ depends on the webfont for any property this directory measures:
       every assertion is a colour, a geometry or a focus state. */
    await page.route('**://fonts.googleapis.com/**', (r) => r.abort())
    await page.route('**://fonts.gstatic.com/**', (r) => r.abort())
    /* `init` runs BEFORE the page's own scripts, which is the only moment an
       observer can be installed — the click-listener census in routes.test.ts
       has to wrap `addEventListener` before the route's inline <script> calls
       it. `prepare` is too late by definition; it runs after `load`. */
    if (init !== undefined) await page.addInitScript(init)
    await page.emulateMedia({ reducedMotion })
    await page.goto(pathToFileURL(path).href, { waitUntil: 'load' })
    await page.evaluate<void>(prepare)
    return await page.evaluate<T>(read)
  } finally {
    await page.close()
  }
}

/**
 * TAB THROUGH A BUILT PAGE AND READ EVERY STOP.
 *
 * 🛑 WHY THE KEYBOARD AND NOT `element.focus()`. THIS IS NOT A STYLE PREFERENCE
 * — A PROBE WRITTEN THE OTHER WAY REPORTED A CLEAN RESULT OVER A LIVE DEFECT,
 * and it is recorded here because the next person will reach for `.focus()` too.
 *
 * `:focus-visible` is not a state an element is in; it is a state the browser
 * DECIDES it is in, from the modality of the input that moved focus. Chromium
 * grants it on keyboard navigation and withholds it on a programmatic
 * `.focus()` call on a non-text element. So a probe that calls `.focus()` and
 * reads `getComputedStyle` measures the rules keyed on `:focus` and NEVER
 * evaluates the rules keyed on `:focus-visible` — which is every ring rule in
 * this system. Measured: an audit built that way reported 712 of 712 elements
 * identical across a kernel change, on a record that contains four elements
 * with no focus indicator at all. It agreed with reality by accident and would
 * have agreed with any kernel whatsoever.
 *
 * `Tab` is therefore pressed for real. The cost is one round-trip per stop; the
 * whole design record is ~115 stops and runs in about two seconds.
 *
 * `read` is serialised to source and re-parsed in the page — it may NOT close
 * over anything in this module. It runs once per stop with focus already there,
 * and returns `null` to mean "nothing worth recording at this stop".
 */
/**
 * ONE KEYBOARD AT A TIME.
 *
 * 🛑 A BROWSER HAS EXACTLY ONE FOCUSED PAGE, AND `node --test` RUNS TOP-LEVEL
 * SUITES CONCURRENTLY. Those two facts together are a silent flake generator, and
 * it was MEASURED rather than anticipated: `tests/design/overlays.test.ts` §3
 * asserts that a real Tab opens a tooltip, and it PASSED alone and FAILED beside
 * its siblings — because §1, §2, §4 and §5 had each opened a page of their own in
 * the same browser, and the page that is not frontmost does not receive focus the
 * way a user's does. The assertion was correct; the harness was racing.
 *
 * ⚠️ THIS IS WORSE THAN AN ORDINARY FLAKE AND THAT IS WHY IT IS FIXED HERE RATHER
 * THAN RETRIED. The failure direction is not random. A page that never takes focus
 * reports NO focus ring, NO `:focus-visible` and NO focus-driven state — so the
 * assertions most likely to break are exactly the ones that would otherwise catch
 * a real defect, and the ones most likely to pass spuriously are those written as
 * "nothing is focusable here". A green run would then be evidence about a browser
 * that was not looking.
 *
 * So every function below that presses a real key takes this lock. The cost is
 * that keyboard walks are serialised; measured on this tree it is under two
 * seconds in total, and G108's condition is determinism first.
 */
let keyboardLock: Promise<unknown> = Promise.resolve()

function withKeyboard<T>(run: () => Promise<T>): Promise<T> {
  const mine = keyboardLock.then(run, run)
  /* The chain must not break on a rejection, or one failing assertion would
     release the lock for everyone and the next run would race again. */
  keyboardLock = mine.then(() => undefined, () => undefined)
  return mine
}

export async function tabThrough<T>(
  path: string,
  read: () => T | null,
): Promise<T[]> {
  return withKeyboard(() => tabThroughLocked(path, read))
}

async function tabThroughLocked<T>(
  path: string,
  read: () => T | null,
): Promise<T[]> {
  const page = await (await browser()).newPage()
  try {
    await page.goto(pathToFileURL(path).href, { waitUntil: 'load' })
    await page.bringToFront()
    /* The tab ORDER is the browser's, but the number of stops has to come from
       somewhere; counting the focusable elements bounds the loop without
       assuming the order.
       ⚠️ EXACTLY `stops` PRESSES, NOT ONE MORE. The first draft pressed
       `stops + 2` to "see the cycle wrap", and the wrap is precisely the
       problem: focus leaves the last element, passes through the document, and
       returns to the FIRST — so a three-element fixture reported four stops and
       the count assertion built on it went red against the walker rather than
       against the page. Focus starts on `body` after a load, so the Nth press
       lands on the Nth focusable element and `stops` presses is the whole
       page, visited once each. */
    const stops = await page.evaluate<number>(() => document.querySelectorAll(
      'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"]),summary',
    ).length)
    const out: T[] = []
    for (let i = 0; i < stops; i++) {
      await page.keyboard.press('Tab')
      const r = await page.evaluate<T | null>(read)
      if (r !== null) out.push(r)
    }
    return out
  } finally {
    await page.close()
  }
}

/**
 * DRIVE A LIVE PAGE — press keys, click controls, and read between the two.
 *
 * 🛑 WHY THE THREE FUNCTIONS ABOVE ARE NOT ENOUGH, STATED SO THIS ONE IS NOT
 * MISTAKEN FOR CONVENIENCE. `render` and `renderFile` are `prepare` then `read`:
 * ONE observation of a page in ONE state. `tabThrough` presses Tab and reads, but
 * the sequence is fixed and no read can influence it. Every behaviour G247 is
 * about is a SEQUENCE WITH A BRANCH IN IT — open a drawer, Tab to its last
 * control, Tab again, and assert focus came back to the FIRST rather than
 * escaping to the page behind; or press Escape and assert the panel is both
 * flagged shut AND painted shut, which is the exact pair three design files got
 * wrong in opposite directions. Neither is expressible as prepare-then-read.
 *
 * 🛑 AND THE OBVIOUS SHORTCUT IS THE ONE `tabThrough`'s HEADER ALREADY PRICES.
 * A suite that reached for `element.focus()` and `element.click()` to build these
 * sequences would measure the rules keyed on `:focus` and never evaluate a single
 * `:focus-visible` rule — which is every ring rule in this system, and G240 makes
 * the ring the property this slice must measure rather than review. It would also
 * never set the tooltip's load guard, because a programmatic click fires no
 * pointer event. Both methods below go through the browser's real input pipeline
 * for that reason.
 *
 * `steps` runs in NODE and may close over anything. Only the callbacks handed to
 * `d.read()` cross into the page, and those obey the same rule as every other
 * closure in this file: they are serialised to source and may close over nothing.
 */
export interface Driver {
  /** A real key press, through the browser's input pipeline — the only way
   *  `:focus-visible` is ever granted. */
  press(key: string): Promise<void>
  /** A real pointer click at the element's position. NOT `element.click()`,
   *  which fires no pointer events and so never sets the tooltip's load guard. */
  click(selector: string): Promise<void>
  /** Read the page. The callback may close over NOTHING. */
  read<T>(fn: () => T): Promise<T>
  /**
   * Let the compositor catch up — two animation frames.
   *
   * 🛑 THIS EXISTS BECAUSE A TRANSITION MEANS A READ TAKEN IMMEDIATELY AFTER AN
   * EVENT MEASURES THE *OLD* PAINT. The tooltip fades over `--t-fade` (RM-05), so
   * `press('Escape')` then `read(opacity)` reports the value the panel had before
   * the keystroke, and an assertion built on it is red against the clock rather
   * than against the page — or, worse, GREEN against a real defect for the same
   * reason. Callers that measure paint pair this with
   * `reducedMotion: 'reduce'`, which collapses every duration in the record to
   * `.001ms` through the kernel's own universal guard, so two frames is ample and
   * the wait is not a sleep whose length has to be guessed.
   */
  settle(): Promise<void>
}

export async function drive<T>(
  path: string,
  steps: (d: Driver) => Promise<T>,
  reducedMotion: 'reduce' | 'no-preference' = 'no-preference',
): Promise<T> {
  /* Serialised — see `withKeyboard`. Every step below is a real key press or a
     real click, and both need this page to be the browser's focused one. */
  return withKeyboard(() => driveLocked(path, steps, reducedMotion))
}

async function driveLocked<T>(
  path: string,
  steps: (d: Driver) => Promise<T>,
  reducedMotion: 'reduce' | 'no-preference',
): Promise<T> {
  const page = await (await browser()).newPage()
  try {
    await page.route('**://fonts.googleapis.com/**', (r) => r.abort())
    await page.route('**://fonts.gstatic.com/**', (r) => r.abort())
    await page.emulateMedia({ reducedMotion })
    await page.goto(pathToFileURL(path).href, { waitUntil: 'load' })
    await page.bringToFront()

    const settle = async (): Promise<void> => {
      await page.evaluate<unknown>(() => new Promise((resolve) => {
        requestAnimationFrame(() => { requestAnimationFrame(() => { resolve(null) }) })
      }))
    }

    /* 🛑 THE PAGE IS SETTLED BEFORE THE FIRST STEP, AND WITHOUT THIS THE SUITE IS
       FLAKY IN THE DIRECTION THAT HIDES DEFECTS. `load` fires when the classic
       script has run and React has rendered — but React 19 flushes PASSIVE EFFECTS
       asynchronously, after paint. Any `useEffect` that installs a document
       listener is therefore not installed yet at `load`.
       MEASURED, not reasoned about: `tests/design/overlays.test.ts` §3 presses Tab
       three times to reach a tooltip trigger, and the tooltip's load guard is armed
       by a `keydown` listener installed in exactly such an effect. When the presses
       won the race the guard was never armed, focus did not open the panel, and the
       assertion failed — intermittently, roughly one run in two, with the failure
       reading as a broken tooltip rather than as a harness race. The same hazard
       applies to every `click()` below.
       Two frames is the fix rather than a sleep of a guessed length: React's
       passive-effect flush is scheduled ahead of the next frame, so a page that has
       painted twice has run them. */
    await settle()

    return await steps({
      press: (key) => page.keyboard.press(key),
      click: (selector) => page.click(selector),
      read: (fn) => page.evaluate(fn),
      settle,
    })
  } finally {
    await page.close()
  }
}

/**
 * READ THE PAINT, NOT THE STYLE — G3661, 3 Oct 2026.
 *
 * A computed style can say WHICH gradient applies; it cannot say what colour a
 * pixel ends up, and a contrast claim is a claim about the pixel. So this
 * renders `css` + `body`, optionally HOVERS `selector`, then for each instant in
 * `times` PAUSES every running animation (pseudo-elements included — the sweep
 * is an `::after`) at that `currentTime`, takes a real screenshot of the
 * element's box, decodes it IN THE PAGE (a canvas, so no PNG decoder is taken
 * as a dependency), and returns the RGB of a `cols × rows` grid of points.
 * The grid includes the box's top row, where the light's source sits.
 */
export interface PaintProbe {
  readonly selector: string
  readonly cols: number
  readonly rows: number
  readonly hover?: boolean
  /** Animation instants, in ms. `[]` samples the page as it stands. */
  readonly times: readonly number[]
  /** Pixels trimmed from each side before sampling — e.g. a 1px inset edge
   *  that no text ever sits on. */
  readonly inset?: number
}
export type Rgb = readonly [number, number, number]

export async function samplePaint(css: string, body: string, probe: PaintProbe): Promise<Rgb[]> {
  const page = await (await browser()).newPage()
  try {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.setContent(`<style>${css}</style>${body}`)
    if (probe.hover === true) await page.hover(probe.selector)
    const box = await page.evaluate((sel: string) => {
      const r = (document.querySelector(sel) as Element).getBoundingClientRect()
      return { x: Math.ceil(r.x), y: Math.ceil(r.y), width: Math.floor(r.width), height: Math.floor(r.height) }
    }, probe.selector)
    const trim = probe.inset ?? 0
    const clip = { x: box.x + trim, y: box.y + trim, width: box.width - 2 * trim, height: box.height - 2 * trim }
    const out: Rgb[] = []
    const instants: readonly (number | null)[] = probe.times.length === 0 ? [null] : probe.times
    for (const t of instants) {
      if (t !== null) {
        await page.evaluate((ms: number) => {
          for (const a of document.getAnimations()) { a.pause(); a.currentTime = ms }
        }, t)
      }
      const png = await page.screenshot({ clip })
      const b64 = Buffer.from(png).toString('base64')
      const pts = await page.evaluate(async (a: { b64: string; cols: number; rows: number }) => {
        const img = new Image()
        img.src = `data:image/png;base64,${a.b64}`
        await img.decode()
        const c = document.createElement('canvas')
        c.width = img.width
        c.height = img.height
        const g = c.getContext('2d') as CanvasRenderingContext2D
        g.drawImage(img, 0, 0)
        const px: [number, number, number][] = []
        for (let j = 0; j < a.rows; j++) {
          for (let i = 0; i < a.cols; i++) {
            const x = Math.min(img.width - 1, Math.round((i * (img.width - 1)) / Math.max(1, a.cols - 1)))
            const y = Math.min(img.height - 1, Math.round((j * (img.height - 1)) / Math.max(1, a.rows - 1)))
            const d = g.getImageData(x, y, 1, 1).data
            px.push([d[0] ?? 0, d[1] ?? 0, d[2] ?? 0])
          }
        }
        return px
      }, { b64, cols: probe.cols, rows: probe.rows })
      out.push(...pts)
    }
    return out
  } finally {
    await page.close()
  }
}
