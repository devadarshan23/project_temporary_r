#!/usr/bin/env node
/**
 * check-wire-mirror.mjs — the model-versus-wire mirror checker.
 *
 * `tools/check-doc-counts.mjs` watches numbers stated in prose. NOTHING watched
 * the other mirror: a closed vocabulary declared in `model/` and RESTATED as an
 * enum in `docs/contracts/*.openapi.yaml`. The two drift silently — the model
 * compiles, the YAML parses, and the boundary quietly refuses a value the model
 * considers legal. That is how G80a's wire half went missing while the record
 * said both halves were applied.
 *
 * WHAT IT DOES. For each registered pair it derives the member list from the
 * MODEL — the model is the authority, the wire mirrors it — derives the member
 * list from the wire, and compares them AS SEQUENCES. Equal sets in a different
 * order are still reported: a discriminated union's arms and a discriminator
 * mapping are read by people side by side, and a reordering is the shape that
 * hides the next insertion.
 *
 * WHAT IT DOES NOT DO. It is a line scanner, not a type checker and not a full
 * YAML parser. It resolves the narrow subset of YAML these four contracts use
 * (block mappings, block sequences, inline flow sequences, inline flow mappings
 * one level deep, and a schema that is a bare `$ref` alias). It does not
 * resolve `$ref` targets, and it registers twenty-six concrete pairs rather
 * than generalising ahead of a twenty-seventh. ⚠️ That sentence said TWENTY until
 * 17 Aug 2026 and the registry held twenty-two, said TWENTY-TWO until
 * 22 Aug 2026 when `engine_meter` made twenty-three, and said TWENTY-THREE while
 * the registry already held TWENTY-FOUR — `pack_keys` moved it and only the
 * registry's own note was swept, which is precisely the partial sweep the note
 * two hundred lines down records about itself. G217 and G228 make it twenty-six;
 * nothing in `npm run check`
 * governs a count written in a comment, so derive it —
 * `node -e "import('./tools/check-wire-mirror.mjs').then(m=>console.log(m.PAIRS.length))"`.
 *
 * WHICH FILES IT READS, AND WHY IT IS THE TRACKED TREE RATHER THAN THE DISK.
 * Discovery is seeded from `git ls-files -- '*.openapi.yaml'`, so the set of
 * contracts compared is a function of THE TRACKED TREE, not of what happens to
 * be sitting on this disk. Until 17 Aug 2026 it was a recursive `readdir` of
 * the repository root, and that walker read GITIGNORED FILES BELONGING TO
 * OTHER COMMITS: `.gitignore:27` is `.claude/`, agent sessions park git
 * worktrees under `.claude/worktrees/<name>/`, and each of those carries its
 * own `docs/contracts/*.openapi.yaml` from a DIFFERENT commit with a DIFFERENT
 * `model/`. The walker compared those against the CURRENT model. It broke both
 * ways, and the second way is worse:
 *   • FALSE RED — a stray worktree one commit behind on any pinned enum turned
 *     `npm run check` red for a change that touched neither side. That is what
 *     stalled PR #256.
 *   • FALSE GREEN — a stray worktree whose contracts happen to still mirror the
 *     model added PASSING comparisons. `pairsCompared` counted them, so the
 *     report claimed twice the coverage the tree has, and the number a reader
 *     uses to judge whether the gate asserted anything was inflated by files
 *     that are not in the tree. A drift confined to the real file could sit
 *     beside a green duplicate of itself.
 * The `fixtures` name-exclusion below HID the stray worktree's own fixture
 * copies throughout. That was LUCK, not design — it excludes on a directory
 * NAME, and the stray contracts sit under `docs/contracts/`, which has no such
 * name to catch on.
 *
 * WHAT THE GIT SEED COSTS, stated because every checker here states its cost:
 *   • A contract file that exists on disk but is NOT YET `git add`ed is not
 *     discovered. That is the property, not a bug — but it means writing a new
 *     tier and running the gate before staging it compares nothing new and says
 *     so only in `pairsCompared`. The backstop is deliberate: the expected file
 *     list in `tests/tools/check-wire-mirror.test.mjs` is hard-coded, so a new
 *     tier cannot land without someone naming it.
 *   • It shells out to `git`. When `git` is absent, or the root is not a
 *     repository, discovery FALLS BACK to the walker with `.claude` and
 *     `.codex` added to EXCLUDED_DIR_NAMES, and the report carries a loud
 *     `DISCOVERY UNAVAILABLE` block naming the reason. Non-fatal, in the shape
 *     `unmirrored` already established here: a degraded run says it is degraded
 *     rather than exiting 1 on a condition the author cannot fix.
 *
 * ⚠️ G109 IS AMENDED, NOT DEPARTED FROM. G109 rules that `tools/` takes a real
 * YAML parser, pinned exact, precisely because a hand-parser that is subtly
 * wrong produces a checker that passes while asserting nothing. On 11 Aug 2026
 * the product owner ruled the parser DEFERRED and this line scanner EXTENDED,
 * so that `run_status` could be pinned BEFORE O-16 adds a third reconciliation
 * outcome — an enum changing on a pair that is not yet pinned is how the model
 * and the wire drift silently, which is the shape already recorded against
 * `policy_subject`. The amendment is recorded here rather than acted on
 * quietly. The condition attached to it is not optional and was met: EVERY new
 * source kind is verified RED against a deliberately drifted fixture before it
 * is pointed at the tree. `literal_union` was rejected against
 * `tests/tools/fixtures/wire-mirror/inline-flow-drift.openapi.yaml` first. The
 * `$ref`-resolving half of G109 remains unbuilt and unclaimed.
 *
 * WHAT `literal_union` CANNOT SEE, stated because every checker here states it:
 *   • a union member that is not a bare quoted string literal. It THROWS on one
 *     rather than skipping it, so a discriminated union or a `typeof X[keyof …]`
 *     alias is a loud error and never a silently empty member list.
 *   • a member added by a union of unions (`type A = B | 'c'`), which it reads
 *     as an unparseable member and therefore refuses.
 *   • the same vocabulary RESTATED outside `components.schemas` — the run-status
 *     strings are also written inline at the `/runs` `status` query parameter in
 *     capability.openapi.yaml, and no pair can address a parameter. That copy is
 *     mirrored by nothing and must be edited by hand alongside the schema.
 *   • comments and nested discriminators are intentionally excluded from the
 *     `union` reader; it reads only a union arm's own `kind`. `const_array`
 *     reads only a literal array, not computed values or a spread.
 *
 * FINDING KINDS ARE DISTINCT ON PURPOSE:
 *   drift       the wire schema exists and disagrees with the model. EXITS 1.
 *   unmirrored  no wire file defines the schema at all. Reported, exit 0 —
 *               a surface that has no contract yet is a known gap, not a
 *               regression, and failing on it would make the gap unspeakable.
 *
 * Usage:
 *   node tools/check-wire-mirror.mjs
 *   node tools/check-wire-mirror.mjs --pairs meters,retention_classes
 *   node tools/check-wire-mirror.mjs --wire <file>   (repeatable; replaces discovery)
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const DRIFT = 'drift'
export const UNMIRRORED = 'unmirrored'

/**
 * Directory names discovery never descends into, and never returns.
 *
 * `fixtures` and `__tests__` are load-bearing, not hygiene, and they apply to
 * BOTH discovery paths — the git seed lists the fixtures, because they are
 * tracked (`git ls-files -- '*.openapi.yaml'` returns ten files, six of them
 * fixtures). The checker's own fixtures are valid OpenAPI files named
 * `*.openapi.yaml` and several are DELIBERATELY DRIFTED. A sweep that reached
 * them would make `npm run check` permanently red on trunk.
 *
 * `.claude` and `.codex` matter only to the FALLBACK walker, and only because
 * the walker reads the disk. Agent sessions park git worktrees under
 * `.claude/worktrees/<name>/` and `.codex/worktrees/<id>/<repo>/`, each a
 * different commit with a different `model/`. `.gitignore:27` is `.claude/`;
 * `.codex` is NOT in `.gitignore` and is listed here anyway, because the
 * property wanted is "another checkout is not this tree" and that does not
 * depend on whether someone remembered to ignore it. See the header for the
 * false-red and false-green this cost. Added 17 Aug 2026.
 *
 * ⚠️ This set excludes on a directory NAME. It cannot see a checkout parked
 * under a name nobody listed — which is exactly why the git seed is the
 * primary path and this is the fallback.
 */
