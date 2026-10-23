/**
 * THE VERIFICATION TERMS RESOLVER — W3/S4, R2, G2135–G2139, 25 Sep 2026.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 NOBODY CAN SIGN IN AFTER THIS FILE LANDS, AND THAT IS THE CORRECT STATE.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `completeFederatedSignIn` is **MOUNTED NOWHERE** and mounting it is not this
 * slice's to do: `docs/build/completion-plan.md` §5 W3 puts it at S6 behind
 * **R1, the D6 threat model, which is an OPEN OWNER'S RULING**. These would be
 * the product's first public unauthenticated *credential-minting* endpoints,
 * and a slice that mounted them would be taking that ruling by writing code.
 * **The served set is unchanged by this slice.** So what this module produces
 * is consumed by `tests/` and by nothing else — `run-worker.ts`'s shape, said
 * in the same capitals for the same reason.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * R2, THE OWNER'S RULING OF 25 Sep 2026
 * ══════════════════════════════════════════════════════════════════════════
 *
 *     "The JWKS is fetched ONCE AT BOOT and cached in memory. No runtime
 *      egress."
 *
 * `token-verify.ts` §0 states the gap this closes in its own voice: *"IT DOES
 * NOT FETCH THE JWKS … The key document arrives as an ARGUMENT … Where the
 * JWKS comes from — cached how, refreshed when, over whose egress — is the NEXT
 * slice and an owner's decision."* **This is that slice, and the answer is:
 * once, at boot, over the data plane's own egress, held in a value.**
 *
 * 🛑 **THE CACHE IS A VALUE AND NOT A MODULE VARIABLE, AND THAT IS WHAT MAKES
 * *"A ROTATION NEEDS A RESTART"* STRUCTURAL RATHER THAN A COMMENT.** There is
 * no `let` in this file, no map, no expiry and no invalidation hook. A
 * `VerificationTermsSource` is produced by `loadVerificationTerms()`, held by
 * whatever called it, and read by `verificationTermsAt()`; **the only way to
 * obtain a newer key document is to call the loader again, and the only caller
 * is boot.** That is `run-queue.ts`'s `resolveRunQueuePublisher()` shape —
 * decided once, handed to the process — and it is taken here for a second
 * reason that shape did not need: a module-level cache would give somebody a
 * `refreshVerificationTerms()` to export, and the first caller of that is a
 * request path, which is exactly the runtime egress R2 forbids.
 *
 * ⚠️ **THE TWO COSTS ARE ARGUED ON `jwks-source.ts` AND ARE NOT RESTATED
 * HERE** — a rotation needs a restart, and a broker outage is a failed deploy
 * rather than a degraded service. **What belongs to THIS file is the second
 * half of the second one: failing LOUDLY.** `describeJwksRefusal()` is the
 * message, it names the URL that was unreachable and the arm that refused, and
 * `main.ts` throws it before the plane listens. A plane that booted with no
 * keys and met it on the first sign-in would report `token_key_not_found` —
 * which means *a rotation* to every operator who has read that arm — and would
 * have converted a chosen failure into a hidden one.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 THE ORDER IS NOT FREE TO CHANGE, AND IT IS `token-verify.ts` §0a's
 * ══════════════════════════════════════════════════════════════════════════
 *
 * *"The algorithm is OURS. It is never the token's."* `header.alg` is compared
 * against a constant **before a key is selected**, so `alg: none` and an HS256
 * forgery keyed with the broker's own published RSA public key both leave
 * before a byte is verified.
 *
 * **NOTHING IN THIS MODULE SELECTS A KEY.** It hands `verifyIdentityToken()` a
 * whole document and that function does the selection, after the algorithm
 * check, in the order its header fixes. A resolver that picked the entry
 * matching the token's `kid` — the obvious shape, and the one a caller will
 * eventually ask for "so the verifier does less work" — would move key
 * selection AHEAD of the algorithm comparison and undo §0a from the outside,
 * with `token-verify.ts` unchanged and every one of its tests still green.
 * **`_TermsCarryTheWholeDocument` below makes that a compile error**, and the
 * reason is written here rather than left to a reviewer who has read one file.
 *
 * ⚠️ AND THE KEY SIDE IS `token-verify.ts`'s TOO: only `kty`, `n` and `e` reach
 * `createPublicKey()` and `kty` must be `RSA`, *"a key document that named
 * itself `oct` under the right `kid` would otherwise be imported as a SECRET"*.
 * This module re-checks none of it (§5.3).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 THE TOKEN↔ATTEMPT BINDING IS *NOT* CLOSED BY VERIFYING A TOKEN
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `docs/build/d6-threat-model.md` §4.3 measures the attack with the least
 * defence and the most confusing-looking defence, and the sentence to carry is
 * that `challengeDigest` *"compares two values the SAME caller supplied"*.
 * Verification proves a token is OURS; it does not prove the token was issued
 * **for this attempt**. The claim that would prove it is the ID token's
 * `nonce`, and `token-verify.ts` contained that string **zero times**.
 *
 * ✅ **THIS SLICE CLOSES IT, IN TWO HALVES, NEITHER OF WHICH IS HERE.**
 * `VerifiedClaims` gains `nonce` — READ and not checked, exactly as `iat` is,
 * because a verifier does not know what a nonce should be — and
 * `code-exchange.ts`'s `bindTokenToAttempt()` is the comparison, against the
 * digest the REDIRECT pinned. **This module is the reason the first half is
 * possible and is not itself either half**, which is said out loud so that
 * nobody reads *"the terms resolver landed"* as *"the binding is made"*.
 */

