/**
 * AWS SIGNATURE VERSION 4 — SIGNING ONLY, `node:crypto` ONLY, NO SDK.
 *
 * G4304, 5 Oct 2026, under THE OWNER'S *"SigV4 task role"* ruling. The data
 * plane signs ONE kind of request with it: the `sts:GetCallerIdentity` request
 * `server/data-plane/control-plane-client.ts` hands the control plane to
 * verify (`server/http/internal-request.ts` says why it is that request).
 *
 * ⚠️ WHY NOT THE SDK. `@aws-sdk/*` is fenced to two NAMED clients, one file
 * each (`tests/ci/aws-sdk-scope.test.ts`, G2404), and a SigV4 signer is not
 * either of them; reaching `@smithy/signature-v4` through `client-sqs`'s
 * transitive closure would be a dependency nobody pinned. SigV4 is a
 * published, test-vectored algorithm of a few dozen lines, and
 * `tests/http/internal-sigv4.test.ts` §1 holds this file to AWS's own
 * `get-vanilla` vector — a signer that agrees with itself is not evidence.
 *
 * 🛑 IT IS PURE: no clock (the caller passes `amzDate`), no credentials lookup,
 * no network. Everything that reaches outside the process is in the client.
 */

import { createHash, createHmac } from 'node:crypto'

export interface AwsCredentials {
  readonly accessKeyId: string
  readonly secretAccessKey: string
  readonly sessionToken?: string
}

export interface SignableRequest {
  readonly method: string
  readonly host: string
  /** Canonical URI — already URI-encoded, `/` for the root. */
  readonly path: string
  /** Already-canonical query string (sorted, encoded), or `''`. */
  readonly query: string
  /** Lower-case names. `host` and `x-amz-date` are added by `signV4`. */
  readonly headers: Readonly<Record<string, string>>
  readonly body: string
}

export interface SignedV4 {
  readonly authorization: string
  readonly signedHeaders: string
  /** The full header set that was signed, `host` and `x-amz-date` included. */
  readonly headers: Readonly<Record<string, string>>
}

const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex')
const hmac = (key: Buffer | string, s: string): Buffer => createHmac('sha256', key).update(s, 'utf8').digest()

/** `YYYYMMDDTHHMMSSZ` for an instant. */
export function amzDateOf(at: Date): string {
  return at.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

export function signV4(args: {
  readonly request: SignableRequest
  readonly credentials: AwsCredentials
  readonly region: string
  readonly service: string
  readonly amzDate: string
}): SignedV4 {
  const { request, credentials, region, service, amzDate } = args
  if (!/^\d{8}T\d{6}Z$/.test(amzDate)) throw new Error(`signV4() was given a malformed amzDate: ${amzDate}`)
  const date = amzDate.slice(0, 8)

  const headers: Record<string, string> = { ...request.headers, host: request.host, 'x-amz-date': amzDate }
  if (credentials.sessionToken !== undefined) headers['x-amz-security-token'] = credentials.sessionToken
  const names = Object.keys(headers).map((n) => n.toLowerCase()).sort()
  const canonicalHeaders = names
    .map((n) => `${n}:${String(headers[n] ?? '').trim().replace(/\s+/g, ' ')}\n`)
    .join('')
  const signedHeaders = names.join(';')

  const canonicalRequest = [
    request.method.toUpperCase(),
    request.path,
    request.query,
    canonicalHeaders,
    signedHeaders,
    sha256(request.body),
  ].join('\n')

  const scope = `${date}/${region}/${service}/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n')
  const kDate = hmac(`AWS4${credentials.secretAccessKey}`, date)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, service)
  const kSigning = hmac(kService, 'aws4_request')
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex')

  return {
    authorization:
      `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    signedHeaders,
    headers,
  }
}
