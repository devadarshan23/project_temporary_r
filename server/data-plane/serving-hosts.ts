/**
 * THE HOST→TENANT REGISTRY, READ FROM CONFIGURATION AND VALIDATED AT BOOT.
 *
 * G179: *"RESOLUTION IS A CONFIGURATION LOOKUP, NEVER A PATTERN."* This file is
 * where the configuration comes from. It parses nothing on the sign-in path,
 * it derives no tenant from a hostname's shape, and it hands
 * `resolveServingHost()` (`model/serving-host.ts`) an array it validated once,
 * at start-up, through that module's own `checkServingHostRegistration()`.
 *
 * ┌─ WHY CONFIGURATION AND NOT A TABLE ────────────────────────────────────────┐
 * │ `model/serving-host.ts` on `ServingHost`: *"CONTROL-PLANE AUTHORED,         │
 * │ PUBLISHED DOWNWARD, READ LOCALLY. C1 forbids a control-plane call on the    │
 * │ hot path and C2 is the publication direction, so this joins the             │
 * │ data-plane-local pull rather than becoming a lookup endpoint. There is no   │
 * │ second distribution path and this slice does not invent one."*              │
 * │                                                                            │
 * │ 🛑 THE PULL DOES NOT EXIST. `docs/contracts/data-plane-local.openapi.yaml`  │
 * │ declares three operations and none of them publishes a registry, and        │
 * │ `db/migrations/` holds no `serving_host` table. So this reads the plane's   │
 * │ OWN ENVIRONMENT, which is the one place a deployment already states what    │
 * │ this process is. **That is a stand-in for the publication path and is       │
 * │ named as one** — the commit that builds the downward pull replaces this     │
 * │ reader and deletes the variable. Inventing an endpoint or a table here      │
 * │ would be inventing the second distribution path the declaration forbids.   │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 INVARIANT 1 IS NOT BENT BY THIS AND THE DISTINCTION IS EXACT.
 * `db/selection-scope.ts`: *"`candidateTenantId` may be a value the platform
 * derived from the Host header through the registry, and nothing else."* The
 * Host header selects a ROW; the row states the tenant. A caller who sends a
 * Host nobody registered gets `host_not_registered`, not a tenant — which is
 * G179's *"precisely so that there is no selector to defeat"*, mechanised.
 *
 * ⚠️ AN UNPARSEABLE ENTRY IS A BOOT FAILURE, NOT A SKIPPED ROW, AND IT IS THE
 * SAME POLARITY AS EVERY FENCE IN `server/http/app.ts`. A registry that
 * silently dropped a malformed line would resolve the affected host to
 * `host_not_registered` — a refusal that means *"nobody serves this name"*
 * when what happened is *"somebody typed it wrong"*, and the two are
 * indistinguishable from outside. Worse in the other direction: dropping a
 * `retired` row that failed to parse turns a withdrawn host back into an
 * unregistered one, which reads as safe and is not.
 *
 * ⚠️ AND AN ABSENT VARIABLE IS AN EMPTY REGISTRY RATHER THAN A REFUSAL TO BOOT,
 * WHICH IS THE ONE PLACE THIS FILE IS DELIBERATELY NOT MAXIMALLY STRICT.
 * `resolveServingHost([], host)` answers `host_not_registered` for every host,
 * so a plane with no registry serves no tenant context at all — fail-closed
 * already, by the model's own total function. Refusing to START would instead
 * take down `GET /health` and the two run operations for every existing suite
 * and for `compose.yaml`, which is a blast radius bought for no property.
 */

import {
  CONSOLE_KINDS,
  REGION_HOST_LABEL,
  checkSignInReturnHost,
  SERVING_HOST_KINDS,
  checkConsoleHostRegistration,
  checkServingHostRegistration,
  type ConsoleHost,
  type ConsoleKind,
  type ServingHost,
  type ServingHostKind,
} from '../../model/serving-host.ts'

/**
 * ⚠️ NAMED OFF `ServingHost` RATHER THAN IMPORTED FROM `model/domain.ts` AND
 * `model/kernel.ts` SEPARATELY. The row is the thing this file builds, so its
 * own field types are the only ones that can be wrong here — and reaching into
 * two more modules for two aliases would put `model/domain.ts`, which is the
 * largest module in the tree, on this directory's import graph for nothing.
 */
type RegionKey = ServingHost['region']
type TenantId = ServingHost['tenantId']

