# The stateless application — evidence and proposal

> **STATUS: WORKING MATERIAL · V1 AUTHORITY: NO.**
> **This document is EVIDENCE AND PROPOSAL, NEVER A DECISION.** Say it that way when you cite it.
> Four green designs landed on 9 Aug 2026. **Every red team and the adjudicator died on a session
> limit. There is no adversarial pass and no adjudication.** So nothing below has survived attack,
> nothing below has been ruled, and **nothing below is applied** — no declaration in it exists in
> `model/`, no migration in it exists in `db/migrations/`, and no G number has been taken on any of
> it. `docs/HANDOFF.md` §3 outranks this document everywhere; where it and a G row disagree, the G
> row wins.
> **A red pass is OWED and this record must not be built from until it lands.** That is not
> ceremony. This repository's own history on 9 Aug 2026 is that the adversarial passes found real
> defects **in the existing tree**, not only in the proposals — `docs/HANDOFF.md:130` records four
> controls that existed in prose over zero call sites, found stacked under one feature, and §8 below
> adds four more findings about the tree that surfaced merely from *designing* against it.
>
> **The ruling this record serves is the owner's, 9 Aug 2026. It is an INPUT, not a question:**
>
> > *"I want the application stateless so it can scale without a node dependence and for ease of
> > retry in case a node fails. That means everything that carries state, including session data or
> > other user artifacts, must be committed to the database."*
>
> **Sources.** Four green reports, all in this repository, all written against `HEAD` (`f988f2a4`):
> `docs/build/stateless-green-session.md` · `docs/build/stateless-green-resumable-work.md` ·
> `docs/build/stateless-green-state-audit.md` · `docs/build/stateless-green-user-artifacts.md`.
> **Where two of them disagree or overlap, this record names both and leaves it open** — choosing
> between two green designs is what the missing adjudication was for.
>
> Every `file:line` below was opened by me at `f988f2a4`. Every count carries the command that
> derives it. Where I could not verify something it says **not verified**.

---

## 0. Reproduce every claim on this page

Nothing here should be believed because it is written down. Six commands carry the argument, and
none of them is copied from a report — each was run at `HEAD` and its output is printed beside it.

```bash
# 1. THE HEADLINE. One mutable module-level binding exists in `model/` and `db/`
#    combined, and it is a memoised module handle, not state.
grep -rnE '^(export )?(let|var) ' --include='*.ts' model db
# → db/pg.ts:25:let cached: Promise<PgModule> | undefined      (one line, exactly)

# 2. NO CLOCK AND NO RANDOMNESS IN THE MODEL'S EXECUTABLE CODE. Two hits, both
#    inside doc comments in `model/presentation.ts`, which is dropped whole.
for f in model/*.ts; do grep -vE '^[[:space:]]*(\*|/\*|//)' "$f" \
  | grep -nE 'Date\.now\(\)|Math\.random|randomUUID' | sed "s|^|$f:|"; done
# → no output. And: grep -rn 'new Date()' model/*.ts | wc -l   → 0

# 3. THE POOL CANNOT ISSUE AN UNSCOPED STATEMENT, BY OMISSION.
awk '/export interface TenantPool \{/,/^\}/' db/tenant-scope.ts | grep -c 'query'
# → 0

# 4. `db/` EXISTS AND `pg` IS NOT IN THE MANIFEST. Both halves matter — §8.1.
ls db/migrations/*.sql | wc -l ; grep -c '"pg"' package.json
# → 1  and  0

# 5. THE RLS PREDICATE AND ITS POLARITY, at the only place it is written.
grep -n "nullif(current_setting" db/migrations/0001_tenancy_and_rls.sql
# → :140 (the argument), :175-176 (tenant), :179-180 (tenant_contact)

# 6. THE CEILING THE LEASE DESIGN INHERITS RATHER THAN INVENTS.
sed -n '1517p;1530p' model/access.ts
# → export const MAX_AUTHORIZATION_SECONDS: Record<AccessResourceClass, number> = {
# →   tenant_data: 900,
```

Ground truth for every count used below, derived rather than quoted:

```bash
ls model/*.ts | wc -l                     # 18 modules
grep -h '^export ' model/*.ts | wc -l     # 832 exports
node tools/check-doc-counts.mjs --derive  # 37 capabilities · 13 resource classes ·
                                          # 13 retention classes · 71 error codes ·
                                          # 65 contract operations · 11 invariants
grep -cE '^\| G[0-9]+ \|' docs/HANDOFF.md                 # 131 rows
grep -E  '^\| G[0-9]+ \|' docs/HANDOFF.md | grep -c '✅'  # 35 applied
```

---

## 1. The rule, stated precisely enough to be checkable

The owner's sentence is a requirement about *nodes*. Stated in the shape of an invariant, so that a
checker and a reviewer can both apply it:

> **No process-local state that another node or a retry cannot reconstruct from durable storage.**
> A value derived inside one request from durable rows may be computed, passed down the call stack
> and discarded. A value that **survives the request in process memory** — a session map, a
> challenge dictionary, a chain head, a schema cache, a sticky-node assumption — is forbidden,
> whatever its performance argument.

That is deliberately narrower than *"no locals"* and deliberately wider than *"no globals"*. The
line falls exactly where this codebase's own defect history put it: **G116** refused a shared
scratch buffer across iterations in `levenshteinBasisPoints` (`docs/HANDOFF.md:842`) because
*"reusing a single set of typed arrays across iterations is shared mutable state"*, and its stated
reason is `S2` — a module-level cache in this module's own history that **leaked inferred structure
across a tenant boundary**. The difference between "derive it per request" and "cache it across
requests" is the difference between a correct design and `S2`.

All four green reports converge on this reading and none of them argues for a different one. **One
place it is genuinely ambiguous, and only the owner can close it:** whether *"committed to the
database"* is literal (PostgreSQL) or operational (durable anywhere a retry can reach it). §6.5 and
**S-8** show that G120's Step Functions distributed map turns on the difference and nothing else in
the phase-one plan does.

### The three dispositions, and the boundary between them defended

| Disposition | Test | Why the boundary sits there |
|---|---|---|
| **DURABLE** — must be a row | a node death or a retry would **lose judgement a person or a paid call produced**, or would let two attempts disagree | The session row, the mid-flight sign-in state, the pinned run input, a stored reader verdict, a held draft. Each fails the test for a different reason and §3 argues each separately. The sharpest case is a **spent model call**: `ReaderTokenUsage` counts are provider-reported and *"NEVER ESTIMATED"* (`model/reconciliation.ts:2284`), so a lost outcome row is not recoverable by recomputation at any price |
| **DERIVED per request** — computed, never stored | the same inputs give the same answer on any node, and the inputs are themselves durable | `orgClass` and `partnerId` from `IdentityConnection.owner` (`model/domain.ts:1355`); the whole resolved request context; the next Ask turn's prompt context, which is a bounded fold over at most three durable turns (`model/domain.ts:4243`). **The boundary is defended by a mechanism, not by taste:** a stored `orgClass` silently disarms `redeemAuthorization()`'s org check (`model/access.ts:1771`), so deriving is not merely tidier — storing it breaks a live control. §7 **S-3** |
| **MAY BE LOST** | it never reaches a node, so a node cannot lose it, **and** no screen promises otherwise | A multi-row selection in flight; a filter (`model/presentation.ts` is dropped whole and its note says *"no saved views"*); the route you were on, which lives in the browser's URL. ⚠️ **The boundary moves the instant a screen makes a promise across a re-authentication** — `Mockups/rec/Login.dc.html:173` promises *"Your rejection reason on C.4 is held, unsubmitted"*, and a re-auth may land on a different node, so that artefact crosses to the server side regardless of where it started |

**Why the third row is not a loophole.** *"May be lost"* is a claim about a **promise**, not about
convenience. It is falsified by one drawn screen, and one drawn screen falsified it — which is why
§3(c) exists at all.

---

## 2. What the ruling gets FOR FREE

This is the argument for adopting the rule now rather than later, and it is large. **The
authorisation spine, the store and the engine were each built with a property the ruling needs, for
reasons that had nothing to do with statelessness.** Every row was verified at the tree.

**1. The engine is already a pure, total fold with no clock, no randomness and no I/O, and it
returns failures as values.** `model/reconciliation.ts:80` — *"THE ENGINE HAS NO AUTHORITY, NO
CLOCK, NO IDENTITY AND NO NETWORK. It mints no id, reads no clock, calls no model and writes no
record. It is a pure, total fold."* Its header carries nine standing greps, comment-stripped
(`model/reconciliation.ts:16`), including the clock at `:19`, `Math.random` at `:21` and `throw ` at
`:23`. **Consequence for the ruling: re-running the fold over the same input IS the resume.** No
state serialisation format is needed, and crash-resume and `RunTrigger.rerun` become one code path
rather than two.

**2. `AuthorizationGrant` is already a REFERENCE rather than a bearer token, so possession is not
authority.** `model/access.ts:1536`, verbatim: *"A REFERENCE, NOT A BEARER TOKEN … possession of the
id is not possession of the authority, and `redeemAuthorization()` re-derives the authority every
time. That is a deliberate refusal of the JWT shape. A signed self-describing token is fast
precisely because nobody loads the row — and a revoked assignment, a disabled user or a lapsed
partner grant then stays effective until the token expires … a fired employee's in-flight acts stop
on the next call, not at the next expiry."* `redeemAuthorization()` (`model/access.ts:1753`)
re-derives on every call. **Read under the ruling, that paragraph IS the ruling one layer down** — a
worker resuming on another node carries one opaque id and re-derives everything. 🛑 **And it closes
the escape hatch in advance:** the standard mitigation for "load the row every request" is a signed
token or an in-process cache, and `access.ts:1536` refuses the first *by name* while the ruling
refuses the second. §6.1 prices that.

**3. RLS already denies on NULL (G100), so a forgotten scope on any node reads nothing.**
`db/migrations/0001_tenancy_and_rls.sql:179-180` — `tenant_id = nullif(current_setting('app.tenant_id',
true), '')`, with `ENABLE` **and** `FORCE ROW LEVEL SECURITY` at `:131-134` so ownership confers no
exemption. **The property the ruling needs is the failure direction:** a retry on a cold node that
skips `withTenantScope()` gets an empty result set, not another tenant's rows.

**4. Canonical hashing already landed — G20, 9 Aug 2026.** `model/canonical.ts:2` — RFC 8785 (JCS),
`canonicalise()` at `:137`. `docs/HANDOFF.md:674` records it *"applied before the first hash, which
was the only window in which it cost nothing."* **That is the precedent §6.2 leans on**: the
partitioning half of the same decision is still open and its window is the same window.

**5. "No module-level mutable state" is already a standing header control, and G116 already refused
a shared buffer on the ruling's own reasoning.** `model/reconciliation.ts:108` — *"G103 no third
store — nothing here is cached in module state"*. G116 (`docs/HANDOFF.md:842`) refused the buffer
over a performance request, citing `S2`, the cross-tenant leak. **The ruling ratifies G116 rather
than introducing a posture**, and G116 is why nobody may propose the mitigation §6.1 forbids.

**6. G103 already closed Redis, so there is no third store to be tempted by.**
`docs/HANDOFF.md:829` — the extraction-rule cache is *"a tenant-scoped Postgres table"* because a
cache of tenant-derived rules *"would sit outside RLS, outside the retention table, outside the
erasure plan and outside `SubjectLocation`"*. **G103 is the ruling applied to a cache, eight days
early.**

**7. The pool already refuses the leaky call, structurally.** `db/tenant-scope.ts:56` — *"A POOL
WITH NO `query` METHOD, AND THE OMISSION IS THE WHOLE POINT"*; the interface at `:69` has no
`query`, so `pool.query(...)` is a compile error at every call site rather than a review catch
(reproduce: command 3 of §0 → 0). `db/tenant-scope.ts:123` binds the GUC as `$1` via
`set_config($1, $2, true)` rather than interpolating it.

**8. The clock is already a parameter everywhere it matters.** `PrincipalContext.now`
(`model/access.ts:1003`) is supplied *"rather than read from a clock so a decision is reproducible
in an audit"*. **A stateless retry needs exactly reproducibility**, so the audit requirement already
bought it.

**9. Multi-turn conversation is already reconstructible.** `AskSession` (`model/domain.ts:4243`) is
a durable row; what re-enters a prompt is a bounded fold over at most three prior turns. **So the
Ask surface needs no node affinity and no conversation cache** — G47 was taken for containment and
happens to be the strongest statelessness result in the model.

**10. The outbox shape already exists.** `UsageRecord.shippedAt` is a null-until-shipped column
(`model/billing.ts:165` is its sibling `sequence`), and
`docs/build/event-architecture-recommendation.md:275-289` records that *"`UsageRecord` is a
transactional outbox. It has been one since it was written."* **An outbox row is the retry**; there
is no in-flight in-process buffer to lose.

**The state audit's headline, and it is the reason to adopt now.** `model/` is already clean —
command 1 of §0 returns one line and it is `db/pg.ts:25`, a memoised dynamic-import handle that
holds no tenant datum and that a cold node rebuilds by importing again. **There is nothing to fix.
The entire cost of the ruling on the audit surface is the checker plus the discipline**, and that is
only true while the request path does not exist. It will not be true later.

---

## 3. The model deltas, by surface

