/**
 * THE FEDERATED CALLBACK, ASSEMBLED — G315 / G340, and G344 taken here.
 *
 * ✅ **S6, 1 Oct 2026 (G2481–G2490): A ROUTE REACHES THIS FILE NOW, AND THE
 * PARAGRAPH BELOW IS KEPT RATHER THAN DELETED** because it is the sentence a
 * reader would otherwise have trusted. `server/data-plane/federated-signin.ts`
 * calls `readPinnedSignIn()` (below, G2235's pin read) and then
 * `mintFederatedSession()`, which calls `assembleSignIn()`. Every clause of
 * the *"WHAT THIS FILE DOES NOT DO"* section at its foot is now done ELSEWHERE
 * — the token is verified (`token-verify.ts`), the person resolved by `sub`
 * (`0200`), the code exchanged (`code-exchange.ts`, G2443) and the credential
 * delivered (`session-cookie.ts`) — and this file still mints nothing itself.
 *
 * ⚠️ READ THIS FIRST, BECAUSE IT IS THE SENTENCE A READER WILL OTHERWISE
 *    ASSUME THE OPPOSITE OF: **NOTHING IN THIS FILE MINTS A SESSION, AND NO
 *    ROUTE REACHES IT.** `docs/contracts/session.openapi.yaml` declares
 *    `completeFederatedSignIn` and no plane mounts it — derive it, do not read
 *    this line: `grep -rn 'completeFederatedSignIn' server/`. What this module
 *    is, exactly, is the half of that operation that CAN be built honestly
 *    today: reading the door a token came through, reading the attempt the
 *    redirect wrote, and proving the two agree. The half that cannot is named
 *    at the foot of this header, with the reason.
 *
 * ┌─ WHERE THIS SITS IN G315's SHAPE ─────────────────────────────────────────┐
 * │  browser → IdP → `auth.{region}.reconcileai.app/callback`                  │
 * │            the regional auth host exchanges the code, reads `state`,       │
 * │            and 302s to the TENANT host                                     │
 * │  → `{tenant}.{region}.reconcileai.app` — **the session is minted here and  │
 * │    nowhere else**                                                          │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 STEP FOUR IS WHY THE SHAPE WAS CHOSEN AND IT IS THE THING NOT TO "FIX".
 * G315: *"`checkHostBinding()` NEVER SEES A MISMATCH, because a session is
 * never issued on one host and presented on another. G180's revoke-on-mismatch
 * keeps its property of having no exceptions, which is the thing that makes it
 * worth having."* A session minted on the auth host and presented on a tenant
 * host is precisely what G180 revokes. **Do not relax G180 to make a callback
 * convenient; move the mint.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 G344 — THE DOOR THE TOKEN CAME THROUGH MUST BE THE DOOR THE REDIRECT
 *    PINNED, AND THE DISAGREEMENT IS A NAMED REFUSAL RATHER THAN A DEFAULT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Two independent facts arrive at a callback and this module is the only place
 * they meet:
 *
 *   FROM THE ROW      `SignInAttempt.connectionId` — *"WHICH DOOR WAS CHOSEN,
 *                     PINNED AT REDIRECT"*, written before the person answered
 *                     anything.
 *   FROM THE HANDLE   the connection whose `(broker_issuer, broker_ref)` the
 *                     caller named — i.e. the door the BROKER says issued the
 *                     token.
 *
 * `consumeSignInAttempt()` already refuses when the CALLBACK BODY names a
 * different door than the row (`sign_in_attempt_connection_mismatch`), and
 * `model/domain.ts` argues that arm at length: *"re-choosing at callback lets
 * a caller name a different connection than the one it was sent to, and org
 * class derives from a connection's owner. That is the ORG AXIS READ FROM A
 * REQUEST — invariant 1's shape, one axis over."*
 *
 * **THAT ARM DOES NOT COVER THIS ONE, AND THE GAP IS THE WHOLE OF G344.** It
 * compares two values the same caller supplied against each other via the row;
 * it says nothing about whether the BROKER HANDLE names that same row. A
 * caller holding a stolen `state` for a customer door, who presents a broker
 * handle for a PARTNER door they legitimately control, satisfies every arm of
 * `consumeSignInAttempt()` — handle digest matches, unconsumed, `connectionId`
 * equals the pinned one, challenge matches — and walks away with a connection
 * whose `owner` is the partner's. `orgFor(connection.owner)` then answers
 * `partner`, and G289's price applies in full: the live-grant check, the
 * `partnerId` check, revocation, expiry and `PARTNER_CAPABILITY_MASK` are
 * five controls evaluated about the wrong organisation.
 *
 * 🟢 **THE RULE: the connection the handle resolves to and the connection the
 * attempt pinned must be the SAME ROW, compared by id, or the callback is
 * refused as `sign_in_door_disagrees`.** Not reconciled, not preferred one way
 * — refused. There is no reading under which a disagreement here is benign:
 * either the row was written wrong or somebody is trying it on, and neither is
 * a state to serve.
 *
 * ⚠️ THE REJECTED ALTERNATIVE IS THE OBVIOUS ONE AND IT IS OBVIOUSLY WRONG
 * ONCE WRITTEN DOWN: **drop the attempt's `connectionId` and trust the broker
 * handle**, on the ground that the broker is the one that actually
 * authenticated the person. It reads as the simpler design. It deletes the
 * PIN — the only record of which door the platform SENT the person to — and a
 * design in which the door is whatever the callback says it is has no pin to
 * disagree with. `SignInAttempt.connectionId` exists to be disagreed with.
 *
 * ⚠️ AND THE ORDER MATTERS, FOR `consumeSignInAttempt()`'s OWN REASON. The
 * attempt is consumed FIRST and the door compared after, so that a REPLAYED
 * callback reports the replay — the fact about the row — rather than a door
 * disagreement, which is a fact about the caller. That is the model's own
 * ordering argument applied one step out.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT THIS FILE DOES NOT DO, AND WHY — SAID PLAINLY RATHER THAN LEFT TO BE
 *    DISCOVERED BY SOMEBODY LOOKING FOR THE HANDLER.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **IT DOES NOT RESOLVE A PERSON, SO IT CANNOT MINT A SESSION.**
 * `tenant.session.user_id` is `NOT NULL`. A `user_id` comes from the subject
 * the directory asserted, that subject arrives only inside an identity token,
 * and **nothing in this repository verifies one** — derive it:
 * `grep -rn 'jwtVerify\|createRemoteJWKSet\|verifyIdToken' server/` returns
 * nothing, which is G306's own derivation. `tenant."user"` carries no
 * external-subject column for the same reason: G306 refuses a column ahead of
 * its reader, and the reader is the verifier.
 *
 * ⚠️ THE TEMPTING SHORTCUT IS NAMED SO IT IS REFUSED RATHER THAN RE-INVENTED:
 * resolve the person by EMAIL from the token. `tenant."user".email` exists and
 * an email claim is right there. It is refused because an email is a claim the
 * DIRECTORY makes and nothing here checks that the directory is entitled to
 * make it — two connections can assert the same address, and the first to do
 * so takes the other's person. A subject is scoped to an issuer; an address is
 * not. That is `routeToConnection()`'s
 * `domain_claimed_by_more_than_one_connection` arriving one axis over, and it
 * would arrive with no function able to see both claims.
 *
 * **IT DOES NOT EXCHANGE A CODE AND IT HOLDS NO CLIENT SECRET.** That is the
 * regional auth host's, it does not exist, and `docs/build/deploy-handoff.md`
 * §8 trap 10 is why `infra/` is not where to start: Cognito stores a client
 * secret's VALUE, so a rotation that never reaches the pool is recorded as
 * working.
 *
 * **IT DOES NOT DELIVER A CREDENTIAL, AND THAT IS A CONTRACT-LEVEL HOLD RATHER
 * THAN AN OMISSION HERE.** `docs/contracts/session.openapi.yaml` states it on
 * `completeFederatedSignIn` itself: *"Whether the handle arrives as a
 * `Set-Cookie` or as a response body field is a security decision … Declaring
 * a field here would take that decision silently. It is owed to the D6 threat
 * model, and until it lands this operation's 200 describes the session and
 * does not deliver the credential."* `MintedSession` is `SessionView` narrowed
 * — nine keys, none of them the handle. **So even a complete mint would not
 * let a browser sign in**, and adding a field to that schema here would be
 * taking the owner's reserved decision inside a build slice.
 */

