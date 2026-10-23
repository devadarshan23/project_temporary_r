/**
 * I-2 / #177 — G206: A PACK MAY DECLARE WHAT AN ARRIVING DOCUMENT IS, AND A
 * DECLARED RULE MUST NOT EXPRESS A COMPILED PATTERN.
 *
 * WHAT THIS FILE DEFENDS, IN ONE SENTENCE: a pack may say what an arriving
 * document is, and it may do so only over a closed op list nothing compiles,
 * only into a document type it itself ships, and only through a validator that
 * never has to mint a tenant to run.
 *
 * THE TWO SHAPES IT IS BUILT TO CATCH:
 *   §5.1 — a rule keyed on a convenient landmark instead of the property it
 *          protects. Here: a validator that checks the signals and never checks
 *          the target, which is plausible precisely because the signals are the
 *          interesting part.
 *   §5.3 — two vocabularies for one concept. G184 rules the intake vocabulary
 *          to exactly one member set; the `intake_channel_is` arm reads THAT
 *          type and this file never restates its members.
 *
 * ⚠️ NO SKIP, AND THAT IS A REQUIREMENT RATHER THAN A CHOICE.
 * `validatePackClassificationRules()` is a pure function over injected values
 * and `applyExtraction()` opens no socket and touches no database.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DATA_CLASSES, DOMAIN_KEYS } from '../../model/domain.ts'
import type { DocumentTypeTemplate } from '../../model/domain.ts'
import {
  CLASSIFICATION_RULE_VIOLATIONS,
  CLASSIFICATION_SIGNAL_KINDS,
  INTAKE_CHANNEL_KINDS,
  SIGNAL_KIND_IS_SINGLE_VALUED,
  validatePackClassificationRules,
} from '../../model/ingestion.ts'
import type {
  ClassificationSignal,
  PackClassificationRule,
} from '../../model/ingestion.ts'
import { applyExtraction } from '../../model/reconciliation.ts'
import type { IdentifierNormalisation } from '../../model/reconciliation.ts'
import { parseFieldPath } from '../../model/field-path.ts'
import type { FieldPath } from '../../model/kernel.ts'
import { solutionPacks } from '../../model/examples.ts'

/* ------------------------------------------------------------------ fixtures */

function fixturePath(...tokens: readonly (string | number)[]): FieldPath {
  const parsed = parseFieldPath(tokens)
  if (!parsed.ok) throw new Error(`unparseable fixture FieldPath: ${parsed.refusal.kind}`)
  return parsed.path
}

/** `ACME-INV-2026-001.pdf` → split on '-', segment 1 → `INV` → casefold. */
const SENDER_CONVENTION: IdentifierNormalisation = {
  ops: [{ kind: 'split_take', separator: '-', index: 1 }],
  then: 'casefold',
  maxInputChars: 128,
}

const INVOICE: DocumentTypeTemplate = {
  key: 'dt_invoice',
  label: 'Supplier invoice',
  domain: DOMAIN_KEYS.finance,
  fields: [
    {
      path: fixturePath('header', 'invoice_number'),
      label: 'Invoice number',
      dataType: 'identifier',
      required: true,
      dataClass: DATA_CLASSES.internal,
      modelProcessingAllowed: true,
      confidenceFloor: null,
    },
  ],
  /* `tabular` is PARSED, so no vector in this file trips G134 by accident. */
  expectedFidelity: 'tabular',
  carriesControlTotal: 'never',
}

/** G134's refused shape: no fields, so no ceiling is computable at all. */
const FIELDLESS_SCAN: DocumentTypeTemplate = {
  key: 'dt_docket',
  label: 'Warehouse docket',
  domain: DOMAIN_KEYS.finance,
  fields: [],
  expectedFidelity: 'scanned',
  carriesControlTotal: 'never',
}

function ruleFor(
  documentTypeKey: string,
  signals: readonly ClassificationSignal[],
): PackClassificationRule {
  return { documentTypeKey, signals }
}

const INVOICE_RULE = ruleFor('dt_invoice', [
  { kind: 'filename_extraction_in_set', extraction: SENDER_CONVENTION, values: ['inv'] },
  { kind: 'intake_channel_is', channel: INTAKE_CHANNEL_KINDS.mailbox },
])

function rulesOf(
  templates: readonly DocumentTypeTemplate[],
  rules: readonly PackClassificationRule[],
): readonly { rule: string; documentTypeKey: string; signalIndex: number | null }[] {
  return validatePackClassificationRules(templates, rules, applyExtraction)
}

/* --------------------------------------------------------------- 1. closure */

