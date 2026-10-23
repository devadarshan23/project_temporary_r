/**
 * G3131–G3140 — THE GENERATOR FOR `db/seeds/staging-demo-data.sql`.
 *
 * ┌─ OWNER RULING, 2 Oct 2026 (G3131, THE OWNER'S) ─────────────────────────────┐
 * │ "Seed ten_acme with illustrative demo data (sources, a three-way-match      │
 * │  definition, runs, ~14 exceptions, proposals) matching the pack's C1        │
 * │  scenario."                                                                  │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 EVERY FIGURE THIS FILE PRODUCES IS ILLUSTRATIVE. `PRODUCT.md`: *"NEVER —
 *    present in-product figures as customer results. The data is illustrative."*
 *    "Meridian Group Pte Ltd" is `docs/handoff-pack/C1 Close.dc.html`'s own
 *    fictional tenant; the suppliers are the pack's two fictional names plus the
 *    well-known sample-company names (Northwind, Contoso, Fabrikam, Tailspin).
 *    No real customer is named anywhere.
 *
 * WHY A GENERATOR AND NOT A HAND-TYPED FILE (G3132). The run accounts are
 * ENGINE-TRUE: this script builds the `SetReconciliationInput` the executor would
 * build from the very rows it emits, calls `runSetReconciliation()`, and hands the
 * result to the PRODUCTION store — `persistRunEngineAccount()` /
 * `persistRunRefusal()` — through a client that RECORDS the statements instead of
 * sending them. The SQL for the account is therefore the store's own SQL, with its
 * parameters inlined and `ON CONFLICT DO NOTHING` appended (consecutive identical
 * statements are folded into one multi-row `VALUES`, which inserts the same rows
 * in the same order). `tests/db/staging-demo-data.test.ts` §4 is the witness: it
 * deletes every seeded account, runs the PRODUCTION `executeRun()` over the seeded
 * substrate, and requires the fresh account to equal the seeded one row for row.
 *
 * ⚠️ WHAT IS NOT ENGINE-PRODUCED, AND IS SAID HERE RATHER THAN LEFT TO BE FOUND
 *    (G3133). Nothing in this repository writes `tenant.exception` — the app role
 *    holds no `INSERT` (`0015`) — so the register is a PROJECTION of the engine's
 *    residue by a stated rule: ONE exception per LEFT-side residue entry, its value
 *    at risk the left document's amount, its money delta the engine's own signed
 *    variance where the cause is `amount_tolerance_declined`.
 *    ⚠️ AND SINCE 4 Oct 2026 (G3803) THE DELTA IS WHATEVER THE PRODUCTION
 *    RAISER'S `signedDeltaOf()` ANSWERS FOR THAT ENTRY — a magnitude plus a
 *    direction, and an item with no counterpart carries its whole open residual
 *    — so the register totals to the run's `openResidual` (the owner's C3-09
 *    ruling). The demo definitions also DECLARE what they raise (G3807). The rule label,
 *    severity and assignment are the scenario's, declared below per document. The
 *    summary sentence is composed HERE from typed facts only — no counterparty
 *    text — because the readers still refuse a null summary (G1128) while R-D says
 *    the sentence belongs to the display.
 *
 * Run:   node db/seeds/generate-demo-data.ts            # rewrites the .sql
 *        node db/seeds/generate-demo-data.ts --check    # exit 1 if stale
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type { DataClass, DataType, ExtractedValue, FieldPath, Severity } from '../../model/domain.ts'
import type { FieldPathKey, RunId, SourceDocumentId, TenantId } from '../../model/kernel.ts'
import type {
  ReconciliationDocument,
  SetReconciliationResult,
} from '../../model/reconciliation.ts'
import { runSetReconciliation, terminalRunStatus } from '../../model/reconciliation.ts'
import { addressableToExtracted } from '../../model/extraction.ts'
import { fieldPathKey, parseFieldPath } from '../../model/field-path.ts'
import type { ScopedClient } from '../tenant-scope.ts'
import type { StoredDefinition } from '../../server/data-plane/definition-store.ts'
import {
  persistRunEngineAccount,
  persistRunRefusal,
} from '../../server/data-plane/run-account-store.ts'
import { signedDeltaOf } from '../../server/data-plane/exception-raise.ts'

/* ==================================================================== *
 * §0  CONSTANTS
 * ==================================================================== */

export const DEMO_TENANT = 'ten_acme'
const CURRENCY = 'SGD'
const EXPONENT = 2
/** Names no `tenant.authorization_grant` row — see the SQL header. */
const SEED_AUTHORISATION = 'agr_illustrative_demo_seed'
const PACK_KEY = 'pck_demo_close'

const USERS = {
  rosalieTan: 'usr_demo_rosalie_tan',
  markTeo: 'usr_demo_mark_teo',
  danielLim: 'usr_demo_daniel_lim',
} as const

const SUPPLIERS = [
  'Northwind Packaging',
  'Contoso Industrial Supply',
  'Fabrikam Freight',
  'Tailspin Office Services',
  'Sembawang Logistics',
  'Meridian Foods Pte',
] as const

/* ==================================================================== *
 * §1  SQL RENDERING
 * ==================================================================== */

function lit(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`non-finite number ${v}`)
    return String(v)
  }
  if (typeof v === 'bigint') return String(v)
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  throw new Error(`cannot render ${typeof v} as a SQL literal`)
}

function json(v: unknown): string {
  return JSON.stringify(v)
}

const CHUNK = 500

/** A multi-row `INSERT … ON CONFLICT DO NOTHING`, chunked. */
function insert(table: string, columns: readonly string[], rows: readonly (readonly unknown[])[]): string {
  if (rows.length === 0) return ''
  const out: string[] = []
  for (let i = 0; i < rows.length; i += CHUNK) {
    const tuples = rows.slice(i, i + CHUNK).map((r) => {
      if (r.length !== columns.length) throw new Error(`${table}: ${r.length} values for ${columns.length} columns`)
      return `  (${r.map(lit).join(', ')})`
    })
    out.push(`INSERT INTO ${table} (${columns.join(', ')}) VALUES\n${tuples.join(',\n')}\nON CONFLICT DO NOTHING;`)
  }
  return out.join('\n')
}

interface Captured {
  readonly text: string
  readonly values: readonly unknown[]
}

/** A `ScopedClient` that records instead of sending. */
function recordingClient(into: Captured[]): ScopedClient {
  return {
    query(text: string, values: readonly unknown[] = []) {
      into.push({ text, values })
      return Promise.resolve({ rows: [], rowCount: 0, command: 'INSERT', oid: 0, fields: [] } as never)
    },
    release() {},
  }
}

/** The store's statements, parameters inlined, folded, `ON CONFLICT DO NOTHING`. */
function renderCaptured(captured: readonly Captured[]): string {
  const out: string[] = []
  let head: string | null = null
  let tuples: string[] = []
  const flush = (): void => {
    if (head === null) return
    for (let i = 0; i < tuples.length; i += CHUNK) {
      out.push(`${head}VALUES\n${tuples.slice(i, i + CHUNK).join(',\n')}\nON CONFLICT DO NOTHING;`)
    }
    head = null
    tuples = []
  }
  for (const c of captured) {
    const at = c.text.lastIndexOf('VALUES')
    if (!/^\s*INSERT INTO /.test(c.text) || at < 0) {
      throw new Error(`the store issued a statement this generator cannot render: ${c.text}`)
    }
    const thisHead = c.text.slice(0, at).replace(/^\s+/, '')
    const tuple = c.text
      .slice(at + 'VALUES'.length)
      .trim()
      .replace(/\$(\d+)/g, (_m, n: string) => lit(c.values[Number(n) - 1]))
    if (thisHead !== head) {
      flush()
      head = thisHead
    }
    tuples.push(`  ${tuple}`)
  }
  flush()
  return out.join('\n')
}

/* ==================================================================== *
 * §2  A DETERMINISTIC PRNG — the file must regenerate byte-identically
 * ==================================================================== */

function prng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ==================================================================== *
 * §3  DOCUMENT TYPES AND FIELD SPECS
 * ==================================================================== */

interface FieldDecl {
  readonly key: string
  readonly dataType: DataType
}

interface DocTypeDecl {
  readonly id: string
  readonly key: string
  readonly label: string
  readonly fields: readonly FieldDecl[]
}

const F_REF: FieldDecl = { key: 'ref', dataType: 'identifier' }
const F_AMOUNT: FieldDecl = { key: 'amount', dataType: 'money' }
const F_DATE: FieldDecl = { key: 'date', dataType: 'date' }
const F_PARTY: FieldDecl = { key: 'party', dataType: 'string' }

const DT = {
  invoice: { id: 'dt_demo_supplier_invoice', key: 'supplier_invoice', label: 'Supplier invoice', fields: [F_REF, F_AMOUNT, F_DATE, F_PARTY] },
  poReceipt: { id: 'dt_demo_po_receipt', key: 'po_receipt', label: 'Purchase order with goods receipt (S/4HANA)', fields: [F_REF, F_AMOUNT, F_DATE, F_PARTY] },
  acquirerLine: { id: 'dt_demo_acquirer_line', key: 'acquirer_settlement_line', label: 'Acquirer settlement line', fields: [F_REF, F_AMOUNT, F_DATE, F_PARTY] },
  cardReceivable: { id: 'dt_demo_card_receivable', key: 'card_receivable', label: 'Card receivable posting (S/4HANA)', fields: [F_REF, F_AMOUNT, F_DATE] },
  bankLine: { id: 'dt_demo_bank_line', key: 'bank_statement_line', label: 'Bank statement line', fields: [F_REF, F_AMOUNT, F_DATE, F_PARTY] },
  erpBankPosting: { id: 'dt_demo_erp_bank_posting', key: 'erp_bank_posting', label: 'Bank clearing posting (S/4HANA)', fields: [F_REF, F_AMOUNT, F_DATE] },
  icAdvice: { id: 'dt_demo_ic_advice', key: 'intercompany_advice', label: 'Intercompany advice', fields: [F_REF, F_AMOUNT, F_DATE, F_PARTY] },
  icPosting: { id: 'dt_demo_ic_posting', key: 'intercompany_posting', label: 'Intercompany posting (S/4HANA)', fields: [F_REF, F_AMOUNT, F_DATE] },
  payrollBureau: { id: 'dt_demo_payroll_bureau', key: 'payroll_bureau_journal', label: 'Payroll bureau journal', fields: [F_REF, F_AMOUNT, F_DATE] },
  payrollGl: { id: 'dt_demo_payroll_gl', key: 'payroll_clearing_posting', label: 'Payroll clearing posting (S/4HANA)', fields: [F_REF, F_AMOUNT, F_DATE] },
} as const satisfies Record<string, DocTypeDecl>

