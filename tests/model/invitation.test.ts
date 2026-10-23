/**
 * THE INVITATION — #235 [A-14], under G229.
 *
 * MG7, `docs/model-gaps.md`: *"No invitation type. No invite row, no expiry, no
 * accept-or-decline transition. `/invite` draws a flow whose state has nowhere
 * to live."*
 *
 *     grep -rniE 'export (interface|type|const) [A-Za-z]*Invit' model/*.ts \
 *       | wc -l                                                          → 0
 *
 * 🛑 G229 IS THE WHOLE SHAPE AND IT IS A RULING RATHER THAN A DESIGN CHOICE.
 * *"An invitation is redeemed, not minted. The inviter's act carries the
 * `AuthorizationGrant`; acceptance redeems it."* The alternative — acceptance
 * mints the `Membership` — would have made a person's act the authorising act,
 * and invariant 10 (*an act with no authorisation is unrecordable*) admits
 * exactly one actor kind without an authorisation, `system`. An invitee is not
 * `system`. So the rejected shape required widening
 * `AUTHORIZATION_MAY_BE_ABSENT`, which is one of invariant 10's enforcement
 * points.
 *
 * ⚠️ AND THE AUDIT PROPERTY IS THE HALF THAT MATTERS MORE THAN THE MECHANISM:
 * the person who CONFERRED authority must be the person recorded as conferring
 * it. Under the rejected shape the record would name the RECIPIENT as the actor
 * who granted themselves access — a true-looking sentence about the wrong
 * person. `test_the_conferring_actor_is_read_off_the_grant…` is that property,
 * and it is asserted with an accepting user who is NOT the grant's subject,
 * because a fixture where the two coincide proves nothing.
 *
 * 🛑 WHY SOME TESTS PASS AT BASE. #223's discipline, restated by #235's
 * `witnessed-red-required` label: at the red commit the type is absent, so this
 * file must also carry assertions that pass at base and report the split. The
 * BASE FACTS below assert the four premises G229 rests on. Everything under THE
 * ROW fails at base.
 *
 * WITNESSED RED at the red commit: `node --test tests/model/invitation.test.ts`
 * → tests 19 · pass 4 · fail 15. The four passes are exactly the BASE FACTS;
 * every test under THE ROW failed. `npm run check` is EXIT 1 at that commit for
 * the same reason — `typecheck:tests` cannot resolve `Invitation`,
 * `acceptInvitation`, `InvitationRedemption`, `INVITATION_REFUSALS` or
 * `invitationStanding` from `model/domain.ts`, nor `InvitationId` from
 * `model/kernel.ts`. That is the intended state of a red commit.
 *
 * ⚠️ TWO TESTS PASSED VACUOUSLY ON THE FIRST RED RUN AND WERE FIXED BEFORE THE
 * COMMIT. `the standing is derived and NEVER stored` and `invariant 1 — the
 * tenant comes off the ROW` are both ABSENCE sweeps: with the declaration
 * missing, `indexOf` returned -1, the slice was empty, and `doesNotMatch`
 * passed against nothing. That is `docs/HANDOFF.md` §5.6 — a control that
 * passes while asserting nothing — arriving inside the file written to avoid
 * it, and it was found by READING the red run rather than by any checker. Both
 * now assert the declaration is present first, which is what moved the count
 * from 13 failing to 15.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import type { AuthorizationGrant } from '../../model/access.ts'
import type { Invitation, SessionHandleDigest } from '../../model/domain.ts'
import type {
  AuthorizationGrantId,
  InvitationId,
  MembershipId,
  RoleId,
  TenantId,
  UserId,
} from '../../model/kernel.ts'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const MODEL_DIR = join(REPO_ROOT, 'model')

const DOMAIN_TEXT = readFileSync(join(MODEL_DIR, 'domain.ts'), 'utf8')
const ACCESS_TEXT = readFileSync(join(MODEL_DIR, 'access.ts'), 'utf8')

function modelSources(): ReadonlyArray<readonly [string, string]> {
  return readdirSync(MODEL_DIR)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .sort()
    .map((f) => [`model/${f}`, readFileSync(join(MODEL_DIR, f), 'utf8')] as const)
}

/**
 * See the identical helper in `tests/model/session-shape.test.ts` for the full
 * argument. In one sentence: a sweep for an ABSENCE has to read code, because
 * the paragraph explaining why the thing is absent contains its name. The brief
 * for this slice records that false-positive class biting this track six times
 * in one slice.
 */
