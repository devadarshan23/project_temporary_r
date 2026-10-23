#!/usr/bin/env node
/**
 * check-self-measuring-derivations — G2081. The checker for a command that
 * counts its own explanation.
 *
 * WHY THIS EXISTS, AND IT IS NOT A HYPOTHETICAL. This repository hands out
 * derivations rather than numbers — *"derive it, never read it"* — and on
 * 23 Sep 2026 a circulated status summary ran two of them faithfully and
 * reported **"29 / 137 operations served"**. The truth was **30 of 136**. It
 * was wrong in BOTH numbers, and it undercounted its own wave's work. That is
 * not carelessness. The instructions were defective:
 *
 *   · a count of the contract corpus summed to 137 because ONE of the matches
 *     was a line of PROSE, inside a `description:` block, quoting that very
 *     command in order to explain it;
 *   · a listing of the mounted set returned eight lines because ONE of them was
 *     a block COMMENT quoting that very command in order to explain it.
 *
 * The class was already diagnosed here. G978 records a command cited by SIX
 * documents as proof that no token verifier existed, which returned THREE
 * lines, ALL THREE of them prose quoting the command. **The diagnosis was
 * written down and the instances were never swept**; that command returns FIVE
 * today, still all prose. A defect that is named and not gated grows.
 *
 * THE PROPERTY, STATED ONCE. A derivation's pattern may be spelled anywhere
 * EXCEPT inside the files that derivation searches. A command quoted outside
 * its own scope is safe for ever; a command quoted inside it counts its own
 * explanation, and every correction that names the command adds another line to
 * what the command measures. That is why this class ratchets: the more
 * carefully a defect is narrated, the more wrong its derivation becomes.
 *
 * WHAT IT DOES. It reads the corpus, extracts every `grep` invocation quoted
 * anywhere in it, RUNS each one against this tree, and reports any match whose
 * matched line is itself a quotation of a command rather than a declaration.
 *
 * 🛑 THE DETECTOR IS A LANDMARK AND NOT THE PROPERTY, AND SAYING SO IS PART OF
 * THE CONTROL. The property is *this matched line is prose about a command, not
 * a declaration*. What is tested is that the matched line ALSO carries a shell
 * verb — `grep`, `awk`, `sed`, `wc -l`, `git ls-files`, `node tools/`. A real
 * `operationId: listRuns` never does; a line quoting a `grep` for it always
 * does. The two known instances, G978's five, and every instance found in the
 * 23 Sep sweep are caught by it. **What it misses is named under WHAT IT CANNOT
 * SEE, below, and the first entry there is the interesting one.**
 *
 * 🛑 COMMENTS ARE NOT STRIPPED, AND THAT INVERTS `check-clock-fixtures`. That
 * control strips comments because prose ABOUT a clock is not a clock. This one
 * reads comments on purpose, because prose about a command IS the defect. The
 * two controls sit either side of the same false-positive class and the
 * asymmetry is deliberate: strip here and the checker sees nothing at all.
 *
 * 🛑 IT TAKES NO ARGUMENTS. `docs/build/completion-plan.md` K3 requires every
 * `check:*` script to be exactly `node tools/<checker>.mjs`, because a flag
 * that narrows the corpus is a flag that forces this gate green. The corpus is
 * a parameter of the exported `audit()` so the tests can be deterministic, and
 * it is reachable from no command line.
 *
 * 🛑 THIS FILE IS INSIDE ITS OWN CORPUS AND TAKES NO EXEMPTION. Every command
 * quoted in this header is extracted and evaluated like any other. That is
 * affordable for exactly one reason, and it is the property this checker
 * exists to teach: **none of the commands quoted here searches `tools/`.** A
 * header may spell `grep -c 'operationId:' docs/contracts/*.openapi.yaml`
 * freely, because `docs/contracts/` does not contain this file. The moment a
 * command scoped to `tools/` is quoted here, this checker reports itself — and
 * that is correct, not a bug to be exempted. `check-clock-fixtures` records the
 * same lesson from the other side: its first run failed the gate on its own
 * test corpus, and it was repaired by uniformity — fixture files excluded as a
 * CLASS — rather than by an exemption for itself.
 *
 * THE CENSUS, AND WHY IT IS A DEBT REGISTER RATHER THAN AN EXEMPTION LIST.
 * `KNOWN` below records self-measuring derivations that exist in the tree today
 * and are NOT repaired by this slice. Each entry carries the reason. It is not
 * an allow-list in the usual sense, because it is red in BOTH directions:
 *
 *   · a finding NOT in the census fails the run — so the class cannot grow;
 *   · a census entry that no longer self-matches ALSO fails the run — so the
 *     register cannot rot, and repairing one FORCES its removal;
 *   · emptying the census fails the run while findings remain — §5.6, refused
 *     inside the control written to catch its cousin.
 *
 * ⚠️ EVERY ENTRY IS HISTORY OR DEBT AND THE TWO ARE MARKED APART. `CLAUDE.md`
 * is explicit that this record narrates its own corrections deliberately and
 * that *"every line in [the HISTORICAL list] was read and each is right"* — so
 * a correction banner quoting a broken command in order to say it was broken is
 * CORRECT AS WRITTEN and is not swept. Those entries are `historical`. The
 * others are `debt`: live derivations that mislead today, recorded with what it
 * would take to fix them rather than fixed silently or left invisible.
 *
 * ⚠️ WHAT IT CANNOT SEE — A LANDMARK, NOT THE PROPERTY.
 *
 *   · A PROSE MENTION THAT IS NOT A COMMAND. A sentence saying *"every
 *     operation carries an `operationId:` key"* inflates the same count by one
 *     and carries no shell verb, so it is invisible here. This is the largest
 *     hole and it is the same hole `CLAUDE.md` records for the
 *     `@dropped-for-v1` awk, which armed on prose ABOUT a drop and answered 198
 *     where the parser says 197.
 *   · ANY TOOL BUT `grep`. `awk`, `ls`, `find`, `rg` and `git grep` are
 *     extracted and COUNTED as unevaluable, never evaluated — only `grep` has a
 *     pattern-and-path shape this can execute without a shell. `ls`-based
 *     derivations are structurally immune anyway: they never read content.
 *   · A COMMAND BUILT BY CONCATENATION, reached through a helper, or assembled
 *     across more than one continued line.
 *   · A PATH THIS CANNOT EXPAND — a brace expansion, a `**` glob, a shell
 *     variable, a path that does not exist. Counted as unevaluable and reported
 *     in the denominator, never silently skipped.
 *   · A PIPELINE'S LATER STAGES. `grep X f | grep -v Y` is evaluated as its
 *     FIRST stage only, so a `-v` filter that deliberately excludes the quoting
 *     file — a defence this repository already uses — is not credited, and the
 *     command may be reported when it is in fact safe. Those sit in the census
 *     marked `historical`, with the defence named.
 *   · A FILE OUTSIDE THE SCANNED EXTENSIONS — `.html` in particular, which is
 *     where the handoff pack lives.
 *
 * ⚠️ AND ONE THING IT DELIBERATELY DOES NOT DO: it does not check whether the
 * NUMBER written beside a command is right. That is `check-doc-counts`'s job
 * for the sixteen governed totals and nobody's job for the rest. This control
 * answers a narrower question — *can this command be trusted at all* — and a
 * command that cannot is a number nobody should have copied.
 *
 *   node tools/check-self-measuring-derivations.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Where derivations are handed out. Everything tracked, minus generated trees. */
