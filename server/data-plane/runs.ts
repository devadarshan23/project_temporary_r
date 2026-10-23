/**
 * THE RUN READ SURFACE — `GET /v1/runs` (`listRuns`) and `GET /v1/runs/{runId}`
 * (`getRun`). Two declared operations, both in the capability tier, both gated
 * identically.
 *
 * ⚠️ "IDENTICALLY" IS DERIVED, NOT ASSUMED. `capability.openapi.yaml` carries
 * exactly one `security:` key — the document-level one — and NO operation in it
 * overrides that, so `routesOf()` gives `getRun` and `listRuns` the same
 * `secured: true` from the same line. Reproduce:
 * `grep -c '^security:' docs/contracts/capability.openapi.yaml` → 1, and
 * `grep -c '^\s\+security:' docs/contracts/capability.openapi.yaml` → 0.
 * Mounting `getRun` therefore opens no gate `listRuns` had not already opened;
 * it serves ONE declared operation and nothing about the engine read surface.
 *
 * 🛑 AND IT IS MOUNTED ON THE DATA PLANE ONLY. `getRun` is a capability-tier
 * operation over tenant data; invariant 3 — "the control plane publishes
 * downward and never reads tenant data" — makes putting it on the other plane a
 * violation rather than a convenience.
 *
 * 🛑 READ THE SQL BELOW AND NOTE WHAT IS NOT IN IT: THERE IS NO TENANT
 * PREDICATE. No `WHERE tenant_id = $1`, no `tenantId` bound anywhere, no filter
 * a reviewer has to remember. Isolation is produced entirely by the row-level
 * security policy on `run`, reached through `withTenantScope()`.
 *
 * That is asserted, not assumed. `tests/http/data-plane-http.test.ts` disables
 * RLS on `run` underneath this handler and requires the SAME request to LEAK —
 * "the only way to tell isolation produced by the database from isolation
 * produced by a `WHERE` a handler happens to carry." A future edit that adds the
 * clause back turns that negative control red while every other assertion in the
 * file stays green, which is precisely why it exists.
 *
 * ⚠️ AND NOTE WHAT IS ALSO NOT HERE: A TRANSACTION. `withTenantScope()` issues
 * `BEGIN`, then `SELECT set_config('app.tenant_id', $1, true)`, then
 * `COMMIT`/`ROLLBACK`. This handler opens none of its own. `SET LOCAL` outside a
 * transaction block is SILENTLY DISCARDED by PostgreSQL
 * (docs/build/red-buildability.md:347), so a handler that opened its own would
 * be one autocommit away from serving every tenant's rows with RLS reporting
 * success.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 19 Sep 2026 — G301. NEITHER OPERATION IS A `Handler` ANY MORE, AND THE
 *    SENTENCE ABOVE IS NOW TRUE BY CONSTRUCTION RATHER THAN BY DISCIPLINE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Each is an `AuthorisedOperation`: a capability, a resource type, an instance,
 * and a BODY that is handed a transaction which is already open, already
 * tenant-scoped, and already carries this act's authorisation record.
 *
 * **THE CHANGE IS A REMOVAL AND THAT IS THE POINT — THESE TWO NO LONGER TAKE A
 * POOL.** They cannot open a scope of their own because they are not given
 * anything to open one with, so *"this handler opens none of its own"* stopped
 * being a claim a reader has to verify. `server/data-plane/authorisation-record
 * .ts` is the only thing that opens one, and it mints and writes invariant 10's
 * record before it calls either body.
 *
 * ⚠️ NOTHING ELSE MOVED. The SQL is unchanged, the absent tenant predicate is
 * unchanged, the cursor is unchanged, `NO_ENGINE_ACCOUNT` is unchanged, and the
 * negative control in `tests/http/data-plane-http.test.ts` that disables RLS
 * underneath these reads and requires them to LEAK is unchanged and still the
 * only thing that can tell database isolation from a handler's `WHERE`.
 */

import type { FastifyReply, FastifyRequest } from 'fastify'

import { sendProblem } from '../http/app.ts'
import { CODES } from '../http/problem.ts'
import type { AuthorisedBody, AuthorisedOperation } from './authorisation-record.ts'
import { isRunStatus, isRunTriggerKind } from './run-vocabulary.ts'
import { readRunCompletenessBatch } from './run-account-store.ts'

