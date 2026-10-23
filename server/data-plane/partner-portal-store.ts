/**
 * A PARTNER FIRM'S DEALS, SANDBOX AND TRIAL REQUESTS — the readers and writers
 * over `db/migrations/0322`. W5, 1 Oct 2026, G2633–G2640.
 *
 * Every function runs INSIDE a portal act's transaction, after the act's
 * invariant 10 record has been written and named in `app.authorisation_ref`
 * (`writePartnerAuthorisationRecord()`). `0322` keys every table on THAT row's
 * firm, so a function called outside an act reads nothing and writes nothing —
 * and the firm is never a parameter a caller supplies: it is read from the
 * grant the seam minted.
 *
 * 🛑 EVERY WRITE IS WRAPPED IN A SAVEPOINT, for `writePartnerInvitation()`'s
 *    reason: a refused `INSERT` aborts the transaction, `COMMIT` on an aborted
 *    transaction is a silent `ROLLBACK`, and the act's record — written first,
 *    in the same transaction — would vanish with it. The act was authorised
 *    and attempted; its record stands whether or not the row did.
 */
import { randomBytes } from 'node:crypto'

import type { ScopedClient } from '../../db/tenant-scope.ts'
import type { PartnerAuthorizationGrant } from '../../model/access.ts'
import type { Timestamp } from '../../model/kernel.ts'
import { formatMinorUnits } from '../../model/money.ts'
import {
  DEAL_STANDINGS,
  SANDBOX_STANDINGS,
  checkDealRegistrationShape,
  type DealRegistrationFields,
  type DealRegistrationId,
  type DealShapeRefusal,
  type SandboxRequestId,
  type TrialTenantRequestId,
} from '../../model/partner-portal.ts'

function iso(value: unknown): Timestamp {
  return value instanceof Date ? value.toISOString() : String(value)
}

/** Run one `INSERT`; map a refusal by SQLSTATE; keep the act's record either way. */
async function guardedInsert<T>(
  tx: ScopedClient,
  name: string,
  run: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; sqlstate: string }> {
  await tx.query(`SAVEPOINT ${name}`)
  try {
    const value = await run()
    await tx.query(`RELEASE SAVEPOINT ${name}`)
    return { ok: true, value }
  } catch (err) {
    await tx.query(`ROLLBACK TO SAVEPOINT ${name}`)
    const code = (err as { code?: string }).code
    if (code === '23505' || code === '23503' || code === '42501') return { ok: false, sqlstate: code }
    throw err
  }
}

/* ------------------------------------------------------------------ *
 * §1 · DEALS.
 * ------------------------------------------------------------------ */

/** The wire's `DealRegistrationSummary`. 🛑 No field names a rival — the shape cannot. */
export interface DealRegistrationSummaryRow {
  readonly registrationId: string
  readonly company: string
  readonly shape: string
  readonly registeredAt: Timestamp
  readonly lastActivityAt?: Timestamp
  readonly standing: string
}

export async function readDealRegistrations(
  tx: ScopedClient,
  grant: PartnerAuthorizationGrant,
  standing: string | null,
): Promise<readonly DealRegistrationSummaryRow[]> {
  const rows = (
    await tx.query(
      `SELECT id, company, shape, received_at, last_activity_at, standing
         FROM tenant.deal_registration
        WHERE partner_id = $1
          AND ($2::text IS NULL OR standing = $2::text)
        ORDER BY received_at DESC, id`,
      [grant.partnerId, standing],
    )
  ).rows as Array<Record<string, unknown>>
  return rows.map((r) => ({
    registrationId: String(r['id']),
    company: String(r['company']),
    shape: String(r['shape']),
    registeredAt: iso(r['received_at']),
    ...(r['last_activity_at'] === null ? {} : { lastActivityAt: iso(r['last_activity_at']) }),
    standing: String(r['standing']),
  }))
}

export const DEAL_SUBMISSION_REFUSALS = {
  /** Another claim on the same normalised company already stands — in ANY firm. 422. */
  companyAlreadyClaimed: 'deal_company_already_claimed',
  /** `0322`'s write policy refused the row. Unreachable from a gated act; 500 if it is not. */
  rowRefused: 'deal_row_refused',
} as const
export type DealSubmissionRefusal =
  | DealShapeRefusal
  | (typeof DEAL_SUBMISSION_REFUSALS)[keyof typeof DEAL_SUBMISSION_REFUSALS]

