/**
 * THE RED WITNESS FOR G290's FORBIDDEN-VERB GUARD — and it is witnessed from
 * BOTH sides, because a guard that throws unconditionally passes from one side
 * and a guard that never throws passes from the other.
 *
 * 🛑 WHY THIS CANNOT BE AN ORDINARY TEST. `assertMinterHoldsNoDangerousVerb()`
 * lives in `infra/lib/storage-stack.ts`, which imports `aws-cdk-lib` — a
 * package the ROOT manifest must never carry (G259/G212), which is why every
 * suite under `tests/infra/` is `.mjs` and reaches `infra/` by SPAWNING a
 * script rather than importing one. This is that script.
 *
 * 🛑 AND WHY THE GUARD NEEDS WITNESSING AT ALL. `TENANT_KEY_HANDLES` is empty,
 * so the deployed `Storage` stack's minter holds a policy nobody has ever seen
 * rejected. G290's sharpest sentence — *"`ScheduleKeyDeletion` is the dangerous
 * verb, not `CreateKey`"* — is a paragraph until something fails on it.
 *
 * ⚠️ THE SECOND CASE IS THE ONE THAT MATTERS. A literal `kms:ScheduleKeyDeletion`
 * is not how this defect would ever arrive; it arrives as `kms:*`, added by
 * somebody widening a grant to make a deploy work. `kms:*` equals no string on
 * the forbidden list and covers eleven of them.
 */

import {
  TENANT_KEY_MINTER_FORBIDDEN_ACTIONS,
  assertMinterHoldsNoDangerousVerb,
} from '../lib/storage-stack.ts'

/* 1 · THE POSITIVE CONTROL. The real grant must pass, or the assertion below
 *     proves only that the function throws. */
assertMinterHoldsNoDangerousVerb([
  'kms:CreateKey',
  'kms:TagResource',
  'kms:DescribeKey',
  'kms:EnableKeyRotation',
  'kms:CreateAlias',
  'logs:CreateLogStream',
  'logs:PutLogEvents',
])
process.stdout.write('SAFE OK\n')

/* 2 · The forbidden list must not be empty, or case 1 passes vacuously. */
if (TENANT_KEY_MINTER_FORBIDDEN_ACTIONS.length === 0) {
  throw new Error('the forbidden list is empty; the guard asserts nothing')
}

/* 3 · THE RED WITNESS. A wildcard, not a literal. Synth must FAIL here. */
assertMinterHoldsNoDangerousVerb(['kms:CreateKey', 'kms:*'])

process.stdout.write('NOT REACHED\n')
