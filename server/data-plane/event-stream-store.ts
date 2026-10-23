/**
 * INVARIANT 10's THREE EVENT STREAMS, WRITTEN INTO
 * `db/migrations/0014_invariant_10_event_streams.sql`. **G317, 19 Sep 2026.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE INVARIANT, VERBATIM, BECAUSE A PARAPHRASED INVARIANT IS A CHANGED ONE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     "10. **An act with no authorisation is unrecordable.** `authorize()`
 *      mints an `AuthorizationGrant` and nothing else does; `AuditEvent`,
 *      `DataAccessEvent` and `UsageRecord` all carry its id, and
 *      `AUTHORIZATION_MAY_BE_ABSENT` says which actor kinds may leave it null
 *      (one: `system`). This does **not** make an unauthorised act impossible —
 *      nothing can, against root — it makes one visible or detectable, which is
 *      strictly more than the model had."
 *
 * ┌─ WHY THIS FILE EXISTS AND NO HANDLER CALLS IT ─────────────────────────────┐
 * │ **NOTHING IN THIS REPOSITORY CALLS ANY FUNCTION BELOW FROM A REQUEST        │
 * │ PATH, AND THAT IS STATED FIRST RATHER THAN DISCOVERED.** `grep -rn          │
 * │ 'event-stream-store' server/` returns this file and nothing else.          │
 * │                                                                            │
 * │ The reason is not the ruling and it is not the schema: **the three streams │
 * │ carry terms with no producer.** `DataAccessEvent.maxDataClass` is *"Highest │
 * │ classification actually returned"* and nothing computes one — invariant 4  │
 * │ declares classification once on `FieldSpec`, G106 rules that a key with no │
 * │ `FieldSpec` is UNREADABLE, and its REJECTED alternative was defaulting the │
 * │ unmapped to a class, *"which is scope failing OPEN"*. Stamping a guessed   │
 * │ class into an append-only, hash-chained stream writes a false fact beyond  │
 * │ amendment. `AuditEvent.action` needs a tenant WRITE and both mounted       │
 * │ operations are reads. `UsageRecord` needs a meter, a plane id and a        │
 * │ monotonic sequence, and nothing meters.                                    │
 * │                                                                            │
 * │ ⚠️ SO WHY LAND A STORE AT ALL. `server/data-plane/run-account-store.ts`     │
 * │ answered this on 19 Sep 2026 for `0007` and the answer transfers unchanged:│
 * │ ***a column with no reader is a column nothing checks***. The migration's   │
 * │ every property — the `CHECK`, the `WITH CHECK`, the append-only privilege, │
 * │ the RLS — is a claim about what happens when somebody WRITES, and a claim  │
 * │ nothing exercises is `docs/HANDOFF.md` §5.6. This file is what             │
 * │ `tests/db/event-streams.test.ts` drives, as the app role, over a real      │
 * │ PostgreSQL.                                                                │
 * │                                                                            │
 * │ 🛑 **AND IT IS A STORE AND NOT A MOUNT.** G300's three-part test — a table, │
 * │ a model reader and a capability, all real, derived per operation — fails   │
 * │ here on two of three: there is no capability in `CAPABILITIES` for reading │
 * │ an audit trail, and there is no contract operation declaring one. G301's   │
 * │ sixth boot fence is untouched, because this file mounts nothing and marks  │
 * │ no handler.                                                                │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 EACH FUNCTION TAKES THE MODEL'S OWN TYPE, WHOLE, AND THAT IS THE ONE
 *    DESIGN DECISION IN THIS FILE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `writeAuditEvent()` takes an `AuditEvent` — not a narrowed record of the
 * fields the columns happen to hold. G317's argument for one migration is that
 * *"which stream carries what is a single question, and answering it three
 * times across three commits is how two vocabularies for one concept get
 * started — §5.3"*, and a store that defined its own input shape would start
 * the second vocabulary in TypeScript instead of in SQL. The migration holds
 * itself to the matching rule — **every column is a declared field, and every
 * declared field is a column** — and taking the whole type is what makes `tsc`
 * the thing that notices when one side moves.
 *
 * ⚠️ THE CONSEQUENCE IS THAT THESE FUNCTIONS CANNOT BE CALLED UNTIL SOMEBODY
 * CAN CONSTRUCT THE WHOLE TYPE, WHICH IS THE POINT AND NOT AN OBSTACLE. A
 * writer that could not fill `maxDataClass` honestly would have to invent one,
 * and the type is what stops it doing so quietly.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 NOTHING HERE CHECKS `authorizationIsWellFormed()`, AND THE OMISSION IS A
 *    DECISION. READ IT BEFORE ADDING THE CALL.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * G317 rules that `AUTHORIZATION_MAY_BE_ABSENT` is *"ENFORCED AT THE COLUMN,
 * NOT IN REVIEW"*, and `0014` states it as a `CHECK` on both event tables.
 * ✅ **AND ON ALL THREE SINCE G387 — `db/migrations/0017_usage_record_actor.sql`,
 * 19 Sep 2026.** ⚠️ **This sentence read *"on both event tables"* alone and is
 * corrected rather than deleted**, because it is the sentence that told a
 * reader the meter stream was outside the rule. `UsageRecord.actorKind` is
 * the discriminant `0014`'s header said the record did not have; the
 * constraint on `usage_record` is `audit_event`'s, verbatim. A pre-check here
 * would:
 *
 *   · make that constraint's refusal **unwitnessable through the only writer**,
 *     which is `0009_identity_substrate.sql`'s trap wearing the other hat — a
 *     control whose only observable behaviour is somebody else's refusal;
 *   · be a second place the rule lives, and §5.3 says the copy is what drifts;
 *   · and bind exactly one writer, where the constraint binds every writer,
 *     including the ones nobody has written.
 *
 * ⚠️ WHAT THAT COSTS, NAMED: a malformed row arrives as a raw constraint
 * violation from the driver rather than as a typed refusal. **That is the right
 * shape for THIS caller** — a store exercised by a test — and the WRONG shape
 * for a handler, which owes its caller an answer rather than a 500.
 * `authorizationIsWellFormed()` is that handler's function and is where the
 * model says it belongs: *"a WRITE-TIME GATE on an append-only stream … the
 * answer to a malformed audit row is to refuse the write, not to lose the row
 * to an exception on a hot path."* **The day a handler writes an event, it
 * calls that function first and this constraint is what catches the day it
 * forgets.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ WHAT THIS FILE DELIBERATELY DOES NOT BUILD.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   · **NO SEQUENCE ALLOCATOR.** `RecordChain.sequence` is *"Monotonic per
 *     tenant per stream"* and every function below takes the chain it is
 *     given. Allocating the next number under transaction-mode pooling is a
 *     design nobody has taken, and a store that guessed one would produce a
 *     chain that looks tamper-evident and forks. The migration's
 *     `UNIQUE (tenant_id, chain_sequence)` makes a duplicate impossible; it
 *     does not hand anybody the next number.
 *   · **NO HASH COMPUTATION.** The canonicaliser EXISTS —
 *     `model/canonical.ts`, RFC 8785, G20, applied 9 Aug 2026 — so *"pick a
 *     scheme before the first hash is computed"* is already discharged and
 *     `RecordChain`'s own warning that no scheme exists is STALE. What is NOT
 *     settled is WHICH FIELDS of a record form its canonical body, and that is
 *     a ruling rather than a helper: a hash over the wrong field set is a chain
 *     that verifies nothing and cannot be re-rooted under G88.
 *   · **NO READER.** There is no `readAuditEvent()`. `0009`'s rule for a
 *     flattened union is that *"a malformed row … is REFUSED BY THE READER"*,
 *     and the reader that owes that refusal is the one a mounted operation will
 *     need. Writing it today would be a reader with no operation, which is the
 *     thing `0004_subject_ledger.sql` refuses.
 *   · **NO `DataAccessEvent` ON THE SERVED PATH.** `CLAUDE.md` says *"a served
 *     read records THE AUTHORISATION IT RAN UNDER and not THE ACCESS"* and
 *     **that sentence is still exactly true after this commit.** Nobody should
 *     read an access log off `tenant.authorization_grant`, and nobody should
 *     read one off `tenant.data_access_event` either — it is empty.
 */

