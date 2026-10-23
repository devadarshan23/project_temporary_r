/**
 * A1 · WHICH DOOR TO TRY — `POST /session/realm` (`resolveHomeRealm`).
 * **G1941, 22 Sep 2026, THE OWNER'S RULING.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS IS THE FIRST UNAUTHENTICATED PERSON-FACING OPERATION THIS PRODUCT
 *    HAS EVER SERVED, AND THAT SENTENCE IS THE REASON EVERY PARAGRAPH BELOW
 *    IS HERE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `checkLocalHealth` does not count and the difference is not pedantry:
 * `data-plane-local.openapi.yaml` declares no security scheme, so `callerOf()`
 * answers `none`, and its callers are *"ALBs and scrapers"* — **nobody is on
 * the other end.** Here somebody is, they have presented nothing, and they are
 * a person typing an address into a form.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 G165/D6 — AND THIS IS A **DEPARTURE**, NOT AN INTERPRETATION. G1941 IS
 *    THE OWNER'S.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * G165 reads: *"THE D6 THREAT-MODEL GATE LANDS BEFORE THE FIRST
 * UNAUTHENTICATED ENDPOINT."* **This is that endpoint and D6 is not written.**
 *
 * `docs/contracts/session.openapi.yaml` records the reading under which
 * declaring this tier did not trip G165 — *"its text … is about SHIPPING a
 * public surface, and nothing here ships: G200 keeps it unserved"* — and
 * **that reading expires at this commit.** What replaces it is G248's
 * treatment, applied to a NEW surface and therefore owed a NEW row rather than
 * inherited: G248 fenced itself in as many words, *"DO NOT READ THIS ROW AS
 * AMENDING G165 GENERALLY. It rules one issue."*
 *
 * **THE REJECTED ALTERNATIVE IS *WRITE D6 FIRST*, AND ITS COST IS NAMED
 * RATHER THAN WAVED PAST:** the marketing plane's `/lookup` is the only way a
 * person reaches this product at all, so gating it on an unwritten document
 * leaves the whole sign-in path unreachable for as long as that document is
 * unwritten — which is a schedule, not a control. **THE MITIGATION G248
 * ATTACHES BINDS HERE UNCHANGED AND IS QUOTED SO IT CANNOT BE SOFTENED:**
 *
 *     "a threat model written after the surface it covers must be allowed to
 *      change the surface, or it is documentation rather than a control."
 *
 * So nothing in this file may be defended on the grounds that it already
 * shipped. The first question D6 is pointed at is named on the operation
 * itself and is repeated below at the refusal map.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 G300's THREE PARTS, DERIVED WITH THE COMMANDS RATHER THAN ASSERTED,
 *    BECAUSE THE RULING'S OWN INSTRUCTION IS THAT *"A TABLE ALONE IS THE
 *    TRAP."*
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   TABLE       `tenant.domain_claim` × `tenant.identity_connection`,
 *               `db/migrations/0220_domain_claim.sql` and
 *               `db/migrations/0009_identity_substrate.sql`, both `SELECT`-only
 *               to the app role. **0170 is owed to this commit BY NAME** —
 *               0009: *"The commit that builds federated sign-in owns the
 *               `domain_claim` table, in the same commit as the router that
 *               reads it."* Derive:
 *               `grep -c 'GRANT SELECT ON tenant.domain_claim' db/migrations/0220_domain_claim.sql`
 *   MODEL       `routeToConnection()`, `mayRouteToConnection()` and
 *               `normaliseClaimedDomain()` in `model/domain.ts`, and all three
 *               are CALLED rather than imported for their vocabulary. Derive:
 *               `grep -rln 'export function routeToConnection' model/`
 *   CAPABILITY  **NONE, AND THAT IS THE THIRD PART ANSWERED RATHER THAN
 *               SKIPPED.** The operation carries
 *               `x-capability: 'exempt: …'` and the reason is on the
 *               operation: *"no human principal and no tenant — this operation
 *               runs BEFORE any authentication, so `decide()` has no
 *               `PrincipalContext` to build and no `tenantId` to evaluate a
 *               capability in."* G300's test asks whether a capability is
 *               REAL; for an exempt operation the same question is whether the
 *               exemption is real, and `PrincipalContext` requires a
 *               `tenantId` this caller provably has not got. Derive:
 *               `grep -n 'resolveHomeRealm' -A 2 docs/contracts/session.openapi.yaml`
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE ENUMERATION ORACLE IS DELIBERATE. DO NOT CLOSE IT; DO NOT WIDEN IT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The contract's own words, quoted rather than summarised because a summary of
 * this paragraph is how it gets closed by somebody being helpful:
 *
 *     "⚠️ WHAT THIS DOES *NOT* CLOSE, STATED HERE RATHER THAN LEFT TO BE
 *      FOUND. A 200 for a claimed domain and a 422 for an unclaimed one is a
 *      DOMAIN-existence signal. It is a weaker leak than user existence and it
 *      is a real one. It is not invented away, because collapsing the four
 *      arms on the wire would depart from the model this tier exists to mirror
 *      — `routeToConnection()` returns them distinctly and does so with an
 *      argument (`domain_not_verified` is #221's own red, and ambiguity is
 *      counted over verified claims only so that an unverified claim cannot
 *      take a tenant's sign-in down). THIS IS THE FIRST QUESTION FOR THE D6
 *      THREAT MODEL G165 IS STILL OWED."
 *
 * And the property that IS closed, which is the larger one and is STRUCTURAL:
 *
 *     "🛑 THIS OPERATION RETURNS NO USER-EXISTENCE SIGNAL, AND THE PROPERTY IS
 *      STRUCTURAL RATHER THAN PROMISED. It is never GIVEN a user to look up.
 *      The request admits exactly `domain` … so two addresses at one domain are
 *      ONE REQUEST and identical responses are a consequence of the shape
 *      rather than an observation about one implementation."
 *
 * **Nothing in this file may take an email address, split one, or log one.**
 * The schema is `additionalProperties: false` and ajv runs with
 * `removeAdditional: false` (G191), so a smuggled `email` field is REJECTED
 * rather than stripped — and this handler reads exactly one key.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE OPEN D6 REGISTER — FIVE QUESTIONS, ALL **OPEN**. G1990, 22 Sep 2026.
 *
 *    ⚠️ **THIS BLOCK REPLACED ONE THAT NAMED A SINGLE QUESTION** (*"NO RATE
 *    LIMIT … that is the second question for D6"*), **AND NAMING ONE WAS THE
 *    DEFECT**: G248's mitigation binds this surface — *"a threat model
 *    written after the surface it covers must be allowed to change the
 *    surface"* — and a threat model can only change what somebody wrote
 *    down. A register with one entry reads as a surface with one problem.
 *    The old entry survives WHOLE as (4) below.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **(1) WHAT EACH REFUSAL DISCLOSES ABOUT A THIRD PARTY'S IDENTITY
 *      CONFIGURATION.** The contract names the 200-versus-422 domain-existence
 *      signal and stops there. **Three of the four 422s say more than
 *      *"no door"*, and each says it about somebody who is not the caller:**
 *
 *        `domain_not_verified`
 *            Somebody registered this domain and never proved it. That is an
 *            organisation **mid-onboarding, or abandoned mid-onboarding** —
 *            an operational state of a third party, and a window in which a
 *            competing claim is most likely to succeed.
 *
 *        `connection_disabled`
 *            A door exists, a proof exists, and **the customer switched it
 *            off**. That distinguishes *"never a customer"* from *"a customer
 *            who has suspended sign-in"* — visible to anybody, at any time,
 *            and it is closest to a commercial-status oracle: it is what a
 *            lapsed or disputed account looks like from outside.
 *
 *        `domain_claimed_by_more_than_one_connection`
 *            **The takeover state, published to the party most likely to have
 *            caused it.** An attacker who has planted a second verified claim
 *            learns from this code alone that the plant LANDED, without
 *            needing any access to the victim. It is also a live outage
 *            indicator: it means nobody at that domain can sign in right now.
 *
 *      **The repair is not obvious and must not be improvised here.** Folding
 *      all four into one code deletes `domain_not_verified`, which is #221's
 *      own red, and the contract refuses the fold on the ground that it would
 *      *"depart from the model this tier exists to mirror."* Whether the wire
 *      should carry four codes, two, or one is D6's, and it is a CONTRACT
 *      change when taken.
 *
 * **(2) THE COST OF A SWEEP, DENOMINATED IN DATABASE CONNECTIONS RATHER THAN
 *      IN INFORMATION.** Every other entry here asks what a caller LEARNS.
 *      This one asks what a caller SPENDS OF OURS, and it is the entry a
 *      threat model written about oracles would miss. **Each anonymous
 *      question holds one pooled connection for its whole life**
 *      (`db/realm-scope.ts` opens a transaction; `createAppPool()` defaults to
 *      `max = 10`), so a sweep is not merely an information leak metered by
 *      CloudFront — it is **contention with every authenticated tenant request
 *      on the same task.** Measured, `max: 10`, ten held: an eleventh caller
 *      waited 5,715ms before `createAppPool()` gained a
 *      `connectionTimeoutMillis`, and is rejected at 2,000ms after (G1984).
 *      **The timeout SHEDS that load; it does not prevent it**, and the
 *      difference between shedding and preventing is the question. D6 should
 *      decide whether this operation may hold a pooled connection at all, or
 *      needs its own bounded pool so an anonymous flood cannot reach the
 *      tenant one.
 *
 * **(3) THE RESPONSE-LENGTH CHANNEL — NARROWED IN THIS COMMIT AND STILL
 *      OPEN.** The four refusals shared one status, one title and one detail
 *      and had four BODY LENGTHS, isolating the takeover arm by 46 bytes to an
 *      observer who could not read the body (G1989, measured: 364 / 366 / 366
 *      / 412). The pad at `noDoorDetail()` closes the arm-to-arm difference.
 *      **What is NOT closed and is D6's: the 200 is 24 bytes and any refusal
 *      is ~412**, so the domain-existence oracle is readable from length as
 *      well as from status. That is the contract's deliberate oracle in a
 *      second channel, and narrowing it is a contract change. **Nor is this
 *      operation constant-TIME**: round trips are now equal per arm (G1988),
 *      row counts and per-row assembly are not.
 *
 * **(4) NO RATE LIMIT — THE ORIGINAL ENTRY, KEPT WHOLE.** A domain-existence
 *      oracle with no cost per question is a domain-existence oracle somebody
 *      can sweep. There is no WAF, no throttle and no response-headers policy
 *      on either CloudFront distribution — `infra/lib/edge-stack.ts` says so
 *      in its own *"what this stack does not do"* block — so the only thing
 *      between a caller and an unbounded sweep is CloudFront's own
 *      per-distribution capacity. Derive the absence:
 *      `grep -rn 'WAFv2\|RateBasedStatement' infra/` -> nothing. It is not
 *      repaired here and it is not repairable here: **a throttle belongs at
 *      the edge and the edge is `infra/`'s.** It is the precondition for (2)
 *      being survivable and for (1) being merely a leak rather than a
 *      harvestable dataset.
 *
 * **(5) THE 500 ARM IS ANONYMOUSLY REACHABLE AND ALARMS ON A RATE WHOSE
 *      EXPECTED VALUE IS ZERO.** `infra/lib/observability-stack.ts` alarms on
 *      the data ALB's 5xx rate — *"Expected rate is zero … 5xx is reserved for
 *      one unhandled-failure arm"* — and this operation can answer 500 twice:
 *      once for a malformed directory row (below, deliberately), and once for
 *      anything unhandled. **The oversized-body route into that arm is closed
 *      in this commit** (G1985's `maxLength` and G1986's 413), but the general
 *      shape is not: **an anonymous caller now shares a 5xx alarm with our own
 *      failures**, so a way to provoke one is a way to page whoever eventually
 *      subscribes to that topic. D6 should decide whether an unauthenticated
 *      surface may emit 5xx on the alarmed listener at all.
 */

