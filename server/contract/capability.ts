/**
 * THE ANNOTATION GRAMMAR — ONE DEFINITION, READ BY THE ROUTER, BY THE CHECKER
 * AND BY THE SUITE.
 *
 * ⚠️ THIS FILE IS A MOVE, NOT AN INVENTION, AND THE SENTENCE IT SUPERSEDES IS
 * QUOTED RATHER THAN DELETED. The grammar below lived in
 * `tests/contracts/annotations.mjs`, whose header read: *"This is not a checker
 * and it is deliberately not in `tools/`. Nothing in `npm run check` calls it;
 * `tools/` takes a checker when the gate it checks exists, and today the gate
 * does not."* **The gate exists as of this commit** — `server/http/app.ts`
 * registers a `preValidation` hook and `mountTier()` refuses to boot over a bad
 * annotation — so the condition that sentence named is met, the module is
 * promoted to `tools/check-capability-annotations.mjs`, and the GRAMMAR ITSELF
 * lands here, in TypeScript, because `server/` is now one of its readers and
 * `server/` cannot import a `.mjs` under `verbatimModuleSyntax` without losing
 * every type on it.
 *
 * ┌─ THE GRAMMAR, AND WHY IT IS SHAPED THIS WAY ───────────────────────────────┐
 * │                                                                            │
 * │   x-capability: view_exception          a member of CAPABILITIES           │
 * │   x-capability: 'exempt: <reason>'      exempt, with the reason ON the     │
 * │                                         operation                          │
 * │                                                                            │
 * │ ONE KEY, PRESENT ON EVERY OPERATION, NEVER OPTIONAL. That is the whole     │
 * │ mechanism. The alternative — a list of exempt operationIds inside the      │
 * │ server — is the defect shape this repository catalogues most, and          │
 * │ `server/http/app.ts` already refuses it by name for `security`: "a         │
 * │ hand-maintained exemption list … always ends up one entry stale in the     │
 * │ wrong direction."                                                          │
 * │                                                                            │
 * │ THE REASON LIVES ON THE OPERATION, NOT IN THE READER. An exemption with no │
 * │ reason beside it is indistinguishable from an oversight, and six months    │
 * │ later nobody can tell which it was.                                        │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ `exempt:` IS A PREFIX ON THE SAME SCALAR RATHER THAN A SECOND KEY. Two keys
 * (`x-capability` plus `x-capability-exempt`) admit a fourth state — both
 * present — which is a state with no meaning that some future reader has to
 * resolve. §5.5: do not make an invalid state representable.
 *
 * 🛑 AND THE GRAMMAR ADMITS `exempt:` ANYWHERE, WHICH IS WHY THE TIER TABLE
 * BELOW IS LOAD-BEARING RATHER THAN DECORATIVE. `tests/contracts/
 * capability-annotation.test.mjs` assertion 1e records the negative control
 * that found it: a capability-tier operation carrying
 * `x-capability: 'exempt: <twenty characters of plausible reasoning>'` passed
 * every other assertion in that file *"while being exactly as ungated as an
 * operation with no key at all"*. **A gate that can be opened by writing prose
 * is not a gate**, and as of this commit that sentence is enforced by a boot
 * fence in `mountTier()` as well as by an assertion.
 */

import type { JsonValue, TierName } from './document.ts'

/** The annotation key, spelled once. */
export const ANNOTATION_KEY = 'x-capability'

/** The prefix that turns the scalar from a capability into a stated exemption. */
export const EXEMPT_PREFIX = 'exempt:'

/**
 * A reason shorter than this is not a reason. Chosen so that `exempt: n/a`,
 * `exempt: TODO` and `exempt: see docs` all fail — the three things a person
 * writes when they have not made the decision the annotation is asking for.
 */
export const MIN_REASON_CHARS = 20

/**
 * One annotation, classified — WITHOUT deciding whether it is CORRECT. That is
 * the boot fences' job and the checker's job, and they want to fail on their own
 * kind rather than on a shared "it's wrong somehow".
 */
export type Annotation =
  | { readonly kind: 'capability'; readonly capability: string }
  | { readonly kind: 'exempt'; readonly reason: string }
  | { readonly kind: 'absent' }
  | { readonly kind: 'malformed'; readonly detail: string }

export function classifyAnnotation(value: JsonValue | undefined): Annotation {
  if (value === undefined || value === null) return { kind: 'absent' }
  if (typeof value !== 'string') return { kind: 'malformed', detail: `not a string: ${typeof value}` }
  const trimmed = value.trim()
  if (trimmed === '') return { kind: 'malformed', detail: 'empty string' }
  if (trimmed.startsWith(EXEMPT_PREFIX)) {
    return { kind: 'exempt', reason: trimmed.slice(EXEMPT_PREFIX.length).trim() }
  }
  return { kind: 'capability', capability: trimmed }
}

/* ==================================================================== *
 * THE GATE VERDICT — PER OPERATION, FROM THE OPERATION. G911.
 * ==================================================================== */

/**
 * 🛑 **THE OWNER'S RULING OF 20 Sep 2026, AND IT REPLACES A FILE BOUNDARY WITH
 * A PROPERTY: *"Take it — the file boundary should not carry an authorisation
 * decision. An operation's gate verdict comes from the OPERATION, not from
 * which file it sits in."***
 *
 * ⚠️ **THE OWNER TOOK IT WITH AN OBJECTION IN FRONT OF THEM AND THE OBJECTION
 * IS CARRIED HERE RATHER THAN DISCHARGED**, exactly as G781 carries its own:
 *
 *   *"It touches every mounted tier's boot path, and the split just landed on
 *   the opposite premise — so this would make `platform-console.openapi.yaml`'s
 *   existence a contract change nobody needs, argued one way today and the
 *   other way tomorrow."*
 *
 * 🛑 **THE SECOND CLAUSE IS NOT ACTED ON HERE AND MUST NOT BE READ AS ACTED ON.
 * THIS SLICE MAKES G781's SPLIT UNNECESSARY; IT DOES NOT UNDO IT.** Reversing
 * G781 is a separate ruling nobody has taken, and `platform-console.openapi.yaml`
 * is untouched by this commit. What changes is that the NEXT such split does
 * not have to happen: `administration.openapi.yaml` may now carry a capability
 * on one operation and an exemption on the next, and both are legal.
 *
 * ┌─ THE VERDICT ─────────────────────────────────────────────────────────────┐
 * │   x-capability: view_exception        → `gated`                           │
 * │   x-capability: 'exempt: <reason>'    → `exempt`                          │
 * │   absent · malformed                  → `ungoverned`                      │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * That is the whole derivation, and it is deliberately TOTAL over `Annotation`
 * rather than a pair of booleans: `ungoverned` is a THIRD state and collapsing
 * it into `exempt` is precisely the fail-open the third fence exists to refuse.
 */
