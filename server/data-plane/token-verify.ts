/**
 * THE TOKEN VERIFIER — W1-E. **A VERIFIER, AND NOTHING ELSE.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 READ THIS FIRST, BECAUSE A GREP NOW ANSWERS THE OPPOSITE OF WHAT IT MEANS.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Several documents carry one derivation — *"NOTHING VERIFIES A TOKEN, SO
 * NOTHING RESOLVES A PERSON, SO NOTHING MINTS A SESSION"* — and every one of
 * them backs it with the same command:
 *
 *     grep -rn 'jwtVerify\|createRemoteJWKSet' server/
 *
 * **BEFORE THIS FILE THAT COMMAND RETURNED THREE LINES AND ALL THREE WERE
 * PROSE** — `identity.ts`, `session-cookie.ts` and `signin.ts` each QUOTING the
 * command inside a header in order to say that it returns nothing. A reader
 * seeing `3` would have concluded a verifier existed. **The command was never a
 * measurement of this property: it is a measurement of whether two library
 * names appear**, and those two names belong to `jose`, which is not a
 * dependency here and does not become one (G191, and §0 below).
 *
 * ⚠️ **THIS FILE STILL DOES NOT MAKE THAT COMMAND RETURN A VERIFIER**, because
 * it uses neither name: `node:crypto` verifies RS256 from a JWK with no package
 * at all. **It makes the command return FOUR — this very paragraph is the
 * fourth** — which is the defect stated once more, by a file that had to quote
 * it in order to retire it. So the honest derivation is the one below:
 *
 *     grep -rln '^export function verifyIdentityToken' server/   # exactly one
 *
 * 🛑 **THE `^` IS NEW — G2171, 28 Sep 2026 — AND THE UNANCHORED FORM THIS
 * HEADER PRESCRIBED FOR A WEEK WAS THE DEFECT IT WAS MINTED TO CURE, WEARING
 * THE CURE'S NAME.** It is DESCRIBED here rather than spelled, because spelling
 * it inside `server/` is the whole mechanism: this paragraph would become the
 * second line it counts. Six documents quoted it; four of them are outside
 * `server/` and quote it in full at their own correction.
 *
 * 🛑 **AND THE DEFENCE THIS HEADER OFFERED IS WHAT HID IT. IT READ:** *"AND
 * NOTE WHAT IT USES: **`-l`**, so the answer is a FILE and not a LINE. This
 * header quotes that command too, and a line-counting form of it would
 * therefore answer `2` for the same reason the retired one answers `4`."*
 * **Every word of that is true and it is a workaround, not a repair.** The
 * file count is 1 because the quotation and the declaration happen to sit in
 * the SAME FILE — **co-location, not a property** — so the cure dies the moment
 * any other file under `server/` quotes it, which this record's own practice of
 * correcting in place guarantees. It had already happened once: G2134 found two
 * headers claiming *"exactly one line"* for `jwks-source.ts` against an answer
 * of three.
 *
 * 🛑 **AND `-l` IS VACUOUS IN THE DIRECTION THAT MATTERS, WITNESSED RATHER THAN
 * REASONED.** With the declaration below DELETED from a scratch copy of
 * `server/`, the unanchored form answered **`server/data-plane/token-verify.ts`,
 * exit 0** — *exactly one*, the same answer it gives for a tree that has a
 * verifier — because this paragraph is still there. **It reports a verifier for
 * a tree with none.** That is G978's own sentence about the command it retired
 * — *"It would answer `4` if a verifier had never been written"* — arriving at
 * its replacement, unchanged but for the number. The anchored form answers
 * nothing and exits 1 on that same tree, because no sentence writes `export`
 * in the first column.
 *
 * ⚠️ A derivation over a tree that contains its own documentation has to ANCHOR,
 * or count FILES, or strip comments, or be a test. **Counting files was the
 * weakest of the four and is the one that was taken; §11 of
 * `tests/http/token-verify.test.ts` strips comments and is unchanged.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * §0 · THE THREE THINGS THIS FILE DELIBERATELY DOES NOT DO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🛑 **IT DOES NOT FETCH THE JWKS, AND THAT IS A LIVE CONTROL RATHER THAN A
 * CONVENIENCE.** The key document arrives as an ARGUMENT. **Nothing in
 * `server/` makes an outbound HTTP request**, and
 * `tests/http/console-roster-unreachable.test.ts` §1c ASSERTS that emptiness
 * over both plane directories, because an outbound client here *"is a new
 * operation … a new credential posture, and both are rulings."*
 * `db/migrations/0017_usage_record_actor.sql` records the same absence for the
 * usage stream in the same words. **Where the JWKS comes from — cached how,
 * refreshed when, over whose egress — is the NEXT slice and an owner's
 * decision.** Adding an outbound call here would take that decision by writing
 * a line, and it would turn a green suite red on the way past.
 *
 * ⚠️ **THE RECORD'S DERIVATION FOR THAT ABSENCE IS A RECURSIVE GREP FOR THE
 * CALL, AND THIS HEADER DELIBERATELY DOES NOT SPELL THE TOKEN IT SEARCHES
 * FOR.** Quoting a grep inside the tree it greps is the defect the paragraph
 * above opens with, and that defect has cost this file one red assertion
 * already; it is not going to be committed twice in the same header. The
 * command lives in `CLAUDE.md` and in `docs/HANDOFF.md` G977, where it is not
 * inside its own search path, and it still answers ZERO after this slice.
 *
 * 🛑 **IT ADDS NO DEPENDENCY.** G191 pins every dependency exact and taking a
 * new one is a ruling. `node:crypto` imports an RSA public key straight from a
 * JWK — `createPublicKey({ key, format: 'jwk' })` — and `verify()` does
 * RSASSA-PKCS1-v1_5 over SHA-256 with no help. Derive it:
 * `node -e "console.log(require('./package.json').dependencies)"` — and none of
 * what it prints is a JOSE library.
 *
 * 🛑 **IT MINTS NO SESSION AND MOUNTS NO OPERATION.** A verified token is not a
 * signed-in person and must never be mistaken for one. Three separate things
 * still stand between this function and a login, and each is somebody else's:
 *
 *   1. `tenant."user"` carries NO EXTERNAL-SUBJECT COLUMN. G306 refuses a
 *      column ahead of its reader, and the reader is this file — so the column
 *      is now UNBLOCKED and is still NOT WRITTEN. Nothing here writes SQL.
 *   2. `tenant.session.user_id` is `NOT NULL`, and nothing in this repository
 *      creates a session row on a request path.
 *   3. **Even a complete mint would not let a browser sign in.** The contract
 *      says so on `completeFederatedSignIn` itself: *"Whether the handle
 *      arrives as a `Set-Cookie` or as a response body field is a security
 *      decision … It is owed to the D6 threat model, and until it lands this
 *      operation's 200 describes the session and does not deliver the
 *      credential."* `MintedSession` is `SessionView` narrowed — nine keys,
 *      none of them the handle — and `docs/HANDOFF.md` records that ruling as
 *      NOT APPLIED.
 *
 * **So this is the first of several commits, and a reader who finds it must not
 * read it as sign-in.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * §0a · THE ALGORITHM IS OURS. IT IS NEVER THE TOKEN'S.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The classic JWT defeat is a verifier that DISPATCHES on `header.alg`:
 *
 *   · `alg: none` — the token says it is unsigned, and a dispatcher agrees.
 *   · `alg: HS256` — the token says it is symmetric, and a dispatcher reaches
 *     for "the key", which for an RS256 deployment is the PUBLIC key. That key
 *     is published, so anybody at all can mint a token that verifies.
 *
 * 🛑 **THE HEADER'S `alg` IS READ AND COMPARED AND IS NEVER SWITCHED ON.**
 * There is exactly one verification path in this module, it is RS256, and it is
 * fixed by the CONSTANT `REQUIRED_ALGORITHM` before the header is opened. Every
 * other value — `none`, `HS256`, `RS512`, absent, a number — leaves through
 * **one** arm, `token_algorithm_not_allowed`, and leaves BEFORE a key is
 * selected and before a byte is verified.
 *
 * ⚠️ **AND THE OBVIOUS DERIVATION OF THAT — a `grep` for `case '` over this
 * file — RETURNS THIS SENTENCE AND NOT A DISPATCHER**, which is the header's
 * own opening defect arriving inside the file that names it. The executable
 * control is `tests/http/token-verify.test.ts` §11, which strips the comments
 * before it looks; there is no `grep` written here that does not answer about
 * its own prose.
 *
 * ⚠️ AND THE JWKS GETS THE SAME TREATMENT FROM THE OTHER SIDE. The entry's own
 * `alg`, `use` and `key_ops` are NOT passed to `createPublicKey()`; only `kty`,
 * `n` and `e` are, and `kty` must be `RSA`. A key document that named itself
 * `oct` under the right `kid` would otherwise be imported as a SECRET, and the
 * confusion attack would arrive from the key side instead of the token side.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * §0b · THE ORDER, WHICH IS THE OTHER HALF OF THE ARGUMENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **NOTHING READ FROM AN UNVERIFIED TOKEN IS A FACT, except the three things
 * needed in order to verify it**: the signing algorithm, the key id, and the
 * two segments the signature covers. Those three are read first, refused
 * loudly, and used for nothing else.
 *
 * Everything a caller would actually want — issuer, audience, subject, expiry
 * — is read **after** `verify()` returns true, and the payload is not even
 * PARSED before then. `token_payload_unreadable` is therefore reachable only on
 * a correctly signed token, which is the shape the suite witnesses: a verifier
 * that parsed first would report a CLAIM defect on a FORGED token and so tell
 * an attacker which of their fields to fix next.
 *
 * This is `server/data-plane/signin.ts`'s own ordering argument one layer down:
 * *"the attempt is consumed FIRST and the door compared after, so that a
 * REPLAYED callback reports the replay … rather than a door disagreement."*
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * §0c · WHAT A REFUSAL CARRIES: NOTHING. AND THE PROOF IS A TYPE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `model/run-admission.ts`'s nine-arm union is the shape imitated here, and one
 * thing about it is imitated by being INVERTED. Every arm there carries a
 * branded id and nothing else, because *"the union carrying the REASON holds
 * the proof"*. Here there is no branded id to carry: **every value a refusal
 * could name — the `kid`, the `alg`, the presented `iss`, the `aud` — is a bare
 * `string` that came out of a token we have just refused to believe.** So the
 * arms carry the `kind` and nothing at all, and `AssertNoTextDeep` is what
 * makes that permanent rather than a habit: adding `readonly kid: string` to
 * any arm below is a `TS2344` at `_TokenRefusalHoldsNoText`, in the same
 * commit, with no reviewer involved. `tests/http/token-verify.test.ts` §10
 * witnesses that failure with a `@ts-expect-error`, so the proof is known to
 * BITE rather than merely to compile.
 *
 * ⚠️ **THE `ok` ARM DOES CARRY TEXT AND HAS NO PROOF ON IT, DELIBERATELY** — a
 * subject IS a string and carrying it out is the entire purpose. What keeps
 * that honest is that the arm is a NARROW RECORD rather than the payload: see
 * `VerifiedClaims`.
 */

