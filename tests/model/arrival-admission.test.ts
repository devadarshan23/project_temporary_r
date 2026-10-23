/**
 * I-1 / #176 — G184, G205 and G206: the intake cascade, and the seven lazy
 * repairs it is built to refuse.
 *
 * ⚠️ EVERY TEST HERE IS A NEGATIVE CONTROL WITH A NAMED LAZY REPAIR. A test
 * that only walks the happy path is satisfied by a cascade that returns `ok`
 * unconditionally; each block below names the plausible wrong implementation it
 * catches, and each was verified to be the ONLY test that fails under that
 * mutation.
 *
 * ⚠️ AND IT IS THE CONSTRUCTION SITE THE COMPILE-TIME PROOFS NEED. §5.10: a
 * total `Record` and an `AssertNoTextDeep` only bite where something
 * CONSTRUCTS the type, and in a types-only model nothing does. This file
 * constructs an `IntakeChannel`, an `ArrivalFacts` and an `ArrivalContext`, so
 * `CHANNEL_DRAWS_THROUGH_AN_ENDPOINT` and the two containment proofs are
 * witnessed rather than assumed.
 *
 * NO SKIP: pure total functions, no database, no socket, no credential.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CHANNEL_DRAWS_THROUGH_AN_ENDPOINT,
  INTAKE_CHANNEL_KINDS,
  admitArrival,
  guardIntakeChannel,
} from '../../model/ingestion.ts'
import type {
  ArrivalContext,
  ArrivalFacts,
  IntakeChannel,
  IntakeChannelKind,
} from '../../model/ingestion.ts'
import type {
  ArrivalId,
  AuthorizationGrantId,
  EndpointId,
  IntakeChannelId,
  TenantId,
  Timestamp,
} from '../../model/kernel.ts'

/* ------------------------------------------------------------------ fixtures */

const TENANT = 'ten_acme' as TenantId
const MAILBOX_CHANNEL = 'ich_ap_mailbox' as IntakeChannelId
const UPLOAD_CHANNEL = 'ich_ap_upload' as IntakeChannelId
const SAP = 'ep_sap' as EndpointId
const OTHER_ENDPOINT = 'ep_other' as EndpointId
const GRANT = 'agr_standing_ap' as AuthorizationGrantId
const OTHER_GRANT = 'agr_someone_else' as AuthorizationGrantId
const ARRIVAL = 'arr_0001' as ArrivalId
const EARLIER = 'arr_0000' as ArrivalId

const NOW = '2026-08-24T09:00:00Z' as Timestamp
const LATER = '2026-11-24T09:00:00Z' as Timestamp
const EARLIER_THAN_NOW = '2026-08-01T09:00:00Z' as Timestamp

function drawingChannel(over: Partial<IntakeChannel> = {}): IntakeChannel {
  return {
    tenantId: TENANT,
    id: MAILBOX_CHANNEL,
    kind: INTAKE_CHANNEL_KINDS.mailbox,
    endpointId: SAP,
    enabled: true,
    lastArrivalAt: null,
    ...over,
  }
}

function uploadChannel(over: Partial<IntakeChannel> = {}): IntakeChannel {
  return {
    tenantId: TENANT,
    id: UPLOAD_CHANNEL,
    kind: INTAKE_CHANNEL_KINDS.upload,
    endpointId: null,
    enabled: true,
    lastArrivalAt: null,
    ...over,
  }
}

function factsFor(channel: IntakeChannel, over: Partial<ArrivalFacts> = {}): ArrivalFacts {
  return {
    arrivalId: ARRIVAL,
    channelId: channel.id,
    channelKind: channel.kind,
    endpointId: channel.endpointId,
    authorizationId: GRANT,
    byteCount: 4096,
    ...over,
  }
}

function contextFor(channel: IntakeChannel, over: Partial<ArrivalContext> = {}): ArrivalContext {
  return {
    channel,
    presentedAuthorizationIds: [GRANT],
    boundUntil: channel.endpointId === null ? null : LATER,
    now: NOW,
    earlierArrivalWithSameContent: null,
    ...over,
  }
}

