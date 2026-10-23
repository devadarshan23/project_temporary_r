import { call } from './exceptions.ts'
import { planeEndpoint, type Read } from './runs.ts'

/**
 * `GET /v1/intake/channels` — `listIntakeChannels`, the four intake lanes and,
 * for each, whether it is CONFIGURED and when a document last arrived on it.
 * It feeds C1's "How the documents arrived" strip (G3093) and nothing else.
 *
 * 🛑 `configured` IS THE WIRE'S `wired`, AND IT MEANS CONFIGURED — NEVER LIVE,
 * NEVER REACHABLE. The operation's own description forecloses the other
 * reading: *"It is not a health check and does not claim the connector is
 * well."* It is renamed at this seam, once, so no component holds a field whose
 * name invites the misreading G216 reverted on the connection light — and
 * `tests/app/indicator-roster.test.ts` §5 still refuses either wire name in any
 * file that draws the light.
 */
export const INTAKE_CHANNEL_KINDS = ['upload', 'watched_drop', 'connector_pull', 'mailbox'] as const
export type IntakeChannelKind = (typeof INTAKE_CHANNEL_KINDS)[number]

export interface IntakeLane {
  readonly channel: IntakeChannelKind
  /** The wire's `wired`: the lane is configured for this tenant. */
  readonly configured: boolean
  /** The wire's `lastArrivalAt`: an ISO instant, or null when nothing has arrived. */
  readonly lastArrival: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isKind(value: unknown): value is IntakeChannelKind {
  return typeof value === 'string' && (INTAKE_CHANNEL_KINDS as readonly string[]).includes(value)
}

export async function fetchIntakeLanes(o: Read): Promise<readonly IntakeLane[]> {
  const body = await call(planeEndpoint(o.origin, '/intake/channels'), { method: 'GET' })
  if (!isRecord(body) || !Array.isArray(body['channels'])) {
    throw new Error(
      '`listIntakeChannels` answered without a `channels` array. It is `required`, and an ' +
        'absence drawn as no lanes would read as a tenant nothing has been delivered to.',
    )
  }
  return (body['channels'] as readonly unknown[]).map((raw) => {
    if (!isRecord(raw) || !isKind(raw['channel'])) {
      throw new Error('`listIntakeChannels` answered with a channel outside the four the contract declares')
    }
    const at = raw['lastArrivalAt']
    if (typeof raw['wired'] !== 'boolean' || (at !== null && typeof at !== 'string')) {
      throw new Error('`listIntakeChannels` answered with a lane whose two required fields are malformed')
    }
    return { channel: raw['channel'], configured: raw['wired'], lastArrival: at }
  })
}
