/**
 * model/ must be runtime-importable.
 *
 * Three of the then-sixteen modules could not be loaded by `node --test` at all
 * before this landed — model/agents.ts, model/examples.ts and
 * model/observability.ts each carried an extensionless VALUE import, and node's
 * ESM resolver does not add an extension. The other thirteen loaded only
 * because every one of their inter-module imports is `import type`, which
 * `verbatimModuleSyntax` erases before the loader ever sees it.
 *
 * ⚠️ READ THIS BEFORE TRUSTING THE WEAKER TESTS. The three
 * `*_across_the_module_boundary` / `*_after_loading` tests below each
 * dereference ONE value that crossed ONE module boundary. They are witnesses
 * that the module loaded and is usable; they are NOT witnesses that every
 * value specifier in it resolves. Specifically,
 * `test_agents_classifies_send_correspondence_as_egress_after_loading` reads
 * `TOOL_EFFECT`, which is declared inside agents.ts — it does NOT exercise the
 * `./domain.ts` value import, whose only dereference is inside
 * `validateAgentToolBindings()` at model/agents.ts:949. What witnesses that
 * specifier is module LOAD success, which
 * `test_every_model_module_on_disk_loads_under_node_without_a_module_resolution_error`
 * asserts by name. Do not mistake the weaker test for the stronger one.
 *
 * Every expected value below is a literal typed into this file. Comparing a
 * model constant against itself would pass with the import removed.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const MODEL_DIR = join(REPO_ROOT, 'model')

/**
 * CLAUDE.md's own reproduction of this number is `ls model/*.ts | wc -l`. It is
 * written here as a literal on purpose: a sweep over a mis-globbed or empty
 * list passes while asserting nothing.
 */
