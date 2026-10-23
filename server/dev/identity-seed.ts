/**
 * THE SEEDED SUBJECT — G299's TESTABILITY ARGUMENT, AS ROWS.
 *
 * G299 rules the identity TABLES land before Cognito, and the whole of its
 * argument is this file's reason to exist:
 *
 *     "The argument is testability: **the gate starts saying yes to a seeded
 *      subject before any identity provider exists**, so every arm is exercised
 *      end to end against a substrate we control before a federated token is in
 *      play."
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 A SEEDED PRODUCTION SUBJECT IS THE WHOLE PRODUCT COMPROMISED. READ THE
 *    FENCE BEFORE READING ANYTHING ELSE IN THIS FILE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This module writes a person, a directory, a role carrying a real capability,
 * a live assignment and a LIVE SESSION ROW whose handle is written down three
 * paragraphs below. Anything that can run it can authenticate as that person
 * and hold that verb. **So it is fenced twice, structurally, and neither fence
 * is a condition inside a request handler.**
 *
 * ┌─ FENCE 1 · THE MODULE GRAPH, WHICH IS G192's SHAPE COPIED EXACTLY ─────────┐
 * │  Nothing under `server/data-plane/**` STATICALLY IMPORTS anything under    │
 * │  `server/dev/**`. This file is reached from `server/data-plane/            │
 * │  migrate-main.ts` through a DYNAMIC import that executes only when         │
 * │  `RECONCILE_LOCAL_TEST_AUTH` is exactly the string `1` — the same literal  │
 * │  comparison, against the same one variable, that `server/data-plane/       │
 * │  session.ts` uses for the test token. A process started without it never   │
 * │  LOADS this file, so there is no seeding code path in it to reach, bypass  │
 * │  or mis-review. Reproduce the structural half:                            │
 * │                                                                            │
 * │      grep -rn "from '\.\./dev/" server/data-plane/     # returns nothing   │
 * │                                                                            │
 * │  ⚠️ NOT A NEW FLAG, AND THAT IS DELIBERATE. A second variable would be a   │
 * │  second thing an image, a task definition and an auditor each have to be   │
 * │  checked for. `RECONCILE_LOCAL_TEST_AUTH` is already absent from the       │
 * │  image and from every task definition, and G192 records that *"its absence │
 * │  is a thing an auditor can read."* One absence, two fences.               │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ FENCE 2 · THE CREDENTIAL, WHICH IS STRICTLY STRONGER THAN FENCE 1 ────────┐
 * │  Every write below runs as `reconcile_migrator` — `LOGIN BYPASSRLS` —      │
 * │  through `migratorClient()`. **No serving process holds that credential.** │
 * │  G193 moved the dangerous work into one-shot jobs precisely so that *"the  │
 * │  window in which those credentials are resident is the length of a         │
 * │  migration rather than the uptime of a server"*, and                       │
 * │  `tests/http/local-stack-exposure.test.ts` walks the import closure of     │
 * │  both entry points to keep it that way.                                    │
 * │                                                                            │
 * │  🛑 AND IT IS NOT MERELY CONVENTION — IT IS WHAT THE GRANTS MAKE POSSIBLE. │
 * │  `db/migrations/0009_identity_substrate.sql` grants the app role `SELECT`  │
 * │  and nothing else on all eight tables. **A serving process cannot write a  │
 * │  role assignment even if it wanted to**, which is the property that note   │
 * │  spells out: *"a request path that could write `role_assignment` could     │
 * │  grant itself any capability in the closed set, and `decide()` would then  │
 * │  permit it CORRECTLY."*                                                    │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ THE HANDLE IS A PUBLISHED CONSTANT AND THAT IS THE SAME DECISION
 * `server/dev/test-token.ts` MAKES ABOUT ITS SIGNING KEY, WITH ITS ARGUMENT:
 * *"A secret default would suggest the KEY is the security boundary. It is not:
 * the FLAG is."* A seeded handle that looked secret would invite somebody to
 * treat *"we rotated the fixture"* as a control. It is not a control. The flag
 * is, the credential is, and the compose stack's loopback binding is.
 *
 * ✅ **IT SEEDS A PLATFORM ROLE ASSIGNMENT SINCE 21 Sep 2026 — R-P, THE OWNER'S
 * RULING — AND THE REFUSAL BELOW IS CORRECTED RATHER THAN DELETED, because it
 * is the sentence a reader would have quoted onward and because its RULE is
 * the reason the correction is legitimate.** IT READ:
 *
 *     "🛑 WHAT THIS FILE DOES NOT DO, AND MUST NOT BE EXTENDED TO DO: it does
 *      not seed a PLATFORM role assignment. G289's arm can reach exactly one
 *      resource class (`commercial`) and no mounted operation needs it, so a
 *      seeded staff principal would be authority nobody asked for, sitting in
 *      a fixture, waiting to be copied into somewhere real. `tests/`
 *      constructs one where it is under test and nowhere else."
 *
 * 🛑 **BOTH OF ITS PREMISES WENT FALSE AND NEITHER WAS OVERRULED — THE ROW IS
 *    DISCHARGED BY ITS OWN CONDITION, WHICH IS `SEED_CAPABILITIES`' RULE
 *    APPLIED ONE TABLE OVER:** *"The seed tracks the mount table; it does not
 *    lead it."*
 *
 *   · *"can reach exactly one resource class (`commercial`)"* — **G601 opened
 *     `substrate` and `catalogue` and minted five verbs.**
 *     `PLATFORM_ASSIGNMENT_REACHES.substrate` is `true`.
 *   · *"no mounted operation needs it"* — **`listTenants` is MOUNTED** (G1241)
 *     and is annotated `view_substrate`. Derive it, never read it:
 *     `node tools/served-set.mjs` → 30 of 136, by tier. ⚠️ A recursive grep
 *     for the handler key stood here with its slash written as an HTML entity
 *     to survive a block comment, which left this header inside the scope of
 *     the unescaped form — G2081, 23 Sep 2026.
 *
 * ⚠️ **AND THE CONSEQUENCE OF NOT SEEDING ONE WAS NOT NEUTRAL, WHICH IS WHY
 *    THIS IS A PREREQUISITE AND NOT A CONVENIENCE.** Nothing in `db/` or
 *    `server/` had ever written a `platform_role_assignment` row, so **every
 *    console operation, the already-mounted `listTenants` included, refused
 *    every real caller** at `platform_assignment_absent`. A mounted operation
 *    nobody can call is not a served operation.
 *
 * ⚠️ **DERIVE THAT WITH THE COMMAND BELOW AND NOT WITH THE OBVIOUS ONE, WHICH
 *    THIS VERY PARAGRAPH WOULD CORRUPT — G978's SHAPE, AVOIDED RATHER THAN
 *    DISCOVERED.** A recursive grep for the INSERT statement over `server/`
 *    matches PROSE ABOUT the insert as readily as the insert, and a header
 *    quoting the command in order to explain it is itself a hit — which is how
 *    `grep -rn 'jwtVerify\|createRemoteJWKSet' server/` came to return three
 *    lines, all three of them prose, while claiming to prove an absence. Count
 *    the STATEMENT by its opening parenthesis instead, which no sentence here
 *    writes:
 *
 *        grep -rc 'INTO tenant.platform_role_assignment$' server/dev/identity-seed.ts
 *
 *    → **1**, and it was **0** everywhere in `db/` and `server/` before R-P.
 *
 * 🛑 **THE REFUSAL'S REMAINING WORRY IS REAL AND IS ANSWERED BY THE FENCES AND
 *    NOT BY THIS PARAGRAPH: *"authority nobody asked for, waiting to be copied
 *    into somewhere real."*** Both fences above bind this block exactly as they
 *    bind the rest of the file — the flag and the migrator credential — and the
 *    assignment carries **`view_substrate` and nothing else**, which is a READ
 *    of which tenants exist. `provision_substrate`, `author_catalogue` and
 *    `publish_catalogue` are DELIBERATELY ABSENT: G601 records that
 *    `publish_catalogue` is invariant 6's risk *"and G110's publication seam
 *    does not exist"*, and a fixture carrying a verb no operation mounts is the
 *    thing the corrected note was right to refuse.
 *
 * ⚠️ **DEPLOYED STAGING STILL HAS NO CONSOLE PRINCIPAL AFTER THIS, AND THAT IS
 *    A SECOND RULING NOBODY HAS TAKEN.** This file is reached only behind
 *    `RECONCILE_LOCAL_TEST_AUTH=1`, which is absent from the image and from
 *    every task definition — G192's *"its absence is a thing an auditor can
 *    read"* — so `reconcile-planes-staging` serves `listTenants` to nobody, and
 *    **local green is not a deployed capability.** Whoever needs a staff
 *    console in staging needs a ruling on where a real platform assignment
 *    comes from, not a copy of this block.
 */

