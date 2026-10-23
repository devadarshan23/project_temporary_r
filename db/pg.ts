/// <reference path="./pg.d.ts" />

/**
 * THE SINGLE SEAM ONTO THE DRIVER — and the reason it is loaded dynamically.
 *
 * ✅ **"It is not in `package.json` yet" WENT FALSE ON 16 Aug 2026 AND IS
 * CORRECTED HERE RATHER THAN DELETED**, because it is the sentence a reader
 * would have trusted. `pg@8.23.0` is now a dependency, pinned exact, because the
 * HTTP slice put a SERVER on this driver and a runtime process cannot reach a
 * package that is not in the manifest. Derive it: `grep -n '"pg"' package.json`.
 *
 * ⚠️ AND IT LANDED AS A RUNTIME `dependencies` ENTRY, NOT THE `devDependencies`
 * SLOT G98's ROW NAMES. That is a deviation from the ruling's wording and it is
 * flagged rather than absorbed: when G98 was taken the only consumer was a test,
 * and `server/data-plane/start.ts` is not a test. The owner may want to say so on
 * the row.
 *
 * G98 rules `pg`, pinned exact. G108 rules that `npm test` joins `npm run check`
 * and that CI runs only that — so a STATIC `import { Pool } from 'pg'` anywhere
 * under `db/` would have made the entire gate fail to load on a clean `npm ci`,
 * with an `ERR_MODULE_NOT_FOUND` stack that says nothing about tenancy.
 *
 * Loading it here, once, behind a promise means a missing driver degrades to
 * the same LOUD SKIP as an unreachable database rather than taking the gate
 * down. The two are genuinely the same condition — "no PostgreSQL available to
 * test against" — and they deserve the same honest report.
 *
 * ⚠️ THE SKIP IS ONLY HONEST WHILE IT IS LOUD. A run in which the two-tenant
 * leak test skipped is NOT evidence that tenant isolation holds, and the banner
 * it prints says exactly that.
 *
 * 🛑 THE DYNAMIC LOAD IS KEPT NOW THAT THE DRIVER IS INSTALLED, AND THE REASON
 * HAS CHANGED. It is no longer about a missing package: it is that a missing
 * DRIVER and an unreachable SERVER deserve the same honest report, and that
 * `pgAvailable()` is the one place that decides. Deleting it would turn one of
 * those two conditions into an `ERR_MODULE_NOT_FOUND` in a gate that has 978
 * passing tests with no database at all. The skip now fires only for an
 * unreachable server — verified 16 Aug 2026: `RECONCILE_DB_PORT=1 npm run check`
 * exits 0 with both database suites printing their banners.
 */

type PgModule = typeof import('pg')

let cached: Promise<PgModule> | undefined

export function loadPg(): Promise<PgModule> {
  cached ??= import('pg')
  return cached
}

export type Availability =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string }

/** Is the `pg` driver installed at all? */
export async function pgAvailable(): Promise<Availability> {
  try {
    await loadPg()
    return { ok: true }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      reason:
        `the \`pg\` driver is not installed (${detail}). G98 rules it a ` +
        `devDependency pinned exact; it is not in package.json yet.`,
    }
  }
}
