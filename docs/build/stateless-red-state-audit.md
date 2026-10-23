# RED — the state audit and its checker, attacked

> **STATUS:** WORKING MATERIAL
> **V1 AUTHORITY:** NO — nothing here is a ruling. It is an adversarial reading of
> `docs/build/stateless-green-state-audit.md`, written **after** that document and with
> **no adjudication between the two**. Where this file and the green file disagree, neither
> outranks the other until the owner or an adjudicator says so.
> *Written 9 Aug 2026.*

**The owner's ruling of 9 Aug 2026 is an INPUT, not a target.** *"I want the application
stateless so it can scale without a node dependence and for ease of retry in case a node
fails. That means everything that carries state, including session data or other user
artifacts, must be committed to the database."* Nothing below attacks it. Everything below
attacks the green team's **mechanism** for holding it.

**Every attack was executed at the tree.** Where an attack needed a mutant, the mutant was
written into a throwaway copy of the tree in a scratchpad, typechecked with the repository's
own `tests/tsconfig.json`, and scanned by a **faithful prototype of the nine rules exactly as
§2.5 words them**. The prototype is a red-team instrument, not a proposal; where its reading
of the prose could differ from the green team's intent, the finding says so. No runtime figure
below is estimated: each was measured on this machine, once, and is stated with what was run.

---

## 0. The measured baseline, before any attack

```
npm run check                             4s, exit 0, 666 tests pass
node tools/check-doc-counts.mjs         419ms, exit 0
node tools/check-citations.mjs          195ms, exit 0
node tools/check-wire-mirror.mjs        110ms, exit 0
node tools/check-pack-safety.mjs        158ms, exit 0
model/ + db/                            1,145,570 bytes · 24,955 lines in model/*.ts
```

**G108's "fast" is not the problem with this proposal.** A tenth checker doing one directory
walk and one pass per file over 1.1 MB costs a fraction of the 4 s the gate already takes.
Say so plainly, because it removes the cheapest argument against building it and leaves only
the real ones.

**And the green team's clean result is real.** Re-derived independently, over `model`, `db`,
`tools` and `tests` rather than `model` alone:

```bash
grep -rnE '^(export )?(let|var) ' --include='*.ts' --include='*.mjs' model db tools tests
#   db/pg.ts:25              let cached: Promise<PgModule> | undefined
#   tools/planner/serve.mjs:457  let queue = Promise.resolve();
grep -rnE 'new Date\(\)|Date\.now\(|performance\.now\(|process\.hrtime' model/*.ts db/*.ts
grep -rnE 'setTimeout|setInterval|randomBytes|randomUUID|Math\.random|tmpdir|writeFile|createWriteStream' \
  model/*.ts db/*.ts
#   both empty
```

Two module-scope mutable bindings in the whole tree, exactly as reported. **N4 below records
the one hole in the green team's method** — its clock/random/timer/filesystem greps ran over
`model/*.ts` only, never over `db/`. I ran them over `db/` too. Clean. The claim survives; the
derivation did not cover the root the green document's own §1.7 calls out as executable.

---

## BLOCKER

### B1 — Rule 2's two-part test is SAME-FILE, so the ruling's own central case escapes by being split across two files

**Claim attacked.** §2.5 rule 2 matches a top-level container *"**AND** the same file contains
`X.set(` / `X.add(` / …"* (green document, rule table). M1 — *"the ruling's central case"* — is
`const sessions = new Map<string, PrincipalContext>()` **plus one `sessions.set(...)`**, both in
`api/context.ts`.

**The mutant that escapes.** Split it. One module declares, another mutates — which is how a
shared cache is actually written, because the point of a cache is that more than one handler
reaches it:

```ts
// api/store.ts
export const sessions = new Map<string, unknown>()

// api/escapes.ts
import { sessions } from './store.ts'
export function put(k: string, v: unknown): void { sessions.set(k, v) }
```

**Measured:** `tsc -p tests/tsconfig.json --noEmit` → exit 0. Faithful prototype of rules 1–7
over both files → **`0 findings`** on each. The rule sees the declaration with no mutation
beside it and the mutation with no declaration beside it, and reports neither.

**Why this is a BLOCKER and not a NOTED.** The green document's *"WHAT THIS CANNOT SEE"* block
is long and honest, and **it does not contain this bullet.** It names the factory call, the
dependency's own state, a class field on a singleton *constructed by a call*, sticky routing,
write-behind and browser state. A reader of that block concludes that a bare
`export const sessions = new Map()` is covered. It is covered only if nobody exports it — and
`export` is the reason to declare it at module scope in the first place.

