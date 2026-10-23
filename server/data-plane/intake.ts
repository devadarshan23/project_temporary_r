/**
 * C1 · THE FOUR CHANNELS, AND WHICH OF THEM ARE ACTUALLY WIRED —
 * `GET /v1/intake/channels` (`listIntakeChannels`). G691, 19 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 G300's THREE PARTS, DERIVED WITH THE COMMANDS RATHER THAN ASSERTED,
 *    BECAUSE THE RULING'S OWN INSTRUCTION IS THAT *"A TABLE ALONE IS THE
 *    TRAP."*
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   TABLE       `tenant.intake_channel` × `tenant.arrival`,
 *               `db/migrations/0012_payload_and_subject_index.sql` §1 and §2,
 *               both `SELECT`-only to the app role. Derive:
 *               `grep -c 'GRANT SELECT  *ON tenant.intake_channel' db/migrations/0012_payload_and_subject_index.sql`
 *   MODEL       `INTAKE_CHANNEL_KINDS`, `CHANNEL_DRAWS_THROUGH_AN_ENDPOINT`
 *               and `guardIntakeChannel()` in `model/ingestion.ts` — and the
 *               guard is CALLED, not merely imported for its vocabulary.
 *               Derive: `grep -rln 'export function guardIntakeChannel' model/`
 *   CAPABILITY  `x-capability: admit_source`, a member of the closed set that
 *               `tenant.role_capability` can carry and that
 *               `server/dev/identity-seed.ts` already seeds. Derive:
 *               `grep -n 'listIntakeChannels' -A 2 docs/contracts/capability.openapi.yaml`
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE RESPONSE ITERATES THE DECLARATIONS AND NEVER THE ROWS, AND THAT IS
 *    INVARIANT 4's DISCIPLINE ARRIVING ONE TABLE OVER.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `db/migrations/0012` §4: *"there is no code path in it that can enumerate
 * the document … `model/field-path.ts`'s `addressableKeys()` states the same
 * rule one layer up — THE SET IS BUILT FROM THE DECLARATIONS AND NEVER FROM
 * THE DOCUMENT."*
 *
 * The same shape holds here for a different reason and it is worth separating
 * the two, because conflating them would let somebody "simplify" this into a
 * `GROUP BY kind`. The four entries come from `INTAKE_CHANNEL_KINDS`, so:
 *
 *   · A kind with NO configured lane answers `wired: false, lastArrivalAt:
 *     null` rather than being ABSENT from the array. The contract's summary is
 *     *"The four channels, and which of them are actually wired"* — a missing
 *     entry and an unwired one are different sentences, and an operator
 *     reading three entries cannot tell which of the four they are not being
 *     told about.
 *   · A row whose `kind` is not a member of the union FAILS THE WHOLE
 *     RESPONSE. It is not silently dropped, which a fold over the rows would
 *     do by construction — and dropping it would under-report a lane that
 *     might be admitting documents. That is `server/data-plane/runs.ts`'s rule
 *     verbatim: *"A BAD ROW FAILS THE WHOLE RESPONSE RATHER THAN BEING DROPPED
 *     FROM IT."*
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 `wired` IS NOT `enabled`, AND THE DIFFERENCE IS THE MODEL DOING WORK.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A lane is wired iff it is `enabled` AND `guardIntakeChannel()` returns no
 * defect. `model/ingestion.ts` states the consequence of the second half at
 * `guardChannelLive()`: a malformed lane yields
 * `channel_is_not_a_legal_lane` and **admits nothing**. Publishing
 * `wired: true` for a lane that would refuse every arrival is the exact defect
 * the operation exists to prevent — the contract's own words are *"A silent
 * connector and a connector with nothing to pull look identical from the
 * queue, and the difference is a week of missing invoices."* A lane that is
 * switched on and structurally broken is a third thing that looks like the
 * other two.
 *
 * ⚠️ AND THE DEFECT IS NOT PUBLISHED. `IntakeChannelStatus` is
 * `additionalProperties: false` with three keys, so there is nowhere to put
 * one; it goes to the process log with the channel id and nothing else, which
 * is what `IntakeChannelDefect` was shaped for — *"Carries IDS ONLY — no
 * location string, no mailbox address, no bucket prefix."*
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 `lastArrivalAt` IS DERIVED FROM THE ARRIVAL ROW AND IS NOT A STORED
 *    COLUMN, WHICH `db/migrations/0012` §1 DECIDED AND THIS IS THE READER OF.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * *"A channel that received a notification the cascade could not resolve does
 * NOT advance its liveness signal … A stored column would be a second source
 * of truth for a fact §2's rows already carry, and it would go wrong in
 * exactly the direction the docblock names: written on notification rather
 * than on admission."*
 *
 * ⚠️ IT IS THE MAX OVER **EVERY** ARRIVAL ON THE LANE, ADMITTED AND REFUSED.
 * `IntakeChannel.lastArrivalAt` is *"Derived from the newest `Arrival` row"*
 * and an `Arrival` row exists for a refusal too — that is G205's whole reason
 * for existing, *"file 39,998 was refused"*. The contract agrees that this is
 * liveness and not health: *"It is not a health check and does not claim the
 * connector is well; it says when something last came through."* **A max over
 * admitted arrivals alone would report a lane that is delivering rubbish as
 * silent**, which is the opposite of what an operator needs.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 READ THE SQL AND NOTE WHAT IS NOT IN IT: THERE IS NO TENANT PREDICATE,
 *    AND THE JOIN DOES NOT CARRY ONE EITHER.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * No `WHERE tenant_id = $1`, and the `LEFT JOIN` is `ON a.channel_id = c.id`
 * with **no `a.tenant_id = c.tenant_id` term**. Both sides are narrowed to one
 * tenant by `intake_channel_rls` and `arrival_rls` before the join is
 * evaluated, so the term would be redundant — and adding it would make the
 * negative control assert nothing: `tests/db/…` disables RLS underneath a read
 * and requires it to LEAK, which is *"the only way to tell isolation produced
 * by the database from isolation produced by a `WHERE` a handler happens to
 * carry"*.
 */