export const EXCLUDED_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.claude',
  '.codex',
  'fixtures',
  '__tests__',
])

// ---------------------------------------------------------------- the registry

/**
 * The twenty-six pairs. This array is the extension point; adding a twenty-seventh is
 * a line here plus a test, not a change to the engine.
 *
 * ⚠️ This said TWENTY and TWENTY-FIRST until 17 Aug 2026 and TWENTY-TWO and
 * TWENTY-THIRD until 22 Aug 2026, and the header two hundred
 * lines up said the same until the commit that added this note — so the file carried
 * the stale figure in TWO places and only one was swept. ⚠️ AND IT SAID TWENTY-TWO
 * UNTIL 22 Aug 2026, when `engine_meter` (W-10 #202) made twenty-three. BOTH
 * INSTANCES ARE SWEPT IN THE COMMIT THAT MOVED THE NUMBER — the defect this note
 * records is a partial sweep, and repeating it here would be the note outliving its
 * own lesson.
 *
 * 🛑 AND IT OUTLIVED ITS OWN LESSON ANYWAY, WHICH IS WHY THIS PARAGRAPH IS STILL
 * HERE. `pack_keys` took the registry to TWENTY-FOUR and swept THIS note and not
 * the header's; the header went on saying twenty-three. G217's
 * `pairing_strategy_kinds` and G228's `line_finding_refusal_kinds` make
 * TWENTY-SIX, and BOTH instances are swept in this commit — again, and with the
 * previous failure named rather than quietly repaired. Derive it, do not read it:
 * `node -e "import('./tools/check-wire-mirror.mjs').then(m => console.log(m.PAIRS.length))"`.
 * `tools/check-doc-counts.mjs` governs neither instance: it reads Markdown, not a
 * comment inside a checker, so nothing but a person will catch this going stale again.
 *
 * ⚠️ THE ARRAY IS NOT THE COVERAGE CONTROL AND MUST NOT BE READ AS ONE. Nothing
 * here notices a vocabulary that reached the wire and was never registered —
 * that is `tests/contracts/engine-read-wire.test.mjs` A1, which derives the
 * published enums from the contract and requires each to be pinned or named as
 * an exclusion. `population_side` is the instance that proved the need.
 *
 * `model.source`:
 *   union            a discriminated union — the `kind: '…'` literals, in
 *                    declaration order.
 *   const            an `export const X = { … } as const` — the VALUES.
 *   const_minus      a const, minus the string literals named in an
 *                    `Exclude<…>` type alias. `LivePolicyKind` is derived by
 *                    subtraction deliberately (model/policy.ts), so re-listing
 *                    the live six here would create a third vocabulary for one
 *                    concept — the exact defect this checker exists to catch.
 *   literal_union    a bare union of string literals — `export type X = 'a' |
 *                    'b'` — in declaration order. Added 11 Aug 2026 under the
 *                    G109 amendment in the header. It exists because
 *                    `ReconciliationRun.status` was an INLINE union with no
 *                    name at all, and this checker addresses a model
 *                    vocabulary BY NAME: there was nothing for a pair to bind
 *                    to. Naming it in `model/domain.ts` was half the
 *                    prerequisite; this kind is the other half.
 *   const_array       an `export const X = ['…'] as const` vocabulary. Its
 *                    literals are values in declaration order, like `const`,
 *                    but there are no object keys to read.
 */
