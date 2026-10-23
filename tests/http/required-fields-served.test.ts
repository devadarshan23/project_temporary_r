/**
 * K6 — EVERY MOUNTED OPERATION'S RESPONSE CARRIES EVERY `required` FIELD IT
 * DECLARES.
 *
 * `docs/build/completion-plan.md` §6 calls this *"the one known escape from the
 * producer analysis: a table under an unguessed name passes."* The producer
 * scan in `tests/http/console-roster-unreachable.test.ts` §5a asks whether a
 * `required` field COULD be produced. This asks whether it WAS.
 *
 * ┌─ THE MEASUREMENT EVERY OTHER SENTENCE HERE RESTS ON ───────────────────────┐
 * │ Four documents say `fast-json-stringify` *"serialises without validating"*. │
 * │ G1244 corrected half of that. BOTH are incomplete, and the correction      │
 * │ below was re-measured at the PINNED version — `fast-json-stringify@7.0.1`, │
 * │ reached through `fastify@5.12.5` — before this file was written:           │
 * │                                                                           │
 * │   a required property ABSENT          THROWS  -> 500 on every request      │
 * │     … at every depth: nested object, array item, and a `oneOf` arm         │
 * │   a required property ABSENT, with                                         │
 * │     a `default` in the schema         SILENT  -> the default is published  │
 * │   a required `string` given `null`    SILENT  -> published as `""`         │
 * │   a required property of the WRONG                                         │
 * │     type (42, {} for a string)        SILENT  -> coerced to "42",          │
 * │                                                 "[object Object]"          │
 * │   an UNDECLARED property present      SILENT  -> stripped                  │
 * │                                                                           │
 * │ 🛑 SO THE SERIALISER IS LOUD IN THE SUBTRACTIVE DIRECTION AND SILENT IN    │
 * │ THE ADDITIVE ONE — G1244's finding — **AND SILENT IN A THIRD DIRECTION NO  │
 * │ DOCUMENT HERE HAS NAMED: a required scalar given a WRONG VALUE is COERCED  │
 * │ rather than refused.** `null` on a required non-nullable `string` does not │
 * │ reach the wire as `null`; it reaches it as `""`. Every record of the       │
 * │ `0161` incident says `readExceptionQueuePage` published `"summary": null`  │
 * │ against a `required` string. At this version it would publish `""`.        │
 * │ The incident was real and the mechanism in the record is wrong twice over. │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 WHICH ARM DOES THIS CONTROL COVER? SAID PLAINLY, BECAUSE A CONTROL BUILT
 * ON THE WRONG MECHANISM CHECKS THE WRONG THING. **The SUBTRACTIVE one, and
 * only that one.** `required` is what the plan names and `required` is what
 * §5's instrument measures. The coercion arms are OUT OF SCOPE AND
 * UNREACHABLE FROM OUTSIDE ANYWAY: by the time a body is on the wire the
 * serialiser has already turned `null` into `""` and `42` into `"42"`, so a
 * black-box reader sees a well-formed value and cannot tell it was invented.
 * Closing those needs a validating serializer compiler, which is a change to
 * `server/`, not a test. **Named here so nobody reads a green run as evidence
 * about them.**
 *
 * ┌─ WHERE THIS LIVES, AND WHY IT IS NOT A CHECKER IN `tools/` ────────────────┐
 * │ The property is about a RESPONSE BODY. A response body needs a plane that  │
 * │ booted and, for all but one mounted operation, a PostgreSQL with rows in   │
 * │ it. G108 binds a gate stage to being deterministic, offline and fast, so a │
 * │ `tools/` checker that needed a database would have to either SKIP — which  │
 * │ `tests/reachability.ts` exists to forbid — or be red on every machine but  │
 * │ one. `tests/` already owns the mechanism that makes the absence cost an    │
 * │ exit code under `CI`, and `npm test` is itself a stage of `npm run check`, │
 * │ so this joins the gate WITHOUT adding a stage. That last point is not      │
 * │ incidental: the gate's stages are now pinned by an assertion, and adding   │
 * │ one is a visible act this control does not need to take.                   │
 * │                                                                           │
 * │ ⚠️ §2, §3 AND §4 NEED NO DATABASE and would be legal in `tools/`. They     │
 * │ stay here because splitting one control across two places puts its         │
 * │ denominator in two places, and a denominator is the thing this file is     │
 * │ most careful about.                                                       │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ ✅ THE FINDING BELOW IS CLOSED — G1681, 21 Sep 2026, THE OWNER'S ────────┐
 * │ *"Stop `$ref`-ing `errors.yaml` from success bodies. A success body       │
 * │ carries its own closed enum rather than pointing at the error taxonomy."* │
 * │ **The paragraphs below are CORRECTED RATHER THAN DELETED**, because they  │
 * │ are what a reader would have quoted onward and because every sentence in  │
 * │ them is still true of the MECHANISM — `bundle.ts` is NOT changed, and §3a │
 * │ re-breaks a copy of the document on every run to prove it.                │
 * │                                                                           │
 * │ **§2 now reads `28 of 28 mounted operations serialise; 0 do not`**, where │
 * │ it read `21 … 7 do not`. The repair is a local `ErrorCode` in each of the │
 * │ three documents that needed one, mirrored to `errors.yaml` in BOTH        │
 * │ directions and in ORDER by                                                │
 * │ `tests/contracts/success-body-error-codes.test.ts` §1.                    │
 * │                                                                           │
 * │ ⚠️ **AND ONE NUMBER IN THE PARAGRAPH BELOW WAS ALREADY WRONG WHEN IT WAS  │
 * │ WRITTEN: it says *"SEVEN of the twenty-nine"* and §1 measured TWENTY-EIGHT │
 * │ on the same run — 21 + 7. Nothing governs a number in a comment, so it    │
 * │ sat beside its own contradiction at EXIT 0.** Derive it, never read it:   │
 * │ §2's own console line prints both halves.                                 │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 WHAT IT FOUND, AND IT IS A LIVE FINDING REPORTED RATHER THAN FIXED.
 * **SEVEN of the twenty-nine mounted operations have NO RESPONSE SERIALISER AT
 * ALL on their success status.** `server/contract/bundle.ts` refuses an
 * external `$ref`, and these seven declare success bodies that transitively
 * reach `./errors.yaml#/components/schemas/ErrorCode` — legitimately, through
 * `blockedBy`, `unavailableFor` and `rejectedFor`, which reuse the closed
 * error enum as a REASON CODE INSIDE A SUCCESS BODY. `responseSchemas()` drops
 * the whole schema, `mountTier()` registers the route without one, and Fastify
 * falls back to `JSON.stringify`. For those seven, **the enforcement described
 * at the top of this file does not exist**: a missing `required` field is
 * published silently, an undeclared key is NOT stripped, and nothing anywhere
 * would notice.
 *
 * ⚠️ AND `RouteSpec.unwiredResponses` ALREADY CARRIED THE EVIDENCE, WITH NO
 * READER. Its own comment says it is *"carried rather than dropped so a boot
 * log can state what is unvalidated instead of implying everything is"* — and
 * `grep -rn 'unwiredResponses' server/ tests/` returns the declaration and
 * nothing else. §2 is its first reader.
 *
 * 🛑 THE REPAIR IS NOT THIS SLICE'S AND IT IS NOT ONE LINE. Three shapes are
 * possible and each is a ruling: teach `bundleSchema()` to inline `errors.yaml`
 * (it is a local file, so this is mechanical — but it widens what the ROUTER
 * will accept, and the refusal of external pointers is a stated property);
 * stop reusing `ErrorCode` inside success bodies (a contract change across
 * five schemas); or add a boot fence refusing to mount an operation whose
 * success response has no serialiser (which fails the data plane's boot today,
 * seven times). **A row recording a blocker as applied is the disagreement
 * G286 was ruled on**, so this file measures and names: **G1573 records the
 * census as built and G1574 records the repair as NOT TAKEN**, which is the
 * shape G881/G882 and G1130 use for the same distinction.
 *
 * ✅ **THE OWNER TOOK THE SECOND OF THOSE THREE ON 21 Sep 2026 AND G1574 IS
 * DISCHARGED.** It is the one that changes no code at all: `bundle.ts` keeps
 * its refusal (repair 1 refused by name in the ruling) and nothing gains a boot
 * fence (repair 3 untaken — it would still fail the boot, and now on zero
 * operations). ⚠️ **AND THE PARENTHETICAL ABOVE UNDERSTATED THE SECOND REPAIR:
 * it is FIVE SCHEMAS in `capability.openapi.yaml` and TEN `$ref` SITES ACROSS
 * THREE DOCUMENTS**, because `foundation` and `control-plane` reach the same
 * enum from success bodies AND request bodies. Derive it, never read it:
 * `tests/contracts/success-body-error-codes.test.ts` §2 walks all seven tiers.
 *
 * ⚠️ **AND IT FOUND NO LIVE VIOLATION AMONG THE FIFTEEN IT DROVE.** Every
 * success body §5 exercised — including all five of the unwired ones it can
 * reach — carried every `required` field its contract declares. **That is the
 * honest result and it is not the same as "the seven are fine": it means the
 * handlers are correct today and that nothing would notice if they stopped
 * being.** The stores under them refuse by column rather than publishing a
 * hole (`exception-store.ts`'s `unpublishable`, `correspondence-store.ts`'s
 * `bad()`), which is why — and that is a property of those files, not of the
 * serving layer.
 *
 * ✅ **AND SINCE G1681 IT IS A PROPERTY OF THE SERVING LAYER TOO, FOR THESE
 * SEVEN.** The sentence above is unchanged and still the honest framing of what
 * §5 measured; what moved is that a store which STOPPED refusing by column
 * would now meet a 500 from the serialiser rather than publishing a hole.
 * ⚠️ **THAT IS NOT THE SAME AS BEING CORRECT, AND THE DIFFERENCE IS MEASURED IN
 * THIS FILE'S OWN HEADER:** the serialiser is loud only in the SUBTRACTIVE
 * direction. A required `string` given `null` still reaches the wire as `""`,
 * and a wrong-typed value is still coerced — both silently, both invisible from
 * outside, and both now APPLYING to these seven where before nothing applied at
 * all. Serialising is not validating.
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { request as httpRequest } from 'node:http'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { digestOfHandle } from '../../server/data-plane/handle-digest.ts'
import { startDataPlane } from '../../server/data-plane/start.ts'
import { buildPlane, recordsAuthorisation } from '../../server/http/app.ts'
import { loadTier, basePathOf, type TierName } from '../../server/contract/document.ts'
import { routesOf } from '../../server/contract/routes.ts'
import { CAPABILITIES } from '../../model/access.ts'
import { sessionCookie } from './harness.ts'
import {
  declaredSuccesses,
  missingRequired,
  resolverFor,
  type SchemaNode,
} from './contract-shape.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE. `db/env.ts` resolves `RECONCILE_DB_NAME` per call and never
 * at import, and `node --test` runs files concurrently — two suites sharing one
 * database race inside `applyMigrations()` and fail for a reason neither chose.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] = runScopedName('reconcile_required_fields_served')

const ACME_HOST = 'acme.ap-southeast-1.reconcile.invalid'
const GLOBEX_HOST = 'globex.ap-southeast-1.reconcile.invalid'

process.env['RECONCILE_SERVING_HOSTS'] =
  `${ACME_HOST}|ten_acme|ap-southeast-1|pooled|active,` +
  `${GLOBEX_HOST}|ten_globex|ap-southeast-1|pooled|active`

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const DOOR = 'idc_acme_required_fields'
const MEI = 'usr_ops_mei'
const ROLE = 'rol_ap_operator'
const HANDLE = 'sx_k6_3d9f1a27c5b048e6812f7a4d0e63b95c'
const PACK = 'pck_ap'
const DEFINITION = 'def_ap_close'
const EXC = 'exc_acme_k6_0001'
const RUN = 'run_k6_0001'
const COUNTERPARTY = 'cpy_k6_vendor'
const THREAD = 'thr_k6_0001'
const MESSAGE = 'msg_k6_0001'

/**
 * THE TIERS EACH PLANE MOUNTS, read from the two `start.ts` files' `mounts()`
 * and used ONLY to decide which document §1 probes.
 *
 * ⚠️ THIS IS NOT THE MOUNTED SET AND MUST NOT BE READ AS ONE. §1 derives that
 * from a running listener. This names which DOCUMENTS to walk, and being wrong
 * about it can only make the denominator SMALLER — a tier left out contributes
 * no operations at all, which §1's own floor assertion would catch.
 */
