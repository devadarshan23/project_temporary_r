/**
 * THE EXCEPTION REGISTER, READ AND ASSIGNED — the bodies of C6's four mounted
 * operations, minus their routes. G357/G358/G359, 19 Sep 2026.
 *
 * `server/data-plane/exceptions.ts` is the route and nothing else, exactly as
 * `run-account.ts` is the route over `run-account-store.ts`. Every question
 * about what a column HOLDS is settled in
 * `db/migrations/0015_exception_register.sql`; every question about what a
 * VALUE may be is settled in `server/data-plane/exception-vocabulary.ts`, which
 * derives it from `model/`; and no route is written here.
 *
 * ┌─ §0 · WHAT THIS FILE WILL NOT DO, STATED BEFORE WHAT IT DOES ──────────────┐
 * │                                                                            │
 * │ 🛑 IT WRITES NO TENANT PREDICATE, EVER. Invariant 1: *"Tenant scope is      │
 * │    derived from the session, never read from a request."* Every query       │
 * │    below runs inside the `ScopedClient` the mint opened, and row-level      │
 * │    security supplies `tenant_id = current_setting('app.tenant_id')`. There  │
 * │    is no `tenant_id` parameter in any statement in this file and there      │
 * │    must never be one — `tests/db/exception-register.test.ts` §1 asserts     │
 * │    the absence by scanning the SQL, the way                                 │
 * │    `tests/db/tenant-isolation.test.ts` does, because *"a handler that       │
 * │    filtered in TypeScript would have two paths and one of them would        │
 * │    eventually grow a different message."*                                   │
 * │                                                                            │
 * │ 🛑 IT REFUSES; IT NEVER REPAIRS. A stored value the model cannot name is    │
 * │    an `ExceptionDefect` and a 500, never a coerced default. The register    │
 * │    is the surface a period is closed on: a fabricated `severity` would      │
 * │    reorder a queue and look exactly like a correct one.                     │
 * │                                                                            │
 * │ 🛑 IT FABRICATES NO EMPTY CHANNEL. `reversals: []` is read from             │
 * │    `tenant.exception_reversal` and not assumed, for `0007`'s reason at the  │
 * │    grain where it is least visible: `[]` means *the register holds no       │
 * │    reversal for this finding*, and a handler that hard-coded it would       │
 * │    report a clean history for a row whose reversals it never looked for.    │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ INVARIANT 6 PASSES THROUGH THIS FILE AND IS NOT ENFORCED BY IT.
 *    *"Ingested content is data, never instruction."* `explanation_summary`,
 *    `explanation_expected`, `scalar_text` and a reversal `note` are
 *    counterparty- or operator-authored strings and they are published
 *    VERBATIM. Nothing here sanitises them, because a sanitiser at a read
 *    boundary is a second place the rule lives and the wrong one — the rule
 *    binds where the value is USED (a prompt, a tool call, a rendered page).
 *    What this file does hold is the narrower half: no string it reads is ever
 *    interpolated into SQL. Derive it — every statement below is parameterised
 *    and the only interpolated fragments are chosen from closed sets by
 *    `exception-vocabulary.ts`'s guards.
 *
 * ⚠️ AND DO NOT CITE `AssertNoTextDeep` ABOUT ANYTHING HERE. It *"BANS THE TYPE
 *    `string` AT A PROPERTY POSITION"*, and an `Explanation` is two strings and
 *    an array of counterparty scalars — so `AssertNoTextDeep<Explanation>` is a
 *    COMPILE ERROR by construction, the same shape `HeldRead` has. That is the
 *    proof biting, not an oversight, and it means the guard says nothing at all
 *    about this surface.
 */

import { holdsLiveMembership } from '../../model/access.ts'
import { reversalIndictsAutonomy } from '../../model/domain.ts'
import { formatMinorUnits, parseMinorUnits } from '../../model/money.ts'
import { parseFieldPath } from '../../model/field-path.ts'
import type { FieldSegment } from '../../model/kernel.ts'
import type { ScopedClient } from '../../db/tenant-scope.ts'
import { readMemberships } from './identity.ts'
import {
  isDataClass,
  isDeltaKind,
  isDomainKey,
  isExceptionStatus,
  isObservedScalarKind,
  isResolutionMode,
  isReversalReason,
  isSeverity,
  type ExceptionSort,
} from './exception-vocabulary.ts'
import { formerMemberSql } from './former-member.ts'

/* ==================================================================== *
 * §1  THE WIRE SHAPES
 *
 * ⚠️ `Record<string, unknown>`-SHAPED LITERALS AND NOT A HAND-WRITTEN MIRROR OF
 *    EVERY SCHEMA, FOR `run-account-store.ts`'s REASON: `server/contract/`
 *    already makes the OpenAPI document the router and the validator, and a
 *    TypeScript restatement of `Exception` here would be a SECOND declaration
 *    of the response — §5.3, and the one nothing checks. The types that ARE
 *    named are the model's, which is where they are checked.
 * ==================================================================== */

/** What a row carried that the model cannot name. **Carries no cell value.** */
export interface ExceptionDefect {
  readonly table: string
  readonly column: string
  readonly exceptionId: string
}

export type ExceptionRead =
  | { readonly kind: 'not_found' }
  | { readonly kind: 'exception'; readonly exception: Record<string, unknown> }
  | { readonly kind: 'unpublishable'; readonly defect: ExceptionDefect }

export type QueueRead =
  | {
      readonly kind: 'page'
      readonly items: readonly Record<string, unknown>[]
      readonly nextCursor: string | null
      readonly estimatedTotal: number | null
    }
  | { readonly kind: 'bad_cursor' }
  | { readonly kind: 'unpublishable'; readonly defect: ExceptionDefect }

export type FacetRead =
  | { readonly kind: 'facets'; readonly facets: Record<string, unknown> }
  | { readonly kind: 'unpublishable'; readonly defect: ExceptionDefect }

/* ==================================================================== *
 * §2  THE CODECS — money and paths, through the one seam each
 * ==================================================================== */

/**
 * An `int8` column, out of `pg`'s string and back to one — THROUGH THE CODEC.
 * G111/G286: `model/money.ts` is the only thing in this repository permitted to
 * convert, and a `Number()` here would put the 2^53 ceiling back at the read
 * surface that G286 was taken to lift.
 *
 * `null` in, `null` out; a malformed or out-of-range value answers `'refused'`,
 * which the caller turns into an `ExceptionDefect`.
 */
function minorIn(value: unknown): string | null | 'refused' {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return 'refused'
  const parsed = parseMinorUnits(value)
  return parsed.ok ? formatMinorUnits(parsed.value) : 'refused'
}

/**
 * The three `Money` columns, whole or absent. The migration's
 * `*_whole` CHECK constraints make the mixed case unwritable, so reaching the
 * `'refused'` arm here means either the constraint was dropped or the amount
 * itself is unparseable — both of which are defects rather than empty answers.
 */
function moneyIn(
  currency: string | null,
  minor: unknown,
  exponent: number | null,
): Record<string, unknown> | null | 'refused' {
  if (currency === null && minor === null && exponent === null) return null
  if (currency === null || exponent === null) return 'refused'
  const amountMinor = minorIn(minor)
  if (amountMinor === 'refused' || amountMinor === null) return 'refused'
  return { currency, amountMinor, exponent }
}