import type { FastifyReply, FastifyRequest } from 'fastify'

import {
  DOMAIN_ROUTING_REFUSALS,
  normaliseClaimedDomain,
  routeToConnection,
  type DomainRoutingRefusal,
} from '../../model/domain.ts'
import type { TenantPool } from '../../db/tenant-scope.ts'
import { withRealmScope } from '../../db/realm-scope.ts'
import { sendProblem, type Handler } from '../http/app.ts'
import { CODES } from '../http/problem.ts'
import { readConnectionsClaimingDomain } from './identity.ts'

/**
 * 🛑 A TOTAL `Record` OVER THE MODEL'S OWN REFUSAL UNION, AND THE TOTALITY IS
 * THE CONTROL RATHER THAN THE TIDINESS.
 *
 * `DomainRoutingRefusal` is a four-member union derived from
 * `DOMAIN_ROUTING_REFUSALS`. A fifth arm added to `routeToConnection()` — the
 * expiry arm G231 declines to take is the obvious candidate — is a `TS2739` at
 * this literal, so it cannot reach the wire as an unhandled case and cannot be
 * silently folded into one of the four either.
 *
 * ⚠️ **THE FOUR NAMES ARE THE SAME FOUR STRINGS `errors.yaml` CARRIES, AND
 * THAT IS A MIRROR RATHER THAN A COINCIDENCE.** `CODES` resolves every one of
 * them against the closed enum at IMPORT time — `server/http/problem.ts`:
 * *"a process that will not start, at the top of a stack trace naming the
 * code"* — so a model refusal whose spelling drifted from the wire's is a boot
 * failure rather than a 500 in the one refusal path nobody exercised.
 */
