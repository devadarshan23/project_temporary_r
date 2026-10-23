/**
 * THE STAFF CONSOLE'S FIRST SERVED OPERATION — `GET /v1/staff/tenants`
 * (`listTenants`). **G1241 (THE OWNER'S) and G1244, 20 Sep 2026.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS FILE MOUNTS RATHER THAN BUILDS. `server/data-plane/run-account.ts`
 *    IS THE SHAPE AND ITS RULE IS THE ONE THAT GOVERNS HERE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The body is `server/data-plane/console-roster-store.ts`, minus the route.
 * This file reads one optional query parameter, calls that function with the
 * pool the plane was built with, and turns its two answers into two status
 * codes. **No SQL is written here and no rule about what a STAGE means
 * exists here** — that is `model/onboarding.ts#onboardingStage()`, called
 * once, in the store.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHY THIS ONE MAY MOUNT WHEN THIRTEEN OPERATIONS ON THE SAME TIER MAY
 *    NOT. G300, AND ITS TEST IS THREE-PART: **TABLE AND MODEL AND
 *    CAPABILITY.** Derived, each with the command, because that ruling says
 *    in its own voice *"derive each; do not assert readiness"*:
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   TABLE       `grep -c 'CREATE TABLE' db/migrations-control/0002_tenancy_roster.sql
 *                db/migrations-control/0030_onboarding_record.sql`
 *               → 1 and 2. The roster is G831's; the onboarding record and its
 *               forced marks are G1241's, and **the second of the two is what
 *               was missing until today** — `TenantSummary.stage` is
 *               `required` and had no producer of any kind.
 *               `tests/db/onboarding-record.test.ts` drives both over a real
 *               PostgreSQL, including the append-only trigger witnessed
 *               raising as the ADMIN.
 *   MODEL       `OnboardingRecord`, `onboardingStage()` and
 *               `ONBOARDING_STEPS` are `model/onboarding.ts`'s — G535,
 *               19 Sep 2026 — and the store DERIVES the wire's `stage` from
 *               that function rather than transcribing its rule beside it.
 *   CAPABILITY  `grep -A1 'operationId: listTenants' docs/contracts/platform-console.openapi.yaml`
 *               → `x-capability: view_substrate`, a member of the closed set
 *               `model/access.ts` declares (G601), of resource class
 *               `substrate`, which `PLATFORM_ASSIGNMENT_REACHES` opens — so
 *               `decide()`'s fourth arm can ALLOW it, which is the thing that
 *               was true of no console operation before G601.
 *
 * ⚠️ AND THE OTHER THIRTEEN STAY UNMOUNTED, PER OPERATION AND ON MERIT.
 * `tests/http/console-roster-unreachable.test.ts` §5a DERIVES, for each, a
 * `required` response field with no column anywhere in the control migration
 * set and no named derivation — a billing period, an invoice, a pack draft, a
 * rate card. None of those has a table in either database. **Nothing in this
 * file licenses mounting a fourteenth**, and the ones whose table does not
 * exist keep the router's honest 404.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 G1244 — THE FAILURE MODE FOUR DOCUMENTS RECORD FOR THIS OPERATION IS
 *    **NOT THE ONE THE TREE HAS**, AND IT IS MEASURED HERE RATHER THAN
 *    REASONED. READ THIS BEFORE QUOTING G833 OR G656 ONWARD.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `db/migrations-control/0002_tenancy_roster.sql`, `0020_console_read_role.sql`,
 * `tests/db/tenancy-roster.test.ts` §4b and
 * `tests/http/console-roster-unreachable.test.ts` §5a all carry a version of
 * one sentence: *"`fast-json-stringify` serialises without validating, so an
 * operation with an almost-complete table ships a 200 missing its own
 * `required` fields SILENTLY."*
 *
 * **Measured against `fast-json-stringify@7.0.1`, which is what
 * `fastify@5.12.5` pins — derive it, `npm ls fast-json-stringify`:**
 *
 *     required property ABSENT  -> THROWS `"stage" is required!`
 *                                  Fastify answers **500** on every request.
 *     required property ABSENT,
 *       schema carries `default` -> 200, filled from the default. SILENT.
 *     property PRESENT and not
 *       in `properties`          -> 200, dropped. SILENT.
 *
 * 🛑 **SO THE SERIALISER IS SILENT IN THE ADDITIVE DIRECTION AND LOUD IN THE
 * SUBTRACTIVE ONE, AND THE RECORDED SENTENCE HAS THE TWO THE WRONG WAY
 * ROUND.** Mounting `listTenants` against the roster alone would not have
 * shipped a quiet incomplete roster — it would have **500'd on every
 * request**, which is a worse outage and a better alarm.
 *
 * ⚠️ **THE BLOCKER IS NOT WEAKENED BY THIS AND MUST NOT BE READ AS DISCHARGED
 * — IT IS THE REASONING THAT IS CORRECTED, NOT THE VERDICT.** G833 refused a
 * `stage` column and the refusal stands on its own ground (a second home for
 * state `model/onboarding.ts` owns). What changes is what a reader should
 * expect if they ignore it. **And the silent arm has not gone away: it has
 * moved to `default`**, so the day anybody adds one to a contract property the
 * hole is back and quiet. `tests/http/console-roster-served.test.ts` §2c
 * pins `TenantSummary`'s absence of one.
 *
 * ⚠️ AND THE ASSERTION THIS SLICE OWES IS UNCHANGED BY ALL OF IT. A 200 is
 * not evidence that a response is complete — it is evidence that it did not
 * throw — so §2 of that suite derives `required` from the contract document
 * and checks each name against the BYTES of a real served response. A type is
 * a claim about this file; a test is a claim about the wire.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE ACT'S RECORD AND THE ACT'S DATA ARE IN TWO DIFFERENT DATABASES, AND
 *    THAT IS THE SHAPE OF EVERY CONSOLE OPERATION FROM HERE ON.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `authorisedHandler()`'s platform arm opens a SESSION scope on the DATA
 * database and writes `tenant.platform_authorization_grant` — invariant 10's
 * second home, `db/migrations/0091_platform_authorisation_record.sql`, G730 —
 * and then runs this body. **The body ignores that `tx`**: the roster is in
 * the CONTROL database and is read through `withControlReadScope()`, its own
 * read-only transaction on its own credential (G1161).
 *
 * ⚠️ THE ORDER STILL HOLDS AND IT IS THE PROPERTY THAT MATTERS. The record is
 * written BEFORE the act, in a transaction that has not committed, so a read
 * that THROWS takes its own authorisation record down with it. What is lost
 * relative to a single-database operation is atomicity in the other
 * direction: the control read commits on its own, so a failure between the
 * two leaves a record of an act whose result nobody received. **That is the
 * safe direction** — invariant 10 makes an act *"visible or detectable"*, and
 * a record with no delivered result over-reports rather than under-reports.
 * It is named here rather than discovered.
 *
 * 🛑 `actingTenantOf()` IS NOT CALLED AND MUST NOT BE. It THROWS for a
 * platform grant by construction, and the throw is invariant 8 speaking:
 * *"`PLATFORM_ASSIGNMENT_REACHES.tenant_data` is `false`, so `decide()`
 * refuses a platform principal that class before `authorize()` mints
 * anything."* This body reads no tenant table, holds no credential that
 * could, and has no tenant to ask for.
 */

