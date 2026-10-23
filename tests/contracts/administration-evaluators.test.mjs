/**
 * WHY THE FIFTY-NINE CANNOT BE ANNOTATED TODAY, AND WHY IT IS NOT A MATTER OF
 * EFFORT — G602, 19 Sep 2026. A MEASUREMENT, NOT AN ARGUMENT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE OWNER'S RULING OF 19 Sep 2026 READS, IN PART, *"annotate all 59
 *    operations with real capabilities"*. THIS FILE MEASURES WHAT THAT COSTS
 *    AND WHY 33 OF THE 59 WOULD DECLARE A GATE THEIR OWN PRINCIPAL CANNOT
 *    OPEN — WHICH IS THE EXACT DEFECT G288 AND G289 IDENTIFIED AND THE REASON
 *    THE TIER WAS ANNOTATED `exempt:` IN THE FIRST PLACE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ **THE DEADLOCK THIS FILE MEASURED WAS BROKEN BY A SPLIT ON 19 Sep 2026,
 * AND THE NUMBER IN THE TABLE BELOW THAT WAS WRONG IS THE ONE THIS FILE PUT A
 * ✅ AGAINST.** The owner ruled that the `platform-role` subset becomes its own
 * document — `platform-console.openapi.yaml` — so that ONE tier can be
 * `TIER_REQUIRES_CAPABILITY: true` while this one stays `false`. **The
 * all-or-nothing property §1b measures is UNCHANGED and is the whole reason a
 * new file was needed rather than a second annotation pass.**
 *
 * 🛑 **AND THE SPLIT MEASURED THE `platform-role` ROW AND FOUND IT WRONG: 14 OF
 * THE 26 COULD MOVE, NOT 26.** The row below reads *"platform-role 26 ✅ SINCE
 * G601"*, and that is this file committing the error it exists to catch — it
 * keys on `x-admin-authority` (the landmark) rather than on *"does a capability
 * exist, in a class `PLATFORM_ASSIGNMENT_REACHES` opens, whose mode fits this
 * act"* (the property). §5.1, inside the measurement written to catch §5.1.
 * **Twelve of the twenty-six stayed**, and §2 below now measures the split
 * rather than the landmark:
 *
 *   · `raiseAdjustment` — `commercial` IS open, and `view_commercial` is a READ
 *     verb on a POST that moves money. No write verb on `commercial` exists.
 *   · the four partner-registry operations — a partner is not a tenant and is
 *     not one of the thirteen `ACCESS_RESOURCE_CLASSES`. No class, no verb.
 *   · the two sign-in-domain operations — `identity`, which
 *     `PLATFORM_ASSIGNMENT_REACHES` refuses DELIBERATELY on G289's
 *     second-order argument.
 *   · the four support-case and break-glass operations — invariant 8's grant
 *     path, evaluated by `authorisationPermits()`, which `decide()` never
 *     consults.
 *   · `listStaffNotifications` — a notice carries no figure and no
 *     counterparty. No class.
 *
 * **The rows for `tenant-access-grant` (9), `partner-arrangement` (15) and
 * `partner-portal-role` (9) are unchanged and were all correct.** Only the row
 * with the ✅ on it was wrong, which is the direction that costs something.
 *
 * ┌─ THE STRUCTURAL FACT NO DOCUMENT HAD WRITTEN DOWN ─────────────────────────┐
 * │                                                                            │
 * │ `TIER_REQUIRES_CAPABILITY` is a `Record<TierName, boolean>` and a TierName  │
 * │ is a FILE. `tools/check-capability-annotations.mjs` then enforces both      │
 * │ directions of that one boolean:                                            │
 * │                                                                            │
 * │   check D — an `exempt:` on a tier whose verdict is `true`  → exit 1        │
 * │   check E — a capability on a tier whose verdict is `false` → exit 1        │
 * │                                                                            │
 * │ **So the administration tier is ALL-OR-NOTHING.** There is no state of the  │
 * │ tree in which 26 operations name a capability and 33 state an exemption.    │
 * │ Annotating the platform-role subset — the one subset that now HAS a         │
 * │ namable capability, G601 — is a RED GATE, not a partial delivery.           │
 * │                                                                            │
 * │ That is why G601 mints five capabilities and touches                        │
 * │ `docs/contracts/administration.openapi.yaml` not at all.                    │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE FOUR EVALUATORS, MEASURED ONE AT A TIME ──────────────────────────────┐
 * │  `x-admin-authority`  ops  can it name a capability today?                 │
 * │  ───────────────────  ───  ──────────────────────────────────────────────  │
 * │  platform-role         26  ✅ SINCE G601. `decide()`'s fourth arm reaches   │
 * │                            `substrate` and `catalogue`, and five verbs     │
 * │                            now point there.                                │
 * │  tenant-access-grant    9  ⛔ The acts are `configuration` and              │
 * │                            `substrate`-in-a-tenant, reached by an FDE      │
 * │                            under a `TenantAccessGrant` and evaluated by    │
 * │                            `authorisationPermits()`. ⚠️ `decide()` did not │
 * │                            consult a staff grant until G2591 (1 Oct 2026); │
 * │                            its ASSIGNMENT table still refuses              │
 * │                            `configuration` deliberately —                  │
 * │                            *"The grant already reaches this; the           │
 * │                            assignment does not need to."* A capability     │
 * │                            here names the grant path's verb and gates it   │
 * │                            on the assignment path's evaluator.             │
 * │  partner-arrangement   15  ⛔ `decide()`'s partner arm requires a live      │
 * │                            `PartnerAccessGrant`, which is PER CUSTOMER      │
 * │                            TENANT, and the tier's own §2 derives that      │
 * │                            *"nothing in this document reads a customer     │
 * │                            tenant."* G578 measures the same thing.         │
 * │  partner-portal-role    9  ⛔ NOT BUILT. Nothing in `model/` declares a     │
 * │                            partner portal principal; `decide()` has four   │
 * │                            arms and none of them is one.                   │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ✅ **THE LAST ROW WENT FALSE ON 1 Oct 2026 — R10, THE OWNER'S — AND IT IS
 *    CORRECTED HERE RATHER THAN IN THE BOX, because the box is the measurement
 *    of 19 Sep 2026 and §4 below was the tripwire armed on it.** `model/access.ts`
 *    §6c declares `PartnerRole` and `PartnerRoleAssignment`, `decide()` gains
 *    a FIFTH arm, and three resource classes — `deal`, `sandbox`,
 *    `partner_staff` — carry six verbs. **Eight of the nine `partner-portal-role`
 *    operations can now NAME a capability** (`requestRateCardChange` cannot:
 *    a commercial conversation, and G271 keeps the partner's commercial path
 *    off every verb). **NONE IS ANNOTATED**, because every one of the eight is
 *    TABLE-BLOCKED — no deal, sandbox or invitation table exists, and
 *    `listPartnerPeople` needs colleagues' names from `tenant."user"`, which
 *    G447 measures as visible only to its own owner. So the ⛔ moved from
 *    *"no principal"* to *"no data"*, and §4 now asserts the principal EXISTS.
 *    ⚠️ **`ORG_CLASSES` IS STILL THREE** — the fifth arm dispatches on the
 *    capability's CLASS, not on a fifth organisation.
 *
 * ⚠️ WHAT THIS FILE IS NOT. It is not an argument that the tier should stay
 *    `false`, and it takes no position on `server/contract/capability.ts`'s
 *    verdict. It measures the preconditions, so the commit that flips that
 *    boolean has to satisfy them rather than discover them.
 *
 * ┌─ WITNESSED RED FIRST. THE EXACT TEXT IS TRANSCRIBED FROM THE RUNS. ───────┐
 * │                                                                            │
 * │ MUTATION A · `TIER_REQUIRES_CAPABILITY.administration = true`. §1 red:      │
 * │     AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:   │
 * │       actual: true,  expected: false                                        │
 * │   AND the real checker fires on the same tree, which is the point of        │
 * │   running both — `node tools/check-capability-annotations.mjs`:             │
 * │     🛑 D · a gated tier bought out with a reason                            │
 * │     59 operation(s) on a tier whose TIER_REQUIRES_CAPABILITY is `true`      │
 * │     carry a stated EXEMPTION rather than a capability.                      │
 * │   **Fifty-nine, not thirty-three.** That is the all-or-nothing property     │
 * │   measured against the gate rather than reasoned from its source.           │
 * │                                                                            │
 * │ MUTATION B · `PLATFORM_ASSIGNMENT_REACHES.configuration = true`. §3 red:    │
 * │     AssertionError [ERR_ASSERTION]: if this is ever `true`, re-read this    │
 * │     test: the 9 become annotatable and the reason recorded here is gone.    │
 * │                                                                            │
 * │ ⚠️ WHAT SURVIVED EVERY MUTATION AND IS REPORTED RATHER THAN HIDDEN: §2.     │
 * │   Its two halves are derivations over records this file does not own, so    │
 * │   it re-states G601 rather than guarding it — `tests/model/platform-only-   │
 * │   capabilities.test.ts` is where that content is witnessed. §2 is kept      │
 * │   because it is the row of the table above that a reader will check first.  │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 AND IT IS A TRIPWIRE IN ONE DIRECTION, DELIBERATELY. §4 goes RED the day
 *    somebody declares a partner portal principal in `model/`, because at that
 *    point one of the four blockers is gone and this file's summary is stale.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  EXEMPT_WITH_A_PERSON_TO_ASK,
  callerMayBeAPerson,
  runChecks,
  classifyAnnotation,
  declaredOperations,
} from '../../tools/check-capability-annotations.mjs'
import * as access from '../../model/access.ts'

const ADMINISTRATION = 'administration'
const SPEC = 'docs/contracts/administration.openapi.yaml'

/**
 * The authority per operation, read off the document. A LINE SCANNER, and it is
 * the same shape `tests/contracts/administration-wire.test.mjs` already uses —
 * G109's parser is applied in `server/`, and `tools/`/`tests/` still scan.
 * §1a is the anti-vacuous control that keeps a scanner returning nothing from
 * passing for a finding.
 */
