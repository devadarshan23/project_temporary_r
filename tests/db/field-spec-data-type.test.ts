/**
 * `FieldSpec.dataType` — THE COLUMN, ITS GRANT, ITS INHERITED POLICY, AND THE
 * READER THAT REFUSES A VALUE THE MODEL CANNOT NAME.
 * `db/migrations/0170_field_spec_data_type.sql` · G1371–G1375 · 21 Sep 2026.
 *
 * ┌─ WHY THIS FILE AND NOT AN HTTP SUITE ──────────────────────────────────────┐
 * │ `classifyValue`, `getDocument`, `createUpload` and `completeUpload` are     │
 * │ DECLARED AND NOT MOUNTED, and this slice mounts none of them — G300's test  │
 * │ is table AND model AND capability, and `Document` still wants an extraction │
 * │ and a `Provenance` nothing on this path produces. **So there is no route to │
 * │ drive**, and `0007`'s precedent governs: *"a column with no reader is a     │
 * │ column nothing checks"*, so the reader lands now and a real PostgreSQL      │
 * │ drives it.                                                                  │
 * │                                                                            │
 * │ ⚠️ WHAT IS THEREFORE UNWITNESSED HERE, SAID SO THE SILENCE IS NOT READ AS   │
 * │ COVERAGE: that anybody can reach a declared type over HTTP. Nobody can. And │
 * │ **nothing converts one into an `ExtractedScalar`** — `model/extraction.ts`  │
 * │ is E2 and is not written, so this suite proves the type is STORED, READ and │
 * │ PUBLISHED, and proves nothing at all about what is eventually done with it. │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT IS ASSERTED, AND WHICH CONTROL EACH ONE IS ──────────────────────────┐
 * │ 1  The DECLARED type is published, and it is the OPERATOR'S answer and not  │
 * │    the ARTEFACT'S — `invoice.total` is the JSON number `1000` declared      │
 * │    `money`, so a sniffing reader would say `number`.        INVARIANT 4     │
 * │ 2  The APP ROLE can SELECT the new column with NO new `GRANT` — the         │
 * │    table-level grant covers a column added later.                G1374      │
 * │ 3  A stored `data_type` the model cannot name is REFUSED, by column, and    │
 * │    the row is nonetheless STORABLE — `0170` carries no `CHECK` on purpose.  │
 * │                                                       G1373 · 0007 · 0069   │
 * │ 3b The same unreadable declaration aborts an INTAKE and stores NOTHING.     │
 * │ 4  The defect names the column that is actually wrong, on BOTH axes — the   │
 * │    live defect this slice found and repaired.                    G1372      │
 * │ 5  🛑 The column INHERITS `0012`'s policy: another tenant cannot see it, and │
 * │    with the policy DROPPED the read FAILS CLOSED.        G1374 · G100       │
 * │ 6  The column is `NOT NULL` and carries NO `CHECK` — both directions, read  │
 * │    from the catalogue rather than from the migration text.       G1372/3    │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 🛑 EVERY CONTROL HERE WAS WITNESSED RED BEFORE IT WAS WRITTEN, AND THE ────┐
 * │ CAPTURED REDS ARE QUOTED BECAUSE A CONTROL NOBODY PROBED IS A CONTROL       │
 * │ NOBODY HAS — `docs/HANDOFF.md` §5.6.                                        │
 * │                                                                            │
 * │  A  With `0170` applied and `payload-store.ts` UNCHANGED, every published   │
 * │     `AddressableValue` carried FIVE fields and NO `dataType` at all:        │
 * │       {"pathKey":"k7:invoice/k5:total/","path":["invoice","total"],         │
 * │        "dataClass":"internal","modelProcessingAllowed":true,"value":1000}   │
 * │     — the column stored and the reader silent. §1 is RED against that.      │
 * │  B  With `data_type = 'currency'` stored, the SAME reader answered          │
 * │     `"kind":"document"` and published that position as a good addressable   │
 * │     value. **No refusal of any kind.** §3 is RED against that, and it is    │
 * │     the measurement that makes `0170`'s missing `CHECK` honest.             │
 * │  C  With `data_class = 'confidential'` stored, the reader answered          │
 * │       {"kind":"unpublishable","defect":{"table":"document_field_spec",      │
 * │        "column":"path","sourceDocumentId":"doc_acme_invoice"}}              │
 * │     — naming `path`, which was `["invoice","odd"]` and perfectly readable.  │
 * │     §4 is RED against that.                                                 │
 * │  D  The migration itself was witnessed RED at the seed: the whole           │
 * │     neighbouring suite failed with *"null value in column \"data_type\" of  │
 * │     relation \"document_field_spec\" violates not-null constraint"*, which  │
 * │     is G1372's fence biting exactly where it was aimed.                     │
 * └────────────────────────────────────────────────────────────────────────────┘
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import {
  admitAndStoreArrival,
  readAddressablePayload,
  type AddressableValue,
} from '../../server/data-plane/payload-store.ts'
import { fieldPathKey, parseFieldPath } from '../../model/field-path.ts'
import type { ArrivalFacts } from '../../model/ingestion.ts'
import type { FieldPath, FieldPathKey } from '../../model/kernel.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE, set before the first call that reads it —
 * `tests/db/payload-and-subject-index.test.ts`'s note applies verbatim:
 * `db/env.ts` resolves `RECONCILE_DB_NAME` per call and never at import.
 * ------------------------------------------------------------------ */
