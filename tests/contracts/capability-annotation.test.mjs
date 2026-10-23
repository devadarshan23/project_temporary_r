/**
 * THE GATE, WITNESSED BEFORE IT EXISTS — assertions 1, 2, 3 and 5 of the
 * authorisation pass, against the five OpenAPI documents.
 *
 * 🛑 THIS FILE IS EXPECTED TO FAIL. It is committed RED, on its own, before any
 * annotation is written, because a gate designed after the fact is a gate whose
 * completeness nobody can measure. What it measures is the distance between
 * "76 operations declared" and "76 operations gated".
 *
 * ✅ AND BOTH OF THOSE PARAGRAPHS ARE NOW HISTORY, KEPT RATHER THAN DELETED
 * BECAUSE THEY ARE WHAT THIS FILE WAS FOR. The annotations landed and this file
 * went green; the GATE landed on 19 Sep 2026 and the distance it was written to
 * measure is closed for the MOUNTED set. Three things moved under this file on
 * that day and none of them changes an assertion below:
 *
 *   · THE GRAMMAR MOVED TO `server/contract/capability.ts`, in TypeScript,
 *     because `server/` is now one of its readers. `TIER_REQUIRES_CAPABILITY` is
 *     a total `Record<TierName, boolean>` there, so the second guard below is
 *     now the WEAKER of two controls on the same property — a compile error at
 *     the literal is the other — and is kept as the reader's guard rather than
 *     the author's.
 *   · THE MODULE MOVED TO `tools/check-capability-annotations.mjs` AND IS IN
 *     `npm run check`. Its old header said it was "deliberately not in `tools/`"
 *     because "`tools/` takes a checker when the gate it checks exists, and
 *     today the gate does not." Today it does.
 *   · ASSERTION 1e IS NOW ALSO A BOOT FENCE. `mountTier()` refuses to start a
 *     plane over a capability-tier operation carrying an exemption, so the
 *     loophole this file found by mutation now costs a process rather than a
 *     test. The assertion stays: it covers the 72 operations no plane mounts.
 *
 * ⛔ **AND ON 20 Sep 2026 ASSERTION 1e WAS RETIRED AND THE THIRD BULLET ABOVE
 * WENT HALF FALSE — G911/G913, and both halves are corrected here rather than
 * deleted because the bullet is what a reader would quote.** The BOOT FENCE
 * half is true and is now WIDER: `mountTier()`'s fourth fence no longer keys
 * on the tier at all, so it refuses a person-facing exemption being SERVED on
 * any of the seven rather than on the two that never had one. The ASSERTION
 * half is false: `GATED` is derived from the annotation now, so 1e became a
 * tautology and is retired at its own site with the argument and with a
 * pointer to where its property lives — the two zeros in
 * `EXEMPT_WITH_A_PERSON_TO_ASK`, asserted by the census guard below.
 *
 * ┌─ THE COUNT, DERIVED, AND IT IS 76 — IT WAS 72 UNTIL THE SESSION TIER ──────┐
 * │ `grep -h 'operationId:' docs/contracts/*.openapi.yaml | wc -l` → 76. Per    │
 * │ file: 38 capability · 14 control-plane · 3 data-plane-local ·               │
 * │ 17 foundation · 4 session.                                                  │
 * │                                                                            │
 * │ ⚠️ EVERY DOCUMENT IN THE RECORD SAYS 70 AND ALL OF THEM ARE ONE MERGE       │
 * │ STALE. `375bb39d` added `getRunAccount` and `listRunResidue` and its own    │
 * │ commit message says "UNGATED like all 70" — the message counted the tree it │
 * │ was replacing. THE DENOMINATOR IS NOT DECORATION: assertion 1 is a          │
 * │ totality claim, and a totality claim against a hand-copied denominator is   │
 * │ the §5.6 shape. Nothing below states a total; every count is derived from   │
 * │ the documents at run time, which is why the two new operations are already  │
 * │ in this file's arithmetic without anyone having added them.                 │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ WHAT THIS FILE DELIBERATELY DOES NOT DO. It mounts nothing, it annotates
 * nothing, and it does not decide which capability any operation takes. Served
 * stays at 4 (`listRuns`, `getRun`, `checkLocalHealth`, `listEntitledPacks`).
 * Group E is the one place a proposed mapping appears, and it appears there
 * precisely so that landing a DIFFERENT one is a deliberate edit to a named list
 * rather than a silent consequence.
 *
 * ⚠️ THIS FILE IS `.mjs` AND THAT IS ON PURPOSE. Its sibling
 * `tests/model/role-capability-floor.test.mjs` asserts on exports that do not
 * exist yet; under `npm run typecheck:tests` a `.ts` file naming a missing
 * export is TS2339 — a compile failure, which is the WEAKEST possible red and
 * would take the whole suite down rather than reporting one assertion. Both
 * files are `.mjs` so every red below is behavioural and countable.
 *
 * ⚠️ IT PARSES WITH `yaml@2.9.0` VIA `server/contract/document.ts`, the repo's
 * own single loader — G109's "do not hand-roll one", and the same code path the
 * router reads, so this suite cannot disagree with the server about what an
 * operation is.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  CAPABILITIES,
  CAPABILITY_RESOURCE_CLASS,
  PARTNER_CAPABILITY_MASK,
  PARTNER_MASK_MEMBERSHIP,
} from '../../model/access.ts'
import { ACCESS_RESOURCE_CLASSES } from '../../model/governance.ts'

import {
  ANNOTATION_KEY,
  PARTNER_EXPOSURE_KEY,
  EXEMPT_PREFIX,
  ACCEPTED_PREFIX,
  MIN_REASON_CHARS,
  EXEMPT_WITH_A_PERSON_TO_ASK,
  OPERATION_TIERS,
  callerMayBeAPerson,
  gateVerdictOf,
  tiersWithoutAnExemptionCensus,
  declaredOperations,
  classifyAnnotation,
  classifyPartnerExposure,
  name,
} from '../../tools/check-capability-annotations.mjs'

const OPS = declaredOperations()
/**
 * WHICH OPERATIONS ARE GATED — ASKED OF EACH OPERATION, G911, 20 Sep 2026.
 *
 * ⚠️ **BOTH OF THESE READ THE TIER UNTIL 20 Sep 2026 — `GATED` was
 * `OPS.filter((o) => TIER_REQUIRES_CAPABILITY[o.tier])` and `EXEMPTED` its
 * negation — AND G911 RETIRES THAT TABLE.** The partition is now derived from
 * each operation's OWN annotation, which is the ruling: *"an operation's gate
 * verdict comes from the operation, not from which file it sits in."*
 *
 * 🛑 **ON THIS TREE THE TWO PARTITIONS ARE IDENTICAL, AND THAT IS WORTH
 * SAYING RATHER THAN LEAVING TO BE ASSUMED** — measured: 53 gated across
 * `capability` (39) and `platformConsole` (14), 83 exempt across the other
 * five, with no operation on either side of the old line disagreeing with its
 * file. **So every assertion below is about exactly the same set of
 * operations as before this change**, which is what makes their continued
 * green meaningful rather than vacuous.
 */
