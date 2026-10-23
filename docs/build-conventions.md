# Build conventions — dependencies, types, and accessibility

> **STATUS:** LIVING CONTROL
> **V1 AUTHORITY:** YES — for dependencies, type conventions, accessibility and device targets. It does not decide product scope.
> Maintained, and expected to stay current. If you change a choice here, change it **here first** — a stale dependency policy is worse than none, because people follow it anyway.
> *Banner added 8 Aug 2026; the paragraph below already stated this posture in prose.*
> ⚠️ **IT DOES NOT DECIDE WHERE ANY OF IT RUNS, AND SINCE 18 Sep 2026 SOMETHING
> ELSE DOES.** `docs/tech-stack.md` is the authority for compute, database
> hosting, region, CI/CD, infrastructure-as-code, tagging, observability and
> image hardening — G252–G263. **This file stays authoritative for what it
> names**: dependencies, type conventions, accessibility and device targets.
> Two rulings there reach back into this one and are stated here so nobody has
> to find them: **G259** puts `aws-cdk-lib` in `infra/`'s own manifest rather
> than the root one, and **G262** requires the runtime image to be non-root,
> read-only and pinned by digest.
> 🛑 **Rewritten 8 Aug 2026 for the rulings taken that day: G95, G96, G98, G99, G101, G103, G104, G108, G109, G110, G111, G112 — and G100, which is recorded in `docs/data-architecture.md` §4b and referenced here because it is what makes G99 survivable.** §1's one-dependency claim ended; three of §4's rows moved to §2 and a fourth decision arrived that §4 never listed; §3 gained two bans. **None of the new dependency rows is installed;** §1 has the commands that tell you what actually is.

> **The purpose of this file is to stop drift.** Every engineer and every subagent
> reads it before adding a dependency, choosing a library, or writing a component.
> It is the prose half of `package.json`; `package.json` is the enforced half.
>
> ⚠️ **This is a LIVING CONTROL, not a dated snapshot** — the opposite posture to
> `docs/v1-scope-ledger.md` and `docs/screen-pack-ledger.md`. It carries no
> staleness banner because a stale dependency policy is worse than none: people
> follow it anyway. **If you change a choice here, change it here first.**

---

## 0. The rule, stated once

**A subagent or engineer may not add a dependency. It proposes one.**

A proposal names: what it does, what it replaces, its licence, its transitive
count, and which decision below it sits under. Adding a package without that is
the defect this file exists to prevent.

**Why the rule is this strict — the evidence is in this repository's own
history.** The replaced application, at `archive/sap-line:package.json`, carried
**37 runtime dependencies**, including:

- **Four separate charting stacks** — `@visx/*`, `apexcharts` (+ `react-apexcharts`),
  `echarts` (+ `echarts-for-react`), and `recharts`.
- **Two icon libraries** — `@iconify/react` and `lucide-react`.
- **A component kit and a utility CSS framework doing the same job** — `antd`
  alongside `tailwindcss`.
- **Three packages named `i`, `npm` and `run`** — captured `npm i` typos, shipped
  to production, never noticed.

Nobody decided any of that. It accumulated, one reasonable-looking install at a
time. **That is what deviation looks like**, and it is why the answer to *"can I
just add X"* is a proposal rather than a yes.

---

## 1. What exists today

**`package.json` is deliberately almost empty**, and that is close to the finished
state for now, not a stub:

| | |
|---|---|
| `typescript` | **5.9.3**, pinned exactly — no `^`, no `~` |
| `@types/node` | pinned exactly. **G96**, 8 Aug 2026 — the first new devDependency |
| everything else | **nothing yet.** Three more packages are DECIDED and NOT installed — `pg` (G98), Drizzle (G99), a YAML parser for `tools/` (G109). See §2 |

