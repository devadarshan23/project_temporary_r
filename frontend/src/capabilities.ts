/**
 * WHAT THIS SESSION MAY DO, FOR DRAWING ONLY — G3522, 3 Oct 2026 (DERIVED, NOT
 * THE OWNER'S). C9 row #22 (*"Admin is a capability, not a person … Setup
 * exists in the nav for an admin only"*) and the owner's G3193 (a refused
 * control is HIDDEN, not drawn and then refused).
 *
 * The list is `getSessionPrincipal.capabilities` (G3521): the plane's own gate
 * asked once per verb. This module reads nothing itself; a surface that holds a
 * `SessionPrincipal` provides its list once, and a control asks `useHolds()`.
 *
 * 🛑 ADVISORY — A HIDDEN CONTROL IS NOT A CHECK. Every operation still gates
 * server-side, and every surface keeps its 403 handling as the backstop: a
 * list read at page load is stale the moment an assignment is revoked, and a
 * client that skipped a request because of this list would be a second,
 * worse evaluator.
 *
 * ⚠️ UNREAD IS NOT HELD. While the principal is unread — or unreadable — the
 * list is `null` and every gated control is HIDDEN. The alternative draws a
 * control for a moment and then removes it, or draws one that refuses, which
 * is the thing G3193 rules out.
 */

import { createContext, useContext } from 'react'

/** The closed vocabulary's members a surface gates a control on. */
export const DRAW_GATES = {
  /** Setup — `configureEndpoint`. The pack's "admin only" door (C9 #22). */
  setup: 'configure_endpoint',
  /** "New reconciliation" — authoring a definition. */
  newReconciliation: 'author_definition',
  /** The approver's queue (C5) — `approveResolution`. */
  approvals: 'approve_resolution',
  /* G3642 — the register's next acts. Accept proposes (and posts, where the
     plane says no further approval is needed); Reopen reverses. */
  acceptLine: 'propose_resolution',
  /** C3-07 — taking a line (`assignException`) is triage too: its holder is an actor. */
  takeLine: 'assign_exception',
  postResolution: 'execute_resolution',
  reopenLine: 'reverse_resolution',
  /* G3781 — C9 rows 13 and 18. Raising a parked delivery with the FDE, and
     declaring the pairing that drains it, are both `configure_endpoint` acts
     (`raiseParkedArrival`, `declareEndpointDocumentType`). Named apart from
     `setup` because they are drawn on TWO surfaces — the register's pile and
     Setup's — and a reader of either should find the verb by the act. */
  raiseParked: 'configure_endpoint',
  declarePairing: 'configure_endpoint',
  /** The staff console's onboarding acts — R8 annotated both `view_substrate`. */
  onboardingAct: 'view_substrate',
  /** The partner portal's three writes. */
  registerDeal: 'register_deal',
  operateSandbox: 'operate_sandbox',
  managePartnerStaff: 'manage_partner_staff',
} as const

export type DrawGate = (typeof DRAW_GATES)[keyof typeof DRAW_GATES]

/** `null` = the principal is unread or unreadable — and nothing gated is drawn. */
export const HeldCapabilities = createContext<readonly string[] | null>(null)

/** Pure, so the rule is testable without a renderer. */
export function holds(held: readonly string[] | null, capability: DrawGate): boolean {
  return held !== null && held.includes(capability)
}

export function useHolds(capability: DrawGate): boolean {
  return holds(useContext(HeldCapabilities), capability)
}