import { consumeSignInAttempt, type SignInAttempt } from '../../model/domain.ts'
import type {
  FederatedCallback,
  IdentityConnection,
  SessionHandleDigest,
} from '../../model/domain.ts'
import type { IdentityConnectionId, SignInAttemptId } from '../../model/kernel.ts'
import type { ScopedClient } from '../../db/tenant-scope.ts'
import type { SignInHandOff } from '../../model/serving-host.ts'
import {
  SUBSTRATE_REFUSALS,
  readConnectionByBrokerHandle,
  type SubstrateRefusal,
} from './identity.ts'
import { pinnedBrokerIssuer, type PinnedBrokerIssuer } from './verification-terms.ts'

/**
 * WHY A CALLBACK WAS REFUSED — this module's own closed set, and it is
 * deliberately SMALL.
 *
 * ⚠️ IT DOES NOT RESTATE `SIGN_IN_ATTEMPT_REFUSALS`. Those four are
 * `model/domain.ts`'s, they mirror onto the wire BY EXACT NAME, and a copy
 * here would be the second vocabulary §5.3 catalogues. The outcome type below
 * carries the model's refusal through unchanged; these are the refusals that
 * belong to the READ rather than to the decision.
 */
export const SIGN_IN_REFUSALS = {
  /** No row carries the presented `state` digest. Expired, swept, or never minted. */
  signInAttemptAbsent: 'sign_in_attempt_absent',
  /**
   * 🛑 G344. The broker handle resolved to a door, the attempt pinned a door,
   * and they are not the same door. See the header: this is the arm
   * `consumeSignInAttempt()` structurally cannot have, because it never sees a
   * broker handle.
   */
  signInDoorDisagrees: 'sign_in_door_disagrees',
  /**
   * ⚠️ THE CONSUMING WRITE DID NOT LAND ON EXACTLY ONE ROW. Not a row that was
   * already consumed — that is the model's `sign_in_attempt_replayed`, decided
   * before this write is attempted. This is the write itself reporting a row
   * count it should not be able to report, which means the policy or the
   * unique index has moved. Refused rather than ignored, because an unconsumed
   * attempt that a caller believes was consumed is a replayable attempt.
   */
  signInAttemptNotConsumed: 'sign_in_attempt_not_consumed',
  /**
   * ⚠️ D6-5, G2233. The pinned door carries no broker issuer, so there is no
   * issuer to verify a token against — and the ruling forbids taking one from
   * the token. **Unreachable through the policy** (see the note at the foot of
   * `assembleSignIn()`), and named anyway, because the alternative to a named
   * refusal here is a default, and the only default available is the token's
   * own `iss`.
   */
  signInDoorNotBrokered: 'sign_in_door_not_brokered',
  /**
   * The PINNED door is `disabled` — S6, G2483. Read in the PIN transaction,
   * before a code is exchanged, so a disabled directory costs no egress.
   * `resolveSubject()` would refuse every session minted through it on the
   * first request in any case; refusing here is the honest order, because a
   * session the platform knows to be unusable is not a session to mint.
   */
  signInDoorDisabled: 'sign_in_door_disabled',
} as const
export type SignInRefusal = (typeof SIGN_IN_REFUSALS)[keyof typeof SIGN_IN_REFUSALS]

