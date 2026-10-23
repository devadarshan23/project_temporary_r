/**
 * THE TENANT-BINDING WRITE, AND THE DATABASE HALF OF #157's CONTROL — G199
 * (S-21) and G160 (S-2), over `db/migrations/0005_session_and_membership.sql`.
 *
 * `tests/db/session-isolation.test.ts` is the shape this file copies and its
 * header is the one to read first: the recording pool, the `max: 1` adversarial
 * pool, the four assertions #228 requires, and the two negative controls. What
 * is NOT copied is the SUBJECT. That file is about a READ — which session rows
 * can I see. This one is about the WRITE that establishes a scope, which is the
 * thing invariant 1 had no gate on anywhere.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT WAS WRONG — `docs/build/stateless-red-session.md` B1, quoted because
 *    paraphrasing it loses the mechanism.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * *"The database does not check it either. [The] policy is `handle_digest =
 * nullif(current_setting('app.session_ref', true), '')` for BOTH `USING` and
 * `WITH CHECK`. `WITH CHECK` constrains the digest column and NOTHING ELSE, so
 * an `UPDATE session SET tenant_id = …` on your own row satisfies it for ANY
 * value that satisfies the foreign key."*
 *
 * The consequence, in order: the attacker's next request resolves `ok`;
 * `TenantContext` carries the other tenant's residency, environment and
 * deployment mode — a cross-tenant read of tenancy metadata on its own — and
 * every handler that reads a scoped row without routing through `decide()`
 * reads that tenant's rows **with RLS reporting success**. *"G100's
 * deny-on-NULL backstops a FORGOTTEN `set_config`. It backstops nothing against
 * a CHOSEN one."*
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE STATEMENT UNDER TEST HAS NO `WHERE` AND NO JOIN, AND THAT IS THE WHOLE
 *    POINT OF THE FILE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     UPDATE tenant.session SET tenant_id = $1
 *
 * No `WHERE handle_digest = …`, so nothing in the SQL says which session is
 * being written. No `EXISTS (SELECT … FROM membership …)`, so nothing in the
 * SQL says the principal is entitled to it. **Both narrowings come from the
 * policies and from nowhere else** — `session_rls` decides WHICH ROW the
 * statement can touch, and `session_selection_restrictive` decides WHAT VALUE
 * it may be given. A handler that forgets the check is refused by the database.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ASSERTIONS, AND NONE OF THEM IS OPTIONAL.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   (a) the SQL the write issues carries NO session predicate, NO membership
 *       predicate and NO tenant predicate — asserted by reading the statement
 *       TEXT that reached the server, not by inspecting the outcome.
 *   (b) with the RESTRICTIVE POLICY DROPPED, every write this file says is
 *       refused SUCCEEDS. Without this, a green run means the writes failed for
 *       reasons nobody checked — a foreign key, a missing grant, a typo — which
 *       is the §5.6 shape, and B1's own defect is that the FK was the only
 *       thing standing there.
 *   (c) with `session` RLS DISABLED, one session rewrites ANOTHER's row, so the
 *       confinement in (a) is demonstrably the permissive policy's.
 *   (d) both writes ran on the SAME pooled backend, asserted by
 *       `pg_backend_pid()`. G98 picked `pg` precisely because it exposes it.
 *   (e) THE TWO HALVES AGREE. Every case is run through
 *       `selectTenantForSession()` AND through the database, and the verdicts
 *       are required to match. #157: *"either alone is a defeat"* — and two
 *       halves that disagree are a third defeat nobody had named.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE MEASURED FACT THIS FILE EXISTS TO WITNESS, AND IT DECIDED A HELPER.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **PostgreSQL applies row-level security to `tenant.membership` INSIDE the
 * restrictive policy's subquery, as the querying role.** So inside
 * `withSessionScope()` — where `app.tenant_id` is unset — `membership_rls`
 * denies on NULL, the `EXISTS` is empty, and a LEGITIMATE selection is refused.
 * `it('inside the SESSION helper alone, even a legitimate selection is
 * refused')` below witnesses that rather than asserting it in prose, and it is
 * the executable argument for `db/selection-scope.ts` being a THIRD named
 * scoped helper rather than a convenience. `db/session-scope.ts` predicted
 * somebody would propose one and set the bar: *"each exists because a table
 * cannot be protected by the other's predicate, not because a caller found it
 * convenient."*
 *
 * ⚠️ AND THE CONSEQUENCE IS A SECOND NARROWING NOBODY DESIGNED. Because
 * `membership_rls` narrows the subquery to `app.tenant_id`, the check passes
 * only when the tenant being WRITTEN equals the tenant scope DECLARED. Both
 * halves of that are witnessed below, separately, because an attacker gets to
 * choose which one to try.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ AND SINCE 19 Sep 2026 IT COVERS BOTH ARMS — S-21, G199 and G292.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This file's staff test used to assert, by name, that a platform FDE could
 * never bind a tenant — *"G199's DECLARED COST, IN THE DATABASE, AND THIS TEST
 * IS SUPPOSED TO GO RED WHEN THE STAFF ARM LANDS."* **It went red.** The staff
 * arm is `db/migrations/0008_staff_grant_selection.sql`'s second `OR EXISTS`
 * disjunct plus `model/access.ts` §7a's arm, and the two halves land together
 * because #157 rules that *"either alone is a defeat."*
 *
 * 🛑 ASSERTION (e) FOUND THE THIRD DEFEAT ON ITS FIRST RUN AGAINST THE NEW ARM,
 *    AND IT IS THE BEST ARGUMENT IN THIS FILE FOR ITS OWN EXISTENCE. The row
 *    `fde → acme` reported *"selectTenantForSession() says refused, the database
 *    says ok"* — and **both halves were right**: the database read the FDE's
 *    grant out of a table, and the model half had been handed no `staffGrant` at
 *    all. A harness that gives one half less evidence than the other proves
 *    nothing about either. The fourteen staff fixtures now carry the grant the
 *    database is seeded with, and the refusal NAME is compared too, because a
 *    staff case refused as `membership_absent` would mean the arm never ran.
 *
 * ⚠️ THE TWO CLOCKS STOPPED BEING FREE. 0005 records that `now()` is the
 *    TRANSACTION's and the model's is the caller's, *"agreeing to within one
 *    transaction"* — which held while every live membership had a NULL expiry.
 *    `TenantAccessGrant.expiresAt` is NOT nullable, so every live grant fixture
 *    is anchored to the REAL clock and every dead one to an absolute past date.
 *    The block above `STAFF_CASES` is the argument; do not replace a `realHours()`
 *    call with a literal date.
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, type TenantPool, type QueryResultLike } from '../../db/tenant-scope.ts'
import { withSessionScope } from '../../db/session-scope.ts'
import { withSelectionScope } from '../../db/selection-scope.ts'

import { selectTenantForSession } from '../../model/access.ts'
import {
  CONTRACT_ONLY_RESOURCES,
  MAX_GRANT_HOURS,
  NON_DELEGABLE_RESOURCES,
  PERMITTED_RESOURCES,
} from '../../model/governance.ts'
import type {
  AccessPurpose,
  AccessResourceClass,
  TenantAccessGrant,
} from '../../model/governance.ts'
import type { Membership, Session } from '../../model/domain.ts'
import type {
  MembershipId,
  RoleId,
  TenantAccessGrantId,
  TenantId,
  Timestamp,
  UserId,
} from '../../model/kernel.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE. Set before the first call that reads it.
 *
 * 🛑 NOT HYGIENE — THE FIX FOR A NAMED FLAKE, stated in full at
 * `tests/db/tenant-projection.test.ts`. `node --test` runs test FILES
 * concurrently; `resetSchema()` runs `DROP SCHEMA … CASCADE` and
 * `applyMigrations()` outside any lock, so two files sharing one database race
 * on the rebuild and the loser dies inside `applyMigrations` with a message
 * about a relation. `db/env.ts` resolves `RECONCILE_DB_NAME` per call and never
 * at import, so setting it here — above the `probeDatabase()` call — is
 * sufficient and is the only placement that is.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_SELECTION_DB_NAME'] ?? runScopedName('reconcile_selection_test')

/* ------------------------------------------------------------------ *
 * The fixtures. G97 — ids are readable slugs, stored VERBATIM as `text`.
 *
 * ⚠️ EVERY DIGEST IS A PLACEHOLDER OF THE RIGHT SHAPE — 64 hex characters, an
 * HMAC-SHA256 output — and is not a real one. `model/examples.ts` states the
 * rule these follow: a fixture carrying a readable handle would be the first
 * place a preimage got written down, and `SessionHandleDigest` exists because
 * *"a database dump containing handles would be a session-hijack kit."*
 * ------------------------------------------------------------------ */

const ACME = 'ten_acme' as TenantId
const GLOBEX = 'ten_globex' as TenantId

const MEI = 'usr_ops_mei' as UserId
/** A member of GLOBEX and of nothing else. The B1 attacker, in one row. */
const ANA = 'usr_ops_ana' as UserId
/** Was a member of ACME. `revokedAt` is set; the row is RETAINED, not deleted. */
const RAJ = 'usr_ops_raj' as UserId
/** A partner-scoped membership in ACME that has expired. */
const LEE = 'usr_ops_lee' as UserId
/** A platform FDE. No membership anywhere — that is what being staff means. */
const FDE = 'usr_platform_fde' as UserId

const DIGEST: Readonly<Record<string, string>> = {
  [MEI]: '11a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f708',
  [ANA]: '22b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819',
  [RAJ]: '33c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2',
  [LEE]: '44d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3',
  [FDE]: '55e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4',
}

const NOW = '2026-08-22T09:00:00Z' as Timestamp

/**
 * THE STATEMENT UNDER TEST. No `WHERE`, no join, no membership predicate — see
 * the header. Everything that narrows it is a policy.
 */
const SELECTION_WRITE = 'UPDATE tenant.session SET tenant_id = $1'

/** Reading back what the write did, from inside the same scope. */
const READ_BACK = 'SELECT user_id, tenant_id FROM tenant.session'

/**
 * The restrictive policy, for negative control (b), which drops and restores it.
 *
 * 🛑 THIS WAS A HAND COPY OF THE STATEMENT IN THE MIGRATION AND IT IS NOT ONE
 *    ANY MORE — THE COPY WENT STALE ON THE FIRST COMMIT THAT CHANGED THE
 *    POLICY, WHICH IS EXACTLY WHAT ITS OWN NOTE HAD FEARED. The note read:
 *    *"A HAND COPY OF A STATEMENT THAT LIVES IN A MIGRATION, AND THE COPY IS
 *    NOT TRUSTED"*, and pointed at the drift check below as the mitigation. The
 *    drift check asserts that four FRAGMENTS appear in the shipped expression;
 *    it never compared the shipped expression to this constant, so when
 *    `db/migrations/0008` added the staff disjunct, control (b) would have
 *    restored **0005's predicate over 0008's database** and every staff
 *    assertion after it in the run would have been measured against a policy
 *    the tree does not ship. Green, and meaningless.
 *
 * ⚠️ IT IS NOW CAPTURED FROM `pg_policy` IN `before()` AND REPLAYED VERBATIM,
 *    so there is nothing left to drift: whatever the migrations built is what
 *    gets restored. What is still hand-written is `AS RESTRICTIVE FOR ALL` and
 *    the absence of a `USING` — three facts the drift check below asserts
 *    DIRECTLY against the catalogue, which is the right place for them: they
 *    are properties of the control rather than of its predicate, and a
 *    predicate-only capture cannot carry them.
 */
let restrictivePolicySql = ''

/* ------------------------------------------------------------------ *
 * The MODEL rows, built to match the database rows seeded below.
 *
 * 🛑 THE TWO SETS ARE WRITTEN TO AGREE AND ASSERTION (e) IS WHAT HOLDS THEM
 * THERE. Two fixtures that drift apart would make the model half and the
 * database half answer different questions while both looked green, which is
 * the failure #157's "either alone is a defeat" is one step away from.
 * ------------------------------------------------------------------ */

function membership(o: {
  readonly id: string
  readonly userId: UserId
  readonly tenantId: TenantId
  readonly expiresAt?: Timestamp | null
  readonly revokedAt?: Timestamp | null
}): Membership {
  return {
    id: o.id as MembershipId,
    userId: o.userId,
    tenantId: o.tenantId,
    roleId: 'rol_pack_ap_approver' as RoleId,
    grantedBy: 'usr_acme_admin' as UserId,
    grantedAt: '2026-08-01T00:00:00Z' as Timestamp,
    expiresAt: o.expiresAt ?? null,
    revokedAt: o.revokedAt ?? null,
  }
}