/* 16 -> 17 on 8 Aug 2026 when model/reconciliation.ts landed. 19 -> 20 on
 * 22 Aug 2026 when model/session.ts landed under G225, and 20 -> 21 the same day
 * when model/field-path.ts landed under G214 on a SECOND branch. Both branches
 * wrote 20 and the merged tree is 21 — a count is a fact about a tree, and a
 * merge makes a new tree. This control went RED on each, which is what it is for.
 * The literal MOVES with the tree; it is not derived from it, because a sweep
 * over a mis-globbed or empty list would otherwise pass while asserting
 * nothing. Derive the replacement — `ls model/*.ts | wc -l` — never increment.
 *
 * 21 -> 22 on 23 Aug 2026 when model/serving-host.ts landed under G225, closing
 * G179's circularity. This control went RED on it, as it should.
 *
 * 22 -> 23 on 24 Aug 2026 when model/ingestion.ts landed under G225, carrying
 * G184's one intake vocabulary, G205's `Arrival` and G206's classification
 * rules. It went RED on this one too. `model/ingestion.ts` has been a
 * `module_specified_not_written` gap in `docs/model-graph.json` since the graph
 * had gaps — a document promising a file — and G225 is the ruling that the
 * seven promised files land and the count is swept rather than defended.
 *
 * 23 -> 24 when model/held-work.ts landed.
 *
 * 24 -> 25 on 19 Sep 2026 when model/money.ts landed under G286 — G111's money
 * codec, which that ruling has called for since 8 Aug 2026 and which nothing had
 * ever written. This control went RED on it, as it should. ⚠️ It is the first
 * new module here that is a MOVE rather than an addition: `model/reconciliation.ts`
 * §3 became this file, so the module count rose while the declarations did not.
 *
 * 25 -> 26 on 19 Sep 2026 when model/onboarding.ts landed under G535 — H2's
 * onboarding sequence, and the pack's own *"Onboarding state in the model:
 * NOT BUILT"* row closed in the MODEL sense. This control went RED on it, as
 * it should, in BOTH source-text tests at once. ⚠️ It IMPORTS NOTHING — no
 * value import and no type-only one — so the two inventories below are
 * unchanged and only the denominator moved, which is the case this control is
 * weakest at noticing and the reason `filesRead` is asserted separately from
 * the site lists.
 *
 * 26 -> 27 on 19 Sep 2026 when model/approval.ts landed under G658 — the FIRST
 * evaluator `ApprovalConfig.quorum` and `segregationOfDuties` have ever had.
 * This control went RED on it, as it should, in BOTH source-text tests at once.
 * ⚠️ It carries ONE VALUE IMPORT — `compareMoney` from `./money.ts` — so
 * unlike `onboarding.ts` it moves the value-import inventory as well as the
 * denominator, which is the case this control is STRONGEST at noticing: an
 * extensionless value import here would make the module unloadable by Node
 * while `tsc` stayed green.
 *
 * 28 -> 29 on 21 Sep 2026 when model/extraction.ts landed under G1451-G1459
 * (E2) — the ONE conversion seam between a stored position and an
 * `ExtractedValue`. This control went RED on it, as it should, and it is the
 * `run-admission.ts` case rather than the `onboarding.ts` one: the module
 * carries THREE VALUE IMPORTS — `./domain.ts`, `./ingestion.ts` and
 * `./money.ts` — so it moves the value-import inventory as well as the
 * denominator, which is where this file is strongest. **`./ingestion.ts` is
 * the one to read**: `FIDELITY_CROSSES_MANAGED_SERVICE` is IMPORTED rather
 * than restated, so R12's fence and the classification cascade cannot drift
 * apart (§5.3) — and an extensionless spelling of exactly that import is the
 * defect that made three `model/` modules unloadable on 8 Aug 2026 while
 * `tsc` stayed green.
 *
 *
 * 🛑 29 -> 30 on 21 Sep 2026, AND 29 WAS A THIRD ANSWER NEITHER PARENT EVER
 * COMPUTED — §5.11 WITH A SECOND PARENT, ARRIVING IN THIS CONTROL FOR THE
 * SECOND TIME AND IN ITS WORST FORM YET. **Both branches edited
 * `MODULE_COUNT` from 28 to 29 and both edited `assert.equal(MODULE_COUNT, 28)`
 * to 29 — the SAME two lines, to the SAME value — so `git merge` found the two
 * sides IDENTICAL here and took them with NO CONFLICT AT ALL.** The 28 case
 * narrated below at least produced a conflict marker for a human to read; this
 * one produced nothing. `model/extraction.ts` (G1451-G1459) landed on one
 * branch and `model/session-mint.ts` (G1601-G1612) on the other, each correctly
 * calling itself the 29th, and the merged tree holds **30**.
 * ⚠️ **AND THE GATE WOULD HAVE CAUGHT IT — this file is the control that
 * exists for exactly this** — but only at `npm test`, on a merged tree nobody
 * had run yet, which is why a per-branch green says nothing about a merge.
 * Both parents' narrations are kept: the extraction paragraph above, and the
 * session-mint paragraph at its own entry in the value-import inventory below.
 * Re-derived by hand on the merged tree: `ls model/*.ts | wc -l` -> 30.
 * 🛑 AND 28 WAS A THIRD ANSWER NEITHER PARENT EVER COMPUTED — §5.11 WITH A
 * SECOND PARENT, ARRIVING IN THE ONE CONTROL THAT EXISTS TO CATCH A MODULE
 * COUNT GOING WRONG. **Both branches wrote `26 -> 27` on 19 Sep 2026 and each
 * was correct about its own tree**: `model/approval.ts` (G658) on one,
 * `model/run-admission.ts` (G692) on the other. The merged tree is **28**,
 * which neither side ever wrote down, and a merge that took either
 * narration's number would have looked textually clean and been wrong. Both
 * narrations are kept, because each is right about the branch that wrote it
 * and deleting one would erase a control that really fired. Re-derived by
 * hand on the merged tree: `ls model/*.ts | wc -l`.
 *
 * 26 -> 27 on 19 Sep 2026 when model/run-admission.ts landed under G692 — the
 * run-admission cascade, and the executable form of a sentence
 * `RUN_TRIGGER_KINDS` has carried in prose since 5 Aug 2026. This control went
 * RED on it, as it should, in ALL THREE assertions at once. ⚠️ It carries ONE
 * VALUE IMPORT — `import { canonicalise } from './canonical.ts'` — which is
 * the case this file exists for: three of the sixteen modules could not be
 * LOADED by node on 8 Aug 2026 for exactly the omission of that extension,
 * while `tsc` stayed green throughout. Its three type-only specifiers stay
 * extensionless, so both inventories moved and the denominator with them.
 */
