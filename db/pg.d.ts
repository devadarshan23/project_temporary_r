/**
 * THE `pg` SURFACE THIS REPOSITORY DEPENDS ON — declared here, deliberately.
 *
 * G98 rules that `pg` is the Postgres client, pinned exact. It rules nothing
 * about `@types/pg`, and `pg` ships no types of its own — so taking `@types/pg`
 * would be a SECOND dependency decision that no ruling covers. The instruction
 * standing over this wave is explicit: adding one is a decision.
 *
 * So the surface is declared here instead, and it is deliberately tiny. Six
 * members is the entire dependency: construct a pool, check a client out,
 * query, release, construct a one-shot client, end. If a later slice needs
 * more, it is added here and the addition is visible in a diff — which is more
 * than `@types/pg` would give, and is the same argument `docs/HANDOFF.md` §5.3
 * makes for generated types over two vocabularies with nothing checking them.
 *
 * ⚠️ THIS FILE IS A CLAIM ABOUT SOMEONE ELSE'S LIBRARY AND NOTHING CHECKS IT.
 * A wrong signature here is a runtime failure that `tsc` reports as green —
 * the §5.10 shape one layer out. It is held honest only by the fact that every
 * member below is exercised by tests/db/tenant-isolation.test.ts against a
 * real server.
 */

declare module 'pg' {
  export interface QueryResult<R = Record<string, unknown>> {
    readonly rows: R[]
    /** `null` for statements that return no row count, e.g. `SET`. */
    readonly rowCount: number | null
  }

  export interface ConnectionConfig {
    readonly host?: string
    readonly port?: number
    readonly database?: string
    readonly user?: string
    readonly password?: string
    /**
     * Pool size. The two-tenant leak test sets this to 1 so that a second
     * checkout is FORCED onto the connection the first one returned — which
     * is what makes the backend-PID assertion meaningful rather than lucky.
     */
    readonly max?: number
    readonly connectionTimeoutMillis?: number
    /**
     * TLS. `false` for the disposable local PostgreSQL; an object for a real
     * server, which Aurora requires — it refuses an unencrypted connection with
     * `no pg_hba.conf entry … NO ENCRYPTION`, which is how this field came to
     * be declared.
     *
     * ⚠️ TYPED AS NARROWLY AS THE ONE CALLER NEEDS. `pg` accepts far more here
     * (a CA, a key, a cert, `checkServerIdentity`); this declares what
     * `db/env.ts#dbSsl` actually returns and nothing else, so widening it is a
     * deliberate edit rather than an accident. The same discipline as the rest
     * of this hand-written file.
     */
    readonly ssl?: false | { readonly rejectUnauthorized: boolean }
    readonly idleTimeoutMillis?: number
    readonly application_name?: string
  }

  export interface PoolClient {
    query(text: string, values?: readonly unknown[]): Promise<QueryResult>
    release(err?: Error | boolean): void
  }

  export interface Pool {
    connect(): Promise<PoolClient>
    end(): Promise<void>
  }
  export const Pool: new (config?: ConnectionConfig) => Pool

  export interface Client {
    connect(): Promise<void>
    query(text: string, values?: readonly unknown[]): Promise<QueryResult>
    end(): Promise<void>
  }
  export const Client: new (config?: ConnectionConfig) => Client
}
