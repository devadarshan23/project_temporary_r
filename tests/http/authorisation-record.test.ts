/**
 * INVARIANT 10, BUILT — "an act with no authorisation is unrecordable."
 * **G301, 19 Sep 2026.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 READ THE POLARITY BEFORE READING THE ASSERTIONS. THIS FILE USED TO PASS
 *    BECAUSE THE PROPERTY WAS ABSENT. IT NOW PASSES BECAUSE THE PROPERTY IS
 *    PRESENT, AND THE TURN IS THE WHOLE STORY OF THE FILE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It was a TRIPWIRE. From 16 Aug 2026 it scanned every source file under
 * `server/` and both migration directories for seven words — `AuthorizationGrant`,
 * `DataAccessEvent`, `AuditEvent`, `authorisation_id`, `authorization_id`,
 * `data_access_event`, `audit_event` — comments included, *"because a comment
 * that NAMES the mechanism is exactly how a half-built one gets introduced"* —
 * and required the list to be EMPTY. Its own header said what it was for:
 *
 *     "🛑 WHAT MAKES THIS FIRE. The day `server/` grows the vocabulary of
 *      authorisation, or a migration declares a table to hold it, this file goes
 *      RED with a message asking for two things in the same commit: the record
 *      updated, and these assertions replaced by ones that verify the record is
 *      WRITTEN rather than that it is absent."
 *
 * **IT FIRED, ON THIS COMMIT, WHICH IS THE DAY IT WAS WRITTEN FOR.** Both things
 * it asked for are here. The absence-assertions are gone because the absence is
 * gone; **not one of them was deleted to make a run green**, and the positive
 * assertions below cover every property the old file was protecting:
 *
 *   old: no migration declares a table          → §5, a row is WRITTEN, with its fields
 *   old: nothing in `server/` names the type    → §2, exactly ONE thing may mark a minting
 *                                                 handler, and the fence refuses the rest
 *   old: "a write with a null or invented       → §1, `AUTHORIZATION_MAY_BE_ABSENT` witnessed
 *        grant id"                                BOTH WAYS; §6, a REFUSAL mints nothing
 *   old: "inside the same `withTenantScope()`   → §7, a failed act leaves NO record
 *        transaction … so a record cannot
 *        outlive a rolled-back act"
 *
 * ⚠️ AND THE OLD HEADER'S SHARPEST PARAGRAPH IS QUOTED RATHER THAN RETIRED,
 * BECAUSE IT IS STILL THE RULE THIS FILE POLICES: *"the two shortcuts available
 * to this slice are to write a NULL where the model forbids one, or to mint a
 * grant id that stands for no authorisation anybody performed. Both are worse
 * than the gap, because both produce an audit trail that reads as evidence and
 * is not."* Neither shortcut was taken. G299 supplied the third option the
 * paragraph said did not exist — a resolvable principal — and G301 ruled where
 * the mint goes.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 DO NOT LET THIS FILE BE QUOTED AS MORE THAN IT IS. INVARIANT 10's OWN
 *    SENTENCE IS CAREFUL AND SO IS THIS ONE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * *"This does not make an unauthorised act impossible — nothing can, against
 * root — it makes one visible or detectable."* Nothing below proves that a
 * customer's rows cannot be read without a record. What it proves is that **the
 * served path cannot do it**: a gated operation that mints nothing does not
 * mount, a refused caller opens no transaction, and a failed act takes its own
 * record down with it.
 *
 * ✅ **ONE HALF OF THAT IS NOW BUILT — G317, 19 Sep 2026 — AND THE PARAGRAPH
 * THAT STOOD HERE IS CORRECTED RATHER THAN DELETED**, because it is the
 * sentence §8 was argued on and the one most likely to be quoted onward. It
 * read: *"⚠️ AND ONE HALF OF INVARIANT 10 IS STILL NOT BUILT, NAMED HERE
 * RATHER THAN LEFT TO BE INFERRED. 'AuditEvent, DataAccessEvent and
 * UsageRecord all carry its id' — **none of the three has a table, and this
 * commit writes none.**"* **All three have a table**, each carrying
 * `authorization_id`, in `db/migrations/0014_invariant_10_event_streams.sql`,
 * and `AUTHORIZATION_MAY_BE_ABSENT` is enforced by a `CHECK` on the two that
 * carry an actor. §8a asserts it.
 *
 * 🛑 **AND THE SENTENCE THAT MATTERS SURVIVES UNCHANGED, WHICH IS WHY §8 IS
 * STILL HALF AN ABSENCE.** *"A served read now records THE AUTHORISATION IT
 * RAN UNDER and does not yet record THE ACCESS. **Nobody should read an access
 * log off `tenant.authorization_grant`.**"* Nothing on a request path writes
 * any of the three: their non-authorisation terms have no producer, and
 * `DataAccessEvent.maxDataClass` is the one invariant 4 forbids guessing. §8b
 * asserts that, over a real served request, so the claim is measured rather
 * than believed.
 *
 * ⚠️ §1–§4 NEVER SKIP. They read files and call pure functions.
 * §5–§8 need a PostgreSQL and say so.
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { request as httpRequest } from 'node:http'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { REPO_ROOT, sessionCookie } from './harness.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { digestOfHandle } from '../../server/data-plane/handle-digest.ts'
import { startDataPlane } from '../../server/data-plane/start.ts'
import { getRunOperation, listRunsOperation } from '../../server/data-plane/runs.ts'
import { listIntakeChannelsOperation } from '../../server/data-plane/intake.ts'
import {
  decideApprovalOperation,
  executeProposalOperation,
  getProposalOperation,
  listAvailableDispositionsOperation,
  listProposalsOperation,
  proposeResolutionOperation,
} from '../../server/data-plane/proposals.ts'
import { grantRoleAssignmentOperation } from '../../server/data-plane/role-grants.ts'
import { admitRunOperation } from '../../server/data-plane/run-admission.ts'
import { bindEndpointCredentialOperation } from '../../server/data-plane/credential-binding.ts'
import {
  declareEndpointDocumentTypeOperation,
  declareEndpointOperation,
  listEndpointsOperation,
  resumeEndpointOperation,
  stopEndpointOperation,
} from '../../server/data-plane/sources.ts'
import { listDocumentTypesOperation } from '../../server/data-plane/document-types.ts'
import {
  getParkedArrivalOperation,
  listParkedArrivalsOperation,
  raiseParkedArrivalOperation,
} from '../../server/data-plane/parked.ts'
import { unconfiguredCredentialCustody } from '../../server/data-plane/credential-store.ts'
import {
  getRunAccountOperation,
  listRunAllocationsOperation,
  listRunResidueOperation,
} from '../../server/data-plane/run-account.ts'
import {
  assignExceptionOperation,
  getExceptionFacetsOperation,
  getExceptionOperation,
  listExceptionsOperation,
  reverseResolutionOperation,
} from '../../server/data-plane/exceptions.ts'
import { getDispositionMixOperation } from '../../server/data-plane/reports.ts'
import { listTenantsOperation } from '../../server/data-plane/console-roster.ts'
import {
  completeOnboardingStepOperation,
  forceOnboardingStepOperation,
  listOnboardingStepsOperation,
} from '../../server/data-plane/onboarding.ts'
import {
  getSandboxTenantOperation,
  listDealRegistrationsOperation,
  invitePartnerPersonOperation,
  listPartnerPeopleOperation,
  requestSandboxTenantOperation,
  submitDealRegistrationOperation,
} from '../../server/data-plane/partner-portal.ts'
import type { ControlPlaneClient } from '../../server/data-plane/control-plane-client.ts'
import {
  getMessageOperation,
  getThreadOperation,
  listThreadsOperation,
} from '../../server/data-plane/correspondence.ts'
import {
  authorisedHandler,
  type AuthorisedOperation,
} from '../../server/data-plane/authorisation-record.ts'
import { buildPlane } from '../../server/http/app.ts'
import type { TenantPool } from '../../db/tenant-scope.ts'
import { NO_IDENTITY_SUBSTRATE } from '../../server/data-plane/authorise.ts'
import { loadTier, type TierName } from '../../server/contract/document.ts'
import { AUTHORIZATION_MAY_BE_ABSENT, authorizationIsWellFormed } from '../../model/governance.ts'
import type { AuditActor } from '../../model/governance.ts'
import { CAPABILITIES } from '../../model/access.ts'
import type { AuthorizationGrantId } from '../../model/kernel.ts'
import { runScopedName } from '../run-scoped-db.ts'

/**
 * ⚠️ `listTenantsOperation` TAKES A POOL AND §3 NEVER OPENS ONE, SO THE STUB IS
 * THE HONEST ARGUMENT RATHER THAN A SHORTCUT. Every assertion in §3 reads
 * `op.operationId` and the operation's contract entry — set before the closure is
 * built — and NONE of them calls `op.body`. A stub whose `connect()` throws is
 * what makes that true rather than merely likely: if a future assertion reaches
 * the body, it fails loudly here instead of silently opening a socket this
 * section is documented not to need.
 */