const GATED = OPS.filter((o) => gateVerdictOf(classifyAnnotation(o.annotation)) === 'gated')
const EXEMPTED = OPS.filter((o) => gateVerdictOf(classifyAnnotation(o.annotation)) !== 'gated')

const CAPABILITY_VALUES = new Set(Object.values(CAPABILITIES))
const RESOURCE_CLASS_VALUES = new Set(Object.values(ACCESS_RESOURCE_CLASSES))
const MASK_UNION = new Set(Object.values(PARTNER_CAPABILITY_MASK).flat())

/* ==================================================================== *
 * 0 · THE §5.6 GUARDS — these PASS at base, and they are the reason the
 *     reds below are evidence rather than noise.
 *
 * Every assertion in this file reads `OPS`, `CAPABILITY_VALUES` or
 * `MASK_UNION`. If the loader silently produced nothing, assertions 1,
 * 2, 3 and 5 would all pass vacuously — a control that passes while
 * asserting nothing, which is exactly the failure this pass was told
 * had shipped twice in one day. These four make that impossible.
 * ==================================================================== */

test('guard · every registered contract loads and declares the operations this file counts', () => {
  assert.ok(
    OPS.length >= 70,
    `Loaded ${OPS.length} operation(s) across the registered tiers. Every assertion below ` +
      'walks that array; a bad parse would pass all of them. Derive the truth with ' +
      "`grep -h 'operationId:' docs/contracts/*.openapi.yaml | wc -l`.",
  )
  const byTier = {}
  for (const o of OPS) byTier[o.tier] = (byTier[o.tier] ?? 0) + 1
  /**
   * 🛑 DERIVED FROM `OPERATION_TIERS` RATHER THAN WRITTEN OUT, AND THE CHANGE
   * IS G533's, 19 Sep 2026. This assertion held a LITERAL LIST of five tier
   * names until the sixth was registered, and it went red for the one reason
   * a tier arriving is not: the list was hand-maintained. That is §5.1 in the
   * guard that exists to catch §5.1 one level up — *"a gate whose completeness
   * depends on somebody remembering to add a row"*, in the very comment below
   * that says a sixth tier should fail HERE.
   *
   * It should fail here only when a registered tier contributes NOTHING, which
   * is the vacuity this guard is about. Deriving the expected set from the
   * same object `OPERATION_TIERS` derives from makes the two impossible to
   * disagree — and a seventh tier that loads correctly now passes, while one
   * that silently parses to nothing still fails.
   */
  assert.deepEqual(
    Object.keys(byTier).sort(),
    [...OPERATION_TIERS].sort(),
    'A registered tier contributed no operation at all, so its assertions below are vacuous. ' +
      `Registered: [${[...OPERATION_TIERS].sort().join(', ')}]; contributing: ` +
      `[${Object.keys(byTier).sort().join(', ')}].`,
  )
  /**
   * ⚠️ AND THE FLOOR ABOVE IS NOT ENOUGH ON ITS OWN. 70 was close to the whole
   * corpus when it was written and is now half of it. A reader that lost one
   * large file entirely would still clear 70 comfortably, so the tier this
   * file's newest assertions are about would go unread with every one of them
   * green.
   *
   * 🛑 THIS WAS A NAMED-TIER FLOOR — `byTier['administration'] >= 50` — UNTIL
   * THE SPLIT OF 19 Sep 2026, AND IT IS REPLACED RATHER THAN RETUNED, because
   * retuning it would have been the third instance of the defect the comment
   * twenty lines above already names about this very guard. That floor was a
   * hand-maintained row: it went red when `administration` dropped to 45, and
   * the obvious repair — lower it to 40 and add a second row for
   * `platformConsole` — makes the guard's completeness depend once more on
   * somebody remembering to add a row for the eighth tier. **§5.1, twice
   * caught in one file, and the second time by a split rather than by a
   * reader.**
   *
   * WHAT REPLACES IT IS THE SAME CLAIM KEYED ON THE PROPERTY. A corpus-wide
   * minimum catches the loss of any LARGE tier — dropping `administration`
   * leaves 91 and dropping `capability` leaves 97, both under this floor —
   * while the `deepEqual` above already catches any registered tier
   * contributing NOTHING, however small it is. Between them, no tier can go
   * unread. The figure is a MINIMUM and never the exact count; the exact count
   * is `grep -c 'operationId:' docs/contracts/*.openapi.yaml`, and it has moved
   * from 70 to 72 to 76 to 136.
   */
  assert.ok(
    OPS.length >= 120,
    `Loaded ${OPS.length} operation(s) across ${OPERATION_TIERS.length} registered tiers. The ` +
      'corpus-wide floor exists so that losing one LARGE tier is a red rather than a quieter ' +
      'green — every assertion below about that tier would otherwise be vacuous while this file ' +
      "still reported a healthy total. Derive it: `grep -c 'operationId:' " +
      'docs/contracts/*.openapi.yaml`.',
  )
})

/**
 * 🛑 ADDED WITH THE FIFTH TIER, BECAUSE THE FIFTH TIER IS WHAT FOUND THE HOLE.
 *
 * `OPERATION_TIERS` derives from `TIERS` and picked `session` up with no edit,
 * exactly as its comment promised. `TIER_REQUIRES_CAPABILITY` does NOT derive
 * from anything — and `TIER_REQUIRES_CAPABILITY['session']` was `undefined`,
 * which is falsy, so every operation on a tier nobody had classified would have
 * landed in `EXEMPTED` and been excused BY AN OVERSIGHT RATHER THAN BY A
 * DECISION. Assertions 1a, 1e and 3d would each have gone quiet on it.
 *
 * That is this file's own §5.1 shape — a gate whose completeness depends on
 * somebody remembering to add a row — sitting one level above the YAML where
 * the grammar note already refuses it. A sixth tier now fails here instead.
 */
test('guard · every tier that declares operations is counted by the exemption census', () => {
  /**
   * ⚠️ **THE SUBJECT OF THIS GUARD MOVED WITH G913 AND THE SHAPE DID NOT.**
   * It asserted `tiersWithoutACapabilityVerdict()` — a missing VERDICT read
   * as `undefined`, falsy, and silently exempted a whole tier. There is no
   * verdict now; there is a CENSUS, and a missing entry there reads as
   * `undefined` too, so check D's comparison would go quiet on that tier
   * rather than fail. **The same shape, one artefact over**, which is why the
   * guard is carried across rather than retired with the table.
   */
  assert.deepEqual(
    tiersWithoutAnExemptionCensus(),
    [],
    'A tier in `TIERS` has no entry in `EXEMPT_WITH_A_PERSON_TO_ASK`. Count its operations ' +
      'that state an exemption while declaring a caller who may be a person, and write the ' +
      'number, with the reason, in `server/contract/capability.ts`.',
  )
})

