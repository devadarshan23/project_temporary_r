/**
 * H2's ONBOARDING STATE, IN SQL — the two properties `model/onboarding.ts`
 * holds in TypeScript, held again by the schema, against a real PostgreSQL.
 *
 * **G1241 (THE OWNER'S), G1242 and G1243, 20 Sep 2026.**
 *
 * ┌─ WHY A SECOND ENFORCEMENT AT ALL ─────────────────────────────────────────┐
 * │ The owner's ruling puts onboarding state in the control database, and the  │
 * │ instruction that came with it is the reason this file exists:              │
 * │                                                                            │
 * │   "Your schema must make both of those properties true in SQL, not just    │
 * │    in TypeScript."                                                         │
 * │                                                                            │
 * │ The two are `model/onboarding.ts`'s own:                                   │
 * │   · the state is a PREFIX LENGTH and not a set — §5.5, because a           │
 * │     `Record<StepKey, boolean>` admits *"step four done, step two not"*,    │
 * │     which neither transition can produce;                                  │
 * │   · `forced` is APPEND-ONLY, because the contract calls the reason         │
 * │     *"PERMANENT, AND THE ONLY RECORD OF WHY THE SEQUENCE WAS BROKEN"* and  │
 * │     *"a record a second write can overwrite is not a permanent record."*   │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 §1 IS AN ABSENCE AND §2 IS A RAISE, AND THE DIFFERENCE IS THE WHOLE
 * DESIGN. A prefix length is held by there being ONE INTEGER COLUMN — a
 * non-prefix state has nowhere to be written down, which is stronger than
 * rejecting one. Append-only cannot be held that way, because a row that exists
 * can always be rewritten, so it takes a TRIGGER — and the trigger rather than
 * the grant, because **the grant is vacuous against the only writer this table
 * has**: no role holds `INSERT` at all, so the only thing that writes a forced
 * mark today is `server/control-plane/provision.ts` running as the ADMIN, and
 * an admin holds every privilege by construction.
 *
 * ⚠️ IT DROPS AND REBUILDS ITS OWN CONTROL DATABASE, WHICH NO OTHER SUITE HERE
 * DOES, AND THE REASON IS §7c. That assertion poisons a forced-step row on
 * purpose, and **the append-only trigger means nothing can clean it up** — not
 * this file, not the admin, not a later run. A suite that left it behind would
 * pass once and fail for ever after, which is a flaky gate caused by the very
 * control it is asserting.
 *
 * ⚠️ IT SKIPS LOUDLY without a database, like every other file here. A run in
 * which this file skipped is NOT evidence that a forced onboarding mark is
 * permanent.
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import { controlDbPort } from '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

const CONTROL_DB =
  process.env['RECONCILE_ONBOARDING_TEST_DB_NAME'] ?? runScopedName('reconcile_control_onboarding_test')
process.env['RECONCILE_CONTROL_DB_NAME'] = CONTROL_DB
process.env['RECONCILE_CONTROL_READ_DB_NAME'] = CONTROL_DB
if ((process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? '') === '') {
  process.env['RECONCILE_CONTROL_DB_ADMIN'] = process.env['USER'] ?? 'postgres'
}

const { probeDatabase, describeTarget } = await import('../../db/env.ts')
const { loadPg } = await import('../../db/pg.ts')

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/db/onboarding-record.test.ts DID NOT RUN.',
      '',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS FILE CARRIES THE APPEND-ONLY TRIGGER ON A FORCED ONBOARDING GATE.',
      '   A run in which it skipped is NOT evidence that the only record of why a',
      '   sequence was broken cannot be overwritten.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the onboarding record’s schema and its append-only trigger', probe)

import type { Client } from 'pg'

import { ONBOARDING_STEPS } from '../../model/onboarding.ts'
/* ⛔ The data plane's two control roles are RETIRED (G4320, `0052`); their
   modules are deleted, so the names are spelled here. */
const CONTROL_READ_ROLE = 'reconcile_control_reader'
const CONTROL_WRITE_ROLE = 'reconcile_control_writer'
import { CONTROL_APP_ROLE } from '../../server/control-plane/config.ts'
import { startInternalPair, type InternalPair } from '../http/internal-pair.ts'
import {
  provisionControlPlane,
  seedTenancyRoster,
} from '../../server/control-plane/provision.ts'
import {
  readConsoleRoster,
  CONSOLE_ROSTER_REFUSALS,
} from '../../server/data-plane/console-roster-store.ts'
import { runScopedName } from '../run-scoped-db.ts'

const RECORD = 'onboarding_record'
const FORCED = 'onboarding_forced_step'

async function adminOn(database: string): Promise<Client> {
  const { Client: PgClient } = await loadPg()
  const client = new PgClient({
    host: '127.0.0.1',
    port: controlDbPort(),
    database,
    user: process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? 'postgres',
    application_name: 'reconcile-onboarding-test',
  })
  await client.connect()
  return client
}