test('test_a_well_formed_rule_over_a_shipped_document_type_is_accepted', () => {
  /* THE POSITIVE CONTROL. Without it every rejection test below is satisfied by
   * a validator that refuses unconditionally, and "the check works" would be
   * indistinguishable from "the check refuses everything". */
  assert.deepEqual(rulesOf([INVOICE], [INVOICE_RULE]), [])
})

test('test_a_rule_naming_a_document_type_the_pack_does_not_ship_is_refused', () => {
  /* THE CLOSURE, and the lazy repair it catches is A VALIDATOR THAT CHECKS THE
   * SIGNALS AND NEVER CHECKS THE TARGET. That is the plausible wrong
   * implementation precisely because the signals are the interesting part: an
   * author writes the extraction checks, the canonical-form check and the
   * empty-conjunction check, ships it, and the one property that stops a pack
   * classifying arrivals into ANOTHER pack's document types is the check nobody
   * wrote. The happy path passes it. */
  const violations = rulesOf([INVOICE], [ruleFor('dt_passport', INVOICE_RULE.signals)])
  assert.equal(violations.length, 1)
  assert.equal(violations[0]?.rule, CLASSIFICATION_RULE_VIOLATIONS.targetNotShippedByThisPack)
  assert.equal(violations[0]?.documentTypeKey, 'dt_passport')
})

/* ------------------------------------------- 2. rules that cannot ever hold */

test('test_a_rule_with_no_signals_is_refused_because_it_claims_every_arrival', () => {
  /* `signals: []` is an empty conjunction, and an empty conjunction is TRUE.
   * `Array.prototype.every` returns true on an empty array, so the natural
   * one-liner makes an empty rule claim every artefact that ever arrives — a
   * total classification bypass that passes every happy-path test, because the
   * happy path never ships an empty rule. */
  assert.deepEqual(
    rulesOf([INVOICE], [ruleFor('dt_invoice', [])]).map((v) => v.rule),
    [CLASSIFICATION_RULE_VIOLATIONS.ruleAssertsNothing],
  )
})

test('test_a_signal_with_an_empty_value_set_is_refused_because_it_holds_nothing', () => {
  /* The mirror of the case above, and the model already states the rule it
   * rests on at the declaration: "The permitted extraction results, enumerated.
   * Empty holds nothing." A signal that is false forever is as much a
   * publication defect as one that is true forever. */
  assert.deepEqual(
    rulesOf(
      [INVOICE],
      [
        ruleFor('dt_invoice', [
          { kind: 'filename_extraction_in_set', extraction: SENDER_CONVENTION, values: [] },
        ]),
      ],
    ).map((v) => v.rule),
    [CLASSIFICATION_RULE_VIOLATIONS.signalHoldsNothing],
  )
})

test('test_a_declared_value_that_is_not_in_the_extractions_canonical_form_is_refused', () => {
  /* 🛑 THIS CLOSES THE OPEN ITEM G130'S OWN DOCBLOCK NAMED AND DECLINED TO
   * BUILD: "declaring 'ABC' under then: 'casefold' is a predicate that is
   * silently false forever. NOTHING VALIDATES THAT, AND THIS BUILD DID NOT ADD
   * IT — the check is one line and it needs the injected extractor."
   *
   * The lazy repair it catches: comparing the declared values against a RAW
   * filename instead of against a canonical form. That implementation makes
   * 'INV' match and this test green by accident, and it is exactly the fallback
   * `extractionInSetHolds()` refuses at the point of use. */
  assert.deepEqual(
    rulesOf(
      [INVOICE],
      [
        ruleFor('dt_invoice', [
          { kind: 'filename_extraction_in_set', extraction: SENDER_CONVENTION, values: ['INV'] },
        ]),
      ],
    ).map((v) => v.rule),
    [CLASSIFICATION_RULE_VIOLATIONS.signalValueNotInCanonicalForm],
  )
})

test('test_the_canonical_form_check_does_not_run_the_op_list_over_the_declared_value', () => {
  /* 🛑 THE CORRECTION TO G130's ONE-LINE SKETCH, ASSERTED RATHER THAN LEFT IN A
   * COMMENT — because the sketch is quoted in the record and the next author to
   * implement it literally would break the one correct rule in the tree.
   *
   * `extract(value, extraction)` runs the WHOLE op list, and the op list runs on
   * the RAW SUBJECT while a declared value is the op list's OUTPUT. Here
   * `split on '-', take segment 1` over the declared value `inv` finds no
   * segment 1 at all and REFUSES. A validator implementing the sketch verbatim
   * therefore rejects a rule that is completely well formed — a check that
   * refuses every valid input, which is §5.6 inverted and just as useless.
   *
   * The two halves are asserted together so neither can drift alone: the whole
   * extraction refuses the value, AND the validator accepts the rule. */
  const throughTheOps = applyExtraction('inv', SENDER_CONVENTION)
  assert.equal(throughTheOps.ok, false)
  assert.deepEqual(rulesOf([INVOICE], [INVOICE_RULE]), [])
})