export const PAIRS = [
  {
    name: 'subject_location',
    model: { file: 'model/governance.ts', source: 'union', name: 'SubjectLocation' },
    wire: { schema: 'SubjectLocation', path: ['properties', 'kind', 'enum'] },
  },
  {
    name: 'live_policy_kind',
    model: {
      file: 'model/policy.ts',
      source: 'const_minus',
      name: 'POLICY_KINDS',
      excludeType: 'LivePolicyKind',
    },
    wire: { schema: 'PolicyDefaults', path: ['required'] },
  },
  {
    name: 'service_notice_kinds',
    model: { file: 'model/governance.ts', source: 'const', name: 'SERVICE_NOTICE_KINDS' },
    wire: { schema: 'ServiceNoticeKind', path: ['enum'] },
  },
  {
    name: 'meters',
    model: { file: 'model/billing.ts', source: 'const', name: 'METERS' },
    wire: { schema: 'Meter', path: ['enum'] },
  },
  {
    name: 'retention_classes',
    model: { file: 'model/domain.ts', source: 'const', name: 'RETENTION_CLASSES' },
    wire: { schema: 'RetentionClass', path: ['enum'] },
  },
  /* PINNED BEFORE O-16, DELIBERATELY. O-16 adds a third reconciliation outcome
   * and therefore changes this vocabulary. Registering the pair afterwards
   * would be registering it after the drift it exists to catch. ⚠️ It covers
   * the `Run` SCHEMA only — the same four strings are restated inline at the
   * `/runs` `status` query parameter, which lives outside
   * `components.schemas` and no pair can reach. */
  {
    name: 'connector_parameter_kinds',
    model: { file: 'model/connectors.ts', source: 'const', name: 'CONNECTOR_PARAMETER_KINDS' },
    wire: { schema: 'ConnectorParameterKind', path: ['enum'] },
  },
  /* G184's ONE INTAKE VOCABULARY, registered IN THE COMMIT THAT CREATES IT.
   * This file's own sequencing rule is that "a vocabulary registered after the
   * enum it governs has shipped is registered after the drift it exists to
   * catch" — and here the two halves were divergent for weeks before the ruling,
   * with the contract recording the divergence in its own description text. The
   * pair closes that window in the same commit that closes the divergence, so
   * there is no moment in which the vocabulary exists and is unwatched.
   *
   * WITNESSED RED BEFORE IT WAS POINTED AT THE TREE, twice, as the G109
   * amendment of 11 Aug 2026 requires: `intake-channel-drift.openapi.yaml` for
   * the set (missing `watched_drop`, extra `api` — the two drifts G184 rules
   * against by name), and `intake-channel-reordered.openapi.yaml` for the order
   * alone, because where the sets differ missing/extra dominates and the
   * ordering never becomes the reason for the finding.
   *
   * ⚠️ `IntakeChannelStatus.properties.channel.enum` is an INLINE enum inside a
   * named schema — `run_status`'s exact shape, and the reason the pair takes a
   * three-segment path rather than `['enum']`. */
  {
    name: 'intake_channel_kinds',
    model: { file: 'model/ingestion.ts', source: 'const', name: 'INTAKE_CHANNEL_KINDS' },
    wire: { schema: 'IntakeChannelStatus', path: ['properties', 'channel', 'enum'] },
  },
  {
    name: 'run_status',
    model: { file: 'model/domain.ts', source: 'literal_union', name: 'RunStatus' },
    wire: { schema: 'Run', path: ['properties', 'status', 'enum'] },
  },
  /* G74's register vocabulary, pinned IN THE COMMIT THAT MINTS THE ENUM rather
   * than after it — this file's own sequencing rule is that "a vocabulary
   * registered after the enum it governs has shipped is registered after the
   * drift it exists to catch."
   *
   * THE READER WAS MEASURED BEFORE THE PAIR WAS REGISTERED, which is what
   * group D of `tests/contracts/engine-read-wire.test.mjs` demonstrates and
   * what keeps a pair from reporting `DRIFT (0)` against nothing:
   * `FINDING_STANDINGS` is an `export const … as const satisfies …` object, so
   * `const` is the reader and it returns the five VALUES in declaration order —
   * `closed · needs_authority · no_recourse · below_floor · waiting`. It is NOT
   * `literal_union`: that reader addresses `export type FindingStanding`, whose
   * five members are the same words in the same order, so a pair registered
   * against either would pass today — and the OBJECT is the declaration the
   * wire mirrors, because the object is what a renderer imports.
   *
   * ⚠️ ORDER IS THE ASSERTION HERE MORE THAN MEMBERSHIP. The order is the
   * model's declaration order and is not alphabetical, and #211's State-column
   * sort control is what will read it. */
  {
    name: 'finding_standings',
    model: { file: 'model/domain.ts', source: 'const', name: 'FINDING_STANDINGS' },
    wire: { schema: 'FindingStanding', path: ['enum'] },
  },

  /* G217's ambiguity read (#201 [W-9]) needs the strategy vocabulary on the
   * wire, and `AmbiguityFinding.strategyKind` is `PairingStrategy['kind']` — a
   * PROJECTION. The pair therefore reads `PairingStrategy` in `model/domain.ts`,
   * where the union is DECLARED, because a pair registered against a
   * restatement compares a copy with itself.
   *
   * THE READER WAS MEASURED BEFORE THE PAIR WAS REGISTERED, as this file's own
   * rule requires: `unionKinds()` over `PairingStrategy` returns the four arms
   * in declaration order — `exact_identifier · amount_and_date · amount_sum ·
   * fuzzy_reference`. It is a discriminated union with a real `kind`, so `union`
   * is the reader and `literal_union` would throw rather than pass vacuously.
   *
   * ⚠️ IT IS THE ONLY PINNED ENGINE VOCABULARY DECLARED OUTSIDE
   * `model/reconciliation.ts`, which is why `tests/contracts/engine-read-wire.test.mjs`
   * does NOT list it in `PINNED` — that array's own loop asserts every member
   * reads from the engine module, and widening the loop to admit one exception
   * would weaken an assertion in order to record one. It is asserted by name in
   * `tests/contracts/search-boundary-wire.test.mjs` instead. */
  {
    name: 'pairing_strategy_kinds',
    model: { file: 'model/domain.ts', source: 'union', name: 'PairingStrategy' },
    wire: { schema: 'PairingStrategyKind', path: ['enum'] },
  },

  /* G228's second register row type (#247 [W-12]). Pinned IN THE COMMIT THAT
   * MINTS THE ENUM: a vocabulary registered after the enum it governs has
   * shipped is registered after the drift it exists to catch.
   *
   * ⚠️ NO OPERATION PRODUCES A `LineFinding` YET — `/close/finding/:ref` is
   * #213's — so this pair guards a schema the router does not serve. That is
   * deliberate and it is the cheap half: the vocabulary is two arms today and
   * the moment to pin it is before a third is added by somebody who did not read
   * this. Measured first: `unionKinds()` over `LineFindingRefusal` returns
   * `no_such_residue_row · residue_row_not_unique`. */
  {
    name: 'line_finding_refusal_kinds',
    model: { file: 'model/reconciliation.ts', source: 'union', name: 'LineFindingRefusal' },
    wire: { schema: 'LineFindingRefusalKind', path: ['enum'] },
  },

  /* ---------------------------------------------------------------- ENGINE
   * The reconciliation engine's read surface, pinned as it reaches the wire.
   *
   * 🛑 EVERY READER BELOW WAS MEASURED AGAINST ITS DECLARATION BEFORE THE PAIR
   * WAS REGISTERED, and the measurement is what chose the source kind.
   * `unionKinds()` on each of these nine returns exactly the arm list the
   * declaration carries; `EngineAssignableDisposition` is a BARE literal union
   * with no discriminator, for which `unionKinds()` returns ZERO members — a
   * pair registered with the wrong reader compares an empty list against an
   * empty list and reports `DRIFT (0)` against nothing, which is §5.6 inside
   * the tool written to catch §5.6.
   *
   * ✅ ONE UNION IN THAT MODULE WAS DELIBERATELY ABSENT AND IS NOW REGISTERED —
   * W-1 (#186) LANDS IN THIS COMMIT. The paragraph that stood here is corrected
   * rather than deleted, because it is the one a reader would have trusted:
   * it said `SetReconciliationRefusal` has FIFTEEN arms while `unionKinds()`
   * read SEVENTEEN — harvesting `kind: '…'` out of the NESTED union inside
   * `tolerance_unit_disagrees` and yielding the phantoms `pairing` and
   * `strategy_binding` — so its wire mirror (`RunRefusalKind` in
   * capability.openapi.yaml) was HAND-MAINTAINED and the `run_refusal` pair
   * could not be registered without reporting DRIFT against a correct wire.
   * `unionKinds()` now accepts `kind` only at an arm's OWN object depth and
   * returns exactly fifteen, so the pair below is registered and the wire stops
   * being hand-maintained. `tests/contracts/engine-read-wire.test.mjs` group D
   * still asserts the fifteen BY NAME — the pair proves the two agree, the
   * names prove they agree on the RIGHT fifteen, and D1 now measures the
   * reader's CORRECTNESS where it used to measure its defect.
   *
   * ⚠️ WHAT THESE PAIRS DO NOT REACH, in the header's own idiom: each of these
   * vocabularies is ALSO stated as the single-member `enum` on every arm of its
   * discriminated `oneOf`, and no pair can address an arm. That second copy is
   * guarded by group C of the same test file and by nothing else.
   * ------------------------------------------------------------------------ */
  {
    name: 'extracted_scalar_kinds',
    model: { file: 'model/domain.ts', source: 'union', name: 'ExtractedScalar' },
    wire: { schema: 'ExtractedScalarKind', path: ['enum'] },
  },
  {
    name: 'money_refusal_kinds',
    /* ⚠️ THE MODEL FILE MOVED ON 19 Sep 2026 AND THE PAIR DID NOT CHANGE
     * OTHERWISE — G286/G111. `MoneyRefusal` was declared in
     * `model/reconciliation.ts` §1 until the money section collapsed into the
     * codec module G111 has been asking for since 8 Aug 2026. The ARMS and their
     * ORDER are untouched, which is what this pair compares; two of them changed
     * MEANING, which no enum comparison can see and `model/money.ts` argues at
     * length. This checker went RED on the move — "no MoneyRefusal declaration
     * found" — which is the failure mode a file-scoped pair is supposed to have. */
    model: { file: 'model/money.ts', source: 'union', name: 'MoneyRefusal' },
    wire: { schema: 'MoneyRefusalKind', path: ['enum'] },
  },
  {
    name: 'normalisation_defect_kinds',
    model: { file: 'model/reconciliation.ts', source: 'union', name: 'NormalisationDefect' },
    wire: { schema: 'NormalisationDefectKind', path: ['enum'] },
  },
  {
    name: 'extraction_refusal_kinds',
    model: { file: 'model/reconciliation.ts', source: 'union', name: 'ExtractionRefusal' },
    wire: { schema: 'ExtractionRefusalKind', path: ['enum'] },
  },
  {
    name: 'reader_refusal_kinds',
    model: { file: 'model/reconciliation.ts', source: 'union', name: 'ReaderRefusal' },
    wire: { schema: 'ReaderRefusalKind', path: ['enum'] },
  },
  {
    name: 'admission_refusal_kinds',
    model: { file: 'model/reconciliation.ts', source: 'union', name: 'AdmissionRefusal' },
    wire: { schema: 'PopulationAdmissionRefusalKind', path: ['enum'] },
  },
  {
    name: 'population_defect_kinds',
    model: { file: 'model/reconciliation.ts', source: 'union', name: 'PopulationDefect' },
    wire: { schema: 'PopulationDefectKind', path: ['enum'] },
  },
  {
    name: 'postcondition_failure_kinds',
    model: { file: 'model/reconciliation.ts', source: 'union', name: 'PostconditionFailure' },
    wire: { schema: 'PostconditionFailureKind', path: ['enum'] },
  },
  {
    name: 'completeness_finding_kinds',
    model: { file: 'model/reconciliation.ts', source: 'union', name: 'CompletenessFinding' },
    wire: { schema: 'CompletenessFindingKind', path: ['enum'] },
  },
  {
    name: 'residue_cause_kinds',
    model: { file: 'model/reconciliation.ts', source: 'union', name: 'ResidueCause' },
    wire: { schema: 'ResidueCauseKind', path: ['enum'] },
  },
  {
    name: 'item_settlement_kinds',
    model: { file: 'model/reconciliation.ts', source: 'union', name: 'ItemSettlement' },
    wire: { schema: 'ItemSettlementKind', path: ['enum'] },
  },
  {
    // R13 — G2372, 1 Oct 2026. Registered in the commit that publishes the arms.
    name: 'pairing_evidence_kinds',
    model: { file: 'model/reconciliation.ts', source: 'union', name: 'PairingEvidence' },
    wire: { schema: 'PairingEvidenceKind', path: ['enum'] },
  },
  {
    // 🛑 THE PAIR W-1 (#186) EXISTED TO UNBLOCK, REGISTERED IN THE COMMIT THAT
    // FIXES THE READER — not in a later one. A fix whose only witness is a unit
    // test on the reader leaves the wire still hand-maintained, which is the
    // state the fix was for. `RunRefusalKind`'s fifteen members were maintained
    // by hand and by `engine-read-wire.test.mjs` D2's written-out list; they are
    // now mirrored mechanically, and D2's list stays as the name-level control
    // over WHICH fifteen.
    name: 'run_refusal_kinds',
    model: {
      file: 'model/reconciliation.ts',
      source: 'union',
      name: 'SetReconciliationRefusal',
    },
    wire: { schema: 'RunRefusalKind', path: ['enum'] },
  },
  {
    name: 'engine_disposition',
    model: {
      file: 'model/reconciliation.ts',
      source: 'literal_union',
      name: 'EngineAssignableDisposition',
    },
    wire: { schema: 'EngineAssignableDisposition', path: ['enum'] },
  },
  {
    // ⚠️ REGISTERED LATE, AND THE LATENESS IS THE POINT. `PopulationSide` reached
    // the wire in the first revision of this slice with no pair at all, `$ref`d
    // from fourteen positions, and the assertion written to catch exactly that
    // could not see it: `tests/contracts/engine-read-wire.test.mjs` A1 was titled
    // "every engine vocabulary this slice publishes is a REGISTERED pair" while
    // iterating a HAND-WRITTEN list in the test file. A vocabulary absent from
    // the list was absent from the check — §5.1, a rule keyed on a convenient
    // landmark instead of the property it protects, inside the assertion written
    // to enforce it. A1 now derives its subject from the contract. This pair, and
    // the derivation, landed in the same commit.
    //
    // The reader was MEASURED BEFORE REGISTRATION, as this file's header
    // requires: `PopulationSide` is `'left' | 'right'` with no `kind:`
    // discriminator, so `unionKinds()` returns 0 members and a `union` pair would
    // report DRIFT (0) against nothing. `unionLiterals()` returns 2.
    name: 'population_side',
    model: { file: 'model/reconciliation.ts', source: 'literal_union', name: 'PopulationSide' },
    wire: { schema: 'PopulationSide', path: ['enum'] },
  },
  {
    // W-10 (#202), under G237. THE FOUR METERS THE ENGINE PRODUCES FACTS FOR,
    // folded onto `getRunAccount` as a sixth channel rather than minted as a
    // seventy-third operation.
    //
    // ⚠️ THIS IS NOT THE `meters` PAIR AND MUST NOT BE FOLDED INTO IT. That one
    // is `METERS` (model/billing.ts, eight values) against schema `Meter` on the
    // foundation and control-plane tiers — the BILLING vocabulary. This one is
    // `EngineMeter` (four members) against schema `EngineMeter` on the
    // capability tier — what THIS ENGINE can produce a fact for. The four are a
    // strict SUBSET of the eight and the relationship is checked as a subset,
    // never as equality, by `tests/contracts/meter-fact-wire.test.mjs` B: the
    // other four meters have other producers, and a pair that demanded equality
    // would go red the day one of them shipped.
    //
    // THE READER WAS MEASURED BEFORE THE PAIR WAS REGISTERED, as this file's
    // header requires. `EngineMeter` is a bare string-literal union with no
    // `kind:` discriminator, so `unionKinds()` returns ZERO members for it and a
    // pair registered with `union` would compare an empty list against an empty
    // list and report `DRIFT (0)` against nothing. `unionLiterals()` returns 4.
    // The measurement is held as an assertion in that test file's A, so it goes
    // red rather than silent if the declaration ever grows a discriminator.
    //
    // 🛑 AND THE PAIR ITSELF WAS WITNESSED RED FIRST, against
    // `tests/tools/fixtures/wire-mirror/engine-meter-drift.openapi.yaml` — a
    // missing member, an extra member borrowed from the billing vocabulary, and
    // a reordering, all at once. The 11 Aug 2026 amendment to G109 attaches that
    // condition to every new source kind; it is applied here to a new PAIR on an
    // existing kind for the same reason, because "a source kind with no red
    // fixture is a source kind that has never been shown to fail" is a sentence
    // about evidence and not about source kinds.
    name: 'engine_meter',
    model: { file: 'model/reconciliation.ts', source: 'literal_union', name: 'EngineMeter' },
    wire: { schema: 'EngineMeter', path: ['enum'] },
  },
  /* G224's pack-key vocabulary, 22 Aug 2026 — registered IN THE COMMIT THAT
   * CLOSES THE WIRE, which is this file's own sequencing rule: "a vocabulary
   * registered after the enum it governs has shipped is registered after the
   * drift it exists to catch."
   *
   * WITNESSED RED FIRST, against
   * `tests/tools/fixtures/wire-mirror/pack-key-drift.openapi.yaml`, which
   * drifts in all three directions at once — a missing member, an extra one,
   * and a reordering. That is G109's amendment honoured rather than assumed;
   * the run is pasted into the PR that added this pair.
   *
   * THE READER IS `const`, NOT `literal_union`, AND THE DISTINCTION IS THE
   * SAME ONE `finding_standings` records: `PACK_KEYS` is an
   * `export const … as const` object, so `const` reads its VALUES in
   * declaration order. A pair pointed at the `PackKey` TYPE would pass today
   * and would stop seeing the object the moment the two disagree, which is
   * the drift.
   *
   * ⚠️ WHAT THIS PAIR DOES NOT REACH, stated because every pair here states
   * it: the wire side is the `PackKey` schema in `foundation.openapi.yaml`.
   * The two `propertyNames` sites in `control-plane.openapi.yaml` reach it
   * through a `$ref`, and this scanner does not resolve `$ref`. Repointing
   * either site at a different schema is invisible here and is caught by
   * nothing but a person — the `$ref`-resolving half of G109 is still
   * unbuilt and still unclaimed. */
  {
    name: 'pack_keys',
    model: { file: 'model/domain.ts', source: 'const', name: 'PACK_KEYS' },
    wire: { schema: 'PackKey', path: ['enum'] },
  },
  /**
   * 🛑 THE TWENTY-EIGHTH AND TWENTY-NINTH — 21 Sep 2026 — AND
   * `model/onboarding.ts` ASKED FOR THE FIRST BY NAME, FROM THE COMMIT THAT
   * MOUNTS `listOnboardingSteps`.
   *
   * That module's `STEP_STATES` declaration read: *"`OnboardingStep.state` is
   * `type: string` in the contract with the four values named only in a
   * `description`, so `tools/check-wire-mirror.mjs` has no pair to register and
   * a drift between these members and that prose is caught by nobody. That is
   * stated rather than fixed … It is owed by the commit that mounts
   * `listOnboardingSteps`."* **R8 is that commit**, the contract gains an
   * inline `enum` on each property, and these are the pairs.
   *
   * ⚠️ **THE `enum` TOOK THE MODEL'S SPELLING AND NOT THE PROSE'S, AND THAT IS
   * THE WHOLE VALUE OF REGISTERING IT.** The description said
   * `done-and-forced`; `STEP_STATES.doneForced` has been `done_forced` since
   * G535, and nothing in the tree ever emitted a hyphen. **A pair registered
   * against the prose would have pinned a wire value the product does not
   * produce** — which is why the divergence had to be resolved before the pair
   * could exist, rather than by it.
   *
   * ⚠️ NO NEW SOURCE KIND: both are `const` on the model side and an inline
   * `enum` on the wire, which this registry has carried since `pack_keys`. The
   * 11 Aug 2026 amendment's red-fixture condition binds a new SOURCE KIND and
   * does not bind these — the engine is unchanged and the three drifted
   * fixtures still exercise it.
   */
  {
    name: 'step_states',
    model: { file: 'model/onboarding.ts', source: 'const', name: 'STEP_STATES' },
    wire: { schema: 'OnboardingStep', path: ['properties', 'state', 'enum'] },
  },
  {
    name: 'whose_hands',
    model: { file: 'model/onboarding.ts', source: 'const', name: 'WHOSE_HANDS' },
    wire: { schema: 'OnboardingStep', path: ['properties', 'whoseHands', 'enum'] },
  },
  /* G3357, 3 Oct 2026 — `getSessionPrincipal` publishes the caller's
   * `orgClass`, which until then reached no wire at all. Pinned IN THE COMMIT
   * THAT MINTS THE ENUM, by this file's own sequencing rule. `ORG_CLASSES` is an
   * `as const` object, so `const` reads its VALUES in declaration order —
   * `platform · partner · customer` — and the wire's order is that order, not
   * alphabetical. No new source kind. */
  {
    name: 'org_classes',
    model: { file: 'model/access.ts', source: 'const', name: 'ORG_CLASSES' },
    wire: { schema: 'OrgClass', path: ['enum'] },
  },
  /* G3521, 3 Oct 2026 — `getSessionPrincipal.capabilities` publishes the
   * caller's held verbs, so the closed capability set reaches the wire for the
   * first time. Mirrored member for member and in `CAPABILITIES`' order; a
   * fifty-first verb the model mints and the enum lacks is a red gate. */
  {
    name: 'capabilities',
    model: { file: 'model/access.ts', source: 'const', name: 'CAPABILITIES' },
    wire: { schema: 'Capability', path: ['enum'] },
  },
]

