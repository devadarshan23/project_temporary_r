/**
 * ReconcileAI — the kernel.
 *
 * THE ROOT. **This module has no import statements and must never acquire one.**
 * That single property is what makes the module graph acyclic by one grep:
 *
 *     grep -c '^import' model/kernel.ts     # must print 0
 *
 * It exists because every branded id needs exactly one home. Before this file,
 * the brand symbol and `Id<T>` lived in `domain.ts`, which meant every module
 * that wanted to mint an id imported from the largest module in the system — and
 * a new id had to be added to a 2,800-line file whose other 2,700 lines are about
 * reconciliation.
 *
 * WHY THE SYMBOL MOVES RATHER THAN BEING COPIED
 *
 * `declare const brand: unique symbol` is unique PER DECLARATION. A second one
 * here would produce a second, incompatible brand family: `Id<'Tenant'>` from
 * kernel and `Id<'Tenant'>` from domain would be different types, assignable to
 * neither each other nor anything else, and the compiler would report it as a
 * bewildering mismatch between two types that print identically. So there is one
 * symbol, it lives here, and `domain.ts` re-exports `Id` for the modules that
 * already import it from there.
 *
 * `model/identity.ts` is the opposite pole: it imports everything, is imported by
 * nothing, and holds the compile-time proofs that keep this discipline honest.
 */

declare const brand: unique symbol

/**
 * A branded string. Erased at runtime; costs nothing.
 *
 * Branded so a `TenantId` cannot be passed where a `UserId` is expected.
 *
 * ⚠️ THE BRAND ARGUMENT NAMES THE EXPORTED INTERFACE, EXACTLY. `Id<'Definition'>`
 * where the interface is `ReconciliationDefinition` compiles perfectly and breaks
 * every tool that resolves a brand back to a type — a schema generator, an ORM
 * mapping, an entity diagram. Four such mismatches were found in this model and
 * between them they broke 18 of 172 typed edges while `tsc` stayed green, because
 * a phantom brand is never resolved. `identity.ts` asserts this mechanically.
 */
export type Id<TName extends string> = string & { readonly [brand]: TName }

/**
 * The minting record in `SolutionPack` → `InstalledPack` → `Solution`.
 *
 * ADDED 7 Aug. `InstalledPack` previously had no `id` field at all, so
 * `Solution.installedPackId` was a `string | null` referring to nothing
 * addressable — the chain was typed in one direction and dangled in the other.
 * G29 then gave `Solution` two pointers at an install, origin and current, which
 * settled any remaining argument about whether the target needed an address.
 */
export type InstalledPackId = Id<'InstalledPack'>

/* ------------------------------------------------------------------ *
 * Brands that replaced naked `= string` aliases, 7 Aug
 * ------------------------------------------------------------------ *
 *
 * These four were declared `export type RoleId = string` and similar. That is
 * WORSE THAN AN UNTYPED FIELD, and the distinction is the point: a field typed
 * `string` is visibly unchecked, while a field typed `RoleId` where `RoleId =
 * string` READS AS CHECKED IN AN ACCESS REVIEW AND IS NOT. Any string in the
 * program satisfied it.
 *
 * `InstalledPack.mintedRoleIds` is the case that mattered — the field pass D moved
 * from *recorded* to **blocking** for §10.5, because a rollback reverts behaviour
 * but never authority and un-minting what a pack minted is not expressible without
 * it. It was `string[]`, beside three properly branded siblings in the same
 * interface.
 */

export type RoleId = Id<'Role'>
export type PolicyId = Id<'Policy'>
export type ScorerId = Id<'Scorer'>
export type AutonomyProposalId = Id<'AutonomyProposal'>

/* ------------------------------------------------------------------ *
 * Identifiers, consolidated here 7 Aug
 *
 * Branded so a TenantId cannot be passed where a UserId is expected.
 * Erased at runtime; costs nothing.
 * ------------------------------------------------------------------ *
 *
 * MOVED FROM `domain.ts` (21), `agents.ts` (1) and `catalog.ts` (1). Brands had
 * three homes, which is the two-vocabularies shape this codebase records as its
 * most repeated defect — and the specific hazard is spelled out on
 * `AgentDefinitionId` below: two declarations of one brand is a rename in one
 * file silently not reaching the other.
 *
 * Every source module now imports what it uses from here and RE-EXPORTS the same
 * name, so the thirteen modules that import these from `./domain` are untouched.
 * Re-pointing thirteen modules would be churn buying no property. Those
 * re-exports are load-bearing and invisible; `model/identity.ts` asserts each
 * name is still reachable down BOTH paths and resolves to the SAME type.
 */

