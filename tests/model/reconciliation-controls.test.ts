/**
 * THE ELEVEN PROSE CONTROLS IN `model/reconciliation.ts`, MADE EXECUTABLE.
 *
 * The module header lists eleven `grep` invocations and asserts each returns 0.
 * A control that lives in a comment is a control nobody runs, and this file is
 * the paying-back of that: every one of them is a test here.
 *
 * ⚠️ COMMENTS ARE STRIPPED BEFORE MATCHING, AND THAT IS LOAD-BEARING. The module
 * header quotes every string it bans. Run over the whole file, SEVEN of the
 * eleven controls here reported violations whose every hit was that header —
 * `new Date`, `new RegExp`, `: any`, `throw`, `price`, `.cost`, `claude-`. A
 * control that FAILS WHILE THE PROPERTY HOLDS teaches people to ignore controls.
 * `naive-matchers-would-fire-on-the-header` below pins that fact so the stripper
 * can never be quietly deleted as decoration.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TARGET = join(REPO_ROOT, 'model', 'reconciliation.ts')

/** The bytes, read once. Byte-level controls may not go through a string. */
const TARGET_BYTES = readFileSync(TARGET)
const TARGET_TEXT = TARGET_BYTES.toString('utf8')

type Mode = 'code' | 'line' | 'block' | 'single' | 'double' | 'template'

interface Frame {
  readonly mode: Mode
  braces: number
}

/**
 * Comments removed, EVERYTHING ELSE KEPT — character by character.
 *
 * ⚠️ WHY NOT THE HEADER'S `grep -vE '^[[:space:]]*(\*|/\*|//)'`. That is a
 * LINE filter, and it is wrong in one direction: `const x = 1 // console.log(x)`
 * keeps its comment, so the control fires on a file where the property holds.
 * Both stripper tests below were red against it.
 *
 * ⚠️ STRING LITERALS ARE PRESERVED ON PURPOSE. G104 bans a model identifier in
 * engine code and a model identifier IS a string literal — a stripper that ate
 * strings would make that control unenforceable while looking greener.
 *
 * Comment characters become spaces and newlines are kept, so a reported line
 * number still points at the real line of the real file.
 *
 * KNOWN LIMIT, STATED RATHER THAN HIDDEN: this does not recognise a regex
 * literal, so `/ab\/\/cd/` would be misread. `model/reconciliation.ts` contains
 * none — `new RegExp` is banned by S1 and there is no literal regex either. The
 * failure mode is loud, not silent: a derailed scanner preserves comment text
 * and the controls go RED. `stripper — the code survives` guards the other
 * direction.
 */
function stripComments(source: string): string {
  const stack: Frame[] = [{ mode: 'code', braces: 0 }]
  let out = ''

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i] ?? ''
    const next = source[i + 1] ?? ''
    const frame = stack[stack.length - 1] ?? { mode: 'code', braces: 0 }
    const parent = stack[stack.length - 2]

    if (frame.mode === 'code') {
      if (ch === '/' && next === '/') {
        stack.push({ mode: 'line', braces: 0 })
        out += '  '
        i += 1
      } else if (ch === '/' && next === '*') {
        stack.push({ mode: 'block', braces: 0 })
        out += '  '
        i += 1
      } else if (ch === "'" || ch === '"' || ch === '`') {
        const mode: Mode =
          ch === "'" ? 'single' : ch === '"' ? 'double' : 'template'
        stack.push({ mode, braces: 0 })
        out += ch
      } else if (ch === '{') {
        frame.braces += 1
        out += ch
      } else if (ch === '}' && frame.braces === 0 && parent?.mode === 'template') {
        stack.pop()
        out += ch
      } else {
        if (ch === '}') frame.braces -= 1
        out += ch
      }
      continue
    }

    if (frame.mode === 'line') {
      if (ch === '\n') {
        stack.pop()
        out += '\n'
      } else {
        out += ' '
      }
      continue
    }

    if (frame.mode === 'block') {
      if (ch === '*' && next === '/') {
        stack.pop()
        out += '  '
        i += 1
      } else {
        out += ch === '\n' ? '\n' : ' '
      }
      continue
    }

    // A string or a template literal: kept verbatim.
    out += ch
    if (ch === '\\') {
      out += next
      i += 1
      continue
    }
    if (frame.mode === 'single' && ch === "'") stack.pop()
    else if (frame.mode === 'double' && ch === '"') stack.pop()
    else if (frame.mode === 'template') {
      if (ch === '`') stack.pop()
      else if (ch === '$' && next === '{') {
        out += next
        i += 1
        stack.push({ mode: 'code', braces: 0 })
      }
    }
  }

  return out
}

interface Subject {
  /** The source with comments removed. */
  readonly code: string
  /** The raw source, comments and all. */
  readonly raw: string
  /** The raw bytes. */
  readonly bytes: Buffer
}