/**
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 R2 IS AMENDED — THE OWNER'S RULING OF 1 Oct 2026, G2571. R2's TEXT IS
 *    KEPT ABOVE, UNCHANGED, BECAUSE IT IS STILL HALF THE RULE.
 * ══════════════════════════════════════════════════════════════════════════
 *
 *     "Per-connection, boot-time: fetch every registered connection's JWKS
 *      at boot and cache by connection; audience becomes a column. Still no
 *      runtime JWKS egress; a new connection needs a restart."
 *
 * G2498 recorded the gap in its own voice: *"the issuer is per door but the
 * key document and audience are per deployment"* — D6-5 moved the issuer onto
 * the pinned row, R2 still loaded ONE document from ONE URL, so a door on a
 * second pool pinned the right issuer and could not verify, because its keys
 * were not in the document. **This is R2 re-opened by its owner, and what it
 * changes is the GRAIN, not the TIME**: still once, still at boot, still held
 * in a value; now one document per brokered door, keyed by that door's id.
 *
 * ⚠️ **THE HEADER ABOVE SAYS *"There is no `let` in this file, no map"* AND
 * THE SECOND CLAUSE IS NOW FALSE AND IS CORRECTED RATHER THAN DELETED.** There
 * IS a map — `VerificationTermsSource.connections` — and it lives INSIDE the
 * value boot produces, so every property that sentence was protecting
 * survives: no module variable, no expiry, no invalidation hook, no
 * `refresh…()` to export. **The only way to obtain a newer key document, or
 * the key document of a door registered after boot, is to call the loader
 * again, and the only caller is boot** — which is the ruling's *"a new
 * connection needs a restart"* made structural rather than stated.
 *
 * ⚠️ **AND THE HEADER'S *"`describeJwksRefusal()` is the message … and
 * `main.ts` throws it before the plane listens"* IS NOW FALSE TWICE, AND IS
 * CORRECTED RATHER THAN DELETED (G2574).** The message is
 * `describeConnectionTermsRefusal()`, per door, and `main.ts` PRINTS it and
 * listens: one door's unreachable broker marks that door unverifiable by
 * name rather than refusing the boot, because under G276's BYOA a pool may be
 * a customer's and a fail-the-boot rule hands every customer's identity
 * provider a veto over the whole plane. `loadVerificationTerms()` argues it.
 *
 * ⚠️ **AND THE TWO ENVIRONMENT VARIABLES THAT NAMED ONE DOCUMENT AND ONE
 * AUDIENCE ARE RETIRED (G2572)** — `RECONCILE_IDENTITY_JWKS_URL` and
 * `RECONCILE_IDENTITY_AUDIENCE` — on G2231's precedent for the issuer: a
 * per-deployment value under G276's BYOA is one pool per deployment. They are
 * ignored rather than refused, and nothing in `infra/` or `compose.yaml` ever
 * set either. The two TOLERANCES stay in the environment, because they are
 * facts about this deployment's patience and clock, not about any door.
 */

