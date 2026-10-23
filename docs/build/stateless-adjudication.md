# ADJUDICATION — the statelessness pass

> **STATUS: WORKING MATERIAL · V1 AUTHORITY: NO · NOTHING HERE IS APPLIED.**
> No declaration in this document exists in `model/`. No migration in it exists in `db/migrations/`.
> No checker in it exists in `tools/`. No G number has been taken on any of it, and **§9's G rows are
> DRAFTS that nobody may copy into `docs/HANDOFF.md` without the owner placing them.**
> `docs/HANDOFF.md` §3 outranks every line below; where this document and a G row disagree, the G row
> wins.
> *Written 10 Aug 2026 against `HEAD` (`ece079d2`). No file in the repository was changed by it.*
>
> **INPUTS this document adjudicates, and does not question.** The owner's ruling of 9 Aug 2026:
>
> > *"I want the application stateless so it can scale without a node dependence and for ease of retry
> > in case a node fails. That means everything that carries state, including session data or other
> > user artifacts, must be committed to the database."*
>
> Plus four owner rulings taken **after** the eight reports were written — **S-8 operational**,
> **S-6 partition now**, **the containment proof inverts to an allow-list**, and **G120's replay key
> becomes content-addressed**. §3 carries each through all eight reports.
>
> **What it adjudicates.** Four green designs and four red passes:
> `stateless-green-session.md` · `stateless-red-session.md` · `stateless-green-resumable-work.md` ·
> `stateless-red-resumable-work.md` · `stateless-green-state-audit.md` · `stateless-red-state-audit.md`
> · `stateless-green-user-artifacts.md` · `stateless-red-user-artifacts.md` — and
> `docs/build/stateless-application.md`, the **green-only** synthesis written before any red pass. That
> synthesis is an INPUT here, not authority; **§2 and §10 correct it in seven places.**
>
> **Every `file:line` below was opened by me at `ece079d2`.** Every count carries the command that
> derives it. Where I could not verify something it says **not verified**.

---

## 🛑 ONE CONVENTION, STATED FIRST, BECAUSE SIX DOCUMENTS COLLIDED ON IT

**No design document may claim a migration NUMBER.** A migration is named by its **SUBJECT** —
`session`, `run_execution_and_reader_work`, `held_work` — and the number is allocated **only when the
file is written**, by whoever writes it, as the next free integer in `db/migrations/`.

Reproduce the collision: `ls db/migrations/` → one file, `0001_tenancy_and_rls.sql`. Against that,
four documents each claim `0002`:

| Document | Claims |
|---|---|
| `stateless-green-session.md` | `db/migrations/0002_session.sql` |
| `stateless-green-state-audit.md` | `db/migrations/0002_session.sql` — **a different table shape under the same number** |
| `stateless-green-resumable-work.md` | `db/migrations/0002_run_execution_and_reader_work.sql` |
| `stateless-green-user-artifacts.md` | `db/migrations/0002_held_work.sql` |

`stateless-application.md` reproduces three of the four, and `stateless-red-session.md` attacks
"migration 0002" as if there were one. Under **G88** — *"forward-only. This file is never edited once
applied"* (`docs/HANDOFF.md:814`) — a number is an identity, and two migrations minting the same one
is not a merge conflict, it is an unapplied migration nobody notices. **From here on: the session
migration, the work-queue migration, the held-work migration.** This document uses no migration
numbers and neither may the next one.

**Also, and it is a boundary not a courtesy:** the **ingestion adjudicator owns the
`model/ingestion.ts` module decision** (`docs/build/ingestion-p2-adjudication.md`). Where a stateless
design touches a mapper seam, a parser, a landing-bucket buffer or the shred path, this document
**defers to that document by name** and takes nothing.

---

## 0. The verdict, in one paragraph

**The rule is right, it is adoptable now at almost no cost, and three of the four surfaces are
buildable after named corrections — but D1 as designed does not carry invariant 1 and must not be
built.** The state audit's headline is true and I re-derived it: `model/` and `db/` hold exactly one
module-scope mutable binding and it is a memoised dynamic-import handle
(`grep -rnE '^(export )?(let|var) ' --include='*.ts' model db` → `db/pg.ts:25`), so the ruling costs
the audit surface a checker and a discipline and nothing else — **and that is only true while there is
no request path.** Against that, the four red passes land: **tenant selection has no gate anywhere**,
so the request-supplied tenant did not disappear, it relocated into one request body and is then read
back out of a column and called derived (red-session B1 — adopted, and it is the single thing that
must be true before D1 is built); **the session chain as ordered cannot execute**, because it reads
`tenant` where 0001's policy denies it (red-session B2 — adopted); **nothing writes the erasure
index**, so held human work would be permanently unreachable by an erasure plan (red-user-artifacts
B1 — adopted, and the correct number of persisted drafts until it is fixed is zero); **no idempotency
key exists anywhere in the four designs** while the house already has `MeterFact.idempotencyKey`
(`model/reconciliation.ts:2553`) and the wire already has `idempotency_conflict`
(`docs/contracts/errors.yaml:98`), so a retry after a node death writes a second `ApprovalDecision` —
**the owner's own "ease of retry" requirement failing on its own terms** (red-user-artifacts B3 —
adopted, and it is the sharpest finding in the pass); and **the checker's two loudest claims are its
two false ones**, so it must be built but not as proposed (red-state-audit — adopted). I adopt the
resumable-work red's property as **the pass's central rule** and it is now doubly authorised, because
the owner's content-addressed-key ruling is that property applied to G120. The four owner rulings
change the answer in four specific places named in §3, and they close the two irreversible decisions
that were open — the chain partition and the replay key. **Nine owner questions remain, six of them
carried forward from the synthesis and three of them dropped by it and restored here.**

---

## 1. The rule, RULED OPERATIONAL — stated precisely enough to be checkable

**The owner has ruled S-8 operational.** The rule is therefore **not** *"every byte physically in
PostgreSQL"*. It is:

> **No node-local state that another node or a retry cannot reconstruct from durable storage.**

A value derived inside one request from durable rows may be computed, passed down the call stack and
discarded. A value that **survives the request in process memory** — a session map, a challenge
dictionary, a chain head, a schema cache, a sticky-node assumption — is forbidden, whatever its
performance argument. All four green reports converged on this reading and none argued another; the
ruling ratifies the convergence.

### 1.1 What "reconstructible" means, in three parts, all three required

⚠️ **This is the definition the operational reading makes necessary, and no report supplied one.** A
rule that depends on a per-case human judgement is a rule that erodes. A piece of node-local state is
**RECONSTRUCTIBLE** if and only if all three hold:

**(a) DURABLE ANCHOR.** Every value the state depends on is readable, by any node, from either
(i) a committed row in the tenant's database, or (ii) a **version-addressed** artefact published
downward by the control plane — the model catalogue, a pack, a policy bundle, the tenant-prefix
registry. (ii) is permitted because invariant 3's direction of travel makes it so, and because G89's
artefact versioning makes the anchor addressable. **A value anchored on neither is not
reconstructible, whatever its performance argument.**

**(b) TOTAL REBUILD.** Rebuilding is a **pure, total function** of the (a)-anchored values plus a
**named, enumerated** set of boundary inputs — a clock read, an entropy draw, an environment
variable. The set must be *written down at the rebuild site*, not discovered. A rebuild that can
throw, that can return a different answer on a cold node for a reason nobody enumerated, or that
reads an input the site does not name, fails (b). **This is where the reader queue's lease sits, and
it is why §4.2 rules a lease column is mandatory on that surface and forbidden on the shred path.**

**(c) COUNTABLE REPEAT.** If the rebuild can re-perform an **effect** — a paid call, a money-moving
row, a human act, an egress — then the effect carries a durable key **over the CONTENT of the act,
never a position in a derived array**, and the suppressed second attempt **increments something a
person can query**. A no-op that leaves no trace is indistinguishable from work that never happened.

**(c) is the resumable-work red's property, adopted verbatim as the pass's central rule:**

> *"An effectful act may be made retryable only when its durable key is over the CONTENT of the act —
> never over a position in a derived array — and only when that same key makes the second attempt a
> no-op that is COUNTABLE."*

**RULED: that sentence governs every durable key in phase one.** It is what the owner's
content-addressed-key ruling is an instance of, and it is what red-user-artifacts B3 found missing on
the held-work surface. Its second half is the half everyone drops: green-resumable earned it in
exactly one place — `attempts` minus settled outcomes — and that instinct belongs on **every** durable
key, not one.

### 1.2 The worked test, so the definition is usable rather than admired

| State | (a) anchor | (b) total rebuild | (c) countable repeat | Verdict |
|---|---|---|---|---|
| `db/pg.ts:25`'s memoised `import('pg')` handle | ✅ the package on disk | ✅ import again | n/a — no effect | **RECONSTRUCTIBLE.** Permitted, and it is the one waiver in the tree today |
| A `Map<string, PrincipalContext>` in a request handler | 🛑 the map is the anchor | — | — | **FORBIDDEN.** The ruling's central case |
| A model-catalogue cache keyed on artefact version | ✅ published downward, version-addressed | ✅ re-fetch | n/a | **RECONSTRUCTIBLE — and still an owner call**, because the key is one careless edit from being tenant-keyed. **S-16** |
| G120's distributed-map execution state | ✅ the persisted `ReaderOutcome` rows are the durable record | ✅ the fold is pure and total (`model/reconciliation.ts:2681`'s postcondition check is its witness) | ✅ once the key is content-addressed | **RECONSTRUCTIBLE. G120 SURVIVES** — this is what S-8 ruled |
| A chain head held in memory | 🛑 | — | — | **FORBIDDEN**, and §4 prices the consequence |
| A worker holding a claim past its lease with no fence | ✅ | 🛑 fails (b): two live workers, two answers | 🛑 fails (c): the duplicate call is silent | **FORBIDDEN as designed.** Red-resumable BLOCKER 4 |
| An `ApprovalDecision` written twice by a retry | ✅ | ✅ | 🛑 no key over the act's content | **FORBIDDEN as designed.** Red-user-artifacts B3 |

### 1.3 What NO tool in this repository can verify about it, stated so a clean run is not misread

- **Whether a claimed rebuild is actually total.** (b) is a claim about a function nobody has written.
  A checker sees a marker; only a person sees whether the enumeration of boundary inputs is complete.
  This is the limit `docs/HANDOFF.md:104` already records for `@dropped-for-v1`, inherited
  deliberately.
- **Whether a durable write committed before the response was sent.** A write-behind passes every
  rule in §5.
- **Sticky routing.** ALB stickiness, a WebSocket, an SSE connection pinned to a node. None is in
  source and **there is no IaC in this repository** to read. Verified absent from the wire:
  `grep -rn 'websocket\|WebSocket\|event-stream\|EventSource' docs/contracts/*.yaml` → 0.
- **An SQL predicate.** The migrations are SQL. A `USING (true)` is invisible to any source checker;
  the only defence is a two-row negative test, which is why every migration step in §6 lands with one.
- **Node identity written INTO durable state.** `os.hostname()` or `process.pid` stamped on a claim
  row is node dependence achieved *through* the database — the ruling's own failure mode arriving by
  the route a checker declares clean. **No rule in any proposal addresses it** (red-state-audit S5
  item 6, adopted).
- **Browser state.** There is no frontend root. `Mockups/rec/` is drawn screens and no code.
- **Whether a `@node-local` reason is TRUE.** §5 rules the waiver into a counted allow-list precisely
  because shape is all a checker can read.

---

## 2. Where I rule against a team — the losing reasoning preserved VERBATIM

**Discipline.** Every ruling names the team it goes against and quotes what it displaces, because a
displaced argument that is deleted gets made again. I also **STRIKE** four attacks that rested on
false premises, three of them reds and one of them mine.

### 2.1 Against **green-session** (Report A) — six rulings

**RULED 1 — AGAINST green-session on tenant selection. Red-session B1 is adopted whole, and it is
the pass's one blocker that cannot be fixed after the fact.**

Green-session's losing sentences, preserved:

> *"`POST /session/tenant` · `selectTenant` · **the only writer of `Session.tenantId`**"*
> and *"The database is the enforcement, not the handler"*
> and, on the row itself: *"`tenantId` is written by EXACTLY ONE code path — tenant selection — and
> read by every other."*

**Why it loses.** Nothing in green-session constrains **what that writer may write**. There is no
`selectTenant` function among its declarations, no arm for it in `SESSION_REFUSALS` (fourteen members,
none of them about selection), no mutation for it in M1–M14, and its policy is
`handle_digest = nullif(current_setting('app.session_ref', true), '')` for **both** `USING` and
`WITH CHECK` — so `WITH CHECK` constrains the digest column and nothing else, and an
`UPDATE session SET tenant_id = 'ten_acme'` on your own row satisfies it for any value the foreign key
accepts. **Invariant 1's sentence survives while being defeated by RELOCATION:** the request-supplied
tenant moved out of every request body and into the one body that establishes the session.

**Verified at the tree, and this is why it is cheap to fix now:** `Membership` exists
(`model/domain.ts:1440`) with `userId`, `tenantId`, `roleId`; `membership_absent` already exists as a
wire code (`docs/contracts/errors.yaml:100`). This is not a missing-primitive problem.

**The control, RULED:** a pure total `selectTenantForSession()` in `model/access.ts` in
`resolveSession()`'s shape — `Session`, `User`, candidate `Tenant`, the principal's
`readonly Membership[]`, and (for a staff principal) the `TenantAccessGrant` — returning
`{ ok: true; tenantId } | { ok: false; refusal }` with `membership_absent` a named arm; **plus** a
database half, because green's own argument for RLS is that a handler mistake must not be sufficient:
the session migration's `WITH CHECK` additionally requires `tenant_id IS NULL OR EXISTS (…membership…)`.
**Both halves, or neither.** `docs/HANDOFF.md:1494` §5.1 is the shape being avoided: the rule was
keyed on the landmark *"no `tenantId` in a request body"* instead of on the property it protects.

**RULED 2 — AGAINST green-session on the chain's order. Red-session B2 adopted.**

Green-session's losing sentence, preserved:

> *"One reader. `resolveSession()` is the only producer of a `tenantId` for `withTenantScope()`"*

with its step table reading, at step 4, *"read `user`, `identity_connection`, and `tenant` if selected
| same transaction"* — the transaction opened by `withSessionScope()`, which sets **only**
`app.session_ref`.