/**
 * 🛑 THE CENSUS ITSELF, ASSERTED HERE AS WELL AS IN THE CHECKER — AND IT IS
 * NOT §5.3, BECAUSE NEITHER HOLDS ITS OWN COPY OF THE NUMBERS. Both read
 * `EXEMPT_WITH_A_PERSON_TO_ASK` and both derive the actual population from the
 * same `declaredOperations()` walk. What the second reader buys is that the
 * checker names the COUNTS and this names the OPERATIONS, so the two failures
 * a person meets are different sentences about one fact.
 *
 * ⚠️ **THE TWO ZEROS ARE CHECK D's OLD CONTENT AND ARE WHY THIS IS NOT
 * MERELY A TRIPWIRE**: `capability` and `platformConsole` are the two tiers
 * `TIER_REQUIRES_CAPABILITY` made `true`, and a non-zero on either is exactly
 * the *"gate that can be opened by writing prose"* the fourth fence was built
 * against — now caught on every tier instead of two.
 */
test('guard · the person-facing exemption population is exactly what is recorded', () => {
  const actual = {}
  for (const t of OPERATION_TIERS) actual[t] = 0
  for (const o of OPS) {
    if (classifyAnnotation(o.annotation).kind === 'exempt' && callerMayBeAPerson(o.caller)) actual[o.tier] += 1
  }
  const recorded = Object.fromEntries(OPERATION_TIERS.map((t) => [t, EXEMPT_WITH_A_PERSON_TO_ASK[t]]))
  assert.deepEqual(
    actual,
    recorded,
    'The set of operations that state an EXEMPTION while declaring a caller who may be a PERSON ' +
      'has changed. Every one of them is served past the `preValidation` gate and mints no ' +
      'invariant 10 record if it is ever mounted. Sweep `EXEMPT_WITH_A_PERSON_TO_ASK` in the ' +
      'commit that moved it (§5.11) and say which operation moved and why.\n\n' +
      name(
        OPS.filter((o) => classifyAnnotation(o.annotation).kind === 'exempt' && callerMayBeAPerson(o.caller)).map(
          (o) => `${o.tier}:${o.operationId}`,
        ),
      ),
  )
})

test('guard · every declared operation carries an operationId to be named by', () => {
  const anonymous = OPS.filter((o) => o.operationId.includes(' '))
  assert.equal(
    anonymous.length,
    0,
    `${anonymous.length} operation(s) have no operationId, so every failure message below ` +
      `would name them by route instead: ${name(anonymous.map((o) => `${o.file} ${o.operationId}`))}`,
  )
})

/**
 * 🛑 THIS GUARD ASSERTED A LITERAL — FIRST 37, THEN 38, THEN 39 — AND IT WAS
 * REWRITTEN ON 16 Aug 2026 BY G209 BECAUSE THE LITERAL WAS THE DEFECT, NOT THE
 * SWEEPING.
 *
 * ITS HISTORY, KEPT, BECAUSE IT IS THE EVIDENCE FOR THE REWRITE. It read
 * `assert.equal(CAPABILITY_VALUES.size, 37)`; `admit_source` (G173, this branch)
 * made it 38 and it fired; the merge of `origin/main` brought `view_endpoint`
 * (#194) and made it 39 and it fired again — TWICE IN ONE DAY, on a number
 * nobody was trying to change. Both branches had minted "capability 38" against
 * a shared 37, each internally consistent.
 *
 * ⚠️ AND NOTE WHAT THE OLD FORM COULD NOT CATCH, WHICH IS THE HALF THAT
 * MATTERED: the two thirty-eights were different SETS. A guard on a size is
 * blind to that. What caught the collision was the three total `Record`s over
 * `Capability` in `model/access.ts` — `CAPABILITY_STAKEHOLDER_CLASSES`,
 * `SEEDED_CAPABILITY_HOLDERS`, `PARTNER_MASK_MEMBERSHIP` — each a `TS1360` at
 * its own literal, naming the missing member. **NOTICING A NEW CAPABILITY IS
 * THOSE RECORDS' JOB, AT COMPILE TIME, AND THEY ALREADY DO IT.** This guard's
 * job is narrower and is the one they cannot do: making sure the vocabulary this
 * FILE checks annotations against is the same vocabulary the MODEL declares.
 *
 * So the size is now DERIVED on both sides and compared, never stated. A
 * fortieth capability is absorbed here without an edit — and is still a compile
 * error where a compile error belongs. The record's rule is that every count
 * ships with the command that reproduces it; a literal in a test is that same
 * defect in another register.
 */
test('guard · the vocabulary this file checks against is the one the model declares', () => {
  assert.ok(
    CAPABILITY_VALUES.size > 0,
    'CAPABILITIES resolved to an empty set, so assertion 2 below would pass vacuously — the ' +
      'exact §5.6 shape these guards exist to make impossible.',
  )
  assert.equal(
    CAPABILITY_VALUES.size,
    Object.keys(CAPABILITIES).length,
    'CAPABILITIES holds a duplicate VALUE under two keys. A `Set` of its values would then be ' +
      'smaller than the roster, and every count derived from it here would understate the ' +
      'vocabulary the annotations are checked against. Derive the roster: awk ' +
      "'/^export const CAPABILITIES = \\{/,/^\\}/' model/access.ts | grep -cE '^  [a-zA-Z]+:'",
  )
  assert.ok(
    CAPABILITY_VALUES.has('admit_source'),
    'G173 is applied by the presence of this member and by nothing else. If it is gone, the ' +
      'annotations on createUpload, completeUpload, listIntakeChannels, getRunAccount and ' +
      'listRunResidue name a capability that does not exist, and assertion 2 is the one that ' +
      'will say so.',
  )
  assert.equal(
    Object.keys(CAPABILITY_RESOURCE_CLASS).length,
    CAPABILITY_VALUES.size,
    'CAPABILITY_RESOURCE_CLASS is a total Record<Capability, …>; if these two disagree at ' +
      'run time the totality the type claims is not the totality the object has.',
  )

  // THE COMPARISON AGAINST THE ANNOTATIONS, which is the half a size literal
  // never made. Every capability the contracts name must be one the model
  // declares, and the contracts must name at least one — otherwise assertion 2
  // is checking an empty set against a roster of any size at all and passing.
  const named = new Set(
    OPS.map((o) => classifyAnnotation(o.annotation))
      .filter((a) => a.kind === 'capability')
      .map((a) => a.capability),
  )
  assert.ok(
    named.size > 0,
    'No operation in any of the four contracts names a capability, so assertion 2 has ' +
      'nothing to resolve and passes on an empty input.',
  )
  assert.deepEqual(
    [...named].filter((c) => !CAPABILITY_VALUES.has(c)).sort(),
    [],
    `The contracts name ${named.size} distinct capability(ies) and at least one is outside ` +
      `the ${CAPABILITY_VALUES.size}-member roster the model declares. Both numbers are ` +
      'derived here at run time and neither is written down, so a fortieth capability is ' +
      'absorbed by this guard rather than breaking it — noticing that a NEW capability ' +
      'exists is the job of the three total `Record`s over `Capability` in model/access.ts, ' +
      'which say so at compile time.',
  )
})