const ALL_DOC_TYPES: readonly DocTypeDecl[] = Object.values(DT)

/** One classification for every declared position: invariant 4, declared once. */
const DATA_CLASS: DataClass = 'internal'

function fpath(key: string): FieldPath {
  const parsed = parseFieldPath([key])
  if (!parsed.ok) throw new Error(`unparseable path ${key}`)
  return parsed.path
}

/* ==================================================================== *
 * §4  SOURCES — endpoints, lanes, pairs. NO CREDENTIAL ANYWHERE.
 * ==================================================================== */

interface EndpointDecl {
  readonly id: string
  readonly label: string
  readonly channelId: string
  readonly sftp?: { host: string; port: number; path: string; fingerprint: string }
  readonly s3?: { bucket: string; keyPrefix: string; roleArn: string; externalId: string }
  readonly pairs: readonly { id: string; matchValue: string; docType: DocTypeDecl; mapping: Record<string, string> }[]
}

/** 43 base64 characters, deterministic — a DECLARED fingerprint, illustrative. */
function fingerprint(seed: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const r = prng(seed)
  let s = ''
  for (let i = 0; i < 43; i++) s += alphabet[Math.floor(r() * 64)]
  return `SHA256:${s}`
}

const ENDPOINTS: readonly EndpointDecl[] = [
  {
    id: 'end_demo_sap_s3',
    label: 'SAP S/4HANA extract · S3 drop',
    channelId: 'ich_demo_sap_s3',
    s3: {
      bucket: 'meridian-demo-s4hana-extracts',
      keyPrefix: 'reconcile/',
      roleArn: 'arn:aws:iam::111122223333:role/ReconcileDemoExtractRead',
      externalId: 'ext_00000000000000000000000000de0001',
    },
    pairs: [
      { id: 'edt_demo_sap_po', matchValue: 'po-receipts/', docType: DT.poReceipt, mapping: { ref: 'EBELN', amount: 'NETWR', date: 'BUDAT', party: 'LIFNR_NAME' } },
      { id: 'edt_demo_sap_card', matchValue: 'card-receivables/', docType: DT.cardReceivable, mapping: { ref: 'XBLNR', amount: 'WRBTR', date: 'BUDAT' } },
      { id: 'edt_demo_sap_bank', matchValue: 'bank-clearing/', docType: DT.erpBankPosting, mapping: { ref: 'XBLNR', amount: 'WRBTR', date: 'VALUT' } },
      { id: 'edt_demo_sap_ic', matchValue: 'intercompany/', docType: DT.icPosting, mapping: { ref: 'XBLNR', amount: 'WRBTR', date: 'BUDAT' } },
      { id: 'edt_demo_sap_payroll', matchValue: 'payroll-clearing/', docType: DT.payrollGl, mapping: { ref: 'XBLNR', amount: 'WRBTR', date: 'BUDAT' } },
    ],
  },
  {
    id: 'end_demo_ap_s3',
    label: 'Supplier invoices (captured) · S3 drop',
    channelId: 'ich_demo_ap_s3',
    s3: {
      bucket: 'meridian-demo-ap-capture',
      keyPrefix: 'invoices/',
      roleArn: 'arn:aws:iam::111122223333:role/ReconcileDemoCaptureRead',
      externalId: 'ext_00000000000000000000000000de0002',
    },
    pairs: [{ id: 'edt_demo_ap_invoice', matchValue: 'invoices/', docType: DT.invoice, mapping: { ref: 'po_number', amount: 'invoice_total', date: 'invoice_date', party: 'supplier_name' } }],
  },
  {
    id: 'end_demo_dbs_sftp',
    label: 'DBS feed · SFTP',
    channelId: 'ich_demo_dbs_sftp',
    sftp: { host: 'sftp.dbs-feed.example', port: 22, path: '/outbound/statements', fingerprint: fingerprint(1) },
    pairs: [{ id: 'edt_demo_dbs_statement', matchValue: '/outbound/statements/', docType: DT.bankLine, mapping: { ref: 'bank_reference', amount: 'amount', date: 'value_date', party: 'narrative' } }],
  },
  {
    id: 'end_demo_maybank_sftp',
    label: 'Maybank feed · SFTP',
    channelId: 'ich_demo_maybank_sftp',
    sftp: { host: 'sftp.maybank-feed.example', port: 22, path: '/out/mt940', fingerprint: fingerprint(2) },
    pairs: [{ id: 'edt_demo_maybank_statement', matchValue: '/out/mt940/', docType: DT.bankLine, mapping: { ref: 'ref_86', amount: 'amount_61', date: 'value_date_61', party: 'info_86' } }],
  },
  {
    id: 'end_demo_acquirer_sftp',
    label: 'Acquirer settlement file · SFTP',
    channelId: 'ich_demo_acquirer_sftp',
    sftp: { host: 'sftp.acquirer-settlement.example', port: 2222, path: '/settlement/daily', fingerprint: fingerprint(3) },
    pairs: [{ id: 'edt_demo_acquirer', matchValue: '/settlement/daily/', docType: DT.acquirerLine, mapping: { ref: 'batch_ref', amount: 'net_amount', date: 'settlement_date', party: 'scheme' } }],
  },
  {
    id: 'end_demo_bureau_sftp',
    label: 'Payroll bureau file · SFTP',
    channelId: 'ich_demo_bureau_sftp',
    sftp: { host: 'sftp.payroll-bureau.example', port: 22, path: '/exports/journal', fingerprint: fingerprint(4) },
    pairs: [{ id: 'edt_demo_bureau', matchValue: '/exports/journal/', docType: DT.payrollBureau, mapping: { ref: 'journal_ref', amount: 'net_pay', date: 'pay_date' } }],
  },
]

/** Intercompany advices are uploaded by hand — the `upload` lane, no endpoint. */
const UPLOAD_CHANNEL = 'ich_demo_upload'

/* ==================================================================== *
 * §5  DEFINITIONS
 * ==================================================================== */

interface SideDecl {
  readonly docType: DocTypeDecl
  readonly slot: string
  /** Where this side's documents arrive. */
  readonly channelId: string
  readonly endpointId: string | null
}

interface DefinitionDecl {
  readonly id: string
  readonly version: number
  readonly label: string
  readonly archetype: 'n_way_document_match' | 'set_reconciliation'
  readonly left: SideDecl
  readonly right: SideDecl
  readonly cardinality: 'at_least_one' | 'optional'
  readonly emptyExpectation: 'refuses' | 'permitted'
  /** Amount tolerance, money minor units. */
  readonly amountToleranceMinor: number
  readonly dateToleranceDays: number
  readonly strategies: readonly ('exact_identifier' | 'amount_and_date')[]
}

const SAP = { channelId: 'ich_demo_sap_s3', endpointId: 'end_demo_sap_s3' } as const

const DEF = {
  threeWay: {
    id: 'def_demo_three_way_match', version: 4, label: 'Three-way match', archetype: 'n_way_document_match',
    left: { docType: DT.invoice, slot: 'invoices', channelId: 'ich_demo_ap_s3', endpointId: 'end_demo_ap_s3' },
    right: { docType: DT.poReceipt, slot: 'po_receipts', ...SAP },
    cardinality: 'at_least_one', emptyExpectation: 'refuses',
    amountToleranceMinor: 100, dateToleranceDays: 30, strategies: ['exact_identifier'],
  },
  card: {
    id: 'def_demo_card_settlement', version: 2, label: 'Card settlement', archetype: 'set_reconciliation',
    left: { docType: DT.acquirerLine, slot: 'acquirer_file', channelId: 'ich_demo_acquirer_sftp', endpointId: 'end_demo_acquirer_sftp' },
    right: { docType: DT.cardReceivable, slot: 'card_receivables', ...SAP },
    cardinality: 'at_least_one', emptyExpectation: 'refuses',
    amountToleranceMinor: 5000, dateToleranceDays: 3, strategies: ['exact_identifier'],
  },
  bank: {
    id: 'def_demo_bank_to_erp', version: 3, label: 'Bank to ERP', archetype: 'set_reconciliation',
    left: { docType: DT.bankLine, slot: 'bank_statement', channelId: 'ich_demo_dbs_sftp', endpointId: 'end_demo_dbs_sftp' },
    right: { docType: DT.erpBankPosting, slot: 'erp_bank_clearing', ...SAP },
    cardinality: 'at_least_one', emptyExpectation: 'refuses',
    amountToleranceMinor: 0, dateToleranceDays: 2, strategies: ['exact_identifier'],
  },
  intercompany: {
    id: 'def_demo_intercompany', version: 1, label: 'Intercompany · SEA', archetype: 'set_reconciliation',
    left: { docType: DT.icAdvice, slot: 'ic_advices', channelId: UPLOAD_CHANNEL, endpointId: null },
    right: { docType: DT.icPosting, slot: 'ic_postings', ...SAP },
    cardinality: 'at_least_one', emptyExpectation: 'refuses',
    amountToleranceMinor: 0, dateToleranceDays: 5, strategies: ['exact_identifier'],
  },
  payroll: {
    id: 'def_demo_payroll_clearing', version: 1, label: 'Payroll clearing', archetype: 'set_reconciliation',
    left: { docType: DT.payrollBureau, slot: 'bureau_journal', channelId: 'ich_demo_bureau_sftp', endpointId: 'end_demo_bureau_sftp' },
    right: { docType: DT.payrollGl, slot: 'payroll_clearing', ...SAP },
    cardinality: 'optional', emptyExpectation: 'refuses',
    amountToleranceMinor: 0, dateToleranceDays: 0, strategies: ['exact_identifier'],
  },
} as const satisfies Record<string, DefinitionDecl>