process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_DATA_TYPE_DB_NAME'] ?? runScopedName('reconcile_data_type_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

const DOC_TYPE = 'dt_invoice'
const ACME_DOC = 'doc_acme_invoice'
const CHAN = 'chan_upload'
const GRANT = 'aut_seed'
const NOW = '2026-09-21T00:00:00.000Z'

/**
 * 🛑 `invoice.total` IS THE ROW THIS WHOLE SUITE TURNS ON. The stored value is
 *    the JSON NUMBER `1000`; the operator declared it `money`. A converter that
 *    read the VALUE would answer `'number'` — confidently, silently, wrongly —
 *    and `model/money.ts` would never be reached for a figure that is money.
 *    §1 asserts the declaration wins.
 */
const DECLARATIONS: readonly {
  tokens: readonly (string | number)[]
  dataClass: string
  dataType: string
  modelProcessingAllowed: boolean
}[] = [
  { tokens: ['invoice', 'total'], dataClass: 'internal', dataType: 'money', modelProcessingAllowed: true },
  { tokens: ['invoice', 'ref'], dataClass: 'public', dataType: 'identifier', modelProcessingAllowed: true },
  { tokens: ['invoice', 'raisedOn'], dataClass: 'internal', dataType: 'date', modelProcessingAllowed: true },
  { tokens: ['invoice', 'payerName'], dataClass: 'personal', dataType: 'string', modelProcessingAllowed: false },
]

function payload() {
  return {
    invoice: {
      total: 1000,
      ref: 'INV-1234',
      raisedOn: '2026-09-01',
      payerName: 'Ada Lovelace',
    },
  }
}

function mustParse(tokens: readonly (string | number)[]): FieldPath {
  const parsed = parseFieldPath(tokens)
  if (!parsed.ok) throw new Error(`the fixture declares a path the one seam refuses: ${parsed.refusal.kind}`)
  return parsed.path
}

function keyOf(tokens: readonly (string | number)[]): FieldPathKey {
  return fieldPathKey(mustParse(tokens))
}

function facts(): ArrivalFacts {
  return {
    arrivalId: 'arr_1' as ArrivalFacts['arrivalId'],
    channelId: CHAN as ArrivalFacts['channelId'],
    channelKind: 'upload',
    endpointId: null,
    authorizationId: GRANT as ArrivalFacts['authorizationId'],
    byteCount: 4096,
  }
}