/**
 * ⚠️ SIX UNTIL G209 ON 16 Aug 2026, AND THE SEVENTH IS A DELIBERATE WIDENING
 * RATHER THAN DRIFT. `view_endpoint` was `[]` in `PARTNER_MASK_MEMBERSHIP` under
 * a 🛑 PROVISIONAL banner; the owner ruled it into BOTH operating scopes. The
 * list stays ENUMERATED BY NAME rather than becoming a size — G173's discipline,
 * and the reason this guard has anything to say: a length would have gone from 6
 * to 7 for a partner reading counterparty documents just as readily as for one
 * reading endpoints.
 *
 * ⚠️ IT CHANGES NOTHING IN GROUP E TODAY and that is worth saying, because the
 * two are easy to conflate: no operation in any of the four contracts is
 * annotated `view_endpoint`, so the partner-reachable OPERATION set below is
 * unmoved. The widening is on the capability axis, and the first
 * endpoint-reading operation to be annotated will land in group E's enumeration
 * as a deliberate edit — which is exactly what group E is for.
 */
test('guard · the partner mask holds the seven capabilities group E reasons about', () => {
  assert.deepEqual(
    [...MASK_UNION].sort(),
    [
      'advance_procedure',
      'assign_exception',
      'propose_resolution',
      'view_dashboard',
      'view_document',
      'view_endpoint',
      'view_exception',
    ],
    'PARTNER_CAPABILITY_MASK changed. Group E enumerates an intended partner-reachable ' +
      'operation set against exactly these names; if the mask moved, that enumeration ' +
      'is answering a question nobody asked any more. A capability entering this list is a ' +
      'widening of invariant 2\'s single cross-tenant read path and takes a G row.',
  )
})

/* ==================================================================== *
 * A · ASSERTION 1 — EVERY DECLARED OPERATION CARRIES AN ANNOTATION.
 *
 * Two halves, failing separately, because they are two different
 * mistakes: a capability-tier operation with no capability is an
 * UNGATED operation, and a foundation operation with no stated
 * exemption is an operation nobody has decided about.
 * ==================================================================== */

test('assertion 1a · every capability-tier operation carries x-capability', () => {
  const missing = GATED.filter((o) => classifyAnnotation(o.annotation).kind === 'absent')
  assert.deepEqual(
    missing.map((o) => o.operationId).sort(),
    [],
    `${missing.length} of ${GATED.length} capability-tier operations carry no \`${ANNOTATION_KEY}\`. ` +
      'The capability tier is the only tier a customer\'s browser meets and every operation on ' +
      'it has a human principal, so every operation on it is gated or is ungated on purpose — ' +
      `and there is no third state. Add \`${ANNOTATION_KEY}: <capability>\` to each, in ` +
      `docs/contracts/capability.openapi.yaml.\n\nUngated: ${name(missing.map((o) => o.operationId))}`,
  )
})

test('assertion 1b · every non-capability-tier operation states its exemption', () => {
  const unstated = EXEMPTED.filter((o) => classifyAnnotation(o.annotation).kind === 'absent')
  assert.deepEqual(
    unstated.map((o) => `${o.tier}:${o.operationId}`).sort(),
    [],
    `${unstated.length} of ${EXEMPTED.length} operations on the foundation, control-plane and ` +
      `data-plane-local tiers carry no \`${ANNOTATION_KEY}\`. These tiers take no capability — ` +
      'no foundation operation has a human principal, the control plane\'s caller is a SigV4 ' +
      'machine with no PrincipalContext to build, and data-plane-local declares no security ' +
      'scheme at all because its callers are inside the customer\'s own VPC. BUT AN EXEMPTION ' +
      'WITH NO REASON BESIDE IT IS INDISTINGUISHABLE FROM AN OVERSIGHT. Write ' +
      `\`${ANNOTATION_KEY}: '${EXEMPT_PREFIX} <why this operation has no human principal>'\` on ` +
      `each.\n\nUnstated: ${name(unstated.map((o) => `${o.tier}:${o.operationId}`))}`,
  )
})

/**
 * 🛑 ADDED 16 Aug 2026 BECAUSE A NEGATIVE CONTROL FOUND THE HOLE, AND IT IS THE
 * HOLE THE RULING NAMES: A GATE THAT CAN BE OPENED BY WRITING PROSE.
 *
 * Assertion 1a fails only on `kind === 'absent'`. So a capability-tier operation
 * carrying `x-capability: 'exempt: <twenty characters of plausible reasoning>'`
 * passed 1a, 1b, 1c, 1d, 2, 3a, 3b, 3c and 3d — every one of them — while being
 * exactly as ungated as an operation with no key at all. THE GRAMMAR ADMITS
 * `exempt:` ANYWHERE BY DESIGN, so the tier is the only thing that can refuse
 * it, and nothing was asking the tier.
 *
 * The control that found it: mutate `classifyAnnotation` so an ABSENT annotation
 * classifies as `exempt` — the gate always permits — and see what goes red.
 * Nothing did, because every operation is annotated and the mutation was
 * therefore inert. Reddening it required deleting an annotation as well, at
 * which point the loophole was visible: the deleted operation was simply
 * exempt now, silently.
 *
 * `TIER_REQUIRES_CAPABILITY.capability` is `true` and this is the assertion that
 * gives that `true` teeth on the OTHER kind of annotation.
 *
 * ⛔ **SUPERSEDED 20 Sep 2026 — G911/G913 — AND RETIRED RATHER THAN REWRITTEN,
 * BECAUSE THE ONLY REWRITE AVAILABLE WAS A TAUTOLOGY.** `GATED` is now derived
 * from each operation's own annotation, so *"no GATED operation carries an
 * exemption"* is true BY CONSTRUCTION: the filter that builds the set and the
 * filter that tests it are the same predicate, negated. **A test that cannot
 * fail is worse than no test**, and this file already records that lesson one
 * assertion over — §3d of `tests/http/administration-tier-unmounted.test.ts`
 * was *"one half … ending in `assert.ok(true)`"* and was rebuilt as a
 * differential for the same reason.
 *
 * 🛑 **WHERE ITS CONTENT WENT, BECAUSE IT IS NOT LOST:** the property was
 * *"no operation on a tier whose callers are people may buy its way out with
 * prose"*, and it is now the TWO ZEROS in `EXEMPT_WITH_A_PERSON_TO_ASK` —
 * `capability: 0` and `platformConsole: 0` — asserted by the census guard
 * above, by `check:annotations`'s check D, and, at the mount, by
 * `mountTier()`'s fourth fence. **All three now cover every tier rather than
 * two**, which is the one thing this slice makes strictly stronger: the 64
 * person-facing exemptions this assertion could not see are counted, and the
 * 45 on the administration tier can no longer be SERVED unmarked.
 *
 * ⚠️ **AND ITS NEGATIVE CONTROL IS NOT LOST EITHER** — the
 * `x-capability: 'exempt: <twenty characters of plausible reasoning>'`
 * mutation that earned this assertion is re-run, per operation and against
 * the real checker, in
 * `tests/contracts/per-operation-gate-verdict.test.mjs` §1.
 */