function codeOnly(text: string): string {
  let out = ''
  let i = 0
  while (i < text.length) {
    const two = text.slice(i, i + 2)
    if (two === '//') {
      const end = text.indexOf('\n', i)
      i = end === -1 ? text.length : end
      continue
    }
    if (two === '/*') {
      const end = text.indexOf('*/', i + 2)
      i = end === -1 ? text.length : end + 2
      continue
    }
    const ch = text[i] ?? ''
    if (ch === '"' || ch === "'" || ch === '`') {
      out += ch
      i += 1
      while (i < text.length && text[i] !== ch) {
        if (text[i] === '\\') i += 1
        out += text[i] ?? ''
        i += 1
      }
      out += ch
      i += 1
      continue
    }
    out += ch
    i += 1
  }
  return out
}

/* ==================================================================== *
 * FIXTURES
 *
 * Every timestamp here is explicit and none is `Date.now()`. The reason is
 * `authorize()`'s: `PrincipalContext.now` is a parameter rather than a clock
 * read "so a decision is reproducible in an audit", and a test that reads a
 * clock is a test whose failure depends on when it ran.
 * ==================================================================== */

const TENANT = 'ten_acme' as TenantId
const OTHER_TENANT = 'ten_northwind' as TenantId
const INVITER = 'usr_inviter' as UserId
const INVITEE = 'usr_invitee' as UserId
const INVITATION = 'inv_fixture' as InvitationId
const GRANT = 'agr_fixture' as AuthorizationGrantId
const MEMBERSHIP = 'mbr_fixture' as MembershipId
const ROLE = 'rol_approver' as RoleId
const HANDLE = 'sha256:invitation-handle' as SessionHandleDigest

const INVITED_AT = '2026-08-24T09:00:00.000Z'
const NOW = '2026-08-24T09:30:00.000Z'
const BEFORE_NOW = '2026-08-24T09:15:00.000Z'
const AFTER_NOW = '2026-08-31T09:00:00.000Z'

function invitation(over: Partial<Invitation> = {}): Invitation {
  return {
    id: INVITATION,
    tenantId: TENANT,
    handleDigest: HANDLE,
    email: 'invitee@acme.example',
    roleId: ROLE,
    grantId: GRANT,
    invitedAt: INVITED_AT,
    expiresAt: AFTER_NOW,
    membershipExpiresAt: null,
    acceptedAt: null,
    revokedAt: null,
    ...over,
  }
}

/**
 * The grant the INVITER minted through `authorize()` when they invited. Its
 * `subjectUserId` is the inviter and never the invitee — that is the whole of
 * G229 in one field.
 */
function grant(over: Partial<AuthorizationGrant> = {}): AuthorizationGrant {
  return {
    /* G730 — the discriminant. This grant is the tenant home's; the platform
     * home is `PlatformAuthorizationGrant` and an invitation is never minted
     * in it, because an invitation is a tenant act. */
    home: 'tenant',
    id: GRANT,
    tenantId: TENANT,
    subjectUserId: INVITER,
    orgClass: 'customer',
    partnerId: null,
    capability: 'manage_users',
    resource: {
      resourceClass: 'authority',
      resourceType: 'Invitation',
      resourceId: INVITATION,
      solutionId: null,
    },
    scope: {
      domains: { kind: 'these', values: [] },
      definitionIds: { kind: 'these', values: [] },
      solutionIds: { kind: 'these', values: [] },
      costCentres: { kind: 'these', values: [] },
      legalEntities: { kind: 'these', values: [] },
      valueCeiling: null,
    },
    via: [],
    issuedAt: INVITED_AT,
    expiresAt: '2026-08-24T09:05:00.000Z',
    ...over,
  }
}

