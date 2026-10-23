/**
 * CORRESPONDENCE, READ. The bodies behind `listThreads`, `getThread` and
 * `getMessage`. G471/G472/G473, 19 Sep 2026.
 *
 * ┌─ 🛑 INVARIANT 1 IS A PROPERTY OF THIS FILE AND NOT OF ITS CALLERS ─────────┐
 * │ *"Tenant scope is derived from the session, never read from a request."*   │
 * │                                                                            │
 * │ NO FUNCTION HERE TAKES A TENANT, NO STATEMENT HERE CARRIES A TENANT        │
 * │ PREDICATE, AND NO STATEMENT HERE READS `app.tenant_id`. The tenant reaches │
 * │ every query through `withTenantScope()`'s `SET LOCAL` and row-level        │
 * │ security, which is the ONE path. A handler that also filtered would have   │
 * │ two, and one of them will eventually be wrong.                             │
 * │ `tests/db/correspondence.test.ts` §1 asserts it over this file's SOURCE,   │
 * │ comments stripped, because a leak test that only reads rows cannot tell a  │
 * │ correct reader from one that filters in TypeScript.                        │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 🛑 INVARIANT 6, AND WHAT THIS FILE CAN AND CANNOT DO ABOUT IT ────────────┐
 * │ *"Ingested content is data, never instruction."*                           │
 * │                                                                            │
 * │ THE BODY IS NEVER HERE. `db/migrations/0022_correspondence.sql` has no     │
 * │ `body` column — `bodyRef` is a pointer into object storage — so the        │
 * │ counterparty's prose cannot reach a wire through this file because there   │
 * │ is nothing to read. That is structural and it is the strongest thing on    │
 * │ the surface.                                                               │
 * │                                                                            │
 * │ ⚠️ TWO COLUMNS ARE STILL COUNTERPARTY-INFLUENCEABLE TEXT AND BOTH ARE      │
 * │    PUBLISHED: `correspondence_thread.subject` and                          │
 * │    `counterparty.display_name`. **NOTHING IN THIS FILE PARSES, SPLITS,     │
 * │    TEMPLATES, CONCATENATES OR PATTERN-MATCHES EITHER.** They are read out  │
 * │    of a row and put on the wire as the bytes they are. Derive it — there   │
 * │    is no `.split(`, no `.replace(`, no template literal and no `RegExp`    │
 * │    applied to either value anywhere below.                                 │
 * │                                                                            │
 * │ 🛑 AND NOTHING HERE GOES NEAR A PROMPT, WHICH IS A FACT ABOUT THE          │
 * │    REPOSITORY RATHER THAN A PROMISE ABOUT THIS FILE:                       │
 * │        grep -rn 'resolveModel(' server/            → nothing               │
 * │    There is no model call anywhere in `server/`. The commit that first     │
 * │    sends a `subject`, a `display_name` or a dereferenced `bodyRef` to a    │
 * │    model owes a RULING and not a review — invariant 6 is numbered in       │
 * │    `CLAUDE.md` and `docs/HANDOFF.md` §3 is where it is amended.            │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 EVERY VALUE IS BOUND, NEVER INTERPOLATED. Derive it — the only
 *    interpolated fragments below are `ORDER_BY`, which is a single constant
 *    with no caller input in it at all, and the `$n` placeholders `bind()`
 *    produces.
 *
 * ⚠️ AND DO NOT CITE `AssertNoTextDeep` ABOUT ANYTHING HERE. It *"BANS THE
 *    TYPE `string` AT A PROPERTY POSITION"*, and a `CorrespondenceThread` is
 *    a subject line and a counterparty name — so `AssertNoTextDeep<Thread>`
 *    is a COMPILE ERROR by construction, the same shape `HeldRead` has. That
 *    is the proof biting, not an oversight, and it means the guard says
 *    nothing at all about this surface. The containment here is the absent
 *    `body` column, not a type.
 */

