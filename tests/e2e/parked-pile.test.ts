/**
 * C9 · THE PARKED PILE, IN A REAL BROWSER, AGAINST A REAL PLANE — rows 18 and
 * 19, feat/ui-parked-pile (G3501–G3510, 3 Oct 2026).
 *
 * The wire was built and served by G2831–G2840 and drawn by nothing. This is
 * the journey that draws it, with the PRODUCTION authoriser (`startDataPlane()`
 * is handed no `authorise` and no `substrate`) and real row-level security:
 *
 *   §1  an administrator opens `/close` — the pile is a line of its own,
 *       counted APART from the register (the register shows no line for it),
 *       and every filename is TEXT, markup-shaped ones included.
 *   §2  the line opens ONE pane about that delivery: the sample's KEYS and no
 *       value (G106), why it is parked, who unblocks it — and the raise, which
 *       is a real `raiseParkedArrival` that lands a row and leaves the delivery
 *       parked.
 *   §3  a clerk WITHOUT `configure_endpoint` still follows the line (row 19)
 *       and is offered NO raise: the session's published capabilities do not
 *       hold the verb, and the control is omitted rather than drawn refused
 *       (G3193's shape).
 *       ⚠️ THIS SAID *"the gate answered 403 to the probe"* UNTIL 4 Oct 2026 —
 *       G3781 deleted the empty-body probe (G3504/G3505) for
 *       `getSessionPrincipal.capabilities` (G3521, the owner's G3664). §3 now
 *       asserts NO escalation request leaves the browser at all.
 *       ⚠️ WITNESSED RED (4 Oct 2026): with `Raise`'s `may` widened to
 *       `holdsRaise || !refused`, §3 and §6 failed with `the clerk was offered
 *       a raise the gate refuses`.
 *   §4  a delivery that is not a record says so — no mapping can apply.
 *   §5  BOTH PLACES (row 18, G3782): the administrator opens `/setup`, the
 *       same pile is drawn there, and "Declare a pairing" opens the source's
 *       pair form SEEDED from the delivery; declaring it is a real
 *       `declareEndpointDocumentType` whose 201 DRAINS the delivery (G2837),
 *       and the pile re-reads to say so.
 *       ⚠️ WITNESSED RED: with Setup's `offersPairing` answering false, §5
 *       timed out waiting for `[data-declare-pairing]`.
 *   §6  the clerk on `/setup` still follows the line and is offered neither
 *       the raise nor the pairing.
 *   §7–§10  THE NARROW TIER (G4071–G4077, 4 Oct 2026), riding this fixture:
 *       Setup at 390 with the pair form open (§7), the Close status bar as
 *       one tappable row that opens a sheet (§8), unchanged at 1440 (§9), and
 *       a `todo` for the closed tooltip that still widens Close (§10, G4077).
 *       ⚠️ NO LONGER A `todo` SINCE G4091: §10 is a real assertion and §10b
 *       opens every tooltip on Close at 390 and requires it inside the viewport.
 *   §10c–§10d  WHAT G4091 DID NOT CLOSE (G4097), closed under U-25
 *       (G4187–G4188): a 34ch panel on a mid-row trigger at 240/260/330 is
 *       shifted inside the viewport, and a panel at the viewport's foot opens
 *       upward — light and dark.
 *       ⚠️ WITNESSED RED: §7 *"Setup scrolls sideways at 390: scrollWidth
 *       758"*; §8 *"the three-slot status bar is drawn inline at 390 — the
 *       pack draws one tappable row"*.
 *
 *   §7b–§7c  U-26 (G4171–G4174): each Setup form is a `.reasons` block under
 *       the pane head, at 390 and 1440, light and dark, and focus follows it.
 *   §11  U-28 (G4175–G4177): a picker tells apart two types sharing a label.
 *
 * ⚠️ IT STANDS UP A CONTROL DATABASE SINCE G3781: `getSessionPrincipal` —
 * whose capabilities now decide whether the raise is DRAWN — reads the bound
 * tenant's name through the read-only control pool (`register-acts.test.ts`'s
 * shape).
 *
 * Its own database and its own port (8097): `node --test` runs files at once,
 * and 8080 and 8091–8094 are held by other suites (8094 by an audit screenshot script, measured).
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import { controlDbPort } from '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { request as httpRequest } from 'node:http'
import { join } from 'node:path'

import { databaseRequiredUnderCi, browserRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { loadPg } from '../../db/pg.ts'
import { provisionControlPlane } from '../../server/control-plane/provision.ts'
import { fieldPathKey, parseFieldPath } from '../../model/field-path.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope } from '../../db/tenant-scope.ts'
import { digestOfHandle } from '../../server/data-plane/handle-digest.ts'
import { startDataPlane } from '../../server/data-plane/start.ts'
import { admitClassifyAndStoreArrival } from '../../server/data-plane/payload-store.ts'
import { CAPABILITIES } from '../../model/access.ts'
import { arrivalFilenameFrom, type ArrivalFacts } from '../../model/ingestion.ts'
import { browserSkip, closeBrowser, REPO } from '../design/render.ts'
import { reserveFront, type Front } from './single-origin.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] = process.env['RECONCILE_PARKED_E2E_DB_NAME'] ?? runScopedName('reconcile_parked_pile_e2e_test')
delete process.env['RECONCILE_LOCAL_TEST_AUTH']
const CONTROL_DB = process.env['RECONCILE_PARKED_E2E_CONTROL_DB_NAME'] ?? runScopedName('reconcile_parked_pile_control_test')
process.env['RECONCILE_CONTROL_DB_NAME'] = CONTROL_DB
process.env['RECONCILE_CONTROL_READ_DB_NAME'] = CONTROL_DB
if ((process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? '') === '') {
  process.env['RECONCILE_CONTROL_DB_ADMIN'] = process.env['USER'] ?? 'postgres'
}

/* G3911: the kernel chooses the front's port and the socket is HELD from
   here, so every host string below is known before the plane starts and no
   concurrent gate run can take it. It was the literal 8097 until 4 Oct 2026. */
const RESERVED_FRONT = await reserveFront()
const PORT = RESERVED_FRONT.port
const HOST = `127.0.0.1:${PORT}`
const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
process.env['RECONCILE_SERVING_HOSTS'] = `${HOST}|${ACME}|ap-southeast-1|delegated|active`

const SESSION_COOKIE = '__Host-reconcile_session'
const DOOR = 'idc_acme_parked_e2e'
const ADMIN = 'usr_acme_parked_e2e_admin'
const CLERK = 'usr_acme_parked_e2e_clerk'
const ADMIN_HANDLE = 'e2e_parked_admin_7c1d93e4a5b64f2e8d0a1b2c3d4e5f60'
const CLERK_HANDLE = 'e2e_parked_clerk_2a9e81f3c4d54b6a9e7f0c1d2b3a4e59'
const TYPE = 'dty_acme_e2e_invoice'
const STANDING = 'agr_standing_parked_e2e'
const BOUND = '2099-01-01T00:00:00.000Z'
const PIN = `SHA256:${'Zq'.repeat(21)}Z`
/** In a held artefact, which no `FieldSpec` addresses — never on a screen (G106). */
const HELD_VALUE = 'held-value-3e7a91c2-never-drawn'
const MARKUP_NAME = 'misc/<b>bold</b> & <img src=x onerror=alert(1)>.txt'