test('assertion 1c · no exemption reason is a placeholder', () => {
  const thin = OPS.map((o) => ({ o, a: classifyAnnotation(o.annotation) }))
    .filter(({ a }) => a.kind === 'exempt' && a.reason.length < MIN_REASON_CHARS)
    .map(({ o, a }) => `${o.operationId} (${a.reason.length} chars: "${a.reason}")`)
  assert.deepEqual(
    thin.sort(),
    [],
    `${thin.length} exemption(s) carry a reason shorter than ${MIN_REASON_CHARS} characters. ` +
      'The floor exists to reject `n/a`, `TODO` and `see docs` — the three things a person ' +
      'writes when they have not yet made the decision the annotation is asking for.\n\n' +
      `Thin: ${thin.join(' · ')}`,
  )
})

test('assertion 1d · no annotation is malformed', () => {
  const bad = OPS.map((o) => ({ o, a: classifyAnnotation(o.annotation) }))
    .filter(({ a }) => a.kind === 'malformed')
    .map(({ o, a }) => `${o.operationId}: ${a.detail}`)
  assert.deepEqual(
    bad.sort(),
    [],
    `${bad.length} annotation(s) are neither a capability nor an exemption: ${bad.join(' · ')}`,
  )
})

/* ==================================================================== *
 * B · ASSERTION 2 — THE ANNOTATION RESOLVES TO A REAL CAPABILITY.
 *
 * A typo'd or retired name fails. This is the assertion that would
 * catch `view_summary` being annotated as `view_summaries`, or an
 * annotation left behind after a capability was renamed — neither of
 * which any type in `model/` can see, because YAML is not TypeScript.
 * ==================================================================== */

test('assertion 2 · every x-capability names a member of CAPABILITIES', () => {
  const unknown = OPS.map((o) => ({ o, a: classifyAnnotation(o.annotation) }))
    .filter(({ a }) => a.kind === 'capability' && !CAPABILITY_VALUES.has(a.capability))
    .map(({ o, a }) => `${o.file}:${o.operationId} → "${a.capability}"`)
  assert.deepEqual(
    unknown.sort(),
    [],
    `${unknown.length} annotation(s) name something that is not a member of CAPABILITIES. ` +
      `The ${CAPABILITY_VALUES.size} members are the closed set; an annotation outside it ` +
      'gates nothing, because `authorize()` would be handed a value ' +
      '`CAPABILITY_RESOURCE_CLASS` has no entry for.\n\n' +
      // ⚠️ INTERPOLATED, NOT WRITTEN. This message said "The 37 members" while the
      // guard forty lines above had already been swept to 38 — a message a reader
      // acts on WHEN THE ASSERTION FIRES, handing them the wrong vocabulary size at
      // the one moment they need the right one. `tools/check-doc-counts.mjs` reads
      // Markdown, not `.mjs`, so nothing here catches a stale count but this.
      `Unknown: ${unknown.join(' · ')}`,
  )
})

/* ==================================================================== *
 * C · ASSERTION 3 — CLASSIFIED, AND MATCHING THE PLANE.
 * ==================================================================== */

test('assertion 3a · every named capability is classified in CAPABILITY_RESOURCE_CLASS', () => {
  const unclassified = OPS.map((o) => ({ o, a: classifyAnnotation(o.annotation) }))
    .filter(({ a }) => a.kind === 'capability' && CAPABILITY_VALUES.has(a.capability))
    .filter(({ a }) => !RESOURCE_CLASS_VALUES.has(CAPABILITY_RESOURCE_CLASS[a.capability]))
    .map(({ o, a }) => `${o.operationId} → ${a.capability} → ${CAPABILITY_RESOURCE_CLASS[a.capability]}`)
  assert.deepEqual(
    unclassified.sort(),
    [],
    `${unclassified.length} annotation(s) name a capability whose resource class is not one of ` +
      'the 13 in ACCESS_RESOURCE_CLASSES. `authorize()` compares ' +
      'CAPABILITY_RESOURCE_CLASS[capability] against the resource class and refuses a mismatch ' +
      `outright, so a class outside the set can never mint a grant.\n\n${unclassified.join(' · ')}`,
  )
})

test('assertion 3b · a real capability appears only on the tier that has a principal', () => {
  const misplaced = EXEMPTED.map((o) => ({ o, a: classifyAnnotation(o.annotation) }))
    .filter(({ a }) => a.kind === 'capability')
    .map(({ o, a }) => `${o.tier}:${o.operationId} → ${a.capability}`)
  assert.deepEqual(
    misplaced.sort(),
    [],
    `${misplaced.length} operation(s) outside the capability tier name a real capability. ` +
      'That is a category error, not a stricter gate: `decide()` needs a PrincipalContext ' +
      'carrying subject, orgClass, partnerId, partnerGrant and held assignments, and refuses ' +
      'at the subject-status branch before it reaches any capability. A control-plane caller ' +
      'is a SigV4 machine and has none of those; a foundation caller is the engine itself, ' +
      'which `AUTHORIZATION_MAY_BE_ABSENT` admits as actor kind `system`; a data-plane-local ' +
      `caller is an ALB inside the customer's VPC.\n\nMisplaced: ${misplaced.join(' · ')}`,
  )
})

test('assertion 3c · statutory is reachable by no operation, at any price', () => {
  const statutory = OPS.map((o) => ({ o, a: classifyAnnotation(o.annotation) }))
    .filter(({ a }) => a.kind === 'capability' && CAPABILITY_RESOURCE_CLASS[a.capability] === 'statutory')
    .map(({ o, a }) => `${o.operationId} → ${a.capability}`)
  assert.deepEqual(
    statutory.sort(),
    [],
    'Invariant 8, quoted: "`statutory` appears in neither, at any price: a statutory ' +
      'obligation is not the customer\'s to delegate to a processor." `place_legal_hold` and ' +
      '`handle_subject_request` are the two members of that class. An operation annotated ' +
      `with either puts a statutory obligation on a wire.\n\n${statutory.join(' · ')}`,
  )
})

/* ==================================================================== *
 * D · THE 403 THAT MUST ACCOMPANY A GATE.
 *
 * 🛑 THIS ONE IS RED AT BASE FOR A REASON THAT HAS NOTHING TO DO WITH
 * ANNOTATIONS, and it is the measurable half of this file's split.
 * 13 of the 38 capability-tier operations declare no 403 today —
 * `getRun` and `listRuns`, both SERVED, among them. Adding a capability
 * to an operation that cannot answer 403 produces a gate whose only
 * refusal is a response the contract says is impossible.
 * ==================================================================== */

