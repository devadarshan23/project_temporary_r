# Provisioning the CI runner image — PostgreSQL and chromium

> **STATUS:** LIVING CONTROL
> **V1 AUTHORITY:** NO — it governs the machine the gate runs on, not v1 scope.
> `docs/HANDOFF.md` §3 outranks it on any decision. It decides nothing; it
> records what the runner must carry, how that was established, and the one
> observable that proves it.
> **Written 17 Aug 2026**, against `origin/main` at the merge of PR #273.
> ✅ **SUPERSEDED 18 Sep 2026. THE END DATE ARRIVED THE SAME DAY IT WAS SET.**
> `.github/workflows/check.yml` is deleted and the self-hosted runner it targeted
> is retired. The gate now runs as `reconcile-gate-staging` on the ARM CI image
> **G258** built — verified green on the branch before the retirement:
> `tests 1857, pass 1855, fail 0, skipped 0`, with the skip census reporting
> *"no suite stood down on this run."*
> 🛑 **AND THE RETIREMENT WAS OVERDUE FOR A REASON THIS FILE COULD NOT SEE: the
> workflow had stopped being a gate at all.** It targeted
> `runs-on: [self-hosted, reconcile]` against **zero registered runners**, so
> every push queued a job that never started. A queued check is not a passing
> check. **G239's runner-registration defect closes by construction — there is no
> runner left to register.**
> ⚠️ **READ ON ANYWAY: this file's central ruling is what G258 carried onto
> CodeBuild unchanged** — *"the fix is the image, not the workflow"* — and the
> argument is why the CI image carries PostgreSQL 17 and chromium rather than
> the buildspec installing them.
>
> ~~**THIS FILE STILL GOVERNS, AND IT NOW HAS AN END DATE — 18 Sep 2026.**~~
> **G257** moves CI to CodePipeline + CodeBuild on ARM and **G258** carries this
> file's own ruling — *"the fix is the image, not the workflow"* — onto a custom
> `linux/arm64` CodeBuild image carrying Node 22, PostgreSQL 17 and chromium.
> **Until the commit that observes a green pull-request build from that pipeline
> (`docs/tech-stack.md` §9.6), the self-hosted host this file describes is the
> machine the gate runs on and every word here binds.** After it, this file is
> superseded and the runner retires. G239's registration-token defect closes by
> construction at that point: there is no self-hosted runner left to register.

> 🛑 **THE FIX IS THE IMAGE, NOT THE WORKFLOW, AND THAT IS A RULING RATHER THAN
> A PREFERENCE.** The obvious repairs — a `services: postgres` block, an
> `npx playwright install` step — are both **forbidden by the file they would be
> written into**. `.github/workflows/check.yml` carries its own instruction not
> to grow a step (*"DO NOT ADD A STEP HERE"*), `tests/ci/gate.test.ts` fails if
> it ever grows a second command, and G108 is the ruling underneath both: there
> is exactly one gate, `npm run check`, and CI runs it and nothing else. A
> checker or a service named in the workflow and absent from `check` is a thing
> a contributor cannot run, which is the condition G95 attached to putting CI in
> at all. **So the runner HOST gets PostgreSQL and chromium, and the workflow
> stays four steps long.**

---

## 0 · Reproduction — run these before trusting anything below

Repository-side, from a checkout of `main`:

```bash
# The gate, and its length. Four steps; the last is the only command.
grep -cE '^      - ' .github/workflows/check.yml            # 4
node -e "console.log(require('./package.json').scripts.check)"

# Every database the suite names, and the default it falls back to.
grep -rhoE "\?\? 'reconcile_[a-z_]+'" tests/ | grep -oE 'reconcile_[a-z_]+' | sort -u
grep -n "RECONCILE_DB_NAME', 'reconcile" db/env.ts

# The three roles and their attributes, from the code that creates them.
grep -nE 'CREATE ROLE|ALTER ROLE reconcile' db/provision.ts

# The browser, and the fact that it is a library rather than a runner.
node -e "const p=require('./package.json');console.log(p.devDependencies.playwright, p.devDependencies['@playwright/test'])"
grep -n 'only-shell' tests/design/render.ts

# The pinned server version, which is the only version statement in the tree.
grep -n 'image: postgres' compose.yaml
```

AWS-side, all read-only, `us-east-1`:

```bash
aws ec2 describe-instances --instance-ids i-0e79286f37e5b7981 --region us-east-1 \
  --query 'Reservations[].Instances[].[InstanceId,InstanceType,Architecture,ImageId,State.Name]' --output text
aws ssm describe-instance-information --region us-east-1 \
  --filters "Key=InstanceIds,Values=i-0e79286f37e5b7981" \
  --query 'InstanceInformationList[].[PingStatus,PlatformName,PlatformVersion]' --output text
```

