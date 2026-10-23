/**
 * THE SEVEN TIERS, LOADED — NOT TRANSCRIBED.
 *
 * ⚠️ THIS HEADING SAID *SIX* UNTIL 20 Sep 2026, *FIVE* UNTIL 19 Sep 2026 AND
 * *FOUR* BEFORE THAT — **and the SIX was already one behind when G781 landed
 * `platformConsole` the day before**, which is why the object below is the
 * claim and this sentence is not. Derive it, never read it:
 * `node -e "import('./server/contract/document.ts').then(m=>console.log(Object.keys(m.TIERS)))"`
 * → eight keys, of which `errors` declares no operation. G191's
 * own words are quoted below and say "four" because four is what existed when
 * it was ruled; the ruling is about the DOCUMENT being the router, and it binds
 * the sixth exactly as it binds the first four.
 *
 * 🛑 THE SIXTH IS `administration`, REGISTERED UNDER G533 AND MOUNTED BY
 * NOTHING — read `server/contract/capability.ts`'s entry for it before adding
 * a handler, because registering a tier and serving one are different acts and
 * this file's own note three paragraphs down says so.
 *
 * RULING 1, 16 Aug 2026: "the four OpenAPI files are the router and the
 * validator, not documentation that drifts." This module is the only place a
 * contract is read, and every route, every request schema and every response
 * schema in `server/` comes from here.
 *
 * 🛑 G109 IS APPLIED HERE, AND IT IS THE FIRST TIME. The ruling reads: `tools/`
 * takes a REAL YAML parser, pinned exact — DO NOT HAND-ROLL ONE — because a
 * hand-parser that is subtly wrong produces a checker that passes while
 * asserting nothing (docs/HANDOFF.md §5.6). `tools/check-wire-mirror.mjs` was
 * built the way G109 forbids and says so in its own header. This module takes
 * the dependency the ruling names: `yaml@2.9.0`, pinned exact in
 * package.json. The line scanners in `tests/http/` and `tools/` are unchanged —
 * changing them is not this slice's decision — but nothing in `server/` scans a
 * line of YAML.
 *
 * ⚠️ WHAT LOADING BUYS AND WHAT IT DOES NOT. Loading the document makes the
 * SERVER unable to drift from the contract: an operation the document does not
 * declare cannot be registered (see `routes.ts`), and a query value the document
 * forbids cannot reach a handler. It does NOT make the CONTRACT unable to drift
 * from `model/` — that is the wire-mirror checker's job and it is a separate,
 * still-open problem.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { parse } from 'yaml'

export const CONTRACTS_DIR = path.resolve(import.meta.dirname, '..', '..', 'docs', 'contracts')

/**
 * The seven tiers plus the shared error vocabulary. ⚠️ **SAID SIX UNTIL
 * 20 Sep 2026 and was one behind from the day `platformConsole` arrived.**
 * Named here so a typo is a
 * compile error rather than a file that silently is not there.
 *
 * ⚠️ ADDING A KEY HERE IS NOT MOUNTING ANYTHING. This object is the document
 * registry; a plane serves an operation only by naming a handler in its own
 * `start.ts`. `session` is registered here and mounted nowhere, which is G200's
 * distinction — "the freeze is on MOUNTING, not on declaring" — and it is what
 * makes the tier visible to `tools/check-capability-annotations.mjs` — which was
 * `tests/contracts/annotations.mjs` until G200's gate landed on 19 Sep 2026 and
 * promoted it into the gate — whose `OPERATION_TIERS` derives from this object
 * precisely "so that a fifth contract file cannot be invisible to this suite."
 *
 * ✅ **AND THAT SENTENCE WAS TESTED A SECOND TIME AND HELD A SECOND TIME.**
 * `administration` arrived here under G533 and all fifty-nine of its
 * operations entered `OPS` with no edit to the checker at all — which is the
 * whole argument for deriving the list from this object instead of writing it
 * out. `session` was the first witness; this is the second, and it is 59
 * operations rather than 4.
 *
 * 🛑 AND THIS KEY SET IS NOW A TYPE THAT MUST BE ANSWERED SOMEWHERE ELSE.
 *
 * ⚠️ **THE LITERAL IT MUST BE ANSWERED AT CHANGED ON 20 Sep 2026 — G913 —
 * AND THE OLD SENTENCE IS KEPT BECAUSE ITS ARGUMENT IS THE REASON THE NEW
 * LITERAL EXISTS.** It read: *"`TIER_REQUIRES_CAPABILITY` in
 * `server/contract/capability.ts` is a `Record<TierName, boolean>`, so a
 * SEVENTH tier added here is a **TS2741 at that literal** — ⚠️ this said
 * SIXTH until 19 Sep 2026 and it was correct when written; `administration`
 * is the sixth and it cost exactly the TS2741 this paragraph predicted —
 * until somebody writes down, with a reason, whether its operations carry a
 * capability. That is deliberate: a tier nobody classified would otherwise
 * read as `undefined`, which is falsy, and every operation on it would be
 * excused by an oversight rather than by a decision."*
 *
 * **`TIER_REQUIRES_CAPABILITY` IS RETIRED AND THE FENCE IS NOT.** An EIGHTH
 * tier added here is a TS2741 at `EXEMPT_WITH_A_PERSON_TO_ASK`, one
 * declaration further down the same file, and the failure mode is the one the
 * old sentence names: a missing key reads as `undefined`, so the census would
 * go quiet on that tier rather than fail. What a new tier must write down is
 * no longer a VERDICT — there is none, an operation answers for itself since
 * G911 — but a COUNT: how many of its operations state an exemption while
 * declaring a caller who may be a person.
 */