interface Violation {
  readonly line: number
  readonly text: string
}

/**
 * The declaration that closes §3. Not a section banner — a DECLARATION, which
 * is the whole point: a banner lives in a comment, and a range anchored on a
 * comment starts inside the text describing the control.
 */
const SENTINEL = '_MoneySectionEndsHere'

interface Control {
  readonly id: string
  readonly bans: string
  readonly find: (s: Subject) => readonly Violation[]
  /** A fixture that MUST be caught. Never an edit to the module. */
  readonly witness: string
}

function subject(text: string): Subject {
  return {
    code: stripComments(text),
    raw: text,
    bytes: Buffer.from(text, 'utf8'),
  }
}

const MODULE: Subject = {
  code: stripComments(TARGET_TEXT),
  raw: TARGET_TEXT,
  bytes: TARGET_BYTES,
}

/**
 * Every line of `source` matching `pattern`, with 1-based line numbers.
 *
 * ⚠️ A `g` FLAG WOULD MAKE THIS INTERMITTENT — `RegExp.test` with `g` carries
 * `lastIndex` between calls, so a shared pattern would match every OTHER line
 * and a control could report clean on a file that violates it. Rejected rather
 * than worked around, so no pattern here is ever built at runtime.
 *
 * STATED LIMIT: this matches LINE BY LINE, so a banned construct split across
 * two lines — `new\n  RegExp(x)` — is invisible to it. That is inherited from
 * the `grep` controls in the module header and is not fixed here; a matcher
 * over the whole string would report no usable line number.
 */
function linesMatching(source: string, pattern: RegExp): readonly Violation[] {
  if (pattern.global) throw new Error(`stateful pattern: ${String(pattern)}`)
  const out: Violation[] = []
  const lines = source.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i] ?? ''
    if (pattern.test(text)) out.push({ line: i + 1, text: text.trim() })
  }
  return out
}

/**
 * The ONLY value imports `model/reconciliation.ts` may take, by exact text.
 *
 * All three carry the `.ts` extension because node's ESM resolver does not add
 * one and these specifiers are NOT erased — that is the whole difference between
 * them and the `import type` twins beside them in the module.
 * `test_the_permitted_value_imports_are_all_still_present` below stops this
 * list rotting into an allow-list for imports that no longer exist.
 *
 * ⚠️ THIS LIST HELD TWO ENTRIES UNTIL 22 Aug 2026 AND THE THIRD IS A DELIBERATE
 * WIDENING, RECORDED HERE RATHER THAN WAVED THROUGH. G214 makes `FieldPath` a
 * token list, so the engine can no longer use a path as a `Map` key — it needs
 * `fieldPathKey()`, and it needs it as a VALUE. The alternative was to have the
 * engine derive the key itself, which is precisely the second-implementation
 * shape G214 exists to forbid: the seam is the only thing that may touch the
 * representation. So the engine takes the import, and the widening is one
 * function from one module rather than a relaxed rule.
 */
const PERMITTED_VALUE_IMPORTS: readonly string[] = [
  "import { extractionInSetHolds } from './domain.ts'",
  "import { mayAutoResolve } from './policy.ts'",
  "import { fieldPathKey } from './field-path.ts'",
  /* ⚠️ G286/G111, 19 Sep 2026 — THE FOURTH. §3 moved to `model/money.ts`, so
   * this module asks the codec for thirteen names instead of declaring them.
   * 🛑 IT IS WRITTEN ON ONE LINE IN THE MODULE, DELIBERATELY AND AGAINST THE
   * HOUSE STYLE, because this allow-list matches an EXACT SPECIFIER STRING: a
   * multi-line import would have to be licensed here as the bare opening
   * \`import {\`, which licenses any multi-line value import at all and turns an
   * exact allow-list into a shape allow-list. The note above is explicit that
   * two names was never the property — a THIRD, or a change to any of these,
   * still fires. */
  "import { addMoney, compareMoney, guardMoney, guardUnit, isNegativeMoney, isPositiveMoney, isZeroMoney, minMoney, minorUnitsFromCount, minorUnitsOf, sameUnit, subtractMoney, zeroLike } from './money.ts'",
]

/** A control whose subject is the comment-stripped code. */
function codeControl(
  id: string,
  bans: string,
  pattern: RegExp,
  witness: string,
): Control {
  return { id, bans, find: (s) => linesMatching(s.code, pattern), witness }
}

