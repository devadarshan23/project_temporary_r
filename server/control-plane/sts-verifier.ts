/**
 * THE CONTROL PLANE VERIFIES AN INTERNAL CALLER BY ASKING STS — THE ONE
 * OUTBOUND REQUEST THIS PLANE MAKES. G4302, G4303, G4307.
 *
 * THE OWNER'S RULING: *"SigV4 task role": the data-plane task role signs
 * internal requests; the control plane verifies.*
 *
 * 🛑 "THE CONTROL PLANE VERIFIES" HAS EXACTLY ONE IMPLEMENTATION AND IT IS A
 * NETWORK CALL. A SigV4 signature by an IAM role is verified with a key only
 * AWS holds, so a self-hosted process cannot check one locally — the
 * alternatives (API Gateway or VPC Lattice IAM auth) put the verification in
 * front of this process rather than in it, which is not what was ruled. The
 * caller therefore signs `sts:GetCallerIdentity` and this module forwards that
 * signed request to STS with two header VALUES it computes itself
 * (`server/http/internal-request.ts`). STS answers with the caller's ARN or
 * refuses. This is Vault's AWS auth method and the EKS IAM authenticator's
 * shape, and the binding to OUR request is the signed digest header.
 *
 * ⚠️ AND THAT SPENDS A PROPERTY: `tests/http/console-roster-unreachable.test.ts`
 * §1c asserted *"the control plane makes no outbound request at all"*. It is
 * re-argued there rather than loosened — a `deepEqual` to THIS ONE FILE, whose
 * only destination is the regional STS endpoint built from configuration, never
 * from a request. Nothing about invariant 3 moves: STS holds no tenant data.
 *
 * 🛑 FOUR CHECKS BEFORE ANYTHING LEAVES THE PROCESS, EACH A REFUSAL BY NAME:
 * the scheme and scope parse; the scope's region and service are OURS and
 * `sts`; the SignedHeaders are EXACTLY the expected list (G4303 — inclusion
 * would let a signature that omitted the digest validate for any digest); the
 * date is within five minutes. Then the ARN STS returns must be the configured
 * data-plane task role's assumed-role ARN — an ARN from the same account but a
 * different role is refused (G4307).
 */

import {
  STS_AUDIENCE_HEADER,
  STS_BODY,
  STS_CONTENT_TYPE,
  STS_DIGEST_HEADER,
  STS_SIGNED_HEADERS_WITHOUT_TOKEN,
  STS_SIGNED_HEADERS_WITH_TOKEN,
} from '../http/internal-request.ts'

export interface StsVerifierConfig {
  readonly region: string
  /** `arn:aws:iam::<acct>:role/<name>` — the data-plane task role. */
  readonly callerRoleArn: string
  readonly audience: string
  /** Tests only. Production is `https://sts.<region>.amazonaws.com/`, never configuration. */
  readonly endpoint?: string
  readonly fetchImpl?: typeof fetch
  readonly now?: () => number
}

export interface PresentedStsSignature {
  readonly authorization: string
  readonly amzDate: string
  readonly securityToken: string | null
}

export const STS_REFUSALS = {
  malformedAuthorization: 'malformed_authorization',
  foreignScope: 'foreign_scope',
  signedHeadersWrong: 'signed_headers_wrong',
  dateOutOfWindow: 'date_out_of_window',
  stsRefused: 'sts_refused',
  callerNotAllowed: 'caller_not_allowed',
} as const
export type StsRefusal = (typeof STS_REFUSALS)[keyof typeof STS_REFUSALS]

export type StsVerdict = { readonly ok: true; readonly callerArn: string } | { readonly ok: false; readonly refusal: StsRefusal }

const AUTH = /^AWS4-HMAC-SHA256 Credential=([A-Z0-9]{16,128})\/(\d{8})\/([a-z0-9-]+)\/([a-z0-9-]+)\/aws4_request, SignedHeaders=([a-z0-9;-]+), Signature=([0-9a-f]{64})$/
const MAX_SKEW_MS = 5 * 60 * 1000

/** `arn:aws:iam::123:role/path/Name` → `arn:aws:sts::123:assumed-role/Name/`. */
export function assumedRolePrefix(roleArn: string): string | null {
  const m = /^arn:(aws[a-z-]*):iam::(\d{12}):role\/(?:[^/]+\/)*([^/]+)$/.exec(roleArn)
  return m === null ? null : `arn:${m[1]}:sts::${m[2]}:assumed-role/${m[3]}/`
}

function instantOf(amzDate: string): number | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(amzDate)
  if (m === null) return null
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]))
}

export function stsVerifier(
  config: StsVerifierConfig,
): (presented: PresentedStsSignature, digest: string) => Promise<StsVerdict> {
  const prefix = assumedRolePrefix(config.callerRoleArn)
  if (prefix === null) {
    throw new Error(
      `the control plane was configured with an internal caller role ARN it cannot parse: ${config.callerRoleArn}. ` +
        'Refusing to start rather than verifying against nobody.',
    )
  }
  const endpoint = config.endpoint ?? `https://sts.${config.region}.amazonaws.com/`
  /* Named `fetch` so the egress census (`console-roster-unreachable` §1c) sees the call. */
  const fetch = config.fetchImpl ?? globalThis.fetch
  const now = config.now ?? Date.now

  return async (presented, digest) => {
    const m = AUTH.exec(presented.authorization)
    if (m === null) return { ok: false, refusal: STS_REFUSALS.malformedAuthorization }
    const [, , scopeDate, region, service, signedHeaders] = m
    if (region !== config.region || service !== 'sts' || scopeDate !== presented.amzDate.slice(0, 8)) {
      return { ok: false, refusal: STS_REFUSALS.foreignScope }
    }
    const expected =
      presented.securityToken === null ? STS_SIGNED_HEADERS_WITHOUT_TOKEN : STS_SIGNED_HEADERS_WITH_TOKEN
    if (signedHeaders !== expected) return { ok: false, refusal: STS_REFUSALS.signedHeadersWrong }
    const at = instantOf(presented.amzDate)
    if (at === null || Math.abs(now() - at) > MAX_SKEW_MS) {
      return { ok: false, refusal: STS_REFUSALS.dateOutOfWindow }
    }

    const headers: Record<string, string> = {
      authorization: presented.authorization,
      'content-type': STS_CONTENT_TYPE,
      'x-amz-date': presented.amzDate,
      [STS_AUDIENCE_HEADER]: config.audience,
      [STS_DIGEST_HEADER]: digest,
      accept: 'application/xml',
    }
    if (presented.securityToken !== null) headers['x-amz-security-token'] = presented.securityToken

    /* A transport failure THROWS: an authenticator that broke must not be
       indistinguishable from one that said no (`server/http/app.ts`). */
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: STS_BODY,
      signal: AbortSignal.timeout(3_000),
      redirect: 'error',
    })
    const text = await res.text()
    if (res.status !== 200) return { ok: false, refusal: STS_REFUSALS.stsRefused }
    const arn = /<Arn>([^<]{1,2048})<\/Arn>/.exec(text)?.[1]
    if (arn === undefined || !arn.startsWith(prefix) || arn.length === prefix.length) {
      return { ok: false, refusal: STS_REFUSALS.callerNotAllowed }
    }
    return { ok: true, callerArn: arn }
  }
}