/**
 * A stored `FieldPath` back through the ONE seam, and out in the WIRE form the
 * contract declares. `parseFieldPath()` is *"the only mint in the repository"*,
 * so a stored path that is not a token list is REFUSED here rather than cast
 * into one. NOTHING HERE SPLITS A STRING.
 *
 * 🛑 THE STORED FORM AND THE WIRE FORM ARE DIFFERENT AND THIS FUNCTION IS THE
 *    CONVERSION. READ THIS BEFORE "SIMPLIFYING" IT TO A `.map()`.
 *
 *      STORED  a JSON array of STRINGS AND NUMBERS — `["invoice","total"]` —
 *              which is what `parseFieldPath()` accepts and what
 *              `db/migrations/0015`'s `path jsonb` column holds. *"That is the
 *              entire encoding and there is nothing in it to escape."*
 *      WIRE    `capability.openapi.yaml`'s `FieldPath`: an array of
 *              `FieldSegment` OBJECTS — `[{"kind":"key","key":"invoice"}, …]`
 *              — a `oneOf` discriminated on `kind`.
 *
 *    `parsed.path` is ALREADY the wire shape, because `model/kernel.ts`'s
 *    `FieldSegment` is declared as exactly that union. So the conversion is to
 *    return it unchanged, and the mistake is to flatten it.
 *
 * ⚠️ AND THE FIRST DRAFT OF THIS FILE MADE THAT MISTAKE, COPYING
 *    `run-account-store.ts`'s `pathTokens()` — which flattens to raw tokens —
 *    and it was a 500 rather than a wrong body, because `fast-json-stringify`
 *    could not match a bare string against either `oneOf` arm:
 *
 *        data-plane: unhandled failure TypeError:
 *        The value of '#/$defs/FieldSegment' does not match schema definition.
 *
 * 🛑 WHICH MEANS `listRunResidue` HAS THE SAME DEFECT AND IT IS NOT FIXED HERE.
 *    `run-account-store.ts` §5 publishes `heldReads[].path` through
 *    `pathTokens()`, and `HeldRead.path` on the wire is `$ref FieldPath` — the
 *    object form. **Every HTTP fixture in `tests/http/run-account-served.test.ts`
 *    carries `heldReads: []`**, so the arm has never been serialised over a
 *    socket and the defect has never fired. Derive it:
 *    `grep -c 'heldReads: \[\]' tests/http/run-account-served.test.ts` → 3.
 *    It is named rather than fixed because it is another wave's file and
 *    another wave's test to extend; a fix here would change `listRunResidue`'s
 *    published shape with no assertion in this commit covering it.
 *
 * ✅ AND IT IS FIXED SINCE 1 Oct 2026 — G2375 DISCHARGED, G2471. The paragraph
 *    above is kept because it was true and named the defect a month before it
 *    was recorded as a G row. `run-account-store.ts`'s `pathIn()` now returns
 *    `parsed.path` exactly as this one does, for all four channels it publishes,
 *    and `tests/http/run-path-wire-served.test.ts` persists a held read, a
 *    refused item and an ambiguity and asserts the segment objects over a
 *    socket. ⚠️ THIS FUNCTION AND THAT ONE ARE NOW TWO COPIES OF ONE SEAM
 *    (§5.3); folding them is a separate cleanup, G2473, not taken here.
 */
function pathIn(value: unknown): readonly FieldSegment[] | null {
  const parsed = parseFieldPath(value)
  return parsed.ok ? parsed.path : null
}

/* ==================================================================== *
 * §3  THE CURSOR — a KEYSET, and it carries its own ordering
 *
 * 🛑 THE CURSOR NAMES THE SORT IT WAS ISSUED UNDER, AND A CURSOR PRESENTED
 *    AGAINST A DIFFERENT SORT IS REFUSED RATHER THAN HONOURED.
 *
 * A keyset cursor is a POSITION IN AN ORDERING. Page one under
 * `severity_then_value` ends at `(rank 1, 90000, exc_x)`; feeding that tuple to
 * `raised_at_desc` asks *"everything raised before exc_x"* against a column the
 * tuple says nothing about. The page that comes back is not empty and is not
 * wrong-looking — **it silently skips every exception between the two
 * orderings**, and the operator reading the queue has no way to see it. A
 * register that omits rows while looking complete is the failure
 * `frontend/src/api/runs.ts` names for a fabricated `nextCursor`, one layer
 * down.
 *
 * ⚠️ OPAQUE, NOT SECRET, AND THE CONTRACT'S SENTENCE MEANS THE FIRST. *"A
 *    cursor a client can construct is a cursor a client can point at another
 *    tenant's ordering key."* It is base64url of JSON and anybody may decode
 *    it; what stops it reaching another tenant's rows is not the encoding but
 *    row-level security, which applies to the cursor's `WHERE` exactly as to
 *    every other. The encoding buys one thing — a client cannot build one by
 *    accident and then depend on the shape — and claiming it buys secrecy
 *    would be an assertion nothing here supports.
 * ==================================================================== */

interface Keyset {
  readonly sort: ExceptionSort
  /** `severity_rank`, present only for `severity_then_value`. */
  readonly rank: number | null
  /** `value_at_risk_minor` as a decimal string, or null for an unvalued row. */
  readonly minor: string | null
  /**
   * `raised_at` **as PostgreSQL renders it**, present only for the two time
   * orderings.
   *
   * 🛑 NOT `Date.toISOString()`, AND THE DIFFERENCE IS A WITNESSED RED RATHER
   *    THAN A PRECAUTION. `timestamptz` holds MICROSECONDS; a JavaScript
   *    `Date` holds MILLISECONDS. The first draft of this file built the
   *    cursor from `row.raised_at.toISOString()`, so a stored
   *    `…:19.710164+00` became `…:19.710Z` and the keyset predicate asked for
   *    `raised_at = '…710Z' OR raised_at < '…710Z'` — **both false for every
   *    row**, because `.710164` is neither equal to nor less than `.710`.
   *
   *    The failure mode is the one that matters: page one returned, page two
   *    came back EMPTY, and `nextCursor` was `null`. **A register of six rows
   *    paged two and reported itself complete.** No error, no warning — the
   *    exact shape `frontend/src/api/runs.ts` names for a fabricated
   *    `nextCursor`: *"an arbitrary prefix of a tenant's runs WHILE LOOKING
   *    COMPLETE."* Caught by `tests/db/exception-register.test.ts` §7, which
   *    exists to page every ordering to exhaustion for this reason.
   *
   *    So the value is read as `raised_at::text`, which PostgreSQL renders
   *    losslessly and parses back exactly under `::timestamptz`. **Do not
   *    "tidy" it into an ISO string** — the wire's `raisedAt` is a separate
   *    field and is allowed to be millisecond-precise, because `format:
   *    date-time` is a display contract and this is an ordering key.
   */
  readonly raisedAt: string | null
  /** Always present. The primary key's own column, which makes every ordering total. */
  readonly id: string
}

export function encodeExceptionCursor(k: Keyset): string {
  return Buffer.from(JSON.stringify(k), 'utf8').toString('base64url')
}

/**
 * Decode, and REFUSE anything that is not exactly the shape this plane issues.
 * A cursor whose `sort` disagrees with the request's is refused here, which is
 * the check the whole §3 header is about.
 */
export function decodeExceptionCursor(cursor: string, sort: ExceptionSort): Keyset | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  const k = parsed as Record<string, unknown>
  if (k['sort'] !== sort) return null
  if (typeof k['id'] !== 'string' || k['id'] === '') return null
  const rank = k['rank']
  const minor = k['minor']
  const raisedAt = k['raisedAt']
  if (rank !== null && !(typeof rank === 'number' && Number.isSafeInteger(rank))) return null
  if (minor !== null && typeof minor !== 'string') return null
  if (typeof minor === 'string' && !parseMinorUnits(minor).ok) return null
  if (raisedAt !== null && typeof raisedAt !== 'string') return null
  return {
    sort,
    rank: rank as number | null,
    minor: minor as string | null,
    raisedAt: raisedAt as string | null,
    id: k['id'],
  }
}

/* ==================================================================== *
 * §4  THE ORDERINGS — four, closed, each with an index behind it
 *
 * ⚠️ THE ONLY SQL FRAGMENTS IN THIS FILE THAT ARE NOT PARAMETERS ARE CHOSEN
 *    HERE, AND THEY ARE CHOSEN FROM A CLOSED SET BY A NARROWED TYPE. A
 *    `sort=<column>` parameter interpolated into an `ORDER BY` is the shape
 *    that puts a caller's string into a query; the contract closes the set for
 *    a different reason — *"an arbitrary `sort` parameter is how a queue
 *    acquires a sort nobody indexed"* — and closing it answers both.
 *
 * 🛑 `DESC NULLS LAST` IS SPELLED OUT AND MATCHES THE INDEX. PostgreSQL's
 *    default for `DESC` is `NULLS FIRST`, which would put every NON-MONETARY
 *    finding above every valued one in a queue sorted by value at risk. The
 *    migration's indexes spell it the same way and the two must agree.
 *
 * ⚠️ A VALUE ORDERING ACROSS CURRENCIES IS WRONG AND IT IS THE CONTRACT'S OWN
 *    DECLARED SORT. 1000 JPY (exponent 0) and 10.00 SGD (exponent 2) are both
 *    `1000` minor units and this orders them equal. The contract refuses a bare
 *    value THRESHOLD for exactly that reason — `valueAtRiskAtLeastMinor`
 *    *"REQUIRES A CURRENCY"* — and then declares `value_at_risk_desc` with no
 *    currency at all. **The filter is guarded and the sort is not.** Named here
 *    and in the migration; closing it is a contract change and is not this
 *    file's to take.
 * ==================================================================== */

