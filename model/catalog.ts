/**
 * ReconcileAI — model garden.
 *
 * Control plane. Platform-authored, published downward, no tenant data.
 *
 * WHY A CATALOGUE AND NOT A STRING LIST
 *
 * ModelUseConfig.allowedModels is a plain string[] and should stay one — a
 * policy engine wants a flat allow-list and an admin screen wants to render it.
 * But three governance controls have no data to evaluate against without a
 * catalogue behind those strings:
 *
 *   requireZeroRetention  — nothing recorded whether a provider retains
 *   allowedRegions        — nothing recorded where a model can run
 *   RateCard pricing      — nothing recorded what a model costs
 *
 * All three were claimed controls the system could not enforce.
 */

import type { ScopeDimension } from './access'
import type { RegionKey, Timestamp } from './domain'

/**
 * MOVED TO `model/kernel.ts` 7 Aug, with the twenty-one from `domain.ts` and the
 * one from `agents.ts` — 23 declaration sites reduced to one. Three remain
 * outside kernel, in `learning.ts` and `presentation.ts`; see the note on
 * `HarnessDocumentId` in `agents.ts`.
 *
 * RE-EXPORTED, NOT RE-DECLARED, so every importer of this name is untouched.
 * `model/identity.ts` asserts it resolves to the same type down both paths.
 *
 * ⚠️ NOT TO BE CONFUSED WITH `ModelCatalogEntry.modelId`, which stays a bare
 * string on purpose — AWS mints that namespace and branding it would claim an
 * authority we do not have. The catalogue ROW is ours and has an identity; the
 * model IDENTIFIER inside it is not.
 */
export type { ModelCatalogEntryId } from './kernel'
import type { ModelCatalogEntryId } from './kernel'

/* SLICE 6 — the reference sweep's targets. Imported from `./kernel` directly
 * rather than through `./domain`: a NEW id has no re-export history to
 * preserve, and routing it through the largest module in the system is the
 * indirection slice 3 was written to end. Re-exported for the same reason the
 * older ids are — a consumer that already reads this module keeps reading it. */
import type {
  ModelFallbackChainId,
} from './kernel'
export type {
  ModelFallbackChainId,
} from './kernel'


/**
 * Where inference physically happens.
 *
 * This is the distinction that a Singapore-residency decision lives or dies on,
 * and it is invisible in a model identifier. Bedrock offers the same model
 * under profiles with different routing:
 *
 *   apac.anthropic.claude-sonnet-…    inference stays within APAC
 *   global.anthropic.claude-sonnet-…  routed to whichever region has capacity
 *
 * A `global.*` profile on an allow-list silently defeats
 * ModelUseConfig.allowedRegions: storage is Singapore-resident, inference is
 * anywhere, and the deployment diagram looks compliant while the data is not.
 */
export type InferenceRouting =
  /** Runs only in the region invoked. */
  | { kind: 'regional'; region: RegionKey }
  /** Routed within a named geography. Residency holds at geography grain. */
  | { kind: 'geo_scoped'; geography: 'apac' | 'eu' | 'us'; regions: RegionKey[] }
  /** Routed anywhere the provider chooses. Residency does NOT hold. */
  | { kind: 'global' }

/** What the provider does with what it is sent. */
export interface RetentionPosture {
  /** True only where the provider contractually retains nothing. */
  zeroRetention: boolean
  /** Whether inputs may be used to improve the provider's models. */
  trainsOnInput: boolean
  /** Days the provider holds request data, where it does. Null = none. */
  providerRetentionDays: number | null
  /** Where the claim comes from, so it is checkable rather than asserted. */
  evidenceUrl: string | null
}

export interface ModelCapabilities {
  /** Required for document extraction. A text-only model cannot serve a pack. */
  vision: boolean
  contextWindowTokens: number
  maxOutputTokens: number
  toolUse: boolean
  /** Structured output the extraction contract can rely on. */
  structuredOutput: boolean
}

export interface ModelCost {
  currency: string
  /** Minor units per million tokens, to avoid fractional cents. */
  inputPerMillionMinor: number
  outputPerMillionMinor: number
  /** Cache writes and reads are billed differently and were unmetered. */
  cacheWritePerMillionMinor: number | null
  cacheReadPerMillionMinor: number | null
}

export interface ModelCatalogEntry {
  id: ModelCatalogEntryId
  /**
   * The string that appears in ModelUseConfig.allowedModels.
   *
   * ⚠️ STAYS BARE (R1). AWS MINTS IT. Branding a foreign namespace claims an
   * authority we do not have, and the two names here are one letter apart with
   * opposite answers: `ModelCatalogEntryId` is OUR catalogue row and is
   * branded; `modelId` is the model, and is not ours to name. Listed in
   * `BareByRule` in `model/identity.ts`.
   */
  modelId: string
  displayName: string
  /**
   * CLOSED 8 Aug 2026 (G80b). This was `'bedrock' | 'other'`.
   *
   * G54 settled that the permitted providers are **Bedrock and SageMaker
   * only — there is no third-party arm**. `'other'` was therefore a value the
   * TYPE admitted that no DECISION permitted: a field wider than any ruling
   * allows, which reads as checked and asserts nothing. That is §5.6's shape.
   * This is a DERIVATION from G54, not a new decision.
   *
   * ⚠️ AWS TEXTRACT IS NEITHER, AND CANNOT BE ADDED HERE (G85/G69). It is not
   * a model: `ModelCatalogEntry` requires `ModelCapabilities` — context
   * window, max output tokens, tool use, structured output — and Textract has
   * no analogue for any of the four. So it cannot be a catalogue row, and it
   * does not pass `resolveModel()`. Its residency is carried instead by the
   * `managed_service_use` policy kind (G79). Do not widen this union to
   * reach it.
   */
  provider: 'bedrock' | 'sagemaker'
  routing: InferenceRouting
  retention: RetentionPosture
  capabilities: ModelCapabilities
  cost: ModelCost
  status: 'available' | 'preview' | 'deprecated' | 'retired'
  /** Set on deprecation, so a pack can be migrated before it breaks. */
  succeededBy: string | null
  addedAt: Timestamp
}