const REFUSAL_CODE: Readonly<Record<DomainRoutingRefusal, string>> = {
  [DOMAIN_ROUTING_REFUSALS.domainNotClaimed]: CODES.domainNotClaimed,
  [DOMAIN_ROUTING_REFUSALS.domainNotVerified]: CODES.domainNotVerified,
  [DOMAIN_ROUTING_REFUSALS.connectionDisabled]: CODES.connectionDisabled,
  [DOMAIN_ROUTING_REFUSALS.domainClaimedByMoreThanOneConnection]:
    CODES.domainClaimedByMoreThanOneConnection,
}

/**
 * 🛑 ONE TITLE FOR ALL FOUR ARMS, AND ONE DETAIL. THIS IS THE CONTRACT'S
 * *"EVERY REFUSAL SHARES ONE STATUS"* CARRIED THROUGH TO THE TWO OTHER
 * CHANNELS A CALLER CAN READ WITHOUT PARSING A BODY.
 *
 * The contract puts the distinction in `ErrorCode` *"and by nothing else"*.
 * A per-arm `title` would put it in a second place — a human-readable one,
 * which is worse, because the next person to add a status or a header would be
 * copying a file that already distinguishes them somewhere. #231 names the
 * failure exactly: *"returning 404 for an unknown address is the natural thing
 * to write and it is a user-existence oracle."*
 *
 * ⚠️ AND THE `detail` IS A CONSTANT, WHICH IS `errors.yaml`'s RULE AND NOT A
 * STYLE — *"MUST NOT contain field values, record contents or
 * customer-authored strings."* The domain is a customer-authored string and
 * the one thing a caller already knows; putting it here would gain nothing and
 * would put counterparty text into a log line.
 */
