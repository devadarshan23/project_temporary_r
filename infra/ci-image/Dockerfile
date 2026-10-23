# =====================================================================
# THE CI IMAGE — THE MACHINE WHERE A GREEN GATE MEANS SOMETHING. G258.
#
# 🛑 THE FIX IS THE IMAGE, NOT THE WORKFLOW. `docs/runner-image-provisioning.md`
# rules it and this file is that ruling carried onto CodeBuild unchanged: the
# gate stays `npm ci && npm run check` and NOTHING else (G108), so everything it
# needs to execute every assertion is baked here instead of installed per build.
# PR #257 merged a trunk whose own body records `npm run check` EXIT 1, because
# run 31961439743 reported `success` on a runner with seven test databases
# unreachable and no chromium. `tests/reachability.ts` turns that into a red X —
# but only on a machine where a missing dependency is the ANOMALY. This is that
# machine.
#
# ┌─ WHAT IS IN HERE, AND WHY EACH ONE ────────────────────────────────────────┐
# │ Node 22        the runtime `package.json`'s `engines.node` requires, and    │
# │                the version is ASSERTED against that field at build time     │
# │                rather than copied into a comment (step 3).                 │
# │ PostgreSQL 17  G177 pins 17 and the migrations are written against it. The  │
# │                cluster is initdb'd HERE so the gate starts it in a second.  │
# │ chromium       the playwright headless shell, at the revision THIS          │
# │                repository's pinned playwright resolves — and the build      │
# │                FAILS if a page cannot be rendered (step 6).                 │
# └────────────────────────────────────────────────────────────────────────────┘
#
# ⚠️ THIS IMAGE IS A BUILD MACHINE AND CARRIES A SHELL, A PACKAGE MANAGER, A
# DATABASE SERVER AND A BROWSER — ON PURPOSE. `docs/tech-stack.md` §13.1 states
# that exception in its own voice: G262's distroless, non-root, read-only-root
# rules govern the PLANE image (the repository-root `Dockerfile`), not this one.
# The difference is stated here rather than smuggled.
#
# ┌─ WHAT IS PINNED, AND HOW IT WAS DERIVED (G252, G262: DIGEST, NOT TAG) ─────┐
# │                                                                            │
# │ The base is the ARM64 CHILD MANIFEST of                                     │
# │ `public.ecr.aws/amazonlinux/amazonlinux:2023`, not the multi-arch index, so │
# │ this FROM cannot resolve to x86 under any builder — which is the exact      │
# │ failure G252 names about a bare `FROM node:22.20.0-alpine`.                 │
# │                                                                            │
# │ Resolved 18 Sep 2026 against the live registry, anonymously:               │
# │   TOKEN=$(curl -s 'https://public.ecr.aws/token/?scope=repository:amazonlinux/amazonlinux:pull&service=public.ecr.aws' | jq -r .token)
# │   curl -sI -H "Authorization: Bearer $TOKEN" \                              │
# │     -H 'Accept: application/vnd.docker.distribution.manifest.list.v2+json' \ │
# │     https://public.ecr.aws/v2/amazonlinux/amazonlinux/manifests/2023        │
# │   #  docker-content-digest: sha256:50f4b89f09091b7c33f6a194b45d842b21aa8f9c7642679733feabffdeaf7404  ← the INDEX
# │   #  the index's arm64 entry:  sha256:2ecbec912ec94c8ed430d954337fc888a0a07fa8e657551c6dfa64d4064f3a87  ← WHAT IS PINNED BELOW
# │                                                                            │
# │ Both digests were verified content-addressed: fetching the child digest     │
# │ returns a manifest whose own sha256 IS that digest, and its config blob     │
# │ reads `"architecture":"arm64"` with a single layer added from               │
# │ `al2023-container-raw-2023.12.20260917.1-arm64v8.tar.xz`.                   │
# │                                                                            │
# │ 🛑 AND THE DIGEST PIN IS WHAT MAKES `dnf install` REPRODUCIBLE, WHICH IS    │
# │ NOT OBVIOUS AND IS THE REASON THE RPM VERSIONS BELOW CAN BE PINNED AT ALL.  │
# │ AL2023's repository is `mirrorlist=…/mirrors/$releasever/$basearch/…` and   │
# │ `$releasever` comes from the base image's own release — 2023.12.20260917.   │
# │ Verified: that release's mirror.list and `latest` return the SAME snapshot  │
# │ guid `050d3367d43e390a4c0c69b646a7a82649ccf50a7fa5b28534c72d35e6351b7a`, so │
# │ every NVR below is a fact about the snapshot this digest pins, and a digest │
# │ bump that moves them fails this build LOUDLY rather than drifting.          │
# └────────────────────────────────────────────────────────────────────────────┘
#
# ⚠️ THE BUILD CONTEXT IS THE REPOSITORY ROOT, NOT THIS DIRECTORY — deliberately.
# `package.json` is copied in so the Node version and the playwright version are
# DERIVED FROM THE REPOSITORY'S OWN PINS rather than restated here, which is the
# failure mode `docs/runner-image-provisioning.md` §4 names: a browser installed
# by a different playwright fetches a different revision into the same cache, the
# tests still look for the old one, and they SKIP WITH A BROWSER PRESENT.
#   docker build --platform linux/arm64 -f infra/ci-image/Dockerfile .
# =====================================================================