const DATA_PLANE_TIERS: readonly TierName[] = [
  'capability',
  'platformConsole',
  'administration',
  'foundation',
  'dataPlaneLocal',
  /* NOT mounted by either plane — carried so §1 has real negative controls. */
  'session',
]

/* ------------------------------------------------------------------ *
 * REACHABILITY.
 * ------------------------------------------------------------------ */

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/http/required-fields-served.test.ts DID NOT RUN.',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS IS THE ONLY CONTROL ANYWHERE THAT VALIDATES A SERVED RESPONSE BODY',
      '   AGAINST THE SCHEMA THE CONTRACT DECLARES FOR IT. A run in which it',
      '   skipped is NOT evidence that any mounted operation publishes a complete',
      '   body, and NOT evidence about the seven that reach no serialiser at all.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the served required-field assertions', probe)

/* ------------------------------------------------------------------ *
 * A RAW HTTP CLIENT — `node:http` rather than `fetch`, because undici derives
 * the `Host` header from the URL on some paths and G180 compares it against
 * `Session.issuedHost` on EVERY request, revoking the session on a mismatch.
 * ------------------------------------------------------------------ */

interface Response {
  readonly status: number
  readonly body: unknown
  readonly text: string
}

function send(
  origin: string,
  method: string,
  path: string,
  opts: {
    host?: string
    body?: unknown
    session?: string | null
    idempotencyKey?: string
  } = {},
): Promise<Response> {
  const url = new URL(origin)
  const payload = opts.body === undefined ? undefined : JSON.stringify(opts.body)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path,
        method,
        headers: {
          Host: opts.host ?? ACME_HOST,
          ...(opts.session === null ? {} : sessionCookie(opts.session ?? HANDLE)),
          ...(opts.idempotencyKey === undefined
            ? {}
            : { 'Idempotency-Key': opts.idempotencyKey }),
          ...(payload === undefined
            ? {}
            : { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }),
        },
      },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => {
          text += chunk
        })
        res.on('end', () => {
          let body: unknown
          try {
            body = JSON.parse(text)
          } catch {
            body = undefined
          }
          resolve({ status: res.statusCode ?? 0, body, text })
        })
      },
    )
    req.on('error', reject)
    if (payload !== undefined) req.write(payload)
    req.end()
  })
}

/* ------------------------------------------------------------------ *
 * THE CONTRACT SIDE, DERIVED ONCE.
 * ------------------------------------------------------------------ */

interface Declared {
  readonly tier: TierName
  readonly operationId: string
  readonly method: string
  /** Fastify form with the prefix applied: `/v1/runs/:runId`. */
  readonly url: string
  readonly successStatus: string
  /** The declared success schema, UNBUNDLED — external `$ref`s intact. */
  readonly schema: SchemaNode | null
  /** The success schema Fastify actually serialises with, or `null`. */
  readonly serialiser: unknown
}

function declaredOperations(): readonly Declared[] {
  const out: Declared[] = []
  for (const tier of DATA_PLANE_TIERS) {
    const doc = loadTier(tier)
    const byId = new Map(declaredSuccesses(doc).map((d) => [d.operationId, d]))
    for (const route of routesOf(doc, basePathOf(doc))) {
      const success = byId.get(route.operationId)
      if (success === undefined) continue
      const wired = route.schema.response ?? {}
      const serialiserKey = Object.keys(wired).find((s) => s === success.status)
      out.push({
        tier,
        operationId: route.operationId,
        method: route.method,
        url: route.url,
        successStatus: success.status,
        schema: success.schema,
        serialiser: serialiserKey === undefined ? null : wired[serialiserKey],
      })
    }
  }
  return out
}

const DECLARED = declaredOperations()

/** `/v1/runs/:runId` → `/v1/runs/k6-probe`. */
function probePath(url: string): string {
  return url
    .split('/')
    .map((segment) => (segment.startsWith(':') ? 'k6-probe' : segment))
    .join('/')
}

/* ------------------------------------------------------------------ *
 * THE SEVEN. Named, with the measured reason, so an eighth is a RED.
 * ------------------------------------------------------------------ */