export type AccountId = Id<'Account'>
export type PartnerId = Id<'Partner'>
export type TenantId = Id<'Tenant'>
export type UserId = Id<'User'>
export type DocumentTypeId = Id<'DocumentType'>
export type SourceDocumentId = Id<'SourceDocument'>
/**
 * ⚠️ FOUR BRAND ARGUMENTS CORRECTED 7 Aug. They named a string matching no exported
 * interface — `Id<'Definition'>` where the interface is `ReconciliationDefinition`,
 * and the same for Run, Rule and Proposal.
 *
 * The ALIAS names are deliberately shorter than the interface names and stay that
 * way; `DefinitionId` is what call sites read. Only the brand ARGUMENT changed, and
 * it is invisible at every call site because a brand is a phantom type erased at
 * runtime — which is exactly why this survived: `tsc` never resolves it, so the
 * build was green while 18 of 172 typed edges pointed at nothing resolvable.
 *
 * `model/identity.ts` now asserts this mechanically. Adding an id whose brand does
 * not name its own interface is a compile error.
 */
export type DefinitionId = Id<'ReconciliationDefinition'>
export type RunId = Id<'ReconciliationRun'>
export type MatchGroupId = Id<'MatchGroup'>
export type ExceptionId = Id<'Exception'>
export type RuleId = Id<'MatchRule'>
export type ProcedureId = Id<'Procedure'>
export type DataPlaneId = Id<'DataPlane'>
/**
 * A PLACEMENT is a decision; a `DataPlane` is an installation. Two ids because
 * they are two objects with two lifetimes — see `model/deployment.ts`.
 * Minted 18 Sep 2026.
 */
export type DataPlanePlacementId = Id<'DataPlanePlacement'>
export type CounterpartyId = Id<'Counterparty'>
export type ThreadId = Id<'CorrespondenceThread'>
export type MessageId = Id<'CorrespondenceMessage'>
export type ProposalId = Id<'ResolutionProposal'>

/* --- the operator-initiated path. Added 7 Aug 2026 (G42, G43, G44). ---
 *
 * THREE IDS, AND THE FIRST ONE'S NAME IS THE POINT. `OperatorProposalId` is a
 * DIFFERENT BRAND from `ProposalId`, so the two proposal kinds are mutually
 * unassignable at every call site — you cannot hand an operator proposal to
 * anything expecting a resolution proposal, and the compiler says so rather
 * than a reviewer. That is G44 enforced by the type system: the boundary
 * between them is *whether an `Exception` exists to anchor it*, and
 * `OperatorProposal` carries no `exceptionId` field at all.
 *
 * `EndpointReadingId` exists under G35 — a machine-produced timed record gets
 * its own identity by default — and here it earns one twice over: a reading
 * carries an `authorizationId`, and an authorisation-bearing record that
 * cannot be addressed cannot be audited (invariant 10).
 */
export type OperatorProposalId = Id<'OperatorProposal'>

/**
 * The Ask session and its turns. G46, 7 Aug 2026.
 *
 * A session is a DOCUMENT — `Ask.dc.html` commits to it: *"the working sits inline
 * where it was produced, so it can be attached to a finding and read by someone who
 * was not there"*, kept 90 days unless attached. So it is a durable, addressable row
 * and not a scratch buffer.
 *
 * ⚠️ THAT DURABILITY IS EXACTLY WHAT MAKES `AskTurn` DANGEROUS TO REPLAY. See
 * `CONTEXT_WINDOW_TURNS` in `domain.ts`.
 */
export type AskSessionId = Id<'AskSession'>
export type AskTurnId = Id<'AskTurn'>
export type OperatorProposalDecisionId = Id<'OperatorProposalDecision'>
export type EndpointReadingId = Id<'EndpointReading'>