/**
 * The columns every operation that publishes a `Run` selects, written once.
 *
 * ⚠️ IT SAID *"the columns BOTH operations select"* UNTIL 19 Sep 2026 AND IS
 * CORRECTED RATHER THAN DELETED: THERE ARE THREE. `admitRun`
 * (`server/data-plane/run-admission.ts`, G694) publishes the same `Run` schema
 * on both of its success arms, and it `RETURNING`s this list rather than
 * assembling a run out of the values it just inserted. **The reason is the
 * sentence below, unchanged:** a column list that could differ between them is
 * a way for one of them to start omitting a field the others carry.
 *
 * 🛑 AND IT IS EXPORTED NOW, WHICH IS A DECISION AND NOT A CONVENIENCE. The
 * alternative was a second `SELECT` in the admitting module, and `0002_run.sql`
 * already names that shape by its consequence: *"a second vocabulary with
 * nothing checking it."* One list, one `toRun()`, one place a `Run` is built.
 */
export const RUN_COLUMNS =
  'SELECT id, definition_id, definition_version, period_id, trigger_kind,\n' +
  /*
   * 🛑 `trigger_by_user_id` — `db/migrations/0069` §4, G694. THE COLUMN THAT
   * DID NOT EXIST, AND THE SENTENCE BELOW IN `toRun()` IS WHY IT DOES NOW.
   * `RunTrigger` is a union and only its `kind` was stored, so a manual run
   * was published with nobody attached to it — and the wire's `RunTrigger` is
   * `additionalProperties: true, required: [kind]`, so the omission
   * VALIDATED.
   */
  '       trigger_by_user_id, status,\n' +
  '       inputs, started_at, finished_at, exceptions_raised,\n' +
  /*
   * 🛑 `started_at::text` IS THE CURSOR'S VALUE AND `started_at` IS NOT, AND THE
   * DIFFERENCE SILENTLY DROPPED ROWS FROM THIS READ UNTIL 19 Sep 2026.
   *
   * `timestamptz` keeps MICROseconds; a JavaScript `Date` keeps MILLIseconds.
   * The cursor was `row.started_at.toISOString()`, so a stored
   * `2026-09-19 10:00:00.123456+00` became `…123Z`, and the keyset comparison
   * `(started_at, id) < ($1::timestamptz, $2)` then EXCLUDED every row sharing
   * the boundary row's millisecond — while `nextCursor` reported the page as
   * complete.
   *
   * ⚠️ MEASURED, NOT REASONED ABOUT. Six runs inserted in one transaction share
   * `transaction_timestamp()` to the microsecond — which is what
   * `server/dev/seed.ts` and every run fixture here do. Paging with `?limit=1`
   * and following the server's OWN `nextCursor` to exhaustion returned **one**
   * of six, and the client was told the register was complete.
   *
   * 🛑 THE IDENTICAL DEFECT WAS FOUND AND FIXED IN `exception-store.ts` ON THE
   * SAME DAY, and the fix is copied from it deliberately rather than
   * reinvented: read the value **as PostgreSQL renders it**. The two paginated
   * reads that had a paging test were the two that were correct; this one had
   * none, which is why it survived.
   */
  '       started_at::text AS started_at_cursor,\n' +
  /*
   * 🛑 `definition_name` — `db/migrations/0420`, G3351. A SCALAR SUBQUERY AND
   * NOT A JOIN, AND THE REASON IS `admitRun`: this list is ALSO its `RETURNING`
   * clause (`returningColumns()` strips the `SELECT` and the `FROM`), and a
   * `RETURNING` cannot join — it can evaluate an expression over the row it
   * just wrote. One column list, one `toRun()`, as the header above demands.
   *
   * ⚠️ `d.tenant_id = run.tenant_id` IS A JOIN TERM, NOT A TENANT PREDICATE:
   * it binds nothing from a request and names no tenant — it says *the
   * definition OF THIS RUN*, because the primary key is composite. The
   * narrowing is still `definition_rls` under the scope, and with it a
   * definition the scope cannot see answers `null` — never another tenant's
   * name.
   *
   * ⚠️ `null` HAS TWO MEANINGS AND THE WIRE COLLAPSES THEM DELIBERATELY: a
   * definition written before `0420` carries no name, and a definition row
   * that is absent (nothing guarantees one — `run.definition_id` has no
   * foreign key) has none to give. Both are *this plane holds no name for it*,
   * which is the one thing `definitionName: null` asserts.
   */
  '       (SELECT d.name FROM tenant.reconciliation_definition d\n' +
  '         WHERE d.tenant_id = run.tenant_id AND d.id = run.definition_id) AS definition_name,\n' +
  /*
   * 🛑 THE PERIOD'S DATES — `db/migrations/0430`, G3429. Scalar subqueries for
   * `definition_name`'s reason exactly: this list is also `admitRun`'s
   * `RETURNING`, which cannot join. `::text` so the wire carries the DATE as
   * PostgreSQL renders it (`2026-03-02`) and never a `Date` that a JavaScript
   * zone would shift by a day. `null` = this plane holds no dates for the
   * period (written before `0430`, absent, or no period at all).
   */
  '       (SELECT p.starts_on::text FROM tenant.reconciliation_period p\n' +
  '         WHERE p.tenant_id = run.tenant_id AND p.id = run.period_id) AS period_starts_on,\n' +
  '       (SELECT p.ends_on::text FROM tenant.reconciliation_period p\n' +
  '         WHERE p.tenant_id = run.tenant_id AND p.id = run.period_id) AS period_ends_on\n' +
  '  FROM run\n'