**Verified premise.** `tenant`'s policy is `USING (id = nullif(current_setting('app.tenant_id', true),
''))` (`db/migrations/0001_tenancy_and_rls.sql:174-176`) with `ENABLE` **and** `FORCE ROW LEVEL
SECURITY` (`:131-132`), and `reconcile_app` holds neither `BYPASSRLS` nor ownership (`:41`). Inside
the session scope `app.tenant_id` is unset, `nullif` yields NULL, `id = NULL` is NULL, **the row is
filtered.** Every correctly-selected session therefore refuses with `tenant_not_selected` — the refusal
that means the opposite of what happened.

**And the repair is the more important half:** reading `tenant` first requires feeding `app.tenant_id`
from the raw column **before** `revokedAt`, `expiresAt`, `connection.status` and `User.status` have
been checked. **RULED: split the resolver at the seam the database actually has** —
`resolveSubject(...)` (all row-agreement and liveness refusals, no `tenant` row, runs inside the
session scope) → `withTenantScope(pool, tenantId, …)` opened **only** on `ok: true` →
`projectTenantContext(subjectResolution, tenant)` producing `TenantContext`, with
`tenant_row_mismatch` and `tenant_suspended`, called **inside** the tenant scope where the `tenant`
row is legitimately readable under 0001's own predicate. That ordering is also the one that satisfies
green's own liveness-before-derivation rule, which the single-function shape cannot.

**RULED 3 — AGAINST green-session on both caller-supplied booleans. Red-session S1 adopted.**

Green's losing sentences: `secondFactorRequired: boolean` on `resolveSession()`'s input, commented
*"True when this connection's protocol requires a second factor"*, and
`mintSession(input, user, connection, isDirectoryGuest: boolean)` — a **positional** boolean, fourth
of four. The `connection` row is already a parameter in both. `docs/HANDOFF.md:1513` §5.2 states the
tell: *"an argument that the callee could compute itself. If it could, it must."* Green opens its own
§2 with *"every gate returns a reasoned union, never a boolean"* and applies it to outputs only.
**RULED:** derive the factor requirement from the connection via a total
`Record<IdentityProtocol, boolean>`; replace `isDirectoryGuest: boolean` with a three-arm
`DirectoryClaim` whose `unstated` arm **refuses**, because an IdP that omits the claim is the realistic
case and `userType` absent is not `userType: member`.

**RULED 4 — AGAINST green-session on the session row's write surface. Red-session S3 adopted, and
the synthesis already half-conceded it without saying so.**

Green-session issues `GRANT SELECT, INSERT, UPDATE, DELETE ON session TO reconcile_app` with a
`WITH CHECK` pinning only the digest — so on the row addressed by the presented credential, `user_id`
is mutable (**impersonation in one `UPDATE`**), `expires_at` is mutable, `revoked_at` is mutable, and
`second_factor_at` is mutable. Green's defence is *"written by EXACTLY ONE code path"*, which is a
review convention in a document that is elsewhere right to insist on the structural form —
`TenantPool` has no `query` method precisely so leak mode 2 is a compile error rather than a
code-review catch (`db/tenant-scope.ts:56`, interface at `:69`). ⚠️ **And `stateless-application.md`
silently prints `GRANT SELECT, INSERT, UPDATE` with the comment *"No DELETE: a session ends by
`revoked_at`, not by vanishing"* — a correction to its own source, made without attribution.**
**RULED:** column-level grants — `GRANT SELECT, INSERT ON session` plus
`GRANT UPDATE (tenant_id, revoked_at, second_factor_at) ON session`, no `DELETE`, and a `BEFORE UPDATE`
trigger for the write-once columns RLS cannot express, because RLS sees no `OLD`.

**RULED 5 — AGAINST green-session on mirroring mint refusals onto an unauthenticated wire.
Red-session S7 adopted, and it is FREE, which nobody noticed.**

Green mirrors `SESSION_MINT_REFUSALS` onto the wire *"by exact name"*, which puts
`subject_not_active`, `connection_disabled` and `directory_guest_refused` on
`/session/password` — a document-level `security: []` surface. That is a status oracle, and green holds
itself to the opposite standard twice in the same file (`/session/realm` *"returns no user-existence
signal"*; `SignInAttempt` carries no `userId` because *"a `userId` written at redirect would be a
user-existence oracle on an UNAUTHENTICATED surface"*).

✅ **Verified, and it is the cheapest ruling in this document:** `session_invalid` is the **only**
session code on the wire today (`docs/contracts/errors.yaml:126`); `session_revoked` and
`session_expired` do not exist there. So collapsing every `mintSession` refusal to `session_invalid`
on the wire, with the specific `SessionMintRefusal` written only to the audit row, **requires no new
error code and removes one**. §5.3 is satisfied because there is still one vocabulary — the model's —
and the wire is a documented narrowing rather than a second spelling.

**RULED 6 — AGAINST green-session on the keyed digest's rotation story. Red-session S5 adopted in
part.**

Green: *"the key is **not** irreversible: sessions are short-lived, so rotating the key invalidates
live sessions and nothing else."* True of a **completed** rotation, false of every rotation in
progress: with no key identifier on the row, during a rolling deploy **which node serves a request
decides whether the session exists** — the ruling's own "no node dependence" failing on the ruling's
own words. **RULED, and it is mechanical rather than a number:** if the digest is keyed, the row
carries a `key_id` and the design provides for two live keys; if it is not, say so. Red's further
argument — that the preimage is CSPRNG-minted so a plain SHA-256 suffices and removes the deploy
coupling entirely — is sound and I record it, but **which of the two is chosen is bound up with S-2
and stays the owner's.**

**RULED 7 — record correction against green-session's own count.** §2.8 and §3.1 say *"one of **15**
named refusals"*; `SESSION_REFUSALS` has **fourteen** members and `resolveSession()` returns twelve
distinct ones. The two with no producer in the function are `session_unknown` (the zero-rows case,
which belongs to the caller) and `second_factor_replayed` (which belongs to `presentSecondFactor`) —
and both are mirrored onto the wire as codes. A refusal member with no producer is §5.6 in miniature
(`docs/HANDOFF.md:1634`). Red-session N1 adopted.

### 2.2 Against **red-session** — one strike

🛑 **STRUCK: red-session B3's invariant-2 characterisation.** Its words:

> *"the honest consequence is that they are **platform-global tables readable in full by
> `reconcile_app` from the request plane** … That is a second cross-tenant read path, and invariant 2
> says there is **exactly one**."*

**The premise it rests on is red's own and it is correct** — `User` (`model/domain.ts:1395`) and
`IdentityConnection` (`model/domain.ts:1355`) extend nothing, so neither is `TenantScoped`. **That is
exactly why invariant 2 is not engaged.** Invariant 2 governs one principal reading *tenant `T`'s*
data; a platform-global directory is not tenant `T`'s data, and calling a broad read of it a second
*cross-tenant* path stretches a numbered invariant to cover a different defect. **The invariant's own
sentence is unchanged by this and must stay so.**

**What survives the strike, and it is most of the finding.** Red is right that green wrote an RLS
migration whose stated purpose is *"the piece that most needs the owner's eye"* while leaving the
protection of the other two tables on the same unscoped read path **unstated**, and right that the
pre-tenant read set is unprovisioned: `user`, `identity_connection`, `membership`, `role_assignment`
and `role` have no table in any migration (`ls db/migrations/` → one file), and `tenant` exists
(`db/migrations/0001_tenancy_and_rls.sql:70`) without the `residency`, `environment` or
`deployment_mode` columns `TenantContext` needs. **ADOPTED as written, minus the invariant-2 sentence:**
the session migration must state the posture of every table the chain touches, with `user` given a
`SELECT`-only grant and a policy keyed on the session's own subject so the pre-tenant read returns
exactly one row.

### 2.3 Against **green-resumable-work** — eight rulings

**RULED 8 — AGAINST green-resumable on `RunPlan`. Red BLOCKER 1 adopted.**

Green's losing header, preserved: *"EVERYTHING THE FOLD READS, PINNED AT RUN ADMISSION AND READ BACK
VERBATIM ON EVERY ATTEMPT."* It pins fourteen scalars and two collections and **none** of `pairing`,
`strategyBindings`, or either `PopulationBinding` — the four members that decide the strategies, the
tolerances, the identifier normalisation and the counterparty path. Green **knows** the tolerances
exist: its blocked-digest note says *"The per-strategy tolerances the fold reads carry `Money`"*, uses
that to explain why the plan cannot be hashed, and then does not put them in the plan. **The `Money`
obstacle is why they are missing; it is not a reason they may be missing.** §5.1 in its exact shape.
**RULED:** `RunPlan` carries `pairing`, `strategyBindings` and both `PopulationBinding`s **verbatim**,
or the design states in one sentence that the fold's strategies are unpinned and a resume may fold
differently from its first attempt. There is no third option.

**RULED 9 — AGAINST green-resumable on application order. Red BLOCKER 2 adopted, and it SURVIVES the
owner's content-addressed-key ruling.**

✅ **Verified at the tree:** `applyReaderVerdicts` (`model/reconciliation.ts:2451`) is a sequential
fold with a moving state — `let current = state` at `:2456`, residuals re-derived per iteration, and
`current` replaced on each successful application. Candidate selection is an **equality** test:
`compareMoney(residual.value, item.gross)` with `!== 0 continue` (`model/reconciliation.ts:2413`), so
nothing prevents one right item being an amount-identical candidate for two different left subjects.
**Whichever outcome is applied first consumes the residual. The order of the array changes the
ledger.** Green then builds `outcomes` by iterating **`stored`** — a caller-supplied
`readonly StoredReaderOutcome[]` with no stated ordering — and writes an `ORDER BY` into the CLAIM
statement while writing **no `SELECT` for the stored rows at all**. Its own headline fixture cannot
see this: it is specified with an empty array and then with *one* synthetic outcome, so **neither case
has two stored outcomes**. §5.6 inside the control written to close §5.6.
**RULED:** `bindStoredOutcomes` iterates `requests` and pulls from a `Map<number, StoredReaderOutcome>`
— never iterates `stored` — so the applied order is the request order by construction and the row
order cannot reach the ledger. Fixture: two stored outcomes contending for one candidate, shuffled,
deep-equal results.
⚠️ **Carry this forward past §3:** the content-addressed key dissolves the *renumbering* hazard. It
does **not** dissolve this one. Application order is load-bearing under any key.

**RULED 10 — AGAINST green-resumable on the sequence counter. Red BLOCKER 3 adopted.**

Green specifies both `UPDATE dp_usage_sequence … RETURNING next_sequence - $n` *"inside the same
transaction as the insert"* **and**, one row above, `UNIQUE (tenant_id, idempotency_key)` with
`ON CONFLICT DO NOTHING` — *"a repeat is a no-op, not a second charge."* **A conflict is not an
abort.** Zero rows insert, the transaction commits, and the allocated block of sequence numbers is
committed with no rows against it — **a permanent hole in a monotonic per-plane sequence,
indistinguishable from a lost record**, which is the only thing `model/billing.ts:158`'s
*"a gap in this sequence is detectable rather than merely absent"* exists for. Green's fixture asserts
*"an **aborted** insert leaves no gap"*, which passes under both the correct and the broken
implementation of the case that actually occurs. **RULED:** never allocate a sequence for a row that
may not insert — `INSERT … ON CONFLICT DO NOTHING RETURNING id` first, count what landed, allocate
exactly that many. The fixture must be **conflict**, not abort.

**RULED 11 — AGAINST green-resumable on the lease, AND AGAINST `stateless-application.md` and
green-state-audit on "the lease is the transaction". This is the pass's one three-way collision and I
resolve it by naming the surface each is right about.**

The two losing sentences, both preserved:

> `stateless-application.md`: *"The lease is the transaction, so no lease TYPE is needed and adding
> one is a defect… A `leased_until` column re-introduces a wall-clock read, a timer and a
> node-dependent sweeper — three things the ruling forbids — to solve a problem the transaction
> already solved."*

> green-resumable's own SQL, in the same synthesis, **has** `lease_expires_at timestamptz` on both
> `run_execution` and `reader_request_attempt`, a reaper keyed on `lease_expires_at < now()`, and a
> claim that sets `now() + make_interval(secs => $3)`.

**Both cannot be true and the synthesis prints both on adjacent pages.** The resolution:

- **Where the unit of work is a database statement** — the shred-and-insert, the fold, the terminal
  ledger write — **`FOR UPDATE SKIP LOCKED` inside the explicit transaction IS the lease**, and a
  lease column is a defect. A node that dies aborts and the row unlocks with no expiry, no sweeper and
  no clock. `red-state-audit` WR-5 is right that this survives attack; `EntitlementLease`
  (`model/billing.ts`) is not this and must not be reached for.
- **Where the unit of work LEAVES the database** — a paid model call, an egress — **a lease column is
  mandatory**, because the transaction cannot be held across the call. Holding a pooled connection for
  the duration of an LLM invocation is pool exhaustion under G101's transaction-mode posture, and the
  settle and the call cannot be one transaction because the call is not in the database.

**RULED: the lease is the transaction where the work is a statement; a lease column with a FENCE is
mandatory where the work leaves the database.** That sentence is checkable and it tells the next
reader which sentence applies to their surface.

**And then red-resumable BLOCKER 4 lands on the surface that has a lease column, in full.** Green has
no renewal, no fence and no liveness check: the settle is
`WHERE run_id = $1 AND request_ordinal = $2 AND outcome_kind IS NULL`, which tests whether *someone*
has settled, not whether *this worker* still holds the claim. **So a double-paid model call is not a
crash path; it is the normal path for any call slower than `leaseSeconds`**, and which of two verdicts
becomes durable is decided by arrival order rather than authority. **RULED:** a `claim_id` written at
claim and **required by the settle**; a renewal statement for a live holder; and a `WorkBoundDefect`
arm asserting `leaseSeconds > providerTimeoutSeconds × (1 + permittedTransportRetries)`. ⚠️ **The
lower bound cannot be derived from anything in `model/` and I do not invent it** — the ceiling is
derived (`MAX_AUTHORIZATION_SECONDS`, `model/access.ts:1517`, `tenant_data: 900` at `:1530`); the floor
is a number and therefore the owner's. **S-4 as written does not ask for it. It does now.**

**RULED 12 — AGAINST green-resumable on `attempts_exhausted`. Red BLOCKER 5 adopted.**

Green: *"It reaches the residue through the arm that already exists: `ResidueCause.reader_refused`.
**No new residue vocabulary.**"* ✅ **Verified false at the tree.** The residue is built from state
alone: the cause begins as `let cause: ResidueCause = { kind: 'no_strategy_paired' }`
(`model/reconciliation.ts:2928`) and is narrowed by state predicates only. The reader causes are
constructed exclusively inside `applyReaderVerdicts`, onto its third return member — `:2470`, `:2483`,
`:2498` — and **nothing in the tree reads that member**, consistent with G118's record that
`applyReaderVerdicts` has zero production callers (`docs/HANDOFF.md:844`). So the new arm is a
declaration no row will ever carry, and the truthful cause is computed and thrown away: a finance user
opens a residue row reading *"this obligation was not fully settled"* where the truth is *"we tried
four times and gave up."* **RULED:** `buildResidue` takes the reader dispositions as a parameter and
**owns the precedence**, so a residue entry has exactly one source and the reader cause wins where it
exists — otherwise merging produces `item_in_residue_twice` from `checkPostconditions`
(`model/reconciliation.ts:2681`), which green's own table makes run-failing. **Green states neither
option and must state one.**

**RULED 13 — AGAINST green-resumable on why the stronger witness was refused. Red SERIOUS 6 adopted.**

Green's rejected alternative, preserved: *"a witness over the prompt strings would also catch a changed
identifier under an unchanged ref. It was refused because it would put a customer identifier in a new
table to detect a case R5(ii)'s content-hash keying already prevents."* Content-hash keying makes
re-delivered **bytes** mint a new document id; `identifierForPrompt` is not bytes — it is taken from
the admitted item's normalised identifiers, and normalisation is caller-supplied configuration that
RULED 8 establishes `RunPlan` does not pin. **The alternative was refused on a premise about document
bytes, applied to a value produced by configuration.** **RULED:** pin `normalisation` in `RunPlan`
(RULED 8 requires it anyway) and **say** that the ref witness is then sufficient *because* the
identifier is a function of pinned inputs. Red's privacy instinct is upheld: no customer identifier
goes into the witness column.

**RULED 14 — AGAINST green-resumable on the grant. Red SERIOUS 7 adopted, and its mechanical half is
ruled here rather than deferred.**

`redeemAuthorization()` (`model/access.ts:1753`) exists and denies on expiry; green stamps
`authorization_id text NOT NULL` once at arming, returns it from the CLAIM, and **gives the function
zero call sites**. So a resume an hour later executes twenty-five paid calls on tenant data under an
authorisation that expired seventy-five minutes earlier, and the audit trail says they were
authorised. Green also inherits G121's stated limit to cover a case it does not cover: G121's cost is
*"withdrawal stops future draws, not live ones"* (`docs/HANDOFF.md:847`), which is about acts
**already dispatched**; a claim made an hour after arming is not already dispatched.
**RULED — and this is an omission, not a decision anyone took:** the executor calls
`redeemAuthorization()` before the model call and refuses **the item**, not the run, so the queue row
stays unsettled and claimable and re-arming a grant makes it drainable. **What stays the owner's is
the other half of S-7** — whether a resume may **mint** a new grant, which narrows G121 and is not
mine.

**RULED 15 — AGAINST green-resumable on the counter's pricing. Red SERIOUS 9 adopted, both halves.**

Green: *"`docs/build/event-architecture-recommendation.md:320` puts the volume at 'under 1 row/sec
average. Unremarkable' — quoted from that document, which sources `persistence-design.md:213-217`; I
did not measure it."* Red establishes that the inherited citation does not resolve to the table, and
that **the unit is wrong**: the figures are per **tenant**-month and the counter row is **plane**-scoped
— green says so itself — so in the hosted topology the contended rate is the sum over tenants on the
plane and a per-tenant rate cannot bound it. The figure also predates G120's per-row meter multiplier.
§5.7 (`docs/HANDOFF.md:1651`) is the shape. **RULED:** take the counter lock **last and alone**, and
re-derive the volume from the table it actually lives in, times the plane's tenant count, times the
per-row multiplier — **or state that it is unmeasured. No figure is invented here.**

**RULED 16 — AGAINST green-resumable on the reaper. Red SERIOUS 10 adopted.**

The reaper is the only mechanism that recovers a run whose node died mid-fold, and it carries no tenant
predicate. Outside `withTenantScope()` the policy denies on NULL and it updates **zero rows —
permanently, silently, while reporting success**; inside it, it inherits the O(tenants) sweep green
prices only for the worker. And `rowCount 0` means both *"nothing needed reaping"* and *"I am scoped
to nobody"*. **A control whose success and whose total failure emit the identical signal is not a
control.** **RULED:** the reaper is an enumerated sweep over the downward-published registry with a
per-tenant `withTenantScope()`, reporting **two** numbers — *swept N tenants, reaped M runs* — so
N = 0 is distinguishable from M = 0.

**RULED 17 — AGAINST green-resumable on "crash-resume and `rerun` are the same code path". Red
SERIOUS 11 adopted, and the owner's fourth ruling vindicates its remedy.**

Green claims the two are one code path. A `RunTrigger.rerun` carries `ofRunId` **because a rerun is a
different run with its own `RunId`**, so a rerun's `storedReaderOutcomes` is empty by construction and
every reader request is asked again and paid for again — including under `reason: 'rule_changed'`,
which is the one case where most verdicts are still perfectly valid for their pair. **RULED: delete the
claim.** Red's remedy — `(tenantId, subjectKey, candidateWitness)` identifies the **verdict** while
`requestOrdinal` labels the **act** — is the amendment red correctly declined to take and **the owner
has now taken it**. §3.4.

**RULED 18 — refinement, not a strike: red-resumable 13.1 is right to attack the line and wrong that
the assertion is unavailable.** Green ships `export type _WorkBoundDefectHoldsNoText = never /* see
note */`, whose own comment concedes it may not bite. ✅ **I verified the mechanism by compiling:**
`NoTextField<T>` is `string extends T ? never : …` (`model/reconciliation.ts:248-258`), so a literal
`kind` arm passes, `AccessResourceClass` passes, `number` passes, and a bare `string` field fails —
I compiled a five-case probe under the repository's own compiler options and the only case that errored
was the one with `plain: string` (`TS2344 … Type 'string' is not assignable to type 'never'`).
**So `AssertNoTextDeep<WorkBoundDefect>` HOLDS and BITES.** **RULED: write the real assertion, RED
first, and delete the `= never` line** — `model/identity.ts`'s own rule is that *"an assertion that has
never failed is a comment with extra steps."*

### 2.4 Against **green-state-audit** — the checker, six rulings; §5 carries them

Every one of red-state-audit's four blockers and its S1–S4 is **adopted**; §5 states the resulting
build. The two that need the losing reasoning preserved here:

**RULED 19 — AGAINST green-state-audit's rule 8 and its mutation M5.** Green's losing claim:

> rule 8 is *"the highest-value rule in the list and the cheapest"*, and M5: *"Add `query(...)` to
> `TenantPool` … **`tsc` stays green** — the field is additive and nothing calls it — so this mutation
> is invisible to every other control in the repository. It is the reason rule 8 exists."*

✅ **Refuted at the tree, and I verified the mechanism by reading the ambient declaration rather than
taking red's word.** `db/pg.d.ts` declares `export interface Pool` with **`connect` and `end` and
nothing else** (`db/pg.d.ts:52`), while `PoolClient` (`:47`) and `Client` (`:58`) both have `query`.
`createAppPool()` returns `new Pool({…})` as a `TenantPool` (`db/tenant-scope.ts:79`), so adding
`query` to `TenantPool` makes the return assignment fail. **The omission on `TenantPool` is defended by
a hand-written ambient declaration that also omits `query` — not by a comment.** Rule 8's stated reason
for existing does not exist. **And the property it names is not the property it checks:** `loadPg()` is
exported and `Client` has `query`, so a request module can open an unpooled connection and issue an
autocommitted statement, and rule 8 is silent. **RULED: M5's premise is struck from the record with the
declaration cited beside it, and rule 8 is re-aimed at the property** — no `.query(` in any scanned
root outside `db/`, and inside `db/` only within the scoped helpers and the migration/provision paths —
**or dropped in favour of a type-level negative control asserting `pool.query` does not typecheck,
which is what actually holds today.**

**RULED 20 — AGAINST green-state-audit's waiver. Red B3 adopted, on the record's own precedent.**

Green: the marker *"costs an argument to write, which is the only thing that keeps a waiver honest."*
Three clauses are satisfiable in forty characters by one author in the same commit that introduces the
defect, with no reviewer, no count, no expiry — the date is checked for **presence**, never recency.
`docs/HANDOFF.md:805` is the precedent one axis over: G79 created `managed_service_use` with
*"deliberately no `requireImprovementOptOut` — a caller-supplied off-switch on a residency check is
§5.2."* **A `@node-local` marker is a caller-supplied off-switch on a statelessness check.**
**RULED:** the waiver is a **counted allow-list in the checker's own source**, keyed
`{file, symbol, rule, reason, reconstructible}`, with a test asserting its exact length (today: one —
`db/pg.ts:25`). The in-code marker stays, because a note on the declaration travels with the code —
**but the marker documents the waiver and does not grant it.**

### 2.5 Against **red-state-audit** — one strike

🛑 **STRUCK: "neither document has claimed it."** Red-state-audit's closing words:

> *"S5 item 1 — the OIDC/SAML pre-session record — is a table that has to exist before `session` does,
> and neither document has claimed it."*

**False.** `stateless-green-session.md` claims it, designs it, and argues it better than anything else
in the pass: `SignInAttempt` — `{ id, handleDigest, connectionId, challengeDigest, startedAt,
expiresAt, consumedAt }`, with a deliberate absence of `userId` so the redirect is not a user-existence
oracle, and a stated reason why none of `Session`, `AccessSession` or `AskSession` expresses it. Red is
right that **green-state-audit's** §2.6 designs `session` without it; it is wrong that the pass as a
whole missed it. **The finding is red's own most important S5 item and its attribution is wrong.**

**What survives.** Red-state-audit S5 items 2, 3, 5 and 6 are genuinely unclaimed by anybody and are
adopted: the `Idempotency-Key` replay record (the header is at
`docs/contracts/capability.openapi.yaml:2231` with a 409 at `:2260`, and **the error code already
exists** — `idempotency_conflict`, `docs/contracts/errors.yaml:98` — while no document proposes a home
for the record); failed-attempt/lockout counters; the inbound multipart buffer; and node identity
written into durable state. **Item 4 partly survives:** `SignInAttempt.challengeDigest` with
`consumedAt` covers the *federated* challenge, but that row is destroyed at authentication success, so
a **post-authentication** second-factor challenge — a TOTP window nonce, a WebAuthn challenge — still
has no row and is still replayable. Red is right on the narrow case and overstated on the broad one.

Also **STRUCK, mine before red's:** red-session S6's isolation argument is right that green's
read-then-write shape admits two sessions from one IdP assertion, and I adopt the conditional
`UPDATE … WHERE consumed_at IS NULL` with `rowCount === 1` asserted — **but the isolation level is
named nowhere in green and red does not verify what this repository sets.** I could not verify it
either: no migration sets one and no test reads one. **Recorded as not verified**, and the conditional
`UPDATE` is correct under READ COMMITTED regardless, which is why the ruling stands on the statement
shape rather than on the level.

### 2.6 Against **green-user-artifacts** — nine rulings

**RULED 21 — AGAINST green-user-artifacts on the erasure index. Red B1 adopted, and it is the second
of the pass's two irreversibles.**

Green's losing sentence: the twelfth `SubjectLocation` variant refuses *"an erasure plan that cannot
reach held work"*, on the ground that *"the variant exists, so the plan can name it."* ✅ **Verified:**
`SubjectLocation` (`model/governance.ts:1772`) is an open union with no exhaustive switch anywhere, so
a twelfth variant is a compile error **nowhere**; and the union's own header states the rule the design
then does not follow — *"Written at CREATION time, not discovered by scanning … an erasure design that
depends on finding it later will quietly miss it"* (`model/governance.ts:1744`). Green's migration
inserts no `subject_index` row and neither gate returns a `SubjectIndexEntry`
(`model/governance.ts:1868`) for a caller to write. **This is the G75 shape: recorded as applied, wire
enum moved, `check:wire` green, and inert — because the list that decides whether erasure reaches a row
is the set of INSERT statements, and nobody named it.** **RULED:** a hold writes its `SubjectIndexEntry`
in the **same transaction** as its `held_edit` row, stated in the migration and in the function
signature rather than in prose. **Until then the correct number of persisted drafts is zero**, and I
adopt red's sentence as the gate on this surface.

**RULED 22 — AGAINST green-user-artifacts on `maxDataClass`. Red B2 adopted.**

Green makes `maxDataClass: DataClass` **required** and defers it to the single `DataClass` ladder.
**That prerequisite is the wrong one.** Invariant 4: *"Classification is declared once, on `FieldSpec`,
and everything derives from it."* A rejection reason is a sentence a person typed; it corresponds to no
payload key and therefore to no `FieldSpec`, so it has **no class**, and unifying four copies of an
*ordering* does not assign one. The design is caught either way: if prose is in scope of G106's gate
the flagship artifact — `Mockups/rec/Login.dc.html:173`'s *"Your rejection reason on C.4 is held,
unsubmitted"* — can never be held; if it is not, the row stores counterparty-adjacent text with no
class and `maxDataClass` is populated by a guess, which is fail-open on the one invariant
`CLAUDE.md` records this codebase already fixing once. **RULED: `maxDataClass` is absent rather than
guessed, until a class for author-typed prose is DECLARED on the arm at the point of use** — the way
the usage-event stream's `tenantRef` argues its exception to invariant 1 at the point of use.

**RULED 23 — AGAINST green-user-artifacts on idempotency. Red B3 adopted, and it is the sharpest
finding in the pass because it is the owner's own requirement failing.**

`grep -ci idempot docs/build/stateless-green-user-artifacts.md` → **0**. ✅ And the house already has
the pattern in three places I opened: `MeterFact.idempotencyKey` — *"`${providerRequestId}#${meter}` or
`${runId}#${meter}`. **Never bare**"* (`model/reconciliation.ts:2553`, keys constructed at `:2564`,
`:2570`, `:2580`); the header at `:2525` recording that `/metering/record` is idempotent and answers
`409 IdempotencyConflict`; the wire header at `docs/contracts/capability.openapi.yaml:2231`; and the
error code at `docs/contracts/errors.yaml:98`. **Green reuses none of it, and never states that the
effect write and the closure `UPDATE` are one transaction.** So: the node commits the
`ApprovalDecision`, `authorize()` has minted its grant, the node dies before
`closure_kind = 'submitted'`, the load balancer retries elsewhere, the draft still reads `open`,
`submitAdmissible()` returns `ok`, and **a second `ApprovalDecision` is written** — which the type
permits explicitly. On the disposition arm it is worse: a second `ResolutionProposal` with a second
`ProposalId`, and `Exception.resolution` is a single field, so the first becomes an orphan with a
`MeterFact` and an `AuditEvent` behind it. **RULED:** submission takes a durable idempotency key —
`(heldEditId, sequence)` is the natural one and needs no new field; the effect write, the grant and the
closure `UPDATE` are **one** transaction; and a retry that finds `closure_kind = 'submitted'` returns
the first effect's id rather than a refusal. **This is §1.1(c) applied, and it is the pass's proof that
(c) was needed.**