/**
 * The CONTROL PLANE client's stub — G4316, 5 Oct 2026. It replaces R9's write
 * pool stub, because the onboarding writes now go to the control plane over the
 * signed internal edge rather than through a writing control-database pool. It
 * throws for the read stub's reason exactly.
 */
const BODY_RAN =
  '§3 built an onboarding operation to read its capability and then RAN its body. That ' +
  'section asserts over two fields and opens no connection; if a body is genuinely ' +
  'needed, it belongs in `tests/http/onboarding-console-served.test.ts`.'
const CONTROL_PLANE_STUB: ControlPlaneClient = {
  configured: true,
  get: () => {
    throw new Error(BODY_RAN)
  },
  post: () => {
    throw new Error(BODY_RAN)
  },
}

function filesUnder(dir: string, ext: readonly string[]): readonly string[] {
  const out: string[] = []
  const walk = (d: string): void => {
    for (const entry of readdirSync(d)) {
      const full = path.join(d, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (ext.some((e) => entry.endsWith(e))) out.push(full)
    }
  }
  walk(dir)
  return out
}

/**
 * 🛑 THE DATABASE PROBE IS TAKEN HERE, BEFORE THE FIRST `describe`, AND THAT IS
 * THE WHOLE OF G4061 — the flake this file carried in the full gate.
 *
 * `node --test` starts RUNNING a top-level suite as soon as the module yields,
 * and a top-level `await` is a yield. With the probe below §3 (where it sat
 * until 4 Oct 2026), §1–§3 — a walk of every file under `server/`, every
 * operation built and its contract read, two planes built — ran DURING the
 * probe's connect, so `db/env.ts`'s 2 s `connectionTimeoutMillis` was timing
 * this file's own CPU work and not PostgreSQL. Measured on an idle private
 * PostgreSQL 14: connect 230–600 ms here against 4–8 ms with the probe hoisted;
 * 1,485 and 2,016 ms under two concurrent gates, every other probing suite
 * ≤ 215 ms; and G3915's `timeout expired` at load 64–88 — after which
 * `databaseRequiredUnderCi()` correctly turns the stand-down RED.
 *
 * The probe still answers only *is a PostgreSQL there*; no timeout moved.
 * `tests/ci/reachability-guards.test.ts` refuses a probe placed after any
 * top-level registration, in every suite.
 */
const probe = await probeDatabase()

/* ================================================================== *
 * §1 · THE NULL RULE, WITNESSED BOTH WAYS.
 * ================================================================== */

describe('exactly one actor kind may act with no authorisation, and it is `system`', () => {
  it('1a · `system` may leave the reference null', () => {
    assert.equal(
      authorizationIsWellFormed({ kind: 'system' } as AuditActor, null),
      true,
      '`system` is genuine machinery — "a retention sweep, a scheduler tick, the timeout ' +
        'clock that ends a parked await". No capability was evaluated because there was no ' +
        'principal to evaluate one against, and inventing a service principal to satisfy the ' +
        'column would be worse than the null.',
    )
  })

  it('1b · NOTHING ELSE MAY, and the four are witnessed one at a time', () => {
    /**
     * 🛑 THE ONE-AT-A-TIME MATTERS. A single assertion over the whole table
     * would pass if the function ignored its argument and returned the table's
     * value for `system` every time — which is §5.6 in one line. Each kind is
     * asked separately, and `agent` is the one worth naming: it LOOKS like
     * machinery and is not. It acts under a delegation, and "an agent read with
     * no authorisation is the exact gap §3 closed — a bounded capability
     * quietly acting unbounded".
     */
    for (const kind of ['user', 'partner_staff', 'platform_staff', 'agent'] as const) {
      assert.equal(
        authorizationIsWellFormed({ kind } as AuditActor, null),
        false,
        `actor kind \`${kind}\` was permitted to act with NO authorisation reference. ` +
          '`AUTHORIZATION_MAY_BE_ABSENT` admits exactly one kind and this is not it.',
      )
    }
  })

  it('1c · the table itself admits exactly one kind, so §1b cannot go vacuous', () => {
    const permitted = Object.entries(AUTHORIZATION_MAY_BE_ABSENT)
      .filter(([, may]) => may)
      .map(([kind]) => kind)
    assert.deepEqual(
      permitted,
      ['system'],
      'the set of actor kinds that may omit an authorisation has changed. It is TOTAL over ' +
        '`AuditActor[\'kind\']`, so a sixth variant is a compile error until somebody decides ' +
        '— but WIDENING it is a decision this assertion exists to make loud. G301 is explicit: ' +
        '"`AUTHORIZATION_MAY_BE_ABSENT` already says exactly one actor kind may leave it null ' +
        '(`system`), and that is unchanged."',
    )
  })

  it('1d · a `system` actor that DOES carry one is still well-formed', () => {
    /* The table says WHEN a null is permitted, never when a reference is
     * forbidden — "a scheduler running a job on a user's standing delegation
     * legitimately has an authorisation to name". Without this, §1a would be
     * satisfied by a function that rejected every `system` row carrying an id. */
    assert.equal(
      authorizationIsWellFormed({ kind: 'system' } as AuditActor, 'azg_x' as AuthorizationGrantId),
      true,
    )
  })
})

/* ================================================================== *
 * §2 · THE MOUNTING PRECONDITION, AS A SOURCE PROPERTY.
 * ================================================================== */

describe('minting is a precondition of mounting, and exactly one thing may claim it', () => {
  const serverSources = filesUnder(path.join(REPO_ROOT, 'server'), ['.ts'])

  it('2a · ANTI-VACUOUS — the walker is reading the tree it thinks it is', () => {
    /* Inherited unchanged from the tripwire this file replaces: a walker that
     * found no files would report a perfect absence of everything. */
    assert.ok(
      serverSources.length >= 10,
      `only ${serverSources.length} source file(s) were found under server/, so every count ` +
        'below is a statement about the wrong tree.',
    )
  })

  it('2b · exactly ONE call site under `server/` marks a handler as minting', () => {
    /**
     * 🛑 THIS IS THE CONTROL THAT MAKES `recordsAuthorisation()` A PROPERTY
     * RATHER THAN A CONVENTION, AND ITS LIMIT IS STATED IN THE FUNCTION'S OWN
     * DOCBLOCK. The `MINTS` symbol is module-private, so a `RecordingHandler`
     * cannot be written as an object literal anywhere — but the constructor is
     * exported and will mark whatever it is handed. What the symbol buys is that
     * marking is an EXPLICIT, GREPPABLE CALL; what makes the claim hold is that
     * there is exactly one, and it sits immediately around the write.
     *
     * Same shape as G192's structural fence on the dev token, which is also a
     * grep that must return a fixed answer.
     */
    const callers = serverSources
      .filter((f) => !f.endsWith(path.join('http', 'app.ts')))
      .filter((f) => /\brecordsAuthorisation\s*\(/.test(readFileSync(f, 'utf8')))
      .map((f) => path.relative(REPO_ROOT, f))

    assert.deepEqual(
      callers,
      ['server/data-plane/authorisation-record.ts'],
      'the set of places under `server/` that MARK a handler as minting invariant 10\'s ' +
        'record has changed. There must be exactly one, and it must be the one that performs ' +
        'the write — otherwise the mark says "this handler records" about a handler that does ' +
        'not, and `mountTier()`\'s sixth fence is satisfied by a claim rather than by a ' +
        'record. If a second minting seam is genuinely wanted, that is a ruling.',
    )
  })

  it('2c · the marker is not something a handler can be given by accident', () => {
    /* `recordsAuthorisation` is named in `server/http/app.ts` (where it is
     * declared) and in the one call site above. A third mention under `server/`
     * is either a second marker or a comment about one, and both are things a
     * person should see. */
    const mentions = serverSources
      .filter((f) => readFileSync(f, 'utf8').includes('recordsAuthorisation'))
      .map((f) => path.relative(REPO_ROOT, f))
      .sort()
    assert.deepEqual(mentions, [
      'server/data-plane/authorisation-record.ts',
      'server/http/app.ts',
    ])
  })
})

/* ================================================================== *
 * §2d · THE SIXTH FENCE IS HOME-BLIND — G730, 19 Sep 2026.
 * ================================================================== */

describe('the sixth fence knows nothing about WHERE a record lands', () => {
  /**
   * ✅ **G730 GAVE INVARIANT 10 A SECOND HOME AND THE FENCE MUST NOT HAVE
   * GAINED A SECOND HOLE.** The owner's ruling adds
   * `tenant.platform_authorization_grant`, keyed on the acting session, so a
   * TENANT-LESS act — a console principal — can now be recorded. The risk
   * that arrives with it is the one G301 named in its own voice: *"tying it
   * to mounting is what stops the invariant eroding one slice at a time."*
   *
   * 🛑 THE STRUCTURAL ANSWER FIRST, BECAUSE IT IS STRONGER THAN THE TEST.
   * The fence runs at BOOT. It reads `capability.kind === 'capability'` off
   * the CONTRACT and asks whether the mounted entry carries the private
   * `MINTS` symbol — and at that moment **no principal exists, no session
   * exists, and no tenant exists to be absent.** There is no expression the
   * fence could evaluate that would distinguish a console operation from a
   * tenant one, so a gated console operation inherits the fence the moment it
   * is declared on a gated tier. The two assertions below are what keeps that
   * sentence from being merely plausible.
   *
   * ⚠️ AND THE HALF THAT IS NOT WITNESSED, SAID PLAINLY RATHER THAN LEFT TO
   * BE INFERRED: **there is no gated console operation to point the fence at.**
   * `docs/contracts/capability.openapi.yaml` declares no operation whose verb
   * reaches `substrate`, `catalogue` or `commercial` — derive it with
   * `grep -o "x-capability: [a-z_]*" docs/contracts/capability.openapi.yaml |
   * sort -u` and cross it against `PLATFORM_ASSIGNMENT_REACHES` — and the 26
   * `platform-role` operations live on a tier whose
   * `TIER_REQUIRES_CAPABILITY` is `false`, which G602 measures as
   * all-or-nothing. **So this slice mounts nothing and says so.** The moment a
   * console operation is annotatable, the assertions below are the ones that
   * already apply to it.
   */

  it('2d · a gated operation with a bare handler does not BOOT, and one from `authorisedHandler()` does', async () => {
    await assert.rejects(
      () =>
        buildPlane<unknown>(
          {
            plane: 'data-plane',
            authenticate: async () => ({}),
            unauthenticatedDetail: 'x',
            authorise: () => 'held',
            unauthorisedDetail: 'x',
          },
          [{ tier: 'capability', handlers: { listRuns: async () => ({}) } }],
        ),
      (err: Error) => {
        assert.match(
          err.message,
          /mint no\s+authorisation record[\s\S]*listRuns/,
          'the plane booted with a NON-MINTING handler on a gated operation. G301: "an ' +
            'operation may not mount until it mints a record." Got: ' + err.message,
        )
        return true
      },
    )

    /**
     * AND THE MIRROR, WITH THE REAL CONSTRUCTOR RATHER THAN A STUB — which is
     * what makes this a claim about `authorisedHandler()` and not about
     * `recordsAuthorisation()`. **One constructor serves both homes**: the
     * branch on `grant.home` is inside it, so there is no second wrapper a
     * console operation could be mounted with and no second thing the fence
     * would have to learn about.
     *
     * ⚠️ THE POOL IS A PLACEHOLDER AND IS NEVER TOUCHED. `authorisedHandler()`
     * closes over it and reaches it only inside a request, and no request is
     * made here — this assertion is about BOOTING, which is why it needs no
     * database and sits outside every `{ skip }` in this file.
     */
    const app = await buildPlane<unknown>(
      {
        plane: 'data-plane',
        authenticate: async () => ({}),
        unauthenticatedDetail: 'x',
        authorise: () => 'held',
        unauthorisedDetail: 'x',
      },
      [
        {
          tier: 'capability',
          handlers: {
            listRuns: authorisedHandler({} as TenantPool, () => NO_IDENTITY_SUBSTRATE, {
              operationId: 'listRuns',
              resourceType: 'Run',
              instanceOf: () => null,
              body: async () => ({}),
            }),
          },
        },
      ],
    )
    await app.close()
  })
})

/* ================================================================== *
 * §3 · THE HANDLER'S VERB AND THE CONTRACT'S VERB ARE THE SAME VERB.
 * ================================================================== */

describe('the capability the record names is the capability the gate asked about', () => {
  /**
   * 🛑 THIS GAP HAS A NAME AND NOTHING ELSE CLOSES IT. `mountTier()` checks that
   * an operation CARRIES an annotation; `tools/check-capability-annotations.mjs`
   * checks every declared operation has one. **Neither compares the handler's
   * capability against the document's.** A mismatch would mint a record naming
   * a verb different from the one the caller was gated on — an audit row that is
   * internally consistent and wrong, which is the worst kind there is.
   */
  /**
   * ⚠️ **THIS READ `loadTier('capability')` AND NOTHING ELSE UNTIL 20 Sep 2026,
   * AND IT WENT RED THE DAY THE DATA PLANE MOUNTED AN OPERATION FROM ANOTHER
   * DOCUMENT — G1241.** `listTenants` is `platform-console.openapi.yaml`'s, and
   * a lookup hard-wired to one tier cannot see it: the assertion would have
   * failed with *"the capability tier no longer declares `/staff/tenants`"*,
   * which is a true sentence about the wrong question.
   *
   * 🛑 **§5.1: THE RULE WAS KEYED ON THE TIER THIS PLANE HAPPENED TO SERVE,
   * AND THE PROPERTY IS *"whichever document declares this operation gates it
   * on the verb the handler mints"*.** The tier is a column of the table now,
   * so the next mount from an eighth document is a row rather than a rewrite.
   */
  function annotationOf(tier: TierName, urlPath: string, method: string): unknown {
    const paths = loadTier(tier)['paths'] as Record<string, Record<string, unknown>>
    const item = paths[urlPath] as Record<string, unknown> | undefined
    assert.ok(item !== undefined, `the \`${tier}\` tier no longer declares \`${urlPath}\``)
    const op = item[method] as Record<string, unknown> | undefined
    assert.ok(op !== undefined, `\`${urlPath}\` no longer declares \`${method}\``)
    return op['x-capability']
  }

  /**
   * 🛑 A TABLE, NOT A CASE PER OPERATION, AND THE CHANGE IS ITSELF A FINDING.
   *
   * This block read `3a · listRuns` and `3b · getRun` and nothing else, while
   * `server/data-plane/run-account.ts` said in its own header that this suite
   * *"gains a case per operation in the commit that mounts one"*. **G300
   * mounted two and neither case arrived**, so `getRunAccount` and
   * `listRunResidue` have been minting records against a capability nothing
   * compared with the document — for exactly as long as they have been
   * mounted. The G357 wave found it while adding its own four.
   *
   * A promise to add a case is the thing that went stale, so the promise is
   * replaced by a TABLE: every mounted `AuthorisedOperation` is listed once,
   * with the path and method its record must agree with. The next mount still
   * has to add a row — nothing can derive the URL, because
   * `server/contract/routes.ts` derives routes from the DOCUMENT and this
   * table's whole job is to be the independent second opinion. What is
   * different is that the row is one line beside seven others rather than a
   * sentence in another file's header.
   */
  const MOUNTED: readonly (readonly [AuthorisedOperation, string, string, TierName])[] = [
    [listRunsOperation, '/runs', 'get', 'capability'],
    [getRunOperation, '/runs/{runId}', 'get', 'capability'],
    [getRunAccountOperation, '/runs/{runId}/account', 'get', 'capability'],
    [listRunResidueOperation, '/runs/{runId}/residue', 'get', 'capability'],
    /* R13 — G2374, 1 Oct 2026. */
    [listRunAllocationsOperation, '/runs/{runId}/allocations', 'get', 'capability'],
    [listExceptionsOperation, '/exceptions', 'get', 'capability'],
    [getExceptionFacetsOperation, '/exceptions/facets', 'get', 'capability'],
    [getExceptionOperation, '/exceptions/{exceptionId}', 'get', 'capability'],
    [assignExceptionOperation, '/exceptions/{exceptionId}/assignment', 'put', 'capability'],
    /* G471's correspondence wave. ⚠️ AND THE TABLE CAUGHT THEM BEFORE THE ROWS
       ARRIVED, which is the first time this control has fired as designed:
       §3y went RED on the three mounts with the message above, so the
       "gains a case per operation" promise did not have to be remembered. */
    [listThreadsOperation, '/threads', 'get', 'capability'],
    [getThreadOperation, '/threads/{threadId}', 'get', 'capability'],
    [getMessageOperation, '/messages/{messageId}', 'get', 'capability'],
    /**
     * 🛑 G512's CONFERRAL, AND IT IS THE FIRST ROW IN THIS TABLE FOR AN
     * OPERATION THAT CREATES AUTHORITY RATHER THAN READING OR AMENDING IT.
     *
     * The mismatch this row exists to catch is worse here than anywhere above.
     * `grantRoleAssignment` mints its record BEFORE it writes, and
     * `db/migrations/0020`'s `role_assignment_grant_restrictive` reads that
     * record's `capability` column to decide whether to let the row through —
     * so a handler minting against the wrong verb would not merely write a
     * misleading audit row, it would be **refused by the database and 403 for
     * a reason no log could explain**, or, if the wrong verb happened to be
     * one the fence accepted, would confer authority under an act the gate
     * evaluated against a different capability entirely.
     */
    [grantRoleAssignmentOperation, '/people/{userId}/role-assignments', 'post', 'capability'],
    /**
     * 🛑 G656's RESOLUTION CHAIN — SIX ROWS ON **FOUR** DISTINCT CAPABILITIES,
     * WHICH IS THE WIDEST SPREAD IN THIS TABLE AND THEREFORE THE PLACE A
     * COPY-PASTE IS MOST LIKELY.
     *
     * Three reads carry `view_exception`; the three ACTS carry three different
     * verbs, and the separations are the design rather than a detail:
     * `propose_resolution` reaches `operator` alone, `approve_resolution`
     * reaches `approver` alone, and `execute_resolution` is *"the one that
     * moves money"* and is `[]` in `PARTNER_CAPABILITY_MASK`.
     *
     * ⚠️ AND THE CONSEQUENCE OF A MISMATCH IS `grantRoleAssignment`'s, twice
     * over: `db/migrations/0059`'s `resolution_proposal_insert_restrictive`
     * and `approval_decision_insert_restrictive` BOTH read the record's
     * `capability` column, and so does the `exception_resolution_requires_record`
     * trigger — so a handler minting against the wrong verb is refused by the
     * DATABASE, with a message no caller can act on. A mutation proved it:
     * pointing `proposeResolution` at `view_exception` turned
     * `tests/http/proposal-chain-served.test.ts` §2 red with a row-level-security
     * refusal, not with a 403.
     */
    [listAvailableDispositionsOperation, '/exceptions/{exceptionId}/dispositions', 'get', 'capability'],
    [listProposalsOperation, '/exceptions/{exceptionId}/proposals', 'get', 'capability'],
    [proposeResolutionOperation, '/exceptions/{exceptionId}/proposals', 'post', 'capability'],
    [getProposalOperation, '/proposals/{proposalId}', 'get', 'capability'],
    [decideApprovalOperation, '/proposals/{proposalId}/approvals', 'post', 'capability'],
    [executeProposalOperation, '/proposals/{proposalId}/execution', 'post', 'capability'],
    /**
     * 🛑 G691 AND G694's INTAKE WAVE — AND §3y CAUGHT THEM BEFORE THESE ROWS
     * ARRIVED, WHICH IS THE SECOND TIME THIS CONTROL HAS FIRED AS DESIGNED.
     * The mount landed, `npm run check` went RED here with §3y's own message,
     * and the rows were added in the same commit rather than in the one after
     * it. That is the whole difference between a table and the promise it
     * replaced.
     *
     * ⚠️ `admitRun` IS THE FIRST ROW HERE FOR A `post` THAT CREATES A ROW IN
     * `public.run`, and a mismatch on it is the shape a mutation pass
     * measured on 19 Sep 2026 and could not otherwise catch: changing
     * `admitRunOperation.capability` from `trigger_run` to `admit_source`
     * left EVERY assertion in `tests/http/intake-and-admission-served.test.ts`
     * green except the one that reads the stored record, **including §9, the
     * gate differential** — because the gate reads the DOCUMENT and never the
     * handler's field.
     */
    [listIntakeChannelsOperation, '/intake/channels', 'get', 'capability'],
    /**
     * ⚠️ **`admitRunOperation` IS A FACTORY SINCE 20 Sep 2026 — R-B — AND THIS
     * ROW CALLS IT WITH A PUBLISHER THAT IS NEVER REACHED.** `afterCommit`
     * runs only when an act COMMITS, and this table asks a question about the
     * operation's DECLARATION: what verb it mints against. Passing a
     * no-op keeps the row about that one question rather than about a queue.
     */
    [admitRunOperation(async () => undefined), '/runs', 'post', 'capability'],
    /**
     * 🛑 G946–G954's TWO MOUNTS — AND §3y CAUGHT THEM BEFORE THESE ROWS
     * ARRIVED, WHICH IS THE THIRD TIME THIS CONTROL HAS FIRED AS DESIGNED.
     * The mounts landed, `npm run check` went RED here with §3y's own
     * message, and the rows were added in the same commit.
     *
     * ⚠️ `reverseResolution` IS THE ROW WHERE A COPY-PASTE WOULD BE WORST IN
     * THIS WHOLE TABLE, and it would be worst SILENTLY. Its capability is
     * read by TWO database objects that `execute_resolution` also satisfies
     * in part: `db/migrations/0140` §3's
     * `exception_reversal_insert_restrictive` names `reverse_resolution`
     * exactly, and `0140` §4's trigger accepts `reverse_resolution` on the
     * CLEARING arm and `execute_resolution` on the writing one. **A handler
     * minting `execute_resolution` here would be refused by the policy at the
     * INSERT and would otherwise look like a working reversal** — which is
     * the `grantRoleAssignment` shape a third time.
     *
     * ⚠️ `getDispositionMix` IS A READ AND ITS CAPABILITY IS CONTESTED ON THE
     * CONTRACT'S OWN FACE — *"`view_dashboard` is the survey proposal and the
     * exposure is taken knowingly"*. This row does not settle that contest;
     * it requires the HANDLER to mint whatever the DOCUMENT gates on, so that
     * the day the contest is settled the two move together.
     */
    [reverseResolutionOperation, '/exceptions/{exceptionId}/reversals', 'post', 'capability'],
    /**
     * 🛑 G2401's CREDENTIAL BIND — AND §3y CAUGHT IT BEFORE THIS ROW ARRIVED,
     * WHICH IS THE FIFTH TIME THIS CONTROL HAS FIRED AS DESIGNED. The mount
     * landed, `npm run check` went RED here naming `bindEndpointCredential`,
     * and the row was added in the same commit.
     *
     * ⚠️ AND THIS ROW IS THE ONLY CONTROL ON THE MINTED VERB, MEASURED: a
     * mutation pointing `bindEndpointCredentialOperation.capability` at
     * `view_exception` left `tests/http/credential-binding-served.test.ts` §3
     * — the gate differential — GREEN, because the gate reads the DOCUMENT and
     * the viewer still lacked `bind_secret` there; only the lawful bind went
     * red, and for a reason no caller could read. `admitRun`'s shape again.
     * The factory is called with the unconfigured custody, which is never
     * reached: this table asks about the declaration.
     */
    [
      bindEndpointCredentialOperation(unconfiguredCredentialCustody()),
      '/endpoints/{endpointId}/credential',
      'put',
      'capability',
    ],
    /**
     * 🛑 C9's DECLARATION HALF — G2681–G2690. §3y caught all five before these
     * rows arrived, which is the control firing as designed. Each operation's
     * `capability` is the one its contract entry names; a mismatch is the
     * `admitRun` shape this table exists to catch.
     */
    [listEndpointsOperation, '/endpoints', 'get', 'capability'],
    /* C3-15, G3941 — §3y caught it before this row arrived. */
    [listDocumentTypesOperation, '/document-types', 'get', 'capability'],
    [declareEndpointOperation, '/endpoints', 'post', 'capability'],
    [stopEndpointOperation, '/endpoints/{endpointId}/stop', 'post', 'capability'],
    [resumeEndpointOperation, '/endpoints/{endpointId}/resume', 'post', 'capability'],
    [
      declareEndpointDocumentTypeOperation,
      '/endpoints/{endpointId}/document-types',
      'post',
      'capability',
    ],
    /* C9's PARKED PILE — G2831–G2840, applying G2692 (the owner's). */
    [listParkedArrivalsOperation, '/parked', 'get', 'capability'],
    [getParkedArrivalOperation, '/parked/{arrivalId}', 'get', 'capability'],
    [raiseParkedArrivalOperation, '/parked/{arrivalId}/escalation', 'post', 'capability'],
    [getDispositionMixOperation, '/reports/disposition-mix', 'get', 'capability'],
    /**
     * 🛑 G1241's CONSOLE MOUNT — AND §3y CAUGHT IT BEFORE THIS ROW ARRIVED,
     * WHICH IS THE FOURTH TIME THIS CONTROL HAS FIRED AS DESIGNED. The mount
     * landed, `npm run check` went RED here with §3y's own message naming
     * `listTenants`, and the row was added in the same commit.
     *
     * 🛑 **IT IS ALSO THE ROW THAT CHANGED THE TABLE'S SHAPE, AND THAT IS A
     * SECOND FINDING.** Every row above is `capability.openapi.yaml`'s, and
     * `annotationOf()` was hard-wired to that one document — so this row would
     * have failed with *"the capability tier no longer declares
     * `/staff/tenants`"*, a true sentence about the wrong question. §5.1: the
     * lookup was keyed on the tier this plane happened to serve rather than on
     * *whichever document declares this operation*. **The tier is a column
     * now**, so an eighth document is a row rather than a rewrite.
     *
     * ⚠️ AND THE CONSEQUENCE OF A MISMATCH IS DIFFERENT HERE FROM EVERY ROW
     * ABOVE: this operation's record goes to invariant 10's **SECOND HOME**
     * (`tenant.platform_authorization_grant`, G730), which no policy reads back
     * by capability — so a wrong verb would NOT be refused by the database the
     * way `proposeResolution`'s would. **It would simply be a console act
     * recorded under a verb nobody was gated on**, which is the audit row this
     * whole section exists to prevent, with the one backstop the others have
     * removed.
     */
    [listTenantsOperation(CONTROL_PLANE_STUB), '/staff/tenants', 'get', 'platformConsole'],
    /**
     * 🛑 **R8 AND R9's ONBOARDING PANEL — THE FIRST ROWS IN THIS TABLE FOR THE
     * `administration` TIER, AND §3y CAUGHT THEM BEFORE THEY ARRIVED, WHICH IS
     * THE FIFTH TIME THIS CONTROL HAS FIRED AS DESIGNED.** The three mounts
     * landed, `npm run check` went RED here with §3y's own message naming all
     * three, and the rows were added in the same commit.
     *
     * ⚠️ **ALL THREE MINT AGAINST ONE VERB, WHICH IS THE ONE SHAPE THIS TABLE
     * IS WEAKEST AGAINST AND IS WORTH SAYING OUT LOUD.** A copy-paste is most
     * likely where the verbs differ (G656's six rows on four capabilities);
     * here they are identical by RULING — R8 names `view_substrate` for all
     * three — so this table cannot catch a wrong verb among them, only a wrong
     * verb against the CONTRACT. **What would catch a mis-assignment is that
     * there is nothing to mis-assign.**
     *
     * 🛑 **AND TWO OF THEM WRITE, WHICH NO ROW ABOVE ON A CONSOLE TIER DOES.**
     * `listTenants`'s note records that a console act's record goes to
     * invariant 10's SECOND HOME, which no policy reads back by capability, so
     * a wrong verb there *"would simply be a console act recorded under a verb
     * nobody was gated on"*. **For these two the act also changes 1CloudHub's
     * own delivery record in the other database** — and `0030`'s append-only
     * trigger means the forced mark it leaves can never be amended or removed
     * by anybody. A record naming the wrong verb would therefore sit beside a
     * row nothing can correct.
     *
     * ⚠️ THE CONTROL-PLANE STUB THROWS ON EVERY CALL (G4318 retired the two pool stubs) FOR THE
     * REASON: §3 asserts over two fields and opens no database. A body that
     * genuinely needs one belongs in
     * `tests/http/onboarding-console-served.test.ts`, which provisions two.
     */
    [
      listOnboardingStepsOperation(CONTROL_PLANE_STUB),
      '/staff/tenants/{tenantId}/onboarding',
      'get',
      'administration',
    ],
    [
      completeOnboardingStepOperation(CONTROL_PLANE_STUB),
      '/staff/tenants/{tenantId}/onboarding/{stepKey}/completion',
      'post',
      'administration',
    ],
    [
      forceOnboardingStepOperation(CONTROL_PLANE_STUB),
      '/staff/tenants/{tenantId}/onboarding/{stepKey}/override',
      'post',
      'administration',
    ],
    /**
     * 🛑 **W5's FIVE, 1 Oct 2026 — AND §3y CAUGHT THEM BEFORE THESE ROWS
     * EXISTED, THE SIXTH TIME IT HAS FIRED AS DESIGNED.** The partner portal's
     * first mounts, on FIVE DIFFERENT verbs across three partner-only classes —
     * the shape this table catches best, unlike the onboarding three above. A
     * wrong verb here would record a portal act in invariant 10's THIRD home
     * under a verb nobody was gated on, and `0320`'s trigger would refuse it at
     * the row only if the actor's role did not carry the wrong verb either.
     */
    [listDealRegistrationsOperation(), '/partner/registrations', 'get', 'administration'],
    [submitDealRegistrationOperation(), '/partner/registrations', 'post', 'administration'],
    [getSandboxTenantOperation(), '/partner/sandbox', 'get', 'administration'],
    [requestSandboxTenantOperation(), '/partner/sandbox', 'post', 'administration'],
    [listPartnerPeopleOperation(), '/partner/people', 'get', 'administration'],
    /* G2801, 2 Oct 2026 — the owner's: mounted on `manage_partner_staff`. */
    [invitePartnerPersonOperation(), '/partner/invitations', 'post', 'administration'],
  ]

  /**
   * 🛑 G3961, 4 Oct 2026 — §3 IS RE-ARGUED RATHER THAN DELETED, BECAUSE THE GAP
   * IT GUARDED IS NOW CLOSED BY CONSTRUCTION AND THIS TABLE IS WHAT PROVES THE
   * CONSTRUCTION COVERS EVERY MOUNT.
   *
   * ⛔ What §3 asserted until this commit: `annotationOf(tier, path, method)
   * === op.capability` — the handler's own spelling against the document's.
   * **The handler's spelling is DELETED**: `authorisedHandler()` mints against
   * `gatedCapabilityOf(request)`, the same route config the gate reads, so a
   * record naming a verb other than the gated one is no longer a mistake a
   * person can make. The table stays, and asks the two questions that are left:
   * that no operation has grown a second spelling back, and that the verb the
   * DOCUMENT names is one the record can mint — which the eighth fence also
   * refuses at boot, and which this asks without booting.
   */
  for (const [op, urlPath, method, tier] of MOUNTED) {
    it(`3 · \`${op.operationId}\` carries no capability of its own — the contract's is the only spelling`, () => {
      assert.equal(
        Object.hasOwn(op, 'capability'),
        false,
        `\`${op.operationId}\` states its own capability again. G3961 deleted that second ` +
          'spelling: when it diverged from the contract every request answered a 403 the gate ' +
          'had already passed. The record mints against the verb the gate checked.',
      )
      const annotation = annotationOf(tier, urlPath, method)
      assert.equal(typeof annotation, 'string', `\`${urlPath}\` ${method} names no capability`)
    })
  }

  it('3z · every mounted operation\'s CONTRACT verb is one the model declares', () => {
    const members = Object.values(CAPABILITIES) as readonly string[]
    for (const [op, urlPath, method, tier] of MOUNTED) {
      const annotation = annotationOf(tier, urlPath, method)
      assert.ok(
        typeof annotation === 'string' && members.includes(annotation),
        `\`${op.operationId}\` is gated by its contract on \`${String(annotation)}\`, which is not ` +
          'in the closed set. The record mints against the contract verb and nothing else ' +
          "(G3961), so `mountTier()`'s eighth fence refuses to boot with it.",
      )
    }
  })

  it('3y · the table covers EVERY operation the data plane mounts, in both directions', () => {
    /* 🛑 THE CONTROL OVER THE TABLE ITSELF, which is the thing that went stale.
       `server/data-plane/start.ts` is read as TEXT rather than started, because
       starting it needs a database and this assertion must run without one. */
    const startSource = readFileSync(
      path.join(REPO_ROOT, 'server', 'data-plane', 'start.ts'),
      'utf8',
    )
    const mountedNames = [...startSource.matchAll(/^\s{8}(\w+): authorisedHandler\(/gm)].map(
      (m) => m[1],
    )
    assert.deepEqual(
      [...mountedNames].sort(),
      MOUNTED.map(([op]) => op.operationId).sort(),
      'the data plane mounts a gated operation this table does not list, or lists one it no ' +
        'longer mounts. The table is the only thing comparing a minted verb against the ' +
        'gated one, so an operation missing from it mints unchecked — which is exactly what ' +
        'happened to `getRunAccount` and `listRunResidue` between G300 and G357.',
    )
  })
})

/* ================================================================== *
 * §4–§8 · THE SERVED PATH, OVER A SOCKET.
 * ================================================================== */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_RECORD_SERVED_DB_NAME'] ?? runScopedName('reconcile_authorisation_served_test')

/**
 * ⚠️ THE DEV TOKEN IS DELETED FROM THE PROCESS, WHICH IS AN ASSERTION IN
 * DISGUISE — `tests/http/identity-substrate-served.test.ts` makes the same move
 * for the same reason. With `RECONCILE_LOCAL_TEST_AUTH` set, `resolveSessionReader()`
 * adds an arm that authenticates on a signed token and resolves NO SUBJECT, and
 * a plane running it could not mint for anybody. **This file starts the plane
 * with NO `authorise` and NO `substrate` option at all**, so it takes the
 * PRODUCTION authoriser and the PRODUCTION substrate reader: every record below
 * is minted from rows, through the door a deployed process comes through.
 */
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

const ACME_HOST = 'acme.ap-southeast-1.reconcile.invalid'
const GLOBEX_HOST = 'globex.ap-southeast-1.reconcile.invalid'

process.env['RECONCILE_SERVING_HOSTS'] =
  `${ACME_HOST}|ten_acme|ap-southeast-1|pooled|active,` +
  `${GLOBEX_HOST}|ten_globex|ap-southeast-1|pooled|active`

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const MEI = 'usr_ops_mei'
const DOOR = 'idc_acme_entra'
const ROLE = 'rol_ap_approver'
const ASSIGNMENT = 'ras_mei_approver'
const RUN = 'run_acme_1'

/** Present only in this file; the row stores `digestOfHandle()` of it. */
const HANDLE = 'sh_mei_0c4e1b7a93d54f2e81ab6c5d4e3f2019'

/* `probe` is taken above §1, before any suite is registered — G4061. Do not move it back here. */
const skip = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the served authorisation-record test', probe)

interface Response {
  readonly status: number
  readonly body: Record<string, unknown> | undefined
  readonly text: string
}

/**
 * `node:http` rather than `fetch`, for `tests/http/context-resolve.test.ts`'s
 * reason: undici derives the `Host` header from the URL on some paths, and
 * G180's binding check compares it against `Session.issuedHost` on every
 * request. A helper that quietly sent `127.0.0.1:<port>` would make every
 * response below a statement about a binding this file did not choose.
 */
function get(origin: string, urlPath: string): Promise<Response> {
  const url = new URL(origin)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path: urlPath,
        method: 'GET',
        headers: { Host: ACME_HOST, ...sessionCookie(HANDLE) },
      },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => {
          text += chunk
        })
        res.on('end', () => {
          let body: Record<string, unknown> | undefined
          try {
            const parsed: unknown = JSON.parse(text)
            body =
              typeof parsed === 'object' && parsed !== null
                ? (parsed as Record<string, unknown>)
                : undefined
          } catch {
            body = undefined
          }
          resolve({ status: res.statusCode ?? 0, body, text })
        })
      },
    )
    req.on('error', reject)
    req.end()
  })
}

