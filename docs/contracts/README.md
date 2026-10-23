# Service Contracts

> **STATUS:** LIVING CONTROL
> **V1 AUTHORITY:** PARTIAL — authoritative for the runtime wire; **silent on the entire administration surface.**
> **This is the status block for all five YAML files as well.** They carry no banner of their own on purpose: a header inserted at the top of a `.yaml` shifts every line beneath it, and roughly sixty citations across this record address those files as `file.yaml:NNN`. Shifting them would produce exactly the defect `tools/check-citations.mjs` exists to catch — a citation that still resolves, to the wrong line, and reads valid.
>
> | File | STATUS | V1 AUTHORITY |
> |---|---|---|
> | `foundation.openapi.yaml` | LIVING CONTROL | PARTIAL — the foundation-tier boundary |
> | `capability.openapi.yaml` | LIVING CONTROL | PARTIAL — the only tier a customer's browser meets |
> | `control-plane.openapi.yaml` | LIVING CONTROL | PARTIAL — the cross-plane wire |
> | `data-plane-local.openapi.yaml` | LIVING CONTROL | PARTIAL — the Data Plane's local surface, added 10 Aug 2026 |
> | `errors.yaml` | LIVING CONTROL | YES — the single error vocabulary for every tier |
>
> ⚠️ **THERE ARE NOW FOUR OpenAPI TIERS, NOT THREE, AND THIS FILE SAID THREE
> THROUGHOUT UNTIL 10 Aug 2026.** The claims are corrected in place rather than
> deleted, because *"the three specs"* is a phrase this record leans on. The
> fourth is **`data-plane-local.openapi.yaml`** — 3 paths (`/health`, `/status`,
> `/metrics`), 3 operations. Its own `info.description` states the shape better
> than a paraphrase can: *"THE ONLY CONTRACT WHERE INBOUND ACCESS IS PERMITTED,
> BECAUSE THE CALLER IS THE CUSTOMER"* — served by the Data Plane directly inside
> the customer's own AWS account, *"never exposed to the public internet"*, and
> *"1CloudHub control plane never calls it"*. It exists so the customer's own
> infrastructure (ALBs, Prometheus scrapers, Datadog agents) can monitor Data
> Plane health with standard protocols; depending on the BYOA posture it is
> secured by the local VPC boundary or by an installation-provisioned API key. It
> declares **no `sessionContext` scheme**, so the three session-bearing tiers are
> still three.
> 🛑 **DO NOT READ THIS AS THE MISSING TIER CLOSING.** *"The tier that is
> missing"* below is **`administration.openapi.yaml`**, and it still does not
> exist. A local health probe is not an authoring, commercial, tenancy-admin,
> governance, telemetry-config or evaluation surface. **That gap is exactly as
> wide on 10 Aug as it was on 5 Aug.**
>
> ✅ **~~`control-plane.openapi.yaml` is DRIFTED BY ONE POLICY ARM, in nine places.~~ CLOSED 8 Aug 2026.** G79 created `managed_service_use` in `model/policy.ts` and the wire did not follow for part of a day: the narrative *"five, not seven"* stood in four places, and the policy-bundle schema's `required`, `properties`, `oneOf` and `discriminator.mapping` were each short one entry, with `ManagedServiceUseConfig` absent from the wire entirely — so **a client generated from that file could not express the only residency constraint v1's extraction engine has.** Now mirrored: the narrative reads *"six, not eight"*, `PolicyDefaults` requires all six, `PolicyConfig` carries six `oneOf` arms and six discriminator entries, and `ManagedServiceUseConfig` + `PolicyConfigManagedServiceUse` exist. **Verify element-for-element rather than trusting this line:**
> ```bash
> python3 -c "import yaml;d=yaml.safe_load(open('docs/contracts/control-plane.openapi.yaml'));print(d['components']['schemas']['PolicyDefaults']['required'])"
> awk '/^export const POLICY_KINDS = \{/,/^\}/' model/policy.ts | grep -cE "^  [a-zA-Z]+:"   # 8 declared, 6 live
> ```
> ⚠️ **The lesson survives the fix and is the reason this stays visible.** The drift was written as narrative prose — *"five, not seven"* — so `tools/check-doc-counts.mjs` could not have caught it even if it read YAML, and it reads Markdown only. **Nothing mechanical watches the model-versus-wire mirror today**; this was found by a person reading two files side by side, and the checker that would catch the next one is still owed (`docs/HANDOFF.md` §8 item 5).
> ⚠️ **The money retype is decided, BREAKING, and not applied to any contract file** — `amountMinor` moves from `integer` to a string, G65/G67, landing as the second of G78's two commits. **G112, 8 Aug 2026, fixes its blast radius: the retype follows the TYPE**, `amountMinor` and everything reachable through `Money`, not every field whose name ends in `Minor`. One named consequence in this directory — **`valueAtRiskAtLeastMinor` (`capability.openapi.yaml:550`) becomes `type: string` with a numeric pattern**; a query string carries text anyway and `type: integer` there was always a fiction. **G111** adds that exactly one money codec module may touch the representation, so every boundary in these contracts calls it and nothing else constructs a `Money` from a string or a string from a `Money`. **Neither is applied. `grep -c 'amountMinor' docs/contracts/capability.openapi.yaml` → 2, still `integer`.**
> ✅ **`administration.openapi.yaml` EXISTS — written 19 Sep 2026 under G288.** ⚠️ **This banner read *"DOES NOT EXIST and is the largest v1 gap"* and is corrected rather than deleted, because it is the sentence six documents cite.** It is **one** file with `x-plane` on every operation, as G76 requires. 🛑 **BUT G76's OTHER HALF IS NOT DISCHARGED: `tools/check-plane-tags.mjs` STILL DOES NOT EXIST**, and G76 says the checker *"must land in the same commit — a tag with nothing reading it asserts nothing."* What landed instead is `tests/contracts/administration-wire.test.mjs`, which reads the tag, asserts the `platform`/`tenant` verdict is an **iff** against `{tenantId}` in the route, and applies the no-tenant-business-data rule to **every** schema rather than only to `[platform]`-tagged ones — stronger than G76 asks, in the gate through `npm test`, and **in the wrong place**: G108 puts a checker in `npm run check` as its own stage, which is a `package.json` edit the slice that wrote the file was fenced out of. **The `tools/` checker is owed.** G89 adds that it inherits artefact-level versioning, which is cheapest to settle before the file is written. **G110, 8 Aug 2026, adds a second reason to want it:** the two pack-publication validators get **both** call sites — CI, and a publication seam that *refuses* — and the seam is partly blocked on this file. CI lands first; the seam follows. See "The tier that is missing", below.
> 🛑 **G113, 8 Aug 2026 — this file carried a claim its own contracts refute, and the claim is corrected below rather than deleted.** "One deviation exists" was false: there are two. See "Two conventions that carry invariants" → the control-plane paragraph. **The removal G113 orders is a BREAKING wire change and has NOT landed.**
> ⚠️ **Eighteen rulings were taken on 8 Aug 2026 — G96–G113 — and NOT ONE is applied to any file in this directory.** Four of them govern these contracts: **G110**, **G111**, **G112** and **G113**. Each is a build contract, not a landed change. `docs/HANDOFF.md` §3 is the authority on all four.
> *Banner added 8 Aug 2026; the design-record line below is preserved.*

