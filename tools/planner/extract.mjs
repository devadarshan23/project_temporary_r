#!/usr/bin/env node
/**
 * ReconcileAI — model graph extractor.
 *
 * Derives docs/model-graph.json from model/*.ts and docs/contracts/*.openapi.yaml.
 * Zero dependencies. Deterministic: same input, same output byte for byte,
 * apart from `generatedAt`.
 *
 *   node tools/planner/extract.mjs
 *
 * WHY THIS IS DERIVED AND NEVER HAND-MAINTAINED. A hand-kept graph drifts from
 * source, and a stale visual is the one artefact class this repository records
 * as having already misled a reader. Regenerating is one command.
 *
 * NO TYPESCRIPT PARSER. The model is written in a consistent house style —
 * `export interface X extends Y {`, one field per line, branded ids declared as
 * `export type XId = Id<'Brand'>`. Line scanning is sufficient and keeps the
 * repository's deliberate zero-dependency posture intact (docs/domain-model.md
 * records the stack as undecided by design; a parser dependency would decide it).
 *
 * THE SIX ESTABLISHED FIGURES this reproduces exactly, and the definitions that
 * produce them — recorded here because each was arrived at by investigation, and
 * a future edit that changes a definition will change a count silently:
 *
 *   128 nodes   = 73 entities + 55 value objects
 *    73 entities      an exported interface declaring its OWN `id:` field
 *    55 value objects an exported interface with NO `id:` that nevertheless
 *                     carries a reference — branded or bare id-shaped. An
 *                     interface with neither is not a graph node at all (there
 *                     are 194 exported interfaces; 66 are pure data shapes).
 *                     `TenantScoped` is excluded by name: it is the mixin by
 *                     which `tenantScoped` is derived, not a node in the graph.
 *   172 typed edges  = 154 resolving + 18 dangling. The dangling 18 are a
 *                     SUBSET of the 172, not an addition to it — a dangling
 *                     edge is a field typed as a branded Id whose brand names
 *                     no interface. Both are `kind: "typed"` in the source
 *                     sense; the graph splits them so the UI can show the break.
 *    55 bare          an id-shaped field name typed as string, not a branded Id.
 *    52 orphan entities  entities with zero inbound edges of kind "typed".
 *
 * KNOWN BOUNDARY, one site, deliberate. A field whose TYPE spans several lines
 * is read from its declaring line only, so references on continuation lines are
 * not edges. Exactly one field in the model is affected — `IdentityConnection.owner`
 * (model/domain.ts:870), a discriminated union whose `partnerId: PartnerId` and
 * `accountId: AccountId` arms sit on lines 872-873. The established figure of 172
 * excludes them too; capturing them would give 174. Recorded here so a future
 * reader knows it is known. Method signatures are excluded on purpose and are
 * not this: a parameter type is not a reference the entity holds.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const MODEL_DIR = path.join(ROOT, 'model')
const CONTRACT_DIR = path.join(ROOT, 'docs', 'contracts')
const OUT = path.join(ROOT, 'docs', 'model-graph.json')

/* ------------------------------------------------------------------ *
 * Shared shapes
 * ------------------------------------------------------------------ */

/** An id-shaped field NAME. The house convention: `fooId`, `fooIds`, `id`. */
const ID_SHAPED = /^[a-zA-Z]*[Ii]ds?$/
/** A field declaration line. Rejects method signatures — they carry a `(`. */
const FIELD_LINE = /^(\s+)(\w+)(\??):\s*(.+)$/
/** A line that is only comment. Excluded from field scanning, kept for braces. */
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*)/

const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)

/* ------------------------------------------------------------------ *
 * 1. Read the modules
 * ------------------------------------------------------------------ */

function readModules() {
  return fs
    .readdirSync(MODEL_DIR)
    .filter((f) => f.endsWith('.ts'))
    .sort()
    .map((file) => {
      const text = fs.readFileSync(path.join(MODEL_DIR, file), 'utf8')
      const lines = text.split('\n')
      return {
        name: file.replace(/\.ts$/, ''),
        file: `model/${file}`,
        basename: file,
        lines,
        // A trailing newline yields a final empty element; `wc -l` counts
        // newlines, so drop it to agree with the figures in the documentation.
        lineCount: lines[lines.length - 1] === '' ? lines.length - 1 : lines.length,
        purpose: headerPurpose(lines),
      }
    })
}

/**
 * The module's one-line purpose, from its header comment. Every module opens
 * with a `/**` block whose second line is the summary:
 *   ` * ReconcileAI — canonical domain model.`
 */
function headerPurpose(lines) {
  if (!lines[0] || !lines[0].startsWith('/**')) return ''
  for (let i = 1; i < Math.min(lines.length, 8); i++) {
    const t = (lines[i] || '').replace(/^\s*\*\s?/, '').trim()
    if (t && t !== '/') return t
  }
  return ''
}

/* ------------------------------------------------------------------ *
 * 2. Interfaces
 *
 * Brace-walk from the `export interface` line to its matching close. Braces
 * inside comments are counted too — verified not to occur in this codebase, and
 * the naive walk is what the established figures were reproduced against.
 * ------------------------------------------------------------------ */

