#!/usr/bin/env node
/**
 * check-pack-safety.mjs — G110's CI half. The pack validators' call site.
 *
 * WHY THIS FILE EXISTS. `validateProcedureInjectionSafety()` (model/domain.ts)
 * and `validateAgentToolBindings()` (model/agents.ts) both survive the v1 trim
 * and NEITHER WAS CALLED FROM ANYWHERE. Invariant 6 — ingested content is data,
 * never instruction — therefore had one enforcement running instead of two:
 * `mayNotifyContact()` gates a sink, and nothing at all gated the graph or the
 * tool bindings that reach it. A validator with no call site is a comment.
 *
 * G110 gives them BOTH call sites: this one, now, over the corpus and pinned
 * probes; and a publication seam later, where a pack is signed. THE PUBLICATION
 * SEAM IS NOT BUILT AND IS NOT STARTED — it is blocked on
 * `administration.openapi.yaml`, which does not exist. This file is half of
 * G110 and says so rather than implying otherwise.
 *
 * ⚠️ THE SENTENCE ABOVE IS CORRECTED RATHER THAN DELETED — G4201/G4202,
 * 4 Oct 2026. The seam is STARTED and still NOT BUILT: its REFUSAL LOGIC for
 * document types is `model/publication.ts`'s `admitDocumentTypeDeclaration()`,
 * and this file now calls that module's `validateDocumentTypeTemplates()` too,
 * so the seam's new validator has its CI call site from the commit it landed
 * in. 🛑 WHAT IS STILL EXACTLY TRUE: nothing WRITES a document type, and which
 * operation, capability and principal would is G4204 — put to the owner.
 *
 * ⚠️ WHAT THIS DOES NOT PROVE, STATED FIRST BECAUSE IT IS THE IMPORTANT PART.
 * At the time of writing, the tree's corpus is EMPTY. All four packs in
 * `model/examples.ts` carry `procedureTemplates: []`, and nothing anywhere in
 * the repository constructs an `AgentDefinition`. So on trunk this checker
 * walks four packs and validates zero procedures and zero agents. That is
 * `docs/HANDOFF.md` §5.6 exactly — a checker over an empty set — and the
 * `vacuous` field below exists so the state is reported rather than mistaken
 * for a clean pass. A mandatory witness arm proves every validator rule against
 * pinned safe and unsafe fixtures on every invocation; the TREE is not yet
 * proven by anything, because there is nothing in it to prove.
 *
 * ⚠️ AND A STRUCTURAL NOTE ON THE AGENT HALF. `SolutionPack` has no field that
 * can hold an `AgentDefinition` — an agent is `TenantScoped`, a pack ships
 * document types, definitions, procedures, dispositions and `PackBinding`s.
 * "Validate every pack" can therefore never reach `validateAgentToolBindings()`
 * by walking packs alone, which is why a corpus module may also export
 * `agentDefinitions` and `agentToolBindings` beside `solutionPacks`. Without
 * that, half the gate would be unreachable rather than merely empty, and the
 * difference matters when someone later asks why it never fired.
 *
 * FINDINGS ARE VIOLATIONS ONLY, and any violation EXITS 1. There is no
 * `unmirrored`-style soft finding here, deliberately: `check-wire-mirror.mjs`
 * has one because a surface with no contract yet is a known gap, whereas a pack
 * that assembles the lethal trifecta is not a gap in anything.
 *
 * Usage:
 *   node tools/check-pack-safety.mjs
 *   node tools/check-pack-safety.mjs --corpus tests/ci/fixtures/safe-agent-corpus.ts
 *   node tools/check-pack-safety.mjs --json
 */

import path from 'node:path'
import { readFileSync } from 'node:fs'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { AGENT_VIOLATIONS } from '../model/agents.ts'

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