async function asMigrator<T>(fn: (q: (sql: string, p?: readonly unknown[]) => Promise<{ rows: unknown[] }>) => Promise<T>): Promise<T> {
  const mig = await migratorClient()
  try {
    return await fn((sql, p = []) => mig.query(sql, p as unknown[]) as Promise<{ rows: unknown[] }>)
  } finally {
    await mig.end()
  }
}

/** Every authorisation record in the database, read with `BYPASSRLS`. */
async function allRecords(): Promise<Array<Record<string, unknown>>> {
  return asMigrator(async (q) => {
    const out = await q(
      'SELECT tenant_id, id, subject_user_id, capability, resource_type, resource_id,' +
        ' org_class, issued_at, expires_at FROM tenant.authorization_grant ORDER BY issued_at, id',
    )
    return out.rows as Array<Record<string, unknown>>
  })
}

async function viaOf(grantId: string): Promise<Array<Record<string, unknown>>> {
  return asMigrator(async (q) => {
    const out = await q(
      'SELECT seq, assignment_id, role_id, role_version FROM tenant.authorization_grant_via' +
        ' WHERE grant_id = $1 ORDER BY seq',
      [grantId],
    )
    return out.rows as Array<Record<string, unknown>>
  })
}

/**
 * A complete substrate and one run to read: a customer door, an active person,
 * a live role carrying `admit_source`, a live assignment pinned to its version,
 * and a session already bound to ACME and issued on ACME's host.
 */
