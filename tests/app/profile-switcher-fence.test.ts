/**
 * G3003 — THE STAGING PROFILE SWITCHER IS ABSENT FROM EVERY BUNDLE BUT A TEST
 * BUILD'S, AND THAT IS READ OFF THE BUNDLE RATHER THAN OFF THE SOURCE.
 *
 * The owner's ruling G2771 put a public test login on STAGING. The switcher
 * and its persona catalogue (`infra/lib/mock-personas.ts`) must therefore not
 * exist in a production bundle at all — hidden is not absent. The gate's own
 * `npm run build:frontend` runs with no `RECONCILE_TEST_PERSONAS`, which is
 * exactly what a production build is, so ITS output is the witness.
 *
 *   §1  the gate's bundle carries no mock address, no persona subject, no
 *       mock client id and no switcher marker — and each needle IS in the
 *       source, so the search is not vacuous.
 *   §2  the compile-time constant is `true` for exactly `on`, in the config.
 *   §3  the switcher renders nothing unless the constant is true, and the
 *       sign-in screen honours a hint only through the catalogue.
 *
 * The positive control — a FLAGGED build that DOES carry the switcher, and a
 * browser that uses it — is `tests/e2e/profile-switcher.test.ts`.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { MOCK_DOORS, MOCK_IDENTITY_DOMAIN, MOCK_PERSONAS } from '../../infra/lib/mock-personas.ts'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIST = join(REPO, 'frontend', 'dist')

const NEEDLES: readonly string[] = [
  MOCK_IDENTITY_DOMAIN,
  ...MOCK_PERSONAS.map((p) => p.sub),
  ...Object.values(MOCK_DOORS).map((d) => d.clientId),
  'data-profile-switcher',
]

function bundleFiles(): readonly string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name)
      if (e.isDirectory()) walk(full)
      else if (/\.(js|html|css|json)$/.test(e.name)) out.push(full)
    }
  }
  walk(DIST)
  return out
}

const built = existsSync(join(DIST, 'index.html'))
const ci = process.env['CI'] !== undefined && process.env['CI'] !== ''

describe('the profile switcher is compiled out of every non-test bundle', () => {
  it('§1 · the gate’s bundle carries no persona, no mock address and no switcher', (t) => {
    if (!built) {
      if (ci) assert.fail('frontend/dist is absent under CI — `npm run check` builds it before `npm test`')
      t.skip('frontend/dist is absent — run `npm run build:frontend`')
      return
    }
    const sources =
      readFileSync(join(REPO, 'infra', 'lib', 'mock-personas.ts'), 'utf8') +
      readFileSync(join(REPO, 'frontend', 'src', 'components', 'ProfileSwitcher.tsx'), 'utf8')
    for (const needle of NEEDLES) {
      assert.ok(sources.includes(needle), `the needle \`${needle}\` is in no source — the search below would be vacuous`)
    }
    const files = bundleFiles()
    assert.ok(files.length > 0, 'the bundle has no files')
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      for (const needle of NEEDLES) {
        assert.ok(
          !text.includes(needle),
          `${file.slice(REPO.length + 1)} carries \`${needle}\` — the staging test personas reached a bundle built without RECONCILE_TEST_PERSONAS=on`,
        )
      }
    }
  })

  it('§2 · the constant is true for exactly `on`', () => {
    const config = readFileSync(join(REPO, 'frontend', 'vite.config.ts'), 'utf8')
    assert.match(
      config,
      /__RECONCILE_TEST_PERSONAS__: JSON\.stringify\(process\.env\['RECONCILE_TEST_PERSONAS'\] === 'on'\)/,
      'the switcher constant is no longer exactly `RECONCILE_TEST_PERSONAS === "on"`',
    )
  })

  it('§3 · the switcher renders nothing unless the constant is true; the hint goes through the catalogue', () => {
    const switcher = readFileSync(join(REPO, 'frontend', 'src', 'components', 'ProfileSwitcher.tsx'), 'utf8')
    assert.match(switcher, /if \(!TEST_PERSONAS_ENABLED\) return null/)
    const signIn = readFileSync(join(REPO, 'frontend', 'src', 'components', 'SignIn.tsx'), 'utf8')
    assert.match(signIn, /testPersonaByEmail\(/)
    assert.doesNotMatch(signIn, /get\('login_hint'\)\s*\?\?/, 'the sign-in screen takes a raw hint as an address')
    const personas = readFileSync(join(REPO, 'frontend', 'src', 'test-personas.ts'), 'utf8')
    assert.match(personas, /if \(!TEST_PERSONAS_ENABLED \|\| email === null\) return null/)
  })
})