function parseInterfaces(modules) {
  const out = []
  for (const mod of modules) {
    const { lines } = mod
    for (let i = 0; i < lines.length; i++) {
      const head = /^export interface (\w+)(?:\s+extends\s+([^{]+))?/.exec(lines[i])
      if (!head) continue

      let depth = 0
      let opened = false
      const body = []
      for (let j = i; j < lines.length; j++) {
        for (const ch of lines[j]) {
          if (ch === '{') {
            depth++
            opened = true
          } else if (ch === '}') depth--
        }
        if (opened && j > i) body.push({ text: lines[j], line: j + 1 })
        if (opened && depth === 0) break
      }

      const extendsList = (head[2] || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      out.push({
        name: head[1],
        module: mod.name,
        file: mod.file,
        line: i + 1,
        extends: extendsList,
        body,
        // Own identity: an `id:` at the interface's own field depth (two
        // spaces). A nested object's `id` is not the interface's identity.
        hasOwnId: body.some((b) => /^ {2}id\??:/.test(b.text)),
      })
    }
  }
  return out
}

/** Field declarations inside an interface body, at any nesting depth. */
function fieldsOf(iface) {
  const out = []
  for (const b of iface.body) {
    if (COMMENT_LINE.test(b.text)) continue
    const m = FIELD_LINE.exec(b.text)
    if (!m) continue
    out.push({
      name: m[2],
      optional: m[3] === '?',
      type: cleanType(m[4]),
      raw: b.text.trim(),
      line: b.line,
      depth: m[1].length,
    })
  }
  return out
}

/** Strip a trailing line comment, then trailing separators and whitespace. */
function cleanType(t) {
  return t
    .replace(/\s*\/\/.*$/, '')
    .replace(/\s*\/\*.*$/, '')
    .replace(/[,;]\s*$/, '')
    .trim()
}

/**
 * The doc comment immediately above a line, if any. This is what lets the UI
 * tell a DELIBERATE DEFERRAL from SILENT DRIFT: `Solution.endpointIds` is a
 * bare `string[]` and says why, in the four lines above it.
 */
function docCommentAbove(lines, lineNumber) {
  let i = lineNumber - 2 // zero-based index of the line above
  if (i < 0) return ''
  if (!/\*\/\s*$/.test(lines[i] || '')) return ''
  const collected = []
  for (; i >= 0; i--) {
    collected.unshift(lines[i])
    if (/^\s*\/\*\*?/.test(lines[i])) break
  }
  if (i < 0) return ''
  return collected
    .map((l) => l.replace(/^\s*\/\*\*?/, '').replace(/\*\/\s*$/, '').replace(/^\s*\*\s?/, ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/* ------------------------------------------------------------------ *
 * 3. Branded id aliases
 * ------------------------------------------------------------------ */

function parseIdAliases(modules) {
  const decls = []
  for (const mod of modules) {
    mod.lines.forEach((l, i) => {
      const m = /^export type (\w+)\s*=\s*Id<'([^']+)'>/.exec(l)
      if (m) decls.push({ name: m[1], brand: m[2], declaredIn: mod.file, line: i + 1 })
    })
  }
  return decls
}

/* ------------------------------------------------------------------ *
 * 4. Nodes and edges
 * ------------------------------------------------------------------ */

function cardinalityOf(field) {
  if (/\[\]|\bArray</.test(field.type)) return 'many'
  if (field.optional || /\|\s*(null|undefined)\b/.test(field.type)) return 'optional_one'
  return 'one'
}

/**
 * The entity a BARE id-shaped field is plainly naming, when one exists. Strictly
 * mechanical: strip the `Id`/`Ids` suffix and require an exact (case-insensitive)
 * match against a node name, first on the whole remaining name and then on its
 * last camelCase segment. No fuzzy matching — a guess here would put a wrong
 * edge on the graph, which is worse than a missing one.
 */
function inferBareTarget(fieldName, nodeNameByLower) {
  const stem = fieldName.replace(/Ids?$/, '')
  if (!stem) return null
  const direct = nodeNameByLower.get(stem.toLowerCase())
  if (direct) return direct
  const segments = stem.split(/(?=[A-Z])/).filter(Boolean)
  const last = segments[segments.length - 1]
  if (last && last !== stem) {
    const tail = nodeNameByLower.get(last.toLowerCase())
    if (tail) return tail
  }
  return null
}

function buildGraph(modules, interfaces, idAliases) {
  const aliasBrand = new Map()
  for (const a of idAliases) aliasBrand.set(a.name, a.brand)
  const aliasNames = [...aliasBrand.keys()].sort((a, b) => b.length - a.length)
  const aliasGlobal = new RegExp(`\\b(${aliasNames.join('|')})\\b`, 'g')
  const aliasTest = new RegExp(`\\b(${aliasNames.join('|')})\\b`)

  const interfaceNames = new Set(interfaces.map((i) => i.name))

  /**
   * ADDRESSABLE TYPES — interfaces, PLUS exported discriminated unions whose arms
   * carry an `id`.
   *
   * FIXED 7 Aug, and the bug mattered. This resolver indexed `export interface`
   * only, so `Id<'ProcedureStep'>` reported as a brand naming no interface and
   * seven edges resolved to nothing — while the model was CORRECT. `ProcedureStep`
   * is an exported six-arm discriminated union and every arm carries
   * `id: ProcedureStepId`, so the target is genuinely addressable.
   *
   * The tool was about to distort the model: the instruction it produced was to
   * leave `ProcedureStepId` as a naked `= string` alias, which is the defect this
   * extractor exists to surface. A measurement that makes the thing it measures
   * worse is worth fixing before it is trusted again.
   *
   * A union arm without an `id` does not make the union addressable, so the test is
   * on the presence of an `id:` field inside the declaration, not on the shape of
   * the union.
   */
  const addressableUnions = new Set()
  for (const m of modules) {
    const lines = m.lines
    for (let i = 0; i < lines.length; i++) {
      const head = /^export type (\w+)\s*=\s*$|^export type (\w+)\s*=\s*\|/.exec(lines[i])
      if (!head) continue
      const name = head[1] || head[2]
      let depth = 0
      for (let j = i; j < lines.length; j++) {
        depth += (lines[j].match(/[{[(]/g) || []).length
        depth -= (lines[j].match(/[}\])]/g) || []).length
        if (/^\s+id:\s/.test(lines[j])) { addressableUnions.add(name); break }
        if (j > i && depth <= 0 && /^\S/.test(lines[j])) break
      }
    }
  }
  for (const n of addressableUnions) interfaceNames.add(n)

  // --- nodes ---------------------------------------------------------
  const nodes = []
  for (const iface of interfaces) {
    const fields = fieldsOf(iface).filter((f) => f.name !== 'id')
    const carriesReference = fields.some(
      (f) => aliasTest.test(f.type) || (ID_SHAPED.test(f.name) && /\bstring\b/.test(f.type)),
    )
    // `TenantScoped` is the mixin that confers tenant scope, not a thing that
    // is scoped. Counting it as a value object would put the mechanism on the
    // graph beside the things it applies to.
    const isNode = iface.hasOwnId || (iface.name !== 'TenantScoped' && carriesReference)
    if (!isNode) continue
    nodes.push({
      name: iface.name,
      module: iface.module,
      kind: iface.hasOwnId ? 'entity' : 'value_object',
      tenantScoped:
        iface.extends.includes('TenantScoped') ||
        fields.some((f) => f.name === 'tenantId' && f.depth === 2),
      line: iface.line,
    })
  }
  const nodeNames = new Set(nodes.map((n) => n.name))
  const nodeNameByLower = new Map(nodes.map((n) => [n.name.toLowerCase(), n.name]))
  const ifaceByName = new Map(interfaces.map((i) => [i.name, i]))
  const linesByModule = new Map(modules.map((m) => [m.name, m.lines]))

  // --- edges ---------------------------------------------------------
  const edges = []
  for (const node of nodes) {
    const iface = ifaceByName.get(node.name)
    for (const field of fieldsOf(iface)) {
      if (field.name === 'id') continue

      const aliases = [...new Set(field.type.match(aliasGlobal) || [])].sort()
      if (aliases.length) {
        // A field typed as a branded Id. One edge per distinct brand named —
        // a union of two id types is two references, not one.
        for (const alias of aliases) {
          const brand = aliasBrand.get(alias)
          const resolves = interfaceNames.has(brand)
          edges.push({
            from: node.name,
            field: field.name,
            to: resolves ? brand : null,
            typedAs: field.type,
            kind: resolves ? 'typed' : 'dangling',
            cardinality: cardinalityOf(field),
            module: node.module,
            line: field.line,
          })
        }
        continue
      }

      if (ID_SHAPED.test(field.name) && /\bstring\b/.test(field.type)) {
        edges.push({
          from: node.name,
          field: field.name,
          to: inferBareTarget(field.name, nodeNameByLower),
          typedAs: field.type,
          kind: 'bare',
          cardinality: cardinalityOf(field),
          module: node.module,
          line: field.line,
        })
      }
    }
  }

  // --- id types ------------------------------------------------------
  const idTypes = idAliases
    .map((a) => ({
      name: a.name,
      brand: a.brand,
      resolvesTo: interfaceNames.has(a.brand) ? a.brand : null,
      declaredIn: a.declaredIn,
      line: a.line,
    }))
    .sort((a, b) => byName(a, b) || (a.declaredIn < b.declaredIn ? -1 : 1))

  return { nodes, edges, idTypes, nodeNames, aliasBrand, interfaceNames, linesByModule, ifaceByName }
}

/* ------------------------------------------------------------------ *
 * 5. Capabilities, resource classes, and the join between them
 * ------------------------------------------------------------------ */

/** The body lines of `export const NAME = { … }`, by brace walk. */
function constBlock(lines, name) {
  const start = lines.findIndex((l) => l.startsWith(`export const ${name}`))
  if (start < 0) return []
  let depth = 0
  let opened = false
  const body = []
  for (let j = start; j < lines.length; j++) {
    for (const ch of lines[j]) {
      if (ch === '{') {
        depth++
        opened = true
      } else if (ch === '}') depth--
    }
    if (opened && j > start) body.push(lines[j])
    if (opened && depth === 0) break
  }
  return body
}

/** `key: 'value',` at the object's own depth. Order is source order. */
function constValues(body) {
  return body.map((l) => /^ {2}\w+:\s*'([^']+)'/.exec(l)).filter(Boolean).map((m) => m[1])
}

function parseAuthorisationSets(linesByModule) {
  const access = linesByModule.get('access') || []
  const governance = linesByModule.get('governance') || []

  const capabilities = constValues(constBlock(access, 'CAPABILITIES'))
  const resourceClasses = constValues(constBlock(governance, 'ACCESS_RESOURCE_CLASSES'))

  const capabilityResourceClass = {}
  for (const l of constBlock(access, 'CAPABILITY_RESOURCE_CLASS')) {
    const m = /^ {2}(\w+):\s*'([^']+)'/.exec(l)
    if (m) capabilityResourceClass[m[1]] = m[2]
  }
  return { capabilities, resourceClasses, capabilityResourceClass }
}

