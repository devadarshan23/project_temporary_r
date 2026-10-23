/**
 * WHAT THE CLOSED DISPOSITION SET BUYS — `getDispositionMix`'s body, minus the
 * route. **G951–G953, 20 Sep 2026.**
 *
 * The contract's own framing, and it is the specification rather than
 * decoration: *"THIS REPORT IS THE ARGUMENT FOR THE CLOSED SET, MADE CONCRETE.
 * Counting how a period's exceptions actually settled — short delivery versus
 * price error versus duplicate — is a group-by over
 * `ExceptionResolution.dispositionKey`. Over prose it is not a report at all."*
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE ROW IS A **CHOICE**, NOT AN EXCEPTION, AND EVERY NUMBER BELOW FOLLOWS
 *    FROM THAT ONE SENTENCE. GET IT WRONG AND THE REPORT IS PLAUSIBLE AND
 *    FALSE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The contract puts `count` beside `reversalRate` and says why: *"a disposition
 * chosen four hundred times and reversed a third of the time was not the
 * success its volume suggests."* **CHOSEN.** So:
 *
 *   `count`        the number of times this disposition was EXECUTED on an
 *                  exception — including the times it was later undone.
 *   `reversalRate` of those, the fraction undone by a reversal that
 *                  `reversalIndictsAutonomy()` counts, and no other fraction.
 *   `byMode`       the same events, split by the mode each was taken in. The
 *                  three sum to `count`, always, and the test asserts it.
 *
 * ⚠️ AN EXCEPTION RESOLVED AS `write_off`, REVERSED, AND RESOLVED AS
 *    `write_off` AGAIN CONTRIBUTES **2**. That is the intended reading and it
 *    is the only one under which `reversalRate` has a meaning: the denominator
 *    of *"reversed a third of the time"* is the number of times it was tried.
 *    A per-EXCEPTION count would make the rate a ratio of two different
 *    populations.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 HALF THE EVENTS ARE IN A TABLE THAT DID NOT CARRY THEM UNTIL `0140`.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A reversal CLEARS `tenant.exception.resolution_*` — *"cleared on reversal"* —
 * so a reversed choice leaves no trace on the exception at all. Before
 * `db/migrations/0140` §2 there was nowhere to read it from: the proposal
 * survives, but a PROPOSAL IS NOT A RESOLUTION, and which proposal was executed
 * is decided by `tenant.exception.resolution_proposal_id`, the column the
 * reversal nulls.
 *
 * **Reading only the live column would have published `reversalRate: 0` for
 * every disposition and a `count` short by every reversed choice.** Two numbers
 * present and wrong, which is one step worse than G284's *"`fast-json-stringify`
 * SERIALISES a response; it does not VALIDATE one"* — an absent field crashes a
 * client, a wrong rate becomes a slide. `0140` §2 pins the three facts at the
 * moment they are destroyed; the `UNION ALL` below is the reader those pins
 * owe.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE FOUR REFUSALS, EACH FAIL-CLOSED, AND NOT ONE OF THEM IS A DEFAULT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   `label` or `family` absent      the pack that named this disposition has
 *                                   no catalogue row for it any more. A 500,
 *                                   because `label` and `family` are BOTH
 *                                   `required` on the 200 and there is nothing
 *                                   truthful to put in them. Publishing the
 *                                   bare key would be *"prose with extra
 *                                   steps"* — `tests/contracts/customer-surface
 *                                   -reach.test.mjs` §4's own words for the
 *                                   evasion it exists to catch.
 *   two labels for one key          two packs name one key differently. A 500
 *                                   rather than a choice: picking one would
 *                                   report a count under a label half of it
 *                                   was never filed as.
 *   an unreadable `mode`            `isResolutionMode()` refuses it, so
 *                                   `byMode` cannot be made to sum to `count`.
 *   an unreadable `reason`          `isReversalReason()` refuses it, so
 *                                   `reversalIndictsAutonomy()` cannot be
 *                                   asked and the rate has no defined
 *                                   numerator.
 *
 * ⚠️ **SKIPPING ANY OF THE FOUR IS THE FAILURE MODE, NOT REFUSING.** A dropped
 *    event is a count quietly short, and a count quietly short is exactly what
 *    this whole file is written to prevent. `0059` says the same about a
 *    dropped disposition option: *"A dropped option is a disposition that
 *    vanishes from an operator's choices without saying so, which is worse than
 *    a refusal."*
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 `valueAtRisk` IS OPTIONAL ON THE ROW AND IS **NOT PUBLISHED**. THIS IS A
 *    DECISION, NOT AN OVERSIGHT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It is the one property of the row that is not in its `required` list, and a
 * per-disposition total would be a SUM over `tenant.exception.value_at_risk_*`
 * — three columns that are a single-currency `Money` per row, with a fixture in
 * this repository that deliberately holds SGD and JPY side by side because
 * `0015` records mixed-currency comparison as a real defect. **Summing them
 * needs an FX rate at a date, `parseFxRate()` has no producer on this path, and
 * a bare addition of minor units across currencies is a number that looks like
 * money and is not.** G111's rule — one codec, and nothing else converts —
 * has no arm for this, so the field is omitted rather than invented.
 * `additionalProperties: false` admits its absence; the schema was written
 * that way.
 */

