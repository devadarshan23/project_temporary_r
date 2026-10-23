/**
 * UNDOING A RESOLUTION — `reverseResolution`'s body, minus the route.
 * **G946–G950, 20 Sep 2026.**
 *
 * `run-account-store.ts` set the shape and `exception-store.ts` follows it:
 * a store function takes the transaction the mint opened, writes and reads
 * inside it, and answers in a closed union the route turns into status codes.
 * **No SQL is written in `exceptions.ts` and no status code is chosen here.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS FILE EXISTS BECAUSE ITS TWO OBSTACLES ARE BOTH GONE, AND BOTH WERE
 *    WRITTEN DOWN BEFORE THEY WERE. READ BOTH BEFORE CHANGING ANYTHING HERE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `server/data-plane/proposals.ts` recorded them as a pair and refused to
 * remove either alone:
 *
 *   OBSTACLE 1 · NOTHING PRODUCES A RESOLUTION.   ✅ CLOSED BY G658.
 *     `executeProposalNow()` writes `resolution_*`, so a row with
 *     `resolution_mode IS NOT NULL` is reachable and the 409 is no longer this
 *     operation's only possible answer.
 *
 *   OBSTACLE 2 · THE PRIVILEGES.                  ✅ CLOSED BY `0140` §1.
 *     `tenant.exception_reversal` took `GRANT SELECT` alone, so *"mounting the
 *     operation today would still answer 500 on the happy path."*
 *     `db/migrations/0140_reversal_write_and_mix_pins.sql` grants `INSERT` and
 *     nothing wider, and **this file is the writer that grant owes** — G511:
 *     *"the fence and the writer are one commit or neither."* Deleting this
 *     file means deleting that grant in the same commit.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE THREE PINS, AND WHY A WRITE THAT LOOKS REDUNDANT IS NOT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `reversedDispositionKey`, `reversedMode` and `reversedAt` are copied off the
 * resolution THIS ACT IS ABOUT TO DESTROY. The model is explicit — *"The
 * current resolution. Null while unresolved, and cleared on reversal."* — so
 * one statement later there is no row anywhere carrying what was chosen, in
 * what mode, or when.
 *
 * **They are not for this operation. They are for `getDispositionMix`**, whose
 * `count` counts CHOICES — *"a disposition chosen four hundred times and
 * reversed a third of the time was not the success its volume suggests"* — and
 * whose `reversalRate` has that same count as its denominator. Without the
 * pins that report publishes `0` for every rate and a count short by every
 * reversed choice: two numbers that are PRESENT and WRONG, which is one step
 * worse than G284's silently absent field. `db/migrations/0140` §2 carries the
 * long form of the argument and the reason they are storage-only.
 *
 * ⚠️ AND THEY ARE NOT ON THE WIRE. `ExceptionReversal` is six fields and stays
 * six; `exception-store.ts`'s `readReversals()` selects the six and is not
 * touched by this slice. Publishing the undone resolution beside the reversal
 * would re-create the state *"cleared on reversal"* exists to make
 * unrepresentable.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 FIVE REFUSALS, AND THE ORDER THEY ARE ASKED IN IS THE CONTRACT'S.
 * ⚠️ THIS SAID FOUR UNTIL 22 Sep 2026 — G1831 ADDED `window_expired`,
 *    THE OWNER'S RULING, between `no_resolution` and `disposition_not_offered`:
 *    both of the first two are questions about whether THIS ROW may be
 *    reversed at all; the third is about the request BODY.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   `not_found`                the exception is not visible to this session.
 *                              One answer to two questions — no such row, or a
 *                              row row-level security hid — for the reason
 *                              `run-account.ts` states at length: any other
 *                              arrangement is an existence oracle across the
 *                              tenant boundary.
 *   `no_resolution`            the 409. *"There is no resolution to reverse.
 *                              Reversing an unresolved exception is a client
 *                              bug, not a workflow."*
 *   `window_expired`           the 409. More than `REVERSAL_WINDOW_HOURS`
 *                              have passed since `resolution_at`, by the
 *                              DATABASE's own clock. *"An unlimited undo is
 *                              not an audit trail."*
 *   `disposition_not_offered`  the 422, on `correctedDispositionKey` and on
 *                              nothing else. *"Validated against the same
 *                              closed list as a proposal — a correction is not
 *                              an escape from the vocabulary."*
 *   `unpublishable`            a stored row the model cannot name. A 500.
 *
 * ⚠️ THE OFFERED SET IS READ THROUGH `proposal-store.ts`'s OWN FUNCTION AND IS
 *    NOT RE-QUERIED HERE. `offeredFor()` filters by the definition's archetype
 *    and refuses a family no archetype claims; a second `SELECT … FROM
 *    tenant.disposition` in this file would be §5.3 — two implementations of
 *    one closed set, and the one that drifts is always the copy. The export it
 *    reaches (`dispositionIsOffered`) exists for this call and says so.
 */