> **Status:** design record. 5 Aug 2026.
> One OpenAPI document per tier, matching `docs/component-architecture.html`.

---

## Transport differs. Contract discipline does not.

Several of these services are **not HTTP APIs and must not become them.**
F4 Classification is called once per extracted field; F1 Tenant Context once per
request. Putting either on a network would be a latency disaster and would add a
failure mode where none needs to exist.

They are written as OpenAPI anyway, because the discipline is what matters: an
operation with a named request, a named response, an explicit error set and a
stated idempotency posture is a contract whether it crosses a socket or a
function boundary. Where the transport is genuinely in-process, the schema is the
TypeScript signature and the error enum is the thrown type.

| Transport | Services | Why |
|---|---|---|
| **In-process** | F1 F3 F4 F5 F11 F13 F14 | On the hot path, called many times per request |
| **Out-of-process, same account** | F12 | The sanitiser must hold **no credentials and no network egress**, which is only enforceable across a process boundary |
| **Network, AWS SDK** | F7 F8 F9 F10 | Already remote — Bedrock, S3, the telemetry backend |
| **Async, fire-and-forget** | F6 | Metering must never block a run, and must survive the control plane being down |
| **Public HTTP** | capability tier | What the browser calls. The only tier a customer sees |
| **Cross-plane HTTP** | control tier | Crosses an account boundary between two parties. **The only tier where OpenAPI is load-bearing rather than descriptive.** |
| **HTTP, inbound, VPC-local** | data-plane-local tier | The only contract whose caller is the **customer's own infrastructure**, reaching the Data Plane inside the customer's account. Never public, and never called by us. *Added 10 Aug 2026* |

---

## Two conventions that carry invariants

**`tenantId` appears in no request body, anywhere.** Not once, in any operation,
in any tier. Tenant scope is derived from the session by F1 and flows implicitly.
A request that could *state* its tenant is a request that could state the wrong
one — invariant 1, expressed as an absence rather than a comment.

