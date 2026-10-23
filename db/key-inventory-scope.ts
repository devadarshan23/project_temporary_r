/**
 * THE BOOT-TIME KEY INVENTORY SCOPE — R2 AS AMENDED, G2571 AND G2573,
 * 1 Oct 2026.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 THE EIGHTH SCOPED HELPER, AND THE FIRST OPENED WITH NO CALLER AT ALL.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The owner's ruling: *"Per-connection, boot-time: fetch every registered
 * connection's JWKS at boot and cache by connection."* **"Every registered
 * connection" is a read across tenants, and at boot there is no request, no
 * session, no host and no tenant** — so every scope in this directory denies
 * it under G100: `withTenantScope()` names one tenant, `withSessionScope()` one
 * session, `withSignInScope()` one broker handle, `withRealmScope()` one
 * domain, `withSignInPinScope()` one attempt. Each of them is an ADDRESS;
 * this one is an INVENTORY, and that difference is the whole of what has to be
 * argued.
 *
 * ⚠️ **WHAT IT ADMITS — `db/migrations/0300_connection_key_document.sql`'s
 * `identity_connection_key_inventory_rls`: every BROKERED row of
 * `tenant.identity_connection`, and nothing else in any table.** The reader is
 * `readConnectionKeyInventory()` in `server/data-plane/verification-terms.ts`
 * and it names THREE columns — id, `jwks_uri`, `audience` — none of which
 * identifies a person or holds a tenant's data: a door's key-set URL and its
 * OAuth client id are configuration, published by the broker to every browser
 * that is redirected through it.
 *
 * 🛑 **THE POLICY ADMITS WHOLE ROWS, AND THE COST IS NAMED RATHER THAN
 * HIDDEN.** A transaction that set this GUC by hand could `SELECT *` and read
 * every door's label and owner across tenants. **What holds that is a CENSUS,
 * not a construction**, which is G1161's honest phrase: this helper is CALLED
 * exactly once in `server/` — in `server/data-plane/main.ts`, before the plane
 * listens — and the GUC is spelled in exactly one file under `server/` and
 * `db/` outside the migrations, this one. `tests/db/connection-key-inventory.test.ts`
 * §5 strips comments and asserts both.
 *
 * ⚠️ **THE CONSTRUCTION THAT WOULD HAVE BEEN STRONGER WAS MEASURED AND DOES
 * NOT WORK — G2573.** A NOLOGIN role holding `SELECT` on three COLUMNS, entered
 * by `SET LOCAL ROLE`, would bound any misuse to those three columns by the
 * server rather than by a test. Against a live PostgreSQL 14.18 the inventory
 * read inside that role answered **`permission denied for table membership`**:
 * every OTHER permissive policy on `tenant.identity_connection` is still
 * evaluated for the new role, their subqueries read `tenant.membership`,
 * `tenant."user"` and `tenant.sign_in_attempt` AS THAT ROLE, and the role holds
 * nothing there. Making it work means granting it those tables — a wider
 * reach than the one it was meant to narrow. ⚠️ **AND A ROLE-TARGETED POLICY
 * WITHOUT A `current_user` TERM IS WORSE THAN NONE**: `reconcile_app` is
 * granted the role with INHERIT, so the policy would apply to every request
 * transaction. Both findings are recorded so the next reader does not re-take
 * the shape as an obvious improvement.
 *
 * 🛑 `BEGIN READ ONLY` — `db/control-read-scope.ts`'s argument verbatim: the
 * GRANT is per RELATION and per reviewer, the transaction mode is per
 * STATEMENT and enforced by the server. `0009` grants no write on
 * `tenant.identity_connection` and the policy is `FOR SELECT`; this mode holds
 * whatever a later migration says.
 *
 * ⚠️ `set_config` AND NOT `SET LOCAL`, FOR THE REASON EVERY SIBLING FILE
 * STATES — though here the value is a CONSTANT and nothing binds from outside.
 * It is `is_local => true`, so the connection returns to the pool carrying
 * nothing: the next checkout may be a tenant-scoped request.
 */

import type { ScopedClient, TenantPool } from './tenant-scope.ts'

/** The GUC `0300`'s policy keys on, and the one value it admits. */
export const KEY_INVENTORY_GUC = 'app.key_inventory'
export const KEY_INVENTORY_AT_BOOT = 'boot'

export async function withKeyInventoryScope<T>(
  pool: TenantPool,
  fn: (tx: ScopedClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN READ ONLY')
    await client.query('SELECT set_config($1, $2, true)', [KEY_INVENTORY_GUC, KEY_INVENTORY_AT_BOOT])
    const out = await fn(client)
    await client.query('COMMIT')
    return out
  } catch (err) {
    // Best-effort: the ORIGINAL error is the one worth propagating.
    await client.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    client.release()
  }
}