export const SCAN_ROOTS = [
  '.',
  'docs',
  'server',
  'model',
  'db',
  'tools',
  'tests',
  'frontend',
  'infra',
]

/**
 * Never entered, in either direction. The first two are DELIBERATELY DEFECTIVE
 * CORPORA — including this checker's own captured red — and a control that
 * graded its own negative controls would be permanently and correctly red, and
 * would have to be silenced to ship. The rest are generated or vendored.
 */
export const EXCLUDED_PREFIXES = [
  'tests/tools/fixtures',
  'tests/ci/fixtures',
  'node_modules',
  '.git',
  'frontend/dist',
  'infra/cdk.out',
  'infra/node_modules',
]

export const SCANNED_EXTENSIONS = [
  '.md',
  '.yaml',
  '.yml',
  '.ts',
  '.tsx',
  '.mts',
  '.mjs',
  '.js',
  '.sql',
  '.css',
]

/**
 * The spans, on one line, that are the PATTERN ARGUMENT of a quoted search
 * command. A match landing inside one of these is a match on a quotation of a
 * command and not on a declaration.
 *
 * 🛑 THIS IS THE SECOND DETECTOR AND THE FIRST ONE WAS TOO BLUNT, WHICH IS
 * RECORDED RATHER THAN QUIETLY REPLACED. The first asked only whether the
 * matched LINE carried a shell verb anywhere on it. Run against this tree that
 * answered 131, and the surplus was coincidence: a `grep 'standing'` reported
 * against a line that quotes `grep -rn 'standingFor'`, a `grep 'x-plane'`
 * reported against a long banner that happens to mention `git show`. A line
 * mentioning a command is not the same fact as a MATCH INSIDE one, and only the
 * second is the defect. The blunt form is kept in the test corpus as the
 * captured red.
 */
export function quotedPatternSpans(line) {
  const spans = []
  const re = /\b(?:grep|rg|git\s+grep)\b/g
  let m
  while ((m = re.exec(line)) !== null) {
    let i = m.index + m[0].length
    // skip flags
    while (i < line.length) {
      while (line[i] === ' ') i++
      if (line[i] === '-' && /[A-Za-z]/.test(line[i + 1] ?? '')) {
        while (i < line.length && line[i] !== ' ') i++
        continue
      }
      break
    }
    const q = line[i]
    if (q !== "'" && q !== '"') continue
    const end = line.indexOf(q, i + 1)
    if (end === -1) continue
    spans.push({ start: i + 1, end, value: line.slice(i + 1, end) })
  }
  return spans
}

/** Tools we can name but cannot execute. Counted, never evaluated. */
const UNEVALUABLE_TOOLS = /^(?:rg|awk|ls|find|git)\b/

/**
 * ─────────────────────────────────────────────────────────────────────────
 * THE CENSUS — self-measuring derivations that exist and are NOT repaired
 * here. Red in both directions: an entry that stops self-matching fails, and
 * a finding with no entry fails. See the header.
 *
 *   kind: 'historical'  a correction banner quoting a broken command in order
 *                       to say it was broken. CORRECT AS WRITTEN. `CLAUDE.md`:
 *                       *"do not bulk-edit the HISTORICAL list — every line in
 *                       it was read and each is right."* Never sweep these.
 *   kind: 'debt'        a LIVE derivation that misleads today. Recorded with
 *                       what it would take to fix, so the debt is greppable
 *                       rather than invisible. Owed, not done.
 * ─────────────────────────────────────────────────────────────────────────
 */
export const KNOWN = [
  {
    pattern: 'jwtVerify\\|createRemoteJWKSet',
    kind: 'historical',
    why:
      "G978 itself. `server/data-plane/token-verify.ts` §0 quotes the command in order to RETIRE it, " +
      "`identity.ts` says in its own voice that it is 'LEFT STANDING AS THE HISTORY IT IS', and " +
      "`dev/identity-seed.ts` cites it as the shape it avoided. CLAUDE.md already replaced the live " +
      "derivation with `grep -rln 'export function verifyIdentityToken' server/`. Sweeping these would " +
      'erase the record of the defect this checker exists for.',
  },
  {
    pattern: 'jwtVerify\\|createRemoteJWKSet\\|verifyIdToken',
    kind: 'historical',
    why: "`server/data-plane/signin.ts` §0's variant of the same retired G978 derivation. Same argument.",
  },
  {
    pattern: 'servedWithoutAGate(',
    kind: 'historical',
    why:
      'RETIRED AND REPLACED, and the replacement is live: `server/http/app.ts` §0 keys on the CALL ' +
      "SYNTAX — `grep -rnE ': *servedWithoutAGate\\(' server --include start.ts` — which answers 2 " +
      'against 28 for the bare name, because no sentence writes a colon before it. The six surviving ' +
      'quotations of the bare form are correction banners in `app.ts` and `start.ts` narrating that ' +
      'exact measurement. G2084 propagated the anchored form to `server/contract/capability.ts`, ' +
      'which had said "unchanged at ONE" against a tree holding two.',
  },
]