> 🛑 **THE ONE-DEPENDENCY PROPERTY ENDED ON 8 Aug 2026, DELIBERATELY, AND THIS
> TABLE SAID OTHERWISE UNTIL THEN.** It read *"everything else | **nothing.** One
> package, 708-byte lockfile"* and *"`npm ci` now produces exactly one package."*
> **Both sentences are now false and are replaced rather than deleted**, because
> the property was real, was worth something, and was given up for a stated
> reason rather than eroded.
>
> **G96 is why.** G95's row asserts the test runner *"costs ZERO new
> dependencies, verified by spike"* — **true of RUNNING tests** (`node --test`
> strips types natively) and **false of TYPECHECKING them**: `tsc` over a
> `tests/` directory emits `TS2307: Cannot find module 'node:test'`.
>
> **Rejected, and the argument is preserved for whoever wants to reopen it:** a
> hand-written ambient `.d.ts` keeps the direct count at one — and it asserts a
> shape of *someone else's API* that we have not verified against their source.
> That is close to the invented-data line, and it is `docs/HANDOFF.md` §5.1's
> convenient-landmark shape: the declaration file is the landmark, the runtime's
> actual signatures are the property.

**Reproduce the dependency state; do not trust the table.** These are the numbers
as at 8 Aug 2026 and `package.json` is not owned by this file:

```bash
node -e "const p=require('./package.json');console.log(p.dependencies||{},p.devDependencies)"
# {} { '@types/node': '22.20.1', typescript: '5.9.3' }   — two, both dev, both exact
node -e "console.log(Object.keys(require('./package-lock.json').packages).length-1)"
# 3   — the two above plus one transitive, undici-types, pulled by @types/node
npm ci && npm run check      # typecheck + counts + citations, from a clean clone
```

⚠️ **Runtime dependencies are still ZERO, and that is the number worth
defending.** Both entries are `devDependencies`; nothing here ships. §0's proposal
rule is unchanged and applies to the next one exactly as it applied to this one.

⚠️ **The original defect this section recorded still stands as history.** Before
8 Aug 2026 the working compiler was an **untracked leftover** from the deleted
application — 421 packages in `node_modules`, gitignored — so a clean clone could
not run the repository's own first verification step. `npm ci` now produces a
lockfile-pinned tree that a clean clone reproduces.

⚠️ **`model/tsconfig.json` stays standalone**: no `extends`, no `references`,
`include: ["*.ts"]`. Verified still true. The root `package.json` supplies the
compiler; it does not own the model's configuration, and **giving
`model/tsconfig.json` an `extends` is still forbidden.** `tests/tsconfig.json` is
a second, separate project for the same reason.

**The Node floor is `>=22.18.0`** (`node -p "require('./package.json').engines.node"`),
derived from what `tools/*.mjs` and the test runner actually use — ESM, `node:`
imports, `String.matchAll`, `node --test` over TypeScript without a build step —
not a preference. ⚠️ **This section said `>=20` until 8 Aug 2026**; the floor was
raised when type-stripping under `node --test` became load-bearing. Raise it
deliberately, and say so here when you do.

---

## 2. Decided — cite the decision, do not relitigate

| Concern | Choice | Decision |
|---|---|---|
| Language, both ends | **TypeScript** | G71 |
| Backend runtime | **Node** | G71 |
| Frontend framework | **React** | G71 |
| Inference | **AWS Bedrock and SageMaker only** — no third-party model providers | G54 |
| Document extraction | **AWS Textract**, plus **SageMaker custom models** where coverage falls short | G53, G69 |
| Business intelligence | **Amazon Quick Suite**, one account per tenant | G57, G70 |
| Relational store | **PostgreSQL** (Aurora Serverless v2), **RLS not schema-per-tenant** | pass F |
| Object store · telemetry | **S3** · an external telemetry backend | pass F |
| **Postgres client** | **`pg`**, pinned exact | **G98** — ⚠️ **not installed** |
| **ORM** | **Drizzle** — typed schema, SQL-shaped queries | **G99** — ⚠️ **not installed.** Read §2.1 before writing one query |
| **Pooling mode** | **Assume TRANSACTION-MODE semantics from day one.** In-process `pg.Pool`, no external pooler, **no AWS resource in phase one** | **G101** — closes decision D3 |
| **Test runner** | **`node --test`**, with `@types/node` for the typecheck | **G95, G96** — the runner needs no package; the *typecheck* of the tests does |
| **YAML parser for `tools/`** | A real parser, pinned exact | **G109** — ⚠️ **not installed.** See §2.2 |
| **The gate** | **One command.** Every checker and `npm test` join `npm run check`; **CI runs only that** | **G108** — ⚠️ **not applied**; `check` is still three steps and `test` is still separate |
| Canonicalisation | **RFC 8785 / JCS** | G20 — ⚠️ **not applied, and irreversible after the first hash** |
| Typeface | **IBM Plex** | G34 |