export type DealSubmissionOutcome =
  | { readonly ok: true; readonly receivedAt: Timestamp; readonly standing: string }
  | { readonly ok: false; readonly refusal: DealSubmissionRefusal }

export function mintDealRegistrationId(): DealRegistrationId {
  return `dreg_${randomBytes(16).toString('hex')}` as DealRegistrationId
}

export async function submitDealRegistration(
  tx: ScopedClient,
  grant: PartnerAuthorizationGrant,
  fields: DealRegistrationFields,
): Promise<DealSubmissionOutcome> {
  const shape = checkDealRegistrationShape(fields)
  if (shape !== null) return { ok: false, refusal: shape }

  const out = await guardedInsert(tx, 'deal_registration', async () =>
    (
      await tx.query(
        `INSERT INTO tenant.deal_registration
           (id, partner_id, shape, company,
            annual_value_minor, annual_value_currency, annual_value_exponent,
            expected_close, contact, rationale, resale_scope, submitted_by, received_at, standing)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), $13)
         RETURNING received_at, standing`,
        [
          mintDealRegistrationId(),
          grant.partnerId,
          fields.shape,
          fields.company,
          /* G3561: the codec's three fields. `0322`'s undenominated
             `annual_value` is never written again (`0470` §4). The bigint
             crosses to `pg` as its decimal string — `formatMinorUnits()`,
             the codec's own spelling, never `Number()`. */
          fields.annualValue === undefined ? null : formatMinorUnits(fields.annualValue.amountMinor),
          fields.annualValue?.currency ?? null,
          fields.annualValue?.exponent ?? null,
          fields.expectedClose ?? null,
          fields.contact ?? null,
          fields.rationale ?? null,
          fields.resaleScope === undefined ? null : [...fields.resaleScope],
          grant.subjectUserId,
          DEAL_STANDINGS.waiting,
        ],
      )
    ).rows[0] as { received_at: unknown; standing: unknown },
  )
  if (!out.ok) {
    return {
      ok: false,
      refusal:
        out.sqlstate === '23505'
          ? DEAL_SUBMISSION_REFUSALS.companyAlreadyClaimed
          : DEAL_SUBMISSION_REFUSALS.rowRefused,
    }
  }
  return { ok: true, receivedAt: iso(out.value.received_at), standing: String(out.value.standing) }
}

/* ------------------------------------------------------------------ *
 * §2 · THE SANDBOX.
 * ------------------------------------------------------------------ */

/** The wire's `SandboxView`, minus `monthlyWholesale` — commercial, optional, no column. */
export interface SandboxViewRow {
  readonly standing: string
  /** G3701 — present on the `requested` arm alone: when the firm asked. */
  readonly requestedAt?: Timestamp
  readonly seedVersion?: string
  readonly nextResetAt?: Timestamp
  readonly awsAccountId?: string
  readonly residency?: string
}

/**
 * *"A standing of `none` is a live answer and not a 404."* No sandbox row and
 * no open request is `none`, and no optional field is fabricated for it.
 *
 * ⚠️ IT SAID *"No row — including while a request is open … — is `none`"*
 * UNTIL 4 Oct 2026 (G3701, applying NP-01, THE OWNER'S RULING: *"Report
 * 'requested'"*). An open request is now its own arm, `requested`, carrying
 * the time it was asked and nothing else; a provisioned row still wins, since
 * a live sandbox is the more specific fact. No migration: `0322` already lets
 * a `view_sandbox` act read the firm's request (`partner_sandbox_request_read_rls`).
 */