/**
 * ⚠️ THREE REFUSAL VOCABULARIES IN ONE UNION, CARRIED SEPARATELY RATHER THAN
 * FLATTENED INTO ONE STRING. Each is owned by a different layer and each is
 * the thing a different reader wants: `SubstrateRefusal` is a fact about OUR
 * rows and belongs in the operator's log; `SignInAttemptRefusal` is the
 * model's closed set and mirrors onto the wire by exact name;
 * `SignInRefusal` is this seam's. Collapsing them would be the collapse
 * `server/data-plane/authorise.ts` forbids in capitals — a fact about us
 * reported as a fact about the caller.
 */
export type SignInAssembly =
  | {
      readonly ok: true
      /** THE ROW's door, not the callback's and not the handle's — all three agreed. */
      readonly connection: IdentityConnection
      readonly attemptId: SignInAttemptId
      /**
       * The model's own consumption verdict, CARRIED rather than reconstructed
       * — W3-S3, G1639.
       *
       * 🛑 IT IS RETURNED BECAUSE `MintSessionInput.consumption` DEMANDS THE
       * REAL ONE AND A CALLER COULD OTHERWISE FABRICATE IT. Its `ok: true` arm
       * is `{ ok: true, connectionId }`, so a mint writer holding only
       * `connection.id` could spell `{ ok: true, connectionId: connection.id }`
       * by hand and satisfy the type — which would make the mint's
       * `consumption` argument a value the WRITER chose rather than the value
       * `consumeSignInAttempt()` returned, and would leave the model checking
       * its own caller's assertion. Carrying it costs one field and removes
       * that option.
       */
      readonly consumption: Extract<ReturnType<typeof consumeSignInAttempt>, { ok: true }>
      /**
       * 🛑 THE ISSUER A TOKEN FOR THIS SIGN-IN MUST CARRY — D6-5, THE OWNER'S
       * RULING OF 29–30 Sep 2026, G2233. *"The broker issuer comes from the
       * PINNED `identity_connection` ROW, never from the token."* Read off
       * `connection` — the row the G344 comparison below has just proved is
       * the one the redirect pinned — through `pinnedBrokerIssuer()`, the one
       * constructor of the brand, and handed to `verificationTermsAt()`. This
       * is the ONLY call of that constructor in `server/`, and
       * `tests/http/pinned-issuer.test.ts` §3 holds it to one.
       */
      readonly brokerIssuer: PinnedBrokerIssuer
    }
  | { readonly ok: false; readonly kind: 'substrate'; readonly refusal: SubstrateRefusal }
  | {
      readonly ok: false
      readonly kind: 'attempt'
      readonly refusal: ReturnType<typeof consumeSignInAttempt> extends infer R
        ? R extends { ok: false; refusal: infer F }
          ? F
          : never
        : never
    }
  | { readonly ok: false; readonly kind: 'signin'; readonly refusal: SignInRefusal }