const ORDER_BY: Readonly<Record<ExceptionSort, string>> = {
  severity_then_value: 'severity_rank ASC, value_at_risk_minor DESC NULLS LAST, id ASC',
  value_at_risk_desc: 'value_at_risk_minor DESC NULLS LAST, id ASC',
  raised_at_desc: 'raised_at DESC, id ASC',
  raised_at_asc: 'raised_at ASC, id ASC',
}

/**
 * The keyset predicate for one ordering, as SQL plus its bind values.
 *
 * 🛑 THE `NULLS LAST` HALF IS WRITTEN OUT ARM BY ARM AND IS NOT A ROW
 *    COMPARISON. PostgreSQL's `(a, b) < (x, y)` is elegant and it does not
 *    express `NULLS LAST` — a NULL operand makes the whole comparison NULL, so
 *    every unvalued row drops out of every page after the first. The rows that
 *    would vanish are precisely the NON-MONETARY findings, which is the half of
 *    the register a KYC or medical-records tenant has most of.
 */
function keysetPredicate(
  sort: ExceptionSort,
  after: Keyset,
  bind: (value: unknown) => string,
): string {
  const id = bind(after.id)

  /* `value DESC NULLS LAST` then `id ASC`, from a position that may itself be
     on a NULL. Read the two arms as: "a smaller value, or the same value and a
     later id, or any unvalued row" — and, from an unvalued position, only a
     later unvalued row. */
  const byValue = (): string => {
    if (after.minor === null) {
      return `(value_at_risk_minor IS NULL AND id > ${id})`
    }
    const m = bind(after.minor)
    return (
      `(value_at_risk_minor IS NULL` +
      ` OR value_at_risk_minor < ${m}::int8` +
      ` OR (value_at_risk_minor = ${m}::int8 AND id > ${id}))`
    )
  }

  const byTime = (direction: '<' | '>'): string => {
    const t = bind(after.raisedAt)
    return `(raised_at ${direction} ${t}::timestamptz OR (raised_at = ${t}::timestamptz AND id > ${id}))`
  }

  if (sort === 'severity_then_value') {
    const r = bind(after.rank)
    return `(severity_rank > ${r}::int OR (severity_rank = ${r}::int AND ${byValue()}))`
  }
  if (sort === 'value_at_risk_desc') return byValue()
  if (sort === 'raised_at_desc') return byTime('<')
  return byTime('>')
}

/* ==================================================================== *
 * §5  THE QUEUE — `listExceptions`'s body, minus the route
 * ==================================================================== */

export interface QueueFilter {
  readonly domain?: readonly string[]
  readonly definitionId?: readonly string[]
  readonly ruleLabel?: readonly string[]
  readonly severity?: readonly string[]
  readonly status?: readonly string[]
  readonly assignedTo?: string
  readonly unassignedOnly?: boolean
  /**
   * G3424 — *"open rows that need ME"*: the row is unassigned OR assigned to
   * this user. 🛑 THE VALUE IS THE ACTING PERSON'S OWN USER ID AND IS SUPPLIED
   * BY THE ROUTE FROM `ctx.principal`, NEVER FROM THE REQUEST — the wire carries
   * a boolean (`mineOrUnassigned`), so a caller cannot ask "what needs Mei" by
   * naming Mei. An OR of the two existing filters, which neither expresses.
   */
  readonly mineOrUnassignedFor?: string
  readonly valueAtRiskAtLeastMinor?: string
  readonly currency?: string
  readonly raisedFrom?: string
  readonly raisedTo?: string
  readonly carriedForwardOnly?: boolean
  /**
   * G3622 — the run that raised the row, `db/migrations/0480`. A row whose
   * `run_id` is NULL (stored before the column existed) matches no run.
   */
  readonly runId?: readonly string[]
  /**
   * G3622 — G954 answered: the period of the run that raised the row, reached
   * through `run_id` → `public.run.period_id` and never copied onto the row.
   */
  readonly periodId?: readonly string[]
}

/**
 * THE RUN AND PERIOD TERMS — G3622, ONE SPELLING FOR THE QUEUE AND THE FACETS
 * (§5.3), so a count beside a register is a count OF that register.
 *
 * 🛑 `period` IS A SUBQUERY OVER `public.run`, NOT A COLUMN ON THE EXCEPTION.
 *    A copied `period_id` would be a second spelling of a run's fact, free to
 *    disagree with it. The subquery names no tenant: `run`'s policy narrows it
 *    to the scope's tenant (invariant 1), and `0480`'s composite foreign key
 *    makes a row's `run_id` a run of its OWN tenant anyway.
 * ⚠️ A NULL `run_id` FAILS BOTH TERMS BY SQL's OWN THREE-VALUED LOGIC — `NULL =
 *    ANY(…)` and `NULL IN (…)` are NULL and `WHERE` drops the row — which is
 *    `0480` §1's *outside the question*. Written down so nobody adds
 *    `OR run_id IS NULL` to be helpful.
 */
export function runScopeTerms(
  scope: { readonly runId?: readonly string[]; readonly periodId?: readonly string[] },
  bind: (value: unknown) => string,
): string[] {
  const terms: string[] = []
  if (scope.runId !== undefined && scope.runId.length > 0) {
    terms.push(`run_id = ANY(${bind(scope.runId)}::text[])`)
  }
  if (scope.periodId !== undefined && scope.periodId.length > 0) {
    terms.push(`run_id IN (SELECT r.id FROM public.run r WHERE r.period_id = ANY(${bind(scope.periodId)}::text[]))`)
  }
  return terms
}

const QUEUE_COLUMNS = `
  id, domain, definition_id, rule_label, severity, severity_rank,
  value_at_risk_currency, value_at_risk_minor, value_at_risk_exponent,
  cost_centre, legal_entity, status, assigned_to, raised_at,
  -- G3886 — the assignee's name, through \`0520\`'s co-member view and NOTHING
  -- wider: NULL when the assignee is not a live co-member of the reader (or
  -- the reader is not a member at all). A scalar subquery, so no FROM clause
  -- and no keyset predicate below learns a second relation.
  (SELECT n.display_name FROM tenant.co_member_name n WHERE n.user_id = assigned_to) AS assigned_to_name,
  -- G4021 — whether the assignee is a FORMER member (lapsed), off
  -- \`tenant.membership\` alone; never a name. See \`former-member.ts\`.
  ${formerMemberSql('assigned_to')} AS assigned_to_former_member,
  explanation_summary, carried_forward_from,
  -- G3622 — the run that raised the row (\`0480\`); NULL = not recorded.
  run_id,
  -- G3542 — the row's money variance, off the delta columns the detail read
  -- already publishes. \`delta_fx_from\` is read only to REFUSE a converted one.
  delta_kind, delta_money_currency, delta_money_minor, delta_money_exponent, delta_fx_from,
  -- G3803 — the money delta's direction (\`0510\`); NULL = zero or not recorded.
  delta_money_direction,
  -- 🛑 THE ORDERING KEY, LOSSLESS. See \`Keyset.raisedAt\` — a \`Date\` round trip
  -- drops microseconds and the keyset then matches NOTHING, which paged a
  -- six-row register as two and called it complete.
  raised_at::text AS raised_at_text`