// ---------------------------------------------------------------- model side

function readText(file) {
  return readFileSync(file, 'utf8')
}

/** The top-level `kind: '…'` literals of a discriminated union, in declaration order. */
export function unionKinds(text, typeName) {
  const lines = text.split('\n')
  const start = lines.findIndex((l) => l.startsWith(`export type ${typeName} =`))
  if (start === -1) throw new Error(`no \`export type ${typeName} =\` found`)

  let end = start + 1
  while (end < lines.length && !/^\S/.test(lines[end])) end++

  const block = lines.slice(start + 1, end).join('\n').replace(/\/\*[\s\S]*?\*\//g, '')
  const members = []
  // Split on arm heads, then accept `kind` only at the arm's own object depth.
  // A nested field may itself be a discriminated union, but its `kind` is
  // indented beyond the arm head and is not a member of this vocabulary.
  for (const arm of block.split(/^  \| /m).slice(1)) {
    const m = arm.match(/^\{ kind: '([A-Za-z0-9_]+)'/) ?? arm.match(/^\{\s*\n {6}kind: '([A-Za-z0-9_]+)'/)
    if (m?.[1]) members.push(m[1])
  }
  return members
}

/**
 * The members of a bare union of string literals, in declaration order.
 *
 * It REFUSES anything that is not a bare quoted literal rather than skipping
 * it. A regex that harvested `'…'` out of any type alias would return the
 * discriminator strings of a `kind:`-discriminated union, the arguments of an
 * `Exclude<…>`, and — worst — an empty list for a `typeof X[keyof typeof X]`
 * alias, which compares equal to an empty wire and reads as green. A member
 * this cannot parse is an error, never an omission.
 */
export function unionLiterals(text, typeName) {
  const lines = text.split('\n')
  const start = lines.findIndex(
    (l) => l === `export type ${typeName} =` || l.startsWith(`export type ${typeName} = `),
  )
  if (start === -1) throw new Error(`no \`export type ${typeName} =\` found`)

  let end = start + 1
  while (end < lines.length && !/^\S/.test(lines[end] ?? '')) end++

  const block = lines
    .slice(start, end)
    .join('\n')
    .slice(`export type ${typeName} =`.length)

  const body = block.trim()
  if (body.length === 0) throw new Error(`\`export type ${typeName}\` declares no members`)

  const members = []
  for (const raw of body.replace(/^\|/, '').split('|')) {
    const part = raw.trim()
    const m = part.match(/^'([^']*)'$/)
    if (!m || m[1] === undefined) {
      throw new Error(
        `\`export type ${typeName}\` is not a bare union of string literals — ` +
          `\`${part}\` is not one. Use the \`union\` source for a discriminated union, ` +
          `or \`const\` for a \`typeof X[keyof typeof X]\` alias.`,
      )
    }
    members.push(m[1])
  }
  return members
}

/** The VALUES of an `export const X = { … } as const`, in declaration order. */
export function constValues(text, constName) {
  const lines = text.split('\n')
  const start = lines.findIndex((l) => l.startsWith(`export const ${constName} = {`))
  if (start === -1) throw new Error(`no \`export const ${constName} = {\` found`)

  const members = []
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (/^\} as const/.test(line)) return members
    const m = line.match(/^ {2}[A-Za-z0-9_]+: '([^']*)',?\s*$/)
    if (m && m[1] !== undefined) members.push(m[1])
  }
  throw new Error(`\`export const ${constName}\` is not closed by \`} as const\``)
}