/**
 * HOW LONG A SIGN-IN ATTEMPT LIVES — D6-6, THE OWNER'S RULING OF 29–30 Sep
 * 2026, G2201. **THE WINDOW ITSELF WAS CHOSEN BY THE SLICE, NOT BY THE OWNER**:
 * the ruling says *"five or ten minutes is conventional; that is owed by the
 * slice"*, and this is that choice.
 *
 * 🛑 THIS CONSTANT IS A NAME AND NOT THE ENFORCEMENT. The enforcement is
 * `sign_in_attempt_unexpired_restrictive` in
 * `db/migrations/0240_sign_in_attempt_expiry.sql`, which compares `now()`
 * against `started_at + interval '10 minutes'` AND against `expires_at`, both
 * `timestamptz`, in the database. **The model-only alternative was refused on
 * `0035`'s precedent**: a row that stays valid in the database protects
 * nothing that does not go through the model. `tests/db/signin-expiry-and-subject-fence.test.ts`
 * §1d reads the policy back and requires its interval to equal this value, so
 * the two homes cannot drift.
 *
 * ⚠️ WHY TEN AND NOT FIVE. The window spans exactly one human act at a third
 * party — the redirect, the IdP's own sign-in page, a second factor the IdP
 * may demand (G223 puts that with federation, not with us), and the redirect
 * back. Five minutes is tight against an authenticator-app enrolment or a
 * password reset taken mid-flow, and the failure is a person told to start
 * again. Ten keeps that rare while still bounding a stolen `state` to minutes
 * rather than to the life of the row, which was the defect. ⚠️ **AND IT IS A
 * CEILING THE WRITER CANNOT RAISE**: the policy takes the EARLIER of the TTL
 * and the writer-set `expires_at`, so a writer may shorten an attempt and may
 * not lengthen one.
 */
export const SIGN_IN_ATTEMPT_TTL_MINUTES = 10

/**
 * THE ATTEMPT READ. NO `WHERE`, for the reason every read in this plane states.
 *
 * `sign_in_attempt_rls` decides which row is visible, from the digest in
 * `app.signin_ref`, which `withSignInScope()` set. A `WHERE handle_digest = $1`
 * here would be a second answer to the question the policy already answers —
 * and `consumeSignInAttempt()`'s FIRST arm, `sign_in_attempt_handle_mismatch`,
 * would become unreachable, because the SQL would have filtered out exactly
 * the row that arm exists to refuse. **An unreachable refusal is a control
 * that cannot be witnessed** — §5.6.
 */
const ATTEMPT_READ = `
  SELECT id, handle_digest, connection_id, challenge_digest,
         started_at, expires_at, consumed_at, begun_host
    FROM tenant.sign_in_attempt
`

