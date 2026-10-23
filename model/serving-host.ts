/**
 * ReconcileAI — the serving host. G179, G180 and G225, 23 Aug 2026.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY THIS MODULE EXISTS — THE CIRCULARITY G179 NAMES
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `docs/contracts/capability.openapi.yaml:64` says `dataPlaneHost` is *"Per-
 * tenant. Resolved at sign-in, never guessed."* and nothing anywhere said HOW.
 * G179's own words: *"The hole it closes is circular and the repo already knew
 * about it."* You need the host to sign in, and the host is resolved at
 * sign-in. Before this file:
 *
 *     grep -rniE '\b(servingHost|tenantHost|hostname|publicSuffix)\b' \
 *       model/*.ts                                              → nothing
 *
 * There was no serving-host concept in the model at all, which meant the
 * tenant a session is bound to had **no server-side source** and invariant 1's
 * derivation had nothing to derive from.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 RESOLUTION IS A CONFIGURATION LOOKUP, NEVER A PATTERN
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `tenant = subdomain(host)` breaks the moment a customer serves from its own
 * domain under BYOA (G36), where **there is no tenant label to parse** — and
 * it breaks SILENTLY, because every pooled tenant goes on working. The one
 * place this module takes a hostname apart is `checkServingHostRegistration()`
 * below, which is an operator-initiated act off the sign-in path. That is
 * G231's shape one row over: *"DNS IS READ EXACTLY ONCE, AND NOT HERE: at
 * verification, which is an operator-initiated act off the sign-in path."*
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS IS NOT `IdentityConnection.domains` AND MAY NOT REACH IT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * G179, verbatim: *"DO NOT OVERLOAD `IdentityConnection.domains` … that field
 * is a DNS-verified email domain list for home-realm matching — 'Routing
 * chooses the door; the door decides'. **Which identity provider to try and
 * which tenant is being served are two different questions**, and
 * one field answering both is one field that can disagree with itself."*
 *
 * Nothing below imports, names or reads `IdentityConnection`, `DomainClaim`,
 * `routeToConnection()` or `normaliseClaimedDomain()`.
 * `tests/model/serving-host.test.ts` sweeps this file's own bytes for all
 * five, so the prohibition is executable rather than remembered.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY A NEW MODULE, AND WHY BOTH HALVES ARE IN IT — G225
 * ══════════════════════════════════════════════════════════════════════════
 *
 * G225 permits new modules in `model/` and rules that the seven promised files
 * land. #227's landing slot named `model/access.ts` and this file takes the
 * same exception `model/session.ts` took from #226, for a reason that is
 * specific rather than stylistic: **`checkHostBinding()` and
 * `resolveServingHost()` must agree, byte for byte, on what "the same host"
 * means.** `normaliseHost()` is declared once and both call it, in the file
 * that declares it. A comparison anyone can re-implement is a comparison that
 * will differ, and splitting the two across `access.ts` and here would put a
 * module boundary between two functions whose whole correctness is that they
 * agree.
 *
 * Two obligations travel with a new module and both are met: a VALUE import
 * must carry its `.ts` extension — there are no value imports here, only
 * `import type`, so the obligation is satisfied and stays satisfied only while
 * that is true — and `MODULE_COUNT` in
 * `tests/model/runtime-importability.test.ts` moved with this file rather than
 * being left to fail.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT IS DELIBERATELY NOT HERE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * NO CLOCK, anywhere. `checkHostBinding()` compares two strings and
 * `resolveServingHost()` reads a table; neither has anything to compare a time
 * against. `mayRouteToConnection()` states the rule this follows: *"a function
 * accepting a parameter it does not read is a lie about what decides"*, and
 * `noUnusedParameters` would refuse one anyway. Session LIVENESS — revocation,
 * expiry, a disabled user — is `resolveSubject()` in `model/access.ts`, and
 * keeping the two apart is what lets each be total over what it actually
 * reads. **#227's body writes the signature as `checkHostBinding(session,
 * presentedHost, now)`; the clock is not taken, and this paragraph is why.**
 *
 * NO REVOKING WRITE. `checkHostBinding()` returns an INSTRUCTION as a value.
 * The model is types and total functions; the write belongs to the caller.
 *
 * NO PUBLIC SUFFIX LIST, no registrable-domain fold, no port stripping. Each
 * of those is a decision about what counts as the same place, and **G182 —
 * which forces the tenant-serving domain onto a second domain and onto the
 * Public Suffix List, with a timing the ruling calls one-way — is ruled and
 * unbuilt.** A normaliser reaching for a PSL here would pre-empt it.
 *
 * NO AWS RESOURCE AND NO CLAIM THAT ANY REGION IS PROVISIONED. `REGION_HOST_LABEL`
 * names a label for every declared `RegionKey`; naming one asserts nothing
 * about whether a plane runs there. G101 puts phase one on a disposable local
 * Postgres with no AWS resource of any kind.
 */

import type { RegionKey } from './domain'
import type { Session } from './domain'
import type { TenantId, Timestamp } from './kernel'
import type { AssertNoTenantDeep } from './session-mint'

type Assert<T extends true> = T

/* ------------------------------------------------------------------ *
 * 1. The one host normalisation
 * ------------------------------------------------------------------ */

/**
 * THE ONLY HOST NORMALISER IN `model/`, AND IT IS FROZEN.
 *
 * `Session.issuedHost`'s docblock names the failure it exists to prevent: *"A
 * HOST COMPARISON IS CASE-INSENSITIVE, and a bare `!==` refuses a legitimate
 * request on a capitalised Host … The failure is closed rather than open,
 * which is why it would be found by a customer and not by a test."* It also
 * names `normaliseClaimedDomain()` as *"the shape to copy"* — COPY, not reuse,
 * for G179's reason: which directory to try and which host is being served are
 * two different questions.
 *
 * 🛑 WHAT IT DOES: trims surrounding whitespace and folds case. DNS is
 * case-insensitive, so `APP.Example` and `app.example` are the same host.
 *
 * 🛑 WHAT IT DELIBERATELY DOES NOT DO, and every omission is load-bearing:
 *
 *   · It does not strip a PORT. `issuedHost` is written from validated
 *     configuration at mint time, so a deployment serving on a non-default
 *     port configures one; stripping it here would be the normaliser deciding
 *     that two different configured values name the same place. The refusal is
 *     CLOSED, which is the correct direction for a control whose open failure
 *     is a cross-tenant upload.
 *   · It does not strip a TRAILING DOT. `app.example.` and `app.example` are
 *     the same name in DNS and are NOT the same cookie scope in a browser, and
 *     this comparison exists to defend a cookie scope.
 *   · It does not fold to a registrable domain and does not consult a public
 *     suffix list. That is G182's decision and G182 is unbuilt.
 *
 * Everything after this call is BYTE-EXACT equality. That is the whole design:
 * a suffix-tolerant compare admits the sibling subdomain a takeover hands an
 * attacker, and `tests/model/session-host-binding.test.ts` fails on `endsWith`
 * by name.
 */
export function normaliseHost(host: string): string {
  return host.trim().toLowerCase()
}

/* ------------------------------------------------------------------ *
 * 2. The session's host binding — G180
 * ------------------------------------------------------------------ */

