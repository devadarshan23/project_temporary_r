/**
 * DOCUMENT ASSEMBLY, AGAINST A REAL POSTGRESQL —
 * `server/data-plane/document-assembly.ts`. G1501–G1508, 21 Sep 2026. E4.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE RED, CAPTURED BEFORE THE MODULE EXISTED. Run on the tree with this
 *    file present and `server/data-plane/document-assembly.ts` absent:
 *
 *      Error: Cannot find module
 *        '/…/server/data-plane/document-assembly.ts'
 *        imported from '/…/tests/db/document-assembly.test.ts'
 *        code: 'ERR_MODULE_NOT_FOUND'
 *
 *    ⚠️ **THAT RED IS A MODULE-RESOLUTION FAILURE AND IS THEREFORE THE WEAKEST
 *    OF THE TWO THIS FILE CAPTURED.** It proves the file is absent and nothing
 *    else. **The red worth reading is §1c's, taken BY MUTATION against the
 *    finished module with the four-line line-grain guard deleted and
 *    everything else intact:**
 *
 *      ✖ 1c · a payload whose declarations address ARRAY POSITIONS is refused
 *          actual: true,
 *          expected: false,
 *          operator: 'strictEqual'
 *      ✖ 6 · no refusal in this suite carried a payload value
 *      ℹ fail 2
 *
 *    `out.ok` was **true**: a THREE-ROW ledger assembled clean, as ONE
 *    `ReconciliationDocument` carrying three keys, which `presentedRows()`
 *    then presents as ONE transaction. §6 fell with it because there was no
 *    refusal left to inspect. See §1c's own comment for why that is worse
 *    than a crash.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT THIS SUITE IS FOR. It is the first evidence in this repository that
 *    an `ExtractedValue` can be produced from stored rows at all — before this
 *    slice, `grep -rn 'ExtractedValue\|ExtractedLine' server/ | grep -v
 *    '^\S*: *\*'` returned NOTHING and `definition-store.ts` §0 said in its own
 *    voice that the two document arrays *"CANNOT BE REPRESENTED"*.
 *
 *      · §1  THE ALLOW ARM, FIRST — bound documents become
 *            `ReconciliationDocument`s whose every field came out of a column.
 *            **A control whose only observable behaviour is refusal is §5.6.**
 *      · §2  INVARIANT 4 — the kind comes from `data_type` and never from the
 *            value, witnessed on the position E1's own fixture was built to
 *            catch: `money` declared, JSON number stored.
 *      · §3  Tenant isolation, and the deny-on-NULL arm.
 *      · §4  Every refusal, BY NAME, each with the fixture that reaches it.
 *      · §5  R12 — a `scanned` document is refused ONCE, at the document, and
 *            not ten thousand times at its positions.
 *      · §6  The refusal union carries no counterparty text.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ `lines` IS ALWAYS `[]` AND THAT IS THE MODULE'S STATEMENT RATHER THAN A
 *    SHORTCUT, witnessed here so it cannot be read as an oversight.
 *    `readAddressablePayload()` is HEADER-GRAIN: it loops the declarations in
 *    `tenant.document_field_spec` and returns one flat
 *    `Record<FieldPathKey, AddressableValue>`. **There is no line-grain read
 *    anywhere in this repository**, so `ExtractedLine[]` has no producer, and
 *    §1c is the guard that stops the absence becoming a silent under-count.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import { parseFieldPath, fieldPathKey } from '../../model/field-path.ts'
import type { FieldPath, TenantId } from '../../model/domain.ts'
import type { PopulationBinding } from '../../model/reconciliation.ts'
import { assembleRunDocuments } from '../../server/data-plane/document-assembly.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE — `db/env.ts` resolves `RECONCILE_DB_NAME` per call and
 * never at import, and two suites sharing one name race inside
 * `createDatabase()`.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_DOCUMENT_ASSEMBLY_DB_NAME'] ?? runScopedName('reconcile_document_assembly_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

/* ONE DEFINITION PER CASE. The alternative — one definition and a `slots`
 * argument narrowing which bindings to read — would have put a parameter on
 * `assembleRunDocuments()` that exists only for this suite, and a production
 * signature shaped by a test is how a reader comes to believe a caller chooses
 * its own operands. `0150` keys a binding on (definition, slot, period), so
 * separate definitions is the cheapest honest separation. */