/**
 * THE CONSUMING WRITE. One column, no `WHERE`, and both absences are controls.
 *
 * 🛑 `SET consumed_at = now()` AND NOTHING ELSE, because `GRANT UPDATE
 * (consumed_at)` is all the app role holds — `db/migrations/0013_federated_signin.sql`.
 * A statement that tried to touch `connection_id` would be refused by the
 * database, not by review, which is the point of a column-level grant.
 *
 * ⚠️ `WHERE consumed_at IS NULL` IS **DELIBERATELY ABSENT**, AND THE REASON IS
 * THE OPPOSITE OF THE ONE IN `server/data-plane/session.ts`. There, `WHERE
 * revoked_at IS NULL` protects a recorded TIME from being moved. Here the
 * replay check has already been made by `consumeSignInAttempt()` — by name,
 * with `sign_in_attempt_replayed` as the answer — so a predicate would decide
 * the same question twice, and the SQL's answer would be silent. The row count
 * is checked instead, which turns a disagreement between the two into
 * `sign_in_attempt_not_consumed` rather than into nothing.
 */
const ATTEMPT_CONSUME = 'UPDATE tenant.sign_in_attempt SET consumed_at = now()'

/**
 * THE MINT TRANSACTION'S READ OF THE ATTEMPT — `ATTEMPT_READ` PLUS A ROW LOCK.
 * G2495, closed 1 Oct 2026 (G2547).
 *
 * 🛑 THE DEFECT, MEASURED BEFORE IT WAS CLOSED: two callbacks for ONE `state`
 * carrying two DIFFERENT codes each read the attempt UNCONSUMED, each passed
 * `consumeSignInAttempt()`, and each consumed it — the second `UPDATE` waited
 * on the first's row lock and then wrote anyway, because `ATTEMPT_CONSUME`
 * deliberately has no `WHERE consumed_at IS NULL` (argued above). Two
 * sessions minted from one attempt. `tests/http/federated-signin-served.test.ts`
 * §17 holds the attempt's row lock from a third connection, fires both
 * callbacks, waits until BOTH are parked on it, releases — and went RED with
 * two `303`s before this lock was taken.
 *
 * ⚠️ `FOR UPDATE` ON THE READ, AND NOT THE `WHERE` ON THE WRITE, FOR THE
 * REASON THE PARAGRAPH ABOVE GIVES: the replay question has ONE answer, the
 * model's, by name. With the lock, the second transaction cannot READ until
 * the first commits, and under READ COMMITTED it then reads the row AS
 * CONSUMED — so `consumeSignInAttempt()` answers `sign_in_attempt_replayed`,
 * the named refusal, rather than a predicate answering silently.
 *
 * ⚠️ A SEPARATE CONSTANT, BECAUSE `readPinnedSignIn()` READS THE SAME ROW IN A
 * `BEGIN READ ONLY` TRANSACTION, WHERE `FOR UPDATE` IS REFUSED BY THE SERVER
 * (`cannot execute SELECT FOR UPDATE in a read-only transaction`). The pin read
 * decides nothing durable; the mint read is the one the lock must sit on.
 * `GRANT UPDATE (consumed_at)` (0013) is the privilege `FOR UPDATE` needs.
 */
const ATTEMPT_READ_FOR_CONSUME = `${ATTEMPT_READ} FOR UPDATE`

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value)
}

function isoOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : iso(value)
}

/**
 * ⚠️ ONE CAST, AT ONE SEAM, AND IT IS A CAST OF SHAPE RATHER THAN OF MEANING —
 * the same sentence `rowToSession()` carries one file over, for the same
 * reason: every branded id is `text` under G97 and stored verbatim, so there
 * is nothing to parse and nothing that could be wrong except the column NAMES,
 * which the statement above pins.
 */
function rowToAttempt(row: Record<string, unknown>): SignInAttempt {
  return {
    id: String(row['id']) as SignInAttemptId,
    handleDigest: String(row['handle_digest']) as SessionHandleDigest,
    connectionId: String(row['connection_id']) as IdentityConnectionId,
    challengeDigest: String(row['challenge_digest']) as SessionHandleDigest,
    startedAt: iso(row['started_at']),
    expiresAt: iso(row['expires_at']),
    /* 🛑 READ FROM THE COLUMN, NEVER WRITTEN AS `null`. `session.ts` records
     * what a hard-coded `null` costs on exactly this shape: *"A hard-coded
     * field is a `WHERE` clause that survives the deletion of the `WHERE`
     * clause"* — and here the casualty would be
     * `sign_in_attempt_replayed`, the single arm this whole slice exists to
     * make reachable. */
    consumedAt: isoOrNull(row['consumed_at']),
  } as SignInAttempt
}