**Errors are a closed enum, shared across every tier.** `docs/prompt-injection-posture.md`
§3 requires an exhaustive error taxonomy before launch, because under a
restrictive `SpanAttributePolicy` the error class is the only diagnostic channel
that survives redaction. That taxonomy is `ErrorCode` in these specs — the two
open items are the same item, and this is where it lives.

> ⚠️ **AND SINCE 21 Sep 2026 IT IS SHARED BY MIRROR RATHER THAN BY POINTER, ON
> THE SUCCESS SIDE — G1681, THE OWNER'S RULING.** *"Stop `$ref`-ing
> `errors.yaml` from success bodies. A success body carries its own closed enum
> rather than pointing at the error taxonomy."* **The sentence above is
> unchanged and still exactly true of the VOCABULARY**; what moved is how three
> documents reach it.
>
> 🛑 **THE REASON IS NOT STYLE — IT WAS A MEASURED HOLE IN THE SERVING LAYER.**
> `ErrorCode` is reused as a REASON CODE inside success bodies (`blockedBy`,
> `unavailableFor`, `rejectedFor`), `server/contract/bundle.ts` refuses an
> external `$ref` **by design**, so `responseSchemas()` dropped the whole
> response schema and Fastify fell back to `JSON.stringify`. **Seven MOUNTED
> operations therefore published success bodies that nothing validated** —
> a missing `required` field went out silently and an undeclared key was not
> stripped. `tests/http/required-fields-served.test.ts` §2 measured it at
> *21 of 28 serialising, 7 not*; it now reads **28 of 28, 0 not**.
>
> ⚠️ **`bundle.ts` IS NOT CHANGED AND ITS REFUSAL STANDS.** The `Problem`
> responses still `$ref` `./errors.yaml` — all 83 of them — and are still
> serialised by `server/http/problem.ts`, which is this file's existing
> *"a different route to the same document, not a second vocabulary"*.
>
> 🛑 **THE COPY IS A COST AND IT IS PAID RATHER THAN NAMED.** Three documents
> now carry a local `ErrorCode` (`capability`, `foundation`, `control-plane`),
> which is `db/migrations/0002`'s *"third place to drift"*.
> **`tests/contracts/success-body-error-codes.test.ts` §1 asserts SET EQUALITY
> WITH `errors.yaml` IN BOTH DIRECTIONS AND IN ORDER** — the same thing that
> makes `db/migrations/0008`'s seeded governance lists a MIRROR rather than a
> fork — and §2 asserts, by parsing rather than grepping, that **no success body
> in any tier reaches `errors.yaml` at all**.
>
> ⚠️ **THE COPY IS NOT NARROWED AND THE MEASUREMENT IS ON THE SCHEMA'S FACE
> (G1682):** only five of the 88 can reach a success body today, and a narrow
> copy was refused because one of the three fields has no producer at all, a
> `oneOf`-nested enum **is** enforced at serialisation so an under-guess is a
> 500 (G1683), and a narrow set has no checkable completeness direction.
> **This changed the POINTER, not the SURFACE.**
>
> ⚠️ **EACH COPY IS APPENDED AT THE END OF `components.schemas` (G1684)** rather
> than placed alphabetically, for the reason the `FieldPath` note below gives
> about line numbers: ~60 citations address these files as `file.yaml:NNN`.
>
> 🛑 **ONE SUCCESS BODY STILL REACHES ANOTHER DOCUMENT AND IS NOT THIS RULING'S
> (G1687):** `fetchEntitlementLeases` points at
> `./foundation.openapi.yaml#/components/schemas/Meter`. It is declared and
> unmounted, held out by name, and mounting it is a red.

---

## Files

