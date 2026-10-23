/**
 * ReconcileAI — INTAKE. The lane, the artefact on it, and what a pack may say
 * about what the artefact IS.
 *
 * Added 24 Aug 2026 under G225, which rules that the seven promised modules land
 * and the module count is swept rather than defended. It carries three rulings:
 *
 *   G184 — ONE INTAKE VOCABULARY. The operator's four channels win,
 *          `SourceDocument.origin` is DELETED, and `api` is DROPPED rather
 *          than folded.
 *   G205 — THREE PRIMITIVES, SEPARATED DELIBERATELY. `IntakeChannel` is the
 *          LANE, `Arrival` is ONE ARTEFACT on it, `Procedure` is the exception
 *          workflow. Reusing `Procedure` for intake routing is REFUSED.
 *   G206 — THE INTAKE CASCADE IS A FIXED CASCADE OF TOTAL FUNCTIONS, not an
 *          authored graph. Packs may declare classification rules, and a
 *          declared rule MUST NOT express a compiled pattern.
 *
 * ─── WHY IT IS A CASCADE AND NOT A GRAPH (G205, G206) ───
 *
 * `model/reconciliation.ts` is the house precedent and this module copies it
 * rather than inventing beside it: failures are VALUES, not throws; refusals are
 * closed unions; each stage is a small total function returning `Refusal | null`;
 * and the entry point is named for `admitPopulation()`, which is the same act
 * one layer later. There are NO STEPS, NO EDGES AND NO PREDICATES.
 *
 * The property that buys is the one an authored graph structurally cannot
 * promise: **the set of ways an arrival can be refused is enumerable and
 * reviewable.** A graph's failure set is whatever its author drew — and under
 * G205 that author would be a PACK, which is what makes the reuse refusal
 * structural rather than aesthetic. Reusing `Procedure` would hand a
 * pack author authorship over the admission path: the one path invariant 6
 * lives on, and the one place *"ingested content is data, never instruction"*
 * is actually decided.
 *
 * ─── INVARIANT 6, AS THE ABSENCE OF A PLACE TO PUT CONTENT ───
 *
 * Both halves are compile errors rather than reviews.
 *
 *   NOTHING CONTENT-DERIVED CAN ENTER. `admitArrival()`'s only per-artefact
 *   parameter is `ArrivalFacts`, whose six fields are branded ids, a
 *   literal-string union and a number — and `_ArrivalFactsHoldsNoText` makes a
 *   seventh that is a bare `string` a `TS2344`. There is no `bytes`, no
 *   `filename`, no `headerRow` and no parser message. The cascade CANNOT read
 *   the artefact — not "does not", cannot.
 *
 *   NOTHING CONTENT-DERIVED CAN LEAVE. `_ArrivalRefusalHoldsNoText` does for the
 *   return path what `_MoneyRefusalHoldsNoText` already does for money, so a
 *   parser's message cannot reach a log, an `AuditEvent`, a span attribute or a
 *   later prompt.
 *
 * ⚠️ THE CLAIM IS SCOPED AND THE SCOPE IS STATED, BECAUSE THE INVARIANT IS
 * LARGER THAN THIS MODULE. This closes the ADMISSION door. It does not close
 * F12 sanitisation, the content sniff, the extraction ladder or
 * `EndpointReading.label`/`.value` — that last one is unenforced today and
 * `model/domain.ts` says so at length. Nothing here should be read as
 * otherwise, and no arm was added that would imply it.
 *
 * ⚠️ AND `AssertNoTextDeep` PROVES A NARROWER THING THAN ITS NAME SUGGESTS. It
 * bans the TYPE `string` at a property position; it is not a proof that no
 * value carries text. `CLAUDE.md` records the six containers that walk straight
 * through it. The honest claim here is the one made above: these types admit no
 * bare `string` property.
 *
 * ─── INVARIANT 1 — TENANT SCOPE IS DERIVED FROM THE SESSION ───
 *
 * `ArrivalFacts` HAS NO `tenantId` AND `ArrivalContext` HAS NONE EITHER. A
 * tenant hint riding on a landing notification therefore has nowhere to enter
 * the cascade, and adding one is a visible type change on this module's
 * most-read declaration rather than a parameter somebody threads through. That
 * is the defeat-BY-RELOCATION case closed by construction: there is no body the
 * tenant could move into, because the cascade takes no body. The `Arrival` ROW
 * is `TenantScoped` — the tenant is on the row because the row is stored, and
 * the caller derives it before the row is written, never from the notification.
 *
 * ─── INVARIANT 10 — AN ACT WITH NO AUTHORISATION IS UNRECORDABLE ───
 *
 * `ArrivalFacts.authorizationId` is NON-NULLABLE, and the hard case is
 * `connector_pull`, which has no requester. The precedent is exact and argued:
 * `EndpointReading.authorizationId` is non-nullable *"unlike
 * `AuditEvent.authorizationId`, and the difference is argued rather than
 * accidental — reaching a customer's ERP on a credential is never a system act
 * with nobody behind it"*. An acquisition is the same act, so `system` — the
 * sole member of `AUTHORIZATION_MAY_BE_ABSENT` — never covers it.
 *
 * A `connector_pull` at 03:00 records the STANDING grant minted when the
 * connection was configured, and `Endpoint.boundUntil` is already that shape and
 * already says so: *"An endpoint keeps pulling after the grant that declared it
 * lapses, which is the property that distinguishes it from inert
 * configuration."* `guardAuthorisation()` below is the first thing in this
 * repository that ever EVALUATES that field.
 *
 * ⚠️ THE READ PATH IS NOT COVERED AND THAT IS NAMED RATHER THAN PAPERED OVER.
 * No capability and no resource class names an arrival, so *reading* an
 * `Arrival` has no grant to carry. The claim above is about the ACQUISITION
 * path only, where `configure_endpoint` / the `endpoint` resource class do
 * exist. The read path needs a ruling before any list, screen or export
 * addresses an `Arrival`.
 *
 * ─── 🛑 WHAT IS DECLARED HERE AND IS NOT EVALUATED ANYWHERE (G118) ───
 *
 * §3's classification vocabulary has a PUBLICATION-TIME validator and NO
 * EVALUATOR. `validatePackClassificationRules()` runs over a pack's own
 * declarations at signing; nothing anywhere decides whether a live arrival
 * MATCHES a rule, because that needs a filename, a channel and a sniffed kind
 * read off a real artefact and no such reader exists. G118 is the standing
 * warning and it applies to this module by name: *"a typed seam plus a
 * compile-time proof reads to a newcomer as a shipped feature."*
 *
 * The consequence to carry: **`ArrivalRefusal` has no `classified_by_no_rule`
 * and no `classified_ambiguously` arm.** Both are named in the design record and
 * both are deliberately absent, because an arm nothing can produce is a promise
 * rather than a refusal — the §5.6 shape wearing the uniform of completeness.
 * They land in the commit that lands the evaluator.
 *
 * ─── PROJECT CONSTRAINTS ───
 *
 * Every import in this file is `import type` and therefore extensionless: they
 * are erased by `verbatimModuleSyntax` before any loader sees them, so there is
 * no runtime edge out of this module at all. `grep -c "^import {" model/ingestion.ts`
 * → 0. That is what makes the type-only cycle with `model/domain.ts` — which
 * imports `PackClassificationRule` back — a cycle on paper only, the same shape
 * `domain`, `access` and `governance` have had since the model was written.
 */

import type {
  ArrivalId,
  AuthorizationGrantId,
  EndpointId,
  EndpointReadingId,
  FieldPath,
  IntakeChannelId,
  Json,
  SourceDocumentId,
  TenantScoped,
  Timestamp,
} from './kernel'
import type { AcquisitionFidelity, DocumentTypeTemplate, ExtractionFn } from './domain'
import type { SourceMatch } from './connectors'
import type { AssertNoTextDeep, IdentifierNormalisation } from './reconciliation'