/**
 * The corpus the gate reads when nobody names one.
 *
 * A single module rather than a directory scan. A scan would silently sweep in
 * `tests/ci/fixtures/`, three of whose modules are DELIBERATELY UNSAFE, and
 * `npm run check` would be permanently red on trunk — the same trap
 * `check-wire-mirror.mjs` documents at `EXCLUDED_DIR_NAMES`.
 */
export const DEFAULT_CORPUS = 'model/examples.ts'

/** The pinned probes stage 4 must reproduce, including positive controls. */
export const PROBES = [
  {
    corpus: 'tests/ci/fixtures/unsafe-procedure-pack.ts',
    expected: [
      'procedure:admitting_agent_carries_tools',
      'procedure:untrusted_to_outbound_without_human',
    ],
  },
  {
    corpus: 'tests/ci/fixtures/unsafe-agent-corpus.ts',
    expected: ['agent:reads_untrusted_and_egresses'],
  },
  {
    corpus: 'tests/ci/fixtures/unsafe-agent-bindings-corpus.ts',
    expected: [
      'agent:admitting_agent_carries_tools',
      'agent:endpoint_on_local_tool',
      'agent:tool_missing_endpoint',
    ],
  },
  /**
   * G206. Every member of `CLASSIFICATION_RULE_VIOLATIONS`, in one probe.
   * `ruleInventory()` derives that vocabulary from `model/ingestion.ts`, so a
   * ninth violation minted without a vector here is a WITNESS FAILURE rather
   * than a quiet gap — the arrangement the other two validators already have.
   */
  {
    corpus: 'tests/ci/fixtures/unsafe-classification-pack.ts',
    expected: [
      'classification:duplicate_signal_set_for_different_types',
      'classification:rule_asserts_nothing',
      'classification:signal_holds_nothing',
      'classification:signal_kind_repeated_in_one_rule',
      'classification:signal_value_extraction_refused',
      'classification:signal_value_not_in_canonical_form',
      'classification:target_cannot_reach_declared_fidelity',
      'classification:target_not_shipped_by_this_pack',
      /* G4202. The fieldless scan this fixture ships to trip G134 at the RULE
       * is G134's refused shape at the TYPE too, so the document-type
       * validator rightly names it as well. Both findings are correct and
       * both are listed: a probe's list is a statement of everything the
       * corpus is, not of the one validator it was written for. */
      'document_type:fieldless_type_crosses_managed_service',
    ],
  },
  /**
   * G4202. Every member of `DOCUMENT_TYPE_DECLARATION_VIOLATIONS`, in one
   * probe — G206's arrangement extended to the publication seam's document-type
   * validator (`model/publication.ts`).
   */
  {
    corpus: 'tests/ci/fixtures/unsafe-document-type-pack.ts',
    expected: [
      'document_type:confidence_floor_not_a_ratio',
      'document_type:field_declared_twice',
      'document_type:fieldless_type_crosses_managed_service',
      'document_type:key_empty',
      'document_type:key_shipped_twice',
      'document_type:vocabulary_unrecognised',
    ],
  },
  { corpus: 'tests/ci/fixtures/safe-procedure-pack.ts', expected: [] },
  { corpus: 'tests/ci/fixtures/safe-agent-corpus.ts', expected: [] },
]

/** The validators, named as the report names them. */
export const PROCEDURE = 'procedure'
export const AGENT = 'agent'
export const CONNECTOR = 'connector'
/**
 * G206, 24 Aug 2026. A pack-declared classification rule is a NEW AUTHORED
 * SURFACE this checker did not know existed — and G206 says so in its own
 * words: a rule that lives only in the ruling table is G110's finding one tier
 * down, "a validator with no call site is a comment".
 *
 * 🛑 IT IS ADDED TO THE `vacuous` VOCABULARY IN THE SAME COMMIT, AND THAT IS
 * THE HALF THAT IS EASY TO SKIP. A validator wired into the loop but absent
 * from the vacuity derivation gives a checker that exits 0 over zero rules
 * while printing a warning naming only the other three — §5.6 reintroduced
 * inside the tool written to report §5.6.
 */
