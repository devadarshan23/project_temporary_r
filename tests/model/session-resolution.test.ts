/**
 * `resolveSubject()`, `orgFor()` and `TenantContext` — #224 [A-3].
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE EXISTS FOR
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `docs/build/stateless-red-session.md` B2: a single `resolveSession()` reads
 * the `tenant` row inside a transaction that has set only `app.session_ref`.
 * `tenant`'s policy is `USING (id = nullif(current_setting('app.tenant_id',
 * true), ''))`, ENABLEd and FORCEd, and `reconcile_app` holds neither
 * `BYPASSRLS` nor ownership — so that read returns ZERO ROWS and every
 * correctly-selected session is refused with `tenant_not_selected`, **the
 * refusal that means the opposite of what happened.**
 *
 * Repairing it in place is worse: the raw `tenant_id` column becomes the
 * producer of `app.tenant_id` BEFORE liveness has been checked, so the tenant
 * scope opens for revoked sessions and fired employees and is only then
 * refused. RULED 2 splits it, and this suite is the split's evidence.
 *
 * 🛑 THE SEAM IS PROVED BY THE SIGNATURE, NOT BY REVIEW.
 * `test_resolve_subject_takes_no_tenant_row_at_all` reads the declaration's
 * own bytes. A `Tenant` added to the parameter object reddens it, and no
 * amount of correct behaviour makes it green again — which is the point,
 * because the defect is not a wrong answer, it is reading a row too early.
 *
 * ⚠️ WHAT THE FIRST RED PROVED AND WHAT IT DID NOT. None of the three symbols
 * existed when this file was written, so the only red available was ABSENCE:
 * `TS2305: Module '../../model/access.ts' has no exported member
 * 'resolveSubject'`. An import error proves nothing about behaviour — the
 * discipline `tests/model/session-bounds.test.ts` and
 * `tests/model/managed-service.test.ts` both state for themselves. Every
 * assertion below was therefore additionally proved to BITE by mutation once
 * the implementation existed, and the mutations are recorded in the block at
 * the foot of this file.
 *
 * Every expected value below is a literal typed into this file, for the reason
 * `tests/model/access-decide.test.ts` gives: comparing a constant to itself
 * passes forever and witnesses nothing.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ORG_CLASSES,
  ORG_CLASS_FOR_CONNECTION_OWNER,
  SESSION_REFUSALS,
  TENANT_SELECTION_REFUSALS,
  orgFor,
  projectTenantContext,
  resolveSubject,
  selectTenantForSession,
} from '../../model/access.ts'
import type {
  SessionRefusal,
  TenantContext,
  TenantSelectionRefusal,
} from '../../model/access.ts'
import {
  acmeAuthenticatedSession,
  acmeEntraConnection,
  acmeRevokedSession,
  acmeScopedSession,
  platformStaffConnection,
  unprovedPartnerConnection,
} from '../../model/examples.ts'
import type {
  IdentityConnection,
  Membership,
  Session,
  Tenant,
  User,
} from '../../model/domain.ts'
import type {
  AccessExtension,
  AccessPurpose,
  AccessResourceClass,
  TenantAccessGrant,
} from '../../model/governance.ts'
import type {
  AccountId,
  MembershipId,
  PartnerId,
  RoleId,
  TenantAccessGrantId,
  TenantId,
  Timestamp,
  UserId,
} from '../../model/kernel.ts'
import type { ServedSurfaceKind } from '../../model/serving-host.ts'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const ACCESS_TEXT = readFileSync(join(REPO_ROOT, 'model', 'access.ts'), 'utf8')

/**
 * The same text with every comment removed — copied verbatim from
 * `tests/model/session-shape.test.ts`, which records why it exists: a sweep
 * for an ABSENCE has to read code, or the argument for the absence becomes
 * evidence against it. This slice's docblocks contain the words
 * `TenantScoped`, `Tenant` and `tenant_not_selected` many times over.
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

/** The source text of one declaration, from `export …name` to its closing brace column. */
function declarationText(text: string, opening: string): string {
  const at = text.indexOf(opening)
  assert.notEqual(at, -1, `declaration not found: ${opening}`)
  const end = text.indexOf('\n}', at)
  assert.notEqual(end, -1, `unterminated declaration: ${opening}`)
  return text.slice(at, end + 2)
}

const NOW = '2026-08-22T09:00:00Z' as Timestamp

/**
 * The session user, built here rather than imported. `model/examples.ts` has
 * no `User` fixture — `acmeSessionUser` is a module-private branded cast — so
 * a suite that needs a whole `User` builds one, and building one is what makes
 * the "every other field suggests customer" positive control possible.
 */
function user(o: {
  readonly id: UserId
  readonly connection: IdentityConnection
  readonly status: 'active' | 'disabled'
}): User {
  return {
    id: o.id,
    email: 'mei@acme.example',
    displayName: 'Mei Tan',
    status: o.status,
    connectionId: o.connection.id,
  }
}

const MEI = 'usr_ops_mei' as UserId

const liveUser = user({ id: MEI, connection: acmeEntraConnection, status: 'active' })

/** A session on the pooled host with a tenant already bound. The happy row. */
const scoped: Session = acmeScopedSession

/* ------------------------------------------------------------------ *
 * 1. `orgFor()` — the derivation that was described in two modules and
 *    executed nowhere
 * ------------------------------------------------------------------ */

/**
 * 🛑 THE POSITIVE CONTROL, AND THE OWNER DISAGREES WITH EVERY STORED VALUE ON
 * PURPOSE. `unprovedPartnerConnection` is `owner: { kind: 'partner' }` and
 * carries a claim on `acme.example` — a CUSTOMER's domain — with `verifiedAt:
 * null`. The user handed in has an `@acme.example` address and a customer-ish
 * display name. Every field a lazy derivation would reach for says `customer`;
 * the connection's owner says `partner`, and the owner is the only thing that
 * decides. A test that compared a constant to itself would pass forever.
 */
test('test_org_class_comes_from_the_connection_and_not_from_any_stored_value', () => {
  assert.equal(unprovedPartnerConnection.owner.kind, 'partner')
  assert.equal(orgFor(unprovedPartnerConnection.owner), 'partner')

  const customerLooking = user({
    id: MEI,
    connection: unprovedPartnerConnection,
    status: 'active',
  })
  assert.equal(customerLooking.email.endsWith('@acme.example'), true)
  assert.equal(
    orgFor(unprovedPartnerConnection.owner),
    'partner',
    'the owner decides. Routing chooses the door; the door decides.',
  )
})

test('test_org_for_is_total_over_all_three_owner_arms', () => {
  assert.equal(orgFor({ kind: 'platform' }), 'platform')
  assert.equal(orgFor({ kind: 'partner', partnerId: 'ptr_x' as PartnerId }), 'partner')
  assert.equal(orgFor({ kind: 'customer', accountId: 'acc_x' as AccountId }), 'customer')
})

/**
 * The record is a `Record<…, OrgClass>` so a fourth owner arm is a compile
 * error rather than a runtime default — the `CAPABILITY_RESOURCE_CLASS`
 * pattern. §5.10 says a total `Record` only bites where something CONSTRUCTS
 * one; `model/access.ts` constructs this one, and this test reads the
 * constructed keys rather than the type.
 */
test('test_the_owner_to_org_record_has_exactly_three_keys_and_no_default', () => {
  assert.deepEqual(Object.keys(ORG_CLASS_FOR_CONNECTION_OWNER).sort(), [
    'customer',
    'partner',
    'platform',
  ])
  assert.deepEqual(ORG_CLASS_FOR_CONNECTION_OWNER, {
    platform: 'platform',
    partner: 'partner',
    customer: 'customer',
  })
})

/**
 * ⚠️ THE IDENTITY MAP IS NOT A REDUNDANT ONE, AND THIS TEST IS WHY IT IS
 * WRITTEN OUT RATHER THAN DERIVED. `owner.kind` and `OrgClass` are two
 * vocabularies that agree today. `ORG_CLASSES` is the access axis; `owner.kind`
 * is a discriminant on a configuration row. A derivation `owner.kind as
 * OrgClass` would compile and would silently follow either one when they
 * diverge — and `TelemetryPlane` (`model/observability.ts`) is already a bare
 * alias of `OrgClass` in this tree, so the divergence is not hypothetical.
 */
test('test_the_three_org_classes_are_still_exactly_the_three_the_axis_declares', () => {
  assert.deepEqual(Object.values(ORG_CLASSES).sort(), [
    'customer',
    'partner',
    'platform',
  ])
})

/* ------------------------------------------------------------------ *
 * 2. `resolveSubject()` — the seam
 * ------------------------------------------------------------------ */

/**
 * 🛑 THE SEAM, PROVED BY THE SIGNATURE. RULED 2's whole content is that the
 * function that checks liveness does not read a `tenant` row, so that no
 * tenant scope is ever opened for a session that was going to be refused.
 *
 * Read from the declaration's own bytes with comments stripped, because the
 * paragraph above the declaration necessarily contains the word `Tenant`.
 */
test('test_resolve_subject_takes_no_tenant_row_at_all', () => {
  const decl = declarationText(
    codeOnly(ACCESS_TEXT),
    'export interface SubjectResolutionInput',
  )
  assert.equal(
    /\bTenant\b/.test(decl),
    false,
    'RULED 2: the resolver must not be able to reach a `tenant` row. It is not ' +
      'enough that it does not read one — the parameter must not offer one, or ' +
      'the next reader will pass it and the seam closes silently.',
  )
  assert.equal(/\bsession\b/.test(decl), true)
  assert.equal(/\bconnection\b/.test(decl), true)
})