import { migratorClient } from '../../db/provision.ts'

/**
 * The tenant the seeded person belongs to. `seedTwoTenants()` creates the row;
 * this file does not, because a fixture that created its own tenant would
 * diverge from the one every other suite uses.
 */
export const SEED_TENANT = 'ten_acme'

/** The directory. A CUSTOMER-owned connection, so `orgFor()` derives `customer`. */
export const SEED_CONNECTION = 'idc_acme_entra'

/**
 * THE BROKER THE SEEDED DOOR SITS BEHIND — G304, 19 Sep 2026.
 *
 * 🛑 IT NAMES NO REAL POOL AND MUST NOT. `us-west-2_LOCALSEED` is not an
 * account's pool id and `AWS_PROFILE=crm-frontend` cannot be pointed at it;
 * the fence on this file is the FLAG and the CREDENTIAL, and a fixture
 * carrying a real issuer would invite somebody to read this seed as the
 * deployed configuration. G302 deploys a pool with **zero identity
 * providers** — *"NOBODY CAN SIGN IN AND THAT IS THE DEPLOYED STATE"* — so
 * there is no real provider name for this to be, either.
 *
 * ⚠️ BOTH HALVES, BECAUSE G305's RULE IS BOTH DIRECTIONS. `oidc` is a
 * brokered protocol; a seeded `oidc` row with neither column is
 * `broker_unresolvable` and the seeded subject stops resolving on its first
 * request. That is the rule working, and it is confusing at 2am — hence this
 * note, in the same spirit as `SEED_HOST`'s.
 */
