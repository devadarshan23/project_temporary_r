/**
 * ReconcileAI — the dashboard layer. Canvas, cards, and what a card is bound to.
 *
 * WHY THIS MODULE EXISTS
 *
 * `view_dashboard` and `view_summary` are capabilities gating a resource that
 * did not exist anywhere in `model/`. Two verbs, no noun. Every other capability
 * in access.ts points at something this model can name — an `Exception`, a
 * `SourceDocument`, a `Role`, an `Endpoint` — and these two pointed at a screen
 * described only in the application being replaced. A verb with no noun cannot
 * be scoped, cannot be masked, cannot be audited as a `DataAccessEvent`, and
 * cannot appear in an erasure plan, because none of those mechanisms has a row
 * to attach to.
 *
 * THE DECOMPOSITION, WHICH IS THE WHOLE POINT
 *
 * A dashboard is a COMPOSITION, not a leaf, and the seam is where access bites:
 *
 *   THE CANVAS AND THE CARD LAYOUT ARE `configuration`. Positions, sizes, a
 *   title, which chart shape. Shippable in a pack, revertible on a pack
 *   rollback, and harmless on its own — a layout leaks nothing, because a
 *   rectangle is not a number.
 *
 *   EACH CARD'S BINDING IS A `tenant_data` READ, EVALUATED UNDER THE VIEWER'S
 *   OWN SCOPE. Not the author's. Not the pack's. The person looking at it.
 *
 * That is the same shape as `Procedure`: the graph is configuration and the data
 * it touches is tenant data. It is not a local convenience — it is the only
 * shape under which invariant 1 (tenant scope is derived from the session, never
 * read from a request) survives contact with a saved artefact, because a saved
 * dashboard is *precisely* a request somebody else wrote down earlier.
 *
 * THE CONSEQUENCE, STATED SO NOBODY LATER "SIMPLIFIES" IT AWAY
 *
 * **`view_dashboard` gates opening the canvas. It does not confer the
 * contents.** Two users with different `AssignmentScope.costCentres` open the
 * same dashboard and see different numbers, because each card's binding is
 * intersected with *their* scope before a row is touched. The dashboard is
 * identical; the answer is not.
 *
 * WHAT THIS PREVENTS, AND IT IS THE DEFAULT BEHAVIOUR OF THE CATEGORY. Every
 * mainstream BI tool ships a mode where a saved view resolves its query with the
 * AUTHOR'S credentials — Tableau's embedded credentials on a published data
 * source, Power BI's fixed-identity gateway, Looker's PDT owner, a materialised
 * summary table refreshed by a service account. In each, a dashboard is a
 * standing scope-bypass wearing a chart: the author's reach is frozen into an
 * artefact, and everyone who can open it inherits it. A finance controller
 * scoped to one legal entity builds a "Group exposure" tile; an AP clerk scoped
 * to one cost centre opens the dashboard and reads the group figure. Nothing was
 * hacked. The tool worked as documented.
 *
 * The refusal is structural rather than procedural: `resolveCard()` returns a
 * `ViewerScopedFilter`, a type this module is the only place capable of
 * producing, and a `CardBinding.filter` is not assignable to it. A query layer
 * that accepts only `ViewerScopedFilter` cannot be handed the author's filter by
 * a caller in a hurry. See §9.
 *
 * WHY THE BINDING IS NOT A QUERY STRING. A free-text query — SQL, a metric DSL,
 * an LLM-generated `WHERE` clause — is an open condition language, and the
 * standing constraint on this model is that *"who can see this"* stays a
 * RELATIONAL question rather than a SIMULATION. You can intersect two closed
 * dimension sets and prove the result. You cannot intersect an arbitrary
 * predicate with a scope without executing it, and a check you must execute to
 * evaluate is a check you cannot audit ahead of time. It would also be a second
 * policy engine beside `decide()`, which this model refuses everywhere else
 * (agents hold no roles; scope has SIX fixed dimensions — `domains`,
 * `definitionIds`, `solutionIds`, `costCentres`, `legalEntities`,
 * `valueCeiling` — and not arbitrary key/value).
 *
 * WHAT THE OLD BUILD GOT WRONG, INHERITED AS STRUCTURE AND NOT AS LOOSENESS.
 * These three citations are the evidence for three decisions below, so they are
 * kept rather than dropped. The build they name was deleted from the trunk on
 * 6 Aug 2026 and is at the tag `archive/sap-line` — read any of them with
 * `git show archive/sap-line:<path>`.
 *
 * `archive/sap-line:src/types/biDashboard.types.ts` typed a KPI payload as
 * `data: Record<string, unknown>` — the `additionalProperties: true` shape this
 * repo has already been bitten by on a signed policy bundle, here sitting on the
 * customer's business figures. `archive/sap-line:src/pages/dashboardCardMetadata.ts`
 * carried per-card `titleColor` / `backgroundColor` hex strings, so a pack-shipped
 * dashboard could not be re-themed and a contrast rule could not be enforced.
 * `archive/sap-line:src/services/BIOps/DashboardManagement/createDashboardApi.ts`
 * minted card ids with `crypto.randomUUID()` in the browser. Each is addressed
 * below, at the type it belongs to.
 *
 * Project constraints honoured here (model/tsconfig.json): erasableSyntaxOnly
 * (const objects + union types, never enums), verbatimModuleSyntax (`import
 * type` only), exactOptionalPropertyTypes and noUncheckedIndexedAccess — hence
 * `| null` throughout and never an optional `?:`.
 *
 * ⚠️ ─────────────────────────────────────────────────────────────────────────
 * THIS WHOLE MODULE IS `@dropped-for-v1`, 7 AUG 2026. Every export below carries
 * the note. **Dropped means DECLARED AND NOT BUILT** — no table, no endpoint, no
 * code. Nothing here is deleted, and that is deliberate: the reasoning above is
 * the most expensive thing in the file, restoring it is one commit, and a
 * deletion would take the argument with it.
 *
 * WHY IT IS SAFE TO DROP, WHICH IS NOT THE SAME AS "NOTHING IS LOST." The
 * standing objection to cutting `resolveCard()` / `ViewerScopedFilter` is that a
 * saved panel would otherwise become a standing scope bypass. In v1 there is no
 * builder, so nothing is saved, so nothing is shared, so **the bypass has no
 * vector**. The four panels a v1 screen renders are fetched by capability
 * operations that already run `decide()` on the caller; the scope property lives
 * in the API layer, not in the card resolver.
 *
 * THAT ARGUMENT EXPIRES. `SAVED_VIEWS_EXIST` below is the trigger, and it is a
 * real event rather than "later": the moment a view can be saved and shared, the
 * author's reach starts freezing into an artefact and this module must come back
 * BEFORE the first one is shared, not after.
 *
 * WHAT V1 GIVES UP: build-a-card-by-chatting, and the Panels screen that was
 * promised and never drawn.
 * ───────────────────────────────────────────────────────────────────────────
 */

