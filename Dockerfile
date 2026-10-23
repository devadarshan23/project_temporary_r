# =====================================================================
# ONE IMAGE, TWO PLANES — the command decides which.
#
# There is no build step and no bundler. Node 22.18+ strips TypeScript types
# natively, `package.json` pins `engines.node >= 22.18.0` for exactly that
# reason, and `tests/` already runs `node --test` over `.ts` files directly. A
# compile step here would add an artefact nothing checks between the source that
# is reviewed and the code that runs.
#
# ⚠️ `npm ci --omit=dev` INSTALLS fastify, pg, yaml AND @aws-sdk/client-sqs —
# AND NOT typescript OR @types/node. The type checker is a development tool; a
# container that carried it would be shipping the thing that verifies the code
# alongside the code, which is how a verification step becomes a runtime
# dependency. THAT HALF IS UNCHANGED AND IS WHAT
# `tests/infra/manifest.test.mjs` STILL FENCES.
#
# 🛑 THE SENTENCE ABOVE READ "INSTALLS fastify, pg AND yaml — THE THREE RUNTIME
#    DEPENDENCIES" UNTIL 20 Sep 2026 AND IT IS CORRECTED RATHER THAN DELETED,
#    BECAUSE `docs/HANDOFF.md`'s G212 ROW CITES THIS HEADER BY NAME AS THE
#    PLACE THE PROPERTY IS STATED.
#
#    **R-C, 20 Sep 2026, the owner's ruling: the AWS SDK is TAKEN** — one
#    client, `@aws-sdk/client-sqs`, pinned exact under G191, for R-B's run
#    queue. G212 said the SDK is revisited *"when an actual AWS resource
#    exists — which is a fact about the account, not about the code"*, and NINE
#    top-level stacks are live in `000000000000`. **The ruling is DISCHARGED by
#    its own condition, not overturned.**
#
#    ⚠️ AND THE COST IS STATED RATHER THAN DISCOVERED: the image grows the
#    client's transitive closure — **25 packages**, measured at
#    `npm install --save-exact @aws-sdk/client-sqs@3.1136.0`. `react` and
#    `react-dom` are also runtime dependencies of the root manifest and land
#    here too; they are the frontend's (G198) and this image serves no
#    frontend, which is a pre-existing cost this correction does not create.
#
#    ⚠️ AND IT IS NARROW BY NAME. Not `aws-sdk` v2, not the monolith, not
#    `@aws-sdk/client-s3`: there is still no object store on the served path,
#    `createUpload` is still unmounted, and `tests/infra/manifest.test.mjs`
#    fails the gate on a second `@aws-sdk/*` package.
#
# 🛑 AND THAT LAST CLAUSE WENT FALSE ON 1 Oct 2026 BY RULING — G2404, under the
#    owner's G2401 (source credentials live in Secrets Manager). The image now
#    also installs `@aws-sdk/client-secrets-manager`, pinned at the SAME exact
#    version as `client-sqs`, so the two share one transitive closure: measured,
#    the lockfile grew by ONE package. The manifest test now fails on a THIRD
#    `@aws-sdk/*` package, and `client-s3` is still absent by name. The client
#    can WRITE a secret and nothing in `server/` imports the command that reads
#    one (G2403).
#
# 🛑 `docs/contracts/` IS COPIED IN, AND IT IS NOT DOCUMENTATION HERE. Ruling 1:
# the four OpenAPI files ARE the router and the validator. `server/contract/`
# reads them at boot; an image without them does not start. That is the property
# working — a plane that could run without its contract would be a plane whose
# routes came from somewhere else.
# =====================================================================