import type { FastifyReply } from 'fastify'

import {
  INTAKE_CHANNEL_KINDS,
  guardIntakeChannel,
  type IntakeChannelKind,
} from '../../model/ingestion.ts'
import type { EndpointId, IntakeChannelId, Timestamp } from '../../model/kernel.ts'
import { sendProblem } from '../http/app.ts'
import { CODES } from '../http/problem.ts'
import { actingTenantOf, type AuthorisedBody, type AuthorisedOperation } from './authorisation-record.ts'

/**
 * The declared kinds, in declaration order.
 *
 * 🛑 `Object.values()` AND NOT A LITERAL LIST. `tools/check-wire-mirror.mjs`'s
 * `intake_channel_kinds` pair compares `INTAKE_CHANNEL_KINDS` against
 * `IntakeChannelStatus.properties.channel.enum` **as a sequence**, so the wire
 * order IS the model's declaration order — and a transcription here would be a
 * third copy, in the one place no pair in the wire-mirror addresses.
 */
const DECLARED_KINDS: readonly IntakeChannelKind[] = Object.values(INTAKE_CHANNEL_KINDS)

/**
 * One configured lane, plus the derived liveness signal.
 *
 * ⚠️ `kind` IS A BARE `string` AND NOT `IntakeChannelKind`. It comes out of a
 * `text` column that `db/migrations/0012` deliberately puts no CHECK on, so
 * typing it as the union here would be a cast asserting a fact nobody checked.
 * The narrowing happens once, below, with a refusal for a value that is not a
 * member.
 */
interface ChannelRow {
  readonly id: string
  readonly kind: string
  readonly endpoint_id: string | null
  readonly enabled: boolean
  readonly last_arrival_at: Date | null
}

const CHANNEL_COLUMNS =
  'SELECT c.id, c.kind, c.endpoint_id, c.enabled,\n' +
  '       max(a.arrived_at) AS last_arrival_at\n' +
  '  FROM tenant.intake_channel c\n' +
  '  LEFT JOIN tenant.arrival a ON a.channel_id = c.id\n' +
  ' GROUP BY c.id, c.kind, c.endpoint_id, c.enabled\n'

/**
 * A lane whose stored `kind` is not in the model's vocabulary.
 *
 * Same shape and same 500 as `server/data-plane/runs.ts`'s `unpublishable()`,
 * and it is a SECOND function rather than a reuse for one reason: that one
 * carries a `runId` in its message and this carries a channel id, and a
 * refusal that names the wrong subject sends an operator to the wrong table.
 * The STATUS and the CODE are identical because the fact is identical — a
 * stored value the domain model does not define.
 */