/**
 * The query, exactly as `capability.openapi.yaml` declares it — after ajv has
 * coerced, defaulted and refused. Nothing here is optional-because-maybe: every
 * absent key is a parameter the contract does not mark `required`.
 */
interface ListRunsQuery {
  readonly definitionId?: string
  readonly periodId?: string
  readonly status?: readonly string[]
  readonly cursor?: string
  readonly limit: number
}

export interface RunRow {
  readonly id: string
  readonly definition_id: string
  readonly definition_version: number
  readonly period_id: string | null
  readonly trigger_kind: string
  /** `db/migrations/0069` §4. NULL on every trigger with no human principal. */
  readonly trigger_by_user_id: string | null
  readonly status: string
  readonly inputs: Record<string, string[]> | null
  readonly started_at: Date
  readonly finished_at: Date | null
  readonly exceptions_raised: number | null
  /** See `RUN_COLUMNS`. The cursor's value, rendered by PostgreSQL, not by `Date`. */
  readonly started_at_cursor: string
  /** `db/migrations/0420`. Operator text, verbatim; `null` = no name held. */
  readonly definition_name: string | null
  /** `db/migrations/0430`. `YYYY-MM-DD`, inclusive; `null` = no dates held. */
  readonly period_starts_on: string | null
  readonly period_ends_on: string | null
}

/**
 * The cursor is opaque and it is opaque on purpose.
 * `capability.openapi.yaml` → `components.parameters.Cursor`: "A cursor a client
 * can construct is a cursor a client can point at another tenant's ordering
 * key." Base64 is not a security boundary and is not pretending to be one — RLS
 * is. What this buys is that a client cannot come to DEPEND on the shape, so the
 * ordering key can change without breaking one.
 */
function encodeCursor(row: RunRow): string {
  return Buffer.from(`${row.started_at_cursor}|${row.id}`, 'utf8').toString('base64url')
}

function decodeCursor(cursor: string): { startedAt: string; id: string } | null {
  try {
    const text = Buffer.from(cursor, 'base64url').toString('utf8')
    const split = text.indexOf('|')
    if (split <= 0) return null
    const startedAt = text.slice(0, split)
    const id = text.slice(split + 1)
    if (id === '' || Number.isNaN(Date.parse(startedAt))) return null
    return { startedAt, id }
  } catch {
    return null
  }
}

/**
 * A row whose stored value is not in the model's vocabulary. Carries the TABLE,
 * the COLUMN and the run id and nothing else — no cell value, because a value
 * that reached here is exactly the value nobody vouched for.
 *
 * ⚠️ IT CARRIES A `table` SINCE 19 Sep 2026 AND THAT WIDENING IS THE WHOLE OF
 * WHAT THE MOUNTING SLICE CHANGED IN THIS FILE. `server/data-plane/run-account
 * -store.ts` declares `AccountDefect` as exactly `{ table, column, runId }`, so
 * the two are ONE shape rather than two — and `unpublishable()` below is
 * therefore ONE refusal rather than a second copy of it in the file next door.
 * A second copy is §5.3: two vocabularies for one concept, diverging, and the
 * one that drifts is a 500 nobody exercises.
 */