/**
 * FALSE IN V1, AND THE REASON THIS MODULE MAY SIT DORMANT.
 *
 * A saved view is precisely a request somebody else wrote down earlier. While no
 * view can be saved, every read is evaluated against the caller who made it and
 * the scope-bypass this module exists to refuse cannot be constructed.
 *
 * **FLIPPING THIS TO `true` IS THE TRIGGER TO RESTORE THE RESOLVER.** Stated as
 * a constant rather than a comment so that the engineer who builds saved views
 * has to edit a line somebody reviews, in the same diff, rather than shipping a
 * feature whose safety argument silently stopped holding.
 */
export const SAVED_VIEWS_EXIST = false

/**
 * Type-only, and therefore erased. THIS MODULE HAS NO RUNTIME EDGE TO ACCESS,
 * DELIBERATELY, and the reason is the same one access.ts gives for importing
 * governance as types: presentation owns what a card is bound to, access owns
 * who may read it, and neither may quietly redefine the other. Capability values
 * appear below as string literals checked against `Capability` — a rename in
 * access.ts is a type error here, which is the notification we want, without
 * this module ever holding a reference to the evaluator.
 *
 * The corollary is §9's central rule: **presentation evaluates no capability.**
 * It takes an already-resolved answer through `ScopeResolver`. There is exactly
 * one evaluator and it is `decide()` in access.ts.
 */
import type {
  AssignmentScope,
  Capability,
  ScopeDimension,
} from './access'
import type { Meter } from './billing'
import type {
  AggregateFn,
  DashboardId,
  DefinitionId,
  DomainKey,
  ExceptionStatus,
  Id,
  Money,
  Severity,
  TenantScoped,
  Timestamp,
  UserId,
} from './domain'

/* SLICE 6 — the reference sweep's targets. Imported from `./kernel` directly
 * rather than through `./domain`: a NEW id has no re-export history to
 * preserve, and routing it through the largest module in the system is the
 * indirection slice 3 was written to end. Re-exported for the same reason the
 * older ids are — a consumer that already reads this module keeps reading it. */
import type {
  SolutionPackId,
} from './kernel'
export type {
  SolutionPackId,
} from './kernel'


/* ------------------------------------------------------------------ *
 * 1. Identity — and the trap of letting the client choose it
 * ------------------------------------------------------------------ */

/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export type DashboardCardId = Id<'DashboardCard'>

/**
 * A card as it is SUBMITTED. It has no id, and that is the enforcement.
 *
 * The old build called `crypto.randomUUID()` inside the API layer and sent the
 * result as the row's primary key (`resolvePersistedCardId`, falling through to
 * a fresh UUID whenever the card had no server id yet). Ids the client chooses
 * are ids the client can collide, and a collision here is not cosmetic: two
 * dashboards in two tenants can be made to agree on a card id, and every
 * downstream artefact keyed by that id — a `DataAccessEvent` recording who read
 * the card, an erasure plan item, a cached resolution — then points at two
 * things. A client that can pick a key can also RE-pick one, which is a quiet
 * overwrite of somebody else's card wearing the shape of an update.
 *
 * Expressed as an absent field rather than a comment saying "server-set",
 * because a comment does not stop `{ ...draft, id: myId }` from compiling. What
 * a client sends is a `DashboardCardDraft`; only the server widens it.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export interface DashboardCardDraft {
  /** What the reader sees on the card. Free text; it is a label, not a query. */
  title: string
  kind: CardKind
  layout: CardLayout
  presentation: CardPresentation
  binding: CardBinding
}

/** The persisted card. `id` is server-minted, always. */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export interface DashboardCard extends DashboardCardDraft {
  id: DashboardCardId
}

/* ------------------------------------------------------------------ *
 * 2. Closed sets — what a card can be, drawn from what the old build renders
 * ------------------------------------------------------------------ */

/**
 * Six render shapes, plus one that reads nothing.
 *
 * Taken verbatim from the surface being replaced —
 * `DashboardCard.type: 'statistic' | 'chart' | 'table' | 'list' | 'timeline' |
 * 'progress'` in `archive/sap-line:src/pages/CreateDashboard.tsx` — so this is a
 * description of a built product rather than an invented taxonomy.
 *
 * `text` is the addition, and it earns its place by making the decomposition
 * CONCRETE instead of rhetorical: a section heading on a canvas genuinely
 * touches no tenant data, resolves without a capability, and renders identically
 * for every viewer. A layer where every card is a read cannot demonstrate that
 * the layout half is configuration; this one can.
 *
 * Adding a kind is a platform release, exactly as adding a procedure step kind
 * or a capability is.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export const CARD_KINDS = {
  /** A single figure. The KPI tile the six role dashboards are built from. */
  statistic: 'statistic',
  chart: 'chart',
  table: 'table',
  list: 'list',
  /** Rows ordered by time. A different reading of the same rows a table shows. */
  timeline: 'timeline',
  /** A single figure against a target. */
  progress: 'progress',
  /** Static copy. Reads nothing, and is the proof that layout is configuration. */
  text: 'text',
} as const
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export type CardKind = (typeof CARD_KINDS)[keyof typeof CARD_KINDS]

/**
 * Chart shapes, closed, exactly the old build's five
 * (`chartType?: 'line' | 'bar' | 'pie' | 'donut' | 'area'`).
 *
 * A RENDER CHOICE AND NOTHING MORE. It is in `CardPresentation` rather than in
 * the binding on purpose: switching a bar to a line changes no row, requires no
 * capability, and is revertible on a pack rollback. Putting a shape inside the
 * binding is how a presentation edit acquires a data blast radius.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export const CHART_KINDS = {
  line: 'line',
  bar: 'bar',
  pie: 'pie',
  donut: 'donut',
  area: 'area',
} as const
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export type ChartKind = (typeof CHART_KINDS)[keyof typeof CHART_KINDS]

/* ------------------------------------------------------------------ *
 * 3. Layout — the configuration half, and its blast radius is zero
 * ------------------------------------------------------------------ */