/** The VALUES of an `export const X = ['…'] as const`, in declaration order. */
export function constArrayValues(text, constName) {
  const lines = text.split('\n')
  const start = lines.findIndex((l) => l.startsWith(`export const ${constName} = [`))
  if (start === -1) throw new Error(`no \`export const ${constName} = [\` found`)
  const members = []
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (/^\] as const/.test(line)) return members
    const m = line.match(/^  '([^']*)',?\s*$/)
    if (m?.[1] !== undefined) members.push(m[1])
  }
  throw new Error(`\`export const ${constName}\` is not closed by \`] as const\``)
}

/** The string literals named as the second argument of an `Exclude<…>` alias. */
export function excludeArguments(text, typeName) {
  const m = text.match(new RegExp(`^export type ${typeName} = Exclude<([^>]*)>`, 'm'))
  if (!m || m[1] === undefined) throw new Error(`no \`export type ${typeName} = Exclude<…>\` found`)
  const comma = m[1].indexOf(',')
  if (comma === -1) throw new Error(`\`Exclude<…>\` on ${typeName} names nothing to subtract`)
  return [...m[1].slice(comma + 1).matchAll(/'([^']*)'/g)].map((x) => x[1])
}

/** The member list a pair's MODEL side declares. The model is the authority. */
export function modelMembers(pair, root = REPO_ROOT) {
  const text = readText(path.join(root, pair.model.file))
  switch (pair.model.source) {
    case 'union':
      return unionKinds(text, pair.model.name)
    case 'literal_union':
      return unionLiterals(text, pair.model.name)
    case 'const':
      return constValues(text, pair.model.name)
    case 'const_array':
      return constArrayValues(text, pair.model.name)
    case 'const_minus': {
      const all = constValues(text, pair.model.name)
      const dropped = new Set(excludeArguments(text, pair.model.excludeType))
      return all.filter((v) => !dropped.has(v))
    }
    default:
      throw new Error(`unknown model source \`${pair.model.source}\` on pair ${pair.name}`)
  }
}

