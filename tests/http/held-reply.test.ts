/**
 * A BODY'S ANSWER IS HELD UNTIL ITS TRANSACTION COMMITS — G2745.
 *
 * `server/data-plane/authorisation-record.ts`'s `heldReply()` is the root-cause
 * repair for #511's red PR gate: `tests/http/proposal-chain-served.test.ts` §9
 * failed `23 !== 22` on CodeBuild because `sendProblem()` WROTE a refusal to
 * the socket while the act's invariant 10 record was still uncommitted, so the
 * record landed inside the next test's counting window. Reproduced
 * deterministically by sleeping 150 ms before `COMMIT` in `db/tenant-scope.ts`
 * (red on every run without the hold, green with it).
 *
 * This suite pins the mechanism itself, with no database, so the property does
 * not depend on a runner being slow enough to expose it:
 *
 *  §1 a `send()` through the view does NOT send — `reply.sent` stays false
 *     until `flush()`, and the status and content type set through the chain
 *     still reach the client;
 *  §2 the view is NOT thenable — a Fastify reply's `then` settles on send, so a
 *     thenable view returned from the scope's async callback would deadlock
 *     (the first draft of the hold did exactly that);
 *  §3 a body that never sends passes its outcome through untouched;
 *  §4 a body that throws after a held send loses that answer — the client gets
 *     the error, which is what a rolled-back act deserves.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import Fastify from 'fastify'

import { heldReply } from '../../server/data-plane/authorisation-record.ts'

describe('heldReply (G2745)', () => {
  it('§1 · a send through the view is held until flush, and the chain still lands', async () => {
    const app = Fastify()
    let sentBeforeFlush: boolean | null = null
    app.get('/x', async (_request, reply) => {
      const answer = heldReply(reply)
      const body = async (): Promise<unknown> =>
        answer.view.code(409).type('application/problem+json').send({ code: 'held' })
      const outcome = await body()
      sentBeforeFlush = reply.sent
      return answer.flush(outcome)
    })
    const res = await app.inject({ method: 'GET', url: '/x' })
    await app.close()
    assert.equal(sentBeforeFlush, false, 'the view SENT before the scope returned — the hold is gone')
    assert.equal(res.statusCode, 409)
    assert.match(String(res.headers['content-type']), /application\/problem\+json/)
    assert.deepEqual(res.json(), { code: 'held' })
  })

  it('§2 · the view is not thenable, so returning it from an async callback cannot deadlock', () => {
    const app = Fastify()
    app.get('/y', async (_request, reply) => {
      const answer = heldReply(reply)
      assert.equal((answer.view as unknown as { then?: unknown }).then, undefined)
      return answer.flush({ ok: true })
    })
    return app.inject({ method: 'GET', url: '/y' }).then(async (res) => {
      await app.close()
      assert.equal(res.statusCode, 200)
    })
  })

  it('§3 · a body that never sends passes its outcome through', async () => {
    const app = Fastify()
    app.get('/z', async (_request, reply) => {
      const answer = heldReply(reply)
      answer.view.code(201)
      return answer.flush({ made: 1 })
    })
    const res = await app.inject({ method: 'GET', url: '/z' })
    await app.close()
    assert.equal(res.statusCode, 201)
    assert.deepEqual(res.json(), { made: 1 })
  })

  it('§4 · a body that throws after a held send loses that answer', async () => {
    const app = Fastify()
    app.get('/w', async (_request, reply) => {
      const answer = heldReply(reply)
      answer.view.code(200).send({ claimed: 'success' })
      throw new Error('COMMIT failed')
    })
    const res = await app.inject({ method: 'GET', url: '/w' })
    await app.close()
    assert.equal(res.statusCode, 500, 'a rolled-back act was reported with the answer it held')
  })
})