**Every AWS fact in this document was re-derived with those two calls on
17 Aug 2026 and is not quoted from the record.** That matters, because the
record's own copy of them is wrong — §2.

---

## 1 · What is missing, and how that was established

### The run

`gh run view 31961439743 --repo 1CloudHub/Reconcile` — commit
`a3365e1`, an ancestor of `main`, on the merge of PR #276, 16 Aug 2026.
**GitHub reported the check `success`.** Its headline, from
`gh run view 31961439743 --log | grep -E 'ℹ (tests|suites|pass|fail|skipped|todo)'`:

```
ℹ tests 1138
ℹ suites 105
ℹ pass 1134
ℹ fail 0
ℹ cancelled 0
ℹ skipped 4
ℹ todo 0
```

### What that headline does not say

```bash
gh run view 31961439743 --repo 1CloudHub/Reconcile --log | grep -c '﹣'   # 23
```

**Twenty-three assertions stood down; the headline says `skipped 4`.** The
difference is not a discrepancy in the counter — it is the counter answering a
different question. `node --test` reports a skipped *suite* as one skipped test
and does not add up the assertions inside it, so a `describe(..., { skip })`
wrapping a dozen assertions costs the headline **1**. A reader doing the only
arithmetic the headline supports — `1134 + 0 + 4 = 1138` — gets a total that
balances, from a run in which nineteen further assertions never executed.

**And `todo 0` is the worst line in that block.** Two assertions in
`tests/http/engine-on-served-path.test.ts` are marked `todo`, deliberately, as
standing witnesses that a slice is UNMET. They report `todo 0` here because the
suite containing them skipped, so they did not run to be counted. **The counter
that exists to say "this witness is unmet" reads identically to "there are no
unmet witnesses."**

### The two things that were absent

Both causes are in the log verbatim.

| Absent | The log line |
|---|---|
| PostgreSQL | `No PostgreSQL was reachable at postgres://127.0.0.1:5432/reconcile_reset_test.` / `Reason: connect ECONNREFUSED 127.0.0.1:5432` |
| chromium | `browserType.launch: Executable doesn't exist at /home/runner/.cache/ms-playwright/chromium_headless_shell-1193/chrome-linux/headless_shell` |

**Seven distinct database names appear in that log** —
`reconcile_test`, `reconcile_reset_test`, `reconcile_projection_test`,
`reconcile_http_test`, `reconcile_engine_test`, `reconcile_get_run_test`,
`reconcile_completeness_test`. ⚠️ **Seven is what the LOG names and it is not
what the TREE needs; see §3, which derives nine and explains why two of them
cannot appear in a log at all.**

### This has already merged a red trunk once

`tests/http/engine-on-served-path.test.ts:19` — the file's own header, which
records the incident rather than leaving it to be rediscovered:

> This file was merged to `main` in PR #257 with those two assertions UNMET […]
> What let it through is that its CI check reported SUCCESS. The workflow runs
> on a runner with no PostgreSQL […] run 31933756888 reported
> `tests 1023 · pass 1019 · fail 0 · skipped 4` […] So `main` was red from the
> moment it was merged, and only a machine WITH a database could see it.

**The shape to take from that is not "someone merged carelessly."** PR #257's
own body said `npm run check` was EXIT 1 and named both reds. The author
disclosed the failure; the gate contradicted them, and the gate won. **A green
check from an environment that cannot execute the assertion is not evidence
about the assertion** — and while it stays green it is worse than a missing
check, because it overrides a human who was right.

Note the two runs: `1023` tests then, `1138` now, `skipped 4` in both. **The
suite grew by over a hundred assertions and the blind spot did not move**, which
is what an unmoving skip count looks like from the outside.

---

## 2 · The host — and a correction to the record

🛑 **`docs/HANDOFF.md:397-410` NAMES AN INSTANCE THAT NO LONGER EXISTS, AND IT
IS CORRECTED HERE RATHER THAN BY DELETION, because it is the identifier a
reader would have acted on.** That section reads *"instance
`i-08138159a56213f42`, a `t4g.small`"*. Verified 17 Aug 2026:

```bash
aws ec2 describe-instances --instance-ids i-08138159a56213f42 --region us-east-1
#   { "Reservations": [] }
```