/**
 * G180, and the binding is PERMANENT AND ADDITIVE.
 *
 * *"The session record stores the host it was issued on, and any request whose
 * Host differs is refused and the session revoked."* This is the control that
 * survives a hostile sibling: cookie tossing and subdomain takeover both work
 * by getting a browser to send the right cookie to the wrong place, and
 * neither survives a server-side host-equality check.
 *
 * 🛑 THE BINDING IS PERMANENT AND ADDITIVE — G180, verbatim: *"A tenant may
 * GAIN a second host; it never MOVES between hosts."* Migration
 * is the failure path: it invalidates every host-bound session — a mass logout
 * during what the customer was told is an upgrade — breaks the exact
 * `redirect_uri` match RFC 9700 requires, changes the SAML entityID at the
 * customer's own identity provider, and orphans every stored absolute URL.
 *
 * 🛑 THE OBVIOUS FIX FOR ALL OF THAT IS THE CHANGE THIS CONTROL EXISTS TO MAKE
 * IMPOSSIBLE: keep both hosts and widen the session cookie to `Domain=`. That
 * single change makes every tenant's session cookie visible to every sibling
 * and **upgrades subdomain takeover from serious to total.** The pressure
 * toward it is commercial and arrives during a sales-driven migration, which
 * is precisely why G180 rules it rather than leaving it to review. If you are
 * reading this because someone asked for `Domain=`, that request is what this
 * function is for.
 *
 * ⚠️ AN OPAQUE HANDLE IS A REAL PROPERTY AND A DIFFERENT ONE. `model/access.ts`
 * refuses the JWT shape by name — *"A REFERENCE, NOT A BEARER TOKEN"* — which
 * kills forgery and makes revocation instant. G180 states the limit in as many
 * words: **OPAQUE SESSIONS DO NOT HELP HERE AND NO DOCUMENT MAY IMPLY THEY
 * DO**, because the attacker does not want the victim's session; the attacker
 * wants the victim on THEIRS. For a reconciliation product the harm is exact:
 * the victim uploads their own bank statements into the attacker's tenant.
 *
 * ⚠️ G181 — no WAF rule, listener rule, log field or metric may key on SNI, so
 * this check has **no edge-layer substitute.** It is the whole control.
 */
export const HOST_BINDING_REFUSALS = {
  /**
   * The presented Host differs from the one the session was issued on. The
   * session is revoked as well as refused — see `revoke` on the result.
   */
  sessionHostMismatch: 'session_host_mismatch',
  /**
   * 🛑 THE FAIL-OPEN THIS ARM CLOSES, AND IT IS THE REASON FOR THE ORDERING.
   * A session row whose `issuedHost` is empty — a mint bug, a migration
   * default, a hand-inserted row — normalises to `''`, and a request arriving
   * with no Host header normalises to `''` too. A bare equality check MATCHES
   * them and admits the request. The session's own binding is therefore
   * checked FIRST, and its absence kills the session: a session with no host
   * binding is usable on no host at all.
   */
  sessionHostNotRecorded: 'session_host_not_recorded',
  /**
   * ⚠️ REFUSED, AND IT DOES NOT REVOKE. The asymmetry is deliberate: a request
   * that names no host names no OTHER host, so there is nothing to conclude
   * about relocation. Revoking here would turn a malformed proxy, or a header
   * stripped at an edge, into a logout button anyone can pull. Nothing is
   * admitted, so the fail-closed property is intact; only the destructive half
   * is withheld.
   */
  hostNotPresented: 'host_not_presented',
} as const

export type HostBindingRefusal =
  (typeof HOST_BINDING_REFUSALS)[keyof typeof HOST_BINDING_REFUSALS]

/**
 * ⚠️ `revoke` IS A VALUE AND NEVER A SIDE EFFECT, and it is never a boolean
 * return either. #227's likeliest lazy repair is to implement the refusal
 * WITHOUT the revocation — every mismatch test still passes, and a
 * stolen-and-tossed session survives to be retried against the right host. A
 * `boolean` return could not carry the instruction at all, which is why this
 * is a union.
 *
 * The write itself belongs to the caller: this module is types and total
 * functions.
 */
export type HostBindingCheck =
  | { readonly ok: true }
  | {
      readonly ok: false
      readonly refusal: HostBindingRefusal
      readonly revoke: boolean
    }

export type _HostBindingRefusalsAreExhaustive = Assert<
  Exclude<HostBindingCheck, { ok: true }>['refusal'] extends HostBindingRefusal
    ? HostBindingRefusal extends Exclude<HostBindingCheck, { ok: true }>['refusal']
      ? true
      : false
    : false
>

/**
 * Total over stored state and one request field. No clock, no lookup, no I/O.
 *
 * THE ORDER IS THE DESIGN and it is asserted by name in the suite:
 *
 *   1. The SESSION's own binding, first — an unrecorded host would otherwise
 *      match an absent Host and admit the request.
 *   2. The PRESENTED host's presence — refuse, and do not revoke.
 *   3. Byte-exact equality on the normalised pair — refuse AND revoke.
 */
export function checkHostBinding(
  session: Session,
  presentedHost: string,
): HostBindingCheck {
  const issued = normaliseHost(session.issuedHost)
  if (issued === '') {
    return {
      ok: false,
      refusal: HOST_BINDING_REFUSALS.sessionHostNotRecorded,
      revoke: true,
    }
  }

  const presented = normaliseHost(presentedHost)
  if (presented === '') {
    return {
      ok: false,
      refusal: HOST_BINDING_REFUSALS.hostNotPresented,
      revoke: false,
    }
  }

  if (presented !== issued) {
    return {
      ok: false,
      refusal: HOST_BINDING_REFUSALS.sessionHostMismatch,
      revoke: true,
    }
  }

  return { ok: true }
}

/* ------------------------------------------------------------------ *
 * 3. The registry — one host per tenant, published downward
 * ------------------------------------------------------------------ */

/**
 * G183's two certificate shapes, which are also the two naming regimes.
 *
 * The distinction is not cosmetic: it decides whether the mint-time label
 * rules below apply at all. A pooled host is named by us and must carry the
 * region label; a delegated host is named by the customer and carries nothing
 * of ours.
 */
export const SERVING_HOST_KINDS = {
  /**
   * Under the platform's own tenant-serving domain, `{tenant}.{region}.{domain}`.
   * G183 puts one wildcard certificate per region behind these, so provisioning
   * a tenant **writes no DNS record and issues no certificate** and stays a
   * control-plane database act.
   */
  pooled: 'pooled',
  /**
   * The customer's own FQDN under BYOA. G183: delegated DNS-01 per FQDN, one
   * permanent `_acme-challenge` CNAME into a zone we own. Customer-supplied
   * certificates are refused outright and nothing here accepts one.
   */
  delegated: 'delegated',
} as const

export type ServingHostKind =
  (typeof SERVING_HOST_KINDS)[keyof typeof SERVING_HOST_KINDS]