import type { FastifyRequest } from 'fastify'

import type { ControlPlaneClient } from './control-plane-client.ts'
import { sendProblem } from '../http/app.ts'
import { CODES } from '../http/problem.ts'
import type { AuthorisedBody, AuthorisedOperation } from './authorisation-record.ts'
import { readConsoleRoster } from './console-roster-store.ts'

/**
 * `?stage=` — `components.parameters.OnboardingStage`, *"Narrow the roster to
 * one onboarding stage."*
 *
 * 🛑 APPLIED HERE AND NOT IN SQL, AND THAT IS A CONSEQUENCE OF THE OWNER'S
 * RULING RATHER THAN A PREFERENCE. There is no `stage` column and there must
 * not be one (G833), so the only place the value exists is AFTER
 * `onboardingStage()` has run. A `WHERE` clause would need the derivation
 * restated in SQL — §5.3, with the copy in the place a console reads.
 *
 * ⚠️ AN UNRECOGNISED VALUE NARROWS TO NOTHING AND ANSWERS `[]`, AND THAT IS
 * NOT THE EMPTY ARRAY `0002_tenancy_roster.sql` REFUSED. That one was a
 * roster that could not be read reporting a fleet with no customers in it.
 * This one is **a narrowing the caller asked for that matched nothing**, and
 * the caller can tell the difference because they wrote the filter. The
 * parameter's schema is `{ type: string }` with no `enum`, so ajv admits any
 * string and a 422 here would be this handler inventing a validation the
 * contract does not declare.
 */