import { createPublicKey, verify as verifySignature } from 'node:crypto'
import type { JsonWebKey, KeyObject } from 'node:crypto'

import type { AssertNoTextDeep } from '../../model/reconciliation.ts'

/* ==================================================================== *
 * §1  THE ONE ALGORITHM
 * ==================================================================== */

/**
 * The `alg` this verifier accepts, and the only one. A CONSTANT, compared
 * against the header — never a key into a table of verifiers. See §0a.
 *
 * G302 makes Cognito the broker for every external directory in this product
 * and Cognito signs with RS256; `model/domain.ts`'s `PROTOCOL_IS_BROKERED`
 * encodes the same assumption and says in its own voice that a direct,
 * unbrokered path *"is the line that has to change"*. **When a second signing
 * algorithm is genuinely wanted, this constant becomes a closed set and the
 * commit that widens it argues for the second member.** A `readonly string[]`
 * today would be that argument pre-conceded with nobody having made it.
 */
export const REQUIRED_ALGORITHM = 'RS256'

/** The node identifier for RSASSA-PKCS1-v1_5 over SHA-256. Not caller-visible. */
const NODE_SIGNATURE_ALGORITHM = 'RSA-SHA256'

/**
 * A skew a deployment may reasonably use, EXPORTED AND NOT DEFAULTED.
 *
 * 🛑 `TokenVerificationTerms.clockSkewSeconds` IS REQUIRED. A default would be
 * a tolerance nobody chose, sitting in the one place where choosing badly means
 * accepting an expired credential — and `0006`'s objection to *"declared
 * defaults, not derived data"* applies to a number as much as to a column. A
 * caller that wants sixty seconds says sixty seconds, out loud, at the call
 * site, using this.
 *
 * ⚠️ A NEGATIVE VALUE NARROWS THE WINDOW RATHER THAN WIDENING IT — it expires a
 * token early and delays one that is not yet valid — so the failure direction
 * of a mistyped skew is CLOSED. That is why there is no guard against one.
 */
