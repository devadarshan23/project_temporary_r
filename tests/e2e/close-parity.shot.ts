/**
 * C1 PARITY SHOTS — `/close` at 1440×900 against a SEEDED LOCAL PLANE, beside
 * the pack's own `docs/handoff-pack/C1 Close.dc.html` at the same viewport.
 * G3091 (the owner's, 2 Oct 2026): *"Pack-faithful, quiet."* This is the
 * measuring instrument for "pack-faithful": it does not judge, it photographs,
 * and a person compares the two frames side by side.
 *
 * ⚠️ NOT IN THE GATE, DELIBERATELY. The file is `*.shot.ts`, so `npm test`'s
 * `tests/**\/*.test.ts` glob never collects it: a screenshot comparison is a
 * judgement, not an assertion, and a gate stage that cannot fail is a stage
 * that asserts nothing. The properties the screenshots illustrate ARE gated —
 * `tests/app/quiet-unbuilt.test.ts` and `tests/e2e/browser-login.test.ts` §27.
 *
 * Run it (a private PostgreSQL on RECONCILE_DB_PORT, chromium, port 8080 free):
 *
 *   npm run build:frontend
 *   RECONCILE_DB_ADMIN=$USER RECONCILE_DB_PORT=<port> \
 *     node tests/e2e/close-parity.shot.ts <out-dir>
 *
 * It writes `pack-c1.png`, `close.png`, `close-open-row.png` and
 * `close-full.png` into <out-dir> (default: docs/build/screens).
 */
/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import { controlDbPort } from '../control-db-port.ts'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] = process.env['RECONCILE_CLOSE_PARITY_DB_NAME'] ?? runScopedName('reconcile_close_parity')
delete process.env['RECONCILE_LOCAL_TEST_AUTH']
/* The CONTROL roster, so `getSessionPrincipal` names the person and the tenant
   (G3354) and the register knows which lines are the reader's own. */
const CONTROL_DB = process.env['RECONCILE_CLOSE_PARITY_CONTROL_DB_NAME'] ?? runScopedName('reconcile_close_parity_control')
process.env['RECONCILE_CONTROL_DB_NAME'] = CONTROL_DB
process.env['RECONCILE_CONTROL_READ_DB_NAME'] = CONTROL_DB
if ((process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? '') === '') {
  process.env['RECONCILE_CONTROL_DB_ADMIN'] = process.env['USER'] ?? 'postgres'
}

const { reserveFront } = await import('./single-origin.ts')
/* G3911: the kernel chooses the front's port and the socket is HELD from
   here, so every host string below is known before the plane starts and no
   concurrent gate run can take it. It was the literal FRONT_HOST = '127.0.0.1:8080' until 4 Oct 2026. */
const RESERVED_FRONT = await reserveFront()
const FRONT_HOST = RESERVED_FRONT.host
const ACME = 'ten_acme'
process.env['RECONCILE_SERVING_HOSTS'] = `${FRONT_HOST}|${ACME}|ap-southeast-1|delegated|active`

const { resetSchema, seedTwoTenants, migratorClient } = await import('../../db/provision.ts')
const { digestOfHandle } = await import('../../server/data-plane/handle-digest.ts')
const { startDataPlane } = await import('../../server/data-plane/start.ts')
const { CAPABILITIES } = await import('../../model/access.ts')
const { REPO } = await import('../design/render.ts')

const OUT = process.argv[2] ?? join(REPO, 'docs', 'build', 'screens')
const HANDLE = 'parity_operator_6f1d0c3b9a7e4285b1c2d3e4f5a60718'
const SESSION_COOKIE = '__Host-reconcile_session'
const DOOR = 'idc_parity'
const USER = 'usr_parity_operator'
const ROLE = 'rol_parity_operator'

async function controlAdmin(database: string, sql: string): Promise<void> {
  const { default: pg } = await import('pg')
  const c = new pg.Client({
    host: '127.0.0.1',
    port: controlDbPort(),
    database,
    user: process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? 'postgres',
  })
  await c.connect()
  try {
    await c.query(sql)
  } finally {
    await c.end()
  }
}

