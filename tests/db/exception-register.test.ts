/**
 * THE EXCEPTION REGISTER, OVER A REAL POSTGRESQL. G357, G358, G359 —
 * 19 Sep 2026.
 *
 * ┌─ WHY THIS FILE EXISTS BESIDE `tests/http/exception-served.test.ts` ────────┐
 * │ Four of C6's five operations ARE mounted, so unlike                        │
 * │ `payload-and-subject-index.test.ts` this is not the only witness. It is    │
 * │ the one that can reach what a route cannot:                                │
 * │                                                                            │
 * │   · the DATABASE's refusal of a write the app role has no privilege for,   │
 * │     which is `GRANT UPDATE (assigned_to)` and is invisible from HTTP       │
 * │     because no mounted handler tries the forbidden column;                 │
 * │   · the RLS negative control — policy DISABLED, then DROPPED — which needs │
 * │     the migrator and must never be reachable from a plane;                 │
 * │   · ⚠️ THIS READ *"the columns of an operation that is NOT mounted        │
 * │     (`reverseResolution`), which is `0007`'s precedent"* until 20 Sep     │
 * │     2026, when G946–G950 mounted it. The reversal columns now HAVE a     │
 * │     route, and `tests/http/proposal-chain-served.test.ts` §10 proves the │
 * │     round trip over a socket. **This suite still owns the three columns  │
 * │     `db/migrations/0140` §2 adds, which no route publishes** — they are  │
 * │     a storage pin read only by `getDispositionMix` — so `0007`'s         │
 * │     precedent survives, narrowed to them.                                │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT IS ASSERTED, AND WHICH CONTROL EACH ONE IS ──────────────────────────┐
 * │ 1  NO STATEMENT THE STORE ISSUES CARRIES A TENANT PREDICATE, by scanning   │
 * │    the module's own source.                                     INVARIANT 1│
 * │ 2  The app role UPDATEs `assigned_to` and the DATABASE refuses every other │
 * │    column — severity, status, value, explanation, cost centre. G358        │
 * │ 2b No INSERT and no DELETE on `tenant.exception` at any price.   G358      │
 * │ 3  Another tenant's exception, BY ITS EXACT ID, is invisible — and the     │
 * │    NEGATIVE CONTROLS: with RLS disabled the same read LEAKS, and with the  │
 * │    policy dropped it FAILS CLOSED.                       INVARIANT 1 · G100│
 * │ 4  A resolution round-trips through the flat wire shape.  G357 · 0007's    │
 * │    precedent (columns proven by a test, not by a route)                    │
 * │ 5  A reversal round-trips and `indictsAutonomy` is DERIVED by the model's  │
 * │    own function rather than stored.                                        │
 * │ 6  THREE MODEL FIELDS HAVE NO COLUMN — `approvedBy`, `executedBy`,         │
 * │    `policyEvaluationId` — so a later commit adding one meets a red.  G357  │
 * │ 7  The keyset pages every row EXACTLY ONCE under all four orderings, and   │
 * │    an unvalued row sorts LAST rather than first.                    G357   │
 * │ 8  A cursor issued under one ordering is REFUSED under another rather than │
 * │    silently skipping rows.                                          G357   │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 🛑 EVERY CONTROL HERE WAS WITNESSED RED BY MUTATION, AND THE MUTATIONS AND │
 * │ THEIR EXACT FAILURE TEXT ARE IN THE PULL REQUEST. §5.6 — *a control that    │
 * │ passes while asserting nothing* — is this repository's most-committed       │
 * │ defect, and a control nobody probed is a control nobody has.                │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import {
  assignExceptionTo,
  readException,
  readExceptionFacets,
  readExceptionQueuePage,
  encodeExceptionCursor,
} from '../../server/data-plane/exception-store.ts'
import { EXCEPTION_SORTS, type ExceptionSort } from '../../server/data-plane/exception-vocabulary.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE. Set before the first call that reads it.
 *
 * 🛑 NOT HYGIENE — THE FIX FOR A NAMED FLAKE, and `docs/build/deploy-handoff.md`
 * §8 records it costing two agents an hour: `tests/db/` suites use FIXED
 * database names against the shared local PostgreSQL, so two files sharing one
 * name race inside `applyMigrations()`. `db/env.ts` resolves `RECONCILE_DB_NAME`
 * per call and never at import, so setting it here — above `probeDatabase()` —
 * is the only placement that works.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_EXCEPTION_DB_NAME'] ?? runScopedName('reconcile_exception_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

const GLOBEX_EXC = 'exc_globex_0001'

/**
 * SIX ACME rows, and every shape in them is load-bearing for one assertion.
 *
 *   `exc_acme_0001`  critical, 90 000 minor SGD, assigned, resolved+reversed.
 *   `exc_acme_0002`  critical, 12 000 minor SGD, unassigned.
 *   `exc_acme_0003`  high,      50 000 minor SGD.
 *   `exc_acme_0004`  high,      NO VALUE AT ALL — the row assertion 7 is about.
 *                    *"A non-monetary finding is not below the threshold, it is
 *                    outside the question."* A KYC or medical-records tenant has
 *                    mostly these, so a `NULLS FIRST` default would put the half
 *                    of the register with no money at the top of a value sort.
 *   `exc_acme_0005`  medium,    1 000 minor JPY — a SECOND CURRENCY, so the
 *                    mixed-currency sort defect the migration names is present
 *                    in the fixture rather than theoretical.
 *   `exc_acme_0006`  low,       NO VALUE, carried forward from 0002.
 */
