/**
 * C9 · SOURCES, OVER HTTP — the six served endpoint operations. G2871–G2880,
 * 2 Oct 2026.
 *
 *   listEndpoints                GET  /v1/endpoints
 *   declareEndpoint              POST /v1/endpoints
 *   stopEndpoint                 POST /v1/endpoints/{endpointId}/stop
 *   resumeEndpoint               POST /v1/endpoints/{endpointId}/resume
 *   declareEndpointDocumentType  POST /v1/endpoints/{endpointId}/document-types
 *   bindEndpointCredential       PUT  /v1/endpoints/{endpointId}/credential
 *
 * ┌─ 🛑 INVARIANT 1 IS A PROPERTY OF THESE SIGNATURES ─────────────────────────┐
 * │ No function here takes a tenant. `exceptions.ts` and `runs.ts` carry the   │
 * │ argument; this module imports their URL builder and their one request     │
 * │ function rather than writing a third of either (§5.3).                     │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE CREDENTIAL GOES IN AND NOTHING COMES BACK, AND THIS MODULE MAKES THAT
 * A TYPE RATHER THAN A HABIT. `bindCredential()` takes the value as an
 * argument and returns `CredentialBound`, which has no field that could carry
 * it: the contract's 200 is `{endpointId, boundAt, rotated}` with
 * `additionalProperties: false`, and the reader below copies those three
 * properties BY NAME rather than spreading the body, so a plane that one day
 * echoed the value would still not put it into anything a component holds.
 *
 * ⚠️ NO BUNDLER CONSTRAINT, AS `exceptions.ts` STATES IT: every import here is
 * `import type` or another `api/` module, so this file loads in a bare
 * `node --test` process. The field-path parse the pairing form needs is done in
 * the COMPONENT, which is where the one seam (`model/field-path.ts`) is called.
 */

import { call } from './exceptions.ts'
import { planeEndpoint, type Read } from './runs.ts'

/** `capability.openapi.yaml` → `SourceEndpoint.state`. Derived by the plane, never here. */
export type SourceState =
  | 'waiting_on_credential'
  | 'waiting_on_first_delivery'
  | 'delivered'
  | 'stopped'

const SOURCE_STATES: readonly SourceState[] = [
  'waiting_on_credential',
  'waiting_on_first_delivery',
  'delivered',
  'stopped',
]

export interface SftpConnection {
  readonly kind: 'sftp'
  readonly host: string
  readonly port: number
  readonly path: string
  readonly hostKeyFingerprint: string
}

export interface S3Connection {
  readonly kind: 's3'
  readonly bucket: string
  readonly keyPrefix: string
  readonly region: string
  readonly roleArn: string
}

/** What a caller DECLARES. The S3 external id is minted by the plane (G2685), never sent. */
export type ConnectionDeclaration = SftpConnection | S3Connection

/** What the plane PUBLISHES — the declaration, plus the minted external id on S3. */
export type PublishedConnection = SftpConnection | (S3Connection & { readonly externalId: string })

export type MatchKind = 'path_prefix' | 'filename'

export interface SourcePair {
  readonly pairId: string
  readonly match: { readonly kind: MatchKind; readonly value: string }
  readonly documentTypeId: string
  readonly expectedFidelity: string
  readonly mappedFields: number
}

/**
 * `SourceEndpoint`, less ONE required property that is read and deliberately
 * not carried — the arrival timestamp. G2874: `tests/app/indicator-roster.test.ts`
 * §5 fences that identifier out of `frontend/src/` entirely, because the field
 * was once bound to the connection light (G216). The pack's "Last delivery"
 * column is therefore not drawn; `state` still says whether anything arrived.
 */
export interface Source {
  readonly endpointId: string
  readonly label: string
  readonly direction: string
  readonly state: SourceState
  readonly connection: PublishedConnection
  readonly declaredAt: string
  readonly credentialBoundAt: string | null
  readonly stoppedAt: string | null
  readonly documentTypes: readonly SourcePair[]
}

