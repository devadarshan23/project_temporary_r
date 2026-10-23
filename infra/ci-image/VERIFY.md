# Witnessing this image RED before anything depends on it — G258

> **STATUS:** ACCEPTANCE PROTOCOL — a runbook for a person, run once per image
> that a pipeline is about to trust, and again after any change to the
> `Dockerfile`.
> **V1 AUTHORITY:** NO. `docs/HANDOFF.md` §3 outranks it. It decides nothing; it
> says what must be OBSERVED, and what does not count as an observation.
> **Written 18 Sep 2026**, against `docs/tech-stack-authority`.

🛑 **G258's acceptance condition is not optional and is not a formality.** *"A
checker — or a machine — added to the gate without a demonstrated red is §5.6
wearing a different hat."* The same condition G108 attaches to every checker,
applied to a machine: **the dependency's absence must be observed costing an exit
code, on this image, before any CodeBuild project points at it.**

---

## 0 · The finding that changes the protocol — read this before running anything

🛑 **G258's row names `tests/ci/reachability-guards.test.ts` as the file to
observe failing with chromium removed. THAT FILE IS GREEN WITH OR WITHOUT A
BROWSER, BY DESIGN, AND IT SAYS SO IN ITS OWN FIXTURE.** This is recorded here
rather than worked around, because somebody following the row literally will
observe a pass, read it as the red-first condition met, and have witnessed
nothing.

`tests/ci/fixtures/reachability/browser-guard.fixture.ts`, in full:

> *"The verdict is passed in rather than probed for, because launching a browser
> here would make this fixture slow and would test `browserSkip()` a second time
> instead of testing the guard."*

So that file proves **the guard turns a bad verdict into an exit code** — which
is exactly what it was written to prove, and it is worth running — but it never
asks the machine anything. Reproduce the point rather than believing this
paragraph:

```bash
# Both of these PASS on a machine with no browser at all.
CI=true node --test tests/ci/reachability-guards.test.ts; echo "EXIT: $?"
```

**What actually bites on this machine is the pair of guards inside a REAL suite**
— `browserSkip()`'s verdict in `tests/design/*`, and `probeDatabase()`'s in
`tests/db/*` and `tests/http/*`. §2 and §3 below witness those, and they are the
observation G258 is asking for. The row's wording is narrower than its intent;
**the intent is the one that governs.**

---

## 1 · Build the image, and read what its own build asserted

```bash
cd <repository root>          # the build context IS the root — see the Dockerfile header
docker build --platform linux/arm64 -f infra/ci-image/Dockerfile -t reconcile-ci:local .
```

The build itself refuses to finish unless four things hold. They are listed here
so a green build is read for what it says rather than as a vibe:

| Step | What it refused to ship |
|---|---|
| 1 | a base that is not `aarch64`, or not the AL2023 release the digest names |
| 3 | a Node that does not satisfy `engines.node`, or a `postgres` that is not 17 |
| 4 | a cluster that does not accept a TCP connection as `postgres` with no password |
| 6 | a chromium that cannot render a page and return a computed style |

⚠️ **None of those four is the red-first witness.** Every one of them is a claim
that the dependency IS there. That its ABSENCE costs an exit code is a different
sentence, and §2 and §3 are where it is observed.

---

## 2 · The browser — RED with it removed, GREEN with it present

**One suite is enough and a narrow one is better**, because the point is the exit
code and not the coverage. `tests/design/kernel-under-tailwind.test.ts` needs the
kernel and the Tailwind CLI and **not** the frontend build, so it is the cheapest
honest witness.

```bash
docker run --rm -it -v "$PWD:/src" -w /src reconcile-ci:local bash
```

Inside the container:

```bash
npm ci

# ── GREEN: the browser is present, under CI ────────────────────────────────
CI=true node --test tests/design/kernel-under-tailwind.test.ts; echo "EXIT: $?"
#   EXIT: 0
#   and the run must contain the guard PASSING:
#     ✔ under CI, a browser is reachable — …

# ── RED: the same command with the browser taken away ─────────────────────
mv "$PLAYWRIGHT_BROWSERS_PATH" "${PLAYWRIGHT_BROWSERS_PATH}.hidden"
CI=true node --test tests/design/kernel-under-tailwind.test.ts; echo "EXIT: $?"
#   EXIT: 1
#   and the failure must name what did not run:
#     ✖ under CI, a browser is reachable — …
#       … DID NOT RUN, UNDER CI … COMPUTED STYLE …

# ── AND THE CONTROL THAT KEEPS THE GUARD HONEST OFF CI ────────────────────
node --test tests/design/kernel-under-tailwind.test.ts; echo "EXIT: $?"
#   EXIT: 0 — with the browser still hidden. A contributor with no chromium
#   must still get a runnable suite; tests/reachability.ts conditions the guard
#   on CI deliberately, and a run that went red here would mean the condition
#   had been broken rather than the guard strengthened.

mv "${PLAYWRIGHT_BROWSERS_PATH}.hidden" "$PLAYWRIGHT_BROWSERS_PATH"
```