export const CLASSIFICATION = 'classification'
/**
 * G4202, 4 Oct 2026. The publication seam's document-type validator
 * (`validateDocumentTypeTemplates()`, `model/publication.ts`) gets its CI call
 * site in the same commit as its seam — *"a validator with no call site is a
 * comment"* — and joins the `vacuous` vocabulary in the same commit too, for
 * G206's reason stated above.
 */
export const DOCUMENT_TYPE = 'document_type'

const uniqueSorted = (values) => [...new Set(values)].sort()

/** Derive every rule the validators called by this checker can raise. */
export function ruleInventory({ agentsSource, domainSource, ingestionSource, publicationSource } = {}) {
  const agents = agentsSource ?? readFileSync(
    path.join(REPO_ROOT, 'model', 'agents.ts'),
    'utf8',
  )
  const domain = domainSource ?? readFileSync(
    path.join(REPO_ROOT, 'model', 'domain.ts'),
    'utf8',
  )

  const agentStart = agents.indexOf('export function validateAgentToolBindings')
  const agentEnd = agents.indexOf('* 5. Evals', agentStart)
  const agentBody = agentStart >= 0
    ? agents.slice(agentStart, agentEnd >= 0 ? agentEnd : agents.length)
    : agents
  const agentMembers = uniqueSorted(
    [...agentBody.matchAll(/AGENT_VIOLATIONS\.(\w+)/g)].map((match) => match[1]),
  )
  const agent = agentMembers.map((member) => {
    const rule = AGENT_VIOLATIONS[member]
    if (rule === undefined) {
      throw new Error(`AGENT_VIOLATIONS has no member '${member}'`)
    }
    return rule
  }).sort()

  const procedureStart = domain.indexOf('export function validateProcedureInjectionSafety')
  const procedureEnd = domain.indexOf('\nexport ', procedureStart + 10)
  const procedureBody = procedureStart >= 0
    ? domain.slice(procedureStart, procedureEnd >= 0 ? procedureEnd : domain.length)
    : domain
  const procedure = uniqueSorted(
    [...procedureBody.matchAll(/rule:\s*'([a-z_]+)'/g)].map((match) => match[1]),
  )

  const interfaceStart = domain.indexOf('export interface ProcedureViolation')
  const interfaceEnd = domain.indexOf('\n}', interfaceStart)
  const declaredProcedureRules = new Set(
    [...domain.slice(interfaceStart, interfaceEnd).matchAll(/'([a-z_]+)'/g)]
      .map((match) => match[1]),
  )
  for (const rule of procedure) {
    if (!declaredProcedureRules.has(rule)) {
      throw new Error(`ProcedureViolation does not declare rule '${rule}'`)
    }
  }

  /**
   * G206. Read off the `CLASSIFICATION_RULE_VIOLATIONS` const rather than off
   * the validator BODY, which is what the two readers above do.
   *
   * ⚠️ THE DIFFERENCE IS DELIBERATE AND IS THE STRONGER READING HERE. A body
   * scan derives the rules the validator RAISES; the const derives the rules it
   * DECLARES. Those differ in exactly the case worth catching — a member added
   * to the vocabulary and never pushed — and reading the const makes that a
   * witness failure instead of an invisible dead arm.
   */
  const ingestion = ingestionSource ?? readFileSync(
    path.join(REPO_ROOT, 'model', 'ingestion.ts'),
    'utf8',
  )
  const classificationStart = ingestion.indexOf(
    'export const CLASSIFICATION_RULE_VIOLATIONS = {',
  )
  const classificationEnd = ingestion.indexOf('} as const', classificationStart)
  const classification = uniqueSorted(
    [...ingestion
      .slice(classificationStart, classificationEnd)
      .matchAll(/^\s+[A-Za-z][A-Za-z0-9]*:\s*'([a-z_]+)',$/gm)]
      .map((match) => match[1]),
  )

  /** G4202. Read off the const, for the classification reader's reason. */
  const publication = publicationSource ?? readFileSync(
    path.join(REPO_ROOT, 'model', 'publication.ts'),
    'utf8',
  )
  const documentTypeStart = publication.indexOf(
    'export const DOCUMENT_TYPE_DECLARATION_VIOLATIONS = {',
  )
  const documentTypeEnd = publication.indexOf('} as const', documentTypeStart)
  const documentType = documentTypeStart < 0 ? [] : uniqueSorted(
    [...publication
      .slice(documentTypeStart, documentTypeEnd)
      .matchAll(/^\s+[A-Za-z][A-Za-z0-9]*:\s*'([a-z_]+)',$/gm)]
      .map((match) => match[1]),
  )

  if (procedure.length === 0) throw new Error('derived no rules for procedure')
  if (agent.length === 0) throw new Error('derived no rules for agent')
  if (classification.length === 0) throw new Error('derived no rules for classification')
  if (documentType.length === 0) throw new Error('derived no rules for document_type')
  return { procedure, agent, classification, documentType }
}

