# RED — D1: adversarial review of `stateless-green-session.md`

> **STATUS:** WORKING MATERIAL · **V1 AUTHORITY: NO**. Nothing here is applied. No file in the
> repository was changed by this document.
> **Written** 9 Aug 2026 against `HEAD` (`f988f2a4`), **after** its green counterpart
> (`docs/build/stateless-green-session.md`, same day). The green document was written first and
> **no red team had seen it** — the original review died on a session limit, which is why this
> exists.
> 🛑 **NO ADJUDICATION HAS RULED BETWEEN THESE TWO DOCUMENTS.** Where they disagree, neither is
> authority. `docs/HANDOFF.md` §3 outranks both.
> **The owner's ruling of 9 Aug 2026 is an INPUT and is not attacked here:** *"I want the
> application stateless so it can scale without a node dependence and for ease of retry in case a
> node fails. That means everything that carries state, including session data or other user
> artifacts, must be committed to the database."* Every finding below attacks the DESIGN — a cost
> it hides, or a property it claims and does not have.

**Invariant 1, copied and not paraphrased:** *"Tenant scope is derived from the session, never read
from a request."*

**Invariant 8, copied and not paraphrased:** *"Being staff is not access. Reaching a tenant requires
a `TenantAccessGrant` — and reaching a class of thing requires that class to appear in
`PERMITTED_RESOURCES` or in a signed `SupportAuthorisation`."*

**Method.** Every premise below was opened at the tree and is cited with `file:line`. An attack on a
false premise is STRUCK, and §4 strikes mine by name. Counts are derived with the command shown.
Where I could not verify something I say **not verified** rather than guessing.

---

## 1. BLOCKERS

### B1 — Tenant selection has no gate anywhere, so the request-supplied tenant did not disappear; it moved into one request body

**The claim.** The green design's §3.2 asserts invariant 1 has *"one writer"* and *"one reader"*, and
§9's wire table names `POST /session/tenant` `selectTenant` **"the only writer of
`Session.tenantId`"**. Nothing in the design constrains **what that writer may write.** There is no
`selectTenant` function in §2, no refusal member for it in `SESSION_REFUSALS`
(`docs/build/stateless-green-session.md:451-483`), no mutation for it in the M1–M14 table, no
assertion in §2.5, and no predicate in migration 0002. The one authority-bearing write on the
surface is specified as an operation name.

**Premises, verified.**

- `resolveSession()` never checks membership. It checks row agreement, liveness, `tenant.id !==
  session.tenantId` and `tenant.status`. Reproduce: the function body is
  `stateless-green-session.md:589-686`; `grep -c 'Membership' docs/build/stateless-green-session.md`
  → 4, every hit in prose, none in a declaration.
- The data to check it with **already exists**: `Membership { id, userId, tenantId, roleId }`
  (`model/domain.ts:1440`, fields at `:1448-1450`). `membership_absent` already exists as a wire code
  (`docs/contracts/errors.yaml:100`). So this is not a missing-primitive problem.
- The database does not check it either. 0002's policy is
  `handle_digest = nullif(current_setting('app.session_ref', true), '')` for **both** `USING` and
  `WITH CHECK` (`stateless-green-session.md:995-997`). `WITH CHECK` constrains the digest column and
  **nothing else**, so an `UPDATE session SET tenant_id = …` on your own row satisfies it for **any**
  value that satisfies the foreign key.

**Failure scenario, with inputs.** Attacker holds a legitimate session for their own tenant.

1. `POST /session/tenant { "tenantId": "ten_acme" }` — a tenant they have no `Membership` in.
2. The handler is inside `withSessionScope(pool, digest, …)`. It issues
   `UPDATE session SET tenant_id = 'ten_acme' WHERE handle_digest = …`. RLS: the row's
   `handle_digest` still equals `app.session_ref`, so `WITH CHECK` passes. The FK
   `tenant_id text NULL REFERENCES tenant (id)` (`stateless-green-session.md:948`) passes because
   `ten_acme` exists.
3. Next request: `resolveSession()` returns `ok: true`. `TenantContext` carries
   **`ten_acme`'s `residency`, `environment`, `deploymentMode`** — a cross-tenant read of tenancy
   metadata on its own.
4. `withTenantScope(pool, 'ten_acme', …)` opens. Every handler that reads a tenant-scoped row
   **without** routing through `decide()` — a list endpoint, a count, a dashboard query — reads
   Acme's rows, and **RLS reports success**, because the predicate was satisfied.

`decide()` (`model/access.ts:1177`) does refuse: `held` is read under `app.tenant_id = 'ten_acme'`,
the attacker holds no assignment there, and the decision denies. **That is the only thing standing in
the way, and it is a per-act capability check, not an access boundary.** So the design's own
§3.2 sentence — *"The database is the enforcement, not the handler"* — is **false as written**: the
database enforces that you see the tenant you *selected*, and selection is unauthorised. G100's
deny-on-NULL backstops a **forgotten** `set_config`. It backstops nothing against a **chosen** one.

