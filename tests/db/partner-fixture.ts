/**
 * ONE PARTNER-PORTAL FIXTURE, SHARED BY THE W5 SUITES (G2621–G2640).
 *
 * Two firms — Northwind and Contoso — so that every firm-keyed policy is
 * witnessed against a SECOND firm that holds a row of its own, and not merely
 * against an empty table. A policy that admitted every firm passes against
 * one firm and fails here; that is the whole reason Contoso exists.
 *
 *   ANA   — Northwind, partner administrator (all six portal verbs)
 *   BEN   — Northwind, partner user (`view_deals`, `register_deal`)
 *   CARL  — Contoso,   partner administrator
 *   DORA  — Northwind's door, signed in, and holding NO portal role at all —
 *           the person an administrator would invite, and the one the
 *           directory must NOT show (she has no assignment in the firm).
 *
 * Every session is TENANT-LESS and issued on the partners host: a portal
 * session is bound to no tenant (G726/G728).
 */
import { migratorClient } from '../../db/provision.ts'
import { digestOfHandle } from '../../server/data-plane/handle-digest.ts'

export const NORTHWIND = 'prt_northwind'
export const CONTOSO = 'prt_contoso'
export const PARTNERS_HOST = 'partners.reconcile.invalid'

export const DOOR_NW = 'idc_northwind_okta'
export const DOOR_CO = 'idc_contoso_entra'

export const ANA = 'usr_nw_ana'
export const BEN = 'usr_nw_ben'
export const CARL = 'usr_co_carl'
export const DORA = 'usr_nw_dora'

export const HANDLES = {
  ana: 'sh_ana_0d1e2f3a4b5c6d7e8f90a1b2c3d4e5f6',
  ben: 'sh_ben_1e2f3a4b5c6d7e8f90a1b2c3d4e5f607',
  carl: 'sh_carl_2f3a4b5c6d7e8f90a1b2c3d4e5f6071',
  dora: 'sh_dora_3a4b5c6d7e8f90a1b2c3d4e5f607182',
} as const

/** The digest a `withSessionScope()` call takes — G160's one seam. */
export function digestOf(handle: string): string {
  const d = digestOfHandle(handle)
  if (d === null) throw new Error(`fixture handle ${handle} digested to nothing`)
  return d
}

export const ADMIN_VERBS = [
  'view_deals',
  'register_deal',
  'view_sandbox',
  'operate_sandbox',
  'view_partner_staff',
  'manage_partner_staff',
] as const

export const USER_VERBS = ['view_deals', 'register_deal'] as const

export async function seedPartnerPortal(): Promise<void> {
  const c = await migratorClient()
  try {
    await c.query('BEGIN')
    await c.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES
         ($1, 'oidc', 'Northwind Okta',  'partner', $3, NULL,
          'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_W5', 'northwind-okta', 'active'),
         ($2, 'oidc', 'Contoso Entra',   'partner', $4, NULL,
          'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_W5', 'contoso-entra', 'active')`,
      [DOOR_NW, DOOR_CO, NORTHWIND, CONTOSO],
    )
    await c.query(
      `INSERT INTO tenant."user" (id, email, display_name, status, connection_id) VALUES
         ($1, 'ana@northwind.invalid',  'Ana Ruiz',    'active', $5),
         ($2, 'ben@northwind.invalid',  'Ben Okafor',  'active', $5),
         ($3, 'carl@contoso.invalid',   'Carl Mertens','active', $6),
         ($4, 'dora@northwind.invalid', 'Dora Lim',    'active', $5)`,
      [ANA, BEN, CARL, DORA, DOOR_NW, DOOR_CO],
    )
    await c.query(
      `INSERT INTO tenant.partner_role (id, partner_id, label, key, version, status) VALUES
         ('prl_nw_admin', $1, 'Partner administrator', 'partner_administrator', 1, 'active'),
         ('prl_nw_user',  $1, 'Partner user',          'partner_user',          1, 'active'),
         ('prl_co_admin', $2, 'Partner administrator', 'partner_administrator', 1, 'active'),
         ('prl_co_user',  $2, 'Partner user',          'partner_user',          1, 'active')`,
      [NORTHWIND, CONTOSO],
    )
    for (const role of ['prl_nw_admin', 'prl_co_admin']) {
      for (const verb of ADMIN_VERBS) {
        await c.query(
          `INSERT INTO tenant.partner_role_capability (role_id, capability) VALUES ($1, $2)`,
          [role, verb],
        )
      }
    }
    for (const role of ['prl_nw_user', 'prl_co_user']) {
      for (const verb of USER_VERBS) {
        await c.query(
          `INSERT INTO tenant.partner_role_capability (role_id, capability) VALUES ($1, $2)`,
          [role, verb],
        )
      }
    }
    await c.query(
      `INSERT INTO tenant.partner_role_assignment
         (id, partner_id, user_id, role_id, role_version, granted_by, granted_at, expires_at, revoked_at)
       VALUES
         ('pra_ana',  $1, $3, 'prl_nw_admin', 1, 'seed', now(), now() + interval '30 days', NULL),
         ('pra_ben',  $1, $4, 'prl_nw_user',  1, 'seed', now(), now() + interval '30 days', NULL),
         ('pra_carl', $2, $5, 'prl_co_admin', 1, 'seed', now(), now() + interval '30 days', NULL)`,
      [NORTHWIND, CONTOSO, ANA, BEN, CARL],
    )
    for (const [id, handle, user, door] of [
      ['ses_ana', HANDLES.ana, ANA, DOOR_NW],
      ['ses_ben', HANDLES.ben, BEN, DOOR_NW],
      ['ses_carl', HANDLES.carl, CARL, DOOR_CO],
      ['ses_dora', HANDLES.dora, DORA, DOOR_NW],
    ] as const) {
      await c.query(
        `INSERT INTO tenant.session
           (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
            authenticated_at, last_used_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, NULL, $5, now(), now(), now() + interval '12 hours', NULL)`,
        [id, digestOf(handle), user, door, PARTNERS_HOST],
      )
    }
    await c.query('COMMIT')
  } catch (err) {
    await c.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await c.end()
  }
}

export async function asMigrator(sql: string, params: readonly unknown[] = []): Promise<Array<Record<string, unknown>>> {
  const c = await migratorClient()
  try {
    return (await c.query(sql, params as unknown[])).rows as Array<Record<string, unknown>>
  } finally {
    await c.end()
  }
}
