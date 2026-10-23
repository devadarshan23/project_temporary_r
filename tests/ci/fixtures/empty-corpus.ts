/**
 * THE VACUITY FIXTURE — a corpus with nothing in it.
 *
 * `docs/HANDOFF.md` §5.6: a checker over an empty set has proven nothing, and
 * the dangerous property is that it is INDISTINGUISHABLE from a checker over a
 * clean set. Both print no findings and both exit 0.
 *
 * This module is what forces the checker to tell those two apart out loud. The
 * tree's own corpus is in exactly this state today — all four packs in
 * `model/examples.ts` carry `procedureTemplates: []`, and nothing anywhere in
 * the tree constructs an `AgentDefinition` — so the distinction is not
 * hypothetical here. It is the current state of the gate.
 */

import type { SolutionPack } from '../../../model/domain.ts'
import type { AgentDefinition, AgentToolBinding } from '../../../model/agents.ts'

export const solutionPacks: SolutionPack[] = []
export const agentDefinitions: AgentDefinition[] = []
export const agentToolBindings: AgentToolBinding[] = []