import { REVERSAL_WINDOW_HOURS, type ReversalReason } from '../../model/domain.ts'
import type { Timestamp, UserId } from '../../model/kernel.ts'
import type { ScopedClient } from '../../db/tenant-scope.ts'
import {
  readException,
  type ExceptionDefect,
  type ExceptionRead,
} from './exception-store.ts'
import { isResolutionMode } from './exception-vocabulary.ts'
import { dispositionIsOffered } from './proposal-store.ts'

export type ReversalResult =
  | { readonly kind: 'reversed'; readonly exception: Record<string, unknown> }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'no_resolution' }
  | { readonly kind: 'window_expired' }
  | { readonly kind: 'disposition_not_offered' }
  | { readonly kind: 'unpublishable'; readonly defect: ExceptionDefect }

export interface ReversalInput {
  readonly reason: ReversalReason
  readonly newStatus: string
  readonly note: string | null
  readonly correctedDispositionKey: string | null
}

interface ResolvedRow {
  readonly status: string
  readonly resolution_mode: string | null
  readonly resolution_disposition_key: string | null
  readonly resolution_at: Date | null
  /**
   * `now() - resolution_at > REVERSAL_WINDOW_HOURS`, computed BY POSTGRES
   * against its own clock — never against `actor.now`, which this file
   * receives from the caller and must not trust for a refusal that exists
   * to bound how much time may pass. `NULL` when `resolution_at` is `NULL`
   * (an unresolved exception), which is why this column is read only after
   * `resolution_mode` has already been confirmed non-null below.
   */
  readonly window_expired: boolean | null
}

/**
 * The one act.
 *
 * 🛑 EVERYTHING BELOW HAPPENS IN THE TRANSACTION THE MINT OPENED, WHICH IS
 *    WHAT MAKES THE RECORD AND THE ACT INSEPARABLE. `0140` §3's restrictive
 *    policy reads `app.authorisation_ref` — the row
 *    `authorisation-record.ts` wrote one statement earlier — and `0059`'s
 *    trigger reads it again on the clearing UPDATE. **A reversal in this
 *    database that is not accompanied by the authorisation it ran under is not
 *    reachable**, and a rolled-back act takes its record with it.
 */