import { isAdmissible } from '../../model/correspondence.ts'
import type { CorrespondenceMessage } from '../../model/correspondence.ts'
import type { ScopedClient } from '../../db/tenant-scope.ts'
import {
  isAdmissionRefusal,
  isAdmittedByKind,
  isCorrespondenceChannel,
  isDataClass,
  isMessageDirection,
  isMessageTrust,
  isThreadStatus,
} from './correspondence-vocabulary.ts'

/* ==================================================================== *
 * §1  THE ANSWERS
 *
 * ⚠️ `Record<string, unknown>`-SHAPED LITERALS AND NOT A HAND-WRITTEN MIRROR
 *    OF EVERY SCHEMA, FOR `exception-store.ts`'s REASON: `server/contract/`
 *    already makes the OpenAPI document the router and the validator, and a
 *    TypeScript restatement of `Thread` here would be a SECOND declaration of
 *    the response — §5.3, and the one nothing checks.
 * ==================================================================== */

/** What a row carried that the model cannot name. **Carries no cell value.** */
export interface CorrespondenceDefect {
  readonly table: string
  readonly column: string
  /** The row's own id. An id, never a cell. */
  readonly rowId: string
}

/**
 * A shaping result, TAGGED.
 *
 * ⚠️ AND THE TAG IS THE POINT. The first draft of this file returned
 * `Record<string, unknown> | CorrespondenceDefect` and told them apart by
 * sniffing for a `column` key — which is a structural test against a bag of
 * unknown keys, and **a row with a column literally named `column` would have
 * been silently reclassified as a defect**. A wire shape and a defect are
 * different kinds of answer and the type now says so.
 */
type Shaped<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly defect: CorrespondenceDefect }

export type ThreadPageRead =
  | {
      readonly kind: 'page'
      readonly items: readonly Record<string, unknown>[]
      readonly nextCursor: string | null
    }
  | { readonly kind: 'bad_cursor' }
  | { readonly kind: 'unpublishable'; readonly defect: CorrespondenceDefect }

export type ThreadRead =
  | { readonly kind: 'thread'; readonly thread: Record<string, unknown>; readonly messages: readonly Record<string, unknown>[] }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'unpublishable'; readonly defect: CorrespondenceDefect }

export type MessageRead =
  | { readonly kind: 'message'; readonly message: Record<string, unknown> }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'unpublishable'; readonly defect: CorrespondenceDefect }

/* ==================================================================== *
 * §2  THE CURSOR
 *
 * 🛑 ONE ORDERING, BECAUSE THE CONTRACT DECLARES ONE. `listThreads` has no
 *    `sort` parameter — unlike `listExceptions`, which has four — so the
 *    cursor does not have to name the ordering it was issued under and
 *    `exception-store.ts`'s whole §3 argument does not arise. It still names
 *    a `v`, so that the DAY somebody adds a second ordering, an old cursor is
 *    refused rather than silently applied to the wrong one.
 *
 * ⚠️ OPAQUE, NOT SECRET. *"A cursor a client can construct is a cursor a
 *    client can point at another tenant's ordering key."* It is base64url of
 *    JSON and anybody may decode it; what stops it reaching another tenant's
 *    rows is not the encoding but row-level security, which applies to the
 *    cursor's `WHERE` exactly as to every other.
 * ==================================================================== */

interface Keyset {
  /** The ordering this cursor was issued under. One value today. */
  readonly v: 'last_message_at_desc'
  /**
   * `last_message_at` **as PostgreSQL renders it**.
   *
   * 🛑 NOT `Date.toISOString()`, AND THE DIFFERENCE IS A WITNESSED RED IN THIS
   *    REPOSITORY RATHER THAN A PRECAUTION. `timestamptz` holds MICROSECONDS;
   *    a JavaScript `Date` holds MILLISECONDS. `exception-store.ts`'s
   *    `Keyset.raisedAt` records the failure in full: a stored
   *    `…:19.710164+00` became `…:19.710Z`, the keyset predicate asked for
   *    `= '…710Z' OR < '…710Z'` — **both false for every row** — page two came
   *    back EMPTY and `nextCursor` was `null`. **A register of six rows paged
   *    two and reported itself complete.** No error and no warning.
   *
   *    So the value is read as `last_message_at::text`, which PostgreSQL
   *    renders losslessly and parses back exactly under `::timestamptz`. **Do
   *    not "tidy" it into an ISO string** — the wire's `lastMessageAt` is a
   *    separate field and is allowed to be millisecond-precise, because
   *    `format: date-time` is a display contract and this is an ordering key.
   *
   *    `tests/db/correspondence.test.ts` §4 follows this plane's OWN
   *    `nextCursor` to exhaustion rather than building a cursor of its own,
   *    because **a test that builds its own cursor tests the DECODER and the
   *    defect was in the ENCODER.**
   */
  readonly lastMessageAt: string
  /** Always present. The primary key's own column, which makes the ordering total. */
  readonly id: string
}

