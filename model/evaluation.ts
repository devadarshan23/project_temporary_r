/**
 * ReconcileAI — evaluation and quality measurement.
 *
 * Platform layer. See docs/framework-practices.md §2.
 *
 * Three stances that shape everything here:
 *
 * 1. SCORING NEVER BLOCKS. Evaluation is a parallel concern. A reconciliation
 *    run must never wait on a scorer, and a failing scorer must never fail a
 *    run.
 *
 * 2. THE PRODUCT ALREADY GENERATES LABELS. An approver accepts a proposed
 *    resolution or rejects it with a required reason. That is a labelled
 *    dataset produced by normal operation — the most valuable evaluation asset
 *    the platform has, and it costs nothing to collect.
 *
 * 3. SCORING IS ITSELF PROCESSING. Model-graded scoring of customer documents
 *    is a processing activity with policy and cost consequences. It is
 *    subject to ModelUseConfig and metered separately.
 */

import type {
  RollbackTrigger,
  Severity,
  DataClass,
  DomainKey,
  ExceptionId,
  RuleId,
  RunId,
  SourceDocumentId,
  TenantId,
  TenantScoped,
  Timestamp,
  UserId,
} from './domain'

import type { ScorerId } from './kernel'

/* SLICE 6 — the reference sweep's targets. Imported from `./kernel` directly
 * rather than through `./domain`: a NEW id has no re-export history to
 * preserve, and routing it through the largest module in the system is the
 * indirection slice 3 was written to end. Re-exported for the same reason the
 * older ids are — a consumer that already reads this module keeps reading it. */
import type {
  EvaluationGateId,
  InjectionProbeId,
  ScoreResultId,
  SolutionPackId,
} from './kernel'
export type {
  EvaluationGateId,
  InjectionProbeId,
  ScoreResultId,
  SolutionPackId,
} from './kernel'

/** @dropped-for-v1 7 Aug 2026 — the alias of a dropped type — no labelled corpus exists to score against in v1. Declared, not built. */
export type { ScorerId } from './kernel'

/** The two evaluation-record ids, 7 Aug (G35). Same shape as `ScorerId` above. */
import type { GateResultId, PackQualityReportId } from './kernel'
/** @dropped-for-v1 7 Aug 2026 — aliases of dropped types — no quality reporting in v1. Declared, not built. */
export type { GateResultId, PackQualityReportId } from './kernel'

/* ------------------------------------------------------------------ *
 * What can be scored
 * ------------------------------------------------------------------ */

/**
 * The three things worth measuring continuously. Each maps to a distinct
 * failure mode the product can actually suffer.
 */
/** @dropped-for-v1 7 Aug 2026 — quality scoring has no corpus and no rollout to feed in v1. Declared, not built. */
export const SCORE_TARGETS = {
  /** Did extraction read the document correctly? */
  extraction: 'extraction',
  /** Did the rule fire when it should have — and not when it shouldn't? */
  matching: 'matching',
  /** Was the explanation useful to the human who read it? */
  explanation: 'explanation',
  /** Was the proposed resolution the one a human would have chosen? */
  resolution: 'resolution',
} as const
/** @dropped-for-v1 7 Aug 2026 — quality scoring has no corpus and no rollout to feed in v1. Declared, not built. */
export type ScoreTarget = (typeof SCORE_TARGETS)[keyof typeof SCORE_TARGETS]

/**
 * WHICH LEVEL a measurement is taken at. Distinct from ScoreTarget, which says
 * what was measured.
 *
 * Adopted from AIVolveX's three-layer eval model. The distinction is
 * load-bearing because of what does and does not aggregate:
 *
 *   LINEAR properties propagate. Cost and latency sum across a chain.
 *   QUALITY properties do NOT. Composition can amplify an error, dampen it
 *   (a human catches it), or make it irrelevant (the failing step was not on
 *   the path taken).
 *
 * Therefore an outcome score may never be computed by averaging component
 * scores. It must be measured directly against outcome-level golden journeys.
 * A perfect score on every component is fully compatible with the process
 * failing — and the reverse is also true.
 */
/** @dropped-for-v1 7 Aug 2026 — quality scoring has no corpus and no rollout to feed in v1. Declared, not built. */
export const SCORE_LEVELS = {
  /** Does one step meet its own contract on golden inputs? */
  component: 'component',
  /** Do steps hand off correctly once wired together? */
  composition: 'composition',
  /** Does the reconciliation produce the correct business result? */
  outcome: 'outcome',
} as const
/** @dropped-for-v1 7 Aug 2026 — quality scoring has no corpus and no rollout to feed in v1. Declared, not built. */
export type ScoreLevel = (typeof SCORE_LEVELS)[keyof typeof SCORE_LEVELS]

