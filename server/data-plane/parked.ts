/**
 * ════════════════════════════════════════════════════════════════════════════
 * C9's PARKED PILE — the pile, one parked artefact's pane, and raising one with
 * the FDE. G2831–G2840, 2 Oct 2026, applying G2692 — THE OWNER'S RULING: *"Yes,
 * both: store an Arrival's filename verbatim, interpreted by nothing (invariant
 * 6 via 0022's precedent); add a `parked` ArrivalVerdict arm."*
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Rows 7, 9, 13, 18 and 19. The DRAIN (row 16) is not here: *"Declaring a pair
 * extracts the documents already parked against it, automatically"*, so it
 * runs inside `declareEndpointDocumentType` (`sources.ts`) and this file only
 * READS what it recorded.
 *
 * G300's THREE PARTS, PER OPERATION, DERIVED RATHER THAN ASSERTED:
 *
 *   TABLE       `tenant.arrival` (`0012` §2 + `0380` §1's `filename`),
 *               `tenant.held_artefact`, `tenant.arrival_drain` and
 *               `tenant.parked_escalation` (`0380` §2, §4, §5).
 *   MODEL       `model/ingestion.ts` §2a — `decideArrival()` is CALLED below,
 *               so the reason a pane gives is the same function's answer that
 *               parked the artefact and that a drain would ask.
 *   CAPABILITY  `view_exception` for the two reads — row 19: *"An user who
 *               cannot act still follows it"*, so the pane cannot be gated on
 *               the admin's verb — and `configure_endpoint` for the raise,
 *               which is a Setup act (row 22).
 *
 * 🛑 INVARIANT 6. THE NAME AND THE KEYS ARE PUBLISHED AS DATA AND NOTHING HERE
 *    READS EITHER. `filename` is returned as the string the source sent, and
 *    the sample's top-level KEYS are returned sorted; no value from a held
 *    artefact is ever published, because no `FieldSpec` addresses a held
 *    artefact and G106 makes every unaddressed value UNREADABLE. The keys are
 *    the record's SHAPE — what a person needs to write a mapping (row 9: *"it
 *    is what the admin declares the pair against"*).
 *
 * 🛑 INVARIANT 1. No body reads a tenant from the request; every SQL statement
 *    carries no tenant predicate and RLS narrows. A `tenantId` on the raise is
 *    a 400 (`additionalProperties: false`).
 *
 * ⚠️ "WHO UNBLOCKS IT" IS A CAPABILITY AND NOT A PERSON (G2840, 🟠). Row 18
 *    says *"with the person who unblocks it named"*. Naming a person means
 *    reading which people hold `configure_endpoint`, and a person-scoped read
 *    of another user is the administrative directory (`0018`, G506/G507),
 *    which keys on a `manage_roles` record this read does not mint. The pane
 *    names the VERB and whether the FDE has been asked.
 */
import type { FastifyReply, FastifyRequest } from 'fastify'

import { CAPABILITIES } from '../../model/access.ts'
import { arrivalFilenameFrom, decideArrival, type DeclaredPair } from '../../model/ingestion.ts'
import type { ScopedClient } from '../../db/tenant-scope.ts'
import { sendProblem } from '../http/app.ts'
import { CODES } from '../http/problem.ts'
import { actingTenantOf, type AuthorisedBody, type AuthorisedOperation } from './authorisation-record.ts'
import { readDeclaredPairs } from './payload-store.ts'
import { randomBytes } from 'node:crypto'

/* ==================================================================== *
 * §1  THE READER — one query, used by the pile AND by the pane, so the line
 *     and the page it links to cannot disagree about one artefact.
 * ==================================================================== */

interface ParkedRow {
  readonly id: string
  readonly filename: string | null
  readonly arrived_at: Date
  readonly endpoint_id: string | null
  readonly label: string | null
  readonly held: boolean
  readonly payload: unknown
  readonly escalated_type: string | null
  readonly raised_at: Date | null
}

const PARKED_SQL = `
SELECT a.id, a.filename, a.arrived_at, c.endpoint_id, e.label,
       (h.arrival_id IS NOT NULL) AS held, h.payload,
       x.document_type_id AS escalated_type, x.raised_at
  FROM tenant.arrival a
  JOIN tenant.intake_channel c   ON c.id = a.channel_id
  LEFT JOIN tenant.endpoint e    ON e.id = c.endpoint_id
  LEFT JOIN tenant.held_artefact h ON h.arrival_id = a.id
  LEFT JOIN tenant.parked_escalation x ON x.arrival_id = a.id
 WHERE a.verdict_kind = 'parked'
   AND NOT EXISTS (SELECT 1 FROM tenant.arrival_drain d WHERE d.arrival_id = a.id)
   AND ($1::text IS NULL OR a.id = $1)
 ORDER BY a.arrived_at, a.id`