function authorityByOperation() {
  const out = new Map()
  let current = null
  for (const line of readFileSync(SPEC, 'utf8').split('\n')) {
    const op = line.match(/^ +operationId: ([a-zA-Z]+)$/)
    if (op) {
      current = op[1]
      continue
    }
    const auth = line.match(/^ +x-admin-authority: (\S+)/)
    if (auth && current) out.set(current, auth[1])
  }
  return out
}

/* ==================================================================== *
 * 1 · THE TIER VERDICT IS ONE BOOLEAN, AND THE CHECKER ENFORCES IT IN
 *     BOTH DIRECTIONS. This is the all-or-nothing fact.
 * ==================================================================== */

/**
 * 🛑 **THE THREE R8 GATED IN PLACE — 21 Sep 2026, THE OWNER'S RULING.**
 *
 * *"Annotate the three onboarding operations in place as
 * `x-capability: view_substrate` on the administration tier."* They are the
 * only operations on this tier that name a capability, and they are the reason
 * two numbers in §1 that were once necessarily equal are now three apart.
 *
 * ⚠️ **THEY DID NOT MOVE DOCUMENT, WHICH IS THE DIFFERENCE FROM G781.** That
 * ruling cut fourteen operations into `platform-console.openapi.yaml` because
 * the gate verdict was per FILE; G911 retired that table, so in-place became
 * possible and — in the owner's words on the split — *"less surgery than
 * another contract split."*
 */
