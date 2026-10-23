/**
 * NEGATIVE CONTROL FIXTURE — an agent that MUST be rejected.
 *
 * `validateAgentToolBindings()` is the OTHER half of G110, and it needs its own
 * corpus for a structural reason worth stating plainly: **`SolutionPack` has no
 * field that carries an `AgentDefinition`.** Its eighteen fields carry document
 * types, definitions, procedures, dispositions and per-environment
 * `PackBinding`s, and an agent is none of those — `AgentDefinition` is
 * `TenantScoped`. So "validate every pack in the tree" can never, by type,
 * reach the agent validator. The corpus has to be named separately or that half
 * of the gate is unreachable rather than merely empty.
 *
 * The violation here is `reads_untrusted_and_egresses`: one agent holding
 * `read_correspondence_thread` (untrusted content) and `send_correspondence`
 * (egress). The procedure-level rule cannot see this — there is no path to
 * inspect, because one object holds both legs.
 *
 * The egress binding names an endpoint ON PURPOSE. Leaving `endpointId` null
 * would also raise `tool_missing_endpoint`, and a test asserting "the checker
 * rejected this" would then pass on the wrong rule.
 */

import { UNSCOPED } from '../../../model/access.ts'
import { AGENT_LIFECYCLE_STATES } from '../../../model/agents.ts'
import { DOMAIN_KEYS } from '../../../model/domain.ts'
import type { AgentDefinition, AgentToolBinding } from '../../../model/agents.ts'
import type {
  AgentDefinitionId,
  EndpointId,
  ModelCatalogEntryId,
  ProcedureId,
  ProcedureStepId,
  TenantId,
  Timestamp,
  UserId,
} from '../../../model/kernel.ts'

const TENANT_ID = 'ten_fixture' as TenantId
const AGENT_ID = 'agt_fixture_trifecta' as AgentDefinitionId
const BOUND_BY = 'usr_fixture_author' as UserId
const BOUND_AT = '2026-08-09T00:00:00.000Z' as Timestamp

export const agentDefinitions: AgentDefinition[] = [
  {
    tenantId: TENANT_ID,
    id: AGENT_ID,
    key: 'fixture_trifecta',
    label: 'Fixture agent assembling the trifecta inside one object',
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
  {
    tenantId: TENANT_ID,
    id: 'atb_fixture_send',
    agentId: AGENT_ID,
    tool: 'send_correspondence',
    endpointId: 'ep_fixture_vendor' as EndpointId,
    scope: UNSCOPED,
    enabled: true,
    boundBy: BOUND_BY,
    boundAt: BOUND_AT,
    expiresAt: null,
  },
]