interface QueueRow {
  readonly id: string
  readonly domain: string
  readonly definition_id: string
  readonly rule_label: string
  readonly severity: string
  readonly severity_rank: number
  readonly value_at_risk_currency: string | null
  readonly value_at_risk_minor: unknown
  readonly value_at_risk_exponent: number | null
  readonly cost_centre: string | null
  readonly legal_entity: string | null
  readonly status: string
  readonly assigned_to: string | null
  /** G3886 — `0520`'s co-member name; verbatim, parsed by nothing (D6-9). */
  readonly assigned_to_name: string | null
  /** G4021 — `former-member.ts`; true iff a lapsed member, never a name. */
  readonly assigned_to_former_member: boolean
  readonly raised_at: Date
  readonly raised_at_text: string
  /**
   * 🛑 `| null` SINCE `db/migrations/0161` — R-D, THE OWNER'S RULING OF
   * 20 Sep 2026: *"NOBODY authors an exception's explanation … the sentence is
   * composed where it is displayed."* The column was `NOT NULL` from `0015`
   * until then, and **the `NOT NULL` was the whole of what guaranteed this
   * reader had a string to publish.**
   *
   * ⚠️ TYPING IT `string` AFTER THE WIDENING WOULD HAVE BEEN THE WORST
   * AVAILABLE OUTCOME, because nothing would have failed: `pg` hands back
   * `null`, `tsc` believes the interface, and `fast-json-stringify`
   * **serialises without validating**, so `"summary": null` ships against a
   * `required` string and the client crashes far from the row. The `| null` is
   * what makes the refusal below a compile-time obligation rather than a thing
   * somebody remembered.
   */
  readonly explanation_summary: string | null
  readonly carried_forward_from: string | null
  readonly run_id: string | null
  readonly delta_kind: string | null
  readonly delta_money_currency: string | null
  readonly delta_money_minor: unknown
  readonly delta_money_exponent: number | null
  readonly delta_fx_from: string | null
  readonly delta_money_direction: string | null
}

/**
 * The stored direction, through the model's two words — G3803. `null` is the
 * zero magnitude or a row stored before `0510`; an unknown word is `'refused'`
 * (`0510` carries no vocabulary `CHECK`, so this is where it is refused).
 */
function directionIn(raw: string | null): 'over' | 'under' | null | 'refused' {
  if (raw === null) return null
  return raw === 'over' || raw === 'under' ? raw : 'refused'
}

/**
 * THE REGISTER'S VARIANCE CELL — G3542, 3 Oct 2026.
 *
 * The SAME stored value `shapeDelta()` publishes as `Explanation.delta.absolute`
 * on the detail read, through the same `moneyIn()` codec seam, so the two
 * reads cannot disagree about a line's variance.
 *
 * 🛑 A DELTA TAKEN ACROSS CURRENCIES IS REFUSED (`null`), NOT PUBLISHED: it
 *    carries an FX conversion (`delta_fx_from` set), there is no FX on this
 *    path, and the register TOTALS this column. The detail read still shows it,
 *    beside the rate it used. A money delta with its own columns broken is a
 *    DEFECT (`'refused'`), never a quiet `null`.
 */
function varianceOf(row: QueueRow): Record<string, unknown> | null | 'refused' {
  if (row.delta_kind !== 'money') return null
  const absolute = moneyIn(row.delta_money_currency, row.delta_money_minor, row.delta_money_exponent)
  if (absolute === 'refused' || absolute === null) return 'refused'
  const direction = directionIn(row.delta_money_direction)
  if (direction === 'refused') return 'refused'
  if (row.delta_fx_from !== null) return null
  /* 🛑 SIGNED SINCE 4 Oct 2026 — G3804, the owner's C3-02 ruling: *"the column
     shows sign"*. `under` negates the magnitude. A NON-ZERO magnitude with no
     recorded direction (a row stored before `0510`) is NOT signed by guess: it
     publishes `null`, the "nothing to show" answer, because the client totals
     this column and a guessed `+` is the exact defect C3-02 reported. */
  const minor = absolute['amountMinor'] as string
  if (direction === null) return minor === '0' ? absolute : null
  return direction === 'under' ? { ...absolute, amountMinor: minor === '0' ? '0' : `-${minor}` } : absolute
}