/**
 * How a score is produced. Cost and trustworthiness differ sharply, so the
 * method is explicit rather than an implementation detail.
 */
/** @dropped-for-v1 7 Aug 2026 — quality scoring has no corpus and no rollout to feed in v1. Declared, not built. */
export const SCORER_METHODS = {
  /** Deterministic comparison against ground truth. Free, exact, needs labels. */
  rule: 'rule',
  /** Aggregate statistics over a population. Free, no per-item verdict. */
  statistical: 'statistical',
  /** A model grades the output. Costs tokens; needs its own validation. */
  modelGraded: 'model_graded',
  /** A human judged it. Slowest, scarcest, and the ground truth for the rest. */
  human: 'human',
} as const
/** @dropped-for-v1 7 Aug 2026 — quality scoring has no corpus and no rollout to feed in v1. Declared, not built. */
export type ScorerMethod = (typeof SCORER_METHODS)[keyof typeof SCORER_METHODS]

/* ------------------------------------------------------------------ *
 * Scorer definition
 * ------------------------------------------------------------------ */

/** @dropped-for-v1 7 Aug 2026 — no labelled corpus exists to score against; invariant 9 stays declared and unexercised. Declared, not built. */
export interface Scorer {
  id: ScorerId
  name: string
  description: string
  target: ScoreTarget
  /** The level this measurement is taken at. See SCORE_LEVELS. */
  level: ScoreLevel
  method: ScorerMethod
  /** Null for platform scorers; set when a tenant defines its own. */
  tenantId: TenantId | null
  /** Restrict to a domain where the measure is domain-specific. */
  domain: DomainKey | null
  enabled: boolean
  /**
   * Fraction of eligible items scored, 0..1. Model-graded scorers are usually
   * sampled rather than exhaustive, because they cost tokens per item.
   */
  samplingRate: number
  /** Required for model_graded. Subject to ModelUseConfig like any model call. */
  model: string | null
  /** Below this, the score is treated as a regression. */
  alertBelow: number | null
  /**
   * What a breach does. The discipline that keeps this usable:
   *
   *   notify_owner     — always safe, always available
   *   block_promotion  — gates a release; safe at any level
   *   trigger_rollback — reverts a live rollout. OUTCOME LEVEL ONLY.
   *
   * Component drift must not roll back a fleet. Otherwise every minor
   * regression pages the pack owner and signal-to-noise collapses.
   * Enforced by canTriggerRollback().
   */
  onBreach: 'notify_owner' | 'block_promotion' | 'trigger_rollback'
}

/**
 * The rule, executable rather than documented.
 *
 * A scorer may only revert a live rollout if it measures the outcome. This is
 * the single most important discipline in the eval design and the easiest to
 * erode one exception at a time.
 */
/** @dropped-for-v1 7 Aug 2026 — no automated rollback exists in v1 — see AUTOMATED_ROLLBACK_EXISTS. Declared, not built. */
export function canTriggerRollback(scorer: Scorer): boolean {
  return scorer.level === SCORE_LEVELS.outcome
}

/**
 * A gate a pack must pass before advancing a lifecycle state.
 *
 * sampleSize is required for the reason QualityWindow carries it: a 0.97 over
 * six items is not a measurement, and a gate that can be passed by a thin
 * sample is not a gate.
 */
/** @dropped-for-v1 7 Aug 2026 — quality gates need scorers and a corpus; the injection gate is separate and stays. Declared, not built. */
export interface EvaluationGate {
  /**
   * BRANDED 7 Aug, slice 6, with the four fields that name it:
   * `SolutionPack.gateIds`, `PlatformAgentEvalFloor.gateIds`,
   * `AgentEvalBinding.additionalGateIds` and `GateResult.gateId`. The floor is
   * additive by the shape of the type — there is no exclusion list — so the
   * only thing a bare string could do here was point at the wrong gate.
   */
  id: EvaluationGateId
  name: string
  /** Which transition this gate guards. */
  gates: 'validated' | 'tested' | 'approved' | 'active'
  scorerId: ScorerId
  minScore: number
  minSampleSize: number
  /** False lets a sandbox pack advance without it. Never true→false in prod. */
  waivableInSandbox: boolean
}