export interface Unpublishable {
  readonly table: string
  readonly column: string
  readonly runId: string
}

/**
 * One row → one `Run`, OR a refusal.
 *
 * 🛑 THE REFUSAL IS THE POINT AND IT IS WHY `model/` IS ON THE SERVED PATH AT
 * ALL. `0002_run.sql` puts no CHECK on `status` or `trigger_kind` and argues, in
 * writing, that a third copy of a closed enum would be a third place to drift.
 * The consequence it does not claim to close is that the column reached the wire
 * unexamined: `fast-json-stringify` serialises against the response schema, it
 * does not validate against it, so an unmodelled `status` is published verbatim
 * and the consumer meets a word its own contract says cannot occur.
 *
 * `isRunStatus()` and `isRunTriggerKind()` are derived from `model/domain.ts` by
 * the type system rather than transcribed beside it — see
 * `server/data-plane/run-vocabulary.ts`.
 *
 * ⚠️ A BAD ROW FAILS THE WHOLE RESPONSE RATHER THAN BEING DROPPED FROM IT. A
 * page that silently omitted the row would under-report a tenant's runs while
 * `nextCursor` went on claiming the page was the page — an answer that is wrong
 * and looks right. Refusing is the only outcome a caller can act on.
 */
export function toRun(
  row: RunRow,
  /**
   * G3442 (RC-10) — the run's completeness channel as the engine account
   * holds it, or `null` when this plane holds no produced account for the run.
   * Read by `readRunCompletenessBatch()` — never defaulted to `[]`.
   */
  completeness: readonly Record<string, unknown>[] | null = NO_ENGINE_ACCOUNT,
): { ok: true; value: Record<string, unknown> } | { ok: false; why: Unpublishable } {
  if (!isRunStatus(row.status)) {
    return { ok: false, why: { table: 'run', column: 'status', runId: row.id } }
  }
  if (!isRunTriggerKind(row.trigger_kind)) {
    return { ok: false, why: { table: 'run', column: 'trigger_kind', runId: row.id } }
  }
  return {
    ok: true,
    value: {
      runId: row.id,
      definitionId: row.definition_id,
      /*
       * G3351. The definition's NAME, as stored — operator-authored text,
       * parsed by nothing, published as text. ⚠️ IT IS NOT IN `Unpublishable`
       * AND NEVER WILL BE: `0069` refused this column partly because *"a
       * refusal that carried one would put operator text into a log"*, and the
       * refusal shape above carries a table, a column and a run id only.
       */
      definitionName: row.definition_name,
      definitionVersion: row.definition_version,
      periodId: row.period_id,
      /* G3429 — the period's calendar span, so a client draws "02 – 08 Mar
         2026" rather than an id. Both or neither (`0430`'s CHECK). */
      periodStartsOn: row.period_starts_on,
      periodEndsOn: row.period_ends_on,
      /*
       * `RunTrigger` is an object because the trigger carries attribution
       * beyond its kind.
       *
       * ✅ ⚠️ THIS COMMENT READ *"Only `kind` is stored by 0002; the rest
       * arrives with the operation that records it"* UNTIL 19 Sep 2026, AND IT
       * IS CORRECTED RATHER THAN DELETED BECAUSE THE OPERATION IT PREDICTED IS
       * THE ONE THAT CHANGED IT. `admitRun` records `{ kind: 'manual',
       * byUserId }` — the contract's own words, *"taken from the session"* —
       * and `db/migrations/0069` §4 adds the column it had nowhere to go.
       *
       * 🛑 THE KEY IS OMITTED WHEN THE COLUMN IS NULL RATHER THAN EMITTED AS
       * `byUserId: null`, AND THAT IS NOT TIDINESS. Four of five `RunTrigger`
       * kinds have no human principal (`model/governance.ts`), so a
       * `scheduled` run legitimately carries none — and the MODEL's union has
       * no `byUserId` on those arms at all, so a null would be a field the
       * type does not declare. The wire tolerates both
       * (`additionalProperties: true`); the model does not.
       */
      trigger: {
        kind: row.trigger_kind,
        ...(row.trigger_by_user_id === null ? {} : { byUserId: row.trigger_by_user_id }),
      },
      status: row.status,
      ...(row.inputs === null ? {} : { inputs: row.inputs }),
      startedAt: row.started_at.toISOString(),
      finishedAt: row.finished_at === null ? null : row.finished_at.toISOString(),
      exceptionsRaised: row.exceptions_raised,
      completeness,
    },
  }
}

