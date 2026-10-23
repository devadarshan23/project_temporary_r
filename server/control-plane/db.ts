/**
 * THE CONTROL PLANE'S DATABASE SEAM.
 *
 * Deliberately not `db/tenant-scope.ts`. That module's whole purpose is to set
 * `app.tenant_id` inside an explicit transaction, and there is nothing here to
 * set it to: this database holds no tenant-scoped table. Reusing it would put a
 * tenant-shaped hole in a plane that must never have one, and somebody would
 * eventually fill it.
 *
 * ⚠️ WHAT THIS POOL DOES EXPOSE, THAT `TenantPool` DOES NOT, IS `query()`.
 * `db/tenant-scope.ts` hides it precisely so `pool.query(...)` — one
 * autocommitted statement with no `SET LOCAL` — is a COMPILE ERROR on the data
 * plane. Here it is the correct call, because there is no session variable to
 * lose. The asymmetry is the design, not an inconsistency: the data plane's
 * pool is narrowed by exactly the one method that leaks tenant scope.
 */

import type { Pool, QueryResult } from 'pg'

import { loadPg } from '../../db/pg.ts'
import { controlPlaneConfig } from './config.ts'
import { dbSsl } from '../../db/env.ts'

export interface ControlTx {
  query(text: string, values?: readonly unknown[]): Promise<QueryResult>
}

export interface CataloguePool {
  query(text: string, values?: readonly unknown[]): Promise<QueryResult>
  /**
   * G4308 — an explicit transaction, for the internal onboarding writes that
   * moved here from the data plane's `db/control-write-scope.ts`. Both are
   * READ-MODIFY-WRITE under a row lock, so three autocommitted statements
   * would let two callers advance one sequence once, and the advances-only
   * trigger cannot see it (two increments are not a decrement).
   */
  transaction<T>(fn: (tx: ControlTx) => Promise<T>): Promise<T>
  end(): Promise<void>
}

export async function createCataloguePool(): Promise<CataloguePool> {
  const { Pool: PgPool } = await loadPg()
  const config = controlPlaneConfig()
  const pool: Pool = new PgPool({
    host: config.database.host,
    port: config.database.port,
    ssl: dbSsl(config.database.host),
    database: config.database.name,
    user: config.database.user,
    ...(config.database.password === undefined ? {} : { password: config.database.password }),
    max: config.database.poolMax,
    application_name: 'reconcile-control',
  })
  // `pg.Pool` carries `query`; `db/pg.d.ts` declares only the narrowed surface
  // the data plane may use, so the method is reached through a checked-out
  // client rather than added to that declaration — which would hand
  // `pool.query(...)` back to the data plane as well.
  return {
    query: async (text, values) => {
      const client = await pool.connect()
      try {
        return await client.query(text, values)
      } finally {
        client.release()
      }
    },
    transaction: async (fn) => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        try {
          const out = await fn({ query: (text, values) => client.query(text, values) })
          await client.query('COMMIT')
          return out
        } catch (err) {
          await client.query('ROLLBACK').catch(() => undefined)
          throw err
        }
      } finally {
        client.release()
      }
    },
    end: () => pool.end(),
  }
}