/**
 * One row of the host→tenant registry.
 *
 * 🛑 CONTROL-PLANE AUTHORED, PUBLISHED DOWNWARD, READ LOCALLY. C1 forbids a
 * control-plane call on the hot path and C2 is the publication direction, so
 * this joins the data-plane-local pull rather than becoming a lookup endpoint.
 * There is no second distribution path and this slice does not invent one.
 *
 * ⚠️ `region` IS `RegionKey` AND NOT `ForeignRegion`, AND G207 IS ANSWERED
 * RATHER THAN IGNORED. G207 rules that a foreign system's region draws from a
 * separate vocabulary *"so a residency crossing is VISIBLE IN THE TYPE"* — the
 * point being that a customer's SAP in Frankfurt is not one of OUR deployment
 * regions. A serving host is ours by construction: it is a plane we run. Its
 * region must compare EQUAL to `Tenant.residency`, which is `RegionKey`, and
 * `checkServingHostResidency()` below is that comparison. Typing this field
 * with a separate vocabulary would make the one comparison this module exists
 * for uncomparable, which is G207 inverted rather than applied.
 *
 * ⚠️ `host` IS STORED ALREADY-NORMALISED, and `checkServingHostRegistration()`
 * refuses a row that is not. Storing an unnormalised host would mean every
 * reader had to remember to fold it, which is the class of correctness that
 * lives at call sites and therefore drifts.
 */
export interface ServingHost {
  readonly kind: ServingHostKind
  /** Already normalised. See `normaliseHost()`; registration refuses otherwise. */
  readonly host: string
  readonly tenantId: TenantId
  /** Where the plane serving this host runs. Compared against `Tenant.residency`. */
  readonly region: RegionKey
  /**
   * A retired host does not route. G180's permanence is about the SESSION
   * binding and about never MOVING a tenant; a host that is withdrawn from
   * service stops answering, and saying so specifically is what stops a
   * withdrawn host reading as an unregistered one.
   */
  readonly status: 'active' | 'retired'
}

export const SERVING_HOST_REFUSALS = {
  /** No Host to look up. Refused before the registry is read at all. */
  hostNotPresented: 'host_not_presented',
  /**
   * Nobody serves this name. NOT a guess, not a parse, not a fallback — G179's
   * whole content is that there is no pattern to fall back to.
   */
  hostNotRegistered: 'host_not_registered',
  /**
   * 🛑 TWO ROWS CLAIMING ONE HOST, AND THE PRECEDENCE HERE IS DELIBERATELY NOT
   * `routeToConnection()`'s. That function counts ambiguity over VERIFIED
   * claims only, because counting unverified ones would let anyone take a
   * tenant's sign-in down by claiming its domain — *"a denial of service is
   * not an improvement on a takeover."* There is no such adversary here: this
   * registry is control-plane authored, so a duplicate is OUR configuration
   * error rather than a claim anyone can file. Every row counts, because
   * picking either one picks a TENANT and that is the derivation invariant 1
   * rests on.
   */
  hostRegisteredMoreThanOnce: 'host_registered_more_than_once',
  /** Registered and withdrawn from service. */
  hostRetired: 'host_retired',
} as const

export type ServingHostRefusal =
  (typeof SERVING_HOST_REFUSALS)[keyof typeof SERVING_HOST_REFUSALS]

/**
 * Returns a tenant and a region, never a `ServingHost`. The caller needs the
 * two facts; handing back the row invites somebody to read `host` off it and
 * start comparing against a value that has already been compared.
 */
export type ServingHostResolution =
  | { readonly ok: true; readonly tenantId: TenantId; readonly region: RegionKey }
  | { readonly ok: false; readonly refusal: ServingHostRefusal }

export type _ServingHostRefusalsAreExhaustive = Assert<
  Exclude<ServingHostResolution, { ok: true }>['refusal'] extends ServingHostRefusal
    ? ServingHostRefusal extends Exclude<ServingHostResolution, { ok: true }>['refusal']
      ? true
      : false
    : false
>

/**
 * THE LOOKUP. Total, fail-closed at every branch, and **it contains no
 * `split`, no `indexOf` on a dot, and no substring of the presented host.**
 *
 * 🛑 THE MUTATION THIS SHAPE EXISTS TO SURVIVE is `host.split('.')[0]`.
 * Implemented that way, every pooled tenant resolves correctly and exactly one
 * case fails: a customer serving from its own domain, where the leftmost label
 * is a department rather than a tenant. That is the silent break G179 names,
 * and `tests/model/serving-host.test.ts` keeps a pooled case beside the BYOA
 * case precisely so the asymmetry is visible when it happens.
 *
 * The order mirrors `routeToConnection()` where the reasoning matches and
 * departs where it does not — see `hostRegisteredMoreThanOnce` above.
 */
export function resolveServingHost(
  registry: readonly ServingHost[],
  host: string,
): ServingHostResolution {
  const key = normaliseHost(host)
  if (key === '') {
    return { ok: false, refusal: SERVING_HOST_REFUSALS.hostNotPresented }
  }

  const matches = registry.filter((entry) => normaliseHost(entry.host) === key)
  if (matches.length === 0) {
    return { ok: false, refusal: SERVING_HOST_REFUSALS.hostNotRegistered }
  }
  if (matches.length > 1) {
    return {
      ok: false,
      refusal: SERVING_HOST_REFUSALS.hostRegisteredMoreThanOnce,
    }
  }

  const only = matches[0]
  if (only === undefined) {
    return { ok: false, refusal: SERVING_HOST_REFUSALS.hostNotRegistered }
  }
  if (only.status !== 'active') {
    return { ok: false, refusal: SERVING_HOST_REFUSALS.hostRetired }
  }

  return { ok: true, tenantId: only.tenantId, region: only.region }
}

/* ------------------------------------------------------------------ *
 * 4. Mint-time rules on the tenant label
 * ------------------------------------------------------------------ */

/**
 * G179 names the list and G97 names the place: a reserved-label list *"that
 * becomes a MINT-TIME RULE on the tenant slug — the same place G97 puts
 * id-format rules, for the same reason."* G97's reason, verbatim: *"the
 * database enforces no format, so `ten_acme` and `ten_ACME` are both storable;
 * preventing that is a mint-time rule in `model/`, not a column constraint."*
 *
 * ⚠️ SIX, AND THEY ARE G179's SIX. Adding a seventh is a decision about what
 * the platform reserves under its own tenant-serving domain, and belongs in a
 * G row rather than in this array.
 */
export const RESERVED_HOST_LABELS = [
  'www',
  'api',
  'app',
  'admin',
  'status',
  'control',
] as const

/**
 * The hostname label for each deployment region, `{tenant}.{region}.{domain}`.
 *
 * ⚠️ TOTAL OVER `RegionKey`, AND IT BITES BECAUSE THIS MODULE CONSTRUCTS IT —
 * §5.10's condition, met rather than assumed. A sixth deployment region added
 * to `RegionKey` with no hostname label is a compile error here rather than a
 * tenant that cannot be named.
 *
 * ⚠️ IT IS AN IDENTITY MAP TODAY AND THAT IS NOT REDUNDANCY. A region's
 * DEPLOYMENT key and its HOSTNAME label are two vocabularies that happen to
 * agree. **G182 forces the tenant-serving domain onto a second domain and onto
 * the Public Suffix List before the first tenant hostname is published, and
 * its timing is one-way**; if a shorter or non-AWS-shaped label is chosen
 * then, this is the one place it changes. Writing `region` where a label is
 * meant would spread that decision across every call site.
 *
 * 🛑 NAMING A REGION HERE ASSERTS NOTHING ABOUT WHETHER A PLANE RUNS IN IT.
 * `RegionKey` already declares five and the record calls two live; G101 puts
 * phase one on a disposable local Postgres with no AWS resource of any kind.
 * This is a naming vocabulary, not a deployment claim.
 */
