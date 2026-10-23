/**
 * G231 — a domain claim is a STORED DIGEST with a `verifiedAt`, checked against
 * stored state at route time. DNS is not queried on the authentication path.
 *
 * 🛑 ONE ASSERTION #221 ASKED FOR IS DELIBERATELY ABSENT AND ITS OPPOSITE IS
 * HERE INSTEAD. #221's red test 2(b) is `test_a_lapsed_verification_stops_routing`
 * — blocking expiry. **G231 explicitly declines to decide that**: blocking on
 * lapse is the OPPOSITE POLARITY to `TenantContact`, which warns rather than
 * blocks, and the ruling says it "needs its own argument rather than arriving
 * as a side effect of this row." So this suite asserts the CURRENT polarity —
 * a lapsed claim still routes — precisely so that whoever makes that argument
 * has to move a named test rather than change behaviour in silence. The issue
 * is superseded by the ruling on this one point and nowhere else.
 *
 * ⚠️ §5.10 — a green `tsc` over a types-only change proves nothing. Every
 * assertion here runs a function over constructed state.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  DOMAIN_CHALLENGE_ALGORITHMS,
  DOMAIN_ROUTING_REFUSALS,
  mayRouteToConnection,
  normaliseClaimedDomain,
  routeToConnection,
  supersedeDomainClaim,
} from '../../model/domain.ts'
import type { DomainClaim, IdentityConnection } from '../../model/domain.ts'
import type { AccountId, IdentityConnectionId, Timestamp } from '../../model/kernel.ts'

const owner = { kind: 'customer', accountId: 'acc_acme' as AccountId } as const

function challenge(digest: string) {
  return {
    algorithm: DOMAIN_CHALLENGE_ALGORITHMS.hmacSha256,
    keyRef: 'kms://reconcile/domain-challenge/idc_acme_entra',
    digest,
  }
}

function claim(over: Partial<DomainClaim> = {}): DomainClaim {
  return {
    domain: 'acme.example',
    challenge: challenge('9f2c'.repeat(16)),
    verifiedAt: '2026-08-01T00:00:00.000Z' as Timestamp,
    verificationExpiresAt: '2027-08-01T00:00:00.000Z' as Timestamp,
    ...over,
  }
}

function connection(
  id: string,
  claims: readonly DomainClaim[],
  status: 'active' | 'disabled' = 'active',
): IdentityConnection {
  return {
    id: id as IdentityConnectionId,
    protocol: 'oidc',
    label: `door ${id}`,
    owner,
    domains: claims,
    /**
     * G304/G305 — required because `oidc` is a brokered protocol. It is also
     * IRRELEVANT to everything below, and that is worth stating: routing
     * chooses a door by its DOMAIN CLAIMS and reads no broker handle at all.
     * A fixture here that varied the handle per connection would suggest
     * otherwise.
     */
    federation: {
      brokerIssuer: 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_TESTPOOL',
      brokerRef: `broker-${id}`,
    },
    status,
  }
}

/* ------------------------------------------------------------------ *
 * 1 — the red test. Presence is not verification.
 * ------------------------------------------------------------------ */

test('test_an_unverified_domain_routes_to_no_connection', () => {
  const unverified = connection('idc_partner', [claim({ verifiedAt: null })])

  const routing = routeToConnection([unverified], 'acme.example')

  assert.deepEqual(routing, {
    ok: false,
    refusal: DOMAIN_ROUTING_REFUSALS.domainNotVerified,
  })
  assert.equal(routing.ok, false)
})

/**
 * THE MUTATION. Implement the guard as `claims.length > 0` and exactly this
 * test and the one above go red — the claim below is PRESENT, carries a real
 * challenge digest, and has simply never been proved. A digest on record means
 * verification was STARTED, which is the state a length check reads as done.
 */