/*
 * 30 -> 31 on 1 Oct 2026 — `model/partner-portal.ts` (W5, G2633–G2640). Every
 * one of its imports is `import type`, so NEITHER inventory below moves; this
 * control went RED on the count alone, in all three assertions, which is the
 * shape `ingestion.ts`'s arrival recorded.
 */
/*
 * 31 -> 32 on 4 Oct 2026 — `model/publication.ts` (U-29, G4201). It carries
 * THREE value imports, every one written with its `.ts` extension
 * (`./domain.ts`, `./ingestion.ts`, `./field-path.ts`), and two type-only
 * specifiers left extensionless. Red on the count first, then this.
 */
const MODULE_COUNT = 32

/** The module list comes from the tree, never from a hand-written array. */
function modelModuleFilenames(): string[] {
  return readdirSync(MODEL_DIR)
    .filter((name) => name.endsWith('.ts'))
    .sort()
}

/**
 * Attempts a real runtime load. Returns `null` on success, or a NAMED failure
 * string on failure — never a bare boolean, so the assertion can name what
 * broke rather than compare a count that a swallowing catch never populated.
 *
 * `test_the_import_helper_reports_a_failure_for_a_module_path_that_does_not_exist`
 * exists solely to prove this can produce a non-empty failure list. Without it,
 * a green sweep proves nothing.
 */
async function importFailure(repoRelativePath: string): Promise<string | null> {
  try {
    await import(pathToFileURL(join(REPO_ROOT, repoRelativePath)).href)
    return null
  } catch (error) {
    const code = (error as { code?: string }).code
    return `${repoRelativePath}: ${code ?? String(error)}`
  }
}

interface SpecifierSite {
  /** `model/agents.ts:93` */
  readonly at: string
  /** The relative module specifier as written, e.g. `./access.ts`. */
  readonly specifier: string
  /** True for `import type` / `export type`, which the compiler erases. */
  readonly typeOnly: boolean
}

/**
 * Every relative module specifier in model/, read from disk and classified as
 * type-only or value. A declaration may span several lines, so the type-only
 * flag is carried forward from the `import` / `export` keyword line to the
 * `} from '…'` line that closes it.
 */
function relativeSpecifierSites(): { sites: SpecifierSite[]; filesRead: number } {
  const sites: SpecifierSite[] = []
  const filenames = modelModuleFilenames()
  for (const filename of filenames) {
    const lines = readFileSync(join(MODEL_DIR, filename), 'utf8').split('\n')
    let pendingTypeOnly: boolean | null = null
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? ''
      const declaration = /^(?:import|export)\s+(type\s+)?/.exec(line)
      if (declaration !== null) {
        pendingTypeOnly = declaration[1] !== undefined
      }
      const specifierMatch = /from '(\.\/[^']*)'/.exec(line)
      if (specifierMatch === null) continue
      const specifier = specifierMatch[1]
      if (specifier === undefined) continue
      sites.push({
        at: `model/${filename}:${index + 1}`,
        specifier,
        /* Default to type-only: an unclassifiable site must not be silently
         * counted as a value import the value assertion then fails to see. */
        typeOnly: pendingTypeOnly ?? true,
      })
      pendingTypeOnly = null
    }
  }
  return { sites, filesRead: filenames.length }
}

/* ------------------------------------------------------------------ *
 * 1. The load sweep
 * ------------------------------------------------------------------ */

test('test_every_model_module_on_disk_loads_under_node_without_a_module_resolution_error', async () => {
  const failures: string[] = []
  for (const filename of modelModuleFilenames()) {
    const failure = await importFailure(join('model', filename))
    if (failure !== null) failures.push(failure)
  }
  /* Named, not counted. `assert.ok(failures.length === 0)` on an array a
   * swallowing catch never filled is the defect this shape exists to avoid. */
  assert.deepEqual(failures, [])
})

