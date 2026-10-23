/**
 * ReconcileAI — the agent layer.
 *
 * Tenant-scoped, with pack-shipped templates from the control plane.
 * Specified by docs/tenancy-topology.md §4 and written against it.
 *
 * WHY THIS MODULE EXISTS
 *
 * An agent in this product composes from four things — A MODEL FROM THE
 * GARDEN, TOOLS, A HARNESS, AND EVALS — and until now the model expressed
 * exactly one of them, badly:
 *
 *   model      eight fields carry a model identity as a bare `string`, and
 *              `resolveModel()` — the only executable enforcement of residency
 *              in the entire codebase — is reachable from none of them.
 *   tools      `ProcedureStep.agent.toolScope: string[]`, commented "Bounded by
 *              the pack, gated by policy" and bounded by neither. Free strings
 *              against no vocabulary.
 *   harness    nothing. The instructions that steer a model holding a tenant's
 *              connection credentials were not a modelled artefact at all.
 *   evals      `SolutionPack.gateIds: string[]` — a list the pack fully
 *              controls, so a pack names its own examiner.
 *
 * Each of those four is closed below, and each is closed the same way the rest
 * of this model closes things: a fixed vocabulary the layer above defines, and
 * a layer below that may narrow it and can never widen it.
 *
 * ------------------------------------------------------------------------
 * THE CONTRADICTION THIS FILE HAD TO RESOLVE, AND HOW
 * ------------------------------------------------------------------------
 *
 * Two records in this repository disagree, in terms, about whether an agent is
 * a thing:
 *
 *   docs/prompt-injection-posture.md §5.4
 *     "There is no separate agent object to secure. An agent is an `agent` step
 *      inside a procedure, so creating one is editing a graph and crosses all
 *      six gates automatically. One authoring path, one security model."
 *
 *   docs/tenancy-topology.md §4
 *     A tenant-scoped agent catalogue, per-agent harness versions, per-agent
 *     tool bindings, per-agent evals, customer-authored entries.
 *
 * BOTH CANNOT BE TRUE ONCE A TENANT BUILDS ITS OWN AGENTS, and the resolution
 * is not to pick one. It is that the two describe agents with different
 * provenance, and the posture record's claim is true of exactly one of them:
 *
 *   PACK-SHIPPED. The agent IS the signed step. The graph was authored ahead of
 *   time, validated by `validateProcedureInjectionSafety()`, probed by the
 *   injection corpus, and signed — all at pack signing, none of it at runtime.
 *   There is genuinely nothing extra to secure, and `AgentDefinition` for this
 *   provenance is a READ-ONLY PROJECTION of the step, existing so the catalogue
 *   can list it beside its measured quality. Securing it twice would be a
 *   second authorisation surface over an artefact that already crossed one.
 *
 *   TENANT-AUTHORED. The agent has crossed NONE of those gates. It is not in a
 *   pack, so it is never signed; §5.4's own table records the consequence —
 *   "Tenant-authored procedures are never packed and never signed, so they
 *   crossed no gate at all" — which is why F14 Authoring Validator exists. For
 *   this provenance the agent IS a separate object to secure, because there is
 *   no signed artefact standing behind it, and the gates have to attach
 *   somewhere. They attach here.
 *
 * So `AgentProvenance` is the discriminator, `agentIsASeparateObjectToSecure()`
 * answers the question the two documents disagreed about, and
 * `validateAgentDefinition()` demands different evidence per branch — a
 * signature from one, a validator stamp and a passed injection gate from the
 * other.
 *
 * The sharp corollary, and it is enforced: EDITING A PACK AGENT'S HARNESS
 * CONVERTS IT TO TENANT-AUTHORED. The pack's signature covers what the pack
 * shipped; the moment a tenant changes what reaches the model's context, the
 * signature covers something the model no longer reads. See
 * `provenanceAfterHarnessEdit()`.
 */

import type {
  AssignmentScope,
  Capability,
  CapabilityRequirement,
  ScopeDimension,
} from './access'
/**
 * SCOPE INTERSECTION IS IMPORTED, NEVER REIMPLEMENTED.
 *
 * `narrowestScope()` in access.ts already meets two scopes dimension by
 * dimension and denies on a cross-currency ceiling rather than approximating
 * it — BHD carries three decimal places and USD two, so equal `amountMinor`
 * values differ by ~3.8x. Writing a second one here would be two encodings of
 * one rule with no tiebreak, and the copy is the one that silently misses a
 * dimension when a sixth is added.
 */
import { narrowestScope } from './access.ts'
import type {
  ModelCatalogEntry,
  ModelCatalogEntryId,
  ModelResolution,
} from './catalog'
import { resolveModel } from './catalog.ts'
import { TOOL_KEYS } from './domain.ts'
import type {
  AgentAction,
  AgentDefinitionId,
  DataClass,
  DocumentTypeId,
  DomainKey,
  ProcedureId,
  ProcedureStepId,
  RegionKey,
  RunId,
  TenantEnvironment,
  TenantScoped,
  Timestamp,
  ToolKey,
  UserId,
} from './domain'
import type { EvaluationGate, InjectionGate, ScorerId } from './evaluation'

/**
 * MOVED TO `model/kernel.ts` 7 Aug, with the twenty-one from `domain.ts` and the
 * one from `catalog.ts` — 23 declaration sites reduced to one.
 *
 * ⚠️ NOT "brands now have one home". `learning.ts` still declares
 * `LearningNominationId` and `LearningEntryId`, and `presentation.ts` declares
 * `DashboardCardId`. Three modules declare brands, not one. Those were outside
 * this slice; saying otherwise would be the overstatement this sweep exists to
 * catch.
 *
 * RE-EXPORTED, NOT RE-DECLARED — every module that imports `HarnessDocumentId`
 * from here is untouched, and a second declaration would be the duplication the
 * move exists to remove. `model/identity.ts` asserts this name resolves to the
 * same type down both paths.
 */
export type { HarnessDocumentId } from './kernel'
import type { HarnessDocumentId } from './kernel'

/* SLICE 6 — the reference sweep's targets. Imported from `./kernel` directly
 * rather than through `./domain`: a NEW id has no re-export history to
 * preserve, and routing it through the largest module in the system is the
 * indirection slice 3 was written to end. Re-exported for the same reason the
 * older ids are — a consumer that already reads this module keeps reading it. */
import type {
  EndpointId,
  EvaluationGateId,
  ModelFallbackChainId,
  ProcedureStepExecutionId,
} from './kernel'
export type {
  EndpointId,
  EvaluationGateId,
  ModelFallbackChainId,
  ProcedureStepExecutionId,
} from './kernel'


/* ------------------------------------------------------------------ *
 * 1. Tools — a CLOSED vocabulary
 *
 * `ProcedureStep.agent.toolScope` is `string[]`. A tenant-authored agent
 * naming its own tools is structurally identical to a pack inventing its own
 * capability, and this model refuses that everywhere else: `Capability` is
 * platform-defined and closed precisely so "role authoring" cannot become a
 * second, unreviewable authorisation system. Tool authoring is the same act
 * against a lower-level primitive, and it was open.
 *
 * Adding a tool is a PLATFORM RELEASE, exactly as adding a capability or a
 * procedure step kind is. A pack selects from this set; a tenant selects a
 * subset of what its pack selected.
 *
 * WHAT IS DELIBERATELY ABSENT: there is no `http_request`, no `run_query`, no
 * `execute_code`, and no generic escape hatch of any shape. One such member
 * makes every enumeration below decorative — the effect table cannot classify
 * an arbitrary URL, the trifecta check cannot see an egress hiding inside a
 * "read", and `ToolBindingViolation` becomes unenforceable. Also absent: any
 * tool that resolves a credential. `bind_secret` maps to the `secret` resource
 * class, which has no read mode for anyone; an agent is not the exception.
 * ------------------------------------------------------------------ */