export const REGION_HOST_LABEL: Record<RegionKey, string> = {
  'ap-southeast-1': 'ap-southeast-1',
  'ap-southeast-2': 'ap-southeast-2',
  'us-west-2': 'us-west-2',
  'ap-south-1': 'ap-south-1',
  'eu-west-1': 'eu-west-1',
}

export const HOST_LABEL_REFUSALS = {
  /** Nothing to check. Its own arm because absence is not malformation. */
  hostLabelEmpty: 'host_label_empty',
  /**
   * Not `[a-z0-9]([a-z0-9-]*[a-z0-9])?`, or longer than 63 octets. Lowercase
   * is required rather than folded: a slug is MINTED here, and minting a
   * capitalised one and folding it later is exactly G97's `ten_acme` versus
   * `ten_ACME`.
   */
  hostLabelMalformed: 'host_label_malformed',
  /** One of `RESERVED_HOST_LABELS`. */
  hostLabelReserved: 'host_label_reserved',
  /**
   * The slug is a region label, which makes `{tenant}.{region}.{domain}`
   * ambiguous. Separate from the reserved list so the refusal says which rule
   * was broken — a residency ambiguity is a different finding from a naming
   * collision, and folding them loses that.
   */
  hostLabelIsARegion: 'host_label_is_a_region',
} as const

export type HostLabelRefusal =
  (typeof HOST_LABEL_REFUSALS)[keyof typeof HOST_LABEL_REFUSALS]

export type HostLabelCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly refusal: HostLabelRefusal }

export type _HostLabelRefusalsAreExhaustive = Assert<
  Exclude<HostLabelCheck, { ok: true }>['refusal'] extends HostLabelRefusal
    ? HostLabelRefusal extends Exclude<HostLabelCheck, { ok: true }>['refusal']
      ? true
      : false
    : false
>

/** One DNS label: 1–63 octets, lowercase alphanumeric and hyphen, no edge hyphen. */
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

/**
 * The mint-time rule on a tenant slug that will appear in a pooled hostname.
 *
 * Total, and it takes the label rather than the whole host: a rule that took a
 * host would have to parse one, and the only place this module parses is
 * `checkServingHostRegistration()` below, which calls this with the label it
 * already isolated.
 */
export function checkTenantHostLabel(label: string): HostLabelCheck {
  if (label === '') {
    return { ok: false, refusal: HOST_LABEL_REFUSALS.hostLabelEmpty }
  }
  if (!DNS_LABEL.test(label)) {
    return { ok: false, refusal: HOST_LABEL_REFUSALS.hostLabelMalformed }
  }
  if ((RESERVED_HOST_LABELS as readonly string[]).includes(label)) {
    return { ok: false, refusal: HOST_LABEL_REFUSALS.hostLabelReserved }
  }
  if (Object.values(REGION_HOST_LABEL).includes(label)) {
    return { ok: false, refusal: HOST_LABEL_REFUSALS.hostLabelIsARegion }
  }
  return { ok: true }
}

/* ------------------------------------------------------------------ *
 * 5. Registration — the one place a hostname is taken apart
 * ------------------------------------------------------------------ */

export const SERVING_HOST_REGISTRATION_REFUSALS = {
  /** `host` is not already the value `normaliseHost()` would produce. */
  hostNotNormalised: 'host_not_normalised',
  /** A pooled host with fewer than three labels cannot carry `{tenant}.{region}`. */
  hostTooShortToCarryARegionLabel: 'host_too_short_to_carry_a_region_label',
  /**
   * 🛑 THE FAIL-OPEN G179 NAMES. *"A flat wildcard is cryptographically valid
   * in EVERY region, so an EU tenant misrouted to a US plane FAILS OPEN AND IS
   * INVISIBLE; a region label makes that misroute fail closed at TLS."* A
   * pooled host whose second label disagrees with the row's `region` is a host
   * that would be served by the wrong plane's wildcard and never complain.
   */
  regionLabelDisagreesWithRegion: 'region_label_disagrees_with_region',
  /** The leftmost label failed `checkTenantHostLabel()`. */
  tenantLabelRefused: 'tenant_label_refused',
} as const

export type ServingHostRegistrationRefusal =
  (typeof SERVING_HOST_REGISTRATION_REFUSALS)[keyof typeof SERVING_HOST_REGISTRATION_REFUSALS]

export type ServingHostRegistration =
  | { readonly ok: true }
  | {
      readonly ok: false
      readonly refusal: ServingHostRegistrationRefusal
      /** Present only when the leftmost label was the thing refused. */
      readonly labelRefusal: HostLabelRefusal | null
    }

export type _RegistrationRefusalsAreExhaustive = Assert<
  Exclude<ServingHostRegistration, { ok: true }>['refusal'] extends ServingHostRegistrationRefusal
    ? ServingHostRegistrationRefusal extends Exclude<
        ServingHostRegistration,
        { ok: true }
      >['refusal']
      ? true
      : false
    : false
>

/**
 * 🛑 THE ONLY PLACE IN THIS MODULE A HOSTNAME IS TAKEN APART, AND IT IS NOT ON
 * THE SIGN-IN PATH. G179 forbids RESOLUTION by pattern. It does not forbid
 * checking, once, at registration, that a pooled host was named the way the
 * ruling says pooled hosts are named — and that check is an operator-initiated
 * act, which is the same seam G231 uses for DNS.
 *
 * 🛑 A DELEGATED HOST IS EXEMPT FROM EVERY LABEL RULE, AND THE EXEMPTION IS THE
 * POINT. Under BYOA the customer names the host: `admin` is reserved in OUR
 * namespace and means nothing in theirs, and there is no tenant label and no
 * region label to check. **Applying the pooled rules to a delegated row makes
 * BYOA unregisterable, which is how the circularity arose in the first place.**
 * Residency is still checkable for it, because `region` is STATED on the row
 * rather than read off the name — which is the same fact that makes resolution
 * a lookup.
 */
export function checkServingHostRegistration(
  entry: ServingHost,
): ServingHostRegistration {
  if (entry.host !== normaliseHost(entry.host) || entry.host === '') {
    return {
      ok: false,
      refusal: SERVING_HOST_REGISTRATION_REFUSALS.hostNotNormalised,
      labelRefusal: null,
    }
  }

  if (entry.kind === SERVING_HOST_KINDS.delegated) return { ok: true }

  const labels = entry.host.split('.')
  if (labels.length < 3) {
    return {
      ok: false,
      refusal: SERVING_HOST_REGISTRATION_REFUSALS.hostTooShortToCarryARegionLabel,
      labelRefusal: null,
    }
  }

  const tenantLabel = labels[0] ?? ''
  const label = checkTenantHostLabel(tenantLabel)
  if (!label.ok) {
    return {
      ok: false,
      refusal: SERVING_HOST_REGISTRATION_REFUSALS.tenantLabelRefused,
      labelRefusal: label.refusal,
    }
  }

  if ((labels[1] ?? '') !== REGION_HOST_LABEL[entry.region]) {
    return {
      ok: false,
      refusal: SERVING_HOST_REGISTRATION_REFUSALS.regionLabelDisagreesWithRegion,
      labelRefusal: null,
    }
  }

  return { ok: true }
}