test('test_the_sweep_walks_exactly_twenty_modules_read_from_disk_not_from_a_hand_written_list', () => {
  const filenames = modelModuleFilenames()
  assert.equal(filenames.length, MODULE_COUNT)
  assert.equal(MODULE_COUNT, 32)
  /* Two modules that must be in any honest list of model/, one of them dropped
   * whole for v1 — a filter that quietly excluded either would still count 18
   * only by accident. */
  assert.ok(filenames.includes('agents.ts'))
  assert.ok(filenames.includes('presentation.ts'))
  /* The twentieth, G225. It imports nothing at all — so it appears in NEITHER
   * specifier list below, and the load sweep above is the only witness that it
   * resolves. Named here so a filter that quietly dropped it would still have
   * to explain a count of 19. */
  assert.ok(filenames.includes('session.ts'))
  /* The twenty-third, G225/G184/G205/G206. Like `session.ts` it appears in
   * NEITHER specifier list below — every one of its imports is `import type`,
   * so it has no value specifier to check — and the load sweep above is the
   * only witness that it resolves. Named here so a filter that quietly dropped
   * it would still have to explain a count of 22. */
  assert.ok(filenames.includes('ingestion.ts'))
})

test('test_the_import_helper_reports_a_failure_for_a_module_path_that_does_not_exist', async () => {
  const failure = await importFailure(join('model', 'no-such-module.ts'))
  assert.equal(failure, 'model/no-such-module.ts: ERR_MODULE_NOT_FOUND')
})

/* ------------------------------------------------------------------ *
 * 2. The source text
 * ------------------------------------------------------------------ */