/**
 * ─────────────────────────────────────────────────────────────────────────
 * THE 23 Sep 2026 SWEEP, READ ONE BY ONE — G2171–G2183, 28 Sep 2026, THE
 * OWNER'S RULING: *"Sweep them in a dedicated slice."*
 *
 * The eighty-three entries below `KNOWN` were recorded FAIL-CLOSED by the
 * slice that built this gate: *"they were NOT read one by one here, and
 * calling a live defect `historical` excuses it while calling a banner
 * `debt` merely overstates what is owed."* **They have now been read one by
 * one, and the fail-closed guess was wrong in both directions** — a little
 * over half are correction banners that are correct as written, and
 * THIRTY-FIVE were live derivations that mislead today.
 *
 * 🛑 THE SHAPE THE READING FOUND, WHICH NO TOTAL WOULD HAVE SHOWN: the live
 * ones are overwhelmingly ABSENCE CLAIMS — *"returns nothing"*, *"→ 0"* —
 * and an absence claim is the one kind of derivation its own explanation
 * always falsifies. Measured: `grep -rn "model/access\\|tenant-scope"
 * server/control-plane/` was quoted as returning NOTHING and answered
 * **eleven**, every line of it prose SAYING THE IMPORT IS ABSENT; a
 * `tenant_id` count stated as **0** answered **seven**; a `RegExp` count
 * called *"a standing control"* answered **3** and could never have answered
 * 0. **The more carefully an absence was narrated, the further its own
 * derivation drifted from it.**
 *
 * EIGHTEEN of the eighty were repaired here and are GONE from this list,
 * because a register that outlives its subject is a register nobody can
 * trust. The rest carry the reading that was done.
 *
 *   kind: 'historical'  correct as written. A correction banner, a
 *                       past-tense measurement, a self-match the stated
 *                       answer DISCLOSES, or a later pipeline stage this
 *                       checker structurally cannot see. `CLAUDE.md`:
 *                       *"every line in it was read and each is right."*
 *                       NEVER SWEEP THESE.
 *   kind: 'debt'        LIVE and misleading today, READ AND ARGUED, and not
 *                       repaired here — each with what it would take.
 *   kind: 'structural'  the quoted text is not a runnable command.
 * ─────────────────────────────────────────────────────────────────────────
 */