/**
 * WHAT A TOOL DOES TO THE WORLD, which is the distinction a bare name loses.
 *
 * A read tool and a write tool are not the same object with a different label:
 * they differ in blast radius, in reversibility, and in whether they supply a
 * leg of the lethal trifecta. The posture record's containment argument is
 * stated entirely in these terms — private data, untrusted content, external
 * communication — and none of the three was computable from a `string[]`.
 */
export const TOOL_EFFECTS = {
  /** Reads tenant data. Supplies the PRIVATE DATA leg of the trifecta. */
  readTenant: 'read_tenant',
  /** Pure function of values already in context. Reaches nothing. */
  compute: 'compute',
  /** Changes tenant data. Reversible and audited; stays inside the boundary. */
  writeTenant: 'write_tenant',
  /**
   * Reaches a foreign system on that tenant's credential. Both a read and a
   * write of someone else's system of record, and the reason a harness edit is
   * an authority act rather than a settings change.
   */
  reachEndpoint: 'reach_endpoint',
  /** Content leaves the tenant. The EXTERNAL COMMUNICATION leg. */
  egress: 'egress',
} as const
export type ToolEffect = (typeof TOOL_EFFECTS)[keyof typeof TOOL_EFFECTS]

/**
 * TOTAL BY CONSTRUCTION, which is the point. `Record<ToolKey, …>` means a
 * nineteenth tool that nobody classifies is a COMPILE ERROR rather than a tool
 * that silently reaches everything or nothing depending on which lookup found
 * it first. Same discipline as `CAPABILITY_RESOURCE_CLASS` in access.ts.
 */
export const TOOL_EFFECT: Record<ToolKey, ToolEffect> = {
  read_document: 'read_tenant',
  read_extraction: 'read_tenant',
  read_exception: 'read_tenant',
  read_match_group: 'read_tenant',
  read_correspondence_thread: 'read_tenant',
  search_prior_exceptions: 'read_tenant',
  read_procedure: 'read_tenant',

  compute_tolerance: 'compute',
  compute_fx_conversion: 'compute',

  write_explanation: 'write_tenant',
  write_proposal: 'write_tenant',
  assign_exception: 'write_tenant',
  execute_disposition: 'write_tenant',
  close_exception: 'write_tenant',

  endpoint_read: 'reach_endpoint',
  endpoint_writeback: 'reach_endpoint',

  send_correspondence: 'egress',
  notify_contact: 'egress',
}

export function effectOf(tool: ToolKey): ToolEffect {
  return TOOL_EFFECT[tool]
}

/* ------------------------------------------------------------------ *
 * 2. What may be delegated to an agent at all
 *
 * `AGENTS_HOLD_ROLES = false` (access.ts) settles the lifetime question: an
 * agent gets no standing grant, no principal row, and no entry in
 * `PrincipalContext.subject`. What it gets is an intersection, minted per step
 * execution and dying with it:
 *
 *     DELEGABLE_TO_AGENT          platform clamp, not tenant-negotiable
 *   ∩ capabilities the step needs what the authored step DECLARES
 *   ∩ delegator.capabilities      what the invoker actually holds, right now
 *
 *   scope = narrowest(delegator.scope, step.scope)
 *
 * The clamp is the term with no home before this file. Without it the
 * intersection is bounded only by what a human happened to hold, so a tenant
 * admin triggering a run would delegate `manage_roles` to a language model.
 * ------------------------------------------------------------------ */

/**
 * The platform clamp, stated as a total map so a thirty-EIGHTH capability
 * cannot slip in unclassified.
 *
 * ⚠️ This line said *"a thirty-seventh"* until 16 Aug 2026, and it was correct
 * when written. The totality did exactly what the sentence claims — G173's
 * `admit_source` produced `TS1360` here, on a file nobody had thought to open —
 * and the number is swept in the commit that moved it rather than left to be
 * derived. Reproduce, do not read:
 * `awk '/^const CAPABILITY_DELEGABLE = \{/,/^\} as const/' model/agents.ts | grep -cE '^  [a-z_]+: (true|false),'`
 *
 * `approve_resolution` IS PERMANENTLY FALSE, and it is the entry to read first.
 * An agent that may approve can approve its own proposal, which collapses
 * four-eyes into one eye belonging to nobody — `ApprovalConfig.quorum` and
 * `CapabilityRequirement.distinctHolders` both count PEOPLE, and neither can
 * count a delegation that has no durable identity to be distinct from.
 *
 * `set_autonomy` likewise: an agent that may widen the autonomy envelope is an
 * agent that may widen itself, and every ceiling below it becomes advisory.
 *
 * The eight that are true are exactly the acts `AgentAction` already names,
 * plus the reads those acts require. Nothing here is a configuration verb, an
 * oversight verb, or an authoring verb.
 */