function unreadableLane(reply: FastifyReply, channelId: string, column: string): FastifyReply {
  console.error(
    `data-plane: \`tenant.intake_channel\` row \`${channelId}\` carries a \`${column}\` that is ` +
      'not in the domain model’s vocabulary; no channel status was published.',
  )
  return sendProblem(reply, {
    status: 500,
    code: CODES.upstreamUnavailable,
    title: 'The request could not be completed.',
    detail: 'A stored intake channel carries a value the domain model does not define.',
  })
}

const listIntakeChannelsBody: AuthorisedBody = async ({ reply, tx, grant }) => {
  const result = await tx.query(CHANNEL_COLUMNS, [])
  const rows = result.rows as unknown as ChannelRow[]

  /* kind → { wired, lastArrivalAt } — folded over the ROWS, published over the
   * DECLARATIONS. See the header for why those are two different loops. */
  const wired = new Map<IntakeChannelKind, boolean>()
  const newest = new Map<IntakeChannelKind, string>()

  for (const row of rows) {
    if (!isDeclaredKind(row.kind)) return unreadableLane(reply, row.id, 'kind')
    const arrivedAt = row.last_arrival_at === null ? null : row.last_arrival_at.toISOString()

    /*
     * 🛑 THE GUARD RUNS ON EVERY LANE, INCLUDING DISABLED ONES, AND THE ORDER
     * IS `enabled && legal` RATHER THAN `legal && enabled` ONLY BECAUSE BOTH
     * HAVE TO BE TRUE. What matters is that a DISABLED malformed lane is still
     * reported to the log: switching it on later would then be a one-line
     * change that silently does nothing, and the operator would have had no
     * warning.
     */
    const defect = guardIntakeChannel({
      tenantId: actingTenantOf(grant),
      id: row.id as IntakeChannelId,
      kind: row.kind,
      endpointId: row.endpoint_id === null ? null : (row.endpoint_id as EndpointId),
      enabled: row.enabled,
      lastArrivalAt: arrivedAt === null ? null : (arrivedAt as Timestamp),
    })
    if (defect !== null) {
      console.error(
        `data-plane: intake channel \`${defect.channelId}\` is not a legal lane ` +
          `(\`${defect.kind}\`); it is reported as unwired. \`guardChannelLive()\` would ` +
          'refuse every arrival on it with `channel_is_not_a_legal_lane`.',
      )
    }

    if (row.enabled && defect === null) wired.set(row.kind, true)
    if (arrivedAt !== null) {
      const held = newest.get(row.kind)
      if (held === undefined || held < arrivedAt) newest.set(row.kind, arrivedAt)
    }
  }

  return {
    channels: DECLARED_KINDS.map((kind) => ({
      channel: kind,
      wired: wired.get(kind) === true,
      lastArrivalAt: newest.get(kind) ?? null,
    })),
  }
}

/**
 * ⚠️ DERIVED FROM THE CONST OBJECT, NOT FROM A SECOND LIST. A fifth member
 * added to `INTAKE_CHANNEL_KINDS` is recognised here with no edit — which is
 * the opposite polarity from `CHANNEL_DRAWS_THROUGH_AN_ENDPOINT`, where a
 * fifth member must be ANSWERED. Both are correct: this one asks *is this
 * string one of ours*, and that one asks *what is true of it*.
 */
function isDeclaredKind(value: string): value is IntakeChannelKind {
  return (DECLARED_KINDS as readonly string[]).includes(value)
}

/**
 * `resourceId: null` — *"opening a list"* is `ResourceRef.resourceId`'s own
 * example of a genuinely non-instance-bound act, and a channel roster is one:
 * the request names nothing.
 *
 * ⚠️ `resourceType: 'IntakeChannel'` — the ENTITY name from
 * `model/ingestion.ts`, never a path and never a table. `ResourceRef` says it
 * is *"Never parsed."*
 */
export const listIntakeChannelsOperation: AuthorisedOperation = {
  operationId: 'listIntakeChannels',
  resourceType: 'IntakeChannel',
  instanceOf: () => null,
  body: listIntakeChannelsBody,
}