import { SUGGESTED_CLOCK_SKEW_SECONDS } from './token-verify.ts'
import type { JwksDocument, TokenVerificationTerms } from './token-verify.ts'
import type { JwksFetchRefusal } from './jwks-source.ts'
import type { IdentityConnection, IdentityConnectionId } from '../../model/domain.ts'
import type { AssertNoTextDeep } from '../../model/reconciliation.ts'
import type { ScopedClient } from '../../db/tenant-scope.ts'

type Assert<T extends true> = T

/* ==================================================================== *
 * §1  WHAT A DEPLOYMENT STATES — TWO TOLERANCES, AND NOTHING ABOUT A DOOR
 * ==================================================================== */

/**
 * The TWO variables, named once.
 *
 * ⛔ **THIS SAID *"The FOUR variables"* AND CARRIED `audience:
 * 'RECONCILE_IDENTITY_AUDIENCE'` AND `jwksUrl: 'RECONCILE_IDENTITY_JWKS_URL'`
 * UNTIL 1 Oct 2026 — G2572.** Both moved onto `tenant.identity_connection`
 * (`db/migrations/0300_connection_key_document.sql`), for the reason the
 * retired issuer did before them: one value per environment is one pool per
 * environment. ⛔ **AND BEFORE THAT IT SAID *"The five variables"* AND
 * CARRIED `issuer: 'RECONCILE_IDENTITY_ISSUER'` — D6-5, G2231.**
 *
 * ⚠️ THE PREFIX IS `RECONCILE_IDENTITY_` AND NOT `RECONCILE_COGNITO_`. G302
 * makes Cognito the broker today and `model/domain.ts`'s `PROTOCOL_IS_BROKERED`
 * says in its own voice that a direct, unbrokered path *"is the line that has
 * to change"* — a variable named for one vendor is a variable somebody has to
 * rename on the day that line moves.
 */
export const IDENTITY_TERMS_ENV = {
  clockSkewSeconds: 'RECONCILE_IDENTITY_CLOCK_SKEW_SECONDS',
  jwksTimeoutMs: 'RECONCILE_IDENTITY_JWKS_TIMEOUT_MS',
} as const

/**
 * How long boot waits for ONE door's key document before marking that door
 * unverifiable.
 *
 * ⚠️ IT IS DEFAULTED AND `platformSessionBounds()` REFUSES TO DEFAULT, AND THE
 * DIFFERENCE IS THE FAILURE DIRECTION RATHER THAN A CHANGE OF HEART. A session
 * bound that is wrong produces a credential that lives longer than anybody
 * chose — it fails OPEN. A timeout that is too short leaves a door
 * unverifiable; a skew that is too small expires a token early. **Both fail
 * CLOSED when wrong.**
 */
export const DEFAULT_JWKS_TIMEOUT_MS = 5_000

/** What a deployment states about verification that is not a fact about a door. */
export interface IdentityTolerances {
  /** Tolerance on `exp` and `nbf`. */
  readonly clockSkewSeconds: number
  /** The boot-time patience, per door. */
  readonly jwksTimeoutMs: number
}

function positiveIntFromEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const parsed = Number(raw)
  /* A mistyped tolerance falls back to the stated default rather than to
   * something permissive. See `DEFAULT_JWKS_TIMEOUT_MS`. */
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * The deployment's two tolerances. Always an answer.
 *
 * ⛔ **THIS WAS `identityTermsTarget()` UNTIL 1 Oct 2026, AND IT ANSWERED
 * `null` WHEN A DEPLOYMENT HAD STATED NO AUDIENCE OR NO KEY-SET URL — G2572.**
 * `null` was what kept every local plane from loading the transport. **That
 * job moved to the INVENTORY**: a plane whose database registers no brokered
 * door with a declared key document never imports `jwks-source.ts`
 * (`loadVerificationTerms()`, below), which is the same fence keyed on the
 * property — *is there a document to fetch* — rather than on two variables.
 */
export function identityTolerances(): IdentityTolerances {
  return {
    /* Stated out loud at the call site, using the constant `token-verify.ts`
     * exports for exactly this. */
    clockSkewSeconds: positiveIntFromEnv(
      IDENTITY_TERMS_ENV.clockSkewSeconds,
      SUGGESTED_CLOCK_SKEW_SECONDS,
    ),
    jwksTimeoutMs: positiveIntFromEnv(IDENTITY_TERMS_ENV.jwksTimeoutMs, DEFAULT_JWKS_TIMEOUT_MS),
  }
}

