/**
 * THE `Storage` STACK WITH TENANT KEYS IN IT — because on trunk it has none.
 *
 * 🛑 WHY THIS FIXTURE EXISTS AND WHY IT IS NOT OPTIONAL. `TENANT_KEY_HANDLES`
 * is empty: no tenant exists in this account. So the real app synthesises a
 * `Storage` stack containing a bucket and ZERO keys, and a green `npm run
 * check` would say nothing whatever about the key policy, the alias, the
 * withheld `kms:ReEncrypt*`, the narrowed root statement or the bucket
 * statement that names the permitted key ARNs. **A control that cannot be
 * witnessed asserts nothing** — `docs/HANDOFF.md` §5.6 — and the key factory is
 * the load-bearing half of G287.
 *
 * Two handles, not one: one key proves the shape, two prove the factory does
 * not collide with itself on alias, logical id or bucket statement.
 *
 * The handles are real random hex (`openssl rand -hex 8`) and mean nothing.
 */

import { App } from 'aws-cdk-lib'

import { CDK_ENV } from '../lib/config.ts'
import { StorageStack } from '../lib/storage-stack.ts'

const app = new App()

const stack = new StorageStack(app, 'reconcile-storage-staging', {
  env: CDK_ENV,
  environment: 'staging',
  tenantKeyHandles: ['9f3c1a7be420d581', '0ab46c2f9d715e83'],
})

const assembly = app.synth()

process.stdout.write(
  JSON.stringify(assembly.getStackByName(stack.stackName).template),
)