This is `docs/HANDOFF.md` §5.1's shape at full size — the rule is keyed on the landmark *"no
`tenantId` in a request body"* (the design's grep #1, `stateless-green-session.md:1519`) instead of
on the property it protects, *the principal may only scope to a tenant they hold a membership or a
grant in.* The grep passes at zero for `session.openapi.yaml` while `POST /session/tenant`'s body is
the one place in the system where a caller states a tenant.

**The control that would close it.**

1. `selectTenantForSession()` in `model/access.ts`, pure and total in `resolveSession()`'s shape:
   takes the `Session`, the `User`, the candidate `Tenant`, the principal's `readonly Membership[]`
   and (for a staff principal) the `TenantAccessGrant`, and returns
   `{ ok: true; tenantId } | { ok: false; refusal }` with `membership_absent` as a named arm. Never a
   boolean, never a throw — the design's own §5.2 discipline, applied to the write it left out.
2. A database half, because the design's whole argument for RLS is that a handler mistake must not be
   sufficient: 0002's `WITH CHECK` must additionally require
   `tenant_id IS NULL OR EXISTS (SELECT 1 FROM membership m WHERE m.user_id = session.user_id AND
   m.tenant_id = session.tenant_id AND m.revoked_at IS NULL)`. That requires `membership` to exist
   (see B3) and it makes the selection write refusable at the same layer as the read.
3. A mutation in the table: *delete the membership check and
   `test_a_session_cannot_select_a_tenant_it_holds_no_membership_in` must fail with `ok: true`.*

---

### B2 — The chain as ordered cannot execute: the `tenant` row is read where 0001's policy denies it, and every repair makes the raw column, not `resolveSession()`, the producer of `app.tenant_id`

**The claim.** §2.8's step table (`stateless-green-session.md:1078-1091`) reads, at step 4,
*"read `user`, `identity_connection`, and `tenant` if selected | same transaction"* — the transaction
opened at step 2 by `withSessionScope()`, which sets **only** `app.session_ref`
(`stateless-green-session.md:1054-1057`). Step 8, `withTenantScope()`, is where `app.tenant_id` is
set.

**Premise, verified.** `tenant`'s policy is
`USING (id = nullif(current_setting('app.tenant_id', true), ''))`
(`db/migrations/0001_tenancy_and_rls.sql:174-176`), with `ENABLE` **and** `FORCE ROW LEVEL SECURITY`
(`:131-132`), and `reconcile_app` holds neither `BYPASSRLS` nor ownership
(`db/tenant-scope.ts:75-78`). Inside the session-scope transaction `app.tenant_id` is unset, so
`current_setting('app.tenant_id', true)` is NULL, `nullif` is NULL, `id = NULL` is NULL, **the row is
filtered.**

**Failure scenario.** A session that has *successfully* selected `ten_acme` presents its handle.
Step 3 returns the session row. Step 4's `tenant` read returns **0 rows**. The caller therefore
passes `tenant: null`, and `resolveSession()` refuses at
`stateless-green-session.md:659-661` with **`tenant_not_selected`**. Every request from every
correctly-selected session fails, with the refusal that means the opposite of what happened. Under
§6.2's **recommended** shape (ii) — *"resolve in one short transaction, then run the work in a
second"* (`:1575`) — this is unconditional.

**And the repair is the more interesting half.** To read `tenant` you must set `app.tenant_id`
first, which means feeding it `session.tenant_id` **straight off the column, before
`resolveSession()` has run** — before `revokedAt`, before `expiresAt`, before `connection.status`,
before `User.status`. So:

- §3.2's *"One reader. `resolveSession()` is the only producer of a `tenantId` for
  `withTenantScope()`"* becomes false. The producer is the raw column.
- The tenant scope is opened for revoked sessions and fired employees, and only then refused. The
  window is one transaction wide, and every handler bug inside it reads real tenant data under a
  dead session's scope.

**The control that would close it.** Split the resolver at the seam the database actually has:

- `resolveSubject(input: { session, user, connection, secondFactorRequired, now })` → all the
  row-agreement and liveness refusals, returning `{ ok: true; tenantId: TenantId }` — no `tenant`
  row, so it runs entirely inside `withSessionScope()`.
- `withTenantScope(pool, tenantId, …)` — opened only on `ok: true`, i.e. only for a live session.
- `projectTenantContext(subjectResolution, tenant)` → the `TenantContext`, with
  `tenant_row_mismatch` and `tenant_suspended`, called **inside** the tenant scope where the `tenant`
  row is legitimately readable under 0001's own predicate.

That ordering is also the one that satisfies the design's own liveness-before-derivation rule
(`stateless-green-session.md:576-582`), which the single-function shape cannot.

---

