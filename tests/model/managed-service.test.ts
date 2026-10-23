/**
 * `resolveManagedService()` — the first reader `ManagedServiceUseConfig` has
 * ever had.
 *
 * THE FINDING THIS FILE EXISTS FOR.
 * `grep -rn 'allowedFeatures\|maxDataClassToService\|maxProviderRetentionDays'
 * model/` returned the four declarations in `model/policy.ts` and three fixture
 * literals in `model/examples.ts`, and NOTHING ELSE. `ManagedServiceUseConfig`
 * had zero readers — so the most expensive path in the product, extraction via
 * a managed AI service, had no executable residency check of any kind, while
 * the field's own banner said *"THE ONLY RESIDENCY CONSTRAINT ON EXTRACTION IN
 * THE WHOLE MODEL … Nothing downstream of it re-checks; there is no
 * `resolveModel()` on this path to catch a mistake."*
 *
 * That banner is why the hole is structural rather than an oversight. G69/RD-1
 * establishes that Textract cannot be a `ModelCatalogEntry` — it has no
 * analogue for `ModelCapabilities` — and G54/G80b close `provider` to
 * `'bedrock' | 'sagemaker'`, which Textract is neither. **v1's IDP engine
 * therefore never passes `resolveModel()`**, at all, ever.
 *
 * ⚠️ WHAT THE RED HERE PROVED, AND WHAT IT DID NOT. `resolveManagedService` did
 * not exist when this file was written, so the only red available was ABSENCE:
 * `TS2305: Module '"../../model/policy.ts"' has no exported member
 * 'resolveManagedService'`. An import error proves nothing about behaviour.
 * Every assertion below was therefore additionally proved to BITE by mutation —
 * the implementation was changed to the plausible wrong thing, exactly the
 * named test was watched to go red, and the change was reverted. The mutations
 * and the test each caught are recorded in the block at the foot of this file.
 *
 * 🛑 THIS FUNCTION HAS NO PRODUCTION CALLER. Its only caller is this file. No
 * extraction code exists to call it. Do not read this suite as closing the
 * hole — see the banner on `resolveManagedService()` itself.
 *
 * Every expected value below is a string LITERAL typed into this file, for the
 * reason `tests/model/access-decide.test.ts` gives: comparing a constant to
 * itself passes forever and witnesses nothing.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { resolveManagedService } from '../../model/policy.ts'
import type { ManagedServiceUseConfig } from '../../model/policy.ts'
import {
  PLACEHOLDER_POLICY_DEFAULTS,
  permittedManagedServiceUse,
} from '../../model/examples.ts'
import type { DataClass } from '../../model/domain.ts'

/* ------------------------------------------------------------------ *
 * Fixtures — one axis per test
 *
 * `permittedManagedServiceUse` lives in `model/examples.ts` for the reason
 * `narrowLiveAutonomy` does (§5.10): a config nothing constructs is a config no
 * compiler has ever checked a field of. Everything below derives from it by
 * changing exactly ONE axis, so a difference in the rejection can only have
 * come from the axis under examination.
 *
 * The call below satisfies every axis with room to spare — feature listed,
 * region listed, class two below the ceiling, retention well inside tolerance —
 * so no arm is at a boundary by accident. The boundaries get tests of their own.
 * ------------------------------------------------------------------ */

const permittedCall = {
  feature: 'example_extract_text',
  region: 'ap-southeast-1',
  dataClass: 'internal',
  providerRetentionDays: 1,
} as const

/* ------------------------------------------------------------------ *
 * 1. The fixture itself
 * ------------------------------------------------------------------ */

test('the permitting fixture carries the four fields G7 named and nothing else', () => {
  assert.deepEqual(Object.keys(permittedManagedServiceUse).sort(), [
    'allowedFeatures',
    'allowedRegions',
    'maxDataClassToService',
    'maxProviderRetentionDays',
  ])
})

test('a fully permitted call RESOLVES — the function is not refusing everything', () => {
  assert.deepEqual(resolveManagedService(permittedManagedServiceUse, permittedCall), {
    ok: true,
  })
})

/* ------------------------------------------------------------------ *
 * 2. allowedFeatures — and the empty list, BY NAME
 * ------------------------------------------------------------------ */

test('a feature outside allowedFeatures is refused, and the rejection names the feature axis', () => {
  const result = resolveManagedService(permittedManagedServiceUse, {
    ...permittedCall,
    feature: 'example_analyze_layout',
  })
  assert.equal(result.ok, false)
  assert.equal(result.ok === false && result.rejection.reason, 'feature_not_permitted')
})