export const TIERS = {
  /** C1–C13. The only tier a customer's browser meets. */
  capability: 'capability.openapi.yaml',
  /** F1–F13. In-process today; no plane serves it. */
  foundation: 'foundation.openapi.yaml',
  /** X1–X8. The only tier crossing an AWS account boundary. */
  controlPlane: 'control-plane.openapi.yaml',
  /** Liveness and telemetry, served inside the data plane's own network. */
  dataPlaneLocal: 'data-plane-local.openapi.yaml',
  /**
   * A1–A4. The way in — the tier that ISSUES the `X-Session` the three above
   * demand and none of them produces. Declared and unmounted under G200; its
   * first two operations carry no session by definition, which is why it
   * declares `security: []` at document level and cannot live in any of the
   * files that declare a required scheme at theirs.
   */
  session: 'session.openapi.yaml',
  /**
   * H1–H11 and P1–P9. The partner portal and the staff console — 59
   * operations over 52 paths, the single largest block of declared contract
   * surface here, and **mounted by nothing**.
   *
   * 🛑 REGISTERED UNDER G533, 19 Sep 2026, AND THE DOCUMENT IT REGISTERS SAID
   * IN ITS OWN VOICE THAT THIS WAS OWED: *"⚠️ IT IS NOT EVEN REGISTERED.
   * `TIERS` in `server/contract/document.ts` names five tiers and this is not
   * one of them, so `loadTier()` cannot read this file and
   * `tools/check-capability-annotations.mjs` cannot see a single operation
   * below. **That is a deliberate consequence of the scope this slice was
   * given and it is a real hole, named here rather than left to be found.**"*
   * This key is the first half of closing it; `TIER_REQUIRES_CAPABILITY` in
   * `server/contract/capability.ts` was the second, and that file carries the
   * argument G288 asked whoever took the registration to supply. ⚠️ **THAT
   * TABLE IS RETIRED (G913, 20 Sep 2026) AND ITS ARGUMENT IS KEPT AT ITS OWN
   * SITE**; what a tier owes now is an entry in
   * `EXEMPT_WITH_A_PERSON_TO_ASK`, which counts rather than decides.
   *
   * ⚠️ WHAT REGISTERING BUYS, MEASURED RATHER THAN CLAIMED. Before:
   * `node tools/check-capability-annotations.mjs` reported **77 declared
   * operations** across five tiers. After: **136** across six. Fifty-nine
   * operations — a third of the declared surface — moved from *"checked by
   * one test file that reads the YAML with a regex"* to *"checked by the gate
   * stage that reads it through the same parser and the same
   * `classifyAnnotation()` the router boots through."* Derive it:
   * `node tools/check-capability-annotations.mjs | head -1`.
   *
   * 🛑 AND WHAT IT DOES NOT BUY, WHICH IS THE LARGER HALF. Registering mounts
   * nothing — the note below this object already says a key here is not a
   * mount — and G318 sequences this tier LAST, after ingestion, exceptions
   * and correspondence: *"until H1 and H2 exist, every tenant is created by
   * hand. That is the state the repository is in today and this ruling
   * extends it deliberately rather than by omission."* Three separate things
   * still block a mount and none of them is effort; they are enumerated in
   * `tests/http/administration-tier-unmounted.test.ts`, which measures each
   * one rather than asserting it.
   *
   * ⚠️ TWO SERVERS, ONE DOCUMENT — `console.reconcileai.app/v1` and
   * `partners.reconcileai.app/v1` — and `basePathOf()` below reads
   * `servers[0]` ALONE. The document names that as an open question for
   * whoever mounts this tier: *"A plane that mounts this tier serves one host
   * and must refuse the other's paths. Nothing below expresses that, and
   * nothing in `server/` can."* Registering does not answer it, and nothing
   * here should be read as having answered it.
   */
  administration: 'administration.openapi.yaml',
  /**
   * H1 and H2's platform half — 14 staff-console operations over 13 paths.
   *
   * ⚠️ **THIS READ *"the only tier besides `capability` whose
   * `TIER_REQUIRES_CAPABILITY` is `true`"* UNTIL 20 Sep 2026 AND G911 RETIRED
   * THAT TABLE.** All fourteen still name a capability and all fourteen are
   * still gated; what is gone is the claim that the FILE is what makes them
   * so. **The paragraph below is therefore the history of a decision rather
   * than a description of the mechanism, and is kept whole for that reason.**
   *
   * 🛑 THIS FILE EXISTS TO HOLD A BOOLEAN, AND THE OWNER SAID SO WHEN THEY
   * RULED IT: *"it is still contract surgery and still a ruling."* The verdict
   * below is per TIER and a tier is a FILE, so gating SOME of
   * `administration.openapi.yaml` meant making those operations a different
   * file. The document's §7 carries the objection and names the repair nobody
   * has taken — a per-OPERATION verdict — rather than pretending the split is
   * a tidy-up.
   *
   * ⚠️ THE OWNER'S RULING SAID 26 AND THIS TIER TAKES 14, WHICH IS THE ONE
   * PLACE THIS SLICE DEPARTS FROM ITS INSTRUCTION. G602's table records
   * `platform-role` (26) as annotatable since G601; twelve of those twenty-six
   * act on a class `PLATFORM_ASSIGNMENT_REACHES` refuses, or on `commercial`
   * with no write verb to name. Moving them would have put an `exempt:` on a
   * `true` tier, which `check:annotations` refuses as check D — a red gate
   * rather than a delivery. §1 of the document enumerates all twelve with the
   * reason each has no verb. Derive the split, never read it:
   * `grep -c 'x-admin-authority: platform-role' docs/contracts/*.openapi.yaml`.
   *
   * 🛑 REGISTERED AND MOUNTED BY NOTHING, and the blocker is `mountTier()`'s
   * SIXTH FENCE rather than effort: `authorize()` mints an `AuthorizationGrant`
   * that `extends TenantScoped`, and a platform principal acting on the fleet
   * has no tenant for that record to live in. G728 found the same wall from the
   * console-session side and it is an owner's ruling, not a builder's.
   */
  platformConsole: 'platform-console.openapi.yaml',
  /** Not a tier. The closed error enum every tier references. */
  errors: 'errors.yaml',
} as const