Drawn from the four reports. Declarations are given ready to paste, with the file and the insertion
point, and the migration shape and RLS predicate for each new table. **House rules apply to all of
it:** `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `erasableSyntaxOnly` (a
const object plus a union, never an enum), `verbatimModuleSyntax`, `noUnusedLocals`/`Parameters`.
Every gate returns a **reasoned union and never a boolean** (`docs/HANDOFF.md` §5.2). Every nullable
is `X | null` and **required**, never optional. **A value import inside `model/` carries `.ts`;
`import type` specifiers do not.**

🛑 **And the §5.10 warning applies to every line below.** `docs/HANDOFF.md:1689`: a total `Record`
binds the *shape* and only a fixture witnesses the *content*; five total records landed on 7 Aug
2026 with no construction site anywhere. **`tsc` is green today and would stay green after every
declaration in this section was pasted in** — `SessionRejection` is union arms nothing constructs,
`SessionBounds` is numbers nothing supplies, `resolveSession` is a signature. A green typecheck
after this change is **not** evidence of anything and must not be reported as verification. §5 names
the fixture for each step.

### (a) The session — this is D1, and D1 gates everything with a wire

`docs/HANDOFF.md:145` names it: *"D1 — where session establishment terminates. Untouched, and now
the widest open gate by some distance. All three contract tiers require `X-Session`; no path issues
one. Everything with a wire depends on it."* Verified: `security:` is declared at document level in
`docs/contracts/foundation.openapi.yaml:45`, `docs/contracts/capability.openapi.yaml:94` and
`docs/contracts/control-plane.openapi.yaml:192`; the header itself is
`docs/contracts/foundation.openapi.yaml:816` (`name: X-Session`, `:819`); and
`resolveTenantContext` (`docs/contracts/foundation.openapi.yaml:51`) takes a `sessionToken` body
field (`:72`) that **nothing produces**. `grep -rn 'TenantContext' model/*.ts | wc -l` → **0**: the
type is named on the wire and does not exist in the model.

**Two reports designed this surface and they agree on more than they disagree.** Both put `Session`
in `model/domain.ts` beside `IdentityConnection` (`:1355`), both refuse `orgClass` on the row, both
put the resolver in `model/access.ts`, both key the new table's policy on something other than
`tenant_id` with G100's polarity, and both refuse a signed token. **The disagreements are named at
the end of this subsection and left open.**

#### `model/kernel.ts` — the ids

Insertion point: after `IdentityConnectionId` (`model/kernel.ts:379`), or beside `UserId`
(`:101`) — the two reports differ on which, and it does not matter.

```ts
/**
 * A SESSION IS ADDRESSED, NEVER CARRIED. G97 stores it as `text`, verbatim.
 *
 * An `Id<>` because a session IS a row: machine-produced, timed, and re-created
 * rather than recomputed. The id is a LOOKUP KEY and not a credential — the row
 * is loaded and re-evaluated on every request, which is `AuthorizationGrant`'s
 * posture one layer earlier (`model/access.ts:1536`, "a reference, not a bearer
 * token"). The bearer secret is NOT this id and is not a field in `model/` at
 * all: it is a digest column on the table, because no field in this model may
 * hold key material.
 */
export type SessionId = Id<'Session'>
export type SignInAttemptId = Id<'SignInAttempt'>
```

#### `model/domain.ts` — the digest brand, the row, and the mid-flight row

Insertion point: between `IdentityConnection` (`model/domain.ts:1355`) and `User` (`:1395`).
**Placement is a derivation, not a preference:** `Session` joins `User` and `IdentityConnection`,
both of which live in that module, and putting it in a new module would move the governed module
count off 18 (§6.6).

```ts
/**
 * Module-private brand for the one thing here that is a VALUE and not a row.
 * `declare const … : unique symbol` is unique PER DECLARATION; the precedent is
 * `model/learning.ts`'s `normalisedDescription`, which brands a derived string
 * for the same reason — the type is the control and a bare `string` is not.
 */
declare const sessionHandle: unique symbol

/**
 * THE FINGERPRINT OF THE PRESENTED HANDLE. NEVER THE HANDLE.
 *
 * 🛑 WHY THE PREIMAGE IS NEVER STORED. `IdentityConnection`'s own comment states
 * the rule and names the defect it comes from: no password field anywhere near
 * it, because the system being replaced returned other users' passwords from
 * list_users and cookied the whole object. A session handle IS a credential in
 * transit — possession lets you make the next call even though possession
 * confers no authority — so a database dump containing handles would be a
 * session-hijack kit. It contains digests.
 *
 * WHY A PLATFORM-WIDE KEY IS ACCEPTABLE HERE AND IS NOT FOR
 * `SubjectIndexEntry.subjectRef` (`model/governance.ts:1868`), which is a
 * PER-TENANT HMAC: that field's preimage is a SUBJECT'S natural identifier, so
 * one key would correlate people across tenants. This preimage is a value WE
 * minted, for one session, identifying no person and recurring nowhere. The key
 * is also unavoidable at this point in the chain: the tenant is not yet known,
 * so a per-tenant key could not be selected.
 */
export type SessionHandleDigest = string & {
  readonly [sessionHandle]: 'SessionHandleDigest'
}

/**
 * A SESSION — EVERYTHING A NODE NEEDS TO SERVE THE NEXT REQUEST WITH NO MEMORY
 * OF THE LAST ONE, AND NOTHING ELSE.
 *
 * 🛑 NOT `TenantScoped` (`model/kernel.ts:438`), DELIBERATELY, AND THE WHOLE
 * SURFACE TURNS ON IT. `tenantId` is null between authentication and selection,
 * so this row cannot be protected by the predicate every other scoped table
 * uses: `tenant_id = nullif(current_setting('app.tenant_id', true), '')`
 * (`db/migrations/0001_tenancy_and_rls.sql:179`) is NULL against a NULL column,
 * NULL is not TRUE, and G100's polarity then denies UNCONDITIONALLY — the row
 * would be invisible to the connection that just wrote it.
 *
 * INVARIANT 1, COPIED AND NOT PARAPHRASED: "Tenant scope is derived from the
 * session, never read from a request." This row is what makes that sentence
 * mechanical. `tenantId` is written by EXACTLY ONE code path — tenant selection
 * — and read by every other.
 *
 * ⚠️ THIS ROW IS THE ONLY SESSION STATE THERE IS. There is no in-process session
 * map, no signed cookie carrying claims and no node affinity. WHAT THAT COSTS,
 * STATED ON THE DECLARATION SO NOBODY HAS TO GO LOOKING: several row-sets read
 * before any work on every request, and they may not be cached — see §6.1.
 */
export interface Session {
  id: SessionId
  /** The lookup key, and the RLS predicate. Unique. `id` is the row's address
   *  and may appear in a log; this is the credential's shadow and may not. */
  handleDigest: SessionHandleDigest
  userId: UserId
  /** THE DOOR THAT AUTHENTICATED THIS SESSION. `OrgClass` derives from this
   *  connection's `owner` on EVERY resolve and is NEVER stored — the record
   *  decided that twice already (`model/domain.ts:1355`'s block and
   *  `model/access.ts:207`'s), and §7 S-3 gives the mechanical reason.
   *  It is on the SESSION and not only on the `User` because org is a property
   *  of HOW you authenticated: a dual-affiliated consultant is partner on
   *  Monday and customer on Tuesday, and each session must record which. */
  connectionId: IdentityConnectionId
  /** SELECTED AFTER AUTHENTICATION, SERVER-SET, BY ONE PATH. Null until
   *  selection, which is why this interface is not `TenantScoped`. A session
   *  with null here reaches nothing tenant-scoped: no `set_config` is issued,
   *  so RLS denies on NULL and the failure is an EMPTY RESULT SET even if a
   *  handler forgets to check. */
  tenantId: TenantId | null
  authenticatedAt: Timestamp
  /** Null = not yet presented. REQUIRED-AND-NULLABLE, never optional: optional
   *  lets a wire payload omit the key silently on the one field whose absence
   *  is a bypass. */
  secondFactorAt: Timestamp | null
  /** Required, never null. "An open-ended grant is not a grant", and a session
   *  is the longest-lived reference in the system, so it is the last place to
   *  relax it. ⚠️ THE NUMBER IS NOT HERE AND MAY NOT BE INVENTED — see
   *  `SessionBounds` below, which REFUSES on absence. */
  expiresAt: Timestamp
  /** Self-service sign-out, and nothing else. Revoking a person's ACCESS is
   *  `User.status = 'disabled'` (`model/domain.ts:1395`) or the assignment. */
  revokedAt: Timestamp | null
}
```

**Deliberate absences, each load-bearing and each with a citation.** No `orgClass` (§7 S-3). No
`roleId`, capability or `AssignmentScope` — `AuthorizationGrant.scope` is already *"pinned, and
intersected again at redeem"* (`model/access.ts:1559`), and a session scope would be a **third** copy
that can disagree with both. No `TenantAccessGrantId`: `PrincipalContext` (`model/access.ts:1003`)
carries a slot for the partner axis and **none** for the platform axis, so a grant id on the session
would be an input `decide()` (`:1177`) cannot read and would have to be resolved by a second path.
No `partnerId` — the stored version was `Membership.partnerScope`, deleted on 5 Aug for opening on
its null case. No `isStaff` — it is `connection.owner.kind === 'platform'`. No email, no display
name, no IP, no user-agent: `PrincipalContext.subject` is already *"structurally narrowed to
`{ userId, status }`"* so that no evaluation can reach an email. No `sessionToken`.

⚠️ **And the contentless discipline cannot be pointed at this type, which is worth recording rather
than working around.** `Timestamp = string` (`model/kernel.ts:422`), so `string extends Timestamp`
is **true** and both `AssertNoPlainText` and `AssertNoTextDeep` (`model/reconciliation.ts:248`) map
every timestamped field to `never`. Neither has met a timestamped type before, because the engine is
clockless by construction. **`Session` is the first type in this repository the assertion cannot
address**, and claiming otherwise would be §5.6 — a control that passes while asserting nothing. The
substitute is an exact-key-set assertion in `model/identity.ts`, which is stronger for this purpose
because it refuses a tenth field of *any* type, including a `string`:

```ts
export type _SessionIsNotTenantScoped =
  Session extends TenantScoped ? never : Session

type SessionKeys =
  | 'id' | 'handleDigest' | 'userId' | 'connectionId' | 'tenantId'
  | 'authenticatedAt' | 'secondFactorAt' | 'expiresAt' | 'revokedAt'

/** Mutual assignability in BOTH directions — one `extends` would pass a widening. */
export type _SessionCarriesExactlyTheseKeys = AssertSameType<{
  sessionKeySet: { viaKernel: keyof Session; viaOwner: SessionKeys }
}>
```

🛑 **Write each of those RED before believing it green.** `model/identity.ts:21` states the rule:
*"An assertion that has never failed is a comment with extra steps."*

**The mid-flight row, which nobody had named and the ruling forces.** A federated sign-in has state
*between* the redirect and the callback — relay state, nonce, PKCE verifier, which connection was
chosen. In a stateful server that lives in a process map or a signed cookie. **Under the ruling it
must be a row, or a callback landing on a different node than the redirect cannot be validated —
which is precisely the node dependence the ruling exists to remove.**

```ts
/**
 * MID-FLIGHT AUTHENTICATION STATE, DURABLE.
 *
 * 🛑 IT IS NOT A SECOND VOCABULARY (§5.3): the three existing nouns express
 * none of it. `Session` begins the instant authentication SUCCEEDS and this row
 * is destroyed at that instant. `AccessSession` (`model/governance.ts:915`) is
 * "one period of actual use" drawn against a `TenantAccessGrant`
 * (`model/governance.ts:854`) — it presupposes a grant, a tenant and a staff
 * principal, three things that do not exist here. `AskSession`
 * (`model/domain.ts:4243`) is a DOCUMENT of turns a human reads.
 *
 * SINGLE USE, AND THE ROW IS THE ENFORCEMENT. `consumedAt` is set in the SAME
 * transaction that mints the `Session`, under the row's own uniqueness, so a
 * replayed callback finds a consumed row and is refused. A process map cannot
 * make that atomic across two nodes; a row can.
 */
export interface SignInAttempt {
  id: SignInAttemptId
  /** The relay/state parameter's digest, never the parameter. */
  handleDigest: SessionHandleDigest
  /** WHICH DOOR WAS CHOSEN, pinned at redirect and never re-chosen at callback:
   *  re-choosing lets a caller name a different connection than the one it was
   *  sent to, which is the org axis read from a request. Invariant 1's shape,
   *  one axis over. */
  connectionId: IdentityConnectionId
  /** The IdP's own nonce/verifier, digested. Compared, never re-derived. */
  challengeDigest: SessionHandleDigest
  startedAt: Timestamp
  expiresAt: Timestamp
  consumedAt: Timestamp | null
  /** ⚠️ NO `userId`, DELIBERATELY. Before the door answers there is no
   *  principal, and a `userId` written at redirect would be a user-existence
   *  oracle on an UNAUTHENTICATED surface. */
}
```

#### `model/access.ts` — the resolver

Insertion point: immediately before `decide()`'s section (`model/access.ts:1177`) or immediately
before `authorize()` (`:1659`) — the reports differ and both are defensible. Its output feeds
`PrincipalContext` (`:1003`), its consumers are `decide()` and `authorize()`, and `ORG_CLASSES` is
at `:207`. Everything below is `import type`, so **no `.ts` specifier and no new runtime edge**.

```ts
/* ------------------------------------------------------------------ *
 * THE FIRST LINK IN INVARIANT 1'S CHAIN.
 *
 * `db/tenant-scope.ts:97-99` says of `withTenantScope()`: "`tenantId` comes
 * from an authenticated session. INVARIANT 1: it is never read from a request
 * payload, and this function cannot check that — it is the last link in the
 * chain, not the first." THIS IS THE FIRST LINK, and it is the only function
 * permitted to produce a `tenantId` for `withTenantScope()` to consume.
 *
 * PURE AND TOTAL. No clock (`now` is a parameter, exactly as
 * `PrincipalContext.now` is at `model/access.ts:1003`, for the same
 * audit-reproducibility reason), no randomness, no I/O, no throw. The rows are
 * read by the caller and passed in — which is what makes every refusal below
 * testable without a database, and therefore testable at all today.
 * ------------------------------------------------------------------ */