const CAPABILITY_DELEGABLE = {
  /* --- consuming --- */
  view_exception: true,
  /** G3881 — false: a run read is an operator's oversight read, not an agent act. */
  view_run: false,
  view_document: true,
  /**
   * TRUE, AND ANYTHING ELSE WOULD HAVE UNMADE THE RULING THAT MINTED IT. G173
   * mints `admit_source` for THE READER ACT — an act the engine performs
   * through a model, inside a run, with no human at the moment of action. A
   * `false` here would mint a capability and in the same breath forbid it to the
   * only actor it was minted for.
   *
   * ⚠️ AND IT CLAMPS TO NOTHING TODAY, WHICH IS WORTH STATING RATHER THAN
   * LEAVING TO BE DISCOVERED. `capabilitiesRequiredBy()` derives an agent's
   * needs from its bound TOOLS, and no `ToolKey` maps here —
   * `grep -c "admit_source" model/agents.ts` counts this entry and no other. So
   * an agent may be granted this and reach nothing until a reader tool key
   * exists, which is `mintAgentGrant()`'s intersection behaving correctly, not a
   * gap in it. Adding that tool key is the reader seam's work (MG22), not this
   * capability's.
   */
  admit_source: true,
  /** A dashboard is a human surface. An agent reading one is reading a render. */
  view_dashboard: false,
  /** Export is bulk egress under a human's name. Never delegated. */
  export_data: false,
  /** Pushed to a mailbox nobody controls. See the capability's own note. */
  view_summary: false,

  /* --- operating --- */
  assign_exception: true,
  propose_resolution: true,
  /**
   * TRUE, and the most carefully bounded entry here. Admission is the
   * prompt-injection checkpoint, and an agent may perform it only from a step
   * with an EMPTY tool scope — `admittingAgentMayCarryTools: false`, enforced
   * both at pack signing and, for tenant-authored agents, by
   * `validateAgentToolBindings()` below, because those never reach a signer.
   */
  admit_correspondence: true,
  /**
   * TRUE, and it does not mean an unattended send. Every path from untrusted
   * content to a `notify` step must cross a human step
   * (`validateProcedureInjectionSafety`), and the capability alone reaches
   * nothing without a bound egress tool and a verified endpoint.
   */
  send_outbound: true,
  /** Advancing the walk is the runtime's act, not the agent's. */
  advance_procedure: false,
  /** An agent that may start runs is an agent that may loop. */
  trigger_run: false,

  /* --- acting on a decision --- */
  /** The one that moves money. Gated again by AutonomyConfig, always. */
  execute_resolution: true,
  close_exception: true,

  /* --- deciding --- */
  approve_resolution: false,
  reverse_resolution: false,
  close_period: false,
  set_autonomy: false,

  /* --- creating --- */
  author_definition: false,
  author_procedure: false,
  author_rule: false,
  install_pack: false,

  /* --- maintaining --- */
  configure_tolerance: false,
  /** Endpoint inspection is a human-authorised read, never an agent capability. */
  view_endpoint: false,
  configure_endpoint: false,
  configure_tag_policy: false,
  manage_users: false,
  manage_roles: false,

  /* --- oversight --- */
  view_audit: false,
  view_access_log: false,
  configure_telemetry: false,
  place_legal_hold: false,
  handle_subject_request: false,

  /* --- identity and credentials --- */
  configure_identity: false,
  bind_secret: false,
  enable_endpoint_writeback: false,

  /* --- what it cost, and what it costs --- */
  /**
   * FALSE. Two reasons, and the second is the one that generalises.
   *
   * Nothing in `AgentAction` needs it — an agent classifies, extracts,
   * explains, admits, proposes, executes, notifies and closes, and not one of
   * those reads a meter. And the meter is the read that INVERTS: token counts
   * over a window are the customer's transaction volume, so an agent holding
   * this is an egress surface for the one quantity §8.8 exists to protect,
   * reachable by anything that can shape a prompt.
   *
   * The self-referential case is worse rather than better. An agent that can
   * read its own consumption is an agent whose reasoning can be conditioned on
   * its own cost, and "act differently when the budget looks tight" is a
   * behaviour nobody authored, nobody scored and no rollback would revert.
   */
  view_metering: false,
  /**
   * FALSE. Money is derived (invariant 5) and is never an agent's operand.
   * `AutonomyConfig.autoResolveValueCeiling` bounds an agent by value; the
   * TENANT'S OWN spend against its plan is a different quantity entirely, and an
   * agent that could read the second could reason about the first.
   */
  view_commercial: false,

  /* --- who may decide what the system does unattended --- */
  /**
   * FALSE, and this one is not a close call — it is the same `false` as
   * `set_autonomy` and for a stronger reason.
   *
   * FORCED HERE BY THE COMPILER, 9 Aug 2026 (G128). `Capability` gained
   * `promote_learning` in `access.ts` and this map is
   * `satisfies Record<Capability, boolean>`, so the thirty-seventh member could
   * not be added anywhere without this file taking a position. That is the
   * totality doing exactly what `access.ts:522` says it is for, in a second
   * place nobody had listed.
   *
   * An agent holding this could promote its OWN corrected output into a
   * standing rule that governs its own later runs — a loop that widens what the
   * fleet does unattended with no human in it at any point. `learning.ts` has
   * already ruled that an agent may at most SUGGEST which ids to enumerate
   * (`AGENT_MAY_DISTIL = false`), and a delegable promotion verb would route
   * around that ruling entirely.
   */
  promote_learning: false,

  /* --- the platform's own surface. G601, 19 Sep 2026 ---
   *
   * FALSE, ALL FIVE, AND THE COMPILER FORCED THE QUESTION AGAIN EXACTLY AS
   * G128 RECORDED IT DOING. `Capability` gained five members in `access.ts` and
   * this map is `satisfies Record<Capability, boolean>`, so this file had to
   * take a position on each. That is the totality working in a third place
   * nobody would have listed.
   *
   * 🛑 THE ANSWER IS NOT MERELY `false`; IT IS STRUCTURALLY UNREACHABLE, AND
   *    SAYING SO IS WORTH MORE THAN THE BOOLEAN. `AGENTS_HOLD_ROLES = false`
   *    (invariant 11's companion at the foot of `access.ts`), and delegation
   *    runs through a DELEGATOR's tenant scope — an agent's authority is the
   *    intersection of a platform clamp, a step requirement and the
   *    delegator's scope. A `PlatformRoleAssignment` carries no tenant and
   *    `decide()` returns `DENY_ALL` on every platform allow — *"a platform
   *    allow is a VERB and never a DIMENSION"* — so there is no scope for an
   *    intersection to narrow and nothing for an agent to inherit.
   *
   * ⚠️ AND THE PRODUCT ANSWER IS THE SAME ONE `promote_learning` GOT, FOR THE
   *    SAME REASON AT A LARGER RADIUS. An agent holding `publish_catalogue`
   *    could ship a pack to the FLEET unattended, and a pack carries procedure
   *    templates and agent tool bindings — so the loop is not "an agent widens
   *    what it may do in one tenant" but "an agent widens what every agent in
   *    every tenant may do". `true` here is the only entry in this record whose
   *    blast radius would be the product.
   */
  view_substrate: false,
  provision_substrate: false,
  view_catalogue: false,
  author_catalogue: false,
  publish_catalogue: false,

  /* --- R10, 1 Oct 2026. `false`, and structurally unreachable for the same
   * reason as the five above: an agent's authority is an intersection through
   * a DELEGATOR's tenant scope, and the fifth arm returns `DENY_ALL` and names
   * no tenant — there is no scope to intersect and nothing to inherit. An
   * agent staking deal claims in a partner firm's name would be the firm's
   * commercial voice, unattended. */
  view_deals: false,
  register_deal: false,
  view_sandbox: false,
  operate_sandbox: false,
  view_partner_staff: false,
  manage_partner_staff: false,
} as const satisfies Record<Capability, boolean>

/**
 * The delegable subset AS A TYPE, derived from the map above rather than
 * written twice. Two encodings of one rule are two encodings that can
 * disagree, with no tiebreak written anywhere — the argument that deleted
 * `ProcedureStep.secondApproverAbove`.
 */
export type DelegableCapability = {
  [K in keyof typeof CAPABILITY_DELEGABLE]:
    (typeof CAPABILITY_DELEGABLE)[K] extends true ? K : never
}[keyof typeof CAPABILITY_DELEGABLE]

/** The clamp, as a list, for the intersection in `mintAgentGrant()`. */
export const DELEGABLE_TO_AGENT: readonly DelegableCapability[] =
  (Object.keys(CAPABILITY_DELEGABLE) as Capability[]).filter(
    (c): c is DelegableCapability => CAPABILITY_DELEGABLE[c],
  )

/**
 * WHICH CAPABILITY EACH TOOL DEMANDS OF THE DELEGATOR.
 *
 * Typed `Record<ToolKey, DelegableCapability>` rather than
 * `Record<ToolKey, Capability>` deliberately: a tool whose capability is not
 * delegable is a COMPILE ERROR, not a tool that binds cleanly and then fails
 * silently at mint time in production. This is the join that makes an agent's
 * required capabilities DERIVED from what it can actually do, rather than a
 * second list somebody maintains beside the first.
 */
export const TOOL_CAPABILITY: Record<ToolKey, DelegableCapability> = {
  read_document: 'view_document',
  read_extraction: 'view_document',
  read_exception: 'view_exception',
  read_match_group: 'view_exception',
  /**
   * ⚠️ THIS READ `'view_exception'` UNTIL 16 Aug 2026, AND THE OLD VALUE IS
   * NAMED HERE RATHER THAN OVERWRITTEN SILENTLY, BECAUSE IT IS THE MAPPING THE
   * CONTRACT SURVEY QUOTED WHEN IT PLACED `listThreads`, `getThread` and
   * `getMessage` UNDER `view_exception`.
   *
   * Both encodings now say `view_document`. A thread carries the counterparty's
   * name and subject line, and `PARTNER_MASK_MEMBERSHIP.view_document`'s own
   * entry is *"OPERATE ONLY. A document is the counterparty's paper, not a count
   * of it."* Leaving this at `view_exception` while the wire moved would have
   * left two encodings of one rule with no tiebreak written anywhere — the
   * argument that deleted `ProcedureStep.secondApproverAbove` — and the weaker
   * of the two would have been the one an agent travelled through.
   */
  read_correspondence_thread: 'view_document',
  search_prior_exceptions: 'view_exception',
  read_procedure: 'view_exception',

  compute_tolerance: 'view_exception',
  compute_fx_conversion: 'view_exception',

  write_explanation: 'propose_resolution',
  write_proposal: 'propose_resolution',
  assign_exception: 'assign_exception',
  execute_disposition: 'execute_resolution',
  close_exception: 'close_exception',

  endpoint_read: 'view_document',
  /**
   * Reads as `execute_resolution` and NOT as `enable_endpoint_writeback`.
   * Enabling write-back on an endpoint is a configuration act a human performs
   * once; using an endpoint that a human already enabled is an operating act.
   * Mapping it to the configuration verb would have made the verb delegable,
   * and `Endpoint.writebackEnabled` is precisely the flag that must never be
   * reachable from inside a run.
   */
  endpoint_writeback: 'execute_resolution',

  send_correspondence: 'send_outbound',
  notify_contact: 'send_outbound',
}