test('a live, scoped session on its own door resolves', () => {
  const out = resolveSubject({
    session: scoped,
    user: liveUser,
    connection: acmeEntraConnection,
    now: NOW,
    surface: 'tenant',
  })
  assert.equal(out.ok, true)
  if (!out.ok) return
  /**
   * ⚠️ NARROWED ON THE DISCRIMINANT SINCE G727, AND THE NARROWING IS THE
   * ASSERTION. `ResolvedSubject` is a union and its CONSOLE arm has no
   * `tenantId` property at all, so reading one without this line is a compile
   * error rather than a `undefined` somebody has to notice. The `if` is not
   * defensive: it is how the type system is made to state *"this fixture is on
   * a tenant host and therefore has a tenant."*
   */
  assert.equal(out.subject.surface, 'tenant')
  if (out.subject.surface !== 'tenant') return
  assert.equal(out.subject.userId, MEI)
  assert.equal(out.subject.tenantId, 'ten_acme')
  assert.equal(out.subject.orgClass, 'customer')
  assert.equal(out.subject.partnerId, null)
})

/**
 * 🛑 THE ONE THIS SLICE EXISTS FOR, AND IT IS AN ORDERING ASSERTION.
 *
 * A revoked session that is ALSO unscoped must be refused as revoked. Under
 * the defect B2 describes, and under any implementation that checks scope
 * first, this row comes back `tenant_not_selected` — a refusal that tells an
 * operator the person needs to pick a tenant when what actually happened is
 * that the session was killed. Every other refusal test in this file passes
 * against that mutation, because every other fixture has a tenant bound.
 */
test('test_a_revoked_and_unselected_session_is_refused_as_revoked_not_as_tenant_not_selected', () => {
  const revokedAndUnscoped: Session = {
    ...acmeRevokedSession,
    tenantId: null,
  }
  const out = resolveSubject({
    session: revokedAndUnscoped,
    user: liveUser,
    connection: acmeEntraConnection,
    now: NOW,
    surface: 'tenant',
  })
  assert.equal(out.ok, false)
  if (out.ok) return
  assert.equal(out.refusal, 'session_revoked')
  assert.notEqual(
    out.refusal as SessionRefusal,
    'tenant_not_selected',
    'the refusal that means the opposite of what happened',
  )
})

test('a revoked session is refused', () => {
  const out = resolveSubject({
    session: acmeRevokedSession,
    user: liveUser,
    connection: acmeEntraConnection,
    now: NOW,
    surface: 'tenant',
  })
  assert.equal(out.ok, false)
  assert.equal(out.ok === false ? out.refusal : null, 'session_revoked')
})

test('an expired session is refused, and the clock is the caller`s', () => {
  const afterExpiry = '2026-08-23T00:00:00Z' as Timestamp
  const out = resolveSubject({
    session: scoped,
    user: liveUser,
    connection: acmeEntraConnection,
    now: afterExpiry,
    surface: 'tenant',
  })
  assert.equal(out.ok, false)
  assert.equal(out.ok === false ? out.refusal : null, 'session_expired')
})

/**
 * ⚠️ THE BOUNDARY IS `<=`, MATCHING `decide()` AND `redeemAuthorization()`
 * (`grant.expiresAt <= now` in both). A session whose expiry is exactly now
 * has expired. Written as its own case because `<` and `<=` differ on exactly
 * one instant and nothing else in this file would tell them apart.
 */
test('a session expiring exactly now is expired, not live', () => {
  const out = resolveSubject({
    session: scoped,
    user: liveUser,
    connection: acmeEntraConnection,
    now: scoped.expiresAt,
    surface: 'tenant',
  })
  assert.equal(out.ok, false)
  assert.equal(out.ok === false ? out.refusal : null, 'session_expired')
})

test('a disabled user is refused, and it is not the session that is wrong', () => {
  const out = resolveSubject({
    session: scoped,
    user: user({ id: MEI, connection: acmeEntraConnection, status: 'disabled' }),
    connection: acmeEntraConnection,
    now: NOW,
    surface: 'tenant',
  })
  assert.equal(out.ok, false)
  assert.equal(out.ok === false ? out.refusal : null, 'user_disabled')
})

test('a disabled connection is refused even with a live user and a live session', () => {
  const out = resolveSubject({
    session: scoped,
    user: liveUser,
    connection: { ...acmeEntraConnection, status: 'disabled' },
    now: NOW,
    surface: 'tenant',
  })
  assert.equal(out.ok, false)
  assert.equal(out.ok === false ? out.refusal : null, 'connection_disabled')
})

/**
 * 🛑 THE ORG-CLASS ORACLE, CLOSED. Without this arm a caller may hand in ANY
 * connection alongside the session, and `orgFor()` derives the organisation
 * from whatever arrived — which turns the one derivation invariant 2 rests on
 * into a request parameter. The rows must agree before either is read.
 */
test('test_a_connection_that_is_not_the_session_door_is_refused_before_org_is_derived', () => {
  const out = resolveSubject({
    session: scoped,
    user: liveUser,
    connection: platformStaffConnection,
    now: NOW,
    surface: 'tenant',
  })
  assert.equal(out.ok, false)
  assert.equal(out.ok === false ? out.refusal : null, 'connection_mismatch')
})

test('a user row that is not the session`s user is refused', () => {
  const out = resolveSubject({
    session: scoped,
    user: user({
      id: 'usr_someone_else' as UserId,
      connection: acmeEntraConnection,
      status: 'active',
    }),
    connection: acmeEntraConnection,
    now: NOW,
    surface: 'tenant',
  })
  assert.equal(out.ok, false)
  assert.equal(out.ok === false ? out.refusal : null, 'user_mismatch')
})

test('an authenticated but unscoped session is refused with tenant_not_selected', () => {
  const out = resolveSubject({
    session: acmeAuthenticatedSession,
    user: liveUser,
    connection: acmeEntraConnection,
    now: NOW,
    surface: 'tenant',
  })
  assert.equal(out.ok, false)
  assert.equal(out.ok === false ? out.refusal : null, 'tenant_not_selected')
})

/**
 * ⚠️ A DUAL-AFFILIATED CONSULTANT IS THE CASE `Session.connectionId` EXISTS
 * FOR, AND #224's BODY WOULD HAVE REFUSED IT.
 *
 * The issue lists `session.connectionId !== user.connectionId` among the
 * refusal arms. `Session.connectionId`'s own docblock, which landed after the
 * issue was filed, rules the opposite in as many words: *"org is a property of
 * HOW YOU AUTHENTICATED, not of who you are: a dual-affiliated consultant is
 * partner on Monday and customer on Tuesday, and each session has to record
 * which. `User.connectionId` records the person's directory; this records the
 * door they came through."* An arm refusing that disagreement makes the one
 * case the field was added for unreachable, so there is no such arm and this
 * test pins the absence.
 */
test('test_a_session_on_a_different_door_from_the_user_directory_is_NOT_refused', () => {
  const consultant = user({
    id: MEI,
    connection: unprovedPartnerConnection,
    status: 'active',
  })
  const out = resolveSubject({
    session: scoped,
    user: consultant,
    connection: acmeEntraConnection,
    now: NOW,
    surface: 'tenant',
  })
  assert.equal(
    out.ok,
    true,
    'Monday partner, Tuesday customer. Refusing this refuses the feature.',
  )
  assert.equal(
    out.ok === true ? out.subject.orgClass : null,
    'customer',
    'and the org comes from the DOOR the session used, not the user`s directory',
  )
})

/** A partner-owned door yields `partnerId`; every other door yields null. */
test('a partner door carries its partnerId onto the resolved subject', () => {
  const partnerSession: Session = {
    ...scoped,
    connectionId: unprovedPartnerConnection.id,
  }
  const out = resolveSubject({
    session: partnerSession,
    user: user({ id: MEI, connection: unprovedPartnerConnection, status: 'active' }),
    connection: unprovedPartnerConnection,
    now: NOW,
    surface: 'tenant',
  })
  assert.equal(out.ok, true)
  if (!out.ok) return
  assert.equal(out.subject.orgClass, 'partner')
  assert.equal(out.subject.partnerId, 'prt_meridian')
})

/** Every arm of the closed union is reachable, and nothing else is in it. */
test('test_the_session_refusal_set_is_closed_and_every_arm_is_reachable', () => {
  /**
   * ⚠️ NINE SINCE G2021, 22 Sep 2026. ⚠️ **THIS SAID EIGHT AND IS CORRECTED
   * RATHER THAN DELETED**, because the paragraph below is this assertion's
   * whole reason for existing and it is unchanged: G199's rule for
   * `TENANT_SELECTION_REFUSALS` governs this set too — an arm must arrive as a
   * **VISIBLE ADDITION TO A CLOSED UNION rather than a widened predicate
   * inside a function body**, and the only thing that makes an addition
   * visible is a test that counts. **It went RED on the commit that added
   * `surface_unreadable`, exactly as it went RED for
   * `console_session_is_tenant_bound`, and was deleted on purpose in that same
   * commit rather than adjusted ahead of it.**
   *
   * 🛑 THE NINTH IS THE ONE A READER SHOULD STOP AT, BECAUSE IT IS THE ONLY
   * ARM NO CALLER CAN PRODUCE. `surface_unreadable` is the `default` of
   * `resolveSubject()`'s exhaustive `switch`, and `ServedSurfaceKind` has two
   * members — so it is reachable only through a cast, and `§5b` below is the
   * cast. **That is deliberate and it is `0069`'s polarity**: the arm exists so
   * a THIRD member is a compile error at the `never` binding rather than a
   * silent tenant, which is what G1923 measured it being before.
   */
  assert.deepEqual(Object.values(SESSION_REFUSALS).sort(), [
    'connection_disabled',
    'connection_mismatch',
    'console_session_is_tenant_bound',
    'session_expired',
    'session_revoked',
    'surface_unreadable',
    'tenant_not_selected',
    'user_disabled',
    'user_mismatch',
  ])
})