test('test_no_value_import_in_model_omits_its_file_extension', () => {
  const { sites, filesRead } = relativeSpecifierSites()
  assert.equal(filesRead, MODULE_COUNT)
  const valueImports = sites
    .filter((site) => !site.typeOnly)
    .map((site) => `${site.at} ${site.specifier}`)
  /* Named site-by-site, not counted: a regex that matched zero lines in zero
   * files would report "no extensionless value imports" and assert nothing. */
  assert.deepEqual(valueImports, [
    /* 🛑 G289, 19 Sep 2026 — A WIDENING RATHER THAN A SHIFT, AND THE LARGEST ONE
     * IN THIS INVENTORY, BECAUSE IT IS `model/access.ts`'s FIRST VALUE IMPORT
     * EVER. That module's own docblock said of its `governance` import: *"Imported
     * as a type so there is no runtime edge between the two modules"* — and the
     * platform arm must READ `NON_DELEGABLE_RESOURCES` and
     * `CONTRACT_ONLY_RESOURCES` rather than restate them, because a second
     * encoding of a safety list is what made G60 inert for eight days.
     *
     * ⚠️ THE CYCLE QUESTION IS THE ONE THIS ENTRY EXISTS TO MAKE SOMEBODY ASK.
     * `model/governance.ts` reaches back with `import type { OrgClass } from
     * './access'`, which `verbatimModuleSyntax` erases before the loader sees it,
     * so the runtime edge is one-way — and the load sweep in §1 above is what
     * witnesses that rather than this line. If a VALUE import ever lands in
     * `governance.ts` pointing here, §1 goes red, not this test.
     *
     * ⚠️ `:108` -> `:139` ON 19 Sep 2026, S-21, AND IT IS A WIDENING OF THE SAME
     * IMPORT RATHER THAN A SHIFT OF IT. The specifier list went from two names
     * to five — `MAX_GRANT_HOURS`, `authorisationPermits` and `hoursBetween`
     * joined the two lists — because `selectTenantForSession()`'s staff arm must
     * test ALL THREE governance lists *"in ONE helper with ONE call site"*
     * (G167, carried through its own reversal by G199) and must read G292's
     * ceiling rather than restate it. **The line number moved because the
     * DOCBLOCK above the import grew, not because the import did**, which is
     * the usual reason a number in this inventory moves and the reason each
     * entry carries its own note. */
    'model/access.ts:139 ./governance.ts',
    /* 🛑 G726/G727, 19 Sep 2026 — `model/access.ts`'s SECOND value import, and
     * it is the same argument G289's made one entry down: `resolveSubject()`
     * takes `SERVED_SURFACE_KINDS` from the module that OWNS the two host
     * registries rather than restating `'tenant' | 'console'` beside its own
     * reader. A restated union would be `0002_run.sql`'s *"third place to
     * drift — and the one nothing checks."* The `.ts` extension is what makes
     * the module loadable by Node at all, which is this inventory's subject. */
    'model/access.ts:161 ./serving-host.ts',
    'model/agents.ts:93 ./access.ts',
    'model/agents.ts:99 ./catalog.ts',
    'model/agents.ts:100 ./domain.ts',
    /* 🛑 ADDED 19 Sep 2026 — `model/approval.ts` (G658), and it is the whole
     * reason this inventory is worth maintaining. `onboarding.ts` moved only
     * the denominator because it imports nothing; this module has ONE value
     * import, `compareMoney`, and an extensionless one here would make it
     * unloadable by Node while `tsc` stayed green — the exact class that took
     * three modules down on 8 Aug 2026. */
    'model/approval.ts:76 ./money.ts',
    /* :32 -> :34 and :34 -> :36 on 9 Aug 2026, when G129's autonomy-gate
     * fixture added `REVERSIBILITY` to the first of these imports. The
     * SPECIFIERS are unchanged; only the lines moved.
     *
     * ⚠️ ALL FOUR `examples.ts` LINES MOVED AGAIN ON 22 Aug 2026 — :44/:46/:48/:70
     * to :49/:51/:53/:75 — when #222 and #223 added the session line's four type
     * imports to the `./domain` block and two to the `./kernel` block. AGAIN THE
     * SPECIFIERS ARE UNCHANGED and again only the lines moved, which is exactly
     * what this control is for: it is pinned to a `file:line` on purpose, so a
     * value import that CHANGES cannot hide behind one that merely SHIFTED.
     * Every entry here is swept by hand in the commit that moves it; do not
     * relax it to a specifier-only list, because then a new extensionless value
     * import in a file that already has one would pass.
     *
     * ⚠️ AND THEY MOVED AGAIN ON 24 Aug 2026 — :49/:51/:53/:75 to
     * :50/:60/:62/:84 — when G206's corpus added the `./ingestion` type import
     * and the `./reconciliation` one beside it. **This time a SPECIFIER changed
     * too**, and the two are listed separately below so the difference is not
     * lost in a line sweep: a shift is this control doing its job, a new
     * specifier is the finding it exists to surface. */
    'model/examples.ts:50 ./domain.ts',
    /* G184/G206, 24 Aug 2026 — THE NEW ONE, and the only entry in this
     * inventory that is a widening rather than a shift. The corpus writes
     * `INTAKE_CHANNEL_KINDS.mailbox` rather than the string `'mailbox'`, so a
     * fixture cannot become the second intake vocabulary G184 forbids — and
     * reading a const is a VALUE. `model/domain.ts`'s type-only import BACK to
     * `./ingestion` is erased, so the runtime edge stays one-way and there is
     * still no cycle. `model/ingestion.ts` itself takes NO value import at all
     * and therefore appears nowhere in this list. */
    'model/examples.ts:59 ./ingestion.ts',
    'model/examples.ts:60 ./connectors.ts',
    'model/examples.ts:62 ./access.ts',
    /* G214, 22 Aug 2026. `FieldPath` became a token list, so a fixture can no
     * longer write one as a literal — it goes through `parseFieldPath()`, the
     * one seam, which is a VALUE. That is the widening this whole inventory
     * exists to make visible rather than convenient. */
    'model/examples.ts:84 ./field-path.ts',

    /* 🛑 G1451-G1459, 21 Sep 2026 — E2's THREE VALUE IMPORTS, and the middle
     * one is the load-bearing entry in this whole inventory.
     *
     * `./ingestion.ts` is imported for `FIDELITY_CROSSES_MANAGED_SERVICE`,
     * the total `Record<AcquisitionFidelity, boolean>` that R12's fence is
     * keyed on. **It is IMPORTED rather than restated on purpose**: a second
     * copy would be §5.3 — two implementations of one order, and the one that
     * drifts is always the copy — and the drift would be silent in the worst
     * direction, admitting an OCR path here while the classification cascade
     * refuses it there. So this is a value edge that MUST exist, and an
     * extensionless spelling of it would make `model/extraction.ts`
     * unloadable by Node while `tsc` stayed green, which is the exact defect
     * that hit three modules on 8 Aug 2026.
     *
     * `./domain.ts` is `DATA_TYPES` (G1453 — minted there beside
     * `DATA_CLASSES`, so both readers derive one member set rather than
     * keeping two), and `./money.ts` is `parseMoneyWire`, which G111 makes the
     * only conversion permitted to touch a money representation. */
    'model/extraction.ts:148 ./domain.ts',
    'model/extraction.ts:156 ./ingestion.ts',
    'model/extraction.ts:158 ./money.ts',
    /* G128, 9 Aug 2026. `learning.ts` took its first value import so that
     * `PROMOTE_LEARNING_CAPABILITY` can BE `CAPABILITIES.promoteLearning`
     * rather than a string that spells it. Listed here because this inventory
     * is the control that catches an extensionless one. */
    'model/learning.ts:92 ./access.ts',
    'model/observability.ts:44 ./billing.ts',
    /* G3561, 3 Oct 2026 — the owner's ruling makes a deal's value `Money`, and
     * `checkDealRegistrationShape()` must ask the codec's own guards whether it
     * is whole, positive money rather than restating them (G111). */
    'model/partner-portal.ts:26 ./money.ts',
    /* G4201, 4 Oct 2026 — `model/publication.ts`, the publication seam's
     * refusal logic. Three value imports: it must READ the model's closed
     * vocabularies and G134's `FIDELITY_CROSSES_MANAGED_SERVICE` rather than
     * restate them, and must CALL `validatePackClassificationRules()` and
     * `fieldPathKey()` rather than reimplement them. The runtime edges are
     * one-way: none of the three imports anything back as a value. */
    'model/publication.ts:62 ./domain.ts',
    'model/publication.ts:67 ./ingestion.ts',
    'model/publication.ts:69 ./field-path.ts',
    /* G129 and G124, 9 Aug 2026. `reconciliation.ts` took its first two value
     * imports so that §10's residue-side disposition pass can CALL
     * `mayAutoResolve()` — which had a fixture and no production caller — and
     * `extractionInSetHolds()`, rather than re-deriving either. The module had
     * been type-import-only, and its own header control moved from `→ 0` to
     * `→ 2` in the same commit. Both carry `.ts`, which is what this test is
     * for; `model/domain.ts`'s type-only import BACK to this module is erased,
     * so the runtime edge stays one-way and there is still no cycle. */
    /* :139 -> :159 and :145 -> :165 on 16 Aug 2026, when O-16 added the G153
     * block to the module header. THE SPECIFIERS ARE UNCHANGED; only the lines
     * moved — the same class of movement the note above records, and the reason
     * this inventory pins `file:line` rather than a count.
     *
     * ⚠️ AND ALL THREE MOVED AGAIN BY ONE ON 23 Aug 2026, when G236/G227 added
     * `ControlTotal` to the type-only import block above them. THE SPECIFIERS
     * ARE STILL UNCHANGED and no fourth value import was taken — which is the
     * only thing this inventory is asserting. A line that moves is this test
     * doing its job; a SPECIFIER that changes is the finding. */
    'model/reconciliation.ts:160 ./domain.ts',
    'model/reconciliation.ts:166 ./policy.ts',
    /* G214, 22 Aug 2026 — the engine's THIRD value import, and the argument for
     * it is the same one that forbids a fourth. A `FieldPath` is an array, so it
     * cannot key the classification map invariant 4 rests on; the key comes from
     * `fieldPathKey()`. The engine could have derived that key itself, and that
     * is exactly the second implementation of the representation G214 forbids —
     * so it imports the seam instead. `tests/model/reconciliation-controls.test.ts`
     * carries the matching allow-list entry, by exact text. */
    'model/reconciliation.ts:170 ./field-path.ts',
    /* G286/G111, 19 Sep 2026 — the engine's FOURTH value import, and the
     * argument for it is the argument against every previous one running the
     * other way. §3 WAS the money vocabulary and lived in this file; G111 has
     * ruled since 8 Aug 2026 that ONE codec module owns the representation, and
     * §3's own header predicted its own move — *"when it lands, this section
     * collapses into a call to it."* So this import is not the engine taking on
     * a dependency it could have avoided; it is the engine giving up something
     * it should never have held. It carries `.ts`, which is what this test is
     * for, and `model/money.ts` takes NO value import at all — one type import
     * and nothing else — so it appears nowhere else in this list and there is no
     * cycle. `tests/model/reconciliation-controls.test.ts` carries the matching
     * allow-list entry by exact text, which is why the specifier is written on
     * ONE line in the module against the house style. */
    'model/reconciliation.ts:184 ./money.ts',
    /* ⚠️ AND THE SECOND SITE IS A RE-EXPORT, NOT AN IMPORT, WHICH IS EXACTLY
     * WHY THIS SCAN IS RIGHT TO SEE IT. `export { … } from './money.ts'` is a
     * RUNTIME edge — the module is loaded — so it needs the extension for the
     * same reason an import does, and `export type { … }` beside it is erased
     * and does not. The re-export is what lets every existing caller of
     * `model/reconciliation.ts` keep resolving the money surface at the name it
     * has always used, which is the whole reason the §3 move was not a breaking
     * change for anything above it. */
    'model/reconciliation.ts:724 ./money.ts',
    /* 🛑 G692, 19 Sep 2026 — `model/run-admission.ts`'s ONLY value import, and
     * the reason it exists is a refusal rather than a convenience. The
     * idempotency basis is the RFC 8785 canonical form of the slot-fill state,
     * and `model/canonical.ts` is the ONE canonicaliser — its own header warns
     * that *"`localeCompare` does NOT, and neither does any `Intl.Collator`"*
     * sort the way JCS requires, and **that single substitution is the
     * likeliest way a second implementation silently disagrees with this
     * one**. A second implementation here would deduplicate two runs that are
     * not the same run, or fail to deduplicate two that are.
     *
     * ⚠️ AND THE MODULE HASHES NOTHING, WHICH IS WHY THE EDGE STOPS HERE:
     * `slotFillBasis()` returns the canonical string and the DIGEST lives with
     * the writer outside `model/`, exactly as `db/migrations/0012` §6 records
     * for `subject_ref`. So there is no `node:crypto` import in `model/` and
     * this scan would see one if there were.
     *
     * ⚠️ THE LINE NUMBER MOVED 111 → 123 ON 20 Sep 2026 AND THE SPECIFIER DID
     * NOT, WHICH IS THIS INVENTORY WORKING RATHER THAN DRIFTING. G961–G964
     * corrected three stale sentences in that module's header — the fill has a
     * producer now, `db/migrations/0150_document_slot_binding.sql` — and a
     * comment-only edit above an import moves the site this test pins. **The
     * failure it produced is the point**: a `file:line` inventory that silently
     * tolerated a moved line would tolerate a moved IMPORT, and an
     * extensionless value import is the defect that made three `model/` modules
     * unloadable on 8 Aug 2026 while `tsc` stayed green. */
    'model/run-admission.ts:123 ./canonical.ts',
    /* W3-S2, 21 Sep 2026 — `model/session-mint.ts`, the 29th module. TWO value
     * imports, and each is a CALL to an existing seam rather than a second
     * implementation of one: `validateSessionBounds()` so that G220's ceiling
     * is spent exactly once per mint at one call site (G1606), and
     * `normaliseHost()` so the stored host equals what `checkHostBinding()`
     * compares on every request (G1609). Both carry `.ts`, which is the whole
     * subject of this inventory. */
    'model/session-mint.ts:156 ./session.ts',
    'model/session-mint.ts:157 ./serving-host.ts',
  ])
})