/**
 * Where the card sits. Integer canvas units, not pixels.
 *
 * The old build persisted raw pixels and then spent five hand-rolled modules
 * (`dashboardGridLayout`, `dashboardGridSnap`, `dashboardLayoutConstants`,
 * `dashboardLayoutInteraction`, `dashboardViewportScale`) reconciling them
 * against a viewport that was never the authoring viewport. Units are resolved
 * against `DashboardCanvas.columns` at render, so a dashboard authored at one
 * width is not silently wrong at another — and so a pack can ship a layout at
 * all, which pixels make impossible across a fleet of unknown screens.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export interface CardLayout {
  /** Column index of the left edge. 0-based. */
  x: number
  /** Row index of the top edge. 0-based. */
  y: number
  /** Width in columns. Never zero. */
  width: number
  /** Height in rows. Never zero. */
  height: number
  /** Stacking order among overlapping cards. */
  zIndex: number
}

/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export interface DashboardCanvas {
  /** How many columns `CardLayout.x` and `.width` are expressed in. */
  columns: number
  /** Height of one layout row, in the same abstract units. */
  rowUnits: number
}

/**
 * Semantic tone, NOT a colour.
 *
 * The old build stored `titleColor`, `backgroundColor` and `textColor` as
 * free-form hex per card. Three consequences, all of which were live: a
 * pack-shipped dashboard could not adopt a tenant's theme, a contrast
 * requirement could not be checked because nothing knew what the value was
 * *for*, and dark mode is unreachable when every card has hard-coded its own
 * background. A colour is a rendering of an intent; storing the rendering throws
 * the intent away and there is no path back.
 *
 * Closed, so a theme can map every member and a new theme is a mapping rather
 * than a migration over stored hex strings.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export const CARD_TONES = {
  neutral: 'neutral',
  positive: 'positive',
  caution: 'caution',
  critical: 'critical',
  brand: 'brand',
} as const
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export type CardTone = (typeof CARD_TONES)[keyof typeof CARD_TONES]

/**
 * Emphasis, not a font size. Same argument as tone: a stored `titleSize: 18`
 * cannot survive a type-scale change and cannot be checked against a minimum.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export const CARD_EMPHASIS = {
  subdued: 'subdued',
  normal: 'normal',
  prominent: 'prominent',
} as const
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export type CardEmphasis = (typeof CARD_EMPHASIS)[keyof typeof CARD_EMPHASIS]

/**
 * How the card looks. Configuration class, revertible, confers nothing.
 *
 * `chartKind` is null for every card that is not a chart. Not modelled as a
 * discriminated union with `CardKind` because the pairing is already total in
 * `CARD_KIND_BINDINGS` and a second discrimination on the same field is two
 * places to keep in step.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export interface CardPresentation {
  tone: CardTone
  emphasis: CardEmphasis
  /** Null unless `kind` is `chart`. */
  chartKind: ChartKind | null
  /** Static copy, for `text` cards. Null everywhere else. */
  body: string | null
}

/* ------------------------------------------------------------------ *
 * 4. The binding — a closed set of metrics over closed dimensions
 *
 * This is the type the module exists for. Everything above it is layout;
 * everything below it is the rule that layout may not become a data grant.
 * ------------------------------------------------------------------ */

/**
 * What a card counts. Closed, platform-defined, and every member is something
 * the model can already produce from a named entity — which is the test for
 * admission. A metric nobody can derive from `Exception`, `SourceDocument`,
 * `ReconciliationRun` or `UsageRecord` is a metric that would have to be
 * computed by an untyped payload, which is exactly the `Record<string, unknown>`
 * this replaces.
 *
 * NO `exceptions_per_reviewer`, AND THAT IS A DECISION RATHER THAN AN OVERSIGHT.
 * Aggregating work by the person who did it turns a reconciliation dashboard
 * into a staff-performance monitor. That is a different product with a different
 * lawful basis — under PDPA it is employee monitoring, needing its own notice
 * and its own retention answer — and shipping it as one member of a metric enum
 * is how an organisation acquires it by accident. `assigned_to` remains
 * available as a ROW COLUMN (see `EXCEPTION_COLUMNS`), because naming the owner
 * of a row you may already read is not a score. It is absent from
 * `CARD_DIMENSIONS` for the same reason: the grouping is the surveillance, not
 * the field.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export const CARD_METRICS = {
  exceptionCount: 'exception_count',
  exceptionValueAtRisk: 'exception_value_at_risk',
  exceptionAgeDays: 'exception_age_days',
  /** Share auto-resolved. A RATE — see `METRIC_AGGREGATES`. */
  autoResolvedShare: 'auto_resolved_share',
  approvalLatencyHours: 'approval_latency_hours',
  /** Share of lines that matched. Also a rate. */
  matchRate: 'match_rate',
  documentsProcessed: 'documents_processed',
  pagesExtracted: 'pages_extracted',
  runsCompleted: 'runs_completed',
} as const
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export type CardMetric = (typeof CARD_METRICS)[keyof typeof CARD_METRICS]