/**
 * §5b · THE NINTH ARM, EXECUTED — G2021, 22 Sep 2026.
 *
 * 🛑 **THIS IS G1923'S MEASUREMENT WITH ITS SIGN REVERSED, AND THE OLD VALUE
 * IS QUOTED SO THE CHANGE IS READABLE RATHER THAN INFERRED.** Before the
 * guard, this exact call returned
 * `{"ok":true,"subject":{"surface":"tenant","userId":"usr_ops_mei",
 * "tenantId":"ten_acme","orgClass":"customer","partnerId":null}}` — the
 * function REWROTE the unknown surface to `tenant` and handed back a scope.
 *
 * ⚠️ THE CAST IS THE POINT AND NOT A SHORTCUT: it stands in for the member a
 * future commit would add, and measures what that commit gets for free on the
 * day it adds it. With the `never` binding in place that commit does not GET
 * this far — it gets a `TS2322` — which is why this assertion is about the
 * runtime fall-back rather than about the expected path.
 */
test('test_a_surface_outside_the_closed_set_is_refused_and_never_laundered_into_a_tenant', () => {
  const out = resolveSubject({
    session: scoped,
    user: liveUser,
    connection: acmeEntraConnection,
    now: NOW,
    surface: 'public' as unknown as ServedSurfaceKind,
  })
  assert.equal(
    out.ok,
    false,
    'an unknown surface RESOLVED. That is G1923 returning: the reader answers a value it ' +
      'does not recognise, in the direction that grants scope. The repair is the `never` ' +
      'default in `resolveSubject()`, not a narrower caller.',
  )
  assert.equal(
    out.ok === false ? out.refusal : '',
    SESSION_REFUSALS.surfaceUnreadable,
    'an unknown surface was refused under some OTHER name, which reports a specific and ' +
      'untrue thing about the session. `0069`: an unknown value must reach the model as an ' +
      '`*_unreadable` refusal.',
  )
})

/** No `throw` in the added band — the discipline `model/reconciliation.ts` holds. */
test('resolveSubject never throws — a malformed row is a refusal, not an exception', () => {
  const out = resolveSubject({
    session: { ...scoped, userId: '' as UserId },
    user: liveUser,
    connection: acmeEntraConnection,
    now: NOW,
    surface: 'tenant',
  })
  assert.equal(out.ok, false)
})

/* ------------------------------------------------------------------ *
 * 3. `TenantContext` — seven references on the wire, zero in the model
 * ------------------------------------------------------------------ */

const acmeTenantRow = {
  id: 'ten_acme' as TenantId,
  environment: 'production',
  residency: 'ap-southeast-1',
  deploymentMode: 'hosted',
} as const

/**
 * The projection takes an ALREADY-SCOPED `Tenant`. That is the other side of
 * the seam: `resolveSubject()` may not see one, and this may not be called
 * until the scope `resolveSubject()`'s answer opened has returned a row.
 */
test('projectTenantContext carries exactly the four keys the wire declares', () => {
  const tenant = {
    ...acmeTenantRow,
    name: 'Acme Pte Ltd',
  } as unknown as Tenant
  const ctx: TenantContext = projectTenantContext(tenant)
  assert.deepEqual(Object.keys(ctx).sort(), [
    'deploymentMode',
    'environment',
    'residency',
    'tenantId',
  ])
  assert.equal(ctx.tenantId, 'ten_acme')
  assert.equal(ctx.environment, 'production')
  assert.equal(ctx.residency, 'ap-southeast-1')
  assert.equal(ctx.deploymentMode, 'hosted')
})

/**
 * 🛑 `_TenantContextIsNotARow`, AND THE TYPE SYSTEM CANNOT STATE IT.
 *
 * #224 asks for a type-level assertion that `TenantContext` never extends
 * `TenantScoped`. It is inexpressible: `TenantScoped` is `{ tenantId:
 * TenantId }` (`model/kernel.ts`) and `TenantContext.tenantId` is a non-null
 * `TenantId`, so `TenantContext extends TenantScoped` is STRUCTURALLY TRUE
 * whether or not the clause is written. `AssertFalse<TenantContext extends
 * TenantScoped ? true : false>` is therefore red on a CORRECT declaration and
 * can never go green — the measured result is recorded in the mutation block
 * at the foot of this file.
 *
 * `_SessionIsNotTenantScoped` (`model/identity.ts`) works only because
 * `Session.tenantId` is `TenantId | null`, which genuinely fails the
 * constraint. The nullability is doing the work there, not the assertion.
 *
 * So the control is textual, and it is the one the acceptance criterion names:
 * writing the `extends` clause reddens exactly this test.
 */
test('test_tenant_context_is_not_a_row', () => {
  const code = codeOnly(ACCESS_TEXT)
  assert.equal(
    /export interface TenantContext extends/.test(code),
    false,
    'A stored derivation is a cache with a staleness window over authority. ' +
      '`TenantContext` is projected per request from a tenant row that was read ' +
      'inside the scope the resolver authorised; it is never itself a row.',
  )
  assert.equal(/export interface TenantContext\b/.test(code), true)
})

/**
 * ⚠️ THE CONTRACT DEBT, RECORDED RATHER THAN PAID. `TenantContext`'s wire
 * schema (`docs/contracts/foundation.openapi.yaml:876`) is
 * `required: [tenantId, environment, residency, deploymentMode]` with
 * `additionalProperties: false`. It gains `orgClass` when the session wire
 * lands — the open item the access record has carried since 5 Aug — **and it
 * gains nothing else.** It does not gain `sessionId` and it does not gain
 * `handleDigest`. The model twin mirrors the wire as it stands today, so the
 * two move together in one commit when that day comes.
 */
test('test_tenant_context_does_not_carry_a_session_id_or_a_handle_digest', () => {
  const decl = declarationText(codeOnly(ACCESS_TEXT), 'export interface TenantContext')
  for (const forbidden of ['sessionId', 'handleDigest', 'orgClass', 'userId']) {
    assert.equal(
      new RegExp(`\\b${forbidden}\\b`).test(decl),
      false,
      `${forbidden} is not on the wire schema and must not be on its model twin`,
    )
  }
})

/* ==================================================================== *
 * MUTATIONS RUN, AND WHAT EACH CAUGHT
 * --------------------------------------------------------------------
 * Recorded because an assertion nobody has watched fail is a comment with
 * extra steps. `tsc` was GREEN under every one of M1–M5.
 *
 *   M1  🛑 THE ONE THE SLICE EXISTS FOR. Move the `tenantId === null` arm to
 *       the TOP of `resolveSubject()`, ahead of every liveness check — which
 *       is what the in-place repair of B2 produces.
 *       → 1 red, and only one: `test_a_revoked_and_unselected_session_is_
 *          refused_as_revoked_not_as_tenant_not_selected`. Every other refusal
 *          fixture carries a bound tenant and passes unharmed, which is exactly
 *          why that fixture had to be built rather than reused.
 *
 *   M2  Delete the `connection_mismatch` arm.
 *       → 1 red: `test_a_connection_that_is_not_the_session_door_is_refused_
 *          before_org_is_derived`, and ONLY that one. The closure test stays
 *          green because `SESSION_REFUSALS` still DECLARES the arm — an arm
 *          declared and never returned is invisible to a set comparison, which
 *          is worth knowing before anyone reads that test as coverage. Under
 *          the mutant a caller supplies the connection and therefore supplies
 *          the ORG CLASS, which is invariant 2's single derivation becoming a
 *          request parameter.
 *
 *   M3  `orgFor()` implemented as `owner.kind as OrgClass` instead of reading
 *       the total `Record`.
 *       → 0 red. Recorded because it is the honest result: the two vocabularies
 *          agree today, so no behavioural test can separate them. What the
 *          `Record` buys is the COMPILE error on a fourth owner arm, and that is
 *          witnessed by M4 rather than by a runtime assertion. A test claiming
 *          otherwise would be theatre.
 *
 *   M4  Add a fourth arm `{ kind: 'regulator' }` to `IdentityConnection.owner`
 *       in `model/domain.ts` and leave `ORG_CLASS_FOR_CONNECTION_OWNER` alone.
 *       → `tsc` RED, **TS2741** — property 'regulator' is missing in the record.
 *          0 tests red. This is the whole reason the map is a total `Record` and
 *          not a function with a default, and it is one of two mutations in this
 *          slice that the compiler catches and the runner cannot.
 *
 *   M5  `session.expiresAt <= now` → `<`.
 *       → 1 red: `a session expiring exactly now is expired, not live`. One
 *          instant, and nothing else in the suite separates the two operators.
 *
 *   M6  `interface TenantContext extends TenantScoped` — the acceptance
 *       criterion's own mutation.
 *       → 1 red: `test_tenant_context_is_not_a_row`. `tsc` GREEN, which is the
 *          finding: adding the clause changes no type, so no type-level control
 *          could ever see it.
 *
 *          🛑 AND THE TYPE-LEVEL ASSERTION #224 ASKED FOR WAS ATTEMPTED AND
 *          MEASURED RATHER THAN ARGUED AWAY. Compiled against the CORRECT
 *          declaration, with `model/tsconfig.json`:
 *
 *            type _Probe<T extends false> = T
 *            export type _TenantContextIsNotARowProbe =
 *              _Probe<TenantContext extends TenantScoped ? true : false>
 *
 *            model/access.ts(3584,3): error TS2344:
 *              Type 'true' does not satisfy the constraint 'false'.
 *
 *          Red on a correct declaration, and it can never go green, because
 *          `TenantScoped` is `{ tenantId: TenantId }` and structural typing
 *          makes the relation hold whether or not the clause is written. The
 *          textual control is not a weaker substitute chosen for convenience;
 *          it is the only form of the statement that can be true.
 * ==================================================================== */