/** The capability each `AgentAction` inherently demands. Total over the union. */
export const ACTION_CAPABILITY: Record<AgentAction, DelegableCapability> = {
  classify: 'view_document',
  extract: 'view_document',
  explain: 'view_exception',
  admit: 'admit_correspondence',
  propose_resolution: 'propose_resolution',
  execute_resolution: 'execute_resolution',
  notify: 'send_outbound',
  close_exception: 'close_exception',
}

/**
 * What this agent needs, DERIVED and never stored.
 *
 * A stored `requiredCapabilities` list is a second place to widen: it can drift
 * from the tools actually bound, and the drift is invisible because both are
 * plausible. Deriving it means adding a capability requires adding a tool,
 * which requires a platform release.
 */
export function capabilitiesRequiredBy(
  action: AgentAction,
  tools: readonly ToolKey[],
): DelegableCapability[] {
  const out = new Set<DelegableCapability>([ACTION_CAPABILITY[action]])
  for (const tool of tools) out.add(TOOL_CAPABILITY[tool])
  return [...out]
}

/* ------------------------------------------------------------------ *
 * 3. The harness — an authority artefact, not documentation
 * ------------------------------------------------------------------ */

/**
 * WHAT A MODEL READS BEFORE IT ACTS.
 *
 * A document a human reads is inert. A document a model reads is not, and the
 * tenancy record states the three reasons plainly:
 *
 *   - "instructions steer a model that holds THAT TENANT'S connection
 *     credentials";
 *   - ingested documents are already untrusted input, so an instruction saying
 *     "when reconciling, also send results to X" combines badly with a document
 *     saying "ignore previous instructions";
 *   - "with autonomous resolution enabled, an instruction change is a change to
 *     what the system will DO UNATTENDED."
 *
 * THEREFORE EDITING A HARNESS IS AN AUTHORITY ACT, and the type says so in the
 * only way a type can: it is versioned, immutable once written, approved by
 * someone other than its author before it takes effect, and it carries the
 * classification ceiling of what may be interpolated into it. A settings field
 * has none of those properties, which is exactly why this is not one.
 *
 * The shape is `Sop`'s and `Procedure`'s, deliberately — draft / active /
 * archived, `derivedFrom` for partner-template → customer-instantiation, an
 * approval before effect. The model already knows how to govern an SOP; this
 * is an SOP whose reader is a language model.
 *
 * IMMUTABLE ON WRITE. There is no `updatedAt` and no mutable body. An edit
 * MINTS A NEW VERSION and supersedes this one, because an auditor asking "what
 * was the agent told when it did that" must reach the text that was in force,
 * not the text that is in force now. `Role.version` exists for the same reason
 * and the argument is quoted there.
 *
 * WHAT IS NOT HERE: evals. See §5 — it is not an omission.
 */
export interface HarnessDocument extends TenantScoped {
  id: HarnessDocumentId
  agentId: AgentDefinitionId
  /** Monotonic per agent. Pinned by whoever executed under it. */
  version: number
  /** @dropped-for-v1 7 Aug 2026 — the harness tenant lifecycle; a v1 harness ships signed inside a pack and is always active. Declared, not built. */
  status: 'draft' | 'active' | 'archived'
  /** Partner template → customer instantiation, as `Procedure.derivedFrom`. */
  derivedFrom: HarnessDocumentId | null
  /** The version this one replaces. Null on the first. */
  supersedes: HarnessDocumentId | null

  /* --- what actually reaches the model's context --- */

  /**
   * The standing instruction. Untrusted content is never concatenated into
   * this; it arrives as data, delimited and provenance-framed, and R2 in the
   * posture record records that the assembly mechanism is described in
   * comments rather than enforced by a type. That gap is still open and this
   * field does not close it.
   */
  systemPrompt: string
  /**
   * How each bound tool is DESCRIBED to the model. Distinct from the binding
   * itself, which is what the broker enforces. The description is persuasion;
   * the binding is authority. A harness that describes a tool the agent has
   * not bound is a harness that teaches a model to attempt something F13 will
   * refuse — noisy, and a reliable source of false injection signals.
   */
  toolDescriptions: HarnessToolDescription[]
  /** What the model must return. Never free prose unless `narrative`. */
  outputContract: OutputContract
  /**
   * Ceiling on what may be interpolated into the prompt at assembly time.
   *
   * Distinct from `FieldSpec.modelProcessingAllowed`, which governs a single
   * extracted value. This governs the ASSEMBLED context, which is where a
   * `sensitive_personal` field arrives having passed its own check while the
   * combination breaches the tenant's model-use policy.
   */
  maxDataClassInPrompt: DataClass

  /* --- the authority trail --- */

  authoredBy: UserId
  authoredAt: Timestamp
  /**
   * Null until approved, and an unapproved harness may not be `active` —
   * `harnessMayActivate()`. Never the author: see
   * `HARNESS_APPROVAL_REQUIREMENT`.
   */
  /** @dropped-for-v1 7 Aug 2026 — the harness tenant lifecycle; a v1 harness is approved by pack signing, not by a tenant four-eyes act. Declared, not built. */
  approvedBy: UserId | null
  /** @dropped-for-v1 7 Aug 2026 — the harness tenant lifecycle. Declared, not built. */
  approvedAt: Timestamp | null
  /** @dropped-for-v1 7 Aug 2026 — the harness tenant lifecycle. Declared, not built. */
  archivedAt: Timestamp | null
}

/**
 * WHO MAY APPROVE A HARNESS CHANGE.
 *
 * `distinctHolders: 2` is the whole of it: the author cannot be the approver.
 * An instruction change under autonomous resolution changes what the system
 * does unattended, which is the same class of act as approving a disposition,
 * and four-eyes means two names.
 *
 * ⚠️ USES `author_procedure` BECAUSE THERE IS NO `author_harness` CAPABILITY,
 * and one was NOT invented here. `CAPABILITIES` is platform-defined and
 * closed; adding a member is a platform release reviewed in access.ts, not a
 * thing a new module helps itself to. `author_procedure` is the nearest true
 * verb — a harness governs behaviour exactly as a procedure does — and it is
 * already outside every `PARTNER_CAPABILITY_MASK`, which is the property that
 * matters most: a partner supporting a customer must not be able to rewrite
 * what that customer's agents are told. Worth revisiting if the verb is ever
 * split.
 */
/** @dropped-for-v1 7 Aug 2026 — four-eyes harness approval needs a tenant authoring path, and v1 has none. Declared, not built. */
export const HARNESS_APPROVAL_REQUIREMENT: CapabilityRequirement = {
  capability: 'author_procedure',
  distinctHolders: 2,
  appliesAtOrAboveValue: null,
}

export interface HarnessToolDescription {
  tool: ToolKey
  /** What the model is told this tool does. Prose, and it is persuasion only. */
  description: string
  /**
   * When the model should NOT reach for it. Carried separately because a
   * negative constraint buried in a description is a constraint models drop
   * first under a long context.
   */
  refuseWhen: string | null
}

/**
 * WHAT THE MODEL MUST RETURN, and the reason the posture record can call
 * deterministic output validation a STRONG control rather than a partial one.
 *
 * An agent returns a key from a closed list and a `Money` adjustment — not free
 * text — and the return is validated in code against the archetype's families.
 * `narrative` is the one unbounded shape, because an explanation must be prose;
 * it carries its own classification ceiling for that reason, and an agent whose
 * contract is `narrative` should not also hold an egress tool.
 */