/* ==================================================================== *
 * §1  THE LANE — G184's one vocabulary
 * ==================================================================== */

/**
 * The four channels an artefact can arrive on. THE ONE INTAKE VOCABULARY.
 *
 * 🛑 `api` IS DROPPED, AND FOLDING IT IS THE TEMPTING ERROR. The four-member set
 * has no member for an inbound API push, so adopting it while keeping `api`
 * alive silently reinterprets `api` as `upload` — and `upload` is a PRESIGNED
 * PUT (`UploadTicket`, `docs/contracts/capability.openapi.yaml`), a different
 * act with a different admission story. Nothing in the record specifies a
 * document-push API: `api` named a route with no operation on any contract
 * tier. If a push API is ever specified **it returns as a FIFTH member, never as
 * a reinterpretation of `upload`.**
 *
 * 🛑 `connector` IS NOT HERE EITHER, AND IT IS NOT AN OVERSIGHT. Three values
 * were a LOSSY PROJECTION of four, not an orthogonal fact: collapsing
 * `watched_drop` and `mailbox` into one `connector` is precisely what makes an
 * `EndpointHealth` row unattributable to the lane that produced it.
 *
 * ⚠️ THE ORDER IS PINNED AND IT IS THE CONTRACT'S, NOT THIS FILE'S. The
 * `intake_channel_kinds` pair in `tools/check-wire-mirror.mjs` compares members
 * AS A SEQUENCE against `IntakeChannelStatus.properties.channel.enum`, so
 * reordering these four is a finding even though the set is unchanged.
 *
 * ⚠️ NOT AN `enum`. `erasableSyntaxOnly` forbids one; a const object plus a
 * derived union is the house shape and it is also the shape the wire-mirror
 * `const` reader can read.
 */
export const INTAKE_CHANNEL_KINDS = {
  upload: 'upload',
  watchedDrop: 'watched_drop',
  connectorPull: 'connector_pull',
  mailbox: 'mailbox',
} as const
export type IntakeChannelKind =
  (typeof INTAKE_CHANNEL_KINDS)[keyof typeof INTAKE_CHANNEL_KINDS]

/**
 * Which channel kinds DRAW THROUGH A CONNECTION, as a total record.
 *
 * 🛑 THIS IS G184's NEW INVARIANT AS DATA RATHER THAN AS A SENTENCE:
 * `kind === 'upload' ⟺ endpointId === null`. An upload draws through no
 * connection; every other kind names one.
 *
 * ⚠️ IT IS A TOTAL `Record` SO A FIFTH CHANNEL IS A COMPILE ERROR AT THIS
 * LITERAL. If `api` ever returns as G184's fifth member, whoever adds it must
 * answer here whether an inbound push names an endpoint — which is exactly the
 * question folding `api` into `upload` would have skipped.
 */
export const CHANNEL_DRAWS_THROUGH_AN_ENDPOINT: Record<IntakeChannelKind, boolean> = {
  upload: false,
  watched_drop: true,
  connector_pull: true,
  mailbox: true,
}

/**
 * One configured intake lane. Flat: one row per lane, four kinds.
 *
 * 🛑 `lastArrivalAt` IS THE `arrivedAt` OF THE MOST RECENT `Arrival` ROW ON THIS
 * CHANNEL — DERIVED FROM THE ROW, NEVER WRITTEN BY THE LANDING NOTIFICATION.
 * That is the seam where G132's event sense of "arrival" and this module's row
 * sense would first be confused, and it is closed by definition here rather than
 * by a comment somewhere downstream. A channel that received a notification the
 * cascade could not resolve does NOT advance its liveness signal — which is the
 * correct answer to the question `listIntakeChannels` exists to answer, and the
 * wrong answer the event sense would have given.
 *
 * The contract already ships the field and already argues it: *"It is not a
 * health check and does not claim the connector is well; it says when something
 * last came through."*
 */
export interface IntakeChannel extends TenantScoped {
  id: IntakeChannelId
  kind: IntakeChannelKind
  /** Null exactly when `kind === 'upload'`. See `guardIntakeChannel()`. */
  endpointId: EndpointId | null
  /** Whether the lane is live. A disabled lane admits nothing. */
  enabled: boolean
  /** Liveness, not health. Derived from the newest `Arrival` row. */
  lastArrivalAt: Timestamp | null
}

/**
 * Why a channel row is not a legal lane. Carries IDS ONLY — no location string,
 * no mailbox address, no bucket prefix, because each of those is operator text
 * that a refusal would carry into a log.
 */
export type IntakeChannelDefect =
  /** `upload` names an endpoint. An upload draws through no connection. */
  | { readonly kind: 'upload_names_an_endpoint'; readonly channelId: IntakeChannelId }
  /** A drawing channel names none. Its readings would be unattributable. */
  | { readonly kind: 'endpoint_absent_on_drawing_channel'; readonly channelId: IntakeChannelId }

export type _IntakeChannelDefectHoldsNoText = AssertNoTextDeep<IntakeChannelDefect>

/**
 * G184's biconditional, BOTH DIRECTIONS. Total; returns `null` when the lane is
 * legal.
 *
 * 🛑 THE LAZY REPAIR THIS EXISTS TO REFUSE IS IMPLEMENTING `⟺` AS `⟹`. The
 * natural reading of "an upload draws through no connection" produces a guard
 * that checks the upload arm and returns `null` for everything else. Every
 * upload test passes. A `connector_pull` channel wired to nothing is then
 * ADMISSIBLE, and the artefacts drawn down it carry `endpointId: null` — which
 * makes every `EndpointHealth` row unattributable to the lane that produced it,
 * the exact failure G184 says the three-value projection caused.
 *
 * The direction is read out of `CHANNEL_DRAWS_THROUGH_AN_ENDPOINT` rather than
 * out of a literal `kind === 'upload'` comparison, so a fifth channel member
 * cannot slip through as a silently-permissive default.
 */
export function guardIntakeChannel(channel: IntakeChannel): IntakeChannelDefect | null {
  const draws = CHANNEL_DRAWS_THROUGH_AN_ENDPOINT[channel.kind]
  if (!draws && channel.endpointId !== null) {
    return { kind: 'upload_names_an_endpoint', channelId: channel.id }
  }
  if (draws && channel.endpointId === null) {
    return { kind: 'endpoint_absent_on_drawing_channel', channelId: channel.id }
  }
  return null
}

/* ==================================================================== *
 * §2  THE ARTEFACT — G205's second primitive, and the cascade
 * ==================================================================== */

/**
 * What is known about ONE arriving artefact before anything has read it.
 *
 * 🛑 SIX FIELDS, AND WHAT IS ABSENT IS THE DECLARATION. No `filename`, no
 * `bytes`, no `contentType`, no header row, no parser message — and no
 * `tenantId`. `_ArrivalFactsHoldsNoText` below makes adding a seventh that is a
 * bare `string` a compile error, so the absence is enforced rather than
 * reviewed.
 *
 * ⚠️ `arrivedAt` IS NOT HERE, DELIBERATELY, AND THE REASON IS NOT THE ASSERT.
 * The time an artefact arrived is OUR OBSERVATION, made by our clock; it is not
 * a fact the artefact asserts about itself. It lives on `ArrivalContext.now`
 * with the rest of the privileged environment. (`Timestamp` is a bare `string`
 * alias, so it would also have failed the assert — but that is a consequence of
 * putting it in the right place, not the reason for doing so.)
 */
export interface ArrivalFacts {
  readonly arrivalId: ArrivalId
  readonly channelId: IntakeChannelId
  readonly channelKind: IntakeChannelKind
  /** The endpoint the CALLER believes drew this. Compared, never trusted. */
  readonly endpointId: EndpointId | null
  /** The standing grant this acquisition ran under. Non-nullable — invariant 10. */
  readonly authorizationId: AuthorizationGrantId
  /** Size in bytes. A number, so it carries no text and no encoding claim. */
  readonly byteCount: number
}

