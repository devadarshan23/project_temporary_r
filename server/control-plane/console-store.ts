/**
 * THE CONSOLE'S CONTROL-OWNED FACTS, READ AND ADVANCED BY THE PLANE THAT OWNS
 * THEM. G4306, G4308.
 *
 * THE OWNER'S RULING, 5 Oct 2026: *"…put onboarding writes and roster reads
 * behind signed control-plane endpoints, then retire both control-DB
 * credentials from the data plane."* This module is the far side of those
 * endpoints. It runs as `reconcile_control_app` — this plane's own role — under
 * `db/migrations-control/0050_control_plane_serves_console.sql`'s grants, which
 * are `0040`'s writer grants moved to the process that owns the database.
 *
 * 🛑 IT PUBLISHES FACTS, NOT A RENDERING. The reads return the stored roster
 * row, the stored prefix length and the stored forced marks, unvalidated; the
 * DATA plane still assembles them with `model/onboarding.ts` and still owns
 * every refusal a console caller sees (`server/data-plane/console-roster-store.ts`).
 * Rendering in two places would be §5.3.
 *
 * 🛑 THE WRITES ARE THE EXCEPTION AND MUST BE: a transition is decided against
 * the record UNDER ITS ROW LOCK, so `completeStep()`/`forceStep()` run here, in
 * the transaction that writes. The lock is `0040`'s argument verbatim —
 * PostgreSQL refuses `FOR UPDATE` on the nullable side of an outer join, so the
 * roster check and the lock are two statements (G1425).
 *
 * ⚠️ IDEMPOTENT ON THE CALLER'S KEY, BECAUSE THE SIGNATURE IS REPLAYABLE. A
 * captured internal request can be re-sent inside STS's window
 * (`server/http/internal-request.ts`), and a network retry is the ordinary
 * case. The FIRST answer is stored in `internal_request_receipt`, in the SAME
 * transaction as the act, and a repeat with the same request returns it; the
 * same key on a DIFFERENT request is refused. Every receipt carries the
 * platform authorisation id the data plane minted for the act (G4309).
 */

import {
  ONBOARDING_STEPS,
  completeStep,
  forceStep,
  type ForcedStep,
  type OnboardingOutcome,
  type OnboardingRecord,
  type OnboardingRefusal,
  type OnboardingStepKey,
  type CompletedStepCount,
} from '../../model/onboarding.ts'
import type { CataloguePool, ControlTx } from './db.ts'

export interface ForcedFact {
  readonly step: string
  readonly reason: string
}

export interface RosterFact {
  readonly tenantId: string
  readonly name: string
  readonly deploymentMode: string
  readonly residency: string
  readonly supportAccessMode: string
  readonly plan: string | null
  /** `null` when no onboarding record exists — the DATA plane names the refusal. */
  readonly completedSteps: number | null
  readonly forced: readonly ForcedFact[]
}

export interface OnboardingFact {
  readonly onRoster: boolean
  readonly completedSteps: number | null
  readonly forced: readonly ForcedFact[]
}

const ROSTER_READ = `
  SELECT r.tenant_id, r.name, r.deployment_mode, r.residency,
         r.support_access_mode, r.plan, o.completed_steps
    FROM tenancy_roster r
    LEFT JOIN onboarding_record o ON o.tenant_id = r.tenant_id
   ORDER BY r.tenant_id ASC
`
const ALL_FORCED = `
  SELECT tenant_id, step, reason FROM onboarding_forced_step
   ORDER BY tenant_id ASC, step ASC
`
const ONE_ROSTER = `
  SELECT r.tenant_id, o.completed_steps
    FROM tenancy_roster r
    LEFT JOIN onboarding_record o ON o.tenant_id = r.tenant_id
   WHERE r.tenant_id = $1
`
const ONE_FORCED = `
  SELECT step, reason FROM onboarding_forced_step WHERE tenant_id = $1 ORDER BY step ASC
`
const ROSTER_HAS_TENANT = 'SELECT 1 FROM tenancy_roster WHERE tenant_id = $1'
const RECORD_LOCKED = 'SELECT completed_steps FROM onboarding_record WHERE tenant_id = $1 FOR UPDATE'
const ADVANCE = 'UPDATE onboarding_record SET completed_steps = $2 WHERE tenant_id = $1'
/* G4316 — the mark names the platform authorisation it was written under (`0051`). */
const MARK_FORCED =
  'INSERT INTO onboarding_forced_step (tenant_id, step, reason, authorisation_id) VALUES ($1, $2, $3, $4)'