/* ==================================================================== *
 * §1a  WHAT THE DATABASE STATES — THE KEY INVENTORY (G2573)
 * ==================================================================== */

/**
 * One brokered door's verification terms, as the migrator wrote them.
 *
 * ⚠️ **BOTH NULLABLE, AND NULL IS A NAMED REFUSAL, NEVER A DEFAULT** — `0280`'s
 * rule for `token_endpoint`, carried one column over. A door registered before
 * its pool's client exists has neither, and the only defaults available are a
 * per-environment value (G2572's refusal) or the token's own `aud` (the
 * token choosing what verifies it, which D6-5 refuses for `iss`).
 */
export interface ConnectionKeyTarget {
  readonly connectionId: IdentityConnectionId
  readonly jwksUri: string | null
  readonly audience: string | null
}

/**
 * NO `WHERE`, AS FOR EVERY READ IN THIS PLANE: `0300`'s
 * `identity_connection_key_inventory_rls` is the whole narrowing — brokered
 * doors only, and only inside `withKeyInventoryScope()`. ⚠️ **AND IT NAMES
 * THREE COLUMNS ON PURPOSE**: the policy admits whole rows, so this list is
 * the only thing between the boot read and a door's label and owner. A
 * `SELECT *` here would be a cross-tenant read of directory configuration
 * with the gate EXIT 0; `tests/db/connection-key-inventory.test.ts` §4 reads
 * this constant and refuses any other column.
 */
export const KEY_INVENTORY_READ =
  'SELECT id, jwks_uri, audience FROM tenant.identity_connection ORDER BY id'

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

/** Read every brokered door's terms. Called inside `withKeyInventoryScope()` and nowhere else. */
export async function readConnectionKeyInventory(
  tx: ScopedClient,
): Promise<readonly ConnectionKeyTarget[]> {
  const rows = (await tx.query(KEY_INVENTORY_READ)).rows as Array<Record<string, unknown>>
  return rows.map((row) => ({
    connectionId: String(row['id']) as IdentityConnectionId,
    jwksUri: nonEmpty(row['jwks_uri']),
    audience: nonEmpty(row['audience']),
  }))
}

/* ==================================================================== *
 * §2  WHAT BOOT PRODUCES
 * ==================================================================== */

/**
 * Why a door cannot verify a token. **Four arms, each a different action for
 * an operator**, and none of them is `token_key_not_found` — which is the
 * whole point: G2133 recorded that a missing key document reported as that
 * arm *"means a rotation"* to anybody who has read it.
 */
export type ConnectionTermsRefusal =
  /** The row carries no key-set URL. A migrator owes one. */
  | { readonly kind: 'connection_jwks_uri_undeclared' }
  /** The row carries no audience. A migrator owes one. */
  | { readonly kind: 'connection_audience_undeclared' }
  /** The URL was declared and boot could not obtain a key set from it. */
  | { readonly kind: 'connection_key_document_unavailable'; readonly jwks: JwksFetchRefusal }
  /**
   * The pinned door is not in this process's inventory at all — registered
   * after boot, or not brokered when boot read. **"A new connection needs a
   * restart"** is the ruling's own cost, and this arm is that cost answered by
   * name rather than by a runtime fetch.
   */
  | { readonly kind: 'connection_not_loaded_at_boot' }

/** The containment proof: kinds and a nested refusal, never a value. */
export type _ConnectionTermsRefusalHoldsNoText = AssertNoTextDeep<ConnectionTermsRefusal>

export const CONNECTION_TERMS_REFUSALS = [
  'connection_jwks_uri_undeclared',
  'connection_audience_undeclared',
  'connection_key_document_unavailable',
  'connection_not_loaded_at_boot',
] as const

/** Both directions. A fifth arm with no roster entry fails to compile here. */
export type _EveryConnectionTermsRefusalIsListed = Assert<
  (typeof CONNECTION_TERMS_REFUSALS)[number] extends ConnectionTermsRefusal['kind']
    ? ConnectionTermsRefusal['kind'] extends (typeof CONNECTION_TERMS_REFUSALS)[number]
      ? true
      : false
    : false
>

