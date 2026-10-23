/**
 * THE INGESTION PATH — an arrival admitted, its payload stored, its positions
 * addressable, and its subjects registered. **In one transaction, or not at
 * all.** G295, G320, G321, G322. 19 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE ONE PROPERTY THIS FILE EXISTS FOR, AND IT IS A PROPERTY OF THE
 *    FUNCTION SIGNATURE RATHER THAN OF THE BODY.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * G295: *"the payload table and the `FieldSpec` path column land TOGETHER with
 * uploads and documents, so NO CLASSIFIED VALUE IS EVER STORED WITHOUT AN
 * ADDRESSABLE CLASSIFICATION."* Its word for the alternative is
 * **UNRECOVERABLE** — *"you cannot retroactively discover which rows held whose
 * data."*
 *
 * A file exporting `storePayload()` and `registerSubject()` would let a caller
 * do the first and skip the second, and the skip would be silent and permanent.
 * **There is no such pair here.** `admitAndStoreArrival()` is the ONLY export
 * that writes, it takes the payload and the declarations together, and the
 * registration is not a step it performs afterwards — it is a PRECONDITION of
 * the payload insert:
 *
 *   · Every declared position whose class denotes a data subject is digested
 *     FIRST. A value that cannot be digested aborts the whole intake
 *     (`subject_not_digestible`), and nothing is written.
 *   · A stored declaration `parseFieldPath()` will not mint aborts it too
 *     (`declaration_unreadable`) — a document type with an unreadable
 *     declaration has positions nobody can address, and storing under it is the
 *     state G106 calls UNREADABLE arriving by accident rather than by rule.
 *   · Only then does the payload row go in, with the entries, on one
 *     `ScopedClient`, inside the caller's `withTenantScope()` transaction.
 *
 * ⚠️ **"THE ONLY EXPORT THAT WRITES" WENT FALSE ON 2 Oct 2026 — G2834 — AND IS
 * CORRECTED RATHER THAN DELETED.** Three exports write now:
 * `admitAndStoreArrival()` (the caller-typed path), `admitClassifyAndStoreArrival()`
 * (the path a source delivers down, where the arrival's NAME selects a pair or
 * the artefact PARKS — G2692, the owner's) and `drainParkedAgainstPair()`.
 * **The property survives because the store step does not split**: all three
 * store a document through ONE internal `storeDocument()`, which digests first
 * and writes after, so none of them can register-after or skip.
 *
 * `tests/db/payload-and-subject-index.test.ts` §8 and §8b are the assertions:
 * a payload whose subject cannot be digested is never stored, and a registration
 * the database REFUSES takes the payload row down with it. That is the inseparability as
 * a witnessed fact rather than as this paragraph.
 *
 * ─── WHAT IS NOT HERE, AND IT IS THE FIRST THING TO READ ───
 *
 * 🛑 **NO OPERATION IS MOUNTED.** `createUpload`, `completeUpload`,
 *    `getDocument` and `classifyValue` are declared on
 *    `docs/contracts/capability.openapi.yaml` and mounted nowhere, and this
 *    commit mounts none of them. G300 lifts G296's freeze *"on merit"* for an
 *    operation whose **table AND model AND capability** are all real; after
 *    this migration the TABLE is real and the other two are not:
 *
 *      · `getDocument` returns `Document` — `extracted` as
 *        `Record<FieldPathKey, ExtractedValue>` where every value carries a
 *        `scalar` and a `Provenance`, plus `lines`, `redactedPaths` and
 *        `acquisitionFidelity`. **This slice produces no extraction and no
 *        provenance.** Mounting it would mean inventing five fields, and
 *        `fast-json-stringify` SERIALISES a response without validating it, so
 *        the invention would ship silently — `0007`'s own lesson.
 *      · `createUpload` mints a presigned PUT through F8 and there is no object
 *        store on this path.
 *      · `classifyValue` is the write half of §5's table, and §5 grants the app
 *        role `SELECT` only, for the reason stated there.
 *
 *    **So this file is `0007`'s intermediate state, taken deliberately and with
 *    its precedent named:** *"a column with no reader is a column nothing
 *    checks"*, so the reader lands now and a real PostgreSQL drives it. The
 *    commit that mounts an intake operation MOUNTS rather than builds — and,
 *    under G301, it mints an authorisation record in the handler or
 *    `mountTier()` refuses to boot it.
 *
 * ─── INVARIANT 1 — READ THE SQL AND NOTE WHAT IS NOT IN IT ───
 *
 * 🛑 THERE IS NO TENANT PREDICATE IN ANY STATEMENT IN THIS FILE. No
 *    `WHERE tenant_id = $1`, no tenant bound anywhere, and on the INSERT side
 *    the tenant column is `current_setting('app.tenant_id')` **through the
 *    policy's `WITH CHECK`** rather than a parameter — so a write into another
 *    tenant is not merely refused, it is unexpressible. Isolation is produced
 *    entirely by row-level security reached through `withTenantScope()`, and
 *    `tests/db/payload-and-subject-index.test.ts` §7 disables RLS underneath
 *    this reader and requires the SAME call to LEAK. That control is what
 *    separates isolation produced by the database from isolation produced by a
 *    `WHERE` a handler happens to carry.
 *
 * ⚠️ EVERY FUNCTION TAKES A `ScopedClient` AND NEVER A POOL. `SET LOCAL`
 *    outside a transaction block is SILENTLY DISCARDED by PostgreSQL, so a
 *    module that opened its own transaction would be one autocommit away from
 *    serving every tenant's rows with RLS reporting success. **A signature that
 *    took a pool would make the mistake available; this one does not.**
 *
 * ─── INVARIANT 4 — WHAT MAKES A POSITION READABLE ───
 *
 * `readAddressablePayload()` builds its answer FROM THE DECLARATIONS and never
 * from the document. There is no branch in it that enumerates a payload's keys,
 * and there must never be one: `model/field-path.ts`'s `addressableKeys()`
 * states the identical rule one layer up — *"THE SET IS BUILT FROM THE
 * DECLARATIONS AND NEVER FROM THE DOCUMENT … A payload key with no `FieldSpec`
 * is not in this set, was never a candidate for it, and there is no branch
 * anywhere below that could add one."*
 *
 * 🛑 G106's REJECTED ALTERNATIVE IS NOT RE-TAKEN HERE IN ANY FORM. There is no
 *    default class, no "unknown" class, and no arm that returns an undeclared
 *    position at the most sensitive class. Defaulting was refused because
 *    *"readable-by-default-with-a-high-bar is scope failing OPEN"*.
 *
 * ─── INVARIANT 6 — INGESTED CONTENT IS DATA, NEVER INSTRUCTION ───
 *
 * Everything in a payload is counterparty-controlled, keys included. Three
 * things follow and all three are structural rather than reviewed:
 *
 *   · **No refusal in this file carries a payload value or a payload key.**
 *     `PayloadDefect` carries a table, a column and a document id;
 *     `IntakeOutcome`'s refusing arms carry a `FieldPathKey`, which is derived
 *     from an OPERATOR's declared path and never from the document.
 *   · **Nothing splits, joins or escapes a path.** A dotted form *"breaks on any
 *     key containing a dot, which is legal JSON, and its failure mode is that
 *     it silently addresses the WRONG key rather than refusing."* Paths come
 *     out of the database as token lists and go through `parseFieldPath()`.
 *   · **A value is never evaluated.** It is bound as a parameter, stored, and
 *     returned. The standing control on this file is a `grep -c` for the
 *     regular-expression constructor, and it must return ZERO.
 *
 * 🛑 THE CONTROL ABOVE IS DESCRIBED RATHER THAN SPELLED, AND THE REASON IS A
 *    DEFECT FOUND BY WRITING IT OUT AND THEN RUNNING IT. The first draft of
 *    this header carried the command verbatim — and the command then matched
 *    its own sentence, so it returned 1 and could never have gone green. **The
 *    two files this control was copied from have exactly the same defect and
 *    have had it all along:** the same grep over `model/ingestion.ts` returns
 *    **3** and over `model/reconciliation.ts` returns **2**, against headers
 *    that both state the answer is 0. Neither is wrong about the PROPERTY — no such
 *    constructor is called in either file — but **neither control can be run as
 *    written**, which is `docs/HANDOFF.md` §5.6 (*a control that passes while
 *    asserting nothing*) inverted into one that can only ever fail.
 *
 *    It is the same false-positive class `CLAUDE.md` catalogues for
 *    `@dropped-for-v1`, where *"two successive drafts of a paragraph EXPLAINING
 *    the drop each spelled the marker out, and each moved this count by one
 *    while dropping nothing"*, and the fix is the discipline `model/kernel.ts`
 *    already states for `FieldPath`'s superseded declaration: **cite by anchor,
 *    never by copy.** The two model files are NOT edited here — that is a
 *    cleanup and cleanups are separate commits — but the finding is recorded
 *    rather than left for the next reader to be misled by.
 */