test('test_the_type_only_import_specifiers_in_model_stay_extensionless', () => {
  const { sites, filesRead } = relativeSpecifierSites()
  assert.equal(filesRead, MODULE_COUNT)
  const typeOnly = sites.filter((site) => site.typeOnly)
  /* A positive witness that the scan saw type-only sites at all, named rather
   * than counted.
   *
   * ⚠️ `:63` -> `:70` on 23 Aug 2026, when #224 [A-3] added seven names to the
   * type-only block above it — `DeploymentMode`, `IdentityConnection`,
   * `RegionKey`, `Session`, `Tenant`, `TenantEnvironment`, `User`. THE
   * SPECIFIER IS UNCHANGED, which is the only thing this witness asserts. A
   * line that moves is this test doing its job; a specifier that changes is
   * the finding.
   *
   * 🛑 AND ON 19 Sep 2026 IT MOVED AGAIN, BY ONE, WHEN G199's SLICE ADDED
   * `Membership` TO THE `./domain` BLOCK — AND THE LINE NUMBER IS DROPPED
   * RATHER THAN SWEPT A THIRD TIME. Twice is a coincidence; three times is the
   * shape. The comment above already says the line moving *"is this test doing
   * its job"* and that only the SPECIFIER is the claim — so pinning the number
   * asserted something the comment explicitly disclaims, and cost two sweeps to
   * keep a fact nobody wanted. `CLAUDE.md` catalogues the resolving-but-wrong
   * class twenty times over and ends with the rule this now follows: *"do not
   * add a line number without asking whether a grep anchor would do instead."*
   *
   * WHAT SURVIVES IS STRICTLY MORE THAN WHAT WENT: the site must exist in
   * `model/access.ts`, the specifier must be exactly `./governance`, and it
   * must be type-only — which is the whole of the claim, and is now stated
   * once instead of three times. The file is named, so a scan that lost
   * `access.ts` entirely still reddens. */
  assert.ok(
    typeOnly.some(
      (site) => site.at.startsWith('model/access.ts:') && site.specifier === './governance',
    ),
    'no type-only `./governance` import was found in `model/access.ts`. Either the ' +
      'specifier changed — which is the finding this witness exists for — or the scan ' +
      'stopped seeing type-only sites at all, in which case the `extensioned` assertion ' +
      'below is passing vacuously over an empty list.',
  )
  const extensioned = typeOnly
    .filter((site) => site.specifier.endsWith('.ts'))
    .map((site) => `${site.at} ${site.specifier}`)
  assert.deepEqual(extensioned, [])
})

