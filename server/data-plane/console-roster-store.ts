/**
 * THE TENANCY ROSTER, READ BY THE PLANE THAT SERVES THE CONSOLES — and the
 * ONE place `TenantSummary.stage` comes from.
 *
 * **G1241 (20 Sep 2026), THE OWNER'S RULING**, quoted because a paraphrased
 * ruling is a changed ruling:
 *
 *     "Onboarding state lives in a table in the CONTROL database, one row per
 *      tenant, beside the roster — and `stage` is DERIVED at read time from
 *      the stored step state, never stored twice."
 *
 * ┌─ WHY THIS FILE EXISTS WHEN `server/control-plane/roster-store.ts` ────────┐
 * │  ALREADY READS THE SAME TABLE                                             │
 * │ Because the two are in different PLANES and reach the database through    │
 * │ different CREDENTIALS, and the difference is the whole of G1161. That     │
 * │ module connects as `reconcile_control_app` through a `CataloguePool`; a   │
 * │ `server/data-plane/**` module that imported it would fail                 │
 * │ `tests/http/console-roster-unreachable.test.ts` §1b, which refuses a      │
 * │ cross-plane import outright — *"the two planes share `server/http/`,      │
 * │ `server/contract/` and `db/`, and nothing else."*                         │
 * │                                                                            │
 * │ 🛑 IT IS NOT A COPY OF THAT READER AND MUST NOT BE MADE INTO ONE. That    │
 * │ one answers *"what is on the roster"* and its result is snake_case,       │
 * │ *"the database's shape and not the wire's"*. **This one answers a         │
 * │ different question** — *"what does the staff console render"* — which is  │
 * │ the roster JOINED to onboarding state and then passed through a           │
 * │ derivation that lives in `model/`. Neither could be written in terms of   │
 * │ the other without one plane importing the other's pool.                    │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 `stage` IS DERIVED HERE AND STORED NOWHERE, AND THE DERIVATION IS
 *    `model/onboarding.ts`'s — NOT A SECOND COPY OF IT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `onboardingStage()` is called once per tenant and its two arms are mapped
 * to two strings by a TOTAL `Record` below. **There is no rule in SQL that
 * says what a stage is**, and writing one would be §5.3 — *"two vocabularies
 * for one concept, and the one that drifts is always the copy"* — with the
 * copy in the place the console reads. `db/migrations-control/0002_tenancy_
 * roster.sql` refused a `stage` column on exactly that ground (G833) and
 * `0030_onboarding_record.sql` refuses one again; **neither refusal is
 * discharged by this file. They are what makes it necessary.**
 *
 * ⚠️ THE `stage` QUERY FILTER THEREFORE CANNOT BE A `WHERE` CLAUSE, AND THAT
 * IS A CONSEQUENCE RATHER THAN A CHOICE. `platform-console.openapi.yaml`
 * declares `components.parameters.OnboardingStage` — *"Narrow the roster to
 * one onboarding stage"* — and there is no column to narrow on. The filter is
 * applied in `server/data-plane/console-roster.ts`, over the DERIVED value,
 * after this module has answered. A `WHERE` here would need the rule in SQL,
 * which is the thing the ruling forbids.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 EVERY REFUSAL BELOW REFUSES THE **WHOLE READ**, NOT THE ROW, AND THAT IS
 *    `0002_tenancy_roster.sql`'s OWN ARGUMENT ONE LAYER UP.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * That migration exists because a `listTenants` mounted against the wrong
 * table would answer **`200 {"tenants":[]}`**, and G296 and G300 both call
 * that *"worse than an honest 404 … indistinguishable from a fleet with no
 * customers in it."* **A roster missing ONE tenant is the same failure, one
 * row smaller**, and it is worse in one respect: nobody counts the rows on a
 * screen. So a tenant this module cannot read honestly takes the whole
 * response down with it, loudly, as a 500 — and the operator who can act on
 * it reads the reason in the process log.
 *
 * ⚠️ AN EMPTY ARRAY IS STILL A LEGAL ANSWER AND THE DISTINCTION IS THE
 * CALLER'S INTENT. A fleet with no tenants, or a `?stage=` narrowing the
 * caller asked for that matches nothing, is an honest `[]`. What must never
 * produce one is a row this code could not understand.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It writes nothing and cannot: `withControlReadScope()` issues
 * `BEGIN READ ONLY` and `reconcile_control_reader` holds `SELECT` and nothing
 * else on these three tables. The two controls are independent —
 * `db/control-read-scope.ts` witnesses both arms live.
 *
 * It reads NO tenant table and holds no credential that could. Invariant 3,
 * verbatim: *"The control plane publishes downward and never reads tenant
 * data."* The direction opened by G1161 is the DATA plane reading a
 * CONTROL-owned fact, and every column this module touches is one 1CloudHub
 * decided or agreed.
 */