const GATED_BY_R8 = ['listOnboardingSteps', 'completeOnboardingStep', 'forceOnboardingStep']

/**
 * ✅ **AND NINE MORE, GATED IN PLACE ON 1 Oct 2026 — W5, G2633–G2640.** R10
 * minted six partner-only verbs (G2321) and the fifth arm answers them; W5 gave
 * their operations tables and an invariant 10 home (G2621), so each is
 * annotated with its verb, R8's way. Five are mounted; four are annotated and
 * named unmounted at the mount. **This list is the argument the census below
 * now subtracts**, so a tenth leaving the population owes an entry here.
 */
const GATED_BY_W5 = {
  listDealRegistrations: 'view_deals',
  submitDealRegistration: 'register_deal',
  requestTrialTenant: 'register_deal',
  getSandboxTenant: 'view_sandbox',
  requestSandboxTenant: 'operate_sandbox',
  handBackSandboxTenant: 'operate_sandbox',
  resetSandboxTenant: 'operate_sandbox',
  listPartnerPeople: 'view_partner_staff',
  invitePartnerPerson: 'manage_partner_staff',
}

test('1 · every administration operation is `exempt:` and the tier verdict is `false`', () => {
  const ops = declaredOperations().filter((o) => o.tier === ADMINISTRATION)

  // ⚠️ 59 UNTIL THE SPLIT OF 19 Sep 2026; 14 operations moved to
  // `platform-console.openapi.yaml`. The equality is kept rather than softened
  // to a floor because this file's whole subject is the exact composition of
  // this tier — a floor here would let the next fourteen leave unremarked.
  assert.equal(ops.length, 45, 'the tier is not registered, or the scanner found nothing')
  /**
   * ⚠️ **THIS READ `assert.equal(TIER_REQUIRES_CAPABILITY[ADMINISTRATION],
   * false)` UNTIL 20 Sep 2026 AND G913 RETIRED THAT TABLE.** The claim it made
   * is kept and is now made about the OPERATIONS rather than about the file:
   * all 45 state an exemption, and all 45 face a PERSON, which is the pair
   * that made the retired `false` uncomfortable and which
   * `EXEMPT_WITH_A_PERSON_TO_ASK.administration` now pins at exactly 45.
   */
  assert.equal(
    ops.filter((o) => callerMayBeAPerson(o.caller)).length,
    45,
    'every caller of this tier is a person by `sessionContext`, which is why an exemption here ' +
      'costs something the other four `false` tiers never cost. ⚠️ THIS IS STILL 45 AFTER R8 ' +
      'AND THE CENSUS BELOW IS 42, AND THE GAP IS THE WHOLE POINT: gating an operation does ' +
      'not change WHO CALLS IT, it changes whether the gate is asked.',
  )
  /**
   * ⚠️ **THIS ASSERTED 45 UNTIL 21 Sep 2026 — R8, THE OWNER'S.** Three
   * operations left the census WITHOUT leaving the tier: `listOnboardingSteps`,
   * `completeOnboardingStep` and `forceOnboardingStep` are annotated
   * `view_substrate` in place, and a GATED operation is not in this
   * population by construction. **The two numbers above and below have stopped
   * agreeing, and that is the finding rather than a drift** — before R8 they
   * were necessarily equal, because every operation here was exempt.
   */
  assert.equal(
    EXEMPT_WITH_A_PERSON_TO_ASK[ADMINISTRATION],
    45 - GATED_BY_R8.length - Object.keys(GATED_BY_W5).length,
    'the census and this tier disagree. R8 gated three operations IN PLACE; a fourth leaving ' +
      'this population for any other reason owes an argument here and in ' +
      '`tests/http/administration-tier-unmounted.test.ts` §1a.',
  )

  for (const o of ops) {
    if (o.operationId in GATED_BY_W5) {
      const a = classifyAnnotation(o.annotation)
      assert.equal(
        a.kind === 'capability' ? a.capability : a.kind,
        GATED_BY_W5[o.operationId],
        `${o.operationId} does not name the R10 verb W5 annotated it with`,
      )
      continue
    }
    if (GATED_BY_R8.includes(o.operationId)) {
      assert.equal(
        classifyAnnotation(o.annotation).kind,
        'capability',
        `${o.operationId} is on R8's list and does not name a capability. **R8 IS THE OWNER'S ` +
          'RULING AND UN-GATING ONE OF THESE IS REVERSING IT**, not a cleanup: an exemption ' +
          'here restores the ungated 200 §3b of ' +
          '`tests/http/administration-tier-unmounted.test.ts` measures.',
      )
      continue
    }
    assert.equal(
      classifyAnnotation(o.annotation).kind,
      'exempt',
      `${o.operationId} names a capability where this file expects an exemption. ⚠️ SINCE ` +
        'G911 THAT IS NO LONGER A RED GATE BY ITSELF — check E now asks whether the CALLER is a ' +
        'person, and here it is, so a capability would be admissible. What it WOULD move is ' +
        'the census: `EXEMPT_WITH_A_PERSON_TO_ASK.administration` would be one lower. Sweep ' +
        'it, and read §1b before concluding the annotation is still all-or-nothing. ' +
        '🛑 AND READ R8 FIRST: three operations here ALREADY name a capability, so "a ' +
        'capability on this tier" is no longer the unusual event this message was written ' +
        'about — what is unusual is a FOURTH, and it owes the three-part derivation ' +
        '`server/data-plane/onboarding.ts` writes out.',
    )
  }
})