import {
  ARRIVAL_VERDICT_KINDS,
  admitArrival,
  arrivalFilenameFrom,
  decideArrival,
} from '../../model/ingestion.ts'
import type {
  ArrivalFacts,
  ArrivalFilename,
  ArrivalRefusal,
  ArrivalVerdictKind,
  DeclaredPair,
  IntakeChannel,
  IntakeChannelKind,
  PairMappingLine,
  ParkReason,
} from '../../model/ingestion.ts'
import { fieldPathKey, parseFieldPath, resolveFieldPath } from '../../model/field-path.ts'
import { ACQUISITION_FIDELITY, DATA_CLASSES, DATA_TYPES } from '../../model/domain.ts'
import type { AcquisitionFidelity, DataClass, DataType } from '../../model/domain.ts'
import type { FieldPath, FieldPathKey, Json, Timestamp } from '../../model/kernel.ts'
import type { ScopedClient } from '../../db/tenant-scope.ts'
import { subjectDigest } from './subject-digest.ts'

/* ==================================================================== *
 * §1  THE VOCABULARY, DERIVED FROM THE MODEL AND NOT TRANSCRIBED BESIDE IT
 *
 * 🛑 `server/data-plane/run-vocabulary.ts`'s HEADER SAYS **"There are THREE
 *    meeting points now"** AND THE COMMAND IT SITS BESIDE ALREADY RETURNED
 *    TWELVE BEFORE THIS FILE EXISTED. That is named here rather than corrected
 *    there, because it is not this slice's sentence to rewrite and because a
 *    reader arriving at that header needs to know it is stale. **The property
 *    that was load-bearing survives all of them and is the one to keep**, in
 *    that file's own words: *"'One place' was a proxy for it … a vocabulary is
 *    DERIVED from the model, never transcribed beside it."* Derive the set, do
 *    not read any number:
 *    `grep -rl "from '\.\./\.\./model/" server/ | sort`
 * ==================================================================== */

/**
 * Whether a `DataClass` denotes A DATA SUBJECT'S OWN DATA, and therefore
 * whether a value at that class must be registered in the subject index before
 * it may be stored.
 *
 * 🛑 IT IS A TOTAL `Record<DataClass, boolean>`, SO A FIFTH CLASS IS A COMPILE
 *    ERROR AT THIS LITERAL rather than a silently-permissive default. The
 *    permissive default is the dangerous direction: a new class defaulting to
 *    `false` would store a subject's data with no registered location, which is
 *    G295's UNRECOVERABLE state arriving through a `Record` nobody made total.
 *    `CAPABILITY_RESOURCE_CLASS` and `CHANNEL_DRAWS_THROUGH_AN_ENDPOINT` are
 *    the same device for the same reason.
 *
 * 🛑 AND IT IS CONSTRUCTED HERE, AT MODULE SCOPE, AND READ ON EVERY INTAKE.
 *    `docs/HANDOFF.md` §5.10 records five total records landing with NO
 *    construction site anywhere, so `tsc` could not have failed on a single
 *    field chosen — *"a total `Record` only bites where something CONSTRUCTS
 *    one"*.
 *
 * ⚠️ `internal` IS `false` AND IT IS THE ONE WORTH ARGUING. An internal value
 *    is ours — a run id, a slot name, a reconciliation state — and indexing it
 *    as a subject would fill the erasure index with tokens for things that are
 *    not people, which makes the index's answer to *"where does this subject
 *    rest"* strictly less trustworthy. `public` is the same case, louder.
 *    `DATA_CLASSES`' own docblock draws the line where this does:
 *    *"`sensitive_personal` is the PDPA-adjacent tier covering identity
 *    documents, national identifiers and health data."*
 */
export const CLASS_DENOTES_A_SUBJECT: Record<DataClass, boolean> = {
  public: false,
  internal: false,
  personal: true,
  sensitive_personal: true,
}

/**
 * The `DataClass` order, for the maximum `tenant.subject_index_entry.data_class`
 * carries. G134 puts a document's ceiling at the maximum across its fields and
 * G208 points the same rule outward; this is that rule pointed at one subject
 * in one document.
 *
 * ⚠️ TOTAL FOR THE SAME REASON AS ABOVE, and the numbers are an ORDER rather
 * than a scale — nothing multiplies them and nothing publishes them.
 */
const CLASS_RANK: Record<DataClass, number> = {
  public: 0,
  internal: 1,
  personal: 2,
  sensitive_personal: 3,
}

/** A stored `data_class` the model cannot name refuses the read; it is not coerced. */
function asDataClass(value: unknown): DataClass | null {
  if (typeof value !== 'string') return null
  for (const known of Object.values(DATA_CLASSES)) {
    if (known === value) return known
  }
  return null
}

const CHANNEL_KINDS: Record<IntakeChannelKind, true> = {
  upload: true,
  watched_drop: true,
  connector_pull: true,
  mailbox: true,
}

function asChannelKind(value: unknown): IntakeChannelKind | null {
  if (typeof value !== 'string') return null
  return Object.prototype.hasOwnProperty.call(CHANNEL_KINDS, value)
    ? (value as IntakeChannelKind)
    : null
}