**RULED 24 — AGAINST green-user-artifacts on the partial unique index. Red B4 adopted.**

`held_edit_one_open` keys on `coalesce(anchor_id, '')`, and arm 4 (`operator_transaction`)
**deliberately has no anchor** — green says so. So every draft operator transaction by one author in
one tenant collapses to one key, and green's own comment tells the client what to do on collision:
*"TWO TABS, ONE ARTIFACT: the second tab does not create a second row. It finds the same row."*
Applied to arm 4 **that instruction is a data-loss instruction**: draft on `PO-4471`, open `PO-4482`,
the client finds the open row, the replace statement sets `subject = $3` and returns success, and the
first draft is gone with no refusal. **RULED:** one open draft per (author, anchor) is a sound rule
only where an anchor exists; arm 4 needs an anchor of its own identity, or the uniqueness for
anchorless arms keys on the `HeldEditId` the client already holds.

**RULED 25 — AGAINST green-user-artifacts on the cold-start race. Red B5 adopted.** Green gives the
`UPDATE` and never gives the `INSERT`; `HeldEditRefusal`'s nine arms contain none for *"an open draft
already exists"*, and `not_current` cannot serve because a first-write client has no sequence to be
stale against. So two tabs both `INSERT`, one raises `23505`, and the first thing a user experiences on
the surface built to reassure them nothing was lost is an unexplained 500 — in a design whose own header
says *"Failures are values."* **RULED:** `INSERT … ON CONFLICT DO NOTHING RETURNING sequence` plus an
`{ kind: 'open_draft_exists'; currentSequence: number }` arm. Zero extra round trips.