interface Seed {
  readonly id: string
  readonly severity: string
  readonly rank: number
  readonly currency: string | null
  readonly minor: string | null
  readonly exponent: number | null
  readonly status: string
  readonly assignedTo: string | null
  readonly carriedFrom: string | null
  readonly domain: string
  readonly ruleLabel: string
}

const ACME_ROWS: readonly Seed[] = [
  { id: 'exc_acme_0001', severity: 'critical', rank: 0, currency: 'SGD', minor: '90000', exponent: 2, status: 'resolved', assignedTo: 'usr_ops_mei', carriedFrom: null, domain: 'finance', ruleLabel: 'Three-way match', },
  { id: 'exc_acme_0002', severity: 'critical', rank: 0, currency: 'SGD', minor: '12000', exponent: 2, status: 'open', assignedTo: null, carriedFrom: null, domain: 'finance', ruleLabel: 'Three-way match', },
  { id: 'exc_acme_0003', severity: 'high', rank: 1, currency: 'SGD', minor: '50000', exponent: 2, status: 'open', assignedTo: null, carriedFrom: null, domain: 'finance', ruleLabel: 'Duplicate payment', },
  { id: 'exc_acme_0004', severity: 'high', rank: 1, currency: null, minor: null, exponent: null, status: 'open', assignedTo: null, carriedFrom: null, domain: 'kyc', ruleLabel: 'Name mismatch', },
  { id: 'exc_acme_0005', severity: 'medium', rank: 2, currency: 'JPY', minor: '1000', exponent: 0, status: 'open', assignedTo: null, carriedFrom: null, domain: 'finance', ruleLabel: 'Duplicate payment', },
  { id: 'exc_acme_0006', severity: 'low', rank: 3, currency: null, minor: null, exponent: null, status: 'open', assignedTo: null, carriedFrom: 'exc_acme_0002', domain: 'kyc', ruleLabel: 'Name mismatch', },
]

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

/* 🛑 AT THE TOP LEVEL, OUTSIDE EVERY `describe`. `tests/ci/reachability-guards.test.ts`
   asserts this by AST walk, because a guard inside a skipped suite is never
   registered and `describe(…, {skip})` never invokes its callback. */
databaseRequiredUnderCi('the exception register suite', probe)

/** Every write here is the migrator's. `0015` grants the app role no INSERT. */
async function seed(): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')
    for (const row of ACME_ROWS) {
      await insertException(mig, ACME, row)
    }
    await insertException(mig, GLOBEX, {
      id: GLOBEX_EXC,
      severity: 'critical',
      rank: 0,
      currency: 'SGD',
      minor: '99999',
      exponent: 2,
      status: 'open',
      assignedTo: null,
      carriedFrom: null,
      domain: 'finance',
      ruleLabel: 'Three-way match',
    })

    /* One observed value on 0001, with a DOTTED KEY in its path — the same
       fixture shape `payload-and-subject-index.test.ts` uses, for the same
       reason: a dotted grammar would read `payer.ref` as a nesting and
       *"silently address the WRONG key rather than refusing"*. */
    await mig.query(
      `INSERT INTO tenant.exception_observed_value
         (tenant_id, exception_id, ordinal, slot, path, line_index, source_document_id,
          scalar_kind, scalar_money_currency, scalar_money_minor, scalar_money_exponent,
          provenance_page, provenance_confidence, data_class)
       VALUES ($1, 'exc_acme_0001', 0, 'invoice', $2::jsonb, NULL, 'doc_acme_inv',
               'money', 'SGD', 190000, 2, 3, 0.82, 'internal')`,
      [ACME, JSON.stringify(['invoice', 'payer.ref', 'total'])],
    )

    /* 0001 is RESOLVED and then REVERSED. Both halves exist so assertions 4
       and 5 are about a round trip rather than about two nulls. */
    await mig.query(
      `UPDATE tenant.exception
          SET resolution_mode = 'approved',
              resolution_disposition_key = 'write_off',
              resolution_proposal_id = 'prp_0001',
              resolution_decided_by = 'usr_ops_chen',
              resolution_at = now(),
              delta_kind = 'money',
              delta_money_currency = 'SGD',
              delta_money_minor = 90000,
              delta_money_exponent = 2,
              delta_percentage = 3.5,
              explanation_confidence = 0.91
        WHERE tenant_id = $1 AND id = 'exc_acme_0001'`,
      [ACME],
    )
    await mig.query(
      /* ⚠️ THE LAST THREE COLUMNS ARRIVED WITH `db/migrations/0140` §2 AND ARE
         `NOT NULL`: `reversed_disposition_key`, `reversed_mode` and
         `reversed_at` pin the resolution each reversal undid, because the act
         CLEARS `tenant.exception.resolution_*` and `getDispositionMix` cannot
         count a choice whose only record has been nulled. A fixture that
         omitted them would not insert at all. */
      `INSERT INTO tenant.exception_reversal
         (tenant_id, exception_id, ordinal, at, reversed_by, reason, note, new_status,
          corrected_disposition_key, reversed_disposition_key, reversed_mode, reversed_at)
       VALUES ($1, 'exc_acme_0001', 0, now(), 'usr_ops_chen', 'data_corrected',
               'the vendor reissued the invoice', 'open', NULL,
               'write_off', 'approved', now()),
              ($1, 'exc_acme_0001', 1, now(), 'usr_ops_chen', 'wrong_disposition',
               NULL, 'open', 'dispute',
               'write_off', 'approved', now())`,
      [ACME],
    )
    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

