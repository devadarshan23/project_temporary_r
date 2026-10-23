/**
 * THE DATA PLANE, STARTED.
 *
 * `tests/http/harness.ts` pins this module's path and its signature:
 *
 *     startDataPlane(o: { poolMax: number }): Promise<{ url, close }>
 *
 * It binds an EPHEMERAL port so two planes can run in one test process — which
 * assertion 5 needs, because it keeps a plane started WITH the local flag alive
 * while starting a second one WITHOUT it and requires them to disagree.
 *
 * ┌─ TWO TIERS, ONE LISTENER, AND THE DEVIATION IS STATED HERE ────────────────┐
 * │ `capability.openapi.yaml` serves at `/v1`; `data-plane-local.openapi.yaml`  │
 * │ declares `http://localhost:9090` — a SEPARATE bind address, so that a       │
 * │ customer's ALB can reach liveness without the capability API being on the   │
 * │ same socket. Phase one puts both on one listener, because the harness takes │
 * │ ONE url and a second port would be a second thing to plumb before anything  │
 * │ is proven. It is a deviation from the document and it is recorded rather    │
 * │ than absorbed: splitting it is a later commit, and nothing here depends on  │
 * │ them sharing a socket.                                                      │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE POOL CONNECTS AS `reconcile_app` — NOBYPASSRLS, OWNS NOTHING. That is
 * `createAppPool()`'s doing, not this file's, and it is what makes the whole
 * slice mean anything: a plane connected as the owner or the migrator would pass
 * every isolation assertion in `tests/http/` with the policies doing nothing at
 * all. `db/migrations/0001_tenancy_and_rls.sql` explains why `FORCE` is what
 * makes even the owner subject to the policy.
 */

import type { FastifyInstance } from 'fastify'

import { createAppPool, type TenantPool } from '../../db/tenant-scope.ts'
/**
 * ⚠️ FROM `db/` AND NEVER FROM `server/control-plane/`, AND THE DIRECTION IS A
 * CONTROL RATHER THAN A CONVENIENCE. `tests/http/console-roster-unreachable.test.ts`
 * §1b refuses any `server/data-plane/**` module that imports from the other
 * plane — *"the two planes share `server/http/`, `server/contract/` and `db/`,
 * and nothing else"* — and that assertion is UNCHANGED by this slice. G1161's
 * pool lives in the layer both planes may reach for exactly that reason.
 */
import type { ServingHost } from '../../model/serving-host.ts'
import {
  buildPlane,
  servedPublicly,
  servedWithoutAGate,
  type CapabilityAuthoriser,
  type Handler,
  type TierMount,
} from '../http/app.ts'
import {
  UNAUTHORISED_DETAIL,
  sessionCapabilities,
  substrateFromSession,
  type PrincipalSubstrate,
} from './authorise.ts'
import { authorisedHandler } from './authorisation-record.ts'
import { listTenantsOperation } from './console-roster.ts'
import {
  completeOnboardingStepOperation,
  forceOnboardingStepOperation,
  listOnboardingStepsOperation,
} from './onboarding.ts'
import {
  getSandboxTenantOperation,
  listDealRegistrationsOperation,
  listPartnerPeopleOperation,
  invitePartnerPersonOperation,
  requestSandboxTenantOperation,
  submitDealRegistrationOperation,
} from './partner-portal.ts'
import { resolveTenantContextHandler } from './context.ts'
import {
  getMessageOperation,
  getThreadOperation,
  listThreadsOperation,
} from './correspondence.ts'
import {
  assignExceptionOperation,
  getExceptionFacetsOperation,
  getExceptionOperation,
  listExceptionsOperation,
  reverseResolutionOperation,
} from './exceptions.ts'
import { listIntakeChannelsOperation } from './intake.ts'
import {
  decideApprovalOperation,
  executeProposalOperation,
  getProposalOperation,
  listAvailableDispositionsOperation,
  listProposalsOperation,
  proposeResolutionOperation,
} from './proposals.ts'
import { resolveHomeRealmHandler } from './realm.ts'
import { completeFederatedSignInHandler } from './federated-signin.ts'
import { beginFederatedSignInHandler } from './signin-begin.ts'
import { relayBrokerReturnHandler } from './signin-return.ts'
import { signOutHandler } from './sign-out.ts'
import { getSessionPrincipalHandler } from './session-principal.ts'
import { resolveControlPlaneClient, type ControlPlaneClient } from './control-plane-client.ts'
import { scheduleTenantNameSync } from './tenant-name-sync.ts'
import { tokenEndpointTransport } from './code-exchange.ts'
import type { VerificationTermsSource } from './verification-terms.ts'
import { getDispositionMixOperation } from './reports.ts'
import { grantRoleAssignmentOperation } from './role-grants.ts'
import { bindEndpointCredentialOperation } from './credential-binding.ts'
import {
  getParkedArrivalOperation,
  listParkedArrivalsOperation,
  raiseParkedArrivalOperation,
} from './parked.ts'
import {
  declareEndpointDocumentTypeOperation,
  declareEndpointOperation,
  listEndpointsOperation,
  resumeEndpointOperation,
  stopEndpointOperation,
} from './sources.ts'
import { listDocumentTypesOperation } from './document-types.ts'
import {
  resolveCredentialCustody,
  unconfiguredCredentialCustody,
  type CredentialCustody,
} from './credential-store.ts'
import { admitRunOperation } from './run-admission.ts'
import {
  resolveRunQueuePublisher,
  unconfiguredRunQueue,
  type RunQueuePublisher,
} from './run-queue.ts'
import {
  getRunAccountOperation,
  listRunAllocationsOperation,
  listRunResidueOperation,
} from './run-account.ts'
import { getRunOperation, listRunsOperation } from './runs.ts'
import { consoleHostRegistry, servingHostRegistry, signInReturnHostFromEnv } from './serving-hosts.ts'
import {
  UNAUTHENTICATED_DETAIL,
  resolveSessionReader,
  type HostRegistries,
  type SessionReader,
  type TenantSession,
} from './session.ts'

export interface RunningDataPlane {
  readonly url: string
  close(): Promise<void>
}

/**
 * The liveness probe, and the ONLY operation of the local tier this slice
 * serves.
 *
 * ⚠️ `/status` AND `/metrics` ARE DELIBERATELY NOT REGISTERED, and the reason is
 * not effort. `/status` is specified as a DEEP check — "connectivity to required
 * BYOA infrastructure (RDS, S3, KMS)" — and there is no S3 and no KMS on this
 * path, so any answer it gave about them would be invented. Worse, its database
 * half would need a query, and every query in this plane runs inside
 * `withTenantScope()`, which needs a tenant a liveness probe does not have.
 * `/metrics` would have to publish "the same internal operational counters that
 * the plane aggregates" and the plane aggregates none. Both are absent rather
 * than answered with a plausible constant.
 *
 * `/health` is exactly what its own description says it is: "Returns 200 OK if
 * the application is running and able to serve traffic. Does not check
 * downstream dependencies."
 */
const checkLocalHealth: Handler = async () => ({ status: 'ok' })

/**
 * ⚠️ THREE TIERS NOW, AND THE THIRD IS THE ONE TO READ BEFORE ASSUMING G200
 * MOVED. `foundation` mounts exactly ONE operation — `resolveTenantContext`,
 * D1 — and `server/data-plane/context.ts` opens with why that is lawful under
 * the mounting freeze: the tier requires no capability
 * (⚠️ **this cited `TIER_REQUIRES_CAPABILITY.foundation === false` until
 * G911 retired that table on 20 Sep 2026; the verdict is the OPERATION'S
 * now, and it is the same verdict**), and the operation carries
 * a stated exemption whose reason is circularity — *"this operation MINTS the
 * session a capability check would later be built from."*
 *
 * 🛑 NOTHING IS ADDED TO THE CAPABILITY TIER. `listRuns` and `getRun` are the
 * same two operations this file mounted before, and they are still gated.
 * **A foundation-tier exemption is not a widening of the freeze.** If a
 * capability-tier operation belongs here, that is a ruling and not a commit.
 *
 * ✅ **THE RULING CAME — G300, 19 Sep 2026 — AND THE PARAGRAPH ABOVE IS
 * CORRECTED RATHER THAN DELETED, because its last sentence is exactly what
 * happened and is the reason this file may now mount two more.** The capability
 * tier carries FOUR operations: `listRuns`, `getRun`, and — under G300 and
 * G301 together — `getRunAccount` and `listRunResidue`.
 * **`server/data-plane/run-account.ts` derives the three-part test for each.**
 * Nothing about the sentence *"a foundation-tier exemption is not a widening of
 * the freeze"* has moved; what moved is that the freeze was lifted, ON MERIT
 * and PER OPERATION, by the owner.
 *
 * ⚠️ THE SENTENCE THAT FOLLOWED — *"against the production authoriser they
 * still answer 403 to every caller"* — WENT FALSE ON 19 Sep 2026 AND IS
 * CORRECTED RATHER THAN DELETED, because it is the sentence G296's freeze was
 * argued on: *"Mounting anything now ships a route nobody can reach."* **These
 * two now answer 200 to a caller whose session resolves a subject holding
 * `admit_source`** — G299, `db/migrations/0009_identity_substrate.sql`.
 *
 * 🛑 AND THAT DOES NOT LIFT THE FREEZE, WHICH IS A RULING AND NOT A CONSEQUENCE.
 * G296's condition reads *"the freeze lifts when the authoriser can say YES to
 * somebody, which means an identity substrate — `user`, `identity_connection`,
 * `role_assignment` — not merely the mechanism."* The condition is now MET; the
 * lifting is the owner's, and **this commit mounts nothing new.** Derive the
 * served set rather than reading it: `node tools/served-set.mjs` → **30 of
 * 136**, broken down by tier.
 *
 * 🛑 **A RECURSIVE GREP FOR THE HANDLER KEY STOOD HERE UNTIL 23 Sep 2026 AND
 * IT WAS WRONG TWICE OVER, AND ONLY THE FIRST HALF IS THE FAMOUS ONE.**
 *
 * · **IT COUNTED THIS COMMENT.** The quotation had to drop the command's
 *   middle glob — a star followed by a slash ends a block comment, and this
 *   file was once briefly unparseable for exactly that reason — and dropping
 *   it is precisely what left the quotation inside the command's own scope. It
 *   answered EIGHT where the tree held seven. G978's shape, third instance.
 *
 * · **AND SEVEN WAS NEVER THE NUMBER ANYBODY WANTED.** The handler key occurs
 *   once per TIER MOUNT, not once per operation, so **no reading of that
 *   command could ever have reached 30.** The figures it produced across four
 *   documents — 23, 25, 26, 29 — were arrived at by reading the blocks and
 *   counting keys by eye, which is why no two of them agreed.
 *
 * `tools/served-set.mjs` parses the contract tiers for the denominator, strips
 * comments before it reads these two files, and understands ES6 shorthand —
 * `handlers: { checkLocalHealth }` carries no colon at all, and a key-and-colon
 * scan silently loses it. `tools/check-self-measuring-derivations.mjs` is the
 * gate that keeps the first half from recurring.
 * *Corrected 23 Sep 2026 — G2081/G2083.*
 *
 * ⚠️ THE OTHER SIXTEEN FOUNDATION OPERATIONS ARE DECLARED AND NOT MOUNTED, and
 * `server/contract/routes.ts` states what that means: *"an operation declared
 * with no handler is simply not registered, and its path 404s."* The direction
 * that is fenced is the other one — a handler for an operation the document
 * does not declare is a boot failure.
 */
