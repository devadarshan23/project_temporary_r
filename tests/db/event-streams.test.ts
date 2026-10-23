/**
 * INVARIANT 10's THREE EVENT STREAMS, AND THE COLUMN THAT REFUSES A NULL —
 * **G317, 19 Sep 2026**, over `db/migrations/0014_invariant_10_event_streams.sql`,
 * **and G387 the same day**, over `db/migrations/0017_usage_record_actor.sql`.
 *
 * ✅ **THE RULE IS NOW ON ALL THREE STREAMS AND THIS FILE IS WHERE THAT
 * CHANGED.** `ACTOR_STREAMS` was two entries and is three; §5a's TRIPWIRE
 * asserting that `usage_record` carried NO check constraint FIRED on `0017`
 * and was **replaced by the positive assertion, not deleted**, which is what
 * its own text demanded. ⚠️ **AND THE RULING IT APPLIES DID NOT DECLARE THE
 * PLANE BOUNDARY HARMLESS**: `UsageRecord` is the one record class that ships
 * to the control plane, so the actor it gained is a KIND and never an ID —
 * **§2g** is the control on that, and **§2h** is the control on the
 * three-valued-logic hole that makes the `NOT NULL` half of the constraint.
 *
 * `tests/db/authorisation-record.test.ts` is the shape this file copies and its
 * header is the one to read first: the `max: 1` adversarial pool, the migrator
 * for every fixture write, and the negative control that turns the policy off.
 * What that file is about is *"the row an ACT leaves behind"*. **This one is
 * about the three rows that NAME it.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT THIS FILE PROVES, AND WHAT IT DELIBERATELY DOES NOT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It proves properties of THREE TABLES and of the store that writes them: that
 * a row carrying a REAL authorisation id is accepted on each; that a null
 * reference is **refused by the database** for exactly the actor kinds
 * `AUTHORIZATION_MAY_BE_ABSENT` forbids it to and **accepted** for the one it
 * permits; that a row is visible to its own tenant and invisible to another;
 * that a cross-tenant write is refused by the `WITH CHECK`; and that the role a
 * request path runs as can neither amend nor erase any of them.
 *
 * **IT PROVES NOTHING ABOUT WHETHER ANY REQUEST WRITES ONE, BECAUSE NONE
 * DOES.** `server/data-plane/event-stream-store.ts` is called from this file
 * and from nowhere else, and its header says why: three of the streams' terms
 * have no producer, and `DataAccessEvent.maxDataClass` is the one that must not
 * be guessed. **`CLAUDE.md`'s sentence — *"a served read records THE
 * AUTHORISATION IT RAN UNDER and not THE ACCESS"* — is unchanged by this
 * commit**, and nothing here licenses amending it.
 *
 * ⚠️ THE ALLOW ARMS ARE NOT DECORATION. §5.6 — *a control that passes while
 * asserting nothing* — is this repository's most-committed defect and its
 * commonest form is a control whose only observable behaviour is refusal. Every
 * refusal below is paired with the write that must SUCCEED, and §2's two arms
 * are derived from the SAME model constant so neither can go vacuous while the
 * other passes.
 *
 * ⚠️ NEVER SKIPS UNDER CI. `databaseRequiredUnderCi()` at the top level.
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import {
  CAPABILITIES,
  DENY_ALL,
  ORG_CLASSES,
  authorize,
  type AuthorizationGrant,
  type PrincipalContext,
  type Role,
  type RoleAssignment,
} from '../../model/access.ts'
import {
  AUTHORIZATION_MAY_BE_ABSENT,
  authorizationIsWellFormed,
  type AuditActor,
  type DataAccessEvent,
} from '../../model/governance.ts'
import type { AuditEvent } from '../../model/domain.ts'
import type { UsageRecord } from '../../model/billing.ts'
import type {
  AuthorizationGrantId,
  DataPlaneId,
  ModelCatalogEntryId,
  PartnerId,
  TenantId,
  Timestamp,
  UserId,
} from '../../model/kernel.ts'
import {
  mintAuthorizationGrantId,
  writeAuthorisationRecord,
} from '../../server/data-plane/authorisation-record.ts'
import {
  writeAuditEvent,
  writeDataAccessEvent,
  writeUsageRecord,
} from '../../server/data-plane/event-stream-store.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE. Set before the first call that reads it — the named flake
 * `tests/db/tenant-projection.test.ts` documents at length.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_EVENT_STREAMS_DB_NAME'] ?? runScopedName('reconcile_event_streams_test')

const ACME = 'ten_acme' as TenantId
const GLOBEX = 'ten_globex' as TenantId
const MEI = 'usr_ops_mei' as UserId
const NOW = '2026-09-19T12:00:00.000Z' as Timestamp

const probe = await probeDatabase()
const skip = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the invariant 10 event streams test', probe)

/**
 * THE THREE TABLES THAT CARRY AN ACTOR DISCRIMINANT AND THEREFORE CARRY THE
 * `CHECK` — **all of them, since G387.**
 *
 * ⚠️ THIS READ `['audit_event', 'data_access_event']` AND WAS COMMENTED *"The
 * TWO tables that carry an `AuditActor` and therefore carry the `CHECK`"*
 * UNTIL 19 Sep 2026, AND IT IS CORRECTED RATHER THAN DELETED, because it is
 * the line that encoded G317's failed premise as a loop bound. `UsageRecord`
 * still does not carry an `AuditActor` — it carries `actorKind`, which is
 * `AuditActor['kind']` and nothing more — so the comment is narrowed as well
 * as the list widened: **what these three share is a DISCRIMINANT, not an
 * actor.** `db/migrations/0017_usage_record_actor.sql` argues the difference
 * at length and §2g below asserts it.
 */
const ACTOR_STREAMS = ['audit_event', 'data_access_event', 'usage_record'] as const
type ActorStream = (typeof ACTOR_STREAMS)[number]

/**
 * A principal `decide()` permits — lifted verbatim from
 * `tests/db/authorisation-record.test.ts`, including its warning.
 *
 * ⚠️ THE CASTS ARE NAMED, because a cast of shape is not a check of content.
 * What is NOT cast is the grant this produces: that comes back from
 * `authorize()` fully typed, which is the point — *"`authorize()` mints an
 * `AuthorizationGrant` and nothing else does"*, and a fixture that assembled
 * one literally would be a second minting path living in `tests/`.
 */
function principal(tenantId: TenantId): PrincipalContext {
  const role = {
    tenantId,
    id: 'rol_ap_approver',
    label: 'AP Approver',
    key: 'approver',
    version: 3,
    stakeholderClass: 'operator',
    origin: 'pack',
    packId: 'pck_ap',
    capabilities: [CAPABILITIES.admitSource],
    defaultScope: DENY_ALL,
    status: 'active',
  } as unknown as Role

  const assignment = {
    tenantId,
    id: 'ras_mei_approver',
    userId: MEI,
    roleId: 'rol_ap_approver',
    roleVersion: 3,
    scope: DENY_ALL,
    grantedBy: 'usr_acme_admin',
    grantedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: null,
    revokedAt: null,
  } as unknown as RoleAssignment

  return {
    subject: { userId: MEI, status: 'active' },
    tenantId,
    orgClass: ORG_CLASSES.customer,
    partnerId: null,
    partnerGrant: null,
    held: [{ role, assignment }],
    platformHeld: null,
    now: NOW,
  }
}

