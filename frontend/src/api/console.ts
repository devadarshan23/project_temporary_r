/**
 * THE STAFF CONSOLE'S CLIENT — `S1 Staff.dc.html`'s H1 and H2, bound to the
 * four operations the data plane serves to a platform principal on the console
 * host (G3322, 3 Oct 2026). Derive the set, never read it:
 * `node tools/served-set.mjs` — `listTenants` on `platform-console`, and
 * `listOnboardingSteps`, `completeOnboardingStep`, `forceOnboardingStep` on
 * `administration`.
 *
 * 🛑 NO TENANT IS SENT FROM HERE AS A SCOPE. A console session is TENANT-LESS
 * (G726); the tenant in a `/staff/tenants/{tenantId}/…` path is the SUBJECT of
 * the act — which delivery record — and the plane gates it on the caller's
 * platform role (`view_substrate`, R8), never on the path.
 *
 * ⚠️ THE CHECKS REFUSE AND NEVER REPAIR, for `exceptions.ts`'s reason: an
 * absent `tenants` array defaulted to `[]` would draw an empty tenancy for a
 * fleet that has tenants.
 */
import { call } from './exceptions.ts'
import { planeEndpoint, type Read } from './runs.ts'

export interface TenantSummary {
  readonly tenantId: string
  readonly name: string
  readonly soldVia?: string
  readonly deploymentMode: string
  readonly residency: string
  /** `onboarding` or `live` — DERIVED by the plane from the stored step count. */
  readonly stage: string
  readonly stageNote?: string
  readonly plan?: string
  readonly supportAccessMode: string
}

export const STEP_STATES = ['blocked', 'next', 'done', 'done_forced'] as const
export type StepState = (typeof STEP_STATES)[number]
export const WHOSE_HANDS = ['ours', 'theirs', 'both'] as const
export type WhoseHands = (typeof WHOSE_HANDS)[number]

export interface OnboardingStep {
  readonly stepKey: string
  readonly title: string
  readonly state: StepState
  readonly whoseHands: WhoseHands
  readonly forcedReason?: string
}

/** The plane's own floor on a forced step's reason — `ForceStepRequest.reason.minLength`. */
export const MIN_FORCE_REASON = 7

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asTenant(v: unknown): TenantSummary {
  if (
    !isRecord(v) ||
    typeof v['tenantId'] !== 'string' ||
    typeof v['name'] !== 'string' ||
    typeof v['deploymentMode'] !== 'string' ||
    typeof v['residency'] !== 'string' ||
    typeof v['stage'] !== 'string' ||
    typeof v['supportAccessMode'] !== 'string'
  ) {
    throw new Error('`listTenants` answered a row that is not a `TenantSummary`')
  }
  return v as unknown as TenantSummary
}

function asStep(v: unknown, where: string): OnboardingStep {
  if (
    !isRecord(v) ||
    typeof v['stepKey'] !== 'string' ||
    typeof v['title'] !== 'string' ||
    !(STEP_STATES as readonly unknown[]).includes(v['state']) ||
    !(WHOSE_HANDS as readonly unknown[]).includes(v['whoseHands'])
  ) {
    throw new Error(`${where} answered a step that is not an \`OnboardingStep\``)
  }
  return v as unknown as OnboardingStep
}

function asSteps(body: unknown, where: string): readonly OnboardingStep[] {
  if (!isRecord(body) || !Array.isArray(body['steps'])) {
    throw new Error(`${where} answered without a \`steps\` array`)
  }
  return body['steps'].map((s) => asStep(s, where))
}

function onboardingPath(tenantId: string): string {
  return `/staff/tenants/${encodeURIComponent(tenantId)}/onboarding`
}

export async function fetchTenants(o: Read): Promise<readonly TenantSummary[]> {
  const body = await call(planeEndpoint(o.origin, '/staff/tenants'), { method: 'GET' })
  if (!isRecord(body) || !Array.isArray(body['tenants'])) {
    throw new Error('`listTenants` answered without a `tenants` array')
  }
  return body['tenants'].map(asTenant)
}

export async function fetchOnboarding(
  o: Read & { readonly tenantId: string },
): Promise<readonly OnboardingStep[]> {
  const body = await call(planeEndpoint(o.origin, onboardingPath(o.tenantId)), { method: 'GET' })
  return asSteps(body, '`listOnboardingSteps`')
}

/** Mark the `next` step done. The plane answers the one step it wrote. */
export async function completeStep(
  o: Read & { readonly tenantId: string; readonly stepKey: string },
): Promise<OnboardingStep> {
  const url = planeEndpoint(
    o.origin,
    `${onboardingPath(o.tenantId)}/${encodeURIComponent(o.stepKey)}/completion`,
  )
  return asStep(await call(url, { method: 'POST' }), '`completeOnboardingStep`')
}

/** Force a blocked step, with the reason that travels with it for the life of the record. */
export async function forceStep(
  o: Read & { readonly tenantId: string; readonly stepKey: string; readonly reason: string },
): Promise<readonly OnboardingStep[]> {
  const url = planeEndpoint(
    o.origin,
    `${onboardingPath(o.tenantId)}/${encodeURIComponent(o.stepKey)}/override`,
  )
  return asSteps(await call(url, { method: 'POST', body: { reason: o.reason } }), '`forceOnboardingStep`')
}

/** End this browser's session on this host — `signOut`, `DELETE /session`. */
export async function signOutHere(): Promise<void> {
  try {
    await fetch('/session', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    })
  } catch {
    /* A plane that is not answering holds no session this tab can revoke; the
       sign-in page is still the honest next place. */
  }
}