export const SEED_BROKER_ISSUER =
  'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_LOCALSEED'

/** The name the broker gives the seeded directory. Cognito's `ProviderName`. */
export const SEED_BROKER_REF = 'acme-entra-local-seed'

/** The person. Active. */
export const SEED_USER = 'usr_ops_mei'

/** The role, and the ONE verb it carries. */
export const SEED_ROLE = 'rol_ap_approver'

/**
 * THE VERBS THE SEEDED ROLE CARRIES — **one for each capability the capability
 * tier actually MOUNTS, and not one more.**
 *
 * 🛑 THIS WAS `admit_source` ALONE UNTIL 19 Sep 2026 AND THE LINE THAT CHOSE IT
 *    HAD GONE FALSE. It read: *"the capability `listRuns` and `getRun` are
 *    annotated with, which is the whole point: the two operations this
 *    repository actually mounts on the capability tier are the two a seeded
 *    subject can now reach."* **Eight operations are mounted on that tier, not
 *    two** — G300's row records the served set moving 5 → 7 → 11 — and the four
 *    G357 added are annotated `view_exception` and `assign_exception`, which
 *    this seed did not carry. So the shipping seed produced a subject that was
 *    **403 on the product's own operator surface**, which
 *    `docs/build/deploy-handoff.md` §5a calls *"the product's actual operator
 *    surface"*. The sentence is corrected rather than deleted because it is the
 *    one that explains why only one verb was ever here.
 *
 * ⚠️ AND THE DEFECT WAS INVISIBLE TO EVERY TEST, WHICH IS WHY IT SURVIVED.
 *    `tests/e2e/browser-login.test.ts` seeds its OWN three capability rows and
 *    never loads this module; `tests/http/` suites build their own substrates.
 *    **Nothing in the gate drives the shipping seed**, so the only observer was
 *    a person running the local stack by hand — which is exactly who this file
 *    exists for.
 *
 * 🛑 THIS IS NOT CAPABILITY GRANTING AND MUST NOT BE READ AS IT. The owner's
 *    ruling of 19 Sep 2026 is that a request path should be able to confer a
 *    capability; **that is blocked** — see `tests/db/administrative-reach.test.ts`
 *    and G449 — and this changes nothing about it. A seed runs as the MIGRATOR,
 *    behind `RECONCILE_LOCAL_TEST_AUTH`, and `0009`'s refusal is untouched:
 *    *"nothing on the request path mints a role assignment."* What this fixes
 *    is narrower and is worth exactly what it says: **the local demo stops
 *    answering 403 to itself.**
 *
 * ⚠️ DERIVED FROM THE MOUNT TABLE RATHER THAN CHOSEN, and a reader should run
 *    this rather than trust the list:
 *      `grep -A12 "tier: 'capability'" server/data-plane/start.ts | grep -oE '^ +[a-zA-Z]+:'`
 *      then, for each, the `x-capability` beside its `operationId` in
 *      `docs/contracts/capability.openapi.yaml`.
 *    ⚠️ THIS SAID *"three distinct verbs across eight operations"* UNTIL
 *    19 Sep 2026 and G512 mounted a ninth. Run the commands; the number moves
 *    every time an operation mounts.
 *
 * 🛑 `manage_roles` IS DELIBERATELY ABSENT, AND SO IS EVERY OTHER VERB NO
 *    MOUNTED OPERATION NAMES. A seed that carried the whole closed set would
 *    make every future `403` in local development impossible to distinguish
 *    from a route that does not exist — and `manage_roles` is classed
 *    `authority`, the class `CONTRACT_ONLY_RESOURCES` and
 *    `PLATFORM_ASSIGNMENT_REACHES` both refuse. **The seed tracks the mount
 *    table; it does not lead it.**
 */
