# Live browser testing — the test login, and what it can and cannot reach

> **STATUS:** RUNBOOK. It decides nothing.
> `docs/HANDOFF.md` §3 outranks it. Written 19 Sep 2026, verified end to end on
> the day it was written — every command below was run, and the outputs quoted
> are real rather than expected.

## 0 · What this buys, in one line

A real browser, with a real session, against a real plane, reading real rows out
of a real PostgreSQL through the real RLS policy. **Locally.** See §4 for what it
cannot reach and why that is deliberate.

## 1 · The four commands

```bash
npx playwright install chromium --only-shell   # once
npm run dev:plane:migrate                      # provision + migrate + seed 2 tenants, 7 runs
npm run dev:plane                              # the data plane on 127.0.0.1:8080
npm run dev:frontend                           # Vite on 5173, proxying /v1 to the plane
```

Then mint a login and put it where the app looks for it:

```bash
npm run -s token:mint ten_acme        # prints the token on stdout, banner on stderr
```

In the browser, or from Playwright's `addInitScript`:

```js
sessionStorage.setItem('reconcile.session', '<token>')
```

Open **`http://localhost:5173/?plane=http://localhost:5173`**.

## 2 · Two things that will cost you an hour if nobody says them

**The header is `X-Session`, not `Authorization: Bearer`.** A bearer token gets a
401 whose body tells you the plane accepts locally minted tokens only when
started with the flag — which is true, and is not why your request failed.

**`?plane=` is not optional here and it is not a convenience.**
`frontend/src/api/plane.ts` allow-lists which origins may RECEIVE THE SESSION
TOKEN, and the default is the plane's own origin, `http://127.0.0.1:8080` — which
is cross-origin from the dev server and therefore preflighted and blocked. Naming
the dev server as the plane keeps the request same-origin, which is what G226's
proxy is for. The allow-list exists because `fetchRuns({origin:'https://evil.example'})`
once sent a live token there; do not widen it to make something work.

## 3 · Minting is not gated; ACCEPTING is

`npm run token:mint` will happily mint against a plane that will refuse the
result. That asymmetry is deliberate and is pinned by an assertion: a perfectly
valid, correctly signed token **must** be refused by a plane started without
`RECONCILE_LOCAL_TEST_AUTH=1`. A minter that checked the flag could not produce
the token that test needs.

**G192's fence is structural, not conditional.** `server/data-plane/session.ts`
picks a resolver ONCE, at boot, and reaches `server/dev/test-token.ts` through a
DYNAMIC import that only executes when the flag is exactly `1`. A plane started
without it never LOADS the file, so there is no accepting code path in the
process to bypass. Reproduce the structural half:

```bash
grep -rn "from '\.\./dev/" server/data-plane/     # returns nothing
```

## 4 · 🛑 What this CANNOT reach, and why that is not a defect to fix

**Staging is unreachable from a browser, deliberately.** Neither ALB has an
ingress rule — `docs/build/deploy-handoff.md` §2 — because only a CloudFront VPC
origin should reach them and the `Edge` stack is not written. *"An ALB admitting
the VPC CIDR 'for now' is a fence nobody removes."* Do not add one to get a
browser onto staging.

Browser testing against a deployed environment needs the `Edge` stack, and that
stack is **blocked on an owner decision**: G277 records that the pack gives a PATH
for every public and data-plane route and gives the partner portal and staff
console **a NAME where a path should be**. Neither principal has a tenant, so
neither has a host under G179's grammar, and G180 makes a host binding
**permanent and additive**. Nobody may invent one.

## 5 · Verified, 19 Sep 2026 — the numbers are observations

The app renders: chrome bar, three destinations, the six indicators, and every
unbuilt control correctly hatched with the ruling that refused it (`G200 — no
Ask operation`, `G200 — no reporting operation`, and so on). The register's
caption flips from `NO ROWS READ · FAILED TO FETCH` to `READ FROM THE DATA PLANE`.

**Tenant isolation, witnessed through the browser rather than asserted:**

```
ten_acme  : ["run_acme_3","run_acme_2","run_acme_1"]
ten_globex: ["run_globex_4","run_globex_3","run_globex_2","run_globex_1"]
OVERLAP   : []
```

Two sessions, disjoint row sets. There is **no tenant predicate in the query and
none in the request** — the caption in the running app says so in its own voice,
and the separation above is produced entirely by the RLS policy reached through
`withTenantScope()`. ⚠️ **This is a demonstration, not the proof.** The proof is
`tests/db/tenant-isolation.test.ts`, which carries the negative controls this
cannot: with RLS disabled the same read leaks both tenants, and with the policy
dropped it fails closed. A browser cannot witness a negative control.

**And `?tenantId=` is refused on the wire**, which is invariant 1's second line
of defence and is worth seeing once:

```
GET /v1/runs?tenantId=ten_globex   →  400
```

Not silently stripped and served — which is what Fastify's default
`removeAdditional` would have done, satisfying the invariant while leaving no
evidence that it did.

## 6 · The chromium install is not only for this

Before it, **107 assertions in `tests/design/` stood down entirely** — every
computed-style check in the repository: the focus ring, the one line and one dot,
the contrast maths, the 24×24 target floor. They now run and pass. A green
`npm run check` on a machine without chromium was never evidence about any of
them, and `tools/skip-census.mjs` exists because `skipped N` does not count the
assertions inside a suite that never ran.