test('assertion 3d · every capability-tier operation can refuse', () => {
  const no403 = GATED.filter((o) => !o.responseCodes.includes('403')).map((o) => o.operationId)
  assert.deepEqual(
    no403.sort(),
    [],
    `${no403.length} of ${GATED.length} capability-tier operations declare no 403. Every ` +
      'operation on this tier is to carry a capability, and a capability that cannot be ' +
      'refused is not a gate. `server/contract/routes.ts` makes the document the validator, ' +
      'so a handler returning a code the document does not declare is a contract violation, ' +
      'not a runtime detail — WHICH MEANS THE RESPONSE MUST LAND BEFORE THE GATE DOES. Two of ' +
      'these are already served with no capability check at all, so this is a contract change ' +
      "to live behaviour.\n\nCannot refuse: " +
      `${name(no403)}\n\nAdd \`'403': { $ref: '#/components/responses/Denied' }\` to each.`,
  )
})

/* ==================================================================== *
 * E · ASSERTION 5 — THE PARTNER BLAST RADIUS, ENUMERATED.
 *
 * Invariant 2, quoted: "Exactly one cross-tenant read path —
 * `partner_admin(P)` may read tenant `T` iff `T.partnerId = P`, and only
 * within a live `PartnerAccessGrant` beyond commercial metadata."
 *
 * `decide()` gates a partner on `PARTNER_CAPABILITY_MASK` by
 * `.includes(capability)` — A NAME LIST. So every capability attached to
 * a tenant-data read either is or is not in that mask, and choosing
 * wrongly hands every partner the data. There is no scope dimension in
 * between and no per-operation override.
 * ==================================================================== */

/**
 * THE INTENDED SET, ENUMERATED — and it is a PROPOSAL carried over from the
 * survey, not an owner ruling. Equality is asserted against it so that landing a
 * different mapping is a deliberate edit to this list, which is what the pass
 * was asked for.
 *
 * ⚠️ THIS LIST HELD SEVENTEEN ENTRIES AND THREE CONTESTED MARKERS UNTIL A RED
 * TEAM READ IT ON 16 Aug 2026. Two of the three are resolved by moving the
 * ANNOTATION rather than by accepting the exposure, and the resolutions are
 * recorded here rather than swept, because the seventeen-entry version is the
 * one a reader would otherwise assume had been reasoned through.
 *
 *   listRuns · getRun — WERE CONTESTED, AND ARE NOW OUT OF THE SET ENTIRELY.
 *   The exposure was real and it was invariant 5 arriving through the mask by a
 *   second door: `Run.exceptionsRaised` is `METERS.exceptionsRaised`
 *   (`model/billing.ts:81`) and a run list is `METERS.reconciliationsRun`
 *   (`:80`), while `view_dashboard` sits in `PARTNER_CAPABILITY_MASK
 *   .exceptions_read`. §11.9a refused to fold the meter into `view_dashboard`
 *   for that exact reason — *"a partner supporting a customer's queue would read
 *   that customer's volume in the clear through the mask"* — so shipping it as
 *   an accepted string would have overridden an APPLIED argument with a line of
 *   YAML and no G row. Both now take `admit_source`, which is out of every scope
 *   and is the verb the rest of the `/runs/{runId}` family already carries.
 *
 *   listThreads · getThread · getMessage — WERE CONTESTED UNDER
 *   `view_exception`, WHICH PUT COUNTERPARTY NAMES AND SUBJECT LINES IN
 *   `exceptions_read` WHILE THE PAPER THEY CONCERN SAT IN `exceptions_operate`.
 *   They stay in this list — a partner working a break does need the
 *   conversation about it — but under `view_document`, so they are reachable
 *   only in the STRONGER scope. No capability is minted: `view_document` was
 *   already scoped *"OPERATE ONLY. A document is the counterparty's paper, not a
 *   count of it."* ⚠️ The old disclosure cited §10.6 and the citation did not
 *   support the claim: §10.6 argues a PUSHED digest channel against a pulled
 *   screen and says nothing about thread metadata. `TOOL_CAPABILITY
 *   .read_correspondence_thread` moved with them, so the agent path and the wire
 *   path do not disagree.
 *
 *   getDispositionMix — STILL CONTESTED, AND DELIBERATELY LEFT SO. Per-
 *   disposition counts and reversal rates for a period is the customer's own
 *   close quality, and under `export_data` a partner would get none of it. It is
 *   NOT the same defect as the two above: no meter and no counterparty identity
 *   is in the response, so no applied argument is being contradicted — it is a
 *   judgement about how much of a customer's close quality a partner supporting
 *   the queue may see, and that is the owner's to make. The exposure is stated
 *   on the operation.
 *
 * ⚠️ AND TWO OPERATIONS ARE DELIBERATELY ABSENT BECAUSE NO SURVEY HAS REACHED
 * THEM. `getRunAccount` and `listRunResidue` landed in `375bb39d`, after the
 * survey this list is drawn from. `listRunResidue` is the residue at LINE grain
 * — "the residue is the product", per the operation's own description. Their
 * absence here is not a ruling that a partner may not read them; it is a
 * refusal to decide by default — and `admit_source` being out of every mask
 * scope is what makes that refusal hold rather than merely being unstated.
 */
/**
 * 🛑 THIS WAS A FLAT LIST OF operationIds UNTIL 16 Aug 2026, AND THE FLAT FORM
 * WAS BLIND TO THE THING GROUP E IS ACTUALLY ABOUT.
 *
 * A list pins WHETHER a partner reaches an operation. It says nothing about
 * WHICH SCOPE reaches it — and `exceptions_read` versus `exceptions_operate` is
 * the whole of the correspondence argument above. Demonstrated: with the flat
 * form, moving `getThread` back from `view_document` to `view_exception` — which
 * puts counterparty names into the WEAKER scope, the exact defect the red team
 * raised — left every assertion in this file GREEN, because `view_exception` is
 * in `MASK_UNION` too. The value is now the scope set, so that regression is a
 * named failure rather than a silent one.
 */