/**
 * SESSION BOUNDS — REQUIRED CONFIGURATION, REFUSING ON ABSENCE.
 *
 * `PRODUCT.md` forbids inventing a figure and a bound with no number is not a
 * bound, so THERE IS NO DEFAULT LIFETIME ANYWHERE HERE. The numbers are the
 * owner's (§7 S-4); until they exist, every session refuses. This is the
 * `retentionWindowValid()` posture — the bound is a PARAMETER, never a model
 * constant, because a constant is wrong for the second customer and stale for
 * the first.
 */
export interface SessionBounds {
  readonly maxLifetimeSeconds: number
  readonly maxIdleSeconds: number
  readonly secondFactorRequired: boolean
}

/**
 * WHY A SESSION DID NOT RESOLVE. A REASONED UNION, NEVER A BOOLEAN (§5.2), in
 * `resolveModel()`'s shape (`model/catalog.ts`) — whose own history is the
 * argument: an empty allow-list once permitted the entire catalogue on the
 * control carrying invariant 7.
 *
 * SEPARATE FROM `DECISION_REASONS` AND NOT A SECOND VOCABULARY FOR IT. These
 * answer a question `decide()` cannot be asked: whether there is a principal AT
 * ALL. `DECISION_REASONS` answers what a principal may do. `subject_not_active`
 * appears in both and is spelled IDENTICALLY on purpose — it is the same fact
 * discovered one step earlier, and two spellings of one fact is the shape this
 * record names most often.
 */
export type SessionRejection =
  | { reason: 'session_unknown' }
  | { reason: 'session_revoked'; revokedAt: Timestamp }
  | { reason: 'session_expired'; expiresAt: Timestamp }
  | { reason: 'session_lifetime_exceeded'; authenticatedAt: Timestamp }
  | { reason: 'second_factor_required' }
  | { reason: 'second_factor_replayed' }
  | { reason: 'connection_disabled'; connectionId: IdentityConnectionId }
  /** Two answers to "which door", and one of them would decide the
   *  organisation. REFUSED rather than arbitrated. */
  | { reason: 'connection_owner_mismatch' }
  | { reason: 'subject_not_active' }
  | { reason: 'tenant_not_selected' }
  | { reason: 'tenant_suspended' }
  | { reason: 'tenant_row_mismatch' }
  | { reason: 'user_row_mismatch' }
  | { reason: 'connection_row_mismatch' }
  /** A bound was absent or not a positive finite number. FAIL CLOSED. */
  | { reason: 'bounds_not_configured'; field: keyof SessionBounds }
  /** `now` did not parse. The clock is a PARAMETER; a bad one refuses. */
  | { reason: 'evaluation_time_unparseable' }

export type SessionResolution =
  | { ok: true; context: TenantContext }
  | { ok: false; rejection: SessionRejection }

/**
 * THE RESOLVED REQUEST CONTEXT — the type the whole contract surface presumes
 * and nobody wrote. It is named seven times on the wire and appears in `model/`
 * zero times (`grep -rn 'TenantContext' model/*.ts | wc -l` → 0). That is §5.3
 * with a wire on one side and nothing on the other, and G71 decides which side
 * wins.
 *
 * 🛑 IT IS DERIVED PER REQUEST AND PERSISTED NOWHERE. `Session` is the stored
 * INPUT; this is the computed OUTPUT. That resolves the apparent contradiction
 * between "org is stored nowhere" and "`TenantContext` still needs an org
 * slot": an EVALUATION carries org, a ROW does not.
 * `AuthorizationGrant.orgClass` (`model/access.ts:1559`) stamps it because a
 * grant is a RECORD.
 */
export interface TenantContext {
  sessionId: SessionId
  tenantId: TenantId
  /** The same narrow shape `PrincipalContext.subject` carries, for the same reason. */
  subject: { userId: UserId; status: 'active' | 'disabled' }
  /** DERIVED FROM `IdentityConnection.owner` AT THIS RESOLVE. Never stored. */
  orgClass: OrgClass
  partnerId: PartnerId | null
  residency: RegionKey
  environment: TenantEnvironment
  deploymentMode: DeploymentMode
  /** The `now` this context was resolved at. Reproducible, never a clock read. */
  resolvedAt: Timestamp
}

/**
 * ORG DERIVATION, TOTAL BY CONSTRUCTION. A fourth owner arm is a COMPILE ERROR
 * here rather than an arm that silently inherits whichever `OrgClass` was
 * written first — the discipline `CAPABILITY_RESOURCE_CLASS`
 * (`model/access.ts:556`) and `DURABLE_ASSIGNMENT_PERMITTED` (`:232`) set.
 *
 * ⚠️ AND UNLIKE THOSE TWO, THIS ONE HAS A CONSTRUCTION SITE THE DAY IT LANDS —
 * itself. §5.10's defect is a total `Record` used as a FIELD TYPE with nothing
 * constructing one; a `const` annotated `Record<K,V>` IS its own construction
 * site, so `tsc` genuinely fails on a missing key. The fixture witnesses the
 * VALUES; this only witnesses the keys.
 */
export const ORG_CLASS_FOR_CONNECTION_OWNER: Record<
  'platform' | 'partner' | 'customer', OrgClass
> = { platform: ORG_CLASSES.platform, partner: ORG_CLASSES.partner, customer: ORG_CLASSES.customer }

/**
 * DERIVE THE ORGANISATION AND THE PARTNER FROM THE DOOR. THE ONLY PLACE EITHER
 * IS DERIVED. It takes the CONNECTION — not the session, not the user — so
 * there is no field to omit. `Membership.partnerScope`'s deletion on 5 Aug is
 * the argument: `effectivePartnerRole()` "opened on the null case", so the
 * check meant to close the second door was satisfied by not mentioning it. A
 * PARAMETER cannot be omitted.
 */
export function orgFor(owner: IdentityConnection['owner']): {
  orgClass: OrgClass
  partnerId: PartnerId | null
}

/**
 * RESOLVE A SESSION ROW INTO A REQUEST CONTEXT, OR REFUSE WITH A REASON.
 *
 * ORDER IS DELIBERATE, and it is the principle `authorize()`
 * (`model/access.ts:1659`) states: checks answerable from the supplied values
 * alone run FIRST, so a malformed input never receives a resolution it could
 * mistake for an authenticated one. Row agreement, then liveness, then
 * selection, then derivation.
 *
 * ⚠️ IT TAKES NO CALLER-SUPPLIED OVERRIDE OF ANY KIND. A `skipSecondFactor` or
 * `allowExpired` parameter would be §5.2 on the one gate every request passes,
 * and G79 refused exactly that shape on a residency check. It is also the
 * mutation a performance complaint will actually produce.
 *
 * ⚠️ IT HAS NO `tenantId` PARAMETER, and neither does the mint request. That is
 * invariant 1 expressed as an ABSENCE IN A SIGNATURE.
 */
export function resolveSession(input: {
  session: Session
  user: User
  connection: IdentityConnection
  /** Nullable ON PURPOSE: a session that selected nothing has no tenant row,
   *  and passing `null` is how the caller says so rather than being handed a
   *  fabricated row. */
  tenant: Tenant | null
  held: readonly HeldAssignment[]
  partnerGrant: PartnerGrantTerms | null
  bounds: SessionBounds
  now: Timestamp
}): SessionResolution
```

**What it refuses, and the failure direction of each.**

| Declaration | Refuses | Fails |
|---|---|---|
| `resolveSession()` | sixteen named conditions, returned as values | **CLOSED** — no arm returns `ok: true` by default; the success branch is reached only after all of them |
| `resolveSession()` — `bounds` | `bounds_not_configured`, naming the field | **CLOSED** — an unset bound refuses every session. No default appears anywhere, so `PRODUCT.md`'s ban is honoured by construction rather than by review |
| `resolveSession()` — `now` | `evaluation_time_unparseable` | **CLOSED** — a caller cannot omit the clock and cannot get a silent `NaN` comparison |
| `orgFor()` | nothing; it is total | a missing owner arm is a **COMPILE ERROR**, not a runtime default |
| `_SessionCarriesExactlyTheseKeys` | a tenth field of any type | **COMPILE ERROR** |
| `_SessionIsNotTenantScoped` | `Session extends TenantScoped` | **COMPILE ERROR** |
| `SessionHandleDigest` brand | assigning a raw handle | a **deliberate cast** — a seam, not a wall. Recorded honestly: the control is a test asserting the stored digest differs from a known input |

**The migration.** Forward-only under G88; `0001` is never edited.

```sql
-- =====================================================================
-- 0002 — SESSION AND SIGN-IN ATTEMPT: THE TWO PRE-TENANT TABLES.
--
-- 🛑 THE STRUCTURAL FACT THIS FILE EXISTS TO HANDLE. Every other scoped table
--    is protected by  tenant_id = nullif(current_setting('app.tenant_id',true),'')
--    (0001:179-180). THAT PREDICATE CANNOT PROTECT THESE TWO. A session between
--    authentication and tenant selection has tenant_id NULL, and under G100's
--    deny-on-NULL polarity `NULL = anything` is NULL, which is not TRUE — so the
--    row would be invisible to the very connection that just wrote it. Worse:
--    at the moment the session is READ, app.tenant_id is not yet set, BECAUSE
--    THE SESSION IS WHAT DECIDES IT. The chain has a first link and the first
--    link cannot be secured by the thing it produces.
--
-- RULINGS APPLIED: G97 (text ids, stored verbatim, no cast) · G100 (deny on
-- NULL; migrator, never the owner, runs this) · G101 (transaction-mode pooling
-- assumed; every read inside an explicit transaction) · G88 (forward-only).
-- =====================================================================

CREATE TABLE session (
  id                text        PRIMARY KEY,
  handle_digest     text        NOT NULL UNIQUE,
  user_id           text        NOT NULL,
  connection_id     text        NOT NULL,
  -- NULLABLE, AND IT IS WHY THIS TABLE NEEDS ITS OWN POLICY.
  tenant_id         text        NULL REFERENCES tenant (id) ON DELETE CASCADE,
  authenticated_at  timestamptz NOT NULL,
  second_factor_at  timestamptz NULL,
  expires_at        timestamptz NOT NULL,
  revoked_at        timestamptz NULL
);

CREATE TABLE sign_in_attempt (
  id                text        PRIMARY KEY,
  handle_digest     text        NOT NULL UNIQUE,
  connection_id     text        NOT NULL,
  challenge_digest  text        NOT NULL,
  started_at        timestamptz NOT NULL,
  expires_at        timestamptz NOT NULL,
  consumed_at       timestamptz NULL
);

ALTER TABLE session         ENABLE ROW LEVEL SECURITY;
ALTER TABLE session         FORCE  ROW LEVEL SECURITY;
ALTER TABLE sign_in_attempt ENABLE ROW LEVEL SECURITY;
ALTER TABLE sign_in_attempt FORCE  ROW LEVEL SECURITY;

-- THE PREDICATE. Read it exactly as 0001 asks you to read that one — three
-- parts, same polarity:
--   current_setting(..., true)  missing_ok, so an unset GUC returns NULL rather
--                               than RAISING: a forgotten scope is an EMPTY
--                               READ refusable as `session_invalid`, not a 500.
--   nullif(..., '')             a GUC that was SET and reverted reads back as
--                               the EMPTY STRING; without this the predicate is
--                               `handle_digest = ''`, which denies BY ACCIDENT.
--   = NULL                      NULL, not TRUE, so the row is filtered.
--
-- ⚠️ LIVENESS IS NOT IN THE PREDICATE, DELIBERATELY. `AND revoked_at IS NULL AND
-- expires_at > now()` would make a revoked session INVISIBLE rather than
-- REFUSABLE, collapsing `session_revoked` and `session_expired` into
-- `session_unknown` and destroying the diagnosis. It would also put `now()`
-- inside a policy, where it is unreproducible.
CREATE POLICY session_rls ON session
  USING      (handle_digest = nullif(current_setting('app.session_ref', true), ''))
  WITH CHECK (handle_digest = nullif(current_setting('app.session_ref', true), ''));

CREATE POLICY sign_in_attempt_rls ON sign_in_attempt
  USING      (handle_digest = nullif(current_setting('app.signin_ref', true), ''))
  WITH CHECK (handle_digest = nullif(current_setting('app.signin_ref', true), ''));