export const SERVING_HOSTS_ENV = 'RECONCILE_SERVING_HOSTS'

/**
 * `host|tenantId|region|kind|status`, entries separated by `,`.
 *
 *     acme.ap-southeast-1.reconcile.invalid|ten_acme|ap-southeast-1|pooled|active
 *
 * 🛑 FIVE FIELDS, ALL REQUIRED, NO DEFAULTS. Each one is a decision somebody
 * has to have made: which tenant is served, in which region the plane runs
 * (invariant 7 — it is compared against `Tenant.residency`), whether the name
 * is ours or the customer's under BYOA, and whether it still answers. A
 * default for any of them is a decision nobody made, arriving as a value the
 * registry states with a straight face.
 */
const FIELD_SEPARATOR = '|'
const ENTRY_SEPARATOR = ','

/**
 * The refusal, as a sentence, for the boot failure. It names the ENTRY and the
 * FIELD and never the whole variable — a registry line is configuration and not
 * a credential, but the habit of not echoing an environment variable wholesale
 * into a log is worth keeping at the one boundary that reads several.
 */
class RegistryError extends Error {}

function refuse(index: number, why: string): never {
  throw new RegistryError(
    `${SERVING_HOSTS_ENV} entry ${index + 1} is not a serving-host row: ${why}. ` +
      `The grammar is \`host${FIELD_SEPARATOR}tenantId${FIELD_SEPARATOR}region` +
      `${FIELD_SEPARATOR}kind${FIELD_SEPARATOR}status\`, entries separated by ` +
      `\`${ENTRY_SEPARATOR}\`. A malformed entry is a boot failure rather than a ` +
      'skipped row, because a dropped row and an unregistered host are the same ' +
      'answer from outside and only one of them is a decision.',
  )
}

function asRegion(value: string, index: number): RegionKey {
  /* TOTAL OVER `RegionKey` BY CONSTRUCTION: `REGION_HOST_LABEL` is a
   * `Record<RegionKey, string>` in `model/serving-host.ts`, so its key set IS
   * the union and a sixth region added to the model appears here without this
   * file being edited. A hand-written list would be the copy that drifts. */
  const keys = Object.keys(REGION_HOST_LABEL) as readonly RegionKey[]
  const found = keys.find((k) => k === value)
  if (found === undefined) {
    refuse(index, `\`${value}\` is not a RegionKey (${keys.join(', ')})`)
  }
  return found
}

function asKind(value: string, index: number): ServingHostKind {
  if (value === SERVING_HOST_KINDS.pooled) return SERVING_HOST_KINDS.pooled
  if (value === SERVING_HOST_KINDS.delegated) return SERVING_HOST_KINDS.delegated
  return refuse(
    index,
    `\`${value}\` is neither \`${SERVING_HOST_KINDS.pooled}\` nor ` +
      `\`${SERVING_HOST_KINDS.delegated}\``,
  )
}

function asStatus(value: string, index: number): ServingHost['status'] {
  if (value === 'active' || value === 'retired') return value
  return refuse(index, `\`${value}\` is neither \`active\` nor \`retired\``)
}

/**
 * Parse and VALIDATE. Throws on the first bad entry.
 *
 * 🛑 `checkServingHostRegistration()` IS CALLED ON EVERY ROW AND THIS IS ITS
 * FIRST CALL SITE ANYWHERE. Its own header: *"THE ONLY PLACE IN THIS MODULE A
 * HOSTNAME IS TAKEN APART, AND IT IS NOT ON THE SIGN-IN PATH … that check is an
 * operator-initiated act."* Loading a registry IS that act — it happens once,
 * at boot, before a port is bound — so the pooled naming rules (a region label
 * that agrees with `region`, a tenant label that is not reserved) are enforced
 * where G179 says they may be, and nowhere else.
 *
 * ⚠️ IT IS ALSO WHAT KEEPS THE `delegated` EXEMPTION HONEST. That function
 * returns `ok` immediately for a delegated row — *"Applying the pooled rules to
 * a delegated row makes BYOA unregisterable, which is how the circularity arose
 * in the first place"* — so a BYOA host under a customer's own domain loads
 * here without a single label rule being applied to it, and the `kind` field is
 * what says which regime a row is in. That is why `kind` has no default.
 */