export function encodeThreadCursor(k: Keyset): string {
  return Buffer.from(JSON.stringify(k), 'utf8').toString('base64url')
}

/** Decode, and REFUSE anything that is not exactly the shape this plane issues. */
export function decodeThreadCursor(cursor: string): Keyset | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  const k = parsed as Record<string, unknown>
  if (k['v'] !== 'last_message_at_desc') return null
  if (typeof k['id'] !== 'string' || k['id'] === '') return null
  if (typeof k['lastMessageAt'] !== 'string' || k['lastMessageAt'] === '') return null
  return { v: 'last_message_at_desc', lastMessageAt: k['lastMessageAt'], id: k['id'] }
}

/* ==================================================================== *
 * §3  THE ORDERING, AND ITS KEYSET PREDICATE
 *
 * 🛑 `DESC` ON A `NOT NULL` COLUMN, SO THERE IS NO `NULLS` QUESTION HERE.
 *    `last_message_at` is `NOT NULL` in the migration, which is why this file
 *    carries none of `exception-store.ts`'s `NULLS LAST` arm-by-arm
 *    machinery — that complexity exists because `value_at_risk_minor` is
 *    nullable, and inventing it here would be ceremony.
 *
 * ⚠️ WRITTEN OUT AND NOT AS A ROW COMPARISON. PostgreSQL's `(a, b) < (x, y)`
 *    would work on two `NOT NULL` columns, and it is still spelled out,
 *    because the two halves order in OPPOSITE directions — `last_message_at`
 *    DESC and `id` ASC — and a row comparison cannot express that at all. A
 *    reader who "simplified" it to `(last_message_at, id) < (…)` would get a
 *    predicate that silently skips rows at every tie.
 * ==================================================================== */

/**
 * 🛑 EVERY COLUMN IS QUALIFIED `t.`, AND IT IS A CORRECTNESS REQUIREMENT
 *    RATHER THAN A HOUSE STYLE. The queue statement `LEFT JOIN`s
 *    `tenant.counterparty c`, and **`counterparty` has an `id` column too** —
 *    so a bare `id` in the `ORDER BY` or in the keyset predicate is
 *    `ambiguous column reference "id"`, and a bare `id` that PostgreSQL
 *    happened to resolve to `c.id` would page the register by the
 *    COUNTERPARTY's key while looking exactly like a register paged by the
 *    thread's.
 */
const ORDER_BY = 't.last_message_at DESC, t.id ASC'

function keysetPredicate(after: Keyset, bind: (v: unknown) => string): string {
  const ts = `${bind(after.lastMessageAt)}::timestamptz`
  const id = bind(after.id)
  return `(t.last_message_at < ${ts} OR (t.last_message_at = ${ts} AND t.id > ${id}))`
}

/* ==================================================================== *
 * §4  THE THREAD QUEUE — `listThreads`
 * ==================================================================== */

export interface ThreadFilter {
  readonly exceptionId?: string
  readonly counterpartyId?: string
  readonly status?: readonly string[]
  readonly overdueOnly?: boolean
}