function redemption(over: Partial<{ handleDigest: SessionHandleDigest; userId: UserId; membershipId: MembershipId; at: string }> = {}) {
  return {
    handleDigest: HANDLE,
    userId: INVITEE,
    membershipId: MEMBERSHIP,
    at: NOW,
    ...over,
  }
}

/* ==================================================================== *
 * BASE FACTS — these pass at base, and each is a premise G229 rests on
 * ==================================================================== */

test('BASE — `AUTHORIZATION_MAY_BE_ABSENT` admits exactly one actor kind, and it is `system`', async () => {
  // The constant G229 refused to widen. If a later slice adds a second `true`
  // here, the ruling's whole argument — "an invitee is not `system`" — has been
  // dissolved without anyone amending invariant 10.
  const { AUTHORIZATION_MAY_BE_ABSENT } = await import('../../model/governance.ts')
  const permitted = Object.entries(AUTHORIZATION_MAY_BE_ABSENT)
    .filter(([, mayBeAbsent]) => mayBeAbsent)
    .map(([kind]) => kind)
  assert.deepEqual(
    permitted,
    ['system'],
    'G229 turns on this constant having exactly one member. Widening it to make an ' +
      'invitation flow convenient is the shape `docs/HANDOFF.md` §5 exists to catch.',
  )
})

test('BASE — `authorize()` is the only thing in `model/` that constructs an `AuthorizationGrant`', () => {
  // Invariant 10, stated as a sweep rather than as a sentence. A second minting
  // path is the failure #235 names outright: "A second minting path would break
  // invariant 10 outright."
  const minters = modelSources().flatMap(([path, text]) =>
    [...codeOnly(text).matchAll(/:\s*Authorization\b|grant:\s*\{/g)].length > 0 &&
    /export function \w+\([^)]*\)\s*:\s*Authorization\b/.test(codeOnly(text))
      ? [path]
      : [],
  )
  assert.deepEqual(
    minters,
    ['model/access.ts'],
    'Invariant 10: `authorize()` mints an `AuthorizationGrant` and nothing else does.',
  )
})

test('BASE — `Membership.grantedBy` is a `UserId`, and it is what the audit reads', () => {
  assert.match(
    DOMAIN_TEXT,
    /^ {2}grantedBy: UserId$/m,
    'G229\'s audit property has nowhere to land without this field: "the person who ' +
      'CONFERRED authority is the person recorded as conferring it."',
  )
})

test('BASE — `MAX_AUTHORIZATION_SECONDS` bounds an ACT, and `manage_users` is `authority`', () => {
  // Both halves matter to this slice and they pull in opposite directions.
  // `manage_users` is the capability an inviter holds; its class is `authority`,
  // whose ceiling is 300 seconds. 🛑 THAT CEILING IS NOT THE INVITATION'S CLOCK
  // — see the paragraph on `acceptInvitation()`. `model/session.ts` names
  // reading it as one "the landmark trap ... §5.1's landmark substitution
  // exactly", in capitals, about this exact constant.
  assert.match(ACCESS_TEXT, /^ {2}manage_users: 'authority',$/m)
  assert.match(ACCESS_TEXT, /^ {2}authority: 300,$/m)
})

/* ==================================================================== *
 * THE ROW — every test below fails at base
 * ==================================================================== */

test('MG7 — an invitation type exists, and the gap ledger\'s own grep is the control', () => {
  const hits = modelSources().flatMap(([path, text]) =>
    [...codeOnly(text).matchAll(/export (?:interface|type|const) [A-Za-z]*Invit/g)].map(
      () => path,
    ),
  )
  assert.notEqual(
    hits.length,
    0,
    'MG7: `grep -rniE \'export (interface|type|const) [A-Za-z]*Invit\' model/*.ts` → 0. ' +
      '`/invite` is one of the four entry routes and the only one this track leaves with ' +
      'nothing to point at.',
  )
})

