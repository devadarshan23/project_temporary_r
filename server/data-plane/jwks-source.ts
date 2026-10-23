/**
 * THE KEY DOCUMENT'S TRANSPORT — W3/S4, R2, G2131–G2134, 25 Sep 2026.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS IS THE ONLY FILE IN `server/` THAT MAKES AN OUTBOUND HTTP REQUEST,
 *    AND IT IS REACHED AT BOOT AND FROM NOWHERE ELSE.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Until 25 Sep 2026 nothing in `server/` made one at all, and
 * `tests/http/console-roster-unreachable.test.ts` §1c asserted that emptiness
 * over both plane directories. **R2 SPENDS THAT PROPERTY DELIBERATELY AND THE
 * OWNER SAID SO:**
 *
 *     "The JWKS is fetched ONCE AT BOOT and cached in memory. No runtime
 *      egress."
 *
 * ⚠️ **THE ASSERTION IS RE-ARGUED RATHER THAN DELETED, AND THE DIFFERENCE IS
 * THE WHOLE POINT.** §1c now enumerates the files that may carry an outbound
 * call — this one, and no other — and asserts that **`server/control-plane/`
 * carries none**, which was §1c's actual subject: the SigV4 pull the owner did
 * not take. A weaker assertion that merely deleted the old one would be
 * spending a property and replacing it with nothing, which is the failure
 * `db/control-read-scope.ts` names in the ruling's own words one database over:
 * *"By construction becomes by census, and that is a real loss, not a wash."*
 *
 * **What replaces the construction here is a CENSUS plus an IMPORT FENCE**, and
 * the fence is `run-queue.ts`'s (G1201) verbatim rather than a new idea: this
 * module's RUNTIME reach is a **dynamic** import, performed inside
 * `loadVerificationTerms()` and nowhere else, so **a plane that has no key
 * document configured never LOADS this file** and there is no code path in the
 * process to reach an outbound call from.
 *
 * 🛑 **AND THE DERIVATION FOR THAT IS A TEST AND NOT A `grep`, WHICH THIS
 * HEADER LEARNED THE WAY EVERY OTHER FILE HERE HAS — BY WRITING THE WRONG ONE
 * FIRST (G2134).** A draft of this paragraph said *"derive it, never read it:
 * a bare `grep` for the import path -> exactly one line"*. **It
 * returns THREE, and two of them are this sentence and its twin in
 * `verification-terms.ts`** — prose quoting a command in order to describe
 * what the command proves. That is G978 exactly (*"THE COMMAND RETURNED THREE
 * LINES … AND ALL THREE WERE PROSE"*) and G1996's repair applies: **key on the
 * call syntax, count files, or strip the comments.** The control is
 * `tests/http/console-roster-unreachable.test.ts` §1c, which strips them.
 *
 * ⚠️ **AND THERE *IS* A STATIC LINE NAMING THIS MODULE, WHICH IS NOT A HOLE:**
 * `verification-terms.ts` carries `import type { JwksFetchRefusal }`, and
 * `verbatimModuleSyntax` ERASES a type-only specifier before the loader sees
 * it — the same mechanism `CLAUDE.md` records hiding three unloadable modules
 * on 8 Aug 2026, working in the useful direction for once. **A reader checking
 * this fence must ask whether an import is a VALUE import; a `grep` for the
 * path cannot.**
 *
 * 🛑 AND THE ONE IMPORTER IS `verification-terms.ts`, WHICH IS ITSELF CALLED
 * FROM BOOT ONLY. `server/data-plane/main.ts` awaits it before it listens;
 * `start.ts` does not, so every test and every fixture plane runs with no
 * transport loaded at all.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️ THE TWO COSTS THE OWNER ACCEPTED, STATED HERE RATHER THAN DISCOVERED
 * ══════════════════════════════════════════════════════════════════════════
 *
 * 🛑 **A KEY ROTATION NEEDS A RESTART.** There is no refresh, no timer, no
 * cache invalidation and no second call — **by construction, not by omission**:
 * the document is returned as a VALUE and this module holds no state, so the
 * only way to obtain a newer one is to call this function again, and the only
 * caller is boot. A broker that rotates its signing keys while a plane is up
 * will produce `token_key_not_found` for every token signed with the new key
 * until that plane is restarted. **Do not repair that with a timer here.** A
 * refresh is a SECOND egress on a running process, which is the thing R2's
 * sentence forbids, and taking it is an owner's ruling.
 *
 * 🛑 **BOOT NOW DEPENDS ON THE BROKER BEING REACHABLE, SO A COGNITO OUTAGE IS
 * A FAILED DEPLOY RATHER THAN A DEGRADED SERVICE.** That is the FAIL-CLOSED
 * direction and it was chosen; what this module owes in exchange is to fail
 * **loudly**, naming what was unreachable. A plane that booted with no keys and
 * discovered it on the first sign-in would have converted a chosen failure into
 * a hidden one — and it would have discovered it as `token_key_not_found`,
 * which means *a rotation* to every operator who has ever read that arm.
 * `verification-terms.ts` is where the throw lives, because the decision to
 * refuse to boot belongs to the process and not to its transport.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT THIS MODULE DOES NOT DO: IT DOES NOT JUDGE A KEY
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `token-verify.ts` §0a is the one place a key is judged — *"only `kty`, `n`
 * and `e` are [passed to `createPublicKey()`], and `kty` must be `RSA`"* — and
 * re-checking any of that here would be §5.3, two implementations of one rule
 * with the copy free to drift. So this module refuses five things about the
 * DOCUMENT (is there one, did it arrive, does it parse, is it a key set, is it
 * empty) and **nothing at all about any key in it**.
 *
 * ⚠️ **THE PROJECTION BELOW IS NOT A SIXTH CHECK AND CHANGES NO OUTCOME.**
 * `keyEntry()` keeps the six declared members when they are strings and drops
 * them otherwise, so a document carrying `"n": 12345` yields an entry with `n`
 * ABSENT. `verifyIdentityToken()` answers `token_key_unusable` for an absent
 * `n` and for a non-string `n` alike — **the same arm, reached the same way** —
 * and what the projection buys is that `JsonWebKeyEntry`'s declared types are
 * true of the value rather than asserted over it by a cast. It refuses nothing.
 */