/**
 * `FieldSpec.dataType`, read back out of `db/migrations/0170`'s column — G1373.
 *
 * 🛑 THIS IS WHERE `0170`'s MISSING `CHECK` IS PAID FOR, AND THE MIGRATION SAYS
 *    SO ON ITS OWN FACE. The column is bare `text` with no constraint, on
 *    `0007`'s and `0069`'s stated polarity — *"an UNKNOWN value must reach the
 *    model as an `*_unreadable` refusal, not be rejected at write time by a
 *    list somebody forgot to extend"*. **A migration that declines a CHECK owes
 *    a reader that refuses, or it has bought nothing and given something up.**
 *    Measured before this function existed: with `data_type = 'currency'`
 *    stored, `readAddressablePayload()` answered `'document'` and published
 *    that position as a perfectly good addressable value.
 *
 * ✅ IT DERIVES FROM `DATA_TYPES` SINCE 21 Sep 2026 — G1453 — AND THE NOTE THAT
 *    STOOD HERE IS CORRECTED RATHER THAN DELETED, BECAUSE IT NAMED THE
 *    CONDITION AND THE CONDITION WAS MET. It read: *"IT IS A TOTAL `Record` AND
 *    NOT AN ARRAY LITERAL, WHICH IS `CHANNEL_KINDS`' SHAPE TWO DECLARATIONS UP
 *    AND IS THE WHOLE COMPILE-TIME GUARANTEE: a SIXTH `DataType` minted in
 *    `model/domain.ts` is a `TS2739` HERE rather than a value this reader
 *    silently refuses for ever. `asDataClass()` above derives its member set
 *    from `DATA_CLASSES` instead, and would be the better shape — **`DataType`
 *    is a bare union with no const beside it**, so there is nothing to iterate.
 *    Minting a `DATA_TYPES` const in the model is `model/extraction.ts`'s to
 *    take, and both readers should derive from it when it exists."*
 *
 * 🛑 **THE COMPILE-TIME GUARANTEE IS NOT WEAKENED BY THE CHANGE, IT IS MOVED TO
 *    WHERE IT CANNOT BE SATISFIED BY ACCIDENT.** The old `Record<DataType, true>`
 *    made a sixth member a `TS2739` here — and the only thing an author had to
 *    do to clear it was type `true`, which is a compile error that teaches
 *    nothing. Deriving from the const means there is no second member set to
 *    maintain at all, and the decision a sixth `DataType` really owes —
 *    *which `ExtractedScalar` arm does it produce* — is a `TS2739` at
 *    `EXTRACTED_KIND_FOR_DATA_TYPE` in `model/extraction.ts`, where it cannot
 *    be answered without answering it. **One member set, one real question.**
 *    This is `asDataClass()`'s shape above, reached at last.
 */

/** A stored `data_type` the model cannot name refuses the read; it is not coerced. */
function asDataType(value: unknown): DataType | null {
  if (typeof value !== 'string') return null
  for (const known of Object.values(DATA_TYPES)) {
    if (known === value) return known
  }
  return null
}

/* ==================================================================== *
 * §2  WHAT A CALLER GETS BACK
 * ==================================================================== */

/**
 * What a stored row carried that the model cannot name. **Carries no cell
 * value and no payload key** — `AccountDefect` in
 * `server/data-plane/run-account-store.ts` is the same shape for the same
 * reason.
 */
export interface PayloadDefect {
  readonly table: string
  readonly column: string
  readonly sourceDocumentId: string
}

/**
 * The outcome of one intake. **Five arms, and only one of them stores.**
 *
 * 🛑 `refused` STILL WRITES A ROW, AND THAT IS G205's WHOLE POINT: *"a channel
 *    that has seen forty thousand files has one row and one timestamp, and
 *    without this nothing anywhere records that file 39,998 was refused or
 *    why."* A refusal that wrote nothing would be the state the `Arrival`
 *    entity was created to end.
 *
 * ⚠️ THE TWO ABORTING ARMS WRITE NOTHING AT ALL — not even the arrival — and
 *    the asymmetry is deliberate. A `refused` arrival is a DECIDED FACT about
 *    an artefact: the cascade ran and said no. `subject_not_digestible` and
 *    `declaration_unreadable` are not facts about the artefact; they are this
 *    plane being unable to hold it safely, and recording them as arrival
 *    verdicts would put a fault of ours in the column an operator reads to
 *    learn about the counterparty. The caller's transaction rolls back and the
 *    caller is told which position, by its OPERATOR-DECLARED key.
 */
export type IntakeOutcome =
  | {
      readonly kind: 'stored'
      readonly sourceDocumentId: string
      /** How many distinct subjects were registered at this location. */
      readonly subjectsRegistered: number
    }
  | { readonly kind: 'refused'; readonly refusal: ArrivalRefusal }
  /**
   * No tenant scope. G100's deny-on-NULL, answered by name instead of as
   * whichever statement failed first. Writing nothing is the whole content.
   */
  | { readonly kind: 'unscoped' }
  /** No lane with this id. The cascade takes a LOADED channel and there is none. */
  | { readonly kind: 'channel_absent' }
  /** A declared path in `document_field_spec` that `parseFieldPath()` will not mint. */
  | { readonly kind: 'declaration_unreadable'; readonly pathKey: string }
  /** A subject-class position holds a value `canonicalise()` refuses. */
  | { readonly kind: 'subject_not_digestible'; readonly pathKey: FieldPathKey }

/** One position a reader may address, with the class and type declared for it. */
export interface AddressableValue {
  readonly pathKey: FieldPathKey
  /** The declared path, in `model/field-path.ts`'s wire form. */
  readonly path: readonly (string | number)[]
  readonly dataClass: DataClass
  /**
   * 🛑 WHAT KIND OF THING IS AT THIS POSITION — G1371, AND IT IS THE OPERATOR'S
   *    ANSWER RATHER THAN THE ARTEFACT'S. Invariant 4: *"Classification is
   *    declared once, on `FieldSpec`, and everything derives from it."*
   *
   * **This field exists so that nothing downstream ever has to look at `value`
   * to decide what it is.** The conversion seam that turns this into an
   * `ExtractedScalar` (`model/extraction.ts`, NOT WRITTEN) dispatches on THIS,
   * and the alternative is sniffing counterparty-controlled JSON — `"1234"` is
   * an identifier or a number depending on who is guessing, and the guess fails
   * SILENTLY rather than refusing. That is G106's refused default arriving on a
   * second axis.
   *
   * ⚠️ IT IS NOT DERIVED FROM `value` AND MUST NEVER BE. The fixture that makes
   *    this concrete is deliberate: `tests/db/payload-and-subject-index.test.ts`
   *    declares `invoice.total` as `money` and stores the JSON NUMBER `1000`, so
   *    a sniffing reader answers `'number'` — confidently, and wrongly, and
   *    `model/money.ts` is never reached for a figure that is money.
   */
  readonly dataType: DataType
  readonly modelProcessingAllowed: boolean
  readonly value: Json
}

/**
 * 🛑 `no_document` IS A STATED ANSWER AND NOT AN EMPTY DOCUMENT, and an empty
 *    `addressable` under an EXISTING document is an OBSERVATION rather than an
 *    absence — *"the engine ran and observed no shortfall"* versus *"this plane
 *    holds no account at all"*, `server/data-plane/runs.ts`' distinction,
 *    applied here. An empty map means the document type declares no addressable
 *    position, which is G106's fail-closed default working, and it is a
 *    different fact from a document nobody stored.
 */
export type PayloadRead =
  | { readonly kind: 'no_document' }
  | {
      readonly kind: 'document'
      readonly sourceDocumentId: string
      readonly documentTypeId: string
      /** Keyed by `fieldPathKey()`, as `Document.extracted` is. */
      readonly addressable: Readonly<Record<FieldPathKey, AddressableValue>>
      /**
       * Declared positions THIS document does not carry. Named rather than
       * silently omitted, for `Document.redactedPaths`' reason: *"a reviewer
       * comparing a redacted value against an unredacted one reaches a
       * confident wrong conclusion."* Here the confusion would be between
       * *"the field is absent"* and *"the field is not declared"*, which are
       * the two halves invariant 4 exists to keep apart.
       */
      readonly declaredButAbsent: readonly FieldPathKey[]
    }
  | { readonly kind: 'unpublishable'; readonly defect: PayloadDefect }

/** Where one subject's data rests. The query an erasure request asks. */
export interface SubjectLocationRow {
  readonly locationKind: 'source_document'
  readonly sourceDocumentId: string
  readonly dataClass: DataClass
  readonly recordedAt: string
}

/* ==================================================================== *
 * §3  THE LANE — a LOOKUP, never a parse
 * ==================================================================== */

/**
 * `model/serving-host.ts`'s rule, applied one layer down: resolution is a
 * LOOKUP. Nothing here derives a lane from an id's shape.
 */