export type _ArrivalFactsHoldsNoText = AssertNoTextDeep<ArrivalFacts>

/**
 * The privileged environment the cascade runs against. Supplied by the caller,
 * never by the notification.
 *
 * ⚠️ NO `AssertNoTextDeep` HERE, AND THE OMISSION IS STATED RATHER THAN LEFT TO
 * BE NOTICED. `now` and `boundUntil` are `Timestamp`, which is a bare `string`
 * alias, so the assert could not hold over this type. The line that matters is
 * not "this type has no strings" but "this type carries nothing a counterparty
 * wrote": a clock reading, a channel row an operator configured, and grant ids
 * the caller already resolved. Claiming the compile-time proof over it would be
 * claiming something the type does not support.
 */
export interface ArrivalContext {
  /** The channel row, loaded by the caller. Compared against the facts. */
  readonly channel: IntakeChannel
  /** The grants the caller resolved for this acquisition. */
  readonly presentedAuthorizationIds: readonly AuthorizationGrantId[]
  /**
   * `Endpoint.boundUntil` for the drawing endpoint — the expiry of the authority
   * that declared it. Null on an upload lane, which draws through no endpoint.
   */
  readonly boundUntil: Timestamp | null
  readonly now: Timestamp
  /**
   * 🛑 A RESOLVED ANSWER, NOT A KEY TO LOOK UP. The caller does the singularity
   * lookup and hands the cascade its result, so no content hash and no dedup key
   * ever enters this module. That is one more thing `ArrivalFacts` does not have
   * to carry, and it is why the duplicate refusal can name the earlier row
   * without naming anything about the artefact.
   */
  readonly earlierArrivalWithSameContent: ArrivalId | null
}

/**
 * Every way an arrival can be refused. CLOSED, and enumerable — which is the
 * property G206 says an authored graph structurally cannot promise.
 *
 * Carries ids and nothing else. A refusal is the value most likely to reach a
 * log line or a span attribute, and the cheapest way to make that harmless is
 * for the type not to admit the text.
 */
export type ArrivalRefusal =
  /** The facts name a different lane from the one the caller loaded. */
  | {
      readonly kind: 'channel_not_the_one_presented'
      readonly onFacts: IntakeChannelId
      readonly onChannel: IntakeChannelId
    }
  /** The facts and the row disagree about what kind of lane this is. */
  | {
      readonly kind: 'channel_kind_disagrees'
      readonly onFacts: IntakeChannelKind
      readonly onChannel: IntakeChannelKind
    }
  | { readonly kind: 'channel_disabled'; readonly channelId: IntakeChannelId }
  /** The lane itself is malformed. Carries the defect rather than restating it. */
  | { readonly kind: 'channel_is_not_a_legal_lane'; readonly defect: IntakeChannelDefect }
  /** The denormalised endpoint disagrees with the lane's. */
  | {
      readonly kind: 'channel_endpoint_disagrees'
      readonly onChannel: EndpointId | null
      readonly onArrival: EndpointId | null
    }
  | {
      readonly kind: 'authorisation_not_presented'
      readonly authorizationId: AuthorizationGrantId
    }
  | {
      readonly kind: 'standing_authorisation_expired'
      readonly authorizationId: AuthorizationGrantId
    }
  | { readonly kind: 'duplicate_of_earlier_arrival'; readonly earlier: ArrivalId }
  /** Zero bytes. A lane that delivers nothing has delivered nothing. */
  | { readonly kind: 'arrival_is_empty'; readonly channelId: IntakeChannelId }

export type _ArrivalRefusalHoldsNoText = AssertNoTextDeep<ArrivalRefusal>

/** What an admitted arrival is, before anything has parsed it. */
export interface AdmittedArrival {
  readonly arrivalId: ArrivalId
  readonly channelId: IntakeChannelId
  readonly channelKind: IntakeChannelKind
  readonly endpointId: EndpointId | null
  readonly authorizationId: AuthorizationGrantId
}

export type ArrivalAdmission =
  | { readonly ok: true; readonly admitted: AdmittedArrival }
  | { readonly ok: false; readonly refusal: ArrivalRefusal }

/**
 * What was decided about one artefact.
 *
 * ✅ **THERE IS A THIRD STATE SINCE 2 Oct 2026 — G2692, THE OWNER'S RULING:
 * *"Yes, both: store an Arrival's filename verbatim, interpreted by nothing
 * (invariant 6 via 0022's precedent); add a `parked` ArrivalVerdict arm."*** ⚠️
 * THE SENTENCE THIS DOCBLOCK CARRIED IS CORRECTED RATHER THAN DELETED, because
 * it is the one G2692 quoted as its blocker and the one a reader would have
 * quoted onward. IT READ: *"THERE IS NO THIRD STATE and no partially-admitted
 * artefact: an `Arrival` becomes a `SourceDocument` on admission, or it is
 * refused and stays an `Arrival`."* **The second half survives whole: there is
 * still no PARTIALLY-admitted artefact.** A parked arrival passed the cascade
 * and became nothing yet — C9 row 7: *"Parked as unclassified, never guessed
 * into the nearest type. A document that arrived before its type was declared
 * parks in the same bucket — one state, not two."*
 *
 * 🛑 `parked` CARRIES NO REASON, AND THE ABSENCE IS ROW 7's *"one state, not
 * two"* MADE STRUCTURAL. Why an arrival is STILL parked changes when a pair is
 * declared — a parked artefact that matched nothing on Monday matches the pair
 * declared on Tuesday — so a stored reason would be a second fact about one
 * thing that goes stale on every declaration. It is DERIVED at read time by
 * `decideArrival()` (§2a), `sourceState()`'s shape one module over (G2833).
 *
 * ⚠️ A PARKED VERDICT NEVER CHANGES. The arrival row is append-only (`0012` §2);
 * a later drain is a SEPARATE append-only act (`0380` §4) that names the pair
 * and the authorisation which drained it.
 */
export type ArrivalVerdict =
  | { readonly kind: 'admitted'; readonly admittedAt: Timestamp }
  | { readonly kind: 'refused'; readonly refusal: ArrivalRefusal }
  | { readonly kind: 'parked'; readonly parkedAt: Timestamp }

export const ARRIVAL_VERDICT_KINDS = {
  admitted: 'admitted',
  refused: 'refused',
  parked: 'parked',
} as const
export type ArrivalVerdictKind = (typeof ARRIVAL_VERDICT_KINDS)[keyof typeof ARRIVAL_VERDICT_KINDS]

/** Compile-time: the const and the union name the same three arms. */
export type _EveryArrivalVerdictKindIsListed = ArrivalVerdict['kind'] extends ArrivalVerdictKind
  ? ArrivalVerdictKind extends ArrivalVerdict['kind']
    ? true
    : never
  : never

/**
 * 🛑 TWO TOTAL RECORDS, SO A FOURTH VERDICT MUST ANSWER BOTH QUESTIONS EVERY
 * READER ASKS OF ONE (G2832). `0012` §2's `verdict_kind` carries NO `CHECK`, by
 * `0007`'s polarity, so these are what a reader refuses an unknown value
 * against — `server/data-plane/payload-store.ts`'s `readArrival()`.
 *
 * Did the verdict make a `SourceDocument` AT ARRIVAL? Only `admitted`. A
 * parked arrival may become one LATER, through a drain, and that is a
 * different act with its own record.
 */
export const ARRIVAL_VERDICT_STORES_A_DOCUMENT: Record<ArrivalVerdictKind, boolean> = {
  admitted: true,
  refused: false,
  parked: false,
}

/**
 * Is the artefact HELD for a later declaration — C9 row 9, *"Held
 * unextracted"*? Only `parked`. A refused artefact is not held: the cascade
 * said no, and nothing a pair declaration does can change that.
 */