/**
 * The sentinel for "the capability set has no verb for this yet".
 *
 * NOT A CONVENIENCE. Three metrics below read things `Capability` cannot name —
 * a run, a match group, a usage record. The tempting fix is to let them fall
 * back to `view_dashboard`, and that fix quietly destroys this module's central
 * claim: the moment one card's CONTENTS resolve on the strength of the CANVAS
 * capability, `view_dashboard` confers data again and the decomposition is
 * decorative.
 *
 * So the fallback is the other way. A metric mapped here renders EMPTY, with a
 * refusal reason that names the missing verb, until access.ts grows one. Failing
 * closed on an unresolved classification is the same discipline as `DENY_ALL`
 * being the value every failed scope resolution returns.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export const CONTENT_CAPABILITY_UNDEFINED = 'content_capability_undefined'
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export type ContentCapabilityUndefined = typeof CONTENT_CAPABILITY_UNDEFINED

/**
 * WHICH CAPABILITY EACH METRIC'S DATA REQUIRES. Not which capability opens the
 * dashboard — that is `view_dashboard`, once, for the canvas.
 *
 * TOTAL BY CONSTRUCTION, for the reason `CAPABILITY_RESOURCE_CLASS` is total: a
 * metric nobody classifies must be a COMPILE ERROR rather than a metric that
 * resolves against whatever the surrounding card happened to be granted.
 *
 * THE THREE SENTINELS ARE A FINDING, RECORDED HERE RATHER THAN PAPERED OVER.
 * `runs_completed`, `match_rate` and every `meter` binding read entities that
 * the closed capability set does not cover: there is no `view_run`, no
 * `view_match`, and no `view_usage`. `trigger_run` is classed `configuration`
 * and is the wrong verb — running a job is not reading its result, as its own
 * comment in access.ts says. The Token Usage screen in the deployed non-SAP
 * build is ungoverned for exactly this reason. Adding those verbs is a platform
 * release and belongs to whoever owns access.ts; until then these cards are
 * inert by design and visibly so.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export const METRIC_CAPABILITY: Record<
  CardMetric,
  Capability | ContentCapabilityUndefined
> = {
  exception_count: 'view_exception',
  exception_value_at_risk: 'view_exception',
  exception_age_days: 'view_exception',
  auto_resolved_share: 'view_exception',
  /** An approval is an act on an exception; reading its latency is that read. */
  approval_latency_hours: 'view_exception',
  match_rate: CONTENT_CAPABILITY_UNDEFINED,
  documents_processed: 'view_document',
  pages_extracted: 'view_document',
  runs_completed: CONTENT_CAPABILITY_UNDEFINED,
}

/**
 * How a metric may be combined. Closed PER METRIC, and the reason is billing's.
 *
 * `METER_AGGREGATION` in billing.ts records that `storage_gb_month` is a STOCK
 * and every other meter a FLOW, because one shared `SUM()` over-billed a level
 * by 30x daily and 720x hourly. A rate has the identical failure and a worse
 * blast radius, because nobody audits a chart: summing `match_rate` across
 * twelve monthly buckets yields 1,140%, and summing `auto_resolved_share` across
 * cost centres produces a number that looks like a percentage, is not one, and
 * will be read aloud in a meeting. The old build had no notion of a legal
 * aggregate at all — the aggregation was whatever the backend happened to do.
 *
 * A rate declares exactly `average`. Not by convention; by this table.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export type CardAggregate = AggregateFn | 'average'

/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export const METRIC_AGGREGATES: Record<CardMetric, readonly CardAggregate[]> = {
  exception_count: ['count'],
  exception_value_at_risk: ['sum', 'max', 'min', 'average'],
  exception_age_days: ['average', 'max'],
  /** A rate. Never summed. */
  auto_resolved_share: ['average'],
  approval_latency_hours: ['average', 'max'],
  /** A rate. Never summed. */
  match_rate: ['average'],
  documents_processed: ['count', 'sum'],
  pages_extracted: ['sum'],
  runs_completed: ['count'],
}

/**
 * What a figure may be broken down BY.
 *
 * The first four are exactly `AssignmentScope`'s four set-valued dimensions, and
 * that alignment is load-bearing rather than tidy: a breakdown along a dimension
 * the viewer is scoped on is a breakdown the intersection in §9 can bound. A
 * breakdown along a dimension nobody scopes on cannot be bounded, which is how a
 * "group by" becomes an enumeration attack on a population you may not see.
 *
 * `severity`, `status` and `counterparty` are the exceptions and each is
 * justified individually. Severity and status are properties OF a row you have
 * already been authorised to read — they narrow within your population and can
 * never widen it. `counterparty` is the product's most-requested breakdown
 * ("which vendors mismatch most") and is admitted knowingly: where a
 * counterparty is a sole trader the name is `personal` class, which is declared
 * ONCE on `FieldSpec` (invariant 4) and derived at render — never restated here.
 * This module classifies nothing.
 *
 * `assigned_to` is deliberately absent. See `CARD_METRICS`.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export const CARD_DIMENSIONS = {
  domain: 'domain',
  definition: 'definition',
  costCentre: 'cost_centre',
  legalEntity: 'legal_entity',
  severity: 'severity',
  status: 'status',
  counterparty: 'counterparty',
} as const
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export type CardDimension =
  (typeof CARD_DIMENSIONS)[keyof typeof CARD_DIMENSIONS]

/**
 * The card's declared narrowing.
 *
 * REUSES `ScopeDimension` FROM ACCESS.TS, AND THE POLARITY IS THE SAME ONE:
 * `all` must be written down, and an empty `these` denies. That polarity was
 * fixed in access.ts because a freshly constructed scope was maximally
 * permissive and every failed resolution failed OPEN; a filter constructed by a
 * dashboard builder has the identical failure mode and is authored far more
 * casually than a role.
 *
 * READ THE TWO HALVES CORRECTLY OR THE WHOLE MODULE IS MISUNDERSTOOD:
 *
 *   THE FIRST FOUR ARE AUTHORISING DIMENSIONS. They are intersected with the
 *   viewer's `AssignmentScope` in §9. A card declaring `domains: {kind:'all'}`
 *   is NOT asking for everything — it is declining to narrow, and the viewer's
 *   scope supplies the bound. `all` here is *permissive of the author's intent*
 *   and *powerless against the viewer's scope*, which is the only arrangement in
 *   which a saved artefact is safe to share.
 *
 *   `severities` AND `statuses` ARE PRESENTATION ONLY. Nothing in
 *   `AssignmentScope` bounds them, so they narrow and never authorise. They are
 *   in this type rather than in `CardPresentation` because they change which
 *   rows are counted, and a filter that changes the answer belongs with the
 *   binding regardless of whether it gates anything.
 *
 * OUTSTANDING DELTA, NAMED SO IT IS NOT DISCOVERED IN PRODUCTION. `Exception`
 * carries denormalised `domain` and `definitionId` and carries NEITHER a cost
 * centre NOR a legal entity — cost centre currently derives only through
 * `TagPolicy.chargebackKey` on the definition, and legal entity has no column at
 * all. So two of the four authorising dimensions cannot presently be evaluated
 * against an exception row. That is a gap on the ROW, not here, and the fix is
 * to denormalise both onto `Exception` exactly as `domain` already is. It is not
 * encoded as a hard refusal below only because doing so would blank every
 * dashboard in every tenant that scopes by cost centre, which is a change to
 * make deliberately rather than as a side effect of writing this file.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export interface CardFilter {
  domains: ScopeDimension<DomainKey>
  definitionIds: ScopeDimension<DefinitionId>
  costCentres: ScopeDimension<string>
  legalEntities: ScopeDimension<string>
  /** Presentation narrowing. Authorises nothing. */
  severities: ScopeDimension<Severity>
  /** Presentation narrowing. Authorises nothing. */
  statuses: ScopeDimension<ExceptionStatus>
}