export async function readIntakeChannel(
  tx: ScopedClient,
  channelId: string,
): Promise<IntakeChannel | null> {
  const found = await tx.query(
    `SELECT tenant_id, id, kind, endpoint_id, enabled
       FROM tenant.intake_channel
      WHERE id = $1`,
    [channelId],
  )
  const row = found.rows[0] as
    | {
        tenant_id: string
        id: string
        kind: string
        endpoint_id: string | null
        enabled: boolean
      }
    | undefined
  if (row === undefined) return null

  const kind = asChannelKind(row.kind)

  /* A stored kind the model cannot name is NOT coerced and NOT defaulted. An
   * unnameable lane is an unusable lane, and returning `null` routes it to
   * `channel_absent` — which refuses the intake. The alternative, picking a
   * kind, would run `CHANNEL_DRAWS_THROUGH_AN_ENDPOINT` against a guess. */
  if (kind === null) return null

  /* 🛑 `tenant_id` IS READ OFF THE ROW AND IT IS THE ONLY HONEST SOURCE FOR IT.
   * `IntakeChannel extends TenantScoped`, and inventing a value — an empty
   * string, or one threaded from a parameter — would put a tenant on a model
   * type that did not come from the scope. Row-level security has already
   * guaranteed `tenant_id = current_setting('app.tenant_id')` before this row
   * was returned, so the column IS the scope's tenant, derived rather than
   * asserted. Invariant 1, at the one place a `TenantScoped` value is built. */
  return {
    tenantId: row.tenant_id as IntakeChannel['tenantId'],
    id: row.id as IntakeChannel['id'],
    kind,
    endpointId: row.endpoint_id as IntakeChannel['endpointId'],
    enabled: row.enabled,
    /* DERIVED, never stored — `IntakeChannel.lastArrivalAt`'s own docblock, and
     * `0011`'s §1. No caller of the cascade reads it, so it is not queried
     * here: `guardChannelLive()` and `guardIntakeChannel()` never touch it, and
     * a join on every admission to fill a field nothing reads would be a cost
     * with no buyer. `listIntakeChannels` is the reader, and it does not
     * exist. */
    lastArrivalAt: null,
  }
}

/* ==================================================================== *
 * §4  THE WRITE — all three, or none
 * ==================================================================== */

export interface IntakeInput {
  /** What is known about the artefact before anything has read it. */
  readonly facts: ArrivalFacts
  /** Which `DocumentType`'s `FieldSpec`s address this payload. */
  readonly documentTypeId: string
  /** The id the admitted arrival becomes. Minted by the caller. */
  readonly sourceDocumentId: string
  /** The counterparty's document. Stored whole; see `0011` §4. */
  readonly payload: Json
  /** The grants the caller resolved for this acquisition. */
  readonly presentedAuthorizationIds: readonly ArrivalFacts['authorizationId'][]
  /** `Endpoint.boundUntil` for the drawing endpoint. Null on an upload lane. */
  readonly boundUntil: Timestamp | null
  /** A RESOLVED ANSWER, not a key to look up. `ArrivalContext`'s own rule. */
  readonly earlierArrivalWithSameContent: ArrivalFacts['arrivalId'] | null
  /** Our clock. `ArrivalContext.now`, never a fact the artefact asserts. */
  readonly now: Timestamp
  /** `Arrival.readingId` — the reading that drew it, on a drawing lane. */
  readonly readingId: string | null
}

/** A declared position, read back out of `tenant.document_field_spec`. */
interface Declaration {
  readonly pathKey: FieldPathKey
  readonly path: FieldPath
  readonly dataClass: DataClass
  readonly dataType: DataType
  readonly modelProcessingAllowed: boolean
}

/**
 * Read a document type's declarations, each path through the ONE seam.
 *
 * Returns the stored `path_key` of the first row this plane cannot read,
 * rather than the path — a refusal must not carry a declaration this plane has
 * just decided it cannot read, and the key is one-way.
 *
 * 🛑 AND IT RETURNS THE **COLUMN**, WHICH IT DID NOT UNTIL G1372, AND THE
 *    ABSENCE WAS A LIVE DEFECT RATHER THAN A TIDINESS GAP. `PayloadDefect`
 *    carries a `column` and is documented as naming one; every refusal here
 *    used to surface at the single call site below as a hard-coded
 *    `column: 'path'`. **Measured, before this signature changed:** a stored
 *    `data_class` of `'confidential'` answered
 *    `{"kind":"unpublishable","defect":{"table":"document_field_spec",
 *    "column":"path", …}}` — naming a column that was perfectly readable, and
 *    pointing whoever went to repair the row at the wrong one.
 *
 * ⚠️ THE SHAPE IS NOT INVENTED HERE — `server/data-plane/definition-store.ts`
 *    reads THIS SAME TABLE and has always answered by the real column
 *    (`bad('document_field_spec', 'data_class')`, `'model_processing_allowed'`,
 *    `'confidence_floor'`). This is the older reader converging on its sibling,
 *    not a new convention.
 */
async function readDeclarations(
  tx: ScopedClient,
  documentTypeId: string,
): Promise<
  | { ok: true; declarations: readonly Declaration[] }
  | { ok: false; pathKey: string; column: string }
> {
  const found = await tx.query(
    `SELECT path_key, path, data_class, data_type, model_processing_allowed
       FROM tenant.document_field_spec
      WHERE document_type_id = $1
      ORDER BY path_key`,
    [documentTypeId],
  )

  const declarations: Declaration[] = []
  for (const raw of found.rows) {
    const row = raw as {
      path_key: string
      path: unknown
      data_class: string
      data_type: string
      model_processing_allowed: boolean
    }
    const parsed = parseFieldPath(row.path)
    if (!parsed.ok) return { ok: false, pathKey: row.path_key, column: 'path' }

    const dataClass = asDataClass(row.data_class)
    /* A stored class the model cannot name is refused along the same arm. A
     * class nobody can read is a position nobody can classify, which is exactly
     * the state G106 calls UNREADABLE — and coercing it would be the defaulting
     * G106 rejected, arriving through a cast. */
    if (dataClass === null) return { ok: false, pathKey: row.path_key, column: 'data_class' }

    /* 🛑 AND THE SAME ARGUMENT ON THE TYPE AXIS — G1373. `0170` carries NO
     * `CHECK` on this column by ruling, so an unknown value is STORABLE and
     * this line is the only thing that refuses it. Coercing to `'string'`
     * would be strictly worse than refusing: a money position read as a string
     * never reaches `model/money.ts`, and the run would complete and be
     * wrong rather than refuse and be obvious. */
    const dataType = asDataType(row.data_type)
    if (dataType === null) return { ok: false, pathKey: row.path_key, column: 'data_type' }

    /* 🛑 THE KEY IS RE-DERIVED AND NOT TRUSTED. `path_key` is stored so it can
     * be a primary key and a join key; the value used downstream is
     * `fieldPathKey(parsed.path)`, computed here from the path the seam just
     * minted. A stored key that disagrees with its own path would otherwise
     * silently address a position under the wrong identity, and
     * `tests/db/payload-and-subject-index.test.ts` §1 asserts the two agree in
     * both directions. */
    declarations.push({
      pathKey: fieldPathKey(parsed.path),
      path: parsed.path,
      dataClass,
      dataType,
      modelProcessingAllowed: row.model_processing_allowed,
    })
  }
  return { ok: true, declarations }
}

/**
 * THE ONE WRITE. Runs the cascade, records the verdict, and — on admission —
 * stores the payload and registers its subjects in the same transaction.
 *
 * 🛑 THE ORDER OF THE WRITES IS THE CONTRACT. Declarations and digests come
 *    FIRST, before a single `INSERT` touches `document_payload`, so a payload
 *    whose subjects cannot be registered is never written even for the length
 *    of a transaction. The alternative — insert, then register, then roll back
 *    on failure — has the same end state today and is refused anyway: it makes
 *    the ordering an accident of the body rather than a property of the
 *    function, and the first person to add an early `COMMIT` for a long
 *    document would produce the UNRECOVERABLE state with a green suite.
 */