**Empty, not an error** — so a reader who runs the obvious command gets no
exception to alert them, just nothing, and `us-east-1` was already the region
that section warns is the surprising one. The instance was replaced by a larger
one and the record did not follow. `tools/check-citations.mjs` cannot catch this
class: an instance id is not a `file:line`, and nothing in `tools/` reads AWS.

**The current host, every field re-derived from the calls in §0:**

| | Value |
|---|---|
| Instance | **`i-0e79286f37e5b7981`** |
| Region | `us-east-1` — **not** the account's primary `us-west-2` |
| Account | `000000000000` |
| Type | `t4g.medium` — **`arm64`**, and the architecture governs both halves below |
| AMI | `ami-09317ccfac89b432d` — `al2023-ami-2023.12.20260803.3-kernel-6.1-arm64` |
| Platform, per SSM | Amazon Linux 2023, agent `3.3.4624.0`, ping **Online** |
| Tags | `Name=reconcile-ci-runner`, `project=reconcile-ci`, `note=2x-fanout+ssm-medium` |
| Runner installs | `/opt/actions-runner`, `/opt/actions-runner-1`, `/opt/actions-runner-2` |

⚠️ **The runner-install paths are the one row in that table taken from the
record rather than from a live call**, because enumerating them requires
running a command on the host. **`t4g.medium` is ARM64. Nothing below may be
copied from an x86 runbook** — it changes the PostgreSQL package name and it is
the whole of the risk in §4.

The job's own environment gives one fact for free, from the chromium path in
the §1 log: **`HOME=/home/runner`**, so the job runs as the user `runner`. That
single observation decides the database identity in §3 and the cache location
in §4.

---

## 3 · PostgreSQL

### What the suite actually needs — derived, not assumed

**Nothing here needs to create a database.** `db/provision.ts` does it:
`provision()` calls `createRoles()`, `createDatabase()` and
`giveSchemaToOwner()`, and `resetSchema()` calls `provision()` before rebuilding
from `db/migrations/`. The suite stands up everything it depends on. **What the
image must supply is a running server and one identity that may do that work.**

**The databases.** Nine distinct names, from the derivation in §0:

```
reconcile_test              db/env.ts:45 — the default, and the name probeDatabase() reports
reconcile_reset_test        tests/db/schema-reset.test.ts
reconcile_projection_test   tests/db/tenant-projection.test.ts
reconcile_http_test         tests/http/data-plane-http.test.ts
reconcile_engine_test       tests/http/engine-on-served-path.test.ts
reconcile_get_run_test      tests/http/get-run.test.ts
reconcile_register_test     tests/http/register-consumes-runs.test.ts
reconcile_completeness_test tests/http/run-completeness-served.test.ts
reconcile_control_test      tests/http/control-plane-http.test.ts
```

⚠️ **NINE, AGAINST THE SEVEN §1 READS OUT OF THE LOG, AND THE TWO MISSING ONES
GO MISSING FOR DIFFERENT REASONS. Neither is a counting mistake, and the second
is a defect.**

- **`reconcile_register_test` is absent because it did not exist yet.**
  `git log -1 --format=%ad -- tests/http/register-consumes-runs.test.ts` is
  `Sun Aug 16 23:51:51 2026`; the run was `17:23Z` the same day. It is simply
  newer than the evidence.
- 🛑 **`reconcile_control_test` is absent because the control-plane suite probes
  the WRONG DATABASE.** `tests/http/control-plane-http.test.ts:55-56` sets
  `RECONCILE_CONTROL_DB_NAME`, then calls `probeDatabase()` — which is
  `db/env.ts`'s, and reads `RECONCILE_DB_NAME`. So the control-plane suite's
  skip message names `reconcile_test`, a database it never opens, and its own
  database is named nowhere in the log. **The skip is still honest** — it stands
  down when no server answers, which is the property that matters, and one
  server serves both names. **But it is a rule keyed on a convenient landmark
  rather than on the thing it protects**, the shape `docs/HANDOFF.md` §5
  catalogues, and it is why a reader counting databases from the log undercounts
  them. It is recorded here and **not fixed here** — this document changes no
  code.

**The roles.** G100's three, confirmed against
`grep -nE 'CREATE ROLE|ALTER ROLE reconcile' db/provision.ts`, which emits each
attribute twice — once at creation and once re-asserted on every run, so a role
edited by hand cannot silently weaken a test:

| Role | Attributes | Why |
|---|---|---|
| `reconcile_owner` | `NOLOGIN NOBYPASSRLS` | Owns the tables. Cannot connect at all, so there is no credential to leak. Reachable only by `SET ROLE` from a member |
| `reconcile_migrator` | `LOGIN BYPASSRLS`, member of owner | The read exemption as an explicit attribute, not a side effect of ownership |
| `reconcile_app` | `LOGIN NOBYPASSRLS` | The request path. Cannot bypass a policy and cannot drop one |

