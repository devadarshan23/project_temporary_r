/**
 * THE CLOSE SURFACE'S THREE QUIET FIGURES, DERIVED — G3541 · G3542, 3 Oct 2026.
 *
 * C1 draws `Matched` and `In variance` on the arrival and a `Variance SGD`
 * column on the register. All three were drawn quiet (`Coming soon`) because
 * nothing served them (G3444). Each is now DERIVED from data the engine and the
 * register already persist, and served on an operation that already exists:
 *
 *   Matched / In variance  `getRunAccount` → `settlementTallies`, read off
 *                          `run_admission_rate` and `run_residue` (0007).
 *   Variance (per line)    `listExceptions` → `ExceptionQueueRow.variance`,
 *                          off `tenant.exception`'s money delta (0015) — the
 *                          value `getException` already publishes.
 *
 * WITNESSED RED FIRST, and each red is named on the assertion it produced:
 *
 *   §1  the THREE pinned key-set controls went RED the moment the channel was
 *       added — `engine-read-wire` F4 (the contract's required list),
 *       `run-engine-account` §1 and `run-account-served` §1 (the served body's
 *       keys) — and were swept by name rather than loosened, as `meterFacts`
 *       and `searchBoundary` were before it.
 *   §2  with the `addMoney()` fold replaced by a currency-blind bigint sum,
 *       §2 published `{kind:'total'}` for SGD + USD — a conversion nobody
 *       performed. RED.
 *   §3  with `if (matched < 0)` deleted, §3 published `matched: -1`. RED.
 *   §4  with `if (row.delta_fx_from !== null) return null` deleted, §4b
 *       published the FX-converted delta in the column the register totals. RED.
 *
 * ⚠️ WHAT THIS DOES NOT PROVE: which SIDE the arrival draws. The wire publishes
 *    both; `frontend/src/Shell.tsx` draws `left` and says why (G3543).
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import {
  persistRunEngineAccount,
  readRunEngineAccount,
} from '../../server/data-plane/run-account-store.ts'
import { readExceptionQueuePage } from '../../server/data-plane/exception-store.ts'
import { EXCEPTION_SORTS } from '../../server/data-plane/exception-vocabulary.ts'
import { terminalRunStatus } from '../../model/reconciliation.ts'
import type {
  AdmittedItem,
  ItemRef,
  ResidueEntry,
  SetReconciliationResult,
} from '../../model/reconciliation.ts'
import type { SourceDocumentId } from '../../model/kernel.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_CLOSE_FIGURES_DB_NAME'] ?? runScopedName('reconcile_close_figures_test')

const probe = await probeDatabase()
const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the Close surface figures derived from the engine account', probe)

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

const RUN_ONE_UNIT = 'run_fig_one_unit'
const RUN_MIXED = 'run_fig_mixed'
const RUN_BROKEN = 'run_fig_broken'

const NO_ITEMS: ReadonlyMap<string, AdmittedItem> = new Map()

function ref(id: string, lineIndex: number | null): ItemRef {
  return { sourceDocumentId: id as SourceDocumentId, lineIndex }
}

function sgd(minor: bigint): { currency: string; amountMinor: bigint; exponent: number } {
  return { currency: 'SGD', amountMinor: minor, exponent: 2 }
}

function result(
  left: { admitted: number; refused: number },
  right: { admitted: number; refused: number },
  residue: ResidueEntry[],
): SetReconciliationResult {
  return {
    state: { items: NO_ITEMS, allocations: [] },
    admissionRates: [
      { side: 'left', presented: left.admitted + left.refused, ...left },
      { side: 'right', presented: right.admitted + right.refused, ...right },
    ],
    documentAccounts: [],
    refusedAtAdmission: [],
    ambiguities: [],
    searchBoundary: { oversizedBuckets: [], exhaustedSearches: [], oversizedAmountBuckets: [] },
    readerRequests: [],
    toleranceRefusals: [],
    toleranceDeclines: [],
    meterFacts: [],
    postconditions: [],
    completeness: [],
    residue,
  }
}

const open = (side: 'left' | 'right', line: number, residual: ReturnType<typeof sgd>): ResidueEntry => ({
  side,
  ref: ref(`doc_${side}`, line),
  settlement: { kind: 'unallocated', residual },
  disposition: 'unidentified',
  cause: { kind: 'no_strategy_paired' },
  heldReads: [],
})

/** Ten admitted left items: three open (two unallocated, one partial), one
 *  refused at admission (no settlement — NOT counted), and one fully allocated
 *  row the residue should never hold (NOT counted as open: the engine's own
 *  `fully_allocated_item_in_residue` post-condition is that finding). */
