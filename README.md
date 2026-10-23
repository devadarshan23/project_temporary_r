# ReconcileAI

> **STATUS:** LIVING CONTROL
> **V1 AUTHORITY:** NO — an orientation page. It points at authorities; it is not one.
> `PRODUCT.md` governs what may be claimed, `CLAUDE.md` the invariants, `docs/HANDOFF.md` §3 the decisions. ⚠️ **Its "Stage" note below predates G48**, which made v1 a **product** rather than a demo — the constraint it states is unchanged and correct (there are no paying customers and no customer results), but the framing is a build target that has moved. `docs/HANDOFF.md` §3a.
> 🛑 **Eighteen rulings were TAKEN on 8 Aug 2026 — G96 through G113 — and almost none is APPLIED.** They decide the first build phase: the Postgres client and the ORM, the id column type, the RLS null polarity, the pooling posture, the model catalogue, the reconciliation algorithm, the single gate, and one undefended field that comes off the wire. **A ruling taken is not a change made.** `docs/HANDOFF.md` §3 is the authority on all eighteen; check `model/`, `docs/contracts/` and `package.json` before assuming any of it has landed.
> *Banner added 8 Aug 2026.*

**A general reconciliation platform** from 1CloudHub. An agentic layer that
detects, *explains*, and resolves reconciliation exceptions — and gives users
conversational access to the underlying source data.

Finance/ERP is the first instance of the engine, not the whole product. See
[`PRODUCT.md`](./PRODUCT.md) for the confirmed product record.

> **Stage: sales demo / POC.** This asset is used to win engagements. Data shown
> in the product is illustrative. It is not production software serving paying
> customers, and its figures are not customer results.

---

## What is in this repository

A domain model, the design record that argues for it, and the mechanical
checkers that hold the record honest. **No application is built** — and the
three clauses that used to follow that sentence are no longer all true.

> ⚠️ **THIS PARAGRAPH READ *"no AWS resource, no schema, no deployed code"* AND
> *"**No CI is running**: `ls -d .github` fails and `git ls-files .github | wc -l`
> returns 0."* **The schema clause and both CI clauses went false on 9 Aug 2026
> and are corrected here rather than deleted**, because they are the sentences a
> reader would have trusted before skipping the directories. **A schema is
> written** — `db/migrations/0001_tenancy_and_rls.sql` — **and CI exists**,
> `.github/workflows/check.yml`; `git ls-files .github | wc -l` returns **1**,
> not 0. **What is still exactly true: no AWS resource has been created**, and
> no application code is deployed. Phase one runs against a disposable local
> Postgres. *Corrected 12 Aug 2026.*
>
> 🛑 **And that schema's topology is already amended by a ruling nothing has
> applied. G185, 12 Aug 2026** — the database splits **by residency region, not
> by plane**. Decision F's separate schemas and separate database roles
> **survive**; *"one cluster"* becomes **one cluster per residency region**;
> **`control_ro` is retired** in favour of a signed HTTPS pull into a
> data-plane-local projection; and the **`tenant` row is control-owned** with a
> narrow data-plane projection of `id`, `status`, `residency`. **None of it is
> built** —
> `grep -rn 'control_rw\|tenant_rw\|control_ro\|tenant_migrate' db/ model/`
> returns nothing and `db/migrations/` holds one file. `docs/HANDOFF.md` §3, row
> **G185**, is the authority; this page is not.