**Confirmed against the tree, and confirmed to be more than the ruling says.**
`db/migrations/0001_tenancy_and_rls.sql` also `FORCE`s row level security, which
subjects the owner to the policy despite owning the table — so the decoupling of
ownership from the read exemption is real rather than asserted. A fourth role,
`reconcile_control_app` (`LOGIN NOBYPASSRLS`), is created by
`server/control-plane/provision.ts` and holds `SELECT` on one table. **All four
are created by the suite. The image creates none of them.**

### The identity the image must supply, and it is the one thing easy to get wrong

`db/env.ts#adminUser` resolves to `RECONCILE_DB_ADMIN`, else `$USER`, else
`postgres`. The workflow sets no `RECONCILE_DB_ADMIN`, and §2 established
`HOME=/home/runner`. **So the suite connects as `runner`.** Three further facts
follow from reading `adminClient()` in `db/provision.ts` and
`createControlDatabase()` in `tests/http/control-plane-http.test.ts`:

1. **It connects over TCP to `127.0.0.1:5432`**, never a Unix socket — the host
   default is `127.0.0.1` and both clients pass it explicitly. `peer`
   authentication therefore does not apply; `pg_hba.conf`'s `host` lines govern.
2. **It supplies no password.** `adminClient()` sets `user` and no `password`,
   and neither `RECONCILE_APP_PASSWORD` nor `RECONCILE_MIGRATOR_PASSWORD` is set
   in CI. So loopback must authenticate by `trust`.
3. **It must be SUPERUSER.** `CREATE ROLE … BYPASSRLS` can only be granted by
   one — `db/provision.ts` says so in its own header — and
   `ALTER SCHEMA public OWNER TO reconcile_owner` needs it too.

**So: a PostgreSQL listening on `127.0.0.1:5432`, with a SUPERUSER role named
`runner`, and `trust` for loopback.**

⚠️ **STATE THE COST OF THAT PLAINLY RATHER THAN LEAVING IT IMPLIED.** A
trust-authenticated superuser on loopback is reachable by anything running on
the host, and **pull-request code runs on this host** — `docs/HANDOFF.md` makes
that point about the instance's IAM role and it applies here identically. What
keeps it proportionate is that the databases hold nothing but fixtures
(`seedTwoTenants` writes `ten_acme` and `ten_globex`), the server is not
published beyond loopback, and a contributor who can open a PR already executes
arbitrary code as `runner`. **It adds no capability an attacker did not have.**
It would stop being proportionate the moment anything real is put in that
server, and nothing in the image enforces that.

### The version

**`compose.yaml` pins `postgres:16-alpine`, for both planes**
(`grep -n 'image: postgres' compose.yaml`). **That is the only version statement
anywhere in the tree, and it is the one to match.** A runner on a different
major would be testing against a server the developer stack does not run.

⚠️ **What I could NOT establish, stated rather than guessed: the MINIMUM major
this code needs.** Every version-sensitive construct I found in
`db/migrations/` — `CREATE POLICY`, `FORCE ROW LEVEL SECURITY`, `nullif`,
`current_setting(…, true)`, `text` comparison, session advisory locks — is old
enough that none of it discriminates between recent majors, and
`giveSchemaToOwner()` in `db/provision.ts` explicitly handles PostgreSQL 14-and-earlier
and 15-and-later **both**. So the floor is lower than 16 and **I have not
determined how much lower, and this document does not claim a number.** Match
16 because compose does; do not read that as a proven minimum.

**No extension is required today.** `grep -rn 'CREATE EXTENSION' db/` returns
nothing. `pgcrypto` appears only in `tools/planner/extract-c4-data.mjs` and its
tests, as a vocabulary the schema scanner tolerates — an anticipation, not a
dependency. A `-contrib` package is therefore optional.

### The commands — Amazon Linux 2023, ARM64

🛑 **DERIVE THE PACKAGE NAME ON THE HOST; DO NOT TRUST THE ONE BELOW.** I could
not verify which PostgreSQL majors this AMI's repository snapshot offers,
because doing so means running `dnf` on the instance, and that is
`ssm send-command` — a state-changing call this document did not make.
**Run the first line and read it before running the second.**