/**
 * Why an artefact is STILL parked — the model's derived reason, plus one the
 * model cannot see: `drain_owed`, an artefact that would extract now and has
 * not been drained. The `FOR SHARE` lock in the intake makes it unreachable
 * through this repository's own writers; it is published rather than hidden
 * if it is ever reached.
 */
export type ParkedBecause =
  | 'no_declared_pair_matches'
  | 'more_than_one_pair_matches'
  | 'pair_type_is_not_extractable'
  | 'artefact_does_not_fit_the_mapping'
  | 'drain_owed'

export interface PublishedParked {
  readonly arrivalId: string
  readonly endpointId: string
  readonly endpointLabel: string
  readonly filename: string | null
  readonly arrivedAt: string
  readonly parkedBecause: ParkedBecause
  readonly matchingPairIds: readonly string[]
  readonly escalation: { readonly documentTypeId: string; readonly raisedAt: string } | null
  readonly unblockedBy: { readonly capability: string }
}

interface ReadParked {
  readonly line: PublishedParked
  /** The held record — the pane's sample. Never published whole. */
  readonly held: unknown
}

type ParkedRead =
  | { readonly kind: 'parked'; readonly items: readonly ReadParked[] }
  | { readonly kind: 'unreadable'; readonly arrivalId: string; readonly column: string }

async function readParked(tx: ScopedClient, arrivalId: string | null): Promise<ParkedRead> {
  const rows = (await tx.query(PARKED_SQL, [arrivalId])).rows as unknown as ParkedRow[]
  const pairsOf = new Map<string, readonly DeclaredPair[]>()
  const items: ReadParked[] = []
  for (const row of rows) {
    const bad = (column: string): ParkedRead => ({ kind: 'unreadable', arrivalId: row.id, column })
    /* A parked artefact on a lane with no source, or with no held record, is a
     * row this product did not write: the classifying intake refuses the first
     * and writes the second in the same transaction as the verdict. */
    if (row.endpoint_id === null || row.label === null) return bad('intake_channel.endpoint_id')
    if (!row.held) return bad('held_artefact')
    let pairs = pairsOf.get(row.endpoint_id)
    if (pairs === undefined) {
      const read = await readDeclaredPairs(tx, row.endpoint_id)
      if (!read.ok) return bad('endpoint_document_type')
      pairs = read.pairs
      pairsOf.set(row.endpoint_id, pairs)
    }
    /* THE SAME FUNCTION THAT PARKED IT, ASKED AGAIN. A name that fails the one
     * seam is a name that matches no pair — never a coerced one. */
    const decision = decideArrival(arrivalFilenameFrom(row.filename), row.payload, pairs)
    items.push({
      line: {
        arrivalId: row.id,
        endpointId: row.endpoint_id,
        endpointLabel: row.label,
        filename: row.filename,
        arrivedAt: row.arrived_at.toISOString(),
        parkedBecause: decision.kind === 'park' ? decision.reason : 'drain_owed',
        matchingPairIds: decision.kind === 'park' ? decision.matchingPairIds : [decision.pairId],
        escalation:
          row.escalated_type === null || row.raised_at === null
            ? null
            : { documentTypeId: row.escalated_type, raisedAt: row.raised_at.toISOString() },
        unblockedBy: { capability: CAPABILITIES.configureEndpoint },
      },
      held: row.payload,
    })
  }
  return { kind: 'parked', items }
}

interface DrainRow {
  readonly pair_id: string
  readonly endpoint_id: string
  readonly document_type_id: string
  readonly drained: number
  readonly last_at: Date
}

/** Row 16's *"the register states why rather than leaving an unexplained jump"*. */
const DRAIN_SQL = `
SELECT d.pair_id, p.endpoint_id, d.document_type_id,
       count(*)::int AS drained, max(d.drained_at) AS last_at
  FROM tenant.arrival_drain d
  JOIN tenant.endpoint_document_type p ON p.id = d.pair_id
 GROUP BY d.pair_id, p.endpoint_id, d.document_type_id
 ORDER BY max(d.drained_at), d.pair_id`

function unreadable(reply: FastifyReply, arrivalId: string, column: string): FastifyReply {
  console.error(
    `data-plane: parked arrival \`${arrivalId}\` could not be published — \`${column}\` ` +
      'carries a shape the domain model does not define. Nothing was published.',
  )
  return sendProblem(reply, {
    status: 500,
    code: CODES.upstreamUnavailable,
    title: 'The request could not be completed.',
    detail: 'A stored parked arrival carries a shape the domain model does not define.',
  })
}

function notFound(reply: FastifyReply): FastifyReply {
  return sendProblem(reply, {
    status: 404,
    code: CODES.resourceNotFound,
    title: 'No such parked arrival.',
    detail: 'No parked arrival with that id is visible to this session.',
  })
}

function arrivalIdOf(request: FastifyRequest): string {
  return (request.params as { arrivalId: string }).arrivalId
}