export const SEED_CAPABILITIES: readonly string[] = [
  /* `listRuns`, `getRun`, `getRunAccount`, `listRunResidue` — G300. */
  'admit_source',
  /* `listExceptions`, `getExceptionFacets`, `getException` — G357. */
  'view_exception',
  /* `assignException`, the first write either plane serves — G358. */
  'assign_exception',
  /**
   * `grantRoleAssignment` — G512, 19 Sep 2026, and the note below said this
   * verb was DELIBERATELY ABSENT. **That note is corrected rather than
   * deleted, because its rule is the reason this entry is now correct.** The
   * rule was *"the seed tracks the mount table; it does not lead it"*, and the
   * mount table now carries an operation annotated `manage_roles`. The clause
   * that has gone false is the parenthetical — *"`manage_roles` is classed
   * `authority`, the class `CONTRACT_ONLY_RESOURCES` and
   * `PLATFORM_ASSIGNMENT_REACHES` both refuse"* — which is true and is about
   * the STAFF and PLATFORM arms; this seeded subject is a CUSTOMER principal
   * and `decide()`'s customer arm consults neither list.
   *
   * 🛑 THIS SEEDS THE BOOTSTRAP AND THAT IS THE HONEST DESCRIPTION OF IT.
   * `canGrant()` refuses to confer a capability the granter does not already
   * hold, so the FIRST holder in a tenant cannot arrive through the operation
   * — the seeded subject is that first holder, written by the MIGRATOR behind
   * `RECONCILE_LOCAL_TEST_AUTH`, and tenant onboarding is what would replace
   * it. The operation makes the SECOND holder reachable through the gate.
   */
  'manage_roles',
]

/**
 * ⚠️ `SEED_CAPABILITY` — SINGULAR — IS DELETED RATHER THAN KEPT AS AN ALIAS,
 * and the deletion is safe by measurement rather than by assumption:
 * `grep -rn 'SEED_CAPABILITY' tests/ server/ docs/` returns this file alone.
 * An alias would have preserved a name whose whole meaning was *"the one verb
 * the seed carries"*, which is the sentence that went false.
 */

/**
 * 🛑 THE SESSION HANDLE. A CREDENTIAL, WRITTEN DOWN, ON PURPOSE. See the
 * header: the flag is the boundary and this is a fixture.
 *
 * ⚠️ THE PREIMAGE IS STORED NOWHERE. `tenant.session.handle_digest` holds
 * `digestOfHandle(SEED_HANDLE)` and this string reaches the database never —
 * `model/domain.ts`: *"a database dump containing handles would be a
 * session-hijack kit."* The seeder computes the digest through the ONE seam,
 * `server/data-plane/handle-digest.ts`, rather than reimplementing it; a second
 * HMAC would be a second answer to *"which session row is this"*.
 */
export const SEED_HANDLE = 'reconcile-local-seeded-session-handle/not-a-secret'

/**
 * The host the seeded session is BOUND to, under G180.
 *
 * ⚠️ IT MUST MATCH AN ENTRY IN `RECONCILE_SERVING_HOSTS` OR THE SESSION IS
 * REFUSED AND REVOKED ON ITS FIRST REQUEST — `checkHostBinding()` runs on every
 * request, not only at sign-in, and *"a binding checked once, at sign-in, would
 * be a binding that stops being checked exactly when it starts mattering."*
 * A seeded session pointed at an unregistered host is a fixture that destroys
 * itself, which is the policy working and is confusing at 2am; it is named here
 * so it is diagnosed rather than discovered.
 */
export const SEED_HOST = 'acme.ap-southeast-1.reconcile.invalid'

/* ══════════════════════════════════════════════════════════════════════════ *
 * THE CONSOLE PRINCIPAL — R-P, 21 Sep 2026, THE OWNER'S RULING. W2-C0.
 *
 * 🛑 EVERYTHING BELOW DESCRIBES A PERSON WITH **NO TENANT AND NO MEMBERSHIP
 *    ANYWHERE**, AND THAT IS INVARIANT 8 RATHER THAN AN OVERSIGHT. Copy it,
 *    never paraphrase it: *"Being staff is not access."* The FDE's only
 *    authority is a `platform_role_assignment`, which is G289's second
 *    instrument — *"a second instrument that spends capabilities and is not a
 *    grant"* — and it is what `decide()`'s FOURTH arm reads. A membership here
 *    would make the fixture demonstrate the customer arm by accident.
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * The PLATFORM-owned directory. `owner_kind = 'platform'`, and both owner
 * columns NULL.
 *
 * 🛑 THIS COLUMN IS THE ONLY SOURCE OF `orgClass` AND THE FIXTURE WOULD BE
 * MEANINGLESS WITHOUT IT. `orgFor(connection.owner)` is the one derivation —
 * `server/data-plane/identity.ts` — and **federation is never a source of
 * organisation**: a partner and a customer can share a broker. A seeded staff
 * person on `SEED_CONNECTION` would be a CUSTOMER principal holding a platform
 * assignment, which `decide()` would refuse on an arm nobody is demonstrating.
 */
export const SEED_CONSOLE_CONNECTION = 'idc_1ch_entra_local_seed'

