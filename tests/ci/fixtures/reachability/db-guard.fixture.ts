/**
 * THE DATABASE GUARD, DRIVEN OVER A PROBE THAT FAILED.
 *
 * Spawned by `tests/ci/reachability-guards.test.ts` twice — once with `CI` set
 * and once without — so the guard is witnessed FAILING under the condition it
 * guards before it is believed when it passes. A guard tested only in the state
 * where it passes is `docs/HANDOFF.md` §5.6 wearing a lab coat.
 *
 * Not named `*.test.ts`: `npm test`'s glob would run it as part of the suite,
 * and under CI it would then fail the gate on purpose.
 */

import { databaseRequiredUnderCi } from '../../../reachability.ts'

databaseRequiredUnderCi('a fixture suite', {
  ok: false,
  reason: 'the fixture supplies a probe that failed',
})