import {
  ONBOARDING_STEPS,
  onboardingStage,
  type ForcedStep,
  type OnboardingRecord,
  type OnboardingStage,
  type OnboardingStepKey,
  type CompletedStepCount,
} from '../../model/onboarding.ts'
import type { ControlPlaneClient } from './control-plane-client.ts'

/**
 * `OnboardingStage` as the wire spells it.
 *
 * 🛑 A TOTAL `Record` KEYED ON THE DISCRIMINANT, SO A THIRD ARM IS A COMPILE
 * ERROR HERE RATHER THAN A STAGE THAT SILENTLY RENDERS AS NOTHING. This is
 * the fence `model/onboarding.ts` asks for by name: its header records that
 * `stalled` *"needs a timestamp per step transition and a threshold, and
 * neither has a producer"*, and the day somebody gives it both, `tsc` sends
 * them here to decide what the console shows.
 *
 * ⚠️ THE VALUES ARE THE KINDS AND NOT `S1`'s COMPOSED LABELS, AND THE
 * DIFFERENCE MATTERS BECAUSE ONE OF THEM IS FILTERABLE AND THE OTHER IS NOT.
 * `S1 Staff.dc.html` draws `stage:'onboarding · sources'` and
 * `stage:'stalled · 19 days'` — a stage joined to a detail — and puts the
 * detail again in its own `note` column, which is `TenantSummary.stageNote`.
 * `db/migrations-control/0002_tenancy_roster.sql` refuses `stage_note` as
 * *"the one column on this table whose content would be UNBOUNDED FREE
 * TEXT"*, and `stageNote` is not `required`. **So the console receives the
 * two-member vocabulary its own `?stage=` parameter can narrow on, and
 * composes the label.** A server that shipped `onboarding · sources` would
 * make its own filter parameter unusable against its own output.
 *
 * 🛑 AND THE NEXT STEP'S NAME IS NOT PUBLISHED, WHICH IS A LOSS AND IS NAMED
 * AS ONE. `onboardingStage()`'s `onboarding` arm carries `next` — the step
 * the tenant is waiting on — and `TenantSummary` HAS NO FIELD FOR IT.
 * Adding a field here would be a contract change; inventing one inside
 * `stage` would be the composed label above.
 *
 * ✅ **THE LOSS IS NO LONGER PERMANENT — 21 Sep 2026, R8/R9. ⚠️ THE SENTENCE
 * THAT STOOD HERE IS CORRECTED RATHER THAN DELETED, because it is the one
 * that told a reader the sequence had no published home:** *"`listOnboardingSteps`
 * is the operation that publishes the sequence, it is declared, and it is not
 * mounted."* **It is mounted** — `server/data-plane/onboarding.ts` — so the
 * step a tenant is waiting on is one request away rather than absent.
 *
 * ⚠️ **AND THIS FIELD IS STILL NOT ADDED, WHICH IS THE PART THAT DID NOT
 * CHANGE.** The roster publishes a two-member vocabulary its own `?stage=`
 * can narrow on; the SEQUENCE is a different operation with its own
 * response. A console that wants both makes two requests, which is what the
 * two operations are for.
 */
const STAGE_WIRE: Readonly<Record<OnboardingStage['kind'], string>> = {
  live: 'live',
  onboarding: 'onboarding',
}

