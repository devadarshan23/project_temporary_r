/**
 * ASSERTION 4 — THE `Capability[]` HOLE, WITNESSED. This is the assertion the
 * ruling calls the one that matters most, and it is the only one in the pass
 * whose fix is a MODEL change rather than a YAML annotation.
 *
 * 🛑 THIS FILE IS EXPECTED TO FAIL, AND ITS FIRST RED IS WORSE THAN THE RULING
 * ANTICIPATED. The ruling says: "Adding a capability produces compile errors in
 * the two total `Record`s, which is a feature, but no compile error if a role
 * fails to hold it. So every role must be revisited by hand."
 *
 * ┌─ THERE ARE NO ROLES IN THE TREE TO REVISIT ────────────────────────────────┐
 * │ `grep -rn 'capabilities:' model/*.ts` → 5 hits, and NOT ONE CONSTRUCTS A    │
 * │ `Role`: the field declaration itself (access.ts:827), an unrelated          │
 * │ `DelegableCapability[]` on an agent, `ModelCapabilities` on a catalogue     │
 * │ entry, and two `readonly Capability[]` parameters in `policy.ts`.           │
 * │ `model/examples.ts` has no role fixture.                                    │
 * │                                                                            │
 * │ `ROLE_KEYS` and `RoleKey` were DELETED — the single `delete` of the whole   │
 * │ v1 trim — and `RoleOrigin.platform` is documented as "the seeded defaults   │
 * │ that replaced the old RoleKey enum". THOSE SEEDED DEFAULTS EXIST NOWHERE.   │
 * │                                                                            │
 * │ So "every role must be revisited by hand" currently has an EMPTY SUBJECT,   │
 * │ and a completeness check written today would iterate zero roles and pass —  │
 * │ §5.6, a control that passes while asserting nothing, which is the exact     │
 * │ failure the ruling says shipped twice in one day. Every assertion below is  │
 * │ therefore written to fail on the EMPTINESS FIRST and on the CONTENT second, │
 * │ with separate messages, so the two are never confused.                     │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ `.mjs`, AND THE NAMESPACE IMPORT IS THE WHOLE REASON. This file asserts on
 * exports `model/access.ts` does not have. A `.ts` file naming a missing export
 * is TS2339 under `npm run typecheck:tests` — a COMPILE failure, which takes the
 * entire suite down before a single assertion runs and is the weakest possible
 * red. `import * as access` resolves a missing key to `undefined` at run time,
 * so each assertion below fails on its own, with its own message, and the split
 * is countable. The guards in section 0 pass at base for the same reason: they
 * read exports that DO exist, through the same namespace.
 *
 * ⚠️ NOTHING HERE MOUNTS ANYTHING. `TenantSession` (server/data-plane/session.ts)
 * carries ONE field, `tenantId` — no user, no org class, no partner grant, no
 * held assignments — so `decide()` and `authorize()` CANNOT BE CALLED FROM ANY
 * HANDLER TODAY, not because nobody wrote the call but because there is nothing
 * to build a `PrincipalContext` from. That is a prerequisite no annotation can
 * substitute for, and it is not this commit's to build.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import * as access from '../../model/access.ts'

import {
  declaredOperations,
  classifyAnnotation,
  gateVerdictOf,
  name,
} from '../../tools/check-capability-annotations.mjs'

const CAPABILITY_VALUES = new Set(Object.values(access.CAPABILITIES))
const STAKEHOLDER_VALUES = new Set(Object.values(access.STAKEHOLDER_CLASSES))

/** Whatever the model exports today, defaulted so the reads below cannot throw. */
const SEEDED = access.SEEDED_PLATFORM_ROLES
const CLASS_CEILING = access.CAPABILITY_STAKEHOLDER_CLASSES

/* ==================================================================== *
 * 0 · THE §5.6 GUARDS — these PASS at base.
 * ==================================================================== */