**RULED 26 — AGAINST green-user-artifacts on `purgeAfter`. Red B6 adopted.** Recomputing
`purgeAfter` from `lastHeldAt` makes the retention window unreachable for any client with a heartbeat
autosave, which reintroduces through the back door the unbounded window the fourteenth retention class
was minted to avoid — green's own PDPA Retention Limitation argument. Green then forecloses the fix by
calling a second bound *"two answers to one question — §5.3"*. **They are two different questions:
idle expiry and absolute lifetime.** **RULED:** `purge_after = least(held_at + maxOpenDraftAgeDays,
last_held_at + days.held_edit)` — two numbers, two questions, one column. **Both numbers are the
owner's or counsel's and neither is invented here.**

**RULED 27 — AGAINST green-user-artifacts on its headline. Red S1 adopted.** *"An unapproved draft is
not constructible as an effect"* is false; only the brand substitution is impossible.
`ExceptionResolution`'s `manual` arm (`model/domain.ts:2855`) requires no approver at all by design,
and the `approved` arm admits an empty `approvedBy`. **RULED:** state the property as *"a `HeldEditId`
is not a `ProposalId`"*, delete the stronger sentence, and say plainly that approved-versus-unapproved
is `ApprovalDecision`'s job and is not in this design. Red S2 is adopted with it: `ExceptionReversal`
(`model/domain.ts:2924`) carries no `proposalId`, so the headline is scoped to `ExceptionResolution`
and must say so; and the control that actually governs arm 4's effect path is
`OPERATOR_PROPOSAL_IS_AUTONOMOUSLY_EXECUTABLE = false` (`model/domain.ts:3864`), which the design never
cites for the arm it protects while citing `ExceptionResolution` for an arm it does not reach.

**RULED 28 — AGAINST green-user-artifacts on borrowing G127's argument without its mechanism. Red S3
adopted.** G127 is **applied** and its mechanism is a **narrowed union** — *"`LearnedDisposition` is
narrower than `SetDisposition`, so a learned write-off is not constructible on this path"*
(`docs/HANDOFF.md:853`). Green quotes G127's sentence and then derives `HeldDisposition` by
`Partial<Omit<…>>`, inheriting `dispositionKey` and `adjustment` unchanged — so a draft write-off is
fully constructible, inside a JSONB column with no generated column, and *"list every open draft
proposing a write-off above 50,000"* is not a query this schema can answer. **RULED:** promote
`disposition_key`, `adjustment_minor` and `adjustment_currency` to generated columns, and narrow the
draft's disposition the way G127 narrows the learned one.

**RULED 29 — AGAINST green-user-artifacts on name-keyed assertions. Red S5 adopted.**
`CarriesNoCommittedId` maps `K extends 'id' | 'proposalId' | 'exceptionId'`; a body that gains
`grantId`, `resolutionId` or `decisionId` passes in silence. The house already has the type-keyed form
and `AssertNoTextDeep` (`model/reconciliation.ts:248-258`) is the same discipline. §5.1 again.
**RULED:** key the assertion on the TYPE — `M[K] extends AuthorizationGrantId ? never : M[K]`, and the
same over the id brands. The name-keyed forms may stay beside it; they are cheap.

**RULED 30 — AGAINST green-user-artifacts on leaving `model/identity.ts` untouched. Red S6 adopted.**
A new brand and a new entity with no rows in that module's three hand-maintained proofs is the G75
shape a second time: recorded as applied, central mechanism unproven. **RULED:** the three rows land in
the same commit as the brand, each written red first.

**RULED 31 — AGAINST green-user-artifacts on its governed-count accounting. Red S7 adopted, verified
by me.** ✅ `docs/HANDOFF.md:225` is the **retention-classes** row (*"retention classes | **13**"*),
not the modules line, and green's mutation row 10 names it as *"the modules line"*. So the design
accounts for 18 → 19 modules and **not** for 13 → 14 retention classes, which is the change it actually
makes to a governed count. Red is also right about the class `nothing can catch`:
`docs/contracts/foundation.openapi.yaml` carries the prose *"ELEVEN variants"*, `check:wire` compares
the enum and not the description, and `check-doc-counts.mjs` reads Markdown and not YAML.

**RULED 32 — AGAINST green-user-artifacts on why a hold mints no grant. Red S8 adopted.** Green's
reason — `MAX_AUTHORIZATION_SECONDS.tenant_data = 900` *"and a draft lives for days"* — misreads the
constant it cites: `authorize()` (`model/access.ts:1659`) mints a grant **per act**, and 900 seconds
bounds one authorisation's validity, not the life of the thing it touched. **RULED:** the honest reason
is **volume**, given once for both the grant and the audit row, and the coarser record green's own Q6
proposes — one row per draft lifetime — is the answer if the absence is unacceptable. **Whether it is
unacceptable is the owner's: S-13.**

### 2.7 Against **red-user-artifacts** — one strike, one narrowing

🛑 **STRUCK, in part: red-user-artifacts S4's present tense.** Its words: *"`JSON.stringify({
amountMinor: 1n })` throws `TypeError: Do not know how to serialize a BigInt` — at **runtime**, inside
an interactive request, on the money-bearing arm."* ✅ **Verified: `Money.amountMinor` is `number` at
the tree** (`model/domain.ts:535`), so G65's `bigint` retype is **not applied** and nothing throws
today. The finding is a correct *conditional* about a future commit, and red states the condition
elsewhere; the sentence as written asserts a present defect that does not exist.
**What survives, and it is the more useful half:** G111 is not applied, the row **stores** money, and a
JSONB column is a serialisation boundary — so **the money codec is a prerequisite of this table, not a
wire concern.** Adopted. And red's second point stands unqualified: there is no integrality check on
the way in, where `tokenMeterFacts()` guards its own quantities before emitting.

**NARROWED: red-user-artifacts S9.** Its attack on green's §0 — *"The ruling binds the SERVER, not the
browser"* — is right that green chose for itself what it refused to choose for G120, and right that
*"which fourteen of sixty a person selected"* is not derivable from an ordering however deterministic
(I could not verify that the register order is deterministic either). **But the G120 half of the
asymmetry is now closed by the owner's S-8 ruling**, so what remains is the server/browser line alone.
**RULED:** green's §0 becomes an owner question ranked above the rest of this surface — **S-19** — and
artifacts #6, #7 and #8 are **BLOCKED on it** rather than disposed of.

---

## 3. What the four owner rulings change across the eight reports

### 3.1 S-8 RULED OPERATIONAL — G120 survives, and it resolves a conflict the reports could not

**What it settles.** Red-user-artifacts found the greens applying **two opposite readings of G120**:
green-user-artifacts refused to choose (*"only the owner can say which governs"*) while
green-resumable-work, without ever naming Step Functions or a distributed map anywhere in its 1,178
lines, **designed the fan-out's state into PostgreSQL** — which is the literal reading applied without
declaring itself. ✅ **That conflict is now resolved: the operational reading governs, and G120's
distributed map SURVIVES**, because its state is reconstructible under §1.1 and the persisted
`ReaderOutcome` rows are the durable record. **Say so, because a reader of the two greens cannot tell.**

**What it costs, and this is the part no report priced.** The in-Postgres queue is **no longer
required by the ruling**, so it must now be justified on its own merits or dropped. Its surviving
argument is the strong one and it is not the ruling's: **the settle and the meter insert must share a
transaction, and a broker cannot** — which is O-1's shape and green-resumable's Q3.
⚠️ **And it introduces a real overlap: the distributed map has its own retry, and
`reader_request_attempt` has `attempts` and a lease.** Two retry mechanisms over one act is §5.3, and
**nobody designed the join.** The coherent shape — the map dispatches, each iteration claims and
settles a row, and the map's retry is bounded *below* `maxAttempts` so the row is the arbiter — is
**stated here as the recommendation and is not ruled**, because it is a change to G120's shape. **S-20.**

**What it does NOT excuse.** Red-resumable BLOCKER 4's fence, BLOCKER 2's ordering and BLOCKER 3's
counter all survive S-8 untouched: the map being durable says nothing about whether two live workers
can both settle, whether the application order is pinned, or whether a deduped insert leaves a phantom
gap.

### 3.2 S-6 RULED — PARTITION THE CHAINS NOW. The irreversible one is closed.

`RecordChain` (`model/governance.ts:1110`) and `ChainAnchor` (`model/governance.ts:1138`) are both in
the tree and `ChainAnchor` today carries `id`, `tenantId`, `stream: 'audit' | 'data_access'` and
`throughSequence`. **RULED by the owner: one chain per `(tenant, stream, partition)`, with the
partition named in `ChainAnchor`.** The serialisation ceiling that green-state-audit §6.1 and
`stateless-application.md` §6.2 both called *"the sharpest deadline the ruling creates"* is removed;
the accepted costs are that `ChainAnchor` gains a field and that **verification must walk every
partition**, so *"a missing row"* becomes a per-partition claim.

**Consequences across the reports, each named:**
- ✅ **`stateless-application.md` §6.2's headline is spent.** It is no longer the sharpest deadline; it
  is a design task with a decided shape.
- 🛑 **But the window is still open and closes at the same moment.** `ChainAnchor`'s partition field
  must land **before the first chain row exists**, for the reason the type's own neighbourhood already
  gives about canonicalisation. G20 closed the canonicalisation half in the only window where it cost
  nothing; **this is the same window and the ruling has to be applied in it.**
- ⚠️ **`ChainAnchor`'s existing identity argument must be re-read, not assumed.** Its `id` docblock
  says `(tenantId, stream, throughSequence)` *"is not an answer once an anchor can be re-taken"* — a
  partition axis changes what an anchor covers, and **no report considered the interaction.** I could
  not verify that adding a partition preserves the anchor's dispute-evidence property; **that is stated
  as unverified, not waved through.**
- ✅ **Red-state-audit WR-8 called §6.1 *"the most valuable section in the document"*. It was, and the
  ruling is the reason it now is not.**

### 3.3 The containment proof INVERTS to an allow-list of value-free leaves — which claims survive

**The verified premise, and I re-verified it myself rather than inheriting it.** `AssertNoTextDeep` bans
the **TYPE `string`** at a property position, not string-bearing **values**: `NoTextField<T>` is
`string extends T ? never : …` (`model/reconciliation.ts:248-258`). I compiled a five-case probe under
the repository's own compiler options (`strict`, `exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `moduleResolution: bundler`):
`ReadonlySet<string>`, `ReadonlyMap<number, string>`, `{ describe(): string }` and `Uint8Array` **all
pass**; only `{ plain: string }` errored, with `TS2344 … Type 'string' is not assignable to type
'never'`. ✅ **The owner's verification is confirmed.** The proof is to be **inverted to an allow-list
of value-free leaves, as its own commit, verified RED.**

**Which claims in these eight reports survive it:**

| Claim | Verdict |
|---|---|
| green-session: *"`Session` is the first type in this repository the contentless discipline cannot be pointed at"*, because `Timestamp = string` maps every timestamped field to `never` | ✅ **SURVIVES**, and my probe demonstrates the identical mechanism. The substitute — an exact bidirectional key-set assertion refusing a tenth field **of any type** — is the right answer and is stronger for this purpose |
| green-user-artifacts: `AssertNoTextDeep<HeldEditRefusal>` holds | ✅ **SURVIVES.** Nine arms of literal `kind` plus one `number`. It bites |
| red-user-artifacts N2: `RefusedHold` carries `path: FieldPath | null` and is **unasserted**, so what leaves the function is text-bearing while §4's row implies otherwise | ✅ **ADOPTED, and sharpened: it cannot be asserted with the current proof either**, because `FieldPath` is a bare string alias and the assertion would fail. Under the inverted allow-list it becomes expressible. **That is the clearest argument in this pass for doing the inversion** |
| green-resumable: `_OutcomeBindingDefectHoldsNoText = AssertNoTextDeep<OutcomeBindingDefect>` | ✅ **SURVIVES.** Arms carry `requestOrdinal: number` only |
| green-resumable: `_WorkBoundDefectHoldsNoText = never /* see note */` | 🛑 **DOES NOT SURVIVE, and the real assertion holds instead.** RULED 18 |
| Any claim of the form *"the type holds no text because the assertion passes"* where a leaf is a collection or an object with a method | ⚠️ **WEAKENED, and no report made one.** The exposure in this pass is small and I say so rather than inflating it: `holdAdmissible`'s `ReadonlyMap<FieldPath, DataClass>` parameter would pass vacuously if anyone asserted it, and nobody did |

**RULED: the inversion is its own commit, verified RED, and it is sequenced BEFORE any new
containment assertion in §6** — otherwise the held-work surface writes assertions against a proof that
is about to change shape.

### 3.4 G120's replay key becomes CONTENT-ADDRESSED — what dissolves and what does not

**RULED by the owner:** the replay key is content-addressed, not `(runId, requestOrdinal)`. Read against
red-resumable SERIOUS 11 and §16, this is exactly red's declined amendment taken:
`(tenantId, subjectKey, candidateWitness)` identifies the **verdict**; `requestOrdinal` labels the
**act**, which is all G121's *"every reader act carrying it plus its `requestOrdinal`"*
(`docs/HANDOFF.md:847`) asks of it.

**What dissolves:**
- ✅ **`stateless-application.md` §6.6's third irreversible row.** *"`buildReaderRequests`'s iteration
  order becomes part of the persisted contract"* — no longer true. Red-resumable §15's five unfrozen
  iteration orders stop being a persisted contract.
- ✅ **Red-resumable BLOCKER 1's renumbering sequence** — an FDE widening a tolerance no longer strands
  paid calls on unbindable rows. **RULED 8 still stands**, because an unpinned fold still folds
  differently; it is now a correctness defect rather than a money-stranding one.
- ✅ **BLOCKER 6's "witness matches anyway" case.** With the witness as the key rather than a check,
  a preserved witness is a correct binding by definition.
- ✅ **SERIOUS 11's double payment on `reason: 'rule_changed'`** becomes reachable-to-fix: a rerun can
  reuse a verdict whose content key is unchanged.

