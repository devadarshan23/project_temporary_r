/**
 * THE PARTNER PORTAL'S CLIENT — the six P1 operations the data plane serves on
 * the partner host (`docs/contracts/administration.openapi.yaml`, tag
 * `P Partner Portal`). G3293, 3 Oct 2026.
 *
 *   listDealRegistrations   GET  /v1/partner/registrations
 *   submitDealRegistration  POST /v1/partner/registrations   → 202, a request
 *   getSandboxTenant        GET  /v1/partner/sandbox
 *   requestSandboxTenant    POST /v1/partner/sandbox         → 202, no body
 *   listPartnerPeople       GET  /v1/partner/people
 *   invitePartnerPerson     POST /v1/partner/invitations     → 201
 *
 * 🛑 NO PARTNER, NO TENANT AND NO PERSON IS EVER SENT. The firm is the
 * session's (the plane reads it off the partner role assignment the session's
 * person holds) — invariant 1's rule applied to the partner arm. Every body
 * below is the contract's request schema and nothing else, and the contract
 * closes each with `additionalProperties: false`, which the plane REJECTS
 * rather than strips (G191).
 *
 * 🛑 THE CHECKS REFUSE; THEY NEVER REPAIR — `exceptions.ts`'s rule. A body
 * missing a `required` key is an error, never an empty list, because an empty
 * registry reads as "you have claimed nothing" and that is a claim.
 *
 * ⚠️ A REFUSAL CARRIES THE STATUS AND THE CLOSED CODE ONLY (`PlaneRefused`).
 * The plane's `detail` never reaches a screen — `errors.yaml` requires it to
 * carry no customer-authored string, and the collision refusal in particular
 * must never be made to say whose claim stands.
 */

import { call } from './exceptions.ts'
import { planeEndpoint } from './runs.ts'
import type { DealShape } from '../../../model/partner-portal.ts'
import { parseMinorUnits, toMoneyWire, type MoneyWire } from '../../../model/money.ts'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(r: Record<string, unknown>, key: string, op: string): string {
  const v = r[key]
  if (typeof v !== 'string') throw new Error(`\`${op}\` answered without its required \`${key}\``)
  return v
}

function optStr(r: Record<string, unknown>, key: string): string | null {
  const v = r[key]
  return typeof v === 'string' ? v : null
}

/* ── DEALS ─────────────────────────────────────────────────────────────── */

/** `DealRegistrationSummary`. 🛑 No field names a rival — the schema has none. */
export interface DealRegistration {
  readonly registrationId: string
  readonly company: string
  readonly shape: string
  readonly registeredAt: string
  readonly lastActivityAt: string | null
  readonly standing: string
}

export async function fetchDealRegistrations(origin: string): Promise<readonly DealRegistration[]> {
  const op = 'listDealRegistrations'
  const body = await call(planeEndpoint(origin, '/partner/registrations'), { method: 'GET' })
  if (!isRecord(body) || !Array.isArray(body['registrations'])) {
    throw new Error(`\`${op}\` answered without its required \`registrations\` array`)
  }
  return body['registrations'].map((row: unknown): DealRegistration => {
    if (!isRecord(row)) throw new Error(`\`${op}\` answered a registration that is not an object`)
    return {
      registrationId: str(row, 'registrationId', op),
      company: str(row, 'company', op),
      shape: str(row, 'shape', op),
      registeredAt: str(row, 'registeredAt', op),
      lastActivityAt: optStr(row, 'lastActivityAt'),
      standing: str(row, 'standing', op),
    }
  })
}

/**
 * `DealRegistrationRequest` — TWO SHAPES, DISCRIMINATED, as the contract and
 * P1 draw them. A deal carries a value and a close date; a customer claim a
 * rationale and a resale scope. A union rather than an optional-everything
 * record, so a deal with a rationale is unrepresentable here as well as
 * refused there.
 */
export type DealRegistrationRequest =
  | {
      readonly shape: Extract<DealShape, 'deal'>
      readonly company: string
      /** `DealValue` — the codec's `MoneyWire`, with its currency (G3561). */
      readonly annualValue: MoneyWire
      readonly expectedClose: string
      readonly contact?: string
    }
  | {
      readonly shape: Extract<DealShape, 'customer_claim'>
      readonly company: string
      readonly rationale: string
      readonly resaleScope: readonly string[]
    }

/** `DealRegistrationReceipt` — RECEIVED, and not registered. */
export interface DealRegistrationReceipt {
  readonly receivedAt: string
  readonly standing: string
}

export async function submitDealRegistration(
  origin: string,
  request: DealRegistrationRequest,
): Promise<DealRegistrationReceipt> {
  const op = 'submitDealRegistration'
  const body = await call(planeEndpoint(origin, '/partner/registrations'), { method: 'POST', body: request })
  if (!isRecord(body)) throw new Error(`\`${op}\` did not answer with a receipt`)
  return { receivedAt: str(body, 'receivedAt', op), standing: str(body, 'standing', op) }
}

/**
 * THE CURRENCY A DEAL DEFAULTS TO — G3561, THE OWNER'S RULING (3 Oct 2026):
 * *"the form defaults to SGD and shows it."* `P1`: *"Deal value, SGD a year"*.
 * A default the person can see and change, never one supplied silently.
 */
export const DEAL_CURRENCY_DEFAULT = 'SGD'

/**
 * Minor units per major unit for a STATED currency, as a power of ten — read
 * from the browser's own ISO 4217 data (`Intl`), never from a table typed
 * here. `null` for anything that is not three upper-case letters, or that
 * `Intl` refuses. (2 for SGD, 0 for JPY.)
 */