🛑 **`EXIT: 1` in the middle of that sequence IS THE ACCEPTANCE CRITERION.** Not
the pass either side of it. A machine that cannot produce that red is a machine
whose green says nothing, which is precisely the machine PR #257 was merged on.

⚠️ **Move the directory; do not delete it.** A deleted browser costs another
110MB download over the CDN, and — worse — the obvious repair (`playwright
install`) run from the wrong playwright puts a DIFFERENT revision in the cache,
after which the suites skip with a browser present. `docs/runner-image-provisioning.md`
§4 records that exact trap.

---

## 3 · The database — RED with it stopped, GREEN with it running

Same shape, same container:

```bash
# ── GREEN ─────────────────────────────────────────────────────────────────
reconcile-pg-start
CI=true node --test tests/db/tenant-isolation.test.ts; echo "EXIT: $?"
#   EXIT: 0, and the two-tenant leak assertions must actually RUN — the suite
#   prints its own banner when it stands down, and a run carrying that banner
#   is not evidence about isolation no matter what the exit code says.

# ── RED ───────────────────────────────────────────────────────────────────
runuser -u postgres -- /usr/bin/pg_ctl -D "$PGDATA" -m fast stop
CI=true node --test tests/db/tenant-isolation.test.ts; echo "EXIT: $?"
#   EXIT: 1, naming the target:
#     … DID NOT RUN, UNDER CI … Target: postgres://127.0.0.1:5432/reconcile_test

# ── THE OFF-CI CONTROL ────────────────────────────────────────────────────
node --test tests/db/tenant-isolation.test.ts; echo "EXIT: $?"
#   EXIT: 0, with the loud skip banner and no database.

reconcile-pg-start
```

---

## 4 · The whole gate, which is the thing the pipeline will actually run

```bash
reconcile-pg-start
CI=true npm run check; echo "EXIT: $?"
```

**Read three numbers and nothing else**, from the tail of the run:

| Counter | Required | Why |
|---|---|---|
| `skipped` | **0** | every suite that stood down on the old runner now runs |
| the `skip-census` line | **0 assertions** | `skipped N` is not the number of assertions that did not run — `describe(…, { skip })` never registers its children, and `tools/skip-census.mjs` exists because the headline understated it by 19 on run 31961439743 |
| `fail` + `todo` | **whatever they honestly are** | see below |

🛑 **`fail 0` IS NOT PART OF THE CRITERION AND EXPECTING IT WOULD BE THE SAME
MISTAKE ONE LEVEL UP.** The point of running the assertions is to learn what they
say. `todo` in particular is *expected to rise from 0*: the two `todo`
assertions in `tests/http/engine-on-served-path.test.ts` are standing witnesses
that a slice is unmet, and they have never executed on a CI machine. **A newly
red trunk revealed by `skipped 0` is this image working, not this image
failing.** `docs/runner-image-provisioning.md` §6 makes the same point and was
right: the first run with a database present moved `todo` 0 → 2.

---

## 5 · What does NOT count as having verified this image

Each of these is a thing somebody will reasonably offer. None of them is
evidence, and the list is kept here so the offer can be answered with a
reference rather than an argument.

- **A green `docker build`.** It proves the dependencies are present. §2 and §3
  are about what happens when they are not.
- **`reconcile-pg-start` exiting 0.** It proves a server answers. It says nothing
  about whether an absent server costs an exit code.
- **The browser directory existing.** *A file is not a browser* —
  `tests/design/render.ts` records a guard that stat-ed a path and skipped twelve
  suites on a machine that rendered perfectly well.
- **`tests/ci/reachability-guards.test.ts` passing.** §0. It is green either way.
- **A green CodeBuild run.** A green check from an environment that cannot
  execute the assertion is not evidence about the assertion. That is the whole
  finding behind this directory.

---

## 6 · What is still unverified, stated rather than buried