const ALL_DEFINITIONS: readonly DefinitionDecl[] = Object.values(DEF)

/**
 * WHAT EACH DEMO DEFINITION DECLARES ITS RESIDUE RAISES — G3807, 4 Oct 2026,
 * applying THE OWNER'S RULING on G3745, quoted: *"Keep declared rules:
 * exceptions are raised only where a definition declares the rule; seed
 * declarations for the demo definitions."*
 *
 * One `tenant.definition_exception_rule` row per (definition, side, cause) the
 * scenario's residue carries — the LEFT side only, because the declined pair's
 * signed figure is the BUCKET's and both members carry it; declaring the right
 * side too would raise it twice and the register would no longer total to
 * `openResidual` (G3805). With these, a run the ENGINE executes on staging
 * raises its exceptions instead of withholding every one (G3749 — discharged in
 * code by G3861–G3866 — governs whether the deployed worker holds the engine
 * credential). The labels and
 * severities are illustrative, like every figure in this file.
 */
const DOMAIN = 'finance'
const RAISES: Readonly<Record<string, readonly (readonly [string, string, string, string, Severity])[]>> = {
  [DEF.threeWay.id]: [
    ['left', 'amount_tolerance_declined', 'rul_demo_3wm_price', 'Invoice price outside the order tolerance', 'high'],
    ['left', 'no_strategy_paired', 'rul_demo_3wm_unpaired', 'Invoice with no matching purchase order or receipt', 'medium'],
  ],
  [DEF.card.id]: [
    ['left', 'amount_tolerance_declined', 'rul_demo_card_fee', 'Settlement differs from the receivable', 'medium'],
    ['left', 'no_strategy_paired', 'rul_demo_card_unpaired', 'Settlement with no receivable', 'medium'],
  ],
  [DEF.bank.id]: [
    ['left', 'amount_tolerance_declined', 'rul_demo_bank_amount', 'Bank amount differs from posting', 'high'],
    ['left', 'no_strategy_paired', 'rul_demo_bank_unposted', 'Bank line with no ledger posting', 'high'],
  ],
  [DEF.intercompany.id]: [
    ['left', 'amount_tolerance_declined', 'rul_demo_ic_amount', 'Intercompany amounts disagree', 'high'],
    ['left', 'no_strategy_paired', 'rul_demo_ic_unpaired', 'Counter-entry not received', 'high'],
  ],
  [DEF.payroll.id]: [
    ['left', 'amount_tolerance_declined', 'rul_demo_pay_amount', 'Bureau amount differs from the ledger', 'high'],
    ['left', 'no_strategy_paired', 'rul_demo_pay_unpaired', 'Bureau line with no ledger posting', 'high'],
  ],
}

const ENGINE_KNOBS = {
  subsetSum: { maxMembers: 4, stepBudget: 10_000, maxBucketSize: 200 },
  readerCandidateCap: 25,
  similarityMaxChars: 128,
  similarityMetric: 'jaro_winkler',
  refusalCeilingBasisPoints: 500,
  normalisationMaxInputChars: 64,
} as const

/** The definition exactly as `readSetReconciliationDefinition()` returns it. */
function storedDefinition(d: DefinitionDecl): StoredDefinition {
  const side = (s: SideDecl) => ({
    spec: {
      documentTypeId: s.docType.id as never,
      amount: fpath('amount'),
      date: fpath('date'),
      identifiers: [fpath('ref')],
    },
    declaredUnit: { currency: CURRENCY, exponent: EXPONENT },
    carriesControlTotal: 'never' as const,
    emptyExpectation: d.emptyExpectation,
    normalisation: {
      ops: [{ kind: 'trim' as const }],
      then: 'casefold' as const,
      maxInputChars: ENGINE_KNOBS.normalisationMaxInputChars,
    },
    counterparty: null,
    description: null,
  })
  const strategies = d.strategies.map((k) =>
    k === 'exact_identifier' ? { kind: 'exact_identifier' as const, on: fpath('ref') } : { kind: 'amount_and_date' as const },
  )
  const fieldClassification = new Map<FieldPathKey, DataClass>()
  const keys = new Set<string>()
  for (const dt of [d.left.docType, d.right.docType]) for (const f of dt.fields) keys.add(f.key)
  for (const k of [...keys].sort()) fieldClassification.set(fieldPathKey(fpath(k)), DATA_CLASS)
  return {
    left: side(d.left),
    right: side(d.right),
    pairing: {
      cardinality: 'one_to_one',
      amountTolerance: { kind: 'money', value: { currency: CURRENCY, amountMinor: BigInt(d.amountToleranceMinor), exponent: EXPONENT } },
      dateTolerance: { kind: 'days', value: d.dateToleranceDays },
      strategies,
    },
    strategyBindings: strategies.map((strategy) => ({ strategy, amountTolerance: null, amountAnchor: 'exact' as const })),
    obligationSide: 'right',
    toleranceDirection: 'symmetric',
    fieldClassification,
    modelPromptEligible: new Set<FieldPathKey>(),
    confidenceFloors: new Map<FieldPathKey, number>(),
    subsetSumBound: ENGINE_KNOBS.subsetSum,
    readerCandidateCap: ENGINE_KNOBS.readerCandidateCap,
    similarityMaxChars: ENGINE_KNOBS.similarityMaxChars,
    similarityMetric: ENGINE_KNOBS.similarityMetric,
    admissionRefusalCeilingBasisPoints: ENGINE_KNOBS.refusalCeilingBasisPoints,
  }
}

/* ==================================================================== *
 * §6  PERIODS, RUNS AND THEIR DOCUMENTS
 * ==================================================================== */

const PERIODS = [
  /* G3429 — `0430`'s calendar span, inclusive. w10 is the pack's own
     *"02 – 08 Mar 2026"*. */
  { id: 'per_demo_2026_w09', status: 'closed', startsOn: '2026-02-23', endsOn: '2026-03-01' },
  { id: 'per_demo_2026_w10', status: 'open', startsOn: '2026-03-02', endsOn: '2026-03-08' },
] as const

interface Doc {
  readonly id: string
  readonly side: 'left' | 'right'
  readonly docType: DocTypeDecl
  readonly ref: string
  readonly amountMinor: bigint
  readonly date: string
  readonly party: string | null
}

/** What the scenario says about a document that will NOT pair. */
interface Finding {
  readonly ruleKey: string
  readonly ruleLabel: string
  readonly severity: Severity
  readonly assignedTo: string | null
  readonly costCentre: string
  readonly legalEntity: string
  /** The counterpart the engine declined, where one exists. */
  readonly counterpart: Doc | null
}

interface RunDecl {
  readonly id: string
  readonly definition: DefinitionDecl
  readonly periodId: string
  readonly triggerKind: 'scheduled' | 'ingest' | 'manual'
  readonly triggerBy: string | null
  readonly startedAt: string
  readonly finishedAt: string
  readonly arrivedAt: string
  readonly docs: readonly Doc[]
  readonly findings: ReadonlyMap<string, Finding>
}

function minor(sgd: number): bigint {
  return BigInt(Math.round(sgd * 100))
}

function dayIn(first: string, offset: number): string {
  const [y, m, d] = first.split('-').map(Number) as [number, number, number]
  const t = Date.UTC(y, m - 1, d + offset)
  return new Date(t).toISOString().slice(0, 10)
}

interface Plan {
  readonly runId: string
  readonly short: string
  readonly definition: DefinitionDecl
  readonly firstDay: string
  readonly seed: number
  readonly cleanPairs: number
  readonly refPrefix: string
  readonly refStart: number
  readonly amountRange: readonly [number, number]
  readonly parties: readonly string[] | null
  /** Left documents that pair at a disagreeing amount. */
  readonly variances: readonly { leftSgd: number; rightSgd: number; party: string | null; finding: Omit<Finding, 'counterpart'> }[]
  /** Left documents with no counterpart at all. */
  readonly orphans: readonly { sgd: number; party: string | null; finding: Omit<Finding, 'counterpart'> }[]
}

function buildRunDocs(p: Plan): { docs: Doc[]; findings: Map<string, Finding> } {
  const r = prng(p.seed)
  const left: Doc[] = []
  const right: Doc[] = []
  const findings = new Map<string, Finding>()
  let n = 0
  const mk = (side: 'left' | 'right', ref: string, amountMinor: bigint, date: string, party: string | null): Doc => {
    const dt = side === 'left' ? p.definition.left.docType : p.definition.right.docType
    const hasParty = dt.fields.some((f) => f.key === 'party')
    const at = side === 'left' ? left.length : right.length
    return {
      id: `sdo_demo_${p.short}_${side === 'left' ? 'l' : 'r'}${String(at + 1).padStart(4, '0')}`,
      side,
      docType: dt,
      ref,
      amountMinor,
      date,
      party: hasParty ? party : null,
    }
  }
  const nextRef = (): string => `${p.refPrefix}${p.refStart + n++}`
  const amount = (): bigint => {
    const [lo, hi] = p.amountRange
    return minor(Math.round((lo + r() * (hi - lo)) * 100) / 100)
  }
  const party = (): string | null => (p.parties === null ? null : p.parties[Math.floor(r() * p.parties.length)] ?? null)

  /* Interleave the findings through the population so they are not all at the end. */
  const total = p.cleanPairs + p.variances.length + p.orphans.length
  const special = new Map<number, { kind: 'v'; i: number } | { kind: 'o'; i: number }>()
  const stride = Math.floor(total / (p.variances.length + p.orphans.length + 1))
  let slot = stride
  p.variances.forEach((_, i) => {
    special.set(slot, { kind: 'v', i })
    slot += stride
  })
  p.orphans.forEach((_, i) => {
    special.set(slot, { kind: 'o', i })
    slot += stride
  })

  for (let k = 0; k < total; k++) {
    const date = dayIn(p.firstDay, Math.floor(r() * 5))
    const s = special.get(k)
    if (s === undefined) {
      const ref = nextRef()
      const a = amount()
      const who = party()
      left.push(mk('left', ref, a, date, who))
      right.push(mk('right', ref, a, date, who))
    } else if (s.kind === 'v') {
      const v = p.variances[s.i]!
      const ref = nextRef()
      const l = mk('left', ref, minor(v.leftSgd), date, v.party)
      const rr = mk('right', ref, minor(v.rightSgd), date, v.party)
      left.push(l)
      right.push(rr)
      findings.set(l.id, { ...v.finding, counterpart: rr })
    } else {
      const o = p.orphans[s.i]!
      const l = mk('left', nextRef(), minor(o.sgd), date, o.party)
      left.push(l)
      findings.set(l.id, { ...o.finding, counterpart: null })
    }
  }
  return { docs: [...left, ...right], findings }
}

