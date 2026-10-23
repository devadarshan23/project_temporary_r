/**
 * A DEFINITION'S CONTENT, AGAINST A REAL POSTGRESQL —
 * `db/migrations/0160_definition_engine_spec.sql`. G1121–G1126, 20 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE RED, CAPTURED BEFORE THE MIGRATION EXISTED. Run on the tree with
 *    `0160` absent and every other file of this slice present:
 *
 *      error: relation "tenant.definition_engine_spec" does not exist
 *        code: '42P01',
 *        file: 'parse_relation.c',
 *
 *      ✖ a definition`s engine spec (439.692125ms)
 *      ℹ tests 15 · pass 1 · fail 0 · cancelled 14
 *
 *    ⚠️ **READ `fail 0` BEFORE CONCLUDING ANYTHING FROM A COUNT.** The seed is
 *    in `before`, so its throw CANCELS the fourteen rather than failing them,
 *    and the one `pass` is the CI reachability guard. A run that reported
 *    `fail 0` against a schema with none of these tables is exactly the shape
 *    `tools/skip-census.mjs` exists for.
 *
 *    🛑 **AND §3 ASSERTS THE MESSAGE AND NOT MERELY A THROW, BECAUSE OF THAT
 *    RUN.** `assert.rejects(…)` with no predicate passes against
 *    `relation … does not exist` exactly as it passes against
 *    `permission denied` — a grant test written the lazy way would have gone
 *    green on a tree with no grant and no table. §3 matches
 *    `/permission denied/i` AND the table's own name.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT THIS SUITE IS FOR. `readSetReconciliationDefinition()` refusing is a
 *    statement about a code path; these are statements about what the DATABASE
 *    will accept from ANY caller holding the app role, and about whether the
 *    engine's eighteen-field input can be rebuilt WITH NOTHING INVENTED.
 *
 *      · §1  THE ROUND TRIP, FIELD FOR FIELD. Written as the migrator, read
 *            back through the app role inside `withTenantScope()`, compared to
 *            the fixture with `deepEqual`. **The fixture is a real
 *            `SetReconciliationInput`**, so a field the schema cannot carry is
 *            a red here rather than a paragraph somewhere.
 *      · §2  Tenant isolation, the deny-on-NULL arm, and the RLS negative
 *            control.
 *      · §3  `SELECT` and nothing else, on all five tables.
 *      · §4  An unknown vocabulary value is `unreadable` BY COLUMN, never
 *            coerced.
 *      · §5  `ENABLE` **and** `FORCE`, with `0001`'s predicate verbatim on
 *            `USING` **and** `WITH CHECK`, read back from the catalogue.
 *      · §6  No `CHECK` mirrors a model vocabulary.
 *
 * 🛑 THE ALLOW ARM IS FIRST, DELIBERATELY. A control whose only observable
 *    behaviour is refusal is §5.6 — twelve refusals with no permitted case pass
 *    identically against a role that has no `SELECT` either.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ THE TWO DOCUMENT ARRAYS ARE EMPTY AND THAT IS THIS SUITE'S STATEMENT
 *    RATHER THAN A SHORTCUT. Nothing in `server/` produces a `SourceDocument`
 *    — `grep -rn 'ExtractedValue\|ExtractedLine' server/` returns nothing —
 *    so `completeSetReconciliationInput()` takes them from its caller and this
 *    caller has none. §7 asserts the completed input has all EIGHTEEN keys, so
 *    the emptiness is visible as a value rather than as an absence.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import { parseFieldPath } from '../../model/field-path.ts'
import { fieldPathKey } from '../../model/field-path.ts'
import type { FieldPath, FieldPathKey, DataClass, RunId, TenantId } from '../../model/domain.ts'
import type { SetReconciliationInput } from '../../model/reconciliation.ts'
import {
  readSetReconciliationDefinition,
  completeSetReconciliationInput,
} from '../../server/data-plane/definition-store.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE — `db/env.ts` resolves `RECONCILE_DB_NAME` per call and
 * never at import, and two suites sharing one name race inside
 * `createDatabase()`.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_DEFINITION_SPEC_DB_NAME'] ?? runScopedName('reconcile_definition_spec_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

const ACME_DEF = 'def_acme_ap_close'
const GLOBEX_DEF = 'def_globex_ap_close'

const DT_INVOICE = 'dt_invoice'
const DT_STATEMENT = 'dt_statement'

/** 0001's predicate, VERBATIM, as PostgreSQL renders it back. */
const PREDICATE =
  "(tenant_id = NULLIF(current_setting('app.tenant_id'::text, true), ''::text))"

