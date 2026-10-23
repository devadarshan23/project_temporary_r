/**
 * THE PARTNER MASK, READ AS A STATEMENT ABOUT RESOURCE CLASSES — G576,
 * 19 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHY THIS IS NOT A LIST OF TWO VERBS.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `PARTNER_MASK_MEMBERSHIP` is total over `Capability`, so a new capability is
 * a `TS1360` and cannot arrive unclassified — that is the control G209 added
 * and it is real. **What it does not say is whether the resulting SET is still
 * the one the invariants argue for.** `view_metering: []` and
 * `promote_learning: []` each carry a prose reason on their own entry, and a
 * later reader minting a capability in the SAME CLASS can satisfy the compiler
 * by writing `['exceptions_operate']` beside it without ever meeting either
 * sentence.
 *
 * ⚠️ AND THE CHECK THAT EXISTS TODAY IS A HUMAN ONE. An adversarial pass on
 * 19 Sep 2026 verified by hand that neither `metering` nor `statutory` appears
 * in any partner scope, and wrote the verification into a report. **A
 * verification in a report is not a control**; the next capability in either
 * class is one `TS1360` away from being waved into a mask by whoever is
 * clearing compile errors that morning.
 *
 * ┌─ THE TWO CLASSES, AND THE INVARIANT THAT OWNS EACH ────────────────────────┐
 * │                                                                            │
 * │  `metering`  — INVARIANT 5, copied and not paraphrased:                    │
 * │      "Money is always derived. `UsageRecord` is immutable and unpriced —    │
 * │       which is why `metering` is its own resource class: it has no write   │
 * │       mode, and it cannot live in `commercial`, whose defining rule is     │
 * │       that a partner may read it. A raw usage record is volume in the      │
 * │       clear."                                                              │
 * │    The class EXISTS to be the thing a partner may not read. A capability   │
 * │    of this class inside a partner scope deletes the reason the class was   │
 * │    split off `commercial` in the first place.                              │
 * │                                                                            │
 * │  `statutory` — INVARIANT 8, copied and not paraphrased:                    │
 * │      "`statutory` appears in neither, at any price: a statutory obligation │
 * │       is not the customer's to delegate to a processor."                   │
 * │    A partner IS a processor. G75 records that `secret` came OFF            │
 * │    `NON_DELEGABLE_RESOURCES` by an owner ruling and that `statutory`       │
 * │    stayed on it alone — so this assertion is keyed on the LIST rather than │
 * │    on the word, and a future ruling that widens the list widens this too.  │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 AND `commercial` IS THE ONE THAT MUST **NOT** BE ASSERTED ABSENT, WHICH IS
 * WHY THE TEST IS DERIVED RATHER THAN A DENY-LIST OF THREE CLASSES. Invariant 2
 * says a partner reads *"commercial metadata"* by default; `view_commercial` is
 * nonetheless `[]`, and §3 pins the REASON — G271 and §11.9a put the partner
 * commercial read on `partnerCommercialVisibility()`, a four-verdict
 * derivation, because *"a mask intersects capabilities and cannot express the
 * band and nothing inside it"*. An assertion that lumped `commercial` in with
 * `metering` would record the right absence for the wrong reason, and the next
 * reader would delete it when the band lands.
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  CAPABILITIES,
  CAPABILITY_RESOURCE_CLASS,
  PARTNER_ACCESS_SCOPES,
  PARTNER_CAPABILITY_MASK,
  PARTNER_MASK_MEMBERSHIP,
  type Capability,
  type PartnerAccessScopeKey,
} from '../../model/access.ts'
import {
  ACCESS_RESOURCE_CLASSES,
  NON_DELEGABLE_RESOURCES,
} from '../../model/governance.ts'

const SCOPES = Object.values(PARTNER_ACCESS_SCOPES) as readonly PartnerAccessScopeKey[]
const VERBS = Object.values(CAPABILITIES) as readonly Capability[]

/**
 * The scopes one capability names, widened from the `as const` literal.
 *
 * ⚠️ THE WIDENING IS A `tsc` ACCOMMODATION AND NOT A LOOSENING, AND IT IS
 * NAMED BECAUSE A CAST IN A TEST IS EXACTLY WHERE AN ASSERTION GOES QUIETLY
 * VACUOUS. `PARTNER_MASK_MEMBERSHIP` is `as const`, so an out-of-mask entry is
 * typed `readonly []` and `.includes()` on it takes `never` — the compiler is
 * telling the truth about a literal and the wrong thing about the RECORD. The
 * value is untouched; only its static type is read one level less narrowly.
 */