/**
 * G184 and G205, 24 Aug 2026 — the intake lane and the artefact on it.
 *
 * `IntakeChannelId` addresses ONE CONFIGURED LANE: an upload surface, a watched
 * drop, a connector pull or a mailbox. `ArrivalId` addresses ONE ARTEFACT that
 * came down one. They are two identities because a channel that has seen forty
 * thousand files has one row and one timestamp, and nothing anywhere records
 * that file 39,998 was refused or why (G205).
 *
 * 🛑 AN `Arrival` IS A ROW, NEVER AN EVENT, AND THIS BRAND IS WHERE THAT
 * SEPARATION IS CHEAPEST TO STATE. G132's title uses "the ARRIVAL TRIGGER" for
 * the landing NOTIFICATION — the thing EventBridge delivers, which carries no
 * tenant, is infrastructure, and **has no type in this model and must not
 * acquire one**. An `ArrivalId` exists only after that notification has been
 * resolved to a tenant and a channel server-side. The seam where the two senses
 * would first be confused is `IntakeChannel.lastArrivalAt`, and the module
 * closes it by definition rather than by comment.
 *
 * ⚠️ G152's precondition travels with `ArrivalId` and is stated here because
 * this is the declaration a minting site will read: **the slug must be OPAQUE**,
 * minted from a content hash and a counter, NEVER from a filename. A filename is
 * counterparty text, and an id derived from one carries that text into every
 * refusal, log line and span attribute that names the row.
 */
export type IntakeChannelId = Id<'IntakeChannel'>
export type ArrivalId = Id<'Arrival'>

/**
 * THE JOIN KEY FOR THE WHOLE AUTHORISATION SPINE. Added 5 Aug 2026.
 *
 * Three append-only record streams existed and none of them joined:
 * `AuditEvent.actor` named who acted, `UsageRecord` named what it cost and
 * carried NO PRINCIPAL AT ALL, and `Decision.via` named what authorised it.
 * *"Who did what, under what authority, at what cost"* was three queries that
 * could not be combined, and metering could bill a tenant and a cost centre
 * while being unable to say who incurred the charge — chargeback worked,
 * accountability did not.
 *
 * The spine is NOT four services. It is one identifier that all three streams
 * carry, minted by `authorize()` in access.ts.
 *
 * It was declared in `domain.ts` because all three streams already import from
 * that module and none of them should acquire a new module edge to carry a
 * scalar. That reasoning is now served better: they import it from a module with
 * no imports of its own, and `domain.ts` re-exports it so nothing had to change.
 *
 * BRANDED DELIBERATELY. The streams already carry `runId`, `packId`,
 * `assignmentId` and `grantId` as bare strings in places; a fourth bare string
 * in the same row is one transposition away from joining the wrong two tables.
 */
export type AuthorizationGrantId = Id<'AuthorizationGrant'>

/**
 * The tenant-side operating assembly. See `Solution` in `domain.ts`.
 *
 * Branded rather than bare because it is about to appear as a SCOPE DIMENSION
 * in `AssignmentScope`, where every other dimension is either branded
 * (`DefinitionId`) or explicitly documented as opaque customer text
 * (`costCentres`, `legalEntities`). A bare string here would read as the latter.
 */
export type SolutionId = Id<'Solution'>

/**
 * DEPENDENCIES ON MODULES AUTHORED SEPARATELY, declared as opaque ids so
 * `Solution` can reference an agent and a dashboard without importing either.
 *
 * `model/agents.ts` owns `AgentDefinition` and `model/presentation.ts` owns
 * `Dashboard`. `Solution` references BY ID AND NEVER EMBEDS, so the assembly
 * typechecks whatever order the three modules land in.
 *
 * ⚠️ THE BRANDS ARE DELIBERATELY IDENTICAL TO THE OWNING MODULES' — `Id<'…'>`
 * is structural, so these two aliases and theirs are the same type and are
 * freely interchangeable. That is what makes integration a one-line change:
 * DELETE THESE TWO AND IMPORT FROM THE OWNING MODULE. Leaving both in place
 * indefinitely is the failure — two declarations of one brand is a rename in
 * one file silently not reaching the other, which is precisely the hazard
 * branding exists to prevent.
 *
 * ⚠️ STILL TRUE, AND STILL THE POINT. Consolidating into this module removed the
 * three-homes problem for the DECLARATION SITE; it did not remove this
 * duplication. `presentation.ts` declares `DashboardCardId` and `agents.ts` now
 * re-exports rather than declares, but `Dashboard`'s own id and this one are two
 * aliases naming one brand. The fix is the deletion described above, not a
 * second copy here.
 */
