import type { ExceptionRow } from './api/exceptions.ts'
import type { IntakeLane } from './api/intake.ts'
import type { Run } from './api/runs.ts'

/**
 * THE PRE-RENDERED PAGE'S ROWS, AND THEY ARE ILLUSTRATIVE.
 *
 * 🛑 PRODUCT.md IS THE AUTHORITY AND IT IS UNAMBIGUOUS: "NEVER present
 * in-product figures as customer results. The data is illustrative." Nothing
 * below is a customer, a result, or a measurement. `Specimen.tsx` says the same
 * of its own 0.91, and the register's caption says it again where a reader
 * actually meets these rows — a file comment is not a disclosure.
 *
 * ⚠️ WHY A BUILT PAGE HAS ROWS AT ALL. `frontend/dist/shell.html` is
 * pre-rendered: Chromium blocks `<script type="module">` on a `file://` origin,
 * so a client-rendered page loaded from disk would show an empty mount point and
 * there would be no register to review. The rows are therefore drawn from here
 * rather than fetched — and `tests/design/shell.test.ts` says so in its own
 * header rather than letting a reader assume the page proves a plane answered.
 *
 * ┌─ 🛑 THE ONE PROPERTY THESE ROWS MUST HOLD ─────────────────────────────────┐
 * │ `completeness` IS `null` ON EVERY ONE OF THEM, INCLUDING THE `incomplete`  │
 * │ RUN — because that is the ONLY value the plane can serve.                  │
 * │                                                                            │
 * │ `server/data-plane/runs.ts`: "`[]` the ENGINE ran and observed no          │
 * │ shortfall; `null` THIS PLANE HOLDS NO ENGINE ACCOUNT FOR THIS RUN AT ALL", │
 * │ and every row is `null` because nothing in this repository persists a      │
 * │ `SetReconciliationResult`.                                                 │
 * │                                                                            │
 * │ An illustrative fixture is exactly where a plausible `[]` would arrive     │
 * │ unnoticed — it makes a nicer screenshot, and it would make the built page  │
 * │ draw a state the plane cannot produce. That is the fabrication the handler │
 * │ refuses; a fixture is not exempt from it.                                  │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ AND THE TWO STATUSES ARE THE POINT OF HAVING TWO ROWS. G153: "A run that is
 * `incomplete` must read differently from one that is `completed`." One of each,
 * so the distinction is visible on the page rather than merely representable.
 * `incomplete` is O-16's SOUND OVER LESS THAN EVERYTHING — neither `completed`
 * nor `failed`.
 */
export const ILLUSTRATIVE_RUNS: readonly Run[] = [
  {
    runId: 'run_2026_03_three_way_09',
    definitionId: 'def_three_way_match',
    definitionName: 'Three-way match',
    definitionVersion: 4,
    periodId: 'per_2026_03',
    periodStartsOn: '2026-03-02',
    periodEndsOn: '2026-03-08',
    trigger: { kind: 'scheduled' },
    status: 'incomplete',
    startedAt: '2026-03-09T03:12:00.000Z',
    finishedAt: '2026-03-09T03:19:41.000Z',
    exceptionsRaised: null,
    completeness: null,
  },
  {
    runId: 'run_2026_03_bank_to_erp_08',
    definitionId: 'def_bank_to_erp',
    definitionName: 'Bank to ERP',
    definitionVersion: 2,
    periodId: 'per_2026_03',
    periodStartsOn: '2026-03-02',
    periodEndsOn: '2026-03-08',
    trigger: { kind: 'manual' },
    status: 'completed',
    startedAt: '2026-03-08T21:40:00.000Z',
    finishedAt: '2026-03-08T21:44:02.000Z',
    exceptionsRaised: null,
    completeness: null,
  },
  {
    runId: 'run_2026_03_intercompany_07',
    definitionId: 'def_intercompany',
    definitionName: 'Intercompany · SEA',
    definitionVersion: 1,
    periodId: 'per_2026_03',
    periodStartsOn: '2026-03-02',
    periodEndsOn: '2026-03-08',
    trigger: { kind: 'ingest' },
    status: 'failed',
    startedAt: '2026-03-07T11:02:00.000Z',
    finishedAt: '2026-03-07T11:02:18.000Z',
    exceptionsRaised: null,
    completeness: null,
  },
]

/**
 * The caption the built page carries. It is a SENTENCE ON THE PAGE, not a
 * comment in a file, because the person who needs it is looking at the register
 * and not at this module.
 */
export const ILLUSTRATIVE_PROVENANCE =
  'illustrative rows, not a plane answer'

/**
 * THE PRE-RENDERED REGISTER'S ROWS — illustrative, like the runs above, and
 * labelled so in the status bar by `ILLUSTRATIVE_PROVENANCE`. G3091 gave the
 * built page the C1 register, and a register drawn with no rows can only show
 * its empty state; these three exercise a money cell, a non-monetary cell and
 * an assigned row. No customer, counterparty or figure here is real
 * (PRODUCT.md: "The data is illustrative").
 */
export const ILLUSTRATIVE_EXCEPTIONS: readonly ExceptionRow[] = [
  {
    exceptionId: 'exc_illustrative_0001',
    domain: 'finance',
    definitionId: 'def_three_way_match',
    ruleLabel: 'Three-way match',
    severity: 'critical',
    severityRank: 0,
    valueAtRisk: { currency: 'SGD', amountMinor: '4820000', exponent: 2 },
    costCentre: null,
    legalEntity: null,
    status: 'open',
    assignedTo: null,
    assignedToName: null,
    assignedToFormerMember: false,
    raisedAt: '2026-03-09T03:14:00.000Z',
    summary: 'Invoice total exceeds the goods received by two lines',
    carriedForwardFrom: null,
    runId: null,
    variance: { currency: 'SGD', amountMinor: '183400', exponent: 2 },
  },
  {
    exceptionId: 'exc_illustrative_0002',
    domain: 'finance',
    definitionId: 'def_three_way_match',
    ruleLabel: 'Duplicate invoice',
    severity: 'high',
    severityRank: 1,
    valueAtRisk: { currency: 'SGD', amountMinor: '129500', exponent: 2 },
    costCentre: null,
    legalEntity: null,
    status: 'investigating',
    assignedTo: 'usr_illustrative',
    assignedToName: null,
    assignedToFormerMember: false,
    raisedAt: '2026-03-09T03:15:00.000Z',
    summary: 'The same invoice number arrived twice from one supplier',
    carriedForwardFrom: null,
    runId: null,
    variance: null,
  },
  {
    exceptionId: 'exc_illustrative_0003',
    domain: 'finance',
    definitionId: 'def_bank_to_erp',
    ruleLabel: 'Unmatched bank line',
    severity: 'medium',
    severityRank: 2,
    valueAtRisk: null,
    costCentre: null,
    legalEntity: null,
    status: 'pending_approval',
    assignedTo: null,
    assignedToName: null,
    assignedToFormerMember: false,
    raisedAt: '2026-03-08T21:44:00.000Z',
    summary: 'A bank credit with no posting against it',
    carriedForwardFrom: null,
    runId: null,
    variance: null,
  },
]

/** The pre-rendered intake strip — two configured lanes, illustrative. */
export const ILLUSTRATIVE_LANES: readonly IntakeLane[] = [
  { channel: 'upload', configured: true, lastArrival: '2026-03-09T03:02:00.000Z' },
  { channel: 'watched_drop', configured: true, lastArrival: '2026-03-09T03:06:00.000Z' },
  { channel: 'connector_pull', configured: false, lastArrival: null },
  { channel: 'mailbox', configured: false, lastArrival: null },
]
