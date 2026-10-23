/**
 * NEGATIVE CONTROL FIXTURE — a pack that MUST be rejected.
 *
 * G110 gives `validateProcedureInjectionSafety()` a call site. A call site that
 * has never rejected anything is a call site nobody can distinguish from a
 * no-op, and `docs/HANDOFF.md` §5.6 names that shape by name. This module is
 * the thing the checker has to say no to.
 *
 * It carries BOTH procedure-level violations at once, deliberately, in ONE
 * template — a checker that reports only the first finding per procedure would
 * pass a test built from two single-violation fixtures.
 *
 *   1. `admitting_agent_carries_tools` — the admit step holds a tool.
 *   2. `untrusted_to_outbound_without_human` — admit reaches `notify` along an
 *      edge with no human step between them.
 *
 * The pack SHELL is `model/examples.ts`'s first real pack, spread and
 * overridden. Nothing about posture, dispositions or rollout is invented here:
 * only `procedureTemplates` is replaced, which is the field under test.
 */

import { solutionPacks as realPacks } from '../../../model/examples.ts'
import { CONTACT_DUTIES } from '../../../model/domain.ts'
import type {
  ProcedureStep,
  ProcedureTemplate,
  SolutionPack,
  ToolKey,
} from '../../../model/domain.ts'
import type { ProcedureStepId } from '../../../model/kernel.ts'

const shell = realPacks[0]
if (shell === undefined) {
  throw new Error('model/examples.ts must export at least one SolutionPack')
}

const ADMIT_STEP_ID = 'pstep_admit_reply' as ProcedureStepId
const NOTIFY_STEP_ID = 'pstep_tell_the_vendor' as ProcedureStepId

/**
 * The admitting agent, holding a tool. `read_correspondence_thread` is a real
 * member of the closed vocabulary in `model/agents.ts` — an invented tool name
 * would not typecheck, which is the point of the vocabulary being closed.
 */
const admitStep: ProcedureStep = {
  kind: 'agent',
  id: ADMIT_STEP_ID,
  label: 'Admit the counterparty reply as evidence',
  action: 'admit',
  toolScope: ['read_correspondence_thread'] satisfies ToolKey[],
}

const notifyStep: ProcedureStep = {
  kind: 'notify',
  id: NOTIFY_STEP_ID,
  label: 'Send the outcome outward',
  templateKey: 'fixture_outcome_notice',
  destination: { kind: 'contact', duty: CONTACT_DUTIES.operations },
}

const unsafeTemplate: ProcedureTemplate = {
  name: 'Fixture — untrusted content straight to an outbound step',
  version: 1,
  status: 'active',
  archetype: 'n_way_document_match',
  entryStepId: ADMIT_STEP_ID,
  steps: [admitStep, notifyStep],
  edges: [{ from: ADMIT_STEP_ID, to: NOTIFY_STEP_ID, when: null }],
  defaultEscalationCapability: null,
}

export const solutionPacks: SolutionPack[] = [
  { ...shell, procedureTemplates: [unsafeTemplate] },
]