/** Seed lanes and declarations AS THE MIGRATOR — `0012` §5's grant, unchanged by `0170`. */
async function seedLanesAndDeclarations(): Promise<void> {
  const client = await migratorClient()
  try {
    await client.query('BEGIN')
    for (const tenantId of [ACME, GLOBEX]) {
      await client.query(
        `INSERT INTO tenant.intake_channel (tenant_id, id, kind, endpoint_id, enabled)
         VALUES ($1, $2, 'upload', NULL, true)`,
        [tenantId, CHAN],
      )
      for (const d of DECLARATIONS) {
        await client.query(
          `INSERT INTO tenant.document_field_spec
             (tenant_id, document_type_id, path_key, path, data_class, data_type,
              model_processing_allowed)
           VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)`,
          [
            tenantId,
            DOC_TYPE,
            keyOf(d.tokens),
            JSON.stringify(d.tokens),
            d.dataClass,
            d.dataType,
            d.modelProcessingAllowed,
          ],
        )
      }
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await client.end()
  }
}

/** Add one declaration AFTER the payload is stored, so a refusal is the READ's. */
async function addLateDeclaration(dataClass: string, dataType: string): Promise<void> {
  const client = await migratorClient()
  try {
    await client.query(
      `INSERT INTO tenant.document_field_spec
         (tenant_id, document_type_id, path_key, path, data_class, data_type,
          model_processing_allowed)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, false)`,
      [ACME, DOC_TYPE, keyOf(['invoice', 'odd']), JSON.stringify(['invoice', 'odd']), dataClass, dataType],
    )
  } finally {
    await client.end()
  }
}

async function dropLateDeclaration(): Promise<void> {
  const client = await migratorClient()
  try {
    await client.query(`DELETE FROM tenant.document_field_spec WHERE path_key = $1`, [
      keyOf(['invoice', 'odd']),
    ])
  } finally {
    await client.end()
  }
}

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/db/field-spec-data-type.test.ts DID NOT RUN.',
      '',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      "   THIS IS THE ONLY CONTROL OVER `FieldSpec.dataType`. Nothing is",
      '   mounted, so there is no HTTP suite behind this one. A run in which it',
      '   skipped is NOT evidence that a declared type is published, NOT',
      '   evidence that an unnameable type is refused, and NOT evidence that',
      '   the new column inherits its table\'s policy. Start a PostgreSQL and',
      '   re-run.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the declared data type on FieldSpec', probe)

let poolOnce: TenantPool | undefined

function pool(): TenantPool {
  if (poolOnce === undefined) throw new Error('the pool was read before `before` ran')
  return poolOnce
}