async function insertException(
  mig: { query: (sql: string, values?: unknown[]) => Promise<unknown> },
  tenant: string,
  row: Seed,
): Promise<void> {
  await mig.query(
    `INSERT INTO tenant.exception
       (tenant_id, id, match_group_id, rule_id, rule_version, definition_version,
        line_key, carried_forward_from, domain, definition_id, rule_label,
        severity, severity_rank,
        value_at_risk_currency, value_at_risk_minor, value_at_risk_exponent,
        cost_centre, legal_entity, status, assigned_to, raised_at,
        explanation_summary, explanation_expected)
     VALUES ($1, $2, 'mg_1', 'rul_1', 1, 1,
             NULL, $3, $4, 'def_ap_close', $5,
             $6, $7,
             $8, $9::int8, $10,
             'CC-1100', 'LE-SG', $11, $12, now(),
             'the invoice disagrees with the purchase order',
             'the purchase order')`,
    [
      tenant, row.id, row.carriedFrom, row.domain, row.ruleLabel,
      row.severity, row.rank,
      row.currency, row.minor, row.exponent,
      row.status, row.assignedTo,
    ],
  )
}

describe('the exception register, over a real PostgreSQL', { skip }, () => {
  let pool: TenantPool

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    pool = await createAppPool(1)
  })

  after(async () => {
    await pool?.end()
  })

  /* ---------------------------------------------------------------- *
   * §1 · INVARIANT 1, AS A PROPERTY OF THE SOURCE.
   *
   * "Tenant scope is derived from the session, never read from a request."
   * Copied, not paraphrased. The shape of this assertion is
   * `tests/db/tenant-isolation.test.ts`'s: a leak test that only reads rows
   * cannot tell a correct reader from one that filters in TypeScript, and the
   * one that filters would pass §3 and be wrong the first time somebody
   * forgot a `WHERE`.
   * ---------------------------------------------------------------- */

  it('§1 · no statement the store issues carries a tenant predicate', async () => {
    const source = await readFile(
      fileURLToPath(new URL('../../server/data-plane/exception-store.ts', import.meta.url)),
      'utf8',
    )
    /* Strip comments first: this file argues AT LENGTH about why there is no
       tenant predicate, and a naive scan would match the argument. */
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')

    assert.doesNotMatch(
      code,
      /tenant_id\s*=/,
      'the exception store writes a tenant predicate. Row-level security supplies it; ' +
        'a handler that also filters has two paths and one of them will eventually be wrong.',
    )
    assert.doesNotMatch(
      code,
      /app\.tenant_id/,
      'the exception store reads the tenant GUC directly. `withTenantScope()` is the only ' +
        'thing that may touch it.',
    )
  })

  /* ---------------------------------------------------------------- *
   * §2 · G358 — THE COLUMN-LEVEL GRANT, WITNESSED IN BOTH DIRECTIONS.
   * ---------------------------------------------------------------- */

  it('§2 · the app role may write `assigned_to` and the DATABASE refuses every other column', async () => {
    await withTenantScope(pool, ACME, async (tx) => {
      const read = await assignExceptionTo(tx, 'exc_acme_0002', 'usr_ops_mei')
      assert.equal(read.kind, 'exception')
      if (read.kind !== 'exception') return
      assert.equal(read.exception['assignedTo'], 'usr_ops_mei')
    })

    /* 🛑 THE OTHER DIRECTION IS THE ASSERTION. Without it, §2's first half is
       satisfied by a blanket `GRANT UPDATE` and G358 is a comment. Each of
       these is a column the migration names as a reason for the narrow grant.

       ⚠️ `status` WAS THE SECOND ENTRY IN THIS LIST UNTIL 19 Sep 2026 AND IT IS
          MOVED RATHER THAN DELETED — see §2c, which asserts THE SAME PROPERTY
          through a different mechanism. `db/migrations/0059_resolution_chain.sql`
          grants `UPDATE (status, resolution_*)` because the resolution chain
          writes them, and `0015`'s argument against that grant was
          CONDITIONAL — *"`status` — resolution state, WITH NO RESOLUTION ROW
          AND NO REVERSAL TRAIL"* — on a condition that has changed. **The
          privilege moved; the property did not.** The witnessed red that
          produced this edit was:

            `status` was writable by the app role. … The database said:
            exception status change carries no resolution-chain authorisation
            record: app.authorisation_ref is <unset>

          — the TRIGGER refusing, not the grant permitting. The other five
          reasons `0015` gave are untouched and stay below. */
    const forbidden: readonly [string, string][] = [
      ['severity_rank', '9'],
      ['value_at_risk_minor', '1'],
      ['explanation_summary', "'rewritten'"],
      ['cost_centre', "'CC-9999'"],
      ['tenant_id', `'${GLOBEX}'`],
    ]
    for (const [column, value] of forbidden) {
      await withTenantScope(pool, ACME, async (tx) => {
        await assert.rejects(
          () => tx.query(`UPDATE tenant.exception SET ${column} = ${value} WHERE id = 'exc_acme_0002'`),
          (err: unknown) => {
            const message = err instanceof Error ? err.message : String(err)
            assert.match(
              message,
              /permission denied/i,
              `\`${column}\` was writable by the app role. G358 grants UPDATE on ` +
                '`assigned_to` alone; a blanket grant puts the queue\'s own ordering, its ' +
                'status and its authorisation attributes inside a handler\'s reach. ' +
                `The database said: ${message}`,
            )
            return true
          },
        )
      }).catch((err: unknown) => {
        /* A refused statement aborts the transaction, so `withTenantScope`'s
           COMMIT fails too. The assertion above has already run. */
        const message = err instanceof Error ? err.message : String(err)
        assert.match(message, /permission denied|current transaction is aborted/i, message)
      })
    }
  })

  /* ---------------------------------------------------------------- *
   * §2c · `status` AND THE RESOLUTION COLUMNS — REFUSED BY A TRIGGER RATHER
   *       THAN BY A PRIVILEGE, SINCE `0059`. G659.
   *
   * 🛑 THIS IS §2's PROPERTY AND NOT A NEW ONE. `0015` refused the `status`
   *    grant because *"resolution state, with no resolution row and no
   *    reversal trail — the exact laundering the contract refuses an agent at
   *    `reverseResolution`"*; `0059` takes the grant because the resolution
   *    chain writes it, and restores the property with a `BEFORE UPDATE`
   *    trigger requiring the act to carry an invariant 10 record for one of
   *    the chain's three verbs. ⚠️ **FOUR VERBS SINCE 20 Sep 2026 — `0140`
   *    §4 adds `reverse_resolution`, and ONLY on a write that clears all six
   *    resolution columns.** This section is unaffected: it drives a
   *    transaction carrying NO record at all, which every arm refuses.
   *
   * ⚠️ A POLICY COULD NOT HAVE DONE THIS. A policy's `WITH CHECK` sees the NEW
   *    row and its `USING` sees the OLD one; **neither can see BOTH**, so no
   *    policy can say *"this UPDATE CHANGED `status`"* — only *"this row's
   *    status is now X"*, which is false of every row that already had X.
   * ---------------------------------------------------------------- */

  it('§2c · `status` and the resolution columns are refused without a chain authorisation record', async () => {
    const guarded: readonly [string, string][] = [
      ['status', "'dismissed'"],
      ['resolution_mode', "'manual'"],
      ['resolution_disposition_key', "'write_off'"],
      ['resolution_executed_by', "'usr_forged'"],
      ['resolution_at', 'now()'],
    ]
    for (const [column, value] of guarded) {
      await withTenantScope(pool, ACME, async (tx) => {
        await assert.rejects(
          () =>
            tx.query(`UPDATE tenant.exception SET ${column} = ${value} WHERE id = 'exc_acme_0002'`),
          (err: unknown) => {
            const message = err instanceof Error ? err.message : String(err)
            assert.match(
              message,
              /carries no (execute_resolution|resolution-chain) authorisation record/i,
              `\`${column}\` was written by a transaction carrying NO authorisation record. ` +
                'The trigger `exception_resolution_requires_record` is what keeps `0015`’s ' +
                `property after \`0059\` took the privilege. The database said: ${message}`,
            )
            return true
          },
        )
      }).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        assert.match(message, /authorisation record|current transaction is aborted/i, message)
      })
    }
  })

  it('§2d · the trigger does NOT fire on an assignment, so `assignException` is unaffected', async () => {
    /* 🛑 WHAT THIS CATCHES AND WHAT IT DOES NOT, MEASURED BY MUTATION RATHER
       THAN ASSUMED — and the answer is narrower than the first draft of this
       comment claimed.

         · WIDENING THE `WHEN` CLAUSE ALONE (adding `assigned_to`) — **SURVIVES.**
           The trigger then fires on every assignment, both guards find nothing
           changed, and it returns. It costs an invocation and refuses nothing,
           so it is a PERFORMANCE change and not a control change.
         · WIDENING GUARD 2 ALONE (`IF true THEN`) — **SURVIVES**, because the
           `WHEN` clause keeps the trigger from firing at all.
         · WIDENING BOTH — **RED here and in §2.** That is the realistic defect:
           a later author who decides the guard should cover "any write".

       So the `WHEN` clause and the guard are ONE control with two halves, and
       neither half alone is observable. Recorded rather than overstated. */
    await withTenantScope(pool, ACME, async (tx) => {
      const read = await assignExceptionTo(tx, 'exc_acme_0003', 'usr_ops_vik')
      assert.equal(
        read.kind,
        'exception',
        'assigning a row now requires a resolution-chain record, so the trigger’s `WHEN` ' +
          'clause has widened past the columns `0059` argues for.',
      )
    })
  })

  it('§2b · the app role may not INSERT an exception and may not DELETE one', async () => {
    for (const statement of [
      `INSERT INTO tenant.exception (tenant_id, id, match_group_id, rule_id, rule_version,
         definition_version, domain, definition_id, rule_label, severity, severity_rank,
         status, raised_at, explanation_summary, explanation_expected)
       VALUES ('${ACME}', 'exc_forged', 'mg', 'rul', 1, 1, 'finance', 'def', 'label',
               'critical', 0, 'open', now(), 's', 'e')`,
      `DELETE FROM tenant.exception WHERE id = 'exc_acme_0003'`,
    ]) {
      await withTenantScope(pool, ACME, async (tx) => {
        await assert.rejects(
          () => tx.query(statement),
          (err: unknown) => {
            const message = err instanceof Error ? err.message : String(err)
            assert.match(
              message,
              /permission denied/i,
              'a request path could write or erase a finding. An exception is RAISED BY THE ' +
                'ENGINE; a path that could INSERT one could mint a finding against itself, ' +
                `and a path that could DELETE one could erase it. The database said: ${message}`,
            )
            return true
          },
        )
      }).catch(() => undefined)
    }
  })

  /* ---------------------------------------------------------------- *
   * §3 · INVARIANT 1 AND ITS TWO NEGATIVE CONTROLS.
   * ---------------------------------------------------------------- */

  it("§3 · another tenant's exception, by its exact id, is invisible", async () => {
    await withTenantScope(pool, ACME, async (tx) => {
      const read = await readException(tx, GLOBEX_EXC)
      assert.equal(
        read.kind,
        'not_found',
        "GLOBEX's exception was readable inside ACME's scope. There is no tenant predicate " +
          'in the query, so this is row-level security or it is nothing.',
      )
    })
    await withTenantScope(pool, ACME, async (tx) => {
      const page = await readExceptionQueuePage(tx, {}, {
        cursor: undefined,
        limit: 200,
        sort: EXCEPTION_SORTS.raisedAtAsc,
      })
      assert.equal(page.kind, 'page')
      if (page.kind !== 'page') return
      assert.equal(page.items.length, ACME_ROWS.length, 'the queue returned a foreign row count')
      for (const item of page.items) {
        assert.notEqual(item['exceptionId'], GLOBEX_EXC, "GLOBEX's row reached ACME's queue")
      }
    })
  })

  it('§3b · 🛑 THE CONTROL — with RLS disabled the same read LEAKS, and with the policy dropped it FAILS CLOSED', async () => {
    const mig = await migratorClient()
    try {
      await mig.query('ALTER TABLE tenant.exception DISABLE ROW LEVEL SECURITY')
      await withTenantScope(pool, ACME, async (tx) => {
        const read = await readException(tx, GLOBEX_EXC)
        assert.equal(
          read.kind,
          'exception',
          'with RLS DISABLED the reader still could not see another tenant\'s row — which ' +
            'means §3 is passing for some reason other than row-level security, and would ' +
            'go on passing with the policy gone.',
        )
      })
      await mig.query('ALTER TABLE tenant.exception ENABLE ROW LEVEL SECURITY')

      await mig.query('DROP POLICY exception_rls ON tenant.exception')
      await withTenantScope(pool, ACME, async (tx) => {
        const read = await readException(tx, 'exc_acme_0003')
        assert.equal(
          read.kind,
          'not_found',
          'with the policy DROPPED the table must fail CLOSED — G100 denies on NULL and a ' +
            'FORCEd table with no policy denies outright.',
        )
      })
    } finally {
      await mig
        .query(
          `CREATE POLICY exception_rls ON tenant.exception
             USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
             WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''))`,
        )
        .catch(() => undefined)
      await mig.query('ALTER TABLE tenant.exception ENABLE ROW LEVEL SECURITY').catch(() => undefined)
      await mig.end()
    }
  })

  /* ---------------------------------------------------------------- *
   * §4/§5 · THE COLUMNS OF AN OPERATION NOBODY MOUNTED. `0007`'s precedent.
   * ---------------------------------------------------------------- */

  it('§4 · a resolution round-trips through the flat wire shape', async () => {
    await withTenantScope(pool, ACME, async (tx) => {
      const read = await readException(tx, 'exc_acme_0001')
      assert.equal(read.kind, 'exception')
      if (read.kind !== 'exception') return
      const resolution = read.exception['resolution'] as Record<string, unknown> | null
      assert.notEqual(resolution, null, '`resolution` is `required` on the wire and came back null')
      assert.equal(resolution?.['mode'], 'approved')
      assert.equal(resolution?.['dispositionKey'], 'write_off')
      assert.equal(resolution?.['decidedBy'], 'usr_ops_chen')

      /* The money delta, through the codec. A DECIMAL STRING and never a JSON
         number — G286: *"a JSON number would be read back as an IEEE-754 double
         and silently lose exactness above 2^53."* */
      const delta = read.exception['explanation'] as Record<string, unknown>
      const d = delta['delta'] as Record<string, unknown>
      assert.equal(d['kind'], 'money')
      const absolute = d['absolute'] as Record<string, unknown>
      assert.equal(typeof absolute['amountMinor'], 'string', 'money reached the wire as a number')
      assert.equal(absolute['amountMinor'], '90000')
      assert.equal(absolute['currency'], 'SGD')
      assert.equal(d['fx'], null)
    })
  })

  it('§5 · a reversal round-trips and `indictsAutonomy` is DERIVED, not stored', async () => {
    await withTenantScope(pool, ACME, async (tx) => {
      const read = await readException(tx, 'exc_acme_0001')
      assert.equal(read.kind, 'exception')
      if (read.kind !== 'exception') return
      const reversals = read.exception['reversals'] as Record<string, unknown>[]
      assert.equal(reversals.length, 2, 'reversals accumulate as an array, in order')

      /* 🛑 THE TWO ARE THE VOCABULARY'S LOAD-BEARING DISTINCTION.
         `data_corrected` does NOT indict the autonomy that produced the
         resolution — *"that was the right judgement on what was known at the
         time"* — and `wrong_disposition` does. A store that returned a constant
         here, or read a column, would pass a length assertion and fail this. */
      assert.equal(reversals[0]?.['reason'], 'data_corrected')
      assert.equal(reversals[0]?.['indictsAutonomy'], false)
      assert.equal(reversals[1]?.['reason'], 'wrong_disposition')
      assert.equal(reversals[1]?.['indictsAutonomy'], true)
      assert.equal(reversals[1]?.['correctedDispositionKey'], 'dispute')
    })

    /* The observed value, and its `FieldPath` back through the ONE seam. The
       dotted key must survive as ONE segment. */
    await withTenantScope(pool, ACME, async (tx) => {
      const read = await readException(tx, 'exc_acme_0001')
      if (read.kind !== 'exception') return
      const explanation = read.exception['explanation'] as Record<string, unknown>
      const observed = explanation['observed'] as Record<string, unknown>[]
      assert.equal(observed.length, 1)
      /* 🛑 THE WIRE FORM IS `FieldSegment` OBJECTS AND NOT RAW TOKENS, WHICH IS
         WHERE THE STORED FORM AND THE PUBLISHED FORM DIFFER — see
         `exception-store.ts`'s `pathIn()`. And the KEY CONTAINING A DOT must
         survive as ONE segment: a dotted grammar reads it as a nesting and
         *"silently addresses the WRONG key rather than refusing"*. */
      assert.deepEqual(
        observed[0]?.['path'],
        [
          { kind: 'key', key: 'invoice' },
          { kind: 'key', key: 'payer.ref' },
          { kind: 'key', key: 'total' },
        ],
        'a key containing a dot was split, or the path reached the wire as raw tokens rather ' +
          'than as the `FieldSegment` objects `capability.openapi.yaml` declares.',
      )
      assert.equal(observed[0]?.['dataClass'], 'internal')
    })
  })

  /* ---------------------------------------------------------------- *
   * §6 · THE THREE MODEL FIELDS — NOW A THREE-WAY DIFFERENTIAL AND NOT
   *      THREE ABSENCES. G660, 19 Sep 2026.
   *
   * 🛑 THIS ASSERTION WAS *"`approvedBy`, `executedBy` and
   *    `policyEvaluationId` have NO column"*, AND ITS OWN MESSAGE SAID WHAT TO
   *    DO WHEN IT WENT RED: *"If the contract now does, this assertion is the
   *    place to amend — and amending it is the point, because the model/wire
   *    divergence it records is a real loss."* **The contract now does**, and
   *    this is the amendment. The witnessed red was:
   *
   *      `resolution_executed_by` exists. The rule is `0002_run.sql`'s …
   *      true !== false
   *
   * ⚠️ AMENDED IN THREE DIRECTIONS RATHER THAN DELETED, because two of the
   *    three absences SURVIVE and each survives for its own reason. An
   *    assertion rewritten as "all three are present" would have closed a
   *    tripwire that is still doing work.
   * ---------------------------------------------------------------- */

  it('§6 · `executedBy` has a column; `approvedBy` is DERIVED and `policyEvaluationId` is UNREACHABLE', async () => {
    const mig = await migratorClient()
    try {
      const rows = (
        await mig.query(
          `SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'tenant' AND table_name = 'exception'`,
        )
      ).rows as { column_name: string }[]
      const columns = new Set(rows.map((r) => r.column_name))

      /* 🛑 PRESENT. `ExceptionResolution`'s `approved` and `manual` arms both
         carry `executedBy: UserId` — *"The person who acted. A different fact
         from proposer and from approver"* — and the `manual` arm *"named
         nobody at all"* without it. `executeProposal` is the producer and
         `capability.openapi.yaml` publishes the field. */
      assert.equal(
        columns.has('resolution_executed_by'),
        true,
        '`resolution_executed_by` is gone. `ExceptionResolution.executedBy` is published on ' +
          'the wire since G660, so a row that cannot store it publishes a null for the only ' +
          'human name a `manual` resolution ever carries.',
      )

      /* 🛑 STILL ABSENT, AND DELIBERATELY. The wire GAINED `approvedBy` in the
         same commit and it is DERIVED — `SELECT DISTINCT decided_by FROM
         tenant.approval_decision WHERE decision = 'approved'`. A stored copy
         would be a second answer to a question the decision rows already
         answer, and the two would disagree the first time a decision arrived
         after an execution. Same argument `0015` gives for not storing
         `indicts_autonomy`. */
      assert.equal(
        columns.has('resolution_approved_by'),
        false,
        '`resolution_approved_by` exists. `approvedBy` is DERIVED from ' +
          '`tenant.approval_decision`, which is where the approvals actually happened; a ' +
          'stored copy is `indicts_autonomy` all over again — a second call site that cannot ' +
          'be recompiled.',
      )

      /* 🛑 STILL ABSENT, AND SO IS THE WIRE FIELD. It belongs to
         `mode: 'autonomous'`, which is unreachable here: nothing in this
         repository is an agent proposer, there is no `policy` table and no
         policy evaluation. A column ahead of its writer is `0004`'s refusal;
         a WIRE FIELD ahead of its writer is worse, because it reads as a fact
         that merely happens to be null. */
      assert.equal(
        columns.has('resolution_policy_evaluation_id'),
        false,
        '`resolution_policy_evaluation_id` exists. It belongs to the `autonomous` arm, and ' +
          'no request path in this repository can reach that arm — no agent proposer, no ' +
          '`policy` table, no policy evaluation. If one now can, the WIRE field lands in the ' +
          'same commit as the column and this assertion is the place to amend.',
      )

      /* And the one that was published all along, so this stays a differential
         rather than a claim about the table's size. */
      assert.equal(columns.has('resolution_decided_by'), true)
    } finally {
      await mig.end()
    }
  })

  /* ---------------------------------------------------------------- *
   * §7 · THE KEYSET PAGES EVERY ROW EXACTLY ONCE, UNDER ALL FOUR ORDERINGS.
   * ---------------------------------------------------------------- */

  it('§7 · every ordering pages the whole register exactly once, and an unvalued row sorts LAST', async () => {
    for (const sort of Object.values(EXCEPTION_SORTS)) {
      const seen: string[] = []
      let cursor: string | undefined
      for (let page = 0; page < 20; page += 1) {
        const read = await withTenantScope(pool, ACME, (tx) =>
          readExceptionQueuePage(tx, {}, { cursor, limit: 2, sort }),
        )
        assert.equal(read.kind, 'page', `${sort} refused its own cursor`)
        if (read.kind !== 'page') return
        for (const item of read.items) seen.push(item['exceptionId'] as string)
        if (read.nextCursor === null) break
        cursor = read.nextCursor
      }
      assert.deepEqual(
        [...seen].sort(),
        ACME_ROWS.map((r) => r.id).sort(),
        `\`${sort}\` did not page every row exactly once. Paged: ${seen.join(', ')}. ` +
          'A keyset that skips or repeats at a page boundary shows an arbitrary subset of a ' +
          "tenant's register WHILE LOOKING COMPLETE.",
      )
      assert.equal(new Set(seen).size, seen.length, `\`${sort}\` returned a row twice`)
    }
  })

  it('§7b · 🛑 `DESC NULLS LAST` — the unvalued rows are at the END of a value sort, not the start', async () => {
    const read = await withTenantScope(pool, ACME, (tx) =>
      readExceptionQueuePage(tx, {}, {
        cursor: undefined,
        limit: 200,
        sort: EXCEPTION_SORTS.valueAtRiskDesc,
      }),
    )
    assert.equal(read.kind, 'page')
    if (read.kind !== 'page') return
    const ids = read.items.map((i) => i['exceptionId'])
    assert.deepEqual(
      ids.slice(0, 4),
      ['exc_acme_0001', 'exc_acme_0003', 'exc_acme_0002', 'exc_acme_0005'],
      'the valued rows are not in descending order of minor units',
    )
    assert.deepEqual(
      ids.slice(4).sort(),
      ['exc_acme_0004', 'exc_acme_0006'],
      "PostgreSQL's default for `DESC` is `NULLS FIRST`, which would put every NON-MONETARY " +
        'finding above every valued one — and a KYC or medical-records tenant has mostly ' +
        'those. Both the index and the ORDER BY must spell `DESC NULLS LAST`.',
    )
  })

  /* ---------------------------------------------------------------- *
   * §8 · A CURSOR IS A POSITION IN ONE ORDERING.
   * ---------------------------------------------------------------- */

  it('§8 · a cursor issued under one ordering is REFUSED under another', async () => {
    const first = await withTenantScope(pool, ACME, (tx) =>
      readExceptionQueuePage(tx, {}, {
        cursor: undefined,
        limit: 2,
        sort: EXCEPTION_SORTS.severityThenValue,
      }),
    )
    assert.equal(first.kind, 'page')
    if (first.kind !== 'page' || first.nextCursor === null) {
      assert.fail('the fixture must produce more than one page for this control to mean anything')
      return
    }

    const crossed = await withTenantScope(pool, ACME, (tx) =>
      readExceptionQueuePage(tx, {}, {
        cursor: first.nextCursor ?? undefined,
        limit: 2,
        sort: EXCEPTION_SORTS.raisedAtDesc,
      }),
    )
    assert.equal(
      crossed.kind,
      'bad_cursor',
      'a cursor from `severity_then_value` was honoured under `raised_at_desc`. A keyset is a ' +
        'POSITION IN AN ORDERING; applied to another it silently SKIPS rows, and the page it ' +
        'returns is neither empty nor wrong-looking.',
    )
  })

  it('§8b · a forged or malformed cursor is refused rather than defaulted to the first page', async () => {
    for (const cursor of [
      'not-base64url-at-all!!',
      Buffer.from('{"sort":"raised_at_desc"}', 'utf8').toString('base64url'),
      Buffer.from('[]', 'utf8').toString('base64url'),
      encodeExceptionCursor({
        sort: 'raised_at_desc' as ExceptionSort,
        rank: null,
        minor: 'not-a-number',
        raisedAt: null,
        id: 'x',
      }),
    ]) {
      const read = await withTenantScope(pool, ACME, (tx) =>
        readExceptionQueuePage(tx, {}, {
          cursor,
          limit: 2,
          sort: EXCEPTION_SORTS.raisedAtDesc,
        }),
      )
      assert.equal(
        read.kind,
        'bad_cursor',
        `the cursor \`${cursor}\` was accepted. A cursor that silently becomes "page one" ` +
          'makes a paging client loop forever over the same rows.',
      )
    }
  })

  /* ---------------------------------------------------------------- *
   * §9 · THE FACETS, AND THE FILTERS THEY DESCRIBE.
   * ---------------------------------------------------------------- */

  it('§9 · facets group over the denormalised columns and respect row-level security', async () => {
    const read = await withTenantScope(pool, ACME, (tx) => readExceptionFacets(tx, undefined))
    assert.equal(read.kind, 'facets')
    if (read.kind !== 'facets') return

    const domains = read.facets['domains'] as { value: string; count: number }[]
    const byValue = new Map(domains.map((d) => [d.value, d.count]))
    assert.equal(byValue.get('finance'), 4)
    assert.equal(byValue.get('kyc'), 2)
    assert.equal(
      [...byValue.values()].reduce((a, b) => a + b, 0),
      ACME_ROWS.length,
      "the facet counts sum to a number that is not this tenant's row count — GLOBEX's row " +
        'reached the aggregate.',
    )

    const severities = read.facets['severities'] as { value: string }[]
    assert.equal(severities.length, 4, 'four severities are present in the fixture')
  })

  it('§9b · a value threshold is scoped to its currency, and unvalued rows are outside the question', async () => {
    const read = await withTenantScope(pool, ACME, (tx) =>
      readExceptionQueuePage(
        tx,
        { valueAtRiskAtLeastMinor: '1000', currency: 'SGD' },
        { cursor: undefined, limit: 200, sort: EXCEPTION_SORTS.valueAtRiskDesc },
      ),
    )
    assert.equal(read.kind, 'page')
    if (read.kind !== 'page') return
    const ids = read.items.map((i) => i['exceptionId']).sort()
    assert.deepEqual(
      ids,
      ['exc_acme_0001', 'exc_acme_0002', 'exc_acme_0003'],
      'the JPY row (1000 minor, exponent 0) reached an SGD threshold, or an unvalued row did. ' +
        '*"A bare number threshold across mixed currencies reproduces that defect in the ' +
        'filter instead of the rule"*, and *"a non-monetary finding is not below the ' +
        'threshold, it is outside the question."*',
    )
  })
})