export type TierName = keyof typeof TIERS

export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue }

/** A parsed OpenAPI document. Deliberately untyped beyond "a JSON object". */
export type OpenApiDocument = { readonly [k: string]: JsonValue }

const cache = new Map<TierName, OpenApiDocument>()

/**
 * Parse one tier, once per process.
 *
 * Cached because a plane registers its routes at boot and never re-reads: a
 * contract that could change under a running server would make the route table
 * and the validator disagree with each other mid-request.
 */
export function loadTier(tier: TierName): OpenApiDocument {
  const hit = cache.get(tier)
  if (hit !== undefined) return hit
  const file = path.join(CONTRACTS_DIR, TIERS[tier])
  const parsed: unknown = parse(readFileSync(file, 'utf8'))
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${TIERS[tier]} did not parse to an object`)
  }
  const doc = parsed as OpenApiDocument
  cache.set(tier, doc)
  return doc
}

/**
 * The path prefix every operation in a document hangs off, taken from
 * `servers[0].url`.
 *
 * ⚠️ PARSED WITH A REGEX RATHER THAN `new URL()` ON PURPOSE. The capability
 * tier's server url is `https://{dataPlaneHost}/v1` and the control plane's is
 * `https://{ingestHost}` — RFC 6570 templates, not URLs, and `new URL()` either
 * throws on them or percent-encodes the braces into the hostname. Only the PATH
 * is wanted and only the authority has to be skipped, so skipping the authority
 * is all this does.
 *
 * `tests/http/harness.ts` pins `/v1` for the capability tier from this same
 * line of the same document.
 */
export function basePathOf(doc: OpenApiDocument): string {
  const servers = doc['servers']
  if (!Array.isArray(servers) || servers.length === 0) return ''
  const first = servers[0]
  if (typeof first !== 'object' || first === null || Array.isArray(first)) return ''
  const url = (first as { [k: string]: JsonValue })['url']
  if (typeof url !== 'string') return ''
  const withoutAuthority = url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '')
  return withoutAuthority.replace(/\/$/, '')
}