export const SWEEP_23_SEP_CLASSIFIED = [
  {
    pattern: '0002_[a-z_]*',
    kind: 'historical',
    why:
      'A dated adjudication snapshot in `docs/build/ingestion-p2-adjudication.md` whose own subject ' +
      'is that a migration number written in a PROPOSAL collides. Its `sort -u` gains one bogus row ' +
      'from its own line. The repair it argued for was built — `tools/check-migration-numbers.mjs` ' +
      '— and rewriting the measurement would erase the argument.',
  },
  {
    pattern: ':hover|:focus-visible|:focus-within',
    kind: 'historical',
    why:
      'A LATER PIPELINE STAGE this checker cannot see: `| grep -i \'tip\'` excludes the quoting ' +
      'line, which carries no `tip`. The defence is already there and the stated answer — NOTHING — ' +
      'is correct.',
  },
  {
    pattern: 'Alarm',
    kind: 'historical',
    why:
      'Both quotations are past tense — `# returned NOTHING until this commit` — in ' +
      '`observability-stack.ts` and `config.ts`. The absence they measure genuinely ended; the ' +
      'command cannot reproduce it at any spelling.',
  },
  {
    pattern: 'BINDS A .SourceDocument. TO A SLOT',
    kind: 'historical',
    why:
      'THE STATED ANSWER NAMES ITS OWN QUOTATION: `→ model/run-admission.ts · db/migrations/0069 · ' +
      'this file`. A disclosed self-match is not a defect.',
  },
  {
    pattern: 'CREATE FUNCTION\\|CREATE TRIGGER',
    kind: 'debt',
    why:
      'MIXED, and it cannot clear without sweeping a banner. `db/migrations/0019` §0 is past tense ' +
      '(*"returned exactly ONE line before this file"*) and is correct as written; ' +
      '`db/migrations-control/0030`\'s *"Derive it, never read it"* is LIVE and in scope, so its ' +
      'own comment inflates a count of the two real statements beside it. Owed: anchor the `0030` ' +
      'site on `^CREATE`, which no SQL comment writes, and leave `0019` alone.',
  },
  {
    pattern: 'CREATE TABLE',
    kind: 'debt',
    why:
      'MIXED. `db/migrations/0009` §0 quotes it in order to RETIRE it (*"G299\'s OWN DERIVATION IS ' +
      'SCHEMA-BLIND and still returns 0"*) and is correct as written. `db/migrations/0017` §0 is ' +
      'LIVE — *"The CONTROL-PLANE database has ONE table, `pack_catalogue`. Derive: …"* — and is ' +
      'now wrong twice over: its own line, and the fact that that database has had more than one ' +
      'table since `0002`. Owed: `^CREATE TABLE`, and a re-derivation of the claim.',
  },
  {
    pattern: 'CREATE TABLE tenant.document_type',
    kind: 'historical',
    why:
      'Explicitly scoped to another tree: *"Run all three against the commit before this one."* A ' +
      'past-tense derivation cannot be anchored into truth about the present and must not be.',
  },
  {
    pattern: 'ExtractedValue\\|ExtractedLine',
    kind: 'historical',
    why:
      'A LATER PIPELINE STAGE: `| grep -v \'^\\\\S*: *\\\\*\'` strips block comments, and ' +
      '`definition-store.ts` states the answer as 0 WITH that filter. The defence is present and ' +
      'this checker evaluates the first stage only.',
  },
  {
    pattern: 'ExtractedValue|ExtractedLine',
    kind: 'historical',
    why:
      'The ERE twin of the above, in `document-assembly.ts`\'s *"MEASURED BEFORE IT WAS WRITTEN"* ' +
      'box, carrying the same `grep -v`.',
  },
  {
    pattern: 'GRANT UPDATE (',
    kind: 'historical',
    why:
      'THE STATED ANSWER IS *"this file only"* and the self-match is in that file. G358\'s claim — ' +
      'that `db/migrations/0015` is the only column-level UPDATE grant in the directory — is ' +
      'unfalsified by its own sentence.',
  },
  {
    pattern: 'IngestBound',
    kind: 'historical',
    why:
      'Past tense, and paired with `ls model/held-work.ts → No such file or directory`: it ' +
      'describes the tree before the module existed. MG6\'s premise, kept runnable as history.',
  },
  {
    pattern: 'MintedSession',
    kind: 'historical',
    why:
      'G1612\'s own correction banner. It quotes the WRONG draft — *"That draft said `grep -rn ' +
      '\'MintedSession\' model/ | wc -l -> 0`. **It returns 16**"* — and the anchored replacement ' +
      'is two lines above it. This is the class diagnosing itself correctly.',
  },
  {
    pattern: 'RunPlan',
    kind: 'debt',
    why:
      'LIVE and falsified by its own sentence: `model/reconciliation.ts` §11 states `grep -rl ' +
      '\'RunPlan\' model/*.ts` → 0 while that line is itself in `model/*.ts`, so `-l` answers ' +
      '`reconciliation.ts`. The CLAIM — that no `RunPlan` and no content key exists — is still ' +
      'true. Owed: anchor on a declaration, `^export .*RunPlan`.',
  },
  {
    pattern: 'SEED_CAPABILITY',
    kind: 'historical',
    why:
      'THE STATED ANSWER IS *"returns this file alone"* and the self-match is in that file. The ' +
      'claim being measured — that no OTHER file references the deleted singular — is unfalsified.',
  },
  {
    pattern: 'Temporal',
    kind: 'historical',
    why:
      'A `docs/HANDOFF.md` RULINGS ROW is the self-match, and a row recording G211\'s orchestration ' +
      'decision is the thing the command exists to find. Sweeping it would edit the ruling.',
  },
  {
    pattern: 'TenantContext',
    kind: 'historical',
    why:
      'Annotated past tense on its own line — `→ 0 (before this slice)` — in `model/access.ts`, ' +
      'beside a second derivation over `docs/contracts/` that is unaffected.',
  },
  {
    pattern: 'V1 Landing\\|V4 Success Story',
    kind: 'historical',
    why:
      'Self-disclosed AND past tense: *"returned NOTHING before this file, and returns exactly this ' +
      'file now."* G1906 wrote the answer it would give.',
  },
  {
    pattern: 'admit_source',
    kind: 'historical',
    why:
      'Self-disclosed: *"counts this entry and no other"*, and the entry it means is the ' +
      '`admit_source: true` member below it. The claim is about TOOL BINDINGS and is unfalsified.',
  },
  {
    pattern: 'amountMinor',
    kind: 'historical',
    why:
      '`model/money.ts` is legitimately in its own answer — the claim is *"named ONLY in this ' +
      'file"* — and `model/reconciliation.ts` §3\'s is the THIRD control that header records as ' +
      'having been wrong, quoted in order to say so.',
  },
  {
    pattern: 'applyReaderVerdicts',
    kind: 'historical',
    why:
      'A LATER PIPELINE STAGE: `| grep -v \'model/reconciliation.ts:3365\'`. `docs/model-gaps.md` ' +
      'states the answer with the filter applied.',
  },
  {
    pattern: 'broker_ref',
    kind: 'historical',
    why:
      'A LATER PIPELINE STAGE: `| grep -v \'identity.ts\'` excludes exactly the file the quotation ' +
      'is in. The stated answer — nothing — is correct as written.',
  },
  {
    pattern: 'capabilities:',
    kind: 'historical',
    why:
      'Past tense: *"returned five hits and not one constructed a `Role`"*, describing ' +
      '`model/access.ts` before 16 Aug 2026. The §5.6 finding it records is the reason the ' +
      'paragraph exists.',
  },
  {
    pattern: 'carries_control_total',
    kind: 'historical',
    why:
      'Same block as `CREATE TABLE tenant.document_type`: *"Run all three against the commit before ' +
      'this one."* It answers TWO files today because `0180` added the column — which is the gap ' +
      'closing, not the command rotting.',
  },
  {
    pattern: 'completeFederatedSignIn',
    kind: 'debt',
    why:
      'LIVE: `server/data-plane/signin.ts` §0 says *"derive it, do not read this line"* and the ' +
      'command returns that very line among its hits. The claim — that no plane mounts the ' +
      'operation — is still true and the command cannot show it. Owed: derive the MOUNT, not the ' +
      'name — the operation either appears in a `handlers` block or it does not.',
  },
  {
    pattern: 'data_type',
    kind: 'historical',
    why:
      'Past tense and paired with a `git show HEAD~1` form: *"Derive that it was true until this ' +
      'commit."*',
  },
  {
    pattern: 'design/routes',
    kind: 'historical',
    why:
      'Past tense — *"returned nothing at all"* — about the tree before ' +
      '`tests/design/focus-indicator.test.ts` existed, in the paragraph recording that a finding in ' +
      'a comment is not a control.',
  },
  {
    pattern: 'domainNames',
    kind: 'debt',
    why:
      'LIVE — *"derive it, never read it"* in `infra/lib/edge-stack.ts` — and the listing includes ' +
      'its own sentence. LOW HARM: it is a `-n` listing a reader reads rather than a count, and the ' +
      'real property is visible in the hits. Owed: `^ *domainNames:`.',
  },
  {
    pattern: 'domainUnique|uniqueDomain|domain.*already claimed|one connection per domain',
    kind: 'debt',
    why:
      'LIVE in `docs/pending-rulings.md`, a register a reader acts on rather than a dated record. ' +
      'Its `# 0` is falsified by its own line, because the scan covers `docs/*.md`. Owed: exclude ' +
      'the register, or anchor on a declaration.',
  },
  {
    pattern: 'domain_claim',
    kind: 'debt',
    why:
      'LIVE. `db/migrations/0220` §0 quotes a narrow form scoped to `0009` which is safe; a broader ' +
      'quotation elsewhere scans `db/` and picks up `0220`\'s own header. Owed: keep every ' +
      'quotation of this one scoped to the file whose absence is being claimed.',
  },
  {
    pattern: 'double precision',
    kind: 'debt',
    why:
      'LIVE — *"Derive it"* in `db/migrations/0015` — and the listing includes its own sentence. ' +
      'LOW HARM: the claim is that the hits are *"confidences, ratios, rates and box coordinates, ' +
      'and no amount"*, which a reader verifies by reading them. Owed: `^[^-]`.',
  },
  {
    pattern: 'enumerable',
    kind: 'historical',
    why:
      'The claim is that a PHRASE appears nowhere — *"returns ten lines and none of them is it"* — ' +
      'and the self-match is one of the ten it already acknowledges. Unfalsified.',
  },
  {
    pattern: 'fastify|compose\\.yaml|server/http|server/contract',
    kind: 'historical',
    why:
      'Annotated `# 0 before this pass` on its own line, in `docs/HANDOFF.md`\'s record of what ' +
      'that pass added.',
  },
  {
    pattern: 'frontend',
    kind: 'historical',
    why:
      'Both `CLAUDE.md` sites are past tense and in capitals — *"`grep -c \'frontend\' CLAUDE.md` ' +
      'RETURNED `0`"* — recording the worst omission that page has carried. The command is the ' +
      'evidence for a correction, not an instruction.',
  },
  {
    pattern: 'idleTimeout|sessionLifetime|sessionTimeout|idle_timeout',
    kind: 'historical',
    why:
      'MG5\'s measured absence, quoted in `model/session.ts` §0 to say what the module closes. Past ' +
      'tense.',
  },
  {
    pattern: 'if (Object.keys(properties).length === 0) return undefined',
    kind: 'historical',
    why:
      'A ⛔ correction in `server/contract/routes.ts` quoting the RETIRED line *"because four ' +
      'documents and two test files cite it by grep"*. Deleting it would break those citations.',
  },
  {
    pattern: 'jsonb',
    kind: 'historical',
    why:
      'Past tense: *"Derive that it was true until this commit"*, paired with a `git show HEAD~1` ' +
      'form.',
  },
  {
    pattern: 'just-in-time|jit provision|provisionUser|firstSignIn',
    kind: 'debt',
    why:
      'LIVE in `docs/pending-rulings.md`; its `# 0` is falsified by its own line, because the scan ' +
      'covers `docs/*.md` and `docs/build/*.md`. Same repair as its sibling two rows up.',
  },
  {
    pattern: 'jwtVerify|createRemoteJWKSet',
    kind: 'historical',
    why:
      'G978\'s family, ERE spelling. `session-cookie.ts` carries its own ⚠️ retiring the derivation ' +
      'in the same header. Sweeping it erases the record of the defect this gate exists for.',
  },
  {
    pattern: 'nspname = \'tenant\'',
    kind: 'debt',
    why:
      'LIVE and falsified by its own sentence: `tests/db/rls-census.test.ts` §0 says *"Reproduce it ' +
      '… every hit pairs the schema with a literal `relname`"*, and its own line does not. The ' +
      'FINDING — that the suite proves a property of NAMED tables — is correct and is what the file ' +
      'exists to fix. Owed: scope the reproduction to the SQL, `^ *WHERE n.nspname`.',
  },
  {
    pattern: 'outbox|event.?bus|pub/?sub|kafka|kinesis|eventbridge|\\bSNS\\b|\\bSQS\\b',
    kind: 'historical',
    why:
      'A LATER PIPELINE STAGE: `| grep -v event-architecture-recommendation` excludes exactly the ' +
      'quoting file, and the stated `# 3 hits, none a decision` is correct with it.',
  },
  {
    pattern: 'persistence-design.md.* §0',
    kind: 'debt',
    why:
      'LIVE: the document asks a reader to *"reproduce the citing set"* over `docs/*.md`, which ' +
      'contains it. LOW HARM — the answer is a file list and the extra entry is the file asking the ' +
      'question. Owed: exclude itself.',
  },
  {
    pattern: 'promote_learning',
    kind: 'historical',
    why:
      'Past tense: *"returned nothing until this line landed"*, recording G128 minting the ' +
      'thirty-seventh capability.',
  },
  {
    pattern: 'readConnectionByBrokerHandle',
    kind: 'debt',
    why:
      'LIVE — *"Derive the resolver instead"* in `server/data-plane/identity.ts`, in the paragraph ' +
      'that retires the WRONG control beside it. LOW HARM: a listing whose hits include the ' +
      'declaration a reader is being sent to. Owed: `^export .*readConnectionByBrokerHandle`.',
  },
  {
    pattern: 'resolveModel(',
    kind: 'debt',
    why:
      'LIVE, AND THE REPAIR ALREADY EXISTS ONE FILE OVER AND WAS NOT PROPAGATED — which is the ' +
      'class this gate was built for. `correspondence-store.ts` and `correspondence.ts` both state ' +
      '`→ nothing` while the command answers FOUR; `document-assembly.ts` carries a ' +
      'comment-stripping filter and names the defect as G978\'s in its own voice. Owed: propagate ' +
      'that form to the other two. It cannot clear this entry, because the bare pattern survives in ' +
      '`document-assembly.ts`\'s own correction.',
  },
  {
    pattern: 'return undefined',
    kind: 'historical',
    why:
      'A LATER PIPELINE STAGE: `| grep -v "^[0-9]*: *\\\\*"` strips comments, and ' +
      '`server/contract/routes.ts` argues the filter in the sentence above it — *"Strip the ' +
      'comments, and the property is the one line that survives."*',
  },
  {
    pattern: 'reversalWindow\\|reversal_window\\|REVERSAL_WINDOW',
    kind: 'historical',
    why:
      'Past tense: *"returned nothing before this commit"*, recording the unbounded-reversal ' +
      'finding G1733 measured.',
  },
  {
    pattern: 'reversibility',
    kind: 'historical',
    why:
      'Past tense: *"returned the declaration, four fixture literals, and NO READER"*, describing ' +
      'the tree before G129\'s autonomy gate.',
  },
  {
    pattern: 'routes/table\\|routes/screens\\|routes/router\\|ROUTE_PATHS',
    kind: 'historical',
    why:
      'TWO LATER PIPELINE STAGES, one of them `| grep -v route-provenance` — the quoting file ' +
      'itself — and the surrounding claim is superseded by G486 and kept as history.',
  },
  {
    pattern: 'run-queue-dead-letter-not-empty',
    kind: 'debt',
    why:
      'LIVE: `infra/lib/run-queue-stack.ts` says *"Derive it, never read this comment"* and the ' +
      'command scans `infra/lib/*.ts`, so the comment is one of its hits. Owed: an anchor, or point ' +
      'at `tests/infra/observability.test.mjs`, which the same paragraph already names as the ' +
      'assertion.',
  },
  {
    pattern: 'runSetReconciliation\\|INSERT',
    kind: 'historical',
    why:
      'The SECOND stage of a `grep -v \'^\\\\s*\\\\*\'` pipeline, and `run-worker.ts` says *"note ' +
      'the `grep -v`, which is not decoration"* and records that the naive form answers 3, all ' +
      'three the paragraph itself. The class, correctly diagnosed in place.',
  },
  {
    pattern: 'schemas/FieldPath',
    kind: 'debt',
    why:
      'LIVE: `docs/contracts/README.md` says *"Derive them rather than reading a list"* over ' +
      '`docs/contracts/`, which contains it, so G244\'s thirteen sites read as fourteen. Owed: ' +
      'anchor on the `$ref` syntax, which no sentence writes.',
  },
  {
    pattern: 'scopeContains',
    kind: 'historical',
    why:
      'A dated measurement in a slice record (`docs/build/green-reconciliation-slices.md`), and ' +
      'self-disclosed: *"returns exactly one hit, the comment that names it."* The finding — that ' +
      '`scopeContains()` exists nowhere — is what the slice was commissioned on.',
  },
  {
    pattern: 'stakeholderClass: \'administrator\'',
    kind: 'debt',
    why:
      'LIVE and falsified by its own sentence: `model/access.ts` says *"Reproduce rather than trust ' +
      'this sentence: … → one hit"* and the command answers two. The claim — that exactly one seed ' +
      'declares it — is still true. Owed: `^ *stakeholderClass:`, the declaration\'s own indent.',
  },
  {
    pattern: 'unindexed|COPY into|batch insert',
    kind: 'historical',
    why:
      'A dated measurement in a red-slice record, and inert besides: the alternation is passed to a ' +
      '`grep` with no `-E`, so it is a literal string nothing but this sentence contains.',
  },
  {
    pattern: 'unique_within',
    kind: 'historical',
    why:
      'Every self-match is past tense (*"returned TWO lines: that declaration and one prose note"*) ' +
      'or a dated slice record. It is the premise G178\'s evaluator was built on and the numbers ' +
      'are the evidence.',
  },
  {
    pattern: 'unwiredResponses',
    kind: 'debt',
    why:
      'LIVE: `tests/http/required-fields-served.test.ts` says the command *"returns the declaration ' +
      'and nothing else. §2 is its first reader"*, and the scan covers `tests/`, so its own line is ' +
      'a second hit. LOW HARM. Owed: `^ *unwiredResponses`.',
  },
  {
    pattern: 'view_commercial',
    kind: 'historical',
    why:
      'Past tense and in a box that says so: *"THE GAP WAS MEASURED BEFORE THIS ASSERTION WAS ' +
      'WRITTEN … returned NOTHING."*',
  },
  {
    pattern: 'view_…|trigger…|export…',
    kind: 'structural',
    why:
      'NOT A RUNNABLE COMMAND. `docs/contracts/capability.openapi.yaml` says *"MIND THE ELLIPSES, ' +
      'they are load-bearing"*: the `…` are placeholders for three capability spellings ' +
      'deliberately kept out of the tree, and the unabbreviated form lives in a PR body *"which is ' +
      'not a file this command scans"*. The abbreviation is the control. This checker cannot tell a ' +
      'placeholder from a pattern.',
  },
]