const THREAD_COLUMNS = `
  t.id, t.counterparty_id, t.subject, t.channel, t.status,
  t.opened_at, t.last_message_at, t.awaiting_step_id, t.await_deadline,
  c.display_name AS counterparty_name,
  -- 🛑 THE ORDERING KEY, LOSSLESS. See \`Keyset.lastMessageAt\` — a \`Date\` round
  -- trip drops microseconds and the keyset then matches NOTHING, which paged a
  -- six-row register as two and called it complete.
  t.last_message_at::text AS last_message_at_text`

interface ThreadRow {
  readonly id: string
  readonly counterparty_id: string
  readonly subject: string
  readonly channel: string
  readonly status: string
  readonly opened_at: Date
  readonly last_message_at: Date
  readonly last_message_at_text: string
  readonly awaiting_step_id: string | null
  readonly await_deadline: Date | null
  readonly counterparty_name: string | null
}

/**
 * The many-to-many, read in ONE statement for the whole page rather than one
 * per row.
 *
 * ⚠️ `= ANY($1)` AND NOT A LOOP, because a loop here is N+1 round trips inside
 *    the transaction the authorisation record was minted in — and that
 *    transaction is holding a pooled connection the whole time. At `limit=200`
 *    that is two hundred round trips to publish one page.
 */
async function exceptionIdsFor(
  tx: ScopedClient,
  threadIds: readonly string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  if (threadIds.length === 0) return out
  const rows = (
    await tx.query(
      `SELECT thread_id, exception_id
         FROM tenant.correspondence_thread_exception
        WHERE thread_id = ANY($1::text[])
        ORDER BY thread_id, exception_id`,
      [threadIds],
    )
  ).rows as unknown as { thread_id: string; exception_id: string }[]
  for (const row of rows) {
    const list = out.get(row.thread_id)
    if (list === undefined) out.set(row.thread_id, [row.exception_id])
    else list.push(row.exception_id)
  }
  return out
}

/**
 * Shape one row, or name the column that cannot be published.
 *
 * ⚠️ `counterpartyName` IS OMITTED RATHER THAN SET NULL WHEN THE JOIN FINDS
 *    NOTHING. It is not `required` on the wire, and the migration's FK makes
 *    the absence unreachable in practice — but `LEFT JOIN` is written anyway
 *    (see the statement below) so that a future migration relaxing that FK
 *    cannot silently drop every thread out of the page. `null` would claim
 *    *"this counterparty has no name"*; omission says *"this response does
 *    not carry one"*, which is the true statement and is
 *    `ExceptionQueueRow.hasProposal`'s precedent.
 */
function shapeThread(
  row: ThreadRow,
  exceptionIds: readonly string[],
): Shaped<Record<string, unknown>> {
  const bad = (column: string): Shaped<Record<string, unknown>> => ({
    ok: false,
    defect: { table: 'correspondence_thread', column, rowId: row.id },
  })
  if (!isCorrespondenceChannel(row.channel)) return bad('channel')
  if (!isThreadStatus(row.status)) return bad('status')

  return {
    ok: true,
    value: {
      threadId: row.id,
      counterpartyId: row.counterparty_id,
      ...(row.counterparty_name === null ? {} : { counterpartyName: row.counterparty_name }),
      /* 🛑 COUNTERPARTY-INFLUENCEABLE TEXT, PUT ON THE WIRE AS ITS EXACT BYTES.
         Invariant 6. Nothing above touched it and nothing below will. */
      subject: row.subject,
      channel: row.channel,
      exceptionIds,
      status: row.status,
      openedAt: row.opened_at.toISOString(),
      lastMessageAt: row.last_message_at.toISOString(),
      awaitingStepId: row.awaiting_step_id,
      awaitDeadline: row.await_deadline === null ? null : row.await_deadline.toISOString(),
    },
  }
}

