/**
 * THE WORDS A PERSON READS FOR THE PLANE'S CLOSED VOCABULARIES — the run
 * account, the finding and the resolution chain (RC-08, RC-09, 3 Oct 2026).
 *
 * The plane speaks in closed enums (`not_declared_by_format`,
 * `pending_approval`, `approved_pending_second_approver`). The pack never
 * prints one: it prints a word. Every map here is TOTAL over the enum it
 * names, so a member the contract adds and this file does not is a compile
 * error at the map rather than a raw token on a screen.
 *
 * ⚠️ THE MAPS KEYED ON A WIRE `string` (a `kind` the client types as `string`)
 * cannot be total, so they go through `labelOf()`, whose fallback is a
 * sentence-cased rendering of the token — never the raw `snake_case`, and
 * never an invented meaning. The raw token stays on the element as a `data-`
 * attribute, which is where a test or a support person reads it.
 */

import type { ExceptionStatus, RunStatus, Severity } from '../../model/domain.ts'
import type { OrgClass } from './api/principal.ts'

/** `not_declared_by_format` → `Not declared by format`. The fallback, and nothing more. */
export function sentenceOf(token: string): string {
  const spaced = token.replace(/_/g, ' ').trim()
  return spaced.length === 0 ? token : `${spaced[0]?.toUpperCase() ?? ''}${spaced.slice(1)}`
}

/** A word from a map keyed on a wire string, with the sentence-cased token as the fallback. */
export function labelOf(map: Readonly<Record<string, string>>, token: string): string {
  return map[token] ?? sentenceOf(token)
}

export const RUN_STATUS_WORD: Readonly<Record<RunStatus, string>> = {
  queued: 'Queued',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  incomplete: 'Incomplete',
  /* G4033 — the engine refused the definition; `getRunAccount` says why. */
  refused: 'Refused',
}

export const TRIGGER_WORD: Readonly<Record<string, string>> = {
  manual: 'Started by hand',
  scheduled: 'On schedule',
  ingest: 'When documents arrived',
  source_signal: 'When a source signalled',
  rerun: 'Re-run',
}

export const SIDE_WORD: Readonly<Record<string, string>> = {
  left: 'Left',
  right: 'Right',
}

export const TRAILER_WORD: Readonly<Record<string, string>> = {
  declared: 'Declared',
  not_declared_by_format: 'None in this format',
  expected_but_absent: 'Missing',
}

export const VERDICT_WORD: Readonly<Record<string, string>> = {
  nothing_to_check: 'Nothing to check',
  agreed: 'Agrees',
  reported: 'Disagrees',
  not_evaluated_address_collision: 'Not checked',
}

export const RESIDUE_CAUSE_WORD: Readonly<Record<string, string>> = {
  no_strategy_paired: 'No rule paired it',
  identifier_ambiguous: 'Reference matched more than one line',
  admission_refused: 'Could not be read in',
  cash_exceeded_obligations: 'Payment exceeds what was owed',
  obligation_not_fully_settled: 'Not fully paid',
  counterparty_unattributed: 'No counterparty',
  bucket_exceeded_bound: 'Too many candidates to compare',
  search_budget_exhausted: 'Search stopped at its limit',
  reader_refused: 'The reader declined',
  reader_found_no_candidate: 'No candidate found',
  control_total_unverified: 'File total not verified',
  read_held_below_floor: 'Held for confirmation',
  amount_tolerance_declined: 'Outside the amount tolerance',
}

export const RESIDUE_DISPOSITION_WORD: Readonly<Record<string, string>> = {
  unidentified: 'Unidentified',
  error_left: 'Left side in error',
  error_right: 'Right side in error',
}

export const POSTCONDITION_WORD: Readonly<Record<string, string>> = {
  open_item_missing_from_residue: 'An open line is missing from the residue',
  item_in_residue_twice: 'A line appears in the residue twice',
  fully_allocated_item_in_residue: 'A fully matched line is still in the residue',
  negative_residual: 'A residual went below zero',
  gross_not_partitioned: 'The gross does not add up across groups',
  population_integrity_reported: 'A file disagreed with its own trailer',
  population_wholly_refused: 'Every line was refused',
}

export const TERMINAL_STATUS_WORD: Readonly<Record<string, string>> = {
  completed: 'Completed',
  failed: 'Failed',
  incomplete: 'Incomplete',
}