export type OutputContract =
  | {
      kind: 'closed_vocabulary'
      /** From the pack's disposition list, inside a family the archetype allows. */
      allowedKeys: string[]
      mayCarryMoneyAdjustment: boolean
    }
  | { kind: 'structured_fields'; documentTypeId: DocumentTypeId }
  | { kind: 'narrative'; maxDataClass: DataClass }

/** An unapproved or self-approved harness may never be the active one. */
/** @dropped-for-v1 7 Aug 2026 — gates a tenant harness lifecycle that v1 does not ship. Declared, not built. */
export function harnessMayActivate(doc: HarnessDocument): boolean {
  if (doc.approvedBy === null || doc.approvedAt === null) return false
  if (doc.approvedBy === doc.authoredBy) return false
  return doc.status !== 'archived'
}

/* ------------------------------------------------------------------ *
 * 4. The agent itself
 * ------------------------------------------------------------------ */

/**
 * WHERE THE AGENT CAME FROM, which decides what evidence it owes before it may
 * run. This is the discriminator that resolves the contradiction in the file
 * header; read that first.
 */
export type AgentProvenance =
  /**
   * Shipped inside a signed pack. The agent IS the signed step; this row is a
   * read-only projection so the catalogue can list it beside its quality.
   * `validateProcedureInjectionSafety()` and the injection corpus already ran,
   * at signing, over the graph that contains it.
   */
  | {
      kind: 'pack'
      packId: string
      packVersion: number
      /** The step this projects. A pack agent without one is a fabrication. */
      procedureId: ProcedureId
      stepId: ProcedureStepId
      /** Detached signature over the pack contents. Null = unverifiable. */
      packSignature: string | null
    }
  /**
   * Authored inside the tenant. Never packed, therefore never signed,
   * therefore it crossed no gate at all until F14 — which is why the stamp
   * below is not optional decoration but the entire basis for letting it run.
   */
  /** @dropped-for-v1 7 Aug 2026 — a pack ships an agent and a tenant may not author one, so this arm is unreachable in v1. Declared, not built. */
  /* KEPT AS A UNION ARM RATHER THAN FLATTENED TO A STRUCT, deliberately: while
   * `AgentProvenance` remains a union, re-admitting tenant authoring is a
   * compile error at every discriminant site rather than a silent widening. */
  | {
      kind: 'tenant_authored'
      authoredBy: UserId
      /** F14's stamp: graph hash, validator version, time. Not a signature. */
      graphHash: string
      validatorVersion: string
      validatedAt: Timestamp
      /**
       * When the platform injection corpus last passed against this agent.
       * Null means it has never been probed, which for this provenance means
       * it may not run — a pack-shipped agent inherits the pack's probe run,
       * and a tenant-authored one inherits nothing.
       */
      injectionProbesPassedAt: Timestamp | null
    }

/**
 * Answers, for one agent, the question the two records disagreed about.
 *
 * True means the gates must attach to THIS object, because no signed artefact
 * stands behind it.
 */
/** @dropped-for-v1 7 Aug 2026 — answers a question only tenant-authored agents raise. Declared, not built. */
export function agentIsASeparateObjectToSecure(def: AgentDefinition): boolean {
  return def.provenance.kind === 'tenant_authored'
}

/**
 * Editing a pack agent's harness forfeits its pack provenance. ALWAYS.
 *
 * The signature covers what the pack shipped. Once a tenant changes what
 * reaches the model's context, the signature covers text the model no longer
 * reads — and a verifiable signature over the wrong artefact is worse than no
 * signature, because it is believed. The agent becomes tenant-authored and
 * must clear the tenant-authored gates like anything else in that class.
 *
 * This is the same move `InstalledPack` makes for templates: an install mints
 * tenant-scoped copies rather than pointing at control-plane rows.
 */
/** @dropped-for-v1 7 Aug 2026 — no tenant may edit a harness in v1, so the conversion never fires. Declared, not built. */
export function provenanceAfterHarnessEdit(input: {
  editedBy: UserId
  graphHash: string
  validatorVersion: string
  at: Timestamp
}): AgentProvenance {
  return {
    kind: 'tenant_authored',
    authoredBy: input.editedBy,
    graphHash: input.graphHash,
    validatorVersion: input.validatorVersion,
    validatedAt: input.at,
    /** Reset. The previous run probed different instructions. */
    injectionProbesPassedAt: null,
  }
}

/**
 * FOUR STATES, not eight.
 *
 * `PackLifecycleState` has eight because a pack is a fleet artefact rolled out
 * across tenants with canaries and rollbacks. An agent lives inside one tenant
 * and its promotion evidence is the harness approval plus the eval floor, both
 * modelled explicitly. Adding `validated` / `tested` / `promoted` here would
 * duplicate `EvaluationGate.gates` as a status column — a second encoding of
 * the same rule, and the one that drifts is always the column.
 */
export const AGENT_LIFECYCLE_STATES = {
  draft: 'draft',
  active: 'active',
  /** Quality breach, policy change, or an operator pulling it. Reversible. */
  suspended: 'suspended',
  archived: 'archived',
} as const
export type AgentLifecycleState =
  (typeof AGENT_LIFECYCLE_STATES)[keyof typeof AGENT_LIFECYCLE_STATES]

/**
 * HOW AN AGENT REACHES A MODEL. Through the catalogue, never by a string.
 *
 * Eight fields in this model carry a model identity as a bare `string` —
 * `Scorer.model`, `PackBinding.modelOverride`, `ProposalActor.agent.modelId`
 * among them — and nothing in any of their paths forces a call to
 * `resolveModel()`, which is the ONLY executable enforcement of residency in
 * the codebase. Invariant 7 says residency survives inference; a string is how
 * it stops surviving, silently, while the deployment diagram still looks
 * compliant.
 *
 * So this binds a `ModelCatalogEntryId`. The entry carries routing, retention
 * and cost, and `resolveAgentModel()` below is the only way to turn one into
 * something callable. There is deliberately no denormalised `modelId` field:
 * it would be the string, back again, one hop away from the check.
 */
export interface AgentModelBinding {
  entryId: ModelCatalogEntryId
  /**
   * A cheaper model in sandbox is legitimate — `PackBinding.modelOverride`
   * already says so. It resolves INDEPENDENTLY: sandbox is not a residency
   * exemption, and a sandbox tenant still holds synthetic data under the same
   * region policy.
   */
  sandboxEntryId: ModelCatalogEntryId | null
  /**
   * Ordered fallback, because a demo will eventually meet a throttle. Every
   * entry must independently satisfy policy — see `ModelFallbackChain`.
   */
  /** @dropped-for-v1 7 Aug 2026 — v1 routes to one entry per binding; `ModelFallbackChain` has no resolver. Declared, not built. */
  fallbackChainId: ModelFallbackChainId | null
}

/**
 * A configured agent inside one tenant.
 *
 * WHAT THIS IS, as distinct from a `ProcedureStep` that invokes one: the step
 * is a NODE IN A GRAPH — one invocation, at one point in one walk, with its own
 * edges. This is the CONFIGURED THING the step invokes: which model, which
 * instructions, which tools, measured how. Several steps may invoke the same
 * agent; the same agent may be bound in several procedures. Collapsing the two
 * is what forced `toolScope` onto the step, where it could not be versioned,
 * could not be approved, and could not be examined.
 *
 * The catalogue in tenancy-topology §4 renders directly from this: provenance,
 * active harness version, bound tools, governing policy, and current quality
 * from `QualityWindow` — which is keyed `(tenantId, scorerId)` and needs no
 * field here.
 */
