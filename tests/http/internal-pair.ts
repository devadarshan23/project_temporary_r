/**
 * A control plane and a data-plane client for it, paired on the LOCAL internal
 * token — for suites that need the internal edge (G4301) and must not set
 * `RECONCILE_LOCAL_TEST_AUTH` (which would change the data plane's own session
 * reader). Both halves are passed as ARGUMENTS: the verifier to
 * `startControlPlane()`, the client to `startDataPlane()`.
 *
 * The control plane reads whatever `RECONCILE_CONTROL_DB_NAME` names at call
 * time, so the caller provisions and seeds that database first.
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import '../control-db-port.ts'
import { startControlPlane, type RunningControlPlane } from '../../server/control-plane/start.ts'
import { internalVerifierWithToken } from '../../server/control-plane/internal-auth.ts'
import { controlPlaneClient, type ControlPlaneClient } from '../../server/data-plane/control-plane-client.ts'
import { mintInternalToken, verifyInternalToken } from '../../server/dev/internal-token.ts'
import { INTERNAL_HEADERS } from '../../server/http/internal-request.ts'

const AUDIENCE = 'reconcile-control-pair'

export interface InternalPair {
  readonly controlPlane: RunningControlPlane
  readonly client: ControlPlaneClient
  close(): Promise<void>
}

export async function startInternalPair(): Promise<InternalPair> {
  const controlPlane = await startControlPlane({
    internalVerifier: internalVerifierWithToken((token, digest) => verifyInternalToken(token, digest, AUDIENCE)),
  })
  const client = controlPlaneClient({
    baseUrl: controlPlane.url,
    signer: async (digest) => ({ [INTERNAL_HEADERS.localToken]: mintInternalToken({ digest, audience: AUDIENCE }) }),
  })
  return { controlPlane, client, close: () => controlPlane.close() }
}