/**
 * MOUNTED, AND THEIR SUCCESS RESPONSE REACHES NO SERIALISER.
 *
 * 🛑 THIS IS A CENSUS OF A DEFECT, NOT AN ALLOW-LIST OF EXEMPTIONS. §2 asserts
 * SET EQUALITY in both directions: an eighth operation joining this class is a
 * red, and so is one of these seven being repaired without deleting its row.
 * Every entry is the SAME root cause, measured rather than assumed — the
 * success schema transitively `$ref`s `./errors.yaml`, which
 * `server/contract/bundle.ts` refuses — and the field it arrives through is
 * named so the repair has somewhere to start.
 *
 * ✅ **IT IS EMPTY SINCE 21 Sep 2026 — G1681, THE OWNER'S RULING — AND THE TEXT
 * ABOVE IS CORRECTED RATHER THAN DELETED, because it is what a reader would
 * have quoted onward and because every sentence in it is still true of the
 * DEFECT.** The ruling: *"Stop `$ref`-ing `errors.yaml` from success bodies. A
 * success body carries its own closed enum rather than pointing at the error
 * taxonomy."*
 *
 * 🛑 **THE CENSUS IS KEPT AS AN EMPTY MAP RATHER THAN RETIRED, BECAUSE THE
 * DEFECT IS STILL REACHABLE.** `server/contract/bundle.ts` still refuses an
 * external pointer — the ruling says in its own words that it is NOT changed —
 * so a success body that `$ref`s `./errors.yaml` again would mount with no
 * serialiser exactly as these seven did. **An eighth joining this class is
 * still a red**, and §3 keeps the captured RED runnable by re-breaking a copy
 * of the document in memory rather than narrating what used to happen.
 *
 * ⚠️ **WHAT THE REPAIR WAS, so the next reader does not re-derive it:** each of
 * the seven reached `./errors.yaml#/components/schemas/ErrorCode` through
 * `blockedBy`, `unavailableFor` or `rejectedFor`, and the fifteen pointers in
 * the corpus now name a LOCAL `#/components/schemas/ErrorCode`. The three
 * copies are held identical to `errors.yaml` — members AND order — by
 * `tests/contracts/success-body-error-codes.test.ts` §1, which is where the
 * cost of a second home for that vocabulary is paid.
 */
const NO_SUCCESS_SERIALISER: ReadonlyMap<string, string> = new Map([
  /* ✅ EMPTY SINCE 21 Sep 2026 — G1681, THE OWNER'S RULING — AND THE SEVEN ROWS
     ARE DELETED RATHER THAN COMMENTED OUT, which is what this file's own
     failure message instructed: *"If one LEFT, the repair is real and its row
     here should go with it, in the same commit."* All seven left, in one
     commit, and §2 below asserts the stronger positive form instead. */
  [
    'requestSandboxTenant',
    /* W5, 1 Oct 2026. NOT a body nothing checks — a body that DOES NOT EXIST. */
    'its success is `202 · Requested. A person provisions it.` with NO `content` declared, ' +
      'so there is no body, no schema, and no `required` field for a serialiser to enforce. ' +
      'The handler returns the empty string so the response leaves after the act commits. ' +
      'Every other W5 mount has a wired serialiser; `tests/http/partner-portal-served.test.ts` ' +
      '§3 drives the 202, the 409 and the 403.',
  ],
  [
    'signOut',
    /* G3004, 2 Oct 2026. Like `requestSandboxTenant`: a body that does not exist. */
    'its success is `204 · Revoked.` with NO `content` declared — a revoke and a withdrawn ' +
      'cookie, no body, no schema and no `required` field. `tests/http/sign-out-served.test.ts` ' +
      'drives the 204, the revoked row, the withdrawn cookie and the 401 after it.',
  ],
])

/**
 * MOUNTED AND NOT DRIVEN BY §5, each with the argument for holding it out.
 *
 * 🛑 EVERY ENTRY IS A HOLE IN THE EVIDENCE AND IS WRITTEN AS ONE. §5 asserts
 * that the driven set and this set PARTITION the mounted set exactly, so an
 * operation cannot fall out of the denominator by being forgotten — it has to
 * be named here, and naming it costs an argument.
 */
