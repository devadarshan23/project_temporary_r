/**
 * THE SESSION MINT WRITER — W3-S3, G1637–G1640, 21 Sep 2026.
 *
 * ✅ **REACHED BY A ROUTE SINCE 1 Oct 2026 — S6, G2490 — AND THE BANNER BELOW
 * IS KEPT AS THE HISTORY IT IS.** `completeFederatedSignIn` is mounted
 * (`server/data-plane/federated-signin.ts`) and calls this writer with a
 * VERIFIED token's subject, the broker pair read off the PINNED row (G2235),
 * and the verified nonce's digest as the challenge (G2487). ⚠️ **AND ONE OF ITS
 * OWN CLAIMS WAS FALSE AND IS REPAIRED (G2489)**: the header's *"One `ROLLBACK`
 * removes the person, the consumption and the session together"* did not hold
 * for a refusal RETURNED after a write — see `RefusedAfterWrite`.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS MODULE IS REACHED BY NO ROUTE AND THAT IS DELIBERATE. READ THIS
 *    BEFORE READING AN UNROUTED WRITER AS A BUG.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `completeFederatedSignIn` is declared on `docs/contracts/session.openapi.yaml`
 * and is **MOUNTED NOWHERE**, and mounting it is **not this slice's to do**:
 * `docs/build/completion-plan.md` §5 W3 puts it at S6, behind **R1 — the D6
 * threat model — which is an OPEN OWNER'S RULING.** These would be the
 * product's first public UNAUTHENTICATED endpoints, and a slice that mounted
 * them would be taking that ruling by writing code.
 *
 * So the only caller is `tests/`. That is `server/control-plane/roster-store.ts`'s
 * shape one directory over, `server/data-plane/definition-store.ts`'s in this
 * one, and `0007`'s precedent for proving a surface without a route — *"a
 * column with no reader is a column nothing checks"*, inverted: a writer with
 * no route is still a writer whose fences can be witnessed. Derive the served
 * set, never read it: `node tools/served-set.mjs` → 30 of 136, by tier.
 * ⚠️ A RECURSIVE GREP FOR THE HANDLER KEY STOOD HERE, WITH ITS SLASHES WRITTEN
 * AS HTML ENTITIES TO SURVIVE A BLOCK COMMENT — G2081, 23 Sep 2026. The escape
 * made the command uncopyable and left this header inside the scope of the
 * unescaped form, which counted it.
 *
 * ⚠️ AND WHAT IT CANNOT DO EVEN WHEN MOUNTED, NAMED SO NOBODY READS "the mint
 *    is built" AS "sign-in works": **nothing calls this with a real token.**
 *    S4 (the verification terms resolver — where a JWKS comes from) is blocked
 *    on **R2**, and S5 (the regional auth host, which is what would perform the
 *    code exchange and write the `sign_in_attempt` row) is blocked on **R3**.
 *    `db/migrations/0013` grants the app role no `INSERT` on that table, so
 *    **an attempt row is written by the migrator, in a test, and by nothing
 *    else.** `verifyIdentityToken()` exists (G976) and produces the claims this
 *    module consumes; nothing joins the two.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 INVARIANT 1 IS THE WHOLE POINT, AND THE DEFENCE IS S2's TYPE RATHER THAN
 *    A CHECK IN THIS FILE.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Copy it, never paraphrase it — `CLAUDE.md`'s numbered eleven, 1:
 *
 *     "Tenant scope is derived from the session, never read from a request."
 *
 * G315 puts the tenant in the OIDC `state` **deliberately**, as a routing fact
 * for the 302. This module is the next thing after the auth host to hold that
 * state, and if it carried the tenant forward into the row, **tenant scope
 * would become a thing conferred by authentication with a ruling apparently
 * endorsing it.**
 *
 * `MintSessionInput` has **no `tenantId` field at all — absent, not `null`** —
 * so passing one is a `tsc` error. ⚠️ **AND THE KEY CHECK ALONE WOULD NOT HAVE
 * STOPPED IT, WHICH S2 MEASURED**: excess-property checking is a check on
 * LITERALS, so a writer that spread a wider object would pass a `tenantId` with
 * no error at all. What stops it is that `MintedSessionFacts` is an `Omit` and
 * has **nowhere to put one** — so the value is discarded rather than stored,
 * and `MINT_SQL` below binds `NULL` as a LITERAL rather than from any variable.
 * **This module is the first real caller, and that is where S2's third control
 * stops being theoretical.**
 *
 * 🛑 AND THE DATABASE REFUSES IT INDEPENDENTLY — W3-S0 measured it.
 * `session_selection_restrictive`'s membership subquery reads `tenant.membership`
 * under `membership_rls`, `withSignInScope()` sets no `app.tenant_id` and must
 * never set one, so the `EXISTS` is empty and the only disjunct left standing
 * is `tenant_id IS NULL`. A tenantful mint is refused with that policy NAMED.
 * Three independent controls, none of them a review comment.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 ONE TRANSACTION, BECAUSE THE ATOMICITY **IS** THE SINGLE-USE PROPERTY
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `docs/contracts/session.openapi.yaml` requires the attempt to be consumed
 * *"in the same transaction that mints the `Session`"*, and G315 names the
 * failure: *"a replayable `state` or a reusable grant would hand the whole flow
 * away."* Two transactions is a window between reading an unconsumed attempt
 * and writing `consumed_at`, and a window is a replay.
 *
 * **The PERSON is inside that transaction too, and that is G1637.** R5
 * auto-provisions on first sign-in; provisioning in its own transaction would
 * leave a person minted for a sign-in that then failed — a directory that grows
 * by one row per abandoned callback, each of them a real `tenant."user"` row
 * that `resolveSubject()` would happily resolve if anybody ever got a handle to
 * it. One `ROLLBACK` removes the person, the consumption and the session
 * together or leaves all three.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 `orgClass` IS NEVER CONFERRED BY THE TOKEN, AND THIS FILE NEVER COMPUTES
 *    ONE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `0009`'s rule: organisation comes from `orgFor(connection.owner)` and from
 * nowhere else, and `tests/db/identity-substrate.test.ts` §6b asserts that a
 * partner and a customer may share a broker. So a provisioned person inherits
 * the DOOR, and the door is the one `withSignInScope()` named — held by
 * `db/migrations/0200` §6's restrictive policy and §2's composite foreign key,
 * **not by this module**. Nothing below reads a claim called `tenant`, `org` or
 * `tid`; `projectPerson()` returns two strings and `AssertNoTenantDeep` is what
 * keeps it to two.
 *
 * ⚠️ AND THE CLAIM MAP STOPS HERE. It is read as two bare strings, applied, and
 * discarded — it reaches no model type, so no claim name can travel to
 * `orgFor()`, `decide()` or any authorisation surface.
 *
 * Compiles under: tsc -p server/tsconfig.json --noEmit
 */