> **Six of these rows landed on 8 Aug 2026 and none of them is installed.** They
> are decisions, not state. Verify state against §1's commands, not against this
> table. Reproduce the six:
> `awk '/^## 2\. Decided/,/^### 2\.1/' docs/build-conventions.md | grep -c '^| \*\*'` → **6**.

⚠️ **G34 ships with an unresolved security question and it is a dependency
question.** IBM Plex is fetched from an **unversioned Google Fonts URL with no
integrity hash**, alongside Phosphor icons on unpkg. **Self-host both, or pin with
SRI.** An unversioned third-party font URL on a financial surface is a supply-chain
dependency nobody reviewed.

### 2.1 Why Drizzle, and the `SET LOCAL` footgun that comes with it

**Why an ORM at all, rather than hand-written SQL** — and note that an earlier
option text in the same session said *"no ORM"*; **that was never a ruling and is
superseded by G99.** The argument is `docs/HANDOFF.md` §5.3, *"Two vocabularies
for one concept, diverging"*, which is the most-recurring defect class in this
record: hand-written SQL makes the table shape and `model/`'s exported types **two
vocabularies with nothing checking them**. A typed schema makes drift a **compile
error** — which is G71's structural-not-procedural argument one layer down.

**Drizzle specifically:** typed schema, SQL-shaped queries. Not an abstraction
that hides the predicate — because the predicate is the tenant boundary and it has
to stay readable.

#### The footgun — the constraint §4 recorded, now live

**This constraint was written against the ORM row while it was still undecided,
and it is carried forward verbatim rather than dropped as a spent argument:**

> *"Any candidate must be able to issue `SET LOCAL` inside the same transaction
> as every query."*

Drizzle can. **Drizzle also has the failure mode by default**, and the record
names it by name — `docs/build/red-buildability.md:347`:

> *"`SET LOCAL` outside a transaction block applies to the current statement only
> and is silently discarded. Every ORM/driver that autocommits (`pg` by default,
> Drizzle and Prisma outside `$transaction`) produces exactly this."*

🛑 **So the guard is mandatory, not a review convention.** `withTenantScope()`
opens an explicit `db.transaction()` and **no query may be issued outside it.**
That needs a **named negative control** — a test that issues a query outside the
scope helper and asserts it fails. A convention with no test is `docs/HANDOFF.md`
§5.1, *"A rule keyed on a convenient landmark instead of the property it cares
about"*: the landmark is the reviewer noticing `db.transaction(`, the property is
that the session variable is set for the statement that reads the row.

**What makes it survivable is G100**, recorded in `docs/data-architecture.md`:
**RLS denies on NULL.** A forgotten transaction then yields an empty result set —
loud, immediate, caught by the first test expecting a row — instead of a
cross-tenant read that RLS reports as success.

**Why `pg` specifically (G98):** it exposes the backend PID, which is what lets
the two-tenant isolation test assert that both queries ran on the **same** pooled
connection rather than assuming it. ⚠️ **G98 was taken ahead of its own gate and
that is recorded rather than tidied** — §4's D3 row said the client *"is
downstream of the pooler decision"* and D3 was open when `pg` was chosen. `pg` is
compatible with every pooler option so the ruling stands; the ordering was wrong,
and **G101 was taken afterwards to close the gate it jumped.**

### 2.2 Why `tools/` gets a YAML dependency (G109)

Taken **once** and inherited by every checker: wire-mirror, plane-tags,
tenantId-in-body and the capability sweep all parse the four OpenAPI files.

**The decisive argument is what those checkers are FOR.** Wire-mirror must
resolve `$ref` chains and compare enum **order** against the model; the
tenantId-in-body checker must walk nested schemas. Both need recursive
resolution, which a regex cannot do correctly — and a hand-parser that is subtly
wrong produces **a checker that passes while asserting nothing**, which is
`docs/HANDOFF.md` §5.6 *inside the tools written to catch it*.

⚠️ **This departs knowingly from `tools/planner/extract.mjs`'s zero-dependency
precedent.** §7 of the handoff already catalogues that extractor's blind spots —
it cannot see a union member or a `Record` re-key — as the price of hand-rolling.
The precedent is not being denied; it is being overruled with its cost named.