| File | Tier | Status |
|---|---|---|
| `foundation.openapi.yaml` | F1–F14 | Written |
| `capability.openapi.yaml` | C1–C13 | Written |
| `control-plane.openapi.yaml` | X1–X8 | Written |
| `data-plane-local.openapi.yaml` | local — inside the Data Plane VPC, no service number | Written 10 Aug 2026 |
| `session.openapi.yaml` | A1–A4 — the way in, the tier that ISSUES the session the others demand | Written 23 Aug 2026, #230/#231. ⚠️ **THIS ROW DID NOT EXIST UNTIL 19 Sep 2026** and neither did any mention of the file in this table, while it sat in `TIERS` and in the gate — the omission class this record catalogues, arriving in the one table that exists to enumerate the corpus. `tools/check-doc-counts.mjs` cannot catch it: an absent row has no number in it |
| `administration.openapi.yaml` | the two control-plane consoles — P partner portal, S staff console | **Written 19 Sep 2026, G288.** ⚠️ *This cell read "the setup surface" and "**Does not exist**"* — the first half was a scope claim it never met and is corrected with it: the tenant-admin setup surface is still owed. ✅ **REGISTERED IN `TIERS` SINCE G533**, and ⚠️ *this cell read "🛑 **NOT REGISTERED IN `TIERS`**, so `loadTier()` cannot read it and `tools/check-capability-annotations.mjs` cannot see one of its 59 operations" until 19 Sep 2026* — corrected rather than deleted, because it is the sentence that told a reader a third of the surface was invisible to the gate, and it was true when written. ⚠️ **AND IT DECLARES 45, NOT 59**: fourteen moved to `platform-console.openapi.yaml` in the split below. `TIER_REQUIRES_CAPABILITY` is `false` and all 45 state an exemption |
| `platform-console.openapi.yaml` | the staff console's platform-role half — S staff console | **Written 19 Sep 2026, the owner's split ruling.** 🛑 **THE SECOND TIER IN THE CORPUS WHOSE `TIER_REQUIRES_CAPABILITY` WAS `true`** — ⛔ **AND THAT TABLE IS RETIRED, G911, 20 Sep 2026: the gate verdict comes from the OPERATION, so this document’s existence is no longer what gates its fourteen. It is NOT un-split, because that is a separate ruling** —, and it exists for that reason alone: the verdict is per FILE, so gating fourteen of `administration.openapi.yaml`'s operations meant making them a different file. The owner's own objection stands on the document's face — *"it is still contract surgery and still a ruling."* ⚠️ **THE RULING SAID 26 AND IT TAKES 14**: twelve `platform-role` operations act on a class `PLATFORM_ASSIGNMENT_REACHES` refuses, or on `commercial`, which it opens and which has no WRITE verb. Declared, annotated, registered, **mounted by nothing** |

The control-plane file was the one to get right first: it is the only contract
with two parties, and the only one where a breaking change lands in an account
we cannot reach.

It carries a third convention the other tiers do not need. **Every operation is
data-plane-initiated**, so pack, policy, lease and grant distribution are
modelled as a *pull* by the plane rather than a push by us. `dataPlaneId`
therefore appears in no request body either — it is derived from the SigV4
principal, exactly as `tenantId` is derived from the session.

> ✅ **G185, 12 Aug 2026, TURNS THAT CONVENTION INTO THE DATABASE RULING — and
> nothing in this paragraph went false, which is why it is left exactly as
> written and annotated instead.** The ruling **retires `control_ro`**, the
> read-only database role by which the hosted data plane was to read control-plane
> tables directly, and replaces it with **a signed HTTPS pull into a
> data-plane-local projection**. The decisive evidence is in this very file's
> operations: `docs/data-architecture.md:127` argued that `control_ro` *"means
> hosted and BYOA are the same code path"*, and **that was false** — a BYOA plane
> runs in the customer's AWS account where **no `control` schema exists to grant
> against**, so it must already fetch over `/catalogue/packs`
> (`control-plane.openapi.yaml:509`) and `/policy/bundle` (`:660`). **There were
> always two code paths while that section claimed there was one.** The pull —
> this tier's own convention — is the shape that genuinely unifies them.
> 🛑 **Nothing of G185 is built**, and **no operation in this directory changes
> because of it**: the endpoints it leans on already exist and already carry the
> pull posture. The rest of the ruling — the database splits **by residency
> region, not by plane**, the schema-and-role grant survives, the `tenant` row is
> control-owned with a narrow data-plane projection of `id`, `status`,
> `residency` — lands in `db/` and `docs/data-architecture.md`, not here.
> `docs/HANDOFF.md` §3, row **G185**, is the authority.