**What does NOT dissolve, and must be carried:**
- 🛑 **BLOCKER 2. Application order is load-bearing under any key** — `applyReaderVerdicts` is a moving
  fold (`model/reconciliation.ts:2451`, `:2456`) and two verdicts can name one candidate. RULED 9
  stands in full.
- 🛑 **BLOCKER 4's fence.** A content key does not stop two live workers making two paid calls.
- 🛑 **`candidateWitness` must be pinned-input-derived, or the key is not stable.** RULED 13's
  requirement — pin `normalisation` — becomes **load-bearing on the key itself** rather than on a check.
- 🛑 **G111's money codec is sequenced BEFORE the reader executor**, and the owner has ruled it so.
  The mechanism, stated precisely because two reports state it loosely: `canonicalise()` **refuses**
  `bigint` rather than serialising it — its header gives the reason at `model/canonical.ts:66-71`
  (*"a SECOND answer to how money is represented, on the bytes an audit chain signs"*) and the
  implementation falls through to `unsupported_type` for any non-object, non-string, non-number type.
  The **witness** strings are money-free and need no codec; the **plan** is money-bearing the moment
  RULED 8 puts `strategyBindings` in it, so **the plan digest is what the codec unblocks.** Sequencing
  the codec first is therefore right, and the reason is the plan, not the witness.
- ⚠️ **G120's row needs amending and I do not amend it.** Its text requires *"`ReaderOutcome`…
  persisted keyed by `(runId, requestOrdinal)`"*. The owner's ruling supersedes that clause;
  **§9 drafts the row that records it, and only the owner may place it.**

---

## 4. The four surfaces, adjudicated

### 4.1 The session — D1 · 🛑 **NOT BUILDABLE AS DESIGNED**

**SETTLED, with insertion points.** ⚠️ **A green `tsc` after pasting any of this is evidence of
nothing** — `docs/HANDOFF.md:1689` §5.10 — so each item names its witness in §6.

| Declaration | Insertion point | Ruling |
|---|---|---|
| `SessionId`, `SignInAttemptId` | `model/kernel.ts`, beside the other `Id<>` aliases | **SETTLED.** Both greens agree; placement is immaterial |
| `SessionHandleDigest` + its module-private `unique symbol` | `model/domain.ts`, between `IdentityConnection` (`:1355`) and `User` (`:1395`) | **SETTLED.** The preimage is never stored; the platform-wide-key argument is sound and distinguishes itself correctly from `SubjectIndexEntry.subjectRef`'s per-tenant HMAC (`model/governance.ts:1868`) |
| `Session` — nine fields, **not** `TenantScoped` | same block | **SETTLED**, including every deliberate absence. **`orgClass` stays OFF the row and the mechanical argument is the one that settles it:** `redeemAuthorization()` denies on `grant.orgClass !== principal.orgClass` (`model/access.ts:1771`), and that comparison has meaning only because one side is a stamp and the other is freshly derived. Store it and **it passes forever** — §5.6 produced by changing what an input *means* rather than by deleting a check |
| `SignInAttempt` — seven fields, no `userId` | immediately after `Session` | **SETTLED, and it is the best thing in the pass.** The ruling forces a table nobody had named, and green-session found it. §2.5 strikes the claim that nobody did |
| `_SessionIsNotTenantScoped`, `_SessionCarriesExactlyTheseKeys` (bidirectional), `_SessionIdsAreBranded` | `model/identity.ts` | **SETTLED**, and each written RED first |
| `resolveSubject()` → `withTenantScope()` → `projectTenantContext()` | `model/access.ts`, before `decide()` (`:1177`) | **SETTLED BY RULED 2**, against green's single `resolveSession()` |
| `selectTenantForSession()` with `membership_absent` | `model/access.ts` | **SETTLED BY RULED 1.** 🛑 **Nothing on this surface may be built before it** |
| `TenantContext`, `orgFor()`, `ORG_CLASS_FOR_CONNECTION_OWNER` | `model/access.ts` | **SETTLED.** `TenantContext` is named seven times on the wire and zero times in `model/` (`grep -rn 'TenantContext' model/*.ts \| wc -l` → 0) — §5.3 with a wire on one side and nothing on the other |
| `SessionBounds`, refusing on absence | `model/access.ts` | **SETTLED**, plus RULED 3's derived factor requirement and a `session_lifetime_exceeds_ceiling` arm (red S4). **The numbers are S-4** |
| The session migration — **named by subject, no number** | `db/migrations/` | **SETTLED except its predicate key.** Two tables, `FORCE ROW LEVEL SECURITY`, liveness deliberately out of the predicate, `WITH CHECK` stated explicitly, column-level grants per RULED 4, plus RULED 1's membership term |
| `withSessionScope(pool, digest, fn)` | `db/`, beside `withTenantScope()` (`db/tenant-scope.ts:101`) | **SETTLED.** 🛑 **Do not add `query` to `TenantPool`** (`db/tenant-scope.ts:69`) |

**🛑 OPEN — and each is an owner call, not an omission:**
- **OPEN: what keys the session policy** — the handle digest in `app.session_ref` (green A) or the row
  id in `app.session_id` via a `SECURITY DEFINER` `session_id_for_token()` (green B). Green B's
  bootstrap problem is real and green A avoids it; green A puts the digest in a GUC on every request.
  **S-2.** Red-state-audit WR-7 is right that green B's function shape is correct **if** that option
  wins.
- **OPEN: `lastUsedAt`** — green A takes it off the row; green B keeps it with idle expiry. **S-4.**
- **OPEN: what the resolver returns** — `TenantContext` plus a separate `principalFor()` (green A) or
  `PrincipalContext` directly (green B). **Both are defensible and I decline to rule**, because the
  choice follows S-2's transaction shape.
- **OPEN: the staff arm.** Red-session S8 is right and it is not cosmetic: a platform FDE has no
  `Membership`, so a picker built on `Membership` is empty and **`Session.tenantId` can never be set
  for staff** — invariant 8's permitted path made unreachable, which is exactly the inertness
  `CLAUDE.md` records G60 would have had. **RULED: `selectTenantForSession()` takes the
  `TenantAccessGrant` as a parameter and the staff arm is specified, or D1's scope explicitly excludes
  staff and says so.** Which of the two is **S-21**.
- **NOT VERIFIED: the `timestamptz` boundary.** Red S2's mechanism is right — `Timestamp` is a string
  alias, green compares `session.expiresAt <= input.now` **lexically**, the migration declares
  `timestamptz`, and the hand-written shim types result values as `unknown`. Neither red nor I verified
  what the `pg` driver returns for a `timestamptz` in this repository, and no test reads a timestamp
  column. **That is the finding: the representation boundary is unspecified on the one comparison that
  decides whether a credential is still live.** **RULED: one timestamp codec at the boundary, G111's
  shape, and the unparseable refusal extended to the ROW's timestamps and not only the parameter's.**

### 4.2 Resumable work — 🟠 **BUILDABLE IN PART, AND THE PART THAT IS NOT NEEDS NO DATABASE**

**SETTLED:**

| Declaration | Insertion point | Ruling |
|---|---|---|
| `WorkBound`, `WorkBoundDefect`, `validateWorkBound()` | a new module — **S-9** — or `model/domain.ts` | **SETTLED, and buildable today.** The ceiling is **derived** from `MAX_AUTHORIZATION_SECONDS` (`model/access.ts:1517`, `tenant_data: 900` at `:1530`) and needs no invented number. Plus RULED 11's lease-floor arm, whose **number is the owner's** |
| `AssertNoTextDeep<WorkBoundDefect>` | beside it | **SETTLED BY RULED 18.** Written RED first, replacing `= never` |
| `RUN_STATUSES` / `RunStatus`, extracted from the inline field union | `model/domain.ts`, plus both wire enums and a sixth `check:wire` pair | **SETTLED.** An inline field union is neither an `export type` union nor an `export const … as const`, so it drifts unwatched in two wire places |
| `RunPlan` — **carrying `pairing`, `strategyBindings` and both `PopulationBinding`s** | same module | **SETTLED BY RULED 8.** 🛑 **No document may say the plan is hashed** until G111's codec lands |
| `StoredReaderOutcome`, `candidateWitnessOf()`, `OutcomeBindingDefect`, `bindStoredOutcomes()` — **iterating `requests`** | `model/reconciliation.ts`, after `ReaderOutcome` | **SETTLED BY RULED 9.** Touching `model/reconciliation.ts` needs a plan first (`CLAUDE.md`) |
| `attempts_exhausted` on `ReaderRefusal`, **with `buildResidue` owning the precedence** | `model/reconciliation.ts` | **SETTLED BY RULED 12** |
| `storedReaderOutcomes` required and non-nullable on `SetReconciliationInput` | `model/reconciliation.ts` | **SETTLED.** Under `exactOptionalPropertyTypes` the optional form makes *"none yet"* and *"the caller forgot"* one value, and the `TS2741` sweep at every construction site is the only evidence the field landed |
| The work-queue migration — **named by subject** | `db/migrations/` | **SETTLED except the key.** `outcome_kind IS NULL` is the queue; the partial index, the `settled_together` and `candidate_carries_index` checks, the RLS predicate verbatim from `0001`, no `DELETE`, `now()` as `transaction_timestamp()` — all correct. **Plus a `claim_id` column (RULED 11) and RULED 10's conflict-safe sequence allocation** |

**🛑 OPEN:**
- **OPEN: the primary key of the outcome table.** The owner ruled the **replay key** content-addressed;
  whether the table's PK follows or `requestOrdinal` remains the PK with a unique index on the content
  key is a schema choice with an irreversibility attached. **S-17.**
- **OPEN: how the map's retry and the row's `attempts` compose.** **S-20**, §3.1.
- **OPEN: whether a resume may mint a new grant.** **S-7**, narrowed by RULED 14.
- **OPEN: which capability a reader act redeems.** None of the thirty-seven names it
  (`awk '/^export const CAPABILITIES = \{/,/^\}/' model/access.ts | grep -cE '^  [a-zA-Z]+:'` → 37),
  `trigger_run` is `configuration`, and the act reads `tenant_data`. Green-resumable asked this as its
  Q2 and **`stateless-application.md` dropped it.** **S-18.**
- **OPEN: whether the queue may be Postgres at all**, now that the ruling no longer requires it.
  **S-20** carries it, and O-1's shape is the precedent.
- **NOT VERIFIED, and it is red-resumable's own honest note:** whether `check-wire-mirror.mjs`'s path
  resolver reaches an inline-enum property, so the sixth pair may not be addable as stated.
- **DEFERRED BY NAME:** anything touching the shred path, the mapper seam or a landing-bucket buffer
  belongs to `docs/build/ingestion-p2-adjudication.md`. Red-resumable 13.3 records that **T-1 is
  referenced twice and defined nowhere in the tree**; its point that `reconcile_app` cannot
  `CREATE INDEX` at runtime (`db/migrations/0001_tenancy_and_rls.sql:41`, and no `CREATE` on the
  schema) is **adopted as a sentence the work-queue migration must carry**, and the staging-table
  strategy itself is that adjudicator's.

### 4.3 The checker — see §5. **BUILD IT, NOT AS PROPOSED.**

### 4.4 Held human work — 🛑 **NOT BUILDABLE. The correct number of persisted drafts is zero.**

**SETTLED:**

| Declaration | Insertion point | Ruling |
|---|---|---|
| `HeldEditId` | `model/kernel.ts` | **SETTLED.** One brand, and the absence of a `ProposalId` is the control |
| `HeldEditSubject` — anchor and body in ONE discriminated union | a new module — **S-9** | **SETTLED.** Two fields would make *(a field-confirmation body against an approval-decision anchor)* legal, which is the shape `ExceptionResolution` was rewritten to eliminate (`model/domain.ts:2855`) |
| `HeldDisposition` etc. by `Omit` + `Partial` | same | **SETTLED as a technique** — derivation makes divergence structurally impossible — **and NARROWED by RULED 28** for the money-bearing arm |
| `HeldEditClosure` as a union, `authorizationId` on the `submitted` arm only | same | **SETTLED.** Two nullable timestamps would make *both non-null* legal — §5.5 |
| `HeldEditRefusal` (nine arms) + `AssertNoTextDeep` | same | **SETTLED**, plus RULED 25's tenth arm; and red N2's `RefusedHold` gap is adopted per §3.3 |
| `holdAdmissible()`, `replaceAdmissible()`, `submitAdmissible()` | same | **SETTLED as shapes.** The empty-`ReadonlyMap`-refuses polarity is correct and red struck its own attack on it |
| The fourteenth `RetentionClass` and twelfth `SubjectLocation` variant, **appended** not inserted, with both wire enums in the same commit | `model/domain.ts`, `model/governance.ts:1772`, `docs/contracts/foundation.openapi.yaml` | **SETTLED, and irreversible after the first held row.** `check:wire` compares as sequences. **Plus RULED 31's retention-count sweep at `docs/HANDOFF.md:225`** |
| Generated columns for `subject_kind`, `anchor_id`, `anchor_path`, `closure_kind`; the redact-not-delete sweep; RLS predicate verbatim | the held-work migration, **named by subject** | **SETTLED**, plus RULED 28's money columns |

**🛑 OPEN, and the first two are gates:**
- 🛑 **GATE: the `SubjectIndexEntry` write.** RULED 21. Nothing is persisted until a hold writes its
  index entry in the same transaction, and **the `subjectRef` for author-typed prose must be named.**
- 🛑 **GATE: `maxDataClass`.** RULED 22 — absent, or a declared class for prose on the arm.
- **OPEN: the anchorless arm's uniqueness.** RULED 24 states the requirement; which of the two
  mechanisms is a design call I leave with whoever writes the migration, because both are sound.
- **OPEN: arm 3 at all.** The confirmed-field arm has no committed counterpart. **S-12.**
- **OPEN: `minimumHoldIntervalSeconds`, `days.held_edit`, `maxOpenDraftAgeDays`.** Three numbers, none
  invented here. **S-4, S-15, S-22.**
- **OPEN: whether G39's SOP amendment reads held prose** — which would need G106's unreadable-by-default
  rule to carry an explicit, argued exception for user-authored prose. Green-user-artifacts asked this
  as its Q7; **`stateless-application.md` dropped it.** **S-23.**
- **NOT VERIFIED:** every SQL statement on this surface. No live PostgreSQL was reached by any report or
  by me.

---

## 5. The checker — **BUILD IT. NOT AS PROPOSED.** Six things change first.

**The verdict, adopted from red-state-audit and I could not improve on its reasoning:** the danger is
not that the checker is weak, it is that **in this form it would be trusted**, and its two loudest
claims are its two false ones. *"A checker nobody trusts is worse than no checker; a checker that is
trusted and wrong is worse than both"*, because it retires the human reading that was catching these
things — and §5.6 exists in this repository because that has already happened here.