const SG = { costCentre: 'CC-SG-1100', legalEntity: 'LE-SG' } as const

function finding(
  ruleKey: string,
  ruleLabel: string,
  severity: Severity,
  assignedTo: string | null = null,
  where: { costCentre: string; legalEntity: string } = SG,
): Omit<Finding, 'counterpart'> {
  return { ruleKey, ruleLabel, severity, assignedTo, ...where }
}

const PLANS: readonly (Plan & Omit<RunDecl, 'id' | 'docs' | 'findings' | 'definition'>)[] = [
  {
    runId: 'run_demo_3wm_w09', short: '3wm09', definition: DEF.threeWay, periodId: 'per_demo_2026_w09',
    firstDay: '2026-02-23', seed: 9, cleanPairs: 318, refPrefix: 'PO-45000', refStart: 10001,
    amountRange: [120, 48_000], parties: SUPPLIERS,
    triggerKind: 'scheduled', triggerBy: null,
    startedAt: '2026-02-27 03:12:00+08', finishedAt: '2026-02-27 03:12:41+08', arrivedAt: '2026-02-27 02:38:00+08',
    variances: [], orphans: [],
  },
  {
    runId: 'run_demo_3wm_w10', short: '3wm10', definition: DEF.threeWay, periodId: 'per_demo_2026_w10',
    firstDay: '2026-03-02', seed: 10, cleanPairs: 1806, refPrefix: 'PO-45000', refStart: 20001,
    amountRange: [120, 48_000], parties: SUPPLIERS,
    triggerKind: 'scheduled', triggerBy: null,
    startedAt: '2026-03-06 03:12:00+08', finishedAt: '2026-03-06 03:14:07+08', arrivedAt: '2026-03-06 02:38:00+08',
    /* Six invoices priced above their purchase order — SGD 412,900.00 invoiced,
       SGD 18,340.00 of variance, five of them above the SGD 50,000.00 limit. */
    variances: [
      { leftSgd: 96_400, rightSgd: 91_200, party: 'Meridian Foods Pte', finding: finding('price_above_po', 'Price above purchase order', 'critical', USERS.rosalieTan) },
      { leftSgd: 88_250, rightSgd: 84_150, party: 'Meridian Foods Pte', finding: finding('price_above_po', 'Price above purchase order', 'high', USERS.rosalieTan) },
      { leftSgd: 74_900, rightSgd: 71_660, party: 'Meridian Foods Pte', finding: finding('price_above_po', 'Price above purchase order', 'high', USERS.rosalieTan) },
      { leftSgd: 68_350, rightSgd: 65_450, party: 'Meridian Foods Pte', finding: finding('price_above_po', 'Price above purchase order', 'high', USERS.rosalieTan) },
      { leftSgd: 52_600, rightSgd: 50_900, party: 'Meridian Foods Pte', finding: finding('price_above_po', 'Price above purchase order', 'high', USERS.rosalieTan) },
      { leftSgd: 32_400, rightSgd: 31_200, party: 'Meridian Foods Pte', finding: finding('price_above_po', 'Price above purchase order', 'medium') },
    ],
    /* Eight invoices with nothing to match — four whose goods receipt has not
       been posted (SGD 96,214.00), three quoting a PO number S/4HANA does not
       hold (SGD 11,420.00), one against an order already closed. */
    orphans: [
      { sgd: 41_880, party: 'Sembawang Logistics', finding: finding('receipt_absent', 'Goods receipt not posted', 'high') },
      { sgd: 28_334, party: 'Sembawang Logistics', finding: finding('receipt_absent', 'Goods receipt not posted', 'medium') },
      { sgd: 17_600, party: 'Sembawang Logistics', finding: finding('receipt_absent', 'Goods receipt not posted', 'medium') },
      { sgd: 8_400, party: 'Sembawang Logistics', finding: finding('receipt_absent', 'Goods receipt not posted', 'medium') },
      { sgd: 6_120, party: 'Fabrikam Freight', finding: finding('po_not_found', 'No purchase order for the reference', 'medium') },
      { sgd: 3_900, party: 'Tailspin Office Services', finding: finding('po_not_found', 'No purchase order for the reference', 'low') },
      { sgd: 1_400, party: 'Contoso Industrial Supply', finding: finding('po_not_found', 'No purchase order for the reference', 'low') },
      { sgd: 2_150, party: 'Northwind Packaging', finding: finding('po_closed', 'Purchase order already closed', 'low') },
    ],
  },
  {
    runId: 'run_demo_card_w10', short: 'card10', definition: DEF.card, periodId: 'per_demo_2026_w10',
    firstDay: '2026-03-02', seed: 11, cleanPairs: 178, refPrefix: 'STL-0306-', refStart: 1001,
    amountRange: [800, 92_000], parties: ['Visa', 'Mastercard', 'American Express'],
    triggerKind: 'ingest', triggerBy: null,
    startedAt: '2026-03-06 03:22:00+08', finishedAt: '2026-03-06 03:22:19+08', arrivedAt: '2026-03-06 02:40:00+08',
    variances: [
      { leftSgd: 61_204.65, rightSgd: 61_617.00, party: 'Mastercard', finding: finding('scheme_fee_variance', 'Scheme fee not booked', 'medium') },
      { leftSgd: 18_260.90, rightSgd: 18_447.10, party: 'Visa', finding: finding('scheme_fee_variance', 'Scheme fee not booked', 'low') },
    ],
    orphans: [],
  },
  {
    runId: 'run_demo_bank_w10', short: 'bank10', definition: DEF.bank, periodId: 'per_demo_2026_w10',
    firstDay: '2026-03-02', seed: 12, cleanPairs: 237, refPrefix: 'DBS-0039014477-', refStart: 50001,
    amountRange: [50, 312_880], parties: ['GIRO', 'FAST', 'TT', 'CHQ'],
    triggerKind: 'ingest', triggerBy: null,
    startedAt: '2026-03-06 04:40:00+08', finishedAt: '2026-03-06 04:40:33+08', arrivedAt: '2026-03-06 04:39:00+08',
    variances: [
      { leftSgd: 41_880, rightSgd: 39_880, party: 'FAST', finding: finding('amount_differs', 'Bank amount differs from posting', 'high') },
    ],
    orphans: [
      { sgd: 96_214, party: 'TT', finding: finding('unposted_debit', 'Bank debit with no ledger posting', 'critical', USERS.rosalieTan) },
      { sgd: 35, party: 'CHQ', finding: finding('bank_charge', 'Bank charge not booked', 'low') },
    ],
  },
  {
    runId: 'run_demo_ic_w10', short: 'ic10', definition: DEF.intercompany, periodId: 'per_demo_2026_w10',
    firstDay: '2026-03-02', seed: 13, cleanPairs: 23, refPrefix: 'IC-', refStart: 418,
    amountRange: [2_000, 140_000], parties: ['Meridian Malaysia Sdn Bhd', 'Meridian Philippines Inc'],
    triggerKind: 'manual', triggerBy: USERS.markTeo,
    startedAt: '2026-03-05 22:14:00+08', finishedAt: '2026-03-05 22:14:06+08', arrivedAt: '2026-03-05 22:10:00+08',
    variances: [],
    orphans: [
      { sgd: 27_560, party: 'Meridian Malaysia Sdn Bhd', finding: finding('counter_entry_absent', 'Counter-entry not received', 'high', null, { costCentre: 'CC-MY-2100', legalEntity: 'LE-MY' }) },
    ],
  },
  {
    /* No bureau file arrived, and the definition says an empty population is a
       refusal — so the ENGINE refuses, and that refusal is the account. */
    runId: 'run_demo_payroll_w10', short: 'pay10', definition: DEF.payroll, periodId: 'per_demo_2026_w10',
    firstDay: '2026-03-02', seed: 14, cleanPairs: 0, refPrefix: 'PAY-', refStart: 1,
    amountRange: [0, 0], parties: null,
    triggerKind: 'scheduled', triggerBy: null,
    startedAt: '2026-03-06 04:52:00+08', finishedAt: '2026-03-06 04:52:01+08', arrivedAt: '2026-03-06 04:52:00+08',
    variances: [], orphans: [],
  },
]

export const RUNS: readonly RunDecl[] = PLANS.map((p) => {
  const { docs, findings } = buildRunDocs(p)
  return {
    id: p.runId,
    definition: p.definition,
    periodId: p.periodId,
    triggerKind: p.triggerKind,
    triggerBy: p.triggerBy,
    startedAt: p.startedAt,
    finishedAt: p.finishedAt,
    arrivedAt: p.arrivedAt,
    docs,
    findings,
  }
})

function payloadOf(d: Doc): Record<string, unknown> {
  const p: Record<string, unknown> = {
    ref: d.ref,
    amount: { currency: CURRENCY, amountMinor: d.amountMinor.toString(), exponent: EXPONENT },
    date: d.date,
  }
  if (d.party !== null) p['party'] = d.party
  return p
}

/** The document exactly as `assembleRunDocuments()` returns it. */
function reconciliationDocument(d: Doc): ReconciliationDocument {
  const payload = payloadOf(d)
  const extracted: Record<FieldPathKey, ExtractedValue> = {}
  for (const f of [...d.docType.fields].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))) {
    const value = payload[f.key]
    if (value === undefined) continue
    const key = fieldPathKey(fpath(f.key))
    const out = addressableToExtracted({ pathKey: key, dataType: f.dataType, value }, 'structured')
    if (!out.ok) throw new Error(`${d.id}.${f.key} does not extract: ${out.refusal.kind}`)
    extracted[key] = out.extracted
  }
  return {
    tenantId: DEMO_TENANT as TenantId,
    id: d.id as SourceDocumentId,
    extracted,
    lines: [],
    controlTotal: { kind: 'not_declared_by_format' },
  }
}