import type { ScopedClient } from '../../db/tenant-scope.ts'
import type { AuditEvent } from '../../model/domain.ts'
import type { AuditActor, DataAccessEvent } from '../../model/governance.ts'
import type { UsageRecord } from '../../model/billing.ts'

/**
 * `AuditActor`'s five arms, flattened into the column names `0014` declares —
 * stated ONCE and used by both event streams, because the migration states
 * them identically for the declaration's own reason: the two streams answer
 * *"who read this and who changed it"* together, and a divergence between them
 * is what would break that join.
 *
 * ⚠️ ORDER IS LOAD-BEARING. It is the order of the `INSERT` column lists below
 * and of the values `actorValues()` returns, and the two cannot drift because
 * both are derived from this one array.
 */
const ACTOR_COLUMNS = [
  'actor_kind',
  'actor_user_id',
  'actor_org_class',
  'actor_assignment_id',
  'actor_partner_id',
  'actor_grant_id',
  'actor_support_grant_id',
  'actor_support_authorisation_id',
  'actor_component',
  'actor_step_id',
  'actor_step_execution_id',
  'actor_model_id',
  'actor_on_behalf_of_kind',
  'actor_on_behalf_of_user_id',
  'actor_on_behalf_of_assignment_id',
  'actor_on_behalf_of_policy_id',
  'actor_on_behalf_of_policy_version',
] as const