import type { ScopedClient, TenantPool } from '../../db/tenant-scope.ts'
import { withSignInScope } from '../../db/signin-scope.ts'
import type {
  FederatedCallback,
  SessionHandleDigest,
  User,
} from '../../model/domain.ts'
import type { SessionId, UserId } from '../../model/kernel.ts'
import type { SessionBoundsInput } from '../../model/session.ts'
import {
  mintSession,
  projectPerson,
  type ConnectionClaimMap,
  type MintSessionRefusal,
  type ProjectPersonRefusal,
  type MintedSessionFacts,
} from '../../model/session-mint.ts'
import type { SessionBoundRefusal } from '../../model/session.ts'
import { assembleSignIn, type SignInAssembly } from './signin.ts'
import {
  mintPartnerRoleAssignmentId,
  redeemPartnerInvitation,
  type PartnerRedemptionOutcome,
} from './partner-redemption-store.ts'

/* ------------------------------------------------------------------ *
 * 1. What this seam is told, and the one thing it is NOT told
 * ------------------------------------------------------------------ */

/**
 * ⚠️ **THERE IS NO `tenantId` HERE AND THERE MUST NEVER BE ONE.** See the
 * header. `MintSessionInput` refuses it at the type level; this interface is
 * the layer above and would be the natural place for it to re-enter, because
 * the auth host's grant legitimately carries one as a ROUTING fact.
 *
 * 🛑 AND THERE IS NO `connectionId` EITHER, WHICH IS THE LESS OBVIOUS HALF.
 * The door is resolved from the broker pair BY THE DATABASE — a policy admits
 * exactly the row the pair names — so accepting one here would let a caller
 * name a door it had not arrived through, and `orgFor()` would then answer
 * about the wrong organisation. `assembleSignIn()` makes the same refusal for
 * the same reason and says so on its own face.
 */