test('1a · ANTI-VACUOUS — the scanner really does read the document', () => {
  const authority = authorityByOperation()
  assert.equal(authority.size, 45, `the line scanner over ${SPEC} found ${authority.size}`)
  // STILL FOUR AFTER THE SPLIT, and that is worth asserting rather than
  // assuming: twelve `platform-role` operations stayed, so the vocabulary did
  // not narrow to three. If it ever does, every `platform-role` act left here
  // found a verb and the split should be finished rather than extended.
  assert.equal(new Set(authority.values()).size, 4, 'four evaluators, as x-admin-authority declares')
})

test('1b · A MIXED DOCUMENT IS NOW A LEGAL STATE — G911, AND THE OLD MEASUREMENT IS QUOTED', () => {
  /**
   * ⛔ **THIS ASSERTION HELD THE OPPOSITE PROPERTY UNTIL 20 Sep 2026 AND IT
   * WAS THE LOAD-BEARING MEASUREMENT OF G602 AND G781. IT IS QUOTED WHOLE
   * RATHER THAN DELETED, BECAUSE IT IS THE SENTENCE THAT CAUSED
   * `platform-console.openapi.yaml` TO EXIST:**
   *
   *     "🛑 THE LOAD-BEARING MEASUREMENT. The checker's two rules are
   *      reproduced here over a hypothetical tier, so the all-or-nothing
   *      property is a demonstration rather than a reading of the checker's
   *      source.
   *        `verdict=false` + a capability → check E fires.
   *        `verdict=true`  + an exemption → check D fires.
   *      There is no third boolean, so a tier carrying both shapes fires one
   *      of the two whichever way the verdict is written. **A partial
   *      annotation of this tier fails the gate in both possible worlds.**"
   *
   * **Every word of that was true of the tree it was written against, and
   * the owner's ruling of 20 Sep 2026 is that the premise should not have
   * been:** *"the file boundary should not carry an authorisation decision."*
   * There is no boolean now, so there are no two possible worlds — there is
   * one world, in which each operation answers for itself.
   *
   * 🛑 **AND THIS IS DRIVEN THROUGH THE REAL `runChecks()`, NOT THROUGH A
   * REPRODUCTION OF ITS RULES.** The old form's honesty note said it
   * reproduced the rules *"rather than [reading] the checker's source"* —
   * which was the only option when the rules were two lines. It is not the
   * only option now, and a re-implementation here would be §5.3: two
   * statements of one rule, of which the copy is the one that drifts.
   */
  const real = declaredOperations()
  /* THE MIXED DOCUMENT, BUILT BY MUTATING ONE REAL ADMINISTRATION OPERATION
     FROM AN EXEMPTION TO A CAPABILITY — the exact change G781 had to cut a
     file to express. `listPartnerRegistry` is chosen because it is the
     operation `tests/http/administration-tier-unmounted.test.ts` §3b measures
     the ungated 200 on, so the two files are talking about the same act. */
  const TARGET = 'listPartnerRegistry'
  assert.ok(
    real.some((o) => o.tier === ADMINISTRATION && o.operationId === TARGET),
    `${TARGET} is not on this tier any more; pick another exempt administration operation.`,
  )
  const mixed = real.map((o) =>
    o.tier === ADMINISTRATION && o.operationId === TARGET ? { ...o, annotation: 'view_substrate' } : o,
  )

  const { findings } = runChecks(mixed)
  const codes = findings.map((f) => f.code)

  /* 🛑 CHECK E DOES NOT FIRE, AND THAT IS THE RULING DELIVERED. Before
     G911 this same mutation was `check E · a capability off the tier that has
     a principal` — a CATEGORY ERROR, unfixable without moving the operation
     to another file. The caller here is a person, so there is a principal to
     ask about, so there is nothing categorical left to refuse. */
  assert.deepEqual(
    codes.filter((c) => c.startsWith('E ·')),
    [],
    'check E fired on a capability whose caller is a PERSON. That is the all-or-nothing ' +
      'property returning, and it is the thing G911 removed.',
  )

  /* ⚠️ WHAT DOES FIRE IS CHECK D, AND IT IS THE WHOLE OF WHAT REPLACES THE
     ARGUMENT: the person-facing exemption population moved 45 → 44, and that
     is a number somebody must sweep with a reason rather than a category
     nobody may enter. A reader must not read this as "the change is still
     refused" — it is RECORDED, and recording is the point. */
  assert.deepEqual(
    codes.filter((c) => c.startsWith('D ·')),
    ['D · the person-facing exemption census moved'],
    'annotating one of the 45 must move the census and say so. If this is empty, the census ' +
      'is not counting what it claims to count and check D is decoration.',
  )
  const d = findings.find((f) => f.code.startsWith('D ·'))
  /* ⚠️ `42, … 41` UNTIL W5 GATED NINE IN PLACE (1 Oct 2026); the property is the MOVE, not the number. */
  assert.match(d.detail, /administration: recorded 33, tree says 32/)
})