const TABLES = [
  'definition_engine_spec',
  'definition_population',
  'definition_population_identifier',
  'definition_normalisation_op',
  'definition_strategy',
] as const

const probe = await probeDatabase()
const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/db/definition-engine-spec.test.ts DID NOT RUN.',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS IS THE ONLY CONTROL OVER `db/migrations/0160`. A run in which it',
      '   skipped is NOT evidence that a definition can be read back into a',
      "   `SetReconciliationInput`, NOT evidence that the app role cannot write",
      '   one, and NOT evidence that the five new tables are tenant-isolated.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

databaseRequiredUnderCi('the definition engine-spec assertions', probe)

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

/** `parseFieldPath()` is the ONLY producer of a `FieldPath`, here as in `server/`. */
function path(wire: readonly (string | number)[]): FieldPath {
  const parsed = parseFieldPath(wire)
  if (!parsed.ok) throw new Error(`fixture path is unparseable: ${JSON.stringify(wire)}`)
  return parsed.path
}

const AMOUNT_L = path(['header', 'total'])
const DATE_L = path(['header', 'issued'])
const REF_L = path(['header', 'ref'])
const PO_L = path(['lines', 0, 'po'])
const VENDOR_L = path(['header', 'vendor'])
const AMOUNT_R = path(['amount'])
const DATE_R = path(['date'])
const REF_R = path(['ref'])
const MEMO_R = path(['memo'])

/* ⚠️ `dataType` IS CARRIED THOUGH `readSetReconciliationDefinition()` DOES NOT
   READ IT — G1375. `db/migrations/0170` makes the column `NOT NULL`, so a
   fixture must declare one, and declaring an AMOUNT `'string'` merely to
   satisfy a constraint would put a lie in a fixture other readers consult for
   the shape of a real declaration. Each row carries the type its position
   actually holds. */
const CLASS: readonly {
  readonly documentTypeId: string
  readonly path: FieldPath
  readonly dataClass: DataClass
  readonly dataType: string
  readonly modelProcessingAllowed: boolean
  readonly confidenceFloor: number | null
}[] = [
  { documentTypeId: DT_INVOICE, path: AMOUNT_L, dataClass: 'internal', dataType: 'money', modelProcessingAllowed: false, confidenceFloor: null },
  { documentTypeId: DT_INVOICE, path: DATE_L, dataClass: 'internal', dataType: 'date', modelProcessingAllowed: false, confidenceFloor: null },
  { documentTypeId: DT_INVOICE, path: REF_L, dataClass: 'public', dataType: 'identifier', modelProcessingAllowed: true, confidenceFloor: 0.9 },
  { documentTypeId: DT_INVOICE, path: PO_L, dataClass: 'public', dataType: 'identifier', modelProcessingAllowed: true, confidenceFloor: null },
  { documentTypeId: DT_INVOICE, path: VENDOR_L, dataClass: 'personal', dataType: 'string', modelProcessingAllowed: false, confidenceFloor: null },
  /* ⚠️ THE SAME POSITION UNDER BOTH DOCUMENT TYPES, DECLARED IDENTICALLY.
     Invariant 4 says a classification is declared ONCE; two AGREEING
     declarations are one declaration and must pass, and the disagreeing case
     is §4c. */
  { documentTypeId: DT_INVOICE, path: REF_R, dataClass: 'public', dataType: 'identifier', modelProcessingAllowed: true, confidenceFloor: 0.75 },
  { documentTypeId: DT_STATEMENT, path: AMOUNT_R, dataClass: 'internal', dataType: 'money', modelProcessingAllowed: false, confidenceFloor: null },
  { documentTypeId: DT_STATEMENT, path: DATE_R, dataClass: 'internal', dataType: 'date', modelProcessingAllowed: false, confidenceFloor: null },
  { documentTypeId: DT_STATEMENT, path: REF_R, dataClass: 'public', dataType: 'identifier', modelProcessingAllowed: true, confidenceFloor: 0.75 },
  { documentTypeId: DT_STATEMENT, path: MEMO_R, dataClass: 'internal', dataType: 'string', modelProcessingAllowed: false, confidenceFloor: null },
]