test('test_an_expired_invitation_cannot_mint_a_membership', async () => {
  const { acceptInvitation } = await import('../../model/domain.ts')
  const result = acceptInvitation(
    invitation({ expiresAt: BEFORE_NOW }),
    grant(),
    redemption(),
  )
  assert.equal(result.ok, false)
  assert.equal(
    result.ok === false ? result.refusal : null,
    'invitation_expired',
    'An invitation past `expiresAt` returns a refusal rather than a `Membership`.',
  )
})

test('🛑 THE MUTATION — the expiry check bites on its own, with `acceptedAt` still null', async () => {
  // #235, assertion 2, and it is the whole point of the slice:
  //
  //   "Its mutation, and it is the likeliest: check `acceptedAt === null` and
  //    stop. THE TYPE ALREADY IMPLIES SINGLE USE, so the check is decorative and
  //    the test passes while an indefinitely-old invitation still mints
  //    authority. A named test must fail on that alone."
  //
  // So this fixture is UNACCEPTED, UNREVOKED, and carries a grant that binds
  // cleanly. Every check except the expiry passes. Delete the expiry comparison
  // from `acceptInvitation()` and this test — and only this one — goes red.
  const { acceptInvitation } = await import('../../model/domain.ts')
  const stale = invitation({
    acceptedAt: null,
    revokedAt: null,
    invitedAt: '2020-01-01T00:00:00.000Z',
    expiresAt: '2020-01-08T00:00:00.000Z',
  })
  const result = acceptInvitation(stale, grant(), redemption())
  assert.equal(
    result.ok,
    false,
    'A five-year-old invitation minted a `Membership` because nothing compared its ' +
      'expiry. `acceptedAt === null` is satisfied by every invitation that was never ' +
      'accepted, including the ones that expired years ago.',
  )
  assert.equal(result.ok === false ? result.refusal : null, 'invitation_expired')
})

test('an invitation expiring EXACTLY now is expired — `<=`, not `<`', async () => {
  // 🛑 ADDED AFTER THE MUTATION RUN, WHICH IS WHY IT IS HERE AND NOT IN THE RED
  // COMMIT. Weakening `expiresMs <= atMs` to `<` was one of fifteen mutations
  // and it was one of only two that STAYED GREEN: every other test supplies an
  // expiry comfortably in the past, so the boundary was asserted by nothing.
  //
  // The comparison is not cosmetic. `decide()`, `effectivePartnerCapabilities()`
  // and `redeemAuthorization()` all use `<=` — "a grant expiring exactly now is
  // expired" — and an invitation that disagreed with three of them would be a
  // one-tick window that only ever appears under load.
  const { acceptInvitation } = await import('../../model/domain.ts')
  const result = acceptInvitation(invitation({ expiresAt: NOW }), grant(), redemption({ at: NOW }))
  assert.equal(result.ok, false, 'An invitation expiring exactly now is expired.')
  assert.equal(result.ok === false ? result.refusal : null, 'invitation_expired')
})

test('test_an_accepted_invitation_cannot_be_accepted_twice', async () => {
  // #223's single-use-consume shape, one row over: the ROW is the enforcement,
  // and a replay finds a consumed row rather than racing a process map.
  const { acceptInvitation } = await import('../../model/domain.ts')
  const result = acceptInvitation(
    invitation({ acceptedAt: BEFORE_NOW }),
    grant(),
    redemption(),
  )
  assert.equal(result.ok, false)
  assert.equal(result.ok === false ? result.refusal : null, 'invitation_already_accepted')
})

