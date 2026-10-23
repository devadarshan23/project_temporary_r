/**
 * ════════════════════════════════════════════════════════════════════════════
 * C9's SOURCES — declare one, list them, stop and resume one, pair a pattern
 * within one with a document type. G2681–G2692, 1 Oct 2026, DERIVED AND NOT
 * THE OWNER'S. `bindEndpointCredential` (G2401, `credential-binding.ts`) is
 * the custody half and is untouched by this file.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * G300's THREE PARTS, PER OPERATION, DERIVED RATHER THAN ASSERTED:
 *
 *   TABLE       `tenant.endpoint` (`0270` + `0340` §1), `tenant.endpoint_sftp`
 *               and `tenant.endpoint_s3` (`0340` §2), `tenant.intake_channel`
 *               (`0012` + `0340` §3's writer), `tenant.endpoint_stop_event`
 *               (`0340` §4), `tenant.endpoint_document_type` and
 *               `tenant.endpoint_field_mapping` (`0341`).
 *   MODEL       `model/connectors.ts` §2–§4 — `validateSourceDeclaration()`,
 *               `sourceState()`, `checkSourcePair()` — each CALLED below and
 *               not merely imported for its vocabulary.
 *   CAPABILITY  `view_endpoint` for the read and `configure_endpoint` for the
 *               four acts — both class `endpoint`, both seeded on
 *               `tenant_admin`, and `configure_endpoint` is the verb
 *               `CONNECTOR_PARAMETER_ENFORCEMENT` already names for every
 *               connection parameter but the credential.
 *
 * Every body runs inside `authorisedHandler()`'s transaction, whose
 * authorisation record (invariant 10) is written BEFORE the body runs; the
 * three acts that write also pin that record's id onto the row they write.
 *
 * 🛑 INVARIANT 1. No body reads a tenant from the request. Every request body
 *    is `additionalProperties: false`; a `tenantId` is a 400. The tenant
 *    written onto a new row is `actingTenantOf(grant)` — the act's own record
 *    — and the policy compares it against `app.tenant_id` regardless.
 *
 * ⚠️ NO SQL HERE CARRIES A TENANT PREDICATE, and that is the convention every
 *    store keeps: RLS narrows, so a handler-written `WHERE tenant_id = …`
 *    would make `tests/http/sources-served.test.ts`'s negative control assert
 *    nothing.
 */
import { randomBytes } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'

import {
  SOURCE_CONNECTION_CHANNEL,
  SOURCE_CONNECTION_KINDS,
  SOURCE_MATCH_KINDS,
  checkSourcePair,
  sourceState,
  validateSourceDeclaration,
  type SourceConnection,
  type SourceConnectionKind,
  type SourceMatchKind,
} from '../../model/connectors.ts'
import { ACQUISITION_FIDELITY, ENDPOINT_DIRECTIONS } from '../../model/domain.ts'
import type { ScopedClient } from '../../db/tenant-scope.ts'
import { sendProblem } from '../http/app.ts'
import { CODES } from '../http/problem.ts'
import { actingTenantOf, type AuthorisedBody, type AuthorisedOperation } from './authorisation-record.ts'
import { drainParkedAgainstPair } from './payload-store.ts'

/* ==================================================================== *
 * §1  THE READER — one query set, used by the list AND by every act's answer,
 *     so a 201 and a 200 for the same source cannot disagree.
 * ==================================================================== */

interface EndpointRow {
  readonly id: string
  readonly label: string
  readonly direction: string
  readonly connection_kind: string
  readonly declared_at: Date
  readonly credential_bound_at: Date | null
  readonly host: string | null
  readonly port: number | null
  readonly path: string | null
  readonly host_key_fingerprint: string | null
  readonly bucket: string | null
  readonly key_prefix: string | null
  readonly region: string | null
  readonly role_arn: string | null
  readonly external_id: string | null
  readonly lane_count: number
  readonly lane_enabled: boolean | null
  readonly last_arrival_at: Date | null
  readonly last_event_kind: string | null
  readonly last_event_at: Date | null
}