const fieldClassification = new Map<FieldPathKey, DataClass>()
const modelPromptEligible = new Set<FieldPathKey>()
const confidenceFloors = new Map<FieldPathKey, number>()
for (const d of CLASS) {
  const key = fieldPathKey(d.path)
  fieldClassification.set(key, d.dataClass)
  if (d.modelProcessingAllowed) modelPromptEligible.add(key)
  if (d.confidenceFloor !== null) confidenceFloors.set(key, d.confidenceFloor)
}

const EXACT_ON_REF = { kind: 'exact_identifier', on: REF_L } as const
const AMOUNT_SUM = { kind: 'amount_sum', maxMembers: 5 } as const
const FUZZY = { kind: 'fuzzy_reference', minSimilarity: 0.85 } as const
const AMOUNT_AND_DATE = { kind: 'amount_and_date' } as const

/**
 * THE FIXTURE IS A REAL `SetReconciliationInput`, so `tsc` is the first
 * assertion in this file: a field the schema cannot carry cannot be dropped
 * from here without a compile error.
 */
const FIXTURE: SetReconciliationInput = {
  runId: 'run_w3a_definition' as RunId,
  tenantId: ACME as TenantId,
  leftDocuments: [],
  rightDocuments: [],
  left: {
    spec: {
      documentTypeId: DT_INVOICE as never,
      amount: AMOUNT_L,
      date: DATE_L,
      identifiers: [REF_L, PO_L],
    },
    declaredUnit: { currency: 'SGD', exponent: 2 },
    carriesControlTotal: 'always',
    emptyExpectation: 'refuses',
    normalisation: {
      ops: [
        { kind: 'trim' },
        { kind: 'strip_literal', literal: 'INV-', at: 'prefix' },
        { kind: 'split_take', separator: '/', index: 1 },
      ],
      then: 'casefold',
      maxInputChars: 256,
    },
    counterparty: VENDOR_L,
    description: null,
  },
  right: {
    spec: {
      documentTypeId: DT_STATEMENT as never,
      amount: AMOUNT_R,
      date: DATE_R,
      identifiers: [REF_R],
    },
    declaredUnit: { currency: 'SGD', exponent: 2 },
    carriesControlTotal: 'never',
    emptyExpectation: 'permitted',
    normalisation: {
      ops: [{ kind: 'strip_leading_zeros' }],
      then: 'digits_only',
      maxInputChars: 64,
    },
    counterparty: null,
    description: MEMO_R,
  },
  pairing: {
    cardinality: 'many_to_many',
    amountTolerance: { kind: 'money', value: { currency: 'SGD', amountMinor: 50n, exponent: 2 } },
    dateTolerance: { kind: 'days', value: 3 },
    strategies: [EXACT_ON_REF, AMOUNT_SUM, FUZZY, AMOUNT_AND_DATE],
  },
  strategyBindings: [
    { strategy: EXACT_ON_REF, amountTolerance: null, amountAnchor: 'exact' },
    { strategy: AMOUNT_SUM, amountTolerance: { kind: 'rounding', minorUnits: 1 }, amountAnchor: 'exact' },
    {
      strategy: FUZZY,
      amountTolerance: { kind: 'money', value: { currency: 'SGD', amountMinor: 100n, exponent: 2 } },
      amountAnchor: 'within_tolerance',
    },
    { strategy: AMOUNT_AND_DATE, amountTolerance: { kind: 'absolute', value: 0.5 }, amountAnchor: 'exact' },
  ],
  obligationSide: 'right',
  toleranceDirection: 'left_greater_only',
  fieldClassification,
  modelPromptEligible,
  confidenceFloors,
  subsetSumBound: { maxMembers: 6, stepBudget: 20000, maxBucketSize: 400 },
  readerCandidateCap: 25,
  similarityMaxChars: 512,
  similarityMetric: 'jaro_winkler',
  admissionRefusalCeilingBasisPoints: 250,
}