const DIST = join(REPO, 'frontend', 'dist')

const probe = await probeDatabase()
const dbSkip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
const browserWhy = await browserSkip()
databaseRequiredUnderCi('the parked-pile browser suite', probe)
browserRequiredUnderCi('the parked-pile browser suite', browserWhy)
after(async () => { await closeBrowser() })
const skip = dbSkip !== false ? dbSkip : browserWhy !== false ? browserWhy : false

interface Response {
  url(): string
  status(): number
  request(): { method(): string }
}
interface Request {
  url(): string
  method(): string
}
interface Page {
  on(event: 'request', fn: (r: Request) => void): void
  goto(url: string, o?: unknown): Promise<unknown>
  click(selector: string): Promise<void>
  fill(selector: string, value: string): Promise<void>
  waitForSelector(selector: string, o?: unknown): Promise<unknown>
  waitForFunction(fn: unknown, arg?: unknown, o?: unknown): Promise<unknown>
  waitForResponse(pred: (r: Response) => boolean, o?: unknown): Promise<Response>
  keyboard: { press(key: string): Promise<void> }
  evaluate<T>(fn: unknown, arg?: unknown): Promise<T>
}
interface Ctx {
  newPage(): Promise<Page>
  addCookies(cookies: readonly unknown[]): Promise<void>
  close(): Promise<void>
}
interface Br {
  newContext(o?: unknown): Promise<Ctx>
  close(): Promise<void>
}

type Q = (sql: string, p?: readonly unknown[]) => Promise<{ rows: unknown[] }>
async function asMigrator<T>(fn: (q: Q) => Promise<T>): Promise<T> {
  const mig = await migratorClient()
  try {
    return await fn((sql, p = []) => mig.query(sql, p as unknown[]) as Promise<{ rows: unknown[] }>)
  } finally {
    await mig.end()
  }
}

function mustKey(tokens: readonly string[]): string {
  const p = parseFieldPath(tokens)
  if (!p.ok) throw new Error(`fixture path ${JSON.stringify(tokens)} refused`)
  return fieldPathKey(p.path)
}
const NUMBER = mustKey(['invoice', 'number'])
const PAYER = mustKey(['invoice', 'payer'])

async function freshControlDatabase(): Promise<void> {
  const { Client } = await loadPg()
  const c = new Client({
    host: '127.0.0.1',
    port: controlDbPort(),
    database: 'postgres',
    user: process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? 'postgres',
    application_name: 'reconcile-parked-pile-setup',
  })
  await c.connect()
  try {
    await c.query(`DROP DATABASE IF EXISTS ${CONTROL_DB} WITH (FORCE)`)
    await c.query(`CREATE DATABASE ${CONTROL_DB}`)
  } finally {
    await c.end()
  }
  await provisionControlPlane()
}