export async function admitAndStoreArrival(
  tx: ScopedClient,
  input: IntakeInput,
): Promise<IntakeOutcome> {
  /* THE TENANT COLUMN IS `current_setting('app.tenant_id')` AND NOT A BOUND
   * PARAMETER — the insert-side form of this file's header rule. The value
   * cannot be supplied by a caller, so an insert into another tenant is not
   * merely refused by `WITH CHECK`, it is unexpressible. And because the GUC is
   * `SET LOCAL` inside `withTenantScope()`'s transaction, a statement issued
   * outside one reads NULL and the policy denies (G100). */
  const T = "nullif(current_setting('app.tenant_id', true), '')"

  /* 🛑 THE DIGEST KEY COMES FROM THE TRANSACTION'S OWN GUC, WHICH IS INVARIANT 1
   * APPLIED TO A HASH KEY. `IntakeInput` carries no `tenantId` and
   * `ArrivalFacts` deliberately has none either — *"a tenant hint riding on a
   * landing notification therefore has nowhere to enter the cascade"* — and a
   * caller that could supply one could make this tenant's subject tokens
   * collide with another tenant's, which is the single failure G321's
   * per-tenant key exists to prevent.
   *
   * ⚠️ IT IS ONE EXTRA ROUND TRIP AND IT IS BOUGHT DELIBERATELY. Threading the
   * value the caller opened the scope with would be free and would put a
   * tenant-shaped parameter on this function's signature, which is the thing
   * the paragraph above says must not exist. */
  const scope = await tx.query(`SELECT ${T} AS tenant_id`)
  const tenantId = (scope.rows[0] as { tenant_id: string | null } | undefined)?.tenant_id ?? null
  /* G100's polarity, read rather than relied on: outside `withTenantScope()`
   * the GUC is unset, every INSERT below would violate `tenant_id NOT NULL`,
   * and every SELECT would return nothing. Answering BY NAME here is what makes
   * `tests/db/payload-and-subject-index.test.ts` §8 an assertion about the
   * store rather than about which statement happened to fail first. */
  if (tenantId === null || tenantId === '') return { kind: 'unscoped' }

  const channel = await readIntakeChannel(tx, input.facts.channelId)
  if (channel === null) return { kind: 'channel_absent' }

  const admission = admitArrival(input.facts, {
    channel,
    presentedAuthorizationIds: input.presentedAuthorizationIds,
    boundUntil: input.boundUntil,
    now: input.now,
    earlierArrivalWithSameContent: input.earlierArrivalWithSameContent,
  })

  if (!admission.ok) {
    await writeRefusedArrival(tx, input, null, admission.refusal)
    return { kind: 'refused', refusal: admission.refusal }
  }

  /* ---- EVERYTHING BELOW IS THE ADMITTED ARM, AND THE ORDER IS THE POINT ---- */

  return storeDocument(
    tx,
    tenantId,
    {
      sourceDocumentId: input.sourceDocumentId,
      arrivalId: input.facts.arrivalId,
      documentTypeId: input.documentTypeId,
      payload: input.payload,
      now: input.now,
    },
    () => writeAdmittedArrival(tx, input, null),
  )
}

/** The columns every arrival row carries, from whichever intake wrote it. */
interface ArrivalWrite {
  readonly facts: ArrivalFacts
  readonly now: Timestamp
  readonly readingId: string | null
  readonly sourceDocumentId?: string
}

const T = "nullif(current_setting('app.tenant_id', true), '')"

async function writeRefusedArrival(
  tx: ScopedClient,
  input: ArrivalWrite,
  filename: ArrivalFilename | null,
  r: ArrivalRefusal,
): Promise<void> {
  await tx.query(
    `INSERT INTO tenant.arrival
       (tenant_id, id, channel_id, channel_kind, endpoint_id, authorization_id,
        arrived_at, verdict_kind, refusal_kind,
        refusal_on_channel_id, refusal_on_channel_kind, refusal_on_channel_endpoint,
        refusal_defect_kind, refusal_earlier_arrival_id,
        source_document_id, reading_id, filename)
     VALUES (${T}, $1, $2, $3, $4, $5, $6, 'refused', $7, $8, $9, $10, $11, $12, NULL, $13, $14)`,
    [
      input.facts.arrivalId,
      input.facts.channelId,
      input.facts.channelKind,
      input.facts.endpointId,
      input.facts.authorizationId,
      input.now,
      r.kind,
      r.kind === 'channel_not_the_one_presented' ? r.onChannel : null,
      r.kind === 'channel_kind_disagrees' ? r.onChannel : null,
      r.kind === 'channel_endpoint_disagrees' ? r.onChannel : null,
      r.kind === 'channel_is_not_a_legal_lane' ? r.defect.kind : null,
      r.kind === 'duplicate_of_earlier_arrival' ? r.earlier : null,
      input.readingId,
      filename,
    ],
  )
}

async function writeAdmittedArrival(
  tx: ScopedClient,
  input: ArrivalWrite & { readonly sourceDocumentId: string },
  filename: ArrivalFilename | null,
): Promise<void> {
  await tx.query(
    `INSERT INTO tenant.arrival
       (tenant_id, id, channel_id, channel_kind, endpoint_id, authorization_id,
        arrived_at, verdict_kind, source_document_id, reading_id, filename)
     VALUES (${T}, $1, $2, $3, $4, $5, $6, 'admitted', $7, $8, $9)`,
    [
      input.facts.arrivalId,
      input.facts.channelId,
      input.facts.channelKind,
      input.facts.endpointId,
      input.facts.authorizationId,
      input.now,
      input.sourceDocumentId,
      input.readingId,
      filename,
    ],
  )
}

/** What one stored document is, independent of which act stored it. */
interface DocumentWrite {
  readonly sourceDocumentId: string
  readonly arrivalId: string
  readonly documentTypeId: string
  readonly payload: Json
  readonly now: Timestamp
}

type StoreOutcome =
  | { readonly kind: 'stored'; readonly sourceDocumentId: string; readonly subjectsRegistered: number }
  | { readonly kind: 'declaration_unreadable'; readonly pathKey: string }
  | { readonly kind: 'subject_not_digestible'; readonly pathKey: FieldPathKey }

/**
 * 🛑 THE ONE PLACE A DOCUMENT IS STORED, AND THERE ARE NOW THREE CALLERS OF IT
 *    RATHER THAN ONE (G2834). The caller-typed upload path, the classifying
 *    path and the drain all store through here, so the ORDER this file's
 *    header calls the contract — declarations and digests FIRST, then
 *    `before()`, then the document, its payload and its subjects — is a
 *    property of this function and cannot be reordered by a fourth caller.
 *    `before()` is where a caller writes the row the document's foreign key
 *    needs (the arrival); the drain writes nothing there, because its arrival
 *    already exists.
 */
