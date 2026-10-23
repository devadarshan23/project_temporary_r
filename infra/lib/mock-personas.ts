/**
 * THE STAGING MOCK SIGN-IN'S PERSONAS AND DOORS — THE ONE CANONICAL LIST.
 *
 * ┌─ 🛑 THE OWNER'S RULINGS, 2 Oct 2026 (G2771, AND G2996 THAT BUILDS IT) ────┐
 * │ *"Create a mock sign-in so Claude can run live browser tests against      │
 * │ staging without passkeys"* and *"A profile switcher for the mock sign-in  │
 * │ and for the owner, so all user journeys can be tested across the          │
 * │ customer, partner and 1CloudHub portals."* Confirmed directly, twice,     │
 * │ after the risk was stated in full: **this is a public, internet-reachable │
 * │ test login on staging**, and two of its personas — a 1CloudHub platform  │
 * │ principal and an FDE holding a 90-day delivery grant — reach far.        │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ONE LIST, THREE READERS, AND NONE OF THEM KEEPS A COPY:
 *
 *   `infra/lib/mock-idp-stack.ts`   hands it to the Lambda as ONE environment
 *                                   value (`MOCK_IDP_CATALOGUE`), so the door
 *                                   can show and sign in exactly these people;
 *   `frontend/src/components/ProfileSwitcher.tsx`
 *                                   imports it — and only a TEST BUILD keeps it
 *                                   (`frontend/vite.config.ts`'s define, G3003);
 *   `tests/db/staging-mock-personas.test.ts`
 *                                   requires `db/seeds/staging-mock-personas.sql`
 *                                   to name exactly these addresses and doors.
 *
 * 🛑 THIS FILE IMPORTS NOTHING, AND THAT IS THE PROPERTY THAT LETS A BROWSER
 * BUNDLE READ IT: no `aws-cdk-lib`, no `node:`, no `lib/config.ts`. The hosts
 * below are therefore SPELLED, and `tests/infra/mock-idp.test.mjs` §1 holds
 * them equal to `tenantHost('ten-mock')`, `CONSOLE_HOST` and `PARTNERS_HOST`.
 *
 * ⚠️ `sub` IS THE MOCK DOOR'S SUBJECT AND IS DETERMINISTIC — AND IT IS **NOT**
 * THE SUBJECT THE PLANE STORES. The plane verifies the BROKER's token (D6-5),
 * and Cognito's `sub` for a federated user is a UUID Cognito mints at that
 * user's first sign-in. That is MEASURED from the code, not assumed:
 * `completeFederatedSignIn` provisions on `exchanged.identity.subject`, the
 * verified Cognito token's `sub` (`server/data-plane/federated-signin.ts`). So
 * the seed cannot be single-phase over Cognito at any price — G2998.
 */

/** The three org classes a door can have; `orgFor(connection.owner)` derives one from each. */
export type MockDoorKey = 'customer' | 'partner' | 'platform'

export interface MockDoor {
  /** The `tenant.identity_connection.id` the seed writes. */
  readonly connectionId: string
  /** Sixteen hex characters — `COGNITO_PROVIDER_HANDLE_PATTERN`. `c-<handle>` is the Cognito provider. */
  readonly handle: string
  /** The `client_id` Cognito presents to the mock door for this provider. */
  readonly clientId: string
  /** The ONE domain this door is claimed for. Always under `MOCK_IDENTITY_DOMAIN`. */
  readonly domain: string
  /** The org class `orgFor()` derives from the door's owner. */
  readonly orgClass: MockDoorKey
}

/** Every mock address lives under here, and no other door may claim under it. */
export const MOCK_IDENTITY_DOMAIN = 'mock.reconcileai.app'

/** The mock tenant: its id, its host slug, and its host. */
export const MOCK_TENANT_ID = 'ten_mock'
export const MOCK_TENANT_SLUG = 'ten-mock'
export const MOCK_TENANT_HOST = 'ten-mock.us-west-2.reconcileai.app'
/** The mock partner — `tenant.tenant.partner_id` for `ten_mock`, and the partner door's owner. */
export const MOCK_PARTNER_ID = 'ptn_mock'
export const MOCK_ACCOUNT_ID = 'acc_mock'

export const MOCK_CONSOLE_HOST = 'console.reconcileai.app'
export const MOCK_PARTNERS_HOST = 'partners.reconcileai.app'

/**
 * 🛑 THREE DOORS, AND IT IS FORCED RATHER THAN TIDY. A door has ONE owner and
 * `orgFor(connection.owner)` is the only producer of `orgClass` (G289), so a
 * customer, a partner and a platform persona cannot share one; and one domain
 * routes to one door (`routeToConnection()` refuses
 * `domain_claimed_by_more_than_one_connection`). The mock IdP shows a door
 * ONLY its own personas, keyed on the `client_id` Cognito presents.
 */
export const MOCK_DOORS: Readonly<Record<MockDoorKey, MockDoor>> = {
  customer: {
    connectionId: 'idc_mock_customer',
    handle: 'b03a4f0fedb6a40f',
    clientId: 'reconcile-mock-customer',
    domain: `customer.${MOCK_IDENTITY_DOMAIN}`,
    orgClass: 'customer',
  },
  partner: {
    connectionId: 'idc_mock_partner',
    handle: '64d24e8b55c8742c',
    clientId: 'reconcile-mock-partner',
    domain: `partner.${MOCK_IDENTITY_DOMAIN}`,
    orgClass: 'partner',
  },
  platform: {
    connectionId: 'idc_mock_platform',
    handle: '825524648d0a49f6',
    clientId: 'reconcile-mock-platform',
    domain: `staff.${MOCK_IDENTITY_DOMAIN}`,
    orgClass: 'platform',
  },
}