async function seedSubstrate(): Promise<void> {
  await asMigrator(async (q) => {
    await q('BEGIN')
    await q(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id, broker_issuer, broker_ref, status)
       VALUES ($1, 'oidc', 'Acme Entra ID', 'customer', NULL, 'acc_acme', 'https://login.microsoftonline.com/parked-e2e/v2.0', 'acme-parked-e2e', 'active')`,
      [DOOR],
    )
    for (const [user, name, role, caps, handle, i] of [
      [ADMIN, 'Acme Administrator', 'rol_parked_e2e_admin',
        [CAPABILITIES.configureEndpoint, CAPABILITIES.viewEndpoint, CAPABILITIES.viewException], ADMIN_HANDLE, 0],
      /* 🛑 THE CLERK CANNOT ACT AND STILL FOLLOWS THE LINE — row 19. */
      [CLERK, 'Acme Clerk', 'rol_parked_e2e_clerk', [CAPABILITIES.viewException], CLERK_HANDLE, 1],
    ] as const) {
      await q(
        `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
         VALUES ($1, $1 || '@invalid', $2, 'active', $3)`,
        [user, name, DOOR],
      )
      await q(
        `INSERT INTO tenant.role (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
         VALUES ($1, $2, $2, $2, 1, 'administrator', 'tenant', NULL, 'active')`,
        [ACME, role],
      )
      for (const c of caps) {
        await q('INSERT INTO tenant.role_capability (tenant_id, role_id, capability) VALUES ($1, $2, $3)', [ACME, role, c])
      }
      await q(
        `INSERT INTO tenant.role_assignment
           (tenant_id, id, user_id, role_id, role_version, granted_by, granted_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, 1, 'bootstrap', now(), NULL, NULL)`,
        [ACME, `ras_${user}`, user, role],
      )
      await q(
        `INSERT INTO tenant.membership
           (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, 'bootstrap', now(), NULL, NULL)`,
        [ACME, `mem_${user}`, user, role],
      )
      await q(
        `INSERT INTO tenant.session
           (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
            authenticated_at, last_used_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, $5, $6, now(), now(), now() + interval '12 hours', NULL)`,
        [`ses_parked_e2e_${i}`, digestOfHandle(handle), user, DOOR, ACME, HOST],
      )
    }
    await q(
      `INSERT INTO tenant.document_type (tenant_id, id, key, label, domain, expected_fidelity, carries_control_total)
       VALUES ($1, $2, 'ap.invoice', 'Supplier invoice', 'finance', 'structured', 'never')`,
      [ACME, TYPE],
    )
    /* §5's pairing maps onto these two (`parked-pile-served.test.ts`'s shape). */
    for (const [key, path, klass] of [
      [NUMBER, '["invoice","number"]', 'internal'],
      [PAYER, '["invoice","payer"]', 'personal'],
    ] as const) {
      await q(
        `INSERT INTO tenant.document_field_spec
           (tenant_id, document_type_id, path_key, path, data_class, data_type, model_processing_allowed, confidence_floor)
         VALUES ($1, $2, $3, $4::jsonb, $5, 'string', false, NULL)`,
        [ACME, TYPE, key, path, klass],
      )
    }
    await q('COMMIT')
  })
}

/** Straight at the plane, for `confer()`'s reason in browser-login: `Host` and `Cookie` are forbidden in fetch. */
function planePost(planeUrl: string, path: string, body: unknown, handle: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const url = new URL(planeUrl)
  const payload = JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path,
        method: 'POST',
        headers: {
          Host: HOST,
          cookie: `${SESSION_COOKIE}=${handle}`,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (c: string) => { text += c })
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(text === '' ? '{}' : text) as Record<string, unknown> })
        })
      },
    )
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

async function count(sql: string, params: readonly unknown[] = []): Promise<number> {
  return asMigrator(async (q) => Number(((await q(sql, params)).rows[0] as { n: unknown }).n))
}

describe('the parked pile, in a browser (C9 rows 18 and 19)', { skip }, () => {
  let plane: Awaited<ReturnType<typeof startDataPlane>>
  let front: Front
  let br: Br
  const origin = `http://${HOST}`

  async function open(
    handle: string,
    path: '/close' | '/setup' = '/close',
    width?: number,
    height = 844,
    /* G4171 — the scheme the page is drawn in, so a narrow-tier witness can
       run in light AND dark; `undefined` leaves chromium's default. */
    colorScheme?: 'light' | 'dark',
  ): Promise<{ ctx: Ctx; page: Page }> {
    const ctx = await br.newContext({
      baseURL: origin,
      ...(width === undefined ? {} : { viewport: { width, height } }),
      ...(colorScheme === undefined ? {} : { colorScheme }),
    })
    await ctx.addCookies([
      { name: SESSION_COOKIE, value: handle, domain: '127.0.0.1', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
    ])
    const page = await ctx.newPage()
    await page.goto(`${origin}${path}`, { waitUntil: 'load' })
    const place = path === '/setup' ? 'setup' : 'register'
    await page.waitForSelector(
      `[data-surface="parked-pile"][data-place="${place}"][data-parked-state="read"]`,
      { timeout: 15_000 },
    )
    return { ctx, page }
  }

  before(async () => {
    await freshControlDatabase()
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seedSubstrate()
    plane = await startDataPlane({ poolMax: 4 })
    front = RESERVED_FRONT.serve(DIST, plane.url)

    const declared = await planePost(plane.url, '/v1/endpoints', {
      label: 'Supplier SFTP',
      connection: { kind: 'sftp', host: 'sftp.supplier.example', port: 22, path: '/out', hostKeyFingerprint: PIN },
    }, ADMIN_HANDLE)
    assert.equal(declared.status, 201, JSON.stringify(declared.body).slice(0, 300))
    const endpointId = String(declared.body['endpointId'])
    const laneId = await asMigrator(async (q) =>
      String(((await q('SELECT id FROM tenant.intake_channel WHERE endpoint_id = $1', [endpointId])).rows[0] as { id: string }).id),
    )
    const pool = await createAppPool(1)
    try {
      for (const [arrivalId, name, payload] of [
        ['arr_e2e_a', 'invoices/A-1.json', { InvNo: 'A-1', Payer: 'Ada', Note: HELD_VALUE }],
        ['arr_e2e_b', MARKUP_NAME, { InvNo: 'B-2', Payer: 'Grace' }],
        ['arr_e2e_c', 'misc/readme.txt', 'just a string'],
      ] as const) {
        const out = await withTenantScope(pool, ACME, (tx) =>
          admitClassifyAndStoreArrival(tx, {
            facts: {
              arrivalId: arrivalId as ArrivalFacts['arrivalId'],
              channelId: laneId as ArrivalFacts['channelId'],
              channelKind: 'watched_drop',
              endpointId: endpointId as NonNullable<ArrivalFacts['endpointId']>,
              authorizationId: STANDING as ArrivalFacts['authorizationId'],
              byteCount: 128,
            },
            filename: arrivalFilenameFrom(name),
            payload,
            sourceDocumentId: `sdo_${arrivalId}`,
            presentedAuthorizationIds: [STANDING as ArrivalFacts['authorizationId']],
            boundUntil: BOUND,
            earlierArrivalWithSameContent: null,
            now: new Date().toISOString(),
            readingId: null,
          }),
        )
        assert.equal(out.kind, 'parked', `${arrivalId} did not park`)
      }
    } finally {
      await pool.end()
    }

    const pw = (await import('playwright')) as unknown as { chromium: { launch(): Promise<Br> } }
    br = await pw.chromium.launch()
  })

  after(async () => {
    await br?.close()
    await front?.close()
    await plane?.close()
  })

  it('§1 · the pile is its own line, counted APART from the register, and every name is TEXT', async () => {
    const { ctx, page } = await open(ADMIN_HANDLE)
    try {
      const seen = await page.evaluate<{ count: string | null; sum: string; lines: number; exceptions: number; markupName: string | null; injected: number }>(
        (name: string) => {
          const pile = document.querySelector('[data-surface="parked-pile"]')
          const b = document.querySelector('[data-parked="arr_e2e_b"] .fn')
          return {
            count: pile?.querySelector('[data-parked-count]')?.getAttribute('data-parked-count') ?? null,
            sum: pile?.querySelector('.parked-sum')?.textContent ?? '',
            lines: document.querySelectorAll('[data-parked]').length,
            exceptions: document.querySelectorAll('[data-exception]').length,
            markupName: b?.textContent === name ? b.textContent : null,
            injected: (pile?.querySelectorAll('b, img') ?? []).length,
          }
        },
        MARKUP_NAME,
      )
      assert.equal(seen.count, '3')
      assert.match(seen.sum, /3 deliveries parked, awaiting setup/)
      assert.equal(seen.lines, 3)
      assert.equal(seen.exceptions, 0, 'a parked delivery reached the exception register — it is counted apart (row 18)')
      assert.equal(seen.markupName, MARKUP_NAME, 'a filename was not drawn verbatim as text')
      assert.equal(seen.injected, 0, 'a filename became markup (invariant 6)')
    } finally {
      await ctx.close()
    }
  })

  it('§2 · the line opens ONE pane — keys, never a value — and the raise lands and leaves it parked', async () => {
    const { ctx, page } = await open(ADMIN_HANDLE)
    try {
      await page.click('[data-parked="arr_e2e_a"]')
      await page.waitForSelector('[data-parked-pane="arr_e2e_a"][data-pane-state="read"]')
      await page.waitForSelector('[data-parked-pane="arr_e2e_a"] [data-raise]', { timeout: 10_000 })
      const pane = await page.evaluate<{ keys: string[]; file: string; why: string | null; html: string }>(() => {
        const p = document.querySelector('[data-parked-pane="arr_e2e_a"]')
        return {
          keys: [...(p?.querySelectorAll('[data-parked-key]') ?? [])].map((e) => e.textContent ?? ''),
          file: p?.querySelector('[data-parked-filename]')?.textContent ?? '',
          why: p?.querySelector('[data-parked-because]')?.getAttribute('data-parked-because') ?? null,
          html: document.documentElement.outerHTML,
        }
      })
      assert.deepEqual(pane.keys, ['InvNo', 'Note', 'Payer'])
      assert.equal(pane.file, 'invoices/A-1.json')
      assert.equal(pane.why, 'no_declared_pair_matches')
      assert.equal(pane.html.includes(HELD_VALUE), false, 'a VALUE of a held artefact reached the page (G106)')
      assert.equal(pane.html.includes('Ada'), false, 'a VALUE of a held artefact reached the page (G106)')

      /* C3-15, G3943 — the type is PICKED by its label; no field takes an id. */
      const picker = await page.evaluate<{ inputs: number; words: string[] }>(() => {
        const p = document.querySelector('[data-parked-pane="arr_e2e_a"] [data-raise]')
        return {
          inputs: p?.querySelectorAll('input[name="documentTypeId"]').length ?? -1,
          words: [...(p?.querySelectorAll('[data-document-type-choice]') ?? [])].map((e) => e.textContent ?? ''),
        }
      })
      assert.equal(picker.inputs, 0, 'the raise still asks a person to type an id')
      assert.deepEqual(picker.words, ['Supplier invoice'], 'the picker did not name the type by its label')
      await page.click(`[data-parked-pane="arr_e2e_a"] [data-document-type-choice="${TYPE}"]`)
      const raised = page.waitForResponse(
        (r) => r.url().endsWith('/v1/parked/arr_e2e_a/escalation') && r.request().method() === 'POST' && r.status() === 201,
      )
      await page.click('[data-parked-pane="arr_e2e_a"] [data-raise] button[type="submit"]')
      await raised
      await page.waitForSelector(`[data-parked-pane="arr_e2e_a"] [data-escalation="${TYPE}"]`)
      const raisedAs = await page.evaluate<string>(
        () => document.querySelector('[data-parked-pane="arr_e2e_a"] [data-escalation]')?.textContent ?? '',
      )
      assert.match(raisedAs, /Raised with the 1CloudHub FDE as Supplier invoice/)
      assert.equal(raisedAs.includes(TYPE), false, 'the escalation line printed the raw id (C3-15)')
      await page.waitForSelector('[data-surface="parked-pile"] .parked-sum')
      assert.equal(
        await count(`SELECT count(*) AS n FROM tenant.parked_escalation WHERE arrival_id = 'arr_e2e_a' AND document_type_id = $1`, [TYPE]),
        1,
      )
      assert.equal(await count(`SELECT count(*) AS n FROM tenant.arrival_drain WHERE arrival_id = 'arr_e2e_a'`), 0, 'a raise extracted something')
    } finally {
      await ctx.close()
    }
  })

  it('§3 · a clerk who cannot act follows the line, and is offered no raise at all', async () => {
    const { ctx, page } = await open(CLERK_HANDLE)
    try {
      /* G3781 — nothing is POSTed to find out: the probe is gone. */
      const escalations: string[] = []
      page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/escalation')) escalations.push(r.url()) })
      await page.click('[data-parked="arr_e2e_b"]')
      await page.waitForSelector('[data-parked-pane="arr_e2e_b"][data-pane-state="read"]')
      await page.waitForResponse((r) => r.url().endsWith('/session/principal'), { timeout: 2_000 }).catch(() => undefined)
      const seen = await page.evaluate<{ raise: number; soon: number; text: string; keys: string[] }>(() => {
        const p = document.querySelector('[data-parked-pane="arr_e2e_b"]')
        return {
          raise: p?.querySelectorAll('[data-raise]').length ?? -1,
          soon: p?.querySelectorAll('[data-soon], .nb').length ?? -1,
          text: p?.textContent ?? '',
          keys: [...(p?.querySelectorAll('[data-parked-key]') ?? [])].map((e) => e.textContent ?? ''),
        }
      })
      assert.equal(seen.raise, 0, 'the clerk was offered a raise the gate refuses')
      assert.equal(seen.soon, 0, 'the refused raise was drawn quiet or hatched rather than omitted')
      assert.deepEqual(seen.keys, ['InvNo', 'Payer'])
      assert.match(seen.text, /Someone who sets up sources/)
      assert.equal(/refused|forbidden/i.test(seen.text), false)
      assert.equal(await count(`SELECT count(*) AS n FROM tenant.parked_escalation WHERE arrival_id = 'arr_e2e_b'`), 0)
      assert.deepEqual(escalations, [], 'an escalation request left the browser for a clerk — the probe is back')
    } finally {
      await ctx.close()
    }
  })

  it('§4 · a delivery that is not a record says so', async () => {
    const { ctx, page } = await open(CLERK_HANDLE)
    try {
      await page.click('[data-parked="arr_e2e_c"]')
      await page.waitForSelector('[data-parked-pane="arr_e2e_c"] [data-sample="not-a-record"]')
    } finally {
      await ctx.close()
    }
  })

  it('§5 · BOTH PLACES — on Setup the same pile offers the pairing, seeded, and declaring it drains the delivery', async () => {
    const { ctx, page } = await open(ADMIN_HANDLE, '/setup')
    try {
      await page.waitForSelector('[data-setup-state="read"]')
      await page.click('[data-place="setup"] [data-parked="arr_e2e_a"]')
      await page.waitForSelector('[data-parked-pane="arr_e2e_a"][data-pane-state="read"]')
      await page.click('[data-declare-pairing="arr_e2e_a"]')
      await page.waitForSelector('[data-pair-form][data-pair-seeded]')
      const seeded = await page.evaluate<{ kind: string | null; value: string; sources: string[] }>(() => {
        const f = document.querySelector('[data-pair-form][data-pair-seeded]')
        return {
          kind: f?.querySelector('[data-match-kind][aria-pressed="true"]')?.getAttribute('data-match-kind') ?? null,
          value: (f?.querySelector('input[name="matchValue"]') as HTMLInputElement | null)?.value ?? '',
          sources: [...(f?.querySelectorAll('input[name="sourceField"]') ?? [])].map((e) => (e as HTMLInputElement).value),
        }
      })
      assert.equal(seeded.kind, 'path_prefix')
      assert.equal(seeded.value, 'invoices/')
      assert.deepEqual(seeded.sources, ['InvNo', 'Note', 'Payer'])

      await page.click(`[data-pair-form] [data-document-type-choice="${TYPE}"]`)
      /* Rows follow the sample's sorted keys — InvNo, Note, Payer. Note is
         left blank: it maps nothing and is not sent (G3783). */
      await page.evaluate(() => {
        document
          .querySelectorAll('[data-pair-form] [data-mapping-row] input[name="typeField"]')
          .forEach((e, i) => { e.setAttribute('data-tf', String(i)) })
      })
      await page.fill('[data-tf="0"]', '["invoice","number"]')
      await page.fill('[data-tf="2"]', '["invoice","payer"]')
      const declared = page.waitForResponse(
        (r) => /\/v1\/endpoints\/[^/]+\/document-types$/.test(r.url()) && r.request().method() === 'POST',
      )
      await page.click('[data-pair-form] button[type="submit"]')
      const answer = await declared
      assert.equal(answer.status(), 201, 'the seeded pairing was refused')
      await page.waitForSelector('[data-place="setup"] [data-drain]', { timeout: 10_000 })
      const gone = await page.evaluate<number>(() =>
        document.querySelectorAll('[data-place="setup"] [data-parked="arr_e2e_a"]').length,
      )
      assert.equal(gone, 0, 'the drained delivery is still drawn as parked')
      assert.equal(await count(`SELECT count(*) AS n FROM tenant.arrival_drain WHERE arrival_id = 'arr_e2e_a'`), 1)
    } finally {
      await ctx.close()
    }
  })

  it('§6 · the clerk on Setup still follows the line, and is offered neither the raise nor the pairing', async () => {
    const { ctx, page } = await open(CLERK_HANDLE, '/setup')
    try {
      await page.click('[data-place="setup"] [data-parked="arr_e2e_b"]')
      await page.waitForSelector('[data-parked-pane="arr_e2e_b"][data-pane-state="read"]')
      await page.waitForResponse((r) => r.url().endsWith('/session/principal'), { timeout: 2_000 }).catch(() => undefined)
      const seen = await page.evaluate<{ raise: number; pair: number; keys: number }>(() => {
        const p = document.querySelector('[data-parked-pane="arr_e2e_b"]')
        return {
          raise: p?.querySelectorAll('[data-raise]').length ?? -1,
          pair: p?.querySelectorAll('[data-declare-pairing]').length ?? -1,
          keys: p?.querySelectorAll('[data-parked-key]').length ?? -1,
        }
      })
      assert.equal(seen.keys, 2, 'the clerk could not follow the line on Setup (row 19)')
      assert.equal(seen.raise, 0)
      assert.equal(seen.pair, 0, 'the clerk was offered a pairing they cannot declare')
    } finally {
      await ctx.close()
    }
  })

  /* ═══ THE NARROW TIER (G4071–G4078) ═══════════════════════════════════════
     Two layout defects at 390, both against the pack's narrow tier
     (`Handoff Specification` §10 · Responsive, 320–719): *"Every grid
     collapses to one column … the status bar as a tappable row"*, and the
     1.4.10 Reflow floor — *"no two-dimensional scrolling"*. They ride this
     suite because it already seeds a source and an administrator who can
     open Setup's pair form, and a Close page with a run-less status bar. */

  it('§7 · 390: Setup with a pair form open does not scroll sideways, and the form fits the viewport (G4074)', async () => {
    const { ctx, page } = await open(ADMIN_HANDLE, '/setup', 390)
    try {
      await page.waitForSelector('[data-setup-state="read"]')
      await page.click('[data-pair-open]')
      await page.waitForSelector('[data-pair-form]')
      const m = await page.evaluate<{ sw: number; iw: number; formRight: number; formLeft: number; fieldsRight: number }>(() => {
        const f = document.querySelector('[data-pair-form]') as HTMLElement
        const fb = f.getBoundingClientRect()
        const fields = [...f.querySelectorAll('input, button')].map((e) => e.getBoundingClientRect().right)
        return {
          sw: document.documentElement.scrollWidth,
          iw: window.innerWidth,
          formLeft: fb.left,
          formRight: fb.right,
          fieldsRight: Math.max(...fields),
        }
      })
      assert.equal(m.sw, m.iw, `Setup scrolls sideways at 390: scrollWidth ${String(m.sw)}`)
      assert.ok(m.formLeft >= 0 && m.formRight <= m.iw + 0.5,
        `the pair form sits at x ${String(m.formLeft)}–${String(m.formRight)} in a ${String(m.iw)} viewport — it is inside the table's sideways scroller`)
      assert.ok(m.fieldsRight <= m.iw + 0.5, `a pair-form control ends at x ${String(m.fieldsRight)}, past the ${String(m.iw)} viewport`)
    } finally {
      await ctx.close()
    }
  })

  /* ═══ U-26 — G4171–G4174: THE FORMS ARE `.reasons` BLOCKS UNDER THE PANE
     HEAD, WHERE THE PACK DRAWS THEM ═══════════════════════════════════════
     G4074 kept the bind and pair forms inside a `colSpan` row and pinned them
     to the scroller's visible width — a CSS repair that left the form IN THE
     TABLE. The pack draws no table-row form at any width: `C1 Close.dc.html`
     (`#work`, the `showSetup` pane) puts each form as a `.reasons` block
     directly under the `.paneh` it was opened from, ABOVE the table. These
     witnesses ask that of both forms, at both ends of the tiers, in both
     schemes, and that the form's rule is the kernel's `--rule-strong`.
     ⚠️ WITNESSED RED against the pre-slice Setup.tsx (G4174's captured red):
       "the bind form is inside the sources table at 390/light — the pack draws it as a .reasons block under the pane head" */
  for (const width of [390, 1440] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      for (const what of ['bind', 'pair'] as const) {
        it(`§7b · ${String(width)}/${scheme}: the ${what} form is a .reasons block under the pane head, not a table row (G4171)`, async () => {
          const { ctx, page } = await open(ADMIN_HANDLE, '/setup', width, 844, scheme)
          try {
            await page.waitForSelector('[data-setup-state="read"]')
            await page.click(`[data-${what}-open]`)
            await page.waitForSelector(`[data-${what}-form]`)
            type M = {
              inTable: boolean; isReasons: boolean; afterHead: boolean; beforeTable: boolean
              sw: number; iw: number; left: number; right: number; ctlRight: number
              names: string; rule: string; token: string; dark: boolean
            }
            const m = await page.evaluate<M>((sel: string) => {
              const f = document.querySelector(sel) as HTMLElement
              const section = document.querySelector('[data-setup-state="read"]') as HTMLElement
              const head = section.querySelector(':scope > .paneh') as HTMLElement
              const wrap = section.querySelector('.tblwrap') as HTMLElement
              const b = f.getBoundingClientRect()
              const probe = document.createElement('div')
              probe.style.borderTop = '1px solid var(--rule-strong)'
              f.parentElement?.appendChild(probe)
              const token = getComputedStyle(probe).borderTopColor
              probe.remove()
              return {
                inTable: f.closest('table, .tblwrap') !== null,
                isReasons: f.classList.contains('reasons'),
                afterHead: (head.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 && f.parentElement === section,
                beforeTable: (f.compareDocumentPosition(wrap) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
                sw: document.documentElement.scrollWidth,
                iw: window.innerWidth,
                left: b.left,
                right: b.right,
                ctlRight: Math.max(...[...f.querySelectorAll('input, button')].map((e) => e.getBoundingClientRect().right)),
                names: f.querySelector('[data-act-form-source]')?.textContent ?? '',
                rule: getComputedStyle(f).borderTopColor,
                token,
                dark: matchMedia('(prefers-color-scheme: dark)').matches,
              }
            }, `[data-${what}-form]`)
            const at = `${String(width)}/${scheme}`
            assert.equal(m.dark, scheme === 'dark', `the page was not drawn in ${scheme} — the witness measured the wrong scheme`)
            assert.equal(m.inTable, false, `the ${what} form is inside the sources table at ${at} — the pack draws it as a .reasons block under the pane head`)
            assert.equal(m.isReasons, true, `the ${what} form is not a .reasons block at ${at}`)
            assert.equal(m.afterHead, true, `the ${what} form is not under the Sources pane head at ${at}`)
            assert.equal(m.beforeTable, true, `the ${what} form is not above the sources table at ${at}`)
            assert.match(m.names, /Supplier SFTP/, `the ${what} form, out of its row, does not name the source it acts on`)
            assert.equal(m.sw, m.iw, `Setup scrolls sideways at ${at} with the ${what} form open: scrollWidth ${String(m.sw)}`)
            assert.ok(m.left >= 0 && m.right <= m.iw + 0.5, `the ${what} form sits at x ${String(m.left)}–${String(m.right)} in a ${String(m.iw)} viewport`)
            assert.ok(m.ctlRight <= m.iw + 0.5, `a ${what}-form control ends at x ${String(m.ctlRight)}, past the ${String(m.iw)} viewport`)
            assert.equal(m.rule, m.token, `the ${what} form's rule is not the kernel's --rule-strong in ${scheme}`)
          } finally {
            await ctx.close()
          }
        })
      }
    }
  }

  it('§7c · 390: opening a form from a row moves focus into it, and Cancel returns focus to the row act (G4172)', async () => {
    const { ctx, page } = await open(ADMIN_HANDLE, '/setup', 390)
    try {
      await page.waitForSelector('[data-setup-state="read"]')
      await page.click('[data-pair-open]')
      await page.waitForSelector('[data-pair-form]')
      await page.waitForFunction(() => document.querySelector('[data-pair-form]')?.contains(document.activeElement) === true, undefined, { timeout: 3_000 })
        .catch(() => undefined)
      const inside = await page.evaluate<boolean>(() => document.querySelector('[data-pair-form]')?.contains(document.activeElement) === true)
      assert.equal(inside, true, 'the pair form opened above the table and focus stayed on the row — a keyboard user is left below it')
      await page.click('[data-pair-form] [data-act-cancel]')
      await page.waitForFunction(() => document.querySelector('[data-pair-form]') === null)
      const back = await page.evaluate<boolean>(() => document.activeElement?.hasAttribute('data-pair-open') === true)
      assert.equal(back, true, 'Cancel did not return focus to the row act that opened the form')
    } finally {
      await ctx.close()
    }
  })

  it('§8 · 390: the status bar is ONE tappable row showing provenance, and it opens the full grammar as a sheet (G4071)', async () => {
    const { ctx, page } = await open(ADMIN_HANDLE, '/close', 390)
    try {
      const before = await page.evaluate<{ bar: boolean; rows: number; rowText: string; rowRight: number; iw: number }>(() => {
        const bar = document.querySelector('.close > .statusbar') as HTMLElement | null
        const rows = [...document.querySelectorAll('.close button.statusrow')].filter((b) => (b as HTMLElement).offsetParent !== null)
        return {
          bar: bar !== null && bar.offsetParent !== null && getComputedStyle(bar).display !== 'none',
          rows: rows.length,
          rowText: rows[0]?.textContent ?? '',
          rowRight: rows[0]?.getBoundingClientRect().right ?? Infinity,
          iw: window.innerWidth,
        }
      })
      assert.equal(before.bar, false, 'the three-slot status bar is drawn inline at 390 — the pack draws one tappable row')
      assert.equal(before.rows, 1, 'no single tappable status row at 390')
      assert.match(before.rowText, /Provenance/)
      assert.ok(before.rowRight <= before.iw + 0.5, `the status row ends at x ${String(before.rowRight)}, past the ${String(before.iw)} viewport`)
      const rh = await page.evaluate<number>(() => (document.querySelector('.close button.statusrow') as HTMLElement).getBoundingClientRect().height)
      assert.ok(rh >= 24, `the status row is ${String(rh)}px tall — under the 24px target floor`)

      await page.click('.close button.statusrow')
      await page.waitForSelector('[role="dialog"]:has([data-status-sheet])')
      /* The drawer enters on `--enter-drawer`; measure it where it lands. */
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'))
      const sheet = await page.evaluate<{ text: string; left: number; right: number; slots: string[] }>(() => {
        const d = document.querySelector('[role="dialog"]:has([data-status-sheet])') as HTMLElement
        const b = d.getBoundingClientRect()
        return {
          text: d.textContent ?? '',
          left: b.left,
          right: b.right,
          slots: [...d.querySelectorAll('[data-status-slot]')].map((e) => e.getAttribute('data-status-slot') ?? ''),
        }
      })
      assert.deepEqual(sheet.slots, ['entity', 'provenance', 'sources', 'audit'], 'the sheet does not carry the whole grammar in its order')
      assert.match(sheet.text, /no period|no run/)
      assert.ok(sheet.left <= 0.5 && sheet.right >= 389.5, `the sheet is not full width: ${String(sheet.left)}–${String(sheet.right)}`)
      await page.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
      await page.waitForFunction(() => document.querySelector('[role="dialog"]:has([data-status-sheet])') === null)
    } finally {
      await ctx.close()
    }
  })

  it('§9 · 1440: the status bar keeps its three slots inline and draws no tappable row (G4071)', async () => {
    const { ctx, page } = await open(ADMIN_HANDLE, '/close', 1440)
    try {
      const seen = await page.evaluate<{ bar: boolean; rows: number }>(() => {
        const bar = document.querySelector('.close > .statusbar') as HTMLElement | null
        return {
          bar: bar !== null && getComputedStyle(bar).display !== 'none',
          rows: [...document.querySelectorAll('.close button.statusrow')].filter((b) => getComputedStyle(b).display !== 'none').length,
        }
      })
      assert.equal(seen.bar, true)
      assert.equal(seen.rows, 0)
    } finally {
      await ctx.close()
    }
  })

  /* ⚠️ THREE WIDTHS, AND THE SECOND AND THIRD ARE G4093's FINDING. G4077
     measured 403 at 390 on its machine; on the machine that integrated G4091
     the same fixture laid the facet row's second quiet control out elsewhere
     and 390 was CLEAN before the repair — where that control lands depends on
     the rendered width of the facet labels before it and on where the row
     wraps, which is a property of the font stack and the viewport, not of one
     number. A sweep of the narrow tier on the integrating machine (320–719, the
     pack's `Handoff Specification` §10 · Responsive range) found the closed
     tip past the edge at 330, 400, 410 and 719 and clean at the widths
     between, so the witness runs at 390 (G4077's width) AND at 400 and 330
     (the two nearest widths that were red on the integrating machine).
     Captured red there, before the repair:
       "Close scrolls sideways at 400: scrollWidth 417"
       "Close scrolls sideways at 330: scrollWidth 336"
       "an OPEN tooltip ("Coming soon") sits at x 240–336 in a 330 viewport — it did not flip inward" */
  const NARROW_WIDTHS = [390, 400, 330] as const

  /* 🛑 G4077 — WAS MEASURED AND NOT FIXED, KEPT RUNNABLE AS A `todo`; NOW
     RULED (G4091, the owner's: *"Flip-on-open + 1px closed box"*) AND APPLIED.
     ⚠️ THE ORIGINAL COMMENT IS KEPT BECAUSE IT IS THE DIAGNOSIS: Close at 390
     scrolled sideways — 403 against 390 on this fixture — and the only element
     past the right edge was a CLOSED tooltip: `SPAN.tip` ("Coming soon") under
     the exception register's `.fac` row, laid out at x 306–403. `overlays.css`
     kept a closed `.tip` in the box tree at `opacity: 0` (deliberately — *"A
     TOOLTIP MUST NEVER LEAVE THE ACCESSIBILITY TREE"*), so a quiet control near
     the right edge widened the page whether or not its panel was open.
     The `todo` option is DELETED and the assertion is unchanged but for the
     width it is now parameterised over. ⚠️ WITNESSED RED on integrate/4oct-k before the repair (G4093). */
  for (const width of NARROW_WIDTHS) {
  it(`§10 · ${String(width)}: Close does not scroll sideways (G4077 — a closed tooltip widened the page; G4091)`, async () => {
    const { ctx, page } = await open(ADMIN_HANDLE, '/close', width)
    try {
      const m = await page.evaluate<{ sw: number; iw: number }>(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
      /* Captured red, G4077's commit: "Close scrolls sideways at 390: scrollWidth 403"; on integrate/4oct-k 390 was clean and 400/330 were red (G4093). */
      assert.equal(m.sw, m.iw, `Close scrolls sideways at ${String(width)}: scrollWidth ${String(m.sw)}`)
    } finally {
      await ctx.close()
    }
  })
  }

  /* 🛑 §10b — THE OTHER HALF OF G4091. A 1px closed box removes the CLOSED
     overflow and does nothing for an OPEN panel at the same edge: 34ch of
     panel anchored `left: 0` on a trigger near x 306 still ends past 390. So
     every tooltip on Close is OPENED here, through the same `pointerenter` the
     reducer takes, and its panel must sit inside the viewport and leave the page
     unscrolled — the flip is `tooltip.ts`'s `tooltipFlip()`, applied on open by
     `Tooltip.tsx`. ⚠️ WITNESSED RED before the flip existed (G4093). */
  for (const width of NARROW_WIDTHS) {
  it(`§10b · ${String(width)}: an OPEN tooltip at the right edge flips inward and stays inside the viewport (G4091)`, async () => {
    const { ctx, page } = await open(ADMIN_HANDLE, '/close', width)
    try {
      type Seen = { left: number; right: number; iw: number; sw: number; label: string; open: boolean }
      const seen = await page.evaluate<Seen[]>(async () => {
        const out: Seen[] = []
        const frame = (): Promise<void> => new Promise((r) => { requestAnimationFrame(() => { requestAnimationFrame(() => { r() }) }) })
        for (const t of [...document.querySelectorAll<HTMLElement>('.close [aria-describedby]')]) {
          const tip = document.getElementById(t.getAttribute('aria-describedby') ?? '')
          if (tip === null || !tip.hasAttribute('data-tip')) continue
          if (t.getBoundingClientRect().width === 0) continue
          t.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }))
          t.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }))
          await frame()
          const r = tip.getBoundingClientRect()
          out.push({
            left: r.left, right: r.right,
            iw: document.documentElement.clientWidth,
            sw: document.documentElement.scrollWidth,
            label: (tip.textContent ?? '').trim().slice(0, 40),
            open: tip.hasAttribute('data-on'),
          })
          t.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }))
          t.dispatchEvent(new PointerEvent('pointerleave', { bubbles: false }))
          await frame()
        }
        return out
      })
      assert.ok(seen.length > 0, `no tooltip on Close at ${String(width)} was opened — the witness measured nothing`)
      for (const w of seen) {
        assert.equal(w.open, true, `the tooltip "${w.label}" did not open on pointerenter — the witness measured a closed panel`)
        assert.ok(w.left >= 0 && w.right <= w.iw + 0.5,
          `an OPEN tooltip ("${w.label}") sits at x ${String(Math.round(w.left))}–${String(Math.round(w.right))} in a ${String(w.iw)} viewport — it did not flip inward`)
        assert.equal(w.sw, w.iw, `Close scrolls sideways at ${String(width)} with "${w.label}" open: scrollWidth ${String(w.sw)}`)
      }
    } finally {
      await ctx.close()
    }
  })
  }

  /* 🛑 §10c / §10d — WHAT G4091 DID NOT CLOSE (G4097), CLOSED (U-25, G4187–G4194).
     The horizontal flip chose between two anchors, and when NEITHER fitted it
     took the smaller overflow — so a panel wider than the room on both sides
     of its trigger still crossed an edge; and the flip was horizontal only, so
     a panel opening below the viewport's foot ran off it.
     ⚠️ CLOSE'S OWN PANELS ARE SHORT ("Coming soon" is ~96px) AND FIT AT 260
     UNREPAIRED, so §10c gives each panel the longest sentence a refused control
     ships before opening it — the panel then reaches its 34ch cap, which is
     G4097's own case (~240px against a viewport under ~272). Measured before
     the repair: with the short text, §10c passed at 260 and 330; with the long
     one it failed at every width. §10d scrolls each trigger to the FOOT of a
     short viewport, where a panel anchored below it must open above instead.
     Both run light AND dark. Captured red on origin/main @ b2563cab: 
       "an OPEN tooltip ("You prepared this finding at 08:41. The ") sits at x 79–334 in a 240 viewport"
       "an OPEN tooltip ("You prepared this finding at 08:41. The ") sits at x 16–271 in a 260 viewport"
       "an OPEN tooltip ("Coming soon") sits at y 488–527 in a 480 viewport — it did not flip upward"
     — each light AND dark; 330 passed unrepaired with the long panel too,
     because there a mid-row trigger still left one anchor room. */
  type Opened = { left: number; right: number; top: number; bottom: number; iw: number; ih: number; sw: number; cold: number; label: string; open: boolean; room: boolean }
  for (const scheme of ['light', 'dark'] as const) {
  for (const width of [240, 260, 330] as const) {
  it(`§10c · ${String(width)} · ${scheme}: an OPEN 34ch tooltip fits inside the viewport even where neither anchor does (U-25, G4187)`, async () => {
    const { ctx, page } = await open(ADMIN_HANDLE, '/close', width, 844, scheme)
    try {
      const seen = await page.evaluate<Opened[]>(OPEN_EVERY, { scope: '.close', toFoot: false, long: LONG_PANEL })
      assert.ok(seen.length > 0, `no tooltip on Close at ${String(width)} was opened — the witness measured nothing`)
      for (const w of seen) {
        assert.equal(w.open, true, `the tooltip "${w.label}" did not open on pointerenter`)
        assert.ok(w.right - w.left > w.iw / 2, `the panel is ${String(Math.round(w.right - w.left))}px — too narrow to witness a both-sides overflow`)
        assert.ok(w.left >= -0.5 && w.right <= w.iw + 0.5,
          `an OPEN tooltip ("${w.label}") sits at x ${String(Math.round(w.left))}–${String(Math.round(w.right))} in a ${String(w.iw)} viewport`)
        assert.ok(w.sw <= w.cold, `opening "${w.label}" widened the page at ${String(width)}: scrollWidth ${String(w.cold)} → ${String(w.sw)}`)
        /* At and above the pack's 320 floor the page itself must not scroll
           sideways either; below it, only the tooltip is this test's (G4190). */
        if (width >= 320) assert.equal(w.sw, w.iw, `Close scrolls sideways at ${String(width)} with "${w.label}" open: scrollWidth ${String(w.sw)}`)
      }
    } finally {
      await ctx.close()
    }
  })
  }

  it(`§10d · 390×480 · ${scheme}: an OPEN tooltip at the viewport's foot opens upward and stays inside it (U-25, G4188)`, async () => {
    const { ctx, page } = await open(ADMIN_HANDLE, '/close', 390, 480, scheme)
    try {
      const seen = await page.evaluate<Opened[]>(OPEN_EVERY, { scope: '.close', toFoot: true, long: null })
      const judged = seen.filter((w) => w.room)
      assert.ok(judged.length > 0, 'no tooltip on Close could be brought to the viewport\'s foot — the witness measured nothing')
      for (const w of judged) {
        assert.equal(w.open, true, `the tooltip "${w.label}" did not open on pointerenter`)
        assert.ok(w.top >= -0.5 && w.bottom <= w.ih + 0.5,
          `an OPEN tooltip ("${w.label}") sits at y ${String(Math.round(w.top))}–${String(Math.round(w.bottom))} in a ${String(w.ih)} viewport — it did not flip upward`)
        assert.equal(w.sw, w.iw, `Close scrolls sideways with "${w.label}" open: scrollWidth ${String(w.sw)}`)
      }
    } finally {
      await ctx.close()
    }
  })
  }

  /* ═══ U-28 — G4175–G4177: TWO TYPES ONE LABEL ARE TWO DIFFERENT BUTTONS ═══
     G3945 named it and did not close it: two document types with the same or
     an empty label were two identical buttons in a picker — a coin flip with a
     real write behind it. Nothing writes a document type on a request path
     (G110's seam), so the label cannot be repaired from here; what the picker
     CAN do is say the one thing it holds that is unique — the type's
     reference, which is the table's primary key — beside the label, and only
     where the label fails to tell it apart. A uniquely-labelled type shows its
     label alone (G3943's rule is unchanged for it).
     ⚠️ WITNESSED RED against the pre-slice pickers (G4177's captured red):
       "two choices in the Setup pair form read the same — \"Supplier invoice\"" */
  it('§11 · a picker tells apart two types that share a label, or have none, by their reference — and only those (G4175)', async () => {
    const extra = [
      ['dty_acme_e2e_invoice_twin', 'Supplier invoice'],
      ['dty_acme_e2e_invoice_shout', '  SUPPLIER   invoice '],
      ['dty_acme_e2e_unnamed', ''],
      ['dty_acme_e2e_remit', 'Remittance advice'],
    ] as const
    await asMigrator(async (q) => {
      for (const [id, label] of extra) {
        await q(
          `INSERT INTO tenant.document_type (tenant_id, id, key, label, domain, expected_fidelity, carries_control_total)
           VALUES ($1, $2, $2, $3, 'finance', 'structured', 'never')`,
          [ACME, id, label],
        )
      }
    })
    const ambiguous = [TYPE, 'dty_acme_e2e_invoice_twin', 'dty_acme_e2e_invoice_shout', 'dty_acme_e2e_unnamed']
    const { ctx, page } = await open(ADMIN_HANDLE, '/setup', 390)
    try {
      await page.waitForSelector('[data-setup-state="read"]')
      type Choice = { id: string; text: string; ref: string | null }
      const read = (scope: string): Promise<Choice[]> =>
        page.evaluate<Choice[]>((sc: string) =>
          [...document.querySelectorAll(`${sc} [data-document-type-choice]`)].map((e) => ({
            id: e.getAttribute('data-document-type-choice') ?? '',
            text: (e.textContent ?? '').replace(/\s+/g, ' ').trim(),
            ref: e.querySelector('[data-document-type-ref]')?.textContent ?? null,
          })), scope)
      const judge = (where: string, choices: Choice[]): void => {
        assert.equal(choices.length, 5, `${where} offered ${String(choices.length)} types, not 5 — the witness measured the wrong list`)
        const texts = choices.map((c) => c.text)
        for (const [i, t] of texts.entries()) {
          assert.equal(texts.indexOf(t), i, `two choices in ${where} read the same — ${JSON.stringify(t)}`)
        }
        for (const c of choices) {
          if (ambiguous.includes(c.id)) {
            assert.ok(c.ref !== null && c.ref.includes(c.id), `${where}: ${c.id} shares or lacks a label and carries no reference`)
          } else {
            assert.equal(c.ref, null, `${where}: ${c.id} has a label of its own and was given a reference anyway — G3943 names it by its label alone`)
          }
        }
        const unnamed = choices.find((c) => c.id === 'dty_acme_e2e_unnamed')
        assert.match(unnamed?.text ?? '', /^Unnamed document type/, `${where}: an empty label is not named by the neutral word`)
      }

      await page.click('[data-pair-open]')
      await page.waitForSelector('[data-pair-form] [data-document-type-choice]')
      judge('the Setup pair form', await read('[data-pair-form]'))

      await page.click('[data-place="setup"] [data-parked="arr_e2e_b"]')
      await page.waitForSelector('[data-parked-pane="arr_e2e_b"] [data-raise] [data-document-type-choice]', { timeout: 10_000 })
      judge('the parked pile\'s raise', await read('[data-parked-pane="arr_e2e_b"] [data-raise]'))

      const sw = await page.evaluate<{ sw: number; iw: number }>(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
      assert.equal(sw.sw, sw.iw, `a reference widened Setup at 390: scrollWidth ${String(sw.sw)}`)
    } finally {
      await ctx.close()
      await asMigrator(async (q) => {
        await q(`DELETE FROM tenant.document_type WHERE tenant_id = $1 AND id = ANY($2::text[])`, [ACME, extra.map(([id]) => id)])
      })
    }
  })
})

