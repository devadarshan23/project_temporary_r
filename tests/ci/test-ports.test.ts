/**
 * NO TEST BINDS A PORT IT CHOSE, AND NO TEST REACHES A CONTROL DATABASE ON A
 * PORT NOBODY CONFIGURED — G3911 AND G3912, 4 Oct 2026.
 *
 * ┌─ WHY THIS IS A GATE AND NOT A CONVENTION ──────────────────────────────────┐
 * │ Several agents gating on one machine reported `EADDRINUSE` and cancelled   │
 * │ browser suites, because `tests/e2e/single-origin.ts` exported              │
 * │ `FRONT_PORT = 8080` and five suites beside it bound their own literals     │
 * │ (8091, 8093, 8097, 8098, 8099). A gate whose verdict depends on what else  │
 * │ the machine is running is two definitions of green (G108) wearing one      │
 * │ command. The repair — `reserveFront()`, a socket bound on port 0 and HELD  │
 * │ — only stays repaired if the next suite cannot quietly bring a literal     │
 * │ back, which is what §1 is for.                                             │
 * │                                                                            │
 * │ §3 is the same argument for the database: a private-PostgreSQL gate set   │
 * │ `RECONCILE_DB_PORT` and the control-database readers fell back to 5432,    │
 * │ so the "private" run silently read the shared cluster (G3912).            │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ §1 IS A LANDMARK AND SAYS SO: it reads `.listen(…)` arguments and
 * `…PORT` constants on the TypeScript AST. A port threaded through a helper in
 * another module is not seen — which is why §2 also proves the property
 * itself, two fronts at once, rather than only the absence of a literal.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { request as httpRequest, createServer } from 'node:http'
import type { Server } from 'node:http'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

import { reserveFront } from '../e2e/single-origin.ts'
import { alignControlDbPorts } from '../control-db-port.ts'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TESTS = join(REPO, 'tests')

function testFiles(dir: string = TESTS, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      /* `fixtures/` holds deliberately broken inputs other checkers must reject. */
      if (name !== 'node_modules' && name !== 'fixtures') testFiles(p, out)
    } else if (/\.(ts|mjs)$/.test(name)) out.push(p)
  }
  return out
}

function parse(file: string, src: string): ts.SourceFile {
  return ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true)
}

/** A port literal: a number a socket could bind. `0` is the kernel's choice and is the point. */
function isPortLiteral(n: ts.Node): n is ts.NumericLiteral {
  if (!ts.isNumericLiteral(n)) return false
  const v = Number(n.text.replace(/_/g, ''))
  return Number.isInteger(v) && v > 0 && v <= 65535
}

/**
 * Every place a test fixes a port it will LISTEN on. Two shapes, both the
 * shapes this repository actually used: a literal handed to `.listen()` (bare
 * or as `{ port }`), and a `…PORT` constant initialised with a literal — the
 * form every browser suite took before G3911, where the literal and the
 * `listen()` sat two hundred lines apart.
 */
function fixedListenPorts(file: string, src: string): string[] {
  const sf = parse(file, src)
  const hits: string[] = []
  const where = (n: ts.Node): string => `${file}:${String(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1)}`
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'listen') {
      const first = n.arguments[0]
      if (first !== undefined && isPortLiteral(first)) hits.push(`${where(first)} — .listen(${first.text})`)
      if (first !== undefined && ts.isObjectLiteralExpression(first)) {
        for (const p of first.properties) {
          if (ts.isPropertyAssignment(p) && p.name.getText(sf) === 'port' && isPortLiteral(p.initializer)) {
            hits.push(`${where(p)} — .listen({ port: ${p.initializer.text} })`)
          }
        }
      }
    }
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && /PORT$/i.test(n.name.text) &&
        n.initializer !== undefined && isPortLiteral(n.initializer)) {
      hits.push(`${where(n)} — const ${n.name.text} = ${n.initializer.text}`)
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return hits
}