export const SUGGESTED_CLOCK_SKEW_SECONDS = 60

/* ==================================================================== *
 * §2  WHAT ARRIVES
 * ==================================================================== */

/**
 * One entry of a JWKS document, as the broker publishes it.
 *
 * ⚠️ EVERY FIELD IS OPTIONAL BECAUSE THE DOCUMENT IS SOMEBODY ELSE'S. A
 * required field here would make a real-world key document unrepresentable and
 * would push the refusal out of this module and into whatever parsed the JSON —
 * which is `0011`'s reason for refusing a `CHECK` on the broker pairing, one
 * layer over: *"a constraint would make the malformed row unrepresentable and
 * the REFUSAL untestable."*
 */
export interface JsonWebKeyEntry {
  readonly kty?: string
  readonly kid?: string
  readonly use?: string
  readonly alg?: string
  /** RSA modulus, base64url. */
  readonly n?: string
  /** RSA public exponent, base64url. */
  readonly e?: string
}

/** A JWKS document. Supplied by the caller; see §0 — this module does not fetch one. */
export interface JwksDocument {
  readonly keys: readonly JsonWebKeyEntry[]
}

/**
 * Everything the verification is relative to. All five REQUIRED, and each one
 * of them is a thing a caller must actually have decided.
 *
 * 🛑 `now` IS INJECTED AND THERE IS NO HIDDEN CLOCK. A `Date.now()` inside this
 * function would make expiry untestable without sleeping, and would hide the
 * one input that decides `token_expired`. `model/onboarding.ts` makes the same
 * point from the other end, where the ABSENCE of a clock is what keeps a
 * `stalled` arm from existing.
 */