/* The longest panel text the frontend ships — the specimen's refused control
   (`OverlaySpecimen.tsx`) — long enough to reach the 34ch cap. */
const LONG_PANEL = 'You prepared this finding at 08:41. The preparer is not the reviewer. Ask a second reviewer, or reassign.'

/* Opens every tooltip under `scope` through the reducer's own `pointerenter`
   and measures its panel. With `toFoot`, each trigger is first scrolled to the
   viewport's bottom edge; `room` says whether a panel of the measured height
   fits ABOVE the trigger there — a trigger in a sticky bar cannot be moved, and
   one too near the top has no room to flip into, so those are not judged.
   Serialised into the page by `evaluate`, so it closes over nothing. */
const OPEN_EVERY = async ({ scope, toFoot, long }: { scope: string; toFoot: boolean; long: string | null }) => {
  const out: { left: number; right: number; top: number; bottom: number; iw: number; ih: number; sw: number; cold: number; label: string; open: boolean; room: boolean }[] = []
  const cold = document.documentElement.scrollWidth
  const frame = (): Promise<void> => new Promise((r) => { requestAnimationFrame(() => { requestAnimationFrame(() => { r() }) }) })
  for (const t of [...document.querySelectorAll<HTMLElement>(`${scope} [aria-describedby]`)]) {
    const tip = document.getElementById(t.getAttribute('aria-describedby') ?? '')
    if (tip === null || !tip.hasAttribute('data-tip')) continue
    if (t.getBoundingClientRect().width === 0) continue
    if (long !== null) tip.textContent = long
    const ih = document.documentElement.clientHeight
    if (toFoot) {
      window.scrollTo(0, 0)
      const y = t.getBoundingClientRect().bottom
      window.scrollBy(0, y - ih)
      await frame()
    }
    t.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }))
    t.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }))
    await frame()
    const r = tip.getBoundingClientRect()
    const tr = t.getBoundingClientRect()
    out.push({
      left: r.left, right: r.right, top: r.top, bottom: r.bottom,
      iw: document.documentElement.clientWidth, ih,
      sw: document.documentElement.scrollWidth, cold,
      label: (tip.textContent ?? '').trim().slice(0, 40),
      open: tip.hasAttribute('data-on'),
      room: !toFoot || (tr.bottom >= ih - 1 && tr.top >= r.height + 8),
    })
    t.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }))
    t.dispatchEvent(new PointerEvent('pointerleave', { bubbles: false }))
    await frame()
  }
  return out
}