test('test_presence_is_not_verification_a_claim_with_a_digest_and_no_verified_at_is_still_refused', () => {
  const started = claim({ verifiedAt: null, verificationExpiresAt: null })

  assert.equal(started.challenge.digest.length > 0, true)
  assert.equal(mayRouteToConnection(started), false)
  assert.equal(mayRouteToConnection(claim()), true)
})

/* ------------------------------------------------------------------ *
 * 2 — the routing function reads STORED STATE and nothing else.
 * ------------------------------------------------------------------ */

/**
 * G231's deciding fact, made structural rather than promised.
 *
 * `mayNotifyContact(contact, now)` takes a clock. `mayRouteToConnection(claim)`
 * takes NONE — not because a clock is expensive but because a function that
 * accepts a parameter it does not read is a lie about what decides. Adding
 * blocking expiry therefore has to change this signature, which is a visible
 * act. If the arity ever becomes 2, somebody decided the question G231 left
 * open; make them say so here.
 */
test('test_may_route_to_connection_takes_no_clock_and_performs_no_lookup', () => {
  assert.equal(mayRouteToConnection.length, 1)
  assert.equal(routeToConnection.length, 2)
})

/**
 * The polarity G231 leaves OPEN, pinned so it cannot drift silently.
 * `verificationExpiresAt` is recorded — staleness is visible — and nothing
 * routes on it. See the suite header.
 */
test('test_a_lapsed_verification_still_routes_because_g231_leaves_blocking_expiry_open', () => {
  const lapsed = claim({
    verificationExpiresAt: '2026-01-01T00:00:00.000Z' as Timestamp,
  })

  assert.equal(mayRouteToConnection(lapsed), true)
  assert.deepEqual(routeToConnection([connection('idc_acme', [lapsed])], 'acme.example'), {
    ok: true,
    connectionId: 'idc_acme',
  })
  /* The staleness is on the record even though it decides nothing. */
  assert.notEqual(lapsed.verificationExpiresAt, null)
})

test('test_an_unclaimed_domain_and_a_disabled_connection_each_refuse_by_their_own_name', () => {
  const active = connection('idc_acme', [claim()])
  const disabled = connection('idc_old', [claim()], 'disabled')

  assert.deepEqual(routeToConnection([active], 'somewhere.else'), {
    ok: false,
    refusal: DOMAIN_ROUTING_REFUSALS.domainNotClaimed,
  })
  assert.deepEqual(routeToConnection([disabled], 'acme.example'), {
    ok: false,
    refusal: DOMAIN_ROUTING_REFUSALS.connectionDisabled,
  })
  assert.deepEqual(routeToConnection([], 'acme.example'), {
    ok: false,
    refusal: DOMAIN_ROUTING_REFUSALS.domainNotClaimed,
  })
})

/**
 * Invariant 2's vector, refused rather than guessed at.
 *
 * Two connections holding a VERIFIED claim on one domain is the takeover state
 * itself; picking either is picking an org class for the user. It fails closed.
 */
test('test_a_domain_verified_by_two_connections_refuses_rather_than_picking_one', () => {
  const customer = connection('idc_acme', [claim()])
  const partner = connection('idc_partner', [claim()])

  assert.deepEqual(routeToConnection([customer, partner], 'acme.example'), {
    ok: false,
    refusal: DOMAIN_ROUTING_REFUSALS.domainClaimedByMoreThanOneConnection,
  })
})

/**
 * ...and the other half, which is why ambiguity is counted over VERIFIED
 * claims only: if an unverified claim counted, anyone could take a tenant's
 * sign-in down by claiming its domain and never proving it. A denial of
 * service is not an improvement on a takeover.
 */
test('test_an_unverified_squatter_does_not_take_down_the_verified_owner', () => {
  const customer = connection('idc_acme', [claim()])
  const squatter = connection('idc_partner', [claim({ verifiedAt: null })])

  assert.deepEqual(routeToConnection([customer, squatter], 'acme.example'), {
    ok: true,
    connectionId: 'idc_acme',
  })
})