/* ------------------------------------------------------------------ *
 * 6. Residency — invariant 7, held by a total function
 * ------------------------------------------------------------------ */

export const RESIDENCY_REFUSALS = {
  /**
   * The row serves a different tenant. Checked FIRST: without it the function
   * compares one tenant's residency against another tenant's plane and reports
   * agreement, which is a residency check passing for the wrong reason.
   */
  hostIsNotThisTenants: 'host_is_not_this_tenants',
  /** The plane's region and the tenant's residency disagree. Fails closed. */
  regionDoesNotMatchResidency: 'region_does_not_match_residency',
} as const

export type ResidencyRefusal =
  (typeof RESIDENCY_REFUSALS)[keyof typeof RESIDENCY_REFUSALS]

export type ResidencyAgreement =
  | { readonly ok: true }
  | { readonly ok: false; readonly refusal: ResidencyRefusal }

export type _ResidencyRefusalsAreExhaustive = Assert<
  Exclude<ResidencyAgreement, { ok: true }>['refusal'] extends ResidencyRefusal
    ? ResidencyRefusal extends Exclude<ResidencyAgreement, { ok: true }>['refusal']
      ? true
      : false
    : false
>

/**
 * INVARIANT 7, held at the routing layer.
 *
 * A flat wildcard is cryptographically valid in every region, so **an EU
 * tenant misrouted to a US plane fails open and is invisible.** The region
 * label makes that misroute fail closed at TLS; this makes it fail closed in
 * the model as well, before any TLS exists to fail at.
 *
 * ⚠️ IT IS A SECOND EXECUTABLE RESIDENCY CHECK AND IT DOES NOT SUBSTITUTE FOR
 * `resolveModel()`. Invariant 7 is about inference routing — `global.*` model
 * routing rejected outright — and this is about request routing. **Two live
 * fields still reach a model without passing `resolveModel()`, and nothing
 * here narrows that.** No document produced by this slice may say the sweep
 * closed E5.
 *
 * ⚠️ THE TENANT IS NARROWED TO `{ id, residency }` RATHER THAN TAKING A
 * `Tenant`, for `PrincipalContext.subject`'s reason: a routing decision has no
 * business reaching a processing purpose, a retention policy or a support
 * access mode, and a parameter that offers them is a parameter somebody reads.
 */
export function checkServingHostResidency(
  entry: ServingHost,
  tenant: { readonly id: TenantId; readonly residency: RegionKey },
): ResidencyAgreement {
  if (entry.tenantId !== tenant.id) {
    return { ok: false, refusal: RESIDENCY_REFUSALS.hostIsNotThisTenants }
  }
  if (entry.region !== tenant.residency) {
    return { ok: false, refusal: RESIDENCY_REFUSALS.regionDoesNotMatchResidency }
  }
  return { ok: true }
}

/* ------------------------------------------------------------------ *
 * 7. The consoles — hosts that serve NO tenant. G726, 19 Sep 2026.
 * ------------------------------------------------------------------ */

/**
 * 🛑 THE OWNER'S RULING OF 19 Sep 2026, AND THE COST IT NAMED WHEN TAKING IT.
 *
 * *"The data plane serves the console hosts, with tenant-less sessions.
 * `session.tenant_id = NULL` is legal. The data plane already has sessions,
 * cookies, `decide()` and invariant 10's minting; reuse them rather than
 * building a third process or teaching the control plane a second copy of all
 * four seams."*
 *
 * And, in the same breath: **"G179's host→tenant resolution and G180's
 * revoke-on-mismatch both assume a tenant, and a tenant-less session is a new
 * shape in the one place those invariants are enforced."** This section is that
 * new shape, and every paragraph below is an account of what it costs one of
 * the two.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 G180 IS UNCHANGED AND GETS NO EXCEPTION. MEASURED, NOT ASSUMED.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `checkHostBinding()` above compares `Session.issuedHost` against the
 * presented Host and knows nothing about tenants: it reads two strings, and
 * neither of them is a tenant id. A console session is issued on a console host
 * and used there, so the equality holds for exactly the reason it holds
 * everywhere else. **Nothing in this section is reachable from that function,
 * and `tests/model/console-host.test.ts` §4 sweeps this file's own bytes to
 * keep it that way** — G315 chose its whole shape so that G180 would keep
 * having no exceptions, and an exception added here would be the first.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 G179 IS UNCHANGED TOO, AND THIS IS THE HALF THAT NEEDED THE ARGUMENT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * *"RESOLUTION IS A CONFIGURATION LOOKUP, NEVER A PATTERN."* A console host is
 * in no tenant's registry, and the tempting repair is a PATTERN — *"a host
 * whose leftmost label is `console` is the staff console"* — which is
 * `host.split('.')[0]` wearing a different hat and fails in the same silent
 * direction the moment a customer under BYOA (G36) serves from a domain whose
 * leftmost label happens to be `console`. **So a console host resolves the same
 * way a tenant host does: by being in a registry somebody wrote down.** There
 * is no `split`, no `indexOf` on a dot and no substring of a presented host in
 * `resolveConsoleHost()`, exactly as there is none in `resolveServingHost()`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHY A SECOND REGISTRY RATHER THAN A THIRD `ServingHostKind`.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `ServingHost` carries a `tenantId: TenantId` and a `region: RegionKey`, both
 * required, and a console has NEITHER:
 *
 *   · NO TENANT. That is the whole point — the surface exists to be reached by
 *     a principal who holds none. A `tenantId` on a console row would be a
 *     field every reader has to remember to ignore, and the one that forgets
 *     binds a console session to a tenant.
 *   · NO REGION, AND THIS ONE IS G297's. *"THE CONSOLES STAY FLAT because a
 *     console has no tenant and a region label on one would assert a residency
 *     invariant 3 says the control plane does not have."* A `region` on a
 *     console row would be exactly that assertion, typed.
 *
 * ⚠️ AND MAPPING A CONSOLE ONTO `delegated` WOULD HAVE COMPILED. That kind
 * returns `ok` immediately from `checkServingHostRegistration()`, so
 * `console.reconcileai.app|ten_console|us-west-2|delegated|active` loads
 * without a single label rule being applied to it. **That is §5.1 in one line**:
 * keying on the convenient landmark — the exemption — instead of on the
 * property, which is that the CUSTOMER names a delegated host and WE name this
 * one. It would also have minted a fictional tenant to satisfy a column.
 */