---

## 3. Banned — and each ban has a reason, not a taste

| Banned | Why |
|---|---|
| **Mastra `ee/`** | The EE licence forbids distribution and production use outside *"your own systems"*, and the agent-builder is 100% EE. **Apache-2.0 core only.** Pass B recorded that this *"needs a CI guard, not a convention"* — the guard does not exist, so the ban is currently honour-system |
| **Any third-party model provider** | G54. OpenAI, Anthropic direct, Google, Cohere, Mistral, or an aggregator — none. Bedrock and SageMaker are the whole set |
| **Any BI or dashboarding library** | G57 buys Quick Suite. `model/presentation.ts` stays dropped. **Do not add a charting library** — that is how the replaced application got four |
| **A second icon set, a second CSS system, a second date library** | One of each, ever. The replaced application had two icon sets and two styling systems |
| **A floating-point money type, anywhere** | G65. Money is `bigint` minor units. Any library that touches money and returns `number` is disqualified on that basis alone |
| **A runtime that reads tenant from a request** | Invariant 1. Any client, ORM or middleware whose tenancy story is a request parameter is disqualified |
| **Redis, ElastiCache, or any third store** | **G103**, 8 Aug 2026. Pass F ruled *"Two stores plus a telemetry backend, not three databases … No second engine"* — `grep -n 'Two stores plus a telemetry' docs/HANDOFF.md` — and `docs/persistence-design.md` §0 gives the reason: **four of the model's invariants are enforced by the store.** A cache of tenant-derived rules sits outside RLS, outside the retention table, outside the erasure plan and outside `SubjectLocation`. **If a cache is needed, the first question is whether Postgres serves it** — for the extraction-rule cache the answer was yes, as a tenant-scoped table. ⚠️ `docs/integration-options.md` separately flags Redis among the products that *"have all relicensed in recent years"*, so the licence needs re-verifying at whatever version anyone proposes |
| **A model identifier as a literal in engine code** | **G104**, 8 Aug 2026. The catalogue is the only source. G49 makes model selection a control-plane act published downward as a `ModelCatalogEntry`; the engine calls `resolveModel()`, **the only executable enforcement of invariant 7**. A bare string skips it and becomes another instance of finding E5 — `CLAUDE.md` already lists two live ones. **Changing models is a catalogue publication, not a code deploy** |

---

## 4. Undecided — and picking one unilaterally is the deviation

**These are open, they are owned, and several are already named as phase-one
decisions.** A subagent that picks one has taken a decision that was not theirs.

> 🛑 **THIS SECTION WAS ACTIVELY MISLEADING UNTIL 8 Aug 2026 AND IS CORRECTED IN
> PLACE.** It carried **seven** rows. **Three of them were decided that day** —
> the Postgres client / pooler / pooling mode row (G98, G101), the ORM row (G99),
> and the test runner row (G95, G96) — **and a fourth decision arrived that this
> section never listed at all**, a YAML parser for `tools/` (G109), added below so
> the omission is visible rather than silent. **It now carries eight rows: four
> open, four struck.** Reproduce:
> `awk '/^## 4\./,/^\*\*Record the answer/' docs/build-conventions.md | grep -c '^| \*\*\|^| ~~'` → **8**.
>
> **The decided rows are struck through in place rather than removed, because the
> *constraint* recorded against each is still binding and a deleted row takes its
> constraint with it.** The decisions are in §2; the `SET LOCAL` constraint is §2.1.
>
> **Four rows are still genuinely open — runtime validation, the backend HTTP
> framework, the frontend toolchain and the table primitive. Do not tidy those
> away.**