/**
 * Read the attempt, consume it, resolve the door, and require the two doors to
 * agree — all inside the caller's ONE transaction.
 *
 * 🛑 IT TAKES A `ScopedClient` AND NOT A POOL, AND THAT IS THE ATOMICITY
 * REQUIREMENT IN THE SIGNATURE. `docs/contracts/session.openapi.yaml`:
 * *"`consumedAt` is set in the same transaction that mints the `Session`."*
 * A function that opened its own transaction could not be inside the caller's,
 * so the consume would commit whether or not the mint did — and an attempt
 * consumed against a session that was never minted is a person locked out,
 * while the reverse is a replay. Taking the transaction is what makes both
 * impossible. The caller opens it with `withSignInScope()`.
 *
 * ⚠️ THE ORDER OF THE FOUR STEPS IS ARGUED IN THE HEADER (G344) AND IS NOT
 * FREE TO CHANGE: read the attempt, decide with the model, consume, then
 * compare the doors. Consuming before the model decides would burn an attempt
 * on a malformed callback; comparing the doors before consuming would report a
 * caller's tampering in preference to a replay.
 */
export async function assembleSignIn(
  tx: ScopedClient,
  callback: FederatedCallback,
): Promise<SignInAssembly> {
  const rows = (await tx.query(ATTEMPT_READ_FOR_CONSUME)).rows as Array<Record<string, unknown>>
  const only = rows[0]
  /* ⚠️ `!== 1` FOR `handle_digest`'s OWN UNIQUE CONSTRAINT. More than one row
   * visible here would mean that constraint had been dropped, and consuming
   * the first of them would leave a second, unconsumed, addressable by the
   * same digest — a single-use property with a spare. */
  if (only === undefined || rows.length !== 1) {
    return { ok: false, kind: 'signin', refusal: SIGN_IN_REFUSALS.signInAttemptAbsent }
  }

  const attempt = rowToAttempt(only)

  const consumption = consumeSignInAttempt(attempt, callback)
  if (!consumption.ok) {
    return { ok: false, kind: 'attempt', refusal: consumption.refusal }
  }

  const written = await tx.query(ATTEMPT_CONSUME)
  if (written.rowCount !== 1) {
    return { ok: false, kind: 'signin', refusal: SIGN_IN_REFUSALS.signInAttemptNotConsumed }
  }

  /**
   * 🛑 THE BROKER HANDLE IS NOT A PARAMETER OF THIS FUNCTION, AND THAT IS THE
   * FENCE RATHER THAN AN OVERSIGHT. It was set on the SCOPE, by
   * `withSignInScope()`, before this transaction ran a statement — so there is
   * no value here for a body to influence and no argument for a call site to
   * pass wrongly. `readConnectionByBrokerHandle()` adds no predicate; the
   * policy is the whole narrowing.
   */
  const door = await readConnectionByBrokerHandle(tx)
  if (!door.ok) return { ok: false, kind: 'substrate', refusal: door.refusal }

  /* G344. See the header. Compared by id, on the row the redirect pinned. */
  if (door.connection.id !== consumption.connectionId) {
    return { ok: false, kind: 'signin', refusal: SIGN_IN_REFUSALS.signInDoorDisagrees }
  }

  /**
   * ⚠️ A NON-BROKERED DOOR CANNOT REACH THIS LINE AND THE PROOF IS THE POLICY
   * RATHER THAN A CHECK HERE. `identity_connection_signin_rls` matches on
   * `broker_issuer` AND `broker_ref`, both of which are NULL on a
   * `cognito_pool` row (G305), and `NULL = <anything>` is NULL. So a
   * non-brokered connection is invisible in this scope and answers
   * `connection_absent` above. Writing `if (connection.federation === null)`
   * here would be a second, weaker statement of a property the database
   * already holds — and it would read as though the database did not.
   *
   * ⚠️ **THE LAST SENTENCE IS CORRECTED RATHER THAN DELETED — D6-5, 1 Oct
   * 2026.** The first half still holds: the policy is the proof, and the
   * refusal below is unreachable through it. What changed is that this line
   * now has to PRODUCE the issuer a token is verified against, and a value
   * typed `string | null` cannot become one without an answer for `null`. The
   * only other answer is a default, and the only default to hand is the
   * token's own `iss` — the alternative the owner refused by name. So the
   * check is written, and it is a NAMED refusal rather than a restatement of
   * the policy: it decides what happens if the policy ever moves.
   */
  const brokerIssuer = pinnedIssuerOf(door)
  if (brokerIssuer === null) {
    return { ok: false, kind: 'signin', refusal: SIGN_IN_REFUSALS.signInDoorNotBrokered }
  }
  return {
    ok: true,
    connection: door.connection,
    attemptId: attempt.id,
    consumption,
    brokerIssuer,
  }
}