export interface MintFederatedSessionInput {
  /** G304's pair. A LOOKUP KEY: it names a door and proves nothing. */
  readonly brokerIssuer: string
  readonly brokerRef: string
  /**
   * The digest of the relay/`state` parameter — NEVER the parameter, because a
   * value that reaches the database reaches a database dump.
   */
  readonly stateDigest: SessionHandleDigest
  /**
   * The person's external subject — an OIDC `sub`, read from the VERIFIED
   * token by the caller.
   *
   * 🛑 IT IS `sub` AND IS NOT CLAIM-MAPPED, and `db/migrations/0200` §4 argues
   * why at length. The half that belongs here: it is the sign-in scope's
   * LOOKUP KEY, so it has to be known before the transaction opens — a
   * claim-mapped subject could only be computed after reading the connection,
   * which is a statement inside that same transaction.
   */
  readonly externalSubject: string
  /** What the model checks the callback against. */
  readonly callback: FederatedCallback
  /**
   * The VERIFIED token's claims.
   *
   * ⚠️ `unknown` VALUES, DELIBERATELY. They are authentic and they are not
   * typed — a broker may emit a numeric `name` — and `projectPerson()` is the
   * one place that narrows them.
   */
  readonly claims: Readonly<Record<string, unknown>>
  /**
   * `VerifiedClaims.emailVerified` — whether the directory attests the
   * token's `email` claim (G2901). **REQUIRED, with no default**, so a caller
   * that forgets it is a `TS2741` rather than a person provisioned as
   * verified. It is STORED at provisioning (`addressIsVerified()`), and since
   * G2941 — the owner's, 2 Oct 2026 — it may also UPGRADE a stored `false` to
   * `true` on a later sign-in, and never the other way: see
   * `upgradeEmailVerified()`. ⚠️ This read *"It is STORED, never re-derived"*
   * and is corrected rather than deleted; it is still never DOWNGRADED.
   */
  readonly emailVerified: boolean
  /** The id a NEW person would be minted under, if one is minted. */
  readonly newUserId: UserId
  /** The new session's id and the digest of its handle. */
  readonly newSessionId: SessionId
  readonly newHandleDigest: SessionHandleDigest
  /** The host the session is issued on — G180 compares it every request. */
  readonly issuedHost: string
  /** G220's configuration; the model validates it and the SQL applies it. */
  readonly bounds: SessionBoundsInput
}

/* ------------------------------------------------------------------ *
 * 2. The closed outcome
 * ------------------------------------------------------------------ */

/**
 * ⚠️ FOUR REFUSAL VOCABULARIES, CARRIED SEPARATELY RATHER THAN FLATTENED, for
 * `server/data-plane/signin.ts`'s stated reason: each is owned by a different
 * layer and collapsing them is *"a fact about us reported as a fact about the
 * caller"*. `assembly` is the sign-in seam's three; `projection` is the DOOR's
 * configuration; `mint` is the model's; `store` is this file's.
 */