export const ARRIVAL_VERDICT_HOLDS_THE_ARTEFACT: Record<ArrivalVerdictKind, boolean> = {
  admitted: false,
  refused: false,
  parked: true,
}

/**
 * THE DURABLE ROW. G205's reason for existing in one sentence: a channel that
 * has seen forty thousand files has one row and one timestamp, and without this
 * nothing anywhere records that file 39,998 was refused or why.
 *
 * ⚠️ REJECTED — FOLDING THIS INTO `SourceDocument`. A refused arrival NEVER
 * becomes a `SourceDocument`, so the rows this entity exists for are exactly the
 * rows that would not exist. The alternative silently makes the refusal record
 * unrepresentable, which is the hole.
 */
export interface Arrival extends TenantScoped {
  id: ArrivalId
  channelId: IntakeChannelId
  channelKind: IntakeChannelKind
  endpointId: EndpointId | null
  authorizationId: AuthorizationGrantId
  arrivedAt: Timestamp
  verdict: ArrivalVerdict
  /**
   * THE NAME THE COUNTERPARTY GAVE THE ARTEFACT, STORED VERBATIM AND
   * INTERPRETED BY NOTHING — G2692, the owner's ruling, on `0022`'s precedent
   * for `correspondence_thread.subject`. Null on a row written before `0380`.
   * `ArrivalFilename` (§2a) states the one comparison anything makes of it.
   */
  filename: ArrivalFilename | null
  /** Set only when the verdict admitted. Null on every refusal. */
  sourceDocumentId: SourceDocumentId | null
  /** The reading that drew it, on a drawing lane. Null on an upload. */
  readingId: EndpointReadingId | null
}

/* -------------------------------------------------------------------- *
 * The stages. Each is total and returns `Refusal | null`.
 * -------------------------------------------------------------------- */

function guardChannelIdentity(
  facts: ArrivalFacts,
  channel: IntakeChannel,
): ArrivalRefusal | null {
  if (facts.channelId !== channel.id) {
    return {
      kind: 'channel_not_the_one_presented',
      onFacts: facts.channelId,
      onChannel: channel.id,
    }
  }
  if (facts.channelKind !== channel.kind) {
    return {
      kind: 'channel_kind_disagrees',
      onFacts: facts.channelKind,
      onChannel: channel.kind,
    }
  }
  return null
}

function guardChannelLive(channel: IntakeChannel): ArrivalRefusal | null {
  if (!channel.enabled) return { kind: 'channel_disabled', channelId: channel.id }
  const defect = guardIntakeChannel(channel)
  if (defect !== null) return { kind: 'channel_is_not_a_legal_lane', defect }
  return null
}

/**
 * 🛑 THE DENORMALISED ENDPOINT IS COMPARED, NEVER TRUSTED.
 *
 * The lazy repair this refuses: denormalise `endpointId` onto the arrival for
 * the reason `ProcedureStepExecution.runId` gives — and then READ it. A
 * denormalised copy that nothing compares is not a control, it is a second
 * source of truth, and it goes stale the first time an operator repoints a
 * channel at a new endpoint. Under that repair an artefact records an authority
 * that never covered it, and invariant 10's whole claim degrades to a stored
 * string.
 */
function guardEndpointAgreement(
  facts: ArrivalFacts,
  channel: IntakeChannel,
): ArrivalRefusal | null {
  if (facts.endpointId !== channel.endpointId) {
    return {
      kind: 'channel_endpoint_disagrees',
      onChannel: channel.endpointId,
      onArrival: facts.endpointId,
    }
  }
  return null
}

/**
 * 🛑 THE STANDING AUTHORISATION MUST BE LIVE, NOT MERELY PRESENT — AND THIS IS
 * THE FIRST THING IN THIS REPOSITORY THAT HAS EVER EVALUATED `boundUntil`.
 *
 * The lazy repair: check that `authorizationId` is non-null and stop — which the
 * TYPE already guarantees, so the check is decorative and the suite is green.
 * `Endpoint.boundUntil`'s own docblock says an endpoint that keeps pulling past
 * its authority is the failure it exists to name; a guard that only asserts
 * presence re-creates that state and reports success.
 *
 * ⚠️ THE CLOCK COMPARISON IS A STRING COMPARISON AND THAT IS A REAL CONSTRAINT,
 * NOT AN OVERSIGHT. `Timestamp` is an ISO-8601 alias, and ISO-8601 in a fixed
 * offset sorts lexicographically. Mixed offsets do not. The model has no time
 * codec and minting one is not this module's decision — G111's shape (one codec,
 * nothing else touches the representation) is what it would take, and there is
 * no ruling for it. Stated here so a caller normalises before it calls, rather
 * than discovering the constraint from a wrong verdict.
 *
 * An upload lane draws through no endpoint, so it has no `boundUntil` to expire;
 * `null` on a drawing lane is an endpoint with no bound at all, which is the
 * unbounded case and refuses. The direction is read out of
 * `CHANNEL_DRAWS_THROUGH_AN_ENDPOINT` for the same reason `guardIntakeChannel()`
 * reads it there.
 */
function guardAuthorisation(
  facts: ArrivalFacts,
  context: ArrivalContext,
): ArrivalRefusal | null {
  if (!context.presentedAuthorizationIds.includes(facts.authorizationId)) {
    return { kind: 'authorisation_not_presented', authorizationId: facts.authorizationId }
  }
  if (!CHANNEL_DRAWS_THROUGH_AN_ENDPOINT[facts.channelKind]) return null
  if (context.boundUntil === null || context.boundUntil <= context.now) {
    return { kind: 'standing_authorisation_expired', authorizationId: facts.authorizationId }
  }
  return null
}

/**
 * A duplicate is a NAMED OUTCOME, carrying the earlier row.
 *
 * The lazy repair is one layer up from a defect this codebase already has a
 * record of: swallow it as an `ON CONFLICT DO NOTHING` or a silent `Map.set`,
 * after which conservation holds over a population already one row short and the
 * refusal that would have said so cannot fire.
 */
function guardSingularity(context: ArrivalContext): ArrivalRefusal | null {
  if (context.earlierArrivalWithSameContent !== null) {
    return {
      kind: 'duplicate_of_earlier_arrival',
      earlier: context.earlierArrivalWithSameContent,
    }
  }
  return null
}

function guardSubstance(facts: ArrivalFacts): ArrivalRefusal | null {
  if (facts.byteCount <= 0) {
    return { kind: 'arrival_is_empty', channelId: facts.channelId }
  }
  return null
}

/**
 * THE CASCADE. Fixed order, total functions, first refusal wins.
 *
 * 🛑 THE ORDER IS PART OF THE CONTRACT AND IS OBSERVABLE. An arrival that is
 * SIMULTANEOUSLY a duplicate and on a disabled channel refuses with
 * `channel_disabled`, not `duplicate_of_earlier_arrival`.
 *
 * The lazy repair: run the cheap check first. The duplicate lookup is one
 * indexed read and the channel checks need the channel loaded, so reordering is
 * an obvious optimisation — and it makes the system report a duplicate on a
 * channel that is not even live. `MoneyRefusal`'s `no_items` docblock is the
 * standing argument against exactly this: the old answer *"was a lie… a refusal
 * that names the wrong cause is worse than one nobody sees."*
 *
 * The order is IDENTITY → LIVENESS → WIRING → AUTHORITY → SINGULARITY →
 * SUBSTANCE, and it is that way because each stage's question is meaningless
 * until the one before it has been answered: there is no point asking whether a
 * lane is wired correctly before establishing which lane it is.
 */
