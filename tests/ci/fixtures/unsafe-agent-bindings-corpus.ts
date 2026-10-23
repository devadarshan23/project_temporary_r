/**
 * NEGATIVE CONTROL FIXTURE — the three arms of `validateAgentToolBindings()`
 * that no assertion in this repository has ever exercised.
 *
 * `unsafe-agent-corpus.ts` witnesses `reads_untrusted_and_egresses` and states
 * in its own docblock that it names an endpoint ON PURPOSE so as not to also
 * raise `tool_missing_endpoint` — an author who knew the other arms existed and
 * probed none of them. This file probes them. THREE AGENTS, ONE RULE EACH, so a
 * validator that raises the right count for the wrong reason still fails.
 */

import { UNSCOPED } from '../../../model/access.ts'
import { AGENT_LIFECYCLE_STATES } from '../../../model/agents.ts'
import { DOMAIN_KEYS, TOOL_KEYS } from '../../../model/domain.ts'
import type { AgentDefinition, AgentToolBinding } from '../../../model/agents.ts'
import type {
  AgentDefinitionId, EndpointId, ModelCatalogEntryId,
  ProcedureId, ProcedureStepId, TenantId, Timestamp, UserId,
} from '../../../model/kernel.ts'

const TENANT_ID = 'ten_fixture' as TenantId
const BOUND_BY = 'usr_fixture_author' as UserId
const BOUND_AT = '2026-08-09T00:00:00.000Z' as Timestamp

const ADMIT_ID = 'agt_fixture_admit_holds_tool' as AgentDefinitionId
const NO_ENDPOINT_ID = 'agt_fixture_reach_without_endpoint' as AgentDefinitionId
const LOCAL_ENDPOINT_ID = 'agt_fixture_local_names_endpoint' as AgentDefinitionId

const shell = (
  id: AgentDefinitionId,
  key: string,
  action: AgentDefinition['action'],
): AgentDefinition => ({
  tenantId: TENANT_ID,
  id,
  key,
  label: `Fixture agent ${key}`,
  version: 1,
  provenance: {
    kind: 'pack',
    packId: 'pack_fixture',
    packVersion: 1,
    procedureId: 'proc_fixture' as ProcedureId,
    stepId: 'pstep_fixture' as ProcedureStepId,
    packSignature: null,
  },
  domain: DOMAIN_KEYS.finance,
  action,
  model: {
    entryId: 'mce_claude_haiku_4_5_apac' as ModelCatalogEntryId,
    sandboxEntryId: null,
    fallbackChainId: null,
  },
  activeHarnessId: null,
  lifecycle: AGENT_LIFECYCLE_STATES.draft,
  createdAt: BOUND_AT,
  retiredAt: null,
})

export const agentDefinitions: AgentDefinition[] = [
  shell(ADMIT_ID, 'fixture_admit_holds_tool', 'admit'),
  shell(NO_ENDPOINT_ID, 'fixture_reach_without_endpoint', 'propose_resolution'),
  shell(LOCAL_ENDPOINT_ID, 'fixture_local_names_endpoint', 'propose_resolution'),
]

const binding = (
  id: string,
  agentId: AgentDefinitionId,
  tool: AgentToolBinding['tool'],
  endpointId: EndpointId | null,
): AgentToolBinding => ({
  tenantId: TENANT_ID,
  id,
  agentId,
  tool,
  endpointId,
  scope: UNSCOPED,
  enabled: true,
  boundBy: BOUND_BY,
  boundAt: BOUND_AT,
  expiresAt: null,
})

export const agentToolBindings: AgentToolBinding[] = [
  // `read_document` is `read_tenant`, so ONLY the admit arm fires. Binding
  // `read_correspondence_thread` here would also arm the trifecta rule and the
  // one-rule-per-agent property would be lost.
  binding('atb_fixture_admit', ADMIT_ID, TOOL_KEYS.readDocument, null),
  // `endpoint_read` is `reach_endpoint`; a null endpoint is the whole defect.
  binding('atb_fixture_no_endpoint', NO_ENDPOINT_ID, TOOL_KEYS.endpointRead, null),
  // `compute_tolerance` is `compute`; naming an endpoint on it is the inverse.
  binding('atb_fixture_local_endpoint', LOCAL_ENDPOINT_ID, TOOL_KEYS.computeTolerance,
    'ep_fixture' as EndpointId),
]