export const SESSION_MINT_STORE_REFUSALS = {
  /**
   * The person read back the subject named, and it is on another door.
   *
   * 🛑 UNREACHABLE THROUGH THE DATABASE AND ASSERTED ANYWAY. `user_signin_rls`
   * admits only a row whose broker pair equals the scope's, and §2's foreign
   * key makes that pair agree with `connection_id` — so a row visible here
   * cannot be on another door. **It is checked because the alternative is
   * trusting two migrations to keep being true**, and because this is the
   * value `orgFor()` is about to be asked about. `0039`'s reader makes the
   * same choice about `partnerId`.
   */
  personDoorDisagrees: 'person_door_disagrees',
  /**
   * The provisioning INSERT reported a row count it should not be able to.
   * Refused rather than ignored: a person a caller believes was minted and was
   * not is a session about to be minted against nobody.
   */
  personNotProvisioned: 'person_not_provisioned',
  /** Likewise for the session row itself. */
  sessionNotWritten: 'session_not_written',
} as const

export type SessionMintStoreRefusal =
  (typeof SESSION_MINT_STORE_REFUSALS)[keyof typeof SESSION_MINT_STORE_REFUSALS]

export type MintFederatedSessionOutcome =
  | {
      readonly ok: true
      readonly session: MintedSessionFacts
      /** Whether this callback CREATED the person. R5's observable half. */
      readonly provisioned: boolean
      /**
       * Whether this sign-in UPGRADED an existing person's stored
       * `email_verified` from `false` to `true` — G2941, the owner's. Always
       * `false` for a person this callback provisioned: their fact was
       * written once, at the INSERT.
       */
      readonly emailUpgraded: boolean
      /**
       * WHAT HAPPENED TO A PARTNER INVITATION ON THIS SIGN-IN — G2801, the
       * owner's, as WIDENED by G2906, the owner's of 2 Oct 2026: *"Any
       * sign-in: open, unexpired invitations matching the VERIFIED email
       * redeem at the person's next sign-in (not only first), with the same
       * fences."* Never `null` any more: every mint asks. ⚠️ This read *"`null`
       * when the person already existed: the ruling names FIRST sign-in, and
       * the existing-person case is G2810's, named and not taken"* and is
       * corrected rather than deleted. A `refused` redemption is NOT a refused
       * sign-in — see `partner-redemption-store.ts`.
       */
      readonly redemption: PartnerRedemptionOutcome
    }
  | { readonly ok: false; readonly kind: 'assembly'; readonly assembly: SignInAssembly }
  | { readonly ok: false; readonly kind: 'projection'; readonly refusal: ProjectPersonRefusal }
  | {
      readonly ok: false
      readonly kind: 'mint'
      readonly refusal: MintSessionRefusal
      readonly boundRefusals?: readonly [SessionBoundRefusal, ...SessionBoundRefusal[]]
    }
  | { readonly ok: false; readonly kind: 'store'; readonly refusal: SessionMintStoreRefusal }

/* ------------------------------------------------------------------ *
 * 3. The statements — every one with an EMPTY `WHERE`
 * ------------------------------------------------------------------ */

/**
 * 🛑 THE CLAIM MAP, READ WITH NO `WHERE`, AND THE ABSENCE IS THE CONTROL.
 * `identity_connection_signin_rls` admits exactly the door the broker pair
 * names, so a predicate here would be a SECOND narrowing that could disagree
 * with the policy — and the one that drifts is always the copy.
 * `readConnectionByBrokerHandle()` states the same rule one file over:
 * *"adds no predicate; the policy is the whole narrowing."*
 */
const CLAIM_MAP_READ = `SELECT email_claim, name_claim FROM tenant.identity_connection`

/**
 * 🛑 THE PERSON, READ WITH NO `WHERE` EITHER — AND HERE IT IS SHARPER.
 * `user_signin_rls` requires `external_subject` = `app.external_subject` AND
 * the broker pair = the scope's, so this returns AT MOST ONE row and it is the
 * person the scope named. **Each predicate somebody would add deletes a
 * control**: `WHERE external_subject = $1` would make the subject a value this
 * statement chose rather than one the scope declared, and would still be
 * satisfied if the policy were dropped.
 */
const PERSON_READ = `
  SELECT id, email, display_name, status, connection_id, email_verified
    FROM tenant."user"
`