/** Declines to narrow. The viewer's scope still bounds every authorising dimension. */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export const UNFILTERED: CardFilter = {
  domains: { kind: 'all' },
  definitionIds: { kind: 'all' },
  costCentres: { kind: 'all' },
  legalEntities: { kind: 'all' },
  severities: { kind: 'all' },
  statuses: { kind: 'all' },
}

/**
 * The period a card covers. Closed, and RELATIVE by default.
 *
 * An absolute date range saved on a dashboard is a bookmark that silently goes
 * stale: the tile says "open exceptions" and answers for last March forever.
 * `period` exists for the one legitimate absolute case — a closed accounting
 * period someone is reviewing — and names it explicitly so the staleness is the
 * intent rather than an accident.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export type CardWindow =
  | { kind: 'current_period' }
  | { kind: 'trailing_days'; days: number }
  | { kind: 'trailing_periods'; periods: number }
  /** A specific `ReconciliationPeriod`. Deliberately frozen. */
  | { kind: 'period'; periodKey: string }
  | { kind: 'all_time' }

/** How a series is bucketed along time. */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export type TimeBucket = 'day' | 'week' | 'month' | 'period'

/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export type SortDirection = 'asc' | 'desc'

/**
 * Columns an exception row may project. Closed, rather than arbitrary
 * `FieldPath`s.
 *
 * An open projection reopens the problem this module exists to close: an
 * arbitrary path into extracted document content is an arbitrary read, and its
 * `DataClass` would have to be resolved per path at render, on every row, in the
 * one place with the least appetite for a lookup. These are `Exception`'s own
 * fields, which the model already classifies as a whole.
 *
 * `explanation_summary` is here because a required, non-nullable `Explanation`
 * is the product thesis in the type system, and a table of exceptions without it
 * is the queue the product exists to replace.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export const EXCEPTION_COLUMNS = {
  raisedAt: 'raised_at',
  severity: 'severity',
  status: 'status',
  domain: 'domain',
  definition: 'definition',
  ruleLabel: 'rule_label',
  valueAtRisk: 'value_at_risk',
  counterparty: 'counterparty',
  /** Naming a row's owner is not a performance score. See `CARD_METRICS`. */
  assignedTo: 'assigned_to',
  explanationSummary: 'explanation_summary',
} as const
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export type ExceptionColumn =
  (typeof EXCEPTION_COLUMNS)[keyof typeof EXCEPTION_COLUMNS]

/** Columns a run row may project. Same closedness, same reason. */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export const RUN_COLUMNS = {
  startedAt: 'started_at',
  completedAt: 'completed_at',
  definition: 'definition',
  status: 'status',
  trigger: 'trigger',
  exceptionsRaised: 'exceptions_raised',
} as const
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export type RunColumn = (typeof RUN_COLUMNS)[keyof typeof RUN_COLUMNS]

/* ------------------------------------------------------------------ *
 * 5. CardBinding
 * ------------------------------------------------------------------ */

/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export const CARD_BINDING_KINDS = {
  staticText: 'static_text',
  metric: 'metric',
  series: 'series',
  meter: 'meter',
  exceptionRows: 'exception_rows',
  runRows: 'run_rows',
} as const
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export type CardBindingKind =
  (typeof CARD_BINDING_KINDS)[keyof typeof CARD_BINDING_KINDS]

/**
 * What this card shows, expressed so it can be intersected with a scope.
 *
 * A DISCRIMINATED UNION AND NOT A BAG OF NULLABLE FIELDS, because the old
 * build's card carried `chartData`, `tableData`, `listData`, `timelineData` and
 * `progressValue` side by side and every one of them was optional — so "a table
 * card holding chart data" was a legal value, and the renderer resolved the
 * ambiguity by trying fields in order. Here an illegal pairing is
 * unrepresentable: a run-rows binding cannot carry exception columns because
 * there is no field for them.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export type CardBinding =
  /**
   * Reads nothing. No filter, no window, no capability.
   *
   * The card that proves the decomposition: a heading resolves identically for
   * every viewer, survives a pack rollback untouched, and never appears in a
   * `DataAccessEvent` — because it genuinely is configuration.
   */
  | { kind: 'static_text' }
  /** One figure. The KPI tile. */
  | {
      kind: 'metric'
      metric: CardMetric
      aggregate: CardAggregate
      /** Non-null renders a grouped figure — a donut or a ranked bar. */
      groupBy: CardDimension | null
      filter: CardFilter
      window: CardWindow
    }
  /** A figure over time. */
  | {
      kind: 'series'
      metric: CardMetric
      aggregate: CardAggregate
      bucketBy: TimeBucket
      /** A second breakdown, giving one line or bar stack per value. */
      groupBy: CardDimension | null
      filter: CardFilter
      window: CardWindow
    }
  /**
   * A metered quantity — tokens, documents, storage.
   *
   * CARRIES NO `aggregate`, ON PURPOSE. How a meter combines is declared once,
   * in `METER_AGGREGATION` in billing.ts, and restating it here is precisely how
   * `storage_gb_month` gets summed and a level over-bills by 30x. The card names
   * the meter; billing owns the arithmetic.
   */
  | {
      kind: 'meter'
      meter: Meter
      groupBy: CardDimension | null
      filter: CardFilter
      window: CardWindow
    }
  | {
      kind: 'exception_rows'
      columns: readonly ExceptionColumn[]
      orderBy: { column: ExceptionColumn; direction: SortDirection } | null
      /** Bounded. An unbounded row binding on a shared canvas is an export. */
      limit: number
      filter: CardFilter
      window: CardWindow
    }
  | {
      kind: 'run_rows'
      columns: readonly RunColumn[]
      orderBy: { column: RunColumn; direction: SortDirection } | null
      limit: number
      filter: CardFilter
      window: CardWindow
    }