FROM --platform=linux/arm64 public.ecr.aws/amazonlinux/amazonlinux@sha256:2ecbec912ec94c8ed430d954337fc888a0a07fa8e657551c6dfa64d4064f3a87

# `pipefail` because a piped command's status is the PIPE's, which is 0 — the
# same trap CLAUDE.md records costing an hour on `tsc … | head`.
SHELL ["/bin/bash", "-euxo", "pipefail", "-c"]

# ---------------------------------------------------------------------
# 1 · THE BASE IS WHAT THE HEADER SAYS IT IS.
#
# Two assertions, because the pin above is only as good as the thing it lands
# on: the architecture (G252's whole subject) and the release (which is what
# makes the rpm versions in step 2 reproducible).
# ---------------------------------------------------------------------
RUN test "$(uname -m)" = 'aarch64' \
 && grep -q 'PRETTY_NAME="Amazon Linux 2023.12.20260917"' /etc/os-release

# ---------------------------------------------------------------------
# 2 · THE PACKAGES.
#
# `--best` overrides this image's own `/etc/dnf/dnf.conf`, which ships
# `best=False` and `skip_if_unavailable=True` — i.e. a default that would
# quietly install an older package or silently skip an unreachable repository.
# A build machine that is one package short must fail, not improvise.
#
# 🛑 THE CHROMIUM LIBRARY LIST IS DERIVED, NOT COPIED FROM A RUNBOOK. It is the
# `DT_NEEDED` closure of the ACTUAL aarch64 headless shell
# (chromium-headless-shell-linux-arm64.zip, playwright revision 1193), read off
# the ELF and mapped soname → package through this snapshot's own repository
# metadata. `docs/runner-image-provisioning.md` §4 offers `cups-libs`, `pango`,
# `cairo` and `libdrm` as "a starting point, not a verified answer" — the shell
# links NONE of those four directly, and it DOES link `glib2`, `dbus-libs`,
# `expat`, `systemd-libs` (libudev) and `nss-util`, which that list never named.
# Reproduce on any aarch64 host with the shell on disk:
#   ldd .../chromium_headless_shell-1193/chrome-linux/headless_shell
#   readelf -d  … | grep NEEDED          # the same 24 entries
#
# Fonts are not decoration: a chromium with no font at all measures text
# geometry differently, and `tests/design/` measures geometry. The design
# suites abort fonts.googleapis.com by design, so the SYSTEM font is what they
# get.
#
# ⚠️ `postgresql18` IS IN THIS SNAPSHOT AND IS NOT TAKEN. G177 pins 17 and the
# migrations are written against it; a runner on a different major would be
# testing against a server nothing else runs. ⚠️ AND IT IS WORTH SAYING THAT
# `compose.yaml` STILL PINS `postgres:16-alpine` — so from the commit that points
# the pipeline at this image, the gate runs 17 while a developer's local stack
# runs 16. That divergence is named here rather than discovered later; closing it
# is `compose.yaml`'s commit, not this one's.
#
# `util-linux` is here for ONE binary: `/usr/sbin/runuser`. The base image has
# neither `runuser` nor `su`, and the cluster must not be initdb'd or started as
# root.
# ---------------------------------------------------------------------
RUN dnf -y --best --setopt=install_weak_deps=False install \
      nodejs22-22.23.2 \
      nodejs22-npm \
      postgresql17-17.11 \
      postgresql17-server-17.11 \
      alsa-lib at-spi2-core atk dbus-libs expat glib2 \
      libX11 libXcomposite libXdamage libXext libXfixes libXrandr libxcb \
      libxkbcommon mesa-libgbm nspr nss nss-util systemd-libs \
      fontconfig dejavu-sans-fonts google-noto-sans-fonts \
      ca-certificates git tar gzip unzip which findutils procps-ng shadow-utils \
      util-linux \
 && dnf clean all \
 && rm -rf /var/cache/dnf

