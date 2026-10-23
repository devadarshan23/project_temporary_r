/**
 * Proof obligation for docs/domain-model.md §7.
 *
 * Finance and KYC expressed as DATA against the identical core types. If this
 * file compiles with no new types and no engine branching, the
 * domain-neutrality claim is demonstrated rather than asserted.
 *
 * Finance reconciles records against records (3 sources).
 * KYC reconciles a document against a registry (2 required + 1 optional).
 */

import type {
  DefinitionId,
  Disposition,
  EndpointReading,
  EvaluationGateId,
  FieldSpec,
  Money,
  Reversibility,
  OperatorProposal,
  OperatorProposalDecision,
  PackBinding,
  DefinitionTemplate,
  DocumentTypeId,
  ProposedTransaction,
  ReconciliationDefinition,
  RetentionPolicy,
  RuleId,
  DocumentTypeTemplate,
  SolutionPack,
  SolutionPackId,
  ProcedureId,
  TenantId,
  DomainClaim,
  IdentityConnection,
  /* #222 [A-2] and #223 [A-5], 22 Aug 2026 — the session line. */
  FederatedCallback,
  Session,
  SessionHandleDigest,
  SignInAttempt,
} from './domain'
import {
  DATA_CLASSES,
  DOMAIN_CHALLENGE_ALGORITHMS,
  DOMAIN_KEYS,
  IDENTITY_PROTOCOLS,
  REVERSIBILITY,
  SEVERITIES,
  TOOL_KEYS,
} from './domain.ts'
import type { ConnectorParameterSet } from './connectors'
import type { IdentifierNormalisation } from './reconciliation'
import type { PackClassificationRule } from './ingestion'
/* G184/G206. A VALUE import and therefore `.ts` — node's ESM resolver adds
 * none, and this module is one of the three that once could not be loaded at
 * all for exactly this reason while `tsc` stayed green. The corpus reads
 * `INTAKE_CHANNEL_KINDS.mailbox` rather than the string, so a fixture cannot
 * become the second intake vocabulary G184 forbids. */
import { INTAKE_CHANNEL_KINDS } from './ingestion.ts'
import { CONNECTOR_PARAMETER_KINDS } from './connectors.ts'
import type { CapabilityRequirement } from './access'
import { CAPABILITIES } from './access.ts'
import type { SubjectLocation, TenantAccessGrant } from './governance'
import type { AutonomyConfig, ManagedServiceUseConfig, PolicyDefaults } from './policy'
/* From `./kernel` directly, per the standing rule: a name with no re-export
 * history here has none to preserve. Needed because `PackBinding.modelOverride`
 * was branded on 7 Aug 2026 — see the field's comment in domain.ts. */
import type {
  AccountId,
  AuthorizationGrantId,
  EndpointId,
  EndpointReadingId,
  IdentityConnectionId,
  ModelCatalogEntryId,
  OperatorProposalDecisionId,
  PartnerId,
  OperatorProposalId,
  ProcedureStepId,
  TenantAccessGrantId,
  UserId,
} from './kernel'
import type { FieldPath, SessionId, SignInAttemptId } from './kernel'
/* G214 — the ONE seam. A fixture may not mint a `FieldPath` any other way. */
import { parseFieldPath } from './field-path.ts'

const tenant = 'ten_acme' as TenantId

/* ------------------------------------------------------------------ *
 * FIELD PATHS — G214, and what the old spelling was hiding
 *
 * ⚠️ EVERY PATH IN THIS FILE WAS A DOTTED STRING UNTIL 22 Aug 2026, AND NOT ONE
 * OF THEM ADDRESSED ANYTHING. `FieldPath` was `= string`, so `fixturePath('header', 'po_number')`
 * was a label that read as a locator. G214 makes it a token list parsed at one
 * seam; the translation below is mechanical for every header-grain path —
 * `'a.b'` becomes `['a', 'b']`.
 *
 * 🛑 IT IS NOT MECHANICAL FOR THE `lines[]` PATHS, AND THE LOSS IS NAMED RATHER
 * THAN PAPERED OVER. `fixturePath('qty_received')` used `[]` as a WILDCARD meaning
 * *every element*. G214's grammar has key segments and INDEX segments and no
 * wildcard — "a path addresses EXACTLY ONE position or it refuses" is what makes
 * a `FieldSpec` bind to one key, which is the whole of G106's addressing half.
 * Inventing an `each` segment would widen one `FieldSpec` to N keys and is a
 * ruling this slice was not given.
 *
 * So a line-grain path becomes LINE-RELATIVE: `['qty_received']`, resolved
 * against one `ExtractedLine.fields` at a time. That is what the engine already
 * does — `presentedRows()` hands `admitOne()` a single line's field record — and
 * the rules carrying these paths declare `scope: 'line'` on themselves, so the
 * `lines[]` prefix was a SECOND declaration of a scope its sibling already
 * stated. If a wildcard is genuinely wanted it needs a ruling of its own.
 * ------------------------------------------------------------------ */

/**
 * ⚠️ FIXTURE-ONLY UNWRAP, AND THE THROW IS THE POINT. `parseFieldPath()` returns
 * a refusal rather than throwing, because a path arriving from a counterparty
 * document or an operator form is a runtime condition with an operator-visible
 * fix. A path written HERE is a literal in this file: a refusal is a defect in
 * this module, and failing at module load is the loudest way to say so. Nothing
 * outside a fixture may do this.
 */
function fixturePath(...tokens: readonly (string | number)[]): FieldPath {
  const parsed = parseFieldPath(tokens)
  if (!parsed.ok) {
    throw new Error(`model/examples.ts declares an unparseable FieldPath: ${parsed.refusal.kind}`)
  }
  return parsed.path
}

/**
 * A pack ships TEMPLATES. Installing one mints tenant-scoped copies.
 *
 * Previously the platform Finance pack pointed straight at Acme's definition —
 * a control-plane row referencing a tenant-scoped one. This helper makes the
 * direction explicit: the tenant instance is derived FROM the template, never
 * the other way round.
 */
function asTemplate(d: ReconciliationDefinition): DefinitionTemplate {
  const { id, tenantId, procedureId, ...template } = d
  return template
}

/* ---------------- Finance: three-way match ---------------- */

export const financeThreeWay: ReconciliationDefinition = {
  id: 'def_fin_3way' as DefinitionId,
  tenantId: tenant,
  name: 'Invoice / PO / Goods Receipt',
  domain: DOMAIN_KEYS.finance,
  archetype: 'n_way_document_match',
  config: {
    kind: 'n_way_document_match',
    sources: [
      {
        slot: 'invoice',
        documentTypeId: 'dt_invoice' as DocumentTypeId,
        cardinality: 'exactly_one',
        role: 'comparand',
      },
      {
        slot: 'purchase_order',
        documentTypeId: 'dt_po' as DocumentTypeId,
        cardinality: 'exactly_one',
        // The PO is the commercial authority: it is what was agreed.
        role: 'reference',
      },
      {
        slot: 'goods_receipt',
        documentTypeId: 'dt_grn' as DocumentTypeId,
        cardinality: 'at_least_one',
        role: 'comparand',
      },
    ],
    matchKeys: [
      {
        slotPaths: {
          invoice: fixturePath('header', 'po_number'),
          purchase_order: fixturePath('header', 'po_number'),
          goods_receipt: fixturePath('header', 'po_number'),
        },
        normaliser: 'digits_only',
      },
    ],
    // Line pairing is explicit. Without it, invoice line 3 pairs with PO line 3
    // only by luck, and a vendor re-sorting its lines produces five false
    // exceptions. This was P0-5.
    lineMatchKeys: [
      {
        slotPaths: {
          invoice: fixturePath('item_code'),
          purchase_order: fixturePath('item_code'),
          goods_receipt: fixturePath('item_code'),
        },
        normaliser: 'casefold',
      },
    ],
    rules: [
      {
        id: 'r_qty' as RuleId,
        version: 1,
        scope: 'line',
        label: 'Received quantity must equal invoiced quantity',
        predicate: {
          kind: 'equals',
          left: { kind: 'field', slot: 'goods_receipt', path: fixturePath('qty_received') },
          right: { kind: 'field', slot: 'invoice', path: fixturePath('qty_billed') },
          tolerance: null,
        },
        when: null,
        severity: SEVERITIES.high,
      },
      {
        id: 'r_price' as RuleId,
        version: 1,
        scope: 'line',
        label: 'Invoiced unit price must match the purchase order within 2%',
        predicate: {
          kind: 'not_exceeds',
          left: { kind: 'field', slot: 'invoice', path: fixturePath('unit_price') },
          right: { kind: 'field', slot: 'purchase_order', path: fixturePath('unit_price') },
          // One-sided on purpose: being charged LESS than the PO is not an
          // exception. The old two-sided comparator raised one anyway.
          tolerance: { kind: 'percentage', value: 2 },
        },
        // Conditional tolerance, previously inexpressible.
        when: {
          kind: 'in_set',
          subject: { kind: 'field', slot: 'purchase_order', path: fixturePath('header', 'vendor_country') },
          values: ['SG'],
        },
        severity: SEVERITIES.critical,
      },
    ],
  },
  fx: {
    baseCurrency: 'SGD',
    rateSource: 'mas_daily',
    rateDate: 'document_date',
  },
  enabledTriggers: ['scheduled'],
  tags: { cost_center: 'FIN-AP', environment: 'production' },
  version: 1,
  status: 'active',
  procedureId: 'proc_ap_exceptions' as ProcedureId,
}

/* ---------------- KYC: identity vs registry ---------------- */

