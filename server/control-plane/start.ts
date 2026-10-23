/**
 * THE CONTROL PLANE, STARTED — booting from `control-plane.openapi.yaml` and
 * serving out of its OWN database.
 *
 * ┌─ CHANNEL AUTHENTICATION, STATED PLAINLY ───────────────────────────────────┐
 * │ `control-plane.openapi.yaml` declares `security: [sigV4]` at the document   │
 * │ level: "the data plane assumes a narrow role in OUR account… AWS            │
 * │ authenticates who is calling and we manage no shared secrets."              │
 * │                                                                            │
 * │ 🛑 SIGV4 IS NOT IMPLEMENTED HERE, AND THE CONSEQUENCE IS THAT THIS PLANE    │
 * │ REFUSES EVERYBODY UNLESS `RECONCILE_LOCAL_TEST_AUTH=1` — the same flag,     │
 * │ read the same way, with the same equality against one literal. A plane that │
 * │ cannot authenticate anybody must serve nobody; the alternative is a         │
 * │ distribution endpoint that answers an unauthenticated caller because the    │
 * │ check it was waiting for never arrived.                                     │
 * │                                                                            │
 * │ ⚠️ AND THE PARAGRAPH ABOVE WAS TRUE OF THE FLAG AND FALSE OF EVERYTHING ON  │
 * │ THE FAR SIDE OF IT UNTIL 16 Aug 2026. It is corrected here rather than      │
 * │ deleted, because "the same flag, read the same way" is the sentence a       │
 * │ reader would have trusted. The equality WAS identical; the consequence was  │
 * │ not. This function's flag-on branch returned                                │
 * │ `() => ({ channel: 'local-development' })` — a reader that never looked at  │
 * │ the request — so one environment variable gated a SIGNED path on the data   │
 * │ plane and a ZERO-CREDENTIAL path here. Verified live: `GET /catalogue/packs`│
 * │ with no credential at all returned 200 and the whole catalogue. FLAG ON     │
 * │ MUST STILL MEAN A CREDENTIAL WAS PRESENTED, and it now does — the same      │
 * │ signed local token, verified by the same module, reached the same way.      │
 * │ `tests/http/control-plane-http.test.ts` is the assertion.                   │
 * │                                                                            │
 * │ The refusal carries `session_invalid`, which is the only member of          │
 * │ `errors.yaml`'s closed enum that means "not authenticated". The contract's  │
 * │ `ChannelUnauthenticated` response names no code of its own; picking one     │
 * │ outside the enum would be a contract change and is not this slice's to make.│
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ✅ **AND SINCE 5 Oct 2026 SIGV4 IS VERIFIED HERE FOR THE INTERNAL TIER — G4302,
 * THE OWNER'S "SigV4 task role" RULING. THE BOX ABOVE IS CORRECTED RATHER THAN
 * DELETED**: its sentence *"SIGV4 IS NOT IMPLEMENTED HERE"* stays exactly true
 * of the CATALOGUE operations, which still serve only the local token, and is
 * false of the four *X10 Console internal* operations, which the data plane
 * reaches signed and which `internal-auth.ts` verifies through STS (deployed)
 * or the local internal token (flag on). An unconfigured deployed plane serves
 * them to nobody.
 *
 * ⚠️ NOTHING IN THIS DIRECTORY IMPORTS `db/tenant-scope.ts`, so there is no
 * `withTenantScope()` in this plane to call — there is no tenant scope to set.
 * Reproduce: `grep -rnE "^import .*tenant-scope" server/control-plane/`
 * returns nothing. ⚠️ **THE `^import` IS NEW — G2174, 28 Sep 2026.** The bare
 * form answered ELEVEN, all of it prose about the absence, this line among
 * them; it is described rather than restated, for the reason it was wrong.
 *
 * 🛑 BUT DO NOT READ THAT AS "THE PROCESS CANNOT NAME THE DATA PLANE'S DATABASE",
 * WHICH IS WHAT THIS COMMENT SAID FIRST AND IS NOT TRUE. `provision.ts` imports
 * `db/migrate.ts`, which imports `ROLES` from `db/env.ts`, so `dbTarget()` is
 * loaded here transitively. Nothing calls it. `server/control-plane/config.ts`
 * carries the full correction and the three fences that actually hold.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'

import { buildPlane, type Handler, type TierMount } from '../http/app.ts'
import {
  UNAUTHORISED_DETAIL,
  noCapabilityIsReachable,
  refuseGatedOperations,
} from './authorise.ts'
import { controlPlaneConfig } from './config.ts'
import { createCataloguePool, type CataloguePool } from './db.ts'
import {
  completeInternalOnboardingStepHandler,
  forceInternalOnboardingStepHandler,
  getInternalOnboardingHandler,
  getInternalRosterHandler,
} from './internal.ts'
import { resolveInternalVerifier, type InternalPrincipal, type InternalVerifier } from './internal-auth.ts'
import { INTERNAL_HEADERS } from '../http/internal-request.ts'

export interface RunningControlPlane {
  readonly url: string
  close(): Promise<void>
}

/**
 * A caller this plane will serve. There is exactly one kind and it is local.
 *
 * 🛑 NOTE WHAT IS NOT ON IT: A TENANT. The local credential is the data plane's
 * token and it CARRIES a tenant, because the data plane needs one. This plane
 * discards it at the seam and never puts it on a principal, so there is no field
 * for a handler to read and no `withTenantScope()` here to hand it to. Invariant
 * 3 — "the control plane publishes downward and never reads tenant data."
 * `tests/http/control-plane-http.test.ts` asserts the consequence: two sessions
 * naming two different tenants receive byte-identical catalogues.
 */