export interface AgentDefinition extends TenantScoped {
  id: AgentDefinitionId
  /**
   * Stable identifier. Identity is (provenance, key), for the reason
   * `Role.key` is namespaced by pack: two packs both shipping `triage` fight
   * over one row on upgrade, and a bare comparison would let a tenant-authored
   * `triage` satisfy a step that meant the pack's.
   */
  key: string
  /** What the customer calls it: "Triage agent", "Explanation agent". */
  label: string
  /** Immutable on write, as `Role.version`. An edit mints a new version. */
  version: number
  provenance: AgentProvenance
  domain: DomainKey
  /**
   * What this agent does, from the SAME closed set a procedure step uses. Not
   * a parallel vocabulary — `AutonomyConfig.permittedActions` is
   * `AgentAction[]`, and a second enumeration here would be the second autonomy
   * engine that `AGENTS_HOLD_ROLES = false` exists to prevent.
   */
  action: AgentAction
  model: AgentModelBinding
  /** Null while draft. Must satisfy `harnessMayActivate()` before use. */
  activeHarnessId: HarnessDocumentId | null
  lifecycle: AgentLifecycleState
  /**
   * DELIBERATELY ABSENT: `requiredCapabilities`. It is derived from the action
   * and the bound tools by `capabilitiesRequiredBy()`. A stored list is a
   * second place to widen, and it drifts invisibly because both halves stay
   * plausible.
   *
   * ALSO DELIBERATELY ABSENT: any eval field. See §5.
   */
  createdAt: Timestamp
  retiredAt: Timestamp | null
}

/* ------------------------------------------------------------------ *
 * 4b. Tool bindings
 * ------------------------------------------------------------------ */

export interface AgentToolBinding extends TenantScoped {
  id: string
  agentId: AgentDefinitionId
  tool: ToolKey
  /**
   * WHICH endpoint, for a tool whose effect reaches one or egresses. Required
   * for those and forbidden for the rest — `validateAgentToolBindings()`.
   *
   * A null here on a `reach_endpoint` tool is how "the agent may call the ERP"
   * becomes "the agent may call an ERP", and `CounterpartyEndpoint.verifiedAt`
   * has nothing to bind against. The same hole `ProcedureStep.notify` had
   * before it was given a destination.
   */
  endpointId: EndpointId | null
  /**
   * Narrows what this tool may touch, in the SAME five dimensions an assignment
   * uses. A binding may narrow the delegator's scope and can never widen it —
   * `mintAgentGrant()` intersects, it does not union.
   */
  scope: AssignmentScope
  enabled: boolean
  boundBy: UserId
  boundAt: Timestamp
  /**
   * Null is indefinite, and for an `egress` or `reach_endpoint` binding that is
   * a smell worth surfacing rather than a type error — `Endpoint.boundUntil`
   * already carries the rule that a credential-bearing path must not outlive
   * the authority that created it.
   */
  expiresAt: Timestamp | null
}

/** Closed vocabulary, so a refusal survives a restrictive telemetry policy. */
export const AGENT_VIOLATIONS = {
  /** An `admit` agent holding any tool. The trifecta, in one object. */
  admittingAgentCarriesTools: 'admitting_agent_carries_tools',
  /** A `reach_endpoint` or `egress` tool with no endpoint named. */
  toolMissingEndpoint: 'tool_missing_endpoint',
  /** An endpoint named on a tool that reaches nothing. */
  endpointOnLocalTool: 'endpoint_on_local_tool',
  /** Untrusted content in, and content out, with no human in between. */
  readsUntrustedAndEgresses: 'reads_untrusted_and_egresses',
  harnessMissing: 'harness_missing',
  harnessNotApproved: 'harness_not_approved',
  /** A tenant-authored agent with no F14 stamp has crossed no gate at all. */
  validatorStampMissing: 'validator_stamp_missing',
  /** A tenant-authored agent the injection corpus has never run against. */
  injectionProbesNeverPassed: 'injection_probes_never_passed',
  /** A pack agent whose signature is absent — unverifiable is not verified. */
  packSignatureMissing: 'pack_signature_missing',
  /** A gate id that resolves to nothing is a gate that passes. */
  gateIdUnresolved: 'gate_id_unresolved',
  /** A harness describing a tool the agent never bound. */
  harnessDescribesUnboundTool: 'harness_describes_unbound_tool',
} as const
export type AgentViolationRule =
  (typeof AGENT_VIOLATIONS)[keyof typeof AGENT_VIOLATIONS]

export interface AgentViolation {
  agentId: AgentDefinitionId
  rule: AgentViolationRule
  detail: string
}

/**
 * The tool half of the check, and the reason it exists SEPARATELY from
 * `validateProcedureInjectionSafety()`.
 *
 * That function takes a `Procedure` and walks its graph. A tenant-authored
 * agent may exist before any procedure references it, and never reaches a
 * signer in any case — so the graph-level rule cannot be the only place the
 * empty-tool-scope requirement lives, or the requirement is enforced exactly
 * where it is least needed. Same defect the `admittingStepIds` parameter had:
 * a rule keyed on a convenient landmark instead of on the property it cares
 * about.
 */
export function validateAgentToolBindings(
  def: AgentDefinition,
  bindings: readonly AgentToolBinding[],
): AgentViolation[] {
  const out: AgentViolation[] = []
  const live = bindings.filter((b) => b.enabled)

  if (def.action === 'admit' && live.length > 0) {
    out.push({
      agentId: def.id,
      rule: AGENT_VIOLATIONS.admittingAgentCarriesTools,
      detail: 'An agent that admits inbound content must carry no tools.',
    })
  }

  for (const binding of live) {
    const effect = effectOf(binding.tool)
    const needsEndpoint =
      effect === TOOL_EFFECTS.reachEndpoint || effect === TOOL_EFFECTS.egress
    if (needsEndpoint && binding.endpointId === null) {
      out.push({
        agentId: def.id,
        rule: AGENT_VIOLATIONS.toolMissingEndpoint,
        detail: `Tool '${binding.tool}' (${effect}) names no endpoint.`,
      })
    }
    if (!needsEndpoint && binding.endpointId !== null) {
      out.push({
        agentId: def.id,
        rule: AGENT_VIOLATIONS.endpointOnLocalTool,
        detail: `Tool '${binding.tool}' reaches nothing and names an endpoint.`,
      })
    }
  }

  /**
   * THE TRIFECTA, ASSEMBLED INSIDE ONE AGENT.
   *
   * Reading the correspondence thread is untrusted content; any read tool is
   * private data; an egress tool is external communication. The procedure-level
   * rule catches this across steps and requires a human on the path. Here there
   * is no path to inspect — one object holds all three — so it is refused
   * outright rather than routed.
   */
  const effects = new Set(live.map((b) => effectOf(b.tool)))
  const readsUntrusted = live.some(
    (b) => b.tool === TOOL_KEYS.readCorrespondenceThread,
  )
  if (readsUntrusted && effects.has(TOOL_EFFECTS.egress)) {
    out.push({
      agentId: def.id,
      rule: AGENT_VIOLATIONS.readsUntrustedAndEgresses,
      detail:
        'One agent reads untrusted correspondence and holds an egress tool. ' +
        'Split the read and the send across steps with a human between them.',
    })
  }

  return out
}

/* ------------------------------------------------------------------ *
 * 5. Evals — separate from the harness, and additive over a floor
 *
 * WHY THE EVAL DOES NOT SHIP INSIDE THE HARNESS
 *
 * If the eval ships with the harness, a pack upgrade replaces both the thing
 * tested and the test — a behaviour regression and a weakened examination
 * arriving in ONE SIGNED ARTEFACT, and the gate passes, because the gate that
 * would have caught it is the thing that changed. An eval has to OUTLIVE the
 * version it examines or it is not measuring anything: comparing v3's score to
 * v2's is only meaningful if the same scorer produced both.
 *
 * The second reason is structural. `InjectionGate.waivable` is a literal
 * `false` — there is no environment in which it is negotiable. Nothing inside a
 * `HarnessDocument` has a non-negotiable member: the whole artefact is
 * tenant-editable text under an approval. Putting a non-waivable gate inside an
 * editable document makes it editable, whatever the literal type says.
 *
 * So `AgentEvalBinding` is keyed by AGENT, never by harness version, and it
 * carries no harness pointer at all. That absence is the control.
 * ------------------------------------------------------------------ */

