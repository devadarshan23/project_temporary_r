/**
 * A DOCUMENT TYPE'S DECLARATION, AND WHAT A FILE SAID ABOUT ITSELF, READ BACK
 * OUT OF TYPED COLUMNS. G1405, 21 Sep 2026.
 *
 * ┌─ WHAT THIS CLOSES, MEASURED BEFORE IT WAS WRITTEN ─────────────────────────┐
 * │ `DocumentType` had NO TABLE ANYWHERE. Seven declared fields and not one    │
 * │ column, while `tenant.document_field_spec` and `tenant.source_document`    │
 * │ both key on `document_type_id` — two tables pointing at a row that did     │
 * │ not exist. Derive it against the commit before this one:                   │
 * │                                                                            │
 * │   grep -rn 'CREATE TABLE tenant.document_type' db/          → nothing      │
 * │   grep -rln 'carries_control_total' db/migrations/                         │
 * │     → db/migrations/0160_definition_engine_spec.sql   (the DEFINITION's    │
 * │       table, once per definition population, not the type's)               │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ─── R11, THE OWNER'S RULING OF 21 Sep 2026 ──────────────────────────────────
 *
 * **"`DocumentType` gets its own tenant table, one row per document type."**
 *
 * `db/migrations/0180_document_type_and_control_total.sql` applies it and
 * argues the cost on its own face. The reasoning in one line: keying a document
 * type's properties to a DEFINITION means two definitions reading the same type
 * can disagree about its fidelity and about whether it carries a trailer, which
 * is invariant 4 — *"Classification is declared once, on `FieldSpec`, and
 * everything derives from it"* — failing one level up.
 *
 * ⚠️ **AND R11 DOES NOT CLOSE THE DRIFT BY ITSELF, WHICH IS SAID HERE RATHER
 * THAN LEFT TO BE DISCOVERED.** `0160`'s `definition_population
 * .carries_control_total` is NOT dropped — G88 is forward-only and
 * `PopulationBinding.carriesControlTotal` is still a REQUIRED field of
 * `SetReconciliationInput`, so dropping it is a MODEL change (DP-2) and not a
 * migration. **After this slice there are two columns spelling one
 * declaration.** The obligation therefore moves to whoever assembles a
 * `PopulationBinding` — E4, document assembly, which this slice deliberately
 * does not build: it must read `readDocumentType()` and pass
 * `carriesControlTotal` through, and must never read the definition's copy.
 * `tests/db/document-type-and-control-total.test.ts` §8 pins the TWO at an
 * assertion the commit that folds them has to delete on purpose.
 *
 * ─── THIS IS A READER WITH NO ROUTE, AND THAT IS THE PRECEDENT, NOT A GAP ────
 *
 * ✅ **ONE READER HERE HAS A ROUTE SINCE 4 Oct 2026 — G3941, `listDocumentTypes`
 * (§3a), mounted by `server/data-plane/document-types.ts` on `view_endpoint`.**
 * The paragraphs below are CORRECTED RATHER THAN DELETED, because they are the
 * argument that slice answered: G300's three parts are now all present for a
 * PICK LIST — the table (`0180`), the model (`DocumentType.label`) and a
 * capability whose class already covers where a document type is chosen
 * (`endpoint`, the pairing form and the parked pile). `readDocumentType()` and
 * `readDocumentControlTotal()` are still readers with no route, and the
 * `grep … → 0` below has not answered 0 since `declareEndpointDocumentType`
 * (G2681) and now also counts this one.
 *
 * Nothing mounts either function; the callers are in `tests/` and nowhere else.
 * `server/data-plane/definition-store.ts` is the same shape from 20 Sep 2026,
 * `server/control-plane/roster-store.ts` the same shape one plane over, and
 * `db/migrations/0007_run_engine_account.sql` is the precedent for a column set
 * proven WITHOUT a route. **No contract operation on any of the seven tiers
 * reads a document type's declaration** — derive it, do not assume it:
 *
 *     grep -rn 'operationId' docs/contracts/*.openapi.yaml \
 *       | grep -ciE 'documenttype|createdocument'                     → 0
 *
 * so G300's three-part test — table AND model AND capability — cannot even be
 * STARTED for one. The served set is unchanged by this file; derive it, never
 * read it:
 *
 *     node tools/served-set.mjs          # 30 of 136, by tier
 *
 * ⚠️ A RECURSIVE GREP FOR THE HANDLER KEY STOOD HERE WITH ITS TWO PATHS
 * SPELLED OUT, BECAUSE A GLOB BETWEEN `server` AND `start.ts` ENDS A BLOCK
 * COMMENT and silently turns the rest of the file into code — witnessed here,
 * 20 `TS1005`/`TS1443`/`TS1489` errors from one derivation in a header.
 * **That workaround is what put this paragraph inside the command's own
 * scope**, and G2081's gate counted it on 23 Sep 2026. The command was also
 * answering once per TIER MOUNT rather than once per operation. The tool
 * parses the contracts and strips comments, so neither failure survives it.
 *
 * ─── THE ONE CONTROL IN THIS FILE THAT IS NOT A RUNTIME CHECK ────────────────
 *
 * `StoredDocumentType` is an `Omit` OF THE MODEL'S OWN INTERFACE and never a
 * hand-written restatement of it, which is `definition-store.ts`'s device
 * carried across. So an EIGHTH field on `DocumentType` is a `TS2739` HERE, in
 * the reader, rather than a column somebody forgets — the difference between a
 * schema that tracks the model and a schema that used to.
 *
 * ⚠️ AND THE TWO IT OMITS ARE OMITTED FOR TWO DIFFERENT REASONS, enumerated
 * rather than waved at:
 *
 *   `tenantId`   NOT type content, and storing it as an ANSWER would be worse
 *                than useless. **Invariant 1: *"Tenant scope is derived from
 *                the session, never read from a request."*** The column exists
 *                because the POLICY is keyed on it; it is never read back out
 *                as a value, because the value that matters is the scope's.
 *   `fields`     ALREADY HAS A HOME — `tenant.document_field_spec`, `0012` §5,
 *                keyed on `document_type_id`. A second one here would be *"two
 *                spellings of one declaration"* applied to a field list, which
 *                is the very thing R11 was taken to stop. `readDeclarations()`
 *                in `server/data-plane/payload-store.ts` is that reader and
 *                this module does not duplicate it.
 *
 * ⚠️ A CONCURRENT SLICE (E1) IS ADDING `data_type` TO `document_field_spec`.
 * This module does not touch that table or that column, and joining a
 * `FieldSpec` to a document type is E4's, not this file's.
 */