```
model/       32 TypeScript modules (`ls model/*.ts | wc -l`; ⚠️ said 31 until
             4 Oct 2026 — the thirty-second is model/publication.ts, U-29 /
             G4201, the publication seam's refusal logic for document types;
             said 29 until
             1 Oct 2026 — the thirty-first is model/partner-portal.ts, W5) — the canonical domain model, and the
             CEILING IS 30: `check-doc-counts` governs `modules` with a band of
             [8, 30] and a count above its band is SILENTLY SKIPPED, so ONE
             module of headroom remains. ⚠️ THIS SAID 25 AND THE COMMAND
             ALREADY RETURNED 28 BEFORE model/extraction.ts (E2, G1451) TOUCHED
             THE DIRECTORY — model/onboarding.ts, model/approval.ts and
             model/run-admission.ts all landed and this first word moved for
             none of them. The 28 was not E2's to make stale and is named so
             this sweep is not read as accounting for all four. THE HEADLINE IS
             THE CLAIM AND ITS OWN NARRATION BELOW IS HISTORY: `check-doc-counts`
             classified this line HISTORICAL rather than STALE precisely
             BECAUSE it carries a ⚠️, so the gate was EXIT 0 while the first
             word was three behind. ⚠️ SAID 23 AND
             THE COMMAND ALREADY RETURNED 24 BEFORE G286 TOUCHED IT; the 25th is
             model/money.ts, G111's money codec, 19 Sep 2026 (19 until
             22 Aug 2026; model/session.ts under G225 AND model/field-path.ts,
             G214's one parse seam — two modules on two branches, so the merged
             tree is 21 and neither branch computed it). `ls model/*.ts | wc -l`
db/          the first built slice — one migration, the tenant-scope seam, and
             three roles: reconcile_owner · reconcile_migrator · reconcile_app
             (NOT G185's control_rw / tenant_rw / tenant_migrate, which are
             ruled and unbuilt). `pg` is NOT in package.json
docs/        the design record, four OpenAPI contracts, ten visuals — one of
             which, docs/c4.html, is generated rather than drawn
Mockups/rec/ 18 drawn screens — 12 product surfaces, 6 design system
tools/       11 checkers — derive it, never read it:
             `node -e "console.log(Object.keys(require('./package.json').scripts).filter(k=>k.startsWith('check:')))"`
             ⚠️ **THIS SAID FIVE UNTIL 21 Sep 2026 AND NAMED FIVE BY HAND** —
             check-doc-counts · check-citations · check-wire-mirror ·
             check-pack-safety · check-c4-freshness — **while the gate had run
             ten for a day and six for weeks.** The five that were missing are
             check-g-numbers, check-migration-numbers, check-absent-rows,
             check-capability-annotations and check-clock-fixtures. 🛑 **IT IS
             CAUGHT BY A CHECKER FOR THE FIRST TIME RATHER THAN BY A PERSON**:
             `checkers` became a governed total on 21 Sep 2026 (G1471) and
             reported this line STALE on its first run, which is
             `docs/build/completion-plan.md` K2's whole argument — the count
             kept going stale because nothing derived it.
             ⚠️ A CHECKER IS A `check:*` SCRIPT AND NOT A FILE IN `tools/`:
             `citation-symbols.mjs` is a shared module and `skip-census.mjs`
             is a REPORTER that cannot fail a run, so `ls tools/*.mjs | wc -l`
             is the wrong proxy and has been wrong four times.
             — plus planner/ (the model-graph extractor and the C4 generators)
.github/     workflows/check.yml — `npm ci` then `npm run check`, nothing else
package.json the scripts that compose them; devDependencies pinned exact
assets/      the 1CloudHub wordmark
```

> ⚠️ **That block said *"`tools/` three checkers: the model graph extractor, the
> doc-counts checker and the citation checker"*, and had no `db/` and no
> `.github/` line at all, until 12 Aug 2026.** Two checkers it never named —
> `check-wire-mirror.mjs` and `check-pack-safety.mjs` — were already in
> `npm run check`, and a fifth, `check-c4-freshness.mjs`, joined them on 12 Aug.
> `tools/check-doc-counts.mjs` **cannot catch this class**: an omission has no
> number in it, which is the same failure that hid `Mockups/rec/` from this page
> until 7 Aug 2026.

Reproduce every count above, and do not copy one — this file has stated a wrong
module count and a wrong visual count before:

```bash
ls model/*.ts | wc -l                  # 18
ls docs/*.html | wc -l                 # 10
ls tools/*.mjs | wc -l                 #  5
ls Mockups/rec/*.dc.html | wc -l       # 18
git ls-files Mockups | wc -l           # 22 tracked files in total
node tools/check-doc-counts.mjs --derive   # the governed totals, from the tree
```

> ⚠️ **The first two comments read `# 16` and `#  9` until 12 Aug 2026, and both
> were wrong at the tree.** `node tools/check-doc-counts.mjs --derive` derives
> **18** modules and **10** visuals. Neither was caught by a checker: the number
> sits in a shell comment *after* the command, and
> `tools/check-doc-counts.mjs` only matches a number immediately **before** the
> noun in prose — so this page can state a wrong count inside its own
> reproduction block and stay green. `docs/HANDOFF.md` §5.11.

⚠️ **"No test framework, no CI" was this page's sentence until 8 Aug 2026 and it
is no longer the one to repeat.** **G95 rules that the test runner and CI both
land now** — the first deliberate exception to `CLAUDE.md`'s standing CI
position — on `node --test`. **G96 then ended the one-dependency property
deliberately**: `tsc` over a test directory cannot resolve `node:test` without
`@types/node`, so the first new devDependency is pinned exact rather than
dodged by hand-writing someone else's type declarations. **Read `package.json`
rather than this paragraph**; it is moving under both rulings.

**There is still no stack to list for the *application*, but the sentence people
quote from here has moved.** `docs/domain-model.md` records the backend stack as
**undecided by design** and the model as language-neutral. ⚠️ **G71 settled it —
TypeScript end to end — and on 8 Aug 2026 G98, G99 and G101 settled the Postgres
client, the ORM and the pooling posture on top of it.** `docs/build-conventions.md`
is the control, and **decided is not installed**: it says which is which.

## Verify it

The model compiles standalone, with nothing installed:

```bash
npx -y typescript@5.9.3 tsc -p model/tsconfig.json --noEmit; echo "EXIT: $?"
```

Expect `EXIT: 0`. It needs no `package.json`, no `node_modules` and no root
tsconfig — `model/tsconfig.json` is standalone and stricter than the replaced
application ever ran. Run it as its own command with absolute paths; a `cd` in a
compound shell command silently swallows it and still looks like success.

**That is not the whole verification surface, and a green typecheck is weak
evidence here** — the model is types only, so most changes cannot fail to
compile. `CLAUDE.md` lists the three things you can actually verify. The
checkers are composed into one script:

```bash
npm run          # read what `check` currently composes; it is changing
npm run check
```

⚠️ **G108 rules that every checker and `npm test` join `npm run check`, and that
CI runs only that command** — one definition of green, so nobody is green
locally and red in CI.

> ✅ **THIS READ *"**Not yet true:** run `npm run` and read whether `check`
> includes `test`. There is still no `.github/` on this branch."* **Both
> sentences went false — the gate on 9 Aug 2026, the fifth checker on 12 Aug
> 2026 — and they are corrected here rather than deleted, because a reader
> acting on them would have concluded the gate was decorative.** `npm run check`
> runs the typecheck, **five** checkers and `npm test`; `.github/workflows/check.yml`
> runs that command and nothing else. **Derive it rather than trusting this
> line, which has now been wrong twice:**
>
> ```bash
> node -e "console.log(require('./package.json').scripts.check)"
> ```
>
> ⚠️ **One honest caveat on what green means.** `tests/db/tenant-isolation.test.ts`
> skips loudly when no local Postgres answers, and `pg` is not in
> `package.json` — so a green run on a clean checkout is **not** evidence that
> tenant isolation holds.

## Run it

One command. It builds one image, starts two PostgreSQL containers, runs two
one-shot provisioning jobs, and leaves two planes listening:

```bash
docker compose up --build --wait
```

Then read a tenant's runs. The token is minted by a script and presented in the
`X-Session` header, which **is** the session:

```bash
TOKEN=$(node server/dev/mint-token.ts ten_acme)
curl -sS -H "X-Session: $TOKEN" http://127.0.0.1:9080/v1/runs

# the other seeded tenant sees a different set of rows, and no overlap
curl -sS -H "X-Session: $(node server/dev/mint-token.ts ten_globex)" \
  http://127.0.0.1:9080/v1/runs

# the control plane, which publishes downward and holds no tenant data at all
curl -sS -H "X-Session: $TOKEN" -H 'X-Schema-Version: 4' -H 'X-Engine-Version: 0.0.0-local' \
  http://127.0.0.1:9070/catalogue/packs
```

`docker compose down -v` removes the containers and both volumes. Six services:
`data-plane-db`, `data-plane-migrate`, `data-plane`, and the same three for the
control plane. The two `*-migrate` services are **one-shot jobs that exit** — they
hold the superuser and the `BYPASSRLS` migrator, and the serving services hold
neither.

### 🛑 THE TEST TOKEN IS LOCAL-ONLY TEST INFRASTRUCTURE AND MUST NEVER REACH A DEPLOYMENT

Read this before copying anything above into anything else.

`server/dev/test-token.ts` mints and verifies an HMAC-signed token, and **its
signing key is a published constant committed to this repository**
(`PUBLISHED_DEV_KEY`). That is deliberate and it is safe only because of two
fences, both of which have to hold:

1. **THE FLAG.** A plane accepts such a token only when it was **started** with
   `RECONCILE_LOCAL_TEST_AUTH=1` — exact string `1`, read once at boot. Without
   it the process never even loads the verifying module, so there is no accepting
   code path in it to reach. `Dockerfile` sets the variable nowhere and says so;
   `compose.yaml` is the only place in this repository that sets it. **Its
   absence from a task definition is the control an auditor reads.**
2. **THE LOOPBACK BINDING.** Every port `compose.yaml` publishes is prefixed
   `127.0.0.1:`. ⚠️ **This was missing until 16 Aug 2026 and the consequence was
   live:** both planes bound `0.0.0.0`, Docker's own iptables rules sit ahead of
   most host firewalls, and anyone who could route a packet to the machine could
   mint a token for any tenant — the key is public — and read that tenant's rows.
   `tests/http/local-stack-exposure.test.ts` now fails if a service carrying the
   flag ever publishes beyond loopback. It never skips.

**Anywhere real, sessions are issued by the identity provider and this module is
absent.** Do not set `RECONCILE_LOCAL_TEST_AUTH` outside this compose file, do
not add it to a Dockerfile or a task definition, and do not treat setting
`RECONCILE_LOCAL_TEST_SECRET` as a substitute for either fence — rotating a key
is not a control, and a key that looks secret invites somebody to believe it is
one.

> ⚠️ **What is and is not witnessed, since a runbook that overstates itself is
> worse than none.** The planes, the migrations, the two-tenant isolation over
> HTTP and every refusal above are exercised by `tests/http/`, which runs under
> `npm run check` against a local PostgreSQL and **skips loudly** when none
> answers. The COMPOSE FILE itself is checked structurally — service names, port
> bindings, credential inventory and the module graph behind it — by
> `tests/http/plane-separation.test.ts` and
> `tests/http/local-stack-exposure.test.ts`, neither of which skips. What no test
> here reaches is the container runtime: the **network isolation** that makes
> `data-plane-db` unresolvable inside the control plane is asserted from the
> topology, not observed from inside a running container.

## Where the old application went

This branch is a fresh orphan root cut on 6 Aug 2026. The application it replaces
is preserved on annotated tags, not deleted:

```bash
git show archive/sap-line:src/pages/Drilldown.tsx     # the SAP-line app
git show archive/design-record:docs/api-reference.md  # the old design record
git show archive/trunk-pre-rebuild:package.json       # the trunk before the cut
```

Every `src/…` path anywhere in this repository refers to `archive/sap-line:src/…`.
[`docs/salvage-ledger.md`](./docs/salvage-ledger.md) records what is worth taking
from it and what is not.

## Start here

| | |
|---|---|
| [`docs/HANDOFF.md`](./docs/HANDOFF.md) | State of play, decisions not to relitigate, open items, and the traps that cost time |
| [`docs/INDEX.md`](./docs/INDEX.md) | Every document, and how far to trust each one |
| [`CLAUDE.md`](./CLAUDE.md) | Agent configuration — and the eleven invariants the model exists to hold |
| [`PRODUCT.md`](./PRODUCT.md) | What may and may not be claimed about the product |
| [`docs/build-conventions.md`](./docs/build-conventions.md) | **Read before adding a dependency or writing a component.** Dependencies decided, banned, and undecided-with-owner — and it distinguishes *decided* from *installed* |
| [`docs/c4.html`](./docs/c4.html) | **The C4 record — four levels of zoom, and the one visual here that is GENERATED rather than drawn.** Levels 3 and 4 and the built database schema are re-derived from `model/*.ts` and `db/migrations/*.sql` by `tools/planner/render-c4-page.mjs`, and `tools/check-c4-freshness.mjs` fails `npm run check` when the committed copy disagrees with the tree. ⚠️ **Levels 1 and 2 are HAND-AUTHORED and carry exactly the staleness risk every other visual here carries** — nothing derives a container diagram from a tree with no deployed containers. The page states on its face which half is which; read that block before trusting the picture. 🛑 **It carries no staleness banner of its own**, unlike the nine drawn visuals, so nothing on the page warns a reader that its hand-authored half can rot. Its Level 1–2 database topology **is** current with **G185** — one cluster per residency region, `control_ro` retired, the `tenant` row control-owned — and says on its face that none of that is built |
| [`docs/infrastructure-risk-register.md`](./docs/infrastructure-risk-register.md) | Live security findings in the AWS account the rebuild inherits |

---

© 1CloudHub. Not for public distribution.