# ---------------------------------------------------------------------
# 3 · NODE IS ASSERTED AGAINST `engines.node`, NOT AGAINST A COMMENT.
#
# `package.json` says `>=22.18.0`. That is a FLOOR, not a version, so this step
# does two things a restated number cannot: it reads the floor out of the
# manifest, and it REFUSES A RANGE IT CANNOT READ — a future `^22 || ^24` fails
# the build rather than being approximated. The major is checked separately,
# because ">=22.18.0" is satisfied by Node 26 and this image is Node 22 by
# ruling (G252's workload list).
# ---------------------------------------------------------------------
# ⚠️ NOT `/opt/reconcile-ci/package.json`. A manifest sitting at a prefix npm is
# later pointed at is a manifest npm will REWRITE; the repository's pins are
# read-only input here, so the name says so.
COPY package.json /opt/reconcile-ci/repo-package.json
RUN node -e ' \
  const pkg = require("/opt/reconcile-ci/repo-package.json"); \
  const range = pkg.engines && pkg.engines.node; \
  const m = /^>=(\d+)\.(\d+)\.(\d+)$/.exec(String(range)); \
  if (!m) { console.error("engines.node is " + JSON.stringify(range) + ", which this image cannot read. It understands one form, `>=x.y.z`. Decide what the image should carry rather than letting it guess."); process.exit(1); } \
  const want = m.slice(1, 4).map(Number); \
  const have = process.versions.node.split(".").map(Number); \
  if (have[0] !== 22) { console.error("this image is Node 22 by ruling; it has " + process.versions.node); process.exit(1); } \
  const below = have[0] < want[0] || (have[0] === want[0] && (have[1] < want[1] || (have[1] === want[1] && have[2] < want[2]))); \
  if (below) { console.error("node " + process.versions.node + " is below engines.node " + range); process.exit(1); } \
  console.log("node " + process.versions.node + " satisfies engines.node " + range); \
' \
 && npm --version \
 && postgres --version | grep -E '^postgres \(PostgreSQL\) 17\.'

# ---------------------------------------------------------------------
# 4 · THE CLUSTER, BUILT HERE SO THE GATE ONLY HAS TO START IT.
#
# 🛑 `initdb`, NOT `postgresql-setup`. The AL2023 wrapper reaches for systemd,
# and there is no init in a build container; running the real thing directly as
# the `postgres` user is both shorter and one fewer thing that can succeed while
# doing nothing.
#
# ⚠️ TRUST ON LOOPBACK, AND THE COST IS STATED RATHER THAN IMPLIED. `db/env.ts`
# supplies no password (`appPassword()` returns undefined by design, "a Homebrew
# or a socket-local PostgreSQL authenticates by trust and has no password to
# give"), and `db/provision.ts` needs SUPERUSER because `CREATE ROLE … BYPASSRLS`
# can only be granted by one. So loopback must be `trust`. What keeps that
# proportionate is that the cluster holds FIXTURES ONLY — `seedTwoTenants` writes
# `ten_acme` and `ten_globex` — it listens on 127.0.0.1 alone, and it lives for
# the length of one build container. It would stop being proportionate the
# moment anything real were put in it, and nothing here enforces that.
#
# ⚠️ `--locale=C`, AND IT IS A CHOICE WITH A COST. C collation is deterministic
# and identical on every machine, which is what a gate wants; it is NOT what
# `compose.yaml`'s `postgres:16-alpine` gives a developer, so a test that ever
# asserts an `ORDER BY` over text could pass here and differ there. Nothing in
# `tests/` does that today. If one ever does, this line is the first place to
# look, and the answer is to match the local stack rather than to widen the test.
#
# `md5`/`scram` for the `local` socket lines is left exactly as initdb wrote it:
# the suite connects over TCP (`db/env.ts` passes host and port explicitly), so
# the socket path is not the one under test and widening it would buy nothing.
# ---------------------------------------------------------------------
ENV PGDATA=/var/lib/pgsql/17/data \
    PGBIN=/usr/bin

