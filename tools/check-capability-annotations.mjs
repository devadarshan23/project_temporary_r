#!/usr/bin/env node
/**
 * check-capability-annotations — G200's boot fences, applied to the 72
 * operations no plane mounts.
 *
 * ┌─ THIS FILE IS A PROMOTION, AND THE SENTENCE THAT BLOCKED IT IS QUOTED ─────┐
 * │ It was `tests/contracts/annotations.mjs`, and its header read:             │
 * │                                                                            │
 * │   "This is not a checker and it is deliberately not in `tools/`. Nothing   │
 * │    in `npm run check` calls it; `tools/` takes a checker when the gate it  │
 * │    checks exists, and today the gate does not."                            │
 * │                                                                            │
 * │ THE GATE LANDED ON 19 Sep 2026 and that is the event the sentence named:   │
 * │ `server/http/app.ts` registers a `preValidation` hook, and `mountTier()`   │
 * │ refuses to boot over an absent, malformed or exempt-on-a-gated-tier        │
 * │ annotation. So the module moves here, in the same commit, and becomes the  │
 * │ checker it was waiting to be allowed to be.                                │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 **20 Sep 2026 — G911/G912/G913. CHECKS D AND E ARE RE-FOUNDED PER
 * OPERATION AND NEITHER READS A TIER ANY MORE, AND THAT IS THE WHOLE OF WHAT
 * CHANGED HERE.** `TIER_REQUIRES_CAPABILITY` is retired; the imports above are
 * its replacements. The letters D and E are DELIBERATELY NOT RENUMBERED — four
 * documents and nine test files cite them by letter, and each still answers the
 * question its letter answered:
 *
 *   · **D** was *"a gated tier bought out with a reason"* and is now the
 *     PERSON-FACING EXEMPTION CENSUS. Same content on the two tiers it used to
 *     govern (both pinned at zero), and it now also counts the 64 it was blind
 *     to. **It is a measurement with a pin rather than a rule, because there is
 *     no rule** — `resolveTenantContext` is exempt, person-facing, mounted, and
 *     correct, and nothing in a document distinguishes it from `listTenants`.
 *   · **E** was *"a capability off the tier that has a principal"* and is now
 *     *"a capability with no caller to ask about"*. Its old message argued
 *     entirely about the CALLER and keyed entirely on the FILENAME — §5.1,
 *     inside the checker written to catch §5.1. The argument is unchanged; the
 *     key is `callerOf(operation.security ?? document.security)`.
 *   · **F** is new: a security scheme nobody has classified. It is the
 *     fail-closed half of deriving a caller from a name in somebody's YAML.
 *
 * ⚠️ **AND ONE THING IS NOW WEAKER HERE AND STRONGER IN THE SERVER, WHICH IS
 * SAID PLAINLY RATHER THAN LEFT TO BE FOUND.** An `exempt:` on an UNMOUNTED
 * capability-tier operation used to be a hard finding and is now a census
 * movement — still a red stage, but one a person can sweep by editing a number
 * with an argument, where before it was unrepresentable. What is stronger is at
 * the MOUNT: `mountTier()`'s fourth fence now refuses to SERVE any
 * person-facing exemption unmarked, on every tier, where before it refused only
 * on the two tiers that had none. **The scrutiny moved to where the risk is,
 * and a checker cannot see a mount.**
 *
 * 🛑 WHAT IT ADDS THAT THE SERVER CANNOT, AND IT IS NOT A DUPLICATE OF IT.
 * `mountTier()`'s fences see the MOUNTED set — four operations; derive them
 * with `grep -n 'handlers: {' over both `start.ts` files, which is the whole
 * truth of it. This walks EVERY tier and applies the same refusals to all 76 declared
 * operations, with the same `classifyAnnotation()` and the same
 * `TIER_REQUIRES_CAPABILITY`, imported from `server/contract/capability.ts`
 * rather than restated. Neither control replaces the other: a checker cannot see
 * a plane, and a plane cannot see an operation nobody mounts. What would be
 * §5.6 is a checker holding its OWN copy of the grammar, which is why it holds
 * none.
 *
 * ⚠️ WHAT IT DELIBERATELY DOES NOT CHECK, AND WHERE THAT LIVES INSTEAD. It does
 * not resolve an annotation against `CAPABILITIES`, does not read
 * `CAPABILITY_RESOURCE_CLASS`, does not reason about `PARTNER_CAPABILITY_MASK`
 * and does not ask whether an operation declares a 403. All four are
 * MODEL-SIDE questions and all four are asserted, with their arguments, in
 * `tests/contracts/capability-annotation.test.mjs`, which imports this file's
 * `declaredOperations()` so the two cannot disagree about what an operation is.
 * Keeping them there keeps this checker's import graph at two `server/` modules
 * and nothing else, which is what makes it fast enough for G108 — measured
 * below — and keeps `model/` out of a gate stage that would then fail for
 * reasons that are not about annotations.
 *
 * G108's condition, met rather than asserted: DETERMINISTIC — it reads five
 * files through `loadTier()`, touches no network, no clock and no git — and
 * FAST: three consecutive runs at ~0.20s wall with byte-identical output.
 *
 * ⚠️ VERIFIED RED FIRST, WHICH IS THE CONDITION CLAUDE.md PUTS ON EVERY CHECKER
 * ADDED TO THE GATE. Four mutations, each reverted:
 *   · `x-capability` deleted from `getRun`            → A fires, exit 1
 *   · `x-capability: 'exempt: <25 chars>'` on `getRun` → D fires, exit 1
 *   · `x-capability: 'exempt: n/a'` on `checkLocalHealth` → B fires, exit 1
 *   · `x-capability: 12` on `getRun`                  → C fires, exit 1
 * A checker added to the gate without a demonstrated red is §5.6 wearing a
 * different hat.
 *
 *   node tools/check-capability-annotations.mjs   report; exit 1 on any finding
 */

import { realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { TIERS, loadTier } from '../server/contract/document.ts'
import { OPERATION_KEYS } from '../server/contract/routes.ts'
import {
  ANNOTATION_KEY,
  EXEMPT_PREFIX,
  EXEMPT_WITH_A_PERSON_TO_ASK,
  MIN_REASON_CHARS,
  SECURITY_SCHEME_CALLER,
  callerMayBeAPerson,
  callerOf,
  classifyAnnotation,
  gateVerdictOf,
} from '../server/contract/capability.ts'

/**
 * ⚠️ RE-EXPORTED RATHER THAN RE-DECLARED. The grammar lives in
 * `server/contract/capability.ts` — one definition, read by the router, by this
 * checker and by the suite — and these names are forwarded so that
 * `tests/contracts/capability-annotation.test.mjs` keeps reading exactly what
 * the server boots through. Its header's own argument, unchanged by the move:
 * "the single definition of what an annotation IS, so that the contract-side
 * assertions and the role-side assertions cannot disagree about what they are
 * reading."
 */
export {
  ANNOTATION_KEY,
  EXEMPT_PREFIX,
  EXEMPT_WITH_A_PERSON_TO_ASK,
  MIN_REASON_CHARS,
  SECURITY_SCHEME_CALLER,
  callerMayBeAPerson,
  callerOf,
  classifyAnnotation,
  gateVerdictOf,
}

/** The partner-exposure key, spelled once. See the suite's assertion group E. */
export const PARTNER_EXPOSURE_KEY = 'x-partner-exposure'

/** The prefix that turns that scalar into a written acceptance of partner reach. */
export const ACCEPTED_PREFIX = 'accepted:'

/**
 * The five tiers, minus `errors` which is a schema file and declares no
 * operation. Derived from `server/contract/document.ts`'s own `TIERS` so that a
 * sixth contract file cannot be invisible here.
 *
 * ✅ THAT SENTENCE WAS TESTED RATHER THAN TRUSTED, AND IT HELD. `session`
 * arrived in `TIERS` and every operation on it entered `OPS` with no edit — which
 * is the whole argument for deriving the list.
 */
export const OPERATION_TIERS = Object.keys(TIERS).filter((t) => t !== 'errors')

/**
 * Every tier that declares operations must appear in the exemption census.
 *
 * ⚠️ **THIS WAS `tiersWithoutACapabilityVerdict()` UNTIL 20 Sep 2026 AND ITS
 * SUBJECT MOVED WITH G913: THERE IS NO PER-TIER VERDICT ANY MORE.** What it
 * guards now is the CENSUS — `EXEMPT_WITH_A_PERSON_TO_ASK` — and the
 * argument for keeping a run-time guard beside a total `Record` is unchanged
 * and is quoted from its predecessor: *"a sixth tier is a compile error at the
 * literal — strictly better than a run-time list. But `tools/` is `.mjs` and
 * gets no compiler, and this file is the one thing in the gate that reads the
 * table without one. It survives as the reader's guard, not as the author's."*
 *
 * 🛑 AND THE FAILURE MODE IT CATCHES IS NOT THE SAME ONE, WHICH IS WORTH A
 * LINE. A missing VERDICT read as `undefined` — falsy — and silently EXEMPTED
 * a whole tier. A missing CENSUS entry reads as `undefined` too, and
 * `exemptions !== undefined` would then be false for every tier, so check D
 * would go quiet rather than fail: the same shape, one artefact over, which is
 * exactly why the guard is carried across rather than retired with the table.
 */
export function tiersWithoutAnExemptionCensus() {
  return OPERATION_TIERS.filter((t) => typeof EXEMPT_WITH_A_PERSON_TO_ASK[t] !== 'number')
}

/**
 * Every declared operation, across every tier, as flat records.
 *
 * Walks `paths` × `OPERATION_KEYS` — the same product `routesOf()` walks, so
 * this cannot see an operation the router cannot, or miss one it can.
 */
export function declaredOperations() {
  const out = []
  for (const tier of OPERATION_TIERS) {
    const doc = loadTier(tier)
    const paths = doc['paths']
    if (typeof paths !== 'object' || paths === null) continue
    /* ⚠️ THE DOCUMENT'S OWN `security` IS THE FALLBACK AND NOT THE ANSWER —
       `routesOf()` resolves it exactly this way for `secured`, and four
       operations in the corpus override it (`submitUsageAttestation`,
       `getSession`, `signOut`, and `session.openapi.yaml`'s document-level
       `[]`). Reading the document level alone would classify two session
       operations as having no caller while they require one. */
    const documentSecurity = doc['security']
    for (const [route, item] of Object.entries(paths)) {
      if (typeof item !== 'object' || item === null) continue
      for (const method of OPERATION_KEYS) {
        const op = item[method]
        if (typeof op !== 'object' || op === null) continue
        const effectiveSecurity = Array.isArray(op['security']) ? op['security'] : documentSecurity
        out.push({
          tier,
          file: TIERS[tier],
          route,
          method,
          operationId: typeof op['operationId'] === 'string' ? op['operationId'] : `${method} ${route}`,
          annotation: op[ANNOTATION_KEY],
          caller: callerOf(effectiveSecurity),
          partnerExposure: op[PARTNER_EXPOSURE_KEY],
          responseCodes: Object.keys(
            typeof op['responses'] === 'object' && op['responses'] !== null ? op['responses'] : {},
          ),
        })
      }
    }
  }
  return out
}

/** Same, for `x-partner-exposure`. */
export function classifyPartnerExposure(value) {
  if (value === undefined) return { kind: 'absent' }
  if (typeof value !== 'string') return { kind: 'malformed', detail: `not a string: ${typeof value}` }
  const trimmed = value.trim()
  if (trimmed.startsWith(ACCEPTED_PREFIX)) {
    return { kind: 'accepted', reason: trimmed.slice(ACCEPTED_PREFIX.length).trim() }
  }
  return { kind: 'malformed', detail: `does not begin with "${ACCEPTED_PREFIX}": ${trimmed}` }
}

/** Sorted, comma-joined, for a message a person can act on without re-deriving. */
export function name(ids) {
  return [...ids].sort().join(', ')
}

/* ==================================================================== *
 * THE CHECKS.
 * ==================================================================== */

/**
 * Returns `{ findings, ops }`. A finding is `{ code, detail }`; any finding
 * fails the run.
 *
 * 🛑 THE ANTI-VACUOUS GUARDS COME FIRST AND THEY ARE NOT DECORATION. Every check
 * below walks `ops`. If the loader silently produced nothing, ALL of them would
 * pass — a checker that passes while asserting nothing, which is the one defect
 * shape this repository catalogues more than any other. The floor is stated as
 * a MINIMUM, never as the exact count: a totality claim against a hand-copied
 * denominator is that same shape in another register, and the denominator here
 * has already moved from 70 to 72 to 76.
 */
/**
 * ⚠️ `suppliedOps` IS FOR WITNESSING THE CHECKS AND FOR NOTHING ELSE, AND IT
 * IS ADDED BECAUSE THE ALTERNATIVE WAS WORSE. G911 makes checks D and E
 * per-operation, and a per-operation check over a corpus where no operation
 * violates it is a check nobody has ever seen FIRE — §5.6, in the file whose
 * own header calls that the defect it exists against. Driving `runChecks()`
 * over a synthetic operation list is how
 * `tests/contracts/per-operation-gate-verdict.test.mjs` sees each of D, E and
 * F go red, and how it witnesses the MIXED DOCUMENT the owner's ruling is for
 * — one gated operation and one exempt operation in the SAME tier, which no
 * real document contains today.
 *
 * 🛑 THE ANTI-VACUOUS FLOOR IS DELIBERATELY *NOT* SKIPPED FOR A SUPPLIED LIST.
 * A caller handing in three operations gets the `vacuous` finding and an early
 * return, exactly as a broken loader would, so this parameter cannot be used to
 * quietly evaluate a check against nothing. The suite pads its fixtures to
 * clear the floor and says so where it does it.
 */
export function runChecks(suppliedOps) {
  const ops = suppliedOps ?? declaredOperations()
  const findings = []
  const add = (code, detail) => findings.push({ code, detail })

  if (ops.length < 70) {
    add(
      'vacuous',
      `only ${ops.length} operation(s) loaded across the five tiers, so every check below ` +
        "would pass on an empty input. Derive the truth: grep -h 'operationId:' " +
        'docs/contracts/*.openapi.yaml | wc -l',
    )
    return { findings, ops }
  }

  const byTier = {}
  for (const o of ops) byTier[o.tier] = (byTier[o.tier] ?? 0) + 1
  const silent = OPERATION_TIERS.filter((t) => (byTier[t] ?? 0) === 0)
  if (silent.length > 0) {
    add('vacuous', `${name(silent)} contributed no operation at all, so their checks are vacuous.`)
  }

  const uncensused = tiersWithoutAnExemptionCensus()
  if (uncensused.length > 0) {
    add(
      'tier-uncensused',
      `${name(uncensused)} has no entry in EXEMPT_WITH_A_PERSON_TO_ASK. A missing key reads as ` +
        '`undefined`, so check D below compares nothing and goes quiet on that tier — the same ' +
        'shape the retired TIER_REQUIRES_CAPABILITY guard caught one artefact over. Count the ' +
        'tier\'s person-facing exemptions and write the number, with the reason, in ' +
        'server/contract/capability.ts.',
    )
  }

  const anonymous = ops.filter((o) => o.operationId.includes(' '))
  if (anonymous.length > 0) {
    add(
      'no-operation-id',
      `${anonymous.length} declared operation(s) carry no operationId, so no message below can ` +
        `name them: ${name(anonymous.map((o) => `${o.file} ${o.operationId}`))}`,
    )
  }

  const classified = ops.map((o) => ({ o, a: classifyAnnotation(o.annotation) }))

  /* A · every declared operation carries the key. `mountTier()`'s third fence,
   *     over the 72 operations it cannot see. */
  const absent = classified.filter(({ a }) => a.kind === 'absent')
  if (absent.length > 0) {
    add(
      'A · annotation absent',
      `${absent.length} of ${ops.length} declared operations carry no \`${ANNOTATION_KEY}\`. ` +
        'ONE KEY, PRESENT ON EVERY OPERATION, NEVER OPTIONAL — an operation with no annotation ' +
        'is one nobody decided about, and that is indistinguishable from one somebody decided ' +
        `was public. Write \`${ANNOTATION_KEY}: <capability>\` or \`${ANNOTATION_KEY}: ` +
        `'${EXEMPT_PREFIX} <why this operation has no human principal>'\`.\n  ` +
        name(absent.map(({ o }) => `${o.tier}:${o.operationId}`)),
    )
  }

  /* B · no exemption reason is a placeholder. */
  const thin = classified.filter(({ a }) => a.kind === 'exempt' && a.reason.length < MIN_REASON_CHARS)
  if (thin.length > 0) {
    add(
      'B · exemption reason is a placeholder',
      `${thin.length} exemption(s) carry a reason shorter than ${MIN_REASON_CHARS} characters. ` +
        'The floor exists to reject `n/a`, `TODO` and `see docs` — the three things a person ' +
        'writes when they have not yet made the decision the annotation is asking for.\n  ' +
        thin.map(({ o, a }) => `${o.operationId} (${a.reason.length} chars: "${a.reason}")`).join(' · '),
    )
  }

  /* C · nothing is malformed. */
  const bad = classified.filter(({ a }) => a.kind === 'malformed')
  if (bad.length > 0) {
    add(
      'C · annotation malformed',
      `${bad.length} annotation(s) are neither a capability nor an exemption:\n  ` +
        bad.map(({ o, a }) => `${o.operationId}: ${a.detail}`).join(' · '),
    )
  }

  /* D · THE EXEMPTION CENSUS — G913, 20 Sep 2026.
   *
   * ⛔ THIS SLOT HELD *"a gated tier bought out with a reason"*, keyed on
   *    `TIER_REQUIRES_CAPABILITY[o.tier] && a.kind === 'exempt'`, and the
   *    letter is kept rather than renumbered so that every citation of
   *    "check D" in four documents and nine test files still lands on the
   *    thing that answers the same question. ITS CONTENT IS PRESERVED
   *    EXACTLY AND WIDENED: the two tiers it governed are the two ZEROS in
   *    the census, so an exemption appearing on either is still a finding —
   *    and so is one appearing anywhere else, which the old form could not
   *    say.
   *
   * 🛑 WHY A CENSUS AND NOT A RULE. There is no derivable rule. Measured:
   *    64 of the 136 declared operations state an exemption while declaring
   *    a PERSON caller, and one of them — `resolveTenantContext` — is
   *    MOUNTED and is right to be, on a circularity argument no security
   *    scheme can express. A rule refusing person-facing exemptions is a red
   *    gate; a rule permitting them is no control at all. What is left that
   *    is honest is to COUNT them, pin the count, and make every movement a
   *    line somebody argues in a diff. The zeros are absolute; the non-zeros
   *    are the first scrutiny those 64 have ever had.
   *
   * ⚠️ IT MOVES IN BOTH DIRECTIONS ON PURPOSE. Converting an exemption to a
   *    capability lowers the number and is also a finding, because §5.11's
   *    rule is that a count is swept by the commit that moves it — and
   *    because a silent decrease would let a swap (one exemption out, one
   *    in) pass unremarked. */
  const personFacingExemptions = {}
  for (const t of OPERATION_TIERS) personFacingExemptions[t] = 0
  for (const { o, a } of classified) {
    if (a.kind === 'exempt' && callerMayBeAPerson(o.caller)) personFacingExemptions[o.tier] += 1
  }
  const moved = OPERATION_TIERS.filter((t) => personFacingExemptions[t] !== EXEMPT_WITH_A_PERSON_TO_ASK[t])
  if (moved.length > 0) {
    add(
      'D · the person-facing exemption census moved',
      `${moved.length} tier(s) hold a different number of operations that state an EXEMPTION ` +
        'while declaring a caller who may be a PERSON than `EXEMPT_WITH_A_PERSON_TO_ASK` in ' +
        'server/contract/capability.ts records.\n  ' +
        moved
          .map((t) => `${t}: recorded ${EXEMPT_WITH_A_PERSON_TO_ASK[t]}, tree says ${personFacingExemptions[t]}`)
          .join(' · ') +
        '\n  Each of these is an operation the `preValidation` gate never touches and which mints ' +
        'no invariant 10 record, served to somebody holding an ordinary session. That may be the ' +
        'right answer — it is for `resolveTenantContext`, on circularity — but it is not a ' +
        'DEFAULT, and this is where it stops being one. Read the entry, sweep the number, and ' +
        'say in the commit which operation moved and why.\n  ' +
        moved
          .map(
            (t) =>
              `${t} → ` +
              (classified
                .filter(({ o, a }) => o.tier === t && a.kind === 'exempt' && callerMayBeAPerson(o.caller))
                .map(({ o }) => o.operationId)
                .sort()
                .join(', ') || '(none)'),
          )
          .join('\n  '),
    )
  }

  /* E · A CAPABILITY WITH NO CALLER TO ASK ABOUT — re-founded per operation,
   *     G912, and the letter is kept because it answers the same question.
   *
   * ⛔ IT READ *"a capability off the tier that has a principal"*, keyed on
   *    `!TIER_REQUIRES_CAPABILITY[o.tier]`. **THAT WAS §5.1 IN THE CHECKER
   *    WRITTEN TO CATCH §5.1**: its own message argues about a
   *    `PrincipalContext` and about `decide()` refusing *"at the
   *    subject-status branch"* — a claim about the CALLER — while keying on
   *    the FILENAME. Its whole argument is preserved below and now keys on
   *    `o.caller`, which is derived from the operation's own `security` with
   *    the document-level fallback.
   *
   * 🟢 IT IS ALSO STRICTLY WIDER. The old form could not see a capability on
   *    a machine-facing operation that happened to sit in a `true` tier, and
   *    it could not admit a capability on a person-facing operation in a
   *    `false` one — which is the ruling's whole content and the reason
   *    `docs/contracts/platform-console.openapi.yaml` had to be cut out of
   *    `administration.openapi.yaml`. Those fourteen would now be legal in
   *    place. **They are NOT moved back: reversing G781 is a separate
   *    ruling.** */
  const misplaced = classified.filter(({ o, a }) => a.kind === 'capability' && o.caller !== 'person')
  if (misplaced.length > 0) {
    add(
      'E · a capability with no caller to ask about',
      `${misplaced.length} operation(s) name a real capability while declaring a caller who is ` +
        'not a person on every path in. That is a category error, not a stricter gate: ' +
        '`decide()` needs a PrincipalContext carrying subject, orgClass, partnerId, partnerGrant ' +
        'and held assignments, and refuses at the subject-status branch before it reaches any ' +
        'capability.\n  ' +
        misplaced.map(({ o, a }) => `${o.tier}:${o.operationId} (caller: ${o.caller}) → ${a.capability}`).join(' · '),
    )
  }

  /* F · AN UNCLASSIFIED SECURITY SCHEME — G912's fail-closed half.
   *
   * `callerOf()` returns `unclassified` for a scheme name
   * `SECURITY_SCHEME_CALLER` does not list, rather than sorting it into
   * `machine` by a default nobody wrote. That value makes check E fire and
   * makes `mountTier()`'s fourth fence demand a mark — both fail-closed — but
   * neither of them SAYS what happened, and a reader meeting "a capability
   * with no caller to ask about" on an operation that plainly declares one
   * would look in the wrong place. This is the finding that names it. */
  const unknownScheme = ops.filter((o) => o.caller === 'unclassified')
  if (unknownScheme.length > 0) {
    add(
      'F · a security scheme nobody has classified',
      `${unknownScheme.length} operation(s) resolve to a security requirement naming a scheme ` +
        `that is not in SECURITY_SCHEME_CALLER (which lists ${name(Object.keys(SECURITY_SCHEME_CALLER))}). ` +
        'Whether its holder is a PERSON is the one fact the gate verdict rests on, so it is ' +
        'refused rather than guessed. Classify it, with the reason, in ' +
        'server/contract/capability.ts.\n  ' +
        name(unknownScheme.map((o) => `${o.tier}:${o.operationId}`)),
    )
  }

  return { findings, ops }
}

/* ==================================================================== *
 * THE REPORT.
 * ==================================================================== */

/**
 * The main-module guard, copied from `tools/check-g-numbers.mjs` along with its
 * reasoning: "`realpathSync` is load-bearing rather than defensive. Node
 * resolves symlinks when it builds `import.meta.url` and does NOT resolve them
 * in `process.argv[1]`, so on any checkout reached through a symlink — macOS's
 * `/tmp` → `/private/tmp` being the one every test here hits — the two strings
 * differ and the CLI silently does nothing while exiting 0. A guard that turns
 * the checker into a no-op is worse than no guard."
 */
function isEntryPoint() {
  const argv1 = process.argv[1]
  if (!argv1) return false
  try {
    return import.meta.url === pathToFileURL(realpathSync(argv1)).href
  } catch {
    return import.meta.url === pathToFileURL(argv1).href
  }
}

if (isEntryPoint()) {
  const { findings, ops } = runChecks()
  const byTier = {}
  for (const o of ops) byTier[o.tier] = (byTier[o.tier] ?? 0) + 1
  console.log(
    `check-capability-annotations — ${ops.length} declared operation(s): ` +
      Object.entries(byTier)
        .sort()
        .map(([t, n]) => `${t} ${n}`)
        .join(' · '),
  )
  if (findings.length === 0) {
    const named = new Set(
      ops.map((o) => classifyAnnotation(o.annotation)).filter((a) => a.kind === 'capability').map((a) => a.capability),
    )
    const exempt = ops.filter((o) => classifyAnnotation(o.annotation).kind === 'exempt').length
    console.log(
      `  every operation is annotated — ${ops.length - exempt} name a capability ` +
        `(${named.size} distinct) and ${exempt} state an exemption.`,
    )
    /* THE CENSUS, PRINTED ON EVERY GREEN RUN — because the number check D pins
       is the one a reader has to be able to see without reading the source, and
       because a control that only speaks when it fails teaches nobody what it
       is counting. */
    const personFacing = ops.filter(
      (o) => classifyAnnotation(o.annotation).kind === 'exempt' && callerMayBeAPerson(o.caller),
    )
    const perTier = {}
    for (const o of personFacing) perTier[o.tier] = (perTier[o.tier] ?? 0) + 1
    console.log(
      `  ${personFacing.length} of those exemptions face a caller who may be a PERSON: ` +
        (Object.entries(perTier)
          .sort()
          .map(([t, n]) => `${t} ${n}`)
          .join(' · ') || 'none') +
        ' — pinned by EXEMPT_WITH_A_PERSON_TO_ASK.',
    )
    console.log(
      '\n⚠️ This checker reads the GRAMMAR and the CALLER. It does not resolve a name against\n' +
        '   CAPABILITIES, does not read CAPABILITY_RESOURCE_CLASS and does not ask whether an\n' +
        '   operation declares a 403 — tests/contracts/capability-annotation.test.mjs does all\n' +
        '   four, with the arguments. Its silence is not evidence of absence.',
    )
    process.exit(0)
  }
  for (const f of findings) console.log(`\n🛑 ${f.code}\n  ${f.detail}`)
  console.log(`\n${findings.length} finding(s).`)
  process.exit(1)
}