export const kycIdentity: ReconciliationDefinition = {
  id: 'def_kyc_identity' as DefinitionId,
  tenantId: tenant,
  name: 'Identity document vs registry record',
  domain: DOMAIN_KEYS.kyc,
  archetype: 'attribute_verification',
  config: {
    kind: 'attribute_verification',
    subject:
      {
        slot: 'identity_document',
        documentTypeId: 'dt_passport' as DocumentTypeId,
        cardinality: 'exactly_one',
        role: 'comparand',
      },
    corroborators: [
      {
        slot: 'registry_record',
        documentTypeId: 'dt_registry' as DocumentTypeId,
        cardinality: 'exactly_one',
        // The registry is the authority. Findings read as the document
        // disagreeing with the registry, never the reverse.
        role: 'reference',
      },
      {
        // 'optional' is what lets a 2-source reconciliation reuse the N-source
        // path. No two-way code path exists, or needs to.
        slot: 'address_proof',
        documentTypeId: 'dt_utility' as DocumentTypeId,
        cardinality: 'optional',
        role: 'comparand',
      },
    ],
    matchKeys: [
      {
        slotPaths: {
          identity_document: fixturePath('holder', 'national_id'),
          registry_record: fixturePath('subject', 'national_id'),
          address_proof: fixturePath('account', 'national_id'),
        },
        normaliser: 'digits_only',
      },
    ],
    rules: [
      {
        id: 'r_name' as RuleId,
        version: 1,
        scope: 'group',
        label: 'Document holder name must match the registry record',
        predicate: {
          kind: 'fuzzy_name',
          left: { kind: 'field', slot: 'identity_document', path: fixturePath('holder', 'full_name') },
          right: { kind: 'field', slot: 'registry_record', path: fixturePath('subject', 'full_name') },
          minSimilarity: 0.92,
        },
        when: null,
        severity: SEVERITIES.critical,
      },
      {
        id: 'r_dob' as RuleId,
        version: 1,
        scope: 'group',
        label: 'Date of birth must match exactly',
        predicate: {
          kind: 'equals',
          left: { kind: 'field', slot: 'identity_document', path: fixturePath('holder', 'dob') },
          right: { kind: 'field', slot: 'registry_record', path: fixturePath('subject', 'dob') },
          tolerance: null,
        },
        when: null,
        severity: SEVERITIES.critical,
      },
      {
        id: 'r_expiry' as RuleId,
        version: 1,
        scope: 'group',
        label: 'Identity document must not expire within 30 days',
        predicate: {
          kind: 'within_days',
          subject: { kind: 'field', slot: 'identity_document', path: fixturePath('document', 'expiry_date') },
          days: 30,
          // The reference point is named; it used to be an invisible `now`.
          from: 'run_date',
        },
        when: null,
        severity: SEVERITIES.medium,
      },
    ],
  },
  fx: null,
  enabledTriggers: ['ingest'],
  tags: { cost_center: 'RISK-KYC', environment: 'production' },
  version: 1,
  status: 'active',
  procedureId: 'proc_kyc_review' as ProcedureId,
}

/**
 * Both definitions are the same type. No `kind` discriminator, no per-domain
 * entity, no engine branch. The only difference is data.
 */
export const seededDefinitions: ReconciliationDefinition[] = [
  financeThreeWay,
  kycIdentity,
]


/**
 * One declaration, two deployments. Sandbox runs a cheaper model with autonomy
 * off; production runs the real thing with approval required. The pack itself
 * is identical — which is what stops a demo surface drifting from a real one.
 */
const standardBindings: PackBinding[] = [
  {
    environment: 'sandbox',
    /**
     * A CATALOGUE ROW, NOT A PROVIDER STRING. This read
     * `'apac.anthropic.claude-haiku-4-5-20251001-v1:0'` until 7 Aug 2026, and
     * that is precisely the shape invariant 7 warns about: a model identity
     * reaching a persisted row without passing `resolveModel()`, which is the
     * only place `global.*` routing is refused and the only place a region is
     * checked. The provider string still exists — it is
     * `ModelCatalogEntry.modelId` on the row this id names, where R1 in
     * identity.ts says a bare string is correct because AWS mints it.
     */
    modelOverride: 'mce_claude_haiku_4_5_apac' as ModelCatalogEntryId,
    autonomyEnabled: false,
    requiresApproval: false,
  },
  {
    environment: 'production',
    modelOverride: null,
    autonomyEnabled: true,
    requiresApproval: true,
  },
]

/* ---------------- Solution packs: ship two, name four ---------------- */

/** The tree corpus for connector validation; each enforcement row is exercised. */
export const connectorParameterSets: ConnectorParameterSet[] = [{
  declaredBy: 'example_sftp',
  parameters: [
    { name: 'strictHostKeyChecking', kind: CONNECTOR_PARAMETER_KINDS.tlsVerification, declaredValue: 'yes', secret: false, insecureValues: ['no'] },
    { name: 'proxyHost', kind: CONNECTOR_PARAMETER_KINDS.hostBinding, declaredValue: null, secret: false, insecureValues: [] },
    { name: 'credentialRef', kind: CONNECTOR_PARAMETER_KINDS.credentialRef, declaredValue: null, secret: false, insecureValues: [] },
    { name: 'bufferSizeBytes', kind: CONNECTOR_PARAMETER_KINDS.descriptive, declaredValue: '65536', secret: false, insecureValues: [] },
  ],
}]


/**
 * The domain strategy from PRODUCT.md, expressed as data. `availability`
 * carries the honesty constraint into the type system: an 'announced' pack is
 * named in the UI but has nothing to demonstrate, so no surface can accidentally
 * present it as walkable.
 */
/* ---------------- G206 — the pack classification corpus ----------- *
 *
 * 🛑 THIS EXISTS SO `check:packs` IS NOT VACUOUS ON THE THIRD VALIDATOR, AND
 * THAT IS NOT A TEST-SHAPED REASON. `tools/check-pack-safety.mjs` reports a
 * `vacuous` finding rather than a clean pass precisely so that "I checked and
 * found nothing" cannot read as "I checked and it was fine" — its own header
 * calls the tree's empty corpus §5.6 and says the checker proves nothing about
 * it. Landing `validatePackClassificationRules()` with `classificationRules: []`
 * on all four packs would have reproduced that state deliberately, one tier
 * down, inside the slice that added the validator.
 *
 * So `pack_finance_ap` ships ONE document type and ONE rule, and the gate
 * validates a real rule against a real template on every run.
 * ----------------------------------------------------------------- */

/**
 * `ACME-INV-2026-001.pdf` → split on `'-'`, take segment 1 → `INV` → casefold.
 *
 * 🛑 A DECLARED OP LIST, NOT A PATTERN, AND NOTHING COMPILES IT. Every op is
 * total, has no quantifier and allocates no backtracking state — so catastrophic
 * backtracking is not a bound chosen here but a property that cannot arise. A
 * reviewer approving this is approving something they can evaluate, which is
 * G124's deciding argument and G206's reason for reusing G130's replacement
 * rather than minting a second normaliser.
 *
 * ⚠️ `maxInputChars` IS STATED, NOT DEFAULTED. `IdentifierNormalisation` refuses
 * a default and says why: a bound nobody wrote down is not a bound. 128 is a
 * filename cap and is illustrative — `PRODUCT.md` forbids presenting an
 * in-product figure as anything else.
 */
const senderFilenameConvention: IdentifierNormalisation = {
  ops: [{ kind: 'split_take', separator: '-', index: 1 }],
  then: 'casefold',
  maxInputChars: 128,
}

/**
 * The one document type the AP pack ships, and the target its one rule resolves
 * to.
 *
 * ⚠️ IT DECLARES A FIELD, AND THAT IS LOAD-BEARING RATHER THAN DECORATIVE. G134
 * rules a `DocumentType` declaring NO fields may cross no managed-service
 * boundary, because `dataClass` is declared per field and there is nothing to
 * take a maximum over. `digital_text` puts a model on the layout, so a fieldless
 * template declaring it would be refused at publication by
 * `target_cannot_reach_declared_fidelity`. This one carries the invoice number,
 * so the ceiling is computable.
 */
const supplierInvoiceTemplate: DocumentTypeTemplate = {
  key: 'dt_supplier_invoice',
  label: 'Supplier invoice',
  domain: DOMAIN_KEYS.finance,
  fields: [
    {
      path: fixturePath('header', 'invoice_number'),
      label: 'Invoice number',
      dataType: 'identifier',
      required: true,
      dataClass: DATA_CLASSES.internal,
      /* An invoice number is a reference, not an identity document. */
      modelProcessingAllowed: true,
      confidenceFloor: null,
    },
  ],
  expectedFidelity: 'digital_text',
  carriesControlTotal: 'never',
}

/**
 * A CONJUNCTION: the filename convention AND the lane. Both must hold.
 *
 * ⚠️ `'inv'` IS LOWER CASE AND THAT IS THE VALIDATOR'S POINT, NOT A TYPO. The
 * declared values are compared against the EXTRACTION's output, never against a
 * raw filename, and the extraction terminates in `casefold`. `'INV'` here would
 * be a predicate that is silently false forever — the open item G130's own
 * docblock named and declined to build, and which
 * `signal_value_not_in_canonical_form` now refuses at publication.
 *
 * ⚠️ THE `intake_channel_is` ARM READS `IntakeChannelKind` AND DOES NOT RESTATE
 * ITS MEMBERS. G184 rules the intake vocabulary to exactly one member set.
 */
const supplierInvoiceClassification: PackClassificationRule = {
  documentTypeKey: 'dt_supplier_invoice',
  signals: [
    {
      kind: 'filename_extraction_in_set',
      extraction: senderFilenameConvention,
      values: ['inv'],
    },
    { kind: 'intake_channel_is', channel: INTAKE_CHANNEL_KINDS.mailbox },
  ],
}

