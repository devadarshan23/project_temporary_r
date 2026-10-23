/**
 * WHAT MAY BE CLAIMED ABOUT THE SESSION ROW'S CONTENT, AND WHAT MAY NOT.
 *
 * 🛑 THIS FILE EXISTS BECAUSE THE HONEST ANSWER IS "NEITHER GUARD APPLIES", AND
 * AN UNARGUED ABSENCE READS AS AN OVERSIGHT. #222 says it plainly: *"Do not
 * reach for `AssertNoPlainText` or `AssertNoTextDeep`: `Timestamp = string`, so
 * every timestamped field maps to `never` and the assertion FAILS rather than
 * passing. `Session` is the first timestamped type either has met. Say so on
 * the declaration or the next reader adds one."* The declaration says so. This
 * file PROVES it, so that the sentence on the declaration is evidence rather
 * than an assertion about the compiler nobody ran.
 *
 * HOW IT BITES IN BOTH DIRECTIONS, which is the device
 * `tests/model/no-text-deep.test.ts` and `tests/model/learned-dispositions.test.ts`
 * both use. Every FAILING case below is a `@ts-expect-error` that MUST error:
 * if a guard is ever weakened enough to admit a timestamped row, the directive
 * goes unused and that is itself `TS2578`. Every PASSING case carries no
 * directive at all, so a guard that over-rejects fails just as loudly. `npm
 * test` runs `typecheck:tests` before it executes a single assertion, so both
 * halves are enforced by the gate rather than by this file's own runtime.
 *
 * ⚠️ WHAT THIS FILE DOES NOT DO. It makes no claim about a RUNTIME value.
 * Nothing here stops a `JSON.parse` result being asserted into one of these
 * shapes at a boundary — the same limit `model/identity.ts` states for
 * `_CarriedTurnHoldsNoText`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import type { AssertNoTextDeep } from '../../model/reconciliation.ts'
import type { AssertNoPlainText } from '../../model/identity.ts'
import type { Session, SignInAttempt, FederatedCallback } from '../../model/domain.ts'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SELF = readFileSync(fileURLToPath(import.meta.url), 'utf8')

/* ==================================================================== *
 * 1. NEITHER GUARD ADMITS A TIMESTAMPED ROW — the negative half
 *
 * `Timestamp = string` (`model/kernel.ts`). `AssertNoPlainText` maps a bare
 * `string` property to `never`; `AssertNoTextDeep` is G146's inverted
 * allow-list of value-free leaves and refuses a bare `string` too. So both
 * refuse every one of `Session`'s five timestamps, and the refusal is CORRECT
 * — a timestamp IS a string — which is exactly why neither may be pointed at
 * this type as if it proved something.
 * ==================================================================== */

// @ts-expect-error — five timestamps, each a bare `string`. If this directive
// ever goes unused, `Timestamp` has stopped being a string alias and the
// argument written on the `Session` declaration has to be rewritten, not
// deleted.
export type _SessionRefusedByNoTextDeep = AssertNoTextDeep<Session>

// @ts-expect-error — the shallow guard refuses it too, and for the same reason.
// Recorded separately because #222 names both by name, and because a reader who
// found only one of the two would reasonably try the other.
export type _SessionRefusedByNoPlainText = AssertNoPlainText<Session>

// @ts-expect-error — three timestamps on the attempt. Same refusal, same reason.
export type _SignInAttemptRefusedByNoTextDeep = AssertNoTextDeep<SignInAttempt>

/* ==================================================================== *
 * 2. WHAT CAN ACTUALLY BE PROVEN — the positive half, and it is not nothing
 *
 * Strip the timestamps and ask the strong guard about what is left. THIS IS
 * THE CLAIM THE RECORD MAY MAKE, and it is narrower than "the row holds no
 * text": every non-timestamp field on both rows is a branded id, a branded
 * digest, or `null` — with exactly ONE exception, isolated below.
 * ==================================================================== */

type SessionTimestamps =
  | 'authenticatedAt'
  | 'secondFactorAt'
  | 'lastUsedAt'
  | 'expiresAt'
  | 'revokedAt'

/**
 * NO DIRECTIVE, DELIBERATELY. Everything left after the timestamps and the one
 * platform-configured host is `SessionId`, `SessionHandleDigest`, `UserId`,
 * `IdentityConnectionId` and `TenantId | null` — branded or absent, every one.
 *
 * ⚠️ THIS IS WHAT MAKES THE `@ts-expect-error`s ABOVE MEAN SOMETHING. Without a
 * passing case in the same file, "the guard rejects it" is indistinguishable
 * from "the guard rejects everything", and `Assert<never>` compiles.
 */