type ActorColumn = (typeof ACTOR_COLUMNS)[number]

/** What a flattened arm may put in a column. No object reaches SQL from here. */
type ColumnValue = string | number | null

/**
 * 🛑 A TOTAL `Record<ActorColumn, …>` RATHER THAN AN OBJECT LITERAL, FOR
 * `CAPABILITY_RESOURCE_CLASS`'s REASON: *"Prefer a total `Record<K, V>` over a
 * lookup function when the key set is closed. An unhandled member then becomes
 * a compile error rather than a runtime surprise."* A column added to
 * `ACTOR_COLUMNS` and not filled here is `TS2739`, and a column filled here and
 * absent from the array is `TS2353` — so the `INSERT` cannot go out of step
 * with its own values in either direction.
 *
 * ⚠️ AND THE `switch` IS EXHAUSTIVE BY CONSTRUCTION, NOT BY A `default`. There
 * is no `default:` arm: a sixth `AuditActor` variant makes this function fall
 * off its end with a declared return type, which is `TS2366`. That is the same
 * polarity `AUTHORIZATION_MAY_BE_ABSENT` takes — *"a sixth actor variant is a
 * COMPILE ERROR until somebody decides"* — and the two must fail together or
 * one of them is decorative.
 *
 * ⚠️ EVERY ARM FILLS EVERY COLUMN, and the nulls are not padding. A null in a
 * column belonging to another arm is *"a VALUE, not an absence"* — `0010`'s
 * phrase for `partner_id` — and `actor_kind` is the only thing that tells an
 * arm-absent null from a within-arm null such as
 * `user.assignmentId`, which the declaration says is legitimately null
 * *"where no assignment was in the path"*.
 */
function actorValues(actor: AuditActor): Record<ActorColumn, ColumnValue> {
  const empty: Record<ActorColumn, ColumnValue> = {
    actor_kind: actor.kind,
    actor_user_id: null,
    actor_org_class: null,
    actor_assignment_id: null,
    actor_partner_id: null,
    actor_grant_id: null,
    actor_support_grant_id: null,
    actor_support_authorisation_id: null,
    actor_component: null,
    actor_step_id: null,
    actor_step_execution_id: null,
    actor_model_id: null,
    actor_on_behalf_of_kind: null,
    actor_on_behalf_of_user_id: null,
    actor_on_behalf_of_assignment_id: null,
    actor_on_behalf_of_policy_id: null,
    actor_on_behalf_of_policy_version: null,
  }

  switch (actor.kind) {
    case 'user':
      return {
        ...empty,
        actor_user_id: actor.userId,
        actor_org_class: actor.orgClass,
        actor_assignment_id: actor.assignmentId,
      }
    case 'partner_staff':
      return {
        ...empty,
        actor_user_id: actor.userId,
        actor_partner_id: actor.partnerId,
        actor_grant_id: actor.grantId,
      }
    case 'platform_staff':
      return {
        ...empty,
        actor_user_id: actor.userId,
        actor_support_grant_id: actor.supportGrantId,
        actor_support_authorisation_id: actor.supportAuthorisationId,
      }
    case 'system':
      return { ...empty, actor_component: actor.component }
    case 'agent':
      return {
        ...empty,
        actor_step_id: actor.stepId,
        actor_step_execution_id: actor.stepExecutionId,
        actor_model_id: actor.modelId,
        actor_on_behalf_of_kind: actor.onBehalfOf.kind,
        actor_on_behalf_of_user_id:
          actor.onBehalfOf.kind === 'user' ? actor.onBehalfOf.userId : null,
        actor_on_behalf_of_assignment_id:
          actor.onBehalfOf.kind === 'user' ? actor.onBehalfOf.assignmentId : null,
        actor_on_behalf_of_policy_id:
          actor.onBehalfOf.kind === 'policy' ? actor.onBehalfOf.policyId : null,
        actor_on_behalf_of_policy_version:
          actor.onBehalfOf.kind === 'policy' ? actor.onBehalfOf.policyVersion : null,
      }
  }
}