/* ==================================================================== *
 * 8 · `selectTenantForSession()` — G199 (S-21) and G210, for #157 [M1-2]
 *
 * 🛑 THE MODEL HALF OF A CONTROL WHOSE OTHER HALF IS A MIGRATION, AND #157
 *    RULES THAT NEITHER SHIPS ALONE: *"This slice lands the model half and the
 *    database half together, because either alone is a defeat."* The database
 *    half is `db/migrations/0005_session_and_membership.sql`'s `AS RESTRICTIVE`
 *    `WITH CHECK`, exercised in `tests/db/session-membership-selection.test.ts`.
 *    **If you are reading this section to decide whether the control holds, you
 *    have read half of it.**
 *
 * WHAT WAS WRONG WITHOUT IT — `docs/build/stateless-red-session.md` B1. The
 * request-supplied tenant did not disappear when invariant 1 was written down;
 * it moved into the one write that establishes a scope, and nothing constrained
 * what that write may write.
 * ==================================================================== */

/**
 * ⚠️ BUILT HERE, NOT IMPORTED, AND FOR `user()`'s REASON ONE SECTION UP.
 * `model/examples.ts` has no `Membership` fixture, and this suite needs rows
 * that DISAGREE with each other — a live one, a revoked one, an expired one,
 * one belonging to somebody else — which a single shared fixture cannot be.
 *
 * Every field `Membership` declares is stated, because a partial builder with
 * defaults is how a test ends up asserting against a row no production path
 * could produce.
 */
function membership(o: {
  readonly id: string
  readonly userId: UserId
  readonly tenantId: TenantId
  readonly expiresAt?: Timestamp | null
  readonly revokedAt?: Timestamp | null
}): Membership {
  return {
    id: o.id as MembershipId,
    userId: o.userId,
    tenantId: o.tenantId,
    roleId: 'rol_pack_ap_approver' as RoleId,
    grantedBy: 'usr_acme_admin' as UserId,
    grantedAt: '2026-08-01T00:00:00Z' as Timestamp,
    expiresAt: o.expiresAt ?? null,
    revokedAt: o.revokedAt ?? null,
  }
}

const ACME_TENANT = 'ten_acme' as TenantId
const GLOBEX_TENANT = 'ten_globex' as TenantId

/** The live membership the happy path turns on. Never expires — direct staff. */
const meiInAcme = membership({ id: 'mem_acme_mei', userId: MEI, tenantId: ACME_TENANT })

test('a live membership in the host-bound tenant is the whole of the happy path', () => {
  const out = selectTenantForSession({
    session: scoped,
    hostBoundTenantId: ACME_TENANT,
    memberships: [meiInAcme],
    now: NOW,
  })

  assert.deepEqual(out, { ok: true, tenantId: ACME_TENANT })
})

/**
 * 🛑 THE POSITIVE CONTROL, AND IT IS THE FAILURE B1 DESCRIBES IN ONE CALL.
 * The principal is a real member of a real tenant — just not this one. A check
 * that answered "is this person a member of anything" rather than "of THIS"
 * would pass here, and that is exactly the check a hurried implementation
 * writes.
 */
test('a membership in ANOTHER tenant does not bind THIS one — B1 in one call', () => {
  const out = selectTenantForSession({
    session: scoped,
    hostBoundTenantId: ACME_TENANT,
    memberships: [membership({ id: 'mem_globex_mei', userId: MEI, tenantId: GLOBEX_TENANT })],
    now: NOW,
  })

  assert.deepEqual(out, { ok: false, refusal: 'membership_absent' })
})

/**
 * The other half of the same control. Somebody IS a member of the host tenant;
 * it is not the principal. A check that matched on `tenantId` alone passes here.
 */
test('somebody else`s membership in the right tenant binds nothing', () => {
  const out = selectTenantForSession({
    session: scoped,
    hostBoundTenantId: ACME_TENANT,
    memberships: [
      membership({ id: 'mem_acme_ana', userId: 'usr_ops_ana' as UserId, tenantId: ACME_TENANT }),
    ],
    now: NOW,
  })

  assert.deepEqual(out, { ok: false, refusal: 'membership_absent' })
})

test('no membership at all is refused, and the refusal names the absence', () => {
  const out = selectTenantForSession({
    session: scoped,
    hostBoundTenantId: ACME_TENANT,
    memberships: [],
    now: NOW,
  })

  assert.deepEqual(out, { ok: false, refusal: 'membership_absent' })
})

/**
 * 🛑 A REVOKED ROW IS STILL A ROW. `Membership.revokedAt` is *"retained rather
 * than deleted, so a transfer between partners is auditable"*, so an `EXISTS`
 * on `(userId, tenantId)` — which is the obvious implementation — would
 * re-grant every membership anybody ever lost.
 */
test('a REVOKED membership binds nothing, and is not a separate refusal', () => {
  const out = selectTenantForSession({
    session: scoped,
    hostBoundTenantId: ACME_TENANT,
    memberships: [
      membership({
        id: 'mem_acme_mei_old',
        userId: MEI,
        tenantId: ACME_TENANT,
        revokedAt: '2026-08-10T00:00:00Z' as Timestamp,
      }),
    ],
    now: NOW,
  })

  assert.deepEqual(
    out,
    { ok: false, refusal: 'membership_absent' },
    'G199 fixes the refusal set at ONE member so that a later arm is a visible ' +
      'addition to a closed union. `membership_revoked` would also be an ORACLE: it ' +
      'tells whoever holds the handle that the tenant exists, that they were once in ' +
      'it, and roughly when that changed.',
  )
})

test('an EXPIRED membership binds nothing — the term B1`s quoted predicate omits', () => {
  const out = selectTenantForSession({
    session: scoped,
    hostBoundTenantId: ACME_TENANT,
    memberships: [
      membership({
        id: 'mem_acme_mei_temp',
        userId: MEI,
        tenantId: ACME_TENANT,
        expiresAt: '2026-08-21T00:00:00Z' as Timestamp,
      }),
    ],
    now: NOW,
  })

  assert.deepEqual(
    out,
    { ok: false, refusal: 'membership_absent' },
    'B1 writes the control as `… AND m.revoked_at IS NULL` and stops there. An ' +
      'expired membership is not revoked, so that predicate alone would let a lapsed ' +
      'partner-scoped membership bind a tenant forever — and `Membership.expiresAt` ' +
      'rules that "partner-scoped memberships must expire." Both halves of this slice ' +
      'carry the term; the divergence from B1 is named on both.',
  )
})

test('a membership expiring exactly NOW is expired, matching every other clock in `model/`', () => {
  const out = selectTenantForSession({
    session: scoped,
    hostBoundTenantId: ACME_TENANT,
    memberships: [
      membership({ id: 'mem_now', userId: MEI, tenantId: ACME_TENANT, expiresAt: NOW }),
    ],
    now: NOW,
  })

  assert.deepEqual(
    out,
    { ok: false, refusal: 'membership_absent' },
    '`expiresAt <= now` is the comparison `decide()`, `redeemAuthorization()` and ' +
      '`resolveSubject()` all use. A boundary that differed here would be one more ' +
      'thing to fix when the timestamp codec G111 calls for is finally written.',
  )
})

test('`expiresAt: null` means DOES NOT EXPIRE, not an absence to refuse on', () => {
  const out = selectTenantForSession({
    session: scoped,
    hostBoundTenantId: ACME_TENANT,
    memberships: [meiInAcme],
    now: '2099-01-01T00:00:00Z' as Timestamp,
  })

  assert.deepEqual(out, { ok: true, tenantId: ACME_TENANT })
})

/**
 * 🛑 THE ANTI-RUBBER-STAMP CONTROL, AND IT IS THE DIFFERENCE BETWEEN A CHECK
 * AND A SIGNATURE. `session.tenantId` is the field B1's attacker has already
 * written. If this function consulted it — even as a shortcut, even as an
 * "it already agrees" fast path — the check would confirm the attack.
 *
 * Both directions are asserted, because either alone is satisfiable by a bug:
 * a session carrying the WRONG tenant with a RIGHT membership resolves, and a
 * session carrying the RIGHT tenant with NO membership is refused.
 */
test('test_the_stored_tenant_on_the_session_is_never_consulted', () => {
  const carryingGlobex: Session = { ...scoped, tenantId: GLOBEX_TENANT }
  assert.deepEqual(
    selectTenantForSession({
      session: carryingGlobex,
      hostBoundTenantId: ACME_TENANT,
      memberships: [meiInAcme],
      now: NOW,
    }),
    { ok: true, tenantId: ACME_TENANT },
    'the decision followed the session`s stored tenant rather than the host binding',
  )

  const carryingAcme: Session = { ...scoped, tenantId: ACME_TENANT }
  assert.deepEqual(
    selectTenantForSession({
      session: carryingAcme,
      hostBoundTenantId: ACME_TENANT,
      memberships: [],
      now: NOW,
    }),
    { ok: false, refusal: 'membership_absent' },
    'A SESSION ALREADY CARRYING A TENANT WAS TREATED AS EVIDENCE THAT IT SHOULD. That ' +
      'is B1 exactly: the attacker wrote that column, and a check that reads it ' +
      'confirms the write it exists to refuse.',
  )
})