const ENDPOINT_SQL = `
SELECT e.id, e.label, e.direction, e.connection_kind, e.declared_at, e.credential_bound_at,
       s.host, s.port, s.path, s.host_key_fingerprint,
       b.bucket, b.key_prefix, b.region, b.role_arn, b.external_id,
       lane.lane_count, lane.lane_enabled, lane.last_arrival_at,
       ev.kind AS last_event_kind, ev.at AS last_event_at
  FROM tenant.endpoint e
  LEFT JOIN tenant.endpoint_sftp s ON s.endpoint_id = e.id
  LEFT JOIN tenant.endpoint_s3   b ON b.endpoint_id = e.id
  LEFT JOIN LATERAL (
    SELECT count(DISTINCT c.id)::int AS lane_count,
           bool_and(c.enabled)       AS lane_enabled,
           max(a.arrived_at)         AS last_arrival_at
      FROM tenant.intake_channel c
      LEFT JOIN tenant.arrival a ON a.channel_id = c.id
     WHERE c.endpoint_id = e.id
  ) lane ON true
  LEFT JOIN LATERAL (
    SELECT x.kind, x.at FROM tenant.endpoint_stop_event x
     WHERE x.endpoint_id = e.id
     ORDER BY x.at DESC, x.id DESC
     LIMIT 1
  ) ev ON true
 WHERE ($1::text IS NULL OR e.id = $1)
 ORDER BY e.declared_at, e.id`

interface PairRow {
  readonly id: string
  readonly endpoint_id: string
  readonly match_kind: string
  readonly match_value: string
  readonly document_type_id: string
  readonly expected_fidelity: string
  readonly mapped: number
}

const PAIR_SQL = `
SELECT p.id, p.endpoint_id, p.match_kind, p.match_value, p.document_type_id,
       t.expected_fidelity,
       (SELECT count(*)::int FROM tenant.endpoint_field_mapping m WHERE m.pair_id = p.id) AS mapped
  FROM tenant.endpoint_document_type p
  JOIN tenant.document_type t ON t.id = p.document_type_id
 WHERE ($1::text IS NULL OR p.endpoint_id = $1)
 ORDER BY p.declared_at, p.id`

export interface PublishedPair {
  readonly pairId: string
  readonly match: { readonly kind: SourceMatchKind; readonly value: string }
  readonly documentTypeId: string
  readonly expectedFidelity: string
  readonly mappedFields: number
}

export interface PublishedEndpoint {
  readonly endpointId: string
  readonly label: string
  readonly direction: string
  readonly state: string
  readonly connection: Record<string, string | number>
  readonly declaredAt: string
  readonly credentialBoundAt: string | null
  readonly lastArrivalAt: string | null
  readonly stoppedAt: string | null
  readonly documentTypes: readonly PublishedPair[]
}

/** Which row, which column, and why it could not be published. Never a value. */
export interface SourceDefect {
  readonly endpointId: string
  readonly column: string
}

export type SourcesRead =
  | { readonly kind: 'sources'; readonly endpoints: readonly PublishedEndpoint[] }
  | { readonly kind: 'unreadable'; readonly defect: SourceDefect }

const DIRECTIONS: readonly string[] = Object.values(ENDPOINT_DIRECTIONS)
const CONNECTION_KINDS: readonly string[] = Object.values(SOURCE_CONNECTION_KINDS)
const MATCH_KINDS: readonly string[] = Object.values(SOURCE_MATCH_KINDS)
const FIDELITIES: readonly string[] = Object.values(ACQUISITION_FIDELITY)

function iso(value: Date | null): string | null {
  return value === null ? null : value.toISOString()
}

/**
 * The connection, narrowed BY COLUMN. A row whose kind's table has no row, or
 * whose OTHER kind's table has one, is unreadable — `0340` §2's composite key
 * makes the second impossible, and checking it anyway costs one comparison.
 */
type ConnectionRead =
  | { readonly ok: true; readonly connection: Record<string, string | number> }
  | { readonly ok: false; readonly column: string }