import { reversalIndictsAutonomy } from '../../model/domain.ts'
import type { ScopedClient } from '../../db/tenant-scope.ts'
import type { ExceptionDefect } from './exception-store.ts'
import { isResolutionMode, isReversalReason } from './exception-vocabulary.ts'

export type MixRead =
  | { readonly kind: 'mix'; readonly rows: readonly Record<string, unknown>[] }
  | { readonly kind: 'unpublishable'; readonly defect: ExceptionDefect }

export interface MixFilter {
  /**
   * G3624 — G954 answered. The period of the run that RAISED the exception,
   * through `tenant.exception.run_id` (`db/migrations/0480`) →
   * `public.run.period_id`. An exception whose run is not recorded belongs to
   * no period and is outside a period-filtered mix.
   */
  readonly periodId?: string
  readonly definitionId?: string
  readonly from?: string
  readonly to?: string
}

interface EventRow {
  readonly source: string
  readonly exception_id: string
  readonly disposition_key: string
  readonly mode: string
  readonly reversal_reason: string | null
  readonly label: string | null
  readonly family: string | null
}

/**
 * ONE STATEMENT, AND THE `UNION ALL` IS THE WHOLE DESIGN.
 *
 * 🛑 `UNION ALL` AND NEVER `UNION`. Two identical choices — the same
 *    disposition, in the same mode, on two exceptions — are two events, and
 *    `UNION` would silently fold them into one. The count this report exists
 *    to publish would then be *"distinct kinds of choice"*, which is not a
 *    count of anything anybody asked for.
 *
 * ⚠️ TWO `LEFT JOIN`s AND NOT TWO INNER ONES, SO THAT A MISSING CATALOGUE ROW
 *    REACHES THE REFUSAL RATHER THAN VANISHING. An inner join would drop the
 *    event, the count would be short, and nothing would say so — which is the
 *    defect this file's header spends four paragraphs on.
 *
 * ⚠️ NO TENANT PREDICATE, IN EITHER BRANCH OR EITHER JOIN. Invariant 1: the
 *    tenant reaches all five tables through `withTenantScope()`'s `SET LOCAL`
 *    and through nothing else, and `tests/http/disposition-mix-served.test.ts`
 *    §3 witnesses another tenant's settled exception absent from this answer.
 */
const EVENTS = `
  WITH settled AS (
    SELECT 'resolution'::text           AS source,
           e.id                         AS exception_id,
           e.definition_id              AS definition_id,
           e.resolution_disposition_key AS disposition_key,
           e.resolution_mode            AS mode,
           e.resolution_at              AS at,
           e.run_id                     AS run_id,
           NULL::text                   AS reversal_reason
      FROM tenant.exception e
     WHERE e.resolution_mode IS NOT NULL
    UNION ALL
    SELECT 'reversal'::text,
           r.exception_id,
           e.definition_id,
           r.reversed_disposition_key,
           r.reversed_mode,
           r.reversed_at,
           e.run_id,
           r.reason
      FROM tenant.exception_reversal r
      JOIN tenant.exception e ON e.id = r.exception_id
  )
  SELECT s.source, s.exception_id, s.disposition_key, s.mode, s.reversal_reason,
         d.label, d.family
    FROM settled s
    LEFT JOIN tenant.definition_archetype a ON a.definition_id = s.definition_id
    LEFT JOIN tenant.disposition d ON d.pack_key = a.pack_key AND d.key = s.disposition_key
   WHERE ($1::text        IS NULL OR s.definition_id = $1::text)
     AND ($2::timestamptz IS NULL OR s.at >= $2::timestamptz)
     AND ($3::timestamptz IS NULL OR s.at <= $3::timestamptz)
     -- G3624. A NULL \`run_id\` is NULL IN (…) and the row is dropped — an
     -- exception whose run is not recorded belongs to no period (\`0480\` §1).
     AND ($4::text IS NULL OR s.run_id IN (SELECT r.id FROM public.run r WHERE r.period_id = $4::text))
   ORDER BY s.disposition_key, s.exception_id, s.source
`

