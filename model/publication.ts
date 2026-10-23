/**
 * ReconcileAI — THE PUBLICATION SEAM'S REFUSAL LOGIC, FOR DOCUMENT TYPES ONLY.
 *
 * G4201–G4207, 4 Oct 2026 (U-29). DERIVED, NOT THE OWNER'S — and the most
 * important sentence in this header is the one that says what is NOT here.
 *
 * ─── WHAT THIS IS ───
 *
 * G110 rules that the pack validators get BOTH call sites: *"CI, and a
 * publication seam that REFUSES"*, because *"a control that exists only in CI
 * stops existing the moment a pack arrives by another route."* This module is
 * the REFUSAL half of that seam for the narrowest declaration this product
 * has — a `DocumentType` — written as a pure function so that whichever
 * writer the owner rules (G4204) calls exactly this and nothing restated.
 *
 * It answers one question: *may this set of document-type templates, with
 * these classification rules, be published?* `admitDocumentTypeDeclaration()`
 * returns `admitted` or `refused` with every finding, and it runs two
 * validators: `validateDocumentTypeTemplates()` (this module, new) and
 * `validatePackClassificationRules()` (`model/ingestion.ts`, G206 — the one
 * existing publication validator whose subject IS a document type).
 *
 * ─── WHAT THIS IS NOT, STATED FIRST BECAUSE IT IS THE IMPORTANT PART ───
 *
 * 🛑 IT IS NOT A WRITER. Nothing here inserts a row, and no migration grants
 * a write on `tenant.document_type` or `tenant.document_field_spec`. G511:
 * *"the fence and the writer are one commit or neither"* — and the WRITER's
 * shape (which operation, which tier, which capability, which principal) is
 * NOT decided by any ruling in this record. G4204 puts it to the owner. A
 * `GRANT INSERT` taken here would be `0004`'s *"a write privilege ahead of its
 * writer"* and would TAKE that ruling quietly.
 *
 * 🛑 IT DOES NOT RUN `validateProcedureInjectionSafety()` (G4203). That
 * validator takes a `Procedure`, which `extends TenantScoped`, and a pack
 * ships `ProcedureTemplate = Omit<Procedure, 'id' | 'tenantId' |
 * 'derivedFrom'>`. A model-side seam calling it would have to FORGE a tenant,
 * which `tools/check-pack-safety.mjs` already records about its own adapter:
 * *"a CI call site that has to invent a tenant is a call site that can invent
 * the wrong one."* Procedures are not document types, and this slice is
 * document types and nothing wider.
 *
 * ⚠️ IT DOES NOT PARSE. A template's `FieldPath`s are BRANDED, so they came
 * through `parseFieldPath()` — the one seam (G214). Whoever deserialises a pack
 * calls that; a second path check here would be §5.3.
 *
 * ─── WHY THE VOCABULARY IS CHECKED AT RUNTIME OVER TYPED INPUT ───
 *
 * A pack reaches a publication seam as DATA — a draft, a catalogue row, a
 * request body — and `tsc` has no opinion about data. The reader on the other
 * side (`server/data-plane/document-type-store.ts`) refuses an unknown
 * vocabulary value by name for exactly that reason; this is the same refusal
 * one step earlier, so an unknown value never reaches a table rather than
 * being refused every time it is read. The vocabularies are DERIVED from the
 * model's own consts (`Object.values(...)`), never transcribed — G1405's rule.
 */

import {
  ACQUISITION_FIDELITY,
  DATA_CLASSES,
  DATA_TYPES,
  DOMAIN_KEYS,
} from './domain.ts'
import type { DocumentType, DocumentTypeTemplate, ExtractionFn } from './domain'
import {
  FIDELITY_CROSSES_MANAGED_SERVICE,
  validatePackClassificationRules,
} from './ingestion.ts'
import type { ClassificationRuleViolation, PackClassificationRule } from './ingestion'
import { fieldPathKey } from './field-path.ts'

/* ==================================================================== *
 * §1  THE VOCABULARY OF REFUSAL
 * ==================================================================== */

/**
 * Every way a document-type template is refused at publication. A const, not
 * a bare union, so `tools/check-pack-safety.mjs` can derive the inventory its
 * witness must cover — G206's arrangement for classification rules.
 */
