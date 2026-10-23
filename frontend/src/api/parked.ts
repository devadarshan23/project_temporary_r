/**
 * C9 · THE PARKED PILE, OVER HTTP — the three served parked-arrival operations.
 * feat/ui-parked-pile, G3501–G3510, 3 Oct 2026 (rows 18 and 19).
 *
 *   listParkedArrivals   GET  /v1/parked                          view_exception
 *   getParkedArrival     GET  /v1/parked/{arrivalId}              view_exception
 *   raiseParkedArrival   POST /v1/parked/{arrivalId}/escalation   configure_endpoint
 *
 * ┌─ 🛑 INVARIANT 1 IS A PROPERTY OF THESE SIGNATURES ─────────────────────────┐
 * │ No function here takes a tenant. The URL builder and the one request       │
 * │ function are IMPORTED from `runs.ts` and `exceptions.ts` (§5.3), so the    │
 * │ `redirect: 'error'` and `credentials: 'same-origin'` rules hold here too.  │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 G106 — THE SAMPLE'S KEYS AND NEVER A VALUE. The plane publishes a held
 * artefact's top-level KEYS and nothing else (`ParkedArrivalPane.sample` is
 * `{isRecord, fields}`, `additionalProperties: false`). This reader copies
 * those two properties BY NAME rather than spreading the body, so a plane that
 * one day published a value beside them would still not put it into anything a
 * component holds — `bindCredential()`'s rule in `sources.ts`, applied to the
 * other thing this product must never show.
 *
 * 🛑 INVARIANT 6 — `filename` AND THE KEYS ARE COUNTERPARTY TEXT. They are
 * carried as strings and rendered as React text children, never markup, never
 * an `href`, never a `style`. Nothing here parses either.
 *
 * ⚠️ THE CHECKS REFUSE; THEY NEVER REPAIR (`exceptions.ts`'s rule). An unknown
 * `parkedBecause` is refused rather than drawn: a reason this client cannot
 * name, rendered as a sentence-cased token, would read as an explanation.
 */

import { call } from './exceptions.ts'
import { planeEndpoint, type Read } from './runs.ts'

/** `capability.openapi.yaml` → `ParkedArrival.parkedBecause`. Derived by the plane, never here. */
export const PARKED_BECAUSE = [
  'no_declared_pair_matches',
  'more_than_one_pair_matches',
  'pair_type_is_not_extractable',
  'artefact_does_not_fit_the_mapping',
  'drain_owed',
] as const
export type ParkedBecause = (typeof PARKED_BECAUSE)[number]

export interface ParkedEscalation {
  readonly documentTypeId: string
  readonly raisedAt: string
}

/** One parked delivery, as the register's line names it. */
export interface ParkedLine {
  readonly arrivalId: string
  readonly endpointId: string
  readonly endpointLabel: string
  /** The source's own name, verbatim — data, never markup. `null`: none was recorded. */
  readonly filename: string | null
  readonly arrivedAt: string
  readonly parkedBecause: ParkedBecause
  readonly matchingPairIds: readonly string[]
  readonly escalation: ParkedEscalation | null
  /** A CAPABILITY, never a person — naming a person is the administrative directory (G2840). */
  readonly unblockedBy: { readonly capability: string }
}

/** Row 16 — what a pair's declaration extracted from the pile, so the register says why. */
export interface ParkedDrain {
  readonly pairId: string
  readonly endpointId: string
  readonly documentTypeId: string
  readonly drained: number
  readonly lastDrainedAt: string
}

export interface ParkedPile {
  /** Row 18 — counted APART from exceptions. Row 13 — raised ones counted separately. */
  readonly awaitingSetup: { readonly parked: number; readonly raisedWithFde: number }
  readonly items: readonly ParkedLine[]
  readonly drains: readonly ParkedDrain[]
}

