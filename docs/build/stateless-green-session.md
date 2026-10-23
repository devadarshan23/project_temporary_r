# GREEN — D1: session establishment and the durable session record, under the stateless ruling

> **STATUS:** WORKING MATERIAL. Nothing here is applied. No file in the repository was
> changed by this document.
> **Written** 9 Aug 2026 against `HEAD` (`f988f2a4`), verified at the tree.
> **The ruling this is written to serve** (the owner's, 9 Aug 2026, an INPUT):
> *"I want the application stateless so it can scale without a node dependence and for
> ease of retry in case a node fails. That means everything that carries state,
> including session data or other user artifacts, must be committed to the database."*

**What this document is:** the shape of `Session` decided before it is built, which is the
only window in which deciding it costs nothing. `docs/HANDOFF.md:145-147` names D1 the
widest open gate; `docs/build/phase-one-plan.md:80` says it blocks *everything*.

**One clarification of the ruling, first, because everything below depends on it.**
"Stateless" here means *no process-local state that another node or a retry cannot
reconstruct from durable storage*. It does **not** mean "no locals". A value derived
inside one request from durable rows — the resolved `TenantContext` — is reconstructible
by definition and may be passed down the call stack. What is banned is anything that
**survives the request** in process memory: a session cache, a challenge map, a relay-state
dictionary, a sticky-node assumption. That line is drawn here explicitly because the
difference between "derive once per request and pass it" and "cache it across requests" is
the difference between a correct design and `S2` — and `S2` is in this codebase's own
history as a module-level cache that **leaked inferred structure across a tenant
boundary** (`docs/HANDOFF.md:842`, G116).

---

## 1. What already exists that this reuses — and what the ruling gets for free

### 1.1 The decision that already did most of the work

The single largest thing the ruling gets for free is that **the authorisation spine already
refused the bearer-token shape, for the ruling's own reason.**
`model/access.ts:1536-1548`, on `AuthorizationGrant`:

> *"A REFERENCE, NOT A BEARER TOKEN … Every field below is therefore SERVER-WRITTEN AND
> SERVER-READ. There is no signature, no claims blob and no encoding, because there is
> nothing here a caller is trusted to carry: possession of the id is not possession of the
> authority, and `redeemAuthorization()` re-derives the authority every time. That is a
> deliberate refusal of the JWT shape. A signed self-describing token is fast precisely
> because nobody loads the row — and a revoked assignment, a disabled user or a lapsed
> partner grant then stays effective until the token expires … a fired employee's
> in-flight acts stop on the next call, not at the next expiry."*

Read that under the stateless ruling and it is the ruling, one layer down. A session that
is a *reference* is a session whose entire authority lives in a row, which is exactly
"committed to the database". So:

- **The X-Session header is the same shape as an `AuthorizationGrantId`.** It addresses a
  row; it asserts nothing. Every node resolves it identically because the row is the only
  input. No node has memory of the last request and none needs any.
- **The performance cost of statelessness on this surface was already accepted**, in
  writing, by that paragraph. The ruling does not add the cost; it inherits it.
- **A signed session token is now doubly refused** — once by that paragraph and once by
  the ruling, since a self-describing token *is* state that lives outside the database.

### 1.2 Verified inventory — what exists, at file:line, all opened

| Thing | Where | What it gives this surface |
|---|---|---|
| `Id<T> = string & { readonly [brand]: T }` | `model/kernel.ts:43` | `SessionId`'s form |
| `IdentityConnectionId` | `model/kernel.ts:379` | the insertion point for `SessionId` |
| `Timestamp = string` · `TenantScoped` | `model/kernel.ts:422` · `:438` | timestamps; and §3's honest limit |
| `IDENTITY_PROTOCOLS` (`saml`·`oidc`·`cognito_pool`) | `model/domain.ts:1337` | the three doors; `cognito_pool` is the per-account managed fallback |
| `IdentityConnection` | `model/domain.ts:1355` | **the org derivation's only input** |
| `IdentityConnection.owner` — 3-arm closed union | `model/domain.ts:1368-1371` | `platform` / `partner{partnerId}` / `customer{accountId}` |
| *"No password field anywhere near it, by design"* | `model/domain.ts:1351-1354` | the credential-storage rule, and the archived app's own defect |
| `IdentityConnection.domains` (DNS TXT verified) · `.status` | `model/domain.ts:1383` · `:1384` | realm routing; and a live disable lever |
| `User` — `{id, email, displayName, status, connectionId}` | `model/domain.ts:1395` | the second live lever |
| `User.status` *"LOAD-BEARING as of 5 Aug, and it was not before"* | `model/domain.ts:1400-1408` | **the fired-employee lever** |
| *"Org class is DERIVED … never stored on the user — a stored org is a second door that outlives the directory membership it was copied from"* | `model/domain.ts:1413-1417` | the ruling on storing `orgClass`, already taken |
| The `partnerScope` defect narrative | `model/domain.ts:1426-1432` | *"authority read from a FIELD rather than derived from the session"* |
| `Tenant` (`residency`, `environment`, `deploymentMode`, `status`) | `model/domain.ts:848` | what `TenantContext` projects |
| `RegionKey` — **five** values | `model/domain.ts:476-481` | `residency`'s type (⚠️ `green-platform-slices.md:386` says four; stale) |
| `AuditEvent` | `model/domain.ts:3930` | the sign-in record |
| `AuditEvent.authorizationId` — *"an authentication event (the act that PRODUCES a principal cannot run under one)"* | `model/domain.ts:3970-3979` | invariant 10's licence for sign-in, already written |
| `ORG_CLASSES` / `OrgClass` | `model/access.ts:207` / `:216` | the derived value |
| *"NOT A FIELD ON `Role`, and not stored anywhere. It is a property of an EVALUATION, derived from `(principal, tenant)` at session establishment"* | `model/access.ts:177-186` | the same ruling, from the other module |
| `DURABLE_ASSIGNMENT_PERMITTED` (`platform:false`) | `model/access.ts:232-236` | invariant 8, executable |
| `PrincipalContext` | `model/access.ts:1003-1032` | **the resolver's output type; it already exists** |
| `PrincipalContext.subject` narrowed to `{userId,status}` *"so that no evaluation can reach an email, a display name"* | `model/access.ts:1012-1017` | the contentless precedent for a principal |
| `PrincipalContext.now` supplied, not read from a clock | `model/access.ts:1027-1031` | why liveness is not in the RLS predicate |
| `DECISION_REASONS` (closed) incl. `subject_not_active`, `platform_org_holds_no_assignment` | `model/access.ts:1045`, `:1048`, `:1059` | the refusal vocabulary to extend, not duplicate |
| `Decision` — *"SCOPE TRAVELS WITH THE ANSWER"* | `model/access.ts:1129` | the shape a gate returns |
| `decide()` | `model/access.ts:1177` | the consumer |
| `AuthorizationGrant.orgClass` *"Derived at session establishment (§9.2). Stamped, never re-derived."* | `model/access.ts:1567` | evaluation re-derives, **record** stamps |
| `authorize()` / `redeemAuthorization()` | `model/access.ts:1659` / `:1753` | the per-act recheck |
| `redeemAuthorization()`'s orgClass binding | `model/access.ts:1769-1775` | **the control a stored `orgClass` would disarm** |
| `<=` is the house expiry comparison | `model/access.ts:1792` | mutation M6 |
| `AuthorizationRequest.id` *"Supplied rather than generated. This module … holds no id source"* | `model/access.ts:1597-1603` | the model does not mint the handle |
| `SupportAuthorisation.withdrawnAt` *"Stops future draws. Says nothing about sessions already open."* | `model/governance.ts:645` | the honest revocation limit, verbatim |
| The `EntitlementLease` limit, in full | `model/governance.ts:587-594` | *"never 'stops on command'"* |
| `TenantAccessGrant` (`lastUsedAt`, `idleRevokeDays`) | `model/governance.ts:854`, `:886-887` | the shape **not** to copy — see §6 |
| `AccessSession` — *"One period of actual use. The grant permits; the session records."* | `model/governance.ts:915-929` | **the staff-session record that already exists** |
| `grantAllows()` | `model/governance.ts:950` | the staff door, not this one |
| `AuditActor` (5 kinds) | `model/governance.ts:994` | who signed in |
| `AUTHORIZATION_MAY_BE_ABSENT` + its *"WHAT THIS DOES NOT COVER"* paragraph | `model/governance.ts:1223-1238` | **authentication rows fail `authorizationIsWellFormed()` and that is DELIBERATE** |
| `authorizationIsWellFormed()` | `model/governance.ts:1254` | the write-time gate |
| `SubjectLocation` — 11 variants incl. `audit_event` | `model/governance.ts:1772`, `:1776` | erasure reaches the sign-in record already |
| *"Written at CREATION time, not discovered by scanning"* | `model/governance.ts:1741-1746` | why the session row is not a `SubjectLocation` |
| `SubjectIndexEntry.subjectRef` — a **per-tenant HMAC**; `SubjectKeyScheme`: *"No field in this model may hold key material"* | `model/governance.ts:1864-1870`, `:1879-1880` | the digest precedent, and where it does **not** transfer |
| `RETENTION_CLASSES` — **13**, none of them a session | `model/domain.ts:1086-1104` | §3's retention answer |
| `AssertBranded` — *"an id alias is never a naked string"* | `model/identity.ts:288-289` | the brand proof |
| `AssertNoPlainText` / `NoPlainText` | `model/identity.ts:1139-1142` | the contentless proof, and its `Timestamp` limit |
| *"write it red first … An assertion that has never failed is a comment with extra steps"* | `model/identity.ts:21-23` | the discipline for every assertion below |
| `AssertNoTextDeep` | `model/reconciliation.ts:248-258` | why it is **unusable** here — §3.6 |
| `declare const normalisedDescription: unique symbol` + `NormalisedDescriptionValue` | `model/learning.ts:413`, `:473-475` | **the exact house form for a branded VALUE that is not a row** |
| *"G103 no third store — nothing here is cached in module state"* | `model/reconciliation.ts:~110` (header controls) | the ruling's own consequence, already a control |
| `withTenantScope()`; `set_config($1,$2,true)` | `db/tenant-scope.ts:101`, `:123` | the last link |
| `TenantPool` with **no** `query` method | `db/tenant-scope.ts:69-78` | the structural refusal of autocommit |
| `ROLES` = owner / migrator (BYPASSRLS) / app | `db/env.ts:19-26` | who runs what |
| `CREATE TABLE tenant_contact` with `PRIMARY KEY (tenant_id, id)` | `db/migrations/0001_tenancy_and_rls.sql:95` | the composite-key convention |
| `ENABLE` + `FORCE ROW LEVEL SECURITY` | `:131-134` | the owner is not exempt |
| `tenant_id = nullif(current_setting('app.tenant_id', true), '')` | `:174-181` | **the predicate, and its polarity** |
| `REVOKE CREATE ON SCHEMA public FROM PUBLIC` + explicit DML grants | `:196-200` | what 0002 must repeat |
| Migration 0001's refusal to fold in the outbox *"under schedule pressure rather than on its merits"* | `db/migrations/0001_tenancy_and_rls.sql` header | the argument for **not** minting a 14th retention class |
| `sessionContext` / `X-Session` apiKey header | `docs/contracts/foundation.openapi.yaml:816-822`; `capability.openapi.yaml:2160-2166` | the wire that has no issuer |
| `resolveTenantContext` — takes a `sessionToken` **nothing produces** | `docs/contracts/foundation.openapi.yaml:51-82` | the operation waiting for this |
| `TenantContext` wire schema (`tenantId`,`environment`,`residency`,`deploymentMode`) | `docs/contracts/foundation.openapi.yaml:845-860` | the wire shape to mirror — and it has **no org slot** |
| `session_invalid` | `docs/contracts/errors.yaml:126` | the one error code that exists |
| `tenant_context_missing`, `membership_absent`, `tenant_suspended` | `errors.yaml` (verified present) | reuse, do not mint |
| Green P1's proposed `Session` | `docs/build/green-platform-slices.md:100-131` | **the prior art this must not fork** |
| Green P1's proposed six operations | `:140-145` | the wire, already argued |
| Green P1's invariant-10 gap (X6) | `:163` | the one thing it could not close |
| Green P2's proposed `TenantContext` | `:262-274` | ditto |
| *"the URL override selects which connection TRIES. It never widens"* | `docs/access-and-agency.md:646-648` | routing chooses the door; the door decides |
| Guests are refused (`userType: Member \| Guest`) | `docs/access-and-agency.md:666-679` | a refusal arm that must exist at mint |
| *"`TenantContext` still has no slot for org … still required"* | `docs/access-and-agency.md:688-690` | the open item this closes |
| `AccessSession` reports are *"buffered like everything else"* | `docs/contracts/control-plane.openapi.yaml:803` | ⚠️ a buffer is process state — §6.6 |

### 1.3 The five things the ruling gets for free, named

1. **The revocation model.** `AuthorizationGrant` is already a reference and
   `redeemAuthorization()` already re-derives (`model/access.ts:1753`). The session is the
   same shape one layer out. Nothing needs inventing.
2. **The fired-employee lever.** `User.status` is already load-bearing
   (`model/domain.ts:1400-1408`) and `decide()` already refuses on it with
   `subject_not_active` (`model/access.ts:1048`). Disabling the directory account stops the
   next call on **every** node, with no session-row hunt. §3.5.
3. **`orgClass` must not be stored, and that is already decided twice** —
   `model/domain.ts:1413-1417` and `model/access.ts:177-186`. §3.4 shows the *mechanical*
   consequence nobody has written down yet.
4. **Invariant 10's licence for a sign-in row already exists**, in the field comment on
   `AuditEvent.authorizationId` (`model/domain.ts:3970-3979`) and in
   `AUTHORIZATION_MAY_BE_ABSENT`'s *"WHAT THIS DOES NOT COVER"* paragraph
   (`model/governance.ts:1223-1238`). §3.8.
5. **No in-process session cache is permitted, and that is not a new rule** — G116/S2
   (`docs/HANDOFF.md:842`) and `reconciliation.ts`'s header control *"G103 no third store —
   nothing here is cached in module state"*. The ruling and G116 agree; the ruling is why
   the read cannot be amortised, and G116 is why nobody may try.

---

## 2. The design — declarations ready to paste

> Every declaration follows the house rules: `strict`, `exactOptionalPropertyTypes`,
> `noUncheckedIndexedAccess`, `erasableSyntaxOnly` (const object + union, never an enum),
> `verbatimModuleSyntax`, `noUnusedLocals`/`Parameters`. Every failure is a **value**;
> every gate returns a **reasoned union**, never a boolean (§5.2). Every nullable is
> `X | null` and **required**, never optional — `model/learning.ts`'s `observedOn` argument:
> optional lets a wire payload omit the key silently.

### 2.1 `model/kernel.ts` — one line, inserted after line 379

```ts
/**
 * THE SESSION — THE DURABLE SUBSTITUTE FOR PROCESS MEMORY. D1, 9 Aug 2026.
 *
 * An `Id<>` because a session IS a row: it is machine-produced, TIMED (three
 * timestamps), and re-created rather than recomputed — G35's test for when a
 * thing gets its own identity, which `model/learning.ts:437-445` records the
 * negative side of.
 */
export type SessionId = Id<'Session'>
```

### 2.2 `model/domain.ts` — inserted between `IdentityConnection` (ends `:1385`) and `User` (`:1395`)

Placement is a **DERIVATION, not a choice**: `Session` joins `User` and
`IdentityConnection`, both of which live here, and `docs/build/green-platform-slices.md:101`
already proposed this exact placement. Putting it in a new `model/session.ts` would fork a
proposal that is already on the record (§5.3) *and* move the governed module count from 18
to 19 (§6.8).

```ts
/**
 * Module-private brand for the one thing here that is a VALUE and not a row.
 *
 * `declare const … : unique symbol` is unique PER DECLARATION — `model/kernel.ts:17`
 * warns against a second `Id` symbol and this is not one, it is a separate brand
 * family for a separate kind of thing. The precedent is
 * `model/learning.ts:413`'s `normalisedDescription`, which brands a derived
 * string for the same reason: the type is the control, and a bare `string` is not.
 */
declare const sessionHandle: unique symbol

/**
 * THE FINGERPRINT OF THE PRESENTED HANDLE. NEVER THE HANDLE.
 *
 * A branded VALUE, not an `Id<>`: there is no `SessionHandle` entity and minting
 * one to satisfy a brand is the defect `model/learning.ts:439-445` records
 * ("inventing a table for a derived string").
 *
 * 🛑 WHY THE PREIMAGE IS NEVER STORED. `IdentityConnection`'s own comment
 * (`model/domain.ts:1351-1354`) states the rule and names the defect it comes
 * from: "No password field anywhere near it, by design — credentials live in the
 * directory. The system being replaced returned other users' passwords from
 * list_users and cookied the whole object." A session handle IS a credential in
 * transit — possession lets you make the next call, even though possession
 * confers no authority — so a database dump that contained handles would be a
 * session-hijack kit. It contains digests.
 *
 * WHY A PLATFORM-WIDE KEY IS ACCEPTABLE HERE AND IS NOT FOR
 * `SubjectIndexEntry.subjectRef` (`model/governance.ts:1864-1870`). That field
 * is a per-tenant HMAC because "a global key would turn the privacy index itself
 * into a cross-tenant correlation surface" — its preimage is a SUBJECT'S natural
 * identifier, so one key correlates people across tenants. A session handle's
 * preimage is a value WE minted, for one session, that identifies no person and
 * recurs nowhere. There is nothing to correlate. The key is also unavoidable at
 * this point in the chain: the tenant is not yet known, so a per-tenant key
 * could not be selected.
 *
 * BRANDED SO A RAW HANDLE CANNOT BE PASSED WHERE A DIGEST IS EXPECTED. The
 * symbol is module-private, so the only way to obtain one is a deliberate cast at
 * the digest seam — and the seam is where a reviewer looks
 * (`model/learning.ts:448-451`, same argument).
 */
export type SessionHandleDigest = string & {
  readonly [sessionHandle]: 'SessionHandleDigest'
}

/**
 * A SESSION — EVERYTHING A NODE NEEDS TO SERVE THE NEXT REQUEST WITH NO MEMORY
 * OF THE LAST ONE, AND NOTHING ELSE.
 *
 * 🛑 NOT `TenantScoped`, DELIBERATELY, AND IT IS THE ONE STRUCTURAL FACT THE
 * WHOLE SURFACE TURNS ON. `tenantId` is null between authentication and
 * selection, so this row CANNOT be protected by the predicate every other
 * scoped table uses: `tenant_id = nullif(current_setting('app.tenant_id',
 * true), '')` (`db/migrations/0001_tenancy_and_rls.sql:174-181`) evaluates to
 * NULL against a NULL column and G100's polarity then denies UNCONDITIONALLY —
 * the row would be invisible to the very connection that just wrote it. The
 * session table therefore has its OWN policy, keyed on the digest, with the SAME
 * deny-on-NULL polarity. §2.6.
 *
 * INVARIANT 1, COPIED, NOT PARAPHRASED: "Tenant scope is derived from the
 * session, never read from a request." This row is what makes that sentence
 * mechanical. `tenantId` below is written by EXACTLY ONE code path — the
 * `selectTenant` operation — and read by every other. Nothing else in the system
 * may write it and no request body anywhere may name a tenant.
 *
 * WHAT THIS TYPE IS FOR, IN ONE SENTENCE: the owner's ruling of 9 Aug 2026 says
 * everything carrying state must be committed to the database, so this is the
 * table that replaces the thing a stateful server would have kept in memory.
 * Every field is here because a DIFFERENT NODE, on a RETRY, must be able to
 * answer "who is this, which door did they come through, which tenant, is it
 * still live" from this row plus rows it points at. Nothing is here for any
 * other reason, and §2.5's key assertion is what keeps that true.
 */
export interface Session {
  id: SessionId
  /**
   * THE LOOKUP KEY, AND THE RLS PREDICATE. Unique. The presented `X-Session`
   * value is digested by the caller and compared here; `id` is the row's
   * address and is never presented.
   *
   * Two keys, deliberately, and not redundantly: `id` is what an `AuditEvent`
   * or a `SignInAttempt` cites and may appear in a log; `handleDigest` is the
   * credential's shadow and appears in neither.
   */
  handleDigest: SessionHandleDigest
  userId: UserId
  /**
   * THE DOOR THAT AUTHENTICATED THIS SESSION. `OrgClass` derives from this
   * connection's `owner` on EVERY resolve and is NEVER stored — see
   * `model/domain.ts:1413-1417` and `model/access.ts:177-186`, which decided
   * that twice already, and §3.4 for the control a stored copy would disarm.
   *
   * IT IS ON THE SESSION AND NOT ONLY ON THE USER because org is a property of
   * HOW YOU AUTHENTICATED, not of who you are: a dual-affiliated consultant is
   * "partner on Monday, customer on Tuesday" and
   * `docs/access-and-agency.md:638-639` requires that "each session should
   * record which". `User.connectionId` records the person's directory; this
   * records the door. `resolveSession()` REFUSES when they disagree — a
   * disagreement is the only way this field could widen anything.
   */
  connectionId: IdentityConnectionId
  /**
   * SELECTED AFTER AUTHENTICATION, SERVER-SET, BY ONE PATH. Null until
   * selection, which is why this interface is not `TenantScoped`.
   *
   * A session with null here can reach nothing tenant-scoped: `resolveSession()`
   * returns `tenant_not_selected` and no `set_config('app.tenant_id', …)` is
   * ever issued, so RLS denies on NULL and the failure is an EMPTY RESULT SET
   * even if a handler forgets to check.
   */
  tenantId: TenantId | null
  authenticatedAt: Timestamp
  /**
   * Null = not yet presented. REQUIRED-AND-NULLABLE, never optional: optional
   * would let a wire payload omit the key silently while `tsc` stayed green,
   * which is `model/learning.ts:487-495`'s argument applied to the one field
   * whose absence is a bypass.
   *
   * `resolveSession()` refuses with `second_factor_required` when the
   * connection demands one and this is null. It never re-opens a factor window:
   * a second presentation against a non-null value is a REPLAY and is refused —
   * `docs/build/green-platform-slices.md:197-200` already names replay as the
   * failure mode this operation exists to have.
   */
  secondFactorAt: Timestamp | null
  /**
   * Required, never null. "An open-ended grant is not a grant" —
   * `PartnerAccessGrant`'s rule, restated on `AuthorizationGrant.expiresAt`
   * (`model/access.ts:1588-1593`), and a session is the longest-lived reference
   * in the system so it is the last place to relax it.
   *
   * ⚠️ THE NUMBER IS NOT HERE AND MAY NOT BE INVENTED. The lifetime is
   * REQUIRED CONFIGURATION that REFUSES ON ABSENCE — see
   * `SESSION_LIFETIME_REQUIRED` in `model/access.ts` below. `PRODUCT.md`
   * forbids inventing a threshold and a bound with no number is not a bound.
   */
  expiresAt: Timestamp
  /**
   * Self-service sign-out, and nothing else. Revoking a person's ACCESS is
   * `User.status = 'disabled'` or the assignment — see §3.5 and §6.5, because
   * the digest-keyed policy means nothing in the request plane can enumerate
   * another principal's sessions, which is a property rather than a limitation.
   */
  revokedAt: Timestamp | null
}
```

**Deliberate absences, each load-bearing.** No `orgClass` (§3.4). No role, capability,
`AssignmentScope` or `TenantAccessGrantId` (§3.6, §3.7). No `lastUsedAt` (§6.4). No IP, no
user-agent, no email, no display name (§3.6). No `sessionToken`. No `csrfToken` — it is
derived from `handleDigest`, not stored beside it.

### 2.3 `model/domain.ts` — the other half of the ruling: mid-flight authentication state

**This is the piece nobody has named and the ruling forces.** A federated sign-in has
state *between* the redirect and the callback — the relay state, the nonce, the PKCE
verifier, which connection was chosen. A second-factor challenge has state between issue
and presentation. In a stateful server all of that lives in a process map or a signed
cookie. Under the ruling it must be a row, or a retry on another node loses the flow.

Insert immediately after `Session`.

```ts
/**
 * MID-FLIGHT AUTHENTICATION STATE, DURABLE — THE OTHER HALF OF THE 9 Aug 2026
 * STATELESS RULING.
 *
 * 🛑 THIS IS GENUINELY NEW AND IT IS NOT §5.3, because the three nouns that
 * already exist express none of it:
 *   — `Session` (above) begins the instant authentication SUCCEEDS. This row
 *     exists only before that instant and is destroyed at it.
 *   — `AccessSession` (`model/governance.ts:915`) is "one period of actual use"
 *     drawn against a `TenantAccessGrant`. It presupposes a grant, a tenant and
 *     a staff principal — three things that do not exist here.
 *   — `AskSession` (`model/domain.ts:4243`) is a DOCUMENT of turns a human
 *     reads. `docs/screen-pack-ledger.md:136-139` already records that "the
 *     nouns collide and the concepts do not".
 * The state itself is not optional: without a durable row, an OIDC callback that
 * lands on a different node than the redirect cannot be validated, which is
 * precisely the node dependence the ruling exists to remove.
 *
 * SINGLE USE, AND THE ROW IS THE ENFORCEMENT. `consumedAt` is set in the SAME
 * transaction that mints the `Session`, under the row's own uniqueness — so a
 * replayed callback finds a consumed row and is refused. A process map could not
 * make that atomic across two nodes; a row can.
 *
 * NO CHALLENGE VALUE IS STORED, ONLY ITS DIGEST — the same rule and the same
 * reason as `Session.handleDigest`.
 */
export interface SignInAttempt {
  id: SignInAttemptId
  /** The lookup key. The relay/state parameter's digest, never the parameter. */
  handleDigest: SessionHandleDigest
  /**
   * WHICH DOOR WAS CHOSEN, pinned at redirect. Routing chose it; the door still
   * decides. `docs/access-and-agency.md:646-648`: the override "selects which
   * connection TRIES. It never widens."
   *
   * Pinned rather than re-chosen at callback, because re-choosing at callback
   * lets a caller name a different connection than the one it was sent to —
   * which is the org axis read from a request. Invariant 1's shape, one axis over.
   */
  connectionId: IdentityConnectionId
  /**
   * The IdP's own nonce/verifier, digested. Compared, never re-derived.
   */
  challengeDigest: SessionHandleDigest
  startedAt: Timestamp
  /** Required. Short. Same refuse-on-absent-configuration rule as `Session`. */
  expiresAt: Timestamp
  /** Set in the transaction that mints the `Session`. Replay finds it non-null. */
  consumedAt: Timestamp | null
  /**
   * ⚠️ NO `userId`, AND THAT IS DELIBERATE. Before the door answers there is no
   * principal, and a `userId` written at redirect would be a user-existence
   * oracle on an UNAUTHENTICATED surface —
   * `docs/build/green-platform-slices.md:140` already requires the realm
   * operation to return "no user-existence signal".
   */
}
```

`SignInAttemptId = Id<'SignInAttempt'>` goes in `model/kernel.ts` beside `SessionId`.

### 2.4 `model/access.ts` — the resolver, inserted as a new §immediately before `decide()`'s section (`:988`)

This is where it belongs and the reason is structural: its **output** is `PrincipalContext`
(`:1003`), its consumer is `decide()` (`:1177`), `ORG_CLASSES` is at `:207`, and
`authorize()`/`redeemAuthorization()` are its siblings. `access.ts` already imports from
`./domain` type-only (`model/access.ts:45-56`), and `domain.ts` imports from `./access`
type-only (`model/domain.ts:29`) — the cycle exists, is erased by
`verbatimModuleSyntax`, and adding three more type imports adds no runtime edge. **Nothing
below is a value import**, so no `.ts` specifier is needed.

```ts
/* ------------------------------------------------------------------ *
 * The session resolution — the FIRST link in invariant 1's chain
 *
 * `db/tenant-scope.ts:97-99` says of `withTenantScope()`: "`tenantId` comes
 * from an authenticated session. INVARIANT 1: it is never read from a request
 * payload, and this function cannot check that — it is the last link in the
 * chain, not the first." THIS IS THE FIRST LINK. It is the only function in the
 * system permitted to produce a `tenantId` for `withTenantScope()` to consume.
 *
 * PURE AND TOTAL, ON PURPOSE. No clock (`now` is a parameter, exactly as
 * `PrincipalContext.now` is, and for the same audit-reproducibility reason at
 * `:1027-1031`), no randomness, no I/O, no throw. The rows are read by the
 * caller and passed in. That makes every refusal below testable without a
 * database, which is what makes them testable at all today.
 * ------------------------------------------------------------------ */

/**
 * WHY A SESSION DID NOT RESOLVE. CLOSED, and closed for the reason
 * `DECISION_REASONS` (`:1045`) is closed: the free-text alternative "cannot be
 * switched on, cannot be counted, cannot be translated".
 *
 * SEPARATE FROM `DECISION_REASONS` AND NOT A SECOND VOCABULARY FOR IT (§5.3).
 * These answer a question `decide()` cannot be asked: whether there is a
 * principal AT ALL. `DECISION_REASONS` answers what a principal may do. The one
 * member that appears in both — `subject_not_active` — is deliberately spelled
 * IDENTICALLY, because it is the same fact discovered one step earlier, and a
 * second spelling of one fact is the shape this record names most often.
 */
export const SESSION_REFUSALS = {
  /** No row for the presented digest. Indistinguishable from a wrong digest, deliberately. */
  session_unknown: 'session_unknown',
  session_revoked: 'session_revoked',
  session_expired: 'session_expired',
  /** `now` did not parse. A session whose expiry cannot be compared is refused. */
  session_clock_unparseable: 'session_clock_unparseable',
  /** The connection demands a factor and `secondFactorAt` is null. */
  second_factor_required: 'second_factor_required',
  /** A factor presented against a session that already has one. Replay. */
  second_factor_replayed: 'second_factor_replayed',
  /** `IdentityConnection.status === 'disabled'`. The door closed. */
  connection_disabled: 'connection_disabled',
  /**
   * `session.connectionId !== user.connectionId`. Two answers to "which door",
   * and one of them would decide the organisation. Refused rather than
   * arbitrated — see `model/domain.ts:1426-1432` for what happens when a field
   * gets to answer a question the session should.
   */
  connection_owner_mismatch: 'connection_owner_mismatch',
  /** Identical spelling to `DECISION_REASONS.subject_not_active` (`:1048`). */
  subject_not_active: 'subject_not_active',
  /** `Session.tenantId` is null. Correct for a freshly minted session. */
  tenant_not_selected: 'tenant_not_selected',
  /** The selected tenant is no longer active. `Tenant.status` (`domain.ts:848`). */
  tenant_suspended: 'tenant_suspended',
  /** The tenant row handed in is not the one the session selected. Invariant 1. */
  tenant_row_mismatch: 'tenant_row_mismatch',
  /** The user row handed in is not the session's subject. */
  user_row_mismatch: 'user_row_mismatch',
  /** The connection row handed in is not the session's door. */
  connection_row_mismatch: 'connection_row_mismatch',
} as const
export type SessionRefusal =
  (typeof SESSION_REFUSALS)[keyof typeof SESSION_REFUSALS]

/**
 * THE RESOLVED REQUEST CONTEXT — the type the whole contract surface presumes
 * and nobody wrote.
 *
 * `docs/build/phase-one-plan.md:80` records it: "`TenantContext` is named seven
 * times in the contracts and does not exist in `model/` (verified: 0 hits)".
 * That is §5.3 with a wire on one side and nothing on the other, and G71 (one
 * TypeScript vocabulary spanning the wire) is why it must be here.
 *
 * 🛑 IT IS DERIVED PER REQUEST AND PERSISTED NOWHERE. `Session` is the stored
 * INPUT; this is the computed OUTPUT. That distinction is what resolves the
 * apparent contradiction between "org is stored nowhere" (`:177-186`) and
 * `docs/access-and-agency.md:688-690`'s "`TenantContext` still has no slot for
 * org … still required": an EVALUATION carries org, a ROW does not.
 * `AuthorizationGrant.orgClass` (`:1567`) stamps it because a grant is a RECORD.
 *
 * ⚠️ THE WIRE SCHEMA IS NARROWER THAN THIS TYPE AND THAT IS NOT DRIFT.
 * `docs/contracts/foundation.openapi.yaml:845-860` returns `{tenantId,
 * environment, residency, deploymentMode}`. It gains `orgClass` (the open item
 * above). It does NOT gain `sessionId` or `handleDigest`: a client has no use
 * for the first and must never see the second.
 */
export interface TenantContext {
  sessionId: SessionId
  tenantId: TenantId
  /** The same narrow shape `PrincipalContext.subject` carries, for the reason at `:1012-1017`. */
  subject: { userId: UserId; status: 'active' | 'disabled' }
  /** DERIVED FROM `IdentityConnection.owner` AT THIS RESOLVE. Never stored. */
  orgClass: OrgClass
  /** The partner whose directory authenticated them. Null unless `partner`. */
  partnerId: PartnerId | null
  /** `Tenant.residency` (`model/domain.ts:848`), carried so nothing looks it up twice. */
  residency: RegionKey
  environment: TenantEnvironment
  deploymentMode: DeploymentMode
  /** The `now` this context was resolved at. Reproducible, never a clock read. */
  resolvedAt: Timestamp
}

/** Resolved, or refused with a reason. Never a boolean, never a throw (§5.2). */
export type SessionResolution =
  | { ok: true; context: TenantContext }
  | { ok: false; refusal: SessionRefusal }

/**
 * ORG DERIVATION, TOTAL BY CONSTRUCTION.
 *
 * A `Record` keyed on the owner union's discriminant, so a FOURTH owner arm is a
 * COMPILE ERROR here rather than an arm that silently inherits whichever
 * `OrgClass` was written first. Same discipline as `CAPABILITY_RESOURCE_CLASS`
 * (`:556`) and `DURABLE_ASSIGNMENT_PERMITTED` (`:232`).
 *
 * ⚠️ AND UNLIKE THOSE TWO, THIS ONE HAS A CONSTRUCTION SITE THE DAY IT LANDS —
 * itself. §5.10's defect is a total `Record` used as a FIELD TYPE with nothing
 * constructing one; a `const` annotated `Record<K,V>` IS its own construction
 * site, so `tsc` genuinely fails on a missing key. The fixture in §4 witnesses
 * the values.
 */
export const ORG_CLASS_FOR_CONNECTION_OWNER: Record<
  'platform' | 'partner' | 'customer',
  OrgClass
> = {
  platform: ORG_CLASSES.platform,
  partner: ORG_CLASSES.partner,
  customer: ORG_CLASSES.customer,
}

/**
 * DERIVE THE ORGANISATION AND THE PARTNER FROM THE DOOR. THE ONLY PLACE EITHER
 * IS DERIVED.
 *
 * It takes the CONNECTION and not the session and not the user, so there is no
 * field to omit. `model/domain.ts:1426-1432` records what a nullable authority
 * field cost last time: `effectivePartnerRole()` "opened on the null case", so
 * "the check meant to close the second door was satisfied by not mentioning it".
 * A parameter cannot be omitted.
 */
export function orgFor(owner: IdentityConnection['owner']): {
  orgClass: OrgClass
  partnerId: PartnerId | null
} {
  const orgClass = ORG_CLASS_FOR_CONNECTION_OWNER[owner.kind]
  return {
    orgClass,
    partnerId: owner.kind === 'partner' ? owner.partnerId : null,
  }
}

/**
 * RESOLVE A SESSION ROW INTO A REQUEST CONTEXT, OR REFUSE WITH A REASON.
 *
 * ORDER IS DELIBERATE, and it is the same principle `authorize()` (`:1659`)
 * states: the checks that are answerable from the supplied values alone run
 * FIRST, so a malformed input never receives a resolution it could mistake for
 * an authenticated one. Row-agreement checks precede liveness; liveness
 * precedes selection; selection precedes derivation.
 *
 * `tenant` IS NULLABLE ON PURPOSE. A session that has not selected one has no
 * tenant row to read — passing `null` is how the caller says so, and the
 * function refuses with `tenant_not_selected` rather than being handed a
 * fabricated row.
 */
export function resolveSession(input: {
  session: Session
  user: User
  connection: IdentityConnection
  tenant: Tenant | null
  /** True when this connection's protocol requires a second factor. */
  secondFactorRequired: boolean
  now: Timestamp
}): SessionResolution {
  const refuse = (refusal: SessionRefusal): SessionResolution => ({
    ok: false,
    refusal,
  })
  const { session, user, connection, tenant } = input

  /* --- 1. the rows handed in must be THIS session's rows --- */
  if (user.id !== session.userId) {
    return refuse(SESSION_REFUSALS.user_row_mismatch)
  }
  if (connection.id !== session.connectionId) {
    return refuse(SESSION_REFUSALS.connection_row_mismatch)
  }
  /**
   * TWO ANSWERS TO "WHICH DOOR", AND ONE OF THEM DECIDES THE ORGANISATION.
   * `User.connectionId` is the person's directory; `Session.connectionId` is the
   * door this session came through. For a correct row they agree, because
   * `IdentityConnection.owner` is "server-set and immutable after creation"
   * (`model/domain.ts:1362-1366`) and dual affiliation means two `User` rows in
   * two directories. A disagreement is therefore a defect or an attack, and
   * arbitrating it would be choosing which of two fields gets to set org.
   */
  if (session.connectionId !== user.connectionId) {
    return refuse(SESSION_REFUSALS.connection_owner_mismatch)
  }

  /* --- 2. liveness. `now` is a parameter, never a clock read (`:1027-1031`) --- */
  if (Number.isNaN(Date.parse(input.now))) {
    return refuse(SESSION_REFUSALS.session_clock_unparseable)
  }
  if (session.revokedAt !== null) {
    return refuse(SESSION_REFUSALS.session_revoked)
  }
  /**
   * `<=` rather than `<`, matching every other expiry comparison in this module
   * (`:1792`, and `grant.expiresAt <= now` in `decide()`). A session expiring
   * exactly now is expired.
   */
  if (session.expiresAt <= input.now) {
    return refuse(SESSION_REFUSALS.session_expired)
  }
  if (input.secondFactorRequired && session.secondFactorAt === null) {
    return refuse(SESSION_REFUSALS.second_factor_required)
  }
  if (connection.status === 'disabled') {
    return refuse(SESSION_REFUSALS.connection_disabled)
  }
  /**
   * READ FRESH, EVERY REQUEST. This is the fired employee. `User.status` was
   * "consulted by NOTHING" before 5 Aug (`model/domain.ts:1400-1408`); a session
   * that cached it would restore exactly that state for the duration of the
   * session's life.
   */
  if (user.status !== 'active') {
    return refuse(SESSION_REFUSALS.subject_not_active)
  }

  /* --- 3. selection. Invariant 1's single point of derivation --- */
  if (session.tenantId === null) {
    return refuse(SESSION_REFUSALS.tenant_not_selected)
  }
  if (tenant === null) {
    return refuse(SESSION_REFUSALS.tenant_not_selected)
  }
  if (tenant.id !== session.tenantId) {
    return refuse(SESSION_REFUSALS.tenant_row_mismatch)
  }
  if (tenant.status !== 'active') {
    return refuse(SESSION_REFUSALS.tenant_suspended)
  }

  /* --- 4. derivation. The org comes from the door and from nowhere else --- */
  const { orgClass, partnerId } = orgFor(connection.owner)

  return {
    ok: true,
    context: {
      sessionId: session.id,
      tenantId: session.tenantId,
      subject: { userId: user.id, status: user.status },
      orgClass,
      partnerId,
      residency: tenant.residency,
      environment: tenant.environment,
      deploymentMode: tenant.deploymentMode,
      resolvedAt: input.now,
    },
  }
}

/**
 * WHAT THE MINT SIDE NEEDS THAT THE MODEL CANNOT DERIVE.
 *
 * `id` and `handleDigest` are SUPPLIED, not generated, for the reason
 * `AuthorizationRequest.id` (`:1597-1603`) is: "This module is stack-neutral and
 * holds no id source; inventing one here would be the first piece of runtime
 * this model owns, and it would be the wrong piece." The same argument covers
 * the handle: minting a credential needs a CSPRNG, which is runtime.
 *
 * `lifetimeSeconds` IS REQUIRED AND HAS NO DEFAULT ANYWHERE. There is no number
 * in this repository for it and `PRODUCT.md` forbids inventing one. The bound is
 * therefore stated as required configuration that REFUSES ON ABSENCE:
 * `mintSession()` returns `session_lifetime_unconfigured` rather than falling
 * back, because a fallback lifetime is a number somebody invented once.
 */
export interface SessionMintRequest {
  id: SessionId
  handleDigest: SessionHandleDigest
  connectionId: IdentityConnectionId
  userId: UserId
  lifetimeSeconds: number
  secondFactorAt: Timestamp | null
  now: Timestamp
}

export const SESSION_MINT_REFUSALS = {
  /** No lifetime configured, or not a positive finite number. Refuses; never defaults. */
  session_lifetime_unconfigured: 'session_lifetime_unconfigured',
  session_clock_unparseable: 'session_clock_unparseable',
  connection_disabled: 'connection_disabled',
  subject_not_active: 'subject_not_active',
  /**
   * The door and the person disagree. Same refusal as at resolve, checked at
   * mint too, so a row written around the mint path still fails when it is used
   * — the discipline `TenantAccessGrant.approvedByStaffUserId` states at
   * `model/governance.ts:866-870`.
   */
  connection_owner_mismatch: 'connection_owner_mismatch',
  /**
   * `docs/access-and-agency.md:666-679`: an IdP "asserts directory membership,
   * not employment", and a guest authenticating on the customer's connection
   * "would otherwise resolve to `customer`" with the partner mask never
   * applying. Both Entra and Okta emit `userType`, so this is a claim check.
   * 🛑 It is a REFUSAL ARM and NOT a field on `Session`: storing "was a guest"
   * would be a second door of exactly the shape `partnerScope` was.
   */
  directory_guest_refused: 'directory_guest_refused',
} as const
export type SessionMintRefusal =
  (typeof SESSION_MINT_REFUSALS)[keyof typeof SESSION_MINT_REFUSALS]

export type SessionMint =
  | { ok: true; session: Session }
  | { ok: false; refusal: SessionMintRefusal }

/**
 * MINT A SESSION. `tenantId` IS ALWAYS NULL HERE AND THERE IS NO PARAMETER FOR
 * IT — invariant 1, expressed as an absence in a function signature. Selecting
 * a tenant is a separate act with a separate operation and it is the only writer
 * of that field.
 */
export function mintSession(
  input: SessionMintRequest,
  user: User,
  connection: IdentityConnection,
  isDirectoryGuest: boolean,
): SessionMint {
  const refuse = (refusal: SessionMintRefusal): SessionMint => ({ ok: false, refusal })

  if (!Number.isFinite(input.lifetimeSeconds) || input.lifetimeSeconds <= 0) {
    return refuse(SESSION_MINT_REFUSALS.session_lifetime_unconfigured)
  }
  const issuedMs = Date.parse(input.now)
  if (Number.isNaN(issuedMs)) {
    return refuse(SESSION_MINT_REFUSALS.session_clock_unparseable)
  }
  if (connection.status === 'disabled') {
    return refuse(SESSION_MINT_REFUSALS.connection_disabled)
  }
  if (user.status !== 'active') {
    return refuse(SESSION_MINT_REFUSALS.subject_not_active)
  }
  if (connection.id !== input.connectionId || user.connectionId !== input.connectionId) {
    return refuse(SESSION_MINT_REFUSALS.connection_owner_mismatch)
  }
  if (isDirectoryGuest) {
    return refuse(SESSION_MINT_REFUSALS.directory_guest_refused)
  }

  return {
    ok: true,
    session: {
      id: input.id,
      handleDigest: input.handleDigest,
      userId: input.userId,
      connectionId: input.connectionId,
      tenantId: null,
      authenticatedAt: input.now,
      secondFactorAt: input.secondFactorAt,
      expiresAt: new Date(issuedMs + input.lifetimeSeconds * 1000).toISOString(),
      revokedAt: null,
    },
  }
}

/**
 * THE BRIDGE TO `decide()`. A `TenantContext` plus the assignments the caller
 * read becomes a `PrincipalContext` and nothing else does.
 *
 * WHY A FUNCTION AND NOT A SPREAD AT EVERY CALL SITE: `partnerGrant` is the
 * field a caller would forget, and forgetting it is not a compile error where
 * the value is `null` — `decide()` then refuses a legitimate partner with
 * `partner_grant_absent` (`:1062`), which reads as a data problem rather than a
 * plumbing bug. One constructor, one place to get it wrong.
 */
export function principalFor(
  context: TenantContext,
  held: readonly HeldAssignment[],
  partnerGrant: PartnerGrantTerms | null,
): PrincipalContext {
  return {
    subject: context.subject,
    tenantId: context.tenantId,
    orgClass: context.orgClass,
    partnerId: context.partnerId,
    partnerGrant,
    held,
    now: context.resolvedAt,
  }
}
```

### 2.5 `model/identity.ts` — the assertions, at the end of the file

```ts
/**
 * A SESSION IS NOT TENANT-SCOPED AT MINT. The tenant is SELECTED, not asserted.
 *
 * RED FIRST: temporarily write `interface Session extends TenantScoped` and
 * watch this fail. `model/identity.ts:21-23` requires it — "an assertion that
 * has never failed is a comment with extra steps".
 */
export type _SessionIsNotTenantScoped =
  Session extends TenantScoped ? never : Session

/**
 * 🛑 THE STRONGEST CONTROL ON THIS SURFACE: THE KEY SET IS CLOSED IN BOTH
 * DIRECTIONS.
 *
 * `AssertNoPlainText` (`:1104`) CANNOT be used on `Session` and the reason is
 * worth stating rather than working around: `Timestamp = string`
 * (`model/kernel.ts:422`), so `string extends Timestamp` is TRUE and every
 * contentless assertion in this repository maps a timestamped field to `never`.
 * `AssertNoTextDeep` (`model/reconciliation.ts:258`) fails identically. Neither
 * has met a timestamped type before, because the engine is clockless by
 * construction — `Session` is the first, and no assertion here may pretend
 * otherwise (§5.6 read from the other side).
 *
 * WHAT IS ASSERTABLE INSTEAD, AND IT IS STRICTLY STRONGER FOR THIS PURPOSE:
 * that the key set is EXACTLY these nine. Adding `email`, `ipAddress`,
 * `orgClass`, `roleId`, `scope` or `grantId` is then a COMPILE ERROR at this
 * line, whatever its type. Mutual assignability is required in BOTH directions —
 * one `extends` would pass a widening, which is the argument
 * `AssertSameType` (`:346`) makes about brands.
 */
type SessionKeys =
  | 'id'
  | 'handleDigest'
  | 'userId'
  | 'connectionId'
  | 'tenantId'
  | 'authenticatedAt'
  | 'secondFactorAt'
  | 'expiresAt'
  | 'revokedAt'

export type _SessionCarriesExactlyTheseKeys = AssertSameType<{
  sessionKeySet: { viaKernel: keyof Session; viaOwner: SessionKeys }
}>

/** Neither id alias is a naked string. Same slice, same reason (`:288`). */
export type _SessionIdsAreBranded = AssertBranded<{
  SessionId: SessionId
  SignInAttemptId: SignInAttemptId
  SessionHandleDigest: SessionHandleDigest
}>

/**
 * `TenantContext` IS AN EVALUATION PRODUCT AND MUST NOT BECOME A ROW.
 * If it ever extends `TenantScoped` someone has decided to store it, and a
 * stored derivation is a cache with a staleness window over authority.
 */
export type _TenantContextIsNotARow =
  TenantContext extends TenantScoped ? never : TenantContext

/**
 * `resolveSession()` NEVER TAKES A TENANT FROM ANYWHERE BUT ITS OWN INPUT ROWS.
 * The signature is the control: there is no `tenantId` parameter, so a handler
 * cannot pass one in from a request body.
 */
export type _ResolveSessionTakesNoTenantParameter =
  'tenantId' extends keyof Parameters<typeof resolveSession>[0] ? never : true

/**
 * `mintSession()` CANNOT SET A TENANT. Same control, at the other end.
 */
export type _MintSessionTakesNoTenantParameter =
  'tenantId' extends keyof SessionMintRequest ? never : true
```

### 2.6 The migration — `db/migrations/0002_session.sql`

Forward-only under G88; `0001` is never edited. This is the piece that most needs the
owner's eye, because it is where the ruling meets G99/G100/G101 and one of them has to move
(§6.7).

```sql
-- =====================================================================
-- 0002 — SESSION AND SIGN-IN ATTEMPT: THE TWO PRE-TENANT TABLES.
--
-- 🛑 THE STRUCTURAL FACT THIS FILE EXISTS TO HANDLE, STATED FIRST.
--    Every other scoped table in this schema is protected by
--      tenant_id = nullif(current_setting('app.tenant_id', true), '')
--    (0001:174-181). THAT PREDICATE CANNOT PROTECT THESE TWO TABLES. A session
--    between authentication and tenant selection has tenant_id NULL, and under
--    G100's deny-on-NULL polarity `NULL = anything` is NULL, which is not TRUE,
--    so the row would be invisible to the very connection that just wrote it.
--    Worse: at the moment the session is READ, app.tenant_id is not yet set,
--    BECAUSE THE SESSION IS WHAT DECIDES IT. The chain has a first link and the
--    first link cannot be secured by the thing it produces.
--
--    So these tables are keyed on the CREDENTIAL'S DIGEST instead, with the
--    SAME polarity: missing_ok, nullif on the empty string, deny on NULL. The
--    predicate becomes "you already presented the handle", which is exactly
--    what a session handle means.
--
-- RULINGS THIS APPLIES:
--   G97   every branded id is `text`; the slug/digest is stored verbatim and
--         compares like-for-like against current_setting with NO CAST.
--   G100  the policy DENIES on NULL; the migrator, never the owner, runs this.
--   G101  transaction-mode pooling assumed; every read sits in an explicit
--         transaction carrying its SET LOCAL.
--   G88   forward-only. This file is never edited once applied.
--
-- 🛑 WHAT IS DELIBERATELY NOT HERE — a `last_used_at` column. Writing it turns
--    every READ request into a WRITE and holds a row lock for the duration of
--    the request under G101. Idle expiry is an owner ruling (Q4), not a column
--    added because `TenantAccessGrant` has one — that grant is drawn a handful
--    of times per engagement, not once per HTTP request, and reusing its shape
--    here would be a rule keyed on a convenient landmark instead of the
--    property it protects (§5.1).
-- =====================================================================

CREATE TABLE session (
  id            text        PRIMARY KEY,
  handle_digest text        NOT NULL UNIQUE,
  user_id       text        NOT NULL,
  connection_id text        NOT NULL,
  -- NULLABLE, AND IT IS WHY THIS TABLE NEEDS ITS OWN POLICY.
  -- Written by exactly one code path. Invariant 1.
  tenant_id     text        NULL REFERENCES tenant (id) ON DELETE CASCADE,
  authenticated_at  timestamptz NOT NULL,
  second_factor_at  timestamptz NULL,
  expires_at        timestamptz NOT NULL,
  revoked_at        timestamptz NULL
);

CREATE TABLE sign_in_attempt (
  id               text        PRIMARY KEY,
  handle_digest    text        NOT NULL UNIQUE,
  connection_id    text        NOT NULL,
  challenge_digest text        NOT NULL,
  started_at       timestamptz NOT NULL,
  expires_at       timestamptz NOT NULL,
  consumed_at      timestamptz NULL
);

ALTER TABLE session          ENABLE ROW LEVEL SECURITY;
ALTER TABLE session          FORCE  ROW LEVEL SECURITY;
ALTER TABLE sign_in_attempt  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sign_in_attempt  FORCE  ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- THE PREDICATE. Read it exactly as 0001:150-172 asks you to read that one —
-- the three parts are the same three parts and the polarity is identical.
--
--   current_setting(..., true)  missing_ok. An unset GUC returns NULL rather
--                               than RAISING, so a forgotten SET LOCAL is an
--                               EMPTY READ (refusable as `session_invalid`) and
--                               not a 500.
--   nullif(..., '')             a GUC that was SET and reverted reads back as
--                               the EMPTY STRING. Without this the predicate is
--                               `handle_digest = ''`, which happens to deny —
--                               by accident, and only because no digest is the
--                               empty string. G97 imposes no format at the
--                               database, so relying on that is §5.1.
--   = NULL                      NULL, not TRUE, so the row is filtered.
--
-- ⚠️ LIVENESS IS NOT IN THE PREDICATE, DELIBERATELY. Adding
-- `AND revoked_at IS NULL AND expires_at > now()` would make a revoked session
-- INVISIBLE rather than REFUSABLE — collapsing `session_revoked` and
-- `session_expired` into `session_unknown` and destroying the diagnosis. It
-- would also put `now()` inside a policy, where it is unreproducible; liveness
-- belongs in `resolveSession()`, whose `now` is a parameter for exactly the
-- reason `PrincipalContext.now` is (access.ts:1027-1031).
-- ---------------------------------------------------------------------

CREATE POLICY session_rls ON session
  USING      (handle_digest = nullif(current_setting('app.session_ref', true), ''))
  WITH CHECK (handle_digest = nullif(current_setting('app.session_ref', true), ''));

CREATE POLICY sign_in_attempt_rls ON sign_in_attempt
  USING      (handle_digest = nullif(current_setting('app.signin_ref', true), ''))
  WITH CHECK (handle_digest = nullif(current_setting('app.signin_ref', true), ''));

-- `WITH CHECK` is stated explicitly rather than defaulted from `USING`, so a
-- later FOR SELECT / FOR ALL edit cannot silently drop the write half — 0001's
-- own reasoning, and here it is what makes minting work at all: the app sets
-- app.session_ref to the digest it is about to INSERT.

GRANT SELECT, INSERT, UPDATE, DELETE ON session         TO reconcile_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON sign_in_attempt TO reconcile_app;

-- Expiry sweeping runs as reconcile_migrator (BYPASSRLS, 0001's role split),
-- because a sweep by definition does not hold any handle. It is machine work
-- with no principal — `AUTHORIZATION_MAY_BE_ABSENT.system = true`
-- (model/governance.ts:1232-1238) is the row shape it audits under.
```

### 2.7 `db/session-scope.ts` — the first link, beside `withTenantScope()`

```ts
/**
 * `withSessionScope()` — THE FIRST LINK IN INVARIANT 1'S CHAIN.
 *
 * `db/tenant-scope.ts:97-99` says `withTenantScope()` "is the last link in the
 * chain, not the first". This is the first. It exists because resolving an
 * opaque handle to a tenant is INHERENTLY a pre-tenant read, and no
 * tenant-keyed predicate can protect a pre-tenant read.
 *
 * 🛑 IT COLLIDES WITH A RULE AS WRITTEN, AND THE COLLISION IS THE OWNER'S.
 * `CLAUDE.md` states, under G99: "`withTenantScope()` opens a `db.transaction()`
 * and no query may be issued outside it — a named negative control, not a
 * review convention." The session read is a query outside it. Either that
 * sentence gains a second sanctioned helper, or this function must be a nested
 * arm of the first. §6.7 states the two options; nothing here chooses.
 *
 * The three leak modes `db/tenant-scope.ts:12-36` enumerates apply UNCHANGED to
 * `app.session_ref`, and the answers are the same three: `set_config(name,
 * value, true)` never a session-level `SET`; an explicit `BEGIN` first, because
 * `SET LOCAL` outside a transaction is silently discarded; correct under both
 * pooling modes, which is G101's whole reason.
 */
import type { QueryResultLike, ScopedClient, TenantPool } from './tenant-scope.ts'

export async function withSessionScope<T>(
  pool: TenantPool,
  handleDigest: string,
  fn: (tx: ScopedClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Bound as $1 — never interpolated. `SET` is utility syntax and takes no
    // parameters, so interpolating would be an injection on a credential-derived
    // value. Same argument as `db/tenant-scope.ts:110-121`.
    await client.query('SELECT set_config($1, $2, true)', [
      'app.session_ref',
      handleDigest,
    ])
    const out = await fn(client)
    await client.query('COMMIT')
    return out
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    client.release()
  }
}

/** Unused import guard: the type is re-exported so callers need one import. */
export type { QueryResultLike }
```

### 2.8 The exact chain, with the failure at every step

Invariant 1, **copied and not paraphrased**: *"Tenant scope is derived from the session,
never read from a request."*

| # | Step | Where | On failure |
|---|---|---|---|
| 0 | `X-Session` header absent or unparseable | HTTP edge, `session.openapi.yaml` | `401` `session_invalid` (`errors.yaml:126`). **No database touched** — no oracle |
| 1 | `digest = HMAC(handle)` under the platform session key | app, one place | key unconfigured → **REFUSE**, never a fallback key |
| 2 | `withSessionScope(pool, digest, …)`: `BEGIN` then `set_config('app.session_ref', digest, true)` | `db/session-scope.ts` | forgotten → GUC is NULL → predicate NULL → **0 rows** → `session_invalid`. G100's polarity, second application |
| 3 | `SELECT … FROM session` — **no `WHERE` on tenant, no `WHERE` on digest** | inside the transaction | wrong digest → 0 rows → `session_invalid`, indistinguishable from unknown. Policy dropped → **leak**, which is mutation M4 |
| 4 | read `user`, `identity_connection`, and `tenant` if selected | same transaction | any missing → the matching `*_row_mismatch` refusal |
| 5 | `resolveSession({session, user, connection, tenant, secondFactorRequired, now})` | `model/access.ts` | one of **15** named refusals, returned as a value. Never a throw, never a boolean |
| 6 | `orgFor(connection.owner)` — the only derivation of `orgClass` and `partnerId` | `model/access.ts` | a fourth owner arm is a **compile error** at `ORG_CLASS_FOR_CONNECTION_OWNER` |
| 7 | `TenantContext` produced. **Never persisted.** | in-process, per request | — |
| 8 | `withTenantScope(pool, ctx.tenantId, …)`: `set_config('app.tenant_id', tenantId, true)` | `db/tenant-scope.ts:123` | forgotten → **empty result set**, not a cross-tenant read (G100) |
| 9 | RLS: `tenant_id = nullif(current_setting('app.tenant_id', true), '')`, `text` vs `text`, **no cast** (G97) | `0001:174-181` | mismatch → rows filtered; RLS reports success on an empty read, which is the intended failure mode |
| 10 | `principalFor(ctx, held, partnerGrant)` → `decide()` / `authorize()` | `model/access.ts:1177`, `:1659` | `DECISION_REASONS`, unchanged |
| 11 | any presented grant → `redeemAuthorization()` re-derives, including `orgClass` | `model/access.ts:1769-1775` | `authorization_principal_mismatch` — **and this only works because org was re-derived at step 6** |

**Steps 2 and 8 are two `set_config` calls, and whether they sit in one transaction or two
is the design's one real performance lever.** §6.2.

---

## 3. What each declaration refuses, and what fails closed

### 3.1 The polarity table

| Declaration | Refuses | Failure direction |
|---|---|---|
| `session_rls` policy | any read without the digest in `app.session_ref` | **CLOSED** — 0 rows, not all rows |
| `sign_in_attempt_rls` | ditto | **CLOSED** |
| `resolveSession()` | 15 named conditions, as values | **CLOSED** — no arm returns `ok: true` by default; the function ends in the success branch only after all 15 |
| `mintSession()` | 6 named conditions | **CLOSED** — an unconfigured lifetime refuses; it does not default |
| `orgFor()` | nothing; it is total | a missing owner arm is a **compile error**, not a runtime default |
| `_SessionCarriesExactlyTheseKeys` | a tenth field of any type | **COMPILE ERROR** |
| `_SessionIsNotTenantScoped` | `Session extends TenantScoped` | **COMPILE ERROR** |
| `_ResolveSessionTakesNoTenantParameter` | a `tenantId` parameter | **COMPILE ERROR** |
| `SessionHandleDigest` brand | assigning a raw handle | a **deliberate cast**, which is a seam not a wall (§5, M9) |

### 3.2 Invariant 1, made mechanical

The invariant's sentence is unchanged by everything above and must stay so. What changes is
that it now has a *single writer* and a *single reader*:

- **One writer.** `Session.tenantId` is written by `selectTenant` and by nothing else.
  `mintSession()` has no parameter for it (`_MintSessionTakesNoTenantParameter`).
- **One reader.** `resolveSession()` is the only producer of a `tenantId` for
  `withTenantScope()`. Everything downstream receives a `TenantContext` it did not build.
- **The wire says it by absence.** `docs/contracts/foundation.openapi.yaml:13-16` already
  states the convention: *"`tenantId` appears in no request body in this document … A
  request that could state its tenant could state the wrong one — invariant 1, expressed as
  an absence."* `session.openapi.yaml` inherits it; §5's verification greps it.
- **The database is the enforcement, not the handler.** Step 9. A handler that skips step 8
  sees nothing.

### 3.3 What happens on each failure, plainly

| Failure | Result | Why that and not something else |
|---|---|---|
| No `X-Session` | `401 session_invalid` | no DB touched, no oracle |
| Unknown / wrong digest | `401 session_invalid` | **identical** to unknown, so the surface is not an oracle |
| `set_config` forgotten | 0 rows → `401 session_invalid` | G100's polarity; a 500 would be worse and `missing_ok` is what prevents it |
| Session revoked | `401 session_revoked` | distinguishable from expired, because the operator response differs |
| Session expired | `401 session_expired` | `<=`, matching `access.ts:1792` |
| Second factor missing | `401 second_factor_required` | the client knows what to do |
| Second factor replayed | `409 second_factor_replayed` | green P1's own runtime case (`:197-200`) |
| Connection disabled | `401 connection_disabled` | the door closed; not a user problem |
| Connection/user disagree | `401 connection_owner_mismatch` | refused, never arbitrated |
| User disabled | `401 subject_not_active` | **the fired employee**, one request later |
| No tenant selected | `409 tenant_context_missing` | the client must select; the code already exists |
| Tenant suspended | `403 tenant_suspended` | exists in `errors.yaml` |
| `app.tenant_id` forgotten downstream | **empty result set** | G100. Loud, caught by the first test expecting a row |
| Session RLS policy dropped | **a leak** | which is why mutation M4 exists |

### 3.4 `orgClass`: RE-DERIVED per request. The ruling, and the mechanical reason nobody has written down

**Ruled: re-derived, every request, from `IdentityConnection.owner`. Never stored on the
session row.**

The record already decided this twice — `model/domain.ts:1413-1417` and
`model/access.ts:177-186` — but both argue it on *self-maintenance* ("leave the company,
lose the directory, lose the organisation, with no row for anyone to remember to update").
Under the stateless ruling there is a **second, sharper, mechanical argument** and it is
the one that settles it:

> **A stored `orgClass` on the session row silently disarms `redeemAuthorization()`.**

`model/access.ts:1769-1775` denies with `authorization_principal_mismatch` when
`grant.orgClass !== principal.orgClass`. That comparison has meaning only because
`AuthorizationGrant.orgClass` is *stamped at mint* (`:1567`, "Stamped, never re-derived")
while `principal.orgClass` is *freshly derived*. If the session stored org, the principal's
org would itself be a stamp — and the check would compare one stamp to a copy of the same
stamp, made at the same moment, from the same source. It would pass forever. That is §5.6
exactly: a control that passes while asserting nothing, produced not by deleting the check
but by changing what one of its inputs means.

**What goes wrong under each choice, stated plainly as the brief asks:**

| | STORED on the session row | RE-DERIVED per request (**ruled**) |
|---|---|---|
| Staleness | A cache with a staleness window **over authority**, as long as the session lives. A consultant whose partner connection is disabled, or whose org changes, keeps the old org until expiry | None. Org is at most one request stale |
| `redeemAuthorization()` | **Disarmed** (above) | Bites |
| Disabled connection | Undetected until expiry | `connection_disabled`, next request |
| Cost | 0 extra reads | **+1 read per request** (the `identity_connection` row) |
| Failure mode | Silent and wrong | Loud and refusing — an unreadable connection row is a refusal, not a default |
| Precedent | none; contradicts two written decisions | `model/domain.ts:1413-1417`, `model/access.ts:177-186` |

**The honest cost of re-deriving:** the `identity_connection` row is read on every request.
It is small, hot, and cacheable — **and it may not be cached in process** (G116/S2). So the
cost is real and permanent. Mitigation that does not break the ruling: it is a
`text`-primary-key point read on a table with one row per directory, and it can be fetched
in the same round trip as the session and the user with one join. **One statement, four
rows.** That is the design; §6.2 costs it.

### 3.5 Revocation and the fired employee

**What the session must be, so revocation bites on the next call:** a reference whose
authority is re-derived. That is achieved by three properties, all above:

1. **Nothing is asserted by the handle.** It is a lookup key. No claims, no signature, no
   encoded org, no encoded tenant. Precedent verbatim: `model/access.ts:1536-1548`.
2. **Every liveness input is read fresh** — `Session.revokedAt`, `User.status`,
   `IdentityConnection.status`, `Tenant.status`, and (via `held`) the assignments. Not one
   of them is copied onto the session row.
3. **`Session` carries no authority at all** — no capability, no scope, no grant. So there
   is nothing on the row that could outlive the thing it was copied from.

**The lever for a fired employee is `User.status = 'disabled'`, not a session hunt.** That
is not a compromise; it is the only lever that works on a stateless fleet, because it is
one write that every node reads on every request. `model/domain.ts:1400-1408` already made
that field load-bearing, and `docs/access-and-agency.md:650-664` already pairs SCIM push
with a manual disable path for connections that have no SCIM. **Nothing new is needed.**

**The honest limit, in the record's own words.** `model/governance.ts:645`, on
`SupportAuthorisation.withdrawnAt`: *"Stops future draws. Says nothing about sessions
already open."* And the fuller statement at `:587-594`: this is `EntitlementLease`'s limit,
so *"the guarantee is 'no more than the ceiling, and not past expiry', never 'stops on
command'"*. Applied here, with nothing softened:

- Revocation bites **at the next request**, not at the next query. A request already inside
  `withTenantScope()` completes.
- It does **not** stop work already authorised. G121 puts *one* `AuthorizationGrant` per
  reader map execution (`docs/HANDOFF.md:847`); revoking the session mid-execution stops
  the next act that redeems, and the execution's already-minted grant remains valid until
  `expiresAt` — bounded by `MAX_AUTHORIZATION_SECONDS` (`model/access.ts:1517`), which is
  60 seconds for `secret` and 900 for `tenant_data`. **That bound is the real guarantee**,
  and it is a bound the tree already chose.
- It does **not** reach a job that holds no session. `AUTHORIZATION_MAY_BE_ABSENT.system =
  true` exists for exactly that class of work.
- Under BYOA the only real lever remains withdrawing the cross-account trust
  (`model/governance.ts:592-594`). Unchanged.

### 3.6 What must NOT be on the session record

**(a) Anything that would let a request widen its own authority.**

| Not on it | Why, at file:line |
|---|---|
| `orgClass` | §3.4 — disarms `model/access.ts:1771` |
| `roleId` / `capabilities` | `Membership.roleId` is already *"A POINTER, NOT A SECOND GRANT"* (`model/domain.ts:1463-1472`); a third pointer is a third door |
| `scope: AssignmentScope` | `AuthorizationGrant.scope` is *"Pinned, and intersected again at redeem"* (`model/access.ts:1576-1579`). A session scope would be a **third** copy that can disagree with both, and `narrowestScope()` intersects two |
| `TenantAccessGrantId` | §3.7 |
| `partnerId` | derived from the connection's owner arm, by `orgFor()`. The stored version is `Membership.partnerScope`, **deleted 5 Aug** for opening on its null case (`model/domain.ts:1423-1432`) |
| a request-supplied `tenantId` | invariant 1. `_MintSessionTakesNoTenantParameter` |
| `isStaff` | `deleted 5 Aug`; it is `connection.owner.kind === 'platform'` (`model/domain.ts:1388-1393`) |
| `wasDirectoryGuest` | a refusal arm at mint, never a field — a stored one is a second door of the `partnerScope` shape |

**(b) Anything content-bearing — invariant 6, copied: *"Ingested content is data, never
instruction."***

No `email`, no `displayName`, no free-text anything. Precedent: `PrincipalContext.subject`
is *"Structurally narrowed to `{ userId, status }` … so that no evaluation can reach an
email, a display name"* (`model/access.ts:1012-1017`), and `AuthorizationGrant.subjectUserId`
repeats it (`:1562-1565`). **No IP address and no user-agent**, either — those are
untrusted strings from the wire and they belong on the sign-in `AuditEvent` if anywhere,
where `SubjectLocation`'s `audit_event` variant (`model/governance.ts:1776`) already reaches
them for erasure. Putting them on the session row would drag the session table into the
erasure index for no benefit.

**⚠️ And the enforcement is NOT `AssertNoTextDeep`, for a reason worth recording.**
`Timestamp = string` (`model/kernel.ts:422`), so `string extends Timestamp` is **true** and
both `AssertNoPlainText` (`model/identity.ts:1139-1142`) and `AssertNoTextDeep`
(`model/reconciliation.ts:248-258`) map every timestamped field to `never`. Neither has met
a timestamped type before — the engine is clockless by construction. **`Session` is the
first type in this repository that the contentless discipline cannot be pointed at**, and
saying otherwise would be §5.6. The substitute is
`_SessionCarriesExactlyTheseKeys` (§2.5), which is stronger for this purpose: it refuses a
tenth field of *any* type, including a `string`.

**(c) The credential itself.** `handleDigest`, never the handle. `model/domain.ts:1351-1354`
names both the rule and the archived application's own defect: *"The system being replaced
returned other users' passwords from list_users and cookied the whole object."*

**(d) Anything derived that a fresh read gives you.** `residency`, `environment`,
`deploymentMode` are on `TenantContext` (per-request, derived) and not on `Session`
(stored). A stored copy of `Tenant.residency` is a residency answer that can disagree with
the tenant — under invariant 7 that is a bad kind of disagreement.

### 3.7 Staff sessions: the session carries **neither** the grant nor its name

**Invariant 8, copied:** *"Being staff is not access. Reaching a tenant requires a
`TenantAccessGrant` — and reaching a class of thing requires that class to appear in
`PERMITTED_RESOURCES` or in a signed `SupportAuthorisation`."*

**Ruled: a staff session is minted exactly like any other and carries no grant reference at
all.** Three arguments, in increasing weight:

1. **`PrincipalContext` has no slot for one.** `model/access.ts:1003-1032` carries
   `partnerGrant: PartnerGrantTerms | null` for the partner axis and **nothing** for the
   platform axis. A `TenantAccessGrantId` on the session would be an input `decide()`
   cannot read, so it would have to be resolved by a *second* path —
   `grantAllows()`/`evaluateTenantAccess()` in `governance.ts` — which is the
   caller-checks-the-other-half shape `decide()` was built to end
   (`model/governance.ts:973-977` records the same shape surviving in `grantAllows`).
2. **`decide()` already refuses staff, structurally.** `DURABLE_ASSIGNMENT_PERMITTED.platform
   = false` (`:232-236`) and `DECISION_REASONS.platform_org_holds_no_assignment` (`:1059`).
   Green P1 puts it correctly: *"Sign-in must not special-case staff — the refusal belongs
   where the model already put it"* (`green-platform-slices.md:162`).
3. **The record that pairs a session to a grant already exists and it is not `Session`.**
   `AccessSession` (`model/governance.ts:915-929`): *"One period of actual use. The grant
   permits; the session records."* It carries `grantId`, `staffUserId`, `startedAt`,
   `endedAt`, `resourcesTouched`. Putting `grantId` on `Session` would create a second noun
   for one concept — §5.3, the shape this record says recurs most.

**So the shape is:** `Session` is the *authentication* record for everyone. `AccessSession`
is the *drawdown* record for staff, opened when a staff session first reaches a tenant under
a grant, and it points at the grant. Two records, two questions, no overlap. A staff session
with no grant selects no tenant and its picker is empty — which
`green-platform-slices.md:299` already argues: *"A platform user has no `Membership` and
therefore an empty picker — correct."*

**One stateless consequence for `AccessSession`, and it is a real finding.**
`AccessSession.resourcesTouched: AccessResourceClass[]` and `accessedSubjects: string[]`
(`model/governance.ts:926-928`) are **accumulating arrays on a row**, and
`docs/contracts/control-plane.openapi.yaml:803` says the report is *"buffered like
everything else"*. An in-process accumulator that flushes at session close is precisely the
process-local state the ruling bans: a node that dies loses the buffer, and a retry cannot
reconstruct it. **Both fields must be DERIVED from `DataAccessEvent`** — which already
carries `actor`, `authorizationId`, `subjectType`, `subjectId` and `maxDataClass`
(`model/governance.ts:1155-1189`), is append-only, and is written per act. The durable
source already exists; only the accumulation is wrong. This is not D1's to fix, but D1 is
where it becomes visible.

### 3.8 Retention, erasure and audit

**Which `RetentionClass` governs a session row: NONE, and no fourteenth class is minted.**

`RETENTION_CLASSES` is thirteen (`model/domain.ts:1086-1104`) and none is a session. Adding
one is not free: `RetentionPolicy.days` is `Record<RetentionClass, number>`
(`:1179`), `RETENTION_RECORD_KIND` is total over the same key
(`:1135`), `AssertAnswersEveryRetentionClass` guards both (`:1197-1205`), the fixture
`PLACEHOLDER_RETENTION_POLICY` in `model/examples.ts` would need a fourteenth entry, and
`tools/check-doc-counts.mjs --derive` reports `13 retention classes` as a **governed
metric** — so every document stating thirteen goes STALE in the same commit. And the
number itself is **D7, counsel's, not engineering's** (`phase-one-plan.md:86`).

**The ruling instead:** a session row's lifetime is **self-describing** — it is
`expiresAt` on the row — and the row is **deleted** at expiry plus a bounded grace by the
migrator-role sweep. The *durable record* that a sign-in happened is an `AuditEvent`,
retained under the existing `audit_event` class. This is migration 0001's own argument
reused: it refused to fold in the outbox columns because doing so *"would settle G30's
open question … under schedule pressure rather than on its merits"*. A fourteenth retention
class minted to give a session table a home is exactly that.

**Cost, stated:** *"which sessions were live when the incident happened"* is answerable only
from the audit stream, not from the session table. §6.5.

**Is a session row a `SubjectLocation`? NO.** `SubjectLocation` indexes *copies of a
subject's personal data values* — `model/governance.ts:1741-1746`: *"Written at CREATION
time, not discovered by scanning. A scan cannot find a value inside a stored
Explanation."* A session row holds **branded ids and timestamps** and no value of any
subject attribute; `userId` is a foreign key to the subject's own record, not a copy of one
of its values. So no twelfth variant is needed, and erasure reaches everything it must:
the `User` row directly, and the sign-in trail through the existing `audit_event` variant
(`:1776`). **For PDPA access purposes** a subject's session history is answerable from the
audit stream, which is the right place for it because that stream is retained and
hash-chained (`RecordChain`, `model/governance.ts:1110`) and the session table is neither.

**Does establishing a session mint an `AuditEvent`? YES — and invariant 10 applies, is
satisfied by visibility, and has one unresolved half that is the owner's.**

Invariant 10, copied: *"An act with no authorisation is unrecordable. `authorize()` mints an
`AuthorizationGrant` and nothing else does … This does not make an unauthorised act
impossible — nothing can, against root — it makes one visible or detectable, which is
strictly more than the model had."*

- **The null `authorizationId` is already licensed, in writing.**
  `AuditEvent.authorizationId`'s own comment (`model/domain.ts:3970-3979`) names three
  legitimate nulls and the second is *"an authentication event (the act that PRODUCES a
  principal cannot run under one)"*.
- **And `authorizationIsWellFormed()` will return `false` for it — deliberately.**
  `AUTHORIZATION_MAY_BE_ABSENT` (`model/governance.ts:1232-1238`) admits only `system`, and
  its own *"WHAT THIS DOES NOT COVER"* paragraph says authentication rows *"will fail this
  check. That is DELIBERATE and it is the cheaper error: a small, enumerable set of
  known-null actions that a standing query filters by `action`"* — versus a `user` variant
  that may carry null whenever a writer felt like it. **Do not widen the table to
  accommodate the call site**; that is §5.1 and green P1 says the same at `:163`.
- 🛑 **THE UNRESOLVED HALF, AND IT IS NOT MINE.** `AuditEvent extends TenantScoped`
  (`model/domain.ts:3930`), and a sign-in before tenant selection **has no tenant**. So
  there is nowhere to write the row. Green P1 recorded this as X6/C2 and recommended a
  non-tenant-scoped platform event stream (`green-platform-slices.md:163`); the same gap
  recurs in P3 and P7 (`:450`). It is one decision affecting three slices and it is **Q6**
  in §8. **What must not happen is the cheap workaround** — writing the sign-in row under a
  tenant the session has not selected, which would be inventing a tenant scope, i.e.
  breaking invariant 1 in the audit stream to satisfy invariant 10 in it.

---

## 4. The fixtures — and why `tsc` alone tells nobody anything without them

**§5.10, restated in one line:** a total `Record` is enforced at a **construction site**, and
in a types-only model there is none. Everything in §2 that `tsc` *appears* to check is
checked only if something constructs a value. Precisely:

- `Session` is an interface. Nothing constructs one, so **every field name, every
  nullability, every brand is unverified** by the compiler until a fixture exists. Rename
  `authenticatedAt` to `authenticatedAtUtc` and `tsc` stays green.
- `ORG_CLASS_FOR_CONNECTION_OWNER` **is** its own construction site, so a fourth owner arm
  genuinely fails to compile there. This is the one declaration in §2 that `tsc` checks by
  itself. Say so, and say nothing more.
- `resolveSession()` and `mintSession()` are functions with bodies, so `tsc` checks their
  internal consistency — but **not one refusal arm is reachable** under the compiler. A
  deleted `if` block typechecks perfectly.
- The four `identity.ts` assertions are real and need no runner. Each must be **written red
  first** (`model/identity.ts:21-23`).

### 4.1 `model/examples.ts` — appended to the FIXTURES section

Four connection fixtures, because the owner union has three arms and `orgFor()` must be
witnessed on each; plus the mismatch case, which is the fixture the refusal exists for.

```ts
/* ---------------- 6. Session — the D1 construction sites ---------------- */

/**
 * ⚠️ THESE ARE THE ONLY THINGS THAT MAKE §2's `Session` MORE THAN A COMMENT.
 * `docs/HANDOFF.md` §5.10: a type nothing constructs is a type the compiler has
 * not checked one field of. Renaming a field on `Session` fails HERE and
 * nowhere else.
 *
 * Ids are readable prefixed slugs, stored verbatim as `text` — G97, and the same
 * convention as `tests/db/tenant-isolation.test.ts:46-47`'s `ten_acme`.
 */
export const EXAMPLE_PLATFORM_CONNECTION: IdentityConnection = {
  id: 'con_1ch_entra' as IdentityConnectionId,
  protocol: IDENTITY_PROTOCOLS.oidc,
  owner: { kind: 'platform' },
  domains: ['1cloudhub.com'],
  status: 'active',
}

export const EXAMPLE_PARTNER_CONNECTION: IdentityConnection = {
  id: 'con_partner_okta' as IdentityConnectionId,
  protocol: IDENTITY_PROTOCOLS.saml,
  owner: { kind: 'partner', partnerId: 'par_reseller' as PartnerId },
  domains: ['reseller.example'],
  status: 'active',
}

export const EXAMPLE_CUSTOMER_CONNECTION: IdentityConnection = {
  id: 'con_acme_pool' as IdentityConnectionId,
  /** The per-account managed fallback pool — org derivation stays TOTAL. */
  protocol: IDENTITY_PROTOCOLS.cognitoPool,
  owner: { kind: 'customer', accountId: 'acc_acme' as AccountId },
  domains: ['acme.example'],
  status: 'active',
}

/** Disabled door. The `connection_disabled` refusal's fixture. */
export const EXAMPLE_DISABLED_CONNECTION: IdentityConnection = {
  ...EXAMPLE_CUSTOMER_CONNECTION,
  id: 'con_acme_retired' as IdentityConnectionId,
  status: 'disabled',
}

export const EXAMPLE_CUSTOMER_USER: User = {
  id: 'usr_acme_ops' as UserId,
  email: 'ops@acme.example',
  displayName: 'Acme Ops',
  status: 'active',
  connectionId: EXAMPLE_CUSTOMER_CONNECTION.id,
}

/**
 * A SESSION BEFORE TENANT SELECTION. `tenantId: null` is the WHOLE POINT of this
 * fixture — it is the state that makes `Session` non-`TenantScoped` and that
 * migration 0002's own policy exists for.
 */
export const EXAMPLE_UNSELECTED_SESSION: Session = {
  id: 'ses_acme_1' as SessionId,
  handleDigest: 'sdg_acme_1' as SessionHandleDigest,
  userId: EXAMPLE_CUSTOMER_USER.id,
  connectionId: EXAMPLE_CUSTOMER_CONNECTION.id,
  tenantId: null,
  authenticatedAt: '2026-08-09T09:00:00.000Z',
  secondFactorAt: '2026-08-09T09:00:12.000Z',
  expiresAt: '2026-08-09T17:00:00.000Z',
  revokedAt: null,
}

/** The same session after `selectTenant`. The only field that moved. */
export const EXAMPLE_SELECTED_SESSION: Session = {
  ...EXAMPLE_UNSELECTED_SESSION,
  tenantId: 'ten_acme' as TenantId,
}
```

**What each fixture witnesses, and what it does not.** It witnesses that a value satisfying
`Session` exists and that the nine keys are answerable — so a renamed field, a
non-nullable `tenantId`, or a tenth required field now fails **at a value**. It does **not**
make any of the timestamps meaningful, and it does not witness a single refusal. That is §5.

---

## 5. The mutations that prove each control bites

> `tests/model/session-resolve.test.ts` (new, pure, no database) and additions to
> `tests/db/tenant-isolation.test.ts`'s sibling `tests/db/session-scope.test.ts`.
> Every expected value is a string literal typed into the test file — the discipline
> `tests/model/access-decide.test.ts:21-23` states: *"`assert.equal(DECISION_REASONS
> .subject_not_active, DECISION_REASONS.subject_not_active)` passes forever and witnesses
> nothing."*

| # | Mutation | Expected failure | Catches |
|---|---|---|---|
| **M1** | Delete the `session.connectionId !== user.connectionId` check | `test_a_session_whose_door_disagrees_with_the_user_is_refused` fails: actual `ok: true`, expected `connection_owner_mismatch` | the org-widening path |
| **M2** | Add `orgClass: OrgClass` to `Session`; have `resolveSession()` return `session.orgClass` | (a) **`tsc` fails** at `_SessionCarriesExactlyTheseKeys`; (b) with the assertion removed, `test_org_follows_the_connection_not_the_row` fails — mutate `EXAMPLE_PARTNER_CONNECTION.owner` to `{kind:'customer'}` after mint and the resolution still reports `partner` | §3.4, the disarmed `redeemAuthorization()` |
| **M3** | Remove `, true` (`missing_ok`) from the session policy's `current_setting` | `test_a_forgotten_set_config_returns_zero_rows_and_does_not_raise` fails: the query **throws** instead of returning `rowCount: 0` | the difference between a refusable 401 and a 500 |
| **M4** | `DROP POLICY session_rls ON session` | `test_a_wrong_digest_reads_nothing` fails: a read with a **different** digest in `app.session_ref` returns the row. **This is the leak.** Modelled directly on `tests/db/tenant-isolation.test.ts:17-18`'s assertion (b) | that the isolation is produced by the policy and nothing else |
| **M5** | Change `nullif(current_setting(...), '')` to bare `current_setting(...)` | `test_an_empty_session_ref_reads_nothing_by_predicate_not_by_luck`: set the GUC to `''` explicitly and assert 0 rows **and** assert no row's `handle_digest` is `''` — so the pass is not an accident of the data. §5.1's shape, verified rather than assumed | a rule keyed on a convenient landmark |
| **M6** | `session.expiresAt < now` instead of `<=` | `test_a_session_expiring_exactly_now_is_expired` fails. The house rule is `<=` (`model/access.ts:1792`) | one second of free authority |
| **M7** | Delete the `session.revokedAt !== null` check | `test_a_revoked_session_does_not_resolve` fails | self-service sign-out |
| **M8** | Delete the `user.status !== 'active'` check | `test_a_disabled_user_does_not_resolve` fails with `ok: true`. **This is the fired employee** | the one lever that scales across nodes |
| **M9** | Add `email: string` to `Session` | **`tsc` fails** at `_SessionCarriesExactlyTheseKeys`. ⚠️ Note that `AssertNoPlainText` would ALSO fail here — but it fails on `authenticatedAt` too, which is why it cannot be used (§3.6) | content on the session row |
| **M10** | Store the presented handle instead of its digest | ⚠️ **Nothing type-level catches this in the middle** — the brand forces a `as SessionHandleDigest` cast, so the mutation is a *visible cast at a seam*, not an impossibility. The catch is a test: `test_the_stored_digest_is_not_the_presented_handle` asserts the two are unequal for a known input | recorded honestly: a seam, not a wall |
| **M11** | Make `Session.tenantId` non-nullable and read it from the request body | 🛑 **`tsc` says nothing and `_SessionIsNotTenantScoped` still passes.** The controls that bite are the wire greps (§5.1) plus a new checker. **This is the weakest point in the design** and §7 names it | invariant 1's actual failure mode |
| **M12** | Cache the resolved `TenantContext` in a module-level `Map` | 🛑 **Nothing in the repository catches this today.** It is G116/S2 recurring. The control must be a new grep-based checker joining `npm run check` under G108. §7 | the ruling itself |
| **M13** | Set `consumedAt` in a different transaction from the `Session` insert | `test_a_replayed_callback_mints_one_session_not_two` fails under two concurrent callbacks | the atomicity a process map could not give |
| **M14** | Default `lifetimeSeconds` to any number when unconfigured | `test_an_unconfigured_lifetime_refuses` fails: expected `session_lifetime_unconfigured`, actual `ok: true`. `PRODUCT.md` forbids the invented number; this is the test that keeps it out | a bound with no number is not a bound |

### 5.1 The verification greps — what "done" is

```bash
# 1. No session operation may name a tenant. MUST print 0.
grep -c 'tenantId' docs/contracts/session.openapi.yaml

