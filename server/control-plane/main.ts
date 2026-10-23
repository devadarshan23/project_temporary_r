/**
 * THE CONTROL PLANE AS A PROCESS — `compose.yaml`'s `control-plane` service runs
 * this.
 *
 * ⚠️ IT SEEDS NOTHING AND PROVISIONS NOTHING. It did both until 16 Aug 2026;
 * `server/control-plane/migrate-main.ts` is the one-shot job that does now, and
 * it carries the argument. What survives from this file's original header is the
 * observation that made it short in the first place: there is no tenant here, no
 * run, no contact — nothing to seed that belongs to a customer, because the
 * control plane holds no credential that reaches a customer's database and no
 * table that could store one. Invariant 3 is not asserted in this file; it is
 * unavailable to it.
 */

import { controlPlaneConfig } from './config.ts'
import { listenControlPlane } from './start.ts'

async function main(): Promise<void> {
  const config = controlPlaneConfig()
  const server = await listenControlPlane()
  console.log(
    `control-plane: listening on ${server.url}, database ${config.database.name} as ` +
      `${config.database.user}, local channel auth ${config.localChannelAuth ? 'ON' : 'OFF'}`,
  )

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void server.close().then(() => process.exit(0))
    })
  }
}

await main()