// ------------------------------------------------------------------ loading

/**
 * A corpus module's three optional exports, defaulted and shape-checked.
 *
 * `undefined` and `[]` are NOT the same thing and are not collapsed: a module
 * that exports no `solutionPacks` at all is a different fact from one that
 * exports an empty array, and reporting them identically is how a typo in an
 * export name becomes a green run. A non-array under a known name is a hard
 * error for the same reason.
 */
function readCorpus(mod, label) {
  const pick = (name) => {
    const value = mod[name]
    if (value === undefined) return []
    if (!Array.isArray(value)) {
      throw new Error(`${label}: export '${name}' must be an array, got ${typeof value}`)
    }
    return value
  }
  return {
    solutionPacks: pick('solutionPacks'),
    agentDefinitions: pick('agentDefinitions'),
    agentToolBindings: pick('agentToolBindings'),
    connectorParameterSets: pick('connectorParameterSets'),
  }
}

// ---------------------------------------------------------------- the check

/**
 * Run both validators over one corpus module.
 *
 * The two validators are imported from `model/` rather than reimplemented. That
 * is the whole point of a call site: reimplementing the rule here would give
 * the model's copy a second chance to be wrong in private.
 */
export async function checkCorpora(corpusPaths) {
  const { validateProcedureInjectionSafety } = await import(
    pathToFileURL(path.join(REPO_ROOT, 'model', 'domain.ts')).href
  )
  const { validateAgentToolBindings } = await import(
    pathToFileURL(path.join(REPO_ROOT, 'model', 'agents.ts')).href
  )
  const { validateConnectorParameters } = await import(
    pathToFileURL(path.join(REPO_ROOT, 'model', 'connectors.ts')).href
  )
  /**
   * G206. `applyExtraction` is imported here and INJECTED, because
   * `validatePackClassificationRules()` takes the extractor as a parameter
   * rather than importing it — `model/reconciliation.ts` already imports
   * `model/domain.ts`, and a value import back would make that cycle real.
   * This call site is where the two are joined, which is the only place that
   * knows both.
   */
  const { validatePackClassificationRules } = await import(
    pathToFileURL(path.join(REPO_ROOT, 'model', 'ingestion.ts')).href
  )
  const { validateDocumentTypeTemplates } = await import(
    pathToFileURL(path.join(REPO_ROOT, 'model', 'publication.ts')).href
  )
  const { applyExtraction } = await import(
    pathToFileURL(path.join(REPO_ROOT, 'model', 'reconciliation.ts')).href
  )

  const findings = []
  let packs = 0
  let proceduresValidated = 0
  let agentsValidated = 0
  let connectorsValidated = 0
  let classificationRulesValidated = 0
  let documentTypesValidated = 0
  const corpora = []

  for (const corpusPath of corpusPaths) {
    const abs = path.isAbsolute(corpusPath)
      ? corpusPath
      : path.join(REPO_ROOT, corpusPath)
    const label = path.relative(REPO_ROOT, abs)
    corpora.push(label)

    const mod = await import(pathToFileURL(abs).href)
    const { solutionPacks, agentDefinitions, agentToolBindings, connectorParameterSets } = readCorpus(mod, label)

    for (const pack of solutionPacks) {
      packs += 1
      /**
       * 🛑 NO ADAPTER OBJECT HERE, UNLIKE THE PROCEDURE LOOP BELOW, AND THAT IS
       * A PROPERTY OF THE VALIDATOR RATHER THAN OF THIS FILE.
       * `validatePackClassificationRules()` takes only the pack's own templates,
       * the pack's own rules and an extractor — no tenant-scoped type and no
       * branded id — so there is nothing to forge. The procedure loop must mint
       * `tenantId: null` into a `Procedure` to call its validator at all, and a
       * CI call site that has to invent a tenant is a call site that can invent
       * the wrong one.
       */
      const documentTypeTemplates = pack.documentTypeTemplates ?? []
      for (const violation of validateDocumentTypeTemplates(documentTypeTemplates)) {
        findings.push({
          validator: DOCUMENT_TYPE,
          rule: violation.rule,
          corpus: label,
          subject: `${pack.key} v${pack.version} · ${violation.documentTypeKey || '(empty key)'}` +
            (violation.fieldIndex === null ? '' : ` · field ${violation.fieldIndex}`),
          detail: violation.detail,
        })
      }
      documentTypesValidated += documentTypeTemplates.length

      const classificationRules = pack.classificationRules ?? []
      for (const violation of validatePackClassificationRules(
        pack.documentTypeTemplates ?? [],
        classificationRules,
        applyExtraction,
      )) {
        findings.push({
          validator: CLASSIFICATION,
          rule: violation.rule,
          corpus: label,
          subject: `${pack.key} v${pack.version} · ${violation.documentTypeKey}` +
            (violation.signalIndex === null ? '' : ` · signal ${violation.signalIndex}`),
          detail: violation.detail,
        })
      }
      classificationRulesValidated += classificationRules.length

      const templates = pack.procedureTemplates ?? []
      for (const [index, template] of templates.entries()) {
        proceduresValidated += 1
        /**
         * `ProcedureTemplate` is `Omit<Procedure, 'id' | 'tenantId' |
         * 'derivedFrom'>`, and the validator's parameter is a `Procedure`. The
         * three missing fields are supplied here as an ADAPTER, not as data:
         * `validateProcedureInjectionSafety()` reads `steps` and `edges` and
         * nothing else, so no value below can change a verdict. They exist to
         * make the shape whole and to give the finding something to name.
         */
        const procedure = {
          ...template,
          id: `${pack.key}#procedureTemplates[${index}]`,
          tenantId: null,
          derivedFrom: null,
        }
        for (const violation of validateProcedureInjectionSafety(procedure)) {
          findings.push({
            validator: PROCEDURE,
            rule: violation.rule,
            corpus: label,
            subject: `${pack.key} v${pack.version} · ${template.name} · step ${violation.stepId}`,
            detail: violation.detail,
          })
        }
      }
    }

    /**
     * Bindings are grouped by agent, and an agent with NO bindings is still
     * validated. Skipping it would be the §5-shaped defect this repository
     * catalogues: keying the check on the convenient landmark (a binding
     * exists) instead of on the property it protects (this agent's tool set is
     * legal) — and the empty tool set is precisely what an `admit` agent is
     * required to have, so the zero-binding case is the one that matters.
     */
    const byAgent = new Map()
    for (const binding of agentToolBindings) {
      const list = byAgent.get(binding.agentId) ?? []
      list.push(binding)
      byAgent.set(binding.agentId, list)
    }
    for (const def of agentDefinitions) {
      agentsValidated += 1
      const bindings = byAgent.get(def.id) ?? []
      for (const violation of validateAgentToolBindings(def, bindings)) {
        findings.push({
          validator: AGENT,
          rule: violation.rule,
          corpus: label,
          subject: `${def.key} v${def.version} · agent ${violation.agentId}`,
          detail: violation.detail,
        })
      }
    }
    for (const set of connectorParameterSets) {
      connectorsValidated += 1
      for (const violation of validateConnectorParameters(set)) {
        findings.push({ validator: CONNECTOR, rule: violation.rule, corpus: label, subject: `${set.declaredBy} · parameter ${violation.parameterName}`, detail: violation.detail })
      }
    }
  }

  /**
   * DERIVED FROM THE COUNTS, never declared beside them. A flag a caller could
   * set independently is a flag that can disagree with the number it describes,
   * and then the §5.6 warning is decorative in exactly the situation it exists
   * for.
   */
  const vacuous = []
  if (proceduresValidated === 0) vacuous.push(PROCEDURE)
  if (agentsValidated === 0) vacuous.push(AGENT)
  if (connectorsValidated === 0) vacuous.push(CONNECTOR)
  if (classificationRulesValidated === 0) vacuous.push(CLASSIFICATION)
  if (documentTypesValidated === 0) vacuous.push(DOCUMENT_TYPE)

  return { corpora, packs, proceduresValidated, agentsValidated, connectorsValidated, classificationRulesValidated, documentTypesValidated, findings, vacuous }
}