export function parseServingHosts(raw: string | undefined): readonly ServingHost[] {
  if (raw === undefined || raw.trim() === '') return []

  const out: ServingHost[] = []
  const entries = raw.split(ENTRY_SEPARATOR)
  for (const [index, entry] of entries.entries()) {
    const trimmed = entry.trim()
    if (trimmed === '') refuse(index, 'it is empty')
    const fields = trimmed.split(FIELD_SEPARATOR).map((f) => f.trim())
    if (fields.length !== 5) {
      refuse(index, `it has ${fields.length} field(s) and the grammar has 5`)
    }
    const [host, tenantId, region, kind, status] = fields as [
      string,
      string,
      string,
      string,
      string,
    ]
    if (host === '') refuse(index, 'the host is empty')
    if (tenantId === '') refuse(index, 'the tenant id is empty')

    const row: ServingHost = {
      kind: asKind(kind, index),
      host,
      tenantId: tenantId as TenantId,
      region: asRegion(region, index),
      status: asStatus(status, index),
    }

    const verdict = checkServingHostRegistration(row)
    if (!verdict.ok) {
      refuse(
        index,
        `\`${host}\` is refused by checkServingHostRegistration() — ${verdict.refusal}` +
          (verdict.labelRefusal === null ? '' : ` (${verdict.labelRefusal})`),
      )
    }

    out.push(row)
  }
  return out
}

/**
 * The registry this process serves, read ONCE at boot.
 *
 * ⚠️ READ ONCE AND NOT PER REQUEST, for `server/contract/document.ts`'s reason
 * one layer over: *"a contract that could change under a running server would
 * make the route table and the validator disagree with each other
 * mid-request."* A registry that could change under a running server would make
 * two requests on one connection resolve to two different tenants, which is the
 * condition every scoped helper in `db/` is written against.
 */
export function servingHostRegistry(): readonly ServingHost[] {
  return parseServingHosts(process.env[SERVING_HOSTS_ENV])
}

/* ------------------------------------------------------------------ *
 * THE CONSOLE REGISTRY — G726, 19 Sep 2026
 * ------------------------------------------------------------------ */

/**
 * THE SECOND REGISTRY, READ FROM CONFIGURATION AND VALIDATED AT BOOT.
 *
 * 🛑 EVERY SENTENCE AT THE TOP OF THIS FILE APPLIES TO IT UNCHANGED and is not
 * restated: resolution is a lookup and not a pattern, the publication path does
 * not exist and this environment variable is a NAMED STAND-IN for it, an
 * unparseable entry is a BOOT FAILURE rather than a skipped row, and an absent
 * variable is an empty registry rather than a refusal to start.
 *
 * ⚠️ THE LAST OF THOSE IS THE ONE TO READ TWICE HERE, because its fail-closed
 * argument is different on this side. `resolveConsoleHost([], host)` answers
 * `host_not_registered` for every host, so a plane with no console registry
 * serves no console surface at all — and `resolveServedHost()` then answers
 * `host_not_registered` too, which `server/data-plane/session.ts` reads as the
 * TENANT surface. **That is the STRICTER of the two surfaces, not the more
 * permissive one**: a tenant surface requires `session.tenant_id` to be
 * non-null before any authority is resolved. A deployment that forgets this
 * variable loses its consoles; it gains nothing.
 *
 * 🛑 AND IT IS A SEPARATE VARIABLE RATHER THAN A SIXTH FIELD ON
 * `RECONCILE_SERVING_HOSTS`. A console row has no tenant and no region, so
 * three of that grammar's five fields would have to be written and ignored —
 * and the one somebody writes anyway is `tenantId`, which is the fictional
 * tenant `model/serving-host.ts` §7 refuses by name. Two grammars for two
 * shapes; `resolveServedHost()` is where they meet, and it refuses a host that
 * appears in both.
 */
export const CONSOLE_HOSTS_ENV = 'RECONCILE_CONSOLE_HOSTS'

/**
 * `host|console|status`, entries separated by `,`.
 *
 *     console.reconcile.invalid|staff|active,partners.reconcile.invalid|partner|active
 *
 * 🛑 THREE FIELDS, ALL REQUIRED, NO DEFAULTS — `parseServingHosts()`'s rule,
 * and `console` is the one that would be defaulted. A row whose console kind
 * was assumed is a row that decides which surface a person reaches by which
 * value happened to be first in a union.
 */
function asConsoleKind(value: string, index: number): ConsoleKind {
  if (value === CONSOLE_KINDS.staff) return CONSOLE_KINDS.staff
  if (value === CONSOLE_KINDS.partner) return CONSOLE_KINDS.partner
  return refuseConsole(
    index,
    `\`${value}\` is neither \`${CONSOLE_KINDS.staff}\` nor \`${CONSOLE_KINDS.partner}\``,
  )
}