/**
 * One row of the console's tenancy pane — `TenantSummary`, and named for it.
 *
 * ⚠️ camelCase, BECAUSE IT IS THE WIRE'S SHAPE. `server/control-plane/
 * roster-store.ts` returns snake_case and says why — *"the mapping to
 * `TenantSummary` happens at a handler, and there is no handler"*. There is a
 * handler now, and this is the shape it hands over, so the mapping happens
 * exactly once and in one place.
 *
 * 🛑 EVERY `required` PROPERTY OF `TenantSummary` IS NON-OPTIONAL HERE, AND
 * THAT IS THE ONE THING `fast-json-stringify` WILL NOT CHECK FOR US. G656's
 * finding, which is why this operation was held back for a day: *"it
 * serialises without validating, so an operation with an almost-complete
 * table ships a 200 missing `required` fields SILENTLY."* TypeScript is one
 * control and it is not sufficient — `tests/http/console-roster-served.test.ts`
 * §2 derives the `required` list from the contract document itself and
 * asserts each one is present in a REAL SERVED RESPONSE, because a type is a
 * claim about this file and the test is a claim about the bytes.
 *
 * ⚠️ `soldVia` IS ABSENT AND IS `0002_tenancy_roster.sql`'s REFUSAL ARRIVING
 * ON THE WIRE. It is not `required`; the column is refused because
 * `db/migrations/0039_partner_access_grant.sql` already holds `partner_id` in
 * the OTHER database behind a composite foreign key, and *"no constraint
 * either database can express joins the two."* An absent optional field is
 * honest; a second copy that could disagree with the enforcement would not be.
 */
export interface TenantSummaryRow {
  readonly tenantId: string
  readonly name: string
  readonly deploymentMode: string
  readonly residency: string
  readonly stage: string
  readonly supportAccessMode: string
  /** Not `required` on the wire, and genuinely absent for a tenant with no plan. */
  readonly plan?: string
}

export const CONSOLE_ROSTER_REFUSALS = {
  /**
   * A roster row with no onboarding row.
   *
   * 🛑 REFUSED RATHER THAN DEFAULTED TO `newOnboarding()`, AND THE REASON IS
   * THAT THE TWO ARE INDISTINGUISHABLE AND MEAN OPPOSITE THINGS. `completed:
   * 0` is what a tenant created five minutes ago has; a MISSING ROW is also
   * what a tenant created before `0030_onboarding_record.sql` existed has,
   * and defaulting would publish `onboarding` about a tenant that has been
   * live for a year. **The console's whole subject is "where each one has got
   * to", so a confident wrong answer there is the expensive failure.**
   *
   * ⚠️ THE FIX IS A WRITER, NOT A DEFAULT. G511: *"the fence and the writer
   * are one commit or neither."* `createTenant` writes a roster row and an
   * onboarding row or it is not `createTenant`; `0030` cannot express that as
   * a constraint (it would need a circular reference into `0002`'s table,
   * which G88 forbids this file from altering) and says so on its face.
   */
  onboardingRecordAbsent: 'onboarding_record_absent',
  /**
   * `completed_steps` is not an integer in `0 … ONBOARDING_STEPS.length`.
   *
   * ⚠️ THIS EXISTS **BECAUSE** `0030` DECLINED TO WRITE AN UPPER BOUND INTO
   * THE `CHECK`, AND THE PAIR IS THE POLARITY `0069_run_admission.sql`
   * STATES: *"an UNKNOWN value must reach the model as an `*_unreadable`
   * refusal, not be rejected at write time by a list somebody forgot to
   * extend."* A bound in SQL is a third copy of `ONBOARDING_STEPS.length`
   * that G88 then freezes; a refusal here moves with the tuple, because the
   * bound below is READ FROM IT.
   */
  completedCountUnreadable: 'completed_count_unreadable',
  /**
   * A stored `step` that is not a member of `ONBOARDING_STEPS`.
   *
   * 🛑 A REFUSAL AND NEVER A SKIP, AND THE DIFFERENCE IS THE WHOLE VALUE OF
   * THE ROW. A reader that merely failed to match an unknown key would DROP
   * the forced mark — and the forced mark is *"PERMANENT, AND THE ONLY RECORD
   * OF WHY THE SEQUENCE WAS BROKEN"*. **Silently losing it through a read is
   * the same harm `0030`'s append-only trigger exists to prevent through a
   * write**, arriving from the other side.
   */
  forcedStepUnreadable: 'forced_step_unreadable',
} as const
export type ConsoleRosterRefusal =
  (typeof CONSOLE_ROSTER_REFUSALS)[keyof typeof CONSOLE_ROSTER_REFUSALS]