function connectionOf(row: EndpointRow): ConnectionRead {
  const defect = (column: string): ConnectionRead => ({ ok: false, column })
  if (row.connection_kind === 'sftp') {
    if (row.bucket !== null) return defect('endpoint_s3')
    if (row.host === null || row.port === null || row.path === null || row.host_key_fingerprint === null) {
      return defect('endpoint_sftp')
    }
    return {
      ok: true,
      connection: {
        kind: 'sftp',
        host: row.host,
        port: row.port,
        path: row.path,
        hostKeyFingerprint: row.host_key_fingerprint,
      },
    }
  }
  if (row.host !== null) return defect('endpoint_sftp')
  if (
    row.bucket === null ||
    row.key_prefix === null ||
    row.region === null ||
    row.role_arn === null ||
    row.external_id === null
  ) {
    return defect('endpoint_s3')
  }
  return {
    ok: true,
    connection: {
      kind: 's3',
      bucket: row.bucket,
      keyPrefix: row.key_prefix,
      region: row.region,
      roleArn: row.role_arn,
      externalId: row.external_id,
    },
  }
}

/**
 * Every declared source visible to this transaction, or one of them.
 *
 * 🛑 THE LANE AND THE STOP HISTORY MUST AGREE, OR NOTHING IS PUBLISHED (G2684).
 *    The lane's switch is the stop that is ENFORCED — `guardChannelLive()`
 *    refuses every arrival on a disabled lane — and the newest event is when
 *    it began. A disabled lane whose newest event is not a `stopped`, or an
 *    enabled lane whose newest event is one, is a source reported one way
 *    and behaving the other, and publishing either half would be a guess.
 */
export async function readSources(tx: ScopedClient, endpointId: string | null): Promise<SourcesRead> {
  const endpoints = (await tx.query(ENDPOINT_SQL, [endpointId])).rows as unknown as EndpointRow[]
  const pairs = (await tx.query(PAIR_SQL, [endpointId])).rows as unknown as PairRow[]

  const pairsOf = new Map<string, PublishedPair[]>()
  for (const p of pairs) {
    if (!MATCH_KINDS.includes(p.match_kind)) {
      return { kind: 'unreadable', defect: { endpointId: p.endpoint_id, column: 'match_kind' } }
    }
    if (!FIDELITIES.includes(p.expected_fidelity)) {
      return { kind: 'unreadable', defect: { endpointId: p.endpoint_id, column: 'expected_fidelity' } }
    }
    const list = pairsOf.get(p.endpoint_id) ?? []
    list.push({
      pairId: p.id,
      match: { kind: p.match_kind as SourceMatchKind, value: p.match_value },
      documentTypeId: p.document_type_id,
      expectedFidelity: p.expected_fidelity,
      mappedFields: p.mapped,
    })
    pairsOf.set(p.endpoint_id, list)
  }

  const out: PublishedEndpoint[] = []
  for (const row of endpoints) {
    const defect = (column: string): SourcesRead => ({
      kind: 'unreadable',
      defect: { endpointId: row.id, column },
    })
    if (!DIRECTIONS.includes(row.direction)) return defect('direction')
    if (!CONNECTION_KINDS.includes(row.connection_kind)) return defect('connection_kind')
    const connection = connectionOf(row)
    if (!connection.ok) return defect(connection.column)
    /* EXACTLY ONE LANE. `declareEndpoint` opens one in the same transaction;
     * zero or two is a row this product did not write. */
    if (row.lane_count !== 1 || row.lane_enabled === null) return defect('intake_channel')
    const lastEvent = row.last_event_kind
    if (lastEvent !== null && lastEvent !== 'stopped' && lastEvent !== 'resumed') {
      return defect('endpoint_stop_event.kind')
    }
    const stoppedByHistory = lastEvent === 'stopped'
    if (stoppedByHistory === row.lane_enabled) return defect('intake_channel.enabled')

    out.push({
      endpointId: row.id,
      label: row.label,
      direction: row.direction,
      state: sourceState({
        enabled: row.lane_enabled,
        credentialBound: row.credential_bound_at !== null,
        hasArrived: row.last_arrival_at !== null,
      }),
      connection: connection.connection,
      declaredAt: row.declared_at.toISOString(),
      credentialBoundAt: iso(row.credential_bound_at),
      lastArrivalAt: iso(row.last_arrival_at),
      stoppedAt: stoppedByHistory ? iso(row.last_event_at) : null,
      documentTypes: pairsOf.get(row.id) ?? [],
    })
  }
  return { kind: 'sources', endpoints: out }
}

