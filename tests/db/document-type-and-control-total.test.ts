/**
 * A DOCUMENT TYPE'S DECLARATION AND WHAT A FILE SAID ABOUT ITSELF, AGAINST A
 * REAL POSTGRESQL — `db/migrations/0180_document_type_and_control_total.sql`.
 * G1401–G1405, 21 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE RED, CAPTURED BEFORE THE MIGRATION EXISTED. Run on the tree with
 *    `0180` moved aside and every other file of this slice present:
 *
 *      error: relation "tenant.document_type" does not exist
 *        code: '42P01',
 *        position: '13',
 *        file: 'parse_relation.c',
 *        routine: 'parserOpenTable'
 *
 *      ✖ the document type and its control total (590.368209ms)
 *      ℹ tests 28 · pass 1 · fail 0 · cancelled 27
 *
 *    ⚠️ **READ `fail 0` BEFORE CONCLUDING ANYTHING FROM A COUNT.** The seed is
 *    in `before`, so its throw CANCELS the twenty-seven rather than failing them,
 *    and the one `pass` is the CI reachability guard. A run reporting `fail 0`
 *    against a schema with neither table is exactly the shape
 *    `tools/skip-census.mjs` exists for — and exactly why `databaseRequiredUnderCi`
 *    sits OUTSIDE the `describe`.
 *
 *    🛑 **AND §7 ASSERTS THE MESSAGE AND NOT MERELY A THROW, BECAUSE OF THAT
 *    RUN.** `assert.rejects(…)` with no predicate passes against
 *    `relation … does not exist` exactly as it passes against
 *    `permission denied` — a grant test written the lazy way goes green on a
 *    tree with no grant AND no table. §7 matches `/permission denied/i`.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT THIS SUITE IS FOR. `readDocumentType()` refusing is a statement about
 *    a code path; these are statements about what the DATABASE will accept from
 *    ANY caller holding the app role, and about whether C18's three arms are
 *    genuinely three.
 *
 *      · §1  THE ROUND TRIP, FIELD FOR FIELD, and the ALLOW ARM FIRST —
 *            a control whose only observable behaviour is refusal is §5.6.
 *      · §2  Tenant isolation, the deny-on-NULL arm, and the RLS NEGATIVE
 *            CONTROL. Without §2c, §2 is not evidence that the POLICY is what
 *            isolates these tables.
 *      · §3  **THE THREE ARMS, AND THE FOURTH STATE THAT IS A REFUSAL.** This
 *            is the heart of the slice.
 *      · §4  The two structural `CHECK`s, witnessed rather than read — and
 *            G411's totality.
 *      · §5  `ENABLE` **and** `FORCE`, with `0001`'s predicate byte-identical
 *            on `USING` **and** `WITH CHECK`, read back from the catalogue.
 *      · §6  No `CHECK` mirrors a model vocabulary.
 *      · §7  `SELECT` and nothing else.
 *      · §8  The two absences that are decisions: no foreign key into
 *            `document_type`, and the TWO surviving spellings of
 *            `carries_control_total`.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ EVERY ROW HERE IS WRITTEN BY THE MIGRATOR, AND THAT IS STATED RATHER THAN
 *    IMPLIED. `0180` grants the app role `SELECT` and nothing else on both
 *    tables, because no operation on any of the seven tiers authors a document
 *    type and the two that MINT one — `installPack`, `publishPackVersion` —
 *    are declared and unmounted. **So a green run here is NOT evidence that a
 *    document type can reach a tenant through the product.** It cannot. The
 *    writer is owed: G110's publication seam for the type, and the extractor
 *    (E4) for the control total.
 *
 * ⚠️ AND A CONCURRENT SLICE (E1) IS ADDING `data_type` TO
 *    `tenant.document_field_spec`. Nothing here reads, writes or constrains
 *    that table.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import { ACQUISITION_FIDELITY, DOMAIN_KEYS } from '../../model/domain.ts'
import {
  readDocumentType,
  readDocumentControlTotal,
  type StoredDocumentType,
} from '../../server/data-plane/document-type-store.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE — `db/env.ts` resolves `RECONCILE_DB_NAME` per call and
 * never at import, and two suites sharing one name race inside
 * `createDatabase()`.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_DOCUMENT_TYPE_DB_NAME'] ?? runScopedName('reconcile_document_type_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

const ACME_INVOICE = 'dt_acme_invoice'
const ACME_STATEMENT = 'dt_acme_statement'
const ACME_FEED = 'dt_acme_feed'
const ACME_UNKNOWN = 'dt_acme_unknown_vocabulary'
const GLOBEX_INVOICE = 'dt_globex_invoice'

/** One document per arm, plus one with no control total at all. */
const DOC_DECLARED = 'doc_acme_declared'
const DOC_DECLARED_PART = 'doc_acme_declared_count_only'
const DOC_ABSENT = 'doc_acme_expected_but_absent'
const DOC_NO_TRAILER = 'doc_acme_not_declared_by_format'
const DOC_UNEXTRACTED = 'doc_acme_never_extracted'
const DOC_BAD_KIND = 'doc_acme_unknown_arm'
const GLOBEX_DOC = 'doc_globex_declared'

