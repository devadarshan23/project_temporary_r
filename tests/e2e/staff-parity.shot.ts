/**
 * S1 PARITY SHOTS — the staff console on a console host at 1440×900 against a
 * SEEDED LOCAL PLANE AND CONTROL DATABASE, beside the pack's own
 * `docs/handoff-pack/S1 Staff.dc.html` at the same viewport (G3327).
 *
 * ⚠️ NOT IN THE GATE, DELIBERATELY, for `close-parity.shot.ts`'s reason: the
 * file is `*.shot.ts`, so `npm test` never collects it. A screenshot is a
 * judgement, not an assertion; the properties are gated by
 * `tests/e2e/staff-console.test.ts`.
 *
 * Run it (a private PostgreSQL, chromium, port 8080 free):
 *
 *   npm run build:frontend
 *   RECONCILE_DB_ADMIN=$USER RECONCILE_CONTROL_DB_ADMIN=$USER \
 *   RECONCILE_DB_PORT=<port> RECONCILE_CONTROL_DB_PORT=<port> \
 *   RECONCILE_CONTROL_READ_DB_PORT=<port> RECONCILE_CONTROL_WRITE_DB_PORT=<port> \
 *     node tests/e2e/staff-parity.shot.ts <out-dir>
 *
 * Writes `pack-s1.png`, `staff-tenants.png`, `staff-tenant.png` and
 * `staff-force.png` into <out-dir> (default
 * docs/build/screens).
 */
/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import { controlDbPort } from '../control-db-port.ts'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { runScopedName } from '../run-scoped-db.ts'

const CONTROL_DB = process.env['RECONCILE_STAFF_PARITY_CONTROL_DB_NAME'] ?? runScopedName('reconcile_staff_parity_control')
process.env['RECONCILE_DB_NAME'] = process.env['RECONCILE_STAFF_PARITY_DB_NAME'] ?? runScopedName('reconcile_staff_parity')
process.env['RECONCILE_CONTROL_DB_NAME'] = CONTROL_DB
process.env['RECONCILE_CONTROL_READ_DB_NAME'] = CONTROL_DB
process.env['RECONCILE_CONTROL_WRITE_DB_NAME'] = CONTROL_DB
if ((process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? '') === '') {
  process.env['RECONCILE_CONTROL_DB_ADMIN'] = process.env['USER'] ?? 'postgres'
}
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

const { reserveFront } = await import('./single-origin.ts')
/* G3911: the kernel chooses the front's port and the socket is HELD from
   here, so every host string below is known before the plane starts and no
   concurrent gate run can take it. It was the literal FRONT_PORT = 8080 until 4 Oct 2026. */
const RESERVED_FRONT = await reserveFront()
const FRONT_PORT = RESERVED_FRONT.port
const CONSOLE_HOST = `console.localhost:${FRONT_PORT}`
process.env['RECONCILE_SERVING_HOSTS'] = `ten-acme.us-west-2.localhost:${FRONT_PORT}|ten_acme|us-west-2|pooled|active`
process.env['RECONCILE_CONSOLE_HOSTS'] = `${CONSOLE_HOST}|staff|active`

const { loadPg } = await import('../../db/pg.ts')
const { resetSchema, migratorClient } = await import('../../db/provision.ts')
const { digestOfHandle } = await import('../../server/data-plane/handle-digest.ts')
const { startDataPlane } = await import('../../server/data-plane/start.ts')
const { provisionControlPlane, seedTenancyRoster } = await import('../../server/control-plane/provision.ts')
const { CAPABILITIES } = await import('../../model/access.ts')
const { REPO } = await import('../design/render.ts')

const OUT = process.argv[2] ?? join(REPO, 'docs', 'build', 'screens')
const HANDLE = 'parity_staff_3b1e0d9c7a6f4258b1c2d3e4f5a60719'
const SESSION_COOKIE = '__Host-reconcile_session'
const DOOR = 'idc_parity_1ch'
const USER = 'usr_parity_fde'
const ROLE = 'prl_parity_fleet'

async function rebuildControl(): Promise<void> {
  const { Client } = await loadPg()
  const admin = new Client({
    host: '127.0.0.1',
    port: controlDbPort(),
    database: 'postgres',
    user: process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? 'postgres',
  })
  await admin.connect()
  try {
    await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [CONTROL_DB])
    await admin.query(`DROP DATABASE IF EXISTS ${CONTROL_DB}`)
    await admin.query(`CREATE DATABASE ${CONTROL_DB}`)
  } finally {
    await admin.end()
  }
  await provisionControlPlane()
  await seedTenancyRoster()
}