function unreadable(reply: FastifyReply, defect: SourceDefect): FastifyReply {
  console.error(
    `data-plane: source \`${defect.endpointId}\` could not be published — \`${defect.column}\` ` +
      'carries a value or a shape the domain model does not define. Nothing was published.',
  )
  return sendProblem(reply, {
    status: 500,
    code: CODES.upstreamUnavailable,
    title: 'The request could not be completed.',
    detail: 'A stored source carries a value the domain model does not define.',
  })
}

function notFound(reply: FastifyReply): FastifyReply {
  return sendProblem(reply, {
    status: 404,
    code: CODES.resourceNotFound,
    title: 'No such source.',
    detail: 'No such source is visible to this session.',
  })
}

/** 16 random bytes behind a prefix. NEVER derived from a tenant or a value. */
function mint(prefix: string): string {
  return `${prefix}_${randomBytes(16).toString('hex')}`
}

function endpointIdOf(request: FastifyRequest): string {
  return (request.params as { endpointId: string }).endpointId
}

/** Read back ONE source after an act, in the act's own transaction. */
async function answerOne(
  tx: ScopedClient,
  reply: FastifyReply,
  endpointId: string,
  status: number,
): Promise<unknown> {
  const read = await readSources(tx, endpointId)
  if (read.kind === 'unreadable') return unreadable(reply, read.defect)
  const one = read.endpoints[0]
  if (one === undefined) return notFound(reply)
  reply.code(status)
  return one
}

/* ==================================================================== *
 * §2  `listEndpoints` — `view_endpoint`
 * ==================================================================== */

const listEndpointsBody: AuthorisedBody = async ({ reply, tx }) => {
  const read = await readSources(tx, null)
  if (read.kind === 'unreadable') return unreadable(reply, read.defect)
  return { endpoints: read.endpoints }
}

/** `resourceId: null` — *"opening a list"*, `listIntakeChannels`'s case. */
export const listEndpointsOperation: AuthorisedOperation = {
  operationId: 'listEndpoints',
  resourceType: 'Endpoint',
  instanceOf: () => null,
  body: listEndpointsBody,
}

/* ==================================================================== *
 * §3  `declareEndpoint` — `configure_endpoint`
 * ==================================================================== */

interface DeclareBody {
  readonly label: string
  readonly connection: SourceConnection
}

const declareEndpointBody: AuthorisedBody = async ({ request, reply, tx, grant }) => {
  const { label, connection } = request.body as DeclareBody

  const refusal = validateSourceDeclaration(label, connection)
  if (refusal !== null) {
    return sendProblem(reply, {
      status: 422,
      code: CODES.validationFailed,
      title: 'That source cannot be declared.',
      detail: `refusal: ${refusal.kind}`,
    })
  }

  const tenantId = actingTenantOf(grant)
  const endpointId = mint('end')
  const kind: SourceConnectionKind = connection.kind

  /* 🛑 SEVEN COLUMNS, AND NOT THE THREE BINDING ONES — `0340` §6 grants no
   * more, so a declaration carrying a credential reference is refused by the
   * database even if this statement were edited to write one. */
  await tx.query(
    `INSERT INTO tenant.endpoint
       (tenant_id, id, label, direction, connection_kind, declared_at, declared_authorization_id)
     VALUES ($1, $2, $3, 'inbound', $4, now(), $5)`,
    [tenantId, endpointId, label, kind, grant.id],
  )

  switch (connection.kind) {
    case 'sftp':
      await tx.query(
        `INSERT INTO tenant.endpoint_sftp
           (tenant_id, endpoint_id, host, port, path, host_key_fingerprint)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          tenantId,
          endpointId,
          connection.host.toLowerCase(),
          connection.port,
          connection.path,
          connection.hostKeyFingerprint,
        ],
      )
      break
    case 's3':
      await tx.query(
        `INSERT INTO tenant.endpoint_s3
           (tenant_id, endpoint_id, bucket, key_prefix, region, role_arn, external_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          tenantId,
          endpointId,
          connection.bucket,
          connection.keyPrefix,
          connection.region,
          connection.roleArn,
          /* G2685 — minted, never supplied. */
          `ext_${randomBytes(16).toString('hex')}`,
        ],
      )
      break
  }

  /* The lane, in the same transaction (`0340` §3). Its kind is read out of a
   * TOTAL record, so a third connection kind must answer which lane it is. */
  await tx.query(
    `INSERT INTO tenant.intake_channel (tenant_id, id, kind, endpoint_id, enabled)
     VALUES ($1, $2, $3, $4, true)`,
    [tenantId, mint('ich'), SOURCE_CONNECTION_CHANNEL[kind], endpointId],
  )

  return answerOne(tx, reply, endpointId, 201)
}