import type { ControlTotal, DocumentType, Money } from '../../model/domain.ts'
import { ACQUISITION_FIDELITY, DOMAIN_KEYS } from '../../model/domain.ts'
import { guardMoney, parseMinorUnits } from '../../model/money.ts'

import type { ScopedClient } from '../../db/tenant-scope.ts'

/* ==================================================================== *
 * §1  THE ANSWERS — a refusal names its COLUMN, never its value
 * ==================================================================== */

/**
 * WHERE THE READ STOPPED, BY TABLE AND COLUMN AND NEVER BY VALUE.
 *
 * 🛑 THE VALUE IS DELIBERATELY NOT CARRIED. An unreadable column holds
 * something nobody declared, and a refusal that quotes it hands whatever is in
 * that cell to every consumer of this answer — which on `label` is free text
 * and on `kind` is a string an extractor wrote. `definition-store.ts`'s
 * `DefinitionDefect` is the same shape for the same reason.
 */
export interface DocumentTypeDefect {
  readonly table: string
  readonly column: string
}

/**
 * The six columns `0180` §1 stores, typed as the MODEL's own fields.
 *
 * An `Omit` and never a restatement: an eighth field on `DocumentType` is a
 * `TS2739` at the object literal in `§3`, in this file, rather than a column
 * nobody adds.
 */
export type StoredDocumentType = Omit<DocumentType, 'tenantId' | 'fields'>

export type DocumentTypeRead =
  | { readonly kind: 'document_type'; readonly documentType: StoredDocumentType }
  /** No row for that id IN THIS SCOPE. Under G100 an unscoped read answers the
   *  same way, which is the deny-on-NULL posture doing its job rather than a
   *  case to special-case. */
  | { readonly kind: 'no_document_type' }
  | { readonly kind: 'unreadable'; readonly defect: DocumentTypeDefect }

export type ControlTotalRead =
  | { readonly kind: 'control_total'; readonly controlTotal: ControlTotal }
  | { readonly kind: 'unreadable'; readonly defect: DocumentTypeDefect }

/* ==================================================================== *
 * §2  THE VOCABULARIES — derived from the model's own consts, never copied
 * ==================================================================== */

