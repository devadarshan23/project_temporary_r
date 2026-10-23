/**
 * THE BROWSER GUARD, DRIVEN OVER THE SENTENCE `browserSkip()` RETURNS WHEN NO
 * PAGE CAN BE RENDERED.
 *
 * The same pair as `db-guard.fixture.ts`: spawned with and without `CI`, so the
 * red is witnessed rather than asserted. The verdict is passed in rather than
 * probed for, because launching a browser here would make this fixture slow and
 * would test `browserSkip()` a second time instead of testing the guard.
 */

import { browserRequiredUnderCi } from '../../../reachability.ts'

browserRequiredUnderCi(
  'a fixture suite',
  'no browser — the fixture supplies the sentence browserSkip() would return',
)