const PARTNER_REACHABLE_OPERATIONS = {
  advanceProcedureStep: ['exceptions_operate'],
  assignException: ['exceptions_operate'],
  /** CONTESTED — see above, and left contested on purpose. */
  getDispositionMix: ['exceptions_operate', 'exceptions_read'],
  getDocument: ['exceptions_operate'],
  getException: ['exceptions_operate', 'exceptions_read'],
  getExceptionFacets: ['exceptions_operate', 'exceptions_read'],
  /** OPERATE ONLY, under `view_document`. The whole point of the move. */
  getMessage: ['exceptions_operate'],
  getProcedureState: ['exceptions_operate', 'exceptions_read'],
  getProposal: ['exceptions_operate', 'exceptions_read'],
  /** OPERATE ONLY, under `view_document`. */
  getThread: ['exceptions_operate'],
  listAvailableDispositions: ['exceptions_operate', 'exceptions_read'],
  /**
   * C9's parked pile (G2831–G2840, 2 Oct 2026). `view_exception`, so BOTH
   * scopes reach the line and the pane: a partner operating a tenant's
   * exceptions must see why a period cannot close. What it publishes is the
   * source's own NAME and the held record's KEYS — never a value (G106). The
   * raise is `configure_endpoint`, out of every scope.
   */
  getParkedArrival: ['exceptions_operate', 'exceptions_read'],
  listParkedArrivals: ['exceptions_operate', 'exceptions_read'],
  /**
   * C9 (G2681, 1 Oct 2026). `view_endpoint` is in BOTH operating scopes by
   * G209 ruling 2, which the owner reaffirmed against the opposite test:
   * *"The partner may read WHERE data goes; it may not change it, arm it, or
   * reach what authenticates to it."* The list publishes host, path, bucket,
   * role ARN and the minted external id, and NO credential — the four acts are
   * `configure_endpoint`, which is out of every scope.
   */
  listEndpoints: ['exceptions_operate', 'exceptions_read'],
  /**
   * C3-15 (G3941, 4 Oct 2026). `view_endpoint`, so BOTH scopes reach it by the
   * same G209 ruling. It publishes a document type's id, the pack's own LABEL
   * and its fidelity — no field, no value, no document — and a partner
   * triaging a parked delivery must see the names the customer sees.
   */
  listDocumentTypes: ['exceptions_operate', 'exceptions_read'],
  listExceptions: ['exceptions_operate', 'exceptions_read'],
  listProposals: ['exceptions_operate', 'exceptions_read'],
  /** OPERATE ONLY, under `view_document`. */
  listThreads: ['exceptions_operate'],
  proposeResolution: ['exceptions_operate'],
  /**
   * 🛑 G3801/G3802, 4 Oct 2026 — THE RUN FAMILY ENTERS BOTH SCOPES BY THE
   * OWNER'S RULING ON C3-06, quoted: *"Open run reads to view_exception: anyone
   * who can see the register can see its runs; admit_source stays the gate for
   * starting runs."* Until then all five were `admit_source`, out of every
   * scope, on G173 (*"the residue is source material at LINE grain"*) and
   * §11.9a (a run's meters are volume in the clear). Both are SPENT by the
   * ruling, and each operation says so in its own `x-partner-exposure`.
   *
   * 🛑 AND THEY LEFT BOTH SCOPES AGAIN LATER ON 4 Oct 2026 — G3881, THE OWNER'S
   * RULING ON G3802, quoted: *"Keep partners out: run reads open to customer
   * roles holding view_exception, but are excluded from the partner capability
   * mask; partners still see exceptions, not run residue."* The five name
   * `view_run`, CARRIED by `view_exception` and in no scope, so the five
   * entries that stood here are DELETED rather than emptied — an entry in this
   * list means "a partner reaches it", and G173 and §11.9a hold again.
   */
}

test('assertion 5a · the partner-reachable set, and the SCOPE of each, is exactly the enumerated one', () => {
  const derived = {}
  for (const o of GATED) {
    const a = classifyAnnotation(o.annotation)
    if (a.kind !== 'capability') continue
    const scopes = Object.keys(PARTNER_CAPABILITY_MASK)
      .filter((s) => (PARTNER_CAPABILITY_MASK[s] ?? []).includes(a.capability))
      .sort()
    if (scopes.length > 0) derived[o.operationId] = scopes
  }
  const intended = {}
  for (const [op, scopes] of Object.entries(PARTNER_REACHABLE_OPERATIONS)) {
    intended[op] = [...scopes].sort()
  }
  assert.deepEqual(
    derived,
    intended,
    `The annotations make ${Object.keys(derived).length} operation(s) partner-reachable; the ` +
      `enumerated intended set has ${Object.keys(intended).length}. A partner reaches an ` +
      'operation iff its capability is in one of PARTNER_CAPABILITY_MASK\'s three scopes — six ' +
      'names, checked by `.includes()`, with nothing finer in between.\n\n' +
      `Reachable now: ${Object.keys(derived).length === 0 ? '(none — no operation is annotated)' : name(Object.keys(derived))}\n` +
      `Intended:      ${name(Object.keys(intended))}\n\n` +
      'THE VALUE IS THE SCOPE SET, NOT A BOOLEAN. An operation that moves from ' +
      '`exceptions_operate` alone into `exceptions_read` as well has been widened even though ' +
      'the key set did not change — that is the correspondence defect, and the flat form of ' +
      'this assertion could not see it.\n\n' +
      'If a mapping should change what a partner reaches, or at which scope, EDIT THE RECORD ' +
      'IN THIS FILE and say why in the same commit. That is the point of the equality.',
  )
})

test('assertion 5b · every partner-reachable operation states the exposure in writing', () => {
  const derived = GATED.map((o) => ({ o, a: classifyAnnotation(o.annotation) })).filter(
    ({ a }) => a.kind === 'capability' && MASK_UNION.has(a.capability),
  )
  const unstated = derived
    .filter(({ o }) => classifyPartnerExposure(o.partnerExposure).kind !== 'accepted')
    .map(({ o }) => o.operationId)
  const thin = derived
    .map(({ o }) => ({ o, e: classifyPartnerExposure(o.partnerExposure) }))
    .filter(({ e }) => e.kind === 'accepted' && e.reason.length < MIN_REASON_CHARS)
    .map(({ o }) => o.operationId)
  assert.deepEqual(
    [...unstated, ...thin].sort(),
    [],
    `${unstated.length + thin.length} partner-reachable operation(s) do not carry ` +
      `\`${PARTNER_EXPOSURE_KEY}: '${ACCEPTED_PREFIX} <why a partner may read this>'\`. ` +
      'Assertion 5a fixes WHICH operations a partner reaches; this one requires the reason to ' +
      'exist on the operation rather than in someone\'s memory of a survey. ONE of the ' +
      'enumerated set is still contested in this file\'s own header — `getDispositionMix` — ' +
      'and its exposure string says so on the operation. ⚠️ This message named THREE until ' +
      '16 Aug 2026; the other two were resolved by moving the annotation rather than by ' +
      'accepting the exposure, which is why the count moved rather than the reasoning.\n\n' +
      `Unstated: ${name(unstated)}\nThin reason: ${name(thin)}`,
  )
})

/**
 * 🛑 ADDED 16 Aug 2026, AND THE DEFECT IT CATCHES IS ONE THIS PASS COMMITTED
 * WHILE FIXING SOMETHING ELSE.
 *
 * `listRuns` and `getRun` carried `x-capability: view_dashboard` with a written
 * acceptance of partner reach beside it. Moving the capability to
 * `admit_source` takes both operations OUT of every mask scope — and the
 * acceptance string does not know that. Left behind it reads as a live decision
 * about a partner who can no longer reach the operation at all, which is the
 * §5.11 shape: a statement that was true when written, surviving the change that
 * falsified it.
 *
 * 5a and 5b are both blind to this by construction. 5a checks the reachable set;
 * 5b checks that every reachable operation states its exposure. NEITHER LOOKS AT
 * AN EXPOSURE ON AN OPERATION NOBODY CAN REACH. This one does, and it is the
 * inverse of 5b rather than a variation on it.
 */
