/**
 * THE RECONCILIATION RESULT, PERSISTED AND READ BACK — G284's typed columns,
 * over a real PostgreSQL, through `withTenantScope()`.
 *
 * ┌─ WHY THIS FILE AND NOT AN HTTP SUITE ──────────────────────────────────────┐
 * │ `getRunAccount` and `listRunResidue` are DECLARED AND NOT MOUNTED, and on   │
 * │ 19 Sep 2026 the owner reaffirmed G200's freeze: **it binds until the gate   │
 * │ GENUINELY ALLOWS SOMEBODY**, and `server/data-plane/authorise.ts` answers   │
 * │ `not_held` to every caller because three of `PrincipalContext`'s seven      │
 * │ terms have no producer. So there is no route to drive.                      │
 * │                                                                            │
 * │ `docs/contracts/capability.openapi.yaml` says of those two operations       │
 * │ *"The handler lands with the migration, in that commit"*, and the ruling    │
 * │ separates them. **The contract's ARGUMENT is why this file exists**: a      │
 * │ column with no reader is a column nothing checks. This is the reader, and   │
 * │ these are the checks, and they are strictly about the store rather than     │
 * │ about a surface.                                                            │
 * │                                                                            │
 * │ ⚠️ WHAT IS THEREFORE UNWITNESSED HERE, STATED SO THE SILENCE IS NOT READ AS │
 * │ COVERAGE: that anybody can reach these rows over HTTP. Nobody can. The      │
 * │ commit that lifts the freeze mounts two handlers over                       │
 * │ `readRunEngineAccount()` and `readRunResiduePage()` and adds the suite that │
 * │ proves the 404s.                                                            │
 * │                                                                            │
 * │ ✅ **THAT COMMIT LANDED LATER ON 19 Sep 2026 — G300 AND G301 — AND THE      │
 * │ PARAGRAPH ABOVE IS CORRECTED RATHER THAN DELETED**, because *"Nobody can"*  │
 * │ is the sentence that justified this file existing without an HTTP sibling.  │
 * │ Somebody can: `server/data-plane/run-account.ts` is the route, and          │
 * │ `tests/http/run-account-served.test.ts` is the suite this box predicted —   │
 * │ it drives both operations against the PRODUCTION authoriser, proves the     │
 * │ 404s, and carries the RLS-disabled leak control at the ROUTE.               │
 * │                                                                            │
 * │ 🛑 **AND THE DIVISION OF LABOUR IS UNCHANGED, WHICH IS WHY NOTHING BELOW    │
 * │ MOVED.** This file is the only place the ROUND TRIP is proven — every       │
 * │ channel arm for arm, `int8` above 2^53, the keyset that neither skips nor   │
 * │ duplicates. The HTTP suite deliberately does not re-assert any of it: a     │
 * │ second copy would drift from this one, and this one is where the mutations  │
 * │ in the box below were taken.                                                │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT IS ASSERTED, AND WHICH CONTROL EACH ONE IS ──────────────────────────┐
 * │ 1  A real `SetReconciliationResult` round-trips: every declared channel     │
 * │    comes back, arm for arm, including the three that carry a nested         │
 * │    `PopulationDefect` and the two that carry `int8` money.                  │
 * │ 2  `int8` SURVIVES `pg`'s STRING ROUND TRIP EXACTLY above 2^53. G286.       │
 * │ 3  A run with no account answers `no_account` — a STATED answer, never an   │
 * │    empty account and never an empty page.                        G284       │
 * │ 4  Another tenant's account is INVISIBLE, and no statement carries a tenant │
 * │    predicate or binds a tenant parameter.                        INVARIANT 1│
 * │ 5  🛑 WITH RLS DISABLED THE SAME READ LEAKS — the control that makes 4 mean │
 * │    anything, because isolation from a `WHERE` a reader happens to carry is  │
 * │    indistinguishable from isolation from the database until you turn the    │
 * │    database off.                                                 §5.1       │
 * │ 6  A WRITE OUTSIDE A SCOPED TRANSACTION FAILS CLOSED.            G100       │
 * │ 7  Residue paging neither skips nor duplicates a row across pages.          │
 * │ 8  A stored value the model cannot name refuses the WHOLE read rather than  │
 * │    being dropped from it.                                                   │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 🛑 EVERY CONTROL HERE WAS WITNESSED RED BY MUTATION, AND THE MUTATIONS ARE ┐
 * │ WRITTEN DOWN BECAUSE A CONTROL NOBODY PROBED IS A CONTROL NOBODY HAS.       │
 * │ All eleven passed on their first run against the real store, which is       │
 * │ exactly the state `docs/HANDOFF.md` §5.6 warns about — a suite that has     │
 * │ never been red is a suite that might be asserting nothing. Each mutation    │
 * │ below was applied to `server/data-plane/run-account-store.ts`, run, and     │
 * │ reverted:                                                                  │
 * │                                                                            │
 * │  A  the envelope read gains `AND tenant_id = $2`, so isolation comes from   │
 * │     a `WHERE` the reader carries → **4 and 5 RED**, the other nine green.   │
 * │     This is the mutation the whole file exists for: 4 alone cannot tell a   │
 * │     correct reader from this one.                                          │
 * │  B  the residue read skips its envelope check → **3 RED** (an empty page    │
 * │     for a run with no account).                                            │
 * │  C  the keyset predicate becomes `ordinal >= $2` → **7 RED**, on the        │
 * │     duplicate branch.                                                      │
 * │  D  `shapeCause` returns `{kind}` without narrowing → **8 RED**.            │
 * │  E  `minorIn` reads the `int8` column through `Number()` → **1 and 2 RED**  │
 * │     at 9007199254740992, one below the stored value. G286's ceiling.        │
 * │  F  the writer supplies a literal tenant instead of                         │
 * │     `current_setting('app.tenant_id')` → the whole suite RED, because the   │
 * │     globex fixture is refused by the policy's `WITH CHECK` before a single  │
 * │     assertion runs. Coarse, and it is the write half of invariant 1 biting. │
 * │  G  the envelope insert gains `ON CONFLICT DO NOTHING` → the write-once     │
 * │     assertion RED.                                                         │
 * └────────────────────────────────────────────────────────────────────────────┘
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
  persistRunEngineAccount,
  readRunEngineAccount,
  readRunResiduePage,
  decodeResidueCursor,
} from '../../server/data-plane/run-account-store.ts'
import { parseFieldPath } from '../../model/field-path.ts'
import { terminalRunStatus } from '../../model/reconciliation.ts'
import type {
  AdmittedItem,
  ItemRef,
  SetReconciliationResult,
} from '../../model/reconciliation.ts'
import type { FieldPath, SourceDocumentId } from '../../model/kernel.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE. Set before the first call that reads it.
 *
 * 🛑 NOT HYGIENE — THE FIX FOR A NAMED FLAKE. `node --test` runs test FILES
 * concurrently; `resetSchema()` runs `DROP SCHEMA … CASCADE` and
 * `applyMigrations()` outside any lock, so two files sharing one database race
 * on the rebuild and the loser dies inside `applyMigrations` with a message
 * about a relation. `db/env.ts` resolves `RECONCILE_DB_NAME` per call and never
 * at import, so setting it here — above `probeDatabase()` — is the only
 * placement that works.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_ACCOUNT_DB_NAME'] ?? runScopedName('reconcile_account_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

/** The acme run that carries a full engine account. */
const ACME_RUN = 'run_acme_engine'
/** An acme run that was never reconciled. Assertion 3's fixture. */
const ACME_BARE = 'run_acme_bare'
/** A globex run WITH an account, addressed by its exact id from an acme scope. */
const GLOBEX_RUN = 'run_globex_engine'