/**
 * Which bindings each render shape accepts. TOTAL, so a new card kind cannot be
 * added without stating what it may read.
 *
 * This is the pairing the old build resolved at render time by inspecting which
 * optional data field happened to be populated — `mapCardType()` in
 * `createDashboardApi.ts` even rewrote a card's persisted `type` from its
 * `chartType`, so the stored shape and the stored kind could disagree and the
 * API decided which won.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export const CARD_KIND_BINDINGS: Record<CardKind, readonly CardBindingKind[]> = {
  statistic: ['metric', 'meter'],
  /** `metric` with a non-null `groupBy` is a legitimate chart — a donut. */
  chart: ['series', 'metric', 'meter'],
  table: ['exception_rows', 'run_rows'],
  list: ['exception_rows', 'run_rows'],
  /** A timeline is rows read along time. Runs are not the subject of one. */
  timeline: ['exception_rows'],
  progress: ['metric', 'meter'],
  text: ['static_text'],
}

/* ------------------------------------------------------------------ *
 * 6. Dashboard
 * ------------------------------------------------------------------ */

/**
 * Where a dashboard came from. Mirrors `RoleOrigin`, and for the same reason: a
 * pack SHIPS dashboards and a tenant COMPOSES them, and the two must not be
 * confusable on upgrade.
 *
 * IT IS ALSO THE ROLLBACK RULE. A `pack`-origin dashboard's layout, tone and
 * card set are the pack's to revert — that is what makes the canvas
 * configuration. A `tenant`-origin dashboard is not, and a rollout that reverted
 * one would be destroying a customer's own work under the banner of a version
 * change. `PackRollout`'s rollback path must read this field.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export type DashboardOrigin =
  /** Shipped and versioned with a pack. The same everywhere it is installed. */
  | 'pack'
  /** Composed in the builder by someone in the tenant. Never pack-revertible. */
  | 'tenant'
  /** Seeded defaults — the six role dashboards the old build hard-coded. */
  | 'platform'

/**
 * A canvas, its cards, and nothing about who may see the numbers.
 *
 * That absence is the design. There is no `visibleToRoles`, no `sharedWith`, no
 * `owner` whose credentials resolve the queries — the three fields every BI tool
 * grows and the mechanism by which each becomes a second authorisation system
 * beside the real one. Who sees WHAT is answered per card, per viewer, in §9,
 * against `AssignmentScope`. Who may open the canvas is answered by
 * `view_dashboard` through `decide()`. Neither answer is stored on this row,
 * because a stored answer is a stale one.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export interface Dashboard extends TenantScoped {
  id: DashboardId
  /**
   * Stable identifier, NAMESPACED BY PACK exactly as `Role.key` is. Identity is
   * (packId, key). Two packs both shipping `overview` must not fight over one
   * row on upgrade.
   */
  key: string
  /** What the customer calls it. */
  label: string
  /**
   * Immutable on write, like `Role.version` and `Policy.version`.
   *
   * Without it a pack upgrade that repoints a card's binding changes what every
   * live viewer has been reading, retroactively and with no event — and an
   * auditor asking "what did the board see in March" follows a bare pointer to
   * today's definition.
   */
  version: number
  origin: DashboardOrigin
  /** Null for platform and tenant origins. */
  packId: SolutionPackId | null
  /** Partner template -> customer instantiation. Mirrors `Procedure.derivedFrom`. */
  derivedFrom: DashboardId | null
  /** Context for labelling and defaults only. Never an authorisation term. */
  domain: DomainKey | null
  canvas: DashboardCanvas
  cards: readonly DashboardCard[]
  status: 'draft' | 'active' | 'archived'
  createdBy: UserId
  createdAt: Timestamp
  updatedAt: Timestamp
}

/* ------------------------------------------------------------------ *
 * 7. Resolution against the viewer — where the rule becomes executable
 * ------------------------------------------------------------------ */

declare const viewerScoped: unique symbol

/**
 * A filter that has been intersected with a specific viewer's scope.
 *
 * THE ENFORCEMENT IS THE TYPE, NOT THE CONVENTION. The brand symbol is module-
 * private, so `resolveCard()` is the only thing in the codebase that can produce
 * one of these: a `CardBinding.filter` is not assignable to a
 * `ViewerScopedFilter`, and no amount of spreading, casting-by-habit or
 * "just pass the card's filter through for now" makes it so.
 *
 * A query layer that accepts ONLY this type therefore cannot be handed the
 * author's filter — not by a mistake, not by a shortcut, not by a future agent
 * refactoring under time pressure. That is the difference between this and every
 * BI product that documents "row-level security is applied" and relies on each
 * data path remembering to apply it. Documentation is not a control; an
 * unconstructable type is.
 *
 * It carries `viewerUserId` so a `DataAccessEvent` written from a rendered card
 * names the person the intersection was actually computed for, rather than the
 * person the request claimed to be.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export interface ViewerScopedFilter {
  readonly [viewerScoped]: 'resolved_against_viewer_scope'
  readonly viewerUserId: UserId
  readonly domains: ScopeDimension<DomainKey>
  readonly definitionIds: ScopeDimension<DefinitionId>
  readonly costCentres: ScopeDimension<string>
  readonly legalEntities: ScopeDimension<string>
  readonly severities: ScopeDimension<Severity>
  readonly statuses: ScopeDimension<ExceptionStatus>
}

/** Which authorising dimension refused. Data in its own field, never prose. */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export type BindingDimension =
  | 'domains'
  | 'definition_ids'
  | 'cost_centres'
  | 'legal_entities'

/**
 * Why a card rendered empty. CLOSED, for the reason `DECISION_REASONS` and
 * `GRANT_REASONS` are closed: an interpolated string on a customer-visible
 * surface is not auditable, not countable and not translatable.
 *
 * "Rendered empty" is deliberately the failure mode rather than "errored". A
 * card the viewer cannot see must look like a card with nothing in it, not like
 * a broken card — an error message that distinguishes *forbidden* from *empty*
 * is an oracle, and a canvas of them enumerates the population you were scoped
 * away from. The reason is for the audit log, not for the viewport.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export const BINDING_REFUSALS = {
  permitted: 'permitted',
  /** The viewer may not open the canvas at all. */
  canvas_capability_absent: 'canvas_capability_absent',
  /** The viewer holds no assignment carrying the capability this card's data needs. */
  content_capability_absent: 'content_capability_absent',
  /** access.ts has no verb for what this card reads. See CONTENT_CAPABILITY_UNDEFINED. */
  content_capability_not_defined: 'content_capability_not_defined',
  /** The card's kind does not accept this binding. A malformed saved artefact. */
  binding_kind_wrong_for_card_kind: 'binding_kind_wrong_for_card_kind',
  /** Summing a rate, or another arithmetic the metric does not permit. */
  aggregate_not_legal_for_metric: 'aggregate_not_legal_for_metric',
  /** The intersection with the viewer's scope is empty on some dimension. */
  scope_excludes_every_value: 'scope_excludes_every_value',
} as const
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export type BindingRefusal =
  (typeof BINDING_REFUSALS)[keyof typeof BINDING_REFUSALS]