export type ConsoleRosterOutcome =
  | { readonly ok: true; readonly tenants: readonly TenantSummaryRow[] }
  | {
      readonly ok: false
      readonly refusal: ConsoleRosterRefusal
      /** Which row could not be read. For the process log; never for the caller. */
      readonly tenantId: string
    }

/**
 * The roster, joined to its onboarding record.
 *
 * 🛑 THE `WHERE` IS EMPTY, AND IT IS THE SAME LOAD-BEARING LINE
 * `server/control-plane/roster-store.ts` AND `server/data-plane/identity.ts`
 * §6a BOTH CARRY: every predicate somebody would add here deletes a decision
 * that belongs somewhere else. There is no tenant narrowing because a console
 * reads the whole fleet and this database has no tenant session to narrow to;
 * there is no `stage` narrowing because **there is no stage column** and the
 * filter is applied over the derived value by the route.
 *
 * ⚠️ A `LEFT JOIN` AND NOT AN INNER ONE, DELIBERATELY. An inner join would
 * make a tenant with no onboarding row VANISH from the roster — the silent
 * shrinking answer this whole slice exists to refuse — where the left join
 * produces a `NULL` that becomes `onboarding_record_absent` and takes the
 * response down loudly.
 */

/**
 * Every forced gate in the fleet.
 *
 * ⚠️ READ EVEN THOUGH `stage` DOES NOT DEPEND ON IT, AND THE REASON IS THAT
 * THE ALTERNATIVE IS A FABRICATION. `onboardingStage()` reads `completed` and
 * ignores `forced`, so a caller could pass `forced: []` and get the same two
 * arms — **and that empty list would be this module asserting "this tenant's
 * sequence was never broken" without having looked.** `wasForced()` is the
 * question `model/onboarding.ts` says a review asks first, and an
 * `OnboardingRecord` is a total record rather than the subset one caller
 * happens to need. So it is read, the record is built whole, and the day a
 * stage arm or a `stageNote` depends on it nothing here changes.
 */

/**
 * THE ONE NARROWING IN THIS MODULE, NAMED RATHER THAN INLINED —
 * `model/onboarding.ts#advanceTo()`'s discipline, applied at the seam where a
 * `number` from a database becomes a member of a literal union.
 *
 * The bound is `ONBOARDING_STEPS.length` and is READ FROM THE TUPLE, so a
 * seventh step widens it with no edit here — which is the property that makes
 * the missing `CHECK` in `0030` safe rather than lax.
 *
 * ⚠️ **EXPORTED SINCE 21 Sep 2026 AND THE EXPORT IS A DE-DUPLICATION RATHER
 * THAN A CONVENIENCE.** `server/data-plane/onboarding-store.ts` reads the same
 * two columns for ONE tenant and would otherwise restate this narrowing and
 * `stepKeyOf()` beside it — §5.3, *"two vocabularies for one concept, and the
 * one that drifts is always the copy"*, with the copy deciding whether a
 * console WRITE is allowed. The roster reader landed first and owns them; the
 * second reader imports rather than respells.
 */
export function completedCountOf(raw: unknown): CompletedStepCount | null {
  if (typeof raw !== 'number' || !Number.isInteger(raw)) return null
  if (raw < 0 || raw > ONBOARDING_STEPS.length) return null
  /* Bounded above and below by the tuple itself, and integral. */
  return raw as CompletedStepCount
}

/**
 * A stored `step` narrowed to a member of the sequence, or `null`.
 *
 * ⚠️ EXPORTED FOR `onboarding-store.ts`'s reason above: one home, two readers.
 */
export function stepKeyOf(raw: unknown): OnboardingStepKey | null {
  if (typeof raw !== 'string') return null
  const steps: readonly string[] = ONBOARDING_STEPS
  return steps.includes(raw) ? (raw as OnboardingStepKey) : null
}

interface RosterRow {
  readonly tenant_id: unknown
  readonly name: unknown
  readonly deployment_mode: unknown
  readonly residency: unknown
  readonly support_access_mode: unknown
  readonly plan: unknown
  readonly completed_steps: unknown
}

interface ForcedRow {
  readonly tenant_id: unknown
  readonly step: unknown
  readonly reason: unknown
}