> 🛑 **~~One deviation exists, `tenantRef` on the usage event stream, and it is
> argued at the point of use.~~ THAT SENTENCE WAS FALSE. THERE ARE TWO.**
> **Corrected 8 Aug 2026 under G113.** It is struck through rather than deleted
> because it is a worked instance of `docs/HANDOFF.md` **§5.4 — a claim asserted
> in a document that the contracts refute** — and because **the identical
> sentence is still live in the contract itself**, at
> `docs/contracts/control-plane.openapi.yaml:67`, where it is not this file's to
> correct.
>
> A recursive `$ref` scan of **all 37 request bodies** across the three specs as
> they stood on 8 Aug 2026
> found `tenantRef` in exactly two, both in the control plane. (⚠️ *A fourth spec,
> `data-plane-local.openapi.yaml`, landed 10 Aug 2026 and has **not** been
> rescanned — its three operations are `get`s with no request body, so the
> finding is unlikely to move, but the scan is owed.*)
>
> ⚠️ **EVERY LINE NUMBER IN THE TABLE BELOW WAS WRONG UNTIL 12 Aug 2026, AND THEY
> ARE CORRECTED RATHER THAN QUIETLY RESTATED.** They read `:1186`, `:1188-1201`,
> `:1612`, `:1610`, `:649`, `:1452` and `:2326` — written before the two X8
> diagnostic operations landed on 10 Aug 2026 and shifted everything beneath them.
> 🛑 **NOT ONE OF THE SEVEN FAILED `npm run check:citations`, AND THIS BLOCK
> CLAIMED ONE DID.** The corrected reading is worse than the claim it replaces, which
> is why it is written out rather than quietly amended. It read: *"Only one of the
> seven failed (`:1186`, which happens to land on a blank line); the rest resolved, to
> the wrong declaration."* **Two things are wrong with that.** First, the checker
> **cannot fail on this class at all** — `tools/check-citations.mjs:27` states
> *"Exit 1 on any DEAD. SUSPECT never fails the run — it is a reading list"*, and a
> live-but-blank line is SUSPECT. Second, **five of the seven were never examined**:
> the matcher at `tools/check-citations.mjs:64` requires a filename ending `.ts` or
> `.yaml`, so bare-colon shorthand of the form `:1188-1201` is **not a citation to
> this tool** and was never resolved. So the true position is that **the checker was
> silent on all seven** — two it could see and rated SUSPECT, five it could not see at
> all — and every one of them resolved to the wrong declaration. Derive them
> rather than copying them:
> `grep -n 'tenantRef' docs/contracts/control-plane.openapi.yaml`.
>
> | Field | Operation | Verdict |
> |---|---|---|
> | `PlaneUsageEvent.tenantRef` — `control-plane.openapi.yaml:1243` | `POST /usage/events` | **Argued at the point of use**, at `:1245-1258`: a hosted plane is multi-tenant and ships usage for many tenants in one batch, with no session left to derive scope from at ship time; a BYOA plane has one tenant and still states it, so one code path serves both topologies. The contract calls it *"an ATTRIBUTION LABEL ON A COUNTER, not a scope assertion"* and binds every ref to the calling plane at provisioning. **It earned its exception. It stays.** |
> | `InstallationReport.tenantRef` — `control-plane.openapi.yaml:1669` | `POST /catalogue/installations` (`:618`) | A bare `{ type: string }` with **no argument anywhere** — not at the field, not at the operation, not in this file. An installation report is one plane reporting one installation, and the session already names the tenant. **G113 rules it OFF.** |
>
> **G113 in one sentence: an undefended deviation from invariant 1, on the only
> contract that crosses an account boundary, is removed rather than documented.**
>
> ⚠️ **NOT APPLIED. It is a BREAKING wire change and nothing has moved.** The
> field is still declared at `:1669` and still listed in
> `InstallationReport.required` at `:1667`. Three edits land together, and none
> of them is this one — a Markdown file cannot make a wire change:
>
> 1. `tenantRef` comes off `InstallationReport.properties` **and** off its
>    `required` array (`control-plane.openapi.yaml:1667` and `:1669`).
> 2. The narrative at `control-plane.openapi.yaml:67` is corrected to say the
>    deviation is one and to name it.
> 3. This block is rewritten to describe the wire as it then is.
>
> G113 carries a precondition on top: **confirm no batching case exists** for
> installation reports before landing it.
>
> Reproduce. The shallow grep returns ten hits, of which only these two are
> request-body fields — `:443` (prose), `:1509` and `:2383` are **outputs**,
> where the plane is told which tenant a lease or grant is for and never asks
> (⚠️ *the last two read `:1452` and `:2326` until 12 Aug 2026; both still
> resolved, to the `required:` list rather than the property*):
>
> ```bash
> grep -n 'tenantRef' docs/contracts/control-plane.openapi.yaml
> python3 -c "import yaml;s=yaml.safe_load(open('docs/contracts/control-plane.openapi.yaml'))['components']['schemas'];print([k for k in ('PlaneUsageEvent','InstallationReport') if 'tenantRef' in s[k]['properties']])"
> ```