function mounts(
  pool: TenantPool,
  controlPlane: ControlPlaneClient,
  registry: readonly ServingHost[],
  /**
   * BOTH registries, for the sign-in callback alone — S6. It mints on the host
   * it arrived at, and that host may be a console (G726), so the tenant
   * registry by itself would refuse a staff sign-in as `tenant_context_missing`.
   */
  registries: HostRegistries,
  /** R2's boot-time key document, or `null`. The callback answers 503 without one. */
  identityTerms: VerificationTermsSource | null,
  substrateFor: (session: TenantSession) => PrincipalSubstrate,
  /**
   * 🛑 THE RUN QUEUE'S PUBLISH HALF, CHOSEN ONCE AT BOOT — R-B, 20 Sep 2026.
   * It is threaded rather than imported here for the same reason `authorise`
   * and `substrateFor` are: a module that NAMES its transport is a module one
   * edit away from constructing one, and the two entry points below decide
   * which it gets. `listenDataPlane()` takes no option at all and so takes
   * `resolveRunQueuePublisher()`; `startDataPlane()` admits one, on the
   * ephemeral-port path alone, so a suite can WITNESS the message rather than
   * asserting that a queue was probably reached.
   */
  publishRun: RunQueuePublisher,
  /**
   * 🛑 THE CREDENTIAL STORE, CHOSEN ONCE AT BOOT — G2401, 1 Oct 2026, the run
   * queue's shape exactly and for its reasons: threaded rather than imported,
   * so no serving module NAMES a transport, and admitted as an option only on
   * the ephemeral-port path so a suite can WITNESS the write.
   */
  custody: CredentialCustody,
  /**
   * THE GATE'S OWN AUTHORISER — G3521, 3 Oct 2026. Threaded so that
   * `getSessionPrincipal` can report what this session may do by asking the
   * SAME function the `preValidation` gate asks, once per capability, rather
   * than by a second evaluation of its own. A test that hands the plane a
   * fixture authoriser therefore sees its own verdicts reported back.
   */
  authorise: CapabilityAuthoriser<TenantSession>,
): readonly TierMount[] {
  return [
    {
      /**
       * 🛑 BOTH CAPABILITY-TIER ENTRIES GO THROUGH `authorisedHandler()`, AND
       * THAT IS NOT A STYLE — IT IS THE ONLY WAY THIS TIER CAN BE MOUNTED AT
       * ALL. G301, 19 Sep 2026: `mountTier()`'s SIXTH FENCE refuses to boot a
       * gated operation whose entry is a bare handler. Replace either of these
       * with a plain function and the plane does not start, with the operation
       * named in the message.
       *
       * ⚠️ THIS READ *"AND THE SAME FENCE IS WHY THIS FILE STILL MOUNTS
       * EXACTLY THE SAME TWO OPERATIONS … this commit exercises the fence with
       * the two that were already here and mounts nothing new"*, AND IT IS
       * CORRECTED RATHER THAN DELETED, because the sentence AROUND it is the
       * one that predicted this commit and is now discharged: **"the next
       * operation mounted arrives already recording, because it cannot arrive
       * any other way."** Two arrived, and both did.
       *
       * 🛑 FOUR ENTRIES, AND EVERY ONE OF THEM GOES THROUGH
       * `authorisedHandler()` — not as a style, but because the sixth fence
       * refuses to boot a gated operation whose entry is a bare handler.
       * Replace any of these with a plain function and the plane does not
       * start, with the operation named in the message;
       * `tests/http/run-account-served.test.ts` §6 asserts exactly that for
       * the two this commit adds, over `buildPlane()` and with no database.
       */
      tier: 'capability',
      handlers: {
        listRuns: authorisedHandler(pool, substrateFor, listRunsOperation),
        getRun: authorisedHandler(pool, substrateFor, getRunOperation),
        /**
         * 🛑 G300, 19 Sep 2026 — MOUNTED ON MERIT AND PER OPERATION. The
         * freeze lifts *"for any operation whose TABLE, MODEL and CAPABILITY
         * are all real"*, and `server/data-plane/run-account.ts` derives all
         * three with the commands rather than asserting readiness — which is
         * the ruling's own instruction, taken because *"a table alone is the
         * trap."*
         *
         * ⚠️ AND NOTHING ELSE MAY FOLLOW THEM ON THAT GROUND. Roughly a
         * hundred declared operations still have no table, and G300 keeps the
         * router's honest 404 for every one of them: *"a 403 indistinguishable
         * from an unbuilt feature is worse than an honest 404 from the
         * router."*
         */
        getRunAccount: authorisedHandler(pool, substrateFor, getRunAccountOperation),
        listRunResidue: authorisedHandler(pool, substrateFor, listRunResidueOperation),
        /**
         * 🛑 R13, THE OWNER'S — G2374, 1 Oct 2026. What matched with what, as
         * ids and amounts. G300's three parts, derived: the TABLE is
         * `db/migrations/0260_run_allocation.sql`; the MODEL is `Allocation`
         * (`grep -n 'export interface Allocation' model/reconciliation.ts`);
         * the CAPABILITY is `admit_source`, `getRunAccount`'s own. Minted
         * through `authorisedHandler`, so invariant 10's record is written
         * before the read.
         */
        listRunAllocations: authorisedHandler(pool, substrateFor, listRunAllocationsOperation),
        /**
         * 🛑 G318's SECOND WAVE — THE OPERATOR SURFACE. C3 · Triage the
         * register and C4 · Resolve an exception, which
         * `docs/build/deploy-handoff.md` §5a calls *"the product's actual
         * operator surface"*. `server/data-plane/exceptions.ts` derives
         * G300's three parts per operation with the commands, and
         * `db/migrations/0015_exception_register.sql` is the TABLE half —
         * which did not exist before this wave.
         *
         * ⚠️ `assignException` IS THE FIRST **WRITE** MOUNTED ON THIS PLANE,
         * and its privilege is COLUMN-LEVEL: `GRANT UPDATE (assigned_to)`,
         * G358. The four reads before it could not have amended a row at any
         * price; this one can amend exactly one column, and the DATABASE is
         * what refuses every other.
         *
         * ✅ AND THE FIFTH C6 OPERATION IS HERE SINCE 20 Sep 2026 —
         * `reverseResolution`, G946–G950. ⚠️ THE REFUSAL THAT STOOD HERE IS
         * CORRECTED RATHER THAN DELETED, because it is the sentence this
         * file, `exceptions.ts`, `proposals.ts`, `0015` and two test suites
         * all carried: *"🛑 THE FIFTH C6 OPERATION — `reverseResolution` — IS
         * NOT HERE, AND IT PASSES G300's THREE-PART TEST. It is refused on
         * G300's own argument instead: nothing in this repository can produce
         * a resolution, so its only reachable answer is its 409 … G359."*
         *
         * **Both of its obstacles are gone and they went in different
         * commits.** G658's `executeProposal` made a resolution producible —
         * so the 409 stopped being the only reachable answer — and
         * `db/migrations/0140_reversal_write_and_mix_pins.sql` §1 grants the
         * `INSERT` that `tenant.exception_reversal` had never had, in the same
         * commit as `server/data-plane/reversal-store.ts`, which is G511's
         * *"the fence and the writer are one commit or neither."*
         * `exceptions.ts` derives G300's three parts for it.
         */
        listExceptions: authorisedHandler(pool, substrateFor, listExceptionsOperation),
        getExceptionFacets: authorisedHandler(pool, substrateFor, getExceptionFacetsOperation),
        getException: authorisedHandler(pool, substrateFor, getExceptionOperation),
        assignException: authorisedHandler(pool, substrateFor, assignExceptionOperation),
        reverseResolution: authorisedHandler(pool, substrateFor, reverseResolutionOperation),
        /**
         * 🛑 C4's OTHER HALF — G656–G660, 19 Sep 2026. The wave above mounted
         * the register's read plus its one reachable act and said plainly what
         * it left: *"C4 is half of C4. Accept/Reject/Park/Attach are all
         * `proposeResolution` → `decideApproval` → `executeProposal`, and
         * THERE IS NO `proposal` TABLE."*
         * `db/migrations/0059_resolution_chain.sql` is the TABLE half — six
         * tables, one added column and one trigger — and
         * `server/data-plane/proposals.ts` derives G300's three parts PER
         * OPERATION with the commands.
         *
         * 🛑 FOUR DISTINCT CAPABILITIES ACROSS SIX OPERATIONS, AND THE
         * SPREAD IS THE DESIGN RATHER THAN AN ACCIDENT OF ANNOTATION:
         * `view_exception` on the three reads, then `propose_resolution`,
         * `approve_resolution` and `execute_resolution` on the three acts.
         * A viewer reads and proposes nothing; an operator proposes and — if
         * `approve_resolution` is not theirs — approves nothing; a partner
         * under the strongest operating scope reaches `propose_resolution`
         * and is refused the other two by `PARTNER_CAPABILITY_MASK`, because
         * *"a partner may operate on a customer's exceptions and may never be
         * the approving authority for them."*
         *
         * ⚠️ THE FOUR-EYES RULE IS **NOT** ONE OF THOSE CAPABILITIES AND
         * COULD NOT BE. `Annotation` carries ONE SCALAR CAPABILITY PER
         * OPERATION and `decide(principal, capability)` takes ONE PRINCIPAL
         * AND NO RESOURCE STATE; quorum counts distinct PEOPLE and
         * segregation compares TWO actors of TWO acts. It lives in
         * `model/approval.ts` — the one evaluator, asked strictly AFTER
         * `decide()` has allowed the verb — and again as a RESTRICTIVE policy
         * on `tenant.approval_decision`. **Neither is a second `decide()`:
         * neither answers "may X", and both answer "is this proposal ready".**
         *
         * ✅ AND `reverseResolution` IS MOUNTED SINCE 20 Sep 2026 — see the
         * capability-tier block above. ⚠️ THE SENTENCE THAT STOOD HERE IS
         * CORRECTED RATHER THAN DELETED: *"🛑 `reverseResolution` IS STILL NOT
         * MOUNTED AND ONE OF ITS TWO OBSTACLES IS NOW CLOSED. G359 named only
         * the first — 'nothing can produce a resolution' — and
         * `executeProposal` closes it. The second is the privileges:
         * `tenant.exception_reversal` still takes `GRANT SELECT` alone, so
         * mounting it today would answer 500, not 409."* **It was right about
         * both, and the 500 was witnessed before the grant was taken.**
         */
        listAvailableDispositions: authorisedHandler(
          pool,
          substrateFor,
          listAvailableDispositionsOperation,
        ),
        listProposals: authorisedHandler(pool, substrateFor, listProposalsOperation),
        proposeResolution: authorisedHandler(pool, substrateFor, proposeResolutionOperation),
        getProposal: authorisedHandler(pool, substrateFor, getProposalOperation),
        decideApproval: authorisedHandler(pool, substrateFor, decideApprovalOperation),
        executeProposal: authorisedHandler(pool, substrateFor, executeProposalOperation),
        /**
         * 🛑 G318's THIRD WAVE — CORRESPONDENCE. The pack's C6 · Ask a
         * question, which the contract tags C9. G318 sequences *"INGESTION,
         * EXCEPTIONS, CORRESPONDENCE, AND ONLY THEN THE PARTNER PORTAL AND
         * THE STAFF CONSOLE"*, and the first two have landed.
         * `server/data-plane/correspondence.ts` derives G300's three parts
         * per operation with the commands, and
         * `db/migrations/0022_correspondence.sql` is the TABLE half — four
         * tables that did not exist before this wave.
         *
         * 🛑 THREE OF SEVEN, AND THE FOUR THAT ARE ABSENT ARE ALL OF THE
         * WRITES — `openThread`, `checkOutboundDisclosure`,
         * `sendOutboundMessage` and `decideAdmission`. Each is refused BY
         * NAME at the foot of `correspondence.ts`, on a DIFFERENT missing
         * table in three of the four cases. The common one is
         * `CorrespondenceConfig`, which has no table anywhere:
         * `grep -rn 'permittedChannels\|orgClassesThatMayAdmit' db/migrations/`
         * → nothing.
         *
         * ⚠️ `decideAdmission` IS THE ONE TO READ BEFORE MOUNTING ANYTHING
         * HERE. It is *"THE MOST SECURITY-SENSITIVE OPERATION IN THE
         * PRODUCT"* and it is where invariant 6 is enforced — *"Without this
         * checkpoint, 'the agent read the email' and 'the agent obeyed the
         * email' are the same event."* Two of its three gates have no
         * producer, and `0022`'s grants block refuses the cheap
         * `GRANT UPDATE (admitted_as_evidence_at)` shortcut in advance.
         *
         * ✅ AND ALL THREE MOUNTED HERE ARE READS OF AN ENVELOPE AND NEVER OF
         * A BODY: there is no `body` column in `0022` and `bodyRef` is a
         * pointer nothing here dereferences. That absence is why a
         * correspondence surface is safe to mount before its admission gate
         * exists.
         */
        listThreads: authorisedHandler(pool, substrateFor, listThreadsOperation),
        getThread: authorisedHandler(pool, substrateFor, getThreadOperation),
        getMessage: authorisedHandler(pool, substrateFor, getMessageOperation),
        /**
         * 🛑 CONFERRING A CAPABILITY — G512, 19 Sep 2026, AND IT IS THE FIRST
         * OPERATION EITHER PLANE HAS MOUNTED THAT CREATES AUTHORITY.
         *
         * Every other entry in this map reads, and one of them amends a single
         * column. This one writes a row into `tenant.role_assignment` — the
         * table `db/migrations/0009_identity_substrate.sql` withheld every
         * write privilege from, in capitals, because *"a request path that
         * could write `role_assignment` could grant itself any capability in
         * the closed set, and `decide()` would then permit it CORRECTLY."*
         *
         * 🛑 THE PRIVILEGE AND THIS LINE ARE ONE COMMIT, AND G511 SAYS SO:
         * *"The fence and the writer are one commit or neither."* Two earlier
         * slices designed the fence, measured it across twelve outcomes on a
         * throwaway database, and landed NOTHING — because a `GRANT INSERT`
         * with no operation behind it is the shape `0004_subject_ledger.sql`
         * refuses. **Deleting this line means deleting the `GRANT` in
         * `db/migrations/0020_capability_granting.sql` in the same commit.**
         *
         * G300's three parts, DERIVED rather than asserted:
         *   TABLE       `tenant.role_assignment` × `role` × `role_capability`,
         *               `db/migrations/0009`, plus `0020`'s `GRANT INSERT` and
         *               `role_assignment_grant_restrictive`. Derive:
         *               `grep -c 'GRANT INSERT ON tenant.role_assignment' db/migrations/*.sql`
         *   MODEL       `canGrant()` and `GRANT_REASONS` in `model/access.ts`,
         *               reached through `server/data-plane/role-grants.ts`.
         *               Derive: `grep -rln 'export function canGrant' model/`
         *   CAPABILITY  `x-capability: manage_roles` — a member of the closed
         *               set that `tenant.role_capability` can actually carry,
         *               and which `SEED_CAPABILITIES` now holds. Derive:
         *               `grep -n 'grantRoleAssignment' -A 2 docs/contracts/capability.openapi.yaml`
         *
         * ⚠️ AND THE DIRECTORY IT READS IS G506's, WHICH IS WHY THIS COULD NOT
         * BE BUILT BEFORE 19 Sep 2026: `canGrant()` needs the TARGET's
         * `orgClass`, whose only source is `orgFor(connection.owner)`, and
         * G447 measured another person's connection as unreadable in every
         * scope until `db/migrations/0018` opened the directory.
         */
        grantRoleAssignment: authorisedHandler(
          pool,
          substrateFor,
          grantRoleAssignmentOperation,
        ),
        /**
         * 🛑 G318's FIRST WAVE, ARRIVING LAST — INTAKE. The sequence G318
         * sets is *"INGESTION, EXCEPTIONS, CORRESPONDENCE, AND ONLY THEN THE
         * PARTNER PORTAL AND THE STAFF CONSOLE"*, and waves two and three
         * landed first because `db/migrations/0012` gave ingestion its TABLE
         * and nothing gave it a ROUTE. **This is that route, and it is one
         * operation of the six C1/C2/C5 declares.**
         *
         * `server/data-plane/intake.ts` derives G300's three parts with the
         * commands. The short form: `tenant.intake_channel` × `tenant.arrival`
         * (0012, `SELECT` only), `INTAKE_CHANNEL_KINDS` and
         * `guardIntakeChannel()` — which is CALLED and not merely imported for
         * its vocabulary — and `admit_source`, which a seeded operator holds.
         *
         * 🛑 THE FIVE THAT DID NOT COME AND WHY, BY NAME, BECAUSE G300's
         * *"a table alone is the trap"* is the whole test:
         *
         *   `createUpload`     `UploadTicket` requires a presigned `url`, and
         *                      there is no object store on this path.
         *                      ⚠️ **THE DERIVATION HERE WAS `grep -c 'aws-sdk'
         *                      package.json` → 0 UNTIL 20 Sep 2026 AND IT NOW
         *                      RETURNS 1** — R-C takes `@aws-sdk/client-sqs`
         *                      and DISCHARGES G212, so that command no longer
         *                      measures this refusal. **The refusal has not
         *                      moved**: what is absent is an S3 client, and
         *                      R-C is narrow by name —
         *                      `node -e "console.log(Object.keys(require('./package.json').dependencies).filter(d=>d.startsWith('@aws-sdk/')))"`
         *                      → `[ '@aws-sdk/client-sqs' ]`. A ticket with a
         *                      fabricated URL is still a 201 that cannot be
         *                      used.
         *   `completeUpload`   `DocumentSummary` requires `filename`,
         *                      `synthetic` and `status`, and 0012's §3 refuses
         *                      all three columns BY NAME — *"`filename`
         *                      ABSENT … the ingestion path this slice builds
         *                      has no filename to write"*. There is also no
         *                      blob to complete.
         *   `getDocument`      `Document` requires `extracted`, `lines`,
         *                      `redactedPaths` and `acquisitionFidelity` on
         *                      top of `DocumentSummary`'s six. 0012 §3 names
         *                      the consequence in its own voice: *"this slice
         *                      produces NONE of them."*
         *   `rerunRun`         Its 201 is `RunAdmission`, so it needs
         *                      everything `admitRun` needs — and then a
         *                      `RunTrigger` of kind `rerun`, which the MODEL
         *                      declares as carrying `ofRunId` and `reason` and
         *                      which `public.run` has no column for. The wire
         *                      is `additionalProperties: true, required:
         *                      [kind]`, so `{ kind: 'rerun' }` would VALIDATE
         *                      while dropping the whole of *"Carries what
         *                      changed, so superseded exceptions are
         *                      explicable"*. That is a migration and a ruling,
         *                      not a handler.
         *   `classifyValue`    0012 §5 grants `document_field_spec` `SELECT`
         *                      only: *"a path that could INSERT here could
         *                      DECLARE A CLASSIFICATION."*
         *
         * ⚠️ AND `admitRun` IS A **WRITE**, THE THIRD THIS PLANE SERVES AND
         * THE FIRST THAT CREATES A ROW IN `public.run`. Its privilege is
         * `0002_run.sql`'s existing `INSERT`; `db/migrations/0069` adds two
         * COLUMNS and a UNIQUE INDEX and grants nothing new on that table.
         * The index is the idempotency guarantee and the handler's
         * `ON CONFLICT` is how it is read — a `SELECT`-then-`INSERT` would
         * lose the exact race the operation is named for.
         */
        listIntakeChannels: authorisedHandler(pool, substrateFor, listIntakeChannelsOperation),
        admitRun: authorisedHandler(pool, substrateFor, admitRunOperation(publishRun)),
        /**
         * 🛑 C9's FIRST VERTICAL SLICE — G2401, THE OWNER'S RULING OF
         * 1 Oct 2026 — AND THE FIRST OPERATION EITHER PLANE HAS SERVED WHOSE
         * CAPABILITY IS OF CLASS `secret`. G300's three parts, derived:
         *   TABLE       `tenant.endpoint` (`0270` §1), column-level `UPDATE`
         *               on the three binding columns and nothing wider, and
         *               `tenant.tenant_key_handle` (`0270` §2), `SELECT` only.
         *   MODEL       `Endpoint.credentialRef` — *"A REFERENCE — no field in
         *               this model may hold key material"* — and
         *               `CONNECTOR_PARAMETER_ENFORCEMENT.credential_ref`, whose
         *               `settableBy` is this verb.
         *   CAPABILITY  `bind_secret`, seeded on `tenant_admin`.
         * ✅ AND AN FDE REACHES IT SINCE 1 Oct 2026 — G2591, applying G2407
         * (THE OWNER'S): `decide()`'s platform arm honours a LIVE
         * `TenantAccessGrant` whose classes include `secret`. ⚠️ THIS READ
         * *"AND THE FDE CANNOT REACH IT … consults no `TenantAccessGrant`"* and
         * is corrected rather than deleted. The cost — every mounted
         * `tenant_data` operation opens to the same grant — is on `decide()`'s
         * header.
         */
        bindEndpointCredential: authorisedHandler(
          pool,
          substrateFor,
          bindEndpointCredentialOperation(custody),
        ),
        /**
         * 🛑 C9's DECLARATION HALF — G2681–G2690, 1 Oct 2026. FIVE
         * OPERATIONS DECLARED AND MOUNTED IN ONE COMMIT, each through
         * `authorisedHandler()`, so every one mints invariant 10's record
         * before its body runs. G300's three parts are derived at the head of
         * `server/data-plane/sources.ts`:
         *   TABLE       `0340` (the declaration, the two typed address tables,
         *               the lane's writer, the stop history) and `0341` (the
         *               pair and its mapping).
         *   MODEL       `model/connectors.ts` §2–§4, each function CALLED.
         *   CAPABILITY  `view_endpoint` (the list) and `configure_endpoint`
         *               (the four acts), both seeded on `tenant_admin`.
         * ⚠️ AND NONE OF IT CONNECTS TO ANYTHING: row 2's *"Test before
         * declare"* needs request-path egress (G2151). ⚠️ THIS READ *"and the
         * classifier and the drain are blocked on an `Arrival` carrying no
         * filename (G2692)"* AND IS CORRECTED RATHER THAN DELETED: the owner
         * ruled G2692 on 2 Oct 2026, the drain runs inside
         * `declareEndpointDocumentType`, and the classifier is
         * `admitClassifyAndStoreArrival()` — which still has no caller outside
         * `tests/`, because nothing READS a source (no connector).
         */
        listEndpoints: authorisedHandler(pool, substrateFor, listEndpointsOperation),
        /* G3941 — the pick list's names; `server/data-plane/document-types.ts`. */
        listDocumentTypes: authorisedHandler(pool, substrateFor, listDocumentTypesOperation),
        declareEndpoint: authorisedHandler(pool, substrateFor, declareEndpointOperation),
        stopEndpoint: authorisedHandler(pool, substrateFor, stopEndpointOperation),
        resumeEndpoint: authorisedHandler(pool, substrateFor, resumeEndpointOperation),
        declareEndpointDocumentType: authorisedHandler(
          pool,
          substrateFor,
          declareEndpointDocumentTypeOperation,
        ),
        /**
         * C9's PARKED PILE — G2831–G2840, applying G2692 (THE OWNER'S). G300:
         *   TABLE       `0380` (the name, the held artefact, the drain, the
         *               escalation) over `0012` §2's arrival.
         *   MODEL       `model/ingestion.ts` §2a's `decideArrival()`, CALLED
         *               on every read so a pane's reason is the parking
         *               decision asked again.
         *   CAPABILITY  `view_exception` (the pile and the pane — row 19's
         *               *"An user who cannot act still follows it"*) and
         *               `configure_endpoint` (the raise, a Setup act).
         */
        listParkedArrivals: authorisedHandler(pool, substrateFor, listParkedArrivalsOperation),
        getParkedArrival: authorisedHandler(pool, substrateFor, getParkedArrivalOperation),
        raiseParkedArrival: authorisedHandler(pool, substrateFor, raiseParkedArrivalOperation),
        /**
         * 🛑 G318's FOURTH WAVE, FIRST ROUTE — C11's REPORT. That wave
         * arrived on 19 Sep 2026 and mounted NOTHING:
         * `tests/contracts/customer-surface-reach.test.mjs` is *"THE FOURTH
         * WAVE ARRIVING AND FINDING NOTHING IT MAY MOUNT"*, and it recorded
         * `getDispositionMix`'s blocker mechanically rather than in a
         * paragraph — `label` and `family` are both `required` on the 200 and
         * *"Nothing in `db/migrations/` declares"* a catalogue to read them
         * from.
         *
         * **G657's `tenant.disposition` declared one**, and that file's own
         * tripwire fired and said so: *"`getDispositionMix`'s NAMED BLOCKER
         * IS GONE … what changed is that its blocker is now a commit rather
         * than a schema."* This is that commit.
         * `server/data-plane/reports.ts` derives G300's three parts.
         *
         * ⚠️ AND A SECOND BLOCKER WAS FOUND ON THE WAY IN AND IS NOT WAVED
         * THROUGH: `periodId` is a DECLARED filter with no producer —
         * `tenant.exception` carries no period and nothing joins one to a run
         * — so the operation REFUSES it with a 422 rather than answering
         * every period as though it were the one asked for. The 422 is
         * declared on the operation in this same commit. G954, argued at
         * length in `reports.ts`.
         *
         * 🛑 IT IS ALSO THE SECOND HALF OF THE SLICE ABOVE, AND THE TWO ARE
         * NOT MERELY ADJACENT. A reversal CLEARS the resolution, so mounting
         * `reverseResolution` alone would have made this report's `count`
         * short by every reversed choice and its `reversalRate` a constant
         * zero. `0140` §2 pins what the reversal undid and
         * `disposition-mix-store.ts` is the reader those pins owe.
         */
        getDispositionMix: authorisedHandler(pool, substrateFor, getDispositionMixOperation),
      },
    },
    {
      /**
       * 🛑 THE STAFF CONSOLE, SERVED FOR THE FIRST TIME — **G1241, 20 Sep 2026,
       * THE OWNER'S RULING.** *"Onboarding state lives in a table in the
       * CONTROL database, one row per tenant, beside the roster — and `stage`
       * is DERIVED at read time from the stored step state, never stored
       * twice."*
       *
       * **ONE OPERATION OF FOURTEEN, AND THE OTHER THIRTEEN ARE NOT A
       * BACKLOG.** `tests/http/console-roster-unreachable.test.ts` §5a derives
       * per operation which `required` response field has no producer
       * anywhere; thirteen have no table in either database — a billing
       * period, an invoice, a pack draft, a rate card. `listTenants` is the
       * one that had a table (G831), a reach (G1161), a capability (G601) and,
       * since this commit, a `stage`.
       *
       * 🛑 **IT IS THE FIRST GATED OPERATION EITHER PLANE HAS EVER MOUNTED FOR
       * A CALLER WITH NO TENANT, AND IT IS ONLY MOUNTABLE BECAUSE OF G730.**
       * `mountTier()`'s sixth fence makes minting invariant 10's record a
       * precondition of mounting; `AuthorizationGrant extends TenantScoped`,
       * so until `db/migrations/0091_platform_authorisation_record.sql` gave a
       * tenant-less act a second HOME there was nowhere for the record to go —
       * which is the blocker G728 measured from the console-session side and
       * G783 measured again from the contract side. Both are discharged here,
       * and neither was discharged by effort.
       *
       * ⚠️ **AND IT IS THE CONTROL PLANE THAT STILL CANNOT SERVE IT.**
       * `server/control-plane/roster-store.ts` says so in capitals and
       * `refuseGatedOperations()` throws at BOOT there for any mounted
       * operation naming a capability. The plane that resolves a console
       * SESSION is this one (G726); the roster is in the other database; the
       * edge that joins them is G1161's read-only pool, and it points this
       * way and not back. `tests/http/console-roster-unreachable.test.ts` §1
       * and §2 keep both halves asserted.
       *
       * ⚠️ THE POOL IS THE CONTROL-READ ONE AND THE TENANT POOL IS STILL
       * PASSED, because the two do different jobs in one act:
       * `authorisedHandler(pool, …)` writes the authorisation record into the
       * DATA database, and `listTenantsOperation(controlPlane)` reads the
       * roster out of the CONTROL one. `server/data-plane/console-roster.ts`
       * carries what that costs in atomicity and which direction it fails in.
       */
      tier: 'platformConsole',
      handlers: {
        listTenants: authorisedHandler(pool, substrateFor, listTenantsOperation(controlPlane)),
      },
    },
    {
      /**
       * 🛑 **THE ADMINISTRATION TIER'S FIRST MOUNT, EVER — R8 and R9,
       * 21 Sep 2026, BOTH THE OWNER'S.**
       *
       * ⚠️ **THREE OF FORTY-FIVE, AND THE OTHER FORTY-TWO ARE NOT A BACKLOG.**
       * `server/contract/capability.ts`'s `EXEMPT_WITH_A_PERSON_TO_ASK` records
       * them as **42 person-facing exemptions**, and its entry says what each
       * would cost: *"every one of these is an operation that would serve
       * ungated if it were mounted."* These three left that population by
       * being GATED — R8 annotates them `view_substrate` in place — and not by
       * being excused.
       *
       * 🛑 **SO THE FENCE THAT APPLIES HERE IS THE SIXTH AND NOT THE FOURTH,
       * AND THE DIFFERENCE IS THE WHOLE OF R8.** An `exempt:` handler facing a
       * person needs `servedWithoutAGate()` at the mount (G914); a GATED one
       * needs `authorisedHandler()`, because *"an operation may not mount
       * until it mints a record"* (G301). **The count of
       * `servedWithoutAGate()` calls in `server/` is therefore unchanged at
       * one** — derive it, `grep -rn 'servedWithoutAGate(' server/` — and
       * `tests/http/onboarding-console-served.test.ts` §4 witnesses the sixth
       * fence refusing a bare handler for each of these three operationIds.
       *
       * ⚠️ **TWO POOLS, AND THE SPLIT IS THE PRIVILEGE.** `authorisedHandler(pool, …)`
       * writes invariant 10's record into the DATA database for all three;
       * the READ body then reaches the control database on a credential that
       * CANNOT write, and the two WRITE bodies on one that can update exactly
       * one column of one table and insert into one other.
       * `db/migrations-control/0040_onboarding_writer.sql` is the grant and
       * `server/data-plane/onboarding.ts` carries what the cross-database
       * arrangement costs in atomicity.
       */
      tier: 'administration',
      handlers: {
        listOnboardingSteps: authorisedHandler(
          pool,
          substrateFor,
          listOnboardingStepsOperation(controlPlane),
        ),
        completeOnboardingStep: authorisedHandler(
          pool,
          substrateFor,
          completeOnboardingStepOperation(controlPlane),
        ),
        forceOnboardingStep: authorisedHandler(
          pool,
          substrateFor,
          forceOnboardingStepOperation(controlPlane),
        ),
        /**
         * 🛑 THE PARTNER PORTAL'S FIRST FIVE — W5, 1 Oct 2026, G2633–G2640.
         * GATED ON R10's VERBS, ANSWERED ON `decide()`'s FIFTH ARM, AND
         * RECORDED IN INVARIANT 10's THIRD HOME (`0320`, G2621 — the owner's).
         * `authorisedHandler()`'s partner branch runs each body in a SESSION
         * scope, so no tenant-scoped table is reachable from any of them.
         *
         * ✅ AND THE INVITATION IS THE SIXTH SINCE 2 Oct 2026 — G2801, THE
         *    OWNER'S: *"Drop `name` from invitePartnerPerson's 201 (filled at
         *    redemption). Then mount it and build invitation redemption at
         *    first sign-in."* Its redemption runs inside the sign-in
         *    transaction (`partner-redemption-store.ts`, `0370`).
         *
         * ⚠️ THREE ARE ANNOTATED AND DELIBERATELY NOT HERE, and a reader
         * adding one should meet its reason first. (They are described rather
         * than NAMED in this comment, because
         * `tests/http/administration-tier-unmounted.test.ts` §2a reads an
         * operationId anywhere in this file as a mount.) ⚠️ THIS SAID FOUR
         * AND LISTED THE INVITATION FIRST — *"its 201 is a `PartnerPerson`
         * whose `name` is `required`; the request carries no name, so
         * mounting it ships a 500 on every success"* (G2630) — WHICH THE
         * RULING ABOVE DISCHARGED BY CHANGING THE 201.
         *   THE TRIAL REQUEST  — G2639. Writer and table built (`0322` §4);
         *       nothing on any request path writes an `accepted`
         *       registration, so its only reachable answer is its own 422 —
         *       G359's reason, read the same way.
         *   THE SANDBOX HAND-BACK AND RESET — G2640. Each answers an act on a
         *       provisioned plane (*"Torn down"*, a restored seed) that no
         *       process in this repository performs.
         */
        listDealRegistrations: authorisedHandler(pool, substrateFor, listDealRegistrationsOperation()),
        submitDealRegistration: authorisedHandler(pool, substrateFor, submitDealRegistrationOperation()),
        getSandboxTenant: authorisedHandler(pool, substrateFor, getSandboxTenantOperation()),
        requestSandboxTenant: authorisedHandler(pool, substrateFor, requestSandboxTenantOperation()),
        listPartnerPeople: authorisedHandler(pool, substrateFor, listPartnerPeopleOperation()),
        invitePartnerPerson: authorisedHandler(pool, substrateFor, invitePartnerPersonOperation()),
      },
    },
    {
      tier: 'foundation',
      /**
       * 🛑 `servedWithoutAGate()` — G914, 20 Sep 2026.
       *
       * ⚠️ **THIS READ *"AND IT IS THE ONLY CALL TO IT IN `server/`"* UNTIL
       * 22 Sep 2026 AND IS CORRECTED RATHER THAN DELETED, because it is the
       * sentence that told a reader how many operations this plane serves past
       * the gate.** There are TWO: this one and `resolveHomeRealm`, mounted
       * below under G1941.
       *
       * 🛑 **AND THE DERIVATION BESIDE IT NEVER MEASURED THE THING IT WAS
       * QUOTED FOR — G1947, and it is G978's finding on a second command.** It
       * read `grep -rn 'servedWithoutAGate(' server/`, which returned
       * **FOURTEEN** lines before this slice and **ELEVEN OF THEM WERE
       * PROSE** — the declaration, the six fence paragraphs in
       * `server/http/app.ts`, three in `server/contract/capability.ts`, and
       * this very sentence quoting the command in order to retire it. It would
       * answer with double figures if the function had never been called at
       * all. **§5.1 wearing a `grep`.**
       *
       * 🛑 **AND THE REPAIR WAS ITSELF THE SAME DEFECT, NARROWED RATHER
       * THAN CLOSED — G1953, MEASURED BEFORE THIS COMMIT LANDED.**
       * `grep -rn 'servedWithoutAGate(' server --include start.ts` returns
       * **NINE** lines against **TWO** calls: it drops the seven prose
       * mentions in `app.ts` and keeps the seven in THIS file — the file the
       * narrowing selected for. **Wrong by seven instead of by twelve is
       * still a derivation that cannot see a call.** Key on the CALL SYNTAX:
       *   `grep -rnE ': *servedWithoutAGate\(' server --include start.ts`
       *
       * D1 declares `x-capability: 'exempt: …'` and the foundation tier
       * declares `security: [sessionContext]`, so the caller is a PERSON and
       * the `preValidation` gate returns at its first line for this route.
       * `mountTier()`'s fourth fence now refuses to serve that combination
       * unmarked — on every tier, keyed on the caller rather than on which
       * file the operation sits in — so this call is what stands between the
       * ungated read and a boot failure.
       *
       * **The reason is NOT restated here and must not be**: it lives on the
       * operation, in `docs/contracts/foundation.openapi.yaml`, and it is the
       * circularity argument — *"this operation MINTS the session a capability
       * check would later be built from, so gating it on one is circular"*.
       * What this call adds is the second act the annotation cannot perform:
       * the person MOUNTING it read that reason and accepted serving it.
       *
       * ⚠️ IT DOES NOT AND CANNOT REMOVE A GATE. The gate is read from the
       * DOCUMENT; a mark on a gated operation is the fourth fence's second
       * half and does not boot.
       */
      handlers: { resolveTenantContext: servedWithoutAGate(resolveTenantContextHandler(pool, registry)) },
    },
    {
      /**
       * 🛑 **THE SESSION TIER, SERVED FOR THE FIRST TIME — G1941, 22 Sep 2026,
       * THE OWNER'S RULING. ONE OPERATION OF FOUR, AND IT IS THE FIRST
       * UNAUTHENTICATED PERSON-FACING MOUNT IN THIS PRODUCT.**
       *
       * `checkLocalHealth` is not the precedent and the difference is not
       * pedantry: `data-plane-local.openapi.yaml` declares no security scheme
       * and its callers are *"ALBs and scrapers"* — **nobody is on the other
       * end.** Here somebody is, they have presented nothing, and
       * `server/data-plane/realm.ts` is where every consequence of that is
       * argued, including the D6 departure this mount rests on.
       *
       * ⚠️ **IT CROSSES G200's MOUNTING FREEZE AND THAT IS RECORDED RATHER
       * THAN ABSORBED.** G296's condition — *"the freeze lifts when the
       * authoriser can say YES to somebody"* — is about GATED operations and
       * cannot speak about this one: there is no caller for an authoriser to
       * say yes to. So the lifting here is neither G296's nor G300's; it is
       * **the owner's, for one operation, on the ground that a product nobody
       * can begin to sign in to is not a product.** G1941 is the row.
       *
       * ┌─ 🛑 THE FOURTH FENCE DOES NOT FIRE FOR THIS OPERATION, AND THE MARK
       * │    IS TAKEN ANYWAY. READ BOTH HALVES BEFORE REMOVING IT.
       * └──────────────────────────────────────────────────────────────────
       *
       * **WHY IT DOES NOT FIRE, MEASURED RATHER THAN ASSUMED:**
       * `session.openapi.yaml` declares `security: []` at document level and
       * this operation overrides nothing, so `callerOf([])` answers `'none'`,
       * `callerMayBeAPerson('none')` is `false`, and the fence's third
       * `.filter()` drops it. Derive it, never read it:
       *   `node -e "import('./server/contract/capability.ts').then(m=>console.log(m.callerOf([]), m.callerMayBeAPerson('none')))"`
       *
       * 🛑 **AND THAT IS §5.1 — A FENCE KEYED ON THE SECURITY SCHEME RATHER
       * THAN ON WHETHER A HUMAN IS THERE.** `server/contract/capability.ts`
       * argues `CallerKind` as *"the property the tier table was a proxy
       * for"*, quoting six paragraphs that were all about CALLERS and keyed on
       * FILENAMES. The repair keyed on the scheme, which is the next-nearest
       * landmark — and a scheme is a statement about what a caller PRESENTS,
       * not about who they ARE. **`none` collapses two different worlds: a
       * load balancer polling `/health`, and a person at a sign-in form who
       * has nothing to present yet.** This operation is the first inhabitant
       * of the second world, and it is the reason the collapse is now visible.
       *
       * ✅ **SO THE MARK IS TAKEN, AND IT IS LAWFUL RATHER THAN A TRICK.** The
       * fourth fence's SECOND half refuses a mark that CONTRADICTS the
       * document, and it keys on `gateVerdictOf(...) === 'gated'`. This
       * operation is `exempt`, so the mark asserts exactly what the document
       * says and the plane boots. What it buys is the thing
       * `servedWithoutAGate()` exists for and the fence cannot compel here:
       * **serving a person past the gate becomes an explicit, greppable,
       * counted call at the mount.** Derive the population honestly —
       * `grep -rn 'servedWithoutAGate(' server/` returns mostly PROSE, and so
       * does the `--include start.ts` narrowing that was written to repair it
       * (EIGHT lines, TWO calls — G1953 said NINE and G1996 ran it). **Both
       * figures move whenever anybody edits a comment in either file, which
       * is the argument for the syntax below rather than for a third
       * number.** Key on the CALL SYNTAX:
       *   `grep -rnE ': *servedWithoutAGate\(' server --include start.ts`
       *
       * ⚠️ **WHAT WAS NOT DONE, AND IT IS THE REPAIR RATHER THAN THE
       * WORKAROUND: the fence is not widened to treat `none` as a person.**
       * It cannot be — `checkLocalHealth` is `none` too and is mounted bare,
       * so widening is a boot failure on the liveness probe. Distinguishing
       * *"no credential because no caller"* from *"no credential YET"* is a
       * fact no security scheme carries, so it is either a sixth `CallerKind`
       * derived from something new in the contract or an owner's ruling.
       * **G1948 names it; it is not taken here.**
       *
       * ✅ **THE OWNER TOOK IT ON 29–30 Sep 2026 — D6-8 — AND THE TWO
       * PARAGRAPHS ABOVE ARE CORRECTED RATHER THAN DELETED, BECAUSE THEY ARE
       * THE ARGUMENT THE RULING ANSWERS (G2241–G2245, 1 Oct 2026).** The
       * ruling is the SECOND of their options, and it is neither a sixth
       * `CallerKind` nor a widened fourth fence: *"A separate boot fence for
       * `caller === 'none'`."* `server/http/app.ts`'s SEVENTH fence now
       * COMPELS a mark here, and the fact *"no credential YET"* that no
       * security scheme carries is `PUBLIC_OPERATION_AUDIENCE`, argued at its
       * declaration in `server/contract/capability.ts` — `session` is
       * `person`, `dataPlaneLocal` is `infrastructure`, so `checkLocalHealth`
       * still mounts bare below.
       * 🛑 **SO THE MARK ON THIS OPERATION CHANGES: `servedPublicly()`, NOT
       * `servedWithoutAGate()`.** The voluntary mark was the right instrument
       * for the wrong question — it acknowledges an AUTHENTICATED person
       * served past `decide()`, and nobody here is authenticated. The
       * `servedWithoutAGate()` population is therefore ONE again
       * (`resolveTenantContext`), and every sentence above counting TWO is a
       * statement about the tree of 22–30 Sep 2026. Derive both, never read
       * them:
       *   `grep -rnE ': *servedWithoutAGate\(' server --include start.ts`
       *   `grep -rnE ': *servedPublicly\(' server --include start.ts`
       *
       * ⚠️ **THE SIXTH FENCE IS VERIFIED RATHER THAN ASSUMED TOO.** It keys on
       * `gateVerdictOf(spec.capability) === 'gated'`; this operation is
       * `exempt`, so it is outside that filter and mints no invariant 10
       * record. `server/http/app.ts` calls that *"a hole with a name: an
       * operation that buys its way out with prose buys its way out of the
       * record too"* — and here the hole is narrow in the one way that
       * matters: **`authorize()` could not mint a record for this act at any
       * price**, because `AuthorizationGrant extends TenantScoped` and there
       * is no tenant, and `db/migrations/0091`'s second home is keyed on the
       * acting SESSION, of which there is none either. A third home for an
       * act with neither is a ruling nobody has taken.
       * `tests/http/realm-served.test.ts` §3 asserts the verdict rather than
       * trusting this paragraph.
       *
       * 🛑 **THE OTHER THREE SESSION OPERATIONS ARE NOT A BACKLOG AND EACH IS
       * REFUSED BY NAME.**
       *
       *   `completeFederatedSignIn`  `tenant.session.user_id` is `NOT NULL`
       *     with no writer on any request path, `tenant."user"` has NO
       *     EXTERNAL-SUBJECT COLUMN (G306's refusal, unblocked by G976 and
       *     still unwritten), and `MintedSession` carries no handle. A
       *     verifier exists — `server/data-plane/token-verify.ts` — and a
       *     verified token is not a minted session. Derive the gap:
       *     `grep -c 'external_subject' db/migrations/0009_identity_substrate.sql`
       *   `getSession` / `signOut`    Both override the document's
       *     `security: []` with `sessionContext`, so both have a PERSON caller
       *     and both are `exempt` — which is
       *     `EXEMPT_WITH_A_PERSON_TO_ASK.session = 2`, and mounting either
       *     needs `servedWithoutAGate()` AND an argument this slice has not
       *     made. They read a session row nothing in this repository mints, so
       *     mounting them today serves a 401 to everybody and an honest 404 is
       *     better — G300's *"a 403 indistinguishable from an unbuilt feature
       *     is worse than an honest 404 from the router."*
       *
       * ⚠️ **THE CENSUS DOES NOT MOVE. `EXEMPT_WITH_A_PERSON_TO_ASK.session`
       * IS STILL 2** — it counts DECLARED person-facing exemptions, and this
       * operation's caller is `none`. Mounting changes what is SERVED, not
       * what is declared, and the two are deliberately different numbers.
       */
      tier: 'session',
      handlers: {
        resolveHomeRealm: servedPublicly(resolveHomeRealmHandler(pool)),
        /**
         * ✅ S6 — MOUNTED 1 Oct 2026, G2490. D6-1, THE OWNER'S: *"Both
         * operations go public; mount the callback too."* The refusal of this
         * operation in the paragraph above is KEPT as the history it is and
         * every clause of it is now false; `server/data-plane/federated-signin.ts`
         * carries the whole argument.
         *
         * 🛑 `servedPublicly()`, D6-8's mark, AND IT IS COMPELLED RATHER THAN
         * VOLUNTARY: `callerOf([])` is `none` and `PUBLIC_OPERATION_AUDIENCE.
         * session` is `person`, so the SEVENTH fence refuses to boot a bare
         * mount of this operation — `tests/http/public-mount-fence.test.ts` §2
         * has witnessed exactly that since G2241.
         *
         * ⚠️ THE TRANSPORT IS CHOSEN HERE AND IS THE PRODUCTION ONE ON BOTH
         * ENTRY POINTS — there is no option through which a caller could hand
         * a plane a different one, for `authorise`'s reason. The suites reach a
         * real local broker through it.
         */
        completeFederatedSignIn: servedPublicly(
          completeFederatedSignInHandler({
            pool,
            registries,
            terms: identityTerms,
            transport: tokenEndpointTransport(),
            signInReturnHost: registries.signInReturnHost ?? null,
          }),
        ),
        /**
         * ✅ MOUNTED 1 Oct 2026 — THE OWNER'S RULING (G2541): *"Build a public
         * 'start sign-in' operation that inserts an attempt row (state, nonce,
         * PKCE) and returns the broker redirect — same D6 posture: WAF rate
         * rule, servedPublicly, INSERT-only grant on sign_in_attempt with a
         * restrictive WITH CHECK, attempt TTL per D6-6."* It closes G2497 —
         * the callback's PRECONDITION — and `server/data-plane/signin-begin.ts`
         * carries the whole argument.
         *
         * 🛑 `servedPublicly()`, AND COMPELLED, FOR THE CALLBACK'S REASON:
         * `callerOf([])` is `none` and the session tier's audience is `person`,
         * so the SEVENTH fence refuses a bare mount. It WRITES an attempt row
         * for a caller with no credential at all — the callback's mint is the
         * other public write — and what contains the write is `0290`'s column
         * grant and restrictive fence, and nothing the handler promises. No egress: the authorize URL is a string the
         * browser carries.
         */
        beginFederatedSignIn: servedPublicly(
          beginFederatedSignInHandler({
            pool,
            registries,
            terms: identityTerms,
            signInReturnHost: registries.signInReturnHost ?? null,
          }),
        ),
        /**
         * ✅ MOUNTED 2 Oct 2026 — THE OWNER'S RULING G2549: *"One shared
         * callback host: all sign-ins return to one fixed callback which then
         * 303s to the tenant host via resolveServingHost (a registry lookup,
         * grant bound to the host)."* `server/data-plane/signin-return.ts`
         * carries the argument. It answers on the configured return host
         * ALONE and 403s everywhere else, including on every plane with no
         * return host configured.
         *
         * 🛑 `servedPublicly()`, COMPELLED for the begin's reason: `callerOf([])`
         * is `none` and the session tier's audience is `person`. It WRITES
         * nothing — a READ ONLY scope and a 303 — and it EGRESSES nothing.
         */
        relayBrokerReturn: servedPublicly(
          relayBrokerReturnHandler({
            pool,
            registries,
            signInReturnHost: registries.signInReturnHost ?? null,
          }),
        ),
        /**
         * ✅ MOUNTED 2 Oct 2026 — G3004 (derived), the REVOKE half of the
         * owner's profile-switcher ruling G2771: *"choosing one = real
         * sign-out (revoke) + real begin-sign-in"*. The refusal of this
         * operation above — *"They read a session row nothing in this
         * repository mints"* — went false on 1 Oct 2026 when S6 began minting
         * one, and is kept as the history it is.
         *
         * 🛑 `servedWithoutAGate()`, COMPELLED: the operation overrides the
         * document's `security: []` with `sessionContext`, so its caller is a
         * PERSON, and it is `exempt` — the fourth fence refuses a bare mount.
         * It revokes the CALLER'S OWN row through `session_rls` and can reach
         * no other (`server/data-plane/sign-out.ts`).
         */
        signOut: servedWithoutAGate(signOutHandler(pool)),
        /**
         * ✅ MOUNTED 3 Oct 2026 — G3354 (derived), the chrome's who-am-I.
         * `server/data-plane/session-principal.ts` carries the argument.
         *
         * 🛑 `servedWithoutAGate()`, COMPELLED for `signOut`'s reason: the
         * operation overrides the document's `security: []` with
         * `sessionContext`, so its caller is a PERSON, and it is `exempt` —
         * the fourth fence refuses a bare mount. It reads the CALLER'S OWN
         * person row through `user_visible_to_session` and the bound tenant's
         * roster NAME through the read-only control pool (G1161), and nothing
         * else.
         */
        getSessionPrincipal: servedWithoutAGate(getSessionPrincipalHandler(pool, authorise)),
      },
    },
    /**
     * ⚠️ NO MARK, AND THE ABSENCE IS DERIVED RATHER THAN FORGOTTEN:
     * `data-plane-local.openapi.yaml` declares no `security` at all, so
     * `callerOf()` answers `none` and there is no person to serve ungated.
     * The same is true of `listEntitledPacks` on the control plane, whose
     * caller is sigV4 — a machine.
     *
     * ⚠️ **AND THE SEVENTH FENCE (D6-8) DOES NOT COMPEL `servedPublicly()`
     * HERE EITHER, AND THAT IS DERIVED TOO:** `PUBLIC_OPERATION_AUDIENCE.
     * dataPlaneLocal` is `infrastructure` — ALBs and scrapers, never routed by
     * the edge — so `publicOperationFacesAPerson()` is `false` for this
     * operation and a `servedPublicly()` mark on it would CONTRADICT the
     * census and refuse to boot.
     */
    { tier: 'dataPlaneLocal', handlers: { checkLocalHealth } },
  ]
}

