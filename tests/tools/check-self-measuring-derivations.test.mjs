/**
 * THE CHECKER FOR A COMMAND THAT COUNTS ITS OWN EXPLANATION — G2081.
 *
 * ┌─ WHY THE FIXTURES ARE FILES AND NOT STRINGS IN THIS SUITE ────────────────┐
 * │ `tools/check-clock-fixtures.mjs` records that its FIRST RUN FAILED THE     │
 * │ GATE ON ITS OWN TEST SUITE (G1355), and that it was repaired by            │
 * │ UNIFORMITY — a fixture directory excluded as a CLASS — rather than by an   │
 * │ exemption for itself. This control is in exactly that position and takes   │
 * │ exactly that repair: every deliberately-defective corpus lives under       │
 * │ `tests/tools/fixtures/`, which `EXCLUDED_PREFIXES` refuses to enter, and   │
 * │ **`tools/check-self-measuring-derivations.mjs` itself is scanned like any  │
 * │ other file, with no exemption of any kind.** §7 asserts that.              │
 * │                                                                            │
 * │ The inline command strings that do appear below name paths that do not     │
 * │ exist at the repository root, so the real run reads them as unevaluable    │
 * │ and they cannot become findings. That is a property of the strings, not a  │
 * │ dispensation.                                                              │
 * └────────────────────────────────────────────────────────────────────────────┘
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, copyFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  audit,
  corpusFiles,
  extractCommands,
  quotedPatternSpans,
  toJsRegex,
  KNOWN,
  SWEEP_23_SEP,
  SWEEP_23_SEP_CLASSIFIED,
  EXCLUDED_PREFIXES,
} from '../../tools/check-self-measuring-derivations.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..')
const FIXTURES = join(HERE, 'fixtures', 'self-measuring')

const auditFixtures = (files) => audit({ root: FIXTURES, files })

describe('check-self-measuring-derivations', () => {
  // ───────────────────────────────────────────────────────────────────────
  test('§1 · THE CAPTURED RED — a file that breaks its own derivation', () => {
    const { findings } = auditFixtures(['corpus.yaml'])
    assert.equal(findings.length, 1, 'corpus.yaml quotes a count of a token it contains')
    assert.equal(findings[0].pattern, 'widgetId:')
    assert.deepEqual(
      findings[0].selfMatches.map((s) => `${s.file}:${s.line}`),
      ['corpus.yaml:2'],
      'the self-match is the comment line that quotes the command, and nothing else',
    )
  })

  test('§1a · and the miscount is real — 3 matches against 2 declarations', () => {
    const { findings } = auditFixtures(['corpus.yaml'])
    // two real `widgetId:` keys, plus the quotation the finding names
    assert.equal(findings[0].selfMatches.length, 1)
  })

  // ───────────────────────────────────────────────────────────────────────
  test('§2 · THE CAPTURED GREEN — the same command, quoted outside its own scope', () => {
    const { findings } = auditFixtures(['safe.yaml', 'safe-quote.md'])
    assert.deepEqual(
      findings,
      [],
      'a pattern may be spelled anywhere EXCEPT inside the files the command searches; ' +
        'if this ever goes red the rule has been widened into "never mention a command"',
    )
  })

  test('§3 · THE DEFENCE — an anchored pattern cannot match its own quotation', () => {
    const { findings } = auditFixtures(['anchored.yaml'])
    assert.deepEqual(findings, [], 'the quotation is indented under a `#`, the declarations are not')
  })

  // ───────────────────────────────────────────────────────────────────────
  test('§4 · BASIC regular expressions — the escaped pipe is the OPERATOR', () => {
    // G978's own command. Read as a literal this matches nothing and the
    // finding is lost; read as BRE it is an alternation and matches its line.
    assert.equal(toJsRegex('a\\|b', { extended: false, fixed: false }), 'a|b')
    assert.equal(toJsRegex('a|b', { extended: false, fixed: false }), 'a\\|b')
    assert.equal(toJsRegex('a|b', { extended: true, fixed: false }), 'a|b')
    assert.equal(toJsRegex('a|b', { extended: false, fixed: true }), 'a\\|b')

    const { findings } = auditFixtures(['bre.md'])
    assert.equal(findings.length, 1, 'the BRE alternation must match the line it is written on')
    assert.equal(findings[0].pattern, 'alphaLib\\|betaLib')
  })

  // ───────────────────────────────────────────────────────────────────────
  test('§5 · THE FIRST DETECTOR IS RED HERE AND THE SECOND IS NOT', () => {
    // A line that MENTIONS grep and separately contains the pattern is not a
    // quotation of a command. The blunt detector reported 131 against this
    // tree and the precise one reports 83; this fixture is one of the 48.
    const { findings } = auditFixtures(['blunt.md', 'blunt-quote.md'])
    assert.deepEqual(
      findings,
      [],
      'the match must sit INSIDE the pattern argument of a quoted command, not merely on a line with one',
    )
  })

  test('§5a · and the span reader is the thing that makes that true', () => {
    const spans = quotedPatternSpans("see `grep -rn 'plainWord' blunt.md` for more")
    assert.equal(spans.length, 1)
    assert.equal(spans[0].value, 'plainWord')

    // a line mentioning the tool with no pattern argument yields no span
    assert.deepEqual(quotedPatternSpans('the word plainWord appears here, and so does grep.'), [])
  })

  // ───────────────────────────────────────────────────────────────────────
  describe('§6 · the parser, and three defects it was built with', () => {
    test('§6a · a block comment marker does not survive a line continuation', () => {
      // MEASURED, NOT FEARED. The leading `*` of the continued line was being
      // read as a path, and a bare `*` expands to the whole tree — so ONE
      // continued command in ONE header contaminated every finding in the run
      // with matches from files it had never searched.
      const source = ['/**', " *     grep -rn 'someToken:' \\", ' *       nowhere/a.ts nowhere/b.ts', ' */'].join('\n')
      const [cmd] = extractCommands(source, 'x.ts')
      assert.equal(cmd.evaluable, true)
      assert.deepEqual(cmd.paths, ['nowhere/a.ts', 'nowhere/b.ts'], 'the comment star is not a path')
    })

    test('§6b · a trailing shell comment is not a list of paths', () => {
      // `… nowhere/x.ts  # 26 of 136 served` parsed `#`, `26`, `of` … as PATHS,
      // none of which exists — which made the whole command UNEVALUABLE and
      // silently exempted the completion plan's own derivation from this gate.
      const [cmd] = extractCommands("grep -rn 'someToken:' nowhere/x.ts  # 26 of 136 served", 'x.md')
      assert.deepEqual(cmd.paths, ['nowhere/x.ts'])
    })

    test('§6c · a bare star is refused rather than expanded to the tree', () => {
      const { findings, evaluable } = audit({ root: FIXTURES, files: ['corpus.yaml'] })
      assert.ok(evaluable >= 1)
      // nothing outside the fixture set may ever appear in a fixture-scoped run
      for (const f of findings) for (const s of f.selfMatches) assert.ok(!s.file.includes('CLAUDE.md'))
    })

    test('§6d · an unquoted pattern is refused, not guessed at', () => {
      const [cmd] = extractCommands('grep -rn someToken nowhere/x.ts', 'x.md')
      assert.equal(cmd.evaluable, false)
      assert.equal(cmd.reason, 'unquoted pattern')
    })
  })

  // ───────────────────────────────────────────────────────────────────────
  test('§7 · THE CHECKER TAKES NO EXEMPTION FOR ITS OWN FILE', () => {
    const files = corpusFiles(REPO)
    assert.ok(
      files.includes('tools/check-self-measuring-derivations.mjs'),
      'this control is inside its own corpus. It passes because none of the commands quoted in ' +
        'its header searches `tools/` — which is the property it exists to teach, not a dispensation.',
    )
    assert.ok(files.includes('CLAUDE.md'), 'the record that hands out the most derivations is scanned')
    assert.ok(
      !files.some((f) => f.startsWith('tests/tools/fixtures/')),
      'deliberately defective corpora are excluded as a CLASS — the repair `check-clock-fixtures` ' +
        'records making on its own first run — and never by naming this checker',
    )
    assert.ok(EXCLUDED_PREFIXES.includes('tests/tools/fixtures'))
  })

  // ───────────────────────────────────────────────────────────────────────
  describe('§8 · the census is red in BOTH directions', () => {
    test('§8a · every censused pattern still self-matches, so the register cannot rot', () => {
      const { findings } = audit({ root: REPO })
      const live = new Set(findings.map((f) => f.pattern))
      const stale = [...KNOWN.map((k) => k.pattern), ...SWEEP_23_SEP].filter((p) => !live.has(p))
      assert.deepEqual(
        stale,
        [],
        'a census entry that no longer self-matches must be DELETED in the commit that repaired it. ' +
          'Leaving it is a register nobody can trust, and it would let a re-broken derivation pass.',
      )
    })

    test('§8b · nothing in the tree is a finding without a census entry', () => {
      const { findings } = audit({ root: REPO })
      const censused = new Set([...KNOWN.map((k) => k.pattern), ...SWEEP_23_SEP])
      assert.deepEqual(
        findings.filter((f) => !censused.has(f.pattern)).map((f) => f.pattern),
        [],
        'a NEW self-measuring derivation fails the gate. That ratchet is the point: G978 diagnosed ' +
          'this class in writing and its own command went from three self-matches to five while the ' +
          'finding sat on the page.',
      )
    })

    test('§8c · the two repaired derivations are NOT in the census, because they are repaired', () => {
      const censused = new Set([...KNOWN.map((k) => k.pattern), ...SWEEP_23_SEP])
      assert.ok(!censused.has('operationId:'), 'repaired at docs/contracts/administration.openapi.yaml §8')
      assert.ok(!censused.has('handlers:'), 'repaired by tools/served-set.mjs and five header rewrites')
    })

    test('§8d · and the census is not empty, which would make §8b vacuous', () => {
      assert.ok(KNOWN.length > 0)
      assert.ok(SWEEP_23_SEP.length > 0)
    })

    // ─────────────────────────────────────────────────────────────────────
    // G2183, 28 Sep 2026. The 23 Sep sweep recorded eighty entries FAIL-CLOSED
    // and said so: they "were NOT read one by one here". They have been, and
    // the reading is only worth something if it cannot be added to without
    // being done. `SWEEP_23_SEP` is DERIVED from the classified array, so the
    // two cannot drift; what this asserts is that no entry can arrive wearing
    // a kind nobody argued or a reason nobody wrote.
    test('§8e · every censused entry carries a kind and an argued reason', () => {
      const kinds = new Set(['historical', 'debt', 'structural'])
      for (const entry of [...KNOWN, ...SWEEP_23_SEP_CLASSIFIED]) {
        assert.ok(
          kinds.has(entry.kind),
          `${entry.pattern}: kind must be one of ${[...kinds].join(' · ')}, not ${entry.kind}`,
        )
        assert.ok(
          typeof entry.why === 'string' && entry.why.length > 60,
          `${entry.pattern}: an entry with no argument is the fail-closed guess this sweep replaced`,
        )
      }
    })

    test('§8f · and the two lists cannot drift, because one is derived', () => {
      assert.deepEqual(SWEEP_23_SEP, SWEEP_23_SEP_CLASSIFIED.map((e) => e.pattern))
    })

    test('§8g · the eighteen repaired here are NOT in the census, because they are repaired', () => {
      const censused = new Set([...KNOWN.map((k) => k.pattern), ...SWEEP_23_SEP])
      // One per repair. A re-broken derivation must fail §8b, not slip back in.
      for (const repaired of [
        'export function verifyIdentityToken', // G2171 — G978's own cure, anchored at last
        "from './sqs-run-queue.ts'", // G2172
        'controlLoadBalancer', // G2173
        'model/access\\|tenant-scope', // G2174
        'tenant-scope', // G2174
        'app.tenant_id', // G2175
        'RegExp', // G2176
        "code('", // G2177
        'mintedSessionCookie', // G2178
        'INDICATORS', // G2179
        "'mem_e2e", // G2180
        'tenant.membership', // G2180
        'DELETE FROM tenant.session', // G2181
        'GRANT UPDATE.*membership', // G2181
        'INSERT INTO tenant."user"', // G2181
        'INSERT INTO tenant.document_field_spec', // G2181
        'correspondence_config\\|orgClassesThatMayAdmit', // G2181
        'solutionIds', // G2181
        'tenant_id', // G2181
      ]) {
        assert.ok(!censused.has(repaired), `${repaired} is repaired; its census entry must be gone`)
      }
    })
  })

  // ───────────────────────────────────────────────────────────────────────
  test('§9 · IT REFUSES A ZERO SUBJECT', () => {
    // §5.6, refused inside the control written to catch its cousin. `check-wire-mirror`
    // printed `DRIFT (0). Every compared pair mirrors its model declaration` over ZERO
    // comparisons — a true sentence about an empty set in the vocabulary of an all-clear.
    // WITNESSED, not inferred. The checker resolves its own repository root
    // from its own location, so it is COPIED into an otherwise empty tree and
    // run there — it imports node builtins only, so it runs perfectly well
    // with nothing around it, and that is exactly the dangerous case.
    const empty = mkdtempSync(join(tmpdir(), 'self-measuring-'))
    try {
      mkdirSync(join(empty, 'tools'))
      copyFileSync(
        join(REPO, 'tools', 'check-self-measuring-derivations.mjs'),
        join(empty, 'tools', 'check-self-measuring-derivations.mjs'),
      )
      const run = spawnSync(
        process.execPath,
        [join(empty, 'tools', 'check-self-measuring-derivations.mjs')],
        { cwd: empty, encoding: 'utf8' },
      )
      assert.equal(run.status, 1, 'a run that found no derivation to test must FAIL, not pass')
      assert.match(run.stderr, /REFUSING A ZERO SUBJECT/)
      assert.doesNotMatch(run.stdout, /^OK /m, 'and it must not print an all-clear on the way out')

      // 🛑 READ WHICH ZERO FIRES, BECAUSE IT IS NOT THE OBVIOUS ONE AND THAT IS
      // THE ARGUMENT FOR GUARDING THREE SEPARATELY. The copied file is alone in
      // its tree, so the corpus is NOT empty — it scans ITSELF and finds 45
      // commands quoted in its own header, five of them evaluable. What is zero
      // is `match line(s) examined`: every path those five name is absent, so
      // nothing in the tree was ever read. A control guarding only "did I find
      // any commands" would have printed an all-clear here.
      assert.match(run.stdout, /0 match line\(s\) examined\./)
      assert.doesNotMatch(run.stdout, /0 command\(s\) quoted/, 'the corpus is this file itself, not nothing')

      const result = audit({ root: empty, files: [] })
      assert.equal(result.quoted, 0)
      assert.equal(result.evaluable, 0)
      assert.equal(result.examined, 0)
      assert.deepEqual(result.findings, [])
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
  })

  test('§9a · and the real run prints all four denominators', () => {
    const run = spawnSync(
      process.execPath,
      [join(REPO, 'tools', 'check-self-measuring-derivations.mjs')],
      { cwd: REPO, encoding: 'utf8' },
    )
    assert.match(
      run.stdout,
      /self-measuring derivations: \d+ file\(s\) scanned; \d+ command\(s\) quoted; \d+ evaluable; \d+ match line\(s\) examined\./,
      'K4 — every checker prints a denominator, and this one prints four because three can ' +
        'independently go to zero and each zero is a different broken run',
    )
    assert.equal(run.status, 0, run.stdout + run.stderr)
  })

  // ───────────────────────────────────────────────────────────────────────
  test('§10 · it is DETERMINISTIC — two runs over one tree agree exactly', () => {
    const a = audit({ root: FIXTURES, files: ['corpus.yaml', 'bre.md', 'safe.yaml', 'safe-quote.md'] })
    const b = audit({ root: FIXTURES, files: ['corpus.yaml', 'bre.md', 'safe.yaml', 'safe-quote.md'] })
    assert.deepEqual(a, b)
  })
})