/**
 * 🛑 DERIVED FROM THE MODEL'S CONST AND NEVER TRANSCRIBED. A literal list here
 * would be `0002`'s third place to drift and `0160`'s own argument against a
 * `CHECK`: *"a THIRD copy of a list `model/domain.ts` already holds and nothing
 * compares."* `Object.values()` of the const IS the comparison, so a fifth
 * `AcquisitionFidelity` needs no edit here and cannot be silently missed.
 */
const FIDELITIES: readonly string[] = Object.values(ACQUISITION_FIDELITY)
const DOMAINS: readonly string[] = Object.values(DOMAIN_KEYS)

/**
 * `'always' | 'never'` has no const in `model/`, so this is the one place a
 * membership test is written out — and it is written as a TOTAL `Record` over
 * the model's own field type rather than as an array, so a THIRD posture
 * (`model/reconciliation.ts` argues at the sibling field that one is
 * *"addable without inverting the meaning of a flag"*) is a `TS2739` here.
 */
const CARRIES_CONTROL_TOTAL: Record<DocumentType['carriesControlTotal'], true> = {
  always: true,
  never: true,
}

/**
 * 🛑 THE FOUR-ARM COMPILE ERROR. `ControlTotal` is an inline union in
 * `model/domain.ts` with no const beside it, so this total `Record` is the only
 * thing that makes a FOURTH arm a compile failure rather than a value this
 * reader quietly refuses. Adding one to the model without deciding how it is
 * stored is then a `TS2739` at this literal.
 */
const CONTROL_TOTAL_KINDS: Record<ControlTotal['kind'], true> = {
  declared: true,
  not_declared_by_format: true,
  expected_but_absent: true,
}

/* ==================================================================== *
 * §3  THE DOCUMENT TYPE
 * ==================================================================== */

/**
 * ⚠️ NO `WHERE tenant_id = …`, AND THE ABSENCE IS THE CONTROL. `0180` §3's
 * policy narrows this read and `withTenantScope()` is what sets the GUC it
 * reads; a predicate written here would be a SECOND narrowing that looks like
 * the first, so a scope that failed to bind would still return one tenant's
 * rows and the RLS negative control in §2 of the suite would pass against a
 * dropped policy. `0150`'s reader states the same rule.
 */
export async function readDocumentType(
  tx: ScopedClient,
  documentTypeId: string,
): Promise<DocumentTypeRead> {
  const bad = (column: string): DocumentTypeRead => ({
    kind: 'unreadable',
    defect: { table: 'document_type', column },
  })

  const result = await tx.query(
    `SELECT id, key, label, domain, expected_fidelity, carries_control_total
       FROM tenant.document_type
      WHERE id = $1`,
    [documentTypeId],
  )
  const row = result.rows[0] as
    | {
        readonly id: unknown
        readonly key: unknown
        readonly label: unknown
        readonly domain: unknown
        readonly expected_fidelity: unknown
        readonly carries_control_total: unknown
      }
    | undefined
  if (row === undefined) return { kind: 'no_document_type' }

  if (typeof row.id !== 'string') return bad('id')
  if (typeof row.key !== 'string') return bad('key')
  if (typeof row.label !== 'string') return bad('label')

  /* THE THREE VOCABULARY COLUMNS. `0180` puts no `CHECK` on any of them
   * deliberately, so an unknown value is stored and refused HERE, by column —
   * `0069`'s polarity: *"an unknown value must reach the model as an
   * `*_unreadable` refusal, not be rejected at write time by a list somebody
   * forgot to extend."* Nothing below coerces, defaults or falls back. */
  if (typeof row.domain !== 'string' || !DOMAINS.includes(row.domain)) return bad('domain')
  if (typeof row.expected_fidelity !== 'string' || !FIDELITIES.includes(row.expected_fidelity)) {
    return bad('expected_fidelity')
  }
  if (
    typeof row.carries_control_total !== 'string' ||
    !Object.hasOwn(CARRIES_CONTROL_TOTAL, row.carries_control_total)
  ) {
    return bad('carries_control_total')
  }

  return {
    kind: 'document_type',
    documentType: {
      id: row.id as StoredDocumentType['id'],
      key: row.key,
      label: row.label,
      domain: row.domain as StoredDocumentType['domain'],
      expectedFidelity: row.expected_fidelity as StoredDocumentType['expectedFidelity'],
      carriesControlTotal:
        row.carries_control_total as StoredDocumentType['carriesControlTotal'],
    },
  }
}