/* ---------------------------------- 1. the biconditional, BOTH directions */

test('test_the_upload_arm_and_the_drawing_arm_of_g184s_biconditional_are_both_enforced', () => {
  /* 🛑 THE LAZY REPAIR: IMPLEMENT `⟺` AS `⟹`, and it is the likeliest one by a
   * distance. G184 states the invariant as `kind === 'upload' ⟺ endpointId ===
   * null`, and the natural reading of that sentence — "an upload draws through
   * no connection" — produces a guard that checks only the upload arm and
   * returns `null` for everything else. Every upload test passes. A
   * `connector_pull` channel wired to NOTHING is then admissible, and the
   * artefacts drawn down it carry `endpointId: null`, which makes every
   * `EndpointHealth` row unattributable to the lane that produced it — the exact
   * failure G184 says the three-value projection caused. */
  assert.deepEqual(guardIntakeChannel(uploadChannel({ endpointId: SAP })), {
    kind: 'upload_names_an_endpoint',
    channelId: UPLOAD_CHANNEL,
  })
  assert.deepEqual(guardIntakeChannel(drawingChannel({ endpointId: null })), {
    kind: 'endpoint_absent_on_drawing_channel',
    channelId: MAILBOX_CHANNEL,
  })
  /* And BOTH legal shapes return null, or the guard is refusing everything and
   * the two assertions above prove nothing. */
  assert.equal(guardIntakeChannel(uploadChannel()), null)
  assert.equal(guardIntakeChannel(drawingChannel()), null)
})

test('test_every_channel_kind_states_whether_it_draws_through_an_endpoint', () => {
  /* The total `Record` witnessed at a construction site rather than assumed —
   * §5.10. `upload` is the only member that does not draw, and if a fifth
   * channel ever arrives (G184: `api` returns as a FIFTH member, never as a
   * reinterpretation of `upload`) whoever adds it must answer here. */
  assert.deepEqual(
    Object.keys(CHANNEL_DRAWS_THROUGH_AN_ENDPOINT).sort(),
    [...Object.values(INTAKE_CHANNEL_KINDS)].sort(),
  )
  assert.equal(CHANNEL_DRAWS_THROUGH_AN_ENDPOINT.upload, false)
  for (const kind of Object.values(INTAKE_CHANNEL_KINDS)) {
    if (kind === INTAKE_CHANNEL_KINDS.upload) continue
    assert.equal(CHANNEL_DRAWS_THROUGH_AN_ENDPOINT[kind], true, `${kind} must draw`)
  }
})

/* -------------------------- 2. the denormalised endpoint is COMPARED */

test('test_an_arrival_naming_an_endpoint_the_channel_does_not_is_refused', () => {
  /* 🛑 THE LAZY REPAIR: denormalise `endpointId` onto the arrival for the reason
   * `ProcedureStepExecution.runId` gives — and then READ it. A denormalised copy
   * that nothing compares is not a control, it is a second source of truth, and
   * it goes stale the first time an operator repoints a channel at a new
   * endpoint. Under that repair an artefact records an authority that never
   * covered it, and invariant 10's whole claim degrades to a stored string. */
  const channel = drawingChannel()
  const result = admitArrival(
    factsFor(channel, { endpointId: OTHER_ENDPOINT }),
    contextFor(channel),
  )
  assert.equal(result.ok, false)
  assert.deepEqual(result.ok ? null : result.refusal, {
    kind: 'channel_endpoint_disagrees',
    onChannel: SAP,
    onArrival: OTHER_ENDPOINT,
  })
})

/* ------------------------- 3. the standing authorisation must be LIVE */