const MEMBERSHIPS: readonly Membership[] = [
  membership({ id: 'mem_acme_mei', userId: MEI, tenantId: ACME }),
  membership({ id: 'mem_globex_ana', userId: ANA, tenantId: GLOBEX }),
  membership({
    id: 'mem_acme_raj',
    userId: RAJ,
    tenantId: ACME,
    revokedAt: '2026-08-10T00:00:00Z' as Timestamp,
  }),
  membership({
    id: 'mem_acme_lee',
    userId: LEE,
    tenantId: ACME,
    expiresAt: '2026-08-21T00:00:00Z' as Timestamp,
  }),
]

/* ==================================================================== *
 * THE STAFF FIXTURES — S-21, G199 and G292, 19 Sep 2026.
 *
 * 🛑 EVERY LIVE GRANT BELOW IS ANCHORED TO THE REAL CLOCK AND EVERY DEAD ONE
 *    TO AN ABSOLUTE PAST DATE, AND THAT ASYMMETRY IS FORCED RATHER THAN
 *    STYLISTIC. The database's clock is `now()` — the TRANSACTION's, which is
 *    whatever day this suite runs — and the model's is `NOW`, a literal in this
 *    file. 0005 names that divergence and says the two *"agree to within one
 *    transaction"*; that was true while every live membership had a NULL expiry
 *    and there was nothing to compare. `TenantAccessGrant.expiresAt` is NOT
 *    nullable, so a grant fixture has to be live under BOTH clocks at once.
 *
 *    The only arrangement that is: **live grants expire in the real future**
 *    (which is also the model's future, because the real clock is ahead of
 *    `NOW`), and **dead grants expire before `NOW`** (which is also the real
 *    past). A fixture with an absolute future date would rot silently on some
 *    morning in the next decade; one anchored here cannot.
 *
 * ⚠️ THE CEILING IS MEASURED `grantedAt` → `expiresAt`, so both ends of every
 *    window below are load-bearing and neither may be "tidied" to a round date.
 * ==================================================================== */

const REAL_NOW_MS = Date.now()

/** A timestamp `h` hours from the REAL clock — see the block above. */
function realHours(h: number): Timestamp {
  return new Date(REAL_NOW_MS + h * 3_600_000).toISOString() as Timestamp
}

const HOURS_PER_DAY = 24

/**
 * A placeholder digest of the right SHAPE — 64 hex characters, an HMAC-SHA256
 * output — and never a real one, for the reason the header block states: a
 * fixture carrying a readable handle would be the first place a preimage got
 * written down. Generated rather than typed because the staff arm needs
 * fourteen of them and fourteen hand-typed constants is fourteen chances to
 * repeat one, which would make two sessions the same row.
 */
function placeholderDigest(seed: number): string {
  return (seed % 256).toString(16).padStart(2, '0').repeat(32)
}

/**
 * One staff principal, one grant, and the verdict BOTH halves must return.
 *
 * `host` is the tenant the HOST is bound to — G179 — and is the tenant the
 * selection writes. It is NOT read off the grant: `grant.tenantId` is COMPARED
 * against it, which is `grantAllows()`'s own correction of 5 Aug 2026, and the
 * cross-tenant case below is the one that makes the comparison load-bearing.
 */
interface StaffCase {
  readonly label: string
  readonly userId: UserId
  readonly digest: string
  readonly grant: TenantAccessGrant
  readonly resources: readonly AccessResourceClass[]
  readonly host: TenantId
  readonly admitted: boolean
}

function grant(o: {
  readonly id: string
  readonly tenantId: TenantId
  readonly staffUserId: UserId
  readonly purpose: AccessPurpose
  readonly grantedAt: Timestamp
  readonly expiresAt: Timestamp
  readonly revokedAt?: Timestamp | null
  readonly resources: readonly AccessResourceClass[]
}): TenantAccessGrant {
  return {
    id: o.id as TenantAccessGrantId,
    tenantId: o.tenantId,
    purpose: o.purpose,
    staffUserId: o.staffUserId,
    /**
     * ⚠️ A SECOND, DIFFERENT STAFF USER ON EVERY FIXTURE — the two-person rule.
     * The SELECTION arm does not check it (`evaluateTenantAccess()` does, at
     * USE time, and this file says so in its own staff section), but a fixture
     * that self-approved would be a row no correct issuing path could ever
     * produce, and asserting against one of those is how a suite ends up
     * proving something about a state the product cannot reach.
     */
    approvedByStaffUserId: 'usr_platform_approver' as UserId,
    justification: 'fixture',
    resources: o.resources.map((resource) => ({
      resource,
      mode: 'read' as const,
      nominatedSubjectIds: [],
    })),
    grantedAt: o.grantedAt,
    expiresAt: o.expiresAt,
    engagementRef: o.purpose === 'delivery' ? 'eng_fixture' : null,
    idleRevokeDays: 14,
    lastUsedAt: null,
    extensions: [],
    visibleToTenant: true,
    customerNotifiedAt: '2026-08-01T00:00:00Z' as Timestamp,
    customerApprovedAt: null,
    revokedAt: o.revokedAt ?? null,
    revokedBy: null,
    revocationReason: null,
  }
}

/** A window that is LIVE under both clocks and 30 days wide — inside every ceiling but `incident`'s. */
const LIVE_FROM = realHours(-HOURS_PER_DAY)
const LIVE_TO = realHours(HOURS_PER_DAY * 29)

const STAFF_CASES: readonly StaffCase[] = [
  {
    /** ✅ INVARIANT 8's PERMITTED PATH. Unreachable from 19 Aug to 19 Sep 2026. */
    label: 'fde → acme · a live delivery grant, reaching two permitted classes',
    userId: 'usr_platform_fde' as UserId,
    digest: '55e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4',
    grant: grant({
      id: 'tag_fde_acme',
      tenantId: ACME,
      staffUserId: 'usr_platform_fde' as UserId,
      purpose: 'delivery',
      grantedAt: LIVE_FROM,
      expiresAt: LIVE_TO,
      resources: ['configuration', 'tenant_data'],
    }),
    resources: ['configuration', 'tenant_data'],
    host: ACME,
    admitted: true,
  },
  {
    /**
     * ✅ G60/G75, AS A POSITIVE CONTROL RATHER THAN AS PROSE. The FDE may reach
     * `secret` — the product owner decided it against a written recommendation,
     * `PERMITTED_RESOURCES.delivery` carries it, and *"do not relitigate it, do
     * not quietly narrow it back."* A reversal recorded only in a comment is a
     * reversal that decays; this is the assertion that would go red if somebody
     * narrowed it.
     */
    label: 'sec → acme · a delivery grant claiming `secret` and nothing else',
    userId: 'usr_platform_sec' as UserId,
    digest: placeholderDigest(0x11),
    grant: grant({
      id: 'tag_sec_acme',
      tenantId: ACME,
      staffUserId: 'usr_platform_sec' as UserId,
      purpose: 'delivery',
      grantedAt: LIVE_FROM,
      expiresAt: LIVE_TO,
      resources: ['secret'],
    }),
    resources: ['secret'],
    host: ACME,
    admitted: true,
  },
  {
    label: 'nog → acme · platform staff with NO grant anywhere',
    userId: 'usr_platform_nog' as UserId,
    digest: placeholderDigest(0x12),
    /** Seeded for the MODEL half's principal check and never written: see `seedGrants()`. */
    grant: grant({
      id: 'tag_never_written',
      tenantId: ACME,
      staffUserId: 'usr_platform_fde' as UserId,
      purpose: 'delivery',
      grantedAt: LIVE_FROM,
      expiresAt: LIVE_TO,
      resources: ['configuration'],
    }),
    resources: [],
    host: ACME,
    admitted: false,
  },
  {
    label: 'rev → acme · REVOKED, and a revoked grant is still a row',
    userId: 'usr_platform_rev' as UserId,
    digest: placeholderDigest(0x13),
    grant: grant({
      id: 'tag_rev_acme',
      tenantId: ACME,
      staffUserId: 'usr_platform_rev' as UserId,
      purpose: 'delivery',
      grantedAt: LIVE_FROM,
      expiresAt: LIVE_TO,
      revokedAt: '2026-08-15T00:00:00Z' as Timestamp,
      resources: ['configuration'],
    }),
    resources: ['configuration'],
    host: ACME,
    admitted: false,
  },
  {
    /** EXPIRED, and dead under BOTH clocks — 51 days wide, so INSIDE the ceiling. */
    label: 'exp → acme · EXPIRED, which is not the same fact as revoked',
    userId: 'usr_platform_exp' as UserId,
    digest: placeholderDigest(0x14),
    grant: grant({
      id: 'tag_exp_acme',
      tenantId: ACME,
      staffUserId: 'usr_platform_exp' as UserId,
      purpose: 'delivery',
      grantedAt: '2026-07-01T00:00:00Z' as Timestamp,
      expiresAt: '2026-08-21T00:00:00Z' as Timestamp,
      resources: ['configuration'],
    }),
    resources: ['configuration'],
    host: ACME,
    admitted: false,
  },
  {
    /** 🛑 G292's THIRD TERM, AND NOTHING ELSE IN THIS FILE WITNESSES IT. */
    label: 'long → acme · 130 days held: unrevoked, unexpired, OVER the ceiling',
    userId: 'usr_platform_long' as UserId,
    digest: placeholderDigest(0x15),
    grant: grant({
      id: 'tag_long_acme',
      tenantId: ACME,
      staffUserId: 'usr_platform_long' as UserId,
      purpose: 'delivery',
      grantedAt: realHours(-HOURS_PER_DAY * 100),
      expiresAt: realHours(HOURS_PER_DAY * 30),
      resources: ['configuration'],
    }),
    resources: ['configuration'],
    host: ACME,
    admitted: false,
  },
  {
    /** A grant for GLOBEX cannot bind ACME. The host decides; the grant is compared. */
    label: 'crx → acme · a LIVE grant, for the other tenant',
    userId: 'usr_platform_crx' as UserId,
    digest: placeholderDigest(0x16),
    grant: grant({
      id: 'tag_crx_globex',
      tenantId: GLOBEX,
      staffUserId: 'usr_platform_crx' as UserId,
      purpose: 'delivery',
      grantedAt: LIVE_FROM,
      expiresAt: LIVE_TO,
      resources: ['configuration'],
    }),
    resources: ['configuration'],
    host: ACME,
    admitted: false,
  },
  {
    /** 🛑 `statutory` — NON_DELEGABLE_RESOURCES, refused at any price. */
    label: 'sta → acme · a LIVE grant claiming `statutory`',
    userId: 'usr_platform_sta' as UserId,
    digest: placeholderDigest(0x17),
    grant: grant({
      id: 'tag_sta_acme',
      tenantId: ACME,
      staffUserId: 'usr_platform_sta' as UserId,
      purpose: 'delivery',
      grantedAt: LIVE_FROM,
      expiresAt: LIVE_TO,
      resources: ['statutory'],
    }),
    resources: ['statutory'],
    host: ACME,
    admitted: false,
  },
  {
    /** `authority` — CONTRACT_ONLY_RESOURCES, and there is no contract. */
    label: 'aut → acme · a LIVE grant claiming `authority`',
    userId: 'usr_platform_aut' as UserId,
    digest: placeholderDigest(0x18),
    grant: grant({
      id: 'tag_aut_acme',
      tenantId: ACME,
      staffUserId: 'usr_platform_aut' as UserId,
      purpose: 'delivery',
      grantedAt: LIVE_FROM,
      expiresAt: LIVE_TO,
      resources: ['authority'],
    }),
    resources: ['authority'],
    host: ACME,
    admitted: false,
  },
  {
    /** `commercial` — in NEITHER of the other two lists and in no purpose either. */
    label: 'com → acme · a LIVE grant claiming `commercial`, which no purpose opens',
    userId: 'usr_platform_com' as UserId,
    digest: placeholderDigest(0x19),
    grant: grant({
      id: 'tag_com_acme',
      tenantId: ACME,
      staffUserId: 'usr_platform_com' as UserId,
      purpose: 'delivery',
      grantedAt: LIVE_FROM,
      expiresAt: LIVE_TO,
      resources: ['commercial'],
    }),
    resources: ['commercial'],
    host: ACME,
    admitted: false,
  },
  {
    /** An 18-hour incident grant, inside `incident`'s 24-hour ceiling. */
    label: 'inc → acme · an 18-hour INCIDENT grant',
    userId: 'usr_platform_inc' as UserId,
    digest: placeholderDigest(0x1a),
    grant: grant({
      id: 'tag_inc_acme',
      tenantId: ACME,
      staffUserId: 'usr_platform_inc' as UserId,
      purpose: 'incident',
      grantedAt: realHours(-12),
      expiresAt: realHours(6),
      resources: ['tenant_data'],
    }),
    resources: ['tenant_data'],
    host: ACME,
    admitted: true,
  },
  {
    /**
     * 🛑 THE PER-PURPOSE DIFFERENTIAL, AND IT IS WHY THE CEILING IS A TABLE AND
     * NOT A NUMBER. These dates are IDENTICAL to `dls` below and the only
     * difference is the purpose: 31 days is inside `delivery`'s 90 days and
     * thirty-one times `incident`'s 24 hours.
     */
    label: 'inl → acme · a 31-DAY incident grant, over `incident`’s ceiling',
    userId: 'usr_platform_inl' as UserId,
    digest: placeholderDigest(0x1b),
    grant: grant({
      id: 'tag_inl_acme',
      tenantId: ACME,
      staffUserId: 'usr_platform_inl' as UserId,
      purpose: 'incident',
      grantedAt: realHours(-HOURS_PER_DAY * 30),
      expiresAt: realHours(HOURS_PER_DAY),
      resources: ['tenant_data'],
    }),
    resources: ['tenant_data'],
    host: ACME,
    admitted: false,
  },
  {
    /** The other half of the differential: the SAME dates, under `delivery`. */
    label: 'dls → acme · the same 31-day window, under `delivery`',
    userId: 'usr_platform_dls' as UserId,
    digest: placeholderDigest(0x1c),
    grant: grant({
      id: 'tag_dls_acme',
      tenantId: ACME,
      staffUserId: 'usr_platform_dls' as UserId,
      purpose: 'delivery',
      grantedAt: realHours(-HOURS_PER_DAY * 30),
      expiresAt: realHours(HOURS_PER_DAY),
      resources: ['tenant_data'],
    }),
    resources: ['tenant_data'],
    host: ACME,
    admitted: true,
  },
  {
    /**
     * A live grant claiming NOTHING. It binds a tenant and reaches no class,
     * because `grantAllows()` refuses every class for a grant with no line —
     * SELECTION IS NOT USE, and this fixture is where that sentence is
     * executable rather than asserted in a comment.
     */
    label: 'emp → acme · a live grant with NO resource lines at all',
    userId: 'usr_platform_emp' as UserId,
    digest: placeholderDigest(0x1d),
    grant: grant({
      id: 'tag_emp_acme',
      tenantId: ACME,
      staffUserId: 'usr_platform_emp' as UserId,
      purpose: 'delivery',
      grantedAt: LIVE_FROM,
      expiresAt: LIVE_TO,
      resources: [],
    }),
    resources: [],
    host: ACME,
    admitted: true,
  },
]