const NOT_DRIVEN: ReadonlyMap<string, string> = new Map([
  [
    'getSessionPrincipal',
    'G3354, 3 Oct 2026. For a BOUND session its body reads the tenant`s name out of the ' +
      'CONTROL database through the read-only console pool (G1161), and this suite provisions ' +
      'no control database — so driving it here would answer 500 for a reason that is about ' +
      'the fixture. `tests/http/session-principal-served.test.ts` provisions both databases ' +
      'and asserts the success body`s key set EXACTLY at both levels (`userId`, ' +
      '`displayName`, `email`, `orgClass`, `tenant`; `tenantId`, `name`) — every one ' +
      '`required` — for a bound and an unbound session. Its success schema IS wired.',
  ],
  [
    'signOut',
    'G3004, 2 Oct 2026. It has no success BODY to check (`NO_SUCCESS_SERIALISER`), and driving ' +
      'it here would REVOKE the one session every other section of this suite reads through. ' +
      '`tests/http/sign-out-served.test.ts` drives it against sessions of its own.',
  ],
  [
    'beginFederatedSignIn',
    'G2541, 1 Oct 2026. Its 200 needs an identity connection with an ' +
      '`authorization_endpoint`, a VERIFIED `tenant.domain_claim` on the domain, a ' +
      'registered serving host AND identity terms loaded at boot — without the last this ' +
      'plane answers 503 before anything is read, which is the arm this suite would ' +
      'reach. `tests/http/signin-begin-served.test.ts` owns that fixture, drives the 200, ' +
      'and §7 there asserts the success body`s key set EXACTLY (`authorizationUrl`, ' +
      '`codeVerifier`, `state` — every one `required`), so a second copy here is §5.3, ' +
      '`resolveHomeRealm`s argument one row down.',
  ],
  [
    'resolveHomeRealm',
    'needs a `tenant.identity_connection` AND a VERIFIED `tenant.domain_claim` row, both ' +
      'written by the migrator because `0220` grants the app role `SELECT` and nothing ' +
      'else. `tests/http/realm-served.test.ts` owns that fixture and drives every arm of ' +
      'it; a second copy here is §5.3, which is the argument `admitRun` and ' +
      '`getRunAccount` are held out on two rows below. ' +
      '⚠️ AND THE HOLD-OUT IS SAFE FOR THE SAME REASON AS THEIRS AND FOR ONE MORE: its ' +
      'success schema IS wired, so the serialiser enforces `required` on it at every ' +
      'request — and `RealmResolution`\'s required set is `{connectionId, protocol, ' +
      'brokerIssuer, brokerRef}`, every one of which is a NOT NULL column the reader ' +
      'selects by name, so there is no arm in which one can be absent. ' +
      '🛑 IT IS THE ONE MOUNTED OPERATION AN UNAUTHENTICATED CALLER CAN REACH, so if ' +
      'this hold-out is ever read as "less covered", read `tests/http/realm-served.test.ts` ' +
      'before believing it: that suite drives the 200 and all four refusals.',
  ],
  [
    'listEntitledPacks',
    'served by the CONTROL plane — a different process, a different database and a ' +
      'different config. `tests/http/control-plane-http.test.ts` owns that listener; ' +
      'standing a second one up here would put two control-plane fixtures in the tree.',
  ],
  [
    'admitRun',
    'needs an intake channel, an arrival, a source document, a definition, a period and ' +
      'a slot binding. `tests/http/slot-fill-served.test.ts` and ' +
      '`tests/http/intake-and-admission-served.test.ts` own that fixture; a third copy ' +
      'is §5.3. Its success schema IS wired, so the serialiser enforces `required` on it.',
  ],
  [
    'getRunAccount',
    'needs a persisted `SetReconciliationResult`, which only ' +
      '`persistRunEngineAccount()` writes. `tests/http/run-account-served.test.ts` owns ' +
      'that fixture. Its success schema IS wired.',
  ],
  [
    'listRunResidue',
    'the same fixture as `getRunAccount`, and held out for the same reason. Its success ' +
      'schema IS wired.',
  ],
  [
    'listRunAllocations',
    'R13 (G2374): the same persisted-result fixture as `getRunAccount`, held out for the ' +
      'same reason. `tests/http/run-allocations-served.test.ts` owns it and asserts the whole ' +
      '200 body with `deepEqual`, so every `required` field of `RunAllocation` is present by ' +
      'name. Its success schema IS wired.',
  ],
  [
    'executeProposal',
    'quorum is 2 and segregation of duties is on, so executing needs a second approver ' +
      'with a second session — `tests/http/proposal-chain-served.test.ts` §7–§9 owns that ' +
      'fixture. Its success schema IS wired.',
  ],
  [
    'reverseResolution',
    'needs an EXECUTED resolution, which needs the quorum fixture above. Its success ' +
      'schema IS wired.',
  ],
  [
    'getDispositionMix',
    'needs two settled exceptions in two resolution modes to produce a non-trivial row ' +
      'set; `tests/http/proposal-chain-served.test.ts` §12 owns it. Its success schema ' +
      'IS wired.',
  ],
  [
    'grantRoleAssignment',
    'writes a `tenant.role_assignment` row and would change the authority of the very ' +
      'session §5 drives every other operation with. Its success schema IS wired.',
  ],
  [
    'listTenants',
    'needs the CONTROL database provisioned and a PLATFORM session on a console host — ' +
      'a second registry, a second database and a different principal shape. ' +
      '`tests/http/console-roster-served.test.ts` owns it. Its success schema IS wired.',
  ],
  [
    'listOnboardingSteps',
    'the console fixture above, plus `migrations-control/0030`. ' +
      '`tests/http/onboarding-console-served.test.ts` owns it. Its success schema IS wired.',
  ],
  [
    'completeOnboardingStep',
    'the console fixture above, and it MUTATES onboarding state. Its success schema IS wired.',
  ],
  [
    'forceOnboardingStep',
    'the console fixture above, and its forced mark is APPEND-ONLY — a fixture that wrote ' +
      'one could not undo it. Its success schema IS wired.',
  ],
  ...[
    'listEndpoints',
    'declareEndpoint',
    'stopEndpoint',
    'resumeEndpoint',
    'declareEndpointDocumentType',
  ].map(
    (id) =>
      [
        id,
        'C9 (G2681): needs a document type, its field specs, a tenant key handle and a ' +
          'principal holding `configure_endpoint`/`view_endpoint`. ' +
          '`tests/http/sources-served.test.ts` owns that fixture and asserts EVERY `required` ' +
          'field of `SourceEndpoint` (both connection kinds) and `SourceDocumentTypePair` by ' +
          'name in §7 and §9; a second copy here is §5.3. Both success schemas ARE wired.',
      ] as const,
  ),
  [
    'listDocumentTypes',
    'C3-15 (G3941): needs document types in two tenants and a principal holding ' +
      '`view_endpoint` — `tests/http/sources-served.test.ts`\'s fixture. §10a there asserts ' +
      'each entry carries EXACTLY `documentTypeId`, `label` and `expectedFidelity`; a second ' +
      'copy here is §5.3. Its success schema IS wired.',
  ],
  ...['listParkedArrivals', 'getParkedArrival', 'raiseParkedArrival'].map(
    (id) =>
      [
        id,
        'C9 parked pile (G2831–G2840): needs a declared source, a parked arrival written ' +
          'through the classifying intake (which has no route — no connector reads a ' +
          'source), a held artefact and a principal holding `view_exception`/' +
          '`configure_endpoint`. `tests/http/parked-pile-served.test.ts` owns that fixture ' +
          'and asserts EVERY `required` field of `ParkedArrival`, `ParkedArrivalPane`, ' +
          '`ParkedEscalation` and `DeclaredSourceDocumentTypePair` by name; a second copy ' +
          'here is §5.3. All three success schemas ARE wired.',
      ] as const,
  ),
  [
    'bindEndpointCredential',
    'needs a `tenant.endpoint` row, a `tenant.tenant_key_handle` row and a principal ' +
      'holding `bind_secret`, and it WRITES a credential through a store this fixture has ' +
      'not substituted — the unconfigured store answers 500 by design. ' +
      '`tests/http/credential-binding-served.test.ts` owns that fixture and drives the 200, ' +
      'the rotation, the 403, the 404 and the refusals; a second copy here is §5.3. Its ' +
      'success schema IS wired, and its three required fields are a parameter echoed, a ' +
      '`RETURNING` column and a boolean computed in the handler, so none can be absent.',
  ],
  /* W5, 1 Oct 2026 — the partner portal's five. One fixture owns them all: two
     partner FIRMS with portal roles, tenant-less sessions on the partners host,
     and a console registry this file does not stand up. */
  ...[
    'listDealRegistrations',
    'submitDealRegistration',
    'getSandboxTenant',
    'requestSandboxTenant',
    'listPartnerPeople',
    /* G2801, 2 Oct 2026: the sixth. Its 201 is `InvitedPartnerPerson`, and
       partner-portal-served §4b asserts every one of its `required` fields. */
    'invitePartnerPerson',
  ].map(
    (id) =>
      [
        id,
        'needs two partner FIRMS with portal roles (`0250`), tenant-less sessions on a ' +
          'registered PARTNERS console host, and invariant 10’s third home (`0320`) — a ' +
          'different principal shape from every one this fixture builds. ' +
          '`tests/http/partner-portal-served.test.ts` owns it and checks every success body ' +
          'against the document’s OWN `required` lists (`DealRegistrationReceipt`, ' +
          '`DealRegistrationSummary`, `PartnerPerson`). Its success schema IS wired, except ' +
          '`requestSandboxTenant`, which declares no body at all.',
      ] as const,
  ),
  [
    'assignException',
    'the one mounted write whose success schema is wired AND whose fixture §5 already ' +
      'has; it is held out because `tests/http/exception-served.test.ts` §7 drives it to ' +
      '200 three times, and a fourth caller mutating `assigned_to` mid-suite would make ' +
      "§5's `getException` assertion depend on statement order.",
  ],
])

/* ------------------------------------------------------------------ *
 * THE FIXTURE.
 * ------------------------------------------------------------------ */