/** One minted grant, or a hard failure naming the refusal. */
function mint(tenantId: TenantId): AuthorizationGrant {
  const out = authorize(principal(tenantId), CAPABILITIES.admitSource, {
    id: mintAuthorizationGrantId(),
    resource: {
      resourceClass: 'tenant_data',
      resourceType: 'Run',
      resourceId: 'run_1',
      solutionId: null,
    },
    ttlSeconds: 300,
  })
  assert.ok(
    out.grant !== null,
    `\`authorize()\` refused the fixture principal — \`${out.decision.reason}\`. Every ` +
      'assertion below is about a row that names a grant that was never minted, so none of ' +
      'them mean anything until this is green.',
  )
  /**
   * 🛑 THE HOME, ASSERTED RATHER THAN CAST — G730, 19 Sep 2026. `authorize()`
   * now returns a union: a tenant-less principal mints a
   * `PlatformAuthorizationGrant` whose record lives in
   * `tenant.platform_authorization_grant` under a session-keyed policy. This
   * fixture's principal HAS a tenant, so the tenant home is the only correct
   * answer — and narrowing here rather than casting is what makes a fixture
   * that quietly lost its tenant a RED test instead of a write into the wrong
   * table.
   */
  assert.equal(
    out.grant.home,
    'tenant',
    'the fixture principal minted a PLATFORM grant. Every assertion below reads ' +
      '`tenant.authorization_grant`, so all of them would be asking about a table this ' +
      'act never touched.',
  )
  return out.grant
}

/**
 * ONE FIXTURE ACTOR PER KIND, AND THE `Record` IS TOTAL ON PURPOSE.
 *
 * `Record<AuditActor['kind'], AuditActor>` is the same discipline
 * `AUTHORIZATION_MAY_BE_ABSENT` takes: **a sixth actor variant is a compile
 * error here too**, so the day somebody adds one, this file demands a fixture
 * for it rather than quietly testing four of five.
 */
const ACTORS: Record<AuditActor['kind'], AuditActor> = {
  user: { kind: 'user', userId: MEI, orgClass: ORG_CLASSES.customer, assignmentId: 'ras_1' },
  partner_staff: {
    kind: 'partner_staff',
    userId: 'usr_partner_dana' as UserId,
    partnerId: 'prt_northwind' as PartnerId,
    grantId: 'pag_1',
  },
  platform_staff: {
    kind: 'platform_staff',
    userId: 'usr_fde_sam' as UserId,
    supportGrantId: 'tag_1',
    supportAuthorisationId: null,
  },
  system: { kind: 'system', component: 'retention_sweep' },
  agent: {
    kind: 'agent',
    stepId: 'stp_extract',
    stepExecutionId: 'sxe_1',
    modelId: 'mce_sonnet' as ModelCatalogEntryId,
    onBehalfOf: { kind: 'user', userId: MEI, assignmentId: 'ras_1' },
  },
}

let seq = 0
/** A fresh chain link. See the note in §1 on what this file does NOT claim. */
function chain(): { sequence: number; previousHash: string | null; bodyHash: string } {
  seq += 1
  return {
    sequence: seq,
    previousHash: seq === 1 ? null : `hash_${seq - 1}`,
    bodyHash: `hash_${seq}`,
  }
}

function auditEvent(
  tenantId: TenantId,
  id: string,
  actor: AuditActor,
  authorizationId: AuthorizationGrantId | null,
): AuditEvent {
  return {
    tenantId,
    id,
    chain: chain(),
    actor,
    authorizationId,
    action: 'exception.resolved',
    subjectType: 'Exception',
    subjectId: 'exc_1',
    before: { status: 'open' },
    after: { status: 'resolved' },
    at: NOW,
  }
}

function dataAccessEvent(
  tenantId: TenantId,
  id: string,
  actor: AuditActor,
  authorizationId: AuthorizationGrantId | null,
): DataAccessEvent {
  return {
    tenantId,
    id,
    chain: chain(),
    actor,
    authorizationId,
    at: NOW,
    subjectType: 'SourceDocument',
    subjectId: 'doc_1',
    /**
     * ⚠️ A FIXTURE VALUE, AND THE ONE FIELD IN THIS FILE THAT NOTHING IN THE
     * REPOSITORY CAN PRODUCE. `DataAccessEvent.maxDataClass` is *"Highest
     * classification actually returned"* and nothing computes one — which is
     * precisely why no handler writes this stream. A fixture may state a class
     * because a fixture is not claiming a read happened; a HANDLER stamping a
     * guessed class into an append-only stream would be writing a false fact
     * beyond amendment, which is G106's *"scope failing OPEN"* with a hash
     * chain around it.
     */
    maxDataClass: 'personal',
  }
}

let usageSeq = 0
/**
 * ⚠️ IT TAKES A WHOLE `AuditActor` AND STORES ONLY ITS `kind`, AND THE
 * NARROWING IS THE FIXTURE'S POINT RATHER THAN ITS CONVENIENCE — G387.
 *
 * The signature matches `auditEvent()` and `dataAccessEvent()` exactly so §2
 * can drive all three streams from one loop with one actor; what differs is
 * what SURVIVES the call. `UsageRecord` gains the KIND and nothing else,
 * because *"an actor KIND is a closed vocabulary and is not a person; an actor
 * id would be tenant data on a control-plane wire"* — and `usage_record` is
 * the one stream whose record class ships. `§2g` asserts that narrowing at the
 * table rather than leaving it to this comment.
 */
function usageRecord(
  tenantId: TenantId,
  id: string,
  actor: AuditActor,
  authorizationId: AuthorizationGrantId | null,
): UsageRecord {
  usageSeq += 1
  return {
    id,
    tenantId,
    dataPlaneId: 'dpl_sg_1' as DataPlaneId,
    idempotencyKey: `idem_${id}`,
    at: NOW,
    recordedAt: NOW,
    sequence: usageSeq,
    shippedAt: null,
    meter: 'documents_processed',
    quantity: 3,
    actorKind: actor.kind,
    authorizationId,
    runId: null,
    domain: 'finance',
    packId: null,
    costCenter: 'CC-1100',
    tagsLockedAt: null,
    model: null,
  }
}

/**
 * ONE WRITE PER STREAM, KEYED BY STREAM, SO §2 IS ONE LOOP OVER THREE TABLES
 * RATHER THAN A TERNARY OVER TWO — G387's *"one rule, three tables, no special
 * case"*, expressed in the test that enforces it.
 *
 * ⚠️ THIS REPLACED A `stream === 'audit_event' ? … : …` TERNARY, and the
 * replacement is not tidiness. A ternary is total over TWO by accident: adding
 * `usage_record` to `ACTOR_STREAMS` and forgetting it here would have silently
 * routed the meter stream's cases through `writeDataAccessEvent`, so every
 * assertion would have passed while testing the wrong table. A total
 * `Record<ActorStream, …>` makes a fourth stream `TS2741` and a stream with no
 * writer impossible — `CAPABILITY_RESOURCE_CLASS`'s discipline, applied to a
 * fixture.
 */
type StreamWrite = (
  tx: Parameters<typeof writeAuditEvent>[0],
  tenantId: TenantId,
  id: string,
  actor: AuditActor,
  authorizationId: AuthorizationGrantId | null,
) => Promise<void>