const {
  runId: _runId,
  tenantId: _tenantId,
  leftDocuments: _leftDocuments,
  rightDocuments: _rightDocuments,
  ...EXPECTED_STORED
} = FIXTURE

function wire(p: FieldPath): string {
  return JSON.stringify(p.map((s) => (s.kind === 'index' ? s.index : s.key)))
}

async function seed(): Promise<void> {
  await asMigrator(async (q) => {
    await q(
      `INSERT INTO tenant.reconciliation_definition (tenant_id, id, version, status)
       VALUES ($1, $2, 3, 'active'), ($3, $4, 1, 'active')`,
      [ACME, ACME_DEF, GLOBEX, GLOBEX_DEF],
    )

    for (const [tenant, definition] of [
      [ACME, ACME_DEF],
      [GLOBEX, GLOBEX_DEF],
    ] as const) {
      await q(
        `INSERT INTO tenant.definition_engine_spec (
           tenant_id, definition_id, obligation_side, tolerance_direction,
           pairing_cardinality,
           amount_tolerance_kind, amount_tolerance_money_currency,
           amount_tolerance_money_minor, amount_tolerance_money_exponent,
           date_tolerance_kind, date_tolerance_value,
           subset_sum_max_members, subset_sum_step_budget, subset_sum_max_bucket_size,
           reader_candidate_cap, similarity_max_chars, similarity_metric,
           admission_refusal_ceiling_basis_points)
         VALUES ($1, $2, 'right', 'left_greater_only', 'many_to_many',
                 'money', 'SGD', 50, 2,
                 'days', 3,
                 6, 20000, 400,
                 25, 512, 'jaro_winkler', 250)`,
        [tenant, definition],
      )

      await q(
        `INSERT INTO tenant.definition_population (
           tenant_id, definition_id, side, document_type_id,
           amount_path, amount_path_key, date_path, date_path_key,
           declared_unit_currency, declared_unit_exponent,
           carries_control_total, empty_expectation,
           normalisation_then, normalisation_max_input_chars,
           counterparty_path, counterparty_path_key,
           description_path, description_path_key)
         VALUES
           ($1, $2, 'left', $3, $4::jsonb, $5, $6::jsonb, $7, 'SGD', 2,
            'always', 'refuses', 'casefold', 256, $8::jsonb, $9, NULL, NULL),
           ($1, $2, 'right', $10, $11::jsonb, $12, $13::jsonb, $14, 'SGD', 2,
            'never', 'permitted', 'digits_only', 64, NULL, NULL, $15::jsonb, $16)`,
        [
          tenant, definition,
          DT_INVOICE, wire(AMOUNT_L), fieldPathKey(AMOUNT_L), wire(DATE_L), fieldPathKey(DATE_L),
          wire(VENDOR_L), fieldPathKey(VENDOR_L),
          DT_STATEMENT, wire(AMOUNT_R), fieldPathKey(AMOUNT_R), wire(DATE_R), fieldPathKey(DATE_R),
          wire(MEMO_R), fieldPathKey(MEMO_R),
        ],
      )

      await q(
        `INSERT INTO tenant.definition_population_identifier
           (tenant_id, definition_id, side, ordinal, path, path_key)
         VALUES ($1, $2, 'left', 0, $3::jsonb, $4),
                ($1, $2, 'left', 1, $5::jsonb, $6),
                ($1, $2, 'right', 0, $7::jsonb, $8)`,
        [
          tenant, definition,
          wire(REF_L), fieldPathKey(REF_L),
          wire(PO_L), fieldPathKey(PO_L),
          wire(REF_R), fieldPathKey(REF_R),
        ],
      )

      await q(
        `INSERT INTO tenant.definition_normalisation_op
           (tenant_id, definition_id, side, ordinal, op_kind, op_literal, op_at, op_separator, op_index)
         VALUES ($1, $2, 'left',  0, 'trim',                NULL,   NULL,     NULL, NULL),
                ($1, $2, 'left',  1, 'strip_literal',       'INV-', 'prefix', NULL, NULL),
                ($1, $2, 'left',  2, 'split_take',          NULL,   NULL,     '/',  1),
                ($1, $2, 'right', 0, 'strip_leading_zeros', NULL,   NULL,     NULL, NULL)`,
        [tenant, definition],
      )

      await q(
        `INSERT INTO tenant.definition_strategy (
           tenant_id, definition_id, ordinal, strategy_kind,
           strategy_on_path, strategy_on_path_key,
           strategy_max_members, strategy_min_similarity,
           binding_amount_tolerance_kind, binding_amount_tolerance_value,
           binding_amount_tolerance_money_currency, binding_amount_tolerance_money_minor,
           binding_amount_tolerance_money_exponent, binding_amount_tolerance_rounding_minor_units,
           binding_amount_anchor)
         VALUES
           ($1, $2, 0, 'exact_identifier', $3::jsonb, $4, NULL, NULL,
            NULL, NULL, NULL, NULL, NULL, NULL, 'exact'),
           ($1, $2, 1, 'amount_sum', NULL, NULL, 5, NULL,
            'rounding', NULL, NULL, NULL, NULL, 1, 'exact'),
           ($1, $2, 2, 'fuzzy_reference', NULL, NULL, NULL, 0.85,
            'money', NULL, 'SGD', 100, 2, NULL, 'within_tolerance'),
           ($1, $2, 3, 'amount_and_date', NULL, NULL, NULL, NULL,
            'absolute', 0.5, NULL, NULL, NULL, NULL, 'exact')`,
        [tenant, definition, wire(REF_L), fieldPathKey(REF_L)],
      )
    }

    for (const d of CLASS) {
      await q(
        `INSERT INTO tenant.document_field_spec
           (tenant_id, document_type_id, path_key, path, data_class, data_type,
            model_processing_allowed, confidence_floor)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)`,
        [
          ACME,
          d.documentTypeId,
          fieldPathKey(d.path),
          wire(d.path),
          d.dataClass,
          d.dataType,
          d.modelProcessingAllowed,
          d.confidenceFloor,
        ],
      )
    }
  })
}