function staffCase(label: string): StaffCase {
  const found = STAFF_CASES.find((c) => c.label.startsWith(label))
  assert.ok(found, `no staff fixture labelled \`${label}\``)
  return found
}

/**
 * ⚠️ FIVE OF THE FOURTEEN ARE ADMITTED AND NINE ARE REFUSED, AND A READER SHOULD
 * CHECK THAT RATIO BEFORE TRUSTING THE FILE. A staff arm that refused everything
 * would pass every negative control here and would be an outage rather than a
 * control — §5.6 — which is why `fde`, `sec`, `dls`, `inc` and `emp` are in the
 * table at all. **`sec` is the one to read**: it is the executable form of a
 * reversal (G60/G75) that otherwise exists only as prose.
 */

/** An unselected session, as the model sees it. `tenantId` null — G210. */
function sessionFor(userId: UserId): Session {
  return {
    id: `ses_${userId}` as Session['id'],
    handleDigest: (DIGEST[userId] ?? '') as Session['handleDigest'],
    userId,
    connectionId: 'idc_acme_entra' as Session['connectionId'],
    tenantId: null,
    issuedHost: 'app.reconcile.invalid',
    authenticatedAt: '2026-08-22T08:40:00Z' as Timestamp,
    secondFactorAt: null,
    lastUsedAt: '2026-08-22T08:40:00Z' as Timestamp,
    expiresAt: '2026-08-22T20:40:00Z' as Timestamp,
    revokedAt: null,
  }
}

/* ------------------------------------------------------------------ *
 * Reachability. A skipped test that says so is honest; a mocked database
 * asserting a write is refused is a lie that will be believed.
 * ------------------------------------------------------------------ */

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/db/session-membership-selection.test.ts DID NOT RUN.',
      '',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS IS THE DATABASE HALF OF #157. A run of the suite in which it',
      '   skipped is NOT evidence that the tenant-binding write is gated, and',
      '   the model half alone is — in #157`s own words — a defeat. Start a',
      '   PostgreSQL and re-run before believing a green suite.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

/** The skip REASON, not a boolean: node:test prints it beside each skipped test. */
const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the tenant-binding write test', probe)

/* ------------------------------------------------------------------ *
 * A recording pool. Identical in shape to the one in
 * `tests/db/session-isolation.test.ts`; production code is not instrumented
 * for this, and the helpers take a `TenantPool` this satisfies structurally.
 *
 * 🛑 IT DOES NOT ADD `query` TO `TenantPool`. The pool type has no `query` so
 * that `pool.query(...)` — one autocommitted statement on a checked-out
 * connection, which silently discards `SET LOCAL` — is a COMPILE ERROR at every
 * call site rather than a code-review catch.
 * ------------------------------------------------------------------ */

interface Recorded {
  readonly text: string
  readonly values: readonly unknown[]
}

function recordingPool(inner: TenantPool): { pool: TenantPool; statements: Recorded[] } {
  const statements: Recorded[] = []
  const pool: TenantPool = {
    async connect() {
      const client = await inner.connect()
      return {
        async query(text: string, values?: readonly unknown[]) {
          statements.push({ text, values: values ?? [] })
          return client.query(text, values)
        },
        release() {
          client.release()
        },
      }
    },
    async end() {
      await inner.end()
    },
  }
  return { pool, statements }
}

/** PostgreSQL's SQLSTATE for "new row violates row-level security policy". */
const RLS_VIOLATION = '42501'

interface PgFailure {
  readonly code: string | undefined
  readonly message: string
}

/** Run a write and report the failure rather than throwing, so a test can name it. */
function failureOf(err: unknown): PgFailure {
  const e = err as { code?: unknown; message?: unknown }
  return {
    code: typeof e.code === 'string' ? e.code : undefined,
    message: typeof e.message === 'string' ? e.message : String(err),
  }
}

/* ------------------------------------------------------------------ *
 * Seeding. NEEDS the BYPASSRLS role, and that is the policies working rather
 * than an inconvenience: `reconcile_app` cannot write a session row for a
 * digest its transaction is not scoped to, and holds no `INSERT` on
 * `tenant.membership` at all — which is 0005's grant decision, asserted below.
 * ------------------------------------------------------------------ */

async function seedRows(): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')

    for (const m of MEMBERSHIPS) {
      await mig.query(
        `INSERT INTO tenant.membership
           (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [m.tenantId, m.id, m.userId, m.roleId, m.grantedBy, m.grantedAt, m.expiresAt, m.revokedAt],
      )
    }

    for (const userId of [MEI, ANA, RAJ, LEE, FDE]) {
      const s = sessionFor(userId)
      await mig.query(
        `INSERT INTO tenant.session
           (id, handle_digest, user_id, connection_id, tenant_id,
            issued_host, authenticated_at, last_used_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8, NULL)`,
        [
          s.id,
          s.handleDigest,
          s.userId,
          s.connectionId,
          s.issuedHost,
          s.authenticatedAt,
          s.lastUsedAt,
          s.expiresAt,
        ],
      )
    }

    /**
     * THE STAFF SESSIONS — one per fixture, minus `FDE`, whose row is already
     * above because 0005's suite needed a staff principal to refuse.
     *
     * ⚠️ EVERY ONE IS `tenant_id NULL`, exactly like the customer rows. Being
     * staff changes nothing about how a session is MINTED; it changes only what
     * may bind one, which is the whole of this slice.
     */
    for (const c of STAFF_CASES) {
      if (c.userId === FDE) continue
      const s = sessionFor(c.userId)
      await mig.query(
        `INSERT INTO tenant.session
           (id, handle_digest, user_id, connection_id, tenant_id,
            issued_host, authenticated_at, last_used_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8, NULL)`,
        [
          s.id,
          c.digest,
          c.userId,
          s.connectionId,
          s.issuedHost,
          s.authenticatedAt,
          s.lastUsedAt,
          s.expiresAt,
        ],
      )
    }

    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

/**
 * THE GRANT ROWS — S-21. Seeded as the MIGRATOR, and needing that role is the
 * policy working rather than an inconvenience: `db/migrations/0008` grants the
 * app role `SELECT` on `tenant.tenant_access_grant` and nothing else, so there
 * is no session in which the request path could have written any of these.
 *
 * 🛑 `nog`'s GRANT IS DELIBERATELY NOT WRITTEN, AND THAT ABSENCE IS THE
 *    FIXTURE. The `StaffCase` carries a grant whose `staffUserId` is the FDE's,
 *    so the MODEL half is handed somebody ELSE's live grant for the right
 *    tenant and must refuse on the principal join; the DATABASE half is handed
 *    nothing, because the policy looks a grant up BY `session.user_id` and
 *    there is no way to offer it one belonging to another person. **The two
 *    halves are asked the same question in the only two vocabularies available
 *    to them**, and both must answer no.
 */
async function seedGrants(): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')
    for (const c of STAFF_CASES) {
      if (c.grant.id === 'tag_never_written') continue
      await mig.query(
        `INSERT INTO tenant.tenant_access_grant
           (tenant_id, id, purpose, staff_user_id, granted_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          c.grant.tenantId,
          c.grant.id,
          c.grant.purpose,
          c.grant.staffUserId,
          c.grant.grantedAt,
          c.grant.expiresAt,
          c.grant.revokedAt,
        ],
      )
      for (const resource of c.resources) {
        await mig.query(
          `INSERT INTO tenant.access_resource_grant (tenant_id, grant_id, resource)
           VALUES ($1, $2, $3)`,
          [c.grant.tenantId, c.grant.id, resource],
        )
      }
    }
    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

/** Put every session back to unselected, so each test starts from the mint state. */
async function resetSelections(): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query('UPDATE tenant.session SET tenant_id = NULL')
  } finally {
    await mig.end()
  }
}