/**
 * 🛑 `null`, AND IT IS THE ONLY HONEST VALUE THIS PLANE CAN PUT HERE TODAY.
 *
 * G153's carve-out ⓐ is discharged by the SCHEMA: `Run.completeness` now exists,
 * it is `required` and it is `[array, 'null']`, and `CompletenessFinding` carries
 * the magnitude and the address that make `incomplete` mean something. What this
 * handler can supply is a different question, and the two answers are different
 * facts:
 *
 *   `[]`    the ENGINE ran and observed no shortfall.
 *   `null`  THIS PLANE HOLDS NO ENGINE ACCOUNT FOR THIS RUN AT ALL.
 *
 * ⚠️ AND IT IS `null` FOR EVERY ROW, INCLUDING `run_acme_incomplete`. Nothing in
 * this repository persists a `SetReconciliationResult`: `ls db/migrations/`
 * is 0001–0003, and `run` carries `status` and no findings channel — 0002 says
 * so in its own header, "storing columns no wire can carry would create a second
 * vocabulary with nothing checking it. They land with the schemas that publish
 * them." The schemas are published by this commit; the columns are not, because
 * choosing between a typed column set and a `jsonb` operand column is a ruling
 * W-3 (#193) reserves to the owner — a `jsonb` column inherits invariant 4's
 * G106 problem, since a key with no `FieldSpec` is UNREADABLE.
 *
 * ┌─ 🛑 19 Sep 2026 — THE PARAGRAPH ABOVE IS FALSE AND THE CONSTANT BELOW IS ───┐
 * │ NOW AN UNDERSTATEMENT RATHER THAN A STUB. BOTH HALVES ARE STATED HERE      │
 * │ RATHER THAN QUIETLY REPAIRED, because the two are different problems and   │
 * │ only one of them is fixed.                                                 │
 * │                                                                            │
 * │ **W-3 IS RULED — G284 — AND THE COLUMNS EXIST.**                            │
 * │ `db/migrations/0007_run_engine_account.sql` carries a typed column per      │
 * │ declared findings channel, thirteen tables, and                            │
 * │ `server/data-plane/run-account-store.ts` writes and reads them. Derive it:  │
 * │ `ls db/migrations/*.sql | wc -l`. So *"nothing persists a                   │
 * │ `SetReconciliationResult`"* is the sentence a reader would have trusted and │
 * │ it is no longer true.                                                      │
 * │                                                                            │
 * │ 🛑 `NO_ENGINE_ACCOUNT` IS STILL `null` AND IS STILL PUBLISHED               │
 * │ UNCONDITIONALLY, AND THAT IS NOW A KNOWN GAP RATHER THAN THE ONLY HONEST    │
 * │ ANSWER. For a run with NO account row it remains exactly right. For a run   │
 * │ that HAS one, `Run.completeness` now understates what this plane holds —    │
 * │ `readRunEngineAccount()` could supply the real channel, and does not,       │
 * │ because joining it here is a change to two MOUNTED operations and          │
 * │ `listRuns` would need one read per row on a paged surface. **That wants its │
 * │ own commit and its own argument about the N+1.**                            │
 * │                                                                            │
 * │ ⚠️ THE DIRECTION OF THE ERROR IS THE SAFE ONE AND IS NAMED SO NOBODY READS  │
 * │ IT AS FINE: `null` says *this plane holds no engine account*, which for     │
 * │ such a run is now WRONG — but it is wrong by withholding rather than by     │
 * │ fabricating, which is the opposite of the `[]` this constant exists to      │
 * │ refuse. A consumer is told less than is known; nobody is told a clean close │
 * │ that did not happen.                                                        │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE ALTERNATIVE IS REFUSED EXPLICITLY: `[]` HERE WOULD BE A LIE, AND A
 * PLAUSIBLE ONE. It would report a clean close for every run in a database that
 * has never run the engine — and for `run_acme_incomplete` it would be
 * internally contradictory, because `terminalRunStatus()` derives `incomplete`
 * FROM a non-empty completeness channel. That is the same defect
 * `ResidueEntry.settlement` was made required-and-nullable to prevent: a
 * fabricated value on the one field somebody reads to find out what went wrong.
 * `CLAUDE.md` — never mock, never fabricate, leave a clearly marked stub.
 */