/**
 * THE UPGRADE — G2941, THE OWNER'S RULING OF 2 Oct 2026: *"Yes, upgrade-only:
 * a column-level UPDATE that only ever sets tenant."user".email_verified
 * false→true, only inside a sign-in scope, only from a verified token for that
 * same subject."*
 *
 * 🛑 NO `WHERE id = …`, FOR `PERSON_READ`'s REASON: the sign-in scope's policy
 * makes the person the scope named the only row this statement can see, and
 * `0241`'s `WITH CHECK` refuses any other (`db/migrations/0400` term (3)).
 *
 * ⚠️ THE TWO PREDICATES THAT ARE THERE ARE NOT SCOPE, THEY ARE NO-OP AVOIDANCE:
 * `email_verified = false` because the trigger refuses a `true → true`
 * rewrite, and the address comparison because a token proving a DIFFERENT
 * address than the stored one proves nothing about the stored one (G2944) —
 * the trigger would refuse it and abort the sign-in, so the statement matches
 * 0 rows instead and the person signs in unupgraded. **The trigger, not this
 * `WHERE`, is the enforcement**: `tests/db/email-verified-upgrade.test.ts`
 * issues the statement without either predicate and watches it refused.
 */
const PROVED_EMAIL_SET = `SELECT set_config('app.proved_email', $1, true)`
const PERSON_UPGRADE = `
  UPDATE tenant."user"
     SET email_verified = true
   WHERE email_verified = false
     AND lower(email) = lower(current_setting('app.proved_email', true))
`

/**
 * ⚠️ THE BROKER PAIR IS WRITTEN AS WELL AS THE DOOR, AND IT IS NOT REDUNDANT:
 * `db/migrations/0200` §2's composite FOREIGN KEY is what makes the two agree,
 * and §6's policy tests the PAIR. A row written without it fails the policy —
 * measured, not assumed.
 */
const PERSON_INSERT = `
  INSERT INTO tenant."user"
    (id, email, display_name, status, connection_id, external_subject,
     broker_issuer, broker_ref, email_verified)
  VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, $8)
`

/**
 * WHETHER THE ADDRESS THIS DOOR PROJECTED IS ONE THE DIRECTORY PROVED —
 * G2901/G2902, closing G2816.
 *
 * 🛑 TWO TERMS AND THE SECOND IS THE ONE A READER SKIPS. `email_verified`
 * attests the token's `email` claim and NOTHING ELSE (OIDC Core §5.1). A door
 * whose `email_claim` is `upn`, `preferred_username` or a custom attribute
 * projects an address the flag says nothing about, so it is stored UNVERIFIED
 * whatever the flag reads — the fail-closed direction, because the only act
 * that keys on the stored address (`0370`'s redemption, fenced again by
 * `0390` §2) confers a role.
 *
 * ⚠️ WHAT IS STORED IS BOTH, DELIBERATELY (G2902): the address AND the fact.
 * The address is the person's display attribute and the roster publishes it,
 * so dropping an unverified one would turn a directory's configuration choice
 * into a person with no address. Storing it without the fact is what made
 * G2816 possible: every later reader would take the column as proved.
 */
const EMAIL_VERIFIED_ATTESTS = 'email'

function addressIsVerified(map: ConnectionClaimMap, emailVerified: boolean): boolean {
  return emailVerified && map.emailClaim === EMAIL_VERIFIED_ATTESTS
}

/**
 * 🛑 `tenant_id` IS THE LITERAL `NULL` AND IS BOUND FROM NOTHING. There is no
 * `$n` for it and no variable in this module that could supply one — see the
 * header. **A future edit that made it a bind parameter would have to write
 * the placeholder**, which is a visible act rather than a value that quietly
 * stops being null.
 *
 * ⚠️ AND `expires_at` IS COMPUTED BY THE DATABASE'S CLOCK. `model/session-mint.ts`
 * reads none — `Timestamp` is a string alias and G111's codec is not started —
 * so it hands the writer the VALIDATED seconds and the arithmetic happens on
 * the `timestamptz` column, by the one clock every policy in `db/migrations/`
 * already compares against.
 */