/* ==================================================================== *
 * §7  THE ENGINE, AND THE STORE'S OWN SQL
 * ==================================================================== */

export interface EngineRun {
  readonly run: RunDecl
  readonly status: 'completed' | 'failed' | 'incomplete' | 'refused'
  readonly result: SetReconciliationResult | null
  readonly sql: string
}

export async function runEngine(run: RunDecl): Promise<EngineRun> {
  const definition = storedDefinition(run.definition)
  const left = run.docs.filter((d) => d.side === 'left').map(reconciliationDocument)
  const right = run.docs.filter((d) => d.side === 'right').map(reconciliationDocument)
  const outcome = runSetReconciliation({
    ...definition,
    runId: run.id as RunId,
    tenantId: DEMO_TENANT as TenantId,
    leftDocuments: left,
    rightDocuments: right,
  })
  const captured: Captured[] = []
  const tx = recordingClient(captured)
  if (!outcome.ok) {
    await persistRunRefusal(tx, { runId: run.id, refusal: outcome.refusal })
    /* G4135 — `refused`, as `run-executor.ts` writes it on this arm since G4033
     * (G4003). This said `failed` and `tests/db/staging-demo-data.test.ts` §4
     * caught the seed disagreeing with the executor once it compared the run
     * row as well as the account. */
    return { run, status: 'refused', result: null, sql: renderCaptured(captured) }
  }
  const status = terminalRunStatus(outcome.result)
  await persistRunEngineAccount(tx, { runId: run.id, terminalStatus: status, result: outcome.result })
  return { run, status, result: outcome.result, sql: renderCaptured(captured) }
}

/* ==================================================================== *
 * §8  THE REGISTER — a projection of the residue (§0's rule)
 * ==================================================================== */

const SEVERITY_RANK: Readonly<Record<Severity, number>> = { critical: 0, high: 1, medium: 2, low: 3 }