export const solutionPacks: SolutionPack[] = [
  {
    id: 'pack_finance_ap' as SolutionPackId,
    key: 'finance_ap',
    label: 'Finance — Accounts Payable',
    domain: DOMAIN_KEYS.finance,
    version: 1,
    authoredBy: null,
    availability: 'available',
    lifecycle: 'active',
    posture: {
      maxLatencyP95Ms: 90_000,
      costCeilingPerRun: { currency: 'SGD', amountMinor: 42n, exponent: 2 },
      targetOutcomeScore: 0.87,
      complianceScope: ['PDPA'],
    },
    rollout: {
      // Sandbox tenants first, then named tenants in batches with a pause —
      // the fleet equivalent of a branch-wise banking rollout.
      strategy: { kind: 'segment', segment: 'sandbox_first' },
      triggers: [
        { kind: 'outcome_breach', belowScore: 0.82 },
        { kind: 'cost_overrun', aboveMinorPerRun: 60 },
        { kind: 'compliance_violation' },
      ],
      autoRollback: true,
      revertsTo: null,
    },
    gateIds: ['gate_component_extraction', 'gate_outcome_matchrate'] as EvaluationGateId[],
    bindings: standardBindings,
    signature: null,
    supersededBy: null,
    documentTypeTemplates: [supplierInvoiceTemplate],
    classificationRules: [supplierInvoiceClassification],
    definitionTemplates: [asTemplate(financeThreeWay)],
    procedureTemplates: [],
    dispositions: [
      { key: 'short_delivery', label: 'Short delivery', family: 'quantity_variance', terminal: true, requiresAdjustment: false, reversibility: 'reversible' },
      { key: 'price_error', label: 'Price error', family: 'price_variance', terminal: true, requiresAdjustment: true, reversibility: 'reversible_with_cost' },
      { key: 'awaiting_grn', label: 'Goods receipt not yet posted', family: 'missing_document', terminal: false, requiresAdjustment: false, reversibility: 'reversible' },
      { key: 'duplicate_invoice', label: 'Duplicate invoice', family: 'duplicate', terminal: true, requiresAdjustment: false, reversibility: 'reversible' },
    ],
    palette: null,
  },
  {
    id: 'pack_kyc_identity' as SolutionPackId,
    key: 'kyc_identity',
    label: 'KYC — Identity Verification',
    domain: DOMAIN_KEYS.kyc,
    version: 1,
    authoredBy: null,
    availability: 'available',
    lifecycle: 'active',
    posture: {
      maxLatencyP95Ms: 90_000,
      costCeilingPerRun: { currency: 'SGD', amountMinor: 42n, exponent: 2 },
      targetOutcomeScore: 0.87,
      complianceScope: ['PDPA'],
    },
    rollout: {
      // Sandbox tenants first, then named tenants in batches with a pause —
      // the fleet equivalent of a branch-wise banking rollout.
      strategy: { kind: 'segment', segment: 'sandbox_first' },
      triggers: [
        { kind: 'outcome_breach', belowScore: 0.82 },
        { kind: 'cost_overrun', aboveMinorPerRun: 60 },
        { kind: 'compliance_violation' },
      ],
      autoRollback: true,
      revertsTo: null,
    },
    gateIds: ['gate_component_extraction', 'gate_outcome_matchrate'] as EvaluationGateId[],
    bindings: standardBindings,
    signature: null,
    supersededBy: null,
    documentTypeTemplates: [],
    classificationRules: [],
    definitionTemplates: [asTemplate(kycIdentity)],
    procedureTemplates: [],
    dispositions: [
      { key: 'short_delivery', label: 'Short delivery', family: 'quantity_variance', terminal: true, requiresAdjustment: false, reversibility: 'reversible' },
      { key: 'price_error', label: 'Price error', family: 'price_variance', terminal: true, requiresAdjustment: true, reversibility: 'reversible_with_cost' },
      { key: 'awaiting_grn', label: 'Goods receipt not yet posted', family: 'missing_document', terminal: false, requiresAdjustment: false, reversibility: 'reversible' },
      { key: 'duplicate_invoice', label: 'Duplicate invoice', family: 'duplicate', terminal: true, requiresAdjustment: false, reversibility: 'reversible' },
    ],
    palette: null,
  },
  {
    id: 'pack_credit' as SolutionPackId,
    key: 'credit_underwriting',
    label: 'Credit Underwriting',
    domain: DOMAIN_KEYS.creditUnderwriting,
    version: 1,
    authoredBy: null,
    // Delivered client work, but nothing built for the demo. Named, not shown.
    availability: 'announced',
    lifecycle: 'draft',
    posture: {
      maxLatencyP95Ms: null,
      costCeilingPerRun: null,
      targetOutcomeScore: null,
      complianceScope: [],
    },
    // Nothing to roll out — the pack is named, not built.
    rollout: null,
    gateIds: [] as EvaluationGateId[],
    bindings: [],
    signature: null,
    supersededBy: null,
    documentTypeTemplates: [],
    classificationRules: [],
    definitionTemplates: [],
    procedureTemplates: [],
    dispositions: [
      { key: 'short_delivery', label: 'Short delivery', family: 'quantity_variance', terminal: true, requiresAdjustment: false, reversibility: 'reversible' },
      { key: 'price_error', label: 'Price error', family: 'price_variance', terminal: true, requiresAdjustment: true, reversibility: 'reversible_with_cost' },
      { key: 'awaiting_grn', label: 'Goods receipt not yet posted', family: 'missing_document', terminal: false, requiresAdjustment: false, reversibility: 'reversible' },
      { key: 'duplicate_invoice', label: 'Duplicate invoice', family: 'duplicate', terminal: true, requiresAdjustment: false, reversibility: 'reversible' },
    ],
    palette: null,
  },
  {
    id: 'pack_medical' as SolutionPackId,
    key: 'medical_records',
    label: 'Medical Records Reconciliation',
    domain: DOMAIN_KEYS.medicalRecords,
    version: 1,
    authoredBy: null,
    availability: 'announced',
    lifecycle: 'draft',
    posture: {
      maxLatencyP95Ms: null,
      costCeilingPerRun: null,
      targetOutcomeScore: null,
      complianceScope: [],
    },
    // Nothing to roll out — the pack is named, not built.
    rollout: null,
    gateIds: [] as EvaluationGateId[],
    bindings: [],
    signature: null,
    supersededBy: null,
    documentTypeTemplates: [],
    classificationRules: [],
    definitionTemplates: [],
    procedureTemplates: [],
    dispositions: [
      { key: 'short_delivery', label: 'Short delivery', family: 'quantity_variance', terminal: true, requiresAdjustment: false, reversibility: 'reversible' },
      { key: 'price_error', label: 'Price error', family: 'price_variance', terminal: true, requiresAdjustment: true, reversibility: 'reversible_with_cost' },
      { key: 'awaiting_grn', label: 'Goods receipt not yet posted', family: 'missing_document', terminal: false, requiresAdjustment: false, reversibility: 'reversible' },
      { key: 'duplicate_invoice', label: 'Duplicate invoice', family: 'duplicate', terminal: true, requiresAdjustment: false, reversibility: 'reversible' },
    ],
    palette: null,
  },
]

/* ==================================================================== *
 * FIXTURES — the construction sites `docs/HANDOFF.md` §5.10 says do not
 * exist
 *
 * A total `Record<K, V>` is enforced AT A CONSTRUCTION SITE. In a
 * types-only model there is none, so the five total records that landed
 * on 7 Aug 2026 could not have failed to compile on a single field
 * chosen — the compiler confirmed the SHAPE was total and never
 * confirmed that any CONTENT satisfied it. Each was defended with a
 * compile-time assertion instead, and two of those assertions ask for
 * this file by name:
 *
 *   `RetentionPolicy`  — *"Retire it the day a fixture or a migration
 *                        constructs a real policy — that is a stronger
 *                        witness, not a redundant one."* (domain.ts)
 *   `PolicyDefaults`   — *"nothing in `model/` constructs a
 *                        `PolicyDefaults`… The first bundle fixture is
 *                        what would witness it."* (policy.ts)
 *
 * The assertions are NOT retired here. A fixture witnesses content; an
 * assertion states intent at the declaration, where the next person
 * edits. Retiring one is a separate decision and is not this change.
 *
 * ⚠️ WHAT A FIXTURE WITNESSES, AND WHAT IT DOES NOT. It witnesses that a
 * value satisfying the type EXISTS and that every key of a total record
 * is answered — so a fourteenth `RetentionClass`, a sixth
 * `LivePolicyKind`, or a relaxation of `days` to `Partial<Record<…>>`
 * now fails to compile HERE, at a value. It does not make any number
 * below correct. Two fixtures carry governed numbers this repository is
 * explicitly not the authority for; both are named `PLACEHOLDER_` so no
 * reader and no call site can mistake one for a position.
 * ==================================================================== */

/* ---------------- 1. RetentionPolicy — 13 classes ---------------- */

/**
 * ⚠️ NOT A RETENTION SCHEDULE. THE NUMBER IS UNIFORM AND MEANINGLESS ON
 * PURPOSE.
 *
 * `docs/HANDOFF.md` §8 item 2: *"The thirteen windows have no values
 * anywhere, deliberately: any number in this repository would be
 * invented. The schema author needs thirteen numbers plus a
 * per-jurisdiction statutory floor map for `retentionWindowValid()`'s
 * `regulatoryMinimumDays`, from a source that does not exist here. That
 * is a counsel question, not an engineering one — raise it before
 * writing the table, not after."*
 *
 * That is unchanged and nothing here answers it. ONE VALUE REPEATED
 * THIRTEEN TIMES IS THE POINT: a plausible spread — 2555 days for
 * `audit_event`, 90 for `trace` — would read as a schedule somebody
 * reasoned about, and nobody has. Uniformity cannot be misread that way.
 *
 * It is nonetheless a VALID policy rather than merely a compiling one,
 * which is the second thing worth witnessing: `retentionWindowValid()`
 * raises `audit_shorter_than_class` on `days > auditDays`, so equal
 * windows satisfy the audit floor for all eight business and content
 * classes. A fixture that compiles and would be REJECTED by the model's
 * own validator would be a worse witness than none.
 */
const PLACEHOLDER_RETENTION_DAYS = 365

