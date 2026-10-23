/**
 * G74 — the register's State column, DERIVED over heterogeneous rows.
 *
 * 🛑 WHY THE FIRST FOUR TESTS PASS AT BASE, AND WHY THAT IS THE POINT.
 * #236 §2 forbids a symbol probe in bold: *"the assertion must be behavioural,
 * not a symbol probe — `FINDING_STANDINGS` does not exist, so a file that
 * merely imports it fails every case identically at TS2305 and proves nothing
 * about the derivation."* A file whose only import is the symbol under
 * construction does not LINK at base; Node reports one synthetic file-level
 * SyntaxError and every case fails for the same non-reason.
 *
 * So the standing symbols are reached through `await import()` inside the
 * tests that need them, and the four tests above that line import nothing new:
 * they assert the facts #236 prescribed — `ExceptionStatus` has exactly seven
 * members, and `MatchGroup` / `SourceDocument` / `Exception` are three distinct
 * interfaces — over the module TEXT, which loads at base and at head alike.
 * The red is therefore legible: at base the four base facts PASS and only the
 * standing tests fail, each naming the derivation it could not reach.
 *
 * ⚠️ THE HISTORY IS NARRATED RATHER THAN SWEPT. The first red commit on this
 * branch, `ca017b50`, was the symbol probe #236 forbade — measured in a
 * throwaway worktree at base as `tests 1 · pass 0 · fail 1`, one file-level
 * link failure, with an empty commit message. It is not rewritten, because
 * rewriting published history needs a force-push. The behavioural red is
 * witnessed instead by running THIS file against base; the measurement is in
 * the commit message that lands it.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
/**
 * TYPE-ONLY, AND THAT IS LOAD-BEARING. `verbatimModuleSyntax` erases an
 * `import type` before any loader sees it, so this line does NOT stop the file
 * linking at base the way the value import in `ca017b50` did. The values are
 * reached through `await import()` inside the tests that need them.
 */
import type { FindingBasis, FindingStanding } from '../../model/domain.ts'

type ExceptionBasis = Extract<FindingBasis, { kind: 'exception' }>
type FindingStandingValue = FindingStanding

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const MODEL_DIR = join(REPO_ROOT, 'model')

/** Every `model/*.ts`, as `[relative path, text]`. */
function modelSources(): ReadonlyArray<readonly [string, string]> {
  return readdirSync(MODEL_DIR)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .sort()
    .map((f) => [`model/${f}`, readFileSync(join(MODEL_DIR, f), 'utf8')] as const)
}

const DOMAIN_TEXT = readFileSync(join(MODEL_DIR, 'domain.ts'), 'utf8')

/* ==================================================================== *
 * BASE FACTS — these pass at base, so the red below is legible.
 * ==================================================================== */