export async function readSandbox(
  tx: ScopedClient,
  grant: PartnerAuthorizationGrant,
): Promise<SandboxViewRow> {
  const row = (
    await tx.query(
      `SELECT standing, seed_version, next_reset_at, aws_account_id, residency
         FROM tenant.partner_sandbox WHERE partner_id = $1`,
      [grant.partnerId],
    )
  ).rows[0] as Record<string, unknown> | undefined
  if (row === undefined) {
    const asked = (
      await tx.query(
        `SELECT requested_at FROM tenant.partner_sandbox_request WHERE partner_id = $1`,
        [grant.partnerId],
      )
    ).rows[0] as { requested_at: unknown } | undefined
    if (asked === undefined) return { standing: SANDBOX_STANDINGS.none }
    return { standing: SANDBOX_STANDINGS.requested, requestedAt: iso(asked.requested_at) }
  }
  const opt = (k: string, v: unknown): Record<string, string> =>
    v === null || v === undefined ? {} : { [k]: v instanceof Date ? v.toISOString() : String(v) }
  return {
    standing: String(row['standing']),
    ...opt('seedVersion', row['seed_version']),
    ...opt('nextResetAt', row['next_reset_at']),
    ...opt('awsAccountId', row['aws_account_id']),
    ...opt('residency', row['residency']),
  }
}

export const SANDBOX_REQUEST_REFUSALS = {
  /** A sandbox already stands, or one has already been asked for. 409. */
  alreadyStands: 'sandbox_already_stands',
  rowRefused: 'sandbox_row_refused',
} as const
export type SandboxRequestRefusal =
  (typeof SANDBOX_REQUEST_REFUSALS)[keyof typeof SANDBOX_REQUEST_REFUSALS]

export function mintSandboxRequestId(): SandboxRequestId {
  return `sbxr_${randomBytes(16).toString('hex')}` as SandboxRequestId
}

export async function requestSandbox(
  tx: ScopedClient,
  grant: PartnerAuthorizationGrant,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly refusal: SandboxRequestRefusal }> {
  const live = (await readSandbox(tx, grant)).standing === SANDBOX_STANDINGS.live
  if (live) return { ok: false, refusal: SANDBOX_REQUEST_REFUSALS.alreadyStands }
  const out = await guardedInsert(tx, 'sandbox_request', () =>
    tx.query(
      `INSERT INTO tenant.partner_sandbox_request (id, partner_id, requested_by, requested_at)
       VALUES ($1, $2, $3, now())`,
      [mintSandboxRequestId(), grant.partnerId, grant.subjectUserId],
    ),
  )
  if (!out.ok) {
    return {
      ok: false,
      refusal:
        out.sqlstate === '23505'
          ? SANDBOX_REQUEST_REFUSALS.alreadyStands
          : SANDBOX_REQUEST_REFUSALS.rowRefused,
    }
  }
  return { ok: true }
}

/* ------------------------------------------------------------------ *
 * §3 · TRIAL TENANT REQUESTS. ⚠️ Reached by no route (G2639) — see `0322` §4.
 * ------------------------------------------------------------------ */

export const TRIAL_REQUEST_REFUSALS = {
  /** No ACCEPTED registration of this firm by that id. 422. */
  registrationNotAccepted: 'trial_registration_not_accepted',
} as const
export type TrialRequestRefusal = (typeof TRIAL_REQUEST_REFUSALS)[keyof typeof TRIAL_REQUEST_REFUSALS]

export function mintTrialTenantRequestId(): TrialTenantRequestId {
  return `trq_${randomBytes(16).toString('hex')}` as TrialTenantRequestId
}

/**
 * Every refusal is ONE answer — an unknown id, another firm's registration, a
 * `waiting` one — because distinguishing them would tell a partner which
 * registration ids exist beyond its own firm. The FK refuses another firm's id
 * (23503) and the write policy refuses an unaccepted one (42501).
 */
export async function requestTrialTenant(
  tx: ScopedClient,
  grant: PartnerAuthorizationGrant,
  request: { readonly registrationId: string; readonly note?: string },
): Promise<{ readonly ok: true } | { readonly ok: false; readonly refusal: TrialRequestRefusal }> {
  const out = await guardedInsert(tx, 'trial_request', () =>
    tx.query(
      `INSERT INTO tenant.trial_tenant_request
         (id, partner_id, registration_id, note, requested_by, requested_at)
       VALUES ($1, $2, $3, $4, $5, now())`,
      [
        mintTrialTenantRequestId(),
        grant.partnerId,
        request.registrationId,
        request.note ?? null,
        grant.subjectUserId,
      ],
    ),
  )
  if (!out.ok) return { ok: false, refusal: TRIAL_REQUEST_REFUSALS.registrationNotAccepted }
  return { ok: true }
}