export const PLACEHOLDER_RETENTION_POLICY: RetentionPolicy = {
  days: {
    source_document: PLACEHOLDER_RETENTION_DAYS,
    export: PLACEHOLDER_RETENTION_DAYS,
    page_render: PLACEHOLDER_RETENTION_DAYS,
    exception: PLACEHOLDER_RETENTION_DAYS,
    match_group: PLACEHOLDER_RETENTION_DAYS,
    approval: PLACEHOLDER_RETENTION_DAYS,
    audit_event: PLACEHOLDER_RETENTION_DAYS,
    policy_evaluation: PLACEHOLDER_RETENTION_DAYS,
    usage_record: PLACEHOLDER_RETENTION_DAYS,
    data_access_event: PLACEHOLDER_RETENTION_DAYS,
    score_result: PLACEHOLDER_RETENTION_DAYS,
    observed_label: PLACEHOLDER_RETENTION_DAYS,
    trace: PLACEHOLDER_RETENTION_DAYS,
    /**
     * The fourteenth, G233 — and **the placeholder is more misleading here than
     * anywhere else on this list**, which is why it gets its own note.
     *
     * Every other window on this list is measured from a record's creation. This
     * one is G156's IDLE term, measured from the last touch, and it is one of
     * two operands in `least(heldAt + maxOpenDraftAge, lastHeldAt + this)`. A
     * uniform 365 therefore reads as *"a draft nobody touches for a year is
     * deleted"*, which is not a schedule anybody reasoned about — it is the same
     * meaningless uniform number as the thirteen above it, and it is counsel's
     * to replace along with them.
     */
    held_work: PLACEHOLDER_RETENTION_DAYS,
  },
}

/* ---------------- 2. CapabilityRequirement ------------------------ */

/**
 * *"Someone who may approve, on this domain, above this amount"* — the
 * sentence `CapabilityRequirement` was created to make expressible, as a
 * value.
 *
 * `distinctHolders: 2` is four-eyes, and the field comment states what
 * that buys: *"two names, and stating it here is what stops a second
 * signature being the first person signing twice."*
 *
 * Declared before `PolicyDefaults` because that fixture holds one of
 * these — which is itself the thing worth witnessing. `ApprovalConfig
 * .approvers` was `RoleKey[]` until 5 Aug, and a policy naming
 * `'partner_admin'` — or a pack-shipped role that happens to be keyed
 * `'approver'` — made a partner the approving authority for a customer's
 * disposition, the one thing the partner model says a partner may never
 * be. The fixture below cannot express that any more; there is no string
 * to put there.
 *
 * ⚠️ `Money` HERE, `MoneyAmount` ON `AutonomyConfig.autoResolveValueCeiling`
 * — §5.3's live divergence, and this fixture sits on one side of it. G66
 * collapses the two into one type carrying the exponent and is NOT
 * APPLIED. Until it is, a check that must satisfy both ceilings has to
 * convert and no function in the model does.
 */
const approvalThreshold: Money = {
  currency: 'SGD',
  amountMinor: 500_000n,
  /* 2 for SGD. The field that `MoneyAmount` lacks and that BHD versus
   * USD needs — §5.7. */
  exponent: 2,
}

export const fourEyesAboveThreshold: CapabilityRequirement = {
  capability: CAPABILITIES.approveResolution,
  distinctHolders: 2,
  appliesAtOrAboveValue: approvalThreshold,
}

/* ---------------- 3. PolicyDefaults — 6 live kinds ---------------- */

/**
 * The platform default for every live `PolicyKind`, constructed.
 *
 * ⚠️ NOT A PRODUCT POSITION ON DEFAULTS, and `PLACEHOLDER_` says so. Two
 * DIFFERENT KINDS of value appear below and the distinction is the
 * honest part:
 *
 *   · Values the model's own field comments NAME as the default or the
 *     safe empty. `orgClassesThatMayAdmit: ['customer']` (*"`['customer']`
 *     is the default"*), `admittingAgentMayCarryTools: false` (*"FALSE is
 *     the safe value and the default"*), every `{ kind: 'these', values:
 *     [] }` (*"the safe empty value and the one a failed resolution must
 *     return"*), and `allowedRegions: ['ap-southeast-1']` (pass F, the
 *     decided residency region). These are transcribed, not chosen.
 *
 *   · Thresholds nobody has decided — `mandatoryAtOrAbove`,
 *     `maxDataClassInPrompt`, `maxDataClassInOutbound`. A fixture must
 *     contain something, so these lean conservative.
 *
 *     ⚠️ CONSERVATIVE IS NOT THE SAME AS MAXIMAL, AND SAYING SO MATTERS
 *     HERE. `mandatoryAtOrAbove: 'low'` genuinely is the strictest arm —
 *     every severity needs approval. The two class ceilings are NOT:
 *     `'internal'` sits two below `'sensitive_personal'`, and the
 *     strictest value available is `'public'`. `'internal'` was chosen
 *     because `'public'` makes every downstream shape inert and a
 *     fixture nobody can read past teaches nothing. A comment claiming
 *     these were maximal would be §5.6 exactly — a control that reads as
 *     asserting more than it does.
 *
 * `autonomy` is the one to read first. `PolicyDefaults` is total
 * precisely so a bundle cannot omit it and leave *"the most consequential
 * guardrail in an agentic product resolving to `undefined` inside a
 * customer's account"* — so the fixture states it, and states it as
 * autonomy nowhere: severity `'none'`, no domain, no ceiling, no
 * permitted action.
 *
 * ✅ **8 Aug 2026, G79 — THIS FIXTURE IS THE WITNESS THE MAPPED TYPE NEVER
 * HAD, AND IT BIT.** `PolicyDefaults`' own comment predicted that *"a SIXTH
 * kind is a compile error too"*, and `policy.ts`'s assertion block conceded
 * that the totality was *"asserted by the mapped type and witnessed by
 * nothing. The first bundle fixture is what would witness it."* Adding
 * `managed_service_use` to `POLICY_KINDS` produced, verbatim, before the
 * entry below existed:
 *
 *   model/examples.ts(622,14): error TS2741: Property 'managed_service_use'
 *     is missing in type '{ autonomy: …; approval: …; model_use: …;
 *     data_egress: …; correspondence: … }' but required in type
 *     'PolicyDefaults'.
 *
 * That is `docs/HANDOFF.md` §5.10 answered rather than restated: the total
 * `Record` bit because something finally CONSTRUCTS one.
 */
export const PLACEHOLDER_POLICY_DEFAULTS: PolicyDefaults = {
  autonomy: {
    maxAutoResolveSeverity: 'none',
    /* Not `{ kind: 'all' }`. The inversion in §8.6 exists so that a
     * config nobody has filled in authorises autonomy NOWHERE, rather
     * than in KYC, credit underwriting and medical records. */
    autonomousIn: { kind: 'these', values: [] },
    autoResolveValueCeiling: null,
    permittedActions: [],
    /* Proposing is not acting, and the seam between them is the whole
     * shape of the operator-proposal path below: a proposal with no
     * `OperatorProposalDecision` has changed nothing in the ledger. */
    mayProposeBeyondLimits: true,
  },
  approval: {
    approvers: [fourEyesAboveThreshold],
    /* `quorum` and `CapabilityRequirement.distinctHolders` are NOT the
     * same count and the field comment forbids collapsing them: this is
     * the floor on distinct people ACROSS requirements, that one binds
     * WITHIN one. Kept at 1 here so the four-eyes rule below comes from
     * the requirement and is visibly doing the work. */
    quorum: 1,
    mandatoryAtOrAbove: SEVERITIES.low,
    mandatoryAtOrAboveValue: null,
    /* ⚠️ READS AS SATISFIED AND ASSERTS NOTHING WHEN THE PROPOSER IS AN
     * AGENT — `approver !== proposer` is trivially true against
     * `ProposalActor.agent`. Set true because that is the right value in
     * a regulated domain and false would be worse; recorded here because
     * a fixture is exactly where someone reads a green flag as a working
     * control. `docs/HANDOFF.md` §4.1, §5.6. */
    segregationOfDuties: true,
    /* Null, not a number: `ApprovalDecision` carries no `requestedAt`
     * on the exception path, so there is no t0 to measure hours from and
     * a value here would be an unenforceable claim. (The operator path
     * DOES carry one — see `OperatorProposalDecision.requestedAt`.) */
    escalateAfterHours: null,
  },
  model_use: {
    /* Denies by construction, and that is correct rather than awkward
     * under G49: model selection is a control-plane act set by the FDE
     * on behalf of all customers, not a tenant setting. An unfilled
     * tenant allow-list should reach no model at all.
     *
     * ⚠️ `resolveModel()` still takes `allowedModels: string[]` and still
     * applies the empty-permits-ALL rule (`ModelUseConfig` field
     * comment). The two must land together; this fixture does not close
     * that and must not be read as closing it. */
    allowedModels: { kind: 'these', values: [] },
    allowedRegions: ['ap-southeast-1'],
    maxDataClassInPrompt: DATA_CLASSES.internal,
    requireZeroRetention: true,
  },
  managed_service_use: {
    /* Denies by construction, for the same reason `allowedModels` above
     * does — and here it is not merely correct, it is the only safe
     * reading available: the field is a plain `string[]` with no
     * platform default set anywhere, so empty can only mean "no feature
     * permitted". v1's population would be Textract's `AnalyzeDocument`
     * and `DetectDocumentText`; naming them HERE would make a fixture
     * read as a provisioning decision, and G79 provisions nothing. */
    allowedFeatures: [],
    /* Pass F, the decided residency region — transcribed, not chosen,
     * exactly as on `model_use` above.
     *
     * ⚠️ AND IT CARRIES MORE WEIGHT HERE. `ModelUseConfig.allowedRegions`
     * has `resolveModel()` behind it; this one has nothing behind it.
     * Textract is not a `ModelCatalogEntry` and never passes that
     * function, so this line is the whole of extraction's residency
     * constraint — see the banner on `ManagedServiceUseConfig`. */
    allowedRegions: ['ap-southeast-1'],
    /* ⚠️ PLACEHOLDER, and of the second kind described above — a
     * threshold nobody has decided, leaning conservative. It matches
     * `maxDataClassInPrompt` and `maxDataClassInOutbound` deliberately,
     * and it inherits their caveat in full: `'internal'` is CONSERVATIVE
     * AND NOT MAXIMAL. It sits two below `'sensitive_personal'`, and the
     * strictest value available is `'public'`. Chosen so the fixture is
     * readable rather than inert; do not read it as a decided ceiling on
     * what may be handed to a third-party extraction service. */
    maxDataClassToService: DATA_CLASSES.internal,
    /* Genuinely maximal, unlike the line above, and worth the
     * distinction: `0` is the strictest value the field admits — no
     * provider-side retention tolerated at all. Whether Textract's
     * published window in `ap-southeast-1` actually satisfies `0` is a
     * verification nobody has run; the number is still a placeholder in
     * the sense that it states a posture rather than a checked fact.
     * G8's attestation is the mechanism that would check it, and G8 is
     * recorded "not applied". */
    maxProviderRetentionDays: 0,
  },
  data_egress: {
    allowExport: false,
    exportable: { kind: 'these', values: [] },
    requireApprovalToExport: true,
    allowedDestinations: [],
  },
  correspondence: {
    maxDataClassInOutbound: DATA_CLASSES.internal,
    requiresApprovalAboveClass: DATA_CLASSES.internal,
    permittedChannels: [],
    agentMaySendUnattended: false,
    requireVerifiedEndpoint: true,
    capabilityToAdmit: CAPABILITIES.admitCorrespondence,
    /* The field comment: *"`['customer']` is the default."* Never
     * `{ kind: 'all' }` — there is no arrangement under which 1CloudHub
     * staff decide what a customer treats as evidence. */
    orgClassesThatMayAdmit: ['customer'],
    agentMayAdmitInbound: false,
    agentMayAdmitUpToClass: DATA_CLASSES.public,
    secondPersonToAdmitAboveClass: null,
    /* The field comment: *"FALSE is the safe value and the default."*
     * The agent that admits is never the agent that acts. */
    admittingAgentMayCarryTools: false,
  },
}