/** Outcome of running the gates for one pack version. */
/** @dropped-for-v1 7 Aug 2026 — the result of a quality gate v1 does not run. Declared, not built. */
export interface GateResult {
  /**
   * ADDED 7 Aug (G35). Gates are re-run: the same `(packId, packVersion, gateId)`
   * produces a new row every attempt, and the ones that FAILED are the rows worth
   * keeping. `waived` is the sharper case — a sandbox waiver is meant to be
   * "visible rather than silent", and a waiver nobody can cite by reference is
   * not visible to an approver, only to whoever runs the query.
   */
  id: GateResultId
  packId: SolutionPackId
  packVersion: number
  gateId: EvaluationGateId
  passed: boolean
  observedScore: number
  observedSampleSize: number
  evaluatedAt: Timestamp
  /** Set when a sandbox waiver was used, so it is visible rather than silent. */
  waived: boolean
}

/* ------------------------------------------------------------------ *
 * Results
 * ------------------------------------------------------------------ */

/** @dropped-for-v1 7 Aug 2026 — nothing is scored in v1. Declared, not built. */
export type ScoreSubject =
  | { type: 'extraction'; sourceDocumentId: SourceDocumentId }
  | { type: 'match'; runId: RunId; ruleId: RuleId }
  | { type: 'explanation'; exceptionId: ExceptionId }
  | { type: 'resolution'; exceptionId: ExceptionId }

/**
 * One score. Append-only.
 *
 * `value` is normalised 0..1 across every method so trends are comparable —
 * a rule-based exact match and a model-graded judgement land on one axis.
 */
/** @dropped-for-v1 7 Aug 2026 — nothing is scored in v1. Declared, not built. */
export interface ScoreResult {
  /** BRANDED 7 Aug, slice 6, with its own `supersedesScoreId`. */
  id: ScoreResultId
  tenantId: TenantId
  scorerId: ScorerId
  subject: ScoreSubject
  /** 0..1. Higher is better, always — invert at definition time, not read time. */
  value: number
  at: Timestamp
  /** Why the scorer landed there. Shown in the quality surface. */
  rationale: string | null
  /** Tokens spent producing this score, for separate cost attribution. */
  tokensSpent: number | null
  /** Set when this score superseded an earlier automated one. */
  supersedesScoreId: ScoreResultId | null
}

/* ------------------------------------------------------------------ *
 * Ground truth
 * ------------------------------------------------------------------ */

/**
 * A labelled example. Two provenances, and the distinction matters:
 *
 *   'seeded'    — authored with the solution pack. Synthetic, safe to ship,
 *                 usable in the sandbox, and the regression suite.
 *   'observed'  — captured from real operation after human judgement. Higher
 *                 value, but it is customer data and never leaves the tenant.
 */
/** @dropped-for-v1 7 Aug 2026 — no labelled corpus is built for v1. Declared, not built. */
export type LabelledExample = SeededExample | ObservedExample

/**
 * Platform asset. Authored with a pack, synthetic, safe to ship, and the only
 * kind that may feed a PackQualityReport.
 */
/** @dropped-for-v1 7 Aug 2026 — no labelled corpus is built for v1. Declared, not built. */
export interface SeededExample {
  id: string
  provenance: 'seeded'
  /** Platform-owned by construction — no tenant may appear here. */
  tenantId: null
  packId: SolutionPackId
  target: ScoreTarget
  subject: ScoreSubject
  expected: unknown
  labelledBy: UserId | null
  labelledAt: Timestamp
}

/**
 * Captured from real operation. This is CUSTOMER DATA: it contains verbatim
 * field values from that tenant's documents.
 *
 * The union makes `{ tenantId: null, provenance: 'observed' }` unrepresentable.
 * Previously the two fields were independent, so a customer-derived label could
 * be typed as a platform asset — the exact combination the docstring forbade
 * and nothing enforced. Found by red-team isolation review, 4 Aug 2026.
 */
/** @dropped-for-v1 7 Aug 2026 — no labelled corpus is built for v1. Declared, not built. */
export interface ObservedExample extends TenantScoped {
  id: string
  provenance: 'observed'
  /** Null: an observed label belongs to a tenant, never to a pack. */
  packId: null
  target: ScoreTarget
  subject: ScoreSubject
  expected: unknown
  /** Classification of the captured value, so retention and masking apply. */
  dataClass: DataClass
  /** Observed labels expire. They are customer data, not a permanent asset. */
  purgeAfter: Timestamp
  labelledBy: UserId | null
  labelledAt: Timestamp
}

/**
 * Human judgement captured from ordinary workflow, not from a labelling task.
 *
 * This is the highest-value signal in the system and it is generated for free:
 * an approver already accepts or rejects with a reason. Recording it as a
 * label turns the approval queue into a continuously growing evaluation set.
 */