/**
 * What a card resolved to for one viewer.
 *
 * `render` is the ONLY member carrying a filter, and the filter it carries is
 * the intersected one. There is no shape of this union that hands a caller the
 * author's filter, which is what makes "ignore the boolean and use the field"
 * — the careless read that `Decision.scope` returns `DENY_ALL` to defend
 * against — impossible here rather than merely safe.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export type CardResolution =
  | { kind: 'render'; filter: ViewerScopedFilter; actCeiling: Money | null }
  /** A `text` card. No read, no filter, identical for everyone. */
  | { kind: 'render_static' }
  | {
      kind: 'empty'
      reason: BindingRefusal
      /** Non-null only for `scope_excludes_every_value`. */
      dimension: BindingDimension | null
      /** Non-null only for `content_capability_absent`. */
      capability: Capability | null
    }

/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export interface ResolvedCard {
  cardId: DashboardCardId
  resolution: CardResolution
}

/**
 * The canvas answer and the per-card answers, together and never apart.
 *
 * `canvasOpen === true` with every card `empty` is a NORMAL, EXPECTED outcome —
 * a partner supporting a customer's queue, a sponsor holding only `view_summary`
 * — and a caller that treats it as an error will "fix" it by widening something.
 * It is the decomposition working.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export interface DashboardResolution {
  canvasOpen: boolean
  canvasReason: BindingRefusal
  cards: readonly ResolvedCard[]
}

/**
 * How this module obtains an authorisation answer: by asking, never by deciding.
 *
 * Satisfied BY CONSTRUCTION by `effectiveScopeFor(principal, …)` in access.ts,
 * partially applied to a principal. Taking a function rather than a
 * `PrincipalContext` is what keeps presentation incapable of holding a second
 * evaluator: there is no `RoleAssignment` in scope here, no partner mask, no
 * grant, and therefore no way for a well-meaning edit to reimplement a fragment
 * of `decide()` that drifts from it. The same reason `decide()` itself refuses
 * to be two halves — "a two-halves API will be half-called, once."
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export type ScopeResolver = (
  capability: Capability,
) => { granted: boolean; scope: AssignmentScope }

/**
 * Intersect one dimension of a card's declared filter with the viewer's.
 *
 * `all` on either side means "I do not narrow", so the other side stands. Two
 * enumerations intersect. The empty result is NOT normalised to `all` — an empty
 * `these` denies, per access.ts, and turning "nothing survived" into "everything"
 * is the exact fail-open this polarity was chosen to prevent.
 */
function intersectDimension<T>(
  declared: ScopeDimension<T>,
  permitted: ScopeDimension<T>,
): ScopeDimension<T> {
  if (permitted.kind === 'all') return declared
  if (declared.kind === 'all') return permitted
  const allowed = new Set(permitted.values)
  return { kind: 'these', values: declared.values.filter((v) => allowed.has(v)) }
}

/** True when a dimension survived the intersection with something in it. */
function dimensionSurvives<T>(dim: ScopeDimension<T>): boolean {
  return dim.kind === 'all' || dim.values.length > 0
}

/**
 * The scope rule, executable and callable on its own.
 *
 * Answers only "does anything survive for this viewer" — no capability term, no
 * card kind, no aggregate legality. Kept separate from `resolveCard()` because
 * the builder needs it to warn an author that a card they are composing will be
 * blank for a colleague, and that warning must not require constructing a
 * `ScopeResolver` or a principal.
 *
 * A `static_text` binding is visible under every scope, because it reads nothing.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export function bindingVisibleUnder(
  binding: CardBinding,
  scope: AssignmentScope,
): boolean {
  if (binding.kind === 'static_text') return true
  const f = binding.filter
  return (
    dimensionSurvives(intersectDimension(f.domains, scope.domains))
    && dimensionSurvives(
      intersectDimension(f.definitionIds, scope.definitionIds),
    )
    && dimensionSurvives(intersectDimension(f.costCentres, scope.costCentres))
    && dimensionSurvives(
      intersectDimension(f.legalEntities, scope.legalEntities),
    )
  )
}

/** Which capability a binding's DATA needs. Not which one opens the canvas. */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export function contentCapabilityFor(
  binding: CardBinding,
): Capability | ContentCapabilityUndefined | null {
  switch (binding.kind) {
    case 'static_text':
      return null
    case 'metric':
    case 'series':
      return METRIC_CAPABILITY[binding.metric]
    case 'meter':
      /** No `view_usage` verb exists. See CONTENT_CAPABILITY_UNDEFINED. */
      return CONTENT_CAPABILITY_UNDEFINED
    case 'exception_rows':
      return 'view_exception'
    case 'run_rows':
      /** No `view_run` verb exists. `trigger_run` is `configuration` and wrong. */
      return CONTENT_CAPABILITY_UNDEFINED
  }
}