export const CONSOLE_KINDS = {
  /** `console.reconcileai.app` — G297. Six destinations over three staff roles. */
  staff: 'staff',
  /**
   * `partners.reconcileai.app` — G297.
   *
   * 🛑 DECLARED AS A HOST AND NOT AS A PRINCIPAL, AND THE DISTINCTION IS G602's.
   * That row records `partner-portal-role` (9 operations) as *"not built at
   * all: nothing in `model/` declares the principal and `ORG_CLASSES` has three
   * members"*, and `tests/contracts/administration-evaluators.test.mjs` §4 is a
   * tripwire that reddens the day one is declared. **Naming the host declares
   * no principal**: `ORG_CLASSES` is untouched by this section, `decide()`
   * gains no arm, and a partner-console session is evaluated by exactly the
   * same four arms every other session is. The tripwire stays green and it
   * should.
   *
   * ✅ **THE PRINCIPAL WAS DECLARED ON 1 Oct 2026 — R10, THE OWNER'S — AND THE
   * PARAGRAPH ABOVE IS CORRECTED RATHER THAN DELETED**, because its first
   * sentence is still exactly true and its last three are not. This entry is
   * still a HOST and still declares nothing. What moved is elsewhere:
   * `model/access.ts` §6c declares `PartnerRole` and `PartnerRoleAssignment`,
   * `decide()` gains a FIFTH arm, and the §4 tripwire fired and was rewritten
   * as a positive assertion. **`ORG_CLASSES` is STILL three** — the fifth arm
   * dispatches on the capability's class, not on a new organisation — and a
   * partner-console session's portal-role term is read in
   * `server/data-plane/session.ts`'s console arm.
   */
  partner: 'partner',
} as const

export type ConsoleKind = (typeof CONSOLE_KINDS)[keyof typeof CONSOLE_KINDS]

/**
 * One row of the console registry.
 *
 * 🛑 CONTROL-PLANE AUTHORED, PUBLISHED DOWNWARD, READ LOCALLY — `ServingHost`'s
 * own note, and it applies here unchanged including the part that is not yet
 * true: the publication path does not exist, and
 * `server/data-plane/serving-hosts.ts` reads the plane's own environment as a
 * named stand-in for it. This section invents no second distribution path.
 *
 * ⚠️ `host` IS STORED ALREADY-NORMALISED, for `ServingHost.host`'s reason: a
 * reader that had to remember to fold it is correctness living at call sites.
 */
export interface ConsoleHost {
  /** Already normalised. See `normaliseHost()`; registration refuses otherwise. */
  readonly host: string
  readonly console: ConsoleKind
  /** A retired console does not answer. `ServingHost.status`'s argument, unchanged. */
  readonly status: 'active' | 'retired'
}

/**
 * ⚠️ `SERVING_HOST_REFUSALS` IS REUSED AND NOT TWINNED, WHICH IS THIS
 * REPOSITORY'S OWN DISCIPLINE APPLIED ONE AXIS OVER.
 * `TENANT_SELECTION_REFUSALS.membershipAbsent` states it for wire codes —
 * *"REUSED, NOT MINTED … minting a session-flavoured twin of each would have
 * been the transcription defect"* — and the four facts here are the same four
 * facts: nothing was presented, nobody serves this name, two rows claim it, it
 * was withdrawn. A `CONSOLE_HOST_REFUSALS` holding four identical strings would
 * be a second place for them to drift and a second set for a reader to compare.
 */
export type ConsoleHostResolution =
  | { readonly ok: true; readonly console: ConsoleKind }
  | { readonly ok: false; readonly refusal: ServingHostRefusal }

/**
 * THE CONSOLE LOOKUP. Total, fail-closed at every branch, and — like
 * `resolveServingHost()` — **it contains no `split`, no `indexOf` on a dot and
 * no substring of the presented host.**
 *
 * 🛑 THE MUTATION THIS SHAPE EXISTS TO SURVIVE is `host.startsWith('console.')`.
 * Implemented that way every deployment of ours resolves correctly and exactly
 * one case fails: a BYOA customer whose own domain begins with that label, who
 * is then served the staff console's surface on their own hostname. That is
 * G179's silent break arriving on the other registry, and
 * `tests/model/console-host.test.ts` §1 keeps a `console.northwind.example`
 * BYOA row beside the real one so the asymmetry is visible when it happens.
 */
export function resolveConsoleHost(
  registry: readonly ConsoleHost[],
  host: string,
): ConsoleHostResolution {
  const key = normaliseHost(host)
  if (key === '') {
    return { ok: false, refusal: SERVING_HOST_REFUSALS.hostNotPresented }
  }

  const matches = registry.filter((entry) => normaliseHost(entry.host) === key)
  if (matches.length === 0) {
    return { ok: false, refusal: SERVING_HOST_REFUSALS.hostNotRegistered }
  }
  if (matches.length > 1) {
    return {
      ok: false,
      refusal: SERVING_HOST_REFUSALS.hostRegisteredMoreThanOnce,
    }
  }

  const only = matches[0]
  if (only === undefined) {
    return { ok: false, refusal: SERVING_HOST_REFUSALS.hostNotRegistered }
  }
  if (only.status !== 'active') {
    return { ok: false, refusal: SERVING_HOST_REFUSALS.hostRetired }
  }

  return { ok: true, console: only.console }
}

export const CONSOLE_HOST_REGISTRATION_REFUSALS = {
  /** `host` is not already the value `normaliseHost()` would produce. */
  hostNotNormalised: 'host_not_normalised',
  /**
   * 🛑 G297, AS A REGISTRATION RULE. *"THE CONSOLES STAY FLAT because a console
   * has no tenant and a region label on one would assert a residency invariant
   * 3 says the control plane does not have."* A console host carrying one of
   * `REGION_HOST_LABEL`'s values as a label is that assertion made by
   * configuration, and it fails in the direction that reads as safe: nothing
   * breaks, and the deployment now claims a residency posture for a surface
   * that has none.
   *
   * ⚠️ IT IS A PARSE AND IT IS LAWFUL HERE FOR `checkServingHostRegistration()`'s
   * OWN REASON, quoted rather than re-derived: *"THE ONLY PLACE IN THIS MODULE
   * A HOSTNAME IS TAKEN APART, AND IT IS NOT ON THE SIGN-IN PATH … that check
   * is an operator-initiated act."* Loading a registry is that act. Nothing on
   * the sign-in path reaches this function.
   */
  consoleHostCarriesARegionLabel: 'console_host_carries_a_region_label',
} as const

export type ConsoleHostRegistrationRefusal =
  (typeof CONSOLE_HOST_REGISTRATION_REFUSALS)[keyof typeof CONSOLE_HOST_REGISTRATION_REFUSALS]

export type ConsoleHostRegistration =
  | { readonly ok: true }
  | { readonly ok: false; readonly refusal: ConsoleHostRegistrationRefusal }

export type _ConsoleRegistrationRefusalsAreExhaustive = Assert<
  Exclude<
    ConsoleHostRegistration,
    { ok: true }
  >['refusal'] extends ConsoleHostRegistrationRefusal
    ? ConsoleHostRegistrationRefusal extends Exclude<
        ConsoleHostRegistration,
        { ok: true }
      >['refusal']
      ? true
      : false
    : false
>