> 🛑 **A SECOND DEFECT ON THE SAME FILE, FOUND 12 Aug 2026 AND NOT FIXED: TWO
> DANGLING `$ref`s.** `control-plane.openapi.yaml` references
> **`DiagnosticJobSet`** and **`DiagnosticBundleMetadata`** and **defines
> neither** — `#/components/schemas/…` targets that resolve to nothing, so **a
> client generated from this file does not build**. They are not incidental
> schemas: they belong to the two X8 diagnostic operations that landed on 10 Aug
> 2026 — `fetchDiagnosticJobs` (`GET /access/diagnostic-jobs`, `:828`, response
> body at `:850`) and `uploadDiagnosticBundle` (`POST /access/diagnostic-bundles`,
> `:854`, request body at `:870`) — **the only two operations that move telemetry
> across the account boundary**, on the one tier where OpenAPI is load-bearing
> rather than descriptive. Reproduce — the command lists every referenced schema
> that is not defined:
>
> ```bash
> comm -23 \
>   <(grep -oE "#/components/schemas/[A-Za-z0-9_]+" docs/contracts/control-plane.openapi.yaml | sed 's|.*/||' | sort -u) \
>   <(grep -oE "^    [A-Za-z0-9_]+:" docs/contracts/control-plane.openapi.yaml | tr -d ' :' | sort -u)
> ```
>
> It prints four names. **`ErrorCode` and `Problem` are FALSE POSITIVES** — they
> resolve through `./errors.yaml`, which this grep cannot follow. The two real
> ones are `DiagnosticJobSet` and `DiagnosticBundleMetadata`.
>
> 🛑 **NO CHECKER WILL EVER CATCH THIS, AND THAT IS THE POINT OF RECORDING IT
> HERE.** `tools/check-wire-mirror.mjs` **does not resolve `$ref`** — its own
> header says so, *"a line scanner, not a type checker and not a full YAML
> parser"* — which is precisely **G109's unbuilt half**: the ruling takes a real
> YAML parser, pinned exact, *because* the mirror check must follow `$ref`
> chains, and it was not followed. So `npm run check` is **green over a contract
> with two unresolvable references**. This is the same shape as the paragraph
> above it, one layer down: the fix is a checker nobody has written, and until
> then the only control is a person running the command. `docs/HANDOFF.md` §8
> item 5, and §5.6 — a control that passes while asserting nothing.
>
> ⚠️ **Scope, stated so nobody over-reads it.** The scan above is of
> `control-plane.openapi.yaml` only. The other three OpenAPI files have not been
> scanned this way, and **a clean result on this one file would not have been
> evidence about them.** Fixing the YAML is not this file's to do — it is the
> two schema definitions, in the contract.

That file also **extends the shared `ErrorCode` enum by thirteen codes**, which
were added *here*, in `foundation.openapi.yaml`, rather than duplicated. A code
that means one thing in a trace and another in a ticket is worse than no code,
and a data plane emits several of them into `DataPlaneHeartbeat.errorCounts`
regardless of which tier raised them.

### A field path is a TOKEN LIST on the wire — G244, 23 Aug 2026

**`FieldSegment`, `FieldPath` and `FieldPathKey` are declared in
`foundation.openapi.yaml` and mirror `model/kernel.ts`.** G214 retyped `FieldPath`
from `string` to a branded token list on 22 Aug 2026 and the tiers went on
describing a plain string; G244 closes that at **thirteen sites across two tiers** — five in foundation, eight in capability.
Derive them rather than reading a list:
`grep -rn 'schemas/FieldPath' docs/contracts/`.

🛑 **`tools/check-wire-mirror.mjs` reported `DRIFT (0)` throughout, and it was not
broken.** It is a line scanner over literal-union enums and does not resolve
`$ref` — G109's `$ref` half is open and the checker says so in its own header — so
it was reporting truthfully about the twenty pairs it compares, and this was not
one of them. **A green control over a divergence it cannot reach is the most
dangerous shape a control has, because the green is real.** The control that does
reach it is `tests/contracts/field-path-wire.test.ts`, which validates paths
`parseFieldPath()` produced against the contract's own bundled schema, through the
same ajv a plane runs.

⚠️ **THE CAPABILITY TIER CARRIES A SECOND, STRUCTURAL COPY, AND THAT IS A COST
RATHER THAN A CHOICE.** Unlike `ErrorCode` above, this one could not be shared:
`server/contract/bundle.ts` throws on any cross-file `$ref`, deliberately, and
`OutboundDraft.includeFields` is reachable from the request bodies of
`checkOutboundDisclosure` and `sendOutboundMessage` — so a `./foundation…` pointer
there makes both operations **unmountable**, which
`tests/contracts/request-body-schema.test.ts` catches as a boot failure waiting to
happen. §3 of the field-path test asserts the two copies are structurally
identical, so **change both or neither**. When the bundler learns to resolve a
cross-file pointer, the copy collapses to a `$ref`.

🛑 **NO WILDCARD — G243.** A segment is a key or a zero-based index. `[]` meaning
"every element" was explicitly refused, because a `FieldSpec` must name ONE field:
G222 rules an outbound `DataClass` is the maximum over the `FieldSpec` classes
carried, and a maximum over a set is computable only if each path names one field.
Do not add `[]`, `each` or `*` to either copy.

⚠️ **ONE QUESTION IS FLAGGED AND NOT ANSWERED.** A JSON property name is a string,
so the three path-KEYED objects — `applyCeiling`'s `values`, `Document.extracted`,
`Document.lines[].fields` — key by `FieldPathKey`, the one-way token. Carrying it
across a boundary asks every client to implement the encoding a second time, which
is what G214 exists to prevent; the alternative is an array of `{path, value}`
entries, a **breaking** restructure nobody has ruled. It is recorded on
`FieldPathKey`'s own description rather than decided by a mirroring commit.