test('G229 — the conferring actor is read OFF THE GRANT, so it can never be the invitee', async () => {
  // The audit property, asserted where it can actually fail. The accepting user
  // is deliberately NOT the grant's subject: a fixture where the two coincide
  // passes whichever field the implementation copied.
  const { acceptInvitation } = await import('../../model/domain.ts')
  const result = acceptInvitation(invitation(), grant(), redemption())
  assert.equal(result.ok, true, 'A live, unaccepted, unrevoked invitation with a matching grant')
  if (result.ok !== true) return
  assert.equal(
    result.membership.grantedBy,
    INVITER,
    'G229: "the person who CONFERRED authority is the person recorded as conferring it." ' +
      'Under the rejected shape this field would name the RECIPIENT — a true-looking ' +
      'sentence about the wrong person.',
  )
  assert.notEqual(result.membership.grantedBy, INVITEE)
  assert.equal(result.membership.userId, INVITEE)
  assert.equal(result.membership.tenantId, TENANT)
  assert.equal(result.membership.roleId, ROLE)
  assert.equal(result.membership.id, MEMBERSHIP)
  assert.equal(result.membership.revokedAt, null)
})

test('G229 — acceptance takes NO `grantedBy` input, so the audit line cannot be supplied by the caller', async () => {
  // The structural half. If `grantedBy` were an input, a handler could pass the
  // invitee and every assertion above would still pass.
  const source = codeOnly(DOMAIN_TEXT)
  const at = source.indexOf('export interface InvitationRedemption')
  assert.notEqual(at, -1, '`InvitationRedemption` is the acceptance input shape')
  const body = source.slice(at, source.indexOf('}', at))
  assert.doesNotMatch(
    body,
    /grantedBy|inviter|actor/i,
    'The conferring actor is derived from the grant, never supplied. A caller that can ' +
      'name the conferrer can name the wrong one.',
  )
})

test('🛑 the PRINCIPAL binding is deliberately NOT checked against the accepting user', async () => {
  // `redeemAuthorization()` binds four things and PRINCIPAL is one of them:
  // "possession is not authority". THIS FUNCTION IS NOT THAT FUNCTION, and the
  // difference is G229 itself — the grant's subject is the INVITER, so a
  // principal binding here would refuse every acceptance that ever happens.
  //
  // This test exists because that is exactly the check a reader would "restore"
  // as a fix, and it would look like hardening.
  const { acceptInvitation } = await import('../../model/domain.ts')
  const result = acceptInvitation(
    invitation(),
    grant({ subjectUserId: INVITER }),
    redemption({ userId: INVITEE }),
  )
  assert.equal(
    result.ok,
    true,
    'Acceptance by someone who is not the grant\'s subject is the ONLY case that ever ' +
      'occurs. G229: the inviter holds the capability; the invitee holds the link.',
  )
})

test('the grant presented must be the one the invitation names — three bindings, not one', async () => {
  const { acceptInvitation } = await import('../../model/domain.ts')
  const cases = [
    [grant({ id: 'agr_other' as AuthorizationGrantId }), 'invitation_authorisation_mismatch'],
    [grant({ tenantId: OTHER_TENANT }), 'invitation_authorisation_tenant_mismatch'],
    [grant({ capability: 'view_document' }), 'invitation_authorisation_capability_mismatch'],
    [
      grant({
        resource: {
          resourceClass: 'authority',
          resourceType: 'Invitation',
          resourceId: 'inv_someone_else',
          solutionId: null,
        },
      }),
      'invitation_authorisation_resource_mismatch',
    ],
  ] as const
  for (const [g, expected] of cases) {
    const result = acceptInvitation(invitation(), g, redemption())
    assert.equal(result.ok, false, `${expected} was not refused`)
    assert.equal(result.ok === false ? result.refusal : null, expected)
  }
})