export async function readThreadPage(
  tx: ScopedClient,
  filter: ThreadFilter,
  page: { readonly cursor: string | undefined; readonly limit: number },
): Promise<ThreadPageRead> {
  const after = page.cursor === undefined ? null : decodeThreadCursor(page.cursor)
  if (page.cursor !== undefined && after === null) return { kind: 'bad_cursor' }

  const values: unknown[] = []
  const bind = (value: unknown): string => {
    values.push(value)
    return `$${values.length}`
  }

  const where: string[] = []

  /**
   * 🛑 `EXISTS` AND NOT A JOIN, AND THE CONTRACT IS THE REASON RATHER THAN
   *    PERFORMANCE. *"Filtering by `exceptionId` therefore returns threads
   *    that also concern other exceptions, and that is correct — hiding the
   *    rest would hide the reason the vendor's answer is ambiguous."* A JOIN
   *    here would either duplicate a thread once per matching link or, with a
   *    `DISTINCT`, quietly change what the page's `exceptionIds` array
   *    contains. `EXISTS` filters the thread and leaves its full link set
   *    intact, which is the behaviour the contract describes.
   */
  if (filter.exceptionId !== undefined) {
    where.push(
      `EXISTS (SELECT 1 FROM tenant.correspondence_thread_exception x
                WHERE x.thread_id = t.id AND x.exception_id = ${bind(filter.exceptionId)})`,
    )
  }
  if (filter.counterpartyId !== undefined) {
    where.push(`t.counterparty_id = ${bind(filter.counterpartyId)}`)
  }
  if (filter.status !== undefined && filter.status.length > 0) {
    where.push(`t.status = ANY(${bind(filter.status)}::text[])`)
  }
  /**
   * ⚠️ `overdueOnly` READS `now()` IN THE DATABASE AND NOT IN NODE. The
   *    contract: *"Threads whose `awaitDeadline` has passed."* A clock read in
   *    the application and bound as a parameter would make the answer depend
   *    on the serving process's clock rather than on the one the column was
   *    written against — and on a plane with two tasks behind a load balancer
   *    the same request would then get two different pages.
   *
   * 🛑 A NULL DEADLINE IS NOT OVERDUE, AND SQL GIVES THAT FOR FREE:
   *    `NULL < now()` is NULL, so `WHERE` drops the row. A thread with no
   *    parked step has not timed out — it was never waiting. A hand-built
   *    matcher treating null as "no deadline, therefore expired" would reverse
   *    it, and would look reasonable while doing so.
   */
  if (filter.overdueOnly === true) {
    where.push('t.await_deadline < now()')
  }
  if (after !== null) {
    where.push(keysetPredicate(after, bind))
  }

  /* One more than asked for, so `nextCursor` STATES whether there is a next
     page rather than guessing. `runs.ts`: *"A `nextCursor` that is sometimes a
     lie is worse than no pagination at all."* */
  const sql =
    `SELECT ${THREAD_COLUMNS}
       FROM tenant.correspondence_thread t
       LEFT JOIN tenant.counterparty c ON c.id = t.counterparty_id` +
    (where.length === 0 ? '' : ` WHERE ${where.join(' AND ')}`) +
    ` ORDER BY ${ORDER_BY} LIMIT ${bind(page.limit + 1)}::int`

  const rows = (await tx.query(sql, values)).rows as unknown as ThreadRow[]
  const wanted = rows.slice(0, page.limit)

  const links = await exceptionIdsFor(
    tx,
    wanted.map((r) => r.id),
  )

  const items: Record<string, unknown>[] = []
  for (const row of wanted) {
    const shaped = shapeThread(row, links.get(row.id) ?? [])
    if (!shaped.ok) return { kind: 'unpublishable', defect: shaped.defect }
    items.push(shaped.value)
  }

  const last = wanted[wanted.length - 1]
  const nextCursor =
    rows.length > page.limit && last !== undefined
      ? encodeThreadCursor({
          v: 'last_message_at_desc',
          lastMessageAt: last.last_message_at_text,
          id: last.id,
        })
      : null

  return { kind: 'page', items, nextCursor }
}