/** The construction site, so the proof BITES rather than merely compiling. */
export const CONNECTION_TERMS_ROSTER_IS_TOTAL: _EveryConnectionTermsRefusalIsListed = true

/**
 * One door's terms. 🛑 `jwks` IS THE WHOLE DOCUMENT AND NEVER A SELECTED KEY
 * — see the header's §0a paragraph and `_TermsCarryTheWholeDocument` below.
 */
export interface ConnectionVerificationTerms {
  /** The `aud` a token must carry, and the `client_id` the exchange presents. */
  readonly audience: string
  readonly jwks: JwksDocument
}

/** Loaded, or refused by name. */
export type ConnectionTermsLoad =
  | { readonly ok: true; readonly terms: ConnectionVerificationTerms }
  | { readonly ok: false; readonly refusal: ConnectionTermsRefusal }

/**
 * The terms this process was born with. **The cache, and it is a value.**
 *
 * ⚠️ **`connections` IS KEYED BY THE DOOR'S OWN ID AND BY NOTHING A TOKEN
 * CARRIES.** Not `iss`, not `kid`, not `aud`: the request path looks a door
 * up by the id of the row the redirect PINNED (`verificationTermsAt()`), so a
 * pool-B token presented at a door-A sign-in is checked against door A's keys
 * and door A's audience — and fails there, by name.
 *
 * ⚠️ `loadedAt` IS CARRIED AND IS READ BY NOTHING THAT DECIDES ANYTHING. It is
 * for the boot line. **It must not become an expiry**: comparing it against a
 * clock is the refresh R2 forbids, arriving as a staleness check.
 */
export interface VerificationTermsSource {
  /* ⛔ `issuer` WAS A FIELD HERE UNTIL 1 Oct 2026 — D6-5. ⛔ `audience` AND
   * `jwks` WERE FIELDS HERE UNTIL 1 Oct 2026 TOO — G2571; both are per door
   * now, inside `connections`. */
  readonly connections: ReadonlyMap<IdentityConnectionId, ConnectionTermsLoad>
  readonly clockSkewSeconds: number
  readonly loadedAt: Date
}

/**
 * THE KEY DOCUMENT REACHES THE VERIFIER WHOLE.
 *
 * VERIFIED RED (R2's slice): narrowing the document to a single
 * `JsonWebKeyEntry` — the "resolve the `kid` here so the verifier does less
 * work" shape — fails here with `TS2344`. ⚠️ The subject moved from
 * `VerificationTermsSource['jwks']` to the per-door terms on 1 Oct 2026; the
 * assertion did not change.
 */
export type _TermsCarryTheWholeDocument = Assert<
  ConnectionVerificationTerms['jwks'] extends TokenVerificationTerms['jwks'] ? true : false
>

/**
 * Obtain every brokered door's key document ONCE and pair each with that
 * door's audience.
 *
 * 🛑 **ONE UNREACHABLE DOOR DOES NOT REFUSE THE BOOT — G2574, DERIVED, AND
 * IT REVERSES THE DIRECTION G2133 TOOK FOR ONE DOCUMENT.** Under R2 there was
 * one broker, it was OURS, and a plane that could not reach it could verify
 * nothing: refusing to boot was the only honest answer. Under per-door
 * documents and G276's BYOA a pool may sit in a CUSTOMER's account, and a
 * fail-the-boot rule would hand every customer's identity provider a veto over
 * the whole multi-tenant plane — one tenant's outage becoming every tenant's
 * failed deploy. **That is a cross-tenant availability coupling, and nothing
 * in R2 chose it.** So the door is marked UNVERIFIABLE BY NAME and the plane
 * serves every other door.
 *
 * ⚠️ **THE FAIL-CLOSED DIRECTION IS KEPT WHERE IT WAS LOAD-BEARING: AT THE
 * DOOR.** No token through an unverifiable door verifies, and it is refused
 * `connection_key_document_unavailable` — never `token_key_not_found`, which
 * is G2133's misdiagnosis hazard and the reason that row demanded loudness.
 * Loudness is kept too: `describeConnectionTermsRefusal()` names the door, the
 * URL and the arm, and `main.ts` prints one line per unverifiable door before
 * it listens. **What still refuses the boot is the inventory READ** — a plane
 * that cannot ask its own database which doors exist knows nothing.
 *
 * ⚠️ **THE IMPORT IS DYNAMIC AND IS REACHED ONLY WHEN SOME DOOR HAS A
 * DOCUMENT TO FETCH** — G1201's device, G2132's fence. A plane whose
 * inventory declares no key-set URL (every local plane, and `compose.yaml`)
 * never loads `jwks-source.ts` and holds no outbound client at all.
 * 🛑 **DO NOT DERIVE THAT WITH A `grep` FOR THE PATH — G2134.** The control is
 * `tests/http/console-roster-unreachable.test.ts` §1c, which strips comments.
 *
 * ⚠️ **THE FETCHES RUN CONCURRENTLY**, so boot waits about one timeout at
 * worst rather than one per door. Each is the same bounded GET to a URL the
 * migrator wrote; none is a request path.
 */