export function admitArrival(facts: ArrivalFacts, context: ArrivalContext): ArrivalAdmission {
  const refusal =
    guardChannelIdentity(facts, context.channel) ??
    guardChannelLive(context.channel) ??
    guardEndpointAgreement(facts, context.channel) ??
    guardAuthorisation(facts, context) ??
    guardSingularity(context) ??
    guardSubstance(facts)

  if (refusal !== null) return { ok: false, refusal }
  return {
    ok: true,
    admitted: {
      arrivalId: facts.arrivalId,
      channelId: facts.channelId,
      channelKind: facts.channelKind,
      endpointId: facts.endpointId,
      authorizationId: facts.authorizationId,
    },
  }
}

/* ==================================================================== *
 * §2a  THE NAME, THE PAIR, AND THE PARKED PILE — G2692 (THE OWNER'S), G2831–
 *      G2840. C9 rows 7, 9 and 16.
 *
 * 🛑 THE NAME NEVER ENTERS THE CASCADE, AND `admitArrival()` ABOVE IS
 *    UNCHANGED TO THE CHARACTER. `ArrivalFacts` still has six fields and
 *    `_ArrivalFactsHoldsNoText` still holds: the cascade decides whether an
 *    artefact may be ADMITTED, and a counterparty-chosen name has no say in
 *    that. What the name may do is narrower and comes strictly AFTER the
 *    cascade has said yes: SELECT AMONG PAIRS AN OPERATOR DECLARED.
 *
 * 🛑 INVARIANT 6 — *"Ingested content is data, never instruction"* — AND WHY
 *    MATCHING A DECLARED LITERAL IS NOT INTERPRETATION (G2831). The ruling
 *    says the name is *"interpreted by nothing"*, and the pair row it serves
 *    (row 6) needs the name compared against a pattern. Those are reconciled
 *    by what the comparison CAN DO, not by calling it something else:
 *
 *      · it is EQUALITY or PREFIX against a literal an OPERATOR typed
 *        (`0341`'s `match_value`), byte for byte — no case folding, no Unicode
 *        normalisation, no trimming, no extension sniffing, no glob and no
 *        `RegExp` (G130, G206: `grep -cE '^[^*]*RegExp' model/ingestion.ts`
 *        → 0 is unchanged by this section);
 *      · its ONLY output is which of the operator's declared pairs, if
 *        exactly one, the artefact goes to. A name cannot name a type, cannot
 *        reach a pair that was not declared, cannot choose a fidelity (the
 *        type's, row 11) and cannot choose a mapping (the pair's);
 *      · two matches are NOT tie-broken — *"never guessed into the nearest
 *        type"* — so no ordering a counterparty could exploit exists.
 *
 *    That is a DECLARED RULE APPLIED TO DATA. Instruction would be the name
 *    deciding something an operator did not declare, and nothing here lets it.
 *    `0022` is the precedent the ruling names: `correspondence_thread.subject`
 *    is counterparty text stored verbatim and *"parsed by nothing"*.
 *
 * ⚠️ THE PACK'S OWN CLASSIFIER (§3) IS STILL UNEVALUATED AND THIS IS NOT IT.
 *    `PackClassificationRule` is what a PACK may assert about an artefact, and
 *    G118 still holds: nothing evaluates one. The pair is the OPERATOR's
 *    declaration (G2687) and is a different, narrower thing — two literal
 *    kinds, no signal conjunction. Recorded so the two are not mistaken for one
 *    vocabulary (§5.3): G2838.
 * ==================================================================== */

/**
 * The counterparty's name for an artefact — the remote path relative to the
 * source's drop, as delivered — VERBATIM. Branded so a value that has not
 * passed `arrivalFilenameFrom()` cannot be stored or compared.
 *
 * 🛑 THE ONLY THINGS REFUSED ARE THE THINGS THAT CANNOT BE STORED: an empty
 *    name, a name over 1024 UTF-16 units, and a NUL (PostgreSQL `text` cannot
 *    hold one). A control character, a `..`, a leading `/`, a trailing space
 *    and a name in NFD rather than NFC are all STORED AS GIVEN — refusing or
 *    normalising them would be interpreting them. They simply match no pair
 *    a person can declare (`checkSourcePair()` refuses every one of them in a
 *    pattern), so they park, which is the honest answer.
 */
export type ArrivalFilename = string & { readonly __arrivalFilename: true }

const ARRIVAL_FILENAME_MAX = 1024

export function arrivalFilenameFrom(raw: unknown): ArrivalFilename | null {
  if (typeof raw !== 'string') return null
  if (raw.length === 0 || raw.length > ARRIVAL_FILENAME_MAX) return null
  if (raw.includes('\u0000')) return null
  return raw as ArrivalFilename
}

/**
 * Does this name fall under this declared pattern? The ONE comparison.
 *
 * `filename` compares the segment after the LAST `/` — the declared rule's own
 * definition, since `checkSourcePair()` refuses a `/` in a filename pattern —
 * and `path_prefix` compares the start of the whole name. Both with `===` /
 * `startsWith`, which compare UTF-16 code units and nothing else.
 */
export function nameFallsUnder(name: ArrivalFilename, match: SourceMatch): boolean {
  switch (match.kind) {
    case 'filename':
      return name.slice(name.lastIndexOf('/') + 1) === match.value
    case 'path_prefix':
      return name.startsWith(match.value)
  }
}

/** One line of a pair's mapping, its target already through the ONE seam. */
export interface PairMappingLine {
  /** What the SOURCE calls the field — a top-level key of the delivered record. */
  readonly sourceField: string
  /** The type's declared position, parsed by `parseFieldPath()`. */
  readonly path: FieldPath
}

/** A pair as the classifier needs it: the pattern, the type, the mapping. */
export interface DeclaredPair {
  readonly pairId: string
  readonly documentTypeId: string
  readonly match: SourceMatch
  /** THE TYPE's, read through the pair (row 11, G2690). */
  readonly expectedFidelity: AcquisitionFidelity
  readonly mapping: readonly PairMappingLine[]
}

/**
 * Why an arrival is parked — DERIVED, never stored (see `ArrivalVerdict`).
 * Four answers, and the first two are row 7's one state reached two ways.
 */
export const PARK_REASONS = {
  /** No declared pattern on this source matches the name — including the
   *  document that arrived before its pair existed (row 7: *"the same
   *  bucket"*). */
  noDeclaredPairMatches: 'no_declared_pair_matches',
  /** Two or more do, and choosing would be guessing (row 7). */
  moreThanOnePairMatches: 'more_than_one_pair_matches',
  /** Exactly one does, and its type reads OCR or a model — R12 took neither,
   *  so it will not extract until one is taken (G2690). */
  pairTypeIsNotExtractable: 'pair_type_is_not_extractable',
  /** Exactly one does, and the held artefact is not a record the pair's
   *  mapping can be applied to. */
  artefactDoesNotFitTheMapping: 'artefact_does_not_fit_the_mapping',
} as const
export type ParkReason = (typeof PARK_REASONS)[keyof typeof PARK_REASONS]

export type ArrivalDecision =
  | {
      readonly kind: 'extract'
      readonly pairId: string
      readonly documentTypeId: string
      /** The record in the TYPE's shape — the mapping applied, nothing else. */
      readonly payload: Json
    }
  | {
      readonly kind: 'park'
      readonly reason: ParkReason
      /** The pairs whose pattern the name falls under. Empty on no match. */
      readonly matchingPairIds: readonly string[]
    }

export type MappingRefusal =
  | { readonly kind: 'artefact_is_not_a_record' }
  | { readonly kind: 'mapping_target_is_indexed' }
  | { readonly kind: 'mapping_targets_collide' }

export type _MappingRefusalHoldsNoText = AssertNoTextDeep<MappingRefusal>