/* ==================================================================== *
 * §2  `listParkedArrivals` — `view_exception`. Rows 7 and 18.
 *
 * Row 18: *"The register names them as awaiting setup … and counted apart from
 * exceptions so the denominator stays honest."* Its own operation, and its own
 * count: nothing here touches `tenant.exception`, so the register's
 * denominator cannot move because something parked.
 * ==================================================================== */

const listParkedBody: AuthorisedBody = async ({ reply, tx }) => {
  const read = await readParked(tx, null)
  if (read.kind === 'unreadable') return unreadable(reply, read.arrivalId, read.column)
  const drains = (await tx.query(DRAIN_SQL)).rows as unknown as DrainRow[]
  const items = read.items.map((i) => i.line)
  return {
    awaitingSetup: {
      parked: items.length,
      /* Row 13: *"the pending pair counted separately"*. */
      raisedWithFde: items.filter((i) => i.escalation !== null).length,
    },
    items,
    drains: drains.map((d) => ({
      pairId: d.pair_id,
      endpointId: d.endpoint_id,
      documentTypeId: d.document_type_id,
      drained: d.drained,
      lastDrainedAt: d.last_at.toISOString(),
      because: 'pair_declared',
    })),
  }
}

/** `resourceId: null` — opening a list. */
export const listParkedArrivalsOperation: AuthorisedOperation = {
  operationId: 'listParkedArrivals',
  resourceType: 'Arrival',
  instanceOf: () => null,
  body: listParkedBody,
}

/* ==================================================================== *
 * §3  `getParkedArrival` — `view_exception`. Rows 9 and 19.
 *
 * Row 19: *"lands on one pane about that pair only — the sample, why it is
 * parked, and who unblocks it. Not a read-only copy of Setup, and never a dead
 * sentence."* An artefact that is no longer parked is a 404 and not a page
 * about a drained document: the line that linked here no longer exists.
 * ==================================================================== */

const getParkedBody: AuthorisedBody = async ({ request, reply, tx }) => {
  const read = await readParked(tx, arrivalIdOf(request))
  if (read.kind === 'unreadable') return unreadable(reply, read.arrivalId, read.column)
  const one = read.items[0]
  if (one === undefined) return notFound(reply)
  const held = one.held
  const isRecord = typeof held === 'object' && held !== null && !Array.isArray(held)
  return {
    ...one.line,
    sample: {
      /* THE SHAPE, NEVER A VALUE (G106). Sorted, so the order carries nothing
       * the source chose. */
      isRecord,
      fields: isRecord ? Object.keys(held).sort() : [],
    },
  }
}

export const getParkedArrivalOperation: AuthorisedOperation = {
  operationId: 'getParkedArrival',
  resourceType: 'Arrival',
  instanceOf: (request) => arrivalIdOf(request),
  body: getParkedBody,
}

/* ==================================================================== *
 * §4  `raiseParkedArrival` — `configure_endpoint`. Row 13.
 *
 * *"A control on this pane, carrying the pack, the type and the sample. The
 * pair stays parked pending."* It carries the SAMPLE (the arrival) and the
 * TYPE, and NOT the pack — `tenant.document_type` has no pack column (G2839).
 * The artefact stays parked; a raise extracts nothing and changes no verdict.
 * Raising the same artefact twice answers the first raise (200), never a
 * second row (`0380` §5's `UNIQUE`).
 * ==================================================================== */

interface RaiseBody {
  readonly documentTypeId: string
}

const raiseBody: AuthorisedBody = async ({ request, reply, tx, grant }) => {
  const arrivalId = arrivalIdOf(request)
  const { documentTypeId } = request.body as RaiseBody

  const read = await readParked(tx, arrivalId)
  if (read.kind === 'unreadable') return unreadable(reply, read.arrivalId, read.column)
  const one = read.items[0]
  if (one === undefined) return notFound(reply)

  if (one.line.escalation !== null) {
    reply.code(200)
    return { arrivalId, ...one.line.escalation }
  }

  const type = await tx.query('SELECT id FROM tenant.document_type WHERE id = $1', [documentTypeId])
  if (type.rows.length === 0) {
    return sendProblem(reply, {
      status: 422,
      code: CODES.documentTypeUnknown,
      title: 'No such document type in this tenant.',
    })
  }

  const inserted = await tx.query(
    `INSERT INTO tenant.parked_escalation
       (tenant_id, id, arrival_id, document_type_id, raised_at, authorization_id)
     VALUES ($1, $2, $3, $4, now(), $5)
     RETURNING raised_at`,
    [actingTenantOf(grant), `pex_${randomBytes(16).toString('hex')}`, arrivalId, documentTypeId, grant.id],
  )
  const raisedAt = (inserted.rows[0] as { raised_at: Date }).raised_at
  reply.code(201)
  return { arrivalId, documentTypeId, raisedAt: raisedAt.toISOString() }
}

export const raiseParkedArrivalOperation: AuthorisedOperation = {
  operationId: 'raiseParkedArrival',
  resourceType: 'Arrival',
  instanceOf: (request) => arrivalIdOf(request),
  body: raiseBody,
}