test('BASE — `ExceptionStatus` has exactly seven members, none of them a standing', () => {
  const block = /export type ExceptionStatus =\n((?:\s*\|\s*'[a-z_]+'\n)+)/.exec(DOMAIN_TEXT)
  assert.ok(block !== null, '`ExceptionStatus` is not a literal union in model/domain.ts any more')
  const members = [...(block[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
  assert.deepEqual(members, [
    'open',
    'investigating',
    'resolution_proposed',
    'pending_approval',
    'resolved',
    'rejected',
    'dismissed',
  ])
  assert.equal(
    members.length,
    7,
    'THE SEVEN MOVED. `ExceptionStatus` is one of the three row kinds the register has to ' +
      'render and the ONLY one with a status field; that asymmetry is why G74 rules a ' +
      'derivation rather than a re-key. An eighth member must be given a standing at ' +
      '`EXCEPTION_STATUS_STANDING` in the same commit — it is a compile error there, TS1360.',
  )
})

test('BASE — `MatchGroup`, `SourceDocument` and `Exception` are three DISTINCT interfaces', () => {
  const declared = ['MatchGroup', 'SourceDocument', 'Exception'].map((name) => {
    const hit = new RegExp(`^export interface ${name}\\b`, 'm').exec(DOMAIN_TEXT)
    return [name, hit === null ? null : DOMAIN_TEXT.slice(0, hit.index).split('\n').length] as const
  })
  for (const [name, line] of declared) {
    assert.ok(line !== null, `\`${name}\` is no longer an \`export interface\` in model/domain.ts`)
  }
  const lines = declared.map(([, line]) => line)
  assert.equal(
    new Set(lines).size,
    3,
    'THE REGISTER IS HETEROGENEOUS AND THAT IS THE WHOLE ARGUMENT. Row A is a `MatchGroup`, ' +
      'row D is a `SourceDocument` under a confidence floor, and only SOME rows are an ' +
      '`Exception`. If these three ever collapse into one type, G74 is a different ruling.',
  )
  // 🛑 NOT a `file:line` citation copied into prose — this repository's record
  // has been wrong six times over citations that still RESOLVED. The lines are
  // derived here and printed, never asserted against a constant.
  assert.ok(
    lines.every((l) => l !== null && l > 0),
    `derived declarations: ${declared.map(([n, l]) => `${n}:${l}`).join(' ')}`,
  )
})

test('BASE — no `@dropped-for-v1` marker stands over any of the three row kinds', () => {
  for (const name of ['MatchGroup', 'SourceDocument', 'Exception']) {
    const hit = new RegExp(`^export interface ${name}\\b`, 'm').exec(DOMAIN_TEXT)
    assert.ok(hit !== null)
    const preamble = DOMAIN_TEXT.slice(Math.max(0, hit.index - 1200), hit.index)
    const lastComment = preamble.lastIndexOf('/**')
    const doc = lastComment === -1 ? '' : preamble.slice(lastComment)
    assert.equal(
      doc.includes('@dropped-for-v1'),
      false,
      `\`${name}\` carries a @dropped-for-v1 note. A standing derived over a dropped row ` +
        'kind is a word on a screen with nothing behind it — the defect #236 exists to close.',
    )
  }
})

/* ==================================================================== *
 * THE PROHIBITION — G74's centre. Derive, never store.
 * ==================================================================== */

/**
 * A declared property, anywhere in `model/*.ts`. Deliberately a line scanner
 * and not a type checker — the same posture `tools/check-wire-mirror.mjs`
 * states in its own header — because the thing being forbidden is a DECLARED
 * COLUMN, which is a line of text.
 */
function declaredProperties(text: string): ReadonlyArray<{ name: string; type: string; line: number }> {
  const out: Array<{ name: string; type: string; line: number }> = []
  text.split('\n').forEach((raw, i) => {
    const m = /^\s+(?:readonly\s+)?([A-Za-z_$][\w$]*)\??:\s*(.+?)\s*$/.exec(raw)
    if (m === null) return
    const name = m[1]
    const type = m[2]
    if (name === undefined || type === undefined) return
    out.push({ name, type, line: i + 1 })
  })
  return out
}

test('NO STORED COPY — no model row declares a `standing` field, and the scanner proves it can see one', () => {
  // 🛑 THE NEGATIVE CONTROL RUNS FIRST. A scan that finds nothing is
  // indistinguishable from a scan that looks at nothing — §5.6, the defect the
  // tools in this repository exist to avoid reproducing. The scanner is shown
  // to FIND a planted column before it is trusted to report zero.
  const planted = declaredProperties(
    ['export interface MatchGroup {', '  standing: FindingStanding', '  outcome: MatchGroupOutcome', '}'].join('\n'),
  )
  assert.deepEqual(
    planted.filter((p) => p.name === 'standing').map((p) => p.type),
    ['FindingStanding'],
    'THE SCANNER IS BLIND. It did not find a `standing` column in a fixture that plainly ' +
      'declares one, so its zero over the real tree asserts nothing.',
  )
  assert.equal(planted.length, 2, 'the scanner mis-read the planted fixture')

  // The measurement itself. #236 acceptance item 4:
  //   grep -rnE '^\s+standing[?]?:' model/*.ts | wc -l   # must stay 0
  const stored: string[] = []
  for (const [path, text] of modelSources()) {
    for (const prop of declaredProperties(text)) {
      if (prop.name === 'standing') stored.push(`${path}:${prop.line} standing: ${prop.type}`)
    }
  }
  assert.deepEqual(
    stored,
    [],
    'A STANDING IS STORED ON A MODEL ROW. G74 rules the standing is DERIVED from the basis ' +
      'and never stored, and records that a stored copy "diverged within hours every previous ' +
      'time" — §5.3, the two-vocabularies defect. Delete the column; call `standingFor()`. ' +
      `Found: ${stored.join(' · ')}`,
  )
})

test('NO STORED COPY — no `export interface` anywhere in model/ carries a field TYPED `FindingStanding`', () => {
  // The second axis. A column called `state`, `label` or `findingState` and
  // typed `FindingStanding` is the same defect under a different name, and the
  // grep in #236 cannot see it — §5.1, a rule keyed on a convenient landmark
  // (the word `standing`) instead of the property it protects.
  const planted = collectInterfaceFields(
    ['export interface MatchGroup {', '  state: FindingStanding', '}'].join('\n'),
  )
  assert.deepEqual(
    planted.map((f) => `${f.iface}.${f.name}`),
    ['MatchGroup.state'],
    'the interface-body scanner did not see a planted `FindingStanding` column',
  )

  const typed: string[] = []
  for (const [path, text] of modelSources()) {
    for (const f of collectInterfaceFields(text)) {
      if (/\bFindingStanding\b/.test(f.type)) typed.push(`${path}:${f.line} ${f.iface}.${f.name}`)
    }
  }
  assert.deepEqual(
    typed,
    [],
    'A ROW INTERFACE CARRIES THE DERIVED VOCABULARY AS A COLUMN under another name. ' +
      `Found: ${typed.join(' · ')}`,
  )
})

/** Fields declared inside `export interface … { … }` blocks, with their owner. */
function collectInterfaceFields(
  text: string,
): ReadonlyArray<{ iface: string; name: string; type: string; line: number }> {
  const out: Array<{ iface: string; name: string; type: string; line: number }> = []
  let current: string | null = null
  text.split('\n').forEach((raw, i) => {
    const open = /^export interface ([A-Za-z_$][\w$]*)/.exec(raw)
    if (open !== null) {
      current = open[1] ?? null
      return
    }
    if (current !== null && raw === '}') {
      current = null
      return
    }
    if (current === null) return
    const m = /^\s+(?:readonly\s+)?([A-Za-z_$][\w$]*)\??:\s*(.+?)\s*$/.exec(raw)
    if (m === null) return
    const name = m[1]
    const type = m[2]
    if (name === undefined || type === undefined) return
    out.push({ iface: current, name, type, line: i + 1 })
  })
  return out
}

/* ==================================================================== *
 * THE VOCABULARY — five closed terms, each a WORD.
 * ==================================================================== */

test('the standing vocabulary is exactly five closed terms, in declaration order', async () => {
  const { FINDING_STANDINGS } = await import('../../model/domain.ts')
  assert.deepEqual(Object.values(FINDING_STANDINGS), [
    'closed',
    'needs_authority',
    'no_recourse',
    'below_floor',
    'waiting',
  ])
  // ORDER is asserted, not membership, because the wire mirrors this list in
  // order — `finding_standings` in `tools/check-wire-mirror.mjs`.
  assert.equal(Object.keys(FINDING_STANDINGS).length, 5)
})

test("each of G74's five surface terms resolves to exactly one member, BY NAME", async () => {
  const { FINDING_STANDINGS } = await import('../../model/domain.ts')
  const members = new Set<string>(Object.values(FINDING_STANDINGS))
  // #236 §2 item 4. Each surface term is named here as a reader would say it;
  // a term with no member is a word on a screen with nothing behind it, and
  // this assertion says WHICH term has no home rather than failing generically.
  for (const [surface, member] of [
    ['closed', FINDING_STANDINGS.closed],
    ['needs authority', FINDING_STANDINGS.needsAuthority],
    ['no recourse', FINDING_STANDINGS.noRecourse],
    ['below floor', FINDING_STANDINGS.belowFloor],
    ['waiting', FINDING_STANDINGS.waiting],
  ] as const) {
    assert.ok(
      members.has(member),
      `G74's surface term "${surface}" has no member in FINDING_STANDINGS.`,
    )
    assert.equal(member, surface.replace(/ /g, '_'))
  }
  assert.equal(members.size, 5, 'two surface terms collapsed onto one member, or a sixth appeared')
})

test('NO STANDING DEPENDS ON HUE — every term is a word, and carries no colour', async () => {
  const { FINDING_STANDINGS } = await import('../../model/domain.ts')
  for (const member of Object.values(FINDING_STANDINGS)) {
    assert.match(
      member,
      /^[a-z]+(_[a-z]+)*$/,
      `\`${member}\` is not a lowercase word. A standing that arrives as a token, a hex ` +
        'triple or a severity number is a standing a reader cannot say out loud.',
    )
    assert.doesNotMatch(member, /#|rgb|hsl|red|amber|green|colou?r/i)
  }
})

/* ==================================================================== *
 * THE DERIVATION — every arm driven by a fixture. §5.10: this file IS
 * the construction site for `standingFor()`; nothing in model/, server/,
 * db/ or tools/ calls it.
 * ==================================================================== */

test('MATCH GROUP arm — all three outcomes, each ASSERTED BY NAME', async () => {
  const { standingFor, FINDING_STANDINGS } = await import('../../model/domain.ts')
  assert.equal(standingFor({ kind: 'match_group', outcome: 'matched' }), FINDING_STANDINGS.closed)
  assert.equal(
    standingFor({ kind: 'match_group', outcome: 'unmatched' }),
    FINDING_STANDINGS.noRecourse,
  )
  // 🛑 The arm the first cut reached by FALL-THROUGH. `exception` is now a key
  // in `MATCH_GROUP_OUTCOME_STANDING`; this fixture is what catches the value
  // being wrong, which the compiler cannot — mis-mapping it to `closed` leaves
  // `tsc` at EXIT 0, measured 16 Aug 2026.
  assert.equal(
    standingFor({ kind: 'match_group', outcome: 'exception' }),
    FINDING_STANDINGS.needsAuthority,
  )
})

test('MATCH GROUP arm — the total Record covers the outcome union exactly, with no spare key', async () => {
  const { MATCH_GROUP_OUTCOME_STANDING } = await import('../../model/domain.ts')
  assert.deepEqual(Object.keys(MATCH_GROUP_OUTCOME_STANDING).sort(), [
    'exception',
    'matched',
    'unmatched',
  ])
  const union = /export type MatchGroupOutcome = (.+)/.exec(DOMAIN_TEXT)?.[1] ?? ''
  const declared = [...union.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()
  assert.deepEqual(
    Object.keys(MATCH_GROUP_OUTCOME_STANDING).sort(),
    declared,
    'THE RECORD AND THE UNION DISAGREE. `satisfies` catches a MISSING key at compile time; ' +
      'this catches the pair drifting apart in the other direction.',
  )
  assert.equal(
    DOMAIN_TEXT.includes("outcome: MatchGroupOutcome"),
    true,
    '`MatchGroup.outcome` no longer uses the named union, so the register discriminator and ' +
      'the standing map address two different vocabularies.',
  )
})

test('EXCEPTION arm — all SEVEN statuses are driven, and none reaches its standing by fall-through', async () => {
  const { standingFor, FINDING_STANDINGS: S } = await import('../../model/domain.ts')
  // 🛑 `ExceptionBasis` IS TYPE-ONLY AND IS THEREFORE ERASED BEFORE NODE SEES
  // IT — `verbatimModuleSyntax`, the same distinction `model/domain.ts` draws
  // for its own type-only cycles. That is what lets this file LINK at base
  // while the values it needs are reached through `await import()`.
  const cases: ReadonlyArray<readonly [ExceptionBasis, FindingStandingValue]> = [
    [{ kind: 'exception', status: 'open', resolvedDispositionIsTerminal: null, awaitingCounterpartyReply: false }, S.needsAuthority],
    [{ kind: 'exception', status: 'open', resolvedDispositionIsTerminal: null, awaitingCounterpartyReply: true }, S.waiting],
    [{ kind: 'exception', status: 'investigating', resolvedDispositionIsTerminal: null, awaitingCounterpartyReply: false }, S.needsAuthority],
    [{ kind: 'exception', status: 'investigating', resolvedDispositionIsTerminal: null, awaitingCounterpartyReply: true }, S.waiting],
    [{ kind: 'exception', status: 'resolution_proposed', resolvedDispositionIsTerminal: null, awaitingCounterpartyReply: false }, S.needsAuthority],
    [{ kind: 'exception', status: 'pending_approval', resolvedDispositionIsTerminal: null, awaitingCounterpartyReply: false }, S.needsAuthority],
    [{ kind: 'exception', status: 'resolved', resolvedDispositionIsTerminal: true, awaitingCounterpartyReply: false }, S.closed],
    [{ kind: 'exception', status: 'resolved', resolvedDispositionIsTerminal: false, awaitingCounterpartyReply: false }, S.waiting],
    // A `resolved` row whose disposition is not yet KNOWN is not closed. `null`
    // is the third value `boolean | null` admits, and the first cut read it
    // through a bare truthiness test with no note beside it; it derives
    // `waiting` deliberately — a disposition nobody has recorded is not a
    // terminal one, and reading it as `closed` is the same fail-open shape as
    // the extraction arm below.
    [{ kind: 'exception', status: 'resolved', resolvedDispositionIsTerminal: null, awaitingCounterpartyReply: false }, S.waiting],
    [{ kind: 'exception', status: 'rejected', resolvedDispositionIsTerminal: null, awaitingCounterpartyReply: false }, S.closed],
    [{ kind: 'exception', status: 'dismissed', resolvedDispositionIsTerminal: null, awaitingCounterpartyReply: false }, S.closed],
  ]
  for (const [facts, expected] of cases) {
    assert.equal(
      standingFor(facts),
      expected,
      `exception ${facts.status} (terminal=${String(facts.resolvedDispositionIsTerminal)}, ` +
        `awaiting=${String(facts.awaitingCounterpartyReply)}) should derive ${expected}`,
    )
  }
  const driven = new Set(cases.map(([f]) => f.status))
  assert.equal(
    driven.size,
    7,
    'an ExceptionStatus member has no fixture in this file. The compile-time `satisfies` on ' +
      '`EXCEPTION_STATUS_STANDING` forces a new status to be GIVEN a rule; only this count ' +
      'forces it to be DRIVEN.',
  )
})

test('EXCEPTION arm — the rule table is total over ExceptionStatus and names WHICH second fact each status needs', async () => {
  const { EXCEPTION_STATUS_STANDING } = await import('../../model/domain.ts')
  assert.deepEqual(EXCEPTION_STATUS_STANDING, {
    open: { from: 'counterparty_reply' },
    investigating: { from: 'counterparty_reply' },
    resolution_proposed: { from: 'status_alone', term: 'needs_authority' },
    pending_approval: { from: 'status_alone', term: 'needs_authority' },
    resolved: { from: 'terminal_disposition' },
    rejected: { from: 'status_alone', term: 'closed' },
    dismissed: { from: 'status_alone', term: 'closed' },
  })
})

test('EXTRACTION arm — a witnessed count derives the floor reading', async () => {
  const { standingFor, FINDING_STANDINGS } = await import('../../model/domain.ts')
  assert.equal(
    standingFor({ kind: 'extraction', fieldsBelowFloor: 1 }),
    FINDING_STANDINGS.belowFloor,
  )
  assert.equal(
    standingFor({ kind: 'extraction', fieldsBelowFloor: 7 }),
    FINDING_STANDINGS.belowFloor,
  )
  assert.equal(standingFor({ kind: 'extraction', fieldsBelowFloor: 0 }), FINDING_STANDINGS.closed)
})

test('EXTRACTION arm — an UNWITNESSED count fails CLOSED, never into `closed`', async () => {
  const { standingFor, FINDING_STANDINGS } = await import('../../model/domain.ts')
  // 🛑 THE FAILURE DIRECTION, WITNESSED. The first cut was `fieldsBelowFloor > 0
  // ? below_floor : closed`, so NaN and -1 both derived `closed` — the
  // confidence-floor arm, the one that exists to say a document is NOT
  // trustworthy, resolving a garbage count into the most reassuring word on the
  // register. That is scope failing OPEN, which G106 and §5.5 record this
  // codebase fixing once already.
  for (const count of [Number.NaN, -1, -0.5, 1.5, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const got = standingFor({ kind: 'extraction', fieldsBelowFloor: count })
    assert.notEqual(
      got,
      FINDING_STANDINGS.closed,
      `an unwitnessed count (${String(count)}) read as "closed" — fully reconciled — on the ` +
        'arm whose entire job is to say a document may not be trustworthy.',
    )
    assert.equal(
      got,
      FINDING_STANDINGS.needsAuthority,
      `an unwitnessed count (${String(count)}) must derive "needs_authority": nobody can tell ` +
        'whether the document cleared the floor, so a PERSON owes the next move. It is ' +
        'deliberately not "below_floor", which would assert a fact the basis does not carry.',
    )
  }
})

/* ==================================================================== *
 * §5.10 — SAY WHICH GUARANTEE IS THE COMPILER AND WHICH IS THIS FILE.
 * ==================================================================== */

test('§5.10 — this file is the ONLY construction site for `standingFor()`, and the declaration says so', () => {
  const callers: string[] = []
  for (const [path, text] of modelSources()) {
    // The declaration itself is not a call site.
    for (const [i, line] of text.split('\n').entries()) {
      if (!line.includes('standingFor')) continue
      if (/export function standingFor/.test(line)) continue
      if (/^\s*\*/.test(line)) continue
      callers.push(`${path}:${i + 1}`)
    }
  }
  assert.deepEqual(
    callers,
    [],
    'A MODEL MODULE NOW CALLS `standingFor()`. That is good news and it changes what a green ' +
      '`tsc` means — sweep the §5.10 note on the declaration in the same commit rather than ' +
      `leaving it claiming the test is the only construction site. Found: ${callers.join(' · ')}`,
  )
  assert.match(
    DOMAIN_TEXT,
    /§5\.10 — WHICH OF THESE GUARANTEES IS THE COMPILER AND WHICH IS A FIXTURE/,
    'the §5.10 statement #236 §6 requires ON THE DECLARATION is not there. A green `tsc` over ' +
      'a total `Record` with no construction site proves the shape and none of the content.',
  )
})