export interface TokenVerificationTerms {
  /** The `iss` the token must carry. Compared with `===` — never a prefix, never a parse. */
  readonly issuer: string
  /** The `aud` the token must carry, or contain if `aud` is an array. */
  readonly audience: string
  /** The broker's published keys. An ARGUMENT — see §0. */
  readonly jwks: JwksDocument
  /** The instant the decision is taken against. */
  readonly now: Date
  /** Tolerance on `exp` and `nbf`, in seconds. See `SUGGESTED_CLOCK_SKEW_SECONDS`. */
  readonly clockSkewSeconds: number
}

/* ==================================================================== *
 * §3  THE REFUSALS
 * ==================================================================== */

/**
 * Why a token was not believed. FIFTEEN arms, and every one of them carries the
 * `kind` AND NOTHING ELSE — see §0c for why, and for the type that enforces it.
 *
 * ⚠️ NOTHING HERE REACHES A CALLER AS PROSE. `errors.yaml` forbids `detail`
 * from carrying *"field values, record contents or customer-authored
 * strings"*, and a token is the most customer-authored thing that will ever
 * arrive at this plane. The arm names what an operator reading the process log
 * can act on; whatever mounts this owes the caller a status code and a closed
 * error code and nothing else.
 *
 * 🛑 AND THE ARMS ARE NOT COLLAPSED, THOUGH FOUR OF THEM END THE SAME WAY FOR A
 * CALLER. `token_algorithm_not_allowed`, `token_key_not_found`,
 * `token_key_unusable` and `token_signature_invalid` all mean "this token is
 * not from us" on the wire and mean four completely different things to an
 * operator: a client library misconfigured, a key rotated out from under us, a
 * key document we cannot read, and a forgery. Folding them would file every one
 * of those under whichever name the next person happened to grep for — which is
 * `model/run-admission.ts`'s ninth-arm argument verbatim: *"A refusal that
 * names the wrong subject is worse than a ninth arm."*
 */
export type TokenVerificationRefusal =
  /** Not three `.`-separated segments, or a segment is not base64url. */
  | { readonly kind: 'token_malformed' }
  /** The header segment does not decode, or does not decode to a JSON object. */
  | { readonly kind: 'token_header_unreadable' }
  /**
   * `alg` is absent, is not a string, or is not `REQUIRED_ALGORITHM`.
   *
   * 🛑 THIS IS WHERE `none` AND EVERY `HS*` LEAVE, AND IT IS BEFORE A KEY IS
   * SELECTED. See §0a. A verifier that refused `alg: none` because the
   * signature segment was EMPTY would accept `alg: none` carrying a junk
   * signature; the suite witnesses both forms for exactly that reason.
   */
  | { readonly kind: 'token_algorithm_not_allowed' }
  /**
   * The header carries `crit`.
   *
   * RFC 7515 §4.1.11: a `crit` extension a verifier does not understand MUST
   * cause rejection. This verifier understands none, so any `crit` at all is a
   * refusal. **The fail-open form of this is to ignore the member**, which is
   * why it is an arm and not an omission.
   */
  | { readonly kind: 'token_critical_header_unsupported' }
  /** No `kid`, or `kid` is not a non-empty string. A token that names no key names no key. */
  | { readonly kind: 'token_kid_absent' }
  /** The document holds no entry with that `kid`. A rotation, or a token from another pool. */
  | { readonly kind: 'token_key_not_found' }
  /** The entry is not an RSA key we can import — wrong `kty`, missing `n`/`e`, or a bad import. */
  | { readonly kind: 'token_key_unusable' }
  /** The bytes do not verify under that key. A forgery, or a tampered payload. */
  | { readonly kind: 'token_signature_invalid' }
  /**
   * The payload segment does not decode to a JSON object.
   *
   * ⚠️ REACHABLE ONLY ON A CORRECTLY SIGNED TOKEN, BY CONSTRUCTION — the
   * payload is not parsed until the signature has verified. See §0b.
   */
  | { readonly kind: 'token_payload_unreadable' }
  /** `iss` is absent or is not exactly `TokenVerificationTerms.issuer`. */
  | { readonly kind: 'token_issuer_mismatch' }
  /** `aud` is absent, or neither equals nor contains `TokenVerificationTerms.audience`. */
  | { readonly kind: 'token_audience_mismatch' }
  /**
   * `sub` is absent or is not a non-empty string.
   *
   * 🛑 REFUSED RATHER THAN RETURNED AS `null`, because the ONE thing this
   * verifier exists to produce is the subject a directory asserted, and a
   * caller handed `subject: null` would reach for the next-best identifier —
   * which is `email`, which `server/data-plane/signin.ts` refuses BY NAME:
   * *"an email is a claim the DIRECTORY makes and nothing here checks that the
   * directory is entitled to make it … A subject is scoped to an issuer; an
   * address is not."* An absent subject is a broken token, not a person.
   */
  | { readonly kind: 'token_subject_absent' }
  /**
   * `exp` is absent or is not a finite number.
   *
   * 🛑 AN ABSENT `exp` IS A REFUSAL AND NEVER "NO EXPIRY". The fail-open
   * reading of a missing claim here is a credential that never dies.
   */
  | { readonly kind: 'token_expiry_absent' }
  /** `now` is past `exp` by more than the allowed skew. */
  | { readonly kind: 'token_expired' }
  /** `now` is before `nbf` by more than the allowed skew. */
  | { readonly kind: 'token_not_yet_valid' }