export async function reverseResolutionOf(
  tx: ScopedClient,
  exceptionId: string,
  input: ReversalInput,
  actor: { readonly userId: UserId; readonly now: Timestamp },
): Promise<ReversalResult> {
  /* ⚠️ NO TENANT PREDICATE, HERE OR ANYWHERE BELOW. Invariant 1: the tenant
     reaches every statement in this file through `withTenantScope()`'s
     `SET LOCAL` and through nothing else. */
  const rows = (
    await tx.query(
      `SELECT status, resolution_mode, resolution_disposition_key, resolution_at,
              (now() - resolution_at) > make_interval(hours => $2) AS window_expired
         FROM tenant.exception
        WHERE id = $1`,
      [exceptionId, REVERSAL_WINDOW_HOURS],
    )
  ).rows as unknown as ResolvedRow[]

  const row = rows[0]
  if (row === undefined) return { kind: 'not_found' }

  /* 🛑 THE 409, AND IT IS ASKED OF THE ROW RATHER THAN OF THE REVERSAL COUNT.
     An exception resolved, reversed and re-resolved is reversible again —
     *"Reversals accumulate as an array"* — and an exception reversed twice
     running is the client bug the contract names. `resolution_mode IS NULL` is
     exactly the difference between the two. */
  if (row.resolution_mode === null) return { kind: 'no_resolution' }

  /* The three pins. A resolution whose columns disagree is a row the model
     cannot name, and `0015`'s `exception_resolution_whole` CHECK says the
     three arrive together — so a null here is a defect and not a shape. */
  if (!isResolutionMode(row.resolution_mode)) {
    return { kind: 'unpublishable', defect: defect('exception', 'resolution_mode', exceptionId) }
  }
  if (row.resolution_disposition_key === null || row.resolution_at === null) {
    return {
      kind: 'unpublishable',
      defect: defect('exception', 'resolution_disposition_key', exceptionId),
    }
  }

  /**
   * 🛑 THE WINDOW, ASKED OF THE ROW'S OWN AGE RATHER THAN OF `actor.now`.
   * **THE OWNER'S RULING, 22 Sep 2026 — G1831**: a resolution is reversible
   * for `REVERSAL_WINDOW_HOURS` (24) from the post — the pack's own words,
   * `docs/handoff-pack/C1 Close.dc.html`: *"After that a correction is a new
   * entry with its own approval, which is the point: an unlimited undo is
   * not an audit trail."* Placed beside `no_resolution` rather than beside
   * `disposition_not_offered`, on the same reasoning the existing order
   * already carries: both are questions about whether THIS ROW may be
   * reversed at all, asked before the request BODY is examined for the
   * field-level 422.
   *
   * ⚠️ `window_expired` IS `boolean | null` AND IS GUARANTEED NON-NULL HERE:
   * it is `NULL` only when `resolution_at IS NULL`, and the `no_resolution`
   * return three lines up already refused that case.
   */
  if (row.window_expired === true) return { kind: 'window_expired' }

  /**
   * ⚠️ THE 422 IS ASKED ONLY WHEN THERE IS SOMETHING TO ASK ABOUT. A null
   * `correctedDispositionKey` means *"reopening"* rather than *"correcting"*,
   * which the contract distinguishes at the field — and validating a null
   * against a closed list would refuse the ordinary case.
   */
  if (input.correctedDispositionKey !== null) {
    const offered = await dispositionIsOffered(tx, exceptionId, input.correctedDispositionKey)
    if (!offered.ok) {
      return { kind: 'unpublishable', defect: defect(offered.table, offered.column, exceptionId) }
    }
    if (!offered.offered) return { kind: 'disposition_not_offered' }
  }

  /**
   * 🛑 THE ORDINAL IS ALLOCATED IN THE `INSERT` ITSELF, NOT READ AND THEN
   *    WRITTEN. A `SELECT max(ordinal)` followed by an `INSERT` loses the race
   *    between two reversals of one exception; computed inside the statement,
   *    the loser hits `exception_reversal_pkey` and is refused rather than
   *    silently overwriting an ordinal. **A duplicate-key error is the right
   *    answer to a genuine race and this file does not catch it** — the
   *    alternative is a retry loop that would have to decide what the second
   *    reverser meant.
   *
   * ⚠️ NOTHING HERE COMPUTES `reversalIndictsAutonomy()` AND NOTHING STORES
   *    IT, WHICH IS `0015`'s DECISION AND NOT AN OMISSION:
   *    *"`indicts_autonomy` IS NOT A COLUMN, DELIBERATELY … A stored copy is a
   *    second call site that cannot be recompiled."* The one call site that
   *    matters is the reader — `exception-store.ts` for `getException`, and
   *    `disposition-mix-store.ts` for the rate — and both call the model's
   *    function against the stored `reason`.
   */
  await tx.query(
    `INSERT INTO tenant.exception_reversal
       (tenant_id, exception_id, ordinal, at, reversed_by, reason, note, new_status,
        corrected_disposition_key, reversed_disposition_key, reversed_mode, reversed_at)
     SELECT nullif(current_setting('app.tenant_id', true), ''),
            $1,
            coalesce(max(r.ordinal), -1) + 1,
            $2::timestamptz, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz
       FROM tenant.exception_reversal r
      WHERE r.exception_id = $1`,
    [
      exceptionId,
      actor.now,
      actor.userId as string,
      input.reason,
      input.note,
      input.newStatus,
      input.correctedDispositionKey,
      row.resolution_disposition_key,
      row.resolution_mode,
      row.resolution_at.toISOString(),
    ],
  )

  /**
   * 🛑 THE CLEARING WRITE, AND ALL SIX COLUMNS GO TO NULL IN ONE STATEMENT
   *    BECAUSE `0140` §4's TRIGGER WILL ACCEPT NOTHING ELSE. Its clearing arm
   *    fires only when the row HAD a resolution and NEW holds none of it;
   *    leaving any one column set falls through to the arm that demands
   *    `execute_resolution`, and this act holds `reverse_resolution`. **The
   *    database refuses undo-then-redo in one act, which is the laundering the
   *    contract refuses an agent for.**
   *
   * ⚠️ `resolution_authorised_by_policy_id` AND `_version` ARE NOT IN THIS
   *    STATEMENT AND COULD NOT BE: `0059` withholds the `UPDATE` privilege on
   *    both, because they are the `autonomous` arm's and no request path
   *    reaches that arm. They are NULL on every row this repository can make.
   *
   * ⚠️ AND `correctedDispositionKey` DOES **NOT** BECOME A NEW RESOLUTION. It
   *    is recorded on the reversal and nowhere else. A corrected disposition
   *    that wrote itself into `resolution_disposition_key` would be a
   *    resolution nobody proposed, nobody approved and nobody executed,
   *    carrying a reversal's signature — precisely the laundered decision
   *    `0059`'s grants block refuses one table over. Re-resolving is
   *    `proposeResolution` → `decideApproval` → `executeProposal`, as it is
   *    for every other disposition.
   */
  await tx.query(
    `UPDATE tenant.exception
        SET resolution_mode                        = NULL,
            resolution_disposition_key             = NULL,
            resolution_proposal_id                 = NULL,
            resolution_decided_by                  = NULL,
            resolution_executed_by                 = NULL,
            resolution_at                          = NULL,
            status                                 = $2
      WHERE id = $1`,
    [exceptionId, input.newStatus],
  )

  /* The contract's 201 body is the whole `Exception`, so the detail read runs
     inside the same transaction — the caller sees the state it just wrote and
     nothing committed between. `assignExceptionTo()` does it the same way. */
  const read: ExceptionRead = await readException(tx, exceptionId)
  if (read.kind === 'not_found') return { kind: 'not_found' }
  if (read.kind === 'unpublishable') return { kind: 'unpublishable', defect: read.defect }
  return { kind: 'reversed', exception: read.exception }
}

function defect(table: string, column: string, exceptionId: string): ExceptionDefect {
  return { table, column, exceptionId }
}
