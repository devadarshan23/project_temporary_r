/**
 * THE SQS TRANSPORT — THE ONLY MODULE IN THIS REPOSITORY THAT NAMES AN AWS SDK.
 * **R-C, 20 Sep 2026, THE OWNER'S RULING, AND IT DISCHARGES G212 RATHER THAN
 * OVERTURNING IT.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 G212 SAYS WHEN IT ENDS, ON ITS OWN FACE, AND THAT CONDITION IS WHAT
 *    ADMITS THIS FILE. QUOTE IT RATHER THAN SUMMARISING IT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     "NO AWS SDK, IN ANY FORM, **WHILE PHASE ONE HAS NO AWS RESOURCE** …
 *      ⚠️ THIS DOES NOT SAY THE SEAM IS UNBUILDABLE. It says the seam is built
 *      against the local stack `compose.yaml` already stands up, and that the
 *      SDK is revisited **when an actual AWS resource exists** — which is a
 *      fact about the account, not about the code, and so is checkable rather
 *      than arguable."
 *
 * **The condition is met, and it was checked rather than asserted.** NINE
 * top-level stacks are live in `000000000000` / `us-west-2`. Reproduce it —
 * read-only, and the `ParentId` filter is what excludes the two nested
 * secret-rotation stacks:
 *
 *     AWS_PROFILE=crm-frontend aws cloudformation list-stacks --region us-west-2 \
 *       --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE UPDATE_ROLLBACK_COMPLETE \
 *       --query 'StackSummaries[?starts_with(StackName,`reconcile`) && ParentId==null].StackName' \
 *       --output text
 *
 * 🛑 **THE ROW IS DISCHARGED, NOT OVERTURNED, AND THE DIFFERENCE MATTERS TO
 *    THE NEXT READER.** Every argument in G212 still stands where it applied:
 *    a repository that ships an S3 client is a repository whose next commit
 *    creates a bucket — and the bucket exists, in `reconcile-storage-staging`,
 *    deployed 19 Sep 2026. What ended is the PREMISE, not the reasoning.
 *
 * ⚠️ **AND TWO CITED PROPERTIES END WITH IT. BOTH ARE SWEPT RATHER THAN LEFT
 *    TO ROT, WHICH IS THE PART A DISCHARGE USUALLY GETS WRONG:**
 *
 *   · `grep -c 'aws-sdk' package.json` → 0 has been a cited control since
 *     22 Aug 2026 and **returns 1 from this commit.** It is corrected at every
 *     one of its eleven sites rather than deleted, and the ASSERTION that made
 *     it real — `tests/infra/manifest.test.mjs` — is replaced by the narrower
 *     property that survives rather than removed:
 *     **exactly one `@aws-sdk/*` package, `@aws-sdk/client-sqs`, pinned
 *     exact.** A control that is deleted when it fires is not a control.
 *   · `npm ci --omit=dev` no longer produces a container holding the driver
 *     and no compiler AND NOTHING ELSE. It installs **25 more packages**, all
 *     of them the SQS client's transitive closure, and the `Dockerfile` header
 *     says so in its own voice now.
 *
 * 🛑 **THE REJECTED ALTERNATIVE, PRESERVED: DEPENDENCY-FREE SigV4 OVER
 *    `node:crypto`.** It would have kept BOTH properties — `server/data-plane/
 *    token-verify.ts` (G976) is the standing proof that this repository will
 *    take that trade when it is the right one, and it took it four days ago
 *    for RS256. **It is refused here on the one axis that separates the two
 *    cases: verifying a signature we did not make is a closed problem with a
 *    published test vector, and PRODUCING a request signature is an open one**
 *    — canonical request construction, header ordering, payload hashing,
 *    credential scoping and clock skew, each of which fails by producing a
 *    request the service REJECTS in a way indistinguishable from a
 *    misconfiguration. A library gets that right and is maintained when the
 *    signing algorithm moves.
 *
 * ⚠️ **AND THE NARROWNESS IS KEPT: `@aws-sdk/client-sqs` AND NOTHING ELSE.**
 * Not `aws-sdk` v2, not `@aws-sdk/client-s3`, not the monolith. `createUpload`
 * and `completeUpload` are STILL unmounted and their refusal is unchanged —
 * ⚠️ **the derivation beside that refusal in `server/data-plane/start.ts` was
 * `grep -c 'aws-sdk' package.json` → 0 and is corrected there**, because it
 * now measures the wrong thing: the object store is absent because no S3
 * client is taken and `0012` §3 refuses the columns, and neither of those
 * facts moved.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE DISPATCH SEAM, AND WHY THE GATE CAN PROVE THIS FILE WITH NO NETWORK
 *    AND NO CREDENTIALS.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `publisherOver()` and `receiverOver()` take a DISPATCH — a function that is
 * handed a constructed SDK command and returns its output — and the two
 * exported factories are the only places an `SQSClient` is built. A test
 * therefore drives the REAL `SendMessageCommand` construction (`QueueUrl`,
 * `MessageBody`, the encoded bytes) against a fake dispatch, which is what
 * lets `npm run check` assert the wire shape on a machine with no AWS account
 * at all. `tests/reachability.ts`'s whole discipline is that a green run must
 * not depend on an unreachable dependency, and a suite that needed a queue
 * would either skip — forbidden — or fail everywhere but here.
 *
 * ⚠️ **WHAT THAT DOES NOT PROVE, SAID RATHER THAN LEFT TO BE ASSUMED: THAT THE
 * QUEUE ACCEPTS IT.** The commands are constructed correctly and dispatched
 * through the client the SDK builds; whether `us-west-2` answers is a fact
 * about an account and is not in the gate, exactly as
 * `tests/e2e/probe-staging.mjs` is not.
 */

