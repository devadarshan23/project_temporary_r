/**
 * EVERY CONNECTION IN THE PRODUCT DECIDES TLS THE SAME WAY, AND THIS EXISTS
 * BECAUSE SIX SITES EACH OMITTED IT AND TWO OF THEM WERE FOUND BY A PIPELINE.
 *
 * Aurora refuses an unencrypted connection:
 *
 *     FATAL: no pg_hba.conf entry for host "10.40.19.178",
 *     user "reconcile_control_admin", database "reconcile_control",
 *     NO ENCRYPTION
 *
 * Every `Client` and `Pool` here was written against a disposable LOCAL
 * PostgreSQL, where `ssl` unset is correct and harmless. There were FOUR in
 * `db/` and TWO more in `server/control-plane/` that bypass `db/` entirely —
 * deliberately, because that plane must not reach `db/tenant-scope.ts`. Fixing
 * four made the migration fail in exactly the same way, because the two that
 * matter were the other ones.
 *
 * 🛑 SO THE RULE IS NOT "REMEMBER TO SET ssl". It is that every construction
 * site calls the ONE function that decides, and this test is what makes a
 * seventh site impossible to add quietly. Same shape G111 demands of the money
 * codec: *"correctness that lives at call sites is correctness that drifts."*
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Every `.ts` under a directory, recursively. */
function sources(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(join(REPO, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`
    if (e.isDirectory()) out.push(...sources(rel))
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(rel)
  }
  return out
}

describe('every pg connection decides TLS through one function', () => {
  it('no Client or Pool is constructed without ssl: dbSsl(...)', () => {
    const offenders: string[] = []
    for (const rel of [...sources('db'), ...sources('server')]) {
      const text = readFileSync(join(REPO, rel), 'utf8')
      for (const m of text.matchAll(/new (?:Pg)?(?:Pool|Client)\(\{([\s\S]*?)\n\s*\}\)/g)) {
        const body = m[1] ?? ''
        if (!body.includes('ssl:')) {
          offenders.push(`${rel} — a connection is constructed with no ssl option`)
        } else if (!body.includes('dbSsl(')) {
          offenders.push(`${rel} — sets ssl without calling dbSsl(); one decision, not many`)
        }
      }
    }
    assert.deepEqual(
      offenders,
      [],
      'Aurora refuses an unencrypted connection, and a site that decides TLS for ' +
        'itself is a site that will decide it differently. Call `dbSsl(host)` ' +
        `from db/env.ts.\n  ${offenders.join('\n  ')}`,
    )
  })

  it('dbSsl encrypts for a real host and does not for loopback', async () => {
    const { dbSsl } = await import('../../db/env.ts')
    assert.equal(dbSsl('127.0.0.1'), false, 'the disposable local database takes no TLS')
    assert.equal(dbSsl('localhost'), false)
    assert.deepEqual(
      dbSsl('reconcile-staging-data.cluster-abc.us-west-2.rds.amazonaws.com'),
      { rejectUnauthorized: false },
      'a real host must encrypt — and this FAILS CLOSED: an unrecognised host ' +
        'gets encryption it did not ask for rather than plaintext nobody notices',
    )
  })
})