test('guard · model/access.ts loads and exports the vocabularies this file joins', () => {
  // ⚠️ 37 UNTIL 16 Aug 2026 — G173's `admit_source`, applied. See the twin
  // guard in tests/contracts/capability-annotation.test.mjs.
  // ⚠️ THEN 38 → 39 ON THE MERGE OF origin/main THE SAME DAY: #194's
  // `view_endpoint` was minted on trunk against the same 37, so both branches
  // said "38" and meant different sets. The merged roster is 39.
  // ⚠️ THEN 39 → 44 ON 19 Sep 2026 — G601's five PLATFORM-ONLY capabilities,
  // `view_substrate` · `provision_substrate` · `view_catalogue` ·
  // `author_catalogue` · `publish_catalogue`. NONE of them is tenant-held, so
  // every floor assertion below is unaffected in substance and each of the
  // five carries `[]` in CAPABILITY_STAKEHOLDER_CLASSES — the first empty
  // entries that record has ever had. This guard moved and the assertions it
  // guards did not, which is the guard working.
  // ⚠️ THEN 44 → 50 ON 1 Oct 2026 — R10's six PARTNER-ONLY verbs (`view_deals`
  // · `register_deal` · `view_sandbox` · `operate_sandbox` ·
  // `view_partner_staff` · `manage_partner_staff`), each `[]` in the ceiling
  // for the same reason as G601's five, and fenced by
  // PARTNER_ONLY_RESOURCE_CLASSES rather than the platform list.
  // ⚠️ THEN 50 → 51 ON 4 Oct 2026 — G3881's `view_run` (the owner's G3802
  // ruling), CARRIED by `view_exception` and never stored on a role, so the
  // two assertions below that ask "does a seeded role HOLD it" ask
  // `access.roleCarries()` — the evaluator's own rule — rather than `.has()`.
  assert.equal(
    CAPABILITY_VALUES.size,
    51,
    `CAPABILITIES resolved to ${CAPABILITY_VALUES.size} member(s). Every assertion below ` +
      'joins roles to that set; a failed import would make all of them vacuous.',
  )
  assert.deepEqual(
    [...STAKEHOLDER_VALUES].sort(),
    ['administrator', 'assurance', 'author', 'sponsor', 'user'],
    'STAKEHOLDER_CLASSES is the five-member set the floors below are keyed on.',
  )
})

test('guard · Role.capabilities is a bare list, which is the hole this file exists for', () => {
  assert.equal(
    typeof access.CAPABILITY_RESOURCE_CLASS,
    'object',
    'CAPABILITY_RESOURCE_CLASS is the total Record that DOES fire on a new capability.',
  )
  assert.equal(
    Object.keys(access.CAPABILITY_RESOURCE_CLASS).length,
    CAPABILITY_VALUES.size,
    'CAPABILITY_RESOURCE_CLASS is total over Capability at run time as well as at compile ' +
      'time. It is named here as the CONTRAST: `Role.capabilities` is `Capability[]`, a bare ' +
      'list, so a role missing a capability produces no error anywhere, at any time.',
  )
})

/* ==================================================================== *
 * 4a · THE SUBJECT MUST EXIST.
 * ==================================================================== */

test('assertion 4a · model/access.ts exports SEEDED_PLATFORM_ROLES', () => {
  assert.ok(
    Array.isArray(SEEDED) && SEEDED.length > 0,
    'model/access.ts exports no `SEEDED_PLATFORM_ROLES` (resolved to ' +
      `${SEEDED === undefined ? 'undefined' : JSON.stringify(SEEDED)}).\n\n` +
      '🛑 THIS IS THE FIRST COMMIT OF THE GATE, NOT THE ANNOTATION. `RoleOrigin.platform` is ' +
      'documented as "the seeded defaults that replaced the old RoleKey enum" and those ' +
      'defaults exist nowhere — `ROLE_KEYS` and `RoleKey` were deleted and nothing replaced ' +
      'them. Until a real fixture exists, every role-completeness check in this repository ' +
      'iterates zero roles and passes, which is §5.6 and is worse than having no check.\n\n' +
      'What it must be: an array of `Role`, each `origin: \'platform\'`, `packId: null`, ' +
      'each carrying a `stakeholderClass` and a `defaultScope`.',
  )
})