// ---------------------------------------------------------------- wire side

/**
 * Indentation-structured lines. Blank lines and whole-line comments are dropped
 * — neither carries structure in the subset these contracts use.
 */
function structuredLines(text) {
  const out = []
  const raw = text.split('\n')
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i] ?? ''
    const indent = line.search(/\S/)
    if (indent === -1) continue
    const trimmed = line.slice(indent)
    if (trimmed.startsWith('#')) continue
    out.push({ n: i + 1, indent, text: trimmed })
  }
  return out
}

function minIndent(region) {
  let min = Infinity
  for (const l of region) if (l.indent < min) min = l.indent
  return min
}

function childrenOf(region, idx) {
  const own = region[idx]
  if (!own) return []
  let end = idx + 1
  while (end < region.length && (region[end]?.indent ?? -1) > own.indent) end++
  return region.slice(idx + 1, end)
}

function findKey(region, key) {
  if (region.length === 0) return -1
  const base = minIndent(region)
  return region.findIndex(
    (l) => l.indent === base && (l.text === `${key}:` || l.text.startsWith(`${key}: `)),
  )
}

function inlineValue(line) {
  const colon = line.text.indexOf(':')
  return line.text.slice(colon + 1).trim()
}

/** The members of an inline flow sequence `[a, b, c]`. */
function flowSequence(inline) {
  return inline
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter((s) => s.length > 0)
}

/**
 * The top-level entries of an inline flow mapping `{ type: string, enum: [a] }`.
 *
 * Splits on commas at bracket depth zero — a naive split would cut the enum
 * list in half and hand back a member list that is wrong rather than absent,
 * which is the failure mode worth spending ten lines to avoid.
 */
function flowEntries(inline) {
  const body = inline.trim().replace(/^\{/, '').replace(/\}$/, '')
  const parts = []
  let depth = 0
  let current = ''
  for (const ch of body) {
    if (ch === '[' || ch === '{') depth++
    else if (ch === ']' || ch === '}') depth--
    if (ch === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim().length > 0) parts.push(current)

  const entries = new Map()
  for (const part of parts) {
    const colon = part.indexOf(':')
    if (colon === -1) continue
    entries.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim())
  }
  return entries
}

/**
 * The remaining path keys, resolved INSIDE an inline flow mapping.
 *
 * Returns null — never [] — when the path does not land on a flow sequence, so
 * that `wireOccurrences` raises its "defines the schema but no list at path"
 * error instead of comparing the model against an empty wire.
 */
function resolveInFlow(inline, keys) {
  let value = inline
  for (let i = 0; i < keys.length; i++) {
    if (!value.startsWith('{')) return null
    const next = flowEntries(value).get(keys[i])
    if (next === undefined) return null
    value = next
  }
  return value.startsWith('[') ? flowSequence(value) : null
}