test('the resource binding is what stops ONE grant redeeming EVERY invitation in the tenant', async () => {
  // `redeemAuthorization()`'s own words for the same binding: "one grant, one
  // thing. Otherwise an authorisation to view ONE document reads the tenant's
  // whole corpus." Here the corpus is the tenant's membership roster.
  //
  // ⚠️ THIS FIXTURE IS THE ATTACK, NOT A TYPO. The second invitation reuses the
  // FIRST one's `grantId` — which is what an implementation that only checked
  // `grant.id === invitation.grantId` would wave through, because that check
  // passes. The resource binding is the one that refuses, and this test was
  // written expecting the wrong arm and corrected against the run: the
  // implementation caught a case the test author had reasoned past.
  const { acceptInvitation } = await import('../../model/domain.ts')
  const second = invitation({
    id: 'inv_second' as InvitationId,
    handleDigest: 'sha256:second-handle' as SessionHandleDigest,
  })
  assert.equal(second.grantId, GRANT, 'the fixture must reuse the first invitation\'s grant')
  const result = acceptInvitation(
    second,
    grant(),
    redemption({ handleDigest: 'sha256:second-handle' as SessionHandleDigest }),
  )
  assert.equal(result.ok, false)
  assert.equal(
    result.ok === false ? result.refusal : null,
    'invitation_authorisation_resource_mismatch',
    'A grant naming invitation A must not redeem invitation B. Without this binding one ' +
      '`manage_users` authorisation for ONE act reaches the tenant\'s whole roster.',
  )
})

test('G139 — the expiry refuses on ABSENCE, and the refusal carries no number', async () => {
  const { acceptInvitation, INVITATION_REFUSALS } = await import('../../model/domain.ts')
  for (const absent of ['', 'whenever', 'not-a-timestamp']) {
    const result = acceptInvitation(invitation({ expiresAt: absent }), grant(), redemption())
    assert.equal(result.ok, false, `\`expiresAt: ${JSON.stringify(absent)}\` was accepted`)
    assert.equal(result.ok === false ? result.refusal : null, 'invitation_expiry_not_stated')
  }
  const clockless = acceptInvitation(invitation(), grant(), redemption({ at: '' }))
  assert.equal(clockless.ok, false)
  assert.equal(clockless.ok === false ? clockless.refusal : null, 'invitation_clock_not_stated')

  // G139's second consequence, quoted on the row: the refusal needs "an arm
  // that can record an unconfigured bound WITH NO NUMBER IN IT". A refusal
  // carrying a default would be the default arriving by the back door.
  for (const refusal of Object.values(INVITATION_REFUSALS)) {
    assert.doesNotMatch(
      refusal,
      /\d/,
      `\`${refusal}\` carries a number. PRODUCT.md forbids inventing a duration and a ` +
        'refusal naming one states it just as loudly as a constant would.',
    )
  }
})

test('the refusal is a reasoned union and never a boolean, and every declared arm is REACHABLE', async () => {
  // #235: "a total `acceptInvitation()` returning a reasoned union — never a
  // boolean." And the other half, which `SIGN_IN_ATTEMPT_REFUSALS` states one
  // declaration over: "An arm nothing can return is the shape G223 calls out one
  // type over: a declaration with no producer."
  const { acceptInvitation, INVITATION_REFUSALS } = await import('../../model/domain.ts')
  const reached = new Set<string>()
  const inputs: ReadonlyArray<readonly [Invitation, AuthorizationGrant, ReturnType<typeof redemption>]> = [
    [invitation(), grant(), redemption({ handleDigest: 'sha256:wrong' as SessionHandleDigest })],
    [invitation({ acceptedAt: BEFORE_NOW }), grant(), redemption()],
    [invitation({ revokedAt: BEFORE_NOW }), grant(), redemption()],
    [invitation(), grant({ id: 'agr_other' as AuthorizationGrantId }), redemption()],
    [invitation(), grant({ tenantId: OTHER_TENANT }), redemption()],
    [invitation(), grant({ capability: 'view_document' }), redemption()],
    [
      invitation(),
      grant({
        resource: {
          resourceClass: 'authority',
          resourceType: 'Invitation',
          resourceId: null,
          solutionId: null,
        },
      }),
      redemption(),
    ],
    [invitation(), grant(), redemption({ at: 'never' })],
    [invitation({ expiresAt: '' }), grant(), redemption()],
    [invitation({ expiresAt: BEFORE_NOW }), grant(), redemption()],
  ]
  for (const [inv, g, r] of inputs) {
    const result = acceptInvitation(inv, g, r)
    assert.notEqual(typeof result, 'boolean')
    if (result.ok === false) reached.add(result.refusal)
  }
  assert.deepEqual(
    [...reached].sort(),
    Object.values(INVITATION_REFUSALS).sort(),
    'Every arm must be reachable. An arm nothing can return is a declaration with no ' +
      'producer — the defect G223 names one type over.',
  )
})