| Concern | Owner / gate |
|---|---|
| **Runtime validation library** (zod, valibot, typebox, …) | 🛑 **STILL OPEN — Decision D6** — *where the runtime validation boundary lives*: generated from OpenAPI, or declared from `model/`. **Types erase; nothing validates today.** Pick the boundary before the library |
| ~~**Postgres client, pooler, and pooling mode**~~ | ~~🛑 **Decision D3**~~ → **DECIDED: `pg` (G98), transaction-mode semantics assumed, no external pooler in phase one (G101). D3 IS CLOSED.** The silent failure mode this row named is unchanged and is now the reason for §2.1: *"`SET` instead of `SET LOCAL` leaves tenant state on a pooled connection and **RLS reports success**."* The row also said the client *"is downstream of the pooler decision"* — **it was chosen first, and G98 records the ordering as wrong** |
| ~~**ORM or query builder**~~ | ~~Downstream of D3.~~ → **DECIDED: Drizzle (G99).** ⚠️ **The constraint survives the decision and is now the live footgun:** *"Any candidate must be able to issue `SET LOCAL` inside the same transaction as every query."* Drizzle can — and autocommits outside `$transaction`, which is the failure. §2.1 |
| **Backend HTTP framework** | **STILL OPEN.** No decision references one |
| ~~**Test runner**~~ | ~~Phase 1A item 9 needs one for the two-tenant isolation test. Node's built-in `node:test` is a genuine candidate and adds zero dependencies.~~ → **DECIDED: `node --test` (G95).** ⚠️ **"Adds zero dependencies" was half true and G96 corrects it in §1** — zero to *run*, one to *typecheck* |
| ~~**A YAML parser for `tools/`**~~ *(never listed here; recorded for completeness)* | → **DECIDED: a real parser, pinned exact (G109).** §2.2 |
| **Frontend build tool, router, data fetching, styling** | **STILL OPEN.** `archive/sap-line` used Vite, react-router, TanStack Query and Tailwind — **that is evidence of what the team knows, not a commitment** |
| **Table primitive** | **STILL OPEN**, and it matters more here than usual: the screens are dense financial tables with numeric column alignment and a one-indent consolidation hierarchy |

**Record the answer in §2 when it is taken.** Do not leave it in a commit message.

---

## 5. Type conventions that are not negotiable

- **Money is `bigint` minor units, always** (G65). One `Money` type carrying
  `currency`, `amountMinor` and `exponent` (G66). `MoneyAmount` is deleted.
- **On the wire, money is a `string`** — `{type: string, pattern: '^-?[0-9]+$'}`.
  JSON has no bigint, and **`JSON.stringify` throws on one**, which is a feature:
  it forces the codec at the boundary instead of letting it drift.
- **Exactly ONE money codec module, and nothing else may touch the
  representation** (**G111**, 8 Aug 2026). Every boundary calls it; nothing else
  constructs a `Money` from a string or a string from a `Money`. Once G65 and G71
  have both applied, money is **not literally a shared type** — `bigint` in the
  model, decimal string on the wire — which RD-9 raised against G71's second
  argument and adjudication A3 upheld. Same shape G67 demands for
  `parseFxRate()`, and for the same reason: **correctness that lives at call
  sites is correctness that drifts**, and a single module is checkable
  mechanically. ⚠️ **Rejected, preserved: a `toJSON()` on `Money`.**
  `erasableSyntaxOnly` makes `Money` an interface with nothing to hang a method
  on, and it would suppress the `JSON.stringify` throw that the line above names
  as a **feature**.
- **The money retype follows the TYPE, not the suffix** (**G112**, 8 Aug 2026).
  G65's title names `amountMinor`, and the retype reaches `amountMinor` and
  everything reachable *through* `Money` — **not every field whose name ends in
  `Minor`.** An independent integer stays an integer until somebody argues it is
  money. Narrowest defensible blast radius; G78 already put it in its own commit
  so it stays legible. ⚠️ **That commit must NAME any field that is money-in-fact
  but not typed `Money`**, as known survivors, or the next reader believes the
  sweep was total.
- **`verbatimModuleSyntax`** — type-only imports must use `import type { … }`.
- **`erasableSyntaxOnly`** — no enums, no namespaces, no parameter properties.
  A const object plus a derived union.
- **`noUncheckedIndexedAccess`** — indexing yields `T | undefined`. Handle it.
- **Avoid `any`.**
- **Prefer a total `Record<K, V>`** over a lookup function when the key set is
  closed — but see `docs/HANDOFF.md` §5.10: a total record only bites where
  something **constructs** one.

---

## 6. Accessibility conventions — WCAG 2.2 AA

**The standard is decided** (`PRODUCT.md`). What follows are the rules that
standard produces *for these screens specifically*, because the generic advice
does not catch what this product gets wrong.