import type { AssertNoTextDeep } from '../../model/reconciliation.ts'
import type { JsonWebKeyEntry, JwksDocument } from './token-verify.ts'

/* ==================================================================== *
 * §1  WHERE THE DOCUMENT IS, AND HOW LONG WE WAIT FOR IT
 * ==================================================================== */

/**
 * The one request this process makes.
 *
 * ⚠️ `timeoutMs` IS REQUIRED AND IS NOT DEFAULTED, for
 * `SUGGESTED_CLOCK_SKEW_SECONDS`'s stated reason one file over: *"a default
 * would be a tolerance nobody chose"*. Here the value decides how long a
 * deployment hangs before it fails, which is a deployment's decision.
 */
export interface JwksFetchTarget {
  /** The broker's published key-set URL, verbatim from configuration. */
  readonly url: string
  /** How long to wait in total before giving up and refusing to boot. */
  readonly timeoutMs: number
}

/* ==================================================================== *
 * §2  THE REFUSALS
 * ==================================================================== */

/**
 * Why a key document was not obtained. FIVE arms, and each is a different
 * operator action: the network or the URL is wrong · the broker answered and
 * said no · the broker answered with something that is not JSON · it is JSON
 * and is not a key set · it is a key set and is empty.
 *
 * 🛑 THEY ARE NOT COLLAPSED, ON `token-verify.ts` §3's stated ground: four of
 * its fifteen *"all mean 'this token is not from us' on the wire and mean four
 * completely different things to an operator"*. The same holds here and the
 * consequences are larger, because every one of these arms stops a deploy.
 *
 * ⚠️ `jwks_status_not_ok` CARRIES A NUMBER AND THE OTHERS CARRY NOTHING.
 * `token-verify.ts` §0c refuses to let a refusal carry a value *"that came out
 * of a token we have just refused to believe"*; a response STATUS is not that —
 * it is an integer we read off a response line at a URL WE configured, it is
 * not counterparty-authored text, and it is the single most useful thing an
 * operator can be told when a deploy stops (a 403 is a pool policy, a 404 is a
 * wrong URL, a 500 is theirs). `AssertNoTextDeep` admits `number` and refuses
 * `string`, so the line between the two is held by the compiler below rather
 * than by this paragraph.
 */
export type JwksFetchRefusal =
  /** The request did not complete: DNS, TCP, TLS, or the timeout elapsed. */
  | { readonly kind: 'jwks_unreachable' }
  /** The broker answered with a status outside 200–299. */
  | { readonly kind: 'jwks_status_not_ok'; readonly status: number }
  /** The body did not decode as JSON, or decoded to something that is not an object. */
  | { readonly kind: 'jwks_body_unreadable' }
  /** There is no `keys` array. A JSON object is not a key set. */
  | { readonly kind: 'jwks_not_a_key_set' }
  /**
   * `keys` is an array and it is empty.
   *
   * 🛑 REFUSED RATHER THAN CACHED, AND THIS IS THE §5.6 ARM. An empty key set
   * verifies NOTHING while looking exactly like a healthy boot — every token
   * would answer `token_key_not_found`, which reads as a rotation rather than
   * as a plane that never had a key. Refusing at boot is the only place this is
   * a refusal rather than an incident.
   */
  | { readonly kind: 'jwks_key_set_empty' }

/** The containment proof. `kind` and `status` pass; a `string` field would not. */
export type _JwksRefusalHoldsNoText = AssertNoTextDeep<JwksFetchRefusal>

/**
 * The closed set as values, for a census or a log switch. Proven to contain the
 * union and to be contained by it — `token-verify.ts`'s
 * `TOKEN_VERIFICATION_REFUSALS` shape, which is what makes a hand-written list
 * of a closed set safe.
 */
export const JWKS_FETCH_REFUSALS = [
  'jwks_unreachable',
  'jwks_status_not_ok',
  'jwks_body_unreadable',
  'jwks_not_a_key_set',
  'jwks_key_set_empty',
] as const

