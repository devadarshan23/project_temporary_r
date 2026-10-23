/**
 * THE DATA PLANE'S ONE CLIENT FOR THE CONTROL PLANE'S INTERNAL OPERATIONS.
 * G4301, G4304, G4305, G4310.
 *
 * THE OWNER'S RULINGS, 5 Oct 2026: *"…put onboarding writes and roster reads
 * behind signed control-plane endpoints…"* and *"SigV4 task role": the
 * data-plane task role signs internal requests; the control plane verifies.*
 * The first ruling also PERMITS this call as request-path egress — R2 and
 * G2151 scoped to this ONE internal edge, and to no other destination.
 *
 * 🛑 THIS IS THE THIRD FILE IN `server/data-plane/` THAT REACHES THE NETWORK,
 * AND `tests/http/console-roster-unreachable.test.ts` §1c NAMES IT RATHER THAN
 * LOOSENING. It reaches exactly two destinations, both from configuration and
 * neither from a request: the control plane's internal ALB
 * (`RECONCILE_INTERNAL_CONTROL_PLANE_URL`), and — deployed — the ECS container
 * credentials endpoint that hands the task its role credentials
 * (`AWS_CONTAINER_CREDENTIALS_RELATIVE_URI`, a link-local address ECS sets).
 *
 * THE SIGNER IS CHOSEN ONCE, AT BOOT, AND THE CHOICE IS STRUCTURAL:
 *   · flag `RECONCILE_LOCAL_TEST_AUTH` exactly `1` → the local internal token,
 *     by DYNAMIC import (G192's fence; `server/dev/internal-token.ts`);
 *   · otherwise → SigV4 over `sts:GetCallerIdentity` with the task role's
 *     credentials (`server/http/internal-request.ts` says why that request).
 * A test may pass its own client to `startDataPlane()` as an ARGUMENT.
 *
 * ⚠️ AN UNCONFIGURED CLIENT IS NOT A PERMISSIVE ONE: with no URL every call
 * THROWS, and the caller answers 500 `upstream_unavailable` — the console act
 * has already been recorded, which is the SAFE direction G1426 names.
 */

import {
  INTERNAL_HEADERS,
  STS_AUDIENCE_HEADER,
  STS_BODY,
  STS_CONTENT_TYPE,
  STS_DIGEST_HEADER,
  bodySha256,
  internalRequestDigest,
} from '../http/internal-request.ts'
import { amzDateOf, signV4, type AwsCredentials } from './sigv4.ts'

export interface InternalCall {
  /** The invariant 10 record the data plane minted for the act this serves. */
  readonly authorisationId: string
  /** Fresh per act; a retry of the SAME act re-sends the SAME key. */
  readonly idempotencyKey: string
}

export interface InternalReply {
  readonly status: number
  readonly body: unknown
}

export interface ControlPlaneClient {
  /** False only for the unconfigured client — every call on it throws. */
  readonly configured: boolean
  get(path: string, call: InternalCall): Promise<InternalReply>
  post(path: string, body: unknown, call: InternalCall): Promise<InternalReply>
}

/** Given the request digest, the headers that prove who sent it. */
export type InternalSigner = (digest: string) => Promise<Readonly<Record<string, string>>>

export function controlPlaneClient(opts: {
  readonly baseUrl: string
  readonly signer: InternalSigner
  readonly fetchImpl?: typeof fetch
}): ControlPlaneClient {
  /* Named `fetch` so the egress census (`console-roster-unreachable` §1c) sees the call. */
  const fetch = opts.fetchImpl ?? globalThis.fetch
  const base = opts.baseUrl.replace(/\/+$/, '')
  async function send(method: 'GET' | 'POST', path: string, body: unknown, call: InternalCall): Promise<InternalReply> {
    const contentSha256 = bodySha256(body)
    const digest = internalRequestDigest({
      method,
      path,
      idempotencyKey: call.idempotencyKey,
      authorisationId: call.authorisationId,
      contentSha256,
    })
    const headers: Record<string, string> = {
      ...(await opts.signer(digest)),
      [INTERNAL_HEADERS.contentSha256]: contentSha256,
      [INTERNAL_HEADERS.idempotencyKey]: call.idempotencyKey,
      [INTERNAL_HEADERS.authorisationId]: call.authorisationId,
      accept: 'application/json',
    }
    if (body !== undefined) headers['content-type'] = 'application/json'
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(5_000),
      redirect: 'error',
    })
    const text = await res.text()
    let parsed: unknown = null
    try {
      parsed = text === '' ? null : JSON.parse(text)
    } catch {
      parsed = null
    }
    return { status: res.status, body: parsed }
  }
  return {
    configured: true,
    get: (path, call) => send('GET', path, undefined, call),
    post: (path, body, call) => send('POST', path, body, call),
  }
}