async function seedSubstrate(): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')

    await mig.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES ($1, 'oidc', 'Acme Entra ID', 'customer', NULL, 'acc_acme',
               'https://login.microsoftonline.com/acme-k6/v2.0', 'acme-entra-k6', 'active')`,
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
       VALUES ($1, $2, 'AP Operator', 'operator', 1, 'operator', 'pack', $3, 'active')`,
      [ACME, ROLE, PACK],
    )

    /* THE VERBS §5 DRIVES WITH, AND NO MORE — each derived from the contract
       rather than guessed: `grep -A1 'operationId: listRuns' docs/contracts/`.
       `view_exception` is the register's and the chain's reads; `view_document`
       is correspondence's; `admit_source` is `listRuns` and
       `listIntakeChannels`; `propose_resolution` and `approve_resolution` are
       the two chain writes §5 reaches.

       🛑 `execute_resolution`, `reverse_resolution`, `view_dashboard` AND
       `manage_roles` ARE DELIBERATELY ABSENT. Each is the verb of an operation
       `NOT_DRIVEN` holds out, and a fixture holding a verb nothing exercises is
       an invitation to exercise it — at which point the hold-out's argument
       quietly stops being true and nobody has to notice. */
    for (const capability of [
      CAPABILITIES.viewException,
      CAPABILITIES.viewDocument,
      CAPABILITIES.admitSource,
      CAPABILITIES.proposeResolution,
      CAPABILITIES.approveResolution,
    ]) {
      await mig.query(
        'INSERT INTO tenant.role_capability (tenant_id, role_id, capability) VALUES ($1, $2, $3)',
        [ACME, ROLE, capability],
      )
    }

    await mig.query(
      `INSERT INTO tenant.role_assignment
         (tenant_id, id, user_id, role_id, role_version, granted_by, granted_at,
          expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, 1, 'usr_acme_admin', now(), NULL, NULL)`,
      [ACME, `ras_${MEI}`, MEI, ROLE],
    )

    const digest = digestOfHandle(HANDLE)
    assert.notEqual(digest, null, 'a fixture handle digested to nothing')
    await mig.query(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, $5, $6, now(), now(), now() + interval '12 hours', NULL)`,
      [`ses_${MEI}`, digest, MEI, DOOR, ACME, ACME_HOST],
    )

    /**
     * 🛑 THE MEMBERSHIP ROW IS NOT DECORATION — G641. A bound session is a state
     * only `selectTenantForSession()` can produce, and since G641 the
     * per-request path re-asks that question on EVERY request. A fixture that
     * forges a bound session with no membership forges a state the product
     * cannot reach, and the plane answers it 401.
     */
    await mig.query(
      `INSERT INTO tenant.membership
         (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, $2, $3, 'rol_member', 'bootstrap', now(), NULL, NULL)`,
      [ACME, `mem_${MEI}`, MEI],
    )

    await mig.query(
      `INSERT INTO tenant.exception
         (tenant_id, id, match_group_id, rule_id, rule_version, definition_version,
          domain, definition_id, rule_label, severity, severity_rank,
          value_at_risk_currency, value_at_risk_minor, value_at_risk_exponent,
          cost_centre, legal_entity, status, assigned_to, raised_at,
          explanation_summary, explanation_expected, explanation_confidence)
       VALUES ($1, $2, 'mg_1', 'rul_1', 1, 1,
               'finance', $3, 'Three-way match', 'critical', 0,
               'SGD', 90000, 2,
               'CC-1100', 'LE-SG', 'open', NULL, now(),
               'the invoice disagrees with the purchase order', 'the purchase order', 0.91)`,
      [ACME, EXC, DEFINITION],
    )
    await mig.query(
      `INSERT INTO tenant.definition_archetype (tenant_id, definition_id, archetype, pack_key)
       VALUES ($1, $2, 'n_way_document_match', $3)`,
      [ACME, DEFINITION, PACK],
    )
    await mig.query(
      `INSERT INTO tenant.approval_config
         (tenant_id, quorum, mandatory_at_or_above, segregation_of_duties)
       VALUES ($1, 2, 'critical', true)`,
      [ACME],
    )
    for (const [key, label, family, reversibility, terminal, adj] of [
      ['write_off', 'Write off', 'charge_variance', 'irreversible', true, false],
      ['price_correction', 'Correct the price', 'price_variance', 'reversible', true, true],
    ] as const) {
      await mig.query(
        `INSERT INTO tenant.disposition
           (tenant_id, pack_key, key, label, family, reversibility, terminal, requires_adjustment)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [ACME, PACK, key, label, family, reversibility, terminal, adj],
      )
    }

    /* ONE RUN, so `getRun` has a row to read. `listRuns` needs none — an empty
       page is a complete body — which is exactly the asymmetry that makes a
       by-id read worth driving separately. */
    await mig.query(
      `INSERT INTO run
         (tenant_id, id, definition_id, definition_version, period_id, trigger_kind,
          status, inputs, started_at, finished_at, exceptions_raised)
       VALUES ($1, $2, $3, 1, NULL, 'manual', 'completed', '{}'::jsonb,
               now() - interval '1 hour', now(), 1)`,
      [ACME, RUN, DEFINITION],
    )

    /* CORRESPONDENCE — the two remaining operations of the seven. */
    await mig.query(
      `INSERT INTO tenant.counterparty (tenant_id, id, display_name)
       VALUES ($1, $2, 'Northwind Supplies')`,
      [ACME, COUNTERPARTY],
    )
    await mig.query(
      `INSERT INTO tenant.correspondence_thread
         (tenant_id, id, counterparty_id, subject, channel, status, opened_at, last_message_at)
       VALUES ($1, $2, $3, 'Invoice INV-4471 disagrees with PO-9902', 'email', 'open',
               now(), now())`,
      [ACME, THREAD, COUNTERPARTY],
    )
    await mig.query(
      `INSERT INTO tenant.correspondence_thread_exception (tenant_id, thread_id, exception_id)
       VALUES ($1, $2, $3)`,
      [ACME, THREAD, EXC],
    )
    await mig.query(
      `INSERT INTO tenant.correspondence_message
         (tenant_id, id, thread_id, direction, channel, trust, at, body_ref, data_class,
          attachment_refs, admitted_as_evidence_at)
       VALUES ($1, $2, $3, 'inbound', 'email', 'untrusted_inbound', now(),
               's3://bodies/msg_k6_0001', 'internal', ARRAY[]::text[], NULL)`,
      [ACME, MESSAGE, THREAD],
    )

    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

/* ================================================================== *
 * THE SUITE.
 * ================================================================== */