test('test_two_single_valued_signals_of_the_same_kind_in_one_conjunction_are_refused', () => {
  /* An arrival has exactly one intake channel, so `mailbox AND upload` can never
   * hold. Repeating `filename_extraction_in_set` is LEGITIMATE — two different
   * extractions over one name — so the check is per-KIND and not a blanket
   * duplicate ban. The next test pins that other half. */
  assert.deepEqual(
    rulesOf(
      [INVOICE],
      [
        ruleFor('dt_invoice', [
          { kind: 'intake_channel_is', channel: INTAKE_CHANNEL_KINDS.mailbox },
          { kind: 'intake_channel_is', channel: INTAKE_CHANNEL_KINDS.upload },
        ]),
      ],
    ).map((v) => v.rule),
    [CLASSIFICATION_RULE_VIOLATIONS.signalKindRepeatedInOneRule],
  )
})

test('test_two_extraction_signals_in_one_conjunction_are_accepted_because_that_kind_is_not_single_valued', () => {
  /* The negative control for the check above. A blanket duplicate ban would
   * pass the previous test and silently forbid the legitimate case — two
   * different conventions over one filename — and nothing would say so. */
  const secondConvention: IdentifierNormalisation = {
    ops: [{ kind: 'split_take', separator: '-', index: 0 }],
    then: 'casefold',
    maxInputChars: 128,
  }
  assert.deepEqual(
    rulesOf(
      [INVOICE],
      [
        ruleFor('dt_invoice', [
          { kind: 'filename_extraction_in_set', extraction: SENDER_CONVENTION, values: ['inv'] },
          { kind: 'filename_extraction_in_set', extraction: secondConvention, values: ['acme'] },
        ]),
      ],
    ),
    [],
  )
})

/* --------------------------------------- 3. G134, applied at publication time */

test('test_a_rule_resolving_to_a_fieldless_template_that_declares_a_paid_rung_is_refused', () => {
  /* G134: "a DocumentType declaring no fields may cross NO managed-service
   * boundary", because the document-level ceiling is a maximum over per-field
   * `dataClass` and there is nothing to take a maximum over. A rule resolving
   * to such a template while declaring `scanned` routes every match to a
   * boundary it can never legally cross — one refusal per document, forever,
   * with nothing at publication saying why.
   *
   * The lazy repair: VALIDATING THE RULE IN ISOLATION FROM THE TEMPLATE IT
   * RESOLVES TO. A validator taking only `rules` and never reading `templates`
   * cannot see this and passes every other test in this file. */
  assert.deepEqual(
    rulesOf([FIELDLESS_SCAN], [ruleFor('dt_docket', INVOICE_RULE.signals)]).map((v) => v.rule),
    [CLASSIFICATION_RULE_VIOLATIONS.targetCannotReachDeclaredFidelity],
  )
})

test('test_a_fieldless_template_on_a_parsed_rung_is_accepted_because_no_boundary_is_crossed', () => {
  /* The negative control. G134 is about crossing a managed-service boundary,
   * not about fields being nice to have — a check keyed on `fields.length === 0`
   * alone would be §5.1, a rule keyed on a convenient landmark instead of the
   * property it protects, and would refuse a perfectly legal structured feed. */
  const parsedDocket: DocumentTypeTemplate = { ...FIELDLESS_SCAN, expectedFidelity: 'structured' }
  assert.deepEqual(rulesOf([parsedDocket], [ruleFor('dt_docket', INVOICE_RULE.signals)]), [])
})

/* ------------------------------------------------- 4. the decidable overlap */

test('test_two_rules_with_identical_signal_sets_for_different_types_are_refused', () => {
  /* The decidable half of overlap. Two rules with an identical signal set
   * resolving to different document types can NEVER disambiguate, on any input,
   * so the pack has shipped an arrival it is guaranteed to refuse as ambiguous.
   * Full overlap is not decidable over this vocabulary and the validator does
   * not claim it is — a publication check that claimed to catch all overlap
   * would be §5.6, a control that passes while asserting less than it says. */
  const other: DocumentTypeTemplate = { ...INVOICE, key: 'dt_credit_note' }
  assert.deepEqual(
    rulesOf(
      [INVOICE, other],
      [INVOICE_RULE, ruleFor('dt_credit_note', INVOICE_RULE.signals)],
    ).map((v) => v.rule),
    [CLASSIFICATION_RULE_VIOLATIONS.duplicateSignalSetForDifferentTypes],
  )
})