/**
 * `resourceId: null` — the source does not exist until the transaction this
 * record opened mints it. `admitRun`'s case, argued there at length.
 */
export const declareEndpointOperation: AuthorisedOperation = {
  operationId: 'declareEndpoint',
  resourceType: 'Endpoint',
  instanceOf: () => null,
  body: declareEndpointBody,
}

/* ==================================================================== *
 * §4  `stopEndpoint` / `resumeEndpoint` — `configure_endpoint`
 * ==================================================================== */

/**
 * One body, two directions. The endpoint row is LOCKED first, so two
 * concurrent stops serialise and the second sees the first's lane — which is
 * what makes "stopping a stopped source is a no-op" true under concurrency
 * rather than only in sequence.
 *
 * ⚠️ `FOR UPDATE` needs an `UPDATE` privilege on SOME column, and `0270`'s
 *    column-level grant on the binding columns is it. Nothing here writes them.
 */
function switchBody(to: 'stopped' | 'resumed'): AuthorisedBody {
  return async ({ request, reply, tx, grant }) => {
    const endpointId = endpointIdOf(request)
    const locked = await tx.query('SELECT id FROM tenant.endpoint WHERE id = $1 FOR UPDATE', [
      endpointId,
    ])
    if (locked.rows.length === 0) return notFound(reply)

    const lane = await tx.query(
      'SELECT enabled FROM tenant.intake_channel WHERE endpoint_id = $1',
      [endpointId],
    )
    const lanes = lane.rows as Array<{ enabled?: unknown }>
    const only = lanes[0]
    if (lanes.length !== 1 || only === undefined || typeof only.enabled !== 'boolean') {
      return unreadable(reply, { endpointId, column: 'intake_channel' })
    }

    const wantEnabled = to === 'resumed'
    if (only.enabled !== wantEnabled) {
      await tx.query('UPDATE tenant.intake_channel SET enabled = $2 WHERE endpoint_id = $1', [
        endpointId,
        wantEnabled,
      ])
      await tx.query(
        `INSERT INTO tenant.endpoint_stop_event (tenant_id, id, endpoint_id, kind, at, authorization_id)
         VALUES ($1, $2, $3, $4, now(), $5)`,
        [actingTenantOf(grant), mint('ese'), endpointId, to, grant.id],
      )
    }
    return answerOne(tx, reply, endpointId, 200)
  }
}

export const stopEndpointOperation: AuthorisedOperation = {
  operationId: 'stopEndpoint',
  resourceType: 'Endpoint',
  instanceOf: (request) => endpointIdOf(request),
  body: switchBody('stopped'),
}

export const resumeEndpointOperation: AuthorisedOperation = {
  operationId: 'resumeEndpoint',
  resourceType: 'Endpoint',
  instanceOf: (request) => endpointIdOf(request),
  body: switchBody('resumed'),
}

/* ==================================================================== *
 * §5  `declareEndpointDocumentType` — `configure_endpoint`
 * ==================================================================== */

interface PairBody {
  readonly match: { readonly kind: SourceMatchKind; readonly value: string }
  readonly documentTypeId: string
  readonly fieldMappings: ReadonlyArray<{ readonly sourceField: string; readonly fieldPathKey: string }>
}