const WRITE_TO: Record<ActorStream, StreamWrite> = {
  audit_event: (tx, tenantId, id, actor, grantId) =>
    writeAuditEvent(tx, auditEvent(tenantId, id, actor, grantId)),
  data_access_event: (tx, tenantId, id, actor, grantId) =>
    writeDataAccessEvent(tx, dataAccessEvent(tenantId, id, actor, grantId)),
  usage_record: (tx, tenantId, id, actor, grantId) =>
    writeUsageRecord(tx, usageRecord(tenantId, id, actor, grantId)),
}

async function countIn(pool: TenantPool, tenantId: TenantId, table: string): Promise<number> {
  return withTenantScope(pool, tenantId, async (tx) => {
    const out = await tx.query(`SELECT count(*)::int AS n FROM tenant.${table}`)
    return (out.rows[0] as { n: number }).n
  })
}

describe('invariant 10\'s three event streams', { skip }, () => {
  let pool: TenantPool
  let acmeGrant: AuthorizationGrant
  let globexGrant: AuthorizationGrant

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    /**
     * ⚠️ `max: 1` IS ADVERSARIAL ON PURPOSE, exactly as in
     * `tests/db/tenant-isolation.test.ts`: every scope below is forced onto the
     * connection the previous one released, which is the condition under which
     * a session-level `SET` would leak between them.
     */
    pool = await createAppPool(1)

    acmeGrant = mint(ACME)
    globexGrant = mint(GLOBEX)

    /* 🛑 THE GRANTS ARE WRITTEN AS THE APP ROLE THROUGH THE REAL SEAM, so the
     * authorisation ids every row below carries are ids of rows that EXIST.
     * A fixture that invented an id would make §1's "matches a real grant"
     * assertion a statement about a string. */
    await withTenantScope(pool, ACME, (tx) => writeAuthorisationRecord(tx, acmeGrant))
    await withTenantScope(pool, GLOBEX, (tx) => writeAuthorisationRecord(tx, globexGrant))
  })

  after(async () => {
    if (pool !== undefined) await pool.end()
  })

  /* ================================================================ *
   * §1 · THE ALLOW ARM. Each stream accepts a row naming a REAL grant.
   * ================================================================ */

  describe('§1 · each stream accepts a row carrying a real authorisation id', () => {
    it('1a · `audit_event` — and the id resolves to a row in `authorization_grant`', async () => {
      await withTenantScope(pool, ACME, (tx) =>
        writeAuditEvent(tx, auditEvent(ACME, 'aud_1', ACTORS.user, acmeGrant.id)),
      )

      const row = await withTenantScope(pool, ACME, async (tx) => {
        const out = await tx.query(
          `SELECT e.authorization_id, e.actor_kind, e.actor_user_id, e.actor_org_class,
                  e.action, e.subject_type, e.subject_id, e.before_image, e.after_image,
                  e.chain_sequence, e.chain_previous_hash, e.chain_body_hash,
                  g.id AS grant_id, g.capability
             FROM tenant.audit_event e
             LEFT JOIN tenant.authorization_grant g
               ON g.tenant_id = e.tenant_id AND g.id = e.authorization_id
            WHERE e.id = 'aud_1'`,
        )
        return out.rows[0] as Record<string, unknown>
      })

      assert.equal(row['authorization_id'], acmeGrant.id)
      assert.equal(
        row['grant_id'],
        acmeGrant.id,
        'THE SPINE DOES NOT JOIN. The authorisation id on this event resolves to no row in ' +
          '`tenant.authorization_grant` — so "who / what / cost is ONE query" is a query that ' +
          'returns nothing, which is the state `AuthorizationGrant.via` describes as the ' +
          'whole defect: "`Decision.via` named the authority and joined to nothing".',
      )
      assert.equal(row['capability'], CAPABILITIES.admitSource)
      assert.equal(row['actor_kind'], 'user')
      assert.equal(row['actor_user_id'], MEI)
      assert.equal(row['actor_org_class'], ORG_CLASSES.customer)
      assert.equal(row['action'], 'exception.resolved')
      assert.deepEqual(row['before_image'], { status: 'open' })
      assert.deepEqual(row['after_image'], { status: 'resolved' })
      assert.equal(
        row['chain_previous_hash'],
        null,
        '`RecordChain.previousHash` is "Null only at sequence 1", and a null must round-trip ' +
          'as a null — a sentinel would be a value the verifier has to know about, and a ' +
          'chain whose head is indistinguishable from a link can be re-rooted.',
      )
      assert.equal(typeof row['chain_body_hash'], 'string')
    })

    it('1b · `data_access_event` — the read stream, same spine', async () => {
      await withTenantScope(pool, ACME, (tx) =>
        writeDataAccessEvent(tx, dataAccessEvent(ACME, 'dae_1', ACTORS.user, acmeGrant.id)),
      )
      const row = await withTenantScope(pool, ACME, async (tx) => {
        const out = await tx.query(
          `SELECT e.authorization_id, e.max_data_class, g.id AS grant_id
             FROM tenant.data_access_event e
             LEFT JOIN tenant.authorization_grant g
               ON g.tenant_id = e.tenant_id AND g.id = e.authorization_id
            WHERE e.id = 'dae_1'`,
        )
        return out.rows[0] as Record<string, unknown>
      })
      assert.equal(row['grant_id'], acmeGrant.id, 'the read stream does not join to its grant')
      assert.equal(row['max_data_class'], 'personal')
    })

    it('1c · `usage_record` — the meter stream, same spine and NO PRICE', async () => {
      await withTenantScope(pool, ACME, (tx) =>
        writeUsageRecord(tx, usageRecord(ACME, 'usg_1', ACTORS.user, acmeGrant.id)),
      )
      const row = await withTenantScope(pool, ACME, async (tx) => {
        const out = await tx.query(
          `SELECT r.authorization_id, r.meter, r.quantity, r.cost_center, g.id AS grant_id
             FROM tenant.usage_record r
             LEFT JOIN tenant.authorization_grant g
               ON g.tenant_id = r.tenant_id AND g.id = r.authorization_id
            WHERE r.id = 'usg_1'`,
        )
        return out.rows[0] as Record<string, unknown>
      })
      assert.equal(row['grant_id'], acmeGrant.id, 'the meter stream does not join to its grant')
      assert.equal(row['meter'], 'documents_processed')
      assert.equal(
        String(row['quantity']),
        '3',
        '`quantity` must round-trip EXACTLY. It is `numeric` and not a float because this is ' +
          'the billing spine and "at-least-once delivery otherwise double-counts tokens into ' +
          'an append-only table that has no compensating instrument".',
      )
      assert.equal(row['cost_center'], 'CC-1100')
    })

    it('1d · INVARIANT 5 — `usage_record` carries no price column at all', async () => {
      /**
       * 🛑 *"Money is always derived. `UsageRecord` is immutable and unpriced —
       * which is why `metering` is its own resource class: it has no write mode,
       * and it cannot live in `commercial`, whose defining rule is that a
       * partner may read it. A raw usage record is volume in the clear."*
       *
       * A column-name assertion rather than a review note, because `MeterPrice`
       * and `PriceTier` are both `@dropped-for-v1` and a rating column here
       * would un-drop them in SQL where no `@dropped-for-v1` marker reaches.
       *
       * 🛑 `rate` WAS MISSING FROM THIS PATTERN UNTIL 19 Sep 2026 AND IT IS ONE
       *    OF THE FOUR WORDS THE INVARIANT'S OWN SURFACE NAMES — *"no price,
       *    rate, currency or total column"*. Three of the four were covered and
       *    the fourth was not, so the control was reporting success at
       *    something narrower than its own name claimed, which is §5.6 inside a
       *    test written to prevent it.
       *
       *    WITNESSED, not reasoned: `ALTER TABLE tenant.usage_record ADD COLUMN
       *    rate_basis_points integer` appended to
       *    `db/migrations/0017_usage_record_actor.sql` — the LAST writer of this
       *    table's columns — and this assertion PASSED. A rate is exactly how
       *    volume becomes money, so a rating column under that name would have
       *    walked through the one control standing between a usage record and a
       *    priced one.
       *
       *    ⚠️ THE PATTERN TRACKS THE INVARIANT'S FOUR WORDS AND IS NOT A GUESS
       *    AT WHAT A FUTURE SLICE MIGHT CALL A COLUMN. `spend`, `billed`,
       *    `charge` and `tariff` are deliberately ABSENT: widening to names
       *    nobody has proposed is a rule keyed on a convenient landmark instead
       *    of the property it protects, and it would make the next false
       *    positive somebody's excuse to narrow the whole pattern. A C8 "watch
       *    spend" surface is where this will next be tested —
       *    `tests/contracts/customer-surface-reach.test.mjs` §4 carries the
       *    other half of that argument, and every figure such a surface
       *    publishes must be DERIVED at read time from `quantity`.
       */
      const mig = await migratorClient()
      try {
        const out = await mig.query(
          `SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'tenant' AND table_name = 'usage_record'`,
        )
        const priced = (out.rows as Array<{ column_name: string }>)
          .map((r) => r.column_name)
          .filter((c) => /price|rate|amount|minor|currency|cost_minor|revenue|total/.test(c))
        assert.deepEqual(
          priced,
          [],
          `\`tenant.usage_record\` has grown a priced column (${priced.join(', ')}). Invariant ` +
            '5 is that money is DERIVED and that this record is "immutable and unpriced"; a ' +
            'rating column here makes a raw usage record into a commercial one, which is ' +
            'exactly why `metering` is a separate resource class a partner cannot read.',
        )
      } finally {
        await mig.end()
      }
    })
  })

  /* ================================================================ *
   * §2 · THE NULL RULE, AT THE COLUMN, DRIVEN BY THE MODEL CONSTANT.
   * ================================================================ */

  describe('§2 · `AUTHORIZATION_MAY_BE_ABSENT`, enforced by the DATABASE', () => {
    /**
     * 🛑 BOTH ARMS COME FROM ONE CONSTANT, WHICH IS WHAT STOPS EITHER GOING
     * VACUOUS. The permitted set and the refused set below are partitions of
     * `AUTHORIZATION_MAY_BE_ABSENT` itself, so a sixth actor kind, or a
     * decision to widen the table, changes BOTH lists at once and cannot leave
     * one of them silently empty.
     *
     * This is `0008_staff_grant_selection.sql`'s answer to the same problem —
     * a policy expression cannot import a TypeScript constant, so the mirror is
     * defended by a test asserting set equality in BOTH directions. The `CHECK`
     * in `0014` names one value, `'system'`; these two tests are what require
     * that value to be the right one, from the model's side.
     */
    const permitted = (Object.keys(AUTHORIZATION_MAY_BE_ABSENT) as Array<AuditActor['kind']>)
      .filter((k) => AUTHORIZATION_MAY_BE_ABSENT[k])
    const forbidden = (Object.keys(AUTHORIZATION_MAY_BE_ABSENT) as Array<AuditActor['kind']>)
      .filter((k) => !AUTHORIZATION_MAY_BE_ABSENT[k])

    it('2a · ANTI-VACUOUS — the model admits some kinds and forbids others', () => {
      assert.ok(
        permitted.length > 0 && forbidden.length > 0,
        `the table partitions into ${permitted.length} permitted and ${forbidden.length} ` +
          'forbidden kinds. If either side is empty, one of the two tests below asserts ' +
          'nothing at all while still passing.',
      )
    })

    for (const stream of ACTOR_STREAMS) {
      it(`2b · ${stream} — a NON-permitted actor with a NULL reference is REFUSED by the database`, async () => {
        /**
         * 🛑 ONE AT A TIME, FOR `tests/http/authorisation-record.test.ts` §1b's
         * REASON: a single assertion over the whole set would pass if the
         * constraint ignored `actor_kind` and refused every null. Each kind is
         * asked separately, and `agent` is the one worth naming — it LOOKS like
         * machinery and is not. *"An agent read with no authorisation is the
         * exact gap §3 closed — a bounded capability quietly acting
         * unbounded."*
         */
        for (const kind of forbidden) {
          const actor = ACTORS[kind]
          assert.equal(
            authorizationIsWellFormed(actor, null),
            false,
            `the model now permits \`${kind}\` to act with no authorisation; this test is ` +
              'reading a different rule from the one it asserts below.',
          )
          await assert.rejects(
            () =>
              withTenantScope(pool, ACME, (tx) =>
                WRITE_TO[stream](tx, ACME, `null_${stream}_${kind}`, actor, null),
              ),
            (err: unknown) =>
              /violates check constraint|authorisation_present/i.test(String(err)),
            `THE DATABASE ACCEPTED A \`${kind}\` ROW ON \`${stream}\` WITH NO AUTHORISATION ` +
              'REFERENCE. G317 rules that `AUTHORIZATION_MAY_BE_ABSENT` is "ENFORCED AT THE ' +
              'COLUMN, NOT IN REVIEW", because "a nullable column with a review convention ' +
              'behind it is §5.6 wearing a schema". Invariant 10 is that an act with no ' +
              'authorisation is UNRECORDABLE — a stream that records one has made the ' +
              'invariant a sentence.',
          )
        }
      })

      it(`2c · ${stream} — the ALLOW arm: a permitted actor with a NULL reference IS accepted`, async () => {
        /**
         * 🛑 WITHOUT THIS, §2b IS SATISFIED BY A COLUMN THAT IS SIMPLY
         * `NOT NULL`, and the whole rule collapses into "always required" —
         * which is a DIFFERENT rule and a wrong one. *"`system` is genuine
         * machinery … inventing a service principal to satisfy the column would
         * be worse than the null: it would put machine work in the same table
         * shape as human work and make 'acts with no human behind them'
         * unqueryable."*
         */
        for (const kind of permitted) {
          const actor = ACTORS[kind]
          const id = `sys_${stream}_${kind}`
          await withTenantScope(pool, ACME, (tx) => WRITE_TO[stream](tx, ACME, id, actor, null))
          const stored = await withTenantScope(pool, ACME, async (tx) => {
            /* ⚠️ `actor_kind` AND `authorization_id` ONLY, because they are the
             * only two columns all three streams share on this rule.
             * `actor_component` is one of `audit_event`'s seventeen actor
             * columns and `usage_record` deliberately has none of them — §2g. */
            const out = await tx.query(
              `SELECT actor_kind, authorization_id FROM tenant.${stream} WHERE id = $1`,
              [id],
            )
            return out.rows[0] as Record<string, unknown>
          })
          assert.equal(stored['actor_kind'], kind)
          assert.equal(
            stored['authorization_id'],
            null,
            `a \`${kind}\` row was accepted and its null reference did not survive the ` +
              'round-trip. The null IS the record: it means no capability was evaluated ' +
              'because there was no principal to evaluate one against.',
          )
        }
      })

      it(`2d · ${stream} — a permitted actor that DOES carry a reference is also accepted`, async () => {
        /* `authorizationIsWellFormed()`'s own case: *"The table says WHEN a null
         * is permitted, never when a reference is forbidden."* Without this, a
         * constraint reading `actor_kind = 'system' = (authorization_id IS
         * NULL)` would satisfy §2b and §2c and be wrong. */
        for (const kind of permitted) {
          const id = `sysid_${stream}_${kind}`
          await withTenantScope(pool, ACME, (tx) =>
            WRITE_TO[stream](tx, ACME, id, ACTORS[kind], acmeGrant.id),
          )
        }
      })

      it(`2e · ${stream} — every NON-permitted actor kind IS accepted when it carries one`, async () => {
        /* The other half of §2b, and the one that stops the constraint being
         * "refuse this actor kind" rather than "refuse this actor kind's
         * null". Four writes that must all succeed. */
        for (const kind of forbidden) {
          const id = `ok_${stream}_${kind}`
          await withTenantScope(pool, ACME, (tx) =>
            WRITE_TO[stream](tx, ACME, id, ACTORS[kind], acmeGrant.id),
          )
        }
        const n = await countIn(pool, ACME, stream)
        assert.ok(n > forbidden.length, `only ${n} row(s) on ${stream}; the writes did not land`)
      })
    }

    it('2f · the flattened agent arm round-trips, including `onBehalfOf`', async () => {
      /* 🛑 THE ARM WITH THE MOST TO LOSE. `AuditActor.agent` carries
       * `onBehalfOf` INLINE precisely so the delegator is reachable — *"a row
       * must reach its authority without traversing a mutable table"* — and a
       * store that flattened the outer union and dropped the inner one would
       * record an agent act with no human behind it, which is the asymmetry
       * §8.3 added the field to close. */
      await withTenantScope(pool, ACME, (tx) =>
        writeAuditEvent(tx, auditEvent(ACME, 'aud_agent', ACTORS.agent, acmeGrant.id)),
      )
      const row = await withTenantScope(pool, ACME, async (tx) => {
        const out = await tx.query(
          `SELECT actor_kind, actor_step_id, actor_step_execution_id, actor_model_id,
                  actor_on_behalf_of_kind, actor_on_behalf_of_user_id,
                  actor_on_behalf_of_assignment_id, actor_on_behalf_of_policy_id,
                  actor_user_id
             FROM tenant.audit_event WHERE id = 'aud_agent'`,
        )
        return out.rows[0] as Record<string, unknown>
      })
      assert.equal(row['actor_kind'], 'agent')
      assert.equal(row['actor_step_id'], 'stp_extract')
      assert.equal(row['actor_model_id'], 'mce_sonnet')
      assert.equal(row['actor_on_behalf_of_kind'], 'user')
      assert.equal(row['actor_on_behalf_of_user_id'], MEI)
      assert.equal(row['actor_on_behalf_of_assignment_id'], 'ras_1')
      assert.equal(row['actor_on_behalf_of_policy_id'], null)
      assert.equal(
        row['actor_user_id'],
        null,
        'the agent arm carries NO `userId` and a null here is a VALUE rather than an absence. ' +
          'An agent reaches a person through `onBehalfOf` and never directly; filling ' +
          '`actor_user_id` from the delegator would make an agent act indistinguishable from ' +
          'the human\'s own.',
      )
    })

    it('2g · INVARIANT 3 — `usage_record` carries EXACTLY ONE actor column, and it is the kind', async () => {
      /**
       * 🛑 THE CONTROL G387's EDGE NEEDS, AND IT IS THE §1d SHAPE AIMED AT A
       * DIFFERENT INVARIANT. §1d fails on a column whose name looks like
       * money; this fails on a column that looks like a PERSON.
       *
       * *"The control plane publishes downward and never reads tenant data."*
       * `UsageRecord` is the one record class that ships to it, and the
       * ruling that gave this table an actor gave it **the KIND and nothing
       * else**: *"an actor KIND is a closed vocabulary and is not a person;
       * an actor id would be tenant data on a control-plane wire, and is a
       * different decision that this ruling does not take."*
       *
       * `audit_event` and `data_access_event` each carry SEVENTEEN actor
       * columns — `actor_user_id`, `actor_partner_id`, `actor_grant_id`, the
       * agent's `on_behalf_of` block — and every one of them names a
       * principal. This assertion is what makes adding a second one here a
       * RED TEST and a ruling, in the same way §5a made adding the
       * constraint one. **Do not widen this list to go green.**
       */
      const mig = await migratorClient()
      try {
        const actorColumns = async (table: string): Promise<string[]> => {
          const out = await mig.query(
            `SELECT column_name FROM information_schema.columns
              WHERE table_schema = 'tenant' AND table_name = $1
                AND column_name LIKE 'actor\\_%'
              ORDER BY column_name`,
            [table],
          )
          return (out.rows as Array<{ column_name: string }>).map((r) => r.column_name)
        }

        assert.deepEqual(
          await actorColumns('usage_record'),
          ['actor_kind'],
          'the meter stream has grown an actor column beyond the kind. `UsageRecord` is the ' +
            'one record class that SHIPS TO THE CONTROL PLANE and is safe to ship because it ' +
            'is "PII-free BY CONSTRUCTION"; a principal identifier here is the thing the ' +
            'declaration refused a `UserId` for — it "would cross the plane boundary on every ' +
            'metered event and break invariant 3". G387 added the KIND and withheld the ID.',
        )

        /* 🛑 ANTI-VACUOUS, and it is not decoration. Without it this test
         * passes just as well against a schema where NOTHING carries an actor
         * — including a `usage_record` whose `actor_kind` was never added and
         * a `LIKE` pattern that matches nothing. The two event streams are
         * what prove the query can see actor columns at all. */
        const audit = await actorColumns('audit_event')
        assert.ok(
          audit.length > 1 && audit.includes('actor_kind'),
          `\`audit_event\` reports ${audit.length} actor column(s). This query cannot see ` +
            'actor columns, so the assertion above is about nothing.',
        )
        assert.deepEqual(
          audit,
          await actorColumns('data_access_event'),
          'the two event streams no longer carry an identical actor block. `0014` states them ' +
            'identically on purpose — "the two streams answer \'who read this and who changed ' +
            'it\' together, and a divergence between them is what would break that join".',
        )
      } finally {
        await mig.end()
      }
    })

    it('2h · `actor_kind` is NOT NULL on all three, and THAT is what makes the CHECK bite', async () => {
      /**
       * 🛑 A THREE-VALUED-LOGIC HOLE, WITNESSED RATHER THAN REASONED ABOUT,
       * AND IT IS THE REASON `NOT NULL` IS LOAD-BEARING RATHER THAN TIDY.
       *
       * `CHECK (authorization_id IS NOT NULL OR actor_kind = 'system')` with
       * BOTH columns null evaluates to `false OR NULL` — which is `NULL`, and
       * **PostgreSQL treats a `CHECK` that evaluates to NULL as SATISFIED.**
       * So a nullable `actor_kind` would let exactly the row invariant 10
       * forbids — an act with no authorisation and no actor — through the
       * constraint that exists to refuse it, silently, with the constraint
       * still sitting on the table looking like a control. §5.6 in
       * three-valued logic.
       *
       * The column is `NOT NULL` on all three tables, so the row is refused —
       * by the `NOT NULL` rather than by the `CHECK`, which is the point:
       * **the two are one control and neither is sufficient alone.** This is
       * driven through raw SQL as the app role because the store cannot
       * produce it: `UsageRecord.actorKind` is `AuditActor['kind']` and
       * TypeScript has no null to offer.
       *
       * 🛑 EVERY OTHER `NOT NULL` COLUMN IS SUPPLIED, AND THE MATCHER NAMES
       * `actor_kind`, AND BOTH OF THOSE WERE LEARNED BY MUTATION RATHER THAN
       * BY DESIGN. The first version of this test inserted four columns and
       * matched `/not-null/i`. **It passed with the `NOT NULL` DELETED** —
       * because the row died on `data_plane_id` instead and PostgreSQL's
       * message for that also says *"violates not-null constraint"*. That is
       * §5.6 exactly: a control that passes while asserting nothing about the
       * thing it names. The mutation is recorded here so the next person who
       * shortens this insert knows what it costs.
       */
      const ROW: Record<ActorStream, { columns: string; values: string }> = {
        audit_event: {
          columns:
            'tenant_id, id, chain_sequence, chain_body_hash, actor_kind, ' +
            'authorization_id, action, subject_type, subject_id, at',
          values: `$1, $2, 900001, 'h', NULL, NULL, 'a', 'Exception', 'exc_n', now()`,
        },
        data_access_event: {
          columns:
            'tenant_id, id, chain_sequence, chain_body_hash, actor_kind, ' +
            'authorization_id, at, subject_type, subject_id, max_data_class',
          values: `$1, $2, 900001, 'h', NULL, NULL, now(), 'SourceDocument', 'doc_n', 'personal'`,
        },
        usage_record: {
          columns:
            'tenant_id, id, data_plane_id, idempotency_key, at, recorded_at, sequence, ' +
            'meter, quantity, actor_kind, authorization_id',
          values:
            `$1, $2, 'dpl_sg_1', 'idem_nullkind', now(), now(), 900001, ` +
            `'documents_processed', 1, NULL, NULL`,
        },
      }

      for (const stream of ACTOR_STREAMS) {
        const row = ROW[stream]
        await assert.rejects(
          () =>
            withTenantScope(pool, ACME, (tx) =>
              tx.query(
                `INSERT INTO tenant.${stream} (${row.columns}) VALUES (${row.values})`,
                [ACME, `nullkind_${stream}`],
              ),
            ),
          (err: unknown) => /null value in column "actor_kind"/i.test(String(err)),
          `\`tenant.${stream}\` ACCEPTED a row with a NULL \`actor_kind\` and a NULL ` +
            'authorisation reference, or refused it for a reason that is NOT the ' +
            '`actor_kind` not-null. If that column were nullable, `false OR NULL` is NULL ' +
            'and a CHECK that evaluates to NULL PASSES — so the constraint would sit on ' +
            'the table asserting nothing about exactly the row invariant 10 exists to ' +
            'make unrecordable.',
        )
      }
    })
  })

  /* ================================================================ *
   * §3 · THE SCOPE.
   * ================================================================ */

  describe('§3 · row-level security, on all three', () => {
    before(async () => {
      await withTenantScope(pool, GLOBEX, async (tx) => {
        await writeAuditEvent(tx, auditEvent(GLOBEX, 'g_aud', ACTORS.user, globexGrant.id))
        await writeDataAccessEvent(
          tx,
          dataAccessEvent(GLOBEX, 'g_dae', ACTORS.user, globexGrant.id),
        )
        await writeUsageRecord(tx, usageRecord(GLOBEX, 'g_usg', ACTORS.user, globexGrant.id))
      })
    })

    for (const table of ['audit_event', 'data_access_event', 'usage_record'] as const) {
      it(`3a · ${table} — ACME cannot see GLOBEX's rows`, async () => {
        const ids = await withTenantScope(pool, ACME, async (tx) => {
          const out = await tx.query(
            `SELECT id FROM tenant.${table} WHERE id LIKE 'g\\_%'`,
          )
          return (out.rows as Array<{ id: string }>).map((r) => r.id)
        })
        assert.deepEqual(
          ids,
          [],
          `ACME read GLOBEX's rows on \`${table}\`. An audit trail that crosses the tenant ` +
            'boundary is not an audit trail; it is a disclosure.',
        )
      })

      it(`3b · ${table} — NEGATIVE CONTROL: with RLS DISABLED the same read LEAKS`, async () => {
        /**
         * 🛑 WITHOUT THIS, §3a PROVES NOTHING. A read that returns no other
         * tenant's rows is indistinguishable from a read that would have
         * returned none anyway, and only turning the policy off can tell them
         * apart. `tests/db/tenant-isolation.test.ts` carries the same control
         * for the same reason and `0014` cites this assertion by name.
         */
        const mig = await migratorClient()
        try {
          await mig.query(`ALTER TABLE tenant.${table} DISABLE ROW LEVEL SECURITY`)
          const leaked = await withTenantScope(pool, ACME, async (tx) => {
            const out = await tx.query(
              `SELECT DISTINCT tenant_id FROM tenant.${table} ORDER BY tenant_id`,
            )
            return (out.rows as Array<{ tenant_id: string }>).map((r) => r.tenant_id)
          })
          assert.deepEqual(
            leaked,
            [ACME, GLOBEX].sort(),
            `with row-level security DISABLED on \`${table}\` the read did NOT leak both ` +
              'tenants — so §3a\'s single-tenant result was never evidence about the policy.',
          )
        } finally {
          await mig
            .query(`ALTER TABLE tenant.${table} ENABLE ROW LEVEL SECURITY`)
            .catch(() => undefined)
          await mig.end()
        }
        /* And back to narrowing in the same test, so a failure above cannot
         * leave a disabled policy behind for everything that runs after it. */
        const after = await withTenantScope(pool, ACME, async (tx) => {
          const out = await tx.query(`SELECT DISTINCT tenant_id FROM tenant.${table}`)
          return (out.rows as Array<{ tenant_id: string }>).map((r) => r.tenant_id)
        })
        assert.deepEqual(after, [ACME])
      })

      it(`3c · ${table} — outside any scope the read returns ZERO (G100, deny on NULL)`, async () => {
        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          const out = await client.query(`SELECT id FROM tenant.${table}`)
          await client.query('COMMIT')
          assert.equal(
            out.rows.length,
            0,
            `an unscoped read returned ${out.rows.length} row(s) from \`${table}\`. G100's ` +
              'polarity is the thing standing between a forgotten transaction and a ' +
              'cross-tenant read of who did what.',
          )
        } finally {
          client.release()
        }
      })
    }

    it('3d · the `WITH CHECK` — a row whose tenant disagrees with the transaction is REFUSED', async () => {
      /**
       * 🛑 THIS IS THE ASSERTION THE POLICY EXISTS FOR AND IT IS THE ATTACK
       * `0010` NAMES ARRIVING ON THREE MORE TABLES: a writer that took the
       * tenant from the EVENT OBJECT rather than from the transaction's scope
       * would file one tenant's audit row under another — *"an audit trail that
       * reads as evidence and is not"*. Every assertion in §3a would still pass.
       */
      for (const write of [
        (tx: Parameters<typeof writeAuditEvent>[0]) =>
          writeAuditEvent(tx, auditEvent(GLOBEX, 'crossed_aud', ACTORS.user, globexGrant.id)),
        (tx: Parameters<typeof writeAuditEvent>[0]) =>
          writeDataAccessEvent(
            tx,
            dataAccessEvent(GLOBEX, 'crossed_dae', ACTORS.user, globexGrant.id),
          ),
        (tx: Parameters<typeof writeAuditEvent>[0]) =>
          writeUsageRecord(tx, usageRecord(GLOBEX, 'crossed_usg', ACTORS.user, globexGrant.id)),
      ]) {
        await assert.rejects(
          () => withTenantScope(pool, ACME, write),
          (err: unknown) => /row-level security|violates/i.test(String(err)),
          'A ROW FOR GLOBEX WAS WRITTEN INSIDE ACME\'S TRANSACTION. `0009` requires the ' +
            '`WITH CHECK` in the same commit as the writer for exactly this, and without it ' +
            'the tenant on the row and the tenant of the act are two facts that can disagree.',
        )
      }
    })

    it('3e · RLS is ENABLED *and* FORCED, read from the CATALOGUE rather than inferred', async () => {
      /**
       * 🛑 A NAMED GAP IN THIS DIRECTORY'S CONTROLS, CLOSED FOR THESE THREE
       * TABLES ONLY, AND SAID PLAINLY SO NOBODY READS IT AS MORE.
       *
       * **Every RLS assertion in `tests/db/` is keyed on a table somebody
       * named.** Nothing enumerates schema `tenant` and demands
       * `relrowsecurity AND relforcerowsecurity` of every relation in it — so
       * a migration shipping a table with no RLS at all passes the whole
       * gate. That was demonstrated on this tree by an adversarial read, and
       * it is a control that does not exist rather than one that failed.
       * **This test does not close it.** It closes the three tables this file
       * owns, by CATALOGUE, and the schema-wide version is owed by somebody
       * else.
       *
       * ⚠️ AND IT IS HERE BECAUSE OF WHAT `0017` DOES. That migration
       * `ALTER TABLE … ADD COLUMN`s a table `0014` created. An `ADD COLUMN`
       * does not drop a policy and does not clear `relforcerowsecurity` —
       * but §3a–§3c would pass just as well against a table whose RLS had
       * been quietly turned off and whose rows a previous test had left in
       * one tenant only. **The negative control in §3b is the strong
       * evidence; this is the cheap evidence that says which flag is set,
       * and the two answer different questions.**
       *
       * 🛑 `relforcerowsecurity` IS THE ONE TO READ. `ENABLE` alone leaves the
       * TABLE OWNER exempt, so a suite connecting as the owner passes with
       * the policy doing nothing — `0014` says exactly this, and `FORCE` is
       * what makes `BYPASSRLS` on `reconcile_migrator` the only route to the
       * exemption.
       */
      const mig = await migratorClient()
      try {
        const out = await mig.query(
          `SELECT rel.relname, rel.relrowsecurity, rel.relforcerowsecurity,
                  (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = rel.oid) AS policies
             FROM pg_class rel JOIN pg_namespace ns ON ns.oid = rel.relnamespace
            WHERE ns.nspname = 'tenant'
              AND rel.relname IN ('audit_event', 'data_access_event', 'usage_record')
            ORDER BY rel.relname`,
        )
        assert.deepEqual(
          out.rows,
          [
            { relname: 'audit_event', relrowsecurity: true, relforcerowsecurity: true, policies: 1 },
            {
              relname: 'data_access_event',
              relrowsecurity: true,
              relforcerowsecurity: true,
              policies: 1,
            },
            { relname: 'usage_record', relrowsecurity: true, relforcerowsecurity: true, policies: 1 },
          ],
          'one of invariant 10\'s three streams is not ENABLEd and FORCEd for row-level ' +
            'security, or does not carry exactly one policy. `0014` states both on all three ' +
            'and `0017` must not disturb either — an `ADD COLUMN` does not, and this is what ' +
            'says so rather than assuming it. A stream whose RLS is off is not an audit ' +
            'trail; it is a disclosure with a hash chain around it.',
        )
      } finally {
        await mig.end()
      }
    })
  })

  /* ================================================================ *
   * §4 · APPEND-ONLY, AS A PRIVILEGE RATHER THAN A CONVENTION.
   * ================================================================ */

  describe('§4 · the request path can neither amend nor erase a record of an act', () => {
    for (const table of ['audit_event', 'data_access_event', 'usage_record'] as const) {
      it(`4a · ${table} — the app role cannot UPDATE`, async () => {
        await assert.rejects(
          () =>
            withTenantScope(pool, ACME, (tx) =>
              tx.query(`UPDATE tenant.${table} SET authorization_id = NULL`),
            ),
          (err: unknown) => /permission denied/i.test(String(err)),
          `THE REQUEST PATH CAN AMEND \`${table}\`. G317: "append-only as a PRIVILEGE, so ` +
            'nothing on a request path can amend or erase a record of an act." On an EVENT ' +
            'stream that is stronger than on the grant table, because these are the rows an ' +
            'investigation reads. A record that can be edited after the act is a record of ' +
            'whatever was most convenient afterwards.',
        )
      })

      it(`4b · ${table} — the app role cannot DELETE`, async () => {
        await assert.rejects(
          () =>
            withTenantScope(pool, ACME, (tx) => tx.query(`DELETE FROM tenant.${table}`)),
          (err: unknown) => /permission denied/i.test(String(err)),
          `the request path can erase rows from \`${table}\`. Append-only is the whole claim.`,
        )
      })
    }

    it('4c · ANTI-VACUOUS — the app role CAN still INSERT and SELECT', async () => {
      /* Without this, §4a and §4b are satisfied by a role with no privileges at
       * all, which would also make every ALLOW arm above fail — but would make
       * THESE two pass for the wrong reason if the suite were ever reordered. */
      await withTenantScope(pool, ACME, (tx) =>
        writeAuditEvent(tx, auditEvent(ACME, 'aud_still_writable', ACTORS.user, acmeGrant.id)),
      )
      assert.ok((await countIn(pool, ACME, 'audit_event')) > 0)
    })

    it('4d · a duplicate chain sequence is REFUSED — a fork is not a gap', async () => {
      /* *"Monotonic per tenant per stream. Gaps are the detection"* — and a
       * DUPLICATE is the other half. Two rows at one sequence make the chain
       * ambiguous about which body the next `previousHash` covers, which is
       * undetectable by counting. */
      const first = auditEvent(ACME, 'aud_seq_a', ACTORS.user, acmeGrant.id)
      const second = {
        ...auditEvent(ACME, 'aud_seq_b', ACTORS.user, acmeGrant.id),
        chain: first.chain,
      }
      await withTenantScope(pool, ACME, (tx) => writeAuditEvent(tx, first))
      await assert.rejects(
        () => withTenantScope(pool, ACME, (tx) => writeAuditEvent(tx, second)),
        (err: unknown) => /duplicate key|unique/i.test(String(err)),
        'two audit events share one chain sequence. A chain that forks is worse than a chain ' +
          'with a gap: a gap is detectable by counting and a fork is not.',
      )
    })
  })

  /* ================================================================ *
   * §5 · WHAT IS STILL NOT ENFORCED, ASSERTED SO IT CANNOT BE FORGOTTEN.
   * ================================================================ */

  describe('§5 · the gap G317 left open, now closed, and the ones that remain', () => {
    it('5a · `usage_record` carries the column-level rule — ONE check, and it is the same one', async () => {
      /**
       * ✅ **THE TRIPWIRE THAT STOOD HERE FIRED ON
       * `db/migrations/0017_usage_record_actor.sql` AND IS REPLACED BY THE
       * POSITIVE ASSERTION, NOT DELETED — G387, 19 Sep 2026.** Its own text
       * named the terms: *"When the ruling lands, this is what goes red, and
       * the commit that answers it owes the positive assertion here in the
       * same breath."* This is that commit, and this is that assertion. It is
       * the same exchange `tests/http/authorisation-record.test.ts` §8 made
       * when `0014` landed.
       *
       * **WHAT THE OLD ASSERTION SAID, QUOTED SO THE REVERSAL IS LEGIBLE:**
       * *"`tenant.usage_record` now carries CHECK constraint(s) … and this
       * file still asserts it carries none. If one of them enforces
       * `AUTHORIZATION_MAY_BE_ABSENT`, that is a RULING — the model gives
       * this record no actor, and `db/migrations/0014` refuses three ways of
       * inventing one, the deciding reason being that a principal attribute
       * here crosses the plane boundary on every metered event and breaks
       * invariant 3."*
       *
       * 🛑 **THE DECIDING REASON IT NAMES IS NOT DISMISSED, IT IS ANSWERED,
       * AND THE ANSWER HAS ITS OWN TEST.** G387 adds the actor KIND — a
       * five-member closed vocabulary that is not a person — and withholds
       * every actor ID. **§2g is that half**, and it is what keeps this
       * exchange from being a tripwire traded for nothing.
       *
       * ⚠️ AND THE SHAPE OF THIS ASSERTION IS NARROWED RATHER THAN INVERTED.
       * It does not say *"at least one check exists"*, which a stray
       * constraint would satisfy; it names the ONE constraint this table may
       * carry, so a SECOND check arriving here is still red and still a
       * ruling.
       */
      const constraints = await (async () => {
        const mig = await migratorClient()
        try {
          const out = await mig.query(
            `SELECT con.conname FROM pg_constraint con
               JOIN pg_class rel ON rel.oid = con.conrelid
               JOIN pg_namespace ns ON ns.oid = rel.relnamespace
              WHERE ns.nspname = 'tenant' AND rel.relname = 'usage_record'
                AND con.contype = 'c'
              ORDER BY con.conname`,
          )
          return (out.rows as Array<{ conname: string }>).map((r) => r.conname)
        } finally {
          await mig.end()
        }
      })()
      assert.deepEqual(
        constraints,
        ['usage_record_authorisation_present'],
        `\`tenant.usage_record\` carries ${constraints.length} CHECK constraint(s) ` +
          `(${constraints.join(', ') || 'none'}) and G387 says it carries exactly one. ` +
          'If it carries NONE, the meter stream has lost the rule the other two streams ' +
          'hold and "one rule, three tables, no special case" is false — a constraint that ' +
          'holds on two of three records is a constraint a reader will believe holds on ' +
          'three. If it carries a SECOND, that is a ruling nobody has taken: read ' +
          '`db/migrations/0017_usage_record_actor.sql`\'s invariant 3 block before adding ' +
          'anything to the one record class that ships to the control plane.',
      )

      /* And the model-side rule is unchanged and still the one that governs a
       * writer here — asserted so the constraint above is a statement about
       * the DATABASE agreeing with the model rather than about SQL alone. */
      assert.equal(authorizationIsWellFormed(ACTORS.user, null), false)
      assert.equal(authorizationIsWellFormed(ACTORS.system, null), true)
    })

    it('5b · nothing on a REQUEST PATH writes any of the three, and that is still true', async () => {
      /**
       * 🛑 THE NARROW CLAIM THIS COMMIT EARNS, ASSERTED SO IT IS NOT OVERSTATED.
       *
       * `CLAUDE.md`: *"a served read records THE AUTHORISATION IT RAN UNDER and
       * not THE ACCESS … **Nobody should read an access log off
       * `tenant.authorization_grant`.**"* That sentence survives this commit —
       * and so does its consequence: nobody should read one off
       * `tenant.data_access_event` either, because nothing writes it.
       *
       * The store is called from `tests/` and from nowhere else. When a handler
       * calls it, THIS is the assertion that goes red, and the commit that does
       * it owes `CLAUDE.md`'s sentence a correction in the same breath.
       */
      const { readFileSync, readdirSync, statSync } = await import('node:fs')
      const path = await import('node:path')
      const { REPO_ROOT } = await import('../http/harness.ts')
      const root = path.join(REPO_ROOT, 'server')
      const files: string[] = []
      const walk = (d: string): void => {
        for (const entry of readdirSync(d)) {
          const full = path.join(d, entry)
          if (statSync(full).isDirectory()) walk(full)
          else if (full.endsWith('.ts')) files.push(full)
        }
      }
      walk(root)
      assert.ok(files.length >= 10, `only ${files.length} file(s) under server/ — wrong tree`)

      /**
       * 🛑 AN IMPORT, NOT A MENTION — G834, 20 Sep 2026, AND THE SCAN THIS
       * REPLACES WENT RED FOR THE WRONG REASON.
       *
       * It matched the bare token `event-stream-store` anywhere in a file's
       * text, and `server/control-plane/roster-store.ts` made it red by
       * CITING this module as the precedent for a reader with no route —
       * *"the same shape in the same tree: three write functions called from
       * `tests/` and from nowhere else."* Exact failure:
       * `actual: [ 'server/control-plane/roster-store.ts' ]`.
       *
       * **That file imports nothing from `data-plane/` and could not: it is
       * on the other plane and connects to the other database.** The
       * assertion was keyed on a landmark — the string appearing in a file —
       * instead of on the property it protects, which is whether anything
       * CALLS the store. `tests/http/administration-tier-unmounted.test.ts`
       * records the identical shape twice for its own scanners, in its
       * `codeOf()` note and again at §4a, and warns each time that it *"would
       * have made every future explanation of this blocker a red gate"*.
       *
       * ⚠️ THE PROPERTY IS UNCHANGED AND SO IS THE MESSAGE. What changed is
       * that a module must reach the store through an IMPORT SPECIFIER — the
       * only way a caller can exist — rather than by naming it in prose.
       * Comments are stripped first for the same reason.
       */
      const callers = files
        .filter((f) => !f.endsWith(path.join('data-plane', 'event-stream-store.ts')))
        .filter((f) => {
          const code = readFileSync(f, 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, ' ')
            .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
          return /from\s+['"][^'"]*event-stream-store(\.ts)?['"]/.test(code)
        })
        .map((f) => path.relative(REPO_ROOT, f))
      assert.deepEqual(
        callers,
        [],
        `\`server/\` now reaches the event-stream store from ${callers.join(', ')}. That is ` +
          'the commit this file has been waiting for, and it owes three things it cannot ' +
          'skip: a producer for whichever terms it writes (`DataAccessEvent.maxDataClass` ' +
          'must NOT be guessed — G106\'s rejected alternative is "scope failing OPEN"), a ' +
          'sequence allocator for `RecordChain`, and a correction to `CLAUDE.md`\'s sentence ' +
          'that a served read "does not yet record THE ACCESS".',
      )
    })
  })
})