test('test_two_rules_with_identical_signal_sets_for_the_SAME_type_are_accepted', () => {
  /* Redundancy is not a defect: both rules resolve to the same key, so no
   * arrival is ever ambiguous. A check that compared signal sets and ignored
   * the target would refuse this, which is the §5.1 shape again. */
  assert.deepEqual(rulesOf([INVOICE], [INVOICE_RULE, INVOICE_RULE]), [])
})

/* ---------------------------------------------------- 5. totality, not a count */

test('test_every_signal_kind_has_a_vector_and_a_third_arm_fails_this', () => {
  /* A THIRD SIGNAL ARM IS A FAILURE HERE, NOT A GAP. The vectors are the rules
   * this file actually exercises, so a kind added to the vocabulary without a
   * vector shows up as a set difference rather than as silence. */
  const exercised = new Set<string>()
  for (const rule of [INVOICE_RULE]) {
    for (const signal of rule.signals) exercised.add(signal.kind)
  }
  assert.deepEqual(
    [...Object.values(CLASSIFICATION_SIGNAL_KINDS)].sort(),
    [...exercised].sort(),
    'every member of CLASSIFICATION_SIGNAL_KINDS must be exercised by a vector here',
  )
  /* And the single-valued record is total over the same set by construction —
   * asserted rather than assumed, because `Record<K, V>` guarantees the KEYS
   * and nothing guarantees the two declarations were kept in step. */
  assert.deepEqual(
    Object.keys(SIGNAL_KIND_IS_SINGLE_VALUED).sort(),
    [...Object.values(CLASSIFICATION_SIGNAL_KINDS)].sort(),
  )
})

/* ------------------------------------ 6. the corpus is real, not a stand-in */

test('test_the_shipped_corpus_is_validated_and_is_not_empty', () => {
  /* "Zero findings" over zero rules is not a pass. This asserts a NONZERO
   * compare count against the real tree corpus, which is exactly the assertion
   * `tools/check-pack-safety.mjs`'s `vacuous` field exists to make impossible to
   * omit — and the reason `model/examples.ts` ships a rule at all. */
  let compared = 0
  for (const pack of solutionPacks) {
    compared += pack.classificationRules.length
    assert.deepEqual(
      validatePackClassificationRules(
        pack.documentTypeTemplates,
        pack.classificationRules,
        applyExtraction,
      ),
      [],
      `${pack.key}: a pack shipped in the tree must validate clean`,
    )
  }
  assert.ok(compared > 0, 'the corpus must contain at least one rule, or this test asserts nothing')
})

/* ------------------------------------ 7. nothing is compiled — the G130 half */

test('test_the_ingestion_module_compiles_no_pattern_anywhere_in_its_code', () => {
  /* The standing control `model/reconciliation.ts` keeps on itself, extended to
   * the module that now carries a pack-authored matching vocabulary — and made
   * STRICTER on the way, deliberately. The house form is `grep -c 'new RegExp'`
   * over the whole file, which a module explaining WHY it compiles nothing
   * cannot satisfy without writing around its own prose. This strips comments
   * first and then asserts over the CODE, so the ban is on what executes and
   * the reasoning stays readable.
   *
   * G124's deciding argument is that an approval nobody can read is not an
   * approval, and G206 says the constraint binds harder here than where G130
   * ruled it: a pack-declared rule runs over an artefact a foreign system handed
   * us seconds earlier, at a stage where nothing has been admitted yet. */
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'model', 'ingestion.ts'),
    'utf8',
  )
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  /* Assembled rather than written, so this file's own bytes cannot be what a
   * future scan of THIS directory trips over. */
  const constructor = ['Reg', 'Exp'].join('')
  assert.equal(
    code.includes(constructor),
    false,
    'model/ingestion.ts compiles a pattern in executable code — G130 removed ' +
      'exactly that arm from RulePredicate one layer up',
  )
  /* The three readers a pattern would be handed to. Banning the constructor
   * alone leaves a literal, and a literal is the same door with a shorter name. */
  for (const reader of ['.exec(', '.match(', '.matchAll(', '.search(']) {
    assert.equal(code.includes(reader), false, `model/ingestion.ts calls ${reader}`)
  }
  /* And the positive half: the module really does hold the vocabulary this
   * control is about, so a rename could not make it pass by emptying it. */
  assert.ok(code.includes('validatePackClassificationRules'))
})