test('test_a_standing_authorisation_whose_bound_has_passed_is_refused_rather_than_merely_present', () => {
  /* 🛑 THE LAZY REPAIR: check that `authorizationId` is non-null and stop —
   * which the TYPE already guarantees, so the check is decorative and the suite
   * is green. `Endpoint.boundUntil` has existed since the model was written and
   * NOTHING HAS EVER EVALUATED IT; the field's own docblock says an endpoint
   * that keeps pulling past its authority is the failure it exists to name. */
  const channel = drawingChannel()
  const expired = admitArrival(
    factsFor(channel),
    contextFor(channel, { boundUntil: EARLIER_THAN_NOW }),
  )
  assert.equal(expired.ok, false)
  assert.deepEqual(expired.ok ? null : expired.refusal, {
    kind: 'standing_authorisation_expired',
    authorizationId: GRANT,
  })

  /* An endpoint with no bound at all is the UNBOUNDED case, not the exempt one. */
  const unbounded = admitArrival(factsFor(channel), contextFor(channel, { boundUntil: null }))
  assert.equal(unbounded.ok, false)

  /* A grant nobody presented never reaches the clock. */
  const notPresented = admitArrival(
    factsFor(channel, { authorizationId: OTHER_GRANT }),
    contextFor(channel),
  )
  assert.equal(notPresented.ok, false)
  assert.deepEqual(notPresented.ok ? null : notPresented.refusal, {
    kind: 'authorisation_not_presented',
    authorizationId: OTHER_GRANT,
  })

  /* And a live grant on a live lane is admitted, or every assertion above is
   * satisfied by a guard that refuses unconditionally. */
  assert.equal(admitArrival(factsFor(channel), contextFor(channel)).ok, true)
})

test('test_an_upload_lane_has_no_endpoint_bound_to_expire_and_is_still_admitted', () => {
  /* The other direction of the same guard. A check that demanded a live
   * `boundUntil` on EVERY lane would make uploads permanently inadmissible —
   * an upload draws through no connection, so there is no endpoint authority to
   * lapse. The direction is read out of `CHANNEL_DRAWS_THROUGH_AN_ENDPOINT`
   * rather than out of a `kind === 'upload'` comparison, for the same reason
   * `guardIntakeChannel()` reads it there. */
  const channel = uploadChannel()
  assert.equal(admitArrival(factsFor(channel), contextFor(channel)).ok, true)
})

/* ------------------------- 4. the cascade is FIXED, and the ORDER is observable */

test('test_a_duplicate_on_a_disabled_channel_reports_the_disabled_channel_and_not_the_duplicate', () => {
  /* 🛑 THE LAZY REPAIR: run the cheap check first. The duplicate lookup is one
   * indexed read and the channel checks need the channel loaded, so reordering
   * is an obvious optimisation — and it makes the system report a duplicate on a
   * channel that is not even live. `MoneyRefusal`'s `no_items` docblock is the
   * standing argument against exactly this: the old answer "was a lie… a refusal
   * that names the wrong cause is worse than one nobody sees." */
  const channel = drawingChannel({ enabled: false })
  const result = admitArrival(
    factsFor(channel),
    contextFor(channel, { earlierArrivalWithSameContent: EARLIER }),
  )
  assert.equal(result.ok, false)
  assert.deepEqual(result.ok ? null : result.refusal, {
    kind: 'channel_disabled',
    channelId: MAILBOX_CHANNEL,
  })
})

test('test_a_malformed_lane_is_refused_before_the_arrivals_own_facts_are_examined', () => {
  /* The lane's own legality is checked before its wiring is compared, because
   * comparing an arrival's endpoint against a channel that should not exist
   * reports the disagreement rather than the malformed lane. The channel here is
   * BOTH illegal (drawing, no endpoint) and disagreed-with. */
  const channel = drawingChannel({ endpointId: null })
  const result = admitArrival(factsFor(channel, { endpointId: SAP }), contextFor(channel))
  assert.equal(result.ok, false)
  assert.deepEqual(result.ok ? null : result.refusal, {
    kind: 'channel_is_not_a_legal_lane',
    defect: { kind: 'endpoint_absent_on_drawing_channel', channelId: MAILBOX_CHANNEL },
  })
})

/* ------------------------------ 5. a duplicate is a NAMED OUTCOME */