const SESSION_INSERT = `
  INSERT INTO tenant.session
    (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
     authenticated_at, last_used_at, expires_at, revoked_at)
  VALUES ($1, $2, $3, $4, NULL, $5,
          now(), now(), now() + ($6 || ' seconds')::interval, NULL)
`

/* ------------------------------------------------------------------ *
 * 4. The writer
 * ------------------------------------------------------------------ */

function claimMapFrom(row: Record<string, unknown>): ConnectionClaimMap {
  const email = row['email_claim']
  const name = row['name_claim']
  return {
    emailClaim: typeof email === 'string' && email !== '' ? email : null,
    nameClaim: typeof name === 'string' && name !== '' ? name : null,
  }
}

/**
 * Find or provision the person the scope names, then hand back the three
 * fields the mint consumes.
 *
 * ⚠️ IT RETURNS `Pick<User, …>` AND NOT A WHOLE `User`, because that is what
 * `MintSessionInput.user` asks for and a reader that assembled a whole `User`
 * would be fabricating the two fields the mint does not consume on the
 * find-existing path.
 */
/**
 * The address a verified token PROVES, or `null` — G2941.
 *
 * Both of `addressIsVerified()`'s terms, and the claim the door projects
 * `email` from. ⚠️ It does NOT call `projectPerson()`: that also demands the
 * NAME claim, and a missing display name is no reason to refuse proof of an
 * address. The narrowing it does repeat is the one that matters — a
 * non-string or empty claim proves nothing.
 */
function provedAddress(
  map: ConnectionClaimMap,
  claims: Readonly<Record<string, unknown>>,
  emailVerified: boolean,
): string | null {
  if (!addressIsVerified(map, emailVerified) || map.emailClaim === null) return null
  const raw = claims[map.emailClaim]
  return typeof raw === 'string' && raw !== '' ? raw : null
}

/**
 * Upgrade an existing person's `email_verified`, if — and only if — this
 * sign-in's token proves the stored address. Returns whether a row moved.
 *
 * ⚠️ THE GUC IS CLEARED AFTERWARDS, so nothing later in the mint transaction
 * runs with a proof in scope it did not ask for.
 */
async function upgradeEmailVerified(
  tx: ScopedClient,
  input: MintFederatedSessionInput,
): Promise<boolean> {
  if (!input.emailVerified) return false
  const doors = (await tx.query(CLAIM_MAP_READ)).rows as Array<Record<string, unknown>>
  const doorRow = doors[0]
  if (doorRow === undefined || doors.length !== 1) return false
  const address = provedAddress(claimMapFrom(doorRow), input.claims, input.emailVerified)
  if (address === null) return false

  await tx.query(PROVED_EMAIL_SET, [address])
  try {
    const moved = await tx.query(PERSON_UPGRADE)
    return moved.rowCount === 1
  } finally {
    await tx.query(PROVED_EMAIL_SET, [''])
  }
}

async function findOrProvisionPerson(
  tx: ScopedClient,
  input: MintFederatedSessionInput,
  connectionId: string,
): Promise<
  | {
      ok: true
      user: Pick<User, 'id' | 'status' | 'connectionId'>
      provisioned: boolean
      emailUpgraded: boolean
    }
  | { ok: false; refusal: SessionMintStoreRefusal | ProjectPersonRefusal; kind: 'store' | 'projection' }