/**
 * ⚠️ THE AUTHORISER IS A PARAMETER WITH A DEFAULT, AND THE DEFAULT IS THE
 * PRODUCTION ONE. G200's gate, 19 Sep 2026.
 *
 * 🛑 THE DEFAULT WAS `denyAllCapabilities` UNTIL G299 LANDED LATER THE SAME DAY,
 * AND THE PARAGRAPH THAT STOOD HERE IS QUOTED RATHER THAN DELETED BECAUSE IT IS
 * THE SENTENCE A READER WOULD HAVE TRUSTED: *"`denyAllCapabilities` refuses
 * every verb, because this repository resolves no subject."* **This repository
 * resolves a subject now** — `db/migrations/0009_identity_substrate.sql`,
 * `server/data-plane/identity.ts`, and `resolveSubject()` called for the first
 * time — so the default is `sessionCapabilities`, which asks the same single
 * evaluator about a principal assembled entirely out of rows.
 *
 * ⚠️ WHAT IS UNCHANGED, AND IT IS THE HALF THE PARAGRAPH EXISTED FOR: **both
 * listener entry points below take the default, so a deployed process cannot be
 * handed a permissive one.** The parameter exists so a test can witness the
 * ALLOW arm of the ordering pair, which is the only way to tell a gate that runs
 * before the validator from one that runs after it. `denyAllCapabilities` is
 * still exported and is still what `tests/http/capability-gate.test.ts` drives
 * the refusing half of that pair through.
 */