### 6.1 The status dot is decoration. The status word is the truth.

The register carries run and finding state in coloured dots — red exception,
green cleared, amber held. **The reflex is to put `aria-label="exception"` on the
dot. That is the wrong fix**: it makes a decorative element the sole carrier of
meaning and leaves the sighted-but-colourblind user with nothing.

```html
<!-- WRONG — the dot becomes the only carrier, and only for screen readers -->
<span class="dot dot--exception" aria-label="Exception"></span>

<!-- RIGHT — the state is text for everyone; the dot is decoration -->
<span class="dot dot--exception" aria-hidden="true"></span>
<span class="status">Missing leg · receipt absent</span>
```

**Every status must survive greyscale.** A shape, a glyph, or a word — not a hue
plus a tooltip.

### 6.2 Never `aria-label` an element that has visible text

WCAG 2.5.3 *Label in Name*. An `aria-label` that disagrees with the visible label
breaks voice control: the user says *"click Focus"* and nothing happens, because
the accessible name is something else. If the visible text is wrong, **fix the
visible text.**

### 6.3 The tables are real tables

`<table>` with `<caption>`, `<th scope="col">` and `<th scope="row">`. The
consolidated block in Reports indents entities one level with reconciliations
beneath — **that hierarchy must be structural, not `padding-left`**, or the
relationship exists only for sighted users.

**Do not `aria-label` individual numeric cells** to add currency. It fights the
table semantics and is read on every traversal. Put the currency in the column
header, once.

### 6.4 The dimmed register is a focus hazard, not a contrast one

`Finding.dc.html` keeps the register present at **45% opacity** rather than
covering it — deliberately, so evidence stays legible beside the decision. The
accessibility risk is not contrast; it is that **dimmed content stays focusable
and stays in the accessibility tree**, so keyboard focus lands on rows the user
believes are set aside. Use `inert` on the dimmed region while the finding panel
owns focus, and restore focus to the originating row on close.

### 6.5 Live updates are bounded, polite, and never the whole strip

The run strip updates while the operator watches. `aria-live="polite"` on a small
bounded status region — **never on the strip itself**, which would announce every
cell on every tick. A run that fails is `role="alert"`; a run that completes is
polite; a breathing dot is decoration and is `aria-hidden`.

### 6.6 The four-minute reversal window is a timer, and WCAG 2.2 has rules about timing

`role="timer"` with an accessible countdown, and the window must be extendable or
the action re-doable — a user who needs longer than four minutes to decide must
not lose the ability to reverse. **This is a product decision as much as an
implementation one** and it has not been taken.

### 6.7 Icon-only controls need names

⌘K, the bell, the connection light, the lifebuoy. Each needs an accessible name
and, where it conveys state, a text alternative for that state. The connection
light is the sharpest case: **a light that means "your ERP is unreachable" cannot
be a colour alone.**

### 6.8 Contrast is unverified, and inherits this requirement

`PRODUCT.md` records that **no palette has been established as binding** and
`docs/design-tokens.md` is binding on nothing — so no ratio here has ever been
checked against anything. **Any palette adopted later inherits WCAG 2.2 AA**:
4.5:1 for body text, 3:1 for large text and for non-text UI state indicators. The
status dots fall under the 3:1 rule, which is the one people miss.

---

## 7. Performance, and what "responsive" means on a register

**The feel this product is aiming at is not speed. It is certainty.** A controller
scanning at 08:04 needs to know that what they are looking at is today's truth. A
fast screen showing yesterday's numbers is worse than a slow one that says so.

### 7.1 The states rule — silence is never a blank

**This is the strongest product-derived rule in the file, and three separate
screens argue it independently:**

> *"A scheduled run that finds nothing still reports in with a time. Without that,
> a failed cron and a clean night look identical, which is the most dangerous state
> a reconciliation product can have."* — `Reconciliations.dc.html`
>
> *"A watched location that has seen nothing today says so, because a silent folder
> and a broken watcher look identical until a close is late."* — `Setup.dc.html`
>
> *"An empty list that says nothing else means either a quiet night or a broken
> notifier, and a finance team cannot tell which."* — `Notifications.dc.html`

**Therefore, and this binds every empty and loading state in the product:**