describe('the tenant-binding write — one statement, two policies', { skip }, () => {
  let appPool: TenantPool
  let recorded: Recorded[]

  before(async () => {
    // Rebuilt from the migrations on every run, so a crashed earlier run that
    // left a policy dropped cannot make a later run report a false green.
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seedRows()
    await seedGrants()

    /**
     * Capture the SHIPPED predicate for control (b) — see `restrictivePolicySql`.
     * Read here, once, from the database the migrations just built, so the
     * restore cannot be a stale opinion of what they build.
     */
    const cat = await migratorClient()
    try {
      const res = await cat.query(`
        SELECT pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr
          FROM pg_policy p
          JOIN pg_class c     ON c.oid = p.polrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'tenant' AND c.relname = 'session'
           AND p.polname = 'session_selection_restrictive'
      `)
      const row = res.rows[0] as { check_expr: string | null } | undefined
      assert.ok(
        row?.check_expr,
        'no `session_selection_restrictive` to capture. Every refusal in this file would ' +
          'then be coming from somewhere nobody has identified.',
      )
      restrictivePolicySql =
        'CREATE POLICY session_selection_restrictive ON tenant.session ' +
        `AS RESTRICTIVE FOR ALL WITH CHECK (${row.check_expr})`
    } finally {
      await cat.end()
    }

    /**
     * ⚠️ `max: 1` IS ADVERSARIAL ON PURPOSE. With a one-connection pool the
     * second scoped transaction is FORCED onto the very connection the first
     * returned — the condition B5 describes, where RLS session variables are
     * connection state rather than request state. The test runs against the
     * arrangement most likely to leak rather than one that happens not to.
     */
    const rec = recordingPool(await createAppPool(1))
    appPool = rec.pool
    recorded = rec.statements
  })

  after(async () => {
    if (appPool !== undefined) await appPool.end()
  })

  /* ---------------------------------------------------------------- *
   * Before anything: the control this file drops and restores is the one the
   * migration ships. A drifted hand copy would silently replace 0005's
   * control with this file's opinion of it, for every later test in the run.
   * ---------------------------------------------------------------- */

  it('the shipped restrictive policy is the one this file drops and restores', async () => {
    const admin = await migratorClient()
    try {
      const res = await admin.query(`
        SELECT p.polpermissive,
               pg_catalog.pg_get_expr(p.polqual,      p.polrelid) AS using_expr,
               pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr
          FROM pg_policy p
          JOIN pg_class c     ON c.oid = p.polrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'tenant' AND c.relname = 'session'
           AND p.polname = 'session_selection_restrictive'
      `)
      const row = res.rows[0] as
        | { polpermissive: boolean; using_expr: string | null; check_expr: string | null }
        | undefined

      assert.ok(
        row,
        '`db/migrations/0005_session_and_membership.sql` does not ship a policy named ' +
          '`session_selection_restrictive`. B1`s control is the RESTRICTIVE `WITH CHECK`; ' +
          'without it the permissive policy constrains the digest column and NOTHING ' +
          'ELSE, and every refusal in this file would be coming from somewhere nobody ' +
          'has identified.',
      )
      assert.equal(
        row.polpermissive,
        false,
        'the selection policy is PERMISSIVE. Permissive policies are OR-ed, so a second ' +
          'permissive policy WIDENS what may be written — the exact opposite of the ' +
          'intent, and almost identical in a diff. `AS RESTRICTIVE` is AND-ed.',
      )
      assert.equal(
        row.using_expr,
        null,
        'the restrictive policy carries a `USING` clause. It restricts WRITES only: a ' +
          'restrictive `USING` would make a session row unreadable until its membership ' +
          'was re-proved on every request, INCLUDING the requests whose whole purpose is ' +
          'to discover that the session is revoked.',
      )
      for (const fragment of ['membership', 'user_id', 'revoked_at', 'expires_at']) {
        assert.ok(
          row.check_expr !== null && row.check_expr.includes(fragment),
          `the restrictive \`WITH CHECK\` does not mention \`${fragment}\`. All four are ` +
            'load-bearing: the table, the principal, the retained-revocation term, and ' +
            'the expiry term that B1`s own quoted predicate omits. ' +
            `Got: ${String(row.check_expr)}`,
        )
      }
      /**
       * S-21 — the staff disjunct's own fragments, added 19 Sep 2026.
       *
       * 🛑 `grant_duration_ceiling` IS THE ONE TO READ. A staff disjunct that
       * shipped without the JOIN would still pass every liveness assertion in
       * this file except one, because G292's third term is the only term the
       * membership arm has no analogue for — and it is also what validates the
       * PURPOSE, since a purpose with no ceiling row matches nothing.
       */
      for (const fragment of [
        'tenant_access_grant',
        'staff_user_id',
        'grant_duration_ceiling',
        'granted_at',
        'access_resource_grant',
        'non_delegable_resource',
        'contract_only_resource',
        'permitted_resource',
      ]) {
        assert.ok(
          row.check_expr !== null && row.check_expr.includes(fragment),
          `the restrictive \`WITH CHECK\` does not mention \`${fragment}\`, so G199's ` +
            'staff disjunct is absent or incomplete. The three list tables are there ' +
            'because G167 requires ALL THREE and G75 exists because a third list nobody ' +
            `had named made G60 inert for eight days. Got: ${String(row.check_expr)}`,
        )
      }
      assert.ok(
        row.check_expr !== null && /tenant_id IS NULL/i.test(row.check_expr),
        'the restrictive `WITH CHECK` has no `tenant_id IS NULL` disjunct, so minting an ' +
          'unselected session is refused. `completeFederatedSignIn` constrains `tenantId` ' +
          'to `null` on the wire PRECISELY SO THAT AUTHENTICATION CANNOT CONFER A SCOPE, ' +
          `and without this disjunct the mint itself cannot happen. Got: ${String(row.check_expr)}`,
      )
    } finally {
      await admin.end()
    }
  })

  /* ---------------------------------------------------------------- *
   * The permitted write, plus (a) and (d).
   * ---------------------------------------------------------------- */

  it('a live membership binds the tenant, and the SQL says none of it', async () => {
    await resetSelections()
    const before = recorded.length

    const first = await withSelectionScope(appPool, DIGEST[MEI] ?? '', ACME, async (tx) => {
      const pid = await tx.query('SELECT pg_backend_pid() AS pid')
      const done = await tx.query(SELECTION_WRITE, [ACME])
      const back = await tx.query(READ_BACK)
      return {
        pid: pidOf(pid),
        written: done.rowCount,
        rows: back.rows as Array<{ user_id: string; tenant_id: string | null }>,
      }
    })

    assert.equal(
      first.written,
      1,
      'the write touched a number of rows other than one. `session_rls``s `USING` half ' +
        'is what confines an unqualified UPDATE to the caller`s own row.',
    )
    assert.deepEqual(
      first.rows,
      [{ user_id: MEI, tenant_id: ACME }],
      'the scope saw a row other than its own after the write',
    )

    /* (d) SAME POOLED BACKEND — asserted, not assumed. */
    const second = await withSelectionScope(appPool, DIGEST[MEI] ?? '', ACME, async (tx) => {
      const pid = await tx.query('SELECT pg_backend_pid() AS pid')
      return pidOf(pid)
    })
    assert.equal(
      first.pid,
      second,
      'the two scoped transactions ran on DIFFERENT backends, so this run proved nothing ' +
        'about a pooled connection carrying an earlier request`s state',
    )

    /* (a) NOTHING IN THE SQL NARROWS ANYTHING. */
    const writes = recorded
      .slice(before)
      .filter((s) => s.text.trim().toUpperCase().startsWith('UPDATE'))
    assert.ok(writes.length >= 1, 'expected the write to have been recorded')
    for (const s of writes) {
      const text = s.text.toLowerCase()
      for (const forbidden of ['where', 'membership', 'user_id', 'revoked_at', 'exists']) {
        assert.ok(
          !text.includes(forbidden),
          `the write carried \`${forbidden}\`, so the gating may be coming from the ` +
            'statement rather than from the policies — and a handler that forgot it ' +
            `would then be ungated. Got: ${s.text}`,
        )
      }
      assert.deepEqual(
        s.values,
        [ACME],
        'the write bound something other than the one tenant the host is bound to',
      )
    }

    /* And the scope statements: both GUCs, both BOUND, never interpolated. */
    const scoped = recorded.slice(before).filter((s) => isScopeStatement(s.text))
    assert.equal(
      scoped.length,
      4,
      'expected exactly two `set_config` calls per selection scope — the session digest ' +
        'and the host-bound tenant. A selection that set only one of them cannot satisfy ' +
        'the restrictive check; one that set three is setting something nobody named.',
    )
    assert.deepEqual(
      [...new Set(scoped.map((s) => String(s.values[0])))].sort(),
      ['app.session_ref', 'app.tenant_id'],
      '`withSelectionScope()` set a GUC that is neither the session digest nor the tenant',
    )
    for (const s of scoped) {
      assert.equal(s.values.length, 2, `set_config bound ${s.values.length} values, not 2`)
      assert.ok(
        !s.text.includes(DIGEST[MEI] ?? 'no-digest') && !s.text.includes(ACME),
        `a value was interpolated into the statement text rather than bound: ${s.text}`,
      )
    }
    for (const s of recorded.slice(before)) {
      assert.ok(
        !/\bSET\s+LOCAL\s+app\./i.test(s.text),
        'a `SET LOCAL app.…` statement reached the server. It takes no bind parameters, ' +
          'so this statement either does nothing or carries an interpolated value: ' +
          s.text,
      )
    }
  })

  /* ---------------------------------------------------------------- *
   * 🛑 B1's ATTACK, EXACTLY AS THE DOCUMENT STATES IT.
   * ---------------------------------------------------------------- */

  it('B1 — a principal with no membership in the host tenant cannot bind it', async () => {
    await resetSelections()

    const failed = await attemptSelection(appPool, DIGEST[ANA] ?? '', ACME, ACME)

    assert.ok(
      failed,
      'ANA HELD NO MEMBERSHIP IN ACME AND BOUND IT ANYWAY. This is B1 unfixed: the ' +
        'attacker`s next request resolves `ok`, `TenantContext` carries Acme`s residency, ' +
        'environment and deployment mode, and every handler that reads a scoped row ' +
        'without routing through `decide()` reads Acme`s rows with RLS reporting success.',
    )
    assert.equal(failed.code, RLS_VIOLATION, `unexpected SQLSTATE: ${failed.message}`)
    assert.match(
      failed.message,
      /session_selection_restrictive/,
      'the write was refused by something OTHER than B1`s control — a foreign key, a ' +
        'missing grant, or a typo. Negative control (b) below is what separates those, ' +
        `but the message should name the policy. Got: ${failed.message}`,
    )
  })

  /**
   * 🛑 THE SECOND NARROWING, AND IT IS THE ONE NOBODY DESIGNED.
   *
   * ANA is a live member of GLOBEX. Here she declares the scope she is entitled
   * to and writes the tenant she is not. `membership_rls` narrows the
   * restrictive check's subquery to `app.tenant_id = ten_globex`, so the join
   * `m.tenant_id = session.tenant_id = ten_acme` matches nothing.
   */
  it('declaring one tenant and writing another is refused, from the membership policy', async () => {
    await resetSelections()

    const failed = await attemptSelection(appPool, DIGEST[ANA] ?? '', GLOBEX, ACME)

    assert.ok(
      failed,
      'A SESSION DECLARED SCOPE IN ONE TENANT AND BOUND ITSELF TO ANOTHER. The restrictive ' +
        'check can only pass when the tenant WRITTEN equals the tenant DECLARED, because ' +
        '`membership_rls` narrows the subquery to `app.tenant_id` — two independent ' +
        'narrowings over one write, from two policies neither of which knows about the ' +
        'other. If this passes, one of them has stopped narrowing.',
    )
    assert.equal(failed.code, RLS_VIOLATION, `unexpected SQLSTATE: ${failed.message}`)
  })

  it('and the same principal CAN bind the tenant she is a live member of', async () => {
    await resetSelections()
    const failed = await attemptSelection(appPool, DIGEST[ANA] ?? '', GLOBEX, GLOBEX)
    assert.equal(
      failed,
      null,
      'ANA IS A LIVE MEMBER OF GLOBEX AND WAS REFUSED. A control that refuses everything ' +
        'is not a control — it is an outage, and every other assertion in this file would ' +
        `pass under it. Got: ${failed?.message}`,
    )
  })

  it('a REVOKED membership is still a row, and binds nothing', async () => {
    await resetSelections()
    const failed = await attemptSelection(appPool, DIGEST[RAJ] ?? '', ACME, ACME)
    assert.ok(
      failed,
      '`Membership.revokedAt` is "retained rather than deleted, so a transfer between ' +
        'partners is auditable". An `EXISTS` on `(user_id, tenant_id)` alone would ' +
        're-grant every membership anybody ever lost.',
    )
    assert.equal(failed.code, RLS_VIOLATION, `unexpected SQLSTATE: ${failed.message}`)
  })

  it('an EXPIRED membership binds nothing — the term B1`s quoted predicate omits', async () => {
    await resetSelections()
    const failed = await attemptSelection(appPool, DIGEST[LEE] ?? '', ACME, ACME)
    assert.ok(
      failed,
      'B1 writes the control as `… AND m.revoked_at IS NULL` and stops there. An expired ' +
        'membership is not revoked, so that predicate alone would let a lapsed ' +
        'partner-scoped membership bind a tenant forever — and `Membership.expiresAt` ' +
        'rules that "partner-scoped memberships must expire." Both halves of this slice ' +
        'carry the term, and the divergence from B1 is named on both.',
    )
    assert.equal(failed.code, RLS_VIOLATION, `unexpected SQLSTATE: ${failed.message}`)
  })

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * ✅ AMENDED 19 Sep 2026 — S-21. THIS TEST WENT RED AND THE RED IS THE WHOLE
   *    REASON IT EXISTED.
   * ═══════════════════════════════════════════════════════════════════════
   *
   * 🛑 THE OLD BODY IS QUOTED RATHER THAN DELETED, AND SO IS THE FAILURE IT
   *    PRODUCED, because a control that is edited leaves no trace of having
   *    fired and this one fired exactly once, on purpose:
   *
   *        it('test_the_staff_path_is_unreachable_in_the_database_too_…', …) {
   *          const failed = await attemptSelection(appPool, DIGEST[FDE], ACME, ACME)
   *          assert.ok(failed, 'THE STAFF ARM HAS LANDED AND THIS TEST IS NOW
   *            WRONG — which is what it is for. The commit that changed it owes:
   *            the `OR EXISTS (… tenant_access_grant …)` disjunct, its model arm
   *            on `TenantSelectionInput`, the three-list check in ONE helper
   *            with ONE call site, and the owner`s answer on what liveness terms
   *            admit a grant.')
   *
   *        ✖ AssertionError: … actual: null, expected: true
   *
   *    **`actual: null` means the write SUCCEEDED** — the FDE bound Acme — which
   *    is the sentence G199 declared impossible becoming false in the commit
   *    that was required to make it false. The four things the message says the
   *    commit owes are all in it: the disjunct (`db/migrations/0008`), the model
   *    arm (`TenantSelectionInput.staffGrant`), the three-list check in ONE
   *    helper at ONE call site (`authorisationPermits()`, from
   *    `selectTenantForSession()`), and the owner's liveness terms (G292).
   *
   * ⚠️ WHAT THE TEST ASSERTS NOW IS THE OTHER HALF OF THE SAME SENTENCE, AND IT
   *    IS NOT WEAKER: a platform FDE reaches a tenant **through a grant and only
   *    through a grant**. Being staff is still not access. The permitted case is
   *    asserted above, by name; this one holds the line that survived —
   *    `tenant.membership` is still EMPTY for an FDE and must stay empty, so a
   *    staff principal can never arrive by the customer disjunct.
   */
  it('test_the_staff_path_is_by_GRANT_and_only_by_grant_which_is_what_G199s_cost_became', async () => {
    const admin = await migratorClient()
    try {
      const res = await admin.query(
        'SELECT count(*)::int AS n FROM tenant.membership WHERE user_id = $1',
        [FDE],
      )
      assert.equal(
        (res.rows[0] as { n: number }).n,
        0,
        'A PLATFORM FDE HAS ACQUIRED A MEMBERSHIP, AND THAT IS THE ONE THING THIS SLICE ' +
          'MUST NOT HAVE DONE. "A platform FDE has NO `Membership` — that is what being ' +
          'platform staff means in this model; staff reach a tenant by ' +
          '`TenantAccessGrant`, not by membership." A staff arm built by handing staff a ' +
          'membership row would satisfy every other assertion in this file and would ' +
          'delete invariant 8 rather than enforce it.',
      )
    } finally {
      await admin.end()
    }

    /* And with the GRANT rows removed, the FDE is refused again — so the permit
     * asserted above is the grant and nothing else about this fixture. */
    await resetSelections()
    const mig = await migratorClient()
    try {
      await mig.query('BEGIN')
      await mig.query('DELETE FROM tenant.access_resource_grant')
      await mig.query('DELETE FROM tenant.tenant_access_grant')
      await mig.query('COMMIT')

      const failed = await attemptSelection(appPool, DIGEST[FDE] ?? '', ACME, ACME)
      assert.ok(
        failed,
        'WITH EVERY GRANT ROW DELETED THE FDE STILL BOUND ACME, so the permit asserted ' +
          'above is not coming from the grant. Something else in this fixture is admitting ' +
          'a platform principal, and it is admitting them with no authority at all.',
      )
      assert.equal(failed.code, RLS_VIOLATION, `unexpected SQLSTATE: ${failed.message}`)
    } finally {
      await mig.end()
      await seedGrants()
      await resetSelections()
    }
  })

  /* ================================================================== *
   * THE STAFF ARM — S-21, G199 and G292, 19 Sep 2026.
   *
   * 🛑 READ THE TEST ABOVE FIRST. It asserted, by name, that everything below
   *    was impossible, and it went RED in the commit that landed these. That is
   *    the order the control requires: the red first, the amendment second.
   * ================================================================== */

  it('the three governance lists are READABLE by the app role, or the check fails OPEN', async () => {
    /**
     * 🛑 THE SHARPEST ASSERTION IN THIS FILE AND THE LEAST OBVIOUS ONE.
     * `db/migrations/0008`'s list check is a `NOT EXISTS (… unreachable line …)`.
     * If `non_delegable_resource` or `contract_only_resource` were unreadable to
     * the querying role, the `IN (SELECT …)` would match nothing, the
     * `NOT EXISTS` would be TRUE, and **the check would permit everything it
     * exists to refuse** — `statutory` included, which invariant 8 refuses *"at
     * any price"*. Nothing else in this file would notice: every functional
     * assertion would still pass, because they all exercise grants whose classes
     * ARE reachable.
     */
    const counts = await withSelectionScope(appPool, DIGEST[MEI] ?? '', ACME, async (tx) => {
      const out: Record<string, number> = {}
      for (const table of [
        'non_delegable_resource',
        'contract_only_resource',
        'permitted_resource',
        'grant_duration_ceiling',
      ]) {
        const res = await tx.query(`SELECT count(*)::int AS n FROM tenant.${table}`)
        out[table] = (res.rows[0] as { n: number }).n
      }
      return out
    })

    assert.deepEqual(
      counts,
      {
        non_delegable_resource: NON_DELEGABLE_RESOURCES.length,
        contract_only_resource: CONTRACT_ONLY_RESOURCES.length,
        permitted_resource:
          PERMITTED_RESOURCES.delivery.length + PERMITTED_RESOURCES.incident.length,
        grant_duration_ceiling: Object.keys(MAX_GRANT_HOURS).length,
      },
      'A GOVERNANCE LIST IS UNREADABLE OR THE WRONG SIZE FROM INSIDE A SELECTION SCOPE. ' +
        'Two of the three fail OPEN when empty — an empty `non_delegable_resource` makes ' +
        '`statutory` reachable — and `permitted_resource` fails CLOSED, so a suite that ' +
        'went inexplicably all-red should look here first.',
    )
  })

  it('the seeded lists MIRROR `model/governance.ts`, in both directions', async () => {
    /**
     * 🛑 THIS IS WHAT MAKES `0008`'s THREE TABLES A MIRROR RATHER THAN THE THIRD
     * COPY `0002_run.sql` FORBIDS. Its words: a duplicated enum is *"a third
     * place to drift — and the one nothing checks, because no pair in the
     * wire-mirror addresses SQL."* Nothing in `tools/` addresses SQL today
     * either. This does, for these four sets, in both directions — so editing a
     * constant in `model/governance.ts` without editing `0008`'s seed is a RED
     * with a name on it, which is the only thing that separates a mirror from a
     * drift.
     */
    const admin = await migratorClient()
    try {
      const read = async (sql: string): Promise<string[]> => {
        const res = await admin.query(sql)
        return (res.rows as Array<Record<string, unknown>>).map((r) => Object.values(r).join(':'))
      }

      assert.deepEqual(
        (await read('SELECT resource FROM tenant.non_delegable_resource ORDER BY resource')).sort(),
        [...NON_DELEGABLE_RESOURCES].sort(),
        '`tenant.non_delegable_resource` and `NON_DELEGABLE_RESOURCES` disagree. The list ' +
          'is checked FIRST by `authorisationPermits()` — "before the null check, before ' +
          'withdrawal, before anything" — and G75 exists because a third list nobody had ' +
          'named made G60 INERT for eight days. A fourth copy that disagrees is worse.',
      )
      assert.deepEqual(
        (
          await read('SELECT resource FROM tenant.contract_only_resource ORDER BY resource')
        ).sort(),
        [...CONTRACT_ONLY_RESOURCES].sort(),
        '`tenant.contract_only_resource` and `CONTRACT_ONLY_RESOURCES` disagree.',
      )

      const expectedPermitted: string[] = []
      for (const purpose of ['delivery', 'incident'] as const) {
        for (const resource of PERMITTED_RESOURCES[purpose]) {
          expectedPermitted.push(`${purpose}:${resource}`)
        }
      }
      assert.deepEqual(
        (
          await read(
            'SELECT purpose, resource FROM tenant.permitted_resource ORDER BY purpose, resource',
          )
        ).sort(),
        expectedPermitted.sort(),
        '`tenant.permitted_resource` and `PERMITTED_RESOURCES` disagree. `secret` under ' +
          '`delivery` is the row to check: G60/G75 put it there against a written ' +
          'recommendation and "do not quietly narrow it back" is in the declaration.',
      )

      assert.deepEqual(
        (
          await read('SELECT purpose, max_hours FROM tenant.grant_duration_ceiling ORDER BY purpose')
        ).sort(),
        Object.entries(MAX_GRANT_HOURS)
          .map(([purpose, hours]) => `${purpose}:${hours}`)
          .sort(),
        '`tenant.grant_duration_ceiling` and `MAX_GRANT_HOURS` disagree. G292 makes the ' +
          'ceiling "a property of the PREDICATE rather than of whoever issues the grant", ' +
          'and a policy expression cannot import a TypeScript constant — so this table IS ' +
          'that property in the database, and a drift here is a ceiling nobody chose.',
      )
    } finally {
      await admin.end()
    }
  })

  it('the grant policy and the resource-line policy narrow IDENTICALLY', async () => {
    /**
     * 🛑 THE OTHER HALF OF THE FAIL-OPEN ARGUMENT. A grant visible with its
     * resource lines HIDDEN is the one shape that could slip a `statutory` claim
     * past the `NOT EXISTS`. Two byte-identical predicates over two tables whose
     * rows carry the same `tenant_id` cannot produce it — so the assertion is
     * that they ARE identical, rather than that the outcome happens to be right.
     */
    const admin = await migratorClient()
    try {
      const res = await admin.query(`
        SELECT c.relname,
               pg_catalog.pg_get_expr(p.polqual,      p.polrelid) AS using_expr,
               pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr
          FROM pg_policy p
          JOIN pg_class c     ON c.oid = p.polrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'tenant'
           AND c.relname IN ('tenant_access_grant', 'access_resource_grant')
         ORDER BY c.relname
      `)
      const rows = res.rows as Array<{
        relname: string
        using_expr: string | null
        check_expr: string | null
      }>
      assert.equal(rows.length, 2, 'one of the two staff tables has no policy at all')
      assert.equal(
        rows[0]?.using_expr,
        rows[1]?.using_expr,
        'the two `USING` predicates differ. A grant readable under a scope its resource ' +
          'lines are NOT readable under would hide a `statutory` claim from the `NOT ' +
          'EXISTS`, and the three-list check would pass over it silently.',
      )
      assert.equal(rows[0]?.check_expr, rows[1]?.check_expr, 'the two `WITH CHECK` differ')
      assert.match(
        String(rows[0]?.using_expr),
        /app\.tenant_id/,
        'G100 deny-on-NULL: the staff tables must key on `app.tenant_id` like every other ' +
          'tenant-scoped table, or the second narrowing 0005 discovered does not apply to ' +
          'the staff disjunct.',
      )
    } finally {
      await admin.end()
    }
  })

  it('✅ INVARIANT 8 · a live TenantAccessGrant binds the tenant for a platform FDE', async () => {
    await resetSelections()
    const c = staffCase('fde → acme')

    const failed = await attemptSelection(appPool, c.digest, ACME, ACME)
    assert.equal(
      failed,
      null,
      'THE PERMITTED PATH IS STILL UNREACHABLE. #157: "A prohibition that is enforced by ' +
        'making the permission unreachable is not an enforced invariant; it is an unbuilt ' +
        'feature wearing an invariant`s badge." G199 declared this unreachable and ' +
        'REQUIRED the slice that ends it; if this is red, the slice does not work and the ' +
        `declaration stands. Got: ${failed?.message}`,
    )

    const bound = await withSelectionScope(appPool, c.digest, ACME, async (tx) => {
      const back = await tx.query(READ_BACK)
      return back.rows as Array<{ user_id: string; tenant_id: string | null }>
    })
    assert.deepEqual(
      bound,
      [{ user_id: c.userId, tenant_id: ACME }],
      'the write was accepted and the row does not carry the tenant',
    )
  })

  it('✅ G60/G75 · a delivery grant claiming `secret` and nothing else still binds', async () => {
    await resetSelections()
    const failed = await attemptSelection(appPool, staffCase('sec → acme').digest, ACME, ACME)
    assert.equal(
      failed,
      null,
      'G60 AND G75 HAVE BEEN QUIETLY NARROWED BACK. The product owner put `secret` into ' +
        '`PERMITTED_RESOURCES.delivery` — a standing 90-day reach — AGAINST a written ' +
        'recommendation, and the declaration says "do not relitigate it, and do not ' +
        'quietly narrow it back." A reversal that lives only in prose is a reversal that ' +
        `decays; this is the assertion that notices. Got: ${failed?.message}`,
    )
  })

  it('staff with NO grant anywhere is refused, and somebody else`s grant binds nothing', async () => {
    await resetSelections()
    const failed = await attemptSelection(appPool, staffCase('nog → acme').digest, ACME, ACME)
    assert.ok(
      failed,
      'A PLATFORM PRINCIPAL WITH NO GRANT BOUND A TENANT. There IS a live grant on Acme ' +
        'in this database — the FDE`s — so a policy that matched on tenant alone, or that ' +
        'forgot `g.staff_user_id = session.user_id`, passes here. That is D5 in 0005`s ' +
        'mutation list arriving on the staff disjunct.',
    )
    assert.equal(failed.code, RLS_VIOLATION, `unexpected SQLSTATE: ${failed.message}`)
  })

  it('a REVOKED grant is still a row, and binds nothing', async () => {
    await resetSelections()
    const failed = await attemptSelection(appPool, staffCase('rev → acme').digest, ACME, ACME)
    assert.ok(
      failed,
      'G292 term 1. A revoked grant is RETAINED for the same reason a revoked membership ' +
        'is, so an `EXISTS` on `(staff_user_id, tenant_id)` alone would re-grant every ' +
        'access anybody ever had withdrawn.',
    )
    assert.equal(failed.code, RLS_VIOLATION, `unexpected SQLSTATE: ${failed.message}`)
  })

  it('an EXPIRED grant binds nothing — and expiry is not revocation', async () => {
    await resetSelections()
    const failed = await attemptSelection(appPool, staffCase('exp → acme').digest, ACME, ACME)
    assert.ok(
      failed,
      'G292 term 2, ASSERTED SEPARATELY FROM TERM 1 ON PURPOSE. An expired grant is not a ' +
        'revoked one: `revoked_at IS NULL` alone is true of this row, and that exact ' +
        'omission is the defect the customer arm found in B1`s own quoted predicate. Two ' +
        'terms, two fixtures, two reds.',
    )
    assert.equal(failed.code, RLS_VIOLATION, `unexpected SQLSTATE: ${failed.message}`)
  })

  it('🛑 G292 term 3 · a grant past MAX_GRANT_HOURS is refused though live', async () => {
    await resetSelections()
    const failed = await attemptSelection(appPool, staffCase('long → acme').digest, ACME, ACME)
    assert.ok(
      failed,
      'THE DURATION CEILING IS NOT ENFORCED IN THE DATABASE. This grant is UNREVOKED and ' +
        'UNEXPIRED — it passes both of the terms the membership arm has — and it has been ' +
        'held for 130 days against `MAX_GRANT_HOURS.delivery` of 24 × 90. G292 makes the ' +
        'ceiling "a property of the PREDICATE rather than of whoever issues the grant … so ' +
        'the enforcement does not depend on the issuing path being the only path", and ' +
        'there is no issuing path in this repository at all. Nothing else here sees this.',
    )
    assert.equal(failed.code, RLS_VIOLATION, `unexpected SQLSTATE: ${failed.message}`)
  })

  it('the ceiling is PER PURPOSE — the same 31-day window passes as delivery and fails as incident', async () => {
    await resetSelections()
    const incident = await attemptSelection(appPool, staffCase('inl → acme').digest, ACME, ACME)
    await resetSelections()
    const delivery = await attemptSelection(appPool, staffCase('dls → acme').digest, ACME, ACME)

    assert.ok(
      incident,
      'A 31-DAY INCIDENT GRANT WAS ADMITTED. `MAX_GRANT_HOURS.incident` is 24 HOURS — ' +
        '"Hours. Diagnosing a live problem." — and this window is thirty-one times it. A ' +
        'single ceiling column, or a hard-coded number in the policy, passes this.',
    )
    assert.equal(
      delivery,
      null,
      'AND THE CONTROL FOR IT: the IDENTICAL dates under `delivery` must be ADMITTED, or ' +
        'the refusal above is not the ceiling at all — it is the window, and the ceiling ' +
        `table is proving nothing. Got: ${delivery?.message}`,
    )
  })

  it('a LIVE grant for the OTHER tenant cannot bind this one', async () => {
    await resetSelections()
    const failed = await attemptSelection(appPool, staffCase('crx → acme').digest, ACME, ACME)
    assert.ok(
      failed,
      'A GRANT FOR GLOBEX BOUND ACME. `grantAllows()` records this exact defect being ' +
        'fixed on 5 Aug 2026 — "it previously took the grant and never compared ' +
        '`grant.tenantId` to anything, so a grant for tenant A validated an operation ' +
        'against tenant B — the exact shape of the failure this whole module exists to ' +
        'prevent, in the function named after permitting it."',
    )
    assert.equal(failed.code, RLS_VIOLATION, `unexpected SQLSTATE: ${failed.message}`)

    /* And the same principal CAN bind the tenant the grant names — a control that
     * refuses everything is an outage, not a control. */
    await resetSelections()
    const honest = await attemptSelection(appPool, staffCase('crx → acme').digest, GLOBEX, GLOBEX)
    assert.equal(honest, null, `the cross-tenant fixture cannot bind its OWN tenant either: ${honest?.message}`)
  })

  it('a staff principal declaring one tenant and writing another is refused by the JOIN', async () => {
    /**
     * ═════════════════════════════════════════════════════════════════════
     * 🛑 THE NARROWEST TEST IN THE FILE, AND IT EXISTS BECAUSE A MUTATION
     *    SURVIVED WITHOUT IT. THE STAFF MIRROR OF 0005's D4.
     * ═════════════════════════════════════════════════════════════════════
     *
     * Deleting `AND g.tenant_id = session.tenant_id` from the staff disjunct
     * left the WHOLE SUITE GREEN, because every other staff case declares and
     * writes the same tenant — and `tenant_access_grant_rls` has already
     * narrowed the subquery to the DECLARED tenant, so the join looks redundant
     * from inside every one of them. It is not redundant: it is the only thing
     * standing when the two differ.
     *
     * 0005 says this about its own D4 and the sentence transfers exactly: *"THE
     * NARROWEST AND THE MOST INSTRUCTIVE: only ONE test in the file sees it,
     * because every other case fails for a second reason as well. A suite
     * without that case would have shipped this mutation green."*
     *
     * `crx` holds a LIVE grant on GLOBEX. Here she declares GLOBEX — which is
     * the scope her grant is visible under, so the subquery finds it — and
     * writes ACME. Only the join refuses her.
     */
    await resetSelections()
    const failed = await attemptSelection(appPool, staffCase('crx → acme').digest, GLOBEX, ACME)
    assert.ok(
      failed,
      'A STAFF SESSION DECLARED SCOPE IN THE TENANT IT HOLDS A GRANT ON AND BOUND ITSELF ' +
        'TO ANOTHER. The grant IS live and IS visible under the declared scope; ' +
        '`g.tenant_id = session.tenant_id` is the only term that sees the mismatch, and ' +
        'without it a staff grant on ANY tenant binds ANY other tenant the attacker names.',
    )
    assert.equal(failed.code, RLS_VIOLATION, `unexpected SQLSTATE: ${failed.message}`)
  })

  it('🛑 `statutory` is refused AT ANY PRICE, by the list and not by a capability', async () => {
    await resetSelections()
    const statutory = await attemptSelection(appPool, staffCase('sta → acme').digest, ACME, ACME)
    assert.ok(
      statutory,
      'A GRANT CLAIMING `statutory` BOUND A TENANT. Invariant 8: "`statutory` appears in ' +
        'neither, AT ANY PRICE: a statutory obligation is not the customer`s to delegate ' +
        'to a processor." It is refused here by membership of ' +
        '`NON_DELEGABLE_RESOURCES` — the list `authorisationPermits()` tests FIRST — and ' +
        'not by any capability, because no capability is read at selection time at all.',
    )
    assert.equal(statutory.code, RLS_VIOLATION, `unexpected SQLSTATE: ${statutory.message}`)

    await resetSelections()
    const authority = await attemptSelection(appPool, staffCase('aut → acme').digest, ACME, ACME)
    assert.ok(
      authority,
      'A GRANT CLAIMING `authority` BOUND A TENANT. `CONTRACT_ONLY_RESOURCES` — and there ' +
        'is no `SupportAuthorisation` in this database to open it, because G292 was ' +
        'offered one as a liveness term and DECLINED it. The decline removed a ' +
        'REQUIREMENT, not a CHECK: with no contract, a contract-only class is refused.',
    )

    await resetSelections()
    const commercial = await attemptSelection(appPool, staffCase('com → acme').digest, ACME, ACME)
    assert.ok(
      commercial,
      'A GRANT CLAIMING `commercial` BOUND A TENANT. It is in NEITHER of the other two ' +
        'lists and in no `PERMITTED_RESOURCES` entry — "no purpose lists them and no ' +
        'contract may, because they are not in CONTRACT_ONLY_RESOURCES … Left closed ' +
        'deliberately." THREE CLASSES, THREE LISTS, THREE REFUSALS: this is G167`s ' +
        '"all three" made observable rather than reviewed.',
    )

    /**
     * 🛑 AND THE DIFFERENTIAL THAT MAKES THE THREE ABOVE MEAN SOMETHING. The
     * grants are identical in every respect but the class they claim, and one of
     * the four IS admitted — so the refusals are the CLASS, not the shape of the
     * fixture. Without this line all three could be failing on a typo.
     */
    await resetSelections()
    const permitted = await attemptSelection(appPool, staffCase('fde → acme').digest, ACME, ACME)
    assert.equal(
      permitted,
      null,
      `a grant claiming only PERMITTED classes was refused too, so the three refusals ` +
        `above are not about the class at all. Got: ${permitted?.message}`,
    )
  })

  it('🛑 G75 · widening `permitted_resource` does NOT make `statutory` reachable', async () => {
    /**
     * ═════════════════════════════════════════════════════════════════════
     * 🛑 THIS TEST EXISTS BECAUSE TWO MUTATIONS SURVIVED WITHOUT IT, AND WHAT
     *    THEY EXPOSED IS G75's OWN LESSON RUNNING IN THE OPPOSITE DIRECTION.
     * ═════════════════════════════════════════════════════════════════════
     *
     * Deleting the `non_delegable_resource` term from `0008`'s list check, and
     * separately the `contract_only_resource` term, left every behavioural
     * assertion in this file GREEN. Neither is redundant — they are MASKED:
     * `statutory` and `authority` are absent from `permitted_resource` too, so
     * the third term refuses them anyway, and the first two look decorative
     * from inside every fixture.
     *
     * **That is exactly the shape G75 was taken to fix, mirrored.** There,
     * `secret` sat in `NON_DELEGABLE_RESOURCES` while G60 put it in a permitted
     * list, and the first-position refusal made the widening INERT for eight
     * days. Here the first-position refusal is itself invisible — until
     * somebody widens the permitted list, which is the one event it exists for.
     *
     * So the witness is the widening. `('delivery', 'statutory')` goes into
     * `permitted_resource`, and invariant 8 must hold anyway: *"`statutory`
     * appears in neither, AT ANY PRICE."* If this test ever passes only because
     * the third term refused, it will fail here and say so.
     */
    const admin = await migratorClient()
    try {
      await admin.query(
        `INSERT INTO tenant.permitted_resource (purpose, resource)
         VALUES ('delivery', 'statutory'), ('delivery', 'authority')`,
      )

      await resetSelections()
      const statutory = await attemptSelection(appPool, staffCase('sta → acme').digest, ACME, ACME)
      assert.ok(
        statutory,
        'WIDENING `permitted_resource` MADE `statutory` REACHABLE, WHICH MEANS THE ' +
          '`non_delegable_resource` TERM IS DOING NOTHING. Invariant 8 says "at any ' +
          'price"; a deny list that only refuses what the permit list already refused is ' +
          'not a deny list, it is a comment. This is G75 in reverse: there, a ' +
          'first-position refusal made a WIDENING inert and nobody noticed for eight days ' +
          'because nothing tested the interaction of two lists. This does.',
      )
      assert.equal(statutory.code, RLS_VIOLATION, `unexpected SQLSTATE: ${statutory.message}`)

      await resetSelections()
      const authority = await attemptSelection(appPool, staffCase('aut → acme').digest, ACME, ACME)
      assert.ok(
        authority,
        'WIDENING `permitted_resource` MADE `authority` REACHABLE WITH NO CONTRACT. ' +
          '§8.7`s distinction is that `PERMITTED_RESOURCES` is what the PLATFORM decides ' +
          'and a `SupportAuthorisation` is what the CUSTOMER decides — so a platform-side ' +
          'widening must not be able to open a contract-only class. There is no contract ' +
          'in this database at all, because G292 declined to require one.',
      )

      /**
       * AND THE CONTROL, because a widening that changed NOTHING would mean the
       * insert never took effect and all three refusals above are vacuous.
       * `commercial` is in none of the three lists, so widening it IS supposed
       * to make it reachable — the permit list is the one that may be widened.
       */
      await admin.query(
        `INSERT INTO tenant.permitted_resource (purpose, resource) VALUES ('delivery', 'commercial')`,
      )
      await resetSelections()
      const commercial = await attemptSelection(appPool, staffCase('com → acme').digest, ACME, ACME)
      assert.equal(
        commercial,
        null,
        'THE WIDENING DID NOT TAKE EFFECT AT ALL, so the two refusals above prove nothing ' +
          'about the deny lists — they prove the INSERT did not land. `commercial` sits in ' +
          'none of the three lists, so widening the permit list is exactly what SHOULD ' +
          `open it, and this is the differential that says the fixture is live. Got: ${commercial?.message}`,
      )
    } finally {
      await admin.query(
        `DELETE FROM tenant.permitted_resource
          WHERE purpose = 'delivery' AND resource IN ('statutory', 'authority', 'commercial')`,
      )
      await admin.end()
      await resetSelections()
    }
  })

  it('a live grant with NO resource lines binds a tenant and reaches nothing', async () => {
    await resetSelections()
    const failed = await attemptSelection(appPool, staffCase('emp → acme').digest, ACME, ACME)
    assert.equal(
      failed,
      null,
      'AN EMPTY GRANT WAS REFUSED, AND THAT IS A TERM NOBODY RULED. G292 names three ' +
        'liveness terms and "carries at least one resource line" is not among them. The ' +
        'row is harmless because SELECTION IS NOT USE: `grantAllows()` refuses every class ' +
        'for a grant with no line, so this binds a session and reaches nothing. Adding the ' +
        `term would be a Builder inventing policy. Got: ${failed?.message}`,
    )
  })

  it('the app role may READ grants and may not WRITE one — 0008`s grant decision', async () => {
    const failure = await withSelectionScope(
      appPool,
      DIGEST[MEI] ?? '',
      ACME,
      async (tx): Promise<PgFailure | null> => {
        try {
          await tx.query(
            `INSERT INTO tenant.tenant_access_grant
               (tenant_id, id, purpose, staff_user_id, granted_at, expires_at, revoked_at)
             VALUES ($1, 'tag_minted', 'delivery', $2, now(), now() + interval '1 day', NULL)`,
            [ACME, MEI],
          )
          return null
        } catch (err) {
          return failureOf(err)
        }
      },
    )

    assert.ok(
      failure,
      'THE REQUEST PATH CAN MINT A TENANT ACCESS GRANT, AND THEREFORE CAN MINT ITSELF A ' +
        'STAFF SCOPE IN TWO STATEMENTS. 0008 grants `SELECT` and nothing else, for 0005`s ' +
        'reason applied to a stronger instrument: a grant crosses the staff/customer ' +
        'boundary invariant 8 is about, and nothing on the request path issues one. The ' +
        'commit that builds the issuing path adds the privilege, with the writer.',
    )
  })

  it('binding a session back to NULL is permitted — the mint path must survive', async () => {
    await resetSelections()
    const ok = await withSelectionScope(appPool, DIGEST[MEI] ?? '', ACME, async (tx) => {
      await tx.query(SELECTION_WRITE, [ACME])
      const undone = await tx.query('UPDATE tenant.session SET tenant_id = NULL')
      return undone.rowCount
    })
    assert.equal(
      ok,
      1,
      'the `tenant_id IS NULL` disjunct is gone or unreachable. `completeFederatedSignIn` ' +
        'mints a session with `tenantId` constrained to `null` on the wire precisely so ' +
        'that authentication cannot confer a scope; without this the mint is refused, and ' +
        'the repair a hurried reader reaches for is to widen the OTHER disjunct.',
    )
  })

  /* ---------------------------------------------------------------- *
   * 🛑 THE MEASURED FACT THAT DECIDED `db/selection-scope.ts`.
   * ---------------------------------------------------------------- */

  it('inside the SESSION helper alone, even a legitimate selection is refused', async () => {
    await resetSelections()

    let failure: PgFailure | null = null
    try {
      await withSessionScope(appPool, DIGEST[MEI] ?? '', async (tx) => {
        await tx.query(SELECTION_WRITE, [ACME])
      })
    } catch (err) {
      failure = failureOf(err)
    }

    assert.ok(
      failure,
      'A SELECTION SUCCEEDED INSIDE `withSessionScope()`, WHICH MEANS THE THIRD SCOPED ' +
        'HELPER IS NO LONGER NECESSARY AND SOMEBODY SHOULD SAY SO. `db/session-scope.ts` ' +
        'sets the bar for the set: "each exists because a table cannot be protected by ' +
        'the other`s predicate, not because a caller found it convenient." If this passes, ' +
        'either `membership_rls` has stopped narrowing the restrictive subquery — which ' +
        'is a widening nobody argued for — or the restrictive policy is gone.',
    )
    assert.equal(failure.code, RLS_VIOLATION, `unexpected SQLSTATE: ${failure.message}`)

    // And the cause, isolated: with membership RLS off, the identical call
    // inside the identical helper SUCCEEDS. So the refusal above is produced by
    // row-level security reaching inside a policy expression, and by nothing
    // else — not by the grant, not by the FK, not by the helper.
    const admin = await migratorClient()
    try {
      await admin.query('ALTER TABLE tenant.membership DISABLE ROW LEVEL SECURITY')
      const written = await withSessionScope(appPool, DIGEST[MEI] ?? '', async (tx) => {
        const done = await tx.query(SELECTION_WRITE, [ACME])
        return done.rowCount
      })
      assert.equal(
        written,
        1,
        'with `tenant.membership` UNPROTECTED the same call still failed, so the refusal ' +
          'above is NOT the membership policy narrowing the restrictive subquery and this ' +
          'file has mis-identified the mechanism. The argument for `db/selection-scope.ts` ' +
          'rests on that mechanism; find the real one before trusting either.',
      )
    } finally {
      await admin.query('ALTER TABLE tenant.membership ENABLE ROW LEVEL SECURITY')
      await admin.end()
      await resetSelections()
    }
  })

  /* ---------------------------------------------------------------- *
   * (b) THE NEGATIVE CONTROL — WITHOUT THE RESTRICTIVE POLICY, B1 WORKS.
   *
   * ⚠️ THE CONTROL IS `DROP POLICY`, NOT `DISABLE ROW LEVEL SECURITY`, and the
   * polarity is the opposite of the one `tests/db/session-isolation.test.ts`
   * argues for — deliberately, because the property is the opposite. There the
   * realistic defect is a migration that forgets to ENABLE, which fails OPEN on
   * a READ; here the realistic defect is a migration that ships the permissive
   * policy and NOT the restrictive one, which is precisely the state B1 found
   * and is reproduced by dropping exactly that policy.
   * ---------------------------------------------------------------- */

  it('with the RESTRICTIVE policy dropped, every refusal above becomes a success', async () => {
    await resetSelections()
    const admin = await migratorClient()
    try {
      await admin.query('DROP POLICY session_selection_restrictive ON tenant.session')

      const leaked: string[] = []
      for (const [who, digest] of [
        ['ana (member of globex only)', DIGEST[ANA]],
        ['raj (revoked)', DIGEST[RAJ]],
        ['lee (expired)', DIGEST[LEE]],
        /**
         * ⚠️ THIS ROW READ `the platform FDE (no membership anywhere)` AND THE
         * PARENTHESIS WENT FALSE WITH S-21 — the FDE now holds a live grant and
         * is ADMITTED with the policy in place, so it no longer separates
         * anything. It is replaced by three staff principals the policy
         * REFUSES, which is what this control needs: a principal that fails with
         * the policy and succeeds without it.
         */
        ['a staff principal with no grant', staffCase('nog → acme').digest],
        ['a staff principal whose grant is revoked', staffCase('rev → acme').digest],
        ['a staff principal past the duration ceiling', staffCase('long → acme').digest],
        ['a staff grant claiming `statutory`', staffCase('sta → acme').digest],
      ] as const) {
        const failed = await attemptSelection(appPool, digest ?? '', ACME, ACME)
        if (failed === null) leaked.push(who)
        await resetSelections()
      }

      assert.deepEqual(
        leaked.sort(),
        [
          'ana (member of globex only)',
          'lee (expired)',
          'raj (revoked)',
          'a staff principal with no grant',
          'a staff principal whose grant is revoked',
          'a staff principal past the duration ceiling',
          'a staff grant claiming `statutory`',
        ].sort(),
        'DROPPING B1`S CONTROL DID NOT CHANGE THE RESULT, WHICH MEANS THE REFUSALS ' +
          'ASSERTED ABOVE ARE NOT COMING FROM IT. The foreign key, the grants and the ' +
          'permissive policy all sit in the same statement`s path and any of them could ' +
          'be producing them — and B1`s whole finding is that the foreign key WAS the ' +
          'only thing standing there. Without this control, every assertion in this file ' +
          'is §5.6.',
      )
    } finally {
      await admin.query('SET ROLE reconcile_owner')
      await admin.query(restrictivePolicySql)
      await admin.end()
      await resetSelections()
    }
  })

  /* ---------------------------------------------------------------- *
   * (c) THE SECOND NEGATIVE CONTROL — WITHOUT RLS ON `session`, ONE SESSION
   *     REWRITES ANOTHER'S ROW.
   *
   * The restrictive policy does not confine WHICH row is touched, only what
   * value it may take. `session_rls` is what makes an unqualified `UPDATE` a
   * one-row statement, and this is what says so.
   * ---------------------------------------------------------------- */

  it('with RLS DISABLED on the session table, one write rewrites EVERY session', async () => {
    await resetSelections()
    const admin = await migratorClient()
    try {
      await admin.query('ALTER TABLE tenant.session DISABLE ROW LEVEL SECURITY')

      const written = await withSelectionScope(appPool, DIGEST[MEI] ?? '', ACME, async (tx) => {
        const done = await tx.query(SELECTION_WRITE, [ACME])
        return done.rowCount
      })

      /**
       * ⚠️ THIS WAS THE LITERAL `5` AND IT WENT RED AT `18 !== 5` WHEN S-21
       * SEEDED THIRTEEN STAFF SESSIONS. The number was never the property — the
       * property is *"every session row in the table"* — so it is DERIVED now
       * rather than swept to 18, because a literal here goes stale on the next
       * fixture anybody adds and its staleness looks exactly like a defect.
       *
       * 🛑 AND THE `> 1` IS NOT REDUNDANT WITH THE EQUALITY. If a future fixture
       * set left exactly one session row, `written === total` would be trivially
       * true and this control would silently stop controlling anything.
       */
      const totalSessions = 5 + STAFF_CASES.filter((c) => c.userId !== FDE).length
      assert.ok(totalSessions > 1, 'a one-row fixture makes this control vacuous')
      assert.equal(
        written,
        totalSessions,
        'turning RLS OFF did not widen the write, which means the one-row confinement ' +
          'asserted at the top of this file is NOT coming from `session_rls`. The ' +
          'statement has no `WHERE`; if it still touches one row, something else is ' +
          'narrowing it and this file does not know what.',
      )
    } finally {
      await admin.query('ALTER TABLE tenant.session ENABLE ROW LEVEL SECURITY')
      await admin.end()
      await resetSelections()
    }
  })

  /* ---------------------------------------------------------------- *
   * (e) THE TWO HALVES AGREE — #157's "either alone is a defeat", executable.
   * ---------------------------------------------------------------- */

  it('test_the_model_half_and_the_database_half_return_the_same_verdict', async () => {
    /**
     * ⚠️ AMENDED 19 Sep 2026 — S-21 — AND THE AMENDMENT IS BECAUSE THIS TEST
     * CAUGHT THE DEFEAT IT WAS BUILT FOR, ON ITS FIRST RUN AGAINST THE STAFF
     * ARM. The row `fde → acme (staff, none)` reported:
     *
     *     selectTenantForSession() says refused, the database says ok
     *
     * **Both halves were correct and the TEST was wrong**, which is the more
     * interesting failure: the database read the FDE's grant out of
     * `tenant.tenant_access_grant`, and the model half was handed `memberships`
     * and no `staffGrant` at all — so the two halves were being asked different
     * questions and answering them accurately. #157's *"either alone is a
     * defeat"* has a third member and this is it: **a harness that supplies one
     * half less evidence than the other proves nothing about either.**
     *
     * The fourteen staff fixtures are folded in below, each carrying the grant
     * the database was seeded with, so both halves see the same world.
     */
    const cases: ReadonlyArray<readonly [string, UserId, TenantId]> = [
      ['mei → acme (live)', MEI, ACME],
      ['mei → globex (none)', MEI, GLOBEX],
      ['ana → globex (live)', ANA, GLOBEX],
      ['ana → acme (none)', ANA, ACME],
      ['raj → acme (revoked)', RAJ, ACME],
      ['lee → acme (expired)', LEE, ACME],
    ]

    const disagreements: string[] = []

    /* THE STAFF HALF OF THE TABLE — every fixture, both halves, one loop. */
    for (const c of STAFF_CASES) {
      await resetSelections()

      const model = selectTenantForSession({
        session: sessionFor(c.userId),
        hostBoundTenantId: c.host,
        /* A HAYSTACK, and staff are in none of it. Passing the real array rather
         * than `[]` is what makes "the FDE has no membership" a fact this call
         * re-derives instead of a fact the harness assumes. */
        memberships: MEMBERSHIPS,
        staffGrant: c.grant,
        now: NOW,
      })
      const failed = await attemptSelection(appPool, c.digest, c.host, c.host)
      const database = failed === null

      if (model.ok !== database || model.ok !== c.admitted) {
        disagreements.push(
          `${c.label}: fixture says ${c.admitted ? 'admitted' : 'refused'}, ` +
            `selectTenantForSession() says ${model.ok ? 'ok' : 'refused'}, ` +
            `the database says ${database ? 'ok' : 'refused'}` +
            (failed ? ` (${failed.code}: ${failed.message})` : ''),
        )
      }
      if (!model.ok && model.refusal !== 'access_grant_absent') {
        /**
         * 🛑 THE REFUSAL NAME IS PART OF THE VERDICT AND CHECKING IT IS NOT
         * PEDANTRY. Every case here OFFERS a grant, so a refusal that came back
         * `membership_absent` would mean the staff arm was never entered at all
         * — the function would be right by accident, and the whole table would
         * be green while asserting nothing about the arm it exists to test.
         */
        disagreements.push(`${c.label}: refused as \`${model.refusal}\`, not \`access_grant_absent\``)
      }
    }

    for (const [label, userId, tenantId] of cases) {
      await resetSelections()

      const model = selectTenantForSession({
        session: sessionFor(userId),
        hostBoundTenantId: tenantId,
        memberships: MEMBERSHIPS,
        now: NOW,
      })
      const failed = await attemptSelection(appPool, DIGEST[userId] ?? '', tenantId, tenantId)
      const database = failed === null

      if (model.ok !== database) {
        disagreements.push(
          `${label}: selectTenantForSession() says ${model.ok ? 'ok' : 'refused'}, ` +
            `the database says ${database ? 'ok' : 'refused'}` +
            (failed ? ` (${failed.code}: ${failed.message})` : ''),
        )
      }
    }
    await resetSelections()

    assert.deepEqual(
      disagreements,
      [],
      'THE MODEL HALF AND THE DATABASE HALF DISAGREE. #157 rules that "either alone is a ' +
        'defeat" — two halves that answer differently are a third defeat nobody named: ' +
        'whichever one a reader consults, they will be wrong about the other. The two ' +
        'clocks are the one legitimate source of difference (`now()` is the ' +
        'transaction`s; the model`s is the caller`s), and no case here is within a ' +
        `transaction of a boundary.\n\n${disagreements.join('\n')}`,
    )
  })

  /* ---------------------------------------------------------------- *
   * 0005's grant decision, and the membership table's own isolation.
   * ---------------------------------------------------------------- */

  it('the app role may READ memberships and may not WRITE one — 0005`s grant decision', async () => {
    const failure = await withSelectionScope(
      appPool,
      DIGEST[MEI] ?? '',
      ACME,
      async (tx): Promise<PgFailure | null> => {
        try {
          await tx.query(
            `INSERT INTO tenant.membership
               (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
             VALUES ($1, 'mem_minted', $2, 'rol_x', $2, now(), NULL, NULL)`,
            [ACME, MEI],
          )
          return null
        } catch (err) {
          return failureOf(err)
        }
      },
    )

    assert.ok(
      failure,
      'THE REQUEST PATH CAN MINT A MEMBERSHIP, AND THEREFORE CAN MINT ITS OWN TENANT ' +
        'SCOPE IN TWO STATEMENTS. 0005 grants `SELECT` and nothing else, because nothing ' +
        'on the request path mints a membership: `/invite` is drawn and unbuilt, ' +
        '`Invitation` is declared and has no table, and G229 rules that "the inviter`s ' +
        'act carries the grant; acceptance redeems it." A write privilege ahead of a ' +
        'writer is what `0004_subject_ledger.sql` refused at length one file back.',
    )
    assert.equal(failure.code, RLS_VIOLATION, `unexpected SQLSTATE: ${failure.message}`)
  })

  it('membership rows are tenant-scoped like every other row — G100`s deny-on-NULL', async () => {
    const underAcme = await withSelectionScope(appPool, DIGEST[MEI] ?? '', ACME, async (tx) => {
      const res = await tx.query('SELECT tenant_id, user_id FROM tenant.membership')
      return (res.rows as Array<{ tenant_id: string }>).map((r) => r.tenant_id)
    })
    assert.deepEqual(
      [...new Set(underAcme)],
      [ACME],
      'a tenant-scoped read saw another tenant`s membership rows. That is invariant 1 ' +
        'over the one table the restrictive check reads — and it is also what makes the ' +
        'second narrowing work, so losing it loses both.',
    )

    const outside = await withSessionScope(appPool, DIGEST[MEI] ?? '', async (tx) => {
      const res = await tx.query('SELECT tenant_id FROM tenant.membership')
      return res.rowCount
    })
    assert.equal(
      outside,
      0,
      'membership rows were visible with `app.tenant_id` unset. G100 requires ' +
        'deny-on-NULL, and this is the precise fact the restrictive subquery depends on: ' +
        'if it is false, the subquery stops being narrowed by the declared tenant and the ' +
        'second narrowing asserted above is an illusion.',
    )
  })

  /* ---------------------------------------------------------------- *
   * The role attributes every assertion above silently depends on.
   * ---------------------------------------------------------------- */

  it('the pool role can neither bypass RLS nor own the tables it writes', async () => {
    const attrs = await withSelectionScope(appPool, DIGEST[MEI] ?? '', ACME, async (tx) => {
      const res = await tx.query(`
        SELECT r.rolsuper, r.rolbypassrls,
               (SELECT count(*) FROM pg_class c
                  JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname = 'tenant'
                   AND c.relname IN ('session', 'membership')
                   AND c.relrowsecurity AND c.relforcerowsecurity) AS protected,
               (SELECT count(*) FROM pg_class c
                  JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname = 'tenant'
                   AND c.relname IN ('session', 'membership')
                   AND pg_catalog.pg_get_userbyid(c.relowner) = current_user) AS owned
        FROM pg_roles r WHERE r.rolname = current_user
      `)
      return res.rows[0] as {
        rolsuper: boolean
        rolbypassrls: boolean
        protected: string
        owned: string
      }
    })

    assert.equal(attrs.rolsuper, false, 'the pool connected as a SUPERUSER, which bypasses RLS')
    assert.equal(
      attrs.rolbypassrls,
      false,
      'the pool role holds BYPASSRLS, so no assertion in this file means anything',
    )
    assert.equal(
      Number(attrs.protected),
      2,
      'one of `tenant.session` and `tenant.membership` is missing ENABLE or FORCE. ENABLE ' +
        'alone leaves the table OWNER exempt, so a test connecting as the owner passes ' +
        'with the policy doing nothing and passes just as well with the policy dropped.',
    )
    assert.equal(
      Number(attrs.owned),
      0,
      'the pool role OWNS a table it writes, and an owner may disable RLS on it',
    )
  })
})