const RECEIPT_READ = 'SELECT operation, request_sha256, response FROM internal_request_receipt WHERE idempotency_key = $1'
const RECEIPT_WRITE = `
  INSERT INTO internal_request_receipt
    (idempotency_key, operation, request_sha256, authorisation_id, caller, response)
  VALUES ($1, $2, $3, $4, $5, $6)
`

const asCount = (raw: unknown): number | null => (typeof raw === 'number' ? raw : null)
const forcedOf = (rows: readonly Record<string, unknown>[]): ForcedFact[] =>
  rows.map((r) => ({ step: String(r['step']), reason: String(r['reason']) }))

export async function readRosterFacts(pool: CataloguePool): Promise<readonly RosterFact[]> {
  return await pool.transaction(async (tx) => {
    const roster = (await tx.query(ROSTER_READ)).rows as Record<string, unknown>[]
    const forced = (await tx.query(ALL_FORCED)).rows as Record<string, unknown>[]
    return roster.map((r): RosterFact => {
      const tenantId = String(r['tenant_id'])
      const plan = r['plan']
      return {
        tenantId,
        name: String(r['name']),
        deploymentMode: String(r['deployment_mode']),
        residency: String(r['residency']),
        supportAccessMode: String(r['support_access_mode']),
        plan: plan === null || plan === undefined ? null : String(plan),
        completedSteps: asCount(r['completed_steps']),
        forced: forcedOf(forced.filter((f) => String(f['tenant_id']) === tenantId)),
      }
    })
  })
}

export async function readOnboardingFact(pool: CataloguePool, tenantId: string): Promise<OnboardingFact> {
  return await pool.transaction(async (tx) => {
    const row = ((await tx.query(ONE_ROSTER, [tenantId])).rows as Record<string, unknown>[])[0]
    const forced = forcedOf((await tx.query(ONE_FORCED, [tenantId])).rows as Record<string, unknown>[])
    return { onRoster: row !== undefined, completedSteps: asCount(row?.['completed_steps']), forced }
  })
}

/* ------------------------------------------------------------------ writes */

export const TRANSITION_REFUSALS = {
  tenantNotOnRoster: 'tenant_not_on_roster',
  onboardingRecordAbsent: 'onboarding_record_absent',
  completedCountUnreadable: 'completed_count_unreadable',
  forcedStepUnreadable: 'forced_step_unreadable',
} as const
export type TransitionRefusal = (typeof TRANSITION_REFUSALS)[keyof typeof TRANSITION_REFUSALS]

/** The wire body of an internal write — stored whole as the receipt's response. */
export type TransitionAnswer =
  | { readonly outcome: 'ok'; readonly completedSteps: number; readonly forced: readonly ForcedFact[] }
  | { readonly outcome: 'refused'; readonly refusal: TransitionRefusal }
  | { readonly outcome: 'verdict'; readonly verdict: OnboardingRefusal }

export type ReceiptedAnswer =
  | { readonly kind: 'answer'; readonly answer: TransitionAnswer; readonly replayed: boolean }
  | { readonly kind: 'key_reused' }

export interface TransitionRequest {
  readonly operation: 'completeInternalOnboardingStep' | 'forceInternalOnboardingStep'
  readonly tenantId: string
  readonly step: OnboardingStepKey
  readonly reason: string | null
  readonly idempotencyKey: string
  /** sha256 over method, path and body — what makes a replay the SAME request. */
  readonly requestSha256: string
  readonly authorisationId: string
  readonly caller: string
}