### B3 — The pre-tenant read set is unprovisioned and unpoliced: 0002 creates two of the tables the chain reads, and says nothing about the protection of the rest

**The claim.** Migration 0002 is the design's centrepiece and the one thing §8's Q2 asks the owner to
ratify. It creates `session` and `sign_in_attempt` (`stateless-green-session.md:941-963`) and nothing
else.

**Premises, verified.** §6.1's own table (`:1551-1557`) lists the rows read per request:
`session`, `user`, `identity_connection`, `tenant`, `role_assignment` (+ `role`). §3.4 proposes
fetching four of them *"in the same round trip … One statement, four rows"* (`:1186-1187`). B1's fix
needs `membership`. Against the tree:

- `user` — no table in any migration. `ls db/migrations` → one file.
- `identity_connection` — no table.
- `membership`, `role_assignment`, `role` — no tables.
- `tenant` **exists** (`db/migrations/0001_tenancy_and_rls.sql:70-76`) with columns
  `id, name, account_id, status, created_at` — and `TenantContext` needs `residency`, `environment`,
  `deploymentMode` (`stateless-green-session.md:518-521`), which are on the model type
  (`model/domain.ts:882` for `residency`) and **in no migration**. 0002 adds none.
- `session` has a foreign key on `tenant_id` and **none** on `user_id` or `connection_id`
  (`stateless-green-session.md:944-948`) — necessarily, because the referents do not exist.

**So two problems, and the second is the security one.** The first is schedule: D1 is not buildable
from 0002; four tables and three columns are missing and unpriced.

The second: `user` and `identity_connection` are read on the pre-tenant path, in a transaction where
the **only** GUC set is `app.session_ref`. No tenant-keyed predicate can protect them (they are not
tenant-scoped — `User` (`model/domain.ts:1395`) and `IdentityConnection` (`:1355`) extend nothing),
and no digest-keyed predicate can either, because the join reaches them *through* the session. The
honest consequence is that they are **platform-global tables readable in full by `reconcile_app`
from the request plane** — every email, every display name, every verified domain, across every
customer and partner. That is a second cross-tenant read path, and invariant 2 says there is
**exactly one**: *"`partner_admin(P)` may read tenant `T` iff `T.partnerId = P`, and only within a
live `PartnerAccessGrant` beyond commercial metadata."*

The design cannot be faulted for `user` having no table. It can be faulted for writing an RLS
migration whose stated purpose is *"the piece that most needs the owner's eye"*
(`stateless-green-session.md:900-902`) while leaving the protection of the other two tables on the
same unscoped read path **unstated** — and for §3.1's polarity table listing two policies and
implying the surface is covered.

**The control that would close it.** 0002 must state the posture of every table the chain touches,
and each needs an argued answer rather than an omission:

- `identity_connection` — plausibly a genuinely global catalogue (a directory is not tenant
  property), which should be **said**, with `SELECT`-only for `reconcile_app` and the write path
  restricted to the migrator/administration plane.
- `user` — not global. A `SELECT`-only grant plus a policy keyed on
  `id = nullif(current_setting('app.session_subject', true), '')`, set from `session.user_id` inside
  the same transaction after step 3, gives the pre-tenant read exactly one row: its own subject.
  That is the same *"you already presented the handle"* argument one hop along, and it is the only
  form of it that does not open the whole directory.
- `tenant` — a 0002 or 0003 that adds `residency`, `environment`, `deployment_mode`, or a
  `TenantContext` that is honest about not having them yet.

---

## 2. SERIOUS

### S1 — Two caller-supplied booleans, and `false` fails OPEN on both

`docs/HANDOFF.md:1513` §5.2, *"A caller-supplied parameter that switches a check off"*, with the
tell stated at `:1531`: *"an argument that the callee could compute itself. If it could, it must."*

- `resolveSession(input: { …; secondFactorRequired: boolean; … })`
  (`stateless-green-session.md:594-595`), commented *"True when this connection's protocol requires a
  second factor."* The `connection` row is **already a parameter**. A caller that passes `false`
  disables `second_factor_required` (`:639-641`) for that request, and nothing anywhere notices.
- `mintSession(input, user, connection, isDirectoryGuest: boolean)`
  (`stateless-green-session.md:749-754`) — a **positional** boolean, fourth of four. `false`
  bypasses `directory_guest_refused` (`:773-775`), the arm the design argues is load-bearing at
  `:726-734` because a guest *"would otherwise resolve to `customer`"* with the partner mask never
  applying. `mintSession(req, user, connection, false)` reads as nothing at a call site.

The design opens §2 by declaring *"every gate returns a **reasoned union**, never a boolean (§5.2)"*
(`:161`). It applies that to its outputs and not to its inputs.