---

## The tier that is missing

✅ **THIS SECTION'S FINDING IS CLOSED — G288, 19 Sep 2026 — AND THE HEADING IS
KEPT BECAUSE SIX DOCUMENTS CITE IT BY NAME.** It read, and had read since 5 Aug:

> A coverage pass on 5 Aug compared every exported interface in `model/` against
> every path in the specs. **All 76 operations are runtime. None is
> administration.** *(72 until 23 Aug 2026.)*

**`administration.openapi.yaml` EXISTS**, contributing 52 of the tree's **125**
paths and 59 of its **136** operations — ⚠️ **the two denominators read 124 and
135 until G512 added `grantRoleAssignment` to the CAPABILITY tier; this file's
own 52 and 59 are untouched, which is why the numerators and the denominators
have to be derived apart** — one file with
enforced plane tags under G76 — the partner portal's nine destinations and the
staff console's six, derived from `docs/handoff-pack/` rather than invented.
Derive it: `grep -c 'operationId:' docs/contracts/administration.openapi.yaml`.

🛑 **BUT READ WHICH HALF CLOSED, BECAUSE THE TABLE BELOW IS STILL MOSTLY
ACCURATE.** The gap this section describes is *"the setup surface… most of what a
forward deployment engineer touches, and **all of what a tenant admin
touches**"*, and the new tier covers **neither of those two audiences**. It
covers the two CONSOLES — 1CloudHub staff, and partners. Row by row:

| Absent surface | Now |
|---|---|
| **Authoring** | 🟠 **PARTLY.** The pack's agent builder is declared — pack drafts, rules, publication — and that is PLATFORM authoring on the `catalogue` class. **A tenant authoring its own definitions still has no path**, which is G58's surface and is untouched. |
| **Commercial** | 🟠 **PARTLY.** Staff read the period, invoices and partner settlement, and raise adjustments; partners read commission, cards and the arrangement. **A tenant admin still cannot see an invoice** — the original complaint, verbatim, still stands. |
| **Tenancy admin** | 🟠 **PARTLY.** Staff create tenants and drive onboarding; partners manage their own portal roster. **`User`, `Membership` and `TenantContact` inside a tenant are untouched** — no tenant user management. |
| **Governance** | 🛑 **NO, AND DELIBERATELY.** `place_legal_hold` and `handle_subject_request` are classed `statutory`, which invariant 8 puts beyond reach at any price; `tests/contracts/administration-wire.test.mjs` assertion F pins the absence by name. The pack agrees — its own staff palette carries *"Answer a subject request — refused · statutory, and not ours to do."* |
| **Telemetry config** | 🛑 **NO.** The profile is SET at tenant creation and there is no amendment operation; reading a trace is refused twice over — see the new file's §6. |
| **Evaluation** | 🛑 **NO.** `Scorer`, `EvaluationGate`, `InjectionProbe` and `SeededExample` still reach no path. |

**So the sentence to carry forward is not "none is administration" but: the
CONSOLE half is declared and the CUSTOMER-PLANE half is still owed.**

> Corrected 5 Aug: this read "62 operations", conflating operations with paths.
> Verified by `grep -c 'operationId:'` it was then **65 operations across 62
> paths** — foundation 17, capability 36 over 33 paths, control plane 12. Three
> capability paths carry two methods. `docs/HANDOFF.md` had it right. The finding
> is unaffected; the number had already propagated into a decision record.
>
> ⚠️ **Corrected again 10 Aug 2026 — it is now 70 operations across 67 paths**,
> and this sentence said *"All 65 operations"* and *"the three specs"* until then.
> `control-plane.openapi.yaml` gained two X8 diagnostic operations (12 → 14) and a
> **fourth spec** landed, `data-plane-local.openapi.yaml`, 3 over 3.
> 🛑 **THE FINDING IS UNAFFECTED AND THE GAP DID NOT NARROW.** The fourth spec is
> customer-facing liveness and telemetry, not administration; **`administration.openapi.yaml`
> still does not exist**, and every absent surface in the table below is absent on
> exactly the same terms. Derive both numbers:
> `for f in docs/contracts/*.openapi.yaml; do grep -cE '^  /' $f; done` → 33 + 14
> + 3 + 17 = 67, and `grep -c 'operationId:'` per file → 36 + 14 + 3 + 17 = 70.
>
> ⚠️ **CORRECTED AGAIN 16 Aug 2026 — 72 operations across 69 paths**, and the two
> arithmetic lines directly above are left as the 10 Aug history they narrate
> rather than rewritten, because each is bound to the date on its own sentence.
> The capability tier went 33 → **35** paths and 36 → **38** operations:
> `GET /runs/{runId}/account` (`getRunAccount`) and `GET /runs/{runId}/residue`
> (`listRunResidue`), under C5, carrying the reconciliation engine's own
> vocabulary for the first time anywhere on the wire. 🛑 **THE FINDING IS AGAIN
> UNAFFECTED.** Both are tenant-facing runtime reads; `administration.openapi.yaml`
> still does not exist. Derive it now with
> `grep -rh 'operationId:' docs/contracts/*.openapi.yaml | wc -l` → 72 and
> `for f in docs/contracts/*.openapi.yaml; do grep -cE '^  /' $f; done`
> → 35 + 14 + 3 + 17 = 69.