function oneUnit(): SetReconciliationResult {
  return result({ admitted: 10, refused: 1 }, { admitted: 9, refused: 0 }, [
    open('left', 1, sgd(45000n)),
    open('left', 2, sgd(1234n)),
    {
      side: 'left',
      ref: ref('doc_left', 3),
      settlement: { kind: 'partially_allocated', allocated: sgd(7000n), residual: sgd(3000n) },
      disposition: 'unidentified',
      cause: { kind: 'no_strategy_paired' },
      heldReads: [],
    },
    {
      side: 'left',
      ref: ref('doc_left', 4),
      settlement: null,
      disposition: 'error_left',
      cause: { kind: 'admission_refused', refusal: { kind: 'amount_not_money', found: 'text' } },
      heldReads: [],
    },
    {
      side: 'left',
      ref: ref('doc_left', 5),
      settlement: { kind: 'fully_allocated', allocated: sgd(250n) },
      disposition: 'unidentified',
      cause: { kind: 'no_strategy_paired' },
      heldReads: [],
    },
  ])
}

function mixed(): SetReconciliationResult {
  return result({ admitted: 4, refused: 0 }, { admitted: 4, refused: 0 }, [
    open('left', 1, sgd(100n)),
    open('left', 2, { currency: 'USD', amountMinor: 100n, exponent: 2 }),
    open('right', 1, sgd(5n)),
  ])
}

/** One admitted left item and TWO open rows — a residue the admission count
 *  cannot account for. */
function broken(): SetReconciliationResult {
  return result({ admitted: 1, refused: 0 }, { admitted: 0, refused: 0 }, [
    open('left', 1, sgd(1n)),
    open('left', 2, sgd(1n)),
  ])
}

async function seedRunsAndExceptions(): Promise<void> {
  const client = await migratorClient()
  try {
    await client.query('BEGIN')
    for (const runId of [RUN_ONE_UNIT, RUN_MIXED, RUN_BROKEN]) {
      await client.query(
        `INSERT INTO run
           (tenant_id, id, definition_id, definition_version, period_id,
            trigger_kind, status, started_at)
         VALUES ($1, $2, 'def_fig', 1, NULL, 'manual', 'completed', now())`,
        [ACME, runId],
      )
    }
    const insert = async (
      id: string,
      delta: {
        kind: string | null
        currency?: string
        minor?: string
        exponent?: number
        fxFrom?: string
        /** G3803 — `0510`'s direction. Absent = a row stored before it. */
        direction?: 'over' | 'under'
      },
    ): Promise<void> => {
      await client.query(
        `INSERT INTO tenant.exception
           (tenant_id, id, match_group_id, rule_id, rule_version, definition_version,
            domain, definition_id, rule_label, severity, severity_rank,
            value_at_risk_currency, value_at_risk_minor, value_at_risk_exponent,
            status, raised_at, explanation_summary, explanation_expected,
            delta_kind, delta_money_currency, delta_money_minor, delta_money_exponent,
            delta_temporal_days,
            delta_fx_from, delta_fx_to, delta_fx_rate, delta_fx_as_at, delta_fx_source,
            delta_money_direction)
         VALUES ($1, $2, 'mg', 'rul', 1, 1, 'finance', 'def_fig', 'Price check',
                 'high', 1, 'SGD', 412900, 2, 'open', now(), 's', 'e',
                 $3, $4, $5::int8, $6, $7,
                 $8, $9, $10, $11, $12, $13)`,
        [
          ACME,
          id,
          delta.kind,
          delta.currency ?? null,
          delta.minor ?? null,
          delta.exponent ?? null,
          delta.kind === 'temporal' ? 3 : null,
          delta.fxFrom ?? null,
          delta.fxFrom === undefined ? null : 'SGD',
          delta.fxFrom === undefined ? null : 1.34,
          delta.fxFrom === undefined ? null : new Date('2026-03-01T00:00:00Z'),
          delta.fxFrom === undefined ? null : 'illustrative',
          delta.direction ?? null,
        ],
      )
    }
    await insert('exc_fig_money', { kind: 'money', currency: 'SGD', minor: '1834000', exponent: 2, direction: 'over' })
    /* G3803 — the magnitude is stored POSITIVE and the direction carries the
       sign (`0510`). This fixture stored `-500` as the "signed" delta until
       4 Oct 2026, which is exactly the convention C3-02 found unwritten. */
    await insert('exc_fig_negative', { kind: 'money', currency: 'SGD', minor: '500', exponent: 2, direction: 'under' })
    await insert('exc_fig_fx', { kind: 'money', currency: 'SGD', minor: '2000', exponent: 2, fxFrom: 'USD', direction: 'over' })
    /* A non-zero money delta with NO recorded direction — a row stored before
       `0510`. Its sign is unknown, so the column publishes `null`, never `+`. */
    await insert('exc_fig_unsigned', { kind: 'money', currency: 'SGD', minor: '700', exponent: 2 })
    await insert('exc_fig_temporal', { kind: 'temporal' })
    await insert('exc_fig_none', { kind: null })
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await client.end()
  }
}