export async function readExceptionQueuePage(
  tx: ScopedClient,
  filter: QueueFilter,
  page: { readonly cursor: string | undefined; readonly limit: number; readonly sort: ExceptionSort },
): Promise<QueueRead> {
  const after = page.cursor === undefined ? null : decodeExceptionCursor(page.cursor, page.sort)
  if (page.cursor !== undefined && after === null) return { kind: 'bad_cursor' }

  const values: unknown[] = []
  const bind = (value: unknown): string => {
    values.push(value)
    return `$${values.length}`
  }

  const where: string[] = []

  /* Every one of these reads a DENORMALISED column, which is the whole reason
     those columns exist — see the migration's §1 and the contract's own note
     at `listExceptions`. An `= ANY($n)` rather than an `IN (…)` list, so the
     number of binds does not grow with the filter and a caller cannot make the
     statement text vary. */
  if (filter.domain !== undefined && filter.domain.length > 0) {
    where.push(`domain = ANY(${bind(filter.domain)}::text[])`)
  }
  if (filter.definitionId !== undefined && filter.definitionId.length > 0) {
    where.push(`definition_id = ANY(${bind(filter.definitionId)}::text[])`)
  }
  if (filter.ruleLabel !== undefined && filter.ruleLabel.length > 0) {
    where.push(`rule_label = ANY(${bind(filter.ruleLabel)}::text[])`)
  }
  /* 🛑 FILTERS ON `severity_rank`? NO — ON `severity`, AND THE CONTRACT SAYS
     "Filters on `severityRank`, not on the string." BOTH ARE TRUE AND THE
     DIFFERENCE IS THE SORT. The contract's sentence is about ORDERING, which
     is `severity_rank`'s job; membership is an equality on a closed set of
     four and the string is the value a caller sends. Mapping the string to a
     rank here would need a SECOND copy of the severity→rank table, which the
     model does not publish and which would be the third place to drift. */
  if (filter.severity !== undefined && filter.severity.length > 0) {
    where.push(`severity = ANY(${bind(filter.severity)}::text[])`)
  }
  if (filter.status !== undefined && filter.status.length > 0) {
    where.push(`status = ANY(${bind(filter.status)}::text[])`)
  }
  if (filter.assignedTo !== undefined) {
    where.push(`assigned_to = ${bind(filter.assignedTo)}`)
  }
  if (filter.unassignedOnly === true) {
    where.push('assigned_to IS NULL')
  }
  if (filter.mineOrUnassignedFor !== undefined) {
    where.push(`(assigned_to IS NULL OR assigned_to = ${bind(filter.mineOrUnassignedFor)})`)
  }
  if (filter.valueAtRiskAtLeastMinor !== undefined && filter.currency !== undefined) {
    /* 🛑 THE CURRENCY BOTH ACCOMPANIES THE THRESHOLD AND SCOPES IT, AND THAT
       IS A DECISION RATHER THAN A READING. The contract requires a currency
       and says why — *"A bare number threshold across mixed currencies
       reproduces that defect in the filter instead of the rule"* — and a
       currency that were merely carried alongside would reproduce it anyway.
       So the predicate is `currency = $c AND minor >= $m`.

       ⚠️ AND THE EXPONENT IS NOT COMPARED, WHICH IS A HOLE THIS FILE CANNOT
       CLOSE. Two rows in the same currency with different exponents are
       compared as bare minor units. Within one ISO 4217 code that should not
       happen; nothing in `db/` enforces it, and `G97`'s own sentence applies —
       *"the database enforces no id format"* — so this is named rather than
       claimed.

       ⚠️ ROWS WITH NO VALUE ARE EXCLUDED BY THE PREDICATE ITSELF (a NULL
       comparison is NULL and `WHERE` drops the row), which is the contract's
       stated behaviour: *"a non-monetary finding is not below the threshold,
       it is outside the question."* It is worth writing down that the
       exclusion is SQL's and not a branch here, because a later reader adding
       `OR value_at_risk_minor IS NULL` to "be helpful" would reverse it. */
    where.push(`value_at_risk_currency = ${bind(filter.currency)}`)
    where.push(`value_at_risk_minor >= ${bind(filter.valueAtRiskAtLeastMinor)}::int8`)
  }
  if (filter.raisedFrom !== undefined) {
    where.push(`raised_at >= ${bind(filter.raisedFrom)}::timestamptz`)
  }
  if (filter.raisedTo !== undefined) {
    where.push(`raised_at <= ${bind(filter.raisedTo)}::timestamptz`)
  }
  if (filter.carriedForwardOnly === true) {
    where.push('carried_forward_from IS NOT NULL')
  }
  where.push(...runScopeTerms(filter, bind))
  if (after !== null) {
    where.push(keysetPredicate(page.sort, after, bind))
  }

  /* One more than asked for, so `nextCursor` STATES whether there is a next
     page rather than guessing. `runs.ts`: *"A `nextCursor` that is sometimes a
     lie is worse than no pagination at all."* */
  const sql =
    `SELECT ${QUEUE_COLUMNS} FROM tenant.exception` +
    (where.length === 0 ? '' : ` WHERE ${where.join(' AND ')}`) +
    ` ORDER BY ${ORDER_BY[page.sort]} LIMIT ${bind(page.limit + 1)}::int`

  const rows = (await tx.query(sql, values)).rows as unknown as QueueRow[]
  const wanted = rows.slice(0, page.limit)

  const bad = (column: string, exceptionId: string): QueueRead => ({
    kind: 'unpublishable',
    defect: { table: 'exception', column, exceptionId },
  })

  const items: Record<string, unknown>[] = []
  for (const row of wanted) {
    if (!isDomainKey(row.domain)) return bad('domain', row.id)
    if (!isSeverity(row.severity)) return bad('severity', row.id)
    if (!isExceptionStatus(row.status)) return bad('status', row.id)
    /* 🛑 THE RENDERER'S CONTRACT, AND IT IS `db/migrations/0161`'s OTHER HALF.
       R-D widened the column; this is what stands where the `NOT NULL` stood.
       ⚠️ **A DEFAULT STRING HERE — "no explanation recorded" — WOULD SATISFY
       THE WIRE AND WOULD BE THIS REPOSITORY AUTHORING AN EXPLANATION**, which
       is the one act the ruling forbids, arriving through the reader instead
       of through the writer. The sentence is composed where it is DISPLAYED;
       a row with no facts to compose one from is unpublishable HERE.
       ✅ G3748 (4 Oct 2026): THE REFUSAL ABOVE IS RETIRED AND THE ARGUMENT IN
       IT IS KEPT, BECAUSE ITS FIRST HALF STILL GOVERNS — NO DEFAULT STRING IS
       MINTED. What changed is the WIRE: `summary` is `[string, 'null']`, so a
       null is published AS null and the display composes from the row's typed
       facts. Refusing it would have been a whole-page 500 the moment the engine
       raised its first exception (`0500` §2 makes every engine row null). */

    const valueAtRisk = moneyIn(
      row.value_at_risk_currency,
      row.value_at_risk_minor,
      row.value_at_risk_exponent,
    )
    if (valueAtRisk === 'refused') return bad('value_at_risk_minor', row.id)
    const variance = varianceOf(row)
    if (variance === 'refused') return bad('delta_money_minor', row.id)

    /* ⚠️ `hasProposal` AND `awaitingReply` ARE OPTIONAL ON THE WIRE AND ARE
       OMITTED RATHER THAN SET FALSE. There is no `proposal` table and no
       `thread` table, so `false` would be a claim this database cannot
       support — *"no disposition is proposed"* rather than *"nobody has asked
       whether one is"*. `ExceptionQueueRow` lists neither as `required`
       precisely so an absence is expressible. `definitionName` is omitted for
       the same reason: there is no `definition` table to name one from. */
    items.push({
      exceptionId: row.id,
      domain: row.domain,
      definitionId: row.definition_id,
      ruleLabel: row.rule_label,
      severity: row.severity,
      severityRank: row.severity_rank,
      valueAtRisk,
      costCentre: row.cost_centre,
      legalEntity: row.legal_entity,
      status: row.status,
      assignedTo: row.assigned_to,
      assignedToName: row.assigned_to_name,
      assignedToFormerMember: row.assigned_to_former_member,
      raisedAt: row.raised_at.toISOString(),
      summary: row.explanation_summary,
      carriedForwardFrom: row.carried_forward_from,
      runId: row.run_id,
      variance,
    })
  }

  const last = wanted[wanted.length - 1]
  const nextCursor =
    rows.length > page.limit && last !== undefined
      ? encodeExceptionCursor({
          sort: page.sort,
          rank: page.sort === 'severity_then_value' ? last.severity_rank : null,
          minor: typeof last.value_at_risk_minor === 'string' ? last.value_at_risk_minor : null,
          raisedAt:
            page.sort === 'raised_at_desc' || page.sort === 'raised_at_asc'
              ? last.raised_at_text
              : null,
          id: last.id,
        })
      : null

  /**
   * 🛑 `estimatedTotal` IS ALWAYS `null` AND THE CONTRACT ADMITS THAT ANSWER IN
   *    ITS OWN WORDS: *"APPROXIMATE, and null when it cannot be estimated
   *    cheaply."* It cannot be, here, and the reason is not laziness:
   *
   *      · An EXACT count is *"a scan on every keystroke of a filter"*, which
   *        is the thing the whole denormalised-column design exists to avoid.
   *      · The cheap estimate — `EXPLAIN`'s row estimate, or `reltuples` — is
   *        computed against the table, and a ROW-LEVEL-SECURITY predicate is
   *        applied on top of it. So the estimate counts rows THIS SESSION
   *        CANNOT SEE, and on a shared database the number it produces is
   *        larger than the truth by however many other tenants there are.
   *        **A count that overstates what a caller may see is the one
   *        direction that must not be guessed**, and it would look entirely
   *        plausible.
   *
   *    A `null` renders as "about — ", which the contract's own
   *    `type: [integer,'null']` was written to allow. Closing it needs a
   *    per-tenant maintained counter, which is a writer this schema has no
   *    grant for.
   */
  return { kind: 'page', items, nextCursor, estimatedTotal: null }
}

/* ==================================================================== *
 * §6  THE FACETS — `getExceptionFacets`'s body, minus the route
 *
 * *"A client must not hardcode the rule labels or definitions a tenant happens
 * to have. They come from installed packs and from tenant authoring, and they
 * change when a pack version rolls out."*
 *
 * ⚠️ FOUR GROUP-BYs AND NOT ONE `GROUPING SETS`. The four are independent
 *    single-column aggregates over the same filtered set; `GROUPING SETS`
 *    would return them interleaved with NULL discriminators and the shaping
 *    code to unpick that is where an off-by-one facet count would hide. Four
 *    small statements that each say what they are beat one clever one.
 *
 * 🛑 *"Counts respect the caller's scope, and therefore differ between users. A
 *    facet count is not a tenant statistic."* Here the scope is exactly
 *    row-level security's — there is no assignment-scope narrowing anywhere on
 *    this plane, because `Decision.scope` is `DENY_ALL` (G303) and a reader
 *    that applied it would return nothing at all. So today a facet count is
 *    the TENANT's count, which is what the sentence says it must not be
 *    presented as. Named, not glossed: the sentence becomes true when G303's
 *    columns land, and until then two users of one tenant see identical
 *    facets.
 * ==================================================================== */

const FACET_COLUMNS = ['domain', 'definition_id', 'rule_label', 'severity'] as const

/**
 * G3424 — the facets take the SAME narrowing terms `listExceptions` does, so a
 * count beside a register is a count OF that register. Until 3 Oct 2026 the
 * facets took `status` alone, so the Close screen's *"N of M need you"* counted
 * every open row in the tenant — rows assigned to somebody else, and rows of
 * reconciliations the screen was not showing (RC-03). The terms are the queue's
 * own (`definitionId`, `assignedTo`, `unassignedOnly`, and the caller-keyed
 * `mineOrUnassignedFor`) rather than a new vocabulary, because two filter
 * languages over one table is the drift §5.3 names.
 */