export const DOCUMENT_TYPE_DECLARATION_VIOLATIONS = {
  /**
   * The pack-stable name is empty. `PackClassificationRule.documentTypeKey`
   * and `InstalledPack`'s mint both address a template by `key`; an empty key
   * is a type nothing can name.
   */
  keyEmpty: 'key_empty',
  /**
   * 🛑 TWO TEMPLATES IN ONE DECLARATION SHARE A KEY (G4205). Found, not
   * assumed: `validatePackClassificationRules()` builds `byKey` with
   * `Map.prototype.set` per template, so the LAST template silently wins and a
   * rule naming the key classifies arrivals into whichever one happened to be
   * written second. ⚠️ THIS IS WITHIN ONE DECLARATION ONLY. `0180` refuses a
   * tenant-wide `UNIQUE (tenant_id, key)` by name, because two PACKS
   * publishing one key into a tenant is a case nobody has ruled on; this
   * check takes no position on that.
   */
  keyShippedTwice: 'key_shipped_twice',
  /**
   * Two `FieldSpec`s address one position (same `fieldPathKey`). Invariant 4 —
   * *"Classification is declared once, on `FieldSpec`"* — and `0012`'s
   * `document_field_spec` primary key `(tenant_id, document_type_id,
   * path_key)` would refuse the second row anyway. Refusing here turns a
   * constraint violation into a named refusal, and stops a declaration
   * carrying two classes for one value from being half-written.
   */
  fieldDeclaredTwice: 'field_declared_twice',
  /**
   * G134 AT DECLARATION TIME: *"a `DocumentType` declaring NO fields may cross
   * no managed-service boundary, because `dataClass` is declared per field and
   * there is nothing to take a maximum over."* G206 enforces it only when a
   * classification RULE targets the type; a type reached by upload rather
   * than by a rule is the same hazard with no rule to trip it.
   */
  fieldlessTypeCrossesManagedService: 'fieldless_type_crosses_managed_service',
  /**
   * `confidenceFloor` is a RATIO (`0160` §6: *"it is a RATIO and not money"*)
   * or null for *no floor declared*. A floor outside `[0, 1]`, or not finite,
   * holds every read or none, and either is a declaration that says something
   * other than what its author meant.
   */
  confidenceFloorNotARatio: 'confidence_floor_not_a_ratio',
  /**
   * A closed-vocabulary value no model const declares: `expectedFidelity`,
   * `domain`, `carriesControlTotal`, a field's `dataType` or `dataClass`.
   */
  vocabularyUnrecognised: 'vocabulary_unrecognised',
} as const
export type DocumentTypeDeclarationViolationKind =
  (typeof DOCUMENT_TYPE_DECLARATION_VIOLATIONS)[keyof typeof DOCUMENT_TYPE_DECLARATION_VIOLATIONS]

/**
 * ⚠️ CARRIES TEXT, DELIBERATELY, ON `ClassificationRuleViolation`'s ARGUMENT:
 * the values are a pack author's own declarations read at publication time,
 * and no arrival or counterparty byte reaches this function.
 */
export interface DocumentTypeDeclarationViolation {
  readonly rule: DocumentTypeDeclarationViolationKind
  /** The template's own `key` — possibly the empty string, which is a finding. */
  readonly documentTypeKey: string
  /** Index into `fields`, or null for a whole-template finding. */
  readonly fieldIndex: number | null
  readonly detail: string
}

/* ==================================================================== *
 * §2  THE VALIDATOR — one template set, total, pure, never throws
 * ==================================================================== */

const FIDELITIES: readonly string[] = Object.values(ACQUISITION_FIDELITY)
const DOMAINS: readonly string[] = Object.values(DOMAIN_KEYS)
const DATA_TYPE_VALUES: readonly string[] = Object.values(DATA_TYPES)
const DATA_CLASS_VALUES: readonly string[] = Object.values(DATA_CLASSES)
/** A total `Record`, so a third arm on the model's union is a `TS2741` here. */
const CARRIES_CONTROL_TOTAL: Record<DocumentType['carriesControlTotal'], true> = {
  always: true,
  never: true,
}

const isRatio = (value: number): boolean => Number.isFinite(value) && value >= 0 && value <= 1

/**
 * G110's publication-time validator for document-type templates. Returns
 * every violation; an empty array means none of these rules was broken, NOT
 * that the declaration is admissible — `admitDocumentTypeDeclaration()` is
 * the verdict, and it also refuses an empty set.
 */