/* ---------------- 3a. The autonomy gate's fixtures — G129 --------- */

/**
 * The three reversibilities, as three real dispositions.
 *
 * A TOTAL `Record<Reversibility, Disposition>` and it is constructed here,
 * which is the only form of the assertion that bites. `docs/HANDOFF.md` §5.10:
 * a total record over a closed key set is a compile error waiting for a
 * construction site, and until something constructs one *"the compiler told you
 * nothing"*. A fourth `REVERSIBILITY` member becomes TS2741 on this literal.
 *
 * ⚠️ WHY THESE FIXTURES EXIST AT ALL. `AutonomyConfig` and `Disposition
 * .reversibility` had no reader anywhere in `model/` until G129 — the field
 * comment *"An irreversible disposition is never a candidate for autonomous
 * execution however well it has behaved"* was enforced by nothing. A gate with
 * no values to drive it would have replaced a comment claiming enforcement with
 * a function claiming enforcement, which is the same defect one layer up.
 *
 * The `irreversible` member is a write-off deliberately: it is the disposition
 * that closes a residual by declaring the money gone. `family: 'write_off'`
 * belongs to the `set_reconciliation` archetype, and `DispositionFamily` is the
 * union across every archetype, so the three below are legal together even
 * though no single definition would carry all three.
 */
export const autonomyGateDispositions: Record<Reversibility, Disposition> = {
  reversible: {
    key: 'short_delivery',
    label: 'Short delivery',
    family: 'quantity_variance',
    reversibility: REVERSIBILITY.reversible,
    terminal: true,
    requiresAdjustment: false,
  },
  reversible_with_cost: {
    key: 'price_error',
    label: 'Price error',
    family: 'price_variance',
    /* A credit note, a corrected filing, a conversation with the vendor.
     * NOT unconditionally refused by `mayAutoResolve()` — undoing it costs
     * something visible, which argues for a low ceiling and not for a
     * prohibition. */
    reversibility: REVERSIBILITY.reversibleWithCost,
    terminal: true,
    requiresAdjustment: true,
  },
  irreversible: {
    key: 'write_off',
    label: 'Write off residual',
    family: 'write_off',
    reversibility: REVERSIBILITY.irreversible,
    terminal: true,
    requiresAdjustment: true,
  },
}

/**
 * An autonomy envelope that is LIVE and still narrow.
 *
 * `PLACEHOLDER_POLICY_DEFAULTS.autonomy` above is autonomy NOWHERE — severity
 * `'none'`, no domain, no ceiling, no permitted action — which is the right
 * default and a useless witness: every gate refuses it, so it cannot tell a
 * working gate from one that refuses everything. This fixture is the other
 * half of that pair, and the pair is what makes `mayAutoResolve()` testable at
 * all.
 *
 * Every value is narrow on purpose:
 *
 *   · `'low'` — the ceiling `DEFAULT_AUTONOMY_BY_DOMAIN` already sets for
 *     finance, transcribed rather than chosen.
 *   · `{ kind: 'these', values: ['finance'] }` — NEVER `{ kind: 'all' }`.
 *     §8.6's inversion exists so a config nobody filled in authorises autonomy
 *     nowhere, and a fixture that types `{ kind: 'all' }` teaches the opposite
 *     of the lesson the inversion was taken to teach.
 *   · `null` ceiling — and this one is NOT a free choice. A stated ceiling is
 *     refused unconditionally by `mayAutoResolve()` today, because
 *     `MoneyAmount` carries no exponent and `Money` does (§5.3, G66/G112 ruled
 *     and not applied). A fixture with a ceiling could never reach `permitted`,
 *     so the permitted case would not exist and every negative control would
 *     pass against a gate that refuses everything. **When G66 lands, this null
 *     should become a real ceiling and the money tests should change with it.**
 *   · two actions, not eight, so an action the envelope omits is available to
 *     test against.
 *
 * ⚠️ NOT A PRODUCT POSITION, exactly as `PLACEHOLDER_POLICY_DEFAULTS` is not.
 * No tenant has agreed to autonomous execution of anything.
 */
export const narrowLiveAutonomy: AutonomyConfig = {
  maxAutoResolveSeverity: SEVERITIES.low,
  autonomousIn: { kind: 'these', values: [DOMAIN_KEYS.finance] },
  autoResolveValueCeiling: null,
  permittedActions: ['propose_resolution', 'execute_resolution'],
  /* Refusing to execute is not refusing to speak. G129's fallback — until the
   * gate is CALLED, a learned rule may only propose — is only meaningful if
   * proposing stays open. */
  mayProposeBeyondLimits: true,
}

/* ---------------- 3b. ManagedServiceUseConfig — the permitting arm ---- */

/**
 * A `ManagedServiceUseConfig` that PERMITS something.
 *
 * `PLACEHOLDER_POLICY_DEFAULTS.managed_service_use` above denies by
 * construction and is the fixture that matters most — but a resolver tested
 * only against a config that refuses everything cannot distinguish "the control
 * works" from "the control refuses everything". This is the other arm, and it
 * exists for the reason `narrowLiveAutonomy` does (§5.10): a config nothing
 * constructs is a config no compiler has ever checked a field of.
 *
 * ⚠️ **THE FEATURE NAME IS DELIBERATELY SYNTHETIC AND MUST STAY SO.** The
 * comment on the placeholder above refuses to name Textract's `AnalyzeDocument`
 * and `DetectDocumentText` on the ground that *"naming them HERE would make a
 * fixture read as a provisioning decision, and G79 provisions nothing"*. That
 * argument applies to this fixture with more force, not less, because this one
 * says yes. `example_extract_text` is a placeholder string chosen so that a
 * grep for a Textract feature name never lands in a fixture.
 *
 * The three numbers are chosen to leave ROOM on each axis, so a test that wants
 * a boundary has to ask for it rather than getting one by accident:
 *   · `personal` sits one below `sensitive_personal`, so both "at the ceiling"
 *     and "above the ceiling" are expressible against it.
 *   · `7` is a plain non-zero window, so "equal to", "under" and "over" are all
 *     reachable — and so that a resolver which only ever sees `0` is not
 *     mistaken for one that compares.
 *
 * ⚠️ NOT A PRODUCT POSITION, exactly as `PLACEHOLDER_POLICY_DEFAULTS` is not.
 * No tenant has agreed to hand `personal` data to any managed service, and no
 * provider's retention window has been verified against any number here. G8's
 * attestation is the mechanism that would check the second, and G8 is recorded
 * "not applied".
 */
export const permittedManagedServiceUse: ManagedServiceUseConfig = {
  allowedFeatures: ['example_extract_text'],
  /* Pass F, the decided residency region — transcribed, not chosen, exactly as
   * on the two `allowedRegions` above. One entry, so "outside the list" is a
   * one-word change in a test rather than a rewrite. */
  allowedRegions: ['ap-southeast-1'],
  maxDataClassToService: DATA_CLASSES.personal,
  maxProviderRetentionDays: 7,
}

/* ---------------- 4. FieldSpec.confidenceFloor — both arms -------- */

/**
 * G38's field, constructed — and constructed as the PAIR its own comment
 * argues for.
 *
 * *"IT LIVES HERE, ON `FieldSpec`, AND NOT ON `DocumentType`, because the
 * floor is per-field: a total on an invoice and a free-text description
 * do not deserve the same threshold, and a single per-document number is
 * the shape that forces one of them to be wrong."*
 *
 * So the fixture is a total and a description. A per-document floor
 * cannot express this pair, which is the argument made as data rather
 * than as prose.
 *
 * ⚠️ THE SURFACE HALF OF G38 IS STILL NOT BUILT. Read-only rendering is
 * a screen and there is no screen; the enforcement is that no v1 write
 * operation accepts this field, and no v1 write operation exists either.
 * This fixture witnesses the model half only.
 */
export const invoiceFieldSpecs: FieldSpec[] = [
  {
    path: fixturePath('header', 'total_amount'),
    label: 'Invoice total',
    dataType: 'money',
    required: true,
    dataClass: DATA_CLASSES.internal,
    /* A total is a number that posts to a ledger. */
    modelProcessingAllowed: true,
    /* High, because a misread total is the failure that reaches the
     * general ledger. The number itself is illustrative. */
    confidenceFloor: 0.95,
  },
  {
    path: fixturePath('header', 'description'),
    label: 'Description',
    dataType: 'string',
    required: false,
    dataClass: DATA_CLASSES.internal,
    modelProcessingAllowed: true,
    /* NULL IS A REAL ARM, not an omission: *"Null means the pack's
     * archetype default applies."* Holding a description to the total's
     * threshold is what turns capture into a second inbox — the failure
     * `Close.dc.html` band D exists to refuse. */
    confidenceFloor: null,
  },
]