export type GateVerdict = 'gated' | 'exempt' | 'ungoverned'

export function gateVerdictOf(annotation: Annotation): GateVerdict {
  switch (annotation.kind) {
    case 'capability':
      return 'gated'
    case 'exempt':
      return 'exempt'
    case 'absent':
    case 'malformed':
      return 'ungoverned'
  }
}

/* ==================================================================== *
 * WHO CALLS AN OPERATION — DERIVED, PER OPERATION, FROM ITS OWN
 * `security`. G912.
 * ==================================================================== */

/**
 * 🛑 **THIS IS WHAT REPLACES THE TIER TABLE, AND IT IS NOT THE SAME KIND OF
 * THING.** The old `TIER_REQUIRES_CAPABILITY` answered *"must every operation
 * in this FILE name a capability?"* — a VERDICT, consulted by a boot fence and
 * by two checks. This answers *"who is on the other end of this OPERATION?"* —
 * a FACT, declared in the document, per operation, with a document-level
 * fallback that `routesOf()` already reads for `secured`.
 *
 * ⚠️ **AND IT IS THE PROPERTY THE TIER TABLE WAS A PROXY FOR.** That table's
 * own entries argue in exactly these terms and nothing else: `foundation` —
 * *"every caller is the engine itself"*; `controlPlane` — *"the caller is a
 * machine"*; `dataPlaneLocal` — *"its callers are ALBs and scrapers"*;
 * `session` — *"a capability here is a verb with no noun"*; `capability` —
 * *"every operation on it has a HUMAN PRINCIPAL"*. Six paragraphs about
 * CALLERS, keyed on FILENAMES. §5.1, in the table that gates the router.
 *
 * 🛑 **WHAT IT DOES NOT DO, AND THE MEASUREMENT IS ON THIS FILE'S FACE RATHER
 * THAN LEFT TO BE DISCOVERED: it does not reproduce `TIER_REQUIRES_CAPABILITY`
 * AND IT MUST NOT BE READ AS DOING SO.** Measured over all 136 declared
 * operations on the day this landed: **64 operations state an exemption while
 * declaring a PERSON caller** — administration 45, foundation 17, session 2 —
 * so a rule *"a person's operation may not be exempt"* is a red gate, not a
 * repair. The honest statement is that the caller kind settles the
 * `gated`-side question completely (check E) and settles the `exempt`-side
 * question NOWHERE: `resolveTenantContext` is exempt, has a person caller, is
 * MOUNTED, and is right to be — *"this operation MINTS the session a
 * capability check would later be built from, so gating it on one is
 * circular"*. **No fact in the document distinguishes it from `listTenants`.**
 * That irreducible judgement is why the exemption census below exists and why
 * `servedWithoutAGate()` exists in `server/http/app.ts`.
 *
 * `mixed` and `unclassified` are REPRESENTABLE on purpose, the same polarity
 * `classifyAnnotation` takes with `malformed`: a document that grows a fifth
 * security scheme must produce a value that SAYS so, so the checker can name
 * it and the fence can refuse it, rather than being silently sorted into
 * `machine` by a default nobody wrote.
 */
export type CallerKind = 'person' | 'machine' | 'none' | 'mixed' | 'unclassified'

/**
 * Every security scheme the corpus declares, and whether its holder is a
 * PERSON. Derive the key set, never read it:
 * `grep -h -A2 'securitySchemes:' docs/contracts/*.openapi.yaml`.
 *
 * ⚠️ **THREE ENTRIES AND NOT A `Record<SchemeName, …>`, BECAUSE A SCHEME NAME
 * IS NOT A CLOSED SET IN TYPESCRIPT** — it is a key in somebody's YAML. So the
 * compile-time fence the tier table had is replaced by a RUN-TIME one that
 * fails closed: an unlisted scheme classifies `unclassified`, the checker
 * raises finding F by name, and `mountTier()` refuses to serve it. A fourth
 * scheme therefore costs an argued line here rather than passing as a machine.
 */
export const SECURITY_SCHEME_CALLER: Readonly<Record<string, 'person' | 'machine'>> = {
  /** A `tenant.session` row. The holder is a person with a browser. */
  sessionContext: 'person',
  /** AWS SigV4. The holder is a plane. */
  sigV4: 'machine',
  /** A detached payload signature, conjoined with sigV4 on one operation. */
  contentSignature: 'machine',
}

/**
 * The effective `security` of an operation → who calls it.
 *
 * ⚠️ **AN EMPTY ARRAY IS NOT ABSENCE AND THAT DISTINCTION IS `routes.ts`'s,
 * REUSED RATHER THAN RESTATED.** The caller passes the operation's own
 * `security` when it declares one and the document's otherwise — the same
 * resolution `secured` already uses — so this function takes the RESOLVED
 * requirement list and nothing else.
 *
 * 🛑 **THE TWO COMBINATORS FAIL CLOSED IN OPPOSITE DIRECTIONS, WHICH IS THE
 * ONLY WAY TO GET BOTH CHECKS RIGHT FROM ONE VALUE.** Within one requirement
 * object the schemes are conjoined (AND), so a person is involved if ANY of
 * them is a person scheme. Across requirement objects they are alternatives
 * (OR), so the answer is `person` only when EVERY alternative is one, and
 * `mixed` otherwise — which check E refuses (a gate needs a principal on every
 * path in) and which the fourth fence treats as a person (an ungated route a
 * person can reach is the thing being counted).
 */