/**
 * 🛑 THE CONTAINMENT PROOF. See §0c — this is what makes "a refusal carries
 * nothing" a compile error rather than a convention. A `kind` is a string
 * LITERAL and passes; a bare `string` on any arm does not.
 */
export type _TokenRefusalHoldsNoText = AssertNoTextDeep<TokenVerificationRefusal>

/**
 * The closed set, as values, for anything that has to enumerate them — a test
 * census, a log switch, a future mapping onto `errors.yaml`.
 *
 * ⚠️ IT IS DERIVED FROM NOTHING AND NOTHING IS DERIVED FROM IT, so the two can
 * drift. What stops that is `_EveryRefusalKindIsListed` immediately below: the
 * union and this roster are each proven to contain the other, which is the one
 * thing that makes a hand-written list of a closed set safe.
 */
export const TOKEN_VERIFICATION_REFUSALS = [
  'token_malformed',
  'token_header_unreadable',
  'token_algorithm_not_allowed',
  'token_critical_header_unsupported',
  'token_kid_absent',
  'token_key_not_found',
  'token_key_unusable',
  'token_signature_invalid',
  'token_payload_unreadable',
  'token_issuer_mismatch',
  'token_audience_mismatch',
  'token_subject_absent',
  'token_expiry_absent',
  'token_expired',
  'token_not_yet_valid',
] as const

/** Both directions. A sixteenth arm with no roster entry fails to compile here. */
export type _EveryRefusalKindIsListed =
  (typeof TOKEN_VERIFICATION_REFUSALS)[number] extends TokenVerificationRefusal['kind']
    ? TokenVerificationRefusal['kind'] extends (typeof TOKEN_VERIFICATION_REFUSALS)[number]
      ? true
      : never
    : never

/**
 * The proof above holds the SHAPE and only a value witnesses the CONTENT —
 * `CLAUDE.md`: *"a total `Record` only bites where something CONSTRUCTS one."*
 * This is the construction site, and it is exported so `noUnusedLocals` cannot
 * quietly delete the control.
 */
export const REFUSAL_ROSTER_IS_TOTAL: _EveryRefusalKindIsListed = true

/* ==================================================================== *
 * §4  THE VERDICT
 * ==================================================================== */

/**
 * What a verified token is allowed to have said.
 *
 * 🛑 THE PAYLOAD IS NOT RETURNED AND THERE IS NO CLAIM BAG. ⚠️ **THIS SAID SIX
 * FIELDS UNTIL 25 Sep 2026 AND SAYS SEVEN; the seventh is `nonce` and it
 * arrives with the argument this paragraph demands, immediately below.** ⚠️
 * **AND IT SAYS EIGHT SINCE 2 Oct 2026 — `emailVerified`, G2901, argued at
 * its own field.** Every
 * one of them is read by the function that returns them. A caller that cannot
 * SEE `email` cannot resolve a person by it, and that is not a hypothetical
 * discipline: `server/data-plane/signin.ts` names resolving by email as *"the
 * tempting shortcut … so it is refused rather than re-invented"*. Widening this
 * record is how that refusal would quietly stop being enforced, so the next
 * claim anybody needs arrives with an argument for it at this declaration.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 THE ARGUMENT FOR `nonce` — W3/S4, G2141, 25 Sep 2026
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `docs/build/d6-threat-model.md` §4.3 is the attack with the least defence and
 * the most confusing-looking defence, and it measured this file:
 * *"`VerifiedClaims` has no `nonce` field and `token-verify.ts` contains the
 * string zero times … **So nothing in this repository can bind an ID token to
 * the sign-in attempt it was issued for.**"* What LOOKS like the binding is
 * `consumeSignInAttempt()`'s challenge comparison, and **both sides of it are
 * values the same caller supplied** — one at redirect, one at callback. It
 * proves the caller knows the challenge. It does not prove the token was issued
 * for this attempt.
 *
 * G344 found and closed exactly this shape one field over, for `connectionId`,
 * and closed it **by comparing against something the caller does not control**.
 * The equivalent move for the challenge is to compare the pinned digest against
 * the `nonce` inside a VERIFIED token — a value the broker copied from our own
 * redirect and then SIGNED — and it was impossible while this record could not
 * carry one. **That is the whole of why the field is here.**
 *
 * 🛑 **IT IS READ AND IT IS NOT CHECKED, EXACTLY AS `iat` IS, AND THAT IS NOT
 * A HALF MEASURE — IT IS THE ONLY HONEST SHAPE.** A verifier knows what `iss`
 * and `aud` must be because a deployment stated them; **it cannot know what a
 * nonce should be**, because the expected value belongs to one sign-in attempt
 * sitting in a database row this module has never heard of and must not.
 * Adding a `requiredNonce` to `TokenVerificationTerms` would make this file
 * reach for the attempt, and `model/domain.ts` states the rule the comparison
 * has to obey — *"COMPARED, NEVER RE-DERIVED"*. **The comparison is
 * `server/data-plane/code-exchange.ts`'s `bindTokenToAttempt()`**, which is the
 * one place that legitimately holds both the verified claims and the digest the
 * redirect pinned.
 *
 * ⚠️ **AND THERE IS NO SIXTEENTH REFUSAL ARM: AN ABSENT `nonce` IS `null` HERE
 * AND A REFUSAL THERE.** Refusing it in this function would be wrong in both
 * directions — it would make every legitimately nonce-less token (a client
 * credentials grant, a token from a flow that never sent one) unverifiable, and
 * it would put a decision about the SIGN-IN FLOW inside a general verifier.
 * `bindTokenToAttempt()` refuses `token_carries_no_nonce` because IT is the
 * thing that knows a nonce was required. **The absence of an arm here is a
 * statement, and `tests/http/token-verify.test.ts` §12's census still counts
 * fifteen.**
 *
 * ⚠️ `issuer` AND `audience` ARE ECHOED THOUGH THE CALLER SUPPLIED THEM. They
 * are here so that a verdict is self-describing in a log — and because the day
 * a multi-issuer caller exists, the alternative is a caller pairing a verdict
 * with terms from memory.
 */