function stageFilterOf(request: FastifyRequest): string | null {
  const query = request.query as Record<string, unknown> | undefined
  const raw = query?.['stage']
  return typeof raw === 'string' && raw !== '' ? raw : null
}

const listTenantsBody =
  (client: ControlPlaneClient): AuthorisedBody =>
  async ({ request, reply, grant }) => {
    const outcome = await readConsoleRoster(client, grant.id)

    if (!outcome.ok) {
      /**
       * 🛑 A 500, AND THE WHOLE RESPONSE RATHER THAN THE ROW. The store's
       * header carries the argument: a roster missing ONE tenant is
       * `200 {"tenants":[]}`'s failure one row smaller, and nobody counts the
       * rows on a screen. `upstream_unavailable` is `errors.yaml`'s own words
       * — *"An unhandled failure below us. The only honest code for a 500"* —
       * and it is honest here: the failure IS below us, in a row this plane
       * did not write and cannot repair.
       *
       * ⚠️ THE REASON AND THE TENANT GO TO THE PROCESS LOG AND NEVER TO THE
       * CALLER, which is every refusal on this plane. Naming the tenant in a
       * problem document would make a broken row an existence oracle over the
       * fleet for anybody who can authenticate.
       */
      console.error(
        `data-plane: \`listTenants\` refused the whole roster — \`${outcome.refusal}\` on ` +
          `\`${outcome.tenantId}\`. The response is a 500 rather than a short list, because ` +
          'a roster silently missing one tenant is the failure `db/migrations-control/' +
          '0002_tenancy_roster.sql` exists to refuse, one row smaller. See ' +
          '`server/data-plane/console-roster-store.ts` for what each refusal means and ' +
          'which writer owes the repair.',
      )
      return sendProblem(reply, {
        status: 500,
        code: CODES.upstreamUnavailable,
        title: 'The tenancy roster could not be read.',
        detail: 'A roster row could not be read. The reason is in this plane’s log.',
      })
    }

    const stage = stageFilterOf(request)
    const tenants =
      stage === null ? outcome.tenants : outcome.tenants.filter((t) => t.stage === stage)
    return { tenants }
  }

/**
 * ⚠️ `resourceId: null` — *"opening a list"* is `ResourceRef.resourceId`'s own
 * example of a genuinely non-instance-bound act, and a fleet roster is the
 * purest one in the tree: the request names no tenant at all, which is what
 * makes it a `substrate` act rather than a `tenant_data` one.
 *
 * ⚠️ `resourceType: 'Tenant'` — the ENTITY name from `model/domain.ts`, never
 * a path and never a table. `ResourceRef` says it is *"Never parsed."*
 *
 * 🛑 IT IS AN `AuthorisedOperation` AND NOT A `Handler`, AND IT COULD NOT
 * HAVE BEEN ANYTHING ELSE. `mountTier()`'s SIXTH FENCE refuses to boot a
 * gated operation whose entry is a bare handler — G301, *"an operation may
 * not mount until it mints a record"* — and this is the first console
 * operation ever to satisfy it, because G730 gave a tenant-less act a home
 * for its record. `tests/http/console-roster-served.test.ts` §4 asserts the
 * fence fires on a bare handler for this exact operationId.
 */
export function listTenantsOperation(client: ControlPlaneClient): AuthorisedOperation {
  return {
    operationId: 'listTenants',
    resourceType: 'Tenant',
    instanceOf: () => null,
    body: listTenantsBody(client),
  }
}