RUN install -d -o postgres -g postgres -m 0700 "${PGDATA}" \
 && install -d -o postgres -g postgres -m 0755 /var/log/postgresql /var/run/postgresql \
 && runuser -u postgres -- "${PGBIN}/initdb" --pgdata="${PGDATA}" --encoding=UTF8 --locale=C \
 && printf '%s\n' \
      "listen_addresses = '127.0.0.1'" \
      "port = 5432" \
      "fsync = off" \
      "full_page_writes = off" \
      "synchronous_commit = off" \
      "max_connections = 200" \
      >> "${PGDATA}/postgresql.conf" \
 && printf '%s\n' \
      "# The gate's identity. See infra/ci-image/Dockerfile step 4." \
      "host  all  all  127.0.0.1/32  trust" \
      "host  all  all  ::1/128       trust" \
      > "${PGDATA}/pg_hba.conf.reconcile" \
 && cat "${PGDATA}/pg_hba.conf" >> "${PGDATA}/pg_hba.conf.reconcile" \
 && mv "${PGDATA}/pg_hba.conf.reconcile" "${PGDATA}/pg_hba.conf" \
 && chown postgres:postgres "${PGDATA}/pg_hba.conf" \
 && chmod 0600 "${PGDATA}/pg_hba.conf"

# 🛑 THE TRUST LINES ARE VERIFIED BY CONNECTING, NOT BY `grep`.
# `docs/runner-image-provisioning.md` §3 names the `sed` on `pg_hba.conf` as
# "the step most likely to silently do nothing" and says the real check is a TCP
# connection with the identity the suite will use and no password. That check is
# here, at build time, so an image that cannot serve the gate never ships.
COPY infra/ci-image/pg-start.sh /usr/local/bin/reconcile-pg-start
RUN chmod 0755 /usr/local/bin/reconcile-pg-start \
 && reconcile-pg-start \
 && psql -h 127.0.0.1 -p 5432 -U postgres -d postgres \
      -c 'SELECT current_user, version()' \
 && psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -tAc \
      "SELECT rolsuper FROM pg_roles WHERE rolname = current_user" | grep -qx 't' \
 && runuser -u postgres -- "${PGBIN}/pg_ctl" -D "${PGDATA}" -m fast stop

# ---------------------------------------------------------------------
# 5 · CHROMIUM — the one piece `docs/tech-stack.md` §14 lists as NOT VERIFIED.
#
# 🛑 THERE IS NO `chromium` PACKAGE ON AMAZON LINUX 2023, ON EITHER ARCH. Do not
# write `dnf install chromium` here: this snapshot's primary metadata contains no
# package whose name begins `chrom` at all (37,280 packages; `firefox` is there,
# chromium is not). So the browser comes from playwright's own CDN, and the
# question `docs/tech-stack.md` §14 leaves open — does that build RUN on AL2023
# aarch64 — is answered by step 6 rather than hoped for.
#
# ⚠️ THE VERSION IS READ OUT OF `devDependencies`, AND THAT IS LOAD-BEARING.
# Playwright resolves a browser REVISION per version (1.55.1 → chromium 1193,
# `chromium_headless_shell-1193`). Installing with any other playwright puts a
# different revision in the cache, the suite looks for the one its own library
# names, and it skips with a browser sitting on disk.
#
# ⚠️ `--only-shell` IS LOAD-BEARING TOO AND IS THE PART A REVIEWER WILL DROP. It
# is what makes the directory `chromium_headless_shell-1193` rather than
# `chromium-1193`; `tests/design/render.ts` records a guard that stat-ed the
# wrong one of those two and skipped twelve suites on a machine that rendered
# perfectly well.
#
# `PLAYWRIGHT_BROWSERS_PATH` puts the cache somewhere that does not depend on
# `HOME`. On the self-hosted host the cache was `/home/runner/.cache/ms-playwright`
# and `docs/runner-image-provisioning.md` §4 records that "which user each runner
# service runs as" was never verified — the failure mode being one runner that
# skips while two pass, which reads as flakiness. A path is not a user.
#
# ⚠️ THE INSTALL IS LOCAL TO `/opt/reconcile-ci/pw`, NOT GLOBAL, FOR A REASON
# THAT IS EASY TO GET WRONG: Node's ESM resolver DOES NOT CONSULT `NODE_PATH`, so
# `import 'playwright'` from a global install does not resolve, and step 6 would
# fail for a reason that has nothing to do with chromium. A local `node_modules`
# beside the probe resolves by directory walk, which is the plain mechanism.
# The one-line `package.json` written first is not decoration either: `npm
# install --prefix` into a directory with no manifest behaves differently across
# npm majors, and this makes it one thing.
#
# A range specifier (`^1.55.1`) is refused rather than resolved: G191 pins every
# dependency exact, and a caret here would let the image and the lockfile name
# two different revisions — the failure this whole step is written around.
# ---------------------------------------------------------------------
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright

RUN PW_VERSION="$(node -p 'require("/opt/reconcile-ci/repo-package.json").devDependencies.playwright')" \
 && test -n "${PW_VERSION}" \
 && test "${PW_VERSION}" = "${PW_VERSION#[^0-9]}" \
 && mkdir -p /opt/reconcile-ci/pw \
 && printf '%s\n' '{"name":"reconcile-ci-playwright","private":true,"version":"0.0.0"}' \
      > /opt/reconcile-ci/pw/package.json \
 && npm install --prefix /opt/reconcile-ci/pw --no-package-lock --no-fund --no-audit \
      "playwright@${PW_VERSION}" \
 && /opt/reconcile-ci/pw/node_modules/.bin/playwright install chromium --only-shell \
 && ls -d "${PLAYWRIGHT_BROWSERS_PATH}"/chromium_headless_shell-* \
 && npm cache clean --force

# ---------------------------------------------------------------------
# 6 · THE BROWSER IS PROVEN TO LAUNCH, INSIDE THE IMAGE, AT BUILD TIME.
#
# 🛑 A FILE IS NOT A BROWSER. `docs/runner-image-provisioning.md` §6 lists
# exactly this mistake as one already made inside this repository, and
# `tests/design/render.ts` says the property is "can a page be rendered and its
# computed style read" — so that is what this asserts, in the same shape
# `browserSkip()` uses. An image whose chromium cannot launch does not build.
#
# WHY IT WAS EXPECTED TO WORK, stated so the evidence outlives the build log:
#   · playwright 1.55.1 has no branch for `ID="amzn"`, so its Linux fallback
#     resolves `ubuntu20.04-arm64` (lib/server/utils/hostPlatform.js) → the
#     download `builds/chromium/1193/chromium-headless-shell-linux-arm64.zip`
#     (lib/server/registry/index.js:149). It does NOT error on an unknown distro.
#   · that binary's highest versioned glibc symbol is GLIBC_2.25; AL2023 ships
#     glibc 2.34. Its four bundled objects (libEGL, libGLESv2, libvulkan,
#     libvk_swiftshader) need nothing beyond GLIBC_2.17.
#   · `pw.chromium.launch()` passes `--no-sandbox` unless `chromiumSandbox: true`
#     (lib/server/chromium/chromium.js:289), and `tests/design/render.ts` passes
#     no options — so no container capability is required.
# ---------------------------------------------------------------------
COPY infra/ci-image/verify-chromium.mjs /opt/reconcile-ci/pw/verify-chromium.mjs
RUN node /opt/reconcile-ci/pw/verify-chromium.mjs

# ---------------------------------------------------------------------
# 7 · WHAT THE GATE INHERITS.
#
# Deliberately ABSENT: `CI`. The buildspec sets it, because `CI` is a claim about
# the run and not about the machine — `tests/reachability.ts` conditions the
# guards on it precisely so a person can open a shell in this image and get a
# runnable suite rather than a red one.
#
# Deliberately ABSENT: `RECONCILE_LOCAL_TEST_AUTH`. Same reasoning as the
# repository-root `Dockerfile`, which says it in its own voice — an image that
# carried the flag would put it in every use of the image. G192's fence is that
# the file is never LOADED, and a default here would start eroding it.
# ---------------------------------------------------------------------
ENV RECONCILE_DB_HOST=127.0.0.1 \
    RECONCILE_DB_PORT=5432 \
    RECONCILE_DB_ADMIN=postgres \
    RECONCILE_CONTROL_DB_HOST=127.0.0.1 \
    RECONCILE_CONTROL_DB_PORT=5432 \
    RECONCILE_CONTROL_DB_ADMIN=postgres \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

WORKDIR /
CMD ["/bin/bash"]