- **A spinner that resolves to blank is forbidden.** An empty state states **what
  was checked and when** — *"four runs, last at 03:22"* — not *"No results."*
- **A skeleton must not imply content that may not arrive.** Skeleton rows on a
  register that turns out to be empty tell the user work exists when none does.
  Prefer a real *"checking…"* with the scope named.
- **Stale is a state, and it is louder than loading.** If a figure predates the
  last completed run, say so on the figure. `Close.dc.html`'s failed-run case does
  exactly this: *"the register beneath greys because it is evidence of a different
  day."*
- **A failure displaces everything.** It takes the top of the page, states the
  **cause** rather than the symptom (*"the ERP was unreachable at 03:15"*), and
  offers only the two actions that fix it.

### 7.2 The specific performance risks, all created by decisions already taken

| Risk | Where it comes from |
|---|---|
| **RLS is per-query overhead and can defeat index usage** | Pass F chose RLS over schema-per-tenant. The register query is the hot path and it is the one every tenant runs at 08:00. **Plan the index strategy with the RLS predicate in it, not after** |
| **1,806 rows is a drawn number, not a hypothetical** | `Close.dc.html` renders *"Matched on all three legs · 1,806 lines"*. ⚠️ **But you may not paginate a column someone is comparing down** — `Reports.dc.html`'s whole argument is *"the figures stay comparable down the column"*. Virtualise; do not paginate |
| **Money arrives as strings and must become `bigint`** | G65. Thousands of `BigInt()` parses per register render. **Parse once at the boundary codec, never per cell render** |
| **A Quick Suite embed is a third-party load inside our shell** | G57. We do not control its time-to-first-paint, and its loading state is still our design problem. Give it a bounded region with our own state, not a blank rectangle |
| **Extraction is asynchronous and not request-scoped** | *"Extraction starts within seconds of the file landing"*. Band D findings appear later; the register must accept arrivals without a full refetch |
| **`Ask` streams** | Confirmed capability. Streaming needs a token-level render path that does not re-layout the transcript on every chunk |

### 7.3 Motion is already specified, and it is slow on purpose

The comps carry live timings — `tide: '13s'`, `'15s'`, `'17s'` on breathing
indicators. **These are ambient state, not feedback.** Do not speed them up to feel
snappy; a 15-second pulse says *"this is live"* and a 300ms one says *"something
happened"*, which would be a lie. All of it sits behind
`prefers-reduced-motion: reduce`.

---

## 8. Devices — fully responsive, and the register needs a second design

**Decided 8 Aug 2026: every surface adapts down to phone.** Recorded in
`PRODUCT.md`.

⚠️ **This was taken against the recommendation in an earlier revision of this
section, which argued desktop-first. The recommendation was not taken, and the
cost it named still applies** — so it is restated here as an obligation rather
than deleted as a losing argument.

**The starting point, and both commands reproduce:**

```bash
# every comp is drawn at one width (the value is HTML-escaped in data-props)
grep -oh '&quot;width&quot;:[0-9]*' Mockups/rec/*.dc.html | sort -u   # 1300
# and there is not one breakpoint in the pack
grep -oh "@media[^{]*" Mockups/rec/*.dc.html | wc -l                 # 0
```

**Eighteen comps, all 1300px, zero `@media` rules.** Responsive work starts from
nothing.

### 8.1 The register cannot reflow, and this is the whole of the difficulty

`Reports.dc.html`'s argument is that *"the figures stay comparable **down the
column**"*, and `Finding.dc.html` puts sub-rows *"in the same columns at the same
alignment, one indent deeper"*. **Column comparison is the product**, not a layout
choice — and a column comparison does not survive being stacked into cards at
375px.

**So "fully responsive" here means a second design, not a narrower first one.**
Anyone reaching for `flex-wrap` and a `@media` query on the register has
misunderstood the requirement. **That small-screen design does not exist and is
owed.** Until it does, a component that claims responsive support is claiming
something nobody has designed.

### 8.2 What the small screen must still be able to do

Derived from what each surface is *for*, and this is the brief for the design that
is owed:

| Surface | The small-screen job |
|---|---|
| **Close — the register** | Triage, not comparison. *Which findings need me, and what is the cause?* The amounts can be secondary; the **band and its owner cannot** |
| **Finding** | Decide with the evidence present. The 45%-dimmed register beside it is a desktop affordance; on a phone the evidence has to arrive **in** the panel |
| **Confirm — band D** | Genuinely good on a phone: a photo of a docket, a box, a candidate value, confirm or correct. **This may be the strongest mobile surface in the product** |
| **PostingCheck** | A yes/no with a live reading. Small-screen-friendly, and the breach's two exits must stay reachable |
| **Ask** | A conversation. Native to small screens |
| **Reports** | The CFO reads the pack. **The export already exists** — PDF and xlsx on a calendar — so the small-screen job is reaching and reading it, not rebuilding the consolidated table |
| **Tiers 2 and 3** | Authoring on a phone is rare and legitimate to defer. **Say so explicitly; do not silently degrade** |

### 8.3 Input, not just width

The register is a keyboard surface — ⌘K, focus moves, band navigation. **Touch is
an addition, not a replacement**, and the keyboard path is also §6's requirement.
Hit targets follow WCAG 2.2 AA target-size where it applies; the status dots are
**decoration and are not targets**, so the row is the target.

---

## 9. What this file cannot enforce

Stated plainly, because a convention document that implies enforcement it does not
have is worse than none:

- **Nothing checks that a dependency was proposed rather than added.** There is no
  CI. `docs/HANDOFF.md` §8 item 8 argues for the first exception and it has not
  been taken.
  > **G108 and G110 (8 Aug 2026) decide what CI will DO; neither creates it.**
  > G108: one gate — every checker and `npm test` join `npm run check`, and **CI
  > runs only that**, so nobody is green locally and red in CI. G110: the two
  > pack-publication validators get **both** call sites — CI, *and* a publication
  > seam that refuses — because a control that exists only in CI stops existing
  > the moment a pack arrives by another route, which is §5.1.
  > ⚠️ **Not applied. Reproduce:** `ls -a | grep -i github` returns nothing, and
  > `npm run check` is still `typecheck && check:counts && check:citations` with
  > `npm test` outside it
  > (`node -p "require('./package.json').scripts.check"`).
  > ⚠️ **G108's own named cost:** the gate gets slower as checkers accumulate and
  > one flaky checker blocks everything, so **each checker must be deterministic
  > and fast.**
  > ⚠️ **G110's seam is partly blocked** on `administration.openapi.yaml`, so the
  > CI call site lands first and the seam follows.
- **The Mastra `ee/` ban is honour-system.** Pass B said it *"needs a CI guard, not
  a convention"*, and this file is a convention.
- **No tool verifies a single ARIA rule above.** The screens are design comps; there
  is no frontend to run an axe pass against. **These conventions land or fail with
  the first component written.**
- **No performance budget exists.** `docs/INDEX.md` records that absence
  deliberately. §7 names the risks; **it sets no numbers**, and inventing a
  p95 target here would be the fabrication this repository forbids elsewhere.
- **The small-screen register design does not exist.** §8 decides that it must;
  nobody has drawn it, and no tool can tell you it is missing.

---

## 10. The standard, in one place

For anyone who reads only one line of this file:

| | |
|---|---|
| **Accessibility** | **WCAG 2.2 AA** — confirmed 8 Aug 2026, `PRODUCT.md`. §6 has the rules this product specifically gets wrong |
| **Language** | TypeScript, both ends. React front, Node back — G71 |
| **Money** | `bigint` minor units in the model, `string` on the wire — G65, G66 |
| **Dependencies** | **Zero runtime.** Two dev, both pinned exact: `typescript@5.9.3` and `@types/node` (G96). Three more decided and **not installed** — `pg` (G98), Drizzle (G99), a YAML parser (G109); a fourth is still open (D6, the runtime validation library). ⚠️ **This row read "One: `typescript@5.9.3`" until 8 Aug 2026.** **Adding another is still a proposal, not a decision** — §0 |
| **The database** | `pg` + Drizzle, transaction-mode semantics, `SET LOCAL` inside an explicit transaction on **every** query — G98, G99, G101, and §2.1 is not optional reading |
| **Interface language** | English only; documents are multilingual — `PRODUCT.md` |
| **Devices** | **Fully responsive** — and the register needs a *second* design, not a reflow. §8 |