```bash
dnf list available 'postgresql*-server'          # DERIVE. Confirm 16 is offered.
dnf install -y postgresql16 postgresql16-server

/usr/bin/postgresql-setup --initdb

# Loopback trust, and nothing wider. `local` is peer by default and stays that
# way; the suite does not use the socket.
PGHBA=/var/lib/pgsql/data/pg_hba.conf
sed -i 's/^host\(.*\)127\.0\.0\.1\/32.*$/host  all  all  127.0.0.1\/32  trust/' "$PGHBA"
sed -i 's/^host\(.*\)::1\/128.*$/host  all  all  ::1\/128  trust/' "$PGHBA"

systemctl enable --now postgresql

# The one identity the suite needs. `runner` because HOME=/home/runner (§2).
sudo -u postgres psql -c "CREATE ROLE runner LOGIN SUPERUSER" || true
```

⚠️ **The `sed` lines edit a file whose exact default content is version- and
package-dependent, so they are the step most likely to silently do nothing.**
Verify the result rather than the exit status:

```bash
grep -E '^host' /var/lib/pgsql/data/pg_hba.conf
psql -h 127.0.0.1 -U runner -d postgres -c 'SELECT current_user, version()'
```

**The second command is the real check**, because it exercises the same TCP path
with the same identity and no password that the suite will use. A `psql` that
connects over the socket proves nothing about it.

---

## 4 · chromium

### What is launched, and why the usual instructions are wrong here

**`playwright` is a LIBRARY devDependency at `1.55.1`, and `@playwright/test` is
absent** — `node -e "…console.log(p.devDependencies.playwright, p.devDependencies['@playwright/test'])"` prints
`1.55.1 undefined`. `tests/design/render.ts` says why: G108 keeps one gate, and
`@playwright/test` is a second runner with its own config, discovery and
reporter. `node --test` already runs `tests/**/*.test.ts` inside `npm run check`,
so playwright is imported and the runner does not change.

**The consequence for provisioning: there is no `playwright.config.ts`, no
`webServer`, and nothing that installs a browser as a side effect of anything.**
The binary arrives from one command and no other.

**Which build.** `tests/design/render.ts` launches `pw.chromium.launch()` with
no channel and no `executablePath`, so playwright resolves its own download —
and the §1 log names it exactly:

```
/home/runner/.cache/ms-playwright/chromium_headless_shell-1193/chrome-linux/headless_shell
```

`chromium_headless_shell`, not `chromium`: **the headless shell, revision
`1193`, which is the revision `playwright@1.55.1` pins.** The install must
therefore be run **from a checkout with this repository's `node_modules`
installed**, so that `npx` resolves `1.55.1` and not whatever is newest. A
different playwright fetches a different revision into the same cache, the tests
still look for `1193`, and **they still skip — with the browser present.**

```bash
cd <checkout with npm ci already run>
npx playwright install chromium --only-shell
```

⚠️ **`--only-shell` IS LOAD-BEARING AND IS THE PART A REVIEWER WILL WANT TO
DROP.** It is what makes the directory `chromium_headless_shell-1193` rather
than `chromium-1193`. `tests/design/render.ts` records that an earlier draft of
its own skip guard stat-ed the `chromium-*` path and **skipped every design
suite on a machine that rendered perfectly well** — which is why the guard now
launches a page and reads a computed style instead of checking for a file.
Installing the full `chromium` build without `--only-shell` would leave the
shell path unpopulated and change nothing.

### Whose cache, and whether it is shared

**`~/.cache/ms-playwright`, and the `~` is `/home/runner`** — the log path is
the evidence, and it is the job's own resolved path rather than an assumption.

**One cache serves all three runner installs, provided all three services run as
`runner`.** The cache is keyed on the user's home directory, not on the runner
installation directory, so `/opt/actions-runner`, `-1` and `-2` share it and the
install is done **once, not three times**.

⚠️ **THAT PROVISO IS NOT VERIFIED AND IT IS THE ONE ASSUMPTION IN THIS SECTION.**
The §1 log proves `HOME=/home/runner` for **one** job; it does not prove which
user each of the three services runs as. If any runs as `root` or its own user,
that runner's jobs get a different `HOME`, find no cache, and **skip while the
other two pass** — an intermittent green that would look like flakiness rather
than like a missing browser. Derive it before assuming:

```bash
for d in /opt/actions-runner /opt/actions-runner-1 /opt/actions-runner-2; do
  grep -h '^User=\|^RUN_AS_USER=' "$d"/.service "$d"/*.service 2>/dev/null
  systemctl show "$(cat "$d/.service" 2>/dev/null)" -p User 2>/dev/null
done
```

### The ARM64 problem, stated as the risk it is