**Control.** Derive the factor requirement from the connection via a total
`Record<IdentityProtocol, boolean>` (compile error on a fourth protocol, the same discipline as
`ORG_CLASS_FOR_CONNECTION_OWNER`). Replace `isDirectoryGuest: boolean` with a
`DirectoryClaim = { kind: 'member' } | { kind: 'guest' } | { kind: 'unstated' }` whose `unstated` arm
**refuses** — because `userType` absent is not `userType: member`, and an IdP that omits the claim is
the realistic case.

### S2 — `timestamptz` in the column, lexical string compare in the model, and no codec between them

`Timestamp = string` (`model/kernel.ts:422`). `resolveSession()` decides expiry with
`session.expiresAt <= input.now` (`stateless-green-session.md:636`) — a **lexical** comparison. 0002
declares `expires_at timestamptz NOT NULL` (`:951`). The shim types a result row's values as
`unknown` (`db/pg.d.ts:24-25`, `rows: R[]` with `R = Record<string, unknown>`), so whatever the
driver returns for a `timestamptz` reaches `resolveSession()` through a cast that `tsc` accepts.

The guard is on the wrong operand: `Date.parse(input.now)` validates the **parameter**
(`:625-627`) and nothing validates the **column**. Postgres' default text rendering of `timestamptz`
is `2026-08-09 17:00:00+00` — space-separated, offset-suffixed. Compare it lexically against
`2026-08-09T09:00:00.000Z`: `' '` (0x20) sorts below `'T'` (0x54), so a session expiring at 17:00
reads as **already expired at 09:00**. Change the offset and the sort flips in the other direction.
Both directions are wrong and neither raises.

I have **not verified** what the `pg` driver returns for `timestamptz` in this repository — the shim
is hand-written (`db/pg.d.ts`) and no test reads a timestamp column
(`tests/db/tenant-isolation.test.ts` reads `tenant_id, id, address` only, at `:57`). That is itself
the finding: **the representation boundary is unspecified on the one comparison that decides whether
a credential is still live.**

`CLAUDE.md`'s G111 is the named shape for this: *"one money codec module, and nothing else may touch
the representation … correctness that lives at call sites is correctness that drifts."* D1 introduces
the first `timestamptz` column any model code compares. It needs the same ruling: one timestamp
codec, called at the boundary, and `session_clock_unparseable` extended to the **row's** timestamps,
not only the parameter's.

### S3 — The session row's write surface is table-wide; `WITH CHECK` pins the digest and nothing else

0002 issues `GRANT SELECT, INSERT, UPDATE, DELETE ON session TO reconcile_app`
(`stateless-green-session.md:1008`) and a `WITH CHECK` that constrains only `handle_digest` (`:997`).
So within any session-scoped transaction, on the row addressed by the presented credential:

- `user_id` is mutable → **impersonation in one `UPDATE`**, keeping the same handle.
- `expires_at` is mutable → a session extends itself past its bound; the design calls `Session` *"the
  longest-lived reference in the system"* (`:315-316`).
- `revoked_at` is mutable → un-revoke, which un-does the design's only self-service lever (`:326`).
- `second_factor_at` is mutable → the *"never re-opens a factor window"* claim (`:306-310`) is an
  application check over a writable column.
- `DELETE` is granted to `reconcile_app` while the design says sweeping runs as the migrator
  (`:1011-1014`) — the grant is wider than the design's own story.

The design's defence is *"written by EXACTLY ONE code path"* (`:249-251`) — which is a review
convention, in a document that elsewhere insists on the structural form and is right to: `TenantPool`
has no `query` method precisely so leak mode 2 is *"a COMPILE ERROR at every call site rather than a
code-review catch"* (`db/tenant-scope.ts:56-68`). The same standard applied here yields column-level
grants: `GRANT SELECT, INSERT ON session` plus
`GRANT UPDATE (tenant_id, revoked_at, second_factor_at) ON session`, no `DELETE`, and a
`BEFORE UPDATE` trigger for the write-once columns RLS cannot express (RLS sees no `OLD`).

### S4 — `lifetimeSeconds` is a caller-supplied bound with no ceiling, in a model that already has the shape for one

`mintSession()` validates only `Number.isFinite(input.lifetimeSeconds) && input.lifetimeSeconds > 0`
(`stateless-green-session.md:757-759`). `10 ** 9` passes. The design is scrupulous about not
inventing the lifetime — `session_lifetime_unconfigured` refuses rather than defaults, and Q4 puts
the number with the owner, which is correct and I do not attack it. But *"a bound with no number is
not a bound"* (`:322`) has a twin: **a bound with no ceiling is not a bound either.**

`MAX_AUTHORIZATION_SECONDS` (`model/access.ts:1517`) is the precedent, and its own header states the
distinction the design needs: *"A TOKEN IS NOT A SESSION … the exposure is not 'how long may someone
work' but 'how long does a mis-issued artefact stay live'."* A session is the mis-issued artefact
with the longest life in the system.

