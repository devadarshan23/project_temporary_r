/**
 * THE DEPLOYED PATH CANNOT BE HANDED A PERMISSIVE AUTHORISER, AND THIS IS THE
 * THING THAT READS THE FENCE.
 *
 * 🛑 WHY THIS EXISTS. The capability gate ships with a test helper,
 * `allowEveryCapability()`, which answers `'held'` to everything. It has to:
 * five database-backed suites assert things about RLS, and a plane that 403s
 * every request would let all five pass while proving nothing about isolation.
 *
 * The helper is fenced STRUCTURALLY rather than by convention:
 *
 *   · `startDataPlane()`  — the ephemeral-port entry point used by tests —
 *     takes an optional `authorise`;
 *   · `listenDataPlane()` — the entry point `server/data-plane/main.ts` calls,
 *     and the ONLY one a deployed container reaches — takes no such option;
 *   · so there is no argument a deployed plane could be given that makes it
 *     permissive, whatever an environment variable says.
 *
 * ⚠️ AND THAT ASYMMETRY WAS ASSERTED BY NOTHING. `docs/build/deploy-handoff.md`
 * §6 names this exact failure in its own voice: *"A fence's reader is part of
 * the fence.* This session collapsed two container names for a good-sounding
 * reason and a test went red — because it told the migrate container from the
 * service container BY NAME. That did not weaken the credential fence; it
 * deleted the only thing reading it, which is worse, because the fence would
 * still have looked intact."
 *
 * A fence with no reader is an intention. Somebody adds `authorise` to
 * `listenDataPlane`'s options next month for a good-sounding reason, every
 * existing test still passes, and the deployed plane becomes configurable into
 * permissiveness with nothing saying so. THIS FILE IS WHAT GOES RED.
 *
 * It reads the SOURCE rather than calling the function, deliberately: the
 * property is about what the signature ADMITS, and a property about a type
 * cannot be witnessed by invoking it.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const START = readFileSync(join(REPO, 'server/data-plane/start.ts'), 'utf8')
const MAIN = readFileSync(join(REPO, 'server/data-plane/main.ts'), 'utf8')

/** The parameter object of one exported function, as written. */
function optionsOf(source: string, fn: string): string {
  const at = source.indexOf(`export async function ${fn}(opts: {`)
  assert.notEqual(at, -1, `${fn}() is not declared as \`opts: { … }\` any more — this test reads the source, so a changed shape needs a changed reader, not a deleted one.`)
  const open = source.indexOf('{', at + `export async function ${fn}(`.length)
  const close = source.indexOf('}', open)
  return source.slice(open, close)
}