export interface CredentialBound {
  readonly endpointId: string
  readonly boundAt: string
  readonly rotated: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nullableString(body: Record<string, unknown>, key: string, op: string): string | null {
  const v = body[key]
  if (v === null || typeof v === 'string') return v
  throw new Error(`\`${op}\` answered with a \`${key}\` that is neither a string nor null`)
}

/**
 * One `SourceEndpoint`, checked rather than cast. A required property that is
 * absent is REFUSED rather than defaulted: a missing `state` drawn as nothing
 * would read as a source with no problem, and a missing `credentialBoundAt`
 * defaulted to null would tell an administrator who has bound one that they
 * have not — the exact misreading G2688 refused on the wire.
 */
function asSource(body: unknown, op: string): Source {
  if (!isRecord(body)) throw new Error(`\`${op}\` did not answer with a source`)
  for (const key of ['endpointId', 'label', 'direction', 'declaredAt'] as const) {
    if (typeof body[key] !== 'string') throw new Error(`\`${op}\` answered without \`${key}\``)
  }
  const state = body['state']
  if (typeof state !== 'string' || !(SOURCE_STATES as readonly string[]).includes(state)) {
    throw new Error(
      `\`${op}\` answered with a state this client cannot name (${String(state)}). It is ` +
        'refused rather than drawn, because an unknown state rendered as text would be read ' +
        'as one of the four the contract declares.',
    )
  }
  const connection = body['connection']
  if (!isRecord(connection) || (connection['kind'] !== 'sftp' && connection['kind'] !== 's3')) {
    throw new Error(`\`${op}\` answered without a connection of a kind this product records`)
  }
  for (const key of ['credentialBoundAt', 'stoppedAt'] as const) {
    if (!(key in body)) throw new Error(`\`${op}\` answered without \`${key}\`, which is required`)
  }
  if (!Array.isArray(body['documentTypes'])) {
    throw new Error(`\`${op}\` answered without a \`documentTypes\` array`)
  }
  return {
    endpointId: body['endpointId'] as string,
    label: body['label'] as string,
    direction: body['direction'] as string,
    state: state as SourceState,
    connection: connection as unknown as PublishedConnection,
    declaredAt: body['declaredAt'] as string,
    credentialBoundAt: nullableString(body, 'credentialBoundAt', op),
    stoppedAt: nullableString(body, 'stoppedAt', op),
    documentTypes: body['documentTypes'] as readonly SourcePair[],
  }
}

function sourceUrl(origin: string, endpointId: string, tail = ''): URL {
  const url = planeEndpoint(origin, `/endpoints/${encodeURIComponent(endpointId)}`)
  if (tail !== '') url.pathname = `${url.pathname}/${tail}`
  return url
}

export async function fetchSources(o: Read): Promise<readonly Source[]> {
  const body = await call(planeEndpoint(o.origin, '/endpoints'), { method: 'GET' })
  if (!isRecord(body) || !Array.isArray(body['endpoints'])) {
    throw new Error(
      '`listEndpoints` answered without an `endpoints` array. It is `required`, and an ' +
        'absent list defaulted to `[]` would tell an administrator they have declared nothing.',
    )
  }
  return body['endpoints'].map((e) => asSource(e, 'listEndpoints'))
}

export async function declareSource(
  o: Read & { readonly label: string; readonly connection: ConnectionDeclaration },
): Promise<Source> {
  const body = await call(planeEndpoint(o.origin, '/endpoints'), {
    method: 'POST',
    body: { label: o.label, connection: o.connection },
  })
  return asSource(body, 'declareEndpoint')
}

export async function stopSource(o: Read & { readonly endpointId: string }): Promise<Source> {
  return asSource(await call(sourceUrl(o.origin, o.endpointId, 'stop'), { method: 'POST' }), 'stopEndpoint')
}

export async function resumeSource(o: Read & { readonly endpointId: string }): Promise<Source> {
  return asSource(
    await call(sourceUrl(o.origin, o.endpointId, 'resume'), { method: 'POST' }),
    'resumeEndpoint',
  )
}

export async function declarePair(
  o: Read & {
    readonly endpointId: string
    readonly match: { readonly kind: MatchKind; readonly value: string }
    readonly documentTypeId: string
    readonly fieldMappings: readonly { readonly sourceField: string; readonly fieldPathKey: string }[]
  },
): Promise<SourcePair> {
  const body = await call(sourceUrl(o.origin, o.endpointId, 'document-types'), {
    method: 'POST',
    body: { match: o.match, documentTypeId: o.documentTypeId, fieldMappings: o.fieldMappings },
  })
  if (!isRecord(body) || typeof body['pairId'] !== 'string') {
    throw new Error('`declareEndpointDocumentType` did not answer with a pair')
  }
  return body as unknown as SourcePair
}

export async function bindCredential(
  o: Read & { readonly endpointId: string; readonly secretValue: string },
): Promise<CredentialBound> {
  const body = await call(sourceUrl(o.origin, o.endpointId, 'credential'), {
    method: 'PUT',
    body: { secretValue: o.secretValue },
  })
  if (
    !isRecord(body) ||
    typeof body['endpointId'] !== 'string' ||
    typeof body['boundAt'] !== 'string' ||
    typeof body['rotated'] !== 'boolean'
  ) {
    throw new Error('`bindEndpointCredential` did not answer with `{endpointId, boundAt, rotated}`')
  }
  /* BY NAME, NEVER A SPREAD — see the header. */
  return { endpointId: body['endpointId'], boundAt: body['boundAt'], rotated: body['rotated'] }
}

/* ==================================================================== *
 * `listDocumentTypes` — C3-15, G3941–G3943, 4 Oct 2026
 * ==================================================================== */

/** A document type as a person picks it — the pack's own LABEL, never shown as its id. */
export interface DocumentTypeChoice {
  readonly documentTypeId: string
  readonly label: string
  readonly expectedFidelity: string
}

/**
 * Every document type this tenant has. The other reads carry a
 * `documentTypeId`; this is the one place its NAME comes from (G3942).
 *
 * 🛑 AN ENTRY WHOSE `label` IS NOT A STRING IS DROPPED RATHER THAN THE LIST
 * REFUSED: the surfaces that join to it fall back to a neutral word for a type
 * they cannot name (`documentTypeName()`), so one bad entry costs one name and
 * never the whole picker. An absent `documentTypes` array IS refused —
 * defaulting it to `[]` would offer a person nothing to pick and say so falsely.
 */
export async function fetchDocumentTypes(o: Read): Promise<readonly DocumentTypeChoice[]> {
  const body = await call(planeEndpoint(o.origin, '/document-types'), { method: 'GET' })
  if (!isRecord(body) || !Array.isArray(body['documentTypes'])) {
    throw new Error('`listDocumentTypes` answered without a `documentTypes` array, which is required')
  }
  const out: DocumentTypeChoice[] = []
  for (const t of body['documentTypes']) {
    if (!isRecord(t) || typeof t['documentTypeId'] !== 'string') continue
    out.push({
      documentTypeId: t['documentTypeId'],
      label: typeof t['label'] === 'string' ? t['label'] : '',
      expectedFidelity: typeof t['expectedFidelity'] === 'string' ? t['expectedFidelity'] : '',
    })
  }
  return out
}

/**
 * The word a surface shows for a document type: its label, or — when the
 * label is empty, unreadable, or the type is not on the list — a NEUTRAL word.
 *
 * 🛑 NEVER THE ID. C3-15 is precisely an id rendered where a name belongs, and
 * a fallback that printed `dt_…` would reinstate the defect on the one path
 * nobody looks at.
 */
export const UNNAMED_DOCUMENT_TYPE = 'Unnamed document type'

export function documentTypeName(
  types: readonly DocumentTypeChoice[] | null,
  documentTypeId: string,
): string {
  const label = types?.find((t) => t.documentTypeId === documentTypeId)?.label.trim() ?? ''
  return label === '' ? UNNAMED_DOCUMENT_TYPE : label
}

/**
 * U-28 · G4175 — THE ONE THING A PICKER MAY ADD WHEN A LABEL FAILS TO TELL A
 * TYPE APART FROM THE OTHERS: its reference, which is `tenant.document_type`'s
 * primary key and therefore the only published value guaranteed to differ
 * (`key` carries no unique constraint and is not published — G3945).
 *
 * It answers the id when the type's label is EMPTY, or when another type on
 * the list has the same label once case and whitespace are folded (buttons
 * reading "Supplier invoice" and "SUPPLIER  invoice" are the same button to a
 * person). It answers `null` for every other type, so a uniquely-labelled
 * type is still named by its label ALONE.
 *
 * 🛑 THIS AMENDS G3943's *"never the id"* NARROWLY AND SAYS SO: the id is
 * never the NAME — `documentTypeName()` is unchanged and still answers the
 * label or the neutral word — it is a secondary REFERENCE drawn beside the
 * name, and only where the alternative is two identical buttons with a real
 * write behind each, which is a coin flip. Inventing a distinguisher (an
 * ordinal, a guessed suffix) is refused: it would be data this tenant never
 * declared, and an ordinal moves when the list does.
 */
function foldLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function documentTypeReference(
  types: readonly DocumentTypeChoice[] | null,
  documentTypeId: string,
): string | null {
  if (types === null) return null
  const me = types.find((t) => t.documentTypeId === documentTypeId)
  if (me === undefined) return null
  const folded = foldLabel(me.label)
  if (folded === '') return documentTypeId
  const shared = types.some((t) => t.documentTypeId !== documentTypeId && foldLabel(t.label) === folded)
  return shared ? documentTypeId : null
}