/** A list at `region[idx]` — either an inline flow sequence or a block sequence. */
function listAt(region, idx) {
  const line = region[idx]
  if (!line) return null
  const inline = inlineValue(line)
  if (inline.startsWith('[')) return flowSequence(inline)
  const kids = childrenOf(region, idx)
  if (kids.length === 0) return null
  const base = minIndent(kids)
  return kids
    .filter((l) => l.indent === base && l.text.startsWith('- '))
    .map((l) => l.text.slice(2).trim().replace(/^['"]|['"]$/g, ''))
}

/**
 * The schema block named `schemaName`, as `components.schemas.<name>`'s children.
 * Returns null when the file does not define it, and `{ alias: true }` when the
 * definition is a bare `$ref` to another file — an alias is not a definition and
 * comparing against it would report an empty wire vocabulary.
 */
function schemaRegion(text, schemaName) {
  const lines = structuredLines(text)
  const ci = findKey(lines, 'components')
  if (ci === -1) return null
  const components = childrenOf(lines, ci)
  const si = findKey(components, 'schemas')
  if (si === -1) return null
  const schemas = childrenOf(components, si)
  const idx = findKey(schemas, schemaName)
  if (idx === -1) return null
  const region = childrenOf(schemas, idx)
  if (region.length > 0 && findKey(region, '$ref') !== -1 && region.length === 1) {
    return { alias: true, region }
  }
  return { alias: false, region }
}

/** Every file defining `schema`, with the member list found at `path`. */
export function wireOccurrences(wireSpec, wireFiles) {
  const found = []
  for (const file of wireFiles) {
    const block = schemaRegion(readText(file), wireSpec.schema)
    if (!block || block.alias) continue
    let region = block.region
    let members = null
    for (let i = 0; i < wireSpec.path.length; i++) {
      const key = wireSpec.path[i]
      const idx = findKey(region, key)
      if (idx === -1) {
        region = []
        break
      }
      /* The vocabulary may be stated inline — `status: { type: string, enum:
       * [...] }` — in which case the rest of the path lives inside the flow
       * mapping and there are no child LINES to descend into. Before this
       * branch existed the descent produced an empty region and the throw
       * below, so no pair could be registered against the form at all. */
      if (inlineValue(region[idx]).startsWith('{')) {
        members = resolveInFlow(inlineValue(region[idx]), wireSpec.path.slice(i + 1))
        break
      }
      if (i === wireSpec.path.length - 1) {
        members = listAt(region, idx)
        break
      }
      region = childrenOf(region, idx)
    }
    if (members === null) {
      throw new Error(
        `${path.basename(file)} defines schema \`${wireSpec.schema}\` but no list at \`${wireSpec.path.join('.')}\``,
      )
    }
    found.push({ file, members })
  }
  return found
}

// ---------------------------------------------------------------- discovery

/**
 * True when any segment of `rel` is an excluded directory name.
 *
 * Applied to BOTH discovery paths. The git seed returns repository-relative
 * paths and never walks anything, so it needs the segment test rather than the
 * descent test — and it needs it for the same reason the walker does: the
 * fixtures are tracked, and several of them are deliberately drifted.
 */
export function isExcludedPath(rel) {
  return rel.split('/').some((segment) => EXCLUDED_DIR_NAMES.has(segment))
}

/**
 * The recursive disk walk. Exported and parameterised on the exclusion set so
 * `tests/tools/wire-mirror-discovery.test.mjs` can drive it with the HISTORICAL
 * set and witness the defect this file's header describes, rather than
 * asserting against a description of it.
 */
export function walkWireFiles(root = REPO_ROOT, excluded = EXCLUDED_DIR_NAMES) {
  const out = []
  const walk = (dir) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (excluded.has(entry.name)) continue
        walk(full)
      } else if (entry.isFile() && entry.name.endsWith('.openapi.yaml')) {
        out.push(full)
      }
    }
  }
  walk(root)
  return out.sort()
}

/**
 * The git seed. Returns repository-relative paths, or `null` with a reason when
 * `git` cannot answer — never throws, because a checker that dies on a missing
 * binary is a gate nobody can run offline.
 *
 * `--cached` and nothing else: the tracked tree, not the index plus whatever
 * else is lying about. `-z` because a path may contain anything but NUL, and
 * git's default quoting of odd bytes would otherwise be parsed as the filename.
 */
export function gitTrackedWireFiles(root = REPO_ROOT) {
  let stdout
  try {
    stdout = execFileSync('git', ['ls-files', '--cached', '-z', '--', '*.openapi.yaml'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 8 * 1024 * 1024,
    })
  } catch (error) {
    const detail = (error?.stderr || error?.message || String(error)).trim().split('\n')[0]
    return { files: null, reason: `\`git ls-files\` failed: ${detail}` }
  }
  return { files: stdout.split('\0').filter(Boolean), reason: null }
}

/**
 * Every real contract file — the TRACKED tree, fixtures excluded.
 *
 * Returns `{ files, source, notice }`. `source` is `'git'` or `'walk'`, and
 * `notice` is non-null only on the degraded path, where the caller is required
 * to print it. See the header for why the disk walk is the fallback and not the
 * primary.
 */
export function discoverWireFilesDetailed(root = REPO_ROOT) {
  const { files, reason } = gitTrackedWireFiles(root)

  if (files === null) {
    return {
      files: walkWireFiles(root),
      source: 'walk',
      notice:
        `DISCOVERY UNAVAILABLE — ${reason}. Fell back to a recursive disk walk of ` +
        `${root}, excluding [${[...EXCLUDED_DIR_NAMES].join(', ')}]. The set of ` +
        `contracts compared is now a function of THIS DISK rather than of the ` +
        `tracked tree: a checkout parked under a directory name not in that list ` +
        `will be read, and its contracts compared against the current model. ` +
        `Non-fatal on purpose — this run still asserts, it just cannot promise ` +
        `that what it asserted over is what is committed.`,
    }
  }

  const kept = files.filter((rel) => !isExcludedPath(rel))
  /* A tracked path may be absent from the working tree — mid-`git rm`, a sparse
   * checkout, a bad merge. Reading it would throw inside the scanner and read
   * as a parse failure, which is the wrong diagnosis for a missing file. */
  const present = kept.map((rel) => path.join(root, rel)).filter((full) => existsSync(full))
  return { files: present.sort(), source: 'git', notice: null }
}

/** Back-compatible shape: the file list alone. */
export function discoverWireFiles(root = REPO_ROOT) {
  return discoverWireFilesDetailed(root).files
}

// ---------------------------------------------------------------- comparison

