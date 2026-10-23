/** A deliberately small declaration index for citation fragments. */
export function maskLine(line, state = { block: false, quote: null, escape: false }) {
  let out = ''
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const next = line[i + 1]
    if (state.block) {
      out += ' '
      if (char === '*' && next === '/') { out += ' '; i += 1; state.block = false }
      continue
    }
    if (state.quote) {
      out += ' '
      if (state.escape) state.escape = false
      else if (char === '\\') state.escape = true
      else if (char === state.quote) state.quote = null
      continue
    }
    if (char === '/' && next === '*') { out += '  '; i += 1; state.block = true; continue }
    if (char === '/' && next === '/') { out += ' '.repeat(line.length - i); break }
    if (char === "'" || char === '"' || char === '`') { out += ' '; state.quote = char; continue }
    out += char
  }
  return out
}

const declaration = /^\s*(?:export\s+)?(?:declare\s+)?(?:abstract\s+)?(interface|type|const|let|var|class|enum|function|namespace|module)\s+([A-Za-z_$][\w$]*)\b/
const member = /^\s*(?:(?:public|private|protected|static|readonly|abstract|declare)\s+)*([A-Za-z_$][\w$]*)\??(?:<[^>]*>)?\s*(?::|\(|,|=)/

export function indexDeclarations(text) {
  const lines = text.split('\n')
  const state = { block: false, quote: null, escape: false }
  const masked = lines.map((line) => maskLine(line, state))
  const declarations = []
  let docStart = null
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*\/\*\*/.test(lines[i])) docStart = i + 1
    const match = masked[i].match(declaration)
    if (!match) {
      if (masked[i].trim() && !/^\s*\*\/?\s*$/.test(lines[i])) docStart = null
      continue
    }
    const [, kind, name] = match
    declarations.push({ kind, name, line: i + 1, start: docStart ?? i + 1, end: lines.length, members: [] })
    docStart = null
  }
  for (let i = 0; i < declarations.length; i += 1) {
    const decl = declarations[i]
    decl.end = (declarations[i + 1]?.line ?? (lines.length + 1)) - 1
    if (decl.kind === 'function') continue
    let depth = 0
    let bodyDepth = null
    let memberStart = null
    for (let line = decl.line - 1; line < decl.end; line += 1) {
      const code = masked[line]
      const before = depth
      const opens = (code.match(/{/g) ?? []).length
      const closes = (code.match(/}/g) ?? []).length
      if (bodyDepth !== null && before === bodyDepth) {
        if (/^\s*\/\*\*/.test(lines[line])) memberStart = line + 1
        const hit = code.match(member)
        if (hit && !['if', 'for', 'while', 'switch', 'return'].includes(hit[1])) {
          decl.members.push({ name: hit[1], line: line + 1, start: memberStart ?? line + 1, end: line + 1 })
          memberStart = null
        }
      }
      depth += opens - closes
      if (bodyDepth === null && opens) bodyDepth = before + 1
    }
  }
  return declarations
}

export function resolveFragment(index, text, fragment) {
  if (fragment.startsWith('"') && fragment.endsWith('"')) {
    const anchor = fragment.slice(1, -1)
    const hits = []
    let offset = 0
    while (true) {
      const found = text.indexOf(anchor, offset)
      if (found < 0) break
      hits.push(found)
      offset = found + anchor.length
    }
    if (hits.length === 0) return { verdict: 'ANCHOR_MISSING' }
    if (hits.length !== 1) return { verdict: 'ANCHOR_AMBIGUOUS', candidates: hits }
    const line = text.slice(0, hits[0]).split('\n').length
    return { verdict: 'RESOLVED', line, start: line, end: line }
  }
  const [parent, ...children] = fragment.split('.')
  const child = children.join('.')
  const parents = index.filter((entry) => entry.name === parent)
  if (!child) {
    if (parents.length === 0) return { verdict: 'NO_SUCH_SYMBOL' }
    if (parents.length > 1) return { verdict: 'AMBIGUOUS', candidates: parents }
    return { verdict: 'RESOLVED', ...parents[0] }
  }
  const candidates = parents.flatMap((entry) => entry.members.filter((entryMember) => entryMember.name === child || entryMember.name === children.at(-1)).map((entryMember) => ({ ...entryMember, parent })))
  if (candidates.length === 0) return { verdict: 'NO_SUCH_SYMBOL' }
  if (candidates.length > 1) return { verdict: 'AMBIGUOUS', candidates }
  return { verdict: 'RESOLVED', ...candidates[0] }
}