test('test_a_duplicate_is_refused_by_name_and_carries_the_earlier_row', () => {
  /* 🛑 THE LAZY REPAIR: swallow it — an `ON CONFLICT DO NOTHING`, or a silent
   * `Map.set`. After that, conservation holds over a population already one row
   * short and the refusal that would have said so cannot fire. The earlier
   * `ArrivalId` is carried because a duplicate an operator cannot trace to its
   * original is a refusal with no next action. */
  const channel = drawingChannel()
  const result = admitArrival(
    factsFor(channel),
    contextFor(channel, { earlierArrivalWithSameContent: EARLIER }),
  )
  assert.equal(result.ok, false)
  assert.deepEqual(result.ok ? null : result.refusal, {
    kind: 'duplicate_of_earlier_arrival',
    earlier: EARLIER,
  })
})

/* ------------------------ 6. the facts are compared against the lane */

test('test_facts_naming_a_different_lane_or_a_different_lane_kind_are_refused', () => {
  /* The caller loads the channel and also hands over what it believes about it.
   * A cascade that trusted the facts would answer questions about a lane it
   * never read; a cascade that ignored them would silently discard a caller
   * error. Both directions are named refusals. */
  const channel = drawingChannel()
  const wrongLane = admitArrival(
    factsFor(channel, { channelId: UPLOAD_CHANNEL }),
    contextFor(channel),
  )
  assert.deepEqual(wrongLane.ok ? null : wrongLane.refusal, {
    kind: 'channel_not_the_one_presented',
    onFacts: UPLOAD_CHANNEL,
    onChannel: MAILBOX_CHANNEL,
  })

  const wrongKind = admitArrival(
    factsFor(channel, { channelKind: INTAKE_CHANNEL_KINDS.connectorPull }),
    contextFor(channel),
  )
  assert.deepEqual(wrongKind.ok ? null : wrongKind.refusal, {
    kind: 'channel_kind_disagrees',
    onFacts: INTAKE_CHANNEL_KINDS.connectorPull,
    onChannel: INTAKE_CHANNEL_KINDS.mailbox,
  })
})

test('test_an_arrival_of_zero_bytes_is_refused', () => {
  /* A lane that delivered nothing has delivered nothing. Without this the
   * cascade admits an empty artefact and the refusal surfaces three stages
   * later, as a parser error carrying a parser's message — which is exactly the
   * text the containment proofs exist to keep out of the record. */
  const channel = drawingChannel()
  const result = admitArrival(factsFor(channel, { byteCount: 0 }), contextFor(channel))
  assert.equal(result.ok, false)
  assert.deepEqual(result.ok ? null : result.refusal, {
    kind: 'arrival_is_empty',
    channelId: MAILBOX_CHANNEL,
  })
})

/* --------------------- 7. `api` and `connector` are unrepresentable */

test('test_the_dropped_and_projected_members_cannot_be_written_at_a_call_site', () => {
  /* 🛑 THE CONSTRUCTION SITE BUILDER RULE 4 REQUIRES. Without a call site the
   * closed union compiles green while constraining nothing.
   *
   * Both directives are LIVE rather than decorative: with the members absent
   * they report TS2322, and if either member were ever added back the directive
   * would become unused and `npm run typecheck:tests` would fail with TS2578.
   * There is no state in which these two lines assert nothing. */
  // @ts-expect-error `api` is DROPPED by G184, never reinterpreted as `upload`.
  const api: IntakeChannelKind = 'api'
  // @ts-expect-error `connector` is the three-value projection G184 deletes.
  const connector: IntakeChannelKind = 'connector'
  /* `noUnusedLocals` would delete the guards if nothing read them, and a guard
   * the compiler removes is not a guard. */
  assert.equal(String(api), 'api')
  assert.equal(String(connector), 'connector')
  assert.equal(Object.values(INTAKE_CHANNEL_KINDS).includes('api' as IntakeChannelKind), false)
  assert.equal(
    Object.values(INTAKE_CHANNEL_KINDS).includes('connector' as IntakeChannelKind),
    false,
  )
})