/* ---------------- 5. The operator-proposal path ------------------- */

/**
 * G42's motivating scenario, constructed end to end: an operator asks
 * whether it is safe to post a production order, the agent reads the ERP
 * live over the connection that would carry the write, and proposes.
 *
 * This is the fixture that witnesses the most, because the whole path
 * landed on 7 Aug with no value anywhere: `EndpointReading`,
 * `ProposedTransaction`, `OperatorProposal` and
 * `OperatorProposalDecision`, plus G44's structural boundary — the
 * proposal carries NO `exceptionId` field at all, so the absence is
 * witnessed here by a complete object literal that never had one to omit.
 *
 * ⚠️ TWO PROPOSALS, ONE ASK, AND BOTH OPEN CONSEQUENCES OF G43 ARE
 * VISIBLE IN THE DATA BELOW RATHER THAN DESCRIBED. Neither is fixed and
 * this fixture must not be read as fixing either.
 */
const sapEndpoint = 'ep_sap_prod' as EndpointId

export const inventoryReading: EndpointReading = {
  tenantId: tenant,
  id: 'erd_inv_sku_4471' as EndpointReadingId,
  /* ⚠️ The same endpoint the write below targets — which is the point of
   * the feature. The model cannot enforce the identity: nothing compares
   * this to `ProposedTransaction.endpointId`, so a reading from a stale
   * replica supporting a write to the live ledger stays representable. */
  endpointId: sapEndpoint,
  /* Typed as the literal, not as `ToolKey`, so a second read path is a
   * compile error rather than a convention. */
  tool: TOOL_KEYS.endpointRead,
  label: 'On-hand quantity · SKU 4471 · plant SG01',
  /* A STRING, because the model does not know SAP's types and must not
   * pretend to. Compare `Delta`, which is structured because our engine
   * produced it; this did not. */
  value: '1,240 EA',
  readAt: '2026-08-08T01:12:04Z',
  /* Invariant 10, the READ half. Non-nullable: reaching a customer's ERP
   * on a credential is never a `system` act with nobody behind it. */
  authorizationId: 'agr_read_4471' as AuthorizationGrantId,
}

/**
 * WHO PROPOSED. The agent arm, carrying the principal it acts for —
 * agent authority is `toolScope ∩ AutonomyConfig ∩ the initiating
 * principal's scope`, and before 5 Aug the third term was not merely
 * unenforced but UNCOMPUTABLE.
 */
const proposingAgent = {
  kind: 'agent',
  stepId: 'pstep_ask_propose' as ProcedureStepId,
  /* A catalogue row, not a provider string — invariant 7. */
  modelId: 'mce_claude_sonnet_5_apac' as ModelCatalogEntryId,
  onBehalfOf: {
    kind: 'user',
    userId: 'usr_ops_mei' as UserId,
    assignmentId: 'asg_ops_sg01',
  },
} as const

/**
 * ⚠️ THE STRUCTURING BYPASS, AS DATA. G43.
 *
 * These two writes are SGD 4,000 each and they came from ONE ask. Both
 * ceilings in the model — `AutonomyConfig.autoResolveValueCeiling` and
 * `AssignmentScope.valueCeiling` — are a single amount compared against
 * a single proposal, and neither has an operand for a total. There is no
 * object representing *"the n proposals emitted from one ask"*, so there
 * is nothing for a total to be computed over. A SGD 8,000 decision
 * passes as two SGD 4,000 ones.
 *
 * The recommended mitigation is a shared correlation id, which would
 * make the split VISIBLE without blocking it. IT IS NOT TAKEN, and its
 * absence is why nothing in these two literals joins them — look for the
 * field that would, and it is not here. `docs/HANDOFF.md` §8 item 9.
 */
const partialProductionOrder: ProposedTransaction = {
  endpointId: sapEndpoint,
  /* ⚠️ VALIDATED AGAINST NOTHING. Unlike `dispositionKey`, which is
   * checked against the pack's `Disposition[]` inside a family the
   * archetype allows, there is no declaration site for operator action
   * keys — which is why `OPERATOR_PROPOSAL_IS_AUTONOMOUSLY_EXECUTABLE`
   * is literal `false` rather than a policy lookup. */
  actionKey: 'production_order.create',
  summary: 'Create production order for 800 EA against available stock',
  value: { currency: 'SGD', amountMinor: 400_000n, exponent: 2 },
}

const shortfallProcurementOrder: ProposedTransaction = {
  endpointId: sapEndpoint,
  actionKey: 'procurement_order.create',
  summary: 'Raise procurement order for the 440 EA shortfall',
  value: { currency: 'SGD', amountMinor: 400_000n, exponent: 2 },
}

const askedAt = '2026-08-08T01:11:50Z'

export const productionOrderProposal: OperatorProposal = {
  tenantId: tenant,
  id: 'oprop_prod_4471' as OperatorProposalId,
  /* Id-shaped deliberately: a field called `askedBy` carrying a branded
   * id is an edge no tool in this repository can see. */
  askedByUserId: 'usr_ops_mei' as UserId,
  /* ⚠️ Tenant-authored free text that reaches a prompt. Not untrusted in
   * the invariant-6 sense — a person with a session asked it — but R2's
   * prompt-assembly framing is still in comments and not in a type. */
  question: 'Can we start the production order for SKU 4471 this week?',
  askedAt,
  /* By reference, not inline: a reading is an ACT with its own
   * authorisation and timestamp, and an act folded into the record it
   * justifies cannot be joined to the audit stream that recorded it. */
  readingIds: [inventoryReading.id],
  proposedBy: proposingAgent,
  rationale:
    'On-hand 1,240 EA covers 800 of the 1,240 EA required; the balance needs procurement.',
  action: partialProductionOrder,
  proposedAt: '2026-08-08T01:12:09Z',
  /* Here from day one rather than as a backfill — E2's lesson. An
   * untagged proposal is OUTSIDE every narrowed assignment, never inside
   * all of them, and that rule lives in SQL rather than in any function
   * here. */
  costCentre: 'FIN-AP',
  legalEntity: 'ACME-SG',
}

export const procurementProposal: OperatorProposal = {
  tenantId: tenant,
  id: 'oprop_proc_4471' as OperatorProposalId,
  askedByUserId: 'usr_ops_mei' as UserId,
  /* THE SAME QUESTION AND THE SAME `askedAt`. That is as close as the
   * model comes to recording that these two proposals are one decision,
   * and it is not a join: nothing indexes it, nothing compares it, and
   * two operators asking the same question a second apart are
   * indistinguishable from one ask producing two proposals. */
  question: 'Can we start the production order for SKU 4471 this week?',
  askedAt,
  readingIds: [inventoryReading.id],
  proposedBy: proposingAgent,
  rationale: 'The 440 EA shortfall must be on order before the build starts.',
  action: shortfallProcurementOrder,
  proposedAt: '2026-08-08T01:12:09Z',
  costCentre: 'FIN-AP',
  legalEntity: 'ACME-SG',
}

/**
 * ⚠️ PARTIAL ACCEPTANCE, AS DATA — G43's second open consequence, and
 * the reason `OperatorProposalDecision` carries the note it does.
 *
 * The production order is accepted. The procurement order for the raw
 * material is refused. Neither decision is wrong on its own, which is
 * exactly why no per-proposal check can catch it, and the business is
 * left in the state the type's own comment names: COMMITTED TO BUILD
 * WITH NO MATERIAL INBOUND — a state nobody chose.
 *
 * It is not prevented because preventing it needs one of two things the
 * decisions rule out: a composite proposal (refused by G43) or a
 * dependency edge between proposals, which is a plan object and a second
 * execution order beside the procedure graph.
 */
export const operatorDecisions: OperatorProposalDecision[] = [
  {
    tenantId: tenant,
    id: 'opdec_prod_4471' as OperatorProposalDecisionId,
    proposalId: productionOrderProposal.id,
    decidedByUserId: 'usr_ctrl_raj' as UserId,
    /* `accepted` authorises the write. It does not record that it
     * happened — there is no execution record on this path. */
    decision: 'accepted',
    reason: null,
    /* Invariant 10, the WRITE half. */
    authorizationId: 'agr_write_prod_4471' as AuthorizationGrantId,
    requestedAt: '2026-08-08T01:12:09Z',
    decidedAt: '2026-08-08T02:40:11Z',
  },
  {
    tenantId: tenant,
    id: 'opdec_proc_4471' as OperatorProposalDecisionId,
    proposalId: procurementProposal.id,
    decidedByUserId: 'usr_ctrl_raj' as UserId,
    decision: 'rejected',
    /* A refusal always states a reason. */
    reason: 'Raise against the Q4 blanket order instead.',
    authorizationId: 'agr_write_proc_4471' as AuthorizationGrantId,
    requestedAt: '2026-08-08T01:12:09Z',
    decidedAt: '2026-08-08T02:41:02Z',
  },
]

/* ---------------- 6. SubjectLocation — the BI copy ---------------- */

/**
 * ⚠️ THIS FIXTURE EXISTS BECAUSE ITS ABSENCE COST AN HOUR ON 8 Aug 2026, AND
 * THE STORY IS THE WHOLE ARGUMENT FOR §5.10.
 *
 * G80a added the `bi_dataset` variant to `SubjectLocation` carrying
 * `region: RegionKey`, with a comment saying it exists because G82 puts the BI
 * layer in Sydney. **`RegionKey` did not admit `'ap-southeast-2'`.** So the
 * variant could not name the region it was created to describe, and `tsc`
 * stayed green through the whole thing — because **nothing in `model/`
 * constructed a `SubjectLocation`**, so the compiler had nothing to check the
 * claim against.
 *
 * It was found by an adversarial review assigning a throwaway value and reading
 * the `TS2820`, not by the build. That is the same defect the fixtures pass
 * landed earlier the same day to prevent, recurring within hours on a type
 * added after it.
 *
 * **The lesson is not "add fixtures eventually".** It is that a type added in
 * the same commit as its fixture cannot have this defect, and a type added
 * without one is unverified no matter how green the run is. Every 🆕 create in
 * `docs/v1-trim-proposal.md` §4 carries this obligation.
 *
 * The values below are illustrative. `materialised: true` is the interesting
 * arm deliberately: a SPICE copy is the one that creates an erasure obligation,
 * and `refreshedAt` is what makes "a copy refreshed BEFORE an erasure request
 * is still a copy" checkable rather than merely stated.
 */