interface Bucket {
  label: string
  family: string
  count: number
  autonomous: number
  approved: number
  manual: number
  indicting: number
}

export async function readDispositionMix(
  tx: ScopedClient,
  filter: MixFilter,
): Promise<MixRead> {
  const rows = (
    await tx.query(EVENTS, [
      filter.definitionId ?? null,
      filter.from ?? null,
      filter.to ?? null,
      filter.periodId ?? null,
    ])
  ).rows as unknown as EventRow[]

  const buckets = new Map<string, Bucket>()

  for (const row of rows) {
    const where = row.source === 'reversal' ? 'exception_reversal' : 'exception'

    if (row.label === null || row.family === null) {
      /* The catalogue has no row for a key an exception was settled under. See
         the header: a 500, not a bare key. */
      return refuse('disposition', 'label', row.exception_id)
    }
    if (!isResolutionMode(row.mode)) {
      return refuse(where, row.source === 'reversal' ? 'reversed_mode' : 'resolution_mode', row.exception_id)
    }

    /* 🛑 `indicts` IS COMPUTED BY THE MODEL'S OWN FUNCTION AND NEVER BY A LIST
       HERE. `reversalIndictsAutonomy()` is *"a function rather than a comment,
       because every call site that computes a reversal rate must agree — and
       one that quietly counts all reversals will drive autonomy to `none`
       across the fleet and look like evidence while doing it."* **This is one
       of the two call sites that sentence is about.** */
    let indicts = false
    if (row.reversal_reason !== null) {
      if (!isReversalReason(row.reversal_reason)) {
        return refuse('exception_reversal', 'reason', row.exception_id)
      }
      indicts = reversalIndictsAutonomy(row.reversal_reason)
    }

    const held = buckets.get(row.disposition_key)
    if (held === undefined) {
      buckets.set(row.disposition_key, {
        label: row.label,
        family: row.family,
        count: 1,
        autonomous: row.mode === 'autonomous' ? 1 : 0,
        approved: row.mode === 'approved' ? 1 : 0,
        manual: row.mode === 'manual' ? 1 : 0,
        indicting: indicts ? 1 : 0,
      })
      continue
    }
    /* Two packs naming one key differently. See the header: a 500, because
       either label reports part of the count under a name it was not filed
       under. */
    if (held.label !== row.label || held.family !== row.family) {
      return refuse('disposition', 'label', row.exception_id)
    }
    held.count += 1
    if (row.mode === 'autonomous') held.autonomous += 1
    if (row.mode === 'approved') held.approved += 1
    if (row.mode === 'manual') held.manual += 1
    if (indicts) held.indicting += 1
  }

  /**
   * ⚠️ `ORDER BY s.disposition_key` ABOVE IS WHAT MAKES THIS ORDER TOTAL, and
   * the `Map` preserves insertion order, so the rows come out keyed
   * alphabetically. A report that reorders itself between renders is
   * `0015`'s objection to an unstable queue sort, one screen over.
   *
   * 🛑 *"Null-free: a disposition with no resolutions does not appear."* The
   * contract says so at `reversalRate`, and it falls out rather than being
   * arranged: a bucket exists only because an event created it, so a `count`
   * of zero is unrepresentable here and the division below cannot be by zero.
   */
  const out = [...buckets.entries()].map(([key, bucket]) => ({
    dispositionKey: key,
    label: bucket.label,
    family: bucket.family,
    count: bucket.count,
    byMode: {
      autonomous: bucket.autonomous,
      approved: bucket.approved,
      manual: bucket.manual,
    },
    reversalRate: bucket.indicting / bucket.count,
  }))

  return { kind: 'mix', rows: out }
}

function refuse(table: string, column: string, exceptionId: string): MixRead {
  return { kind: 'unpublishable', defect: { table, column, exceptionId } }
}
