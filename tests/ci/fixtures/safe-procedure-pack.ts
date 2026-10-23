/**
 * POSITIVE CONTROL FIXTURE — a pack that MUST pass.
 *
 * Without this, every rejection test is satisfied by a checker that exits 1
 * unconditionally, and "the gate is red" would be indistinguishable from "the
 * gate works".
 *
 * The graph is the same shape as `unsafe-procedure-pack.ts` with the two
 * defects repaired, and only those two:
 *
 *   - the admitting agent carries NO tools, and
 *   - the path from admission to the outbound step passes through a human step
 *     whose `requiredEvidence` includes `'correspondence'`.
 *
 * That second detail is load-bearing and is not decoration. The validator
 * launders a path only through a human who was SHOWN the untrusted text; a
 * human step with empty `requiredEvidence` is a rubber stamp and the rule
 * deliberately does not accept one. A fixture that omitted the evidence would
 * still be rejected, and the positive control would silently become a third
 * negative control.
 */

import { solutionPacks as realPacks } from '../../../model/examples.ts'
import { CONTACT_DUTIES } from '../../../model/domain.ts'
import { CAPABILITIES } from '../../../model/access.ts'
import type {
  ProcedureStep,
  ProcedureTemplate,
  SolutionPack,
} from '../../../model/domain.ts'
import type { ProcedureStepId } from '../../../model/kernel.ts'

const shell = realPacks[0]
if (shell === undefined) {
  throw new Error('model/examples.ts must export at least one SolutionPack')
}

const ADMIT_STEP_ID = 'pstep_admit_reply' as ProcedureStepId
const REVIEW_STEP_ID = 'pstep_operator_reads_the_reply' as ProcedureStepId
const NOTIFY_STEP_ID = 'pstep_tell_the_vendor' as ProcedureStepId

const admitStep: ProcedureStep = {
  kind: 'agent',
  id: ADMIT_STEP_ID,
  label: 'Admit the counterparty reply as evidence',
  action: 'admit',
  toolScope: [],
}

const humanStep: ProcedureStep = {
  kind: 'human',
  id: REVIEW_STEP_ID,
  label: 'An operator reads the reply and chooses to send',
  requires: {
    capability: CAPABILITIES.viewException,
    distinctHolders: 1,
    appliesAtOrAboveValue: null,
  },
  requiredEvidence: ['correspondence'],
}

const notifyStep: ProcedureStep = {
  kind: 'notify',
  id: NOTIFY_STEP_ID,
  label: 'Send the outcome outward',
  templateKey: 'fixture_outcome_notice',
  destination: { kind: 'contact', duty: CONTACT_DUTIES.operations },
}

const safeTemplate: ProcedureTemplate = {
  name: 'Fixture — a human reads the reply before anything leaves',
  version: 1,
  status: 'active',
  archetype: 'n_way_document_match',
  entryStepId: ADMIT_STEP_ID,
  steps: [admitStep, humanStep, notifyStep],
  edges: [
    { from: ADMIT_STEP_ID, to: REVIEW_STEP_ID, when: null },
    { from: REVIEW_STEP_ID, to: NOTIFY_STEP_ID, when: null },
  ],
  defaultEscalationCapability: null,
}

export const solutionPacks: SolutionPack[] = [
  { ...shell, procedureTemplates: [safeTemplate] },
]