async function seed(): Promise<void> {
  {
    const { default: pg } = await import('pg')
    const c = new pg.Client({
      host: '127.0.0.1',
      port: controlDbPort(),
      database: 'postgres',
      user: process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? 'postgres',
    })
    await c.connect()
    const has = await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [CONTROL_DB])
    if (has.rowCount === 0) await c.query(`CREATE DATABASE ${CONTROL_DB}`)
    await c.end()
  }
  const { provisionControlPlane } = await import('../../server/control-plane/provision.ts')
  await provisionControlPlane()
  await controlAdmin(
    CONTROL_DB,
    `INSERT INTO tenancy_roster (tenant_id, name, deployment_mode, residency, support_access_mode, plan)
     VALUES ('${ACME}', 'Meridian Group Pte Ltd', 'hosted', 'ap-southeast-1', 'granted_only', NULL)
     ON CONFLICT DO NOTHING`,
  )
  await resetSchema()
  await seedTwoTenants(ACME, 'ten_globex')
  const mig = await migratorClient()
  const q = (sql: string, args: readonly unknown[] = []): Promise<unknown> => mig.query(sql, [...args])
  try {
    await q('BEGIN')
    await q(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id, broker_issuer, broker_ref, status)
       VALUES ($1,'oidc','Parity door','customer',NULL,'acc_acme','https://issuer.parity.invalid','parity','active')`,
      [DOOR],
    )
    await q(
      `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
       VALUES ($1,'operator@acme.invalid','Parity Operator','active',$2)`,
      [USER, DOOR],
    )
    await q(
      `INSERT INTO tenant.role (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
       VALUES ($1,$2,'Operator','operator',1,'operator','tenant',NULL,'active')`,
      [ACME, ROLE],
    )
    for (const c of [CAPABILITIES.admitSource, CAPABILITIES.viewException, CAPABILITIES.assignException]) {
      await q(`INSERT INTO tenant.role_capability (tenant_id, role_id, capability) VALUES ($1,$2,$3)`, [ACME, ROLE, c])
    }
    await q(
      `INSERT INTO tenant.role_assignment
         (tenant_id, id, user_id, role_id, role_version, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1,'ras_parity',$2,$3,1,'bootstrap',now(),NULL,NULL)`,
      [ACME, USER, ROLE],
    )
    await q(
      `INSERT INTO tenant.membership (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1,'mem_parity',$2,$3,'bootstrap',now(),NULL,NULL)`,
      [ACME, USER, ROLE],
    )
    await q(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ('ses_parity',$1,$2,$3,$4,$5,now(),now(),now() + interval '12 hours',NULL)`,
      [digestOfHandle(HANDLE), USER, DOOR, ACME, FRONT_HOST],
    )
    const runs: readonly (readonly [string, string, number, string, string, string, number])[] = [
      ['run_parity_0001', 'def_three_way_match', 4, 'per_2026_09', 'completed', '2026-09-30 03:12:00+00', 5],
      ['run_parity_0002', 'def_three_way_match', 4, 'per_2026_08', 'completed', '2026-08-31 03:10:00+00', 2],
      ['run_parity_0003', 'def_card_settlement', 2, 'per_2026_09', 'completed', '2026-09-30 03:22:00+00', 0],
      ['run_parity_0004', 'def_bank_to_erp', 1, 'per_2026_09', 'incomplete', '2026-09-30 02:40:00+00', 1],
      ['run_parity_0005', 'def_intercompany', 1, 'per_2026_09', 'failed', '2026-09-30 04:58:00+00', 0],
      /* fix/ui-close-surface — a reconciliation that is READING, so the strip's
         light, sweep and working mark (RM-01/02) have a subject. */
      ['run_parity_0006', 'def_bank_to_erp', 1, 'per_2026_09', 'running', '2026-09-30 05:10:00+00', 0],
    ]
    for (const [id, def, v, period, status, at, raised] of runs) {
      await q(
        `INSERT INTO run (tenant_id, id, definition_id, definition_version, period_id, trigger_kind,
                          status, inputs, started_at, finished_at, exceptions_raised)
         VALUES ($1,$2,$3,$4,$5,'scheduled',$6,NULL,$7::timestamptz,
                 CASE WHEN $6 = 'running' THEN NULL ELSE $7::timestamptz + interval '7 minutes' END,$8)`,
        [ACME, id, def, v, period, status, at, raised],
      )
    }
    /* Names (0420) and period dates (0430), so the screen draws no raw id. */
    for (const [def, name] of [
      ['def_three_way_match', 'Three-way match'],
      ['def_card_settlement', 'Card settlement'],
      ['def_bank_to_erp', 'Bank to ERP'],
      ['def_intercompany', 'Intercompany · SEA'],
    ] as const) {
      await q(
        `INSERT INTO tenant.reconciliation_definition (tenant_id, id, version, status, name)
         VALUES ($1,$2,1,'active',$3)`,
        [ACME, def, name],
      )
    }
    await q(
      `INSERT INTO tenant.reconciliation_period (tenant_id, id, status, starts_on, ends_on) VALUES
         ($1,'per_2026_08','closed','2026-08-01','2026-08-31'),
         ($1,'per_2026_09','open','2026-09-01','2026-09-30')`,
      [ACME],
    )
    const findings: readonly (readonly [string, string, string, number, string | null, string, string | null, string])[] = [
      ['exc_parity_0001', 'Three-way match', 'critical', 0, '11220400', 'open', null, 'Invoice total exceeds the goods received by two lines'],
      ['exc_parity_0002', 'Duplicate invoice', 'high', 1, '1295000', 'open', null, 'The same invoice number arrived twice from one supplier'],
      ['exc_parity_0003', 'Unmatched bank line', 'high', 1, '480000', 'investigating', USER, 'A bank credit with no posting against it'],
      ['exc_parity_0006', 'Short shipment', 'medium', 2, '96400', 'open', 'usr_parity_colleague', 'Goods received short of the order by two cartons'],
      ['exc_parity_0004', 'Unreadable docket', 'medium', 2, null, 'pending_approval', null, 'Three dockets the machine could not read'],
      ['exc_parity_0005', 'Price variance', 'low', 3, '1250', 'resolved', null, 'Unit price differs from the order by a rounding cent'],
    ]
    for (const [id, rule, severity, rank, minor, status, who, summary] of findings) {
      await q(
        `INSERT INTO tenant.exception
           (tenant_id, id, match_group_id, rule_id, rule_version, definition_version,
            carried_forward_from, domain, definition_id, rule_label, severity, severity_rank,
            value_at_risk_currency, value_at_risk_minor, value_at_risk_exponent,
            cost_centre, legal_entity, status, assigned_to, raised_at,
            explanation_summary, explanation_expected, run_id)
         VALUES ($1,$2,'mg_parity','rul_parity',1,4,NULL,'finance','def_three_way_match',$3,$4,$5,
                 $6,$7::bigint,$8,'CC-1100','LE-SG',$9,$10,now(),$11,'the purchase order',
                 -- G3626 — the September run raised them (\`0480\`); C1 is run-scoped.
                 'run_parity_0001')`,
        [ACME, id, rule, severity, rank, minor === null ? null : 'SGD', minor, minor === null ? null : 2, status, who, summary],
      )
    }
    await q(
      `INSERT INTO tenant.intake_channel (tenant_id, id, kind, endpoint_id, enabled)
       VALUES ($1,'ich_parity_upload','upload',NULL,true)`,
      [ACME],
    )
    await q('COMMIT')
  } catch (err) {
    await q('ROLLBACK')
    throw err
  } finally {
    await mig.end()
  }
}

