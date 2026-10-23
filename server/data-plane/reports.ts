/**
 * C11's REPORT, MOUNTED — `GET /v1/reports/disposition-mix`
 * (`getDispositionMix`). **G951–G954, 20 Sep 2026.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS FILE MOUNTS RATHER THAN BUILDS. THE BODY IS IN
 *    `server/data-plane/disposition-mix-store.ts`.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `run-account.ts` set the shape and `exceptions.ts` and `proposals.ts` follow
 * it: a route reads validated query parameters, calls one store function with
 * the transaction the mint opened, and turns its answers into status codes.
 * **Every question about what a number MEANS is settled in the store, and no
 * SQL is written here.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 G300's THREE-PART TEST, DERIVED RATHER THAN ASSERTED.
 *    *"A table alone is the trap … Derive each; do not assert readiness."*
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   TABLE       FIVE, and the two that matter arrived in two different
 *               commits. Derive them:
 *                 `grep -c 'CREATE TABLE tenant.disposition' db/migrations/0059_resolution_chain.sql`
 *                   → 1. The catalogue. `label` and `family` are BOTH
 *                   `required` on the 200 row and `tests/contracts/customer-
 *                   surface-reach.test.mjs` §4 spent its whole existence
 *                   asserting they had no producer: *"A disposition catalogue
 *                   would be a table keyed on the disposition key holding at
 *                   least `label` and `family` … Nothing in `db/migrations/`
 *                   declares one."* G657 declared one and that tripwire fired.
 *                 `grep -c 'reversed_disposition_key' db/migrations/0140_reversal_write_and_mix_pins.sql`
 *                   → non-zero. The pins, without which `count` and
 *                   `reversalRate` are both wrong the moment a reversal
 *                   exists — which is the same commit. See that migration's
 *                   §2 and the store's header.
 *               The other three are `tenant.exception` (`0015`, the
 *               `resolution_*` columns), `tenant.exception_reversal` (`0015`
 *               §3) and `tenant.definition_archetype` (`0059` §1, which is how
 *               a definition reaches the pack that named its dispositions).
 *   MODEL       `grep -n 'export function reversalIndictsAutonomy\|export const DISPOSITION_FAMILIES\|export const RESOLUTION_MODE' model/domain.ts`
 *               → three declarations, all live and none `@dropped-for-v1`.
 *               `reversalIndictsAutonomy()` is CALLED by the store, not
 *               restated beside it, and `isResolutionMode()` /
 *               `isReversalReason()` in `exception-vocabulary.ts` DERIVE their
 *               vocabularies from the model rather than transcribing them.
 *   CAPABILITY  `grep -A2 'operationId: getDispositionMix' docs/contracts/capability.openapi.yaml`
 *               → `x-capability: view_dashboard`, a member of the closed set
 *               `model/access.ts` declares — `grep -n 'viewDashboard:' model/access.ts`
 *               — and a verb `tenant.role_capability` can carry.
 *               `tests/http/disposition-mix-served.test.ts` §1 is a 200 through
 *               a role holding exactly it.
 *
 * ⚠️ AND THE FREEZE IS NOT THEREBY SPENT. G300 lifts it **per operation**.
 * `createExport`, `getExport` and every C8 spend surface still have no table
 * and keep the router's honest 404 — *"the OpenAPI documents are the router. A
 * path they do not declare is not a route."*
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ `periodId` IS APPLIED SINCE 3 Oct 2026 — G3624, under the owner's ruling
 *    G3621 (*"Add run id: exceptions record the run that raised them"*).
 *    `db/migrations/0480` gives `tenant.exception` a `run_id`, and the period
 *    is `public.run.period_id` of that run — `disposition-mix-store.ts`'s
 *    `$4`. An exception whose run is not recorded belongs to NO period, so it
 *    is outside a period-filtered mix rather than inside every one.
 *    ⚠️ THE BLOCK BELOW IS G954's REFUSAL, KEPT AS THE REASONING IT WAS: its
 *    premise (*"`tenant.exception` carries no period and no run"*) was true
 *    until `0480`, and its own last paragraph named this commit — *"THE DAY AN
 *    EXCEPTION CARRIES A PERIOD, THIS REFUSAL IS THE THING TO DELETE"*. The
 *    422 is deleted from the operation in the same commit.
 *
 * 🛑 (G954, 20 Sep 2026 — superseded) `periodId` IS A DECLARED FILTER WITH NO
 *    PRODUCER, AND IT IS **REFUSED** RATHER THAN IGNORED.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `tenant.exception` carries no period and no run. Derive it, never read it:
 *
 *     grep -c 'period_id\|run_id' db/migrations/0015_exception_register.sql   → 0
 *
 * `public.run` has a `period_id` (`0002` §1) and `tenant.reconciliation_period`
 * exists (`0069`), and **nothing joins either to an exception**: the only
 * cross-run handle on the row is `match_group_id`, which `0015` records as
 * *"a pointer for a later migration to land against and NOT a foreign key"*
 * because there is no `match_group` table. So filtering this report by period
 * is not unbuilt — **it is inexpressible against this schema.**
 *
 * The two available answers were weighed and one is much worse than the other:
 *
 *   IGNORE IT   The caller asks for March and is handed every period, as a
 *               200, with no way to tell. `server/http/app.ts` makes exactly
 *               this argument against `removeAdditional: true` — a parameter
 *               *"silently deleted and the request served"* leaves no evidence
 *               that it was — and here the stakes are higher, because the
 *               answer is a set of totals somebody will put in front of a
 *               finance lead. **A superset presented as the answer to a
 *               narrower question is the silent partial 200 this repository
 *               most fears.**
 *   REFUSE IT   422 `validation_failed`, naming the filter. The caller gets
 *               nothing and knows why, and `from`/`to` remain as the date
 *               window that does work.
 *
 * ⚠️ **THE 422 IS DECLARED ON THE OPERATION IN THE SAME COMMIT**, so this
 * plane answers no status its own contract does not publish.
 * `docs/contracts/capability.openapi.yaml` gains it beside the 200 and the
 * 403. That is a contract change and it is named as one rather than slipped
 * in: it adds no operation and no path — `grep -c 'operationId:'
 * docs/contracts/*.openapi.yaml` does not move — and it takes the alternative
 * `server/data-plane/exceptions.ts` records as owed one operation over,
 * where `listRuns` answers *"an undeclared status"* and the file says in its
 * own voice that *"the fix is a 422 on `listRuns` or a 400 declared on both,
 * and either is a contract change nobody has ruled."* This rules it for this
 * operation and for no other.
 *
 * 🛑 THE DAY AN EXCEPTION CARRIES A PERIOD, THIS REFUSAL IS THE THING TO
 *    DELETE — and `tests/http/disposition-mix-served.test.ts` §5 is written so
 *    that deleting it without implementing the filter turns the suite red
 *    rather than green.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 IT IS AN `AuthorisedOperation` AND NOT A `Handler`. G301.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * *"AN OPERATION MAY NOT MOUNT UNTIL IT MINTS A RECORD."* `mountTier()`'s sixth
 * fence refuses to boot a gated operation whose entry is a bare handler, so
 * this could not have been mounted any other way. **The body takes no pool**:
 * it is handed a `tx` already open, already tenant-scoped, and already carrying
 * this act's authorisation record, written one statement earlier by
 * `server/data-plane/authorisation-record.ts` inside the SAME transaction.
 */