/* ==================================================================== *
 * §3a  EVERY DOCUMENT TYPE IN SCOPE — THE ONE READER WITH A ROUTE
 *      (G3941, 4 Oct 2026; `listDocumentTypes`, `server/data-plane/document-types.ts`)
 * ==================================================================== */

/**
 * What a person needs to PICK a document type: its id, its label and its
 * fidelity — three of the six columns, and nothing else.
 *
 * 🛑 THE LABEL IS OURS, NOT A COUNTERPARTY'S, AND IT IS STILL PARSED BY
 * NOTHING. `0180` §1: *"a pack's own label for the type."* It is written by the
 * migrator or by G110's seam, never on a request path (`0180` grants `SELECT`
 * alone). It is published verbatim and rendered as a TEXT NODE, D6-9's rule.
 *
 * ⚠️ WHY A PICK LIST AND NOT THE WHOLE `StoredDocumentType`: `key`, `domain`
 * and `carriesControlTotal` have no reader on any served surface, and a field
 * on the wire ahead of its reader is `0004`'s refusal one layer up.
 */
export interface DocumentTypeChoice {
  readonly documentTypeId: string
  readonly label: string
  readonly expectedFidelity: StoredDocumentType['expectedFidelity']
}

export type DocumentTypeListRead =
  | { readonly kind: 'document_types'; readonly documentTypes: readonly DocumentTypeChoice[] }
  | { readonly kind: 'unreadable'; readonly defect: DocumentTypeDefect }

/**
 * Every document type this transaction can see, label order.
 *
 * ⚠️ NO `WHERE tenant_id = …`, for §3's reason: the policy narrows, and a
 * second narrowing written here would survive a scope that failed to bind.
 *
 * 🛑 ONE UNREADABLE ROW REFUSES THE WHOLE LIST, which is `readSources()`'s
 * polarity: dropping it would publish a picker that silently lacks a type the
 * tenant declared, and a pair to that type would then render with no name and
 * no explanation. An EMPTY label is not unreadable — it is a string — and the
 * client falls back to a neutral word for it.
 */
export async function listDocumentTypes(tx: ScopedClient): Promise<DocumentTypeListRead> {
  const result = await tx.query(
    `SELECT id, label, expected_fidelity
       FROM tenant.document_type
      ORDER BY label, id`,
  )
  const out: DocumentTypeChoice[] = []
  for (const raw of result.rows) {
    const row = raw as { readonly id: unknown; readonly label: unknown; readonly expected_fidelity: unknown }
    const bad = (column: string): DocumentTypeListRead => ({
      kind: 'unreadable',
      defect: { table: 'document_type', column },
    })
    if (typeof row.id !== 'string') return bad('id')
    if (typeof row.label !== 'string') return bad('label')
    if (typeof row.expected_fidelity !== 'string' || !FIDELITIES.includes(row.expected_fidelity)) {
      return bad('expected_fidelity')
    }
    out.push({
      documentTypeId: row.id,
      label: row.label,
      expectedFidelity: row.expected_fidelity as StoredDocumentType['expectedFidelity'],
    })
  }
  return { kind: 'document_types', documentTypes: out }
}

/* ==================================================================== *
 * §4  WHAT THE FILE SAID ABOUT ITSELF — THREE ARMS, AND A FOURTH STATE
 *     THAT IS A REFUSAL
 * ==================================================================== */

/**
 * 🛑 AN ABSENT ROW IS `unreadable` AND IS NEVER `not_declared_by_format`, AND
 * THIS IS THE LOAD-BEARING LINE IN THE FILE.
 *
 * `SourceDocument.controlTotal` is *"Required and NON-OPTIONAL"* in the model,
 * so a document with no row here has no `ControlTotal` — it has not been
 * extracted. The cheap reading is that a missing row means *"this format has no
 * trailer"*, and it is the exact inversion `model/domain.ts` declares the three
 * arms to prevent: **C18 would then be switched off for every document in the
 * product, silently, on a green gate.** It is also unfixable downstream,
 * because `checkPopulationIntegrity()` treats `not_declared_by_format` as a
 * legitimate declaration and raises nothing.
 *
 * ⚠️ SQL CANNOT HOLD THIS ONE AND `0180` §2 SAYS SO: the foreign key points
 * from the control total to the document, and a `NOT NULL` reference the other
 * way would require a trailer to exist before the document it was read out of,
 * which breaks `admitAndStoreArrival()` at the first arrival — a document row
 * is written at ADMISSION, before any extractor has seen the bytes. **So the
 * three arms are separated in SQL and the fourth state is refused here.**
 * `tests/db/document-type-and-control-total.test.ts` §3c is the witness.
 */