type Assert<T extends true> = T

/** Both directions. A sixth arm with no roster entry fails to compile here. */
export type _EveryJwksRefusalIsListed = Assert<
  (typeof JWKS_FETCH_REFUSALS)[number] extends JwksFetchRefusal['kind']
    ? JwksFetchRefusal['kind'] extends (typeof JWKS_FETCH_REFUSALS)[number]
      ? true
      : false
    : false
>

/** The construction site, so the proof BITES rather than merely compiling. */
export const JWKS_REFUSAL_ROSTER_IS_TOTAL: _EveryJwksRefusalIsListed = true

/** Obtained, or refused. Nothing throws; every failure is a value. */
export type JwksFetchResult =
  | { readonly ok: true; readonly document: JwksDocument }
  | { readonly ok: false; readonly refusal: JwksFetchRefusal }

/* ==================================================================== *
 * §3  THE PROJECTION
 * ==================================================================== */

function stringMember(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key]
  return typeof value === 'string' ? value : undefined
}

/**
 * One entry, narrowed to the six declared members that are strings.
 *
 * See the header: this refuses nothing and changes no verification outcome. It
 * exists so that `JsonWebKeyEntry`'s declared types are TRUE of the value
 * rather than asserted over it, which is what keeps a `cast` out of the one
 * path a forged key document would travel.
 *
 * ⚠️ `exactOptionalPropertyTypes` IS ON, so an absent member must be absent
 * rather than present-and-`undefined`; the conditional spread is what makes
 * that expressible.
 */
function keyEntry(source: Record<string, unknown>): JsonWebKeyEntry {
  const kty = stringMember(source, 'kty')
  const kid = stringMember(source, 'kid')
  const use = stringMember(source, 'use')
  const alg = stringMember(source, 'alg')
  const n = stringMember(source, 'n')
  const e = stringMember(source, 'e')
  return {
    ...(kty === undefined ? {} : { kty }),
    ...(kid === undefined ? {} : { kid }),
    ...(use === undefined ? {} : { use }),
    ...(alg === undefined ? {} : { alg }),
    ...(n === undefined ? {} : { n }),
    ...(e === undefined ? {} : { e }),
  }
}

/* ==================================================================== *
 * §4  THE ONE REQUEST
 * ==================================================================== */

/**
 * Obtain the broker's key document. **Called once, at boot, by
 * `loadVerificationTerms()` and by nothing else.**
 *
 * ⚠️ `redirect: 'error'` IS A CONTROL AND NOT A STYLE. The configured URL is
 * the document we mean to read; a 3xx to somewhere else is a different broker's
 * keys arriving under our configuration's name, and following one silently
 * would make the issuer this plane trusts a property of somebody else's
 * response header. It costs nothing — a key-set endpoint that redirects is one
 * whose real URL belongs in the configuration.
 *
 * ⚠️ AND IT SENDS NO CREDENTIAL, NO COOKIE AND NO IDENTIFYING HEADER. A JWKS
 * is public by construction; authenticating to read one would give this process
 * a second credential for its whole life, which is what G193 split the migrator
 * out of a listener to prevent.
 *
 * 🛑 IT NEVER THROWS. A transport failure at boot has to reach the caller as a
 * VALUE so that the caller can name the URL in the message it dies with — an
 * exception escaping from here would carry a Node error string into a log this
 * repository governs the content of (G261 §12.1), and would name nothing an
 * operator can act on.
 */
export async function fetchJwksDocument(target: JwksFetchTarget): Promise<JwksFetchResult> {
  let response: Response
  try {
    response = await fetch(target.url, {
      method: 'GET',
      redirect: 'error',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(target.timeoutMs),
    })
  } catch {
    return { ok: false, refusal: { kind: 'jwks_unreachable' } }
  }

  if (!response.ok) {
    return { ok: false, refusal: { kind: 'jwks_status_not_ok', status: response.status } }
  }

  let parsed: unknown
  try {
    parsed = await response.json()
  } catch {
    return { ok: false, refusal: { kind: 'jwks_body_unreadable' } }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, refusal: { kind: 'jwks_body_unreadable' } }
  }

  const keys = (parsed as Record<string, unknown>)['keys']
  if (!Array.isArray(keys)) {
    return { ok: false, refusal: { kind: 'jwks_not_a_key_set' } }
  }

  const entries: JsonWebKeyEntry[] = []
  for (const candidate of keys) {
    /* A non-object member is DROPPED rather than refused: it is not a key, it
     * cannot become one, and a document carrying one alongside real keys is a
     * broker's defect we cannot fix from here — refusing would take every token
     * in that pool down for it. `token-verify.ts` §6 makes the same call about
     * a duplicate `kid`, in the same words and the same direction. */
    if (typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)) {
      entries.push(keyEntry(candidate as Record<string, unknown>))
    }
  }

  if (entries.length === 0) {
    return { ok: false, refusal: { kind: 'jwks_key_set_empty' } }
  }

  return { ok: true, document: { keys: entries } }
}
