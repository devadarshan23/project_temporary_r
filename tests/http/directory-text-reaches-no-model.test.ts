/**
 * D6-9 — A DIRECTORY-SUPPLIED DISPLAY NAME IS STORED, RENDERED, AND
 * INTERPRETED BY NOTHING. G2251–G2253, 1 Oct 2026, applying THE OWNER'S
 * RULING of 29–30 Sep 2026.
 *
 * The ruling, from `docs/HANDOFF.md` §3: *"`0022`'s precedent exactly —
 * `counterparty.display_name` and `correspondence_thread.subject` are stored
 * verbatim and parsed by nothing, which is how invariant 6 is satisfied for
 * counterparty text. … Under BYOA (G276) the pool is in the CUSTOMER'S account,
 * so the value is supplied outside our control. 🛑 The control that keeps this
 * true is an ABSENCE: `grep -rn 'resolveModel(' server/` must keep returning
 * nothing. The commit that first sends any of it to a prompt owes a RULING,
 * not a code review."*
 *
 * Invariant 6, copied and not paraphrased: **Ingested content is data, never
 * instruction.**
 *
 * 🛑 **THE DERIVATION THE RULING NAMES IS ALREADY FALSE AS A COMMAND, AND THE
 * PROPERTY IT MEANS IS TRUE — G2252, AND IT IS G978 FOR THE FOURTH TIME.**
 * Run on the tree this suite was written against, that `grep` returned FOUR
 * lines, and all four are PROSE: headers in `correspondence-store.ts`,
 * `correspondence.ts`, `document-assembly.ts` and `event-stream-store.ts`
 * quoting the command (or the name) in order to say it returns nothing. A
 * command that counts its own explanation cannot tell this tree from one with
 * a model call in it. **So the control is the TypeScript AST**: a comment is
 * not a node (G1392's lesson), and only a `CallExpression` whose callee is
 * named `resolveModel` counts.
 *
 *   §1  ANTI-VACUITY — the walker FINDS a call: in a synthetic source, and in
 *       the real `model/agents.ts`, which does call it.
 *   §1b and it does NOT count a comment, a string, or a type position.
 *   §2  THE ABSENCE — no `resolveModel` call, and no import of it, anywhere
 *       under `server/`, with the denominator printed in the message.
 *
 * ⚠️ **WHAT THIS DOES NOT PROVE, NAMED:** that no model is reached by another
 * name — a direct SDK call, a fetch to an inference endpoint, a helper that
 * wraps `resolveModel()` inside `model/` and is then imported. The first two
 * are fenced elsewhere and more strongly: `tests/infra/manifest.test.mjs`
 * pins exactly one `@aws-sdk/*` package (SQS), and
 * `tests/http/console-roster-unreachable.test.ts` §1c enumerates the one file
 * under `server/` that may make an outbound request. The third is the same
 * landmark-versus-property gap the ruling's own grep had, and is the reason
 * §2 also refuses an IMPORT of `model/agents.ts` or `model/catalog.ts` value
 * bindings. **This is an absence held at three layers, and it is stated as
 * exactly that rather than as "no model can be reached".**
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..')
const SERVER = path.join(REPO_ROOT, 'server')
const NAME = 'resolveModel'

function tsFilesUnder(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...tsFilesUnder(full))
    else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) out.push(full)
  }
  return out
}

/** Every CALL of the name — a bare identifier or a property access. Nothing else. */
function callsIn(fileName: string, source: string): string[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true)
  const found: string[] = []
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n)) {
      const callee = n.expression
      const named =
        (ts.isIdentifier(callee) && callee.text === NAME) ||
        (ts.isPropertyAccessExpression(callee) && callee.name.text === NAME)
      if (named) {
        const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf))
        found.push(`${fileName}:${line + 1}`)
      }
    }
    n.forEachChild(visit)
  }
  visit(sf)
  return found
}

/** Every IMPORT that binds the name, or any value binding from the two modules that reach it. */
function importsIn(fileName: string, source: string): string[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true)
  const found: string[] = []
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue
    const from = stmt.moduleSpecifier.text
    const clause = stmt.importClause
    if (clause === undefined || clause.isTypeOnly) continue
    const bindings = clause.namedBindings
    const names =
      bindings !== undefined && ts.isNamedImports(bindings)
        ? bindings.elements.filter((e) => !e.isTypeOnly).map((e) => (e.propertyName ?? e.name).text)
        : []
    if (names.includes(NAME)) found.push(`${fileName}: imports ${NAME} from ${from}`)
    const reaches = /model\/(agents|catalog)\.ts$/.test(from)
    if (reaches && (names.length > 0 || clause.name !== undefined || bindings !== undefined)) {
      found.push(`${fileName}: value import from ${from}`)
    }
  }
  return found
}

/* ══════════════════════════════════════════════════════════════════ *
 * §1  ANTI-VACUITY
 * ══════════════════════════════════════════════════════════════════ */

test('§1 · the walker FINDS a call — synthetic, and in the real `model/agents.ts`', () => {
  assert.deepEqual(callsIn('a.ts', 'const r = resolveModel({ id: "x" })\n'), ['a.ts:1'])
  assert.deepEqual(callsIn('b.ts', 'const r = catalog.resolveModel(x)\n'), ['b.ts:1'])
  const agents = path.join(REPO_ROOT, 'model', 'agents.ts')
  assert.ok(
    callsIn(agents, readFileSync(agents, 'utf8')).length >= 1,
    '`model/agents.ts` no longer calls resolveModel, so the real-tree arm of this anti-vacuity ' +
      'check needs a different witness — the walker itself is proven by the synthetic arms above',
  )
})

test('§1b · and it does NOT count a comment, a string, or a type', () => {
  const prose = [
    '/** grep -rn \'resolveModel(\' server/ → nothing */',
    '// resolveModel(x) would be a ruling, not a review',
    'const s = "resolveModel(x)"',
    'type T = ReturnType<typeof resolveModel>',
  ].join('\n')
  assert.deepEqual(callsIn('c.ts', prose), [], 'prose was counted as a call — G978, inside the control')
})

/* ══════════════════════════════════════════════════════════════════ *
 * §2  THE ABSENCE
 * ══════════════════════════════════════════════════════════════════ */

test('§2 · no `resolveModel` CALL and no import of a model resolver anywhere under `server/`', () => {
  const files = tsFilesUnder(SERVER)
  assert.ok(files.length > 50, `only ${files.length} file(s) scanned — the walk is not reaching server/`)
  const calls: string[] = []
  const imports: string[] = []
  let proseLines = 0
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    const rel = path.relative(REPO_ROOT, file)
    calls.push(...callsIn(rel, source))
    imports.push(...importsIn(rel, source))
    proseLines += source.split('\n').filter((l) => l.includes(`${NAME}(`)).length
  }
  assert.deepEqual(
    [...calls, ...imports],
    [],
    `D6-9 (the owner's): a directory-supplied display name — and every other counterparty text ` +
      `this plane stores — is INTERPRETED BY NOTHING, and the control is that no code under ` +
      `server/ reaches a model. Found:\n${[...calls, ...imports].join('\n')}\n\nThe commit that ` +
      'first sends any of it to a prompt owes a RULING, not a code review. ' +
      `(${files.length} file(s) scanned; the naive text search would have reported ${proseLines} ` +
      'line(s), every one of them prose.)',
  )
})