/**
 * Resolve ONE card for ONE viewer.
 *
 * ORDER IS DELIBERATE, on the same argument `decide()` makes: cheapest and most
 * categorical first, so the recorded reason names the structural refusal rather
 * than whichever dimension happened to be tested last. A malformed card is a
 * malformed card whoever opens it, and reporting it as a scope refusal would
 * send someone to widen a role to fix a data bug.
 *
 * THE VALUE CEILING IS CARRIED, NOT APPLIED — and this is the one judgement call
 * in the file, so it is written down rather than left in the diff.
 * `AssignmentScope.valueCeiling` bounds what an assignment may ACT on. The four
 * set dimensions bound the POPULATION. Filtering a population by an authority
 * threshold produces a figure that is neither the true total nor a labelled
 * subset: a "total exposure" tile that silently omits everything above your own
 * approval limit is a WRONG NUMBER, not a masked one, and two people comparing
 * their screens in a meeting would have no way to discover why they disagree.
 * Nothing else in this model gates a READ on the ceiling — `view_exception` does
 * not — so applying it here would be presentation inventing an access rule.
 *
 * It is returned on the resolution so a drill-through, which IS an act on a row,
 * can enforce it without a second lookup.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export function resolveCard(
  card: DashboardCard,
  viewerUserId: UserId,
  scopeFor: ScopeResolver,
): CardResolution {
  const empty = (
    reason: BindingRefusal,
    dimension: BindingDimension | null,
    capability: Capability | null,
  ): CardResolution => ({ kind: 'empty', reason, dimension, capability })

  /* --- 1. Is the saved artefact even coherent? --- */
  const binding = card.binding
  if (!CARD_KIND_BINDINGS[card.kind].includes(binding.kind)) {
    return empty(
      BINDING_REFUSALS.binding_kind_wrong_for_card_kind,
      null,
      null,
    )
  }

  /* --- 2. The card that reads nothing needs nothing. --- */
  if (binding.kind === 'static_text') return { kind: 'render_static' }

  /* --- 3. Arithmetic legality. A summed rate is wrong for everyone. --- */
  if (binding.kind === 'metric' || binding.kind === 'series') {
    if (!METRIC_AGGREGATES[binding.metric].includes(binding.aggregate)) {
      return empty(BINDING_REFUSALS.aggregate_not_legal_for_metric, null, null)
    }
  }

  /* --- 4. The CONTENT capability. Never `view_dashboard`. --- */
  const required = contentCapabilityFor(binding)
  if (required === null || required === CONTENT_CAPABILITY_UNDEFINED) {
    return empty(BINDING_REFUSALS.content_capability_not_defined, null, null)
  }
  const own = scopeFor(required)
  if (!own.granted) {
    return empty(BINDING_REFUSALS.content_capability_absent, null, required)
  }

  /**
   * --- 5. The intersection. THIS IS THE LINE THE MODULE EXISTS FOR. ---
   *
   * `own.scope` is the viewer's, resolved for THIS capability by the single
   * evaluator — not the author's, not the dashboard's, not a service account's.
   * Note it is the scope carried by the assignments that actually hold
   * `required`: `effectiveScopeFor` unions scopes only across assignments
   * carrying the requested capability, so an unscoped read-only role cannot
   * dissolve a tightly scoped one.
   */
  const f = binding.filter
  const domains = intersectDimension(f.domains, own.scope.domains)
  if (!dimensionSurvives(domains)) {
    return empty(BINDING_REFUSALS.scope_excludes_every_value, 'domains', null)
  }
  const definitionIds = intersectDimension(
    f.definitionIds,
    own.scope.definitionIds,
  )
  if (!dimensionSurvives(definitionIds)) {
    return empty(
      BINDING_REFUSALS.scope_excludes_every_value,
      'definition_ids',
      null,
    )
  }
  const costCentres = intersectDimension(f.costCentres, own.scope.costCentres)
  if (!dimensionSurvives(costCentres)) {
    return empty(
      BINDING_REFUSALS.scope_excludes_every_value,
      'cost_centres',
      null,
    )
  }
  const legalEntities = intersectDimension(
    f.legalEntities,
    own.scope.legalEntities,
  )
  if (!dimensionSurvives(legalEntities)) {
    return empty(
      BINDING_REFUSALS.scope_excludes_every_value,
      'legal_entities',
      null,
    )
  }

  const filter: ViewerScopedFilter = {
    viewerUserId,
    domains,
    definitionIds,
    costCentres,
    legalEntities,
    /** Presentation dimensions pass through. Nothing in scope bounds them. */
    severities: f.severities,
    statuses: f.statuses,
  } as ViewerScopedFilter

  return { kind: 'render', filter, actCeiling: own.scope.valueCeiling }
}

/**
 * Resolve a whole dashboard.
 *
 * THE CANVAS GATE AND THE CONTENT GATES ARE SEPARATE CALLS INTO THE SAME
 * EVALUATOR, which is the decomposition made operational. `view_dashboard` opens
 * the canvas and confers nothing else; every card then asks again, for its own
 * capability, at its own scope.
 *
 * A NOTE ON CLASSIFICATION, SINCE IT LOOKS LIKE A CONTRADICTION AND IS NOT.
 * `CAPABILITY_RESOURCE_CLASS` maps `view_dashboard` to `tenant_data`, while this
 * module argues the canvas alone is `configuration`. The mapping was made when a
 * dashboard WAS its contents, and under this decomposition it is now
 * conservative rather than wrong — it keeps a delivery grant, which
 * `PERMITTED_RESOURCES` bars from tenant data, out of the canvas as well as out
 * of the numbers. Erring closed on a classification costs an FDE one screen.
 * Erring open costs a customer their figures. Do not "correct" it without a
 * decision recorded somewhere better than a commit message.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export function resolveDashboard(
  dashboard: Dashboard,
  viewerUserId: UserId,
  scopeFor: ScopeResolver,
): DashboardResolution {
  const canvas = scopeFor('view_dashboard')
  if (!canvas.granted) {
    return {
      canvasOpen: false,
      canvasReason: BINDING_REFUSALS.canvas_capability_absent,
      /**
       * No per-card resolutions at all when the canvas is shut. Returning a
       * populated list beside `canvasOpen: false` invites a caller to render
       * from the second field and ignore the first — the failure `Decision`
       * answers by making `scope` `DENY_ALL` whenever `allowed` is false.
       */
      cards: [],
    }
  }

  return {
    canvasOpen: true,
    canvasReason: BINDING_REFUSALS.permitted,
    cards: dashboard.cards.map((card) => ({
      cardId: card.id,
      resolution: resolveCard(card, viewerUserId, scopeFor),
    })),
  }
}

/**
 * Does this dashboard read any tenant data at all?
 *
 * Answers a question the pack lifecycle needs and nothing else can: a dashboard
 * of `text` cards is pure configuration, so a rollback may revert it freely,
 * whereas one with bindings changes what people are reading and its revert is an
 * event. Also the honest answer to "is this canvas safe to show in a demo" —
 * false means no row of anybody's business is involved.
 */
/** @dropped-for-v1 7 Aug 2026 — presentation.ts drops whole for v1 — no dashboard builder, no saved views, no Panels screen. Declared, not built. */
export function dashboardReadsTenantData(dashboard: Dashboard): boolean {
  return dashboard.cards.some((c) => c.binding.kind !== 'static_text')
}