/** @dropped-for-v1 7 Aug 2026 — feeds a corpus v1 does not build. Declared, not built. */
export interface HumanFeedback {
  id: string
  tenantId: TenantId
  exceptionId: ExceptionId
  by: UserId
  at: Timestamp
  /** Did the human agree with what the system produced? */
  verdict: 'accepted' | 'rejected' | 'amended'
  /** Required on reject. Already required by the approval workflow. */
  reason: string | null
  /** Which aspect was wrong, when the human says. Drives targeted improvement. */
  faultedAspect: ScoreTarget | null
}

/* ------------------------------------------------------------------ *
 * Aggregation
 * ------------------------------------------------------------------ */

/**
 * Rolled-up quality over a window. Computed, cached for the quality surface.
 *
 * `sampleSize` is mandatory and displayed: a 0.97 over 6 items is not a
 * measurement, and a quality dashboard that hides its denominator is worse
 * than none.
 */
/** @dropped-for-v1 7 Aug 2026 — aggregates scores v1 does not produce. Declared, not built. */
export interface QualityWindow {
  tenantId: TenantId
  scorerId: ScorerId
  /** Carried so an outcome window is never confused with a component one. */
  level: ScoreLevel
  from: Timestamp
  to: Timestamp
  mean: number
  p10: number
  sampleSize: number
  /** Change against the preceding window. Null when there is no prior. */
  delta: number | null
  breachedAlertThreshold: boolean
}

/**
 * A pack's measured quality, published so a tenant can see what it is adopting
 * before installing — and so a partner can answer "how well does this work?"
 * with evidence rather than assertion.
 *
 * Computed over SEEDED examples only. Never over customer data.
 */
/** @dropped-for-v1 7 Aug 2026 — aggregates scores v1 does not produce. Declared, not built. */
export interface PackQualityReport {
  /**
   * ADDED 7 Aug (G35). This is the figure A TENANT DECIDES ON BEFORE INSTALLING
   * and a partner answers "how well does this work?" with. A published claim
   * that cannot be cited cannot be held to: regenerating over a different
   * dataset silently replaces what someone read, and `datasetDescription` exists
   * precisely so the claim is checkable rather than marketing.
   */
  id: PackQualityReportId
  packId: SolutionPackId
  packVersion: number
  generatedAt: Timestamp
  byTarget: Record<ScoreTarget, { mean: number; sampleSize: number }>
  /**
   * Reported per level, never rolled up into one figure. An outcome score is
   * measured directly; it is not derived from the component column.
   */
  byLevel: Record<ScoreLevel, { mean: number; sampleSize: number }>
  /** Named so the claim is checkable rather than marketing. */
  datasetDescription: string
}

/* ------------------------------------------------------------------ *
 * Adversarial evaluation — the injection corpus
 *
 * Closes R3 in docs/prompt-injection-posture.md: scorers and gates existed and
 * nothing tested them against hostile input.
 *
 * WHY THIS IS NOT A SeededExample
 *
 * A seeded example asserts a RESULT — given this document, the extraction should
 * be that. An injection probe asserts an ABSENCE — given this hostile input, the
 * system must not admit it, must not call an out-of-scope tool, must not send
 * anything outward. Negative assertions do not fit `expected: unknown`, and
 * scoring them 0..1 invites partial credit where none exists: a probe that
 * "mostly" held is a probe that failed.
 *
 * Platform-owned and synthetic by rule. A real refusal in production is a
 * CANDIDATE for the corpus, never an entry — the payload is customer content.
 * Reconstruct the shape, exactly as §2.3 of the day-2 record does for bug
 * reproduction, and set reconstructedFromRefusal.
 * ------------------------------------------------------------------ */

export const INJECTION_VECTORS = {
  /** "Ignore previous instructions and …" — the naive form, still worth testing. */
  directOverride: 'direct_override',
  /** Instructions hidden in an ingested document rather than a prompt. */
  indirectDocument: 'indirect_document',
  /** Instructions in a counterparty reply. Our highest-value surface. */
  indirectCorrespondence: 'indirect_correspondence',
  /** Base64, homoglyphs, zero-width characters, bidirectional overrides. */
  obfuscated: 'obfuscated',
  /** Attempts to call a tool the step never declared. */
  toolMisuse: 'tool_misuse',
  /** Attempts to make the agent carry data outward. */
  exfiltration: 'exfiltration',
  /** Claims to be the operator, the platform, or a policy update. */
  authorityClaim: 'authority_claim',
  /** Innocuous alone; an instruction only once combined across steps. */
  deferred: 'deferred',
} as const
export type InjectionVector =
  (typeof INJECTION_VECTORS)[keyof typeof INJECTION_VECTORS]