describe('a definition`s engine spec', { skip }, () => {
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

  /* ================================================================ *
   * §1  THE ROUND TRIP — the allow arm, first
   * ================================================================ */

  it('1 · a stored definition reconstitutes a `SetReconciliationInput`, field for field', async () => {
    const read = await withTenantScope(pool, ACME, (tx) =>
      readSetReconciliationDefinition(tx, ACME_DEF),
    )
    assert.equal(read.kind, 'definition')
    if (read.kind !== 'definition') return
    assert.deepEqual(read.definition, EXPECTED_STORED)
  })

  it('1b · the four run operands complete it, and the input has all EIGHTEEN keys', async () => {
    const read = await withTenantScope(pool, ACME, (tx) =>
      readSetReconciliationDefinition(tx, ACME_DEF),
    )
    assert.equal(read.kind, 'definition')
    if (read.kind !== 'definition') return

    const input = completeSetReconciliationInput(read.definition, {
      runId: FIXTURE.runId,
      tenantId: FIXTURE.tenantId,
      /* ⚠️ EMPTY, AND STATED. Nothing in `server/` produces a `SourceDocument`;
         this suite supplies the arrays because the reader deliberately does
         not. See the file header. */
      leftDocuments: [],
      rightDocuments: [],
    })
    assert.deepEqual(input, FIXTURE)
    assert.equal(Object.keys(input).length, 18)
  })

  it('1c · the strategy list and its bindings are ONE row set, so they cannot disagree', async () => {
    const read = await withTenantScope(pool, ACME, (tx) =>
      readSetReconciliationDefinition(tx, ACME_DEF),
    )
    assert.equal(read.kind, 'definition')
    if (read.kind !== 'definition') return
    const { pairing, strategyBindings } = read.definition
    assert.equal(pairing.strategies.length, strategyBindings.length)
    for (let i = 0; i < strategyBindings.length; i += 1) {
      assert.deepEqual(strategyBindings[i]?.strategy, pairing.strategies[i])
    }
  })

  it('1d · an unknown definition is `no_definition`, not an empty spec', async () => {
    const read = await withTenantScope(pool, ACME, (tx) =>
      readSetReconciliationDefinition(tx, 'def_nobody_wrote_this'),
    )
    assert.equal(read.kind, 'no_definition')
  })

  /* ================================================================ *
   * §2  ISOLATION
   * ================================================================ */

  it('2 · another tenant`s definition is invisible, asked for by its exact id', async () => {
    const read = await withTenantScope(pool, ACME, (tx) =>
      readSetReconciliationDefinition(tx, GLOBEX_DEF),
    )
    assert.equal(read.kind, 'no_definition')
  })

  it('2b · a read OUTSIDE a tenant scope sees nothing at all — G100 denies on NULL', async () => {
    const client = await pool.connect()
    try {
      const rows = await client.query(
        'SELECT definition_id FROM tenant.definition_engine_spec',
        [],
      )
      assert.equal(rows.rows.length, 0)
    } finally {
      client.release()
    }
  })

  it('2c · with RLS DISABLED on the spec table the SAME read LEAKS both tenants', async () => {
    await asMigrator((q) =>
      q('ALTER TABLE tenant.definition_engine_spec DISABLE ROW LEVEL SECURITY'),
    )
    try {
      const rows = await withTenantScope(pool, ACME, (tx) =>
        tx.query('SELECT definition_id FROM tenant.definition_engine_spec ORDER BY definition_id', []),
      )
      assert.equal(rows.rows.length, 2)
    } finally {
      await asMigrator((q) =>
        q('ALTER TABLE tenant.definition_engine_spec ENABLE ROW LEVEL SECURITY'),
      )
    }
  })

  /* ================================================================ *
   * §3  THE GRANT — `SELECT` and nothing else, on all five
   * ================================================================ */

  it('3 · the app role cannot INSERT, UPDATE or DELETE any of the five tables', async () => {
    const statements: readonly [string, string][] = [
      [
        'definition_engine_spec',
        `INSERT INTO tenant.definition_engine_spec
           (tenant_id, definition_id, obligation_side, tolerance_direction, pairing_cardinality,
            amount_tolerance_kind, date_tolerance_kind, date_tolerance_value,
            subset_sum_max_members, subset_sum_step_budget, subset_sum_max_bucket_size,
            reader_candidate_cap, similarity_max_chars, similarity_metric,
            admission_refusal_ceiling_basis_points)
         VALUES ('${ACME}', 'def_forged', 'left', 'symmetric', 'one_to_one',
                 'days', 'days', 1, 2, 2, 2, 2, 2, 'levenshtein_ratio', 0)`,
      ],
      ['definition_engine_spec', `UPDATE tenant.definition_engine_spec SET reader_candidate_cap = 9999`],
      ['definition_engine_spec', `DELETE FROM tenant.definition_engine_spec`],
      ['definition_population', `UPDATE tenant.definition_population SET document_type_id = 'dt_forged'`],
      ['definition_population', `DELETE FROM tenant.definition_population`],
      ['definition_population_identifier', `DELETE FROM tenant.definition_population_identifier`],
      ['definition_normalisation_op', `DELETE FROM tenant.definition_normalisation_op`],
      ['definition_strategy', `UPDATE tenant.definition_strategy SET strategy_min_similarity = 0`],
      ['definition_strategy', `DELETE FROM tenant.definition_strategy`],
    ]

    for (const [table, sql] of statements) {
      await assert.rejects(
        withTenantScope(pool, ACME, (tx) => tx.query(sql, [])),
        (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error)
          assert.match(message, /permission denied/i)
          assert.match(message, new RegExp(table))
          return true
        },
        `${sql} must be refused`,
      )
    }
  })

  /* ================================================================ *
   * §4  AN UNKNOWN VALUE IS REFUSED BY COLUMN, NEVER COERCED
   * ================================================================ */

  it('4 · an out-of-vocabulary `similarity_metric` refuses the read BY COLUMN', async () => {
    await asMigrator((q) =>
      q(
        `UPDATE tenant.definition_engine_spec SET similarity_metric = 'jaro-winkler'
          WHERE definition_id = $1`,
        [ACME_DEF],
      ),
    )
    try {
      const read = await withTenantScope(pool, ACME, (tx) =>
        readSetReconciliationDefinition(tx, ACME_DEF),
      )
      assert.equal(read.kind, 'unreadable')
      if (read.kind !== 'unreadable') return
      assert.equal(read.defect.column, 'similarity_metric')
      assert.equal(read.defect.table, 'definition_engine_spec')
      assert.equal(read.defect.definitionId, ACME_DEF)
    } finally {
      await asMigrator((q) =>
        q(
          `UPDATE tenant.definition_engine_spec SET similarity_metric = 'jaro_winkler'
            WHERE definition_id = $1`,
          [ACME_DEF],
        ),
      )
    }
  })

  it('4b · an out-of-vocabulary `op_kind` refuses the read BY COLUMN', async () => {
    await asMigrator((q) =>
      q(
        `UPDATE tenant.definition_normalisation_op SET op_kind = 'uppercase'
          WHERE definition_id = $1 AND side = 'right'`,
        [ACME_DEF],
      ),
    )
    try {
      const read = await withTenantScope(pool, ACME, (tx) =>
        readSetReconciliationDefinition(tx, ACME_DEF),
      )
      assert.equal(read.kind, 'unreadable')
      if (read.kind !== 'unreadable') return
      assert.equal(read.defect.column, 'op_kind')
    } finally {
      await asMigrator((q) =>
        q(
          `UPDATE tenant.definition_normalisation_op SET op_kind = 'strip_leading_zeros'
            WHERE definition_id = $1 AND side = 'right'`,
          [ACME_DEF],
        ),
      )
    }
  })

  it('4c · TWO document types DISAGREEING about one position refuse the read — invariant 4', async () => {
    await asMigrator((q) =>
      q(
        `UPDATE tenant.document_field_spec SET data_class = 'sensitive_personal'
          WHERE document_type_id = $1 AND path_key = $2`,
        [DT_STATEMENT, fieldPathKey(REF_R)],
      ),
    )
    try {
      const read = await withTenantScope(pool, ACME, (tx) =>
        readSetReconciliationDefinition(tx, ACME_DEF),
      )
      assert.equal(read.kind, 'unreadable')
      if (read.kind !== 'unreadable') return
      assert.equal(read.defect.table, 'document_field_spec')
      assert.equal(read.defect.column, 'data_class')
    } finally {
      await asMigrator((q) =>
        q(
          `UPDATE tenant.document_field_spec SET data_class = 'public'
            WHERE document_type_id = $1 AND path_key = $2`,
          [DT_STATEMENT, fieldPathKey(REF_R)],
        ),
      )
    }
  })

  /* ================================================================ *
   * §5  THE POLICIES, READ BACK FROM THE CATALOGUE
   * ================================================================ */

  it('5 · all five tables ENABLE and FORCE row level security', async () => {
    const rows = await asMigrator((q) =>
      q(
        `SELECT c.relname::text AS relname, c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'tenant' AND c.relname = ANY($1::text[])
          ORDER BY c.relname`,
        [TABLES],
      ),
    )
    const found = rows.rows as { relname: string; enabled: boolean; forced: boolean }[]
    assert.equal(found.length, TABLES.length)
    for (const row of found) {
      assert.equal(row.enabled, true, `${row.relname} must ENABLE RLS`)
      assert.equal(row.forced, true, `${row.relname} must FORCE RLS`)
    }
  })

  it('5b · each policy carries 0001`s predicate VERBATIM on USING and on WITH CHECK', async () => {
    const rows = await asMigrator((q) =>
      q(
        `SELECT tablename::text AS tablename, qual::text AS qual, with_check::text AS with_check
           FROM pg_policies
          WHERE schemaname = 'tenant' AND tablename = ANY($1::text[])
          ORDER BY tablename`,
        [TABLES],
      ),
    )
    const found = rows.rows as { tablename: string; qual: string; with_check: string }[]
    assert.equal(found.length, TABLES.length)
    for (const row of found) {
      assert.equal(row.qual, PREDICATE, `${row.tablename} USING`)
      assert.equal(row.with_check, PREDICATE, `${row.tablename} WITH CHECK`)
    }
  })

  /* ================================================================ *
   * §6  NO `CHECK` MIRRORS A MODEL VOCABULARY
   * ================================================================ */

  it('6 · no CHECK constraint on the five tables names a vocabulary member', async () => {
    const rows = await asMigrator((q) =>
      q(
        `SELECT con.conname::text AS conname,
                pg_get_constraintdef(con.oid)::text AS def
           FROM pg_constraint con
           JOIN pg_class c ON c.oid = con.conrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'tenant' AND con.contype = 'c'
            AND c.relname = ANY($1::text[])`,
        [TABLES],
      ),
    )
    /* Members of vocabularies `model/` already owns. A `CHECK` naming one is a
       third place to drift and `0007`'s decision refuses it; the wholeness
       constraints `0160` DOES carry name no member at all — they are facts
       about this schema's decomposition, which is `0015`'s distinction. */
    const MEMBERS = [
      'symmetric', 'left_greater_only', 'right_greater_only',
      'levenshtein_ratio', 'jaro_winkler',
      'one_to_one', 'one_to_many', 'many_to_one', 'many_to_many',
      'exact_identifier', 'amount_and_date', 'amount_sum', 'fuzzy_reference',
      'trim', 'strip_leading_zeros', 'strip_literal', 'split_take',
      'casefold', 'digits_only', 'name_normalise',
      'within_tolerance', 'permitted', 'refuses', 'always', 'never',
      'absolute', 'percentage', 'similarity', 'rounding',
    ]
    for (const row of rows.rows as { conname: string; def: string }[]) {
      for (const member of MEMBERS) {
        assert.ok(
          !new RegExp(`'${member}'`).test(row.def),
          `${row.conname} names the vocabulary member '${member}': ${row.def}`,
        )
      }
    }
  })
})