async function storeDocument(
  tx: ScopedClient,
  tenantId: string,
  doc: DocumentWrite,
  before: () => Promise<void>,
): Promise<StoreOutcome> {
  const declared = await readDeclarations(tx, doc.documentTypeId)
  if (!declared.ok) return { kind: 'declaration_unreadable', pathKey: declared.pathKey }

  /* The subjects, resolved and digested BEFORE anything is stored.
   *
   * ⚠️ DEDUPLICATED HERE AND NOT BY `ON CONFLICT DO NOTHING`. One subject at
   * one location is ONE FACT, and two declared paths holding the same value is
   * the ordinary case — but swallowing the collision at the database is the
   * shape `guardSingularity()`'s docblock refuses one layer up: *"swallow it as
   * an `ON CONFLICT DO NOTHING` … after which conservation holds over a
   * population already one row short."* The `Map` makes the dedup a visible
   * step whose result is countable, and the primary key stays a real
   * constraint rather than a suppressed one. */
  const subjects = new Map<string, DataClass>()
  for (const declaration of declared.declarations) {
    if (!CLASS_DENOTES_A_SUBJECT[declaration.dataClass]) continue

    const resolved = resolveFieldPath(doc.payload, declaration.path)
    /* A declared position this document does not carry registers nothing.
     * `resolveFieldPath()` refuses BY NAME rather than answering `undefined`,
     * which is why this is an absence and not a value. */
    if (!resolved.ok) continue

    const digest = subjectDigest(tenantId, resolved.value)
    if (!digest.ok) {
      return { kind: 'subject_not_digestible', pathKey: declaration.pathKey }
    }

    /* THE MAXIMUM, per `0011` §6: one subject reached through a `personal` path
     * and a `sensitive_personal` path rests here at the higher class. */
    const held = subjects.get(digest.ref)
    if (held === undefined || CLASS_RANK[declaration.dataClass] > CLASS_RANK[held]) {
      subjects.set(digest.ref, declaration.dataClass)
    }
  }

  await before()

  await tx.query(
    `INSERT INTO tenant.source_document
       (tenant_id, id, arrival_id, document_type_id, ingested_at)
     VALUES (${T}, $1, $2, $3, $4)`,
    [doc.sourceDocumentId, doc.arrivalId, doc.documentTypeId, doc.now],
  )

  await tx.query(
    `INSERT INTO tenant.document_payload (tenant_id, source_document_id, payload)
     VALUES (${T}, $1, $2::jsonb)`,
    [doc.sourceDocumentId, JSON.stringify(doc.payload)],
  )

  for (const [subjectRef, dataClass] of subjects) {
    await tx.query(
      `INSERT INTO tenant.subject_index_entry
         (tenant_id, subject_ref, location_kind, location_source_document_id,
          data_class, recorded_at)
       VALUES (${T}, $1, 'source_document', $2, $3, $4)`,
      [subjectRef, doc.sourceDocumentId, dataClass, doc.now],
    )
  }

  return {
    kind: 'stored',
    sourceDocumentId: doc.sourceDocumentId,
    subjectsRegistered: subjects.size,
  }
}

/* ==================================================================== *
 * §4a  THE CLASSIFYING INTAKE AND THE DRAIN — G2692 (THE OWNER'S), G2834.
 *      C9 rows 7, 9 and 16.
 *
 * `admitAndStoreArrival()` above is the CALLER-TYPED path: whoever calls it
 * names the document type. This is the path a SOURCE delivers down, and on it
 * nobody names a type — the arrival's own name selects among the pairs an
 * operator declared on that source (`decideArrival()`, `model/ingestion.ts`
 * §2a), or the artefact PARKS.
 *
 * 🛑 IT HAS NO CALLER OUTSIDE `tests/`, AND THAT IS STATED RATHER THAN LEFT TO
 *    BE DISCOVERED. Nothing reads a source: the connector that would deliver
 *    down a `watched_drop` lane is not built (G2686, G2689), and
 *    `createUpload`/`completeUpload` are unmounted. `0007`'s precedent: a
 *    surface proven against a real PostgreSQL without a route. What IS served
 *    is everything downstream of a parked artefact — the pile, the pane, the
 *    drain and the escalation (`server/data-plane/parked.ts`, `sources.ts`).
 *
 * 🛑 THE SOURCE IS LOCKED `FOR SHARE` BEFORE ITS PAIRS ARE READ, and a pair
 *    declaration locks it `FOR UPDATE`. Without it an artefact could read the
 *    pairs as they were, park, and commit AFTER a concurrent declaration had
 *    already scanned the pile — parked against a pair that exists, with no
 *    later act to drain it. The lock makes the two serialise; the pane's
 *    derived reason is the second line of defence, not the first.
 * ==================================================================== */

export interface ClassifyingIntakeInput {
  readonly facts: ArrivalFacts
  /** The counterparty's name for the artefact, through the ONE seam. */
  readonly filename: ArrivalFilename | null
  /** The record as the source delivered it, BEFORE any mapping. */
  readonly payload: Json
  /** The id the artefact becomes IF it extracts. Minted by the caller. */
  readonly sourceDocumentId: string
  readonly presentedAuthorizationIds: readonly ArrivalFacts['authorizationId'][]
  readonly boundUntil: Timestamp | null
  readonly earlierArrivalWithSameContent: ArrivalFacts['arrivalId'] | null
  readonly now: Timestamp
  readonly readingId: string | null
}

export type ClassifyingIntakeOutcome =
  | IntakeOutcome
  | {
      readonly kind: 'parked'
      readonly reason: ParkReason
      readonly matchingPairIds: readonly string[]
    }
  /** The lane draws through no source, so there is nothing to classify against.
   *  An upload lane names its type through `admitAndStoreArrival()`. */
  | { readonly kind: 'lane_draws_through_no_source' }
  /** A stored pair this plane cannot read — one of its mapping targets will not
   *  parse, or its type's fidelity is a value the model does not define. */
  | { readonly kind: 'pair_unreadable'; readonly pairId: string }

const FIDELITY_VALUES: readonly string[] = Object.values(ACQUISITION_FIDELITY)

type PairsRead =
  | { readonly ok: true; readonly pairs: readonly DeclaredPair[] }
  | { readonly ok: false; readonly pairId: string }

/**
 * Every pair declared on one source, with its type's fidelity and its mapping
 * — each mapping target through `parseFieldPath()`, the ONE seam. A pair this
 * plane cannot read is refused by id, never skipped: skipping it would park
 * an artefact the operator declared a home for.
 */
export async function readDeclaredPairs(tx: ScopedClient, endpointId: string): Promise<PairsRead> {
  const found = await tx.query(
    `SELECT p.id, p.match_kind, p.match_value, p.document_type_id, t.expected_fidelity,
            m.source_field, f.path
       FROM tenant.endpoint_document_type p
       JOIN tenant.document_type t ON t.id = p.document_type_id
       LEFT JOIN tenant.endpoint_field_mapping m ON m.pair_id = p.id
       LEFT JOIN tenant.document_field_spec f
              ON f.document_type_id = m.document_type_id AND f.path_key = m.path_key
      WHERE p.endpoint_id = $1
      ORDER BY p.declared_at, p.id, m.path_key`,
    [endpointId],
  )
  const byId = new Map<string, { pair: Omit<DeclaredPair, 'mapping'>; mapping: PairMappingLine[] }>()
  for (const raw of found.rows) {
    const row = raw as {
      id: string
      match_kind: string
      match_value: string
      document_type_id: string
      expected_fidelity: string
      source_field: string | null
      path: unknown
    }
    if (row.match_kind !== 'filename' && row.match_kind !== 'path_prefix') {
      return { ok: false, pairId: row.id }
    }
    if (!FIDELITY_VALUES.includes(row.expected_fidelity)) return { ok: false, pairId: row.id }
    let entry = byId.get(row.id)
    if (entry === undefined) {
      entry = {
        pair: {
          pairId: row.id,
          documentTypeId: row.document_type_id,
          match: { kind: row.match_kind, value: row.match_value },
          expectedFidelity: row.expected_fidelity as AcquisitionFidelity,
        },
        mapping: [],
      }
      byId.set(row.id, entry)
    }
    if (row.source_field === null) continue
    const parsed = parseFieldPath(row.path)
    if (!parsed.ok) return { ok: false, pairId: row.id }
    entry.mapping.push({ sourceField: row.source_field, path: parsed.path })
  }
  return {
    ok: true,
    pairs: [...byId.values()].map((e) => ({ ...e.pair, mapping: e.mapping })),
  }
}