> {
  const existing = (await tx.query(PERSON_READ)).rows as Array<Record<string, unknown>>
  const only = existing[0]

  if (only !== undefined) {
    /* See `personDoorDisagrees`: unreachable through the policy and the FK, and
     * asserted because this is the value `orgFor()` is about to read. */
    if (only['connection_id'] !== connectionId) {
      return { ok: false, kind: 'store', refusal: SESSION_MINT_STORE_REFUSALS.personDoorDisagrees }
    }
    /* G2941 — BEFORE redemption, in the same transaction, so `0390` §2's
     * fence reads the upgraded fact. A disabled person is NOT upgraded: the
     * mint refuses them below and the rollback would undo it anyway, but a
     * write ahead of a refusal is a write nobody needed. */
    const emailUpgraded =
      only['email_verified'] !== true && only['status'] !== 'disabled'
        ? await upgradeEmailVerified(tx, input)
        : false
    return {
      ok: true,
      provisioned: false,
      emailUpgraded,
      user: {
        id: only['id'] as UserId,
        status: only['status'] === 'disabled' ? 'disabled' : 'active',
        connectionId: only['connection_id'] as User['connectionId'],
      },
    }
  }

  /* R5 — AUTO-PROVISION. The claim map is read only on this path, because a
   * person who already exists needs no projection and re-projecting one is an
   * `UPDATE` nobody holds (0200 §7). */
  const doors = (await tx.query(CLAIM_MAP_READ)).rows as Array<Record<string, unknown>>
  const doorRow = doors[0]
  if (doorRow === undefined || doors.length !== 1) {
    return {
      ok: false,
      kind: 'projection',
      refusal: 'connection_claim_map_absent',
    }
  }

  const claimMap = claimMapFrom(doorRow)
  const projected = projectPerson(claimMap, input.claims)
  if (!projected.ok) {
    return { ok: false, kind: 'projection', refusal: projected.refusal }
  }

  const written = await tx.query(PERSON_INSERT, [
    input.newUserId,
    projected.person.email,
    projected.person.displayName,
    connectionId,
    input.externalSubject,
    input.brokerIssuer,
    input.brokerRef,
    addressIsVerified(claimMap, input.emailVerified),
  ])
  if (written.rowCount !== 1) {
    return { ok: false, kind: 'store', refusal: SESSION_MINT_STORE_REFUSALS.personNotProvisioned }
  }

  return {
    ok: true,
    provisioned: true,
    emailUpgraded: false,
    /* `'active'` is STATED and not read back: `PERSON_INSERT` writes the
     * literal, and reading the row again to learn what we just wrote would be
     * a second answer to a settled question. */
    user: {
      id: input.newUserId,
      status: 'active',
      connectionId: connectionId as User['connectionId'],
    },
  }
}

/**
 * Consume the attempt, find or provision the person, and mint the session —
 * in ONE transaction, on the tenant host, with no tenant anywhere in it.
 *
 * 🛑 IT OPENS THE SCOPE ITSELF, UNLIKE `assembleSignIn()`, AND THAT IS THE
 * DIFFERENCE BETWEEN A STEP AND THE ACT. That function takes a `ScopedClient`
 * precisely so it can be inside somebody else's transaction; this IS that
 * somebody. The scope declares `externalSubject` and `sessionRef`, and
 * `db/signin-scope.ts` calls each of those *"the visible act of becoming a
 * writer"* — a caller that omits either cannot touch a person or a session at
 * all, by policy rather than by branch.
 */
/**
 * A refusal decided AFTER this transaction wrote something, carried out of
 * the scope as a throw so the scope ROLLS BACK — S6, G2489.
 *
 * 🛑 THE DEFECT IT CLOSES WAS ON THIS FILE'S OWN FACE. The header says *"One
 * `ROLLBACK` removes the person, the consumption and the session together or
 * leaves all three"*, and until S6 that was false for every refusal the model
 * or the store returned: `withSignInScope()` COMMITS whatever `fn` RETURNS, and
 * these refusals were returned. **Measured, not inferred: a mint refused at
 * `session_bounds_unusable` on a FIRST sign-in committed the provisioned person
 * and the consumed attempt with no session** — the *"directory that grows by
 * one row per abandoned callback"* G1637 exists to refuse, reachable by
 * anybody who could make the bounds unusable or the person disabled.
 *
 * ⚠️ ONLY THE `mint` AND `store` ARMS, AND THE `assembly` ARMS ARE LEFT
 * EXACTLY AS THEY WERE, DELIBERATELY. An assembly refusal after the consume —
 * `sign_in_door_disagrees` — is a refusal ABOUT TAMPERING, and burning the
 * attempt on it is the fail-closed direction `assembleSignIn()` already
 * argues; changing that is a different decision from the one this repairs.
 */
