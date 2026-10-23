/**
 * THE DATA PLANE AS A PROCESS — `compose.yaml`'s `data-plane` service runs this.
 *
 * Read the config, take a pool as `reconcile_app`, listen. That is the whole
 * file, and the shortness is the feature.
 *
 * 🛑 IT DOES NOT PROVISION AND IT DOES NOT MIGRATE. ⚠️ IT DID BOTH UNTIL
 * 16 Aug 2026 and the header here argued for it — "provision, migrate, seed if
 * asked, listen. In that order, in one process, so that `docker compose up` is
 * the whole runbook." That sentence is corrected rather than deleted because it
 * is the one a reader would have trusted, and because its reasoning was sound
 * about the runbook and wrong about the blast radius: doing all four here meant
 * the SERVING process held the cluster superuser and the `LOGIN BYPASSRLS`
 * migrator for its entire life. `server/data-plane/migrate-main.ts` is the
 * one-shot job that holds them now, and it carries the full argument.
 *
 * ⚠️ WHAT THAT BUYS IS NOT A SHORTER ENVIRONMENT BLOCK. It is that this file's
 * static import closure does not reach `db/provision.ts` or `db/migrate.ts` at
 * all — so the process that serves a request has no code path to `CREATE ROLE`,
 * no matter which variables somebody puts back.
 * `tests/http/local-stack-exposure.test.ts` walks that closure and fails if
 * either module reappears here.
 *
 * ⚠️ AND THE CONSEQUENCE, STATED PLAINLY: THIS PROCESS ASSUMES A MIGRATED
 * DATABASE. Compose enforces the order with
 * `depends_on: { data-plane-migrate: { condition: service_completed_successfully } }`.
 * Run outside compose against an unmigrated database, it starts and then fails
 * its first query — a loud runtime error rather than a plane that quietly
 * repairs a schema it should not be able to touch.
 */

import { dataPlaneConfig } from './config.ts'
import { listenDataPlane } from './start.ts'
import { withKeyInventoryScope } from '../../db/key-inventory-scope.ts'
import { createAppPool } from '../../db/tenant-scope.ts'
import {
  describeConnectionTermsRefusal,
  identityTolerances,
  loadVerificationTerms,
  readConnectionKeyInventory,
  type ConnectionKeyTarget,
  type VerificationTermsSource,
} from './verification-terms.ts'

/**
 * R2's BOOT-TIME LOAD — 25 Sep 2026, the owner's: *"The JWKS is fetched ONCE AT
 * BOOT and cached in memory. No runtime egress."*
 *
 * 🛑 **IT IS HERE AND NOT IN `start.ts`, AND THAT IS THE FENCE RATHER THAN A
 * PLACEMENT PREFERENCE.** `listenDataPlane()` is what every HTTP test and every
 * fixture plane calls; this file is what `compose.yaml`'s `data-plane` service
 * runs. Putting the load in `start.ts` would make the whole suite reach the
 * network — which G108's determinism condition forbids for the gate — and
 * would give a request-path module a reason to import the transport. **The
 * process loads keys; the server does not.**
 *
 * 🛑 **AND IT REFUSES TO BOOT RATHER THAN SERVING WITHOUT KEYS.** That is the
 * cost the owner accepted — a broker outage becomes a FAILED DEPLOY rather
 * than a degraded service — and it is the fail-closed direction. A plane that
 * started with no key document would answer `token_key_not_found` to every
 * token, which reads as a key ROTATION to any operator who has met that arm,
 * so the hidden failure would also be the misdiagnosed one.
 *
 * ⚠️ **AN UNCONFIGURED PLANE IS NOT A FAILED ONE.** `identityTermsTarget()`
 * answers `null` when a deployment has stated no issuer, audience or key-set
 * URL — which is every local plane and `compose.yaml` — and such a plane boots,
 * serves, and verifies no token, exactly as it did before this slice. **Only a
 * plane that SAID where its broker is, and could not reach it, dies.**
 * ⚠️ *"no issuer, audience or key-set URL"* is corrected rather than deleted:
 * since 1 Oct 2026 (D6-5, G2231) a deployment states no issuer at all — the
 * issuer is read off the pinned `identity_connection` row — so `null` means
 * no audience or no key-set URL.
 */