export function validateDocumentTypeTemplates(
  templates: readonly DocumentTypeTemplate[],
): readonly DocumentTypeDeclarationViolation[] {
  const out: DocumentTypeDeclarationViolation[] = []
  const seenKeys = new Set<string>()

  for (const template of templates) {
    const at = (
      rule: DocumentTypeDeclarationViolationKind,
      fieldIndex: number | null,
      detail: string,
    ): void => {
      out.push({ rule, documentTypeKey: template.key, fieldIndex, detail })
    }
    const V = DOCUMENT_TYPE_DECLARATION_VIOLATIONS

    if (template.key.length === 0) {
      at(V.keyEmpty, null, 'a document type must carry a non-empty key')
    } else if (seenKeys.has(template.key)) {
      at(V.keyShippedTwice, null, 'another template in this declaration ships the same key')
    } else {
      seenKeys.add(template.key)
    }

    if (!FIDELITIES.includes(template.expectedFidelity)) {
      at(V.vocabularyUnrecognised, null, 'expectedFidelity is not an AcquisitionFidelity')
    }
    if (!DOMAINS.includes(template.domain)) {
      at(V.vocabularyUnrecognised, null, 'domain is not a DomainKey')
    }
    if (!Object.hasOwn(CARRIES_CONTROL_TOTAL, template.carriesControlTotal)) {
      at(V.vocabularyUnrecognised, null, "carriesControlTotal is neither 'always' nor 'never'")
    }

    /* G134. Only when the fidelity is a KNOWN rung: an unknown one is already
     * a finding above, and `FIDELITY_CROSSES_MANAGED_SERVICE[unknown]` is
     * `undefined`, which must not read as either answer. */
    if (
      template.fields.length === 0 &&
      FIDELITIES.includes(template.expectedFidelity) &&
      FIDELITY_CROSSES_MANAGED_SERVICE[template.expectedFidelity]
    ) {
      at(
        V.fieldlessTypeCrossesManagedService,
        null,
        'no fields, so no document-level ceiling is computable, and the declared rung ' +
          'crosses a managed-service boundary (G134)',
      )
    }

    const seenPaths = new Set<string>()
    template.fields.forEach((field, index) => {
      const key = fieldPathKey(field.path)
      if (seenPaths.has(key)) {
        at(V.fieldDeclaredTwice, index, 'another field in this template addresses the same position')
      } else {
        seenPaths.add(key)
      }
      if (!DATA_TYPE_VALUES.includes(field.dataType)) {
        at(V.vocabularyUnrecognised, index, 'dataType is not a DataType')
      }
      if (!DATA_CLASS_VALUES.includes(field.dataClass)) {
        at(V.vocabularyUnrecognised, index, 'dataClass is not a DataClass')
      }
      if (field.confidenceFloor !== null && !isRatio(field.confidenceFloor)) {
        at(V.confidenceFloorNotARatio, index, 'confidenceFloor must be null or a finite ratio in [0, 1]')
      }
    })
  }
  return out
}

/* ==================================================================== *
 * §3  THE SEAM'S VERDICT
 * ==================================================================== */

/**
 * One finding at the seam, tagged with the validator that raised it.
 *
 * `declaration_declares_nothing` is the seam's own: a publication of ZERO
 * document types would otherwise pass every validator over an empty set and
 * answer `admitted` — `docs/HANDOFF.md` §5.6, a control over nothing reported
 * as a clean pass, at the one place a refusal is the whole product.
 */
export type DocumentTypePublicationFinding =
  | { readonly validator: 'seam'; readonly rule: 'declaration_declares_nothing' }
  | { readonly validator: 'document_type'; readonly violation: DocumentTypeDeclarationViolation }
  | { readonly validator: 'classification'; readonly violation: ClassificationRuleViolation }

export type DocumentTypePublicationVerdict =
  | { readonly verdict: 'admitted'; readonly templates: readonly DocumentTypeTemplate[] }
  | { readonly verdict: 'refused'; readonly findings: readonly DocumentTypePublicationFinding[] }

/**
 * THE SEAM. Admitted iff the declaration is non-empty and BOTH validators
 * return nothing. All findings are returned, never only the first — a seam
 * that stops at one finding sends an author round the loop once per defect.
 *
 * `extract` is INJECTED for `validatePackClassificationRules()`'s reason:
 * `applyExtraction()` lives in `model/reconciliation.ts`, and the call site is
 * where the two are joined.
 *
 * 🛑 ADMITTED IS NOT WRITTEN. The verdict hands back the SAME templates it was
 * given so a writer has nothing to re-read between the check and the write;
 * which writer, under which gate, is G4204's question and not this
 * function's.
 */
export function admitDocumentTypeDeclaration(
  templates: readonly DocumentTypeTemplate[],
  rules: readonly PackClassificationRule[],
  extract: ExtractionFn,
): DocumentTypePublicationVerdict {
  const findings: DocumentTypePublicationFinding[] = []
  if (templates.length === 0) {
    findings.push({ validator: 'seam', rule: 'declaration_declares_nothing' })
  }
  for (const violation of validateDocumentTypeTemplates(templates)) {
    findings.push({ validator: 'document_type', violation })
  }
  for (const violation of validatePackClassificationRules(templates, rules, extract)) {
    findings.push({ validator: 'classification', violation })
  }
  return findings.length === 0
    ? { verdict: 'admitted', templates }
    : { verdict: 'refused', findings }
}