export const acmeBiDatasetLocation: SubjectLocation = {
  kind: 'bi_dataset',
  /* Bare under R1 — AWS mints both of these. */
  datasetId: 'ds_acme_exceptions_v3',
  biAccountId: '481516234253',
  /* ⚠️ NOT the tenant's region. The data plane is ap-southeast-1; G82 puts the
   * BI layer in ap-southeast-2, and SPICE crosses that boundary on every
   * refresh. This single field is the one place in `model/` where that fact is
   * expressible — which is why L7 exists. */
  region: 'ap-southeast-2',
  materialised: true,
  refreshedAt: '2026-08-08T02:00:00Z',
}

/**
 * A grant whose customer HAS been notified — the fixture that witnesses the
 * deadlock clearing.
 *
 * **WHAT THIS IS FOR.** `evaluateTenantAccess()` refuses any grant whose
 * `customerNotifiedAt` is null, and until 8 Aug 2026 nothing could set it,
 * because "service communication" had no definition — so **every support grant
 * failed forever**. `SERVICE_NOTICE_KINDS` closes the definition half. This
 * fixture is the construction site for the other half: it is the first
 * `TenantAccessGrant` value anywhere in `model/`, so it is the first thing that
 * can fail to compile when the shape changes.
 *
 * **`customerNotifiedAt` is set from a `support_grant_issued` notice** — the
 * first of the three kinds that exist precisely to clear this refusal.
 *
 * ⚠️ **WHAT THIS FIXTURE DOES NOT WITNESS, AND THE GAP IS THE POINT.** It does
 * NOT assert that `evaluateTenantAccess()` returns `{ allowed: true }`, because
 * asserting a function's RETURN VALUE needs a test runner and **there is no
 * test framework in this repository**. A fixture witnesses content; only a test
 * witnesses behaviour. Writing that assertion is the first genuinely
 * behavioural test this codebase will have, and it should be written the day a
 * runner exists — before the notice sender, so it fails for the right reason.
 *
 * ⚠️ **And nothing sends the notice.** `sendServiceNotice` exists on no
 * contract, so in a running system this field would still be null. The
 * deadlock is clearable in principle and not yet cleared in practice.
 */
export const notifiedDeliveryGrant: TenantAccessGrant = {
  tenantId: 'ten_acme' as TenantId,
  id: 'tag_2026_0308_acme_delivery' as TenantAccessGrantId,
  purpose: 'delivery',
  staffUserId: 'usr_fde_rmenon' as UserId,
  approvedByStaffUserId: 'usr_dir_delivery' as UserId,
  justification: 'Configure the three-way match sources for the March close.',
  /**
   * `secret` is reachable under a delivery grant since G75, 8 Aug 2026 — the
   * second amendment to invariant 8, taken against the written recommendation.
   * It is here deliberately: this fixture is now also the only place in
   * `model/` where that decision is expressed as a VALUE rather than as a
   * constant, so a future narrowing of `PERMITTED_RESOURCES.delivery` breaks a
   * construction site instead of passing silently.
   */
  resources: [
    { resource: 'configuration', mode: 'write', nominatedSubjectIds: [] },
    { resource: 'secret', mode: 'write', nominatedSubjectIds: [] },
  ],
  grantedAt: '2026-03-02T09:00:00Z',
  expiresAt: '2026-05-31T09:00:00Z',
  engagementRef: 'ENG-2026-0031',
  idleRevokeDays: 14,
  lastUsedAt: '2026-03-08T04:12:00Z',
  extensions: [],
  visibleToTenant: true,
  /** Set from a `support_grant_issued` notice. THE FIELD THIS WHOLE FIXTURE IS ABOUT. */
  customerNotifiedAt: '2026-03-02T09:04:00Z',
  /**
   * Null, and that is correct rather than incomplete: the default posture is
   * `granted_only`, so approval is not required unless the tenant contracted
   * for it. A fixture that filled this in would quietly assert the stricter
   * posture is the normal one.
   */
  customerApprovedAt: null,
  revokedAt: null,
  revokedBy: null,
  revocationReason: null,
}

/* ------------------------------------------------------------------ *
 * IDENTITY CONNECTIONS — the construction site for G231 and G232
 *
 * 🛑 THESE EXIST BECAUSE §5.10 SAYS A GREEN `tsc` OVER A TYPES-ONLY CHANGE
 * PROVES NOTHING. `label` and `DomainClaim` landed on an interface that nothing
 * in this repository constructed, so the compiler could not have failed on a
 * single field chosen. These fixtures are the witness, and they land in the
 * same commit as the fields.
 *
 * ⚠️ THE PAIR SHARES ONE OWNER AND THAT IS THE WHOLE POINT. #220 asked for two
 * `oidc` connections with DIFFERENT owners; a picker could still tell those
 * apart by owner. Acme runs two directories after acquiring a company that was
 * on Google Workspace — the post-acquisition estate `IdentityConnection.owner`
 * calls legitimate in its own docblock. So `protocol` is `oidc` on both,
 * `owner` is identical on both, and `label` is the ENTIRE state a person has to
 * choose by. Do not weaken this to two owners.
 * ------------------------------------------------------------------ */

const acmeAccount = 'acc_acme' as AccountId

/**
 * A proved claim. The digest is a placeholder of the right SHAPE — 64 hex
 * characters, an HMAC-SHA256 output — and is not a real one, because a real one
 * would need a real token and this file may not hold one.
 */
function provedClaim(domain: string, keyRef: string, digest: string): DomainClaim {
  return {
    domain,
    challenge: {
      algorithm: DOMAIN_CHALLENGE_ALGORITHMS.hmacSha256,
      keyRef,
      digest,
    },
    verifiedAt: '2026-06-02T10:14:00Z',
    verificationExpiresAt: '2027-06-02T10:14:00Z',
  }
}

/** The directory Acme has always had. */
export const acmeEntraConnection: IdentityConnection = {
  id: 'idc_acme_entra' as IdentityConnectionId,
  protocol: IDENTITY_PROTOCOLS.oidc,
  /**
   * WRITTEN BY THE FDE WHO CONFIGURED IT, not by Acme and not by any function.
   * It says which door, in the words the people walking through it use.
   */
  label: 'Acme corporate directory',
  owner: { kind: 'customer', accountId: acmeAccount },
  domains: [
    provedClaim(
      'acme.example',
      'kms://reconcile/domain-challenge/idc_acme_entra',
      '4d1f7a2c9b0e6538a71c4d2e8f95b30c6a7e1d4805f2c39b6e0a7d1c4f8b25e3',
    ),
  ],
  /**
   * THE PAIR THE BROKER KNOWS THIS DOOR BY — G304/G305, 19 Sep 2026.
   *
   * Non-null because `PROTOCOL_IS_BROKERED.oidc` is true: under G302 every
   * external directory is reached through our broker, and a brokered door with
   * no handle is one no token can name.
   *
   * ⚠️ BOTH HALVES, ALWAYS. A fixture carrying a bare provider name would be
   * the first place somebody learned that a provider name is an identity. It
   * is not — it is unique within one pool and nowhere else, which is the whole
   * of G304.
   */
  federation: {
    brokerIssuer: 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_EXAMPLEPOOL',
    brokerRef: 'acme-entra',
  },
  status: 'active',
}

/**
 * The directory that arrived with an acquisition. SAME protocol, SAME owner.
 *
 * 🛑 THIS FIXTURE IS THE TEST. Two `oidc` connections under one owner: nothing
 * but `label` separates them, so a picker deriving its line from `protocol`
 * prints one name over both doors — and would print *Microsoft* over this one.
 */
export const acmeGoogleConnection: IdentityConnection = {
  id: 'idc_acme_northwind_google' as IdentityConnectionId,
  protocol: IDENTITY_PROTOCOLS.oidc,
  label: 'Northwind (acquired 2025) — Google Workspace',
  owner: { kind: 'customer', accountId: acmeAccount },
  domains: [
    provedClaim(
      'northwind.example',
      'kms://reconcile/domain-challenge/idc_acme_northwind_google',
      'b83e05c7412d9f6a0e35b8d174c2a96f5031e7b4d8c2905af613e74b2c8d05f9',
    ),
  ],
  /**
   * 🛑 SAME OWNER, SAME PROTOCOL, SAME ISSUER — AND A DIFFERENT `brokerRef`.
   * That is this fixture's second job. Two doors under one owner are two
   * providers in one pool, so the pool's issuer is shared and the reference is
   * what separates them; a reader keying on the issuer alone would collapse
   * these two rows into one, which is the takeover shape
   * `domain_claimed_by_more_than_one_connection` refuses one axis over.
   */
  federation: {
    brokerIssuer: 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_EXAMPLEPOOL',
    brokerRef: 'acme-northwind-google',
  },
  status: 'active',
}

/**
 * The claim that has been STARTED and never proved — the state a
 * `claims.length > 0` guard reads as done.
 *
 * It is a fixture rather than a test-local literal on purpose: the unverified
 * state is the one the model is about, and keeping it beside the proved ones
 * means a future field addition breaks BOTH construction sites, not just the
 * happy one.
 */
export const unprovedPartnerConnection: IdentityConnection = {
  id: 'idc_partner_squatting_on_acme' as IdentityConnectionId,
  protocol: IDENTITY_PROTOCOLS.saml,
  label: 'Meridian Partners (claim unproved)',
  owner: { kind: 'partner', partnerId: 'prt_meridian' as PartnerId },
  domains: [
    {
      domain: 'acme.example',
      challenge: {
        algorithm: DOMAIN_CHALLENGE_ALGORITHMS.hmacSha256,
        keyRef: 'kms://reconcile/domain-challenge/idc_partner_squatting_on_acme',
        digest:
          'f07c31a95e2b6d840c1f7a35b9e02d6c48a1503e7fb92c6d0a45e831b7c2f96d',
      },
      /** Never proved. This is the entire control. */
      verifiedAt: null,
      verificationExpiresAt: null,
    },
  ],
  /**
   * ⚠️ A SQUATTER WITH A PERFECTLY VALID BROKER HANDLE, AND THAT IS THE POINT
   * OF GIVING IT ONE. Federation says WHICH DOOR; it says nothing about whose
   * domain claim is proved and nothing about which organisation the person
   * behind it belongs to. This row is coherently brokered and still refused at
   * routing time, by `domain_not_verified`, on a different axis entirely.
   */
  federation: {
    brokerIssuer: 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_EXAMPLEPOOL',
    brokerRef: 'meridian-partners',
  },
  status: 'active',
}

