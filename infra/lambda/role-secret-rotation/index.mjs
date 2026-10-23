/**
 * THE ROLE-SECRET ROTATION FUNCTION'S ENTRY POINT — G3921.
 *
 * One function per role secret, built by `infra/lib/data-stack.ts`. The logic
 * is `rotation.mjs`; the wire client is `pgwire.mjs`; this file wires the AWS
 * SDK to both and does nothing else.
 *
 * ⚠️ THE AWS SDK IS IMPORTED DYNAMICALLY, FOR THE REASON
 * `infra/lambda/tenant-key-minter/index.mjs` STATES: `@aws-sdk/*` is bundled
 * with the `nodejs22.x` runtime and is on disk nowhere in `infra/`, so a static
 * import would make `rotation.mjs` and `pgwire.mjs` untestable here.
 *
 * ⚠️ LOGS CARRY THE ROLE, THE STEP AND THE OUTCOME — NEVER A SECRET VALUE, A
 * VERIFIER OR A HOST. A refusal's message names a reason code and, for the
 * holder check, a service name and three counts.
 */

import { connect, scramVerifier } from './pgwire.mjs'
import { readConfig, readEvent } from './guards.mjs'
import { rotateStep } from './rotation.mjs'

let clients = null

async function awsClients() {
  if (clients !== null) return clients
  const smSdk = await import('@aws-sdk/client-secrets-manager')
  const ecsSdk = await import('@aws-sdk/client-ecs')
  const sm = new smSdk.SecretsManagerClient({})
  const ecs = new ecsSdk.ECSClient({})
  clients = {
    sm: (name, input) => sm.send(new smSdk[`${name}Command`](input)),
    ecs: (name, input) => ecs.send(new ecsSdk[`${name}Command`](input)),
  }
  return clients
}

export async function handler(event) {
  const config = readConfig(process.env)
  const parsed = readEvent(event, config)
  const { sm, ecs } = await awsClients()
  return rotateStep(
    {
      sm,
      ecs,
      connect,
      verifier: (password) => scramVerifier(password),
      log: (line) => console.log(JSON.stringify(line)),
    },
    config,
    parsed,
  )
}