export function callerOf(security: JsonValue | undefined): CallerKind {
  if (!Array.isArray(security) || security.length === 0) return 'none'
  const perAlternative: CallerKind[] = []
  for (const requirement of security) {
    if (typeof requirement !== 'object' || requirement === null || Array.isArray(requirement)) {
      perAlternative.push('unclassified')
      continue
    }
    const names = Object.keys(requirement)
    if (names.length === 0) {
      perAlternative.push('none')
      continue
    }
    const kinds = names.map((n) => SECURITY_SCHEME_CALLER[n])
    if (kinds.some((k) => k === undefined)) perAlternative.push('unclassified')
    else if (kinds.some((k) => k === 'person')) perAlternative.push('person')
    else perAlternative.push('machine')
  }
  if (perAlternative.includes('unclassified')) return 'unclassified'
  const distinct = new Set(perAlternative)
  if (distinct.size === 1) return [...distinct][0] as CallerKind
  return 'mixed'
}

/**
 * True where an ungated operation would be reachable by a PERSON — the one
 * condition under which serving it without a gate is a hole rather than a
 * decision somebody already argued.
 *
 * `unclassified` is in, deliberately: an unknown scheme must cost the fence
 * rather than escape it.
 */
export function callerMayBeAPerson(caller: CallerKind): boolean {
  return caller === 'person' || caller === 'mixed' || caller === 'unclassified'
}

/**
 * WHO IS ON THE OTHER END OF A PUBLIC OPERATION — D6-8, THE OWNER'S RULING OF
 * 29–30 Sep 2026, G2241–G2245.
 *
 * ⚠️ **`callerMayBeAPerson()` ABOVE IS NOT WIDENED, AND THAT IS THE RULING
 * RATHER THAN A PREFERENCE.** D6 measured that `callerOf([])` is `'none'`, so
 * the fourth fence fires on the two session operations that REQUIRE a session
 * and is SILENT on the two anyone on the internet can reach — *"the opposite of
 * what it is for"*. Adding `'none'` to that predicate was option (a) and was
 * refused: its own argument (*"an unknown scheme must cost the fence rather
 * than escape it"*) is about AUTHENTICATED callers and is correct as written,
 * and widening it changes what every one of seven tiers compels at once. **A
 * public mount is a different question and gets its own fence** —
 * `server/http/app.ts`'s seventh, acknowledged by `servedPublicly()`.
 *
 * 🛑 **THE FENCE NEEDS ONE FACT THE SECURITY SCHEME CANNOT SUPPLY, AND THIS IS
 * THAT FACT: a scheme says what a caller PRESENTS, never who they ARE.** Five
 * declared operations have no security requirement at all — derive them, never
 * read them, by running `routesOf()` over every tier and keeping
 * `caller === 'none'` — and they are two different populations wearing one
 * value:
 *
 *   `dataPlaneLocal`  `checkLocalHealth` · `checkLocalStatus` · `getLocalMetrics`
 *                     — *"the customer's own infrastructure (ALBs, Prometheus
 *                     scrapers, Datadog agents)"*, in that document's own
 *                     `info.description`, which also says it *"is never exposed
 *                     to the public internet"*. **Nobody is there to sign in.**
 *   `session`         `resolveHomeRealm` · `beginFederatedSignIn` · `completeFederatedSignIn` — a
 *                     PERSON who has not signed in YET, which is the whole
 *                     reason the operation needs no credential.
 *
 * ⚠️ **SO THIS IS KEYED ON THE TIER, AND THAT IS ARGUED AGAINST G911 RATHER
 * THAN SLIPPED PAST IT.** G911's ruling is that *"the file boundary should not
 * carry an AUTHORISATION decision."* This record authorises nothing: it is never
 * read at request time, admits no caller and opens no route — **its only effect
 * is to COMPEL A MARK AT BOOT**, so the worst a wrong entry can do is fail to
 * demand an acknowledgement. That is `EXEMPT_WITH_A_PERSON_TO_ASK`'s shape (a
 * census that decides nothing), not `TIER_REQUIRES_CAPABILITY`'s.
 *
 * 🛑 **IT FAILS CLOSED: ONE ENTRY OF EIGHT IS `infrastructure` AND EVERY OTHER
 * IS `person`.** A caller-less operation added to any other tier — or an eighth
 * tier, which is a `TS2741` at this literal — demands `servedPublicly()` before
 * it can boot. Moving a tier to `infrastructure` is a line in a diff somebody
 * has to argue, exactly like a non-zero above.
 *
 * ⚠️ **AND `dataPlaneLocal`'s ANSWER IS HELD IN A SECOND PLACE, NOT ONLY
 * ASSERTED HERE.** `EDGE_PLANE_PATH_PATTERNS` (`infra/lib/config.ts`) publishes
 * `/v1/*`, `/context/*`, `/session` and `/session/*` and nothing else, and
 * `assertPublishesNoLocalOperation()` in the same file throws at synth on a
 * pattern that would publish a local operation — so a person on the internet
 * is not routed to `/health` at all.
 * **The limit, named:** a person who can reach the plane's listener directly
 * can send `/health` bytes. They are not who it is FOR, and it answers
 * `{ "status": "ok" }` to whoever asks; that is the population this entry
 * describes, and a fence on intent cannot be a fence on reachability.
 */
export type PublicAudience = 'person' | 'infrastructure'