/** The patterns alone. One source of truth; the classification is above. */
export const SWEEP_23_SEP = SWEEP_23_SEP_CLASSIFIED.map((e) => e.pattern)


/**
 * 1-based line numbers for offsets into one source. The offsets are looked up
 * against a newline index built ONCE per file rather than counted from the
 * start per match: this record's largest documents run to a megabyte and carry
 * eighty quoted commands each, and the naive form made the stage take four
 * seconds where the whole scan is under one.
 */
function lineIndexer(source) {
  const starts = [0]
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') starts.push(i + 1)
  return (index) => {
    let lo = 0
    let hi = starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (starts[mid] <= index) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }
}

/** Every scanned file under the roots, sorted, so a run is deterministic. */
export function corpusFiles(root = ROOT) {
  const out = []
  const excluded = (rel) => EXCLUDED_PREFIXES.some((p) => rel === p || rel.startsWith(p + '/'))
  const walk = (dir) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const abs = join(dir, e.name)
      const rel = relative(root, abs).split(sep).join('/')
      if (!rel || excluded(rel)) continue
      if (e.isDirectory()) {
        if (e.name.startsWith('.') && e.name !== '.github') continue
        walk(abs)
      } else if (SCANNED_EXTENSIONS.some((x) => e.name.endsWith(x))) {
        out.push(rel)
      }
    }
  }
  for (const r of SCAN_ROOTS) {
    const abs = r === '.' ? root : join(root, r)
    let st
    try {
      st = statSync(abs)
    } catch {
      continue
    }
    if (!st.isDirectory()) continue
    if (r === '.') {
      // top-level files only; the named roots below cover the directories
      for (const e of readdirSync(abs, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1)))
        if (e.isFile() && SCANNED_EXTENSIONS.some((x) => e.name.endsWith(x))) out.push(e.name)
    } else {
      walk(abs)
    }
  }
  return [...new Set(out)].sort()
}

