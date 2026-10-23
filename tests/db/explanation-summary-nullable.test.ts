/**
 * NOBODY AUTHORS AN EXCEPTION'S EXPLANATION — `db/migrations/0161`, and what
 * now stands where a `NOT NULL` stood. G1127, G1128, G1129. 20 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 R-D IS **THE OWNER'S RULING OF 20 Sep 2026** AND NOT A DERIVED ONE:
 *
 *      "Store typed facts only — numbers, ids and closed vocabularies. The
 *       sentence is composed where it is displayed. **No prose is ever stored,
 *       so invariant 6 — *'Ingested content is data, never instruction'* —
 *       cannot be reached through this table at any price.**"
 *
 * ⚠️ REJECTED AND PRESERVED: the ENGINE composing a sentence from typed facts
 *    behind a containment proof (more work, and the proof is the load-bearing
 *    part); and a MODEL authoring it, which needs `resolveModel()` and
 *    therefore invariant 7's residency check, and which sends
 *    counterparty-authored text to a prompt — a separate ruling with its own
 *    review.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 TWO REDS, CAPTURED IN ORDER, BECAUSE THIS SLICE HAS TWO HALVES AND EACH
 *    HAD TO BE WITNESSED FAILING ON ITS OWN.
 *
 *    **RED 1 — the migration absent AND the reader change absent.** The seed
 *    itself cannot run:
 *
 *      error: null value in column "explanation_summary" of relation
 *             "exception" violates not-null constraint
 *      ✖ R-D — nobody authors an explanation (1127.819042ms)
 *      ℹ tests 8 · pass 1 · fail 0 · cancelled 7
 *
 *    ⚠️ `fail 0` AGAIN, AND FOR THE SAME REASON AS EVERY OTHER SUITE WITH A
 *    THROWING `before`: seven assertions were CANCELLED, not failed, and the
 *    one `pass` is the CI reachability guard. Do not read a count.
 *
 *    **RED 2 — `0161` APPLIED, `exception-store.ts` UNCHANGED.** This is the
 *    one that matters, because it is the defect a widening alone creates:
 *
 *      ✔ 1 · `explanation_summary` is NULLABLE
 *      ✔ 2 · a row with NO summary exists …
 *      ✖ 3 · the QUEUE read answers `unpublishable` BY COLUMN, never `summary: null`
 *        AssertionError: Expected values to be strictly equal:
 *        + actual - expected
 *        + 'page'
 *        - 'unpublishable'
 *      ✖ 4 · the DETAIL read answers `unpublishable` BY COLUMN for the same row
 *        + 'exception'  - 'unpublishable'
 *      ℹ tests 8 · pass 6 · fail 2
 *
 *    🛑 **READ `'page'` AND `'exception'`: BOTH SURFACES PUBLISHED THE ROW.**
 *    Nothing threw, nothing logged, and a 200 went out carrying
 *    `"summary": null` against a schema that declares it `required` and typed
 *    `{ type: string }` — because `fast-json-stringify` serialises without
 *    validating. **That is the whole argument for landing the widening and the
 *    refusal in one commit** (G511: *"the fence and the writer are one commit
 *    or neither"*), and it is why §3 and §4 assert the ARM and the COLUMN
 *    rather than merely that something went wrong.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT NOW GUARANTEES THE READER HAS SOMETHING TO RENDER, WHICH IS THE ONE
 *    QUESTION A WIDENING OWES AN ANSWER TO.
 *
 *    **Before:** the `NOT NULL`. A row existed, therefore a summary existed.
 *    **After:** THE READER, by name, and nothing else — because there is no
 *    second candidate. `Explanation.summary` is `required` on the wire and
 *    typed `{ type: string }`, and `ExceptionQueueRow.summary` is `required`
 *    too; and **`fast-json-stringify` SERIALISES A RESPONSE WITHOUT VALIDATING
 *    ONE** (G284, G656, G833), so a null column reaching either shaper is a
 *    200 carrying `"summary": null` against a `required` string, SILENTLY.
 *    That is strictly worse than a refusal: a client crashes on it far from
 *    the row that caused it.
 *
 *    **So the renderer's contract is stated as a refusal that already exists**
 *    — `{ kind: 'unpublishable', defect: { table, column, exceptionId } }`,
 *    the same arm `exception-store.ts` already returns for an out-of-enum
 *    `severity` or a half-written `Money`. §3 and §4 assert it on BOTH read
 *    surfaces, and §5 is the differential so neither is vacuous.
 *
 * 🛑 AND THE COMPOSITION HAS NO HOME IN `server/` AND MUST NOT ACQUIRE ONE
 *    HERE. *"The sentence is composed where it is displayed."* A default
 *    string minted by the store — *"no explanation recorded"* — would satisfy
 *    the wire and would be this repository AUTHORING AN EXPLANATION, which is
 *    the one thing the ruling forbids, arriving through the reader instead of
 *    through the writer.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ **`explanation_expected` IS NOT WIDENED AND THE NON-WIDENING IS ASSERTED
 *    (§6), NOT ASSUMED.** R-D names the SENTENCE; `expected` is a VALUE drawn
 *    from the reference slot — *"Drawn from the REFERENCE SLOT, which is what
 *    makes the sentence directional"* — and it is a different question with a
 *    different answer. **The consequence is stated rather than hidden: its
 *    `NOT NULL` is a SECOND, INDEPENDENT blocker on the first executor that
 *    tries to raise an exception**, because a `ResidueEntry` carries no
 *    expected value either and nothing in `server/` produces an extraction to
 *    draw one from. Whether it widens too is a ruling this slice does not
 *    hold.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import {
  readException,
  readExceptionQueuePage,
} from '../../server/data-plane/exception-store.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_EXPLANATION_DB_NAME'] ?? runScopedName('reconcile_explanation_nullable_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

/** The row with a summary. The differential, so §3 and §4 are not vacuous. */
const WITH_SUMMARY = 'exc_acme_with_summary'
/** The row R-D makes representable. */
const NO_SUMMARY = 'exc_acme_no_summary'