/*
 * 🛑 **R2 IS AMENDED — G2571, 1 Oct 2026, THE OWNER'S: *"Per-connection,
 * boot-time: fetch every registered connection's JWKS at boot and cache by
 * connection; audience becomes a column. Still no runtime JWKS egress; a new
 * connection needs a restart."*** The block above is kept as R2's own
 * argument and TWO of its claims are now false, corrected rather than deleted:
 *
 * ⚠️ *"AND IT REFUSES TO BOOT RATHER THAN SERVING WITHOUT KEYS"* — **one
 * door's unreachable key document no longer refuses the boot (G2574).** Under
 * BYOA a pool may sit in a customer's account, and failing the boot would hand
 * every customer's identity provider a veto over the whole plane. The door is
 * marked unverifiable BY NAME and one line per such door is printed below,
 * before the listener; its tokens are refused
 * `connection_key_document_unavailable`, never `token_key_not_found`, so the
 * misdiagnosis this block warns about cannot happen. **What still refuses the
 * boot is the inventory READ**: a plane that cannot ask its database which
 * doors exist knows nothing and must not listen.
 *
 * ⚠️ *"`identityTermsTarget()` answers `null` …"* — **that function is
 * retired (G2572).** What keeps a local plane off the network now is the
 * inventory itself: no brokered door with a declared `jwks_uri`, no import of
 * the transport.
 */
async function identityTerms(): Promise<VerificationTermsSource> {
  const tolerances = identityTolerances()
  /* ONE connection, for ONE read, ended before the listener's own pool is
   * created — this is not a second serving pool. */
  const pool = await createAppPool(1)
  let inventory: readonly ConnectionKeyTarget[]
  try {
    inventory = await withKeyInventoryScope(pool, (tx) => readConnectionKeyInventory(tx))
  } finally {
    await pool.end()
  }
  const source = await loadVerificationTerms(tolerances, inventory)
  for (const door of inventory) {
    const loaded = source.connections.get(door.connectionId)
    if (loaded !== undefined && !loaded.ok) {
      console.error(describeConnectionTermsRefusal(door, tolerances.jwksTimeoutMs, loaded.refusal))
    }
  }
  return source
}

async function main(): Promise<void> {
  const config = dataPlaneConfig()

  /* Before the listener, deliberately: a plane that cannot verify a token must
   * not accept a connection first and discover it afterwards. */
  const terms = await identityTerms()

  const server = await listenDataPlane({
    host: config.http.host,
    port: config.http.port,
    poolMax: config.database.poolMax,
    /* S6, G2490: the callback verifies against exactly this document. */
    identityTerms: terms,
  })

  console.log(
    `data-plane: listening on ${server.url}, database ${config.database.name} as ` +
      `${config.database.user}, local test auth ${config.localTestAuth ? 'ON' : 'OFF'}, ` +
      `run queue ${config.runQueueConfigured ? 'CONFIGURED' : 'ABSENT — admitted runs will be published NOWHERE'}, ` +
      /* R2. The key COUNT and the load INSTANT, and no key material: a JWKS is
       * public, and a line that printed one would still be a line nobody needs.
       * `loadedAt` is here because a rotation needs a RESTART, so how old the
       * keys in memory are is the one operational fact this line can give. */
      /* G2571: per door now. The counts only — which door failed and why is
       * on its own line above, printed before this one. */
      `identity terms ${(() => {
        const all = [...terms.connections.values()]
        const loaded = all.filter((d) => d.ok).length
        return all.length === 0
          ? 'ABSENT — no brokered door is registered, so no token can be verified'
          : `${loaded} of ${all.length} brokered door(s) verifiable, loaded ${terms.loadedAt.toISOString()} ` +
              '(a rotation or a new door needs a RESTART)'
      })()}, ` +
      /* R7. `false` is every plane today and it is the intended failure, not a
       * regression — G139 refuses a default, so an unconfigured platform mints
       * no session rather than an unbounded one. */
      `session bounds ${
        config.sessionBoundsUsable
          ? 'USABLE'
          : 'UNUSABLE — no session can be minted; state ' +
            'RECONCILE_SESSION_MAX_LIFETIME_SECONDS and RECONCILE_SESSION_MAX_IDLE_SECONDS'
      }`,
  )

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void server.close().then(() => process.exit(0))
    })
  }
}

await main()