export const PUBLIC_OPERATION_AUDIENCE: Readonly<Record<TierName, PublicAudience>> = {
  capability: 'person',
  platformConsole: 'person',
  foundation: 'person',
  /** `resolveHomeRealm`, `beginFederatedSignIn` (G2541) and `completeFederatedSignIn` — a person who has not signed in yet. */
  session: 'person',
  administration: 'person',
  /** No caller-less operation today; every caller is sigV4. Fails closed. */
  controlPlane: 'person',
  /** ALBs, readiness probes and scrapers inside the customer's VPC. See above. */
  dataPlaneLocal: 'infrastructure',
  /** Not a tier: `paths: {}`. The record is total, so it gets the closed answer. */
  errors: 'person',
}

/**
 * True where an operation requires NO credential of any kind AND its tier says
 * a person may be the one calling — the condition under which the seventh
 * fence compels `servedPublicly()`.
 */
export function publicOperationFacesAPerson(tier: TierName, caller: CallerKind): boolean {
  return caller === 'none' && PUBLIC_OPERATION_AUDIENCE[tier] === 'person'
}

/**
 * THE EXEMPTION CENSUS — WHAT THE TIER BOOLEAN BECAME, AND WHY IT IS NOT AN
 * AUTHORISATION DECISION ANY MORE. G913.
 *
 * ⛔ **`TIER_REQUIRES_CAPABILITY` IS RETIRED — NOT KEPT AS A DEFAULT — AND THE
 * REASON IS THAT THERE IS NO THIRD READING OF "DEFAULT".** A default no
 * operation may override is the file boundary wearing a new word, which is the
 * thing the owner ruled against. A default an operation MAY override toward
 * `exempt` is the fail-open: it converts `mountTier()`'s fourth fence — today
 * a refusal nothing in the corpus can talk its way past — into one line of
 * YAML. Keeping it would be the ruling recorded as taken and not taken.
 *
 * 🛑 **AND THE OLD VERDICT WAS BADLY DISTRIBUTED, WHICH IS THE ARGUMENT FOR
 * MOVING THE SCRUTINY RATHER THAN MERELY RELOCATING IT. Measured on the tree
 * the day this landed: the `true` tiers hold ZERO exemptions between them (0 of
 * 39 on `capability`, 0 of 14 on `platformConsole`), and the `false` tiers hold
 * 83, of which 64 have a PERSON on the other end.** So check D refused
 * something that never happened and was silent about every instance of the
 * thing it was written to prevent — `server/contract/capability.ts`'s own
 * `administration` entry says so in capitals, and
 * `tests/http/administration-tier-unmounted.test.ts` §3b measures the 200.
 *
 * 🟢 **WHAT THIS RECORD IS: A MEASUREMENT WITH A PIN.** It decides nothing at
 * boot and nothing at request time — `grep -rn 'EXEMPT_WITH_A_PERSON_TO_ASK'
 * server/http/` returns nothing — so the file boundary carries no authorisation
 * decision, which is the ruling. What it does is make the POPULATION of
 * person-facing exemptions a number the gate recomputes on every run, so that
 * adding one anywhere is a red stage and a line in a diff somebody has to
 * argue. The two zeros are check D's content, preserved exactly; the three
 * non-zeros are scrutiny those operations have never had.
 *
 * ⚠️ **IT IS STILL A `Record<TierName, …>`, AND THAT IS ON PURPOSE**: an eighth
 * tier is a `TS2741` at this literal, which is the property
 * `server/contract/document.ts` advertises and which retiring the old table
 * would otherwise have deleted. A tier arriving costs a counted, argued entry —
 * and, unlike the old table, an entry that grants nothing.
 */