/** The 1CloudHub broker. Not a real pool, for `SEED_BROKER_ISSUER`'s reason. */
export const SEED_CONSOLE_BROKER_ISSUER =
  'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_LOCALSEED'

/** The name the broker gives the staff directory. Distinct from the tenant one. */
export const SEED_CONSOLE_BROKER_REF = '1ch-entra-local-seed'

/** The staff person. An FDE. Holds no membership in any tenant. */
export const SEED_CONSOLE_USER = 'usr_fde_priya'

/** The platform role, and the ONE verb it carries. */
export const SEED_CONSOLE_ROLE = 'prl_fleet_reader'

/**
 * THE VERB, AND IT IS EXACTLY ONE — the same discipline `SEED_CAPABILITIES`
 * states for the tenant role, applied to the platform one.
 *
 * 🛑 `view_substrate` IS WHAT `listTenants` IS ANNOTATED WITH AND IS THE ONLY
 *    CONSOLE OPERATION EITHER PLANE MOUNTS. Derive both rather than trusting
 *    this line, because it moves every time an operation mounts:
 *      `node tools/served-set.mjs`   → 30 of 136, and `listTenants` among them
 *      `grep -B4 'operationId: listTenants' docs/contracts/platform-console.openapi.yaml`
 *    ⚠️ The first was a recursive grep for the handler key, its slash written
 *    as an HTML entity to survive a block comment — which is exactly what left
 *    this header inside the unescaped form's scope (G2081, 23 Sep 2026).
 *
 * ⚠️ THE OTHER FOUR OF G601's FIVE ARE DELIBERATELY ABSENT, and the omission is
 *    load-bearing rather than tidy. `provision_substrate` is the verb G601's
 *    own note puts under BYOA's unclosed clause; `publish_catalogue` is the one
 *    it records as invariant 6's risk *"and G110's publication seam does not
 *    exist"*. A seed carrying a verb no operation mounts makes every future
 *    `403` in local development indistinguishable from a route that is not
 *    there — `SEED_CAPABILITIES`' argument, verbatim, one table over.
 */
export const SEED_CONSOLE_CAPABILITIES: readonly string[] = ['view_substrate']

/**
 * THE CONSOLE SESSION HANDLE. A credential, written down, on purpose — the
 * header's argument, unchanged: the flag is the boundary and this is a fixture.
 *
 * ⚠️ A SECOND HANDLE AND NOT A SECOND SESSION ON THE FIRST ONE. `handle_digest`
 * is `NOT NULL UNIQUE`, and the two principals are different people on
 * different doors reaching different arms of `decide()`; one handle resolving
 * to both would be the fixture asserting that a tenant operator and an FDE are
 * the same subject.
 */
export const SEED_CONSOLE_HANDLE = 'reconcile-local-seeded-console-handle/not-a-secret'

/**
 * The host the seeded CONSOLE session is bound to, under G180.
 *
 * ⚠️ IT MUST MATCH AN ENTRY IN `RECONCILE_CONSOLE_HOSTS` — a DIFFERENT variable
 * from `SEED_HOST`'s `RECONCILE_SERVING_HOSTS` — OR THE SESSION IS REFUSED AND
 * REVOKED ON ITS FIRST REQUEST, exactly as `SEED_HOST` warns. The registration
 * grammar is FLAT and carries no region label (G297: *"a console has no tenant
 * and a region label on one would assert a residency invariant 3 says the
 * control plane does not have"*), so the local line is
 *
 *     RECONCILE_CONSOLE_HOSTS='console.reconcile.invalid|staff|active'
 *
 * and `checkConsoleHostRegistration()` refuses a region-labelled one AT BOOT.
 */
export const SEED_CONSOLE_HOST = 'console.reconcile.invalid'

/**
 * Write the substrate. Returns a one-line summary for the job's log.
 *
 * `ON CONFLICT DO NOTHING` throughout, so a restarted container re-seeds
 * harmlessly — the composite primary keys are what make that safe, exactly as
 * `seedRuns()` argues one file over.
 *
 * ⚠️ THE SESSION'S `expires_at` IS RELATIVE TO THE REAL CLOCK AND THE
 * ASSIGNMENT'S IS NULL, AND NEITHER IS ARBITRARY. `resolveSubject()` compares
 * `session.expiresAt` against a caller-supplied `now`, so an absolute literal
 * would make the fixture rot into a `session_expired` refusal on a date nobody
 * chose. `RoleAssignment.expiresAt` is NULL because
 * `DURABLE_ASSIGNMENT_PERMITTED.customer === true` — *"only the customer row may
 * hold an assignment that never expires"* — and a seeded CUSTOMER assignment is
 * the one place that null is lawful.
 */
