/**
 * THE PUBLICATION SEAM'S REFUSAL LOGIC FOR DOCUMENT TYPES — `model/publication.ts`.
 * G4201–G4207, 4 Oct 2026 (U-29).
 *
 * §1 is the census: every member of `DOCUMENT_TYPE_DECLARATION_VIOLATIONS` has a
 * vector here that trips it ALONE, so a seventh member minted without a vector
 * is a red gate. §2 is the anti-vacuity half: the seam refuses an EMPTY
 * declaration, and the tree's own corpus is ADMITTED, so the seam is witnessed
 * saying yes as well as no (§5.6). §3 witnesses the seam running the EXISTING
 * classification validator rather than restating it. §4 is G4205's finding,
 * kept runnable: `validatePackClassificationRules()` resolves a duplicated key
 * last-wins and says nothing.
 *
 * ⚠️ WHAT NONE OF THIS PROVES: that anything WRITES a document type. Nothing
 * does — the writer is G4204's ruling, put to the owner — and §5 asserts that
 * no migration grants a write on either table, so the commit that takes the
 * ruling has to delete an assertion on purpose (G511).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DATA_CLASSES, DOMAIN_KEYS } from '../../model/domain.ts'
import type { DocumentTypeTemplate, FieldSpec } from '../../model/domain.ts'
import {
  DOCUMENT_TYPE_DECLARATION_VIOLATIONS,
  admitDocumentTypeDeclaration,
  validateDocumentTypeTemplates,
} from '../../model/publication.ts'
import type { DocumentTypeDeclarationViolationKind } from '../../model/publication.ts'
import { validatePackClassificationRules } from '../../model/ingestion.ts'
import type { PackClassificationRule } from '../../model/ingestion.ts'
import { applyExtraction } from '../../model/reconciliation.ts'
import { parseFieldPath } from '../../model/field-path.ts'
import type { FieldPath } from '../../model/kernel.ts'
import { solutionPacks } from '../../model/examples.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

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

const template = (over: Partial<DocumentTypeTemplate> = {}): DocumentTypeTemplate => ({
  key: 'dt_clean',
  label: 'Clean',
  domain: DOMAIN_KEYS.finance,
  fields: [field()],
  expectedFidelity: 'tabular',
  carriesControlTotal: 'never',
  ...over,
})

/** A value the type system forbids and a deserialised pack can still carry. */
const asIfFromData = <T>(value: string): T => value as unknown as T

const rulesOf = (templates: readonly DocumentTypeTemplate[]) =>
  validateDocumentTypeTemplates(templates).map((v) => v.rule).sort()

/* ------------------------------------------------------------------ §1 census */

const V = DOCUMENT_TYPE_DECLARATION_VIOLATIONS
const VECTORS: Record<DocumentTypeDeclarationViolationKind, readonly DocumentTypeTemplate[]> = {
  [V.keyEmpty]: [template({ key: '' })],
  [V.keyShippedTwice]: [template(), template({ label: 'Second' })],
  [V.fieldDeclaredTwice]: [template({ fields: [field(), field({ label: 'Again', dataClass: DATA_CLASSES.personal })] })],
  [V.fieldlessTypeCrossesManagedService]: [template({ fields: [], expectedFidelity: 'scanned' })],
  [V.confidenceFloorNotARatio]: [template({ fields: [field({ confidenceFloor: 1.5 })] })],
  [V.vocabularyUnrecognised]: [template({ domain: asIfFromData('treasury') })],
}

test('test_publication_seam_census_every_violation_has_a_vector_that_trips_it_alone', () => {
  const declared = Object.values(DOCUMENT_TYPE_DECLARATION_VIOLATIONS).sort()
  assert.deepEqual(Object.keys(VECTORS).sort(), declared, 'a violation member with no vector')
  for (const [rule, templates] of Object.entries(VECTORS)) {
    assert.deepEqual(rulesOf(templates), [rule], `vector for ${rule} must trip exactly it`)
  }
})

test('test_publication_seam_vocabulary_refuses_each_column_independently', () => {
  // A validator that checked only the first column would pass the census above
  // while coercing the other four — G1405's §4d/§4e argument, one layer earlier.
  const cases: readonly DocumentTypeTemplate[] = [
    template({ expectedFidelity: asIfFromData('microfiche') }),
    template({ domain: asIfFromData('treasury') }),
    template({ carriesControlTotal: asIfFromData('sometimes') }),
    template({ fields: [field({ dataType: asIfFromData('currency') })] }),
    template({ fields: [field({ dataClass: asIfFromData('secret') })] }),
  ]
  for (const t of cases) {
    assert.deepEqual(rulesOf([t]), [V.vocabularyUnrecognised])
  }
})

test('test_publication_seam_unknown_fidelity_is_not_read_as_either_g134_answer', () => {
  // `FIDELITY_CROSSES_MANAGED_SERVICE[unknown]` is undefined; a fieldless type
  // on an unknown rung must be ONE finding (vocabulary), not two.
  assert.deepEqual(rulesOf([template({ fields: [], expectedFidelity: asIfFromData('microfiche') })]), [
    V.vocabularyUnrecognised,
  ])
})