export const EXEMPT_WITH_A_PERSON_TO_ASK: Readonly<Record<TierName, number>> = {
  /**
   * 0 of 39. Every operation names a capability, which is the tier's defining
   * property and was `TIER_REQUIRES_CAPABILITY.capability = true`'s whole
   * content. **A non-zero here is the defect the fourth fence used to make
   * unrepresentable**, and it is now a red gate stage instead.
   */
  capability: 0,
  /**
   * 0 of 14. G781's tier, and the reason it exists. ⚠️ **AFTER THIS SLICE THE
   * SPLIT IS NO LONGER NECESSARY TO HOLD THIS ZERO** — these fourteen could sit
   * in `administration.openapi.yaml` and keep every verb — **and the document
   * is NOT un-split here**, because that is a separate ruling and a concurrent
   * agent is adding an operation to it.
   */
  platformConsole: 0,
  /**
   * 17 of 17, every one a person by `sessionContext` and every one exempt.
   * The tier's argument is that the caller is the ENGINE rather than the
   * browser holding that session — a claim the document cannot express and
   * this record cannot check. `resolveTenantContext` is the mounted one, and
   * it is the case that proves no derivation can settle this: its exemption is
   * CIRCULARITY, and circularity is not a fact about a security scheme.
   */
  foundation: 17,
  /**
   * 3 of 7. `getSession`, `signOut` and — since 3 Oct 2026, G3354 —
   * `getSessionPrincipal` override the document's `security: []` with
   * `sessionContext`; the other four run before authentication and have no
   * caller at all. #230: *"a capability here is a verb with no noun."*
   * ⚠️ THIS SAID `2 of 4` AND THE `4` WAS ALREADY THREE BEHIND (the sign-in
   * operations of G2490/G2541/G2549); the `2` was right until this commit.
   */
  session: 3,
  /**
   * 42 of 45 — **and the three that left are the first operations this tier has
   * ever had that do NOT need the sentence below. R8, 21 Sep 2026, THE
   * OWNER'S.**
   *
   * ⚠️ **THIS SAID `45 of 45` AND *"Nothing is mounted"* UNTIL 21 Sep 2026.
   * BOTH WENT FALSE IN THE SAME COMMIT AND THEY ARE CORRECTED RATHER THAN
   * DELETED**, because the paragraph is the best statement in this file of what
   * a person-facing exemption costs, and because *"Nothing is mounted"* is the
   * clause a reader would have quoted onward. **It read:**
   *
   *     "45 of 45 — the entry that is uncomfortable, and it is uncomfortable
   *      in the same words the retired table used. On this tier the caller is
   *      a person with an ordinary `tenant.session` row, so every one of these
   *      45 is an operation that would serve ungated if it were mounted.
   *      **Nothing is mounted**, and after this slice mounting one is a BOOT
   *      FAILURE rather than a 200: the fourth fence now demands
   *      `servedWithoutAGate()` at the mount. That is the one thing this slice
   *      makes strictly stronger."
   *
   * 🛑 **EVERY WORD OF THAT IS STILL TRUE OF THE REMAINING 42.** What changed
   * is that `listOnboardingSteps`, `completeOnboardingStep` and
   * `forceOnboardingStep` stopped being exemptions at all: R8 annotates them
   * `view_substrate` in place, so they are GATED, and a gated operation is not
   * in this census's population by construction.
   *
   * 🟢 **AND THEY ARE MOUNTED — WHICH IS THE PREDICTION IN THAT LAST SENTENCE
   * BEING TESTED RATHER THAN ESCAPED.** The three mounts do not take the
   * `servedWithoutAGate()` route the retired text describes; they take the
   * other one it offers — *"or give the operation a capability in the
   * contract"* — so the fourth fence never sees them and the **sixth** does
   * instead. `tests/http/onboarding-console-served.test.ts` §4 witnesses that
   * sixth fence refusing a bare handler for each of the three operationIds.
   * **This slice adds no ungated mount.** Derive the count, never read it —
   * key on the CALL SYNTAX, not on the name:
   *
   *     grep -rnE ': *servedWithoutAGate\(' server --include start.ts    # 2
   *
   * 🛑 **THIS SENTENCE SAID *"unchanged at ONE"* UNTIL 23 Sep 2026 AND THE
   * TREE HELD TWO, AND IT IS CORRECTED RATHER THAN DELETED BECAUSE IT IS THE
   * NUMBER A SECURITY REVIEWER WOULD HAVE QUOTED** — this entry is the census
   * of routes that serve with no gate. The second is `resolveHomeRealm`,
   * mounted under G1941 on 22 Sep 2026. **`server/http/app.ts` §0 has said
   * *"There are TWO from 22 Sep 2026"* since that commit: two files, two
   * numbers, one tree, for a day.**
   *
   * ⚠️ **AND THE DERIVATION THAT STOOD HERE IS WHY THEY COULD DISAGREE.** A
   * recursive grep for the bare name over `server/` answers **28** at this
   * commit against **2** calls — 26 of the 28 are PROSE, six of them in this
   * file — and it would answer in double figures if this function had never
   * been called once. `app.ts` diagnosed that on 22 Sep, wrote the anchored
   * form above, and **never propagated it one file over**; the `: *` before
   * the name is what excludes every quotation, because no sentence writes a
   * colon there. *Corrected 23 Sep 2026 — G2084.*
   *
   * ✅ **AND NINE MORE LEFT ON 1 Oct 2026 — W5, G2633–G2640: 42 → 33.** The
   * partner portal's nine `partner-portal-role` operations R10 minted verbs for
   * are annotated in place with those verbs — `view_deals`, `register_deal`,
   * `view_sandbox`, `operate_sandbox`, `view_partner_staff`,
   * `manage_partner_staff` — the way R8 annotated the onboarding three, so all
   * nine are GATED and leave this census by construction. FIVE are mounted
   * (`listDealRegistrations`, `submitDealRegistration`, `getSandboxTenant`,
   * `requestSandboxTenant`, `listPartnerPeople`) and take the sixth fence, not
   * the fourth; FOUR are annotated and unmounted, each for a reason named at
   * the mount in `server/data-plane/start.ts`. **This adds no ungated mount**:
   * the anchored grep above still answers 2.
   */
  administration: 33,
  /** 0 of 18 — every caller is sigV4, a machine. ⚠️ 0 of 14 until G4301 added the four internal operations (5 Oct 2026). */
  controlPlane: 0,
  /** 0 of 3 — no security requirement at all; there is no caller to ask. */
  dataPlaneLocal: 0,
  /** Not a tier: `paths: {}`. The record is total, so it gets a zero. */
  errors: 0,
}

/**
 * ⛔ **THE RETIRED TABLE IS QUOTED HERE RATHER THAN DELETED, BECAUSE ITS
 * SEVEN ENTRIES ARE THE BEST DESCRIPTION IN THIS REPOSITORY OF WHO CALLS EACH
 * TIER, AND BECAUSE FOUR DOCUMENTS AND NINE TEST FILES CITE IT BY NAME.**
 * Its values were, on the day it was retired:
 *
 *     capability: true · platformConsole: true · foundation: false
 *     controlPlane: false · dataPlaneLocal: false · session: false
 *     administration: false · errors: false
 *
 * **Every one of those eight is still TRUE AS A DESCRIPTION** — the corpus is
 * partitioned exactly that way, measured — and none of them is consulted by
 * anything any more. The `true`s are `EXEMPT_WITH_A_PERSON_TO_ASK`'s two
 * zeros; the `false`s are `SECURITY_SCHEME_CALLER` plus the three non-zeros
 * above. **What is gone is the implication that a FILE settles it.**
 *
 * 🛑 **AND THE ADMINISTRATION ENTRY'S OWN CLOSING SENTENCE IS THE ONE TO CARRY
 * FORWARD, VERBATIM, BECAUSE IT IS STILL EXACTLY TRUE AND IS NOW ENFORCED
 * RATHER THAN NARRATED:** *"ON THIS TIER, AND ONLY ON THIS TIER, `false` MEANS
 * THAT A MOUNTED OPERATION IS SERVED TO ANY AUTHENTICATED CALLER WITH NO GATE
 * AND NO INVARIANT 10 RECORD."* It named two mechanisms — the `preValidation`
 * hook's first-line return, and the sixth fence keying on
 * `capability.kind === 'capability'` — and said of the second: *"The fourth
 * fence is what keeps that shut on the capability tier. **There is no fence
 * keeping it shut here.**"* There is one now, on every tier at once, and it is
 * `servedWithoutAGate()`.
 */

