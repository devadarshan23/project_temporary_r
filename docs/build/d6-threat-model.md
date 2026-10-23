# D6 — the threat model for federated sign-in

> **STATUS:** ANALYSIS, WRITTEN FOR THE OWNER TO RULE ON.
> **V1 AUTHORITY: NO.** Nothing here is a decision. `docs/HANDOFF.md` §3 outranks
> this document on every point, and `CLAUDE.md` is the only place the eleven
> invariants are numbered — copy them from there, never from here.
>
> **This is R1 of `docs/build/completion-plan.md` §4**, commissioned as its own
> slice on the owner's instruction of 21 Sep 2026: *commission the threat model
> as its own slice, written for me to rule on.* **R1 IS NOT TAKEN BY THIS
> DOCUMENT.** Neither are R2, R3 or R7. §5 states them as options with costs and
> a recommendation, and a recommendation is not a ruling.
>
> ⚠️ **THREE OF THOSE FOUR WERE TAKEN ON 25 Sep 2026 AND THE SENTENCE ABOVE IS
> CORRECTED RATHER THAN DELETED, because it is this document's own statement
> about its own authority and a reader would quote it onward.** **R2, R3 and R7
> are the owner's now** — recorded at `docs/HANDOFF.md` **G2131**, **G2151** and
> **G2121**, and built as W3's S4, S5 and R7. **R1 IS STILL OPEN AND NOTHING
> HAS BEEN MOUNTED**: `completeFederatedSignIn` is routed nowhere, the served
> set is unchanged, and `tests/http/code-exchange.test.ts` §8 asserts it.
> 🛑 **AND THE DOCUMENT'S OWN OPENING DERIVATION HAS MOVED: `grep -rn 'fetch('
> server/` NO LONGER RETURNS 0.** R2 spends that property deliberately —
> **once, at boot, in exactly one file** — so the honest form is now *no
> outbound call on a REQUEST path*, enumerated by name at
> `tests/http/console-roster-unreachable.test.ts` §1c. **Every other figure and
> every attack in §4 is unchanged except §4.3, which is CLOSED** (G2141/G2154).
> **The §5 rows below are left exactly as they were written**, because they are
> the options the owner ruled ON; the three that were taken carry a banner at
> their own heading.
>
> **NOTHING IS BUILT HERE.** No migration, no mount, no route, no callback, no
> JWKS fetch. Derive it: `grep -rn 'fetch(' server/` returns **0** on the branch
> this was written on, exactly as it did before.
>
> *Written 21 Sep 2026 against `docs/d6-threat-model`, based on
> `origin/feat/s1-s3-external-subject-and-mint` (PR #481) →
> `feat/s2-session-mint-model` → `build/w2w3-seed-and-mint-measurement`.*
> **A count is a fact about a tree and a merge makes a new tree**
> (`docs/HANDOFF.md` §5.11). Every figure below ships with the command that
> reproduces it. **Re-run them; do not read them.**

---

## §0 · The one sentence this document exists to answer

**Everything this product serves today refuses without a credential.** G316
records that as a ruling rather than an accident, and it is the reason there has
never been a public surface to reason about. `resolveHomeRealm` and
`completeFederatedSignIn` end that.

**The question is not "are these two operations safe".** It is: *which of this
repository's existing controls were load-bearing only because nobody
unauthenticated could reach them, and which of them keep working when somebody
can?*

Most of them keep working, and the analysis below says why in each case. **Three
do not**, and they are the three §5 asks the owner about.

---

## §1 · The surface, enumerated

### 1.1 · The two operations, derived from the contract rather than from prose

`docs/contracts/session.openapi.yaml` sets `security: []` at the document level
and two of its four operations override it per-operation. That is G191's
mechanism, quoted on the document's own face: *"whether a route is secured is
read from the document's own per-operation `security`"*, with *"no
hand-maintained exemption list — the artefact that always ends up one entry
stale in the wrong direction."*

**Derive it with a YAML parser, not a `grep`** — a `grep` for `security:` on this
file counts the word inside the header's own prose, which is the G978 class:

```bash
node -e "
const fs=require('fs'), y=require('yaml');
const d=y.parse(fs.readFileSync('docs/contracts/session.openapi.yaml','utf8'));
for(const [p,ms] of Object.entries(d.paths)) for(const [m,op] of Object.entries(ms))
  console.log(m.toUpperCase().padEnd(7), p.padEnd(20), op.operationId.padEnd(24),
    ('security' in op)? JSON.stringify(op.security) : 'INHERITS '+JSON.stringify(d.security));"
```

| | Method · path | Operation | `security` | Public? |
|---|---|---|---|---|
| **A1** | `POST /session/realm` | `resolveHomeRealm` | INHERITS `[]` | **YES** |
| **A2** | `POST /session/federated` | `completeFederatedSignIn` | INHERITS `[]` | **YES** |
| A3 | `GET /session` | `getSession` | `[{"sessionContext":[]}]` | no |
| A4 | `DELETE /session` | `signOut` | `[{"sessionContext":[]}]` | no |

**So the product's first public surface is exactly two POST operations.** That
is smaller than the plan's phrase *"ALL of sign-in's mounts (S6–S8)"* implies,
and the smallness is the good news in this document.

### 1.2 · What each accepts

Both request bodies are `additionalProperties: false`, and under **G191** AJV
runs with `removeAdditional: false`, so a smuggled field is **rejected** rather
than stripped. The contract states why in its own voice: *"under Fastify's
default the field is silently deleted and the request served, which satisfies
the rule and leaves no evidence that it did."*

| Operation | Body | Fields |
|---|---|---|
| `resolveHomeRealm` | `RealmRequest` | `domain` — **one string, and nothing that names a person** |
| `completeFederatedSignIn` | `FederatedCallback` | `handleDigest`, `connectionId`, `challengeDigest` — *"three digested or branded values and nothing else — no tenant, no org, no user, no realm"* |

**Neither body carries a tenant.** The document says so about itself and the
absence is load-bearing twice: *"`completeFederatedSignIn` mints a session with
`tenantId: null` precisely so that AUTHENTICATION CANNOT CONFER A SCOPE."*

### 1.3 · What an unauthenticated caller can make the system SPEND

This is the question the enumeration exists for, and it is the one with the
worst answer.

**A malformed body costs nothing.** Fastify validates before the handler runs,
so a body failing `additionalProperties: false` or a missing `required` key is a
400 with no database contact.

**A well-formed body with three random digests costs a pooled database
connection for the life of a transaction.** `completeFederatedSignIn`'s handler
(S6, unbuilt) must open `withSignInScope()` before it can decide anything at
all, because the attempt row is invisible outside it — `sign_in_attempt_rls` is
`USING (handle_digest = nullif(current_setting('app.signin_ref', true), ''))`.
So the refusal path is: `BEGIN` → **four or five `set_config` round trips** →
one `SELECT` → `ROLLBACK`. The caller pays nothing; the plane pays a connection.

**The pool is TEN and staging runs ONE task.** Both are derived, and both are in
the tree with a note saying they are:

```bash
grep -n 'createAppPool' db/tenant-scope.ts          # export async function createAppPool(max = 10)
grep -rn 'RECONCILE_DB_POOL_MAX' infra/ | head -2   # set on NEITHER task definition
grep -n 'SERVING_TASKS\|SERVING_TASKS_WHEN_UP' infra/lib/config.ts
```

`infra/lib/config.ts` states it outright: *"The connection pool one serving task
opens — `createAppPool(max = 10)`, and `RECONCILE_DB_POOL_MAX` is set on NEITHER
task definition, so the default is what runs."* `SERVING_TASKS_WHEN_UP.staging`
is **1**.

> ✅ **R-POOL — THE OWNER'S RULING — IS BUILT SINCE 1 Oct 2026 (G2261–G2268) AND
> IS NOT DEPLOYED.** The quotation above is kept because it was the tree's own
> voice when this document measured it, and it is still what RUNS until a person
> deploys `Planes`. The constant it quotes is retired: `RECONCILE_DB_POOL_MAX`
> is now **47** on the data-plane task definition and
> `SERVING_TASKS_WHEN_UP.staging` is per plane, **`{ data: 2, control: 1 }`**, so
> the number an attacker must reach moves from 10 to **94** — derived from a
> connection budget in `infra/lib/config.ts`, not chosen. 🛑 **AND THIS
> DOCUMENT'S OWN VERDICT ON IT IS UNCHANGED: *"Not a control. Moves the number an
> attacker must reach."*** Derive it, never read it:
> `grep -n "RECONCILE_DB_POOL_MAX" infra/lib/planes-stack.ts`.

🛑 **SO TEN CONCURRENT WELL-FORMED SIGN-IN CALLBACKS HOLD THE ENTIRE DATA
PLANE'S DATABASE CAPACITY, AND EVERY AUTHENTICATED TENANT REQUEST QUEUES BEHIND
THEM.** No credential is needed to send them. That is not a subtle finding and
it is not a prediction about load — it is arithmetic over two constants the tree
already writes down. It is **D6-4** in §5.

**And nothing counts the attempt.** Derive the absence three ways:

```bash
grep -rl 'rateLimit\|rate-limit\|rate_limit' server/ infra/ package.json | wc -l   # 0
grep -rl 'wafv2\|WebAcl\|WebACL' infra/ | wc -l                                    # 0
grep -n 'logger: false' server/http/app.ts                                          # 403: logger: false,
```

**There is no rate limit, no throttle and no WAF anywhere in this repository**,
and on this branch the logger is **off**, so a hundred thousand refused callbacks
leave no line. ⚠️ **The logger half is being repaired on another branch and is
not this document's to claim**: `origin/feat/d4-logger-allow-list` (PR #472,
G1391–G1397) turns it on behind `server/http/log-allow-list.ts`. §2.6 reads that
work for what it means here, because *what a log line may carry* becomes a live
question the moment the caller is anonymous.

---

## §2 · What each existing control does, and what it does not cover

The pattern of this section is deliberate: **each control is strong, each is
narrower than its name suggests, and the gaps are between them rather than
inside them.**

### 2.1 · `server/data-plane/token-verify.ts` — the algorithm is ours

**WHAT IT DOES.** `REQUIRED_ALGORITHM` is a constant compared against
`header.alg`, never switched on. Its header states the defeat it closes:

> *"`alg: none` — the token says it is unsigned, and a dispatcher agrees. `alg:
> HS256` — the token says it is symmetric, and a dispatcher reaches for "the
> key", which for an RS256 deployment is the PUBLIC key. That key is published,
> so anybody at all can mint a token that verifies."*

Both leave through **one** arm, `token_algorithm_not_allowed`, and — the part
that matters — **before a key is selected and before a byte is verified.**

**The key side is closed symmetrically.** Only `kty`, `n` and `e` reach
`createPublicKey()` and `kty` must be `RSA`, so *"a key document that named
itself `oct` under the right `kid` would otherwise be imported as a SECRET."*

**The order is the second half.** The payload is **not parsed** until the
signature holds, so `token_payload_unreadable` is reachable only on a correctly
signed token: *"a verifier that parsed first would report a CLAIM defect on a
FORGED token and so tell an attacker which of their fields to fix next."*

**Fifteen refusal arms carry the `kind` and nothing else**, held permanent by
`AssertNoTextDeep` — *"every value a refusal could name … is a bare `string`
that came out of a token we have just refused to believe."* Derive:

```bash
grep -oE "kind: '[a-z_]+'" server/data-plane/token-verify.ts | sort -u | wc -l   # 15
```

**WHAT IT DOES NOT COVER — four things, and the third is the one to read.**

1. **It does not fetch the JWKS.** The key document is an argument. That is
   **R2**, open, and §0 of the file says so: *"Where the JWKS comes from —
   cached how, refreshed when, over whose egress — is the NEXT slice and an
   owner's decision."*
2. **Nothing routes to it.** `verifyIdentityToken()` has no caller outside
   `tests/`. Derive it honestly — and **not** with the command six documents
   used, which G978 retired because it measured its own prose:
   `grep -rln '^export function verifyIdentityToken' server/` → exactly one file.
   ⚠️ **AND THE `^` IS NEW — G2171, 28 Sep 2026. THE UNANCHORED FORM THIS LINE CARRIED WAS G978'S OWN CURE INHERITING THE DISEASE**: it answers TWO lines in `server/`, the second being `token-verify.ts`'s own paragraph, and `-l` hid that only because the quotation and the declaration sit in the SAME FILE. **Witnessed: with the declaration deleted from a scratch copy, the unanchored form still answered `server/data-plane/token-verify.ts`, exit 0 — *exactly one* for a tree with NO VERIFIER.** That is G978's own sentence about the command it retired, arriving at its replacement.
3. 🛑 **IT DOES NOT SEE THE `nonce`, AND `VerifiedClaims` HAS NO FIELD FOR ONE.**
   Derive it:
   ```bash
   grep -c 'nonce' server/data-plane/token-verify.ts                              # 0
   sed -n '/export interface VerifiedClaims/,/^}/p' server/data-plane/token-verify.ts | grep -c nonce   # 0
   ```
   The six fields it returns are `issuer`, `subject`, `audience`, `expiresAt`,
   `notBefore`, `issuedAt`. **So nothing in this repository can bind an ID token
   to the sign-in attempt it was issued for.** §4.3 is the whole of what that
   means; it is not a defect in this file, which is a verifier and says so, but
   it is a hole in the flow that no file currently owns.
4. **`iat` is read and not checked**, stated on the declaration rather than
   left to be found, and `token_use` (Cognito's access-token/ID-token
   discriminator) is neither read nor named.

### 2.2 · `db/signin-scope.ts` — four GUCs in one transaction

**WHAT IT DOES.** It is the fourth scoped helper and it argues itself against
the bar the third paid, on a **measurement** rather than on tidiness. The
deadlock, in the file's own words:

> *"You need a connection to mint a session and a session to read a
> connection."*

And the atomicity argument, which is the one to carry into any design review of
the callback:

> *"One GUC cannot hold both values in one transaction, and **a callback split
> across two transactions is a callback with a window between consuming the
> attempt and minting the session** — which is the replay G315 names as the way
> this shape is got wrong. Two names, one transaction."*

The blast radius is stated as a closed, countable list: *"A caller in a sign-in
scope can reach exactly four rows — one connection, one attempt, (once it names
one) one PERSON, and (once it exists) one session it has just written — and
nothing else in the database."*

**`app.tenant_id` is never set here and must never be added.** Inside this
transaction every tenant-scoped table reads EMPTY under G100. That is the
single most valuable property in the sign-in path and it is held by an
**absence**, which means it is held by whoever next edits this file.

**WHAT IT DOES NOT COVER.** It scopes; it does not rate-limit, count, or age
anything. `sign_in_attempt.expires_at` exists and **nothing compares it** — the
column's own comment says so, and the model argues the absence of a
`sign_in_attempt_expired` refusal rather than leaving it to be discovered. So an
attempt row is single-use but **not time-bounded by any code path**. That is
D6-6.

### 2.3 · `0013`'s `tenant.sign_in_attempt` — column-level `UPDATE`

**WHAT IT DOES.** Two grants and no more:

```
GRANT SELECT               ON tenant.sign_in_attempt TO tenant_rw;
GRANT UPDATE (consumed_at) ON tenant.sign_in_attempt TO tenant_rw;
```

The column-level `UPDATE` is called *"THE STRONGEST FENCE IN THIS FILE"* and the
reason is exact: a table-level `UPDATE` would let a request path rewrite
`connection_id` on an attempt it can already see, which is **re-pointing a
pinned door from inside the callback** — *"the ORG AXIS READ FROM A REQUEST."*

**No `INSERT` at all**, because *"The writer is the REDIRECT half — the regional
auth host of G315 — and it does not exist; a write privilege ahead of a writer is
what `0004_subject_ledger.sql` refused at length."* **No `DELETE`**, because *"a
caller able to delete an attempt could delete the evidence that it was
replayed."*

**No `user_id` column** — the model's `_SignInAttemptCarriesNoUserId` holds the
type side, and the migration refuses the column on its own face because *"a
schema is not fenced by a proof about a TypeScript interface."*

**WHAT IT DOES NOT COVER.** The `INSERT` grant is owed to a writer that does not
exist, so **the redirect half of the flow has no privilege, no home and no
design**. Everything in §4 that depends on how `state` is minted is therefore a
question about code nobody has written, and §5's D6-2 and D6-3 are where it
lands.

### 2.4 · `0011`'s broker handle is a PAIR

**WHAT IT DOES.** G304's ruling, in executable form: a Cognito `ProviderName` is
unique *"within one user pool and nowhere else"*, so a bare provider name is a
key that can collide across pools, and *"a collided handle resolves to the wrong
connection → the wrong `owner` → the wrong `orgClass`."* G289 prices that
outcome at *"five controls deleted by one assignment"* — the live-grant check,
the `partnerId` check, revocation, expiry and `PARTNER_CAPABILITY_MASK` — **and
a colliding key reaches it without anybody writing a default.**

G343 then carried the pair into the **policy**, not just the index, and the
argument is one a threat model should keep: *"an index enforces uniqueness at
WRITE time, whereas a policy decides visibility at READ time."* It was witnessed
red — `tests/db/federated-signin.test.ts` §2b returned **two rows where one was
required**, the second a partner door in another pool.

**WHAT IT DOES NOT COVER.** The pair is only as good as the issuer string, and
`SignInScope.brokerIssuer` is *"verbatim and never parsed — no region, no pool
id, no account is read out of it."* That is correct and it means **the issuer
must arrive from a verified token and from nowhere else.** Nothing enforces
that today, because nothing routes to the verifier (§2.1). It is D6-5.

### 2.5 · S1's `GRANT INSERT ON tenant."user"` — and the path it could not close

**WHAT IT DOES.** R5, the owner's, 21 Sep 2026 — G1631. *"A person is
AUTO-PROVISIONED ON FIRST SIGN-IN"*, which needs the largest write privilege
this schema has ever granted. The fence is three-layered:

- **A composite foreign key** (G1633) — `(connection_id, broker_issuer,
  broker_ref)` REFERENCES the connection, so a disagreeing row is
  **UNREPRESENTABLE rather than refused**. That shape exists because a first
  draft resolved the door with a subquery and *"every arm of the probe — eleven
  of eleven, reads and writes alike — answered `infinite recursion detected in
  policy for relation "user"`"*, through a **two-table** cycle nobody had
  measured.
- **A permissive policy** `user_signin_rls`, keyed on the broker pair **and** on
  `app.external_subject` — the fifth GUC (G1635).
- **A restrictive policy** `user_signin_mint_restrictive`, `FOR ALL`, `WITH
  CHECK` only, keyed on the broker pair. It exists because permissive policies
  **OR**: `0009`'s `user_rls` declares no `WITH CHECK`, so PostgreSQL reuses its
  `USING` for INSERT, and *"a writer mints the SESSION first, pointing at a
  person id that does not exist yet, then mints the PERSON with that id"* — at
  which point that disjunct is true. **Measured both ways** (G1640): with the
  policy, `new row violates row-level security policy
  "user_signin_mint_restrictive"`; without it, **the INSERT lands, rowCount 1.**

⚠️ **AND THE PATH THAT SLICE REPORTED IT COULD NOT CLOSE, CARRIED FORWARD HERE
AS A FINDING RATHER THAN RE-DISCOVERED.** The two policies test different
things, and only one of them tests the subject:

```bash
sed -n '/CREATE POLICY user_signin_rls/,/;/p'              db/migrations/0200_external_subject_and_claim_map.sql
sed -n '/CREATE POLICY user_signin_mint_restrictive/,/;/p' db/migrations/0200_external_subject_and_claim_map.sql
```

The permissive one compares `broker_issuer`, `broker_ref` **and**
`external_subject`. The restrictive one compares **the broker pair alone**. So
the restrictive fence — the one that cannot be routed around — verifies **the
DOOR and not the PERSON.** A **fifth permissive policy added later**, admitting
a row on any other ground, would still meet the door test and **could admit a
person on the right door with a subject the scope never named.**

**This is not reachable today**, because `user_signin_rls` is the only permissive
policy that admits a sign-in write and it does test the subject. It is a
statement about the next commit, and it is the reason D6-7 exists.

### 2.6 · `server/data-plane/session-cookie.ts` — and what a log line may carry

**WHAT IT DOES.** One constant, one attribute string:

```bash
grep -n 'SESSION_COOKIE =\|^const ATTRIBUTES' server/data-plane/session-cookie.ts
# export const SESSION_COOKIE = '__Host-reconcile_session'
# const ATTRIBUTES = 'Path=/; HttpOnly; Secure; SameSite=Lax'
```

The `__Host-` prefix **forbids a `Domain` attribute**, so the cookie is host-only
*at the user agent* and a sibling subdomain can neither set it nor overwrite it.
The file names the failure mode that makes assertion-by-name necessary: *"a
browser reports a malformed `__Host-` cookie by SILENTLY NOT STORING IT."*

🛑 **THE MOST INTERESTING LINE IS ABOUT DUPLICATES.** A `Cookie` header carrying
the name **twice** is refused outright, because *"a `Cookie` header carrying the
name twice is the WIRE SIGNATURE OF COOKIE TOSSING."* A parser that took the
first value would hand the attacker a coin flip.

**WHAT IT DOES NOT COVER — and this is where PR #472 bears directly.** The
cookie **is** the session handle. PR #472's allow-list exists partly for that:
its assertion 2 reads *"NO line carries a header value — the cookie IS the
session handle"*, and it failed against a deliberately bad implementation that
kept `headers`. Three findings from that work apply to an unauthenticated
surface with more force than to an authenticated one:

- **`console.error` bypasses every serializer (G1395, ⛔ not applied).** Derive
  the population on this branch: `grep -rn 'console\.error' server/ | wc -l` →
  **40**, of which `server/data-plane/session.ts` alone holds **15**. PR #472
  reports that `authorisation-record.ts` interpolates an error's own `message`
  — *"a live §12.1 breach that predates this slice"*. **A sign-in handler that
  logs a refusal this way publishes whatever the caller sent.**
- **A child logger's bindings bypass both formatters**, measured against
  `pino@10.3.1`, and `formatters.bindings` does not close it. Held at source by
  an AST rule refusing `.log.child(` under `server/`.
- **`msg` is outside every allow-list**, and what keeps `error.message` out of
  it is the custom error handler. *"Deleting `setErrorHandler` re-opens that
  channel."*

⚠️ **On the branch this document is written against the logger is OFF** — derive
it, never read a line number: `grep -n 'logger: false' server/http/app.ts` — so
today the failure is the opposite one: **nothing is recorded at all.** Both states are wrong for a public endpoint, and they are
wrong in opposite directions. §5's D6-4 treats them as one decision.

### 2.7 · The boot fences — and the one that does not fire here

`mountTier()` carries six fences. The fourth (G914) refuses to **serve** a
person-facing exemption unless the mount says so out loud with
`servedWithoutAGate()`. It keys on `callerMayBeAPerson()`:

```ts
export function callerMayBeAPerson(caller: CallerKind): boolean {
  return caller === 'person' || caller === 'mixed' || caller === 'unclassified'
}
```

and `callerOf()` returns `'none'` when `security.length === 0`.

🛑 **MEASURED, NOT REASONED. Run `callerOf` and `callerMayBeAPerson` over this
document's four operations** (the probe copies both functions verbatim from
`server/contract/capability.ts` so it measures the real expressions):

```
resolveHomeRealm         POST    security=[]                       callerOf=none    fourthFenceFires=false
completeFederatedSignIn  POST    security=[]                       callerOf=none    fourthFenceFires=false
getSession               GET     security=[{"sessionContext":[]}]  callerOf=person  fourthFenceFires=true
signOut                  DELETE  security=[{"sessionContext":[]}]  callerOf=person  fourthFenceFires=true
```

**The fence fires on the two operations that require a session and is silent on
the two that anyone on the internet can reach.**

⚠️ **This is defensible and it is still §5.1.** The rule is keyed on *"is there a
person-shaped security scheme"* — a landmark — rather than on *"can a person
reach this"* — the property. A browser posting to `/session/realm` **is** a
person; it simply has no scheme to declare. The consequence is narrow but
precise: **the one fence written so that an ungated person-facing mount must be
acknowledged in a greppable call will not be consulted when S6 mounts the two
most exposed operations in the product.**

It is reported, not repaired. Repairing it is a one-line change to a predicate
that governs seven tiers, and that is an authorisation decision — **D6-8**.

---

## §3 · The invariants in the path, each tested rather than asserted

### 3.1 · Invariant 1 — and the breach that arrives wearing a ruling's endorsement

Copy it, never paraphrase it:

> **1. Tenant scope is derived from the session, never read from a request.**

🛑 **G315 PUTS THE TENANT IN THE OIDC `state` DELIBERATELY.** That is not a
mistake to be corrected; it is the ruling, and it is the right one — the tenant
has to be in `state` because *"Cognito accepts NO WILDCARD callback URL"* and
the 302 needs to know where to go. **The hazard is that the breach, if it comes,
comes with a ruling apparently endorsing it.** The completion plan names the
shape:

> *"If the auth host's one-time grant carries it and S3 writes it, tenant scope
> becomes a thing conferred by authentication — **with a ruling apparently
> endorsing it.**"*

**WHAT IS BUILT AND HOLDS.** Four independent things, and the fourth is the one
nobody would have predicted:

| | Control | Where |
|---|---|---|
| a | `MintedSession.tenantId` is `const: null` — *"a nullable field a success response is allowed to fill is a scope handed out at the door"* | `session.openapi.yaml` |
| b | `tenant.sign_in_attempt` has **no `tenant_id` column** — *"a tenant column here would be a tenant chosen at the door"* | `0013` |
| c | `MintSessionInput` has **no `tenantId` field at all — absent, not `null`** (G1601) | `model/session-mint.ts` |
| d | `AssertNoTenantDeep` refuses a `TenantId` at **any property position** (G1602) | `model/session-mint.ts` |

🛑 **(d) EXISTS BECAUSE (c) ALONE LEAKS, AND THAT WAS MEASURED BY MUTATION.**
G1602, quoted:

> *"Adding `readonly surface: ServedSurface` to `MintSessionInput` — the value
> the caller standing at a mint is **already holding**, derived from the host,
> which is invariant 1's own chain — leaves `_MintSessionInputCarriesNoTenantId`
> **GREEN** and fails only at `_MintSessionInputReachesNoTenantDeep`, because a
> `ServedSurface`'s tenant arm carries a `TenantId` and a homomorphic mapped
> type distributes over a union. **It would read as tightening, it would pass
> review, and the mint would have a tenant under a key named `surface`.**"

**WHAT ELSE CARRIES A TENANT TRANSITIVELY — the question that finding makes
mandatory.** The deep proof answers it for `MintSessionInput` and for nothing
else. Three carriers reach the sign-in neighbourhood and none is under a proof:

1. **`ServedSurface` itself.** The measured carrier. It is what a host resolves
   to, so it is the value nearest to hand at every seam in this flow.
2. **The one-time grant the 302 carries.** It has no type, no name and no file.
   G315 explicitly leaves it to the builder: *"the `state` nonce's storage and
   single-use property, and the one-time grant the 302 carries. Both are the
   builder's, and both are where this shape can be got wrong."* **This is the
   single largest undesigned object in the sign-in flow and it is the one most
   likely to carry a tenant, because it is crossing a host boundary and a host
   is a tenant under G179.**
3. **`state` itself.** By ruling. Its digest is the attempt's lookup key, so the
   *cleartext* `state` — the thing that holds the tenant — lives only at the
   auth host and never reaches the data plane. **That is a property of a process
   that does not exist yet.**

⚠️ **And invariant 1's derivation chain bottoms out in an environment variable.**
`resolveServingHost()` is a registry lookup that refuses unregistered hosts, and
the registry is `RECONCILE_SERVING_HOSTS` — `grep -n 'SERVING_HOSTS_ENV'
server/data-plane/serving-hosts.ts`. Not a table, not a migration. Worth an
owner knowing; it is not sign-in's to change.

**RECOMMENDATION (not a ruling).** The grant that the 302 carries should be
given the same treatment `MintSessionInput` got: a declared type in `model/`
with `AssertNoTenantDeep` on it, **in the commit that invents it**. That costs
one type and makes the endorsed-by-a-ruling breach a `TS2344` instead of a code
review. It is the cheapest item in this entire document.

### 3.2 · Invariant 3 — where does an auth host sit?

> **3. The control plane publishes downward and never reads tenant data.**

**The regional auth host (S5) is a third process and the invariant does not
obviously cover it.** What it would do: exchange an authorization code, verify a
token, read `state`, and 302. What it needs in order to do that: the broker's
JWKS, the app client secret, and — if it resolves anything — the
`identity_connection` row.

🛑 **THE DECIDING PRECEDENT IS ALREADY ON THE RECORD AND IT IS G340's REJECTED
ALTERNATIVE (c).** Asking the control plane to resolve a connection was
**refused on invariant 3**, in these words: *"the control plane publishes
downward and never reads tenant data, and `identity_connection` IS tenant
data; taking it would move the table or bend the invariant."*

**So an auth host that resolves a door is a DATA-plane-shaped process, not a
control-plane-shaped one**, whatever host it answers on. If it is built inside
the control plane it breaks invariant 3 on its first read. If it is built as a
third process with its own credential, then **a serving process holds a second
credential for its whole life**, which is what G193 split into one-shot jobs to
prevent and what G340's rejected alternative (a) refused.

**There is a third shape and it is the one the tree is already arranged for:**
the auth host resolves **nothing**, exchanges the code, verifies the token, and
302s with a grant. Every resolution then happens on the tenant host inside
`withSignInScope()`, exactly as `assembleSignIn()` already does it. **That keeps
invariant 3 untouched, keeps G193's credential split, and makes the auth host a
stateless exchange endpoint.** It is D6-3's recommended option.

⚠️ **One consequence to state rather than let somebody meet: `G1161`'s
`console-read-net` already spent G193's *"by construction"* in one direction**,
and the ruling said so in its own words — *"By construction becomes by census,
and that is a real loss, not a wash."* A second process with a second credential
spends it again. **The second spend is not free just because the first
happened.**

### 3.3 · Invariant 10 — a sign-in has no prior authorisation

> **10. An act with no authorisation is unrecordable.** `authorize()` mints an
> `AuthorizationGrant` and nothing else does.

**A sign-in cannot carry one.** `AuthorizationGrant extends TenantScoped`, and a
callback has no tenant by construction — `MintedSession.tenantId` is `const:
null`. G728 found the same wall from the console side and G730 answered it with
a **second home** keyed on the acting session: *"invariant 10 keeps ONE MEANING
with TWO HOMES, and each home has a scope that can actually read it."*

🛑 **NEITHER HOME FITS A SIGN-IN, AND THE REASON IS EXACT: a callback has no
session either.** `tenant.platform_authorization_grant` is keyed on the session,
and the session is the thing the act creates. **There is no third home and there
should not be one invented casually.**

**Is that a gap or a correct absence? It is a correct absence, and the argument
is `AUTHORIZATION_MAY_BE_ABSENT`.** That constant names exactly one actor kind
that may leave the id null — `system` — and a sign-in is not a system act. So
the honest reading is: **invariant 10 is about acts a principal takes, and a
sign-in is the act that creates the principal.** Nothing precedes it to
authorise it, and a record minted against a principal that does not yet exist
would be the appearance of the control rather than the control — which is
`0004`'s refusal in its own words.

⚠️ **BUT THE ABSENCE OF AN AUTHORISATION RECORD IS NOT THE ABSENCE OF AN AUDIT
NEED, AND THE TREE CURRENTLY HAS NEITHER.** `0014`'s three event streams are all
tenant-scoped, so **a sign-in — successful or refused — writes nothing
anywhere.** Combined with §1.3's finding that nothing logs and nothing
rate-limits, the state after S6 mounts would be: *an anonymous caller may hammer
two endpoints indefinitely, and the only record of having been hammered is a
CloudWatch request count with no dimension on it.*

**RECOMMENDATION (not a ruling).** Do **not** stretch invariant 10 to cover
sign-in — that weakens a precise invariant to cover a case it was not written
for. Instead treat sign-in observability as its own question (D6-4), answered
with counters and an allow-listed log line rather than with a grant row.

---

## §4 · The attacks

Each row: what stops it **today**, and what would stop it **after S6 mounts**.
"Today" is easy for all of them — **nothing is mounted**, so every attack is
unreachable. The column is filled in anyway, because the distinction between *no
route* and *a control* is exactly what this repository's `0004` refusals are
about, and reading "nothing is mounted" as safety is how a threat model becomes
decoration.

| # | Attack | Stopped today by | Stopped after S6 by | Verdict |
|---|---|---|---|---|
| 1 | CSRF on the callback | no route | `SameSite=Lax` — **partial** | ⚠️ |
| 2 | `state` forgery | no route | the attempt row's `handle_digest` UNIQUE + RLS | ✅ |
| 3 | `state` replay | no route | `consumed_at` in the minting transaction | ✅ |
| 4 | `state` **theft** | no route | **nothing** | 🛑 |
| 5 | Code injection / interception | no route | **nothing in this repo — it is the auth host's, unbuilt** | 🛑 |
| 6 | Open redirect at the 302 | no route | **nothing — the 302 target is undesigned** | 🛑 |
| 7 | IdP mix-up | no route | the broker **pair** + `sign_in_door_disagrees` | ✅ |
| 8 | Malicious BYOA IdP | no route | `orgFor(connection.owner)` + the restrictive policy | ⚠️ |
| 9 | Token substitution (`alg`) | `token-verify.ts` | same | ✅ |
| 10 | Session fixation | no route | `__Host-` prefix + duplicate-name refusal | ✅ |
| 11 | **Resource exhaustion** | no route | **nothing** | 🛑 |
| 12 | User enumeration | `RealmRequest` takes a domain | same | ✅ |
| 13 | **Domain enumeration** | no route | **nothing — acknowledged by the contract** | 🛑 |

### 4.1 · CSRF on the callback ⚠️

G386 states the cost in its own voice rather than leaving it to be discovered:
*"CSRF becomes a live concern the header design did not have — `SameSite=Lax`
mitigates it and is not a complete answer for any state-changing `POST` the
product later serves cross-site."*

`SameSite=Lax` keeps the cookie off every cross-site `POST`, `PUT`, `PATCH` and
`DELETE` — *"which is every state-changing operation served today"* — and **a
state-changing `GET` reached by a top-level navigation would carry it, and there
is none only because nobody has written one.**

For sign-in specifically the classic attack is **login CSRF**: the attacker
completes a sign-in in the victim's browser so the victim is logged into the
*attacker's* account and their subsequent work lands in the attacker's tenant.
`infra/lib/config.ts` names the harm in its own words for the neighbouring
shape: *"the victim uploads their own bank statements into the attacker's
tenant."*

**What actually stops login CSRF is the `state` parameter**, and it is genuinely
present here as a row rather than a cookie. But `completeFederatedSignIn` is a
`POST` with a JSON body, so the callback as contracted is **not** reachable by a
cross-site form post at all (a form cannot set `Content-Type: application/json`,
and AJV would reject the form encodings). **That is a real protection and it is
incidental** — it comes from the body being JSON, not from a decision. If the
callback ever becomes a `GET` or accepts a form encoding, it evaporates silently.

**No `csrfToken` is declared and minting one is a ruling** — the contract says so.

### 4.2 · `state` forgery ✅ and replay ✅

Forgery: the attempt is addressed by `handle_digest`, which is `NOT NULL UNIQUE`
and reached only through `app.signin_ref`. A forged `state` names no row and
`assembleSignIn()` answers `sign_in_attempt_absent`. The digest is stored, never
the parameter — *"a database dump containing handles would be a session-hijack
kit."*

Replay: `consumed_at` is set **in the same transaction that mints**, and
`assembleSignIn()` checks `attempt.consumedAt !== null` before the pinned facts.
**The order is argued** and it is worth carrying: *"Consuming before the model
decides would burn an attempt on a malformed callback; comparing the doors
before consuming would report a caller's tampering in preference to a replay."*

⚠️ **One gap, named in §2.2: nothing compares `expires_at`.** An unconsumed
attempt is valid forever. `0013` says so about its own column and the model
argues the absence of a `sign_in_attempt_expired` refusal rather than hiding it.
So the replay window is closed and the **pre-use** window is unbounded.

### 4.3 · `state` theft 🛑 — and the nonce that nothing checks

**This is the attack with the least defence and the most confusing-looking
defence.**

The flow's `challengeDigest` looks like a nonce check. It is not, quite.
`consumeSignInAttempt()` compares:

```ts
if (callback.challengeDigest !== attempt.challengeDigest) {
  return { ok: false, refusal: SIGN_IN_ATTEMPT_REFUSALS.signInAttemptChallengeMismatch }
}
```

**Both sides of that comparison are values the same caller supplied** — one now,
one at redirect. It proves the caller knows the challenge. **It does not prove
the token was issued for this attempt**, because the binding that would prove
that is the ID token's `nonce` claim, and §2.1 measured that `VerifiedClaims`
has no `nonce` field and `token-verify.ts` contains the string zero times.

G344 found and closed *exactly this shape* one field over, for `connectionId` —
*"That arm compares two values the SAME caller supplied"* — and closed it by
comparing against something the caller does **not** control (the door resolved
from the broker handle on the scope). **The equivalent move for the challenge is
to compare the pinned digest against the `nonce` inside the verified token**,
and nothing in the tree can do it.

⚠️ **Read the boundary honestly: this may be the auth host's job rather than a
gap.** Under G315 the code exchange happens at the auth host, and PKCE's
`code_verifier` is presented to the *token endpoint*, where the IdP enforces the
binding. If the auth host does PKCE properly, the binding is made off-tree by
the broker. **But nothing in this repository records that as a requirement, no
type expresses it, and the one function that could check the nonce cannot see
it.** That is D6-2's first sub-question and the reason R2 is not only about
caching.

**Stolen `state` remains the residual.** If an attacker obtains a live,
unconsumed `state` **and** the challenge digest, every arm passes. What limits
this is that both are digests the victim's browser holds briefly — but nothing
ages them (§4.2) and nothing rate-limits guesses (§4.5).

### 4.4 · Open redirect at the 302 🛑

**The 302 is the least-designed step in the flow and it is the classic open
redirect.** G315's callback *"exchanges the code, reads `state`, and **302s to
the tenant host**"* — so the redirect target is **derived from `state`**, which
is caller-visible and, at the moment it is read, **not yet proven to belong to
anybody.**

**What must be true and is not written down anywhere:** the tenant read out of
`state` must be resolved through the **registry** — `resolveServingHost()`, a
LOOKUP that refuses unregistered hosts — and never concatenated into a URL. G179
is the ruling that makes this available; nothing binds the auth host to it,
because the auth host does not exist.

⚠️ **And there is a second-order version specific to this product.** If the 302
target is attacker-chosen, the **one-time grant** goes with it. That hands the
grant to the attacker's host, and if that host is a tenant host under G180, the
session is minted there. **The open redirect and the grant-theft are the same
bug.**

**RECOMMENDATION (not a ruling).** The redirect target must come from
`resolveServingHost()` and the grant must be **bound to the host it is issued
for**, so that presenting it elsewhere fails closed — the same property
`checkHostBinding()` gives sessions. This is D6-3's condition, not an option
within it.

### 4.5 · Resource exhaustion 🛑 — the one a rate limit is for

Covered arithmetically in §1.3 and repeated here because it is the finding with
the clearest owner action:

- `createAppPool(max = 10)`, and `RECONCILE_DB_POOL_MAX` is set on **neither**
  task definition.
- `SERVING_TASKS_WHEN_UP.staging` is **1**.
- No rate limit, no WAF, no throttle: three greps, all zero.
- `logger: false` on this branch, so no line records the attempt.

**Ten concurrent anonymous requests with well-formed bodies exhaust the data
plane's database capacity.** Tenant traffic then queues on `connectionTimeout`.
The 5xx alarm fires (G1061) and pages **nobody** — ⚠️ **THIS READ *"because the
topic has zero subscriptions (R14) and the stack OUTPUTs that fact as
`AlarmsPageNobodyUntil`"* UNTIL 22 Sep 2026 AND IS CORRECTED RATHER THAN
DELETED, because it is the sentence a reader would have quoted onward. R14 IS
TAKEN — G1811, the owner's: a PLACEHOLDER email is subscribed** — but an
unconfirmed SNS email subscription delivers nothing, and this placeholder is
not a real inbox, so the alarm still pages nobody, for a different reason. The
stack now OUTPUTs that fact as `AlarmsPageAPlaceholderUntil`.

⚠️ **`resolveHomeRealm` is worse per-request, not better**, because §4.7 shows
its reader has to enumerate rather than address one row.

### 4.6 · IdP mix-up ✅, and a malicious BYOA IdP ⚠️

**Mix-up is well defended and the defence was witnessed red.** G344's reachable
state is stated with inputs: *"a caller holding a stolen `state` for a CUSTOMER
door presents a broker handle for a PARTNER door they legitimately control."*
Every earlier arm passes; the door comparison is what refuses. With the
comparison removed, *"§4b's cross-pool callback **succeeded** — `actual: true,
expected: false`."*

**A malicious or compromised BYOA IdP is the harder question**, because G276
puts the pool in the **customer's own account**. So: **what does a customer who
controls their own pool get to assert?**

**What they control:** every claim in the token, including `sub`, `email` and
`name`; who may sign in; and — if they can edit the pool — the signing keys.

**What they do NOT control, and this is the good news, held in four places:**

1. **`orgClass` is never conferred by the token.** It derives from
   `orgFor(connection.owner)`, and the owner is on **our** row. `0200` states it
   as *"the sharpest thing in this file"*: *"a minted person therefore inherits
   the owner of the door the callback arrived through."*
2. **The door is named by the SCOPE, not by the row being written.** The
   restrictive policy plus `0200` §2's composite FK is what makes that true —
   *"Without it, a writer could name any `connection_id` it liked and choose the
   organisation of the person it was creating."*
3. **`external_subject` is unique per connection** (G1634), so a customer's IdP
   asserting a `sub` that another customer's IdP also asserts creates two
   different people. The uniqueness *derives* the per-issuer rule rather than
   restating it.
4. **A tenant is never conferred by authentication** — §3.1.

⚠️ **THE RESIDUAL IS WITHIN THE CUSTOMER'S OWN TENANT AND IT IS REAL.** A
compromised customer IdP can sign in as **any person on its own door**, and
`external_subject` is what identifies them. It cannot reach another tenant. That
is the correct blast radius for BYOA and it should be stated to customers rather
than defended against — **the customer owns the directory; the directory decides
who they are.**

⚠️ **The claim map widens what they assert by two fields.** R6 (G1632) puts
`email_claim` and `name_claim` on the connection, so a customer's IdP chooses the
values of `email` and `display_name`. G1638 fences it — *"the claim map reaches
no authorisation surface"* — and `email`/`display_name` are DESCRIPTIONS. G1636
records that a `subject_claim` was **written and removed** on a security
argument: *"a subject mapped to a mutable claim makes an account REASSIGNABLE,
since whoever next controls that address becomes that person."* **That refusal
is the right one and it should not be quietly reopened when somebody asks why
the subject is not configurable.**

🛑 **BUT `email` AND `display_name` ARE COUNTERPARTY TEXT ON A SURFACE THAT
RENDERS THEM.** Invariant 6 — *"Ingested content is data, never instruction"* —
has never been ruled for a directory-supplied display name, and `0009` already
flags the neighbouring case: *"a customer-authored label is COUNTERPARTY TEXT"*
and *"the first thing that [reads this column] inherits that question and does
not get to skip it."* **A display name arriving from a customer-controlled IdP
and rendered in a staff console is that question, arriving for real.** It is
D6-9.

### 4.7 · Domain enumeration 🛑 — and the operation that cannot be built yet

**User enumeration is closed structurally and the contract earns the claim.**
`RealmRequest` admits `domain` and nothing that names a person, so *"two
addresses at one domain are ONE REQUEST and identical responses are a
consequence of the shape rather than an observation about one implementation."*
All four refusals share one status — *"returning 404 for an unknown address is
the natural thing to write and it is a user-existence oracle."*

**Domain enumeration is acknowledged, not closed**, and the contract says so in
capitals: *"A 200 for a claimed domain and a 422 for an unclaimed one is a
DOMAIN-existence signal. It is a weaker leak than user existence and it is a real
one. It is not invented away … THIS IS THE FIRST QUESTION FOR THE D6 THREAT
MODEL G165 IS STILL OWED."*

**This document's answer: the leak is acceptable and the rate at which it can be
harvested is not.** A domain-existence oracle tells an attacker which companies
are customers. One query at a time that is a fact an attacker could get from a
press release. **Ten thousand queries a second it is the customer list**, and
`infra/lib/config.ts` already treats the customer list as a disclosure worth a
ruling — it refuses a per-tenant callback partly because it *"publishes the
customer list AGAIN … the FIFTH API carrying this disclosure, and the first at
which the list would be a literal array of customer hostnames."*

🛑 **AND THERE IS A LARGER FINDING UNDERNEATH IT: `resolveHomeRealm` CANNOT BE
BUILT TODAY AT ALL, AND NO DOCUMENT SAYS SO.**

`routeToConnection(connections, domain)` takes **`readonly IdentityConnection[]`**
and reads `connection.domains`, a `readonly DomainClaim[]`. **`DomainClaim` has
no storage anywhere.** Derive it — and note the honest form, because the obvious
one measures prose:

```bash
# WRONG — returns 1 in two files and BOTH hits are comments:
grep -rc 'domain_claim' db/migrations/*.sql

# RIGHT — no CREATE TABLE in the whole directory names a domain:
grep -rh 'CREATE TABLE' db/migrations/*.sql | grep -ci domain     # 0
```

`0009` refuses the column on its own face and names the owner: *"`domains` IS
ABSENT AND IT IS NOT AN OVERSIGHT … **The commit that builds federated sign-in
owns the `domain_claim` table, in the same commit as the router that reads
it.**"*

**Two consequences the owner should have before ruling:**

1. **S6 is bigger than the plan says.** `docs/build/completion-plan.md` §5 W3
   lists S6 as *"Mount `completeFederatedSignIn` + `mintedSessionCookie()`'s
   first production caller"* and does not mention `resolveHomeRealm` needing a
   table. **It needs a migration nobody has scheduled.**
2. 🛑 **THE READ IT NEEDS HAS NO POLICY AND THE POLICY IT NEEDS IS A CROSS-TENANT
   ENUMERATION.** All three existing policies on `tenant.identity_connection` key
   on something a realm lookup does not have:
   ```bash
   grep -rn 'CREATE POLICY identity_connection' db/migrations/*.sql
   ```
   `identity_connection_rls` (`0009`) keys on the **session** — there is none.
   `identity_connection_signin_rls` (`0013`) keys on the **broker pair** — the
   caller is asking *which door*, so it has no handle. `identity_connection_directory_rls`
   (`0018`) keys on the directory reach. **A domain-keyed read needs a fourth
   policy, admitting a row chosen by a value an anonymous caller supplies,
   across every tenant in the database.**

   That is structurally the *"which directory does ten-acme use"* disclosure
   G340 refused as its rejected alternative (b): *"it makes "which directory does
   ten-acme use" answerable by anyone who can reach the plane, which is a
   customer-relationship disclosure and not ours to make."* **G340 refused it for
   the sign-in read and `resolveHomeRealm` needs it by design.**

   ⚠️ **The narrowing that makes it survivable exists and should be stated as a
   condition rather than left to a builder**: the policy must admit **exactly the
   row whose VERIFIED claim matches the supplied domain** — G340's *"the read is
   one row, named by the caller; the table does not become enumerable"* — and it
   must return an **id and nothing else**, which `RealmRouting` already
   guarantees (*"AN ID, NEVER A CONNECTION, AND NEVER AN ORG"*).

**RECOMMENDATION (not a ruling).** Accept the domain-existence leak; refuse the
harvesting rate. Build the fourth policy row-addressed rather than filtered, and
put `resolveHomeRealm` behind whatever answer D6-4 gets. **Do not build it as a
list-then-filter over `routeToConnection()`'s array signature**, which is what
the model's shape invites and which would make the table enumerable in one
query.

### 4.8 · Session fixation ✅ and token substitution ✅

**Fixation** is closed by the `__Host-` prefix — a sibling subdomain can neither
set nor overwrite the cookie — and by the **duplicate-name refusal**, §2.6.
`checkHostBinding()` then refuses a mismatch server-side on every request, and
G315's whole shape exists so that *"`checkHostBinding()` NEVER SEES A
MISMATCH"*, keeping G180's revoke-on-mismatch free of exceptions: *"an exception
in a revoke-on-mismatch control is the control."*

**Token substitution** is §2.1 and it is the best-defended thing in the flow.

⚠️ **One low-severity observation, reported and deliberately not inflated.** The
digest comparisons in `consumeSignInAttempt()` use `!==`, which is not
constant-time. The values are digests, the comparison is over a network, and the
attempt is addressed by the same digest through an RLS policy before the
comparison runs — so a practical timing oracle here is **unlikely**, and saying
otherwise would be the kind of overstatement `docs/model-change-ledger.md`'s
convergence rule exists to catch. **Named so that a future reviewer finds it
already considered**; `timingSafeEqual` would cost nothing and is not urgent.

---

## §5 · What the owner must decide

**TEN decisions. Six are cheap. Two are expensive. Two are cheap to decide and
expensive to get wrong.** Each leads with what it costs the owner, not what it
costs to implement.

> ⚠️ **THIS LINE SAID *"Nine decisions. Four are cheap"* IN THE DRAFT AND IS
> CORRECTED IN PLACE RATHER THAN SILENTLY FIXED, BECAUSE IT IS THIS DOCUMENT'S
> OWN §7 HAPPENING TO ITSELF.** A count sat beside a noun and disagreed with the
> nouns under it; `check-doc-counts` governs no figure in this file and could not
> see it. **Derive it, never read it:**
> `grep -cE '^### D6-[0-9]+ ·' docs/build/d6-threat-model.md` → **10**.

---

### D6-1 · Do these two operations go public at all, and in which order?

**Blocks:** S6, S7, and therefore every browser sign-in.
**This is R1.**

**The options.**

| | Option | Cost to you |
|---|---|---|
| **a** | **Mount both, with D6-4's controls in place first.** | The product has a sign-in. You accept a domain-existence oracle and an anonymous surface. |
| **b** | **Mount `completeFederatedSignIn` only; defer `resolveHomeRealm`.** | Sign-in works if the client already knows its door. Costs a design answer for *"how does a browser learn its `connectionId`"* — plausibly a per-tenant host already knowing it, since a tenant host **is** a tenant. **Removes the domain oracle entirely and removes a migration from S6.** |
| **c** | **Neither until the auth host exists (D6-3).** | No sign-in. Everything else in W3 stays blocked. |

🛑 **RECOMMENDATION: (b), then (a).** The two operations have very different risk
profiles and the plan treats them as one slice. `completeFederatedSignIn` is
reached with a `state` the platform itself minted; `resolveHomeRealm` is reached
by anybody with a wordlist, needs a table that does not exist, and needs a policy
that makes a tenant-scoped table readable across tenants (§4.7). **Splitting them
lets sign-in ship without the enumeration surface and without an unscheduled
migration.**

⚠️ **Under (b) the tenant host must supply the door.** That is a real design
question and it is smaller than the one (a) opens.

**Cheap or expensive to decide?** **Cheap to decide, expensive to get wrong** —
G165's own words: *"there is no precedent to lean on and **no second chance to
set the posture**."*

---

### D6-2 · The JWKS source and the egress posture — **R2**

> ✅ **TAKEN 25 Sep 2026 — G2131 — AND IT IS NONE OF THE THREE OPTIONS BELOW,
> WHICH IS WHY THEY ARE LEFT STANDING.** The owner ruled: *"The JWKS is fetched
> ONCE AT BOOT and cached in memory. No runtime egress."* That is **(a)'s
> mechanism with (c)'s timing** — the data plane fetches, and it fetches once,
> before it listens. **(a)'s stated cost is paid in full and is on the modules'
> faces**: the no-egress property ends, and *"the broker is down, so nobody
> signs in"* becomes *the broker is down, so the DEPLOY fails* — louder, and
> chosen. **(c)'s cost is paid too**: a key rotation needs a restart.
>
> 🛑 **AND THE SECOND QUESTION INSIDE R2 — *"WHO CHECKS THE `nonce`?"* — IS
> ANSWERED IN THE COMMIT THAT BUILT IT, WHICH IS WHAT THIS ROW DEMANDED.**
> `VerifiedClaims` gains `nonce`, READ and not checked (G2141), and
> `bindTokenToAttempt()` compares its digest against the challenge the redirect
> pinned (G2154). **So the answer is *in `verifyIdentityToken()` by widening
> `VerifiedClaims`*, and NOT *in the IdP via PKCE at the auth host*** — though
> PKCE is required too, at `CodeExchangeInput.codeVerifier` (G2152), which
> answers §6 item 2. **§4.3 below is now CLOSED and is left unedited as the
> analysis it is.**

**Blocks:** S4, therefore S6.

**What you are actually deciding** is not caching policy. It is **whether this
product makes outbound HTTP requests at all.** Today it makes none:
`grep -rn 'fetch(' server/` → **0**, asserted by
`tests/http/console-roster-unreachable.test.ts` §1c over both plane directories.

| | Option | Cost to you |
|---|---|---|
| **a** | **The data plane fetches the JWKS and caches it.** | Ends the no-egress property. A new credential posture and a new failure mode: *the broker is down, so nobody signs in.* Every `fetch(` assertion in the suite changes meaning. |
| **b** | **The auth host fetches it; the data plane never sees a token.** | Keeps `server/`'s egress empty **if the auth host is a separate deployable**. Concentrates the decision in D6-3. |
| **c** | **The JWKS is configuration** — supplied at boot from a secret or a parameter. | No egress, no new dependency, no cache invalidation. **Cost: key rotation becomes a deploy.** Cognito rotates signing keys, so this is a real operational cost, not a theoretical one. |

🛑 **RECOMMENDATION: (b), with (c) as the fallback if the auth host turns out to
be a data-plane route after all.** (a) is the option that looks obvious and
spends the most.

⚠️ **AND THERE IS A SECOND QUESTION INSIDE R2 THAT ITS ONE-LINE STATEMENT DOES
NOT CONTAIN, SURFACED BY §4.3: WHO CHECKS THE `nonce`?** `VerifiedClaims` has no
field for one, so whichever option you take, **the commit that builds it must
say where the token↔attempt binding is made** — in the IdP via PKCE at the auth
host, or in `verifyIdentityToken()` by widening `VerifiedClaims`. **Today the
answer is "nowhere", and `challengeDigest` looks like it is the answer and is
not.**

**Cheap or expensive?** **Expensive.** It decides an architectural property the
whole tree is currently arranged around.

---

### D6-3 · Where the regional auth host runs — **R3**, and R4 sits inside it

> ✅ **TAKEN 25 Sep 2026 — OPTION (b), THIS ROW'S OWN RECOMMENDATION.** The
> owner ruled: *"The code exchange is a STATELESS exchange inside the EXISTING
> data plane."* No third process, no new stack, no new network — so §3.2's
> *"second spend"* of G193's by-construction does **not** happen, and invariant
> 3 is untouched because the exchange resolves nothing.
>
> 🛑 **AND IT COLLIDES WITH R2, WHICH THIS ROW DID NOT FORESEE AND THE BUILDING
> SLICE HAD TO RESOLVE — G2151.** A code exchange is an outbound POST **per
> sign-in**; R2's *"no runtime egress"* forbids exactly that. **The slice
> therefore stops at the seam**: the request builder, the response reader, the
> verification, the binding and the composition are all built, and
> `unauthorisedEgressTransport()` refuses the call by name. **Whether the data
> plane may make a REQUEST-PATH outbound call is a NEW open question**, and it
> is this row's D6-4 that prices it.
>
> ⚠️ **§6 ITEM 1 IS RESOLVED: R4 *WAS* AMENDED.** This document recorded as
> undetermined *"whether R4 was amended on 21 Sep 2026"* and reported that the
> tree carried no amendment. **It does now** — `docs/HANDOFF.md`'s G315 row
> opens with it — and the callback takes `infra/lib/config.ts`'s shape, which
> is **option (c) of this row's own table**, mirrored and asserted at
> `tests/http/code-exchange.test.ts` §1. ⚠️ **(c)'s NAMED COST — the G180
> collision — IS NOT DISCHARGED BY THIS SLICE AND IS NOT INCURRED BY IT
> EITHER**, because nothing mints a session: it lands on whoever writes S6.

**Blocks:** S5.

**The tree contradicts itself here and §3.2 is the analysis.** G315 rules
`auth.{region}.reconcileai.app/callback`. `infra/lib/config.ts` synthesises
console callbacks instead and **refuses a redirect-to-tenant shape by name**.
Derive both:

```bash
grep -n 'COGNITO_CALLBACK_PATH\|cognitoCallbackUrls' infra/lib/config.ts
grep -rn 'auth\.us-west-2\.reconcileai' infra/ | wc -l     # 0
```

⚠️ **THE BRIEF COMMISSIONING THIS DOCUMENT DESCRIBES G315 AS "AS AMENDED BY R4
ON 21 Sep 2026". THE TREE CARRIES NO SUCH AMENDMENT** — on this branch and on
every remote branch checked, `docs/build/completion-plan.md` §4 still lists R4 as
**open, Owner, blocks S5**, and `docs/HANDOFF.md`'s G315 row is unamended and
`not applied`. **Reported rather than assumed in either direction**: either the
amendment exists outside the tree and is owed a row, or the brief anticipated
one. §6 records it as undetermined.

| | Option | Cost to you |
|---|---|---|
| **a** | **A regional auth host as a third deployable.** | A third process, a third credential, a new stack. Spends G193's *"by construction"* a second time (§3.2). |
| **b** | **A stateless exchange ROUTE on the data plane**, answering on the `auth.{region}` host, resolving nothing. | No third process. `withSignInScope()` is untouched. **Needs `auth.{region}` in the host registry and a CloudFront behaviour.** |
| **c** | **Amend G315 to `infra/`'s console callbacks.** | Collides with G180 — a session minted at a console host and carried to a tenant host is revoked by the control that exists to stop that carry. G315 refused this as its own alternative (b). |

🛑 **RECOMMENDATION: (b).** It is the shape §3.2 argues the tree is already
arranged for, and it keeps invariant 3 untouched because it resolves nothing.

**Two conditions, not options, from §4.4:** the 302 target must come from
`resolveServingHost()` (a lookup that refuses unregistered hosts, never a
concatenation), and **the one-time grant must be bound to the host it is issued
for.** Without the second, the open redirect and grant theft are one bug.

**And one more, from §3.1:** the grant needs a declared type in `model/` carrying
`AssertNoTenantDeep`, **in the commit that invents it.** One type; makes the
endorsed-by-a-ruling invariant-1 breach a compile error.

**Cheap or expensive?** **Expensive**, and R4 must be resolved in the same
breath — the contradiction is live and one of the two must move.

---

### D6-4 · Rate limiting, and what a public endpoint records

**Blocks:** nothing formally. **It is the finding this document would most like
to be wrong about and is not.**

§1.3, §4.5: **ten concurrent anonymous requests exhaust the pool of the single
staging task.** No rate limit, no WAF, no throttle, and on this branch no log.

| | Option | Cost to you |
|---|---|---|
| **a** | **A WAF rate rule on the CloudFront distributions.** | An AWS resource and a bill. Sheds load **before** it reaches a connection. Nothing in `server/` changes. |
| **b** | **In-process rate limiting** (`@fastify/rate-limit`). | A new pinned dependency under G191 — a ruling. **Per-task**, so it does not survive scaling, and the request has already reached the process. |
| **c** | **Raise `RECONCILE_DB_POOL_MAX` and task count.** | Not a control. Moves the number an attacker must reach. |
| **d** | **Accept it for staging; revisit before a customer.** | Free now. ⚠️ Staging is internet-reachable today. |

🛑 **RECOMMENDATION: (a), and it is the cheapest real control in this document.**
The edge already exists — two distributions, `grep -c 'new cloudfront.Distribution'
infra/lib/edge-stack.ts` → 2 — and a rate rule is an `infra/` change with no
`server/` edit, no dependency and no `Planes` deploy. **It is one stack away.**

**And the observability half, which is one decision not two.** With D-4 merged
(PR #472) the logger is on behind an allow-list. Two things are owed on a public
endpoint and neither is in that branch:

- **A refusal counter per arm.** `SIGN_IN_ATTEMPT_REFUSALS` has four members and
  `DOMAIN_ROUTING_REFUSALS` four; **a spike in `sign_in_attempt_replayed` is an
  attack and a spike in `domain_not_claimed` is enumeration.** Today neither is
  countable.
- **`console.error` must not be how a public endpoint reports.** 40 call sites in
  `server/` (`grep -rn 'console\.error' server/ | wc -l`), 15 in `session.ts`,
  and PR #472 records `authorisation-record.ts` interpolating an error's own
  `message` as *"a live §12.1 breach that predates this slice"*. **On an
  anonymous surface that publishes whatever the caller sent.**

**Cheap or expensive?** **Cheap**, both halves. This is the highest
ratio of risk-removed to work in the document.

---

### D6-5 · Where the broker issuer comes from

**Blocks:** S5/S6's correctness, not their existence.

`withSignInScope()` takes `brokerIssuer` and `brokerRef` as strings. **The pair
is the whole narrowing** — `assembleSignIn()` says so: *"there is no value here
for a body to influence and no argument for a call site to pass wrongly …
`readConnectionByBrokerHandle()` adds no predicate; the policy is the whole
narrowing."*

**That sentence is true of `assembleSignIn()` and it is a statement about its
CALLER.** The fence is that the values were set on the scope before the
transaction ran — **it is not a fence against the caller having taken them from
the request body.** No such caller exists, so nothing is broken; but the
sentence reads as a guarantee and it is a precondition.

🛑 **RECOMMENDATION (a condition, not an option): the issuer must come from the
`iss` of a VERIFIED token and the reference from the broker's provider name in
the same verification.** `FederatedCallback` carries neither, deliberately, and
must not gain either. **The commit that writes the callback handler owes an
assertion that these two values are not derived from the request body** — the
shape `tests/http/session-cookie-channel.test.ts` §3 already uses over the source
tree.

**Cheap or expensive?** **Cheap to decide, expensive to get wrong** — a wrong
handle resolves to the wrong door and thence the wrong `orgClass`, which G289
prices at five deleted controls.

---

### D6-6 · Does a sign-in attempt expire?

**Blocks:** nothing. **A gap the tree already documents.**

`expires_at` is `NOT NULL` and **read by nothing**; the model argues the absence
of a `sign_in_attempt_expired` refusal rather than leaving it to be found, and
`0013` says *"do not add one here"* — because `Timestamp = string` and a
comparison in the model would be lexical.

| | Option | Cost to you |
|---|---|---|
| **a** | **Compare in SQL at the read**, where the type is `timestamptz`. | One `AND expires_at > now()` in `ATTEMPT_READ`. **Collapses a refusal into `sign_in_attempt_absent`** — the same loss `0039`'s reader argues about, where a predicate in the `WHERE` deletes a named refusal. |
| **b** | **Compare in the model**, once G220's codec lands. | Keeps the refusal nameable. Waits on a codec. |
| **c** | **Leave it. Operators sweep.** | An unconsumed attempt is valid forever. |

🛑 **RECOMMENDATION: (a) now, (b) later** — and **do not** delete `expires_at`'s
comment when (a) lands; amend it in place, as `0017` did to `0014`.

**Cheap or expensive?** **Cheap.**

---

### D6-7 · The restrictive policy tests the door and not the person

**Blocks:** nothing today. **It is a statement about the next commit.** §2.5.

`user_signin_mint_restrictive` compares the broker pair alone.
`user_signin_rls` compares the pair **and** `external_subject`. A fifth
permissive policy would meet the restrictive test without ever naming a subject.

| | Option | Cost to you |
|---|---|---|
| **a** | **Add `external_subject` to the restrictive `WITH CHECK`.** | One line. ⚠️ **Must be measured first** — §2.5's `USING` finding shows an "obvious tidy-up" on this table was *an authentication outage*, and `0200` §6 goes red on exactly that edit. A `WITH CHECK` is not consulted by `SELECT`, so this is likely safe; *likely* is not the standard this file sets. |
| **b** | **A tripwire test** asserting `tenant."user"` carries exactly the policies it carries today. | Makes the fifth policy a red gate rather than a silent widening. Precedent: `0200` §7b's third-`%_claim`-column tripwire. |
| **c** | **Leave it; the FK and the permissive policy suffice today.** | True today. Rests on nobody adding a policy. |

🛑 **RECOMMENDATION: (b), and (a) only if witnessed red first.** (b) costs one
assertion and converts the hazard into a gate; (a) touches the one table where a
tidy-up has already been measured as an outage.

**Cheap or expensive?** **Cheap.**

---

### D6-8 · The fourth boot fence does not fire on an unauthenticated operation

**Blocks:** nothing. §2.7, **measured**: `callerOf([])` is `'none'` and
`callerMayBeAPerson('none')` is `false`.

| | Option | Cost to you |
|---|---|---|
| **a** | **Add `'none'` to `callerMayBeAPerson()`.** | One line, and it governs **seven tiers**. Any currently-mounted ungated operation with `security: []` would fail to boot until marked. **Must be measured against the whole corpus first.** |
| **b** | **A separate fence for `caller === 'none'`**, so a public mount is acknowledged in its own greppable call. | Keeps the existing predicate's meaning. A seventh fence, and five files cite fences by number. |
| **c** | **Leave it; document that S6 owes `servedWithoutAGate()` voluntarily.** | A convention, and G914 exists because conventions are not fences. |

🛑 **RECOMMENDATION: (b).** The existing predicate's argument — *"an unknown
scheme must cost the fence rather than escape it"* — is about authenticated
callers and is correct as written. **A public mount is a different question and
deserves its own fence rather than a widened one.** ⚠️ Renumbering is the cost:
`docs/HANDOFF.md` and four files cite fences by ordinal, and G911 already
declined to renumber for exactly this reason.

**Cheap or expensive?** **Cheap**, under (b).

---

### D6-9 · A directory-supplied display name is counterparty text

**Blocks:** nothing yet. §4.6.

R6 puts `email_claim` and `name_claim` on the connection, so under BYOA a
customer's IdP chooses `display_name`. G1638 fences it away from authorisation.
**Invariant 6 has never been ruled for a configuration field a console renders**,
and `0009` already flagged the neighbouring case and said *"the first thing that
[reads this column] inherits that question and does not get to skip it."*

🛑 **RECOMMENDATION: record it now, rule when the first console renders a person.**
`display_name` reaches no surface today. **The value of deciding now is that the
slice which first renders one meets a recorded question instead of inventing an
answer** — which is what `0009` asked for and what this row is.

**Cheap or expensive?** **Cheap to record. Do not confuse it with R6**, which is
taken.

---

### D6-10 · R7 — where session bounds are configured

> ✅ **TAKEN 25 Sep 2026 — OPTION (a), THIS ROW'S OWN RECOMMENDATION — G2121.**
> The owner ruled: *"Session bounds are a platform-wide constant, read at mint
> time. No per-tenant override."* **And this row's prediction held to the
> word**: *"`validateSessionBounds()` already refuses on absence rather than
> defaulting — G139 — so the 503 arms become reachable with no new
> mechanism."* `server/data-plane/session-bounds.ts` is the reader and
> **`tests/http/session-bounds.test.ts` produces all EIGHT arms from a real
> `process.env`**, with a census that makes a ninth a red gate.
>
> ⚠️ **ONE READING WAS REFUSED AND IS WORTH CARRYING FORWARD, BECAUSE IT IS THE
> SHORTEST WAY TO HONOUR THE WORD *"CONSTANT"* AND IT IS WRONG (G2121):**
> returning `PLATFORM_SESSION_CEILING`'s two integers directly. It converts a
> CEILING into a DEFAULT — G220 calls that distinction *"the whole ruling"* —
> and it makes **three of the eight arms structurally unreachable**, including
> `bounds_not_configured`, which is G139's entire point. **"Platform-wide
> constant" is read as one pair of numbers for the whole platform, stated by
> the deployment**, which is the axis the ruling's second sentence is about.
>
> 🛑 **AND G1610's HALF IS UNCHANGED AND IS NOW EXPRESSED AS AN ARITY**:
> `platformSessionBounds()` takes no parameter, so there is no position a
> `TenantId` could occupy and the override is unrepresentable rather than
> refused.

**Blocks:** S2's 503 arms being reachable.

**Half of R7 is already decided by invariant 1 rather than by preference**, and
that is G1610's finding rather than this document's: **a per-tenant session bound
is unreadable at mint time**, because at the mint there is no tenant — by
`const: null`, by design. So a per-tenant bound could only be applied *after*
selection, which is a different act on a session that already exists.

| | Option | Cost to you |
|---|---|---|
| **a** | **Platform-wide, from configuration.** | `validateSessionBounds()` already refuses on absence rather than defaulting — G139 — so the 503 arms become reachable with no new mechanism. |
| **b** | **Per-tenant.** | Needs a store, a reader, **and an answer to G1610**: it cannot be read where it would be applied. |

🛑 **RECOMMENDATION: (a).** It is what the model is already shaped for, and the
eight `SESSION_BOUND_REFUSAL_REASONS` arms exist precisely so that a missing or
malformed bound is a **503 and never a default**. The contract names the
dangerous one: *"every comparison against `NaN` is false, so a `NaN` bound
expires nothing and FAILS OPEN."*

**Cheap or expensive?** **Cheap**, under (a).

---

## §6 · What I could not determine

**Generously, because half of this document's value is in the boundary.**

1. 🛑 **WHETHER R4 WAS AMENDED ON 21 Sep 2026.** The brief commissioning this
   document describes G315 as *"as amended by R4 on 21 Sep 2026"*. **The tree
   carries no amendment** — `docs/build/completion-plan.md` §4 lists R4 as open
   and `docs/HANDOFF.md`'s G315 row is `not applied` and unedited, on this branch
   and on every remote branch checked. D6-3 is written as though R4 is open. **If
   it was taken, this section is where that shows up, and G315's row is owed an
   amendment either way.**

2. **Whether the auth host's code exchange does PKCE.** §4.3's residual turns on
   it. The process does not exist, so this is a question about a decision rather
   than about code. **It is the sub-question inside D6-2 and it is the one most
   likely to be assumed rather than answered.**

3. **What the one-time grant the 302 carries actually is.** No type, no name, no
   file. G315 leaves it to the builder by name. Everything §3.1 and §4.4 say
   about it is about a shape, not an implementation.

4. **Whether a fourth policy on `tenant.identity_connection` can be written
   row-addressed rather than filtered.** §4.7 argues it must be. **I did not
   write it and did not measure it against a live PostgreSQL**, and `0200`'s
   history is a standing warning against predicting policy behaviour: a first
   draft there was refused eleven arms out of eleven by a two-table recursion
   nobody predicted.

5. **Whether adding `'none'` to `callerMayBeAPerson()` (D6-8 option (a)) would
   fail any currently-mounted operation at boot.** Derivable by enumerating every
   mounted operation's `security` across five tiers. **I did not run it**, and
   D6-8's recommendation deliberately avoids depending on the answer.

6. **The real-world exploitability of the non-constant-time digest comparisons**
   (§4.8). Named, not measured. Deliberately not inflated.

7. **Whether staging is currently reachable from the public internet in a way
   that makes D6-4's exhaustion finding live today.** **I did not touch AWS**,
   as instructed. G316 records `/v1/runs` answering `401` from the public
   internet on 21 Sep 2026, which implies reachability; the pool arithmetic is
   derived from the tree and holds regardless of who can reach it.

8. **Whether `token_use` matters for this broker.** Cognito issues both ID and
   access tokens from one issuer with one key set, and `token-verify.ts` neither
   reads nor names the claim that distinguishes them. **Whether an access token
   would satisfy every arm of `verifyIdentityToken()` is a property of Cognito's
   claim set that I did not verify**, and it is a real question for D6-2 because
   the answer decides whether a fifteenth arm is owed a sixteenth.

9. **What `docs/handoff-pack/` says about the sign-in surface.** G341 amended the
   pack's `/entry` to the tree's `/signin`, and there is no callback route in the
   route table (`grep -c "'/signin/callback'" frontend/src/routes/table.ts` → 0).
   **The browser round trip is S7 and a thirteenth route, which is a design
   change** — outside this document.

---

## §7 · Derivations index

Every command in this document, in one place. **Run them; do not read the
document's numbers.**

```bash
# §1.1 the public surface — a PARSER, not a grep (G978)
node -e "const fs=require('fs'),y=require('yaml');const d=y.parse(fs.readFileSync('docs/contracts/session.openapi.yaml','utf8'));for(const[p,ms]of Object.entries(d.paths))for(const[m,op]of Object.entries(ms))console.log(m,p,op.operationId,('security'in op)?JSON.stringify(op.security):'INHERITS '+JSON.stringify(d.security))"

# §1.3 what an anonymous caller can spend
grep -n 'createAppPool' db/tenant-scope.ts                     # max = 10
grep -rn 'RECONCILE_DB_POOL_MAX' infra/ | head -2              # set on NEITHER task definition
grep -n 'SERVING_TASKS_WHEN_UP' infra/lib/config.ts            # staging: 1
#  ⚠️ R-POOL (G2261, 1 Oct 2026): the two lines above now answer the data task's
#  pool of 47 and `staging: { data: 2, control: 1 }` — BUILT, NOT DEPLOYED; §1.3's banner
grep -rl 'rateLimit\|rate-limit\|rate_limit' server/ infra/ package.json | wc -l   # 0
grep -rl 'wafv2\|WebAcl\|WebACL' infra/ | wc -l                # 0
grep -n 'logger: false' server/http/app.ts                     # 403 — on THIS branch
grep -rn 'console\.error' server/ | wc -l                      # 40

# §2.1 the verifier
grep -rln '^export function verifyIdentityToken' server/       # exactly one, per G2171
#  the unanchored form answered one for a tree with NO verifier; the `^` is the repair
grep -oE "kind: '[a-z_]+'" server/data-plane/token-verify.ts | sort -u | wc -l   # 15
grep -c 'nonce' server/data-plane/token-verify.ts              # 0
grep -rn 'fetch(' server/ | wc -l                              # 0

# §2.2–2.5 the substrate
grep -n 'set_config' db/signin-scope.ts
grep -n 'GRANT' db/migrations/0013_federated_signin.sql
sed -n '/CREATE POLICY user_signin_rls/,/;/p'              db/migrations/0200_external_subject_and_claim_map.sql
sed -n '/CREATE POLICY user_signin_mint_restrictive/,/;/p' db/migrations/0200_external_subject_and_claim_map.sql

# §2.6 the cookie
grep -n 'SESSION_COOKIE =\|^const ATTRIBUTES' server/data-plane/session-cookie.ts

# §2.7 the fence that does not fire — copy both predicates VERBATIM and run them
sed -n '/export function callerOf/,/^}/p'            server/contract/capability.ts
sed -n '/export function callerMayBeAPerson/,/^}/p'  server/contract/capability.ts

# §4.7 the table resolveHomeRealm needs and does not have
grep -rh 'CREATE TABLE' db/migrations/*.sql | grep -ci domain  # 0
grep -rc 'domain_claim' db/migrations/*.sql                    # ⚠️ 1 in two files, BOTH prose
grep -rn 'CREATE POLICY identity_connection' db/migrations/*.sql

# §5 D6-3 the R4 contradiction
grep -n 'COGNITO_CALLBACK_PATH\|cognitoCallbackUrls' infra/lib/config.ts
grep -rn 'auth\.us-west-2\.reconcileai' infra/ | wc -l         # 0

# the served set — the session tier is registered and mounted NOWHERE
grep -n 'session:' server/contract/document.ts                 # session.openapi.yaml
grep -ohE "tier: '[a-zA-Z]+'" server/*/start.ts | sort -u      # five, none of them 'session'
```

⚠️ **Two of these are deliberately shown in their WRONG form beside the right
one**, because the wrong form is what a reader would write: `grep -rc
'domain_claim'` measures comments, and a line-counting grep for
`verifyIdentityToken` counts this document. **That is G978, and this document
committed the first of them before catching it.**

---

*End of D6. Nothing above is a ruling. §5 is nine questions with costs and
recommendations; `docs/HANDOFF.md` §3 is where the answers go.*