function scopesNaming(verb: Capability): readonly PartnerAccessScopeKey[] {
  return PARTNER_MASK_MEMBERSHIP[verb] as readonly PartnerAccessScopeKey[]
}

/** Every capability any partner scope admits, derived rather than listed. */
function everythingMasked(): readonly Capability[] {
  return [...new Set(SCOPES.flatMap((s) => PARTNER_CAPABILITY_MASK[s]))]
}

describe('the partner mask never reaches metering or a non-delegable class', () => {
  /* ================================================================ *
   * §1 · INVARIANT 5. Derived from the class, not from a verb name.
   * ================================================================ */

  it('1 · no capability of class `metering` appears in any partner scope', () => {
    const metering = VERBS.filter(
      (v) => CAPABILITY_RESOURCE_CLASS[v] === ACCESS_RESOURCE_CLASSES.metering,
    )
    assert.notEqual(
      metering.length,
      0,
      'THE CLASS HAS NO CAPABILITY, SO THIS ASSERTION IS VACUOUS AND MUST BE FIXED RATHER ' +
        'THAN DELETED. `view_metering` was minted precisely because `metering` was a ' +
        'reachable and empty class; if it is gone, find out what replaced it.',
    )

    const leaked = metering.filter((v) => scopesNaming(v).length > 0)
    assert.deepEqual(
      leaked,
      [],
      'INVARIANT 5: "A raw usage record is volume in the clear." `metering` is its own ' +
        'resource class precisely BECAUSE a partner may read `commercial` and must not read ' +
        'this — §11.9a: "spend and rate together invert to volume, so a partner supporting ' +
        'a customer\'s queue would read that customer\'s transaction volume in the clear ' +
        `through the mask." Leaked: ${leaked.join(', ')}`,
    )
  })

  /* ================================================================ *
   * §2 · INVARIANT 8, keyed on the LIST rather than on the word.
   * ================================================================ */

  it('2 · no capability of a NON_DELEGABLE class appears in any partner scope', () => {
    const nonDelegable = VERBS.filter((v) =>
      NON_DELEGABLE_RESOURCES.includes(CAPABILITY_RESOURCE_CLASS[v]),
    )
    assert.notEqual(
      nonDelegable.length,
      0,
      'no capability maps to any non-delegable class, so this assertion proves nothing. ' +
        '`NON_DELEGABLE_RESOURCES` holds `statutory` alone (G75), and `place_legal_hold` ' +
        'and `handle_subject_request` are its capabilities — if both are gone, this ' +
        'assertion needs re-arguing rather than deleting.',
    )

    const leaked = nonDelegable.filter((v) => scopesNaming(v).length > 0)
    assert.deepEqual(
      leaked,
      [],
      'INVARIANT 8: "`statutory` appears in neither, at any price: a statutory obligation ' +
        'is not the customer\'s to delegate to a processor." A PARTNER IS A PROCESSOR. ' +
        'This is keyed on `NON_DELEGABLE_RESOURCES` rather than on the word `statutory`, ' +
        'so G75\'s removal of `secret` from that list widened this assertion in the same ' +
        `commit and a future widening will widen it again. Leaked: ${leaked.join(', ')}`,
    )
  })

  /* ================================================================ *
   * §3 · `commercial` IS ABSENT AND THE REASON IS NOT THE OTHER TWO.
   * ================================================================ */

  it('3 · `commercial` is absent too, and the reason is the BAND rather than the class', () => {
    /**
     * Pinned as a DIFFERENT fact so nobody folds it into §1 and §2. If a future
     * ruling puts the partner commercial read behind a verb, this assertion is
     * the one that should go red — and §1 and §2 must not.
     */
    assert.deepEqual(
      PARTNER_MASK_MEMBERSHIP.view_commercial,
      [],
      'G271 and §11.9a: the partner commercial read is `partnerCommercialVisibility()`, ' +
        '"a derivation yielding one of four verdicts per tenant. A mask intersects ' +
        'capabilities and cannot express the band and nothing inside it, so putting the ' +
        'verb here would route around the verdict entirely." ' +
        '⚠️ IF THIS IS RED BECAUSE A RULING PUT THE VERB IN A SCOPE, THAT IS A DIFFERENT ' +
        'DECISION FROM §1 AND §2 AND MUST NOT BE READ AS PERMISSION TO TOUCH EITHER: ' +
        'invariant 2 admits "commercial metadata" by name and admits nothing about ' +
        'metering or statute.',
    )
  })

  /* ================================================================ *
   * §3a · THE SAME ABSENCE, KEYED ON THE CLASS. G882, 20 Sep 2026.
   * ================================================================ */

  it('3a · and NO capability of class `commercial` names a partner scope — the class, not the verb', () => {
    /**
     * ═══════════════════════════════════════════════════════════════════════
     * 🛑 §3 ABOVE IS KEYED ON A VERB NAME, AND THAT IS THIS SUITE'S OWN
     *    DEFECT ARRIVING IN THE SUITE WRITTEN TO CATCH IT.
     * ═══════════════════════════════════════════════════════════════════════
     *
     * G577's ruling is quoted at the head of this file: *"the ceiling is
     * asserted over the RESOURCE CLASS, derived from
     * `CAPABILITY_RESOURCE_CLASS`, and never as a list of verb names"*, and
     * its reason is that *"a later reader minting a capability in the SAME
     * CLASS can satisfy the compiler by writing `['exceptions_operate']`
     * beside it without ever meeting either sentence."* §3 reads
     * `PARTNER_MASK_MEMBERSHIP.view_commercial` — one property, by name — so
     * that sentence was true of `commercial` while it was being enforced for
     * `metering` and `statutory`.
     *
     * ┌─ MEASURED 20 Sep 2026 BY MUTATION, NOT REASONED ─────────────────────┐
     * │ MUTATION · reclass an existing verb to `commercial` and admit it to a │
     * │   partner scope — `promote_learning: 'authority'` → `'commercial'`,   │
     * │   `PARTNER_MASK_MEMBERSHIP.promote_learning: []` →                    │
     * │   `['exceptions_operate']`.                                           │
     * │                                                                       │
     * │   THIS SUITE WENT 5 PASS, 0 FAIL. All five. §1 does not see it        │
     * │   (not `metering`), §2 does not (`commercial` is not in               │
     * │   `NON_DELEGABLE_RESOURCES`), §3 does not (it names one verb), and    │
     * │   §4 and §5 are consistency and non-emptiness.                        │
     * │                                                                       │
     * │   The reds that DID appear elsewhere were every one of them keyed on  │
     * │   `promote_learning` BY NAME, or a set literal to be swept — which a  │
     * │   genuinely NEW verb of this class would not trip at all.             │
     * │                                                                       │
     * │ AND THE LIVE CASE IS NOT HYPOTHETICAL: the owner's `write_commercial` │
     * │   ruling of 20 Sep 2026 mints exactly such a verb. See G881/G882.     │
     * └───────────────────────────────────────────────────────────────────────┘
     *
     * ⚠️ THIS DOES NOT FOLD `commercial` INTO §1 AND §2, AND THE SEPARATION IS
     *    §3's POINT RATHER THAN TIDINESS. The REASON is different and stays
     *    different: `metering` and `statutory` are absent because a partner
     *    may never read them; `commercial` is absent because invariant 2
     *    admits *"commercial metadata"* and a mask is the wrong instrument for
     *    it — `partnerCommercialVisibility()` yields one of four verdicts per
     *    tenant, and *"a mask intersects capabilities and cannot express the
     *    band and nothing inside it"*. A ruling that puts a `commercial` verb
     *    in a scope should make THIS red and must not be read as permission to
     *    touch §1 or §2.
     */
    const commercial = VERBS.filter(
      (v) => CAPABILITY_RESOURCE_CLASS[v] === ACCESS_RESOURCE_CLASSES.commercial,
    )
    assert.notEqual(
      commercial.length,
      0,
      'THE CLASS HAS NO CAPABILITY, SO THIS ASSERTION IS VACUOUS AND MUST BE FIXED RATHER ' +
        'THAN DELETED — the §5.6 guard §1 and §2 already carry. `view_commercial` was minted ' +
        '7 Aug 2026; if it is gone, find out what replaced it.',
    )

    const leaked = commercial.filter((v) => scopesNaming(v).length > 0)
    assert.deepEqual(
      leaked,
      [],
      'A CAPABILITY OF CLASS `commercial` IS INSIDE A PARTNER SCOPE. If this is a WRITE verb ' +
        'the case is stronger than §3\'s, not weaker: invariant 2 admits a partner READ of ' +
        '"commercial metadata" and says nothing whatever about a partner MOVING money on a ' +
        "customer's account. `model/access.ts` puts the partner commercial path on " +
        '`partnerCommercialVisibility()` precisely so that a mask cannot route around the ' +
        `verdict. Leaked: ${leaked.join(', ')}`,
    )
  })

  /* ================================================================ *
   * §4 · THE DERIVED MASK AGREES WITH THE MEMBERSHIP IT IS DERIVED
   *      FROM — so §1–§3 cannot be true of one and false of the other.
   * ================================================================ */

  it('4 · every masked capability names its scope in PARTNER_MASK_MEMBERSHIP, both ways', () => {
    for (const scope of SCOPES) {
      for (const verb of PARTNER_CAPABILITY_MASK[scope]) {
        assert.equal(
          scopesNaming(verb).includes(scope),
          true,
          `\`${verb}\` is in \`PARTNER_CAPABILITY_MASK.${scope}\` and does not name that ` +
            'scope in `PARTNER_MASK_MEMBERSHIP`. The mask is DERIVED, so this can only ' +
            'mean the derivation has been replaced by a literal — and §1–§3 assert on the ' +
            'MEMBERSHIP, so a hand-written mask would make all three vacuous.',
        )
      }
    }
    for (const verb of VERBS) {
      for (const scope of scopesNaming(verb)) {
        assert.equal(
          PARTNER_CAPABILITY_MASK[scope].includes(verb),
          true,
          `\`${verb}\` names \`${scope}\` and is absent from the derived mask.`,
        )
      }
    }
  })

  /* ================================================================ *
   * §5 · THE ALLOW ARM. §5.6 — a control that only ever refuses is not
   *      observably a control.
   * ================================================================ */

  it('5 · the mask is not empty, and `commercial_only` is', () => {
    assert.notEqual(
      everythingMasked().length,
      0,
      'EVERY ASSERTION ABOVE PASSES AGAINST AN EMPTY MASK. §5.6: a control whose only ' +
        'observable behaviour is refusal is not observably a control.',
    )
    assert.deepEqual(
      PARTNER_CAPABILITY_MASK.commercial_only,
      [],
      '`commercial_only` is the DEFAULT posture and holds nothing — which is what makes ' +
        'it the principal §10.6 keeps `view_summary` out of the mask for: "holding ' +
        'nothing, passing every check that tests for a capability."',
    )
  })
})