/**
 * THE TWO TIERS THAT MUST CARRY A REAL CAPABILITY, AND THE FIVE THAT MUST NOT.
 *
 * ⛔ **SUPERSEDED 20 Sep 2026 UNDER G911–G913 AND KEPT AS THE HISTORY IT IS.
 * THE TABLE THIS HEADING INTRODUCED NO LONGER EXISTS; THE ARGUMENT BELOW IS
 * WHY EACH TIER'S CALLERS ARE WHAT THEY ARE, AND THAT ARGUMENT IS UNCHANGED
 * AND STILL THE BEST ACCOUNT OF IT.** Read it as documentation of the CORPUS,
 * never as a verdict a fence consults — and note that its `administration`
 * entry is where this slice's own premise comes from.
 *
 * ⚠️ THIS HEADING SAID *THE ONE TIER … AND THE FIVE* UNTIL 19 Sep 2026, and
 * before that *FOUR*, when G533 registered the administration tier. **The
 * second `true` is `platformConsole`, and it is the first time this table has
 * had more than one.** Read its entry before treating the two as a pair: the
 * `capability` tier is `true` because its caller is a customer operator with a
 * `RoleAssignment`; `platformConsole` is `true` because its caller is a staff
 * person with a `PlatformRoleAssignment`, which is a different instrument
 * evaluated by a different arm of the same `decide()`.
 *
 * ⚠️ AND THE FIFTH `false` IS STILL NOT THE SAME SHAPE AS THE OTHER FOUR — the
 * `administration` entry below says so at length, and the split made its claim
 * NARROWER rather than retiring it. Read it before treating this table as five
 * instances of one rule.
 *
 * This is a property of the TIER rather than of the operation — which is why it
 * can be stated once here rather than repeated 136 times in YAML. ⚠️ **That
 * figure said 76 until 19 Sep 2026; derive it, never read it:**
 * `grep -c 'operationId:' docs/contracts/*.openapi.yaml`.
 *
 * `capability` — the only tier a customer's browser meets. Every operation on it
 * has a HUMAN PRINCIPAL, so every operation on it has a capability.
 *
 * `foundation` — no operation has a human principal; every caller is the engine
 * itself, and `AUTHORIZATION_MAY_BE_ABSENT` admits exactly one actor kind,
 * `system`. ⚠️ The tier declares `security: [sessionContext]` at document level,
 * so the security scheme CANNOT be used to derive this and the tier name is
 * used instead.
 *
 * `controlPlane` — `security: [sigV4]`. The caller is a machine. `decide()`
 * would refuse at the subject-status branch before reaching any capability, and
 * `server/control-plane/authorise.ts` turns this `false` into a boot failure
 * rather than a comment.
 *
 * `dataPlaneLocal` — declares no `security` at all. Its callers are ALBs and
 * scrapers inside the customer's own VPC; a capability here would require a
 * session those callers structurally cannot have.
 *
 * `session` — `security: []` at document level. Two of its four operations run
 * BEFORE authentication and the other two address only the caller's own row, so
 * there is no tenant for `decide()` to evaluate a capability in. #230: "a
 * capability here is a verb with no noun."
 *
 * `platformConsole` — 🛑 **`true`, AND IT IS THE SECOND ONE. G781, 19 Sep
 * 2026, applying the owner's split ruling of the same day.**
 *
 * The test this table applies is *"is there a human principal `decide()` can
 * evaluate?"*, and here the answer is yes on both halves for the first time
 * outside the `capability` tier. The caller is a staff person; `decide()`'s
 * FOURTH arm (G289) evaluates them against a `PlatformRoleAssignment` through
 * `PLATFORM_ASSIGNMENT_REACHES`; and every one of the fourteen operations
 * names a capability in one of the three classes that arm opens — `substrate`,
 * `catalogue`, `commercial`. **So `true` here is not a stricter gate imposed
 * on an unwilling tier; it is the only verdict that is true of it.**
 *
 * 🛑 **A NAME IS NOT A GATE, AND THE CONTROL THAT MAKES THE DIFFERENCE IS NOT
 * IN THIS FILE.** `tools/check-capability-annotations.mjs` reads the GRAMMAR
 * and the TIER and says so in its own output — it *"does not resolve an
 * annotation against `CAPABILITIES`, does not read `CAPABILITY_RESOURCE_CLASS`"*.
 * An operation here annotated `view_audit` would therefore pass every check in
 * the gate while being UNREACHABLE rather than gated, because the platform arm
 * refuses `tenant_data` categorically. That join —
 * `x-capability` → `CAPABILITY_RESOURCE_CLASS` → `PLATFORM_ASSIGNMENT_REACHES`
 * — is derived over all fourteen in
 * `tests/contracts/platform-console-reachability.test.mjs`, and it is what
 * keeps this `true` from being §5.6.
 *
 * ⚠️ **WHAT NEITHER CONTROL CAN SEE IS MODE, AND ONE OPERATION WAS LEFT OUT OF
 * THIS TIER BECAUSE OF IT.** Nothing in `model/` records whether a capability
 * is a read or a write, so nothing can catch a POST annotated with a `view_`
 * verb. `raiseAdjustment` is exactly that shape — `commercial` is open but has
 * no write verb, and `model/access.ts` records that *"the absence of a write
 * verb on commercial is scope rather than principle"* — so it stayed on the
 * administration tier and that suite holds a tripwire requiring its absence
 * here. Minting `write_commercial` is an owner's ruling.
 *
 * 🛑 **AND `true` DOES NOT MOUNT ANYTHING.** `mountTier()`'s SIXTH FENCE
 * refuses to boot a gated operation whose handler mints no invariant 10
 * record, and `AuthorizationGrant extends TenantScoped` — a platform principal
 * acting on the fleet has no tenant for that record to live in. That is G728's
 * finding from the console-session side, and it blocks every one of these
 * fourteen. Nobody holds any of the six verbs either: nothing has ever written
 * a `tenant.platform_role_assignment` row.
 *
 * `administration` — 🛑 **`false`, AND IT IS STILL THE ENTRY IN THIS TABLE
 * WHOSE VERDICT IS UNCOMFORTABLE. G533, 19 Sep 2026, NARROWED BY THE SPLIT OF
 * THE SAME DAY. Read the whole entry before mounting anything on this tier.**
 *
 * ⚠️ **THE SPLIT DISCHARGED PART OF THIS ENTRY AND LEFT THE REST EXACTLY AS
 * IT WAS.** Fourteen operations moved to `platformConsole` above, so the
 * figures below — 59 operations, 26 with an evaluator — are HISTORY and are
 * kept as the argument they are. **45 operations remain here and all 45 still
 * state an exemption**, for the three reasons G602 enumerated and one more the
 * split measured: `partner-arrangement` (15) and `partner-portal-role` (9)
 * are unchanged, `tenant-access-grant` (9) is unchanged, and **twelve of the
 * twenty-six `platform-role` operations could not move** because the class
 * they act on is one the platform arm refuses, or because `commercial` has no
 * write verb. Derive it, never read it:
 * `grep -c 'x-admin-authority: platform-role' docs/contracts/administration.openapi.yaml`.
 * **The all-or-nothing property G602 names is unchanged for what is left.**
 *
 * The four `false`s above are all the same shape: there is no human principal
 * (`foundation`, `controlPlane`, `dataPlaneLocal`) or there is no tenant to
 * evaluate one in (`session`). **Neither is true here.** The staff console and
 * the partner portal declare `security: [sessionContext]` at document level;
 * every caller is a person; and nine of the fifty-nine operations name a tenant
 * in the path. So this `false` is not "no principal" — it is **"a principal
 * `decide()` has nothing to say about"**, which is a different and weaker
 * claim, and it is written out here rather than absorbed into the pattern.
 *
 * ⚠️ **G288's OWN ARGUMENT FOR THIS VERDICT HAS A STALE PREMISE, AND IT IS
 * CORRECTED HERE RATHER THAN QUOTED ONWARD.** That document's §2 reads the
 * verdict off a `decide()` that no longer exists:
 *
 *     if (principal.orgClass === ORG_CLASSES.platform) {
 *       return deny(DECISION_REASONS.platform_org_holds_no_assignment)
 *     }
 *
 * **G289 replaced exactly that branch on the same day.** `decide()` now has a
 * FOURTH arm: a platform principal is evaluated against a
 * `PlatformRoleAssignment` through `PLATFORM_ASSIGNMENT_REACHES`, and
 * `db/migrations/0009_identity_substrate.sql` gives that term three tables and
 * `server/data-plane/identity.ts` a reader. Derive it, never read it:
 * `grep -n 'platform_org_holds_no_assignment' model/access.ts` and
 * `grep -n 'PLATFORM_ASSIGNMENT_REACHES' model/access.ts`.
 *
 * 🟢 **THE VERDICT SURVIVES THE CORRECTION AND STANDS ON NARROWER GROUND: the
 * classes these operations act on have no capability to name.** Twelve of
 * `PLATFORM_ASSIGNMENT_REACHES`'s thirteen classes are `false`, and the two
 * that most of this tier acts on — `substrate` (the plane a tenant runs on and
 * its licence to run) and `catalogue` — are the two `model/governance.ts`
 * documents as having **NO capability by statement rather than by omission**:
 * a platform release reaches them and a grant does not, and a capability is the
 * currency of grants. Creating a tenant, publishing a pack and scoping resale
 * are acts on those classes. **There is no verb to write, so `true` would not
 * be a stricter gate — it would be a demand that 59 operations name capabilities
 * that do not exist.**
 *
 * 🛑 **AND NOW THE COST, STATED PLAINLY BECAUSE `false` HERE IS NOT FREE AND NO
 * DOCUMENT SAID SO: ON THIS TIER, AND ONLY ON THIS TIER, `false` MEANS THAT A
 * MOUNTED OPERATION IS SERVED TO ANY AUTHENTICATED CALLER WITH NO GATE AND NO
 * INVARIANT 10 RECORD.** Both halves are mechanical and neither is a judgement:
 *
 *   · `server/http/app.ts`'s `preValidation` hook returns at its FIRST LINE
 *     when the route carries no capability, so an `exempt:` operation is one
 *     the gate never touches. On the other four `false` tiers that is harmless
 *     because their callers are machines, are inside the VPC, or hold no
 *     session at all. Here the caller is a customer operator with a live
 *     `tenant.session` row — and `GET /v1/staff/tenants` would answer them.
 *   · `mountTier()`'s SIXTH FENCE keys on `capability.kind === 'capability'`,
 *     and its own docblock names this hole: *"an operation that buys its way
 *     out with prose buys its way out of the record too."* The fourth fence is
 *     what keeps that shut on the capability tier. **There is no fence keeping
 *     it shut here.**
 *
 * **That is why this entry is `false` AND why nothing on this tier is mounted.
 * The two are one decision, not two.** `tests/http/administration-tier-unmounted.test.ts`
 * MEASURES both halves against a real `buildPlane()` rather than describing
 * them, and its §3 is the ungated 200 itself — witnessed, so that the cost of
 * this verdict is a number somebody can look at rather than a paragraph
 * somebody wrote.
 *
 * 🛑 **WHAT WOULD CHANGE THIS ENTRY, so the next reader does not re-derive it.**
 *
 * ⚠️ **THE PARAGRAPH BELOW IS QUOTED RATHER THAN DELETED AND MOST OF IT WENT
 * FALSE ON 19 Sep 2026 — G601 AND G602 — BUT ITS CONCLUSION DID NOT, WHICH IS
 * WHY THIS ENTRY IS STILL `false`.** What changed: `decide()`'s platform arm
 * now opens **THREE** classes, not one — `commercial`, `substrate` and
 * `catalogue` — and H1 and H2 act squarely on the last two, so *"nothing in H1
 * or H2 is commercial"* is no longer the reason. Five capabilities point there
 * (`view_substrate`, `provision_substrate`, `view_catalogue`,
 * `author_catalogue`, `publish_catalogue`), none of which any tenant principal
 * may hold. **And `platform-role` did not "not exist": G289's arm and
 * `db/migrations/0009`'s three tables were already here on the day that
 * sentence was written.** Derive both:
 * `grep -n 'PLATFORM_ONLY_RESOURCE_CLASSES' model/access.ts` and
 * `grep -c 'CREATE TABLE tenant.platform_role' db/migrations/0009_identity_substrate.sql`.
 *
 * 🛑 **SO WHY IS THIS STILL `false`? BECAUSE THE VERDICT IS PER TIER AND A TIER
 * IS A FILE — G602.** `tools/check-capability-annotations.mjs` refuses an
 * `exempt:` on a `true` tier (check D) and a capability on a `false` tier
 * (check E), so **this one boolean is all-or-nothing over all fifty-nine
 * operations.** Measured, not reasoned: flipping it to `true` on this tree
 * makes the checker print *"59 operation(s) on a tier whose
 * TIER_REQUIRES_CAPABILITY is `true` carry a stated EXEMPTION"* — **fifty-nine,
 * not the thirty-three that still have no evaluator.** Of the four
 * `x-admin-authority` evaluators, exactly one can name a capability today:
 * `platform-role` (26, since G601). `tenant-access-grant` (9) cannot — those
 * acts are `configuration`, reached under a `TenantAccessGrant` and evaluated
 * by `authorisationPermits()`, which `decide()` does not consult.
 * `partner-arrangement` (15) cannot — the partner arm needs a grant into a
 * customer tenant and this document reads none. `partner-portal-role` (9)
 * cannot — **the principal does not exist in `model/`**, and that is the one
 * clause of the original paragraph that survives intact.
 *
 * ✅ **AND THAT CLAUSE WENT FALSE ON 1 Oct 2026 — R10, THE OWNER'S.** The
 * principal exists: `model/access.ts` §6c (`PartnerRole`,
 * `PartnerRoleAssignment`), `decide()`'s FIFTH arm, and six verbs on three
 * partner-only classes. **The operations are STILL all `exempt:`** — eight of
 * the nine now have a verb whose name fits and every one is TABLE-BLOCKED (no
 * deal, sandbox or invitation table; the roster unreadable under G447), so
 * G300's three-part test stops at the table, and each exemption was rewritten
 * to say so.
 * `tests/contracts/administration-evaluators.test.mjs` is the measurement.
 *
 * **THE ORIGINAL PARAGRAPH FOLLOWS, UNCHANGED.**
 *
 * Not a capability on a staff operation — `decide()`'s platform arm opens
 * exactly one class, `commercial`, and nothing in H1 or H2 is commercial. The
 * thing that would is an **authorisation mechanism for a platform principal
 * with no tenant**, which G288 names as owed and larger than its own file:
 * *"`S1` draws three staff roles with different destinations; `model/access.ts`
 * cannot represent one, because `ORG_CLASSES.platform` holds no
 * `RoleAssignment` by law. That is a ruling somebody owes."* `x-admin-authority`
 * says per operation which of four evaluators applies; **two of the four
 * (`platform-role`, 26 operations, and `partner-portal-role`, 9) do not exist
 * in `model/` at all.** Derive the split:
 * `grep -c 'x-admin-authority: platform-role' docs/contracts/administration.openapi.yaml`.
 *
 * `errors` — NOT A TIER. It declares `paths: {}` and no operation at all. It has
 * an entry because the record below is TOTAL, and that is the improvement this
 * move buys.
 *
 * 🛑 WHY THE TOTAL `Record` IS THE POINT, AND WHAT IT REPLACES. The `.mjs`
 * version of this table was a bare object literal, and
 * `TIER_REQUIRES_CAPABILITY['session']` was `undefined` — falsy — for as long as
 * the session tier existed unclassified, so *"every operation on a tier nobody
 * had classified would have landed in EXEMPTED and been excused BY AN OVERSIGHT
 * RATHER THAN BY A DECISION"*. That hole was closed by a run-time guard
 * (`tiersWithoutACapabilityVerdict()`), which is a check somebody had to
 * remember to call. Here it is a `Record<TierName, boolean>` over the key set
 * `server/contract/document.ts` declares, so a seventh tier is a **TS2741 at
 * this literal** — the discipline CLAUDE.md states for
 * `CAPABILITY_RESOURCE_CLASS`, applied to the tier axis. ✅ **AND IT BIT
 * EXACTLY AS PREDICTED ON 19 Sep 2026**: G533 added `administration` to
 * `TIERS` and `tsc` refused this literal until the entry above it was written,
 * which is the first time this fence has fired on a real sixth tier rather
 * than in a paragraph about one. The run-time guard survives in the checker anyway,
 * because `tools/` is `.mjs` and gets no compiler.
 */
/*
 * ⛔ `export const TIER_REQUIRES_CAPABILITY: Readonly<Record<TierName, boolean>>`
 *    STOOD HERE UNTIL 20 Sep 2026 AND IS RETIRED UNDER G913. Its values are
 *    quoted above, beside `EXEMPT_WITH_A_PERSON_TO_ASK`, which is what a
 *    reader looking for them wants. It is DELETED rather than deprecated in
 *    place because a constant with no reader is `db/migrations/0004`'s refusal
 *    one directory over — a privilege ahead of its writer — and because the
 *    one thing worse than a verdict in the wrong place is a stale verdict
 *    somebody can still import.
 */