/**
 * The console mirror of `checkServingHostRegistration()`, and it is SHORTER
 * rather than simpler.
 *
 * 🛑 THERE IS NO TENANT-LABEL RULE AND NO MINIMUM LABEL COUNT, BECAUSE THERE IS
 * NO `{tenant}.{region}` TO CARRY. `RESERVED_HOST_LABELS` reserves six labels
 * in the TENANT-serving namespace, and after G297 the two grammars no longer
 * share one: tenants are `{tenant}.{region}.{domain}` under `*.{region}.{domain}`
 * and consoles are flat under `*.{domain}`. Applying the tenant rules here
 * would refuse `console.reconcileai.app` for carrying two labels, which is the
 * shape G297 chose.
 *
 * ⚠️ WHAT STOPS A CONSOLE AND A TENANT CLAIMING ONE NAME IS NOT A LABEL RULE.
 * It is `resolveServedHost()` below, which reads BOTH registries and refuses a
 * host that appears in both — a lookup, not a parse, and therefore the only
 * control that still works under BYOA where we name nothing at all.
 */
export function checkConsoleHostRegistration(
  entry: ConsoleHost,
): ConsoleHostRegistration {
  if (entry.host !== normaliseHost(entry.host) || entry.host === '') {
    return {
      ok: false,
      refusal: CONSOLE_HOST_REGISTRATION_REFUSALS.hostNotNormalised,
    }
  }

  const labels = entry.host.split('.')
  const regionLabels: readonly string[] = Object.values(REGION_HOST_LABEL)
  if (labels.some((label) => regionLabels.includes(label))) {
    return {
      ok: false,
      refusal: CONSOLE_HOST_REGISTRATION_REFUSALS.consoleHostCarriesARegionLabel,
    }
  }

  return { ok: true }
}

/* ------------------------------------------------------------------ *
 * 8. The one entry point — which SURFACE a request arrived on
 * ------------------------------------------------------------------ */

/**
 * 🛑 TWO MEMBERS, AND THE SECOND ONE IS THE WHOLE SLICE. This is the term
 * `resolveSubject()` takes so that *"a session with no tenant"* can mean two
 * different things without either of them being guessed:
 *
 *   `tenant`   a tenant host. A session with no tenant is UNSCOPED — D1's own
 *              caller — and holds no authority until D1 binds one.
 *   `console`  a console host. A session with no tenant is CORRECTLY SHAPED,
 *              and a session WITH one is a defect.
 *
 * ⚠️ IT IS NOT DERIVABLE FROM `session.tenantId` AND THE ATTEMPT IS THE DEFECT.
 * Reading *"unbound therefore console"* off the session would make every
 * pre-selection session a console session, which deletes
 * `SESSION_REFUSALS.tenantNotSelected` and hands a principal to every caller
 * standing in front of D1. **The surface is a fact about the HOST, it comes
 * from a registry, and G179 is why.**
 */
export const SERVED_SURFACE_KINDS = {
  tenant: 'tenant',
  console: 'console',
} as const

export type ServedSurfaceKind =
  (typeof SERVED_SURFACE_KINDS)[keyof typeof SERVED_SURFACE_KINDS]

/**
 * What a host serves. A DISCRIMINATED UNION rather than a record with nullable
 * fields, deliberately: **a console surface has no `tenantId` property to
 * read**, so binding one is a compile error rather than a value somebody has to
 * remember to check. That is `ResolvedSubject`'s shape one layer down, for the
 * same reason and in the same commit.
 */
export type ServedSurface =
  | {
      readonly kind: typeof SERVED_SURFACE_KINDS.tenant
      readonly tenantId: TenantId
      readonly region: RegionKey
    }
  | {
      readonly kind: typeof SERVED_SURFACE_KINDS.console
      readonly console: ConsoleKind
    }

export const SERVED_HOST_REFUSALS = {
  ...SERVING_HOST_REFUSALS,
  /**
   * 🛑 ONE NAME, TWO REGISTRIES — OUR CONFIGURATION ERROR, AND IT REFUSES BOTH
   * SURFACES RATHER THAN PICKING ONE.
   *
   * This is `hostRegisteredMoreThanOnce`'s argument across the registry
   * boundary: *"picking either one picks a TENANT and that is the derivation
   * invariant 1 rests on."* Here picking either one picks whether a session may
   * exist without a tenant at all, which is strictly larger. A deployment that
   * registers `console.reconcileai.app` as a delegated tenant host AND as the
   * staff console serves neither.
   *
   * ⚠️ STATUS IS NOT CONSULTED FOR THIS ARM, AND THAT IS DELIBERATE. A
   * `retired` row is still a row somebody wrote; a collision between an active
   * row and a retired one is the same configuration error, and letting the
   * retired one fall out of the count would make the refusal depend on the
   * order in which somebody withdrew things.
   */
  hostServesATenantAndAConsole: 'host_serves_a_tenant_and_a_console',
} as const

export type ServedHostRefusal =
  (typeof SERVED_HOST_REFUSALS)[keyof typeof SERVED_HOST_REFUSALS]

export type ServedHostResolution =
  | { readonly ok: true; readonly surface: ServedSurface }
  | { readonly ok: false; readonly refusal: ServedHostRefusal }

/**
 * THE ONE ENTRY POINT. Both registries, one answer, and the collision checked
 * FIRST.
 *
 * 🛑 THE ORDER IS THE DESIGN, exactly as it is on `checkHostBinding()`:
 *
 *   1. The presented host's presence. Nothing to look up.
 *   2. THE COLLISION, before either registry is allowed to answer — and before
 *      status is read on either side. A name claimed twice is refused
 *      whichever row would have won, which is the only shape that cannot be
 *      defeated by retiring one of them.
 *   3. The tenant registry, unchanged — `resolveServingHost()`, byte for byte
 *      the function every existing caller already uses.
 *   4. The console registry.
 *
 * ⚠️ THE TENANT REGISTRY IS ASKED BEFORE THE CONSOLE ONE AND THE ORDER CANNOT
 * CHANGE AN ANSWER, because step 2 has already refused every host both could
 * claim. It is written this way so the surviving path is the one that existed
 * before this section did.
 *
 * ⚠️ AND A HOST IN NEITHER REGISTRY IS `host_not_registered`, WHICH IS WHAT
 * `resolveServingHost()` ALREADY ANSWERED FOR IT. Nothing here invents a
 * default surface; the caller that has to have one says so at its own call
 * site and argues for it there.
 */
export function resolveServedHost(
  tenants: readonly ServingHost[],
  consoles: readonly ConsoleHost[],
  host: string,
): ServedHostResolution {
  const key = normaliseHost(host)
  if (key === '') {
    return { ok: false, refusal: SERVED_HOST_REFUSALS.hostNotPresented }
  }

  const claimedByATenant = tenants.some((e) => normaliseHost(e.host) === key)
  const claimedByAConsole = consoles.some((e) => normaliseHost(e.host) === key)
  if (claimedByATenant && claimedByAConsole) {
    return {
      ok: false,
      refusal: SERVED_HOST_REFUSALS.hostServesATenantAndAConsole,
    }
  }

  if (claimedByATenant) {
    const served = resolveServingHost(tenants, key)
    return served.ok
      ? {
          ok: true,
          surface: {
            kind: SERVED_SURFACE_KINDS.tenant,
            tenantId: served.tenantId,
            region: served.region,
          },
        }
      : { ok: false, refusal: served.refusal }
  }

  const console_ = resolveConsoleHost(consoles, key)
  return console_.ok
    ? {
        ok: true,
        surface: { kind: SERVED_SURFACE_KINDS.console, console: console_.console },
      }
    : { ok: false, refusal: console_.refusal }
}