export interface MockPersona {
  /** The mock door's deterministic `sub`. NOT what the plane stores — see the header. */
  readonly sub: string
  readonly door: MockDoorKey
  readonly email: string
  readonly name: string
  /** The actor class, in `User Journeys.dc.html`'s own words. */
  readonly actor: string
  /** Where this persona lands: the host the switcher begins their sign-in on. */
  readonly portalHost: string
  /** The journeys this persona exists to walk. */
  readonly journeys: readonly string[]
}

function persona(
  sub: string,
  door: MockDoorKey,
  local: string,
  name: string,
  actor: string,
  portalHost: string,
  journeys: readonly string[],
): MockPersona {
  return {
    sub,
    door,
    email: `${local}@${MOCK_DOORS[door].domain}`,
    name: `${name} (mock)`,
    actor,
    portalHost,
    journeys,
  }
}

/**
 * ONE PERSONA PER ACTOR CLASS IN `docs/handoff-pack/User Journeys.dc.html` —
 * derive the classes, never read them:
 *
 *   grep -o "roles:'[^']*'" 'docs/handoff-pack/User Journeys.dc.html' | sort -u
 *
 * Customer (C1–C13): user · tenant administrator · approver (TWO, four eyes)
 * · assurance reader · cloud engineer. Partner (P1–P9): partner administrator
 * · partner user · partner delivery. 1CloudHub (H1–H11): catalogue/platform ·
 * billing & commercial · FDE · support.
 *
 * ⚠️ THE V JOURNEYS' ACTOR IS A VISITOR WITH NO TENANT AND NO SESSION, so no
 * persona is minted for them: V1 and V2 are the public plane and need no
 * sign-in. ⚠️ The "1CloudHub billing" and "customer" co-actors on a P journey
 * are the platform and customer personas below; no persona exists twice.
 */
export const MOCK_PERSONAS: readonly MockPersona[] = [
  /*#__PURE__*/ persona('mock-cust-admin', 'customer', 'admin', 'Ada Admin', 'tenant administrator', MOCK_TENANT_HOST, ['C6', 'C7', 'C8', 'C9', 'C10', 'C12', 'C13']),
  /*#__PURE__*/ persona('mock-cust-approver-a', 'customer', 'approver.a', 'Abe Approver', 'approver (first of two)', MOCK_TENANT_HOST, ['C5']),
  /*#__PURE__*/ persona('mock-cust-approver-b', 'customer', 'approver.b', 'Bea Approver', 'approver (second of two — four eyes)', MOCK_TENANT_HOST, ['C5']),
  /*#__PURE__*/ persona('mock-cust-operator', 'customer', 'operator', 'Oli Operator', 'user', MOCK_TENANT_HOST, ['C1', 'C2', 'C3', 'C4', 'C6', 'C7']),
  /*#__PURE__*/ persona('mock-cust-viewer', 'customer', 'viewer', 'Vic Viewer', 'assurance reader', MOCK_TENANT_HOST, ['C7', 'C11']),
  /*#__PURE__*/ persona('mock-cust-engineer', 'customer', 'engineer', 'Cy Engineer', 'cloud engineer', MOCK_TENANT_HOST, ['C12', 'P8']),
  /*#__PURE__*/ persona('mock-partner-admin', 'partner', 'admin', 'Pam Partner-Admin', 'partner administrator', MOCK_PARTNERS_HOST, ['P1', 'P2', 'P3', 'P6']),
  /*#__PURE__*/ persona('mock-partner-user', 'partner', 'user', 'Pete Partner-User', 'partner user', MOCK_PARTNERS_HOST, ['P5', 'P6', 'P8', 'P9']),
  /*#__PURE__*/ persona('mock-partner-delivery', 'partner', 'delivery', 'Dee Partner-Delivery', 'partner delivery', MOCK_PARTNERS_HOST, ['P7']),
  /*#__PURE__*/ persona('mock-staff-platform', 'platform', 'platform', 'Sam Platform', 'catalogue / platform', MOCK_CONSOLE_HOST, ['H3', 'H8', 'H9', 'H10', 'P4']),
  /*#__PURE__*/ persona('mock-staff-billing', 'platform', 'billing', 'Bill Billing', 'billing & commercial', MOCK_CONSOLE_HOST, ['H1', 'H6', 'H7', 'H11']),
  /*#__PURE__*/ persona('mock-staff-fde', 'platform', 'fde', 'Fay FDE', 'FDE (90-day delivery grant into the mock tenant)', MOCK_TENANT_HOST, ['H1', 'H2', 'H4']),
  /*#__PURE__*/ persona('mock-staff-support', 'platform', 'support', 'Sue Support', 'support', MOCK_CONSOLE_HOST, ['H5', 'H11']),
]

/** The personas a door may show and sign in. A door shows ONLY its own. */
export function personasOfDoor(door: MockDoorKey): readonly MockPersona[] {
  return MOCK_PERSONAS.filter((p) => p.door === door)
}