export type _SessionCarriesNoTextApartFromTimestampsAndItsHost = AssertNoTextDeep<
  Omit<Session, SessionTimestamps | 'issuedHost'>
>

/**
 * THE ONE EXCEPTION, ISOLATED SO IT CANNOT BE OVERLOOKED.
 *
 * `issuedHost` is a bare `string` and no proof will ever admit it. That is
 * correct: G180 stores the host the session was issued on, and a hostname is a
 * string. What keeps it out of invariant 6's territory is provenance rather
 * than type — it is written by the PLATFORM from validated configuration at
 * mint time and never echoed from the request that asked, so it is not
 * counterparty text. THAT SENTENCE IS THE WHOLE GUARANTEE, and it is a
 * discipline at the mint site rather than something the compiler holds. Say
 * "the row carries no counterparty text"; do not say "the row is proven to
 * carry no text".
 */
// @ts-expect-error — a bare `string`, and it must stay visible as one.
export type _IssuedHostIsABareString = AssertNoTextDeep<Pick<Session, 'issuedHost'>>

/**
 * NO DIRECTIVE. The attempt is the stronger of the two rows: strip its three
 * timestamps and NOTHING is left but branded ids and branded digests. There is
 * no `issuedHost` equivalent and no `userId` — which is the point of #223.
 */
export type _SignInAttemptCarriesNoTextApartFromItsTimestamps = AssertNoTextDeep<
  Omit<SignInAttempt, 'startedAt' | 'expiresAt' | 'consumedAt'>
>

/**
 * NO DIRECTIVE. The callback shape carries no timestamp at all, so the strong
 * guard applies to it WHOLE — and this is the one type on the surface about
 * which the unqualified claim is true. It is also the type most exposed: it is
 * assembled from values a caller presented.
 */
export type _FederatedCallbackHoldsNoTextDeep = AssertNoTextDeep<FederatedCallback>

/* ==================================================================== *
 * 3. THE INERTNESS GUARD
 *
 * Every declaration above is a TYPE, and a type-level file can be deleted
 * wholesale without a single runtime assertion noticing. The same shape
 * `tests/model/no-text-deep.test.ts` borrows from `reconciliation-controls`.
 * ==================================================================== */

test('this file still holds four `@ts-expect-error` directives and four undirected proofs', () => {
  const directives = [...SELF.matchAll(/^\/\/ @ts-expect-error/gm)].length
  assert.equal(
    directives,
    4,
    'A DIRECTIVE WENT MISSING. Each one asserts that a containment guard REFUSES a ' +
      'timestamped or host-bearing type. Deleting one silently converts "we proved the ' +
      'guard does not apply" back into "nobody pointed a guard at it".',
  )
  const proofs = [...SELF.matchAll(/^export type _[A-Za-z]+ = AssertNo(TextDeep|PlainText)</gm)]
  assert.equal(
    proofs.length,
    7,
    'THE PROOF COUNT MOVED. Four refusals and three positive proofs. A file that lost its ' +
      'positive proofs would still compile and would prove only that the guard rejects ' +
      'things, which is not a claim about this row.',
  )
})

test('the argument for the absence is written on the declaration itself, not only here', () => {
  // A test file can be deleted in a commit that touches nothing else. The
  // sentence has to survive on the type.
  const domain = readFileSync(join(REPO_ROOT, 'model', 'domain.ts'), 'utf8')
  const at = domain.indexOf('export interface Session {')
  assert.notEqual(at, -1)
  const docblock = domain.slice(Math.max(0, at - 6000), at)
  assert.ok(docblock.includes('session-containment.test.ts'))
  assert.ok(docblock.includes('AssertNoTextDeep') && docblock.includes('Timestamp'))
})

test('`AssertNoTextDeep` and `AssertNoPlainText` are still reachable from where this file imports them', async () => {
  // Both are type-only exports, so nothing above proves the modules load. This
  // does, and it is the same weakness `runtime-importability.test.ts` names.
  const reconciliation = await import('../../model/reconciliation.ts')
  const identity = await import('../../model/identity.ts')
  assert.ok(typeof reconciliation === 'object' && reconciliation !== null)
  assert.ok(typeof identity === 'object' && identity !== null)
})