/**
 * The staff console's tenancy pane, whole.
 *
 * ⚠️ TWO STATEMENTS IN ONE READ-ONLY TRANSACTION, NOT TWO TRANSACTIONS. The
 * forced marks and the counts have to be a consistent snapshot: a force
 * landing between them would produce a record whose `completed` predates its
 * own mark. `withControlReadScope()` is what makes the pair atomic, and it is
 * the reason this module takes a POOL and issues no statement of its own
 * outside it.
 */
/**
 * G4318, 5 Oct 2026 — THE OWNER'S "Full restore" RULING: *"…put … roster reads
 * behind signed control-plane endpoints…"*. ⚠️ THIS READ THE ROSTER AND THE
 * ONBOARDING TABLES OUT OF THE CONTROL DATABASE through the read-only control
 * pool (G1161) until then. It now asks `getInternalRoster` for the same FACTS —
 * the stored roster row, the stored prefix length, the stored forced marks —
 * and this module still assembles them and still owns every refusal, so the
 * rule lives once. The act's platform authorisation id travels with the call.
 * Any answer but a well-formed 200 THROWS (a 500 from the error handler).
 */
export async function readConsoleRoster(
  client: ControlPlaneClient,
  authorisationId: string,
): Promise<ConsoleRosterOutcome> {
  const reply = await client.get('/internal/console/roster', { authorisationId, idempotencyKey: authorisationId })
  const facts = (reply.body as { tenants?: unknown } | null)?.tenants
  if (reply.status !== 200 || !Array.isArray(facts)) {
    throw new Error(`the control plane answered ${reply.status} to the roster read`)
  }
  const roster: RosterRow[] = []
  const forced: ForcedRow[] = []
  for (const f of facts as Array<Record<string, unknown>>) {
    roster.push({
      tenant_id: f['tenantId'],
      name: f['name'],
      deployment_mode: f['deploymentMode'],
      residency: f['residency'],
      support_access_mode: f['supportAccessMode'],
      plan: f['plan'],
      completed_steps: f['completedSteps'],
    })
    for (const m of Array.isArray(f['forced']) ? (f['forced'] as Array<Record<string, unknown>>) : []) {
      forced.push({ tenant_id: f['tenantId'], step: m['step'], reason: m['reason'] })
    }
  }

  /* The forced marks, grouped by tenant, refusing an unreadable key by name. */
  const marks = new Map<string, ForcedStep[]>()
  for (const row of forced) {
    const tenantId = String(row.tenant_id)
    const step = stepKeyOf(row.step)
    if (step === null) {
      return {
        ok: false,
        refusal: CONSOLE_ROSTER_REFUSALS.forcedStepUnreadable,
        tenantId,
      }
    }
    const list = marks.get(tenantId)
    const mark: ForcedStep = { step, reason: String(row.reason) }
    if (list === undefined) marks.set(tenantId, [mark])
    else list.push(mark)
  }

  const tenants: TenantSummaryRow[] = []
  for (const row of roster) {
    const tenantId = String(row.tenant_id)
    if (row.completed_steps === null || row.completed_steps === undefined) {
      return {
        ok: false,
        refusal: CONSOLE_ROSTER_REFUSALS.onboardingRecordAbsent,
        tenantId,
      }
    }
    const completed = completedCountOf(row.completed_steps)
    if (completed === null) {
      return {
        ok: false,
        refusal: CONSOLE_ROSTER_REFUSALS.completedCountUnreadable,
        tenantId,
      }
    }

    /**
     * 🛑 THE DERIVATION, AND IT IS ONE CALL. Everything about what a stage
     * MEANS is in `model/onboarding.ts`; this module supplies the state and
     * spells the answer.
     */
    const record: OnboardingRecord = { completed, forced: marks.get(tenantId) ?? [] }
    const stage = STAGE_WIRE[onboardingStage(record).kind]

    const plan = row.plan
    tenants.push({
      tenantId,
      name: String(row.name),
      deploymentMode: String(row.deployment_mode),
      residency: String(row.residency),
      stage,
      supportAccessMode: String(row.support_access_mode),
      /**
       * ⚠️ SPREAD RATHER THAN `plan: undefined`. Under
       * `exactOptionalPropertyTypes` the absent key is what an optional
       * property means, and `fast-json-stringify` omits an absent key while
       * it would have to decide what to do with an explicit `undefined`.
       */
      ...(plan === null || plan === undefined ? {} : { plan: String(plan) }),
    })
  }

  return { ok: true, tenants }
}