-- WITH CHECK is stated explicitly rather than defaulted from USING, so a later
-- FOR SELECT / FOR ALL edit cannot silently drop the write half — 0001's own
-- reasoning, and here it is what makes minting work at all.
GRANT SELECT, INSERT, UPDATE ON session         TO reconcile_app;
GRANT SELECT, INSERT, UPDATE ON sign_in_attempt TO reconcile_app;
-- No DELETE: a session ends by `revoked_at`, not by vanishing.
-- Expiry sweeping runs as reconcile_migrator (BYPASSRLS — `db/env.ts:19`),
-- because a sweep by definition holds no handle. It is machine work with no
-- principal, which `AUTHORIZATION_MAY_BE_ABSENT` (`model/governance.ts:1232`)
-- permits for exactly one actor kind.
```

**And the companion in `db/`, beside `withTenantScope()` (`db/tenant-scope.ts:101`):**
`withSessionScope(pool, handleDigest, fn)` — `BEGIN`, then
`SELECT set_config('app.session_ref', $1, true)`, run, `COMMIT`, in
`withTenantScope()`'s exact shape and answering the same three leak modes
(`db/tenant-scope.ts:56` enumerates them for the tenant GUC and every word transfers). 🛑 **What
must not happen is the third option nobody would write down: issuing the session read through
`pool.query(...)`.** `TenantPool` (`db/tenant-scope.ts:69`) has no `query` method precisely so that
is a compile error. **Do not add one.**

#### 🛑 Where the two session designs DISAGREE, left open

| | Report A — `stateless-green-session.md` | Report B — `stateless-green-state-audit.md` | Why it matters |
|---|---|---|---|
| **The RLS key** | `app.session_ref` = the **handle digest**; one GUC, no lookup function | `app.session_id` = the **row id**, reached through a `SECURITY DEFINER` function `session_id_for_token(text)` returning **only the id** | A carries no privileged function; B needs the single most security-relevant object in the schema and its own two-row negative test. **B's bootstrap problem is real and A avoids it; A's digest becomes a GUC value on every request.** This is **S-2** |
| **`lastUsedAt`** | **off the row.** Copying `TenantAccessGrant.lastUsedAt` (`model/governance.ts:854`) turns every READ request into a WRITE and a row lock for the request's duration — a grant is drawn a handful of times per engagement, a session once per HTTP request | **on the row**, with idle expiry in the bounds | §6.3 prices it. **S-4** |
| **What the resolver returns** | `TenantContext`, with a separate `principalFor()` building the `PrincipalContext` | `PrincipalContext` directly | A is one more declaration and one more place to get `partnerGrant` wrong; B collapses two concerns. **Both are defensible; nobody adjudicated** |
| **The refusal vocabulary** | a `const` object `SESSION_REFUSALS` plus a derived union | a discriminated union `SessionRejection` whose arms **carry the offending value** | B's arms carry data, which is more useful and more likely to reach a log. Neither is checked against `ErrorCode` — see §6.4 |
| **Enumerable sessions** | explicitly unanswerable: nothing in the request plane can list sessions, which is a **property** and a cost — *"sign me out everywhere"* is not implementable without a generation counter on `User` | not addressed | **S-5** |

### (b) Resumable work — runs, the reader seam, the queue

**The ruling on this surface, and it is the cheapest result in the four reports:**

> **The durable artefact is the PINNED INPUT plus the STORED VERDICTS. Never the folded state.**

Two independent reasons the fold's state may not be serialised, both verified. **First,
`canonicalise()` REFUSES `bigint` rather than serialising it** (`model/canonical.ts:66`) — after G65
`Money.amountMinor` is `bigint`, and inventing an encoding would be *"a SECOND answer to how money
is represented, on the bytes an audit chain signs"*. **Second, folded state holds counterparty prose
—** `AdmittedItem.untrustedDescription` — so a table of it is a new at-rest copy of personal data
and `SubjectLocation` (`model/governance.ts:1772`) has no variant for it. Re-deriving from
`SourceDocument` (`model/domain.ts:1849` is its `storageRef`) creates **no new erasure surface at
all**.

**So re-running the pure fold IS the resume**, and it needs two preconditions **neither of which
holds today**: a stated total order over the document arrays, and everything the fold reads pinned
to the run. `ReconciliationRun` (`model/domain.ts:2700`) pins only `definitionVersion`;
`SetReconciliationInput` (`model/reconciliation.ts:2589`) takes eight bounds and two classification
collections **from the caller**. **A policy edit between attempt 1 and attempt 2 silently changes
the fold and nothing anywhere would notice.** That is the sharpest finding on this surface.

```ts
/**
 * EVERYTHING THE FOLD READS, PINNED AT RUN ADMISSION AND READ BACK VERBATIM ON
 * EVERY ATTEMPT. Proposed for a new `model/execution.ts` — see §6.6 for the
 * cost of a nineteenth module and §7 S-9 for whose call that is.
 *
 * ⚠️ ORDERED ARRAYS, NOT `ReadonlyMap`/`ReadonlySet`, AND THE REASON IS
 * MECHANICAL: `canonicalise()` refuses a `Map` outright rather than silently
 * transforming it, and a plan that cannot canonicalise cannot be digested. The
 * caller builds the Map at fold time; the PLAN stores the ordered pairs.
 *
 * ⚠️ `leftDocumentIds`/`rightDocumentIds` ARE THE TOTAL ORDER NOBODY STATED.
 * Storing the array IS the total key: the order the run was admitted with is
 * the order every attempt folds in.
 */
export interface RunPlan {
  readonly runId: RunId
  readonly tenantId: TenantId
  readonly definitionId: DefinitionId
  readonly definitionVersion: number
  readonly leftDocumentIds: readonly SourceDocumentId[]
  readonly rightDocumentIds: readonly SourceDocumentId[]
  readonly obligationSide: PopulationSide
  readonly toleranceDirection: ToleranceDirection
  readonly readerCandidateCap: number
  readonly similarityMaxChars: number
  readonly similarityMetric: SimilarityMetric
  readonly subsetSumBound: SubsetSumBound
  /** G106. Ordered by path so the plan canonicalises identically every time. */
  readonly fieldClassification: readonly (readonly [FieldPath, DataClass])[]
  readonly modelPromptEligible: readonly FieldPath[]
}
```

🛑 **THE DIGEST HALF OF THIS CONTROL IS BLOCKED AND NO DOCUMENT MAY SAY THE PLAN IS HASHED.** The
per-strategy tolerances carry `Money`, and `canonicalise()` refuses `bigint`
(`model/canonical.ts:66`), so **`runPlanDigest` cannot exist until G111's money codec exists.**
Until then the control is *read the plan back and compare structurally* — which detects an honest
change and **does not detect tampering**. That is a weaker control and it must be labelled as one.

**The bounds, with the one ceiling that is derived rather than chosen.**

```ts
export interface WorkBound {
  readonly maxAttempts: number
  readonly leaseSeconds: number
  readonly maxItemsPerClaim: number
  readonly maxRunAttempts: number
  readonly staleRunSeconds: number
  /** Above this a run REFUSES, never chunks. */
  readonly maxResultRowsPerTransaction: number
}

export type WorkBoundDefect =
  | { kind: 'max_attempts_not_stated' }
  | { kind: 'lease_seconds_not_stated' }
  | { kind: 'max_items_per_claim_not_stated' }
  | { kind: 'max_run_attempts_not_stated' }
  | { kind: 'stale_run_seconds_not_stated' }
  | { kind: 'max_result_rows_not_stated' }
  /**
   * 🛑 THE ONE CONTROL HERE WORTH MORE THAN THE REST COMBINED, AND ITS NUMBER
   * IS DERIVED RATHER THAN CHOSEN. A lease may not outlive the authority the
   * work runs under. G121 rules ONE `AuthorizationGrant` per map execution;
   * grants are bounded by `MAX_AUTHORIZATION_SECONDS`
   * (`model/access.ts:1517`), which is total over `AccessResourceClass` so a
   * fourteenth class is a compile error. A worker holding a thirty-minute lease
   * on a `tenant_data` act whose grant lives 900 seconds
   * (`model/access.ts:1530`) would be acting for twenty-one minutes under an
   * EXPIRED authorisation — invariant 10's exact failure, arrived at through a
   * scheduling parameter.
   */
  | { kind: 'lease_exceeds_authorization_ceiling'
      resourceClass: AccessResourceClass; ceilingSeconds: number }

/** Total, pure, no clock. Returns EVERY defect rather than the first — a caller
 *  fixing configuration wants the whole list. */
export function validateWorkBound(
  bound: WorkBound, resourceClass: AccessResourceClass,
): readonly WorkBoundDefect[]
```

**`RunStatus`, extracted from an inline field union.** `ReconciliationRun.status`
(`model/domain.ts:2700`) is an inline union restated twice on the wire and **it is not one of the
pairs `tools/check-wire-mirror.mjs` watches**, because that checker reads `export type X =` unions
and `export const X = {} as const` values and an inline field union is neither. **So it drifts
unwatched, in two places.** Naming it makes a sixth pair possible.

```ts
/**
 * `awaiting_readers` is the state the ruling turns on and the four-arm union
 * could not express: the fold is done, N verdicts are outstanding, and NO NODE
 * NEEDS TO HOLD ANYTHING. Folding it into `running` makes a legitimately parked
 * run indistinguishable from a dead node's run — which is precisely the
 * distinction the reaper exists to make. It is NOT a second spelling of
 * `running` (§5.3): `queued` means no node has started, `running` means a node
 * holds a live lease, `awaiting_readers` means nobody needs to.
 */
export const RUN_STATUSES = {
  queued: 'queued', running: 'running', awaitingReaders: 'awaiting_readers',
  completed: 'completed', failed: 'failed',
} as const
export type RunStatus = (typeof RUN_STATUSES)[keyof typeof RUN_STATUSES]
```

**The migration — and the queue is a PREDICATE on the outcome table, not a second table.** This is
the `shippedAt IS NULL` shape the record already has
(`docs/build/event-architecture-recommendation.md:275-289`), applied once more.

```sql
-- 0002 — RUN EXECUTION AND THE READER WORK QUEUE.
-- G97 · G100 · G101 · G88 · G120 (ReaderOutcome keyed by (runId, requestOrdinal)) ·
-- G121 (one AuthorizationGrant per map execution).
--
-- 🛑 `outcome_kind IS NULL` IS THE QUEUE. No second store, no DLQ.

CREATE TABLE run_execution (
  tenant_id          text        NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  run_id             text        NOT NULL,
  status             text        NOT NULL,
  plan               jsonb       NOT NULL,   -- RunPlan, canonicalised by the WRITER
  attempts           integer     NOT NULL DEFAULT 0,
  lease_expires_at   timestamptz,
  authorization_id   text,
  results_written_at timestamptz,
  -- 0001:107 — every scoped table is keyed (tenant_id, id), so a cross-tenant
  -- reference is unrepresentable rather than merely unlikely.
  PRIMARY KEY (tenant_id, run_id)
);

CREATE TABLE reader_request_attempt (
  tenant_id        text    NOT NULL,
  run_id           text    NOT NULL,
  request_ordinal  integer NOT NULL,
  -- The re-derivation witnesses, over ItemRefs only. No VALUE, so no purge date
  -- and no twelfth SubjectLocation variant.
  subject_key      text    NOT NULL,
  candidate_witness text   NOT NULL,
  attempts         integer NOT NULL DEFAULT 0,
  lease_expires_at timestamptz,
  authorization_id text    NOT NULL,
  outcome_kind     text,          -- NULL until settled; NULL IS the queue predicate
  settled_at       timestamptz,
  PRIMARY KEY (tenant_id, run_id, request_ordinal),
  FOREIGN KEY (tenant_id, run_id)
    REFERENCES run_execution (tenant_id, run_id) ON DELETE CASCADE,
  -- A settled row is settled COMPLETELY. Half a verdict is not a state (§5.5).
  CONSTRAINT settled_together CHECK (
    (outcome_kind IS NULL AND settled_at IS NULL) OR
    (outcome_kind IS NOT NULL AND settled_at IS NOT NULL))
);

CREATE INDEX reader_request_attempt_ready
  ON reader_request_attempt (tenant_id, run_id, request_ordinal)
  WHERE outcome_kind IS NULL;   -- partial: the size of the OUTSTANDING work

ALTER TABLE run_execution          ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_execution          FORCE  ROW LEVEL SECURITY;
ALTER TABLE reader_request_attempt ENABLE ROW LEVEL SECURITY;
ALTER TABLE reader_request_attempt FORCE  ROW LEVEL SECURITY;

-- THE PREDICATE, VERBATIM FROM 0001:179-180. One polarity, not two.
CREATE POLICY run_execution_rls ON run_execution
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));
CREATE POLICY reader_request_attempt_rls ON reader_request_attempt
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

