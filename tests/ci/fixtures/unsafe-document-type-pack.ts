/**
 * NEGATIVE CONTROL FIXTURE — a pack whose document-type templates MUST all be
 * refused by `validateDocumentTypeTemplates()` (`model/publication.ts`).
 * G4202, 4 Oct 2026.
 *
 * 🛑 IT EXERCISES EVERY MEMBER OF `DOCUMENT_TYPE_DECLARATION_VIOLATIONS`, AND
 * THAT IS A REQUIREMENT: `witnessValidators()` derives the inventory from the
 * const and fails the run on any member no probe reaches — G206's arrangement.
 *
 * ⚠️ EACH TEMPLATE TRIPS EXACTLY ONE VIOLATION, AND THE PACK CARRIES NO
 * CLASSIFICATION RULES AND NO PROCEDURES, so the expected list is a statement
 * about one validator.
 */

import { solutionPacks as realPacks } from '../../../model/examples.ts'
import { DATA_CLASSES, DOMAIN_KEYS } from '../../../model/domain.ts'
import { parseFieldPath } from '../../../model/field-path.ts'
import type { DocumentTypeTemplate, FieldSpec, SolutionPack } from '../../../model/domain.ts'
import type { FieldPath } from '../../../model/kernel.ts'

const shell = realPacks[0]
if (shell === undefined) {
  throw new Error('model/examples.ts must export at least one SolutionPack')
}

function fixturePath(...tokens: readonly (string | number)[]): FieldPath {
  const parsed = parseFieldPath(tokens)
  if (!parsed.ok) throw new Error(`unparseable fixture FieldPath: ${parsed.refusal.kind}`)
  return parsed.path
}

const field = (over: Partial<FieldSpec> = {}): FieldSpec => ({
  path: fixturePath('header', 'reference'),
  label: 'Reference',
  dataType: 'identifier',
  required: true,
  dataClass: DATA_CLASSES.internal,
  modelProcessingAllowed: true,
  confidenceFloor: null,
  ...over,
})

const template = (key: string, over: Partial<DocumentTypeTemplate> = {}): DocumentTypeTemplate => ({
  key,
  label: key,
  domain: DOMAIN_KEYS.finance,
  fields: [field()],
  /* `tabular` is parsed, so G134 cannot fire except where a vector asks it to. */
  expectedFidelity: 'tabular',
  carriesControlTotal: 'never',
  ...over,
})

const documentTypeTemplates: DocumentTypeTemplate[] = [
  template(''),
  template('dt_twice'),
  template('dt_twice'),
  template('dt_field_twice', { fields: [field(), field({ label: 'Again' })] }),
  template('dt_fieldless_scan', { fields: [], expectedFidelity: 'scanned' }),
  template('dt_floor', { fields: [field({ confidenceFloor: 7 })] }),
  /* A value no const declares — what a deserialised pack can carry and the
   * type system cannot see. */
  template('dt_vocab', { domain: 'treasury' as unknown as DocumentTypeTemplate['domain'] }),
]

export const solutionPacks: SolutionPack[] = [
  {
    ...shell,
    key: 'probe_unsafe_document_types',
    documentTypeTemplates,
    classificationRules: [],
    procedureTemplates: [],
  },
]