| | State | What would close it |
|---|---|---|
| chromium **launches** on AL2023 aarch64 | **Established by construction, not yet by a run on AWS.** The binary is the playwright `ubuntu20.04-arm64` build (playwright has no `amzn` branch and falls through to it); its highest versioned glibc symbol is `GLIBC_2.25` against AL2023's **2.34**; its 24 `DT_NEEDED` sonames all map to packages in this snapshot. **What has NOT happened is a launch: the image has never been built at all (§7)**, so step 6 is a refusal written down rather than a refusal observed | building it (§1), then §2's red/green pair, then the first `buildspec-ci-image.yml` run, whose `docker run` smoke repeats step 6 in a plain container |
| `/dev/shm` size under CodeBuild | **Unverified, and it is the residual chromium risk.** playwright 1.55.1 passes `--no-sandbox` but **not** `--disable-dev-shm-usage`, so a small `/dev/shm` shows up as a browser that dies mid-run rather than one that refuses to start. CodeBuild exposes no `--shm-size` | watching the first full `CI=true npm run check` on the pipeline; a crash that names neither the suite nor the cause is this |
| `t4g`-class memory headroom | **Unmeasured**, exactly as `docs/runner-image-provisioning.md` §8 says. PostgreSQL plus a browser plus eleven database suites is more concurrent work than this repository has ever run at once | measuring, before re-ruling anything. `db/provision.ts`'s advisory lock over cluster-wide role creation gets exercised harder here than anywhere |
| image signing (G262) | **Not done.** `buildspec-ci-image.yml` names it and does not fake it: there is no signing profile yet | the CDK slice that creates one |
| `compose.yaml` still pins **PostgreSQL 16** | **Known divergence.** This image is 17 because G177 pins 17. From the day the pipeline runs, the gate tests against 17 and a developer's stack runs 16 | `compose.yaml`'s own commit, not this directory's |

---

## 7 · What was and was not run when this directory was written — 18 Sep 2026

🛑 **THE IMAGE HAS NEVER BEEN BUILT.** The authoring machine had the docker CLI
and no daemon (`Cannot connect to the Docker daemon`), so **no `docker build`,
no `docker run`, and none of §1–§4 has been executed.** That is stated first
because everything below is weaker than a build, and a reader skimming for
reassurance should hit this sentence instead.

**What WAS established, each against a real source rather than from memory:**

| Claim | How |
|---|---|
| the base digest is real, is arm64, and is the release the Dockerfile asserts | fetched from ECR Public anonymously; `docker-content-digest` header for the index, and the child manifest's own sha256 recomputed from the bytes; its config blob reads `"architecture":"arm64"` and its layer is `al2023-container-raw-2023.12.20260917.1-arm64v8.tar.xz` |
| every rpm named exists at that release, at the version pinned | downloaded that snapshot's `repodata/primary.xml.gz` (37,280 packages) and read the versions out of it. The release's mirror.list and `latest` resolve to the **same** snapshot guid, so these are facts about the pinned base and not about today |
| **AL2023 has no chromium package at all** | no package in that metadata has a name beginning `chrom`, on aarch64 or noarch. `firefox` is there; chromium is not. This is why the Dockerfile does not `dnf install chromium` |
| the arm64 headless shell exists and is what playwright 1.55.1 will fetch | `playwright-core@1.55.1`'s `browsers.json` pins chromium revision **1193**; `hostPlatform.js` has no `amzn` branch and its Linux fallback returns `ubuntu20.04-arm64`; `registry/index.js:149` maps that to `chromium-headless-shell-linux-arm64.zip`. The zip was downloaded (111,025,542 bytes, HTTP 200) |
| **it can run on AL2023's glibc** | the ELF was parsed: `headless_shell` is `EM_AARCH64`, its highest versioned glibc symbol is **GLIBC_2.25**, and its four bundled objects need at most GLIBC_2.17. AL2023 ships **glibc 2.34** |
| the library list is complete | all 24 `DT_NEEDED` sonames mapped to packages **through that snapshot's own `rpm:provides`** — every one resolved, none missing |
| no container capability is needed | `chromium.js:289` — `--no-sandbox` unless `chromiumSandbox: true`, and `tests/design/render.ts` passes no options |
| the shell in every `RUN` parses | the seven `RUN` instructions were joined the way the Dockerfile parser joins them and run through `bash -n`: all seven clean |
| the `engines.node` assertion does what it says | extracted and executed against the real `package.json`: on Node 24 it refuses with *"this image is Node 22 by ruling"*, exit 1. Its six branches (satisfied · exactly-the-floor · below-floor · wrong-major · unreadable-range · absent) were driven separately and all six agreed |
| the playwright version is read correctly | the same extraction run for real: `PW_VERSION=1.55.1` |
| both buildspecs are valid YAML with the intended shape | parsed with `yaml@2.9.0` — the gate's `build` phase is exactly `["npm ci", "npm run check"]` |

**What NONE of that establishes**, and the list is short and load-bearing: that
`dnf` resolves those packages together; that `initdb` succeeds in this
container; that the trust lines land; that chromium actually launches here; and —
the one G258 exists for — **that an absent dependency costs an exit code on this
image.** §1–§4 are how each of those stops being a prediction.