function money(m: bigint): string {
  const neg = m < 0n
  const a = neg ? -m : m
  const whole = (a / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${neg ? '-' : ''}${CURRENCY} ${whole}.${(a % 100n).toString().padStart(2, '0')}`
}

interface ExceptionRow {
  readonly id: string
  readonly run: RunDecl
  readonly doc: Doc
  readonly finding: Finding
  readonly varianceMinor: bigint | null
  /** G3803 — the production `signedDeltaOf()`'s answer for this residue entry. */
  readonly deltaMinor: bigint | null
  readonly deltaDirection: 'over' | 'under' | null
}

export function exceptionsOf(e: EngineRun): ExceptionRow[] {
  if (e.result === null) return []
  const out: ExceptionRow[] = []
  const byId = new Map(e.run.docs.map((d) => [d.id, d] as const))
  for (const entry of e.result.residue) {
    if (entry.side !== 'left') continue
    const doc = byId.get(entry.ref.sourceDocumentId as string)
    if (doc === undefined) throw new Error(`residue names an unknown document ${entry.ref.sourceDocumentId}`)
    const f = e.run.findings.get(doc.id)
    if (f === undefined) {
      throw new Error(`${e.run.id}: the engine left ${doc.id} unpaired and the scenario did not plan it`)
    }
    const varianceMinor = entry.cause.kind === 'amount_tolerance_declined' ? entry.cause.signedVarianceMinor : null
    /* G3803 — the SAME function the engine's raiser calls, so a seeded row's
       signed variance is the one a run would raise (§0's projection, signed). */
    const signed = signedDeltaOf(entry, { currency: CURRENCY, exponent: EXPONENT })
    out.push({
      id: `exc_demo_${e.run.id.slice('run_demo_'.length)}_${String(out.length + 1).padStart(2, '0')}`,
      run: e.run,
      doc,
      finding: f,
      varianceMinor,
      deltaMinor: signed.moneyDelta === null ? null : signed.moneyDelta.amountMinor,
      deltaDirection: signed.deltaDirection,
    })
  }
  const planned = [...e.run.findings.keys()].length
  if (out.length !== planned) throw new Error(`${e.run.id}: ${out.length} left residue entries against ${planned} planned findings`)
  return out
}

/* ==================================================================== *
 * §9  RESOLUTION CHAIN — dispositions, the gate, proposals
 * ==================================================================== */

const DISPOSITIONS = [
  ['accept_price_variance', 'Accept the price variance', 'price_variance', 'reversible_with_cost', true, true],
  ['hold_under_query', 'Hold under query with the supplier', 'price_variance', 'reversible', false, false],
  ['await_goods_receipt', 'Await the goods receipt', 'missing_document', 'reversible', false, false],
  ['reject_invoice', 'Reject the invoice to the supplier', 'missing_document', 'reversible_with_cost', true, false],
  ['reject_duplicate', 'Reject as a duplicate', 'duplicate', 'reversible', true, false],
  ['carry_timing_difference', 'Carry as a timing difference', 'timing_difference', 'reversible', false, false],
  ['book_bank_charge', 'Book the unrecorded charge', 'write_off', 'reversible_with_cost', true, true],
  ['correct_erp_posting', 'Correct the ledger posting', 'error_right', 'reversible_with_cost', true, true],
  ['investigate_unidentified', 'Investigate an unidentified item', 'unidentified', 'reversible', false, false],
] as const

/* ==================================================================== *
 * §10  THE FILE
 * ==================================================================== */

const HEADER = `-- ════════════════════════════════════════════════════════════════════════════
-- STAGING DEMO DATA FOR \`ten_acme\` — ILLUSTRATIVE, NOT A CUSTOMER'S DATA.
-- GENERATED by \`db/seeds/generate-demo-data.ts\`. DO NOT EDIT BY HAND:
--   node db/seeds/generate-demo-data.ts           # regenerate
--   node db/seeds/generate-demo-data.ts --check   # tests/db/staging-demo-data.test.ts runs this
-- ════════════════════════════════════════════════════════════════════════════
--
-- OWNER RULING, 2 Oct 2026 (G3131, THE OWNER'S): "Seed ten_acme with
-- illustrative demo data (sources, a three-way-match definition, runs, ~14
-- exceptions, proposals) matching the pack's C1 scenario."
--
-- 🛑 EVERY FIGURE HERE IS ILLUSTRATIVE (PRODUCT.md: "NEVER — present in-product
--    figures as customer results. The data is illustrative."). The scenario is
--    \`docs/handoff-pack/C1 Close.dc.html\`'s own fictional one — "Meridian Group",
--    a three-way match where 1,806 of 1,820 invoice lines match and fourteen do
--    not. Suppliers are the pack's fictional names and the stock sample-company
--    names (Northwind, Contoso, Fabrikam, Tailspin). No real customer is named.
--    People are illustrative ids (\`usr_demo_*\`) with NO \`tenant."user"\` row:
--    this file provisions nobody and grants nothing.
--
-- NOT A MIGRATION, FOR \`staging-signin-seed.sql\`'s reason: it is DATA for one
-- database. \`db/migrate.ts\` never reads \`db/seeds/\`.
--
-- RUN IT AS THE MIGRATOR (\`reconcile_migrator\`, BYPASSRLS) — the app role
-- holds no INSERT on most of these tables, by design. TENANT \`ten_acme\` ONLY:
-- every row names it. Runbook: \`docs/build/deploy-handoff.md\` §24.
--
-- IDEMPOTENT: every statement is \`INSERT … ON CONFLICT DO NOTHING\` on the row's
-- key, so a second application writes nothing. \`ten_acme\` is created exactly as
-- \`staging-signin-seed.sql\` phase 1 creates it, and a disagreeing residency is
-- REFUSED, never overwritten.
--
-- WHAT IS ENGINE-TRUE AND WHAT IS NOT (G3132, G3133):
--   · The run ACCOUNTS (\`tenant.run_*\`) are the PRODUCTION store's own SQL for
--     the PRODUCTION engine's result over the documents below — captured from
--     \`persistRunEngineAccount()\`/\`persistRunRefusal()\` and inlined. They are
--     written under \`set_config('app.tenant_id', 'ten_acme', true)\` because the
--     store derives the tenant column from that GUC. tests/db/ re-executes every
--     run with \`executeRun()\` and requires the same rows.
--   · The EXCEPTION REGISTER is a projection: nothing in this repository writes
--     \`tenant.exception\`. One exception per left-side residue entry; value at
--     risk = that document's amount; the money delta = the engine's signed
--     variance where the cause is \`amount_tolerance_declined\`. Summaries are
--     composed from typed facts by the generator, never from document text.
--   · Proposals, approvals and the one executed resolution are illustrative
--     acts written as the migrator. \`declared_authorization_id\`/\`authorization_id\`
--     carry the sentinel \`${SEED_AUTHORISATION}\`, which names NO
--     \`tenant.authorization_grant\` row — these rows were written by this file,
--     not by an authorised act, and no invariant 10 record is fabricated for them.
--   · The three-way match runs on the one built engine, \`runSetReconciliation()\`:
--     invoice (left) against S/4HANA purchase order WITH goods receipt (right).
--     The goods-receipt leg is folded into the right-hand document; no n-way
--     engine is claimed.
--   · Sources are DECLARATIONS ONLY: no credential_ref, no secret, hosts on
--     \`.example\`, AWS account 111122223333 (AWS's documentation account). SAP
--     S/4HANA arrives as an S3 extract drop because no SAP connector is built.
-- ════════════════════════════════════════════════════════════════════════════
`

export async function generateDemoSeedSql(): Promise<string> {
  const parts: string[] = [HEADER, 'BEGIN;', '']

  /* §1 · the tenant, exactly as phase 1 writes it */
  parts.push(
    `-- 1 · THE TENANT — identical to staging-signin-seed.sql phase 1.
INSERT INTO tenant.tenant (id, status, residency, environment, deployment_mode)
VALUES ('ten_acme', 'active', 'us-west-2', 'sandbox', 'hosted')
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF (SELECT residency FROM tenant.tenant WHERE id = 'ten_acme') <> 'us-west-2' THEN
    RAISE EXCEPTION 'ten_acme exists with a residency other than us-west-2. Not overwritten.';
  END IF;
END $$;

-- 1a · THE TENANT'S REPORTING CURRENCY — G4046 (the owner's: "Declare tenant
-- currency"; "Staging demo seed: SGD"), applied as G4101–G4110. \`0560\` §1:
-- no default exists, so a tenant this file does not name declares nothing.
INSERT INTO tenant.tenant_reporting_currency (tenant_id, currency)
VALUES ('ten_acme', 'SGD')
ON CONFLICT (tenant_id) DO NOTHING;
`,
  )

  const T = DEMO_TENANT
  const declaredAt = '2026-02-02 09:00:00+08'

  /* §2 · document types and field specs */
  parts.push('-- 2 · DOCUMENT TYPES AND FIELD SPECS (invariant 4: classification declared once).')
  parts.push(
    insert(
      'tenant.document_type',
      ['tenant_id', 'id', 'key', 'label', 'domain', 'expected_fidelity', 'carries_control_total'],
      ALL_DOC_TYPES.map((dt) => [T, dt.id, dt.key, dt.label, 'finance', 'structured', 'never']),
    ),
  )
  const specRows: unknown[][] = []
  for (const dt of ALL_DOC_TYPES) {
    for (const f of dt.fields) {
      const p = fpath(f.key)
      specRows.push([T, dt.id, fieldPathKey(p), json([f.key]), DATA_CLASS, f.dataType, false, null])
    }
  }
  parts.push(
    insert(
      'tenant.document_field_spec',
      ['tenant_id', 'document_type_id', 'path_key', 'path', 'data_class', 'data_type', 'model_processing_allowed', 'confidence_floor'],
      specRows,
    ),
    '',
  )

  /* §3 · sources */
  parts.push('-- 3 · SOURCES — declarations only. No credential_ref, no secret, `.example` hosts.')
  parts.push(
    insert(
      'tenant.endpoint',
      ['tenant_id', 'id', 'label', 'direction', 'connection_kind', 'declared_at', 'declared_authorization_id'],
      ENDPOINTS.map((e) => [T, e.id, e.label, 'inbound', e.sftp !== undefined ? 'sftp' : 's3', declaredAt, SEED_AUTHORISATION]),
    ),
  )
  parts.push(
    insert(
      'tenant.endpoint_sftp',
      ['tenant_id', 'endpoint_id', 'host', 'port', 'path', 'host_key_fingerprint'],
      ENDPOINTS.flatMap((e) => (e.sftp === undefined ? [] : [[T, e.id, e.sftp.host, e.sftp.port, e.sftp.path, e.sftp.fingerprint]])),
    ),
  )
  parts.push(
    insert(
      'tenant.endpoint_s3',
      ['tenant_id', 'endpoint_id', 'bucket', 'key_prefix', 'region', 'role_arn', 'external_id'],
      ENDPOINTS.flatMap((e) => (e.s3 === undefined ? [] : [[T, e.id, e.s3.bucket, e.s3.keyPrefix, 'us-west-2', e.s3.roleArn, e.s3.externalId]])),
    ),
  )
  parts.push(
    insert(
      'tenant.intake_channel',
      ['tenant_id', 'id', 'kind', 'endpoint_id', 'enabled'],
      [...ENDPOINTS.map((e) => [T, e.channelId, 'watched_drop', e.id, true]), [T, UPLOAD_CHANNEL, 'upload', null, true]],
    ),
  )
  parts.push(
    insert(
      'tenant.endpoint_document_type',
      ['tenant_id', 'id', 'endpoint_id', 'match_kind', 'match_value', 'document_type_id', 'declared_at', 'declared_authorization_id'],
      ENDPOINTS.flatMap((e) => e.pairs.map((p) => [T, p.id, e.id, 'path_prefix', p.matchValue, p.docType.id, declaredAt, SEED_AUTHORISATION])),
    ),
  )
  parts.push(
    insert(
      'tenant.endpoint_field_mapping',
      ['tenant_id', 'pair_id', 'document_type_id', 'path_key', 'source_field'],
      ENDPOINTS.flatMap((e) =>
        e.pairs.flatMap((p) => Object.entries(p.mapping).map(([k, source]) => [T, p.id, p.docType.id, fieldPathKey(fpath(k)), source])),
      ),
    ),
    '',
  )

  /* §4 · definitions */
  parts.push('-- 4 · DEFINITIONS — the engine spec in typed columns (0160), and the slots (0069).')
  parts.push(
    insert(
      'tenant.reconciliation_definition',
      ['tenant_id', 'id', 'version', 'status', 'name'],
      ALL_DEFINITIONS.map((d) => [T, d.id, d.version, 'active', d.label]),
    ),
  )
  /* G3352 — `0420` added `name` AFTER staging already held these rows, and the
     INSERT above is `ON CONFLICT DO NOTHING`, so on staging it names nothing.
     The UPDATE fills a name ONLY where none is held: an operator-set name is
     never overwritten, and a re-run changes nothing. */
  parts.push(
    `UPDATE tenant.reconciliation_definition d SET name = v.name
  FROM (VALUES
${ALL_DEFINITIONS.map((d) => `    (${lit(d.id)}, ${lit(d.label)})`).join(',\n')}
  ) AS v(id, name)
 WHERE d.tenant_id = ${lit(T)} AND d.id = v.id AND d.name IS NULL;`,
  )
  /* G3807 — the domain the raiser reads (`0500`, G3747) and the declared rules
     (`definition_exception_rule`). `domain` was added AFTER staging held these
     rows, so it is filled ONLY where none is held, as `name` is above. */
  parts.push(
    `UPDATE tenant.reconciliation_definition d SET domain = ${lit(DOMAIN)}
 WHERE d.tenant_id = ${lit(T)} AND d.id IN (${ALL_DEFINITIONS.map((d) => lit(d.id)).join(', ')}) AND d.domain IS NULL;`,
  )
  parts.push(
    insert(
      'tenant.definition_exception_rule',
      ['tenant_id', 'definition_id', 'side', 'cause_kind', 'rule_id', 'rule_version', 'rule_label', 'severity'],
      ALL_DEFINITIONS.flatMap((d) =>
        (RAISES[d.id] ?? []).map(([side, cause, ruleId, label, severity]) => [T, d.id, side, cause, ruleId, 1, label, severity]),
      ),
    ),
  )
  parts.push(
    insert(
      'tenant.definition_engine_spec',
      [
        'tenant_id', 'definition_id', 'obligation_side', 'tolerance_direction', 'pairing_cardinality',
        'amount_tolerance_kind', 'amount_tolerance_value', 'amount_tolerance_money_currency', 'amount_tolerance_money_minor',
        'amount_tolerance_money_exponent', 'amount_tolerance_rounding_minor_units',
        'date_tolerance_kind', 'date_tolerance_value', 'date_tolerance_money_currency', 'date_tolerance_money_minor',
        'date_tolerance_money_exponent', 'date_tolerance_rounding_minor_units',
        'subset_sum_max_members', 'subset_sum_step_budget', 'subset_sum_max_bucket_size',
        'reader_candidate_cap', 'similarity_max_chars', 'similarity_metric', 'admission_refusal_ceiling_basis_points',
      ],
      ALL_DEFINITIONS.map((d) => [
        T, d.id, 'right', 'symmetric', 'one_to_one',
        'money', null, CURRENCY, d.amountToleranceMinor, EXPONENT, null,
        'days', d.dateToleranceDays, null, null, null, null,
        ENGINE_KNOBS.subsetSum.maxMembers, ENGINE_KNOBS.subsetSum.stepBudget, ENGINE_KNOBS.subsetSum.maxBucketSize,
        ENGINE_KNOBS.readerCandidateCap, ENGINE_KNOBS.similarityMaxChars, ENGINE_KNOBS.similarityMetric,
        ENGINE_KNOBS.refusalCeilingBasisPoints,
      ]),
    ),
  )
  const amountP = fpath('amount')
  const dateP = fpath('date')
  const refP = fpath('ref')
  parts.push(
    insert(
      'tenant.definition_population',
      [
        'tenant_id', 'definition_id', 'side', 'document_type_id', 'amount_path', 'amount_path_key', 'date_path', 'date_path_key',
        'declared_unit_currency', 'declared_unit_exponent', 'carries_control_total', 'empty_expectation',
        'normalisation_then', 'normalisation_max_input_chars', 'counterparty_path', 'counterparty_path_key',
        'description_path', 'description_path_key',
      ],
      ALL_DEFINITIONS.flatMap((d) =>
        (['left', 'right'] as const).map((side) => [
          T, d.id, side, d[side].docType.id, json(['amount']), fieldPathKey(amountP), json(['date']), fieldPathKey(dateP),
          CURRENCY, EXPONENT, 'never', d.emptyExpectation, 'casefold', ENGINE_KNOBS.normalisationMaxInputChars,
          null, null, null, null,
        ]),
      ),
    ),
  )
  parts.push(
    insert(
      'tenant.definition_population_identifier',
      ['tenant_id', 'definition_id', 'side', 'ordinal', 'path', 'path_key'],
      ALL_DEFINITIONS.flatMap((d) => (['left', 'right'] as const).map((side) => [T, d.id, side, 0, json(['ref']), fieldPathKey(refP)])),
    ),
  )
  parts.push(
    insert(
      'tenant.definition_normalisation_op',
      ['tenant_id', 'definition_id', 'side', 'ordinal', 'op_kind', 'op_literal', 'op_at', 'op_separator', 'op_index'],
      ALL_DEFINITIONS.flatMap((d) => (['left', 'right'] as const).map((side) => [T, d.id, side, 0, 'trim', null, null, null, null])),
    ),
  )
  parts.push(
    insert(
      'tenant.definition_strategy',
      [
        'tenant_id', 'definition_id', 'ordinal', 'strategy_kind', 'strategy_on_path', 'strategy_on_path_key',
        'strategy_max_members', 'strategy_min_similarity', 'binding_amount_tolerance_kind', 'binding_amount_tolerance_value',
        'binding_amount_tolerance_money_currency', 'binding_amount_tolerance_money_minor', 'binding_amount_tolerance_money_exponent',
        'binding_amount_tolerance_rounding_minor_units', 'binding_amount_anchor',
      ],
      ALL_DEFINITIONS.flatMap((d) =>
        d.strategies.map((k, i) => [
          T, d.id, i, k,
          k === 'exact_identifier' ? json(['ref']) : null,
          k === 'exact_identifier' ? fieldPathKey(refP) : null,
          null, null, null, null, null, null, null, null, 'exact',
        ]),
      ),
    ),
  )
  parts.push(
    insert(
      'tenant.definition_slot',
      ['tenant_id', 'definition_id', 'slot', 'cardinality'],
      ALL_DEFINITIONS.flatMap((d) => [[T, d.id, d.left.slot, d.cardinality], [T, d.id, d.right.slot, d.cardinality]]),
    ),
  )
  parts.push(
    insert(
      'tenant.definition_archetype',
      ['tenant_id', 'definition_id', 'archetype', 'pack_key'],
      ALL_DEFINITIONS.map((d) => [T, d.id, d.archetype, PACK_KEY]),
    ),
  )
  parts.push(
    insert(
      'tenant.disposition',
      ['tenant_id', 'pack_key', 'key', 'label', 'family', 'reversibility', 'terminal', 'requires_adjustment'],
      DISPOSITIONS.map(([key, label, family, rev, terminal, adj]) => [T, PACK_KEY, key, label, family, rev, terminal, adj]),
    ),
  )
  parts.push(
    `INSERT INTO tenant.approval_config
  (tenant_id, quorum, mandatory_at_or_above, mandatory_value_currency, mandatory_value_minor,
   mandatory_value_exponent, segregation_of_duties, escalate_after_hours)
VALUES ('ten_acme', 2, 'high', 'SGD', 5000000, 2, TRUE, 48)
ON CONFLICT DO NOTHING;`,
    '',
  )

  /* §5 · periods */
  parts.push('-- 5 · PERIODS.')
  parts.push(
    insert(
      'tenant.reconciliation_period',
      ['tenant_id', 'id', 'status', 'starts_on', 'ends_on'],
      PERIODS.map((p) => [T, p.id, p.status, p.startsOn, p.endsOn]),
    ),
  )
  /* G3429 — `0430` added the dates AFTER staging held these rows and the
     INSERT is `ON CONFLICT DO NOTHING`, so the UPDATE fills them ONLY where
     none are held — G3352's shape for the definition name. */
  parts.push(
    `UPDATE tenant.reconciliation_period p SET starts_on = v.starts_on::date, ends_on = v.ends_on::date
  FROM (VALUES
${PERIODS.map((p) => `    (${lit(p.id)}, ${lit(p.startsOn)}, ${lit(p.endsOn)})`).join(',\n')}
  ) AS v(id, starts_on, ends_on)
 WHERE p.tenant_id = ${lit(T)} AND p.id = v.id AND p.starts_on IS NULL;`,
    '',
  )

  /* §6 · documents, through two temporary tables so each document is written
     once in the file and fanned out to the five tables in SQL. */
  parts.push(
    '-- 6 · DOCUMENTS — one arrival, one source document, one payload, one control total and',
    '--     one slot binding each (header grain: one document is one line, G1504). Each',
    '--     document is written ONCE below and fanned out by INSERT … SELECT; the temporary',
    '--     tables are dropped at COMMIT.',
    `CREATE TEMPORARY TABLE demo_lane (
  run_id text, side text, definition_id text, slot text, period_id text, document_type_id text,
  channel_id text, channel_kind text, endpoint_id text, arrived_at timestamptz, ext text,
  PRIMARY KEY (run_id, side)
) ON COMMIT DROP;
CREATE TEMPORARY TABLE demo_document (
  ord integer PRIMARY KEY, id text NOT NULL, run_id text NOT NULL, side text NOT NULL, payload jsonb NOT NULL
) ON COMMIT DROP;`,
  )
  const lanes: unknown[][] = []
  const documents: unknown[][] = []
  for (const run of RUNS) {
    for (const side of ['left', 'right'] as const) {
      const s = run.definition[side]
      lanes.push([
        run.id, side, run.definition.id, s.slot, run.periodId, s.docType.id, s.channelId,
        s.endpointId === null ? 'upload' : 'watched_drop', s.endpointId, run.arrivedAt, s.endpointId === null ? 'pdf' : 'json',
      ])
    }
    /* Left slot first, then right, each in document order — the order
       `readSlotFill()` reads them back in on a freshly written table. */
    const ordered = [...run.docs.filter((d) => d.side === 'left'), ...run.docs.filter((d) => d.side === 'right')]
    for (const d of ordered) documents.push([documents.length + 1, d.id, run.id, d.side, json(payloadOf(d))])
  }
  parts.push(
    insert(
      'demo_lane',
      ['run_id', 'side', 'definition_id', 'slot', 'period_id', 'document_type_id', 'channel_id', 'channel_kind', 'endpoint_id', 'arrived_at', 'ext'],
      lanes,
    ),
    insert('demo_document', ['ord', 'id', 'run_id', 'side', 'payload'], documents),
    `INSERT INTO tenant.arrival
  (tenant_id, id, channel_id, channel_kind, endpoint_id, authorization_id, arrived_at, verdict_kind, source_document_id, filename)
SELECT 'ten_acme', 'arr_' || substr(d.id, 5), l.channel_id, l.channel_kind, l.endpoint_id, '${SEED_AUTHORISATION}',
       l.arrived_at, 'admitted', d.id, (d.payload ->> 'ref') || '.' || l.ext
  FROM demo_document d JOIN demo_lane l USING (run_id, side) ORDER BY d.ord
ON CONFLICT DO NOTHING;
INSERT INTO tenant.source_document (tenant_id, id, arrival_id, document_type_id, ingested_at)
SELECT 'ten_acme', d.id, 'arr_' || substr(d.id, 5), l.document_type_id, l.arrived_at
  FROM demo_document d JOIN demo_lane l USING (run_id, side) ORDER BY d.ord
ON CONFLICT DO NOTHING;
INSERT INTO tenant.document_payload (tenant_id, source_document_id, payload)
SELECT 'ten_acme', d.id, d.payload FROM demo_document d ORDER BY d.ord
ON CONFLICT DO NOTHING;
INSERT INTO tenant.document_control_total
  (tenant_id, source_document_id, kind, line_count, total_currency, total_minor, total_exponent)
SELECT 'ten_acme', d.id, 'not_declared_by_format', NULL, NULL, NULL, NULL FROM demo_document d ORDER BY d.ord
ON CONFLICT DO NOTHING;
INSERT INTO tenant.document_slot_binding (tenant_id, definition_id, slot, period_id, source_document_id)
SELECT 'ten_acme', l.definition_id, l.slot, l.period_id, d.id
  FROM demo_document d JOIN demo_lane l USING (run_id, side) ORDER BY d.ord
ON CONFLICT DO NOTHING;`,
    '',
  )

  /* §7 · runs and their engine accounts */
  const engineRuns: EngineRun[] = []
  for (const run of RUNS) engineRuns.push(await runEngine(run))
  const exceptions = engineRuns.flatMap(exceptionsOf)
  const raisedPer = new Map<string, number>()
  for (const x of exceptions) raisedPer.set(x.run.id, (raisedPer.get(x.run.id) ?? 0) + 1)

  parts.push('-- 7 · RUNS. Admitted as the migrator, so `idempotency_key` is NULL (no admission digest was computed).')
  parts.push(
    insert(
      'run',
      ['tenant_id', 'id', 'definition_id', 'definition_version', 'period_id', 'trigger_kind', 'trigger_by_user_id', 'status', 'started_at', 'finished_at', 'exceptions_raised'],
      engineRuns.map((e) => [
        T, e.run.id, e.run.definition.id, e.run.definition.version, e.run.periodId, e.run.triggerKind, e.run.triggerBy,
        e.status, e.run.startedAt, e.run.finishedAt, e.result === null ? null : (raisedPer.get(e.run.id) ?? 0),
      ]),
    ),
    '',
  )
  parts.push(
    "-- 8 · ENGINE ACCOUNTS — the store's own SQL (§0). The store reads the tenant from the GUC.",
    "SELECT set_config('app.tenant_id', 'ten_acme', true);",
  )
  for (const e of engineRuns) {
    parts.push(`-- ${e.run.id} · ${e.result === null ? 'REFUSED by the engine' : `terminal status ${e.status}`}`)
    parts.push(e.sql)
  }
  parts.push('')

  /* §9 · the register */
  const proposalOn = {
    /* The largest price variance: awaiting its SECOND approver (four eyes). */
    awaitingSecond: exceptions.find((x) => x.run.id === 'run_demo_3wm_w10' && x.finding.severity === 'critical')!,
    /* The intercompany counter-entry: proposed by the approver himself, so he may not approve it. */
    awaitingFirst: exceptions.find((x) => x.run.id === 'run_demo_ic_w10')!,
    /* The larger scheme fee variance: approved twice and executed. */
    executed: exceptions.find((x) => x.run.id === 'run_demo_card_w10')!,
    /* The bank amount difference: rejected back to the preparer. */
    rejected: exceptions.find((x) => x.run.id === 'run_demo_bank_w10' && x.varianceMinor !== null)!,
  }
  const statusOf = (x: ExceptionRow): string =>
    x === proposalOn.awaitingSecond || x === proposalOn.awaitingFirst
      ? 'pending_approval'
      : x === proposalOn.executed
        ? 'resolved'
        : x === proposalOn.rejected
          ? 'investigating'
          : 'open'

  const executedAt = '2026-03-06 10:05:00+08'
  parts.push(
    '-- 9 · THE EXCEPTION REGISTER — one per left-side residue entry (§0, G3133).',
    insert(
      'tenant.exception',
      [
        'tenant_id', 'id', 'match_group_id', 'rule_id', 'rule_version', 'definition_version', 'line_key', 'carried_forward_from',
        'domain', 'definition_id', 'rule_label', 'severity', 'severity_rank',
        'value_at_risk_currency', 'value_at_risk_minor', 'value_at_risk_exponent', 'cost_centre', 'legal_entity',
        'status', 'assigned_to', 'raised_at', 'explanation_summary', 'explanation_expected', 'explanation_confidence',
        'delta_kind', 'delta_percentage', 'delta_money_currency', 'delta_money_minor', 'delta_money_exponent',
        /* G3803 — the direction `0510` added; the production `signedDeltaOf()`'s. */
        'delta_money_direction',
        'resolution_mode', 'resolution_disposition_key', 'resolution_proposal_id', 'resolution_decided_by', 'resolution_at',
        'resolution_executed_by',
        /* G3625 — the run whose residue this row was projected from (§0): the
           generator KNOWS it, so it is recorded, not inferred (`0480` §1). */
        'run_id',
      ],
      exceptions.map((x) => {
        const cp = x.finding.counterpart
        const variance = x.varianceMinor
        const abs = x.deltaMinor
        const expected =
          cp === null
            ? `${x.run.definition.right.docType.label} for ${x.doc.ref}`
            : `${money(cp.amountMinor)} on ${cp.ref}`
        const summary =
          cp === null
            ? `${x.doc.ref} for ${money(x.doc.amountMinor)} has no counterpart in this run.`
            : `${x.doc.ref} is ${money(x.doc.amountMinor)} against ${money(cp.amountMinor)}; the engine declined the pair at a variance of ${money(variance ?? 0n)}.`
        const executed = x === proposalOn.executed
        return [
          T, x.id, `mg_${x.id.slice('exc_'.length)}`, `rul_demo_${x.finding.ruleKey}`, 1, x.run.definition.version, x.doc.id, null,
          'finance', x.run.definition.id, x.finding.ruleLabel, x.finding.severity, SEVERITY_RANK[x.finding.severity],
          CURRENCY, x.doc.amountMinor, EXPONENT, x.finding.costCentre, x.finding.legalEntity,
          statusOf(x), x.finding.assignedTo, x.run.finishedAt, summary, expected, null,
          abs === null ? null : 'money',
          abs === null || cp === null ? null : Math.round(Number((abs * 10000n) / cp.amountMinor)) / 100,
          abs === null ? null : CURRENCY, abs, abs === null ? null : EXPONENT,
          abs === null ? null : x.deltaDirection,
          executed ? 'approved' : null, executed ? 'book_bank_charge' : null, executed ? 'prp_demo_03' : null,
          executed ? USERS.danielLim : null, executed ? executedAt : null, executed ? USERS.markTeo : null,
          x.run.id,
        ]
      }),
    ),
  )
  /* G3625 — `0480` added `run_id` AFTER staging held these rows and the INSERT
     is `ON CONFLICT DO NOTHING`, so the UPDATE fills it ONLY where none is held
     (G3352's and G3429's shape). Each value is the run the row was projected
     from — a fact this generator holds, never a join's guess. */
  parts.push(
    `UPDATE tenant.exception e SET run_id = v.run_id
  FROM (VALUES
${exceptions.map((x) => `    (${lit(x.id)}, ${lit(x.run.id)})`).join(',\n')}
  ) AS v(id, run_id)
 WHERE e.tenant_id = ${lit(T)} AND e.id = v.id AND e.run_id IS NULL;`,
    '',
  )
  /* G3803 — `0510` added the direction AFTER staging held these rows, and an
     open item with no counterpart now carries its open residual as its money
     delta (`signedDeltaOf`). Filled ONLY where no direction is held. */
  parts.push(
    `UPDATE tenant.exception e
   SET delta_kind = 'money', delta_money_currency = ${lit(CURRENCY)}, delta_money_minor = v.minor,
       delta_money_exponent = ${lit(EXPONENT)}, delta_money_direction = v.direction
  FROM (VALUES
${exceptions
  .filter((x) => x.deltaMinor !== null)
  .map((x) => `    (${lit(x.id)}, ${lit(x.deltaMinor)}::int8, ${lit(x.deltaDirection)})`)
  .join(',\n')}
  ) AS v(id, minor, direction)
 WHERE e.tenant_id = ${lit(T)} AND e.id = v.id AND e.delta_money_direction IS NULL;`,
    '',
  )
  const observed: unknown[][] = []
  for (const x of exceptions) {
    const left = x.run.definition.left
    const right = x.run.definition.right
    const values: [string, Doc, string][] = [[left.slot, x.doc, 'ref'], [left.slot, x.doc, 'amount']]
    if (x.finding.counterpart !== null) values.push([right.slot, x.finding.counterpart, 'amount'])
    values.forEach(([slot, d, key], ordinal) => {
      const isMoney = key === 'amount'
      observed.push([
        T, x.id, ordinal, slot, json([key]), null, d.id,
        isMoney ? 'money' : 'identifier', isMoney ? null : d.ref, null, null,
        isMoney ? CURRENCY : null, isMoney ? d.amountMinor : null, isMoney ? EXPONENT : null,
        null, null, null, null, null, null, DATA_CLASS,
      ])
    })
  }
  parts.push(
    insert(
      'tenant.exception_observed_value',
      [
        'tenant_id', 'exception_id', 'ordinal', 'slot', 'path', 'line_index', 'source_document_id',
        'scalar_kind', 'scalar_text', 'scalar_number', 'scalar_date',
        'scalar_money_currency', 'scalar_money_minor', 'scalar_money_exponent',
        'provenance_page', 'provenance_box_x', 'provenance_box_y', 'provenance_box_width', 'provenance_box_height',
        'provenance_confidence', 'data_class',
      ],
      observed,
    ),
    '',
  )

  /* §10 · proposals */
  const exec = proposalOn.executed
  const execVariance = exec.varianceMinor === null ? 0n : exec.varianceMinor < 0n ? -exec.varianceMinor : exec.varianceMinor
  const proposals: unknown[][] = [
    [T, 'prp_demo_01', proposalOn.awaitingSecond.id, 'user', USERS.rosalieTan, null, null, 'hold_under_query',
      'Hold under query rather than post. The supply contract permits a price revision on 30 days written notice and no notice is on file, so the difference is not yet a cost this tenant owes.',
      null, null, null, '2026-03-06 08:14:00+08', null],
    [T, 'prp_demo_02', proposalOn.awaitingFirst.id, 'user', USERS.markTeo, null, null, 'carry_timing_difference',
      'The counter-entry from the Malaysian entity is expected after its local close; carry the line as a timing difference into next week.',
      null, null, null, '2026-03-05 23:02:00+08', null],
    [T, 'prp_demo_03', exec.id, 'user', USERS.rosalieTan, null, null, 'book_bank_charge',
      'The difference is the scheme fee on the contracted rate card. Book it to scheme charges.',
      CURRENCY, execVariance, EXPONENT, '2026-03-06 08:40:00+08', null],
    [T, 'prp_demo_04', proposalOn.rejected.id, 'user', USERS.rosalieTan, null, null, 'correct_erp_posting',
      'The ledger posting carries freight rounding the bank did not apply; correct the posting to the bank amount.',
      CURRENCY, proposalOn.rejected.varianceMinor === null ? 0n : (proposalOn.rejected.varianceMinor < 0n ? -proposalOn.rejected.varianceMinor : proposalOn.rejected.varianceMinor), EXPONENT,
      '2026-03-06 09:02:00+08', null],
  ]
  parts.push(
    '-- 10 · PROPOSALS AND APPROVALS — illustrative acts (§0). Gate: quorum 2, segregation of duties,',
    '--      mandatory at or above high / SGD 50,000.00.',
    insert(
      'tenant.resolution_proposal',
      [
        'tenant_id', 'id', 'exception_id', 'proposed_by_kind', 'proposed_by_user_id', 'proposed_by_step_id', 'proposed_by_model_id',
        'disposition_key', 'rationale', 'adjustment_currency', 'adjustment_minor', 'adjustment_exponent', 'proposed_at', 'superseded_by_proposal_id',
      ],
      proposals,
    ),
    insert(
      'tenant.proposal_evidence',
      ['tenant_id', 'proposal_id', 'ordinal', 'kind', 'ref', 'note'],
      [
        [T, 'prp_demo_01', 0, 'document', 'Contract MF-2024-11 · clause 7.2', 'Permits a revision on 30 days written notice.'],
        [T, 'prp_demo_01', 1, 'free_text', 'Notice of revision', 'Nothing on file in this period or the two before it.'],
        [T, 'prp_demo_02', 0, 'system_record', proposalOn.awaitingFirst.doc.id, 'The advice is on file; the counter-posting is not.'],
        [T, 'prp_demo_03', 0, 'document', 'Contracted scheme rates · effective 01 Jan', 'The difference equals the scheme fee at the contracted rate.'],
        [T, 'prp_demo_04', 0, 'system_record', proposalOn.rejected.doc.id, 'Bank line and ledger posting share the reference.'],
      ],
    ),
    insert(
      'tenant.approval_decision',
      ['tenant_id', 'id', 'proposal_id', 'exception_id', 'decided_by', 'decision', 'reason', 'requested_at', 'decided_at'],
      [
        [T, 'apd_demo_01', 'prp_demo_01', proposalOn.awaitingSecond.id, USERS.markTeo, 'approved', null, '2026-03-06 08:14:00+08', '2026-03-06 09:12:00+08'],
        [T, 'apd_demo_02', 'prp_demo_03', exec.id, USERS.markTeo, 'approved', null, '2026-03-06 08:40:00+08', '2026-03-06 09:30:00+08'],
        [T, 'apd_demo_03', 'prp_demo_03', exec.id, USERS.danielLim, 'approved', null, '2026-03-06 08:40:00+08', '2026-03-06 09:58:00+08'],
        [T, 'apd_demo_04', 'prp_demo_04', proposalOn.rejected.id, USERS.markTeo, 'rejected', 'The evidence does not support it: get the bank advice for the freight leg first.', '2026-03-06 09:02:00+08', '2026-03-06 09:40:00+08'],
      ],
    ),
    '',
    'COMMIT;',
    '',
  )
  return parts.join('\n')
}

export const SEED_PATH = fileURLToPath(new URL('./staging-demo-data.sql', import.meta.url))

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const sql = await generateDemoSeedSql()
  if (process.argv.includes('--check')) {
    const committed = readFileSync(SEED_PATH, 'utf8')
    if (committed !== sql) {
      console.error('db/seeds/staging-demo-data.sql is STALE — run: node db/seeds/generate-demo-data.ts')
      process.exit(1)
    }
    console.log('db/seeds/staging-demo-data.sql matches its generator.')
  } else {
    writeFileSync(SEED_PATH, sql)
    console.log(`wrote ${SEED_PATH} (${Buffer.byteLength(sql)} bytes)`)
  }
}