**Control.** `SessionMintRequest` takes `maxLifetimeSeconds` as required configuration on the same
refuse-on-absence terms, and `mintSession()` gains a `session_lifetime_exceeds_ceiling` arm. Both
numbers stay the owner's; neither is invented; the ceiling stops a mis-plumbed call site from minting
a decade.

### S5 — A keyed digest with no key identifier re-introduces the node dependence the ruling exists to remove

Step 1 of the chain: *"`digest = HMAC(handle)` under the platform session key"*
(`stateless-green-session.md:1081`). §6.6 then says the key is *"**not** irreversible: sessions are
short-lived, so rotating the key invalidates live sessions and nothing else"* (`:1631-1632`).

That is true of a completed rotation and false of every rotation in progress. There is no key
identifier on the row, no version prefix on the digest, and no provision for two live keys. During a
rolling deploy, nodes holding the new key compute a digest that matches no row, so **which node
serves a request decides whether the session exists** — precisely *"no node dependence"* failing, on
the ruling's own words. The same applies to a node whose key material failed to load: the design says
*"key unconfigured → REFUSE, never a fallback key"* (`:1081`), which is right, and makes that node a
black hole for every session rather than for its own.

Also unargued: **why a key at all.** The preimage is a value we minted from a CSPRNG (`:695`), so
there is no low-entropy dictionary to defend against and a plain SHA-256 is sufficient — which
removes the deploy coupling, the rotation story and the *"no field in this model may hold key
material"* problem (`model/governance.ts:1879-1880`) in one move. If the key is wanted anyway, the
digest needs a `key_id` and the row needs a column for it.

### S6 — `SignInAttempt`'s single-use property is asserted of "the row" and requires SQL the design does not write

*"`consumedAt` is set in the SAME transaction that mints the `Session`, under the row's own
uniqueness — so a replayed callback finds a consumed row and is refused. A process map could not make
that atomic across two nodes; a row can."* (`stateless-green-session.md:369-374`).

`handle_digest text NOT NULL UNIQUE` (`:957`) makes the *lookup* unique. It does not serialise two
updates of one row. The property the claim needs is a **conditional** write —
`UPDATE sign_in_attempt SET consumed_at = $1 WHERE handle_digest = $2 AND consumed_at IS NULL`, with
the mint abandoned unless `rowCount === 1`. Under PostgreSQL's default READ COMMITTED, that form is
correct (the blocked writer re-evaluates the predicate after the first commits). The shape the design
actually describes — read the row, check `consumedAt` in application code, then update — is **not**:
both callbacks read NULL from their own snapshots, both proceed, **two sessions are minted from one
IdP assertion.**

Its own test, M13 (`:1512`), is *"set `consumedAt` in a different transaction from the `Session`
insert → `test_a_replayed_callback_mints_one_session_not_two` fails under two concurrent callbacks"*
— which passes with the unsafe read-then-write as long as both statements share a transaction. **The
mutation does not catch the defect it is aimed at.** The isolation level is named nowhere in the
document.

**Control.** Write the conditional `UPDATE … WHERE consumed_at IS NULL` into §2.3's comment as the
required form, assert `rowCount`, and restate M13 as *delete the `AND consumed_at IS NULL` clause.*

### S7 — The unauthenticated surface is a status oracle, contradicting the design's own requirement

§9 mirrors `SESSION_MINT_REFUSALS` onto the wire *"by exact name"* (`:1785-1789`), which includes
`subject_not_active`, `connection_disabled` and `directory_guest_refused` — returned from
`/session/password` and `/session/federated`, on a file whose whole point is document-level
`security: []` (`:1763`). An unauthenticated caller submitting a wrong password to
`signInWithPassword` learns *this account exists and is disabled* as distinct from *these credentials
are wrong*; `directory_guest_refused` additionally discloses the directory's `userType`.

The design already holds itself to the opposite standard, twice: `/session/realm` *"returns **no
user-existence signal**"* (`:1769`, and green P1 at `docs/build/green-platform-slices.md:140`), and
`SignInAttempt` carries no `userId` because *"a `userId` written at redirect would be a
user-existence oracle on an UNAUTHENTICATED surface"* (`:401-406`). The refusal-mirroring rule and
the no-oracle rule collide, and the design applies the first without noticing the second.

**Control.** Distinguish **internal** refusals from **wire** codes on the pre-authentication surface:
every `mintSession` refusal collapses to `session_invalid` on the wire, with the specific
`SessionMintRefusal` written only to the audit row. §5.3 is satisfied because there is still one
vocabulary — the model's — and the wire is a documented narrowing, not a second spelling.

### S8 — Invariant 8: the design closes the wrong half, and reads none of the three constants

