/**
 * NEGATIVE CONTROL FIXTURE — a pack whose classification rules MUST all be
 * refused. G206, 24 Aug 2026.
 *
 * 🛑 IT EXERCISES EVERY MEMBER OF `CLASSIFICATION_RULE_VIOLATIONS`, AND THAT IS
 * A REQUIREMENT RATHER THAN THOROUGHNESS. `witnessValidators()` derives the
 * rule inventory from `model/ingestion.ts` and fails the run on any rule no
 * probe reaches, so a ninth violation minted without a vector here is a WITNESS
 * FAILURE rather than a quiet gap. That is the same arrangement the procedure
 * and agent validators already have, extended rather than reinvented.
 *
 * ⚠️ EACH RULE BELOW IS BUILT TO TRIP EXACTLY ONE VIOLATION. A fixture whose
 * rules trip several at once cannot distinguish "the validator raised the right
 * finding" from "the validator raised everything", which is the shape a probe
 * exists to refuse.
 *
 * ⚠️ `procedureTemplates` IS EMPTIED, DELIBERATELY. The shell pack is the real
 * finance pack, and this fixture is a probe for ONE validator; leaving another
 * validator's input in place would make the probe's expected-findings list a
 * statement about two validators at once.
 */

import { solutionPacks as realPacks } from '../../../model/examples.ts'
import { DATA_CLASSES, DOMAIN_KEYS } from '../../../model/domain.ts'
import { INTAKE_CHANNEL_KINDS } from '../../../model/ingestion.ts'
import { parseFieldPath } from '../../../model/field-path.ts'
import type { DocumentTypeTemplate, SolutionPack } from '../../../model/domain.ts'
import type { PackClassificationRule } from '../../../model/ingestion.ts'
import type { IdentifierNormalisation } from '../../../model/reconciliation.ts'
import type { FieldPath } from '../../../model/kernel.ts'

const shell = realPacks[0]
if (shell === undefined) {
  throw new Error('model/examples.ts must export at least one SolutionPack')
}

/* FIXTURE-ONLY UNWRAP, the same shape `model/examples.ts` argues for itself: a
 * path written here is a literal, so a refusal is a defect in this file and
 * failing at module load is the loudest way to say so. */
function fixturePath(...tokens: readonly (string | number)[]): FieldPath {
  const parsed = parseFieldPath(tokens)
  if (!parsed.ok) throw new Error(`unparseable fixture FieldPath: ${parsed.refusal.kind}`)
  return parsed.path
}

const CASEFOLD: IdentifierNormalisation = { ops: [], then: 'casefold', maxInputChars: 64 }
/* `name_normalise` is a member of the closed `Normaliser` union that NOTHING in
 * this repository defines — `applyNormaliser()` refuses rather than guessing.
 * A value declared under it can never be canonicalised, so it can never hold. */
const UNIMPLEMENTED: IdentifierNormalisation = {
  ops: [],
  then: 'name_normalise',
  maxInputChars: 64,
}

const withField = (key: string): DocumentTypeTemplate => ({
  key,
  label: key,
  domain: DOMAIN_KEYS.finance,
  fields: [
    {
      path: fixturePath('header', 'reference'),
      label: 'Reference',
      dataType: 'identifier',
      required: true,
      dataClass: DATA_CLASSES.internal,
      modelProcessingAllowed: true,
      confidenceFloor: null,
    },
  ],
  /* `tabular` is PARSED — no managed-service boundary — so a rule resolving
   * here can never trip G134's check and the other vectors stay single-cause. */
  expectedFidelity: 'tabular',
  carriesControlTotal: 'never',
})

/** G134's refused shape: no fields, so no document-level ceiling is computable. */
const fieldlessScan: DocumentTypeTemplate = {
  key: 'dt_fieldless_scan',
  label: 'Fieldless scan',
  domain: DOMAIN_KEYS.finance,
  fields: [],
  expectedFidelity: 'scanned',
  carriesControlTotal: 'never',
}

const rules: PackClassificationRule[] = [
  /* 1 — the closure. A pack may not claim a type it does not ship. */
  {
    documentTypeKey: 'dt_not_shipped',
    signals: [{ kind: 'intake_channel_is', channel: INTAKE_CHANNEL_KINDS.mailbox }],
  },
  /* 2 — an empty conjunction is TRUE, so this claims every artefact ever. */
  { documentTypeKey: 'dt_ok', signals: [] },
  /* 3 — an empty value set holds nothing. The signal is false forever. */
  {
    documentTypeKey: 'dt_ok',
    signals: [{ kind: 'filename_extraction_in_set', extraction: CASEFOLD, values: [] }],
  },
  /* 4 — G130's named open item: `'INV'` under `casefold` can never be produced
   * by the extraction it is compared against. */
  {
    documentTypeKey: 'dt_ok',
    signals: [{ kind: 'filename_extraction_in_set', extraction: CASEFOLD, values: ['INV'] }],
  },
  /* 5 — the terminal normaliser refuses, so no canonical form exists at all. */
  {
    documentTypeKey: 'dt_ok',
    signals: [{ kind: 'filename_extraction_in_set', extraction: UNIMPLEMENTED, values: ['x'] }],
  },
  /* 6 — an arrival has exactly one channel, so `mailbox AND upload` never holds. */
  {
    documentTypeKey: 'dt_ok',
    signals: [
      { kind: 'intake_channel_is', channel: INTAKE_CHANNEL_KINDS.mailbox },
      { kind: 'intake_channel_is', channel: INTAKE_CHANNEL_KINDS.upload },
    ],
  },
  /* 7 — G134 at publication time: a fieldless target on a model-bearing rung. */
  {
    documentTypeKey: 'dt_fieldless_scan',
    signals: [{ kind: 'intake_channel_is', channel: INTAKE_CHANNEL_KINDS.watchedDrop }],
  },
  /* 8 — the decidable half of overlap: identical signal sets, different types.
   * The finding lands on the SECOND rule, which is the one that made the pack
   * undecidable. */
  {
    documentTypeKey: 'dt_ok',
    signals: [{ kind: 'intake_channel_is', channel: INTAKE_CHANNEL_KINDS.connectorPull }],
  },
  {
    documentTypeKey: 'dt_other',
    signals: [{ kind: 'intake_channel_is', channel: INTAKE_CHANNEL_KINDS.connectorPull }],
  },
]

export const solutionPacks: SolutionPack[] = [
  {
    ...shell,
    key: 'unsafe_classification',
    documentTypeTemplates: [withField('dt_ok'), withField('dt_other'), fieldlessScan],
    classificationRules: rules,
    procedureTemplates: [],
  },
]