/**
 * Split a command's argument text into shell-ish tokens, honouring single and
 * double quotes and stopping at a pipeline or statement boundary. The stop is
 * why a `| grep -v …` defence is not credited — see WHAT IT CANNOT SEE.
 */
function tokenise(text) {
  const tokens = []
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (c === ' ' || c === '\t') {
      i++
      continue
    }
    // A token opening with `#` is a shell comment. Stopping here is not
    // cosmetic: `… server/*/start.ts  # 26 of 136 served` otherwise parses
    // `#`, `26`, `of` … as PATHS, none of which exists, which made the whole
    // command unevaluable and silently exempted the plan's own derivation.
    if (c === '#') break
    if (c === '|' || c === ';' || c === '&' || c === '>' || c === ')' || c === '`') break
    if (c === '\\' && text[i + 1] === '\n') {
      i += 2
      continue
    }
    if (c === "'" || c === '"') {
      const end = text.indexOf(c, i + 1)
      if (end === -1) return { tokens, quoted: null }
      tokens.push({ value: text.slice(i + 1, end), quoted: c })
      i = end + 1
      continue
    }
    let j = i
    let value = ''
    while (j < text.length && !' \t|;&>)`'.includes(text[j])) {
      value += text[j]
      j++
    }
    tokens.push({ value, quoted: '' })
    i = j
  }
  return { tokens }
}

/** BRE and ERE to a JavaScript RegExp source. `-F` is literal. */
export function toJsRegex(pattern, { extended, fixed }) {
  if (fixed) return pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (extended) return pattern
  // Basic regular expressions: `\|` `\(` `\)` `\{` `\}` `\+` `\?` are the
  // OPERATORS and their bare forms are LITERAL. That inversion is why G978's
  // `jwtVerify\|createRemoteJWKSet` is an alternation and not a literal pipe.
  let out = ''
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '\\' && '|(){}+?'.includes(pattern[i + 1])) {
      out += pattern[i + 1]
      i++
      continue
    }
    if (c === '\\') {
      out += c + (pattern[i + 1] ?? '')
      i++
      continue
    }
    if ('|(){}+?'.includes(c)) {
      out += '\\' + c
      continue
    }
    out += c
  }
  return out
}