type Projection =
  | { readonly ok: true; readonly payload: Json }
  | { readonly ok: false; readonly refusal: MappingRefusal }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * C9 row 14's mapping APPLIED — what "extraction per pair" is for a structured
 * record. Each declared line copies the source's own top-level field to the
 * type's declared position; NOTHING ELSE CROSSES. A source field no line names
 * is dropped, and a line whose source field the record does not carry leaves
 * its position absent, which `resolveFieldPath()` already reads as absence.
 *
 * ⚠️ THE CONTAINERS ARE NULL-PROTOTYPE OBJECTS, so a declared key spelled
 *    `__proto__` is an ordinary property rather than a prototype write. The
 *    source field is read with `hasOwnProperty`, for the same reason.
 *
 * ⚠️ AN INDEXED TARGET IS REFUSED rather than built — G1504 already refuses
 *    indexed declarations at assembly, and a projection that wrote `lines[0]`
 *    would be the only producer of one.
 */
export function projectThroughMapping(held: Json, mapping: readonly PairMappingLine[]): Projection {
  if (!isRecord(held)) return { ok: false, refusal: { kind: 'artefact_is_not_a_record' } }
  const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>
  for (const line of mapping) {
    if (line.path.length === 0) return { ok: false, refusal: { kind: 'mapping_target_is_indexed' } }
    for (const segment of line.path) {
      if (segment.kind !== 'key') return { ok: false, refusal: { kind: 'mapping_target_is_indexed' } }
    }
  }
  for (const line of mapping) {
    if (!Object.prototype.hasOwnProperty.call(held, line.sourceField)) continue
    const value = held[line.sourceField]
    let at: Record<string, unknown> = out
    for (let i = 0; i < line.path.length - 1; i += 1) {
      const segment = line.path[i]
      if (segment === undefined || segment.kind !== 'key') {
        return { ok: false, refusal: { kind: 'mapping_target_is_indexed' } }
      }
      const next = Object.prototype.hasOwnProperty.call(at, segment.key) ? at[segment.key] : undefined
      if (next === undefined) {
        const created = Object.create(null) as Record<string, unknown>
        at[segment.key] = created
        at = created
      } else if (isRecord(next)) {
        at = next
      } else {
        return { ok: false, refusal: { kind: 'mapping_targets_collide' } }
      }
    }
    const last = line.path[line.path.length - 1]
    if (last === undefined || last.kind !== 'key') {
      return { ok: false, refusal: { kind: 'mapping_target_is_indexed' } }
    }
    if (Object.prototype.hasOwnProperty.call(at, last.key)) {
      return { ok: false, refusal: { kind: 'mapping_targets_collide' } }
    }
    at[last.key] = value
  }
  return { ok: true, payload: out }
}

/**
 * THE DECISION ABOUT ONE ADMITTED ARRIVAL, against the pairs declared on its
 * source NOW. Pure and total; called at arrival, at drain, and by every reader
 * asking why a parked arrival is still parked — so the three can never
 * disagree about what one artefact is.
 *
 * Order: the NAME selects (exactly one pair, or park), then the TYPE may
 * refuse (R12), then the ARTEFACT may refuse (the mapping cannot apply).
 * Each later question is meaningless until the one before it has an answer.
 */
export function decideArrival(
  name: ArrivalFilename | null,
  held: Json,
  pairs: readonly DeclaredPair[],
): ArrivalDecision {
  const matching = name === null ? [] : pairs.filter((p) => nameFallsUnder(name, p.match))
  const matchingPairIds = matching.map((p) => p.pairId)
  const only = matching[0]
  if (only === undefined) {
    return { kind: 'park', reason: 'no_declared_pair_matches', matchingPairIds }
  }
  if (matching.length > 1) {
    return { kind: 'park', reason: 'more_than_one_pair_matches', matchingPairIds }
  }
  if (FIDELITY_CROSSES_MANAGED_SERVICE[only.expectedFidelity]) {
    return { kind: 'park', reason: 'pair_type_is_not_extractable', matchingPairIds }
  }
  const projected = projectThroughMapping(held, only.mapping)
  if (!projected.ok) {
    return { kind: 'park', reason: 'artefact_does_not_fit_the_mapping', matchingPairIds }
  }
  return {
    kind: 'extract',
    pairId: only.pairId,
    documentTypeId: only.documentTypeId,
    payload: projected.payload,
  }
}

/* ==================================================================== *
 * §3  WHAT A PACK MAY SAY AN ARRIVAL IS — G206
 *
 * 🛑 THE CONSTRAINT THAT DOMINATES THIS SECTION IS G130, AND IT BINDS HARDER
 * HERE THAN WHERE IT WAS RULED. G130 removed `matches_pattern` from
 * `RulePredicate` because *"the first engineer to implement `residueRules`
 * writes `new RegExp(predicate.pattern)` over counterparty-controlled text"*. A
 * pack-declared classification rule runs over an artefact a foreign system
 * handed us seconds earlier — strictly MORE untrusted than the text G130 was
 * protecting, and at a stage where nothing has been admitted yet.
 *
 * So a declared rule MUST NOT EXPRESS A COMPILED PATTERN, and the shape is
 * G130's own replacement REUSED rather than reinvented: a declared
 * `IdentifierNormalisation` over the closed op vocabulary, plus ENUMERATED
 * output values the extraction is compared against. Reusing the vocabulary is
 * mandatory rather than preferred — §5.3, two vocabularies for one concept, is
 * the shape this record has seen recur most.
 *
 * `grep -cE '^[^*]*RegExp' model/ingestion.ts` → 0 is a standing control on
 * this module, the same one `model/reconciliation.ts` keeps on itself.
 *
 * 🛑 **THE `^[^*]*` IS NEW — G2176, 28 Sep 2026 — AND THE BARE FORM THIS LINE
 * CARRIED WAS A STANDING CONTROL THAT COULD NEVER PASS.** It answered **3**
 * against a stated **0**, and all three were prose: the paragraph above
 * quoting the refused `new RegExp(...)` shape, §7's *"never constructs a
 * `RegExp`"*, and the control itself. **A control whose own statement
 * falsifies it is worse than no control**, because the next reader either
 * believes the module compiles patterns or learns to ignore the number. A
 * block-comment line opens ` *`; excluding it is the whole repair.
 *
 * ─── WHY A PACK MAY DECLARE THESE AT ALL ───
 *
 * Without it, EVERY NEW DOCUMENT TYPE IS A PLATFORM RELEASE — the dependency
 * G204 refused on the connector axis and the record has refused twice
 * elsewhere. Rejected alternatives, preserved:
 *
 *   · A pack-shipped regex with a length cap and a timeout. Refused on G124's
 *     deciding argument — an approval nobody can read is not an approval — and
 *     because a timeout mitigates the SYMPTOM while leaving the class.
 *   · Platform-only classification, no pack rules at all. Cheaper and strictly
 *     safer, refused because it puts every new document type on the release
 *     train.
 *
 * ─── 🛑 MAY A PACK RULE REACH THE MODEL TIER? NO, AND IT IS A CONSEQUENCE ───
 *
 * `ClassificationSignal` has no arm naming an `AcquisitionFidelity`, a
 * `ModelCatalogEntryId`, a managed service or a tier. A rule's entire output is a
 * `DocumentTypeTemplate.key`. NOTHING ROUTES. The rung comes from
 * `DocumentType.expectedFidelity`, fixed at publication and identical for every
 * arrival resolving to that type — so a pack cannot vary the rung per document,
 * which is the property that matters.
 *
 * ⚠️ THE RESIDUAL EXPOSURE, STATED RATHER THAN ARGUED AWAY. A pack author CAN
 * ship a template declaring `expectedFidelity: 'scanned'`, and a rule resolving
 * to it does place matching arrivals on the paid, model-bearing path. That is
 * genuinely new — `documentTypeTemplates` was inert in all four packs before
 * this. `target_cannot_reach_declared_fidelity` does not eliminate the exposure
 * and does not claim to; what it eliminates is the SILENT case.
 * ==================================================================== */