export interface FacetScope {
  readonly definitionId?: readonly string[]
  readonly assignedTo?: string
  readonly unassignedOnly?: boolean
  readonly mineOrUnassignedFor?: string
  /** G3622 — the queue's own run and period terms, through `runScopeTerms()`. */
  readonly runId?: readonly string[]
  readonly periodId?: readonly string[]
}

export async function readExceptionFacets(
  tx: ScopedClient,
  statuses: readonly string[] | undefined,
  scope: FacetScope = {},
): Promise<FacetRead> {
  const values: unknown[] = []
  const bind = (value: unknown): string => {
    values.push(value)
    return `$${values.length}`
  }
  const terms: string[] = []
  if (statuses !== undefined && statuses.length > 0) terms.push(`status = ANY(${bind(statuses)}::text[])`)
  if (scope.definitionId !== undefined && scope.definitionId.length > 0) {
    terms.push(`definition_id = ANY(${bind(scope.definitionId)}::text[])`)
  }
  if (scope.assignedTo !== undefined) terms.push(`assigned_to = ${bind(scope.assignedTo)}`)
  if (scope.unassignedOnly === true) terms.push('assigned_to IS NULL')
  if (scope.mineOrUnassignedFor !== undefined) {
    terms.push(`(assigned_to IS NULL OR assigned_to = ${bind(scope.mineOrUnassignedFor)})`)
  }
  terms.push(...runScopeTerms(scope, bind))
  const where = terms.length === 0 ? '' : ` WHERE ${terms.join(' AND ')}`

  const out: Record<string, Record<string, unknown>[]> = {}
  for (const column of FACET_COLUMNS) {
    /* The column name is one of four literals in a `const` tuple, never a
       caller's string. The narrowing that matters for a caller-supplied sort
       (§4) is not needed here because no caller chooses a facet. */
    const rows = (
      await tx.query(
        `SELECT ${column} AS value, count(*)::int AS n FROM tenant.exception${where}` +
          ` GROUP BY ${column} ORDER BY n DESC, ${column} ASC`,
        values,
      )
    ).rows as unknown as { value: string; n: number }[]

    out[column] = rows.map((r) => ({
      value: r.value,
      /**
       * ⚠️ `label` IS THE VALUE, AND THAT IS A STATEMENT ABOUT WHAT THIS
       *    DATABASE HOLDS RATHER THAN A PLACEHOLDER. `FacetCount` carries a
       *    display label, and a label for a `definition_id` would come from a
       *    `definition` row — there is no such table. Inventing one here (title
       *    case, underscores to spaces) would be this plane deciding what a
       *    customer's rule is called, which is the *"opaque customer text"*
       *    rule `model/kernel.ts` states for a cost centre. A client that
       *    renders the id is showing the truth; a client shown a prettified id
       *    would believe a name had been configured.
       */
      label: r.value,
      count: r.n,
    }))
  }

  /* Narrowed AFTER the group-by rather than before: an out-of-vocabulary value
     must be a 500 and not a silently dropped facet, because a dropped facet is
     a filter option that vanishes and takes its rows out of the operator's
     reach without saying so. */
  for (const row of out['domain'] ?? []) {
    if (typeof row['value'] !== 'string' || !isDomainKey(row['value'])) {
      return { kind: 'unpublishable', defect: { table: 'exception', column: 'domain', exceptionId: '' } }
    }
  }
  for (const row of out['severity'] ?? []) {
    if (typeof row['value'] !== 'string' || !isSeverity(row['value'])) {
      return { kind: 'unpublishable', defect: { table: 'exception', column: 'severity', exceptionId: '' } }
    }
  }

  return {
    kind: 'facets',
    facets: {
      domains: out['domain'] ?? [],
      definitions: out['definition_id'] ?? [],
      ruleLabels: out['rule_label'] ?? [],
      severities: out['severity'] ?? [],
    },
  }
}

/* ==================================================================== *
 * §7  ONE EXCEPTION — `getException`'s body, minus the route
 *
 * 🛑 THREE STATEMENTS AND NOT ONE JOIN. An `Exception` carries two arrays and a
 *    join would return the cartesian product of them — three observed values
 *    and two reversals is six rows, and the de-duplication in application code
 *    is where a lost reversal would hide. `run-account-store.ts` §5 reads its
 *    held reads the same way and for the same reason.
 * ==================================================================== */

interface DetailRow extends QueueRow {
  readonly match_group_id: string
  readonly rule_id: string
  readonly rule_version: number
  readonly definition_version: number
  readonly line_key: string | null
  readonly explanation_expected: string
  readonly explanation_confidence: number | null
  readonly delta_kind: string | null
  readonly delta_percentage: number | null
  readonly delta_numeric_absolute: number | null
  readonly delta_money_currency: string | null
  readonly delta_money_minor: unknown
  readonly delta_money_exponent: number | null
  readonly delta_fx_from: string | null
  readonly delta_fx_to: string | null
  readonly delta_fx_rate: number | null
  readonly delta_fx_as_at: Date | null
  readonly delta_fx_source: string | null
  readonly delta_temporal_days: number | null
  readonly delta_textual_similarity: number | null
  readonly resolution_mode: string | null
  readonly resolution_disposition_key: string | null
  readonly resolution_proposal_id: string | null
  readonly resolution_authorised_by_policy_id: string | null
  readonly resolution_authorised_by_policy_version: number | null
  readonly resolution_decided_by: string | null
  readonly resolution_at: Date | null
}

const DETAIL_COLUMNS = `${QUEUE_COLUMNS},
  match_group_id, rule_id, rule_version, definition_version, line_key,
  explanation_expected, explanation_confidence,
  -- delta_kind, delta_money_* and delta_fx_from are in QUEUE_COLUMNS (G3542).
  delta_percentage, delta_numeric_absolute,
  delta_fx_to, delta_fx_rate, delta_fx_as_at, delta_fx_source,
  delta_temporal_days, delta_textual_similarity,
  resolution_mode, resolution_disposition_key, resolution_proposal_id,
  resolution_authorised_by_policy_id, resolution_authorised_by_policy_version,
  resolution_decided_by, resolution_at`

export async function readException(tx: ScopedClient, exceptionId: string): Promise<ExceptionRead> {
  /**
   * 🛑 NO TENANT PREDICATE, AND THE 404 IS ONE ANSWER TO TWO QUESTIONS.
   * `capability.openapi.yaml`'s `NotFound` is returned *"identically for a row
   * that does not exist and for a row in another tenant"*, because
   * distinguishing them makes this an existence oracle across the tenant
   * boundary. Both arrive here as the same empty result set from row-level
   * security, so there is no branch to get wrong — `runs.ts`: *"a handler that
   * filtered in TypeScript would have two paths and one of them would
   * eventually grow a different message."*
   */
  const rows = (
    await tx.query(`SELECT ${DETAIL_COLUMNS} FROM tenant.exception WHERE id = $1`, [exceptionId])
  ).rows as unknown as DetailRow[]
  const row = rows[0]
  if (row === undefined) return { kind: 'not_found' }

  return shapeException(tx, row)
}