import { DeleteMessageCommand, ReceiveMessageCommand, SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'

import {
  encodeRunQueueMessage,
  parseRunQueueMessage,
  type RunAdmittedMessage,
  type RunQueuePublisher,
  type RunQueueRefusal,
  type RunQueueTarget,
} from './run-queue.ts'

/**
 * What a constructed command is handed to.
 *
 * ⚠️ THE `unknown` ARGUMENT IS DELIBERATE AND IS NOT A WEAKENING. `SQSClient
 * .send` is an overload set over every command in the service; a single
 * function type that admitted all of them and preserved each one's output type
 * is not expressible without reproducing those overloads here, which would be
 * a second copy of the SDK's own surface — §5.3, in a type. The three call
 * sites below each narrow the OUTPUT themselves, at the one place that knows
 * which command was sent.
 */
export type CommandDispatch = (command: unknown) => Promise<unknown>

/** The client, built once per process, for one queue. */
function clientFor(target: RunQueueTarget): SQSClient {
  return new SQSClient({
    region: target.region,
    ...(target.endpoint === undefined ? {} : { endpoint: target.endpoint }),
  })
}

/**
 * The dispatch over a real client.
 *
 * 🛑 THE CAST IS HERE AND NOWHERE ELSE, AND IT IS A CAST OF SHAPE RATHER THAN
 * OF CONTENT: the value being cast is a command this file constructed three
 * lines earlier, so there is no unvalidated input passing through it. Putting
 * it at the boundary is what keeps `publisherOver()` and `receiverOver()` —
 * the parts with logic in them — free of one.
 */
function dispatchOver(client: SQSClient): CommandDispatch {
  return (command) => client.send(command as Parameters<SQSClient['send']>[0])
}

/**
 * THE PUBLISH HALF.
 *
 * ⚠️ NO `MessageGroupId` AND NO `MessageDeduplicationId`, BECAUSE THE QUEUE IS
 * STANDARD AND NOT FIFO — `infra/lib/run-queue-stack.ts` argues that choice at
 * length. The short form: FIFO's five-minute deduplication window is a PARTIAL
 * idempotency that would sit in front of the real one and mask it, and the
 * real one is `run_idempotency_key`, a UNIQUE INDEX with no window at all.
 */
export function publisherOver(dispatch: CommandDispatch, queueUrl: string): RunQueuePublisher {
  return async (message: RunAdmittedMessage) => {
    await dispatch(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: encodeRunQueueMessage(message),
      }),
    )
  }
}