/* ==================================================================== *
 * §5  THE MESSAGE — the envelope, and its evidence state
 *
 * 🛑 THREE STATES, DERIVED FROM THE PAIR AND NOT FROM A STORED STRING. The
 *    contract: *"THREE STATES, NOT TWO. Unadmitted is not a weaker form of
 *    refused and refused is not a slower form of unadmitted."*
 *    `model/correspondence.ts` derives them from
 *    `(admittedAsEvidenceAt, refusedFor)` — *"Both null means the decision is
 *    still pending"* — and `isAdmissible()` is the model's own function for
 *    the first half. It is CALLED here rather than restated, for the reason
 *    the model gives in its own voice: *"a call site that forgets it is the
 *    whole vulnerability."*
 *
 * ⚠️ A ROW CARRYING **BOTH** AN ADMISSION AND A REFUSAL IS UNPUBLISHABLE, NOT
 *    RESOLVED IN EITHER DIRECTION. There is no CHECK constraint (the migration
 *    argues why), so the shape is reachable from a hand-written row. Picking
 *    a winner would be inventing the answer to *"was this admitted?"* — which
 *    is the one question on this surface that must never be guessed. A 500
 *    naming the column is the honest answer, and it is the same call
 *    `exception-store.ts` makes for an unnameable `status`.
 * ==================================================================== */

const MESSAGE_COLUMNS = `
  id, thread_id, direction, channel, trust, at, body_ref, attachment_refs,
  data_class, admitted_as_evidence_at, admitted_by_kind,
  admitting_tool_scope_size, admission_seconded_by,
  refused_for, refused_at, refused_by`

interface MessageRow {
  readonly id: string
  readonly thread_id: string
  readonly direction: string
  readonly channel: string
  readonly trust: string
  readonly at: Date
  readonly body_ref: string
  readonly attachment_refs: string[]
  readonly data_class: string
  readonly admitted_as_evidence_at: Date | null
  readonly admitted_by_kind: string | null
  readonly admitting_tool_scope_size: number | null
  readonly admission_seconded_by: string | null
  readonly refused_for: string | null
  readonly refused_at: Date | null
  readonly refused_by: string | null
}

/**
 * `MessageEvidence` — the three-arm discriminated union, or the column that
 * cannot be published.
 *
 * 🛑 `mayCite` IS A CONSTANT PER ARM AND NOT A COMPUTATION, WHICH IS THE
 *    CONTRACT'S OWN DESIGN: *"`mayCite` is a CONSTANT per variant so that a
 *    schema-driven client cannot end up with a boolean whose value it forgot
 *    to read."* The schema pins each with `const`, so a wrong value here is a
 *    serialisation the contract itself contradicts.
 */