test('assertion 4b · model/access.ts exports CAPABILITY_STAKEHOLDER_CLASSES, total', () => {
  assert.equal(
    typeof CLASS_CEILING,
    'object',
    'model/access.ts exports no `CAPABILITY_STAKEHOLDER_CLASSES` (resolved to ' +
      `${CLASS_CEILING === undefined ? 'undefined' : typeof CLASS_CEILING}).\n\n` +
      'What it must be: `Record<Capability, readonly StakeholderClass[]>` — TOTAL, so that a ' +
      '38th capability is a COMPILE ERROR that has to be answered, exactly as ' +
      '`CAPABILITY_RESOURCE_CLASS` and `CAPABILITY_DELEGABLE` already are. Both of those ' +
      'fired when `promote_learning` was minted; nothing fired on the role side, because ' +
      'there is no role side.',
  )
  const covered = CLASS_CEILING === undefined ? [] : Object.keys(CLASS_CEILING)
  const missing = [...CAPABILITY_VALUES].filter((c) => !covered.includes(c))
  assert.deepEqual(
    missing.sort(),
    [],
    `${missing.length} of ${CAPABILITY_VALUES.size} capabilities have no entry in ` +
      `CAPABILITY_STAKEHOLDER_CLASSES.\n\nUncovered: ${name(missing)}`,
  )
})

/* ==================================================================== *
 * 4c · THE FLOOR — the assertion the ruling asks to be designed so that
 *      a role SILENTLY MISSING ONE FAILS.
 *
 * Each entry is a capability without which a stakeholder class's own
 * job is structurally impossible, and each carries the reason from the
 * record rather than from an opinion. This is a FLOOR, never a ceiling:
 * a seeded role may hold more.
 * ==================================================================== */

const STAKEHOLDER_FLOOR = {
  /**
   * "Uses the output. The exception queue is their screen." (STAKEHOLDER_CLASSES,
   * model/access.ts.)
   *
   * `admit_correspondence` IS THE ONE PEOPLE WILL WANT TO DROP AND IT IS THE ONE
   * THAT CANNOT BE DROPPED. `getProcedureState`'s `parked` variant carries
   * `advanceable: { type: boolean, const: false }` and `resumesOn: admission`
   * for a `counterparty_reply` — "always", per the schema's own description. A
   * user role without `admit_correspondence` therefore produces a queue where
   * every parked step is permanently unadvanceable, and the ONLY symptom is
   * exceptions ageing. Nothing errors. Nothing logs. That is the shape this
   * assertion exists to make loud.
   */
  user: [
    'view_exception',
    'view_document',
    'assign_exception',
    'propose_resolution',
    'advance_procedure',
    'admit_correspondence',
  ],
  /**
   * "So a sponsor needs a floor, and that floor is `view_summary` (§10.6)."
   * QUOTED FROM `STAKEHOLDER_CLASSES.sponsor`'s own doc comment, which also
   * records that the previous comment — claiming a sponsor "legitimately holds
   * zero capabilities" — IS NOW FALSE and was deleted. §8.4 made the digest a
   * first-class governed read, so a recipient holding zero capabilities receives
   * an EMPTY digest, indistinguishable from a quiet week.
   */
  sponsor: ['view_summary'],
  /**
   * "Keeps it working: tolerances, connectors, versions, the fleet." A seeded
   * administrator that cannot run a configured job or install a pack keeps
   * nothing working.
   */
  administrator: ['trigger_run', 'install_pack', 'configure_tolerance'],
  /**
   * "they must be reachable and some of them must see the audit trail."
   * ⚠️ NEITHER OF THESE HAS A DECLARED OPERATION ON ANY TIER — both belong to
   * the `administration.openapi.yaml` that does not exist. The floor is asserted
   * against the ROLE anyway, because a class whose defining act is unreachable
   * is a fact worth failing on rather than one worth omitting.
   */
  assurance: ['view_audit', 'view_access_log'],
  /** "Authors the thing: definitions, rules, procedures, packs." */
  author: ['author_definition', 'author_procedure', 'author_rule'],
}

test('guard · every floor names a real capability and a real stakeholder class', () => {
  const badClass = Object.keys(STAKEHOLDER_FLOOR).filter((k) => !STAKEHOLDER_VALUES.has(k))
  assert.deepEqual(badClass, [], `Floor keyed on a non-class: ${name(badClass)}`)
  const badCap = Object.values(STAKEHOLDER_FLOOR)
    .flat()
    .filter((c) => !CAPABILITY_VALUES.has(c))
  assert.deepEqual(
    badCap.sort(),
    [],
    `The floor names ${badCap.length} capability that is not a member of CAPABILITIES: ` +
      `${name(badCap)}. A floor keyed on a retired name asserts nothing.`,
  )
  assert.deepEqual(
    Object.keys(STAKEHOLDER_FLOOR).sort(),
    [...STAKEHOLDER_VALUES].sort(),
    'All five stakeholder classes must carry a floor, even where it is short. A class with ' +
      'no entry is a class this assertion silently skips.',
  )
})

