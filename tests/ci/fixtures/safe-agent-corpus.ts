/**
 * POSITIVE CONTROL FIXTURE for the agent half — an agent that MUST pass.
 *
 * Identical to `unsafe-agent-corpus.ts` with the egress binding removed and
 * nothing else changed. Without it, `reads_untrusted_and_egresses` is proven by
 * a checker that rejects every agent it is shown.
 *
 * The remaining binding is `read_correspondence_thread`, whose effect is
 * `read_tenant` — so `endpointId` must be null. A `reach_endpoint` or `egress`
 * tool requires one and a local tool forbids one; getting that backwards here
 * would raise `endpoint_on_local_tool` and turn this file into a third negative
 * control without anyone noticing.
 */

import { UNSCOPED } from '../../../model/access.ts'
import { AGENT_LIFECYCLE_STATES } from '../../../model/agents.ts'
import { DOMAIN_KEYS } from '../../../model/domain.ts'
import type { AgentDefinition, AgentToolBinding } from '../../../model/agents.ts'
import type {
  AgentDefinitionId,
  ModelCatalogEntryId,
  ProcedureId,
  ProcedureStepId,
  TenantId,
  Timestamp,
  UserId,
} from '../../../model/kernel.ts'

const TENANT_ID = 'ten_fixture' as TenantId
const AGENT_ID = 'agt_fixture_reader' as AgentDefinitionId
const BOUND_BY = 'usr_fixture_author' as UserId
const BOUND_AT = '2026-08-09T00:00:00.000Z' as Timestamp

export const agentDefinitions: AgentDefinition[] = [
  {
    tenantId: TENANT_ID,
    id: AGENT_ID,
    key: 'fixture_reader',
    label: 'Fixture agent that reads and cannot send',
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
    action: 'propose_resolution',
    model: {
      entryId: 'mce_claude_haiku_4_5_apac' as ModelCatalogEntryId,
      sandboxEntryId: null,
      fallbackChainId: null,
    },
    activeHarnessId: null,
    lifecycle: AGENT_LIFECYCLE_STATES.draft,
    createdAt: BOUND_AT,
    retiredAt: null,
  },
]

export const agentToolBindings: AgentToolBinding[] = [
  {
    tenantId: TENANT_ID,
    id: 'atb_fixture_read',
    agentId: AGENT_ID,
    tool: 'read_correspondence_thread',
    endpointId: null,
    scope: UNSCOPED,
    enabled: true,
    boundBy: BOUND_BY,
    boundAt: BOUND_AT,
    expiresAt: null,
  },
]