export type AgentDefinitionId = Id<'AgentDefinition'>
export type DashboardId = Id<'Dashboard'>

/** The agent harness's document store. Moved here from `agents.ts` 7 Aug. */
export type HarnessDocumentId = Id<'HarnessDocument'>

/** An entry in the model garden. Moved here from `catalog.ts` 7 Aug. */
export type ModelCatalogEntryId = Id<'ModelCatalogEntry'>

/* ------------------------------------------------------------------ *
 * The G35 entities, 7 Aug
 * ------------------------------------------------------------------ *
 *
 * Fourteen records that CARRIED BRANDED REFERENCES AND HAD NO ADDRESS OF THEIR
 * OWN. Each one pointed at a tenant, a plane, a partner or an entry with a
 * proper `Id<…>`, and nothing could point back — so no row could cite one, no
 * dispute could name one, and no correction could be attached to one.
 *
 * Decision G35: A MACHINE-PRODUCED TIMED RECORD GETS ITS OWN IDENTITY BY DEFAULT.
 * `docs/identity-classification.md` is the adjudicated split — 15 entities, 40
 * value objects, over the 55 interfaces the extractor found. `InstalledPack` was
 * the first and is above; these are the remaining fourteen.
 *
 * The rule that decided the OTHER forty is containment: a value object is held as
 * a field type by something that does have an address, so it is reached through
 * its holder and needs none. Nothing here is held by anything — all fourteen are
 * orphan top-level records, which is precisely why the absence went unnoticed.
 *
 * ⚠️ THE BRAND ARGUMENT NAMES THE EXPORTED INTERFACE, EXACTLY, and
 * `model/identity.ts` now proves it twice for each of these: once in the
 * brand-argument map, and once against the FIELD's declared type.
 */

/** The approval act, keyed to the proposal. See `ApprovalDecision` in domain.ts. */
export type ApprovalDecisionId = Id<'ApprovalDecision'>
/** A period's anchor of an audit or data-access chain. `governance.ts`. */
export type ChainAnchorId = Id<'ChainAnchor'>
/** A signed commission figure for one partner-period. `billing.ts`. */
export type CommissionAttestationId = Id<'CommissionAttestation'>
/** The fleet-operations view of one plane. `deployment.ts`. */
export type DataPlaneHealthId = Id<'DataPlaneHealth'>
/**
 * One liveness beat from one plane. `deployment.ts`.
 *
 * ⚠️ THE ONE THAT COSTS, AND IT IS FLAGGED RATHER THAN QUIETLY TAKEN.
 * `docs/identity-classification.md` names this as the entry to revisit first: a
 * heartbeat arrives roughly every five minutes per plane, so this is a
 * high-frequency fleet time series, and NOTHING POINTS AT AN INDIVIDUAL BEAT.
 * The natural key `(dataPlaneId, sequence)` is already unique and already
 * carried, so a surrogate id here is a column on the largest table in the model
 * that no foreign key will ever reference.
 *
 * Taken anyway, because G35 is the decision and an identity sweep that exempts
 * whatever looks expensive is not a rule, it is a preference. But recorded here
 * and at the field so THE SCHEMA PASS CAN REVISIT THIS ONE ENTRY rather than
 * reopen the policy — a per-partition key or no key at all is a storage
 * decision, and it is the kind of decision that should be made against a
 * measured row count rather than in advance.
 */
export type DataPlaneHeartbeatId = Id<'DataPlaneHeartbeat'>
/** What will happen for one erasure request. `governance.ts`. */
export type ErasurePlanId = Id<'ErasurePlan'>
/** One gate's outcome for one pack version. `evaluation.ts`. */
export type GateResultId = Id<'GateResult'>
/** The record that stopped a learning. `learning.ts`. */
export type LearningRetractionId = Id<'LearningRetraction'>
/** A user's role in a tenant. `domain.ts`. */
export type MembershipId = Id<'Membership'>
/** The evidence a nomination approver was shown. `learning.ts`. */
export type NominationReviewId = Id<'NominationReview'>
/** A pack's published quality, over seeded examples only. `evaluation.ts`. */
export type PackQualityReportId = Id<'PackQualityReport'>
/** A partner's telemetry reach into one tenant. `observability.ts`. */
export type PartnerTelemetryAccessId = Id<'PartnerTelemetryAccess'>
/** A pointer to a trace in the telemetry backend. `observability.ts`. */
export type TraceRefId = Id<'TraceRef'>
/** A plane's signed claim about one period. `billing.ts`. */
export type UsageAttestationId = Id<'UsageAttestation'>