/**
 * ══════════════════════════════════════════════════════════════════════════
 * ✅ AMENDED 19 Sep 2026 — S-21. IT WENT RED, AND THE RED WAS THE POINT.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * 🛑 THE OLD ASSERTION AND ITS FAILURE ARE QUOTED RATHER THAN DELETED, because
 *    a control that fires and is then edited leaves no trace of having fired:
 *
 *        const input = declarationText(codeOnly(ACCESS_TEXT),
 *                                      'export interface TenantSelectionInput {')
 *        assert.ok(!/staffGrant|TenantAccessGrant/.test(input),
 *          'THE STAFF ARM HAS LANDED AND THIS TEST IS NOW WRONG — which is what
 *           it is for. Three things belong in the commit that changed it: the
 *           `OR EXISTS (… tenant_access_grant …)` disjunct in 0005`s successor,
 *           the three-list check — `PERMITTED_RESOURCES`,
 *           `CONTRACT_ONLY_RESOURCES` and `NON_DELEGABLE_RESOURCES`, all three
 *           in ONE helper with ONE call site, because `authorisationPermits()`
 *           tests the third FIRST — and the deletion of this assertion.'
 *
 *        ✖ AssertionError: … actual: false, expected: true
 *
 *    All three things it named are in the commit that reddened it:
 *    `db/migrations/0008_staff_grant_selection.sql`'s disjunct, the three-list
 *    check as ONE call to `authorisationPermits()` inside
 *    `selectTenantForSession()`, and this edit. The fourth thing it could not
 *    name — *"the owner's answer on what liveness terms admit a grant"* — is
 *    **G292**, taken the same day: unrevoked, unexpired, within the ceiling.
 *
 * ⚠️ WHAT SURVIVES IS THE HALF THAT WAS NEVER A COST. *"A platform FDE has no
 *    `Membership`"* is still true and is still what being platform staff MEANS;
 *    §8b below is the arm that reaches a tenant without one. This test now holds
 *    the line the staff arm must not cross — **a membership-shaped staff path**
 *    — because a staff arm built by handing staff a `Membership` would satisfy
 *    every other assertion in this file and would delete invariant 8 rather than
 *    enforce it.
 */
test('test_the_staff_path_is_by_GRANT_and_only_by_grant_which_is_what_G199s_cost_became', () => {
  const staffSession: Session = {
    ...scoped,
    userId: 'usr_platform_fde' as UserId,
    connectionId: platformStaffConnection.id,
  }

  assert.deepEqual(
    selectTenantForSession({
      session: staffSession,
      hostBoundTenantId: ACME_TENANT,
      // Every membership in the system. None is the FDE's, and none can be:
      // staff reach a tenant by `TenantAccessGrant`, not by membership.
      memberships: [meiInAcme],
      now: NOW,
    }),
    { ok: false, refusal: 'membership_absent' },
    'A STAFF PRINCIPAL OFFERING NO GRANT WAS ADMITTED. The membership arm is unchanged by ' +
      'S-21 and must stay unchanged: staff hold no membership, so the only way this could ' +
      'pass is if the arm stopped joining on the principal.',
  )

  /**
   * 🛑 AND THE REFUSAL IS `membership_absent`, NOT `access_grant_absent`. The
   * name is a fact about what the caller OFFERED — nothing was offered here, so
   * the membership arm was the only arm available. A staff-flavoured refusal for
   * a caller who presented no grant would be the oracle both names are shaped to
   * avoid, one step earlier.
   */
  const input = declarationText(codeOnly(ACCESS_TEXT), 'export interface TenantSelectionInput {')
  /**
   * ⚠️ THE TYPE MOVED ON 19 Sep 2026 AND THE ASSERTION IS AMENDED RATHER THAN
   * DELETED — G729. **It read `/staffGrant\?: TenantAccessGrant \| null/`**,
   * quoting G199's own words: *"adding `staffGrant: TenantAccessGrant | null`
   * to `TenantSelectionInput`"*. The field is now `StaffGrantTerms | null`.
   *
   * 🛑 THAT IS A WIDENING OF THE PARAMETER, NOT A WEAKENING OF THE CHECK, AND
   * THE NEXT TWO ASSERTIONS ARE WHAT MAKE THAT MORE THAN A CLAIM: the field is
   * still SINGULAR and still OPTIONAL-BUT-FAIL-CLOSED, which is the whole of
   * what G199's shape was protecting. A `TenantAccessGrant` is still
   * assignable here — `tests/model/staff-grant-terms.test.ts` §2 witnesses
   * exactly that, by passing a whole one — and what the widening buys is that
   * `db/migrations/0008`, which stores eight of the interface's nineteen
   * fields, can be READ without eleven of them being invented.
   *
   * ⚠️ AND THE THING THIS ASSERTION IS ACTUALLY FOR IS UNCHANGED: the grant
   * arrives as a NAMED PARAMETER. A staff arm that reached it off the session,
   * off a membership row or out of a lookup would be the widened predicate
   * inside a function body that G199 refuses, and that is still what a
   * disappearance of this field would mean.
   */
  assert.match(
    input,
    /staffGrant\?: StaffGrantTerms \| null/,
    'G199 names the FIELD, the TYPE and the SHAPE: "adding `staffGrant: TenantAccessGrant ' +
      '| null` to `TenantSelectionInput`". G729 widens the TYPE to `StaffGrantTerms` — a ' +
      'narrowed projection a whole grant still satisfies — and touches neither the field ' +
      'nor the shape. A staff arm that reached the grant any other way — off the session, ' +
      'off a membership row, out of a lookup — would be a widened predicate inside a ' +
      'function body, which is the shape the ruling refuses.',
  )
  for (const plural of ['staffGrants', 'grants', 'availableGrants']) {
    assert.ok(
      !input.includes(plural),
      `\`TenantSelectionInput.${plural}\` exists. A PLURAL grant parameter is a menu of ` +
        'authorities, and the caller would be choosing which one to present — the selector ' +
        'G210 dropped, wearing staff clothing.',
    )
  }
})

test('the tenant-selection refusal set is CLOSED and has exactly TWO members', () => {
  /**
   * ⚠️ THIS TEST READ `…has exactly one member` AND ASSERTED
   * `['membership_absent']`, AND IT WENT RED AT
   * `actual: [ 'membership_absent', 'access_grant_absent' ]` ON THE COMMIT THAT
   * LANDED THE STAFF ARM. That is G199's acceptance condition met, not evaded:
   * *"the refusal set has exactly one member so any later arm is a VISIBLE
   * ADDITION TO A CLOSED UNION rather than a widened predicate inside a function
   * body."* **The addition was visible because this line counted.**
   *
   * 🛑 THE COUNT IS PINNED AGAIN, AT TWO, FOR THE SAME REASON IT WAS PINNED AT
   * ONE. A third member is a third thing a door can say about why it said no,
   * and each one is a sentence somebody at the door can use to learn about a
   * tenant they cannot reach. Adding one must cost a red.
   */
  const members = Object.values(TENANT_SELECTION_REFUSALS)
  assert.deepEqual(members, ['membership_absent', 'access_grant_absent'])

  // Reused, not minted: BOTH names are already wire codes in
  // `docs/contracts/errors.yaml`, and `tests/contracts/session-error-vocabulary.test.mjs`
  // lists the first among "THE FOUR THAT ALREADY EXIST … this slice REUSES them
  // rather than minting a session-flavoured twin of each." `access_grant_absent`
  // is the control plane's word for "a session reported against a grant we do
  // not hold" — the same fact from the other end of the same relationship.
  const refusal: TenantSelectionRefusal = 'membership_absent'
  assert.equal(refusal, TENANT_SELECTION_REFUSALS.membershipAbsent)
  const staffRefusal: TenantSelectionRefusal = 'access_grant_absent'
  assert.equal(staffRefusal, TENANT_SELECTION_REFUSALS.accessGrantAbsent)

  const errorsYaml = readFileSync(join(REPO_ROOT, 'docs', 'contracts', 'errors.yaml'), 'utf8')
  for (const code of members) {
    assert.match(
      errorsYaml,
      new RegExp(`^\\s+- ${code}$`, 'm'),
      `\`${code}\` is not in \`errors.yaml\`'s CLOSED enum, so this refusal cannot be ` +
        'returned on the wire at all. G199 reused `membership_absent` rather than minting ' +
        'a twin, and the staff arm reuses `access_grant_absent` for the same reason: a ' +
        'refusal a tier cannot express is a refusal that becomes a 500.',
    )
  }
})

test('selectTenantForSession never throws — a malformed row is a refusal, not an exception', () => {
  const nonsense = [
    { ...meiInAcme, userId: undefined },
    { ...meiInAcme, tenantId: undefined },
    { ...meiInAcme, revokedAt: undefined },
    { ...meiInAcme, expiresAt: undefined },
  ] as unknown as readonly Membership[]

  for (const row of nonsense) {
    assert.doesNotThrow(() =>
      selectTenantForSession({
        session: scoped,
        hostBoundTenantId: ACME_TENANT,
        memberships: [row],
        now: NOW,
      }),
    )
  }

  // `revokedAt: undefined` is the one to read: `!== null` is true for
  // `undefined`, so the row is skipped rather than admitted. Fail-closed, which
  // is the polarity `DENY_ALL` and G100 both hold.
  assert.deepEqual(
    selectTenantForSession({
      session: scoped,
      hostBoundTenantId: ACME_TENANT,
      memberships: [{ ...meiInAcme, revokedAt: undefined } as unknown as Membership],
      now: NOW,
    }),
    { ok: false, refusal: 'membership_absent' },
  )
})