function sameSequence(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/**
 * Compare every pair. Returns findings, the pairs actually compared, and the
 * comparisons themselves — `pairsCompared` exists because a registry that
 * silently dropped an entry would otherwise read as green forever.
 */
export function checkPairs({ pairs = PAIRS, wireFiles, root = REPO_ROOT } = {}) {
  /* `--wire` replaces discovery outright, so it reports its own source rather
   * than borrowing git's — otherwise a run over hand-named files would claim a
   * provenance it does not have. */
  const discovery =
    wireFiles === undefined
      ? discoverWireFilesDetailed(root)
      : { files: wireFiles, source: 'explicit', notice: null }
  const files = discovery.files
  const findings = []
  const comparisons = []

  for (const pair of pairs) {
    const model = modelMembers(pair, root)
    const occurrences = wireOccurrences(pair.wire, files)

    if (occurrences.length === 0) {
      findings.push({
        kind: UNMIRRORED,
        pair: pair.name,
        file: null,
        missing: [],
        extra: [],
        orderMismatch: false,
        message:
          `${pair.name}: no contract file defines schema \`${pair.wire.schema}\`. ` +
          `The model declares ${model.length} member(s) that reach no wire vocabulary.`,
      })
      continue
    }

    for (const occurrence of occurrences) {
      const wire = occurrence.members
      const rel = path.relative(root, occurrence.file).split(path.sep).join('/')
      comparisons.push({ pair: pair.name, file: rel, model, wire })

      const missing = model.filter((m) => !wire.includes(m))
      const extra = wire.filter((w) => !model.includes(w))
      const orderMismatch = missing.length === 0 && extra.length === 0 && !sameSequence(model, wire)

      if (missing.length === 0 && extra.length === 0 && !orderMismatch) continue

      const parts = []
      if (missing.length > 0) parts.push(`missing from the wire: ${missing.join(', ')}`)
      if (extra.length > 0) parts.push(`on the wire but not in the model: ${extra.join(', ')}`)
      if (orderMismatch) {
        parts.push(
          `same members, DIFFERENT ORDER — model: [${model.join(', ')}] wire: [${wire.join(', ')}]`,
        )
      }

      findings.push({
        kind: DRIFT,
        pair: pair.name,
        file: rel,
        missing,
        extra,
        orderMismatch,
        message: `${pair.name}: ${rel} \`${pair.wire.schema}\` — ${parts.join('; ')}`,
      })
    }
  }

  return {
    findings,
    comparisons,
    pairsCompared: comparisons.length,
    discovery: {
      source: discovery.source,
      notice: discovery.notice,
      fileCount: files.length,
    },
  }
}

export function formatReport(result) {
  const drift = result.findings.filter((f) => f.kind === DRIFT)
  const unmirrored = result.findings.filter((f) => f.kind === UNMIRRORED)
  const out = []
  const discovery = result.discovery ?? { source: 'unknown', notice: null, fileCount: 0 }

  const sourceLabel = {
    git: 'the TRACKED tree (`git ls-files`)',
    walk: 'a recursive DISK walk (degraded — see below)',
    explicit: '`--wire`, which replaced discovery',
    unknown: 'an unrecorded source',
  }[discovery.source]
  out.push(
    `wire mirror: ${discovery.fileCount} contract file(s) from ${sourceLabel}; ` +
      `${result.pairsCompared} pair(s) compared.`,
  )
  for (const c of result.comparisons) {
    out.push(`  ok? ${c.pair} → ${c.file} (${c.wire.length} member(s))`)
  }
  if (discovery.notice !== null) {
    out.push('')
    out.push(`⚠️ ${discovery.notice}`)
  }
  if (unmirrored.length > 0) {
    out.push('')
    out.push(`UNMIRRORED (${unmirrored.length}) — reported, does not fail the run:`)
    for (const f of unmirrored) out.push(`  • ${f.message}`)
  }
  out.push('')
  if (drift.length === 0) {
    out.push('DRIFT (0). Every compared pair mirrors its model declaration, in order.')
  } else {
    out.push(`DRIFT (${drift.length}):`)
    for (const f of drift) out.push(`  ✖ ${f.message}`)
  }

  out.push('')
  out.push('⚠️ WHAT THIS RUN DID NOT CHECK. It compares only the pairs registered in')
  out.push('   PAIRS, and only where the vocabulary is a schema under')
  out.push('   `components.schemas`. It does NOT resolve `$ref` targets, and it cannot')
  out.push('   address a vocabulary restated in a PARAMETER, a request body, an example')
  out.push('   or a description — the run-status strings are also written inline at the')
  out.push('   `/runs` `status` query parameter, and no pair reaches that copy.')
  out.push('   `literal_union` reads a bare union of string literals and THROWS on any')
  out.push('   member that is not one, so a union it cannot parse fails loudly rather')
  out.push('   than comparing an empty list. Silence here is not evidence of absence.')
  out.push('   It reads the TRACKED tree, so a contract file written but not yet')
  out.push('   `git add`ed is compared by nothing and shows up only as a pair count')
  out.push('   that did not move.')
  return out.join('\n')
}

// ---------------------------------------------------------------- cli

function parseArgv(argv) {
  const wire = []
  let names = null
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--wire') {
      const value = argv[++i]
      if (value === undefined) throw new Error('--wire needs a file')
      wire.push(path.resolve(value))
    } else if (arg === '--pairs') {
      const value = argv[++i]
      if (value === undefined) throw new Error('--pairs needs a comma-separated list')
      names = value.split(',').map((s) => s.trim()).filter(Boolean)
    } else {
      throw new Error(`unknown argument \`${arg}\``)
    }
  }
  return { wire, names }
}

function main(argv) {
  const { wire, names } = parseArgv(argv)

  let pairs = PAIRS
  if (names !== null) {
    pairs = names.map((n) => {
      const found = PAIRS.find((p) => p.name === n)
      if (!found) throw new Error(`no registered pair named \`${n}\``)
      return found
    })
  }

  for (const file of wire) {
    if (!existsSync(file)) throw new Error(`--wire file does not exist: ${file}`)
  }

  const result = checkPairs({ pairs, ...(wire.length > 0 ? { wireFiles: wire } : {}) })
  process.stdout.write(`${formatReport(result)}\n`)

  /**
   * THE ANTI-VACUOUS GUARD — G1477, AND IT WAS WITNESSED RED.
   *
   * Until 21 Sep 2026 a run that compared nothing printed
   *
   *     wire mirror: 0 contract file(s) …; 0 pair(s) compared.
   *     DRIFT (0). Every compared pair mirrors its model declaration, in order.
   *
   * and EXITED 0. **Read the second line against a zero on the first**: it is
   * a true sentence about an empty set and it is the sentence a reader takes
   * as the all-clear — `docs/build/completion-plan.md` K4, and
   * `docs/HANDOFF.md` §5.6 inside a checker whose own tail already warns
   * *"Silence here is not evidence of absence."*
   *
   * 🛑 AND THIS CHECKER HAS BEEN IN EXACTLY THIS STATE BEFORE, WHICH IS WHY
   * THE GUARD IS NOT PARANOIA. The note at the foot of this file records that
   * until 12 Aug 2026 a `file://` main-module test made the whole body skip on
   * any path containing a space, so `npm run check:wire` *"exited 0 having
   * compared nothing"*. That defect was fixed; **the STATE it produced was
   * never made detectable**, and this is what makes it so.
   *
   * TWO NUMBERS, BECAUSE THEY FAIL SEPARATELY. Zero FILES means discovery
   * broke — a failed listing, a rename, a checkout with no contracts. Zero
   * PAIRS with files present means every registered pair missed its schema,
   * which is the drift this checker exists to find, arriving as silence
   * instead of as a finding.
   *
   * ⚠️ IT IS NOT A FLOOR ON THE REGISTRY. `--pairs` legitimately narrows the
   * comparison to one name, and that run still compares one pair. What is
   * refused is comparing NONE. The gate passes no argument at all
   * (`tests/ci/gate-stages.test.ts`, K3), so on the gate's own invocation this
   * reads the whole registry against the whole tracked corpus.
   */
  const fileCount = result.discovery?.fileCount ?? 0
  if (fileCount === 0 || result.pairsCompared === 0) {
    process.stdout.write('\n')
    process.stdout.write(
      fileCount === 0
        ? 'NO CONTRACT FILES DISCOVERED — every verdict above would be vacuous.\n'
        : `${fileCount} CONTRACT FILE(S) AND NOT ONE PAIR COMPARED — every verdict above would be vacuous.\n`,
    )
    process.stdout.write('  `DRIFT (0)` over zero comparisons is a true sentence about an empty set and\n')
    process.stdout.write('  reads exactly like an all-clear. This checker has exited 0 having compared\n')
    process.stdout.write('  nothing once before — see the note at the foot of this file. Fix the\n')
    process.stdout.write('  derivation; do not delete the assertion.\n')
    return 1
  }

  return result.findings.some((f) => f.kind === DRIFT) ? 1 : 0
}

// 🛑 The `file://${process.argv[1]}` form used here until 12 Aug 2026 made THIS
// CHECKER PASS VACUOUSLY on any path containing a space: import.meta.url
// percent-encodes and process.argv[1] does not, so the body never ran and
// `npm run check:wire` exited 0 having compared nothing. A gate that cannot fail
// is not a gate. tools/check-pack-safety.mjs had the correct form all along.
const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (err) {
    process.stderr.write(`check-wire-mirror: ${err.message}\n`)
    process.exitCode = 2
  }
}