/** The publisher `resolveRunQueuePublisher()` reaches by dynamic import. */
export function sqsRunQueuePublisher(target: RunQueueTarget): RunQueuePublisher {
  return publisherOver(dispatchOver(clientFor(target)), target.url)
}

/**
 * One message, or none.
 *
 * ⚠️ `handle` IS THE RECEIPT HANDLE AND IT IS CARRIED SEPARATELY FROM THE
 * MESSAGE, because it is a fact about THIS delivery rather than about the run.
 * A second delivery of the same message carries a different handle, and
 * `RunAdmittedMessage` must not gain a field that differs between two
 * deliveries of one fact.
 */
export type ReceivedRunMessage =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'message'
      readonly message: RunAdmittedMessage
      readonly handle: string
      /**
       * `ApproximateReceiveCount` — G4366. 1 on the first delivery. An absent
       * or unreadable attribute reads as 1, the direction that never claims a
       * delivery is the LAST: the worst it costs is that a run whose every
       * delivery threw dead-letters (and alarms) instead of reading `failed`.
       */
      readonly receiveCount: number
    }
  | { readonly kind: 'unreadable'; readonly refusal: RunQueueRefusal; readonly handle: string }

interface ReceiveOutput {
  readonly Messages?: ReadonlyArray<{
    readonly Body?: string
    readonly ReceiptHandle?: string
    readonly Attributes?: Readonly<Record<string, string | undefined>>
  }>
}

/**
 * THE RECEIVE HALF.
 *
 * 🛑 `MaxNumberOfMessages: 1`, AND THE ONE IS A DESIGN DECISION RATHER THAN A
 * DEFAULT. A batch would make the worker hold several tenants' scopes in one
 * process lifetime, and the property R-B is built on — *"the worker consumes
 * ONE message and opens exactly THAT tenant's scope"* — is easiest to keep
 * true when it is also what the code does.
 *
 * ⚠️ AN UNREADABLE BODY IS REPORTED AND **NOT DELETED HERE**. Deleting it
 * would destroy the only evidence of whatever wrote it; leaving it lets the
 * redrive policy carry it to the dead-letter queue after `maxReceiveCount`
 * deliveries, which is what a dead-letter queue is for and is the one place
 * a person can look at it.
 */
export function receiverOver(
  dispatch: CommandDispatch,
  queueUrl: string,
  waitSeconds: number,
): () => Promise<ReceivedRunMessage> {
  return async () => {
    const output = (await dispatch(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: waitSeconds,
        /* G4366 — the worker needs to know whether this is the LAST delivery. */
        MessageSystemAttributeNames: ['ApproximateReceiveCount'],
      }),
    )) as ReceiveOutput
    const first = output.Messages?.[0]
    if (first === undefined) return { kind: 'none' }
    const handle = first.ReceiptHandle
    if (handle === undefined || handle === '') return { kind: 'none' }
    const read = parseRunQueueMessage(first.Body ?? '')
    if (!read.ok) return { kind: 'unreadable', refusal: read.refusal, handle }
    const count = Number(first.Attributes?.['ApproximateReceiveCount'])
    const receiveCount = Number.isInteger(count) && count >= 1 ? count : 1
    return { kind: 'message', message: read.message, handle, receiveCount }
  }
}

/** Remove a message the worker has finished with. */
export function deleterOver(
  dispatch: CommandDispatch,
  queueUrl: string,
): (handle: string) => Promise<void> {
  return async (handle: string) => {
    await dispatch(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: handle }))
  }
}

/** The consuming side of one queue, built once per process. */
export interface RunQueueConsumer {
  readonly receive: () => Promise<ReceivedRunMessage>
  readonly remove: (handle: string) => Promise<void>
  readonly close: () => void
}

export function sqsRunQueueConsumer(target: RunQueueTarget, waitSeconds: number): RunQueueConsumer {
  const client = clientFor(target)
  const dispatch = dispatchOver(client)
  return {
    receive: receiverOver(dispatch, target.url, waitSeconds),
    remove: deleterOver(dispatch, target.url),
    close: () => {
      client.destroy()
    },
  }
}