export interface VerifiedClaims {
  /** `iss`, verified equal to the terms' issuer. */
  readonly issuer: string
  /** `sub`. The subject a directory asserted — the point of the whole exercise. */
  readonly subject: string
  /** `aud`, normalised to a list, verified to contain the terms' audience. */
  readonly audience: readonly string[]
  /** `exp`, seconds since the epoch. */
  readonly expiresAt: number
  /** `nbf` if the token carried one. */
  readonly notBefore: number | null
  /** `iat` if the token carried one. NOT checked — see `verifyIdentityToken`. */
  readonly issuedAt: number | null
  /**
   * `nonce` if the token carried one. **READ AND NOT CHECKED**, for the reason
   * argued at length on this interface's own declaration: a verifier cannot
   * know what a nonce should be, and the one thing that does —
   * `bindTokenToAttempt()` — is the caller.
   *
   * 🛑 DO NOT ADD A `requiredNonce` TO `TokenVerificationTerms` TO "FINISH"
   * THIS. It would make this module reach for a sign-in attempt, and it would
   * put a fact about one flow inside a function four flows will eventually
   * call. The binding is a COMPARISON at the seam, not a term of verification.
   */
  readonly nonce: string | null
  /**
   * WHETHER THE DIRECTORY ATTESTS THE TOKEN'S `email` — OIDC Core §5.1's
   * `email_verified`. **READ AFTER THE SIGNATURE, NEVER DISPATCHED ON, AND
   * NEVER JUDGED HERE** — `nonce`'s treatment exactly, for `nonce`'s reason:
   * what an unverified address may not do is a fact about the CALLER's act,
   * and this verifier does not know which acts key on an address.
   *
   * ══════════════════════════════════════════════════════════════════════
   * 🛑 THE ARGUMENT FOR AN EIGHTH FIELD — G2901, 2 Oct 2026 (derived, closing
   *    G2816; NOT THE OWNER'S)
   * ══════════════════════════════════════════════════════════════════════
   *
   * `0370` redeems a partner invitation by matching the person's ADDRESS,
   * and that address is a claim the directory makes. A directory that lets a
   * user set an unconfirmed address — most do, at self-service sign-up —
   * would otherwise let anybody type another person's address and receive the
   * role that person was offered. **Witnessed RED at
   * `tests/db/partner-invitation-redemption.test.ts` §9.** The redemption is
   * the first act in this repository that KEYS on an address, so it is the
   * first that needs to know whether the address was proved.
   *
   * ⚠️ **IT IS A BOOLEAN AND NOT THE ADDRESS, AND THAT IS WHY THIS DOES NOT
   * BREAK `tests/http/token-verify.test.ts` §1b's REFUSAL OF `email`.** A
   * caller holding this field still cannot SEE an address, so it still cannot
   * resolve a person by one.
   *
   * ⚠️ **FAIL-CLOSED, AND TWO SPELLINGS ARE `true`.** The JSON boolean `true`
   * (OIDC Core) and the STRING `"true"` — Amazon Cognito emits the attribute
   * as a string for a federated user whose attribute mapping carries it, and
   * this product's broker IS Cognito (G302). Everything else — absent,
   * `false`, `"false"`, `"TRUE"`, `1` — is `false`. A false negative costs a
   * person a role they can be re-invited into; a false positive confers one.
   */
  readonly emailVerified: boolean
}

/** Verified, or refused. Nothing throws; every failure is a value. */
export type TokenVerification =
  | { readonly ok: true; readonly claims: VerifiedClaims }
  | { readonly ok: false; readonly refusal: TokenVerificationRefusal }

function refuse(kind: TokenVerificationRefusal['kind']): TokenVerification {
  return { ok: false, refusal: { kind } }
}