/**
 * THE ONE PLACE A DOOR BECOMES A PINNED ISSUER — and it is a function rather
 * than an inline call since S6 (G2482), because the callback now needs the
 * issuer TWICE: once in the PIN transaction, where the token is about to be
 * verified against it, and once in the MINT transaction, where G344 proves
 * the handle's door and the pinned door are one row.
 *
 * 🛑 IT IS STILL ONE CALL OF `pinnedBrokerIssuer()` IN `server/`, ON
 * `door.connection`, WHICH IS EXACTLY WHAT `tests/http/pinned-issuer.test.ts`
 * §3 READS OFF THE AST — and that is not the census being satisfied by a
 * wrapper. Both callers hand it a row a POLICY chose and no caller named: the
 * pin read's row is the one `0280` admits by the attempt's own
 * `connection_id`; the mint read's is the one G344 has just proved equal to
 * it. A third caller would have to construct a `{ connection }` out of
 * something else, and the review that sees it is the review this function is
 * for.
 */
function pinnedIssuerOf(door: { readonly connection: IdentityConnection }): PinnedBrokerIssuer | null {
  return pinnedBrokerIssuer(door.connection)
}

/* ==================================================================== *
 * THE PIN READ — S6, G2235 APPLIED (G2481–G2484)
 * ==================================================================== */

/**
 * The door's token endpoint, read with NO `WHERE` — the policy is the whole
 * narrowing, as for every read in this plane. In the pin scope exactly one
 * row is visible: the one `0280` admits.
 */
const TOKEN_ENDPOINT_READ =
  'SELECT token_endpoint, email_claim, name_claim FROM tenant.identity_connection'

/** What the callback knows before it may spend a network round trip. */
export type PinnedSignIn =
  | {
      readonly ok: true
      readonly attempt: SignInAttempt
      /** The door the REDIRECT pinned, admitted by `0280` and by nothing the caller sent. */
      readonly connection: IdentityConnection
      /** Read off that row. D6-5. */
      readonly brokerIssuer: PinnedBrokerIssuer
      /** Read off that row. G2235: the mint scope's pair, and never the body's. */
      readonly brokerRef: string
      /** Read off that row. G2443: the ONLY destination a code may be sent to. `null` is refused downstream. */
      readonly tokenEndpoint: string | null
      /**
       * R6's claim NAMES, off the same row — the only names the verified
       * payload is projected through (`completeCodeExchange()`'s
       * `projectClaims`). Empty when the door declares none, which
       * `projectPerson()` refuses by name on a first sign-in.
       */
      readonly claimNames: readonly string[]
      /**
       * G2549 / `0360` — the host the attempt was BEGUN on, read off the row.
       * `null` for an attempt begun before `0360`, which the completion
       * refuses (`checkHandOffPresentation()`).
       */
      readonly begunHost: string | null
    }
  | Exclude<SignInAssembly, { readonly ok: true }>

/**
 * Read the attempt the `state` names and the door it PINNED — inside
 * `withSignInPinScope()`, READ ONLY, and BEFORE any code is exchanged.
 *
 * 🛑 THIS IS G2235 CLOSED, AND THE PROPERTY IS IN THE SIGNATURE: the function
 * takes a transaction and the callback's two non-secret facts, and there is no
 * parameter through which a broker pair could arrive. The pair the mint
 * transaction is scoped by is RETURNED from here, off the row.
 *
 * ⚠️ IT ASKS THE MODEL FIRST, WITH THE PINNED CHALLENGE STANDING IN FOR THE
 * ONE IT DOES NOT HAVE YET — AND SAYS SO. `consumeSignInAttempt()` is the one
 * decision; restating its replay and door arms here would be §5.3. Its
 * challenge arm cannot be judged yet, because the challenge a callback is
 * checked against is now the VERIFIED TOKEN'S `nonce` (the mint transaction
 * supplies it), so this pre-decision passes the attempt's own value and that
 * one arm is a tautology HERE and a real comparison THERE. **What the
 * pre-decision buys is that a replayed or re-pointed callback is refused
 * before it can make this plane send anything to anybody.** Nothing is
 * consumed: the mint transaction decides again, on a row it reads afresh.
 */