/* ------------------------------------------------------------------ *
 * 3. The three modules that could not load, now doing real work
 *
 * Dynamic imports so that a module that still fails to resolve fails ITS OWN
 * test rather than taking the whole file down with it.
 * ------------------------------------------------------------------ */

test('test_observability_reads_the_cohort_floor_of_five_across_the_module_boundary', async () => {
  const observability = await import('../../model/observability.ts')
  /* `platformWindowAggregateIsDisclosable` is @dropped-for-v1 — declared, not
   * built. It is read here as a pure predicate, not built against. */
  const disclosable = observability.platformWindowAggregateIsDisclosable
  /* THE ASSERTION THAT BITES. `disclosable(4) === false` also passes when
   * AGGREGATE_COHORT_FLOOR is `undefined`, because `4 >= undefined` is false.
   * Only the true case fails when the './billing.ts' value import delivered
   * nothing. Both go in, and this one carries the test. */
  assert.equal(disclosable(5), true)
  assert.equal(disclosable(4), false)
})

test('test_examples_reads_the_approve_resolution_capability_across_the_module_boundary', async () => {
  const examples = await import('../../model/examples.ts')
  /* `fourEyesAboveThreshold` is evaluated at examples.ts top level, so loading
   * the module is itself the witness that CAPABILITIES arrived. The literal is
   * model/access.ts:315's value, typed out rather than referenced. */
  assert.equal(examples.fourEyesAboveThreshold.capability, 'approve_resolution')
  assert.equal(examples.fourEyesAboveThreshold.distinctHolders, 2)
})

test('test_agents_classifies_send_correspondence_as_egress_after_loading', async () => {
  const agents = await import('../../model/agents.ts')
  /* ⚠️ TOOL_EFFECT is declared IN agents.ts. This witnesses that agents.ts
   * loads and is usable — it does NOT witness the './domain.ts' value import.
   * See the header comment. */
  assert.equal(agents.effectOf('send_correspondence'), 'egress')
  assert.equal(agents.effectOf('read_document'), 'read_tenant')
})