test('test_publication_seam_confidence_floor_edges', () => {
  for (const ok of [null, 0, 0.5, 1]) {
    assert.deepEqual(rulesOf([template({ fields: [field({ confidenceFloor: ok })] })]), [], String(ok))
  }
  for (const bad of [-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(rulesOf([template({ fields: [field({ confidenceFloor: bad })] })]), [V.confidenceFloorNotARatio], String(bad))
  }
})

test('test_publication_seam_fieldless_parsed_rung_is_admitted_g134_is_about_crossing', () => {
  assert.deepEqual(rulesOf([template({ fields: [], expectedFidelity: 'structured' })]), [])
  assert.deepEqual(rulesOf([template({ fields: [], expectedFidelity: 'digital_text' })]), [V.fieldlessTypeCrossesManagedService])
})

/* ------------------------------------------------------------ §2 anti-vacuity */

test('test_publication_seam_refuses_an_empty_declaration', () => {
  const verdict = admitDocumentTypeDeclaration([], [], applyExtraction)
  assert.equal(verdict.verdict, 'refused')
  assert.deepEqual(verdict.verdict === 'refused' ? verdict.findings : null, [
    { validator: 'seam', rule: 'declaration_declares_nothing' },
  ])
})

test('test_publication_seam_admits_the_trees_own_corpus_and_the_corpus_is_not_empty', () => {
  const templates = solutionPacks.flatMap((p) => p.documentTypeTemplates)
  const rules = solutionPacks.flatMap((p) => p.classificationRules)
  assert.ok(templates.length > 0, 'the corpus must carry a template or this assertion is vacuous')
  const verdict = admitDocumentTypeDeclaration(templates, rules, applyExtraction)
  assert.equal(verdict.verdict, 'admitted', JSON.stringify(verdict))
  assert.equal(verdict.verdict === 'admitted' ? verdict.templates : null, templates, 'the same templates, not a copy')
})

test('test_publication_seam_returns_every_finding_not_the_first', () => {
  const verdict = admitDocumentTypeDeclaration(
    [template({ key: '' }), template({ key: 'dt_b', fields: [field({ confidenceFloor: 2 })] })],
    [],
    applyExtraction,
  )
  assert.equal(verdict.verdict, 'refused')
  const rules = verdict.verdict === 'refused'
    ? verdict.findings.map((f) => (f.validator === 'seam' ? f.rule : f.violation.rule)).sort()
    : []
  assert.deepEqual(rules, [V.confidenceFloorNotARatio, V.keyEmpty].sort())
})

/* ------------------------------------------- §3 the existing validator is run */

test('test_publication_seam_runs_the_classification_validator_rather_than_restating_it', () => {
  const orphan: PackClassificationRule = {
    documentTypeKey: 'dt_not_shipped',
    signals: [{ kind: 'intake_channel_is', channel: 'upload' }],
  }
  const direct = validatePackClassificationRules([template()], [orphan], applyExtraction)
  assert.ok(direct.length > 0, 'the vector must trip the classification validator directly')
  const verdict = admitDocumentTypeDeclaration([template()], [orphan], applyExtraction)
  assert.equal(verdict.verdict, 'refused')
  const fromSeam = verdict.verdict === 'refused'
    ? verdict.findings.flatMap((f) => (f.validator === 'classification' ? [f.violation] : []))
    : []
  assert.deepEqual(fromSeam, direct)
})

/* --------------------------------------------------------- §4 G4205's finding */

test('test_g4205_classification_validator_resolves_a_duplicated_key_last_wins_silently', () => {
  // The finding that made `key_shipped_twice` necessary, kept runnable: two
  // templates share a key, the FIRST is fieldless on a crossing rung (G134's
  // refused shape), the SECOND is fine. The classification validator looks up
  // by key, gets the second, and reports NOTHING about the first.
  const first = template({ key: 'dt_dup', fields: [], expectedFidelity: 'scanned' })
  const second = template({ key: 'dt_dup' })
  const rule: PackClassificationRule = {
    documentTypeKey: 'dt_dup',
    signals: [{ kind: 'intake_channel_is', channel: 'upload' }],
  }
  assert.deepEqual(validatePackClassificationRules([first, second], [rule], applyExtraction), [])
  assert.deepEqual(rulesOf([first, second]), [V.fieldlessTypeCrossesManagedService, V.keyShippedTwice].sort())
})

/* ------------------------------------------------ §5 still no writer (G511) */

test('test_no_migration_grants_a_write_on_document_type_or_its_field_spec', () => {
  // G4204 is ⛔ put to the owner. Until it is taken, a write privilege on
  // either table is `0004`'s refusal. This goes RED the day a GRANT lands, and
  // the commit that lands it must land the writer and delete this on purpose.
  const write = /GRANT\s+(?:[A-Z, ()a-z_]*\b)?(INSERT|UPDATE|DELETE)\b[^;]*\bON\s+(?:TABLE\s+)?tenant\.(document_type|document_field_spec)\b/i
  for (const dir of ['db/migrations', 'db/migrations-control']) {
    for (const name of readdirSync(join(ROOT, dir)).filter((n) => n.endsWith('.sql'))) {
      const sql = readFileSync(join(ROOT, dir, name), 'utf8').replace(/--[^\n]*/g, '')
      assert.doesNotMatch(sql, write, `${dir}/${name} grants a write ahead of its writer`)
    }
  }
})