GRANT SELECT, INSERT, UPDATE ON run_execution          TO reconcile_app;
GRANT SELECT, INSERT, UPDATE ON reader_request_attempt TO reconcile_app;
-- No DELETE. A worker that could delete a work item could delete the evidence
-- that a paid call was made.
```

**Three SQL shapes carry the whole design, and each fails closed:**

- **CLAIM** — `FOR UPDATE SKIP LOCKED` over `outcome_kind IS NULL AND (lease_expires_at IS NULL OR
  lease_expires_at < now())`, `ORDER BY run_id, request_ordinal`, `LIMIT maxItemsPerClaim`,
  incrementing `attempts`. **No tenant predicate: RLS supplies it.** ⚠️ `now()` is
  `transaction_timestamp()`, so every row in one claim gets the **same** deadline —
  `clock_timestamp()` would let a worker hold half a batch past its lease.
- **SETTLE** — `UPDATE … WHERE run_id = $1 AND request_ordinal = $2 AND outcome_kind IS NULL`.
  `rowCount 0` means *already settled*, and the losing node learns it lost.
- **THE GUARDED TRANSITION** — `UPDATE run_execution SET status = $2 WHERE run_id = $1 AND status =
  $3`, the **expected prior** status. `rowCount 0` means another node advanced it and **the losing
  node's work is discarded, never merged.** Every transition goes through this one statement.

**The lease is the transaction, so no lease TYPE is needed and adding one is a defect.** `SKIP
LOCKED` inside `withTenantScope()`'s explicit transaction (`db/tenant-scope.ts:101`) *is* the lease:
a node that dies aborts its transaction and the row unlocks with **no expiry, no sweeper and no
clock**. A `leased_until` column re-introduces a wall-clock read, a timer and a node-dependent
sweeper — three things the ruling forbids — to solve a problem the transaction already solved.
⚠️ `EntitlementLease` (`model/billing.ts`) is **not** this and must not be reached for: it carries a
signature and a clock, and it is dropped with `model/deployment.ts`.

**Where a worker gets a tenant, and it is not from the message.** `withTenantScope()` needs a
`tenantId` from an authenticated session (`db/tenant-scope.ts:97-99`) and a worker has none. The
answer already exists for ingestion: the consumer takes bucket and key only and **resolves the
tenant from the control-plane-provisioned prefix registry**, which is provisioning configuration
published downward — invariant 3's own direction of travel — and is not tenant data. `LISTEN`/
`NOTIFY` may **wake** the sweep and may not **select** the tenant, and per
`docs/build/event-architecture-recommendation.md:304-307` the poll is the correctness mechanism and
`NOTIFY` is the optimisation. **The rejected alternative is preserved:** a small lease table outside
RLS carrying identifiers only, claimed in one statement across all tenants, O(1) per sweep instead
of O(tenants) — refused because **G103 refused a table outside RLS** for the rule cache on the
ground that four of the model's invariants are enforced BY THE STORE. That refusal has a real cost
and it is **S-10**.

**Idempotent versus effectful, and the durable key for each.**

| Work | Repeat-safe? | The key that makes a repeat a no-op |
|---|---|---|
| the fold, `buildReaderRequests`, `buildResidue`, `checkPostconditions` | ✅ pure, total, deterministic (`model/reconciliation.ts:80`) | **none needed** — the cheapest resume in the system |
| a **model call** | 🛑 costs money | `(tenant_id, run_id, request_ordinal)` PK, settled under `AND outcome_kind IS NULL` |
| a **`UsageRecord`** | 🛑 append-only, no compensating instrument | `UNIQUE (tenant_id, idempotency_key)`, where the key already embeds the meter |
| **`UsageRecord.sequence`** | 🛑 a gap must be *detectable* (`model/billing.ts:158`) | **a counter ROW**, not a `SEQUENCE`. §6.3 |
| the **terminal ledger write** | 🛑 | one transaction: insert the rows, then the guarded transition. `rowCount 0` → ROLLBACK everything |

🛑 **The honest failure mode is UNDER-reporting, not double-billing, and that inverts the naive
expectation.** Die before the call and nothing is spent. Die after the provider answered and before
the settle commits, and money is spent with no outcome row and no meter — the retry makes a
**second** call with a **new** provider request id, so both calls are metered, which is **truthful,
because both calls happened**. The loss is the **first** call: spent and unbilled. The compensating
instrument `model/billing.ts` says the meter table lacks lives **beside the queue instead**:
`attempts` is incremented in the CLAIM transaction, *before* the call, so **`attempts` minus settled
outcomes on a finished run is a countable number of spent-and-unmetered calls.** It is not a
correction; it is a visible discrepancy where today there would be silence. **No reconciliation
against any provider usage API is proposed — none is verified to exist and no figure may be
invented.**

### (c) Held human work — drafts and half-finished judgement

**The ruling on this surface:**

> **A draft is a DISTINCT TYPE. It is never a status field on the committed act.**

Four arguments, each mapped to something already in the record. **(1) §5.5** — `ExceptionResolution`
was a flat record until 5 Aug and `{ mode: 'autonomous', authorisedByPolicyId: null }` was a legal
value, *"the exact state it was created to prevent, legal in the type meant to prevent it"*. A
`status: 'draft' | 'submitted'` on `ResolutionProposal` recreates that precisely: *(a proposal whose
status is draft, an `ExceptionResolution` naming its proposalId)* is two individually legal values
composing an illegal state. **(2) Invariant 10** — an act with no authorisation is unrecordable and
`authorize()` (`model/access.ts:1659`) mints the grant and nothing else does; a draft has no
authorisation and must have **no field for one**. **(3) G127's own words**
(`docs/HANDOFF.md:853`): *"The boundary must be expressed in the TYPE, not in prose."* **(4) It is
already true and costs one brand:** every arm of `ExceptionResolution` requires
`proposalId: ProposalId`, and `Id<T>` brands are nominal (`model/kernel.ts:43`), so
`const x: ProposalId = 'he_1' as HeldEditId` is `TS2322`. **A held draft carrying the other brand is
not CONSTRUCTIBLE as an effect** — no runtime check involved.

**Why a status field is right for a definition and wrong for an act.** A definition is inert until a
run pins it — `ReconciliationRun.definitionVersion` (`model/domain.ts:2700`) is the gate. An act has
no such pin: the effect **is** the row. So the distinction is not stylistic: **a status field is
safe exactly where something else already refuses to execute the draft.** ⚠️ And today
`grep -rn "status === \|status !== " model/*.ts` returns five readers and **not one is a definition
or a procedure** — so even there the refusal is missing. That is a finding about the tree, not about
this design.

```ts
// model/kernel.ts — one new brand, and the ABSENCE is the whole control.
export type HeldEditId = Id<'HeldEdit'>
```

```ts
/**
 * Closure, as a UNION rather than two nullable timestamps: `submittedAt` beside
 * `discardedAt` makes *both non-null* a legal value, which is §5.5 exactly.
 *
 * NOTE WHERE `authorizationId` SITS — on the `submitted` arm ONLY. The
 * SUBMISSION is an act and invariant 10 requires the grant; the OPEN draft is
 * not an act and must not carry one. Putting it here rather than on `HeldEdit`
 * is what makes "an open draft has no authorisation" unrepresentable-otherwise
 * instead of a comment.
 */
export type HeldEditClosure =
  | { readonly kind: 'open' }
  | { readonly kind: 'submitted'; readonly at: Timestamp
      readonly authorizationId: AuthorizationGrantId }
  | { readonly kind: 'discarded'; readonly at: Timestamp }
  /** The anchor moved under the draft and nobody did anything wrong. Borrowed
   *  from `STEP_EXECUTION_OUTCOMES.superseded` — one vocabulary, not a second. */
  | { readonly kind: 'superseded'; readonly at: Timestamp }

export interface HeldEdit extends TenantScoped {
  readonly id: HeldEditId
  /** Id-shaped deliberately: a field called `author` carrying a branded id is
   *  an edge no tool here can see (`docs/HANDOFF.md` §7). */
  readonly authorUserId: UserId
  /** ANCHOR AND BODY IN ONE DISCRIMINATED UNION. Two fields would make *(a
   *  field-confirmation body against an approval-decision anchor)* legal, which
   *  is the shape `ExceptionResolution` was rewritten to eliminate. */
  readonly subject: HeldEditSubject
  /** MONOTONIC WITHIN (tenantId, id). Spelled `sequence`, not `version` — two
   *  things already mean "monotonic within a key" here
   *  (`model/domain.ts:3291`'s and `model/billing.ts:165`), and a third
   *  spelling of one concept is §5.3 in the module that cites it. */
  readonly sequence: number
  /** Same NAME and same job as `DataAccessEvent.maxDataClass`
   *  (`model/governance.ts:1155`).
   *  🛑 COMPUTING IT REQUIRES THE ONE `DataClass` LADDER, WHICH DOES NOT EXIST:
   *  `model/policy.ts` records FOUR copies of the ordering and says the
   *  unification is owed as its own commit. THIS MODULE ADDS NO FIFTH COPY,
   *  and that unification is therefore a hard prerequisite (§6.7). */
  readonly maxDataClass: DataClass
  readonly heldAt: Timestamp
  readonly lastHeldAt: Timestamp
  /** Recomputed from `lastHeldAt`, not fixed at `heldAt` — a document does not
   *  change so its window runs from arrival, but a draft under active edit has
   *  not reached the end of its purpose. */
  readonly purgeAfter: Timestamp
  readonly purgedAt: Timestamp | null
  readonly closure: HeldEditClosure
}

/** Every body is DERIVED from its committed interface by `Omit` + `Partial`, so
 *  a field added to `ResolutionProposal` appears here and a removed one
 *  disappears. `AssertNoCommittedId` and `AssertUnauthorised` — mapped types,
 *  not conditionals, because the obvious form is `TS2313: circular constraint`
 *  — make re-adding `id` or an `authorizationId` a build error. */
```

**Two model tables move with it, and both are irreversible after the first row.** A fourteenth
`RetentionClass` — `heldEdit: 'held_edit'` appended **after** `trace` inside `RETENTION_CLASSES`
(`model/domain.ts:1086`), appended rather than inserted because `tools/check-wire-mirror.mjs`
compares model list against wire enum **as sequences** — plus the required entry in
`RETENTION_RECORD_KIND` (`model/domain.ts:1135`), which is a total
`Record<RetentionClass, RetentionRecordKind>` so **omitting it is a compile error**. And a twelfth
`SubjectLocation` variant, `{ kind: 'held_edit'; heldEditId: HeldEditId }`, appended at
`model/governance.ts:1772`. **Both wire enums must move in the same commit** or
`npm run check:wire` fails — which is the difference between now and 7 Aug, when `notification` was
missing from the wire and *"an erasure index the API will not accept a write to is an erasure index
with a hole in it."*

**The migration's two load-bearing details.** The subject is JSONB with **generated** columns —
`subject_kind`, `anchor_id`, `anchor_path` as `GENERATED ALWAYS AS (subject ->> …) STORED` — so the
column and the body **cannot** diverge and a `CHECK` asserting agreement would be a second place to
be wrong. And the concurrency control is a **partial unique index in the store**, not a version
check in the caller, because `ProcedureStepExecution` (`model/domain.ts:3291`) states the rule:
*"enforce it in the store, not in the caller, or `step_not_current` becomes a race against itself."*

```sql
CREATE UNIQUE INDEX held_edit_one_open ON held_edit (
  tenant_id, author_user_id, subject_kind,
  coalesce(anchor_id, ''), coalesce(anchor_path, ''))
  WHERE closure_kind = 'open';
-- TWO TABS, ONE ARTIFACT: the second tab does not create a second row. It finds
-- the same row and hits the `sequence` check, which turns a silent
-- last-write-wins into a refusal with a reason.
-- `author_user_id` IS IN THE KEY DELIBERATELY: two people holding two rejection
-- reasons against one proposal is `ApprovalConfig.quorum`'s normal case.