test('1c · AND THE MIRROR: AN EXEMPTION BESIDE A CAPABILITY IN ONE DOCUMENT IS ALSO LEGAL', () => {
  /**
   * 🛑 THE OTHER HALF OF §1b, AND IT IS THE HALF THAT USED TO BE CHECK D's
   * HARD REFUSAL — so a reader meets the COST of this slice as well as its
   * benefit. Mutating a `platformConsole` operation from a capability to an
   * exemption was a RED GATE before G911 (*"a gated tier bought out with a
   * reason"*) and is now a census movement, 0 → 1.
   *
   * ⚠️ **THAT IS STRICTLY WEAKER AT THE DOCUMENT LEVEL AND STRICTLY
   * STRONGER AT THE MOUNT**, and both halves are asserted — here, and in
   * `tests/http/per-operation-gate-verdict.test.ts` §2, where the same shape
   * is a BOOT FAILURE rather than a finding. Neither assertion is evidence
   * without the other.
   */
  const real = declaredOperations()
  const TARGET = 'listTenants'
  assert.ok(
    real.some((o) => o.tier === 'platformConsole' && o.operationId === TARGET),
    `${TARGET} is not on the platformConsole tier any more; pick another gated console operation.`,
  )
  const mixed = real.map((o) =>
    o.tier === 'platformConsole' && o.operationId === TARGET
      ? { ...o, annotation: 'exempt: a staff person reading the fleet roster holds no tenant grant' }
      : o,
  )
  const { findings } = runChecks(mixed)
  const d = findings.find((f) => f.code.startsWith('D ·'))
  assert.ok(d, 'an exemption arriving on a tier pinned at zero must be a finding, and was not')
  assert.match(d.detail, /platformConsole: recorded 0, tree says 1/)
  assert.match(d.detail, /platformConsole → listTenants/)
})