/* ==================================================================== *
 * 8b · THE STAFF ARM — S-21, G199's shape and G292's terms, 19 Sep 2026.
 *
 * 🛑 READ §8's DECLARED-COST TEST FIRST. It asserted for thirty-four days that
 *    everything below was impossible, and it went RED in the commit that landed
 *    these. The order is the control: the red first, the amendment second. A
 *    test edited to fit an implementation asserts the implementation.
 *
 * ⚠️ THE DATABASE HALF IS `db/migrations/0008_staff_grant_selection.sql`, and
 *    `tests/db/session-membership-selection.test.ts` runs every fixture through
 *    BOTH and requires the verdicts to match. **If you are reading this section
 *    to decide whether the staff arm holds, you have read half of it.**
 * ==================================================================== */

const FDE = 'usr_platform_fde' as UserId

/** A platform FDE's session. No membership anywhere, by definition. */
const staffSession: Session = {
  ...scoped,
  userId: FDE,
  connectionId: platformStaffConnection.id,
}

/**
 * ⚠️ BUILT HERE, NOT IMPORTED, FOR `membership()`'s REASON ONE SECTION UP, AND
 * EVERY FIELD `TenantAccessGrant` DECLARES IS STATED. A partial builder with
 * defaults is how a test ends up asserting against a row no production path
 * could produce — and this type has twenty-one fields, five of which
 * `evaluateTenantAccess()` refuses on. Stating them all is what keeps the
 * fixtures HONEST rather than merely convenient: every grant below would also
 * survive a use-time evaluation, so a refusal here is the SELECTION arm's and
 * never a malformed row's.
 */
function staffGrantFor(o: {
  readonly id: string
  readonly tenantId?: TenantId
  readonly staffUserId?: UserId
  readonly purpose?: AccessPurpose
  readonly grantedAt?: Timestamp
  readonly expiresAt?: Timestamp
  readonly revokedAt?: Timestamp | null
  readonly resources?: readonly AccessResourceClass[]
  readonly extensions?: readonly AccessExtension[]
}): TenantAccessGrant {
  const purpose = o.purpose ?? 'delivery'
  return {
    id: o.id as TenantAccessGrantId,
    tenantId: o.tenantId ?? ACME_TENANT,
    purpose,
    staffUserId: o.staffUserId ?? FDE,
    /* A DIFFERENT person. The two-person rule is `evaluateTenantAccess()`'s to
     * enforce and not this arm's — but a self-approved fixture is a row no
     * correct issuing path could produce, and asserting against one of those
     * proves something about a state the product cannot reach. */
    approvedByStaffUserId: 'usr_platform_approver' as UserId,
    justification: 'a fixture, and the field is required and shown to the customer',
    resources: (o.resources ?? ['configuration']).map((resource) => ({
      resource,
      mode: 'read' as const,
      nominatedSubjectIds: [],
    })),
    grantedAt: o.grantedAt ?? ('2026-08-01T00:00:00Z' as Timestamp),
    expiresAt: o.expiresAt ?? ('2026-09-01T00:00:00Z' as Timestamp),
    engagementRef: purpose === 'delivery' ? 'eng_acme_2026' : null,
    idleRevokeDays: 14,
    lastUsedAt: null,
    extensions: [...(o.extensions ?? [])],
    visibleToTenant: true,
    customerNotifiedAt: '2026-08-01T01:00:00Z' as Timestamp,
    customerApprovedAt: null,
    revokedAt: o.revokedAt ?? null,
    revokedBy: null,
    revocationReason: null,
  }
}

/** 31 days of a 90-day ceiling, live at `NOW`, claiming two permitted classes. */
const liveDeliveryGrant = staffGrantFor({
  id: 'tag_live',
  resources: ['configuration', 'tenant_data'],
})

function selectAsStaff(grant: TenantAccessGrant | null, host: TenantId = ACME_TENANT) {
  return selectTenantForSession({
    session: staffSession,
    hostBoundTenantId: host,
    /* The haystack, containing everybody's membership and none of the FDE's.
     * Passing it rather than `[]` makes "staff hold no membership" a fact the
     * call re-derives instead of one the harness assumes. */
    memberships: [meiInAcme],
    staffGrant: grant,
    now: NOW,
  })
}

test('✅ INVARIANT 8 · a live TenantAccessGrant binds the tenant for a platform FDE', () => {
  assert.deepEqual(
    selectAsStaff(liveDeliveryGrant),
    { ok: true, tenantId: ACME_TENANT },
    'THE PERMITTED PATH IS STILL UNREACHABLE. #157: "A prohibition that is enforced by ' +
      'making the permission unreachable is not an enforced invariant; it is an unbuilt ' +
      'feature wearing an invariant`s badge." This assertion is the difference between ' +
      'invariant 8 being enforced and being unbuilt.',
  )
})

test('no grant offered at all is refused, and the refusal names the arm that was available', () => {
  assert.deepEqual(
    selectAsStaff(null),
    { ok: false, refusal: 'membership_absent' },
    'the refusal must name what the CALLER OFFERED. Nothing was offered, so the ' +
      'membership arm was the only arm — and `access_grant_absent` for a caller who ' +
      'presented no grant would disclose that we evaluated them as staff.',
  )

  /* And the ABSENT field, which is the fence `staffGrant?` buys and the thing
   * that must never be a permit. */
  assert.deepEqual(
    selectTenantForSession({
      session: staffSession,
      hostBoundTenantId: ACME_TENANT,
      memberships: [meiInAcme],
      now: NOW,
    }),
    { ok: false, refusal: 'membership_absent' },
    'AN OMITTED `staffGrant` PERMITTED SOMETHING. The field is optional only because this ' +
      'slice was fenced out of `server/`; what makes the interim safe is the DIRECTION of ' +
      'the default. A caller who forgets the term must lose the arm and can never gain ' +
      'one by forgetting.',
  )
})

test('somebody ELSE`s live grant in the right tenant binds nothing', () => {
  assert.deepEqual(
    selectAsStaff(
      staffGrantFor({ id: 'tag_other', staffUserId: 'usr_platform_other' as UserId }),
    ),
    { ok: false, refusal: 'access_grant_absent' },
    'THE PRINCIPAL JOIN IS GONE. This grant is live, for the right tenant, claiming ' +
      'reachable classes — everything but the person. A check that matched on tenant ' +
      'alone passes here, and every OTHER assertion in this section passes with it.',
  )
})

test('a grant for tenant A cannot bind tenant B', () => {
  assert.deepEqual(
    selectAsStaff(staffGrantFor({ id: 'tag_globex', tenantId: GLOBEX_TENANT })),
    { ok: false, refusal: 'access_grant_absent' },
    'A GRANT FOR GLOBEX BOUND ACME. `grantAllows()` records this exact defect being fixed ' +
      'on 5 Aug 2026: "it previously took the grant and never compared `grant.tenantId` to ' +
      'anything, so a grant for tenant A validated an operation against tenant B — the ' +
      'exact shape of the failure this whole module exists to prevent, in the function ' +
      'named after permitting it." The tenant comes from the HOST; the grant is compared.',
  )

  /* The control: the same grant DOES bind the tenant it names. A predicate that
   * refuses everything is an outage, not a control. */
  assert.deepEqual(
    selectAsStaff(
      staffGrantFor({ id: 'tag_globex', tenantId: GLOBEX_TENANT }),
      GLOBEX_TENANT,
    ),
    { ok: true, tenantId: GLOBEX_TENANT },
  )
})

test('G292 term 1 · a REVOKED grant is still a row, and binds nothing', () => {
  assert.deepEqual(
    selectAsStaff(
      staffGrantFor({ id: 'tag_revoked', revokedAt: '2026-08-15T00:00:00Z' as Timestamp }),
    ),
    { ok: false, refusal: 'access_grant_absent' },
    'A revoked grant is RETAINED for the same reason a revoked membership is, so an ' +
      '`EXISTS` on `(staffUserId, tenantId)` alone would re-grant every access anybody ' +
      'ever had withdrawn.',
  )
})

test('G292 term 2 · an EXPIRED grant binds nothing, and expiry is NOT revocation', () => {
  assert.deepEqual(
    selectAsStaff(
      staffGrantFor({
        id: 'tag_expired',
        grantedAt: '2026-07-01T00:00:00Z' as Timestamp,
        expiresAt: '2026-08-21T00:00:00Z' as Timestamp,
      }),
    ),
    { ok: false, refusal: 'access_grant_absent' },
    'ASSERTED SEPARATELY FROM TERM 1 ON PURPOSE. This grant`s `revokedAt` IS null, so a ' +
      'predicate that stopped at revocation admits it — and that exact omission is the ' +
      'defect the customer arm found in B1`s own quoted predicate. Two terms, two ' +
      'fixtures, two reds.',
  )

  /* The boundary, matching every other clock in `model/`: expiring exactly NOW
   * is expired. `<=` and never `<`. */
  assert.deepEqual(
    selectAsStaff(staffGrantFor({ id: 'tag_now', expiresAt: NOW })),
    { ok: false, refusal: 'access_grant_absent' },
  )
})