const DEF_PAIR = 'def_pair'
const DEF_BAD_MONEY = 'def_bad_money'
const DEF_SCANNED = 'def_scanned'
const DEF_LINES = 'def_lines'
const DEF_ORPHAN = 'def_orphan'
const DEFS = [DEF_PAIR, DEF_BAD_MONEY, DEF_SCANNED, DEF_LINES, DEF_ORPHAN] as const
const GLOBEX_DEF = 'def_globex_ap_close'

const DT_INVOICE = 'dt_invoice'
const DT_STATEMENT = 'dt_statement'
const DT_SCANNED = 'dt_scanned'
const DT_LINES = 'dt_lines'
const DT_ORPHAN = 'dt_orphan'

const CHANNEL = 'chan_api'

const probe = await probeDatabase()
const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/db/document-assembly.test.ts DID NOT RUN.',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS IS THE ONLY CONTROL OVER `server/data-plane/document-assembly.ts`.',
      '   A run in which it skipped is NOT evidence that a stored document can',
      '   become an engine operand, NOT evidence that invariant 4 decides the',
      '   scalar kind, and NOT evidence that a line-grain payload is refused',
      '   rather than silently folded into one presented row.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

databaseRequiredUnderCi('the document-assembly assertions', probe)

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
const AMOUNT_R = path(['amount'])
const DATE_R = path(['date'])
const REF_R = path(['ref'])
/* §1c's operand — an ARRAY POSITION, which is how somebody would try to
 * express a line-grain ledger through a header-grain declaration table. */
const LINE_0_REF = path(['lines', 0, 'ref'])

function wire(p: FieldPath): string {
  return JSON.stringify(p.map((s) => (s.kind === 'index' ? s.index : s.key)))
}

/**
 * 🛑 `JSON.stringify` ON ANYTHING CARRYING A `Money` **THROWS**, AND THIS
 *    HELPER EXISTS BECAUSE IT TOOK THIS SUITE DOWN — the THIRD time that has
 *    happened in W1 by the completion plan's own account.
 *
 *      TypeError [Error]: Do not know how to serialize a BigInt
 *        at JSON.stringify (<anonymous>)
 *
 *    **The failure was in an assertion MESSAGE, not in the code under test** —
 *    `assert.equal(out.ok, true, show(out))` — so a passing
 *    assertion's own diagnostic is what failed. G71 calls the throw a FEATURE:
 *    `Money.amountMinor` is `bigint`, JSON has no bigint, and a silent lossy
 *    coercion to an IEEE double is exactly what invariant 5 and `model/money.ts`
 *    exist to prevent. **The repair is a replacer and never a `Number()`.**
 */
function show(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v))
}

interface Spec {
  readonly documentTypeId: string
  readonly path: FieldPath
  readonly dataClass: string
  readonly dataType: string
}

const SPECS: readonly Spec[] = [
  { documentTypeId: DT_INVOICE, path: AMOUNT_L, dataClass: 'internal', dataType: 'money' },
  { documentTypeId: DT_INVOICE, path: DATE_L, dataClass: 'internal', dataType: 'date' },
  /* 🛑 INVARIANT 4's WITNESS. Declared `identifier`; §2 stores the JSON STRING
   * `"0012"`, which a sniffing converter would call `text` — and `"0012"` is
   * then the same identifier as `"12"` to anything that later normalises it. */
  { documentTypeId: DT_INVOICE, path: REF_L, dataClass: 'public', dataType: 'identifier' },

  { documentTypeId: DT_STATEMENT, path: AMOUNT_R, dataClass: 'internal', dataType: 'money' },
  { documentTypeId: DT_STATEMENT, path: DATE_R, dataClass: 'internal', dataType: 'date' },
  { documentTypeId: DT_STATEMENT, path: REF_R, dataClass: 'public', dataType: 'identifier' },

  { documentTypeId: DT_SCANNED, path: AMOUNT_R, dataClass: 'internal', dataType: 'money' },

  { documentTypeId: DT_LINES, path: LINE_0_REF, dataClass: 'public', dataType: 'identifier' },

  { documentTypeId: DT_ORPHAN, path: REF_R, dataClass: 'public', dataType: 'identifier' },
]

/** A document type whose declared `expectedFidelity` and trailer posture matter. */
interface TypeRow {
  readonly id: string
  readonly key: string
  readonly fidelity: string
  readonly carries: 'always' | 'never'
}

