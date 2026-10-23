/**
 * THE RED WITNESS FOR THE APEX'S SESSION-BEARING REFUSAL — and the pattern it
 * passes is **the exact widening this slice was asked for and refused**.
 *
 * 🛑 `/session/<*>` IS NOT A HYPOTHETICAL. The instruction that commissioned
 * `lib/amplify-stack.ts` said *"`/session/*` → the CONSOLE CloudFront
 * distribution"*, and `MARKETING_PROXIED_PLANE_PATHS` in `lib/config.ts`
 * narrows it to `/session/realm` with the argument. **A refusal that only ever
 * refuses a value nobody would write is a refusal nobody has seen work**
 * (`docs/HANDOFF.md` §5.6), so the value this fixture passes is the one a
 * reader of the instruction would actually type.
 *
 * What it must refuse, and why each matters:
 *
 *   · `/session/federated` — `completeFederatedSignIn` MINTS a session. A 200
 *     rewrite is invisible to the browser, so `__Host-reconcile_session` would
 *     bind to `reconcileai.app` and G180's `checkHostBinding()` would REVOKE it
 *     at the real host on the next request.
 *   · `/session` — `getSession` and `signOut` need a session the apex cannot be
 *     carrying.
 *
 * ⚠️ THE SOURCE USES AMPLIFY'S ANGLE-BRACKET PLACEHOLDER AND NOT CLOUDFRONT'S
 * BARE `*`, DELIBERATELY. A bare `*` is a LITERAL asterisk to Amplify, so
 * `/session/*` would proxy exactly one path — the one spelled with an asterisk
 * in it — and a fixture using it would witness the guard refusing a pattern
 * that was never dangerous. `marketingRuleMatches()` reproduces Amplify's
 * language and this file speaks it.
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
  // The one difference. The widening that would publish the sign-in callback.
  extraProxiedPlanePaths: ['/session/<*>'],
})

app.synth()
process.stdout.write(`SYNTH OK ${stack.stackName}\n`)