/* ---- 8. invariant 1 by construction — asserted, not claimed in a header */

test('test_neither_cascade_input_declares_a_tenant_field_so_a_tenant_hint_has_nowhere_to_enter', () => {
  /* 🛑 THIS CONTROL EXISTS BECAUSE THE MODULE HEADER'S CLAIM HAD NOTHING
   * BEHIND IT, AND A MUTATION FOUND THAT BEFORE A REVIEWER DID.
   *
   * `model/ingestion.ts` states that invariant 1 is closed BY CONSTRUCTION —
   * "there is no body the tenant could move into, because the cascade takes no
   * body". Adding `readonly tenantId: string` to `ArrivalContext` left `tsc`
   * green and every test in this file passing. `AssertNoTextDeep` does not
   * cover it: `ArrivalContext` carries no proof at all (it holds `Timestamp`,
   * a bare `string` alias), and even on `ArrivalFacts` a BRANDED `TenantId`
   * passes the proof, because a branded id is exactly what that guard admits.
   *
   * So the structural claim needs a structural control, and this is it — the
   * same device `model/serving-host.ts` uses when it sweeps its own bytes for
   * names it must not contain. A tenant arriving on a landing notification now
   * has nowhere to enter that does not turn this red.
   *
   * ⚠️ IT SLICES THE TWO DECLARATION BLOCKS RATHER THAN SCANNING THE FILE. The
   * header discusses `tenantId` in prose — it has to, to say the field is
   * absent — and a whole-file scan would either trip on that or force the
   * header to write around its own control, which is how a control stops being
   * readable. */
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'model', 'ingestion.ts'),
    'utf8',
  )
  const lines = source.split('\n')

  function fieldsOf(declaration: string): string[] {
    const open = lines.indexOf(declaration)
    assert.notEqual(open, -1, `model/ingestion.ts no longer declares \`${declaration}\``)
    const rest = lines.slice(open + 1)
    const close = rest.indexOf('}')
    assert.notEqual(close, -1, `\`${declaration}\` is never closed by a bare \`}\``)
    const fields: string[] = []
    for (const line of rest.slice(0, close)) {
      const m = /^ {2}(?:readonly )?([A-Za-z_$][\w$]*)\??:/.exec(line)
      if (m !== null && m[1] !== undefined) fields.push(m[1])
    }
    /* A slice that found no fields would pass every assertion below while
     * asserting nothing — the failure this whole file is written against. */
    assert.ok(fields.length > 0, `${declaration}: the block reader found no fields`)
    return fields
  }

  for (const declaration of [
    'export interface ArrivalFacts {',
    'export interface ArrivalContext {',
  ]) {
    const fields = fieldsOf(declaration)
    for (const field of fields) {
      assert.equal(
        /tenant/i.test(field),
        false,
        `${declaration} declares \`${field}\` — invariant 1 says tenant scope is ` +
          'derived from the session, never read from a request, and the cascade ' +
          'closes that by having nowhere to put one',
      )
    }
  }

  /* And the row DOES carry a tenant, because it is stored. The two facts
   * together are the invariant: derived by the caller, written on the row,
   * never read off the notification. */
  assert.ok(source.includes('export interface Arrival extends TenantScoped {'))
})

/* ------------------------------- 9. the admitted shape carries no more */

test('test_an_admitted_arrival_carries_only_what_the_facts_carried', () => {
  /* An admission is not a widening. Nothing is minted here — no timestamp, no
   * tenant, no document id — because every one of those is the caller's to
   * supply and a cascade that invented one would be inventing a fact about an
   * artefact it is structurally unable to read. */
  const channel = drawingChannel()
  const result = admitArrival(factsFor(channel), contextFor(channel))
  assert.equal(result.ok, true)
  assert.deepEqual(result.ok ? result.admitted : null, {
    arrivalId: ARRIVAL,
    channelId: MAILBOX_CHANNEL,
    channelKind: INTAKE_CHANNEL_KINDS.mailbox,
    endpointId: SAP,
    authorizationId: GRANT,
  })
})