test('🛑 G292 term 3 · a grant past MAX_GRANT_HOURS is refused though unrevoked and unexpired', () => {
  /**
   * 🛑 NOTHING ELSE IN THIS FILE WITNESSES THIS TERM, AND IT IS THE ONE THE
   * MEMBERSHIP ARM HAS NO ANALOGUE FOR. The grant below passes both of the
   * terms the customer arm has and is held for 130 days against
   * `MAX_GRANT_HOURS.delivery` of 24 × 90. G292: the ceiling is *"a property of
   * the PREDICATE rather than of whoever issues the grant … so the enforcement
   * does not depend on the issuing path being the only path"* — and there is no
   * issuing path in this repository at all.
   */
  const overCeiling = staffGrantFor({
    id: 'tag_long',
    grantedAt: '2026-05-01T00:00:00Z' as Timestamp,
    expiresAt: '2026-09-08T00:00:00Z' as Timestamp, // 130 days
  })
  assert.equal(overCeiling.revokedAt, null, 'the fixture must be UNREVOKED or it proves term 1')
  assert.ok(overCeiling.expiresAt > NOW, 'the fixture must be UNEXPIRED or it proves term 2')

  assert.deepEqual(
    selectAsStaff(overCeiling),
    { ok: false, refusal: 'access_grant_absent' },
    'THE DURATION CEILING IS NOT ENFORCED. `MAX_GRANT_HOURS` claimed "a grant beyond this ' +
      'is rejected at issue" and had ZERO CALL SITES for days — a control that existed ' +
      'only as a sentence. G292 makes it a term of the predicate precisely so that it ' +
      'cannot become one again.',
  )

  /* The control: 89 days, under the same ceiling, IS admitted. Without this the
   * refusal above could be the dates rather than the ceiling. */
  assert.deepEqual(
    selectAsStaff(
      staffGrantFor({
        id: 'tag_just_inside',
        grantedAt: '2026-05-01T00:00:00Z' as Timestamp,
        expiresAt: '2026-07-29T00:00:00Z' as Timestamp, // 89 days, and expired…
        // …so bring it forward: the point is the WIDTH, not the position.
      }),
    ),
    { ok: false, refusal: 'access_grant_absent' },
    'an 89-day grant that has EXPIRED is still refused — by term 2, not term 3',
  )
  assert.deepEqual(
    selectAsStaff(
      staffGrantFor({
        id: 'tag_inside',
        grantedAt: '2026-08-01T00:00:00Z' as Timestamp,
        expiresAt: '2026-10-29T00:00:00Z' as Timestamp, // 89 days, live at NOW
      }),
    ),
    { ok: true, tenantId: ACME_TENANT },
    'AN 89-DAY GRANT WAS REFUSED, so the 130-day refusal above is not the ceiling — the ' +
      'arm is refusing something else and this section is proving nothing about G292.',
  )
})

test('the ceiling is PER PURPOSE — the same window passes as delivery and fails as incident', () => {
  const window = {
    grantedAt: '2026-08-20T00:00:00Z' as Timestamp,
    expiresAt: '2026-09-19T00:00:00Z' as Timestamp, // 30 days
  } as const

  assert.deepEqual(
    selectAsStaff(staffGrantFor({ id: 'tag_d', purpose: 'delivery', ...window })),
    { ok: true, tenantId: ACME_TENANT },
    '30 days is inside `MAX_GRANT_HOURS.delivery` (24 × 90)',
  )
  assert.deepEqual(
    selectAsStaff(
      staffGrantFor({
        id: 'tag_i',
        purpose: 'incident',
        resources: ['tenant_data'],
        ...window,
      }),
    ),
    { ok: false, refusal: 'access_grant_absent' },
    'A 30-DAY INCIDENT GRANT WAS ADMITTED. `MAX_GRANT_HOURS.incident` is 24 HOURS — ' +
      '"Hours. Diagnosing a live problem" against "Weeks. Configuration under a signed ' +
      'engagement" — and a single ceiling, or one read with the wrong key, passes this.',
  )
})

test('🛑 G292 · a grant EXTENDED past the ceiling is refused — "issued, OR EXTENDED"', () => {
  /**
   * G292's sentence is *"a grant cannot be issued, or extended, past it"*, and
   * `evaluateTenantAccess()` states the mechanism this copies: measure to the
   * LATEST extension *"so a chain of short extensions cannot arrive where a
   * single long grant would have been refused."* Three short extensions, each
   * unremarkable, arriving at 150 days.
   */
  const extension = (at: string, to: string): AccessExtension => ({
    at: at as Timestamp,
    extendedTo: to as Timestamp,
    reason: 'the engagement ran long',
    extendedByStaffUserId: 'usr_platform_other' as UserId,
    approvedByStaffUserId: 'usr_platform_approver' as UserId,
    customerNotifiedAt: at as Timestamp,
  })

  const chained = staffGrantFor({
    id: 'tag_chain',
    grantedAt: '2026-08-01T00:00:00Z' as Timestamp,
    expiresAt: '2026-09-01T00:00:00Z' as Timestamp, // 31 days, comfortably inside
    extensions: [
      extension('2026-08-28T00:00:00Z', '2026-10-01T00:00:00Z'),
      extension('2026-09-25T00:00:00Z', '2026-11-01T00:00:00Z'),
      extension('2026-10-25T00:00:00Z', '2026-12-29T00:00:00Z'), // 150 days from grant
    ],
  })

  assert.deepEqual(
    selectAsStaff(staffGrantFor({ id: 'tag_unchained', ...{} })),
    { ok: true, tenantId: ACME_TENANT },
    'the same grant WITHOUT extensions must be admitted, or the refusal below is the ' +
      'grant rather than the chain',
  )
  assert.deepEqual(
    selectAsStaff(chained),
    { ok: false, refusal: 'access_grant_absent' },
    'A CHAIN OF EXTENSIONS ARRIVED WHERE A SINGLE LONG GRANT WOULD HAVE BEEN REFUSED. ' +
      'G292 says "issued, OR EXTENDED", and reading `expiresAt` alone honours only the ' +
      'first half. ⚠️ The DATABASE half cannot see this — `0008` ships no extension ' +
      'table, so there `expires_at` IS the effective expiry and extending a grant means ' +
      'UPDATING it, which the identical arithmetic catches. The model half is the ' +
      'stricter of the two until an `access_extension` table exists, which is the safe ' +
      'direction and is named on both.',
  )
})

test('🛑 the THREE LISTS, all three, and `statutory` refused at any price', () => {
  /**
   * 🛑 G167's SURVIVING CONTENT, MADE OBSERVABLE. The four grants below are
   * identical in every respect but the CLASS they claim, so the verdicts are
   * about the class and about nothing else. G199 carries the requirement through
   * its own reversal: all three lists, in ONE helper with ONE call site, because
   * *"`authorisationPermits()` tests the third FIRST"* and *"G75 exists because
   * a third list nobody had named made G60 INERT."*
   */
  const claiming = (id: string, resource: AccessResourceClass) =>
    selectAsStaff(staffGrantFor({ id, resources: [resource] }))

  assert.deepEqual(
    claiming('tag_statutory', 'statutory'),
    { ok: false, refusal: 'access_grant_absent' },
    'NON_DELEGABLE_RESOURCES, tested FIRST. Invariant 8: "`statutory` appears in neither, ' +
      'AT ANY PRICE: a statutory obligation is not the customer`s to delegate to a ' +
      'processor." Refused by the LIST, not by a capability — no capability is read at ' +
      'selection time at all.',
  )
  assert.deepEqual(
    claiming('tag_authority', 'authority'),
    { ok: false, refusal: 'access_grant_absent' },
    'CONTRACT_ONLY_RESOURCES, and there is no `SupportAuthorisation` to open it. G292 was ' +
      'OFFERED one as a liveness term and DECLINED it — "a second document is a second ' +
      'thing that can be absent when somebody needs access urgently" — so the arm passes ' +
      '`null`, which is the NARROW side of that decline: the decline removed a ' +
      'REQUIREMENT, not a CHECK.',
  )
  assert.deepEqual(
    claiming('tag_commercial', 'commercial'),
    { ok: false, refusal: 'access_grant_absent' },
    'In NEITHER of the other two lists AND in no `PERMITTED_RESOURCES` entry — "no ' +
      'purpose lists them and no contract may … Left closed deliberately."',
  )

  /**
   * ✅ AND THE ONE THAT MUST PASS — G60 AND G75, WHICH ARE A RECORDED REVERSAL
   * AND MUST NOT BE QUIETLY RESTORED. The product owner put `secret` into
   * `PERMITTED_RESOURCES.delivery` against a written recommendation: G56 puts
   * source configuration with the FDE, a source has a credential, and the old
   * invariant made the FDE`s own job structurally impossible. "Do not
   * relitigate it, and do not quietly narrow it back."
   */
  assert.deepEqual(
    claiming('tag_secret', 'secret'),
    { ok: true, tenantId: ACME_TENANT },
    'G60 AND G75 HAVE BEEN QUIETLY NARROWED BACK. A reversal that lives only in prose is ' +
      'a reversal that decays; this is the assertion that notices. It is also the ' +
      'differential that makes the three refusals above mean something — without an ' +
      'admitted class they could all be failing on a typo.',
  )

  /* The whole grant fails, not the line — `evaluateTenantAccess()`'s rule,
   * because "the grant is the unit someone approved". */
  assert.deepEqual(
    selectAsStaff(staffGrantFor({ id: 'tag_mixed', resources: ['configuration', 'statutory'] })),
    { ok: false, refusal: 'access_grant_absent' },
    'A GRANT NAMING ONE UNREACHABLE CLASS BOUND A TENANT ON THE STRENGTH OF ITS OTHER ' +
      'LINES. "A grant naming a class the contract does not open fails WHOLE, rather than ' +
      'quietly permitting the classes it does open: the grant is the unit someone ' +
      'approved."',
  )
})

