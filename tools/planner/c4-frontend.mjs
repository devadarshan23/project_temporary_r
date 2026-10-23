/**
 * THE FRONTEND HALF OF THE C4 PAGE, DERIVED — G4415, 5 Oct 2026.
 *
 * Until this module the page's frontend section was hand-typed against
 * `design/routes/` — a directory G264 deleted on 18 Sep 2026 — and it went on
 * describing twelve static HTML specimens while `frontend/src` served nineteen
 * routes against a live plane. Nothing could have caught it: a figure typed
 * into `c4-template.html` is an INPUT to `check-c4-freshness.mjs`. Three
 * things are derived here instead, every one from source:
 *
 *   1. THE ROUTE REGISTER — `ROUTE_PATHS` and `ROUTES` imported from
 *      `frontend/src/routes/table.ts` (the module the router itself reads),
 *      the twelve-or-so drawn screens from `frontend/src/main.tsx`, and the
 *      pack's own `Exists` word through `pack-routes.mjs` — the parser
 *      `tests/app/route-provenance.test.ts` uses, shared rather than copied.
 *   2. THE SCREEN → OPERATION JOIN — every path a client in
 *      `frontend/src/api/` or `frontend/site/src/api/` reaches, resolved to a
 *      declared `operationId` by METHOD and PATH, then split against the
 *      served set (`tools/served-set.mjs`, imported): served + used, served +
 *      unused, and used + UNSERVED — the last must be empty.
 *   3. THE NOT-BUILT MARKS — `<NotBuilt>` and `<Soon>` per file, counted in
 *      comment-stripped source (the stripper is `check-clock-fixtures.mjs`'s,
 *      imported) so a header DESCRIBING a mark is not counted as one.
 *
 * ⚠️ WHAT THE JOIN CANNOT SEE — a landmark, not the property. The property is
 * *this browser bundle sends this request*. What is measured is *a path literal
 * passed to a call inside a top-level function of an api client, paired with
 * the `method:` literals in that same function*. A path built from a variable,
 * or a method chosen at run time, is invisible; a function that reaches two
 * paths with two methods is matched by trying every pair and keeping only those
 * a contract declares. A path with no method in its function resolves only
 * when exactly ONE operation is declared on it — otherwise it is reported
 * UNRESOLVED, never guessed.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { stripComments } from '../check-clock-fixtures.mjs'
import { declaredOperations, mountedOperations } from '../served-set.mjs'
import { packRoutes, asPath } from './pack-routes.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const API_DIRS = ['frontend/src/api', 'frontend/site/src/api']
const MARK_ROOTS = ['frontend/src', 'frontend/site/src']
const posix = (p) => p.split(sep).join('/')

/** `{tenantId}` and `${encodeURIComponent(x)}` both normalise to `{}`. */
export const normalisePath = (p) => p.replace(/\{[^}]*\}/g, '{}')

/* ─────────────────────────── 1 · the route register ─────────────────────── */

/** The drawn screens: keys of the `RouteView` screens map in `main.tsx`. */
export function drawnScreens(root = REPO) {
  const src = readFileSync(join(root, 'frontend', 'src', 'main.tsx'), 'utf8')
  /* The same pattern this repository hands out as the derivation —
     `grep -cE "^    '/[^']*': \("` — so the page and the record agree. */
  return [...src.matchAll(/^ {4}'(\/[^']*)': \(/gm)].map((m) => m[1]).sort()
}

export async function routeRegister(root = REPO) {
  const table = await import(pathToFileURL(join(root, 'frontend', 'src', 'routes', 'table.ts')).href)
  const screens = new Set(drawnScreens(root))
  const pack = new Map()
  for (const r of packRoutes(join(root, 'docs', 'handoff-pack', 'User Journeys.dc.html'))) {
    const p = asPath(r.route)
    if (p !== null) pack.set(p, r)
  }
  const routes = table.ROUTE_PATHS.map((path) => {
    const spec = table.ROUTES[path]
    return {
      path,
      kind: spec.kind,
      plane: spec.plane,
      cites: spec.kind === 'pack' ? `${spec.record}#${spec.anchor}` : `${spec.file}#${spec.anchor} (archive/pre-handoff-pack)`,
      screen: screens.has(path),
      packExists: pack.get(path)?.exists ?? null,
    }
  })
  return { routes, screens: [...screens] }
}

/* ─────────────────────────── 2 · the operation join ─────────────────────── */

const PARAM = (name) => `\u0000${name}\u0000`

/**
 * Every (path, methods) an ENTRY function in one api client reaches.
 *
 * Two passes, because clients factor their URLs: `onboardingPath()` returns a
 * template, `sourceUrl(origin, id, 'stop')` appends a literal tail, and
 * `postJson()` carries the method its callers do not. A top-level function
 * another function in the same file calls is a HELPER: its paths are
 * substituted into the caller with the caller's literal arguments, its
 * `method:` literals are the caller's too, and it is never reported on its own.
 * A path is collected only where it is USED — a call or `new` argument, a
 * `return`, a `const` initialiser, or a `.pathname =` suffix — so a constant
 * like `'/v1'` that is merely declared is not a request.
 */