§3.7 is right that a staff session must carry no grant reference. But its wire rule is
`listSelectableTenants` *"built on `Membership`, **never** on `TenantAccessGrant` (invariant 8)"*
(`:1775`), and `selectTenant` is the only writer of `Session.tenantId`. A platform FDE has no
`Membership` (`DURABLE_ASSIGNMENT_PERMITTED.platform = false`, `model/access.ts:232-236`), so their
picker is empty, so **`Session.tenantId` can never be set for staff, so no staff principal can ever
reach a tenant at all.** G56/G60/G75 put source configuration — and, since G75, `secret` — with the
FDE; `CLAUDE.md` records that G60 as written *"would have been **inert**: recorded as applied, with
the FDE still unable to bind a credential."* This design reproduces that outcome one layer up: it
refuses *staff-is-access* correctly and removes the permitted path with it. §3.7 addresses *"a staff
session with no grant"* and is silent on a staff session **with** one. (Green P1 deferred the FDE's
door to P4 at `docs/build/green-platform-slices.md:299`, which is legitimate for P1 — but D1 claims
to settle where session establishment terminates, and it cannot while the staff arm of the only
writer is unspecified.)

And on the three constants: the design reads **none** of `PERMITTED_RESOURCES`
(`model/governance.ts:432`), `CONTRACT_ONLY_RESOURCES` (`:512`) or `NON_DELEGABLE_RESOURCES`
(`:544`). For a per-act resource-class check that is arguably correct — `authorisationPermits()`
owns it, and it tests `NON_DELEGABLE_RESOURCES` **first**, at `model/governance.ts:703`, before the
withdrawal check at `:716`, which is exactly the ordering `CLAUDE.md` says made G60 inert. But the
design should **say** that D1 reads none of them and that the staff path is therefore incomplete,
rather than citing invariant 8 in a heading and closing only the half that was already closed.

### S9 — `resolveTenantContext` is reused unchanged, and its stated semantics are the node affinity the ruling bans

§9 lists `POST /context/resolve` as **"REUSE"** (`:1777`). That operation's description says:
*"Sets the row-level-security session variable as a side effect. A caller that reaches PostgreSQL
without having called this sees nothing"* (`docs/contracts/foundation.openapi.yaml:60`). Under G101's
transaction-mode assumption and `set_config(…, true)` (`db/tenant-scope.ts:123`), the GUC **reverts
at COMMIT** — so a separate HTTP call to `/context/resolve` sets nothing for any later request, on
any node. The described behaviour is only achievable with a pinned connection, which is the state the
ruling exists to abolish. The design reuses the operation and does not flag that its own §6.2 makes
the description false. Green P1 propagated the same sentence
(`docs/build/green-platform-slices.md:295`).

Second, smaller, same operation: its credential arrives in a **request body**
(`sessionToken`, `docs/contracts/foundation.openapi.yaml:70-72`) while every other tier uses the
`X-Session` header (`:819`). That is two transports for one credential — §5.3 — and the body is the
one more likely to be logged. The design's own verification grep #3 is
`grep -rc 'sessionToken\|handle:' docs/contracts/session.openapi.yaml model/domain.ts`
(`:1526`) — **scoped to exclude the only file in the repository where `sessionToken` occurs.**
Reproduce: `grep -rn sessionToken docs/contracts/` → 2 hits, both `foundation.openapi.yaml`.

---

## 3. NOTED

- **N1 — a count the design invented, and got wrong.** §2.8 step 5 and §3.1 both say
  *"one of **15** named refusals"* / *"the function ends in the success branch only after all 15"*
  (`:1085`, `:1106`). `SESSION_REFUSALS` has **14** members (`:451-483`), and `resolveSession()`
  returns **12** distinct ones. The two with no producer in the function are `session_unknown` (the
  0-rows case, which belongs to the caller) and `second_factor_replayed` (which belongs to
  `presentSecondFactor`) — and §9 mirrors both onto the wire as codes. A refusal member with no
  producer is §5.6's shape in miniature. `CLAUDE.md`'s reproduce-every-count rule applies to a green
  document as much as to the record.
- **N2 — `SessionView = Omit<Session, 'handleDigest'>` publishes by default** (`:1773`). The house
  polarity is deny-by-default everywhere else (`DENY_ALL`, empty-scope-denies, G100). A derived
  `Omit` means the next field added to `Session` ships to the client unless someone remembers;
  `_SessionCarriesExactlyTheseKeys` is then the only thing between an internal field and a public
  response, which is more weight than one type-level assertion should carry. An explicit `Pick` — or
  a wire schema listing the fields — inverts it.
- **N3 — the FK makes tenant selection an existence oracle.**
  `tenant_id text NULL REFERENCES tenant (id)` (`:948`): `POST /session/tenant` with an unknown id
  fails on the constraint, with a known id succeeds (or is refused for a different reason). Any
  authenticated principal can enumerate valid tenant slugs. Under G97 the slugs are readable
  (`ten_acme`), which makes guessing cheap. Fixing B1 mostly closes this — a membership check runs
  before the FK — provided the two failures are indistinguishable on the wire.