/* ==================================================================== *
 * 2 · THE ONE EVALUATOR THAT CAN NAME A CAPABILITY TODAY.
 * ==================================================================== */

test('2 · `platform-role` — 26 operations, and G601 gave FOURTEEN of them verbs, not 26', () => {
  const authority = authorityByOperation()
  const platformRole = [...authority].filter(([, a]) => a === 'platform-role')

  /**
   * ⚠️ THIS ASSERTED 26 UNTIL THE SPLIT OF 19 Sep 2026 AND THE 26 WAS THIS
   * FILE'S OWN ERROR, not a number that went stale. The `platform-role`
   * operations were never one set for annotation purposes: the property is the
   * CLASS the act touches, and twelve of the twenty-six touch a class the
   * platform arm refuses — or touch `commercial`, which it opens and which has
   * no write verb. Twelve remain here and fourteen moved.
   */
  assert.equal(
    platformRole.length,
    12,
    'the twelve `platform-role` operations with no namable verb stay on this tier with their ' +
      'exemptions. If this is 26 again, the split was reverted; if it is 0, somebody moved the ' +
      'twelve without minting their verbs and put ungateable operations on a gated tier.',
  )

  const consoleOps = declaredOperations().filter((o) => o.tier === 'platformConsole')
  assert.equal(consoleOps.length, 14, 'the fourteen that could move')
  /**
   * ⚠️ **THIS ASSERTED `TIER_REQUIRES_CAPABILITY['platformConsole'] ===
   * true` WITH THE MESSAGE *"THE WHOLE POINT OF THE SPLIT … the only way to
   * gate the fourteen without gating the forty-five was to make them a
   * different file"*, AND G911 RETIRED BOTH THE TABLE AND THE PREMISE.**
   * The fourteen are gated because they NAME VERBS, which is now the whole
   * mechanism and would work equally well in either file.
   *
   * 🛑 **SO THE SPLIT IS NO LONGER NECESSARY AND IS NOT REVERSED HERE.**
   * Un-splitting `platform-console.openapi.yaml` is a separate ruling nobody
   * has taken; it re-opens which process serves each half (G578 item (c)),
   * and a concurrent agent is adding an operation to that document. **This
   * slice makes the split unnecessary; it does not undo it.**
   */
  assert.equal(EXEMPT_WITH_A_PERSON_TO_ASK['platformConsole'], 0)
  for (const o of consoleOps) {
    assert.equal(
      classifyAnnotation(o.annotation).kind,
      'capability',
      `${o.operationId} states an exemption where this file expects a capability. ⚠️ SINCE ` +
        'G911 check D reports that as a CENSUS MOVEMENT (platformConsole 0 → 1) rather than as ' +
        'a category refusal, and `mountTier()`\'s fourth fence turns SERVING it into a boot ' +
        'failure. §1c drives exactly this mutation through the real checker.',
    )
  }

  /* The three classes the fourteen act on are reachable by a platform role
   * assignment since G601, and carry capabilities. Both halves are needed: a
   * reachable class with no verb is what G533 measured, and a verb in an
   * unreachable class is what `platform-console-reachability.test.mjs` §1
   * refuses. ⚠️ `commercial` JOINS `substrate` AND `catalogue` HERE — it was
   * always reachable (G289) and this file's table never named it, which is how
   * the five billing reads looked unannotatable for a day longer than they
   * were. */
  for (const cls of ['substrate', 'catalogue', 'commercial']) {
    assert.equal(
      access.PLATFORM_ASSIGNMENT_REACHES[cls],
      true,
      `\`${cls}\` is not reachable by a platform assignment, so a capability of that class ` +
        'would be a gate its own principal cannot open — G289.',
    )
    const verbs = Object.values(access.CAPABILITIES).filter(
      (c) => access.CAPABILITY_RESOURCE_CLASS[c] === cls,
    )
    assert.ok(verbs.length > 0, `\`${cls}\` is reachable and has no verb, which is G533's finding`)
  }
})