/**
 * ⚠️ THE ALLOW-LIST, ARGUED ENTRY BY ENTRY. It is EMPTY, and a first entry
 * owes a sentence here saying why a fixed port cannot be avoided — not why it
 * is convenient. The infra suites' `5432`/`443` literals do not appear because
 * they are assertions about a deployed security group or a TLS probe target,
 * and neither is handed to `listen()` nor named `…PORT`.
 */
const FIXED_PORT_ALLOWED: ReadonlySet<string> = new Set<string>([])

test('§1 · no test file binds a port it chose', () => {
  const files = testFiles()
  assert.ok(files.length > 300, `scanned only ${String(files.length)} test files — the walk is broken, and a guard over nothing passes`)
  const hits = files
    .filter((f) => !FIXED_PORT_ALLOWED.has(relative(REPO, f)))
    .flatMap((f) => fixedListenPorts(relative(REPO, f), readFileSync(f, 'utf8')))
  assert.deepEqual(hits, [],
    'a test binds a fixed port, so two gate runs on one machine collide at EADDRINUSE (G3911). ' +
      'Bind 0 and read the port back — `reserveFront()` in tests/e2e/single-origin.ts for a browser front.')
})

test('§1a · the detector fires on the shapes this repository actually used (anti-vacuity)', () => {
  assert.equal(fixedListenPorts('x.ts', `server.listen(8080, '127.0.0.1')`).length, 1)
  assert.equal(fixedListenPorts('x.ts', `await app.listen({ port: 9080, host: '127.0.0.1' })`).length, 1)
  assert.equal(fixedListenPorts('x.ts', `const PORT = 8091\nconst HOST = \`127.0.0.1:\${PORT}\``).length, 1)
  assert.equal(fixedListenPorts('x.ts', `export const FRONT_PORT = 8080`).length, 1)
  /* …and stays quiet on the kernel's choice and on a port that is data. */
  assert.equal(fixedListenPorts('x.ts', `server.listen(0, '127.0.0.1')`).length, 0)
  assert.equal(fixedListenPorts('x.ts', `await app.listen({ port: 0, host: '127.0.0.1' })`).length, 0)
  assert.equal(fixedListenPorts('x.ts', `const c = { kind: 'sftp', port: 22 }`).length, 0)
  assert.equal(fixedListenPorts('x.ts', `const PORT = RESERVED_FRONT.port`).length, 0)
})

/** A stand-in plane that answers with the `Host` it was sent. */
async function echoPlane(): Promise<{ url: string; server: Server }> {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end(req.headers.host ?? '')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const a = server.address()
  if (a === null || typeof a === 'string') throw new Error('no port')
  return { url: `http://127.0.0.1:${String(a.port)}`, server }
}

function get(origin: string, path: string, host: string): Promise<{ status: number; body: string }> {
  const u = new URL(path, origin)
  return new Promise((resolve, reject) => {
    const r = httpRequest({ host: u.hostname, port: u.port, path: u.pathname, method: 'GET', headers: { host } }, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (c: string) => { body += c })
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
    })
    r.on('error', reject)
    r.end()
  })
}

test('§2 · two fronts at once take two ports, and each forwards `Host` byte-for-byte (G180)', async () => {
  const plane = await echoPlane()
  const [a, b] = await Promise.all([reserveFront(), reserveFront()])
  try {
    assert.notEqual(a.port, b.port, 'two reservations shared a port')
    assert.equal(a.host, `127.0.0.1:${String(a.port)}`)
    /* Before `serve()` a reservation answers, loudly, and is not a page. */
    assert.equal((await get(a.origin, '/', a.host)).status, 503)
    a.serve(join(REPO, 'frontend', 'dist'), plane.url)
    b.serve(join(REPO, 'frontend', 'dist'), plane.url)
    for (const f of [a, b]) {
      for (const host of [f.host, `ten-mock.localhost:${String(f.port)}`]) {
        const r = await get(f.origin, '/v1/runs', host)
        assert.equal(r.status, 200)
        assert.equal(r.body, host, 'the front rewrote Host — G180 would revoke every session through it')
      }
    }
  } finally {
    await a.close()
    await b.close()
    await new Promise<void>((resolve) => plane.server.close(() => resolve()))
  }
})