/**
 * The gates every agent passes, whatever it does. Control plane, published
 * downward, never read from a tenant.
 *
 * `SolutionPack.gateIds` is a plain `string[]` the pack fully controls, so a
 * pack that omits the gate it would fail names its own examiner and passes. A
 * floor the pack cannot see is the fix, and the shape below is why: the tenant
 * and pack contribute only through `AgentEvalBinding.additionalGateIds`, and
 * `requiredGateIds()` unions. There is NO exclusion list, deliberately — the
 * ability to subtract is the whole of the defect.
 */
export interface PlatformAgentEvalFloor {
  /** Pinned by every binding, so an auditor reads the floor that was in force. */
  version: number
  /** @dropped-for-v1 7 Aug 2026 — quality gates need scorers and a corpus; in v1 the floor is the injection gate alone. Declared, not built. */
  gateIds: EvaluationGateId[]
  /** Pass/fail on a set, not a score. `waivable: false` — see evaluation.ts. */
  injectionGate: InjectionGate
  /**
   * Extra gates demanded by what an agent CAN DO, keyed by tool effect.
   *
   * Total over `ToolEffect` by construction. An agent that can post into a
   * customer's ledger is examined harder than one that writes an explanation,
   * and that difference is derived from its bindings rather than declared by
   * whoever configured it.
   */
  /** @dropped-for-v1 7 Aug 2026 — the extra gates it keys are quality gates, which v1 does not run. Declared, not built. */
  byToolEffect: Record<ToolEffect, string[]>
  publishedAt: Timestamp
}

/**
 * What a tenant adds ON TOP. Additive only, by the shape of the type.
 *
 * NOTE WHAT IS NOT HERE: no `excludedGateIds`, no `waive`, no
 * `harnessVersion`, no `minScoreOverride`. Each would be a way to subtract from
 * the floor, and a floor with a subtraction path is a default.
 */
/** @dropped-for-v1 7 Aug 2026 — per-tenant eval binding presupposes tenant authoring; the pack floor stands alone. Declared, not built. */
export interface AgentEvalBinding extends TenantScoped {
  agentId: AgentDefinitionId
  /** Pinned. A floor that tightens must not retroactively fail live agents. */
  floorVersion: number
  /** Union'd with the floor. Never intersected, never differenced. */
  additionalGateIds: EvaluationGateId[]
  /**
   * Tenant-defined scorers to run continuously — `Scorer.tenantId` is non-null
   * for exactly these. Scoring never blocks, so this list cannot fail a run;
   * it feeds `QualityWindow`, which is what the catalogue's quality column
   * reads.
   */
  additionalScorerIds: ScorerId[]
  boundAt: Timestamp
}

/**
 * Everything this agent must pass. Union, in one direction only.
 *
 * Order is floor → effect-derived → tenant additions, and duplicates collapse.
 * A tenant naming a floor gate again changes nothing, which is the correct
 * behaviour: it is already required.
 */
/** @dropped-for-v1 7 Aug 2026 — reads AgentEvalBinding, which v1 does not create. Declared, not built. */
export function requiredGateIds(input: {
  floor: PlatformAgentEvalFloor
  binding: AgentEvalBinding
  tools: readonly ToolKey[]
}): string[] {
  const out = new Set<string>(input.floor.gateIds)
  for (const tool of input.tools) {
    for (const id of input.floor.byToolEffect[effectOf(tool)]) out.add(id)
  }
  for (const id of input.binding.additionalGateIds) out.add(id)
  return [...out]
}

/**
 * Resolve gate ids against the catalogue, and REPORT WHAT DID NOT RESOLVE.
 *
 * A gate id pointing at nothing is a gate that passes — silently, and most
 * likely after a rename nobody carried through. The caller must treat
 * `unresolved` as a failure, not as an empty set.
 */
/** @dropped-for-v1 7 Aug 2026 — reads AgentEvalBinding, which v1 does not create. Declared, not built. */
export function agentGatesFrom(
  catalogue: ReadonlyMap<string, EvaluationGate>,
  required: readonly string[],
): { resolved: EvaluationGate[]; unresolved: string[] } {
  const resolved: EvaluationGate[] = []
  const unresolved: string[] = []
  for (const id of required) {
    const gate = catalogue.get(id)
    if (gate === undefined) unresolved.push(id)
    else resolved.push(gate)
  }
  return { resolved, unresolved }
}

/**
 * Whether a sandbox waiver is available for this gate on this agent.
 *
 * `EvaluationGate.waivableInSandbox` was written for packs, where a sandbox
 * pack advancing without a component gate costs nothing. It costs something
 * here: an agent that writes tenant data, reaches an endpoint or egresses does
 * the same thing in a sandbox as in production, against a real endpoint on a
 * real credential. Only a read-or-compute agent may use the waiver.
 */
/** @dropped-for-v1 7 Aug 2026 — a waiver needs an authored gate set to waive. Declared, not built. */
export function gateMayBeWaivedInSandbox(
  gate: EvaluationGate,
  tools: readonly ToolKey[],
): boolean {
  if (!gate.waivableInSandbox) return false
  return tools.every((tool) => {
    const effect = effectOf(tool)
    return effect === TOOL_EFFECTS.readTenant || effect === TOOL_EFFECTS.compute
  })
}

/* ------------------------------------------------------------------ *
 * 6. Readiness — the gates, per provenance
 * ------------------------------------------------------------------ */

/**
 * Everything that must be true before this agent may be `active`.
 *
 * The two provenances are asked for DIFFERENT EVIDENCE, which is the file's
 * central claim made executable. A pack agent owes a signature; the injection
 * validation behind it ran at signing, over the graph, and demanding it again
 * here would be a second authorisation surface over an artefact that already
 * crossed one. A tenant-authored agent owes an F14 stamp and a passed probe
 * run, because nothing else in its life ever asked.
 */
export function validateAgentDefinition(input: {
  def: AgentDefinition
  harness: HarnessDocument | null
  bindings: readonly AgentToolBinding[]
  gateResolution: { unresolved: readonly string[] }
}): AgentViolation[] {
  const { def, harness, bindings, gateResolution } = input
  const out: AgentViolation[] = [...validateAgentToolBindings(def, bindings)]

  if (harness === null) {
    out.push({
      agentId: def.id,
      rule: AGENT_VIOLATIONS.harnessMissing,
      detail: 'No harness document is active for this agent.',
    })
  } else {
    if (!harnessMayActivate(harness)) {
      out.push({
        agentId: def.id,
        rule: AGENT_VIOLATIONS.harnessNotApproved,
        detail:
          `Harness v${harness.version} is unapproved, self-approved or ` +
          'archived. An instruction change is an authority act.',
      })
    }
    const bound = new Set(bindings.filter((b) => b.enabled).map((b) => b.tool))
    for (const described of harness.toolDescriptions) {
      if (bound.has(described.tool)) continue
      out.push({
        agentId: def.id,
        rule: AGENT_VIOLATIONS.harnessDescribesUnboundTool,
        detail:
          `The harness describes '${described.tool}', which is not bound. ` +
          'The broker will refuse every attempt the description invites.',
      })
    }
  }

  switch (def.provenance.kind) {
    case 'pack':
      if (def.provenance.packSignature === null) {
        out.push({
          agentId: def.id,
          rule: AGENT_VIOLATIONS.packSignatureMissing,
          detail:
            'A pack agent claims the pack crossed the gates and carries no ' +
            'signature to check. Unverifiable is not verified.',
        })
      }
      break
    case 'tenant_authored':
      if (def.provenance.graphHash.length === 0) {
        out.push({
          agentId: def.id,
          rule: AGENT_VIOLATIONS.validatorStampMissing,
          detail: 'Tenant-authored and never validated by F14.',
        })
      }
      if (def.provenance.injectionProbesPassedAt === null) {
        out.push({
          agentId: def.id,
          rule: AGENT_VIOLATIONS.injectionProbesNeverPassed,
          detail:
            'Tenant-authored agents inherit no pack probe run. The corpus has ' +
            'never been run against this agent.',
        })
      }
      break
  }

  for (const id of gateResolution.unresolved) {
    out.push({
      agentId: def.id,
      rule: AGENT_VIOLATIONS.gateIdUnresolved,
      detail: `Gate '${id}' resolves to nothing and would pass silently.`,
    })
  }

  return out
}