/** The transaction's own tenant, read rather than passed (invariant 1). */
async function scopeTenant(tx: ScopedClient): Promise<string | null> {
  const scope = await tx.query(`SELECT ${T} AS tenant_id`)
  const tenantId = (scope.rows[0] as { tenant_id: string | null } | undefined)?.tenant_id ?? null
  return tenantId === null || tenantId === '' ? null : tenantId
}

/**
 * THE CLASSIFYING INTAKE. The cascade, unchanged; then — only on admission —
 * the name selects a pair, or the artefact parks with its record HELD.
 */
export async function admitClassifyAndStoreArrival(
  tx: ScopedClient,
  input: ClassifyingIntakeInput,
): Promise<ClassifyingIntakeOutcome> {
  const tenantId = await scopeTenant(tx)
  if (tenantId === null) return { kind: 'unscoped' }

  const channel = await readIntakeChannel(tx, input.facts.channelId)
  if (channel === null) return { kind: 'channel_absent' }

  const admission = admitArrival(input.facts, {
    channel,
    presentedAuthorizationIds: input.presentedAuthorizationIds,
    boundUntil: input.boundUntil,
    now: input.now,
    earlierArrivalWithSameContent: input.earlierArrivalWithSameContent,
  })
  if (!admission.ok) {
    await writeRefusedArrival(tx, input, input.filename, admission.refusal)
    return { kind: 'refused', refusal: admission.refusal }
  }

  const endpointId = channel.endpointId
  if (endpointId === null) return { kind: 'lane_draws_through_no_source' }

  await tx.query('SELECT id FROM tenant.endpoint WHERE id = $1 FOR SHARE', [endpointId])
  const pairs = await readDeclaredPairs(tx, endpointId)
  if (!pairs.ok) return { kind: 'pair_unreadable', pairId: pairs.pairId }

  const decision = decideArrival(input.filename, input.payload, pairs.pairs)
  switch (decision.kind) {
    case 'extract':
      return storeDocument(
        tx,
        tenantId,
        {
          sourceDocumentId: input.sourceDocumentId,
          arrivalId: input.facts.arrivalId,
          documentTypeId: decision.documentTypeId,
          payload: decision.payload,
          now: input.now,
        },
        () => writeAdmittedArrival(tx, input, input.filename),
      )
    case 'park':
      await tx.query(
        `INSERT INTO tenant.arrival
           (tenant_id, id, channel_id, channel_kind, endpoint_id, authorization_id,
            arrived_at, verdict_kind, source_document_id, reading_id, filename)
         VALUES (${T}, $1, $2, $3, $4, $5, $6, 'parked', NULL, $7, $8)`,
        [
          input.facts.arrivalId,
          input.facts.channelId,
          input.facts.channelKind,
          input.facts.endpointId,
          input.facts.authorizationId,
          input.now,
          input.readingId,
          input.filename,
        ],
      )
      /* ROW 9 — HELD UNEXTRACTED: the record as delivered, BEFORE any mapping,
       * because the pair that will map it may not exist yet. */
      await tx.query(
        `INSERT INTO tenant.held_artefact (tenant_id, arrival_id, payload, held_at)
         VALUES (${T}, $1, $2::jsonb, $3)`,
        [input.facts.arrivalId, JSON.stringify(input.payload), input.now],
      )
      return { kind: 'parked', reason: decision.reason, matchingPairIds: decision.matchingPairIds }
  }
}

export interface DrainInput {
  readonly endpointId: string
  /** The pair whose declaration is draining the pile. */
  readonly pairId: string
  /** The record `declareEndpointDocumentType` minted — the drain's own act. */
  readonly authorizationId: string
  readonly now: Timestamp
  /** Mints the id each drained artefact becomes. Never derived from a value. */
  readonly mintDocumentId: () => string
}

export type DrainOutcome =
  | { readonly kind: 'drained'; readonly drained: number; readonly stillParked: number }
  | { readonly kind: 'unscoped' }
  | { readonly kind: 'pair_unreadable'; readonly pairId: string }
  | { readonly kind: 'declaration_unreadable'; readonly pathKey: string }
  /** A parked artefact holds a subject-class value `canonicalise()` refuses.
   *  G295: it may not be stored, so the PAIR cannot be declared while it is
   *  parked against it — the caller rolls the declaration back. */
  | { readonly kind: 'subject_not_digestible'; readonly arrivalId: string; readonly pathKey: FieldPathKey }

/**
 * ROW 16 — *"Declaring a pair extracts the documents already parked against it,
 * automatically, so the first period can close."*
 *
 * Every parked, undrained artefact on the source is DECIDED AGAIN against the
 * pairs as they are now, and those whose decision is to extract INTO THIS PAIR
 * are stored, their drain recorded, and their held copy deleted — in that
 * order, so the restrictive policy on `held_artefact` sees the drain before the
 * `DELETE` it gates. Everything else stays parked, and why is derived by the
 * same function at read time.
 *
 * ⚠️ AN ARTEFACT THAT NOW EXTRACTS INTO A DIFFERENT PAIR IS LEFT ALONE. Pairs
 *    cannot be edited or removed, so a parked artefact can only become
 *    extractable through a NEW pair — but the condition is checked rather than
 *    assumed, because a drain attributed to the wrong declaration is a record
 *    that lies about why a document exists.
 */
export async function drainParkedAgainstPair(
  tx: ScopedClient,
  input: DrainInput,
): Promise<DrainOutcome> {
  const tenantId = await scopeTenant(tx)
  if (tenantId === null) return { kind: 'unscoped' }

  const pairs = await readDeclaredPairs(tx, input.endpointId)
  if (!pairs.ok) return { kind: 'pair_unreadable', pairId: pairs.pairId }

  const parked = await tx.query(
    `SELECT a.id, a.filename, h.payload
       FROM tenant.arrival a
       JOIN tenant.intake_channel c ON c.id = a.channel_id
       JOIN tenant.held_artefact h ON h.arrival_id = a.id
      WHERE c.endpoint_id = $1
        AND a.verdict_kind = 'parked'
        AND NOT EXISTS (SELECT 1 FROM tenant.arrival_drain d WHERE d.arrival_id = a.id)
      ORDER BY a.arrived_at, a.id`,
    [input.endpointId],
  )

  let drained = 0
  let stillParked = 0
  for (const raw of parked.rows) {
    const row = raw as { id: string; filename: string | null; payload: unknown }
    const decision = decideArrival(arrivalFilenameFrom(row.filename), row.payload, pairs.pairs)
    if (decision.kind !== 'extract' || decision.pairId !== input.pairId) {
      stillParked += 1
      continue
    }
    const sourceDocumentId = input.mintDocumentId()
    const stored = await storeDocument(
      tx,
      tenantId,
      {
        sourceDocumentId,
        arrivalId: row.id,
        documentTypeId: decision.documentTypeId,
        payload: decision.payload,
        now: input.now,
      },
      async () => {},
    )
    if (stored.kind === 'declaration_unreadable') return stored
    if (stored.kind === 'subject_not_digestible') {
      return { kind: 'subject_not_digestible', arrivalId: row.id, pathKey: stored.pathKey }
    }
    await tx.query(
      `INSERT INTO tenant.arrival_drain
         (tenant_id, arrival_id, pair_id, document_type_id, source_document_id,
          drained_at, authorization_id)
       VALUES (${T}, $1, $2, $3, $4, $5, $6)`,
      [row.id, input.pairId, decision.documentTypeId, sourceDocumentId, input.now, input.authorizationId],
    )
    await tx.query('DELETE FROM tenant.held_artefact WHERE arrival_id = $1', [row.id])
    drained += 1
  }
  return { kind: 'drained', drained, stillParked }
}