async function buildDataPlane(
  pool: TenantPool,
  controlPlane: ControlPlaneClient,
  reader: SessionReader,
  registries: HostRegistries,
  identityTerms: VerificationTermsSource | null,
  authorise = sessionCapabilities,
  substrateFor: (session: TenantSession) => PrincipalSubstrate = substrateFromSession,
  publishRun: RunQueuePublisher = unconfiguredRunQueue(),
  custody: CredentialCustody = unconfiguredCredentialCustody(),
): Promise<FastifyInstance> {
  return buildPlane<TenantSession>(
    {
      plane: 'data-plane',
      /**
       * ⚠️ THE READER IS ASYNCHRONOUS NOW AND `PlaneOptions.authenticate` WAS
       * WIDENED TO ADMIT THAT, WHICH IS STATED AT THE DECLARATION. G160 keys
       * `tenant.session`'s policy on a digest in a GUC, so establishing a real
       * session is a scoped transaction — and a synchronous authenticator can
       * authenticate nobody but the holder of a locally minted token.
       */
      authenticate: async (request) => reader(request),
      unauthenticatedDetail: UNAUTHENTICATED_DETAIL,
      authorise,
      unauthorisedDetail: UNAUTHORISED_DETAIL,
    },
    mounts(
      pool,
      controlPlane,
      registries.tenants,
      registries,
      identityTerms,
      substrateFor,
      publishRun,
      custody,
      authorise,
    ),
  )
}