/* ------------------------------------------------------------------ *
 * 6. Contract operations
 *
 * Line scanning, not a YAML parser. The three specs are machine-generated in
 * shape: a path at two spaces, a method at four, `operationId` beneath it.
 * ------------------------------------------------------------------ */

const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options'])

function parseContracts() {
  if (!fs.existsSync(CONTRACT_DIR)) return { operations: [], files: [] }
  const files = fs
    .readdirSync(CONTRACT_DIR)
    .filter((f) => f.endsWith('.openapi.yaml'))
    .sort()

  const operations = []
  for (const file of files) {
    const tier = file.replace(/\.openapi\.yaml$/, '')
    const lines = fs.readFileSync(path.join(CONTRACT_DIR, file), 'utf8').split('\n')
    let currentPath = null
    let currentMethod = null
    let inPaths = false
    for (const l of lines) {
      if (/^paths:\s*$/.test(l)) {
        inPaths = true
        continue
      }
      if (!inPaths) continue
      if (/^\S/.test(l) && l.trim() !== '') {
        inPaths = false
        continue
      }
      const p = /^ {2}(\/\S*):\s*$/.exec(l)
      if (p) {
        currentPath = p[1]
        currentMethod = null
        continue
      }
      const m = /^ {4}([a-z]+):\s*$/.exec(l)
      if (m && METHODS.has(m[1])) {
        currentMethod = m[1]
        continue
      }
      const o = /^\s+operationId:\s*(\S+)/.exec(l)
      if (o) {
        operations.push({
          tier,
          operationId: o[1],
          method: currentMethod,
          path: currentPath,
        })
      }
    }
  }
  operations.sort(
    (a, b) =>
      (a.tier < b.tier ? -1 : a.tier > b.tier ? 1 : 0) ||
      (a.path < b.path ? -1 : a.path > b.path ? 1 : 0) ||
      (a.operationId < b.operationId ? -1 : 1),
  )
  return { operations, files }
}