function shapeEvidence(row: MessageRow): Shaped<Record<string, unknown>> {
  const bad = (column: string): Shaped<Record<string, unknown>> => ({
    ok: false,
    defect: { table: 'correspondence_message', column, rowId: row.id },
  })
  const good = (value: Record<string, unknown>): Shaped<Record<string, unknown>> => ({
    ok: true,
    value,
  })

  if (row.admitted_as_evidence_at !== null && row.refused_for !== null) {
    /* See §5's header — both decided is not a decision. */
    return bad('admitted_as_evidence_at')
  }

  if (row.refused_for !== null) {
    if (!isAdmissionRefusal(row.refused_for)) return bad('refused_for')
    /* `EvidenceRefused` REQUIRES `refusedAt` and the model has no such field —
       the migration names that divergence. A refusal with no timestamp cannot
       be published as the contract declares it, so it is refused rather than
       back-dated to `at` or to `now()`, either of which would be this file
       inventing when a security decision was taken. */
    if (row.refused_at === null) return bad('refused_at')
    return good({
      state: 'refused',
      mayCite: false,
      refusedFor: row.refused_for,
      refusedAt: row.refused_at.toISOString(),
      refusedBy: row.refused_by,
    })
  }

  if (row.admitted_as_evidence_at !== null) {
    if (row.admitted_by_kind === null || !isAdmittedByKind(row.admitted_by_kind))
      return bad('admitted_by_kind')
    if (row.admitting_tool_scope_size === null) return bad('admitting_tool_scope_size')
    /**
     * 🛑 THE REFUSAL THE MIGRATION'S §4 ARGUES FOR. `attachmentDocumentIds` is
     *    REQUIRED in this variant and there is **no `document` table**, so an
     *    admitted message WITH attachments cannot be published truthfully.
     *    Emitting `[]` was the obvious alternative and it is the dangerous
     *    one: it would tell an operator that an admitted message had no
     *    attachments when it had two, and *"an attachment from a hostile
     *    sender enters extraction"* is the failure the whole admission
     *    checkpoint exists to prevent.
     */
    if (row.attachment_refs.length > 0) return bad('attachment_refs')
    return good({
      state: 'admitted',
      mayCite: true,
      admittedAsEvidenceAt: row.admitted_as_evidence_at.toISOString(),
      admittedBy: { kind: row.admitted_by_kind },
      admittingToolScopeSize: row.admitting_tool_scope_size,
      admissionSecondedBy: row.admission_seconded_by,
      attachmentDocumentIds: [],
    })
  }

  /**
   * ⚠️ `decidableBy` IS OMITTED, AND THE OMISSION IS A STATEMENT. It reports
   *    *"Whether the SESSION USER may take the decision, and why not where
   *    they may not"*, and answering it needs `CorrespondenceConfig`'s
   *    `capabilityToAdmit` CONJOINED with `orgClassesThatMayAdmit` CONJOINED
   *    with `secondPersonToAdmitAboveClass`. **There is no config table** —
   *    `grep -rn 'orgClassesThatMayAdmit' db/migrations/` → nothing — so every
   *    answer this file could give would be a guess about a security gate.
   *    The field is not `required`; omitting it renders the button's absence
   *    with no reason, which is worse UX and the only honest option. It lands
   *    with `decideAdmission`.
   */
  return good({
    state: 'not_evidence',
    mayCite: false,
    attachmentRefs: row.attachment_refs,
  })
}

function shapeMessage(row: MessageRow): Shaped<Record<string, unknown>> {
  const bad = (column: string): Shaped<Record<string, unknown>> => ({
    ok: false,
    defect: { table: 'correspondence_message', column, rowId: row.id },
  })

  if (!isMessageDirection(row.direction)) return bad('direction')
  if (!isCorrespondenceChannel(row.channel)) return bad('channel')
  /* 🛑 THE ONE AN AGENT PROMPT BRANCHES ON. See
     `correspondence-vocabulary.ts`'s header. */
  if (!isMessageTrust(row.trust)) return bad('trust')
  if (!isDataClass(row.data_class)) return bad('data_class')

  const shapedEvidence = shapeEvidence(row)
  if (!shapedEvidence.ok) return shapedEvidence
  const evidence = shapedEvidence.value

  /**
   * ⚠️ A CONSISTENCY CHECK AGAINST THE MODEL'S OWN FUNCTION, AND IT IS NOT
   *    REDUNDANT WITH `shapeEvidence()`. That function decides which ARM to
   *    publish; `isAdmissible()` decides whether the message MAY BE CITED, and
   *    the model declares it *"as a function rather than left to each call
   *    site, because 'has it been admitted' is the single check that separates
   *    reading a vendor email from obeying one."* Publishing a `mayCite` that
   *    disagreed with the model's own answer would put two authorities on the
   *    wire. Asserting the agreement here means the model is the one that
   *    decides and this file is the one that serialises.
   */
  const decision: Pick<CorrespondenceMessage, 'admittedAsEvidenceAt' | 'refusedFor'> = {
    admittedAsEvidenceAt:
      row.admitted_as_evidence_at === null
        ? null
        : (row.admitted_as_evidence_at.toISOString() as CorrespondenceMessage['admittedAsEvidenceAt']),
    refusedFor:
      row.refused_for === null ? null : (row.refused_for as CorrespondenceMessage['refusedFor']),
  }
  /* `isAdmissible()` reads exactly these two fields. The widening cast is
     narrow BY CONSTRUCTION — the `Pick` above is what the compiler checks and
     it is checked against the model's own interface, so a field renamed there
     is an error here. */
  const modelSaysCitable = isAdmissible(decision as CorrespondenceMessage)
  if (modelSaysCitable !== (evidence['mayCite'] === true)) return bad('admitted_as_evidence_at')

  return {
    ok: true,
    value: {
    messageId: row.id,
    threadId: row.thread_id,
    direction: row.direction,
    channel: row.channel,
    trust: row.trust,
    at: row.at.toISOString(),
    /* 🛑 A POINTER AND NOT A BODY. There is no body column;
       `db/migrations/0022_correspondence.sql` argues why at length. */
    bodyRef: row.body_ref,
    dataClass: row.data_class,
    evidence,
    /* ⚠️ `disclosure` AND `redactedPaths` ARE OMITTED, NOT NULLED. Neither has
       a column — G472 — because a `DisclosureRecord` is written BECAUSE a
       disclosure happened and nothing here sends. Neither is `required`, so
       absence is expressible; `null` would claim *"nothing was disclosed"*
       where the truth is *"this database cannot say"*. */
    },
  }
}