test('assertion 5d · no operation states a partner exposure it cannot have', () => {
  const stale = OPS
    .map((o) => ({ o, a: classifyAnnotation(o.annotation) }))
    .filter(
      ({ o, a }) =>
        classifyPartnerExposure(o.partnerExposure).kind !== 'absent' &&
        !(a.kind === 'capability' && MASK_UNION.has(a.capability)),
    )
    .map(({ o, a }) => `${o.operationId} (${a.kind === 'capability' ? a.capability : a.kind})`)
  assert.deepEqual(
    stale.sort(),
    [],
    `${stale.length} operation(s) carry \`${PARTNER_EXPOSURE_KEY}\` while being reachable by ` +
      'no partner under any scope. An acceptance of partner reach on an operation a partner ' +
      'cannot reach is not harmless: it is the sentence a later reader trusts when deciding ' +
      'whether the exposure was thought about. Delete it in the commit that moved the ' +
      `capability.\n\nStale: ${stale.join(' · ')}`,
  )
})

/**
 * ⚠️ THIS ASSERTION WAS REWRITTEN ON 16 Aug 2026, AND THE ORIGINAL IS QUOTED
 * BELOW RATHER THAN DELETED, BECAUSE A REWRITTEN CONTROL IS THE ONE THING A
 * READER MUST BE ABLE TO AUDIT.
 *
 * It read, in its entirety:
 *
 *     const unaddressed = [...CAPABILITY_VALUES].filter((c) => !MASK_UNION.has(c))
 *     assert.deepEqual(unaddressed.sort(), [], …)
 *
 * 🛑 THAT FORM WAS NOT MERELY RED. IT WAS UNSATISFIABLE, AND IN THE DANGEROUS
 * DIRECTION. `MASK_UNION` is the union of the mask's three scopes, so the only
 * way to empty `unaddressed` is to put EVERY capability into a partner scope —
 * `place_legal_hold`, `manage_roles`, `bind_secret`, all of them. And the guard
 * forty lines up asserts `MASK_UNION` is exactly six names. The two could never
 * both pass. Its own message says so — *"until it exists this assertion cannot
 * pass"* — and names the fix: *"a total `Record<Capability, boolean>` behind the
 * mask, so that a 38th capability is a compile error that must be answered
 * in-mask or out-of-mask."*
 *
 * THAT RECORD NOW EXISTS: `PARTNER_MASK_MEMBERSHIP` (`model/access.ts`), and
 * `PARTNER_CAPABILITY_MASK` is DERIVED from it rather than written beside it.
 * The verdict is a scope LIST rather than a boolean, because `exceptions_read`
 * versus `exceptions_operate` is the whole of §10.6's argument; an empty array
 * is the out-of-mask verdict, written down.
 *
 * The four checks below are what the message asked for and three more besides.
 * None of them can pass on an empty input: (a) fails if a capability has no
 * verdict, (b) fails if the derived mask and the record disagree, (c) fails if
 * the out-list is empty — which is the shape the old assertion demanded — and
 * (d) names the four out-of-mask capabilities INDIVIDUALLY, because G173
 * requires the absence of `admit_source` be asserted *"BY NAME, never by a
 * length"*, and G128 records that discipline as applied.
 */
test('assertion 5c · every capability carries an explicit in-mask or out-of-mask verdict', () => {
  const SCOPES = ['commercial_only', 'exceptions_read', 'exceptions_operate']

  // (a) TOTALITY — the property the old form could not express.
  const unaddressed = [...CAPABILITY_VALUES].filter(
    (c) => !Object.prototype.hasOwnProperty.call(PARTNER_MASK_MEMBERSHIP, c),
  )
  assert.deepEqual(
    unaddressed.sort(),
    [],
    `${unaddressed.length} of ${CAPABILITY_VALUES.size} capabilities carry no verdict in ` +
      'PARTNER_MASK_MEMBERSHIP — neither a scope nor a written `[]`. Before that record ' +
      'existed, three capabilities carried a doc comment reading "IT APPEARS IN NO ' +
      '`PARTNER_CAPABILITY_MASK` SCOPE, EVER" AND THE COMMENT WAS THE ENTIRE ENFORCEMENT.\n\n' +
      `Unaddressed: ${name(unaddressed)}`,
  )

  // (b) AGREEMENT — the derived mask must be exactly what the record says.
  const projected = {}
  for (const s of SCOPES) {
    projected[s] = [...CAPABILITY_VALUES]
      .filter((c) => (PARTNER_MASK_MEMBERSHIP[c] ?? []).includes(s))
      .sort()
  }
  const actual = {}
  for (const s of SCOPES) actual[s] = [...(PARTNER_CAPABILITY_MASK[s] ?? [])].sort()
  assert.deepEqual(
    actual,
    projected,
    'PARTNER_CAPABILITY_MASK disagrees with PARTNER_MASK_MEMBERSHIP. The mask is DERIVED ' +
      'from the record precisely so this cannot happen; two encodings of one rule are two ' +
      'encodings that can disagree with no tiebreak written anywhere.',
  )

  // (c) THE OUT-LIST IS NOT EMPTY — otherwise (a) and (b) both pass on a mask
  //     that reaches everything, which is the failure the old form demanded.
  const out = [...CAPABILITY_VALUES].filter(
    (c) => (PARTNER_MASK_MEMBERSHIP[c] ?? []).length === 0,
  )
  assert.ok(
    out.length > 0 && out.length === CAPABILITY_VALUES.size - MASK_UNION.size,
    `${out.length} capabilities are out of every partner scope and ${MASK_UNION.size} are in ` +
      `one, against a vocabulary of ${CAPABILITY_VALUES.size}. If those do not add up, some ` +
      'capability is both in a scope and recorded as out of every scope.',
  )

  // (d) BY NAME, NEVER BY A LENGTH — G173's own instruction, and G128's applied
  //     discipline. A count here would pass while the wrong four were out.
  for (const c of ['view_summary', 'view_metering', 'promote_learning', 'admit_source']) {
    assert.deepEqual(
      PARTNER_MASK_MEMBERSHIP[c],
      [],
      `\`${c}\` is in a PARTNER_CAPABILITY_MASK scope. Each of these four carries a doc ` +
        'comment reading "IT APPEARS IN NO `PARTNER_CAPABILITY_MASK` SCOPE, EVER", and each ' +
        'absence is a separate argument: §10.6 for the pushed digest, §11.9a for volume in ' +
        'the clear, G128 for unattended behaviour, and G173 for source material at line ' +
        'grain. G173 requires this be asserted BY NAME and never by a length.',
    )
  }
})