# 2. Every schema refuses unknown properties: the two counts must be equal.
grep -c 'type: object'                    docs/contracts/session.openapi.yaml
grep -c 'additionalProperties: false'     docs/contracts/session.openapi.yaml

# 3. The handle's preimage appears in no schema and no model type. MUST print 0.
grep -rc 'sessionToken\|handle:' docs/contracts/session.openapi.yaml model/domain.ts

# 4. The model still compiles standalone. MUST print EXIT: 0. Run it UNPIPED,
#    as its own command, with absolute paths — CLAUDE.md's two traps.
npx -y typescript@5.9.3 tsc -p model/tsconfig.json --noEmit; echo "EXIT: $?"

# 5. Edges and gaps by kind, compared against the previous run. `Session` adds
#    userId / connectionId / tenantId edges; `SignInAttempt` adds connectionId.
node tools/planner/extract.mjs

# 6. Every governed count that moved. This WILL report STALE lines and that is
#    the tool working: `exports` moves and must be corrected in the same commit
#    or `npm run check` exits 1.
node tools/check-doc-counts.mjs

# 7. The whole gate.
npm run check
```

---

## 6. The COST of the ruling on this surface, stated plainly

### 6.1 The reads per request

| Row | Needed because | Would a signed token need it? |
|---|---|---|
| `session` | the ruling | no |
| `user` (`status`) | `PrincipalContext.subject`, and the fired employee | no |
| `identity_connection` (`owner`, `status`) | `orgClass` is derived, not stored (§3.4) | no |
| `tenant` (`status`, `residency`, `environment`, `deploymentMode`) | `TenantContext` | no |
| `role_assignment` (+ `role`) for `held` | `decide()` | no |

**Five row-sets per request where a JWT design needs zero.** Four of the five were already
required by the pre-existing design; the ruling adds the first. It can be **one statement**
(a join over `session`, `user`, `identity_connection`, `tenant`) plus one for the
assignments — so the honest figure is **+1 statement per request for the session read, +1
`set_config` for `app.session_ref`, and one extra transaction if steps 2 and 8 are not
composed**.

### 6.2 Latency, and the one lever

Two shapes, and the choice is real:

- **(i) One transaction per request.** `BEGIN`; `set_config` session_ref; read; resolve;
  `set_config` tenant_id; do the work; `COMMIT`. One backend, both GUCs local, one round
  trip saved. **Cost: a request that thinks holds a transaction open**, and under G101's
  transaction-mode assumption a long transaction pins a pooled connection for the whole
  request. That is a throughput ceiling.
- **(ii) Resolve in one short transaction, then run the work in a second.** The pooled
  connection is released between. **Cost: two transactions and possibly two backends per
  request, plus a window between resolve and work in which revocation does not bite.**

**Recommended: (ii)**, and the window is bounded by the request. It matches
`withTenantScope()`'s existing granularity and it is the shape that scales. It is stated as
a recommendation and not a ruling because it is the throughput/freshness trade and it is
the owner's — **Q3**.

### 6.3 The read cannot be amortised, ever

An in-process session cache would make all of §6.1 nearly free. **It is forbidden twice** —
by the ruling itself, and by G116 (`docs/HANDOFF.md:842`), whose reason is that `S2`, a
module-level cache in this codebase's own history, *"leaked inferred structure across a
tenant boundary"*. `reconciliation.ts`'s header control already says *"G103 no third store
— nothing here is cached in module state"*. **So the per-request read cost is permanent and
is the price of the ruling.** A shared cache — Redis — is separately closed: **G103, NO
REDIS.** There is no third store to put it in.

### 6.4 Write amplification, and the field that is NOT on the row

`TenantAccessGrant` has `lastUsedAt` and `idleRevokeDays` (`model/governance.ts:886-887`).
Copying that shape onto `Session` turns **every read request into a write**, inside the
request's own transaction, taking a row lock on the hottest row in the system for the
request's duration. That is the single worst performance decision available on this
surface, and it would be taken by analogy rather than on its merits — §5.1 exactly, because
a support grant is drawn a handful of times per engagement and a session is drawn once per
HTTP request. **`lastUsedAt` is therefore off the row, and idle expiry is not in v1 unless
the owner rules otherwise (Q4).** Absolute expiry (`expiresAt`) still holds.

### 6.5 What becomes unanswerable

The digest-keyed policy means **nothing in the request plane can enumerate sessions** —
not another user's, not its own user's other sessions. That is a security property (a
compromised app role cannot harvest live sessions) *and* a cost:

- *"Sign me out everywhere"* is not implementable in the request plane. The lever is
  `User.status`, or a session-generation counter on `User` — which would be a new field and
  a new decision (**Q5**).
- Incident response cannot list live sessions. The audit stream answers *"who signed in
  when"*; the session table answers nothing to anybody without a handle.
- A rejected alternative, recorded: a second policy for an admin role. Refused, because it
  puts a broad read path on the session table inside the request plane, and `reconcile_app`
  holding it would defeat the point.

### 6.6 A decision it makes irreversible

**The choice not to store `orgClass`** is the one that hardens fastest. Once `AuditActor`
rows and `AuthorizationGrant` rows exist that were stamped from a *derived* org, switching
to a stored org changes what every historic comparison meant, and the streams are
hash-chained (`RecordChain`, `model/governance.ts:1110`) so there is no migration that
rewrites them. Decide it now — which is what §3.4 does.

**The sign-in audit stream's shape** (Q6) is irreversible for the same reason and in the
same stream. It is the highest-cost-to-defer item on this surface.

The handle-digest *key* is **not** irreversible: sessions are short-lived, so rotating the
key invalidates live sessions and nothing else. Say so, so nobody over-protects it.

### 6.7 🛑 The G-row collision — and it is the owner's to resolve, not mine

**`CLAUDE.md`, under G99, states:**

> *"Every query runs inside an explicit transaction. No exceptions … `withTenantScope()`
> opens a `db.transaction()` and **no query may be issued outside it** — a named negative
> control, not a review convention."*

**The session read is a query outside `withTenantScope()`.** It has to be: the function
takes a `tenantId` as its first act, and the session read is what produces one. Its own
docstring says so — *"it is the last link in the chain, not the first"*
(`db/tenant-scope.ts:97-99`). So the rule as written is about to become false, and there
are exactly two honest ways out:

- **(A) The rule gains a second sanctioned helper.** `withSessionScope()` is named in
  `CLAUDE.md` beside `withTenantScope()`, and the invariant becomes *"every query runs
  inside one of exactly two named scoped helpers"*. Cost: the negative control now has two
  members and someone will propose a third.
- **(B) `withSessionScope()` composes inside `withTenantScope()`.** Impossible as
  `withTenantScope()` is currently signed, because it demands the tenant it does not yet
  have. It would need a `tenantId: string | null` parameter — and a `withTenantScope(pool,
  null, …)` call is a scoped helper that scopes nothing, which is worse than a second
  helper.

**Recommended (A), and it is not mine to take.** This is **Q1**. What must not happen is
the third option nobody would write down: issuing the session read through
`pool.query(...)`. `TenantPool` (`db/tenant-scope.ts:69-78`) has no `query` method
precisely so that is a compile error, and that refusal is one of the best controls in the
repository. **Do not add `query` to `TenantPool`.**

### 6.8 The gate's own cost

- `npm run check` currently runs typecheck → counts → citations → wire → packs → test.
  Adding ~15 exports moves the `exports` metric (832 at `HEAD`, derived) and
  `check-doc-counts.mjs` will mark every document stating it STALE — **exit 1 until each is
  corrected in the same commit**. That is the tool working; budget the sweep.
- Adding a **module** would move the governed `modules` count from 18 to 19 and touch
  `CLAUDE.md`, `docs/INDEX.md`, `docs/HANDOFF.md` and several build docs. §2.2 avoids it by
  placing `Session` in `domain.ts` and the resolver in `access.ts`.
- Two new checkers are wanted and neither exists (§7): one for "no bare `string` on
  `Session`" and one for "no module-level mutable state in the request path". Under **G108**
  each must join `npm run check` and be **deterministic and fast**; under **G109** anything
  parsing the OpenAPI files uses the pinned real YAML parser and does not hand-roll one.

### 6.9 D6 is now on the critical path, and it is unclosed

`session.openapi.yaml` is the **first unauthenticated public HTTP surface** in the system
(`green-platform-slices.md:37`). **D6 — where the runtime validation boundary lives — is
open** (`phase-one-plan.md:85`), and *"Types erase. Nothing validates today."* Shipping an
unauthenticated endpoint with no validation boundary is the highest-risk instance of D6 in
the whole plan. **This surface should not ship before D6 is taken.**

---

## 7. What I did not solve, and what it is blocked on

1. **M11 — a request-supplied tenant is not catchable by `tsc`.** The type system cannot
   see where a handler got a string. The controls are the wire grep (`grep -c 'tenantId'
   session.openapi.yaml` → 0), the absence of a `tenantId` parameter on `resolveSession()`
   and `SessionMintRequest`, and RLS as the backstop. **A checker that greps request-body
   schemas across all five contract files for a `tenantId` property is wanted** —
   `green-platform-slices.md:60` (X5) and G113's own discovery method (a recursive `$ref`
   scan) are the precedent. Blocked on: nobody has written it. G109 supplies the parser.
2. **M12 — nothing catches a module-level session cache.** This is the ruling's own
   enforcement and it does not exist. A grep-based checker over the request path (`grep -nE
   '^(const|let) .*(Map|Set|\[\]|\{\})' ` on server modules, plus a ban on top-level `let`)
   is crude but real; `reconciliation.ts`'s header controls are the precedent for
   grep-as-control, including their warning to strip comments first. Blocked on: a decision
   that it joins `npm run check` (G108) and on the request path existing at all.
3. **The sign-in audit row has nowhere to go.** X6/C2. `AuditEvent extends TenantScoped`
   and a pre-selection sign-in has no tenant. Blocked on **Q6**, an owner decision that
   recurs in P1, P3 and P7 and should be settled once.
4. **`AccessSession`'s accumulating arrays** (§3.7) violate the ruling and the fix is
   outside D1. Blocked on: whoever owns the support-access slice (P4).
5. **The second-factor challenge's own storage.** `SignInAttempt` (§2.3) carries a
   `challengeDigest`, but whether a six-digit factor is issued by us or by the IdP is
   unanswered — `IDENTITY_PROTOCOLS` has three members and only `cognito_pool` plausibly
   makes it ours. Blocked on **Q7**.
6. **Attempt counting and lockout.** `Login.dc.html` draws *"two attempts remaining"* and
   nothing in `model/` counts attempts (`green-platform-slices.md:208-210`). Under the
   ruling a counter is durable state and therefore a table — and any threshold is a number
   I may not invent. Blocked on product (**Q8**).
7. **The preserved unsubmitted decision** on the re-auth card. *"The model has no draft or
   unsubmitted state"* (`green-platform-slices.md:211-213`). Under the ruling a draft is
   durable by definition, so this is now a schema question rather than a UI one. Blocked on
   product.
8. **`FieldSpec.path` / G106's JSONB half** is untouched and unrelated, but note the shape:
   `CLAUDE.md`'s invariant 4 block records the same split — a refusal that is real and a
   binding that is not. This design deliberately does not repeat it: `resolveSession()`'s
   refusals and the RLS predicate land together, in one migration and one commit, or
   neither lands.
9. **I did not verify the claim in my own brief** that `docs/tenancy-topology.md` §4
   specifies `model/connections.ts`. It does not — §4 (`:281-284`) specifies
   `model/agents.ts`, which **is** written. `model/connections.ts` is specified elsewhere
   and constrained by delta 22 (`docs/day-2-operations.md:744`). Recorded because a
   citation that points at the wrong section is the defect class this record names, and it
   arrived in the brief.

---

## 8. Owner rulings needed before this can be built, as questions

| # | Question | Why it must be answered first | Where it collides |
|---|---|---|---|
| **Q1** | **`CLAUDE.md`'s G99 rule says "no query may be issued outside `withTenantScope()`". The session read must be one. Does the rule gain a second named helper (`withSessionScope()`), or does `withTenantScope()` gain a nullable tenant?** | It is a stated negative control and I will not amend one silently | **G99**, `CLAUDE.md`, `db/tenant-scope.ts:97-99`. §6.7 |
| **Q2** | **Is the session table's RLS predicate keyed on the presented handle's digest, with G100's deny-on-NULL polarity?** If not, name what protects a table whose `tenant_id` is legitimately NULL | Migration 0002 cannot be written without it, and it is the one structural novelty here | G100, G101, `0001:174-181`. §2.6 |
| **Q3** | **One transaction per request, or two — resolve-then-work?** | It is the throughput-versus-revocation-freshness trade, and it fixes how long a pooled connection is pinned | G101. §6.2 |
| **Q4** | **Is there idle expiry on a session? If yes, accept a write per read request and a row lock for the request's duration; if no, absolute `expiresAt` is the only bound.** And: **what is the absolute session lifetime?** I may not invent the number | `mintSession()` refuses on an unconfigured lifetime rather than defaulting, so the number is required before a session can be minted at all | `PRODUCT.md`. §6.4 |
| **Q5** | **Is "sign me out everywhere" a v1 requirement?** If yes it needs a generation counter on `User`, which is a new field and a new door to argue | The digest-keyed policy makes it unimplementable otherwise | §6.5 |
| **Q6** | **Where does a pre-tenant audit row go — a non-tenant-scoped platform event stream, or does `AUTHORIZATION_MAY_BE_ABSENT` widen?** (Green P1 recommends the first; widening a totality record to fit a call site is §5.1) | Invariant 10 on a sign-in, and the stream is hash-chained so retro-fitting is not a migration. It recurs in P1, P3 and P7 — settle once | X6/C2, `green-platform-slices.md:163`, `model/governance.ts:1223-1238`. §3.8, §6.6 |
| **Q7** | **Does the platform issue the second factor, or only the IdP?** | Decides whether `SignInAttempt` carries a challenge we minted or only a relay state we echo | `IDENTITY_PROTOCOLS` (`model/domain.ts:1337`). §7.5 |
| **Q8** | **Lockout policy and attempt counting — is it v1, and what are the numbers?** | Under the ruling the counter is a table; the thresholds are product's and I may not invent them | `green-platform-slices.md:208-210`. §7.6 |
| **Q9** | **Which contract tier owns session establishment — a fifth file `session.openapi.yaml` with document-level `security: []`, or a section of the not-yet-existing `administration.openapi.yaml`?** | X1/X2/C1 have been open since 7 Aug. All three existing files declare `security: [sessionContext]` at document level, so these operations **cannot** go in any of them | **G76** puts administration in ONE file with enforced plane tags; `docs/contracts/README.md:101` records the missing fourth file. §9 below |
| **Q10** | **D6 — the runtime validation boundary. Will it be taken before an unauthenticated public endpoint ships?** | This is the first such endpoint and *"nothing validates today"* | `phase-one-plan.md:85`. §6.9 |

---

## 9. The wire — the operation, and which tier owns it

**The problem, verified:** all three existing files declare `security: [sessionContext]` at
document level (`foundation.openapi.yaml:45-46`, `capability.openapi.yaml:95`,
`control-plane.openapi.yaml` uses SigV4), so an operation that runs **before** the header
exists cannot live in any of them. `administration.openapi.yaml` does not exist
(`docs/contracts/README.md:101`), and **G76** rules the administration tier is ONE file with
enforced plane tags — which is a *platform-administration* file, not an
*unauthenticated-public* one. The two have different threat models
(`green-platform-slices.md:36-41`).

**Recommended, and it is Q9's answer to give:** a **fifth file,
`docs/contracts/session.openapi.yaml`**, document-level `security: []`, holding green P1's
six operations plus P2's two, unchanged from `green-platform-slices.md:140-145` and `:280-283`
because reproposing them in different words would be §5.3:

| Method | Path | operationId | Note |
|---|---|---|---|
| POST | `/session/realm` | `resolveHomeRealm` | returns **no user-existence signal** |
| POST | `/session/federated` | `completeFederatedSignIn` | consumes a `SignInAttempt`; mints a `Session` with `tenantId: null` |
| POST | `/session/password` | `signInWithPassword` | permitted **only** where `protocol === 'cognito_pool'` |
| POST | `/session/second-factor` | `presentSecondFactor` | replay → `409 second_factor_replayed` |
| GET | `/session` | `getSession` | returns `SessionView = Omit<Session, 'handleDigest'>` — a **derived** type, not a second vocabulary |
| DELETE | `/session` | `signOut` | sets `revokedAt` |
| GET | `/session/tenants` | `listSelectableTenants` | built on `Membership`, **never** on `TenantAccessGrant` (invariant 8) |
| POST | `/session/tenant` | `selectTenant` | **the only writer of `Session.tenantId`** |
| POST | `/context/resolve` | `resolveTenantContext` | **REUSE** — `foundation.openapi.yaml:51`. Its `sessionToken` body field finally has a producer |

**Capabilities: none, and that is correct.** `decide()` needs a `PrincipalContext` carrying
a `tenantId` (`model/access.ts:1018`); pre-session there is none, so a capability here would
be a verb with no noun. Green P1 says the same at `:147-150`.

**`ErrorCode` additions (X5).** `session_invalid`, `tenant_context_missing`,
`membership_absent` and `tenant_suspended` **exist**. Missing, and each mirrors a
`SESSION_REFUSALS` or `SESSION_MINT_REFUSALS` member **by exact name** so no second
vocabulary is created (§5.3): `session_revoked`, `session_expired`,
`second_factor_required`, `second_factor_replayed`, `connection_disabled`,
`connection_owner_mismatch`, `subject_not_active`, `directory_guest_refused`,
`session_lifetime_unconfigured`, `tenant_not_selected`. Ten additions to a 71-member enum —
`errors.yaml:22-27` already says ~23 members are owed. The wire-mirror checker
(`tools/check-wire-mirror.mjs`, already in the gate) is what keeps the two lists identical
once both exist.

`TenantContext`'s wire schema gains **`orgClass`** — the open item
`docs/access-and-agency.md:688-690` has been carrying since 5 Aug — and gains nothing else.
It does **not** gain `sessionId` or `handleDigest`.

---

## 10. Summary — what is genuinely new, and the standard it was held to

Everything below is claimed as new only after checking that nothing existing expresses it.

| New thing | Why nothing existing carries it |
|---|---|
| `Session` | `AccessSession` is a *drawdown against a grant* (`governance.ts:915`); `AskSession` is a *document a human reads* (`domain.ts:4243`); `docs/screen-pack-ledger.md:136-139` already records that *"the nouns collide and the concepts do not"*. Neither is an authentication record and neither can be one |
| `SessionHandleDigest` | `SubjectIndexEntry.subjectRef` is a **per-tenant** HMAC of a **subject's natural identifier** (`governance.ts:1864-1870`); this is a **platform-keyed** digest of a **value we minted**, and the tenant is not knowable at the point it is used. Different key scope, different preimage, different reason |
| `SignInAttempt` | genuinely new; §2.3 argues it against all three existing session nouns. The state is not optional — without a durable row an OIDC callback on a different node cannot be validated, which **is** the node dependence the ruling removes |
| `withSessionScope()` and `app.session_ref` | `withTenantScope()` says of itself that it *"is the last link in the chain, not the first"* (`db/tenant-scope.ts:97-99`). A pre-tenant read cannot be protected by a tenant predicate, and G100's polarity denies unconditionally on a NULL `tenant_id`. This is structural, not preference |
| `SESSION_REFUSALS` | `DECISION_REASONS` answers *what may this principal do*; these answer *is there a principal at all*. The one overlapping member, `subject_not_active`, is spelled **identically** on purpose, because two spellings of one fact is the shape this record names most |
| `TenantContext` | It exists on the wire seven times and in `model/` zero times (`phase-one-plan.md:80`). That **is** §5.3, and G71 says which side wins |
| `orgFor()` / `ORG_CLASS_FOR_CONNECTION_OWNER` | The derivation is described in prose in two modules (`access.ts:177-186`, `domain.ts:1413-1417`) and executed nowhere. This is the control existing over zero call sites — the shape `docs/HANDOFF.md:130` says was *"found four times stacked under one feature"* — closed before it recurs |

**Reused unchanged, minted nowhere:** `PrincipalContext`, `decide()`, `authorize()`,
`redeemAuthorization()`, `DENY_ALL`, `HeldAssignment`, `PartnerGrantTerms`,
`DURABLE_ASSIGNMENT_PERMITTED`, `AuditEvent`, `AuditActor`,
`AUTHORIZATION_MAY_BE_ABSENT`, `authorizationIsWellFormed()`, `AccessSession`,
`TenantAccessGrant`, `grantAllows()`, `SubjectLocation`, `RETENTION_CLASSES` (**unchanged at
thirteen**), `AssertBranded`, `AssertSameType`, `withTenantScope()`, the G100 predicate's
polarity, the G97 `text` comparison with no cast, and `errors.yaml`'s existing four codes.