/**
 * The contract's OPERATIONAL SURFACE as a token set — operationIds split on
 * camelCase, paths split on separators.
 *
 * Deliberately NOT a raw substring scan of the spec text. Three capability
 * names — propose_resolution, execute_resolution, close_exception — also exist
 * as `AgentAction` members and appear in prose commentary inside the specs. A
 * text scan would score them as covered; they name no operation and no path.
 * That is the exact defect this repository records as recurring: two
 * vocabularies for one word.
 */
function surfaceTokens(operations) {
  const tokens = new Set()
  const add = (t) => {
    if (t) tokens.add(t.toLowerCase())
  }
  const seqs = []
  for (const op of operations) {
    const parts = op.operationId.split(/(?=[A-Z])/).filter(Boolean)
    parts.forEach(add)
    seqs.push(parts.map((p) => p.toLowerCase()))
    const pathParts = (op.path || '').split(/[/{}\-_.]/).filter(Boolean)
    pathParts.forEach(add)
    seqs.push(pathParts.map((p) => p.toLowerCase()))
  }
  // Consecutive-token joins, so `AutonomyRecommendation` matches the
  // operationId `getAutonomyRecommendation`.
  for (const seq of seqs) {
    for (let i = 0; i < seq.length; i++) {
      for (let n = 2; n <= 4 && i + n <= seq.length; n++) {
        tokens.add(seq.slice(i, i + n).join(''))
      }
    }
  }
  return tokens
}

/** Singular/plural tolerance, and nothing more. */
function inSurface(name, tokens) {
  const l = name.toLowerCase()
  return tokens.has(l) || tokens.has(l + 's') || (l.endsWith('s') && tokens.has(l.slice(0, -1)))
}

/* ------------------------------------------------------------------ *
 * 7. Documented-but-unwritten modules
 * ------------------------------------------------------------------ */

/**
 * ⚠️ EXPORTED AND NARROWED ON 5 Oct 2026 — G4416. The C4 page renders this
 * list (its "specified, not written" card) instead of carrying a hand-typed
 * copy, and `docs/c4.html` is itself a `.html` file under `docs/` — so a walk
 * that read it would be measuring its own output: a module name the page
 * printed would keep itself on the list after every other document dropped it.
 * The generated page is therefore excluded BY PATH, and nothing else is.
 */
export const GENERATED_DOCS = new Set(['docs/c4.html'])