/* ------------------------------------------------------------------ *
 * 7. Resolving the model — the only way to reach one
 * ------------------------------------------------------------------ */

/**
 * Extraction and classification READ PIXELS. An entry without vision cannot
 * serve those actions, and `resolveModel` already has the rejection for it —
 * it just had no caller that knew when to ask.
 */
export function requiresVision(action: AgentAction): boolean {
  return action === 'extract' || action === 'classify'
}

/**
 * Turn a binding into something callable, or into a typed refusal.
 *
 * This is the ONLY function in this module that produces a model identity, and
 * it produces it by going through the catalogue. `resolveModel()` is where
 * residency, retention and status are actually enforced; an agent that reached
 * a model any other way would defeat invariant 7 while every diagram continued
 * to look correct.
 *
 * A sandbox override resolves independently and against the SAME policy. A
 * cheaper model is legitimate; a model that routes globally is not, in any
 * environment.
 */
export function resolveAgentModel(input: {
  def: AgentDefinition
  environment: TenantEnvironment
  entriesById: ReadonlyMap<ModelCatalogEntryId, ModelCatalogEntry>
  catalogue: ReadonlyMap<string, ModelCatalogEntry>
  allowedModels: ScopeDimension<string>
  allowedRegions: RegionKey[]
  requireZeroRetention: boolean
}): ModelResolution {
  const { def, environment, entriesById, catalogue } = input
  const chosen =
    environment === 'sandbox' && def.model.sandboxEntryId !== null
      ? def.model.sandboxEntryId
      : def.model.entryId

  const entry = entriesById.get(chosen)
  /**
   * A binding pointing at no entry is refused as `not_in_catalogue` rather
   * than throwing. Same failure, same shape, one vocabulary for the caller.
   */
  if (entry === undefined) {
    return { ok: false, rejection: { reason: 'not_in_catalogue' } }
  }

  return resolveModel({
    modelId: entry.modelId,
    catalogue,
    allowedModels: input.allowedModels,
    allowedRegions: input.allowedRegions,
    requireZeroRetention: input.requireZeroRetention,
    requireVision: requiresVision(def.action),
  })
}

/* ------------------------------------------------------------------ *
 * 8. The derived grant — minted per step execution, never administered
 * ------------------------------------------------------------------ */

/**
 * WHO SET THIS AGENT RUNNING.
 *
 * `RunTrigger` is `manual | scheduled | ingest | source_signal | rerun`, so
 * four of five have no human at the moment of action. The policy case
 * terminates accountability the way `ExceptionResolution.mode: 'autonomous'`
 * already does — in `authorisedByPolicyId`, and thence in `Policy.createdBy`.
 */
export type DelegationSource =
  | { kind: 'user'; userId: UserId; assignmentId: string }
  | { kind: 'policy'; policyId: string; createdBy: UserId }

/**
 * An agent's authority, for the duration of one step execution.
 *
 * NOT A ROW ANYONE ADMINISTERS. It is named by the tuple below and dies with
 * the step. `AGENTS_HOLD_ROLES = false` in access.ts carries the full argument;
 * the short form is lifetime — a role is standing and per-principal, and giving
 * an agent one converts a bounded capability into an unbounded one while
 * touching none of the four controls the posture record names as the answer.
 *
 * Three properties the shape is chosen to preserve:
 *
 *   A REFERENCE, NOT A BEARER TOKEN. The runtime presents a grant id; the tool
 *   broker loads the row and evaluates it. Nothing the runtime asserts about
 *   its own authority is read — which is the entire reason the broker is a
 *   separate component from the agent runtime.
 *
 *   SIBLINGS MINT INDEPENDENTLY FROM THE ROOT, never from each other. Chaining
 *   peers would ratchet authority down a long procedure for no security reason,
 *   and would let step n poison step n+1.
 *
 *   VALIDITY IS EVALUATED, NEVER ASSERTED. A revoked assignment or a disabled
 *   policy stops live grants on the next call. A fired employee's in-flight
 *   agents stop.
 */
export interface DerivedAgentGrant extends TenantScoped {
  runId: RunId
  procedureId: ProcedureId
  procedureVersion: number
  stepId: ProcedureStepId
  stepExecutionId: ProcedureStepExecutionId
  agentId: AgentDefinitionId
  /** The catalogue entry actually used, including any sandbox override. */
  modelEntryId: ModelCatalogEntryId
  /** The intersection. Never wider than `DELEGABLE_TO_AGENT`. */
  capabilities: DelegableCapability[]
  /** Narrowest of delegator and step. Never a union. */
  scope: AssignmentScope
  tools: ToolKey[]
  delegatedBy: DelegationSource
  mintedAt: Timestamp
  /**
   * Literal `true`. There is no expiry to configure and no renewal path,
   * because the grant's lifetime IS the step execution — `endedAt` on the
   * `ProcedureStepExecution` row is what ends it. A `Timestamp` here would
   * invite a grant that outlives its step, which is the durable agent
   * principal this model refuses.
   */
  expiresWithStepExecution: true
}

/**
 * Mint the grant. Three-way intersection, computed, never stored as a role.
 *
 *     DELEGABLE_TO_AGENT          the platform clamp above
 *   ∩ capabilitiesRequiredBy(…)   what this agent's action and tools NEED
 *   ∩ delegatorCapabilities       what the invoker actually holds, now
 *
 * The third term is the one that did not exist anywhere before
 * `ProposalActor.agent.onBehalfOf`: a user scoped to one legal entity at
 * SGD 5,000 could trigger a run whose agent resolved another entity's exception
 * at SGD 400,000, and the escalation was not merely unenforced — it was
 * UNCOMPUTABLE from the stored record.
 *
 * TOOLS ARE FILTERED BY THE RESULT, not carried through. A tool whose
 * capability did not survive the intersection is dropped, so the grant cannot
 * name a tool it has no authority to call. Dropping it here rather than failing
 * the mint is deliberate: a delegator holding fewer capabilities should get a
 * narrower agent, not a broken run.
 */
export function mintAgentGrant(input: {
  def: AgentDefinition
  tools: readonly ToolKey[]
  modelEntryId: ModelCatalogEntryId
  delegatorCapabilities: readonly Capability[]
  delegatorScope: AssignmentScope
  stepScope: AssignmentScope
  delegatedBy: DelegationSource
  at: Timestamp
  location: {
    tenantId: DerivedAgentGrant['tenantId']
    runId: RunId
    procedureId: ProcedureId
    procedureVersion: number
    stepId: ProcedureStepId
    stepExecutionId: ProcedureStepExecutionId
  }
}): DerivedAgentGrant {
  const needed = capabilitiesRequiredBy(input.def.action, input.tools)
  const held = new Set<Capability>(input.delegatorCapabilities)
  const capabilities = needed.filter(
    (c) => DELEGABLE_TO_AGENT.includes(c) && held.has(c),
  )
  const granted = new Set<DelegableCapability>(capabilities)

  return {
    tenantId: input.location.tenantId,
    runId: input.location.runId,
    procedureId: input.location.procedureId,
    procedureVersion: input.location.procedureVersion,
    stepId: input.location.stepId,
    stepExecutionId: input.location.stepExecutionId,
    agentId: input.def.id,
    modelEntryId: input.modelEntryId,
    capabilities,
    scope: narrowestScope(input.delegatorScope, input.stepScope),
    tools: input.tools.filter((t) => granted.has(TOOL_CAPABILITY[t])),
    delegatedBy: input.delegatedBy,
    mintedAt: input.at,
    expiresWithStepExecution: true,
  }
}