class RefusedAfterWrite extends Error {
  readonly outcome: MintFederatedSessionOutcome
  constructor(outcome: MintFederatedSessionOutcome) {
    super('mint refused after a write; rolled back')
    this.outcome = outcome
  }
}

export async function mintFederatedSession(
  pool: TenantPool,
  input: MintFederatedSessionInput,
): Promise<MintFederatedSessionOutcome> {
  try {
    return await mintInScope(pool, input)
  } catch (err) {
    if (err instanceof RefusedAfterWrite) return err.outcome
    throw err
  }
}

async function mintInScope(
  pool: TenantPool,
  input: MintFederatedSessionInput,
): Promise<MintFederatedSessionOutcome> {
  return withSignInScope(
    pool,
    {
      brokerIssuer: input.brokerIssuer,
      brokerRef: input.brokerRef,
      stateDigest: input.stateDigest,
      externalSubject: input.externalSubject,
      sessionRef: input.newHandleDigest,
    },
    async (tx): Promise<MintFederatedSessionOutcome> => {
      const assembly = await assembleSignIn(tx, input.callback)
      if (!assembly.ok) return { ok: false, kind: 'assembly', assembly }

      const person = await findOrProvisionPerson(tx, input, assembly.connection.id)
      if (!person.ok) {
        if (person.kind === 'projection') {
          return { ok: false, kind: 'projection', refusal: person.refusal as ProjectPersonRefusal }
        }
        throw new RefusedAfterWrite({
          ok: false,
          kind: 'store',
          refusal: person.refusal as SessionMintStoreRefusal,
        })
      }

      /* THE MODEL DECIDES. Note what is NOT passed: no tenant, and no object
       * spread — every field is named, so S2's excess-property check is the
       * one that applies rather than the one it measured as insufficient. */
      const minted = mintSession({
        id: input.newSessionId,
        handleDigest: input.newHandleDigest,
        signInHandleDigest: input.stateDigest,
        consumption: assembly.consumption,
        user: person.user,
        issuedHost: input.issuedHost,
        bounds: input.bounds,
      })
      if (!minted.ok) {
        throw new RefusedAfterWrite(
          minted.refusal === 'session_bounds_unusable'
            ? {
                ok: false,
                kind: 'mint',
                refusal: minted.refusal,
                boundRefusals: minted.boundRefusals,
              }
            : { ok: false, kind: 'mint', refusal: minted.refusal },
        )
      }

      const written = await tx.query(SESSION_INSERT, [
        minted.session.id,
        minted.session.handleDigest,
        minted.session.userId,
        minted.session.connectionId,
        minted.session.issuedHost,
        String(minted.bounds.maxLifetimeSeconds),
      ])
      if (written.rowCount !== 1) {
        throw new RefusedAfterWrite({
          ok: false,
          kind: 'store',
          refusal: SESSION_MINT_STORE_REFUSALS.sessionNotWritten,
        })
      }

      /* REDEMPTION — after the session row, because `0370` §3a finds the
       * person THROUGH `app.session_ref`, and inside this transaction, because
       * G1637's argument for the person applies to the role one table further:
       * an assignment for a person whose sign-in rolled back is a colleague
       * nobody can be. ON EVERY MINT, FOUND AND PROVISIONED ALIKE — G2906,
       * THE OWNER'S, superseding G2810's first-sign-in-only (⚠️ this read
       * *"Only on the provisioning path (G2810)"*). An offer this person
       * already redeemed is not seen again (G2907), so a later sign-in answers
       * `none` rather than `already_redeemed`. */
      const redemption = await redeemPartnerInvitation(tx, {
        userId: person.user.id,
        newAssignmentId: mintPartnerRoleAssignmentId(),
      })

      return {
        ok: true,
        session: minted.session,
        provisioned: person.provisioned,
        emailUpgraded: person.emailUpgraded,
        redemption,
      }
    },
  )
}