const NO_ENGINE_ACCOUNT = null

/*
 * ✅ G3442, 3 Oct 2026 (reaudit RC-10) — THE GAP THE BOX ABOVE NAMES IS CLOSED
 *    AND THE BOX IS KEPT, because its reasoning is why the repair looks like
 *    this. *"`listRuns` would need one read per row on a paged surface. That
 *    wants its own commit and its own argument about the N+1."* The argument:
 *    `readRunCompletenessBatch()` answers a whole page in THREE statements,
 *    whatever its size, so `getRun` and `listRuns` publish the account's own
 *    channel for every run that HAS a produced account, and `null` — still the
 *    constant above, still never `[]` — for every run that has none. Every
 *    strip cell on C1 read "no engine account" because of the understatement;
 *    a run the engine accounted now says what the engine found.
 */

/**
 * The one refusal both handlers share.
 *
 * `upstream_unavailable` is the code because `errors.yaml`'s enum is CLOSED and
 * it holds nothing that means "a stored row is not something the engine's
 * vocabulary recognises". `server/http/problem.ts` already calls it "the only
 * honest code for a 500", and a row the model cannot name IS a failure below us.
 * Minting a member would be a contract change, and a contract change is not a
 * handler's to make.
 *
 * ⚠️ `detail` IS A CONSTANT. `errors.yaml`: `detail` "MUST NOT contain field
 * values, record contents or customer-authored strings" — and the offending
 * cell is precisely a value nobody vouched for. It goes to the process log,
 * where the operator who can fix it will look, and not into a response.
 *
 * ┌─ 🛑 THIS 500 IS NOT DECLARED BY EITHER OPERATION, AND THAT IS STATED HERE ──┐
 * │ RATHER THAN LEFT FOR THE NEXT READER TO REDISCOVER.                        │
 * │                                                                            │
 * │ `getRun` declares `'200'` and `'404'`; `listRuns` declares `'200'` alone    │
 * │ (`capability.openapi.yaml`, and `RouteSpec.unwiredResponses` shows the      │
 * │ same from the route table). A client generated from the document will meet  │
 * │ a status its own types say cannot occur.                                    │
 * │                                                                            │
 * │ There IS precedent and it is named so this is not read as novel: the 401    │
 * │ from the `onRequest` hook is undeclared per-operation too, and the generic  │
 * │ error handler in `server/http/app.ts` already answers with this same code.  │
 * │ What is new is a DELIBERATE, reachable 500 on a read whose contract says it │
 * │ answers 200 or 404 — reachable by any row an operator can write, since      │
 * │ `db/migrations/0002_run.sql` declines the CHECK constraint on purpose.      │
 * │                                                                            │
 * │ ⚠️ AND THE BLAST RADIUS IS WIDER FOR `listRuns` THAN FOR `getRun`. One      │
 * │ poisoned cell in one row fails the WHOLE page for that tenant, because      │
 * │ `toRun()`'s refusal is per-response and not per-row — argued above, and the │
 * │ argument still holds: a short page whose `nextCursor` claims completeness   │
 * │ is wrong and looks right. The consequence is a tenant-visible availability  │
 * │ failure the tenant cannot self-remediate, from a column nothing constrains. │
 * │                                                                            │
 * │ NOT REPAIRED HERE, and the alternative is refused explicitly: downgrading   │
 * │ to a 404 would make it declared and make it a LIE — a stored row the model  │
 * │ cannot name is not an absent row, and answering "no such run" for a run     │
 * │ that exists is the existence oracle running backwards. Declaring `'500'` on │
 * │ both operations is a contract change, and this file already records why     │
 * │ that is not a handler's to make. It wants its own commit and its own        │
 * │ argument.                                                                  │
 * └────────────────────────────────────────────────────────────────────────────┘
 */