CREATE POLICY held_edit_rls ON held_edit    -- predicate verbatim from 0001:179
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));
```

The replace statement is the **only** way a body ever changes — `UPDATE … WHERE id = $1 AND sequence
= $2 AND closure_kind = 'open' AND purged_at IS NULL RETURNING sequence` — with **no `tenant_id =`
term**, because RLS is the enforcement and a second copy of invariant 1 in every statement is
§5.3's shape. The retention sweep **redacts rather than deletes**: `SET subject = subject - 'draft'`,
leaving `kind`, `anchorId` and `path` so the generated columns stay valid and the row survives as a
tombstone. **A purged row no longer satisfies `HeldEditSubject`, which is correct and intended** —
the reader returns a `purged` refusal, never a `HeldEdit` with a null body, because a nullable body
would make *(open, body null)* legal.

**One arm is declared and cannot be submitted, and that is stated rather than hidden.** The
confirmed-field arm has **no committed counterpart**: no capability names the act, no operation
performs it, the value has no home and the event type does not exist. The refusal
`no_committed_counterpart` is **unconditional** — it makes an un-buildable promotion path visible
instead of silently absent. Whether the arm should be declared at all is **S-12**.

---

## 4. The mechanical control — `tools/check-stateless.mjs`

**The ruling's own enforcement does not exist**, and the mutation that proves it is one line: a
module-level `Map<string, PrincipalContext>` in a request handler. Nothing in this repository catches
that today. Under **G108** a new checker **joins `npm run check` rather than standing beside it**, and
it must be **deterministic and fast**.

```json
"check:stateless": "node tools/check-stateless.mjs",
"check": "npm run typecheck && npm run check:counts && npm run check:citations && npm run check:wire && npm run check:packs && npm run check:stateless && npm test"
```

⚠️ **The workflow file is NOT touched.** `tests/ci/gate.test.ts:61` declares
`CHECKERS_THE_WORKFLOW_MAY_NOT_NAME` and fails if CI names an individual checker, so
`check:stateless` must be **added to that list** — which is G108 enforced by a test rather than by a
convention.

**Roots, and why each is in or out.** `model/` ✅ (types-first, but `reconciliation.ts`,
`canonical.ts`, `policy.ts` and `access.ts` are executable) · `db/` ✅ · `api/` `server/` `worker/`
`app/` `web/` ✅ **when they exist, and their absence is REPORTED** · `tools/` 🛑 out (one-shot CLI
processes; scanning them would flag `check-citations.mjs`'s own file cache and this checker's own
accumulators — a control that fails while the property holds, which
`model/reconciliation.ts:10` records as teaching people to ignore controls) · `tests/` 🛑 out (a test
process is one process by definition).

**Comments are stripped before any rule runs.** Not an optimisation — the lesson at
`model/reconciliation.ts:10`: the first version of that header's controls reported non-zero on six of
nine and *"every hit was this header quoting the thing it bans."* The waiver marker is itself a doc
comment, so the scanner reads comments **once** to harvest markers and then matches rules against
the comment-stripped text.

**The nine named rules. Findings are violations only; any unwaived finding exits 1.**

| | Rule | Matches | Why |
|---|---|---|---|
| 1 | `module_scope_mutable_binding` | top-level `let`/`var` at column 0, optionally after `export ` | the direct form. Today: **one hit, waived** (`db/pg.ts:25`) |
| 2 | `module_scope_mutable_container` | top-level `const X = new Map()/new Set()/[]/{}` **AND** the same file mutating `X` | **two-part on purpose.** A frozen lookup table is not state, and flagging it would teach people to ignore the checker |
| 3 | `wall_clock_read` | `Date.now()`, `new Date()` with **zero** arguments, `performance.now()`, `process.hrtime` | a retry that reads a clock cannot replay. `new Date(x)` is arithmetic and is **not** matched — that distinction is the whole reason `model/` is clean today |
| 4 | `unseeded_randomness` | `Math.random(`, `crypto.randomUUID(`, `getRandomValues(`, `randomBytes(`, `randomInt(` | a hash, an ordinal or an idempotency key derived from randomness is not reproducible |
| 5 | `process_local_filesystem` | `os.tmpdir(`, `mkdtemp`, `createWriteStream(`, `writeFileSync(`, a literal starting `/tmp` | a container's temp directory is process-local state. §6.7 prices what this takes away |
| 6 | `timer_as_durable_state` | `setInterval(`, `setTimeout(` outside a waived site | an in-process retry timer or sweeper dies with the node. The outbox poll's *position is a row*, not a timer holding work |
| 7 | `global_assignment` | `globalThis.` / `global.` on an assignment LHS | rules 1–2's escape hatch |
| 8 | `tenant_pool_exposes_query` | `TenantPool`'s interface body containing `query` | **the highest-value rule in the list and the cheapest.** `db/tenant-scope.ts:69` makes `pool.query()` a compile error **by omission**, and an omission is one autocomplete away from being undone. `tsc` stays green if it is re-added — the field is additive and nothing calls it — so this mutation is **invisible to every other control in the repository** |
| 9 | `malformed_waiver` | a `@node-local` marker missing a date, a `—` reason or a `Reconstructible:` clause | a waiver with no argument is a comment, and it must **fail** rather than waive |

**The explicit waiver shape.** A waiver that lives in the checker rots when its author leaves;
`docs/HANDOFF.md:63` states the principle for the drop notes — *"the note on the declaration is the
authority, because it travels with the code and cannot go stale separately from it."* Same
mechanism, one axis over:

```
/** @node-local 9 Aug 2026 — <why no tenant datum, no request datum and no
    decision can reach this binding>. Reconstructible: <how a cold node
    rebuilds it>. */
```

**Three clauses, all three required, and the checker checks the SHAPE not the prose.** Missing any
clause **does not waive** — it becomes a `malformed_waiver` and exits 1. Today the marker has
**exactly one call site**: `db/pg.ts:25`, whose surrounding comment already argues its own honesty
(`db/pg.ts:17` — *"THE SKIP IS ONLY HONEST WHILE IT IS LOUD"*).

**`vacuous` — the field that makes today's clean run honest.** Modelled on
`tools/check-pack-safety.mjs:24`: *"the `vacuous` field below exists so the state is reported rather
than mistaken"* for a clean pass. Every absent root is listed, with the sentence that matters:
**the request path is where this defect lives and there is no request path, so a clean run today is
not evidence that the application is stateless — it is evidence that there is no application.**

**What it CANNOT see, and every checker here says so of itself:**

- a container built by a **factory call** — `const reg = makeRegistry()` holds mutable state and
  rule 2 cannot match it.
- state inside a **dependency** — `pg.Pool`'s own queue, an `https.Agent` keep-alive pool, any
  library LRU. It scans our source, not `node_modules`.
- a transaction or a cursor held open **across requests**.
- state that is durable but still **node-local** — a local volume, an EFS mount, a file written by a
  spawned binary, a warm Lambda's `/tmp`.
- **sticky routing.** ALB stickiness, a WebSocket server, an SSE connection pinned to a node. None
  of it is in source and **there is no IaC in this repository to read.** (Verified today:
  `grep -rn 'websocket\|WebSocket\|event-stream\|EventSource' docs/contracts/*.yaml` → 0.)
- whether a durable write **committed before the response was sent**. A write-behind passes every
  rule here.
- **browser** state — localStorage, an in-tab wizard object. A different node dependence, and there
  is no frontend root to scan.
- **an SQL predicate.** The migration is SQL; rule 8's sibling for `USING (true)` does not exist and
  the only defence is a two-row negative test.
- 🛑 **whether a waiver is TRUE.** It checks shape. The same shape covers `db/pg.ts:25` and a
  tenant-keyed schema cache, and only a person can tell them apart — the limit
  `docs/HANDOFF.md:104` already records for `@dropped-for-v1`. **Its silence is not evidence of
  correctness.**

**Determinism and speed, G108's condition.** One directory walk, one pass per file, no YAML, no
`import` of any `model/` module, no network, no clock in the checker's own output. Findings sorted by
`(file, line, rule)` so two runs on one tree are byte-identical. `--json` mirrors
`check-pack-safety.mjs` so a test can assert rule names without parsing prose, and `--root` lets a
test aim it at a fixture directory.

**Every rule needs a PAIRED fixture**, because `tests/ci/gate.test.ts` already states the standard:
a checker that exits 1 unconditionally fails the pair, and one that exits 0 unconditionally fails it
from the other side. The two that matter most: `frozen-lookup.ts` — a module-level `new Set([...])`
never mutated — must **exit 0**, and `comment-quoting-the-ban.ts` — a doc comment containing
`let cached = new Map()` and `Date.now()` and no code — must **exit 0**. That second one is
`model/reconciliation.ts:10`'s lesson as a test.

---

## 5. The ordered build for phase one

**G101 is deliberate: a disposable Postgres and an in-process `pg.Pool`, and NO AWS resource on the
critical path.** Every step below is a pure function, a type with a compile-time proof, or a
transaction against local Postgres.

🛑 **D1 gates every step that has a wire, and that is most of them.** `docs/HANDOFF.md:145`: all
three contract tiers require `X-Session` and no path issues one. Steps 1, 2 and 6 are the only ones
reachable before it.

| # | Step | Extends which test file | Why here |
|---|---|---|---|
| **1** | `tools/check-stateless.mjs` + its fixtures, joined to `npm run check` | **new** `tests/tools/check-stateless.test.mjs`, in `tests/tools/check-wire-mirror.test.mjs`'s shape; plus two assertions in `tests/ci/gate.test.ts` (in `check`, and in `CHECKERS_THE_WORKFLOW_MAY_NOT_NAME`) | It is the only step with **no dependency on D1**, it is the ruling's own enforcement, and building it first means every later step lands under it rather than beside it |
| **2** | The `@node-local` marker on `db/pg.ts:25` | the checker's own trunk test: `waived` has length one and names `db/pg.ts` | Makes step 1's one existing finding explicit rather than special-cased in code |
| **3** | `SessionId`, `Session`, `SignInAttempt`, `SessionBounds`, `SessionRejection`, `resolveSession()`, `orgFor()`, `TenantContext` — **and the fixtures in the same commit** | **new** `tests/model/session-resolution.test.ts`, in `tests/model/managed-service.test.ts`'s shape (the newest reasoned-union suite in the tree); the assertions go in `model/identity.ts` and are witnessed by `tests/model/canonical.test.ts`'s sibling discipline | 🛑 **D1's model half. `tsc` stays green whatever is wrong here** (§3's §5.10 warning), so the fixture is the only verification. It must include: a positive control asserting `orgClass` came from the connection **by passing an owner that disagrees with any plausible stored value**; one test per rejection arm; `session_idle_lapsed` and `session_lifetime_exceeded` **separately reachable**, because a fixture where both fire proves neither; and `bounds_not_configured` for `0`, `-1` and `NaN`, which is the test that stops a default appearing |
| **4** | `db/migrations/0002_session.sql` + `db/session-scope.ts` | **new** `tests/db/session-isolation.test.ts`, in `tests/db/tenant-isolation.test.ts`'s shape — including its LOUD SKIP and its `pg_backend_pid()` same-connection assertion (`tests/db/tenant-isolation.test.ts:22`, asserted at `:195`) | The migration and `resolveSession()`'s refusals **land together in one commit or neither lands**. `CLAUDE.md`'s invariant 4 is the counter-example: a refusal that is real and a binding that is not, shipped apart |
| **5** | `RunPlan`, `RunStatus`/`RUN_STATUSES`, `WorkBound`, `validateWorkBound()`, the three `SetReconciliationInput` fields | `tests/model/reconciliation-controls.test.ts` (add the lease-ceiling control beside the `Math.random` control at `:251`); `tests/scenarios/engine-behaviour.test.ts` for the replay property; `tests/tools/check-wire-mirror.test.mjs` for the sixth pair | `validateWorkBound`'s ceiling is **derived** from `MAX_AUTHORIZATION_SECONDS` (`model/access.ts:1517`) and needs no invented number, so it is buildable now. The wire enum moves in the same commit — *fixing the model does not fix the contract* |
| **6** | `db/migrations/0002_run_execution_and_reader_work.sql` + `db/work-queue.ts`, whose functions all take a `ScopedClient` (`db/tenant-scope.ts:50`) so they are **unissuable outside a scoped transaction** | **new** `tests/db/work-queue.test.ts`, extending `tests/db/tenant-isolation.test.ts`'s harness: two concurrent claims cannot hold one ordinal; a second settle returns `rowCount 0`; a guarded transition from a wrong prior status returns `rowCount 0` | The one step that needs a database and needs no cloud. Worker paths take their tenant from the registry rather than a session, so **this is one of the few surfaces buildable before D1** — but a run cannot be *admitted* without it |
| **7** | The fourteenth `RetentionClass`, the twelfth `SubjectLocation` variant, both wire enums | `tests/model/canonical.test.ts`'s neighbour for the total-record proof; `tests/tools/check-wire-mirror.test.mjs` | 🛑 **Both are irreversible after the first held row** (§6.6). Cheap now, unrecoverable later |
| **8** | `HeldEditId`, `HeldEditSubject`, `HeldEdit`, the assertions, the two gates, `0002_held_work.sql` | **new** `tests/model/held-work.test.ts`; **new** `tests/db/held-work.test.ts` for the partial unique index and the generated columns | Last, because it needs step 7, needs D1 for `tenantId` and `authorUserId`, **and needs an owed cleanup that is not started**: the single `DataClass` ladder (§6.7) |

**The verification after every step is the same, and the second command is the one that matters:**

```bash
npx -y typescript@5.9.3 tsc -p model/tsconfig.json --noEmit; echo "EXIT: $?"   # unpiped
node tools/planner/extract.mjs      # edges and gaps BY KIND, against the previous run
node tools/check-doc-counts.mjs     # will report STALE lines; that is the tool working
npm run check                       # the gate
```

⚠️ **Steps 3, 5 and 8 move the `exports` metric** (832 at `HEAD`, derived), so
`check-doc-counts.mjs` marks every document stating it STALE and `npm run check` **exits 1 until
each is corrected in the same commit**. Budget the sweep; it is not a failure.

---

## 6. The costs, stated plainly and attributed

The owner asked for the rule and is entitled to its price. Nothing below is softened, and every item
was verified by one of the four reports at the tree.

### 6.1 The session read cannot be amortised, EVER

Five row-sets are needed before any work on every request — the session (**the ruling adds this
one**), the `user` row for `status` and the fired-employee lever, the `identity_connection` row
because `orgClass` is derived and not stored, the `tenant` row for `TenantContext`, and the
assignments for `decide()`. **A signed-token design needs zero.** Four of the five were already
required by the pre-existing design; the ruling adds the first, and it can be **one statement** (a
join over four tables) plus one for the assignments. So the honest figure is **+1 statement per
request, +1 `set_config`, and one extra transaction if the session read and the work are not
composed.**

🛑 **An in-process session cache would make almost all of that free, and it is forbidden TWICE** —
by the ruling itself, and by **G116** (`docs/HANDOFF.md:842`), whose reason is `S2`, a module-level
cache in this codebase's own history that **leaked inferred structure across a tenant boundary**. A
shared cache is separately closed: **G103, no Redis** (`docs/HANDOFF.md:829`) — there is no third
store to put it in. And the usual alternative, a signed self-describing token, is refused **by name**
at `model/access.ts:1536`. **So the per-request read cost is permanent and it is the price of the
ruling.**

⚠️ **The record has now stacked three uncacheable reads in one latency budget:** the session row,
the extraction-rule cache table (G103, whose own row records that *"the sub-millisecond claim was
never measured"*), and `redeemAuthorization()`'s grant row. **If latency is ever reopened it must be
reopened ONCE, with a measurement, against all three** — not per subsystem, or the answer will be a
cache in the least-defended one.

### 6.2 🛑 The sharpest deadline the ruling creates: `RecordChain`

`RecordChain` (`model/governance.ts:1110`): `sequence` is *"Monotonic per tenant per stream. Gaps
are the detection; absence of a row is invisible without it"*, with `previousHash` chaining to the
prior record's canonical body. `AuditEvent`, `DataAccessEvent` (`model/governance.ts:1155`) and
`UsageAttestation` all carry it.

**Under statelessness, N nodes appending to one chain must serialise on the chain head.** No node may
hold the head in memory — that is precisely the state the ruling forbids — so each append reads the
head row, and to be correct it must read it under `SELECT … FOR UPDATE` on a per-`(tenant, stream)`
head row, **inside the request's transaction.** Consequences, stated without softening:

- **Every audited act takes a per-tenant exclusive lock**, and under **G101**'s transaction-mode
  pooling that lock is held for the **whole request transaction**, not just the insert. Unrelated
  concurrent requests in one tenant therefore queue behind each other's **slowest statement**.
- **Per-tenant audit write throughput becomes that tenant's request-concurrency ceiling.**
  `docs/build/event-architecture-recommendation.md` puts the volume at *"under 1 row/sec average.
  Unremarkable"* — ⚠️ **an average is not a lock-contention argument, and a month-end close is not
  the average.**
- 🛑 **The fix is irreversible in the direction that matters, and its window is open NOW.** The fix
  is to partition the chain — one chain per `(tenant, stream, partition)`, with the partition named
  in `ChainAnchor` (`model/governance.ts:1138`) — and **it must be chosen BEFORE THE FIRST CHAIN ROW
  EXISTS**, for the reason the type's own comment gives about canonicalisation
  (`model/governance.ts:1112`): *"Pick a scheme before the first hash is computed, because
  afterwards every stored chain is bound to it."* **G20 closed the canonicalisation half on 9 Aug
  precisely because that was the only window in which it cost nothing (`docs/HANDOFF.md:674`). The
  partitioning half is the same window and it is still open.**

**This is the collision between *"scale without a node dependence"* and *"the chain breaks if a row
is deleted or edited."* Both are the owner's and only the owner can trade them.** **S-6.**

### 6.3 `UsageRecord.sequence` must be a ROW, and the obvious implementation destroys it

🛑 **Do not implement `UsageRecord.sequence` as a Postgres `SEQUENCE`.** `nextval` is
non-transactional: **it does not roll back.** Any aborted metering transaction therefore leaves a
permanent hole, and `model/billing.ts:158` says the field exists so that *"a gap in this sequence is
detectable rather than merely absent."* **The obvious implementation destroys the single property the
field was added for**, silently, and no test that only ever commits would find it. The counter must
be a **row** — `UPDATE … SET next_sequence = next_sequence + $n … RETURNING next_sequence - $n` —
inside the same transaction as the insert. **Cost: it serialises meter writes per plane**, and
⚠️ the counter table is **plane-scoped, not tenant-scoped, so it is not under RLS** — which is what
`UsageRecord.sequence`'s per-plane monotonicity requires. That is a cost of an **existing field**,
not of this design, and the migration that adds it must say so.

### 6.4 Every collision with an existing G row, quoted and handed over

**None of these is mine to resolve.** Each is quoted so the owner is deciding against the actual
sentence.

🛑 **G99 — the negative control the session read cannot honour.** `CLAUDE.md` states, under G99:
*"Every query runs inside an explicit transaction. No exceptions … `withTenantScope()` opens a
`db.transaction()` and **no query may be issued outside it** — a named negative control, not a review
convention."* **The session read is a query outside it, and it has to be:** the function takes a
`tenantId` as its first act and the session read is what produces one. Its own docstring says so —
*"it is the last link in the chain, not the first"* (`db/tenant-scope.ts:97-99`). Two honest ways
out and no third: **(A)** the rule gains a **second sanctioned helper** and becomes *"every query
runs inside one of exactly two named scoped helpers"* — cost: the negative control now has two
members and someone will propose a third; **(B)** `withSessionScope()` composes inside
`withTenantScope()` — impossible as signed, because it demands the tenant it does not have, and a
`withTenantScope(pool, null, …)` call is a scoped helper that scopes nothing, which is worse. **The
green reports recommend (A) and neither took it.** **S-1.**

🛑 **G100 — the predicate cannot protect the session table, and this is structural rather than
preference.** A session row's `tenant_id` is **null before the tenant is known**, and
`app.tenant_id` is **unset at the moment the session is what decides it**. Under
`tenant_id = nullif(current_setting('app.tenant_id', true), '')`
(`db/migrations/0001_tenancy_and_rls.sql:179`) that row is invisible to the connection that just
wrote it — G100 working correctly, against the one table that must be readable **before** a tenant
exists. **A second GUC is therefore structural**, and the only open question is which value keys it
(§3(a)'s disagreement table). **S-2.**

🛑 **G120 — the literal reading of the ruling collides with it.** `docs/HANDOFF.md:846` puts the
reader orchestration in *"a data-plane state machine, a DISTRIBUTED-MAP fan-out of single-record
readers, and a fan-in that folds through `applyReaderVerdicts()`"*. **A Step Functions execution
holds its state in AWS, not in PostgreSQL.** Under the ruling's literal words — *"must be committed
to the database"* — that is a violation. Under the operational reading — *"no process-local state a
retry cannot reconstruct from durable storage"* — Step Functions is durable and G120 complies. **The
two readings differ on the largest piece of architecture in the phase-one plan and on nothing
else.** **S-8.**

🛑 **G121 — one grant per map execution, met by a 900-second ceiling and a resume that may happen
later.** `docs/HANDOFF.md:847` rules *"ONE `AuthorizationGrant` per map execution; every reader act
carries it plus its `requestOrdinal`."* `MAX_AUTHORIZATION_SECONDS.tenant_data` is **900**
(`model/access.ts:1530`) and `AuthorizationGrant.expiresAt` is required and never null. **When a node
dies and another resumes the map after the grant expired, either the resume mints a new grant —
making it one grant per *attempt*, so the audit trail carries N grants for one map and G121's row
needs amending — or the map refuses to resume and the run fails.** G121's recorded cost is
**withdrawal, not expiry**, so this is not a cost it already priced. **And statelessness sharpens
G121's other stated limit rather than softening it:** *"withdrawal stops future draws, not live
ones"*, and *"ease of retry"* means a failed iteration is **re-dispatched** — a retry is a new
dispatch of an act whose authority may have been withdrawn since. The correct posture is that
**every retry attempt re-runs `redeemAuthorization()`**, which is free in design terms because
caching the decision is already forbidden, and costs N redeems per N attempts on the one path G121
chose one-grant-per-run to keep off. **S-7.**

🛑 **G111 blocks the plan digest.** `canonicalise()` refuses `bigint` (`model/canonical.ts:66`) and
the per-strategy tolerances carry `Money`, so **`runPlanDigest` cannot exist until the money codec
does** (`docs/HANDOFF.md:837`). The pinning control therefore detects an honest change and **not
tampering**, and must be labelled as the weaker control it is.

### 6.5 What the ruling takes away, and what becomes unanswerable

- **`Session.lastUsedAt` turns every read request into a write.** Under the ruling it cannot be a
  memory counter, so a page view becomes an `UPDATE` **inside the request transaction** under G101 —
  a row lock on the hottest row in the system for the request's duration, so two concurrent requests
  from one browser serialise. It would be adopted **by analogy** with
  `TenantAccessGrant.lastUsedAt` (`model/governance.ts:854`), which is §5.1 exactly: a support grant
  is drawn a handful of times per engagement and a session once per HTTP request. **S-4.**
- **Nothing in the request plane can enumerate sessions** — not another user's, not its own user's.
  That is a **security property** (a compromised app role cannot harvest live sessions) *and* a
  cost: *"sign me out everywhere"* is not implementable without a generation counter on `User`, and
  incident response cannot list live sessions. **A rejected alternative, recorded:** a second policy
  for an admin role, refused because it puts a broad read path on the session table inside the
  request plane. **S-5.**
- **The temp file goes, and with it a whole class of parser.** Rule 5 forbids `os.tmpdir()`, so a
  CLI parser invoked with a temp file is now forbidden on **two** grounds instead of one. That
  reinforces the existing `pdfjs-dist` ruling and closes the reopening argument, at the cost that
  some formats have no in-memory TypeScript parser and those documents go to residue. **Corollary
  the checker cannot see:** with an in-memory parser, the byte and decompression bounds stop being
  merely prudent and become the worker's **memory** bound — an unset bound was already a refusal;
  now it is also an OOM.
- **A resume recomputes the WHOLE fold**, not the remainder. That is the price of not inventing a
  state serialisation format, and **the crossover at which serialising would be cheaper is
  unmeasured. No threshold is stated here.**
- **An O(tenants) sweep in the hosted topology**, free under BYOA. The tenant count at which that
  stops being acceptable is **unmeasured**, and the escape hatch is a table outside RLS that G103's
  reasoning refuses. **S-10.**
- **Autosave turns typing into billable volume.** A hold is an API call, so it meters as `api_calls`
  — and `Mockups/rec/Confirm.dc.html` already promises *"confirming spends nothing"*, while
  **nothing in the model marks an act as non-metered**. So a person typing a rejection reason
  generates however many metered calls the debounce produces. **That is a commercial consequence of
  a technical ruling** and it is the owner's to accept or refuse. **S-11.**
- **A hold is NOT audited, deliberately, and that is a cost.** `AuditEvent` is the longest-retained
  class in the system, so a row per keystroke-debounce makes the audit trail unreadable — §5.6 read
  from the other side. **The accepted cost: a write of personal data into the tenant's database that
  no audit row records.** The capability is still checked; only the *record* is absent. **S-13.**

### 6.6 Decisions the ruling makes irreversible

| Decision | Irreversible from | Why no migration fixes it |
|---|---|---|
| **`RecordChain` partitioning** | the first chain row | the streams are hash-chained; there is no migration that rewrites them. §6.2 |
| **Not storing `orgClass`** | the first `AuthorizationGrant` stamped from a derived org | switching later changes what every historic comparison meant, in a hash-chained stream |
| **`buildReaderRequests`'s iteration order** | the first stored verdict | G120's `(runId, requestOrdinal)` is a **positional key over a derived array**. Changing the residue order, `openItems`' order or the candidate filter later invalidates **every stored verdict in the system**. That irreversibility **arrives with G120, not with this design**; the witness columns are the most that can be done, and they make the invalidation loud instead of silent |
| **The fourteenth `RetentionClass`** | the first held row | `purgeAfter` is computed at hold time and *"no migration can recompute what the policy said at the time"* |
| **The twelfth `SubjectLocation` variant** | the first held row | locations are *"Written at CREATION time, not discovered by scanning"* (`model/governance.ts:1772`), so a row created before the variant exists is **permanently outside the erasure index** |
| **The sign-in audit stream's shape** | the first sign-in row | same stream, same reason. It is the highest-cost-to-defer item on the session surface |

The handle-digest **key** is **not** irreversible — sessions are short-lived, so rotating it
invalidates live sessions and nothing else. Say so, so nobody over-protects it.

### 6.7 Two prerequisites the ruling converts from tidy-ups into blockers

- **The single `DataClass` ladder.** `HeldEdit.maxDataClass` cannot be computed without it, and
  `model/policy.ts` records **four** copies of the ordering plus the condition for unifying them
  (*as its own commit, with `mayAdmit()` under test first*). **An owed cleanup becomes a dependency
  of a feature**, and `holdAdmissible()` deliberately **refuses to compare classes** rather than
  adding a fifth copy inside the commit meant to prevent divergence.
- **D6, the runtime validation boundary.** `session.openapi.yaml` would be the **first
  unauthenticated public HTTP surface in the system**, and D6 is open with *"Types erase. Nothing
  validates today."* Shipping an unauthenticated endpoint with no validation boundary is the
  highest-risk instance of D6 in the plan. **S-14.**

### 6.8 The gate's own cost

Adding a checker lengthens `npm run check`, which G108 accepts on condition that each is
deterministic and fast. Adding a **module** (`model/execution.ts`, `model/held-work.ts`) moves the
governed module count off 18 and makes every document stating it STALE — the cheapest possible
signal, and **S-9** asks whether the module may exist at all. Adding roughly a dozen exports per
step moves the `exports` metric and does the same. **Budget the sweep in the same commit or the gate
stays red.**

---

## 7. Owner rulings still required — S-1 onward

Numbered from **S-1** so they never collide with the ingestion record's **O-numbers**. Each is a
question, a recommended answer, and its cost. 🛑 **Nothing below §3 should be built without S-1,
S-2, S-4 and S-6.**

| # | Question | Recommendation | Cost of the recommendation |
|---|---|---|---|
| **S-1** | **G99 says "no query may be issued outside `withTenantScope()`". The session read must be one. Does the rule gain a second named helper (`withSessionScope()`), or does `withTenantScope()` gain a nullable tenant?** | **The second named helper**, and the invariant becomes *"every query runs inside one of exactly two named scoped helpers."* A nullable-tenant scoped helper scopes nothing | The negative control has two members and somebody will propose a third. 🛑 What must not happen either way: adding `query` to `TenantPool` |
| **S-2** | **What keys the session table's RLS predicate — the presented handle's DIGEST in `app.session_ref`, or the row ID in `app.session_id` reached through a `SECURITY DEFINER` lookup?** Both keep G100's deny-on-NULL polarity | **The digest.** It needs no privileged function, and a `SECURITY DEFINER` lookup would become the single most security-relevant object in the schema | The digest becomes a GUC value on every request. The rejected option's cost is a privileged function plus its own two-row negative test — and refusing RLS on the table altogether was rejected by both reports, because it makes the table's protection a property of application code |
| **S-3** | **Is `orgClass` stored on the session row or re-derived per request?** | **RE-DERIVED**, and the mechanical argument settles it rather than the self-maintenance one: **a stored `orgClass` silently disarms `redeemAuthorization()`.** `model/access.ts:1771` denies when `grant.orgClass !== principal.orgClass`, and that comparison has meaning only because the grant's value is a **stamp** and the principal's is **freshly derived**. Store it and the check compares one stamp to a copy of the same stamp, made at the same moment from the same source — **it would pass forever.** That is §5.6 produced not by deleting a check but by **changing what one of its inputs means** | **+1 read per request** (the `identity_connection` row), permanently and uncacheably. It can join the session read, so it is one statement and four rows. The rejected option's cost is a staleness window **over authority**: a consultant whose partner connection is disabled keeps the old org until expiry |
| **S-4** | **Idle expiry, and every session bound.** Is there idle expiry? And what are `maxLifetimeSeconds`, `maxIdleSeconds` and any autosave interval? **These are numbers and therefore yours; I may not invent one and nothing here does** | **State them as required configuration that REFUSES on absence** — the `IngestBound`/O-8 posture. On idle expiry: if yes, write it **at most once per configured interval**, not per request; if no, absolute `expiresAt` is the only bound and `lastUsedAt` comes off the row | With no numbers, **`resolveSession()` refuses every session and no session can be minted at all** — that is the intended failure, not a bug. Per-interval writes make idle revocation accurate only to the interval, and that must be written on the field |
| **S-5** | **Is *"sign me out everywhere"* a v1 requirement?** | **No for v1.** The digest-keyed policy makes it unimplementable in the request plane without a generation counter on `User`, which is a new field and a new door to argue | Incident response cannot list live sessions; the lever is `User.status`. The audit stream still answers *"who signed in when"* |
| **S-6** | 🛑 **`RecordChain`: one chain per `(tenant, stream)` with a serialised head, or PARTITIONED chains with the partition named in `ChainAnchor`?** **This must be answered before the first chain row is written** | **Decide it now, either way, and record the ceiling.** If throughput is genuinely unremarkable, choose the single chain **deliberately** rather than by default | Single chain: a per-tenant audit write ceiling equal to that tenant's request concurrency. Partitioning: `ChainAnchor` grows a field and gap detection becomes per-partition, so *"a missing row"* becomes a slightly weaker claim |
| **S-7** | **Does every retry attempt re-run `redeemAuthorization()`, and may a resume mint a new grant?** G121 rules one grant per map execution against a 900-second ceiling | **Yes to re-running on every attempt.** On the grant: no recommendation offered — G121's stated cost is withdrawal, not expiry, so this is new ground and it is yours | N redeems per N attempts on the path G121 chose one-grant-per-run to keep off. This **narrows** G121 rather than reversing it and needs your word either way |
| **S-8** | 🛑 **Which reading of the ruling governs — "in PostgreSQL" or "durable somewhere a retry can reach"?** G120 puts the reader fan-out's state in a Step Functions distributed map, which is state outside the database | **No recommendation.** It is your sentence. Nothing in §3 turns on the answer and **G120 turns on it entirely** | The literal reading requires moving the fan-out's state into Postgres, which is the in-Postgres queue §3(b) designs. The operational reading keeps G120 as written and means the record's rule must be **restated in the operational form everywhere**, or the next reader applies the literal one |
| **S-9** | **May `model/execution.ts` and `model/held-work.ts` exist as new modules, or do these types go into `model/domain.ts`?** | **New modules.** `ReconciliationRun` is on the wire and is the business record; a lease is neither. `domain.ts` is the largest module and `CLAUDE.md` requires a plan before touching it | The governed module count moves off 18 and every document stating it goes STALE. That is the tool working |
| **S-10** | **Does a worker sweep tenants from the downward-published registry — every read inside `withTenantScope()`, O(tenants) per sweep — or does a lease table OUTSIDE RLS carry identifiers only?** | **The sweep.** G103 refused a table outside RLS for the rule cache on the ground that four invariants are enforced by the store | O(tenants) per sweep in the hosted topology, free under BYOA. Fair scheduling and starvation across tenants are **unaddressed** and no fairness rule is invented here |
| **S-11** | **Is autosave a metered act?** | **You decide.** Either holds are metered and typing has a unit price, or something must mark an act **non-metered** — which is a new field on the metering path and therefore invariant 5's business | Metering typing contradicts a promise already drawn on a screen. Marking acts non-metered puts a switch on the one record class that ships to the control plane |
| **S-12** | **Is the confirmed-field act in v1?** | **If no, do not declare the arm at all** — a draft with no promotion path is a promise the product cannot keep | If yes: a capability (a platform release), an operation, a home for name + time + region + the machine's reading, and a distinct event type. Four absences, not one |
| **S-13** | **Does an audit row exist per hold?** | **No per hold.** If that is unacceptable, the answer is not *"audit every hold"* but a **coarser record** — one row per draft lifetime — which is G121's one-grant-per-run argument transplanted | As ruled: a write of personal data with a capability check and no record |
| **S-14** | **Will D6 — the runtime validation boundary — be taken before an unauthenticated public endpoint ships?** | **Yes, before.** This would be the first such endpoint and *"nothing validates today"* | Delays the session wire by whatever D6 costs. Shipping without it is the highest-risk instance of D6 in the plan |
| **S-15** | ⚖️ **Counsel: does unsubmitted work fall inside PDPA access and correction, not only erasure? And what is the held-work retention window?** | **Not answerable here.** The design makes a draft *reachable* for erasure; whether it is *in scope* for access and correction is counsel's | The window is the fourteenth of the thirteen windows already assigned to counsel. Without it, every hold refuses |

---

## 8. Record corrections found while designing

**Not applied here** — logged for whoever writes next. ⚠️ `tools/check-doc-counts.mjs` governs none
of them: most have no number in them. Each was verified by me at `f988f2a4`.

### 8.1 🛑 `db/` EXISTS, so `CLAUDE.md`'s "there is no database" sentence is FALSE

`CLAUDE.md:472` states: *"There is no database, no schema, no migration and no client dependency in
this repository."* Verified today:

```bash
ls db/                        # env.ts migrate.ts migrations pg.d.ts pg.ts provision.ts tenant-scope.ts
ls db/migrations/*.sql | wc -l  # 1  — 0001_tenancy_and_rls.sql
grep -c '"pg"' package.json     # 0
```

**There is a schema, a migration, `withTenantScope()` (`db/tenant-scope.ts:101`) and a passing
two-tenant isolation test with a `pg_backend_pid()` same-connection assertion**
(`tests/db/tenant-isolation.test.ts:22`, asserted at `:195`). **The narrower TRUE statement is that
`pg` is absent from `package.json` and loaded dynamically** (`db/pg.ts:25`), so the leak test's
evidence is **machine-local rather than reproducible from the manifest** — and `db/pg.ts:17` already
says the honest thing about it: *"THE SKIP IS ONLY HONEST WHILE IT IS LOUD. A run in which the
two-tenant leak test skipped is NOT evidence that tenant isolation holds."* The sentence should be
replaced with the narrow one, not deleted, because the narrow one is the actionable claim.

### 8.2 No `SourceDocument` blob is constructible into the erasure index today

`SubjectLocation.blob` is `{ kind: 'blob'; bucket: string; key: string }`
(`model/governance.ts:1784`), while `SourceDocument.storageRef` is **one opaque string**
(`model/domain.ts:1849`). **There is no split, no parser and no convention anywhere that turns one
into the other**, so a document's blob cannot be registered in the erasure index as things stand.
This matters more than it looks: the union's own header says locations are *"Written at CREATION
time, not discovered by scanning"*, so this is not a gap a later sweep closes.

### 8.3 Five drifted citations in `docs/build/green-platform-slices.md`'s session proposal

Verified by opening each. **Four of the five resolve to substantive but WRONG lines, which is
exactly the class `tools/check-citations.mjs:17` says it structurally cannot catch:** *"It cannot
tell whether a citation points at the RIGHT declaration — only whether it points at anything at
all."*

| Declaration | previously recorded as | Actually at | What the old number hits now |
|---|---|---|---|
| `IdentityConnection` | previously recorded as `domain.ts:1196` | `model/domain.ts:1355` | a bare `*/` — the only one that would read SUSPECT |
| `User` | previously recorded as `domain.ts:1236` | `model/domain.ts:1395` | a `RetentionRefusal` union arm |
| `AskSession` | previously recorded as `domain.ts:4057` | `model/domain.ts:4243` | a `subjectRef` doc comment |
| `AccessSession` | previously recorded as `governance.ts:807` | `model/governance.ts:915` | *"An extension to a delivery grant."* |
| `PrincipalContext` | previously recorded as `access.ts:954` | `model/access.ts:1003` | `commercial_only: [],` |

**Anyone building that proposal from its citations lands in the wrong declaration four times out of
five.** ⚠️ The three-arm `owner` union it cites at `domain.ts:1209-1212` has drifted with it, so
**derive the exported owner type's name before pasting any `resolveSession()` signature** rather
than trusting a report.

### 8.4 `AccessSession`'s accumulating arrays are process-local state under the ruling

`AccessSession.resourcesTouched: AccessResourceClass[]` (`model/governance.ts:926`) and
`accessedSubjects: string[]` (`:928`) are accumulating arrays, and
`docs/contracts/control-plane.openapi.yaml:803` describes them as *"Reported on session close and
buffered like everything else."* **A buffer is process-local state; the ruling bans it; and
`DataAccessEvent` (`model/governance.ts:1155`) already holds the durable source of both.** So the
correct shape is a **query over `DataAccessEvent`**, not an accumulator on a row — which also
removes the case where a node dies mid-support-session and the customer-facing access report is
short. ⚠️ **This is a defect in the existing tree, not in the proposal**, and it belongs to whoever
owns the support-access slice.

### 8.5 Two smaller ones, verified

- **`ReconciliationRun.status` drifts unwatched in two places.** It is an inline field union
  (`model/domain.ts:2700`), restated twice on the wire, and it is **not** one of the pairs
  `tools/check-wire-mirror.mjs` compares — that checker reads `export type X =` unions and
  `export const X = {} as const` values, and an inline field union is neither.
- **`RecordChain`'s header still says no canonicalisation scheme exists.**
  `model/governance.ts:1108` reads *"NO CANONICALISATION SCHEME IS DEFINED ANYWHERE IN THIS
  REPOSITORY … no JCS, no RFC 8785."* **G20 landed on 9 Aug and `model/canonical.ts:2` is RFC 8785
  (JCS).** The sentence immediately after it — *"Pick a scheme before the first hash is computed"* —
  is the one §6.2 leans on and is still exactly right; only the first half has gone false.

---

## 9. What this record cannot verify

- **There is no red pass and no adjudication.** Every red team and the adjudicator died on a session
  limit. **Nothing in §3, §4 or §5 has been attacked, and this repository's own history is that the
  attack finds real defects in the EXISTING tree** — on 9 Aug the reconciliation engine was executed
  for the first time and a corpus written to the specification found a real audit-trail defect within
  hours. **Expect this design to be wrong somewhere only execution will show.**
- **Nothing here is built.** No declaration exists in `model/`, no migration in `db/migrations/`, no
  checker in `tools/`, no test in `tests/`. Every claim is at the type level or below it.
- **A green `tsc` after pasting §3 would tell nobody anything**, for the reason
  `docs/HANDOFF.md:1689` records: a total record binds the shape and only a fixture witnesses the
  content. If §3 lands and `tsc` stays green with nothing else changed, **say so** rather than
  reporting a green run as verification.
- **The SQL is unverified against a live PostgreSQL.** Generated columns, partial indexes, the
  `SECURITY DEFINER` alternative and every predicate in §3 were written and read, not run. G101's
  disposable Postgres is not provisioned in this repository and `pg` is not in the manifest (§8.1).
- **No number, TTL, threshold or price is stated anywhere above** except the two that are **derived
  from the tree** — `MAX_AUTHORIZATION_SECONDS.tenant_data = 900` (`model/access.ts:1530`) and the
  bounded turn window. Every other bound is required configuration that **refuses on absence**.
- **Nothing in this repository can check whether a control named here sits on the right
  declaration**, whether a `@node-local` reason is true, or whether a stated cost is the real one.
  `tools/check-citations.mjs:17` says the first of those about itself;
  `tools/check-doc-counts.mjs:13` says the second about counts; `docs/HANDOFF.md:104` says the third
  about drop notes. **That remains a person reading this against the tree.**