/**
 * The kinds of thing a pack may assert about an arriving artefact.
 *
 * TWO ARMS, AND THE THIRD ONE THE DESIGN RECORD NAMES IS DELIBERATELY ABSENT.
 * `docs/build/ingestion-pipeline.md` §11 proposes a `sniffed_kind_is` arm, and
 * that section's own banner says *"NOTHING BELOW IS RULED"* and that no G number
 * may be minted from it without the owner — while its sanitise/sniff arms carry
 * two unresolved blockers against exactly those fields. Minting a sniffed-kind
 * vocabulary here would encode an unadjudicated design as decided, which is the
 * same reason the extraction ladder and F12 sanitisation are absent from §2.
 * A third arm is a ruling, not a widening.
 */
export const CLASSIFICATION_SIGNAL_KINDS = {
  filenameExtractionInSet: 'filename_extraction_in_set',
  intakeChannelIs: 'intake_channel_is',
} as const
export type ClassificationSignalKind =
  (typeof CLASSIFICATION_SIGNAL_KINDS)[keyof typeof CLASSIFICATION_SIGNAL_KINDS]

/**
 * One assertion about an arriving artefact.
 *
 * ⚠️ `intake_channel_is` READS `IntakeChannelKind` AND DOES NOT RESTATE ITS
 * MEMBERS. That is §5.3 refused at the declaration: G184 rules the intake
 * vocabulary to exactly one member set, and a signal arm listing four strings of
 * its own would be the second.
 */
export type ClassificationSignal =
  /**
   * The G130-shaped arm. NOTHING IS COMPILED: `extraction` is a declared
   * `IdentifierNormalisation` — the closed, parameterised op list — and `values`
   * are the enumerated results its OUTPUT is compared against.
   *
   * Every op is total, has no quantifier and allocates no backtracking state, so
   * catastrophic backtracking is not a bound to be chosen but a property that
   * cannot arise. And a reviewer approving *"split on '-', take segment 1,
   * casefold, then one of {inv}"* is approving something they can evaluate.
   *
   * ⚠️ THE PACK-AUTHORED HALF IS THE PATTERN AND THE COUNTERPARTY-CONTROLLED
   * HALF IS ONLY EVER AN OPERAND — the inverse of the arrangement G130 refused,
   * where the pattern itself would have been counterparty-derived.
   */
  | {
      readonly kind: 'filename_extraction_in_set'
      readonly extraction: IdentifierNormalisation
      /** The permitted extraction results, enumerated. Empty holds nothing. */
      readonly values: readonly string[]
    }
  | { readonly kind: 'intake_channel_is'; readonly channel: IntakeChannelKind }

/**
 * Whether a signal kind can hold AT MOST ONCE for one artefact, as a total
 * record — so a third arm is a compile error at this literal rather than a
 * silently-permissive default.
 *
 * An arrival has exactly one intake channel, so `mailbox AND upload` in one
 * conjunction can never hold. Repeating `filename_extraction_in_set` is
 * LEGITIMATE — two different extractions over one name — which is why the check
 * is per-KIND and not a blanket duplicate ban.
 */
export const SIGNAL_KIND_IS_SINGLE_VALUED: Record<ClassificationSignalKind, boolean> = {
  filename_extraction_in_set: false,
  intake_channel_is: true,
}

/**
 * A pack's claim that an artefact matching every signal is a given document type.
 *
 * TWO FIELDS: a target key and a CONJUNCTION. There is no score, no confidence,
 * no priority and no fallback arm — each of those is a routing decision, and a
 * rule's entire output is a key.
 */
export interface PackClassificationRule {
  /** Must name a `DocumentTypeTemplate` THIS pack ships. See the closure. */
  readonly documentTypeKey: string
  /** ALL must hold. An empty conjunction is TRUE, which is why it is refused. */
  readonly signals: readonly ClassificationSignal[]
}

export const CLASSIFICATION_RULE_VIOLATIONS = {
  targetNotShippedByThisPack: 'target_not_shipped_by_this_pack',
  ruleAssertsNothing: 'rule_asserts_nothing',
  signalHoldsNothing: 'signal_holds_nothing',
  signalValueNotInCanonicalForm: 'signal_value_not_in_canonical_form',
  signalValueExtractionRefused: 'signal_value_extraction_refused',
  signalKindRepeatedInOneRule: 'signal_kind_repeated_in_one_rule',
  targetCannotReachDeclaredFidelity: 'target_cannot_reach_declared_fidelity',
  duplicateSignalSetForDifferentTypes: 'duplicate_signal_set_for_different_types',
} as const
export type ClassificationRuleViolationKind =
  (typeof CLASSIFICATION_RULE_VIOLATIONS)[keyof typeof CLASSIFICATION_RULE_VIOLATIONS]

/**
 * ⚠️ THIS TYPE CARRIES TEXT AND THERE IS NO `AssertNoTextDeep` OVER IT. THAT IS
 * A DECISION AND NOT AN OVERSIGHT, AND IT IS THE ONE PLACE IN THIS MODULE WHERE
 * A STRING IS ADMITTED ON PURPOSE.
 *
 * The values here are a PACK AUTHOR's own declarations, read at PUBLICATION
 * time. No arrival, no filename and no counterparty byte reaches
 * `validatePackClassificationRules()` — its three parameters are the pack's own
 * templates, the pack's own rules and an extractor. The module's containment
 * claim is about the CASCADE, which runs over `ArrivalFacts`, and it is
 * unweakened by this. `ProcedureViolation` already carries a `detail` string for
 * the same reason at the same stage.
 */
export interface ClassificationRuleViolation {
  readonly rule: ClassificationRuleViolationKind
  readonly documentTypeKey: string
  /** Which signal in the conjunction, or null for a whole-rule finding. */
  readonly signalIndex: number | null
  readonly detail: string
}

/**
 * Which acquisition rungs CROSS A MANAGED-SERVICE BOUNDARY, as a total record —
 * so a fifth fidelity is a compile error here rather than a silent `false`.
 *
 * `structured` and `tabular` are parsed deterministically with no model in the
 * path. `digital_text` still puts a model on layout and `scanned` adds OCR;
 * both leave the account.
 */
export const FIDELITY_CROSSES_MANAGED_SERVICE: Record<AcquisitionFidelity, boolean> = {
  structured: false,
  tabular: false,
  digital_text: true,
  scanned: true,
}

/** Stable identity for a signal, so two conjunctions can be compared as sets. */
function signalToken(signal: ClassificationSignal): string {
  if (signal.kind === 'intake_channel_is') return `intake_channel_is:${signal.channel}`
  const ops = signal.extraction.ops.map((op) => JSON.stringify(op)).join(',')
  const values = [...signal.values].sort().join('|')
  return `filename_extraction_in_set:[${ops}]:${signal.extraction.then}:${signal.extraction.maxInputChars}:{${values}}`
}

/**
 * G110's publication-time half for the classification surface. Total; pure;
 * never throws; never constructs a `RegExp`.
 *
 * 🛑 THE PARAMETER LIST CONTAINS NO TENANT-SCOPED TYPE AND NO BRANDED ID, AND
 * THAT IS STRUCTURAL RATHER THAN INCIDENTAL. A validator that needed a tenant
 * would have to be handed a forged one by its CI call site — which is what
 * `tools/check-pack-safety.mjs` already does for the procedure loop, minting
 * `tenantId: null` into a `Procedure` as an adapter. Templates are
 * `Omit<…, 'id' | 'tenantId'>` and the rules are pack-authored, so nothing here
 * needs the adapter.
 *
 * `extract` is INJECTED rather than imported for the reason `ExtractionFn` gives
 * about itself: `model/reconciliation.ts` already imports `model/domain.ts`, and
 * this module reaching back for a VALUE would make that cycle real rather than
 * type-only. `applyExtraction()` satisfies it structurally and is the only
 * implementation.
 *
 * ─── WHAT IT CAN AND CANNOT DECIDE ABOUT OVERLAP, STATED EXACTLY ───
 *
 * FULL overlap is not decidable over this vocabulary: two
 * `filename_extraction_in_set` signals with different op lists may or may not
 * admit a common input, and deciding that in general means deciding equivalence
 * of op compositions. WHAT IS DECIDABLE IS THE CASE THAT MATTERS — two rules
 * with an IDENTICAL signal set resolving to different document types can never
 * disambiguate, on any input. The rest is a runtime refusal.
 *
 * That split is the honest one. A publication check that claimed to catch all
 * overlap would be §5.6 — a control that passes while asserting less than it
 * says.
 */