/**
 * 🛑 ABOVE 2^53, DELIBERATELY, AND THIS ONE NUMBER IS THE WHOLE OF ASSERTION 2.
 * `Number.MAX_SAFE_INTEGER` is 9007199254740991; this is two more. It survives
 * `bigint` → decimal string → `int8` column → `pg`'s string → `parseMinorUnits`
 * → `bigint` unchanged, and it would NOT survive a single trip through
 * `Number()`. G286's deciding fact is a CEILING, and this is the ceiling.
 */
const ABOVE_SAFE_INTEGER = 9007199254740993n

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/db/run-engine-account.test.ts DID NOT RUN.',
      '',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS IS THE ONLY CONTROL OVER G284`s ROUND TRIP. `getRunAccount` and',
      '   `listRunResidue` ARE mounted since 19 Sep 2026 (G300), and',
      '   tests/http/run-account-served.test.ts covers the ROUTE — but it does',
      '   not re-assert the round trip, so this file is still the only place it',
      '   is proven. A run of the suite in which it skipped is NOT',
      '   evidence that a reconciliation result round-trips, NOT evidence that',
      '   an engine account is tenant-isolated, and NOT evidence that `int8`',
      '   money survives the wire. Start a PostgreSQL and re-run.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the engine-account round trip and its leak control', probe)

/* ------------------------------------------------------------------ *
 * A recording pool — the same shape `tests/db/tenant-isolation.test.ts` and
 * `tests/db/session-isolation.test.ts` use. Production code is not
 * instrumented for this; the store takes a `ScopedClient` and this satisfies it
 * structurally.
 *
 * 🛑 IT DOES NOT ADD `query` TO `TenantPool`. The pool type has no `query` so
 * that `pool.query(...)` — one autocommitted statement, which silently discards
 * `SET LOCAL` — is a COMPILE ERROR at every call site rather than a review
 * catch.
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

/* ------------------------------------------------------------------ *
 * THE FIXTURE — a `SetReconciliationResult` that reaches every arm this
 * migration has a column for.
 *
 * ⚠️ IT IS HAND-BUILT AND NOT TAKEN FROM `tests/scenarios/recon-corpus.ts`, AND
 * THE REASON IS THE OPPOSITE OF CONVENIENCE. The corpus exercises what the
 * ENGINE produces; this file has to exercise what the COLUMNS can hold, which
 * includes arms no corpus scenario reaches — `declared_control_total_disagrees`
 * with a total above 2^53, `population_wholly_refused`, a reader refusal, a
 * held read, and a tolerance decline. A fixture drawn from the corpus would
 * have silently skipped every column those arms are the only writers of, and
 * the absence would have read as coverage.
 * ------------------------------------------------------------------ */

function doc(id: string): SourceDocumentId {
  return id as SourceDocumentId
}

function ref(id: string, lineIndex: number | null): ItemRef {
  return { sourceDocumentId: doc(id), lineIndex }
}

/**
 * The WIRE form of a path — the contract's `FieldSegment` objects. G2375/G2471:
 * the readers publish this, not the stored token list, and every path assertion
 * below compares against it. Built from a token list here only so the fixture
 * stays legible; a string member is a key and a number an index, which is
 * `model/field-path.ts`'s stored encoding and nothing more.
 */
function wire(...tokens: readonly (string | number)[]): Record<string, unknown>[] {
  return tokens.map((t) => (typeof t === 'number' ? { kind: 'index', index: t } : { kind: 'key', key: t }))
}

/** Through the ONE seam. A cast to `FieldPath` anywhere else is a lint failure. */
function path(...tokens: readonly (string | number)[]): FieldPath {
  const parsed = parseFieldPath(tokens)
  if (!parsed.ok) throw new Error(`the fixture path is not a path: ${JSON.stringify(tokens)}`)
  return parsed.path
}

const NO_ITEMS: ReadonlyMap<string, AdmittedItem> = new Map()

function fixture(): SetReconciliationResult {
  return {
    state: { items: NO_ITEMS, allocations: [] },

    admissionRates: [
      { side: 'left', presented: 40, admitted: 38, refused: 2 },
      { side: 'right', presented: 12, admitted: 12, refused: 0 },
    ],

    documentAccounts: [
      {
        side: 'left',
        sourceDocumentId: doc('doc_statement'),
        trailer: 'declared',
        declaredLineCount: 40,
        declaredMinor: ABOVE_SAFE_INTEGER,
        declaredExponent: 2,
        presented: 40,
        admitted: 38,
        refused: 2,
        verdict: {
          kind: 'reported',
          defects: [
            {
              kind: 'declared_control_total_disagrees',
              sourceDocumentId: doc('doc_statement'),
              declaredMinor: ABOVE_SAFE_INTEGER,
              declaredExponent: 2,
              admittedMinor: ABOVE_SAFE_INTEGER - 1500n,
              admittedExponent: 2,
            },
            {
              kind: 'control_total_unverifiable_rows_refused',
              sourceDocumentId: doc('doc_statement'),
              documentRowCount: 40,
              admittedCount: 38,
            },
          ],
        },
      },
      {
        side: 'right',
        sourceDocumentId: doc('doc_ledger'),
        trailer: 'not_declared_by_format',
        declaredLineCount: null,
        declaredMinor: null,
        declaredExponent: null,
        presented: 12,
        admitted: 12,
        refused: 0,
        verdict: { kind: 'nothing_to_check' },
      },
    ],

    refusedAtAdmission: [
      {
        side: 'left',
        ref: ref('doc_statement', 7),
        path: path('lines', 7, 'amount'),
        refusal: { kind: 'amount_not_money', found: 'text' },
      },
      {
        side: 'left',
        ref: ref('doc_statement', 19),
        path: path('lines', 19, 'reference'),
        refusal: {
          kind: 'identifier_not_extractable',
          refusal: { kind: 'segment_index_out_of_range', opIndex: 1 },
        },
      },
    ],

    ambiguities: [
      {
        on: path('reference'),
        strategyKind: 'exact_identifier',
        leftCandidates: 2,
        rightCandidates: 1,
        leftRefs: [ref('doc_statement', 3), ref('doc_statement', 4)],
        rightRefs: [ref('doc_ledger', null)],
      },
    ],

    searchBoundary: {
      oversizedBuckets: [{ itemCount: 900, exampleRef: ref('doc_statement', 11) }],
      exhaustedSearches: [],
      oversizedAmountBuckets: [{ itemCount: 64, exampleRef: ref('doc_ledger', 2) }],
    },

    /* ⚠️ NOT PERSISTED AND NOT PUBLISHED — `0007`'s header carries the
     * derivation. They are supplied here anyway so the fixture is a REAL
     * `SetReconciliationResult` rather than a partial one wearing its type. */
    readerRequests: [],
    toleranceRefusals: [],
    toleranceDeclines: [],

    meterFacts: [
      { meter: 'reconciliations_run', quantity: 1, idempotencyKey: 'run_acme_engine:rr', modelEntryId: null },
      { meter: 'exceptions_raised', quantity: 3, idempotencyKey: 'run_acme_engine:ex', modelEntryId: null },
    ],

    postconditions: [
      { kind: 'negative_residual', count: 1 },
      {
        kind: 'gross_not_partitioned',
        admittedMinor: ABOVE_SAFE_INTEGER,
        accountedMinor: ABOVE_SAFE_INTEGER - 1n,
      },
      {
        kind: 'population_integrity_reported',
        side: 'left',
        defect: {
          kind: 'duplicate_item_address',
          ref: ref('doc_statement', 5),
          occurrences: 2,
        },
      },
      { kind: 'population_wholly_refused', side: 'right', sideRowCount: 12 },
    ],

    completeness: [
      { kind: 'rows_presented_not_admitted', side: 'left', presented: 40, admitted: 38, refused: 2 },
      {
        kind: 'source_self_report_unmet',
        side: 'left',
        defect: {
          kind: 'declared_line_count_disagrees',
          sourceDocumentId: doc('doc_statement'),
          declaredCount: 41,
          documentRowCount: 40,
        },
      },
    ],

    residue: [
      {
        side: 'left',
        ref: ref('doc_statement', 1),
        settlement: { kind: 'unallocated', residual: { currency: 'SGD', amountMinor: 45000n, exponent: 2 } },
        disposition: 'unidentified',
        cause: { kind: 'no_strategy_paired' },
        heldReads: [],
      },
      {
        side: 'left',
        ref: ref('doc_statement', 7),
        settlement: null,
        disposition: 'error_left',
        cause: { kind: 'admission_refused', refusal: { kind: 'amount_not_money', found: 'text' } },
        heldReads: [],
      },
      {
        side: 'right',
        ref: ref('doc_ledger', null),
        settlement: {
          kind: 'partially_allocated',
          allocated: { currency: 'SGD', amountMinor: 100000n, exponent: 2 },
          residual: { currency: 'SGD', amountMinor: ABOVE_SAFE_INTEGER, exponent: 2 },
        },
        disposition: 'error_right',
        cause: { kind: 'amount_tolerance_declined', signedVarianceMinor: -1500n },
        heldReads: [],
      },
      {
        side: 'left',
        ref: ref('doc_statement', 12),
        settlement: { kind: 'fully_allocated', allocated: { currency: 'SGD', amountMinor: 250n, exponent: 2 } },
        disposition: 'unidentified',
        cause: { kind: 'read_held_below_floor' },
        heldReads: [
          { ref: ref('doc_statement', 12), path: path('lines', 12, 'payer'), readConfidence: 0.41, floor: 0.8 },
          /* `readConfidence: null` is a STATE — a floor was declared and the
           * extraction reported no confidence at all. Fail-closed. */
          { ref: ref('doc_statement', 12), path: path('lines', 12, 'date'), readConfidence: null, floor: 0.8 },
        ],
      },
      {
        side: 'left',
        ref: ref('doc_statement', 21),
        settlement: { kind: 'unallocated', residual: { currency: 'SGD', amountMinor: 900n, exponent: 2 } },
        disposition: 'unidentified',
        cause: { kind: 'reader_refused', refusal: { kind: 'response_truncated' } },
        heldReads: [],
      },
    ],
  }
}

/** Every table the account read touches, for assertion 5's negative control. */
const ACCOUNT_TABLES = [
  'run_engine_account',
  'run_admission_rate',
  'run_document_account',
  'run_population_defect',
  'run_refused_item',
  'run_ambiguity',
  'run_ambiguity_ref',
  'run_search_boundary_entry',
  'run_postcondition',
  'run_completeness',
  'run_meter_fact',
] as const

async function seedRuns(): Promise<void> {
  const client = await migratorClient()
  try {
    await client.query('BEGIN')
    for (const [tenantId, runId] of [
      [ACME, ACME_RUN],
      [ACME, ACME_BARE],
      [GLOBEX, GLOBEX_RUN],
    ] as const) {
      await client.query(
        `INSERT INTO run
           (tenant_id, id, definition_id, definition_version, period_id,
            trigger_kind, status, started_at)
         VALUES ($1, $2, 'def_engine', 1, NULL, 'manual', 'completed', now())`,
        [tenantId, runId],
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await client.end()
  }
}

let poolOnce: TenantPool | undefined
let recorded: Recorded[] = []

function pool(): TenantPool {
  if (poolOnce === undefined) throw new Error('the pool was read before `before` ran')
  return poolOnce
}

describe('the engine account, persisted in typed columns', { skip }, () => {
  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seedRuns()
    /* `max: 1` is adversarial on purpose, exactly as in the two isolation
     * suites: every read below lands on the SAME pooled backend, which is the
     * arrangement `SET LOCAL` state leaks under if it leaks at all. */
    const instrumented = recordingPool(await createAppPool(1))
    poolOnce = instrumented.pool
    recorded = instrumented.statements

    const result = fixture()
    await withTenantScope(pool(), ACME, (tx) =>
      persistRunEngineAccount(tx, {
        runId: ACME_RUN,
        terminalStatus: terminalRunStatus(result),
        result,
      }),
    )
    await withTenantScope(pool(), GLOBEX, (tx) =>
      persistRunEngineAccount(tx, {
        runId: GLOBEX_RUN,
        terminalStatus: terminalRunStatus(result),
        result,
      }),
    )
  })

  after(async () => {
    if (poolOnce !== undefined) await poolOnce.end().catch(() => undefined)
  })

  /* ================================================================ *
   * 1. THE ROUND TRIP.
   * ================================================================ */

  it('every declared channel comes back, arm for arm', async () => {
    const read = await withTenantScope(pool(), ACME, (tx) => readRunEngineAccount(tx, ACME_RUN))
    assert.equal(
      read.kind,
      'account',
      `the account did not come back: ${JSON.stringify(read)}. A reconciliation result was ` +
        'written into thirteen tables and the reader could not reassemble it, which means the ' +
        'columns and the read seam disagree about the shape they share.',
    )
    if (read.kind !== 'account') return
    const a = read.account

    /**
     * 🛑 THE KEY SET IS ASSERTED AS A WHOLE, NOT FIELD BY FIELD.
     * `RunEngineAccount`'s produced arm is `additionalProperties: false` with TEN
     * required properties, and `fast-json-stringify` SERIALISES a response
     * without validating it — so a missing channel is a body that disagrees with
     * its own contract and nothing downstream would say so. A per-field
     * assertion passes while a channel is absent; this one does not.
     *
     * ⚠️ ELEVEN KEYS, NOT TEN: `postconditionProperty` is declared and NOT
     * required, and it is published from the model's own constant rather than
     * from a column.
     */
    assert.deepEqual(
      Object.keys(a).sort(),
      [
        'admissionRates',
        'ambiguities',
        'completeness',
        'documentAccounts',
        'meterFacts',
        // G3804 — "In variance", the net open residual, derived at read time.
        'openResidual',
        'outcome',
        'postconditionProperty',
        'postconditions',
        'refusedAtAdmission',
        'searchBoundary',
        // G3541 — derived from `admissionRates` and the residue, never stored.
        'settlementTallies',
        'terminalStatus',
      ],
      'THE PRODUCED ARM IS NOT THE SHAPE THE CONTRACT DECLARES. Derive the truth: ' +
        "sed -n '/    RunEngineAccount:/,/discriminator/p' docs/contracts/capability.openapi.yaml",
    )

    assert.equal(a['outcome'], 'produced')
    assert.equal(a['terminalStatus'], terminalRunStatus(fixture()))

    assert.deepEqual(a['admissionRates'], [
      { side: 'left', presented: 40, admitted: 38, refused: 2 },
      { side: 'right', presented: 12, admitted: 12, refused: 0 },
    ])

    assert.deepEqual(a['searchBoundary'], {
      oversizedBuckets: [{ itemCount: 900, exampleRef: { sourceDocumentId: 'doc_statement', lineIndex: 11 } }],
      /* EMPTY AND PRESENT. The channel says the engine looked and stopped
       * nowhere; an absent key would say nobody wired it up. */
      exhaustedSearches: [],
      oversizedAmountBuckets: [{ itemCount: 64, exampleRef: { sourceDocumentId: 'doc_ledger', lineIndex: 2 } }],
    })

    assert.deepEqual(a['refusedAtAdmission'], [
      {
        side: 'left',
        ref: { sourceDocumentId: 'doc_statement', lineIndex: 7 },
        /* SEGMENT OBJECTS, NOT A DOTTED STRING AND NOT BARE TOKENS. G214: a
         * dotted path breaks on any key containing a dot, which is legal JSON,
         * and it fails by silently addressing the WRONG key.
         * ⚠️ THIS ASSERTED THE BARE TOKEN LIST `['lines', 7, 'amount']` UNTIL
         * 1 Oct 2026 — G2375. That was the STORED form leaking to the wire,
         * and it pinned the defect: the contract's `FieldPath` is an array of
         * `FieldSegment` objects and the serialiser threw on tokens (a 500,
         * witnessed at `tests/http/run-path-wire-served.test.ts`). G2471. */
        path: wire('lines', 7, 'amount'),
        refusal: { kind: 'amount_not_money', found: 'text' },
      },
      {
        side: 'left',
        ref: { sourceDocumentId: 'doc_statement', lineIndex: 19 },
        path: wire('lines', 19, 'reference'),
        refusal: {
          kind: 'identifier_not_extractable',
          refusal: { kind: 'segment_index_out_of_range' },
        },
      },
    ])

    assert.deepEqual(a['ambiguities'], [
      {
        on: wire('reference'),
        strategyKind: 'exact_identifier',
        leftCandidates: 2,
        rightCandidates: 1,
        leftRefs: [
          { sourceDocumentId: 'doc_statement', lineIndex: 3 },
          { sourceDocumentId: 'doc_statement', lineIndex: 4 },
        ],
        rightRefs: [{ sourceDocumentId: 'doc_ledger', lineIndex: null }],
      },
    ])

    assert.deepEqual(a['completeness'], [
      { kind: 'rows_presented_not_admitted', side: 'left', presented: 40, admitted: 38, refused: 2 },
      {
        kind: 'source_self_report_unmet',
        side: 'left',
        defect: {
          kind: 'declared_line_count_disagrees',
          sourceDocumentId: 'doc_statement',
          declaredCount: 41,
          documentRowCount: 40,
        },
      },
    ])

    assert.deepEqual(a['meterFacts'], [
      { meter: 'reconciliations_run', quantity: 1, idempotencyKey: 'run_acme_engine:rr', modelEntryId: null },
      { meter: 'exceptions_raised', quantity: 3, idempotencyKey: 'run_acme_engine:ex', modelEntryId: null },
    ])

    /**
     * 🛑 THE MET ROW IS THE ONE TO READ. G236: *"a check that only speaks when
     * it fails leaves an operator unable to tell 'this file vouched for itself
     * and was right' from 'this file said nothing'."* `doc_ledger` is
     * `nothing_to_check` and it is HERE, with its counts.
     */
    assert.deepEqual(a['documentAccounts'], [
      {
        side: 'left',
        sourceDocumentId: 'doc_statement',
        trailer: 'declared',
        declaredLineCount: 40,
        declaredMinor: '9007199254740993',
        declaredExponent: 2,
        presented: 40,
        admitted: 38,
        refused: 2,
        verdict: {
          kind: 'reported',
          defects: [
            {
              kind: 'declared_control_total_disagrees',
              sourceDocumentId: 'doc_statement',
              declaredMinor: '9007199254740993',
              declaredExponent: 2,
              admittedMinor: '9007199254739493',
              admittedExponent: 2,
            },
            {
              kind: 'control_total_unverifiable_rows_refused',
              sourceDocumentId: 'doc_statement',
              documentRowCount: 40,
              admittedCount: 38,
            },
          ],
        },
      },
      {
        side: 'right',
        sourceDocumentId: 'doc_ledger',
        trailer: 'not_declared_by_format',
        declaredLineCount: null,
        declaredMinor: null,
        declaredExponent: null,
        presented: 12,
        admitted: 12,
        refused: 0,
        verdict: { kind: 'nothing_to_check' },
      },
    ])

    assert.deepEqual(a['postconditions'], [
      { kind: 'negative_residual', count: 1 },
      {
        kind: 'gross_not_partitioned',
        admittedMinor: '9007199254740993',
        accountedMinor: '9007199254740992',
      },
      {
        kind: 'population_integrity_reported',
        side: 'left',
        defect: {
          kind: 'duplicate_item_address',
          ref: { sourceDocumentId: 'doc_statement', lineIndex: 5 },
          occurrences: 2,
        },
      },
      { kind: 'population_wholly_refused', side: 'right', sideRowCount: 12 },
    ])

    /**
     * 🛑 PUBLISHED FROM `POSTCONDITION_PROPERTY` AND NEVER FROM A COLUMN. It is
     * a DECLARATION about the vocabulary, not a finding about this run —
     * storing it would put a copy in every account row, and copies of a total
     * record are exactly what the model built the record to stop.
     */
    assert.deepEqual(a['postconditionProperty'], {
      open_item_missing_from_residue: 'soundness',
      item_in_residue_twice: 'soundness',
      fully_allocated_item_in_residue: 'soundness',
      negative_residual: 'soundness',
      gross_not_partitioned: 'soundness',
      population_integrity_reported: 'completeness',
      population_wholly_refused: 'completeness',
    })
  })

  /* ================================================================ *
   * 2. `int8` ABOVE 2^53 — G286.
   * ================================================================ */

  it('a minor-unit total above 2^53 survives the column and `pg`\'s string EXACTLY', async () => {
    const read = await withTenantScope(pool(), ACME, (tx) => readRunEngineAccount(tx, ACME_RUN))
    if (read.kind !== 'account') assert.fail(`no account: ${JSON.stringify(read)}`)

    const accounts = read.account['documentAccounts'] as Array<Record<string, unknown>>
    const first = accounts[0]
    assert.ok(first !== undefined, 'the fixture wrote two document accounts')
    const declared = first['declaredMinor']

    assert.equal(
      declared,
      ABOVE_SAFE_INTEGER.toString(10),
      'THE CEILING G286 WAS RULED ABOUT IS BACK. The stored value is one that a single trip ' +
        'through `Number()` cannot represent, and the wire carries minor units as a DECIMAL ' +
        'STRING for exactly that reason — "JSON has no bigint". If this reads 9007199254740992 ' +
        'the reader parsed the column into a double somewhere.',
    )
    assert.equal(
      typeof declared,
      'string',
      'A MONEY AMOUNT REACHED THE WIRE SHAPE AS A JSON NUMBER. `Money.amountMinor` is ' +
        "{type: string, pattern: '^-?[0-9]+$'} and a consumer handed a number is back at 2^53.",
    )
    /* The round trip is exact in BOTH directions: the string is a `bigint` again. */
    assert.equal(BigInt(String(declared)), ABOVE_SAFE_INTEGER)
  })

  /* ================================================================ *
   * 3. A RUN WITH NO ACCOUNT — A STATED ANSWER.
   * ================================================================ */

  it('a run nobody reconciled answers `no_account`, NOT an empty account and NOT an empty page', async () => {
    const account = await withTenantScope(pool(), ACME, (tx) => readRunEngineAccount(tx, ACME_BARE))
    assert.equal(
      account.kind,
      'no_account',
      'A RUN WITH NO ENGINE ACCOUNT PRODUCED SOMETHING OTHER THAN "no account". Ten empty ' +
        'channels and a terminalStatus would report a CLEAN CLOSE for a run nobody ran — the ' +
        'same fabrication `server/data-plane/runs.ts` refuses when it publishes ' +
        '`completeness: null` rather than `[]`. ' +
        `Got: ${JSON.stringify(account)}`,
    )

    const residue = await withTenantScope(pool(), ACME, (tx) =>
      readRunResiduePage(tx, ACME_BARE, { after: null, limit: 50 }),
    )
    assert.equal(
      residue.kind,
      'no_account',
      'THE RESIDUE READ ANSWERED AN EMPTY PAGE FOR A RUN WITH NO ACCOUNT, AND THAT IS THE ' +
        'WORSE HALF OF THIS ASSERTION. An empty page means "the engine closed everything"; no ' +
        'account means "nothing reconciled this run". Both produce zero rows from the table, ' +
        'and only the envelope can tell them apart. ' +
        `Got: ${JSON.stringify(residue)}`,
    )
  })

  /* ================================================================ *
   * 4. INVARIANT 1 — NO PREDICATE, NO PARAMETER, NO CROSS-TENANT READ.
   * ================================================================ */

  it('another tenant\'s account is invisible, and no statement names a tenant', async () => {
    const crossTenant = await withTenantScope(pool(), ACME, (tx) =>
      readRunEngineAccount(tx, GLOBEX_RUN),
    )
    assert.equal(
      crossTenant.kind,
      'no_account',
      'A CROSS-TENANT READ SUCCEEDED. The globex run has a full engine account and an acme ' +
        'scope reached it. Tenant scope is derived from the session, never read from a ' +
        `request, and the policy — not a WHERE in the reader — is what answers. Got: ${JSON.stringify(crossTenant)}`,
    )

    const own = await withTenantScope(pool(), GLOBEX, (tx) => readRunEngineAccount(tx, GLOBEX_RUN))
    assert.equal(
      own.kind,
      'account',
      'THE POSITIVE CONTROL FAILED, so the invisibility above proves nothing — a reader that ' +
        'returns "no account" for everybody returns it for the other tenant too.',
    )

    /**
     * 🛑 THE SQL ITSELF. `db/tenant-scope.ts` binds the tenant id ONCE, in
     * `set_config`, and nothing else may. A `WHERE tenant_id = $n` anywhere in
     * the store would make assertion 5 impossible to fail while looking correct
     * here — which is why both assertions exist and why neither is enough alone.
     */
    const business = recorded.filter((s) => !s.text.includes('set_config'))
    assert.ok(business.length > 20, `only ${business.length} statements recorded; the scan is empty`)
    for (const statement of business) {
      assert.ok(
        !/tenant_id\s*=\s*\$/.test(statement.text),
        'A STATEMENT IN THE STORE CARRIES A TENANT PREDICATE. Isolation must come from the ' +
          `row-level security policy and from nothing else. Offender: ${statement.text}`,
      )
      assert.ok(
        !statement.values.includes(ACME) && !statement.values.includes(GLOBEX),
        'A STATEMENT BOUND A TENANT ID AS A PARAMETER. The only place a tenant id may be ' +
          `bound is \`set_config\` inside \`withTenantScope()\`. Offender: ${statement.text}`,
      )
    }
  })

  /* ================================================================ *
   * 5. 🛑 THE CONTROL THAT MAKES 4 MEAN ANYTHING.
   * ================================================================ */

  it('with RLS DISABLED the same read LEAKS — isolation comes from the database', async () => {
    const admin = await migratorClient()
    try {
      for (const table of ACCOUNT_TABLES) {
        await admin.query(`ALTER TABLE tenant.${table} DISABLE ROW LEVEL SECURITY`)
      }

      const leaked = await withTenantScope(pool(), ACME, (tx) =>
        readRunEngineAccount(tx, GLOBEX_RUN),
      )
      assert.notEqual(
        leaked.kind,
        'no_account',
        'TURNING ROW-LEVEL SECURITY OFF DID NOT CHANGE WHAT THE READER RETURNED, WHICH MEANS ' +
          'THE ISOLATION ASSERTED ABOVE IS NOT COMING FROM THE DATABASE. Either the store is ' +
          'filtering by tenant itself — a rule keyed on a convenient landmark, ' +
          'docs/HANDOFF.md §5.1 — or the globex fixture never landed. In either case this ' +
          'file is proving nothing.',
      )
      assert.equal(
        leaked.kind,
        'account',
        'RLS was off and the reader returned something other than a full account, so the leak ' +
          `is only partly demonstrated and the control is weaker than it reads. Got: ${JSON.stringify(leaked)}`,
      )
    } finally {
      for (const table of ACCOUNT_TABLES) {
        await admin
          .query(`ALTER TABLE tenant.${table} ENABLE ROW LEVEL SECURITY`)
          .catch(() => undefined)
      }
      await admin.end()
    }

    /* AND THE POLICY IS BACK ON, asserted rather than assumed: a restore that
     * silently failed would make every later assertion in this file vacuous. */
    const restored = await withTenantScope(pool(), ACME, (tx) =>
      readRunEngineAccount(tx, GLOBEX_RUN),
    )
    assert.equal(restored.kind, 'no_account', 'the policy did not come back on')
  })

  /* ================================================================ *
   * 6. G100 — A WRITE OUTSIDE A SCOPED TRANSACTION FAILS CLOSED.
   * ================================================================ */

  it('a write with no tenant scope is REFUSED by the database, not silently misfiled', async () => {
    const client = await pool().connect()
    let refused: unknown
    try {
      /* `BEGIN` and NO `set_config`. This is exactly the shape
       * `db/tenant-scope.ts` exists to make unavailable — a transaction whose
       * `app.tenant_id` was never set — and the GUC therefore reads NULL. */
      await client.query('BEGIN')
      await persistRunEngineAccount(
        { query: (t, v) => client.query(t, v), release: () => undefined },
        { runId: ACME_BARE, terminalStatus: 'completed', result: fixture() },
      )
      await client.query('ROLLBACK')
    } catch (err) {
      refused = err
      await client.query('ROLLBACK').catch(() => undefined)
    } finally {
      client.release()
    }

    assert.ok(
      refused !== undefined,
      'AN ENGINE ACCOUNT WAS WRITTEN WITH NO TENANT SCOPE. `current_setting(\'app.tenant_id\', ' +
        "true)` is NULL in an unscoped transaction, so `nullif(…, '')` is NULL and the row's " +
        'tenant column is NULL — which the NOT NULL constraint and the policy\'s WITH CHECK ' +
        'must both refuse. G100 is deny-on-NULL and this is the write half of it.',
    )

    /* AND THE REFUSAL LEFT NOTHING BEHIND. A partial write that rolled back is
     * the outcome; a partial write that did not is the defect. */
    const after = await withTenantScope(pool(), ACME, (tx) => readRunEngineAccount(tx, ACME_BARE))
    assert.equal(after.kind, 'no_account', 'the refused write left rows behind')
  })

  /* ================================================================ *
   * 7. PAGING — NEITHER SKIPS NOR DUPLICATES.
   * ================================================================ */

  it('the residue pages without skipping a row or repeating one', async () => {
    const whole = await withTenantScope(pool(), ACME, (tx) =>
      readRunResiduePage(tx, ACME_RUN, { after: null, limit: 50 }),
    )
    if (whole.kind !== 'page') assert.fail(`no page: ${JSON.stringify(whole)}`)
    assert.equal(whole.items.length, 5, 'the fixture wrote five residue rows')
    assert.equal(whole.nextCursor, null, 'a page that holds everything must say so')

    /* TWO AT A TIME OVER FIVE ROWS — so the last page is SHORT and the boundary
     * between "a full page that is the last one" and "a full page with more
     * behind it" is actually crossed. A limit that divides the row count evenly
     * never exercises it. */
    const seen: string[] = []
    let after: number | null = null
    let pages = 0
    for (;;) {
      const page = await withTenantScope(pool(), ACME, (tx) =>
        readRunResiduePage(tx, ACME_RUN, { after, limit: 2 }),
      )
      if (page.kind !== 'page') assert.fail(`no page: ${JSON.stringify(page)}`)
      pages += 1
      assert.ok(pages <= 10, 'the cursor is not advancing — this loop would not terminate')
      for (const item of page.items) {
        const address = JSON.stringify(item['ref'])
        assert.ok(
          !seen.includes(address),
          `THE CURSOR REPEATED A ROW ACROSS PAGES: ${address}. An operator working the register ` +
            'would be handed the same open item twice and would have no way to tell.',
        )
        seen.push(address)
      }
      if (page.nextCursor === null) break
      after = decodeResidueCursor(page.nextCursor)
      assert.notEqual(after, null, 'the reader issued a cursor it cannot read back')
    }

    assert.equal(
      seen.length,
      5,
      'THE CURSOR SKIPPED A ROW. Five residue rows were written and paging found ' +
        `${seen.length}. A short page whose nextCursor claims the page was the page is an ` +
        'answer that is wrong and looks right.',
    )
    assert.deepEqual(
      seen,
      whole.items.map((i) => JSON.stringify(i['ref'])),
      'the paged order differs from the whole-page order, so the ordering key is not stable',
    )
  })

  it('a residue row carries its settlement, its cause and its held reads', async () => {
    const page = await withTenantScope(pool(), ACME, (tx) =>
      readRunResiduePage(tx, ACME_RUN, { after: null, limit: 50 }),
    )
    if (page.kind !== 'page') assert.fail(`no page: ${JSON.stringify(page)}`)

    /* 🛑 `settlement: null` IS A VALUE. An item refused at admission has no
     * settlement because it has no AMOUNT, and the first version of this field
     * carried a fabricated zero in a fabricated currency. */
    const refusedRow = page.items[1]
    assert.ok(refusedRow !== undefined)
    assert.equal(refusedRow['settlement'], null, 'a row refused at admission was given an amount')
    assert.deepEqual(refusedRow['cause'], {
      kind: 'admission_refused',
      refusal: { kind: 'amount_not_money', found: 'text' },
    })
    assert.deepEqual(refusedRow['heldReads'], [])

    /* G291's row-level half, with its variance as a decimal string. */
    const declined = page.items[2]
    assert.ok(declined !== undefined)
    assert.deepEqual(declined['cause'], {
      kind: 'amount_tolerance_declined',
      signedVarianceMinor: '-1500',
    })
    assert.deepEqual(declined['settlement'], {
      kind: 'partially_allocated',
      allocated: { currency: 'SGD', amountMinor: '100000', exponent: 2 },
      residual: { currency: 'SGD', amountMinor: '9007199254740993', exponent: 2 },
    })

    /* G227 — the held read carries the ADDRESS and the FLOOR and never the value. */
    const held = page.items[3]
    assert.ok(held !== undefined)
    assert.deepEqual(held['heldReads'], [
      {
        ref: { sourceDocumentId: 'doc_statement', lineIndex: 12 },
        path: wire('lines', 12, 'payer'),
        readConfidence: 0.41,
        floor: 0.8,
      },
      {
        ref: { sourceDocumentId: 'doc_statement', lineIndex: 12 },
        path: wire('lines', 12, 'date'),
        /* NULL IS A STATE: a floor was declared and the extraction reported no
         * confidence at all. Held, not passed. */
        readConfidence: null,
        floor: 0.8,
      },
    ])

    const readerRefused = page.items[4]
    assert.ok(readerRefused !== undefined)
    assert.deepEqual(readerRefused['cause'], { kind: 'reader_refused', refusal: 'response_truncated' })
  })

  /* ================================================================ *
   * 8. A VALUE THE MODEL CANNOT NAME REFUSES THE WHOLE READ.
   * ================================================================ */

  it('an unmodelled stored value fails the WHOLE read rather than being dropped from it', async () => {
    const admin = await migratorClient()
    try {
      /* The column has no CHECK constraint — `0007` declines one on
       * `0002_run.sql`'s argument — so this UPDATE succeeds, which is the point.
       * The narrowing lives at the read boundary in `engine-vocabulary.ts`. */
      await admin.query(
        `UPDATE tenant.run_residue SET cause_kind = 'invented_by_an_operator'
          WHERE tenant_id = $1 AND run_id = $2 AND ordinal = 0`,
        [ACME, ACME_RUN],
      )

      const page = await withTenantScope(pool(), ACME, (tx) =>
        readRunResiduePage(tx, ACME_RUN, { after: null, limit: 50 }),
      )
      assert.equal(
        page.kind,
        'unpublishable',
        'A STORED CAUSE THE MODEL DOES NOT DECLARE REACHED A PAGE. `fast-json-stringify` ' +
          'serialises a response and does not validate one, so the consumer would meet a word ' +
          'its own contract says cannot occur. And dropping the row instead would under-report ' +
          "an operator's open items while nextCursor went on claiming the page was the page — " +
          `an answer that is wrong and looks right. Got: ${JSON.stringify(page).slice(0, 300)}`,
      )
      if (page.kind === 'unpublishable') {
        assert.deepEqual(
          page.defect,
          { table: 'run_residue', column: 'cause_kind', runId: ACME_RUN },
          'the defect must name the table, the column and the run — and NOTHING ELSE. The ' +
            'offending cell is precisely the value nobody vouched for; `errors.yaml` forbids a ' +
            '`detail` from carrying field values.',
        )
      }
    } finally {
      await admin
        .query(
          `UPDATE tenant.run_residue SET cause_kind = 'no_strategy_paired'
            WHERE tenant_id = $1 AND run_id = $2 AND ordinal = 0`,
          [ACME, ACME_RUN],
        )
        .catch(() => undefined)
      await admin.end()
    }
  })

  it('an engine account is write-once — re-persisting one run is refused', async () => {
    let refused: unknown
    try {
      const result = fixture()
      await withTenantScope(pool(), ACME, (tx) =>
        persistRunEngineAccount(tx, {
          runId: ACME_RUN,
          terminalStatus: terminalRunStatus(result),
          result,
        }),
      )
    } catch (err) {
      refused = err
    }
    assert.ok(
      refused !== undefined,
      'A SECOND ENGINE ACCOUNT WAS WRITTEN FOR ONE RUN. `0007` grants SELECT and INSERT and ' +
        'deliberately no UPDATE: a run\'s account of itself is a fact about something that ' +
        'already happened, and the product\'s answer to a wrong result is a RE-RUN with a new ' +
        'id and a required reason. An account that can be amended after the close is a record ' +
        'nothing can tell from the original.',
    )
  })
})