/** Exercise the real validators against pinned unsafe and safe probe corpora. */
export async function witnessValidators(probes = PROBES) {
  const inventory = ruleInventory()
  const inventoryKeys = uniqueSorted([
    ...inventory.procedure.map((rule) => `${PROCEDURE}:${rule}`),
    ...inventory.agent.map((rule) => `${AGENT}:${rule}`),
    ...inventory.classification.map((rule) => `${CLASSIFICATION}:${rule}`),
    ...inventory.documentType.map((rule) => `${DOCUMENT_TYPE}:${rule}`),
  ])
  const results = []
  const covered = new Set()

  for (const probe of probes) {
    const result = await checkCorpora([probe.corpus])
    const actual = uniqueSorted(
      result.findings.map((finding) => `${finding.validator}:${finding.rule}`),
    )
    actual.forEach((rule) => covered.add(rule))
    const expected = uniqueSorted(probe.expected)
    const missing = expected.filter((rule) => !actual.includes(rule))
    const unexpected = actual.filter((rule) => !expected.includes(rule))
    results.push({
      corpus: probe.corpus,
      expected,
      actual,
      missing,
      unexpected,
      ok: missing.length === 0 && unexpected.length === 0,
    })
  }

  const coveredRules = uniqueSorted(covered)
  const gaps = inventoryKeys.filter((rule) => !covered.has(rule))
  return {
    probes: results,
    covered: coveredRules,
    gaps,
    ok:
      results.every((probe) => probe.ok) &&
      gaps.length === 0 &&
      coveredRules.length > 0,
  }
}