let poolOnce: TenantPool | undefined
function pool(): TenantPool {
  if (poolOnce === undefined) throw new Error('the pool was read before `before` ran')
  return poolOnce
}

async function tallies(runId: string): Promise<unknown> {
  const read = await withTenantScope(pool(), ACME, (tx) => readRunEngineAccount(tx, runId))
  return read.kind === 'account' ? read.account['settlementTallies'] : read
}

describe('the Close surface figures, derived from what is persisted', { skip }, () => {
  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seedRunsAndExceptions()
    poolOnce = await createAppPool(2)
    for (const [runId, make] of [
      [RUN_ONE_UNIT, oneUnit],
      [RUN_MIXED, mixed],
      [RUN_BROKEN, broken],
    ] as const) {
      const r = make()
      await withTenantScope(pool(), ACME, (tx) =>
        persistRunEngineAccount(tx, { runId, terminalStatus: terminalRunStatus(r), result: r }),
      )
    }
  })

  after(async () => {
    if (poolOnce !== undefined) await poolOnce.end().catch(() => undefined)
  })

  it('§1 · Matched is admitted minus open, and In variance is the open residual summed through the codec', async () => {
    assert.deepEqual(
      await tallies(RUN_ONE_UNIT),
      [
        {
          side: 'left',
          matched: 7,
          open: 3,
          unsettled: { kind: 'total', total: { currency: 'SGD', amountMinor: '49234', exponent: 2 } },
        },
        { side: 'right', matched: 9, open: 0, unsettled: { kind: 'nothing_open' } },
      ],
      'THE TALLY IS NOT `admitted − open`. Open is the residue rows whose settlement is ' +
        '`unallocated` or `partially_allocated`; a refused row (no settlement) was never ' +
        'admitted, and a `fully_allocated` row is the engine\'s own post-condition finding, not ' +
        'an open line. A side with nothing open answers `nothing_open`, never a zero in a ' +
        'currency it does not have.',
    )
  })

  it('§2 · residuals in two currencies are REFUSED, never summed', async () => {
    assert.deepEqual(await tallies(RUN_MIXED), [
      { side: 'left', matched: 2, open: 2, unsettled: { kind: 'mixed_units' } },
      {
        side: 'right',
        matched: 3,
        open: 1,
        unsettled: { kind: 'total', total: { currency: 'SGD', amountMinor: '5', exponent: 2 } },
      },
    ])
  })

  it('§3 · a residue the admission count cannot hold is a DEFECT, not a negative figure', async () => {
    const read = await withTenantScope(pool(), ACME, (tx) => readRunEngineAccount(tx, RUN_BROKEN))
    assert.equal(read.kind, 'unpublishable', `published ${JSON.stringify(read)}`)
  })

  it('§4 · the register row carries the line`s money variance, and refuses a converted one', async () => {
    const read = await withTenantScope(pool(), ACME, (tx) =>
      readExceptionQueuePage(tx, {}, { cursor: undefined, limit: 50, sort: EXCEPTION_SORTS.raisedAtAsc }),
    )
    assert.equal(read.kind, 'page')
    if (read.kind !== 'page') return
    const by = new Map(read.items.map((i) => [i['exceptionId'], i['variance']]))
    // §4a — the signed money delta, the value `getException` publishes as delta.absolute.
    assert.deepEqual(by.get('exc_fig_money'), { currency: 'SGD', amountMinor: '1834000', exponent: 2 })
    assert.deepEqual(by.get('exc_fig_negative'), { currency: 'SGD', amountMinor: '-500', exponent: 2 })
    // §4b — taken across currencies: refused, because the register totals this column.
    assert.equal(by.get('exc_fig_fx'), null, 'AN FX-CONVERTED DELTA REACHED THE VARIANCE COLUMN')
    // §4b2 — G3804: a magnitude whose direction was never recorded is NOT signed by guess.
    assert.equal(by.get('exc_fig_unsigned'), null, 'AN UNSIGNED MAGNITUDE WAS PUBLISHED AS SIGNED — C3-02')
    // §4c — not monetary, or no delta at all.
    assert.equal(by.get('exc_fig_temporal'), null)
    assert.equal(by.get('exc_fig_none'), null)
    for (const item of read.items) {
      assert.ok('variance' in item, '`variance` is REQUIRED-AND-NULLABLE and was omitted')
    }
  })
})