/* ------------------------------------------------------------------ *
 * SLICE 6 — the targets of the reference sweep, 7 Aug
 * ------------------------------------------------------------------ *
 *
 * Forty-two id-shaped REFERENCE fields were `string`, `string[]` or
 * `string | null`. Branding a reference is only half a change: a
 * `SolutionPackId` pointing at a `SolutionPack` whose own `id` is `string` type-
 * checks nothing, because the target accepts every string in the program. So
 * each brand below was minted WITH the target's own `id`, in the same edit.
 *
 * ⚠️ THAT IS ALSO THE LIMIT OF WHAT WAS DONE. Eighteen of the FORTY-TWO
 * interfaces declaring a naked `id: string` are branded here, and they are
 * exactly the eighteen something now points at. The other twenty-four —
 * `UsageRecord`, `EntitlementLease`, `SubProcessor`, `BreachRecord`,
 * `SubjectIndexEntry`, `TelemetryExport`, `PolicyTemplate`, `TenantContact` and
 * the rest — are untouched, because nothing references them and branding an
 * unreferenced id buys a name and no check. That is the remaining identity
 * debt, and `grep -n '^  id: string$' model/*.ts` is the whole of its
 * detection: the extractor's `entity_without_identity` fires only where there is
 * NO id, so `id: string` reads to it as satisfied.
 */

/**
 * The catalogue pack LINE. See `SolutionPack` in domain.ts.
 *
 * ⚠️ G19: THIS IS THE PACK LINE, NEVER THE PACK VERSION. `packVersion: number`
 * stays a separate field beside every one of these — six call sites already
 * pair them, and `InstalledPack` pins `previousPackVersion` against the same
 * pair. Merging the two into one "pack version id" would leave
 * `bindingFor(pack, environment)` unable to ask about a line at all, and would
 * silently repoint every `packId` in the model from a durable line to a
 * disposable release.
 */
export type SolutionPackId = Id<'SolutionPack'>

/**
 * The customer's own connection to their own system. See `Endpoint`.
 *
 * ⚠️ WHAT THIS BRAND DOES NOT BUY, recorded because invariant 11 rests on the
 * field it was minted for. `Solution.endpointIds: EndpointId[]` stops an
 * `ExceptionId` being written there. It does NOT check that the endpoints
 * belong to the SAME TENANT as the `Solution` — the tenant is a runtime value
 * and no phantom type can read one. That is a SCHEMA OBLIGATION: a composite
 * `(tenantId, id)` foreign key, not a `(id)` one. An `Endpoint` reaches a
 * `credentialRef`, which is `bind_secret` and the one capability mapped to a
 * resource class in neither `PERMITTED_RESOURCES` list, so a cross-tenant row
 * landing in that array is the shape that matters most and the shape this
 * brand cannot see.
 */
export type EndpointId = Id<'Endpoint'>

/** A gate a pack must pass before advancing a lifecycle state. `evaluation.ts`. */
export type EvaluationGateId = Id<'EvaluationGate'>
/** One person holding one role in one tenant. `access.ts`. */
export type RoleAssignmentId = Id<'RoleAssignment'>
/** Ordered model fallback. `catalog.ts`. */
export type ModelFallbackChainId = Id<'ModelFallbackChain'>
/** One walk of one procedure step, per exception. `domain.ts`. */
export type ProcedureStepExecutionId = Id<'ProcedureStepExecution'>
/** A wholesale or retail price list. `billing.ts`. */
export type RateCardId = Id<'RateCard'>
/** Entitlements plus a rate card. `billing.ts`. */
export type PlanId = Id<'Plan'>
/** A spend ceiling with an enforcement stance. `billing.ts`. */
export type BudgetId = Id<'Budget'>
/**
 * THE BILLING PERIOD, which is NOT the reconciliation period.
 *
 * Both were `periodId: string`, in seven places and one place respectively, and
 * nothing distinguished them. `ReconciliationRun.periodId` is a customer's
 * accounting close — goods received 31 Mar, invoiced 2 Apr — while
 * `CostAttribution.periodId` is what we invoice against. They are set by
 * different parties, close on different calendars, and a bare string let either
 * be written where the other was meant.
 */