test('G229\'s consequence — an UNREDEEMED grant is visible as such, and standing is DERIVED', async () => {
  // G229's status row: "a grant minted at invitation time is live before anyone
  // accepts, so it needs an expiry and a revocation path, and AN UNREDEEMED
  // GRANT MUST BE VISIBLE AS SUCH — otherwise the grant ledger reads as
  // conferred access nobody holds."
  const { invitationStanding } = await import('../../model/domain.ts')
  assert.equal(invitationStanding(invitation(), NOW), 'pending')
  assert.equal(invitationStanding(invitation({ acceptedAt: BEFORE_NOW }), NOW), 'accepted')
  assert.equal(invitationStanding(invitation({ revokedAt: BEFORE_NOW }), NOW), 'revoked')
  assert.equal(invitationStanding(invitation({ expiresAt: BEFORE_NOW }), NOW), 'expired')
  assert.equal(
    invitationStanding(invitation({ expiresAt: '' }), NOW),
    'unstated',
    'An unparseable expiry must NOT read as `pending`. A bound with no number is not a ' +
      'bound, and the ledger would show conferred access nobody holds as merely awaited.',
  )
})

test('the standing is derived and NEVER stored, because a stored status can disagree with the row', () => {
  const source = codeOnly(DOMAIN_TEXT)
  const at = source.indexOf('export interface Invitation')
  // 🛑 WITHOUT THIS THE TEST PASSES AT BASE ON AN EMPTY STRING — §5.6, a control
  // that passes while asserting nothing, arriving inside the file written to
  // avoid it. Caught by reading the red run rather than by a checker.
  assert.notEqual(at, -1, '`Invitation` is not declared, so the sweep below reads nothing')
  const body = source.slice(at, source.indexOf('\n}', at))
  assert.doesNotMatch(
    body,
    /\bstanding\s*:|\bstatus\s*:|\bstate\s*:/,
    '`User.connectionId`\'s own comment rules the general case: "a stored copy of a ' +
      'derived fact is a copy that can disagree with the fact."',
  )
})

test('invariant 8 — acceptance mints a `Membership` and nothing that reaches a staff grant', async () => {
  // #235: "An invitation is a customer-side membership grant and must not become
  // a second route to a staff reach." Held by construction: the success arm's
  // only payload is a `Membership`, and staff reach is a `TenantAccessGrant`.
  const source = codeOnly(DOMAIN_TEXT)
  const at = source.indexOf('export function acceptInvitation')
  assert.notEqual(at, -1)
  const body = source.slice(at, source.indexOf('\n}', at))
  assert.doesNotMatch(
    body,
    /TenantAccessGrant|SupportAuthorisation|PartnerAccessGrant/,
    'Invariant 8: being staff is not access, and an invitation is not a second door to it.',
  )
})

test('invariant 1 — the tenant comes off the ROW, which the server issued, and never off the input', async () => {
  // #235: "Acceptance happens before a session exists, so nothing in that flow
  // may take a tenant from the request body except the invitation's own row,
  // which the server issued."
  const source = codeOnly(DOMAIN_TEXT)
  const at = source.indexOf('export interface InvitationRedemption')
  // Same §5.6 guard as the standing sweep above, and for the same reason.
  assert.notEqual(at, -1, '`InvitationRedemption` is not declared')
  const body = source.slice(at, source.indexOf('}', at))
  assert.doesNotMatch(
    body,
    /tenantId|tenant/i,
    'A `tenantId` on the acceptance input is invariant 1 defeated by relocation.',
  )
})