/** `$1, $2, …` for `n` values, so no placeholder list is written by hand. */
function placeholders(n: number): string {
  return Array.from({ length: n }, (_, i) => `$${i + 1}`).join(', ')
}

/**
 * `Json | null` into a `jsonb` parameter.
 *
 * ⚠️ `JSON.stringify` EXPLICITLY RATHER THAN HANDING THE OBJECT TO THE DRIVER.
 * `pg` serialises an object parameter for a `jsonb` column on its own, and
 * relying on that would put the serialisation decision in a dependency's
 * defaults on the one stream whose rows are hashed. It is written here so it is
 * visible.
 *
 * 🛑 AND IT IS **NOT** `canonicalise()`, WHICH WOULD BE THE WRONG FUNCTION IN A
 * WAY WORTH NAMING. RFC 8785 exists so two implementations agree on the bytes a
 * HASH covers; it is not a storage format, and `jsonb` does not preserve byte
 * order anyway — PostgreSQL normalises keys and whitespace on ingest. A caller
 * that needs the canonical bytes hashes them BEFORE they reach this column, and
 * stores the digest in `chain_body_hash`.
 *
 * ⚠️ A `Json` value that IS `null` and an ABSENT image both store SQL NULL, and
 * they are not distinguishable afterwards. `AuditEvent` declares the field as
 * `Json | null` with `Json = unknown`, so the model does not distinguish them
 * either; this is that ambiguity reaching the column rather than one introduced
 * here.
 */
function jsonParam(value: unknown): string | null {
  return value === null || value === undefined ? null : JSON.stringify(value)
}

/**
 * ONE `AuditEvent` → ONE ROW.
 *
 * 🛑 READ THE SQL AND NOTE WHAT IS NOT IN IT: THERE IS NO TENANT PREDICATE ON
 * THE WRITE. `tenant_id` is a COLUMN VALUE, and what makes it safe is
 * `audit_event_rls`'s `WITH CHECK` — which compares it against `app.tenant_id`,
 * the value `withTenantScope()` set, and refuses the INSERT if they disagree.
 * `0014` argues that at the policy; `0010` argued it first.
 *
 * ⚠️ `event.tenantId` IS PASSED RATHER THAN THE SCOPE'S OWN STRING, for
 * `writeAuthorisationRecord()`'s reason: passing the scope's value would make
 * the `WITH CHECK` compare a value against itself and assert nothing, which is
 * §5.6 written in SQL.
 *
 * ⚠️ NO `ON CONFLICT`. A duplicate `(tenant_id, id)` or a duplicate chain
 * sequence is a fork in an append-only stream and is a thing a person needs to
 * be told about. Swallowing it would make the second event vanish under the
 * first one's row.
 */
export async function writeAuditEvent(tx: ScopedClient, event: AuditEvent): Promise<void> {
  const actor = actorValues(event.actor)
  const columns = [
    'tenant_id',
    'id',
    'chain_sequence',
    'chain_previous_hash',
    'chain_body_hash',
    ...ACTOR_COLUMNS,
    'authorization_id',
    'action',
    'subject_type',
    'subject_id',
    'before_image',
    'after_image',
    'at',
  ]
  const values: ReadonlyArray<ColumnValue> = [
    event.tenantId,
    event.id,
    event.chain.sequence,
    event.chain.previousHash,
    event.chain.bodyHash,
    ...ACTOR_COLUMNS.map((c) => actor[c]),
    event.authorizationId,
    event.action,
    event.subjectType,
    event.subjectId,
    jsonParam(event.before),
    jsonParam(event.after),
    event.at,
  ]
  await tx.query(
    `INSERT INTO tenant.audit_event (${columns.join(', ')})
     VALUES (${placeholders(values.length)})`,
    values as unknown[],
  )
}

/**
 * ONE `DataAccessEvent` → ONE ROW.
 *
 * The same shape, the same `WITH CHECK`, the same absence of an `ON CONFLICT`.
 * The difference from the write stream is the model's: no `action` and no
 * before/after image, because a read changes nothing — and `max_data_class`
 * instead, because what a read needs recorded is *"Highest classification
 * actually returned."*
 *
 * 🛑 **NOTHING IN THIS REPOSITORY CAN PRODUCE THAT VALUE HONESTLY**, which is
 * why no handler calls this. See the file header.
 */