/** Row 9 — the sample's SHAPE. `fields` are the record's top-level keys, sorted. */
export interface ParkedSample {
  readonly isRecord: boolean
  readonly fields: readonly string[]
}

export interface ParkedPane extends ParkedLine {
  readonly sample: ParkedSample
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringsOf(value: unknown, what: string): readonly string[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
    throw new Error(`${what} is not a list of strings`)
  }
  return value as readonly string[]
}

function escalationOf(value: unknown, op: string): ParkedEscalation | null {
  if (value === null) return null
  if (!isRecord(value) || typeof value['documentTypeId'] !== 'string' || typeof value['raisedAt'] !== 'string') {
    throw new Error(`\`${op}\` answered with an escalation that is neither null nor {documentTypeId, raisedAt}`)
  }
  return { documentTypeId: value['documentTypeId'], raisedAt: value['raisedAt'] }
}

/**
 * One `ParkedArrival`, checked rather than cast, and COPIED BY NAME. Every
 * property is `required` on the wire; an absent one is refused, never
 * defaulted — a missing `escalation` defaulted to `null` would tell an
 * administrator the FDE had not been asked when they had.
 */
export function asParkedLine(body: unknown, op: string): ParkedLine {
  if (!isRecord(body)) throw new Error(`\`${op}\` did not answer with a parked arrival`)
  for (const key of ['arrivalId', 'endpointId', 'endpointLabel', 'arrivedAt'] as const) {
    if (typeof body[key] !== 'string') throw new Error(`\`${op}\` answered without \`${key}\``)
  }
  if (!('filename' in body) || (body['filename'] !== null && typeof body['filename'] !== 'string')) {
    throw new Error(`\`${op}\` answered without \`filename\`, which is required (a string or null)`)
  }
  const because = body['parkedBecause']
  if (typeof because !== 'string' || !(PARKED_BECAUSE as readonly string[]).includes(because)) {
    throw new Error(
      `\`${op}\` answered with a reason this client cannot name (${String(because)}). It is refused ` +
        'rather than drawn, because an unknown reason rendered as text would read as an explanation.',
    )
  }
  if (!('escalation' in body)) throw new Error(`\`${op}\` answered without \`escalation\`, which is required`)
  const unblocked = body['unblockedBy']
  if (!isRecord(unblocked) || typeof unblocked['capability'] !== 'string') {
    throw new Error(`\`${op}\` answered without \`unblockedBy.capability\``)
  }
  return {
    arrivalId: body['arrivalId'] as string,
    endpointId: body['endpointId'] as string,
    endpointLabel: body['endpointLabel'] as string,
    filename: body['filename'] as string | null,
    arrivedAt: body['arrivedAt'] as string,
    parkedBecause: because as ParkedBecause,
    matchingPairIds: stringsOf(body['matchingPairIds'], `\`${op}\`'s \`matchingPairIds\``),
    escalation: escalationOf(body['escalation'], op),
    unblockedBy: { capability: unblocked['capability'] },
  }
}

export function asParkedPile(body: unknown): ParkedPile {
  const op = 'listParkedArrivals'
  if (!isRecord(body)) throw new Error(`\`${op}\` did not answer with a pile`)
  const awaiting = body['awaitingSetup']
  if (!isRecord(awaiting) || typeof awaiting['parked'] !== 'number' || typeof awaiting['raisedWithFde'] !== 'number') {
    throw new Error(
      `\`${op}\` answered without \`awaitingSetup\`. It is required, and a count defaulted to 0 ` +
        'would tell a reader nothing is waiting on setup.',
    )
  }
  if (!Array.isArray(body['items'])) throw new Error(`\`${op}\` answered without an \`items\` array`)
  if (!Array.isArray(body['drains'])) throw new Error(`\`${op}\` answered without a \`drains\` array`)
  const drains = body['drains'].map((d): ParkedDrain => {
    if (
      !isRecord(d) ||
      typeof d['pairId'] !== 'string' ||
      typeof d['endpointId'] !== 'string' ||
      typeof d['documentTypeId'] !== 'string' ||
      typeof d['drained'] !== 'number' ||
      typeof d['lastDrainedAt'] !== 'string'
    ) {
      throw new Error(`\`${op}\` answered with a drain this client cannot read`)
    }
    return {
      pairId: d['pairId'],
      endpointId: d['endpointId'],
      documentTypeId: d['documentTypeId'],
      drained: d['drained'],
      lastDrainedAt: d['lastDrainedAt'],
    }
  })
  return {
    awaitingSetup: { parked: awaiting['parked'], raisedWithFde: awaiting['raisedWithFde'] },
    items: body['items'].map((i) => asParkedLine(i, op)),
    drains,
  }
}