test('an EMPTY allowedFeatures permits NOTHING — the empty list refuses, by name', () => {
  const empty: ManagedServiceUseConfig = {
    ...permittedManagedServiceUse,
    allowedFeatures: [],
  }
  const result = resolveManagedService(empty, permittedCall)
  assert.equal(result.ok, false)
  assert.equal(result.ok === false && result.rejection.reason, 'feature_not_permitted')
})

test('the SHIPPED policy default refuses every feature — the deny-by-construction fixture is executable now', () => {
  /* Not a derived config: the literal that ships in `PLACEHOLDER_POLICY_DEFAULTS`,
   * whose comment says *"empty can only mean no feature permitted"*. Until this
   * test existed that sentence was enforced by nothing. Its other three axes
   * are satisfied by the call below — region `ap-southeast-1`, class `public`
   * against an `internal` ceiling, retention 0 against a tolerance of 0 — so
   * the ONLY thing that can refuse here is the empty feature list. */
  const shipped = PLACEHOLDER_POLICY_DEFAULTS.managed_service_use
  assert.deepEqual(shipped.allowedFeatures, [])
  const result = resolveManagedService(shipped, {
    feature: 'example_extract_text',
    region: 'ap-southeast-1',
    dataClass: 'public',
    providerRetentionDays: 0,
  })
  assert.equal(result.ok, false)
  assert.equal(result.ok === false && result.rejection.reason, 'feature_not_permitted')
})

test('the feature rejection carries the permitted list, so a caller can say WHICH features are open', () => {
  const result = resolveManagedService(permittedManagedServiceUse, {
    ...permittedCall,
    feature: 'example_analyze_layout',
  })
  assert.equal(result.ok, false)
  if (result.ok === false && result.rejection.reason === 'feature_not_permitted') {
    assert.deepEqual(result.rejection.permitted, ['example_extract_text'])
  } else {
    assert.fail('expected a feature_not_permitted rejection carrying the permitted list')
  }
})

/* ------------------------------------------------------------------ *
 * 3. allowedRegions — the only residency constraint extraction has
 * ------------------------------------------------------------------ */

test('a region outside allowedRegions is refused, and the rejection names the region axis', () => {
  const result = resolveManagedService(permittedManagedServiceUse, {
    ...permittedCall,
    region: 'us-west-2',
  })
  assert.equal(result.ok, false)
  assert.equal(result.ok === false && result.rejection.reason, 'region_not_permitted')
})

test('an EMPTY allowedRegions permits NO region — residency fails closed', () => {
  const nowhere: ManagedServiceUseConfig = {
    ...permittedManagedServiceUse,
    allowedRegions: [],
  }
  const result = resolveManagedService(nowhere, permittedCall)
  assert.equal(result.ok, false)
  assert.equal(result.ok === false && result.rejection.reason, 'region_not_permitted')
})

test('the region rejection carries the permitted regions', () => {
  const result = resolveManagedService(permittedManagedServiceUse, {
    ...permittedCall,
    region: 'ap-southeast-2',
  })
  assert.equal(result.ok, false)
  if (result.ok === false && result.rejection.reason === 'region_not_permitted') {
    assert.deepEqual(result.rejection.permitted, ['ap-southeast-1'])
  } else {
    assert.fail('expected a region_not_permitted rejection carrying the permitted regions')
  }
})

/* ------------------------------------------------------------------ *
 * 4. maxDataClassToService — the ceiling on what LEAVES
 * ------------------------------------------------------------------ */

test('a class above the service ceiling is refused, and the rejection names the class axis', () => {
  const result = resolveManagedService(permittedManagedServiceUse, {
    ...permittedCall,
    dataClass: 'sensitive_personal',
  })
  assert.equal(result.ok, false)
  assert.equal(result.ok === false && result.rejection.reason, 'class_above_service_ceiling')
})

test('a class AT the ceiling is permitted — the comparison is at-or-below, not below', () => {
  assert.deepEqual(
    resolveManagedService(permittedManagedServiceUse, {
      ...permittedCall,
      dataClass: 'personal',
    }),
    { ok: true },
  )
})

test('the class rejection carries the ceiling it was measured against', () => {
  const result = resolveManagedService(permittedManagedServiceUse, {
    ...permittedCall,
    dataClass: 'sensitive_personal',
  })
  assert.equal(result.ok, false)
  if (result.ok === false && result.rejection.reason === 'class_above_service_ceiling') {
    assert.equal(result.rejection.ceiling, 'personal')
  } else {
    assert.fail('expected a class_above_service_ceiling rejection carrying the ceiling')
  }
})