async function seedComplete(): Promise<void> {
  const digest = digestOfHandle(HANDLE)
  assert.notEqual(digest, null, 'the fixture handle digested to nothing')

  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')
    await mig.query(
      /* The broker handle is required on an `oidc` door — G304/G305. Without
       * it the reader refuses `broker_unresolvable` and no record is minted,
       * which would make this suite green for the wrong reason. */
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES ($1, 'oidc', 'Acme Entra ID', 'customer', NULL, 'acc_acme',
               'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_TESTPOOL',
               'acme-entra', 'active')`,
      [DOOR],
    )
    await mig.query(
      `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
       VALUES ($1, 'mei@acme.invalid', 'Mei Tan', 'active', $2)`,
      [MEI, DOOR],
    )
    await mig.query(
      `INSERT INTO tenant.role
         (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
       VALUES ($1, $2, 'AP Approver', 'approver', 3, 'operator', 'pack', 'pck_ap', 'active')`,
      [ACME, ROLE],
    )
    await mig.query(
      `INSERT INTO tenant.role_capability (tenant_id, role_id, capability) VALUES ($1, $2, $3)`,
      [ACME, ROLE, CAPABILITIES.viewException /* G3801: run reads are view_exception */],
    )
    await mig.query(
      `INSERT INTO tenant.role_assignment
         (tenant_id, id, user_id, role_id, role_version,
          granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, 3, 'usr_acme_admin', now(), NULL, NULL)`,
      [ACME, ASSIGNMENT, MEI, ROLE],
    )
    await mig.query(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ('ses_mei', $1, $2, $3, $4, $5,
               now(), now(), now() + interval '12 hours', NULL)`,
      [digest, MEI, DOOR, ACME, ACME_HOST],
    )
    /*
     * 🛑 THE MEMBERSHIP ROW IS NOT DECORATION — G641, 19 Sep 2026.
     *
     * The session above is BOUND to a tenant, and a bound session is a state
     * only `selectTenantForSession()` can produce — which binds on a LIVE
     * membership (G199) or on a staff grant nothing here supplies. Since G641
     * the per-request path re-asks that question on EVERY request, through the
     * same `holdsLiveMembership()` the binding uses, because a membership that
     * lapses by the clock writes no statement and fires no trigger.
     *
     * **So a fixture that forges a bound session with no membership row forges
     * a state the product cannot reach**, and the plane now refuses it 401.
     * Adding the row is not weakening a witness; it is the fixture stopping
     * being impossible.
     */
    await mig.query(
      `INSERT INTO tenant.membership
         (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, 'mem_ar_mei', $2, 'rol_member', 'bootstrap', now(), NULL, NULL)
       ON CONFLICT DO NOTHING`,
      [ACME, MEI],
    )
    await mig.query(
      `INSERT INTO run
         (tenant_id, id, definition_id, definition_version, period_id, trigger_kind,
          status, inputs, started_at, finished_at, exceptions_raised)
       VALUES ($1, $2, 'def_ap', 1, NULL, 'manual', 'completed', NULL, now(), now(), 0)`,
      [ACME, RUN],
    )
    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

describe('a served read leaves a record of the authorisation it ran under', { skip }, () => {
  let plane: { url: string; close(): Promise<void> }

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seedComplete()
    /**
     * 🛑 NO OPTIONS BUT THE POOL. The default authoriser and the default
     * substrate reader are the ones both deployed entry points take.
     *
     * ⚠️ `poolMax: 1` IS ADVERSARIAL ON PURPOSE: the session scope, the tenant
     * scope and the handler's own read are forced onto the connection the
     * previous one released.
     */
    plane = await startDataPlane({ poolMax: 1 })
  })

  after(async () => {
    if (plane !== undefined) await plane.close()
  })

  /* ================================================================ *
   * §4 · THE BASELINE. Nothing is recorded before anything is served.
   * ================================================================ */

  it('4 · the table is EMPTY before the first request', async () => {
    /* Without this, §5 would pass against a fixture that seeded a record — and
     * the whole file would be asserting that a row exists rather than that a
     * request wrote one. */
    assert.deepEqual(await allRecords(), [])
  })

  /* ================================================================ *
   * §5 · THE PROPERTY. A served read MINTS.
   * ================================================================ */

  it('5a · `GET /v1/runs` is SERVED and writes one record naming the act', async () => {
    const res = await get(plane.url, '/v1/runs')
    assert.equal(
      res.status,
      200,
      `the gate refused a complete substrate (${res.status}: ${res.text}). Every assertion ` +
        'about the record is vacuous until this is green; see ' +
        '`tests/http/identity-substrate-served.test.ts` §1 for the chain to check.',
    )

    const records = await allRecords()
    assert.equal(
      records.length,
      1,
      `the served read wrote ${records.length} authorisation record(s). ONE request, ONE ` +
        'authorisation: "A grant that covered several would be a session." G301 makes ' +
        'minting a precondition of mounting precisely so this cannot be zero.',
    )
    const row = records[0] as Record<string, unknown>
    assert.equal(row['tenant_id'], ACME)
    assert.equal(row['subject_user_id'], MEI, 'the record must name the person who acted')
    /* G3801 opened run reads to view_exception (the role below holds it); G3881,
       the owner's G3802 ruling, names the operation `view_run`, CARRIED by it —
       and the record names the operation's verb, not the role's. */
    assert.equal(row['capability'], CAPABILITIES.viewRun)
    assert.equal(row['resource_type'], 'Run')
    assert.equal(
      row['resource_id'],
      null,
      '`listRuns` is not instance-bound — "opening a list" is the declaration\'s own example ' +
        '— so a null here is the honest value and an invented id would be a fabricated act.',
    )
    assert.equal(row['org_class'], 'customer', 'stamped from the DOOR, never re-derived')
  })

  it('5b · the record names the ASSIGNMENT, the ROLE and the PINNED role version', async () => {
    /**
     * 🛑 THIS IS THE FIELD G301 NAMES BY NAME: *"`Decision.via` now names the
     * `assignmentId`, the `roleId` and the pinned `roleVersion` — which is the
     * evidence an `AuthorizationGrant` would be minted FROM."* Before this
     * commit `via` was computed and thrown away, and `AuthorizationGrant.via`
     * says what that cost: *"`Decision.via` named the authority and joined to
     * nothing."*
     */
    const records = await allRecords()
    const id = String((records[0] as Record<string, unknown>)['id'])
    const via = await viaOf(id)
    assert.equal(via.length, 1, `the record carries ${via.length} via line(s); one assignment carried it`)
    assert.equal((via[0] as Record<string, unknown>)['assignment_id'], ASSIGNMENT)
    assert.equal((via[0] as Record<string, unknown>)['role_id'], ROLE)
    assert.equal(
      (via[0] as Record<string, unknown>)['role_version'],
      3,
      'the version that DECIDED, not the version the role carries now. §10.5 — a rollback ' +
        'reverts behaviour, never authority — is why the pin exists at all.',
    )
  })

  it('5c · a second, INSTANCE-BOUND read records the instance', async () => {
    const res = await get(plane.url, `/v1/runs/${RUN}`)
    assert.equal(res.status, 200, `getRun was refused (${res.status}: ${res.text})`)

    const records = await allRecords()
    assert.equal(records.length, 2, 'the second act did not leave its own record')
    const latest = records[1] as Record<string, unknown>
    assert.equal(
      latest['resource_id'],
      RUN,
      'the record must name WHAT was acted on. `redeemAuthorization()` binds RESOURCE for ' +
        'this reason — "otherwise an authorisation to view ONE document reads the tenant\'s ' +
        'whole corpus" — and an audit that stored no instance could not tell the two apart.',
    )
  })

  /* ================================================================ *
   * §6 · A DENIAL IS NOT AN AUTHORISATION.
   * ================================================================ */

  it('6 · a REFUSED request mints NOTHING', async () => {
    const before = (await allRecords()).length

    await asMigrator((q) =>
      q('UPDATE tenant.role_assignment SET revoked_at = now() WHERE id = $1', [ASSIGNMENT]),
    )
    const res = await get(plane.url, '/v1/runs')
    await asMigrator((q) =>
      q('UPDATE tenant.role_assignment SET revoked_at = NULL WHERE id = $1', [ASSIGNMENT]),
    )

    assert.equal(res.status, 403, `a revoked assignment was served ${res.status}: ${res.text}`)
    assert.equal(
      (await allRecords()).length,
      before,
      'A REFUSAL MINTED AN AUTHORISATION RECORD. A denial is not an authorisation: a row ' +
        'here would put a record of PERMISSION into an append-only table for an act that ' +
        'never happened — "an audit trail that reads as evidence and is not", which is the ' +
        'exact failure the tripwire this file replaces existed to prevent.',
    )
  })

  /* ================================================================ *
   * §7 · THE ACT AND THE RECORD FALL TOGETHER.
   * ================================================================ */

  it('7 · a read that FAILS leaves no record, because both are one transaction', async () => {
    /**
     * 🛑 THE TRIPWIRE DEMANDED THIS BY NAME: the record must be written *"inside
     * the same `withTenantScope()` transaction as the read, so a record cannot
     * outlive a rolled-back act."* Nothing else in the suite can tell a mint
     * that happens before the act from one that happens with it.
     *
     * ⚠️ THE ACT IS BROKEN BY RENAMING A COLUMN THE HANDLER SELECTS, which is
     * crude and is the only lever available: the read has no branch that throws
     * of its own accord, and an `unpublishable` row answers 500 WITHOUT throwing
     * — deliberately, because that act really did happen and its record should
     * stand. A statement-level SQL failure is the one thing that aborts the
     * transaction the record is sitting in.
     */
    const before = (await allRecords()).length
    let res: Response
    await asMigrator((q) => q('ALTER TABLE run RENAME COLUMN exceptions_raised TO exceptions_x'))
    try {
      res = await get(plane.url, '/v1/runs')
    } finally {
      await asMigrator((q) => q('ALTER TABLE run RENAME COLUMN exceptions_x TO exceptions_raised'))
    }

    assert.equal(
      res.status,
      500,
      `a broken read answered ${res.status}, so this test is not measuring a failed act`,
    )
    assert.equal(
      (await allRecords()).length,
      before,
      'A RECORD OUTLIVED THE ACT IT RECORDS. The row was written and the read then failed, ' +
        'and the row survived — so the mint is not inside the act\'s transaction. An audit ' +
        'trail carrying authorisations for acts that never happened is worse than one ' +
        'carrying none, because it reads as evidence.',
    )

    /* And the plane is unharmed: the next request is served normally. A 500 that
     * poisoned the pool would make every later assertion mean something else. */
    assert.equal((await get(plane.url, '/v1/runs')).status, 200)
  })

  /* ================================================================ *
   * §8 · WHAT IS RECORDED AND WHAT IS STILL NOT — G317 TURNED HALF OF THIS
   *      SECTION'S POLARITY, AND THE OTHER HALF IS STILL AN ABSENCE.
   * ================================================================ */

  /**
   * ═════════════════════════════════════════════════════════════════════════
   * 🛑 READ THE POLARITY OF §8 BEFORE READING IT, BECAUSE IT TURNED — G317,
   *    19 Sep 2026, AND THIS FILE IS DOING TO ITSELF WHAT IT DID TO THE
   *    TRIPWIRE IT REPLACED.
   * ═════════════════════════════════════════════════════════════════════════
   *
   * §8 WAS AN ASSERTION ABOUT AN ABSENCE — *"no ACCESS stream exists yet, and
   * this file refuses to imply one"* — and it required
   * `information_schema.tables` to hold no `audit_event`, no
   * `data_access_event` and no `usage_record`. Its own words named the day it
   * would fire and what that day owed:
   *
   *     "**When the ruling lands, this assertion is what goes red, and the
   *      commit that answers it owes positive assertions here in the same
   *      breath.**" … "an access/audit/usage stream now has a table … so the
   *      commit that lands one owes an assertion that the id is WRITTEN on it,
   *      and owes the ruling G301 reserved about which path writes which
   *      stream. **Do not delete this assertion to go green; replace it with
   *      the positive one.**"
   *
   * **IT FIRED, ON `db/migrations/0014_invariant_10_event_streams.sql`, WHICH
   * IS THE DAY IT WAS WRITTEN FOR.** The exact red, recorded so the turn is not
   * a claim about a run nobody kept:
   *
   *     AssertionError [ERR_ASSERTION]: an access/audit/usage stream now has a
   *     table (audit_event, data_access_event, usage_record) and this file
   *     still asserts it does not.
   *       + actual - expected
   *       + [ 'audit_event', 'data_access_event', 'usage_record' ]
   *       - []
   *
   * **BOTH THINGS IT DEMANDED ARE HERE.** The ruling is G317, which answers
   * *"which stream carries what"* by landing all three in ONE migration —
   * *"answering it three times across three commits is how two vocabularies
   * for one concept get started"*. The positive assertions are §8a and §8b
   * below, and the deeper ones are in `tests/db/event-streams.test.ts`, which
   * drives the store over a real PostgreSQL as the app role.
   *
   * ⚠️ AND THE HALF THAT IS STILL AN ABSENCE IS STILL ASSERTED AS ONE, IN §8b,
   * BECAUSE IT IS STILL TRUE. `CLAUDE.md`: *"a served read records THE
   * AUTHORISATION IT RAN UNDER and not THE ACCESS."* **That sentence survives
   * G317 and this file is where it is checked.** Nothing on a request path
   * writes any of the three, because their non-authorisation terms have no
   * producer — `DataAccessEvent.maxDataClass` above all, which invariant 4
   * forbids guessing.
   */

  it('8a · the three streams EXIST, and each carries the authorisation id', async () => {
    /**
     * 🛑 THE POSITIVE ASSERTION §8's OLD TEXT DEMANDED, AND IT ASSERTS THE
     * COLUMN RATHER THAN THE TABLE. A table named `audit_event` that did not
     * carry `authorization_id` would satisfy an existence check and defeat the
     * invariant: *"`AuditEvent`, `DataAccessEvent` and `UsageRecord` all carry
     * its id"* is the clause, and the id is the whole of it.
     */
    const carried = await asMigrator(async (q) => {
      const out = await q(
        `SELECT table_name FROM information_schema.columns
          WHERE table_schema = 'tenant'
            AND table_name IN ('audit_event', 'data_access_event', 'usage_record')
            AND column_name = 'authorization_id'
          ORDER BY table_name`,
      )
      return (out.rows as Array<Record<string, unknown>>).map((r) => String(r['table_name']))
    })
    assert.deepEqual(
      carried,
      ['audit_event', 'data_access_event', 'usage_record'],
      'one of invariant 10\'s three streams is missing, or exists and does not carry ' +
        '`authorization_id`. The invariant says all three carry it — "so who / what / cost ' +
        'is ONE query" — and a stream without the column is a stream that cannot join to ' +
        'the act it records. G317 lands the three together for exactly this reason.',
    )
  })

  it('8b · and NO ACCESS IS RECORDED YET — the served read still logs only its authority', async () => {
    /**
     * ⚠️ THE ABSENCE THAT SURVIVES, AND IT IS NARROWER THAN THE ONE THIS TEST
     * USED TO ASSERT. The tables exist; **they are empty, and nothing on the
     * served path fills them.** §5a and §5b above proved that a real request
     * mints an `AuthorizationGrant`; this proves that the SAME request leaves
     * no access-log entry, which is `CLAUDE.md`'s sentence made executable
     * instead of trusted.
     *
     * 🛑 WHY IT IS NOT MERELY UNBUILT. `DataAccessEvent.maxDataClass` is
     * *"Highest classification actually returned"* and nothing in this
     * repository computes one. Invariant 4 declares classification once on
     * `FieldSpec`; G106 rules that a key with no `FieldSpec` is UNREADABLE and
     * REFUSES the alternative — *"defaulting unmapped keys to the most
     * sensitive class … readable-by-default-with-a-high-bar is scope failing
     * OPEN."* A handler stamping a guessed class into an append-only,
     * hash-chained stream writes a false fact beyond amendment, which is the
     * tripwire's own *"an audit trail that reads as evidence and is not"*.
     *
     * **When a writer lands, THIS is what goes red, and the commit that
     * answers it owes the positive assertion here and a correction to
     * `CLAUDE.md`'s sentence in the same breath.** That is the same instruction
     * the assertion this one replaces carried, and it is repeated rather than
     * dropped because it worked.
     */
    assert.ok((await allRecords()).length > 0, 'no act has been served; §8b measures nothing')

    const populated = await asMigrator(async (q) => {
      const out = await q(
        `SELECT 'audit_event' AS t, count(*)::int AS n FROM tenant.audit_event
         UNION ALL SELECT 'data_access_event', count(*)::int FROM tenant.data_access_event
         UNION ALL SELECT 'usage_record', count(*)::int FROM tenant.usage_record`,
      )
      return (out.rows as Array<{ t: string; n: number }>)
        .filter((r) => r.n > 0)
        .map((r) => `${r.t}=${r.n}`)
    })
    assert.deepEqual(
      populated,
      [],
      `a served request wrote an event-stream row (${populated.join(', ')}) and this file ` +
        'still asserts none does. If that is intended, three things are owed in the same ' +
        'commit: a real producer for whichever terms it writes — `maxDataClass` must NOT be ' +
        'guessed — a sequence allocator for `RecordChain` (the canonicaliser exists, ' +
        '`model/canonical.ts`; the allocator does not), and a correction to `CLAUDE.md`\'s ' +
        'sentence that a served read "does not yet record THE ACCESS". Do not delete this ' +
        'assertion to go green; replace it with the positive one, which is exactly what §8a ' +
        'did to the assertion it replaced.',
    )
  })
})