const CONTROLS: readonly Control[] = [
  codeControl(
    'no-console',
    'console. — no telemetry path in the engine',
    /console\./,
    'const x = 1\nconsole.log(x)\n',
  ),
  codeControl(
    'no-clock',
    'new Date / Date.now — no clock, no NaN sort',
    /new Date|Date\.now/,
    'const at = Date.now()\n',
  ),
  codeControl(
    'no-new-regexp',
    'new RegExp — S1, nothing generated is ever executed',
    /new RegExp/,
    'const r = new RegExp(userSuppliedPattern)\n',
  ),
  codeControl(
    'no-math-random',
    'Math.random — determinism',
    /Math\.random/,
    'const tie = Math.random()\n',
  ),
  codeControl(
    'no-any',
    ': any — no escape hatch',
    /:\s*any\b/,
    'function f(v: any) { return v }\n',
  ),
  codeControl(
    'no-throw',
    'throw — failures are values, never exceptions',
    /\bthrow\b/,
    'if (!ok) { throw new Error("unpaired") }\n',
  ),
  codeControl(
    'no-pricing-vocabulary',
    'price / rateCard / unitPrice — invariant 5',
    /price|rateCard|unitPrice/i,
    'const unitPrice = lookupRateCard(meter)\n',
  ),
  codeControl(
    'no-cost-field',
    '.cost — invariant 5',
    /\.cost/,
    'const total = usage.cost\n',
  ),
  codeControl(
    'no-model-literal',
    'anthropic. / claude- / amazon. — G104',
    /anthropic\.|claude-|amazon\./,
    "const m = 'claude-x-y'\n",
  ),
  {
    id: 'type-only-imports',
    bans: 'a value import other than the two §10 declares — G129 and G124',
    // Stricter than the header's `grep -c '^import {'`, which sees only the
    // braced form: `import x from './y'` is a value import too. Over `s.code`,
    // so a comment that happens to begin at column 0 with the word cannot fire.
    //
    // ⚠️ THIS BANNED EVERY VALUE IMPORT UNTIL 9 Aug 2026, AND THE MODULE TOOK
    // NONE. §10 calls `mayAutoResolve()` (G129 — the autonomy gate, which had no
    // production caller) and `extractionInSetHolds()` (G124 — the only reading
    // of an `extraction_in_set` arm), and a call is a value import.
    //
    // AN ALLOW-LIST OF TWO EXACT SPECIFIERS, NOT A COUNT. `hits.length <= 2`
    // would let ANY two value imports through, including two nobody argued for;
    // this way a THIRD — or a change to either of these two — still fires.
    find: (s) =>
      linesMatching(s.code, /^import\b/).filter(
        (v) =>
          !/^import type\b/.test(v.text) &&
          !PERMITTED_VALUE_IMPORTS.includes(v.text),
      ),
    witness: "import { DISPOSITION_FAMILIES } from './domain'\n",
  },
  {
    id: 'money-sentinel',
    bans: 'a raw `amountMinor` read ANYWHERE in the module — G111, one owner',
    /* ⚠️ OVER `s.code`, NEVER `s.raw`. That is unchanged and is still the whole
     * reason this control works: the module's header DESCRIBES this control, so
     * a range anchored in the raw file opens on the sentence about it.
     *
     * 🛑 THE RANGE IS GONE ON 19 Sep 2026 AND THE CONTROL GOT STRONGER — G286.
     * It read: *"a raw `amountMinor` read AFTER THE §3 SENTINEL"*, and scanned
     * from `_MoneySectionEndsHere` downward, because §3 above the sentinel WAS
     * the money section and had to be allowed to name the field. §3 is now
     * `model/money.ts`, so **this module may not name the field at all** and
     * the control is a whole-file scan with no range to anchor, no start index
     * to find and no way to be made self-referential — which the `awk` version
     * of this same property in the module's own header managed twice.
     *
     * ⚠️ THE SENTINEL IS KEPT ANYWAY and so is the test that it still exists.
     * It is no longer load-bearing for THIS control, and it is still the marker
     * §3's replacement text points at; removing it would be a second change
     * riding on this one. */
    find: (s) => {
      const out: Violation[] = []
      const lines = s.code.split('\n')
      for (let i = 0; i < lines.length; i += 1) {
        const text = lines[i] ?? ''
        if (text.includes('amountMinor')) out.push({ line: i + 1, text: text.trim() })
      }
      return out
    },
    witness: `export type ${SENTINEL} = true\nconst n = value.amountMinor\n`,
  },
  {
    id: 'no-nul-bytes',
    bans: 'a NUL byte — the file stays greppable',
    find: (s) => (s.bytes.includes(0) ? [{ line: 0, text: 'NUL byte' }] : []),
    witness: 'const s = "a\u0000b"\n',
  },
]

/**
 * A benign fixture. EVERY control must report nothing on it.
 *
 * ⚠️ THIS IS THE ANTI-TRAP TEST. The module header records a NUL control written
 * as `grep -c $'\x00'`, which bash expands to the EMPTY STRING; grep then matches
 * every line and the control reports catastrophe while the property holds. Any
 * control with an empty or universal needle fails this test.
 */