/**
 * ⚠️ ADDED 16 Aug 2026 WITH THE MECHANISM, AND IT IS THE REASON THE DOUBLE ENTRY
 * IS SAFE. `model/access.ts` now carries its own `STAKEHOLDER_CAPABILITY_FLOOR`,
 * which is what makes a dropped floor capability a COMPILE error
 * (`_EverySeededFloorBearerMeetsItsFloor`). This file deliberately does NOT
 * import it as its own floor — a test that read the model's constant would be
 * asserting the model against itself, which is a control that passes while
 * asserting nothing. The floor above stays independently written, with its own
 * quoted reasons, and this assertion is the tiebreak: the MECHANISM must cover
 * the WITNESS, so weakening the model's floor to make a compile error go away
 * fails here instead.
 */
test('guard · the model floor covers this file\'s independently written floor', () => {
  const modelFloor = access.STAKEHOLDER_CAPABILITY_FLOOR ?? {}
  const shortfalls = []
  for (const [cls, floor] of Object.entries(STAKEHOLDER_FLOOR)) {
    for (const c of floor) {
      if (!(modelFloor[cls] ?? []).includes(c)) shortfalls.push(`${cls} → ${c}`)
    }
  }
  assert.deepEqual(
    shortfalls.sort(),
    [],
    `${shortfalls.length} capability(ies) this file calls a floor are absent from ` +
      'model/access.ts STAKEHOLDER_CAPABILITY_FLOOR, so the compile-time assertion that ' +
      'guards the seeded roles is guarding LESS than this file asserts. The compiler would ' +
      'stay green while a seeded role dropped one.\n\n' +
      `Uncovered: ${name(shortfalls)}`,
  )
})

test('assertion 4c · every stakeholder class has a seeded role meeting its floor', () => {
  const roles = Array.isArray(SEEDED) ? SEEDED : []
  const shortfalls = []
  for (const [cls, floor] of Object.entries(STAKEHOLDER_FLOOR)) {
    const ofClass = roles.filter((r) => r?.stakeholderClass === cls)
    if (ofClass.length === 0) {
      shortfalls.push(`${cls}: NO SEEDED ROLE AT ALL (floor of ${floor.length} unmet)`)
      continue
    }
    const met = ofClass.some((r) => floor.every((c) => (r?.capabilities ?? []).includes(c)))
    if (!met) {
      const best = ofClass[0]
      const missing = floor.filter((c) => !(best?.capabilities ?? []).includes(c))
      shortfalls.push(`${cls}: no seeded role holds [${missing.join(', ')}]`)
    }
  }
  assert.deepEqual(
    shortfalls.sort(),
    [],
    `${shortfalls.length} of ${Object.keys(STAKEHOLDER_FLOOR).length} stakeholder classes have ` +
      'no seeded role meeting their floor.\n\n' +
      '🛑 THIS IS THE ASSERTION THE RULING CALLS THE ONE THAT MATTERS. `Role.capabilities` is ' +
      '`Capability[]` — a list — so a role missing a capability is not a compile error, not a ' +
      'run-time error, and not a log line. `decide()` returns DENY_ALL with a DecisionReason ' +
      'per request, which makes the failure visible ONE REQUEST AT A TIME and invisible in ' +
      'aggregate. Three shapes it takes: a `user` role missing `admit_correspondence` parks ' +
      'the queue forever; a `sponsor` role missing `view_summary` sends an empty digest that ' +
      'looks like a quiet week; an `administrator` role missing a pack read verb can install ' +
      `packs and cannot list them.\n\nShortfalls:\n  ${shortfalls.join('\n  ')}`,
  )
})