export type BillingPeriodId = Id<'BillingPeriod'>
/** A customer's closing period. See `BillingPeriodId` for why they are two brands. */
export type ReconciliationPeriodId = Id<'ReconciliationPeriod'>
/** A registered directory. The org axis derives from its owner. `domain.ts`. */
export type IdentityConnectionId = Id<'IdentityConnection'>

/* ------------------------------------------------------------------ *
 * The session line — #222 [A-2] and #223 [A-5], 22 Aug 2026
 * ------------------------------------------------------------------ *
 *
 * MG1: "There is no session type at all. All four entry routes establish, hold
 * or end one; nothing in eighteen modules declares one." These are the two
 * addresses the rows that close it need.
 *
 * 🛑 NEITHER OF THESE IS THE CREDENTIAL. `SessionId` addresses a ROW and is what
 * an `AuditEvent` cites; it is never presented by a caller. The presented value
 * is a handle, and what the row stores is its digest — `SessionHandleDigest` in
 * `domain.ts`, which is a branded VALUE rather than an `Id<>` because there is
 * no `SessionHandle` entity and minting a table for a derived string is the
 * defect `model/learning.ts` records under `NormalisedDescription`.
 */

/**
 * One authenticated period of work. `domain.ts`.
 *
 * The interface is `Session`, so the brand argument is `'Session'` — R3, and the
 * mismatch class this file's header describes broke 18 of 172 typed edges the
 * last time somebody named a brand after something other than its interface.
 */
export type SessionId = Id<'Session'>

/**
 * Mid-flight authentication state, between the redirect and the callback.
 * `domain.ts`.
 *
 * ⚠️ IT IS NOT A SESSION AND MUST NOT BE GIVEN A SESSION'S BRAND. A `Session`
 * begins the instant authentication SUCCEEDS; this row exists only before that
 * instant and is destroyed at it. Two brands, because a consumed attempt id
 * passed where a session id is expected is precisely the confusion that mints a
 * second session.
 */
export type SignInAttemptId = Id<'SignInAttempt'>

/**
 * A standing offer of a `Membership`, addressed to an email. `domain.ts`.
 * #235 [A-14], under G229.
 *
 * MG7: "No invitation type. No invite row, no expiry, no accept-or-decline
 * transition. `/invite` draws a flow whose state has nowhere to live."
 *
 * 🛑 IT IS AN ENTITY AND NOT A VALUE OBJECT, AND THE REASON IS G229 RATHER THAN
 * G35's timed-record default. The `AuthorizationGrant` the inviter minted names
 * this row as its `resource.resourceId` — "one grant, one thing", the binding
 * `redeemAuthorization()` calls the difference between authorising ONE act and
 * authorising the tenant's whole roster. A grant cannot point at something with
 * no address, so an invitation with no id would silently widen every invitation
 * grant in the tenant into a general one.
 *
 * ⚠️ THIS IS NOT THE CREDENTIAL EITHER, for the same reason `SessionId` is not:
 * the presented value is a handle in a link and what the row stores is its
 * digest, `Invitation.handleDigest`. An `AuditEvent` may cite this; it may not
 * cite the handle.
 */
export type InvitationId = Id<'Invitation'>
/** One scorer's verdict on one subject. `evaluation.ts`. */
export type ScoreResultId = Id<'ScoreResult'>
/** One hostile payload in the injection corpus. `evaluation.ts`. */
export type InjectionProbeId = Id<'InjectionProbe'>
/** Staff reach into one customer tenant. `governance.ts`. */
export type TenantAccessGrantId = Id<'TenantAccessGrant'>
/** The customer's opt-in to partner access. `domain.ts`. */
export type PartnerAccessGrantId = Id<'PartnerAccessGrant'>
/** An obligation to retain, overriding erasure. `governance.ts`. */
export type LegalHoldId = Id<'LegalHold'>
/** An access, correction or erasure request. `domain.ts`. */
export type DataSubjectRequestId = Id<'DataSubjectRequest'>