const BENIGN = 'const total = a + b\nexport type Foo = { bar: string }\n'

/** Look a control up by id so a rename is a failure, not a silent skip. */
function control(id: string): Control {
  const found = CONTROLS.find((c) => c.id === id)
  assert.ok(found, `no control with id ${id}`)
  return found
}

/* -------------------------------------------------------------------- *
 * THE STRIPPER ITSELF. Every control above is only as good as this, and it
 * has to be wrong in NEITHER direction: a comment that survives makes a
 * control fire while the property holds; a string literal that does not
 * survive makes G104 unenforceable, because a model identifier in engine
 * code IS a string literal.
 * -------------------------------------------------------------------- */

test('stripper — a trailing comment on a code line is not matched', () => {
  const hits = control('no-console').find(
    subject('const x = 1 // console.log(x)\n'),
  )
  assert.deepEqual(hits, [])
})

test('stripper — a block comment opened mid-line is not matched', () => {
  const hits = control('no-model-literal').find(
    subject('const x = 1 /* claude-3 lives here */\n'),
  )
  assert.deepEqual(hits, [])
})

test('stripper — a banned literal inside a string IS matched', () => {
  const hits = control('no-model-literal').find(
    subject("const m = 'claude-x-y'\n"),
  )
  assert.equal(hits.length, 1)
})

test('stripper — `//` inside a string does not start a comment', () => {
  const hits = control('no-console').find(
    subject("const s = 'x // console.log(1)'\n"),
  )
  assert.equal(hits.length, 1)
})

test('stripper — a template literal survives', () => {
  const stripped = stripComments('const k = `${a}:${b}`\n')
  assert.equal(stripped.trim(), 'const k = `${a}:${b}`')
})

test('stripper — the code survives', () => {
  // The other direction: a scanner that derails into "comment" forever strips
  // the whole file and every control passes on an empty string.
  for (const landmark of [
    'export function runSetReconciliation(',
    'export type SetDisposition',
    `export type ${SENTINEL} = true`,
  ]) {
    assert.ok(MODULE.code.includes(landmark), `stripped away: ${landmark}`)
  }
})

test('money-sentinel — the sentinel declaration is still in the code', () => {
  // Without this the control is INERT: delete the declaration and the range
  // never opens, so it reports 0 for the wrong reason. §5.6 from the inside.
  assert.ok(
    MODULE.code.includes(`export type ${SENTINEL}`),
    `${SENTINEL} is gone from model/reconciliation.ts — money-sentinel is inert`,
  )
})

test('test_the_permitted_value_imports_are_all_still_present', () => {
  // Without this the allow-list ROTS THE CONTROL: delete one of the imports and
  // the entry stays behind, quietly licensing that exact line to come back
  // later without an argument. §5.6 from the inside, the same way
  // `money-sentinel — the sentinel declaration is still in the code` guards its
  // own range from opening on nothing.
  for (const specifier of PERMITTED_VALUE_IMPORTS) {
    assert.ok(
      MODULE.code.split('\n').some((l) => l.trim() === specifier),
      `permitted but absent: ${specifier} — the allow-list entry is now dead`,
    )
  }
  // And the module really does take exactly these and no more, asserted by
  // NAME rather than by count.
  const actual = MODULE.code
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^import\b/.test(l) && !/^import type\b/.test(l))
  assert.deepEqual(actual, [...PERMITTED_VALUE_IMPORTS])
})

test('naive-matchers-would-fire-on-the-header', () => {
  // Comment stripping is load-bearing, not decoration. Run the code controls
  // over the RAW file and some of them fire — and EVERY hit is a comment.
  const naive = CONTROLS.filter((c) => c.id.startsWith('no-') && c.id !== 'no-nul-bytes')
  const raw = naive.flatMap((c) =>
    c.find({ code: TARGET_TEXT, raw: TARGET_TEXT, bytes: TARGET_BYTES }),
  )
  assert.ok(raw.length > 0, 'the header no longer quotes what it bans')
  for (const v of raw) {
    assert.match(
      v.text,
      /^(\*|\/\*|\/\/)/,
      `line ${v.line} is a REAL violation, not the header quoting itself`,
    )
  }
})

for (const c of CONTROLS) {
  test(`${c.id} — reports nothing on a benign fixture`, () => {
    assert.deepEqual(c.find(subject(BENIGN)), [])
  })

  test(`${c.id} — catches its witness`, () => {
    const hits = c.find(subject(c.witness))
    assert.ok(
      hits.length > 0,
      `control ${c.id} did not catch ${JSON.stringify(c.witness)}`,
    )
  })

  test(`${c.id} — model/reconciliation.ts is clean`, () => {
    assert.deepEqual(c.find(MODULE), [], `control ${c.id} bans ${c.bans}`)
  })
}