const TYPES: readonly TypeRow[] = [
  { id: DT_INVOICE, key: 'invoice', fidelity: 'structured', carries: 'always' },
  { id: DT_STATEMENT, key: 'statement', fidelity: 'structured', carries: 'never' },
  /* §5 — R12. `scanned` crosses a managed-service boundary and extraction for
   * it is NOT BUILT. G7/G8 are both `not applied`, so invariant 7 has nothing
   * to enforce against on that path. */
  { id: DT_SCANNED, key: 'scanned', fidelity: 'scanned', carries: 'never' },
  { id: DT_LINES, key: 'lines', fidelity: 'structured', carries: 'never' },
  { id: DT_ORPHAN, key: 'orphan', fidelity: 'structured', carries: 'never' },
]

/** One stored document: its type, its payload, and what its trailer said. */
interface DocRow {
  readonly id: string
  readonly typeId: string
  readonly payload: unknown
  readonly control: {
    readonly kind: string
    readonly lineCount: number | null
    readonly currency: string | null
    readonly minor: string | null
    readonly exponent: number | null
  }
}

const NO_TRAILER = {
  kind: 'not_declared_by_format',
  lineCount: null,
  currency: null,
  minor: null,
  exponent: null,
} as const

const DOCS: readonly DocRow[] = [
  {
    id: 'sd_invoice_1',
    typeId: DT_INVOICE,
    /* 🛑 `total` IS A JSON NUMBER AT A `money` POSITION. E1's fixture is built
     * around exactly this and E2 refuses it: a `money` declaration wants
     * `MoneyWire`, and a bare number is `money_not_in_wire_form`. §4a. */
    payload: { header: { total: 1000, issued: '2026-04-01', ref: '0012' } },
    control: {
      kind: 'declared',
      lineCount: 1,
      currency: 'SGD',
      minor: '100000',
      exponent: 2,
    },
  },
  {
    id: 'sd_invoice_ok',
    typeId: DT_INVOICE,
    payload: {
      header: {
        total: { currency: 'SGD', amountMinor: '100000', exponent: 2 },
        issued: '2026-04-01',
        ref: '0012',
      },
    },
    control: {
      kind: 'declared',
      lineCount: 1,
      currency: 'SGD',
      minor: '100000',
      exponent: 2,
    },
  },
  {
    id: 'sd_statement_ok',
    typeId: DT_STATEMENT,
    payload: {
      amount: { currency: 'SGD', amountMinor: '100000', exponent: 2 },
      date: '2026-04-02',
      ref: '12',
    },
    control: NO_TRAILER,
  },
  {
    id: 'sd_scanned',
    typeId: DT_SCANNED,
    payload: { amount: { currency: 'SGD', amountMinor: '5000', exponent: 2 } },
    control: NO_TRAILER,
  },
  {
    id: 'sd_lines',
    typeId: DT_LINES,
    payload: { lines: [{ ref: 'A1' }, { ref: 'A2' }, { ref: 'A3' }] },
    control: NO_TRAILER,
  },
  {
    id: 'sd_orphan',
    typeId: DT_ORPHAN,
    payload: { ref: 'ZZ' },
    control: NO_TRAILER,
  },
]

/** Which documents each definition binds, and under which slot. */
const SLOTS: readonly { readonly definition: string; readonly slot: string; readonly doc: string }[] = [
  { definition: DEF_PAIR, slot: 'ledger', doc: 'sd_invoice_ok' },
  { definition: DEF_PAIR, slot: 'bank', doc: 'sd_statement_ok' },
  { definition: DEF_BAD_MONEY, slot: 'ledger', doc: 'sd_invoice_1' },
  { definition: DEF_SCANNED, slot: 'scanned', doc: 'sd_scanned' },
  { definition: DEF_LINES, slot: 'lines', doc: 'sd_lines' },
  { definition: DEF_ORPHAN, slot: 'orphan', doc: 'sd_orphan' },
]

function binding(documentTypeId: string, amount: FieldPath, date: FieldPath, ref: FieldPath): PopulationBinding {
  return {
    spec: {
      documentTypeId: documentTypeId as never,
      amount,
      date,
      identifiers: [ref],
    },
    declaredUnit: { currency: 'SGD', exponent: 2 },
    carriesControlTotal: 'always',
    emptyExpectation: 'permitted',
    normalisation: { ops: [{ kind: 'trim' }], then: 'casefold', maxInputChars: 64 },
    counterparty: null,
    description: null,
  }
}