export function validatePackClassificationRules(
  templates: readonly DocumentTypeTemplate[],
  rules: readonly PackClassificationRule[],
  extract: ExtractionFn,
): readonly ClassificationRuleViolation[] {
  const violations: ClassificationRuleViolation[] = []
  const byKey = new Map<string, DocumentTypeTemplate>()
  for (const template of templates) byKey.set(template.key, template)

  /** Signal-set token → the first document type that claimed it. */
  const claimedBy = new Map<string, string>()

  for (const rule of rules) {
    const at = (
      kind: ClassificationRuleViolationKind,
      signalIndex: number | null,
      detail: string,
    ): void => {
      violations.push({ rule: kind, documentTypeKey: rule.documentTypeKey, signalIndex, detail })
    }

    /* THE CLOSURE, AND IT IS FIRST BECAUSE IT IS THE ONE A VALIDATOR AUTHOR
     * FORGETS. A pack composes over the templates it ships; it may not claim a
     * type it does not carry — the shape the record already states for roles:
     * "a pack or tenant composes roles and neither can invent a capability".
     * Without this a pack classifies arrivals into ANOTHER pack's document
     * types, or a tenant's own, by guessing a key string. */
    const template = byKey.get(rule.documentTypeKey)
    if (template === undefined) {
      at(
        CLASSIFICATION_RULE_VIOLATIONS.targetNotShippedByThisPack,
        null,
        'the rule names a document type this pack does not ship',
      )
      continue
    }

    /* G134 AT PUBLICATION TIME. A template with no fields has no per-field
     * `dataClass` to take a maximum over, so its document-level ceiling cannot
     * be evaluated AT ALL — and a rule resolving to it while declaring a rung
     * that leaves the account routes every match to a boundary that will refuse
     * it. One refusal per document, forever, with nothing at publication saying
     * why. */
    if (template.fields.length === 0 && FIDELITY_CROSSES_MANAGED_SERVICE[template.expectedFidelity]) {
      at(
        CLASSIFICATION_RULE_VIOLATIONS.targetCannotReachDeclaredFidelity,
        null,
        'the target declares no fields, so no document-level ceiling is computable, ' +
          'and the rung it declares crosses a managed-service boundary (G134)',
      )
    }

    /* AN EMPTY CONJUNCTION IS TRUE. `Array.prototype.every` returns `true` on an
     * empty array, so the natural one-liner makes an empty rule claim EVERY
     * artefact that ever arrives — a total classification bypass that passes
     * every happy-path test, because the happy path never ships an empty rule. */
    if (rule.signals.length === 0) {
      at(
        CLASSIFICATION_RULE_VIOLATIONS.ruleAssertsNothing,
        null,
        'a rule with no signals claims every arrival',
      )
    }

    const seenSingleValued = new Set<ClassificationSignalKind>()
    for (let i = 0; i < rule.signals.length; i += 1) {
      const signal = rule.signals[i]
      if (signal === undefined) continue

      if (SIGNAL_KIND_IS_SINGLE_VALUED[signal.kind]) {
        if (seenSingleValued.has(signal.kind)) {
          at(
            CLASSIFICATION_RULE_VIOLATIONS.signalKindRepeatedInOneRule,
            i,
            'this signal kind can hold at most once for one artefact, so a ' +
              'conjunction repeating it can never hold',
          )
        }
        seenSingleValued.add(signal.kind)
      }

      if (signal.kind !== 'filename_extraction_in_set') continue

      if (signal.values.length === 0) {
        at(
          CLASSIFICATION_RULE_VIOLATIONS.signalHoldsNothing,
          i,
          'an empty value set holds nothing, so the signal is false forever',
        )
        continue
      }

      /* 🛑 THIS CLOSES THE OPEN ITEM G130'S OWN DOCBLOCK NAMED AND DECLINED TO
       * BUILD: "declaring 'ABC' under then: 'casefold' is a predicate that is
       * silently false forever. NOTHING VALIDATES THAT, AND THIS BUILD DID NOT
       * ADD IT — the check is one line (`extract(value) === value` for every
       * declared value) and it needs the injected extractor."
       *
       * It needed the injected extractor, which is why the extractor is the
       * third parameter and why this is where the check finally lands.
       *
       * 🛑 AND G130's ONE-LINE SKETCH IS WRONG AS WRITTEN — FOUND BY BUILDING IT
       * RATHER THAN BY READING IT, AND CORRECTED HERE RATHER THAN COPIED.
       * `extract(value, extraction)` runs the WHOLE op list, and the op list
       * runs on the RAW SUBJECT while a declared value is the op list's OUTPUT.
       * The two are different strings by construction. The corpus's own rule
       * proves it: `split on '-', take segment 1` over the declared value `inv`
       * yields no segment 1 at all, so the literal one-liner would have refused
       * the one correct rule in the tree — a validator that rejects every
       * well-formed input, which is the §5.6 shape inverted.
       *
       * WHAT IS ACTUALLY BEING ASSERTED is that the value is a FIXED POINT OF
       * THE TERMINAL `Normaliser`, which is the whole of what G130's example
       * names: `'ABC'` under `casefold` can never equal a casefolded output. So
       * the ops are dropped and `then` is kept, and `maxInputChars` travels with
       * it because the extractor refuses an over-long input before anything
       * runs. Nothing else about the declared extraction is reinterpreted here.
       *
       * ⚠️ THE VALUES ARE STILL COMPARED AGAINST A NORMALISED FORM, NEVER
       * AGAINST A RAW SUBJECT. A validator that skipped the normaliser would
       * make `'INV'` look fine, and that is exactly the fallback
       * `extractionInSetHolds()` refuses at the point of use. */
      const canonicalising: IdentifierNormalisation = {
        ops: [],
        then: signal.extraction.then,
        maxInputChars: signal.extraction.maxInputChars,
      }
      for (const value of signal.values) {
        const extracted = extract(value, canonicalising)
        if (!extracted.ok) {
          at(
            CLASSIFICATION_RULE_VIOLATIONS.signalValueExtractionRefused,
            i,
            'the declared extraction refuses one of its own declared values, so ' +
              'either the terminal normaliser is unimplemented or the value is ' +
              'empty or over the declared input cap',
          )
          continue
        }
        if (extracted.key !== value) {
          at(
            CLASSIFICATION_RULE_VIOLATIONS.signalValueNotInCanonicalForm,
            i,
            'a declared value is not in the canonical form its own extraction ' +
              'produces, so the signal is silently false forever',
          )
        }
      }
    }

    /* THE DECIDABLE HALF OF OVERLAP. Two rules with the same signal set
     * resolving to DIFFERENT types can never disambiguate on any input, so the
     * pack has shipped an arrival it is guaranteed to refuse as ambiguous.
     * Identical sets for the SAME type are a redundancy, not a defect. */
    const token = rule.signals.map(signalToken).sort().join('&&')
    const first = claimedBy.get(token)
    if (first === undefined) {
      claimedBy.set(token, rule.documentTypeKey)
    } else if (first !== rule.documentTypeKey) {
      at(
        CLASSIFICATION_RULE_VIOLATIONS.duplicateSignalSetForDifferentTypes,
        null,
        'another rule in this pack claims an identical signal set for a different ' +
          'document type, so no arrival matching it can ever be disambiguated',
      )
    }
  }

  return violations
}
