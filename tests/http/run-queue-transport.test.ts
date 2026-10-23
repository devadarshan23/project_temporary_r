/**
 * THE RUN-QUEUE MESSAGE AND ITS SQS TRANSPORT — WITH NO NETWORK, NO QUEUE AND
 * NO AWS CREDENTIALS. **R-B and R-C, 20 Sep 2026.**
 *
 * ┌─ 🛑 WHY THIS SUITE NEEDS NOTHING, AND WHY THAT IS THE DESIGN ──────────────┐
 * │ `tests/reachability.ts`: a green run must not depend on an unreachable     │
 * │ dependency. `npm run check` must pass on a machine with no AWS account at  │
 * │ all, so a suite that reached SQS would SKIP everywhere but one laptop —    │
 * │ and a skip here is forbidden.                                             │
 * │                                                                            │
 * │ `server/data-plane/sqs-run-queue.ts` therefore takes a DISPATCH: a         │
 * │ function handed a CONSTRUCTED SDK command. These tests drive the real      │
 * │ `SendMessageCommand`, `ReceiveMessageCommand` and `DeleteMessageCommand`   │
 * │ construction and read `.input` off what the module built, so the WIRE      │
 * │ SHAPE is asserted rather than assumed.                                     │
 * │                                                                            │
 * │ ⚠️ WHAT IT DOES **NOT** PROVE, SAID RATHER THAN LEFT TO BE ASSUMED: that   │
 * │ a queue accepts any of it. That is a fact about an account and is not in   │
 * │ the gate, exactly as `tests/e2e/probe-staging.mjs` is not.                 │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT IS ASSERTED ─────────────────────────────────────────────────────────┐
 * │ 1  Encode → parse round-trips, and the encoder writes TWO IDS AND A KIND   │
 * │    and nothing else.                                    run-queue.ts §3    │
 * │ 2  EVERY refusal arm is reachable, BY NAME — and §2z is a CENSUS, so a     │
 * │    sixth arm with no test is a red gate.                                    │
 * │ 3  A refusal carries the `kind` and NOTHING ELSE: no raw body, no          │
 * │    malformed id. A value from a source we just decided not to believe must │
 * │    not reach a log line.                                                    │
 * │ 4  `publisherOver()` builds a `SendMessageCommand` with the queue URL and  │
 * │    the encoded body — and NO `MessageGroupId`/`MessageDeduplicationId`,    │
 * │    because the queue is standard and the real idempotency is a UNIQUE      │
 * │    INDEX with no five-minute window.                                        │
 * │ 5  `receiverOver()` asks for exactly ONE message and long-polls; an empty  │
 * │    receive is `none`; an unreadable body is `unreadable` AND CARRIES ITS   │
 * │    HANDLE, because the redrive policy — not a delete — is what carries it  │
 * │    to the dead-letter queue.                                                │
 * │ 6  `runQueueTarget()` is `null` with no URL set, and reads the endpoint    │
 * │    override only when one is given.                                         │
 * │ 7  🛑 THE FENCE: `resolveRunQueuePublisher()` reaches the SDK module       │
 * │    through a DYNAMIC import, so a plane with no queue never constructs an  │
 * │    `SQSClient`. Read out of the source tree, not reasoned about.            │
 * │ 8  🛑 THE LOCAL QUEUE — `compose.yaml` declares one, and a credential in │
 * │    it CANNOT reach AWS, structurally. ⚠️ **§8 PREVIOUSLY PINNED THE        │
 * │    ABSENCE of a local queue and was DELETED ON PURPOSE on 21 Sep 2026**,   │
 * │    which is what its own text demanded; the quotation and the argument     │
 * │    are at the section.                                                      │
 * │ 8b Nothing in `server/` can CREATE or reconfigure a queue — which is why  │
 * │    the stack declares one, and matches the deployed grant.                  │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import YAML from 'yaml'

import {
  RUN_QUEUE_MESSAGE_KIND,
  RUN_QUEUE_REFUSALS,
  encodeRunQueueMessage,
  parseRunQueueMessage,
  resolveRunQueuePublisher,
  runQueueTarget,
  unconfiguredRunQueue,
  type RunAdmittedMessage,
  type RunQueueRefusal,
} from '../../server/data-plane/run-queue.ts'
import {
  deleterOver,
  publisherOver,
  receiverOver,
  type CommandDispatch,
} from '../../server/data-plane/sqs-run-queue.ts'
import type { RunId, TenantId } from '../../model/kernel.ts'

const QUEUE_URL = 'https://sqs.us-west-2.amazonaws.com/000000000000/reconcile-staging-run-admitted'

const MESSAGE: RunAdmittedMessage = {
  kind: RUN_QUEUE_MESSAGE_KIND,
  tenantId: 'ten_acme' as TenantId,
  runId: 'run_0123456789abcdef' as RunId,
}

/** Every command a dispatch was handed, with its `.input`. */
function recordingDispatch(output: unknown = {}): {
  readonly dispatch: CommandDispatch
  readonly sent: Array<{ readonly name: string; readonly input: Record<string, unknown> }>
} {
  const sent: Array<{ name: string; input: Record<string, unknown> }> = []
  return {
    sent,
    dispatch: async (command) => {
      const named = command as { constructor: { name: string }; input: Record<string, unknown> }
      sent.push({ name: named.constructor.name, input: named.input })
      return output
    },
  }
}