const NO_DOOR_TITLE = 'No sign-in door for that domain.'
const NO_DOOR_DETAIL =
  'Every refusal on this operation shares one status and is distinguished by its code alone. ' +
  'The request names a domain and never a person, so two addresses at one domain are one ' +
  'request and one answer.'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE THIRD CHANNEL: RESPONSE LENGTH. G1989, 22 Sep 2026.
 *
 *    ONE STATUS, ONE TITLE, ONE DETAIL — AND UNTIL THIS COMMIT, FOUR
 *    DIFFERENT BODY LENGTHS, WHICH ISOLATED THE TAKEOVER ARM BY 46 BYTES TO
 *    A NETWORK OBSERVER WHO CANNOT READ THE BODY.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The `code` appears TWICE in an RFC 9457 problem — once as the last segment
 * of `type` and once as `code` itself — so the body's length is a linear
 * function of the code's length. Measured on the exact strings above:
 *
 *     364  domain_not_claimed
 *     366  domain_not_verified
 *     366  connection_disabled
 *     412  domain_claimed_by_more_than_one_connection   <- 46 bytes clear
 *
 * **`domain_claimed_by_more_than_one_connection` IS THE TAKEOVER STATE**, and
 * it was the one arm a passive observer could identify without TLS, without
 * the body, and without ever having made the request themselves — from a
 * ciphertext length alone. The contract's own reason for one shared status is
 * that two statuses would put the distinction *"in a channel a caller can
 * read without parsing a body."* **Length is exactly such a channel**, and
 * the block above was already careful about the other two (one `title`, one
 * `detail`) while leaving this one open.
 *
 * 🛑 **THE PAD IS DETERMINISTIC AND CARRIES NOTHING.** Trailing spaces on
 * `detail`, `2 × (longest code − this code)` of them, so every one of the
 * four bodies is the same number of bytes. It is computed from the code table
 * rather than written down, so a FIFTH refusal cannot arrive with a length of
 * its own — `LONGEST_CODE` is derived from `REFUSAL_CODE`'s own values.
 *
 * ⚠️ **SPACES AND NOT A VISIBLE FILLER**, because `errors.yaml` rules `detail`
 * is *"human-facing only"* and must carry no field values: a pad that read as
 * content would be inventing a sentence, and a pad derived from anything
 * about the request would re-open the channel it closes.
 *
 * ⚠️ **THE 200 IS NOT PADDED TO MATCH THE 422s, AND THAT IS DELIBERATE
 * RATHER THAN AN OVERSIGHT.** A success is 24 bytes and any refusal is ~412,
 * so a 200 and a 422 remain trivially distinguishable by length. **That is
 * the DOMAIN-EXISTENCE ORACLE, which `docs/contracts/session.openapi.yaml`
 * leaves open BY NAME** — *"A 200 for a claimed domain and a 422 for an
 * unclaimed one is a DOMAIN-existence signal … It is not invented away"* —
 * and closing it here would be a contract change made in a handler. What this
 * pad closes is the distinction AMONG the refusals, which the contract says
 * must not be readable outside the body. **Narrowing the oracle is D6's and
 * is recorded as OPEN below; it is not this constant's to take.**
 *
 * ⚠️ AND IT IS NOT CONSTANT-TIME. Length is closed; the timing spread between
 * arms is not, and is the other OPEN D6 question on this file.
 */