async function seedSession(): Promise<void> {
  await resetSchema()
  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')
    await mig.query(
      `INSERT INTO tenant.identity_connection (id, protocol, label, owner_kind, owner_partner_id, owner_account_id, broker_issuer, broker_ref, status)
       VALUES ($1,'oidc','1CloudHub parity door','platform',NULL,NULL,'https://issuer.parity.invalid','parity-1ch','active')`,
      [DOOR],
    )
    await mig.query(
      `INSERT INTO tenant."user" (id, email, display_name, status, connection_id) VALUES ($1,'fde@1cloudhub.invalid','Parity FDE','active',$2)`,
      [USER, DOOR],
    )
    await mig.query(
      `INSERT INTO tenant.platform_role (id, label, key, version, stakeholder_class, status) VALUES ($1,'Fleet','fleet',1,'platform','active')`,
      [ROLE],
    )
    await mig.query(`INSERT INTO tenant.platform_role_capability (role_id, capability) VALUES ($1,$2)`, [ROLE, CAPABILITIES.viewSubstrate])
    await mig.query(
      `INSERT INTO tenant.platform_role_assignment (id, user_id, role_id, role_version, granted_by, granted_at, expires_at, revoked_at)
       VALUES ('pra_parity',$1,$2,1,'bootstrap',now(),now() + interval '8 hours',NULL)`,
      [USER, ROLE],
    )
    await mig.query(
      `INSERT INTO tenant.session (id, handle_digest, user_id, connection_id, tenant_id, issued_host, authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ('ses_parity_staff',$1,$2,$3,NULL,$4,now(),now(),now() + interval '12 hours',NULL)`,
      [digestOfHandle(HANDLE), USER, DOOR, CONSOLE_HOST],
    )
    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK')
    throw err
  } finally {
    await mig.end()
  }
}

await rebuildControl()
await seedSession()
const plane = await startDataPlane({ poolMax: 4 })
const DIST = process.env['STAFF_PARITY_DIST'] ?? join(REPO, 'frontend', 'dist')
const front = RESERVED_FRONT.serve(DIST, plane.url)
mkdirSync(OUT, { recursive: true })

const { chromium } = await import('playwright')
const browser = await chromium.launch()
try {
  const viewport = { width: 1440, height: 900 }

  const pack = await browser.newPage({ viewport })
  await pack.goto(pathToFileURL(join(REPO, 'docs', 'handoff-pack', 'S1 Staff.dc.html')).href)
  await pack.waitForTimeout(2500)
  await pack.screenshot({ path: join(OUT, 'pack-s1.png') })

  const ctx = await browser.newContext({ viewport })
  await ctx.addCookies([
    { name: SESSION_COOKIE, value: HANDLE, domain: 'console.localhost', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
  ])
  const page = await ctx.newPage()
  await page.goto(`http://${CONSOLE_HOST}/`, { waitUntil: 'load' })
  await page.waitForSelector('[data-tenancy] [data-tenant]', { timeout: 15_000 })
  const width = await page.evaluate(() => document.documentElement.scrollWidth)
  process.stdout.write(`document scrollWidth at a 1440 viewport: ${width}\n`)
  await page.screenshot({ path: join(OUT, 'staff-tenants.png') })
  /* A full-page capture paints a sticky bar over the content; release it. */
  await page.addStyleTag({ content: '.statusbar{position:static !important}' })
  await page.click('[data-open-tenant="ten_borealis"]')
  await page.waitForSelector('[data-onboarding] tr[data-step]', { timeout: 15_000 })
  await page.screenshot({ path: join(OUT, 'staff-tenant.png'), fullPage: true })
  await page.click('[data-back]')
  await page.click('[data-open-tenant="ten_cardinal"]')
  await page.waitForSelector('[data-force]', { timeout: 15_000 })
  await page.click('[data-force="extraction_floor"]')
  await page.fill('[data-force-reason]', 'the customer has no documents yet')
  await page.screenshot({ path: join(OUT, 'staff-force.png'), fullPage: true })
  process.stdout.write(`wrote frames to ${OUT}\n`)
} finally {
  await browser.close()
  await front.close()
  await plane.close()
}