export function clientCalls(ts, file, src) {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS)
  const fns = new Map()
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.body && st.name) fns.set(st.name.text, st)
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) {
          fns.set(d.name.getText(sf), d.initializer)
        }
      }
    }
  }
  const paramsOf = (fn) => fn.parameters.map((p) => ({
    name: p.name.getText(sf),
    dflt: p.initializer && ts.isStringLiteralLike(p.initializer) ? p.initializer.text : null,
  }))
  const localCallee = (node) =>
    ts.isCallExpression(node) && ts.isIdentifier(node.expression) && fns.has(node.expression.text)
      ? node.expression.text : null

  const memo = new Map()
  const calledByOthers = new Set()

  function substitute(templates, helper, call) {
    const params = paramsOf(fns.get(helper))
    return templates.map((t) => {
      let out = t
      params.forEach((p, i) => {
        const a = call.arguments[i]
        const v = a === undefined ? (p.dflt ?? '') : ts.isStringLiteralLike(a) ? a.text : '{}'
        out = out.split(PARAM(p.name)).join(v)
      })
      return out
    })
  }

  function pathsOf(expr, own) {
    if (expr === undefined) return null
    if (ts.isParenthesizedExpression(expr)) return pathsOf(expr.expression, own)
    if (ts.isStringLiteralLike(expr) && !ts.isTemplateExpression(expr)) return expr.text.startsWith('/') ? [expr.text] : null
    if (ts.isConditionalExpression(expr)) {
      const both = [...(pathsOf(expr.whenTrue, own) ?? []), ...(pathsOf(expr.whenFalse, own) ?? [])]
      return both.length > 0 ? both : null
    }
    const helper = localCallee(expr)
    if (helper !== null) {
      const h = analyse(helper)
      return h.paths.length > 0 ? substitute(h.paths, helper, expr) : null
    }
    if (ts.isTemplateExpression(expr)) {
      const spanText = (e) => (ts.isIdentifier(e) && own.has(e.text) ? PARAM(e.text) : '{}')
      let prefixes
      let spans = expr.templateSpans
      if (expr.head.text === '' && spans[0] && localCallee(spans[0].expression) !== null) {
        prefixes = pathsOf(spans[0].expression, own)
        if (prefixes === null) return null
        prefixes = prefixes.map((p) => p + spans[0].literal.text)
        spans = spans.slice(1)
      } else if (expr.head.text.startsWith('/')) {
        prefixes = [expr.head.text]
      } else return null
      let rest = ''
      for (const span of spans) rest += spanText(span.expression) + span.literal.text
      return prefixes.map((p) => p + rest)
    }
    return null
  }

  function analyse(name) {
    if (memo.has(name)) return memo.get(name)
    const placeholder = { paths: [], methods: new Set() }
    memo.set(name, placeholder) // recursion guard
    const fn = fns.get(name)
    const own = new Set(paramsOf(fn).map((p) => p.name))
    const bases = []
    const suffixes = []
    const methods = new Set()
    const take = (expr) => { const p = pathsOf(expr, own); if (p) bases.push(...p); return p !== null }
    const visit = (node) => {
      const callee = localCallee(node)
      if (callee !== null && callee !== name) {
        calledByOthers.add(callee)
        for (const m of analyse(callee).methods) methods.add(m)
      }
      /* A local function with no path of its own (`planeEndpoint`, `postJson`,
         `readJson`) is plumbing: its ARGUMENTS are where the path is. */
      const plumbing = callee === null || callee === name || analyse(callee).paths.length === 0
      if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && plumbing) {
        for (const a of node.arguments ?? []) take(a)
      }
      if (ts.isReturnStatement(node) && node.expression) take(node.expression)
      if (ts.isVariableDeclaration(node) && node.initializer) take(node.initializer)
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          /\.pathname$/.test(node.left.getText(sf)) && ts.isTemplateExpression(node.right)) {
        const t = node.right
        if (t.head.text === '' && t.templateSpans[0] && /\.pathname$/.test(t.templateSpans[0].expression.getText(sf))) {
          let suffix = t.templateSpans[0].literal.text
          for (const span of t.templateSpans.slice(1)) {
            const e = span.expression
            suffix += (ts.isIdentifier(e) && own.has(e.text) ? PARAM(e.text) : '{}') + span.literal.text
          }
          suffixes.push(suffix)
        }
      }
      if (ts.isPropertyAssignment(node) && node.name.getText(sf) === 'method' && ts.isStringLiteral(node.initializer)) {
        methods.add(node.initializer.text.toUpperCase())
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'readJson') {
        methods.add('GET')
      }
      ts.forEachChild(node, visit)
    }
    visit(fn.body ?? fn)
    const unique = [...new Set(bases)]
    const paths = suffixes.length > 0 ? unique.flatMap((b) => suffixes.map((s) => b + s)) : unique
    const result = { paths, methods }
    memo.set(name, result)
    return result
  }

  for (const name of fns.keys()) analyse(name)
  const finish = (p) => normalisePath(p.replace(/\u0000[^\u0000]*\u0000/g, '{}')).replace(/\/+/g, '/').replace(/(.)\/$/, '$1')
  const out = []
  for (const name of [...fns.keys()].sort()) {
    if (calledByOthers.has(name)) continue
    const { paths, methods } = memo.get(name)
    for (const path of [...new Set(paths.map(finish))]) out.push({ file, fn: name, path, methods: [...methods].sort() })
  }
  return out
}