/* ==================================================================== *
 * §5  THE PARSING, WHICH IS DELIBERATELY STRICT
 * ==================================================================== */

/**
 * base64url, and nothing that merely looks like it.
 *
 * 🛑 `Buffer.from(s, 'base64url')` IS LENIENT: it SKIPS characters it does not
 * recognise rather than failing, so `"ab*cd"` and `"abcd"` decode alike. That
 * leniency is harmless for the signature — the signing input is compared as
 * BYTES and any edit at all changes it — and it is not harmless for the header,
 * which is read before anything has been verified. One regex, applied to all
 * three segments, keeps "this is not a JWT" and "this is a JWT I refuse" apart.
 *
 * ⚠️ THE SIGNATURE SEGMENT MAY BE EMPTY AND THE OTHER TWO MAY NOT, WHICH IS THE
 * WHOLE REASON THERE ARE TWO PATTERNS. `alg: none` is conventionally written
 * with an empty third segment; refusing that as MALFORMED would name the wrong
 * defect, and would leave `alg: none` carrying a junk signature to be caught by
 * something else. It has to reach `token_algorithm_not_allowed`.
 */
const BASE64URL = /^[A-Za-z0-9_-]+$/
const BASE64URL_OR_EMPTY = /^[A-Za-z0-9_-]*$/

/** A JSON object, or `null` — never an array, a number or a string. */
function decodeJsonObject(segment: string): Record<string, unknown> | null {
  let text: string
  try {
    text = Buffer.from(segment, 'base64url').toString('utf8')
  } catch {
    return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  return parsed as Record<string, unknown>
}

function stringClaim(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key]
  return typeof value === 'string' && value !== '' ? value : null
}