test('a class outside the ladder REFUSES rather than passing — indexOf returning -1 must not read as permission', () => {
  /* The precise bug `mayAdmit()`'s comment records having found in a role
   * ladder, where an unrecognised member silently made the check PERMISSIVE.
   * Reached by cast because `DataClass` is closed at compile time and this
   * function will be handed values across a wire that is not. */
  const offLadder = 'confidential' as unknown as DataClass
  const result = resolveManagedService(permittedManagedServiceUse, {
    ...permittedCall,
    dataClass: offLadder,
  })
  assert.equal(result.ok, false)
  assert.equal(result.ok === false && result.rejection.reason, 'class_above_service_ceiling')
})

test('a CEILING outside the ladder refuses too — a corrupt ceiling is not an open one', () => {
  const corrupt: ManagedServiceUseConfig = {
    ...permittedManagedServiceUse,
    maxDataClassToService: 'restricted' as unknown as DataClass,
  }
  const result = resolveManagedService(corrupt, permittedCall)
  assert.equal(result.ok, false)
  assert.equal(result.ok === false && result.rejection.reason, 'class_above_service_ceiling')
})

/* ------------------------------------------------------------------ *
 * 5. maxProviderRetentionDays — a window, not a flag
 * ------------------------------------------------------------------ */

test('a provider window longer than the tolerance is refused, and the rejection names the retention axis', () => {
  const result = resolveManagedService(permittedManagedServiceUse, {
    ...permittedCall,
    providerRetentionDays: 8,
  })
  assert.equal(result.ok, false)
  assert.equal(
    result.ok === false && result.rejection.reason,
    'provider_retention_exceeds_tolerance',
  )
})

test('a provider window EQUAL to the tolerance is permitted — at-or-below again', () => {
  assert.deepEqual(
    resolveManagedService(permittedManagedServiceUse, {
      ...permittedCall,
      providerRetentionDays: 7,
    }),
    { ok: true },
  )
})

test('a tolerance of 0 admits a window of 0 and refuses a window of 1 — the strictest statement is expressible', () => {
  const zeroTolerance: ManagedServiceUseConfig = {
    ...permittedManagedServiceUse,
    maxProviderRetentionDays: 0,
  }
  assert.deepEqual(
    resolveManagedService(zeroTolerance, { ...permittedCall, providerRetentionDays: 0 }),
    { ok: true },
  )
  const result = resolveManagedService(zeroTolerance, {
    ...permittedCall,
    providerRetentionDays: 1,
  })
  assert.equal(result.ok, false)
  assert.equal(
    result.ok === false && result.rejection.reason,
    'provider_retention_exceeds_tolerance',
  )
})

test('the retention rejection carries both numbers, so the operator sees the gap and not just a verdict', () => {
  const result = resolveManagedService(permittedManagedServiceUse, {
    ...permittedCall,
    providerRetentionDays: 30,
  })
  assert.equal(result.ok, false)
  if (
    result.ok === false &&
    result.rejection.reason === 'provider_retention_exceeds_tolerance'
  ) {
    assert.equal(result.rejection.tolerated, 7)
    assert.equal(result.rejection.offered, 30)
  } else {
    assert.fail('expected a provider_retention_exceeds_tolerance rejection carrying both numbers')
  }
})

test('an UNSTATED provider window refuses rather than compares — null is not zero', () => {
  const result = resolveManagedService(permittedManagedServiceUse, {
    ...permittedCall,
    providerRetentionDays: null,
  })
  assert.equal(result.ok, false)
  assert.equal(result.ok === false && result.rejection.reason, 'provider_retention_unevaluable')
})

test('a non-finite provider window refuses — NaN must not slide past a > comparison', () => {
  /* `NaN > 7` is false. A comparison written without this guard REPORTS
   * PERMITTED for a window nobody could evaluate, which is the residency
   * control failing open on the arm nobody looks at. */
  const result = resolveManagedService(permittedManagedServiceUse, {
    ...permittedCall,
    providerRetentionDays: Number.NaN,
  })
  assert.equal(result.ok, false)
  assert.equal(result.ok === false && result.rejection.reason, 'provider_retention_unevaluable')
})

test('a negative provider window refuses — a window below zero is corrupt, not extra-safe', () => {
  const result = resolveManagedService(permittedManagedServiceUse, {
    ...permittedCall,
    providerRetentionDays: -1,
  })
  assert.equal(result.ok, false)
  assert.equal(result.ok === false && result.rejection.reason, 'provider_retention_unevaluable')
})