🛑 **THIS IS THE STEP MOST LIKELY TO FAIL, AND I HAVE NOT VERIFIED THAT IT
WORKS.** Two distinct reasons, and they are worth separating because they fail
differently:

1. **Playwright's Linux ARM64 browser builds are produced against Ubuntu.** The
   host is Amazon Linux 2023. A glibc or shared-library mismatch surfaces as a
   launch failure, which `browserSkip()` catches and turns into **a loud skip** —
   the very symptom being fixed, with the binary sitting on disk.
2. **`npx playwright install-deps` does not support this distribution.** It
   drives `apt`. On AL2023 the shared libraries have to be installed with `dnf`
   by name, and **I cannot state that list**: it depends on what the `1193`
   shell links against, which is read off the binary on the host and not
   guessable from here.

**The derivation, once the binary is on disk:**

```bash
SHELL_BIN=/home/runner/.cache/ms-playwright/chromium_headless_shell-1193/chrome-linux/headless_shell
ldd "$SHELL_BIN" | grep 'not found'      # the exact missing sonames, or nothing
dnf provides '*/libnss3.so'              # map each soname to a package this way
```

Candidate packages on the RHEL family are `nss`, `nspr`, `at-spi2-atk`, `atk`,
`cups-libs`, `libdrm`, `libxkbcommon`, `libXcomposite`, `libXdamage`,
`libXrandr`, `mesa-libgbm`, `alsa-lib`, `pango`, `cairo`. **That list is a
starting point for `dnf provides`, not a verified answer**, and it must be
replaced by whatever `ldd` actually reports. **Do not treat a successful `dnf
install` of those names as evidence the browser launches.** The only evidence is
§6.

**If it turns out the ARM64 shell cannot be made to run on AL2023, that is a
real possible outcome and it is not addressed here.** It would force a choice —
a container for the design suites, an x86 runner, or a distribution change — and
each of those is a ruling for the owner, not a provisioning step.

---

## 5 · Applying it via SSM

SSM is the access path that exists: the agent is `Online` (§2) and
`docs/HANDOFF.md` records the instance role as carrying
`AmazonSSMManagedInstanceCore`. There is no inbound SSH assumed anywhere below.

🛑 **EVERY COMMAND IN THIS SECTION CHANGES STATE AND NONE OF THEM WAS RUN.**
They are written here to be executed deliberately by someone who has read §3 and
§4, and they are deliberately **three pushes rather than one**, so that a
failure names which half failed.

**Push 1 — PostgreSQL.** Send the §3 block, having first confirmed the package
name:

```bash
aws ssm send-command \
  --region us-east-1 \
  --instance-ids i-0e79286f37e5b7981 \
  --document-name AWS-RunShellScript \
  --comment 'ci-runner: postgresql 16 for the gate' \
  --parameters commands='[
    "set -euxo pipefail",
    "dnf list available \"postgresql*-server\"",
    "dnf install -y postgresql16 postgresql16-server",
    "/usr/bin/postgresql-setup --initdb || true",
    "sed -i \"s#^host\\(.*\\)127\\.0\\.0\\.1/32.*#host all all 127.0.0.1/32 trust#\" /var/lib/pgsql/data/pg_hba.conf",
    "sed -i \"s#^host\\(.*\\)::1/128.*#host all all ::1/128 trust#\" /var/lib/pgsql/data/pg_hba.conf",
    "systemctl enable --now postgresql",
    "sudo -u postgres psql -c \"CREATE ROLE runner LOGIN SUPERUSER\" || true",
    "grep -E \"^host\" /var/lib/pgsql/data/pg_hba.conf",
    "sudo -u runner psql -h 127.0.0.1 -U runner -d postgres -c \"SELECT current_user\""
  ]' \
  --query 'Command.CommandId' --output text
```

**Push 2 — chromium**, as `runner`, from a checkout with `node_modules` present.
`runuser` rather than `su -c` so the login shell and `HOME` are the runner's,
which is the whole point:

```bash
aws ssm send-command \
  --region us-east-1 \
  --instance-ids i-0e79286f37e5b7981 \
  --document-name AWS-RunShellScript \
  --comment 'ci-runner: chromium headless shell 1193' \
  --parameters commands='[
    "set -euxo pipefail",
    "runuser -l runner -c \"cd /opt/actions-runner/_work/Reconcile/Reconcile && npm ci && npx playwright install chromium --only-shell\"",
    "ls -la /home/runner/.cache/ms-playwright/",
    "ldd /home/runner/.cache/ms-playwright/chromium_headless_shell-1193/chrome-linux/headless_shell | grep \"not found\" || echo ALL_LIBS_PRESENT"
  ]' \
  --query 'Command.CommandId' --output text
```