function refuseConsole(index: number, why: string): never {
  throw new RegistryError(
    `${CONSOLE_HOSTS_ENV} entry ${index + 1} is not a console-host row: ${why}. ` +
      `The grammar is \`host${FIELD_SEPARATOR}console${FIELD_SEPARATOR}status\`, ` +
      `entries separated by \`${ENTRY_SEPARATOR}\`. A malformed entry is a boot ` +
      'failure rather than a skipped row, because a dropped row and an unregistered ' +
      'host are the same answer from outside and only one of them is a decision.',
  )
}

/**
 * Parse and VALIDATE. Throws on the first bad entry.
 *
 * 🛑 `checkConsoleHostRegistration()` IS CALLED ON EVERY ROW, for
 * `parseServingHosts()`'s reason: loading a registry is the operator-initiated
 * act G179 permits a hostname to be taken apart in, and nowhere else. It
 * enforces two things and only two — the host is already normalised, and it
 * carries NO REGION LABEL (G297: *"a region label on [a console] would assert
 * a residency invariant 3 says the control plane does not have"*).
 */
export function parseConsoleHosts(raw: string | undefined): readonly ConsoleHost[] {
  if (raw === undefined || raw.trim() === '') return []

  const out: ConsoleHost[] = []
  const entries = raw.split(ENTRY_SEPARATOR)
  for (const [index, entry] of entries.entries()) {
    const trimmed = entry.trim()
    if (trimmed === '') refuseConsole(index, 'it is empty')
    const fields = trimmed.split(FIELD_SEPARATOR).map((f) => f.trim())
    if (fields.length !== 3) {
      refuseConsole(index, `it has ${fields.length} field(s) and the grammar has 3`)
    }
    const [host, console_, status] = fields as [string, string, string]
    if (host === '') refuseConsole(index, 'the host is empty')

    const row: ConsoleHost = {
      host,
      console: asConsoleKind(console_, index),
      status: asStatus(status, index),
    }

    const verdict = checkConsoleHostRegistration(row)
    if (!verdict.ok) {
      refuseConsole(
        index,
        `\`${host}\` is refused by checkConsoleHostRegistration() — ${verdict.refusal}`,
      )
    }

    out.push(row)
  }
  return out
}

/**
 * The consoles this process serves, read ONCE at boot.
 *
 * ⚠️ READ ONCE AND NOT PER REQUEST, for `servingHostRegistry()`'s reason: a
 * registry that could change under a running server would make two requests on
 * one connection resolve to two different surfaces — and a surface decides
 * whether a session may exist without a tenant at all, which is larger than
 * the tenant question that argument was originally written about.
 */
export function consoleHostRegistry(): readonly ConsoleHost[] {
  return parseConsoleHosts(process.env[CONSOLE_HOSTS_ENV])
}

/* ==================================================================== *
 * G2549 — THE SHARED SIGN-IN RETURN HOST
 * ==================================================================== */

export const SIGN_IN_RETURN_HOST_ENV = 'RECONCILE_SIGNIN_RETURN_HOST'

/**
 * The ONE host the broker returns every sign-in to (THE OWNER'S RULING G2549),
 * read ONCE at boot, or `null` when the variable is absent — a local plane,
 * on which the broker returns to the host the sign-in began on (G2548's
 * shape) and the relay serves nothing.
 *
 * 🛑 A COLLISION WITH EITHER REGISTRY IS A BOOT FAILURE, NOT A WARNING. A
 * return host that is also a tenant's host would hand the broker's `code` and
 * `state` to that tenant's surface first; `checkSignInReturnHost()` is the
 * model's statement of that, and this is where it bites.
 */
export function signInReturnHostFromEnv(
  tenants: readonly ServingHost[],
  consoles: readonly ConsoleHost[],
): string | null {
  const raw = process.env[SIGN_IN_RETURN_HOST_ENV]
  if (raw === undefined || raw.trim() === '') return null
  const verdict = checkSignInReturnHost(tenants, consoles, raw)
  if (!verdict.ok) {
    throw new Error(
      `${SIGN_IN_RETURN_HOST_ENV}=\`${raw}\` is refused by checkSignInReturnHost() — ` +
        `${verdict.refusal}. The shared return host must be served by nothing else (G2549).`,
    )
  }
  return raw.trim().toLowerCase()
}
