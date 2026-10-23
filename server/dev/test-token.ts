/**
 * THE LOCAL-ONLY SIGNED TEST TOKEN — RULING 2, 16 Aug 2026.
 *
 * "A script mints a short-lived token the server accepts ONLY when an explicit
 * local flag is set."
 *
 * ┌─ WHY THIS FILE IS IN `server/dev/` AND NOTHING IN `server/data-plane/`      ┐
 * │  STATICALLY IMPORTS IT.                                                     │
 * │                                                                             │
 * │  The instruction over this slice reads: "make the fence STRUCTURAL where     │
 * │  you can rather than conditional. A build that cannot contain the code path  │
 * │  beats a runtime check."                                                     │
 * │                                                                             │
 * │  So the fence is not `if (flag) { accept } else { refuse }` inside a request  │
 * │  handler. `server/data-plane/session.ts` picks a resolver ONCE, at boot, and  │
 * │  reaches this module through a DYNAMIC import that only executes when the     │
 * │  flag is exactly `1`. Two consequences follow, and both are properties        │
 * │  rather than intentions:                                                      │
 * │                                                                              │
 * │    · A plane started without the flag never LOADS this file. There is no      │
 * │      accepting code path in the process to reach, bypass or mis-review, and   │
 * │      no later mutation of `process.env` can conjure one — which is exactly     │
 * │      what `tests/http/data-plane-http.test.ts` assertion 5 pins when it        │
 * │      starts a second plane with the flag absent and keeps the first one        │
 * │      running.                                                                 │
 * │    · `server/data-plane/**` contains no static `import … from '../dev/…'`    │
 * │      AT ALL — not for this module and not for the fixture seeder either —     │
 * │      so any bundler, tree-shake or container build that starts from           │
 * │      `server/data-plane/main.ts` cannot pull this file in. Reproduce:         │
 * │      `grep -rn "from '\.\./dev/" server/data-plane/` returns nothing.          │
 * │                                                                              │
 * │      VERIFIED BY LOADING, not by reading. A `module.register()` hook that     │
 * │      logs every resolved URL shows `server/dev/test-token.ts` present when    │
 * │      the plane boots with the flag and ABSENT when it boots without it.       │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE TOKEN IS THE SESSION. Invariant 1 — "tenant scope is derived from the
 * session, never read from a request" — is satisfiable by a token that CARRIES a
 * tenant only if the token IS the session: signed by the server's key, verified
 * server-side, and unforgeable by the caller. The tenant is read from the
 * VERIFIED payload and from nowhere else. A header or query parameter naming a
 * tenant is the direct inversion and is refused by the querystring schema.
 *
 * ⚠️ THE SIGNING KEY IS A PUBLISHED CONSTANT BY DEFAULT, AND THAT IS DELIBERATE.
 * A secret default would suggest the KEY is the security boundary. It is not:
 * the FLAG is. `RECONCILE_LOCAL_TEST_AUTH` is absent from the image, absent from
 * any task definition, and its absence is a thing an auditor can read. A key
 * that looks secret invites someone to treat "we rotated it" as a control.
 * Override it with `RECONCILE_LOCAL_TEST_SECRET` if you want per-machine tokens;
 * it changes nothing about what is enforced.
 *
 * 🛑 AND THAT ARGUMENT HAS A SECOND HALF THAT WAS MISSING UNTIL 16 Aug 2026,
 * WITH A LIVE CONSEQUENCE. "The key is not the boundary" is only survivable
 * while the flag-on process is not REACHABLE by whoever holds the key. It was:
 * `compose.yaml` published both planes on every host interface, so anybody who
 * could route a packet to the machine could mint a token for any tenant and read
 * that tenant's rows — verified live. The compose file now binds every published
 * port to `127.0.0.1`, and `tests/http/local-stack-exposure.test.ts` fails if a
 * service carrying this flag ever publishes beyond loopback. Two fences, and the
 * paragraph above is honest only with both of them standing.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

/** Bumped if the payload shape changes, so an old token fails closed rather than half-parsing. */
const VERSION = 'rtt1'