⚠️ **The checkout path above is a guess and will need correcting.** A runner's
`_work` directory is named for the repository and only exists after a job has
run there. Derive it — `ls /opt/actions-runner*/_work/` — rather than assuming
the path resolves. If no checkout is usable, a scratch clone plus `npm ci` in
`/home/runner` reaches the same cache, because the cache is keyed on `HOME`.

**Push 3 — the libraries `ldd` named**, if any. There is no command here because
there is no list until push 2 reports one; see §4.

**Read every result.** `send-command` returns as soon as the command is
accepted, so the CLI's own exit status says nothing about what happened:

```bash
aws ssm get-command-invocation --region us-east-1 \
  --command-id <CommandId> --instance-id i-0e79286f37e5b7981 \
  --query '[Status,ResponseCode,StandardOutputContent,StandardErrorContent]' --output text
```

---

## 6 · Verifying it worked — and this is the part that matters

🛑 **THE OBSERVABLE IS `skipped 0` IN A CI RUN. NOTHING ELSE COUNTS AS
EVIDENCE.**

Say plainly what does **not** count, because each of these is a thing someone
will reasonably offer:

- **`ssm get-command-invocation` reporting `Status: Success`.** It proves a
  shell exited 0. `dnf install` succeeds on a host where the service never
  starts; `playwright install` succeeds on a host where the shell cannot launch.
- **`systemctl is-active postgresql`.** It proves a process is listening. It
  says nothing about whether `runner` may connect over TCP without a password,
  which is the actual requirement (§3).
- **The binary existing on disk.** `tests/design/render.ts` records this exact
  mistake being made inside the repository: a guard that stat-ed a path skipped
  twelve suites on a machine that rendered fine. **A file is not a browser.**
- **A green check.** A green check is what the whole problem looks like. The
  run in §1 was green.

**The check, on the next run after provisioning:**

```bash
RUN=$(gh run list --repo 1CloudHub/Reconcile --branch main --workflow check \
        --limit 1 --json databaseId -q '.[0].databaseId')
gh run view "$RUN" --repo 1CloudHub/Reconcile --log \
  | grep -E 'ℹ (tests|suites|pass|fail|cancelled|skipped|todo)'
gh run view "$RUN" --repo 1CloudHub/Reconcile --log | grep -c '﹣'
```

**The provisioning worked if and only if:**

| Counter | Required | Why |
|---|---|---|
| `skipped` | **0** | Every suite that stood down for a missing database or browser now runs |
| the `﹣` count | **0** | The assertion-level number §1 shows the headline understating. Both, or neither |
| `fail` + `todo` | **whatever they honestly are** | See below |

⚠️ **`fail 0` IS NOT PART OF THE SUCCESS CRITERION, AND EXPECTING IT WOULD BE
THE SAME MISTAKE ONE LEVEL UP.** The point of running the assertions is to learn
what they say. `todo` in particular is *expected to rise from 0* — the two `todo`
assertions in `tests/http/engine-on-served-path.test.ts` are unmet witnesses that
have never executed on this runner, and a run that finally reports `todo 2` has
**succeeded at what this document is for**. A newly red trunk revealed by
`skipped 0` is the fix working, not the fix failing.

### The criterion is not hypothetical — it was observed while this was written

`npm run check` on the authoring machine, 17 Aug 2026, EXIT 0. That machine has
a PostgreSQL answering on `127.0.0.1:5432` and
`chromium_headless_shell-1193` in `~/.cache/ms-playwright` — **exactly the two
things §3 and §4 install, and nothing else the runner lacks:**

```
ℹ tests 1254 · suites 116 · pass 1252 · fail 0 · cancelled 0 · skipped 0 · todo 2
```

`grep -c '﹣'` over that log is **0**. Every suite that stood down in §1 ran and
passed — `tenant isolation — two tenants, one pooled connection`, `the data
plane over HTTP`, `the control plane over HTTP`, `the engine over HTTP`, `the
hatch under Tailwind`.

**Two things are established by that and they are worth separating.** First, the
target state is reachable and the criterion is met by real dependencies rather
than by a described one. Second — and this is the more useful half — **`todo`
went from `0` to `2` exactly as predicted above.** The two unmet witnesses in
`tests/http/engine-on-served-path.test.ts` became visible the moment a database
was present. That is what the fix is *for*.