/** `0001`'s predicate, VERBATIM, as PostgreSQL renders it back. */
const PREDICATE =
  "(tenant_id = NULLIF(current_setting('app.tenant_id'::text, true), ''::text))"

const probe = await probeDatabase()
const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/db/document-type-and-control-total.test.ts DID NOT RUN.',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS IS THE ONLY CONTROL OVER `db/migrations/0180`. A run in which it',
      '   skipped is NOT evidence that a document type is tenant-isolated, NOT',
      '   evidence that the app role cannot turn C18 off by declaring a type',
      '   `carries_control_total = never`, and — the one that matters most —',
      '   NOT evidence that an UNEXTRACTED document is refused rather than read',
      '   as `not_declared_by_format`, which would switch the trailer check off',
      '   for every document in the product on a green gate.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

databaseRequiredUnderCi('the document-type and control-total assertions', probe)

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

/** Whatever the database said, as a string. `''` when the statement SUCCEEDED. */
async function refusalOf(
  run: (q: (sql: string, p?: readonly unknown[]) => Promise<{ rows: unknown[] }>) => Promise<unknown>,
): Promise<string> {
  try {
    await asMigrator(run)
    return ''
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

/**
 * THE FIXTURE IS TYPED AS THE READER'S OWN ANSWER, so `tsc` is the first
 * assertion in this file: an eighth field on `DocumentType` cannot be dropped
 * from here without a compile error.
 */
const ACME_INVOICE_ROW: StoredDocumentType = {
  id: ACME_INVOICE as StoredDocumentType['id'],
  key: 'ap.invoice',
  label: 'Supplier invoice',
  domain: DOMAIN_KEYS.finance,
  expectedFidelity: ACQUISITION_FIDELITY.scanned,
  carriesControlTotal: 'always',
}

async function seed(): Promise<void> {
  await asMigrator(async (q) => {
    await q(
      `INSERT INTO tenant.document_type
         (tenant_id, id, key, label, domain, expected_fidelity, carries_control_total)
       VALUES ($1, $2, 'ap.invoice',    'Supplier invoice',  'finance', 'scanned',    'always'),
              ($1, $3, 'ap.statement',  'Vendor statement',  'finance', 'tabular',    'never'),
              ($1, $4, 'kyc.feed',      'Registry feed',     'kyc',     'structured', 'always'),
              ($5, $6, 'ap.invoice',    'Supplier invoice',  'finance', 'scanned',    'always')`,
      [ACME, ACME_INVOICE, ACME_STATEMENT, ACME_FEED, GLOBEX, GLOBEX_INVOICE],
    )

    /* §4c's row. NO `CHECK` on any vocabulary column, so all three of these
     * values STORE — and every one of them must reach the reader as a refusal
     * BY COLUMN rather than be coerced to something plausible. */
    await q(
      `INSERT INTO tenant.document_type
         (tenant_id, id, key, label, domain, expected_fidelity, carries_control_total)
       VALUES ($1, $2, 'ap.mystery', 'Unknown', 'astrology', 'telepathy', 'sometimes')`,
      [ACME, ACME_UNKNOWN],
    )

    /* A lane, admitted arrivals and the documents they became — `0012` §2, §3. */
    await q(
      `INSERT INTO tenant.intake_channel (tenant_id, id, kind, endpoint_id, enabled)
       VALUES ($1, 'ich_upload', 'upload', NULL, true),
              ($2, 'ich_upload', 'upload', NULL, true)`,
      [ACME, GLOBEX],
    )

    const docs: readonly (readonly [string, string])[] = [
      [ACME, DOC_DECLARED],
      [ACME, DOC_DECLARED_PART],
      [ACME, DOC_ABSENT],
      [ACME, DOC_NO_TRAILER],
      [ACME, DOC_UNEXTRACTED],
      [ACME, DOC_BAD_KIND],
      [GLOBEX, GLOBEX_DOC],
    ]
    for (const [tenant, doc] of docs) {
      await q(
        `INSERT INTO tenant.arrival
           (tenant_id, id, channel_id, channel_kind, endpoint_id, authorization_id,
            arrived_at, verdict_kind, refusal_kind, source_document_id)
         VALUES ($1, $2, 'ich_upload', 'upload', NULL, 'azg_standing',
                 now(), 'admitted', NULL, $3)`,
        [tenant, `arr_${doc}`, doc],
      )
      await q(
        `INSERT INTO tenant.source_document
           (tenant_id, id, arrival_id, document_type_id, ingested_at)
         VALUES ($1, $2, $3, $4, now())`,
        [tenant, doc, `arr_${doc}`, tenant === ACME ? ACME_INVOICE : GLOBEX_INVOICE],
      )
    }

    /* THE THREE ARMS, one row each — plus the partially-declared trailer, the
     * unknown arm, and (deliberately) NO ROW AT ALL for `DOC_UNEXTRACTED`. */
    await q(
      `INSERT INTO tenant.document_control_total
         (tenant_id, source_document_id, kind, line_count,
          total_currency, total_minor, total_exponent)
       VALUES ($1, $2, 'declared',               412,  'SGD', 918273645500, 2),
              ($1, $3, 'declared',               99,   NULL,  NULL,         NULL),
              ($1, $4, 'expected_but_absent',    NULL, NULL,  NULL,         NULL),
              ($1, $5, 'not_declared_by_format', NULL, NULL,  NULL,         NULL),
              ($1, $6, 'trailer_was_vibey',      NULL, NULL,  NULL,         NULL),
              ($7, $8, 'declared',               7,    'USD', 100,          2)`,
      [ACME, DOC_DECLARED, DOC_DECLARED_PART, DOC_ABSENT, DOC_NO_TRAILER, DOC_BAD_KIND,
       GLOBEX, GLOBEX_DOC],
    )
  })
}

describe('the document type and its control total', { skip }, () => {
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
   * §1 · THE ALLOW ARM, FIRST. A control whose only observable
   *      behaviour is refusal is §5.6 — twelve refusals with no
   *      permitted case pass identically against a role holding no
   *      `SELECT` either.
   * ================================================================ */

  it('1 · a document type round-trips through the reader, field for field', async () => {
    const read = await withTenantScope(pool, ACME, (tx) => readDocumentType(tx, ACME_INVOICE))
    assert.equal(read.kind, 'document_type')
    assert.deepEqual(
      read.kind === 'document_type' ? read.documentType : null,
      ACME_INVOICE_ROW,
      'the six stored columns did not come back as the six declared fields. `DocumentType` ' +
        'had NO TABLE ANYWHERE before `0180`, and this is the assertion that it has one.',
    )
  })

  it('1b · `expectedFidelity` is READ and never invented — a scanned type says `scanned`', async () => {
    const read = await withTenantScope(pool, ACME, (tx) => readDocumentType(tx, ACME_INVOICE))
    assert.equal(
      read.kind === 'document_type' ? read.documentType.expectedFidelity : null,
      'scanned',
      '`definition-store.ts` §0 records why the engine has no documents: *"a converter ' +
        'written here would be INVENTING A FIDELITY AND A CONFIDENCE for every value in the ' +
        'product."* Fidelity is not per-value — it is declared on the TYPE, and this is the ' +
        'column that makes reading it possible instead of guessing it.',
    )
  })

  it('1c · a type this tenant does not have is `no_document_type`, not a throw', async () => {
    const read = await withTenantScope(pool, ACME, (tx) => readDocumentType(tx, 'dt_nonexistent'))
    assert.equal(read.kind, 'no_document_type')
  })

  /* ================================================================ *
   * §2 · TENANT ISOLATION, DENY-ON-NULL, AND THE NEGATIVE CONTROL.
   * ================================================================ */

  it('2 · another tenant`s document type is invisible, asked for by its exact id', async () => {
    const read = await withTenantScope(pool, ACME, (tx) => readDocumentType(tx, GLOBEX_INVOICE))
    assert.equal(
      read.kind,
      'no_document_type',
      'ACME read GLOBEX`s document type. `0180` §3 puts `0001``s predicate on `USING`, and a ' +
        'type carries `carriesControlTotal` — so a cross-tenant read here is a read of ' +
        'another tenant`s control posture.',
    )
  })

  it('2b · another tenant`s control total is invisible too', async () => {
    const read = await withTenantScope(pool, ACME, (tx) =>
      readDocumentControlTotal(tx, GLOBEX_DOC),
    )
    assert.equal(read.kind, 'unreadable')
  })

  it('2c · a read OUTSIDE a tenant scope sees nothing at all — G100 denies on NULL', async () => {
    const client = await pool.connect()
    try {
      const a = await client.query('SELECT id FROM tenant.document_type', [])
      const b = await client.query('SELECT kind FROM tenant.document_control_total', [])
      assert.equal(a.rows.length, 0, 'a query with no `app.tenant_id` returned document types.')
      assert.equal(b.rows.length, 0, 'a query with no `app.tenant_id` returned control totals.')
    } finally {
      client.release()
    }
  })

  it('2d · with RLS DISABLED the SAME reads LEAK both tenants', async () => {
    await asMigrator(async (q) => {
      await q('ALTER TABLE tenant.document_type DISABLE ROW LEVEL SECURITY')
      await q('ALTER TABLE tenant.document_control_total DISABLE ROW LEVEL SECURITY')
    })
    try {
      const counts = await withTenantScope(pool, ACME, async (tx) => {
        const a = await tx.query('SELECT id FROM tenant.document_type')
        const b = await tx.query('SELECT kind FROM tenant.document_control_total')
        return [a.rows.length, b.rows.length] as const
      })
      assert.equal(
        counts[0],
        5,
        'WITH RLS OFF THE DOCUMENT-TYPE READ DID NOT LEAK, so §2 is not evidence that the ' +
          'POLICY is what isolates this table. Something else — a privilege, a predicate, an ' +
          'empty table — is producing the isolation §2 credits to the policy.',
      )
      assert.equal(counts[1], 6, 'WITH RLS OFF THE CONTROL-TOTAL READ DID NOT LEAK.')
    } finally {
      await asMigrator(async (q) => {
        await q('ALTER TABLE tenant.document_type ENABLE ROW LEVEL SECURITY')
        await q('ALTER TABLE tenant.document_type FORCE ROW LEVEL SECURITY')
        await q('ALTER TABLE tenant.document_control_total ENABLE ROW LEVEL SECURITY')
        await q('ALTER TABLE tenant.document_control_total FORCE ROW LEVEL SECURITY')
      })
    }
  })

  /* ================================================================ *
   * §3 · THE THREE ARMS, AND THE FOURTH STATE THAT IS A REFUSAL.
   *      THE HEART OF THE SLICE.
   *
   * 🛑 THE ASSERTIONS HERE CANNOT BE REPLACED BY READING THE MIGRATION.
   *    `model/domain.ts` declares the three arms because *"a nullable
   *    field cannot say this … it cannot distinguish 'this format has
   *    no trailer' from 'the trailer should have been there and was
   *    not'. The second is a truncated or tampered file, and a null
   *    that reads as 'unchecked' is scope failing OPEN."*
   * ================================================================ */

  it('3a · `declared` comes back with its trailer — a count AND a Money, exact', async () => {
    const read = await withTenantScope(pool, ACME, (tx) =>
      readDocumentControlTotal(tx, DOC_DECLARED),
    )
    assert.equal(read.kind, 'control_total')
    assert.deepEqual(read.kind === 'control_total' ? read.controlTotal : null, {
      kind: 'declared',
      lineCount: 412,
      total: { currency: 'SGD', amountMinor: 918273645500n, exponent: 2 },
    })
  })

  it('3a2 · the amount is a `bigint` through `model/money.ts` and never a JS number', async () => {
    const read = await withTenantScope(pool, ACME, (tx) =>
      readDocumentControlTotal(tx, DOC_DECLARED),
    )
    const total =
      read.kind === 'control_total' && read.controlTotal.kind === 'declared'
        ? read.controlTotal.total
        : null
    assert.equal(
      typeof total?.amountMinor,
      'bigint',
      'a `Number()` on this column would put the 2^53 ceiling back at the read surface G286 ' +
        'was taken to lift — on a CONTROL TOTAL, the one figure in the product whose entire ' +
        'job is to be compared against a sum.',
    )
  })

  it('3b · inside `declared`, one null is a PARTIAL TRAILER and not an absent one', async () => {
    const read = await withTenantScope(pool, ACME, (tx) =>
      readDocumentControlTotal(tx, DOC_DECLARED_PART),
    )
    assert.deepEqual(read.kind === 'control_total' ? read.controlTotal : null, {
      kind: 'declared',
      lineCount: 99,
      total: null,
    })
    /* `model/domain.ts`: *"inside THIS arm a null means 'the trailer declared
     * this one and not that one', which cannot be read as 'unchecked' because
     * the arm itself is the assertion that a trailer was found."* */
  })

  it('3c · `expected_but_absent` and `not_declared_by_format` are TWO ANSWERS, not one', async () => {
    const [absent, none] = await withTenantScope(pool, ACME, async (tx) => [
      await readDocumentControlTotal(tx, DOC_ABSENT),
      await readDocumentControlTotal(tx, DOC_NO_TRAILER),
    ])

    assert.deepEqual(absent.kind === 'control_total' ? absent.controlTotal : null, {
      kind: 'expected_but_absent',
    })
    assert.deepEqual(none.kind === 'control_total' ? none.controlTotal : null, {
      kind: 'not_declared_by_format',
    })
    assert.notDeepEqual(
      absent.kind === 'control_total' ? absent.controlTotal : null,
      none.kind === 'control_total' ? none.controlTotal : null,
      'THE TWO ARMS CAME BACK IDENTICAL. `expected_but_absent` is a truncated or tampered ' +
        'file and `not_declared_by_format` is an API payload; collapsing them is the exact ' +
        'defect the three arms exist to prevent. **They are distinguishable because the ' +
        'DISCRIMINANT IS ITS OWN `NOT NULL` COLUMN** — the four payload columns are NULL in ' +
        'BOTH and carry no meaning in either.',
    )
  })

  it('3d · AN UNEXTRACTED DOCUMENT IS `unreadable` AND IS NEVER `not_declared_by_format`', async () => {
    const read = await withTenantScope(pool, ACME, (tx) =>
      readDocumentControlTotal(tx, DOC_UNEXTRACTED),
    )
    assert.equal(
      read.kind,
      'unreadable',
      'A DOCUMENT WITH NO CONTROL-TOTAL ROW WAS READ AS AN ANSWER. `SourceDocument.controlTotal` ' +
        'is *"Required and NON-OPTIONAL"*, so a missing row is not a `ControlTotal` — it is a ' +
        'document nothing has extracted. Reading it as `not_declared_by_format` would switch ' +
        'C18 OFF FOR EVERY DOCUMENT IN THE PRODUCT, silently, on a green gate: ' +
        '`checkPopulationIntegrity()` treats that arm as a legitimate declaration and raises ' +
        'nothing. SQL cannot hold this one — a `NOT NULL` reference the other way would ' +
        'require a trailer before the document it was read out of, breaking ' +
        '`admitAndStoreArrival()` at the first arrival — so it is held HERE.',
    )
    assert.deepEqual(read.kind === 'unreadable' ? read.defect : null, {
      table: 'document_control_total',
      column: 'kind',
    })
  })

  it('3e · a document row EXISTS for it — so §3d is about the trailer, not the document', async () => {
    const rows = await withTenantScope(pool, ACME, async (tx) => {
      const r = await tx.query('SELECT id FROM tenant.source_document WHERE id = $1', [
        DOC_UNEXTRACTED,
      ])
      return r.rows.length
    })
    assert.equal(
      rows,
      1,
      'the fixture for §3d has no document at all, so §3d would pass against a tenant with no ' +
        'documents whatsoever — §5.6 inside the assertion written to prevent it.',
    )
  })

  /* ================================================================ *
   * §4 · THE TWO STRUCTURAL `CHECK`s, WITNESSED — AND G411.
   * ================================================================ */

  it('4a · a payload on a NON-`declared` arm is unwritable — by the MIGRATOR, not merely by a handler', async () => {
    for (const arm of ['expected_but_absent', 'not_declared_by_format'] as const) {
      const refused = await refusalOf((q) =>
        q(
          `INSERT INTO tenant.document_control_total
             (tenant_id, source_document_id, kind, line_count,
              total_currency, total_minor, total_exponent)
           VALUES ($1, $2, $3, 5, 'SGD', 100, 2)`,
          [ACME, DOC_UNEXTRACTED, arm],
        ),
      )
      assert.match(
        refused,
        /document_control_total_payload_is_declared_only/,
        `a \`${arm}\` row carrying a trailer was ACCEPTED. The arm is the assertion that no ` +
          'trailer was found; a total beside it is a row that says both. ' +
          `Got: ${refused === '' ? 'the statement SUCCEEDED' : refused}`,
      )
    }
  })

  it('4a2 · G411 — the `CHECK` cannot evaluate to NULL, because `kind` is `NOT NULL`', async () => {
    const refused = await refusalOf((q) =>
      q(
        `INSERT INTO tenant.document_control_total
           (tenant_id, source_document_id, kind, line_count,
            total_currency, total_minor, total_exponent)
         VALUES ($1, $2, NULL, 5, 'SGD', 100, 2)`,
        [ACME, DOC_UNEXTRACTED],
      ),
    )
    assert.match(
      refused,
      /not-null constraint/i,
      'G411: *"a `CHECK` that evaluates to `NULL` PASSES"*, so `false OR NULL` would admit ' +
        'exactly the row §4a forbids. The `NOT NULL` on the discriminant is HALF of that ' +
        'constraint, and this asserts the half. ' +
        `Got: ${refused === '' ? 'the statement SUCCEEDED' : refused}`,
    )
  })

  it('4b · half a `Money` is unwritable — `0015``s rule, carried across', async () => {
    const refused = await refusalOf((q) =>
      q(
        `INSERT INTO tenant.document_control_total
           (tenant_id, source_document_id, kind, line_count,
            total_currency, total_minor, total_exponent)
         VALUES ($1, $2, 'declared', 5, 'SGD', NULL, NULL)`,
        [ACME, DOC_UNEXTRACTED],
      ),
    )
    assert.match(
      refused,
      /document_control_total_money_is_whole/,
      '*"a currency with no amount is a `Money` nobody can read"*. ' +
        `Got: ${refused === '' ? 'the statement SUCCEEDED' : refused}`,
    )
  })

  it('4c · an UNKNOWN arm STORES and reaches the reader as `unreadable` BY COLUMN', async () => {
    const read = await withTenantScope(pool, ACME, (tx) =>
      readDocumentControlTotal(tx, DOC_BAD_KIND),
    )
    assert.deepEqual(
      read.kind === 'unreadable' ? read.defect : null,
      { table: 'document_control_total', column: 'kind' },
      'the fixture stores `kind = trailer_was_vibey` and the seed SUCCEEDED, which is `0069``s ' +
        'polarity: *"an unknown value must reach the model as an `*_unreadable` refusal, not ' +
        'be rejected at write time by a list somebody forgot to extend."* It must then be ' +
        'REFUSED here, never coerced to a plausible arm.',
    )
  })

  it('4d · an unknown value in EACH of the three vocabulary columns is `unreadable` BY COLUMN', async () => {
    const read = await withTenantScope(pool, ACME, (tx) => readDocumentType(tx, ACME_UNKNOWN))
    assert.equal(read.kind, 'unreadable')
    /* The reader answers on the FIRST column it cannot read, in declaration
     * order, so this names `domain`; §4e is what makes the other two real. */
    assert.deepEqual(read.kind === 'unreadable' ? read.defect : null, {
      table: 'document_type',
      column: 'domain',
    })
  })

  it('4e · …and each of the three is checked INDEPENDENTLY, not just the first', async () => {
    for (const [column, sql] of [
      ['expected_fidelity', `UPDATE tenant.document_type SET domain = 'finance' WHERE id = $1`],
      [
        'carries_control_total',
        `UPDATE tenant.document_type SET expected_fidelity = 'tabular' WHERE id = $1`,
      ],
    ] as const) {
      await asMigrator((q) => q(sql, [ACME_UNKNOWN]))
      const read = await withTenantScope(pool, ACME, (tx) => readDocumentType(tx, ACME_UNKNOWN))
      assert.deepEqual(
        read.kind === 'unreadable' ? read.defect : null,
        { table: 'document_type', column },
        `\`${column}\` was not checked. A reader that validates only the first vocabulary ` +
          'column passes §4d while coercing the other two — §5.6 wearing a green assertion.',
      )
    }
    /* Restore, so ordering between tests cannot silently change §4d. */
    await asMigrator((q) =>
      q(
        `UPDATE tenant.document_type
            SET domain = 'astrology', expected_fidelity = 'telepathy',
                carries_control_total = 'sometimes'
          WHERE id = $1`,
        [ACME_UNKNOWN],
      ),
    )
  })

  /* ================================================================ *
   * §5 · THE POLICIES, READ BACK FROM THE CATALOGUE.
   * ================================================================ */

  it('5 · both policies carry 0001`s predicate on BOTH halves, byte-identical to their siblings', async () => {
    const rows = (await asMigrator((q) =>
      q(
        `SELECT policyname, qual, with_check FROM pg_policies
          WHERE schemaname = 'tenant'
            AND policyname IN ('document_type_rls', 'document_control_total_rls')
          ORDER BY policyname`,
      ),
    )) as { rows: { policyname: string; qual: string; with_check: string }[] }

    assert.equal(rows.rows.length, 2, 'one or both policies are missing')
    for (const row of rows.rows) {
      assert.equal(row.qual, PREDICATE, `${row.policyname}: USING is not 0001's predicate`)
      assert.equal(
        row.with_check,
        PREDICATE,
        `${row.policyname}: WITH CHECK is not stated, or is not 0001's predicate. ` +
          '`0150`: the tables that take no write carry it anyway, *"so a later `GRANT INSERT` ' +
          'cannot arrive without the write predicate already in place."*',
      )
    }
  })

  it('5b · both tables ENABLE **and** FORCE row level security', async () => {
    const rows = (await asMigrator((q) =>
      q(
        `SELECT c.relname, c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'tenant'
            AND c.relname IN ('document_type', 'document_control_total')
          ORDER BY c.relname`,
      ),
    )) as { rows: { relname: string; enabled: boolean; forced: boolean }[] }

    assert.equal(rows.rows.length, 2)
    for (const row of rows.rows) {
      assert.equal(row.enabled, true, `${row.relname}: RLS not ENABLEd`)
      assert.equal(
        row.forced,
        true,
        `${row.relname}: RLS not FORCEd — ENABLE alone leaves the TABLE OWNER exempt.`,
      )
    }
  })

  /* ================================================================ *
   * §6 · NO `CHECK` MIRRORS A MODEL VOCABULARY.
   * ================================================================ */

  it('6 · `document_type` carries NO check constraint at all', async () => {
    const rows = (await asMigrator((q) =>
      q(
        `SELECT conname FROM pg_constraint
          WHERE conrelid = 'tenant.document_type'::regclass AND contype = 'c'`,
      ),
    )) as { rows: { conname: string }[] }

    assert.deepEqual(
      rows.rows.map((r) => r.conname),
      [],
      'A `CHECK` on `domain`, `expected_fidelity` or `carries_control_total` is a THIRD copy ' +
        'of a list `model/domain.ts` already holds and nothing compares — and the polarity is ' +
        'the deciding half: an unknown value must reach the reader as an `*_unreadable` ' +
        'refusal, not be rejected at write time by a list somebody forgot to extend. ' +
        '§4d and §4e are what that polarity buys, and they become unreachable the moment a ' +
        '`CHECK` lands here.',
    )
  })

  it('6b · `document_control_total``s two checks are STRUCTURAL and name no second arm', async () => {
    const rows = (await asMigrator((q) =>
      q(
        `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
          WHERE conrelid = 'tenant.document_control_total'::regclass AND contype = 'c'
          ORDER BY conname`,
      ),
    )) as { rows: { conname: string; def: string }[] }

    assert.deepEqual(rows.rows.map((r) => r.conname), [
      'document_control_total_money_is_whole',
      'document_control_total_payload_is_declared_only',
    ])

    const all = rows.rows.map((r) => r.def).join('\n')
    for (const arm of ['expected_but_absent', 'not_declared_by_format']) {
      assert.equal(
        all.includes(arm),
        false,
        `a \`CHECK\` names \`${arm}\`, which makes it a VOCABULARY constraint rather than a ` +
          'structural one. `0180` departs from `0012` §6`s ' +
          '`CHECK (location_kind IN (...))` deliberately: this one admits EVERY arm and ' +
          'constrains only the payload, so §4c`s refusal stays reachable.',
      )
    }
    /* And no fidelity or domain member may appear either. */
    for (const member of [...Object.values(ACQUISITION_FIDELITY), ...Object.values(DOMAIN_KEYS)]) {
      assert.equal(all.includes(member), false, `a CHECK names the vocabulary member ${member}`)
    }
  })

  /* ================================================================ *
   * §7 · `SELECT` AND NOTHING ELSE — THE DECISION IN THE MIGRATION.
   * ================================================================ */

  it('7 · the app role cannot INSERT, UPDATE or DELETE a document type', async () => {
    const attempts: ReadonlyArray<readonly [string, string, readonly unknown[]]> = [
      [
        'INSERT a document type of its own choosing',
        `INSERT INTO tenant.document_type
           (tenant_id, id, key, label, domain, expected_fidelity, carries_control_total)
         VALUES ($1, 'dt_forged', 'x', 'x', 'finance', 'structured', 'never')`,
        [ACME],
      ],
      [
        'turn C18 off by declaring the type carries no trailer',
        `UPDATE tenant.document_type SET carries_control_total = 'never' WHERE id = $1`,
        [ACME_INVOICE],
      ],
      [
        'select a parse path for an image',
        `UPDATE tenant.document_type SET expected_fidelity = 'structured' WHERE id = $1`,
        [ACME_INVOICE],
      ],
      ['DELETE a document type', `DELETE FROM tenant.document_type WHERE id = $1`, [ACME_INVOICE]],
    ]

    for (const [label, sql, params] of attempts) {
      let refused = ''
      try {
        await withTenantScope(pool, ACME, async (tx) => {
          await tx.query(sql, params)
        })
      } catch (err) {
        refused = err instanceof Error ? err.message : String(err)
      }
      assert.match(
        refused,
        /permission denied/i,
        `\`${label}\` was NOT refused by the DATABASE. \`carriesControlTotal\` exists precisely ` +
          'so the checked component cannot turn the check off — *"a parser reporting ' +
          '`not_declared_by_format` for a type declared `always` is itself a defect"* — and a ' +
          'request path that could write this column IS the checked component turning it off. ' +
          `Got: ${refused === '' ? 'the statement SUCCEEDED' : refused}`,
      )
    }
  })

  it('7b · …and cannot write a control total either, in any of the three verbs', async () => {
    const attempts: ReadonlyArray<readonly [string, string, readonly unknown[]]> = [
      [
        'declare a truncated file to have carried no trailer',
        `INSERT INTO tenant.document_control_total (tenant_id, source_document_id, kind)
         VALUES ($1, $2, 'not_declared_by_format')`,
        [ACME, DOC_UNEXTRACTED],
      ],
      [
        'rewrite what the file said about itself',
        `UPDATE tenant.document_control_total SET kind = 'not_declared_by_format' WHERE source_document_id = $1`,
        [DOC_ABSENT],
      ],
      [
        'erase the trailer record',
        `DELETE FROM tenant.document_control_total WHERE source_document_id = $1`,
        [DOC_ABSENT],
      ],
    ]

    for (const [label, sql, params] of attempts) {
      let refused = ''
      try {
        await withTenantScope(pool, ACME, async (tx) => {
          await tx.query(sql, params)
        })
      } catch (err) {
        refused = err instanceof Error ? err.message : String(err)
      }
      assert.match(
        refused,
        /permission denied/i,
        `\`${label}\` was NOT refused by the DATABASE. \`expected_but_absent\` is the arm that ` +
          'catches a tampered file, and a caller who may choose the arm is a caller who may ' +
          'choose not to be caught. ' +
          `Got: ${refused === '' ? 'the statement SUCCEEDED' : refused}`,
      )
    }
  })

  /* ================================================================ *
   * §8 · THE TWO ABSENCES THAT ARE DECISIONS.
   * ================================================================ */

  it('8 · NOTHING references `tenant.document_type` — the FK is OWED, with the writer', async () => {
    const rows = (await asMigrator((q) =>
      q(
        `SELECT conname, conrelid::regclass::text AS child FROM pg_constraint
          WHERE contype = 'f' AND confrelid = 'tenant.document_type'::regclass`,
      ),
    )) as { rows: { conname: string; child: string }[] }

    /* ⚠️ THIS ASSERTED `[]` UNTIL 1 Oct 2026 AND WENT RED ON `0341` (G2687) —
     * the control firing as designed, and RE-ARGUED here rather than deleted.
     * The property it guards was always narrower than "nothing references the
     * table": it is that NO TABLE ON THE INGESTION WRITE PATH does, because
     * `admitAndStoreArrival()` would then be refused for every arrival. A
     * source × type PAIR is the opposite case — a declaration against a type
     * that does not exist SHOULD be refused — so it is the one argued child,
     * and any other is still this red.
     *
     * ⚠️ AND IT WENT RED AGAIN ON `0380` (G2839, 2 Oct 2026) — the control
     * firing as designed, and re-argued on the same ground: a
     * `parked_escalation` NAMES the type an operator is asking the FDE about,
     * and naming one that does not exist should be refused. It is not on the
     * ingestion write path — the classifying intake and the drain write
     * `source_document`, which still carries no foreign key here. */
    assert.deepEqual(
      rows.rows.map((r) => r.child).sort(),
      ['endpoint_document_type', 'parked_escalation'],
      'A FOREIGN KEY INTO `tenant.document_type` HAS BEEN ADDED, AND IT BREAKS INGESTION. ' +
        '`admitAndStoreArrival()` writes a `source_document` row carrying a `document_type_id` ' +
        'on every admitted arrival, and NOTHING CAN WRITE A ROW IN `document_type` — `0180` ' +
        'grants `SELECT` and nothing else. So the constraint refuses the product`s one live ' +
        'path, permanently, until a writer exists. It is owed IN THE SAME COMMIT as that ' +
        'writer — `0020``s rule: *"the fence and the writer are one commit or neither."* ' +
        'Delete this assertion deliberately, in that commit.',
    )
  })

  it('8b · `carries_control_total` still has TWO homes — R11 gave it one, it did not take the other away', async () => {
    const rows = (await asMigrator((q) =>
      q(
        `SELECT table_name FROM information_schema.columns
          WHERE table_schema = 'tenant' AND column_name = 'carries_control_total'
          ORDER BY table_name`,
      ),
    )) as { rows: { table_name: string }[] }

    assert.deepEqual(
      rows.rows.map((r) => r.table_name),
      ['definition_population', 'document_type'],
      'R11 gives the declaration a HOME; it does not close the DRIFT. `0160``s column is not ' +
        'dropped — G88 is forward-only and `PopulationBinding.carriesControlTotal` is still a ' +
        'REQUIRED field of `SetReconciliationInput`, so dropping it is a MODEL change (DP-2). ' +
        '**So the obligation moves to whoever assembles a `PopulationBinding` (E4): read the ' +
        'DOCUMENT TYPE and pass the value through; never read the definition`s copy.** This ' +
        'assertion pins the TWO so the commit that folds them deletes it on purpose — G1062`s ' +
        'shape, one directory over.',
    )
  })
})