/**
 * 🛑 ADDED 16 Aug 2026 BECAUSE A NEGATIVE CONTROL WALKED STRAIGHT THROUGH 4d.
 *
 * The control: widen `CAPABILITY_STAKEHOLDER_CLASSES.approve_resolution` to
 * include `administrator`, then give the seeded `tenant_admin` role
 * `approve_resolution`. NOTHING WENT RED — and 4d is right not to fire, because
 * 4d asks whether a role exceeds THE CEILING and the ceiling had just been
 * raised to meet it. A rule that can be satisfied by editing the rule is the
 * defect shape this repository catalogues most.
 *
 * These two entries are not this file's opinion. `STAKEHOLDER_CLASSES
 * .administrator`'s own doc comment reads: an administrator *"holds neither
 * `approve_resolution` nor `set_autonomy` by virtue of the class"* — and the
 * paragraph around it is titled "GLOSS, AND IT IS LOAD-BEARING: this is NOT
 * root." So they are asserted BY NAME here, against the model, where widening
 * the ceiling fails rather than passes.
 *
 * ⚠️ This is a CEILING assertion and not a claim that no administrator may ever
 * approve. It says the CLASS does not confer it. An individual grant is a
 * different question and this file does not answer it.
 */
test('assertion 4f · the administrator ceiling holds the two the record names, by name', () => {
  const ceiling = CLASS_CEILING ?? {}
  for (const capability of ['approve_resolution', 'set_autonomy']) {
    assert.equal(
      (ceiling[capability] ?? []).includes('administrator'),
      false,
      `CAPABILITY_STAKEHOLDER_CLASSES.${capability} now permits \`administrator\`. ` +
        'STAKEHOLDER_CLASSES.administrator says, verbatim, that an administrator "holds ' +
        `neither \`approve_resolution\` nor \`set_autonomy\` by virtue of the class". If that ` +
        'ruling has changed, change it at the class comment first and quote the new one here ' +
        '— widening the ceiling so that assertion 4d stops firing is the rule being edited to ' +
        'fit the violation.',
    )
    assert.ok(
      (ceiling[capability] ?? []).length > 0,
      `CAPABILITY_STAKEHOLDER_CLASSES.${capability} is empty, which passes the check above ` +
        'while making the capability unholdable by anyone. Emptying an entry is the other way ' +
        'to make this assertion vacuous.',
    )
  }
})

test('assertion 4d · no seeded role exceeds what its stakeholder class may hold', () => {
  const roles = Array.isArray(SEEDED) ? SEEDED : []
  const ceiling = CLASS_CEILING ?? {}
  const excesses = []
  for (const r of roles) {
    for (const c of r?.capabilities ?? []) {
      const permitted = ceiling[c]
      if (!Array.isArray(permitted) || !permitted.includes(r?.stakeholderClass)) {
        excesses.push(`${r?.key ?? '(unkeyed role)'} [${r?.stakeholderClass}] holds ${c}`)
      }
    }
  }
  assert.deepEqual(
    excesses.sort(),
    [],
    `${excesses.length} seeded role capability/class pair(s) are not permitted by ` +
      'CAPABILITY_STAKEHOLDER_CLASSES.\n\n' +
      '⚠️ THIS ASSERTION IS VACUOUS UNTIL 4a AND 4b PASS — zero roles and an absent ceiling ' +
      'produce zero pairs — and it is shipped red-adjacent on purpose, so that it is already ' +
      'in place on the day the fixture lands rather than written afterwards against a fixture ' +
      'that has already shaped it. `STAKEHOLDER_CLASSES.administrator` supplies the first two ' +
      'entries the ceiling must carry: an administrator "holds neither `approve_resolution` ' +
      `nor \`set_autonomy\` by virtue of the class".\n\n${excesses.join('\n  ')}`,
  )
})

/* ==================================================================== *
 * 4e · THE JOIN — every gate has a holder.
 *
 * Keyed OPERATION-FIRST, never capability-first. Most of the roster is
 * named by no operation in any tier — the bulk of them belong to the
 * `administration.openapi.yaml` that does not exist — so "every
 * capability has an operation" would be RED BY CONSTRUCTION and would
 * teach people to ignore this file.
 *
 * ⚠️ THIS COMMENT SAID "20 of the 37" AND BOTH NUMBERS WERE DEAD when a
 * red team read them: the tree is 22 of 38. `tools/check-doc-counts.mjs`
 * reads Markdown, not `.mjs`, so nothing catches a stale count in this
 * file — which is §5.11 landing in the one file that argues §5.11
 * hardest. Both numbers are now DERIVED and interpolated into the
 * message below rather than written here. Reproduce by hand:
 *
 *   node -e "const g=require('./docs/model-graph.json');\
 *     console.log(g.gaps.filter(x=>x.kind==='capability_without_contract').length)"
 *   awk '/^export const CAPABILITIES = \{/,/^\}/' model/access.ts \
 *     | grep -cE '^  [a-zA-Z]+:'
 * ==================================================================== */