⚠️ **AND HERE IS WHAT IT DOES NOT ESTABLISH, WHICH IS THE ARM64 QUESTION — THE
ONE THING §4 SAYS IS MOST LIKELY TO FAIL.** The authoring machine is not the
runner: different architecture, different operating system, and a browser
installed by a package manager this document does not use. **It proves the
repository's side works when both dependencies are present. It proves nothing
about whether they CAN be present on an Amazon Linux 2023 ARM64 host**, and no
amount of green on a developer machine will.

**And one honest limit on `skipped 0` itself.** It proves the runner that
executed *that* run had both. With three runner installs and a shared-cache
assumption that is unverified (§4), **it does not prove the other two are
provisioned.** Until the cache-ownership question is derived, treat `skipped 0`
as evidence about one machine-instant, and watch for a later run that skips
again — that pattern is the §4 proviso failing, not flakiness.

---

## 7 · The durable fix, which is not this — OPEN

🛑 **PROVISIONING THE IMAGE DOES NOT FIX THE POOL, AND A PROVISIONED RUNNER THAT
CANNOT REGISTER IS STILL NO RUNNER.**

`docs/HANDOFF.md:397-410` records the root cause: **GitHub runner registration
tokens live one hour**, and the bootstrap hard-codes one at `/dev/shm/reg-token`,
so a host can register runners only during its first hour of life. The two
mitigations in place are both stopgaps and the record says so: a batch registers
during that window — **"four jobs, not four hours"** — and SSM being online makes
refreshing the token a one-command push rather than a new instance.

**The durable fix is a credential the host can use to mint its own registration
tokens**, and `docs/HANDOFF.md` carries it as item 1 of its open list. **It is
open. Nothing in this document advances it.**

The two interact in a way worth naming, because it changes the order of work:
**everything in §3 and §4 is installed onto a host whose runner pool drains.**
If the pool is replaced by launching a fresh instance, **the provisioning is
lost with it** and §5 has to be re-run — which makes this a runbook against a
disposable host rather than an image, and it will stay one until either the
token problem is fixed or the steps are baked into an AMI or a launch template.
**Neither of those is decided, and this document does not decide them.**

---

## 8 · Cost and risk, honestly

**Numbers I will not state, because I do not have them:** the instance's hourly
or monthly cost, the price difference between `t4g.small` and `t4g.medium`, and
any figure for what a run will take once PostgreSQL and chromium actually
execute. `PRODUCT.md` forbids inventing a benchmark and a runtime prediction is a
benchmark. **What follows is measured, or it is labelled a direction.**

**Measured, from the run in §1** (`gh run view 31961439743 --json jobs`):

| | |
|---|---|
| Whole job, queue to completion | `17:23:15Z` → `17:24:14Z` — **59 seconds** |
| `node --test`, self-reported | `duration_ms 28257.321193` |

**That is the floor, and it is a floor measured with the work not being done.**
Both halves being provisioned adds, in direction only and with no number
attached: rebuilding schemas from migrations across nine databases, each
`resetSchema()` dropping and recreating; and launching a browser and rendering
pages for the design suites. **Both are real work that currently does not
happen.** `node --test` runs files concurrently, so some of it overlaps — and
that concurrency is itself a known hazard here, `db/provision.ts` documenting a
`tuple concurrently updated` race between two suites provisioning the same
cluster-wide roles at once, answered with an advisory lock. **More suites reaching
a real server exercises that lock harder than anything has so far.**

**The resource risk, stated as a risk and not as a prediction.** A `t4g.medium`
would run PostgreSQL, up to three concurrent runner jobs, and a chromium
instance per design suite, on shared memory. The `note=2x-fanout+ssm-medium` tag
suggests the move from `small` to `medium` was already made for fanout headroom.
**Whether it is enough is unmeasured**, and the failure mode to watch for is
specific: memory pressure kills a browser or a backend mid-run, which surfaces as
an intermittent failure that names neither. **An intermittent red gate is the
failure mode G95 admitted CI on the condition of avoiding** — *the checks must be
real from day one* — so if the first provisioned runs are flaky, the instance
size is a candidate cause and should be measured before anything is re-ruled.

**The security cost is in §3** and is not repeated: a trust-authenticated
superuser on loopback, on a host that executes pull-request code, holding
fixtures only.

**What this document does not do.** It changes no code, adds no checker, adds no
step to the workflow, and touches `npm run check` not at all. It does not fix the
`probeDatabase()` mis-naming found in §3, and it does not close the registration
token in §7. **It is a runbook and a record of how the gap was established — the
gap closes when a run reports `skipped 0`, and not before.**