export interface ChannelPrincipal {
  readonly channel: 'local-development'
}

/**
 * G4302 — a caller is now one of TWO kinds. The local catalogue token above,
 * and the INTERNAL channel: the data plane, verified through STS (deployed) or
 * the local internal token (flag on), bound to one signed request. Neither
 * carries a tenant. `server/control-plane/internal.ts` refuses the first kind
 * on every internal operation.
 */
export type ControlPrincipal = ChannelPrincipal | InternalPrincipal

/** The header the local credential arrives in — the same one the data plane reads. */
const CHANNEL_HEADER = 'x-session'

const UNAUTHENTICATED_DETAIL =
  'This control plane authenticates callers with AWS SigV4, which is not implemented in phase ' +
  'one. It therefore serves nobody unless it was STARTED with RECONCILE_LOCAL_TEST_AUTH=1 — and ' +
  'even then it serves only a caller presenting a locally minted, signature-verified token.'

/**
 * The channel reader, chosen ONCE at boot, exactly as the data plane's is — and
 * now, unlike before, with the same THING on the far side of the flag.
 *
 * `denyAll` closes over nothing and can return nothing but `null`; a plane
 * started without the flag holds it for life, and a later mutation of
 * `process.env` has no branch left to change.
 *
 * ⚠️ THE DYNAMIC IMPORT IS COPIED FROM `server/data-plane/session.ts` DELIBERATELY
 * AND FOR THE SAME REASON. A plane started without the flag never LOADS the
 * verifier, so there is no accepting code path in the process to reach or
 * bypass — the fence is an absent module rather than a line somebody can move.
 * Copying the mechanism is what makes "the same flag, read the same way" a true
 * sentence about both planes instead of a comment on one of them.
 */
async function resolveChannelReader(): Promise<(request: FastifyRequest) => ChannelPrincipal | null> {
  if (process.env['RECONCILE_LOCAL_TEST_AUTH'] !== '1') return () => null

  const { verifyTestToken } = await import('../dev/test-token.ts')
  return (request) => {
    const raw = request.headers[CHANNEL_HEADER]
    if (typeof raw !== 'string' || raw === '') return null
    // The verified payload is DISCARDED except for the fact that it verified.
    // What is being established is that the caller holds this machine's local
    // key — not who they are, and certainly not which tenant they are.
    return verifyTestToken(raw) === null ? null : { channel: 'local-development' }
  }
}

interface PackRow {
  readonly pack_key: string
  readonly pack_version: number
  readonly label: string
  readonly domain: string
  readonly lifecycle: string
  readonly minimum_schema_version: number
  readonly superseded_by: string | null
}

/**
 * `GET /catalogue/packs` — `listEntitledPacks`.
 *
 * "VERSION NEGOTIATION HAPPENS HERE, NOT AT FETCH. The listing is filtered
 * against the caller's declared `X-Schema-Version`… A catalogue that lists
 * everything and fails at install is a catalogue that teaches operators to
 * ignore it."
 *
 * ⚠️ ENTITLEMENT IS NOT APPLIED AND THE OMISSION IS LOUD RATHER THAN QUIET. The
 * operation's own description says "ENTITLEMENT GATES THE LISTING", and
 * entitlement lives in `EntitlementLease`, which has no table in this database
 * and no slice that writes one. Filtering by a table that does not exist would
 * return an empty catalogue and look like a working gate. What is applied is the
 * half that is real: the schema-version window, out of the header the contract
 * marks `required: true`.
 */