export async function loadVerificationTerms(
  tolerances: IdentityTolerances,
  inventory: readonly ConnectionKeyTarget[],
): Promise<VerificationTermsSource> {
  const connections = new Map<IdentityConnectionId, ConnectionTermsLoad>()
  const fetchable: Array<{
    readonly connectionId: IdentityConnectionId
    readonly url: string
    readonly audience: string
  }> = []
  for (const door of inventory) {
    if (door.jwksUri === null) {
      connections.set(door.connectionId, {
        ok: false,
        refusal: { kind: 'connection_jwks_uri_undeclared' },
      })
    } else if (door.audience === null) {
      /* No document is fetched for a door that could verify nothing with it:
       * an audience-less door is unverifiable either way, and a fetch would
       * be egress bought for no decision. */
      connections.set(door.connectionId, {
        ok: false,
        refusal: { kind: 'connection_audience_undeclared' },
      })
    } else {
      fetchable.push({ connectionId: door.connectionId, url: door.jwksUri, audience: door.audience })
    }
  }

  if (fetchable.length > 0) {
    const { fetchJwksDocument } = await import('./jwks-source.ts')
    const outcomes = await Promise.all(
      fetchable.map((door) => fetchJwksDocument({ url: door.url, timeoutMs: tolerances.jwksTimeoutMs })),
    )
    fetchable.forEach((door, i) => {
      const obtained = outcomes[i]
      if (obtained === undefined) return
      connections.set(
        door.connectionId,
        obtained.ok
          ? { ok: true, terms: { audience: door.audience, jwks: obtained.document } }
          : {
              ok: false,
              refusal: { kind: 'connection_key_document_unavailable', jwks: obtained.refusal },
            },
      )
    })
  }

  return { connections, clockSkewSeconds: tolerances.clockSkewSeconds, loadedAt: new Date() }
}

/* ==================================================================== *
 * §2a  THE ISSUER — FROM THE PINNED ROW, NEVER FROM THE TOKEN (D6-5)
 * ==================================================================== */

declare const PINNED_ISSUER: unique symbol

/**
 * The `iss` a token must carry, read off the `identity_connection` row the
 * redirect PINNED — D6-5, the owner's ruling of 29–30 Sep 2026, G2231–G2235.
 *
 * 🛑 **THE TOKEN'S OWN `iss` IS COMPARED AGAINST THIS AND NEVER SELECTS IT.**
 * The refused alternative is the one that looks standard: validate the
 * token's `iss` against an ALLOWLIST of known brokers. That lets the TOKEN
 * take part in choosing what verifies it — the shape `token-verify.ts`
 * already refuses for `alg` (*"The algorithm is OURS. It is never the
 * token's."*) — and it is exactly where D6's IdP mix-up attack lives: a token
 * minted by pool B satisfies an allowlist naming A and B, against a sign-in
 * the platform sent to A. **Under this brand the expected issuer is a fact
 * about OUR row, decided before the token is opened**, which is
 * `orgClass`'s `orgFor(connection.owner)` rule one field over.
 *
 * ⚠️ **A BRAND IS NOT A PROOF AND IS NOT CLAIMED AS ONE.** `string & {…}`
 * cannot stop a caller casting; what it does is make the ONE legitimate
 * construction an explicit, greppable call — `pinnedBrokerIssuer()` below —
 * and turn every other route to a `PinnedVerificationTerms` into a `TS2322`.
 * The production claim is held by `tests/http/pinned-issuer.test.ts` §3,
 * which requires that call to appear exactly ONCE in `server/`, in
 * `signin.ts`, against the door `assembleSignIn()` has already proved is the
 * pinned one (G344) — the single-call-site shape invariant 10's minting mark
 * takes in `server/http/app.ts` (G301). ⚠️ That mark is deliberately NOT
 * named here: `tests/http/authorisation-record.test.ts` §2c counts every file
 * under `server/` that spells it, and a comment would be a third.
 */