/**
 * 🛑 DROP AND RECREATE. See the header: §7c writes a row no privilege in this
 * cluster can remove, which is the point of the trigger and would be a flaky
 * gate if it survived the run that wrote it.
 */
async function rebuildControlDatabase(): Promise<void> {
  const admin = await adminOn('postgres')
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [CONTROL_DB],
    )
    // Neither statement may run inside a transaction block, hence no BEGIN.
    await admin.query(`DROP DATABASE IF EXISTS ${CONTROL_DB}`)
    await admin.query(`CREATE DATABASE ${CONTROL_DB}`)
  } finally {
    await admin.end()
  }
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

interface ColumnRow {
  readonly table_name: string
  readonly column_name: string
  readonly data_type: string
  readonly is_nullable: string
}

let columns: readonly ColumnRow[] = []
/* G4318 — the roster reader now reads over the signed internal edge, so §7
   drives it against a REAL control plane over this database. */
let pair: InternalPair | undefined
const AZG = `azg_${'7'.repeat(32)}`

describe('the onboarding record — a prefix length and a permanent mark', { skip }, () => {
  before(async () => {
    await rebuildControlDatabase()
    await provisionControlPlane()
    await seedTenancyRoster()
    pair = await startInternalPair()

    const admin = await adminOn(CONTROL_DB)
    try {
      const rows = await admin.query(
        `SELECT table_name::text, column_name::text, data_type::text, is_nullable::text
           FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = ANY($1::text[])
          ORDER BY table_name, ordinal_position`,
        [[RECORD, FORCED]],
      )
      columns = rows.rows as unknown as ColumnRow[]
    } finally {
      await admin.end()
    }
  })

  after(async () => {
    if (pair !== undefined) await pair.close().catch(() => undefined)
  })

  /* ================================================================ *
   * §0 · THE §5.6 GUARD. Every assertion below is over `columns` or
   *      over a live statement against these two tables.
   * ================================================================ */

  it('0 · both tables exist and the column scan read them', () => {
    const names = [...new Set(columns.map((c) => c.table_name))].sort()
    assert.deepEqual(
      names,
      [FORCED, RECORD].sort(),
      'the onboarding tables are not in this database, so every property asserted below is ' +
        `true of nothing. Found: [${names.join(', ')}]`,
    )
  })

  /* ================================================================ *
   * §1 · THE PREFIX LENGTH — HELD BY AN ABSENCE, NOT BY A CHECK.
   * ================================================================ */

  it('1a · the state is ONE INTEGER and there is nowhere to write a non-prefix', () => {
    const record = columns.filter((c) => c.table_name === RECORD)
    assert.deepEqual(
      record.map((c) => c.column_name).sort(),
      ['completed_steps', 'tenant_id'],
      '`onboarding_record` does not carry exactly a tenant and a count. **THE TWO SHAPES ' +
        'THIS ASSERTION REFUSES ARE THE OBVIOUS ONES**: six `boolean` columns, or a child ' +
        'table with one row per finished step. Both make *"step four done, step two not"* a ' +
        'row somebody can write, and `model/onboarding.ts` refuses it in TypeScript for the ' +
        'reason that then binds every reader for ever: *"a state the rules below can never ' +
        'produce and every reader would then have to defend against."* §5.5, in DDL.',
    )
    const count = record.find((c) => c.column_name === 'completed_steps')
    assert.equal(count?.data_type, 'integer', 'the count is not an integer')
    assert.equal(
      count?.is_nullable,
      'NO',
      'the count is nullable. `0` is what a tenant created five minutes ago has — ' +
        '`newOnboarding()` — so a NULL would be a SECOND spelling of the starting state, ' +
        'and the two would have to be told apart by every reader.',
    )
  })

  it('1b · a NEGATIVE count is refused by the database', async () => {
    const admin = await adminOn(CONTROL_DB)
    try {
      await admin.query(
        `INSERT INTO tenancy_roster
           (tenant_id, name, deployment_mode, residency, support_access_mode, plan)
         VALUES ('ten_negative', 'Negative Ltd', 'hosted', 'us-west-2', 'never', NULL)
         ON CONFLICT (tenant_id) DO NOTHING`,
      )
      await assert.rejects(
        () =>
          admin.query(
            `INSERT INTO ${RECORD} (tenant_id, completed_steps) VALUES ('ten_negative', -1)`,
          ),
        (err: unknown) => {
          assert.match(
            messageOf(err),
            /completed_is_a_prefix_length|check constraint/i,
            `a negative prefix length was accepted. Found: ${messageOf(err)}`,
          )
          return true
        },
      )
      /* The control arm: the same statement with a legal value commits. */
      const ok = await admin.query(
        `INSERT INTO ${RECORD} (tenant_id, completed_steps) VALUES ('ten_negative', 0)`,
      )
      assert.equal(
        ok.rowCount,
        1,
        'the legal value was refused too, so the assertion above passed for the wrong ' +
          'reason — §5.6, in a constraint test',
      )
    } finally {
      await admin.end()
    }
  })

  it('1c · and there is NO UPPER BOUND, deliberately — G1242', async () => {
    /**
     * 🛑 THIS ASSERTS AN ABSENCE AND THE ABSENCE IS ARGUED ON THE MIGRATION'S
     * FACE. An upper bound would be `<= 6`, and 6 is `ONBOARDING_STEPS.length`:
     * a THIRD copy of the sequence's length that G88's forward-only rule then
     * freezes, so a SEVENTH step would be legal in `model/` and refused by SQL.
     * `0069_run_admission.sql` states the polarity for vocabulary columns and it
     * is the same argument for a bound: *"an UNKNOWN value must reach the model
     * as an `*_unreadable` refusal, not be rejected at write time by a list
     * somebody forgot to extend."*
     *
     * ⚠️ SO THE REFUSAL IS THE READER'S, AND §7b IS WHERE IT IS WITNESSED. This
     * assertion is only half a control on its own and says so.
     */
    const admin = await adminOn(CONTROL_DB)
    try {
      const out = await admin.query(
        `INSERT INTO ${RECORD} (tenant_id, completed_steps) VALUES ('ten_negative', $1)
         ON CONFLICT (tenant_id) DO UPDATE SET completed_steps = $1
         RETURNING completed_steps`,
        [ONBOARDING_STEPS.length + 93],
      )
      assert.equal(
        (out.rows[0] as { completed_steps: number }).completed_steps,
        ONBOARDING_STEPS.length + 93,
        'an out-of-range count was refused at WRITE time. If that is deliberate, the bound ' +
          'is now a third copy of `ONBOARDING_STEPS.length` under G88`s forward-only rule, ' +
          'and the commit that added it owes the argument `0030` makes against one.',
      )
    } finally {
      await admin.end()
    }
  })

  /* ================================================================ *
   * §2 · APPEND-ONLY, WITNESSED AS THE ADMIN — G1243.
   * ================================================================ */

  it('2a · UPDATE on a forced mark RAISES, for the ADMIN', async () => {
    const admin = await adminOn(CONTROL_DB)
    try {
      /* §5.6: there must be a row to refuse an update to. */
      const before = await admin.query(`SELECT count(*)::int AS n FROM ${FORCED}`)
      assert.ok(
        (before.rows[0] as { n: number }).n > 0,
        'no forced mark exists, so the three assertions in this section would pass against ' +
          'an empty table. `seedTenancyRoster()` seeds one for `ten_borealis`.',
      )
      await assert.rejects(
        () => admin.query(`UPDATE ${FORCED} SET reason = 'rewritten'`),
        (err: unknown) => {
          assert.match(
            messageOf(err),
            /APPEND-ONLY/,
            'the UPDATE was refused for a reason other than the append-only trigger. The ' +
              'contract calls a forced gate`s reason *"PERMANENT, AND THE ONLY RECORD OF WHY ' +
              'THE SEQUENCE WAS BROKEN"*, and `model/onboarding.ts` turns that into a rule: ' +
              `*"a record a second write can overwrite is not a permanent record."* ${messageOf(err)}`,
          )
          return true
        },
      )
    } finally {
      await admin.end()
    }
  })

  it('2b · DELETE on a forced mark RAISES too', async () => {
    const admin = await adminOn(CONTROL_DB)
    try {
      await assert.rejects(
        () => admin.query(`DELETE FROM ${FORCED}`),
        (err: unknown) => {
          assert.match(messageOf(err), /APPEND-ONLY/, messageOf(err))
          return true
        },
      )
    } finally {
      await admin.end()
    }
  })

  it('2c · and TRUNCATE RAISES, which a ROW trigger cannot see', async () => {
    /**
     * 🛑 THE SEPARATE STATEMENT-LEVEL TRIGGER IS NOT TIDINESS AND THIS IS THE
     * ASSERTION THAT SAYS SO. PostgreSQL has no per-row notion of `TRUNCATE`, so
     * a `FOR EACH ROW` trigger does not fire on one at all — an append-only
     * guarantee resting on a row trigger alone is defeated by ONE STATEMENT and
     * looks exactly like a guarantee until it is. Measured against a
     * row-trigger-only draft before `0030` was written: `TRUNCATE TABLE`, then
     * `count(*)` → 0.
     */
    const admin = await adminOn(CONTROL_DB)
    try {
      await assert.rejects(
        () => admin.query(`TRUNCATE ${FORCED}`),
        (err: unknown) => {
          assert.match(messageOf(err), /APPEND-ONLY/, messageOf(err))
          return true
        },
      )
      const after = await admin.query(`SELECT count(*)::int AS n FROM ${FORCED}`)
      assert.ok(
        (after.rows[0] as { n: number }).n > 0,
        'the TRUNCATE raised and the table is empty anyway, which would mean the raise ' +
          'happened after the rows were gone',
      )
    } finally {
      await admin.end()
    }
  })

  it('2d · a SECOND mark on a DIFFERENT step APPENDS, and the same step collides', async () => {
    /**
     * The other half of append-only, and without it §2a–§2c would be satisfied
     * by a table nothing can write at all. `S1 Staff.dc.html` holds ONE slot —
     * `forced:{t, i, why}` — so forcing a second gate overwrites the first
     * reason; `model/onboarding.ts` diverges from the prototype there and this
     * is that divergence made structural by `PRIMARY KEY (tenant_id, step)`.
     */
    const admin = await adminOn(CONTROL_DB)
    try {
      const appended = await admin.query(
        `INSERT INTO ${FORCED} (tenant_id, step, reason)
         VALUES ('ten_borealis', 'extraction_floor', 'Second gate forced for a second reason.')
         ON CONFLICT (tenant_id, step) DO NOTHING`,
      )
      assert.equal(appended.rowCount, 1, 'a second forced mark on a different step was refused')
      const both = await admin.query(
        `SELECT count(*)::int AS n FROM ${FORCED} WHERE tenant_id = 'ten_borealis'`,
      )
      assert.equal(
        (both.rows[0] as { n: number }).n,
        2,
        'the second mark replaced the first rather than joining it — which is exactly the ' +
          'prototype behaviour `model/onboarding.ts` refuses',
      )
      await assert.rejects(
        () =>
          admin.query(
            `INSERT INTO ${FORCED} (tenant_id, step, reason)
             VALUES ('ten_borealis', 'extraction_floor', 'a third reason')`,
          ),
        (err: unknown) => {
          assert.match(
            messageOf(err),
            /duplicate key|unique/i,
            `a second force of the SAME step was accepted. Found: ${messageOf(err)}`,
          )
          return true
        },
      )
    } finally {
      await admin.end()
    }
  })

  it('2e · the trigger function is NOT `SECURITY DEFINER`, read from the catalogue', async () => {
    /**
     * G160 refused that object, and `db/migrations/0019` is the precedent:
     * `tests/db/membership-revocation.test.ts` §7 reads `pg_proc.prosecdef`
     * rather than trusting a keyword to have been omitted. This function holds
     * no authority of its own — it reads no table and takes no decision; it
     * raises — so a definer's right would be a privilege with nothing to spend.
     */
    const admin = await adminOn(CONTROL_DB)
    try {
      const rows = await admin.query(
        `SELECT p.proname::text AS name, p.prosecdef AS definer
           FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'onboarding_forced_step_append_only'`,
      )
      assert.equal(rows.rowCount, 1, 'the append-only trigger function is not in the catalogue')
      assert.equal(
        (rows.rows[0] as { definer: boolean }).definer,
        false,
        'the append-only trigger function is `SECURITY DEFINER`. G160 refused that object, ' +
          'and this one would gain nothing from it: it reads no table and raises.',
      )
    } finally {
      await admin.end()
    }
  })

  /* ================================================================ *
   * §3 · THE PRIVILEGES. Read as the roles they are about.
   * ================================================================ */

  it('3a · only the ONBOARDING WRITER holds a write, and only where 0040 argues one', async () => {
    /**
     * ⚠️ `has_table_privilege()` AND NOT `information_schema.role_table_grants`,
     * which is G1165's measured finding one file over: that view is FILTERED TO
     * THE CALLING ROLE, so an absence read through it can be an absence of
     * VISIBILITY rather than of privilege — and §A of the census would have
     * passed for ever about a role it could not see.
     *
     * 🛑 **AND `has_any_column_privilege()` BESIDE IT — G1429, 21 Sep 2026, AND
     * WITHOUT IT THIS ASSERTION WOULD HAVE STAYED GREEN THROUGH THE COMMIT THAT
     * GRANTED A WRITE.** Measured against a live PostgreSQL 14.18 with
     * `GRANT UPDATE (completed_steps) ON onboarding_record TO
     * reconcile_control_writer` applied: `has_table_privilege(..., 'UPDATE')`
     * answers **f** and `has_any_column_privilege(..., 'UPDATE')` answers **t**.
     * A COLUMN-LEVEL grant is invisible to the table-level predicate, and a
     * column-level `UPDATE` is this product's established shape for a narrow
     * write (G358). The same repair is made in
     * `tests/db/control-plane-census.test.ts`, which had the same hole.
     *
     * ⚠️ THERE IS NO COLUMN-LEVEL `DELETE` TO ASK ABOUT — PostgreSQL answers
     * `unrecognized privilege type: "DELETE"`, because a `DELETE` removes a
     * whole row. The table-level predicate is COMPLETE for that verb.
     *
     * ═══════════════════════════════════════════════════════════════════════
     * 🛑 **THIS ASSERTED `deepEqual(writable, [])` UNTIL 21 Sep 2026 AND THE
     *    ORIGINAL TITLE WAS *"no serving role holds INSERT, UPDATE or DELETE on
     *    either table"*. R9, THE OWNER'S, TOOK THE WRITE.**
     * ═══════════════════════════════════════════════════════════════════════
     *
     * **What replaces the empty list is an ENUMERATION and not a deletion**, in
     * the shape `tests/db/control-plane-census.test.ts` §C uses for reads. The
     * original message is kept verbatim below, because the question it asks —
     * *what would a path that could write here be able to do* — is the test
     * `0002_tenancy_roster.sql` sets and is the reason the list is two pairs
     * rather than four.
     *
     * 🟢 **THE TWO PAIRS THAT ARE NOT HERE ARE THE POINT.** The writer holds NO
     * `INSERT` on `onboarding_record` — it may advance a delivery record and
     * not create one — and NO `UPDATE` and NO `DELETE` on
     * `onboarding_forced_step`, which is `0030`'s append-only property held by
     * a withheld grant as well as by a trigger.
     */
    const admin = await adminOn(CONTROL_DB)
    try {
      const rows = await admin.query(
        `SELECT roles.grantee::text AS grantee, t.name::text AS relname,
                (has_table_privilege(roles.grantee, t.name, 'INSERT')
                 OR has_table_privilege(roles.grantee, t.name, 'UPDATE')
                 OR has_table_privilege(roles.grantee, t.name, 'DELETE')
                 OR has_any_column_privilege(roles.grantee, t.name, 'INSERT')
                 OR has_any_column_privilege(roles.grantee, t.name, 'UPDATE')) AS writes
           FROM unnest($1::text[]) AS roles(grantee)
          CROSS JOIN unnest($2::text[]) AS t(name)`,
        [[CONTROL_APP_ROLE, CONTROL_READ_ROLE, CONTROL_WRITE_ROLE], [RECORD, FORCED]],
      )
      const writable = (rows.rows as unknown as { grantee: string; relname: string; writes: boolean }[])
        .filter((r) => r.writes)
        .map((r) => `${r.grantee}:${r.relname}`)
      assert.deepEqual(
        [...writable].sort(),
        /* ⚠️ G4308, 5 Oct 2026 — THE OWNER'S "Full restore" RULING: `0050` gives
           the CONTROL plane's own role `0040`'s exact writer grants, because the
           onboarding writes move behind signed control-plane endpoints. The
           writer's two pairs stay until S5 revokes them. */
        /* ⛔ G4320 — the writer's two pairs are revoked by `0052`; the control
           plane's own role is now the only writer of onboarding state. */
        [`${CONTROL_APP_ROLE}:${RECORD}`, `${CONTROL_APP_ROLE}:${FORCED}`].sort(),
        'a serving role can write onboarding state that `db/migrations-control/' +
          '0040_onboarding_writer.sql` does not argue for. **THE TEST `0002_tenancy_roster.sql` SETS ' +
          'IS WHAT A PATH THAT COULD WRITE HERE WOULD BE ABLE TO DO**: it could mark a ' +
          'tenant`s onboarding COMPLETE — making `stage` read `live` for a tenant nobody has ' +
          'bound a source for — or it could FORGE the permanent record of why a step was ' +
          'forced, which is the one row in this database whose entire purpose is to be ' +
          'evidence in a review. ' +
          '🛑 R9 (21 Sep 2026, THE OWNER`S) PERMITS EXACTLY TWO PAIRS — the onboarding ' +
          'writer on each table — and `0040` argues the VERBS and the COLUMN each is ' +
          'narrowed to. A third pair, or either of these to a different role, is this gate ' +
          'going red and owes the same argument. ' +
          `Found: [${[...writable].sort().join(', ')}]`,
      )
    } finally {
      await admin.end()
    }
  })

  it('3b · since G4320 the retired CONSOLE reader may SELECT neither, and the CONTROL app role (G4308) may SELECT both', async () => {
    /**
     * 🛑 A NARROWING RATHER THAN AN OVERSIGHT, AND IT IS `0020`'s ARGUMENT RUN
     * IN REVERSE. That file describes `reconcile_control_app`'s `SELECT` set as
     * *"everything this database publishes downward to the whole fleet"* — and
     * onboarding state is published downward to nobody: no `control-plane.openapi.yaml`
     * operation names a step, and a tenant's own data plane has no business
     * reading 1CloudHub's delivery notes about it.
     */
    const admin = await adminOn(CONTROL_DB)
    try {
      const rows = await admin.query(
        `SELECT roles.grantee::text AS grantee, t.name::text AS relname,
                has_table_privilege(roles.grantee, t.name, 'SELECT') AS reads
           FROM unnest($1::text[]) AS roles(grantee)
          CROSS JOIN unnest($2::text[]) AS t(name)`,
        [[CONTROL_APP_ROLE, CONTROL_READ_ROLE], [RECORD, FORCED]],
      )
      const grid = rows.rows as unknown as { grantee: string; relname: string; reads: boolean }[]
      const consoleReads = grid.filter((r) => r.grantee === CONTROL_READ_ROLE && r.reads).length
      /* ⛔ G4320 — the console reader is RETIRED and `0052` revoked its reads;
         `listTenants` derives `stage` from the control plane's own read now. */
      assert.equal(
        consoleReads,
        0,
        `\`${CONTROL_READ_ROLE}\` can still read onboarding state after G4320 retired it.`,
      )
      const appReads = grid.filter((r) => r.grantee === CONTROL_APP_ROLE && r.reads).map((r) => r.relname)
      /* ✅ THE CONDITION THIS ASSERTION NAMED IS MET — G4301/G4308, 5 Oct 2026.
         It refused the read because "nothing in `control-plane.openapi.yaml`
         publishes it"; `getInternalOnboarding` and `getInternalRoster` now do,
         under the owner's "Full restore" ruling. The reader exists, so the
         privilege is no longer ahead of one. */
      assert.deepEqual(
        [...appReads].sort(),
        [FORCED, RECORD].sort(),
        `\`${CONTROL_APP_ROLE}\` — the CONTROL plane's own role — can read onboarding state. ` +
          'Nothing in `control-plane.openapi.yaml` publishes it, so this is a privilege ahead ' +
          'of a reader in the one direction `0004_subject_ledger.sql` did not have to name: ' +
          `the reader would be a whole other plane. Found: [${appReads.join(', ')}]`,
      )
    } finally {
      await admin.end()
    }
  })

  /* ================================================================ *
   * §4 · THE VOCABULARY IS `model/onboarding.ts`'s, AND THERE IS NO
   *      SECOND ONE — the tripwire `administration-tier-unmounted` §4a
   *      handed over when it was retired.
   * ================================================================ */

  it('4a · no column stores anything `model/onboarding.ts` DERIVES', () => {
    /**
     * 🛑 THE LIST IS THE OWNER'S RULING TURNED INTO AN ASSERTION: *"`stage` is
     * DERIVED at read time from the stored step state, never stored twice."*
     * Every name below is a FUNCTION of the two columns that do exist —
     * `onboardingStage()`, `STEP_HANDS`, `STEP_TITLE`, `onboardingSteps()` — so
     * a column for one is §5.3 with the copy in the place a console reads.
     */
    const derived = ['stage', 'stage_note', 'whose_hands', 'title', 'state', 'step_state']
    const stored = columns.map((c) => c.column_name)
    const found = derived.filter((d) => stored.includes(d))
    assert.deepEqual(
      found,
      [],
      'a column stores a value `model/onboarding.ts` derives. **`stage` is the sharp one and ' +
        'G833 refused it by name before the owner ruled**: it is a two-armed function OF the ' +
        'prefix length, and storing a function`s output beside its input means the two drift ' +
        'the first time a step is FORCED, because forcing moves `completed` by more than one ' +
        `and every writer has to remember the other column. Found: [${found.join(', ')}]`,
    )
  })

  it('4b · every stored `step` is a member of `ONBOARDING_STEPS`', async () => {
    const admin = await adminOn(CONTROL_DB)
    try {
      const rows = await admin.query(`SELECT DISTINCT step::text AS step FROM ${FORCED}`)
      const stored = (rows.rows as unknown as { step: string }[]).map((r) => r.step)
      assert.ok(stored.length > 0, 'no forced mark exists, so this assertion is vacuous')
      const steps: readonly string[] = ONBOARDING_STEPS
      const foreign = stored.filter((s) => !steps.includes(s))
      assert.deepEqual(
        foreign,
        [],
        'a stored step is not a member of the sequence `model/onboarding.ts` declares. ' +
          '⚠️ THERE IS NO `CHECK` ON THIS COLUMN AND THERE MUST NOT BE — it would be a THIRD ' +
          'copy of `ONBOARDING_STEPS` in a database no wire-mirror pair addresses — so an ' +
          'unrecognised value is a READER refusal (`forced_step_unreadable`, §7c) and this ' +
          `assertion is what keeps the SEED honest. Found: [${foreign.join(', ')}]`,
      )
    } finally {
      await admin.end()
    }
  })

  it('4c · an onboarding row for a tenant not on the roster is UNREPRESENTABLE', async () => {
    /**
     * 🛑 THE ONE THING `0002_tenancy_roster.sql` COULD NOT HAVE. That file
     * records the cost of its own primary key — *"`tenant.tenant` lives in the
     * OTHER database; PostgreSQL has no cross-database reference. So a roster
     * row can name a tenant that does not exist"* — and **both ends of THIS key
     * are in THIS database**, so the cost does not repeat.
     */
    const admin = await adminOn(CONTROL_DB)
    try {
      await assert.rejects(
        () =>
          admin.query(
            `INSERT INTO ${RECORD} (tenant_id, completed_steps) VALUES ('ten_nowhere', 0)`,
          ),
        (err: unknown) => {
          assert.match(
            messageOf(err),
            /foreign key|is_on_the_roster/i,
            `an onboarding row named a tenant with no roster entry. Found: ${messageOf(err)}`,
          )
          return true
        },
      )
    } finally {
      await admin.end()
    }
  })

  /* ================================================================ *
   * §5 · THE READER, AGAINST THE SAME DATABASE. Its three refusals,
   *      each witnessed, and each taking the WHOLE read down.
   *
   * 🛑 THE ORDER IS LOAD-BEARING AND §7c IS LAST FOR EVER. That
   *    assertion writes a forced mark nothing in this cluster can
   *    remove, so every read after it is refused. See the header.
   * ================================================================ */

  it('7a · a roster row with NO onboarding row refuses the whole read', async () => {
    assert.ok(pair !== undefined, 'no internal pair')
    const admin = await adminOn(CONTROL_DB)
    try {
      /*
       * ⚠️ §1c LEFT `ten_negative` PAST THE END OF THE SEQUENCE AND IT IS
       * REPAIRED HERE, FIRST, BECAUSE THE REFUSALS ARE WHOLE-READ. A test whose
       * control arm is refused by a DIFFERENT tenant for a DIFFERENT reason
       * asserts nothing about the reason it names — caught by this suite's
       * first run, which is the shape §5.6 describes.
       *
       * 🛑 **AND THE REPAIR IS A DELETE-AND-INSERT SINCE 21 Sep 2026, BECAUSE
       * `db/migrations-control/0040_onboarding_writer.sql` GAVE THIS TABLE AN
       * ADVANCE-ONLY TRIGGER (G1423) AND AN `UPDATE` BACK DOWN IS EXACTLY WHAT
       * IT REFUSES.** Witnessed: the old line answered `ERROR:
       * public.onboarding_record ADVANCES ONLY: 99 -> 1 is a decrement`, as the
       * ADMIN — which is the half no withheld grant could have covered. The
       * trigger fires on `UPDATE` only, so a row removed and written again is a
       * new row rather than a shrinking one. See §7b for the same repair and
       * the same reason.
       */
      await admin.query(`DELETE FROM ${RECORD} WHERE tenant_id = 'ten_negative'`)
      await admin.query(
        `INSERT INTO ${RECORD} (tenant_id, completed_steps) VALUES ('ten_negative', 1)`,
      )
      await admin.query(
        `INSERT INTO tenancy_roster
           (tenant_id, name, deployment_mode, residency, support_access_mode, plan)
         VALUES ('ten_ghost', 'Ghost Holdings', 'hosted', 'us-west-2', 'never', NULL)
         ON CONFLICT (tenant_id) DO NOTHING`,
      )
      const refused = await readConsoleRoster(pair.client, AZG)
      assert.equal(
        refused.ok,
        false,
        'a roster row with no onboarding row was published anyway. **DEFAULTING IT TO ' +
          '`newOnboarding()` IS THE TEMPTING REPAIR AND IT IS REFUSED**: `completed: 0` is ' +
          'what a tenant created five minutes ago has, and it is ALSO what a tenant created ' +
          'before `0030` existed has — so the default publishes `onboarding` about a tenant ' +
          'that may have been live for a year, on a screen whose whole subject is *"where ' +
          'each one has got to"*.',
      )
      if (!refused.ok) {
        assert.equal(refused.refusal, CONSOLE_ROSTER_REFUSALS.onboardingRecordAbsent)
        assert.equal(refused.tenantId, 'ten_ghost')
      }
      /* The control arm: give it a record and the whole read comes back. */
      await admin.query(
        `INSERT INTO ${RECORD} (tenant_id, completed_steps) VALUES ('ten_ghost', 0)`,
      )
      const ok = await readConsoleRoster(pair.client, AZG)
      assert.equal(
        ok.ok,
        true,
        'the read is still refused after the missing row was supplied, so the assertion ' +
          'above passed for a reason other than the one it names — §5.6',
      )
    } finally {
      await admin.end()
    }
  })

  it('7b · an out-of-range count refuses the whole read — the other half of G1242', async () => {
    assert.ok(pair !== undefined, 'no internal pair')
    const admin = await adminOn(CONTROL_DB)
    try {
      /*
       * `§1c` proved SQL ACCEPTS an out-of-range count; this proves the READER
       * refuses one, and the two together are the whole of G1242's polarity.
       *
       * ⚠️ **THIS COMMENT READ *"`onboarding_record` carries no append-only
       * trigger, so the admin may repair it and the control arm below is
       * reachable"* UNTIL 21 Sep 2026, AND THE FIRST CLAUSE WENT FALSE.**
       * `db/migrations-control/0040_onboarding_writer.sql` gives that table an
       * ADVANCE-ONLY trigger (G1423), because R9 granted a serving role
       * `UPDATE (completed_steps)` and *"a prefix length never shrinks"* had
       * until then been a property of there being no writer at all.
       *
       * 🛑 **SO THE REPAIR BELOW IS A DELETE-AND-INSERT AND NOT AN `UPDATE`,
       * AND THAT IS THE TRIGGER DOING ITS JOB AGAINST THIS FIXTURE RATHER THAN
       * AN INCONVENIENCE TO ROUTE AROUND.** Witnessed before it was changed:
       * the old restore answered `ERROR: public.onboarding_record ADVANCES
       * ONLY: 99 -> 1 is a decrement`, which is exactly the statement the
       * trigger exists to refuse — issued here by the ADMIN, which is the half
       * a withheld grant could never have covered.
       *
       * ⚠️ **THE CONTROL ARM IS STILL REACHABLE AND THAT IS WHAT MATTERS**:
       * the trigger fires on `UPDATE` only, so a row removed and written again
       * is a new row rather than a shrinking one. **Do not "simplify" this
       * back into an `UPDATE`** — it will be refused, and the §5.6 guard below
       * is what would go red.
       */
      await admin.query(
        `UPDATE ${RECORD} SET completed_steps = $1 WHERE tenant_id = 'ten_ghost'`,
        [ONBOARDING_STEPS.length + 93],
      )
      const refused = await readConsoleRoster(pair.client, AZG)
      assert.equal(
        refused.ok,
        false,
        'a count past the end of the sequence was published as a stage. `0030` writes NO ' +
          'upper-bound `CHECK` deliberately — it would be a third copy of ' +
          '`ONBOARDING_STEPS.length` that G88 then freezes — so the refusal is the READER`S ' +
          'and this is where it is witnessed. Without it, `0030``s missing bound is not a ' +
          'polarity, it is a hole.',
      )
      if (!refused.ok) {
        assert.equal(refused.refusal, CONSOLE_ROSTER_REFUSALS.completedCountUnreadable)
        assert.equal(refused.tenantId, 'ten_ghost')
      }
      await admin.query(`DELETE FROM ${RECORD} WHERE tenant_id = 'ten_ghost'`)
      await admin.query(`INSERT INTO ${RECORD} (tenant_id, completed_steps) VALUES ('ten_ghost', 1)`)
      const ok = await readConsoleRoster(pair.client, AZG)
      assert.equal(ok.ok, true, 'the read is still refused after the count was repaired — §5.6')
    } finally {
      await admin.end()
    }
  })

  it('7c · an unrecognised `step` refuses the whole read rather than DROPPING the mark', async () => {
    /**
     * 🛑 A REFUSAL AND NEVER A SKIP, AND THE DIFFERENCE IS THE WHOLE VALUE OF
     * THE ROW. A reader that merely failed to match an unknown key would DROP
     * the forced mark and publish the tenant as ordinarily `done` — **silently
     * losing the only record of why the sequence was broken**, which is the
     * exact harm §2's trigger exists to prevent, arriving through the READ
     * instead of through a write.
     *
     * ⚠️ THIS IS THE LAST ASSERTION IN THE FILE AND MUST STAY LAST: the row it
     * writes cannot be updated, deleted or truncated by anybody, so every read
     * after it is refused for ever. The suite drops its own database at `before`
     * for exactly this reason.
     */
    assert.ok(pair !== undefined, 'no internal pair')
    const admin = await adminOn(CONTROL_DB)
    try {
      const steps: readonly string[] = ONBOARDING_STEPS
      assert.ok(
        !steps.includes('not_a_step'),
        'the fixture value is a real step, so this assertion would test nothing',
      )
      await admin.query(
        `INSERT INTO ${FORCED} (tenant_id, step, reason)
         VALUES ('ten_ghost', 'not_a_step', 'A vocabulary nobody declared.')`,
      )
      const refused = await readConsoleRoster(pair.client, AZG)
      assert.equal(
        refused.ok,
        false,
        'an unrecognised forced step was read past. The mark is *"PERMANENT, AND THE ONLY ' +
          'RECORD OF WHY THE SEQUENCE WAS BROKEN"* — dropping it through a failed key match ' +
          'destroys it just as surely as an `UPDATE` would, and leaves the tenant looking ' +
          'ordinarily done.',
      )
      if (!refused.ok) {
        assert.equal(refused.refusal, CONSOLE_ROSTER_REFUSALS.forcedStepUnreadable)
        assert.equal(refused.tenantId, 'ten_ghost')
      }
    } finally {
      await admin.end()
    }
  })
})