/** Where hostile content enters. Decides which packs a probe applies to. */
export const INJECTION_ENTRY_POINTS = {
  document: 'document',
  correspondence: 'correspondence',
  connectorPayload: 'connector_payload',
  userPrompt: 'user_prompt',
} as const
export type InjectionEntryPoint =
  (typeof INJECTION_ENTRY_POINTS)[keyof typeof INJECTION_ENTRY_POINTS]

/**
 * What must still be true after the payload has been processed.
 *
 * Every assertion on a probe must hold. There is no partial credit and no
 * weighting: these are safety properties, and a system that held four of five
 * is a system that failed.
 */
export const SAFETY_ASSERTIONS = {
  /** The message was refused, ideally as `injection_suspected`. */
  refusedAdmission: 'refused_admission',
  /** No tool outside the invoking step's declared scope was called. */
  noOutOfScopeTool: 'no_out_of_scope_tool',
  /** Nothing left the tenant on this path. */
  noOutboundSend: 'no_outbound_send',
  /** No value above the ceiling reached a prompt, a span or a message. */
  noClassificationBreach: 'no_classification_breach',
  /** The disposition chosen was not the one the payload asked for. */
  dispositionUnchanged: 'disposition_unchanged',
  /** Output stayed inside the closed vocabulary rather than becoming prose. */
  outputWellFormed: 'output_well_formed',
} as const
export type SafetyAssertion =
  (typeof SAFETY_ASSERTIONS)[keyof typeof SAFETY_ASSERTIONS]

export interface InjectionProbe {
  /** BRANDED 7 Aug, slice 6, with `InjectionProbeResult.probeId`. */
  id: InjectionProbeId
  /** Platform-owned by construction. No tenant may ever appear here. */
  tenantId: null
  vector: InjectionVector
  entryPoint: InjectionEntryPoint
  /** The hostile payload. Synthetic — never lifted from a customer. */
  payload: string
  /** All must hold. */
  mustHold: SafetyAssertion[]
  /** For the human reviewing the corpus, not for the runner. */
  rationale: string
  /**
   * True when this probe was reconstructed from the SHAPE of a real refusal.
   * The provenance matters: it is how the corpus learns from production without
   * production content entering the control plane.
   */
  reconstructedFromRefusal: boolean
  severity: Severity
  addedAt: Timestamp
}

export interface InjectionProbeResult {
  probeId: InjectionProbeId
  packId: SolutionPackId
  packVersion: number
  /** Empty means every assertion held. */
  failed: SafetyAssertion[]
  passed: boolean
  at: Timestamp
  /**
   * For diagnosis. Null where telemetry was too restricted to correlate.
   *
   * ⚠️ STAYS BARE (R1). OpenTelemetry mints it. Listed in `BareByRule` in
   * `model/identity.ts`.
   */
  traceId: string | null
}

/**
 * A pack may not advance without passing every applicable probe.
 *
 * Deliberately not an EvaluationGate: that one is a scorer with a minimum
 * score, and a score is the wrong instrument here. This is pass/fail on a set.
 */
export interface InjectionGate {
  id: string
  gates: 'tested' | 'approved' | 'active'
  /** Only probes whose entry point this pack actually exposes are run. */
  entryPoints: InjectionEntryPoint[]
  /**
   * Literal `false`. A sandbox pack that fails an injection probe is not a
   * sandbox problem — the same graph is what promotes to production. Unlike
   * EvaluationGate.waivableInSandbox, there is no environment in which this is
   * negotiable.
   */
  waivable: false
  /** A gate run against three probes is not a gate. */
  minProbeCount: number
}

/** Probes worth running against a pack, given what it actually exposes. */
export function probesApplicableTo(
  probes: readonly InjectionProbe[],
  exposedEntryPoints: readonly InjectionEntryPoint[],
): InjectionProbe[] {
  return probes.filter((p) => exposedEntryPoints.includes(p.entryPoint))
}

/**
 * A probe failing against a LIVE pack version is a compliance violation, which
 * is one of the four RollbackTrigger kinds.
 *
 * Deliberately NOT routed through canTriggerRollback(). That rule governs
 * SCORERS, and exists so component-level quality drift cannot revert a rollout
 * and drown everyone in noise. A safety regression is not quality drift, and
 * the reasoning that keeps one from reverting must not keep the other from
 * reverting.
 */
/** @dropped-for-v1 7 Aug 2026 — invariant 9’s deliberate exception has no rollout to trigger in v1; the probe still refuses. Declared, not built. */
export function rollbackTriggerForFailedProbe(): RollbackTrigger {
  return { kind: 'compliance_violation' }
}