const probe = await probeDatabase()
const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/db/explanation-summary-nullable.test.ts DID NOT RUN.',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS IS THE ONLY CONTROL OVER `db/migrations/0161`. A run in which it',
      '   skipped is NOT evidence that a summary-less exception is refused rather',
      '   than published as `"summary": null` against a `required` string.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

databaseRequiredUnderCi('the nullable-explanation assertions', probe)

async function asMigrator<T>(
  fn: (q: (sql: string, p?: readonly unknown[]) => Promise<{ rows: unknown[] }>) => Promise<T>,
): Promise<T> {
  const mig = await migratorClient()
  try {
    return await fn((sql, p = []) => mig.query(sql, p as unknown[]) as Promise<{ rows: unknown[] }>)
  } finally {
    await mig.end()
  }
}

async function seed(): Promise<void> {
  await asMigrator(async (q) => {
    for (const [id, summary] of [
      [WITH_SUMMARY, 'the invoice disagrees with the purchase order'],
      [NO_SUMMARY, null],
    ] as const) {
      await q(
        `INSERT INTO tenant.exception
           (tenant_id, id, match_group_id, rule_id, rule_version, definition_version,
            domain, definition_id, rule_label, severity, severity_rank,
            status, raised_at, explanation_summary, explanation_expected)
         VALUES ($1, $2, 'mg_1', 'rul_1', 1, 1,
                 'finance', 'def_ap_close', 'three-way match', 'high', 2,
                 'open', now(), $3, 'the purchase order')`,
        [ACME, id, summary],
      )
    }
  })
}