/** Short-lived, and short means minutes. Ruling 2 says short-lived; five is enough to paste one. */
export const DEFAULT_TTL_SECONDS = 300

/**
 * 🛑 THE CEILING, AND IT IS ENFORCED WHERE THE TOKEN IS CONSUMED RATHER THAN
 * WHERE IT IS ISSUED.
 *
 * ⚠️ THIS WAS A NUMBER IN THE MINTER AND NOTHING IN THE VERIFIER UNTIL
 * 16 Aug 2026. An adversarial read minted a token with `ttlSeconds` of one
 * hundred years and was served: `verifyTestToken()` checked `exp > now` and read
 * `iat` not at all, so nothing bounded the distance between them. Ruling 2 says
 * "a script mints a SHORT-LIVED token" — and a property enforced only in the
 * minter is a property enforced only in the half an attacker does not run.
 * Anyone holding the key writes their own minter in four lines;
 * `tests/http/test-token.test.ts` IS those four lines, and it asserts the
 * refusal against payloads it signs itself.
 *
 * One hour rather than five minutes: the DEFAULT stays at five, and the ceiling
 * has to leave room for `--ttl 900` on a long browser session without becoming
 * the sort of bound somebody raises the first time it bites.
 */
export const MAX_TTL_SECONDS = 3600

/**
 * How far ahead of us a token's `iat` may sit before it is a forgery rather than
 * a clock.
 *
 * A future `iat` is the arithmetic bypass of the ceiling above — `exp - iat`
 * stays inside the bound while the usable window is arbitrarily long — so it has
 * to be refused. Refusing it at zero skew, though, locks out a container whose
 * clock is a second ahead of its host, and a control that fails while the
 * property holds is a control people switch off.
 */
const MAX_CLOCK_SKEW_SECONDS = 60

/**
 * 🛑 G97's MINT-TIME RULE, GIVEN THE FIRST EXECUTABLE FORM IT HAS EVER HAD ON A
 * REQUEST PATH.
 *
 * G97: "the database enforces no id format, so preventing `ten_acme` versus
 * `ten_ACME` is a mint-time rule in `model/`, not a column constraint." There was
 * no mint-time enforcement point on this path at all — an adversarial read
 * confirmed on 16 Aug 2026 that `' ten_acme'`, `'ten_acme '`, `'*'`, `'%'` and a
 * five-thousand-character id were all accepted, reached `withTenantScope()` and
 * became the RLS predicate.
 *
 * ⚠️ WHAT THIS BUYS AND WHAT IT DOES NOT, STATED SO NOBODY READS IT AS MORE.
 * It buys SHAPE: a tenant id that cannot be confused with another by case, by
 * whitespace or by a wildcard, and cannot be a payload. It does NOT buy
 * EXISTENCE: `ten_nonexistent` is well-formed and is served an empty page, which
 * is RLS working. Resolving the session's tenant against the `tenant` table
 * belongs with the first WRITE path, where `WITH CHECK` would otherwise accept a
 * row for a tenant that is not there. That is recorded as open rather than done.
 */
const TENANT_ID = /^ten_[a-z0-9](?:[a-z0-9_]{0,60})$/

const PUBLISHED_DEV_KEY = 'reconcile-local-test-token-key/not-a-secret'

function signingKey(): Buffer {
  const override = process.env['RECONCILE_LOCAL_TEST_SECRET']
  return Buffer.from(override === undefined || override === '' ? PUBLISHED_DEV_KEY : override, 'utf8')
}

function sign(body: string): string {
  return createHmac('sha256', signingKey()).update(body).digest('base64url')
}

export interface TestSession {
  readonly tenantId: string
  readonly expiresAt: number
}

interface TokenPayload {
  readonly tenantId: string
  readonly iat: number
  readonly exp: number
}