/**
 * Start on an ephemeral port.
 *
 * ⚠️ THIS READ *"THE READER IS RESOLVED BEFORE THE POOL AND BEFORE THE
 * LISTENER"* UNTIL 19 Sep 2026 AND IT IS CORRECTED RATHER THAN DELETED,
 * because the ORDER moved and the PROPERTY did not. The reader now takes the
 * pool — a real session is a row, and a row needs a connection — so the pool
 * is built first. What is unchanged, and is the half the sentence existed for:
 * **the reader is resolved EXACTLY ONCE**. `RECONCILE_LOCAL_TEST_AUTH` is read
 * here and nowhere downstream; a plane keeps the answer it was born with. See
 * `server/dev/test-token.ts` for why that is a fence rather than a check.
 *
 * ⚠️ THE REGISTRY IS READ ONCE HERE TOO, AND FOR A STRICTER REASON.
 * `server/data-plane/serving-hosts.ts`: a registry that could change under a
 * running server would make two requests on one connection resolve to two
 * different tenants. A malformed entry throws BEFORE a port is bound.
 */
export async function startDataPlane(opts: {
  poolMax: number
  /**
   * 🛑 THE ONE PLACE AN AUTHORISER CAN BE SUPPLIED, AND IT IS THE EPHEMERAL-PORT
   * ENTRY POINT — NOT THE CONTAINER'S. Read the asymmetry before reading the
   * parameter: `listenDataPlane()` below takes NO such option and never will,
   * so a deployed process has no argument through which a permissive authoriser
   * could arrive. `server/data-plane/main.ts` calls `listenDataPlane` and
   * nothing else. That is the same shape `server/data-plane/session.ts` uses for
   * the local test token — the accepting path is not reachable from the
   * production entry point — arriving at the authority axis instead of the
   * identity one.
   *
   * ⚠️ WHY IT EXISTS AT ALL. G200's gate can only be witnessed by a MATCHED
   * PAIR: the same request, once against an authoriser that allows and once
   * against one that refuses. If both arms return 400 the gate is behind the
   * validator and the schema oracle is open to the unentitled — and a suite with
   * no allow arm cannot tell. The database-backed suites under `tests/http/`
   * also pass one, because they are about tenant isolation and the engine rather
   * than about the gate, and against the default they would be asserting `403`
   * over and over while proving nothing about row-level security.
   */
  authorise?: CapabilityAuthoriser<TenantSession>
  /**
   * 🛑 THE SECOND HALF OF THE SAME ASYMMETRY, AND IT ARRIVES WITH G301 FOR THE
   * SAME REASON THE FIRST DID. `listenDataPlane()` below takes NO `substrate`
   * option and never will, so a deployed process has no argument through which
   * a fabricated principal could arrive — it gets `substrateFromSession`, which
   * projects rows and nothing else.
   *
   * ⚠️ WHY IT HAD TO EXIST AT ALL, STATED RATHER THAN SLIPPED IN. Before G301
   * a handler needed no principal: the gate asked `decide()` and the handler
   * read rows. **Now the handler MINTS**, and a mint needs the same principal
   * the gate had. Every database-backed suite in `tests/http/` drives requests
   * through the local test token — which authenticates a caller with NO subject
   * — and pairs it with a permissive authoriser to get past the gate (named in
   *   `tests/http/harness.ts`; this file deliberately does NOT name it, which is
   *   assertion 4 of `tests/http/deployed-path-cannot-be-permissive.test.ts` —
   *   a serving module that can name a test fixture is one that can call it).
   *   Against a
   * minting handler that pairing is no longer enough: there is nobody to mint
   * FOR, and the honest outcomes are a 500 or a 403, both of which would make
   * every isolation assertion in those files assert nothing.
   *
   * 🛑 AND IT CANNOT MAKE A PLANE PERMISSIVE, WHICH IS THE PROPERTY THAT MAKES
   * IT SAFE TO EXIST. Whatever substrate it returns, the verdict comes from
   * `authorize()`, which asks `decide()`, which is the single evaluator — *"A
   * reader that returned a fabricated substrate would be lying to the evaluator
   * rather than replacing it."* A test that hands it a role carrying no
   * capabilities still gets a 403.
   */
  substrate?: (session: TenantSession) => PrincipalSubstrate
  /**
   * 🛑 THE THIRD HALF OF THE SAME ASYMMETRY — R-B, 20 Sep 2026 — AND IT IS THE
   * ONLY ONE OF THE THREE THAT IS NOT ABOUT AUTHORITY.
   *
   * `listenDataPlane()` below takes NO `publishRun` option and never will, so a
   * deployed process reaches `resolveRunQueuePublisher()` and gets whatever
   * `RECONCILE_RUN_QUEUE_URL` says — a real SQS client, or the LOUD
   * unconfigured publisher, and nothing a caller chose.
   *
   * ⚠️ WHY IT EXISTS AT ALL, AND IT IS A DIFFERENT REASON FROM THE OTHER TWO.
   * Those exist because a gate can only be witnessed by a matched pair. This
   * one exists because **the gate must pass on a machine with no AWS account**:
   * `tests/reachability.ts`'s whole discipline is that a green run must not
   * depend on an unreachable dependency, so a suite that proved the publish by
   * reaching a queue would either SKIP — forbidden — or be red everywhere but
   * one laptop. A recording publisher makes the message itself the assertion.
   *
   * 🛑 AND IT CANNOT MAKE A PLANE PERMISSIVE OR EVEN VISIBLE TO A CALLER. A
   * publisher runs AFTER the act has committed, sees only the act's own
   * authorisation grant and the value already decided for the response, and
   * cannot change either — `runAfterCommit()` swallows what it throws. It is
   * an observer of a decided act.
   */
  publishRun?: RunQueuePublisher
  /**
   * 🛑 R2's KEY DOCUMENT, ON THE EPHEMERAL-PORT PATH ONLY — S6, 1 Oct 2026.
   *
   * ⚠️ READ WHERE THE DEPLOYED VALUE COMES FROM BEFORE THE PARAMETER,
   * BECAUSE THIS ONE IS A TRUST ANCHOR: whoever chooses the key document
   * chooses which tokens verify. `listenDataPlane()` takes it too, and its
   * ONLY caller is `server/data-plane/main.ts`, which obtains it from
   * `loadVerificationTerms(identityTermsTarget())` — the environment, through
   * R2's boot fetch, and nothing else.
   * `tests/http/deployed-path-cannot-be-permissive.test.ts` §1c holds that by
   * reading `main.ts`.
   *
   * 🛑 AND THE LOAD STAYS IN `main.ts`, FOR THAT FILE'S STATED REASON: *"The
   * process loads keys; the server does not."* This function never fetches;
   * absent, it is `null`, so no suite in the gate can reach a network by
   * starting a plane (G108). The suites that need a broker start a LOCAL one
   * and hand its key document here — the same shape `loadVerificationTerms()`
   * would have produced from its URL.
   */
  identityTerms?: VerificationTermsSource | null
  /**
   * 🛑 THE FOURTH HALF OF THE SAME ASYMMETRY — G2401. `listenDataPlane()` takes
   * NO `credentialCustody` option, so a deployed process reaches
   * `resolveCredentialCustody()` and gets Secrets Manager or the LOUD
   * unconfigured store, never one a caller chose. It exists so a suite can
   * hold the value a bind stored and then search every table for it.
   */
  credentialCustody?: CredentialCustody
  /**
   * G4301 — the client for the control plane's internal tier. An ARGUMENT for
   * tests (never an environment variable); absent, it is resolved once at boot
   * from `RECONCILE_INTERNAL_CONTROL_PLANE_URL`, and with no URL it is the
   * unconfigured client, which serves nothing and syncs nothing.
   */
  controlPlane?: ControlPlaneClient
}): Promise<RunningDataPlane> {
  /**
   * ⚠️ TWO REGISTRIES, READ TOGETHER AND ONCE — G726, 19 Sep 2026. The
   * paragraph above says a registry that could change under a running server
   * would make two requests on one connection resolve to two different
   * tenants; the console registry is stricter again, because a surface decides
   * whether a session may exist with NO tenant. Both are read before the pool
   * and before the port, and a malformed entry in either throws here.
   */
  const registry = servingHostRegistry()
  const consoles = consoleHostRegistry()
  const registries = {
    tenants: registry,
    consoles,
    /* G2549 — validated against both registries; a collision fails the boot. */
    signInReturnHost: signInReturnHostFromEnv(registry, consoles),
  }
  const pool = await createAppPool(opts.poolMax)
  /* ⚠️ THE THIRD POOL IS GONE — G4316, 5 Oct 2026, THE OWNER'S "Full restore"
     ruling. R9 put a WRITING control-database credential in this process;
     the onboarding writes now go to the control plane over the signed
     internal edge (`controlPlane`, below), and S5 drops the role. */
  const controlPlane = opts.controlPlane ?? (await resolveControlPlaneClient())
  const reader = await resolveSessionReader(pool, registries)
  const identityTerms = opts.identityTerms ?? null
  const app = await buildDataPlane(
    pool,
    controlPlane,
    reader,
    registries,
    identityTerms,
    opts.authorise ?? sessionCapabilities,
    opts.substrate ?? substrateFromSession,
    opts.publishRun ?? (await resolveRunQueuePublisher()),
    opts.credentialCustody ?? (await resolveCredentialCustody()),
  )

  try {
    await app.listen({ port: 0, host: '127.0.0.1' })
  } catch (err) {
    await pool.end().catch(() => undefined)
    throw err
  }

  const address = app.server.address()
  if (address === null || typeof address === 'string') {
    await app.close()
    await pool.end().catch(() => undefined)
    throw new Error('the data plane bound a pipe rather than a TCP port')
  }

  /* G4313 — the tenant-name pull. AWAITED here so a test's first request sees
     the pulled names; it never throws, so a dead control plane is a log line. */
  const nameSync = controlPlane.configured ? scheduleTenantNameSync(pool, controlPlane) : null
  await nameSync?.first

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: async () => {
      nameSync?.stop()
      // The listener first: a pool ended under a live request would surface as
      // an unhandled rejection in whatever was mid-flight.
      await app.close()
      await pool.end()
      /*
       * ⚠️ BEST-EFFORT, AND ONLY THIS ONE. The tenant pool's `end()` is
       * awaited bare because a failure there is a real defect worth surfacing;
       * the control pool may never have opened a socket at all — see the
       * lazy-construction note above — so a machine with no control
       * database would otherwise fail every `close()` in the suite.
       */
    },
  }
}