async function shapeException(tx: ScopedClient, row: DetailRow): Promise<ExceptionRead> {
  const bad = (column: string): ExceptionRead => ({
    kind: 'unpublishable',
    defect: { table: 'exception', column, exceptionId: row.id },
  })

  if (!isDomainKey(row.domain)) return bad('domain')
  if (!isSeverity(row.severity)) return bad('severity')
  if (!isExceptionStatus(row.status)) return bad('status')
  /* `db/migrations/0161` — R-D. The same refusal the queue read makes, on the
     surface that publishes `Explanation` whole. **Both, or the fence has a
     door**: `getException` and `listExceptions` are two operations and a row
     refused by one and published by the other is a difference nobody chose.
     ✅ G3748 — retired on BOTH surfaces, in one commit, for that reason: the
     wire admits `null` and both publish it as `null`. */

  const valueAtRisk = moneyIn(
    row.value_at_risk_currency,
    row.value_at_risk_minor,
    row.value_at_risk_exponent,
  )
  if (valueAtRisk === 'refused') return bad('value_at_risk_minor')

  const delta = shapeDelta(row)
  if (delta === 'refused') return bad('delta_kind')

  const resolution = shapeResolution(row)
  if (resolution === 'refused') return bad('resolution_mode')

  const observed = await readObservedValues(tx, row.id)
  if (typeof observed === 'string') {
    return { kind: 'unpublishable', defect: { table: 'exception_observed_value', column: observed, exceptionId: row.id } }
  }

  const reversals = await readReversals(tx, row.id)
  if (typeof reversals === 'string') {
    return { kind: 'unpublishable', defect: { table: 'exception_reversal', column: reversals, exceptionId: row.id } }
  }

  /* ⚠️ `lineKey` AND `carriedForwardFrom` ARE ALWAYS PRESENT, INCLUDING AS
     `null`. Both are `type: [string,'null']` on the wire and NOT in `required`,
     so an absence and a null are both legal — and they mean different things
     to a client that checks `'lineKey' in exception`. A stored NULL is a
     positive fact (this rule is not line-scoped) and is published as one. */
  return {
    kind: 'exception',
    exception: {
      exceptionId: row.id,
      matchGroupId: row.match_group_id,
      ruleId: row.rule_id,
      ruleVersion: row.rule_version,
      definitionVersion: row.definition_version,
      lineKey: row.line_key,
      carriedForwardFrom: row.carried_forward_from,
      /* G3622 — always present, `null` when not recorded (`0480` §1). */
      runId: row.run_id,
      severity: row.severity,
      severityRank: row.severity_rank,
      /* 🛑 DIRECTIONAL, AND THE CLIENT MUST NOT RENDER IT SYMMETRICALLY.
         `expected` is drawn from the REFERENCE SLOT and `observed[]` are the
         comparands — *"the invoice disagrees with the purchase order", never
         the reverse* — and *"a client rendering these symmetrically throws away
         the only thing that makes the sentence mean something."* */
      explanation: {
        summary: row.explanation_summary,
        observed,
        expected: row.explanation_expected,
        delta,
        /* ⚠️ EXPOSED HERE AND ON NO OTHER OPERATION. Absent from
           `ExceptionQueueRow`, from every filter and from every sort, because
           *"a number you can sort a list by is a ranking signal"* that invites
           bulk approval, and the same number beside the evidence it was
           computed over is provenance. NULL MEANS NOT APPLICABLE, NEVER
           UNKNOWN. */
        confidence: row.explanation_confidence,
      },
      domain: row.domain,
      definitionId: row.definition_id,
      ruleLabel: row.rule_label,
      valueAtRisk,
      costCentre: row.cost_centre,
      legalEntity: row.legal_entity,
      status: row.status,
      assignedTo: row.assigned_to,
      assignedToName: row.assigned_to_name,
      assignedToFormerMember: row.assigned_to_former_member,
      raisedAt: row.raised_at.toISOString(),
      resolution,
      reversals,
    },
  }
}

/** `Delta | null`, out of the column-per-arm decomposition. */
function shapeDelta(row: DetailRow): Record<string, unknown> | null | 'refused' {
  if (row.delta_kind === null) return null
  if (!isDeltaKind(row.delta_kind)) return 'refused'

  if (row.delta_kind === 'numeric') {
    if (row.delta_numeric_absolute === null) return 'refused'
    return { kind: 'numeric', absolute: row.delta_numeric_absolute, percentage: row.delta_percentage }
  }
  if (row.delta_kind === 'money') {
    const absolute = moneyIn(row.delta_money_currency, row.delta_money_minor, row.delta_money_exponent)
    if (absolute === 'refused' || absolute === null) return 'refused'
    const direction = directionIn(row.delta_money_direction)
    if (direction === 'refused') return 'refused'
    /* `FxConversion | null` — all five or none. *"Named so a disputed
       conversion is traceable to a source."* */
    const fx =
      row.delta_fx_from === null
        ? null
        : row.delta_fx_to === null ||
            row.delta_fx_rate === null ||
            row.delta_fx_as_at === null ||
            row.delta_fx_source === null
          ? 'refused'
          : {
              from: row.delta_fx_from,
              to: row.delta_fx_to,
              rate: row.delta_fx_rate,
              asAt: row.delta_fx_as_at.toISOString(),
              source: row.delta_fx_source,
            }
    if (fx === 'refused') return 'refused'
    /* G3803 — `absolute` stays the MAGNITUDE; `direction` is the sign (`0510`). */
    return { kind: 'money', absolute, direction, percentage: row.delta_percentage, fx }
  }
  if (row.delta_kind === 'temporal') {
    if (row.delta_temporal_days === null) return 'refused'
    return { kind: 'temporal', days: row.delta_temporal_days }
  }
  if (row.delta_textual_similarity === null) return 'refused'
  return { kind: 'textual', similarity: row.delta_textual_similarity }
}

/**
 * `ExceptionResolution | null`, in the FLAT wire shape.
 *
 * ⚠️ THE MODEL'S IS A DISCRIMINATED UNION AND THE WIRE'S IS NOT, AND THIS
 *    FUNCTION PUBLISHES THE WIRE'S. `db/migrations/0015_exception_register.sql`
 *    records the divergence at length — three model fields (`approvedBy[]`,
 *    `executedBy`, `policyEvaluationId`) have no wire field and therefore no
 *    column. **Do not "fix" it by inventing one here**: a handler emitting a
 *    field the response schema does not declare is a field
 *    `fast-json-stringify` silently drops, so the fix would be invisible and
 *    would read as done.
 */
function shapeResolution(row: DetailRow): Record<string, unknown> | null | 'refused' {
  if (row.resolution_mode === null) return null
  if (!isResolutionMode(row.resolution_mode)) return 'refused'
  if (
    row.resolution_disposition_key === null ||
    row.resolution_proposal_id === null ||
    row.resolution_at === null
  ) {
    return 'refused'
  }
  return {
    dispositionKey: row.resolution_disposition_key,
    proposalId: row.resolution_proposal_id,
    mode: row.resolution_mode,
    authorisedByPolicyId: row.resolution_authorised_by_policy_id,
    authorisedByPolicyVersion: row.resolution_authorised_by_policy_version,
    decidedBy: row.resolution_decided_by,
    at: row.resolution_at.toISOString(),
  }
}

/** `ObservedValue[]`, ordered. Returns the offending column name on a defect. */
async function readObservedValues(
  tx: ScopedClient,
  exceptionId: string,
): Promise<Record<string, unknown>[] | string> {
  const rows = (
    await tx.query(
      `SELECT ordinal, slot, path, line_index, source_document_id,
              scalar_kind, scalar_text, scalar_number, scalar_date,
              scalar_money_currency, scalar_money_minor, scalar_money_exponent,
              provenance_page, provenance_box_x, provenance_box_y,
              provenance_box_width, provenance_box_height, provenance_confidence,
              data_class
         FROM tenant.exception_observed_value
        WHERE exception_id = $1
        ORDER BY ordinal`,
      [exceptionId],
    )
  ).rows as unknown as ObservedRow[]

  const out: Record<string, unknown>[] = []
  for (const row of rows) {
    const path = pathIn(row.path)
    if (path === null) return 'path'
    if (!isObservedScalarKind(row.scalar_kind)) return 'scalar_kind'
    if (!isDataClass(row.data_class)) return 'data_class'

    const scalar = shapeScalar(row)
    if (scalar === 'refused') return 'scalar_kind'

    out.push({
      slot: row.slot,
      path,
      scalar,
      lineIndex: row.line_index,
      sourceDocumentId: row.source_document_id,
      provenance: {
        page: row.provenance_page,
        boundingBox:
          row.provenance_box_x === null
            ? null
            : {
                x: row.provenance_box_x,
                y: row.provenance_box_y,
                width: row.provenance_box_width,
                height: row.provenance_box_height,
              },
        confidence: row.provenance_confidence,
      },
      dataClass: row.data_class,
    })
  }
  return out
}

