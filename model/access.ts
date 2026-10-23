/**
 * ReconcileAI — stakeholders, capabilities, roles and scope.
 *
 * Tenant-scoped, with pack-shipped defaults from the control plane.
 *
 * WHY THIS MODULE EXISTS
 *
 * `RoleKey` was a five-member enum — viewer, operator, approver, tenant_admin,
 * partner_admin — and it was doing two jobs at once, which is why it did
 * neither well:
 *
 *   1. A STAKEHOLDER'S RELATIONSHIP TO THE WORK. Whether someone creates the
 *      thing, maintains it, consumes its output, sponsors it, or oversees it.
 *   2. A CAPABILITY IN THE SYSTEM. Whether they may approve, admit, configure.
 *
 * Collapsing the two means a KYC reviewer and an accounts-payable approver are
 * both `approver`, and a pack cannot say what it actually needs. It also means
 * the stakeholders every real deployment has — a sponsor who must be kept in
 * the loop, a security officer who must see the audit trail, an infrastructure
 * team that owns the account — have no representation at all, because none of
 * them fits an operating role.
 *
 * Four layers, each a closed set defined by the one above. Same discipline as
 * archetype -> domain -> pack -> tenant, and for the same reason: a layer that
 * can invent structure the layer above did not sanction is how a configuration
 * surface becomes a policy engine nobody can reason about.
 *
 *   STAKEHOLDER CLASS  fixed, five. Relationship to the work, never permission
 *   CAPABILITY         fixed, platform-defined. What policy actually gates on
 *   ROLE               composed by a pack or a tenant. Never invents a capability
 *   ASSIGNMENT         user x tenant x role, optionally scoped
 *
 * Crossing all four, and stored in none of them, is the ORGANISATION AXIS —
 * platform, partner, customer. It is a property of an evaluation rather than of
 * a principal, and it is the term `decide()` was missing. See §2 below.
 *
 * THE SHAPE IS ORTHODOX AND CITABLE, not a local invention. `AssignmentScope`
 * narrowing and never widening is role-centric RBAC-A — Kuhn, Coyne & Weil,
 * *Adding Attributes to Role-Based Access Control*, IEEE Computer 43(6), June
 * 2010: attribute constraints "can only reduce permissions available to the
 * user, not expand them". Azure RBAC conditions "filter down" and cannot deny;
 * an AWS SCP grants no permission and yields the logical intersection. A "deny"
 * scope dimension is refused permanently, on that monotonicity argument.
 */

import type {
  AuthorizationGrantId,
  DefinitionId,
  DeploymentMode,
  DomainKey,
  IdentityConnection,
  Membership,
  Money,
  PartnerId,
  RegionKey,
  Session,
  SolutionId,
  Tenant,
  TenantEnvironment,
  TenantId,
  TenantScoped,
  Timestamp,
  User,
  UserId,
} from './domain'
/**
 * The join in §2 below. Imported as a type so there is no runtime edge between
 * the two modules — governance owns the class vocabulary, access owns which
 * capability lands in which class, and neither may quietly redefine the other.
 */
import type { AccessPurpose, AccessResourceClass, TenantAccessGrantId } from './governance'
/**
 * ⚠️ THE SENTENCE ABOVE SAID *"so there is no runtime edge between the two
 * modules"* AND THAT PROPERTY ENDS HERE, ON 19 Sep 2026, UNDER **G289**. It is
 * corrected rather than deleted because it is the sentence a reader would have
 * trusted before adding an import.
 *
 * 🛑 READ WHICH HALF ENDED. The property that MATTERED — *"neither may quietly
 * redefine the other"* — is STRENGTHENED by this line, not weakened: `decide()`'s
 * platform arm must refuse `statutory` *"at any price"* (invariant 8) and must
 * refuse a contract-only class, and the only two ways to do that are to READ
 * governance's two lists or to RESTATE them here. Restating them is the defect
 * this module names by its own rule at `capabilitiesInPartnerScope()` — *"Two
 * encodings of one rule are two encodings that can disagree with no tiebreak
 * written anywhere"* — and G75 is the worked example of what a second,
 * unnamed list costs: `secret` sat in `NON_DELEGABLE_RESOURCES` while G60 was
 * recorded as applied, and the ruling was INERT for eight days. What ended is
 * the incidental no-runtime-edge property. What survives is the ownership.
 *
 * ⚠️ AND THERE IS NO CYCLE, WHICH IS WHY THIS IS SAFE TO DO AT ALL.
 * `model/governance.ts` reaches back with `import type { OrgClass } from
 * './access'` and `verbatimModuleSyntax` ERASES that specifier before the
 * loader sees it, so the runtime edge is one-directional. Derive it rather than
 * believing this line: `grep -n "from './access'" model/governance.ts` must show
 * `import type` and nothing else. If a value import ever lands there, this line
 * becomes a load-time cycle and `tests/model/runtime-importability.test.ts` is
 * what will say so.
 *
 * 🛑 THE `.ts` EXTENSION IS LOAD-BEARING AND IS NOT A STYLE CHOICE. Node's ESM
 * resolver does not add one; on 8 Aug 2026 three of sixteen modules could not be
 * LOADED for exactly this reason while `tsc` stayed green, because every
 * inter-module import in them was `import type` and therefore erased. This is
 * the first VALUE import this module has ever had.
 */
/**
 * ⚠️ AND IT IS NO LONGER TWO NAMES. **S-21, 19 Sep 2026, under G199 and G292**
 * adds three more, and every one of them is imported for the SAME reason the
 * two above were: the staff arm in §7a must answer questions governance already
 * answers, and RESTATING an answer is the defect this module names by its own
 * rule — *"Two encodings of one rule are two encodings that can disagree with no
 * tiebreak written anywhere."*
 *
 * 🛑 `authorisationPermits` IS THE WHOLE OF G167's SURVIVING CONTENT AND IS WHY
 * THE STAFF ARM DOES NOT CONSULT A LIST DIRECTLY. G199 preserves G167's
 * requirement verbatim through its own reversal — the staff arm must test
 * *"`PERMITTED_RESOURCES`, `CONTRACT_ONLY_RESOURCES` and
 * `NON_DELEGABLE_RESOURCES` — all three, in ONE helper with ONE call site"* —
 * and this function IS that helper: it tests `NON_DELEGABLE_RESOURCES` *"FIRST,
 * before the null check, before withdrawal, before anything"*, which is the
 * ordering G75 had to be taken to discover. **A staff arm that reached for
 * `PERMITTED_RESOURCES` here and stopped would reproduce G60's defect exactly**,
 * and G199 says why the risk is higher this time rather than lower: splitting
 * the slice *"makes it easier to forget, because it is now in a different commit
 * from the reasoning."*
 *
 * ⚠️ `MAX_GRANT_HOURS` AND `hoursBetween` ARE G292's THIRD LIVENESS TERM, AND
 * THEY ARE IMPORTED RATHER THAN RE-DERIVED FOR THE SAME REASON. G292 makes the
 * duration ceiling *"a property of the PREDICATE rather than of whoever issues
 * the grant"*, and `evaluateTenantAccess()` already computes it from these two.
 * A second arithmetic here would be §5.3 — two implementations of one order, and
 * the one that drifts is always the copy.
 */
import {
  CONTRACT_ONLY_RESOURCES,
  MAX_GRANT_HOURS,
  NON_DELEGABLE_RESOURCES,
  authorisationPermits,
  hoursBetween,
} from './governance.ts'
/**
 * 🛑 ONE VALUE IMPORT, ONE CONST, AND IT IS THE HOST LAYER'S VOCABULARY RATHER
 * THAN A SECOND COPY OF IT — G726/G727, 19 Sep 2026.
 *
 * `model/serving-host.ts` owns *"which surface is this"* because it owns the
 * two registries that answer it, and §7's whole argument is that the answer is
 * a LOOKUP. Restating `'tenant' | 'console'` here would be that answer's
 * vocabulary written down twice, in the module that consumes it — the drift
 * `db/migrations/0002_run.sql` calls *"a third place to drift, and the one
 * nothing checks."*
 *
 * ⚠️ NOTHING ELSE CROSSES. This module does not import `ServingHost`,
 * `ConsoleHost`, either registry or either resolver, and it must not: a
 * resolution is the CALLER's act and `resolveSubject()` takes its answer.
 * `tests/model/console-host.test.ts` §5 sweeps these bytes for all five names.
 *
 * ⚠️ AND IT CARRIES ITS `.ts` EXTENSION, like `./governance.ts` above. A value
 * import inside `model/` that omits it is a module Node cannot load while
 * `tsc` stays green — three modules were unloadable for exactly that reason on
 * 8 Aug 2026.
 */
import { SERVED_SURFACE_KINDS } from './serving-host.ts'
/* Type-only, therefore EXTENSIONLESS, and the asymmetry with the line above is
 * the convention rather than an oversight. A type-only specifier is erased by
 * `verbatimModuleSyntax` before the loader sees it, so an extension on one
 * buys nothing; `tests/model/runtime-importability.test.ts` holds both
 * inventories so the two conventions cannot blur into one — and the same
 * suite's own comment records that a scanner reading THIS comment for a
 * specifier is a real failure mode, which is why none is quoted here. */
import type { ServedSurfaceKind } from './serving-host'

/* ------------------------------------------------------------------ *
 * 1. Stakeholder class — relationship, not permission
 * ------------------------------------------------------------------ */

/**
 * Why this person is attached to the work at all.
 *
 * Deliberately not a permission. Two people in the same class may hold
 * completely different capabilities.
 *
 * RENAMED 5 Aug 2026 (§8.1), tested against the ITIL 4 Foundation Glossary,
 * COBIT 2019, TOGAF's 22 stakeholder types, NIST SP 800-37r2's 22 roles and the
 * IIA Three Lines Model. Three of the four renames carry framework backing; the
 * fourth wins on absence of collisions. `operator` was rejected outright — zero
 * presence in any of the five, and in a technical room it means a Kubernetes
 * controller.
 */
export const STAKEHOLDER_CLASSES = {
  /**
   * Authors the thing: definitions, rules, procedures, packs.
   *
   * Weakest of the renames, and honest about it. No candidate here is framework
   * vocabulary — `creator`, `author`, `producer` and `steward` all score zero
   * across the five references. `author` wins on having no collision:
   * `producer` collides with Kafka's producer/consumer idiom, `creator` with
   * Tableau's paid-seat site role, and `steward` is well defined (NIST, DAMA)
   * and means *accountable for content quality over time* rather than *the
   * person who made this* — a category error, not a synonym.
   */
  author: 'author',
  /**
   * Keeps it working: tolerances, connectors, versions, the fleet.
   *
   * NIST SP 800-37r2 defines System Administrator as "setting up and
   * **maintaining** a system", which is this job exactly. `maintainer` scored
   * zero across all five frameworks — it is open-source vocabulary.
   *
   * GLOSS, AND IT IS LOAD-BEARING: this is NOT root. An administrator holds
   * `configure_*` and may hold `manage_users` / `manage_roles`, and holds
   * neither `approve_resolution` nor `set_autonomy` by virtue of the class.
   * Nothing here confers a capability; the class says which side of the work
   * someone stands on, and `Role.capabilities` says what they may do. A reader
   * who takes `administrator` to mean unrestricted has read a relationship as a
   * permission, which is the exact confusion the four layers exist to prevent.
   */
  administrator: 'administrator',
  /**
   * Uses the output. The exception queue is their screen.
   *
   * The word with two framework definitions — ITIL 4 "A person who uses
   * services", NIST "System User". Replaces `consumer`, which additionally
   * mis-nested the set: ITIL makes *service consumer* the umbrella that splits
   * into customer / user / sponsor, so `consumer` CONTAINED `sponsor`.
   */
  user: 'user',
  /**
   * Accountable, and not operating — the CFO who owns the close but never opens
   * an exception.
   *
   * TWO PROBLEMS, UNRESOLVED, RECORDED SO NOBODY LATER READS THEM AS OVERSIGHT.
   *
   *   1. MIS-FACTORED AS A PEER. ITIL 4 nests sponsor *inside* service consumer
   *      alongside `user`. Renaming `consumer → user` removed the containment
   *      from the names but not from the reference standard: an ITIL-literate
   *      reviewer still reads `user` and `sponsor` as two members of a set the
   *      standard says one of them belongs under.
   *   2. WRONG WORD FOR THE MEANING. `sponsor` means BUDGET AUTHORITY in every
   *      framework checked — ITIL "authorizes budget", COBIT sign-off, TOGAF
   *      project executive, ICH-GCP owner of the trial. The framework words for
   *      outcome-accountability are ITIL's *customer* and RACI's *Accountable*.
   *      Kept anyway because Microsoft uses `sponsor` for exactly the
   *      accountable-human-behind-an-agent role in Copilot Studio, and
   *      `customer` is already spoken for by the commercial model.
   *
   * THE PREVIOUS DOC COMMENT HERE IS NOW FALSE AND WAS DELETED. It said a
   * sponsor's role "legitimately holds zero capabilities and resolves to a
   * notification binding instead." §8.4 made the digest a first-class read —
   * masked by org, scoped on all five dimensions, classified per channel,
   * audited as a `DataAccessEvent`, residency-checked. Once the binding is
   * authorised like every other read, a recipient holding zero capabilities
   * receives NOTHING: the digest is empty. The notification stopped being an
   * alternative to capability and became governed by it. So a sponsor needs a
   * floor, and that floor is `view_summary` (§10.6) — capability 31, in no
   * partner mask.
   */
  sponsor: 'sponsor',
  /**
   * Secondary stakeholders. A customer's security officer, an infrastructure
   * team that owns the AWS account, an internal auditor. Not operating, not
   * sponsoring, and frequently not finance people at all — but they must be
   * reachable and some of them must see the audit trail.
   *
   * The IIA, Basel, OCC, MAS and ISACA all use `assurance` for independent
   * non-operating verification, and COBIT names an objective MEA04 Managed
   * Assurance. CONDITIONAL ON THE MEANING HOLDING: this class means *verifies
   * without operating*. If it ever comes to mean *the body that accepts
   * accountability*, the IIA's word for that is `oversight` and the rename
   * should be reverted rather than the meaning stretched.
   */
  assurance: 'assurance',
} as const
export type StakeholderClass =
  (typeof STAKEHOLDER_CLASSES)[keyof typeof STAKEHOLDER_CLASSES]

/* ------------------------------------------------------------------ *
 * 2. Organisation class — a property of an evaluation, stored nowhere
 * ------------------------------------------------------------------ */

/**
 * WHOSE ORGANISATION IS ASKING. The axis that cut across every layer here and
 * was represented in none of them.
 *
 * NOT A FIELD ON `Role`, and not stored anywhere. It is a property of an
 * EVALUATION, derived from `(principal, tenant)` at session establishment from
 * the owner of the identity connection the principal authenticated through
 * (§9.2): `connection.owner.kind` is `platform | partner | customer`, one owner
 * per connection, two organisations may never share one. Derivation is total —
 * a customer with no directory of its own gets a managed fallback pool that is
 * PER ACCOUNT, so there is no exception carved into it.
 *
 * Deriving it rather than storing it is what makes it self-maintaining: leave
 * the company, lose the directory, lose the organisation, with no row for
 * anyone to remember to update. It also makes org a property of HOW YOU
 * AUTHENTICATED rather than of who you are, which is what a dual-affiliated
 * consultant — partner on Monday, customer on Tuesday — actually needs. Two
 * rules follow and are not optional: domain verification (DNS TXT) is the
 * control, because an unverified claim on a customer's domain captures both
 * those logins and the organisation they resolve to; and a realm override
 * selects which connection TRIES and never widens — arriving at the platform
 * realm cannot make anyone `platform`, only the platform connection
 * authenticating them can. Routing chooses the door; the door decides.
 *
 * WHY THIS IS A SEPARATE AXIS AND NOT A ROLE. `ROLE_KEYS.partner_admin` was an
 * ORGANISATION BAKED INTO A ROLE NAME — one enum member carrying "is a partner"
 * and "administers things" at once. That is precisely why
 * `roleCeilingForScope()` and `effectivePartnerRole()` could never be migrated
 * off `RoleKey` while the rest of the module moved: they clamp on an ordering
 * of role names that only exists because the organisation was one of the
 * names. Separate the two and the clamp becomes what it always meant — a
 * capability mask, applied per organisation, composing with any role a pack
 * invents.
 */
export const ORG_CLASSES = {
  /** 1CloudHub. Reaches a tenant only through a `TenantAccessGrant`. */
  platform: 'platform',
  /** A reseller or commission partner. Reaches a tenant only through a live
   * `PartnerAccessGrant`, and then only inside `PARTNER_CAPABILITY_MASK`. */
  partner: 'partner',
  /** The tenant's own people. The only organisation that owns its own access. */
  customer: 'customer',
} as const
export type OrgClass = (typeof ORG_CLASSES)[keyof typeof ORG_CLASSES]

/**
 * THE LAW, EXECUTABLE RATHER THAN COMMENTED.
 *
 * Only the customer row may hold a durable `RoleAssignment`. Non-customer
 * authority is a DERIVED, EXPIRING GRANT — `TenantAccessGrant` for platform
 * staff, `PartnerAccessGrant` for a partner — and an assignment that outlives
 * its grant is the failure this table exists to make unrepresentable.
 *
 * It is checked in `decide()`, not merely stated here. Before this, the rule
 * lived in prose ("being staff is not access") while
 * `Membership.partnerScope: PartnerId | null` sat on the record as a second
 * door, and the only thing closing that door was one function in another module
 * remembering to call `effectivePartnerRole()`.
 */
export const DURABLE_ASSIGNMENT_PERMITTED: Record<OrgClass, boolean> = {
  platform: false,
  partner: false,
  customer: true,
}

/**
 * WHICH DOOR THE PRINCIPAL CAME THROUGH, as a discriminant.
 *
 * Derived from `IdentityConnection['owner']` rather than restated, so a fourth
 * owner arm arrives here without anyone remembering to add it — and then fails
 * to compile at the total `Record` below, which is the whole point.
 */
export type ConnectionOwnerKind = IdentityConnection['owner']['kind']

/**
 * THE DERIVATION THAT WAS DESCRIBED IN TWO MODULES AND EXECUTED NOWHERE.
 *
 * §2 above says org class is *"derived from `(principal, tenant)` at session
 * establishment from the owner of the identity connection the principal
 * authenticated through … `connection.owner.kind` is `platform | partner |
 * customer`"*, and `IdentityConnection.owner` says *"WHO THIS DIRECTORY
 * BELONGS TO. The org axis derives from here."* Both sentences were true and
 * neither was executable — a control existing over zero call sites, which is
 * the shape the record catalogues.
 *
 * ⚠️ A TOTAL `Record` RATHER THAN A `switch` WITH A DEFAULT, AND RATHER THAN
 * `owner.kind as OrgClass`. A fourth owner arm — a regulator, an auditor, a
 * marketplace — is then a COMPILE ERROR here rather than an organisation
 * silently defaulting to one of the three. §5.10 says a total `Record` only
 * bites where something CONSTRUCTS one; this module constructs this one, one
 * line below, so it bites.
 *
 * ⚠️ AND THE IDENTITY MAP IS NOT REDUNDANCY. `owner.kind` is a discriminant on
 * a configuration row; `OrgClass` is the access axis `decide()`,
 * `redeemAuthorization()` and `PARTNER_CAPABILITY_MASK` all gate on. They
 * agree today. `owner.kind as OrgClass` would compile, and would go on
 * compiling on the day they stop agreeing — and this tree already has one bare
 * alias of `OrgClass` in another vocabulary (`TelemetryPlane`,
 * `model/observability.ts`), so the divergence is not hypothetical.
 */
export const ORG_CLASS_FOR_CONNECTION_OWNER: Record<ConnectionOwnerKind, OrgClass> = {
  platform: ORG_CLASSES.platform,
  partner: ORG_CLASSES.partner,
  customer: ORG_CLASSES.customer,
}

/**
 * Total over the three owner arms. Reads no clock, no tenant and no user.
 *
 * 🛑 INVARIANT 2 RESTS ON THIS BEING DERIVED PER REQUEST AND NEVER STORED.
 * `Session`'s docblock rules `orgClass` off the row and gives the mechanical
 * reason: `redeemAuthorization()` denies on `grant.orgClass !==
 * principal.orgClass`, and *"THAT COMPARISON HAS MEANING ONLY BECAUSE ONE SIDE
 * IS A STAMP AND THE OTHER IS FRESHLY DERIVED."* Store it and the check
 * compares a stamp against a copy of itself and passes forever.
 *
 * ⚠️ A REALM OVERRIDE SELECTS WHICH CONNECTION TRIES AND NEVER WIDENS. Arriving
 * at the platform realm cannot make anyone `platform`; only the platform
 * connection authenticating them can. Routing chooses the door; the door
 * decides — and this function is the door deciding.
 */
export function orgFor(owner: IdentityConnection['owner']): OrgClass {
  return ORG_CLASS_FOR_CONNECTION_OWNER[owner.kind]
}

/* ------------------------------------------------------------------ *
 * 3. Capability — the closed set policy gates on
 * ------------------------------------------------------------------ */

/**
 * Atomic verbs. Platform-defined, closed, and the ONLY thing a policy check
 * ever asks about.
 *
 * Adding one is a platform release, exactly as adding a predicate or a
 * procedure step kind is. A pack composes these into roles and can never
 * introduce one — which is what stops role authoring becoming a second,
 * unreviewable authorisation system.
 */
export const CAPABILITIES = {
  /* --- consuming --- */
  viewException: 'view_exception',
  /**
   * The five RUN READS — `listRuns`, `getRun`, `getRunAccount`,
   * `listRunResidue`, `listRunAllocations`. G3881, 4 Oct 2026, applying the
   * OWNER'S RULING on G3802 verbatim: *"Keep partners out: run reads open to
   * customer roles holding view_exception, but are excluded from the partner
   * capability mask; partners still see exceptions, not run residue."*
   *
   * 🛑 IT IS NEVER STORED ON A ROLE AND IT IS NEVER GRANTED. It is CARRIED by
   *    `view_exception` (`CAPABILITY_CARRIED_BY`), so every role that holds
   *    `view_exception` — seeded or tenant-authored, today or tomorrow —
   *    reaches the run reads with no seed, backfill or `role_capability` row,
   *    which is the ruling's own wording (*"customer roles holding
   *    view_exception"*) and G3801's (*"anyone who can see the register can
   *    see its runs"*).
   *
   * 🛑 AND IT IS IN NO `PARTNER_CAPABILITY_MASK` SCOPE, EVER. The mask is
   *    checked BEFORE any role is read and it intersects on THIS verb — so a
   *    partner whose role holds `view_exception`, under the strongest live
   *    grant, is refused `capability_outside_partner_mask` on every run read,
   *    while `view_exception` itself still opens the register to them. That is
   *    G173's argument restored: *"the residue is source material at LINE
   *    grain"*. G3802 had spent it; this verb buys it back without taking the
   *    register away from a partner.
   *
   * ⚠️ WHY A VERB AND NOT A LIST OF OPERATIONS IN THE GATE (G577's
   *    question). `decide()` takes a capability and never an operation, and
   *    since G911 the operation's verdict is read off ITS OWN `x-capability`.
   *    An operationId refusal list in the partner arm would be the second
   *    vocabulary G577 refused — the gate keyed on names it does not own. The
   *    refusal here is keyed on what each operation DECLARES, and the mask
   *    membership is one row of a TOTAL `Record`, so a sixth run read that
   *    names `view_run` is refused to partners with no edit at all.
   */
  viewRun: 'view_run',
  viewDocument: 'view_document',
  viewDashboard: 'view_dashboard',
  exportData: 'export_data',
  /**
   * CAPABILITY 31. Receive periodic figures by a pushed channel — the digest.
   *
   * Added 5 Aug 2026 (§10.6) into a set whose closedness is a standing
   * constraint, so the reason has to be structural rather than convenient.
   *
   * ONE CAPABILITY WAS BEING ASKED TO MEAN TWO THINGS:
   *
   *   *may open the dashboard screen*      an OPERATING act
   *   *may receive figures by email*       a DELIVERY act
   *
   * They differ in sink, in classification ceiling and in org rule. A dashboard
   * is PULLED inside a session we authorise, against a principal we just
   * evaluated, into a viewport we mask. A digest is PUSHED to a mailbox we do
   * not control, retained indefinitely, forwarded freely, and crossing a
   * residency boundary on the way out — invariant 7 says residency survives
   * inference, and an email is an egress with its own `DataClass` ceiling.
   *
   * WHY NOT REUSE `view_dashboard`. It sits inside
   * `PARTNER_CAPABILITY_MASK.exceptions_read`, so a partner would receive the
   * digest THROUGH the mask rather than around it. The partner × sponsor hole
   * is concrete: an account manager under `commercial_only` has mask `[]`,
   * holds nothing, passes every check that tests for a capability, and could
   * have been put on an exception digest carrying counterparty names and
   * amounts. A partner supporting a customer's queue may legitimately need to
   * open the screen and must not receive the mail.
   *
   * THIS CAPABILITY APPEARS IN NO `PARTNER_CAPABILITY_MASK` SCOPE, EVER. That
   * absence is the control; adding it to one silently reopens the hole.
   *
   * It is also the floor the `sponsor` class needs. Once §8.4 made the digest a
   * governed read, a zero-capability recipient received an empty digest.
   */
  viewSummary: 'view_summary',

  /* --- operating --- */
  assignException: 'assign_exception',
  proposeResolution: 'propose_resolution',
  /** The prompt-injection checkpoint. Deliberately its own capability. */
  admitCorrespondence: 'admit_correspondence',
  sendOutbound: 'send_outbound',
  advanceProcedure: 'advance_procedure',
  triggerRun: 'trigger_run',

  /* --- acting on a decision --- */
  /**
   * Carry out an approved or autonomously-authorised disposition.
   *
   * Added 5 Aug. `AgentAction` named `execute_resolution` and `close_exception`
   * and neither had a capability, so `AutonomyConfig.permittedActions` could
   * permit the two acts that actually change the ledger while the capability
   * layer had no verb to gate them. Policy and access disagreed about the only
   * acts that move money.
   */
  executeResolution: 'execute_resolution',
  closeException: 'close_exception',

  /* --- deciding --- */
  approveResolution: 'approve_resolution',
  reverseResolution: 'reverse_resolution',
  closePeriod: 'close_period',
  /** Risk appetite. Belongs to whoever answers for an auto-resolved exception. */
  setAutonomy: 'set_autonomy',

  /* --- creating --- */
  authorDefinition: 'author_definition',
  authorProcedure: 'author_procedure',
  authorRule: 'author_rule',
  installPack: 'install_pack',

  /* --- maintaining --- */
  configureTolerance: 'configure_tolerance',
  /** Read an endpoint without inheriting the right to configure it. */
  viewEndpoint: 'view_endpoint',
  configureEndpoint: 'configure_endpoint',
  configureTagPolicy: 'configure_tag_policy',
  manageUsers: 'manage_users',
  manageRoles: 'manage_roles',

  /* --- oversight --- */
  viewAudit: 'view_audit',
  viewAccessLog: 'view_access_log',
  configureTelemetry: 'configure_telemetry',
  placeLegalHold: 'place_legal_hold',
  handleSubjectRequest: 'handle_subject_request',

  /**
   * Register an IdentityConnection, verify its domains, disable it.
   *
   * CAPABILITY 32, and it existed as a HOLE rather than an omission: §9.4a
   * split `identity` out of `authority` as its own resource class precisely so
   * a delivery grant could reach SSO configuration — and there was no verb to
   * put in it. `PERMITTED_RESOURCES.delivery` already admitted `identity`
   * while `CAPABILITY_RESOURCE_CLASS` pointed no capability at it, so the class
   * was reachable and empty.
   *
   * Deliberately NOT in `authority`. The customers most likely to withhold
   * `authority` are regulated ones running their own security function, and
   * they are exactly the ones whose federation an FDE must configure during a
   * delivery engagement. Folding this into `authority` inverts §9.4a against
   * itself.
   *
   * It does NOT confer the right to change `IdentityConnection.owner`, which is
   * server-set and immutable — whoever could edit that could mint principals of
   * any organisation.
   */
  configureIdentity: 'configure_identity',

  /**
   * Bind or rotate the credential an endpoint resolves. CAPABILITY 33.
   *
   * Split out of `configure_connection` on 5 Aug, because that one verb was
   * doing three jobs with three different blast radii and a delivery grant
   * reached all of them: `configure_connection` mapped to `configuration`, and
   * `PERMITTED_RESOURCES.delivery` includes `configuration`. **A 90-day
   * delivery grant could bind the customer's ERP credentials.** That is the
   * hole §8.7 closed for the autonomy dial, still open on a higher-privilege
   * object.
   *
   * Maps to `secret`, which is in NEITHER permitted list. Tenant principals
   * only, at any grant length.
   */
  bindSecret: 'bind_secret',

  /**
   * Enable WRITE-BACK over an endpoint — posting into the foreign system.
   * CAPABILITY 34.
   *
   * Its own verb because read and write into an ERP are a cliff, not a slope:
   * post one clearing document and you have created a Financial Document in
   * the customer's ledger. The integration record says to architect them as
   * separately toggleable tiers, and `AccessMode` is the right shape applied
   * everywhere except here.
   *
   * Maps to `authority`. An FDE may declare a read-only pull during delivery
   * and may not flip the same object to write on day 60.
   */
  enableEndpointWriteback: 'enable_endpoint_writeback',

  /* --- what it cost, and what it costs --- */

  /**
   * Read the meter — usage records, attestations, token counts. CAPABILITY 35.
   *
   * MINTED 7 Aug 2026 BECAUSE THE CLASS WAS REACHABLE AND EMPTY, which is the
   * same defect `configure_identity` was minted for (§9.4a) and it had gone
   * one round further: `metering` was carved out of `commercial` on a
   * load-bearing argument — a raw `UsageRecord` is VOLUME IN THE CLEAR — and
   * then no verb was ever pointed at it. The token meter renders in the chrome
   * of EVERY screen, so the most frequently performed read in the product was
   * the one read no capability permitted. A read with no capability is a read
   * `decide()` cannot evaluate and `authorize()` cannot mint a grant for, and
   * invariant 10 says an act with no authorisation is unrecordable. The meter
   * was rendering outside the audit surface entirely.
   *
   * WHY NOT `view_dashboard`. Two independent reasons, and either alone is
   * enough. It maps to `tenant_data`, so classifying the meter under it makes
   * the meter a tenant-data read that an incident grant reaches on the strength
   * of the purpose alone. And it sits inside
   * `PARTNER_CAPABILITY_MASK.exceptions_read`, so a partner supporting a
   * customer's queue would read that customer's consumption volume through the
   * mask — the exact disclosure §8.8 spent the partner-visibility argument
   * preventing, arriving by a door nobody was watching. This is the
   * `view_summary` argument (§10.6) applied to the other end of the product.
   *
   * IT APPEARS IN NO `PARTNER_CAPABILITY_MASK` SCOPE, EVER. Same control, same
   * words, same reason: the absence is the control.
   *
   * A READ VERB AND ONLY A READ VERB. `metering` is the class defined by a
   * MISSING WRITE MODE, so there is deliberately no companion `record_usage`.
   * `UsageRecord` is immutable and unpriced (invariant 5) and is written by the
   * `system` actor kind — the one kind `AUTHORIZATION_MAY_BE_ABSENT` admits.
   * Minting a write verb here would imply a principal who may edit a meter
   * reading, and there is none: not the customer, not a partner, not us.
   */
  viewMetering: 'view_metering',

  /**
   * Read what is owed and what was agreed — plan, entitlements, subscription,
   * budgets, invoices, derived totals. CAPABILITY 36.
   *
   * MINTED 7 Aug 2026. `governance.ts` recorded the consequence at the class
   * itself: "Nothing in CAPABILITIES names a budget, an invoice or a plan, so a
   * tenant admin cannot see what they owe." A commercial relationship the
   * customer cannot inspect is not a smaller feature, it is a billing dispute
   * with no self-service answer.
   *
   * DELIBERATELY NOT ADDED TO `PARTNER_CAPABILITY_MASK`, even though
   * `commercial` is the one class whose defining rule is that a partner may
   * read it. The partner path here is NOT a capability and must not become one:
   * it is `partnerCommercialVisibility()` (billing.ts), a derivation keyed on
   * the billing ARRANGEMENT that decides, per tenant, which of four verdicts
   * applies — roster only, band only, base spend without rate, or full
   * wholesale. Putting this verb in the mask would hand a partner the TENANT'S
   * OWN view of the tenant's money and route around the verdict entirely. A
   * mask intersects capabilities; it cannot express "the band and nothing
   * inside it".
   *
   * READ ONLY, AND THE ABSENCE OF A WRITE VERB IS SCOPE RATHER THAN PRINCIPLE.
   * Setting a ceiling is a write, and `SpendConfig` is dropped for v1 (there is
   * no billing layer to enforce a ceiling through), so there is nothing for a
   * write verb to gate. When budgets get a surface, the second verb is a
   * separate decision and specifically NOT a foregone `configure_budget` on
   * `commercial`: a spend ceiling with `enforcement: 'block'` refuses new work,
   * which is a risk-appetite setting and has more in common with
   * `set_autonomy` on `authority` than with reading an invoice.
   */
  viewCommercial: 'view_commercial',

  /**
   * Promote a `LearningNomination` into a live `LearningEntry`. CAPABILITY 37.
   *
   * MINTED 9 Aug 2026 — G128. `model/learning.ts` reasoned this member into
   * existence when it was written (`learning.ts:720-778`) and then declared it
   * as a BARE STRING, `export const PROMOTE_LEARNING_CAPABILITY =
   * 'promote_learning'`, because that module may not widen a closed union
   * declared here. `grep -n 'promote_learning' model/access.ts` returned
   * nothing until this line landed. The consequence was not cosmetic:
   * `authorize()` compares `CAPABILITY_RESOURCE_CLASS[capability]` against the
   * resource's class, and a capability absent from that map has no class to
   * compare — so the act `learning.ts` calls an authority act could not be
   * authorised at all, and invariant 10 says an act with no authorisation is
   * unrecordable.
   *
   * WHY NOT `author_procedure`, WHICH IS THE OBVIOUS REUSE.
   * `CAPABILITY_RESOURCE_CLASS.author_procedure` is `configuration`, and
   * `PERMITTED_RESOURCES.delivery` includes `configuration` — so an FDE under a
   * standing 90-day delivery grant could mint learnings that change what a
   * customer's agents do unattended, with no tenant decision anywhere. That is
   * verbatim the §8.7 hole that moved `set_autonomy` and `configure_telemetry`
   * into `authority`, and it is why this is a new member rather than a reuse.
   *
   * IT APPEARS IN NO `PARTNER_CAPABILITY_MASK` SCOPE, EVER — the third verb to
   * carry that sentence, and the absence is the control. A partner operating a
   * customer's queue may propose a resolution; promoting one exception's
   * correction into a standing rule is the authority to change the customer's
   * unattended behaviour, and `effectivePartnerCapabilities()` intersects, so
   * the mask is the only thing standing between a partner role and this verb.
   *
   * ONE VERB FOR BOTH DIRECTIONS. `mayRetractLearning()` names this same
   * capability; a separate `retract_learning` was considered and refused
   * (`learning.ts:1223-1231`), on the argument `SOLUTION_CONTAINER_CAPABILITY`
   * already made for install/upgrade/disable. `RetractionMode` is on the record
   * if an access review ever needs to tell them apart.
   */
  promoteLearning: 'promote_learning',

  /**
   * Admit source material into the record, and read what admission made of it.
   * CAPABILITY 38.
   *
   * MINTED 16 Aug 2026 — **G173, applied**, not a new ruling. G173 rules that
   * *"the reader act gets its own capability, classed `tenant_data`"* and
   * verifies the premise: `trigger_run` is classed `configuration` because
   * *"running a configured job is an act on configuration, not a read of the
   * result. What the run produces is `tenant_data` and is gated by the
   * capability that reads it"* — and `authorize()` refuses a class mismatch
   * outright, so reusing `trigger_run` for a reader act does not merely read
   * oddly, IT REFUSES AT RUNTIME. G173's own count is *"capabilities are 37
   * today, so this is capability 38"*, and this is that member.
   *
   * ⚠️ ONE MEMBER, NOT TWO, AND THE FOLD IS DELIBERATE. Two holes were open on
   * the same material and each was one mint away from the other: the reader act
   * (G173) had no verb, and NOTHING IN THE THIRTY-SEVEN NAMED SUPPLYING A
   * DOCUMENT either — `createUpload` and `completeUpload` are the operations
   * that turn an untrusted blob into a `SourceDocument`, and under invariant 10
   * an act with no authorisation is unrecordable. Minting a second member
   * beside G173's would have made one of the two rows' derived number stale on
   * arrival, since both would claim to be *"capability 38"*. They are one verb
   * because they are one act at two moments: ADMISSION. The engine's own word
   * for taking source material in is admission — `admitPopulation()`,
   * `AdmissionRefusal`, and `getRunAccount`'s own description, *"what admission
   * did per side and every row it refused"*.
   *
   * WHAT IT COVERS, per operation, so the fold is auditable rather than
   * asserted: `createUpload` and `completeUpload` (the human supplies the
   * source), the reader act itself (the engine admits the source's content as
   * data — G173's subject, which has no wire operation and is reached from
   * inside a run), `listIntakeChannels` (which channels are actually delivering
   * source, read by the person who supplies it), and `getRunAccount` /
   * `listRunResidue` (what admission did, and every row it could not pair).
   *
   * ⚠️ AND `listRuns` / `getRun`, WHICH THIS LIST DID NOT NAME UNTIL 17 Aug 2026
   * WHILE CLAIMING TO BE PER-OPERATION AND AUDITABLE. They were annotated by
   * #261 for the reason recorded under WHY NOT A RUN VERB below. The list is now
   * seven wire operations and the reader act; derive the seven rather than
   * trusting this paragraph, which has been short once already:
   *
   *   awk '/operationId: /{op=$2} /x-capability: admit_source/{print op}' \
   *     docs/contracts/capability.openapi.yaml
   *
   * ⚠️ THE LAST TWO ARE READS GATED BY AN ADMISSION VERB, AND THAT IS THE
   * READ-VERB HOLE, NOT AN ARGUMENT THAT IT IS FINE. Four other declared
   * operations already sit in it — `listInstalledPacks`,
   * `listAutonomyRecommendations`, `getAutonomyRecommendation` and, until
   * `AccessMode` exists, this pair. `model/access.ts` calls `AccessMode` *"the
   * right shape applied everywhere except here"*; it is the structural answer
   * and it is larger than one capability.
   *
   * WHY NOT `view_document`, WHICH IS THE OBVIOUS REUSE. `view_document` sits in
   * `PARTNER_CAPABILITY_MASK.exceptions_operate`. The residue is addressed by
   * `ItemRef` — `(sourceDocumentId, lineIndex)` — so it is SOURCE MATERIAL AT
   * LINE GRAIN: a bank statement is one document with four hundred lines, and
   * putting that read in the mask hands a partner every line of it. Same shape
   * as §11.9a's argument for `view_metering`, at the other end of the product.
   *
   * WHY NOT `view_summary`, WHICH WAS CONSIDERED FOR THE ENGINE ACCOUNT AND
   * REFUSED BY THE OWNER. Preserved here rather than dropped: the engine account
   * is fifteen distinct refusals with fifteen distinct remedies, not a digest,
   * and `view_summary` exists so a recipient of a pushed digest holds exactly
   * the digest (§10.6).
   *
   * WHY NOT A RUN VERB. Also refused by the owner, in the same breath as *"a run
   * verb plus `view_metering`"*. `admitRun` and `rerunRun` keep `trigger_run`.
   *
   * 🛑 THIS PARAGRAPH READ *"This member names the SOURCE, never the run:
   * `listRuns` and `getRun` keep `view_dashboard`"* UNTIL 17 Aug 2026, AND THE
   * TREE HAD ALREADY REFUTED IT. It is corrected here rather than deleted,
   * because it is the sentence a reader would have trusted: it sits on the
   * declaration, which is the most trusted place a claim can sit.
   *
   * #261's authorisation pass annotated BOTH operations `admit_source`, and
   * argued it on the operation itself —
   * `docs/contracts/capability.openapi.yaml#"operationId: listRuns"`, and
   * `grep -n 'operationId: getRun$' -A 6 docs/contracts/capability.openapi.yaml`
   * for its twin. The argument is §11.9a being OBEYED rather than overridden:
   * `view_dashboard` sits inside `PARTNER_CAPABILITY_MASK.exceptions_read`, a run
   * list is `METERS.reconciliationsRun` and `Run.exceptionsRaised` is
   * `METERS.exceptionsRaised`, so annotating these two `view_dashboard` would
   * deliver through the mask exactly the volume-in-the-clear that §11.9a minted
   * `view_metering` to keep out of it.
   *
   * ⚠️ AND THE CLAUSE IN FRONT OF IT NEEDS READING, NOT JUST THE NOUN THAT WAS
   * WRONG. *"This member names the SOURCE, never the run"* is no longer true as
   * written — `admit_source` gates two RUN reads. What survives is the REASON,
   * which is G173's own sentence and is stronger than the noun: what a run
   * produces is `tenant_data` and is gated by the capability that reads its
   * source. `tools/check-doc-counts.mjs` is structurally blind to every word of
   * this, because there is no number in it.
   *
   * IT APPEARS IN NO `PARTNER_CAPABILITY_MASK` SCOPE, EVER — the fourth verb to
   * carry that sentence. G173 requires the absence be asserted BY NAME and never
   * by a length; `PARTNER_MASK_MEMBERSHIP` below records it as an explicit `[]`
   * rather than as an omission, which is the same discipline written into the
   * type.
   */
  admitSource: 'admit_source',

  /* --- the platform's own surface: the fleet, and the catalogue it ships ---
   *
   * 🛑 FIVE MEMBERS THAT NO TENANT PRINCIPAL MAY EVER HOLD, AND THAT SENTENCE
   *    IS A CONTROL RATHER THAN A DESCRIPTION — G601, 19 Sep 2026. Read
   *    `PLATFORM_ONLY_RESOURCE_CLASSES` and `decide()`'s first customer-arm
   *    branch before adding a sixth, because minting one of these into the
   *    SHARED closed set is the dangerous half of this ruling and the fence is
   *    what makes it safe.
   *
   * WHY THEY EXIST AT ALL, AND WHY THE RECORD SAID THEY MUST NOT.
   * `model/governance.ts` documents `substrate` and `catalogue` as the two
   * classes with **no capability BY STATEMENT rather than by omission**, and
   * both statements are CONDITIONAL in their own words:
   *
   *   substrate — *"A TENANT capability pointing at `substrate` would be a verb
   *   no tenant principal could ever legitimately hold … a capability is the
   *   currency of GRANTS."*
   *   catalogue — *"AUTHORING is the catalogue act, and it has no verb BECAUSE
   *   IT IS NOT A TENANT CAPABILITY."*
   *
   * Both were written on 7 Aug 2026, when the only instrument that spent a
   * capability was a `RoleAssignment` inside a tenant, or a grant. **G289 built
   * a second instrument on 19 Sep 2026** — `PlatformRoleAssignment`, which
   * carries `readonly Capability[]`, extends no `TenantScoped`, and is not a
   * grant. So the two statements are still exactly true of the instrument they
   * were written about, and they are no longer exhaustive. That is the whole
   * argument, and it is an AMENDMENT rather than a reversal: neither sentence
   * is deleted, and both are corrected in place at their own entries.
   *
   * 🛑 WHAT WOULD HAVE MADE THIS UNSAFE, STATED BECAUSE A NAIVE MINTING MISSES
   *    IT. `Capability` is ONE closed set and `decide()`'s customer arm tests
   *    `role.capabilities.includes(capability)` and nothing else. A member
   *    minted here with no further work is one a tenant-authored `Role` could
   *    carry — and `model/access.ts` already records, at
   *    `CAPABILITY_STAKEHOLDER_CLASSES`, that *"a tenant-authored `Role` is
   *    checked by NONE of this."* So minting alone would have handed a customer
   *    administrator a verb over the FLEET. The fence is the other half of this
   *    commit, it is derived from the RESOURCE CLASS rather than from a list of
   *    verb names (G577's ruling, applied one axis over), and
   *    `tests/model/platform-only-capabilities.test.ts` witnesses it.
   */

  /**
   * THE FLEET, READ. Which tenants exist, on which plane, under which licence,
   * in which region — `listTenants` and the licence position behind it.
   *
   * ⚠️ IT IS NOT A READ INTO A TENANT AND MUST NEVER BECOME ONE.
   * `PLATFORM_ASSIGNMENT_REACHES.tenant_data` is `false` and stays `false`; the
   * roster is the SUBSTRATE record — plane, licence, residency, mode — which
   * `governance.ts` calls *"the plane the tenant runs on, and its licence to
   * run"*. The moment an operation gated on this verb returns an exception, a
   * document, a figure or a counterparty it has left the class, and the gate it
   * needs is a `TenantAccessGrant`.
   */
  viewSubstrate: 'view_substrate',
  /**
   * THE FLEET, CHANGED. Creating a tenant, and opening a hosted-to-BYOA move —
   * the two acts that decide what plane a tenant runs on.
   *
   * 🛑 A NAMED LIMIT RATHER THAN A CLEAN VERB, AND IT IS `substrate`'s OWN
   * SECOND ARGUMENT SURVIVING G601. That class entry reads: *"Under BYOA the
   * customer holds root on the account, so a grant here is a request rather
   * than a control."* That is a DIFFERENT argument from the tenant-capability
   * one above and **G289 does not touch it**. For a HOSTED tenant this verb is
   * a control: 1CloudHub holds the account and the act really is ours. For a
   * BYOA tenant it is a request wearing the costume of one. **G36 slips BYOA to
   * v1+1 and `grep -rn 'byoa' db/migrations/` returns nothing**, so there is no
   * BYOA tenant for the verb to be wrong about today — and the commit that
   * lands one owes the re-argument rather than inheriting this entry.
   */
  provisionSubstrate: 'provision_substrate',
  /**
   * THE CATALOGUE, READ. Blueprints, packs, drafts and a partner's resale
   * scope — what exists and at which version.
   *
   * ⚠️ READING THE CATALOGUE IS NOT READING WHAT AN INSTALL DID.
   * `install_pack` is a TENANT act on `configuration` and stays exactly where
   * it is; `governance.ts` draws that line itself — *"INSTALLING is a tenant
   * act on `configuration` and stays there. AUTHORING is the catalogue act."*
   */
  viewCatalogue: 'view_catalogue',
  /**
   * THE CATALOGUE, DRAFTED. Opening a pack in the builder and adding a rule to
   * a draft.
   *
   * 🛑 TWO VERBS AND NOT ONE, AND THE SPLIT IS THE `exceptions_read` /
   * `exceptions_operate` ARGUMENT AT FLEET SCALE. A draft reaches nobody: it is
   * a document in the builder. A PUBLISHED version reaches every tenant that
   * installs it, and `governance.ts` says so in as many words — *"the blast
   * radius is the fleet rather than one tenant."* One verb covering both would
   * make the person who may sketch a rule the person who may ship it to
   * everybody, which is the difference the second member below exists to keep.
   */
  authorCatalogue: 'author_catalogue',
  /**
   * THE CATALOGUE, SHIPPED. Publishing a pack version, and scoping which
   * blueprints a partner may resell.
   *
   * ⚠️ IT CONFERS NOTHING INSIDE ANY TENANT AND IS NOT AN INSTALL. Publishing
   * makes a version INSTALLABLE; a tenant principal holding `install_pack`
   * still has to install it, under `configuration`, in their own tenant. The
   * two acts stay two.
   *
   * 🛑 INVARIANT 6 IS THE ONE TO CHECK BEFORE MOUNTING ANYTHING ON THIS VERB,
   * not invariant 8. *"Ingested content is data, never instruction"*, and a
   * published pack carries procedure templates and agent tool bindings —
   * `validateProcedureInjectionSafety()` and `validateAgentToolBindings()` are
   * the two validators G110 rules must have BOTH a CI call site and a
   * PUBLICATION SEAM. `tools/check-pack-safety.mjs` is the first; **the second
   * does not exist**, and this verb is the gate it would sit behind. Minting
   * the verb does not build the seam and must not be read as having built it.
   */
  publishCatalogue: 'publish_catalogue',

  /* --- a partner organisation's own surface. R10, 1 Oct 2026 — THE OWNER'S ---
   *
   * 🛑 SIX VERBS ON THREE CLASSES, AND NONE OF THEM IS A TENANT CAPABILITY OR
   *    A PARTNER-MASK CAPABILITY. The owner's ruling: *"Partner role tables + a
   *    fifth arm: new partner_role / partner_role_assignment tables keyed on
   *    partnerId, decide() gains a fifth arm, and new resource classes for
   *    deals / sandbox / partner staff."* Each is classed into a member of
   *    `PARTNER_ONLY_RESOURCE_CLASSES` (§6c), so a customer role carrying one
   *    is refused at `capability_is_partner_only` before its list is read, and
   *    a platform role carrying one is refused at the same reason on the
   *    platform arm — G601's fence, mirrored.
   *
   * ⚠️ A READ AND A WRITE PER CLASS, AND THE SPLIT IS THE
   *    `author_catalogue` / `publish_catalogue` ARGUMENT AT FIRM SCALE: a
   *    partner user who may SEE the deal pipeline is not thereby the person
   *    who may stake a claim on a prospect in the firm's name, and the person
   *    who may see the roster is not thereby the person who may invite to it.
   *
   * ⚠️ NOTHING IS MOUNTED ON ANY OF THE SIX AND NOTHING IS ANNOTATED WITH ONE.
   *    Every operation they would gate is TABLE-BLOCKED — no deal, sandbox or
   *    invitation table exists in either database — and `listPartnerPeople`
   *    is blocked one layer down on G447's administrative-reach finding.
   *    `docs/build/completion-plan.md` W5 is the per-operation table.
   */
  /** The firm's own deal registrations and their outcomes. `listDealRegistrations`. */
  viewDeals: 'view_deals',
  /**
   * Staking a claim on a prospect in the firm's name — a deal registration, or
   * a request that the platform create a trial tenant in the prospect's name.
   * `submitDealRegistration`, `requestTrialTenant`. Both assert a pre-tenant
   * relationship to the platform; neither reads or writes inside any tenant.
   */
  registerDeal: 'register_deal',
  /** The firm's own sandbox LIFECYCLE — never a read into it. `getSandboxTenant`. */
  viewSandbox: 'view_sandbox',
  /**
   * Requesting, resetting and handing back the firm's own sandbox.
   * `requestSandboxTenant`, `resetSandboxTenant`, `handBackSandboxTenant`.
   *
   * ⚠️ A REQUEST, NOT A PROVISION. Creating the plane is the platform's act on
   *    `substrate` (`provision_substrate`); this verb asks for it. A reset
   *    destroys the partner's own uploads in a tenant no customer is in.
   */
  operateSandbox: 'operate_sandbox',
  /** Who at the firm carries which portal role. `listPartnerPeople`. */
  viewPartnerStaff: 'view_partner_staff',
  /**
   * Inviting a person to a portal role in the firm. `invitePartnerPerson`.
   *
   * 🛑 IT CONFERS NOTHING IN ANY TENANT AND NOTHING OUTSIDE THE PORTAL. A
   *    partner role reaches only `PARTNER_ONLY_RESOURCE_CLASSES` — the fifth
   *    arm is entered for those classes and no others — so a partner
   *    administrator inviting a colleague cannot hand them a customer's data
   *    by composing a role, which is the escalation `canGrant()` exists to
   *    refuse on the tenant side. G266: *"the credential carries the
   *    organisation, this record carries the role."*
   */
  managePartnerStaff: 'manage_partner_staff',
} as const
export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES]

/**
 * WHICH RESOURCE CLASS EACH CAPABILITY TOUCHES. The join between this module
 * and `governance.ts` that has never existed.
 *
 * Two closed sets have been sitting beside each other since both were written —
 * `Capability` here, `AccessResourceClass` there — with `PERMITTED_RESOURCES`
 * deciding what a purpose may EVER reach and nothing at all connecting a
 * capability to a class. So the ceiling was unenforceable in the direction that
 * matters: a grant said "delivery, therefore no tenant data", a role said
 * "manage_roles", and nothing could tell that the second sat outside the first.
 * That is the verified contradiction §8.7 closed — `configuration` was defined
 * to include "policies" and `PERMITTED_RESOURCES.delivery` includes
 * `configuration`, so a 90-day delivery grant that provably could not read
 * tenant data could rewrite `AutonomyConfig`, `DataEgressConfig
 * .allowedDestinations` and `CorrespondenceConfig` — the rules deciding who
 * reaches tenant data and where it is sent — and could mint a role and leave
 * the grant model entirely.
 *
 * TOTAL BY CONSTRUCTION, WHICH IS THE POINT. `Record<Capability, …>` means a
 * thirty-EIGHTH capability that nobody classifies is a COMPILE ERROR, not a
 * capability that silently reaches everything or nothing depending on which
 * lookup found it first. The same discipline as `PERMITTED_RESOURCES` keying on
 * `AccessPurpose`.
 *
 * Read the four groupings as the answer to "what is at stake if this is
 * abused": `tenant_data` is the customer's business; `configuration` is what
 * the system does; `authority` is who may decide; `statutory` is an obligation
 * that is not the customer's to delegate and appears in no permitted list at
 * any price.
 *
 * A FIFTH GROUPING ARRIVED 7 Aug 2026 and answers a different question — not
 * "what is at stake" but "what did it cost". `metering` is the measurement and
 * `commercial` is the money derived from it, and they are two classes rather
 * than one because the measurement inverts to volume and the money does not.
 *
 * SEVEN OF THIRTEEN CLASSES NOW CARRY A CAPABILITY. The remaining four —
 * `catalogue`, `substrate`, `schedule`, `telemetry` — were left empty
 * DELIBERATELY on 7 Aug, not overlooked. Finding E1 records that an empty class
 * can be a STATEMENT rather than a gap, and three of the four are statements:
 * `catalogue` and `substrate` are reached by a platform RELEASE and not by any
 * grant, so a tenant capability pointing at either would be a verb no tenant
 * principal could ever legitimately hold; `schedule` has NO PRINCIPAL AT THE
 * MOMENT OF ACTION, so arming one must PIN a scope rather than resolve one, and
 * minting the verb before deciding how a pinned scope is represented would ship
 * a capability whose scope semantics differ silently from all thirty-seven here
 * (thirty-six until G128 added `promote_learning` on 9 Aug 2026).
 * `telemetry` is the one that is genuinely unresolved — `configure_telemetry`
 * exists and maps to `authority` on a stated argument, and `PERMITTED_RESOURCES`
 * admits `telemetry` to both purposes with no verb pointing at it. That is an
 * inconsistency rather than an open question, and HANDOFF §8 item 1g says to
 * settle it on its own rather than fold it into a minting pass.
 */
export const CAPABILITY_RESOURCE_CLASS: Record<Capability, AccessResourceClass> = {
  /* --- the customer's business: rows, documents, money, correspondence --- */
  view_exception: 'tenant_data',
  /** G3881 — a run's residue is tenant data at line grain; the partner refusal is the mask's, not the class's. */
  view_run: 'tenant_data',
  view_document: 'tenant_data',
  view_dashboard: 'tenant_data',
  export_data: 'tenant_data',
  /**
   * The digest is a read of the customer's business, delivered elsewhere.
   * Classifying it as `tenant_data` is what stops it being reached by a
   * delivery grant, which `PERMITTED_RESOURCES` bars from tenant data outright.
   */
  view_summary: 'tenant_data',
  assign_exception: 'tenant_data',
  propose_resolution: 'tenant_data',
  admit_correspondence: 'tenant_data',
  send_outbound: 'tenant_data',
  advance_procedure: 'tenant_data',
  execute_resolution: 'tenant_data',
  close_exception: 'tenant_data',
  approve_resolution: 'tenant_data',
  reverse_resolution: 'tenant_data',
  close_period: 'tenant_data',
  view_audit: 'tenant_data',
  view_access_log: 'tenant_data',

  /* --- what the system does: definitions, rules, connectors, packs --- */
  author_definition: 'configuration',
  author_procedure: 'configuration',
  author_rule: 'configuration',
  install_pack: 'configuration',
  configure_tolerance: 'configuration',
  view_endpoint: 'endpoint',
  configure_endpoint: 'endpoint',
  configure_tag_policy: 'configuration',
  /**
   * Moved from `configuration` to `authority` on 5 Aug, with the endpoint split
   * out. `TelemetryPolicy.maxDataClassInSpanAttributes` is a CLASSIFICATION
   * CEILING, and a delivery grant that set it to `sensitive_personal` alongside
   * `includeExplanations: true` — which carries verbatim extracted values —
   * turned the one class delivery is allowed to read into a full exfiltration
   * path. Delivery reaches `telemetry` by design; it must not set what lands
   * there.
   *
   * The export DESTINATION is `configure_endpoint`, and its credential is
   * `bind_secret`. Same decomposition as a connector, which is evidence the
   * decomposition is general rather than special-cased for ERPs.
   */
  configure_telemetry: 'authority',
  configure_identity: 'identity',
  bind_secret: 'secret',
  enable_endpoint_writeback: 'authority',
  /**
   * Running a configured job is an act on configuration, not a read of the
   * result. What the run produces is `tenant_data` and is gated by the
   * capability that reads it.
   */
  trigger_run: 'configuration',

  /* --- who may decide. Reachable only where the contract pre-authorises it --- */
  set_autonomy: 'authority',
  manage_users: 'authority',
  manage_roles: 'authority',
  /**
   * G128, 9 Aug 2026. `authority` and not `configuration`, and the class is the
   * whole reason the member exists rather than reusing `author_procedure` —
   * `PERMITTED_RESOURCES.delivery` admits `configuration`, so classifying a
   * learning promotion there would hand a standing 90-day delivery grant the
   * power to change a customer's unattended behaviour. Sits beside
   * `set_autonomy` deliberately: both answer "what does this tenant's system do
   * without a human", one by dial and one by learned rule.
   */
  promote_learning: 'authority',

  /* --- not the customer's to delegate, at any price --- */
  place_legal_hold: 'statutory',
  handle_subject_request: 'statutory',

  /* --- what it cost, and what it costs. Two classes, not one --- */
  /**
   * NOT `commercial`, and this entry is the one that carries the split.
   * `commercial`'s defining rule is that a partner may read it; a raw
   * `UsageRecord` is volume in the clear, and spend and rate together invert to
   * volume. One class holding both a partner-readable summary and a
   * partner-forbidden record has no defining rule left.
   */
  view_metering: 'metering',
  view_commercial: 'commercial',

  /* --- taking source material in, and reading what admission made of it --- */
  /**
   * `tenant_data`, VERBATIM FROM G173 — *"classed against what it actually
   * reads"*. Not `configuration`, and the refusal is the same one G128 recorded:
   * `PERMITTED_RESOURCES.delivery` reaches `configuration`, so a standing 90-day
   * FDE grant would acquire the ability to put documents into a customer's
   * record and read every line the engine could not pair.
   */
  admit_source: 'tenant_data',

  /* --- the platform's own surface. G601, 19 Sep 2026 ---
   *
   * 🛑 NINE OF THIRTEEN CLASSES NOW CARRY A CAPABILITY, AND THE SENTENCE ABOVE
   *    THIS RECORD SAYING *"SEVEN OF THIRTEEN"* IS CORRECTED HERE RATHER THAN
   *    DELETED, because it is the sentence that told a reader `substrate` and
   *    `catalogue` were closed by statement. **They still are, for a TENANT
   *    capability — which is exactly what both statements say — and the five
   *    members below are not tenant capabilities.** Derive the split rather
   *    than reading it:
   *    `node -e "const a=require('./model/access.ts')"` does not work on a
   *    types-only module, so use the awk the top of this file names and read
   *    `PLATFORM_ONLY_RESOURCE_CLASSES` below for the enforced half.
   */
  view_substrate: 'substrate',
  provision_substrate: 'substrate',
  view_catalogue: 'catalogue',
  author_catalogue: 'catalogue',
  publish_catalogue: 'catalogue',

  /* --- a partner organisation's own surface. R10, 1 Oct 2026 ---
   *
   * TWELVE OF SIXTEEN CLASSES NOW CARRY A CAPABILITY, and all three new ones
   * do from the commit that minted them: a class arriving EMPTY would be the
   * `schedule` / `telemetry` gap minted on purpose. `schedule` and `telemetry`
   * are still the two empty ones and still gaps rather than statements.
   */
  view_deals: 'deal',
  register_deal: 'deal',
  view_sandbox: 'sandbox',
  operate_sandbox: 'sandbox',
  view_partner_staff: 'partner_staff',
  manage_partner_staff: 'partner_staff',
}

/**
 * THE CLASSES NO TENANT PRINCIPAL MAY REACH BY ANY ROUTE — G601, 19 Sep 2026.
 *
 * 🛑 THIS IS THE FENCE THAT MAKES THE FIVE PLATFORM CAPABILITIES SAFE TO MINT
 *    INTO A SHARED CLOSED SET, AND WITHOUT IT THIS COMMIT WOULD HAVE HANDED A
 *    CUSTOMER ADMINISTRATOR A VERB OVER THE FLEET.
 *
 * `Capability` is one set. `decide()`'s customer arm tests
 * `role.capabilities.includes(capability)` and asks nothing about class; the
 * ceiling that WOULD have answered — `CAPABILITY_STAKEHOLDER_CLASSES` — says of
 * itself that *"a tenant-authored `Role` is checked by NONE of this … the
 * mechanism that would bind it is a write-time validator that does not exist."*
 * And `db/migrations/0009_identity_substrate.sql` declares
 * `tenant.role_capability.capability` as bare `text` with no closed-set
 * constraint. So the only thing standing between a row saying
 * `publish_catalogue` and a permitted fleet-wide publish is this list and the
 * branch that reads it.
 *
 * 🛑 KEYED ON THE RESOURCE CLASS AND NEVER ON A LIST OF VERB NAMES, WHICH IS
 *    **G577's RULING APPLIED ONE AXIS OVER**: *"the ceiling is asserted over
 *    the RESOURCE CLASS, derived from `CAPABILITY_RESOURCE_CLASS`, and never as
 *    a list of verb names."* G577's own reason is the one that binds here —
 *    a later reader minting a SIXTH platform capability satisfies every
 *    compiler in the tree by classing it `catalogue`, and a name list would
 *    have let that verb through while looking maintained. Classed, it is fenced
 *    the moment it is classed.
 *
 * ⚠️ THE TWO MEMBERS ARE EXACTLY THE TWO `model/governance.ts` DOCUMENTS AS
 *    HAVING NO TENANT CAPABILITY, AND THAT AGREEMENT IS ASSERTED IN BOTH
 *    DIRECTIONS by `tests/model/platform-only-capabilities.test.ts` rather than
 *    left to two hands staying in step — 0008's mirror discipline, in
 *    TypeScript. It is NOT the complement of
 *    `PLATFORM_ASSIGNMENT_REACHES`: `commercial` and `metering` are reachable
 *    by a platform assignment AND legitimately held by a tenant administrator,
 *    so the two lists answer different questions and must not be derived from
 *    each other.
 *
 * ⚠️ WHY NOT `schedule` AND `telemetry`, the other two classes with no
 *    capability. Because their emptiness is a GAP and not a statement —
 *    `governance.ts` says so at both entries, and HANDOFF §8 item 1g says to
 *    settle `telemetry` on its own. A class listed here is one whose verbs may
 *    never be tenant-held; listing an unresolved class would decide that
 *    question by side effect, in the wrong file, which is the argument
 *    `PLATFORM_ASSIGNMENT_REACHES.telemetry` already makes for itself.
 */
export const PLATFORM_ONLY_RESOURCE_CLASSES: readonly AccessResourceClass[] = [
  'substrate',
  'catalogue',
]

/**
 * Whether a capability may be held by a TENANT principal at all.
 *
 * Derived, never listed. One call site in `decide()` per non-platform arm, for
 * the reason this module states everywhere else: *"a call site reasoning
 * independently IS the vulnerability."*
 */
export function capabilityIsPlatformOnly(capability: Capability): boolean {
  return PLATFORM_ONLY_RESOURCE_CLASSES.includes(
    CAPABILITY_RESOURCE_CLASS[capability],
  )
}

/**
 * THE CLASSES ONLY A PARTNER ORGANISATION'S OWN STAFF MAY REACH — R10,
 * 1 Oct 2026, THE OWNER'S. §6c, AND THE MIRROR OF THE FENCE DIRECTLY ABOVE.
 *
 * 🛑 THE SAME HOLE G601 CLOSED, ARRIVING FROM THE OTHER SIDE. `Capability` is
 *    still one closed set, `decide()`'s customer arm still tests
 *    `role.capabilities.includes()`, and `tenant.role_capability.capability`
 *    is still bare `text`. So minting `register_deal` alone would have let a
 *    customer administrator stake a deal claim in a PARTNER's name by putting
 *    the string on a tenant role — and minting it into a platform role would
 *    let staff act as the partner firm. This list and the two branches that
 *    read it (`decide()`'s platform arm, and the fifth-arm dispatch before the
 *    tenant arms) are what close both.
 *
 * 🛑 AND THE FENCE RUNS IN THE OTHER DIRECTION BY CONSTRUCTION RATHER THAN BY
 *    A THIRD LIST: the fifth arm is ENTERED ONLY for a capability classed
 *    here, so a `PartnerRole` that names `view_exception` confers nothing at
 *    all — that capability is answered on the tenant partner arm, which reads
 *    `held` and the `PartnerAccessGrant` and never `partnerHeld`. **A partner
 *    role assignment cannot become a second door into a customer tenant**, and
 *    `tests/model/partner-staff-arm.test.ts` §3 witnesses exactly that.
 *
 * ⚠️ KEYED ON THE RESOURCE CLASS, NEVER ON VERB NAMES — G577's ruling, as
 *    above: a seventh partner verb is fenced the moment it is classed.
 *
 * ⚠️ DISJOINT FROM `PLATFORM_ONLY_RESOURCE_CLASSES`, AND THAT IS ASSERTED
 *    rather than assumed — a class on both lists would be reachable by no arm
 *    at all, which is a statement nobody would mean to make by accident.
 */
export const PARTNER_ONLY_RESOURCE_CLASSES: readonly AccessResourceClass[] = [
  'deal',
  'sandbox',
  'partner_staff',
]

/** Whether a capability is answered ONLY on `decide()`'s fifth arm. Derived, never listed. */
export function capabilityIsPartnerOnly(capability: Capability): boolean {
  return PARTNER_ONLY_RESOURCE_CLASSES.includes(
    CAPABILITY_RESOURCE_CLASS[capability],
  )
}

/* ------------------------------------------------------------------ *
 * 4. Scope — a closed set of dimensions, not arbitrary attributes
 * ------------------------------------------------------------------ */

/**
 * One dimension of a scope.
 *
 * POLARITY MATTERS AND WAS WRONG. These were `T[] | null`, with null meaning
 * unrestricted — so a freshly constructed scope was maximally permissive and
 * every failed resolution (a deleted hierarchy node, an unreachable service, a
 * defensive catch) failed OPEN. Every other failure path in this codebase fails
 * closed: `grantAllows` returns false on a missing line and explicitly treats an
 * empty nomination list as "grants nothing rather than everything";
 * `PARTNER_CAPABILITY_MASK.commercial_only` is `[]`; an empty `approverRoles` is
 * a hard stop. That polarity was not carried across, and scope is the half that
 * hierarchy, packs and agents all multiply.
 *
 * `all` must now be written down. An empty `these` denies.
 */
export type ScopeDimension<T> =
  | { kind: 'all' }
  | { kind: 'these'; values: T[] }

/**
 * How an assignment is narrowed.
 *
 * FIVE FIXED DIMENSIONS, never arbitrary key/value. Without scope, every
 * distinction becomes a separate role — "AP Approver SG", "AP Approver MY" —
 * and role counts grow multiplicatively with the org chart. With arbitrary
 * attributes we would have built a second policy engine beside the one that
 * already exists, with its own evaluation order and its own ways to be wrong.
 *
 * Dimensions CONJOIN and never disjoin: a scope that widens by adding a clause
 * is a scope nobody can read.
 */
export interface AssignmentScope {
  domains: ScopeDimension<DomainKey>
  definitionIds: ScopeDimension<DefinitionId>
  /**
   * SIX NOW, AND THE SIXTH IS THE ONE `definitionIds` WAS ALREADY DOING ONE
   * LEVEL DOWN. Added 5 Aug 2026 with `Solution`.
   *
   * "This team runs the AP three-way match and nothing else" was expressible
   * only by enumerating every definition that assembly happened to contain —
   * which is a copy of the solution's membership list, maintained by hand, in a
   * table nobody updates when the solution gains a definition. The narrowing
   * silently widened, one install at a time.
   *
   * SAME SHAPE AS THE OTHER FIVE, AND THAT IS THE WHOLE DESIGN. A
   * `ScopeDimension<SolutionId>`: no wildcards, no patterns, no membership
   * predicate that resolves at evaluation time. *"Who can approve above
   * SGD 50,000 in CC-1100"* has to stay a relational query — `id = ANY($1)` is
   * a SELECT and `id LIKE 'sol_ap%'` is not, and the reverse question is the one
   * an auditor actually asks.
   *
   * NARROWING TO A SOLUTION IS NOT BEING GRANTED ONE. This dimension INTERSECTS
   * with whatever the assignment already permits; it can only take capability
   * away. See `SOLUTION_IS_GRANTABLE` at the foot of this file for why the
   * other direction is refused permanently.
   */
  solutionIds: ScopeDimension<SolutionId>
  costCentres: ScopeDimension<string>
  /** Opaque to the platform. Never a cross-tenant identifier — see below. */
  legalEntities: ScopeDimension<string>
  /**
   * Ceiling on value the assignment may act on.
   *
   * ⚠️ A ceiling binds against nothing when the subject has no value: a KYC
   * identity mismatch has a null `valueAtRisk`, and a disposition with
   * `requiresAdjustment: false` has no adjustment. Both operands null means an
   * unbounded assignment, which is the same hole `ApprovalConfig
   * .mandatoryAtOrAboveValue` closed for the monetary case and left open for
   * the null one. A null-valued subject must route to approval, never past it.
   *
   * Single-currency within one hierarchy, enforced at write. Comparing
   * `amountMinor` across currencies is meaningless — BHD has three decimal
   * places and USD two, so equal minor units differ by ~3.8x in value.
   */
  valueCeiling: Money | null
}

/** Nothing narrowed. Stated explicitly, because it can no longer be the default. */
export const UNSCOPED: AssignmentScope = {
  domains: { kind: 'all' },
  definitionIds: { kind: 'all' },
  solutionIds: { kind: 'all' },
  costCentres: { kind: 'all' },
  legalEntities: { kind: 'all' },
  valueCeiling: null,
}

/**
 * The failure value. Any resolution that cannot complete returns this.
 *
 * A cycle in a hierarchy, a deleted node, an unreachable directory — every one
 * of those previously degraded to an all-nulls scope, which was unrestricted.
 */
export const DENY_ALL: AssignmentScope = {
  domains: { kind: 'these', values: [] },
  definitionIds: { kind: 'these', values: [] },
  solutionIds: { kind: 'these', values: [] },
  costCentres: { kind: 'these', values: [] },
  legalEntities: { kind: 'these', values: [] },
  valueCeiling: { currency: 'XXX', amountMinor: 0n, exponent: 0 },
}

/* ------------------------------------------------------------------ *
 * 5. Role — composed, never invented
 * ------------------------------------------------------------------ */

import type { RoleId } from './kernel'

/* SLICE 6 — the reference sweep's targets. Imported from `./kernel` directly
 * rather than through `./domain`: a NEW id has no re-export history to
 * preserve, and routing it through the largest module in the system is the
 * indirection slice 3 was written to end. Re-exported for the same reason the
 * older ids are — a consumer that already reads this module keeps reading it. */
import type {
  RoleAssignmentId,
  SolutionPackId,
} from './kernel'
export type {
  RoleAssignmentId,
  SolutionPackId,
} from './kernel'

export type { RoleId } from './kernel'

/**
 * Where a role came from, which decides who may edit it and whether it is
 * comparable across the fleet.
 */
export type RoleOrigin =
  /** Shipped and versioned with a pack. Evaluable, and the same everywhere. */
  | 'pack'
  /** Composed by a tenant admin to match an org chart the pack did not predict. */
  | 'tenant'
  /** The seeded defaults that replaced the old RoleKey enum. */
  | 'platform'

export interface Role extends TenantScoped {
  id: RoleId
  /** What the customer calls it: "KYC Reviewer", "AP Approver", "Close Sponsor". */
  label: string
  /**
   * Stable identifier, NAMESPACED BY PACK. Role identity is (packId, key).
   *
   * A bare key collides two ways. Two packs both shipping `approver` fight over
   * one row on upgrade — and worse, `ROLE_KEYS.approver` was the string
   * `'approver'` too, so a resolver bridging an unmigrated `RoleKey` reference
   * would treat `approverRoles: ['approver']` as satisfied by any pack's role
   * keyed `approver`. A KYC reviewer approving an AP write-off is one string
   * comparison away.
   *
   * THE SECOND HALF OF THAT SENTENCE CLOSED 7 Aug 2026: `ROLE_KEYS` and
   * `RoleKey` are deleted (tombstone in domain.ts), there is no unmigrated
   * reference left for a resolver to bridge, and no wire schema publishes the
   * five keys. THE FIRST HALF HAS NOT CLOSED and is the live risk now — two
   * packs shipping `approver` still collide unless `(packId, key)` is the
   * uniqueness constraint in the schema. Nothing in `model/` can enforce that;
   * the first migration must, and `packId` is nullable here (platform and
   * tenant roles), so the constraint has to treat null as a distinct
   * namespace rather than as a wildcard.
   */
  key: string
  /**
   * Immutable on write, like Policy.version.
   *
   * Without it, a pack upgrade that adds `approve_resolution` to a role
   * silently promotes every live holder, retroactively, with no per-holder
   * event and no re-consent — and a rollback silently demotes them mid-decision.
   * Policy was given a version for exactly this reason: an auditor following a
   * bare pointer reads today's definition, not the one that decided.
   */
  version: number
  stakeholderClass: StakeholderClass
  origin: RoleOrigin
  /** Null for platform and tenant roles. */
  packId: SolutionPackId | null
  /**
   * Composed from the closed set. A tenant-origin role may hold no capability
   * the pack that shipped its neighbours could not also hold.
   */
  capabilities: Capability[]
  /**
   * Default narrowing applied to every assignment of this role, which an
   * individual assignment may narrow further and never widen.
   */
  defaultScope: AssignmentScope
  status: 'active' | 'archived'
}

/* ------------------------------------------------------------------ *
 * 5a. The `Capability[]` hole, closed — ceiling, floor, and the seeds
 * ------------------------------------------------------------------ */

/**
 * 🛑 THE HOLE THIS SECTION EXISTS FOR, STATED BEFORE THE FIX.
 *
 * `Role.capabilities` is `Capability[]` — A LIST. Adding a capability produces
 * compile errors in every total `Record<Capability, …>` in the tree, which is a
 * feature and which G128 records biting twice. But NOTHING FIRES IF A ROLE FAILS
 * TO HOLD ONE. A role missing a capability is not a compile error, not a
 * run-time error, and not a log line: `decide()` returns `DENY_ALL` with a
 * `DecisionReason` per request, which makes the failure visible ONE REQUEST AT A
 * TIME and invisible in aggregate.
 *
 * Three shapes it takes, and none of them errors:
 *
 *   - a `user` role missing `admit_correspondence` parks every
 *     `counterparty_reply` step FOREVER — `NodeParked.advanceable` is
 *     `{ const: false }` and `resumesOn` is admission — and the only symptom is
 *     exceptions ageing;
 *   - a `sponsor` role missing `view_summary` sends an EMPTY digest, which is
 *     indistinguishable from a quiet week (§8.4 made the digest a governed read,
 *     so a recipient holding nothing receives nothing);
 *   - an `administrator` role missing a pack verb can install packs and cannot
 *     list them.
 *
 * ⚠️ AND THE SUBJECT WAS EMPTY UNTIL 16 Aug 2026, WHICH IS WORSE THAN THE HOLE.
 * `RoleOrigin.platform` is documented above as *"the seeded defaults that
 * replaced the old RoleKey enum"* and THOSE DEFAULTS EXISTED NOWHERE:
 * `grep -rn 'capabilities:' model/*.ts` returned five hits and not one
 * constructed a `Role`. So any completeness check written before this section
 * iterated ZERO roles and passed — §5.6, a control that passes while asserting
 * nothing, which is strictly worse than having no control.
 *
 * WHAT CLOSES IT, and which half is a compile error versus a fixture, because
 * §5.10 says a total record only bites where something CONSTRUCTS one:
 *
 *   | Mechanism | Bites at | On what |
 *   |---|---|---|
 *   | `CAPABILITY_STAKEHOLDER_CLASSES` | COMPILE, at its own literal | ANY capability with no class verdict |
 *   | `STAKEHOLDER_CAPABILITY_FLOOR`   | COMPILE, at its own literal | a 6th stakeholder class, or an EMPTY floor |
 *   | `SEEDED_FLOOR_BEARER`            | COMPILE, at its own literal | a class with no seeded role at all |
 *   | `_EverySeededFloorBearerMeetsItsFloor` | COMPILE | a seeded role that DROPS a floor capability |
 *   | `_NoSeededRoleExceedsItsClass`   | COMPILE | a seeded role holding a capability its class may not |
 *   | `SEEDED_CAPABILITY_HOLDERS` — §5b | COMPILE, at its own literal | ANY capability with no HOLDER verdict |
 *   | `_EverySeededHolderStillHoldsIt` — §5b | COMPILE | a seed dropping a capability the index names |
 *   | `_NoSeededRoleHoldsAnUnrecordedCapability` — §5b | COMPILE | a seed gaining one the index does not name |
 *
 * The construction site for all seven is the object literal each one annotates —
 * no fixture, no call site and no test is involved in any of them, which is why
 * they are declarations here rather than assertions in `tests/`.
 *
 * ⚠️ THE TWO ROWS ABOVE READ *"a 39th capability"* UNTIL G209 ON 16 Aug 2026,
 * AND THE 39th HAD ALREADY ARRIVED WHEN THEY WERE WRITTEN — `view_endpoint`
 * merged from trunk into this branch hours earlier, which is precisely the event
 * the rows are describing. They now name the MECHANISM rather than an ordinal,
 * for the reason the record states everywhere else: a count in prose is stale
 * the moment the thing it counts moves, and these rows are about totality, which
 * does not care what the number is. The correction is narrated rather than swept
 * because the ordinal form is what a reader would otherwise have taken as an
 * up-to-date roster size. Derive the size, never read it:
 * `awk '/^export const CAPABILITIES = \{/,/^\}/' model/access.ts | grep -cE '^  [a-zA-Z]+:'`.
 *
 * ⚠️ THIS TABLE HELD FIVE ROWS AND THE PARAGRAPH ABOVE IT CLAIMED THE HOLE WAS
 * CLOSED, AND A RED TEAM SHOWED IT WAS NOT — by deleting `'trigger_run'` from
 * `SEEDED_OPERATOR` and getting a clean `tsc` and a fully green suite. The
 * remaining three rows are §5b below, which states the residual, the reason the
 * first five could not see it, and the axis that does. The claim is corrected
 * here rather than deleted, because the five-row version is the one a reader
 * would have trusted.
 *
 * ⚠️ WHAT IS STILL A FIXTURE, SAID PLAINLY: `SEEDED_PLATFORM_ROLES` ITSELF.
 * Nothing in the tree provisions a tenant, so these seven rows are witnessed by
 * `tests/model/role-capability-floor.test.mjs` and by the compile-time
 * assertions above — and by nothing that runs in production, because there is no
 * production. A tenant-authored `Role` is checked by NONE of this: the
 * capability list on a row a customer composes is still a bare list, and the
 * mechanism that would bind it is a write-time validator that does not exist.
 */

/**
 * WHICH STAKEHOLDER CLASSES MAY HOLD EACH CAPABILITY. A CEILING, NEVER A GRANT.
 *
 * Total over `Capability`, so ANY member minted without an entry here is
 * `TS1360` at this literal and must be answered — the same mechanism as
 * `CAPABILITY_RESOURCE_CLASS` and `CAPABILITY_DELEGABLE`, applied to the axis
 * that had none. ⚠️ This said *"a thirty-ninth member"* until G209 corrected it
 * on 16 Aug 2026, and the thirty-ninth had already landed by then; see the
 * narration above the table in §5.
 *
 * ⚠️ THIS CONFERS NOTHING. `STAKEHOLDER_CLASSES` says which side of the work
 * someone stands on and `Role.capabilities` says what they may do; this map says
 * only which of those pairings is COHERENT. A reader who takes an entry here for
 * a grant has read a relationship as a permission, which is the exact confusion
 * the four layers exist to prevent.
 *
 * TWO ENTRIES ARE QUOTED FROM THE RECORD RATHER THAN REASONED HERE, and they are
 * the two to check first. `STAKEHOLDER_CLASSES.administrator` reads: an
 * administrator *"holds neither `approve_resolution` nor `set_autonomy` by
 * virtue of the class."* Both accordingly omit `administrator`, and that is the
 * one place this map deliberately refuses the obvious.
 */
export const CAPABILITY_STAKEHOLDER_CLASSES = {
  /* --- the queue, which is the user's screen --- */
  view_exception: ['user', 'administrator'],
  view_run: ['user', 'administrator'],
  /** The counterparty's paper. An administrator keeps it working without reading it. */
  view_document: ['user'],
  view_dashboard: ['user', 'administrator', 'sponsor'],
  /** Bulk egress under a human's name — the person who works it or runs it. */
  export_data: ['user', 'administrator'],
  view_summary: ['sponsor', 'user', 'administrator'],
  assign_exception: ['user'],
  propose_resolution: ['user'],
  admit_correspondence: ['user'],
  send_outbound: ['user'],
  advance_procedure: ['user'],
  /**
   * `user` AND `administrator`, and the first is not an oversight. `admitRun`'s
   * own description is *"an operator presses Run at the same moment a document
   * lands"* — the class that presses it is the class whose screen it is.
   */
  trigger_run: ['user', 'administrator'],
  execute_resolution: ['user'],
  close_exception: ['user'],
  /**
   * 🛑 `administrator` IS ABSENT BY QUOTATION, NOT BY OMISSION. See the header.
   */
  approve_resolution: ['user'],
  reverse_resolution: ['user'],
  close_period: ['user', 'sponsor'],
  /**
   * 🛑 `administrator` IS ABSENT BY QUOTATION. §11.9a additionally reasons that a
   * ceiling with `enforcement: 'block'` is *"a risk-appetite setting and has more
   * in common with `set_autonomy` on `authority`"* — risk appetite belongs to the
   * class that is accountable and does not operate.
   */
  set_autonomy: ['sponsor'],

  /* --- authoring --- */
  author_definition: ['author'],
  author_procedure: ['author'],
  author_rule: ['author'],
  /** Promoting a correction into a standing rule is authoring, on `authority`. */
  promote_learning: ['author'],

  /* --- keeping it working --- */
  install_pack: ['administrator'],
  configure_tolerance: ['administrator'],
  configure_endpoint: ['administrator'],
  /**
   * ✅ RULED 16 Aug 2026 — G209, ruling 3 of 3. ⚠️ THIS WAS `[]` AND CARRIED A
   * 🛑 PROVISIONAL BANNER; the placeholder is replaced rather than quietly
   * filled, because a reader who saw the `[]` was told in writing that it was a
   * REFUSAL and not an answer, and is entitled to know which way it went.
   *
   * `administrator`, AND IT IS DERIVED RATHER THAN INVENTED. `configure_endpoint`
   * two lines above is `['administrator']`, and the two are the whole of the
   * `endpoint` resource class (`CAPABILITY_RESOURCE_CLASS`, `:658` and `:659`);
   * a class whose write verb is administrator-by-class and whose read verb were
   * wider would make the read the way around the write, which is the shape #174
   * split the verb to end rather than to reproduce.
   *
   * ⚠️ THE `user` READING WAS CONSIDERED AND REFUSED, and the argument for it is
   * kept because it is a good one: an operator chasing a failed write-back looks
   * at the destination. It is refused because this map is a CEILING and a
   * ceiling is not a work-around — an operator who needs an endpoint read is one
   * `TenantAccessGrant` away from it, and widening the class ceiling would make
   * every future `user` role able to hold it by default.
   *
   * 🛑 WHAT THIS ENTRY DOES NOT DECIDE, said plainly because the three rulings
   * of G209 are easy to read as one: the PARTNER axis is not this axis.
   * `PARTNER_MASK_MEMBERSHIP.view_endpoint` is `['exceptions_read',
   * 'exceptions_operate']` under the same G row, and a partner reaches a
   * capability through the mask and a grant, not through a stakeholder class.
   * The two answers differ on purpose.
   */
  view_endpoint: ['administrator'],
  configure_tag_policy: ['administrator'],
  configure_telemetry: ['administrator'],
  configure_identity: ['administrator'],
  manage_users: ['administrator'],
  manage_roles: ['administrator'],
  bind_secret: ['administrator'],
  enable_endpoint_writeback: ['administrator'],

  /* --- verifying without operating --- */
  view_audit: ['assurance'],
  view_access_log: ['assurance'],
  /**
   * `statutory`, and the class that may hold it is the customer's own. Invariant
   * 8 forbids a PROCESSOR reaching this class at any price; it says nothing
   * about the controller, whose obligation it is.
   */
  place_legal_hold: ['assurance'],
  handle_subject_request: ['assurance'],

  /* --- what it cost, and what it costs --- */
  view_metering: ['administrator', 'sponsor'],
  view_commercial: ['administrator', 'sponsor'],

  /* --- source material --- */
  admit_source: ['user', 'administrator'],

  /* --- the platform's own surface. G601, 19 Sep 2026 ---
   *
   * 🛑 THE FIRST EMPTY TUPLES THIS RECORD HAS EVER CARRIED, AND THE EMPTINESS
   *    IS THE ENTRY RATHER THAN A GAP IN IT. Derive that claim rather than
   *    trusting it:
   *    `awk '/^export const CAPABILITY_STAKEHOLDER_CLASSES = \{/,/satisfies Record<Capability/' model/access.ts | grep -cE '^  [a-z_]+: \[\]$'`
   *    → 5, and it returned 0 before this commit.
   *
   * `StakeholderClass` is five members — author, administrator, user, sponsor,
   * assurance — and every one of them is a position inside a CUSTOMER TENANT.
   * This record's own sentence is *"which of those pairings is COHERENT"*, and
   * there is no coherent pairing: a tenant administrator standing on the
   * customer's side of the work does not publish a pack to the fleet or create
   * another tenant.
   *
   * ⚠️ AND THIS RECORD ENFORCES NOTHING, WHICH IS WHY IT IS NOT THE FENCE.
   *    It says so about itself two paragraphs above its own declaration:
   *    *"a tenant-authored `Role` is checked by NONE of this."* The enforced
   *    half is `capabilityIsPlatformOnly()` and `decide()`'s first customer-arm
   *    branch; these five `[]`s are the DECLARATION that agrees with it, and
   *    `tests/model/platform-only-capabilities.test.ts` §3 asserts the two
   *    agree in both directions so they cannot drift.
   */
  view_substrate: [],
  provision_substrate: [],
  view_catalogue: [],
  author_catalogue: [],
  publish_catalogue: [],

  /* --- a partner organisation's own surface. R10, 1 Oct 2026 ---
   * SIX MORE EMPTY TUPLES, ON THE ARGUMENT DIRECTLY ABOVE: every
   * `StakeholderClass` is a position inside a CUSTOMER TENANT, and no customer
   * position coherently registers a partner's deal or administers a partner's
   * roster. The enforced half is `capabilityIsPartnerOnly()`. */
  view_deals: [],
  register_deal: [],
  view_sandbox: [],
  operate_sandbox: [],
  view_partner_staff: [],
  manage_partner_staff: [],
} as const satisfies Record<Capability, readonly StakeholderClass[]>

/**
 * THE FLOOR: what a class's own job is structurally impossible without.
 *
 * Total over `StakeholderClass` — a sixth class is a compile error — and each
 * entry is a NON-EMPTY tuple, so a floor cannot be silently emptied to make an
 * assertion pass. A floor is never a ceiling: a seeded role may hold more, and
 * every one of them does.
 *
 * ⚠️ DELIBERATE DOUBLE ENTRY, WITH THE TIEBREAK WRITTEN DOWN.
 * `tests/model/role-capability-floor.test.mjs` declares its own floor with its
 * own quoted reasons, and it is NOT imported from here — a test that read this
 * constant would be asserting the model against itself, which is a control that
 * passes while asserting nothing. THE TEST IS THE WITNESS AND THIS IS THE
 * MECHANISM; the test additionally requires this floor to cover its own, so
 * drift in either direction fails rather than passing quietly.
 */
export const STAKEHOLDER_CAPABILITY_FLOOR = {
  /**
   * `admit_correspondence` IS THE ONE PEOPLE WILL WANT TO DROP AND IT IS THE ONE
   * THAT CANNOT BE DROPPED — see the section header for what dropping it does.
   */
  user: [
    'view_exception',
    'view_document',
    'assign_exception',
    'propose_resolution',
    'advance_procedure',
    'admit_correspondence',
  ],
  /** *"So a sponsor needs a floor, and that floor is `view_summary` (§10.6)."* */
  sponsor: ['view_summary'],
  /** *"Keeps it working: tolerances, connectors, versions, the fleet."* */
  administrator: ['trigger_run', 'install_pack', 'configure_tolerance'],
  /** *"they must be reachable and some of them must see the audit trail."* */
  assurance: ['view_audit', 'view_access_log'],
  /** *"Authors the thing: definitions, rules, procedures, packs."* */
  author: ['author_definition', 'author_procedure', 'author_rule'],
} as const satisfies Record<
  StakeholderClass,
  readonly [Capability, ...Capability[]]
>

/**
 * A platform role BEFORE a tenant exists to scope it to.
 *
 * Derived from `Role` by `Omit` rather than restated, so a new required field on
 * `Role` is a compile error in all seven seeds at once.
 *
 * FOUR FIELDS ARE ABSENT AND EACH ABSENCE IS A DECISION. `tenantId` because a
 * seed is not tenant-scoped — it is instantiated per tenant at provisioning, and
 * a placeholder id here would be a lie the RLS predicate would later compare
 * against. `id` because `RoleId` is minted at that instantiation. `version`
 * because `Role.version` is *"immutable on write"* and a seed has not been
 * written. `status` because a seed is not active or archived; the row made from
 * it is.
 */
export type PlatformRoleSeed = Omit<
  Role,
  'id' | 'tenantId' | 'version' | 'status' | 'capabilities' | 'origin' | 'packId'
> & {
  origin: 'platform'
  packId: null
  capabilities: readonly Capability[]
}

const SEEDED_VIEWER = {
  key: 'viewer',
  label: 'Viewer',
  stakeholderClass: 'user',
  origin: 'platform',
  packId: null,
  capabilities: ['view_exception', 'view_dashboard'],
  defaultScope: UNSCOPED,
} as const satisfies PlatformRoleSeed

const SEEDED_OPERATOR = {
  key: 'operator',
  label: 'Operator',
  stakeholderClass: 'user',
  origin: 'platform',
  packId: null,
  capabilities: [
    'view_exception',
    'view_document',
    'view_dashboard',
    'assign_exception',
    'propose_resolution',
    'advance_procedure',
    'admit_correspondence',
    'admit_source',
    'send_outbound',
    'execute_resolution',
    'close_exception',
    'trigger_run',
  ],
  defaultScope: UNSCOPED,
} as const satisfies PlatformRoleSeed

const SEEDED_APPROVER = {
  key: 'approver',
  label: 'Approver',
  stakeholderClass: 'user',
  origin: 'platform',
  packId: null,
  capabilities: [
    'view_exception',
    'view_document',
    'view_dashboard',
    'approve_resolution',
    'reverse_resolution',
    'close_exception',
    'close_period',
  ],
  defaultScope: UNSCOPED,
} as const satisfies PlatformRoleSeed

const SEEDED_TENANT_ADMIN = {
  key: 'tenant_admin',
  label: 'Tenant administrator',
  stakeholderClass: 'administrator',
  origin: 'platform',
  packId: null,
  capabilities: [
    'view_exception',
    'view_dashboard',
    'export_data',
    'trigger_run',
    'admit_source',
    'install_pack',
    'configure_tolerance',
    /**
     * G209 ruling 2, 16 Aug 2026. Beside `configure_endpoint` deliberately: the
     * seed that ships the endpoint write verb ships the endpoint read verb, so
     * this role cannot configure an object it may not read. `#194` split the two
     * so that read stops being implied by write; leaving the read off the one
     * administrator seed would have left read implied by write in the only place
     * the product actually provisions.
     */
    'view_endpoint',
    'configure_endpoint',
    'configure_tag_policy',
    'configure_telemetry',
    'configure_identity',
    'manage_users',
    'manage_roles',
    'bind_secret',
    'view_metering',
    'view_commercial',
  ],
  defaultScope: UNSCOPED,
} as const satisfies PlatformRoleSeed

const SEEDED_AUTHOR = {
  key: 'author',
  label: 'Author',
  stakeholderClass: 'author',
  origin: 'platform',
  packId: null,
  capabilities: [
    'author_definition',
    'author_procedure',
    'author_rule',
    'promote_learning',
  ],
  defaultScope: UNSCOPED,
} as const satisfies PlatformRoleSeed

const SEEDED_SPONSOR = {
  key: 'sponsor',
  label: 'Sponsor',
  stakeholderClass: 'sponsor',
  origin: 'platform',
  packId: null,
  capabilities: [
    'view_summary',
    'view_dashboard',
    'view_metering',
    'view_commercial',
    'close_period',
    'set_autonomy',
  ],
  defaultScope: UNSCOPED,
} as const satisfies PlatformRoleSeed

const SEEDED_ASSURANCE = {
  key: 'assurance',
  label: 'Assurance',
  stakeholderClass: 'assurance',
  origin: 'platform',
  packId: null,
  capabilities: [
    'view_audit',
    'view_access_log',
    'place_legal_hold',
    'handle_subject_request',
  ],
  defaultScope: UNSCOPED,
} as const satisfies PlatformRoleSeed

/**
 * THE SEEDED DEFAULTS `RoleOrigin.platform` HAS NAMED SINCE 7 Aug 2026 AND WHICH
 * EXISTED NOWHERE UNTIL 16 Aug 2026.
 *
 * SEVEN, NOT FIVE, AND THE DIVERGENCE FROM THE TOMBSTONE IS THE TOMBSTONE'S OWN
 * ARGUMENT. `ROLE_KEYS`' deletion note says the five keys become *"five `Role`
 * rows of origin `platform`"*. Four of them are here — `viewer`, `operator`,
 * `approver`, `tenant_admin`. The fifth, `partner_admin`, IS DELIBERATELY NOT A
 * ROLE: the same note records it as *"an organisation baked into a role name"*,
 * replaced by `PARTNER_CAPABILITY_MASK` and `effectivePartnerCapabilities()`.
 * Seeding it would restore precisely the shape that was deleted.
 *
 * The other three — `author`, `sponsor`, `assurance` — exist because the
 * tombstone's central complaint was that *"the stakeholders every deployment
 * actually has (a sponsor who must be kept in the loop, a security officer who
 * must see the audit trail, an infrastructure team that owns the account) fitted
 * none of them, because none is an operating role."* A seed set that covers only
 * the operating classes reproduces the defect the enum was deleted for.
 *
 * ⚠️ EVERY ONE CARRIES `UNSCOPED`, AND THAT IS THE PROVISIONER'S PROBLEM, NOT A
 * CLAIM THAT IT IS SAFE. `defaultScope` is a DEFAULT an assignment may narrow
 * and never widen; a seed that shipped a narrowed scope would name domains,
 * definitions and cost centres that do not exist until a pack is installed.
 * `DENY_ALL` was considered and refused: a seed nobody can use is a seed
 * everybody replaces by hand, which is how the defaults stopped existing the
 * first time.
 */
export const SEEDED_PLATFORM_ROLES = [
  SEEDED_VIEWER,
  SEEDED_OPERATOR,
  SEEDED_APPROVER,
  SEEDED_TENANT_ADMIN,
  SEEDED_AUTHOR,
  SEEDED_SPONSOR,
  SEEDED_ASSURANCE,
] as const satisfies readonly PlatformRoleSeed[]

/**
 * WHICH SEEDED ROLE CARRIES EACH CLASS'S FLOOR.
 *
 * Total over `StakeholderClass`, so a class with NO seeded role is a compile
 * error rather than a class the floor check silently skips. That skip is the
 * §5.6 shape and it is the specific way this check would otherwise pass while
 * asserting nothing: three of the seven seeds are `user`, and a check that
 * merely asked *"does some role of this class exist"* would be satisfied by
 * `viewer`, which holds two capabilities.
 */
export const SEEDED_FLOOR_BEARER = {
  user: SEEDED_OPERATOR,
  sponsor: SEEDED_SPONSOR,
  administrator: SEEDED_TENANT_ADMIN,
  assurance: SEEDED_ASSURANCE,
  author: SEEDED_AUTHOR,
} as const satisfies Record<StakeholderClass, PlatformRoleSeed>

/**
 * The assertion helper. `T extends never` is the only form that FAILS on a
 * non-empty union — `AssertTrue<never>` would pass, because `never` is
 * assignable to everything. Same mechanism `AssertNoTextDeep` uses, and the
 * error names the offending member rather than saying `false`.
 */
type NoneOf<T extends never> = T

/**
 * 🛑 THE ASSERTION THE RULING ASKED FOR: A SEEDED ROLE THAT DROPS A FLOOR
 * CAPABILITY IS A COMPILE ERROR, AND THE ERROR NAMES IT.
 *
 * Delete `'admit_correspondence'` from `SEEDED_OPERATOR` and this line reads
 * `Type '"admit_correspondence"' does not satisfy the constraint 'never'` — the
 * capability, by name, at the declaration, with no test run and no fixture
 * loaded. That is the difference between this and the queue silently parking.
 */
export type _EverySeededFloorBearerMeetsItsFloor = NoneOf<
  FloorShortfall<StakeholderClass>
>

/** Distributes, so each class is excluded against ITS OWN bearer and no other. */
type FloorShortfall<C extends StakeholderClass> = C extends StakeholderClass
  ? Exclude<
      (typeof STAKEHOLDER_CAPABILITY_FLOOR)[C][number],
      (typeof SEEDED_FLOOR_BEARER)[C]['capabilities'][number]
    >
  : never

/**
 * The other direction: a seeded role holding a capability its stakeholder class
 * may not is a compile error naming that capability.
 *
 * Reaches EVERY seed, not just the floor bearers — `SEEDED_PLATFORM_ROLES` is a
 * const tuple precisely so `[number]` yields the union this walks.
 */
export type _NoSeededRoleExceedsItsClass = NoneOf<
  CeilingExcess<(typeof SEEDED_PLATFORM_ROLES)[number]>
>

type CeilingExcess<S extends PlatformRoleSeed> = S extends PlatformRoleSeed
  ? {
      [K in S['capabilities'][number]]: S['stakeholderClass'] extends (typeof CAPABILITY_STAKEHOLDER_CLASSES)[K][number]
        ? never
        : K
    }[S['capabilities'][number]]
  : never

/* ------------------------------------------------------------------ *
 * 5b. The residual the five above did NOT close — and the record that
 *     does
 * ------------------------------------------------------------------ */

/**
 * 🛑 A RED TEAM DEMONSTRATED THE HOLE STILL OPEN ON 16 Aug 2026, INSIDE THE
 * MECHANISM BUILT TO KILL IT, AND THE DEMONSTRATION IS QUOTED RATHER THAN
 * SUMMARISED.
 *
 * Delete `'trigger_run'` from `SEEDED_OPERATOR` — the role whose own ceiling
 * entry argues `user` must hold it, by quoting `admitRun`'s *"an operator
 * presses Run at the same moment a document lands"* — and:
 * `npx tsc -p model/tsconfig.json --noEmit` was CLEAN and every assertion in
 * both gate test files PASSED. Nothing fired.
 *
 * WHY NOTHING FIRED, PRECISELY, BECAUSE THE SHAPE MATTERS MORE THAN THE
 * INSTANCE. `_EverySeededFloorBearerMeetsItsFloor` walks
 * `STAKEHOLDER_CAPABILITY_FLOOR` and `trigger_run` is not in the `user` floor —
 * correctly, because a floor is *what a class's job is structurally impossible
 * without* and an administrator can also press Run. Assertion 4e demands only
 * that SOME seeded role hold each annotated capability, and `SEEDED_TENANT_ADMIN`
 * still held it. So the residual class is exact:
 *
 *   ANY CAPABILITY HELD BY TWO OR MORE SEEDS AND ABSENT FROM EVERY FLOOR COULD
 *   BE DROPPED FROM THE SEED THAT NEEDS IT, IN SILENCE.
 *
 * `close_exception` (operator, approver), `view_metering` and `view_commercial`
 * (tenant_admin, sponsor), `close_period` (approver, sponsor), `view_document`
 * (operator, approver) and `admit_source` (operator, tenant_admin) were all in
 * that class. The section above claimed the hole was *"closed by five
 * compile-time mechanisms"* and named this nowhere; that claim is corrected in
 * place rather than deleted, because it is the sentence a reader would have
 * trusted.
 *
 * WHAT CLOSES IT — and the axis is the point. The five above are keyed on
 * STAKEHOLDER CLASS, and the residual lives between classes. This one is keyed
 * on CAPABILITY and is TOTAL over it, so ANY capability minted without an entry
 * here is `TS1360` at this literal and must be answered with *which seeds ship
 * it* before it can exist. ⚠️ This named an ORDINAL — *"the thirty-ninth
 * capability"* — until G209 on 16 Aug 2026, by which time the thirty-ninth had
 * landed and the sentence described the past. Both directions are checked, so
 * the record cannot drift from the seeds in either direction:
 *
 *   | Mechanism | Fails on |
 *   |---|---|
 *   | `SEEDED_CAPABILITY_HOLDERS` | ANY capability with no holder verdict |
 *   | `_EverySeededHolderStillHoldsIt` | a seed DROPPING a capability recorded here |
 *   | `_NoSeededRoleHoldsAnUnrecordedCapability` | a seed GAINING one not recorded here |
 *
 * ⚠️ WHAT THIS IS NOT. It is not a floor: an entry here says *which seeds ship
 * this today*, not *which roles could not function without it*. The floor
 * answers the second question and stays where it is. It is also not a defence
 * against an edit to both sides at once — nothing is, and that is a deliberate
 * edit rather than a silent drop, which is the whole distinction the ruling
 * asked for.
 *
 * 🛑 AND THE RESIDUAL THAT SURVIVES, SAID PLAINLY RATHER THAN LEFT TO BE FOUND
 * BY THE NEXT RED TEAM: a TENANT-AUTHORED `Role` is checked by none of this.
 * Its capability list is still a bare `Capability[]`, and the mechanism that
 * would bind it is a write-time validator that does not exist.
 */

/** The seven keys, derived from the tuple so an eighth seed is one automatically. */
type SeedKey = (typeof SEEDED_PLATFORM_ROLES)[number]['key']

/** The seeds, indexed by their own key, so an assertion can name one. */
type SeedByKey = {
  [S in (typeof SEEDED_PLATFORM_ROLES)[number] as S['key']]: S
}

/**
 * WHICH SEEDED ROLES SHIP EACH CAPABILITY. THE INVERSE INDEX, AND IT IS TOTAL.
 *
 * An empty tuple is a verdict — *no seeded role ships this* — and its reason is
 * written at its own entry. Every other entry names at least one seed.
 *
 * ⚠️ THE COUNT OF EMPTY ENTRIES HAS MOVED TWICE IN ONE DAY AND BOTH MOVES ARE
 * KEPT HERE, because each is the sentence a reader would have trusted at the
 * time. It read *"there is exactly one, `enable_endpoint_writeback`"*; the merge
 * of `origin/main` made it TWO by adding `view_endpoint` with a 🛑 PROVISIONAL
 * `[]`; **G209 ruling 2 returns it to exactly one**, because `view_endpoint` now
 * ships with `tenant_admin`. The distinction that mattered while there were two
 * is the one to carry forward: an empty entry here means *a decision was taken*
 * — never *a decision is pending* — and a pending decision has no
 * representation in this record at all, which is why the provisional value had
 * to carry a banner rather than pass for a verdict.
 */
export const SEEDED_CAPABILITY_HOLDERS = {
  /* --- the queue --- */
  view_exception: ['viewer', 'operator', 'approver', 'tenant_admin'],
  /**
   * G3881 — EMPTY, AND NOT AN OVERSIGHT: `view_run` is never stored on a role.
   * It is CARRIED by `view_exception` (`CAPABILITY_CARRIED_BY`), so every seat
   * above reaches the run reads with no seed row of its own.
   */
  view_run: [],
  /** Not `viewer`. A viewer counts breaks; it does not read the counterparty's paper. */
  view_document: ['operator', 'approver'],
  view_dashboard: ['viewer', 'operator', 'approver', 'tenant_admin', 'sponsor'],
  /**
   * `tenant_admin` ALONE, AND THE CEILING DELIBERATELY PERMITS MORE. Bulk egress
   * is not an operating default; the ceiling says a `user` MAY hold it and no
   * seeded `user` role does. This is the one place the difference between MAY
   * and DOES is visible, which is why an assertion keyed on the ceiling would
   * have been wrong.
   */
  export_data: ['tenant_admin'],
  view_summary: ['sponsor'],
  assign_exception: ['operator'],
  propose_resolution: ['operator'],
  admit_correspondence: ['operator'],
  send_outbound: ['operator'],
  advance_procedure: ['operator'],
  /** 🛑 THE WORKED EXAMPLE. Dropping either name is now a compile error. */
  trigger_run: ['operator', 'tenant_admin'],
  execute_resolution: ['operator'],
  close_exception: ['operator', 'approver'],
  approve_resolution: ['approver'],
  reverse_resolution: ['approver'],
  close_period: ['approver', 'sponsor'],
  set_autonomy: ['sponsor'],

  /* --- authoring --- */
  author_definition: ['author'],
  author_procedure: ['author'],
  author_rule: ['author'],
  promote_learning: ['author'],

  /* --- keeping it working --- */
  install_pack: ['tenant_admin'],
  configure_tolerance: ['tenant_admin'],
  configure_endpoint: ['tenant_admin'],
  /**
   * ✅ RULED 16 Aug 2026 — G209, ruling 2 of 3. ⚠️ THIS WAS `[]` AND CARRIED A
   * 🛑 PROVISIONAL BANNER saying the emptiness was a refusal rather than an
   * answer; it is replaced rather than quietly filled.
   *
   * THE ADMINISTRATOR SEEDS AND ONLY THOSE, AND THE ROSTER — NOT A GUESS —
   * DECIDES WHICH THOSE ARE. `SEEDED_PLATFORM_ROLES` carries seven seeds and
   * exactly one declares `stakeholderClass: 'administrator'`: `tenant_admin`
   * (`SEEDED_TENANT_ADMIN`, `:1214`). Reproduce rather than trust this sentence:
   * `grep -n "stakeholderClass: 'administrator'" model/access.ts` → one hit. So
   * *administrator seeds only* and `['tenant_admin']` are the same list today,
   * and an eighth administrator-shaped seed would have to be added here
   * deliberately — which is the correct amount of friction for a read of the
   * tenant's integration topology.
   *
   * SYMMETRY WITH `configure_endpoint`, VERIFIED RATHER THAN ASSUMED. Its entry
   * three lines above is `['tenant_admin']`, and both capabilities are class
   * `endpoint`. The symmetry is the reason, not the decoration: the seed that
   * ships the write verb is the seed that ships the read verb, so no seeded role
   * can configure an endpoint it may not read, and none may read one it cannot
   * configure. ⚠️ It is NOT symmetric with `enable_endpoint_writeback` below,
   * which stays `[]` — arming a write path is the deliberate second act that
   * entry argues for, and reading is not.
   *
   * 🛑 `operator` IS REFUSED, AND IT COULD NOT BE WRITTEN HERE ANYWAY — VERIFIED
   * BY DOING IT, 16 Aug 2026, not by reading the types. Adding `'operator'` to
   * this entry alone is `_EverySeededHolderStillHoldsIt`: `TS2344`,
   * `"operator no longer holds view_endpoint"`. Adding the capability to
   * `SEEDED_OPERATOR` as well to satisfy that is
   * `_NoSeededRoleExceedsItsClass`: `TS2344`, `"view_endpoint"`, because
   * `CAPABILITY_STAKEHOLDER_CLASSES.view_endpoint` permits `administrator`
   * alone. Both fire at a declaration, with no test run. The two records agree
   * by construction rather than by review.
   */
  view_endpoint: ['tenant_admin'],
  configure_tag_policy: ['tenant_admin'],
  configure_telemetry: ['tenant_admin'],
  configure_identity: ['tenant_admin'],
  manage_users: ['tenant_admin'],
  manage_roles: ['tenant_admin'],
  bind_secret: ['tenant_admin'],
  /**
   * 🛑 THE ONLY EMPTY ENTRY, AND IT IS A DECISION. Enabling write-back on an
   * endpoint is a second, deliberate act — `TOOL_CAPABILITY` records that
   * `endpoint_writeback` maps to `execute_resolution` precisely so that
   * *"`Endpoint.writebackEnabled` … must never be reachable from inside a run"*.
   * A seed shipping it would arm every tenant's write path at provisioning, by
   * default, which is the opposite of a deliberate second act. It is reached by
   * an explicit grant or not at all.
   */
  enable_endpoint_writeback: [],

  /* --- verifying without operating --- */
  view_audit: ['assurance'],
  view_access_log: ['assurance'],
  place_legal_hold: ['assurance'],
  handle_subject_request: ['assurance'],

  /* --- what it cost --- */
  view_metering: ['tenant_admin', 'sponsor'],
  view_commercial: ['tenant_admin', 'sponsor'],

  /* --- source material --- */
  admit_source: ['operator', 'tenant_admin'],

  /* --- the platform's own surface. G601, 19 Sep 2026 ---
   *
   * FIVE MORE EMPTY VERDICTS, AND THE PARAGRAPH ABOVE THIS RECORD SAYING
   * *"there is exactly one"* IS CORRECTED RATHER THAN DELETED: there are now
   * SIX, of which `enable_endpoint_writeback` is the original and these five
   * are a different kind of empty. That one is *no seeded role ships this*;
   * these are *no seeded role COULD*, because `SEEDED_PLATFORM_ROLES` is a set
   * of TENANT seeds — viewer, operator, approver, tenant_admin, sponsor,
   * assurance — and a tenant role carrying one of these five is refused by
   * `decide()` before its capability list is read at all.
   *
   * ⚠️ THE NAME `SEEDED_PLATFORM_ROLES` IS A TRAP HERE AND IS FLAGGED RATHER
   *    THAN RENAMED. In that constant "platform" means *shipped by the
   *    platform* — the seeded roles a tenant starts with. It does NOT mean
   *    `PlatformRole`, which is G289's staff row and which this record cannot
   *    address, because `PlatformRole` is not a `SeedKey`. **There is no seeded
   *    `PlatformRole` anywhere in this repository**, which is the producer gap
   *    §6a names; renaming the older constant is a rename across four files and
   *    is not this commit's.
   */
  view_substrate: [],
  provision_substrate: [],
  view_catalogue: [],
  author_catalogue: [],
  publish_catalogue: [],

  /* --- R10, 1 Oct 2026. *"No seeded role COULD"*, as above: every seed is a
   * TENANT seed and a tenant role carrying one of these six is refused at
   * `capability_is_partner_only` before its capability list is read. */
  view_deals: [],
  register_deal: [],
  view_sandbox: [],
  operate_sandbox: [],
  view_partner_staff: [],
  manage_partner_staff: [],
} as const satisfies Record<Capability, readonly SeedKey[]>

/**
 * 🛑 A SEED THAT DROPS A CAPABILITY THIS RECORD NAMES IS A COMPILE ERROR, AND
 * THE ERROR NAMES BOTH SIDES.
 *
 * Delete `'trigger_run'` from `SEEDED_OPERATOR` and this line reads
 * `Type '"operator no longer holds trigger_run"' does not satisfy the constraint
 * 'never'` — the seed and the capability, at the declaration, with no test run
 * and no fixture loaded. That is the demonstration above, inverted.
 */
export type _EverySeededHolderStillHoldsIt = NoneOf<HolderShortfall>

type HolderShortfall = {
  [K in Capability]: {
    [S in (typeof SEEDED_CAPABILITY_HOLDERS)[K][number]]: K extends SeedByKey[S]['capabilities'][number]
      ? never
      : `${S} no longer holds ${K}`
  }[(typeof SEEDED_CAPABILITY_HOLDERS)[K][number]]
}[Capability]

/**
 * The other direction, which is what stops the record above from becoming a
 * stale mirror: a seed holding a capability this record does not name is a
 * compile error. The two are therefore provably the same set, and the record
 * cannot quietly fall behind the seeds it indexes.
 */
export type _NoSeededRoleHoldsAnUnrecordedCapability = NoneOf<UnrecordedHolding>

type UnrecordedHolding = {
  [S in (typeof SEEDED_PLATFORM_ROLES)[number] as S['key']]: {
    [K in S['capabilities'][number]]: S['key'] extends (typeof SEEDED_CAPABILITY_HOLDERS)[K][number]
      ? never
      : `${S['key']} holds ${K}, unrecorded in SEEDED_CAPABILITY_HOLDERS`
  }[S['capabilities'][number]]
}[SeedKey]

/**
 * One person holding one role in one tenant.
 *
 * Replaces `Membership.role: RoleKey`. A user may hold several — a controller
 * who is also the close sponsor is two assignments, not a compromise role.
 *
 * ⚠️ THE REPLACEMENT IS NOT YET COMPLETE, as of 7 Aug 2026. `RoleKey` is
 * deleted, but `Membership` still exists and its `role` became
 * `roleId: RoleId` rather than disappearing — retyped in place, which
 * `domain.ts` had explicitly argued against, because deleting the field is a
 * different decision from deleting the enum and only one of the two was taken.
 * So there are two rows that name a role for a user, and only THIS one is the
 * authority record: it pins `roleVersion` against a pack upgrade silently
 * promoting a live holder, and it carries an `AssignmentScope`. A resolver that
 * reads `Membership.roleId` gets neither, and gets no error. Until `Membership`
 * is retired, that is the sharpest remaining edge in this area.
 */
export interface RoleAssignment extends TenantScoped {
  /**
   * BRANDED 7 Aug, slice 6, with `DecisionVia.assignmentId` — the audit artefact
   * that names which assignment carried a decision.
   */
  id: RoleAssignmentId
  userId: UserId
  roleId: RoleId
  /** Pinned. An upgrade produces a new version and a deliberate re-assignment. */
  roleVersion: number
  /** Narrows the role's default. May never widen it — see canGrant(). */
  scope: AssignmentScope
  grantedBy: UserId
  grantedAt: Timestamp
  /** Null is indefinite. Delivery and audit assignments should not be. */
  expiresAt: Timestamp | null
  revokedAt: Timestamp | null
}

/* ------------------------------------------------------------------ *
 * 6. What a step or a policy actually asks for
 * ------------------------------------------------------------------ */

/**
 * A capability requirement, which is what a procedure step and an approval
 * policy should express instead of naming a role.
 *
 * `ProcedureStep.human.role: RoleKey` asked for "an approver". What it meant is
 * "someone who may approve, on this domain, above this amount" — and that is
 * expressible here and was not expressible there. A pack that ships a role
 * named differently per customer then still satisfies the step.
 */
export interface CapabilityRequirement {
  capability: Capability
  /**
   * Distinct holders required. Above one, they must be different people —
   * four-eyes means two names, and stating it here is what stops a second
   * signature being the first person signing twice.
   */
  distinctHolders: number
  /** The requirement only binds at or above this value. Null = always. */
  appliesAtOrAboveValue: Money | null
}

/* ------------------------------------------------------------------ *
 * Derivations
 * ------------------------------------------------------------------ */

/**
 * One role a principal holds in one tenant, resolved. Taking the role rather
 * than a role id means no evaluator can run without having loaded one.
 */
export interface HeldAssignment {
  role: Role
  assignment: RoleAssignment
}

/**
 * The live `PartnerAccessGrant` terms, structurally.
 *
 * Taken as terms rather than as a bare scope string DELIBERATELY. The old
 * `effectivePartnerCapabilities(role, grantScope)` accepted
 * `'exceptions_operate'` from anywhere — a revoked grant, an expired one, or a
 * grant belonging to a DIFFERENT partner all produce the same string, and the
 * string is what the function believed. `PartnerAccessGrant` carries
 * `partnerId`, a required `expiresAt` ("an open-ended grant is not a grant")
 * and `revokedAt` precisely so those three are checkable, and passing the scope
 * alone threw all three away at the call site.
 */
export interface PartnerGrantTerms {
  partnerId: PartnerId
  scope: PartnerAccessScopeKey
  /** Required. An open-ended grant is not a grant. */
  expiresAt: Timestamp
  revokedAt: Timestamp | null
}

/**
 * The three partner postures.
 *
 * ⚠️ THIS WAS `keyof typeof PARTNER_CAPABILITY_MASK` UNTIL 16 Aug 2026, and the
 * change is mechanical rather than semantic: the mask is now DERIVED from
 * `PARTNER_MASK_MEMBERSHIP`, whose values are scope keys, so deriving the key
 * type from the mask would be a cycle. The three members are unchanged.
 */
export const PARTNER_ACCESS_SCOPES = {
  commercialOnly: 'commercial_only',
  exceptionsRead: 'exceptions_read',
  exceptionsOperate: 'exceptions_operate',
} as const
export type PartnerAccessScopeKey =
  (typeof PARTNER_ACCESS_SCOPES)[keyof typeof PARTNER_ACCESS_SCOPES]

/**
 * A partner's grant as a CAPABILITY MASK rather than a role ceiling.
 *
 * `effectivePartnerRole()` clamped one enum value to another, which only worked
 * because roles were totally ordered — and they are not, once a pack can ship
 * "KYC Reviewer" and "Warehouse Supervisor" side by side. A mask intersects,
 * which composes with any role a pack invents.
 *
 * The invariant is unchanged and is the one that matters: a partner may operate
 * on a customer's exceptions and may never be the approving authority for them.
 *
 * `view_summary` APPEARS IN NO SCOPE HERE AND MUST NOT BE ADDED TO ONE. Its
 * absence is the whole control (§10.6): a digest is pushed to a mailbox we do
 * not control, and a partner under `commercial_only` — mask `[]`, holding
 * nothing, passing every check that tests for a capability — would otherwise be
 * placed on an exception digest carrying counterparty names and amounts.
 */
/**
 * 🛑 IN-MASK OR OUT-OF-MASK, ANSWERED FOR EVERY CAPABILITY. THE MASK IS DERIVED
 * FROM THIS, AND THIS IS TOTAL.
 *
 * ADDED 16 Aug 2026, and the defect it closes is one the type system was
 * already catching everywhere else. `PARTNER_CAPABILITY_MASK` was
 * `Record<scope, readonly Capability[]>` — TOTAL IN ITS SCOPE KEY AND A BARE
 * ARRAY IN ITS CAPABILITY VALUE. So a new capability compiled clean here while
 * `CAPABILITY_RESOURCE_CLASS` and `CAPABILITY_DELEGABLE` both fired: G128
 * records that pair biting on `promote_learning` and records it as a win, and
 * NOTHING BIT ON THE MASK. Three capabilities — `view_summary`,
 * `view_metering`, `promote_learning` — each carry a doc comment reading *"IT
 * APPEARS IN NO `PARTNER_CAPABILITY_MASK` SCOPE, EVER"*, AND THE COMMENT WAS THE
 * ENTIRE ENFORCEMENT. A comment is not a control; §11.9a's whole argument for
 * minting `view_metering` was that a partner reading it gets the customer's
 * volume in the clear, and the only thing standing between that argument and a
 * later `mask.push()` was that nobody had done it yet.
 *
 * WHY A SCOPE LIST RATHER THAN A BOOLEAN. Assertion 5c's own message proposes
 * `Record<Capability, boolean>`, which would answer *whether* and not *where* —
 * and `exceptions_read` versus `exceptions_operate` is the whole of §10.6's
 * argument about correspondence. A boolean would have made
 * `view_document: true` indistinguishable from putting it in the weaker scope.
 * An empty array IS the out-of-mask verdict, written down.
 *
 * WHERE IT BITES, STATED PLAINLY BECAUSE §5.10 SAYS A TOTAL RECORD ONLY BITES
 * WHERE SOMETHING CONSTRUCTS ONE: the construction site is THIS LITERAL. The
 * `satisfies` clause is checked at the declaration, so ANY capability minted
 * without an entry here is `TS1360` with no fixture, no call site and no test
 * involved. That is the same mechanism as `CAPABILITY_DELEGABLE`, applied to the
 * map that lacked it. ⚠️ This said *"a thirty-ninth capability"* until G209 on
 * 16 Aug 2026 — and the thirty-ninth was `view_endpoint`, whose arrival is the
 * `TS1360` this very sentence was written to predict and had already collected.
 * The mechanism is the durable statement; the ordinal never was.
 *
 * ⚠️ G87 RECORDS THE MASK AS AN ALLOW-LIST AND THAT IS UNCHANGED — absence is
 * still the default and silence is still safe. What changed is that silence must
 * now be TYPED, so it can be told apart from an omission.
 */
export const PARTNER_MASK_MEMBERSHIP = {
  /* --- the SEVEN a partner may reach, and nothing else ever --- */
  /** Both operating scopes. The queue is what a partner supports. */
  view_exception: ['exceptions_read', 'exceptions_operate'],
  /**
   * 🛑 G3881 — IN NO SCOPE, EVER. The OWNER'S RULING on G3802: *"Keep partners
   * out: run reads open to customer roles holding view_exception, but are
   * excluded from the partner capability mask; partners still see exceptions,
   * not run residue."* A partner keeps `view_exception` (the register) and is
   * refused every run read here, before any role is read.
   */
  view_run: [],
  /** Both. Counts and ageing over the queue the grant already reaches. */
  view_dashboard: ['exceptions_read', 'exceptions_operate'],
  /** OPERATE ONLY. A document is the counterparty's paper, not a count of it. */
  view_document: ['exceptions_operate'],
  assign_exception: ['exceptions_operate'],
  propose_resolution: ['exceptions_operate'],
  advance_procedure: ['exceptions_operate'],
  /**
   * ✅ RULED 16 Aug 2026 — G209, ruling 1 of 3, AND IT IS A WIDENING THAT
   * REVERSES A CONTROL WHICH MERGED THE SAME DAY. It is written here rather than
   * appended below because it is now one of the seven, and the group it sits in
   * is the group a reader counts.
   *
   * ⚠️ THIS ENTRY WAS `[]` WITH A 🛑 PROVISIONAL BANNER, IN THE OUT-OF-MASK
   * SECTION, AND THE BANNER ARGUED FOR THE ABSENCE. Its argument is preserved
   * rather than deleted, because it is the argument the owner overrode and a
   * later reader must be able to see what was weighed: an endpoint is where data
   * LEAVES a tenant, the list of them is the customer's integration topology and
   * its export destinations, and a partner holding this reads where a customer's
   * data goes without reading any of it — *"the same shape §11.9a refuses for
   * `view_metering`, where spend and rate invert to volume."*
   *
   * 🛑 THE CONSEQUENCE, STATED PLAINLY RATHER THAN LEFT TO BE DERIVED: A PARTNER
   * UNDER EITHER OPERATING SCOPE CAN NOW ENUMERATE THE CUSTOMER'S INTEGRATION
   * TOPOLOGY AND ITS EXPORT DESTINATIONS, and invariant 2's single cross-tenant
   * read path is what carries that. `docs/access-and-agency.md` §11.9a made the
   * mirror-image argument to keep the meter out of `view_dashboard`; that
   * argument is OVERRIDDEN here, not distinguished. **THE OWNER WAS SHOWN THIS
   * CONFLICT — including the same-day test that asserts the absence — AND
   * REAFFIRMED THE WIDENING. Do not relitigate it, and do not quietly narrow it
   * back; challenge it in writing with the quote, per G209.**
   *
   * BOTH SCOPES, NOT THE STRONGER ONE ALONE. `exceptions_operate` alone was the
   * narrower option and was rejected: a partner under `exceptions_read` triaging
   * a break needs the same answer to *"where did this write go"* as one working
   * it, and a read of a destination list is not an operating act. Nothing here
   * reaches the credential: `bind_secret` is class `secret` and stays out of
   * every scope, as does `enable_endpoint_writeback` and `configure_endpoint`.
   * The partner may read WHERE data goes; it may not change it, arm it, or reach
   * what authenticates to it.
   *
   * ⚠️ THE TEST THAT ASSERTED THE OPPOSITE IS INVERTED, NOT DELETED —
   * `tests/model/endpoint-read-capability.test.ts`. A deleted assertion looks
   * like an oversight; an inverted one carrying its own history is a decision.
   */
  view_endpoint: ['exceptions_read', 'exceptions_operate'],

  /* --- out, and each `[]` is a decision rather than an omission --- */
  /**
   * OUT, and this is the entry §10.6 exists for. A digest is PUSHED to a mailbox
   * we do not control, and a partner under `commercial_only` — mask `[]`,
   * holding nothing, passing every check that tests for a capability — would
   * otherwise be placed on an exception digest carrying counterparty names and
   * amounts.
   */
  view_summary: [],
  /**
   * OUT. §11.9a: spend and rate together invert to volume, so a partner
   * supporting a customer's queue would read that customer's transaction volume
   * in the clear through the mask.
   */
  view_metering: [],
  /**
   * OUT. §11.9a: the partner path is `partnerCommercialVisibility()`, a
   * derivation yielding one of four verdicts per tenant. A mask intersects
   * capabilities and cannot express *"the band and nothing inside it"*, so
   * putting the verb here would route around the verdict entirely.
   */
  view_commercial: [],
  /**
   * OUT. G128: promoting one exception's correction into a standing rule is the
   * authority to change the customer's unattended behaviour.
   */
  promote_learning: [],
  /**
   * OUT — G173 requires this absence be asserted BY NAME and never by a length,
   * and this entry is that assertion in the type rather than in a test. The
   * residue is source material at LINE grain.
   */
  admit_source: [],

  /** Bulk egress under a human's name. Never a partner's. */
  export_data: [],
  /** Admission is the prompt-injection checkpoint. Never a partner's. */
  admit_correspondence: [],
  /** Content leaving the tenant under the customer's name. */
  send_outbound: [],
  /** The one that moves money. */
  execute_resolution: [],
  close_exception: [],
  /**
   * OUT, AND THIS IS THE INVARIANT THE MASK EXISTS FOR: *"a partner may operate
   * on a customer's exceptions and may never be the approving authority for
   * them."*
   */
  approve_resolution: [],
  reverse_resolution: [],
  close_period: [],

  /* --- authority, configuration, identity, secrets, statute: all out --- */
  set_autonomy: [],
  author_definition: [],
  author_procedure: [],
  author_rule: [],
  install_pack: [],
  configure_tolerance: [],
  configure_endpoint: [],
  configure_tag_policy: [],
  configure_telemetry: [],
  configure_identity: [],
  manage_users: [],
  manage_roles: [],
  bind_secret: [],
  enable_endpoint_writeback: [],
  trigger_run: [],
  /** Invariant 8: `statutory` is not the customer's to delegate, at any price. */
  place_legal_hold: [],
  handle_subject_request: [],
  view_audit: [],
  view_access_log: [],

  /* --- the platform's own surface. G601, 19 Sep 2026 ---
   *
   * OUT OF EVERY SCOPE, AND THE ABSENCE HERE IS THE WEAKER OF THE TWO REASONS
   * RATHER THAN THE CONTROL. A partner is refused these by
   * `capabilityIsPlatformOnly()` at the TOP of the partner arm — before the
   * grant is read, before the mask is consulted — so an entry naming a scope
   * would be unreachable rather than dangerous. They are written `[]` anyway
   * because this record's discipline is that *"an empty entry means a decision
   * was taken"*, and because G577's control derives the partner ceiling from
   * `CAPABILITY_RESOURCE_CLASS`: a partner is a processor and the fleet is not
   * theirs to publish to.
   */
  view_substrate: [],
  provision_substrate: [],
  view_catalogue: [],
  author_catalogue: [],
  publish_catalogue: [],

  /* --- a partner organisation's own surface. R10, 1 Oct 2026 ---
   *
   * 🛑 OUT OF EVERY SCOPE, AND IT IS THE ONE PLACE A READER WILL EXPECT THE
   *    OPPOSITE. These ARE partner verbs — but the mask governs invariant 2's
   *    CROSS-TENANT path, a partner acting INSIDE a customer tenant under a
   *    `PartnerAccessGrant`, and none of the six is an act inside any customer
   *    tenant. They are answered on `decide()`'s fifth arm, which is entered
   *    BEFORE the partner tenant arm reads the grant or this mask at all, so an
   *    entry here would be unreachable. Writing `[]` keeps the mask meaning
   *    exactly what it meant: what a customer has let a partner do in THEIR
   *    tenant. */
  view_deals: [],
  register_deal: [],
  view_sandbox: [],
  operate_sandbox: [],
  view_partner_staff: [],
  manage_partner_staff: [],
} as const satisfies Record<Capability, readonly PartnerAccessScopeKey[]>

export const PARTNER_CAPABILITY_MASK: Record<
  PartnerAccessScopeKey,
  readonly Capability[]
> = {
  commercial_only: capabilitiesInPartnerScope('commercial_only'),
  exceptions_read: capabilitiesInPartnerScope('exceptions_read'),
  exceptions_operate: capabilitiesInPartnerScope('exceptions_operate'),
}

/**
 * The derivation, kept private. Two encodings of one rule are two encodings that
 * can disagree with no tiebreak written anywhere — the argument that deleted
 * `ProcedureStep.secondApproverAbove`, and the same reason `DelegableCapability`
 * is derived from `CAPABILITY_DELEGABLE` rather than written twice.
 */
function capabilitiesInPartnerScope(
  scope: PartnerAccessScopeKey,
): readonly Capability[] {
  return (Object.keys(PARTNER_MASK_MEMBERSHIP) as Capability[]).filter((c) =>
    (PARTNER_MASK_MEMBERSHIP[c] as readonly PartnerAccessScopeKey[]).includes(
      scope,
    ),
  )
}

/**
 * Capabilities a partner actually holds: what the role grants, intersected with
 * what the live grant permits. Never the union, and never the role alone.
 *
 * Takes the GRANT, not a scope string — see `PartnerGrantTerms`. A grant that
 * is revoked, expired, or issued to another partner yields nothing, which is
 * the same answer as no grant at all and is deliberately indistinguishable
 * here: the reason belongs in a `Decision`, not in a capability list.
 */
/**
 * WHICH CAPABILITY IS CARRIED BY ANOTHER — G3881, 4 Oct 2026.
 *
 * ONE ENTRY, AND IT IS THE OWNER'S RULING ON G3802 WRITTEN AS DATA: *"run
 * reads open to customer roles holding view_exception, but are excluded from
 * the partner capability mask."* A role that holds `view_exception` CARRIES
 * `view_run`; nothing stores `view_run` on a role, so there is no seed, no
 * backfill and no `role_capability` row to drift from the register's reach.
 *
 * 🛑 CARRYING IS NOT A WAY ROUND A MASK. `decide()` checks the partner mask
 *    against the capability ASKED FOR, before any role is read, so a partner
 *    whose role holds `view_exception` is refused `view_run` at
 *    `capability_outside_partner_mask` and never reaches `roleCarries()`.
 *    `tests/model/run-read-partner-refusal.test.ts` witnesses both arms.
 *
 * ⚠️ `Partial` AND NOT TOTAL, DELIBERATELY: a total record would make every
 *    future verb answer *"what carries you"*, and the honest answer for fifty
 *    of them is *"nothing"* — fifty `null`s are noise a reviewer stops
 *    reading. A second entry is a ruling, and it lands here by name.
 */
export const CAPABILITY_CARRIED_BY: Readonly<Partial<Record<Capability, Capability>>> = {
  view_run: 'view_exception',
}

/** Whether `role` carries `capability` — held outright, or carried (above). */
export function roleCarries(role: { readonly capabilities: readonly Capability[] }, capability: Capability): boolean {
  if (role.capabilities.includes(capability)) return true
  const carrier = CAPABILITY_CARRIED_BY[capability]
  return carrier !== undefined && role.capabilities.includes(carrier)
}

export function effectivePartnerCapabilities(
  role: Role,
  partnerId: PartnerId | null,
  grant: PartnerGrantTerms | null,
  now: Timestamp,
): Capability[] {
  if (partnerId === null || grant === null) return []
  if (grant.partnerId !== partnerId) return []
  if (grant.revokedAt !== null || grant.expiresAt <= now) return []
  const mask = PARTNER_CAPABILITY_MASK[grant.scope]
  return role.capabilities.filter((c) => mask.includes(c))
}

/* ------------------------------------------------------------------ *
 * 6a. The platform arm's substrate — G289, 19 Sep 2026
 * ------------------------------------------------------------------ */

/**
 * 🛑 **THE BANNER BELOW WENT FALSE ON THE DAY IT WAS WRITTEN AND IS CORRECTED
 *    RATHER THAN DELETED — G601, 19 Sep 2026.** It is the sentence
 *    `tests/model/platform-arm.test.ts`, `server/data-plane/authorise.ts`,
 *    G289's row, G533's entry and G534's measurement all quote, so a reader
 *    arriving from any of the five meets it and must meet its correction here.
 *
 * **THE TABLES EXIST.** `db/migrations/0009_identity_substrate.sql` creates
 * `tenant.platform_role`, `tenant.platform_role_capability` and
 * `tenant.platform_role_assignment` — all three `ENABLE` and `FORCE` RLS, all
 * three `SELECT`-only to the app role — and `server/data-plane/identity.ts`
 * reads them into `platformHeld` through `substrateFromSession()`. 0009 landed
 * the SAME DAY as G289 and neither file told the other. Derive it, never read
 * it:
 *
 *   grep -c 'CREATE TABLE tenant.platform_role' db/migrations/0009_identity_substrate.sql
 *   grep -rn 'tenant.platform_role_assignment' server/data-plane/identity.ts
 *
 * ⚠️ **WHAT IS STILL EXACTLY TRUE, AND IT IS NARROWER THAN WHAT WAS: THERE IS
 *    NO SEED AND NO WRITER.** Nothing in this repository has ever written a
 *    `platform_role_assignment` row — not a migration, not
 *    `server/dev/identity-seed.ts`, not a request path — so `platformHeld` is
 *    `[]` for every principal the substrate can produce and the arm's ALLOW is
 *    witnessed by `tests/model/platform-arm.test.ts` against a fixture and by
 *    nothing else. `grep -rn 'platform_role' server/dev/` returns nothing.
 *    **A reader is not a producer**, which is the same distinction the
 *    original banner drew one level down and the reason it is kept.
 *
 * THE ORIGINAL BANNER FOLLOWS, UNCHANGED.
 *
 * ⚠️ NOTHING PRODUCES ANY TYPE IN THIS SECTION. SAY SO BEFORE READING FURTHER.
 *
 * There is no `platform_role` table, no `platform_role_assignment` table and no
 * seed. `grep -h 'CREATE TABLE' db/migrations/*.sql db/migrations-control/*.sql`
 * returns `tenant`, `tenant_contact`, `run`, `tenant.subject_ledger`,
 * `pack_catalogue`, `tenant.membership` and `tenant.session` — and none of those
 * is either of the two below. **A declared type is not a producer**, and
 * `server/data-plane/authorise.ts` already carries the lesson at length: a term
 * with no reader is `null`, and `null` REFUSES rather than defaults.
 *
 * WHY THEY ARE DECLARED ANYWAY, WHICH IS G289's WHOLE PREMISE.
 * `docs/contracts/administration.openapi.yaml` states the gap in its own voice:
 * *"There is no authorisation mechanism for a platform principal anywhere in
 * `model/`. … `S1` draws three staff roles with different destinations;
 * `model/access.ts` cannot represent one, because `ORG_CLASSES.platform` holds
 * no `RoleAssignment` by law."* Twenty-six of its fifty-nine operations point at
 * `x-admin-authority: platform-role`, which *"DOES NOT EXIST in `model/`"*.
 * These are the declarations that stop that sentence being true. Derive the
 * number rather than reading it:
 * `grep -c 'x-admin-authority: platform-role' docs/contracts/administration.openapi.yaml`
 * → 27, of which one is the vocabulary's own entry in §5's prose.
 */

/** The `Id` brand. See the note on `PlatformRoleAssignmentId`. */
import type { Id } from './kernel'

/**
 * One person holding one PLATFORM role. No tenant.
 *
 * ⚠️ MINTED HERE AND NOT IN `model/kernel.ts`, WHERE EVERY OTHER BRANDED ID IN
 * THIS REPOSITORY LIVES, AND THAT IS A FENCE RATHER THAN A DESIGN. This slice
 * was scoped to `model/access.ts` and `model/governance.ts` with two other
 * sessions live in the tree; re-homing this alias to `kernel.ts` beside
 * `RoleAssignmentId` is a RENAME, not a redesign, and it is owed.
 *
 * 🛑 IT IS NOT `RoleAssignmentId`, AND REUSING THAT BRAND WAS THE TEMPTING
 * SHORTCUT. `RoleAssignmentId`'s own declaration reads *"One person holding one
 * role IN ONE TENANT"*, and the two rows do not share an id space: one is
 * `TenantScoped` and the other names no tenant at all. A shared brand would let
 * a platform assignment id be passed where a tenant assignment id is expected
 * and compile — which is the class `ORG_CLASS_FOR_CONNECTION_OWNER` refuses by
 * name when it declines `owner.kind as OrgClass`.
 */
export type PlatformRoleAssignmentId = Id<'PlatformRoleAssignment'>

/**
 * A role held by 1CloudHub's own staff, in no tenant.
 *
 * 🛑 IT DOES NOT EXTEND `TenantScoped`, AND THE ABSENCE IS THE DECLARATION.
 * `Role extends TenantScoped`; this does not, so there is no `tenantId` to
 * compare, nothing for `tenant_mismatch` to fire on, and — this is the one that
 * matters — **no way to write a platform role that names a customer tenant.**
 * Invariant 8 held by the shape of the record rather than by a check somebody
 * has to remember to call, which is the same argument
 * `DURABLE_ASSIGNMENT_PERMITTED` makes one axis over.
 *
 * ⚠️ NO `defaultScope`, AND THAT IS ALSO DELIBERATE. Every dimension of
 * `AssignmentScope` — domains, definitions, solutions, cost centres, legal
 * entities, a value ceiling on money moved — narrows TENANT BUSINESS DATA. A
 * platform role reaches none of it (see `PLATFORM_ASSIGNMENT_REACHES` below), so
 * a default scope here would be a field whose only possible honest value is
 * `DENY_ALL` and whose careless value is `UNSCOPED`. Leaving it off means the
 * careless value cannot be written.
 *
 * ⚠️ NO `origin` AND NO `packId`. A pack may not ship a platform role: `RoleOrigin`
 * exists to say who may edit a role, and the answer here is never a customer and
 * never a pack. A pack that could compose a staff role would be a customer-
 * authored surface minting authority over the platform.
 *
 * `version` IS KEPT, and it is not ceremony — see `PlatformRoleAssignment
 * .roleVersion`.
 */
export interface PlatformRole {
  id: RoleId
  /** What the console calls it: "Support", "Delivery", "Commercial". */
  label: string
  /** Stable identifier. No pack namespace, because no pack may ship one. */
  key: string
  /** Immutable on write. The pin below reads it. */
  version: number
  stakeholderClass: StakeholderClass
  /** Composed from the same closed set. A platform role invents no verb either. */
  capabilities: readonly Capability[]
  status: 'active' | 'archived'
}

/**
 * One staff person, one platform role, bounded in time.
 *
 * 🛑 `expiresAt` IS NOT NULLABLE, AND THAT IS `DURABLE_ASSIGNMENT_PERMITTED`
 * MADE UNREPRESENTABLE RATHER THAN CHECKED. That table says `platform: false` —
 * *"Only the customer row may hold a durable `RoleAssignment`"* — and `decide()`
 * enforces it on the tenant arm with a branch and a refusal reason. Here there
 * is nothing to enforce: a never-expiring staff assignment cannot be typed. The
 * refusal `durable_assignment_forbidden_for_org` therefore CANNOT ARISE on this
 * arm, which is a stronger statement than the branch it replaces and is the
 * reason no equivalent branch appears below.
 *
 * ⚠️ IT CARRIES NO `scope`, for `PlatformRole.defaultScope`'s reason.
 *
 * ⚠️ AND IT CARRIES NO `TenantId` ANYWHERE. A staff person who needs to reach a
 * customer tenant does it through a `TenantAccessGrant` — purpose-bound,
 * two-person at issue, and re-checked at evaluation by `evaluateTenantAccess()`
 * — and G292 supplies that path's liveness terms. **This row is not that path
 * and must never become it.** If a `tenantId` is ever added here, invariant 8
 * has been deleted in a field.
 */
export interface PlatformRoleAssignment {
  id: PlatformRoleAssignmentId
  userId: UserId
  roleId: RoleId
  /**
   * Pinned, for `RoleAssignment.roleVersion`'s reason and one more. §10.5: a
   * failed injection probe can auto-revert at 04:00, and if the reverted-to
   * version had a WIDER role, live authority would widen unattended. A staff
   * role is the worst place for that to happen, not the safest.
   */
  roleVersion: number
  grantedBy: UserId
  grantedAt: Timestamp
  /** NOT NULLABLE. See the note on this interface. */
  expiresAt: Timestamp
  revokedAt: Timestamp | null
}

/**
 * One platform role a principal holds, resolved — the platform mirror of
 * `HeldAssignment`. Taking the role rather than a role id means no evaluator can
 * run without having loaded one.
 */
export interface HeldPlatformAssignment {
  role: PlatformRole
  assignment: PlatformRoleAssignment
}

/**
 * WHICH RESOURCE CLASSES A PLATFORM ROLE ASSIGNMENT MAY REACH AT ALL.
 *
 * 🛑 THIS TABLE IS G289's NAMED MITIGATION AND IT IS NOT OPTIONAL. The ruling
 * accepts a cost in these words — *"this touches the function EVERY
 * authorisation in the product goes through"* — and names exactly one thing
 * against it: *"`CAPABILITY_RESOURCE_CLASS` is total over a closed set of 13, so
 * the new arm must answer each class rather than defaulting."* Every one of the
 * thirteen is answered below, in its own entry, with the argument on it. A
 * fourteenth class is a COMPILE ERROR here, and §5.10's caveat does not apply:
 * this module CONSTRUCTS this record one line down, so the totality bites.
 *
 * ⚠️ TEN OF THIRTEEN ARE `false` — ⚠️ **THIS SAID TWELVE UNTIL 19 Sep 2026 AND
 * IS CORRECTED RATHER THAN DELETED, because it is the figure
 * `server/contract/capability.ts` and two HANDOFF rows read this table's
 * posture off.** G601 opened `substrate` and `catalogue`, each argued at its
 * own entry below and each for a reason the other does not share. Derive it,
 * never read it:
 * `awk '/^export const PLATFORM_ASSIGNMENT_REACHES/,/^\}/' model/access.ts | grep -cE '^  [a-z_]+: false,'`
 *
 * ⚠️ **AND IT IS THIRTEEN OF SIXTEEN SINCE 1 Oct 2026 — R10 added `deal`,
 * `sandbox` and `partner_staff`, all `false` on one argument stated at their
 * own entries.** The sentence above was true of thirteen classes and is left
 * as written; the awk is the claim.
 *
 * A READER SHOULD FIND A LONG LIST OF `false` SUSPICIOUS
 * BEFORE FINDING IT REASSURING — a table that refuses everything is a table that
 * proves nothing, which is `docs/HANDOFF.md` §5.6. It refuses ten because
 * **ten are already somebody else's path**, not because refusing is safe:
 * `statutory` and `authority` are refused by governance's own lists before this
 * table is read; two classes (`schedule`, `telemetry`) have NO CAPABILITY
 * POINTING AT THEM AT ALL, so their entries are vacuous today and are written
 * down anyway because the ruling says answer each — ⚠️ **this sentence named
 * FOUR such classes until G601 gave `substrate` and `catalogue` verbs, which
 * is precisely why a vacuous entry is a weak argument and had to be re-taken
 * on the merits when it stopped being vacuous**;
 * and the remaining six are reached by a `TenantAccessGrant`, per tenant, under
 * `authorisationPermits()`. The three `true`s are what make the arm an
 * evaluator rather than a longer refusal — `tests/model/platform-arm.test.ts`
 * asserts the differential in both directions.
 *
 * 🛑 THIS TABLE IS A SECOND GATE, NEVER A FIRST ONE. It cannot widen anything:
 * `decide()` reads `NON_DELEGABLE_RESOURCES` and `CONTRACT_ONLY_RESOURCES` FIRST
 * and refuses on either before reaching here, exactly as `authorisationPermits()`
 * tests `statutory` *"BEFORE the null check, before withdrawal, before
 * anything"*. Setting `statutory: true` below would change NOTHING observable —
 * which is precisely the shape that made G60 inert for eight days, so the entry
 * agrees with the list and `tests/model/platform-arm.test.ts` asserts the
 * agreement in both directions rather than trusting two hands to stay in step.
 */
export const PLATFORM_ASSIGNMENT_REACHES: Record<AccessResourceClass, boolean> = {
  /**
   * 🛑 THE ANSWER THE WHOLE ARM IS JUDGED ON. Seventeen capabilities point here
   * — the customer's rows, documents, money, correspondence and audit trail.
   * **Being staff is not access.** A platform principal reaches tenant data
   * through a `TenantAccessGrant` and never through an assignment, and
   * `decide()`'s original refusal said why: *"Refusing here rather than in
   * governance is what stops the assignment table being a second door beside the
   * grant."* That sentence is not weakened by G289; it is moved from the org
   * term to this line, where it applies to a class instead of to a person.
   */
  tenant_data: false,
  /**
   * `PERMITTED_RESOURCES.delivery` admits it, so staff DO reach it — under a
   * grant, purpose-bound and expiring. An assignment reaching it would be the
   * standing version of a bounded reach, and §8.7 records what that costs: a
   * delivery grant that provably could not read tenant data *"could rewrite
   * `AutonomyConfig`, `DataEgressConfig.allowedDestinations` and
   * `CorrespondenceConfig` — the rules deciding who reaches tenant data and
   * where it is sent."* The grant already reaches this; the assignment does not
   * need to.
   */
  configuration: false,
  /**
   * `CONTRACT_ONLY_RESOURCES`. Refused by the list above before this entry is
   * read, and written `false` so the two cannot drift. Only a signed
   * `SupportAuthorisation` opens `authority`, and a platform role assignment is
   * not one: §8.7's whole distinction is that `PERMITTED_RESOURCES` is what the
   * PLATFORM decides and a contract is what the CUSTOMER decides. A staff role
   * the platform mints cannot be the customer's signature.
   *
   * ⚠️ IT FOLLOWS, AND IS WORTH STATING, THAT `canGrant()` CAN NEVER SUCCEED FOR
   * A PLATFORM PRINCIPAL: it requires `manage_roles`, which is classed here.
   * Staff cannot mint roles for a tenant through this arm.
   */
  authority: false,
  /**
   * 🛑 `NON_DELEGABLE_RESOURCES`, AND THE INVARIANT SAYS *"at any price"*.
   * Refused by that list first, and `false` here as well. Invariant 8: *"a
   * statutory obligation is not the customer's to delegate to a processor."*
   * Being the processor is the reason it is refused, not an exception to it.
   */
  statutory: false,
  /**
   * `configure_identity`. **This is the one with a second-order argument and it
   * is the sharpest on the table.** `OrgClass` is derived from
   * `orgFor(connection.owner)`, so a principal who may rewrite identity
   * connections may rewrite the axis this very arm dispatches on — a fourth-arm
   * capability that could reach back and choose which arm runs. A delivery grant
   * reaches `identity`, per tenant, under a purpose and a clock; an assignment
   * reaching it would be the org axis editing itself.
   */
  identity: false,
  /**
   * `view_endpoint` and `configure_endpoint`. An endpoint is where a customer's
   * data LEAVES, so the list of them is that customer's integration topology —
   * §11.9a's own words, which G209 overrode for a PARTNER under a live grant and
   * did not touch for anybody else. A standing staff assignment is not a live
   * grant.
   */
  endpoint: false,
  /**
   * 🛑 THE ENTRY A READER WILL EXPECT TO BE `true`, SO IT GETS THE ARGUMENT.
   * G75 put `secret` into `PERMITTED_RESOURCES.delivery` — a standing 90-day
   * reach to customer credentials — against a written recommendation, and that
   * decision is not relitigated here. **G75 widened the GRANT. It did not widen
   * the ASSIGNMENT, and the two are not the same instrument.** What survived
   * G75, in its own line, is *"every reach is still a grant, still authorised,
   * still audited."* Reaching `secret` from a role assignment would delete all
   * three words at once: no purpose, no `SupportAuthorisation` to withdraw, and
   * `MAX_AUTHORIZATION_SECONDS.secret` is 60 seconds precisely because binding a
   * credential is ONE ACT. An assignment is not one act.
   */
  secret: false,
  /**
   * ✅ OPENED 19 Sep 2026 — G601, AND IT IS THE SECOND ENTRY IN THIS TABLE EVER
   * TO MOVE. ⚠️ THE OLD ENTRY IS QUOTED RATHER THAN DELETED, because it is the
   * sentence `server/contract/capability.ts` reads this verdict off and the one
   * a reader would quote onward: *"Vacuous and answered anyway: NO capability
   * maps here. `governance.ts` calls this a STATEMENT rather than a gap — 'a
   * platform RELEASE reaches these, not a grant, and a capability is the
   * currency of grants' — so a `true` would open a door no verb can walk
   * through."*
   *
   * 🛑 THE OLD ENTRY WAS RIGHT AND ITS PREMISE EXPIRED, WHICH IS A DIFFERENT
   *    THING FROM ITS HAVING BEEN WRONG. Its argument is *vacuous* — there is
   *    no verb — and vacuity is a fact about the capability set, not about this
   *    class. G601 mints `view_substrate` and `provision_substrate`, so the
   *    entry is no longer vacuous and has to answer on the merits. The merits
   *    are that `governance.ts`'s statement is conditional in its own words —
   *    *"a TENANT capability pointing at `substrate` would be a verb no tenant
   *    principal could ever legitimately hold"* — and these two are not tenant
   *    capabilities: `PLATFORM_ONLY_RESOURCE_CLASSES` names this class and
   *    `decide()` refuses it on the customer and partner arms at their first
   *    line.
   *
   * 🛑 AND THE CLASS'S SECOND ARGUMENT SURVIVES UNTOUCHED AND IS THE ONE TO
   *    READ BEFORE MOUNTING ANYTHING: *"Under BYOA the customer holds root on
   *    the account, so a grant here is a request rather than a control."* That
   *    is not about tenant capabilities and G289 does not answer it. It is
   *    carried on `provision_substrate`'s own declaration as a NAMED LIMIT, and
   *    it costs nothing today because G36 slips BYOA to v1+1 and
   *    `grep -rn 'byoa' db/migrations/` returns nothing. **The commit that
   *    lands a BYOA tenant owes the re-argument.**
   *
   * ⚠️ WHAT THIS DOES NOT OPEN, and the distinction is the whole of invariant
   *    8: the tenant's BUSINESS. `tenant_data` is still `false` five entries
   *    up. The fleet roster is which planes exist and under what licence; the
   *    moment a `view_substrate` operation returns an exception, a document or
   *    a figure it has left this class, and the gate it needs is a
   *    `TenantAccessGrant`.
   */
  substrate: true,
  /**
   * ✅ OPENED 19 Sep 2026 — G601 — AND IT IS A SEPARATE RULING FROM `substrate`
   * ABOVE RATHER THAN THE SAME ONE APPLIED TWICE. ⚠️ The old entry is quoted
   * rather than deleted: *"Vacuous, same statement as `substrate`. Authoring is
   * a release, not a verb."*
   *
   * 🛑 THE TWO CLASSES SHARE THE CONDITIONAL AND NOTHING ELSE, and a blanket
   *    opening of both under one argument would be the thing G289's own table
   *    exists to refuse — *"the new arm must answer each class rather than
   *    defaulting."* So: `governance.ts` says of this class *"AUTHORING is the
   *    catalogue act, and it has no verb BECAUSE IT IS NOT A TENANT
   *    CAPABILITY"*, a sentence about the currency of tenant roles that
   *    `PlatformRole` is not denominated in. Three verbs land —
   *    `view_catalogue`, `author_catalogue`, `publish_catalogue` — split
   *    because *"the blast radius is the fleet rather than one tenant"* and a
   *    draft's is nobody.
   *
   * 🛑 AND THE RESIDUAL RISK IS NOT INVARIANT 8's, IT IS INVARIANT 6's, WHICH
   *    IS WHY THIS ENTRY DOES NOT READ LIKE THE ONE ABOVE. A published pack
   *    carries procedure templates and agent tool bindings into every tenant
   *    that installs it. G110 rules that
   *    `validateProcedureInjectionSafety()` and `validateAgentToolBindings()`
   *    need BOTH a CI call site and a PUBLICATION SEAM that refuses, *"because
   *    a control that exists only in CI stops existing the moment a pack
   *    arrives by another route."* The CI half is
   *    `tools/check-pack-safety.mjs`; **the seam does not exist**, and
   *    `publish_catalogue` is the verb it would sit behind. Opening the class
   *    does not build the seam and must not be read as having built it — the
   *    verb is declared and nothing is mounted on it.
   *
   * ⚠️ `install_pack` IS UNCHANGED AND STAYS `configuration`. Installing is a
   *    tenant act by `governance.ts`'s own line; this arm does not reach
   *    `configuration` and must not start.
   */
  catalogue: true,
  /**
   * ✅ THE FIRST CLASS THIS ARM OPENED, AND THE NARROWEST ONE ON THE TABLE.
   * ⚠️ **THIS READ *"THE ONE CLASS THIS ARM OPENS"* UNTIL 19 Sep 2026** and is
   * corrected rather than deleted, because it is the sentence
   * `server/contract/capability.ts` reads its *"opens exactly one class"*
   * verdict off; G601 opened `substrate` and `catalogue` beside it, each on an
   * argument this entry does not supply.
   * `view_commercial` is the only capability here and `commercial` is the only
   * class in the thirteen whose defining rule is that a party OTHER than the
   * tenant may read it — `ACCESS_RESOURCE_CLASSES.commercial` says so, and
   * invariant 2 already lets a PARTNER reach it through a verdict. The platform
   * is the counterparty on that record: it prices the plan, mints the invoice
   * and carries the receivable. Refusing the platform a read of the contract it
   * is a party to would put 1CloudHub BELOW the partner on its own billing
   * relationship, which inverts invariant 2's ordering rather than upholding it,
   * and `S1`'s console is drawn around exactly this.
   *
   * ⚠️ WHAT IT IS NOT. It is not a read of the tenant's business: `commercial`
   * and `tenant_data` are separate classes precisely so that money ABOUT a
   * tenant is not money OF one. And the scope that travels back is `DENY_ALL` —
   * see `decide()`'s platform arm — so this opens a verb and never a dimension.
   */
  commercial: true,
  /**
   * 🛑 REFUSED, AND THE SPLIT FROM `commercial` DIRECTLY ABOVE IS THE ARGUMENT
   * RATHER THAN AN INCONSISTENCY. `CAPABILITY_RESOURCE_CLASS` states why these
   * are two classes and not one: *"the measurement inverts to volume and the
   * money does not."* Invariant 5 — *"A raw usage record is volume in the
   * clear"* — and §11.9a keeps `view_metering` out of every partner mask scope,
   * ever, on that ground. The line this arm draws is the record's own: **the
   * DERIVED money is reachable and the RAW measurement is not.**
   *
   * ⚠️ AND THIS ONE IS A JUDGEMENT AND IS FLAGGED AS ONE. There is a real case
   * that the platform, which MINTS the `UsageRecord` through the `system` actor
   * kind, should be able to read it. That case was not taken here because taking
   * it is a widening and a widening is an act — the same posture
   * `PERMITTED_RESOURCES` records for `commercial`, `metering` and `schedule`:
   * *"Left closed deliberately."*
   */
  metering: false,
  /**
   * Vacuous and answered: no capability maps here. §11.9a — the missing verb is
   * `arm_schedule`, the blocker is that *"an armed schedule must PIN a scope at
   * arming, where every other capability resolves one at use"*, and minting it
   * is not this slice's to do.
   */
  schedule: false,
  /**
   * Vacuous and answered: no capability maps here either, and `governance.ts`
   * records that as *"an INCONSISTENCY rather than a statement"* (HANDOFF §8
   * item 1g). Refusing is the answer that does not pre-empt that ruling; `true`
   * would decide it by side effect, in the wrong file.
   */
  telemetry: false,
  /**
   * 🛑 R10, 1 Oct 2026 — THE OWNER'S, AND ALL THREE ARE `false` FOR ONE
   *    REASON STATED ONCE RATHER THAN THREE TIMES: they are
   *    `PARTNER_ONLY_RESOURCE_CLASSES`, a partner firm's OWN surface, and a
   *    platform role reaching one would be 1CloudHub's staff acting AS THE
   *    PARTNER — staking a claim in its name, resetting its sandbox, inviting
   *    to its roster. `decide()`'s platform arm refuses these at
   *    `capability_is_partner_only` BEFORE this table is read, and the
   *    entries agree with that branch so the two cannot drift.
   *
   * ⚠️ THE PLATFORM'S OWN ACTS ON THESE SUBJECTS ARE REAL AND ARE NOT THESE
   *    VERBS. Accepting or refusing a registration (`acceptRegistration`,
   *    `refuseRegistration`) acts on the platform's QUEUE of claims made to
   *    it, and provisioning a sandbox plane is `provision_substrate`. Neither
   *    is decided here and neither is opened by a `true` on this row.
   */
  deal: false,
  sandbox: false,
  partner_staff: false,
}

/* ------------------------------------------------------------------ *
 * 6c. A partner firm's OWN staff — R10, 1 Oct 2026, THE OWNER'S RULING
 * ------------------------------------------------------------------ */

/*
 * *"Partner role tables + a fifth arm: new partner_role /
 * partner_role_assignment tables keyed on partnerId, decide() gains a fifth
 * arm, and new resource classes for deals / sandbox / partner staff."*
 *
 * 🛑 THE THREE-PART QUESTION `docs/build/completion-plan.md` §4 R10 POSED, AND
 *    WHERE EACH ANSWER LIVES:
 *      · THE AUTHORITY INSTRUMENT — `PartnerRole` × `PartnerRoleAssignment`
 *        below, stored by `db/migrations/0250_partner_role.sql`.
 *      · THE TAXONOMY — `deal`, `sandbox`, `partner_staff` in
 *        `ACCESS_RESOURCE_CLASSES`, fenced by `PARTNER_ONLY_RESOURCE_CLASSES`.
 *      · THE ARM — `decide()`'s fifth, entered only for a capability classed
 *        into that list.
 *
 * 🛑 IT IS NOT A FIFTH ORGANISATION CLASS AND MUST NOT BECOME ONE.
 *    `ORG_CLASSES` is still three. The principal is a `partner` principal —
 *    `orgFor(connection.owner)` says so, from the door — and the fifth arm is
 *    a fifth way that SAME principal can be answered, dispatched on the
 *    CAPABILITY's class rather than on who is asking. A partner asking for
 *    `view_exception` still goes down the tenant partner arm, still needs a
 *    live `PartnerAccessGrant`, and `partnerHeld` is never read for it.
 *
 * 🛑 INVARIANT 2 IS UNTOUCHED, AND THE ARGUMENT IS ONE SENTENCE: none of the
 *    three classes is a read into any tenant. The single cross-tenant path —
 *    *"`partner_admin(P)` may read tenant `T` iff `T.partnerId = P`, and only
 *    within a live `PartnerAccessGrant` beyond commercial metadata"* — is still
 *    the only one, because nothing on this arm can name a `TenantId`.
 */

/** One person holding one PARTNER-PORTAL role. Its own brand, for `PlatformRoleAssignmentId`'s reason. */
export type PartnerRoleAssignmentId = Id<'PartnerRoleAssignment'>

/**
 * A portal role inside ONE partner firm — partner administrator, partner user,
 * partner delivery (the third holds nothing: `User Journeys` P7, *"the role
 * exists in the partner's org chart and has no access here"*).
 *
 * 🛑 KEYED ON `partnerId` AND NOT `TenantScoped`, AND BOTH HALVES ARE THE
 *    DECLARATION. Not tenant-scoped: a firm's roster is held in no tenant, so
 *    there is no `tenantId` and no way to write a partner role that names a
 *    customer tenant. Keyed on the partner: the role is ONE FIRM's, and the
 *    fifth arm refuses a role whose `partnerId` is not the principal's
 *    (`partner_staff_other_partner`) — the pairing check the platform arm
 *    deliberately does not have, because 1CloudHub is one organisation and
 *    partners are many.
 *
 * ⚠️ NO `defaultScope` AND NO `stakeholderClass`. Every `AssignmentScope`
 *    dimension narrows TENANT business data and every `StakeholderClass` is a
 *    position inside a customer tenant; neither has a meaning here, and a
 *    field whose only honest value is `DENY_ALL` is one whose careless value
 *    is `UNSCOPED`.
 *
 * ⚠️ NO `packId` AND NO `origin`: a pack may not ship a partner role, for
 *    `PlatformRole`'s reason — a pack is a customer-installed artefact.
 */
export interface PartnerRole {
  id: RoleId
  partnerId: PartnerId
  /** "Partner administrator", "Partner user", "Partner delivery". */
  label: string
  /** Stable within the firm. */
  key: string
  /** Immutable on write. `PartnerRoleAssignment.roleVersion` pins it. */
  version: number
  /** Composed from the one closed set. The fifth arm reads only the partner-only members. */
  capabilities: readonly Capability[]
  status: 'active' | 'archived'
}

/**
 * One partner person, one portal role in their own firm, bounded in time.
 *
 * 🛑 `expiresAt` IS NOT NULLABLE — `DURABLE_ASSIGNMENT_PERMITTED.partner` is
 *    `false` (*"Only the customer row may hold a durable `RoleAssignment`"*),
 *    and here that is made UNREPRESENTABLE rather than checked, exactly as
 *    `PlatformRoleAssignment` does it. `durable_assignment_forbidden_for_org`
 *    therefore cannot arise on the fifth arm.
 *
 * ⚠️ AND IT CARRIES NO `TenantId` ANYWHERE. A partner who needs to act inside
 *    a customer tenant does it through that customer's `PartnerAccessGrant` —
 *    invariant 2's one path. **If a `tenantId` is ever added here, invariant 2
 *    has a second path, written in a field.**
 */
export interface PartnerRoleAssignment {
  id: PartnerRoleAssignmentId
  partnerId: PartnerId
  userId: UserId
  roleId: RoleId
  roleVersion: number
  grantedBy: UserId
  grantedAt: Timestamp
  /** NOT NULLABLE. See the note on this interface. */
  expiresAt: Timestamp
  revokedAt: Timestamp | null
}

/** One partner role a principal holds, resolved — the mirror of `HeldPlatformAssignment`. */
export interface HeldPartnerAssignment {
  role: PartnerRole
  assignment: PartnerRoleAssignment
}

/* ------------------------------------------------------------------ *
 * decide() — the single evaluator
 * ------------------------------------------------------------------ */

/**
 * WHO IS ASKING, resolved. Everything `decide()` needs and nothing it can get
 * from a request payload.
 *
 * `tenantId` and `orgClass` are DERIVED SERVER-SIDE at session establishment —
 * invariant 1 ("tenant scope is derived from the session, never read from a
 * request") and §9.2 respectively. Passing them in a parameter object is a
 * shape, not a licence: a caller that lifts either out of a payload has broken
 * the invariant before this function is reached, and no check here can detect
 * it.
 */
export interface PrincipalContext {
  /**
   * A USER, NEVER AN AGENT — see `AGENTS_HOLD_ROLES` at the foot of this file.
   * The type carries `status` because §8.6 surfaced that `User.status:
   * 'disabled'` was consulted by NOTHING: `assignmentGrants()` took no user, so
   * a disabled person's assignments still evaluated as granted and `canGrant()`
   * would accept a disabled granter. That bug was invisible precisely because
   * "deny is not representable" told a reader there was nothing to check.
   *
   * Structurally narrowed to `{ userId, status }` rather than taking `User`, so
   * that no evaluation can reach an email, a display name, or the
   * `identityProvider` field the org axis is derived from. Org arrives already
   * derived, on this context.
   */
  subject: { userId: UserId; status: 'active' | 'disabled' }
  /**
   * 🛑 NULLABLE SINCE G728, 19 Sep 2026, AND `null` MEANS *"THIS PRINCIPAL IS
   * ON A SURFACE THAT HAS NO TENANT"* — a console host, under the owner's
   * ruling of the same day. ⚠️ **IT WAS `TenantId` AND THE CHANGE IS RECORDED
   * RATHER THAN MADE QUIETLY**, because every arm below but one compares it.
   *
   * **Only the PLATFORM arm can answer for a `null`, and that is a property of
   * the arm rather than a permission this field grants.** §6a's loop already
   * says so in its own voice — *"THERE IS NO TENANT PAIRING CHECK HERE AND ITS
   * ABSENCE IS THE POINT … neither `PlatformRole` nor `PlatformRoleAssignment`
   * extends `TenantScoped`, so there is no tenant on either row to disagree
   * with anything"* — so widening this field reaches a branch that was already
   * tenant-free, and changes nothing about what it permits.
   *
   * 🛑 EVERY OTHER ARM REFUSES A `null` AT ONE GUARD, BY NAME
   * (`principal_holds_no_tenant`), AND THE GUARD IS NOT OPTIONAL. Without it
   * the customer loop's `role.tenantId !== principal.tenantId` would compare a
   * `TenantId` against `null`, which is `true` for every row and therefore
   * `tenant_mismatch` for every assignment — a refusal, so the direction is
   * safe, and **a refusal with the wrong reason, which an auditor would read as
   * *the role is in the wrong tenant* when what happened is *this caller has
   * none*.** A guard that is correct only because a later comparison happens
   * to fail closed is §5.1.
   */
  tenantId: TenantId | null
  /** Derived from the identity connection's owner at session establishment. */
  orgClass: OrgClass
  /** The partner whose directory authenticated them. Null unless `partner`. */
  partnerId: PartnerId | null
  /** The live `PartnerAccessGrant`, in full terms. Null unless `partner`. */
  partnerGrant: PartnerGrantTerms | null
  /**
   * 🛑 NULLABLE SINCE G728, AND IT COMPLETES A SYMMETRY `platformHeld` HAS HAD
   * SINCE G289: **`[]` DENIES AND `null` REFUSES.** ⚠️ **THIS FIELD WAS
   * `readonly HeldAssignment[]` AND THE WIDENING IS RECORDED RATHER THAN MADE
   * QUIETLY**, because a security term gaining a `null` is the change a reader
   * must see the argument for.
   *
   * `server/data-plane/authorise.ts` states the distinction in capitals —
   * *"An empty array means a reader ran and found no assignments; `null` means
   * there is no reader at all. Collapsing them would make 'nobody has granted
   * this person anything' and 'we cannot tell' the same answer, and only one of
   * those is a fact."* Until now `PrincipalContext` could not express the
   * second, so that distinction lived one layer out and died at this boundary.
   *
   * 🛑 THE CASE THAT FORCED IT IS A PRINCIPAL WITH NO TENANT. A
   * `RoleAssignment` is a tenant-scoped row; a console session is bound to no
   * tenant, so there is no scope those rows could have been read under and no
   * set for `[]` to be the emptiness of. **`[]` there would assert a fact
   * about a person on the strength of a query nobody issued** — which is the
   * one thing the three states exist to prevent.
   *
   * ⚠️ AND THE REFUSAL IT PRODUCES IS REACHABLE ONLY FROM A FIXTURE TODAY,
   * WHICH IS SAID HERE RATHER THAN LEFT TO BE FOUND. `principalContextFor()`
   * refuses a `null` on a surface that HAS a tenant, and the tenant guard in
   * `decide()` catches every surface that does not — so no served request can
   * reach `assignments_unreadable`. `tests/model/console-principal.test.ts` §3
   * builds the context directly and requires it, which is
   * `tests/model/platform-arm.test.ts`'s own method for the ABSENT state of
   * `platformHeld`: *"it destructures the term away … and requires
   * `platform_assignment_unreadable`."*
   */
  held: readonly HeldAssignment[] | null
  /**
   * The PLATFORM role assignments this principal holds, in no tenant. **G289,
   * 19 Sep 2026.** Read by the platform arm and by nothing else.
   *
   * 🛑 THREE STATES, AND COLLAPSING ANY TWO OF THEM DELETES A CONTROL. This is
   * `server/data-plane/authorise.ts`'s rule quoted rather than re-derived —
   * *"`held: []` DENIES, AND `held: null` REFUSES … An empty array means a
   * reader ran and found no assignments; `null` means there is no reader at
   * all. Collapsing them would make 'nobody has granted this person anything'
   * and 'we cannot tell' the same answer, and only one of those is a fact."*
   *
   *   ABSENT   the caller does not know this term exists → `platform_assignment_unreadable`
   *   `null`   a reader was asked and there is none      → `platform_assignment_unreadable`
   *   `[]`     a reader ran, the person holds none       → `platform_assignment_absent`
   *
   * ⚠️ IT IS OPTIONAL, AND THAT IS A FENCE RATHER THAN A DESIGN — SAY SO LOUDLY,
   * BECAUSE AN OPTIONAL SECURITY TERM IS A WEAKER FENCE THAN A REQUIRED ONE AND
   * A LATER READER MUST NOT MISTAKE IT FOR A CHOICE. A required field would make
   * every construction site declare its answer, which is strictly better; the
   * only construction site outside `tests/` is
   * `server/data-plane/authorise.ts`'s `principalContextFor()`, and this slice
   * was fenced out of `server/`. **Making it required, and giving
   * `PrincipalSubstrate` the matching `platformHeld: … | null` term, is owed.**
   *
   * 🛑 WHAT MAKES THE INTERIM SAFE IS THE DIRECTION OF THE DEFAULT, NOT THE
   * FENCE. An omitted term is `undefined`, `undefined` is read as "no reader",
   * and "no reader" is a REFUSAL with a name. There is no value of this field —
   * including its absence — that permits anything. A caller who forgets it
   * loses authority; a caller can never gain any by forgetting.
   *
   * ⚠️ AND IT IS NOT THE ORG TERM. `orgClass` still arrives from
   * `orgFor(connection.owner)` and is never inferred from this field: holding a
   * platform role proves nothing about which directory authenticated anybody,
   * and G289's own prohibition is *"it must not infer an `OrgClass`. A
   * membership proves nothing about organisation."* The arm reads this term only
   * AFTER `orgClass` has already said `platform`.
   */
  platformHeld?: readonly HeldPlatformAssignment[] | null
  /**
   * R10, 1 Oct 2026 — the fifth arm's term. The partner firm's own portal-role
   * assignments, read by `server/data-plane/identity.ts`'s `readPartnerHeld()`.
   *
   * OPTIONAL, and three-state, for `platformHeld`'s reason exactly: ABSENT and
   * `null` are *"no reader ran"* and refuse at
   * `partner_staff_assignment_unreadable`; `[]` is *"a reader ran and they hold
   * none"* and refuses at `partner_staff_assignment_absent`. **Read ONLY on the
   * fifth arm**, which is entered only for a `PARTNER_ONLY_RESOURCE_CLASSES`
   * capability — so nothing in this field can ever confer a tenant capability.
   */
  partnerHeld?: readonly HeldPartnerAssignment[] | null
  /**
   * THE ONE `TenantAccessGrant` THIS PRINCIPAL PRESENTS INTO THE BOUND TENANT —
   * **G2591, 1 Oct 2026, applying G2407, THE OWNER'S RULING: *"Full staff-grant
   * branch — decide() honours the delivery grant's whole class set on every
   * mounted operation."*** Read on the PLATFORM arm and nowhere else.
   *
   * OPTIONAL, and `null`/ABSENT both mean *"no grant was offered"*, which on
   * this term is a FACT rather than an unreadable substrate: the reader
   * (`readStaffGrant()`) already refuses the request outright when it cannot
   * tell — `server/data-plane/session.ts` answers 401 on a failed read rather
   * than passing `null` — so a `null` reaching here is *"a reader ran and this
   * person holds no grant into this tenant"*. The platform arm then answers
   * from `platformHeld` exactly as it did before this term existed.
   *
   * 🛑 IT IS NEVER A SOURCE OF A TENANT. `grant.tenantId` is COMPARED against
   * `principal.tenantId` — which came from the HOST, invariant 1 — and a
   * disagreement refuses. And it never infers an organisation: the term is
   * read only after `orgClass` has already said `platform` (G289's
   * prohibition, unchanged).
   */
  staffGrant?: HeldStaffGrant | null
  /**
   * Evaluation time, supplied rather than read from a clock so a decision is
   * reproducible in an audit. `RoleAssignment.expiresAt` existed and was
   * READ BY NOTHING; this parameter is what makes it load-bearing.
   */
  now: Timestamp
}

/**
 * Why a decision came out the way it did. CLOSED, and closed for a reason.
 *
 * `canGrant()` returned `` `granter_lacks_${capability}` `` — a
 * template-interpolated string, which is a FREE-TEXT REASON with a
 * customer-visible surface. It cannot be switched on, cannot be counted,
 * cannot be translated, and drifts the moment a capability is renamed. That is
 * the same bug `PolicyReasonCode` was created to fix, reappearing one module
 * over. The offending capability travels in its own field on the result, where
 * a reader can use it.
 */
export const DECISION_REASONS = {
  permitted: 'permitted',
  /** The principal's directory account is disabled. §8.6. */
  subject_not_active: 'subject_not_active',
  /** Role, assignment and requested tenant do not agree. */
  tenant_mismatch: 'tenant_mismatch',
  /** The assignment does not belong to the role it was resolved against. */
  assignment_role_mismatch: 'assignment_role_mismatch',
  assignment_expired: 'assignment_expired',
  assignment_revoked: 'assignment_revoked',
  role_not_active: 'role_not_active',
  /** The pinned version and the live role have diverged. */
  role_version_moved: 'role_version_moved',
  /**
   * ⛔ Platform staff hold no assignments at all. `TenantAccessGrant` is the path.
   *
   * 🛑 **NO LONGER REACHABLE FROM `decide()`, AND IT IS KEPT RATHER THAN DELETED
   * — G289, 19 Sep 2026.** This member WAS the second step of the evaluator, and
   * its sentence above is now false as a statement of law: a platform principal
   * is EVALUATED, against a `PlatformRoleAssignment`, and refused by name at one
   * of the platform reasons below.
   *
   * IT STAYS FOR TWO REASONS, EITHER SUFFICIENT. **A `DecisionReason` is an
   * AUDIT vocabulary, not only a return value** — every decision taken before
   * this commit that touched a platform principal carries this string, and a
   * closed set that drops a member makes those rows unreadable rather than
   * historical. And `docs/contracts/administration.openapi.yaml` names it in its
   * own description as the argument all fifty-nine of its `exempt:` reasons are
   * short for, pinned by `tests/contracts/administration-wire.test.mjs`
   * assertion J5.
   *
   * ⚠️ THAT CONTRACT'S §2 ARGUMENT IS NOW PARTLY STALE AND THIS SLICE WAS FENCED
   * OUT OF `docs/contracts/`. It reads *"Every platform principal is denied
   * before any capability is looked at."* After G289 a platform principal is
   * denied for a capability whose CLASS this arm refuses — which is twelve
   * classes of thirteen, so twenty-five of its twenty-six `platform-role`
   * operations are unaffected in substance. The one that moves is `commercial`.
   * Re-arguing that section belongs to whoever takes the tier's registration.
   */
  platform_org_holds_no_assignment: 'platform_org_holds_no_assignment',

  /* --- the platform arm. G289, 19 Sep 2026. Order below is EVALUATION order --- */

  /**
   * 🛑 `statutory`. `NON_DELEGABLE_RESOURCES`, tested FIRST — before the term
   * check, before revocation, before expiry, before anything — for
   * `authorisationPermits()`'s reason: *"a first-position refusal makes every
   * later list a no-op for the classes it names."* Invariant 8 says *"at any
   * price"*, and a price is exactly what a later branch could become.
   */
  platform_class_never_delegable: 'platform_class_never_delegable',
  /**
   * `authority`. `CONTRACT_ONLY_RESOURCES`: only a signed `SupportAuthorisation`
   * opens the class, and a platform role assignment is not one — §8.7's
   * distinction is that the platform decides `PERMITTED_RESOURCES` and the
   * CUSTOMER decides a contract.
   */
  platform_class_contract_only: 'platform_class_contract_only',
  /**
   * The capability's resource class is not reachable by a platform role
   * assignment at all — `PLATFORM_ASSIGNMENT_REACHES`. EIGHT classes land here,
   * `tenant_data` foremost, and each is argued at its own entry in that table.
   * ⚠️ **This said TEN until 19 Sep 2026**, when G601 opened `substrate` and
   * `catalogue`; derive it from that table rather than reading this line.
   */
  platform_class_out_of_reach: 'platform_class_out_of_reach',
  /**
   * 🛑 THE CONTEXT COULD NOT SAY. `platformHeld` is absent or `null` — there is
   * no reader, which is the state of the tree today. **This is NOT "they hold
   * none"**, and the two must never be reported as one: one is a fact about a
   * person and the other is a fact about our substrate.
   */
  platform_assignment_unreadable: 'platform_assignment_unreadable',
  /** A reader ran and this principal holds no platform role assignment. */
  platform_assignment_absent: 'platform_assignment_absent',
  platform_assignment_revoked: 'platform_assignment_revoked',
  /**
   * ⚠️ NOT THE SAME REFUSAL AS `platform_assignment_revoked`, AND THEY ARE TWO
   * MEMBERS RATHER THAN ONE DELIBERATELY. A revocation is an ACT somebody took
   * and is answerable; an expiry is a clock arriving and is nobody's act. An
   * audit that cannot tell them apart cannot answer *"who took this away"*.
   */
  platform_assignment_expired: 'platform_assignment_expired',
  platform_role_not_active: 'platform_role_not_active',
  /** The pin and the live platform role have diverged. §10.5 — see the field. */
  platform_role_version_moved: 'platform_role_version_moved',
  /** Live platform assignments exist; none carries this capability. */
  no_platform_assignment_carries_capability:
    'no_platform_assignment_carries_capability',
  /**
   * 🛑 THE CAPABILITY'S CLASS IS THE PLATFORM'S OWN AND THE CALLER IS NOT THE
   * PLATFORM — `PLATFORM_ONLY_RESOURCE_CLASSES`. G601, 19 Sep 2026.
   *
   * Reached from the CUSTOMER and PARTNER arms, at their first line, and never
   * from the platform arm. It is the mirror of
   * `platform_class_out_of_reach`: that one says *this class is not the
   * platform's to reach by assignment*, this one says *this class is not the
   * tenant's to reach at all*.
   *
   * ⚠️ IT IS A REFUSAL ABOUT THE VERB AND NOT ABOUT THE ROW, which is why it
   * is tested before the assignment loop rather than inside it. A tenant role
   * carrying `publish_catalogue` is a MALFORMED ROLE — `db/migrations/0009`
   * types `tenant.role_capability.capability` as bare `text`, so the database
   * will store one — and the honest answer is that the verb was never
   * available here, not that this particular assignment failed to carry it.
   * Reporting it as `no_assignment_carries_capability` would tell an auditor
   * to go and grant the role, which is the one remedy that must not work.
   */
  capability_is_platform_only: 'capability_is_platform_only',

  /* --- the fifth arm. R10, 1 Oct 2026. Order below is EVALUATION order --- */

  /**
   * G601's fence, mirrored: a capability classed into
   * `PARTNER_ONLY_RESOURCE_CLASSES`, asked for by a customer or a platform
   * principal. Refused before any role or grant is read, on both arms.
   */
  capability_is_partner_only: 'capability_is_partner_only',
  /**
   * A partner principal whose `partnerId` did not resolve. The firm the arm
   * compares every row against is unknown, so nothing can be compared and the
   * answer is a refusal rather than a match against `null`.
   */
  partner_staff_partner_unresolved: 'partner_staff_partner_unresolved',
  /** `partnerHeld` absent or `null` — no reader ran. Never `[]`. */
  partner_staff_assignment_unreadable: 'partner_staff_assignment_unreadable',
  partner_staff_assignment_absent: 'partner_staff_assignment_absent',
  /**
   * 🛑 THE CHECK THE PLATFORM ARM DOES NOT HAVE, AND WHY THIS ARM NEEDS IT: the
   * role or the assignment belongs to ANOTHER FIRM. One partner's
   * administrator holding a role row of a competitor's must reach nothing in
   * the competitor's pipeline — the RLS keys on the holder, and this is the
   * second, independent term in the evaluator.
   */
  partner_staff_other_partner: 'partner_staff_other_partner',
  partner_staff_assignment_revoked: 'partner_staff_assignment_revoked',
  partner_staff_assignment_expired: 'partner_staff_assignment_expired',
  partner_staff_role_not_active: 'partner_staff_role_not_active',
  partner_staff_role_version_moved: 'partner_staff_role_version_moved',
  no_partner_staff_assignment_carries_capability:
    'no_partner_staff_assignment_carries_capability',
  /**
   * 🛑 THE PRINCIPAL IS ON A SURFACE WITH NO TENANT AND THIS ARM NEEDS ONE —
   * G728, 19 Sep 2026. A console session under the owner's ruling of the same
   * day: `session.tenant_id` is NULL and legal, and `PrincipalContext.tenantId`
   * carries that `null` through.
   *
   * ⚠️ IT IS A FACT ABOUT THE SURFACE AND NEVER ABOUT THE PERSON, WHICH IS WHY
   * IT IS NOT `no_live_assignment` AND NOT `tenant_mismatch`. The caller may
   * hold every assignment in a tenant; they are not IN one on this request.
   * `tenant_mismatch` would tell an auditor the ROLE is in the wrong place —
   * and it is the answer the customer loop would give on its own, because
   * `role.tenantId !== null` is true for every row, which is precisely the
   * wrong-reason refusal this member exists to prevent.
   *
   * 🛑 UNREACHABLE FROM THE PLATFORM ARM BY POSITION RATHER THAN BY CHECK: that
   * arm returns above this guard and reads no tenant at all. A console
   * principal whose organisation is `platform` is therefore evaluated
   * NORMALLY — which is the whole point of the owner's ruling — and one whose
   * organisation is `customer` or `partner` lands here.
   */
  principal_holds_no_tenant: 'principal_holds_no_tenant',
  /**
   * 🛑 NO READER RAN FOR THE TENANT ASSIGNMENTS — G728, and it is
   * `platform_assignment_unreadable`'s twin on the other instrument. **`held:
   * []` DENIES with `no_live_assignment`; `held: null` REFUSES with this.**
   * One is a fact about a person and the other is a fact about our substrate,
   * and `server/data-plane/authorise.ts` forbids collapsing them in capitals.
   *
   * ⚠️ UNREACHABLE FROM A SERVED REQUEST AND SAID SO PLAINLY.
   * `principalContextFor()` refuses a `null` on any surface that HAS a tenant,
   * and `principal_holds_no_tenant` above catches every surface that does not,
   * so the only caller that can produce this is one constructing a
   * `PrincipalContext` directly. That is a FIXTURE, and
   * `tests/model/console-principal.test.ts` §3 is it — the same standing this
   * module already gives `platform_assignment_unreadable`'s ABSENT state,
   * which `tests/model/platform-arm.test.ts` witnesses by destructuring the
   * term away. **A guard that cannot be reached over HTTP is still the
   * difference between a refusal and a `TypeError` the day somebody adds a
   * second construction site.**
   */
  assignments_unreadable: 'assignments_unreadable',
  /** A non-customer organisation held an assignment that never expires. */
  durable_assignment_forbidden_for_org: 'durable_assignment_forbidden_for_org',
  partner_grant_absent: 'partner_grant_absent',
  partner_grant_expired: 'partner_grant_expired',
  partner_grant_revoked: 'partner_grant_revoked',
  /** The grant belongs to a different partner than the one who authenticated. */
  partner_grant_other_partner: 'partner_grant_other_partner',
  capability_outside_partner_mask: 'capability_outside_partner_mask',
  /** Nothing survived to be tested for the capability. */
  no_live_assignment: 'no_live_assignment',
  /** Live assignments exist; none carries this capability. */
  no_assignment_carries_capability: 'no_assignment_carries_capability',

  /* --- the staff-grant branch of the platform arm. G2591, 1 Oct 2026 --- */

  /**
   * A staff grant was presented and is not live for THIS person in THIS
   * tenant — revoked, expired, past `MAX_GRANT_HOURS`, another person's,
   * another tenant's, unreadable, or naming a class the three lists refuse
   * (the grant fails whole). **One name for all of them, deliberately**: it is
   * `selectTenantForSession()`'s `accessGrantAbsent` collapse carried one layer
   * in, for the same oracle reason — the reason travels to a log, and which
   * term failed is not the caller's to learn.
   */
  staff_grant_not_live: 'staff_grant_not_live',
  /** A staff grant on a principal with NO tenant. A grant reaches a tenant or nothing. */
  staff_grant_without_tenant: 'staff_grant_without_tenant',
  /** The grant is live and none of its lines names the class this capability touches. */
  staff_grant_class_not_granted: 'staff_grant_class_not_granted',
  /**
   * The grant names the class and `authorisationPermits()` refuses it for the
   * grant's purpose. Unreachable today — a grant naming such a class already
   * fails whole at `staff_grant_not_live` — and kept so the second call to the
   * three-list helper has its own name if the first is ever moved.
   */
  staff_grant_beyond_purpose: 'staff_grant_beyond_purpose',

  /* --- minting and redeeming an authorisation. §11, 5 Aug 2026 --- */

  /**
   * The requested lifetime is not positive, is not finite, or exceeds
   * `MAX_AUTHORIZATION_SECONDS` for the resource class. Both ends refuse: a
   * ceiling that is never read is `MAX_GRANT_HOURS` before 5 Aug, a control
   * that existed only as a sentence — and a zero or negative lifetime mints a
   * token already expired, which is a caller bug worth naming rather than a
   * harmless no-op.
   */
  authorization_ttl_out_of_bounds: 'authorization_ttl_out_of_bounds',
  /**
   * `principal.now` did not parse, so an expiry could not be computed. A token
   * whose expiry is `NaN` compares false against every clock and therefore
   * never expires; refusing to mint one is the only safe answer.
   */
  authorization_clock_unparseable: 'authorization_clock_unparseable',
  /**
   * The named resource's class is not the class this capability touches, per
   * `CAPABILITY_RESOURCE_CLASS`. A grant for `view_document` pointed at a
   * `secret` is either a caller bug or an attempt to launder a class, and the
   * two are indistinguishable here — which is why both are refused.
   */
  authorization_resource_class_mismatch: 'authorization_resource_class_mismatch',
  authorization_expired: 'authorization_expired',
  /** The grant was minted for another tenant. Invariant 1, at redeem. */
  authorization_tenant_mismatch: 'authorization_tenant_mismatch',
  /** The grant was minted for another principal. Possession confers nothing. */
  authorization_principal_mismatch: 'authorization_principal_mismatch',
  /** Redeemed for a capability it was not minted for. */
  authorization_capability_mismatch: 'authorization_capability_mismatch',
  /** Redeemed against a resource it was not minted for. */
  authorization_resource_mismatch: 'authorization_resource_mismatch',
} as const
export type DecisionReason =
  (typeof DECISION_REASONS)[keyof typeof DECISION_REASONS]

/**
 * What actually carried the decision. An audit artefact, not an input to
 * another decision — the same rule RFC 8693 states for delegation chains:
 * prior actors are "informational only and are not to be considered in access
 * control decisions."
 */
export type DecisionVia = DecisionViaAssignment | DecisionViaStaffGrant

export interface DecisionViaAssignment {
  /**
   * ⚠️ WIDENED TO A UNION ON 19 Sep 2026 — G289 — AND A UNION IS THE HONEST
   * SHAPE RATHER THAN A CONVENIENT ONE. It read `RoleAssignmentId`. The platform
   * arm carries a `PlatformRoleAssignmentId`, which is a DIFFERENT brand over a
   * different row in a different (unwritten) table, and the two must not be
   * interchangeable — see `PlatformRoleAssignmentId`.
   *
   * 🛑 A READER MUST DISCRIMINATE BEFORE DEREFERENCING, and nothing here will
   * remind them: both brands erase to `string`, so `via` is the one place in a
   * `Decision` where an id could be looked up in the wrong table. That is
   * survivable only because of what this type already says in its own docblock —
   * `via` is *"an audit artefact, not an input to another decision"*, the same
   * rule RFC 8693 states for delegation chains. If it ever becomes an input,
   * this field needs a discriminant and this comment is the warning that it does.
   */
  assignmentId: RoleAssignmentId | PlatformRoleAssignmentId | PartnerRoleAssignmentId
  roleId: RoleId
  roleVersion: number
}

/**
 * WHAT CARRIED A STAFF-GRANT ALLOW — G2591, 1 Oct 2026, under G2407 (THE
 * OWNER'S). Invariant 10's record must NAME the instrument an act ran under,
 * and a `TenantAccessGrant` is not an assignment: it has no role and no pinned
 * version, so squeezing its id into `DecisionViaAssignment.assignmentId` would
 * be the un-discriminated id the warning above names, arriving for real.
 *
 * 🛑 SO `Decision.via` IS NOW A DISCRIMINATED UNION AND THE WARNING ABOVE IS
 * DISCHARGED RATHER THAN IGNORED: *"If it ever becomes an input, this field
 * needs a discriminant"*. It is still an audit artefact and still not an input,
 * but it now carries two KINDS of authority, and a reader that dereferences
 * the wrong one is the error the discriminant exists to make a `tsc` error.
 * The discriminant is the PRESENCE of `accessGrantId` — `'accessGrantId' in
 * via` — so every existing `{ assignmentId, roleId, roleVersion }` literal
 * stays valid unchanged and every READER that assumed one shape stops
 * compiling. That is the direction the compiler should fail in.
 */
export interface DecisionViaStaffGrant {
  accessGrantId: TenantAccessGrantId
  /** The purpose the grant was drawn for — which list `authorisationPermits()` read. */
  purpose: AccessPurpose
}

/**
 * SCOPE TRAVELS WITH THE ANSWER. Never beside it.
 *
 * `scope` is `DENY_ALL` whenever `allowed` is false, so a caller that ignores
 * the boolean and applies the scope still denies. Failing closed on the field a
 * careless reader will use is the whole reason the two are one object.
 */
export interface Decision {
  allowed: boolean
  reason: DecisionReason
  scope: AssignmentScope
  via: readonly DecisionVia[]
}

/**
 * THE SINGLE EVALUATOR. Everything that gates on a capability calls this.
 *
 * WHAT IT REPLACES, AND WHY THAT WAS UNSAFE. `assignmentGrants()` was three
 * lines — revoked, role status, `includes(capability)` — and its own comment
 * handed the rest of the decision back to the caller: "scope is checked by the
 * caller against the subject at hand." Splitting one decision across two
 * components is the structural precondition for a confused deputy, and AuthZEN
 * states the risk in its sharpest form: "a non-deterministic system acting on a
 * user's behalf, with implicitly delegated access, is exactly the setup that
 * produces confused-deputy failures." MCP's answer to the same shape was to
 * make audience validation a MUST on the server rather than a caller
 * responsibility. A two-halves API will be half-called, once.
 *
 * FOUR CHECKS THAT EXISTED IN THE TYPES AND IN NO CODE PATH ANYWHERE:
 *
 *   1. TENANT PAIRING. There was no `tenantId ===` comparison anywhere in
 *      `model/`. `Role` and `RoleAssignment` both extend `TenantScoped` and
 *      nothing ever compared the two, so a role loaded for one tenant and an
 *      assignment loaded for another evaluated cleanly together.
 *   2. `assignment.expiresAt`. Declared, documented as the thing delivery and
 *      audit assignments must carry, and read by nothing.
 *   3. `assignment.roleVersion === role.version`. The pin exists to stop a pack
 *      upgrade retroactively promoting every live holder — that is what the
 *      field's own comment says it is for — and nothing compared them. §7.4(a):
 *      five of six surveyed platforms hold an install until an admin consents,
 *      and the one that does not, Salesforce, had to invent muting permission
 *      sets afterwards to make it survivable. Narrowing is automatic; widening
 *      is an act, and an unread pin is not an act.
 *   4. `User.status`. §8.6, above.
 *
 * AND THE TERM THAT DID NOT EXIST AT ALL: the organisation. A partner's
 * authority is the intersection of the role, the mask, and a LIVE grant; a
 * platform principal holds no assignment in a customer tenant at all. Both were
 * enforced, if at all, by `effectivePartnerRole()` in another module against
 * `RoleKey`, which nothing here could reach.
 *
 * ORDER IS DELIBERATE: cheapest and most categorical first, so an audit reason
 * names the structural refusal rather than the last capability that happened to
 * be tested. Every branch fails closed, and every branch returns `DENY_ALL`.
 *
 * ⚠️ THERE ARE NOW FOUR `OrgClass` ARMS AND THERE WERE THREE — **G289,
 * 19 Sep 2026**, and this sentence is added rather than the paragraph above
 * rewritten, because the paragraph above is still exactly true. The fourth is
 * the PLATFORM arm, and until this commit step 2 refused every platform
 * principal outright, *before any capability was read*. The premise for changing
 * it was derived rather than argued: `docs/contracts/administration.openapi.yaml`
 * carries fifty-nine operations and **not one of them can name a capability**,
 * because a capability names a gate its own principal could never open. Read the
 * arm's own comment for what moved and what did not; the short version is that
 * invariant 8 moved from the ORG term to a per-CLASS table and got LONGER, not
 * weaker.
 *
 * ⚠️ AND THE COST IS NAMED ON THE RULING RATHER THAN DISCOVERED HERE: *"this
 * touches the function EVERY authorisation in the product goes through."* The
 * mitigation is `PLATFORM_ASSIGNMENT_REACHES` being total over the thirteen
 * resource classes, so no class is answered by a default.
 *
 * 🛑 AND THE PLATFORM ARM HONOURS A STAFF GRANT SINCE 1 Oct 2026 — G2591,
 * applying **G2407, THE OWNER'S RULING: *"Full staff-grant branch — decide()
 * honours the delivery grant's whole class set on every mounted operation."***
 * The owner chose this over a narrow per-operation allowlist KNOWINGLY, and
 * the cost is stated here, on the function every authorisation goes through,
 * rather than only in the branch: **a live `TenantAccessGrant` opens EVERY
 * mounted operation whose capability's resource class is on the grant and
 * that `authorisationPermits()` admits for its purpose. A delivery grant
 * naming `tenant_data` opens every mounted tenant-data read and act — the
 * exception register, proposals, approvals, execution, reversals, runs, run
 * accounts, threads and messages — to the FDE holding it, for up to 90 days,
 * with no per-document enumeration (`REQUIRES_ENUMERATION` is not consulted;
 * `decide()` takes no resource and `0008` stores no nomination) and no
 * read/write mode.** What is NOT opened at any price: `statutory` (refused at
 * 2a, and inside `authorisationPermits()` first), `authority` (contract-only,
 * and no `SupportAuthorisation` is passed), the partner-only classes, and any
 * class outside the grant's purpose. Every allow names the grant in `via`.
 */
export function decide(
  principal: PrincipalContext,
  capability: Capability,
): Decision {
  const deny = (reason: DecisionReason): Decision => ({
    allowed: false,
    reason,
    scope: DENY_ALL,
    via: [],
  })

  /* --- 1. Is there a live person at all? --- */
  if (principal.subject.status !== 'active') {
    return deny(DECISION_REASONS.subject_not_active)
  }

  /* --- 2. The org term. Categorical, and cheaper than any loop below. --- */
  if (principal.orgClass === ORG_CLASSES.platform) {
    /**
     * ⚠️ THIS BRANCH WAS ONE LINE — `return
     * deny(DECISION_REASONS.platform_org_holds_no_assignment)` — AND ITS
     * ARGUMENT IS QUOTED RATHER THAN DELETED, BECAUSE IT IS THE SENTENCE THE
     * WHOLE ADMINISTRATION TIER WAS WRITTEN AGAINST: *"BEING STAFF IS NOT ACCESS
     * (invariant 8). A platform principal reaches a tenant through
     * `TenantAccessGrant` — purpose-bound, hours-to-weeks, two-person at issue
     * and re-checked at evaluation — and never through a `RoleAssignment`.
     * Refusing here rather than in governance is what stops the assignment table
     * being a second door beside the grant."*
     *
     * ✅ **G289, 19 Sep 2026. A PLATFORM PRINCIPAL IS EVALUATED, NOT REFUSED AT
     * THE ORG TERM — AND EVERY CLAUSE OF THAT PARAGRAPH STILL HOLDS.** It is
     * moved, not dropped: *"never through a `RoleAssignment`"* is now
     * `PLATFORM_ASSIGNMENT_REACHES.tenant_data === false`, and *"a second door
     * beside the grant"* is what twelve of the thirteen entries in that table
     * refuse, one class at a time, with the argument on each. What changed is
     * that the refusal is now a fact about a CLASS instead of a fact about a
     * PERSON — which is the difference between invariant 8 and a dead end.
     *
     * 🛑 ONE EVALUATOR, EXTENDED — NOT A SECOND ONE, AND THE ARM IS INLINE FOR
     * THAT REASON. A control-plane evaluator beside `decide()` was the strongest
     * rejected alternative. This function's own header states why it lost:
     * *"Splitting one decision across two components is the structural
     * precondition for a confused deputy … A two-halves API will be half-called,
     * once."* A private helper would have been the same split wearing a smaller
     * name.
     *
     * 🛑 AND WHAT THIS ARM MUST NEVER DO, WHICH IS THE PROHIBITION G289 WRITES
     * IN CAPITALS: **IT DOES NOT INFER AN `OrgClass`.** It is reached only
     * because `principal.orgClass` ALREADY said `platform`, and that term comes
     * from `orgFor(connection.owner)` — a lookup on the directory that
     * authenticated the session — and from nowhere else. Holding a platform role
     * proves nothing about organisation, and neither does arriving on a
     * control-plane route: *"Routing chooses the door; the door decides."* An
     * arm that read its own org out of its own assignments would have relocated
     * invariant 8 rather than held it.
     *
     * ORDER IS `authorisationPermits()`'s ORDER, AND FOR ITS REASON. The class
     * questions are asked BEFORE the term questions — before the null check,
     * before revocation, before the clock — so that no absent reader, no
     * malformed row and no future edit to the branches below can reach
     * `statutory`.
     */
    const reached = CAPABILITY_RESOURCE_CLASS[capability]

    /* --- 2a. The two lists that answer before anything else does. --- */
    if (NON_DELEGABLE_RESOURCES.includes(reached)) {
      return deny(DECISION_REASONS.platform_class_never_delegable)
    }
    if (CONTRACT_ONLY_RESOURCES.includes(reached)) {
      return deny(DECISION_REASONS.platform_class_contract_only)
    }
    /* --- 2a'. R10's fence, mirrored onto this arm: a partner firm's own
     *     surface. Staff acting AS a partner is the one shape no platform
     *     role may take, and the reason names the verb rather than the table. --- */
    if (capabilityIsPartnerOnly(capability)) {
      return deny(DECISION_REASONS.capability_is_partner_only)
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * --- 2a''. THE STAFF-GRANT BRANCH — G2591, 1 Oct 2026, applying G2407,
     *     THE OWNER'S RULING: *"Full staff-grant branch — decide() honours the
     *     delivery grant's whole class set on every mounted operation."* ---
     * ═══════════════════════════════════════════════════════════════════════
     *
     * 🛑 WHY IT EXISTS. G729 let a live `TenantAccessGrant` BIND a session to a
     *    tenant, and then every gated verb was answered by `PLATFORM_ASSIGNMENT
     *    _REACHES`, which refuses `secret`, `configuration`, `identity`,
     *    `endpoint` and `tenant_data`. So invariant 8's PERMITTED path — *"Being
     *    staff is not access. Reaching a tenant requires a `TenantAccessGrant`"*
     *    — was reachable at D1 and INERT at every operation, which is G60's
     *    shape one layer down: *"the decision would have been recorded as
     *    applied while the FDE still could not bind a credential."*
     *
     * 🛑 THE COST, RECORDED AND NOT SOFTENED, BECAUSE THE OWNER CHOSE IT OVER A
     *    NARROW PER-OPERATION ALLOWLIST KNOWINGLY. A live grant opens EVERY
     *    MOUNTED OPERATION whose capability's class is on the grant and that
     *    `authorisationPermits()` admits for the grant's purpose — not one
     *    write. `PERMITTED_RESOURCES.delivery` INCLUDES `tenant_data`, so an FDE
     *    holding a delivery grant that names `tenant_data` reads and acts on
     *    every exception, proposal, run, thread and message route this plane
     *    mounts, for up to `MAX_GRANT_HOURS.delivery` (90 days). The same
     *    mechanism holds for an `incident` grant, whose list also names
     *    `tenant_data`. Three further things are NOT enforced here and the
     *    reason is structural rather than an oversight:
     *      (a) `REQUIRES_ENUMERATION` — `delivery` × `tenant_data` is meant to
     *          reach only the documents the customer nominated, and `decide()`
     *          takes no resource, while `db/migrations/0008` stores no
     *          `nominated_subject_ids` at all. The enumeration is NOT honoured
     *          on any mounted operation.
     *      (b) the line's `mode` (read/write) — `0008` stores none and nothing in
     *          `model/` records a capability's mode, so a grant line reaches the
     *          class's every verb.
     *      (c) `evaluateTenantAccess()`'s five use-time terms — customer
     *          notification, two-person issue, idle lapse, engagement reference
     *          and the tenant's `supportAccessMode` — each need a parameter this
     *          function refuses to carry.
     *    What survives, and it is not nothing: `statutory` is refused at 2a
     *    before this branch is reached and again inside `authorisationPermits()`
     *    (invariant 8's *"at any price"*); `authority` is refused at 2a
     *    (`CONTRACT_ONLY_RESOURCES`, and this branch passes no
     *    `SupportAuthorisation`); the grant must be LIVE on G292's three terms
     *    for THIS person in THIS host-bound tenant; and every allow names the
     *    grant in `via`, so invariant 10's record says which grant an act ran
     *    under.
     *
     * 🛑 ONE EVALUATOR. This branch is inline in `decide()` for G289's reason —
     *    *"a private helper would have been the same split wearing a smaller
     *    name"* — and the liveness predicate it calls is the SAME function
     *    `selectTenantForSession()` binds on, `holdsLiveStaffGrant()`, so
     *    selection and use cannot disagree about whether a grant is live.
     *
     * ⚠️ ORDER. After 2a, so `statutory`, `authority` and the partner-only verbs
     *    are refused before any grant term is read; before 2b, because 2b is
     *    the assignment instrument's table and a grant is a different
     *    instrument. A grant that does not carry the class falls through to the
     *    assignment path unchanged, so nothing a platform role could do before
     *    is narrowed by holding a grant.
     */
    const staffGrant = principal.staffGrant ?? null
    let staffGrantRefusal: DecisionReason | null = null
    if (staffGrant !== null) {
      if (principal.tenantId === null) {
        staffGrantRefusal = DECISION_REASONS.staff_grant_without_tenant
      } else if (
        !holdsLiveStaffGrant({
          grant: staffGrant,
          userId: principal.subject.userId,
          tenantId: principal.tenantId,
          now: principal.now,
        })
      ) {
        staffGrantRefusal = DECISION_REASONS.staff_grant_not_live
      } else if (!staffGrant.resources.some((line) => line.resource === reached)) {
        staffGrantRefusal = DECISION_REASONS.staff_grant_class_not_granted
      } else if (
        !authorisationPermits(null, staffGrant.purpose, reached, staffGrant.staffUserId)
          .permitted
      ) {
        staffGrantRefusal = DECISION_REASONS.staff_grant_beyond_purpose
      } else {
        return {
          allowed: true,
          reason: DECISION_REASONS.permitted,
          /**
           * 🛑 `DENY_ALL`, FOR THE PLATFORM ALLOW's REASON BELOW AND ONE MORE.
           * A grant carries no `AssignmentScope`; returning `UNSCOPED` would
           * ASSERT an unrestricted scope nothing granted. No mounted handler
           * applies `decision.scope` today (the seeded customer holdings carry
           * `DENY_ALL` too), so the REACH of this allow is the class set — which
           * is exactly the cost the header above records.
           */
          scope: DENY_ALL,
          via: [{ accessGrantId: staffGrant.id, purpose: staffGrant.purpose }],
        }
      }
    }

    /* --- 2b. And the table that answers the other eleven, each argued. --- */
    if (!PLATFORM_ASSIGNMENT_REACHES[reached]) {
      /* A grant that was presented and refused names ITS reason: the auditor's
       * question is "why did the grant not carry this", not "why did a role". */
      return deny(staffGrantRefusal ?? DECISION_REASONS.platform_class_out_of_reach)
    }

    /* --- 2c. Only now, the term — and its ABSENCE is a refusal with a name. --- */
    const platformHeld = principal.platformHeld ?? null
    if (platformHeld === null) {
      return deny(DECISION_REASONS.platform_assignment_unreadable)
    }

    /* --- 2d. Per platform assignment. First structural refusal wins. --- */
    const platformCarrying: HeldPlatformAssignment[] = []
    const platformRefusals: DecisionReason[] = []
    let sawLivePlatformAssignment = false

    for (const holding of platformHeld) {
      const { role, assignment } = holding

      /**
       * ⚠️ THERE IS NO TENANT PAIRING CHECK HERE AND ITS ABSENCE IS THE POINT.
       * The tenant arm below compares `role.tenantId` and `assignment.tenantId`
       * against `principal.tenantId` because all three exist. Neither
       * `PlatformRole` nor `PlatformRoleAssignment` extends `TenantScoped`, so
       * there is no tenant on either row to disagree with anything — invariant 8
       * held by the shape of the record rather than by this loop remembering to
       * ask. `tenant_mismatch` cannot arise on this arm.
       *
       * ⚠️ AND NEITHER CAN `durable_assignment_forbidden_for_org`.
       * `PlatformRoleAssignment.expiresAt` is `Timestamp`, not
       * `Timestamp | null`, so `DURABLE_ASSIGNMENT_PERMITTED.platform === false`
       * is unrepresentable here rather than checked. The reason member stays
       * reachable from the tenant arm, where a partner CAN still write one.
       */
      if (assignment.roleId !== role.id) {
        /* Reused rather than minted: the fact is the same fact and it names no
         * organisation. A reason per arm for an identical structural error is
         * vocabulary growth without information. */
        platformRefusals.push(DECISION_REASONS.assignment_role_mismatch)
        continue
      }
      if (assignment.revokedAt !== null) {
        platformRefusals.push(DECISION_REASONS.platform_assignment_revoked)
        continue
      }
      /* Lexical string comparison on ISO-8601 UTC, matching every other expiry
       * check in this module. `<=` and not `<`: an assignment expiring exactly
       * now is expired. */
      if (assignment.expiresAt <= principal.now) {
        platformRefusals.push(DECISION_REASONS.platform_assignment_expired)
        continue
      }
      if (role.status !== 'active') {
        platformRefusals.push(DECISION_REASONS.platform_role_not_active)
        continue
      }
      if (assignment.roleVersion !== role.version) {
        platformRefusals.push(DECISION_REASONS.platform_role_version_moved)
        continue
      }

      sawLivePlatformAssignment = true
      if (roleCarries(role, capability)) platformCarrying.push(holding)
    }

    if (platformCarrying.length === 0) {
      if (sawLivePlatformAssignment) {
        return deny(DECISION_REASONS.no_platform_assignment_carries_capability)
      }
      return deny(
        platformRefusals[0] ?? DECISION_REASONS.platform_assignment_absent,
      )
    }

    return {
      allowed: true,
      reason: DECISION_REASONS.permitted,
      /**
       * 🛑 `DENY_ALL` ON AN ALLOW, DELIBERATELY, AND IT IS THE MOST SURPRISING
       * LINE IN THIS FUNCTION. Every dimension of `AssignmentScope` narrows
       * TENANT BUSINESS DATA — domains, definitions, solutions, cost centres,
       * legal entities, and a value ceiling on money moved. The only class this
       * arm can reach is `commercial`, which none of those six addresses.
       * Returning `UNSCOPED` would hand a caller an unrestricted scope over six
       * tenant dimensions on the strength of a staff assignment — **invariant 8
       * undone by the scope field instead of by the boolean**, and this
       * interface's own rule is that *"a caller that ignores the boolean and
       * applies the scope still denies."* A platform allow is a VERB and never a
       * DIMENSION; `tests/model/platform-arm.test.ts` pins it.
       */
      scope: DENY_ALL,
      via: platformCarrying.map((h) => ({
        assignmentId: h.assignment.id,
        roleId: h.role.id,
        roleVersion: h.assignment.roleVersion,
      })),
    }
  }
  /**
   * --- 2e. THE MIRROR OF 2a/2b, FOR EVERY ARM THAT IS NOT THE PLATFORM'S.
   *     G601, 19 Sep 2026, AND IT IS THE FENCE THAT MAKES G601's FIVE NEW
   *     CAPABILITIES SAFE TO PUT IN A SHARED CLOSED SET. ---
   *
   * 🛑 IT SITS HERE — after the platform arm has returned, before the partner
   *    arm and before the customer loop — FOR `authorisationPermits()`'s
   *    ORDER-OF-EVALUATION REASON, quoted rather than re-derived: *"a
   *    first-position refusal makes every later list a no-op for the classes
   *    it names."* Below the partner mask it would be shadowed by
   *    `partner_grant_absent` for a partner with no grant and by
   *    `capability_outside_partner_mask` for one with a grant, and in both
   *    cases the refusal would be a fact about the GRANT rather than about the
   *    VERB — true today, and one mask edit away from being wrong.
   *
   * ⚠️ WHAT IT IS NOT: a check on the assignment. `decide()` never asks whether
   *    a tenant role SHOULD carry one of these; it answers that the class is
   *    unreachable from here whatever the role says. That is deliberate and it
   *    is the direction that fails closed — the write-time validator that
   *    would refuse the malformed role *"does not exist"*, in
   *    `CAPABILITY_STAKEHOLDER_CLASSES`'s own words, and this branch is
   *    correct without it.
   *
   * ⚠️ AND IT IS UNREACHABLE TODAY, WHICH IS A FACT ABOUT THE SUBSTRATE AND NOT
   *    ABOUT THIS BRANCH. `db/migrations/0009_identity_substrate.sql` grants
   *    the app role `SELECT` and nothing else on `tenant.role_capability`, and
   *    `0020_capability_granting.sql` deliberately withholds `INSERT` there —
   *    *"a path that could add a verb to a role the granter ALREADY HOLDS
   *    widens their own authority with no conferral at all."* So the only
   *    writer is a migrator. A branch whose only observable behaviour today is
   *    against a fixture is `docs/HANDOFF.md` §5.6 unless somebody witnesses
   *    it, which `tests/model/platform-only-capabilities.test.ts` §2 does by
   *    building the malformed role the database would accept.
   */
  if (capabilityIsPlatformOnly(capability)) {
    return deny(DECISION_REASONS.capability_is_platform_only)
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * --- 2g. THE FIFTH ARM — R10, 1 Oct 2026, THE OWNER'S RULING. ---
   *     A partner firm's OWN staff, acting on the firm's OWN surface.
   * ═══════════════════════════════════════════════════════════════════════
   *
   * 🛑 DISPATCHED ON THE CAPABILITY'S CLASS AND NEVER ON THE PRINCIPAL ALONE.
   *    A partner principal asking for `view_exception` does NOT come here: it
   *    falls through to the tenant partner arm below, which needs a live
   *    `PartnerAccessGrant` and reads `held`. A partner principal asking for a
   *    `PARTNER_ONLY_RESOURCE_CLASSES` verb comes here and reads `partnerHeld`
   *    ALONE. So the two instruments can never be mixed: a portal role cannot
   *    satisfy a tenant act, and a tenant role cannot satisfy a portal act.
   *
   * 🛑 IT SITS BEFORE 2f, THE TENANT TERM, BECAUSE A PORTAL ACT HAS NO TENANT —
   *    `partners.reconcileai.app` is a console host (G726) and the session is
   *    bound to none. For the same reason as the platform arm, `tenantId` is
   *    never READ here: nothing on this arm can name one, and that absence is
   *    invariant 2's whole defence — this arm cannot be a second cross-tenant
   *    path because it has no tenant to cross into.
   *
   * ⚠️ CUSTOMER AND PLATFORM PRINCIPALS ARE REFUSED BY NAME, the mirror of
   *    2e. The platform half is ALSO refused inside the platform arm at 2a',
   *    which has already returned — this line answers the customer.
   *
   * ⚠️ THE SCOPE THAT TRAVELS BACK IS `DENY_ALL`, the platform arm's rule:
   *    *"a platform allow is a VERB and never a DIMENSION."* Every
   *    `AssignmentScope` dimension narrows tenant business data, and none of it
   *    is in reach of this arm.
   */
  if (capabilityIsPartnerOnly(capability)) {
    if (principal.orgClass !== ORG_CLASSES.partner) {
      return deny(DECISION_REASONS.capability_is_partner_only)
    }
    const firm = principal.partnerId
    if (firm === null) {
      return deny(DECISION_REASONS.partner_staff_partner_unresolved)
    }
    const partnerHeld = principal.partnerHeld ?? null
    if (partnerHeld === null) {
      return deny(DECISION_REASONS.partner_staff_assignment_unreadable)
    }

    const staffCarrying: HeldPartnerAssignment[] = []
    const staffRefusals: DecisionReason[] = []
    let sawLiveStaffAssignment = false

    for (const holding of partnerHeld) {
      const { role, assignment } = holding
      /* The firm term FIRST, for the tenant loop's reason: a row from another
       * firm is not this principal's at all, and every later term is a fact
       * about a row that should never have been considered. */
      if (role.partnerId !== firm || assignment.partnerId !== firm) {
        staffRefusals.push(DECISION_REASONS.partner_staff_other_partner)
        continue
      }
      if (assignment.roleId !== role.id) {
        staffRefusals.push(DECISION_REASONS.assignment_role_mismatch)
        continue
      }
      if (assignment.revokedAt !== null) {
        staffRefusals.push(DECISION_REASONS.partner_staff_assignment_revoked)
        continue
      }
      /* Lexical ISO-8601 UTC comparison, like every other expiry here. */
      if (assignment.expiresAt <= principal.now) {
        staffRefusals.push(DECISION_REASONS.partner_staff_assignment_expired)
        continue
      }
      if (role.status !== 'active') {
        staffRefusals.push(DECISION_REASONS.partner_staff_role_not_active)
        continue
      }
      if (assignment.roleVersion !== role.version) {
        staffRefusals.push(DECISION_REASONS.partner_staff_role_version_moved)
        continue
      }
      sawLiveStaffAssignment = true
      if (role.capabilities.includes(capability)) staffCarrying.push(holding)
    }

    if (staffCarrying.length === 0) {
      if (sawLiveStaffAssignment) {
        return deny(DECISION_REASONS.no_partner_staff_assignment_carries_capability)
      }
      return deny(
        staffRefusals[0] ?? DECISION_REASONS.partner_staff_assignment_absent,
      )
    }

    return {
      allowed: true,
      reason: DECISION_REASONS.permitted,
      scope: DENY_ALL,
      via: staffCarrying.map((h) => ({
        assignmentId: h.assignment.id,
        roleId: h.role.id,
        roleVersion: h.assignment.roleVersion,
      })),
    }
  }

  /**
   * --- 2f. THE TENANT TERM, FOR EVERY ARM THAT HAS ONE. G728, 19 Sep 2026,
   *     AND IT IS THE FENCE THAT MAKES `PrincipalContext.tenantId` SAFE TO
   *     WIDEN TO `TenantId | null`. ---
   *
   * 🛑 IT SITS HERE — after the platform arm has returned, after 2e's verb
   *    check, before the partner arm and before the customer loop — and each
   *    boundary is argued rather than chosen:
   *
   *    · AFTER THE PLATFORM ARM, because that arm is the one the owner's
   *      console ruling exists to reach, and it reads no tenant. A guard above
   *      it would refuse every console principal and make the ruling inert —
   *      G60's shape, *"recorded as applied, with the FDE still unable to bind
   *      a credential."*
   *    · AFTER 2e, for 2e's own stated reason in the mirror. A platform-only
   *      verb asked by a tenant-less customer principal is refused because the
   *      VERB was never theirs, which is true on every surface and is the
   *      stronger statement; reporting the surface first would make the answer
   *      *"you have no tenant"* to a caller who could never hold that verb in
   *      one.
   *    · BEFORE THE PARTNER ARM, because that arm's refusals are facts about a
   *      GRANT and a grant is per customer tenant. `partner_grant_absent` for a
   *      console session would be true and misleading: there is no tenant for a
   *      grant to be into.
   *
   * ⚠️ AND IT IS A GUARD RATHER THAN A NARROWING HELPER, so the loop below
   *    still compares `principal.tenantId` against each row. That comparison is
   *    unchanged and still catches an assignment from another tenant; what this
   *    line removes is the case where it would be comparing against nothing.
   */
  if (principal.tenantId === null) {
    return deny(DECISION_REASONS.principal_holds_no_tenant)
  }

  /**
   * ⚠️ AND THE ASSIGNMENT TERM, IMMEDIATELY AFTER — G728. `held: null` is *"no
   * reader ran"* and is a fact about our substrate; `[]` is *"they hold none"*
   * and falls through to `no_live_assignment` at the foot of the loop. The two
   * are one line apart on purpose, so that nobody reading the loop has to
   * wonder which of them an empty iteration meant.
   */
  const held = principal.held
  if (held === null) {
    return deny(DECISION_REASONS.assignments_unreadable)
  }

  if (principal.orgClass === ORG_CLASSES.partner) {
    const grant = principal.partnerGrant
    if (grant === null || principal.partnerId === null) {
      return deny(DECISION_REASONS.partner_grant_absent)
    }
    /**
     * §9.5: `decide()` must check the grant's `partnerId` against the DERIVED
     * org, or a partner engineer who moved to the customer keeps
     * grant-derived assignments evaluated under the wrong organisation.
     */
    if (grant.partnerId !== principal.partnerId) {
      return deny(DECISION_REASONS.partner_grant_other_partner)
    }
    if (grant.revokedAt !== null) {
      return deny(DECISION_REASONS.partner_grant_revoked)
    }
    if (grant.expiresAt <= principal.now) {
      return deny(DECISION_REASONS.partner_grant_expired)
    }
    /**
     * The mask INTERSECTS; it never adds. A partner may operate on a customer's
     * exceptions and may never be the approving authority for them — and
     * `view_summary` is in no scope, so a digest cannot arrive through here.
     */
    if (!PARTNER_CAPABILITY_MASK[grant.scope].includes(capability)) {
      return deny(DECISION_REASONS.capability_outside_partner_mask)
    }
  }

  /* --- 3. Per-assignment. First structural refusal wins the reason. --- */
  const carrying: HeldAssignment[] = []
  const refusals: DecisionReason[] = []
  let sawLiveAssignment = false

  for (const holding of held) {
    const { role, assignment } = holding

    if (
      role.tenantId !== principal.tenantId ||
      assignment.tenantId !== principal.tenantId
    ) {
      refusals.push(DECISION_REASONS.tenant_mismatch)
      continue
    }
    if (assignment.roleId !== role.id) {
      refusals.push(DECISION_REASONS.assignment_role_mismatch)
      continue
    }
    if (assignment.revokedAt !== null) {
      refusals.push(DECISION_REASONS.assignment_revoked)
      continue
    }
    if (
      assignment.expiresAt !== null &&
      assignment.expiresAt <= principal.now
    ) {
      refusals.push(DECISION_REASONS.assignment_expired)
      continue
    }
    /**
     * THE LAW, ENFORCED. `DURABLE_ASSIGNMENT_PERMITTED` says only the customer
     * row may hold an assignment that never expires. A partner holding one has
     * authority that outlives the grant it was derived from, which is the
     * precise failure the grant's mandatory `expiresAt` exists to prevent.
     */
    if (
      assignment.expiresAt === null &&
      !DURABLE_ASSIGNMENT_PERMITTED[principal.orgClass]
    ) {
      refusals.push(DECISION_REASONS.durable_assignment_forbidden_for_org)
      continue
    }
    if (role.status !== 'active') {
      refusals.push(DECISION_REASONS.role_not_active)
      continue
    }
    /**
     * THE PIN. A widened role is a NEW version and needs consent
     * (`canConsentToWidening`); a narrowed one is automatic and also produces a
     * new version. Either way the holder's pin no longer matches, and the
     * conservative answer is to stop evaluating it rather than to guess which
     * direction the change went. §10.5 adds the case that makes this
     * non-negotiable: a failed injection probe can auto-revert a pack at 04:00,
     * and if the reverted-to version had a WIDER role, live authority would
     * widen unattended with no human in the path.
     */
    if (assignment.roleVersion !== role.version) {
      refusals.push(DECISION_REASONS.role_version_moved)
      continue
    }

    sawLiveAssignment = true
    if (roleCarries(role, capability)) carrying.push(holding)
  }

  if (carrying.length === 0) {
    if (sawLiveAssignment) {
      return deny(DECISION_REASONS.no_assignment_carries_capability)
    }
    return deny(refusals[0] ?? DECISION_REASONS.no_live_assignment)
  }

  return {
    allowed: true,
    reason: DECISION_REASONS.permitted,
    scope: unionScopeAcross(carrying),
    via: carrying.map((h) => ({
      assignmentId: h.assignment.id,
      roleId: h.role.id,
      roleVersion: h.assignment.roleVersion,
    })),
  }
}

/**
 * The scope that actually applies for a capability.
 *
 * THIS WAS LEFT TO THE CALLER AND SHOULD NEVER HAVE BEEN. `assignmentGrants()`
 * answered the capability half and its comment handed the other half back —
 * in a module where every other single-point-of-truth check is a function
 * precisely because a call site reasoning independently IS the vulnerability:
 * isAdmissible, mayAdmit, reversalIndictsAutonomy, mayNotifyContact,
 * grantAllows, purgeVerdict, bindingFor.
 *
 * The failure it invites is specific. A user holds two assignments — a tightly
 * scoped Approver and an unscoped Viewer. The obvious implementation unions
 * capabilities and unions scopes, and `approve_resolution` from the first
 * silently acquires the second's unrestricted scope. **One read-only role
 * dissolves every value ceiling in the tenant.**
 *
 * So scopes are unioned ONLY across assignments that actually carry the
 * requested capability. That behaviour is unchanged; it now lives inside
 * `decide()`, and this is a projection of it, kept because the two callers
 * below want the scope without the reason. It is NOT a second evaluator —
 * there is exactly one, and it is `decide()`.
 */
export function effectiveScopeFor(
  principal: PrincipalContext,
  capability: Capability,
): { granted: boolean; scope: AssignmentScope } {
  const decision = decide(principal, capability)
  return { granted: decision.allowed, scope: decision.scope }
}

/** Union across assignments already vetted as carrying the capability. */
function unionScopeAcross(carrying: readonly HeldAssignment[]): AssignmentScope {
  const merge = <T>(dims: readonly ScopeDimension<T>[]): ScopeDimension<T> => {
    if (dims.some((d) => d.kind === 'all')) return { kind: 'all' }
    const values = dims.flatMap((d) => (d.kind === 'these' ? d.values : []))
    return { kind: 'these', values: [...new Set(values)] }
  }

  const scopes = carrying.map((h) => h.assignment.scope)
  const ceilings = scopes.map((s) => s.valueCeiling)
  /** An unlimited ceiling among carrying assignments genuinely is unlimited. */
  const valueCeiling = ceilings.some((c) => c === null)
    ? null
    : ceilings.reduce<Money | null>(
        (a, b) =>
          a === null || b === null ? null : b.amountMinor > a.amountMinor ? b : a,
        ceilings[0] ?? null,
      )

  return {
    domains: merge(scopes.map((s) => s.domains)),
    definitionIds: merge(scopes.map((s) => s.definitionIds)),
    solutionIds: merge(scopes.map((s) => s.solutionIds)),
    costCentres: merge(scopes.map((s) => s.costCentres)),
    legalEntities: merge(scopes.map((s) => s.legalEntities)),
    valueCeiling,
  }
}

/**
 * The INTERSECTION of two scopes. The dual of `unionScopeAcross`, and the
 * operation the authorisation grant needs that nothing here previously had.
 *
 * `unionScopeAcross` widens across assignments that all carry the capability,
 * which is correct there and would be catastrophic here. A grant minted at
 * 09:00 pins a scope; at 09:04 the holder's authority may have changed. The
 * standing law says NARROWING IS AUTOMATIC AND WIDENING IS AN ACT, so a redeem
 * must take the narrower of (what was pinned, what is true now) — never the
 * pinned scope on its own, which would let a revoked entity keep being reachable
 * for the life of the token, and never the fresh scope on its own, which would
 * let a widening land on an act already in flight with nobody consenting to it.
 *
 * Fails closed on every branch it cannot decide, in keeping with `DENY_ALL`
 * being the failure value rather than the empty value.
 */
export function narrowestScope(
  a: AssignmentScope,
  b: AssignmentScope,
): AssignmentScope {
  const meet = <T>(x: ScopeDimension<T>, y: ScopeDimension<T>): ScopeDimension<T> => {
    if (x.kind === 'all') return y
    if (y.kind === 'all') return x
    const ys = y.values
    return { kind: 'these', values: x.values.filter((v) => ys.includes(v)) }
  }

  /**
   * Currency mismatch DENIES rather than approximating. BHD carries three
   * decimal places and USD two, so equal `amountMinor` differs by ~3.8x —
   * `scopeIsNarrowerOrEqual` already refuses the comparison for that reason,
   * and an intersection that guessed would be the one place the refusal leaked.
   */
  let valueCeiling: Money | null
  if (a.valueCeiling === null) valueCeiling = b.valueCeiling
  else if (b.valueCeiling === null) valueCeiling = a.valueCeiling
  else if (a.valueCeiling.currency !== b.valueCeiling.currency) {
    valueCeiling = DENY_ALL.valueCeiling
  } else {
    valueCeiling =
      a.valueCeiling.amountMinor <= b.valueCeiling.amountMinor
        ? a.valueCeiling
        : b.valueCeiling
  }

  return {
    domains: meet(a.domains, b.domains),
    definitionIds: meet(a.definitionIds, b.definitionIds),
    solutionIds: meet(a.solutionIds, b.solutionIds),
    costCentres: meet(a.costCentres, b.costCentres),
    legalEntities: meet(a.legalEntities, b.legalEntities),
    valueCeiling,
  }
}

/* ------------------------------------------------------------------ *
 * The authorisation grant — the artefact the three record streams join on
 *
 * WHY THIS EXISTS AND WHY IT DID NOT. AWS's IAM works not because IAM exists
 * but because THERE IS NO PATH TO A RESOURCE THAT BYPASSES THE API CALL. This
 * model had evaluators — `decide()`, `grantAllows()`, `resolveModel()` — and
 * nothing forced the call. Under a customer-owned data plane the choke point
 * cannot be network-level, because the customer holds root and can reach the
 * database directly. So the choke point has to be that AUTHORISATION MINTS AN
 * ARTEFACT AND THE ARTEFACT IS THE ONLY THING AN ACT CAN BE RECORDED UNDER.
 *
 * Be precise about what that does and does not buy, because overclaiming here
 * is how a control becomes decorative. It does NOT make an unauthorised act
 * impossible — nothing in a type system can, against root. It makes an
 * unauthorised act UNRECORDABLE: `AuditEvent`, `DataAccessEvent` and
 * `UsageRecord` all carry `authorizationId`, and the well-formedness rule in
 * governance.ts says which actor kinds may leave it null. An act with no
 * authorisation therefore either fails the rule (visible) or is absent from the
 * stream entirely (detectable, because all three streams are hash-chained and
 * sequence gaps break the chain). Visible and detectable is what an audit needs
 * and is strictly more than the model had, which was nothing.
 *
 * NAMING. `TokenUsage` in domain.ts already means LLM tokens, and a second
 * meaning of "token" in the same model is how `RoleKey` came to mean two things.
 * "Grant" is already this codebase's word for time-bound derived authority —
 * `TenantAccessGrant`, `PartnerAccessGrant` — so this is an
 * `AuthorizationGrant`, and the word "token" appears nowhere in it.
 * ------------------------------------------------------------------ */

/**
 * WHAT IS BEING ACTED ON. Named, not described.
 *
 * `resourceClass` is DENORMALISED from `CAPABILITY_RESOURCE_CLASS` rather than
 * derived at read time, for the reason `AuditActor` stamps `orgClass` at write
 * time: the mapping is a platform artefact and a platform release may move a
 * capability between classes — `configure_telemetry` moved from `configuration`
 * to `authority` on 5 Aug. An auditor reading a March grant needs March's
 * classification, and a join to today's table gives them today's.
 */
export interface ResourceRef {
  resourceClass: AccessResourceClass
  /** Entity name: 'Exception', 'SourceDocument', 'Solution'. Never parsed. */
  resourceType: string
  /**
   * The instance. Null where the act is genuinely not instance-bound — opening
   * a list, running a report. A null here is what makes `scope` load-bearing
   * rather than redundant: with no instance to check, the scope IS the check.
   */
  /**
   * ⚠️ STAYS BARE (R4). The deliberate heterogeneity — `(resourceType,
   * resourceId)` IS the identifier and `resourceClass` closes instead. Listed
   * in `BareByRule` in `model/identity.ts`, the only place an exception to the
   * sweep may be declared.
   */
  resourceId: string | null
  /**
   * The solution this act runs inside, where there is one.
   *
   * A SCOPE, NEVER A GRANT. Its presence narrows; its absence never widens.
   * Nothing about holding this reference confers anything the principal's own
   * assignments did not already carry — see `SOLUTION_IS_GRANTABLE`.
   */
  solutionId: SolutionId | null
}

/**
 * How long an authorisation may live, by what it reaches.
 *
 * A TOKEN IS NOT A SESSION, and the difference is the point. `MAX_GRANT_HOURS`
 * bounds a support grant in HOURS-TO-WEEKS because a human is doing an
 * engagement. This bounds a single authorised act, and the right unit is the
 * time one act plausibly takes — because the exposure is not "how long may
 * someone work" but "how long does a mis-issued artefact stay live".
 *
 * TOTAL BY CONSTRUCTION, like `CAPABILITY_RESOURCE_CLASS`. A fourteenth
 * resource class that nobody bounds is a COMPILE ERROR rather than a class that
 * inherits whichever default was written first.
 *
 * The three short ones are the argument. `secret` is 60 seconds because binding
 * or rotating a credential is one act and there is no second act it enables;
 * `authority` is five minutes because it changes who may decide; `statutory` is
 * five minutes because it is not the customer's to delegate in the first place
 * and a long-lived artefact reaching it would be the only durable form that
 * refusal could take.
 */
export const MAX_AUTHORIZATION_SECONDS: Record<AccessResourceClass, number> = {
  telemetry: 3600,
  configuration: 3600,
  authority: 300,
  statutory: 300,
  identity: 900,
  endpoint: 900,
  secret: 60,
  substrate: 3600,
  commercial: 3600,
  catalogue: 3600,
  schedule: 3600,
  metering: 3600,
  tenant_data: 900,
  /*
   * R10, 1 Oct 2026. The three partner-only classes, bounded by what one act
   * on each is. ⚠️ ALL THREE ARE BOUNDS ON AN ARTEFACT NOTHING MINTS YET:
   * `AuthorizationGrant extends TenantScoped` and a partner-portal act has no
   * tenant, so invariant 10's record for the fifth arm is OWED (the mount
   * blocker G728 named for the platform arm, reached a second time).
   *
   * `partner_staff` is `authority`'s five minutes for `authority`'s reason —
   * it changes who in the firm may decide. `deal` and `sandbox` are fifteen,
   * `tenant_data`'s figure: a claim and a reset are each one act, and the reset
   * is destructive.
   */
  deal: 900,
  sandbox: 900,
  partner_staff: 300,
}

/**
 * A TIME-BOUND AUTHORISATION, minted by `authorize()` and by nothing else.
 *
 * A REFERENCE, NOT A BEARER TOKEN — the pattern access-and-agency.md §3 already
 * sets for agent grants: "the runtime presents a grant *id*; F13 loads the row
 * and evaluates that. Nothing the runtime asserts about its own authority is
 * read." Every field below is therefore SERVER-WRITTEN AND SERVER-READ. There is
 * no signature, no claims blob and no encoding, because there is nothing here a
 * caller is trusted to carry: possession of the id is not possession of the
 * authority, and `redeemAuthorization()` re-derives the authority every time.
 *
 * That is a deliberate refusal of the JWT shape. A signed self-describing token
 * is fast precisely because nobody loads the row — and a revoked assignment, a
 * disabled user or a lapsed partner grant then stays effective until the token
 * expires. "Validity is evaluated, never asserted" (§3): a fired employee's
 * in-flight acts stop on the next call, not at the next expiry.
 *
 * IMMUTABLE ONCE WRITTEN, which is what makes it safe for the three streams to
 * reference it rather than duplicate the principal. The standing discipline —
 * "a row must reach its authority without traversing a mutable table" — is
 * satisfied by the table being append-only, not by copying fields out of it.
 * That distinction is what lets `UsageRecord` carry a join key instead of a
 * `UserId`: see the field comment there, where putting a principal identifier on
 * the one record class that ships to the control plane would have broken
 * invariant 3.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 ONE MEANING, TWO HOMES — G730, 19 Sep 2026, THE OWNER'S RULING. THIS IS
 *    THE TENANT HOME; `PlatformAuthorizationGrant` BELOW IS THE OTHER ONE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The ruling, in the owner's own words: **a `platform_authorization_grant`
 * table, policy keyed on the acting SESSION rather than on a tenant** —
 * *"`0009` already does exactly this for the five tables read BEFORE a tenant
 * is selected. Same argument, same shape."* **Invariant 10 keeps one meaning
 * with two homes, and each home has a scope that can actually read it.**
 *
 * ⚠️ THE HOMES ARE TWO TYPES AND NOT ONE NULLABLE FIELD, AND THAT IS THE WHOLE
 *    OF WHY THIS IS A UNION RATHER THAN A WIDENING. G728 refused a nullable
 *    `tenantId` at this function: *"under G100's deny-on-NULL such a row is
 *    visible to no scope, which is a record that exists and cannot be read"* —
 *    G284's *"a result nobody may read is not persistence"*, applied to the
 *    audit trail. The second table answers the READABILITY half of that
 *    objection; the second TYPE answers the other half, which nobody had
 *    named: **a tenant-less grant must be UNWRITABLE to the tenant table by
 *    the compiler, not merely refused by the policy at runtime.** `TenantScoped`
 *    is what `authorization_grant_rls` is written against, and a grant that
 *    could carry a `null` there would reach `writeAuthorisationRecord()` and
 *    fail in the database. The repository's standing preference is 0010's own:
 *    a cross-scope reference is UNREPRESENTABLE rather than merely unlikely.
 */
export interface AuthorizationGrant extends TenantScoped {
  /**
   * WHICH TABLE THIS ROW BELONGS IN, AND IT IS A DISCRIMINANT RATHER THAN A
   * COLUMN. `db/migrations/0010_authorisation_record.sql` stores no such value
   * and must not grow one — **the table IS the home**, and a column holding
   * one constant on every row is the thing `0002_run.sql` and `0010`'s scope
   * note both refuse. What it buys is at the call site: the one writer of each
   * table takes the one type, so routing an act's record to the wrong home is
   * a `tsc` error rather than a policy refusal nobody sees until a console
   * operation is served.
   */
  home: 'tenant'
  id: AuthorizationGrantId
  /**
   * WHO. Narrowed to the same `{ userId, status }` shape `PrincipalContext`
   * carries, and for the same reason: no evaluation and no audit row should be
   * able to reach an email or a display name through an authorisation.
   */
  subjectUserId: UserId
  /** Derived at session establishment (§9.2). Stamped, never re-derived. */
  orgClass: OrgClass
  /** The partner whose directory authenticated them. Null unless `partner`. */
  partnerId: PartnerId | null
  /** WHAT. One capability. A grant that covered several would be a session. */
  capability: Capability
  /** ON WHAT. */
  resource: ResourceRef
  /**
   * THE EFFECTIVE SCOPE AT MINT. Pinned, and intersected again at redeem —
   * `narrowestScope()` explains why neither half alone is correct.
   */
  scope: AssignmentScope
  /**
   * What carried it. The same value `Decision.via` carries, stored rather than
   * discarded — which is the whole of the third missing stream: `Decision.via`
   * named the authority and joined to nothing because the decision was computed
   * and thrown away.
   */
  via: readonly DecisionVia[]
  issuedAt: Timestamp
  /**
   * Required, never null. "An open-ended grant is not a grant" —
   * `PartnerAccessGrant`'s rule, and this is the shortest-lived grant in the
   * model, so it is the last place to relax it.
   */
  expiresAt: Timestamp
}

/**
 * THE SAME AUTHORISATION, FOR AN ACT THAT HAS NO TENANT — G730, 19 Sep 2026,
 * the owner's ruling, and the thing that was standing between a console
 * principal and a mounted console operation.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 READ `AuthorizationGrant`'s HEADER FIRST. EVERY SENTENCE IN IT IS TRUE OF
 *    THIS TYPE TOO, AND NONE OF THEM IS RESTATED HERE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A reference and not a bearer token; immutable once written; minted by
 * `authorize()` and by nothing else. **The only difference is where the record
 * lives and what scope can read it**, and that difference is one field wide:
 * there is no `tenantId`, because `decide()`'s platform arm says in its own
 * voice that *"THERE IS NO TENANT PAIRING CHECK HERE AND ITS ABSENCE IS THE
 * POINT … neither `PlatformRole` nor `PlatformRoleAssignment` extends
 * `TenantScoped`, so there is no tenant on either row to disagree with
 * anything."*
 *
 * 🛑 WHAT THE SCOPE IS, SINCE IT CANNOT BE A TENANT. `db/migrations/0091` keys
 *    its policy on the ACTING SESSION, exactly as
 *    `db/migrations/0009_identity_substrate.sql` keys five of its eight tables
 *    — *"because a person is read BEFORE a tenant is selected and a
 *    `tenant_id` predicate would deny unconditionally under G100."* The same
 *    sentence is the justification here: a console act HAS no tenant, so a
 *    `tenant_id` predicate on its record would deny unconditionally and the
 *    row would be one nobody could read.
 *
 * ⚠️ AND THERE IS NO `sessionRef` FIELD, WHICH IS THE PART TO READ BEFORE
 *    ADDING ONE. The policy joins through `subject_user_id` — the record names
 *    the PERSON, and the SESSION is only how the database learns who is
 *    asking. Storing the digest would put a credential-derived value in an
 *    append-only table that outlives every session it could name, and would
 *    make an auditor's row join to a credential rather than to a person. The
 *    session is the SCOPE; the subject is the FACT.
 *
 * ⚠️ IT IS NOT REDEEMABLE, AND THAT IS UNCHANGED RATHER THAN NEW.
 *    `redeemAuthorization()` takes an `AuthorizationGrant` and binds FOUR
 *    things, one of which is the tenant. Nothing in this repository presents a
 *    grant id back — the mint and the act are one transaction — so neither
 *    home has a redeem path today. The day one crosses the wire, a platform
 *    redeem is its own function with THREE bindings, and that is a ruling.
 *
 * 🛑 `orgClass` IS `platform` FOR EVERY ROW THIS REPOSITORY CAN PRODUCE AND IS
 *    STILL A FIELD RATHER THAN A CONSTANT. `decide()`'s 2f guard refuses a
 *    tenant-less customer and a tenant-less partner BY NAME, so the platform
 *    arm is the only one that can reach this type — but the field is STAMPED
 *    from the principal for `AuditActor`'s reason, which `AuthorizationGrant`
 *    already carries: *"an auditor reading a March row needs March's
 *    organisation."* Writing the literal would be the fabrication
 *    `server/data-plane/session.ts` refuses one field over.
 */
export interface PlatformAuthorizationGrant {
  /** See `AuthorizationGrant.home`. The table is the home; this is the tag. */
  home: 'platform'
  /**
   * ⚠️ THE SAME BRAND AS THE TENANT HOME'S, AND THE COST IS NAMED RATHER THAN
   * ABSORBED. `AuthorizationGrantId` now addresses a row in ONE OF TWO TABLES,
   * which is `db/migrations/0010`'s own warning about `assignment_id` arriving
   * on the primary key: *"A READER MUST DISCRIMINATE BEFORE DEREFERENCING."*
   *
   * A second brand was the obvious repair and is REFUSED at the request:
   * `AuthorizationRequest.id` is supplied by the caller BEFORE `authorize()`
   * has read the principal, so two brands would make the caller predict the
   * evaluator's answer — which is the two-halves split `decide()`'s own header
   * calls *"the structural precondition for a confused deputy."* One minter,
   * one id namespace; `mintAuthorizationGrantId()` is the one source and the
   * two tables partition what it produces.
   */
  id: AuthorizationGrantId
  subjectUserId: UserId
  orgClass: OrgClass
  /** Null on every row this arm can produce. A VALUE, not an absence. */
  partnerId: PartnerId | null
  capability: Capability
  resource: ResourceRef
  /**
   * `DENY_ALL` on every row, and that is `decide()`'s platform arm speaking
   * rather than a gap: *"A platform allow is a VERB and never a DIMENSION."*
   * The field is here because the value is the decision's, pinned at mint,
   * exactly as on the tenant home.
   */
  scope: AssignmentScope
  via: readonly DecisionVia[]
  issuedAt: Timestamp
  expiresAt: Timestamp
}

/**
 * INVARIANT 10's THIRD HOME — A PARTNER FIRM'S OWN PORTAL ACT. **G2621,
 * 1 Oct 2026, THE OWNER'S RULING (taking G2327):**
 *
 *     *"Session-keyed table: tenant.partner_authorization_grant keyed on the
 *     acting session — G730's second-home shape, a third home for one
 *     meaning."*
 *
 * 🛑 ONE MEANING, THREE HOMES. The invariant's sentence does not move —
 *    *"`authorize()` mints an `AuthorizationGrant` and nothing else does"* —
 *    and each home exists because its principal has a scope that can read it:
 *    the TENANT home under `app.tenant_id` (`0010`), the PLATFORM home under
 *    the acting session (`0091`, G730), and this one under the acting session
 *    too (`db/migrations/0320_partner_authorisation_record.sql`).
 *
 * 🛑 IT IS NOT THE PLATFORM HOME WITH `orgClass: 'partner'`, AND UNTIL THIS
 *    TYPE EXISTED THAT IS EXACTLY WHAT `authorize()` WOULD HAVE MINTED. A portal
 *    act reaches `authorize()` with `tenantId === null`, and the only
 *    tenant-less branch was the platform one — so a deal registration would
 *    have been recorded as a STAFF act on the fleet, in the table an auditor
 *    reads to learn what 1CloudHub's own people did. G2327 recorded that as a
 *    blocker; the branch below is keyed on the CAPABILITY's class, which is
 *    the same key the fifth arm dispatches on, so the home and the arm cannot
 *    disagree about which acts are a firm's.
 *
 * 🛑 NO `tenantId` FIELD — ABSENT, NOT `null` — FOR THE PLATFORM HOME'S REASON
 *    AND FOR ONE MORE: `PartnerRoleAssignment`'s own note reads *"If a
 *    `tenantId` is ever added here, invariant 2 has a second path, written in
 *    a field."* A record naming a tenant would be the first artefact of the
 *    fifth arm that did. `_PartnerAuthorizationGrantNamesNoTenant` below makes
 *    adding one a compile error.
 *
 * ⚠️ `partnerId` IS `PartnerId` AND NOT `PartnerId | null`. The fifth arm
 *    refuses `partner_staff_partner_unresolved` before it can allow, so every
 *    row this type can describe names a firm — and the firm is what the
 *    directory and the deal tables key their reads on (`0321`, `0322`).
 */
export interface PartnerAuthorizationGrant {
  /** See `AuthorizationGrant.home`. The table is the home; this is the tag. */
  home: 'partner'
  /** One minter, one namespace — `PlatformAuthorizationGrant.id`'s argument. */
  id: AuthorizationGrantId
  subjectUserId: UserId
  /** `partner` on every row; stamped from the principal, never written as a literal. */
  orgClass: OrgClass
  /** The firm whose own surface the act was on. Never null — see above. */
  partnerId: PartnerId
  capability: Capability
  resource: ResourceRef
  /** `DENY_ALL` on every row — the fifth arm's *"a VERB and never a DIMENSION"*. */
  scope: AssignmentScope
  /** Every entry is a `PartnerRoleAssignmentId` (`0250`). */
  via: readonly DecisionVia[]
  issuedAt: Timestamp
  expiresAt: Timestamp
}

/** A `tenantId` on the partner home is a `TS2344` here, not a review comment. */
export type _PartnerAuthorizationGrantNamesNoTenant = AssertTrue<
  'tenantId' extends keyof PartnerAuthorizationGrant ? false : true
>

/** What the caller must supply that the evaluator cannot derive. */
export interface AuthorizationRequest {
  /**
   * Supplied rather than generated. This module is stack-neutral and holds no
   * id source; inventing one here would be the first piece of runtime this
   * model owns, and it would be the wrong piece.
   */
  id: AuthorizationGrantId
  resource: ResourceRef
  /** Bounded by `MAX_AUTHORIZATION_SECONDS` for the resource's class. */
  ttlSeconds: number
}

/**
 * The decision and the artefact together. `grant` is non-null EXACTLY when
 * `decision.allowed` is true — the same "scope travels with the answer"
 * discipline `Decision` follows, so a caller that reads only one field cannot
 * act on a refusal.
 */
export interface Authorization {
  decision: Decision
  /**
   * 🛑 A UNION SINCE G730, AND THE CHURN IT CAUSES IS THE CONTROL. ⚠️ **THIS
   * FIELD WAS `AuthorizationGrant | null`**, and the tempting shape — keeping
   * that and adding a second `platformGrant` field beside it — was refused: a
   * reader who never learned about the second field would go on seeing `null`
   * for a console act and would treat an ALLOWED act as a refusal. That is
   * correct only because a later comparison happens to fail closed, which is
   * §5.1 and is the exact defect `tests/model/console-principal.test.ts` §2b
   * exists to separate. **A union makes every existing reader answer the
   * question `home` asks**, at compile time, once.
   */
  grant: AuthorizationGrant | PlatformAuthorizationGrant | PartnerAuthorizationGrant | null
}

/**
 * MINT AN AUTHORISATION. A SIBLING OF `decide()`, NOT A CHANGE TO IT.
 *
 * The decision, and the runner-up, stated because this is the load-bearing
 * structural choice in the whole spine.
 *
 * TAKEN: `decide()` stays a pure predicate and `authorize()` is the only path
 * that mints. Three reasons, in increasing order of how much they cost to
 * discover later.
 *
 *   1. `decide()` IS CALLED ON READ PATHS THAT MUST NOT MINT. `canGrant()`
 *      loops `effectiveScopeFor()` over EVERY capability of the target role —
 *      a role with twelve capabilities would mint twelve authorisations for a
 *      permission check that performs no act at all. The three streams would
 *      fill with grants nobody ever redeemed, and "which authorisations were
 *      issued and never used" — a genuinely useful anomaly query — would be
 *      pure noise.
 *   2. IT IS REPRODUCIBLE ON PURPOSE. `PrincipalContext.now` is a parameter
 *      rather than a clock read "so a decision is reproducible in an audit". A
 *      minting `decide()` would issue live authority every time an auditor
 *      replayed a historic decision.
 *   3. THE TWO ANSWER DIFFERENT QUESTIONS. `decide()` answers *may this
 *      principal, in principle*. `authorize()` answers *may this principal do
 *      this, to this, for this long*. Collapsing them is the same error as
 *      `RoleKey` carrying an organisation and a permission at once, and it
 *      would be discovered the same way: by a caller needing one half and
 *      getting both.
 *
 * RUNNER-UP: `decide()` mints, and read-only paths call a separate
 * `decideWithoutMinting()`. Rejected because it inverts the safe default. The
 * function everyone reaches for first would be the one with a side effect, and
 * the careful path would be the one you have to know to ask for — which is how
 * `assignmentGrants()` came to hand half its decision back to its callers.
 *
 * ORDER IS DELIBERATE. The three request-shape checks run before any authority
 * is evaluated. They are answerable from caller-supplied values alone, so they
 * leak nothing, and putting them first means a malformed request never receives
 * an authorisation answer it could mistake for a permission answer.
 */
export function authorize(
  principal: PrincipalContext,
  capability: Capability,
  request: AuthorizationRequest,
): Authorization {
  const refuse = (reason: DecisionReason): Authorization => ({
    decision: { allowed: false, reason, scope: DENY_ALL, via: [] },
    grant: null,
  })

  /**
   * The class the capability actually touches, versus the class the caller
   * says the resource is. A `view_document` grant aimed at a `secret` is either
   * a caller bug or an attempt to launder a class past `PERMITTED_RESOURCES`,
   * and nothing here can tell which — so both refuse.
   */
  if (CAPABILITY_RESOURCE_CLASS[capability] !== request.resource.resourceClass) {
    return refuse(DECISION_REASONS.authorization_resource_class_mismatch)
  }

  const ceiling = MAX_AUTHORIZATION_SECONDS[request.resource.resourceClass]
  if (
    !Number.isFinite(request.ttlSeconds) ||
    request.ttlSeconds <= 0 ||
    request.ttlSeconds > ceiling
  ) {
    return refuse(DECISION_REASONS.authorization_ttl_out_of_bounds)
  }

  const issuedMs = Date.parse(principal.now)
  /**
   * `hoursBetween()` in governance.ts returns NaN on an unparseable timestamp
   * and its comment requires every caller to treat that as a refusal. Same
   * hazard, handled at source: an expiry of `NaN` compares false against every
   * clock, so a token built on one would never expire.
   */
  if (Number.isNaN(issuedMs)) {
    return refuse(DECISION_REASONS.authorization_clock_unparseable)
  }

  const decision = decide(principal, capability)
  if (!decision.allowed) return { decision, grant: null }

  /**
   * ✅ **INVARIANT 10 HAS A SECOND HOME, AND THIS IS WHERE A TENANT-LESS ACT
   * REACHES IT — G730, 19 Sep 2026, THE OWNER'S RULING.**
   *
   * ⚠️ **THIS BRANCH READ `return refuse(DECISION_REASONS.principal_holds_no_
   * tenant)` AND IS CORRECTED RATHER THAN DELETED**, because it is the
   * sentence G728 named as *"the thing standing between a console principal
   * and a mounted console operation"* and four documents quote it. The
   * ORIGINAL NOTE FOLLOWS IN FULL, because its reasoning is the premise this
   * ruling is built on and not a mistake erased — in particular, **the
   * refusal of a nullable `tenantId` survives untouched**: this arm does not
   * widen `AuthorizationGrant`, it mints a DIFFERENT TYPE whose record lives
   * in a DIFFERENT TABLE under a policy keyed on the acting session.
   *
   * 🛑 `principal_holds_no_tenant` IS NOT DELETED FROM THE MODEL AND MUST NOT
   *    BE. It is still `decide()`'s 2f answer for a tenant-less CUSTOMER or
   *    PARTNER, which is every arm but the platform one, and that guard is
   *    what makes this branch safe: by the time control reaches here
   *    `decision.allowed` is true, and the only arm that can be true with no
   *    tenant is the platform arm. **This function does not re-derive that —
   *    it reads `principal.tenantId` and nothing else — because a second
   *    org-class test here would be a second evaluator disagreeing with the
   *    first about the same principal.** `tests/model/console-principal.test.ts`
   *    §2c and §2d are what keep the other arms refused, §3 is the ALLOW and
   *    §3c is what keeps `PlatformAuthorizationGrant` free of a `tenantId`
   *    field — the repair G728 refused, which a widening would take back by
   *    accident.
   *
   * ⚠️ AND THE PARTNER FIELD IS CARRIED RATHER THAN NULLED. It is `null` on
   *    every row this arm can produce, and writing the literal would be
   *    asserting a fact instead of recording one — the distinction
   *    `server/data-plane/session.ts` makes about `status` in capitals.
   *
   * THE ORIGINAL NOTE, UNCHANGED:
   *
   * 🛑 INVARIANT 10 HAS NOWHERE TO PUT A RECORD OF A TENANT-LESS ACT, AND THAT
   * IS A REFUSAL RATHER THAN A `null` COLUMN — G728, 19 Sep 2026.
   *
   * `AuthorizationGrant extends TenantScoped`, and
   * `db/migrations/0010_authorisation_record.sql` keys the table's policy on
   * `app.tenant_id` like every other tenant table. **So a console principal —
   * whose surface has no tenant under the owner's ruling of 19 Sep 2026 — can
   * be ALLOWED by `decide()`'s platform arm and cannot be RECORDED.**
   *
   * ⚠️ THIS GUARD IS BELOW `decide()` AND NOT ABOVE IT, DELIBERATELY. Above, it
   * would report *"no tenant"* for a caller `decide()` would have refused
   * anyway, which is the wrong-reason refusal `principal_holds_no_tenant`'s own
   * declaration argues against one level up. Below, the refusal means exactly
   * what it says: **the authority is real and the record has no home.**
   *
   * 🛑 A NULLABLE `tenantId` ON THE GRANT WAS THE OBVIOUS REPAIR AND IS
   * REFUSED. `TenantScoped` is what `tenant.authorization_grant`'s RLS
   * predicate is written against; a `null` there is a row visible to no scope
   * under G100's deny-on-NULL, which is a record that exists and cannot be
   * read — *"a result nobody may read is not persistence"* (G284), applied to
   * the audit trail instead of to the engine. **Where a tenant-less act's
   * record lives is a RULING, and it is the one thing standing between this
   * function and a mountable console operation.** It is named here rather than
   * taken: `tests/model/console-principal.test.ts` §4 pins the refusal so the
   * commit that takes it has to delete an assertion and argue for it.
   */
  /**
   * 🛑 THE THIRD HOME — G2621, THE OWNER'S. KEYED ON THE CAPABILITY'S CLASS,
   * WHICH IS THE KEY THE FIFTH ARM DISPATCHES ON, so a portal act cannot land
   * in the platform home and a staff act cannot land here. Placed BEFORE the
   * tenant-less test rather than inside it: a partner-only verb's record
   * belongs to the firm whether or not a tenant happens to be bound to the
   * session, because the arm that allowed it never read one.
   *
   * ⚠️ The `null` firm is unreachable — `decide()` refused it at
   * `partner_staff_partner_unresolved` — and is refused rather than cast, so a
   * future change to the arm fails closed here instead of minting a row with
   * no firm.
   */
  if (capabilityIsPartnerOnly(capability)) {
    const firm = principal.partnerId
    if (firm === null) return refuse(DECISION_REASONS.partner_staff_partner_unresolved)
    return {
      decision,
      grant: {
        home: 'partner',
        id: request.id,
        subjectUserId: principal.subject.userId,
        orgClass: principal.orgClass,
        partnerId: firm,
        capability,
        resource: request.resource,
        scope: decision.scope,
        via: decision.via,
        issuedAt: principal.now,
        expiresAt: new Date(issuedMs + request.ttlSeconds * 1000).toISOString(),
      },
    }
  }

  if (principal.tenantId === null) {
    return {
      decision,
      grant: {
        home: 'platform',
        id: request.id,
        subjectUserId: principal.subject.userId,
        orgClass: principal.orgClass,
        partnerId: principal.partnerId,
        capability,
        resource: request.resource,
        scope: decision.scope,
        via: decision.via,
        issuedAt: principal.now,
        expiresAt: new Date(issuedMs + request.ttlSeconds * 1000).toISOString(),
      },
    }
  }

  return {
    decision,
    grant: {
      home: 'tenant',
      id: request.id,
      tenantId: principal.tenantId,
      subjectUserId: principal.subject.userId,
      orgClass: principal.orgClass,
      partnerId: principal.partnerId,
      capability,
      resource: request.resource,
      scope: decision.scope,
      via: decision.via,
      issuedAt: principal.now,
      expiresAt: new Date(issuedMs + request.ttlSeconds * 1000).toISOString(),
    },
  }
}

/**
 * PRESENT AN AUTHORISATION AND HAVE IT RE-EVALUATED.
 *
 * The half that makes "a reference, not a bearer token" true rather than
 * asserted. Nothing the caller carries about its own authority is read: the id
 * finds the row, and the row is checked against a freshly derived principal.
 *
 * FOUR BINDINGS, and each closes a distinct way a live artefact goes wrong.
 *
 *   TENANT       invariant 1, at the last possible moment. A grant minted in
 *                tenant A presented against a session in tenant B is the exact
 *                failure `grantAllows()` and `evaluateTenantAccess()` were both
 *                found not to be checking on 5 Aug.
 *   PRINCIPAL    possession is not authority. Without this the id is a bearer
 *                token in everything but name — whoever holds it acts as whoever
 *                it was minted for.
 *   CAPABILITY   one grant, one verb. Otherwise a `view_document` authorisation
 *                is redeemable for `execute_resolution` and the closed
 *                capability set has been defeated by a field nobody compared.
 *   RESOURCE     one grant, one thing. Otherwise an authorisation to view ONE
 *                document reads the tenant's whole corpus, and the scope
 *                dimensions are the only thing left standing between the two.
 *
 * The scope returned is the INTERSECTION of what was pinned at mint and what is
 * true now — see `narrowestScope()`. Narrowing is automatic; widening is an act
 * and does not reach an artefact already in flight.
 *
 * `via` is the FRESH decision's, not the mint-time one. If the assignment that
 * carried the mint has since lapsed and a different one now carries the same
 * capability, reporting the pinned `via` would attribute the act to an authority
 * that was not standing when it happened. The mint-time `via` remains on the
 * grant row, where it means what it says.
 */
export function redeemAuthorization(
  grant: AuthorizationGrant,
  principal: PrincipalContext,
  capability: Capability,
  resource: ResourceRef,
): Decision {
  const deny = (reason: DecisionReason): Decision => ({
    allowed: false,
    reason,
    scope: DENY_ALL,
    via: [],
  })

  if (grant.tenantId !== principal.tenantId) {
    return deny(DECISION_REASONS.authorization_tenant_mismatch)
  }
  if (
    grant.subjectUserId !== principal.subject.userId ||
    grant.orgClass !== principal.orgClass ||
    grant.partnerId !== principal.partnerId
  ) {
    return deny(DECISION_REASONS.authorization_principal_mismatch)
  }
  if (grant.capability !== capability) {
    return deny(DECISION_REASONS.authorization_capability_mismatch)
  }
  if (
    grant.resource.resourceClass !== resource.resourceClass ||
    grant.resource.resourceType !== resource.resourceType ||
    grant.resource.resourceId !== resource.resourceId ||
    grant.resource.solutionId !== resource.solutionId
  ) {
    return deny(DECISION_REASONS.authorization_resource_mismatch)
  }
  /**
   * `<=` rather than `<`, matching every other expiry comparison in this module
   * (`grant.expiresAt <= now` in `decide()` and
   * `effectivePartnerCapabilities()`). A grant expiring exactly now is expired.
   */
  if (grant.expiresAt <= principal.now) {
    return deny(DECISION_REASONS.authorization_expired)
  }

  const fresh = decide(principal, capability)
  if (!fresh.allowed) return fresh

  return {
    allowed: true,
    reason: DECISION_REASONS.permitted,
    scope: narrowestScope(grant.scope, fresh.scope),
    via: fresh.via,
  }
}

/* ------------------------------------------------------------------ *
 * Conferring authority — a grant and a consent are different questions
 * ------------------------------------------------------------------ */

/**
 * Why an authority change was permitted or refused. CLOSED, for the reason
 * `DECISION_REASONS` is closed: the interpolated string it replaces was
 * free text on a customer-visible surface.
 */
export const GRANT_REASONS = {
  permitted: 'permitted',
  /** A narrowing. Automatic by design — nobody consents to losing authority. */
  narrowing_needs_no_consent: 'narrowing_needs_no_consent',
  self_grant_forbidden: 'self_grant_forbidden',
  /** Only a customer principal may confer a durable assignment. */
  granter_not_customer_org: 'granter_not_customer_org',
  /** Only a customer principal may hold one. */
  target_not_customer_org: 'target_not_customer_org',
  granter_lacks_capability: 'granter_lacks_capability',
  granter_lacks_manage_roles: 'granter_lacks_manage_roles',
  scope_wider_than_granter: 'scope_wider_than_granter',
  /** The consenter's own scope does not cover the assignment being widened. */
  consenter_scope_narrower_than_assignment:
    'consenter_scope_narrower_than_assignment',
  /** The proposed role is not a later version of the one actually held. */
  role_version_not_successor: 'role_version_not_successor',
} as const
export type GrantReason = (typeof GRANT_REASONS)[keyof typeof GRANT_REASONS]

/**
 * The offending capability rides in its own field. It is data, not prose, and a
 * caller can render it, count it or switch on it.
 */
export interface GrantDecision {
  allowed: boolean
  reason: GrantReason
  capability: Capability | null
}

/**
 * May this granter confer this role at this scope?
 *
 * NO ESCALATION, AND NO SELF-GRANT. `RoleAssignment.grantedBy` was recorded and
 * constrained by nothing, while `TenantAccessGrant` two modules over enforces
 * `approvedByStaffUserId !== staffUserId` at issue AND re-checks it at
 * evaluation. Self-assignment of an arbitrary role was a legal value in the
 * type.
 *
 * Composed with the pack problem it was worse: hold `install_pack` and
 * `manage_roles`, install a pack shipping a role with `approve_resolution` and
 * `set_autonomy`, assign it to yourself. Two maintenance capabilities become
 * unlimited approval authority.
 *
 * THE ORG GATE COMES FIRST, ADDED 5 Aug. Two reasons, and the second is the
 * better one. It is cheaper — one comparison against a table rather than a loop
 * over every capability of the role. And it is a FAR MORE USEFUL AUDIT REASON:
 * `granter_not_customer_org` says a partner tried to mint durable authority
 * inside a customer's tenant, which is an incident. `granter_lacks_view_audit`,
 * the answer the capability loop would have given for the same attempt, says
 * somebody was missing a permission, which is a support ticket. The same event,
 * classified two ways, and only one of them gets looked at.
 */
export function canGrant(
  granter: PrincipalContext,
  target: { userId: UserId; orgClass: OrgClass; role: Role; scope: AssignmentScope },
): GrantDecision {
  if (!DURABLE_ASSIGNMENT_PERMITTED[granter.orgClass]) {
    return {
      allowed: false,
      reason: GRANT_REASONS.granter_not_customer_org,
      capability: null,
    }
  }
  if (!DURABLE_ASSIGNMENT_PERMITTED[target.orgClass]) {
    return {
      allowed: false,
      reason: GRANT_REASONS.target_not_customer_org,
      capability: null,
    }
  }
  if (granter.subject.userId === target.userId) {
    return {
      allowed: false,
      reason: GRANT_REASONS.self_grant_forbidden,
      capability: null,
    }
  }
  /**
   * A GRANT confers a WHOLE role on someone who had nothing, so the whole role
   * is new authority and every capability in it must be one the granter already
   * holds at a scope no narrower. That is the right question here, and the
   * wrong one for a consent — see `canConsentToWidening()`.
   */
  for (const capability of target.role.capabilities) {
    const own = effectiveScopeFor(granter, capability)
    if (!own.granted) {
      return {
        allowed: false,
        reason: GRANT_REASONS.granter_lacks_capability,
        capability,
      }
    }
    if (!scopeIsNarrowerOrEqual(target.scope, own.scope)) {
      return {
        allowed: false,
        reason: GRANT_REASONS.scope_wider_than_granter,
        capability,
      }
    }
  }
  return { allowed: true, reason: GRANT_REASONS.permitted, capability: null }
}

/**
 * May this person accept a pack upgrade that WIDENS a role somebody already
 * holds?
 *
 * A DIFFERENT QUESTION FROM `canGrant`, AND THE DEADLOCK PROVES IT. `canGrant`
 * loops every capability of the target role and refuses if the granter lacks
 * any. Applied to a widening upgrade that means the tenant admin holding
 * `manage_roles` but not `approve_resolution` cannot consent to a role that now
 * carries it — and `self_grant_forbidden` stops them re-consenting their own
 * assignment. The person administratively responsible is, by construction, the
 * one least likely to hold the new capability. Every upgrade stalls.
 *
 * The resolution is that the two questions differ in what is actually new. A
 * GRANT confers a whole role on someone who had nothing. A CONSENT accepts a
 * REDEFINITION of a role someone already holds, so only the delta
 * `(v_n+1 − v_n)` is new authority; the rest they held yesterday, under a
 * grant that already passed `canGrant`.
 *
 *     hold manage_roles
 *   ∧ hold every capability in (v_n+1 − v_n)
 *   ∧ at a scope no narrower than the assignment's
 *
 * THE DELTA CHECK IS WHAT CLOSES THE PROXY ESCALATION, and without it this
 * function would be strictly worse than the deadlock it fixes. Hold
 * `install_pack` and `manage_roles`. Install a pack that widens a role a
 * COLLEAGUE holds. Consent to it — not a self-grant, so `self_grant_forbidden`
 * never fires. The colleague gains `approve_resolution` and NOBODY WHO HOLDS
 * THAT CAPABILITY EVER AGREED. The consent test has to be about the delta
 * precisely because the actor is not the beneficiary.
 *
 * SELF-CONSENT IS PERMITTED HERE, deliberately, and it is safe for the same
 * reason. The delta check requires the consenter to already hold every added
 * capability at a wider scope, so consenting to your own widening moves nothing
 * you did not already have. `self_grant_forbidden` was blocking a no-op, and
 * blocking it is half of the deadlock.
 *
 * OPEN, AND IT SHOULD BE VISIBLE RATHER THAN SILENT. A tenant where nobody yet
 * holds the new capability has NO ELIGIBLE CONSENTER, so the upgrade holds
 * indefinitely. That is *narrowing automatic, widening an act* working
 * correctly — but a permanently-pending upgrade with no notification is
 * indistinguishable from one nobody looked at, and nothing here raises one.
 */
export function canConsentToWidening(
  consenter: PrincipalContext,
  widening: {
    /** The role as the holder has it pinned, v_n. */
    current: Role
    /** The redefinition the pack proposes, v_n+1. */
    proposed: Role
    /**
     * The live assignment being redefined. Its holder need not be the
     * consenter — that is the case the delta check exists for.
     */
    assignment: RoleAssignment
  },
): GrantDecision {
  const { current, proposed, assignment } = widening

  /**
   * Identity and direction, before anything else. Consenting one role's
   * upgrade on the strength of another role's version number is how a
   * "widening" gets accepted that is not the widening anyone reviewed.
   */
  if (
    proposed.id !== current.id ||
    assignment.roleId !== current.id ||
    assignment.roleVersion !== current.version ||
    proposed.version <= current.version
  ) {
    return {
      allowed: false,
      reason: GRANT_REASONS.role_version_not_successor,
      capability: null,
    }
  }

  const added = proposed.capabilities.filter(
    (c) => !current.capabilities.includes(c),
  )
  if (added.length === 0) {
    /**
     * Pure narrowing, or a relabelling. Nobody consents to losing authority —
     * §1's rule, and the reason widening is the only gated direction.
     */
    return {
      allowed: true,
      reason: GRANT_REASONS.narrowing_needs_no_consent,
      capability: null,
    }
  }

  /** Administrative standing. Necessary, and on its own nowhere near enough. */
  if (!effectiveScopeFor(consenter, CAPABILITIES.manageRoles).granted) {
    return {
      allowed: false,
      reason: GRANT_REASONS.granter_lacks_manage_roles,
      capability: null,
    }
  }

  for (const capability of added) {
    const own = effectiveScopeFor(consenter, capability)
    if (!own.granted) {
      return {
        allowed: false,
        reason: GRANT_REASONS.granter_lacks_capability,
        capability,
      }
    }
    /**
     * No narrower than the ASSIGNMENT'S scope, not than the role's default.
     * The assignment is where the new capability will actually bite, and a
     * consenter scoped to one legal entity must not wave through a widening
     * that lands on another.
     */
    if (!scopeIsNarrowerOrEqual(assignment.scope, own.scope)) {
      return {
        allowed: false,
        reason: GRANT_REASONS.consenter_scope_narrower_than_assignment,
        capability,
      }
    }
  }

  return { allowed: true, reason: GRANT_REASONS.permitted, capability: null }
}

/** Conservative containment. Unknown comparisons deny. */
export function scopeIsNarrowerOrEqual(
  inner: AssignmentScope,
  outer: AssignmentScope,
): boolean {
  const dimOk = <T>(i: ScopeDimension<T>, o: ScopeDimension<T>): boolean => {
    if (o.kind === 'all') return true
    if (i.kind === 'all') return false
    return i.values.every((v) => o.values.includes(v))
  }
  if (!dimOk(inner.domains, outer.domains)) return false
  if (!dimOk(inner.definitionIds, outer.definitionIds)) return false
  if (!dimOk(inner.solutionIds, outer.solutionIds)) return false
  if (!dimOk(inner.costCentres, outer.costCentres)) return false
  if (!dimOk(inner.legalEntities, outer.legalEntities)) return false

  if (outer.valueCeiling === null) return true
  if (inner.valueCeiling === null) return false
  /**
   * Refused rather than approximated. BHD carries three decimal places and USD
   * two, so equal `amountMinor` differs by ~3.8x in value — a naive comparison
   * accepts a child ceiling nearly four times its parent's.
   */
  if (inner.valueCeiling.currency !== outer.valueCeiling.currency) return false
  return inner.valueCeiling.amountMinor <= outer.valueCeiling.amountMinor
}

/* ------------------------------------------------------------------ *
 * Agents hold no roles
 * ------------------------------------------------------------------ */

/**
 * DECIDED 5 Aug 2026, against an earlier instinct that agent authority was just
 * the partner mask applied to a different principal type.
 *
 * It is not, and the difference is lifetime. A role is STANDING and
 * PER-PRINCIPAL. A `ProcedureStep.toolScope` is per-step, per-run, and signed
 * inside a pack that `validateProcedureInjectionSafety` gated. Giving an agent
 * a role converts a bounded capability into an unbounded one while touching
 * none of the four controls the posture record names as the answer — the
 * injection validator tests procedures, not principals, so a role-holding agent
 * is simply never probed.
 *
 * It would also be a SECOND AUTONOMY ENGINE. `AutonomyConfig.permittedActions`
 * is `AgentAction[]`; `Role.capabilities` is `Capability[]`. Two vocabularies,
 * partially overlapping, different closed sets, different owners — `set_autonomy`
 * belongs to a tenant while role composition may belong to a pack — and no
 * stated precedence. "No second policy engine" is a constraint this module is
 * subject to, not one it may spend.
 *
 * So agent authority is an INTERSECTION, computed per invocation and never
 * stored as a grant:
 *
 *     toolScope of the step        signed in the pack, validated at authoring
 *   ∩ AutonomyConfig               tenant-owned, versioned, the autonomy envelope
 *   ∩ scope of the initiating principal   the term that was missing entirely
 *
 * The third is the one that did not exist. `ProposalActor.agent` carries
 * `stepId` and `modelId` and no principal at all, so an agent invoked by a
 * user scoped to one entity at SGD 5,000 could auto-resolve another entity's
 * exception at SGD 400,000 — and the escalation was not merely unenforced but
 * UNCOMPUTABLE from the stored record.
 *
 * THE INDUSTRY NAMES THE ALTERNATIVE AS AN ANTI-PATTERN, in the same terms. AWS
 * Well-Architected Agentic AI Lens (AGENTSEC03): delegated access implemented
 * "by having the agent **assume a user's role** rather than carrying user
 * context as signed token claims… collapses the audit trail and gives the agent
 * the user's full permission set for the duration of the session." That is
 * `RoleAssignment.userId` holding an agent, described exactly. RFC 8693 §1.1
 * draws the line the other way round: under impersonation the agent "is
 * indistinguishable from B"; under delegation "principal A still has its own
 * identity separate from B".
 *
 * KEPT, AND NOW CITED RATHER THAN ORPHANED. This was a constant with zero call
 * sites — a comment wearing a type. It is referenced from
 * `PrincipalContext.subject`, whose shape is `{ userId, status }` for this
 * reason: the subject of a decision is a USER. There is no agent principal to
 * pass, no `AgentId` in the context, and no branch in `decide()` that could
 * accept one. Deleting the constant would leave the argument nowhere; the
 * enforcement is the narrowed subject type, and this is where it is explained.
 */
export const AGENTS_HOLD_ROLES = false

/* ------------------------------------------------------------------ *
 * A solution is a scope, never a grant
 * ------------------------------------------------------------------ */

/**
 * DECIDED 5 Aug 2026, with `Solution`. The same shape as `AGENTS_HOLD_ROLES`
 * above and for the same purpose: a refusal that a future reader has to DELETE,
 * visibly, in a diff, rather than quietly not implement.
 *
 * "Grant Priya the AP reconciliation solution" is the sentence a customer will
 * say, an admin UI will offer, and a pack author will try to ship as a role. It
 * must not be buildable, and the reason is decisive rather than a preference.
 *
 * A SOLUTION CONTAINS A SECRET. The assembly reaches an `Endpoint`, an endpoint
 * carries a `credentialRef`, and `bind_secret` maps to the resource class
 * `secret` — which is in NEITHER `PERMITTED_RESOURCES` list and is one of the
 * two members of `NON_DELEGABLE_RESOURCES`. Granting the container atomically
 * would confer, in one act, something no grant in this model may confer at any
 * price, to anyone, under any purpose. The container is not a bundle of
 * comparable things; it spans classes the model deliberately keeps apart.
 *
 * It would also be a THIRD AUTHORITY VOCABULARY. `Capability` is one closed set
 * and `AgentAction` is another, and the whole of the agent argument is that a
 * second was already one too many. A grantable solution would be a third, with
 * membership defined by an editable list — so widening someone's authority would
 * mean ADDING A DEFINITION TO A SOLUTION, an act nobody would recognise as an
 * authority change and which no consent path covers.
 *
 * WHAT REPLACES IT, and it is strictly more expressive:
 *
 *   NARROWING TO A SOLUTION   `AssignmentScope.solutionIds`. Intersects. Can
 *                             only take authority away, never add it.
 *   ACTS WITHIN A SOLUTION    the capability each act already needs, unchanged.
 *                             Nothing about being inside a solution alters what
 *                             `approve_resolution` requires.
 *   ACTS ON THE CONTAINER     `SOLUTION_CONTAINER_ACTS`, below.
 *   THE CREDENTIAL            `bind_secret`. Tenant principals only, at any
 *                             grant length. Reachable from nowhere else.
 */
export const SOLUTION_IS_GRANTABLE = false

/**
 * Acts on the container, as distinct from acts within it.
 *
 * SEPARATING THEM IS THE POINT. Standing up a solution, moving it to a new pack
 * version and switching it off are acts on CONFIGURATION. Approving a resolution
 * that the same solution produced is an act on TENANT DATA. Nothing in this
 * model previously said so, because there was no container to say it about.
 */
export const SOLUTION_CONTAINER_ACTS = {
  install: 'install',
  upgrade: 'upgrade',
  disable: 'disable',
} as const
export type SolutionContainerAct =
  (typeof SOLUTION_CONTAINER_ACTS)[keyof typeof SOLUTION_CONTAINER_ACTS]

/**
 * ⚠️ ALL THREE MAP TO ONE VERB, AND THAT IS A FINDING RATHER THAN A TIDY RESULT.
 *
 * The closed capability set has `install_pack` and nothing else for the
 * container, so DISABLING a live solution — stopping a customer's AP
 * reconciliation — costs exactly what installing one costs. That is defensible
 * on one reading (both are configuration acts of similar blast radius) and
 * uncomfortable on another (an install is additive and reviewable; a disable is
 * an outage).
 *
 * Left as one verb DELIBERATELY. Adding a capability is a platform release —
 * `view_summary` and `bind_secret` each took a documented argument to earn a
 * number — and "disable feels like it should be separate" is not that argument.
 * Recorded here so that when someone makes the argument properly, they find the
 * table rather than discovering the collapse by reading three call sites.
 *
 * Total by construction, so a fourth container act cannot be added without
 * deciding what gates it.
 */
export const SOLUTION_CONTAINER_CAPABILITY: Record<
  SolutionContainerAct,
  Capability
> = {
  install: CAPABILITIES.installPack,
  upgrade: CAPABILITIES.installPack,
  disable: CAPABILITIES.installPack,
}

/* ------------------------------------------------------------------ *
 * 7. Resolving a subject — the split RULED 2 requires, #224 [A-3]
 * ------------------------------------------------------------------ */

/**
 * WHY THERE ARE TWO FUNCTIONS HERE AND NOT ONE.
 *
 * `docs/build/stateless-red-session.md` B2: a single `resolveSession()` reads
 * the `tenant` row inside a transaction that has set only `app.session_ref`.
 * `tenant`'s policy is `USING (id = nullif(current_setting('app.tenant_id',
 * true), ''))`, ENABLEd and FORCEd in `db/migrations/0001_tenancy_and_rls.sql`,
 * and `reconcile_app` holds neither `BYPASSRLS` nor ownership — so that read
 * returns ZERO ROWS, and every correctly-selected session is refused with
 * `tenant_not_selected`: **the refusal that means the opposite of what
 * happened.**
 *
 * 🛑 REPAIRING IT IN PLACE IS WORSE, AND THAT IS THE ARGUMENT FOR THE SPLIT
 * RATHER THAN FOR A FIX. To make the `tenant` read succeed you must feed
 * `app.tenant_id` straight off the raw session column BEFORE liveness has been
 * checked — so the tenant scope opens for revoked sessions, expired sessions
 * and fired employees, and is only then refused.
 * `docs/build/stateless-adjudication.md`: *"SETTLED BY RULED 2, against
 * green's single `resolveSession()`."*
 *
 * So `resolveSubject()` below decides everything decidable WITHOUT a tenant
 * row, and cannot reach one — the parameter object offers none, which
 * `tests/model/session-resolution.test.ts` asserts against the declaration's
 * own bytes. Only after it answers does a caller open the tenant scope, read
 * the row, and call `projectTenantContext()`.
 *
 * ⚠️ THIS IS NOT A SELECTOR AND MUST NEVER BECOME ONE — G210. The tenant a
 * session is bound to comes from the HOST under G179; nothing here offers a
 * choice, and the two session-wire selection operations are DROPPED rather
 * than deferred, *"because a deferred selection operation is a selector with a
 * later date on it."* `tests/model/session-shape.test.ts` sweeps every
 * `model/*.ts` for a selector by name and fails on the first.
 */

/**
 * Every way a session can fail to yield a subject. CLOSED, and the ORDER in
 * which `resolveSubject()` reads them is part of the design rather than an
 * implementation detail — see the function.
 */
export const SESSION_REFUSALS = {
  /**
   * 🛑 THE ORG-CLASS ORACLE, CLOSED. The `IdentityConnection` handed in is not
   * the one the session records. Without this arm a caller supplies the
   * connection and therefore supplies the ORGANISATION, which turns the one
   * derivation invariant 2 rests on into a request parameter. It is checked
   * before anything is read off either row.
   */
  connectionMismatch: 'connection_mismatch',
  /** The user row handed in is not the session's. The same defect, one row over. */
  userMismatch: 'user_mismatch',
  /** Self-service sign-out, or G180's host check having written `revokedAt`. */
  sessionRevoked: 'session_revoked',
  /** Past `expiresAt`. G220 supplies the bound; `model/session.ts` validates it. */
  sessionExpired: 'session_expired',
  /** `status === 'disabled'` on the person. §8.6 — this was consulted by NOTHING once. */
  userDisabled: 'user_disabled',
  /** The door itself is switched off. A live person behind a dead door reaches nothing. */
  connectionDisabled: 'connection_disabled',
  /**
   * ⚠️ THE REFUSAL B2 MADE MEANINGLESS, AND IT IS DELIBERATELY LAST.
   * `Session.tenantId` is null between authentication and selection. Every
   * other arm above is read first, so this can only be returned when the
   * session is genuinely live and genuinely unscoped — which is the one
   * situation in which the words are true.
   *
   * ⚠️ AND IT IS NOW REACHED ONLY ON A `tenant` SURFACE — G727, 19 Sep 2026.
   * On a CONSOLE surface a session with no tenant is the CORRECT shape and
   * this arm would refuse every console principal there is. The surface is a
   * fact about the HOST and arrives as a parameter; it is never derived from
   * `session.tenantId`, because that derivation reads *"unbound therefore
   * console"* and would delete this arm for everybody.
   */
  tenantNotSelected: 'tenant_not_selected',
  /**
   * 🛑 A TENANT-BOUND SESSION PRESENTED ON A CONSOLE HOST — G727, 19 Sep 2026,
   * AND IT IS THE MIRROR OF `tenantNotSelected` RATHER THAN A SECOND COPY OF
   * IT.
   *
   * The two arms say opposite things about the same column and each is
   * reachable on exactly one surface: on a tenant host an unbound session is
   * D1's own caller, and on a console host a BOUND one is a session carrying
   * scope it may not have there. Collapsing them into one *"the tenant column
   * disagrees with the host"* would make the console arm refuse D1's caller and
   * the tenant arm admit a scoped console session — the two failures are
   * opposite and only one name cannot carry both.
   *
   * ⚠️ IT IS DEFENCE IN DEPTH RATHER THAN THE PRIMARY CONTROL, AND SAYING SO IS
   * WHAT KEEPS IT FROM BEING READ AS THE CONTROL. Nothing in `server/` can
   * produce this row today: D1 is the only thing that writes `session.tenant_id`
   * and it resolves the tenant from the HOST, so on a console host it refuses
   * at `host_not_registered` before any write. The reachable producer is a
   * migrator INSERT — a fixture, a restore, a hand-written row — and
   * `tests/db/console-session.test.ts` §3 builds exactly one and requires this
   * name back. **A control whose only witness is a fixture is §5.6 unless
   * somebody says so; this says so.**
   */
  consoleSessionIsTenantBound: 'console_session_is_tenant_bound',
  /**
   * 🛑 A SURFACE OUTSIDE THE CLOSED SET — G2021, 22 Sep 2026, AND IT IS A
   * READER AHEAD OF A MEMBER RATHER THAN A MEMBER AHEAD OF A READER.
   *
   * ⚠️ **G1922 REFUSED THIS ARM AND THE REFUSAL IS OVERTURNED HERE RATHER
   * THAN DELETED.** That row declined the `never` guard because *"writing the
   * guard is the same commit as writing the member … taking the guard alone
   * would be a control for a hazard nothing can create."* **The polarity is
   * backwards and `db/migrations/0069` states the correct one in as many
   * words:** *"an UNKNOWN value must reach the model as an `*_unreadable`
   * refusal, not be rejected at write time by a list somebody forgot to
   * extend."* `0069` applies it to `slot_cardinality_unreadable`; this is the
   * same sentence about a surface. **A reader that answers an unknown value is
   * not speculative — it is the thing that makes the set closed.**
   *
   * 🛑 AND THE HAZARD WAS NOT HYPOTHETICAL: G1923 MEASURED IT. Before this
   * arm, `resolveSubject()` given a surface outside the set returned
   * `{"ok":true,"subject":{"surface":"tenant",…,"tenantId":"ten_acme",…}}` —
   * it rewrote the surface and handed back a tenant scope. **That is the
   * reader answering WRONGLY, in the direction that grants scope**, and it is
   * what this arm replaces.
   *
   * ⚠️ IT IS REACHABLE ONLY THROUGH A CAST TODAY, AND SAYING SO IS WHAT KEEPS
   * IT FROM BEING READ AS A LIVE PATH. `ServedSurfaceKind` has two members and
   * `resolveServedHost()` constructs nothing else, so no caller can produce
   * this without `as`. **The arm exists so that the NEXT member is a compile
   * error at the `never` binding below rather than a silent tenant** — which
   * is `CLAUDE.md`'s own promise for a closed set, finally paid on this axis.
   * `tests/model/session-resolution.test.ts` counts the set, so its arrival
   * was a red assertion somebody deleted on purpose.
   *
   * ⚠️ IT REACHES NO WIRE. `SESSION_REFUSALS` is not one of the three
   * vocabularies `tests/contracts/session-error-vocabulary.test.mjs` mirrors
   * onto `errors.yaml`, and `server/data-plane/session.ts` answers every
   * refusal but `tenant_not_selected` with the same 401 — so this name is an
   * operator's log line and never a caller's error code.
   */
  surfaceUnreadable: 'surface_unreadable',
} as const

export type SessionRefusal = (typeof SESSION_REFUSALS)[keyof typeof SESSION_REFUSALS]

/**
 * WHAT `resolveSubject()` MAY BE HANDED, AND IT IS THE SEAM.
 *
 * 🛑 THERE IS NO TENANT ROW IN THIS TYPE AND THERE MAY NEVER BE ONE. It is not
 * enough that the function does not read one: a parameter that OFFERS one is a
 * parameter the next reader will pass, and the seam closes silently the moment
 * they do. `tests/model/session-resolution.test.ts` reads this declaration
 * with comments stripped and fails on the word.
 *
 * ⚠️ `now` IS SUPPLIED RATHER THAN READ FROM A CLOCK, for `PrincipalContext.now`'s
 * reason: a decision has to be reproducible in an audit.
 */
export interface SubjectResolutionInput {
  readonly session: Session
  readonly user: User
  /** The door the session records. Must BE that door — see `connection_mismatch`. */
  readonly connection: IdentityConnection
  readonly now: Timestamp
  /**
   * WHICH SURFACE THE REQUEST ARRIVED ON — G726/G727, 19 Sep 2026.
   *
   * 🛑 IT IS A LOOKUP'S ANSWER AND NEVER A DERIVATION, WHICH IS G179 ARRIVING
   * AT THIS FUNCTION. `resolveServedHost()` in `model/serving-host.ts` reads
   * two registries and returns one of two kinds; this takes the KIND alone.
   * Deriving it here from `session.tenantId` — *"unbound therefore console"* —
   * is the defect the whole term exists to make impossible: it would hand a
   * principal to every caller standing in front of D1.
   *
   * 🛑 AND IT CARRIES NO TENANT, WHICH IS WHY THE KIND IS TAKEN RATHER THAN THE
   * SURFACE. `ServedSurface`'s tenant arm holds a `TenantId`, and the
   * declaration above this one says a tenant row may never be offered here —
   * `tests/model/session-resolution.test.ts` reads these bytes with comments
   * stripped and fails on the word. A two-member string union offers nothing to
   * read.
   */
  readonly surface: ServedSurfaceKind
}

/**
 * Everything a `PrincipalContext` needs that can be known without reading
 * anything tenant-scoped.
 *
 * What is deliberately NOT here: `held`, because assignments are tenant-scoped
 * rows and reading them is exactly what must wait for the scope this result
 * authorises; and `partnerGrant`, for the same reason.
 */
/**
 * 🛑 A DISCRIMINATED UNION SINCE G727, 19 Sep 2026, AND THE SHAPE IS THE
 * CONTROL. ⚠️ **IT WAS ONE INTERFACE WITH `tenantId: TenantId` AND THE OLD
 * COMMENT READ *"Non-null. A session with no tenant bound is refused, not
 * resolved."* THAT SENTENCE IS CORRECTED RATHER THAN DELETED**, because it is
 * the sentence `server/data-plane/session.ts` reads its whole tenant scope off
 * and the one a reader would have quoted before concluding a console session
 * could not exist.
 *
 * **A console subject has NO `tenantId` PROPERTY AT ALL.** Not `null` — absent.
 * `withTenantScope(pool, subject.tenantId, …)` against a console subject is a
 * compile error, and so is every other read of it, which is strictly stronger
 * than a nullable field somebody has to remember to narrow. This is
 * `ServedSurface`'s shape one layer down, in the same commit and for the same
 * reason: *"a parameter that OFFERS one is a parameter the next reader will
 * pass."*
 *
 * ⚠️ AND THE THREE FIELDS THAT SURVIVE ON BOTH ARMS ARE THE THREE THAT ARE NOT
 * TENANT-SCOPED. `userId` and `orgClass` come from the person and the door,
 * both read under the SESSION scope (`0009` keys five of its eight tables on
 * `app.session_ref`, *"because a person is read BEFORE a tenant is selected"*),
 * and `partnerId` off the same door's owner. Nothing that needs
 * `app.tenant_id` is on either arm.
 *
 * What is deliberately NOT here, on either arm: `held`, because assignments are
 * tenant-scoped rows and reading them is exactly what must wait for the scope
 * this result authorises; and `partnerGrant`, for the same reason.
 */
export type ResolvedSubject =
  | {
      readonly surface: typeof SERVED_SURFACE_KINDS.tenant
      readonly userId: UserId
      /** Non-null on this arm. An unbound session on a tenant host is refused. */
      readonly tenantId: TenantId
      /** Derived from `connection.owner` on every call. Never stored. */
      readonly orgClass: OrgClass
      /** The partner whose directory authenticated them. Null unless `partner`. */
      readonly partnerId: PartnerId | null
    }
  | {
      readonly surface: typeof SERVED_SURFACE_KINDS.console
      readonly userId: UserId
      /** Derived from `connection.owner` on every call. Never stored. */
      readonly orgClass: OrgClass
      /**
       * The partner whose directory authenticated them. Null unless `partner`.
       *
       * ⚠️ THERE IS NO `console: ConsoleKind` FIELD BESIDE IT AND THE ABSENCE
       * IS A DECISION. `docs/contracts/administration.openapi.yaml` declares
       * TWO `servers` and says in its own voice that *"A PLANE THAT MOUNTS THIS
       * TIER SERVES ONE HOST AND MUST REFUSE THE OTHER'S PATHS. Nothing below
       * expresses that, and nothing in `server/` can."* `resolveConsoleHost()`
       * answers WHICH console and could be threaded here in one line — and
       * **no operation on that tier is mounted (G602), so the field would have
       * no reader.** `db/migrations/0004_subject_ledger.sql`'s rule applies to
       * a type as readily as to a column: the commit that mounts the first
       * console operation adds it, and owes the refusal that reads it.
       */
      readonly partnerId: PartnerId | null
    }

export type SubjectResolution =
  | { readonly ok: true; readonly subject: ResolvedSubject }
  | { readonly ok: false; readonly refusal: SessionRefusal }

type AssertTrue<T extends true> = T

export type _SessionRefusalsAreExhaustive = AssertTrue<
  Exclude<SubjectResolution, { ok: true }>['refusal'] extends SessionRefusal
    ? SessionRefusal extends Exclude<SubjectResolution, { ok: true }>['refusal']
      ? true
      : false
    : false
>

/**
 * Total. Never throws. Reads no clock, no database and NO TENANT ROW.
 *
 * 🛑 THE ORDER IS THE SLICE, and one assertion in the suite exists for it
 * alone. Row agreement first — a caller holding the wrong door must not reach
 * `orgFor()`. Then liveness. **`tenant_not_selected` is LAST**, because the
 * defect this function replaces answered `tenant_not_selected` for a session
 * that had been revoked, and ordering it last makes that unrepresentable
 * rather than merely unlikely.
 *
 * ⚠️ THERE IS NO SECOND-FACTOR PARAMETER AND NO SECOND-FACTOR ARM. #224's body
 * names one as a refusal; **G223, 22 Aug 2026, dropped that field for v1** —
 * *"The v1 answer to a second factor is that it is not ours to enforce"* — and
 * `tests/model/session-shape.test.ts` sweeps `model/*.ts` for a producer and
 * fails on the first. Reading a field with no producer as *"none was
 * performed"* is the defect #234 filed and G223 answered, so the arm is not
 * built. The issue predates the ruling.
 *
 * ⚠️ AND THERE IS NO ARM REFUSING A SESSION WHOSE DOOR DIFFERS FROM THE
 * PERSON'S DIRECTORY, WHICH #224's BODY ALSO NAMES. `Session.connectionId`'s
 * declaration — which landed after the issue was filed — rules the opposite in
 * as many words: *"org is a property of HOW YOU AUTHENTICATED, not of who you
 * are: a dual-affiliated consultant is partner on Monday and customer on
 * Tuesday, and each session has to record which."* An arm refusing that
 * disagreement makes the one case the field exists for unreachable, and the
 * suite pins the absence by name.
 *
 * ⚠️ `expiresAt <= now` IS A LEXICAL STRING COMPARISON, matching `decide()` and
 * `redeemAuthorization()` exactly. It is correct for ISO-8601 in UTC with a
 * fixed number of fractional digits and silently wrong for anything else.
 * **The timestamp codec G111's shape calls for is not started**, and
 * `model/session.ts` says so on itself; this uses the same comparison every
 * other clock in `model/` already uses, so there is one thing to fix rather
 * than two.
 */
export function resolveSubject(input: SubjectResolutionInput): SubjectResolution {
  const { session, user, connection, now } = input

  if (session.connectionId !== connection.id) {
    return { ok: false, refusal: SESSION_REFUSALS.connectionMismatch }
  }
  if (session.userId !== user.id) {
    return { ok: false, refusal: SESSION_REFUSALS.userMismatch }
  }

  if (session.revokedAt !== null) {
    return { ok: false, refusal: SESSION_REFUSALS.sessionRevoked }
  }
  if (session.expiresAt <= now) {
    return { ok: false, refusal: SESSION_REFUSALS.sessionExpired }
  }
  if (user.status === 'disabled') {
    return { ok: false, refusal: SESSION_REFUSALS.userDisabled }
  }
  if (connection.status === 'disabled') {
    return { ok: false, refusal: SESSION_REFUSALS.connectionDisabled }
  }

  const owner = connection.owner
  const tenantId = session.tenantId

  /**
   * 🛑 THE SURFACE ARM, AND IT IS LAST FOR `tenant_not_selected`'s OWN REASON.
   * G727, 19 Sep 2026. Every liveness question above is answered before the
   * shape of the session's tenant column is looked at, so neither of these two
   * refusals can be returned for a session that is revoked, expired, behind a
   * disabled person or behind a disabled door. **The defect this function was
   * written to kill — a revoked session reported as `tenant_not_selected` — is
   * killed for the console arm by the same ordering and without a second
   * assertion.**
   *
   * ⚠️ THE CONSOLE ARM IS CHECKED FIRST AND THE ORDER IS OBSERVABLE. A
   * tenant-bound session on a console host must be refused as
   * `console_session_is_tenant_bound`; reading the `tenantId === null` arm
   * first would let it fall through and be RESOLVED, on the tenant arm, with a
   * tenant nobody's host named.
   */
  /**
   * 🛑 A `switch` WITH A `never` DEFAULT SINCE G2021, 22 Sep 2026, AND IT IS
   * NOT A RESTYLING OF THE TWO `if`s IT REPLACES.
   *
   * The `if (surface === console) { … }` form that stood here fell THROUGH to
   * the tenant shape for anything that was not `console` — so a third member
   * would have been resolved as a tenant, with the surface rewritten on the
   * way out and a `tenantId` attached. **G1923 measured that and printed the
   * value.** This form has no fall-through: a third `ServedSurfaceKind` is a
   * compile error at the `never` binding below, in this file and in
   * `server/data-plane/session.ts`, which is the protection `CLAUDE.md`
   * promises for a closed set and which G1922 measured as absent on this axis.
   *
   * ⚠️ THE TWO ARMS ARE BYTE-FOR-BYTE WHAT THEY WERE, INCLUDING THEIR ORDER —
   * the console arm is still first, for the reason the block immediately above
   * gives, which is not restated here.
   */
  switch (input.surface) {
    case SERVED_SURFACE_KINDS.console: {
      if (tenantId !== null) {
        return { ok: false, refusal: SESSION_REFUSALS.consoleSessionIsTenantBound }
      }
      return {
        ok: true,
        subject: {
          surface: SERVED_SURFACE_KINDS.console,
          userId: user.id,
          orgClass: orgFor(owner),
          partnerId: owner.kind === 'partner' ? owner.partnerId : null,
        },
      }
    }
    case SERVED_SURFACE_KINDS.tenant: {
      if (tenantId === null) {
        return { ok: false, refusal: SESSION_REFUSALS.tenantNotSelected }
      }
      return {
        ok: true,
        subject: {
          surface: SERVED_SURFACE_KINDS.tenant,
          userId: user.id,
          tenantId,
          orgClass: orgFor(owner),
          partnerId: owner.kind === 'partner' ? owner.partnerId : null,
        },
      }
    }
    default: {
      /**
       * A THIRD `ServedSurfaceKind` LANDS HERE AS A TYPE ERROR — the shape
       * `model/reconciliation.ts`'s `uniquenessPreflight()` already uses for
       * `Expr`'s six arms, so this is an idiom in this repository rather than
       * a new one.
       *
       * 🛑 AND THE RUNTIME ANSWER IS A REFUSAL AND NOT A THROW. `resolveSubject`
       * never throws — `tests/model/session-resolution.test.ts` asserts that by
       * name — and a value that reached here through a cast must fail CLOSED,
       * which is `0069`'s `*_unreadable` polarity and the opposite of what this
       * function did before.
       */
      const unreadable: never = input.surface
      void unreadable
      return { ok: false, refusal: SESSION_REFUSALS.surfaceUnreadable }
    }
  }
}

/**
 * THE MODEL TWIN OF A SCHEMA NAMED SEVEN TIMES ON THE WIRE AND ZERO TIMES HERE.
 *
 *     grep -rn 'TenantContext' model/*.ts             → 0   (before this slice)
 *     grep -rn 'TenantContext' docs/contracts/*.yaml  → 7
 *
 * §5.3 with a wire on one side and nothing on the other. The schema is
 * `docs/contracts/foundation.openapi.yaml`'s — `required: [tenantId,
 * environment, residency, deploymentMode]`, `additionalProperties: false` —
 * and this mirrors it key for key so the two can be moved together.
 *
 * ⚠️ WHICH SLICE MINTS THIS WAS A CONTRADICTION IN THE RECORD, AND IT IS
 * ANSWERED HERE RATHER THAN DISCOVERED AT A MERGE. #157's D17 derivation greps
 * for this name alongside two others, while #157's own Not-In-This-Slice list
 * names it and its projection explicitly. Both cannot be true. **This slice
 * takes the exclusion list as the binding half** — that is the explicit
 * statement of scope, and the grep is a derivation of absence — and mints the
 * type here, so #157 stays narrow and cites this instead. **The failure mode
 * is minting it twice, and it is avoided by one side saying which.**
 *
 * 🛑 THE CONTRACT DEBT, STATED PRECISELY BECAUSE IT IS EASY TO PAY WRONG. When
 * the session wire lands, the WIRE schema gains `orgClass` — the open item the
 * access record has carried since 5 Aug — **and gains nothing else.** It does
 * not gain a session identifier and it does not gain a handle digest: a
 * context is what a request is evaluated in, and a session identifier in it
 * would put the credential's address on every response that echoes a scope.
 * This declaration gains `orgClass` in the SAME commit as the wire and not
 * before, so the mirror never has a stale side.
 *
 * 🛑 `_TenantContextIsNotARow` — AND THE TYPE SYSTEM CANNOT STATE IT. #224 asks
 * for a type-level assertion that this never extends `TenantScoped`. It is
 * inexpressible: `TenantScoped` is `{ tenantId: TenantId }` and the field
 * below is a non-null `TenantId`, so the relation is STRUCTURALLY TRUE whether
 * or not the clause is written, and an `AssertFalse` over it is red on a
 * CORRECT declaration and can never go green. It was written and measured; the
 * measurement is in the mutation block of
 * `tests/model/session-resolution.test.ts`. `_SessionIsNotTenantScoped`
 * (`model/identity.ts`) works only because `Session.tenantId` is nullable —
 * the nullability does the work there, not the assertion. So the control is
 * textual and it lives in the suite, where writing the clause reddens exactly
 * one named test.
 *
 * WHY IT MATTERS AT ALL: a stored derivation is a cache with a staleness
 * window over authority. Every field below is read from the tenant row inside
 * the scope `resolveSubject()` authorised, on the request that needs it.
 */
export interface TenantContext {
  readonly tenantId: TenantId
  readonly environment: TenantEnvironment
  readonly residency: RegionKey
  readonly deploymentMode: DeploymentMode
}

/**
 * The projection. Takes an ALREADY-SCOPED tenant row — the other half of the
 * seam: `resolveSubject()` may not see one, and this may not be called until
 * the scope its answer opened has returned it.
 *
 * ⚠️ IT TAKES THE WHOLE ROW RATHER THAN FOUR ARGUMENTS, deliberately. Four
 * positional arguments of which two are strings is a call site that can be
 * written wrong and compile; a row cannot be assembled wrong here because the
 * caller did not assemble it.
 */
export function projectTenantContext(tenant: Tenant): TenantContext {
  return {
    tenantId: tenant.id,
    environment: tenant.environment,
    residency: tenant.residency,
    deploymentMode: tenant.deploymentMode,
  }
}

/* ------------------------------------------------------------------ *
 * 7a. Binding a tenant to a session — the CHECK, never the CHOOSER.
 *     G199 (S-21) and G210, for #157 [M1-2]
 * ------------------------------------------------------------------ */

/**
 * 🛑 THE WRITE INVARIANT 1 HAD NO GATE ON, AND THE SENTENCE SURVIVED ANYWAY.
 *
 * `docs/build/stateless-red-session.md` B1: the request-supplied tenant did
 * not disappear when the invariant was written down — **it moved into the one
 * body that establishes a scope.** *"There is no `selectTenant` function …, no
 * refusal member for it …, no mutation for it in the M1–M14 table, no
 * assertion …, and no predicate in [the] migration. The one authority-bearing
 * write on the surface is specified as an operation name."* Every other
 * enforcement in this module answers *may this principal DO this*; nothing
 * answered *may this principal BE SCOPED HERE*.
 *
 * ⚠️ §5.1 AT FULL SIZE, WHICH IS WHY IT SURVIVED REVIEW. The rule was keyed on
 * the landmark *"no `tenantId` in a request body"* — a grep that passes at
 * zero — instead of on the property it protects, **the principal may only be
 * scoped to a tenant they hold a live membership in.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS IS A CHECK AND IT MUST NEVER BECOME A CHOOSER — G210.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The tenant is NOT an option this function picks from a list. It arrives
 * already decided, from the HOST under G179 — one host per tenant, *"precisely
 * so that there is no selector to defeat"* — and this function answers yes or
 * no about that one tenant. `GET /session/tenants` and `POST /session/tenant`
 * are **DROPPED rather than deferred**, *"because a deferred selection
 * operation is a selector with a later date on it."*
 *
 * ⚠️ SO THERE IS NO `memberships → tenantIds` MAPPING ANYWHERE BELOW, and
 * adding one is the whole defect arriving by helpfulness. The membership array
 * is a HAYSTACK to search, not a menu to return. If a caller ever needs the
 * list of tenants a person belongs to, that is a different function with a
 * different ruling, and G179's sentence has to be amended in writing first.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ THE COST G199 DECLARED IS DISCHARGED — S-21, 19 Sep 2026, G292.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🛑 THE PARAGRAPH BELOW IS QUOTED RATHER THAN DELETED, because it is the
 * sentence a reader would have trusted and because it is quoted verbatim in
 * `db/migrations/0005_session_and_membership.sql`, in `docs/HANDOFF.md`'s G199
 * row and in two test files. **Every clause of it is now false:**
 *
 *     "A platform FDE has NO `Membership` — that is what being platform staff
 *      means in this model; staff reach a tenant by `TenantAccessGrant`, not by
 *      membership. So this function is EMPTY for an FDE, `Session.tenantId` can
 *      never be set for staff, and invariant 8's PERMITTED path is structurally
 *      unreachable until the staff slice lands. No document may describe that
 *      path as built, reachable or enforced."
 *
 * **The first sentence survives and is the mechanism rather than the defect:**
 * a platform FDE still has no `Membership`, and still reaches a tenant by
 * `TenantAccessGrant`. What has changed is that this function now READS one.
 *
 * #157: *"A prohibition that is enforced by making the permission unreachable
 * is not an enforced invariant; it is an unbuilt feature wearing an
 * invariant's badge."* G60 read as applied for eight days while the FDE could
 * not bind a credential, and it took G75 finding a third constant to notice.
 * ⚠️ **The difference was that the unreachability was DECLARED rather than
 * discovered — and a declared temporary is still a temporary that becomes
 * permanent by silence.** It became permanent for thirty-four days and was
 * ended by a ruling rather than by anybody noticing.
 *
 * 🛑 **THE TWO TESTS THAT ASSERTED THE COST WENT RED IN THE COMMIT THAT LANDED
 * THIS ARM, WHICH IS WHAT THEY WERE FOR.**
 * `test_the_staff_path_is_unreachable_and_that_is_G199s_declared_cost`
 * (`tests/model/session-resolution.test.ts` §8) and
 * `test_the_staff_path_is_unreachable_in_the_database_too_and_that_is_G199s_cost`
 * (`tests/db/session-membership-selection.test.ts`) both failed BEFORE either
 * was edited, and each is now amended in place with what the arm permits and
 * what it still refuses. **Neither was edited to suit the implementation before
 * being seen to fail** — that inverts the control, which is the whole reason
 * G199 required them to exist in the first place.
 *
 * ⚠️ **WHAT IS STILL OWED, AND IT IS NOT NOTHING.** `staffGrant` is OPTIONAL on
 * the input rather than required, for the fence reason `PrincipalContext`
 * `.platformHeld` states one section up and no better reason; nothing on the
 * SERVED path supplies one, because `server/data-plane/context.ts` is the only
 * construction site outside `tests/` and this slice was fenced out of
 * `server/`; and nothing MINTS a grant row — `db/migrations/0008` grants the
 * app role `SELECT` and nothing else, exactly as 0005 does for `membership`.
 * **So the arm is reachable and its term has no producer in any serving path.**
 * That is the same shape G289 recorded for `platformHeld` on the same day and
 * behind the same fence; it is named here rather than left to be discovered.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE DATABASE HALF IS NOT OPTIONAL AND IT IS NOT THIS FILE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `db/migrations/0005_session_and_membership.sql` carries the identical
 * predicate as an `AS RESTRICTIVE` `WITH CHECK` on `tenant.session`, so that a
 * handler which forgets to call this function is refused by the database
 * rather than trusted. #157: *"This slice lands the model half and the
 * database half together, because either alone is a defeat."* **The split G199
 * made is customer-versus-staff, never model-versus-database.**
 *
 * ⚠️ **AND SINCE 19 Sep 2026 IT IS TWO FILES, NOT ONE.**
 * `db/migrations/0008_staff_grant_selection.sql` is the staff arm's other half:
 * it creates `tenant.tenant_access_grant`, its resource lines and the three
 * governance lists as SEEDED REFERENCE DATA, and it `ALTER POLICY`s the same
 * `session_selection_restrictive` to carry G199's one additional
 * `OR EXISTS (… tenant_access_grant …)` disjunct. **Read both migrations, or
 * you have read half of the database half.**
 *
 * ⚠️ THE TWO HALVES ARE NOT IDENTICAL AND THE DIFFERENCE IS NAMED HERE RATHER
 * THAN LEFT TO A FAILING TEST: the policy's clock is `now()`, the
 * TRANSACTION's; this function's clock is the caller's `now`, for
 * `PrincipalContext.now`'s reason — *"a decision has to be reproducible in an
 * audit"* — and a policy expression has no parameter to take. They agree to
 * within one transaction, which is the whole of the exposure.
 */

/**
 * Every way a principal can fail to be scopeable to the tenant the host bound.
 *
 * ✅ **TWO MEMBERS SINCE 19 Sep 2026, AND THE SECOND ONE ARRIVING HERE IS G199's
 * OWN ACCEPTANCE CONDITION MET RATHER THAN A WIDENING.** This block read
 * *"🛑 EXACTLY ONE MEMBER, AND G199 REQUIRES THAT RATHER THAN MERELY PERMITTING
 * IT"*, quoting the ruling: *"the refusal set has exactly one member so any
 * later arm is a VISIBLE ADDITION TO A CLOSED UNION rather than a widened
 * predicate inside a function body."* It then said: *"The staff arm arrives as
 * a second name here, in a diff, or it does not arrive."* **This is that diff.**
 *
 * ⚠️ **THE SIZE OF THE SET IS THE CONTROL, SO IT IS ASSERTED AND NOT ASSUMED.**
 * `tests/model/session-resolution.test.ts` pins the members by value and went
 * RED on this commit rather than being adjusted ahead of it — a closed union
 * nobody counts is a union that grows quietly, which is the failure this
 * comment exists to make impossible.
 *
 * ⚠️ REUSED, NOT MINTED. `membership_absent` is ALREADY a wire code in
 * `docs/contracts/errors.yaml`, and
 * `tests/contracts/session-error-vocabulary.test.mjs` lists it among *"THE
 * FOUR THAT ALREADY EXIST … this slice REUSES them rather than minting a
 * session-flavoured twin of each."* Minting `session_membership_absent` here
 * would have been the transcription defect that file exists to catch.
 */
export const TENANT_SELECTION_REFUSALS = {
  /**
   * NO LIVE MEMBERSHIP FOR THIS PRINCIPAL IN THIS TENANT — and the one word
   * covering revoked, expired and never-existed is DELIBERATE rather than
   * lazy.
   *
   * 🛑 SPLITTING IT INTO `membership_revoked` AND `membership_expired` WOULD
   * BUILD AN ORACLE. The caller is, at this point in the chain, someone who
   * has authenticated at a door and arrived at a host. Telling them *"your
   * membership here was revoked"* rather than *"you have none"* discloses that
   * the tenant exists, that they were once in it, and roughly when that
   * changed — to whoever holds the handle. `IdentityConnection` refuses the
   * same disclosure one row up, and `SESSION_REFUSALS.tenantNotSelected` is
   * ordered last for the same family of reason.
   *
   * ⚠️ IT ALSO KEEPS THE SET AT ONE. Two members would make the staff arm's
   * addition a third, and G199's *"visible addition to a closed union"* is
   * about the set having a size somebody notices changing.
   */
  membershipAbsent: 'membership_absent',
  /**
   * NO LIVE `TenantAccessGrant` ADMITS THIS PRINCIPAL TO THIS TENANT — and, as
   * above, the ONE word covering every way a grant can fail to admit is
   * DELIBERATE rather than lazy.
   *
   * ⚠️ REUSED, NOT MINTED, EXACTLY AS `membership_absent` WAS.
   * `access_grant_absent` is ALREADY a wire code in `docs/contracts/errors.yaml`,
   * where `control-plane.openapi.yaml` uses it for *"a session reported against
   * a grant we do not hold"* — the same fact from the other end of the same
   * relationship. Minting `staff_grant_absent` beside it would be the
   * transcription defect `tests/contracts/session-error-vocabulary.test.mjs`
   * exists to catch, and the error enum is CLOSED.
   *
   * 🛑 SIX DISTINCT REFUSALS COLLAPSE INTO THIS NAME AND THE COLLAPSE IS THE
   * POINT: the grant is for another tenant, the grant is somebody else's, the
   * grant is revoked, the grant has expired, the grant exceeds
   * `MAX_GRANT_HOURS` for its purpose, or the grant claims a resource class the
   * three governance lists refuse. **Splitting them would build an oracle of
   * exactly the kind `membership_absent` refuses to build one step earlier** —
   * *"your grant here was revoked"* discloses that the tenant exists, that
   * somebody once held a grant on it, and roughly when that changed, to whoever
   * holds the handle. `evaluateTenantAccess()` distinguishes all six because its
   * caller is STAFF TOOLING looking at a grant they already hold; this function's
   * caller is a request at a door.
   *
   * ⚠️ WHICH OF THE TWO NAMES COMES BACK IS A FACT ABOUT WHAT THE CALLER
   * OFFERED, NEVER ABOUT THE TENANT. No grant offered → `membership_absent`,
   * because the membership arm was the only arm available. A grant offered and
   * refused → this. The caller already knows which of the two they handed us, so
   * neither name tells them anything they did not bring with them.
   */
  accessGrantAbsent: 'access_grant_absent',
} as const

export type TenantSelectionRefusal =
  (typeof TENANT_SELECTION_REFUSALS)[keyof typeof TENANT_SELECTION_REFUSALS]

/**
 * WHAT `selectTenantForSession()` MAY BE HANDED.
 *
 * 🛑 THERE IS NO `tenantIds`, NO `candidates` AND NO `Tenant` ROW IN THIS TYPE
 * AND THERE MAY NEVER BE ONE. A plural parameter is a menu, and a menu is the
 * selector G210 dropped; a `Tenant` row is the read B2 showed cannot happen
 * yet, because the tenant scope that would make it readable is the very thing
 * this call authorises. `tests/model/session-resolution.test.ts` reads this
 * declaration with comments stripped and fails on the words.
 */
/**
 * THE TERMS THE STAFF ARM READS, AND NOTHING ELSE — G729, 19 Sep 2026.
 *
 * ⚠️ **`TenantSelectionInput.staffGrant` WAS TYPED `TenantAccessGrant | null`
 * AND G199 *"names this field, this type and this shape"*. THIS IS A WIDENING
 * OF THE PARAMETER, NOT A NARROWING OF THE CHECK**, and the distinction is the
 * whole argument: a `TenantAccessGrant` is still assignable here — every
 * existing call site and every fixture compiles unchanged — and nothing the
 * arm tests has moved. What changed is that a caller holding LESS than a whole
 * grant can now supply what the arm actually reads.
 *
 * 🛑 THE REASON IS A MEASUREMENT AND NOT A PREFERENCE: **`db/migrations/0008`
 * DOES NOT STORE A WHOLE `TenantAccessGrant` AND SAYS SO ON ITS OWN FACE.** Its
 * grant table carries seven columns and its resource-line table three, under
 * the heading *"THE COLUMN SET IS AGAIN THE PREDICATE'S AND NOT THE
 * INTERFACE'S … `AccessResourceGrant` also carries `mode` and
 * `nominatedSubjectIds`; both are read by `grantAllows()` at USE time and by
 * nothing here."* There is no `approved_by`, no `justification`, no
 * `engagement_ref`, no `idle_revoke_days`, no `last_used_at`, no
 * `customer_notified_at`, no `customer_approved_at`, no `revoked_by`, no
 * `revocation_reason` and **no extension table at all**.
 *
 * **So a reader forced to produce a `TenantAccessGrant` would have to
 * FABRICATE ELEVEN FIELDS in order to have eight read back out** — which is
 * `server/data-plane/context.ts`'s refusal of `projectTenantContext()`, word
 * for word: *"a worse defect than the duplication it would avoid … a
 * fabricated `supportAccessMode` sitting in a local, briefly, is exactly the
 * shape that gets lifted into something that persists."* Two of the eleven are
 * `visibleToTenant: true` and `justification`, which is *"Required, free text,
 * and shown to the customer"* — a manufactured justification for a real access
 * is the worst single value in that list.
 *
 * 🛑 AND IT IS THE DISCIPLINE THIS MODULE ALREADY APPLIES TWICE.
 * `PrincipalContext.subject` is *"Structurally narrowed to `{ userId, status }`
 * rather than taking `User`, so that no evaluation can reach an email, a
 * display name, or the `identityProvider` field the org axis is derived
 * from"*; `PrincipalContext.partnerGrant` is `PartnerGrantTerms` and not a
 * `PartnerAccessGrant` for the same reason. **A selection decision has no
 * business reaching a customer-visible justification or an approver's name**,
 * and a parameter that offers them is a parameter somebody reads.
 *
 * ⚠️ EVERY FIELD BELOW IS READ BY `selectTenantForSession()` AND NO FIELD IT
 * READS IS MISSING — that is the one property this type has to have, and
 * `tests/model/staff-grant-terms.test.ts` §1 asserts it by reading the
 * function's own bytes for `staffGrant.<name>` and requiring the set to match.
 */
export interface StaffGrantTerms {
  /** Indexes `MAX_GRANT_HOURS` and reaches `PERMITTED_RESOURCES`. */
  readonly purpose: AccessPurpose
  /**
   * COMPARED against `session.userId`, never read as the answer.
   * `grantAllows()`'s correction of 5 Aug 2026 applies to both this and
   * `tenantId`.
   */
  readonly staffUserId: UserId
  /** COMPARED against `hostBoundTenantId`. Never the source of a tenant. */
  readonly tenantId: TenantId
  /** The ceiling is measured FROM this. A grant that lies about it lengthens. */
  readonly grantedAt: Timestamp
  readonly expiresAt: Timestamp
  readonly revokedAt: Timestamp | null
  /**
   * The lines the three governance lists are consulted about. **`mode` and
   * `nominatedSubjectIds` are deliberately absent**: `REQUIRES_ENUMERATION` is
   * a FOURTH list and 0008 records that it *"is deliberately not applied at
   * selection: it decides whether a grant may reach a NAMED SUBJECT, and
   * selection names none."*
   */
  readonly resources: readonly { readonly resource: AccessResourceClass }[]
  /**
   * Walked for `greatest(extendedTo)` so a chain of short extensions cannot
   * arrive where one long grant would have been refused. **`db/migrations/0008`
   * ships no extension table**, so every grant this repository can read carries
   * `[]` — which the function's own note says is safe, because in the database
   * `expires_at` IS the effective expiry and the identical ceiling predicate
   * catches an `UPDATE` to it.
   */
  readonly extensions: readonly { readonly extendedTo: Timestamp }[]
}

/**
 * A STAFF GRANT AS `decide()` READS IT — the terms plus the grant's own id.
 * **G2591, 1 Oct 2026.**
 *
 * ⚠️ THE ID IS ADDED HERE AND NOT TO `StaffGrantTerms`, because that type's one
 * property is that *"every field below is read by `selectTenantForSession()`
 * and no field it reads is missing"* — selection names no grant, so an `id`
 * there would be a field nothing reads. `decide()` DOES name it: invariant 10's
 * record must say which grant an act ran under (`DecisionViaStaffGrant`).
 * A `HeldStaffGrant` is assignable wherever `StaffGrantTerms` is, so the one
 * reader (`readStaffGrant()`) produces one value for both callers.
 */
export interface HeldStaffGrant extends StaffGrantTerms {
  readonly id: TenantAccessGrantId
}

/**
 * IS THIS STAFF GRANT LIVE, FOR THIS PERSON, IN THIS TENANT, NOW? **G2591,
 * 1 Oct 2026 — and it is a MOVE, not a widening.** The eleven conditions below
 * were inline in `selectTenantForSession()`'s staff arm (S-21, G199, G292,
 * G729). G2407's branch in `decide()` asks the same question on every gated
 * operation, and writing eleven conditions twice is §5.3 — *"two
 * implementations of one order, and the one that drifts is always the copy"*.
 * So they live here and both callers reach them, which is G641's precedent for
 * `holdsLiveMembership()` exactly: one predicate, two callers, a count of one.
 *
 * Every comment below moved with its line and still describes it.
 *
 * Total. Never throws. A grant it cannot read is a grant it refuses.
 */
export function holdsLiveStaffGrant(input: {
  readonly grant: StaffGrantTerms
  readonly userId: UserId
  readonly tenantId: TenantId
  readonly now: Timestamp
}): boolean {
  const { grant: staffGrant, userId, tenantId, now } = input

  /**
   * 🛑 STRUCTURAL READABILITY FIRST, AND IT IS NOT A NULL-SAFETY HABIT — IT IS
   * WHAT KEEPS THE THREE-LIST CHECK BELOW FROM BEING SKIPPED BY A MALFORMED
   * ROW. `authorisationPermits()` indexes `PERMITTED_RESOURCES[purpose]`, so a
   * grant carrying a purpose that is not one of the two would throw inside the
   * one helper that answers `statutory`; and `for (… of grant.resources)` over
   * an absent array would throw before any list was read. **This function is
   * total and never throws** — a grant it cannot read is a grant it refuses.
   */
  const ceilingHours: number | undefined = MAX_GRANT_HOURS[staffGrant.purpose]
  if (typeof ceilingHours !== 'number') return false
  if (!Array.isArray(staffGrant.resources)) return false
  if (!Array.isArray(staffGrant.extensions)) return false

  /**
   * 🛑 THE THREE LISTS, IN ONE HELPER, AT ONE CALL SITE, AND FIRST — G167's
   * surviving content, which G199 carries through its own reversal unchanged:
   * *"the staff arm must test `PERMITTED_RESOURCES`, `CONTRACT_ONLY_RESOURCES`
   * and `NON_DELEGABLE_RESOURCES` — all three, in ONE helper with ONE call
   * site, because `authorisationPermits()` tests the third FIRST, before the
   * withdrawal check, and G75 exists because a third list nobody had named made
   * G60 inert."* **A staff arm consulting two of the three reproduces G60's
   * defect**, and the way to consult all three is not to consult any of them
   * here: it is to call the function that already does, in the order that
   * already survived being got wrong once.
   *
   * ⚠️ `null` IS PASSED FOR THE `SupportAuthorisation`, DELIBERATELY AND IN THE
   * NARROW DIRECTION. G292 was offered *"requiring an active
   * `SupportAuthorisation` alongside"* and DECLINED it — *"a second document is
   * a second thing that can be absent when somebody needs access urgently"* —
   * so this arm reads no contract. Passing `null` is what that decline COSTS
   * the grant rather than what it buys: with no authorisation,
   * `CONTRACT_ONLY_RESOURCES` refuses `authority` outright instead of opening
   * it. **The decline removed a requirement, not a check.**
   *
   * ⚠️ THE GRANT FAILS WHOLE, WHICH IS `evaluateTenantAccess()`'s rule quoted
   * rather than re-decided: *"A grant naming a class the contract does not open
   * fails whole, rather than quietly permitting the classes it does open: the
   * grant is the unit someone approved."* A grant naming `statutory` binds no
   * tenant, and since G2591 carries no capability, even if every other class on
   * it is reachable.
   */
  for (const line of staffGrant.resources) {
    const verdict = authorisationPermits(
      null,
      staffGrant.purpose,
      line.resource,
      staffGrant.staffUserId,
    )
    if (!verdict.permitted) return false
  }

  /**
   * THE PRINCIPAL AND THE TENANT. Both compared, neither assumed — and the
   * tenant comes from the HOST, never from the grant.
   */
  if (staffGrant.staffUserId !== userId) return false
  if (staffGrant.tenantId !== tenantId) return false

  /**
   * G292's THREE LIVENESS TERMS, AND THE OWNER TOOK ALL THREE RATHER THAN
   * LETTING THEM BE INHERITED: *"reusing the membership terms by analogy is a
   * Builder inventing policy."*
   *
   * ⚠️ TERM 2 IS WRITTEN `!(expiresAt > now)` AND NOT `expiresAt <= now`,
   * BECAUSE THE NEGATION IS THE FAIL-CLOSED DIRECTION: against an absent value
   * `undefined <= now` is FALSE and would PERMIT, while `!(undefined > now)` is
   * TRUE and refuses. The membership loop can use the positive form because
   * `Membership.expiresAt` is nullable and its null arm is written out;
   * `TenantAccessGrant.expiresAt` is not, so the only way it can be absent is a
   * malformed row, and a malformed row must lose.
   *
   * 🛑 AND THE MUTATION FOR THAT SENTENCE SURVIVED, WHICH IS RECORDED HERE
   * RATHER THAN QUIETLY ENJOYED. Rewriting this line as `expiresAt <= now` — the
   * fail-open form — leaves the whole suite GREEN, because the ceiling's
   * `Number.isFinite` check below catches the same absent value two lines later:
   * `hoursBetween(grantedAt, undefined)` is `NaN`. **So the negation is
   * redundant TODAY and has no independent witness**, and §8b's mutation block
   * says so by name. It is kept in the negated form deliberately: the ceiling
   * term is newer, is arithmetic rather than a comparison, and is the term a
   * future edit is most likely to move — and when it moves, this line is what
   * stops an absent expiry from being a permit. A redundancy that is named is a
   * defence; one that is assumed is §5.6.
   */
  if (staffGrant.revokedAt !== null) return false
  if (!(staffGrant.expiresAt > now)) return false

  /**
   * 🛑 TERM 3 — THE DURATION CEILING, WHICH IS G292's OWN ADDITION AND THE ONE
   * THE MEMBERSHIP ARM HAS NO NEED OF. The ruling makes it *"a property of the
   * PREDICATE rather than of whoever issues the grant — so a grant cannot be
   * issued, or extended, past it, and the enforcement does not depend on the
   * issuing path being the only path."* There IS no issuing path in this
   * repository; that is precisely why the ceiling had to land here.
   *
   * ⚠️ MEASURED TO THE LATEST EXTENSION, NOT TO `expiresAt`, FOR
   * `evaluateTenantAccess()`'s stated reason: *"so a chain of short extensions
   * cannot arrive where a single long grant would have been refused."* G292
   * says *"issued, or extended"* and this loop is the second half of that
   * sentence.
   *
   * ⚠️ AND THE DATABASE HALF CANNOT WALK EXTENSIONS, WHICH IS NAMED HERE RATHER
   * THAN LEFT TO A FAILING TEST. `db/migrations/0008` ships no extension table,
   * so in the database a grant's `expires_at` IS its effective expiry and the
   * only way to extend one is to UPDATE that column — which the identical
   * `expires_at <= granted_at + ceiling` predicate catches. The two halves
   * therefore agree on every state the database can represent, and the commit
   * that adds an `access_extension` table owes the `greatest(…)` term.
   *
   * ⚠️ `hoursBetween()` RETURNS `NaN` ON ANYTHING UNPARSEABLE and its own
   * declaration requires every caller to treat that as a refusal *"rather than
   * letting a NaN comparison fall through to `false`"* — `NaN > ceiling` is
   * false, so without the finiteness check a grant with a corrupt date would be
   * admitted by the term written to refuse it.
   */
  let effectiveExpiry = staffGrant.expiresAt
  for (const extension of staffGrant.extensions) {
    if (extension.extendedTo > effectiveExpiry) effectiveExpiry = extension.extendedTo
  }
  const heldHours = hoursBetween(staffGrant.grantedAt, effectiveExpiry)
  if (!Number.isFinite(heldHours)) return false
  if (heldHours > ceilingHours) return false

  return true
}

export interface TenantSelectionInput {
  /**
   * The row, read inside `withSessionScope()` by its digest. Only `userId` is
   * consulted.
   *
   * ⚠️ `session.tenantId` IS DELIBERATELY NOT READ, and that is the difference
   * between a check and a rubber stamp. A session already carrying a tenant
   * proves nothing about whether it should: the whole failure B1 describes is
   * a session that carries one it was never entitled to. The decision is made
   * against `hostBoundTenantId` on every call, from the membership rows, every
   * time.
   */
  readonly session: Session
  /**
   * THE TENANT THE HOST IS BOUND TO — G179, reached through
   * `checkHostBinding()` in `model/serving-host.ts`. Platform configuration,
   * which is the one source invariant 1 has always permitted.
   *
   * 🛑 SINGULAR, AND NAMED FOR WHERE IT CAME FROM RATHER THAN FOR WHAT IT DOES.
   * `candidateTenantId` was the first name and it is worse: a *candidate*
   * implies a field of them, and the field is what G210 refused. The name says
   * host so that a call site passing something else reads wrong.
   */
  readonly hostBoundTenantId: TenantId
  /**
   * The principal's membership rows, read under the scope the host bound.
   *
   * A HAYSTACK, NOT A MENU — see the header. Rows for other users and other
   * tenants are permitted to be in here and are simply not matched; the
   * function does not trust the caller to have filtered, because a check that
   * depends on its caller having already checked is not a check.
   */
  readonly memberships: readonly Membership[]
  /**
   * ⚠️ SUPPLIED RATHER THAN READ FROM A CLOCK, for `PrincipalContext.now`'s
   * reason: a decision has to be reproducible in an audit. The database's half
   * of this check uses `now()` instead, because a policy expression has no
   * parameter to take — see the header.
   */
  readonly now: Timestamp
  /**
   * THE ONE `TenantAccessGrant` OFFERED FOR THIS PRINCIPAL AND THIS HOST —
   * **S-21, 19 Sep 2026, and G199 names this field, this type and this shape.**
   *
   * 🛑 SINGULAR, FOR `hostBoundTenantId`'s REASON AND NOT A WEAKER ONE. A
   * `readonly TenantAccessGrant[]` would be a menu, and a menu of grants is the
   * selector G210 dropped wearing staff clothing — the caller would be choosing
   * which authority to present, and the choice would be made outside anything
   * that checks it. One grant, one host, one answer.
   *
   * ⚠️ IT IS OPTIONAL, AND THAT IS A FENCE RATHER THAN A DESIGN — SAY SO LOUDLY,
   * BECAUSE AN OPTIONAL SECURITY TERM IS A WEAKER FENCE THAN A REQUIRED ONE.
   * This is `PrincipalContext.platformHeld`'s note, applying for the second time
   * on the same day and behind the same fence: a required field would make every
   * construction site declare its answer, which is strictly better; the only
   * construction site outside `tests/` is `server/data-plane/context.ts` and
   * this slice was fenced out of `server/`. **Making it required is owed.**
   *
   * 🛑 WHAT MAKES THE INTERIM SAFE IS THE DIRECTION OF THE DEFAULT, NOT THE
   * FENCE. An omitted term is `undefined`, `undefined` is read as `null`, and
   * `null` is *no grant was offered* — which reaches the refusal below and never
   * the permit. **There is no value of this field, its absence included, that
   * permits anything the membership arm would have refused.** A caller who
   * forgets it loses the staff arm; a caller can never gain one by forgetting.
   *
   * ⚠️ AND IT IS NOT A SECOND TENANT TERM. The tenant is still
   * `hostBoundTenantId` and only that: `grant.tenantId` is COMPARED against it
   * and is never read as the answer, which is `grantAllows()`'s own correction
   * of 5 Aug 2026 — *"it previously took the grant and never compared
   * `grant.tenantId` to anything, so a grant for tenant A validated an operation
   * against tenant B."* A grant that arrived from a request body and named its
   * own tenant would be invariant 1 relocated into this field.
   *
   * ⚠️ TYPED `StaffGrantTerms` SINCE G729 AND IT WAS `TenantAccessGrant`. See
   * that declaration: it is a WIDENING — a whole grant is still assignable —
   * taken because `db/migrations/0008` stores eight of the interface's
   * nineteen fields and a reader would otherwise have to fabricate eleven.
   */
  readonly staffGrant?: StaffGrantTerms | null
}

export type TenantSelection =
  | { readonly ok: true; readonly tenantId: TenantId }
  | { readonly ok: false; readonly refusal: TenantSelectionRefusal }

export type _TenantSelectionRefusalsAreExhaustive = AssertTrue<
  Exclude<TenantSelection, { ok: true }>['refusal'] extends TenantSelectionRefusal
    ? TenantSelectionRefusal extends Exclude<TenantSelection, { ok: true }>['refusal']
      ? true
      : false
    : false
>

/**
 * WHAT `holdsLiveMembership()` MAY BE HANDED — G641, 19 Sep 2026.
 *
 * ⚠️ IT TAKES A `UserId` AND NOT A `Session`, AND THAT IS THE ONE DIFFERENCE
 * FROM `TenantSelectionInput` WORTH A LINE. `selectTenantForSession()` holds a
 * session row and reads `session.userId` off it; the per-request caller holds a
 * `ResolvedSubject`, which is what `resolveSubject()` returned and is the only
 * thing on that path entitled to name a person. Taking the narrower of the two
 * means neither caller has to manufacture the other's shape, and it means this
 * function cannot be handed a session and quietly read a second field off it.
 */
export interface LiveMembershipInput {
  /**
   * A HAYSTACK, NOT A MENU — `TenantSelectionInput.memberships`' own words, and
   * they are why the matching terms live in here with the liveness terms rather
   * than beside them. Rows for other users and other tenants are permitted and
   * are simply not matched; a function that trusted its caller to have filtered
   * would be a check that depends on its caller having already checked.
   */
  readonly memberships: readonly Membership[]
  readonly userId: UserId
  /**
   * THE TENANT THE ANSWER IS ABOUT. At binding it is the HOST's, under G179; on
   * the per-request path it is `ResolvedSubject.tenantId`, which is the value
   * `resolveSubject()` returned off a session the host binding was re-checked
   * against on the same request. **Neither is a value a caller supplied.**
   */
  readonly tenantId: TenantId
  /** SUPPLIED, for `PrincipalContext.now`'s reason. See the function. */
  readonly now: Timestamp
}

/**
 * DOES THIS PERSON HOLD A LIVE MEMBERSHIP IN THIS TENANT — THE ONE PLACE THE
 * QUESTION IS ANSWERED. G641, 19 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS FUNCTION EXISTS BECAUSE OF THE PARAGRAPH ON `selectTenantForSession()`
 *    THAT REFUSES TO CHECK SESSION LIVENESS, READ IN REVERSE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * That paragraph says: *"`resolveSubject()` above owns revocation, expiry, the
 * user's status and the door's status, in an order its own header defends. A
 * second copy here would be §5.3 — two implementations of one order — and the
 * one that drifts is always the copy."*
 *
 * **G641 puts a membership check on the other side of that seam, and the
 * identical objection applies in the identical direction.** It is answered the
 * only way it can honestly be answered: the four terms are written ONCE, here,
 * and both callers reach them. `selectTenantForSession()` no longer states them
 * — it calls this — and `server/data-plane/session.ts`'s per-request path calls
 * the same function with the same clock discipline. **There is no copy to
 * drift**, and `tests/model/membership-liveness.test.ts` §4 asserts the absence
 * by reading `selectTenantForSession()`'s own bytes for `revokedAt`.
 *
 * ⚠️ AND IT MAY NOT BECOME A REFUSAL-RETURNING FUNCTION. It answers `boolean`
 * because the two callers owe the caller different words: at binding the answer
 * is `membership_absent`, a `TenantSelectionRefusal` on D1's wire; per request
 * the answer is a 401 with no reason at all, because the request already
 * carried a live-looking credential and naming the term would tell the holder
 * of a stolen handle exactly what changed and roughly when. **A shared refusal
 * value would force one of those two to be wrong** — and the oracle argument on
 * `TENANT_SELECTION_REFUSALS.membershipAbsent` is about precisely this
 * disclosure.
 *
 * ⚠️ THE FOUR TERMS ARE THE MEMBERSHIP'S OWN AND ARE NOT INVENTED HERE.
 * `revokedAt` is *"retained rather than deleted, so a transfer between partners
 * is auditable"* — a revoked row is still a row, so an `EXISTS` on `(userId,
 * tenantId)` alone would re-grant every membership anyone ever lost. `expiresAt`
 * is *"Partner-scoped memberships must expire. Null only for direct staff"*, so
 * NULL means *does not expire* and is not an absence to refuse on.
 *
 * 🛑 THE SAME FIVE TOKENS ARE STATED SEVEN TIMES IN SQL AND
 * `db/migrations/0035_membership_liveness_voids_sessions.sql` SAYS SO ON ITS
 * OWN FACE — *"the liveness expression below IS a copy … Defect 1 is what that
 * drift looks like when it happens"*, one of the copies having been written
 * with one term missing. **This function does not add an eighth.** It removes
 * the TypeScript side's opportunity to become a second: the count of
 * TypeScript statements of the predicate goes from one to one, not one to two,
 * which is the whole of what G641 was allowed to do to it.
 *
 * ⚠️ `expiresAt <= now` IS A LEXICAL STRING COMPARISON, matching `decide()`,
 * `redeemAuthorization()`, `resolveSubject()` and — until this commit —
 * `selectTenantForSession()`, which is where these four lines came from. It is
 * correct for ISO-8601 in UTC with a fixed number of fractional digits and
 * silently wrong for anything else. **The timestamp codec G111's shape calls
 * for is not started**; this uses the comparison every other clock in `model/`
 * already uses, so there is one thing to fix rather than two.
 *
 * Total. Never throws. Reads no clock, no database and no tenant row.
 */
export function holdsLiveMembership(input: LiveMembershipInput): boolean {
  const { memberships, userId, tenantId, now } = input

  for (const m of memberships) {
    if (m.userId !== userId) continue
    if (m.tenantId !== tenantId) continue
    if (m.revokedAt !== null) continue
    if (m.expiresAt !== null && m.expiresAt <= now) continue
    return true
  }

  return false
}

/**
 * Total. Never throws. Reads no clock, no database and no tenant row.
 *
 * ⚠️ **THIS LINE ENDED *"and no `TenantAccessGrant`"* UNTIL 19 Sep 2026 AND IT
 * IS CORRECTED RATHER THAN DELETED**, because it is the one-line summary a
 * reader takes away and it was the declared shape of G199's cost. **It reads
 * one now** — `input.staffGrant`, handed in, never fetched. The three clauses
 * that survive are the ones that matter and none of them moved: no clock (`now`
 * is a parameter), no database (nothing here queries), no tenant row (B2's
 * finding — the scope that would make one readable is what this call
 * authorises).
 *
 * ⚠️ THE LIVENESS TERMS ARE THE MEMBERSHIP'S OWN AND ARE NOT INVENTED HERE.
 * `revokedAt` is *"retained rather than deleted, so a transfer between
 * partners is auditable"* — a revoked row is still a row, so an `EXISTS` on
 * `(userId, tenantId)` alone would re-grant every membership anyone ever lost.
 * `expiresAt` is *"Partner-scoped memberships must expire. Null only for
 * direct staff"*, so NULL means *does not expire* and is not an absence to
 * refuse on. **`docs/build/stateless-red-session.md` B1 writes the control
 * with `revoked_at IS NULL` and stops there; the `expiresAt` term is added in
 * both halves of this slice, in the safe direction, and is named as a
 * divergence rather than slipped in.**
 *
 * ⚠️ `expiresAt <= now` IS A LEXICAL STRING COMPARISON, matching `decide()`,
 * `redeemAuthorization()` and `resolveSubject()` exactly. Correct for ISO-8601
 * in UTC with a fixed number of fractional digits and silently wrong for
 * anything else. **The timestamp codec G111's shape calls for is not started**
 * and `model/session.ts` says so on itself; this uses the comparison every
 * other clock in `model/` already uses, so there is one thing to fix rather
 * than two.
 *
 * ⚠️ IT DOES NOT CHECK SESSION LIVENESS, AND THE ABSENCE IS THE SEAM RATHER
 * THAN AN OVERSIGHT. `resolveSubject()` above owns revocation, expiry, the
 * user's status and the door's status, in an order its own header defends. A
 * second copy here would be §5.3 — two implementations of one order — and the
 * one that drifts is always the copy.
 *
 * ⚠️ THE MEMBERSHIP ARM'S FOUR TERMS ARE NO LONGER WRITTEN HERE — G641,
 * 19 Sep 2026. They are `holdsLiveMembership()` below, because the per-request
 * path needs the same question answered and the paragraph above is the reason:
 * the objection it makes about session liveness applies in reverse to
 * membership liveness, and the answer to it is ONE implementation rather than a
 * second copy on the other side of the seam.
 */
export function selectTenantForSession(input: TenantSelectionInput): TenantSelection {
  const { session, hostBoundTenantId, memberships, now } = input

  if (
    holdsLiveMembership({
      memberships,
      userId: session.userId,
      tenantId: hostBoundTenantId,
      now,
    })
  ) {
    return { ok: true, tenantId: hostBoundTenantId }
  }

  /* ================================================================== *
   * THE STAFF ARM — S-21, G199's shape and G292's terms.
   *
   * 🛑 ONE ARM, INLINE, AND THE INLINING IS G289's PRECEDENT FROM THE SAME
   *    WEEK RATHER THAN A STYLE CHOICE: *"the arm is INLINE in `decide()`
   *    rather than a helper, because a private helper is the two-halves split
   *    wearing a smaller name."* What IS a helper is the three-list check, and
   *    it is the helper governance already owns.
   *
   * ⚠️ SECOND, NEVER FIRST, AND THE ORDER IS OBSERVABLE RATHER THAN
   *    COSMETIC. A customer with a live membership never reaches this arm, so
   *    no ordinary sign-in can be refused by a staff term, and a person who
   *    happens to hold both binds the tenant on the membership — the weaker
   *    authority, which is the one that leaves no grant marked as used.
   * ================================================================== */

  const staffGrant = input.staffGrant ?? null
  if (staffGrant === null) {
    return { ok: false, refusal: TENANT_SELECTION_REFUSALS.membershipAbsent }
  }

  /**
   * ⚠️ ONE REFUSAL VALUE, BOUND ONCE, AND EVERY EXIT BELOW RETURNS IT. Six
   * distinct facts collapse into one name for the oracle reason stated on the
   * declaration; binding it here rather than repeating the literal is what
   * keeps a later editor from "helpfully" distinguishing one of them.
   */
  const grantRefused: TenantSelection = {
    ok: false,
    refusal: TENANT_SELECTION_REFUSALS.accessGrantAbsent,
  }

  /**
   * 🛑 THE ELEVEN CONDITIONS — structural readability, the three lists through
   * `authorisationPermits()`, the principal and the HOST-bound tenant, and
   * G292's three liveness terms — ARE `holdsLiveStaffGrant()`'s SINCE G2591,
   * 1 Oct 2026. They were inline here, and G2407's branch in `decide()` asks
   * the identical question on every gated operation, so they MOVED rather
   * than being copied (§5.3; G641's `holdsLiveMembership()` precedent). Every
   * argument that stood here moved with its line. **The order is unchanged.**
   */
  if (
    !holdsLiveStaffGrant({
      grant: staffGrant,
      userId: session.userId,
      tenantId: hostBoundTenantId,
      now,
    })
  ) {
    return grantRefused
  }

  /**
   * ✅ INVARIANT 8's PERMITTED PATH, REACHED. *"Being staff is not access.
   * Reaching a tenant requires a `TenantAccessGrant`"* — this is the line where
   * one is required and one was produced.
   *
   * 🛑 AND IT IS A SELECTION, NEVER A USE. Binding a tenant to a session is not
   * reaching a resource: `evaluateTenantAccess()` still runs where a class is
   * actually touched, and it enforces five terms this arm deliberately does not
   * — customer notification, the two-person rule, idle lapse, the engagement
   * reference, and the tenant's own `supportAccessMode`. **Every one of those
   * needs a parameter this input type refuses to carry** (a `Tenant` row, an
   * idle count), which is B2's finding rather than an omission: the tenant scope
   * that would make the row readable is the very thing this call authorises.
   * **Do not move those checks here, and do not read this permit as one.**
   */
  return { ok: true, tenantId: hostBoundTenantId }
}