/**
 * Every `grep` invocation quoted in this source, with its flags, pattern and
 * paths. A backslash-newline continuation is joined first, so a command split
 * across two lines is read as one — but a command split any other way is not.
 */
export function extractCommands(source, file) {
  const found = []
  // Join backslash continuations, dropping the COMMENT MARKER the next line
  // opens with. Without that drop a block comment's leading `*` survives the
  // join and is read as a path argument — and a bare `*` expands to the whole
  // tree, so one continued command in one header contaminated every finding
  // with matches from files it never searched. Measured, not feared.
  const joined = source.replace(/\\\n[ \t]*(?:\*|--|\/\/|#|>)?[ \t]*/g, ' ')
  // map joined offsets back to original lines by counting newlines consumed
  const lineAt = lineIndexer(joined)
  const re = /\b(grep|rg|awk|ls|find|git\s+grep)\b/g
  let m
  while ((m = re.exec(joined)) !== null) {
    const tool = m[1].replace(/\s+/g, ' ')
    const lineNo = lineAt(m.index)
    const eol = joined.indexOf('\n', m.index)
    const rest = joined.slice(m.index + m[0].length, eol === -1 ? undefined : eol)
    if (UNEVALUABLE_TOOLS.test(tool)) {
      found.push({ tool, file, line: lineNo, evaluable: false, reason: 'not grep' })
      continue
    }
    const { tokens } = tokenise(rest)
    if (!tokens || tokens.length === 0) {
      found.push({ tool, file, line: lineNo, evaluable: false, reason: 'unparseable' })
      continue
    }
    let flags = ''
    let k = 0
    while (k < tokens.length && tokens[k].quoted === '' && /^-[A-Za-z]+$/.test(tokens[k].value)) {
      flags += tokens[k].value.slice(1)
      k++
    }
    const patternToken = tokens[k]
    if (!patternToken || !patternToken.quoted) {
      // a bare pattern is ambiguous with a path; refusing it is the honest answer
      found.push({ tool, file, line: lineNo, evaluable: false, reason: 'unquoted pattern' })
      continue
    }
    const paths = tokens.slice(k + 1).map((t) => t.value).filter(Boolean)
    if (paths.length === 0) {
      found.push({ tool, file, line: lineNo, evaluable: false, reason: 'no path' })
      continue
    }
    if (flags.includes('v')) {
      found.push({ tool, file, line: lineNo, evaluable: false, reason: 'inverted match' })
      continue
    }
    found.push({
      tool,
      file,
      line: lineNo,
      evaluable: true,
      pattern: patternToken.value,
      flags,
      paths,
    })
  }
  return found
}

/** Expand one path argument to scanned files. `*` matches within one segment. */
function expandPath(spec, recursive, root, allFiles) {
  const clean = spec.replace(/^\.\//, '').replace(/\/$/, '')
  if (clean.includes('**') || clean.includes('{') || clean.includes('$')) return null
  // A bare `*` is refused rather than expanded. In a shell it means every
  // top-level entry, and under `-r` that is the whole tree — so one misparse
  // makes every finding cite files the command never read. A derivation
  // written as a bare `*` in prose is not one this can honestly evaluate.
  if (clean === '*' || clean === '') return null
  if (clean.includes('*')) {
    const rx = new RegExp(
      '^' + clean.split('/').map((s) => s.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('/') + '$',
    )
    // Under `-r` a glob that names DIRECTORIES carries their subtrees with it,
    // which is why `server/*` and `server/` are the same command.
    return allFiles.filter((f) => rx.test(f) || (recursive && f.split('/').some((_, i, p) => rx.test(p.slice(0, i + 1).join('/')))))
  }
  let st
  try {
    st = statSync(join(root, clean))
  } catch {
    return null
  }
  if (st.isDirectory()) {
    if (!recursive) return []
    return allFiles.filter((f) => f === clean || f.startsWith(clean + '/'))
  }
  return [clean]
}

/**
 * Run one extracted command and return the lines it matches which are
 * themselves quotations of a command.
 */
export function evaluate(cmd, { root = ROOT, allFiles, read } = {}) {
  const recursive = cmd.flags.includes('r') || cmd.flags.includes('R')
  const targets = []
  for (const p of cmd.paths) {
    const expanded = expandPath(p, recursive, root, allFiles)
    if (expanded === null) return { unevaluable: 'unexpandable path' }
    targets.push(...expanded)
  }
  if (targets.length === 0) return { unevaluable: 'no target files' }
  let rx
  try {
    rx = new RegExp(
      toJsRegex(cmd.pattern, { extended: cmd.flags.includes('E'), fixed: cmd.flags.includes('F') }),
      (cmd.flags.includes('i') ? 'i' : '') + 'g',
    )
  } catch {
    return { unevaluable: 'pattern not translatable' }
  }
  let examined = 0
  const selfMatches = []
  for (const t of [...new Set(targets)].sort()) {
    const lines = read(t)
    if (lines === null) continue
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      rx.lastIndex = 0
      let hit = false
      let inQuotation = false
      // A line with no search verb on it cannot be a quotation of one, and
      // 99% of match lines are not. Skipping the span scan for them is what
      // keeps this gate stage under a second.
      const couldQuote = line.includes('grep') || line.includes('rg ')
      let m
      while ((m = rx.exec(line)) !== null) {
        hit = true
        if (m[0] === '') {
          rx.lastIndex++
          continue
        }
        if (!couldQuote) break
        if (!inQuotation) {
          // THE PROPERTY: this match sits inside the pattern argument of a
          // quoted search command, and that command is THIS one — the same
          // pattern text, not merely a command that happens to contain it.
          for (const s of quotedPatternSpans(line)) {
            if (m.index >= s.start && m.index < s.end && s.value === cmd.pattern) {
              inQuotation = true
              break
            }
          }
        }
      }
      if (!hit) continue
      examined++
      if (inQuotation) selfMatches.push({ file: t, line: i + 1, text: line.trim() })
    }
  }
  return { examined, selfMatches, targets: targets.length }
}

/** The whole audit. `files` is a parameter so tests can be deterministic. */
export function audit({ root = ROOT, files } = {}) {
  const allFiles = files ?? corpusFiles(root)
  const cache = new Map()
  const read = (rel) => {
    if (cache.has(rel)) return cache.get(rel)
    let lines = null
    try {
      lines = readFileSync(join(root, rel), 'utf8').split('\n')
    } catch {
      lines = null
    }
    cache.set(rel, lines)
    return lines
  }

  let quoted = 0
  let evaluable = 0
  let examined = 0
  const byPattern = new Map()
  // One evaluation per DISTINCT command. The same derivation is quoted up to
  // eighty times across this record; running it eighty times is the difference
  // between a gate stage and a coffee break.
  const memo = new Map()

  for (const f of allFiles) {
    const lines = read(f)
    if (lines === null) continue
    for (const cmd of extractCommands(lines.join('\n'), f)) {
      quoted++
      if (!cmd.evaluable) continue
      evaluable++
      const key = `${cmd.flags} ${cmd.pattern} ${cmd.paths.join('')}`
      let result = memo.get(key)
      if (result === undefined) {
        result = evaluate(cmd, { root, allFiles, read })
        memo.set(key, result)
      }
      if (result.unevaluable) continue
      examined += result.examined
      if (result.selfMatches.length === 0) continue
      if (!byPattern.has(cmd.pattern))
        byPattern.set(cmd.pattern, { pattern: cmd.pattern, quotedAt: [], selfMatches: new Map() })
      const entry = byPattern.get(cmd.pattern)
      entry.quotedAt.push(`${cmd.file}:${cmd.line}`)
      for (const s of result.selfMatches) entry.selfMatches.set(`${s.file}:${s.line}`, s)
    }
  }

  const findings = [...byPattern.values()]
    .map((e) => ({
      pattern: e.pattern,
      quotedAt: [...new Set(e.quotedAt)].sort(),
      selfMatches: [...e.selfMatches.values()].sort((a, b) =>
        a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1,
      ),
    }))
    .sort((a, b) => (a.pattern < b.pattern ? -1 : 1))

  return { files: allFiles.length, quoted, evaluable, examined, findings }
}

function main() {
  const started = Date.now()
  const { files, quoted, evaluable, examined, findings } = audit()

  const sweep = new Set(SWEEP_23_SEP)
  const censusFor = (pattern) => KNOWN.find((k) => k.pattern === pattern)
  const inCensus = (pattern) => Boolean(censusFor(pattern)) || sweep.has(pattern)
  const news = findings.filter((f) => !inCensus(f.pattern))
  const seen = new Set(findings.map((f) => f.pattern))
  const stale = [
    ...KNOWN.filter((k) => !seen.has(k.pattern)).map((k) => ({ pattern: k.pattern, from: k.kind })),
    ...SWEEP_23_SEP.filter((p) => !seen.has(p)).map((p) => ({ pattern: p, from: 'sweep' })),
  ]

  for (const f of findings) {
    const known = censusFor(f.pattern)
    const tag = known ? (known.kind === 'historical' ? 'HISTORICAL' : 'DEBT') : sweep.has(f.pattern) ? 'SWEEP' : 'NEW'
    if (tag === 'SWEEP') continue // inventoried; the summary counts them
    console.log(`\n${tag}  grep '${f.pattern}'`)
    console.log(`  quoted at   : ${f.quotedAt.join(', ')}`)
    for (const s of f.selfMatches) console.log(`  counts itself: ${s.file}:${s.line}  ${s.text.slice(0, 96)}`)
    if (known) console.log(`  census      : ${known.why}`)
  }

  console.log(
    `\nself-measuring derivations: ${files} file(s) scanned; ${quoted} command(s) quoted; ` +
      `${evaluable} evaluable; ${examined} match line(s) examined.`,
  )
  const arguedHere = findings.filter((f) => censusFor(f.pattern)).length
  const sweptHere = findings.filter((f) => !censusFor(f.pattern) && sweep.has(f.pattern)).length
  const kinds = {}
  for (const k of [...KNOWN, ...SWEEP_23_SEP_CLASSIFIED]) kinds[k.kind] = (kinds[k.kind] ?? 0) + 1
  console.log(
    `${findings.length} self-measuring derivation(s): ${arguedHere} argued, ` +
      `${sweptHere} inventoried by the 23 Sep sweep, ${news.length} not in the census.`,
  )
  // Every censused entry has been READ (G2183). Printing the split is what stops
  // `debt` becoming a drawer: a live derivation that misleads today is a number
  // somebody has to look at, not a line in a list nobody prints.
  console.log(
    `census: ${kinds.historical ?? 0} historical (correct as written) · ` +
      `${kinds.debt ?? 0} debt (LIVE, argued, owed) · ${kinds.structural ?? 0} structural.`,
  )

  // ── anti-vacuity. A checker that reports success over nothing is §5.6. ──
  if (quoted === 0 || evaluable === 0 || examined === 0) {
    console.error(
      `\n✘ REFUSING A ZERO SUBJECT — ${quoted} quoted, ${evaluable} evaluable, ${examined} examined. ` +
        'A run that found no derivation to test has not tested anything, and reporting success over ' +
        'an empty set is the defect this gate exists to catch, one layer up.',
    )
    process.exit(1)
  }

  if (stale.length > 0) {
    console.error(`\n✘ ${stale.length} CENSUS ENTR(IES) NO LONGER SELF-MATCH — delete them:`)
    for (const k of stale) console.error(`    grep '${k.pattern}'  (${k.kind})`)
    console.error(
      '  A register that outlives its subject is a register nobody can trust. If the derivation was ' +
        'repaired, the entry goes with it, in that commit.',
    )
    process.exit(1)
  }

  if (news.length > 0) {
    console.error(`\n✘ ${news.length} SELF-MEASURING DERIVATION(S) NOT IN THE CENSUS.`)
    console.error(
      '  A derivation may be spelled anywhere EXCEPT inside the files it searches. Either narrow the ' +
        'command so it cannot match prose — anchor it, or count a token no sentence writes — or point ' +
        'at a parser. See the repairs at `tools/served-set.mjs` and the header of this file.',
    )
    process.exit(1)
  }

  console.log(`OK  every quoted grep derivation is trustworthy, or censused. ${Date.now() - started}ms`)
}

if (process.argv[1] && process.argv[1].endsWith('check-self-measuring-derivations.mjs')) main()