/* ==================================================================== *
 * §5  THE READ — from the declarations, never from the document
 * ==================================================================== */

export async function readAddressablePayload(
  tx: ScopedClient,
  sourceDocumentId: string,
): Promise<PayloadRead> {
  const document = await tx.query(
    `SELECT id, document_type_id
       FROM tenant.source_document
      WHERE id = $1`,
    [sourceDocumentId],
  )
  const documentRow = document.rows[0] as { id: string; document_type_id: string } | undefined
  if (documentRow === undefined) return { kind: 'no_document' }

  const stored = await tx.query(
    `SELECT payload FROM tenant.document_payload WHERE source_document_id = $1`,
    [sourceDocumentId],
  )
  const payloadRow = stored.rows[0] as { payload: unknown } | undefined
  if (payloadRow === undefined) {
    /* A document with no payload row. `0011` §4 makes this unreachable through
     * `admitAndStoreArrival()` — the two inserts are in one transaction — so
     * reaching it means something else wrote a document row. Refuse the read;
     * do not publish a document with an empty body, which would read as *"the
     * counterparty sent nothing"*. */
    return {
      kind: 'unpublishable',
      defect: { table: 'document_payload', column: 'payload', sourceDocumentId },
    }
  }

  const declared = await readDeclarations(tx, documentRow.document_type_id)
  if (!declared.ok) {
    /* 🛑 THE COLUMN IS THE READER'S ANSWER AND NOT A CONSTANT — G1372. This
     * read `column: 'path'` unconditionally until 21 Sep 2026, so an
     * unreadable `data_class` reported a defect in a column that was fine.
     * `PayloadDefect` carries no cell value and no payload key, so the column
     * NAME is the entire diagnostic a reader gets; naming the wrong one spends
     * it. */
    return {
      kind: 'unpublishable',
      defect: { table: 'document_field_spec', column: declared.column, sourceDocumentId },
    }
  }

  /* 🛑 THE LOOP IS OVER THE DECLARATIONS. There is no `Object.keys(payload)`
   * anywhere in this function and there must never be one: an undeclared key is
   * stored and unaddressable, *"NOT 'present with a default class'; ABSENT"*. */
  const addressable: Record<string, AddressableValue> = {}
  const declaredButAbsent: FieldPathKey[] = []
  for (const declaration of declared.declarations) {
    const resolved = resolveFieldPath(payloadRow.payload as Json, declaration.path)
    if (!resolved.ok) {
      declaredButAbsent.push(declaration.pathKey)
      continue
    }
    addressable[declaration.pathKey] = {
      pathKey: declaration.pathKey,
      path: declaration.path.map((s) => (s.kind === 'index' ? s.index : s.key)),
      dataClass: declaration.dataClass,
      /* The DECLARED type, carried through untouched. Nothing on this path may
       * look at `resolved.value` to decide it — G1371. */
      dataType: declaration.dataType,
      modelProcessingAllowed: declaration.modelProcessingAllowed,
      value: resolved.value,
    }
  }

  return {
    kind: 'document',
    sourceDocumentId: documentRow.id,
    documentTypeId: documentRow.document_type_id,
    addressable,
    declaredButAbsent,
  }
}

/**
 * WHERE DOES THIS SUBJECT'S DATA REST? The question the index exists to answer,
 * and the one a scan of `document_payload` cannot: *"A scan cannot find a value
 * inside a stored Explanation, and an erasure design that depends on finding it
 * later will quietly miss it."*
 *
 * ⚠️ IT TAKES A `subjectRef` AND NOT AN IDENTIFIER, because there is no inverse
 *    and there must not be one. The caller digests the identifier the request
 *    arrived with, through the one seam, and asks with the token.
 *
 * 🛑 AND IT ANSWERS ONLY ABOUT `source_document` LOCATIONS, WHICH IS TEN
 *    ELEVENTHS SHORT OF `SubjectLocation` AND IS G322 RATHER THAN AN OVERSIGHT.
 *    No caller may present this as a complete erasure plan; exports, page
 *    renders, correspondence bodies, notifications, traces and the BI dataset
 *    have variants in the model and writers nowhere.
 */
export async function readSubjectLocations(
  tx: ScopedClient,
  subjectRef: string,
): Promise<readonly SubjectLocationRow[] | { readonly defect: PayloadDefect }> {
  const found = await tx.query(
    `SELECT location_kind, location_source_document_id, data_class, recorded_at
       FROM tenant.subject_index_entry
      WHERE subject_ref = $1
      ORDER BY location_source_document_id`,
    [subjectRef],
  )

  const rows: SubjectLocationRow[] = []
  for (const raw of found.rows) {
    const row = raw as {
      location_kind: string
      location_source_document_id: string
      data_class: string
      recorded_at: Date | string
    }
    const dataClass = asDataClass(row.data_class)
    if (dataClass === null || row.location_kind !== 'source_document') {
      return {
        defect: {
          table: 'subject_index_entry',
          column: dataClass === null ? 'data_class' : 'location_kind',
          sourceDocumentId: row.location_source_document_id,
        },
      }
    }
    rows.push({
      locationKind: 'source_document',
      sourceDocumentId: row.location_source_document_id,
      dataClass,
      recordedAt:
        row.recorded_at instanceof Date ? row.recorded_at.toISOString() : String(row.recorded_at),
    })
  }
  return rows
}

/**
 * The arrival's own record, verdict included. `Arrival` is the durable row
 * G205 exists for, and this is what reads it back — including the refusals,
 * which are the rows the entity was created to make representable.
 */
export interface ArrivalRow {
  readonly arrivalId: string
  readonly channelId: string
  readonly channelKind: IntakeChannelKind
  readonly verdictKind: ArrivalVerdictKind
  readonly refusalKind: string | null
  readonly sourceDocumentId: string | null
  /** Verbatim, interpreted by nothing (G2692). Null on a row written before `0380`. */
  readonly filename: string | null
}

const VERDICT_KINDS: readonly string[] = Object.values(ARRIVAL_VERDICT_KINDS)

function asVerdictKind(raw: string): ArrivalVerdictKind | null {
  return VERDICT_KINDS.includes(raw) ? (raw as ArrivalVerdictKind) : null
}

export async function readArrival(
  tx: ScopedClient,
  arrivalId: string,
): Promise<ArrivalRow | null> {
  const found = await tx.query(
    `SELECT id, channel_id, channel_kind, verdict_kind, refusal_kind, source_document_id, filename
       FROM tenant.arrival
      WHERE id = $1`,
    [arrivalId],
  )
  const row = found.rows[0] as
    | {
        id: string
        channel_id: string
        channel_kind: string
        verdict_kind: string
        refusal_kind: string | null
        source_document_id: string | null
        filename: string | null
      }
    | undefined
  if (row === undefined) return null

  const kind = asChannelKind(row.channel_kind)
  if (kind === null) return null
  /* G2832 — refused against the model's total set, so a fourth verdict nobody
   * taught this reader is unreadable rather than coerced into one of three. */
  const verdictKind = asVerdictKind(row.verdict_kind)
  if (verdictKind === null) return null

  return {
    arrivalId: row.id,
    channelId: row.channel_id,
    channelKind: kind,
    verdictKind,
    refusalKind: row.refusal_kind,
    sourceDocumentId: row.source_document_id,
    filename: row.filename,
  }
}