**Fix.** Rule 2 becomes **one-part**: any module-scope mutable container is a finding. The
two-part test was introduced to spare frozen lookup tables, and that job is better done by the
type — `ReadonlyMap` / `ReadonlySet` / `readonly T[]`, which `tests/scenarios/recon-corpus.ts`
already uses for exactly these tables — so the exemption becomes *"declared `Readonly*` or
`as const`"* rather than *"not mutated in this file"*. That keeps the frozen-lookup exemption
the green team is right to want (see WR-2) and removes the file boundary as an escape.

### B2 — Rule 8's justification is refuted by the tree, and the property it claims to defend has a door it cannot see

**Claim attacked, verbatim.** Rule 8 is *"the highest-value rule in the list and the
cheapest"*, because `db/tenant-scope.ts:69`'s `TenantPool` *"makes `pool.query()` a compile
error by omission; an omission is one autocomplete away from being undone"*. M5 states the
mutation and its expected result: *"Add `query(...)` to `TenantPool` … **`tsc` stays green** —
the field is additive and nothing calls it — so this mutation is invisible to every other
control in the repository. It is the reason rule 8 exists."*

**Measured, and it is false.** I applied M5 exactly and ran the repository's own typecheck:

```
db/tenant-scope.ts(83,3): error TS2741: Property 'query' is missing in type 'Pool'
  but required in type 'TenantPool'.
tests/db/tenant-isolation.test.ts(108,9): error TS2741: Property 'query' is missing …
EXIT: 2
```

**Why.** `db/pg.d.ts:52` declares `Pool` with `connect` and `end` and **nothing else** — the
minimal six-member surface that file argues for. `createAppPool` (`db/tenant-scope.ts:79`)
returns `new Pool({…})` as a `TenantPool`, so the omission on `TenantPool` is not defended by
a comment: it is defended by a **hand-written ambient declaration that also omits `query`**,
and by the fake pool in `tests/db/tenant-isolation.test.ts`. Two independent compile errors,
one of them in the negative-control test itself. Rule 8's stated reason for existing does not
exist.

**And the property it names is not the property it checks.** The property is *"no query
outside `withTenantScope()`"*. Rule 8 checks one interface body in one path. `loadPg()` is
exported (`db/pg.ts:27`) and `db/pg.d.ts:58` declares `Client` **with** `query`, so a request
module can open an unpooled connection and issue an autocommitted statement:

```ts
const { Client } = await loadPg()
const c: Client = new Client({ host, port, database, user: ROLES.app })
await c.connect(); await c.query(sql); await c.end()
```

**Measured:** `tsc` exit 0, prototype **0 findings**, rule 8 silent. Under G100 that read
returns zero rows rather than another tenant's, so the consequence is availability rather than
leak — but rule 8 advertises a *structural* guarantee and delivers a spelling check on one
file. That is §5.1, in the rule the document calls its most valuable.

**Fix.** Delete M5's premise from the record rather than shipping a rule on it. Then choose
one: (a) drop rule 8 and give the omission a **type-level negative control** —
`tests/db/` gains a compile-refusal fixture asserting `pool.query` does not typecheck, which
is what actually holds today; or (b) re-aim the rule at the property — no `.query(` in any
scanned root outside `db/`, and inside `db/` only within `withTenantScope`'s body and the
migration/provision paths. (b) is a real rule; rule 8 as written is not.

### B3 — The `@node-local` waiver is an unbounded caller-supplied off-switch, and G79 is the precedent that refuses it

**Claim attacked.** §2.4: the marker *"costs an argument to write, which is the only thing
that keeps a waiver honest"*, and rule 9 fails a marker missing a date, an em-dash reason or a
`Reconstructible:` clause.

**The mutant is M9, and the green team wrote it themselves.** Put a well-formed marker on M1's
session Map and the run exits 0. Three clauses are satisfiable in forty characters
(`@node-local 9 Aug 2026 — hot path. Reconstructible: re-read.`), by one author, in the same
commit that introduces the defect, with no reviewer, no cap on the count, no expiry — the date
is checked for **presence**, never for recency — and no statement of who may sign one. §8 Q2
asks the owner who may sign; **until that is answered the checker's exit code is a comment
away from unconditional zero.**

