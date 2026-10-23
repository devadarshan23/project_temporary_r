/**
 * THE DEMO INTAKE, FROM THE BROWSER'S SIDE — `/demo`'s one write. G3071–G3074,
 * 2 Oct 2026.
 *
 * Three things live here and nothing else: the closed field set the intake
 * accepts (READ FROM `infra/lib/config.ts`, never restated), where the request
 * goes (same-origin `DEMO_INTAKE_PATH`), and the ONE answer that counts as
 * accepted.
 *
 * 🛑 THE FIELD SET IS IMPORTED, NOT COPIED. `infra/lambda/demo-intake/guards.mjs`
 * REFUSES an unknown field (`intake_unknown_field`) rather than ignoring it, so a
 * form that sent `phone` or `slot` would be refused on every submission — and the
 * CDK copy, `DEMO_INTAKE_FIELDS`, is the one a `tsc` run checks and
 * `tests/infra/demo-intake.test.mjs` mirrors against the Lambda's in both
 * directions. A third hand-written list here would be the copy that drifts.
 * `infra/lib/config.ts` declares no imports (`grep -c '^import'` → 0), which is
 * the property `frontend/vite.config.ts` already relies on, so nothing of CDK
 * reaches the bundle.
 *
 * 🛑 G2001 — THE INTAKE ANSWERS THE SAME `202 {"status":"received"}` FOR EVERY
 * BODY IT ACCEPTS, whatever the referral code and whether or not the CRM took
 * the lead. So `accepted` here means *the intake took the request* and NOTHING
 * MORE: not that a referral code matched (nothing evaluates one — the match is
 * the STAFF CONSOLE's, later), and not that a person has read it. The screen
 * that renders this union is written to that, and no arm of it carries a
 * verdict about the code, because there is none to carry.
 *
 * ⚠️ SAME-ORIGIN, AND THE HOST DECIDES WHETHER ANYTHING ANSWERS — G3071.
 * `DEMO_INTAKE_PATH` is routed at the apex `reconcileai.app` ONLY, by the
 * Amplify app's 200-rewrite (`infra/lib/amplify-stack.ts`). This bundle is
 * served by the `Edge` distributions on tenant and console hosts, which have no
 * behaviour for `/demo/*`, and a cross-origin POST to the apex is refused BY
 * DESIGN — G2002 deliberately configures no CORS, and `application/json` forces
 * a preflight that absence then fails. So from every host that serves this
 * bundle today the intake is UNREACHABLE, and the honest answer is
 * `not_delivered`, never a success. **What counts as accepted is therefore the
 * intake's EXACT answer and nothing that merely looks like a 2xx**: a host that
 * falls back to `index.html` answers a 200 with HTML, and reading that as
 * "received" is the fake success this file exists to refuse.
 *
 * ✅ **AND THE GAP IS CLOSED WHERE THE PAGE IS SERVED — G3151, 2 Oct 2026, THE
 * OWNER'S RULING.** The paragraph above is corrected rather than deleted: it
 * was true of the APPLICATION bundle that carried this file (`frontend/src/api/`)
 * and that bundle no longer renders `/demo` — it redirects to the apex. This
 * file now lives in the apex site, served by the same Amplify app that carries
 * the `/demo/intake` rewrite, so the POST is same-origin with the route that
 * answers it. **What counts as accepted is unchanged**, and so is why: the
 * response is the authority on reachability, never the host the page believes
 * it is on.
 */

import {
  DEMO_INTAKE_CONTENT_TYPE,
  DEMO_INTAKE_FIELD_MAX_LENGTH,
  DEMO_INTAKE_FIELDS,
  DEMO_INTAKE_PATH,
  APEX_HOST,
  type DemoIntakeField,
} from '../../../../infra/lib/config.ts'

export { DEMO_INTAKE_FIELD_MAX_LENGTH, DEMO_INTAKE_PATH }
export type { DemoIntakeField }

/** What the form sends: a subset of the closed set, every value a string. */
export type DemoIntake = Partial<Readonly<Record<DemoIntakeField, string>>>

export type IntakeOutcome =
  /** The intake's exact answer arrived. It says the request was TAKEN — no more. */
  | { readonly kind: 'accepted' }
  /** Anything else: a refusal, a host with no route for it, or no answer at all. */
  | { readonly kind: 'not_delivered'; readonly status: number }

/**
 * Whether THIS host is the one the intake is routed at.
 *
 * It decides only whether the screen STATES the gap before a submission; it does
 * not decide whether the request is sent. The response is the authority on
 * reachability, and a host check is a guess about a deployment.
 */
export function intakeRoutedAt(hostname: string): boolean {
  return hostname.toLowerCase() === APEX_HOST
}

/** Drop empties and refuse anything outside the closed set or over its cap. */
export function intakeBody(fields: DemoIntake): Readonly<Record<string, string>> | null {
  const out: Record<string, string> = {}
  for (const field of DEMO_INTAKE_FIELDS) {
    const raw = fields[field]
    if (raw === undefined) continue
    const value = raw.trim()
    if (value === '') continue
    if (value.length > DEMO_INTAKE_FIELD_MAX_LENGTH[field]) return null
    out[field] = value
  }
  return Object.keys(out).length === 0 ? null : out
}

async function isTheAcceptedAnswer(res: Response): Promise<boolean> {
  if (res.status !== 202) return false
  const type = res.headers.get('content-type') ?? ''
  if (!type.toLowerCase().startsWith('application/json')) return false
  try {
    const body = (await res.json()) as unknown
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
    const keys = Object.keys(body)
    return keys.length === 1 && (body as { status?: unknown }).status === 'received'
  } catch {
    return false
  }
}

export async function sendDemoIntake(
  fields: DemoIntake,
  doFetch: typeof fetch = fetch,
): Promise<IntakeOutcome> {
  const body = intakeBody(fields)
  if (body === null) return { kind: 'not_delivered', status: 0 }
  let res: Response
  try {
    res = await doFetch(DEMO_INTAKE_PATH, {
      method: 'POST',
      /* No cookie belongs on a lead. The intake reads none, and a session
         cookie riding a marketing write is a credential sent where nothing
         needs it. */
      credentials: 'omit',
      headers: { 'content-type': DEMO_INTAKE_CONTENT_TYPE, accept: 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return { kind: 'not_delivered', status: 0 }
  }
  return (await isTheAcceptedAnswer(res))
    ? { kind: 'accepted' }
    : { kind: 'not_delivered', status: res.status }
}