function numericClaim(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * `email_verified`, in the two spellings a directory this product brokers
 * actually emits — the JSON boolean, and Cognito's string `"true"` — and
 * `false` for everything else, absence included (G2901).
 */
function emailVerifiedClaim(payload: Record<string, unknown>): boolean {
  const value = payload['email_verified']
  return value === true || value === 'true'
}

/**
 * `aud` is a string OR an array of strings — RFC 7519 §4.1.3 — and an array
 * with one non-string member is not a partially usable audience.
 */
function audienceClaim(payload: Record<string, unknown>): readonly string[] | null {
  const value = payload['aud']
  if (typeof value === 'string' && value !== '') return [value]
  if (!Array.isArray(value) || value.length === 0) return null
  const members: string[] = []
  for (const member of value) {
    if (typeof member !== 'string' || member === '') return null
    members.push(member)
  }
  return members
}

/** Only `kty`, `n` and `e` cross this line — §0a. `null` rather than a throw. */
function importRsaPublicKey(n: string, e: string): KeyObject | null {
  const material: JsonWebKey = { kty: 'RSA', n, e }
  try {
    return createPublicKey({ key: material, format: 'jwk' })
  } catch {
    return null
  }
}

function signatureHolds(signingInput: string, key: KeyObject, signature: string): boolean {
  try {
    return verifySignature(
      NODE_SIGNATURE_ALGORITHM,
      Buffer.from(signingInput, 'ascii'),
      key,
      Buffer.from(signature, 'base64url'),
    )
  } catch {
    return false
  }
}

/* ==================================================================== *
 * §6  THE VERIFIER
 * ==================================================================== */

/**
 * Verify one RS256 identity token against one JWKS document and one set of
 * terms. **Pure**: no clock, no network, no database, no environment.
 *
 * The order is §0b's and is not free to change:
 *
 *   1. shape         — three base64url segments
 *   2. header        — a JSON object
 *   3. ALGORITHM     — `RS256` or nothing (§0a)
 *   4. `crit`        — refused outright
 *   5. `kid`         — present
 *   6. key           — selected from the document, imported as RSA and nothing else
 *   7. SIGNATURE     — and only now is anything in the token a fact
 *   8. payload       — parsed
 *   9. `iss`         — `===`
 *  10. `aud`         — membership
 *  11. `sub`         — present
 *  12. `exp` / `nbf` — against the injected clock, with the caller's skew
 *
 * ⚠️ `iat` IS READ AND NOT CHECKED, AND THE ABSENCE IS STATED RATHER THAN LEFT
 * TO BE NOTICED. There is no maximum token age here: enforcing one is a POLICY
 * (how old is too old, and for which operation), the terms carry no field for
 * it, and inventing a bound is exactly the declared-default-presented-as-derived
 * -data that `0006` refuses. When somebody rules a maximum age it arrives as a
 * term and a sixteenth arm.
 *
 * ⚠️ AND A NOTE ON WHAT `exp` MEANS TO A SESSION, WHICH IS NOTHING YET. A
 * token's expiry bounds the token. `tenant.session` has its own `expires_at`
 * and `holdsLiveMembership()` (G641) is checked on every request; whether a
 * session outlives the token that produced it is a ruling nobody has taken, and
 * this function does not take it by returning `expiresAt`.
 */
export function verifyIdentityToken(
  token: string,
  terms: TokenVerificationTerms,
): TokenVerification {
  /* 1 · SHAPE */
  if (typeof token !== 'string' || token === '') return refuse('token_malformed')
  const segments = token.split('.')
  if (segments.length !== 3) return refuse('token_malformed')
  const headerSegment = segments[0] ?? ''
  const payloadSegment = segments[1] ?? ''
  const signatureSegment = segments[2] ?? ''
  if (!BASE64URL.test(headerSegment)) return refuse('token_malformed')
  if (!BASE64URL.test(payloadSegment)) return refuse('token_malformed')
  if (!BASE64URL_OR_EMPTY.test(signatureSegment)) return refuse('token_malformed')

  /* 2 · HEADER */
  const header = decodeJsonObject(headerSegment)
  if (header === null) return refuse('token_header_unreadable')

  /* 3 · ALGORITHM — a comparison, never a dispatch. §0a. */
  if (header['alg'] !== REQUIRED_ALGORITHM) return refuse('token_algorithm_not_allowed')

  /* 4 · `crit` — understood by nothing here, so refused. */
  if (header['crit'] !== undefined) return refuse('token_critical_header_unsupported')

  /* 5 · `kid` */
  const kid = typeof header['kid'] === 'string' && header['kid'] !== '' ? header['kid'] : null
  if (kid === null) return refuse('token_kid_absent')

  /* 6 · KEY
   *
   * ⚠️ THE FIRST MATCH WINS AND A DUPLICATE `kid` IS NOT REFUSED. A broker
   * publishing two entries under one `kid` has a defect we cannot fix from
   * here, and refusing would take every token in that pool down for it; the
   * SIGNATURE decides which entry was right, and a wrong pick is a refusal
   * rather than an acceptance. That is the fail-closed direction, which is why
   * this is a note and not a sixteenth arm. */
  const entry = terms.jwks.keys.find((candidate) => candidate.kid === kid)
  if (entry === undefined) return refuse('token_key_not_found')
  if (entry.kty !== 'RSA') return refuse('token_key_unusable')
  if (typeof entry.n !== 'string' || entry.n === '') return refuse('token_key_unusable')
  if (typeof entry.e !== 'string' || entry.e === '') return refuse('token_key_unusable')
  const key = importRsaPublicKey(entry.n, entry.e)
  if (key === null) return refuse('token_key_unusable')

  /* 7 · SIGNATURE — everything above this line is still only the token's word. */
  if (!signatureHolds(`${headerSegment}.${payloadSegment}`, key, signatureSegment)) {
    return refuse('token_signature_invalid')
  }

  /* 8 · PAYLOAD — and only now. §0b. */
  const payload = decodeJsonObject(payloadSegment)
  if (payload === null) return refuse('token_payload_unreadable')

  /* 9 · ISSUER — exact equality. Not a prefix, not a normalisation, not a
   * parse: `model/serving-host.ts`'s *"a LOOKUP, never a parse"* is the same
   * rule, and an issuer compared loosely is a neighbouring pool admitted.
   * ⚠️ D6-5 (the owner's, G2232): for a sign-in, `terms.issuer` is the PINNED
   * row's `broker_issuer` — `verification-terms.ts` §2a. The token's `iss` is
   * the thing COMPARED here and it chooses nothing, exactly as `alg` does. */
  const issuer = stringClaim(payload, 'iss')
  if (issuer === null || issuer !== terms.issuer) return refuse('token_issuer_mismatch')

  /* 10 · AUDIENCE */
  const audience = audienceClaim(payload)
  if (audience === null || !audience.includes(terms.audience)) {
    return refuse('token_audience_mismatch')
  }

  /* 11 · SUBJECT */
  const subject = stringClaim(payload, 'sub')
  if (subject === null) return refuse('token_subject_absent')

  /* 12 · THE CLOCK */
  const expiresAt = numericClaim(payload, 'exp')
  if (expiresAt === null) return refuse('token_expiry_absent')
  const nowSeconds = terms.now.getTime() / 1000
  if (nowSeconds > expiresAt + terms.clockSkewSeconds) return refuse('token_expired')

  const notBefore = numericClaim(payload, 'nbf')
  if (notBefore !== null && nowSeconds < notBefore - terms.clockSkewSeconds) {
    return refuse('token_not_yet_valid')
  }

  return {
    ok: true,
    claims: {
      issuer,
      subject,
      audience,
      expiresAt,
      notBefore,
      issuedAt: numericClaim(payload, 'iat'),
      /* READ, NEVER JUDGED — G2141. `stringClaim` answers `null` for an absent
       * claim, for a non-string one, and for the empty string, and all three
       * reach `bindTokenToAttempt()` as `token_carries_no_nonce`. An empty
       * nonce is not a nonce: it is the value a broker emits when it was asked
       * for one and had none, and digesting it would compare a digest of ''
       * against a pinned challenge. */
      nonce: stringClaim(payload, 'nonce'),
      /* READ, NEVER JUDGED — G2901. See the field's declaration. */
      emailVerified: emailVerifiedClaim(payload),
    },
  }
}