/** Ordered fallback, because a demo will eventually meet a throttle. */
/** @dropped-for-v1 7 Aug 2026 — v1 routes to one model per binding; a fallback chain has no resolver and no screen. Declared, not built. */
export interface ModelFallbackChain {
  /** BRANDED 7 Aug, slice 6, with `AgentModelBinding.fallbackChainId`. */
  id: ModelFallbackChainId
  name: string
  /**
   * Tried in order. Every entry must independently satisfy policy.
   *
   * ⚠️ STAYS BARE (R1) — the same AWS-minted strings as `ModelCatalogEntry
   * .modelId`, in order. Listed in `BareByRule` in `model/identity.ts`.
   */
  modelIds: string[]
}

export type ModelRejection =
  | { reason: 'not_in_catalogue' }
  | { reason: 'not_allowed_by_policy' }
  | { reason: 'status_unavailable'; status: ModelCatalogEntry['status'] }
  | { reason: 'missing_capability'; capability: keyof ModelCapabilities }
  | { reason: 'region_not_permitted'; permitted: RegionKey[] }
  | { reason: 'routing_defeats_residency'; routing: InferenceRouting }
  | { reason: 'retention_not_zero' }

export type ModelResolution =
  | { ok: true; entry: ModelCatalogEntry }
  | { ok: false; rejection: ModelRejection }

/**
 * The governance rules made executable.
 *
 * Each rejection path corresponds to a control that previously existed only as
 * prose. `routing_defeats_residency` is the one the region survey exposed: a
 * globally-routed profile passes an `allowedModels` check and an
 * `allowedRegions` check separately, while satisfying neither together.
 */
export function resolveModel(input: {
  modelId: string
  catalogue: ReadonlyMap<string, ModelCatalogEntry>
  /**
   * INVERTED 5 Aug 2026, with the policy field it reads (§8.6).
   *
   * This was `allowedModels: string[]`, and the rule below was
   * `allowedModels.length > 0 && !allowedModels.includes(modelId)` — so an
   * EMPTY LIST PERMITTED THE ENTIRE CATALOGUE, on the control that carries
   * invariant 7. The field's own documentation said "Empty = platform default
   * set" and there was no platform default set anywhere: no constant, no
   * resolver, nothing. This function implemented the documentation faithfully.
   *
   * Residency survived only because `global.*` routing is rejected
   * unconditionally further down, on a separate line. The allow-list was
   * contributing nothing.
   *
   * `{ kind: 'these', values: [] }` now permits nothing, and `{ kind: 'all' }`
   * has to be written down. Same shape as `AssignmentScope`, deliberately —
   * this repo made exactly this fix once and did not carry it here.
   */
  allowedModels: ScopeDimension<string>
  allowedRegions: RegionKey[]
  requireZeroRetention: boolean
  requireVision: boolean
}): ModelResolution {
  const {
    modelId, catalogue, allowedModels, allowedRegions,
    requireZeroRetention, requireVision,
  } = input

  const entry = catalogue.get(modelId)
  if (!entry) return { ok: false, rejection: { reason: 'not_in_catalogue' } }

  if (allowedModels.kind === 'these' && !allowedModels.values.includes(modelId)) {
    return { ok: false, rejection: { reason: 'not_allowed_by_policy' } }
  }
  if (entry.status !== 'available' && entry.status !== 'preview') {
    return { ok: false, rejection: { reason: 'status_unavailable', status: entry.status } }
  }
  if (requireVision && !entry.capabilities.vision) {
    return { ok: false, rejection: { reason: 'missing_capability', capability: 'vision' } }
  }
  if (requireZeroRetention && !entry.retention.zeroRetention) {
    return { ok: false, rejection: { reason: 'retention_not_zero' } }
  }

  switch (entry.routing.kind) {
    case 'global':
      // Unconditional: a global profile cannot honour any residency constraint.
      return {
        ok: false,
        rejection: { reason: 'routing_defeats_residency', routing: entry.routing },
      }
    case 'regional':
      if (!allowedRegions.includes(entry.routing.region)) {
        return { ok: false, rejection: { reason: 'region_not_permitted', permitted: allowedRegions } }
      }
      break
    case 'geo_scoped': {
      const outside = entry.routing.regions.filter((r) => !allowedRegions.includes(r))
      if (outside.length > 0) {
        return { ok: false, rejection: { reason: 'region_not_permitted', permitted: allowedRegions } }
      }
      break
    }
  }

  return { ok: true, entry }
}