test('a live grant with NO resource lines binds a tenant and reaches nothing', () => {
  assert.deepEqual(
    selectAsStaff(staffGrantFor({ id: 'tag_empty', resources: [] })),
    { ok: true, tenantId: ACME_TENANT },
    'AN EMPTY GRANT WAS REFUSED, AND THAT IS A TERM NOBODY RULED. G292 names three ' +
      'liveness terms and "carries at least one resource line" is not among them. It is ' +
      'harmless because SELECTION IS NOT USE: `grantAllows()` refuses every class for a ' +
      'grant with no line. Adding the term would be a Builder inventing policy, which is ' +
      'the sentence G199 uses about the liveness terms themselves.',
  )
})

test('a live MEMBERSHIP wins before the staff arm is reached', () => {
  /**
   * ⚠️ ORDER IS OBSERVABLE HERE RATHER THAN COSMETIC. A person holding both
   * binds on the MEMBERSHIP — the weaker authority, and the one that leaves no
   * grant marked as used. And an ordinary customer can never be refused by a
   * staff term, whatever is in the grant field.
   */
  const mei = { ...scoped, userId: MEI }
  assert.deepEqual(
    selectTenantForSession({
      session: mei,
      hostBoundTenantId: ACME_TENANT,
      memberships: [meiInAcme],
      staffGrant: staffGrantFor({ id: 'tag_rubbish', resources: ['statutory'] }),
      now: NOW,
    }),
    { ok: true, tenantId: ACME_TENANT },
    'A CUSTOMER WITH A LIVE MEMBERSHIP WAS REFUSED BY A STAFF TERM. The membership loop ' +
      'returns before the staff arm is entered; if that stops being true, an unrelated ' +
      'grant in the request context can break an ordinary sign-in.',
  )
})

test('the staff arm never throws — a malformed grant is a refusal, not an exception', () => {
  /**
   * 🛑 EVERY ONE OF THESE WOULD THROW IN A NAIVE IMPLEMENTATION, AND TWO OF
   * THEM WOULD THROW INSIDE `authorisationPermits()` — the ONE helper that
   * answers `statutory`. `PERMITTED_RESOURCES[purpose]` is `undefined` for an
   * unknown purpose and `.includes` on it is a `TypeError`; `for (… of
   * undefined)` is another. A function that throws at the door is a function
   * whose refusal path is a 500.
   */
  const malformed = [
    { ...liveDeliveryGrant, resources: undefined },
    { ...liveDeliveryGrant, extensions: undefined },
    { ...liveDeliveryGrant, purpose: 'audit' },
    { ...liveDeliveryGrant, purpose: undefined },
    { ...liveDeliveryGrant, expiresAt: undefined },
    { ...liveDeliveryGrant, revokedAt: undefined },
    { ...liveDeliveryGrant, grantedAt: 'not a date' },
    { ...liveDeliveryGrant, grantedAt: undefined },
    { ...liveDeliveryGrant, tenantId: undefined },
    { ...liveDeliveryGrant, staffUserId: undefined },
  ] as unknown as readonly TenantAccessGrant[]

  for (const grant of malformed) {
    assert.doesNotThrow(() => selectAsStaff(grant))
    assert.deepEqual(
      selectAsStaff(grant),
      { ok: false, refusal: 'access_grant_absent' },
      'A MALFORMED GRANT WAS ADMITTED. Fail-closed is the polarity `DENY_ALL` and G100 ' +
        'both hold. ⚠️ `expiresAt: undefined` is the one to read: the term is written ' +
        '`!(expiresAt > now)` and NOT `expiresAt <= now`, because `undefined <= now` is ' +
        'FALSE and would have permitted this row. `grantedAt: "not a date"` is the ' +
        'second: `hoursBetween()` returns NaN, `NaN > ceiling` is false, and without the ' +
        'finiteness check the ceiling term would admit exactly the grant it exists to ' +
        `refuse. Got for ${String((grant as { id?: unknown }).id)}.`,
    )
  }
})

/* ==================================================================== *
 * 8c · THE STAFF ARM'S MUTATIONS, RUN AND RECORDED — S-21, 19 Sep 2026.
 *
 * Each was applied to the staff arm in `model/access.ts` §7a, the suite re-run,
 * and the reds recorded by NAME. `tsc` stayed GREEN under every one of them
 * except S7 — they delete lines rather than change types, which is the argument
 * for these tests existing at all.
 *
 *   S1  delete `if (staffGrant.staffUserId !== session.userId) …`
 *       → 2 reds: `somebody ELSE's live grant in the right tenant binds
 *          nothing` and `the staff arm never throws`. The FDE binds Acme on
 *          another person's authority.
 *
 *   S2  delete `if (staffGrant.tenantId !== hostBoundTenantId) …`
 *       → 2 reds: `a grant for tenant A cannot bind tenant B` and `never
 *          throws`. `grantAllows()`'s 5 Aug 2026 defect, reintroduced.
 *
 *   S3  delete `if (staffGrant.revokedAt !== null) …`        → G292 term 1's red.
 *   S4  delete `if (!(staffGrant.expiresAt > now)) …`        → G292 term 2's red,
 *          AND term 3's, because the over-ceiling fixture is also unexpired.
 *
 *   S5  delete `if (heldHours > ceilingHours) …`
 *       → 3 reds: term 3, the per-purpose differential, and the extension
 *          chain. **This is the line G292 exists for**, and before this slice
 *          `MAX_GRANT_HOURS` had no call site on any selection path at all.
 *
 *   S6  delete the extension walk (`if (extension.extendedTo > effectiveExpiry)`)
 *       → 1 red: `a grant EXTENDED past the ceiling is refused`. NOTHING else
 *          sees it — G292's *"issued, OR EXTENDED"* is one clause and one test.
 *
 *   S7  delete `if (!verdict.permitted) return grantRefused`
 *       → 1 red: `the THREE LISTS, all three`. ⚠️ `tsc` goes red here too
 *          (`noUnusedLocals` on `verdict`), which is luck rather than a
 *          control: deleting the whole loop compiles clean and produces the
 *          same single red.
 *
 *   S9  delete `if (!Number.isFinite(heldHours)) …`
 *       → 1 red: `never throws`, on `grantedAt: 'not a date'` — `NaN > ceiling`
 *          is false, so the ceiling term ADMITS the grant it exists to refuse.
 *          `hoursBetween()`'s own declaration demands this check by name.
 *
 * 🛑 S8 SURVIVED, AND IT IS RECORDED BECAUSE A SURVIVING MUTATION IS A FINDING
 *    RATHER THAN A GAP TO HIDE. Rewriting term 2 as `expiresAt <= now` — the
 *    fail-OPEN form — leaves this suite GREEN, because S9's finiteness check
 *    catches the same absent value two lines later. The negation is therefore
 *    REDUNDANT TODAY and has no independent witness. It is kept, and the reason
 *    is written on the line itself: the ceiling term is the one a future edit is
 *    most likely to move, and when it moves this is what stops an absent expiry
 *    from being a permit.
 *
 * ⚠️ AND ONE PROPERTY IS DELIBERATELY NOT TESTED HERE: that
 *    `NON_DELEGABLE_RESOURCES` is consulted BEFORE the permitted list. That is
 *    `authorisationPermits()`'s own ordering — G199 requires the arm to DELEGATE
 *    to it rather than restate it, so testing it here would be testing the
 *    helper twice and the arm not at all. It is witnessed where the two lists
 *    can actually be made to disagree: `tests/db/session-membership-selection.test.ts`,
 *    `G75 · widening permitted_resource does NOT make statutory reachable`,
 *    which is the interaction G60 shipped inert for eight days.
 * ==================================================================== */

/* ==================================================================== *
 * 8a · THE MUTATIONS, RUN AND RECORDED — §8's half of the discipline §7's
 *      block states: a control added without a demonstrated red is §5.6
 *      wearing a different hat.
 *
 * Each was applied to `selectTenantForSession()` in `model/access.ts`, the
 * suite re-run, and the reds recorded by NAME. `tsc` stayed GREEN under all
 * five — every one of them deletes a line rather than changing a type, which
 * is the argument for having these tests at all.
 *
 *   M1  delete `if (m.tenantId !== hostBoundTenantId) continue`
 *       → 1 red: `a membership in ANOTHER tenant does not bind THIS one`.
 *          B1's failure in one call: the check answers "is this person a
 *          member of ANYTHING".
 *
 *   M2  delete `if (m.userId !== session.userId) continue`
 *       → 2 reds: `somebody else's membership in the right tenant binds
 *          nothing` and `test_the_staff_path_is_unreachable…`. The second is
 *          the more interesting: with the principal join gone, the FDE binds
 *          Acme on the strength of somebody ELSE's membership — so the arm
 *          G199 declares unreachable becomes reachable by accident, which is
 *          exactly the shape a declared temporary decays into.
 *
 *   M3  delete `if (m.revokedAt !== null) continue`
 *       → 2 reds: `a REVOKED membership binds nothing` and `never throws`,
 *          the second because its `revokedAt: undefined` row stops
 *          failing closed.
 *
 *   M4  delete `if (m.expiresAt !== null && m.expiresAt <= now) continue`
 *       → 2 reds: `an EXPIRED membership binds nothing` and `expiring exactly
 *          NOW`. This is the term B1's own quoted predicate omits, so without
 *          these two the divergence would be undefended in both halves.
 *
 *   M5  add `if (session.tenantId === hostBoundTenantId) return { ok: true, … }`
 *       as a fast path before the loop — the "it already agrees" shortcut
 *       somebody will genuinely propose
 *       → 9 reds, including `test_the_stored_tenant_on_the_session_is_never
 *          _consulted`. THE BLAST RADIUS IS THE POINT: reading the column the
 *          attacker wrote does not weaken one assertion, it dissolves the
 *          function.
 * ==================================================================== */