/**
 * Start on the configured port. Used by the container entry point, where the
 * port is a published thing and not an ephemeral one.
 *
 * 🛑 NO `authorise` OPTION, DELIBERATELY. This is the function
 * `server/data-plane/main.ts` calls, so it is the one a deployed process reaches
 * — and it takes the production authoriser by having no way to be given
 * anything else. Do not add the parameter here to make a script easier; the
 * asymmetry IS the fence.
 */
export async function listenDataPlane(opts: {
  host: string
  port: number
  poolMax: number
  /**
   * R2's key document as `main.ts` loaded it from the environment, or `null`.
   * S6: the callback verifies against THIS and nothing else. REQUIRED rather
   * than optional, so the deployed path states its answer rather than
   * defaulting one.
   */
  identityTerms: VerificationTermsSource | null
}): Promise<RunningDataPlane> {
  const registry = servingHostRegistry()
  const consoles = consoleHostRegistry()
  const registries = {
    tenants: registry,
    consoles,
    /* G2549 — validated against both registries; a collision fails the boot. */
    signInReturnHost: signInReturnHostFromEnv(registry, consoles),
  }
  const identityTerms = opts.identityTerms
  const pool = await createAppPool(opts.poolMax)
  /* ⚠️ THE THIRD POOL IS GONE — G4316, 5 Oct 2026, THE OWNER'S "Full restore"
     ruling. R9 put a WRITING control-database credential in this process;
     the onboarding writes now go to the control plane over the signed
     internal edge (`controlPlane`, below), and S5 drops the role. */
  const controlPlane = await resolveControlPlaneClient()
  const reader = await resolveSessionReader(pool, registries)
  /*
   * 🛑 RESOLVED ONCE, HERE, LIKE THE READER AND THE TWO REGISTRIES — R-B.
   * `RECONCILE_RUN_QUEUE_URL` is read at boot and nowhere downstream, so a
   * plane keeps the answer it was born with; a plane with no queue configured
   * never loads `sqs-run-queue.ts` and never constructs an `SQSClient`, which
   * is what stops a process with no AWS credentials from looking for some.
   */
  const publishRun = await resolveRunQueuePublisher()
  const app = await buildDataPlane(
    pool,
    controlPlane,
    reader,
    registries,
    identityTerms,
    sessionCapabilities,
    substrateFromSession,
    publishRun,
    await resolveCredentialCustody(),
  )
  try {
    await app.listen({ port: opts.port, host: opts.host })
  } catch (err) {
    await pool.end().catch(() => undefined)
    throw err
  }
  /* G4313 — boot pull plus every ten minutes, NOT awaited: the listener does
     not wait on the control plane (the tenant hot path must not depend on it). */
  const nameSync = controlPlane.configured ? scheduleTenantNameSync(pool, controlPlane) : null
  return {
    url: `http://${opts.host}:${opts.port}`,
    close: async () => {
      nameSync?.stop()
      await app.close()
      await pool.end()
    },
  }
}