const LEFT = binding(DT_INVOICE, AMOUNT_L, DATE_L, REF_L)
const RIGHT = binding(DT_STATEMENT, AMOUNT_R, DATE_R, REF_R)

async function seed(): Promise<void> {
  await asMigrator(async (q) => {
    for (const [tenant, definition] of [
      ...DEFS.map((d) => [ACME, d] as const),
      [GLOBEX, GLOBEX_DEF] as const,
    ]) {
      await q(
        `INSERT INTO tenant.reconciliation_definition (tenant_id, id, version, status)
         VALUES ($1, $2, 1, 'active')`,
        [tenant, definition],
      )
    }

    await q(
      `INSERT INTO tenant.intake_channel (tenant_id, id, kind, endpoint_id, enabled)
       VALUES ($1, $2, 'api', NULL, true), ($3, $2, 'api', NULL, true)`,
      [ACME, CHANNEL, GLOBEX],
    )

    for (const t of TYPES) {
      await q(
        `INSERT INTO tenant.document_type
           (tenant_id, id, key, label, domain, expected_fidelity, carries_control_total)
         VALUES ($1, $2, $3, $4, 'finance', $5, $6)`,
        [ACME, t.id, t.key, t.key, t.fidelity, t.carries],
      )
    }

    for (const s of SPECS) {
      await q(
        `INSERT INTO tenant.document_field_spec
           (tenant_id, document_type_id, path_key, path, data_class, data_type,
            model_processing_allowed, confidence_floor)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, false, NULL)`,
        [ACME, s.documentTypeId, fieldPathKey(s.path), wire(s.path), s.dataClass, s.dataType],
      )
    }

    for (const d of DOCS) {
      await q(
        `INSERT INTO tenant.arrival
           (tenant_id, id, channel_id, channel_kind, arrived_at, verdict_kind, authorization_id,
            source_document_id)
         VALUES ($1, $2, $3, 'api', now(), 'admitted', 'auth_fixture', $4)`,
        [ACME, `arr_${d.id}`, CHANNEL, d.id],
      )
      await q(
        `INSERT INTO tenant.source_document
           (tenant_id, id, arrival_id, document_type_id, ingested_at)
         VALUES ($1, $2, $3, $4, now())`,
        [ACME, d.id, `arr_${d.id}`, d.typeId],
      )
      await q(
        `INSERT INTO tenant.document_payload (tenant_id, source_document_id, payload)
         VALUES ($1, $2, $3::jsonb)`,
        [ACME, d.id, JSON.stringify(d.payload)],
      )
      await q(
        `INSERT INTO tenant.document_control_total
           (tenant_id, source_document_id, kind, line_count,
            total_currency, total_minor, total_exponent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          ACME,
          d.id,
          d.control.kind,
          d.control.lineCount,
          d.control.currency,
          d.control.minor,
          d.control.exponent,
        ],
      )
    }

    for (const s of SLOTS) {
      await q(
        `INSERT INTO tenant.definition_slot (tenant_id, definition_id, slot, cardinality)
         VALUES ($1, $2, $3, 'exactly_one')`,
        [ACME, s.definition, s.slot],
      )
      await q(
        `INSERT INTO tenant.document_slot_binding
           (tenant_id, definition_id, slot, period_id, source_document_id)
         VALUES ($1, $2, $3, NULL, $4)`,
        [ACME, s.definition, s.slot, s.doc],
      )
    }
  })
}

async function assembleOver(
  pool: TenantPool,
  tenant: string,
  definitionId: string,
  left: PopulationBinding = LEFT,
  right: PopulationBinding = RIGHT,
): ReturnType<typeof assembleRunDocuments> {
  return withTenantScope(pool, tenant, async (tx) =>
    assembleRunDocuments(tx, {
      tenantId: tenant as TenantId,
      definitionId: definitionId as never,
      periodId: null,
      left,
      right,
    }),
  )
}

describe('document assembly — stored rows become engine operands', { skip }, () => {
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
   * §1  THE ALLOW ARM — first, because a control that only refuses is §5.6
   * ================================================================ */

  it('1 · two bound documents become two `ReconciliationDocument`s, one per side', async () => {
    const out = await assembleOver(pool, ACME, DEF_PAIR)
    assert.equal(out.ok, true, show(out))
    if (!out.ok) return

    assert.equal(out.left.length, 1)
    assert.equal(out.right.length, 1)
    assert.equal(out.left[0]?.id, 'sd_invoice_ok')
    assert.equal(out.right[0]?.id, 'sd_statement_ok')
    /* Invariant 1 — the SCOPE's tenant, never a column's. */
    assert.equal(out.left[0]?.tenantId, ACME)
  })

  it('1a · every field came out of a column — nothing was invented', async () => {
    const out = await assembleOver(pool, ACME, DEF_PAIR)
    assert.equal(out.ok, true)
    if (!out.ok) return
    const doc = out.left[0]
    assert.ok(doc)

    /* FIVE keys and no more. `filename`, `storageRef`, `synthetic`,
     * `purgeAfter` and `purgedAt` have NO COLUMN — `0012` §3 refuses each by
     * name — so a sixth key here would be a fact this repository does not
     * hold. That is what `ReconciliationDocument` being a `Pick` buys. */
    assert.deepEqual(Object.keys(doc).sort(), [
      'controlTotal',
      'extracted',
      'id',
      'lines',
      'tenantId',
    ])
  })

  it('1b · the trailer is the stored one, in all three arms and never a default', async () => {
    const out = await assembleOver(pool, ACME, DEF_PAIR)
    assert.equal(out.ok, true)
    if (!out.ok) return

    assert.deepEqual(out.left[0]?.controlTotal, {
      kind: 'declared',
      lineCount: 1,
      total: { currency: 'SGD', amountMinor: 100000n, exponent: 2 },
    })
    assert.deepEqual(out.right[0]?.controlTotal, { kind: 'not_declared_by_format' })
  })

  it('1c · a payload whose declarations address ARRAY POSITIONS is refused', async () => {
    /* 🛑 THIS IS THE ASSERTION THE SLICE EXISTS FOR AND IT WENT RED FIRST.
     * `readAddressablePayload()` is header-grain: three declared
     * `lines[n].ref` positions come back in ONE flat map, so `presentedRows()`
     * — which returns a single row when `lines.length === 0` — presents a
     * THREE-ROW ledger as ONE transaction. `presented: 1`, `admitted: 1`, and
     * C18 raises nothing when the format declares no trailer. A run that
     * reconciles one row of three and reports success is the exact failure
     * `withTenantScope()`'s deny-on-NULL paragraph warns about, arriving
     * through extraction instead of through RLS. */
    const out = await assembleOver(
      pool,
      ACME,
      DEF_LINES,
      binding(DT_LINES, AMOUNT_L, DATE_L, LINE_0_REF),
      RIGHT,
    )
    assert.equal(out.ok, false)
    if (out.ok) return
    assert.equal(out.refusal.kind, 'line_grain_not_representable')
  })

  /* ================================================================ *
   * §2  INVARIANT 4 — the kind is the DECLARATION's, never the value's
   * ================================================================ */

  it('2 · `"0012"` at an `identifier` position is an identifier, not text', async () => {
    const out = await assembleOver(pool, ACME, DEF_PAIR)
    assert.equal(out.ok, true)
    if (!out.ok) return
    const extracted = out.left[0]?.extracted ?? {}
    const value = extracted[fieldPathKey(REF_L)]
    assert.ok(value, 'the declared identifier position is missing')
    assert.equal(value.scalar.kind, 'identifier')
  })

  it('2a · a `money` position reaches `model/money.ts` and arrives as a `bigint`', async () => {
    const out = await assembleOver(pool, ACME, DEF_PAIR)
    assert.equal(out.ok, true)
    if (!out.ok) return
    const value = (out.left[0]?.extracted ?? {})[fieldPathKey(AMOUNT_L)]
    assert.ok(value)
    assert.equal(value.scalar.kind, 'money')
    if (value.scalar.kind !== 'money') return
    assert.equal(value.scalar.value.amountMinor, 100000n)
  })

  it('2b · provenance is the DECLARED absence of a confidence, never a manufactured 1.0', async () => {
    const out = await assembleOver(pool, ACME, DEF_PAIR)
    assert.equal(out.ok, true)
    if (!out.ok) return
    const value = (out.left[0]?.extracted ?? {})[fieldPathKey(REF_L)]
    assert.ok(value)
    assert.deepEqual(value.provenance, { page: null, boundingBox: null, confidence: null })
  })

  /* ================================================================ *
   * §3  ISOLATION
   * ================================================================ */

  it('3 · another tenant`s scope sees none of these bindings', async () => {
    const out = await assembleOver(pool, GLOBEX, GLOBEX_DEF)
    /* GLOBEX has the definition row and NO bindings, so assembly succeeds with
     * nothing on either side. The engine's `emptyExpectation` is what decides
     * whether that is an error — not this module. */
    assert.equal(out.ok, true)
    if (!out.ok) return
    assert.equal(out.left.length, 0)
    assert.equal(out.right.length, 0)
  })

  it('3a · outside a scope the read is EMPTY, which is G100 denying on NULL', async () => {
    const bare = await pool.connect()
    try {
      const rows = await bare.query(
        'SELECT source_document_id FROM tenant.document_slot_binding WHERE definition_id = $1',
        [DEF_PAIR],
      )
      assert.equal(rows.rows.length, 0)
    } finally {
      bare.release()
    }
  })

  /* ================================================================ *
   * §4  EVERY REFUSAL, BY NAME
   * ================================================================ */

  it('4a · a JSON number at a `money` position is refused, never coerced', async () => {
    const out = await assembleOver(pool, ACME, DEF_BAD_MONEY)
    assert.equal(out.ok, false)
    if (out.ok) return
    assert.equal(out.refusal.kind, 'position_not_extractable')
    if (out.refusal.kind !== 'position_not_extractable') return
    assert.equal(out.refusal.refusal.kind, 'money_not_in_wire_form')
  })

  it('4b · a bound document whose type is neither side`s is refused', async () => {
    const out = await assembleOver(pool, ACME, DEF_ORPHAN)
    assert.equal(out.ok, false)
    if (out.ok) return
    assert.equal(out.refusal.kind, 'document_matches_no_side')
  })

  it('4c · two sides declaring ONE document type is refused once, at the definition', async () => {
    const out = await assembleOver(pool, ACME, DEF_PAIR, LEFT, LEFT)
    assert.equal(out.ok, false)
    if (out.ok) return
    assert.equal(out.refusal.kind, 'sides_share_a_document_type')
  })

  /* ================================================================ *
   * §5  R12 — refused ONCE, at the document
   * ================================================================ */

  it('5 · a `scanned` document is refused at the DOCUMENT and not at its positions', async () => {
    const out = await assembleOver(
      pool,
      ACME,
      DEF_SCANNED,
      binding(DT_SCANNED, AMOUNT_R, DATE_R, REF_R),
      RIGHT,
    )
    assert.equal(out.ok, false)
    if (out.ok) return
    assert.equal(out.refusal.kind, 'fidelity_crosses_managed_service')
    if (out.refusal.kind !== 'fidelity_crosses_managed_service') return
    assert.equal(out.refusal.fidelity, 'scanned')
    /* ⚠️ THE SOURCE DOCUMENT IS NAMED. An operator's next act is to look at
     * the file, and a refusal that named only the rung would not say which. */
    assert.equal(out.refusal.sourceDocumentId, 'sd_scanned')
  })

  /* ================================================================ *
   * §6  THE REFUSAL CARRIES NO COUNTERPARTY TEXT
   * ================================================================ */

  it('6 · no refusal in this suite carried a payload value', async () => {
    const cases: readonly (readonly [string, PopulationBinding, PopulationBinding])[] = [
      [DEF_BAD_MONEY, LEFT, RIGHT],
      [DEF_ORPHAN, LEFT, RIGHT],
      [DEF_SCANNED, binding(DT_SCANNED, AMOUNT_R, DATE_R, REF_R), RIGHT],
      [DEF_LINES, binding(DT_LINES, AMOUNT_L, DATE_L, LINE_0_REF), RIGHT],
    ]
    for (const [definition, left, right] of cases) {
      const out = await assembleOver(pool, ACME, definition, left, right)
      assert.equal(out.ok, false)
      if (out.ok) continue
      const text = show(out.refusal)
      /* Values stored in the fixture payloads. None may appear in a refusal.
       * `AssertNoTextDeep` makes this a compile-time property too; this is the
       * runtime half, which also covers what a `FieldPathKey` happens to
       * encode. */
      for (const secret of ['A1', 'A2', 'A3', 'ZZ']) {
        assert.ok(!text.includes(secret), `refusal leaked \`${secret}\`: ${text}`)
      }
    }
  })
})