test('2a · and the twelve that stayed each act on a class the platform arm refuses, or on one with no write verb', () => {
  const authority = authorityByOperation()
  const stayed = [...authority].filter(([, a]) => a === 'platform-role').map(([id]) => id)

  /**
   * 🛑 THE ONE THAT IS NOT LIKE THE OTHERS, AND IT IS THE REASON THIS TEST
   * EXISTS RATHER THAN A COMMENT. Eleven of the twelve act on a class
   * `PLATFORM_ASSIGNMENT_REACHES` refuses, so a derived rule catches them.
   * `raiseAdjustment` acts on `commercial`, which it OPENS — so no rule keyed
   * on the class can explain why it stayed. It stayed on MODE, and nothing in
   * `model/` records a capability's mode. That is asserted as its own fact so
   * the next reader does not "fix" an apparent inconsistency by moving it.
   */
  assert.ok(stayed.includes('raiseAdjustment'), 'raiseAdjustment must still be declared on this tier')
  assert.equal(
    access.PLATFORM_ASSIGNMENT_REACHES.commercial,
    true,
    'if this were false, raiseAdjustment would be explained by its class like the other eleven ' +
      'and this assertion would be redundant rather than load-bearing.',
  )
  const commercialVerbs = Object.values(access.CAPABILITIES).filter(
    (c) => access.CAPABILITY_RESOURCE_CLASS[c] === 'commercial',
  )
  assert.deepEqual(
    commercialVerbs.sort(),
    ['view_commercial'],
    'THE ENTIRE REASON `raiseAdjustment` IS NOT ON THE CONSOLE TIER: `commercial` has exactly ' +
      'one verb and it is a READ. `model/access.ts` records that "the absence of a write verb ' +
      'on commercial is scope rather than principle". Minting `write_commercial` is an owner\'s ' +
      `ruling; until it is taken, annotating a POST with a read verb is §5.6.\n\nFound: ${
        commercialVerbs.join(', ')
      }`,
  )

  assert.equal(
    access.PLATFORM_ASSIGNMENT_REACHES.identity,
    false,
    'the two sign-in-domain operations stayed because `identity` is REFUSED rather than ' +
      'unbuilt — G289: "a principal who may rewrite identity connections may rewrite the axis ' +
      'this very arm dispatches on." If this ever becomes `true`, that argument was overturned ' +
      'and the two operations move with the ruling that overturned it.',
  )
})

/* ==================================================================== *
 * 3 · THE TWO THAT ARE BLOCKED ON `decide()` RATHER THAN ON EFFORT.
 * ==================================================================== */

test('3 · `tenant-access-grant` — 9 operations, on a class the platform arm refuses', () => {
  const authority = authorityByOperation()
  assert.equal([...authority].filter(([, a]) => a === 'tenant-access-grant').length, 9)

  /**
   * These are the FDE's acts inside one customer tenant: the extraction floor,
   * the tag policy, the onboarding sequence, the tenant record. The verbs that
   * name them exist and are classed `configuration`, and the platform arm
   * refuses that class ON PURPOSE — *"The grant already reaches this; the
   * assignment does not need to."* So annotating one gates the GRANT path on
   * the ASSIGNMENT path's evaluator, and refuses the only principal it is for.
   */
  assert.equal(access.CAPABILITY_RESOURCE_CLASS[access.CAPABILITIES.configureTolerance], 'configuration')
  assert.equal(access.CAPABILITY_RESOURCE_CLASS[access.CAPABILITIES.configureTagPolicy], 'configuration')
  assert.equal(
    access.PLATFORM_ASSIGNMENT_REACHES.configuration,
    false,
    'if this is ever `true`, re-read this test: the 9 become annotatable and the reason ' +
      'recorded here is gone.',
  )
})