export async function seedIdentitySubstrate(): Promise<string> {
  const { digestOfHandle } = await import('../data-plane/handle-digest.ts')
  const digest = digestOfHandle(SEED_HANDLE)
  if (digest === null) throw new Error('the seeded handle digested to nothing')

  /* THE SAME SEAM, A SECOND TIME — never a second HMAC. `server/data-plane/
     handle-digest.ts` is the ONE place a handle becomes a digest, and a
     reimplementation here would be a second answer to *"which session row is
     this"*. */
  const consoleDigest = digestOfHandle(SEED_CONSOLE_HANDLE)
  if (consoleDigest === null) throw new Error('the seeded console handle digested to nothing')

  const client = await migratorClient()
  try {
    await client.query('BEGIN')

    /* ⚠️ THE BROKER HANDLE IS SEEDED AND IS NOT OPTIONAL — G304/G305, 19 Sep
     * 2026. `PROTOCOL_IS_BROKERED.oidc` is true, so a seeded `oidc` connection
     * with NULL handle columns is refused by `server/data-plane/identity.ts`
     * as `broker_unresolvable` and the whole seeded subject stops resolving.
     * That is the coherence rule biting a fixture, which is the only place in
     * this repository it CAN bite today, and it is why the pair is here rather
     * than left null for a later slice to add. */
    await client.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES ($1, 'oidc', 'Acme Entra ID', 'customer', NULL, 'acc_acme',
               $2, $3, 'active')
       ON CONFLICT DO NOTHING`,
      [SEED_CONNECTION, SEED_BROKER_ISSUER, SEED_BROKER_REF],
    )

    await client.query(
      `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
       VALUES ($1, 'mei@acme.invalid', 'Mei Tan', 'active', $2)
       ON CONFLICT DO NOTHING`,
      [SEED_USER, SEED_CONNECTION],
    )

    await client.query(
      `INSERT INTO tenant.role
         (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
       VALUES ($1, $2, 'AP Approver', 'approver', 3, 'operator', 'pack', 'pck_ap', 'active')
       ON CONFLICT DO NOTHING`,
      [SEED_TENANT, SEED_ROLE],
    )

    /* ONE ROW PER VERB. `asCapability()` in `server/data-plane/identity.ts`
       DROPS a row naming a verb this build does not declare rather than
       refusing — *"A row naming a verb this build does not declare can only
       NARROW what a role carries, never widen it"* — so a typo here is a
       silent 403 rather than a loud failure. That is the reason the list is
       derived from the mount table and the reason each entry is commented with
       the operations it opens. */
    for (const capability of SEED_CAPABILITIES) {
      await client.query(
        `INSERT INTO tenant.role_capability (tenant_id, role_id, capability)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [SEED_TENANT, SEED_ROLE, capability],
      )
    }

    /* `role_version` MATCHES `role.version` deliberately: `decide()` stops
     * evaluating an assignment whose pin has moved, in either direction, so a
     * fixture that got this wrong would deny at `role_version_moved` for a
     * reason that has nothing to do with what is being demonstrated. */
    await client.query(
      `INSERT INTO tenant.role_assignment
         (tenant_id, id, user_id, role_id, role_version,
          granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, 'ras_mei_approver', $2, $3, 3,
               'usr_acme_admin', now(), NULL, NULL)
       ON CONFLICT DO NOTHING`,
      [SEED_TENANT, SEED_USER, SEED_ROLE],
    )

    /* ═══════════════════════════════════════════════════════════════════ *
     * 🛑 THE MEMBERSHIP, AND ITS ABSENCE WAS A LIVE DEFECT — G1386.
     *
     * **MEASURED, NOT REASONED: without this row the seeded subject could not
     * AUTHENTICATE AT ALL.** The session below is written already BOUND to
     * `SEED_TENANT`, and G641 put the membership-liveness question on EVERY
     * request rather than only at binding — `resolveAuthority()` calls
     * `holdsLiveMembership()` directly — and that predicate **refuses an
     * ABSENT membership too, deliberately**, on the file's own reasoning:
     * *"the narrow reading — refuse only when rows exist and none is live — is
     * §5.1 … and it fails OPEN, because deleting the row would then buy a
     * permanent session."* The refusal is a **401 `session_invalid`**, not a
     * 403, because naming the term would tell whoever holds the handle that
     * their membership lapsed and roughly when.
     *
     * Captured against the shipping seed before this row existed:
     *
     *     GET /v1/runs  ->  401 {"code":"session_invalid", …}
     *
     * ⚠️ IT IS THE SAME DEFECT CLASS `SEED_CAPABILITIES` RECORDS ABOVE AND IT
     *    SURVIVED FOR THE SAME REASON: *"Nothing in the gate drives the
     *    shipping seed."* `tests/http/console-seed-served.test.ts` is that
     *    observer, and §2 of it is this row.
     *
     * 🛑 AND IT IS NOT A NEW PRIVILEGE OR A WIDENING. `0005` grants the app
     *    role `SELECT` on `tenant.membership` and nothing else — *"nothing on
     *    the request path mints a membership"* — so this is the MIGRATOR
     *    writing the row a real tenant onboarding would write, exactly as the
     *    role assignment above is. What it restores is the seed's own stated
     *    intention: a subject that reaches a gated operation on its FIRST
     *    request.
     *
     * ⚠️ `expires_at` IS NULL, which is lawful here and only here: this is a
     *    CUSTOMER membership, and `Membership.expiresAt`'s declaration says
     *    *"Partner-scoped memberships must expire. Null only for direct
     *    staff."* A dated literal would rot the fixture into a 401 on a day
     *    nobody chose — `SEED_HOST`'s argument, on the other clock.
     * ═══════════════════════════════════════════════════════════════════ */
    await client.query(
      `INSERT INTO tenant.membership
         (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, 'mem_seeded_mei', $2, $3, 'usr_acme_admin', now(), NULL, NULL)
       ON CONFLICT DO NOTHING`,
      [SEED_TENANT, SEED_USER, SEED_ROLE],
    )

    /* The session is written ALREADY BOUND to the tenant. `tenant_id` is NOT
     * NULL here, and that is the one thing this fixture does that a real
     * sign-in would not: D1 binds it, through `selectTenantForSession()` and
     * the restrictive policy. Writing it bound is what makes the seeded subject
     * reach a GATED operation on its first request instead of its second —
     * and it is written as the MIGRATOR, so the restrictive check is not what
     * is being bypassed here; RLS is. */
    await client.query(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ('ses_seeded_mei', $1, $2, $3, $4, $5,
               now(), now(), now() + interval '12 hours', NULL)
       ON CONFLICT DO NOTHING`,
      [digest, SEED_USER, SEED_CONNECTION, SEED_TENANT, SEED_HOST],
    )

    /* ═══════════════════════════════════════════════════════════════════ *
     * THE CONSOLE PRINCIPAL — R-P, 21 Sep 2026, THE OWNER'S RULING. W2-C0.
     *
     * 🛑 FIVE ROWS, AND EVERY ONE OF THEM HAS TO BE RIGHT OR THE CONSOLE
     *    ANSWERS SOMETHING OTHER THAN 200. They are listed here in the order
     *    `decide()` needs them, which is the order they are written in.
     *
     * ⚠️ IN THE SAME TRANSACTION AS THE TENANT SUBJECT, AND THAT IS NOT
     *    TIDINESS: a half-seeded substrate is a fixture whose failure mode is
     *    a 401 or a 403 that looks exactly like the product refusing
     *    correctly. One `COMMIT`, or neither principal.
     * ═══════════════════════════════════════════════════════════════════ */

    /* 1 · THE PLATFORM DOOR. `owner_kind = 'platform'` and BOTH owner columns
     * NULL — this column is the ONLY source of `orgClass`, through
     * `orgFor(connection.owner)`, and a staff person seeded on the CUSTOMER
     * door would be a customer principal holding a platform assignment, which
     * `decide()` refuses at `principal_holds_no_tenant` on an arm nobody is
     * demonstrating. The broker pair is present for `PROTOCOL_IS_BROKERED`'s
     * reason, exactly as the tenant door's is. */
    await client.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES ($1, 'oidc', '1CloudHub Entra', 'platform', NULL, NULL,
               $2, $3, 'active')
       ON CONFLICT DO NOTHING`,
      [SEED_CONSOLE_CONNECTION, SEED_CONSOLE_BROKER_ISSUER, SEED_CONSOLE_BROKER_REF],
    )

    /* 2 · THE PERSON. Active, on the platform door, and — see §3 of
     * `tests/http/console-seed-served.test.ts` — holding NO membership and NO
     * tenant role anywhere. Invariant 8: *"Being staff is not access."* */
    await client.query(
      `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
       VALUES ($1, 'priya@1cloudhub.invalid', 'Priya R', 'active', $2)
       ON CONFLICT DO NOTHING`,
      [SEED_CONSOLE_USER, SEED_CONSOLE_CONNECTION],
    )

    /* 3 · THE PLATFORM ROLE. `stakeholder_class = 'platform'`, which is what
     * `PLATFORM_ASSIGNMENT_REACHES` is keyed on. */
    await client.query(
      `INSERT INTO tenant.platform_role (id, label, key, version, stakeholder_class, status)
       VALUES ($1, 'Fleet reader', 'fleet_reader', 1, 'platform', 'active')
       ON CONFLICT DO NOTHING`,
      [SEED_CONSOLE_ROLE],
    )

    /* 4 · ONE ROW PER VERB, and `asCapability()` DROPS a row naming a verb this
     * build does not declare rather than refusing — so a typo here is a silent
     * 403, which is why `SEED_CONSOLE_CAPABILITIES` is derived from the mount
     * table and commented with what it opens. */
    for (const capability of SEED_CONSOLE_CAPABILITIES) {
      await client.query(
        `INSERT INTO tenant.platform_role_capability (role_id, capability)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [SEED_CONSOLE_ROLE, capability],
      )
    }

    /* 5 · THE ASSIGNMENT.
     *
     * 🛑 `expires_at` IS NOT NULL AND CANNOT BE, AND THE COLUMN SAYS SO IN ITS
     *    OWN VOICE — `db/migrations/0009_identity_substrate.sql`: *"NOT
     *    NULLABLE."* `DURABLE_ASSIGNMENT_PERMITTED.platform` is `false`, and
     *    the tenant `role_assignment` above is NULL for the mirror-image
     *    reason: *"only the customer row may hold an assignment that never
     *    expires."* **The two nulls are not a style choice; each is the one
     *    lawful value for its own org class.**
     *
     * ⚠️ RELATIVE TO THE REAL CLOCK, LIKE THE SESSIONS. Eight hours is a
     *    working day, which is long enough for a local stack and short enough
     *    that a container left running overnight reports `platform_assignment_
     *    expired` — the fixture aging out loudly rather than silently.
     *
     * ⚠️ `role_version` MATCHES `platform_role.version`: `decide()` stops
     *    evaluating an assignment whose pin has moved, in either direction. */
    await client.query(
      `INSERT INTO tenant.platform_role_assignment
         (id, user_id, role_id, role_version, granted_by, granted_at, expires_at, revoked_at)
       VALUES ('pra_seeded_priya', $1, $2, 1, 'bootstrap',
               now(), now() + interval '8 hours', NULL)
       ON CONFLICT DO NOTHING`,
      [SEED_CONSOLE_USER, SEED_CONSOLE_ROLE],
    )

    /* 6 · THE CONSOLE SESSION.
     *
     * 🛑 `tenant_id` IS NULL AND THAT IS THE WHOLE OF WHAT MAKES IT A CONSOLE
     *    SESSION — G726, *"the data plane serves the console hosts, with
     *    tenant-less sessions"*. The surface is derived from the HOST and never
     *    from the null: `server/data-plane/session.ts`'s `surfaceOf()` reads
     *    the registry, because *"unbound therefore console"* would delete
     *    `tenant_not_selected` for every caller standing in front of D1.
     *
     * ⚠️ AND A TENANT-LESS SESSION IS WRITABLE BY THE APP ROLE TOO, which
     *    `tests/db/session-mint-scope.test.ts` §1 measures — this row is the
     *    MIGRATOR's only because the rest of the seed is. */
    await client.query(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ('ses_seeded_console', $1, $2, $3, NULL, $4,
               now(), now(), now() + interval '12 hours', NULL)
       ON CONFLICT DO NOTHING`,
      [consoleDigest, SEED_CONSOLE_USER, SEED_CONSOLE_CONNECTION, SEED_CONSOLE_HOST],
    )

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await client.end()
  }

  /**
   * 🛑 THE COOKIE FIRST, THE HEADER SECOND, AND THE ORDER IS THE INSTRUCTION —
   * G386, 19 Sep 2026. This line printed `X-Session:` ALONE, and a reader who
   * copied it against a plane started WITHOUT `RECONCILE_LOCAL_TEST_AUTH=1`
   * would get a 401 and no clue why: that plane holds no code that reads the
   * header at all. The cookie is the channel every deployed plane reads; the
   * header is the local-test one and is labelled as such.
   */
  /**
   * ⚠️ AND THE CONSOLE PRINCIPAL IS NAMED WITH ITS OWN HOST, because the two
   * are bound to DIFFERENT hosts registered through DIFFERENT variables —
   * `RECONCILE_SERVING_HOSTS` and `RECONCILE_CONSOLE_HOSTS` — and under G180 a
   * session presented against any other Host is refused AND REVOKED on its
   * first request. A handle printed without its host is a fixture that
   * destroys itself, which is the policy working and is confusing at 2am.
   * `tests/http/console-seed-served.test.ts` §5 asserts both are printed.
   */
  return (
    `${SEED_USER} in ${SEED_TENANT} holds ${SEED_CAPABILITIES.join(', ')}; ` +
    `Cookie: __Host-reconcile_session=${SEED_HANDLE} (Host: ${SEED_HOST}) ` +
    `— or, ONLY on a plane started with RECONCILE_LOCAL_TEST_AUTH=1, ` +
    `X-Session: ${SEED_HANDLE}. ` +
    `CONSOLE: ${SEED_CONSOLE_USER} holds ${SEED_CONSOLE_CAPABILITIES.join(', ')} ` +
    `with no tenant at all; Cookie: __Host-reconcile_session=${SEED_CONSOLE_HANDLE} ` +
    `(Host: ${SEED_CONSOLE_HOST}, which must be registered in RECONCILE_CONSOLE_HOSTS ` +
    `as '${SEED_CONSOLE_HOST}|staff|active')`
  )
}