const LONGEST_CODE = Math.max(...Object.values(REFUSAL_CODE).map((c) => c.length))

function noDoorDetail(code: string): string {
  /* Twice, because the code is spelled twice in every problem body: once in
   * `type`'s last segment and once in `code`. */
  return NO_DOOR_DETAIL + ' '.repeat(2 * (LONGEST_CODE - code.length))
}

/**
 * THE HANDLER.
 *
 * ⚠️ **IT TAKES THE POOL AND NOT A SESSION, AND IT CALLS `principalOf()`
 * NOWHERE.** That function throws on a route the contract does not mark
 * `security`, and `session.openapi.yaml` declares `security: []` at document
 * level with no override on this operation — so reaching for a principal here
 * is a 500 by construction. The absence is the shape of the operation.
 *
 * 🛑 **THE ORDER IS: NORMALISE, SCOPE, READ, DECIDE.** The decision is
 * `routeToConnection()`'s and this function contributes none of it — no
 * `WHERE`, no filter, no tie-break. The one thing it does that the model
 * cannot is refuse OUR OWN broken row, below.
 */
export function resolveHomeRealmHandler(pool: TenantPool): Handler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    /**
     * ⚠️ THE BODY IS READ AS `unknown` AND NARROWED, THOUGH AJV HAS ALREADY
     * VALIDATED IT. The schema is the contract's and is enforced before this
     * runs (`RealmRequest`: `required: [domain]`, `additionalProperties:
     * false`), so this narrowing can only ever be redundant — and it is kept
     * because `request.body` is typed `unknown` and a cast would assert a
     * shape this function did not check. It reads ONE key and there is no
     * second one to read.
     */
    const body: unknown = request.body
    const claimed =
      typeof body === 'object' && body !== null
        ? (body as { readonly domain?: unknown })['domain']
        : undefined
    if (typeof claimed !== 'string') {
      /* Unreachable behind the schema, and a 400 rather than a 422 because it
       * is a statement about the REQUEST rather than about the domain. A 422
       * here would put a malformed body into the same channel as a real
       * routing answer. */
      return sendProblem(reply, {
        status: 400,
        code: CODES.validationFailed,
        title: 'The request does not satisfy the contract.',
        detail: 'Rejected by the body schema declared in the OpenAPI document.',
      })
    }

    /**
     * 🛑 `normaliseClaimedDomain()` AND NOT `toLowerCase()`. The declaration
     * says why: *"DNS is case-insensitive and this comparison decides an ORG
     * CLASS, so folding is load-bearing rather than tidy: a case-sensitive
     * compare lets `ACME.EXAMPLE` be claimed a second time by somebody else
     * with the ambiguity check below none the wiser."* Calling the model's
     * function rather than spelling it is what keeps this comparison and the
     * one inside `routeToConnection()` the same comparison.
     */
    const domain = normaliseClaimedDomain(claimed)

    const outcome = await withRealmScope(pool, { claimedDomain: domain }, async (tx) =>
      readConnectionsClaimingDomain(tx),
    )

    if (!outcome.ok) {
      /**
       * 🛑 **A 500, AND THE CHOICE IS ARGUED BECAUSE THE CHEAP ANSWER IS A
       * 422 AND THE CHEAP ANSWER IS A LIE.** `readConnectionsClaimingDomain()`
       * refuses when one of OUR rows is malformed — an owner this build cannot
       * assemble, a protocol it does not know, half a broker handle.
       * `errors.yaml`'s closed enum has no member meaning *"our row is
       * wrong"*, and every member of `DOMAIN_ROUTING_REFUSALS` is a statement
       * about the CALLER'S domain. Answering `domain_not_claimed` for a
       * malformed claimant would tell a customer their domain is not
       * registered when it is, and would do it in the one channel an operator
       * reads as a fact about the customer.
       *
       * ⚠️ IT IS A RESPONSE THE CONTRACT DOES NOT DECLARE. That is true of
       * every 500 this server can produce — `server/http/app.ts`'s error
       * handler mints them for unhandled failures and no tier declares one —
       * and it is named here rather than left for a reader to notice, because
       * this operation declares exactly two responses.
       */
      return sendProblem(reply, {
        status: 500,
        code: CODES.upstreamUnavailable,
        title: 'The request could not be completed.',
        detail:
          'A directory row could not be read as a connection. That is a statement about this ' +
          'platform and not about the domain, and there is no refusal code that means it.',
      })
    }

    const routing = routeToConnection(outcome.connections, domain)
    if (!routing.ok) {
      /* ⚠️ `noDoorDetail()` AND NOT `NO_DOOR_DETAIL`. The pad is what keeps
       * all four bodies one length; see its declaration for why a 46-byte
       * difference on the takeover arm was a channel. */
      const code = REFUSAL_CODE[routing.refusal]
      return sendProblem(reply, {
        status: 422,
        code,
        title: NO_DOOR_TITLE,
        detail: noDoorDetail(code),
      })
    }

    /**
     * ⚠️ AN ID, NEVER A CONNECTION, AND NEVER AN ORG — the contract's
     * `RealmRouting` is `additionalProperties: false` with one required key,
     * and it mirrors the model: *"Routing chooses the door; the door
     * decides."* A `protocol` or a `label` here would tell a caller which form
     * to render and is a MODEL question the contract leaves open by name.
     */
    return reply.send({ connectionId: routing.connectionId })
  }
}