/**
 * One `ParkedArrivalPane`. 🛑 THE SAMPLE IS COPIED AS TWO NAMED PROPERTIES —
 * `isRecord` and `fields` — and nothing else from it survives this function.
 */
export function asParkedPane(body: unknown): ParkedPane {
  const op = 'getParkedArrival'
  const line = asParkedLine(body, op)
  const sample = isRecord(body) ? body['sample'] : undefined
  if (!isRecord(sample) || typeof sample['isRecord'] !== 'boolean') {
    throw new Error(`\`${op}\` answered without a \`sample\`, which is required`)
  }
  return {
    ...line,
    sample: { isRecord: sample['isRecord'], fields: stringsOf(sample['fields'], `\`${op}\`'s \`sample.fields\``) },
  }
}

function parkedUrl(origin: string, arrivalId: string | null, tail = ''): URL {
  const url = planeEndpoint(origin, arrivalId === null ? '/parked' : `/parked/${encodeURIComponent(arrivalId)}`)
  if (tail !== '') url.pathname = `${url.pathname}/${tail}`
  return url
}

export async function fetchParkedPile(o: Read): Promise<ParkedPile> {
  return asParkedPile(await call(parkedUrl(o.origin, null), { method: 'GET' }))
}

export async function fetchParkedPane(o: Read & { readonly arrivalId: string }): Promise<ParkedPane> {
  return asParkedPane(await call(parkedUrl(o.origin, o.arrivalId), { method: 'GET' }))
}

/**
 * Raise a parked delivery with the FDE, carrying the sample and the type (row
 * 13). The delivery STAYS PARKED. A second raise answers the first (200).
 */
export async function raiseParked(
  o: Read & { readonly arrivalId: string; readonly documentTypeId: string },
): Promise<ParkedEscalation> {
  const body = await call(parkedUrl(o.origin, o.arrivalId, 'escalation'), {
    method: 'POST',
    body: { documentTypeId: o.documentTypeId },
  })
  if (!isRecord(body) || typeof body['documentTypeId'] !== 'string' || typeof body['raisedAt'] !== 'string') {
    throw new Error('`raiseParkedArrival` did not answer with `{arrivalId, documentTypeId, raisedAt}`')
  }
  /* BY NAME, NEVER A SPREAD. */
  return { documentTypeId: body['documentTypeId'], raisedAt: body['raisedAt'] }
}

/*
 * ⛔ `mayRaiseParked()` AND `raiseProbeAnswer()` ARE DELETED — G3781, 4 Oct 2026.
 * They POSTed `raiseParkedArrival` with an EMPTY body and read the gate's
 * answer off the status (403 = refused, 400 = permitted and the validator
 * refused), because `getSessionPrincipal` published no capabilities (G3504,
 * G3505). It publishes them now (G3521; an owner's ruling, G3664), so the
 * probe was a SECOND way of asking the gate the same question — §5.3 — and one
 * that put a refused POST in the access log for every pane a clerk opened.
 * The raise is drawn on `useHolds(DRAW_GATES.raiseParked)`; the 403 a real
 * raise can still meet is the backstop (`ParkedPile.tsx`).
 */