const refusalOf = (body: string): RunQueueRefusal | 'ok' => {
  const read = parseRunQueueMessage(body)
  return read.ok ? 'ok' : read.refusal
}

describe('the run-queue message and its SQS transport', () => {
  /* ================================================================ *
   * §1 · THE CODEC.
   * ================================================================ */

  it('1 · encode -> parse round-trips exactly', () => {
    const read = parseRunQueueMessage(encodeRunQueueMessage(MESSAGE))
    assert.equal(read.ok, true)
    if (!read.ok) return
    assert.deepEqual(read.message, MESSAGE)
  })

  it('1b · the encoded body carries a KIND and TWO IDS and nothing else', () => {
    const parsed = JSON.parse(encodeRunQueueMessage(MESSAGE)) as Record<string, unknown>
    assert.deepEqual(
      Object.keys(parsed).sort(),
      ['kind', 'runId', 'tenantId'],
      '`server/data-plane/run-queue.ts` §3: no definition, no period, no slot fill, no ' +
        'status, no timestamp. **A fact on the wire is a fact that can be STALE or FORGED**, ' +
        'while a fact read inside `withTenantScope()` is one `run_rls` has vouched for — and ' +
        'a message carrying `definitionId` would let whoever can write to the queue choose ' +
        'which definition a run is executed against.',
    )
  })

  it('1c · a field added to the message does NOT ride along unexamined', () => {
    const extra = { ...MESSAGE, definitionId: 'def_should_not_travel' } as RunAdmittedMessage
    const parsed = JSON.parse(encodeRunQueueMessage(extra)) as Record<string, unknown>
    assert.equal(
      Object.hasOwn(parsed, 'definitionId'),
      false,
      '`encodeRunQueueMessage()` spread its argument instead of writing a literal. The ' +
        'literal is what makes §3 an enforced rule rather than a paragraph.',
    )
  })

  /* ================================================================ *
   * §2 · EVERY REFUSAL, BY NAME — AND A CENSUS.
   * ================================================================ */

  const REFUSAL_CASES: ReadonlyArray<readonly [RunQueueRefusal, string]> = [
    ['body_not_json', 'not json at all {'],
    ['body_not_an_object', '[{"kind":"run_admitted"}]'],
    ['kind_unrecognised', JSON.stringify({ kind: 'run_executed', tenantId: 'a', runId: 'b' })],
    ['tenant_id_absent', JSON.stringify({ kind: RUN_QUEUE_MESSAGE_KIND, runId: 'b' })],
    ['run_id_absent', JSON.stringify({ kind: RUN_QUEUE_MESSAGE_KIND, tenantId: 'a' })],
  ]

  for (const [refusal, body] of REFUSAL_CASES) {
    it(`2 · \`${refusal}\` is reachable`, () => {
      assert.equal(refusalOf(body), refusal)
    })
  }

  it('2b · a null body and an empty-string id are refused too, not admitted', () => {
    assert.equal(refusalOf('null'), 'body_not_an_object')
    assert.equal(
      refusalOf(JSON.stringify({ kind: RUN_QUEUE_MESSAGE_KIND, tenantId: '', runId: 'b' })),
      'tenant_id_absent',
      'an EMPTY tenant id was admitted. `withTenantScope(pool, "")` sets `app.tenant_id` to ' +
        'the empty string, which G100`s `nullif(…, \'\')` turns into NULL — so every ' +
        'tenant-scoped table reads empty and the worker reports `run_not_visible` for a ' +
        'message that was simply malformed.',
    )
  })

  it('2z · CENSUS — every declared refusal has a case above', () => {
    const covered = new Set(REFUSAL_CASES.map(([r]) => r))
    const missing = RUN_QUEUE_REFUSALS.filter((r) => !covered.has(r))
    assert.deepEqual(
      missing,
      [],
      `these refusal arms have no test: ${missing.join(', ')}. A refusal nothing drives is a ` +
        'refusal nothing proves reachable — §5.6 — so a sixth arm is a red gate here rather ' +
        'than a thing somebody notices.',
    )
  })

  it('3 · a refusal carries the `kind` and NOTHING ELSE', () => {
    const read = parseRunQueueMessage('{"kind":"run_admitted","tenantId":"<script>"}')
    assert.equal(read.ok, false)
    if (read.ok) return
    assert.deepEqual(
      Object.keys(read).sort(),
      ['ok', 'refusal'],
      'a refusal carried more than its kind. Every value one could attach is a string from a ' +
        'source we have just decided not to believe, and putting it in a refusal is how it ' +
        'reaches a log line, a dashboard or a prompt. `model/run-admission.ts` takes the ' +
        'same position for the same reason.',
    )
    assert.equal(typeof read.refusal, 'string')
  })

  /* ================================================================ *
   * §4 · THE PUBLISH COMMAND.
   * ================================================================ */

  it('4 · `publisherOver()` sends ONE `SendMessageCommand` with the queue URL and the encoded body', async () => {
    const recorder = recordingDispatch()
    await publisherOver(recorder.dispatch, QUEUE_URL)(MESSAGE)

    assert.equal(recorder.sent.length, 1)
    const only = recorder.sent[0]
    assert.equal(only?.name, 'SendMessageCommand')
    assert.equal(only?.input['QueueUrl'], QUEUE_URL)
    assert.equal(only?.input['MessageBody'], encodeRunQueueMessage(MESSAGE))
  })

  it('4b · it sends NO `MessageGroupId` and NO `MessageDeduplicationId`', async () => {
    const recorder = recordingDispatch()
    await publisherOver(recorder.dispatch, QUEUE_URL)(MESSAGE)
    const input = recorder.sent[0]?.input ?? {}
    assert.equal(
      Object.hasOwn(input, 'MessageGroupId') || Object.hasOwn(input, 'MessageDeduplicationId'),
      false,
      'the publisher sent a FIFO field. `runQueueName()` in `infra/lib/config.ts` argues the ' +
        'refusal: FIFO`s deduplication window is FIVE MINUTES and would sit in front of this ' +
        'product`s real idempotency guarantee — `run_idempotency_key`, a UNIQUE INDEX with ' +
        'no window at all — masking it for exactly as long as anybody would be testing.',
    )
  })

  /* ================================================================ *
   * §5 · THE RECEIVE AND DELETE COMMANDS.
   * ================================================================ */

  it('5 · `receiverOver()` asks for exactly ONE message and long-polls', async () => {
    const recorder = recordingDispatch({ Messages: [] })
    const received = await receiverOver(recorder.dispatch, QUEUE_URL, 20)()

    assert.equal(received.kind, 'none')
    const input = recorder.sent[0]?.input ?? {}
    assert.equal(recorder.sent[0]?.name, 'ReceiveMessageCommand')
    assert.equal(input['QueueUrl'], QUEUE_URL)
    assert.equal(
      input['MaxNumberOfMessages'],
      1,
      'the receiver asked for a BATCH. R-B`s property is *"the worker consumes ONE message ' +
        'and opens exactly THAT tenant`s scope"*, and it is easiest to keep true when it is ' +
        'also what the code does.',
    )
    assert.equal(input['WaitTimeSeconds'], 20)
  })

  it('5b · a readable body comes back parsed, with its receipt handle', async () => {
    const recorder = recordingDispatch({
      Messages: [{ Body: encodeRunQueueMessage(MESSAGE), ReceiptHandle: 'rh_abc' }],
    })
    const received = await receiverOver(recorder.dispatch, QUEUE_URL, 20)()
    assert.equal(received.kind, 'message')
    if (received.kind !== 'message') return
    assert.deepEqual(received.message, MESSAGE)
    assert.equal(received.handle, 'rh_abc')
  })

  it('5c · an UNREADABLE body comes back as `unreadable` AND CARRIES ITS HANDLE', async () => {
    const recorder = recordingDispatch({
      Messages: [{ Body: 'not json at all {', ReceiptHandle: 'rh_bad' }],
    })
    const received = await receiverOver(recorder.dispatch, QUEUE_URL, 20)()
    assert.equal(received.kind, 'unreadable')
    if (received.kind !== 'unreadable') return
    assert.equal(received.refusal, 'body_not_json')
    assert.equal(
      received.handle,
      'rh_bad',
      'an unreadable message came back with no handle, so the worker could not act on it at ' +
        'all. It deliberately does NOT delete it — the redrive policy carries it to the ' +
        'dead-letter queue, which is the one place a person can look at whatever wrote it.',
    )
  })

  it('5e · it asks for `ApproximateReceiveCount` and carries it — G4366, the LAST delivery is a fact the queue knows', async () => {
    const recorder = recordingDispatch({
      Messages: [
        {
          Body: encodeRunQueueMessage(MESSAGE),
          ReceiptHandle: 'rh_5',
          Attributes: { ApproximateReceiveCount: '5' },
        },
      ],
    })
    const received = await receiverOver(recorder.dispatch, QUEUE_URL, 20)()
    assert.deepEqual(recorder.sent[0]?.input['MessageSystemAttributeNames'], ['ApproximateReceiveCount'])
    assert.equal(received.kind, 'message')
    if (received.kind !== 'message') return
    assert.equal(received.receiveCount, 5)
  })

  it('5f · an absent or unreadable count reads as 1 — never as the LAST delivery', async () => {
    for (const attributes of [undefined, { ApproximateReceiveCount: 'many' }, { ApproximateReceiveCount: '0' }]) {
      const recorder = recordingDispatch({
        Messages: [
          {
            Body: encodeRunQueueMessage(MESSAGE),
            ReceiptHandle: 'rh_x',
            ...(attributes === undefined ? {} : { Attributes: attributes }),
          },
        ],
      })
      const received = await receiverOver(recorder.dispatch, QUEUE_URL, 20)()
      assert.equal(received.kind === 'message' ? received.receiveCount : null, 1)
    }
  })

  it('5d · `deleterOver()` sends one `DeleteMessageCommand` naming the handle', async () => {
    const recorder = recordingDispatch()
    await deleterOver(recorder.dispatch, QUEUE_URL)('rh_abc')
    assert.equal(recorder.sent.length, 1)
    assert.equal(recorder.sent[0]?.name, 'DeleteMessageCommand')
    assert.equal(recorder.sent[0]?.input['ReceiptHandle'], 'rh_abc')
    assert.equal(recorder.sent[0]?.input['QueueUrl'], QUEUE_URL)
  })

  /* ================================================================ *
   * §6 · THE TARGET, READ FROM THE ENVIRONMENT ONCE.
   * ================================================================ */

  it('6 · `runQueueTarget()` is null with no URL, and takes an endpoint override only when given', async () => {
    const saved = {
      url: process.env['RECONCILE_RUN_QUEUE_URL'],
      endpoint: process.env['RECONCILE_RUN_QUEUE_ENDPOINT'],
      region: process.env['AWS_REGION'],
    }
    try {
      delete process.env['RECONCILE_RUN_QUEUE_URL']
      delete process.env['RECONCILE_RUN_QUEUE_ENDPOINT']
      assert.equal(runQueueTarget(), null)

      /* And the resolver returns the LOUD unconfigured publisher, not a client. */
      const publisher = await resolveRunQueuePublisher()
      const said: string[] = []
      const realError = console.error
      console.error = (...args: unknown[]) => said.push(args.map((a) => String(a)).join(' '))
      try {
        await publisher(MESSAGE)
      } finally {
        console.error = realError
      }
      assert.ok(
        said.some((line) => line.includes('NO RUN QUEUE IS CONFIGURED')),
        'with no queue configured the resolver did not return the LOUD publisher',
      )

      process.env['RECONCILE_RUN_QUEUE_URL'] = QUEUE_URL
      delete process.env['RECONCILE_RUN_QUEUE_ENDPOINT']
      const target = runQueueTarget()
      assert.notEqual(target, null)
      assert.equal(target?.url, QUEUE_URL)
      assert.equal(
        Object.hasOwn(target ?? {}, 'endpoint'),
        false,
        'an endpoint key appeared with no override set. `exactOptionalPropertyTypes` makes ' +
          '`{endpoint: undefined}` a different thing from an absent key, and the SDK reads ' +
          'the presence of the key.',
      )

      process.env['RECONCILE_RUN_QUEUE_ENDPOINT'] = 'http://run-queue:9324'
      assert.equal(runQueueTarget()?.endpoint, 'http://run-queue:9324')
    } finally {
      for (const [name, value] of [
        ['RECONCILE_RUN_QUEUE_URL', saved.url],
        ['RECONCILE_RUN_QUEUE_ENDPOINT', saved.endpoint],
        ['AWS_REGION', saved.region],
      ] as const) {
        if (value === undefined) delete process.env[name]
        else process.env[name] = value
      }
    }
  })

  it('6b · `unconfiguredRunQueue()` does NOT throw — the act has already committed', async () => {
    const realError = console.error
    console.error = () => undefined
    try {
      await unconfiguredRunQueue()(MESSAGE)
    } finally {
      console.error = realError
    }
  })

  /* ================================================================ *
   * §7 · 🛑 THE FENCE, READ OUT OF THE SOURCE TREE.
   * ================================================================ */

  it('7 · the SDK module is reached by a DYNAMIC import and from exactly one place', () => {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const runQueue = readFileSync(
      path.resolve(here, '..', '..', 'server', 'data-plane', 'run-queue.ts'),
      'utf8',
    )
    assert.equal(
      /^import .*sqs-run-queue/m.test(runQueue),
      false,
      '`run-queue.ts` STATICALLY imports the SDK module, so every plane — including one with ' +
        'no queue configured and no AWS credentials — loads `@aws-sdk/client-sqs` at boot. ' +
        'The import must stay dynamic and inside `resolveRunQueuePublisher()`.',
    )
    assert.match(
      runQueue,
      /await import\('\.\/sqs-run-queue\.ts'\)/,
      'the dynamic import is gone; nothing would ever construct an SQS client',
    )
  })

  /* ================================================================ *
   * §8 · 🛑 THE LOCAL QUEUE — AND THIS SECTION WAS DELETED ON PURPOSE
   *      AND REWRITTEN, WHICH IS EXACTLY WHAT ITS OWN TEXT DEMANDED.
   * ================================================================ */

  /*
   * ⚠️ **WHAT STOOD HERE UNTIL 21 Sep 2026, QUOTED RATHER THAN DELETED,
   * BECAUSE IT NAMED THE CONDITION FOR ITS OWN REMOVAL AND THE CONDITION WAS
   * MET:**
   *
   *     "§8 · 🛑 THE LOCAL STACK'S DOCUMENTED REFUSAL, PINNED.
   *      🛑 THIS ASSERTION EXISTS TO BE DELETED, AND THE COMMIT THAT DELETES
   *      IT OWES AN ARGUMENT — R-F's idiom … The refusal is a fact about a
   *      MACHINE rather than a design position: an SQS-compatible service
   *      (ElasticMQ) is the better local experience and **could not be
   *      verified from the machine this slice was built on** …
   *        assert.equal(Object.hasOwn(env, 'RECONCILE_RUN_QUEUE_URL'), false, …)
   *        assert.equal(Object.hasOwn(vars, 'AWS_ACCESS_KEY_ID'), false, …)"
   *
   * 🛑 **THE ARGUMENT IT ASKED FOR: THE PULL FINISHED.** It took longer than
   * the ten-minute window somebody chose, which is not the same fact as *could
   * not be verified* — **a refusal resting on a timeout is a refusal resting on
   * a stopwatch.** `softwaremill/elasticmq-native:1.6.11` runs on `darwin/arm64`,
   * `compose.yaml` declares both queues inline, and the REAL
   * `sqsRunQueuePublisher()` and `sqsRunQueueConsumer()` were driven against it
   * end to end — including the cross-tenant refusal, over the wire. The
   * measured run is on `compose.yaml`'s own face.
   *
   * 🛑 **AND THE ONE ASSERTION THAT MATTERED IS NOT DELETED — IT IS
   * INVERTED AND STRENGTHENED.** The old one forbade an AWS credential
   * ANYWHERE; the stack now sets three, so the property has to be the one that
   * was always underneath: **a credential here must be unable to reach AWS.**
   * That is structural rather than a spelling check — with
   * `RECONCILE_RUN_QUEUE_ENDPOINT` pointed at a container on `data-net`, the
   * SDK connects there and cannot reach `sqs.us-west-2.amazonaws.com` even if
   * a real key arrived — and the dummy-value check stays as the second belt.
   */
  it('8 · the local stack declares a queue, and a credential in it CANNOT reach AWS', () => {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const composePath = path.resolve(here, '..', '..', 'compose.yaml')
    const source = readFileSync(composePath, 'utf8')
    const compose = YAML.parse(source) as {
      services: Record<string, { environment?: Record<string, string> }>
      configs?: Record<string, { content?: string }>
    }

    const dataPlane = compose.services['data-plane']
    assert.ok(dataPlane, '`compose.yaml` no longer declares a `data-plane` service')
    const env = dataPlane.environment ?? {}

    assert.ok(
      typeof env['RECONCILE_RUN_QUEUE_URL'] === 'string' &&
        env['RECONCILE_RUN_QUEUE_URL'] !== '',
      'the local `data-plane` names no run queue, so a run admitted in this stack is ' +
        'published nowhere. That was TRUE and DOCUMENTED until 21 Sep 2026 and the argument ' +
        'for it was that the image could not be verified — it has been. If it is being ' +
        'refused again, refuse it in `compose.yaml`s header and rewrite this assertion ' +
        'there rather than leaving a URL half-removed.',
    )

    /* 🛑 THE STRUCTURAL HALF. */
    const endpoint = env['RECONCILE_RUN_QUEUE_ENDPOINT']
    assert.ok(
      typeof endpoint === 'string' && /^http:\/\/[a-z0-9-]+:\d+\/?$/.test(endpoint),
      'the local `data-plane` sets a queue URL with NO local endpoint override, so the SDK ' +
        'would resolve the queue`s own host and could reach AWS. The endpoint is what makes ' +
        `a credential in this file harmless. Found: ${JSON.stringify(endpoint)}`,
    )
    assert.equal(
      /amazonaws\.com/.test(endpoint ?? ''),
      false,
      'the local stack points at a real AWS endpoint',
    )

    /* ⚠️ AND THE SECOND BELT: any credential set anywhere here is a dummy, and
     * the service that sets one also sets a local endpoint. */
    const OBVIOUS_DUMMIES = new Set(['local', 'test', 'dummy', 'x', 'none'])
    for (const [name, service] of Object.entries(compose.services)) {
      const vars = service.environment ?? {}
      for (const key of ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN']) {
        if (!Object.hasOwn(vars, key)) continue
        assert.ok(
          OBVIOUS_DUMMIES.has(String(vars[key]).toLowerCase()),
          `\`${name}\` sets \`${key}\` to something that is not an obvious dummy. A real AWS ` +
            'credential in a tracked local stack is the published-test-token shape this ' +
            'repository already fixed once, on 16 Aug 2026: a `docker compose up` on a laptop ' +
            'would reach a live queue in `000000000000`.',
        )
        assert.ok(
          typeof vars['RECONCILE_RUN_QUEUE_ENDPOINT'] === 'string',
          `\`${name}\` holds an AWS credential and NO local endpoint override. The dummy ` +
            'value is the weaker of the two controls; the endpoint is the one that makes ' +
            'reaching AWS impossible rather than merely unlikely.',
        )
      }
    }

    /* 🛑 THE QUEUE IS THE STACK'S TO DECLARE AND NOT `server/`'s. */
    const declaration = compose.configs?.['elasticmq']?.content ?? ''
    assert.match(
      declaration,
      /run-admitted-dlq/,
      '`compose.yaml` declares no dead-letter queue. `server/data-plane/run-worker-main.ts` ' +
        'LEAVES an unreadable message on the queue rather than deleting it — deleting ' +
        'destroys the only evidence of whatever wrote it — so without a redrive target one ' +
        'bad body is an infinite redelivery loop locally, exactly as it would be in AWS.',
    )
    assert.match(declaration, /maxReceiveCount\s*=\s*5/)
  })

  it('8b · nothing in `server/` can create a queue, which is why the STACK declares one', () => {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const serverDir = path.resolve(here, '..', '..', 'server')
    const offenders: string[] = []
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry)
        if (statSync(full).isDirectory()) walk(full)
        else if (full.endsWith('.ts') && /CreateQueueCommand|SetQueueAttributesCommand|PurgeQueueCommand/.test(readFileSync(full, 'utf8'))) {
          offenders.push(path.relative(serverDir, full))
        }
      }
    }
    walk(serverDir)
    assert.deepEqual(
      offenders,
      [],
      `these modules can create or reconfigure a queue: ${offenders.join(', ')}. ` +
        '`infra/lib/run-queue-stack.ts` grants `sqs:SendMessage` and ' +
        '`sqs:GetQueueAttributes` and nothing else, so such a call would fail in AWS and ' +
        'succeed locally — which is the worst of the two, because the local stack would then ' +
        'be proving a shape the deployed one refuses.',
    )
  })
})