/** The deployed signer: SigV4 over `sts:GetCallerIdentity`, binding the digest. */
export function stsSigner(opts: {
  readonly region: string
  readonly audience: string
  readonly credentials: () => Promise<AwsCredentials>
  readonly now?: () => Date
}): InternalSigner {
  return async (digest) => {
    const credentials = await opts.credentials()
    const signed = signV4({
      request: {
        method: 'POST',
        host: `sts.${opts.region}.amazonaws.com`,
        path: '/',
        query: '',
        headers: {
          'content-type': STS_CONTENT_TYPE,
          [STS_AUDIENCE_HEADER]: opts.audience,
          [STS_DIGEST_HEADER]: digest,
        },
        body: STS_BODY,
      },
      credentials,
      region: opts.region,
      service: 'sts',
      amzDate: amzDateOf((opts.now ?? (() => new Date()))()),
    })
    const out: Record<string, string> = {
      [INTERNAL_HEADERS.stsAuthorization]: signed.authorization,
      [INTERNAL_HEADERS.stsDate]: String(signed.headers['x-amz-date']),
    }
    if (credentials.sessionToken !== undefined) out[INTERNAL_HEADERS.stsSecurityToken] = credentials.sessionToken
    return out
  }
}

/**
 * The task role's credentials, cached until five minutes before they expire.
 * ECS sets `AWS_CONTAINER_CREDENTIALS_RELATIVE_URI`; outside ECS the standard
 * `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_SESSION_TOKEN` are read.
 */
export function taskRoleCredentials(fetchImpl: typeof globalThis.fetch = globalThis.fetch): () => Promise<AwsCredentials> {
  const fetch = fetchImpl
  let cached: { creds: AwsCredentials; expiresAt: number } | null = null
  return async () => {
    if (cached !== null && cached.expiresAt - Date.now() > 5 * 60_000) return cached.creds
    const relative = process.env['AWS_CONTAINER_CREDENTIALS_RELATIVE_URI']
    if (relative !== undefined && relative !== '') {
      const res = await fetch(`http://169.254.170.2${relative}`, { signal: AbortSignal.timeout(2_000) })
      if (res.status !== 200) throw new Error(`the container credentials endpoint answered ${res.status}`)
      const j = (await res.json()) as Record<string, unknown>
      const creds: AwsCredentials = {
        accessKeyId: String(j['AccessKeyId']),
        secretAccessKey: String(j['SecretAccessKey']),
        ...(typeof j['Token'] === 'string' ? { sessionToken: j['Token'] } : {}),
      }
      const expiry = Date.parse(String(j['Expiration']))
      cached = { creds, expiresAt: Number.isFinite(expiry) ? expiry : Date.now() + 10 * 60_000 }
      return creds
    }
    const id = process.env['AWS_ACCESS_KEY_ID']
    const secret = process.env['AWS_SECRET_ACCESS_KEY']
    if (id === undefined || id === '' || secret === undefined || secret === '') {
      throw new Error('no task role credentials: neither the ECS credentials endpoint nor AWS_* keys are set')
    }
    const token = process.env['AWS_SESSION_TOKEN']
    return { accessKeyId: id, secretAccessKey: secret, ...(token ? { sessionToken: token } : {}) }
  }
}

const UNCONFIGURED: ControlPlaneClient = {
  configured: false,
  get: async () => {
    throw new Error('the control plane is not configured: RECONCILE_INTERNAL_CONTROL_PLANE_URL is unset')
  },
  post: async () => {
    throw new Error('the control plane is not configured: RECONCILE_INTERNAL_CONTROL_PLANE_URL is unset')
  },
}

export async function resolveControlPlaneClient(): Promise<ControlPlaneClient> {
  const url = process.env['RECONCILE_INTERNAL_CONTROL_PLANE_URL']
  if (url === undefined || url === '') return UNCONFIGURED
  const audience = process.env['RECONCILE_INTERNAL_AUDIENCE'] || 'reconcile-control-local'
  if (process.env['RECONCILE_LOCAL_TEST_AUTH'] === '1') {
    const { mintInternalToken } = await import('../dev/internal-token.ts')
    return controlPlaneClient({
      baseUrl: url,
      signer: async (digest) => ({ [INTERNAL_HEADERS.localToken]: mintInternalToken({ digest, audience }) }),
    })
  }
  const region = process.env['RECONCILE_INTERNAL_STS_REGION']
  if (region === undefined || region === '') return UNCONFIGURED
  return controlPlaneClient({
    baseUrl: url,
    signer: stsSigner({ region, audience, credentials: taskRoleCredentials() }),
  })
}