Every contract written describes a reconciliation *happening*. Nothing describes
setting the system up — and the setup surface is most of what a forward
deployment engineer touches, and all of what a tenant admin touches.

| Absent surface | Types with no path | Who needs it |
|---|---|---|
| **Authoring** | `ReconciliationDefinition` · `MatchRule` · `DocumentType` · `Procedure` (create/read/update) · `Policy` | The FDE. Step 6 of the onboarding journey — *"configure, and only configure"* — has no API at all. `/authoring/validate` validates a procedure that no operation can create. |
| **Commercial** | `RateCard` · `Plan` · `Subscription` · `BillingPeriod` · `RatedTotal` · `Budget` | Platform and partner admins. X5 was correctly declared to have no *plane-facing* operation; it has no admin-facing one either, so nobody can see an invoice. |
| **Tenancy admin** | `User` · `Membership` · `Account` · `Partner` · `TenantContact` | Tenant admins. No user management, and the contacts added to fix escalation cannot be created. |
| **Governance** | `LegalHold` · `DataSubjectRequest` · `EvaluationTerms` | Compliance. Erasure can be *planned* and not executed; access and correction requests — the two obligations PDPA actually imposes alongside erasure — have no path. |
| **Telemetry config** | `TelemetryPolicy` · `SpanAttributePolicy` · `TelemetryExport` | The FDE at onboarding step 9, which the day-2 record calls a **contractual** choice rather than a technical one. |
| **Evaluation** | `Scorer` · `EvaluationGate` · `InjectionProbe` · `SeededExample` | Pack authors. The injection corpus cannot be managed, so the gate that depends on it cannot be populated. |

> 🛑 **THE TABLE ABOVE DOES NOT NAME THE INTAKE SURFACE AT ALL, AND THAT OMISSION
> STOPPED BEING SAFE ON 14 Aug 2026 — G203.** `Endpoint`, `IntakeChannel` (G184)
> and the new `Arrival` (G205) are absent from every row, because when this table
> was written the connections surface was **FDE-only** under G59 and the paragraph
> above it splits the absent surface into *"what a forward deployment engineer
> touches"* and *"what a tenant admin touches"*. **G203 reopens G59 and moves
> connections onto the customer side of that split**, which makes the omission a
> customer-facing gap rather than an internal one. **The row is not added here**,
> because doing so would falsify *"one coherent gap rather than six"* immediately
> below and the gap genuinely is the same one — `administration.openapi.yaml`.
> **It is recorded instead, in the place a reader counting absent surfaces will
> look.**
>
> ⚠️ **Two of the rulings add surface this table has no row for either.** G203
> needs a **read** verb for an endpoint — there is no `view_endpoint`, so read is
> implied by write — and G206 lets a pack **declare classification rules**, which
> is a new authored surface with no path and, more urgently, **no checker**:
> `tools/check-pack-safety.mjs` is G110's CI half and does not know the shape
> exists. **A rule that lives only in a ruling is a validator with no call site.**

This is one coherent gap rather than six, and it is **a file of its own**:
`administration.openapi.yaml`. It was not an oversight in the runtime specs — they
were scoped to the tiers in the component architecture, and the component
architecture is itself organised around the request path. The setup path was
never drawn, in that diagram or in these contracts.

> ⚠️ **This paragraph called it *"a **fourth** file"* and *"the three specs"*
> until 10 Aug 2026.** A fourth OpenAPI file now exists and **it is not this
> one** — `data-plane-local.openapi.yaml` is the Data Plane's local health and
> telemetry surface. The wording is loosened rather than renumbered so that no
> reader can mistake the arrival of a fourth file for the closing of this gap.
> **The administration tier remains unwritten and remains the largest v1 gap.**

Worth noting *why* it stayed invisible: every review so far has followed a
reconciliation through the system. Nothing has followed a customer through
onboarding, except the journeys document — which is exactly where the
unmodelled steps showed up first.