**Speed is not an argument against it.** Red measured the gate at 4 s and the four existing checkers at
110–419 ms, over 1.1 MB of source. **G108's *"deterministic and fast"* condition is met**
(`docs/HANDOFF.md:834`).

**The six changes, in the order they must be made:**

1. **Rule 2 becomes ONE-PART.** Any module-scope mutable container is a finding; the frozen-lookup
   exemption is keyed on the **type** — `Readonly*` or `as const` — not on *"not mutated in this
   file"*. **Red B1's measured escape is the ruling's own central case:** declare
   `export const sessions = new Map()` in one module and `sessions.set(...)` in another and the
   two-part test reports **nothing on either file** — and `export` is the reason to declare it at
   module scope in the first place. Green's *"WHAT THIS CANNOT SEE"* block does not contain this
   bullet, so a reader concludes it is covered.
2. **Rule 8 is re-aimed at the property or dropped**, and **M5's premise is struck from the record with
   `db/pg.d.ts:52` cited beside it.** RULED 19.
3. **The waiver becomes a counted allow-list in the checker's own source**, length asserted by a test;
   the in-code marker documents and does not grant. RULED 20.
4. **The determinism rules get their own annotations and ONE named edge module per root, by path.**
   Otherwise the gate is red on the first HTTP handler and the first session mint: `resolveSession`'s
   `now` must come from a clock read in the request path (rule 3's own root), and the session token
   must come from a CSPRNG (rule 4). `@node-local … Reconstructible:` is meaningful for residence and
   meaningless for both of those — one vocabulary for two properties is §5.3 inside the control.
   ⚠️ **And red S4's list is the practical version of the same point:** a retry backoff
   (`setTimeout`) is *"ease of retry"*, the ruling's own second half, flagged by a rule written to
   serve the first.
5. **Vacuity becomes per-RULE, derived from per-rule counts** — `{rule, candidatesExamined, findings}`,
   and any rule examining zero candidates on a real-tree run joins `vacuous` **by derivation**. Green's
   `vacuous` is a directory listing; `check-pack-safety.mjs`'s is derived from its own counts and
   cross-asserted by a test. Rename `db/tenant-scope.ts` and rule 8 matches nothing, reports nothing,
   and appears in no vacuous list.
6. **The "cannot see" block names all ELEVEN measured escapes**, not three. Eight of red's eleven are
   absent from it, and *"a limitation that is not listed reads as coverage."* Add §1.3's five, and add
   **node identity persisted into a durable row**, which no rule addresses.

**Then:** `tools/check-stateless.mjs`, `"check:stateless"` in `package.json`, added to `check` **and**
to `CHECKERS_THE_WORKFLOW_MAY_NOT_NAME` (`tests/ci/gate.test.ts:61`) — ✅ **which exists, is
hand-maintained, and today lists seven names.** ⚠️ **The workflow file is not touched:**
`.github/workflows/check.yml` exists and says of itself *"DO NOT ADD A STEP HERE."* Paired fixtures per
rule, including the two that matter most — a frozen lookup that must exit 0, and a doc comment quoting
every banned token that must exit 0.

**⚠️ And red's N2 is adopted as the stronger form of G108:** nothing today asserts that **every
`check:*` script in `package.json` appears in `check`**. A tenth checker can be added and omitted and
no test fails. That assertion is cheap and belongs in `tests/ci/gate.test.ts`.

**Why build it at all, stated honestly, because red found the honest answer and green wrote it down:**
`schemaMappingCache` **is not in this tree** — the module-level cache the brief named was adjudicated
out before it landed. *"Not because the tree is dirty, but because the proposal that was refused will
be made again."*

---

## 6. The ordered build for phase one

**G101 is deliberate: a disposable Postgres, an in-process `pg.Pool`, and NO AWS resource**
(`docs/HANDOFF.md:827`). `db/provision.ts` and `db/migrate.ts` exist. ⚠️ **`pg` is still absent from
`package.json`** (`grep -c '"pg"' package.json` → 0) and is loaded dynamically (`db/pg.ts`), so the
leak test's evidence is machine-local rather than reproducible from the manifest — `db/pg.ts:17` says
the honest thing about it: *"THE SKIP IS ONLY HONEST WHILE IT IS LOUD."*

🛑 **D1 gates every step with a wire.** `docs/HANDOFF.md:145`: *"All three contract tiers require
`X-Session`; no path issues one. Everything with a wire depends on it."* Steps 1–4 and 7 are reachable
before it.

| # | Step | Extends which test file | Why here |
|---|---|---|---|
| **1** | **The containment-proof inversion** — `AssertNoTextDeep` to an allow-list of value-free leaves, verified RED | `tests/model/canonical.test.ts`'s sibling discipline; a new red-first case per leaf kind | §3.3. **Every later containment assertion is written against the new proof or it is written twice** |
| **2** | `tools/check-stateless.mjs` + paired fixtures, joined to `npm run check`, with §5's six changes | **new** `tests/tools/check-stateless.test.mjs`, in `tests/tools/check-wire-mirror.test.mjs`'s shape; two assertions in `tests/ci/gate.test.ts` | The only step with **no dependency on D1**, and building it first means every later step lands under it rather than beside it |
| **3** | The `@node-local` allow-list entry for `db/pg.ts:25`, plus the marker | the checker's own trunk test: `waived` has length **one** and names `db/pg.ts` | Makes step 2's one existing finding explicit rather than special-cased in code |
| **4** | `ChainAnchor`'s partition field, per S-6 | `tests/model/canonical.test.ts` for the total-record proof; a new red-first case asserting a chain in one partition does not verify against another's anchor | 🛑 **Irreversible from the first chain row and the window is open NOW.** §3.2 |
| **5** | `WorkBound`, `WorkBoundDefect` incl. the lease **floor** arm, `validateWorkBound()`, `RUN_STATUSES`/`RunStatus`, both wire enums | `tests/model/reconciliation-controls.test.ts` (beside the existing `Math.random` control); `tests/tools/check-wire-mirror.test.mjs` for the sixth pair | Needs no database, no session, and **no invented number for the ceiling**. The floor refuses on absence until S-4 answers |
| **6** | **G111's money codec** | **new** `tests/model/money-codec.test.ts`; `tests/model/canonical.test.ts` gains the assertion that a money-bearing plan is **REFUSED** today and stops being refused when the codec lands | 🛑 **The owner sequenced it before the reader executor.** It is what unblocks the plan digest. §3.4 |
| **7** | `RunPlan` **with `pairing`, `strategyBindings` and both `PopulationBinding`s**; `StoredReaderOutcome`, `candidateWitnessOf()`, `bindStoredOutcomes()` iterating `requests`; `attempts_exhausted` with `buildResidue` owning precedence; `storedReaderOutcomes` required | `tests/scenarios/engine-behaviour.test.ts` and `tests/scenarios/recon-corpus.ts` (the `TS2741` sweep is the evidence the field landed); **new** `tests/model/reader-outcome-binding.test.ts`; a resume-determinism case with **two** stored outcomes contending for one candidate, shuffled | Touching `model/reconciliation.ts` needs a plan first. RULED 8, 9, 12, 13 |
| **8** | 🛑 **`selectTenantForSession()` with `membership_absent`** — model half | **new** `tests/model/session-resolution.test.ts`, in `tests/model/managed-service.test.ts`'s shape | **D1's gate. Nothing else on the session surface may precede it.** RULED 1 |
| **9** | `SessionId`, `SignInAttemptId`, `SessionHandleDigest`, `Session`, `SignInAttempt`, `SessionBounds`, the refusal union, `resolveSubject()`, `projectTenantContext()`, `orgFor()`, `TenantContext`, the timestamp codec, **and the fixtures in the same commit** | same file; the assertions go in `model/identity.ts` | 🛑 **`tsc` stays green whatever is wrong here**, so the fixture is the only verification: one test per refusal arm; `bounds_not_configured` for `0`, `-1` and `NaN`; and a positive control asserting `orgClass` came from the **connection** by passing an owner that disagrees with any plausible stored value |
| **10** | The **session migration** (subject-named) + `db/session-scope.ts` | **new** `tests/db/session-isolation.test.ts`, in `tests/db/tenant-isolation.test.ts`'s shape — including its LOUD SKIP and its `pg_backend_pid()` same-connection assertion | The migration and the refusals **land together in one commit or neither lands.** Negative tests: a wrong digest reads nothing; `USING (true)` makes B's row visible under A's scope; a session cannot select a tenant it holds no membership in |
| **11** | The **work-queue migration** + `db/work-queue.ts`, whose functions all take a `ScopedClient` (`db/tenant-scope.ts:50`) so they are unissuable outside a scoped transaction | **new** `tests/db/work-queue.test.ts`, extending `tests/db/tenant-isolation.test.ts`'s harness | Two concurrent claims cannot hold one ordinal; a second settle returns `rowCount 0`; **a lapsed holder's settle is REFUSED by `claim_id`, not merely raced**; a conflict-deduped meter insert leaves **no sequence gap**; a guarded transition from a wrong prior status returns `rowCount 0`; the reaper reports **two** numbers |
| **12** | The fourteenth `RetentionClass`, the twelfth `SubjectLocation` variant, both wire enums, and the `docs/HANDOFF.md:225` retention sweep | `tests/model/canonical.test.ts`'s neighbour; `tests/tools/check-wire-mirror.test.mjs` | 🛑 **Both irreversible after the first held row.** Cheap now, unrecoverable later |
| **13** | 🛑 **The `SubjectIndexEntry` write, in the same transaction as the held row** | **new** `tests/db/held-work.test.ts`: a hold with no index entry **fails**; an erasure plan built from the index **reaches** the draft | **The held-work gate.** RULED 21. Until this exists the correct number of persisted drafts is zero |
| **14** | `HeldEditId`, `HeldEditSubject`, `HeldEditClosure`, `HeldEdit` (**no `maxDataClass`** until RULED 22 is answered), the type-keyed assertions, the three gates, the idempotency key on submission, the held-work migration | **new** `tests/model/held-work.test.ts`; `tests/db/held-work.test.ts` for the partial unique index, the generated columns and the two-tab race | Last: needs step 12, needs D1, needs the `DataClass` ladder, and needs an idempotency key |

**Verification after every step, and the second command is the one that matters:**

```bash
./node_modules/.bin/tsc -p model/tsconfig.json --noEmit; echo "EXIT: $?"   # its own command, unpiped
node tools/planner/extract.mjs      # edges and gaps BY KIND, against the previous run
node tools/check-doc-counts.mjs     # will report STALE lines; that is the tool working
npm run check                       # the one gate — G108
```

⚠️ **Steps 5, 7, 9 and 14 move the `exports` metric.** At `HEAD` it is **834**
(`grep -h '^export ' model/*.ts | wc -l`) — ⚠️ **not the 832 `stateless-application.md` states**, and
`docs/build/` is not scanned by `check-doc-counts.mjs`, so that number is checked by nobody. Budget the
sweep in the same commit or the gate stays red.

---

## 7. The costs, attributed — and every remaining collision with a G row, quoted

### 7.1 The costs

| Cost | Attributed to | Stated |
|---|---|---|
| **The session read cannot be amortised, EVER** | green-session §6.1, green-state-audit §1.1 | Five row-sets before any work on every request, where a signed-token design needs zero. It can be one statement over four tables plus one for assignments, so the honest figure is **+1 statement, +1 `set_config`, +1 transaction if resolve and work are not composed.** An in-process cache is forbidden **twice** — by the ruling and by G116 — a shared cache is closed by G103, and a signed token is refused **by name** at `model/access.ts:1536`. ⚠️ **Three uncacheable reads are now stacked in one latency budget** — the session row, G103's rule-cache table, and `redeemAuthorization()`'s grant row. **If latency is reopened it must be reopened ONCE, with a measurement, against all three** |
| **The chain's per-tenant lock, now bounded rather than open** | green-state-audit §6.1 | S-6 removes the ceiling; what remains is that `ChainAnchor` gains a field and **verification walks every partition** |
| **The queue's counter serialises meter writes per plane** | green-resumable §2.10, corrected by red SERIOUS 9 | Priced with a per-**tenant** figure on a **plane**-scoped row, from a citation that does not resolve, from before G120's multiplier. **Unmeasured, and I invent no figure** |
| **A resume recomputes the WHOLE fold** | green-resumable §6 cost 2 | The price of not inventing a state serialisation format. **The crossover is unmeasured and no threshold is stated** |
| **An O(tenants) sweep in the hosted topology** | green-resumable §2.9 | Free under BYOA. The tenant count at which it stops being acceptable is unmeasured; **fairness and starvation are unaddressed and no fairness rule is invented.** The escape hatch is a table outside RLS that G103's reasoning refuses. **S-10** |
| **Two retry mechanisms over one act** | 🆕 **this document**, §3.1 | S-8's consequence, priced by nobody. **S-20** |
| **The temp file goes, and with it a class of parser** | green-state-audit rule 5 | Reinforces the existing parser ruling on **two** grounds. Corollary no checker can see: with an in-memory parser the byte and decompression bounds become the worker's **memory** bound — an unset bound was a refusal, now it is also an OOM. **Deferred to `ingestion-p2-adjudication.md`** |
| **Autosave turns typing into billable volume** | green-user-artifacts §7.5 | A hold is an API call. Nothing in the model marks an act non-metered, and a screen already promises *"confirming spends nothing."* ⚠️ **Red N6's undisclosed half is adopted:** the meter aggregates by sum, so the metering table becomes a **per-person count of autosave debounces** — a new observability of an individual's typing cadence that no screen discloses. **S-11** |
| **A hold is not audited** | green-user-artifacts §7.5 | The accepted cost is **a write of personal data with a capability check and no record.** RULED 32 corrects the reason to volume. **S-13** |
| **The interactive path now contains a database write** | green-user-artifacts §7.2 | One autosave is four round trips minimum, three of them overhead |
| **Nothing can enumerate sessions** | green-session §6.5 | A security property **and** a cost: *"sign me out everywhere"* is unimplementable without a generation counter on `User`, and incident response cannot list live sessions. **S-5** |
| **The gate's own cost** | green-state-audit, `stateless-application.md` §6.8 | A tenth checker, ~a dozen exports per step, and a module count moving off 18 (`ls model/*.ts \| wc -l` → 18). **Every one is the tool working** |

### 7.2 Every remaining collision with a G row, quoted and handed over

🛑 **G99 — the negative control the session read cannot honour.** `docs/HANDOFF.md:825`:
*"`withTenantScope()` must open an explicit `db.transaction()` and **no query may be issued outside
it** — a named negative control, not a review convention."* The session read is a query outside it and
has to be: `withTenantScope()` takes a `tenantId` as its first act and the session read is what
produces one — its own docstring says *"it is the last link in the chain, not the first"*
(`db/tenant-scope.ts:101`, comment above it). Two ways out and no third: a **second sanctioned helper**,
or `withTenantScope(pool, null, …)`, which is a scoped helper that scopes nothing.
**Both greens recommend the first and neither took it. S-1.**
⚠️ **A second G99 collision nobody raised:** G99 rules the ORM is **Drizzle**, and `db/tenant-scope.ts`
is hand-written `pg` with raw SQL strings, as is every statement in all four designs. That is not
wrong — G99 is `not applied` — but **no document says the phase-one build is being written against a
client the ruling replaced.** Handed over, not resolved.

🛑 **G100 — the predicate cannot protect the session table, and it is structural.**
`docs/HANDOFF.md:826`: *"RLS denies on NULL, with a separate BYPASSRLS role for migrations."* A session
row's `tenant_id` is null before the tenant is known and `app.tenant_id` is unset at the moment the
session is what decides it, so the row would be invisible to the connection that just wrote it — G100
working correctly against the one table that must be readable before a tenant exists. **A second GUC is
structural; which value keys it is S-2.**

🛑 **G120 — its key clause is superseded and I do not edit it.** `docs/HANDOFF.md:846` requires
*"`ReaderOutcome` must be **persisted keyed by `(runId, requestOrdinal)`**, which is what makes a retry
granular AND makes a rerun REPLAY stored verdicts rather than re-ask."* The owner has ruled the replay
key content-addressed. §9 drafts the row; **only the owner may place it.**

🛑 **G121 — one grant per map execution against a 900-second ceiling and a resume that may happen
later.** `docs/HANDOFF.md:847`: *"ONE `AuthorizationGrant` per map execution; every reader act carries
it plus its `requestOrdinal`"*, with its cost stated as *"withdrawal stops future draws, not live
ones"*. Expiry is not withdrawal. RULED 14 fixes the missing call site; **whether a resume mints a new
grant is S-7.**

🛑 **G111 — sequenced first, and the reason is the plan.** `docs/HANDOFF.md:837`: *"ONE money codec
module, and it is the only thing permitted to touch the representation."* ⚠️ **And `model/canonical.ts`
already asserts the future as the present** — *"After G65 `Money.amountMinor` is `bigint`"* — while
`model/domain.ts:535` reads `amountMinor: number`. §10.2.

🛑 **G103 — no third store, and it is the escape hatch two designs need.** `docs/HANDOFF.md:829`.
Its refusal of a table outside RLS is what makes the O(tenants) sweep the answer, and it is why no
in-process session cache is available. **S-10.**

🛑 **G106 — user-authored prose has no `FieldSpec` and therefore no class.**
`docs/HANDOFF.md:832`: *"`FieldSpec` gains a JSONB path; a key with no `FieldSpec` is UNREADABLE …
Fail-closed."* Applied to a sentence a person typed, that rule either refuses the flagship artifact
forever or does not reach it at all. **RULED 22 refuses to guess; S-23 asks whether G39's SOP amendment
needs an argued exception.**

🛑 **G107 — the plane split, and it is the row that actually names Step Functions.**
`docs/HANDOFF.md:833`: *"the Step Function, its Lambdas, the Fargate task, the S3 landing bucket,
EventBridge and every log they write run under the data-plane DB role."* S-8's operational reading is
what keeps this row intact; the literal one would have contradicted it. **Recorded because no report
noticed that G107, not G120, is where the orchestrator is named.**

⚠️ **G88 — the wire moves with the model, and forward-only.** `docs/HANDOFF.md:814`. Every enum change
in §6 is a wire change in the same commit, and **no migration is ever edited once applied — which is
the whole reason for the no-migration-numbers convention above.**

⚠️ **G108 and G95 are now substantially APPLIED and two documents say otherwise.** §10.1.

---

## 8. OWNER RULINGS STILL REQUIRED

**S-numbers only.** S-1 to S-15 are carried forward with status; S-16 to S-23 are new, and **six of the
eight are questions the four greens asked that `stateless-application.md` dropped.** 🛑 **Nothing on the
session surface should be built without S-1, S-2 and S-21; nothing on held work without S-22 and S-15;
nothing on the queue without S-17 and S-20.**

| # | Status | Question | Recommendation | Cost of the recommendation |
|---|---|---|---|---|
| **S-1** | **OPEN** | G99 says no query outside `withTenantScope()`. The session read must be one. A second named helper, or a nullable tenant? | **The second named helper**, and the invariant becomes *"every query runs inside one of exactly two named scoped helpers"* | The negative control has two members and somebody will propose a third. 🛑 Either way: **do not add `query` to `TenantPool`** |
| **S-2** | **OPEN** | What keys the session policy — the handle **digest** in `app.session_ref`, or the row **id** in `app.session_id` via a `SECURITY DEFINER` lookup? | **The digest.** It needs no privileged function; a `SECURITY DEFINER` lookup becomes the most security-relevant object in the schema | The digest becomes a GUC value on every request. The rejected option costs a privileged function plus its own two-row negative test |
| **S-3** | ✅ **CLOSED by adjudication, not by you** | Is `orgClass` stored or re-derived? | **RE-DERIVED**, and the mechanical argument closes it: a stored `orgClass` makes `redeemAuthorization()`'s check (`model/access.ts:1771`) compare a stamp to a copy of the same stamp — **it would pass forever** | +1 read per request, permanently and uncacheably, joinable into the session read. **No owner ruling needed; recorded so nobody reopens it** |
| **S-4** | **OPEN — and now wider** | Idle expiry, and every bound: `maxLifetimeSeconds`, `maxIdleSeconds`, any autosave interval — **plus the lease FLOOR** (`providerTimeoutSeconds`, permitted transport retries) that RULED 11 shows is missing | **State them all as required configuration that REFUSES on absence.** On idle expiry: if yes, write at most once per configured interval, not per request; if no, `lastUsedAt` comes off the row | With no numbers, **`resolveSession()` refuses every session and none can be minted** — the intended failure. **Without the floor, every model call slower than the lease is double-paid by construction** |
| **S-5** | **OPEN** | Is *"sign me out everywhere"* a v1 requirement? | **No for v1** | Incident response cannot list live sessions; the lever is `User.status` |
| **S-6** | ✅ **CLOSED BY YOU** | Single chain or partitioned? | — | **Partitioned, with the partition named in `ChainAnchor`.** ⚠️ **The window is still open and closes at the first chain row — §6 step 4.** And I could not verify that a partition axis preserves `ChainAnchor`'s dispute-evidence property |
| **S-7** | **OPEN — narrowed** | May a resume **mint a new grant** for a map, making it one grant per *attempt*? | **No recommendation offered.** G121's stated cost is withdrawal, not expiry; this is new ground | ✅ **The other half is RULED, not asked:** the executor calls `redeemAuthorization()` before every model call. That was an omission, not a decision |
| **S-8** | ✅ **CLOSED BY YOU** | Literal or operational reading? | — | **Operational. G120 survives.** ⚠️ **Two consequences you should see: the in-Postgres queue is no longer required by the ruling and must be justified on the transaction argument alone (S-20); and the record's rule must be RESTATED in the operational form everywhere, or the next reader applies the literal one** |
| **S-9** | **OPEN** | May new modules exist, or do these types go into `model/domain.ts`? | **New modules.** `ReconciliationRun` is on the wire and is the business record; a lease is neither, and a held draft is neither | The governed module count moves off 18 and every document stating it goes STALE. **That is the tool working** |
| **S-10** | **OPEN** | Registry sweep at O(tenants), or a lease table outside RLS? | **The sweep**, because G103 refused a table outside RLS on the ground that four invariants are enforced by the store | O(tenants) per sweep in the hosted topology. **Fairness and starvation are unaddressed and no fairness rule is invented** |
| **S-11** | **OPEN** | Is autosave a metered act? | **You decide.** Either typing has a unit price, or something marks an act **non-metered** | Metering typing contradicts a promise already drawn on a screen. ⚠️ **And the metering table becomes a per-person count of typing cadence** that no screen discloses |
| **S-12** | **OPEN** | Is the confirmed-field act in v1? | **If no, do not declare the arm at all** — a draft with no promotion path is a promise the product cannot keep | If yes: a capability, an operation, a home for the value, and a distinct event type. Four absences |
| **S-13** | **OPEN** | Does an audit row exist per hold? | **No per hold.** If unacceptable, the answer is a **coarser** record — one row per draft lifetime | As ruled: a write of personal data with a capability check and no record |
| **S-14** | **OPEN** | Will D6 — the runtime validation boundary — be taken before an unauthenticated public endpoint ships? | **Yes, before.** This would be the first such endpoint | Delays the session wire by whatever D6 costs |
| **S-15** | **OPEN ⚖️** | Counsel: does unsubmitted work fall inside PDPA access and correction, not only erasure? And what is the held-work retention window? | **Not answerable here** | Without the window, every hold refuses. **RULED 21 adds a second counsel-adjacent question: what `subjectRef` an author-typed sentence is indexed under** |
| **S-16** | 🆕 **NEW** — green-state-audit Q1, dropped by the synthesis | Does the ruling forbid an in-process cache of a control-plane-published, **tenant-independent, version-addressed** artefact — the model catalogue, a pack, a policy bundle? | **Permit it**, with an allow-list entry naming the artefact version as the cache key. The literal reading forbids something that costs nothing and leaks nothing | The entry becomes the only thing separating this from the ruling's central case, and **a version-keyed cache is one careless key away from tenant-keyed** |
| **S-17** | 🆕 **NEW** — the consequence of your content-addressed ruling | Does the outcome table's **primary key** become the content key, or does `requestOrdinal` stay the PK with a unique index on the content key? | **The content key as PK, `requestOrdinal` as a labelled column** — it makes §1.1(c) structural rather than conventional | Irreversible from the first stored verdict either way. The rejected option keeps `requestOrdinal`'s ordering cheap in the queue index |
| **S-18** | 🆕 **NEW** — green-resumable Q2, dropped by the synthesis | **Which of the thirty-seven capabilities does a reader act redeem?** None names it, `trigger_run` is `configuration`, and the act reads `tenant_data` — and `authorize()` refuses the mismatch | **No recommendation.** A thirty-eighth capability is a platform release and is yours | If it is a thirty-eighth, `CAPABILITY_RESOURCE_CLASS` makes it a **compile error** until it is classed — the totality biting, which is the cheap half |
| **S-19** | 🆕 **NEW** — green-user-artifacts §0, promoted per §2.7 | **Does the ruling bind the browser?** Green assumed *"the SERVER, not the browser"* and says that line *"is the difference between eleven durable artifacts and four"* | **Answer it explicitly either way.** The ruling names *"other user artifacts"* and says nothing about tabs versus nodes | If it binds the browser, artifacts #6, #7 and #8 need machinery nobody designed. If it does not, say so on the record, because green chose for itself what it refused to choose for G120 |
| **S-20** | 🆕 **NEW** — S-8's unpriced consequence | **How do the distributed map's retry and `reader_request_attempt.attempts` compose?** Two retry mechanisms over one paid act is §5.3, and the ruling no longer requires the Postgres queue | **The map dispatches; each iteration claims and settles a row; the map's retry is bounded BELOW `maxAttempts` so the row is the arbiter.** And keep the queue — on the transaction argument, not the ruling | This narrows G120's shape and therefore needs your word. The alternative — the map alone — loses the settle-and-meter-in-one-transaction property, which is the argument that survives |
| **S-21** | 🆕 **NEW** — red-session S8, raised by no green as a question | **Does D1 include the staff arm?** A picker built on `Membership` is empty for a platform FDE, so `Session.tenantId` can never be set for staff and invariant 8's permitted path is unreachable | **Include it** — `selectTenantForSession()` takes the `TenantAccessGrant`. G60 as written was **inert** for exactly this shape and `CLAUDE.md` records it | Excluding it is defensible staging **only if D1 says so out loud**, because otherwise the FDE's own job is structurally impossible and nobody notices until an engagement |
| **S-22** | 🆕 **NEW** — RULED 26's second number | **What is the absolute maximum age of an open draft**, independent of idle expiry? | **State it as required configuration refusing on absence** | Without it, `purge_after` recomputed from `lastHeldAt` means a heartbeat autosave keeps a person's name in the database indefinitely, which defeats the reason the fourteenth retention class was minted |
| **S-23** | 🆕 **NEW** — green-user-artifacts Q7, dropped by the synthesis | **Does G39's SOP amendment read held prose?** If yes, G106's unreadable-by-default rule needs an explicit exception for user-authored prose, argued at the point of use | **No recommendation.** It trades a drawn interaction against a fail-closed invariant, and both are yours | If yes: an argued exception on the most fail-closed rule in the model. If no: the sharpest interaction in the screen pack loses its input and the screen needs redrawing |

---

## 9. DRAFT G ROWS — **nobody may copy these into `docs/HANDOFF.md` without the owner placing them**

🛑 **A G number is an identity, and two documents minting the same one is worse than a gap.** These are
**DRAFTS**. The owner places them, or they stay here.

**I derived the next free number rather than guessing it.** `grep -cE '^\| G[0-9]+ \|' docs/HANDOFF.md`
→ **131 rows**, and the highest number in those rows is **131**
(`grep -oE '^\| G[0-9]+ \|' docs/HANDOFF.md | grep -oE '[0-9]+' | sort -n | tail -1`). Rows equal
maximum, so there are no gaps and **the next free number is G132.** ⚠️ **Re-derive both before placing
anything** — a concurrent pass is writing `docs/build/ingestion-p2-adjudication.md` and may take
numbers first, in which case **renumber these and keep the order**.

`docs/HANDOFF.md` §3's format is four columns: **number · Decision · Consequence · State.**

| | Decision | Consequence | State |
|---|---|---|---|
| **G132** *(draft)* | **THE APPLICATION IS STATELESS, IN THE OPERATIONAL FORM: no node-local state another node or a retry cannot RECONSTRUCT from durable storage** | Answers the owner's ruling of 9 Aug 2026 — *"I want the application stateless so it can scale without a node dependence and for ease of retry in case a node fails"* — and rules that *"committed to the database"* is **operational, not literal** (see G133). **RECONSTRUCTIBLE is defined in three required parts and all three are checkable:** (a) every value the state depends on is readable from a committed row **or** a version-addressed, downward-published artefact; (b) the rebuild is a **pure, total** function of those values plus a **named, enumerated** set of boundary inputs; (c) if the rebuild can re-perform an **effect**, the effect's durable key is over the **CONTENT of the act, never a position in a derived array**, and the suppressed repeat **increments something a person can query**. 🟢 **The ruling costs the existing tree almost nothing and that is the argument for taking it now:** `grep -rnE '^(export )?(let\|var) ' --include='*.ts' model db` returns **one** line, `db/pg.ts:25`, a memoised dynamic-import handle. **It ratifies G116 rather than introducing a posture** — G116 refused a shared scratch buffer on this exact reasoning, citing `S2`, a module-level cache that leaked inferred structure across a tenant boundary — and **G103 is the same ruling applied to a cache, eight days early.** ⚠️ **What it costs, unsoftened:** the session read cannot be amortised **ever** (an in-process cache is forbidden by this row, by G116, and by G103's absence of a third store; a signed token is refused **by name** at `model/access.ts:1536`), so **three uncacheable reads now sit in one latency budget and latency must be reopened ONCE against all three or not at all.** 🛑 **Part (c) is the pass's central rule and it is the half everyone drops:** a no-op that leaves no trace is indistinguishable from work that never happened — which is how a deduped meter insert becomes a phantom lost record, and how a retry after a node death writes a **second** `ApprovalDecision` while the type permits it. **No design on any surface may claim retry-safety without naming its content key and its counter.** ⚠️ **And a clean checker run is not evidence:** the request path is where this defect lives and **there is no request path** | not applied |
| **G133** *(draft)* | **S-8: the OPERATIONAL reading governs, so G120's distributed map SURVIVES** | *"Committed to the database"* is satisfied by state a retry can reconstruct from durable storage, so a data-plane state machine holding its execution state outside PostgreSQL complies **provided the persisted `ReaderOutcome` rows are the durable record.** **This resolves a live conflict rather than settling a preference:** two green designs applied **opposite** readings — one refused to choose and one silently designed the fan-out's state into PostgreSQL without naming the reading it was taking. ⚠️ **It also keeps G107 intact**, which is the row that actually names *"the Step Function, its Lambdas, the Fargate task"*; the literal reading would have contradicted it. 🛑 **Two consequences that are costs, not corollaries.** First, **the in-Postgres reader queue is no longer REQUIRED by the ruling** and must stand on its own argument — *the settle and the meter insert must share one transaction and a broker cannot* — which is O-1's shape. Second, **the map has its own retry and the queue row has `attempts` and a lease: two retry mechanisms over one paid act, which is §5.3, and nobody designed the join.** The recommended shape is that the map dispatches, each iteration claims and settles a row, and the map's retry is bounded **below** `maxAttempts` so the row is the arbiter — **that narrows G120's shape and is not taken here.** ⚠️ **What this does NOT excuse:** a durable map says nothing about whether two live workers can both settle, whether the verdicts' application order is pinned, or whether a deduped insert leaves a phantom sequence gap. All three are live defects | not applied |
| **G134** *(draft)* | **S-6: PARTITION THE CHAINS NOW — one chain per `(tenant, stream, partition)`, with the partition named in `ChainAnchor`** | Under statelessness no node may hold a chain head in memory, so N nodes appending to one chain serialise on a locked head row **inside the request transaction** — and under G101 that lock is held for the whole transaction, so **per-tenant audit write throughput becomes that tenant's request-concurrency ceiling** and unrelated concurrent requests queue behind each other's slowest statement. The volume figure the record quotes is *"under 1 row/sec average. Unremarkable"* — ⚠️ **an average is not a lock-contention argument and a month-end close is not the average.** Partitioning removes the ceiling. **Costs accepted, both:** `ChainAnchor` (`model/governance.ts:1138`) gains a field, and **verification must walk every partition**, so *"a missing row"* becomes a per-partition claim rather than a whole-stream one. 🛑 **IRREVERSIBLE, AND THE WINDOW IS OPEN NOW.** `RecordChain` (`model/governance.ts:1110`) chains `previousHash` over canonical bodies; **there is no migration that rewrites a hash-chained stream.** This must land **before the first chain row exists** — the same window in which **G20** closed the canonicalisation half *"before the first hash, which was the only window in which it cost nothing."* ⚠️ **One interaction NOT verified and it must be checked before the field is added:** `ChainAnchor.id`'s own docblock argues that `(tenantId, stream, throughSequence)` *"is not an answer once an anchor can be re-taken"*; a partition axis changes what an anchor covers, and **nobody has confirmed the dispute-evidence property survives it** | not applied |
| **G135** *(draft)* | **THE CONTAINMENT PROOF INVERTS TO AN ALLOW-LIST OF VALUE-FREE LEAVES — its own commit, verified RED** | `AssertNoTextDeep` bans the **TYPE `string` at a property position**, not string-bearing **values**: `NoTextField<T>` is `string extends T ? never : …` (`model/reconciliation.ts:248-258`). ✅ **VERIFIED BY COMPILING under the repository's own options:** `ReadonlySet<string>`, `ReadonlyMap<number, string>`, `{ describe(): string }` and `Uint8Array` **all pass**; only a bare `string` field errors. So the proof is a **deny-list of one shape** where it is read as a guarantee of containment. **Inverting it to an allow-list of leaves known to carry no value makes the guarantee the one people already believe it gives.** 🟢 **The clearest argument for doing it comes from a real gap this pass found:** a refusal wrapper carrying `path: FieldPath | null` **cannot be asserted at all today** — `FieldPath` is a bare string alias, so the assertion fails rather than passing — while the type it wraps is asserted and the design implies the wrapper is covered. Under an allow-list that becomes expressible. ⚠️ **What survives the inversion, checked rather than assumed:** the finding that `Session` is the first type the contentless discipline **cannot** be pointed at (because `Timestamp` is a string alias, so every timestamped field maps to `never`) is CORRECT, and its substitute — an exact **bidirectional** key-set assertion refusing a tenth field **of any type** — is stronger for that purpose and must not be replaced by a contentless one. 🛑 **Sequenced BEFORE any new containment assertion**, or the next surface writes assertions against a proof that is about to change shape. **Each leaf written RED first:** *"an assertion that has never failed is a comment with extra steps"* | not applied |
| **G136** *(draft)* | **G120's REPLAY KEY BECOMES CONTENT-ADDRESSED, and G111's money codec is sequenced BEFORE the reader executor** | G120 requires *"`ReaderOutcome` … persisted keyed by `(runId, requestOrdinal)`"*. **That is a position in a derived array**, and the array is derived by `buildReaderRequests` from a residue built from a `Map`'s insertion order, filtered by an **equality** test (`model/reconciliation.ts:2413`) and bounded by a cap that **drops a subject entirely** when exceeded — **five iteration orders, three of them internal to functions no document flags as frozen.** Under the positional key the first stored verdict froze all five into a persisted contract. **RULED: `(tenantId, subjectKey, candidateWitness)` identifies the VERDICT; `requestOrdinal` LABELS the act** — which satisfies G121's *"every reader act carrying it plus its `requestOrdinal`"* verbatim, and serves G120's stated purpose (*a rerun REPLAYS stored verdicts rather than re-asking*) better than G120's letter did. 🟢 **What it dissolves:** the five frozen iteration orders; a tolerance edit stranding paid calls on unbindable rows; and a rerun under `reason: 'rule_changed'` paying again for verdicts still valid for their pair. 🛑 **What it does NOT dissolve, and each is a live defect:** the verdicts' **application order** is load-bearing under any key, because `applyReaderVerdicts` is a moving fold (`:2451`, `:2456`) and two verdicts can legitimately name one candidate; a content key does not stop **two live workers** making two paid calls, so a `claim_id` fence is still required; and **`candidateWitness` must be derived from PINNED input** — the identifier normalisation is caller-supplied configuration, so `RunPlan` must pin `pairing`, `strategyBindings` and both `PopulationBinding`s or the key itself is unstable. 🛑 **Hence the sequencing, and the reason is the PLAN, not the witness:** the witness strings are money-free, but a plan carrying the per-strategy tolerances is money-bearing, and `canonicalise()` **refuses** `bigint` rather than inventing an encoding (`model/canonical.ts:66-71`) because that would be *"a SECOND answer to how money is represented, on the bytes an audit chain signs."* **So no document may say the plan is hashed until the codec exists**, and until then the pinning control detects an honest change and **not tampering** | not applied |

---

## 10. Record corrections found while adjudicating

**Not applied here.** Logged for whoever writes next. ⚠️ **`tools/check-doc-counts.mjs` governs almost
none of them** — most have no number in them, and **`docs/build/` is not scanned by it at all**, so
every count in the nine stateless documents is checked by nobody. Each was verified by me at
`ece079d2`.

### 10.1 🛑 `.github/` EXISTS and `npm run check` DOES run `npm test`. `CLAUDE.md` says both are false.

`CLAUDE.md` states, on G95/G108/G110: *"🛑 **None of this is built. There is still no `.github/` on
this branch**, and `npm run check` does not yet run `npm test`."* ✅ **Both halves are now false:**

```bash
ls .github/workflows/          # check.yml
grep '"check":' package.json   # … && npm run check:wire && npm run check:packs && npm test
```

The workflow is a single `npm run check` step and says of itself *"DO NOT ADD A STEP HERE"*;
`tests/ci/gate.test.ts:61` declares `CHECKERS_THE_WORKFLOW_MAY_NOT_NAME` with seven entries and fails
if the workflow names one. **G95, G108 and G110's CI half are substantially applied.** ⚠️ **And
`CLAUDE.md`'s earlier sentence that G96–G113 are "NOT ONE applied" is false with them.** The correction
is a replacement, not a deletion — the reasoning it carries about *how* CI must land still governs.

### 10.2 🛑 `model/canonical.ts` asserts a retype that has not happened

`model/canonical.ts:66-71` reads *"**After G65 `Money.amountMinor` is `bigint`**, and G111 rules that
EXACTLY ONE money codec owns the representation."* ✅ **At the tree, `model/domain.ts:535` is
`amountMinor: number`.** The refusal of `bigint` is correct and load-bearing; the sentence stating the
retype **as fact** is not, and `red-user-artifacts` S4 built a present-tense runtime throw on it (§2.7
strikes that half). **The narrower true statement is *"once G65 applies"*.** `stateless-application.md`
inherits the same error verbatim.

### 10.3 `model/domain.ts:1185`'s ⚠️ is stale, and it is the argument for a control that now has a witness

`model/domain.ts:1185` reads *"⚠️ THIS EXISTS BECAUSE NOTHING IN `model/` CONSTRUCTS A
`RetentionPolicy`."* ✅ `PLACEHOLDER_RETENTION_POLICY` at `model/examples.ts:534` constructs one. The
comment's **conclusion** is still right — the compile-time proof should stay — but its stated reason has
gone false, which matters because a fourteenth retention class now fails in **two** places rather than
none. Red-user-artifacts N5 found this and correctly filed it as belonging in `model/domain.ts`.

### 10.4 Four governed counts are stale in the pass's own documents

| Claim | Where | Tree |
|---|---|---|
| `# 832 exports` | `stateless-application.md` §0 and §5 | **834** — `grep -h '^export ' model/*.ts \| wc -l` |
| `35 applied` G rows | `stateless-application.md` §0 | **35** ✅ still holds; **131 rows** ✅ still holds |
| `666 tests pass` | `stateless-red-state-audit.md` §0 | Not re-counted by me; `docs/HANDOFF.md:157` says **635**, so **at least one of the two is stale and neither is governed** |
| `capabilities \| 36` | `docs/HANDOFF.md:223` | **37** — `awk '/^export const CAPABILITIES = \{/,/^\}/' model/access.ts \| grep -cE '^  [a-zA-Z]+:'`. `check-doc-counts.mjs` exits 0, so this line is classified rather than failing — **do not bulk-edit it; read the run** |

### 10.5 Two SUSPECT-class citation drifts I hit while opening premises

- `docs/contracts/capability.openapi.yaml:2231` is `name: Idempotency-Key`; two reports cite `:2230`.
  One line, resolves to something, invisible to `check-citations.mjs` by its own design.
- `red-session` B1 cites `Membership`'s fields at `model/domain.ts:1448-1450`; the interface opens at
  `:1440` and the three fields are at `:1450-1452` in the file I opened. Same class.

**Neither changes an argument. Both are the class `docs/HANDOFF.md` §7 records as invisible to the
citation checker, because a drifted citation still resolves.**

### 10.6 The synthesis silently corrected its own sources in two places, without attribution

`stateless-application.md` prints `GRANT SELECT, INSERT, UPDATE ON session` with *"No DELETE"* where
`stateless-green-session.md` grants `DELETE`; and it prints *"the lease is the transaction, so no lease
TYPE is needed and adding one is a defect"* on one page while printing green-resumable's
`lease_expires_at` column, reaper and claim interval on another. **A synthesis that corrects a source
must say it did**, or the next reader cannot tell which document to trust. RULED 4 and RULED 11 resolve
both; **§0's banner claim that it *"names both and leaves it open"* is not true of these two.**

### 10.7 What I could not verify

- **No SQL in any of the nine documents has been run.** No PostgreSQL was reached by any report or by
  me. Generated columns, partial indexes, `GENERATED ALWAYS AS`, the `SECURITY DEFINER` alternative and
  every predicate are **written and read, never executed.**
- **The transaction isolation level is named nowhere** — not in `0001`, not in any test I opened, not in
  any design. Red-session S6's single-use argument is correct under READ COMMITTED, and the level is
  unstated.
- **What the `pg` driver returns for a `timestamptz`** in this repository. The shim is hand-written and
  no test reads a timestamp column. §4.1.
- **Whether `check-wire-mirror.mjs` can reach an inline-enum property**, so the sixth pair may not be
  addable as green-resumable states.
- **Whether `ChainAnchor`'s dispute-evidence property survives a partition axis.** §3.2.
- **Whether the register order behind a multi-row selection is deterministic** — red-user-artifacts
  could not verify it and neither could I, so artifact #6's *"re-findable"* defence is unsupported.
- **No number, TTL, threshold or price is stated anywhere above** except the two derived from the tree:
  `MAX_AUTHORIZATION_SECONDS.tenant_data = 900` (`model/access.ts:1530`) and the thirty-seven
  capabilities. Every other bound in every design is required configuration that refuses on absence.
- 🛑 **THE GATE IS RED AT THE MOMENT OF WRITING, AND NOT BECAUSE OF THIS DOCUMENT.**
  `npm run check` → **EXIT 1**, on `check:counts` reporting **10 STALE lines**. ✅ **Zero of them are
  in `docs/build/`** — that directory is not scanned by `check-doc-counts.mjs` at all — and this file
  contributes none. The cause is a **concurrent pass whose work is uncommitted**: `git status` shows
  `docs/contracts/data-plane-local.openapi.yaml` as new (3 operations, 3 paths),
  `docs/contracts/control-plane.openapi.yaml` modified, and `model/observability.ts` +53 lines. That
  moves three governed totals — **contract operations 65 → 70, contract paths 62 → 67, exports 832 →
  834** — and every document stating the old figures went STALE together. ⚠️ **So §10.4's `834` is a
  moving number, not a landmark: re-derive it.** The remaining checkers pass individually:
  `tsc -p model/tsconfig.json --noEmit` → EXIT 0 · `check:citations` → **DEAD 0** · `check:wire` →
  EXIT 0 · `check:packs` → EXIT 0. **The count sweep belongs to whoever lands the fifth contract file,
  and it is not mine to make.**
- **What NO agent designed, stated plainly:** the post-authentication second-factor **challenge** row;
  the `Idempotency-Key` **replay record** the wire already promises and already has an error code for;
  failed-attempt and lockout counters; the inbound multipart **buffer**; a rule against **node identity
  written into durable state**; and the **join between the distributed map's retry and the queue row's
  `attempts`**. Six gaps, and the last one is created by an owner ruling rather than missed by a team.