export async function readPinnedSignIn(
  tx: ScopedClient,
  callback: Pick<FederatedCallback, 'handleDigest' | 'connectionId'>,
): Promise<PinnedSignIn> {
  const rows = (await tx.query(ATTEMPT_READ)).rows as Array<Record<string, unknown>>
  const only = rows[0]
  if (only === undefined || rows.length !== 1) {
    return { ok: false, kind: 'signin', refusal: SIGN_IN_REFUSALS.signInAttemptAbsent }
  }
  const attempt = rowToAttempt(only)

  const pre = consumeSignInAttempt(attempt, {
    handleDigest: callback.handleDigest,
    connectionId: callback.connectionId,
    challengeDigest: attempt.challengeDigest,
  })
  if (!pre.ok) return { ok: false, kind: 'attempt', refusal: pre.refusal }

  /* No predicate: `0280`'s policy admits the pinned row and only it, because
   * no broker GUC, no session and no claimed domain is set in this scope. */
  const door = await readConnectionByBrokerHandle(tx)
  if (!door.ok) return { ok: false, kind: 'substrate', refusal: door.refusal }
  /* Asserted rather than trusted, `personDoorDisagrees`'s reason: this is
   * the row every later decision is about. */
  if (door.connection.id !== attempt.connectionId) {
    return { ok: false, kind: 'signin', refusal: SIGN_IN_REFUSALS.signInDoorDisagrees }
  }
  if (door.connection.status !== 'active') {
    return { ok: false, kind: 'signin', refusal: SIGN_IN_REFUSALS.signInDoorDisabled }
  }

  const brokerIssuer = pinnedIssuerOf(door)
  const federation = door.connection.federation
  if (brokerIssuer === null || federation === null) {
    return { ok: false, kind: 'signin', refusal: SIGN_IN_REFUSALS.signInDoorNotBrokered }
  }

  const begunHost = only['begun_host']
  const endpoints = (await tx.query(TOKEN_ENDPOINT_READ)).rows as Array<Record<string, unknown>>
  const row = endpoints.length === 1 ? endpoints[0] : undefined
  const raw = row?.['token_endpoint']
  const claimNames = [row?.['email_claim'], row?.['name_claim']].filter(
    (n): n is string => typeof n === 'string' && n !== '',
  )
  return {
    ok: true,
    attempt,
    connection: door.connection,
    brokerIssuer,
    brokerRef: federation.brokerRef,
    tokenEndpoint: typeof raw === 'string' && raw !== '' ? raw : null,
    claimNames,
    begunHost: typeof begunHost === 'string' && begunHost !== '' ? begunHost : null,
  }
}

/* ==================================================================== *
 * THE HAND-OFF READ — G2549 (the shared return host's relay)
 * ==================================================================== */

/**
 * The three hand-off facts of the attempt the `state` addresses, inside
 * `withSignInPinScope()` — READ ONLY, keyed on the state's digest by the
 * POLICY and by nothing else (no `WHERE`, `ATTEMPT_READ`'s reason). An
 * expired attempt is invisible under `0240`, so it reads as absent.
 *
 * Returns `null` when no row (or more than one) is visible.
 */
export async function readHandOff(tx: ScopedClient): Promise<SignInHandOff | null> {
  const rows = (await tx.query(ATTEMPT_READ)).rows as Array<Record<string, unknown>>
  const only = rows[0]
  if (only === undefined || rows.length !== 1) return null
  const host = only['begun_host']
  return {
    begunHost: typeof host === 'string' ? host : '',
    expiresAt: iso(only['expires_at']),
    consumedAt: isoOrNull(only['consumed_at']),
  }
}

/**
 * ⚠️ NO `SUBSTRATE_REFUSALS` VALUE IS CONSTRUCTED IN THIS FILE, AND THE IMPORT
 * IS A TYPE-LEVEL ANCHOR RATHER THAN DEAD WEIGHT: it keeps the union this
 * module carries tied to `identity.ts`'s declaration, so a member added there
 * widens `SignInAssembly` and a caller that switched exhaustively goes red.
 * `noUnusedLocals` is on, so it has to be referenced to say so.
 */
export const SIGN_IN_SUBSTRATE_REFUSALS: Readonly<typeof SUBSTRATE_REFUSALS> = SUBSTRATE_REFUSALS