// ------------------------------------------------------------------ the CLI

function parseArgs(argv) {
  const corpora = []
  let json = false
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--json') {
      json = true
    } else if (arg === '--corpus') {
      const value = argv[i + 1]
      if (value === undefined) throw new Error('--corpus needs a path')
      corpora.push(value)
      i += 1
    } else {
      throw new Error(`unknown argument: ${arg}`)
    }
  }
  return { corpora: corpora.length > 0 ? corpora : [DEFAULT_CORPUS], json }
}

function report(result, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return
  }
  const { corpus, witness } = result
  const lines = []
  // ⚠️ MERGE, 16 Aug 2026 — BOTH SIDES CHANGED THIS BLOCK AND BOTH CHANGES ARE
  //    KEPT. Trunk moved the report's source from a flat `result` to
  //    `result.corpus` and added the witness-coverage line; this branch added
  //    the connectors line. Taking either side alone loses the other: trunk's
  //    alone drops connector reporting, and this branch's alone reads
  //    `result.corpora` on an object that no longer has it — a TypeError, not a
  //    wrong number. The connectors line is re-pointed at `corpus`, which is
  //    where `connectorsValidated` is actually returned (see `return { … }` in
  //    the corpus reader above).
  lines.push(`corpora:               ${corpus.corpora.join(', ')}`)
  lines.push(`packs read:            ${corpus.packs}`)
  lines.push(`procedures validated:  ${corpus.proceduresValidated}`)
  lines.push(`agents validated:      ${corpus.agentsValidated}`)
  lines.push(`connectors validated:  ${corpus.connectorsValidated}`)
  lines.push(`classification rules:  ${corpus.classificationRulesValidated}`)
  lines.push(`document types:        ${corpus.documentTypesValidated}`)
  lines.push(`validator rules witnessed: ${witness.covered.length}`)
  for (const finding of corpus.findings) {
    lines.push('')
    lines.push(`VIOLATION  ${finding.rule}  [${finding.validator}]`)
    lines.push(`  corpus:  ${finding.corpus}`)
    lines.push(`  subject: ${finding.subject}`)
    lines.push(`  detail:  ${finding.detail}`)
  }
  if (corpus.vacuous.length > 0) {
    lines.push('')
    lines.push(
      `⚠️  VACUOUS (${corpus.vacuous.join(', ')}) — this run validated NOTHING for ` +
        'the validators named. A checker over an empty set has proven nothing and is',
    )
    lines.push(
      '    indistinguishable from a checker over a clean set. docs/HANDOFF.md §5.6.',
    )
  }
  if (!witness.ok) {
    const uncovered = uniqueSorted([
      ...witness.gaps,
      ...witness.probes.flatMap((probe) => probe.missing),
    ])
    lines.push('')
    lines.push(`WITNESS FAILURE — uncovered rules: ${uncovered.join(', ') || 'none'}`)
    for (const probe of witness.probes.filter((item) => !item.ok)) {
      lines.push(`  ${probe.corpus}: missing [${probe.missing.join(', ')}], unexpected [${probe.unexpected.join(', ')}]`)
    }
  }
  lines.push('')
  lines.push(
    corpus.findings.length === 0 && witness.ok
      ? 'OK — no pack-safety violations.'
      : `FAIL — ${corpus.findings.length} pack-safety violation(s); witness ok: ${witness.ok}.`,
  )
  process.stdout.write(`${lines.join('\n')}\n`)
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  try {
    const { corpora, json } = parseArgs(process.argv.slice(2))
    const result = {
      corpus: await checkCorpora(corpora),
      witness: await witnessValidators(),
    }
    report(result, json)
    /**
     * 🛑 SET THE CODE; DO NOT CALL `process.exit()`. THIS LINE READ
     * `process.exit(...)` UNTIL 17 Aug 2026 AND IT SAT DIRECTLY BENEATH THE ONE
     * STATEMENT THAT WRITES THE WHOLE REPORT.
     *
     * `report()` above is a single `process.stdout.write()` of every line at
     * once, and this was the very next statement — no event-loop turn between
     * the write and the exit. `process.exit()` terminates immediately, and when
     * stdout is a PIPE (under `npm run`, which is how this checker runs in the
     * gate, and under a CI log collector) anything still queued in userspace is
     * discarded. The exit CODE survives, so a violation still turns the gate
     * red; the VACUOUS warning, the witness failures and the finding list are
     * what go missing, and this checker's whole argument is that a silent pass
     * and an empty corpus are indistinguishable.
     *
     * The long version of the reasoning is at the last statement of
     * `tools/check-citations.mjs`, where the class was first found and measured.
     * `tests/tools/checker-report-flush.test.ts` is the control.
     */
    process.exitCode = result.corpus.findings.length === 0 && result.witness.ok ? 0 : 1
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    // A checker that cannot run is not a checker that passed. Same flush rule as
    // the success arm above: set the code, do not call `process.exit()`. Nothing
    // follows either arm, so the two forms are otherwise identical here.
    process.exitCode = 2
  }
}