/**
 * ⚠️ THE ONE BRAND HERE WHOSE ARGUMENT NAMES NO EXPORTED *INTERFACE*, AND IT IS
 * REPORTED RATHER THAN HIDDEN.
 *
 * `ProcedureStepId` was `export type ProcedureStepId = string` — a naked alias,
 * in `domain.ts`, missed by slice 4's `_NoNakedStringAliases` and reported as
 * unfixed by slices 3 and 5. It is worse than an untyped field for the reason
 * recorded above: a field typed `ProcedureStepId` READS AS CHECKED AND IS NOT,
 * and it types `ProcedureStepExecution.stepId`, `DerivedAgentGrant.stepId`,
 * `ProposalActor.agent.stepId` and `CorrespondenceThread.awaitingStepId` —
 * every one of them on the agent-authority path.
 *
 * `ProcedureStep` is an exported DISCRIMINATED UNION, not an interface: each arm
 * carries its own `id: ProcedureStepId`, so the target is genuinely addressable
 * and R3 says brand it. But `tools/planner/extract.mjs` indexes `export
 * interface` only, so it now reports one `brand_without_interface` gap for this
 * name. THE GAP IS A TOOL LIMIT, NOT A MODELLING ERROR — and it is left standing
 * rather than dodged by leaving the alias naked, because a `= string` id alias
 * is the defect the extractor exists to surface, not one it should be spared.
 */
export type ProcedureStepId = Id<'ProcedureStep'>

/* ------------------------------------------------------------------ *
 * Primitives, and the one interface that belongs with them
 *
 * Moved from `domain.ts` 7 Aug, for the same reason as the ids: a module that
 * wanted a `Timestamp` had to import from the largest module in the system.
 * ------------------------------------------------------------------ */

export type Timestamp = string
export type SlotName = string
export type Json = unknown

/* ------------------------------------------------------------------ *
 * G214 — `FieldPath` IS A STRUCTURED TOKEN LIST, NOT A STRING WITH A GRAMMAR
 *
 * ⚠️ UNTIL 22 Aug 2026 THIS ALIAS WAS DECLARED `= string`, and the fact is
 * narrated here rather than deleted quietly, because a naked `FieldPath` is what
 * every other document in this record still describes.
 *
 * ⚠️ THE OLD DECLARATION IS NOT QUOTED VERBATIM ANYWHERE IN THIS FILE, AND THAT
 * IS DELIBERATE RATHER THAN COY. #237's first acceptance criterion is a
 * `grep -c` over this file for the old declaration, which must return 0 — and a
 * comment that reproduces the line it is narrating away turns that control into
 * one that can never go green. The house rule this file already follows for line numbers
 * — cite by anchor, not by copy — applies to a declaration just as well. A naked `= string` alias is WORSE
 * THAN AN UNTYPED FIELD, for the reason stated forty lines above about `RoleId`:
 * a field typed `FieldPath` READS AS CHECKED AND IS NOT. Any string in the
 * program satisfied it, so G106's unreadable-by-default rule had a refusal half
 * — `admitOne()` refuses `field_not_classified` at four sites — AND NO
 * ADDRESSING HALF. Nothing bound a `FieldSpec` to a position in a document.
 *
 * ─── THE DECIDING FACT: THE KEYS ARE COUNTERPARTY-CONTROLLED ───
 *
 * A payload is schema-agnostic JSONB and a counterparty supplies its keys. A
 * DOTTED path (`invoice.lines.0.amount`) is the cheapest thing to read on a
 * screen and it breaks on any key containing a dot — which is legal JSON, and
 * therefore will happen. ITS FAILURE MODE IS THE BAD ONE: given a document
 * holding both a literal key `payer.ref` and a nested `payer → ref`, a dotted
 * path silently addresses the WRONG key rather than refusing. That is scope
 * failing OPEN, which `docs/HANDOFF.md` §5.5 records this codebase already
 * fixing once.
 *
 * A TOKEN LIST HAS NO ESCAPING PROBLEM BECAUSE THERE IS NOTHING TO ESCAPE.
 *
 * 🛑 THE REJECTED ALTERNATIVE IS THE RESPECTABLE ONE AND IS PRESERVED AS SUCH.
 * JSON Pointer (RFC 6901) is a standard, has defined escaping for `/` and `~`,
 * survives both, and is legible in a payload trace. It was refused because its
 * correctness lives in a parse-and-unescape step AT EVERY BOUNDARY, and
 * correctness that lives at call sites is correctness that drifts — the same
 * sentence G111 uses about the money codec and G67 about `parseFxRate()`.
 *
 * ─── THE GRAMMAR, STATED ONCE, HERE ───
 *
 * A path is a NON-EMPTY, ORDERED list of segments applied left to right from
 * the root of a document.
 *
 *   · a KEY segment addresses one own-property of a JSON object, by exact
 *     bytes. No normalisation, no case folding, no trimming — a counterparty
 *     key is compared as given or it is not compared at all.
 *   · an INDEX segment addresses one element of a JSON array, by ZERO-BASED
 *     position. THE ARRAY-INDEX RULE IS EXPLICIT AND IS THE ONE A READER WOULD
 *     OTHERWISE INVENT A SPELLING FOR: an index is a `number` segment and never
 *     a numeric key. `{ kind: 'key', key: '0' }` addresses the STRING PROPERTY
 *     `"0"` of an object; `{ kind: 'index', index: 0 }` addresses the FIRST
 *     ELEMENT of an array. They are different segments and they never coincide.
 *
 * There is no wildcard, no slice, no filter and no descent operator. A path
 * addresses EXACTLY ONE position or it refuses — which is what makes "show me
 * the key in the payload" a lookup rather than a search.
 *
 * ⚠️ NOTHING BUT `model/field-path.ts` MAY CONSTRUCT ONE. The brand is not
 * decoration: it is what makes the seam the only door, because an array literal
 * does not satisfy it and a cast is greppable. `tests/model/field-path-
 * addresses-a-payload.test.ts` asserts both, over every module in `model/`.
 * ------------------------------------------------------------------ */