# ══════════════════════════════════════════════════════════════════════════
# 🛑 TWO STAGES, A DIGEST, AND AN `apk upgrade` — ALL THREE ADDED 18 Sep 2026
#    BECAUSE G262's SCAN GATE STOPPED THE FIRST REAL PIPELINE RUN, AND IT WAS
#    RIGHT TO.
#
#    The staging image scanned at **5 CRITICAL and 24 HIGH**, and every one of
#    the criticals was the same package:
#
#        CVE-2026-34182, CVE-2025-15467, CVE-2026-31789,
#        CVE-2026-63073, CVE-2026-75803   →   openssl 3.5.4-r0
#
#    None of them is this repository's code. They are the Alpine base's
#    openssl, which `node:22.20.0-alpine` had pinned by TAG — and a tag is a
#    name that moves, so "we are on 22.20.0" said nothing about which openssl
#    was inside.
#
#    THREE CHANGES, AND THE FIRST IS THE ONE THAT MATTERS:
#
#    1 · PINNED BY DIGEST (G252, G262). `node:22.22-alpine` resolved on
#        18 Sep 2026. A digest cannot move; a tag can. Bumping it is a reviewed
#        change to this line, which is the shape G191 already requires of every
#        other pinned dependency.
#    2 · `apk --no-cache upgrade` in the runtime stage, so patched base
#        packages are taken even when the node image itself has not been
#        rebuilt. ⚠️ THIS IS DELIBERATELY NOT REPRODUCIBLE BYTE-FOR-BYTE and
#        that is a real cost, stated rather than discovered: two builds of the
#        same commit a week apart can carry different openssl. The alternative
#        — waiting for upstream to rebuild — leaves known criticals in a
#        running plane, and G262's gate would block that anyway.
#    3 · MULTI-STAGE, so the runtime carries `node_modules` and the source and
#        NOT npm's cache, the manifest lockfile machinery, or anything else the
#        install needed. Smaller surface, fewer packages to scan.
#
#    ⚠️ WHAT THIS DOES NOT DO: it does not make the image distroless.
#    `docs/tech-stack.md` §13.1 wants "no package manager and no shell" in the
#    final stage, and this image has both — because `apk upgrade` needs the
#    package manager and because Alpine's node image is not distroless. That
#    half of G262 is UNMET and is named here rather than implied.
# ══════════════════════════════════════════════════════════════════════════

FROM node:22.22-alpine@sha256:e58326d0d441090181ac150dc2078d3e2cf6a0d42e809aebba3ef5880935ffdd AS deps

WORKDIR /app

# Manifest first, so a dependency change is the only thing that busts this layer.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev


FROM node:22.22-alpine@sha256:e58326d0d441090181ac150dc2078d3e2cf6a0d42e809aebba3ef5880935ffdd

# Patched base packages, taken at build time. See the block above for why this
# is here and what it costs.
RUN apk --no-cache upgrade

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./

# 🛑 THIS COMMENT READ "The three directories a plane needs, and no others. No
# `model/`, no `tests/`, no `tools/`, no `docs/` beyond the contracts." THE
# `model/` CLAUSE WENT FALSE DELIBERATELY AND IS CORRECTED HERE RATHER THAN
# DELETED, because it is the sentence a reader would have trusted.
#
# Excluding `model/` was right for as long as the planes served nothing that
# needed the engine's vocabulary. `server/data-plane/run-vocabulary.ts` ends
# that: `db/migrations/0002_run.sql` deliberately puts NO CHECK constraint on
# `run.status` or `run.trigger_kind` — "a third copy here would be a third place
# to drift" — so the only thing that can say whether a stored value is a run
# status is `model/domain.ts`, and it now says it at the read boundary. The
# import is a VALUE import (`RUN_TRIGGER_KINDS`), so this COPY is load-bearing:
# without it the data plane fails at container start with ERR_MODULE_NOT_FOUND
# rather than serving anything.
#
# `tests/`, `tools/` and the rest of `docs/` are still absent, and that half of
# the old sentence is unchanged.
COPY db ./db
COPY model ./model
COPY server ./server
COPY docs/contracts ./docs/contracts

# Neither plane runs as root. Both listen above 1024 for this reason.
USER node

# Deliberately absent: an ENV line setting RECONCILE_LOCAL_TEST_AUTH. The flag
# that makes a locally minted test token acceptable belongs in a local compose
# file, where its presence is visible, and nowhere else. An image that carried a
# default would put it in every deployment of that image.

# No default CMD. `compose.yaml` names `server/data-plane/main.ts` or
# `server/control-plane/main.ts` explicitly, because a default would make the
# wrong plane the easy mistake.