test('a non-finite TOLERANCE refuses — an uninterpretable ceiling is not an absent one', () => {
  const corrupt: ManagedServiceUseConfig = {
    ...permittedManagedServiceUse,
    maxProviderRetentionDays: Number.POSITIVE_INFINITY,
  }
  const result = resolveManagedService(corrupt, permittedCall)
  assert.equal(result.ok, false)
  assert.equal(result.ok === false && result.rejection.reason, 'provider_retention_unevaluable')
})

/* ------------------------------------------------------------------ *
 * 6. Every arm fires INDEPENDENTLY
 *
 * Without this, one condition could be doing all the work and the other three
 * could be dead code that no test distinguishes.
 * ------------------------------------------------------------------ */

test('each of the five rejection arms fires on its own axis and names itself distinctly', () => {
  const reasons = [
    resolveManagedService(permittedManagedServiceUse, {
      ...permittedCall,
      feature: 'example_analyze_layout',
    }),
    resolveManagedService(permittedManagedServiceUse, {
      ...permittedCall,
      region: 'eu-west-1',
    }),
    resolveManagedService(permittedManagedServiceUse, {
      ...permittedCall,
      dataClass: 'sensitive_personal',
    }),
    resolveManagedService(permittedManagedServiceUse, {
      ...permittedCall,
      providerRetentionDays: 400,
    }),
    resolveManagedService(permittedManagedServiceUse, {
      ...permittedCall,
      providerRetentionDays: null,
    }),
  ].map((r) => (r.ok === false ? r.rejection.reason : 'PERMITTED'))

  assert.deepEqual(reasons, [
    'feature_not_permitted',
    'region_not_permitted',
    'class_above_service_ceiling',
    'provider_retention_exceeds_tolerance',
    'provider_retention_unevaluable',
  ])
  assert.equal(new Set(reasons).size, 5)
})

/* ------------------------------------------------------------------ *
 * 6b. The order of the arms
 *
 * The function's comment claims the order is pinned by test rather than left to
 * drift. This is that test — without it the claim was prose, which is the shape
 * this repository catalogues.
 *
 * ⚠️ THE ORDER IS NOT ITSELF A RULING, unlike G129's reversibility-first. The
 * arms are independent and exactly one fires; no arm can be bought past by
 * another. What this pins is that the answer to a multiply-invalid call does
 * not change silently under an edit.
 * ------------------------------------------------------------------ */

test('a call violating every axis reports feature first, then region, then class, then retention', () => {
  const allBad = {
    feature: 'example_analyze_layout',
    region: 'us-west-2',
    dataClass: 'sensitive_personal',
    providerRetentionDays: 400,
  } as const
  const reasonOf = (call: Parameters<typeof resolveManagedService>[1]): string => {
    const r = resolveManagedService(permittedManagedServiceUse, call)
    return r.ok === false ? r.rejection.reason : 'PERMITTED'
  }

  assert.equal(reasonOf(allBad), 'feature_not_permitted')
  assert.equal(
    reasonOf({ ...allBad, feature: 'example_extract_text' }),
    'region_not_permitted',
  )
  assert.equal(
    reasonOf({ ...allBad, feature: 'example_extract_text', region: 'ap-southeast-1' }),
    'class_above_service_ceiling',
  )
  assert.equal(
    reasonOf({
      ...allBad,
      feature: 'example_extract_text',
      region: 'ap-southeast-1',
      dataClass: 'internal',
    }),
    'provider_retention_exceeds_tolerance',
  )
})

/* ------------------------------------------------------------------ *
 * 7. The resolver is a predicate, not an actor
 * ------------------------------------------------------------------ */

test('the resolver mutates neither the config nor the call it was given', () => {
  const cfg: ManagedServiceUseConfig = {
    ...permittedManagedServiceUse,
    allowedFeatures: [...permittedManagedServiceUse.allowedFeatures],
    allowedRegions: [...permittedManagedServiceUse.allowedRegions],
  }
  const call = { ...permittedCall }
  const before = JSON.stringify({ cfg, call })
  resolveManagedService(cfg, call)
  resolveManagedService(cfg, { ...call, dataClass: 'sensitive_personal' })
  assert.equal(JSON.stringify({ cfg, call }), before)
})