function listTs(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts')).sort().map((f) => join(dir, f))
}

/**
 * The join. `ack` is the acknowledged lists from `c4-acknowledged.json`:
 * `servedUnused` (operationId → why no client reaches it) and
 * `nonContractPaths` (path → why a client reaches something no tier declares).
 */
export function operationJoin(ts, { root = REPO, ack = { servedUnused: {}, nonContractPaths: {} } } = {}) {
  const declared = declaredOperations(root)
  const mounted = mountedOperations(root, declared)
  const byKey = new Map()
  const byPath = new Map()
  for (const [id, d] of declared) {
    const np = normalisePath(d.path)
    byKey.set(`${d.method.toUpperCase()} ${np}`, id)
    byPath.set(np, [...(byPath.get(np) ?? []), id])
  }

  const used = new Map()
  const unresolved = []
  const nonContract = []
  const resolveIds = (call) => {
    if (call.methods.length > 0) return call.methods.map((m) => byKey.get(`${m} ${call.path}`)).filter(Boolean)
    return (byPath.get(call.path) ?? []).length === 1 ? byPath.get(call.path) : []
  }
  for (const dir of API_DIRS) {
    for (const abs of listTs(join(root, dir))) {
      const file = posix(relative(root, abs))
      const calls = clientCalls(ts, file, readFileSync(abs, 'utf8'))
      /* A function whose paths come from a CONDITIONAL (`parkedUrl`'s
         `arrivalId === null ? '/parked' : …`) yields every branch crossed with
         every suffix, and some crossings name nothing. An unresolved path is
         therefore reported only when NO path of the same function resolved —
         a function that reaches nothing declared is the defect; a dead branch
         of one that does is not. */
      const resolvedFns = new Set(calls.filter((c) => resolveIds(c).length > 0).map((c) => c.fn))
      for (const call of calls) {
        const ids = resolveIds(call)
        if (ids.length === 0) {
          if (call.path in (ack.nonContractPaths ?? {})) nonContract.push({ ...call, why: ack.nonContractPaths[call.path] })
          else if (!resolvedFns.has(call.fn)) unresolved.push(call)
          continue
        }
        for (const id of ids) used.set(id, [...new Set([...(used.get(id) ?? []), `${file}#${call.fn}`])])
      }
    }
  }

  const tierOf = (id) => declared.get(id).file.replace('.openapi.yaml', '')
  const servedUsed = []
  const servedUnused = []
  const usedUnserved = []
  for (const id of [...mounted].sort()) {
    if (used.has(id)) servedUsed.push({ op: id, tier: tierOf(id), by: used.get(id) })
    else servedUnused.push({ op: id, tier: tierOf(id), ack: ack.servedUnused?.[id] ?? null })
  }
  for (const id of [...used.keys()].sort()) {
    if (!mounted.has(id)) usedUnserved.push({ op: id, tier: tierOf(id), by: used.get(id) })
  }

  /* Served and declared, per tier — the predicate the Level 2 badges read. */
  const tiers = {}
  for (const [id, d] of declared) {
    const t = d.file.replace('.openapi.yaml', '')
    tiers[t] ??= { declared: 0, served: 0 }
    tiers[t].declared++
    if (mounted.has(id)) tiers[t].served++
  }

  return {
    declared: declared.size,
    served: mounted.size,
    tiers: Object.fromEntries(Object.entries(tiers).sort(([a], [b]) => a.localeCompare(b))),
    servedUsed,
    servedUnused,
    usedUnserved,
    unresolved,
    nonContract,
  }
}

/* ─────────────────────────── 3 · the not-built marks ────────────────────── */

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir).sort()) {
    const abs = join(dir, e)
    if (statSync(abs).isDirectory()) walk(abs, out)
    else if (e.endsWith('.tsx')) out.push(abs)
  }
  return out
}

export function markCounts(root = REPO) {
  const byFile = []
  for (const r of MARK_ROOTS) {
    for (const abs of walk(join(root, r))) {
      const code = stripComments(readFileSync(abs, 'utf8'))
      const notBuilt = (code.match(/<NotBuilt\b/g) ?? []).length
      const soon = (code.match(/<Soon\b/g) ?? []).length
      if (notBuilt + soon > 0) byFile.push({ file: posix(relative(root, abs)), notBuilt, soon })
    }
  }
  return {
    notBuilt: byFile.reduce((n, f) => n + f.notBuilt, 0),
    soon: byFile.reduce((n, f) => n + f.soon, 0),
    byFile,
  }
}