interface ObservedRow {
  readonly ordinal: number
  readonly slot: string
  readonly path: unknown
  readonly line_index: number | null
  readonly source_document_id: string
  readonly scalar_kind: string
  readonly scalar_text: string | null
  readonly scalar_number: number | null
  readonly scalar_date: string | null
  readonly scalar_money_currency: string | null
  readonly scalar_money_minor: unknown
  readonly scalar_money_exponent: number | null
  readonly provenance_page: number | null
  readonly provenance_box_x: number | null
  readonly provenance_box_y: number | null
  readonly provenance_box_width: number | null
  readonly provenance_box_height: number | null
  readonly provenance_confidence: number | null
  readonly data_class: string
}

/** `ExtractedScalar`, out of the column-per-arm decomposition. Six arms. */
function shapeScalar(row: ObservedRow): Record<string, unknown> | 'refused' {
  if (row.scalar_kind === 'absent') return { kind: 'absent' }
  if (row.scalar_kind === 'text' || row.scalar_kind === 'identifier') {
    /* 🛑 COUNTERPARTY TEXT, PUBLISHED VERBATIM. Invariant 6 — data, never
       instruction — and the rule binds where the value is USED. */
    if (row.scalar_text === null) return 'refused'
    return { kind: row.scalar_kind, value: row.scalar_text }
  }
  if (row.scalar_kind === 'number') {
    if (row.scalar_number === null) return 'refused'
    return { kind: 'number', value: row.scalar_number }
  }
  if (row.scalar_kind === 'date') {
    if (row.scalar_date === null) return 'refused'
    return { kind: 'date', value: row.scalar_date }
  }
  const money = moneyIn(row.scalar_money_currency, row.scalar_money_minor, row.scalar_money_exponent)
  if (money === 'refused' || money === null) return 'refused'
  return { kind: 'money', value: money }
}

/** `ExceptionReversal[]`, ordered. Returns the offending column name on a defect. */
async function readReversals(
  tx: ScopedClient,
  exceptionId: string,
): Promise<Record<string, unknown>[] | string> {
  const rows = (
    await tx.query(
      `SELECT ordinal, at, reversed_by, reason, note, new_status, corrected_disposition_key
         FROM tenant.exception_reversal
        WHERE exception_id = $1
        ORDER BY ordinal`,
      [exceptionId],
    )
  ).rows as unknown as {
    ordinal: number
    at: Date
    reversed_by: string
    reason: string
    note: string | null
    new_status: string
    corrected_disposition_key: string | null
  }[]

  const out: Record<string, unknown>[] = []
  for (const row of rows) {
    if (!isReversalReason(row.reason)) return 'reason'
    if (!isExceptionStatus(row.new_status)) return 'new_status'
    out.push({
      at: row.at.toISOString(),
      reversedBy: row.reversed_by,
      reason: row.reason,
      /**
       * 🛑 COMPUTED BY THE MODEL'S OWN FUNCTION, NOT READ FROM A COLUMN AND NOT
       *    RESTATED HERE. `reversalIndictsAutonomy()` is *"a function rather
       *    than a comment, because every call site that computes a reversal
       *    rate must agree — and one that quietly counts all reversals will
       *    drive autonomy to `none` across the fleet and look like evidence
       *    while doing it."* A `Record<ReversalReason, boolean>` in
       *    `exception-vocabulary.ts` would have been the second call site that
       *    sentence exists to prevent; the contract's own note says the same —
       *    *"Returned rather than left to each client to recompute."*
       */
      indictsAutonomy: reversalIndictsAutonomy(row.reason),
      note: row.note,
      newStatus: row.new_status,
      correctedDispositionKey: row.corrected_disposition_key,
    })
  }
  return out
}

/* ==================================================================== *
 * §8  THE ASSIGNMENT — `assignException`'s body, minus the route
 *
 * 🛑 THIS IS THE ONLY WRITE ON A REQUEST PATH IN THE WHOLE REGISTER, AND THE
 *    PRIVILEGE BEHIND IT IS COLUMN-LEVEL. G358:
 *    `GRANT UPDATE (assigned_to) ON tenant.exception`. The statement below
 *    could name any column and the DATABASE would refuse every other one —
 *    which is the point of taking the narrow grant rather than the wide one.
 *    `tests/db/exception-register.test.ts` §2 witnesses both directions.
 *
 * ⚠️ IT IS A PUT AND IT REPLACES. *"A PUT rather than a PATCH because the field
 *    has exactly two states and an idempotent replace is the honest verb.
 *    Assigning to null unassigns."* So `assignedTo: null` is a VALUE and not an
 *    omission, and the route reads it as one.
 *
 * 🛑 ASSIGNMENT IS NOT ACCESS, AND THE ASSIGNEE IS NOT VALIDATED. *"A user who
 *    cannot read the exception cannot be assigned it, and being assigned grants
 *    nothing that policy did not already allow — the field is a work-queue
 *    affordance, not an authorisation."* Validating the id against
 *    `tenant."user"` is IMPOSSIBLE on this plane and the reason is a measured
 *    property of `0009` rather than a preference: that table's policy keys on
 *    the SESSION, so the app role can see exactly one user row — its own. A
 *    check here would refuse every assignment except self-assignment, which is
 *    a work-queue nobody can operate. **The honest statement is that this
 *    stores an opaque string, and it is safe BECAUSE the field confers
 *    nothing.**
 * ==================================================================== */

export async function assignExceptionTo(
  tx: ScopedClient,
  exceptionId: string,
  assignedTo: string | null,
): Promise<ExceptionRead> {
  /* `RETURNING` rather than a second `SELECT`: one statement, so the row that
     is published is the row that was written, with nothing in between. */
  const updated = (
    await tx.query('UPDATE tenant.exception SET assigned_to = $2 WHERE id = $1 RETURNING id', [
      exceptionId,
      assignedTo,
    ])
  ).rows as unknown as { id: string }[]

  /* Zero rows is the 404, and it is again one answer to two questions — no such
     row, or a row row-level security made invisible. The `WHERE` carries no
     tenant predicate, so there is no second path here either. */
  if (updated[0] === undefined) return { kind: 'not_found' }

  /* The contract's 200 body is the whole `Exception`, so the detail read runs
     inside the same transaction — the caller sees the state it just wrote and
     nothing committed between. */
  return readException(tx, exceptionId)
}

/* ==================================================================== *
 * §8a  THE ASSIGNEE IS A MEMBER — G3426, 3 Oct 2026. DERIVED, NOT THE OWNER'S.
 *
 * 🛑 THE LIVE DEFECT THIS ANSWERS: the plane stored the literal string `me`
 *    in `tenant.exception.assigned_to` (RC-14, measured in SQL on a seeded
 *    plane). The client sent `'me'` and §8 above stores *"an opaque string"*,
 *    so a row was "assigned" to nobody who exists — and every later reader
 *    (the Close screen's *"with you"*, a needs-you count keyed on the caller's
 *    id) silently disagreed with it.
 *
 * ⚠️ §8's REFUSAL TO VALIDATE WAS RIGHT ABOUT `tenant."user"` AND IS NOT
 *    OVERTURNED: that table's policy keys on the SESSION, so the app role sees
 *    one user row — its own. **`tenant.membership` is the other half of the
 *    asymmetry `tests/db/administrative-reach.test.ts` measures: it IS
 *    tenant-scoped, so a tenant can read WHO BELONGS.** So the assignee is
 *    checked against a LIVE membership of the acting tenant, through the ONE
 *    liveness predicate (`holdsLiveMembership()`, G641) and the ONE read
 *    (`readMemberships()`), rather than a fourth spelling of either.
 *
 * ⚠️ ASSIGNMENT IS STILL NOT ACCESS. This check refuses a string that names
 *    nobody in this tenant; it confers nothing and it does not ask whether the
 *    assignee holds `view_exception`, because §8's quote still holds: *"being
 *    assigned grants nothing that policy did not already allow"*. A 422 —
 *    `validation_failed`, declared on the operation in the same commit — and
 *    never a 404, because the exception's visibility is a different question
 *    from the assignee's existence.
 * ==================================================================== */

export async function assigneeIsLiveMember(
  tx: ScopedClient,
  tenantId: string,
  userId: string,
  now: string,
): Promise<boolean> {
  const memberships = await readMemberships(tx, userId)
  return holdsLiveMembership({
    memberships,
    userId: userId as never,
    tenantId: tenantId as never,
    now: now as never,
  })
}