/**
 * DNS is case-insensitive and this comparison decides an org class, so a
 * case-sensitive compare would let `ACME.EXAMPLE` be claimed a second time by
 * somebody else with the ambiguity check none the wiser.
 */
test('test_domain_matching_folds_case_and_surrounding_space', () => {
  const held = connection('idc_acme', [claim({ domain: 'ACME.Example' })])

  assert.equal(normaliseClaimedDomain('  ACME.Example '), 'acme.example')
  assert.deepEqual(routeToConnection([held], 'acme.example'), {
    ok: true,
    connectionId: 'idc_acme',
  })
})

/* ------------------------------------------------------------------ *
 * 3 — the digest discipline. What is stored, and what a re-verification does.
 * ------------------------------------------------------------------ */

test('test_no_challenge_token_is_stored_in_the_clear', () => {
  const stored = claim()

  assert.deepEqual(Object.keys(stored.challenge).sort(), [
    'algorithm',
    'digest',
    'keyRef',
  ])
  assert.equal(stored.challenge.algorithm, 'hmac_sha256')
  /* A reference to the salt, never the salt. Same rule as
   * `Endpoint.credentialRef` and `SubjectKeyScheme.keyRef`. */
  assert.equal(stored.challenge.keyRef.includes('kms://'), true)
})

/**
 * SUPERSEDES RATHER THAN ACCUMULATES, which is the half that is easy to get
 * wrong by writing `[...claims, fresh]`.
 *
 * An accumulated list is a list of proofs each of which still verifies, so the
 * oldest challenge never stops being sufficient and the set of parties holding
 * a usable proof only grows.
 */
test('test_re_verification_supersedes_the_claim_it_replaces_rather_than_accumulating', () => {
  const before = [claim({ challenge: challenge('a'.repeat(64)) })]
  const fresh = claim({
    challenge: challenge('b'.repeat(64)),
    verifiedAt: '2026-08-22T00:00:00.000Z' as Timestamp,
  })

  const after = supersedeDomainClaim(before, fresh)

  assert.equal(after.length, 1)
  assert.equal(after.length, before.length)
  const only = after[0]
  assert.notEqual(only, undefined)
  assert.equal(only?.challenge.digest, 'b'.repeat(64))
  /* The superseded digest is GONE, not archived beside its replacement. */
  assert.equal(
    after.some((c) => c.challenge.digest === 'a'.repeat(64)),
    false,
  )
})

test('test_supersession_folds_case_so_a_second_casing_cannot_become_a_second_claim', () => {
  const before = [claim({ domain: 'ACME.EXAMPLE' })]

  const after = supersedeDomainClaim(before, claim({ domain: 'acme.example' }))

  assert.equal(after.length, 1)
})

test('test_a_claim_on_a_domain_not_yet_held_is_appended', () => {
  const before = [claim()]

  const after = supersedeDomainClaim(before, claim({ domain: 'acme.test' }))

  assert.equal(after.length, 2)
  assert.deepEqual(
    after.map((c) => c.domain).sort(),
    ['acme.example', 'acme.test'],
  )
})

test('test_supersession_does_not_mutate_the_list_it_was_given', () => {
  const before = [claim({ challenge: challenge('c'.repeat(64)) })]

  supersedeDomainClaim(before, claim({ challenge: challenge('d'.repeat(64)) }))

  assert.equal(before.length, 1)
  assert.equal(before[0]?.challenge.digest, 'c'.repeat(64))
})

/* ------------------------------------------------------------------ *
 * 4 — the refusal vocabulary is closed, and the fixtures are the witness.
 * ------------------------------------------------------------------ */

test('test_the_routing_refusal_vocabulary_is_closed_and_names_domain_not_verified', () => {
  const refusals = Object.values(DOMAIN_ROUTING_REFUSALS)

  assert.equal(refusals.length, 4)
  assert.equal(new Set(refusals).size, 4)
  assert.equal(refusals.includes('domain_not_verified'), true)
})