/* ==================================================================== *
 * §6  THE TWO INSTANCE READS
 * ==================================================================== */

/**
 * `getThread` — *"the thread with its messages in order"*.
 *
 * ⚠️ TWO STATEMENTS AND NOT A JOIN, deliberately. A join would return the
 *    thread's columns once per message and the shaping code would have to
 *    de-duplicate them — which is where a subject line gets read off whichever
 *    row happened to sort first. Two statements inside one transaction see one
 *    snapshot, so there is no consistency cost to pay for the clarity.
 */
export async function readThread(tx: ScopedClient, threadId: string): Promise<ThreadRead> {
  const rows = (
    await tx.query(
      `SELECT ${THREAD_COLUMNS}
         FROM tenant.correspondence_thread t
         LEFT JOIN tenant.counterparty c ON c.id = t.counterparty_id
        WHERE t.id = $1`,
      [threadId],
    )
  ).rows as unknown as ThreadRow[]

  const row = rows[0]
  if (row === undefined) return { kind: 'not_found' }

  const links = await exceptionIdsFor(tx, [row.id])
  const thread = shapeThread(row, links.get(row.id) ?? [])
  if (!thread.ok) return { kind: 'unpublishable', defect: thread.defect }

  const messageRows = (
    await tx.query(
      `SELECT ${MESSAGE_COLUMNS} FROM tenant.correspondence_message
        WHERE thread_id = $1 ORDER BY at ASC, id ASC`,
      [threadId],
    )
  ).rows as unknown as MessageRow[]

  const messages: Record<string, unknown>[] = []
  for (const messageRow of messageRows) {
    const shaped = shapeMessage(messageRow)
    if (!shaped.ok) return { kind: 'unpublishable', defect: shaped.defect }
    messages.push(shaped.value)
  }

  return { kind: 'thread', thread: thread.value, messages }
}

/**
 * `getMessage` — one message, *"and precisely what it is allowed to be used
 * for"*.
 *
 * 🛑 NO THREAD ID IS TAKEN AND NONE IS CHECKED, WHICH IS THE CONTRACT'S OWN
 *    ROUTE SHAPE: `/messages/{messageId}` is not nested under a thread.
 *    A message is reachable by its own id and row-level security is what
 *    bounds it to the tenant — exactly as `getException` is. A `thread_id`
 *    predicate here would be a second authorisation path, which is the shape
 *    invariant 1's note in this file's header refuses.
 */
export async function readMessage(tx: ScopedClient, messageId: string): Promise<MessageRead> {
  const rows = (
    await tx.query(`SELECT ${MESSAGE_COLUMNS} FROM tenant.correspondence_message WHERE id = $1`, [
      messageId,
    ])
  ).rows as unknown as MessageRow[]

  const row = rows[0]
  if (row === undefined) return { kind: 'not_found' }

  const shaped = shapeMessage(row)
  if (!shaped.ok) return { kind: 'unpublishable', defect: shaped.defect }
  return { kind: 'message', message: shaped.value }
}
