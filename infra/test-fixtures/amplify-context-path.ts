/**
 * THE SECOND RED WITNESS FOR THE APEX'S REFUSAL — and it is the one the first
 * draft of the guard DID NOT REFUSE. **G2009, 22 Sep 2026.**
 *
 * 🛑 `/context/<*>` PASSED. `amplify-session-bearing-path.ts` beside this file
 * witnesses `/session/<*>`, which the guard always refused; this witnesses the
 * shape it did not, and which is the sharper of the two.
 *
 * **`/context/resolve` IS D1.** `server/data-plane/context.ts` calls the bound
 * session row *"the DURABLE side effect"*: the operation reads
 * `__Host-reconcile_session` and BINDS that session's tenant, permanently.
 * Proxied from the apex — where a 200 rewrite is invisible to the browser, so
 * the cookie belongs to `reconcileai.app` — G180's `checkHostBinding()` then
 * compares the bound host against the real one on the next request and REVOKES.
 * **That is the identical failure `MARKETING_PROXIED_PLANE_PATHS` describes at
 * length for `/session/federated`, reached through a door its list did not
 * name**, and a deny-list of two spellings is `docs/HANDOFF.md` §5.1 inside the
 * guard whose own docstring claimed to have avoided §5.1.
 *
 * The polarity is inverted now: `marketingRefusedPaths()` derives the whole of
 * what the plane serves from `EDGE_PLANE_PATH_PATTERNS` and subtracts the
 * allow-list, so a session-tier operation minted next month is refused by
 * DEFAULT rather than by somebody remembering to extend a list.
 *
 * ⚠️ IT BUILDS ITS OWN MINIMAL TREE RATHER THAN CALLING `buildApp()`, for the
 * reason `edge-catch-all.ts` gives: the real app passes no hostile value, and
 * adding one to it would make every other suite red.
 */
import { App } from 'aws-cdk-lib'

import { CDK_ENV, STACK_AMPLIFY_STAGING } from '../lib/config.ts'
import { AmplifyStack } from '../lib/amplify-stack.ts'

const app = new App()

const stack = new AmplifyStack(app, STACK_AMPLIFY_STAGING, {
  env: CDK_ENV,
  environment: 'staging',
  // The one difference. The widening the first draft of the guard admitted.
  extraProxiedPlanePaths: ['/context/<*>'],
})

app.synth()
process.stdout.write(`SYNTH OK ${stack.stackName}\n`)
