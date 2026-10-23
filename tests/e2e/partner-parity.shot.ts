/**
 * P1 PARITY SHOTS — the partner portal at 1440×900 on a SEEDED LOCAL PLANE,
 * served on a partner host, beside the pack's own
 * `docs/handoff-pack/P1 Partner.dc.html` at the same viewport. G3299,
 * 3 Oct 2026 — `close-parity.shot.ts`'s instrument, pointed at P1.
 *
 * ⚠️ NOT IN THE GATE, DELIBERATELY. The file is `*.shot.ts`, so `npm test`'s
 * glob never collects it: a screenshot comparison is a judgement, not an
 * assertion. The properties it illustrates ARE gated —
 * `tests/e2e/profile-switcher.test.ts` §3b drives the portal in a real browser
 * through the production authoriser, and `tests/app/quiet-unbuilt.test.ts`
 * holds the portal's source quiet.
 *
 * Run it (a private PostgreSQL on RECONCILE_DB_PORT, chromium, port 8092 free):
 *
 *   npm run build:frontend
 *   RECONCILE_DB_ADMIN=$USER RECONCILE_DB_PORT=<port> \
 *     node tests/e2e/partner-parity.shot.ts <out-dir>
 *
 * It writes `pack-p1.png` and `after-partner-{deals,register,sandbox,people}.png`
 * into <out-dir> (default:
 * docs/build/screens). `PARTNER_PARITY_DIST` points the same plane at another
 * build and `PARTNER_PARITY_PREFIX` prefixes the frames — how the "before"
 * frame of a change is taken against identical data.
 *
 * 🛑 THE SEEDED ROWS ARE ILLUSTRATIVE AND SAY SO IN THEIR OWN NAMES — this is a
 * local fixture, never a figure anybody may quote (PRODUCT.md).
 */
/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import '../control-db-port.ts'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] = process.env['RECONCILE_PARTNER_PARITY_DB_NAME'] ?? runScopedName('reconcile_partner_parity')
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

/* G3911: the kernel chooses the front's port and the socket is HELD from
   here, so every host string below is known before the plane starts and no
   concurrent gate run can take it. It was the literal 8092 until 4 Oct 2026. */
const { reserveFront } = await import('./single-origin.ts')
const RESERVED_FRONT = await reserveFront()
const PORT = RESERVED_FRONT.port
const PARTNERS_HOST = `partners.localhost:${PORT}`
process.env['RECONCILE_SERVING_HOSTS'] = `ten-acme.localhost:${PORT}|ten_acme|ap-southeast-1|delegated|active`
process.env['RECONCILE_CONSOLE_HOSTS'] = `${PARTNERS_HOST}|partner|active`

const { resetSchema, seedTwoTenants, migratorClient } = await import('../../db/provision.ts')
const { startDataPlane } = await import('../../server/data-plane/start.ts')
const { REPO } = await import('../design/render.ts')
const { seedPartnerPortal, HANDLES, NORTHWIND } = await import('../db/partner-fixture.ts')

const OUT = process.argv[2] ?? join(REPO, 'docs', 'build', 'screens')
const SESSION_COOKIE = '__Host-reconcile_session'

async function seed(): Promise<void> {
  await resetSchema()
  await seedTwoTenants('ten_acme', 'ten_globex')
  await seedPartnerPortal()
  const mig = await migratorClient()
  try {
    /* ANA is the fixture's partner administrator; her session is re-issued on
       THIS partner host, because G180 binds a session to the host that issued
       it and the browser presents it here. */
    await mig.query(`UPDATE tenant.session SET issued_host = $1 WHERE id = 'ses_ana'`, [PARTNERS_HOST])
    const deals: readonly (readonly [string, string, string, string, string])[] = [
      ['dreg_parity_1', 'deal', 'Illustrative Prospect A', '6 days', 'accepted'],
      ['dreg_parity_2', 'deal', 'Illustrative Prospect B', '3 days', 'waiting'],
      ['dreg_parity_3', 'customer_claim', 'Illustrative Prospect C', '40 days', 'dormant'],
    ]
    for (const [id, shape, company, ago, standing] of deals) {
      await mig.query(
        `INSERT INTO tenant.deal_registration (id, partner_id, shape, company, submitted_by, received_at, standing)
         VALUES ($1, $2, $3, $4, 'parity_seed', now() - $5::interval, $6)`,
        [id, NORTHWIND, shape, company, ago, standing],
      )
    }
  } finally {
    await mig.end()
  }
}

await seed()
const plane = await startDataPlane({ poolMax: 4 })
const DIST = process.env['PARTNER_PARITY_DIST'] ?? join(REPO, 'frontend', 'dist')
const PREFIX = process.env['PARTNER_PARITY_PREFIX'] ?? 'after-'
const front = RESERVED_FRONT.serve(DIST, plane.url)
mkdirSync(OUT, { recursive: true })

const { chromium } = await import('playwright')
const browser = await chromium.launch()
try {
  const viewport = { width: 1440, height: 900 }

  if (PREFIX === 'after-') {
    const pack = await browser.newPage({ viewport })
    await pack.goto(pathToFileURL(join(REPO, 'docs', 'handoff-pack', 'P1 Partner.dc.html')).href)
    await pack.waitForTimeout(2500)
    await pack.screenshot({ path: join(OUT, 'pack-p1.png') })
  }

  const ctx = await browser.newContext({ viewport })
  await ctx.addCookies([
    { name: SESSION_COOKIE, value: HANDLES.ana, domain: 'partners.localhost', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
  ])
  const page = await ctx.newPage()
  const settle = async (): Promise<void> => {
    await page.waitForFunction(() => !/\bReading\b/.test(document.body.innerText), undefined, { timeout: 15_000 })
    await page.waitForTimeout(400)
  }

  await page.goto(`http://${PARTNERS_HOST}/`, { waitUntil: 'load' })
  await settle()
  const width = await page.evaluate(() => document.documentElement.scrollWidth)
  process.stdout.write(`document scrollWidth at a 1440 viewport: ${String(width)}\n`)
  await page.screenshot({ path: join(OUT, `${PREFIX}partner-deals.png`) })
  if (PREFIX !== 'after-') {
    process.stdout.write(`wrote the "before" frame to ${OUT}\n`)
  } else {
    await page.click('[data-register-open]')
    await page.fill('[data-register-form] input[name="company"]', 'Illustrative Prospect D')
    await page.fill('[data-register-form] input[name="annualValue"]', '180,000')
    await page.fill('[data-register-form] input[name="expectedClose"]', '30 Nov 2026')
    await page.screenshot({ path: join(OUT, 'after-partner-register.png') })
    await page.goto(`http://${PARTNERS_HOST}/partner/sandbox`, { waitUntil: 'load' })
    await settle()
    await page.screenshot({ path: join(OUT, 'after-partner-sandbox.png') })
    await page.goto(`http://${PARTNERS_HOST}/partner/people`, { waitUntil: 'load' })
    await settle()
    await page.screenshot({ path: join(OUT, 'after-partner-people.png') })
    process.stdout.write(`wrote five frames to ${OUT}\n`)
  }
} finally {
  await browser.close()
  await front.close()
  await plane.close()
}