const declareEndpointDocumentTypeBody: AuthorisedBody = async ({ request, reply, tx, grant }) => {
  const endpointId = endpointIdOf(request)
  const body = request.body as PairBody

  /* Locked, so two pairs declared at once on one source serialise and the
   * duplicate-pattern check below cannot race. */
  const locked = await tx.query('SELECT id FROM tenant.endpoint WHERE id = $1 FOR UPDATE', [
    endpointId,
  ])
  if (locked.rows.length === 0) return notFound(reply)

  const type = await tx.query('SELECT id FROM tenant.document_type WHERE id = $1', [
    body.documentTypeId,
  ])
  if (type.rows.length === 0) {
    return sendProblem(reply, {
      status: 422,
      code: CODES.documentTypeUnknown,
      title: 'No such document type in this tenant.',
    })
  }

  const specs = await tx.query(
    'SELECT path_key FROM tenant.document_field_spec WHERE document_type_id = $1',
    [body.documentTypeId],
  )
  const declared = (specs.rows as Array<{ path_key: string }>).map((r) => r.path_key)

  const refusal = checkSourcePair(body.match, declared, body.fieldMappings)
  if (refusal !== null) {
    return sendProblem(reply, {
      status: 422,
      code: CODES.validationFailed,
      title: 'That pair cannot be declared.',
      detail: `refusal: ${refusal.kind}`,
    })
  }

  const taken = await tx.query(
    `SELECT 1 FROM tenant.endpoint_document_type
      WHERE endpoint_id = $1 AND match_kind = $2 AND match_value = $3`,
    [endpointId, body.match.kind, body.match.value],
  )
  if (taken.rows.length > 0) {
    return sendProblem(reply, {
      status: 422,
      code: CODES.validationFailed,
      title: 'That pattern already names a document type on this source.',
      detail: 'refusal: pattern_already_paired',
    })
  }

  const tenantId = actingTenantOf(grant)
  const pairId = mint('edt')
  /* A SAVEPOINT, because a body's 4xx COMMITS (`authorisedHandler()`: the
   * record of an authorised act that found nothing is still a record), and the
   * drain below can refuse AFTER the pair is written. Rolling back to here
   * leaves the act's record and no pair. */
  await tx.query('SAVEPOINT declare_pair')
  await tx.query(
    `INSERT INTO tenant.endpoint_document_type
       (tenant_id, id, endpoint_id, match_kind, match_value, document_type_id,
        declared_at, declared_authorization_id)
     VALUES ($1, $2, $3, $4, $5, $6, now(), $7)`,
    [tenantId, pairId, endpointId, body.match.kind, body.match.value, body.documentTypeId, grant.id],
  )
  for (const m of body.fieldMappings) {
    await tx.query(
      `INSERT INTO tenant.endpoint_field_mapping
         (tenant_id, pair_id, document_type_id, path_key, source_field)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, pairId, body.documentTypeId, m.fieldPathKey, m.sourceField],
    )
  }

  /* ROW 16 — THE DRAIN, IN THE SAME TRANSACTION AND UNDER THE SAME RECORD.
   * *"Declaring a pair extracts the documents already parked against it,
   * automatically, so the first period can close."* G2835. */
  const drain = await drainParkedAgainstPair(tx, {
    endpointId,
    pairId,
    authorizationId: grant.id,
    now: new Date().toISOString(),
    mintDocumentId: () => mint('sdo'),
  })
  switch (drain.kind) {
    case 'drained':
      break
    case 'subject_not_digestible':
      /* G295: a subject this plane cannot register may not be stored, so the
       * pair that would store it cannot be declared while the artefact is
       * parked against it. Named by the ARRIVAL and the declared key — never
       * by the value. */
      await tx.query('ROLLBACK TO SAVEPOINT declare_pair')
      return sendProblem(reply, {
        status: 422,
        code: CODES.validationFailed,
        title: 'That pair would drain an artefact whose subject cannot be registered.',
        detail: `refusal: parked_artefact_subject_not_digestible (${drain.arrivalId})`,
      })
    case 'unscoped':
    case 'pair_unreadable':
    case 'declaration_unreadable':
      await tx.query('ROLLBACK TO SAVEPOINT declare_pair')
      return unreadable(reply, { endpointId, column: 'endpoint_document_type' })
  }

  const read = await readSources(tx, endpointId)
  if (read.kind === 'unreadable') return unreadable(reply, read.defect)
  const pair = read.endpoints[0]?.documentTypes.find((p) => p.pairId === pairId)
  if (pair === undefined) return unreadable(reply, { endpointId, column: 'endpoint_document_type' })
  reply.code(201)
  return { ...pair, drain: { drained: drain.drained, stillParked: drain.stillParked } }
}

/** Bound to the SOURCE: the pair is minted inside this act. */
export const declareEndpointDocumentTypeOperation: AuthorisedOperation = {
  operationId: 'declareEndpointDocumentType',
  resourceType: 'Endpoint',
  instanceOf: (request) => endpointIdOf(request),
  body: declareEndpointDocumentTypeBody,
}