describe('the declared data type on FieldSpec', { skip }, () => {
  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seedLanesAndDeclarations()

    poolOnce = await createAppPool(1)

    const stored = await withTenantScope(pool(), ACME, (tx) =>
      admitAndStoreArrival(tx, {
        facts: facts(),
        documentTypeId: DOC_TYPE,
        sourceDocumentId: ACME_DOC,
        payload: payload(),
        presentedAuthorizationIds: [GRANT as ArrivalFacts['authorizationId']],
        boundUntil: null,
        earlierArrivalWithSameContent: null,
        now: NOW,
        readingId: null,
      }),
    )
    assert.equal(
      stored.kind,
      'stored',
      `the fixture did not store: ${JSON.stringify(stored)}. Every assertion below is ` +
        'relative to it, so this is a setup failure rather than a finding.',
    )
  })

  after(async () => {
    if (poolOnce !== undefined) await poolOnce.end().catch(() => undefined)
  })

  /* ================================================================ *
   * 1. THE DECLARED TYPE IS PUBLISHED, AND IT IS THE OPERATOR'S.
   * ================================================================ */

  it('1 · every addressable position carries the type its FieldSpec declares', async () => {
    const read = await withTenantScope(pool(), ACME, (tx) =>
      readAddressablePayload(tx, ACME_DOC),
    )
    assert.equal(read.kind, 'document', `expected a document, got ${JSON.stringify(read)}`)
    if (read.kind !== 'document') return

    for (const d of DECLARATIONS) {
      const found: AddressableValue | undefined = read.addressable[keyOf(d.tokens)]
      assert.ok(
        found !== undefined,
        `${JSON.stringify(d.tokens)} is declared and present and must be addressable`,
      )
      assert.equal(
        found.dataType,
        d.dataType,
        `${JSON.stringify(d.tokens)} is declared ${d.dataType} and the reader published ` +
          `${String(found.dataType)}. THE CAPTURED RED FOR THIS ASSERTION IS THE FIELD ` +
          'BEING ABSENT ENTIRELY: before G1371 an AddressableValue carried pathKey, path, ' +
          'dataClass, modelProcessingAllowed and value, and nothing else.',
      )
    }
  })

  it('1b · 🛑 the type is the DECLARATION\'s and never the ARTEFACT\'s', async () => {
    const read = await withTenantScope(pool(), ACME, (tx) =>
      readAddressablePayload(tx, ACME_DOC),
    )
    assert.equal(read.kind, 'document')
    if (read.kind !== 'document') return

    const total = read.addressable[keyOf(['invoice', 'total'])]
    /* The stored value is a JSON NUMBER. Anything that decided the kind by
     * LOOKING at it answers 'number'. Invariant 4 says the declaration is the
     * authority, and this is the one assertion that can tell the two apart. */
    assert.equal(typeof total?.value, 'number', 'the fixture must store a JSON number here')
    assert.equal(
      total?.dataType,
      'money',
      'a JSON number declared `money` must read back as `money`. If this says `number`, ' +
        'something is SNIFFING the payload — which is classification declared by the ' +
        'counterparty, and is exactly what G106 refused.',
    )

    const ref = read.addressable[keyOf(['invoice', 'ref'])]
    assert.equal(typeof ref?.value, 'string', 'the fixture must store a JSON string here')
    assert.equal(
      ref?.dataType,
      'identifier',
      '"INV-1234" is an identifier because somebody DECLARED it one. A sniffer cannot ' +
        'tell it from a `string`, which is the other half of the same argument.',
    )
  })

  /* ================================================================ *
   * 2. NO NEW GRANT WAS NEEDED, AND THAT IS WITNESSED RATHER THAN ASSERTED.
   * ================================================================ */

  it('2 · the app role reads the new column under `0012`\'s existing table-level GRANT', async () => {
    /* `0170` adds NO `GRANT`. A table-level `GRANT SELECT` covers a column
     * added later — PostgreSQL attaches the privilege to the RELATION — and
     * this is the assertion that proves it rather than the migration comment
     * that claims it. The read goes through the APP role's pool. */
    const rows = await withTenantScope(pool(), ACME, async (tx) =>
      tx.query(
        `SELECT path_key, data_type FROM tenant.document_field_spec
          WHERE document_type_id = $1 ORDER BY path_key`,
        [DOC_TYPE],
      ),
    )
    assert.equal(
      rows.rows.length,
      DECLARATIONS.length,
      'the app role must be able to SELECT the new column with no new privilege',
    )
    for (const raw of rows.rows) {
      const row = raw as { data_type: string }
      assert.ok(row.data_type.length > 0, 'every seeded row carries a declared type')
    }
  })

  it('2b · and it holds NO write on the table — `0012` §5\'s refusal is untouched', async () => {
    /* A path that could write a `FieldSpec` could DECLARE A CLASSIFICATION, and
     * `0170` changes nothing about that: a path that could write THIS column
     * could declare that an identifier is a number and have it compared as one. */
    await assert.rejects(
      withTenantScope(pool(), ACME, async (tx) =>
        tx.query(
          `UPDATE tenant.document_field_spec SET data_type = 'string' WHERE path_key = $1`,
          [keyOf(['invoice', 'total'])],
        ),
      ),
      /permission denied/i,
      'the app role must hold no UPDATE on document_field_spec',
    )
  })

  /* ================================================================ *
   * 3. AN UNNAMEABLE TYPE IS STORABLE AND UNREADABLE — 0170's POLARITY.
   * ================================================================ */

  it('3 · a data_type the model cannot name is STORED without complaint and REFUSED on read', async () => {
    /* 🛑 BOTH HALVES MATTER AND THEY ARE THE WHOLE OF G1373.
     * The STORE accepting it is `0170` declining a `CHECK` — deliberately, on
     * `0007`'s and `0069`'s polarity. The READER refusing it is what makes that
     * decline safe. Drop either half and the arrangement is wrong: with a CHECK
     * the sixth DataType is a write failure far from the model change; with
     * neither, an unknown type is published as good. */
    await addLateDeclaration('internal', 'currency')
    try {
      const read = await withTenantScope(pool(), ACME, (tx) =>
        readAddressablePayload(tx, ACME_DOC),
      )
      assert.equal(
        read.kind,
        'unpublishable',
        'a stored `data_type` of "currency" must refuse the read. THE CAPTURED RED: ' +
          'before G1373 this answered `"kind":"document"` and published the position as ' +
          'a perfectly good addressable value.',
      )
    } finally {
      await dropLateDeclaration()
    }
  })

  it('3b · and the same declaration aborts an INTAKE, storing nothing', async () => {
    await addLateDeclaration('internal', 'currency')
    try {
      const outcome = await withTenantScope(pool(), ACME, (tx) =>
        admitAndStoreArrival(tx, {
          facts: { ...facts(), arrivalId: 'arr_2' as ArrivalFacts['arrivalId'] },
          documentTypeId: DOC_TYPE,
          sourceDocumentId: 'doc_acme_second',
          payload: payload(),
          presentedAuthorizationIds: [GRANT as ArrivalFacts['authorizationId']],
          boundUntil: null,
          earlierArrivalWithSameContent: null,
          now: NOW,
          readingId: null,
        }),
      )
      assert.equal(
        outcome.kind,
        'declaration_unreadable',
        'a document type with a position nobody can type must not accept an intake — ' +
          'storing under it is G106\'s UNREADABLE state arriving by accident.',
      )

      const client = await migratorClient()
      try {
        const rows = await client.query(
          `SELECT id FROM tenant.source_document WHERE id = $1`,
          ['doc_acme_second'],
        )
        assert.equal(rows.rows.length, 0, 'the aborted intake must have written nothing')
      } finally {
        await client.end()
      }
    } finally {
      await dropLateDeclaration()
    }
  })

  /* ================================================================ *
   * 4. THE DEFECT NAMES THE COLUMN THAT IS ACTUALLY WRONG.
   * ================================================================ */

  it('4 · an unreadable data_type is reported as `data_type`, not as `path`', async () => {
    await addLateDeclaration('internal', 'currency')
    try {
      const read = await withTenantScope(pool(), ACME, (tx) =>
        readAddressablePayload(tx, ACME_DOC),
      )
      assert.equal(read.kind, 'unpublishable')
      if (read.kind !== 'unpublishable') return
      assert.equal(read.defect.table, 'document_field_spec')
      assert.equal(
        read.defect.column,
        'data_type',
        '`PayloadDefect` carries no cell value and no payload key, so the COLUMN NAME is ' +
          'the entire diagnostic a reader gets. Naming the wrong one spends it.',
      )
    } finally {
      await dropLateDeclaration()
    }
  })

  it('4b · 🛑 and an unreadable data_class is reported as `data_class` — the live defect this slice found', async () => {
    /* THE CAPTURED RED, verbatim, against the reader as it stood on 20 Sep 2026:
     *   {"kind":"unpublishable","defect":{"table":"document_field_spec",
     *    "column":"path","sourceDocumentId":"doc_acme_invoice"}}
     * The path was ["invoice","odd"] and parsed perfectly. `readDeclarations()`
     * returned one undifferentiated refusal and the single call site hard-coded
     * `column: 'path'` over it. `server/data-plane/definition-store.ts` reads
     * the SAME TABLE and has always answered by the real column. */
    await addLateDeclaration('confidential', 'string')
    try {
      const read = await withTenantScope(pool(), ACME, (tx) =>
        readAddressablePayload(tx, ACME_DOC),
      )
      assert.equal(read.kind, 'unpublishable')
      if (read.kind !== 'unpublishable') return
      assert.equal(
        read.defect.column,
        'data_class',
        'this answered `path` until G1372, naming a column that was perfectly readable',
      )
    } finally {
      await dropLateDeclaration()
    }
  })

  /* ================================================================ *
   * 5. THE COLUMN INHERITS `0012`'s POLICY — WITNESSED, NOT ASSUMED.
   * ================================================================ */

  it('5 · another tenant cannot see the new column\'s rows', async () => {
    /* `0170` writes no `ENABLE`, no `FORCE` and no `CREATE POLICY` — `0011`'s
     * precedent, `0160` §6's verbatim. A comment claiming a column inherits a
     * policy is worth nothing; this is the claim. */
    const rows = await withTenantScope(pool(), GLOBEX, async (tx) =>
      tx.query(
        `SELECT data_type FROM tenant.document_field_spec WHERE path_key = $1`,
        [keyOf(['invoice', 'total'])],
      ),
    )
    assert.equal(
      rows.rows.length,
      1,
      'globex has its own seeded declaration and must see exactly its own',
    )

    const unscoped = await (async () => {
      const client = await createAppPool(1)
      try {
        const c = await client.connect()
        try {
          /* No `withTenantScope()`, so `app.tenant_id` is unset: G100's
           * deny-on-NULL must yield an EMPTY result set rather than everything. */
          return await c.query(`SELECT data_type FROM tenant.document_field_spec`)
        } finally {
          c.release()
        }
      } finally {
        await client.end()
      }
    })()
    assert.equal(
      unscoped.rows.length,
      0,
      'a read outside a scoped transaction must see ZERO rows of the new column — G100',
    )
  })

  it('5b · 🛑 with the policy DROPPED the read FAILS CLOSED', async () => {
    /* `tests/db/identity-substrate.test.ts` §6f's precedent: the inheritance is
     * WITNESSED by removing the thing it is inherited from. With
     * `document_field_spec_rls` gone and `FORCE ROW LEVEL SECURITY` still on,
     * the app role matches no policy at all and must see nothing. */
    const admin = await migratorClient()
    try {
      await admin.query(`DROP POLICY document_field_spec_rls ON tenant.document_field_spec`)
    } finally {
      await admin.end()
    }
    try {
      const rows = await withTenantScope(pool(), ACME, async (tx) =>
        tx.query(`SELECT data_type FROM tenant.document_field_spec`),
      )
      assert.equal(
        rows.rows.length,
        0,
        'with the policy dropped the new column must be invisible, not visible',
      )
    } finally {
      const restore = await migratorClient()
      try {
        await restore.query(
          `CREATE POLICY document_field_spec_rls ON tenant.document_field_spec
             USING (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
             WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''))`,
        )
      } finally {
        await restore.end()
      }
    }
  })

  /* ================================================================ *
   * 6. THE SHAPE OF THE COLUMN, READ FROM THE CATALOGUE.
   * ================================================================ */

  it('6 · the column is NOT NULL and carries NO CHECK — both by catalogue', async () => {
    const client = await migratorClient()
    try {
      const col = await client.query(
        `SELECT is_nullable, data_type AS sql_type
           FROM information_schema.columns
          WHERE table_schema = 'tenant'
            AND table_name = 'document_field_spec'
            AND column_name = 'data_type'`,
      )
      assert.equal(col.rows.length, 1, 'the column must exist')
      const row = col.rows[0] as { is_nullable: string; sql_type: string }
      assert.equal(
        row.is_nullable,
        'NO',
        'G1372: `FieldSpec.dataType` is `DataType` and not `DataType | null`, so the ' +
          'column is NOT NULL — the same rule `0012` applied to `data_class` and `0160` ' +
          'declined for `confidence_floor`.',
      )
      assert.equal(row.sql_type, 'text', 'G97: stored verbatim as text')

      /* 🛑 THE ABSENCE IS THE ASSERTION. A `CHECK` restating `DataType`'s five
       * members is the obvious move and `0170` refuses it, so a later commit
       * adding one must delete this line and meet G1373's argument. */
      const checks = await client.query(
        `SELECT con.conname, pg_get_constraintdef(con.oid) AS def
           FROM pg_constraint con
           JOIN pg_class rel ON rel.oid = con.conrelid
           JOIN pg_namespace ns ON ns.oid = rel.relnamespace
          WHERE ns.nspname = 'tenant'
            AND rel.relname = 'document_field_spec'
            AND con.contype = 'c'`,
      )
      const onDataType = (checks.rows as { conname: string; def: string }[]).filter((c) =>
        c.def.includes('data_type'),
      )
      assert.deepEqual(
        onDataType,
        [],
        'G1373: there must be NO CHECK on this vocabulary. An unknown value reaches the ' +
          'model as an `*_unreadable` refusal — §3 above — rather than being rejected at ' +
          'write time by a list somebody forgot to extend.',
      )
    } finally {
      await client.end()
    }
  })
})