export type PinnedBrokerIssuer = string & { readonly [PINNED_ISSUER]: true }

/**
 * The issuer of a pinned door, or `null` for a door no broker fronts.
 *
 * It takes the ROW and reads `federation.brokerIssuer` verbatim — never
 * parsed, never normalised (`BrokeredConnection`'s own rule: *"Stored
 * verbatim; never parsed for a region, an account or a pool id"*). It takes
 * no string, deliberately: a function that accepted a bare issuer would be
 * the token's `iss` laundered through a brand.
 */
export function pinnedBrokerIssuer(
  door: Pick<IdentityConnection, 'federation'>,
): PinnedBrokerIssuer | null {
  if (door.federation === null) return null
  return door.federation.brokerIssuer as PinnedBrokerIssuer
}

/**
 * The terms a sign-in is verified against: the verifier's own terms, with an
 * issuer that can only have come from a pinned row.
 *
 * `token-verify.ts` is unchanged and still takes `issuer: string` — it is a
 * verifier, it compares, and it does not know where its terms came from. The
 * narrowing is HERE, at the one seam a sign-in reaches it through, and
 * `completeCodeExchange()` accepts nothing wider.
 */
export type PinnedVerificationTerms = TokenVerificationTerms & {
  readonly issuer: PinnedBrokerIssuer
}


/* ==================================================================== *
 * §3  WHAT A REQUEST PATH READS
 * ==================================================================== */

/**
 * The door a sign-in was PINNED to: its id, and its issuer through the one
 * constructor (§2a). Both come off the row `0280`'s pin policy admitted —
 * `readPinnedSignIn()`'s `connection` — and neither off the body or the token.
 */
export interface PinnedDoor {
  readonly connectionId: IdentityConnectionId
  readonly issuer: PinnedBrokerIssuer
}

/** The terms a sign-in is verified against, or the door's refusal by name. */
export type PinnedTermsResolution =
  | { readonly ok: true; readonly terms: PinnedVerificationTerms }
  | { readonly ok: false; readonly refusal: ConnectionTermsRefusal }

/**
 * The boot-time source, the PINNED door and the instant a decision is being
 * taken at.
 *
 * **Pure. No I/O, no environment, no clock, and — deliberately — no ability to
 * obtain a key document.** `jwks-source.ts` is not in this function's import
 * closure at all, only in the loader's, so a request path that calls it
 * cannot reach a transport: *"Still no runtime JWKS egress"* (G2571).
 *
 * 🛑 **KEYS AND AUDIENCE ARE SELECTED BY THE PINNED DOOR, NEVER BY THE TOKEN —
 * G2575, AND IT IS D6-5's RULE APPLIED TO THE TWO TERMS D6-5 LEFT
 * PER-DEPLOYMENT.** The refused shape is the obvious one: look the token's
 * `iss` up in a map of documents. That lets the token choose which keys verify
 * it, and a pool-B token presented at a door-A sign-in would then be checked
 * against pool B's keys — and PASS the signature. Selecting by the pinned id
 * means it is checked against door A's, and fails `token_key_not_found` before
 * the issuer comparison is even reached. `tests/http/per-connection-jwks.test.ts`
 * §2 is that red.
 *
 * ⚠️ `now` IS INJECTED AND THERE IS NO HIDDEN CLOCK — `TokenVerificationTerms`'s
 * own rule carried forward.
 */
export function verificationTermsAt(
  source: VerificationTermsSource,
  door: PinnedDoor,
  now: Date,
): PinnedTermsResolution {
  const loaded = source.connections.get(door.connectionId)
  if (loaded === undefined) {
    return { ok: false, refusal: { kind: 'connection_not_loaded_at_boot' } }
  }
  if (!loaded.ok) return loaded
  return {
    ok: true,
    terms: {
      /* D6-5. From the pinned row, through the one constructor — §2a. */
      issuer: door.issuer,
      /* G2571. From the pinned row's own columns, loaded at boot. ⚠️ Both
       * read a single deployment-wide `source.audience` / `source.jwks`
       * until 1 Oct 2026 — G2498's open gap. */
      audience: loaded.terms.audience,
      jwks: loaded.terms.jwks,
      now,
      clockSkewSeconds: source.clockSkewSeconds,
    },
  }
}