- **N4 — the fixtures do not witness the success path.** §4.1 supplies four `IdentityConnection`s,
  one `User` and two `Session`s (`:1418-1479`) and **no `Tenant` and no `TenantContext`**. By the
  design's own §5.10 standard — *"a type nothing constructs is a type the compiler has not checked
  one field of"* (`:1411-1412`) — `TenantContext`'s ten fields and `orgFor()`'s partner arm are
  unwitnessed, and the `ok: true` branch of `resolveSession()` has no construction site. A `Tenant`
  fixture is not cheap (`model/domain.ts:848` onward has ~12 required fields including
  `evaluation: EvaluationTerms | null`), which is the cost worth stating rather than skipping.
- **N5 — no index for the sweep, and the sweeper is not the only deleter.** `session` has a primary
  key on `id` and a unique index on `handle_digest`; the expiry sweep filters `expires_at`
  (`:1011-1014`) with no index on it, on the table the design calls the hottest in the system. See
  also S3 on the `DELETE` grant.
- **N6 — `csrfToken` is declared derived and never specified.** *"No `csrfToken` — it is derived from
  `handleDigest`, not stored beside it"* (`:338`). If the derivation is unkeyed, anyone who learns a
  digest (a log, a dump, S5's absent key rotation) can compute the token; if it is keyed, the key is
  a second unmanaged secret. A header-borne session needs no CSRF token at all, which is the likelier
  correct answer. A control named without a threat model or a derivation is §5.6 waiting to happen.
- **N7 — the invariant-10 gap is circular, and the design does not say so.** §3.8 answers *"which
  sessions were live when the incident happened"* with *"answerable only from the audit stream"*
  (`:1339-1340`), and then records that the sign-in audit row **has nowhere to go** because
  `AuditEvent extends TenantScoped` (`:1372-1379`, Q6). Both halves are honest; together they mean
  the only durable record of a sign-in is a row the design cannot write, so today a session
  establishment is an act that is neither authorised nor recorded. Q6 is correctly the owner's; the
  **consequence** should be stated where the cost is claimed.

---

## 4. My own struck attacks — premises that did not survive the tree

Recorded by name, because a red report that hides its misses is not evidence of anything.

- **STRUCK: "the digest comparison is not constant-time."** It is a plain `text` `=` in a policy
  predicate. But the caller cannot choose the digest — it is `HMAC(handle)` over a value they supply,
  so they cannot walk it byte by byte, and a timing signal on the comparison yields nothing
  addressable. The green document does not claim constant-time and does not need to.
- **STRUCK: "`AssertSameType` is misused."** `AssertSameType<{ sessionKeySet: { viaKernel: keyof
  Session; viaOwner: SessionKeys } }>` (`:864-866`) matches `MutuallyAssignable`'s required shape
  exactly (`model/identity.ts:335-346`), and the tuple wrapping makes it a genuine union-to-union
  check in both directions. The assertion is well-formed and does what it says.
- **STRUCK: "`FORCE ROW LEVEL SECURITY` on `tenant` breaks the new foreign key."** PostgreSQL's
  referential-integrity checks bypass row security, so the FK on `session.tenant_id` functions. (It
  is still N3's oracle.)
- **STRUCK: "storing `connectionId` on the session is a stale-authority stamp of the same class as
  `orgClass`."** `IdentityConnection.owner` is *"Server-set and immutable after creation"*
  (`model/domain.ts:1360-1366`), and `resolveSession()` re-reads the connection row and refuses on
  `connection_owner_mismatch` (`:620-622`) and `connection_disabled` (`:642-644`). The stamp is a
  pointer to a fresh read, which is the right shape. **The remaining stamp I could not break is
  `secondFactorAt`** — a factor presented once and trusted for the session's whole absolute life —
  but with no idle expiry ruled (Q4) and no number to check it against, that is the owner's Q4 and
  not a design defect.

---

## 5. WHERE THE GREEN TEAM IS RIGHT AND I COULD NOT BREAK IT

A red report that attacks everything adjudicates nothing. These held.

1. **The `orgClass` argument is correct and it is the best thing in the document.** Verified:
   `redeemAuthorization()` denies on `grant.orgClass !== principal.orgClass`
   (`model/access.ts:1771`), and `AuthorizationGrant.orgClass` is *"Derived at session establishment
   (§9.2). Stamped, never re-derived."* (`model/access.ts:1567`). A stored session `orgClass` would
   make both sides of that comparison stamps from one source, and the check would pass forever —
   §5.6 produced without deleting a line. The record had decided *not to store org* twice
   (`model/domain.ts:1413-1417`, `model/access.ts:177-186`) on self-maintenance grounds; this is the
   first mechanical argument for it, and it is sound.
2. **The bearer-token inheritance is real, not rhetorical.** `AuthorizationGrant`'s header
   (`model/access.ts:1536-1548`) refuses the JWT shape for the ruling's own reason, and a session
   that addresses a row is the same refusal one layer out. The design gets the revocation model for
   free and says so honestly, including the limit — `SupportAuthorisation.withdrawnAt` *"Stops future
   draws. Says nothing about sessions already open."* (`model/governance.ts:646`) — and it names the
   real bound as `MAX_AUTHORIZATION_SECONDS` (`model/access.ts:1517`) rather than overclaiming
   instant revocation.
3. **The fired-employee answer is the right one for a stateless fleet.** `User.status` is already
   load-bearing (`model/domain.ts:1400-1408`), `decide()` already refuses on it, and one directory
   write is read by every node on every request. No session hunt, no fan-out, no second lever.
   Verified end to end.
4. **Refusing `lastUsedAt` is correct and correctly argued.** `TenantAccessGrant.lastUsedAt` /
   `idleRevokeDays` exist (`model/governance.ts:884-885`), and copying them would turn every read
   into a write holding a row lock for the request. Recognising that as §5.1 — a shape borrowed from
   a grant drawn a handful of times per engagement onto a row drawn once per HTTP request — is
   exactly the discipline this record asks for.
5. **Refusing to mint a fourteenth `RetentionClass` is right, and the cost accounting is real.**
   `RETENTION_CLASSES` is thirteen; a fourteenth propagates into two total `Record`s, an assertion,
   a fixture, and every document stating the governed count. Reproduce:
   `node tools/check-doc-counts.mjs --derive`. Self-describing expiry on the row plus the existing
   `audit_event` class is the cheaper and more honest answer.
6. **The `AssertNoPlainText` / `AssertNoTextDeep` finding is a genuine discovery, not an excuse.**
   `Timestamp = string` (`model/kernel.ts:422`), so `string extends Timestamp` is true and every
   contentless assertion in the repository maps a timestamped field to `never`. `Session` really is
   the first type the discipline cannot be pointed at, and refusing to pretend otherwise — then
   substituting an exact-key-set assertion that refuses a tenth field **of any type** — is stronger
   than what was replaced.
7. **The honesty about what the compiler does not check.** M10 (a seam, not a wall), M11 (*"`tsc`
   says nothing … **This is the weakest point in the design**"*), M12 (*"Nothing in the repository
   catches this today"*), and §4's flat statement that not one refusal arm is reachable under `tsc`.
   That is the standard `docs/HANDOFF.md` §5.10 asks for and it is rare to see applied to one's own
   proposal.
8. **The G99 collision was raised rather than silently amended.** *"the rule as written is about to
   become false"* (`:1645`), two options costed, the third — adding `query` to `TenantPool` — named
   and forbidden, and the choice handed to the owner as Q1 instead of taken. That is the working
   practice `CLAUDE.md` asks for, executed.
9. **`SignInAttempt` is genuinely new and the argument for it is airtight.** `AccessSession`
   (`model/governance.ts:915`) presupposes a grant, a tenant and a staff principal; `AskSession` is a
   document a human reads. Without a durable row an OIDC callback landing on a different node than
   the redirect cannot be validated — which **is** the node dependence the ruling exists to remove.
   This is the one place the ruling forces a table nobody had thought of, and the design found it.
10. **Two premises in its own brief were checked and one was corrected.** §7 item 9 records that the
    brief's claim about `docs/tenancy-topology.md` §4 was wrong. And §9 verified that
    `control-plane.openapi.yaml` uses SigV4 rather than repeating `docs/HANDOFF.md:146`'s *"All three
    contract tiers require `X-Session`"* — which `grep -rn 'X-Session' docs/contracts/` shows in
    **two** files, not three. Green corrected the record while working from it.

---

## 6. The ONE thing that must be true before D1 is built

**Tenant selection must be a gate — in `model/`, returning a reasoned union over the principal's
`Membership` rows (or, for staff, a `TenantAccessGrant`), with `membership_absent` as a named refusal
— and the database must independently refuse a `session.tenant_id` the subject holds no membership or
grant for.**

Everything else here is fixable after the fact: a codec can be added, a grant narrowed to columns, a
boolean replaced by a union, a ceiling introduced, a key given an id. This one cannot, because until
it is true the design does not carry invariant 1 — it **relocates** the request-supplied tenant from
every request body into one, and then reads it back out of a column and calls it derived. *"Tenant
scope is derived from the session, never read from a request"* is satisfied only if the session's
tenant was itself authorised when it was written. Today, in this design, nothing authorises it, and
the one layer the design nominates as the enforcement — RLS — cannot, because it is keyed on the
value the caller chose.

B2 is a close second and is not optional either: as ordered, the chain returns
`tenant_not_selected` for every correctly-selected session, and the repair moves the producer of
`app.tenant_id` from `resolveSession()` to the raw column. Both are cheap to fix **now** and neither
is fixable cheaply after the first migration is applied under G88's forward-only rule.
