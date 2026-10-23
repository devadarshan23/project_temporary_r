/**
 * `model/partner-portal.ts` — the shape rule, the roster state and the
 * normalisation, witnessed as values (W5, G2634, G2636).
 *
 * The wire schema cannot express *"a deal carries a value and a close date, a
 * customer claim a rationale and a resale scope"* — every shape-specific field
 * is optional there — so the model is the only place it is held, and this file
 * is the only thing that would notice it loosening.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  DEAL_SHAPE_REFUSALS,
  PARTNER_PERSON_STATES,
  checkDealRegistrationShape,
  normaliseCompany,
  partnerPersonState,
} from '../../model/partner-portal.ts'

/** One Singapore dollar, as the codec holds it — G3561: a deal's value is `Money`. */
const SGD_ONE = { currency: 'SGD', amountMinor: 100n, exponent: 2 } as const

describe('model/partner-portal.ts', () => {
  it('0 · a deal value is money and must be positive — G3561, G3563', () => {
    /* WITNESSED RED: with the `valueNotPositive` arm deleted from
       `checkDealRegistrationShape()`, all three of the refusals below answered
       `null` — a deal worth nothing, a negative one and a currency-less one
       were each received. */
    const deal = { shape: 'deal', company: 'A', expectedClose: 'q1' } as const
    assert.equal(checkDealRegistrationShape({ ...deal, annualValue: SGD_ONE }), null)
    assert.equal(
      checkDealRegistrationShape({ ...deal, annualValue: { ...SGD_ONE, amountMinor: 0n } }),
      DEAL_SHAPE_REFUSALS.valueNotPositive,
    )
    assert.equal(
      checkDealRegistrationShape({ ...deal, annualValue: { ...SGD_ONE, amountMinor: -100n } }),
      DEAL_SHAPE_REFUSALS.valueNotPositive,
    )
    assert.equal(
      checkDealRegistrationShape({ ...deal, annualValue: { ...SGD_ONE, currency: '' } }),
      DEAL_SHAPE_REFUSALS.valueNotPositive,
      'a value with no currency is not money — the ruling exists to end exactly this',
    )
  })

  it('1 · each shape requires its own fields and refuses the other shape’s', () => {
    assert.equal(checkDealRegistrationShape({ shape: 'deal', company: 'A', annualValue: SGD_ONE, expectedClose: 'q1' }), null)
    assert.equal(
      checkDealRegistrationShape({ shape: 'deal', company: 'A', annualValue: SGD_ONE, expectedClose: 'q1', contact: 'c' }),
      null,
      '`contact` is a deal-shape field',
    )
    assert.equal(
      checkDealRegistrationShape({ shape: 'customer_claim', company: 'A', rationale: 'r', resaleScope: ['x'] }),
      null,
    )
    assert.equal(checkDealRegistrationShape({ shape: 'deal', company: 'A', annualValue: SGD_ONE }), DEAL_SHAPE_REFUSALS.shapeIncomplete)
    assert.equal(
      checkDealRegistrationShape({ shape: 'customer_claim', company: 'A', rationale: 'r', resaleScope: [] }),
      DEAL_SHAPE_REFUSALS.shapeIncomplete,
      'an EMPTY resale scope is not a resale scope',
    )
    assert.equal(
      checkDealRegistrationShape({ shape: 'deal', company: 'A', annualValue: SGD_ONE, expectedClose: 'q', rationale: 'r' }),
      DEAL_SHAPE_REFUSALS.fieldOfTheOtherShape,
    )
    assert.equal(
      checkDealRegistrationShape({ shape: 'customer_claim', company: 'A', rationale: 'r', resaleScope: ['x'], expectedClose: 'q' }),
      DEAL_SHAPE_REFUSALS.fieldOfTheOtherShape,
      'a claim with a close date — one of the two states §5.5 says not to make representable',
    )
    assert.equal(checkDealRegistrationShape({ shape: 'deal', company: ' \t ', annualValue: SGD_ONE, expectedClose: 'q' }), DEAL_SHAPE_REFUSALS.companyBlank)
  })

  it('2 · the roster state is `decide()`’s two liveness terms, revoked before expired', () => {
    const now = '2026-10-01T12:00:00.000Z'
    assert.equal(partnerPersonState({ revokedAt: null, expiresAt: '2026-10-02T00:00:00.000Z' }, now), PARTNER_PERSON_STATES.active)
    assert.equal(partnerPersonState({ revokedAt: null, expiresAt: now }, now), PARTNER_PERSON_STATES.expired, 'expiring exactly now is expired')
    assert.equal(
      partnerPersonState({ revokedAt: '2026-09-01T00:00:00.000Z', expiresAt: '2026-01-01T00:00:00.000Z' }, now),
      PARTNER_PERSON_STATES.revoked,
    )
  })

  it('3 · normalisation is ASCII-only and whitespace-explicit (G2636)', () => {
    assert.equal(normaliseCompany('  Initech \t  HOLDINGS\n'), 'initech holdings')
    assert.equal(normaliseCompany('Ünïcode'), 'Ünïcode', 'a non-ASCII capital is NOT folded — see 0322’s COLLATE "C"')
    assert.equal(normaliseCompany('a b'), 'a b', 'a no-break space is not whitespace to this rule')
  })
})