describe('the deployed data plane cannot be configured permissive', () => {
  it('1 · listenDataPlane() admits NO authorise option', () => {
    assert.ok(
      !/\bauthorise\b/.test(optionsOf(START, 'listenDataPlane')),
      'listenDataPlane() has gained an `authorise` option. That is the entry point ' +
        'server/data-plane/main.ts calls, and it is the ONLY one a deployed container ' +
        'reaches — so this change makes a production plane configurable into ' +
        'permissiveness. The gate refuses by default precisely because no identity ' +
        'substrate exists yet: there is no `user`, `session`, `role` or ' +
        '`role_assignment` table, so no subject can be resolved and no capability can ' +
        'honestly be held. If a deployed plane now needs to authorise, it needs a ' +
        'SUBJECT, not an option.',
    )
  })

  it('2 · the test-only entry point is the one that admits it, so the asymmetry is real', () => {
    assert.match(
      optionsOf(START, 'startDataPlane'),
      /\bauthorise\b/,
      'startDataPlane() no longer admits `authorise`. If the option moved or was ' +
        'removed, assertion 1 above is now vacuous — it would pass against a file with ' +
        'no authorise option anywhere — so this suite asserts the OTHER half too. ' +
        'A negative control that cannot tell absence from irrelevance is HANDOFF §5.6.',
    )
  })

  /* ================================================================ *
   * THE SAME ASYMMETRY, ON THE SECOND OPTION — G301, 19 Sep 2026.
   *
   * 🛑 `substrate` ARRIVED FOR THE SAME REASON `authorise` DID AND IS
   * FENCED THE SAME WAY. A gated handler now MINTS invariant 10's
   * record, and a mint needs a principal — so a test that wants to
   * exercise the read path behind the gate has to supply one. A
   * DEPLOYED process must not be able to: a fabricated principal would
   * put a record into an append-only table naming an authority nobody
   * held, which is worse than the gap G301 closed.
   *
   * ⚠️ AND IT CANNOT MAKE A PLANE PERMISSIVE EVEN WHERE IT IS ADMITTED:
   * the verdict still comes from `authorize()` → `decide()`. What the
   * fence protects is the RECORD, not the decision.
   * ================================================================ */

  it('1b · listenDataPlane() admits NO substrate option either', () => {
    assert.ok(
      !/\bsubstrate\b/.test(optionsOf(START, 'listenDataPlane')),
      'listenDataPlane() has gained a `substrate` option. That is the entry point ' +
        'server/data-plane/main.ts calls, and a deployed plane that can be handed a ' +
        'principal reader can be handed a FABRICATED principal — which would mint ' +
        "invariant 10's record naming an authority nobody held. A deployed plane's " +
        'subject comes from rows, through `substrateFromSession`, or it does not come.',
    )
  })

  it('2b · the test-only entry point is the one that admits it, so 1b is not vacuous', () => {
    assert.match(
      optionsOf(START, 'startDataPlane'),
      /\bsubstrate\b/,
      'startDataPlane() no longer admits `substrate`. If the option moved or was removed, ' +
        'assertion 1b above is now vacuous — it would pass against a file with no substrate ' +
        'option anywhere. A negative control that cannot tell absence from irrelevance is ' +
        'HANDOFF §5.6, which is the sentence assertion 2 already makes about `authorise`.',
    )
  })

  it('1c · the deployed plane’s KEY DOCUMENT comes from main.ts’s boot load and nothing else — S6, G2499', () => {
    /**
     * 🛑 A TRUST ANCHOR, NOT A CONVENIENCE: whoever chooses the JWKS chooses
     * which tokens verify, and since S6 the callback verifies against exactly
     * the document `listenDataPlane()` is handed. `main.ts` must obtain it
     * through R2's boot fetch — `loadVerificationTerms(identityTermsTarget())`
     * — and pass THAT, so no argument a deployed process could be given chooses
     * a key.
     */
    assert.match(optionsOf(START, 'listenDataPlane'), /\bidentityTerms\b/)
    /* ⚠️ This matched `loadVerificationTerms(target)` — the ENVIRONMENT's one
     * URL — until 1 Oct 2026. R2 as amended (G2571) loads one document per
     * brokered door, from the inventory the boot read under
     * `withKeyInventoryScope()`, and the anchor is still chosen by nothing a
     * deployed process could be handed. */
    assert.match(MAIN, /withKeyInventoryScope\(pool,\s*\(tx\)\s*=>\s*readConnectionKeyInventory\(tx\)\)/, 'main.ts no longer reads the key inventory from the database at boot')
    assert.match(MAIN, /loadVerificationTerms\(tolerances,\s*inventory\)/, 'main.ts no longer loads the key documents the inventory names')
    assert.match(MAIN, /identityTerms:\s*terms\b/, 'main.ts hands listenDataPlane() something other than the document it loaded')
  })

  it('3 · main.ts reaches listenDataPlane and never startDataPlane', () => {
    assert.match(MAIN, /\blistenDataPlane\b/, 'main.ts no longer calls listenDataPlane()')
    assert.ok(
      !/\bstartDataPlane\b/.test(MAIN),
      'server/data-plane/main.ts now references startDataPlane() — the entry point that ' +
        'ACCEPTS an authoriser. The whole fence is that the deployed path and the ' +
        'configurable path are different functions; one import erases it.',
    )
  })

  it('4 · allowEveryCapability lives in tests/ and nothing under server/ names it', () => {
    /* `git grep` exits 1 when it matches NOTHING, which is the passing case here —
       so the status is read rather than trusted to be zero, and any status above
       1 is a broken probe rather than a clean result. */
    const run = spawnSync('git', ['grep', '-l', 'allowEveryCapability', '--', 'server'], {
      cwd: REPO,
      encoding: 'utf8',
    })
    assert.ok(
      run.status === 0 || run.status === 1,
      `the probe itself failed (status ${String(run.status)}): ${run.stderr}. ` +
        'A search that cannot run is not a search that found nothing.',
    )
    const hits = run.stdout.trim()
    assert.equal(
      hits,
      '',
      `server/ now names allowEveryCapability: ${hits}. The permissive authoriser is a ` +
        'TEST fixture. A serving module that can name it is a serving module that can ' +
        'call it — the same structural argument G192 makes for the dev test token, ' +
        'which is reached by a DYNAMIC import so a plane without the flag never loads ' +
        'the file at all.',
    )
  })
})