/**
 * THE PLATFORM'S OWN DOOR — the third owner arm, and the one that had no
 * fixture until #224 [A-3].
 *
 * 🛑 IT EXISTS SO THAT `orgFor()` IS WITNESSED OVER ALL THREE ARMS AND NOT
 * TWO. `ORG_CLASS_FOR_CONNECTION_OWNER` is a total `Record`, and §5.10 is the
 * standing warning about what that buys in a types-only model: *"a total
 * `Record` only bites where something CONSTRUCTS one, and in a types-only
 * model nothing does."* The compiler catches a fourth owner arm; only a
 * fixture catches the third arm being mapped to the wrong class, and until
 * this landed the tree had `customer` twice and `partner` once.
 *
 * ⚠️ NO DOMAIN CLAIM, AND THE ABSENCE IS THE POINT. Staff do not arrive by
 * home-realm routing on a customer's domain — they arrive at the platform
 * realm, and `IdentityConnection.domains`' own note rules what that does and
 * does not buy: *"a realm-URL override may select which connection TRIES … but
 * it never widens: arriving at the platform realm cannot make anyone
 * `platform`, only the platform connection authenticating them can."* An empty
 * claim list is therefore correct rather than unfinished, and a fixture with a
 * claim on some platform domain would invite exactly the widening that
 * sentence forbids.
 *
 * ⚠️ Being platform is not access. Reaching a tenant still requires a
 * `TenantAccessGrant` — see `notifiedDeliveryGrant` above.
 */
export const platformStaffConnection: IdentityConnection = {
  id: 'idc_platform_staff' as IdentityConnectionId,
  protocol: IDENTITY_PROTOCOLS.oidc,
  label: '1CloudHub staff directory',
  owner: { kind: 'platform' },
  domains: [],
  /**
   * ⚠️ THE PLATFORM'S OWN DOOR IS BROKERED TOO, AND NOTHING ABOUT THAT MAKES
   * ANYBODY `platform`. `orgFor(owner)` does that, from the line above. A
   * fixture in which the staff door were the unbrokered one would quietly
   * suggest the broker handle correlates with organisation; it does not, and
   * this is the fixture most likely to be read as though it did.
   */
  federation: {
    brokerIssuer: 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_EXAMPLEPOOL',
    brokerRef: 'onecloudhub-staff',
  },
  status: 'active',
}

/**
 * ⚠️ NOT `seededDefinitions`' shape by accident — a connection is control-plane
 * configuration, not a tenant-scoped template, and this list seeds nothing. It
 * exists so a check over "every connection we ship" has one place to read.
 */
export const seededIdentityConnections: IdentityConnection[] = [
  acmeEntraConnection,
  acmeGoogleConnection,
  unprovedPartnerConnection,
  platformStaffConnection,
]


/* ------------------------------------------------------------------ *
 * The session line — #222 [A-2] and #223 [A-5], 22 Aug 2026
 * ------------------------------------------------------------------ *
 *
 * 🛑 THESE FIXTURES ARE THE ONLY VERIFICATION THIS SLICE HAS THAT IS NOT A
 * COMPILE-TIME SHAPE, and `docs/HANDOFF.md` §5.10 is why they exist:
 * "a total `Record` only bites where something CONSTRUCTS one, and in a
 * types-only model nothing does." `Session` and `SignInAttempt` are eighteen
 * fields between them and `tsc` would stay green with every one of them
 * misdeclared, because nothing else in `model/` builds one. These do.
 *
 * ⚠️ EVERY DIGEST BELOW IS A PLACEHOLDER OF THE RIGHT SHAPE — 64 hex
 * characters, an HMAC-SHA256 output — and is not a real one, for the reason
 * `provedClaim()` above states: a real one would need a real handle and this
 * file may not hold one. The SHAPE is load-bearing anyway, because
 * `tests/model/session-shape.test.ts` asserts it: a fixture carrying a
 * readable handle would be the first place a preimage got written down.
 */

const acmeSessionUser = 'usr_ops_mei' as UserId

/**
 * THE STATE THE ROW EXISTS TO REPRESENT: authenticated, and scoped to nothing.
 *
 * `tenantId` is null, which is the whole reason `Session` is not `TenantScoped`
 * — the RLS predicate over a NULL column denies unconditionally under G100, so
 * a `TenantScoped` session table would hide this row from the connection that
 * just wrote it. A session in this state can reach nothing tenant-scoped.
 */
export const acmeAuthenticatedSession: Session = {
  id: 'ses_acme_mei_unselected' as SessionId,
  handleDigest:
    'a41c8e37b0d5926f4e18a7c30b5d29f6e84a1c73d05b2e69f37a04c81d6b25e9' as SessionHandleDigest,
  userId: acmeSessionUser,
  connectionId: acmeEntraConnection.id,
  tenantId: null,
  /**
   * G180. The pooled platform host, not a vanity one — and a tenant that later
   * takes a vanity host KEEPS this one forever, because a host binding is
   * permanent and additive. A session issued here is refused on any other host.
   */
  issuedHost: 'app.reconcile.invalid',
  authenticatedAt: '2026-08-22T08:40:00Z',
  /**
   * NULL, AND NOTHING MAY EVER SET IT — G223. `tests/model/session-shape.test.ts`
   * sweeps `model/*.ts` for a producer and fails on the first; a fixture that
   * populated this field would be that first producer.
   */
  secondFactorAt: null,
  /** Equal to `authenticatedAt`: establishing the session IS the first use. */
  lastUsedAt: '2026-08-22T08:40:00Z',
  /**
   * `authenticatedAt` plus G220's `maxLifetimeSeconds` — 43200 seconds, twelve
   * hours. Written out rather than computed, because computing it needs the
   * timestamp codec G111's shape calls for and that codec is not started; the
   * arithmetic is stated here so a reader can check it: 08:40 + 12h = 20:40.
   */
  expiresAt: '2026-08-22T20:40:00Z',
  revokedAt: null,
}

/** The same session after selection. One path writes `tenantId`; it is a CHECK, not a chooser — G210. */
export const acmeScopedSession: Session = {
  ...acmeAuthenticatedSession,
  id: 'ses_acme_mei_scoped' as SessionId,
  handleDigest:
    'c72d0b93e18a45f6027c9d31be5a086f4d2c7e10b93a65f8c04d17e2ba936c85' as SessionHandleDigest,
  tenantId: tenant,
  lastUsedAt: '2026-08-22T09:05:00Z',
}

/**
 * Signed out. `revokedAt` is self-service sign-out and nothing else — revoking
 * a person's ACCESS is `User.status` or the assignment.
 *
 * G180's host check writes here too: a request whose Host differs from
 * `issuedHost` is refused AND the session revoked, which is why the field is on
 * the row rather than derived from an absence.
 */
export const acmeRevokedSession: Session = {
  ...acmeScopedSession,
  id: 'ses_acme_mei_revoked' as SessionId,
  handleDigest:
    '5e6b19d02a7c384f9013bd57e2c6a840f71d95b3c082e461a9d73f50c2b81647' as SessionHandleDigest,
  revokedAt: '2026-08-22T09:41:00Z',
}

/**
 * A sign-in in flight: redirected, not yet returned.
 *
 * ⚠️ NO `userId`, and it cannot be given one — before the door answers there is
 * no principal, and a `userId` written at redirect would be a user-existence
 * oracle on an unauthenticated surface.
 */
export const acmePendingSignInAttempt: SignInAttempt = {
  id: 'sia_acme_pending' as SignInAttemptId,
  handleDigest:
    'd0917f4a3c26b85e10d4a72fb639c85017e2d4b60a93c5f81e7204db93a6c518' as SessionHandleDigest,
  /** PINNED AT REDIRECT. The callback may not name another door. */
  connectionId: acmeEntraConnection.id,
  challengeDigest:
    '8b3f05e719d2a64c0357e81bd94a2f60c715d83e02b96a4f7d0c31e58ba27f94' as SessionHandleDigest,
  startedAt: '2026-08-22T08:39:12Z',
  expiresAt: '2026-08-22T08:49:12Z',
  consumedAt: null,
}

/**
 * 🛑 THE REPLAY FIXTURE, AND IT IS VALID IN EVERY OTHER RESPECT ON PURPOSE.
 * Same handle, same door, same challenge — only `consumedAt` differs. That is
 * what makes `tests/model/sign-in-attempt.test.ts`'s negative control sharp:
 * deleting the `consumedAt` check in `consumeSignInAttempt()` makes this
 * attempt fall straight through to `ok: true`, and EXACTLY ONE named test
 * fails. A fixture that differed in two ways would have failed two tests and
 * proved neither.
 */
export const acmeConsumedSignInAttempt: SignInAttempt = {
  ...acmePendingSignInAttempt,
  id: 'sia_acme_consumed' as SignInAttemptId,
  consumedAt: '2026-08-22T08:40:00Z',
}

/**
 * The honest callback: the values the IdP returns for the attempt above.
 *
 * It carries a `connectionId` so that a DISHONEST one is representable — the
 * tests build it by spreading this and swapping the door for
 * `acmeGoogleConnection`, which is the same protocol under the same owner, so
 * nothing but the pinned id distinguishes them.
 */
export const acmeFederatedCallback: FederatedCallback = {
  handleDigest: acmePendingSignInAttempt.handleDigest,
  connectionId: acmePendingSignInAttempt.connectionId,
  challengeDigest: acmePendingSignInAttempt.challengeDigest,
}