export async function writeDataAccessEvent(
  tx: ScopedClient,
  event: DataAccessEvent,
): Promise<void> {
  const actor = actorValues(event.actor)
  const columns = [
    'tenant_id',
    'id',
    'chain_sequence',
    'chain_previous_hash',
    'chain_body_hash',
    ...ACTOR_COLUMNS,
    'authorization_id',
    'at',
    'subject_type',
    'subject_id',
    'max_data_class',
  ]
  const values: ReadonlyArray<ColumnValue> = [
    event.tenantId,
    event.id,
    event.chain.sequence,
    event.chain.previousHash,
    event.chain.bodyHash,
    ...ACTOR_COLUMNS.map((c) => actor[c]),
    event.authorizationId,
    event.at,
    event.subjectType,
    event.subjectId,
    event.maxDataClass,
  ]
  await tx.query(
    `INSERT INTO tenant.data_access_event (${columns.join(', ')})
     VALUES (${placeholders(values.length)})`,
    values as unknown[],
  )
}

/**
 * ONE `UsageRecord` → ONE ROW.
 *
 * 🛑 INVARIANT 5 GOVERNS THIS FUNCTION: *"Money is always derived. `UsageRecord`
 * is immutable and unpriced … A raw usage record is volume in the clear."*
 * There is no price parameter, no rate, no total and no currency, and there
 * must never be one — `MeterPrice` and `PriceTier` are both `@dropped-for-v1`
 * and a rating column here would un-drop them in SQL.
 *
 * ⚠️ `record.model` IS THE LIVE RESIDENCY BYPASS AND IS WRITTEN AS IT IS.
 * `CLAUDE.md` lists it under *"On invariant 7"* as a bare `string` that reaches
 * a model identity without passing `resolveModel()`. **It is not fixed here —
 * that is a model ruling nobody has taken — and it is not laundered here
 * either:** storing it asserts nothing about whether the catalogue ever saw it,
 * and `audit_event.actor_model_id`, which IS a `ModelCatalogEntryId`, must
 * never be read as the same fact.
 *
 * 🛑 `record.actorKind` IS THE ONLY PART OF AN ACTOR THAT REACHES THIS TABLE,
 * AND `actorValues()` ABOVE IS DELIBERATELY NOT CALLED HERE. That function
 * flattens all five arms into SEVENTEEN columns — `actor_user_id`,
 * `actor_partner_id`, `actor_support_grant_id`, the agent's `onBehalfOf` —
 * and every one of them is a principal identifier. **`UsageRecord` is the one
 * record class that ships to the control plane**, and G387 adds the KIND to
 * it and nothing else: *"an actor KIND is a closed vocabulary and is not a
 * person; an actor id would be tenant data on a control-plane wire"*. Calling
 * `actorValues()` here would be that widening, arriving as a convenience.
 * `db/migrations/0017_usage_record_actor.sql` argues it at length.
 *
 * ⚠️ `shippedAt` AND `tagsLockedAt` ARE WRITTEN AT INSERT AND CAN NEVER BE
 * CHANGED. The app role holds no `UPDATE`, so the *"Set at close"* behaviour
 * the declaration describes is not available on this path. `0014`'s header
 * argues it: G317's *"a NEW ROW superseding an old one, never an `UPDATE`"* is
 * the shape the successor takes, and re-tagging is already impossible because
 * the privilege forbids it rather than because a lock column says so.
 */
export async function writeUsageRecord(tx: ScopedClient, record: UsageRecord): Promise<void> {
  const columns = [
    'tenant_id',
    'id',
    'data_plane_id',
    'idempotency_key',
    'at',
    'recorded_at',
    'sequence',
    'shipped_at',
    'meter',
    'quantity',
    /* G387. Immediately before the spine, because the two are one rule: the
     * `CHECK` in `0017` reads both and neither means anything alone. */
    'actor_kind',
    'authorization_id',
    'run_id',
    'domain',
    'pack_id',
    'cost_center',
    'tags_locked_at',
    'model',
  ]
  const values: ReadonlyArray<ColumnValue> = [
    record.tenantId,
    record.id,
    record.dataPlaneId,
    record.idempotencyKey,
    record.at,
    record.recordedAt,
    record.sequence,
    record.shippedAt,
    record.meter,
    record.quantity,
    record.actorKind,
    record.authorizationId,
    record.runId,
    record.domain,
    record.packId,
    record.costCenter,
    record.tagsLockedAt,
    record.model,
  ]
  await tx.query(
    `INSERT INTO tenant.usage_record (${columns.join(', ')})
     VALUES (${placeholders(values.length)})`,
    values as unknown[],
  )
}