function countOf(raw: unknown): CompletedStepCount | null {
  if (typeof raw !== 'number' || !Number.isInteger(raw)) return null
  if (raw < 0 || raw > ONBOARDING_STEPS.length) return null
  return raw as CompletedStepCount
}
function stepOf(raw: unknown): OnboardingStepKey | null {
  const steps: readonly string[] = ONBOARDING_STEPS
  return typeof raw === 'string' && steps.includes(raw) ? (raw as OnboardingStepKey) : null
}

async function decideAndWrite(tx: ControlTx, req: TransitionRequest): Promise<TransitionAnswer> {
  const onRoster = (await tx.query(ROSTER_HAS_TENANT, [req.tenantId])).rows.length > 0
  if (!onRoster) return { outcome: 'refused', refusal: TRANSITION_REFUSALS.tenantNotOnRoster }
  const held = ((await tx.query(RECORD_LOCKED, [req.tenantId])).rows as Record<string, unknown>[])[0]
  if (held === undefined) return { outcome: 'refused', refusal: TRANSITION_REFUSALS.onboardingRecordAbsent }
  const completed = countOf(held['completed_steps'])
  if (completed === null) return { outcome: 'refused', refusal: TRANSITION_REFUSALS.completedCountUnreadable }
  const marks: ForcedStep[] = []
  for (const f of (await tx.query(ONE_FORCED, [req.tenantId])).rows as Record<string, unknown>[]) {
    const step = stepOf(f['step'])
    if (step === null) return { outcome: 'refused', refusal: TRANSITION_REFUSALS.forcedStepUnreadable }
    marks.push({ step, reason: String(f['reason']) })
  }
  const record: OnboardingRecord = { completed, forced: marks }
  const outcome: OnboardingOutcome =
    req.reason === null ? completeStep(record, req.step) : forceStep(record, req.step, req.reason)
  if (!outcome.ok) return { outcome: 'verdict', verdict: outcome.refusal }

  await tx.query(ADVANCE, [req.tenantId, outcome.record.completed])
  if (req.reason !== null) {
    const appended = outcome.record.forced.find((m) => m.step === req.step)
    if (appended === undefined) {
      throw new Error(
        `forceStep() allowed a force of \`${req.step}\` and returned no mark for it — the advance ` +
          'and the mark are one act, and writing one without the other is refused (model/onboarding.ts).',
      )
    }
    await tx.query(MARK_FORCED, [req.tenantId, appended.step, appended.reason, req.authorisationId])
  }
  return {
    outcome: 'ok',
    completedSteps: outcome.record.completed,
    forced: outcome.record.forced.map((m) => ({ step: m.step, reason: m.reason })),
  }
}

async function attempt(pool: CataloguePool, req: TransitionRequest): Promise<ReceiptedAnswer> {
  return await pool.transaction(async (tx) => {
    const prior = ((await tx.query(RECEIPT_READ, [req.idempotencyKey])).rows as Record<string, unknown>[])[0]
    if (prior !== undefined) {
      if (prior['operation'] !== req.operation || prior['request_sha256'] !== req.requestSha256) {
        return { kind: 'key_reused' }
      }
      return { kind: 'answer', answer: prior['response'] as TransitionAnswer, replayed: true }
    }
    const answer = await decideAndWrite(tx, req)
    await tx.query(RECEIPT_WRITE, [
      req.idempotencyKey,
      req.operation,
      req.requestSha256,
      req.authorisationId,
      req.caller,
      JSON.stringify(answer),
    ])
    return { kind: 'answer', answer, replayed: false }
  })
}

/**
 * One transition, receipted. A concurrent first use of the same key loses the
 * PRIMARY KEY race, rolls back its whole act, and is answered from the
 * winner's receipt — so two deliveries of one request advance the record once.
 */
export async function applyTransition(pool: CataloguePool, req: TransitionRequest): Promise<ReceiptedAnswer> {
  try {
    return await attempt(pool, req)
  } catch (err) {
    if ((err as { code?: unknown }).code !== '23505') throw err
    return await attempt(pool, req)
  }
}