await seed()
const plane = await startDataPlane({ poolMax: 4 })
/* `CLOSE_PARITY_DIST` points the same seeded plane at ANOTHER build — how the
   "before" frame of a change is taken against identical data. */
const DIST = process.env['CLOSE_PARITY_DIST'] ?? join(REPO, 'frontend', 'dist')
const PREFIX = process.env['CLOSE_PARITY_PREFIX'] ?? ''
const front = RESERVED_FRONT.serve(DIST, plane.url)
mkdirSync(OUT, { recursive: true })

const { chromium } = await import('playwright')
const browser = await chromium.launch()
try {
  const WIDTHS = [1440, 1024, 820, 390] as const
  for (const width of WIDTHS) {
    const viewport = { width, height: 900 }
    const pack = await browser.newPage({ viewport })
    await pack.goto(pathToFileURL(join(REPO, 'docs', 'handoff-pack', 'C1 Close.dc.html')).href)
    await pack.waitForTimeout(2500)
    await pack.screenshot({ path: join(OUT, width === 1440 ? 'pack-c1.png' : `pack-c1-${String(width)}.png`) })
    await pack.close()

    const ctx = await browser.newContext({ viewport })
    await ctx.addCookies([
      { name: SESSION_COOKIE, value: HANDLE, domain: '127.0.0.1', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
    ])
    const page = await ctx.newPage()
    await page.goto(`${front.origin}/close`, { waitUntil: 'load' })
    await page.waitForFunction(() => !/\breading\b/i.test(document.body.innerText), undefined, { timeout: 15_000 })
    /* The register is SCOPED to the selected reconciliation (RC-03); the
       findings are three-way match's, so select it — as a person would. */
    await page.click('[data-definition="def_three_way_match"]')
    await page.waitForFunction(() => document.querySelector('[data-exception]') !== null && document.querySelector('[data-claim]') !== null, undefined, { timeout: 15_000 })
    await page.waitForTimeout(500)
    const probe = await page.evaluate(() => {
      const lit = document.querySelector('.cell.lit')
      const after = lit === null ? null : getComputedStyle(lit, '::after')
      return {
        scrollWidth: document.documentElement.scrollWidth,
        overflowing: [...document.querySelectorAll('body *')]
          .filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
          .filter((e) => e.closest('.reg') === null)
          .slice(0, 6)
          .map((e) => `${e.tagName.toLowerCase()}.${(e.getAttribute('class') ?? '').split(' ')[0]}:${Math.round(e.getBoundingClientRect().right)}`),
        lit: lit?.getAttribute('data-definition') ?? null,
        litImage: lit === null ? null : getComputedStyle(lit).backgroundImage.slice(0, 40),
        sweep: after === null ? null : `${after.animationName} ${after.animationDuration}`,
        mascot: document.querySelector('.cell .mascot[data-energy="working"] .d1') === null
          ? null
          : getComputedStyle(document.querySelector('.cell .mascot[data-energy="working"] .d1') as Element).animationName,
        claim: document.querySelector('[data-claim]')?.textContent ?? null,
        needsYou: document.querySelector('[data-needs-you]')?.getAttribute('data-needs-you') ?? null,
        acts: [...document.querySelectorAll('[data-exception] [data-act]')].map((c) => c.getAttribute('data-act')),
      }
    })
    process.stdout.write(`${String(width)}: ${JSON.stringify(probe)}\n`)
    const suffix = width === 1440 ? '' : `-${String(width)}`
    await page.screenshot({ path: join(OUT, `${PREFIX}close${suffix}.png`) })
    if (width === 1440) {
      /* A full-page capture paints a `position: sticky` bar at the VIEWPORT's
         bottom, over the content, so the full frames release it. */
      await page.addStyleTag({ content: '.statusbar{position:static !important}' })
      await page.screenshot({ path: join(OUT, `${PREFIX}close-full.png`), fullPage: true })
      if ((await page.$('[data-exception="exc_parity_0001"] td.what')) !== null) {
        await page.click('[data-exception="exc_parity_0001"] td.what')
      }
      await page.waitForFunction(() => document.querySelector('.evid.lit') !== null, undefined, { timeout: 15_000 })
      await page.waitForTimeout(400)
      await page.screenshot({ path: join(OUT, `${PREFIX}close-open-row.png`), fullPage: true })
    }
    await ctx.close()
  }
  process.stdout.write(`wrote frames to ${OUT}\n`)
} finally {
  await browser.close()
  await front.close()
  await plane.close()
}