import { sendProblem } from '../http/app.ts'
import { CODES } from '../http/problem.ts'
import type { AuthorisedBody, AuthorisedOperation } from './authorisation-record.ts'
import { readDispositionMix } from './disposition-mix-store.ts'

/**
 * The querystring AFTER ajv has coerced and refused. Every one is OPTIONAL on
 * the contract, so every one may be absent — and `periodId` may be present,
 * which is the case the body spends its first branch on.
 */
interface MixQuery {
  readonly periodId?: string
  readonly definitionId?: string
  readonly from?: string
  readonly to?: string
}

const getDispositionMixBody: AuthorisedBody = async ({ request, reply, tx }) => {
  const query = request.query as MixQuery

  /* G3624 — the period is APPLIED (through the raising run), never ignored and
     no longer refused. See the header. */
  const read = await readDispositionMix(tx, {
    ...(query.periodId === undefined ? {} : { periodId: query.periodId }),
    ...(query.definitionId === undefined ? {} : { definitionId: query.definitionId }),
    ...(query.from === undefined ? {} : { from: query.from }),
    ...(query.to === undefined ? {} : { to: query.to }),
  })

  if (read.kind === 'unpublishable') {
    /* The store's own words for which of the four it hit are in the column
       name. Logged with the COLUMN and never with the cell —
       `exceptions.ts`'s `unpublishableException()` one surface over, written
       separately because that one's message says *"exception"* and this one
       must send a reader to the catalogue. */
    console.error(
      `data-plane: \`${read.defect.table}\` row reached from exception ` +
        `\`${read.defect.exceptionId}\` carries a \`${read.defect.column}\` the disposition ` +
        'mix cannot publish; no mix was returned.',
    )
    return sendProblem(reply, {
      status: 500,
      code: CODES.upstreamUnavailable,
      title: 'The request could not be completed.',
      detail:
        'A settled exception names a disposition this tenant’s catalogue cannot describe, or ' +
        'carries a value the domain model does not define. The report was not published.',
    })
  }

  return { rows: read.rows }
}

/**
 * The mix.
 *
 * ⚠️ `instanceOf` IS `null`, AND IT IS `ResourceRef.resourceId`'s OWN SECOND
 * EXAMPLE FOR ONE — *"opening a list, RUNNING A REPORT."* This is the first
 * operation either plane has mounted that is literally that phrase, and
 * `exceptions.ts` records the rule the two nulls follow: *"the two nulls differ
 * and the difference is which way an audit record would be wrong."* An id here
 * would name a row this act is not about.
 *
 * ⚠️ `resourceType` IS `'Exception'` AND NOT `'Report'`. `ResourceRef`'s
 * docblock is explicit that the field is an ENTITY NAME — *"'Exception',
 * 'SourceDocument', 'Solution'"* — and there is no `Report` entity in
 * `model/`; inventing one would put a noun in the audit trail that names
 * nothing. The rows this act reads are exceptions and their reversals, and
 * `run-account.ts` had to argue its way to `'Run'` for exactly this reason.
 *
 * 🛑 `view_dashboard` AND NOT `view_exception`, WHICH IS THE CONTRACT'S CHOICE
 * AND IS CONTESTED ON ITS OWN FACE: *"Per-disposition counts and reversal rates
 * are the customer's own close quality. Under `export_data` a partner would get
 * none of it; `view_dashboard` is the survey proposal and the exposure is taken
 * knowingly."* That contest is `tests/contracts/capability-annotation.test.mjs`'s
 * and is not reopened here — this file takes the annotation as it stands, from
 * `CAPABILITIES` rather than as a string, so a capability the model retires is
 * a compile error rather than a 403 nobody can explain.
 */
export const getDispositionMixOperation: AuthorisedOperation = {
  operationId: 'getDispositionMix',
  resourceType: 'Exception',
  instanceOf: () => null,
  body: getDispositionMixBody,
}