test('assertion 4e · every annotated TENANT capability is held by at least one seeded role', () => {
  const roles = Array.isArray(SEEDED) ? SEEDED : []
  const held = new Set(roles.flatMap((r) => r?.capabilities ?? []))
  const annotated = declaredOperations()
    /* ⚠️ THIS READ `.filter((o) => TIER_REQUIRES_CAPABILITY[o.tier])` UNTIL
       20 Sep 2026 AND IT WAS ALWAYS REDUNDANT WITH THE LINE BELOW IT: the
       next filter already demands `a.kind === 'capability'`, so the tier
       narrowed a set the annotation had narrowed. G911 retires the tier
       verdict; the per-operation form says the same thing and says it once. */
    .filter((o) => gateVerdictOf(classifyAnnotation(o.annotation)) === 'gated')
    .map((o) => ({ o, a: classifyAnnotation(o.annotation) }))
    .filter(({ a }) => a.kind === 'capability' && CAPABILITY_VALUES.has(a.capability))
    /**
     * 🛑 PLATFORM-ONLY CAPABILITIES ARE EXCLUDED, AND THE EXCLUSION IS THE
     * FENCE RATHER THAN A HOLE IN IT — added 19 Sep 2026, when the
     * `platformConsole` tier became the SECOND tier whose
     * `TIER_REQUIRES_CAPABILITY` was `true` and put five of these into this
     * join for the first time. ⚠️ THAT TABLE IS RETIRED (G913) AND THE
     * EXCLUSION IS UNCHANGED: the join is now over every operation that NAMES
     * a capability, which on this tree is the same 53 operations.
     *
     * `SEEDED` is `access.SEEDED_PLATFORM_ROLES`, and **that name is a trap
     * this very test fell into**: `model/access.ts` flags it in its own voice —
     * *"In that constant 'platform' means SHIPPED BY THE PLATFORM — the seeded
     * roles a tenant starts with. It does NOT mean `PlatformRole`."* So this
     * join asks *"does a seeded TENANT role hold it"*, and the answer for
     * `view_substrate`, `provision_substrate`, `view_catalogue`,
     * `author_catalogue` and `publish_catalogue` **must be no**: G601's whole
     * point is that a tenant role carrying one is refused by `decide()` before
     * its capability list is read, and `SEEDED_CAPABILITY_HOLDERS` declares all
     * five `[]` deliberately.
     *
     * ⚠️ SO SEEDING THEM TO SATISFY THIS ASSERTION WOULD BE A SECURITY DEFECT,
     * which is why the filter is here rather than the roster being widened.
     * **The property is not dropped, it is asserted somewhere it can be true**:
     * `tests/model/platform-only-capabilities.test.ts` §3 requires every fenced
     * capability to be EMPTY in all three tenant-side records, and §5a records
     * that nothing produces a holder of any of the five. Restating either here
     * would be §5.3 — two implementations of one rule, and the copy is the one
     * that drifts.
     *
     * 🛑 WHAT IS GENUINELY NOT ASSERTED ANYWHERE, AND IS NAMED RATHER THAN
     * HIDDEN: that some PLATFORM role holds them. There is no seeded
     * `PlatformRole` in this repository at all — §6a's producer gap — so the
     * fourteen operations on the `platformConsole` tier are gated by verbs
     * NOBODY HOLDS. That is not this assertion's failure to catch; it is the
     * reason that tier mounts nothing, and it is stated on the tier's own entry
     * in `server/contract/capability.ts` and in §5 of the document.
     */
    .filter(({ a }) => !access.capabilityIsPlatformOnly(a.capability))
    /**
     * 🛑 AND PARTNER-ONLY CAPABILITIES ARE EXCLUDED FOR THE MIRROR REASON —
     * W5, 1 Oct 2026, when nine `partner-portal-role` operations were annotated
     * with R10's six verbs and put them into this join for the first time.
     * G2324 fences them out of every TENANT role exactly as G601 fences the
     * platform five (`capability_is_partner_only`), and `SEEDED_CAPABILITY_HOLDERS`
     * declares all six `[]`. **Seeding a tenant role with `register_deal` to
     * satisfy this line would let a customer administrator stake a deal in a
     * partner's name** — G2324's own sentence. Their holders are
     * `tenant.partner_role_assignment` rows, which nothing on a request path
     * writes yet (redemption is owed, G2629).
     */
    .filter(({ a }) => !access.capabilityIsPartnerOnly(a.capability))

  /* G3881 — "held" is the evaluator's word, `roleCarries()`: a capability
     CARRIED by another (`view_run` by `view_exception`) is held by every seeded
     role holding its carrier, with no row of its own. */
  const carried = (c) => held.has(c) || roles.some((r) => access.roleCarries({ capabilities: r?.capabilities ?? [] }, c))
  const orphaned = [
    ...new Set(annotated.filter(({ a }) => !carried(a.capability)).map(({ a }) => a.capability)),
  ]

  assert.ok(
    annotated.length > 0,
    `Zero capability-tier operations carry a resolvable \`x-capability\`, so this assertion ` +
      'has nothing to join and would otherwise pass while asserting nothing. It fails HERE, ' +
      'on the emptiness, rather than below on the content — the two are different facts and ' +
      'are reported as two.',
  )
  const named = new Set(annotated.map(({ a }) => a.capability))
  const unnamed = [...CAPABILITY_VALUES].filter((c) => !named.has(c))
  assert.deepEqual(
    orphaned.sort(),
    [],
    `${orphaned.length} capability(ies) gate a declared operation and are held by no seeded ` +
      'role. A gate nobody can pass is not a gate; it is an operation nobody can reach, and it ' +
      'is indistinguishable from a bug in the handler.\n\n' +
      `This join is OPERATION-FIRST: ${unnamed.length} of the ${CAPABILITY_VALUES.size} ` +
      'capabilities are named by no operation on any tier and are therefore out of scope for ' +
      `it — ${name(unnamed)}.\n\nOrphaned: ${name(orphaned)}`,
  )
})