describe('every mounted operation carries every required field it declares', { skip }, () => {
  let plane: { url: string; close(): Promise<void> }
  /** operationId → registered on the data plane's listener. */
  const registered = new Map<string, boolean>()
  let proposalId = ''

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seedSubstrate()
    /* NO OPTIONS BUT THE POOL — the production authoriser and the production
     * substrate reader, which is what makes a 200 here mean anything. */
    plane = await startDataPlane({ poolMax: 4 })
  })

  after(async () => {
    if (plane !== undefined) await plane.close()
  })

  /* ================================================================ *
   * §1 · THE DENOMINATOR — WHICH OPERATIONS ARE MOUNTED, DERIVED.
   * ================================================================ */

  it('1 · the mounted set is derived from a live listener, never transcribed', async () => {
    /**
     * 🛑 THE PROPERTY IS *"the router registered this operation"*, AND THE
     * PROBE MEASURES EXACTLY THAT RATHER THAN A LANDMARK. `grep -rn 'handlers:'
     * server/*␟/start.ts` is the derivation four documents give and it is a
     * landmark: it counts object keys in two files and would answer the same if
     * `mountTier()` dropped every one of them on the floor. What is asked here
     * instead is what a caller would ask — the declared method on the declared
     * path — with NO CREDENTIAL, so that:
     *
     *   NOT REGISTERED  -> 404 from the router, before any hook runs
     *   REGISTERED      -> 401 from the `onRequest` authenticator, or, for the
     *                      two unsecured operations, their own answer
     *
     * ⚠️ THE ORDER IS WHAT MAKES IT CLEAN, and it is `server/http/app.ts`'s:
     * authentication is `onRequest` and the gate is `preValidation`, so a
     * secured route answers 401 before its handler, its validator or its
     * capability check can produce a confusable status. A probe carrying a
     * session would instead reach handlers and get 404s of the OTHER kind —
     * "no such row" — which is the collision this design avoids by sending
     * nothing.
     */
    const duplicates = new Map<string, string[]>()
    for (const d of DECLARED) {
      const key = `${d.method} ${probePath(d.url)}`
      duplicates.set(key, [...(duplicates.get(key) ?? []), d.operationId])
    }
    for (const [key, ids] of duplicates) {
      assert.equal(
        ids.length,
        1,
        `two declared operations share the concrete route \`${key}\` — ${ids.join(', ')}. ` +
          'The probe below cannot tell which of them a non-404 belongs to, so this ' +
          'derivation would silently credit one operation with another one`s mount. ' +
          'Three tiers share the `/v1` prefix and nothing prevents a collision.',
      )
    }

    for (const d of DECLARED) {
      const res = await send(plane.url, d.method, probePath(d.url), { session: null })
      registered.set(d.operationId, res.status !== 404)
    }

    const mounted = [...registered].filter(([, on]) => on).map(([id]) => id)
    const dark = [...registered].filter(([, on]) => !on).length

    /* ANTI-VACUITY, BOTH WAYS. A probe that found everything registered would
     * be measuring "the server answered"; one that found nothing would be
     * measuring "the server is down". Both floors are asserted. */
    assert.ok(
      mounted.length > 0,
      'NO declared operation was registered. This suite then asserts nothing about ' +
        'anything, which is §5.6 — a control whose subject is empty reporting an ' +
        'all-clear. The plane booted; the probe found no route.',
    )
    assert.ok(
      dark > 0,
      'EVERY declared operation answered something other than 404, including the four ' +
        '`session` tier operations no plane mounts. The probe is not discriminating and ' +
        'its answer is not a mounted set.',
    )

    console.error(
      `\n  K6 §1 · data plane: ${mounted.length} of ${DECLARED.length} declared ` +
        `operations registered; ${dark} answered the router's 404.`,
    )

    /**
     * ⚠️ THE CONTROL PLANE'S ONE MOUNT IS NOT IN THIS NUMBER, and that is the
     * one place this derivation is narrower than the grep it replaces.
     * `listEntitledPacks` is served by a different process against a different
     * database; `NOT_DRIVEN` names it and says so.
     */
    assert.ok(
      !registered.get('listEntitledPacks'),
      '`listEntitledPacks` answered something other than 404 on the DATA plane. It is a ' +
        'control-plane operation, and the two planes sharing a listener would be a much ' +
        'larger finding than this file`s — invariant 3 is a topology claim.',
    )
  })

  /* ================================================================ *
   * §2 · IS THERE ANYTHING ENFORCING `required` AT ALL?
   * ================================================================ */

  it('2 · EVERY mounted operation reaches a response serialiser — the census, now empty', () => {
    const missingSerialiser = DECLARED.filter(
      (d) => registered.get(d.operationId) === true && d.serialiser === null,
    ).map((d) => d.operationId)

    assert.deepEqual(
      [...missingSerialiser].sort(),
      [...NO_SUCCESS_SERIALISER.keys()].sort(),
      'THE SET OF MOUNTED OPERATIONS WITH NO SUCCESS SERIALISER HAS CHANGED.\n' +
        `  measured: ${[...missingSerialiser].sort().join(', ') || '(none)'}\n` +
        `  recorded: ${[...NO_SUCCESS_SERIALISER.keys()].sort().join(', ')}\n` +
        'If an operation JOINED this set, a mount landed whose body nothing checks — ' +
        'the `required` enforcement described at the top of this file does not exist ' +
        'for it, and the commit that mounted it owes an argument. If one LEFT, the ' +
        'repair is real and its row here should go with it, in the same commit.',
    )

    /* AND THE POSITIVE FORM, WHICH IS WHAT G1681 BOUGHT AND WHICH THE
     * SET-EQUALITY ASSERTION ABOVE CANNOT SAY ON ITS OWN.
     *
     * 🛑 AN EMPTY CENSUS COMPARED AGAINST AN EMPTY MEASUREMENT IS GREEN ON A
     * TREE WHERE NOTHING IS MOUNTED AT ALL — the shape this file spends §1
     * guarding against. So the claim is stated the other way round: the number
     * of mounted operations that reach a serialiser EQUALS the number mounted,
     * and that number is floored. */
    const wired = DECLARED.filter(
      (d) => registered.get(d.operationId) === true && d.serialiser !== null,
    )
    const mounted = DECLARED.filter((d) => registered.get(d.operationId) === true)

    /* ⚠️ MINUS THE RECORDED ROWS — since W5 one, since G3004 two:
     * `requestSandboxTenant` and `signOut` declare no success body, so there
     * is nothing for a serialiser to reach. */
    assert.equal(
      wired.length,
      mounted.length - NO_SUCCESS_SERIALISER.size,
      `${String(mounted.length - wired.length)} of ${String(mounted.length)} mounted ` +
        'operations publish a success body that reaches NO serialiser. Fastify falls ' +
        'back to `JSON.stringify` for those routes: a missing `required` field is ' +
        'published silently, an undeclared key is not stripped, and nothing anywhere ' +
        'would notice. The cause is almost always a success schema that transitively ' +
        '`$ref`s `./errors.yaml`, which `server/contract/bundle.ts` refuses by design — ' +
        'see `tests/contracts/success-body-error-codes.test.ts` §2, which catches it ' +
        'one layer earlier and without a database.',
    )

    assert.ok(
      mounted.length > 20,
      `only ${String(mounted.length)} operations are mounted, so the equality above is ` +
        'about a set too small to mean anything. §1 derives the mounted set from a live ' +
        'listener; if it has collapsed, fix that before reading this as green.',
    )

    console.error(
      `  K6 §2 · ${String(wired.length)} of ${String(mounted.length)} mounted operations ` +
        'serialise their success body; 0 do not. ' +
        `(Was 21 of 28 with 7 unwired, until G1681 on 21 Sep 2026.)`,
    )
  })

  /* ================================================================ *
   * §3 · THE MATCHED PAIR — THE RED, CAPTURED AGAINST A REAL PLANE.
   * ================================================================ */

  it('3 · BOTH operations now REFUSE an incomplete body, and the old RED is kept runnable', async () => {
    /**
     * 🛑 THE ONE ASSERTION IN THIS FILE THAT PROVES THE OTHERS MEAN SOMETHING.
     * §2 says seven operations reach no serialiser. On its own that is a claim
     * about a data structure. THIS drives the same deliberately incomplete body
     * through two REAL routes of the REAL capability document and shows the two
     * outcomes differ — which is the difference §2 is counting.
     *
     * ⚠️ NO DATABASE. `buildPlane()` registers routes and runs every fence, and
     * the handlers here are stubs: what is under test is the SERIALISER WIRING,
     * which is a property of the document and the router, not of any store.
     *
     * ⚠️ `recordsAuthorisation()` IS REQUIRED AND IS NOT A CONVENIENCE — G301's
     * sixth fence refuses to boot a gated operation whose entry is a bare
     * handler, and both of these are gated. The wrapper is a marker; it mints
     * nothing, which is why this is not evidence about invariant 10.
     */
    const hole = { exceptionId: 'exc_1' } /* every other `required` field absent */

    const app = await buildPlane<{ id: string }>(
      {
        plane: 'k6-probe-plane',
        authenticate: () => ({ id: 'probe' }),
        unauthenticatedDetail: 'no session',
        authorise: () => 'held',
        unauthorisedDetail: 'no capability',
      },
      [
        {
          tier: 'capability',
          handlers: {
            /* WIRED — `Exception` bundles, because nothing under it reaches
               `errors.yaml`. */
            getException: recordsAuthorisation(async () => hole),
            /* UNWIRED — `Proposal.execution.blockedBy[]` is an `ErrorCode`. */
            getProposal: recordsAuthorisation(async () => hole),
          },
        },
      ],
    )

    try {
      const wired = await app.inject({ method: 'GET', url: '/v1/exceptions/exc_1' })
      const unwired = await app.inject({ method: 'GET', url: '/v1/proposals/prp_1' })

      assert.equal(
        wired.statusCode,
        500,
        'A WIRED OPERATION PUBLISHED A BODY MISSING ITS OWN `required` FIELDS.\n' +
          `  got ${wired.statusCode}: ${wired.body.slice(0, 300)}\n` +
          'At `fast-json-stringify@7.0.1` an absent required property THROWS, and ' +
          'Fastify turns that into a 500. If this is a 200, either the serialiser ' +
          'stopped enforcing `required` — in which case the ONLY runtime enforcement ' +
          'in this repository is gone and every other section here is vacuous — or ' +
          '`Exception` stopped being wired, which §2 would also have caught.',
      )

      /* 🛑 THE ASSERTION THAT FLIPPED, AND THE RED IT REPLACES IS QUOTED RATHER
       * THAN DELETED. Until 21 Sep 2026 this read `assert.equal(unwired
       * .statusCode, 200, ...)` and its failure message said: *"THE UNWIRED
       * OPERATION DID NOT PUBLISH THE INCOMPLETE BODY. This is the GOOD
       * direction and it still fails the suite, because it means `getProposal`
       * gained a serialiser and `NO_SUCCESS_SERIALISER` is stale. Delete its row
       * there, in the commit that repaired it."* **G1681 is that commit.** The
       * captured red, run against this file's own base:
       *   `K6 §3 · RED captured: getProposal published 200 with 7 required
       *    fields absent — proposalId, proposedBy, dispositionKey, rationale,
       *    evidence, proposedAt, execution.` */
      assert.equal(
        unwired.statusCode,
        500,
        'THE REPAIRED OPERATION PUBLISHED AN INCOMPLETE BODY.\n' +
          `  got ${unwired.statusCode}: ${unwired.body.slice(0, 300)}\n` +
          'A 200 here means `getProposal` has lost its response serialiser again — its ' +
          'success body reaches `./errors.yaml` once more, `bundleSchema()` throws, and ' +
          'Fastify is back to `JSON.stringify`. That is K6`s original finding returning. ' +
          '`tests/contracts/success-body-error-codes.test.ts` §2 names the pointer.',
      )

      console.error(
        '  K6 §3 · both `getException` and `getProposal` answered 500 on the same ' +
          'incomplete body. Until G1681 the second answered 200 with 7 required fields ' +
          'absent.',
      )
    } finally {
      await app.close()
    }
  })

  it('3a · the captured RED, kept runnable: re-break the document and the serialiser goes', () => {
    /**
     * 🛑 THE DEFECT G1681 REMOVED IS STILL REACHABLE, AND A REPAIR THAT LEFT NO
     * RUNNABLE WITNESS WOULD BE INDISTINGUISHABLE FROM ONE THAT DELETED THE
     * MECHANISM. `server/contract/bundle.ts` is NOT changed — the ruling says
     * so in its own words — so this re-points ONE pointer back at
     * `./errors.yaml` in an IN-MEMORY COPY of the capability document and shows
     * the response schema disappear at the router layer, which is exactly where
     * the seven lost theirs.
     *
     * ⚠️ NOTHING ON DISK IS TOUCHED and no plane is booted: `routesOf()` takes a
     * document, so the whole red is a function of a value.
     */
    const pristine = loadTier('capability')
    const broken = JSON.parse(JSON.stringify(pristine)) as typeof pristine

    /* `ProposalExecution.blockedBy[]` — the field four of the seven arrived
       through. Re-point it and nothing else. */
    const schemas = (broken as Record<string, Record<string, Record<string, unknown>>>)[
      'components'
    ]?.['schemas'] as Record<string, Record<string, unknown>> | undefined
    const execution = schemas?.['ProposalExecution'] as
      | { properties?: { blockedBy?: { items?: Record<string, unknown> } } }
      | undefined
    const items = execution?.properties?.blockedBy?.items
    assert.ok(
      items !== undefined,
      '`ProposalExecution.properties.blockedBy.items` did not resolve, so this red is ' +
        'pointed at nothing. The schema moved or was renamed — re-derive it rather than ' +
        'editing this path to something that resolves.',
    )
    assert.equal(
      items['$ref'],
      '#/components/schemas/ErrorCode',
      'the pristine document does not carry the LOCAL pointer G1681 installed, so this ' +
        'test would be re-breaking something already broken.',
    )
    items['$ref'] = './errors.yaml#/components/schemas/ErrorCode'

    const serialiserFor = (doc: typeof pristine): unknown => {
      const route = routesOf(doc, basePathOf(doc)).find((r) => r.operationId === 'getProposal')
      assert.ok(route !== undefined, '`getProposal` is not a route of the capability document')
      return (route.schema.response ?? {})['200']
    }

    assert.ok(
      serialiserFor(pristine) !== undefined,
      'THE REAL DOCUMENT GIVES `getProposal` NO 200 SERIALISER. That is the defect ' +
        'itself, not this control — see §2.',
    )
    assert.equal(
      serialiserFor(broken),
      undefined,
      'RE-POINTING `blockedBy[]` AT `./errors.yaml` DID NOT REMOVE THE SERIALISER.\n' +
        'Either `bundleSchema()` has learned to resolve an external pointer — which the ' +
        '21 Sep 2026 ruling says it must not, and which would silently widen what the ' +
        'ROUTER accepts — or `responseSchemas()` no longer drops a schema it cannot ' +
        'bundle, in which case it is dropping something else instead. Both are larger ' +
        'findings than this assertion.',
    )

    console.error(
      '  K6 §3a · the pristine document wires `getProposal`; one re-pointed `$ref` ' +
        'un-wires it. The bundler`s refusal is intact and G1681 removed the pointer, ' +
        'not the mechanism.',
    )
  })

  /* ================================================================ *
   * §4 · THE INSTRUMENT, RED IN BOTH DIRECTIONS.
   * ================================================================ */

  it('4 · the required-field walker finds a real gap and does not invent one', () => {
    /**
     * 🛑 §5's ONLY OUTPUT IS "NOTHING MISSING", AND A BROKEN INSTRUMENT SAYS
     * THAT TOO. This is the anti-vacuity guard for the measuring device
     * itself — the shape `tests/http/token-verify.test.ts` §4c uses so a suite
     * cannot record defeating an attack it never mounted.
     */
    const resolve = resolverFor(loadTier('capability'))
    const exception = declaredFor('getException')

    const complete = {
      exceptionId: 'e',
      matchGroupId: 'm',
      ruleId: 'r',
      ruleVersion: 1,
      definitionVersion: 1,
      explanation: { summary: 's', observed: [], expected: 'x', delta: null, confidence: null },
      domain: 'finance',
      definitionId: 'd',
      ruleLabel: 'l',
      severity: 'critical',
      severityRank: 0,
      valueAtRisk: null,
      costCentre: 'cc',
      legalEntity: 'le',
      status: 'open',
      assignedTo: null,
      assignedToName: null /* G3886 — required and nullable */,
      assignedToFormerMember: false /* G4021 — required */,
      raisedAt: '2026-09-21T00:00:00Z',
      runId: null,
      resolution: null,
      reversals: [],
    }

    assert.deepEqual(
      missingRequired(complete, exception, resolve),
      [],
      'THE INSTRUMENT REPORTED A GAP IN A COMPLETE BODY. Every §5 assertion then ' +
        'fails for a reason that is about this walker rather than about the product, ' +
        'and a real gap would be indistinguishable from the noise.',
    )

    /* NULL IS CARRIED. The contract declares `type: [T, 'null']` in several
     * places and `fast-json-stringify` publishes null happily; an instrument
     * that called null "missing" would report a violation the document permits. */
    assert.deepEqual(
      missingRequired({ ...complete, assignedTo: null }, exception, resolve),
      [],
      'the instrument treated an explicit `null` as an absent property.',
    )

    /* AND IT FINDS A REAL ONE, at the top level and one level down. */
    const { explanation: _dropped, ...noExplanation } = complete
    assert.deepEqual(
      missingRequired(noExplanation, exception, resolve).map((g) => g.property),
      ['explanation'],
      'the instrument did not notice an absent top-level `required` property.',
    )

    const nested = {
      ...complete,
      explanation: { observed: [], expected: 'x', delta: null, confidence: null },
    }
    const nestedGaps = missingRequired(nested, exception, resolve)
    assert.deepEqual(
      nestedGaps.map((g) => `${g.at}.${g.property}`),
      ['explanation.summary'],
      'THE INSTRUMENT IS SHALLOW. `fast-json-stringify` enforces `required` at every ' +
        'depth — measured: a nested object, an array item and a `oneOf` arm all throw — ' +
        'so a walker that only reads the top level would pass §5 while the serialiser ' +
        'was catching things it could not see.',
    )

    /* EVERY POINTER IN THE CORPUS RESOLVES. An unresolved `$ref` makes the
     * walker find no `required` and report nothing, which is fail-QUIET and is
     * the wrong direction for a control. */
    for (const tier of DATA_PLANE_TIERS) {
      const doc = loadTier(tier)
      const r = resolverFor(doc)
      for (const declared of declaredSuccesses(doc)) {
        if (declared.schema === null) continue
        missingRequired({}, declared.schema, r)
      }
      assert.deepEqual(
        [...new Set(r.unresolvedRefs())],
        [],
        `\`${tier}\` carries a \`$ref\` form the instrument cannot follow. The walker ` +
          'then silently finds no `required` below it, so §5 would pass over whatever ' +
          'that pointer names. A third pointer form is a change to `contract-shape.ts`.',
      )
    }
  })

  /* ================================================================ *
   * §5 · THE DRIVEN HALF — REAL BODIES, OVER A REAL DATABASE.
   * ================================================================ */

  it('5 · every driven success body carries every required field it declares', async () => {
    /**
     * 🛑 ONE RESOLVER PER TIER, NEVER ONE FOR ALL OF THEM. A `#/components/
     * schemas/…` pointer means a different thing in each document, so resolving
     * `resolveTenantContext`'s `TenantContext` against `capability.openapi.yaml`
     * finds nothing, the walker then sees no `required` below it, and §5 passes
     * over the whole body. **Fail-quiet, and the first draft of this section did
     * exactly that** — it is caught here by `unresolvedRefs()` rather than left
     * to be noticed, which is why that method exists.
     */
    const resolvers = new Map(DATA_PLANE_TIERS.map((t) => [t, resolverFor(loadTier(t))]))
    const resolverOf = (operationId: string) => {
      const tier = DECLARED.find((d) => d.operationId === operationId)?.tier
      const found = tier === undefined ? undefined : resolvers.get(tier)
      assert.notEqual(found, undefined, `no resolver for \`${operationId}\``)
      return found as ReturnType<typeof resolverFor>
    }

    const exercised: string[] = []
    const violations: string[] = []

    const check = (operationId: string, status: number, body: unknown, expected: number): void => {
      assert.equal(
        status,
        expected,
        `\`${operationId}\` did not reach its success status — got ${status}: ` +
          `${JSON.stringify(body).slice(0, 300)}. §5 asserts nothing about an operation ` +
          'it could not drive, so this is a fixture failure and not a finding.',
      )
      const gaps = missingRequired(body, declaredFor(operationId), resolverOf(operationId))
      exercised.push(operationId)
      if (gaps.length > 0) {
        violations.push(
          `${operationId}: ${gaps.map((g) => `${g.at}.${g.property}`).join(', ')}`,
        )
      }
    }

    /* --- the register, WIRED: the serialiser would have thrown first. ----- */
    const list = await send(plane.url, 'GET', '/v1/exceptions?limit=10')
    check('listExceptions', list.status, list.body, 200)

    const facets = await send(plane.url, 'GET', '/v1/exceptions/facets')
    check('getExceptionFacets', facets.status, facets.body, 200)

    const one = await send(plane.url, 'GET', `/v1/exceptions/${EXC}`)
    check('getException', one.status, one.body, 200)

    const runs = await send(plane.url, 'GET', '/v1/runs?limit=10')
    check('listRuns', runs.status, runs.body, 200)

    const run = await send(plane.url, 'GET', `/v1/runs/${RUN}`)
    check('getRun', run.status, run.body, 200)

    const channels = await send(plane.url, 'GET', '/v1/intake/channels')
    check('listIntakeChannels', channels.status, channels.body, 200)

    /* --- THE TWO OPERATIONS THAT ARE NOT ON THE CAPABILITY TIER. ---------- */

    /* `checkLocalHealth` is the one mounted operation with NO `security` at
       all, so it is driven with NO session — and its declared 200 carries no
       `required` at all, which makes it the ONE case where a green assertion
       here is genuinely vacuous. Driven anyway, because the alternative is a
       hold-out row saying "there is nothing to check", and an operation absent
       from the denominator is worse than one present and trivial. */
    const health = await send(plane.url, 'GET', '/health', { session: null })
    check('checkLocalHealth', health.status, health.body, 200)

    /* D1. The handle travels in the COOKIE and nowhere else since G3006 —
       the body is a closed empty object — and the response is
       `TenantContext`, whose four `required` keys are the reason
       `db/migrations/0006` exists. */
    const context = await send(plane.url, 'POST', '/context/resolve', {
      body: {},
    })
    check('resolveTenantContext', context.status, context.body, 200)

    /* --- THE SEVEN, UNWIRED: nothing but this assertion looks at these. --- */
    const dispositions = await send(plane.url, 'GET', `/v1/exceptions/${EXC}/dispositions`)
    check('listAvailableDispositions', dispositions.status, dispositions.body, 200)

    const threads = await send(plane.url, 'GET', '/v1/threads')
    check('listThreads', threads.status, threads.body, 200)

    const thread = await send(plane.url, 'GET', `/v1/threads/${THREAD}`)
    check('getThread', thread.status, thread.body, 200)

    const message = await send(plane.url, 'GET', `/v1/messages/${MESSAGE}`)
    check('getMessage', message.status, message.body, 200)

    /* ⚠️ `Idempotency-Key` IS A HEADER AND NOT A BODY FIELD, and the body
       schema is `additionalProperties: false` — so the obvious spelling is a
       400 from ajv rather than an ignored key. That is G941's rule arriving on
       a request body: rejected, never stripped. */
    const created = await send(plane.url, 'POST', `/v1/exceptions/${EXC}/proposals`, {
      idempotencyKey: 'k6-propose-0001',
      body: {
        dispositionKey: 'write_off',
        rationale: 'the vendor credited the difference and the PO is correct',
        evidence: [{ kind: 'document', ref: 'doc_k6_0001' }],
      },
    })
    check('proposeResolution', created.status, created.body, 201)
    const createdBody = created.body as { proposalId?: unknown } | undefined
    proposalId = typeof createdBody?.proposalId === 'string' ? createdBody.proposalId : ''
    assert.notEqual(proposalId, '', 'the created proposal carried no `proposalId` to read back')

    const proposals = await send(plane.url, 'GET', `/v1/exceptions/${EXC}/proposals`)
    check('listProposals', proposals.status, proposals.body, 200)

    const proposal = await send(plane.url, 'GET', `/v1/proposals/${proposalId}`)
    check('getProposal', proposal.status, proposal.body, 200)

    /**
     * ⚠️ `decideApproval` IS DRIVEN BY THE PROPOSER AND IS REFUSED, SO ITS
     * SUCCESS BODY IS NOT EXERCISED. It is driven anyway, because reaching the
     * refusal proves the gate ADMITTED the caller — she holds
     * `approve_resolution` — and that the refusal is the model's rather than
     * the gate's. The body assertion is held out and `NOT_DRIVEN` records it.
     *
     * 🛑 IT IS A 403 AND NOT A 409, AND THE FIRST DRAFT OF THIS ASSERTION
     * EXPECTED A 409 AND WENT RED. The expectation came from
     * `model/approval.ts`'s header — *"A refusal here is a 409, never a 403 —
     * the caller is permitted and the THING is not ready"* — and that sentence
     * is about READINESS blockers. Segregation of duties is not one: the
     * contract names `approval_segregation_violation` under `403` explicitly,
     * beside `policy_denied`, because it IS a fact about this actor. **The
     * server is right and the reading of that header was wrong**; recorded here
     * rather than silently corrected, because the same misreading is one a
     * reader of `CLAUDE.md`'s quotation of that line would make.
     */
    const approval = await send(plane.url, 'POST', `/v1/proposals/${proposalId}/approvals`, {
      idempotencyKey: 'k6-approve-0001',
      body: { decision: 'approved' },
    })
    assert.equal(
      approval.status,
      403,
      'the PROPOSER approved her own proposal, or was refused for another reason. ' +
        '`docs/contracts/capability.openapi.yaml` declares ' +
        '`approval_segregation_violation` under 403 for exactly this act and the fixture ' +
        `sets \`segregation_of_duties = true\`. Got ${approval.status}: ` +
        `${JSON.stringify(approval.body).slice(0, 200)}`,
    )
    assert.equal(
      (approval.body as { code?: unknown } | undefined)?.code,
      'approval_segregation_violation',
      'the 403 is not the segregation refusal. A `capability_not_held` here would mean ' +
        'the fixture lost `approve_resolution` and this assertion is measuring the GATE ' +
        'rather than the four-eyes rule — which would make it pass for the wrong reason.',
    )

    /* --- THE DENOMINATOR. ------------------------------------------------- */
    const mounted = [...registered].filter(([, on]) => on).map(([id]) => id)
    const accountedFor = new Set([...exercised, ...NOT_DRIVEN.keys(), 'decideApproval'])
    const unaccounted = mounted.filter((id) => !accountedFor.has(id))

    assert.deepEqual(
      unaccounted,
      [],
      'A MOUNTED OPERATION IS NEITHER DRIVEN NOR HELD OUT BY NAME: ' +
        `${unaccounted.join(', ')}.\n` +
        'An operation must not fall out of this control`s denominator by being ' +
        'forgotten. Drive it, or add a row to `NOT_DRIVEN` with the argument for not ' +
        'driving it — the cost of the hold-out is that somebody has to write down why.',
    )

    assert.ok(
      exercised.length >= 12,
      `§5 exercised only ${exercised.length} operations. It is written to cover all ` +
        'SEVEN with no serialiser plus a wired control group; a smaller number means ' +
        'the fixture stopped reaching something and the suite is quietly narrowing.',
    )

    /* ⚠️ THE HELD-OUT FIGURE IS COUNTED AGAINST THE MOUNTED SET AND NOT AGAINST
       `NOT_DRIVEN.size`. One of its rows — `listEntitledPacks` — names an
       operation the CONTROL plane mounts, which §1's probe correctly never
       finds on this listener, so `NOT_DRIVEN.size` overstates the hold-out by
       one against this denominator. Reporting the map's size would be a true
       number answering a question nobody asked. */
    const heldOutHere = mounted.filter((id) => NOT_DRIVEN.has(id)).length
    console.error(
      `  K6 §5 · exercised ${exercised.length} of ${mounted.length} mounted operations ` +
        `(${heldOutHere} held out by name, 1 reached only its 403).\n` +
        `      driven: ${exercised.join(', ')}\n` +
        `      held out: ${mounted.filter((id) => NOT_DRIVEN.has(id)).join(', ')}\n` +
        `      + listEntitledPacks, held out and mounted by the CONTROL plane.`,
    )

    assert.deepEqual(
      violations,
      [],
      'A SERVED SUCCESS BODY IS MISSING A `required` FIELD ITS CONTRACT DECLARES:\n' +
        violations.map((v) => `      ${v}`).join('\n') +
        '\nIf the operation is one of the seven in `NO_SUCCESS_SERIALISER`, nothing else ' +
        'in this repository would have caught it — no serialiser runs on its body. ' +
        'Fixing it may need a table, a ruling or a contract change; reporting it is ' +
        'this control`s job and the fix is not necessarily the same commit.',
    )
  })
})

/* ------------------------------------------------------------------ *
 * The declared success schema for an operationId, or a loud failure.
 * ------------------------------------------------------------------ */

function declaredFor(operationId: string): SchemaNode {
  const found = DECLARED.find((d) => d.operationId === operationId)
  assert.notEqual(found, undefined, `\`${operationId}\` is declared by no tier this file walks`)
  const schema = found?.schema ?? null
  assert.notEqual(
    schema,
    null,
    `\`${operationId}\` declares a success response with no \`application/json\` schema. ` +
      'The instrument would then find no `required` and report nothing — fail-quiet, ' +
      'which is the wrong direction for a control.',
  )
  return schema as SchemaNode
}