export function exponentOf(currency: string): number | null {
  if (!/^[A-Z]{3}$/.test(currency)) return null
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? null
  } catch {
    return null
  }
}

/**
 * A typed deal value, as `DealValue` — THROUGH THE MONEY CODEC (G111, G3561).
 * A person types `180,000`; grouping commas and spaces are dropped, the major
 * decimal is shifted to MINOR units by string arithmetic (never through a
 * float), and `parseMinorUnits()` / `toMoneyWire()` — the codec's own two
 * boundaries — decide whether it is money. `null` refuses: not a decimal, more
 * fraction digits than the currency has, zero, or out of the codec's range.
 */
export function dealValueOf(typed: string, currency: string): MoneyWire | null {
  const exponent = exponentOf(currency)
  if (exponent === null) return null
  const m = /^([0-9]+)(?:\.([0-9]+))?$/.exec(typed.replace(/[,\s]/g, ''))
  if (m === null) return null
  const whole = m[1] ?? ''
  const frac = m[2] ?? ''
  if (frac.length > exponent) return null
  const minor = parseMinorUnits(whole + frac.padEnd(exponent, '0'))
  if (!minor.ok || minor.value <= 0n) return null
  const wire = toMoneyWire({ currency, amountMinor: minor.value, exponent })
  return wire.ok ? wire.value : null
}

/* ── THE SANDBOX ───────────────────────────────────────────────────────── */

/** `SandboxView` — lifecycle only, no document ledger, no open URL (G270). */
export interface SandboxView {
  readonly standing: string
  /** G3701 — when the firm asked; on the `requested` standing alone. */
  readonly requestedAt: string | null
  readonly seedVersion: string | null
  readonly nextResetAt: string | null
  readonly awsAccountId: string | null
  readonly residency: string | null
}

export async function fetchSandbox(origin: string): Promise<SandboxView> {
  const op = 'getSandboxTenant'
  const body = await call(planeEndpoint(origin, '/partner/sandbox'), { method: 'GET' })
  if (!isRecord(body)) throw new Error(`\`${op}\` did not answer with a sandbox`)
  return {
    standing: str(body, 'standing', op),
    requestedAt: optStr(body, 'requestedAt'),
    seedVersion: optStr(body, 'seedVersion'),
    nextResetAt: optStr(body, 'nextResetAt'),
    awsAccountId: optStr(body, 'awsAccountId'),
    residency: optStr(body, 'residency'),
  }
}

/** 202 with no body: requested, and a person provisions it. */
export async function requestSandbox(origin: string): Promise<void> {
  await call(planeEndpoint(origin, '/partner/sandbox'), { method: 'POST' })
}

/* ── PEOPLE ────────────────────────────────────────────────────────────── */

/** `PartnerPerson`. */
export interface PartnerPerson {
  readonly name: string
  readonly email: string
  readonly role: string
  readonly reaches: string | null
  readonly state: string
}

/** `InvitedPartnerPerson` — an offer, not a person: no name until redemption. */
export interface PartnerInvitation {
  readonly email: string
  readonly role: string
  readonly state: string
}

export interface PartnerRoster {
  readonly people: readonly PartnerPerson[]
  readonly invitations: readonly PartnerInvitation[]
}

export async function fetchPartnerPeople(origin: string): Promise<PartnerRoster> {
  const op = 'listPartnerPeople'
  const body = await call(planeEndpoint(origin, '/partner/people'), { method: 'GET' })
  if (!isRecord(body) || !Array.isArray(body['people']) || !Array.isArray(body['invitations'])) {
    throw new Error(`\`${op}\` answered without its required \`people\` and \`invitations\` arrays`)
  }
  return {
    people: body['people'].map((p: unknown): PartnerPerson => {
      if (!isRecord(p)) throw new Error(`\`${op}\` answered a person that is not an object`)
      return {
        name: str(p, 'name', op),
        email: str(p, 'email', op),
        role: str(p, 'role', op),
        reaches: optStr(p, 'reaches'),
        state: str(p, 'state', op),
      }
    }),
    invitations: body['invitations'].map((i: unknown): PartnerInvitation => {
      if (!isRecord(i)) throw new Error(`\`${op}\` answered an invitation that is not an object`)
      return { email: str(i, 'email', op), role: str(i, 'role', op), state: str(i, 'state', op) }
    }),
  }
}

/** The two invitable roles — `PartnerInvitationRequest.role`'s closed enum. */
export const INVITABLE_ROLES = ['partner_administrator', 'partner_user'] as const
export type InvitableRole = (typeof INVITABLE_ROLES)[number]

export async function invitePartnerPerson(
  origin: string,
  request: { readonly email: string; readonly role: InvitableRole },
): Promise<PartnerInvitation> {
  const op = 'invitePartnerPerson'
  const body = await call(planeEndpoint(origin, '/partner/invitations'), { method: 'POST', body: request })
  if (!isRecord(body)) throw new Error(`\`${op}\` did not answer with an invitation`)
  return { email: str(body, 'email', op), role: str(body, 'role', op), state: str(body, 'state', op) }
}

/* ── SIGN-OUT ──────────────────────────────────────────────────────────── */

/**
 * `signOut` — `DELETE /session` on THIS host, which revokes the row the cookie
 * names. Same-origin by construction (no plane origin): the cookie is bound to
 * the host that issued it (G180), and the session tier is routed on every
 * console host (`EDGE_CONSOLE_PLANE_PATH_PATTERNS`).
 */
export async function signOutHere(): Promise<void> {
  try {
    await fetch('/session', { method: 'DELETE', credentials: 'same-origin', headers: { accept: 'application/json' } })
  } catch {
    /* A plane that is not answering holds no session this tab could revoke;
       the sign-in page is still the honest next place. */
  }
}