/* ------------------------------------------------------------------ *
 * 9. The sign-in hand-off across hosts — G2549 (THE OWNER'S, 2 Oct 2026)
 * ------------------------------------------------------------------ */

/**
 * 🛑 THE OWNER'S RULING, VERBATIM: *"One shared callback host: all sign-ins
 * return to one fixed callback which then 303s to the tenant host via
 * resolveServingHost (a registry lookup, grant bound to the host)."* It amends
 * R4 a second time; R4's text and G2548's per-tenant callback list are kept on
 * their own rows rather than overwritten (G2761).
 *
 * THIS IS THE TYPE G1710 ASKED FOR — *"the cheapest item in the whole
 * analysis: a declared type in `model/` carrying `AssertNoTenantDeep`, in the
 * commit that invents the grant."* The grant that crosses hosts is the
 * broker's `code` and `state`, relayed from the shared return host to the host
 * the sign-in was BEGUN on. What makes it safe is not the pair but the ROW it
 * addresses, so the row's three hand-off facts are what is declared:
 *
 *   · `begunHost`  — the host `beginFederatedSignIn` resolved through the
 *                    registry and wrote on the attempt (`0360`). The ONLY
 *                    source of a hand-off target: never the `state`, never a
 *                    query parameter, never a header the return carried.
 *   · `expiresAt`  — SHORT-LIVED: D6-6's ten minutes, enforced by `0240`'s and
 *                    `0290`'s policies. This module reads no clock, for
 *                    `consumeSignInAttempt()`'s stated reason.
 *   · `consumedAt` — SINGLE-USE: the mint consumes the attempt under `FOR
 *                    UPDATE` (G2547); a consumed attempt hands off nowhere.
 *
 * ⚠️ IT CARRIES A HOST AND NO TENANT, AND THAT IS THE WHOLE POINT. Under G179 a
 * host IS a tenant — which is exactly why the tenant is RE-DERIVED from the
 * host by the registry at the destination (D1), and never carried. The two
 * `AssertNoTenantDeep`s below make *"helpfully add the tenant so the
 * callback need not look it up"* a `TS2344` rather than a review comment.
 */
export interface SignInHandOff {
  readonly begunHost: string
  readonly expiresAt: Timestamp
  readonly consumedAt: Timestamp | null
}

export type _SignInHandOffReachesNoTenantDeep = AssertNoTenantDeep<SignInHandOff>

/** Where a hand-off may go: a REGISTERED host and its surface kind — nothing that names a tenant. */
export interface SignInHandOffTarget {
  readonly host: string
  readonly surfaceKind: ServedSurfaceKind
}

export type _SignInHandOffTargetReachesNoTenantDeep = AssertNoTenantDeep<SignInHandOffTarget>

export const SIGN_IN_HAND_OFF_REFUSALS = {
  /** The begun host is not (or no longer) in either registry — the open-redirect refusal. */
  handOffTargetNotServed: 'hand_off_target_not_served',
  /** The attempt is already consumed. A replayed return hands off nowhere. */
  handOffAlreadyConsumed: 'hand_off_already_consumed',
  /** Presented on a host other than the one it was issued for. */
  handOffPresentedOnAnotherHost: 'hand_off_presented_on_another_host',
} as const

export type SignInHandOffRefusal =
  (typeof SIGN_IN_HAND_OFF_REFUSALS)[keyof typeof SIGN_IN_HAND_OFF_REFUSALS]

export type SignInHandOffResolution =
  | { readonly ok: true; readonly target: SignInHandOffTarget }
  | { readonly ok: false; readonly refusal: SignInHandOffRefusal }

/**
 * Where the shared return host may send the browser. A LOOKUP through
 * `resolveServedHost()` — D6 §4.4: *"the redirect target must come from
 * `resolveServingHost()` … never a concatenation"* — so a host that is not
 * registered, is retired, or collides across registries is REFUSED rather
 * than redirected to. The open redirect and the grant theft are one bug, and
 * this is the one place either could be written.
 */
export function resolveHandOffTarget(
  tenants: readonly ServingHost[],
  consoles: readonly ConsoleHost[],
  handOff: SignInHandOff,
): SignInHandOffResolution {
  if (handOff.consumedAt !== null) {
    return { ok: false, refusal: SIGN_IN_HAND_OFF_REFUSALS.handOffAlreadyConsumed }
  }
  const served = resolveServedHost(tenants, consoles, handOff.begunHost)
  if (!served.ok) {
    return { ok: false, refusal: SIGN_IN_HAND_OFF_REFUSALS.handOffTargetNotServed }
  }
  return {
    ok: true,
    target: { host: normaliseHost(handOff.begunHost), surfaceKind: served.surface.kind },
  }
}

/**
 * The binding: a completion is accepted ONLY on the host the hand-off was
 * issued for — `checkHostBinding()`'s property, given to the grant that
 * precedes a session. A `state` and `code` presented on another host are
 * refused even when every other check would pass.
 */
export function checkHandOffPresentation(
  handOff: Pick<SignInHandOff, 'begunHost'>,
  presentedHost: string,
): { readonly ok: true } | { readonly ok: false; readonly refusal: SignInHandOffRefusal } {
  const want = normaliseHost(handOff.begunHost)
  if (want === '' || want !== normaliseHost(presentedHost)) {
    return { ok: false, refusal: SIGN_IN_HAND_OFF_REFUSALS.handOffPresentedOnAnotherHost }
  }
  return { ok: true }
}

export const SIGN_IN_RETURN_HOST_REFUSALS = {
  returnHostEmpty: 'return_host_empty',
  /** The shared return host is also a served host — G179's collision, one registry over. */
  returnHostIsAServedHost: 'return_host_is_a_served_host',
} as const

export type SignInReturnHostRefusal =
  (typeof SIGN_IN_RETURN_HOST_REFUSALS)[keyof typeof SIGN_IN_RETURN_HOST_REFUSALS]

/**
 * The shared return host must be served by NOTHING else. A tenant registered
 * at it would make the broker's return land on that tenant's surface, so a
 * collision is a BOOT failure (`server/data-plane/signin-return.ts`).
 */
export function checkSignInReturnHost(
  tenants: readonly ServingHost[],
  consoles: readonly ConsoleHost[],
  host: string,
): { readonly ok: true } | { readonly ok: false; readonly refusal: SignInReturnHostRefusal } {
  const key = normaliseHost(host)
  if (key === '') return { ok: false, refusal: SIGN_IN_RETURN_HOST_REFUSALS.returnHostEmpty }
  const taken =
    tenants.some((e) => normaliseHost(e.host) === key) ||
    consoles.some((e) => normaliseHost(e.host) === key)
  return taken
    ? { ok: false, refusal: SIGN_IN_RETURN_HOST_REFUSALS.returnHostIsAServedHost }
    : { ok: true }
}