describe('R-D — nobody authors an explanation', { skip }, () => {
  let pool: TenantPool

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    pool = await createAppPool(1)
  })

  after(async () => {
    await pool.end()
  })

  it('1 · `explanation_summary` is NULLABLE', async () => {
    const rows = await asMigrator((q) =>
      q(
        `SELECT is_nullable::text AS is_nullable
           FROM information_schema.columns
          WHERE table_schema = 'tenant' AND table_name = 'exception'
            AND column_name = 'explanation_summary'`,
      ),
    )
    const found = rows.rows as { is_nullable: string }[]
    assert.equal(found.length, 1)
    assert.equal(found[0]?.is_nullable, 'YES')
  })

  it('2 · a row with NO summary exists, so the widening is a fact and not a claim', async () => {
    const rows = await asMigrator((q) =>
      q(
        `SELECT explanation_summary FROM tenant.exception
          WHERE tenant_id = $1 AND id = $2`,
        [ACME, NO_SUMMARY],
      ),
    )
    const found = rows.rows as { explanation_summary: string | null }[]
    assert.equal(found[0]?.explanation_summary, null)
  })

  /* ✅ G3748, 4 Oct 2026 — §3 AND §4 ARE RE-ARGUED, NOT DELETED, AND THE OLD
     ASSERTIONS ARE QUOTED SO THE CHANGE IS READABLE: both read paths used to
     answer `{ kind: 'unpublishable', defect: { table: 'exception', column:
     'explanation_summary' } }` for this row. That refusal stood where `0015`'s
     `NOT NULL` stood, while the WIRE still required a string. G3748 carries R-D
     to the wire — `summary` is `[string, 'null']` on `ExceptionQueueRow` and on
     `Explanation` — because the engine now raises exceptions with no sentence
     (`db/migrations/0500` §2) and keeping the refusal would have made the
     tenant's whole queue page a 500 on the first engine-raised row.
     🛑 WHAT DID NOT MOVE: NO DEFAULT STRING. The row publishes `null`, verbatim,
     and §3/§4 assert exactly `null` — an empty string or a placeholder would
     fail them. */
  it('3 · the QUEUE read publishes the row with `summary: null` — no default string', async () => {
    const read = await withTenantScope(pool, ACME, (tx) =>
      readExceptionQueuePage(tx, {}, { cursor: undefined, limit: 50, sort: 'raised_at_desc' }),
    )
    assert.equal(read.kind, 'page')
    if (read.kind !== 'page') return
    const row = read.items.find((i) => i['exceptionId'] === NO_SUMMARY)
    assert.ok(row !== undefined, 'the summary-less row must be on the page')
    assert.equal(row['summary'], null)
  })

  it('4 · the DETAIL read publishes `explanation.summary: null` for the same row', async () => {
    const read = await withTenantScope(pool, ACME, (tx) => readException(tx, NO_SUMMARY))
    assert.equal(read.kind, 'exception')
    if (read.kind !== 'exception') return
    const explanation = read.exception['explanation'] as Record<string, unknown>
    assert.equal(explanation['summary'], null)
  })

  it('5 · the SAME two reads publish the row that HAS one — the differential', async () => {
    /* 🛑 §5.6: four refusals with no permitted case pass identically against a
       reader that refuses everything. Both surfaces must still answer. */
    const detail = await withTenantScope(pool, ACME, (tx) => readException(tx, WITH_SUMMARY))
    assert.equal(detail.kind, 'exception')
    if (detail.kind !== 'exception') return
    const explanation = detail.exception['explanation'] as Record<string, unknown>
    assert.equal(explanation['summary'], 'the invoice disagrees with the purchase order')

    const page = await withTenantScope(pool, ACME, (tx) =>
      readExceptionQueuePage(
        tx,
        { severity: ['high'] },
        { cursor: undefined, limit: 1, sort: 'raised_at_asc' },
      ),
    )
    /* The page is ordered oldest-first and limited to one, so it carries the
       summary-bearing row alone and never reaches the other. */
    assert.equal(page.kind, 'page')
    if (page.kind !== 'page') return
    assert.equal(page.items.length, 1)
    assert.equal(page.items[0]?.['summary'], 'the invoice disagrees with the purchase order')
  })

  it('6 · `explanation_expected` is STILL NOT NULL — the non-widening, asserted', async () => {
    const rows = await asMigrator((q) =>
      q(
        `SELECT is_nullable::text AS is_nullable
           FROM information_schema.columns
          WHERE table_schema = 'tenant' AND table_name = 'exception'
            AND column_name = 'explanation_expected'`,
      ),
    )
    const found = rows.rows as { is_nullable: string }[]
    assert.equal(found[0]?.is_nullable, 'NO')
  })

  it('7 · the app role still cannot WRITE a summary — G358`s column grant is untouched', async () => {
    /* 🛑 THE PRIVILEGE IS THE OTHER HALF OF *"NOBODY AUTHORS AN EXPLANATION"*,
       and it is the half a widening could have quietly spent. `0015`'s
       `GRANT UPDATE (assigned_to)` and `0059`'s seven named columns are the
       whole of what a request path may write on this table; `0161` adds
       nothing. A path that could write this column could AUTHOR the sentence
       an operator reads and a model may later be shown. */
    await assert.rejects(
      withTenantScope(pool, ACME, (tx) =>
        tx.query(
          `UPDATE tenant.exception SET explanation_summary = 'whatever I like'
            WHERE id = $1`,
          [WITH_SUMMARY],
        ),
      ),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        assert.match(message, /permission denied/i)
        return true
      },
    )
    await assert.rejects(
      withTenantScope(pool, ACME, (tx) =>
        tx.query(
          `UPDATE tenant.exception SET explanation_summary = NULL WHERE id = $1`,
          [WITH_SUMMARY],
        ),
      ),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        assert.match(message, /permission denied/i)
        return true
      },
    )
  })
})