test('3a · `partner-arrangement` — 15 operations, and the partner arm needs a grant they hold none of', () => {
  const authority = authorityByOperation()
  assert.equal([...authority].filter(([, a]) => a === 'partner-arrangement').length, 15)

  /* Measured against the real evaluator rather than asserted: a partner with no
   * `PartnerAccessGrant` — which is what a partner reading its OWN arrangement
   * is — is refused before any capability is considered. */
  const decision = access.decide(
    {
      subject: { userId: 'usr_northwind_pat', status: 'active' },
      tenantId: 'ten_acme',
      orgClass: access.ORG_CLASSES.partner,
      partnerId: 'prt_northwind',
      partnerGrant: null,
      held: [],
      platformHeld: null,
      now: '2026-09-19T12:00:00.000Z',
    },
    access.CAPABILITIES.viewCommercial,
  )
  assert.equal(decision.allowed, false)
  assert.equal(decision.reason, 'partner_grant_absent')
})

/* ==================================================================== *
 * 4 · THE ONE THAT DOES NOT EXIST AT ALL. A TRIPWIRE.
 * ==================================================================== */

/**
 * ✅ R10, 1 Oct 2026 — THE TRIPWIRE BELOW WAS ARMED FOR THIS COMMIT, AND THE
 * COMMIT THAT BUILDS THE PRINCIPAL REWRITES IT RATHER THAN SILENCING IT, AS
 * ITS OWN TEXT DEMANDED. ⚠️ IT DID NOT FIRE: it keyed on the export name
 * `/PartnerPortal/` and R10's exports are `PARTNER_ONLY_RESOURCE_CLASSES` and
 * `capabilityIsPartnerOnly` — **§5.1 in a tripwire, a landmark (a NAME) where
 * the property was *does `decide()` answer a partner-portal verb*.** It is
 * replaced by the property: the fifth arm exists, it PERMITS a live portal
 * role, and it is still not a fifth organisation. The old assertions are kept
 * below the new ones, inverted where they went false.
 */
test('4 · `partner-portal-role` — 9 operations, and the principal EXISTS since R10 (the fifth arm)', () => {
  const authority = authorityByOperation()
  assert.equal([...authority].filter(([, a]) => a === 'partner-portal-role').length, 9)

  assert.deepEqual(
    [...access.PARTNER_ONLY_RESOURCE_CLASSES].sort(),
    ['deal', 'partner_staff', 'sandbox'],
    'R10 named three classes for the partner firm`s own surface',
  )
  const role = {
    id: 'prl_nw_admin', partnerId: 'prt_northwind', label: 'Partner administrator',
    key: 'partner_admin', version: 1, capabilities: ['register_deal'], status: 'active',
  }
  const decision = access.decide(
    {
      subject: { userId: 'usr_northwind_pat', status: 'active' },
      tenantId: null,
      orgClass: access.ORG_CLASSES.partner,
      partnerId: 'prt_northwind',
      partnerGrant: null,
      held: null,
      platformHeld: null,
      partnerHeld: [{
        role,
        assignment: {
          id: 'pra_pat', partnerId: 'prt_northwind', userId: 'usr_northwind_pat',
          roleId: 'prl_nw_admin', roleVersion: 1, grantedBy: 'usr_northwind_owner',
          grantedAt: '2026-09-01T00:00:00.000Z', expiresAt: '2026-12-01T00:00:00.000Z',
          revokedAt: null,
        },
      }],
      now: '2026-10-01T12:00:00.000Z',
    },
    access.CAPABILITIES.registerDeal,
  )
  assert.equal(decision.allowed, true, `the fifth arm refused a live portal role: ${decision.reason}`)

  /**
   * 🛑 THIS ASSERTION IS A TRIPWIRE AND IS MEANT TO GO RED. The day somebody
   * declares a partner portal principal, one of the four blockers named in
   * this file's header is gone and the summary above is stale — so the commit
   * that builds it has to come here and rewrite the table rather than leave a
   * file that reads as current.
   *
   * ⚠️ AND `decide()` HAS FOUR ARMS, NOT FIVE. The other half of the same
   * fact, asserted separately so a rename cannot satisfy both.
   */
  /* ⛔ RETIRED BY R10 — kept as the history it is, inverted where it went false.
   *    The original asserted `Object.keys(access).filter(k => /PartnerPortal/i.test(k))`
   *    was `[]`; that assertion would STILL pass today, which is exactly why it
   *    could not be the control. The assertion above replaces it. */

  assert.deepEqual(
    Object.values(access.ORG_CLASSES).sort(),
    ['customer', 'partner', 'platform'],
    'a fifth organisation class would be the other way a portal principal could arrive.',
  )
})