export function unpublishable(reply: FastifyReply, why: Unpublishable): FastifyReply {
  console.error(
    `data-plane: \`${why.table}\` row for run \`${why.runId}\` carries a \`${why.column}\` ` +
      'that is not in the domain model’s vocabulary; the row was not published.',
  )
  return sendProblem(reply, {
    status: 500,
    code: CODES.upstreamUnavailable,
    title: 'The request could not be completed.',
    detail: 'A stored run carries a value the domain model does not define. It was not published.',
  })
}

const listRunsBody: AuthorisedBody = async ({ request, reply, tx }) => {
  const query = request.query as ListRunsQuery

  const after = query.cursor === undefined ? null : decodeCursor(query.cursor)
  if (query.cursor !== undefined && after === null) {
    // An unreadable cursor is not a 500 and not an empty page: it is a request
    // that does not satisfy the contract, and the contract's own word for that
    // is what the schema would have said had it been able to describe opacity.
    return sendProblem(reply, {
      status: 400,
      code: CODES.validationFailed,
      title: 'The cursor is not one this plane issued.',
    })
  }

  const values: unknown[] = []
  const where: string[] = []

  if (query.status !== undefined && query.status.length > 0) {
    values.push([...query.status])
    where.push(`status = ANY($${values.length}::text[])`)
  }
  if (query.definitionId !== undefined) {
    values.push(query.definitionId)
    where.push(`definition_id = $${values.length}`)
  }
  if (query.periodId !== undefined) {
    values.push(query.periodId)
    where.push(`period_id = $${values.length}`)
  }
  if (after !== null) {
    values.push(after.startedAt)
    const startedAtPlaceholder = `$${values.length}::timestamptz`
    values.push(after.id)
    where.push(`(started_at, id) < (${startedAtPlaceholder}, $${values.length})`)
  }

  // One more than asked for, so `nextCursor` states whether there IS a next
  // page rather than guessing. A `nextCursor` that is sometimes a lie is worse
  // than no pagination at all.
  values.push(query.limit + 1)
  const limitPlaceholder = `$${values.length}`

  const sql =
    RUN_COLUMNS +
    (where.length === 0 ? '' : ` WHERE ${where.join('\n   AND ')}\n`) +
    ' ORDER BY started_at DESC, id DESC\n' +
    ` LIMIT ${limitPlaceholder}`

  /**
   * 🛑 THE TRANSACTION IS NOT OPENED HERE AND CANNOT BE — G301, 19 Sep 2026.
   * `tx` arrives already `BEGIN`-ned, already carrying `app.tenant_id`, and
   * already carrying this act's authorisation record, which was written into
   * `tenant.authorization_grant` one statement before this one. **A rolled-back
   * read therefore takes its own record with it.**
   *
   * ⚠️ THE PARAGRAPH THAT STOOD HERE IS QUOTED RATHER THAN DELETED BECAUSE THE
   * CHECK IT NAMES DID NOT GO AWAY, IT MOVED: *"`boundTenantOf()` RATHER THAN
   * `session.tenantId` … `null` here means D1 has not run. That is unreachable
   * behind the gate, so it THROWS."* `server/data-plane/authorisation-record.ts`
   * calls `boundTenantOf()` now, before it mints — which is strictly earlier
   * than before, because a session with no tenant cannot even be authorised.
   */
  const result = await tx.query(sql, values)
  const rows = result.rows as unknown as RunRow[]

  const page = rows.slice(0, query.limit)
  /* G3442 — one batch for the whole page, never one read per row. */
  const accounted = await readRunCompletenessBatch(tx, page.map((r) => r.id))
  if (!accounted.ok) return unpublishable(reply, accounted.defect)
  const items: Record<string, unknown>[] = []
  for (const row of page) {
    const view = toRun(row, accounted.byRun.get(row.id) ?? NO_ENGINE_ACCOUNT)
    if (!view.ok) return unpublishable(reply, view.why)
    items.push(view.value)
  }

  const last = page[page.length - 1]
  return {
    items,
    nextCursor: rows.length > query.limit && last !== undefined ? encodeCursor(last) : null,
  }
}