/* ==================================================================== *
 * §4  FAILING LOUDLY
 * ==================================================================== */

function describeFetchRefusal(at: string, refusal: JwksFetchRefusal): string {
  switch (refusal.kind) {
    case 'jwks_unreachable':
      return (
        `the key document at ${at} could not be reached. It is fetched ONCE AT BOOT (R2 as ` +
        'amended, G2571), so a restart once the broker is reachable is the repair. Check the ' +
        "row's `jwks_uri`, egress and DNS."
      )
    case 'jwks_status_not_ok':
      return (
        `the broker answered HTTP ${refusal.status} for its key document at ${at}. A 404 is ` +
        "usually a wrong `jwks_uri` on the row; a 403 is usually a pool or distribution policy."
      )
    case 'jwks_body_unreadable':
      return (
        `the response from ${at} did not decode as a JSON object. The body is deliberately NOT ` +
        'quoted here (G261 §12.1). This is usually a URL that serves an HTML error page with a 200.'
      )
    case 'jwks_not_a_key_set':
      return (
        `the JSON at ${at} carries no \`keys\` array, so it is not a JWKS. Check that the ` +
        'URL is the key set and not the OIDC discovery document, which NAMES the key set at ' +
        '`jwks_uri` and is not one.'
      )
    case 'jwks_key_set_empty':
      return (
        `the key set at ${at} is EMPTY. It is refused rather than cached: an empty key set ` +
        'verifies nothing while looking exactly like a healthy door.'
      )
    default: {
      const unhandled: never = refusal
      return `unhandled key-document refusal ${String(unhandled)}`
    }
  }
}

/**
 * What an operator is told, at boot, about ONE door that cannot verify.
 *
 * 🛑 **TOTAL OVER BOTH UNIONS**, so a new arm in either is a compile error
 * rather than a door that is unverifiable in silence.
 *
 * ⚠️ IT NAMES THE DOOR AND THE URL, AND BOTH ARE OURS — a connection id and a
 * migrator-written configuration value, identifying no person. ⚠️ **THE
 * AUDIENCE IS NOT PRINTED**: it is an OAuth client id, harmless but useless to
 * the operator acting on this line, and G261 §12.1's rule is to log what is
 * needed. Nothing counterparty-authored crosses into this string — no
 * response body is quoted; the only value read off the wire is an integer.
 *
 * ⛔ **THIS WAS `describeJwksRefusal()` AND EVERY MESSAGE OPENED *"REFUSING TO
 * BOOT"* UNTIL 1 Oct 2026 — G2574.** A door's outage no longer refuses the
 * boot, and a message that said it did would be the misdiagnosis G2133 exists
 * to prevent, pointed the other way.
 */
export function describeConnectionTermsRefusal(
  target: ConnectionKeyTarget,
  timeoutMs: number,
  refusal: ConnectionTermsRefusal,
): string {
  const door = `data-plane: DOOR \`${target.connectionId}\` IS UNVERIFIABLE —`
  switch (refusal.kind) {
    case 'connection_jwks_uri_undeclared':
      return (
        `${door} its \`tenant.identity_connection\` row declares no \`jwks_uri\`. The value ` +
        'arrives by migrator (`0300`); no token through this door will verify until one is ' +
        'written and the plane is restarted.'
      )
    case 'connection_audience_undeclared':
      return (
        `${door} its \`tenant.identity_connection\` row declares no \`audience\`. The value ` +
        'arrives by migrator (`0300`); no key document was fetched for it.'
      )
    case 'connection_key_document_unavailable':
      return `${door} ${describeFetchRefusal(
        `\`${target.jwksUri ?? '(none)'}\` (after ${timeoutMs}ms)`,
        refusal.jwks,
      )}`
    case 'connection_not_loaded_at_boot':
      return `${door} it was not in the key inventory this process read at boot. A new connection needs a restart (G2571).`
    default: {
      const unhandled: never = refusal
      return `${door} unhandled refusal ${String(unhandled)}`
    }
  }
}