/**
 * One step of a `FieldPath`. A discriminated union rather than `string | number`
 * so the two kinds cannot be confused by a `typeof` that someone later relaxes,
 * and so the index rule above is carried on the value rather than in a comment.
 */
export type FieldSegment =
  | { readonly kind: 'key'; readonly key: string }
  | { readonly kind: 'index'; readonly index: number }

/**
 * A parsed, validated path. Branded, so it can only come from
 * `parseFieldPath()` in `model/field-path.ts` — the one seam.
 */
export type FieldPath = readonly FieldSegment[] & { readonly [brand]: 'FieldPath' }

/**
 * A `FieldPath` COLLAPSED TO AN IDENTITY TOKEN, so a path can key a `Map`, a
 * `Set` or a `Record`. It exists because a `FieldPath` is an ARRAY, and an array
 * keys a `Map` by REFERENCE — two structurally identical paths would be two
 * different keys, and the classification lookup that invariant 4 rests on would
 * silently miss.
 *
 * 🛑 IT IS NOT A SECOND GRAMMAR, AND THE DIFFERENCE IS THAT NOTHING PARSES IT
 * BACK. `fieldPathKey()` is the only producer and there is no reader: no
 * function in this repository takes a `FieldPathKey` and returns a `FieldPath`.
 * A grammar is a thing you can be wrong about in both directions; this is a
 * one-way fingerprint, and being wrong about it is a collision, which the
 * length-prefixed encoding makes impossible. `itemKey()` in
 * `model/reconciliation.ts` is the same device for the same reason.
 */
export type FieldPathKey = string & { readonly [brand]: 'FieldPathKey' }

/**
 * ⚠️ THE ONLY INTERFACE IN THE KERNEL, AND IT IS HERE ON A CONDITION.
 *
 * It needs `TenantId` and nothing else, so it can live beside the ids WITHOUT
 * this module acquiring an import — which is the one property `kernel.ts` must
 * never lose. Anything that would need a second import does not belong here.
 *
 * Every tenant-scoped row extends this. Invariant 1: tenant scope is DERIVED
 * FROM THE SESSION, never read from a request — this field records the scope an
 * authenticated session already established, it does not select one.
 */
export interface TenantScoped {
  tenantId: TenantId
}