/**
 * `GET /v1/runs/{runId}` — `getRun`, "One run, with its inputs pinned."
 *
 * 🛑 THE SAME SQL SHAPE AS `listRuns` AND FOR THE SAME REASON: THERE IS NO
 * TENANT PREDICATE. `WHERE id = $1` and nothing else. A run belonging to another
 * tenant is not filtered out by this handler — it is INVISIBLE to it, because
 * `withTenantScope()` has set `app.tenant_id` and the row-level security policy
 * on `run` is what answers.
 *
 * ⚠️ THAT IS ALSO WHAT MAKES THE 404 HONEST RATHER THAN CAREFUL.
 * `capability.openapi.yaml`'s `NotFound` response requires this endpoint to
 * answer identically "for a row that does not exist and for a row in another
 * tenant — distinguishing them would make this endpoint an existence oracle
 * across the tenant boundary." Here there is no branch to get wrong: both cases
 * are the same empty result set arriving from the database. A handler that
 * filtered in TypeScript would have two paths and one of them would eventually
 * grow a different message.
 */
const getRunBody: AuthorisedBody = async ({ request, reply, tx }) => {
  const { runId } = runIdOf(request)

  const result = await tx.query(`${RUN_COLUMNS} WHERE id = $1`, [runId])
  const rows = result.rows as unknown as RunRow[]

  const row = rows[0]
  if (row === undefined) {
    return sendProblem(reply, {
      status: 404,
      code: CODES.resourceNotFound,
      title: 'No such run.',
      // A constant, and identical whichever of the two cases produced it.
      detail: 'No run with that id is visible to this session.',
    })
  }

  const accounted = await readRunCompletenessBatch(tx, [row.id])
  if (!accounted.ok) return unpublishable(reply, accounted.defect)
  const view = toRun(row, accounted.byRun.get(row.id) ?? NO_ENGINE_ACCOUNT)
  if (!view.ok) return unpublishable(reply, view.why)
  return view.value
}

/**
 * `components.parameters.RunId` — `in: path`, `required: true`, `type: string`.
 * The router produces exactly the template's parameters, so there is nothing
 * here that ajv has not already seen.
 *
 * ⚠️ WRITTEN ONCE BECAUSE IT IS NOW READ TWICE: the body needs the id to query
 * on, and `getRunOperation.instanceOf` needs it to name the `ResourceRef` the
 * authorisation is minted against. Two separate reads of `request.params` would
 * be two places for the key to drift, and the one that drifted silently would be
 * the AUDIT record rather than the query — which is the worse direction.
 */
function runIdOf(request: FastifyRequest): { runId: string } {
  return request.params as { runId: string }
}

/* ------------------------------------------------------------------ *
 * THE TWO OPERATIONS, AS G301 REQUIRES THEM: A CAPABILITY, A RESOURCE, A BODY.
 *
 * 🛑 THE CAPABILITY IS TAKEN FROM `CAPABILITIES`, NOT WRITTEN AS A STRING, so a
 * capability the model retires is a compile error here rather than a 403 nobody
 * can explain. It must equal the `x-capability` the contract annotates — both
 * are `admit_source` today — and the two are joined by nothing but this comment,
 * which is a gap with a name: `mountTier()` checks that an annotation EXISTS and
 * `tools/check-capability-annotations.mjs` checks every declared operation has
 * one, and neither compares the handler's verb against the document's.
 * **A mismatch would mint a record naming a capability different from the one
 * the gate asked about.** `tests/http/authorisation-record.test.ts` §4 asserts
 * the two agree, which is the only control there is.
 *
 * ⚠️ `resourceType` IS `'Run'` ON BOTH — the ENTITY name from `model/domain.ts`,
 * never a path and never a table. `ResourceRef` says it is *"Never parsed."*
 * ------------------------------------------------------------------ */

/**
 * `resourceId: null` — *"opening a list"* is the example
 * `ResourceRef.resourceId`'s own declaration gives for a genuinely
 * non-instance-bound act, and it is the case that makes G303's absent scope
 * columns matter: *"with no instance to check, the scope IS the check."*
 */
export const listRunsOperation: AuthorisedOperation = {
  operationId: 'listRuns',
  resourceType: 'Run',
  instanceOf: () => null,
  body: listRunsBody,
}

/** One run, named. The instance is the path parameter, stored verbatim. */
export const getRunOperation: AuthorisedOperation = {
  operationId: 'getRun',
  resourceType: 'Run',
  instanceOf: (request) => runIdOf(request).runId,
  body: getRunBody,
}