/* ==================================================================== *
 * MUTATION LOG — how each assertion above was proved to bite
 *
 * `resolveManagedService` is a NEW declaration, so no pre-existing red was
 * available and the import error proved only absence. Each mutation below was
 * applied to `model/policy.ts`, `npm test` was run UNPIPED, the named tests
 * were observed red, and the mutation was reverted and the file verified
 * byte-identical. Every mutation compiles cleanly — a mutation caught only by a
 * compile error it introduced tests nothing. Each was compiled with
 * `npx tsc -p model/tsconfig.json --noEmit` and confirmed to produce no error
 * of its own before the suite was run.
 *
 *   M1  Restore the historical `allowedModels` bug on the feature arm:
 *       `cfg.allowedFeatures.length > 0 && !cfg.allowedFeatures.includes(…)`,
 *       so an empty list permits everything.
 *       → EXACTLY TWO tests go red, and they are the two the brief named:
 *          "an EMPTY allowedFeatures permits NOTHING" and "the SHIPPED policy
 *          default refuses every feature". The other three feature tests stay
 *          GREEN because their list is non-empty — which is precisely why the
 *          empty case needed a test of its own rather than being assumed to
 *          follow from the general one.
 *
 *   M2  Drop the non-finite and negative guards, keeping only `offered === null`,
 *       so the remaining values fall through to `offered > tolerated`.
 *       → THREE tests go red: the NaN one, the negative one, and the non-finite
 *          TOLERANCE one. `NaN > 7` is false and `-1 > 7` is false and
 *          `1 > Infinity` is false, so the mutant answers PERMITTED for all
 *          three. That is the residency control failing OPEN, and it is the
 *          arm a reviewer is least likely to look at.
 *
 *   M3  Class comparison `askedRank > ceilingRank` → `>=`.
 *       → "a class AT the ceiling is permitted" goes red, ALONE. Nothing else
 *          moves, because `permittedCall` carries `internal` against a
 *          `personal` ceiling deliberately — a fixture sitting at its own
 *          boundary is what made M2 in the autonomy gate's log red twelve
 *          unrelated tests.
 *
 *   M4  Delete the region arm entirely.
 *       → FOUR red: all three region tests plus "each of the five rejection
 *          arms fires on its own axis". The last one is the point of it.
 *
 *   M5  Drop `askedRank === -1` from the class guard.
 *       → "a class outside the ladder REFUSES rather than passing" goes red,
 *          ALONE, reporting `ok: true` for an unrankable class.
 *
 *   M5b `ceilingRank === -1` dropped from the same guard.
 *       → 🛑 **NOTHING GOES RED, AND THAT IS RECORDED RATHER THAN TIDIED AWAY.**
 *          The disjunct is provably unobservable: `ceilingRank === -1` implies
 *          `ceilingRank < 0 <= askedRank` for every ranked class, so
 *          `askedRank > ceilingRank` already refuses; and an unranked class is
 *          caught by the disjunct M5 tests. No input can make it the sole cause
 *          of a refusal.
 *          **"a CEILING outside the ladder refuses too" therefore passes for a
 *          different reason than its name suggests** — it pins the OUTCOME for a
 *          corrupt ceiling, which is worth pinning and would catch a reordering,
 *          but it does not witness that clause.
 *          The clause is KEPT, for parity with `mayAutoResolve()` three hundred
 *          lines above, whose identical `ceilingRank === -1` guard is
 *          unobservable for exactly the same reason and whose comment calls the
 *          -1 arms *"not defensive noise"*. Removing one and not the other would
 *          leave two sibling gates in one file disagreeing about the shape.
 *          Reported for the record rather than fixed here: `mayAutoResolve()` is
 *          G129's proven work and not this slice's to edit.
 *
 *   M6  Retention comparison `offered > tolerated` → `>=`.
 *       → TWO red, both by design: "a provider window EQUAL to the tolerance is
 *          permitted" and "a tolerance of 0 admits a window of 0". The second
 *          matters more than it looks — under the mutant, `0` tolerance refuses
 *          a `0` window, so the strictest expressible posture would become
 *          unsatisfiable and no managed service could ever be called.
 *
 *   M7  Delete the feature arm entirely (replaced by `void call.feature`, so the
 *       mutation introduces no unused-parameter error of its own).
 *       → FIVE red: all four feature tests plus the five-arm independence test.
 *
 *   M8  Swap the feature and region arms so region is evaluated first.
 *       → "a call violating every axis reports feature first, then region, then
 *          class, then retention" goes red, ALONE. Every single-axis test stays
 *          green, which is the proof that the cascade test is the only thing
 *          pinning the order — and the reason the function's comment may claim
 *          the order is pinned by test rather than by prose.
 * ==================================================================== */