/* ==================================================================== *
 * 4g · WHAT EACH SEEDED ROLE MUST BE ABLE TO DO, IN OPERATIONS.
 *
 * 🛑 ADDED 16 Aug 2026 BECAUSE A RED TEAM WALKED STRAIGHT THROUGH 4c AND
 * 4e TOGETHER. The mutation: delete `'trigger_run'` from
 * `SEEDED_OPERATOR` — the role whose own ceiling entry argues `user`
 * must hold it, quoting `admitRun`'s "an operator presses Run at the
 * same moment a document lands". `tsc` stayed CLEAN and every assertion
 * in this file PASSED, because `trigger_run` is not in the `user` floor
 * (correctly — an administrator can also press Run) and 4e is satisfied
 * by ANY holder, which `SEEDED_TENANT_ADMIN` still was.
 *
 * THE THIRD AXIS, AND IT IS THE PRODUCT'S OWN. 4c is keyed on the FLOOR,
 * 4e on the ANNOTATION, and `SEEDED_CAPABILITY_HOLDERS` (model, compile
 * time) on the CAPABILITY. This one is keyed on the WIRE: an operation a
 * role must be able to reach. It is not a restatement of any of them —
 * dropping a capability from a seed is caught here as "operator can no
 * longer reach admitRun", which is the sentence a person can act on.
 *
 * ⚠️ WHY NOT KEY IT ON THE CEILING INSTEAD, which is the obvious form.
 * `CAPABILITY_STAKEHOLDER_CLASSES.export_data` permits `user`, and no
 * seeded `user` role holds it — deliberately, because bulk egress is not
 * an operating default. "Every class the ceiling permits must have a
 * seed holding it" would therefore be red on a correct tree: it reads
 * MAY as MUST. That form was written, run, and rejected on that finding.
 * ==================================================================== */

/**
 * TOTAL OVER THE SEVEN SEED KEYS, so an eighth seed with no entry fails rather
 * than being skipped. Two entries are `[]` and each is a fact about the WIRE
 * rather than about the role: `author` and `assurance` hold only capabilities no
 * declared operation names, because the authoring and assurance surfaces live in
 * the `administration.openapi.yaml` that does not exist. When it does, they get
 * entries; until then an empty list is the honest verdict and the guard below
 * makes it a visible one rather than a silent pass.
 */