const CONTROL_REACH = new Set(['startDataPlane', 'startControlPlane', 'provisionControlPlane', 'controlReadTarget',
  'controlWriteTarget', 'createControlReadPool', 'createControlWritePool'])

/** Does this file open, or start a process that opens, a control-database connection? */
function reachesControlDb(file: string, src: string): boolean {
  const sf = parse(file, src)
  let hit = false
  const visit = (n: ts.Node): void => {
    if (hit) return
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && CONTROL_REACH.has(n.expression.text)) hit = true
    if (ts.isElementAccessExpression(n) && ts.isStringLiteral(n.argumentExpression) &&
        n.argumentExpression.text.startsWith('RECONCILE_CONTROL') && n.expression.getText(sf) === 'process.env') hit = true
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return hit
}

test('§3 · every suite that can reach a control database imports tests/control-db-port.ts FIRST', () => {
  const missing: string[] = []
  let reaching = 0
  for (const f of testFiles()) {
    const rel = relative(REPO, f)
    if (rel === 'tests/control-db-port.ts' || rel === 'tests/ci/test-ports.test.ts') continue
    const src = readFileSync(f, 'utf8')
    if (!reachesControlDb(rel, src)) continue
    reaching += 1
    const sf = parse(rel, src)
    const firstImport = sf.statements.find(ts.isImportDeclaration)
    const spec = firstImport !== undefined && ts.isStringLiteral(firstImport.moduleSpecifier) ? firstImport.moduleSpecifier.text : ''
    if (!spec.endsWith('/control-db-port.ts')) missing.push(`${rel} (first import: ${spec || 'none'})`)
  }
  assert.ok(reaching > 40, `only ${String(reaching)} suites reach a control database — the predicate is broken`)
  assert.deepEqual(missing, [],
    'these suites can reach a control database and do not import tests/control-db-port.ts first, so under a ' +
      'private-PostgreSQL gate their control readers fall back to 5432 — the shared cluster (G3912).')
})

test('§3a · no test spells the control database\'s port fallback itself', () => {
  const hits = testFiles()
    .filter((f) => !f.endsWith('control-db-port.ts'))
    .filter((f) => /\?\?\s*5432\b/.test(readFileSync(f, 'utf8')))
    .map((f) => relative(REPO, f))
  assert.deepEqual(hits, [], 'use controlDbPort() from tests/control-db-port.ts — one answer, not one per suite')
})

test('§4 · the control ports follow RECONCILE_DB_PORT, and a split is refused by name', () => {
  const only: NodeJS.ProcessEnv = { RECONCILE_DB_PORT: '55999' }
  alignControlDbPorts(only)
  assert.equal(only['RECONCILE_CONTROL_DB_PORT'], '55999')
  assert.equal(only['RECONCILE_CONTROL_READ_DB_PORT'], '55999')
  assert.equal(only['RECONCILE_CONTROL_WRITE_DB_PORT'], '55999')

  const control: NodeJS.ProcessEnv = { RECONCILE_DB_PORT: '55999', RECONCILE_CONTROL_DB_PORT: '55998' }
  alignControlDbPorts(control)
  assert.equal(control['RECONCILE_CONTROL_READ_DB_PORT'], '55998', 'the reader must follow the control database, not the data one')

  const none: NodeJS.ProcessEnv = {}
  alignControlDbPorts(none)
  assert.deepEqual(none, {}, 'an unconfigured machine keeps every reader on the one local default')

  assert.throws(() => alignControlDbPorts({ RECONCILE_DB_PORT: '55999', RECONCILE_CONTROL_READ_DB_PORT: '5432' }),
    /RECONCILE_CONTROL_READ_DB_PORT=5432/)
  assert.throws(() => alignControlDbPorts({ RECONCILE_CONTROL_WRITE_DB_PORT: '55001' }),
    /RECONCILE_CONTROL_WRITE_DB_PORT=55001/)
})