export function scanDocsForModules(existing) {
  const found = new Map() // name -> [evidence]
  const roots = [path.join(ROOT, 'docs')]
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : 1,
    )) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(md|html)$/.test(entry.name)) scanFile(full)
    }
  }
  const scanFile = (full) => {
    const rel = path.relative(ROOT, full)
    if (GENERATED_DOCS.has(rel.split(path.sep).join('/'))) return
    const lines = fs.readFileSync(full, 'utf8').split('\n')
    lines.forEach((l, i) => {
      for (const m of l.matchAll(/model\/([a-z][a-z0-9-]*)\.ts/g)) {
        const name = m[1]
        if (existing.has(name)) continue
        if (!found.has(name)) found.set(name, [])
        found.get(name).push(`${rel}:${i + 1}`)
      }
    })
  }
  for (const r of roots) walk(r)
  for (const f of fs.readdirSync(ROOT).filter((f) => f.endsWith('.md')).sort()) {
    scanFile(path.join(ROOT, f))
  }
  return found
}

/* ------------------------------------------------------------------ *
 * 8. Gaps — nine kinds, every one mechanically detectable
 *
 * Ids are STABLE: derived from source names only, never from an ordinal. The
 * owner's dispositions in docs/planning-state.json are keyed on them, so a
 * churning id silently discards a decision.
 * ------------------------------------------------------------------ */