/* ==================================================================== *
 * THE MUTATIONS, RUN AND RECORDED.
 *
 * A control added without a demonstrated red is §5.6 wearing a different hat,
 * and a DATABASE control is the easiest place in this repository to build one:
 * a write can be refused by a foreign key, a missing grant, a typo in a table
 * name or a policy, and all four look identical from a test that only asserts
 * "it threw". Each mutation below was applied to
 * `db/migrations/0005_session_and_membership.sql`, `resetSchema()` rebuilt the
 * database from the migrations, and the reds were recorded by NAME.
 *
 *   D1  delete `session_selection_restrictive` entirely — B1 unfixed, which is
 *       the state the document found
 *       → 8 reds, among them `B1 — a principal with no membership …`,
 *          `a REVOKED membership …`, `an EXPIRED membership …`,
 *          `test_the_staff_path_is_unreachable_in_the_database_too …` and
 *          `with the RESTRICTIVE policy dropped, every refusal above becomes a
 *          success` — the last one red because there was nothing left to drop.
 *
 *   D2  delete `AND m.revoked_at IS NULL`
 *       → 2 reds: the revoked case, and the drift check at the top of the file.
 *
 *   D3  delete `AND (m.expires_at IS NULL OR m.expires_at > now())`
 *       → 2 reds: the expired case, and the drift check.
 *
 *   D4  delete `AND m.tenant_id = session.tenant_id`
 *       → 1 red: `declaring one tenant and writing another is refused`. THE
 *          NARROWEST AND THE MOST INSTRUCTIVE: only ONE test in the file sees
 *          it, because every other case fails for a second reason as well. A
 *          suite without that case would have shipped this mutation green.
 *
 *   D5  delete `WHERE m.user_id = session.user_id`
 *       → 5 reds, including the staff case — the FDE binds Acme on the
 *          strength of somebody ELSE's membership.
 *
 *   D6  re-key `session_rls` on `app.tenant_id` instead of the handle digest,
 *       i.e. G160 decided the other way
 *       → 15 reds across BOTH database suites, including
 *          `an UNSELECTED session (tenant_id NULL) is readable by its own
 *          digest`. That is S-1's predicted failure, witnessed: the row is
 *          invisible to the connection that just wrote it, so nothing can ever
 *          select a tenant. The ruling is not a preference.
 *
 *   D7  delete `FORCE ROW LEVEL SECURITY` on `tenant.session`
 *       → 2 reds, one in each suite, both the role-attribute assertion. `tsc`
 *          green, every functional assertion green — the ONLY thing that sees
 *          this is a test that reads `pg_class` and asks.
 *
 *   D8  widen the membership grant to `SELECT, INSERT, UPDATE, DELETE`
 *       → 1 red: `the app role may READ memberships and may not WRITE one`.
 *          Worth its own line because the widened grant makes every other
 *          assertion in this file PASS while the request path can mint its own
 *          tenant scope in two statements.
 *
 * ── S-21, 19 Sep 2026 · the staff disjunct in `0008_staff_grant_selection.sql`
 *
 *   D9   delete `AND g.revoked_at IS NULL`
 *        → 2 reds: `a REVOKED grant is still a row`, and the two-halves
 *           agreement — which is the shape to notice: **every database
 *           mutation below also reddens `test_the_model_half_and_the_database_
 *           half_return_the_same_verdict`**, because the model half is
 *           unmutated and the two stop agreeing. That test is the cheapest
 *           detector in the file and it did not exist to be one.
 *
 *   D10  delete `AND g.expires_at > now()`     → the EXPIRED grant's red.
 *   D11  delete the ceiling term
 *        → 4 reds: G292 term 3, the per-purpose differential, the agreement,
 *           and the drift check. **The drift check catches it textually** —
 *           `grant_duration_ceiling` disappears from the shipped expression.
 *
 *   D12  delete `AND g.staff_user_id = session.user_id`
 *        → 13 reds. The widest of them: with the principal join gone, EVERY
 *           refused staff fixture binds Acme on the FDE's grant, and the
 *           customer cases fall over with them.
 *
 *   D13  delete `AND g.tenant_id = session.tenant_id`
 *        → 🛑 **1 red, and ONLY ONE**: `a staff principal declaring one tenant
 *           and writing another is refused by the JOIN`. **That test did not
 *           exist until this mutation survived without it**, and the mutation
 *           survived because `tenant_access_grant_rls` has already narrowed the
 *           subquery to the DECLARED tenant, so the join looks redundant from
 *           inside every case where declared equals written. This is D4's own
 *           sentence arriving on the staff arm: *"THE NARROWEST AND THE MOST
 *           INSTRUCTIVE … A suite without that case would have shipped this
 *           mutation green."*
 *
 *   D14  delete the whole three-list `NOT EXISTS`
 *        → 4 reds including `statutory is refused AT ANY PRICE` and the G75
 *           widening test.
 *
 *   D16  delete ONLY the `non_delegable_resource` term
 *   D17  delete ONLY the `contract_only_resource` term
 *        → 🛑 **2 reds each, and BOTH tests were added because these two
 *           mutations first survived every behavioural assertion in the file.**
 *           `statutory` and `authority` are absent from `permitted_resource`
 *           too, so the THIRD term refuses them anyway and the first two look
 *           decorative. **That is G75's finding in reverse** — there, a
 *           first-position deny made a widening inert; here the deny itself is
 *           invisible until somebody widens. The witness is therefore the
 *           widening, which is what `G75 · widening permitted_resource does NOT
 *           make statutory reachable` performs.
 *
 *   D18  delete ONLY the `permitted_resource` term
 *        → 4 reds: `commercial` becomes reachable, and the agreement breaks.
 *
 *   D19  make the staff disjunct match nothing (`WHERE false`)
 *        → 32 reds, i.e. the whole suite. This is the state the tree was in
 *           before this slice, and `test_the_staff_path_is_unreachable_in_the_
 *           database_too_and_that_is_G199s_cost` was GREEN in it — which is
 *           what a declared cost looks like from the inside.
 *
 *   D15  seed `grant_duration_ceiling` with `('incident', 2160)` — one ceiling
 *        for both purposes, which is the shape somebody will propose
 *        → 3 reds: the mirror test (`MAX_GRANT_HOURS` disagrees), the
 *           per-purpose differential, and the agreement. **The mirror test is
 *           the one that makes the SQL copy a copy rather than a drift.**
 * ==================================================================== */

/* ------------------------------------------------------------------ *
 * Helpers used above.
 * ------------------------------------------------------------------ */

/** The scope-setting statement, which assertion (a) inspects from the other side. */
function isScopeStatement(text: string): boolean {
  return text.trim().toUpperCase().startsWith('SELECT SET_CONFIG(')
}

function pidOf(res: QueryResultLike): number {
  const row = res.rows[0] as { pid: number } | undefined
  assert.ok(row, 'pg_backend_pid() returned no row')
  return row.pid
}

/**
 * Attempt the tenant-binding write and report the failure, or `null` if it was
 * permitted. Returning rather than throwing is what lets a table-driven test
 * name the case that disagreed instead of dying on the first one.
 *
 * `declared` and `written` are separate parameters ON PURPOSE. They are the
 * same value on the honest path and different on the attack path, and a helper
 * that took one would make the second narrowing untestable.
 */
async function attemptSelection(
  pool: TenantPool,
  handleDigest: string,
  declared: TenantId,
  written: TenantId,
): Promise<PgFailure | null> {
  try {
    await withSelectionScope(pool, handleDigest, declared, async (tx) => {
      await tx.query(SELECTION_WRITE, [written])
    })
    return null
  } catch (err) {
    return failureOf(err)
  }
}