export async function readDocumentControlTotal(
  tx: ScopedClient,
  sourceDocumentId: string,
): Promise<ControlTotalRead> {
  const bad = (column: string): ControlTotalRead => ({
    kind: 'unreadable',
    defect: { table: 'document_control_total', column },
  })

  const result = await tx.query(
    `SELECT kind, line_count, total_currency, total_minor, total_exponent
       FROM tenant.document_control_total
      WHERE source_document_id = $1`,
    [sourceDocumentId],
  )
  const row = result.rows[0] as
    | {
        readonly kind: unknown
        readonly line_count: unknown
        readonly total_currency: unknown
        readonly total_minor: unknown
        readonly total_exponent: unknown
      }
    | undefined

  /* THE FOURTH STATE. See the header above; this is not a `no_control_total`
   * arm on purpose — naming it would invite a caller to handle it as an
   * absence, and an absence is what must never be read as an answer. */
  if (row === undefined) return bad('kind')

  if (typeof row.kind !== 'string' || !Object.hasOwn(CONTROL_TOTAL_KINDS, row.kind)) {
    return bad('kind')
  }
  const kind = row.kind as ControlTotal['kind']

  if (kind !== 'declared') {
    /* `0180`'s `*_payload_is_declared_only` CHECK makes a populated payload
     * unwritable on these two arms, so reaching a non-null here means the
     * constraint was dropped. Refuse rather than ignore: a `not_declared_by_
     * format` row carrying a total is a row somebody edited the schema to
     * write. */
    if (
      row.line_count !== null ||
      row.total_currency !== null ||
      row.total_minor !== null ||
      row.total_exponent !== null
    ) {
      return bad('kind')
    }
    return { kind: 'control_total', controlTotal: { kind } }
  }

  /* ---- the `declared` arm, and BOTH of its fields may legitimately be null.
   * `model/domain.ts`: *"inside THIS arm a null means 'the trailer declared
   * this one and not that one', which cannot be read as 'unchecked' because
   * the arm itself is the assertion that a trailer was found."* A trailer
   * declaring NEITHER is `control_total_declared_nothing`, an ENGINE defect an
   * operator reads — not a refusal here and not a row the database rejects. */
  let lineCount: number | null = null
  if (row.line_count !== null) {
    if (typeof row.line_count !== 'number' || !Number.isInteger(row.line_count)) {
      return bad('line_count')
    }
    lineCount = row.line_count
  }

  const money = totalIn(row.total_currency, row.total_minor, row.total_exponent)
  if (money === 'refused') return bad('total_minor')

  return { kind: 'control_total', controlTotal: { kind: 'declared', lineCount, total: money } }
}

/**
 * The three `Money` columns, whole or absent, THROUGH THE ONE CODEC.
 *
 * 🛑 G111/G286: `model/money.ts` is the only thing in this repository permitted
 * to convert, and a `Number()` here would put the 2^53 ceiling back at the read
 * surface G286 was taken to lift — on a CONTROL TOTAL, which is the one figure
 * in the product whose whole job is to be compared against a sum.
 * `server/data-plane/exception-store.ts` reads its `int8` columns the same way
 * and this is that function's shape, differing only in that it answers a MODEL
 * `Money` (a `bigint`) rather than a wire one (a decimal string).
 *
 * ⚠️ `0180`'s `*_money_is_whole` CHECK makes the mixed case unwritable, so the
 * `'refused'` arm means the constraint was dropped or the amount is
 * unparseable. Both are defects rather than empty answers.
 */
function totalIn(
  currency: unknown,
  minor: unknown,
  exponent: unknown,
): Money | null | 'refused' {
  if (currency === null && minor === null && exponent === null) return null
  if (typeof currency !== 'string') return 'refused'
  if (typeof exponent !== 'number' || !Number.isInteger(exponent)) return 'refused'
  /* `pg` hands an `int8` back as a STRING, which is what keeps it exact. */
  if (typeof minor !== 'string') return 'refused'
  const parsed = parseMinorUnits(minor)
  if (!parsed.ok) return 'refused'

  const money: Money = { currency, amountMinor: parsed.value, exponent }
  /* The codec's own guard, so an out-of-range or malformed unit is refused at
   * the seam rather than by whoever sums it. */
  if (guardMoney(money) !== null) return 'refused'
  return money
}