function computeGaps(ctx) {
  const {
    modules,
    interfaces,
    graph,
    idTypes,
    capabilities,
    resourceClasses,
    capabilityResourceClass,
    operations,
  } = ctx
  const { nodes, edges } = graph
  const gaps = []

  const moduleOf = new Map(nodes.map((n) => [n.name, n.module]))
  const nodeByName = new Map(nodes.map((n) => [n.name, n]))
  const linesByModule = graph.linesByModule

  /* --- 1. brand_without_interface ---------------------------------- */
  const danglingByBrand = new Map()
  for (const e of edges) {
    if (e.kind !== 'dangling') continue
    const alias = (e.typedAs.match(/\b\w+Id\b/) || [])[0]
    const brand = graph.aliasBrand.get(alias) || alias
    if (!danglingByBrand.has(brand)) danglingByBrand.set(brand, [])
    danglingByBrand.get(brand).push(e)
  }
  const brandsSeen = new Set()
  for (const idt of idTypes) {
    if (idt.resolvesTo !== null) continue
    if (brandsSeen.has(idt.brand)) continue
    brandsSeen.add(idt.brand)
    const broken = danglingByBrand.get(idt.brand) || []
    // A brand naming no interface is only a defect where something is typed by
    // it. An unused alias is dead weight, not a broken edge.
    if (broken.length === 0) continue
    // The interface(s) the brand plainly meant. Reported even when there are
    // several — which is itself the finding: a brand that could mean two things
    // is worse than one that means nothing.
    const candidates = [...graph.interfaceNames].filter((n) => n.endsWith(idt.brand)).sort()
    gaps.push({
      id: `gap-brand-${idt.brand}`,
      kind: 'brand_without_interface',
      module: idt.declaredIn.replace(/^model\//, '').replace(/\.ts$/, ''),
      subject: idt.name,
      detail:
        `Id<'${idt.brand}'> brands no interface` +
        (candidates.length === 1
          ? `; ${candidates[0]} is the real name`
          : candidates.length > 1
            ? `; ${candidates.join(' and ')} both end with it, so the intended target is ambiguous`
            : '') +
        `. The compiler never resolves a phantom brand, so tsc passes clean and every graph tool breaks.`,
      evidence: `${idt.declaredIn}:${idt.line}`,
      affects: broken.length,
      severity: 'serious',
    })
  }

  /* --- 2. reference_without_type ----------------------------------- */
  for (const e of edges) {
    if (e.kind !== 'bare') continue
    const lines = linesByModule.get(e.module) || []
    const note = docCommentAbove(lines, e.line)
    gaps.push({
      id: `gap-bare-${e.module}-${e.from}-${e.field}`,
      kind: 'reference_without_type',
      module: e.module,
      subject: `${e.from}.${e.field}`,
      // The doc comment is carried here deliberately: it is the only signal
      // separating a DELIBERATE DEFERRAL (Solution.endpointIds says why) from
      // SILENT DRIFT, and the edge shape is fixed by contract.
      detail:
        `Typed as \`${e.typedAs}\` rather than a branded Id` +
        (e.to ? `; the field name names ${e.to}` : '') +
        (note ? `. Declared intent: ${note}` : '. No stated reason.'),
      evidence: `model/${e.module}.ts:${e.line}`,
      affects: null,
      severity: note ? 'minor' : 'moderate',
    })
  }

  /* --- 3. entity_without_identity ---------------------------------- */
  // Bare references naming each value object, so the owner can see which ones
  // something is already trying to address.
  const bareTargets = new Map()
  for (const e of edges) {
    if (e.kind !== 'bare' || !e.to) continue
    bareTargets.set(e.to, (bareTargets.get(e.to) || 0) + 1)
  }
  for (const n of nodes) {
    if (n.kind !== 'value_object') continue
    const inboundBare = bareTargets.get(n.name) || 0
    gaps.push({
      id: `gap-noid-${n.module}-${n.name}`,
      kind: 'entity_without_identity',
      module: n.module,
      subject: n.name,
      detail:
        `Carries references but declares no \`id\` of its own. ` +
        (inboundBare
          ? `${inboundBare} bare id-shaped field(s) name it, so something is already trying to address a row that has no address.`
          : `Legitimate if this is a value object; a defect if it is a record something must point at. The detector cannot decide which — this one is yours.`),
      evidence: `model/${n.module}.ts:${n.line}`,
      affects: inboundBare,
      severity: inboundBare ? 'serious' : 'moderate',
    })
  }

  /* --- 4. entity_unreferenced -------------------------------------- */
  const inboundTyped = new Map()
  for (const e of edges) {
    if (e.kind !== 'typed' || !e.to) continue
    inboundTyped.set(e.to, (inboundTyped.get(e.to) || 0) + 1)
  }
  // An entity's name appearing in a bare id-shaped field ANYWHERE — it may look
  // orphaned only because the reference to it was never typed.
  const bareMentions = new Map()
  for (const e of edges) {
    if (e.kind !== 'bare') continue
    if (e.to) bareMentions.set(e.to, (bareMentions.get(e.to) || 0) + 1)
  }
  for (const n of nodes) {
    if (n.kind !== 'entity') continue
    if (inboundTyped.get(n.name)) continue
    const untyped = bareMentions.get(n.name) || 0
    gaps.push({
      id: `gap-unref-${n.module}-${n.name}`,
      kind: 'entity_unreferenced',
      module: n.module,
      subject: n.name,
      detail: untyped
        ? `Zero inbound typed edges, but ${untyped} bare id-shaped field(s) name it. REFERENCED UNTYPED, not orphaned — it appears unwired only because the reference was left as a string.`
        : `Zero inbound typed edges and no bare field names it. Either terminal by design (an append-only record nothing points at) or genuinely unwired. The detector cannot tell them apart.`,
      evidence: `model/${n.module}.ts:${n.line}`,
      affects: untyped,
      severity: untyped ? 'serious' : 'moderate',
    })
  }

  /* --- 5. types_without_operations --------------------------------- */
  const tokens = surfaceTokens(operations)
  for (const mod of modules) {
    const own = interfaces.filter((i) => i.module === mod.name)
    if (own.length === 0) continue
    const covered = own.filter((i) => inSurface(i.name, tokens)).map((i) => i.name)
    if (covered.length) continue
    const nodeCount = nodes.filter((n) => n.module === mod.name).length
    gaps.push({
      id: `gap-noops-${mod.name}`,
      kind: 'types_without_operations',
      module: mod.name,
      subject: mod.file,
      detail: `${own.length} exported interface(s), ${mod.lineCount} lines, and not one of them appears in an operationId or a path in any contract. The types are designed; nothing can create, read or change them.`,
      evidence: `${mod.file}:1`,
      affects: nodeCount,
      severity: 'serious',
    })
  }

  /* --- 6. capability_without_contract ------------------------------ */
  //
  // "Appears in a contract" means DECLARED AS A REQUIREMENT — the capability's
  // own snake_case spelling, as a value under a capability-bearing key or in a
  // security requirement. Not a text match anywhere in the file, and not an
  // operationId that happens to be its camelCase twin.
  //
  // Both looser tests are wrong here, and each is wrong in a way that hides the
  // finding:
  //
  //   - A RAW TEXT SCAN scores propose_resolution, execute_resolution and
  //     close_exception as covered. All three appear only as `AgentAction`
  //     members and in prose. Two vocabularies, one word.
  //   - A CAMELCASE-TOKEN SCAN additionally scores assign_exception,
  //     send_outbound, advance_procedure, reverse_resolution and install_pack
  //     as covered, because operationIds are spelled `assignException`,
  //     `installPack` and so on. That an operation is NAMED after a capability
  //     is not the operation REQUIRING it — and the resemblance is exactly what
  //     makes the disconnection invisible on a read-through.
  //
  // Verified 6 Aug 2026: the three specs carry no `x-capability`, no
  // `requiredCapability` and no `capabilities` key, and their `security:`
  // blocks reference `sessionContext` — a securityScheme, i.e. authentication.
  // Nothing anywhere states which capability gates which operation. So all 34
  // are uncovered, and this detector will say so until such a key exists.
  const capabilityDeclarations = declaredCapabilities()
  const collidingOperation = new Map()
  for (const op of operations) {
    const snake = op.operationId
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase()
    collidingOperation.set(snake, op)
  }
  for (const cap of capabilities) {
    if (capabilityDeclarations.has(cap)) continue
    const twin = collidingOperation.get(cap)
    gaps.push({
      id: `gap-nocap-${cap}`,
      kind: 'capability_without_contract',
      module: 'access',
      subject: cap,
      detail:
        `Named in CAPABILITIES and gated on by decide(), but no contract declares it as a requirement — there is no x-capability, requiredCapability or capabilities key in any of the three specs, and \`security:\` names an authentication scheme. The authorisation model is disconnected from the API surface.` +
        (twin
          ? ` Note the near miss: \`${twin.operationId}\` (${twin.method} ${twin.path}) is this capability's camelCase twin and still never states that it requires it.`
          : ''),
      evidence: `model/access.ts:${capabilityLine(linesByModule.get('access') || [], cap)}`,
      affects: null,
      severity: 'serious',
    })
  }

  /* --- 7. resource_class_without_capability ------------------------ */
  const classesUsed = new Set(Object.values(capabilityResourceClass))
  for (const rc of resourceClasses) {
    if (classesUsed.has(rc)) continue
    gaps.push({
      id: `gap-noclass-${rc}`,
      kind: 'resource_class_without_capability',
      module: 'governance',
      subject: rc,
      detail: `No capability maps to this class in CAPABILITY_RESOURCE_CLASS, so no grant can reach it and nothing in the system can act on it. An empty class can legitimately be a STATEMENT rather than a gap — only you can say which this is.`,
      evidence: `model/governance.ts:${classLine(linesByModule.get('governance') || [], rc)}`,
      affects: 0,
      severity: 'moderate',
    })
  }

  /* --- 8. module_specified_not_written ----------------------------- */
  const existing = new Set(modules.map((m) => m.name))
  const documented = scanDocsForModules(existing)
  for (const [name, evidence] of [...documented.entries()].sort()) {
    gaps.push({
      id: `gap-nomodule-${name}`,
      kind: 'module_specified_not_written',
      module: name,
      subject: `model/${name}.ts`,
      detail: `Named in the documentation ${evidence.length} time(s); no file exists in model/.`,
      evidence: evidence[0],
      affects: evidence.length,
      severity: 'serious',
    })
  }

  /* --- 9. no_administration_tier ----------------------------------- */
  /**
   * 🛑 THIS GAP WAS UNCONDITIONAL AND ITS DETAIL WENT FALSE ON 19 Sep 2026.
   *
   * It read, on EVERY run, *"administration.openapi.yaml does not exist"* —
   * and G288 landed that file the same day, 59 operations over 52 paths. A
   * gap that cannot close is not a gap; it is a generated artefact asserting
   * something untrue, forever, into `docs/model-graph.json` and into the
   * planner page. §5.6 with the polarity reversed: a control that reports a
   * finding while measuring nothing.
   *
   * Found by G533's registration slice, which ran the extractor and read the
   * output. `tools/check-doc-counts.mjs` could not see it — the sentence has
   * no number in it — and nothing else reads this kind but
   * `tools/planner/index.html`, which already handles an empty list.
   *
   * ⚠️ IT IS MADE CONDITIONAL RATHER THAN DELETED, because the gap is real
   * for as long as the file is absent and this record does not delete a
   * control that was right when written. The closing condition is the file's
   * EXISTENCE and nothing more: whether anything MOUNTS it is a different
   * question, and it is asked by
   * `tests/http/administration-tier-unmounted.test.ts` rather than here — the
   * extractor reads `model/` and `docs/`, and has no notion of a plane.
   */
  const adminTierFile = path.join(CONTRACT_DIR, 'administration.openapi.yaml')
  if (!fs.existsSync(adminTierFile)) {
    // One gap against the contracts as a whole, never per module.
    const tiers = [...new Set(operations.map((o) => o.tier))].sort()
    const paths = new Set(operations.map((o) => o.path))
    gaps.push({
      id: 'gap-no-admin-tier',
      kind: 'no_administration_tier',
      module: null,
      subject: 'docs/contracts',
      detail: `${operations.length} operations across ${paths.size} paths in ${tiers.length} tiers (${tiers.join(', ')}). Every one describes a reconciliation HAPPENING. Nothing describes setting the system up — administration.openapi.yaml does not exist, and the setup surface is most of what a forward deployment engineer touches and all of what a tenant admin touches.`,
      evidence: 'docs/contracts/README.md:1',
      affects: operations.length,
      severity: 'serious',
    })
  }

  gaps.sort(
    (a, b) =>
      (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
  return gaps
}

/**
 * Every capability the contracts DECLARE as a requirement. Reads the spec text
 * for a capability-bearing key and takes its value(s). Empty today, by fact
 * rather than by assumption — and non-empty the moment someone adds the key.
 */
function declaredCapabilities() {
  const declared = new Set()
  if (!fs.existsSync(CONTRACT_DIR)) return declared
  const KEY = /^\s*(x-capabilit(?:y|ies)|requiredCapabilit(?:y|ies)|capabilit(?:y|ies)):\s*(.*)$/
  for (const file of fs.readdirSync(CONTRACT_DIR).filter((f) => f.endsWith('.yaml')).sort()) {
    const lines = fs.readFileSync(path.join(CONTRACT_DIR, file), 'utf8').split('\n')
    for (let i = 0; i < lines.length; i++) {
      const m = KEY.exec(lines[i])
      if (!m) continue
      const inline = m[2].trim()
      if (inline) {
        for (const v of inline.replace(/^\[|\]$/g, '').split(',')) {
          const t = v.trim().replace(/^['"]|['"]$/g, '')
          if (t) declared.add(t)
        }
        continue
      }
      // Block sequence beneath the key.
      for (let j = i + 1; j < lines.length; j++) {
        const item = /^\s*-\s*(.+)$/.exec(lines[j])
        if (!item) break
        declared.add(item[1].trim().replace(/^['"]|['"]$/g, ''))
      }
    }
  }
  return declared
}

function capabilityLine(lines, value) {
  const i = lines.findIndex((l) => new RegExp(`^ {2}\\w+:\\s*'${value}'`).test(l))
  return i < 0 ? 1 : i + 1
}
function classLine(lines, value) {
  const i = lines.findIndex((l) => new RegExp(`^ {2}\\w+:\\s*'${value}'`).test(l))
  return i < 0 ? 1 : i + 1
}

/* ------------------------------------------------------------------ *
 * 9. Assemble and write
 * ------------------------------------------------------------------ */

function sourceCommit() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

function main() {
  const modules = readModules()
  const interfaces = parseInterfaces(modules)
  const idAliases = parseIdAliases(modules)
  const graph = buildGraph(modules, interfaces, idAliases)
  const { capabilities, resourceClasses, capabilityResourceClass } = parseAuthorisationSets(
    graph.linesByModule,
  )
  const { operations } = parseContracts()

  const gaps = computeGaps({
    modules,
    interfaces,
    graph,
    idTypes: graph.idTypes,
    capabilities,
    resourceClasses,
    capabilityResourceClass,
    operations,
  })

  const nodes = [...graph.nodes].sort(
    (a, b) => (a.module < b.module ? -1 : a.module > b.module ? 1 : 0) || byName(a, b),
  )
  const edges = [...graph.edges].sort(
    (a, b) =>
      (a.module < b.module ? -1 : a.module > b.module ? 1 : 0) ||
      a.line - b.line ||
      (a.field < b.field ? -1 : a.field > b.field ? 1 : 0) ||
      (String(a.to) < String(b.to) ? -1 : 1),
  )

  const graphJson = {
    generatedAt: new Date().toISOString(),
    sourceCommit: sourceCommit(),
    modules: modules.map((m) => ({
      name: m.name,
      file: m.file,
      lines: m.lineCount,
      entities: nodes.filter((n) => n.module === m.name && n.kind === 'entity').length,
      valueObjects: nodes.filter((n) => n.module === m.name && n.kind === 'value_object').length,
      purpose: m.purpose,
    })),
    nodes,
    edges,
    idTypes: graph.idTypes,
    capabilities,
    resourceClasses,
    capabilityResourceClass,
    contractOperations: operations,
    gaps,
  }

  // 🛑 THE WRITE IS OPT-IN SINCE 12 Aug 2026, AND THAT IS A BUG FIX, NOT A
  // CONVENIENCE.
  //
  // This line was unconditional, and `tests/model/normalised-description.test.ts`
  // executes this file — so `npm test` REWROTE A COMMITTED ARTEFACT ON EVERY RUN.
  // Every contributor saw `M docs/model-graph.json` after the suite and learned to
  // ignore it, which is how the committed copy sat stale at sourceCommit ac75f80a
  // while the record kept warning about it: the one signal that would have shown
  // the staleness was the same signal everyone had been trained to discard.
  //
  // A test may READ the tree. It may not MUTATE it. `--out` exists so that test
  // can still RUN the extractor — which is the property its own header defends,
  // since reading a possibly-stale snapshot would let it pass against a graph
  // taken before the edit under test — while writing somewhere harmless.
  //
  //   node tools/planner/extract.mjs                  report only, writes nothing
  //   node tools/planner/extract.mjs --write          also writes docs/model-graph.json
  //   node tools/planner/extract.mjs --out <path>     writes there instead
  const outArgIndex = process.argv.indexOf('--out')
  const outPath =
    outArgIndex !== -1 && process.argv[outArgIndex + 1] !== undefined
      ? path.resolve(process.argv[outArgIndex + 1])
      : process.argv.includes('--write')
        ? OUT
        : null
  if (outPath !== null) {
    fs.writeFileSync(outPath, JSON.stringify(graphJson, null, 2) + '\n', 'utf8')
  }

  const count = (k) => edges.filter((e) => e.kind === k).length
  const inbound = new Set(edges.filter((e) => e.kind === 'typed' && e.to).map((e) => e.to))
  const orphans = nodes.filter((n) => n.kind === 'entity' && !inbound.has(n.name)).length
  const byKind = {}
  for (const g of gaps) byKind[g.kind] = (byKind[g.kind] || 0) + 1

  process.stdout.write(
    [
      outPath === null
        ? `graph derived from ${modules.length} modules — NOTHING WRITTEN. Use --write to update docs/model-graph.json.`
        : `${path.relative(ROOT, outPath)} written (${modules.length} modules)`,
      ``,
      `nodes                 ${nodes.length}`,
      `  entities            ${nodes.filter((n) => n.kind === 'entity').length}`,
      `  value objects       ${nodes.filter((n) => n.kind === 'value_object').length}`,
      `typed edges           ${count('typed') + count('dangling')}  (${count('typed')} resolving + ${count('dangling')} dangling)`,
      `bare id-shaped fields ${count('bare')}`,
      `orphan entities       ${orphans}`,
      `id types              ${graph.idTypes.length}`,
      `capabilities          ${capabilities.length}`,
      `resource classes      ${resourceClasses.length}`,
      `contract operations   ${operations.length}`,
      ``,
      `gaps                  ${gaps.length}`,
      ...Object.entries(byKind)
        .sort()
        .map(([k, v]) => `  ${k.padEnd(32)}${v}`),
      ``,
    ].join('\n'),
  )
}

// Guarded since 5 Oct 2026 (G4416) so `scanDocsForModules` can be imported
// by `tools/planner/extract-c4-data.mjs` without running — or writing — the
// whole extraction. Compare resolved paths: the `file://` form silently no-ops
// on a path containing a space (see extract-c4-data.mjs).
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