const SEEDED_ROLE_MUST_REACH = {
  /** The narrow read-only seat. If it cannot open the queue it is not a seat. */
  viewer: ['listExceptions', 'getException', 'getExceptionFacets', 'getDispositionMix'],
  /** The screen the product is about. Every operating verb the wire declares. */
  operator: [
    'listExceptions',
    'getException',
    'getDocument',
    'listThreads',
    'getThread',
    'getMessage',
    'assignException',
    'proposeResolution',
    'advanceProcedureStep',
    'decideAdmission',
    'sendOutboundMessage',
    'executeProposal',
    'createUpload',
    'completeUpload',
    'admitRun',
    'listRuns',
    'getRun',
  ],
  /** Four eyes. The approver approves and reverses and does not propose. */
  approver: ['getException', 'getDocument', 'decideApproval', 'reverseResolution'],
  /** Keeps it working: packs, exports, and the runs it configured. */
  tenant_admin: [
    'listInstalledPacks',
    'installPack',
    'createExport',
    'getExport',
    'admitRun',
    'listRuns',
    'listIntakeChannels',
  ],
  /** Accountable, not operating. Risk appetite is the sponsor's verb. */
  sponsor: [
    'listAutonomyRecommendations',
    'getAutonomyRecommendation',
    'decideAutonomyRecommendation',
    'getDispositionMix',
  ],
  /** `[]` — the authoring surface is not declared on any tier. See above. */
  author: [],
  /** `[]` — the assurance surface is not declared on any tier. See above. */
  assurance: [],
}

test('assertion 4g · every seeded role can reach the operations its seat is for', () => {
  const roles = Array.isArray(SEEDED) ? SEEDED : []
  const byKey = new Map(roles.map((r) => [r?.key, r]))

  // TOTALITY, BOTH WAYS — an eighth seed with no entry, or an entry naming a
  // seed that no longer exists, fails here rather than being skipped.
  assert.deepEqual(
    [...byKey.keys()].sort(),
    Object.keys(SEEDED_ROLE_MUST_REACH).sort(),
    'SEEDED_ROLE_MUST_REACH and SEEDED_PLATFORM_ROLES name different sets of seeds. A seed ' +
      'with no entry here is a seed this assertion silently skips, which is the §5.6 shape ' +
      'the whole file exists to avoid.',
  )

  // THE ANNOTATION EACH OPERATION CARRIES, read from the wire rather than
  // assumed — so a renamed operationId or a dropped annotation fails HERE, on
  // the lookup, rather than making the reachability check vacuous below.
  const capabilityOf = new Map(
    declaredOperations()
      .filter((o) => gateVerdictOf(classifyAnnotation(o.annotation)) === 'gated')
      .map((o) => [o.operationId, classifyAnnotation(o.annotation)])
      .filter(([, a]) => a.kind === 'capability' && CAPABILITY_VALUES.has(a.capability))
      .map(([id, a]) => [id, a.capability]),
  )
  const unresolvable = Object.values(SEEDED_ROLE_MUST_REACH)
    .flat()
    .filter((op) => !capabilityOf.has(op))
  assert.deepEqual(
    [...new Set(unresolvable)].sort(),
    [],
    `${unresolvable.length} operation(s) named in SEEDED_ROLE_MUST_REACH resolve to no ` +
      'annotated capability-tier operation. Either the operationId was renamed, or the ' +
      'operation lost its `x-capability`, or this list has a typo — and every one of those ' +
      `would otherwise make this assertion pass while checking nothing.\n\n${name(unresolvable)}`,
  )

  const unreachable = []
  for (const [key, operations] of Object.entries(SEEDED_ROLE_MUST_REACH)) {
    const role = { capabilities: byKey.get(key)?.capabilities ?? [] }
    for (const op of operations) {
      const needed = capabilityOf.get(op)
      /* G3881 — `roleCarries()`, so a carried verb (`view_run`) is reached. */
      if (!access.roleCarries(role, needed)) unreachable.push(`${key} cannot reach ${op} (needs ${needed})`)
    }
  }
  assert.deepEqual(
    unreachable.sort(),
    [],
    `${unreachable.length} seeded role/operation pair(s) are unreachable. A seat that cannot ` +
      'perform the act it is named for does not fail loudly: `decide()` returns DENY_ALL with ' +
      'a DecisionReason ONE REQUEST AT A TIME, so the symptom is a person filing a ticket ' +
      'weeks later. If a seat legitimately should no longer reach an operation, EDIT THE LIST ' +
      `ABOVE and say why in the same commit.\n\n  ${unreachable.join('\n  ')}`,
  )
})