function listEntitledPacksHandler(pool: CataloguePool): Handler {
  return async (request) => {
    // Validated and coerced by the contract's own `{type: integer, minimum: 1}`
    // before this line runs; `required: true` means it cannot be absent.
    const headers = request.headers as Record<string, unknown>
    const schemaVersion = Number(headers['x-schema-version'])

    const result = await pool.query(
      'SELECT pack_key, pack_version, label, domain, lifecycle,\n' +
        '       minimum_schema_version, superseded_by\n' +
        '  FROM pack_catalogue\n' +
        ' WHERE minimum_schema_version <= $1\n' +
        ' ORDER BY pack_key ASC, pack_version DESC',
      [schemaVersion],
    )

    return {
      packs: (result.rows as unknown as PackRow[]).map((row) => ({
        packKey: row.pack_key,
        packVersion: row.pack_version,
        label: row.label,
        domain: row.domain,
        lifecycle: row.lifecycle,
        minimumSchemaVersion: row.minimum_schema_version,
        supersededBy: row.superseded_by,
      })),
    }
  }
}

function mounts(pool: CataloguePool): readonly TierMount[] {
  return [
    {
      tier: 'controlPlane',
      handlers: {
        listEntitledPacks: listEntitledPacksHandler(pool),
        /* G4301 — the internal edge. Exempt and machine-called, like every
           operation on this tier; the data plane gated and recorded the act. */
        getInternalRoster: getInternalRosterHandler(pool),
        getInternalOnboarding: getInternalOnboardingHandler(pool),
        completeInternalOnboardingStep: completeInternalOnboardingStepHandler(pool),
        forceInternalOnboardingStep: forceInternalOnboardingStepHandler(pool),
      },
    },
  ]
}

/** Does this request present the internal channel's credentials at all? */
function presentsInternal(request: FastifyRequest): boolean {
  return (
    request.headers[INTERNAL_HEADERS.stsAuthorization] !== undefined ||
    request.headers[INTERNAL_HEADERS.localToken] !== undefined
  )
}

async function buildControlPlane(
  pool: CataloguePool,
  internalVerifier?: InternalVerifier,
): Promise<FastifyInstance> {
  const reader = await resolveChannelReader()
  const internal = internalVerifier ?? (await resolveInternalVerifier())
  const tiers = mounts(pool)
  /**
   * 🛑 BEFORE THE LISTENER, NOT AFTER IT. G200's gate, 19 Sep 2026.
   *
   * Every operation this tier declares is EXEMPT and this plane builds no
   * principal a capability could be evaluated against, so an operation here that
   * named one would be asking a question this process structurally cannot
   * answer. `server/control-plane/authorise.ts` carries the argument and the
   * reason it is a refusal to START rather than a 403 at request time.
   */
  refuseGatedOperations(tiers)
  return buildPlane<ControlPrincipal>(
    {
      plane: 'control-plane',
      authenticate: (request) => (presentsInternal(request) ? internal(request) : reader(request)),
      unauthenticatedDetail: UNAUTHENTICATED_DETAIL,
      authorise: noCapabilityIsReachable,
      unauthorisedDetail: UNAUTHORISED_DETAIL,
    },
    tiers,
  )
}

/** Ephemeral port, for a test process. */
export async function startControlPlane(
  opts: {
    /** Tests only — an ARGUMENT, so no deployed process can be configured into one. */
    readonly internalVerifier?: InternalVerifier
  } = {},
): Promise<RunningControlPlane> {
  const pool = await createCataloguePool()
  const app = await buildControlPlane(pool, opts.internalVerifier)
  try {
    await app.listen({ port: 0, host: '127.0.0.1' })
  } catch (err) {
    await pool.end().catch(() => undefined)
    throw err
  }
  const address = app.server.address()
  if (address === null || typeof address === 'string') {
    await app.close()
    await pool.end().catch(() => undefined)
    throw new Error('the control plane bound a pipe rather than a TCP port')
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await app.close()
      await pool.end()
    },
  }
}

/** The configured port, for the container entry point. */
export async function listenControlPlane(): Promise<RunningControlPlane> {
  const config = controlPlaneConfig()
  const pool = await createCataloguePool()
  const app = await buildControlPlane(pool)
  try {
    await app.listen({ port: config.http.port, host: config.http.host })
  } catch (err) {
    await pool.end().catch(() => undefined)
    throw err
  }
  return {
    url: `http://${config.http.host}:${config.http.port}`,
    close: async () => {
      await app.close()
      await pool.end()
    },
  }
}