/**
 * Mint a token for `tenantId`.
 *
 * ⚠️ MINTING IS ALWAYS ALLOWED AND ONLY ACCEPTANCE IS GATED. A minter that
 * checked the flag would make the flag untestable: the assertion that matters is
 * that a PERFECTLY VALID, CORRECTLY SIGNED token is refused, and a test that
 * could not obtain one would be asserting that a broken token is refused, which
 * is a different and much weaker claim.
 */
export function mintTestToken(opts: { tenantId: string; ttlSeconds?: number }): string {
  const tenantId = opts.tenantId
  if (typeof tenantId !== 'string' || !TENANT_ID.test(tenantId)) {
    throw new Error(
      `mintTestToken() was given ${JSON.stringify(tenantId)}, which is not a tenant slug. ` +
        `G97 stores the slug verbatim and it must match ${String(TENANT_ID)} — lower case, ` +
        'no whitespace, no wildcard. The VERIFIER refuses the same set; this throw exists so ' +
        'the refusal happens where a person can read it rather than as a silent 401.',
    )
  }
  const ttl = opts.ttlSeconds ?? DEFAULT_TTL_SECONDS
  if (!Number.isFinite(ttl) || ttl <= 0) throw new Error('mintTestToken() needs a positive ttlSeconds')
  if (ttl > MAX_TTL_SECONDS) {
    throw new Error(
      `mintTestToken() was asked for ${ttl}s and the verifier refuses anything over ` +
        `${MAX_TTL_SECONDS}s. Minting it would hand a developer a credential that ` +
        'silently does not work.',
    )
  }

  const now = Math.floor(Date.now() / 1000)
  const payload: TokenPayload = { tenantId, iat: now, exp: now + Math.floor(ttl) }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const body = `${VERSION}.${encoded}`
  return `${body}.${sign(body)}`
}

/**
 * Verify a token, or return `null`.
 *
 * 🛑 EVERY FAILURE IS THE SAME `null`. Malformed, wrong version, bad signature,
 * expired, missing tenant — one return value, so no caller can accidentally
 * treat one class as recoverable, and no attacker can tell the classes apart
 * from the outside. The one `try` wraps everything for the same reason: an
 * unexpected throw inside verification is a refusal, never a fall-through.
 */
export function verifyTestToken(token: string): TestSession | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [version, encoded, signature] = parts as [string, string, string]
    if (version !== VERSION) return null

    const expected = Buffer.from(sign(`${version}.${encoded}`), 'utf8')
    const given = Buffer.from(signature, 'utf8')
    // `timingSafeEqual` throws on a length mismatch, which would itself be a
    // length oracle if it escaped; the guard makes an unequal length an
    // ordinary refusal.
    if (expected.length !== given.length) return null
    if (!timingSafeEqual(expected, given)) return null

    const parsed: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
    const payload = parsed as { [k: string]: unknown }

    const tenantId = payload['tenantId']
    const iat = payload['iat']
    const exp = payload['exp']

    /**
     * ⚠️ THE SHAPE OF THE TENANT IS CHECKED HERE AND NOT ONLY IN THE MINTER.
     * This is the last seam before the value becomes `app.tenant_id` and then an
     * RLS predicate; the minter is a convenience the attacker replaces.
     */
    if (typeof tenantId !== 'string' || !TENANT_ID.test(tenantId)) return null

    if (typeof exp !== 'number' || !Number.isFinite(exp)) return null

    /**
     * `iat` IS REQUIRED, AND ITS ABSENCE IS THE ONE-CHARACTER BYPASS OF THE LINE
     * BELOW IT. With no issue time there is no `exp - iat` to bound, so a
     * verifier that read `iat` only when present would enforce the ceiling on
     * exactly the tokens that carried one.
     */
    if (typeof iat !== 'number' || !Number.isFinite(iat)) return null

    const now = Math.floor(Date.now() / 1000)
    if (exp <= now) return null
    if (iat > now + MAX_CLOCK_SKEW_SECONDS) return null
    if (exp - iat > MAX_TTL_SECONDS) return null

    return { tenantId, expiresAt: exp }
  } catch {
    return null
  }
}
