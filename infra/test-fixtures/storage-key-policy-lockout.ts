/**
 * THE RED WITNESS FOR THE RELOCATED LOCKOUT CHECK — G287/G290.
 *
 * 🛑 WHY A CONTROL EXISTS HERE AT ALL. The minter calls `CreateKey` with KMS's
 * policy-lockout safety check **BYPASSED**, because that check asks whether the
 * CALLER could later call `kms:PutKeyPolicy` and this design's caller is
 * deliberately not an administrator — a factory that can rewrite a key policy
 * can grant itself `kms:Decrypt` on every tenant key. Established by calling
 * `CreateKey` for real, twice, on 19 Sep 2026.
 *
 * ⚠️ WHAT THAT GENUINELY COSTS IS THAT AWS WILL NO LONGER CATCH A POLICY WITH
 * NO ADMINISTRATOR IN IT. So the check moved to the author, and a control that
 * has never been seen refusing is a control that asserts nothing
 * (`docs/HANDOFF.md` §5.6). This is it refusing.
 *
 * A key with no administrator is unmanageable AND undestroyable, and for a
 * design whose erasure story IS key destruction that is a tenant whose data can
 * never be proven gone.
 */

import { assertKeyPolicyLeavesAnAdministrator } from '../lib/storage-stack.ts'

/* 1 · THE POSITIVE CONTROL. The shape the stack really renders must pass. */
assertKeyPolicyLeavesAnAdministrator(
  JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'AccountRootMayADMINISTERThisKeyAndMayNotUseIt',
        Effect: 'Allow',
        Principal: { AWS: 'arn:aws:iam::000000000000:root' },
        Action: ['kms:PutKeyPolicy', 'kms:ScheduleKeyDeletion', 'kms:CancelKeyDeletion'],
        Resource: '*',
      },
    ],
  }),
)
process.stdout.write('SAFE OK\n')

/* 2 · THE RED WITNESS. A policy naming only the serving task role: every
 *     cryptographic use a tenant needs, and nobody who can ever destroy it. */
assertKeyPolicyLeavesAnAdministrator(
  JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'TheDataPlaneServingTaskMayUseThisKeyThroughS3Only',
        Effect: 'Allow',
        Principal: { AWS: 'arn:aws:iam::000000000000:role/reconcile-staging-data-service-task' },
        Action: ['kms:Decrypt', 'kms:GenerateDataKey', 'kms:DescribeKey'],
        Resource: '*',
      },
    ],
  }),
)

process.stdout.write('NOT REACHED\n')