`docs/HANDOFF.md:805` is the record's own precedent, and it is the same shape one axis over:
G79 created `managed_service_use` with *"**deliberately no `requireImprovementOptOut`** — a
caller-supplied off-switch on a residency check is §5.2."* A `@node-local` marker is a
caller-supplied off-switch on a statelessness check.

**And the bounded form already exists in this tree.**
`tests/scenarios/export-surface.test.ts:406` reads
`const DISAGREEING = new Set(KNOWN_DISAGREEMENTS_AT_HEAD.map(…))` — a **named, in-repo,
counted** allow-list of known deviations, so adding one is a diff to a reviewed list rather
than a comment in the file being excused.

**Fix.** The waiver is an **allow-list in the checker's own source**, keyed `{file, symbol,
rule, reason, reconstructible}`, with a test asserting its exact length (today: 1 —
`db/pg.ts:25`). The in-code marker stays, because §2.4 is right that a note on the declaration
travels with the code — but **the marker documents the waiver and does not grant it.** Adding
one then costs a diff to `tools/`, a diff to a test, and a reviewer; which is the cost the
green team says the marker imposes and it does not.

### B4 — One annotation for two different properties, and the first HTTP handler written under this design makes the gate red

**Claim attacked.** Rules 1, 2 and 7 police **node-locality** (state that another node cannot
see). Rules 3, 4, 5 and 6 police **determinism and durability** (a retry that cannot replay).
There is one waiver, named `@node-local`, whose mandatory third clause is
`Reconstructible: <how a cold node rebuilds it>`.

**The two legitimate exceptions the green document's own design forces cannot be written in
that vocabulary.**

1. **The clock at the edge.** §2.3's `resolveSession()` takes `now: Timestamp` as a
   **parameter**, correctly, mirroring `PrincipalContext.now` (`model/access.ts:1031`). A
   parameter has to be supplied by someone. The only place it can come from is a clock read in
   the request path — which is precisely the root rule 3 scans (`api/` `server/` `worker/`).
   **The first HTTP handler written under this design contains `new Date().toISOString()` and
   `npm run check` goes red.** A clock read is not node-local and is not "reconstructible"; it
   is a boundary that must be crossed exactly once.
2. **The session secret.** §2.6's `token_hash` column requires a presented bearer secret, and
   a bearer secret must come from a CSPRNG. Rule 4 matches `randomBytes(` and
   `crypto.randomUUID(`. **The mint path for the very table this document designs is a rule-4
   finding**, and its honest `Reconstructible:` clause is *"it is not, that is the point"*.

CLAUDE.md's standing position is quoted in `.github/workflows/check.yml`'s own header: *"A red
X on a repository containing no application teaches people to ignore CI."* A gate that is red
on the first handler and the first session mint gets satisfied with B3's forty-character
comment, at which point rules 1–7 are all one lazy comment away from off — which is M8's
concern pointed at the design instead of at a mutation.

This is §5.3 inside the control: **two properties, one vocabulary**, with a required clause
that is meaningful for only one of them.

**Fix.** Split the annotations and give each its own required clause —
`@node-local … Reconstructible:` for residence; `@clock-edge` and `@entropy-source` for the
determinism rules, each requiring the caller it feeds to be named (so the clock read must say
*which* pure function it supplies `now` to, which is a reviewable claim). Then exempt **one
named edge module per root by path**, in the checker's allow-list, rather than by comment — so
there is one place a clock is read and one place a secret is minted, and the count of those
places is asserted by a test.

---

## SERIOUS

### S1 — `vacuous` is per-ROOT, not per-RULE, so a rule can go permanently silent while every test stays green

**Claim attacked.** §2.5: *"Every root that does not exist is listed"*, modelled on
`tools/check-pack-safety.mjs`'s `vacuous`.

**It is not the same mechanism.** `check-pack-safety.mjs`'s vacuity is **derived from its own
counts** and cross-asserted:
`tests/ci/gate.test.ts`'s `test_the_vacuity_flag_is_derived_from_the_counts_and_cannot_disagree_with_them`
loops three fixtures asserting `vacuous.includes('procedure') === (proceduresValidated === 0)`.
The proposal's `vacuous` is a **directory listing**. It answers *"did this root exist"*, never
*"did this rule have anything to look at"*.

**The concrete case is rule 8.** It is keyed on one file path. Rename or split
`db/tenant-scope.ts` — which B2's fix or the `withSessionScope()` work in §2.6 makes likely —
and rule 8 matches nothing, reports nothing, and appears in no vacuous list. The proposed
fixture suite does not catch it either: those tests aim the checker at
`tests/tools/fixtures/stateless/` via `--root`, so they prove the rule fires **on a fixture**
and never that it is applicable to the tree. §5.6, in the rule the document ranks first.

**Fix.** `--json` gains a per-rule `{rule, candidatesExamined, findings}`; any rule with
`candidatesExamined === 0` on a real-tree run joins `vacuous` by derivation, not by hand; and
a real-tree test asserts rule 8 examined `db/tenant-scope.ts` specifically. Same discipline as
the green team's own `filesScanned >= 1` assertion on `clean.ts`, one level down.

### S2 — Eleven measured escapes from rules 1–7, all `tsc`-clean, of which the "cannot see" block names three

One module, written the way a Node service is actually written. `tsc -p tests/tsconfig.json`
→ **exit 0**. Faithful prototype of rules 1–7 → **`0 findings`**.

| # | The mutant, verbatim | Named in "cannot see"? |
|---|---|---|
| 1 | `export const bump = (() => { let n = 0; return () => (n += 1) })()` — the `let` is indented, so rule 1's column-0 anchor misses; the initialiser is not a container literal, so rule 2 misses | no |
| 2 | `const byTenant: Record<string, unknown> = Object.create(null)` + `byTenant[t] = v` | no — only the *factory call* bullet, and this is not a factory |
| 3 | `const HOLDER = Object.freeze({ cache: new Map() })` + `HOLDER.cache.set(…)` | no |
| 4 | `const d = new Date` — **legal JS, no parentheses.** Rule 3 matches `new Date()` | no |
| 5 | `import { tmpdir } from 'node:os'` then `tmpdir()`. Rule 5 matches `os.tmpdir(` | no |
| 6 | `import { writeFile } from 'node:fs/promises'`. Rule 5 lists **only** `writeFileSync(` — the sync spelling, which is the one a service does *not* use | no |
| 7 | `setImmediate(fn)` · `process.nextTick(fn)` · `AbortSignal.timeout(ms)`. Rule 6 lists only `setTimeout(`/`setInterval(` | no |
| 8 | `const g = globalThis as unknown as Record<string, unknown>; g['x'] = v`. Rule 7 needs `globalThis.`/`global.` on an assignment LHS | it is called *"the module-scope rules' escape hatch"*, which is the claim this refutes |
| 9 | `class SessionCache { static readonly entries = new Map() }` — a static field needs no construction at all | partly: the bullet says *"a class field on a singleton **constructed at module scope by a call**"* |
| 10 | `process.pid` / `os.hostname()` written into a durable claim row — node identity persisted, which is node dependence in the database | no, and **no rule addresses it** |
| 11 | A library id mint — `uuid`'s `v4()`, `nanoid()`. Rule 4 lists node and webcrypto spellings only | partly: *"state inside a DEPENDENCY"* is a different claim |

**These are what an AST buys.** The green team chose a line grep, which is defensible for
speed and for zero dependencies — but then **the "cannot see" block must name every one of
them**, because a limitation that is not listed reads as coverage. Eight of eleven are absent
from it. Fix: either move to a real parse (TypeScript is already a devDependency at
`5.9.3`, so `ts.createSourceFile` costs no new dependency and would close 1, 2, 3, 9 and 11
outright), or extend the token lists **and** the disclosure.

### S3 — Rule 9 is the one rule that must read comments, so it inherits the exact defect comment-stripping was added to prevent

§2.5 strips comments before every rule *"not as an optimisation"* but because of
`model/reconciliation.ts:10-11`: the first version of that header's controls reported non-zero
on six of nine, and *"every hit was this header quoting the thing it bans."*

Rule 9 **cannot** benefit from that fix: a `@node-local` marker *is* a comment. So the moment
someone documents the marker convention in a `model/` or `db/` file header — which is exactly
where this repository puts its standing controls, `model/reconciliation.ts` being the model —
the checker goes red on its own documentation, with `malformed_waiver`, and the remedy is to
stop documenting it.

Two more, smaller: the required reason separator is `—`, a non-ASCII em dash, so a hand-typed
hyphen is a **false** `malformed_waiver` on a correct waiver; and **the marker-to-declaration
binding rule is never stated.** Nothing in §2.4 or §2.5 says whether a marker waives the next
declaration, the next finding, or every finding below it in the file. If it is "the file", the
waiver is file-wide and B3 is worse than stated. Unspecified, so: not verified, and it must be
specified before a line is written.

### S4 — False positives on legitimate patterns, which is what actually kills a gate

| Legitimate pattern | Fires | Why it is legitimate |
|---|---|---|
| A module-level index built by a loop: `const INDEX = new Map(); for (const e of ENTRIES) INDEX.set(e.k, e)` | rule 2 | Deterministic, immutable after init, tenant-free — the natural way to derive a lookup from one of this repository's total `Record`s |
| A retry backoff: `await new Promise(r => setTimeout(r, ms))` | rule 6 | This is **"ease of retry"** — the second half of the owner's ruling — flagged by a rule written to serve the first half |
| A worker poll loop's sleep between polls | rule 6 | The green document's own rule-6 rationale says the outbox poll is fine because its *position* is a row. The position is a row; the **sleep** is still a timer |
| Streaming an export with `createWriteStream` to a non-local sink | rule 5 | The rule matches the call, not the destination |
| `console.log(new Date().toISOString())` in a logger | rule 3 | A log line's timestamp is not a decision input |

Rules 3, 4 and 6 will each produce a legitimate finding on the first real service module. B4
is the structural version of this; S4 is the list.

### S5 — What the audit missed, on the surface the ruling itself creates

The green document's §7 is honest about six unsolved items. These six are not among them, and
each is state the ruling forces into the database with no table proposed.

1. 🛑 **The OIDC / SAML pre-session record — the largest miss.**
   `IDENTITY_PROTOCOLS` (`model/domain.ts:1337`) declares `saml`, `oidc` and `cognitoPool`.
   An OIDC authorization-code flow must persist `state`, `nonce` and the PKCE `code_verifier`
   between the redirect **out** and the callback **in**; a SAML flow must persist the
   `AuthnRequest` id for `InResponseTo` validation and an assertion-id replay set. **The
   callback lands on whichever node the load balancer picks**, so under the ruling every one
   of those is a durable row — and it must be **single-use**, which makes it a row with a
   consume-once predicate, not a cache. §2.6 designs `session` and `session_id_for_token()`
   and never mentions the table that has to exist **before** a session does. Verified absent:
   `grep -rniE 'pkce|code_verifier|nonce|redirect_uri|authorization_code' model/*.ts` → 0.
2. **The `Idempotency-Key` replay record.** The header is on four operations
   (`docs/contracts/capability.openapi.yaml:2230`) with a 409 at `:2260`. Honouring it requires
   a durable key → outcome record; §1.5 lists the header as *"already on the wire"* and
   proposes no home for the record. The natural implementation is the in-memory map the ruling
   forbids, in the one place a retry is guaranteed to arrive.
3. **Failed-attempt / lockout counters.** `SessionRejection`'s eleven arms contain no
   `too_many_attempts`, and the `session` table has no counter. Verified absent from the whole
   model: `grep -rniE 'lockout|failed_attempt|rate.?limit' model/*.ts` → 0. A per-principal
   counter is the canonical in-memory map.
4. **The pending second-factor challenge.** `second_factor_at` is a column and
   `second_factor_required` is a rejection arm, but the **challenge** — a TOTP window nonce, a
   WebAuthn challenge — is single-use per-request state with no row. A challenge that is not
   consumed-once is replayable, so this is a security gap and not only a statelessness one.
5. **In-flight uploads.** §6.4 forbids a temp file *for a parser* and reinforces O-6. It says
   nothing about **buffering an inbound multipart upload** before it reaches the landing
   bucket. That buffer is process-local state on the request path, it is the one place rule 5
   would be argued away on grounds of necessity, and it is unaddressed.
6. **Node identity written into durable state.** Nothing in the nine rules stops
   `os.hostname()` or `process.pid` being stamped on a claim, lease or work row. That is node
   dependence achieved *through* the database — the ruling's own failure mode, arriving by the
   route the checker declares clean.

### S6 — §5.3 inside one proposed signature: a boolean where the model declares a union

§2.3's `resolveSession()` takes
`connection: { id: IdentityConnectionId; enabled: boolean; owner: … }`.
`IdentityConnection.status` is `'active' | 'disabled'` (`model/domain.ts:1384`). The
**adjacent** parameter mirrors the model correctly — `subject: { userId; status: 'active' |
'disabled' }`, matching `User.status` (`model/domain.ts:1409`). So one field in one object
literal flattens a named two-arm union to a boolean while its neighbour does not, in a
signature whose own comment says *"a reasoned union, never a boolean (§5.2)"*. Fix:
`status: 'active' | 'disabled'`, and the rejection arm `connection_disabled` then reads off the
arm rather than off an inversion.

---

## NOTED

- **N1 — Determinism, partly.** Findings are sorted by `(file, line, rule)`; `waived` and
  `vacuous` ordering is unstated, and `readdirSync` is not sorted by contract — the tree's own
  `tools/check-citations.mjs` already lets directory order reach its output. Sort all three
  lists and the byte-identical claim holds. Also: the checker must print no clock and no
  duration, which the green team says and which the output sample honours.
- **N2 — G108 stays per-checker rather than becoming mechanical.** `tests/ci/gate.test.ts:61`'s
  `CHECKERS_THE_WORKFLOW_MAY_NOT_NAME` is a hand-maintained list, and the two assertions the
  green team adds are also hand-maintained. The stronger form asserts the property: **every
  `check:*` script in `package.json` appears in `check`**. Nothing asserts that today, so a
  tenth checker can be added to `package.json`, omitted from `check`, and no test fails.
- **N3 — Neither the green document nor this one is governed by the counts checker.**
  `tools/check-doc-counts.mjs`'s targets are `CLAUDE.md`, `PRODUCT.md`, `README.md`,
  `docs/*.md` (non-recursive) and `docs/contracts/README.md`. **`docs/build/` is not scanned.**
  `tools/check-citations.mjs` does scan `docs/build/`. So a citation here is checked and a
  count here is checked by nobody — which is why every number in this file ships with the
  command that produced it.
- **N4 — The green audit's derivation covered one root.** Its §0 and its appendix run the
  clock, random, timer and filesystem greps over `model/*.ts` only, while its own §1.7 argues
  `db/` is the executable root that matters. I ran them over `db/*.ts`: clean. The conclusion
  was right; the evidence for it was narrower than the conclusion.
- **N5 — Two of the green document's citations land on `*/`.**
  `tools/check-pack-safety.mjs:47` and `tests/ci/gate.test.ts:60` are both the closing marker
  of the block above the thing cited (the `--corpus` usage line, and
  `CHECKERS_THE_WORKFLOW_MAY_NOT_NAME` at `:61`). SUSPECT-class drift, one line each,
  invisible to `check-citations.mjs` by its own design (`tools/check-citations.mjs:17`) — and
  the green document's §1.9 catalogues five worse instances of the same class in P1, so it
  knows the shape.
- **N6 — Attacks I attempted and STRUCK, recorded so nobody re-runs them.** (i) *"Rule 2
  misses `WeakMap`"* — it does not; `WeakMap`/`WeakSet` are in the rule and my prototype fired
  on `const seen = new WeakMap(); seen.set(…)`. (ii) *"Rule 2 misses `const c = {}` used as a
  cache"* — it does not; `export const rowCache: {…} = {}` with `rowCache[k] = v` fired.
  (iii) *"§1.5's `Idempotency-Key` citations are to the wrong file"* — they are correct;
  `docs/contracts/capability.openapi.yaml:2230` and `:2260` both resolve to exactly what is
  quoted, and my first grep was truncated by a `head`. (iv) *"§7 item 1 overstates the
  cleanliness"* — it does not; see WR-6.

---

## WHERE THE GREEN TEAM IS RIGHT AND I COULD NOT BREAK IT

- **WR-1 — The clean-tree finding is correct, and it is the finding.** Re-derived over four
  roots rather than one (§0). Exactly two module-scope mutable bindings, both correctly
  classified: `db/pg.ts:25` permitted, `tools/planner/serve.mjs:457` out of scope. Zero clock
  reads, zero randomness, zero timers, zero filesystem writes in `model/` **and** `db/`. The
  argument that follows — the rule is cheap to adopt now and expensive later — stands.
- **WR-2 — Rule 2's two-part test genuinely does exempt a frozen lookup.** I built a
  module-level `Set` read with `.has(` and never mutated: no finding. The brief's two
  hypothesised misses against rule 2 both fail as attacks (N6). Within one file, the only
  escape I found is the factory call, **which the green team already discloses.** B1 is a
  boundary problem, not a rule-2 logic problem.
- **WR-3 — Rule 3's `new Date(x)` versus `new Date()` distinction is exactly right**, and it
  is what keeps the tree clean rather than noisy: `model/access.ts:1715` and
  `model/observability.ts:330` are arithmetic over supplied timestamps and are correctly
  unflagged. Getting this wrong would have made `model/` red on day one.
- **WR-4 — §1.7 is correct about `TenantPool`, and B2 does not touch it.** `TenantPool`
  (`db/tenant-scope.ts:69`) genuinely has no `query`, `pool.query(...)` genuinely is a compile
  error, and nothing is wrapped at runtime. The green document is right in §1.7 and wrong in
  §2.5 rule 8 about the same object — the defect is the checker rule, not the reading of the
  code.
- **WR-5 — §1.4 (the transaction is the lease) survives every attack I could put on it**, and
  the `EntitlementLease` warning (`model/billing.ts:580`) is the right one to have written
  down: it is signed, it carries a clock, and it would have been reached for.
- **WR-6 — §7 item 1 is honest and verified.** `grep -rn 'schemaMappingCache'` over the tree
  returns hits **only inside the green document itself**. The committed ingestion pipeline
  contains no module-level cache. The flagship justification for the checker is a *proposal*
  that was adjudicated out, and the green team says so in those words rather than reporting a
  finding it could not reproduce. **This is the single most creditable paragraph in the
  document**, and it is also the honest answer to *"why build the checker"*: not because the
  tree is dirty, but because the proposal that was refused will be made again.
- **WR-7 — §2.6's bootstrap problem is real, correctly stated, and correctly solved.** The
  predicate cannot find the id it needs, the `SECURITY DEFINER` function returning **one
  scalar** is the right shape, and the rejected alternatives are the right ones to reject. I
  could not find a cheaper correct answer.
- **WR-8 — §6.1 is the most valuable section in the document and I could not weaken it.** The
  hash chain becoming a per-tenant serialisation point, the observation that *an average is not
  a lock-contention argument*, and the **irreversibility window** — decide partitioning before
  the first chain row exists — are all correct and all urgent. If the owner reads one section,
  it is that one, and nothing in this red pass reduces it.
- **WR-9 — The paired-fixture discipline demanded for the checker's own tests is the right
  ask**, taken from `tests/ci/gate.test.ts`'s own standard, and the `filesScanned >= 1`
  assertion on the clean fixture is the detail that separates a real suite from a decorative
  one.
- **WR-10 — Speed is not a problem.** Measured: the gate is 4 s; the four existing checkers
  are 110–419 ms; the tree the new one would scan is 1.1 MB. G108's "fast" condition is met.

---

## Verdict — should this checker be built in its proposed form?

**No. Built, yes — in this form, no**, and the reason is not that it is weak. It is that in
this form it would be **trusted**, and its two loudest claims are the two that do not hold:
rule 8 is advertised as the highest-value rule on a premise the compiler refutes (B2), and
rule 2 is advertised as catching the ruling's central case while missing it whenever the cache
is exported (B1). A checker nobody trusts is worse than no checker; **a checker that is
trusted and wrong is worse than both**, because it retires the human reading that was catching
these things — and `docs/HANDOFF.md` §5.6 exists in this repository because that has already
happened here.

Four changes, and none is large:

1. **Rule 2 becomes one-part**, with the exemption keyed on `Readonly*` / `as const` in the
   type rather than on "not mutated in this file". (B1)
2. **Rule 8 is deleted or re-aimed at the property**, and M5's claim is struck from the record
   with the measured compiler output beside it. (B2)
3. **The waiver becomes a counted allow-list in the checker's source**, length asserted by a
   test, with the in-code marker as documentation that does not by itself grant anything. (B3)
4. **The determinism rules get their own annotation and one named edge module per root**, or
   the gate is red on the first handler and the first session mint. (B4)

Then two more before it can be believed: **per-rule vacuity derived from per-rule counts**
(S1), and a **"cannot see" block that names all eleven measured escapes** rather than three
(S2). With those six, this is a good control on a clean tree, adopted in the only window where
adoption is free — which is the green team's own argument, and it is right.

**What must not wait for any of this.** §6.1's `RecordChain` partitioning window is open now
and closes at the first chain row; S5 item 1 — the OIDC/SAML pre-session record — is a table
that has to exist before `session` does, and neither document has claimed it. Both are owner
decisions. Neither is blocked on a checker.