export const EXCEPTION_STATUS_WORD: Readonly<Record<ExceptionStatus, string>> = {
  open: 'Open',
  investigating: 'Investigating',
  resolution_proposed: 'Resolution proposed',
  pending_approval: 'Awaiting approval',
  resolved: 'Resolved',
  rejected: 'Rejected',
  dismissed: 'Dismissed',
}

export const SEVERITY_WORD: Readonly<Record<Severity, string>> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export type ProposalState =
  | 'not_approved'
  | 'rejected'
  | 'approved_pending_second_approver'
  | 'executable'
  | 'executed'

export const PROPOSAL_STATE_WORD: Readonly<Record<ProposalState, string>> = {
  not_approved: 'Awaiting approval',
  rejected: 'Refused',
  approved_pending_second_approver: 'Approved · needs a second approver',
  executable: 'Approved · ready to post',
  executed: 'Posted',
}

/**
 * C3-04 (G3837) — THE STATE WORD, KNOWING WHETHER AN APPROVAL WAS NEEDED.
 * `executable` read *"Approved · ready to post"* on a below-threshold line
 * nobody approved; it now says no approval was needed.
 */
export function proposalStateWordOf(state: ProposalState, approvalNeeded: boolean): string {
  if (state === 'executable' && !approvalNeeded) return 'Ready to post · no approval needed'
  return PROPOSAL_STATE_WORD[state]
}

export const REVERSIBILITY_WORD: Readonly<Record<string, string>> = {
  reversible: 'reversible',
  reversible_with_cost: 'reversible at a cost',
  irreversible: 'irreversible',
}

/** `execution.blockedBy` and the refusals a decision or an execution can answer with. */
export const RESOLUTION_CODE_WORD: Readonly<Record<string, string>> = {
  approval_quorum_unmet: 'More approvers are needed',
  approval_second_approver_required: 'A second approver is needed above this value',
  approval_segregation_violation: 'The person who proposed this cannot approve it',
  approval_rejection_reason_required: 'Refusing needs a reason',
  disposition_not_offered: 'That resolution is not offered for this exception',
  disposition_requires_adjustment: 'That resolution needs an adjustment amount',
  adjustment_currency_mismatch: 'The adjustment is in a different currency',
  exception_already_resolved: 'This exception is already resolved',
  policy_requires_approval: 'Policy requires an approval first',
  policy_denied: 'Your role cannot do this',
  capability_not_held: 'Your role cannot do this',
  proposal_not_executable: 'Not ready to post yet',
  proposal_superseded: 'A newer proposal replaced this one',
  /* G3441 (NC-01) — a configuration fact, never a transient failure. */
  resolution_not_configured: 'Resolutions are not set up for this reconciliation yet — your administrator configures approvals',
}

/**
 * WHO THE READER IS, AS A WORD — the chrome's who-am-I sub-line (fix/ui-close-
 * surface, G3435). It printed the raw `orgClass` (`customer`). Total over the
 * three classes `getSessionPrincipal` can answer.
 */
export const ORG_CLASS_WORD: Readonly<Record<OrgClass, string>> = {
  platform: '1CloudHub staff',
  partner: 'Partner',
  customer: 'Customer',
}

/**
 * G4045 — THE OWNER'S RULING, 4 Oct 2026: *"Serve role labels."* The avatar's
 * sub-line names the ROLE(S) the session live-holds, as `getSessionPrincipal`
 * serves them, joined with ` · `; C1 draws `RT · Rosalie Tan · user`. Shared
 * by the three chromes (C1, staff, partner) so the rule is written once.
 *
 * ⚠️ WHEN THE SESSION HOLDS NO LIVE ROLE the caller's own fallback is drawn —
 * the org class word on C1 and the staff console, the partner portal's own
 * line — because that is TRUE and names no role nobody was given. Never a
 * role word derived from capabilities: that was #587's option (b), and the
 * owner took (a).
 *
 * The labels are TENANT-AUTHORED: this returns a plain string the caller puts
 * in a text node, never markup (D6-9).
 */
export function servedRoleLine(roles: readonly string[] | undefined, fallback: string): string {
  return roles === undefined || roles.length === 0 ? fallback : roles.join(' · ')
}
